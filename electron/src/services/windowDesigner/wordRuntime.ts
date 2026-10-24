/**
 * Word 文档模块（lingbuilder.data.word）生成器注入运行时。
 *
 * 事实来源：electron/native/word-bridge/wordBridge.cpp + wordBridge.def（手写模板，与桥一一对应；
 * 桥升级导出签名时必须同步本文件，smoke 脚本会做生成内容断言）。
 * 注入点：dataMediaRuntime.ts 的 RUNTIMES 表按启用模块拼接。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const WORD_MODULE_ID = 'lingbuilder.data.word';

export const WORD_RUNTIME = String.raw`
namespace LingBuilderWordBridge {
using FnStr = const char* (*)();
using FnInt = int (*)(long long);
using FnCreate = long long (*)();
using FnOpen = long long (*)(const char*);
using FnSave = int (*)(long long, const char*);
using FnClose = int (*)(long long);
using FnReleaseAll = void (*)();
using FnStrFromHandle = const char* (*)(long long);
using FnStrFromIndex = const char* (*)(long long, int);
using FnIntFromIndex = int (*)(long long, int);
using FnGetCell = const char* (*)(long long, int, int, int);
using FnAddText = int (*)(long long, const char*);
using FnAddHeading = int (*)(long long, const char*, int);
using FnAddParagraph = int (*)(long long, const char*, const char*);
using FnAddTable = int (*)(long long, int, int);
using FnSetCellText = int (*)(long long, int, int, int, const char*);
using FnAddImage = int (*)(long long, const char*, int, int);
using FnReplace = int (*)(long long, const char*, const char*);
using FnReplaceJson = int (*)(long long, const char*);
using FnReportFromJson = int (*)(const char*, const char*, const char*);
using FnExportPdf = int (*)(long long, const char*);
using FnTableToExcel = int (*)(long long, int, const char*);
using FnFillFromExcel = int (*)(long long, int, const char*);

#define LB_WORD_FUNCTIONS(X) \
    X(Version, FnStr) X(Available, FnInt) X(LastError, FnStr) X(Create, FnCreate) X(Open, FnOpen) \
    X(Save, FnSave) X(Close, FnClose) X(ReleaseAll, FnReleaseAll) X(GetFullText, FnStrFromHandle) \
    X(GetParaCount, FnInt) X(GetParaText, FnStrFromIndex) X(GetParaStyle, FnStrFromIndex) \
    X(GetTableCount, FnInt) X(GetTableRowCount, FnIntFromIndex) X(GetTableColCount, FnIntFromIndex) \
    X(GetCellText, FnGetCell) X(AddHeading, FnAddHeading) X(AddParagraph, FnAddParagraph) \
    X(AddTable, FnAddTable) X(SetCellText, FnSetCellText) X(AddImage, FnAddImage) \
    X(ReplacePlaceholder, FnReplace) X(ReplacePlaceholdersJson, FnReplaceJson) \
    X(ReportFromJson, FnReportFromJson) X(ExportPdf, FnExportPdf) \
    X(TableToExcel, FnTableToExcel) X(FillTableFromExcel, FnFillFromExcel)

#define LB_WORD_DECLARE(name, type) static type fWord##name = nullptr;
LB_WORD_FUNCTIONS(LB_WORD_DECLARE)
#undef LB_WORD_DECLARE

static HMODULE g_lbWordModule = nullptr;
static std::once_flag g_lbWordOnce;
static bool g_lbWordReady = false;
static std::wstring g_lbWordError;

static bool LB_WordEnsure() {
    std::call_once(g_lbWordOnce, []() {
        g_lbWordModule = LoadLibraryW(L"LingBuilderWord.dll");
        if (!g_lbWordModule) return;
#define LB_WORD_RESOLVE(name, type) fWord##name = reinterpret_cast<type>(reinterpret_cast<void*>(GetProcAddress(g_lbWordModule, "LBWord_" #name)));
        LB_WORD_FUNCTIONS(LB_WORD_RESOLVE)
#undef LB_WORD_RESOLVE
        g_lbWordReady = fWordCreate && fWordOpen && fWordSave && fWordClose && fWordReleaseAll && fWordGetFullText && fWordGetParaCount \
            && fWordGetParaText && fWordGetParaStyle && fWordGetTableCount && fWordGetTableRowCount && fWordGetTableColCount \
            && fWordGetCellText && fWordAddHeading && fWordAddParagraph && fWordAddTable && fWordSetCellText && fWordAddImage \
            && fWordReplacePlaceholder && fWordReplacePlaceholdersJson && fWordReportFromJson && fWordExportPdf \
            && fWordTableToExcel && fWordFillTableFromExcel;
    });
    if (!g_lbWordReady) {
        g_lbWordError = L"无法加载随附运行桥 LingBuilderWord.dll，请确认 exe 同目录存在该文件。";
        return false;
    }
    return true;
}

static void LB_WordPullError() { g_lbWordError = LB_Utf8ToWide(fWordLastError()); }
static bool LB_WordOk(int result) { if (result != 1) LB_WordPullError(); return result == 1; }
static long long LB_WordHandle(long long handle) {
    if (handle == 0) { g_lbWordError = L"文档句柄为 0，请先成功创建或打开文档。"; return 0; }
    return handle;
}
} // namespace LingBuilderWordBridge

using namespace LingBuilderWordBridge;

bool Word_是否可用() { LB_WordEnsure(); return g_lbWordReady; }
const wchar_t* Word_取错误() { return LB_ReturnText(g_lbWordError); }
const wchar_t* Word_取版本() { if (!LB_WordEnsure()) return LB_ReturnText(L""); return LB_ReturnText(LB_Utf8ToWide(fWordVersion())); }
long long Word_创建文档() { if (!LB_WordEnsure()) return 0; g_lbWordError.clear(); long long result = fWordCreate(); if (result == 0) LB_WordPullError(); return result; }
long long Word_打开文档(const wchar_t* 文件路径) { if (!LB_WordEnsure()) return 0; g_lbWordError.clear(); long long result = fWordOpen(LB_WideToUtf8(文件路径).c_str()); if (result == 0) LB_WordPullError(); return result; }
bool Word_保存文档(long long 文档, const wchar_t* 文件路径) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordSave(LB_WordHandle(文档), LB_WideToUtf8(文件路径).c_str())); }
bool Word_关闭文档(long long 文档) { if (!LB_WordEnsure()) return false; if (文档 == 0) { g_lbWordError = L"文档句柄为 0，请先成功创建或打开文档。"; return false; } return LB_WordOk(fWordClose(文档)); }
void Word_释放全部() { if (!LB_WordEnsure()) return; fWordReleaseAll(); }
const wchar_t* Word_取全文本(long long 文档) { if (!LB_WordEnsure()) return LB_ReturnText(L""); LB_WordHandle(文档); const char* value = fWordGetFullText(文档); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_WordPullError(); return LB_ReturnText(std::move(wide)); }
int Word_取段落数(long long 文档) { if (!LB_WordEnsure()) return 0; return fWordGetParaCount(LB_WordHandle(文档)); }
const wchar_t* Word_取段落文本(long long 文档, int 索引) { if (!LB_WordEnsure()) return LB_ReturnText(L""); LB_WordHandle(文档); const char* value = fWordGetParaText(文档, 索引); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_WordPullError(); return LB_ReturnText(std::move(wide)); }
const wchar_t* Word_取段落样式(long long 文档, int 索引) { if (!LB_WordEnsure()) return LB_ReturnText(L""); LB_WordHandle(文档); const char* value = fWordGetParaStyle(文档, 索引); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_WordPullError(); return LB_ReturnText(std::move(wide)); }
int Word_取表格数(long long 文档) { if (!LB_WordEnsure()) return 0; return fWordGetTableCount(LB_WordHandle(文档)); }
int Word_取表格行数(long long 文档, int 表格索引) { if (!LB_WordEnsure()) return 0; return fWordGetTableRowCount(LB_WordHandle(文档), 表格索引); }
int Word_取表格列数(long long 文档, int 表格索引) { if (!LB_WordEnsure()) return 0; return fWordGetTableColCount(LB_WordHandle(文档), 表格索引); }
const wchar_t* Word_取单元格文本(long long 文档, int 表格索引, int 行, int 列) { if (!LB_WordEnsure()) return LB_ReturnText(L""); LB_WordHandle(文档); const char* value = fWordGetCellText(文档, 表格索引, 行, 列); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_WordPullError(); return LB_ReturnText(std::move(wide)); }
bool Word_添加标题(long long 文档, const wchar_t* 文本, int 级别) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordAddHeading(LB_WordHandle(文档), LB_WideToUtf8(文本).c_str(), 级别)); }
bool Word_添加段落(long long 文档, const wchar_t* 文本, const wchar_t* 样式) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordAddParagraph(LB_WordHandle(文档), LB_WideToUtf8(文本).c_str(), LB_WideToUtf8(样式).c_str())); }
bool Word_添加表格(long long 文档, int 行数, int 列数) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordAddTable(LB_WordHandle(文档), 行数, 列数)); }
bool Word_设置单元格文本(long long 文档, int 表格索引, int 行, int 列, const wchar_t* 文本) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordSetCellText(LB_WordHandle(文档), 表格索引, 行, 列, LB_WideToUtf8(文本).c_str())); }
bool Word_添加图片(long long 文档, const wchar_t* 图片路径, int 宽度, int 高度) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordAddImage(LB_WordHandle(文档), LB_WideToUtf8(图片路径).c_str(), 宽度, 高度)); }
int Word_替换占位符(long long 文档, const wchar_t* 占位名, const wchar_t* 替换值) { if (!LB_WordEnsure()) return -1; g_lbWordError.clear(); int result = fWordReplacePlaceholder(LB_WordHandle(文档), LB_WideToUtf8(占位名).c_str(), LB_WideToUtf8(替换值).c_str()); if (result < 0) LB_WordPullError(); return result; }
int Word_批量替换占位符(long long 文档, const wchar_t* 替换JSON) { if (!LB_WordEnsure()) return -1; g_lbWordError.clear(); int result = fWordReplacePlaceholdersJson(LB_WordHandle(文档), LB_WideToUtf8(替换JSON).c_str()); if (result < 0) LB_WordPullError(); return result; }
bool Word_从JSON生成报告(const wchar_t* 模板路径, const wchar_t* 数据JSON, const wchar_t* 输出路径) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordReportFromJson(LB_WideToUtf8(模板路径).c_str(), LB_WideToUtf8(数据JSON).c_str(), LB_WideToUtf8(输出路径).c_str())); }
bool Word_导出PDF(long long 文档, const wchar_t* 输出路径) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordExportPdf(LB_WordHandle(文档), LB_WideToUtf8(输出路径).c_str())); }
bool Word_表格另存Excel(long long 文档, int 表格索引, const wchar_t* 输出路径) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordTableToExcel(LB_WordHandle(文档), 表格索引, LB_WideToUtf8(输出路径).c_str())); }
bool Word_从Excel填充表格(long long 文档, int 表格索引, const wchar_t* Excel路径) { if (!LB_WordEnsure()) return false; return LB_WordOk(fWordFillTableFromExcel(LB_WordHandle(文档), 表格索引, LB_WideToUtf8(Excel路径).c_str())); }
`;
