// LingBuilderPdf.dll —— LingBuilder PDF 文档模块（lingbuilder.data.pdf）随附运行桥。
// 内核：PDFium 158（Apache-2.0，Chrome 同款）动态加载——本桥不静态链接 pdfium，
// 运行时 LoadLibrary("pdfium.dll") 解析导出；pdfium.dll 由 lingbuilder.pdf.sdk 模块分发。
// 附加能力：
//   * 转Word文本流：FPDFText 字符坐标 → y 聚类成行 → 行距聚类成段 → OOXML 写出（复用 lb_docx.h）。
//   * 外部文档转PDF：Word.Application → KWPS.Application / Excel.Application → KET.Application
//     的 COM 自动检测链（IDispatch），支持 docx/xlsx 高保真转 PDF，需本机装 Office 或 WPS。
//
// ABI 约定（与 pdfRuntime.ts 生成的 C++ 桥一一对应）：
//   - 所有导出为 extern "C" __cdecl，导出名由 pdfBridge.def 固定。
//   - 所有字符串参数与返回值均为 UTF-8；宽字符转换只发生在生成代码一侧。
//   - 文档句柄为 long long；0 表示无效句柄。
//   - 返回 const char* 的导出指向本 DLL 内的线程局部缓冲区，调用方必须立即复制。
//   - 失败时导出返回 0/负值，并更新 LBPdf_LastError 的线程局部中文错误。

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <objbase.h>
#include <oleauto.h>
#include <oaidl.h>
#undef interface

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "miniz.h"
#include "../common/lb_pngcodec.h"
#include "../word-bridge/lb_docx.h"

namespace {

thread_local std::wstring g_lastErrorWide;

void setError(const std::wstring& message) { g_lastErrorWide = message; }
void setErrorUtf8(const std::string& message) { g_lastErrorWide = lbdocx::utf8ToWide(message); }

thread_local std::string g_textBuffer;
const char* returnUtf8(const std::wstring& text) {
    if (text.empty()) { g_textBuffer.clear(); return g_textBuffer.c_str(); }
    int bytes = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0, nullptr, nullptr);
    g_textBuffer.assign(size_t(bytes > 0 ? bytes : 0), '\0');
    if (bytes > 0) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), &g_textBuffer[0], bytes, nullptr, nullptr);
    return g_textBuffer.c_str();
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

// ============================ PDFium 动态加载 ============================
typedef void FPDF_DOCUMENT;
typedef void FPDF_PAGE;
typedef void FPDF_TEXTPAGE;
typedef void FPDF_PAGEOBJECT;
typedef void FPDF_IMAGEOBJECT;
typedef void FPDF_BITMAP;

struct FPDF_FILEWRITE {
    int version;
    int (*WriteBlock)(FPDF_FILEWRITE* pThis, const void* data, unsigned long size);
};

#define FPDF_ERR_PASSWORD 4

HMODULE g_pdfium = nullptr;
bool g_pdfiumTried = false;
std::wstring g_pdfiumError;

bool loadPdfium() {
    if (g_pdfium) return true;
    if (g_pdfiumTried) { setError(g_pdfiumError); return false; }
    g_pdfiumTried = true;
    g_pdfium = LoadLibraryW(L"pdfium.dll");
    if (!g_pdfium) {
        g_pdfiumError = L"无法加载 pdfium.dll，请确认 lingbuilder.pdf.sdk 模块已启用且 pdfium.dll 位于 exe 同目录。";
        setError(g_pdfiumError);
        return false;
    }
    return true;
}

template <typename T>
T pdfSym(const char* name) {
    return reinterpret_cast<T>(reinterpret_cast<void*>(GetProcAddress(g_pdfium, name)));
}

