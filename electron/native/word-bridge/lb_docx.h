// lb_docx.h — LingBuilder OOXML 文档模型单头（word-bridge 主力，pdf-bridge 的「转Word文本流」复用写出器）。
// 能力口径：
//   * docx = ZIP + XML：读取时解包全部条目，word/document.xml 解析进迷你 DOM；保存时改写
//     document.xml / 关系 / 媒体 / [Content_Types].xml，其余条目原样保留。
//   * 占位符替换在段落级合并 run 文本后按 span 回写，天然免疫 IME/拼写检查造成的跨 run 分裂。
//   * 追加内容（标题/段落/表格/图片）只允许追加到 body 末尾；单元格文本按 坐标覆写。
//   * 图片支持 PNG/JPEG：新图片入 word/media/，关系与内容类型同步登记。
//   * PDF 导出子集判定：文档 body 内出现文本框/艺术字/数学/复杂 drawing 等未支持元素时
//     标记 pdfExportable=false 并给出原因（导出命令据此明确拒绝，不静默降级）。
//   * 最小 xlsx 读写（word↔excel 表格互转用）：读 sheet1 内联字符串/共享字符串/数值，
//     写全新单表 xlsx（内联字符串），不依赖 libxlsxwriter/OpenXLSX。
// 依赖：miniz.h（zip 读写）、lb_minijson.h（仅 wordBridge 用，头内不依赖）。
// 约束：内容不内联进生成器运行时，允许反引号以外自由书写（仅编译进桥 DLL）。
#ifndef LB_DOCX_H
#define LB_DOCX_H

#include "miniz.h"

#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <cwchar>
#include <algorithm>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace lbdocx {

// ---------- 迷你 XML DOM ----------
struct XmlNode {
    std::string tag;                                   // 含前缀，如 "w:p"
    std::vector<std::pair<std::string, std::string>> attrs;
    std::string text;                                  // 介于标签之间的文本（元素内容）
    std::vector<std::unique_ptr<XmlNode>> children;
    XmlNode* parent = nullptr;

    const std::string* attr(const std::string& name) const {
        for (const auto& kv : attrs) if (kv.first == name) return &kv.second;
        return nullptr;
    }
    // 本地名比较（"w:p" → "p"）
    bool is(const std::string& prefix, const std::string& local) const {
        if (tag.size() == local.size()) return tag == local;
        return tag.size() == prefix.size() + 1 + local.size() && tag.compare(0, prefix.size(), prefix) == 0
            && tag[prefix.size()] == ':' && tag.compare(prefix.size() + 1, local.size(), local) == 0;
    }
    std::vector<XmlNode*> findChildren(const std::string& prefix, const std::string& local) const {
        std::vector<XmlNode*> out;
        for (const auto& child : children) if (child->is(prefix, local)) out.push_back(child.get());
        return out;
    }
    XmlNode* firstChild(const std::string& prefix, const std::string& local) const {
        for (const auto& child : children) if (child->is(prefix, local)) return child.get();
        return nullptr;
    }
};

inline void xmlEscape(const std::string& in, std::string& out) {
    out.clear();
    out.reserve(in.size() + 8);
    for (char c : in) {
        switch (c) {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case '\'': out += "&apos;"; break;
            default: out.push_back(c);
        }
    }
}

