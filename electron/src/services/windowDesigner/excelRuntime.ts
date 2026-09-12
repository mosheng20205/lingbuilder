export const EXCEL_RUNTIME = String.raw`
namespace LingBuilderExcelBridge {
using FnStr = const char* (*)();
using FnStrFromHandle = const char* (*)(long long);
using FnCreate = long long (*)(const char*);
using FnOpen = long long (*)(const char*);
using FnSave = int (*)(long long);
using FnSaveAs = int (*)(long long, const char*);
using FnClose = int (*)(long long);
using FnInt = int (*)(long long);
using FnSheetName = const char* (*)(long long, int);
using FnSelectSheet = int (*)(long long, const char*);
using FnAddSheet = int (*)(long long, const char*);
using FnWriteText = int (*)(long long, const char*, const char*);
using FnWriteNumber = int (*)(long long, const char*, double);
using FnWriteBool = int (*)(long long, const char*, int);
using FnWriteFormula = int (*)(long long, const char*, const char*);
using FnWriteDateTime = int (*)(long long, const char*, const char*);
using FnCellType = int (*)(long long, const char*);
using FnReadText = const char* (*)(long long, const char*);
using FnReadNumber = int (*)(long long, const char*, double*);
using FnReadFormula = const char* (*)(long long, const char*);
using FnWriteRow = int (*)(long long, const char*, const char*, const char*);
using FnAppendRow = int (*)(long long, const char*, const char*);
using FnReadRegion = const char* (*)(long long, const char*, const char*);
using FnUsedRange = const char* (*)(long long);
using FnSetColumnWidth = int (*)(long long, const char*, double);
using FnSetRowHeight = int (*)(long long, int, double);
using FnMergeCells = int (*)(long long, const char*);
using FnFreezePanes = int (*)(long long, int, int);
using FnSetFormatInt = int (*)(long long, const char*, int);
using FnSetFormatNumber = int (*)(long long, const char*, double);
using FnInsertDelete = int (*)(long long, int, int);
using FnDateToSerial = double (*)(const char*);
using FnSerialToDate = const char* (*)(double);

#define LB_EXCEL_FUNCTIONS(X) \
    X(Version, FnStr) X(LastError, FnStr) X(Create, FnCreate) X(Open, FnOpen) X(Save, FnSave) \
    X(SaveAs, FnSaveAs) X(Close, FnClose) X(SheetCount, FnInt) X(SheetName, FnSheetName) \
    X(CurrentSheet, FnStrFromHandle) X(SelectSheet, FnSelectSheet) X(AddSheet, FnAddSheet) X(RemoveSheet, FnSelectSheet) \
    X(WriteText, FnWriteText) X(WriteNumber, FnWriteNumber) X(WriteBool, FnWriteBool) \
    X(WriteFormula, FnWriteFormula) X(WriteDateTime, FnWriteDateTime) X(ClearCell, FnSelectSheet) \
    X(CellType, FnCellType) X(ReadText, FnReadText) X(ReadNumber, FnReadNumber) X(ReadFormula, FnReadFormula) \
    X(WriteRow, FnWriteRow) X(AppendRow, FnAppendRow) X(ReadRegion, FnReadRegion) X(UsedRange, FnUsedRange) \
    X(SetColumnWidth, FnSetColumnWidth) X(SetRowHeight, FnSetRowHeight) X(MergeCells, FnMergeCells) \
    X(FreezePanes, FnFreezePanes) X(SetNumberFormat, FnSetFormatInt) X(SetBold, FnSetFormatInt) \
    X(SetFontSize, FnSetFormatNumber) X(SetFontColor, FnSetFormatInt) X(SetBackColor, FnSetFormatInt) \
    X(SetAlign, FnSetFormatInt) X(InsertRows, FnInsertDelete) X(DeleteRows, FnInsertDelete) \
    X(InsertCols, FnInsertDelete) X(DeleteCols, FnInsertDelete) X(DateToSerial, FnDateToSerial) \
    X(SerialToDate, FnSerialToDate)

#define LB_EXCEL_DECLARE(name, type) static type f##name = nullptr;
LB_EXCEL_FUNCTIONS(LB_EXCEL_DECLARE)
#undef LB_EXCEL_DECLARE

static HMODULE g_lbExcelModule = nullptr;
static std::once_flag g_lbExcelOnce;
static bool g_lbExcelReady = false;
static std::wstring g_lbExcelError;
static thread_local bool g_lbExcelErrorValid = false;

static bool LB_ExcelEnsure() {
    std::call_once(g_lbExcelOnce, []() {
        g_lbExcelModule = LoadLibraryW(L"LingBuilderExcel.dll");
        if (!g_lbExcelModule) return;
#define LB_EXCEL_RESOLVE(name, type) f##name = reinterpret_cast<type>(reinterpret_cast<void*>(GetProcAddress(g_lbExcelModule, "LBExcel_" #name)));
        LB_EXCEL_FUNCTIONS(LB_EXCEL_RESOLVE)
#undef LB_EXCEL_RESOLVE
        g_lbExcelReady = fCreate && fOpen && fSave && fSaveAs && fClose && fSheetCount && fSheetName && fSelectSheet \
            && fAddSheet && fRemoveSheet && fWriteText && fWriteNumber && fWriteBool && fWriteFormula && fWriteDateTime \
            && fClearCell && fCellType && fReadText && fReadNumber && fReadFormula && fWriteRow && fAppendRow \
            && fReadRegion && fUsedRange && fSetColumnWidth && fSetRowHeight && fMergeCells && fFreezePanes \
            && fSetNumberFormat && fSetBold && fSetFontSize && fSetFontColor && fSetBackColor && fSetAlign \
            && fInsertRows && fDeleteRows && fInsertCols && fDeleteCols && fDateToSerial && fSerialToDate;
    });
    if (!g_lbExcelReady) {
        g_lbExcelError = L"无法加载随附运行桥 LingBuilderExcel.dll，请确认 exe 同目录存在该文件。";
        return false;
    }
    return true;
}

static void LB_ExcelPullError() { g_lbExcelError = LB_Utf8ToWide(fLastError()); }
static bool LB_ExcelOk(int result) { if (result != 1) LB_ExcelPullError(); return result == 1; }
static long long LB_ExcelHandle(long long handle) {
    if (handle == 0) { g_lbExcelError = L"工作簿句柄为 0，请先成功创建或打开工作簿。"; return 0; }
    return handle;
}
} // namespace LingBuilderExcelBridge

using namespace LingBuilderExcelBridge;

bool Excel_是否可用() { LB_ExcelEnsure(); return g_lbExcelReady; }
const wchar_t* Excel_取错误() { return LB_ReturnText(g_lbExcelError); }
const wchar_t* Excel_取版本() { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); return LB_ReturnText(LB_Utf8ToWide(fVersion())); }
long long Excel_创建工作簿(const wchar_t* 文件路径) { if (!LB_ExcelEnsure()) return 0; g_lbExcelError.clear(); long long result = fCreate(LB_WideToUtf8(文件路径).c_str()); if (result == 0) LB_ExcelPullError(); return result; }
long long Excel_打开工作簿(const wchar_t* 文件路径) { if (!LB_ExcelEnsure()) return 0; g_lbExcelError.clear(); long long result = fOpen(LB_WideToUtf8(文件路径).c_str()); if (result == 0) LB_ExcelPullError(); return result; }
bool Excel_保存(long long 工作簿) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSave(LB_ExcelHandle(工作簿))); }
bool Excel_另存为(long long 工作簿, const wchar_t* 文件路径) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSaveAs(LB_ExcelHandle(工作簿), LB_WideToUtf8(文件路径).c_str())); }
bool Excel_关闭(long long 工作簿) { if (!LB_ExcelEnsure()) return false; if (工作簿 == 0) { g_lbExcelError = L"工作簿句柄为 0，请先成功创建或打开工作簿。"; return false; } return LB_ExcelOk(fClose(工作簿)); }
int Excel_取工作表数量(long long 工作簿) { if (!LB_ExcelEnsure()) return 0; return fSheetCount(LB_ExcelHandle(工作簿)); }
const wchar_t* Excel_取工作表名(long long 工作簿, int 序号) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fSheetName(工作簿, 序号); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
const wchar_t* Excel_取当前工作表(long long 工作簿) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fCurrentSheet(工作簿); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
bool Excel_置当前工作表(long long 工作簿, const wchar_t* 名称) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSelectSheet(LB_ExcelHandle(工作簿), LB_WideToUtf8(名称).c_str())); }
bool Excel_添加工作表(long long 工作簿, const wchar_t* 名称) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fAddSheet(LB_ExcelHandle(工作簿), LB_WideToUtf8(名称).c_str())); }
bool Excel_删除工作表(long long 工作簿, const wchar_t* 名称) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fRemoveSheet(LB_ExcelHandle(工作簿), LB_WideToUtf8(名称).c_str())); }
bool Excel_写文本(long long 工作簿, const wchar_t* 单元格, const wchar_t* 内容) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteText(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), LB_WideToUtf8(内容).c_str())); }
bool Excel_写数值(long long 工作簿, const wchar_t* 单元格, double 数值) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteNumber(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 数值)); }
bool Excel_写布尔(long long 工作簿, const wchar_t* 单元格, bool 值) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteBool(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 值 ? 1 : 0)); }
bool Excel_写公式(long long 工作簿, const wchar_t* 单元格, const wchar_t* 公式) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteFormula(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), LB_WideToUtf8(公式).c_str())); }
bool Excel_写日期(long long 工作簿, const wchar_t* 单元格, const wchar_t* 日期时间) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteDateTime(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), LB_WideToUtf8(日期时间).c_str())); }
bool Excel_清除单元格(long long 工作簿, const wchar_t* 单元格) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fClearCell(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str())); }
const wchar_t* Excel_读单元格文本(long long 工作簿, const wchar_t* 单元格) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fReadText(工作簿, LB_WideToUtf8(单元格).c_str()); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
double Excel_读单元格数值(long long 工作簿, const wchar_t* 单元格) { if (!LB_ExcelEnsure()) return 0; double result = 0; if (!LB_ExcelOk(fReadNumber(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), &result))) return 0; return result; }
const wchar_t* Excel_读单元格公式(long long 工作簿, const wchar_t* 单元格) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fReadFormula(工作簿, LB_WideToUtf8(单元格).c_str()); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
int Excel_取单元格类型(long long 工作簿, const wchar_t* 单元格) { if (!LB_ExcelEnsure()) return 0; return fCellType(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str()); }
bool Excel_是否为空单元格(long long 工作簿, const wchar_t* 单元格) { return Excel_取单元格类型(工作簿, 单元格) == 0; }
bool Excel_写一行(long long 工作簿, const wchar_t* 起始单元格, const wchar_t* 行内容, const wchar_t* 分隔符) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fWriteRow(LB_ExcelHandle(工作簿), LB_WideToUtf8(起始单元格).c_str(), LB_WideToUtf8(行内容).c_str(), LB_WideToUtf8(分隔符).c_str())); }
int Excel_追加行(long long 工作簿, const wchar_t* 行内容, const wchar_t* 分隔符) { if (!LB_ExcelEnsure()) return -1; int result = fAppendRow(LB_ExcelHandle(工作簿), LB_WideToUtf8(行内容).c_str(), LB_WideToUtf8(分隔符).c_str()); if (result < 0) LB_ExcelPullError(); return result; }
const wchar_t* Excel_读区域(long long 工作簿, const wchar_t* 范围, const wchar_t* 分隔符) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fReadRegion(工作簿, LB_WideToUtf8(范围).c_str(), LB_WideToUtf8(分隔符).c_str()); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
const wchar_t* Excel_取已用范围(long long 工作簿) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); LB_ExcelHandle(工作簿); const char* value = fUsedRange(工作簿); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
bool Excel_置列宽(long long 工作簿, const wchar_t* 列标, double 宽度) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetColumnWidth(LB_ExcelHandle(工作簿), LB_WideToUtf8(列标).c_str(), 宽度)); }
bool Excel_置行高(long long 工作簿, int 行号, double 高度) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetRowHeight(LB_ExcelHandle(工作簿), 行号, 高度)); }
bool Excel_合并单元格(long long 工作簿, const wchar_t* 范围) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fMergeCells(LB_ExcelHandle(工作簿), LB_WideToUtf8(范围).c_str())); }
bool Excel_冻结窗格(long long 工作簿, int 行数, int 列数) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fFreezePanes(LB_ExcelHandle(工作簿), 行数, 列数)); }
bool Excel_置数字格式(long long 工作簿, const wchar_t* 单元格, int 格式索引) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetNumberFormat(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 格式索引)); }
bool Excel_置加粗(long long 工作簿, const wchar_t* 单元格, bool 启用) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetBold(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 启用 ? 1 : 0)); }
bool Excel_置字号(long long 工作簿, const wchar_t* 单元格, double 字号) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetFontSize(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 字号)); }
bool Excel_置字体颜色(long long 工作簿, const wchar_t* 单元格, int 颜色值) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetFontColor(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 颜色值)); }
bool Excel_置背景色(long long 工作簿, const wchar_t* 单元格, int 颜色值) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetBackColor(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 颜色值)); }
bool Excel_置水平对齐(long long 工作簿, const wchar_t* 单元格, int 对齐方式) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fSetAlign(LB_ExcelHandle(工作簿), LB_WideToUtf8(单元格).c_str(), 对齐方式)); }
bool Excel_插入行(long long 工作簿, int 行号, int 数量) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fInsertRows(LB_ExcelHandle(工作簿), 行号, 数量)); }
bool Excel_删除行(long long 工作簿, int 行号, int 数量) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fDeleteRows(LB_ExcelHandle(工作簿), 行号, 数量)); }
bool Excel_插入列(long long 工作簿, int 列号, int 数量) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fInsertCols(LB_ExcelHandle(工作簿), 列号, 数量)); }
bool Excel_删除列(long long 工作簿, int 列号, int 数量) { if (!LB_ExcelEnsure()) return false; return LB_ExcelOk(fDeleteCols(LB_ExcelHandle(工作簿), 列号, 数量)); }
double Excel_日期转序列(const wchar_t* 日期时间) { if (!LB_ExcelEnsure()) return -1; g_lbExcelError.clear(); double result = fDateToSerial(LB_WideToUtf8(日期时间).c_str()); if (result < 0) LB_ExcelPullError(); return result; }
const wchar_t* Excel_序列转日期(double 序列值) { if (!LB_ExcelEnsure()) return LB_ReturnText(L""); g_lbExcelError.clear(); const char* value = fSerialToDate(序列值); std::wstring wide = LB_Utf8ToWide(value ? value : ""); LB_ExcelPullError(); return LB_ReturnText(std::move(wide)); }
`;
