// LingBuilderExcel.dll —— LingBuilder Excel 表格模块（lingbuilder.data.excel）随附运行桥。
// 写路径：内存文档模型 + libxlsxwriter（BSD-2-Clause）一次性序列化为 .xlsx。
// 读路径：OpenXLSX（MIT）打开既有 .xlsx，单元格级读写，原样保存。
//
// ABI 约定（与 excelRuntime.ts 生成的 C++ 桥一一对应）：
//   - 所有导出为 extern "C" __cdecl，导出名由 excelBridge.def 固定，x86/x64 一致。
//   - 所有字符串参数与返回值均为 UTF-8；宽字符转换只发生在生成代码一侧。
//   - 工作簿句柄为 long long；0 表示无效句柄。
//   - 返回 const char* 的导出指向本 DLL 内的线程局部缓冲区，调用方必须立即复制。
//   - 失败时导出返回 0/负值，并更新 LBExcel_LastError 的线程局部中文错误。

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "xlsxwriter.h"

#include "XLCell.hpp"
#include "XLCellValue.hpp"
#include "XLDocument.hpp"
#include "XLFormula.hpp"
#include "XLSheet.hpp"
#include "XLWorkbook.hpp"

using namespace OpenXLSX;

namespace {

thread_local std::wstring g_lastErrorWide; // 仅在本文件内部复用，导出层统一转 UTF-8。

std::string WideToUtf8(const std::wstring& value) {
    if (value.empty()) return std::string();
    const int size = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()),
                                         nullptr, 0, nullptr, nullptr);
    std::string result(static_cast<size_t>(size > 0 ? size : 0), '\0');
    if (size > 0) WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
    return result;
}

std::wstring Utf8ToWide(const std::string& value) {
    if (value.empty()) return std::wstring();
    const int size = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0);
    std::wstring result(static_cast<size_t>(size > 0 ? size : 0), L'\0');
    if (size > 0) MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), result.data(), size);
    return result;
}

// Howard Hinnant days_from_civil / civil_from_days，公历日序换算。
long long DaysFromCivil(long long year, unsigned month, unsigned day) {
    year -= month <= 2;
    const long long era = (year >= 0 ? year : year - 399) / 400;
    const unsigned yearOfEra = static_cast<unsigned>(year - era * 400);
    const unsigned dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    const unsigned dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097 + static_cast<long long>(dayOfEra) - 719468;
}

void CivilFromDays(long long days, long long& year, unsigned& month, unsigned& day) {
    days += 719468;
    const long long era = (days >= 0 ? days : days - 146096) / 146097;
    const unsigned dayOfEra = static_cast<unsigned>(days - era * 146097);
    const unsigned yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365;
    year = era * 400 + yearOfEra;
    const unsigned dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100);
    const unsigned mp = (5 * dayOfYear + 2) / 153;
    day = dayOfYear - (153 * mp + 2) / 5 + 1;
    month = mp < 10 ? mp + 3 : mp - 9;
    year += month <= 2;
}

const long long kSerialEpochDays = DaysFromCivil(1899, 12, 30);

// ---------- 引用解析 ----------

int LettersToColumn(const std::wstring& letters) {
    int column = 0;
    for (wchar_t ch : letters) {
        if (ch >= L'A' && ch <= L'Z') column = column * 26 + (ch - L'A' + 1);
        else if (ch >= L'a' && ch <= L'z') column = column * 26 + (ch - L'a' + 1);
        else return -1;
    }
    return column - 1; // 0 起
}

std::wstring ColumnToLetters(int column) { // 0 起
    std::wstring result;
    int value = column + 1;
    while (value > 0) {
        result.insert(result.begin(), static_cast<wchar_t>(L'A' + (value - 1) % 26));
        value = (value - 1) / 26;
    }
    return result;
}

// 解析 "A1" / "$A$1" → 0 起行、列；失败返回假。
bool ParseCellRef(const std::string& utf8, int& row, int& column) {
    const std::wstring text = Utf8ToWide(utf8);
    size_t index = 0;
    while (index < text.size() && text[index] == L'$') ++index;
    size_t letterStart = index;
    while (index < text.size() && ((text[index] >= L'A' && text[index] <= L'Z') || (text[index] >= L'a' && text[index] <= L'z'))) ++index;
    if (index == letterStart) return false;
    column = LettersToColumn(text.substr(letterStart, index - letterStart));
    if (column < 0) return false;
    while (index < text.size() && text[index] == L'$') ++index;
    size_t digitStart = index;
    while (index < text.size() && text[index] >= L'0' && text[index] <= L'9') ++index;
    if (index == digitStart) return false;
    row = _wtoi(text.substr(digitStart, index - digitStart).c_str()) - 1;
    return row >= 0 && index == text.size();
}

bool ParseRange(const std::string& utf8, int& row1, int& col1, int& row2, int& col2) {
    const std::wstring text = Utf8ToWide(utf8);
    const size_t colon = text.find(L':');
    if (colon == std::wstring::npos) {
        if (!ParseCellRef(utf8, row1, col1)) return false;
        row2 = row1;
        col2 = col1;
        return true;
    }
    return ParseCellRef(WideToUtf8(text.substr(0, colon)), row1, col1) &&
           ParseCellRef(WideToUtf8(text.substr(colon + 1)), row2, col2);
}

std::wstring MakeCellRef(int row, int column) { // 0 起
    return ColumnToLetters(column) + std::to_wstring(row + 1);
}

std::string FormatDouble(double value) {
    wchar_t buffer[64] = {};
    swprintf(buffer, 64, L"%.15g", value);
    return WideToUtf8(buffer);
}

// ---------- 值拆分 ----------

bool ParseNumberToken(const std::wstring& token, double& out) {
    if (token.empty()) return false;
    const std::string narrow = WideToUtf8(token);
    wchar_t* end = nullptr;
    const double parsed = wcstod(token.c_str(), &end);
    if (end == token.c_str()) return false;
    while (end && *end) { if (*end != L' ' && *end != L'\t' && *end != L'\r' && *end != L'\n') return false; ++end; }
    out = parsed;
    (void)narrow;
    return true;
}