// ---------- XML 解析（唯一入口 parseXml） ----------
inline bool parseXml(const std::string& input, XmlNode& root, std::string& error) {
    const char* p = input.data();
    const char* end = input.data() + input.size();
    auto skipWsInline = [&] { while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) p++; };
    // 跳过 prolog
    while (p < end) {
        skipWsInline();
        if (end - p >= 2 && p[0] == '<' && p[1] == '?') { while (end - p >= 2 && !(p[0] == '?' && p[1] == '>')) p++; p += 2; }
        else if (end - p >= 4 && !strncmp(p, "<!--", 4)) { while (end - p >= 3 && strncmp(p, "-->", 3)) p++; p += 3; }
        else break;
    }
    std::function<bool(XmlNode&)> parseOne = [&](XmlNode& node) -> bool {
        skipWsInline();
        if (p >= end || *p != '<') { error = "期待元素"; return false; }
        p++;
        const char* nameBegin = p;
        while (p < end && *p != ' ' && *p != '>' && *p != '/' && *p != '\t' && *p != '\r' && *p != '\n') p++;
        node.tag.assign(nameBegin, p);
        if (node.tag.empty()) { error = "标签名为空"; return false; }
        while (true) {
            skipWsInline();
            if (p >= end) { error = "标签未闭合"; return false; }
            if (*p == '>') { p++; break; }
            if (*p == '/' && end - p >= 2 && p[1] == '>') { p += 2; return true; }
            const char* attrBegin = p;
            while (p < end && *p != '=' && *p != ' ' && *p != '>' && *p != '/' && *p != '\t' && *p != '\r' && *p != '\n') p++;
            if (p >= end || *p != '=') { error = "属性缺少等号"; return false; }
            std::string attrName(attrBegin, p);
            p++;
            skipWsInline();
            if (p >= end || *p != '"') { error = "属性值缺少引号"; return false; }
            p++;
            const char* valueBegin = p;
            while (p < end && *p != '"') p++;
            if (p >= end) { error = "属性值未闭合"; return false; }
            std::string raw(valueBegin, p);
            p++;
            std::string value;
            for (size_t i = 0; i < raw.size(); i++) {
                if (raw[i] == '&' && raw.compare(i, 5, "&amp;") == 0) { value += '&'; i += 4; }
                else if (raw[i] == '&' && raw.compare(i, 4, "&lt;") == 0) { value += '<'; i += 3; }
                else if (raw[i] == '&' && raw.compare(i, 4, "&gt;") == 0) { value += '>'; i += 3; }
                else if (raw[i] == '&' && raw.compare(i, 6, "&quot;") == 0) { value += '"'; i += 5; }
                else if (raw[i] == '&' && raw.compare(i, 6, "&apos;") == 0) { value += '\''; i += 5; }
                else value += raw[i];
            }
            node.attrs.emplace_back(attrName, value);
        }
        std::string pendingText;
        auto flushText = [&] {
            if (pendingText.empty()) return;
            std::string value;
            for (size_t i = 0; i < pendingText.size(); i++) {
                if (pendingText[i] == '&' && pendingText.compare(i, 5, "&amp;") == 0) { value += '&'; i += 4; }
                else if (pendingText[i] == '&' && pendingText.compare(i, 4, "&lt;") == 0) { value += '<'; i += 3; }
                else if (pendingText[i] == '&' && pendingText.compare(i, 4, "&gt;") == 0) { value += '>'; i += 3; }
                else if (pendingText[i] == '&' && pendingText.compare(i, 6, "&quot;") == 0) { value += '"'; i += 5; }
                else if (pendingText[i] == '&' && pendingText.compare(i, 6, "&apos;") == 0) { value += '\''; i += 5; }
                else value += pendingText[i];
            }
            node.text += value;
            pendingText.clear();
        };
        while (p < end) {
            if (*p == '<') {
                if (end - p >= 9 && !strncmp(p, "<![CDATA[", 9)) {
                    p += 9;
                    const char* begin = p;
                    while (end - p >= 3 && strncmp(p, "]]>", 3)) p++;
                    pendingText.append(begin, p);
                    p += 3;
                    continue;
                }
                if (end - p >= 2 && p[1] == '/') {
                    flushText();
                    p += 2;
                    while (p < end && *p != '>') p++;
                    if (p < end) p++;
                    return true;
                }
                flushText();
                auto child = std::make_unique<XmlNode>();
                child->parent = &node;
                if (!parseOne(*child)) return false;
                node.children.push_back(std::move(child));
            } else {
                pendingText.push_back(*p);
                p++;
            }
        }
        flushText();
        return true; // 文档末尾自然结束
    };
    if (!parseOne(root)) return false;
    (void)p;
    return true;
}

inline void serializeXml(const XmlNode& node, std::string& out) {
    out += '<';
    out += node.tag;
    for (const auto& kv : node.attrs) {
        out += ' ';
        out += kv.first;
        out += "=\"";
        std::string escaped;
        xmlEscape(kv.second, escaped);
        out += escaped;
        out += '"';
    }
    if (node.children.empty() && node.text.empty()) {
        out += "/>";
        return;
    }
    out += '>';
    std::string escapedText;
    xmlEscape(node.text, escapedText);
    out += escapedText;
    for (const auto& child : node.children) serializeXml(*child, out);
    out += "</";
    out += node.tag;
    out += '>';
}

// ---------- docx 文档模型 ----------
struct Block { // 追加块（创建文档与打开文档共用）
    enum class Kind { Paragraph, Table, Image } kind = Kind::Paragraph;
    std::wstring text;
    std::wstring style;           // "标题1".."标题6"、"正文"、空
    std::vector<std::vector<std::wstring>> table; // Table
    std::vector<uint8_t> imageData;               // Image（PNG/JPEG 原始文件字节）
    bool imageIsJpeg = false;
    int imageW = 0, imageH = 0;   // 0 表示未知，写入时按原图
};

struct Doc {
    bool opened = false;          // true=打开既有 docx；false=本模块新建
    std::map<std::string, std::vector<uint8_t>> parts; // 包内全部条目（打开时）
    std::unique_ptr<XmlNode> documentXml;              // word/document.xml 根
    std::unique_ptr<XmlNode> relsXml;                  // word/_rels/document.xml.rels
    std::vector<Block> appends;                        // 追加块
    int nextRid = 100;
    int nextMediaId = 1;
    std::string pdfExportBlock;   // 导出 PDF 的不支持原因（空=可导出）
    std::string error;
};

inline bool unzipToParts(const uint8_t* data, size_t size, std::map<std::string, std::vector<uint8_t>>& parts, std::string& error) {
    mz_zip_archive zip;
    memset(&zip, 0, sizeof zip);
    if (!mz_zip_reader_init_mem(&zip, data, size, 0)) { error = "无法读取 docx/xlsx 包（ZIP 结构损坏）"; return false; }
    for (mz_uint i = 0; i < mz_zip_reader_get_num_files(&zip); i++) {
        char name[512];
        mz_zip_reader_get_filename(&zip, i, name, sizeof name);
        size_t outSize = 0;
        void* content = mz_zip_reader_extract_to_heap(&zip, i, &outSize, 0);
        if (!content) { mz_zip_reader_end(&zip); error = "包内条目解压失败"; return false; }
        parts[name] = std::vector<uint8_t>(static_cast<uint8_t*>(content), static_cast<uint8_t*>(content) + outSize);
        mz_free(content);
    }
    mz_zip_reader_end(&zip);
    return true;
}