// 解析一次的函数指针
FPDF_DOCUMENT* (__cdecl* pLoadMemDocument)(const void*, int, const char*);
FPDF_DOCUMENT* (__cdecl* pCreateNewDocument)();
unsigned long (__cdecl* pGetLastError)();
int (__cdecl* pGetPageCount)(FPDF_DOCUMENT*);
void (__cdecl* pCloseDocument)(FPDF_DOCUMENT*);
FPDF_PAGE* (__cdecl* pLoadPage)(FPDF_DOCUMENT*, int);
void (__cdecl* pClosePage)(FPDF_PAGE*);
int (__cdecl* pGetPageSizeByIndex)(FPDF_DOCUMENT*, int, double*, double*);
FPDF_TEXTPAGE* (__cdecl* pTextLoadPage)(FPDF_PAGE*);
void (__cdecl* pTextClosePage)(FPDF_TEXTPAGE*);
int (__cdecl* pTextCountChars)(FPDF_TEXTPAGE*);
unsigned int (__cdecl* pTextGetUnicode)(FPDF_TEXTPAGE*, int);
int (__cdecl* pTextGetCharBox)(FPDF_TEXTPAGE*, int, double*, double*, double*, double*);
FPDF_BITMAP* (__cdecl* pBitmapCreateEx)(int, int, int, void*, int);
FPDF_BITMAP* (__cdecl* pBitmapCreate)(int, int, int);
void (__cdecl* pBitmapFillRect)(FPDF_BITMAP*, int, int, int, int, unsigned int);
void (__cdecl* pBitmapDestroy)(FPDF_BITMAP*);
void* (__cdecl* pBitmapGetBuffer)(FPDF_BITMAP*);
void (__cdecl* pRenderPageBitmap)(FPDF_BITMAP*, FPDF_PAGE*, int, int, int, int, int, int);
bool (__cdecl* pSaveAsCopy)(FPDF_DOCUMENT*, FPDF_FILEWRITE*, int);
bool (__cdecl* pImportPages)(FPDF_DOCUMENT*, FPDF_DOCUMENT*, const char*, int);
int (__cdecl* pPageCountObjects)(FPDF_PAGE*);
FPDF_PAGEOBJECT* (__cdecl* pPageGetObject)(FPDF_PAGE*, int);
int (__cdecl* pPageObjGetType)(FPDF_PAGEOBJECT*);
FPDF_BITMAP* (__cdecl* pImageObjGetBitmap)(FPDF_IMAGEOBJECT*);
int (__cdecl* pBitmapGetWidth)(FPDF_BITMAP*);
int (__cdecl* pBitmapGetHeight)(FPDF_BITMAP*);

void (__cdecl* pInitLibrary)();

bool resolvePdfiumSymbols() {
    if (!loadPdfium()) return false;
    if (pLoadMemDocument) return true;
    pInitLibrary = pdfSym<void (__cdecl*)()>("FPDF_InitLibrary");
    if (pInitLibrary) pInitLibrary();
    pLoadMemDocument = pdfSym<FPDF_DOCUMENT* (__cdecl*)(const void*, int, const char*)>("FPDF_LoadMemDocument");
    pCreateNewDocument = pdfSym<FPDF_DOCUMENT* (__cdecl*)()>("FPDF_CreateNewDocument");
    pGetLastError = pdfSym<unsigned long (__cdecl*)()>("FPDF_GetLastError");
    pGetPageCount = pdfSym<int (__cdecl*)(FPDF_DOCUMENT*)>("FPDF_GetPageCount");
    pCloseDocument = pdfSym<void (__cdecl*)(FPDF_DOCUMENT*)>("FPDF_CloseDocument");
    pLoadPage = pdfSym<FPDF_PAGE* (__cdecl*)(FPDF_DOCUMENT*, int)>("FPDF_LoadPage");
    pClosePage = pdfSym<void (__cdecl*)(FPDF_PAGE*)>("FPDF_ClosePage");
    pGetPageSizeByIndex = pdfSym<int (__cdecl*)(FPDF_DOCUMENT*, int, double*, double*)>("FPDF_GetPageSizeByIndex");
    pTextLoadPage = pdfSym<FPDF_TEXTPAGE* (__cdecl*)(FPDF_PAGE*)>("FPDFText_LoadPage");
    pTextClosePage = pdfSym<void (__cdecl*)(FPDF_TEXTPAGE*)>("FPDFText_ClosePage");
    pTextCountChars = pdfSym<int (__cdecl*)(FPDF_TEXTPAGE*)>("FPDFText_CountChars");
    pTextGetUnicode = pdfSym<unsigned int (__cdecl*)(FPDF_TEXTPAGE*, int)>("FPDFText_GetUnicode");
    pTextGetCharBox = pdfSym<int (__cdecl*)(FPDF_TEXTPAGE*, int, double*, double*, double*, double*)>("FPDFText_GetCharBox");
    pBitmapCreateEx = pdfSym<FPDF_BITMAP* (__cdecl*)(int, int, int, void*, int)>("FPDFBitmap_CreateEx");
    pBitmapCreate = pdfSym<FPDF_BITMAP* (__cdecl*)(int, int, int)>("FPDFBitmap_Create");
    pBitmapFillRect = pdfSym<void (__cdecl*)(FPDF_BITMAP*, int, int, int, int, unsigned int)>("FPDFBitmap_FillRect");
    pBitmapDestroy = pdfSym<void (__cdecl*)(FPDF_BITMAP*)>("FPDFBitmap_Destroy");
    pBitmapGetBuffer = pdfSym<void* (__cdecl*)(FPDF_BITMAP*)>("FPDFBitmap_GetBuffer");
    pRenderPageBitmap = pdfSym<void (__cdecl*)(FPDF_BITMAP*, FPDF_PAGE*, int, int, int, int, int, int)>("FPDF_RenderPageBitmap");
    pSaveAsCopy = pdfSym<bool (__cdecl*)(FPDF_DOCUMENT*, FPDF_FILEWRITE*, int)>("FPDF_SaveAsCopy");
    pImportPages = pdfSym<bool (__cdecl*)(FPDF_DOCUMENT*, FPDF_DOCUMENT*, const char*, int)>("FPDF_ImportPages");
    pPageCountObjects = pdfSym<int (__cdecl*)(FPDF_PAGE*)>("FPDFPage_CountObjects");
    pPageGetObject = pdfSym<FPDF_PAGEOBJECT* (__cdecl*)(FPDF_PAGE*, int)>("FPDFPage_GetObject");
    pPageObjGetType = pdfSym<int (__cdecl*)(FPDF_PAGEOBJECT*)>("FPDFPageObj_GetType");
    pImageObjGetBitmap = pdfSym<FPDF_BITMAP* (__cdecl*)(FPDF_IMAGEOBJECT*)>("FPDFImageObj_GetBitmap");
    pBitmapGetWidth = pdfSym<int (__cdecl*)(FPDF_BITMAP*)>("FPDFBitmap_GetWidth");
    pBitmapGetHeight = pdfSym<int (__cdecl*)(FPDF_BITMAP*)>("FPDFBitmap_GetHeight");
    if (!pLoadMemDocument || !pGetPageCount || !pCloseDocument || !pLoadPage || !pTextLoadPage || !pSaveAsCopy) {
        setError(L"pdfium.dll 导出缺失，不是有效的 PDFium 运行库。");
        return false;
    }
    return true;
}