// "YYYY-MM-DD[ HH:MM[:SS]]" → Excel 序列值；失败返回假。
bool ParseDateTimeToSerial(const std::string& utf8, double& serial) {
    const std::wstring text = Utf8ToWide(utf8);
    int year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
    const int matched = swscanf(text.c_str(), L"%d-%d-%d %d:%d:%d", &year, &month, &day, &hour, &minute, &second);
    int normalized = matched;
    if (matched == 1 || matched == 2) { // 支持 YYYY/MM/DD
        const int alt = swscanf(text.c_str(), L"%d/%d/%d %d:%d:%d", &year, &month, &day, &hour, &minute, &second);
        normalized = alt >= 3 ? alt : matched;
    }
    if (normalized < 3) return false;
    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return false;
    serial = static_cast<double>(DaysFromCivil(year, static_cast<unsigned>(month), static_cast<unsigned>(day)) - kSerialEpochDays) +
             (hour * 3600 + minute * 60 + second) / 86400.0;
    return true;
}

// 判断日期时间文本是否带时间部分（决定写日期时使用日期时间格式还是纯日期格式）。
bool HasTimeComponent(const char* isoText) {
    const std::wstring text = Utf8ToWide(isoText ? isoText : "");
    return text.find(L':') != std::wstring::npos;
}

bool SerialToDateTime(double serial, std::string& iso) {
    if (!(serial >= 0) || serial > 2958465.99999) return false; // 9999-12-31 上限
    long long days = static_cast<long long>(std::floor(serial + 1e-9));
    double fraction = serial - static_cast<double>(days);
    if (fraction < 0) { fraction += 1.0; --days; }
    long long year = 0; unsigned month = 0, day = 0;
    CivilFromDays(days + kSerialEpochDays, year, month, day);
    long long seconds = static_cast<long long>(std::floor(fraction * 86400.0 + 0.5));
    if (seconds >= 86400) { seconds -= 86400; CivilFromDays(days + kSerialEpochDays + 1, year, month, day); }
    wchar_t buffer[64] = {};
    if (seconds > 0) swprintf(buffer, 64, L"%04lld-%02u-%02u %02lld:%02lld:%02lld",
        year, month, day, seconds / 3600, (seconds / 60) % 60, seconds % 60);
    else swprintf(buffer, 64, L"%04lld-%02u-%02u", year, month, day);
    iso = WideToUtf8(buffer);
    return true;
}

// ---------- 文档模型（创建模式） ----------

enum class CellKind { Empty, Text, Number, Bool, Formula };

struct CellFormat {
    bool bold = false;
    bool hasFontSize = false;
    double fontSize = 0;
    int fontColor = -1;   // 0xRRGGBB
    int backColor = -1;
    int align = -1;       // 0 左 1 中 2 右
    int numberFormat = -1; // 0 文本 1 整数 2 两位小数 3 百分比 4 日期时间

    bool IsDefault() const {
        return !bold && !hasFontSize && fontColor < 0 && backColor < 0 && align < 0 && numberFormat < 0;
    }
    bool operator<(const CellFormat& other) const {
        if (bold != other.bold) return bold < other.bold;
        if (hasFontSize != other.hasFontSize) return hasFontSize < other.hasFontSize;
        if (hasFontSize && other.hasFontSize && fontSize != other.fontSize) return fontSize < other.fontSize;
        if (fontColor != other.fontColor) return fontColor < other.fontColor;
        if (backColor != other.backColor) return backColor < other.backColor;
        if (align != other.align) return align < other.align;
        return numberFormat < other.numberFormat;
    }
};

struct CellValue {
    CellKind kind = CellKind::Empty;
    std::wstring text;  // Text / Formula（公式不带 =）
    double number = 0;  // Number；Bool 存 0/1
    bool flag = false;
    CellFormat fmt;
};

struct Rect {
    int row1 = 0, col1 = 0, row2 = 0, col2 = 0;
};

struct SheetModel {
    std::wstring name;
    std::map<std::pair<int, int>, CellValue> cells; // ((row, col)) 0 起
    std::map<int, double> colWidths;
    std::map<int, double> rowHeights;
    std::vector<Rect> merges;
    int freezeRows = 0;
    int freezeCols = 0;

    CellValue* FindCell(int row, int column) {
        const auto found = cells.find({ row, column });
        return found == cells.end() ? nullptr : &found->second;
    }
    const CellValue* FindCell(int row, int column) const {
        const auto found = cells.find({ row, column });
        return found == cells.end() ? nullptr : &found->second;
    }
    CellValue& EnsureCell(int row, int column) { return cells[{ row, column }]; }

    int LastUsedRow() const {
        int last = -1;
        for (const auto& item : cells) {
            if (item.second.kind == CellKind::Empty) continue;
            if (item.first.first > last) last = item.first.first;
        }
        return last;
    }
};

struct CreateDoc {
    std::wstring savePath;
    std::vector<SheetModel> sheets;
    int current = 0;

    SheetModel* Current() { return sheets.empty() || current < 0 || current >= static_cast<int>(sheets.size()) ? nullptr : &sheets[static_cast<size_t>(current)]; }
};

// ---------- 打开模式 ----------

struct OpenDoc {
    std::wstring savePath;
    std::unique_ptr<XLDocument> doc;
    std::string currentSheet;
};

// ---------- 句柄表 ----------

struct WorkbookEntry {
    bool createMode = false;
    std::shared_ptr<CreateDoc> createDoc;
    std::shared_ptr<OpenDoc> openDoc;
};

std::mutex g_mutex;
std::unordered_map<long long, WorkbookEntry> g_workbooks;
std::atomic<long long> g_nextHandle{ 1 };

// 线程局部返回缓冲区（导出层 const char* 指向这里）。
thread_local std::string g_textReturn;

bool Fail(const char* message) {
    g_lastErrorWide = Utf8ToWide(message);
    return false;
}
bool Fail(const std::wstring& message) {
    g_lastErrorWide = message;
    return false;
}

WorkbookEntry* Lookup(long long handle) {
    const auto found = g_workbooks.find(handle);
    return found == g_workbooks.end() ? nullptr : &found->second;
}

const char* ReturnText(const std::string& utf8) {
    g_textReturn = utf8;
    return g_textReturn.c_str();
}

const char* LastErrorUtf8() {
    g_textReturn = WideToUtf8(g_lastErrorWide);
    return g_textReturn.c_str();
}

// ---------- 创建模式保存（libxlsxwriter 序列化） ----------

std::string NormalizedFormula(const std::wstring& formula) {
    std::wstring text = formula;
    size_t start = 0;
    while (start < text.size() && (text[start] == L' ' || text[start] == L'=')) ++start;
    return WideToUtf8(text.substr(start));
}