inline bool zipFromParts(const std::map<std::string, std::vector<uint8_t>>& parts, std::vector<uint8_t>& out) {
    mz_zip_archive zip;
    memset(&zip, 0, sizeof zip);
    if (!mz_zip_writer_init_heap(&zip, 0, 0)) return false;
    for (const auto& kv : parts) {
        if (!mz_zip_writer_add_mem(&zip, kv.first.c_str(), kv.second.data(), kv.second.size(), MZ_DEFAULT_COMPRESSION)) {
            mz_zip_writer_end(&zip);
            return false;
        }
    }
    size_t outSize = 0;
    void* buffer = nullptr;
    mz_zip_writer_finalize_heap_archive(&zip, &buffer, &outSize);
    mz_zip_writer_end(&zip);
    if (!buffer) return false;
    out.assign(static_cast<uint8_t*>(buffer), static_cast<uint8_t*>(buffer) + outSize);
    mz_free(buffer);
    return true;
}

inline std::string partText(const std::map<std::string, std::vector<uint8_t>>& parts, const std::string& name) {
    auto it = parts.find(name);
    if (it == parts.end()) return std::string();
    return std::string(reinterpret_cast<const char*>(it->second.data()), it->second.size());
}

// UTF-8 ↔ UTF-16（宽字符）转换。
inline std::wstring utf8ToWide(const std::string& text) {
    std::wstring wide;
    size_t i = 0;
    while (i < text.size()) {
        uint8_t c = uint8_t(text[i]);
        uint32_t cp = 0xFFFD; size_t len = 1;
        if (c < 0x80) { cp = c; len = 1; }
        else if ((c & 0xE0) == 0xC0 && i + 1 < text.size()) { cp = c & 0x1F; len = 2; }
        else if ((c & 0xF0) == 0xE0 && i + 2 < text.size()) { cp = c & 0x0F; len = 3; }
        else if ((c & 0xF8) == 0xF0 && i + 3 < text.size()) { cp = c & 0x07; len = 4; }
        bool ok = true; // 单字节 ASCII 恒合法，多字节由后续续字节校验
        for (size_t k = 1; k < len && ok; k++) {
            uint8_t cc = uint8_t(text[i + k]);
            if ((cc & 0xC0) != 0x80) ok = false; else cp = (cp << 6) | (cc & 0x3F);
        }
        if (!ok || (len == 2 && cp < 0x80) || (len == 3 && cp < 0x800) || (len == 4 && cp < 0x10000)) { cp = 0xFFFD; len = 1; }
        if (cp > 0xFFFF) { cp -= 0x10000; wide.push_back(wchar_t(0xD800 + (cp >> 10))); wide.push_back(wchar_t(0xDC00 + (cp & 0x3FF))); }
        else wide.push_back(wchar_t(cp));
        i += len;
    }
    return wide;
}

inline std::string wideToUtf8(const std::wstring& text) {
    std::string out;
    for (wchar_t wc : text) {
        uint32_t cp = static_cast<uint32_t>(wc);
        if (cp >= 0xD800 && cp <= 0xDBFF) continue; // 代理项由低位项处理时跳过高位
        if (cp >= 0xDC00 && cp <= 0xDFFF) continue;
        if (cp < 0x80) out.push_back(char(cp));
        else if (cp < 0x800) { out.push_back(char(0xC0 | (cp >> 6))); out.push_back(char(0x80 | (cp & 0x3F))); }
        else if (cp < 0x10000) { out.push_back(char(0xE0 | (cp >> 12))); out.push_back(char(0x80 | ((cp >> 6) & 0x3F))); out.push_back(char(0x80 | (cp & 0x3F))); }
        else { out.push_back(char(0xF0 | (cp >> 18))); out.push_back(char(0x80 | ((cp >> 12) & 0x3F))); out.push_back(char(0x80 | ((cp >> 6) & 0x3F))); out.push_back(char(0x80 | (cp & 0x3F))); }
    }
    return out;
}

// ---------- docx 读取/解析视图 ----------
struct ParaView { std::wstring text; std::wstring style; XmlNode* node; };
struct TableView { std::vector<std::vector<std::wstring>> cells; XmlNode* node; };

inline std::wstring paragraphText(XmlNode* para) {
    std::wstring out;
    for (XmlNode* r : para->findChildren("w", "r")) {
        for (XmlNode* t : r->findChildren("w", "t")) out += utf8ToWide(t->text);
        for (XmlNode* br : r->findChildren("w", "br")) { (void)br; out += L"\n"; }
    }
    for (XmlNode* hyperlink : para->findChildren("w", "hyperlink")) {
        for (XmlNode* r : hyperlink->findChildren("w", "r"))
            for (XmlNode* t : r->findChildren("w", "t")) out += utf8ToWide(t->text);
    }
    return out;
}

inline std::wstring paragraphStyle(XmlNode* para) {
    if (XmlNode* pPr = para->firstChild("w", "pPr")) {
        if (XmlNode* pStyle = pPr->firstChild("w", "pStyle")) {
            if (const std::string* id = pStyle->attr("w:val")) {
                std::string sid = *id;
                if (sid.rfind("Heading", 0) == 0 || sid.rfind("\xe6\xa0\x87\xe9\xa2\x98", 0) == 0) {
                    // Heading1..6 → 标题1..6
                    if (sid.size() >= 8 && sid[0] == 'H') {
                        int level = atoi(sid.c_str() + 7);
                        if (level >= 1 && level <= 6) return L"标题" + std::to_wstring(level);
                    }
                }
                if (sid == "Title") return L"标题1";
                std::wstring w = utf8ToWide(sid);
                if (w.rfind(L"标题", 0) == 0) return w;
                return L"正文";
            }
        }
    }
    return L"正文";
}

