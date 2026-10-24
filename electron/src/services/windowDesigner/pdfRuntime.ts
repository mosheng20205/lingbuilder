/**
 * PDF 文档模块（lingbuilder.data.pdf）生成器注入运行时。
 *
 * 事实来源：electron/native/pdf-bridge/pdfBridge.cpp + pdfBridge.def（手写模板，与桥一一对应；
 * 桥升级导出签名时必须同步本文件，smoke 脚本会做生成内容断言）。
 * 运行时资产：LingBuilderPdf.dll + pdfium.dll 由 lingbuilder.pdf.sdk 模块物化到 exe 同目录。
 * 注入点：dataMediaRuntime.ts 的 RUNTIMES 表按启用模块拼接。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const PDF_MODULE_ID = 'lingbuilder.data.pdf';

export const PDF_RUNTIME = String.raw`
namespace LingBuilderPdfBridge {
using FnStr = const char* (*)();
using FnInt = int (*)();
using FnOpen = long long (*)(const char*);
using FnOpenBytes = long long (*)(const unsigned char*, int);
using FnClose = int (*)(long long);
using FnReleaseAll = void (*)();
using FnIntFromHandle = int (*)(long long);
using FnDoubleFromPage = double (*)(long long, int);
using FnStrFromPage = const char* (*)(long long, int);
using FnIntFromPage = int (*)(long long, int);
using FnStrFromHandle = const char* (*)(long long);
using FnRenderPng = int (*)(long long, int, double, const char*);
using FnExtractImage = int (*)(long long, int, int, const char*);
using FnSplit = int (*)(long long, int, int, const char*);
using FnMerge = int (*)(long long, long long, const char*);
using FnToWord = int (*)(long long, const char*);
using FnExternal = int (*)(const char*, const char*);

#define LB_PDF_FUNCTIONS(X) \
    X(Version, FnStr) X(Available, FnInt) X(LastError, FnStr) X(Open, FnOpen) X(OpenBytes, FnOpenBytes) \
    X(Close, FnClose) X(ReleaseAll, FnReleaseAll) X(GetPageCount, FnIntFromHandle) \
    X(GetPageWidth, FnDoubleFromPage) X(GetPageHeight, FnDoubleFromPage) X(GetPageText, FnStrFromPage) \
    X(GetAllText, FnStrFromHandle) X(HasTextLayer, FnIntFromPage) X(RenderPagePng, FnRenderPng) \
    X(GetImageCount, FnIntFromPage) X(ExtractImage, FnExtractImage) X(SplitPages, FnSplit) \
    X(MergeDocuments, FnMerge) X(ToWordTextStream, FnToWord) X(ExternalToPdf, FnExternal) X(GetOfficeEngine, FnStr)

#define LB_PDF_DECLARE(name, type) static type fPdf##name = nullptr;
LB_PDF_FUNCTIONS(LB_PDF_DECLARE)
#undef LB_PDF_DECLARE

static HMODULE g_lbPdfModule = nullptr;
static std::once_flag g_lbPdfOnce;
static bool g_lbPdfReady = false;
static std::wstring g_lbPdfError;

static bool LB_PdfEnsure() {
    std::call_once(g_lbPdfOnce, []() {
        g_lbPdfModule = LoadLibraryW(L"LingBuilderPdf.dll");
        if (!g_lbPdfModule) return;
#define LB_PDF_RESOLVE(name, type) fPdf##name = reinterpret_cast<type>(reinterpret_cast<void*>(GetProcAddress(g_lbPdfModule, "LBPdf_" #name)));
        LB_PDF_FUNCTIONS(LB_PDF_RESOLVE)
#undef LB_PDF_RESOLVE
        g_lbPdfReady = fPdfOpen && fPdfOpenBytes && fPdfClose && fPdfReleaseAll && fPdfGetPageCount && fPdfGetPageWidth \
            && fPdfGetPageHeight && fPdfGetPageText && fPdfGetAllText && fPdfHasTextLayer && fPdfRenderPagePng \
            && fPdfGetImageCount && fPdfExtractImage && fPdfSplitPages && fPdfMergeDocuments \
            && fPdfToWordTextStream && fPdfExternalToPdf && fPdfGetOfficeEngine;
    });
    if (!g_lbPdfReady) {
        g_lbPdfError = L"无法加载随附运行桥 LingBuilderPdf.dll，请确认 lingbuilder.pdf.sdk 模块已启用且该文件位于 exe 同目录。";
        return false;
    }
    return true;
}

static void LB_PdfPullError() { g_lbPdfError = LB_Utf8ToWide(fPdfLastError()); }
static bool LB_PdfOk(int result) { if (result != 1) LB_PdfPullError(); return result == 1; }
static long long LB_PdfHandle(long long handle) {
    if (handle == 0) { g_lbPdfError = L"PDF 文档句柄为 0，请先成功打开文档。"; return 0; }
    return handle;
}
} // namespace LingBuilderPdfBridge

using namespace LingBuilderPdfBridge;

bool PDF_是否可用() { LB_PdfEnsure(); return g_lbPdfReady; }
const wchar_t* PDF_取错误() { return LB_ReturnText(g_lbPdfError); }
const wchar_t* PDF_取版本() { if (!LB_PdfEnsure()) return LB_ReturnText(L""); return LB_ReturnText(LB_Utf8ToWide(fPdfVersion())); }
long long PDF_打开(const wchar_t* 文件路径) { if (!LB_PdfEnsure()) return 0; g_lbPdfError.clear(); long long result = fPdfOpen(LB_WideToUtf8(文件路径).c_str()); if (result == 0) LB_PdfPullError(); return result; }
long long PDF_打开字节集(const std::vector<unsigned char>& 数据) { if (!LB_PdfEnsure()) return 0; g_lbPdfError.clear(); long long result = fPdfOpenBytes(数据.data(), static_cast<int>(数据.size())); if (result == 0) LB_PdfPullError(); return result; }
bool PDF_关闭(long long 文档) { if (!LB_PdfEnsure()) return false; if (文档 == 0) { g_lbPdfError = L"PDF 文档句柄为 0，请先成功打开文档。"; return false; } return LB_PdfOk(fPdfClose(文档)); }
void PDF_释放全部() { if (!LB_PdfEnsure()) return; fPdfReleaseAll(); }
int PDF_取页数(long long 文档) { if (!LB_PdfEnsure()) return 0; return fPdfGetPageCount(LB_PdfHandle(文档)); }
double PDF_取页面宽度(long long 文档, int 页号) { if (!LB_PdfEnsure()) return 0; g_lbPdfError.clear(); double result = fPdfGetPageWidth(LB_PdfHandle(文档), 页号); if (result == 0) LB_PdfPullError(); return result; }
double PDF_取页面高度(long long 文档, int 页号) { if (!LB_PdfEnsure()) return 0; g_lbPdfError.clear(); double result = fPdfGetPageHeight(LB_PdfHandle(文档), 页号); if (result == 0) LB_PdfPullError(); return result; }
const wchar_t* PDF_取页面文本(long long 文档, int 页号) { if (!LB_PdfEnsure()) return LB_ReturnText(L""); LB_PdfHandle(文档); const char* value = fPdfGetPageText(文档, 页号); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_PdfPullError(); return LB_ReturnText(std::move(wide)); }
const wchar_t* PDF_取全部文本(long long 文档) { if (!LB_PdfEnsure()) return LB_ReturnText(L""); LB_PdfHandle(文档); const char* value = fPdfGetAllText(文档); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_PdfPullError(); return LB_ReturnText(std::move(wide)); }
bool PDF_是否有文本层(long long 文档, int 页号) { if (!LB_PdfEnsure()) return false; return fPdfHasTextLayer(LB_PdfHandle(文档), 页号) == 1; }
bool PDF_渲染页面PNG(long long 文档, int 页号, double 缩放倍率, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfRenderPagePng(LB_PdfHandle(文档), 页号, 缩放倍率, LB_WideToUtf8(输出路径).c_str())); }
int PDF_取图片数(long long 文档, int 页号) { if (!LB_PdfEnsure()) return 0; return fPdfGetImageCount(LB_PdfHandle(文档), 页号); }
bool PDF_提取图片(long long 文档, int 页号, int 图片索引, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfExtractImage(LB_PdfHandle(文档), 页号, 图片索引, LB_WideToUtf8(输出路径).c_str())); }
bool PDF_拆分页面(long long 文档, int 起始页, int 结束页, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfSplitPages(LB_PdfHandle(文档), 起始页, 结束页, LB_WideToUtf8(输出路径).c_str())); }
bool PDF_合并文档(long long 文档甲, long long 文档乙, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfMergeDocuments(LB_PdfHandle(文档甲), LB_PdfHandle(文档乙), LB_WideToUtf8(输出路径).c_str())); }
bool PDF_转Word文本流(long long 文档, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfToWordTextStream(LB_PdfHandle(文档), LB_WideToUtf8(输出路径).c_str())); }
bool PDF_外部文档转PDF(const wchar_t* 输入路径, const wchar_t* 输出路径) { if (!LB_PdfEnsure()) return false; return LB_PdfOk(fPdfExternalToPdf(LB_WideToUtf8(输入路径).c_str(), LB_WideToUtf8(输出路径).c_str())); }
const wchar_t* PDF_取Office转换引擎() { if (!LB_PdfEnsure()) return LB_ReturnText(L""); return LB_ReturnText(LB_Utf8ToWide(fPdfGetOfficeEngine())); }
`;