lxw_format* FormatFor(lxw_workbook* workbook, std::map<CellFormat, lxw_format*>& cache, const CellFormat& fmt) {
    if (fmt.IsDefault()) return nullptr;
    const auto found = cache.find(fmt);
    if (found != cache.end()) return found->second;
    lxw_format* format = workbook_add_format(workbook);
    if (fmt.bold) format_set_bold(format);
    if (fmt.hasFontSize) format_set_font_size(format, fmt.fontSize);
    if (fmt.fontColor >= 0) format_set_font_color(format, static_cast<lxw_color_t>(fmt.fontColor));
    if (fmt.backColor >= 0) format_set_bg_color(format, static_cast<lxw_color_t>(fmt.backColor));
    if (fmt.align == 0) format_set_align(format, LXW_ALIGN_LEFT);
    else if (fmt.align == 1) format_set_align(format, LXW_ALIGN_CENTER);
    else if (fmt.align == 2) format_set_align(format, LXW_ALIGN_RIGHT);
    if (fmt.numberFormat == 0) format_set_num_format(format, "@");
    else if (fmt.numberFormat == 1) format_set_num_format(format, "0");
    else if (fmt.numberFormat == 2) format_set_num_format(format, "0.00");
    else if (fmt.numberFormat == 3) format_set_num_format(format, "0.00%");
    else if (fmt.numberFormat == 4) format_set_num_format(format, "yyyy\\-mm\\-dd hh:mm:ss");
    else if (fmt.numberFormat == 5) format_set_num_format(format, "yyyy\\-mm\\-dd");
    cache.emplace(fmt, format);
    return format;
}

bool IsInMergeOtherThanTopLeft(const SheetModel& sheet, int row, int column) {
    for (const Rect& rect : sheet.merges) {
        if (row < rect.row1 || row > rect.row2 || column < rect.col1 || column > rect.col2) continue;
        return !(row == rect.row1 && column == rect.col1);
    }
    return false;
}

bool SaveCreateDoc(const CreateDoc& doc, const std::wstring& targetPath) {
    if (doc.sheets.empty()) return Fail(L"工作簿没有任何工作表，无法保存。");
    wchar_t temp[1024] = {};
    swprintf(temp, 1024, L"%s.tmp-%lu-%llu.xlsx", targetPath.c_str(),
             static_cast<unsigned long>(GetCurrentProcessId()), static_cast<unsigned long long>(GetTickCount64()));
    lxw_workbook* workbook = workbook_new(WideToUtf8(temp).c_str());
    if (!workbook) return Fail(L"无法创建临时工作簿文件（磁盘不可写或路径无效）。");
    std::map<CellFormat, lxw_format*> formatCache;
    for (const SheetModel& sheet : doc.sheets) {
        lxw_worksheet* worksheet = workbook_add_worksheet(workbook, WideToUtf8(sheet.name).c_str());
        for (const auto& item : sheet.colWidths) {
            worksheet_set_column(worksheet, static_cast<lxw_col_t>(item.first), static_cast<lxw_col_t>(item.first), item.second, nullptr);
        }
        for (const auto& item : sheet.rowHeights) {
            worksheet_set_row(worksheet, static_cast<lxw_row_t>(item.first), item.second, nullptr);
        }
        for (const Rect& rect : sheet.merges) {
            const CellValue* value = const_cast<SheetModel&>(sheet).FindCell(rect.row1, rect.col1);
            lxw_format* format = value ? FormatFor(workbook, formatCache, value->fmt) : nullptr;
            const std::string text = value ? (value->kind == CellKind::Number ? FormatDouble(value->number)
                : value->kind == CellKind::Bool ? (value->flag ? "真" : "假") : WideToUtf8(value->text)) : "";
            worksheet_merge_range(worksheet, rect.row1, rect.col1, rect.row2, rect.col2, text.c_str(), format);
        }
        if (sheet.freezeRows > 0 || sheet.freezeCols > 0) {
            worksheet_freeze_panes(worksheet, static_cast<lxw_row_t>(sheet.freezeRows), static_cast<lxw_col_t>(sheet.freezeCols));
        }
        for (const auto& item : sheet.cells) {
            const CellValue& cell = item.second;
            if (IsInMergeOtherThanTopLeft(sheet, item.first.first, item.first.second)) continue;
            const int row = item.first.first;
            const int column = item.first.second;
            lxw_format* format = FormatFor(workbook, formatCache, cell.fmt);
            if (cell.kind == CellKind::Empty) {
                // 只设置了格式还没有内容的单元格：写成带格式空白，不参与内容与"已用范围"。
                if (format) worksheet_write_blank(worksheet, static_cast<lxw_row_t>(row), static_cast<lxw_col_t>(column), format);
                continue;
            }
            if (cell.kind == CellKind::Text) {
                worksheet_write_string(worksheet, static_cast<lxw_row_t>(row), static_cast<lxw_col_t>(column), WideToUtf8(cell.text).c_str(), format);
            } else if (cell.kind == CellKind::Number) {
                worksheet_write_number(worksheet, static_cast<lxw_row_t>(row), static_cast<lxw_col_t>(column), cell.number, format);
            } else if (cell.kind == CellKind::Bool) {
                worksheet_write_boolean(worksheet, static_cast<lxw_row_t>(row), static_cast<lxw_col_t>(column), cell.flag ? 1 : 0, format);
            } else if (cell.kind == CellKind::Formula) {
                worksheet_write_formula(worksheet, static_cast<lxw_row_t>(row), static_cast<lxw_col_t>(column), NormalizedFormula(cell.text).c_str(), format);
            }
        }
    }
    const lxw_error error = workbook_close(workbook);
    if (error != LXW_NO_ERROR) {
        DeleteFileW(temp);
        return Fail(L"libxlsxwriter 保存失败（错误码 " + std::to_wstring(static_cast<int>(error)) + L"）。");
    }
    if (!MoveFileExW(temp, targetPath.c_str(), MOVEFILE_REPLACE_EXISTING)) {
        const DWORD code = GetLastError();
        DeleteFileW(temp);
        return Fail(L"写出 .xlsx 文件失败（Windows 错误码 " + std::to_wstring(code) + L"），请检查目标路径是否被占用。");
    }
    return true;
}

// ---------- 打开模式工具 ----------

bool OpenWorksheet(OpenDoc& doc, XLWorksheet& sheet) {
    try {
        sheet = doc.doc->workbook().worksheet(doc.currentSheet);
        return true;
    } catch (const std::exception& error) {
        return Fail(L"打开工作表失败：" + Utf8ToWide(error.what()));
    }
}