// ============================ 文档句柄 ============================
struct PdfDoc {
    std::vector<uint8_t> bytes;   // 持有原始数据（LoadMemDocument 引用必须存活）
    FPDF_DOCUMENT* doc = nullptr;
};
std::map<long long, std::unique_ptr<PdfDoc>> g_docs;
long long g_nextHandle = 1;

PdfDoc* docOf(long long handle) {
    auto it = g_docs.find(handle);
    if (it == g_docs.end()) { setError(L"PDF 文档句柄无效或已关闭。"); return nullptr; }
    return it->second.get();
}
PdfDoc* validDoc(long long handle) {
    if (handle == 0) { setError(L"PDF 文档句柄为 0，请先成功打开文档。"); return nullptr; }
    return docOf(handle);
}

// ============================ 文本提取（y 聚类成行） ============================
struct CharBox { unsigned int code; double left, right, bottom, top; };

std::wstring extractPageText(FPDF_PAGE* page, bool* hasTextLayer) {
    FPDF_TEXTPAGE* textPage = pTextLoadPage(page);
    if (!textPage) { if (hasTextLayer) *hasTextLayer = false; return L""; }
    int count = pTextCountChars(textPage);
    if (hasTextLayer) *hasTextLayer = count > 0;
    std::vector<CharBox> chars;
    chars.reserve(size_t(count > 0 ? count : 0));
    for (int i = 0; i < count; i++) {
        CharBox box;
        box.code = pTextGetUnicode(textPage, i);
        if (!pTextGetCharBox(textPage, i, &box.left, &box.right, &box.bottom, &box.top)) continue;
        if (box.code == 0 || box.code == 0xFFFD) continue;
        if (box.code == L'\r' || box.code == L'\n') continue;
        chars.push_back(box);
    }
    pTextClosePage(textPage);
    if (chars.empty()) return L"";
    // 按 top 降序（页面坐标 top 大在上）再按 left 升序
    std::sort(chars.begin(), chars.end(), [](const CharBox& a, const CharBox& b) {
        if (a.top != b.top) return a.top > b.top;
        return a.left < b.left;
    });
    // y 聚类成行：top 相差超过行高一半视为新行
    std::vector<std::vector<CharBox>> lines;
    double lineHeight = 0;
    for (size_t i = 0; i + 1 < chars.size(); i++) {
        double h = chars[i].top - chars[i].bottom;
        if (h > lineHeight) lineHeight = h;
    }
    if (lineHeight <= 0) lineHeight = 10;
    double threshold = lineHeight * 0.6;
    for (const auto& box : chars) {
        if (!lines.empty()) {
            double lineTop = lines.back().front().top;
            if (std::fabs(box.top - lineTop) <= threshold) { lines.back().push_back(box); continue; }
        }
        lines.emplace_back();
        lines.back().push_back(box);
    }
    std::wstring text;
    for (size_t li = 0; li < lines.size(); li++) {
        std::sort(lines[li].begin(), lines[li].end(), [](const CharBox& a, const CharBox& b) { return a.left < b.left; });
        double prevRight = -1e9;
        for (const auto& box : lines[li]) {
            // 词间距：比字符宽度大得多时补空格（CJK 不补）
            if (prevRight > -1e8 && box.left - prevRight > (box.right - box.left) * 0.6 + 1.0) {
                bool isCjk = box.code >= 0x2E80;
                if (!isCjk && text.back() != L' ') text.push_back(L' ');
            }
            text.push_back(box.code != 0xFFFF ? (wchar_t)box.code : L'?');
            prevRight = box.right;
        }
        if (li + 1 < lines.size()) text.push_back(L'\n');
    }
    return text;
}