// body 的直接子元素分类视图。
inline void collectViews(Doc& doc, std::vector<ParaView>& paras, std::vector<TableView>& tables) {
    paras.clear(); tables.clear();
    if (!doc.documentXml) return;
    XmlNode* body = doc.documentXml->firstChild("w", "body");
    if (!body) return;
    for (const auto& child : body->children) {
        if (child->is("w", "p")) {
            ParaView view;
            view.text = paragraphText(child.get());
            view.style = paragraphStyle(child.get());
            view.node = child.get();
            paras.push_back(view);
        } else if (child->is("w", "tbl")) {
            TableView view;
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
                view.cells.push_back(row);
            }
            view.node = child.get();
            tables.push_back(view);
        }
    }
}

// PDF 导出子集判定：扫描未支持元素。
inline void auditPdfExportability(Doc& doc) {
    doc.pdfExportBlock.clear();
    if (!doc.documentXml) { doc.pdfExportBlock = "文档结构缺失"; return; }
    std::function<void(const XmlNode&)> walk = [&](const XmlNode& node) {
        if (!doc.pdfExportBlock.empty()) return;
        if (node.is("w", "txbxContent")) { doc.pdfExportBlock = "文本框"; return; }
        if (node.is("m", "oMath") || node.is("m", "oMathPara")) { doc.pdfExportBlock = "数学公式"; return; }
        if (node.is("w", "drawing")) {
            // 允许内联图片 w:drawing/w:inline；其余（浮动形状等）不支持
            if (!node.firstChild("wp", "inline")) { doc.pdfExportBlock = "浮动图形/形状"; return; }
        }
        for (const auto& child : node.children) { walk(*child); if (!doc.pdfExportBlock.empty()) return; }
    };
    walk(*doc.documentXml);
}

// ---------- docx 打开 ----------
inline bool openDocx(const uint8_t* data, size_t size, Doc& doc, std::string& error) {
    doc.opened = true;
    doc.appends.clear();
    if (!unzipToParts(data, size, doc.parts, error)) return false;
    std::string documentXmlText = partText(doc.parts, "word/document.xml");
    if (documentXmlText.empty()) { error = "不是有效的 .docx 文件（缺少 word/document.xml）"; return false; }
    doc.documentXml = std::make_unique<XmlNode>();
    if (!parseXml(documentXmlText, *doc.documentXml, error)) { error = "document.xml 解析失败：" + error; return false; }
    std::string relsText = partText(doc.parts, "word/_rels/document.xml.rels");
    if (!relsText.empty()) {
        doc.relsXml = std::make_unique<XmlNode>();
        std::string xmlError;
        parseXml(relsText, *doc.relsXml, xmlError); // 失败时按无关系处理
    }
    auditPdfExportability(doc);
    return true;
}

// ---------- 新建文档骨架 ----------
inline const char* DOCX_CONTENT_TYPES =
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
    "<Default Extension=\"png\" ContentType=\"image/png\"/>"
    "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/>"
    "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
    "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
    "</Types>";

inline const char* DOCX_ROOT_RELS =
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
    "</Relationships>";

inline const char* DOCX_STYLES =
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
    "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
    "<w:style w:type=\"paragraph\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\"><w:name w:val=\"heading 1\"/><w:pPr><w:outlineLvl w:val=\"0\"/></w:pPr><w:rPr><w:sz w:val=\"36\"/><w:b/></w:rPr></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\"><w:name w:val=\"heading 2\"/><w:pPr><w:outlineLvl w:val=\"1\"/></w:pPr><w:rPr><w:sz w:val=\"30\"/><w:b/></w:rPr></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading3\"><w:name w:val=\"heading 3\"/><w:pPr><w:outlineLvl w:val=\"2\"/></w:pPr><w:rPr><w:sz w:val=\"26\"/><w:b/></w:rPr></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading4\"><w:name w:val=\"heading 4\"/><w:pPr><w:outlineLvl w:val=\"3\"/></w:pPr><w:rPr><w:sz w:val=\"23\"/><w:b/></w:rPr></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading5\"><w:name w:val=\"heading 5\"/><w:pPr><w:outlineLvl w:val=\"4\"/></w:pPr><w:rPr><w:sz w:val=\"21\"/><w:b/></w:rPr></w:style>"
    "<w:style w:type=\"paragraph\" w:styleId=\"Heading6\"><w:name w:val=\"heading 6\"/><w:pPr><w:outlineLvl w:val=\"5\"/></w:pPr><w:rPr><w:sz w:val=\"20\"/><w:b/></w:rPr></w:style>"
    "</w:styles>";

