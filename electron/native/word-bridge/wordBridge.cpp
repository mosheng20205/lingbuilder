// LingBuilderWord.dll —— LingBuilder Word 文档模块（lingbuilder.data.word）随附运行桥。
// 写路径：OOXML 直读直写（docx = ZIP + XML，miniz 3.0.2 解包/打包），无需安装 Microsoft Word。
// 读路径：word/document.xml 解析进迷你 DOM，段落/表格/图片关系全量视图。
// 互转：Word_导出PDF（CID STSong-Light 文本 + 表格网格 + JPEG/PNG 图片，本模块子集）；
//       表格 ↔ Excel（自带最小 xlsx 读写，不依赖 libxlsxwriter/OpenXLSX）。
//
// ABI 约定（与 wordRuntime.ts 生成的 C++ 桥一一对应）：
//   - 所有导出为 extern "C" __cdecl，导出名由 wordBridge.def 固定，x86/x64 一致。
//   - 所有字符串参数与返回值均为 UTF-8；宽字符转换只发生在生成代码一侧。
//   - 文档句柄为 long long；0 表示无效句柄。
//   - 返回 const char* 的导出指向本 DLL 内的线程局部缓冲区，调用方必须立即复制。
//   - 失败时导出返回 0/负值，并更新 LBWord_LastError 的线程局部中文错误。

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "miniz.h"            // zip 读写 + tinfl/tdefl（miniz.c 以独立 C 单元一起编译进 DLL）
#include "../pdf-writer/lb_pdfwrite.h"
#include "../common/lb_pngcodec.h"
#include "../common/lb_minijson.h"
#include "lb_docx.h"

using namespace lbdocx;

namespace {

thread_local std::wstring g_lastErrorWide;

void setError(const std::wstring& message) { g_lastErrorWide = message; }
void setErrorUtf8(const std::string& message) { g_lastErrorWide = lbdocx::utf8ToWide(message); }

std::string wideToUtf8Local(const std::wstring& text) {
    if (text.empty()) return std::string();
    int bytes = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0, nullptr, nullptr);
    std::string out(size_t(bytes > 0 ? bytes : 0), '\0');
    if (bytes > 0) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), &out[0], bytes, nullptr, nullptr);
    return out;
}

std::wstring utf8ToWideLocal(const std::string& text) {
    if (text.empty()) return std::wstring();
    int chars = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0);
    std::wstring out(size_t(chars > 0 ? chars : 0), L'\0');
    if (chars > 0) MultiByteToWideChar(CP_UTF8, 0, text.c_str(), int(text.size()), &out[0], chars);
    return out;
}

bool readAllBytes(const std::string& pathUtf8, std::vector<uint8_t>& out) {
    std::wstring wide = utf8ToWideLocal(pathUtf8);
    HANDLE file = CreateFileW(wide.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) { setError(L"无法打开文件：" + wide); return false; }
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(file, &size) || size.QuadPart < 0 || size.QuadPart > 512 * 1024 * 1024) { CloseHandle(file); setError(L"文件大小非法或超过 512MB"); return false; }
    out.resize(size_t(size.QuadPart));
    DWORD readBytes = 0;
    if (!out.empty() && !ReadFile(file, out.data(), DWORD(out.size()), &readBytes, nullptr)) { CloseHandle(file); setError(L"读取文件失败：" + wide); return false; }
    out.resize(readBytes);
    CloseHandle(file);
    return true;
}

bool writeAllBytes(const std::string& pathUtf8, const std::vector<uint8_t>& data) {
    std::wstring wide = utf8ToWideLocal(pathUtf8);
    HANDLE file = CreateFileW(wide.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) { setError(L"无法写出文件（检查目录是否存在/是否被占用）：" + wide); return false; }
    DWORD written = 0;
    if (!data.empty() && !WriteFile(file, data.data(), DWORD(data.size()), &written, nullptr)) { CloseHandle(file); setError(L"写出文件失败：" + wide); return false; }
    CloseHandle(file);
    return written == data.size();
}