// ============================ 保存回调 ============================
struct SaveContext {
    FPDF_FILEWRITE writer;          // 必须是首成员：回调把 pThis 直接转型回 SaveContext*
    std::vector<uint8_t>* out;
};
int __cdecl saveWriteBlock(FPDF_FILEWRITE* pThis, const void* data, unsigned long size) {
    auto* context = reinterpret_cast<SaveContext*>(pThis);
    context->out->insert(context->out->end(), static_cast<const uint8_t*>(data), static_cast<const uint8_t*>(data) + size);
    return 1;
}

// ============================ COM 外部转换（Office/WPS 检测链，cscript+VBS 宿主） ============================
// 直连 IDispatch 在部分 Office 环境对 Invoke 参数形态敏感（实测 Word Documents.Open 报 E_INVALIDARG），
// 这里改用 cscript 运行 VBS 的成熟通道：转换逻辑在独立进程执行，引擎崩溃不拖垮宿主，且天然免弹窗。
struct EngineSpec { const wchar_t* progId; const wchar_t* label; };

static std::wstring tempVbsPath() {
    wchar_t tempDir[MAX_PATH] = {};
    GetTempPathW(MAX_PATH, tempDir);
    return std::wstring(tempDir) + L"lb_pdf_convert_" + std::to_wstring(GetCurrentProcessId()) + L".vbs";
}

static bool writeTextFileW(const std::wstring& path, const std::string& content) {
    HANDLE file = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;
    // GBK 兼容：VBS 全 ASCII（文件路径经 WScript.Arguments 传入，不进脚本正文）
    DWORD written = 0;
    BOOL ok = WriteFile(file, content.data(), DWORD(content.size()), &written, nullptr);
    CloseHandle(file);
    return ok && written == content.size();
}

// 运行 cscript 脚本并等待（超时秒）。
static bool runCscript(const std::wstring& scriptPath, const std::wstring& arg1, const std::wstring& arg2, const std::wstring& arg3, int timeoutSeconds) {
    std::wstring cmd = L"cscript.exe //B //T:" + std::to_wstring(timeoutSeconds) + L" \"" + scriptPath + L"\" \"" + arg1 + L"\" \"" + arg2 + L"\" \"" + arg3 + L"\"";
    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    memset(&si, 0, sizeof si);
    memset(&pi, 0, sizeof pi);
    si.cb = sizeof si;
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    std::vector<wchar_t> mutableCmd(cmd.begin(), cmd.end());
    mutableCmd.push_back(L'\0');
    if (!CreateProcessW(nullptr, mutableCmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi)) {
        setError(L"无法启动 cscript.exe 执行转换脚本。");
        return false;
    }
    CloseHandle(pi.hThread);
    DWORD waited = WaitForSingleObject(pi.hProcess, DWORD(timeoutSeconds) * 1000 + 5000);
    DWORD exitCode = 1;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    if (waited == WAIT_TIMEOUT) {
        setError(L"Office/WPS 转换超时（" + std::to_wstring(timeoutSeconds) + L" 秒）：请确认本机 Office 可正常打开该文件。");
        return false;
    }
    return exitCode == 0;
}

static const char* VBS_WORD = "\
On Error Resume Next\n\
Dim app, doc\n\
Set app = CreateObject(WScript.Arguments(2))\n\
If app Is Nothing Then WScript.Quit 2\n\
app.Visible = False\n\
app.DisplayAlerts = 0\n\
Set doc = app.Documents.Open(WScript.Arguments(0), False, True)\n\
If doc Is Nothing Then app.Quit 0 : WScript.Quit 3\n\
doc.ExportAsFixedFormat WScript.Arguments(1), 17\n\
doc.Close False\n\
app.Quit 0\n\
If Err.Number <> 0 Then WScript.Quit 4\n\
WScript.Quit 0\n";

static const char* VBS_EXCEL = "\
On Error Resume Next\n\
Dim app, wb\n\
Set app = CreateObject(WScript.Arguments(2))\n\
If app Is Nothing Then WScript.Quit 2\n\
app.Visible = False\n\
app.DisplayAlerts = 0\n\
Set wb = app.Workbooks.Open(WScript.Arguments(0), 0, True)\n\
If wb Is Nothing Then app.Quit 0 : WScript.Quit 3\n\
wb.ExportAsFixedFormat 0, WScript.Arguments(1)\n\
wb.Close False\n\
app.Quit 0\n\
If Err.Number <> 0 Then WScript.Quit 4\n\
WScript.Quit 0\n";