inline void initCreatedDoc(Doc& doc) {
    doc.opened = false;
    doc.appends.clear();
    doc.documentXml.reset();
    doc.relsXml.reset();
    doc.parts.clear();
    std::string documentXml =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\">"
        "<w:body><w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr></w:body></w:document>";
    std::string rels =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>"
        "</Relationships>";
    auto put = [&](const std::string& name, const std::string& text) {
        doc.parts[name] = std::vector<uint8_t>(text.begin(), text.end());
    };
    put("[Content_Types].xml", DOCX_CONTENT_TYPES);
    put("_rels/.rels", DOCX_ROOT_RELS);
    put("word/document.xml", documentXml);
    put("word/_rels/document.xml.rels", rels);
    put("word/styles.xml", DOCX_STYLES);
    doc.documentXml = std::make_unique<XmlNode>();
    std::string parseError;
    if (!parseXml(documentXml, *doc.documentXml, parseError)) {
        // 骨架常量出错属于编程错误，直接断言失败路径
        doc.documentXml.reset();
    }
    doc.relsXml = std::make_unique<XmlNode>();
    if (!parseXml(rels, *doc.relsXml, parseError)) doc.relsXml.reset();
    doc.nextRid = 100;
    doc.nextMediaId = 1;
    doc.pdfExportBlock.clear();
}

// ---------- 追加块 → OOXML 片段 ----------
inline void appendRunText(std::string& xml, const std::wstring& text, bool preserveSpace = true) {
    // 按 \n 切分生成多个 run（<w:br/>）
    size_t start = 0;
    bool first = true;
    while (start < text.size() || first) {
        size_t nl = text.find(L'\n', start);
        std::wstring piece = nl == std::string::npos ? text.substr(start) : text.substr(start, nl - start);
        if (!first) xml += "<w:r><w:br/></w:r>";
        std::string escaped;
        xmlEscape(wideToUtf8(piece), escaped);
        xml += "<w:r><w:t";
        if (preserveSpace) xml += " xml:space=\"preserve\"";
        xml += ">";
        xml += escaped;
        xml += "</w:t></w:r>";
        if (nl == std::string::npos) break;
        start = nl + 1;
        first = false;
        if (start >= text.size()) { xml += "<w:r><w:br/></w:r>"; break; }
        first = false;
    }
}

inline std::string styleIdFor(const std::wstring& style) {
    if (style.empty() || style == L"正文") return "Normal";
    if (style.rfind(L"标题", 0) == 0 && style.size() >= 3) {
        int level = _wtoi(style.substr(2).c_str());
        if (level >= 1 && level <= 6) {
            std::string id = "Heading";
            id += char('0' + level);
            return id;
        }
    }
    return "Normal";
}

inline std::string blockToXml(Doc& doc, const Block& block, std::vector<std::pair<std::string, std::vector<uint8_t>>>& extraParts,
                              std::vector<std::string>& extraRels) {
    std::string xml;
    if (block.kind == Block::Kind::Paragraph) {
        xml += "<w:p><w:pPr><w:pStyle w:val=\"";
        xml += styleIdFor(block.style);
        xml += "\"/></w:pPr>";
        appendRunText(xml, block.text);
        xml += "</w:p>";
    } else if (block.kind == Block::Kind::Table) {
        xml += "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders>"
               "<w:top w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "<w:left w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "<w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "<w:right w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "<w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "<w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>"
               "</w:tblBorders></w:tblPr>";
        for (const auto& row : block.table) {
            xml += "<w:tr>";
            for (const auto& cell : row) {
                xml += "<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr><w:p>";
                appendRunText(xml, cell);
                xml += "</w:p></w:tc>";
            }
            xml += "</w:tr>";
        }
        xml += "</w:tbl>";
    } else if (block.kind == Block::Kind::Image) {
        char rid[32], mediaName[64];
        snprintf(rid, sizeof rid, "rId%d", doc.nextRid++);
        const char* ext = block.imageIsJpeg ? "jpeg" : "png";
        snprintf(mediaName, sizeof mediaName, "word/media/image%d.%s", doc.nextMediaId++, ext);
        extraParts.emplace_back(mediaName, block.imageData);
        std::string relType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
        std::string rel = "<Relationship Id=\"" + std::string(rid) + "\" Type=\"" + relType + "\" Target=\"media/image" + std::to_string(doc.nextMediaId - 1) + "." + ext + "\"/>";
        extraRels.push_back(rel);
        // EMU：96dpi 像素 → EMU = px * 9525
        int w = block.imageW > 0 ? block.imageW : 400;
        int h = block.imageH > 0 ? block.imageH : 300;
        char drawing[512];
        snprintf(drawing, sizeof drawing,
                 "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">"
                 "<wp:extent cx=\"%d\" cy=\"%d\"/><wp:docPr id=\"%d\" name=\"Picture %d\"/>"
                 "<a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">"
                 "<a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">"
                 "<pic:pic xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">"
                 "<pic:nvPicPr><pic:cNvPr id=\"%d\" name=\"Picture %d\"/><pic:cNvPicPr/></pic:nvPicPr>"
                 "<pic:blipFill><a:blip r:embed=\"%s\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
                 "<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"%d\" cy=\"%d\"/></a:xfrm>"
                 "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>"
                 "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>",
                 w * 9525, h * 9525, doc.nextMediaId, doc.nextMediaId, doc.nextMediaId, doc.nextMediaId, rid, w * 9525, h * 9525);
        xml += drawing;
    }
    return xml;
}

// ---------- 保存 ----------