thread_local std::string g_textBuffer; // 返回文本缓冲（UTF-8）
const char* returnUtf8(const std::wstring& text) {
    g_textBuffer = wideToUtf8Local(text);
    return g_textBuffer.c_str();
}

struct WordDoc {
    Doc doc;
};

std::map<long long, std::unique_ptr<WordDoc>> g_docs;
long long g_nextHandle = 1;

WordDoc* docOf(long long handle) {
    auto it = g_docs.find(handle);
    if (it == g_docs.end()) { setError(L"文档句柄无效或已关闭。"); return nullptr; }
    return it->second.get();
}

WordDoc* validDoc(long long handle) {
    if (handle == 0) { setError(L"文档句柄为 0，请先成功创建或打开文档。"); return nullptr; }
    return docOf(handle);
}

// ---------- 图片辅助：关系 rId → 媒体条目 ----------
struct InlineImage { std::vector<uint8_t> data; bool isJpeg; int pixW, pixH; };

int probeJpegSize(const uint8_t* data, size_t size, int& w, int& h) {
    size_t i = 2;
    while (i + 9 < size) {
        if (data[i] != 0xFF) { i++; continue; }
        uint8_t marker = data[i + 1];
        if (marker == 0xC0 || marker == 0xC1 || marker == 0xC2 || marker == 0xC3) {
            h = (data[i + 5] << 8) | data[i + 6];
            w = (data[i + 7] << 8) | data[i + 8];
            return w > 0 && h > 0 ? 1 : 0;
        }
        if (marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD9)) { i += 2; continue; }
        i += 2 + ((size_t(data[i + 2]) << 8) | data[i + 3]);
    }
    return 0;
}

// 收集段落中的内联图片（按文档顺序）。
std::vector<InlineImage> collectInlineImages(WordDoc& word, XmlNode* para) {
    std::vector<InlineImage> images;
    if (!word.doc.relsXml) return images;
    // rId → target
    std::map<std::string, std::string> ridTarget;
    for (const auto& child : word.doc.relsXml->children) {
        const std::string* id = child->attr("Id");
        const std::string* target = child->attr("Target");
        if (id && target) ridTarget[*id] = *target;
    }
    std::function<void(const XmlNode&)> walk = [&](const XmlNode& node) {
        if (node.is("a", "blip")) {
            if (const std::string* embed = node.attr("r:embed")) {
                auto it = ridTarget.find(*embed);
                if (it != ridTarget.end()) {
                    std::string target = it->second;
                    std::replace(target.begin(), target.end(), '\\', '/');
                    std::string partName = "word/" + target;
                    auto part = word.doc.parts.find(partName);
                    if (part != word.doc.parts.end()) {
                        InlineImage image;
                        image.data = part->second;
                        image.isJpeg = target.size() >= 4 && (target.compare(target.size() - 4, 4, ".jpg") == 0 || target.compare(target.size() - 5, 5, ".jpeg") == 0);
                        if (image.isJpeg) {
                            int w = 0, h = 0;
                            if (probeJpegSize(image.data.data(), image.data.size(), w, h)) { image.pixW = w; image.pixH = h; images.push_back(std::move(image)); }
                        } else {
                            lbpng::Image decoded;
                            std::string reason;
                            if (lbpng::decode(image.data.data(), image.data.size(), decoded, &reason)) {
                                image.pixW = decoded.width;
                                image.pixH = decoded.height;
                                images.push_back(std::move(image));
                            }
                        }
                    }
                }
            }
        }
        for (const auto& child : node.children) walk(*child);
    };
    walk(*para);
    return images;
}

} // namespace

// ============================ 导出层 ============================