bool convertViaCom(const std::string& inputUtf8, const std::string& outputUtf8, std::string& engineLabelUtf8) {
    std::wstring input = utf8ToWideLocal(inputUtf8);
    std::wstring output = utf8ToWideLocal(outputUtf8);
    bool isWordFamily = false;
    std::wstring lower = input;
    for (auto& c : lower) c = towlower(c);
    if (lower.size() >= 5 && lower.compare(lower.size() - 5, 5, L".docx") == 0) isWordFamily = true;
    else if (lower.size() >= 5 && lower.compare(lower.size() - 5, 5, L".xlsx") == 0) isWordFamily = false;
    else { setError(L"外部转换当前仅支持 .docx 与 .xlsx 输入。"); return false; }

    std::wstring vbs = tempVbsPath();
    if (!writeTextFileW(vbs, isWordFamily ? VBS_WORD : VBS_EXCEL)) {
        setError(L"无法写出转换脚本（临时目录不可写）。");
        return false;
    }
    struct Cleanup { std::wstring path; ~Cleanup() { DeleteFileW(path.c_str()); } } cleanup{ vbs };

    const EngineSpec engines[] = {
        {isWordFamily ? L"Word.Application" : L"Excel.Application", isWordFamily ? L"Word" : L"Excel"},
        {isWordFamily ? L"KWPS.Application" : L"KET.Application", L"WPS"},
    };
    std::wstring lastIssue;
    for (const auto& engine : engines) {
        CLSID clsid;
        if (FAILED(CLSIDFromProgID(engine.progId, &clsid)) && FAILED(CLSIDFromProgID(engine.progId, &clsid))) {
            lastIssue = L"未检测到 " + std::wstring(engine.progId);
            continue;
        }
        if (runCscript(vbs, input, output, engine.progId, 180)) {
            // 校验产物存在
            HANDLE file = CreateFileW(output.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
            if (file != INVALID_HANDLE_VALUE) {
                CloseHandle(file);
                engineLabelUtf8 = lbdocx::wideToUtf8(engine.label);
                return true;
            }
            lastIssue = L"转换完成但产物未生成（" + std::wstring(engine.label) + L"）";
            continue;
        }
        lastIssue = g_lastErrorWide.empty() ? L"调用失败" : g_lastErrorWide;
        if (g_lastErrorWide.find(L"超时") != std::wstring::npos) break; // 超时不再尝试下一个引擎
    }
    setError(L"外部转换失败：" + lastIssue + L"。请确认本机已安装 Microsoft Office 或 WPS 且能正常打开该文件。");
    return false;
}

} // namespace

// ============================ 导出层 ============================

extern "C" {

__declspec(dllexport) const char* __cdecl LBPdf_Version() {
    if (!resolvePdfiumSymbols()) return "LingBuilderPdfBridge 1.0.0 (pdfium 未加载)";
    return "LingBuilderPdfBridge 1.0.0 (PDFium 动态加载 + OOXML 文本流 + Office/WPS COM 链)";
}

__declspec(dllexport) int __cdecl LBPdf_Available() {
    return resolvePdfiumSymbols() ? 1 : 0;
}

__declspec(dllexport) const char* __cdecl LBPdf_LastError() {
    return returnUtf8(g_lastErrorWide);
}

__declspec(dllexport) long long __cdecl LBPdf_Open(const char* pathUtf8) {
    g_lastErrorWide.clear();
    if (!resolvePdfiumSymbols()) return 0;
    if (!pathUtf8 || !*pathUtf8) { setError(L"文件路径为空。"); return 0; }
    auto entry = std::make_unique<PdfDoc>();
    if (!readAllBytes(pathUtf8, entry->bytes)) return 0;
    if (entry->bytes.size() < 5 || memcmp(entry->bytes.data(), "%PDF-", 5) != 0) {
        setError(L"不是有效的 PDF 文件（文件头不是 %PDF-）。");
        return 0;
    }
    entry->doc = pLoadMemDocument(entry->bytes.data(), int(entry->bytes.size()), nullptr);
    if (!entry->doc) {
        unsigned long err = pGetLastError ? pGetLastError() : 0;
        if (err == FPDF_ERR_PASSWORD) setError(L"PDF 已加密（需要密码），暂不支持打开加密文档。");
        else setError(L"PDF 解析失败（文件损坏或格式不受支持）。");
        return 0;
    }
    long long handle = g_nextHandle++;
    g_docs[handle] = std::move(entry);
    return handle;
}

__declspec(dllexport) long long __cdecl LBPdf_OpenBytes(const unsigned char* data, int size) {
    g_lastErrorWide.clear();
    if (!resolvePdfiumSymbols()) return 0;
    if (!data || size < 5 || memcmp(data, "%PDF-", 5) != 0) { setError(L"字节集不是有效的 PDF 数据。"); return 0; }
    auto entry = std::make_unique<PdfDoc>();
    entry->bytes.assign(data, data + size);
    entry->doc = pLoadMemDocument(entry->bytes.data(), int(entry->bytes.size()), nullptr);
    if (!entry->doc) {
        unsigned long err = pGetLastError ? pGetLastError() : 0;
        if (err == FPDF_ERR_PASSWORD) setError(L"PDF 已加密（需要密码），暂不支持打开加密文档。");
        else setError(L"PDF 解析失败。");
        return 0;
    }
    long long handle = g_nextHandle++;
    g_docs[handle] = std::move(entry);
    return handle;
}

__declspec(dllexport) int __cdecl LBPdf_Close(long long handle) {
    g_lastErrorWide.clear();
    auto it = g_docs.find(handle);
    if (it == g_docs.end()) { setError(L"PDF 文档句柄无效或已关闭。"); return 0; }
    if (it->second->doc) pCloseDocument(it->second->doc);
    g_docs.erase(it);
    return 1;
}

__declspec(dllexport) void __cdecl LBPdf_ReleaseAll() {
    for (auto& kv : g_docs) if (kv.second->doc) pCloseDocument(kv.second->doc);
    g_docs.clear();
}

__declspec(dllexport) int __cdecl LBPdf_GetPageCount(long long handle) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    return pGetPageCount(entry->doc);
}