std::string CellTextOf(const XLCellValueProxy& value) {
    switch (value.type()) {
        case XLValueType::String: return value.get<std::string>();
        case XLValueType::Integer: return std::to_string(value.get<long long>());
        case XLValueType::Float: return FormatDouble(value.get<double>());
        case XLValueType::Boolean: return value.get<bool>() ? "真" : "假";
        default: return std::string();
    }
}

// ---------- 区域读写 ----------

int SplitRow(const std::wstring& rowText, const std::wstring& delimiter, std::vector<std::wstring>& tokens) {
    tokens.clear();
    if (delimiter.empty()) return -1;
    size_t start = 0;
    while (true) {
        const size_t position = rowText.find(delimiter, start);
        if (position == std::wstring::npos) {
            tokens.push_back(rowText.substr(start));
            break;
        }
        tokens.push_back(rowText.substr(start, position - start));
        start = position + delimiter.size();
    }
    return static_cast<int>(tokens.size());
}

} // namespace

// ============================================================================
// 导出函数（excelBridge.def 固定导出名）
// ============================================================================

extern "C" {

const char* LBExcel_Version() {
    return ReturnText("LingBuilderExcel 1.0.0 (libxlsxwriter 1.2.3, OpenXLSX 0.5.1)");
}

const char* LBExcel_LastError() {
    return LastErrorUtf8();
}

long long LBExcel_Create(const char* pathUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (!pathUtf8 || !pathUtf8[0]) { Fail("创建工作簿需要提供 .xlsx 文件路径。"); return 0; }
    const std::wstring path = Utf8ToWide(pathUtf8);
    if (_wcsicmp(path.substr(path.size() > 5 ? path.size() - 5 : 0).c_str(), L".xlsx") != 0) {
        Fail(L"Excel 工作簿路径必须使用 .xlsx 扩展名。");
        return 0;
    }
    WorkbookEntry entry;
    entry.createMode = true;
    entry.createDoc = std::make_shared<CreateDoc>();
    entry.createDoc->savePath = path;
    SheetModel first;
    first.name = L"Sheet1";
    entry.createDoc->sheets.push_back(std::move(first));
    entry.createDoc->current = 0;
    const long long handle = g_nextHandle.fetch_add(1);
    g_workbooks.emplace(handle, std::move(entry));
    return handle;
}

long long LBExcel_Open(const char* pathUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (!pathUtf8 || !pathUtf8[0]) { Fail("打开工作簿需要提供 .xlsx 文件路径。"); return 0; }
    const std::wstring path = Utf8ToWide(pathUtf8);
    if (GetFileAttributesW(path.c_str()) == INVALID_FILE_ATTRIBUTES) {
        Fail(L"要打开的 .xlsx 文件不存在。");
        return 0;
    }
    std::unique_ptr<XLDocument> document = std::make_unique<XLDocument>();
    try {
        document->open(WideToUtf8(path));
    } catch (const std::exception& error) {
        Fail(L"打开 .xlsx 文件失败：" + Utf8ToWide(error.what()));
        return 0;
    }
    if (document->workbook().worksheetCount() < 1) {
        Fail(L"文件里没有任何工作表。");
        return 0;
    }
    WorkbookEntry entry;
    entry.createMode = false;
    entry.openDoc = std::make_shared<OpenDoc>();
    entry.openDoc->savePath = path;
    entry.openDoc->doc = std::move(document);
    entry.openDoc->currentSheet = entry.openDoc->doc->workbook().worksheet(static_cast<uint16_t>(1)).name();
    const long long handle = g_nextHandle.fetch_add(1);
    g_workbooks.emplace(handle, std::move(entry));
    return handle;
}

int LBExcel_Save(long long handle) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (entry->createMode) return SaveCreateDoc(*entry->createDoc, entry->createDoc->savePath) ? 1 : 0;
    try {
        entry->openDoc->doc->save();
        return 1;
    } catch (const std::exception& error) {
        Fail(L"保存 .xlsx 文件失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_SaveAs(long long handle, const char* pathUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!pathUtf8 || !pathUtf8[0]) return Fail("另存为需要提供 .xlsx 文件路径。") ? 0 : 0;
    const std::wstring path = Utf8ToWide(pathUtf8);
    if (_wcsicmp(path.substr(path.size() > 5 ? path.size() - 5 : 0).c_str(), L".xlsx") != 0) {
        return Fail(L"Excel 工作簿路径必须使用 .xlsx 扩展名。") ? 0 : 0;
    }
    if (entry->createMode) {
        if (!SaveCreateDoc(*entry->createDoc, path)) return 0;
        entry->createDoc->savePath = path;
        return 1;
    }
    try {
        entry->openDoc->doc->saveAs(WideToUtf8(path), XLForceOverwrite);
        entry->openDoc->savePath = path;
        return 1;
    } catch (const std::exception& error) {
        Fail(L"另存 .xlsx 文件失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_Close(long long handle) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const auto found = g_workbooks.find(handle);
    if (found == g_workbooks.end()) return Fail("工作簿句柄无效。") ? 0 : 0;
    g_workbooks.erase(found);
    return 1;
}

// ---------- 工作表 ----------

int LBExcel_SheetCount(long long handle) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (entry->createMode) return static_cast<int>(entry->createDoc->sheets.size());
    return static_cast<int>(entry->openDoc->doc->workbook().worksheetCount());
}

const char* LBExcel_SheetName(long long handle, int index) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    if (entry->createMode) {
        if (index < 1 || index > static_cast<int>(entry->createDoc->sheets.size())) {
            Fail(L"工作表序号超出范围。");
            return ReturnText("");
        }
        return ReturnText(WideToUtf8(entry->createDoc->sheets[static_cast<size_t>(index - 1)].name));
    }
    try {
        return ReturnText(entry->openDoc->doc->workbook().worksheet(static_cast<uint16_t>(index)).name());
    } catch (const std::exception& error) {
        Fail(L"读取工作表名称失败：" + Utf8ToWide(error.what()));
        return ReturnText("");
    }
}

const char* LBExcel_CurrentSheet(long long handle) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        return sheet ? ReturnText(WideToUtf8(sheet->name)) : ReturnText("");
    }
    return ReturnText(entry->openDoc->currentSheet);
}

int LBExcel_SelectSheet(long long handle, const char* nameUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    const std::wstring name = Utf8ToWide(nameUtf8 ? nameUtf8 : "");
    if (entry->createMode) {
        for (size_t index = 0; index < entry->createDoc->sheets.size(); ++index) {
            if (entry->createDoc->sheets[index].name == name) {
                entry->createDoc->current = static_cast<int>(index);
                return 1;
            }
        }
        return Fail(L"找不到工作表：" + name + L"。") ? 0 : 0;
    }
    try {
        entry->openDoc->doc->workbook().worksheet(WideToUtf8(name)); // 校验存在性
        entry->openDoc->currentSheet = WideToUtf8(name);
        return 1;
    } catch (const std::exception&) {
        return Fail(L"找不到工作表：" + name + L"。") ? 0 : 0;
    }
}