// 把追加块合并进 document.xml 的 body（sectPr 之前）；合并后清空 appends 防重复。
inline bool mergeAppendsIntoDocument(Doc& doc, std::string& error) {
    if (!doc.documentXml) { error = "文档模型未初始化"; return false; }
    XmlNode* body = doc.documentXml->firstChild("w", "body");
    if (!body) { error = "document.xml 缺少 body"; return false; }
    if (doc.appends.empty()) return true;
    std::vector<std::pair<std::string, std::vector<uint8_t>>> extraParts;
    std::vector<std::string> extraRels;
    std::string appendXml;
    for (const auto& block : doc.appends) appendXml += blockToXml(doc, block, extraParts, extraRels);
    std::string wrapped = "<w:root xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
                          "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
                          "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
                          "xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" "
                          "xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">" + appendXml + "</w:root>";
    XmlNode fragRoot;
    std::string parseError;
    if (!parseXml(wrapped, fragRoot, parseError)) { error = "追加内容生成失败：" + parseError; return false; }
    std::unique_ptr<XmlNode> sectPr;
    for (auto it = body->children.begin(); it != body->children.end(); ) {
        if (it->get()->is("w", "sectPr")) { sectPr = std::move(*it); it = body->children.erase(it); break; }
        ++it;
    }
    for (auto& child : fragRoot.children) {
        child->parent = body;
        body->children.push_back(std::move(child));
    }
    if (sectPr) { sectPr->parent = body; body->children.push_back(std::move(sectPr)); }
    // 媒体/关系登记（与 buildDocxBytes 同口径）
    if (!extraRels.empty()) {
        if (!doc.relsXml) {
            doc.relsXml = std::make_unique<XmlNode>();
            doc.relsXml->tag = "Relationships";
            doc.relsXml->attrs.emplace_back("xmlns", "http://schemas.openxmlformats.org/package/2006/relationships");
        }
        for (const auto& rel : extraRels) {
            std::string relWrapped = "<R>" + rel + "</R>";
            XmlNode frag;
            std::string relError;
            if (parseXml(relWrapped, frag, relError) && !frag.children.empty()) {
                frag.children.front()->parent = doc.relsXml.get();
                doc.relsXml->children.push_back(std::move(frag.children.front()));
            }
        }
    }
    for (const auto& kv : extraParts) doc.parts[kv.first] = kv.second;
    if (!extraParts.empty()) {
        std::string ct = partText(doc.parts, "[Content_Types].xml");
        bool hasPng = ct.find("Extension=\"png\"") != std::string::npos;
        bool hasJpeg = ct.find("Extension=\"jpeg\"") != std::string::npos;
        std::string inject;
        if (!hasPng) inject += "<Default Extension=\"png\" ContentType=\"image/png\"/>";
        if (!hasJpeg) inject += "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/>";
        if (!inject.empty()) {
            size_t pos = ct.find("<Override");
            if (pos == std::string::npos) pos = ct.find("</Types>");
            ct.insert(pos == std::string::npos ? ct.size() : pos, inject);
            doc.parts["[Content_Types].xml"] = std::vector<uint8_t>(ct.begin(), ct.end());
        }
    }
    doc.appends.clear();
    return true;
}

// 生成最终包字节集（路径无关核心；写盘由桥层完成）。
inline bool buildDocxBytes(Doc& doc, std::vector<uint8_t>& out, std::string& error) {
    // 1) 追加块合并进 document.xml（含媒体/关系/内容类型登记），合并后 appends 清空防重复
    if (!mergeAppendsIntoDocument(doc, error)) return false;
    // 2) 序列化 document.xml / rels
    std::string documentOut;
    documentOut += "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
    serializeXml(*doc.documentXml, documentOut);
    doc.parts["word/document.xml"] = std::vector<uint8_t>(documentOut.begin(), documentOut.end());
    if (doc.relsXml) {
        std::string relsOut = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
        serializeXml(*doc.relsXml, relsOut);
        doc.parts["word/_rels/document.xml.rels"] = std::vector<uint8_t>(relsOut.begin(), relsOut.end());
    }
    if (!zipFromParts(doc.parts, out)) { error = "docx 打包失败"; return false; }
    return true;
}