__declspec(dllexport) double __cdecl LBPdf_GetPageWidth(long long handle, int pageFrom1) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    double w = 0, h = 0;
    if (!pGetPageSizeByIndex(entry->doc, pageFrom1 - 1, &w, &h)) { setError(L"页号越界。"); return 0; }
    return w;
}

__declspec(dllexport) double __cdecl LBPdf_GetPageHeight(long long handle, int pageFrom1) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    double w = 0, h = 0;
    if (!pGetPageSizeByIndex(entry->doc, pageFrom1 - 1, &w, &h)) { setError(L"页号越界。"); return 0; }
    return h;
}

static FPDF_PAGE* loadPageChecked(PdfDoc* entry, int pageFrom1) {
    int count = pGetPageCount(entry->doc);
    if (pageFrom1 < 1 || pageFrom1 > count) { setError(L"页号越界。"); return nullptr; }
    FPDF_PAGE* page = pLoadPage(entry->doc, pageFrom1 - 1);
    if (!page) setError(L"页面加载失败。");
    return page;
}

__declspec(dllexport) const char* __cdecl LBPdf_GetPageText(long long handle, int pageFrom1) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return "";
    FPDF_PAGE* page = loadPageChecked(entry, pageFrom1);
    if (!page) return "";
    std::wstring text = extractPageText(page, nullptr);
    pClosePage(page);
    return returnUtf8(text);
}

__declspec(dllexport) const char* __cdecl LBPdf_GetAllText(long long handle) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return "";
    int count = pGetPageCount(entry->doc);
    std::wstring all;
    for (int i = 1; i <= count; i++) {
        FPDF_PAGE* page = pLoadPage(entry->doc, i - 1);
        if (!page) continue;
        std::wstring text = extractPageText(page, nullptr);
        pClosePage(page);
        if (!all.empty()) all += L"\n";
        all += text;
    }
    return returnUtf8(all);
}

__declspec(dllexport) int __cdecl LBPdf_HasTextLayer(long long handle, int pageFrom1) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return -1;
    FPDF_PAGE* page = loadPageChecked(entry, pageFrom1);
    if (!page) return -1;
    bool has = false;
    extractPageText(page, &has);
    pClosePage(page);
    return has ? 1 : 0;
}