int LBExcel_AddSheet(long long handle, const char* nameUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    const std::wstring name = Utf8ToWide(nameUtf8 ? nameUtf8 : "");
    if (name.empty()) return Fail("工作表名称不能为空。") ? 0 : 0;
    if (entry->createMode) {
        CreateDoc& doc = *entry->createDoc;
        for (const SheetModel& sheet : doc.sheets) {
            if (sheet.name == name) return Fail(L"已存在同名工作表：" + name + L"。") ? 0 : 0;
        }
        SheetModel sheet;
        sheet.name = name;
        doc.sheets.push_back(std::move(sheet));
        return 1;
    }
    try {
        entry->openDoc->doc->workbook().addWorksheet(WideToUtf8(name));
        return 1;
    } catch (const std::exception& error) {
        Fail(L"添加工作表失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_RemoveSheet(long long handle, const char* nameUtf8) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    const std::wstring name = Utf8ToWide(nameUtf8 ? nameUtf8 : "");
    if (entry->createMode) {
        CreateDoc& doc = *entry->createDoc;
        if (doc.sheets.size() <= 1) return Fail("工作簿至少要保留一个工作表。") ? 0 : 0;
        for (size_t index = 0; index < doc.sheets.size(); ++index) {
            if (doc.sheets[index].name != name) continue;
            doc.sheets.erase(doc.sheets.begin() + static_cast<long long>(index));
            if (doc.current >= static_cast<int>(doc.sheets.size())) doc.current = static_cast<int>(doc.sheets.size()) - 1;
            else if (doc.current > static_cast<int>(index)) --doc.current;
            return 1;
        }
        return Fail(L"找不到工作表：" + name + L"。") ? 0 : 0;
    }
    try {
        if (entry->openDoc->doc->workbook().worksheetCount() <= 1) return Fail("工作簿至少要保留一个工作表。") ? 0 : 0;
        const bool removingCurrent = entry->openDoc->currentSheet == WideToUtf8(name);
        entry->openDoc->doc->workbook().deleteSheet(WideToUtf8(name));
        if (removingCurrent) entry->openDoc->currentSheet = entry->openDoc->doc->workbook().worksheet(static_cast<uint16_t>(1)).name();
        return 1;
    } catch (const std::exception& error) {
        Fail(L"删除工作表失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

// ---------- 单元格写入 ----------

int LBExcel_WriteText(long long handle, const char* cell, const char* value) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        CellValue& target = sheet->EnsureCell(row, column);
        target.kind = CellKind::Text;
        target.text = Utf8ToWide(value ? value : "");
        target.number = 0;
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1))).value() = std::string(value ? value : "");
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_WriteNumber(long long handle, const char* cell, double value) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        CellValue& target = sheet->EnsureCell(row, column);
        target.kind = CellKind::Number;
        target.number = value;
        target.text.clear();
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1))).value() = value;
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_WriteBool(long long handle, const char* cell, int value) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        CellValue& target = sheet->EnsureCell(row, column);
        target.kind = CellKind::Bool;
        target.flag = value != 0;
        target.number = value != 0 ? 1 : 0;
        target.text.clear();
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1))).value() = (value != 0);
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_WriteFormula(long long handle, const char* cell, const char* formula) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    const std::wstring normalized = Utf8ToWide(NormalizedFormula(Utf8ToWide(formula ? formula : "")));
    if (normalized.empty()) return Fail("公式内容不能为空。") ? 0 : 0;
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        CellValue& target = sheet->EnsureCell(row, column);
        target.kind = CellKind::Formula;
        target.text = normalized;
        target.number = 0;
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        XLCellAssignable target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
        target.formula().set(WideToUtf8(normalized));
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入公式失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_WriteDateTime(long long handle, const char* cell, const char* isoText) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    double serial = 0;
    if (!ParseDateTimeToSerial(isoText ? isoText : "", serial)) {
        return Fail(L"日期时间格式无效，应形如 2026-01-31 或 2026-01-31 08:30:00。") ? 0 : 0;
    }
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        CellValue& target = sheet->EnsureCell(row, column);
        target.kind = CellKind::Number;
        target.number = serial;
        target.text.clear();
        target.fmt.numberFormat = HasTimeComponent(isoText) ? 4 : 5;
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1))).value() = serial;
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_ClearCell(long long handle, const char* cell) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        sheet->cells.erase({ row, column });
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1))).value() = std::string();
        return 1;
    } catch (const std::exception& error) {
        Fail(L"清除单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

// ---------- 单元格读取 ----------

int LBExcel_CellType(long long handle, const char* cell) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        const CellValue* value = sheet->FindCell(row, column);
        if (!value || value->kind == CellKind::Empty) return 0;
        if (value->kind == CellKind::Text) return 1;
        if (value->kind == CellKind::Number) return 2;
        if (value->kind == CellKind::Bool) return 3;
        return 4; // Formula
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        const XLCell& target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
        if (target.hasFormula()) return 4;
        switch (target.value().type()) {
            case XLValueType::String: return 1;
            case XLValueType::Integer:
            case XLValueType::Float: return 2;
            case XLValueType::Boolean: return 3;
            default: return 0;
        }
    } catch (const std::exception& error) {
        Fail(L"读取单元格失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_IsEmpty(long long handle, const char* cell) {
    const int type = LBExcel_CellType(handle, cell);
    if (type < 0) return 0;
    return type == 0 ? 1 : 0;
}

const char* LBExcel_ReadText(long long handle, const char* cell) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) {
        Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。");
        return ReturnText("");
    }
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) { Fail("没有当前工作表。"); return ReturnText(""); }
        const CellValue* value = sheet->FindCell(row, column);
        if (!value || value->kind == CellKind::Empty) return ReturnText("");
        if (value->kind == CellKind::Text || value->kind == CellKind::Formula) return ReturnText(WideToUtf8(value->text));
        if (value->kind == CellKind::Bool) return ReturnText(value->flag ? "真" : "假");
        return ReturnText(FormatDouble(value->number));
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return ReturnText("");
    try {
        const XLCell& target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
        if (target.hasFormula()) {
            // 公式单元格返回缓存的显示值（无缓存时返回空文本）。
            return ReturnText(CellTextOf(target.value()));
        }
        return ReturnText(CellTextOf(target.value()));
    } catch (const std::exception& error) {
        Fail(L"读取单元格失败：" + Utf8ToWide(error.what()));
        return ReturnText("");
    }
}