extern "C" {

__declspec(dllexport) const char* __cdecl LBWord_Version() {
    return "LingBuilderWordBridge 1.0.0 (OOXML docx + CID PDF + miniz 3.0.2)";
}

__declspec(dllexport) int __cdecl LBWord_Available() { return 1; }

__declspec(dllexport) const char* __cdecl LBWord_LastError() {
    return returnUtf8(g_lastErrorWide);
}

__declspec(dllexport) long long __cdecl LBWord_Create() {
    g_lastErrorWide.clear();
    auto word = std::make_unique<WordDoc>();
    initCreatedDoc(word->doc);
    long long handle = g_nextHandle++;
    g_docs[handle] = std::move(word);
    return handle;
}

__declspec(dllexport) long long __cdecl LBWord_Open(const char* pathUtf8) {
    g_lastErrorWide.clear();
    if (!pathUtf8 || !*pathUtf8) { setError(L"文件路径为空。"); return 0; }
    std::wstring path = utf8ToWideLocal(pathUtf8);
    if (path.size() >= 4 && (path.compare(path.size() - 4, 4, L".doc") == 0) && path.compare(path.size() - 5, 5, L".docx") != 0) {
        setError(L"暂不支持旧版 .doc 二进制格式，请先用 Word/WPS 另存为 .docx。");
        return 0;
    }
    std::vector<uint8_t> bytes;
    if (!readAllBytes(pathUtf8, bytes)) return 0;
    auto word = std::make_unique<WordDoc>();
    std::string error;
    if (!openDocx(bytes.data(), bytes.size(), word->doc, error)) { setErrorUtf8(error); return 0; }
    long long handle = g_nextHandle++;
    g_docs[handle] = std::move(word);
    return handle;
}

__declspec(dllexport) int __cdecl LBWord_Save(long long handle, const char* pathUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (!pathUtf8 || !*pathUtf8) { setError(L"保存路径为空。"); return 0; }
    std::vector<uint8_t> bytes;
    std::string error;
    if (!buildDocxBytes(word->doc, bytes, error)) { setErrorUtf8(error); return 0; }
    if (!writeAllBytes(pathUtf8, bytes)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_Close(long long handle) {
    g_lastErrorWide.clear();
    if (g_docs.erase(handle) == 0) { setError(L"文档句柄无效或已关闭。"); return 0; }
    return 1;
}

__declspec(dllexport) void __cdecl LBWord_ReleaseAll() {
    g_docs.clear();
}

__declspec(dllexport) const char* __cdecl LBWord_GetFullText(long long handle) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return "";
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    std::wstring full;
    // 追加块（未保存的新内容）与 DOM 视图合并输出
    auto appendText = [&](const std::wstring& piece) {
        if (!full.empty()) full += L"\n";
        full += piece;
    };
    for (const auto& para : paras) appendText(para.text);
    for (const auto& table : tables)
        for (const auto& row : table.cells) {
            std::wstring line;
            for (size_t c = 0; c < row.size(); c++) { if (c) line += L"\t"; line += row[c]; }
            appendText(line);
        }
    for (const auto& block : word->doc.appends) {
        if (block.kind == Block::Kind::Paragraph) appendText(block.text);
        else if (block.kind == Block::Kind::Table)
            for (const auto& row : block.table) {
                std::wstring line;
                for (size_t c = 0; c < row.size(); c++) { if (c) line += L"\t"; line += row[c]; }
                appendText(line);
            }
    }
    return returnUtf8(full);
}

__declspec(dllexport) int __cdecl LBWord_GetParaCount(long long handle) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    return int(paras.size());
}

__declspec(dllexport) const char* __cdecl LBWord_GetParaText(long long handle, int indexFrom1) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return "";
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    if (indexFrom1 < 1 || size_t(indexFrom1) > paras.size()) { setError(L"段落索引越界。"); return ""; }
    return returnUtf8(paras[size_t(indexFrom1) - 1].text);
}

__declspec(dllexport) const char* __cdecl LBWord_GetParaStyle(long long handle, int indexFrom1) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return "";
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    if (indexFrom1 < 1 || size_t(indexFrom1) > paras.size()) { setError(L"段落索引越界。"); return ""; }
    return returnUtf8(paras[size_t(indexFrom1) - 1].style);
}