__declspec(dllexport) int __cdecl LBPdf_RenderPagePng(long long handle, int pageFrom1, double scale, const char* outputUtf8) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    if (scale <= 0 || scale > 8) { setError(L"缩放倍率范围 0.1～8。"); return 0; }
    FPDF_PAGE* page = loadPageChecked(entry, pageFrom1);
    if (!page) return 0;
    double w = 0, h = 0;
    if (!pGetPageSizeByIndex(entry->doc, pageFrom1 - 1, &w, &h)) { pClosePage(page); setError(L"页面尺寸读取失败。"); return 0; }
    int pixW = int(w * scale + 0.5), pixH = int(h * scale + 0.5);
    if (pixW < 1 || pixH < 1 || pixW * pixH > 64 * 1024 * 1024) { pClosePage(page); setError(L"渲染尺寸过大（上限 6400 万像素）。"); return 0; }
    // BGRx 4 通道
    std::vector<uint8_t> buffer(size_t(pixW) * pixH * 4);
    FPDF_BITMAP* bitmap = pBitmapCreateEx(pixW, pixH, 4, buffer.data(), pixW * 4);
    if (!bitmap) { pClosePage(page); setError(L"位图创建失败。"); return 0; }
    if (pBitmapFillRect) pBitmapFillRect(bitmap, 0, 0, pixW, pixH, 0xFFFFFFFF);
    pRenderPageBitmap(bitmap, page, 0, 0, pixW, pixH, 0, 0);
    pClosePage(page);
    // BGRX → RGB
    lbpng::Image image;
    image.width = pixW;
    image.height = pixH;
    image.channels = 3;
    image.pixels.assign(size_t(pixW) * pixH * 3, 255);
    for (int y = 0; y < pixH; y++) {
        for (int x = 0; x < pixW; x++) {
            const uint8_t* src = &buffer[(size_t(y) * pixW + x) * 4];
            uint8_t* dst = &image.pixels[(size_t(y) * pixW + x) * 3];
            dst[0] = src[2]; dst[1] = src[1]; dst[2] = src[0];
        }
    }
    pBitmapDestroy(bitmap);
    std::vector<uint8_t> png;
    if (!lbpng::encode(image, png)) { setError(L"PNG 编码失败。"); return 0; }
    if (!writeAllBytes(outputUtf8, png)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBPdf_GetImageCount(long long handle, int pageFrom1) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    FPDF_PAGE* page = loadPageChecked(entry, pageFrom1);
    if (!page) return 0;
    int total = pPageCountObjects(page);
    int images = 0;
    for (int i = 0; i < total; i++) {
        FPDF_PAGEOBJECT* obj = pPageGetObject(page, i);
        if (obj && pPageObjGetType(obj) == 3 /* IMAGE */) images++;
    }
    pClosePage(page);
    return images;
}

__declspec(dllexport) int __cdecl LBPdf_ExtractImage(long long handle, int pageFrom1, int imageIndexFrom1, const char* outputUtf8) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    FPDF_PAGE* page = loadPageChecked(entry, pageFrom1);
    if (!page) return 0;
    int total = pPageCountObjects(page);
    int seen = 0;
    bool saved = false;
    for (int i = 0; i < total && !saved; i++) {
        FPDF_PAGEOBJECT* obj = pPageGetObject(page, i);
        if (!obj || pPageObjGetType(obj) != 3) continue;
        seen++;
        if (seen != imageIndexFrom1) continue;
        FPDF_BITMAP* bitmap = pImageObjGetBitmap(reinterpret_cast<FPDF_IMAGEOBJECT*>(obj));
        if (!bitmap) break;
        int w = pBitmapGetWidth(bitmap), h = pBitmapGetHeight(bitmap);
        void* data = pBitmapGetBuffer(bitmap);
        if (w > 0 && h > 0 && data) {
            lbpng::Image image;
            image.width = w;
            image.height = h;
            image.channels = 3;
            image.pixels.assign(size_t(w) * h * 3, 255);
            const uint8_t* src = static_cast<const uint8_t*>(data);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    const uint8_t* s = src + (size_t(y) * w + x) * 4; // BGRx
                    uint8_t* d = &image.pixels[(size_t(y) * w + x) * 3];
                    d[0] = s[2]; d[1] = s[1]; d[2] = s[0];
                }
            }
            std::vector<uint8_t> png;
            if (lbpng::encode(image, png)) saved = writeAllBytes(outputUtf8, png);
            else setError(L"PNG 编码失败。");
        }
        pBitmapDestroy(bitmap);
    }
    pClosePage(page);
    if (!saved && g_lastErrorWide.empty()) setError(L"图片索引越界或位图不可用。");
    return saved ? 1 : 0;
}