int LBExcel_ReadNumber(long long handle, const char* cell, double* out) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    double result = 0;
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        const CellValue* value = sheet->FindCell(row, column);
        if (!value || value->kind == CellKind::Empty) return Fail("单元格为空，没有数值。") ? 0 : 0;
        if (value->kind == CellKind::Number || value->kind == CellKind::Bool) result = value->number;
        else if (value->kind == CellKind::Formula) {
            if (!ParseNumberToken(value->text, result)) return Fail("公式单元格没有缓存数值。") ? 0 : 0;
        } else {
            if (!ParseNumberToken(value->text, result)) return Fail("单元格内容不是数值。") ? 0 : 0;
        }
    } else {
        XLWorksheet sheet;
        if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
        try {
            const XLCell& target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
            const XLCellValueProxy& value = target.value();
            if (value.type() == XLValueType::Integer) result = static_cast<double>(value.get<long long>());
            else if (value.type() == XLValueType::Float) result = value.get<double>();
            else if (value.type() == XLValueType::Boolean) result = value.get<bool>() ? 1.0 : 0.0;
            else return Fail("单元格内容不是数值。") ? 0 : 0;
        } catch (const std::exception& error) {
            Fail(L"读取单元格失败：" + Utf8ToWide(error.what()));
            return 0;
        }
    }
    if (out) *out = result;
    return 1;
}

const char* LBExcel_ReadFormula(long long handle, const char* cell) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) {
        Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。");
        return ReturnText("");
    }
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) { Fail("没有当前工作表。"); return ReturnText(""); }
        const CellValue* value = sheet->FindCell(row, column);
        if (!value || value->kind != CellKind::Formula) {
            Fail(L"该单元格不是公式。");
            return ReturnText("");
        }
        return ReturnText(WideToUtf8(value->text));
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return ReturnText("");
    try {
        const XLCell& target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
        if (!target.hasFormula()) {
            Fail(L"该单元格不是公式。");
            return ReturnText("");
        }
        std::string formula = target.formula().get();
        if (!formula.empty() && formula[0] == '=') formula.erase(formula.begin());
        return ReturnText(formula);
    } catch (const std::exception& error) {
        Fail(L"读取公式失败：" + Utf8ToWide(error.what()));
        return ReturnText("");
    }
}

// ---------- 批量行与区域 ----------

int LBExcel_WriteRow(long long handle, const char* startCell, const char* rowText, const char* delimiter) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(startCell ? startCell : "", row, column)) return Fail(L"起始单元格地址无效：" + Utf8ToWide(startCell ? startCell : "") + L"。") ? 0 : 0;
    std::vector<std::wstring> tokens;
    if (SplitRow(Utf8ToWide(rowText ? rowText : ""), Utf8ToWide(delimiter && delimiter[0] ? delimiter : "\t"), tokens) < 0) {
        return Fail("分隔符不能为空。") ? 0 : 0;
    }
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        for (size_t index = 0; index < tokens.size(); ++index) {
            const std::wstring& token = tokens[index];
            if (token.empty()) continue;
            CellValue& target = sheet->EnsureCell(row, column + static_cast<int>(index));
            double number = 0;
            if (ParseNumberToken(token, number)) {
                target.kind = CellKind::Number;
                target.number = number;
                target.text.clear();
            } else {
                target.kind = CellKind::Text;
                target.text = token;
                target.number = 0;
            }
        }
        return 1;
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        for (size_t index = 0; index < tokens.size(); ++index) {
            const std::wstring& token = tokens[index];
            if (token.empty()) continue;
            XLCellAssignable target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1 + index)));
            double number = 0;
            if (ParseNumberToken(token, number)) target.value() = number;
            else target.value() = WideToUtf8(token);
        }
        return 1;
    } catch (const std::exception& error) {
        Fail(L"写入行失败：" + Utf8ToWide(error.what()));
        return 0;
    }
}

int LBExcel_AppendRow(long long handle, const char* rowText, const char* delimiter) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    std::vector<std::wstring> tokens;
    if (SplitRow(Utf8ToWide(rowText ? rowText : ""), Utf8ToWide(delimiter && delimiter[0] ? delimiter : "\t"), tokens) < 0) {
        return Fail("分隔符不能为空。") ? 0 : 0;
    }
    if (entry->createMode) {
        SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
        const int nextRow = sheet->LastUsedRow() + 1;
        for (size_t index = 0; index < tokens.size(); ++index) {
            const std::wstring& token = tokens[index];
            if (token.empty()) continue;
            CellValue& target = sheet->EnsureCell(nextRow, static_cast<int>(index));
            double number = 0;
            if (ParseNumberToken(token, number)) {
                target.kind = CellKind::Number;
                target.number = number;
                target.text.clear();
            } else {
                target.kind = CellKind::Text;
                target.text = token;
                target.number = 0;
            }
        }
        return nextRow + 1; // 1 起行号
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return 0;
    try {
        const XLCellRange range = sheet.range();
        const uint32_t nextRow = range.bottomRight().row() + 1;
        for (size_t index = 0; index < tokens.size(); ++index) {
            const std::wstring& token = tokens[index];
            if (token.empty()) continue;
            XLCellAssignable target = sheet.cell(XLCellReference(nextRow, static_cast<uint16_t>(index + 1)));
            double number = 0;
            if (ParseNumberToken(token, number)) target.value() = number;
            else target.value() = WideToUtf8(token);
        }
        return static_cast<int>(nextRow);
    } catch (const std::exception& error) {
        Fail(L"追加行失败：" + Utf8ToWide(error.what()));
        return -1;
    }
}