__declspec(dllexport) int __cdecl LBWord_GetTableCount(long long handle) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    int count = int(tables.size());
    for (const auto& block : word->doc.appends) if (block.kind == Block::Kind::Table) count++;
    return count;
}

// 追加块中的表格（创建模式新表）：返回其网格副本；未命中返回假。
static bool appendTableCells(WordDoc& word, int tableIndexFrom1, std::vector<std::vector<std::wstring>>& cells) {
    size_t index = 0;
    for (const auto& block : word.doc.appends) {
        if (block.kind != Block::Kind::Table) continue;
        index++;
        if (index == size_t(tableIndexFrom1)) { cells = block.table; return true; }
    }
    return false;
}

// DOM 中的表格行（打开模式既有表）：返回行网格副本。
static bool domTableRows(WordDoc& word, int tableIndexFrom1, std::vector<std::vector<std::wstring>>& rows) {
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word.doc, paras, tables);
    if (tableIndexFrom1 < 1 || size_t(tableIndexFrom1) > tables.size()) return false;
    rows = tables[size_t(tableIndexFrom1) - 1].cells;
    return true;
}

__declspec(dllexport) int __cdecl LBWord_GetTableRowCount(long long handle, int tableIndexFrom1) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    std::vector<std::vector<std::wstring>> cells;
    if (appendTableCells(*word, tableIndexFrom1, cells)) return int(cells.size());
    if (domTableRows(*word, tableIndexFrom1, cells)) return int(cells.size());
    setError(L"表格索引越界。");
    return 0;
}

__declspec(dllexport) int __cdecl LBWord_GetTableColCount(long long handle, int tableIndexFrom1) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    std::vector<std::vector<std::wstring>> cells;
    if (!appendTableCells(*word, tableIndexFrom1, cells) && !domTableRows(*word, tableIndexFrom1, cells)) {
        setError(L"表格索引越界。");
        return 0;
    }
    int cols = 0;
    for (const auto& row : cells) cols = int(row.size()) > cols ? int(row.size()) : cols;
    return cols;
}

__declspec(dllexport) const char* __cdecl LBWord_GetCellText(long long handle, int tableIndexFrom1, int rowFrom1, int colFrom1) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return "";
    std::vector<std::vector<std::wstring>> cells;
    if (!appendTableCells(*word, tableIndexFrom1, cells) && !domTableRows(*word, tableIndexFrom1, cells)) {
        setError(L"表格索引越界。");
        return "";
    }
    if (rowFrom1 < 1 || size_t(rowFrom1) > cells.size()) { setError(L"表格行号越界。"); return ""; }
    const auto& row = cells[size_t(rowFrom1) - 1];
    if (colFrom1 < 1 || size_t(colFrom1) > row.size()) { setError(L"表格列号越界。"); return ""; }
    return returnUtf8(row[size_t(colFrom1) - 1]);
}