// ---------- 占位符替换（段落级合并 run，免疫跨 run 分裂） ----------
// 占位符语法：{{名称}}；名称两侧空白被容忍（{{ 名称 }}）。
inline int replacePlaceholderInParagraph(XmlNode* para, const std::wstring& name, const std::wstring& value) {
    struct RunSpan { XmlNode* run; XmlNode* t; size_t begin; size_t end; };
    std::vector<RunSpan> spans;
    std::wstring merged;
    for (XmlNode* r : para->findChildren("w", "r")) {
        for (XmlNode* t : r->findChildren("w", "t")) {
            std::wstring piece = utf8ToWide(t->text);
            spans.push_back(RunSpan{r, t, merged.size(), merged.size() + piece.size()});
            merged += piece;
        }
    }
    // 同时处理超链接内 run
    for (XmlNode* hyperlink : para->findChildren("w", "hyperlink")) {
        for (XmlNode* r : hyperlink->findChildren("w", "r")) {
            for (XmlNode* t : r->findChildren("w", "t")) {
                std::wstring piece = utf8ToWide(t->text);
                spans.push_back(RunSpan{r, t, merged.size(), merged.size() + piece.size()});
                merged += piece;
            }
        }
    }
    if (spans.empty()) return 0;
    std::wstring token = L"{{" + name + L"}}";
    std::wstring tokenSp = L"{{ " + name + L" }}";
    int replaced = 0;
    size_t searchFrom = 0;
    while (true) {
        size_t pos = merged.find(token, searchFrom);
        size_t len = token.size();
        if (pos == std::string::npos) {
            pos = merged.find(tokenSp, searchFrom);
            len = tokenSp.size();
            if (pos == std::string::npos) break;
        }
        merged.replace(pos, len, value);
        // 按 span 边界重新分配整段文本：span 完全在替换区外映射平移，区内折叠。
        long long delta = (long long)value.size() - (long long)len;
        std::vector<std::pair<size_t, size_t>> newSpans;
        for (const auto& span : spans) {
            auto mapPoint = [&](size_t pt) -> size_t {
                if (pt <= pos) return pt;
                if (pt >= pos + len) return size_t((long long)pt + delta);
                return pos;
            };
            newSpans.emplace_back(mapPoint(span.begin), mapPoint(span.end));
        }
        size_t cursor = 0;
        for (size_t i = 0; i < spans.size(); i++) {
            size_t b = newSpans[i].first;
            size_t e = newSpans[i].second;
            if (e < cursor) e = cursor < b ? b : cursor;
            if (e < b) e = b;
            size_t take = e - b > merged.size() - b ? merged.size() - b : e - b;
            spans[i].t->text = wideToUtf8(merged.substr(b, take));
            if (spans[i].t->attr("xml:space") == nullptr) spans[i].t->attrs.emplace_back("xml:space", "preserve");
            cursor = e;
        }
        searchFrom = pos + value.size();
        replaced++;
        // span 边界已过期：重新收集合并文本
        spans.clear();
        merged.clear();
        for (XmlNode* r : para->findChildren("w", "r"))
            for (XmlNode* t : r->findChildren("w", "t")) {
                std::wstring piece = utf8ToWide(t->text);
                spans.push_back(RunSpan{r, t, merged.size(), merged.size() + piece.size()});
                merged += piece;
            }
        for (XmlNode* hyperlink : para->findChildren("w", "hyperlink"))
            for (XmlNode* r : hyperlink->findChildren("w", "r"))
                for (XmlNode* t : r->findChildren("w", "t")) {
                    std::wstring piece = utf8ToWide(t->text);
                    spans.push_back(RunSpan{r, t, merged.size(), merged.size() + piece.size()});
                    merged += piece;
                }
        if (spans.empty()) break;
    }
    return replaced;
}

// 全文档（含表格单元格、页眉页脚不做）占位符替换；返回替换次数。
inline int replacePlaceholder(Doc& doc, const std::wstring& name, const std::wstring& value) {
    if (!doc.documentXml) return 0;
    int count = 0;
    std::vector<XmlNode*> paragraphs;
    std::function<void(XmlNode&)> collect = [&](XmlNode& node) {
        if (node.is("w", "p")) paragraphs.push_back(&node);
        for (auto& child : node.children) collect(*child);
    };
    collect(*doc.documentXml);
    for (XmlNode* para : paragraphs) count += replacePlaceholderInParagraph(para, name, value);
    return count;
}