const char* LBExcel_ReadRegion(long long handle, const char* range, const char* delimiter) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    int row1 = 0, col1 = 0, row2 = 0, col2 = 0;
    if (!ParseRange(range ? range : "", row1, col1, row2, col2)) {
        Fail(L"区域地址无效：" + Utf8ToWide(range ? range : "") + L"。");
        return ReturnText("");
    }
    if (row1 > row2) std::swap(row1, row2);
    if (col1 > col2) std::swap(col1, col2);
    if (row2 - row1 > 100000 || col2 - col1 > 4096) {
        Fail(L"读取区域过大（最多 100000 行 × 4096 列）。");
        return ReturnText("");
    }
    const std::wstring delimiterText = Utf8ToWide(delimiter && delimiter[0] ? delimiter : "\t");
    std::wstring output;
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) { Fail("没有当前工作表。"); return ReturnText(""); }
        for (int row = row1; row <= row2; ++row) {
            if (row > row1) output.push_back(L'\n');
            for (int column = col1; column <= col2; ++column) {
                if (column > col1) output += delimiterText;
                const CellValue* value = sheet->FindCell(row, column);
                if (!value || value->kind == CellKind::Empty) continue;
                if (value->kind == CellKind::Text || value->kind == CellKind::Formula) output += value->text;
                else if (value->kind == CellKind::Bool) output += value->flag ? L"真" : L"假";
                else output += Utf8ToWide(FormatDouble(value->number));
            }
        }
        return ReturnText(WideToUtf8(output));
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return ReturnText("");
    try {
        for (int row = row1; row <= row2; ++row) {
            if (row > row1) output.push_back(L'\n');
            for (int column = col1; column <= col2; ++column) {
                if (column > col1) output += delimiterText;
                const XLCell& target = sheet.cell(XLCellReference(static_cast<uint32_t>(row + 1), static_cast<uint16_t>(column + 1)));
                output += Utf8ToWide(CellTextOf(target.value()));
            }
        }
        return ReturnText(WideToUtf8(output));
    } catch (const std::exception& error) {
        Fail(L"读取区域失败：" + Utf8ToWide(error.what()));
        return ReturnText("");
    }
}

const char* LBExcel_UsedRange(long long handle) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    const WorkbookEntry* entry = Lookup(handle);
    if (!entry) { Fail("工作簿句柄无效。"); return ReturnText(""); }
    if (entry->createMode) {
        const SheetModel* sheet = entry->createDoc->Current();
        if (!sheet) { Fail("没有当前工作表。"); return ReturnText(""); }
        int lastRow = -1, lastColumn = -1;
        for (const auto& item : sheet->cells) {
            if (item.second.kind == CellKind::Empty) continue;
            if (item.first.first > lastRow) lastRow = item.first.first;
            if (item.first.second > lastColumn) lastColumn = item.first.second;
        }
        if (lastRow < 0 || lastColumn < 0) return ReturnText("");
        return ReturnText(WideToUtf8(MakeCellRef(0, 0) + L":" + MakeCellRef(lastRow, lastColumn)));
    }
    XLWorksheet sheet;
    if (!OpenWorksheet(*entry->openDoc, sheet)) return ReturnText("");
    try {
        const XLCellRange range = sheet.range();
        const XLCellReference upper = range.bottomRight();
        return ReturnText(WideToUtf8(MakeCellRef(0, 0) + L":" + MakeCellRef(static_cast<int>(upper.row()) - 1, static_cast<int>(upper.column()) - 1)));
    } catch (const std::exception& error) {
        Fail(L"读取已用区域失败：" + Utf8ToWide(error.what()));
        return ReturnText("");
    }
}

// ---------- 结构与格式（仅创建模式） ----------

int LBExcel_SetColumnWidth(long long handle, const char* column, double width) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持设置列宽；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    const int index = LettersToColumn(Utf8ToWide(column ? column : ""));
    if (index < 0 || index > 16383) return Fail(L"列标无效：" + Utf8ToWide(column ? column : "") + L"（应形如 A、B、AA）。") ? 0 : 0;
    if (!(width > 0) || width > 255) return Fail("列宽范围应为 0～255。") ? 0 : 0;
    sheet->colWidths[index] = width;
    return 1;
}

int LBExcel_SetRowHeight(long long handle, int row, double height) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持设置行高；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (row < 1 || row > 1048576) return Fail("行号范围应为 1～1048576。") ? 0 : 0;
    if (!(height > 0) || height > 409) return Fail("行高范围应为 0～409。") ? 0 : 0;
    sheet->rowHeights[row - 1] = height;
    return 1;
}

int LBExcel_MergeCells(long long handle, const char* range) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持合并单元格；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    int row1 = 0, col1 = 0, row2 = 0, col2 = 0;
    if (!ParseRange(range ? range : "", row1, col1, row2, col2)) return Fail(L"合并区域无效：" + Utf8ToWide(range ? range : "") + L"（应形如 A1:C3）。") ? 0 : 0;
    if (row1 > row2) std::swap(row1, row2);
    if (col1 > col2) std::swap(col1, col2);
    if (row1 == row2 && col1 == col2) return Fail("合并区域至少要包含两个单元格。") ? 0 : 0;
    Rect rect{ row1, col1, row2, col2 };
    sheet->merges.push_back(rect);
    return 1;
}

int LBExcel_FreezePanes(long long handle, int rows, int columns) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持冻结窗格；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (rows < 0 || columns < 0 || (rows == 0 && columns == 0)) return Fail("至少要冻结 1 行或 1 列。") ? 0 : 0;
    sheet->freezeRows = rows;
    sheet->freezeCols = columns;
    return 1;
}

struct FormatMutation {
    enum class Op { Bold, FontSize, FontColor, BackColor, Align, NumberFormat } op;
    int intValue = 0;
    double numberValue = 0;
};

void ApplyFormatMutation(CellFormat& fmt, const FormatMutation& mutation) {
    switch (mutation.op) {
        case FormatMutation::Op::Bold: fmt.bold = mutation.intValue != 0; break;
        case FormatMutation::Op::FontSize: fmt.hasFontSize = true; fmt.fontSize = mutation.numberValue; break;
        case FormatMutation::Op::FontColor: fmt.fontColor = mutation.intValue; break;
        case FormatMutation::Op::BackColor: fmt.backColor = mutation.intValue; break;
        case FormatMutation::Op::Align: fmt.align = mutation.intValue; break;
        case FormatMutation::Op::NumberFormat: fmt.numberFormat = mutation.intValue; break;
    }
}

int LBExcel_FormatCell(long long handle, const char* cell, const FormatMutation& mutation, const wchar_t* unsupported) {
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail(unsupported) ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    int row = 0, column = 0;
    if (!ParseCellRef(cell ? cell : "", row, column)) return Fail(L"单元格地址无效：" + Utf8ToWide(cell ? cell : "") + L"。") ? 0 : 0;
    CellValue& target = sheet->EnsureCell(row, column);
    ApplyFormatMutation(target.fmt, mutation);
    return 1;
}