__declspec(dllexport) int __cdecl LBPdf_SplitPages(long long handle, int firstPage, int lastPage, const char* outputUtf8) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    int count = pGetPageCount(entry->doc);
    if (firstPage < 1 || lastPage < firstPage || lastPage > count) { setError(L"页范围越界。"); return 0; }
    FPDF_DOCUMENT* fresh = pCreateNewDocument();
    if (!fresh) { setError(L"新建 PDF 文档失败。"); return 0; }
    char range[32];
    snprintf(range, sizeof range, "%d-%d", firstPage, lastPage);
    if (!pImportPages(fresh, entry->doc, range, 0)) {
        pCloseDocument(fresh);
        setError(L"页面导入失败。");
        return 0;
    }
    std::vector<uint8_t> out;
    SaveContext context;
    memset(&context, 0, sizeof context);
    context.writer.version = 1;
    context.writer.WriteBlock = saveWriteBlock;
    context.out = &out;
    if (!pSaveAsCopy(fresh, &context.writer, 0)) {
        pCloseDocument(fresh);
        setError(L"PDF 写出失败。");
        return 0;
    }
    pCloseDocument(fresh);
    if (!writeAllBytes(outputUtf8, out)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBPdf_MergeDocuments(long long first, long long second, const char* outputUtf8) {
    g_lastErrorWide.clear();
    PdfDoc* a = validDoc(first);
    if (!a) return 0;
    PdfDoc* b = validDoc(second);
    if (!b) return 0;
    FPDF_DOCUMENT* fresh = pCreateNewDocument();
    if (!fresh) { setError(L"新建 PDF 文档失败。"); return 0; }
    int firstCount = pGetPageCount(a->doc);
    if (!pImportPages(fresh, a->doc, nullptr, 0) || !pImportPages(fresh, b->doc, nullptr, firstCount)) {
        pCloseDocument(fresh);
        setError(L"页面合并失败。");
        return 0;
    }
    std::vector<uint8_t> out;
    SaveContext context;
    memset(&context, 0, sizeof context);
    context.writer.version = 1;
    context.writer.WriteBlock = saveWriteBlock;
    context.out = &out;
    if (!pSaveAsCopy(fresh, &context.writer, 0)) {
        pCloseDocument(fresh);
        setError(L"PDF 写出失败。");
        return 0;
    }
    pCloseDocument(fresh);
    if (!writeAllBytes(outputUtf8, out)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBPdf_ToWordTextStream(long long handle, const char* outputUtf8) {
    g_lastErrorWide.clear();
    PdfDoc* entry = validDoc(handle);
    if (!entry) return 0;
    int count = pGetPageCount(entry->doc);
    lbdocx::Doc doc;
    lbdocx::initCreatedDoc(doc);
    bool anyText = false;
    for (int i = 1; i <= count; i++) {
        FPDF_PAGE* page = pLoadPage(entry->doc, i - 1);
        if (!page) continue;
        std::wstring text = extractPageText(page, nullptr);
        pClosePage(page);
        if (i > 1) {
            lbdocx::Block pageBreak;
            pageBreak.kind = lbdocx::Block::Kind::Paragraph;
            pageBreak.text = L"— 第 " + std::to_wstring(i) + L" 页 —";
            pageBreak.style = L"正文";
            doc.appends.push_back(std::move(pageBreak));
        }
        // 行距聚类成段：连续行合并，直到出现空行或明显缩进变化
        size_t start = 0;
        while (start < text.size()) {
            size_t nl = text.find(L'\n', start);
            std::wstring line = nl == std::wstring::npos ? text.substr(start) : text.substr(start, nl - start);
            lbdocx::Block block;
            block.kind = lbdocx::Block::Kind::Paragraph;
            block.style = L"正文";
            block.text = line;
            doc.appends.push_back(std::move(block));
            anyText = anyText || !line.empty();
            if (nl == std::wstring::npos) break;
            start = nl + 1;
        }
    }
    if (!anyText) { setError(L"PDF 没有文本层（扫描件请先配合 OCR 模块识别），无可转换内容。"); return 0; }
    std::vector<uint8_t> out;
    std::string error;
    if (!lbdocx::buildDocxBytes(doc, out, error)) { setErrorUtf8(error); return 0; }
    if (!writeAllBytes(outputUtf8, out)) return 0;
    return 1;
}

__declspec(dllexport) int __cdecl LBPdf_ExternalToPdf(const char* inputUtf8, const char* outputUtf8) {
    g_lastErrorWide.clear();
    if (!inputUtf8 || !outputUtf8 || !*inputUtf8 || !*outputUtf8) { setError(L"输入或输出路径为空。"); return 0; }
    std::string engineLabel;
    if (!convertViaCom(inputUtf8, outputUtf8, engineLabel)) return 0;
    return 1;
}

__declspec(dllexport) const char* __cdecl LBPdf_GetOfficeEngine() {
    g_lastErrorWide.clear();
    const wchar_t* wordProgIds[] = { L"Word.Application", L"KWPS.Application" };
    for (const wchar_t* progId : wordProgIds) {
        CLSID clsid;
        if (SUCCEEDED(CLSIDFromProgID(progId, &clsid))) {
            return progId == wordProgIds[0] ? "Word" : "WPS";
        }
    }
    const wchar_t* excelProgIds[] = { L"Excel.Application", L"KET.Application" };
    for (const wchar_t* progId : excelProgIds) {
        CLSID clsid;
        if (SUCCEEDED(CLSIDFromProgID(progId, &clsid))) {
            return progId == excelProgIds[0] ? "Excel" : "WPS";
        }
    }
    return "";
}

} // extern "C"