// ---------- 最小 xlsx 读写（word↔excel 表格互转） ----------
namespace lbxlsx {

struct Sheet {
    std::string name;
    std::vector<std::vector<std::wstring>> rows; // rows[row][col]，0 起含表头行
};

inline bool readXlsx(const uint8_t* data, size_t size, Sheet& sheet, std::string& error) {
    std::map<std::string, std::vector<uint8_t>> parts;
    if (!unzipToParts(data, size, parts, error)) return false;
    std::string workbookXml = partText(parts, "xl/workbook.xml");
    if (workbookXml.empty()) { error = "不是有效的 .xlsx 文件（缺少 xl/workbook.xml）"; return false; }
    XmlNode workbook;
    if (!parseXml(workbookXml, workbook, error)) return false;
    XmlNode* sheetNode = nullptr;
    std::string ridOfSheet;
    if (XmlNode* sheets = workbook.firstChild("x", "sheets")) {
        // 命名空间前缀不定（常见 x: 或无前缀），按本地名找
        auto localName = [](const std::string& tag) -> std::string {
            size_t colon = tag.find(':');
            return colon == std::string::npos ? tag : tag.substr(colon + 1);
        };
        for (const auto& child : sheets->children) {
            if (localName(child->tag) == "sheet") {
                sheetNode = child.get();
                if (const std::string* name = child->attr("name")) sheet.name = *name;
                if (const std::string* rid = child->attr("r:id")) ridOfSheet = *rid;
                break;
            }
        }
    }
    if (!sheetNode) { error = "xlsx 内没有工作表"; return false; }
    // rid → target（xl/_rels/workbook.xml.rels）
    std::string target = "worksheets/sheet1.xml";
    std::string relsXml = partText(parts, "xl/_rels/workbook.xml.rels");
    if (!relsXml.empty() && !ridOfSheet.empty()) {
        XmlNode rels;
        std::string parseError;
        if (parseXml(relsXml, rels, parseError)) {
            for (const auto& child : rels.children) {
                if (const std::string* id = child->attr("Id"); id && *id == ridOfSheet) {
                    if (const std::string* t = child->attr("Target")) target = *t;
                    break;
                }
            }
        }
    }
    std::replace(target.begin(), target.end(), '\\', '/');
    if (target.rfind("/", 0) == 0) target = target.substr(1);
    std::string sheetXml = partText(parts, "xl/" + target);
    if (sheetXml.empty()) sheetXml = partText(parts, target);
    if (sheetXml.empty()) { error = "xlsx 工作表内容缺失"; return false; }
    // 共享字符串
    std::vector<std::wstring> sharedStrings;
    std::string sstXml = partText(parts, "xl/sharedStrings.xml");
    if (!sstXml.empty()) {
        XmlNode sst;
        std::string parseError;
        if (parseXml(sstXml, sst, parseError)) {
            auto localName = [](const std::string& tag) -> std::string {
                size_t colon = tag.find(':');
                return colon == std::string::npos ? tag : tag.substr(colon + 1);
            };
            for (const auto& child : sst.children) {
                if (localName(child->tag) == "si") {
                    std::wstring text;
                    std::function<void(const XmlNode&)> gather = [&](const XmlNode& node) {
                        if (localName(node.tag) == "t") text += utf8ToWide(node.text);
                        for (const auto& c : node.children) gather(*c);
                    };
                    gather(*child);
                    sharedStrings.push_back(text);
                }
            }
        }
    }
    XmlNode sheetRoot;
    if (!parseXml(sheetXml, sheetRoot, error)) return false;
    auto localName = [](const std::string& tag) -> std::string {
        size_t colon = tag.find(':');
        return colon == std::string::npos ? tag : tag.substr(colon + 1);
    };
    std::function<void(const XmlNode&)> walk = [&](const XmlNode& node) {
        if (localName(node.tag) == "row") {
            std::vector<std::wstring> row;
            int maxCol = 0;
            std::map<int, std::wstring> cells;
            for (const auto& child : node.children) {
                if (localName(child->tag) != "c") continue;
                const std::string* ref = child->attr("r"); // "B3"
                int col = 0;
                if (ref) {
                    for (char c : *ref) { if (c >= 'A' && c <= 'Z') col = col * 26 + (c - 'A' + 1); else break; }
                } else col = int(cells.size()) + 1;
                std::wstring value;
                std::string type = child->attr("t") ? *child->attr("t") : "n";
                for (const auto& cc : child->children) {
                    if (localName(cc->tag) == "v") {
                        std::string v = cc->text;
                        if (type == "s") { size_t idx = (size_t)strtoull(v.c_str(), nullptr, 10); value = idx < sharedStrings.size() ? sharedStrings[idx] : L""; }
                        else value = utf8ToWide(v);
                    } else if (localName(cc->tag) == "is") {
                        std::function<void(const XmlNode&)> gather = [&](const XmlNode& n) {
                            if (localName(n.tag) == "t") value += utf8ToWide(n.text);
                            for (const auto& c : n.children) gather(*c);
                        };
                        gather(*cc);
                    }
                }
                cells[col] = value;
                if (col > maxCol) maxCol = col;
            }
            for (int c = 1; c <= maxCol; c++) {
                auto it = cells.find(c);
                row.push_back(it != cells.end() ? it->second : std::wstring());
            }
            sheet.rows.push_back(row);
        }
        for (const auto& child : node.children) walk(*child);
    };
    walk(sheetRoot);
    return true;
}

inline std::string colLetter(int col) { // 1 起
    std::string out;
    while (col > 0) { int m = (col - 1) % 26; out.insert(out.begin(), char('A' + m)); col = (col - 1) / 26; }
    return out;
}

inline bool writeXlsx(const std::string& sheetName, const std::vector<std::vector<std::wstring>>& rows,
                      std::vector<uint8_t>& out, std::string& error) {
    auto esc = [](const std::wstring& text) {
        std::string escaped;
        xmlEscape(wideToUtf8(text), escaped);
        return escaped;
    };
    std::string sheetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>";
    for (size_t r = 0; r < rows.size(); r++) {
        char rowHead[32];
        snprintf(rowHead, sizeof rowHead, "<row r=\"%zu\">", r + 1);
        sheetXml += rowHead;
        for (size_t c = 0; c < rows[r].size(); c++) {
            char cellHead[96];
            snprintf(cellHead, sizeof cellHead, "<c r=\"%s%zu\" t=\"inlineStr\"><is><t xml:space=\"preserve\">",
                     colLetter(int(c) + 1).c_str(), r + 1);
            sheetXml += cellHead;
            sheetXml += esc(rows[r][c]);
            sheetXml += "</t></is></c>";
        }
        sheetXml += "</row>";
    }
    sheetXml += "</sheetData></worksheet>";
    std::string workbookXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"
        "<sheets><sheet name=\"" + esc(sheetName.empty() ? L"Sheet1" : utf8ToWide(sheetName)) + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>";
    std::string relsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>"
        "</Relationships>";
    std::string rootRels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>"
        "</Relationships>";
    std::string contentTypes = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
        "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>"
        "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"
        "</Types>";
    std::map<std::string, std::vector<uint8_t>> parts;
    auto put = [&](const std::string& name, const std::string& text) {
        parts[name] = std::vector<uint8_t>(text.begin(), text.end());
    };
    put("[Content_Types].xml", contentTypes);
    put("_rels/.rels", rootRels);
    put("xl/workbook.xml", workbookXml);
    put("xl/_rels/workbook.xml.rels", relsXml);
    put("xl/worksheets/sheet1.xml", sheetXml);
    if (!zipFromParts(parts, out)) { error = "xlsx 打包失败"; return false; }
    return true;
}

} // namespace lbxlsx

} // namespace lbdocx

#endif // LB_DOCX_H