int LBExcel_SetNumberFormat(long long handle, const char* cell, int formatIndex) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (formatIndex < 0 || formatIndex > 4) return Fail("数字格式索引应为 0～4（0=文本 1=整数 2=两位小数 3=百分比 4=日期时间）。") ? 0 : 0;
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::NumberFormat;
    mutation.intValue = formatIndex;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置数字格式；该能力仅创建模式提供。");
}

int LBExcel_SetBold(long long handle, const char* cell, int on) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::Bold;
    mutation.intValue = on;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置加粗；该能力仅创建模式提供。");
}

int LBExcel_SetFontSize(long long handle, const char* cell, double size) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (!(size >= 1) || size > 409) return Fail("字号范围应为 1～409。") ? 0 : 0;
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::FontSize;
    mutation.numberValue = size;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置字号；该能力仅创建模式提供。");
}

int LBExcel_SetFontColor(long long handle, const char* cell, int rgb) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (rgb < 0 || rgb > 0xFFFFFF) return Fail("颜色应使用 0xRRGGBB（0～16777215）。") ? 0 : 0;
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::FontColor;
    mutation.intValue = rgb;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置字体颜色；该能力仅创建模式提供。");
}

int LBExcel_SetBackColor(long long handle, const char* cell, int rgb) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (rgb < 0 || rgb > 0xFFFFFF) return Fail("颜色应使用 0xRRGGBB（0～16777215）。") ? 0 : 0;
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::BackColor;
    mutation.intValue = rgb;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置背景色；该能力仅创建模式提供。");
}

int LBExcel_SetAlign(long long handle, const char* cell, int align) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    if (align < 0 || align > 2) return Fail("对齐方式应为 0=左 1=中 2=右。") ? 0 : 0;
    FormatMutation mutation;
    mutation.op = FormatMutation::Op::Align;
    mutation.intValue = align;
    return LBExcel_FormatCell(handle, cell, mutation, L"打开模式暂不支持设置对齐；该能力仅创建模式提供。");
}

// ---------- 插入/删除行列（仅创建模式） ----------

int LBExcel_InsertRows(long long handle, int row, int count) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持插入行；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (row < 1 || count < 1 || count > 1048576 || row + count > 1048577) return Fail("插入行参数超出范围。") ? 0 : 0;
    std::map<std::pair<int, int>, CellValue> updated;
    for (const auto& item : sheet->cells) {
        int newRow = item.first.first;
        if (newRow >= row - 1) newRow += count;
        updated[{ newRow, item.first.second }] = item.second;
    }
    sheet->cells = std::move(updated);
    std::map<int, double> heights;
    for (const auto& item : sheet->rowHeights) heights[item.first >= row - 1 ? item.first + count : item.first] = item.second;
    sheet->rowHeights = std::move(heights);
    return 1;
}

int LBExcel_DeleteRows(long long handle, int row, int count) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持删除行；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (row < 1 || count < 1 || row + count - 1 > 1048576) return Fail("删除行参数超出范围。") ? 0 : 0;
    std::map<std::pair<int, int>, CellValue> updated;
    for (const auto& item : sheet->cells) {
        const int oldRow = item.first.first;
        if (oldRow >= row - 1 && oldRow < row - 1 + count) continue;
        const int newRow = oldRow >= row - 1 + count ? oldRow - count : oldRow;
        updated[{ newRow, item.first.second }] = item.second;
    }
    sheet->cells = std::move(updated);
    std::map<int, double> heights;
    for (const auto& item : sheet->rowHeights) {
        if (item.first >= row - 1 && item.first < row - 1 + count) continue;
        heights[item.first >= row - 1 + count ? item.first - count : item.first] = item.second;
    }
    sheet->rowHeights = std::move(heights);
    return 1;
}

int LBExcel_InsertCols(long long handle, int column, int count) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持插入列；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (column < 1 || count < 1 || count > 16384 || column + count > 16385) return Fail("插入列参数超出范围。") ? 0 : 0;
    std::map<std::pair<int, int>, CellValue> updated;
    for (const auto& item : sheet->cells) {
        int newColumn = item.first.second;
        if (newColumn >= column - 1) newColumn += count;
        updated[{ item.first.first, newColumn }] = item.second;
    }
    sheet->cells = std::move(updated);
    std::map<int, double> widths;
    for (const auto& item : sheet->colWidths) widths[item.first >= column - 1 ? item.first + count : item.first] = item.second;
    sheet->colWidths = std::move(widths);
    return 1;
}

int LBExcel_DeleteCols(long long handle, int column, int count) {
    std::lock_guard<std::mutex> guard(g_mutex);
    g_lastErrorWide.clear();
    WorkbookEntry* entry = Lookup(handle);
    if (!entry) return Fail("工作簿句柄无效。") ? 0 : 0;
    if (!entry->createMode) return Fail("打开模式暂不支持删除列；该能力仅创建模式提供。") ? 0 : 0;
    SheetModel* sheet = entry->createDoc->Current();
    if (!sheet) return Fail("没有当前工作表。") ? 0 : 0;
    if (column < 1 || count < 1 || column + count - 1 > 16384) return Fail("删除列参数超出范围。") ? 0 : 0;
    std::map<std::pair<int, int>, CellValue> updated;
    for (const auto& item : sheet->cells) {
        const int oldColumn = item.first.second;
        if (oldColumn >= column - 1 && oldColumn < column - 1 + count) continue;
        const int newColumn = oldColumn >= column - 1 + count ? oldColumn - count : oldColumn;
        updated[{ item.first.first, newColumn }] = item.second;
    }
    sheet->cells = std::move(updated);
    std::map<int, double> widths;
    for (const auto& item : sheet->colWidths) {
        if (item.first >= column - 1 && item.first < column - 1 + count) continue;
        widths[item.first >= column - 1 + count ? item.first - count : item.first] = item.second;
    }
    sheet->colWidths = std::move(widths);
    return 1;
}

// ---------- 日期换算 ----------

double LBExcel_DateToSerial(const char* isoText) {
    g_lastErrorWide.clear();
    double serial = 0;
    if (!ParseDateTimeToSerial(isoText ? isoText : "", serial)) {
        Fail(L"日期时间格式无效，应形如 2026-01-31 或 2026-01-31 08:30:00。");
        return -1;
    }
    return serial;
}

const char* LBExcel_SerialToDate(double serial) {
    g_lastErrorWide.clear();
    std::string iso;
    if (!SerialToDateTime(serial, iso)) {
        Fail("序列值范围应为 0～2958465（1900-01-01 ～ 9999-12-31）。");
        return ReturnText("");
    }
    return ReturnText(iso);
}

} // extern "C"