__declspec(dllexport) int __cdecl LBWord_AddHeading(long long handle, const char* textUtf8, int level) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (level < 1 || level > 6) { setError(L"标题级别必须为 1～6。"); return 0; }
    Block block;
    block.kind = Block::Kind::Paragraph;
    block.text = utf8ToWideLocal(textUtf8 ? textUtf8 : "");
    block.style = L"标题" + std::to_wstring(level);
    word->doc.appends.push_back(std::move(block));
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_AddParagraph(long long handle, const char* textUtf8, const char* styleUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    Block block;
    block.kind = Block::Kind::Paragraph;
    block.text = utf8ToWideLocal(textUtf8 ? textUtf8 : "");
    block.style = utf8ToWideLocal(styleUtf8 ? styleUtf8 : "");
    word->doc.appends.push_back(std::move(block));
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_AddTable(long long handle, int rows, int cols) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (rows < 1 || rows > 1000 || cols < 1 || cols > 100) { setError(L"表格行列数范围：行 1～1000，列 1～100。"); return 0; }
    Block block;
    block.kind = Block::Kind::Table;
    block.table.assign(size_t(rows), std::vector<std::wstring>(size_t(cols)));
    word->doc.appends.push_back(std::move(block));
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_SetCellText(long long handle, int tableIndexFrom1, int rowFrom1, int colFrom1, const char* textUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    std::wstring text = utf8ToWideLocal(textUtf8 ? textUtf8 : "");
    // 优先改追加块中的表格（创建模式新表）
    size_t appendTableIndex = 0;
    for (auto& block : word->doc.appends) {
        if (block.kind == Block::Kind::Table) {
            appendTableIndex++;
            if (appendTableIndex == size_t(tableIndexFrom1)) {
                if (rowFrom1 < 1 || size_t(rowFrom1) > block.table.size()) { setError(L"表格行号越界。"); return 0; }
                auto& row = block.table[size_t(rowFrom1) - 1];
                if (colFrom1 < 1 || size_t(colFrom1) > row.size()) { setError(L"表格列号越界。"); return 0; }
                row[size_t(colFrom1) - 1] = text;
                return 1;
            }
        }
    }
    // 打开文档的既有表：改 DOM
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    if (tableIndexFrom1 < 1 || size_t(tableIndexFrom1) > tables.size()) { setError(L"表格索引越界。"); return 0; }
    TableView& view = tables[size_t(tableIndexFrom1) - 1];
    if (rowFrom1 < 1 || size_t(rowFrom1) > view.cells.size()) { setError(L"表格行号越界。"); return 0; }
    XmlNode* tr = nullptr;
    {
        auto trs = view.node->findChildren("w", "tr");
        if (size_t(rowFrom1 - 1) < trs.size()) tr = trs[size_t(rowFrom1 - 1)];
    }
    if (!tr) { setError(L"表格行节点缺失。"); return 0; }
    auto tcs = tr->findChildren("w", "tc");
    if (colFrom1 < 1 || size_t(colFrom1) > tcs.size()) { setError(L"表格列号越界。"); return 0; }
    XmlNode* tc = tcs[size_t(colFrom1) - 1];
    auto ps = tc->findChildren("w", "p");
    XmlNode* para = ps.empty() ? nullptr : ps[0];
    if (!para) {
        auto newPara = std::make_unique<XmlNode>();
        newPara->tag = "w:p";
        newPara->parent = tc;
        para = newPara.get();
        tc->children.push_back(std::move(newPara));
    }
    // 清空段内全部 run 的文本（保留首个 run 承载新文本）
    bool wrote = false;
    std::function<void(XmlNode&)> clearRuns = [&](XmlNode& node) {
        for (auto& child : node.children) {
            if (child->is("w", "r")) {
                for (auto& t : child->findChildren("w", "t")) {
                    if (!wrote) { t->text = wideToUtf8(text); if (t->attr("xml:space") == nullptr) t->attrs.emplace_back("xml:space", "preserve"); wrote = true; }
                    else t->text.clear();
                }
            }
            clearRuns(*child);
        }
    };
    clearRuns(*para);
    if (!wrote) {
        auto run = std::make_unique<XmlNode>();
        run->tag = "w:r";
        run->parent = para;
        auto t = std::make_unique<XmlNode>();
        t->tag = "w:t";
        t->attrs.emplace_back("xml:space", "preserve");
        t->text = wideToUtf8(text);
        run->children.push_back(std::move(t));
        para->children.push_back(std::move(run));
    }
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_AddImage(long long handle, const char* pathUtf8, int widthPx, int heightPx) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (!pathUtf8 || !*pathUtf8) { setError(L"图片路径为空。"); return 0; }
    std::vector<uint8_t> bytes;
    if (!readAllBytes(pathUtf8, bytes)) return 0;
    bool isJpeg = bytes.size() > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8;
    bool isPng = bytes.size() > 8 && bytes[0] == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
    if (!isJpeg && !isPng) { setError(L"仅支持 PNG 与 JPEG 图片。"); return 0; }
    int w = widthPx, h = heightPx;
    if (w <= 0 || h <= 0) {
        if (isJpeg) {
            if (!probeJpegSize(bytes.data(), bytes.size(), w, h)) { setError(L"图片数据损坏，无法解析尺寸。"); return 0; }
        } else {
            lbpng::Image decoded;
            std::string reason;
            if (!lbpng::decode(bytes.data(), bytes.size(), decoded, &reason)) { setError(lbdocx::utf8ToWide("PNG 解码失败：" + reason)); return 0; }
            w = decoded.width;
            h = decoded.height;
        }
    }
    if (w > 4000 || h > 4000) { setError(L"图片尺寸过大（上限 4000×4000）。"); return 0; }
    Block block;
    block.kind = Block::Kind::Image;
    block.imageData = std::move(bytes);
    block.imageIsJpeg = isJpeg;
    block.imageW = w;
    block.imageH = h;
    word->doc.appends.push_back(std::move(block));
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_ReplacePlaceholder(long long handle, const char* nameUtf8, const char* valueUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return -1;
    if (!nameUtf8 || !*nameUtf8) { setError(L"占位符名称为空。"); return -1; }
    int count = replacePlaceholder(word->doc, utf8ToWideLocal(nameUtf8), utf8ToWideLocal(valueUtf8 ? valueUtf8 : ""));
    return count;
}

__declspec(dllexport) int __cdecl LBWord_ReplacePlaceholdersJson(long long handle, const char* jsonUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return -1;
    if (!jsonUtf8 || !*jsonUtf8) { setError(L"替换 JSON 为空。"); return -1; }
    lbjson::Value root;
    std::string error;
    if (!lbjson::parse(jsonUtf8, root, error) || !root.isObject()) { setError(L"替换 JSON 必须是对象：" + lbdocx::utf8ToWide(error)); return -1; }
    int total = 0;
    for (const auto& kv : root.members) total += replacePlaceholder(word->doc, lbdocx::utf8ToWide(kv.first), lbdocx::utf8ToWide(kv.second.asString()));
    return total;
}

__declspec(dllexport) int __cdecl LBWord_ReportFromJson(const char* templatePathUtf8, const char* dataJsonUtf8, const char* outputPathUtf8) {
    g_lastErrorWide.clear();
    if (!templatePathUtf8 || !*templatePathUtf8 || !outputPathUtf8 || !*outputPathUtf8) { setError(L"模板路径或输出路径为空。"); return 0; }
    lbjson::Value root;
    std::string error;
    if (dataJsonUtf8 && *dataJsonUtf8) {
        if (!lbjson::parse(dataJsonUtf8, root, error) || !root.isObject()) { setError(L"数据 JSON 必须是对象：" + lbdocx::utf8ToWide(error)); return 0; }
    }
    std::vector<uint8_t> bytes;
    if (!readAllBytes(templatePathUtf8, bytes)) return 0;
    auto word = std::make_unique<WordDoc>();
    if (!openDocx(bytes.data(), bytes.size(), word->doc, error)) { setErrorUtf8(error); return 0; }
    for (const auto& kv : root.members) replacePlaceholder(word->doc, lbdocx::utf8ToWide(kv.first), lbdocx::utf8ToWide(kv.second.asString()));
    std::vector<uint8_t> out;
    if (!buildDocxBytes(word->doc, out, error)) { setErrorUtf8(error); return 0; }
    if (!writeAllBytes(outputPathUtf8, out)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_ExportPdf(long long handle, const char* outputPathUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (!outputPathUtf8 || !*outputPathUtf8) { setError(L"PDF 输出路径为空。"); return 0; }
    if (!word->doc.opened) {
        std::string mergeError;
        if (!mergeAppendsIntoDocument(word->doc, mergeError)) { setErrorUtf8(mergeError); return 0; }
        auditPdfExportability(word->doc);
    }
    if (!word->doc.pdfExportBlock.empty()) {
        setError(L"文档包含暂不支持的元素（" + lbdocx::utf8ToWide(word->doc.pdfExportBlock) + L"），无法导出 PDF：请移除该元素后重试，或用 Word/WPS 的「另存为 PDF」。");
        return 0;
    }
    if (!word->doc.documentXml) { setError(L"文档结构缺失。"); return 0; }
    XmlNode* body = word->doc.documentXml->firstChild("w", "body");
    if (!body) { setError(L"文档缺少正文主体。"); return 0; }
    lbpdf::PdfWriter pdf;
    const double pageW = 595, pageH = 842, margin = 56;
    pdf.begin(pageW, pageH, margin);
    lbpdf::Layout layout;
    layout.begin(&pdf, pageW - margin * 2, 11);
    for (const auto& child : body->children) {
        if (child->is("w", "p")) {
            std::wstring text = paragraphText(child.get());
            std::wstring style = paragraphStyle(child.get());
            double size = 11; bool bold = false; double indent = 0;
            if (style.rfind(L"标题", 0) == 0 && style.size() >= 3) {
                int level = _wtoi(style.substr(2).c_str());
                if (level >= 1 && level <= 6) { size = level == 1 ? 17 : level == 2 ? 14.5 : level == 3 ? 13 : level == 4 ? 12 : 11.5; bold = true; }
            }
            if (!text.empty()) layout.paragraph(text, bold, indent, size);
            // 段内内联图片
            for (const auto& image : collectInlineImages(*word, child.get())) {
                double scale = double(image.pixW) * 72.0 / 96.0;
                double drawW = scale, drawH = double(image.pixH) * 72.0 / 96.0;
                if (drawW > pageW - margin * 2) { drawH *= (pageW - margin * 2) / drawW; drawW = pageW - margin * 2; }
                layout.ensureSpace(drawH + 4);
                double topY = layout.cursorY();
                double bottomY = topY - drawH;
                size_t index;
                if (image.isJpeg) index = pdf.addImageJpeg(image.data.data(), image.data.size());
                else {
                    lbpng::Image decoded;
                    std::string reason;
                    if (!lbpng::decode(image.data.data(), image.data.size(), decoded, &reason)) { setError(lbdocx::utf8ToWide("PNG 解码失败：" + reason)); return 0; }
                    // 转紧凑 RGB
                    std::vector<uint8_t> rgb(size_t(decoded.width) * decoded.height * 3);
                    for (int y = 0; y < decoded.height; y++)
                        for (int x = 0; x < decoded.width; x++) {
                            const uint8_t* src = &decoded.pixels[(size_t(y) * decoded.width + x) * decoded.channels];
                            uint8_t* dst = &rgb[(size_t(y) * decoded.width + x) * 3];
                            dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2];
                        }
                    index = pdf.addImageRgb(decoded.width, decoded.height, rgb.data(), rgb.size());
                }
                layout.drawImage(index, margin, bottomY, drawW, drawH);
                layout.setCursorY(bottomY - 6);
            }
        } else if (child->is("w", "tbl")) {
            std::vector<std::vector<std::wstring>> rows;
            for (XmlNode* tr : child->findChildren("w", "tr")) {
                std::vector<std::wstring> row;
                for (XmlNode* tc : tr->findChildren("w", "tc")) {
                    std::wstring cell;
                    for (XmlNode* p : tc->findChildren("w", "p")) {
                        if (!cell.empty()) cell += L"\n";
                        cell += paragraphText(p);
                    }
                    row.push_back(cell);
                }
                rows.push_back(row);
            }
            if (rows.empty()) continue;
            size_t cols = 0;
            for (const auto& row : rows) cols = row.size() > cols ? row.size() : cols;
            if (!cols) continue;
            // 列宽按内容长度加权（每列至少 36pt）
            std::vector<double> weights(cols, 1.0);
            for (size_t c = 0; c < cols; c++) {
                double maxLen = 2;
                for (const auto& row : rows) if (c < row.size()) maxLen = double(row[c].size()) > maxLen ? double(row[c].size()) : maxLen;
                weights[c] = maxLen;
            }
            double total = 0;
            for (double w : weights) total += w;
            std::vector<double> colWidths(cols);
            for (size_t c = 0; c < cols; c++) colWidths[c] = (pageW - margin * 2) * weights[c] / total;
            layout.spacer(4);
            layout.table(rows, colWidths, true, true);
            layout.spacer(6);
        }
    }
    std::vector<uint8_t> out;
    std::string error;
    if (!pdf.serialize(out, &error)) { setError(lbdocx::utf8ToWide("PDF 生成失败：" + error)); return 0; }
    if (!writeAllBytes(outputPathUtf8, out)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBWord_TableToExcel(long long handle, int tableIndexFrom1, const char* outputPathUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (!outputPathUtf8 || !*outputPathUtf8) { setError(L"输出路径为空。"); return 0; }
    // 追加块优先，其次 DOM 表
    size_t appendTableIndex = 0;
    for (const auto& block : word->doc.appends) {
        if (block.kind == Block::Kind::Table) {
            appendTableIndex++;
            if (appendTableIndex == size_t(tableIndexFrom1)) {
                std::vector<uint8_t> out;
                std::string error;
                if (!lbxlsx::writeXlsx("Sheet1", block.table, out, error)) { setErrorUtf8(error); return 0; }
                return writeAllBytes(outputPathUtf8, out) ? 1 : 0;
            }
        }
    }
    std::vector<ParaView> paras;
    std::vector<TableView> tables;
    collectViews(word->doc, paras, tables);
    if (tableIndexFrom1 < 1 || size_t(tableIndexFrom1) > tables.size()) { setError(L"表格索引越界。"); return 0; }
    std::vector<uint8_t> out;
    std::string error;
    if (!lbxlsx::writeXlsx("Sheet1", tables[size_t(tableIndexFrom1) - 1].cells, out, error)) { setErrorUtf8(error); return 0; }
    return writeAllBytes(outputPathUtf8, out) ? 1 : 0;
}

__declspec(dllexport) int __cdecl LBWord_FillTableFromExcel(long long handle, int tableIndexFrom1, const char* excelPathUtf8) {
    g_lastErrorWide.clear();
    WordDoc* word = validDoc(handle);
    if (!word) return 0;
    if (!excelPathUtf8 || !*excelPathUtf8) { setError(L"Excel 文件路径为空。"); return 0; }
    std::vector<uint8_t> bytes;
    if (!readAllBytes(excelPathUtf8, bytes)) return 0;
    lbxlsx::Sheet sheet;
    std::string error;
    if (!lbxlsx::readXlsx(bytes.data(), bytes.size(), sheet, error)) { setErrorUtf8(error); return 0; }
    if (sheet.rows.empty()) { setError(L"Excel 工作表为空。"); return 0; }
    size_t filled = 0;
    for (size_t r = 0; r < sheet.rows.size(); r++) {
        for (size_t c = 0; c < sheet.rows[r].size(); c++) {
            if (sheet.rows[r][c].empty()) continue;
            int ok = LBWord_SetCellText(handle, tableIndexFrom1, int(r) + 1, int(c) + 1, wideToUtf8Local(sheet.rows[r][c]).c_str());
            if (!ok) {
                setError(L"Excel 第 " + std::to_wstring(r + 1) + L" 行第 " + std::to_wstring(c + 1) + L" 列超出 Word 表格范围：请保证表格行列不小于数据区域。");
                return 0;
            }
            filled++;
        }
    }
    return int(filled) >= 0 ? 1 : 0;
}

} // extern "C"
