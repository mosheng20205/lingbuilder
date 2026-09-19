import { TEXT_CODECS_RUNTIME } from './textCodecsRuntime';

/**
 * 表格数据源内核：CSV 记录级解析（引号内换行、双写引号、CRLF/CR/LF、自定义分隔符）
 * 与 `表格数据` 快照句柄注册表的唯一实现。
 *
 * 内核不在各模块运行时里重复拼接，统一由 generateSharedTableRuntime 按启用模块铺设一次；
 * 编码解码一律走 TEXT_CODECS_RUNTIME，不允许在别处再写一份 CSV 状态机或代码页映射。
 */
export const TABULAR_SOURCE_RUNTIME = `
#ifndef LB_TABULAR_SOURCE_RUNTIME_INCLUDED
#define LB_TABULAR_SOURCE_RUNTIME_INCLUDED

// 分隔符取首字符；空文本按半角逗号，支持制表符、分号、竖线和全角逗号。
static wchar_t LB_CsvDelimiter(const wchar_t* delimiter) {
    const std::wstring value = LB_Wide(delimiter);
    if (value.empty()) return L',';
    if (value == L"\\\\t" || value == L"\\t") return L'\\t';
    return value[0];
}

// 从 pos 起扫描一条记录；引号内的换行属于字段内容，不作为记录结束。
static bool LB_CsvScanRecord(const std::wstring& text, size_t& pos, wchar_t delimiter, std::vector<std::wstring>& fields, bool& sawQuoted) {
    fields.clear();
    sawQuoted = false;
    if (pos >= text.size()) return false;
    std::wstring current;
    bool quoted = false;
    while (pos < text.size()) {
        const wchar_t ch = text[pos];
        if (quoted) {
            if (ch == L'"') {
                if (pos + 1 < text.size() && text[pos + 1] == L'"') { current.push_back(L'"'); pos += 2; continue; }
                quoted = false; ++pos; continue;
            }
            current.push_back(ch); ++pos; continue;
        }
        if (ch == L'"' && current.empty()) { quoted = true; sawQuoted = true; ++pos; continue; }
        if (ch == delimiter) { fields.push_back(current); current.clear(); ++pos; continue; }
        if (ch == L'\\r' || ch == L'\\n') {
            if (ch == L'\\r' && pos + 1 < text.size() && text[pos + 1] == L'\\n') pos += 2;
            else ++pos;
            fields.push_back(current);
            return true;
        }
        current.push_back(ch); ++pos;
    }
    fields.push_back(current);
    return true;
}

// 跳过空行（无引号的单个空字段），返回下一条真实记录。
static bool LB_CsvNextRecord(const std::wstring& text, size_t& pos, wchar_t delimiter, std::vector<std::wstring>& fields) {
    bool sawQuoted = false;
    while (LB_CsvScanRecord(text, pos, delimiter, fields, sawQuoted)) {
        if (fields.size() == 1 && fields[0].empty() && !sawQuoted) continue;
        return true;
    }
    fields.clear();
    return false;
}

static std::vector<std::vector<std::wstring>> LB_CsvParseRecords(const std::wstring& text, wchar_t delimiter) {
    std::vector<std::vector<std::wstring>> records;
    size_t pos = 0;
    std::vector<std::wstring> fields;
    while (LB_CsvNextRecord(text, pos, delimiter, fields)) records.push_back(fields);
    return records;
}

// ---------- 表格数据快照句柄 ----------

struct LingBuilderTableSnapshot {
    long long id = 0;
    std::vector<std::wstring> headers;
    std::vector<std::vector<std::wstring>> rows;
    size_t columnCount = 0;
};

static std::unordered_map<long long, std::shared_ptr<LingBuilderTableSnapshot>> g_lbTableSnapshots;
static std::mutex g_lbTableMutex;
static std::atomic<long long> g_lbNextTableId{1};
static thread_local std::wstring g_lbTableError;

static void LB_TableFail(const std::wstring& message) { g_lbTableError = message; }

static std::shared_ptr<LingBuilderTableSnapshot> LB_FindTable(long long id) {
    if (id <= 0) { LB_TableFail(L"表格数据句柄无效（0），请先成功调用 CSV_打开文件 或 CSV_解析文本。"); return nullptr; }
    std::lock_guard<std::mutex> lock(g_lbTableMutex);
    const auto found = g_lbTableSnapshots.find(id);
    if (found == g_lbTableSnapshots.end()) {
        LB_TableFail(L"表格数据句柄 " + std::to_wstring(id) + L" 已关闭或从未创建。");
        return nullptr;
    }
    return found->second;
}

static std::wstring LB_TableColumnName(const LingBuilderTableSnapshot& table, size_t index) {
    if (index < table.headers.size() && !table.headers[index].empty()) return table.headers[index];
    return L"列" + std::to_wstring(index + 1);
}

// 表头行存在时以表头命名，缺名列与无表头时统一用 列N；列数取所有记录的最大宽度。
static long long LB_RegisterTable(std::vector<std::vector<std::wstring>> records, bool hasHeader) {
    if (records.empty()) {
        auto table = std::make_shared<LingBuilderTableSnapshot>();
        table->id = g_lbNextTableId++;
        std::lock_guard<std::mutex> lock(g_lbTableMutex);
        g_lbTableSnapshots[table->id] = table;
        return table->id;
    }
    size_t columnCount = 0;
    for (const auto& record : records) columnCount = (std::max)(columnCount, record.size());
    auto table = std::make_shared<LingBuilderTableSnapshot>();
    if (hasHeader) {
        table->headers = records.front();
        records.erase(records.begin());
        table->headers.resize(columnCount);
    }
    for (auto& record : records) record.resize(columnCount);
    table->columnCount = columnCount;
    table->rows = std::move(records);
    table->id = g_lbNextTableId++;
    std::lock_guard<std::mutex> lock(g_lbTableMutex);
    g_lbTableSnapshots[table->id] = table;
    return table->id;
}

static const std::wstring* LB_TableCell(const LingBuilderTableSnapshot& table, long long row, long long column) {
    if (row < 1 || static_cast<size_t>(row) > table.rows.size()) {
        LB_TableFail(L"行号 " + std::to_wstring(row) + L" 越界，有效范围 1～" + std::to_wstring(static_cast<long long>(table.rows.size())) + L"。");
        return nullptr;
    }
    if (column < 1 || static_cast<size_t>(column) > table.columnCount) {
        LB_TableFail(L"列号 " + std::to_wstring(column) + L" 越界，有效范围 1～" + std::to_wstring(static_cast<long long>(table.columnCount)) + L"。");
        return nullptr;
    }
    return &table.rows[static_cast<size_t>(row) - 1][static_cast<size_t>(column) - 1];
}

static bool LB_TableIntegerText(const std::wstring& value) {
    if (value.empty()) return false;
    size_t index = value[0] == L'-' || value[0] == L'+' ? 1 : 0;
    if (index >= value.size()) return false;
    for (; index < value.size(); ++index) if (!iswdigit(value[index])) return false;
    return true;
}

static bool LB_TableDecimalText(const std::wstring& value) {
    if (value.empty()) return false;
    bool seenDigit = false;
    bool seenDot = false;
    size_t index = value[0] == L'-' || value[0] == L'+' ? 1 : 0;
    for (; index < value.size(); ++index) {
        if (iswdigit(value[index])) { seenDigit = true; continue; }
        if (value[index] == L'.' && !seenDot) { seenDot = true; continue; }
        if ((value[index] == L'e' || value[index] == L'E') && seenDigit && index + 1 < value.size()) {
            size_t next = index + 1;
            if (value[next] == L'-' || value[next] == L'+') ++next;
            if (next < value.size() && iswdigit(value[next])) { index = next; continue; }
        }
        return false;
    }
    return seenDigit;
}

static bool LB_TableBooleanText(const std::wstring& value) {
    static const std::wstring trueForms[] = { L"TRUE", L"真", L"1", L"YES", L"是" };
    static const std::wstring falseForms[] = { L"FALSE", L"假", L"0", L"NO", L"否" };
    std::wstring upper;
    for (wchar_t ch : value) upper.push_back(static_cast<wchar_t>(towupper(ch)));
    for (const auto& form : trueForms) if (upper == form) return true;
    for (const auto& form : falseForms) if (upper == form) return true;
    return false;
}

#endif // LB_TABULAR_SOURCE_RUNTIME_INCLUDED
`;

/**
 * 表格快照命令层：只有启用 CSV 模块时铺设（内核由 generateSharedTableRuntime 统一提供）。
 * SQLite 虚拟表只消费 TABULAR_SOURCE_RUNTIME，不需要这层 .lcpp 入口。
 */
export const TABULAR_SNAPSHOT_COMMANDS = `
#ifndef LB_TABULAR_SNAPSHOT_COMMANDS_INCLUDED
#define LB_TABULAR_SNAPSHOT_COMMANDS_INCLUDED

const wchar_t* 数据表_取错误() { return LB_ReturnText(std::move(g_lbTableError)); }

long long CSV_打开文件(const wchar_t* path, const wchar_t* encoding = L"AUTO", const wchar_t* delimiter = L",", bool hasHeader = true) {
    g_lbTableError.clear();
    std::wstring text;
    std::wstring error;
    if (!LB_DecodeFileText(path, encoding, text, error)) { LB_TableFail(error); return 0; }
    return LB_RegisterTable(LB_CsvParseRecords(text, LB_CsvDelimiter(delimiter)), hasHeader);
}

long long CSV_解析文本(const wchar_t* text, const wchar_t* delimiter = L",", bool hasHeader = true) {
    g_lbTableError.clear();
    return LB_RegisterTable(LB_CsvParseRecords(LB_Wide(text), LB_CsvDelimiter(delimiter)), hasHeader);
}

int 数据表_行数(long long table) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    return snapshot ? static_cast<int>((std::min)(static_cast<size_t>(2147483647), snapshot->rows.size())) : 0;
}

int 数据表_列数(long long table) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    return snapshot ? static_cast<int>((std::min)(static_cast<size_t>(2147483647), snapshot->columnCount)) : 0;
}

const wchar_t* 数据表_列名(long long table, int index) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return LB_ReturnText(L"");
    if (index < 1 || static_cast<size_t>(index) > snapshot->columnCount) {
        LB_TableFail(L"列号 " + std::to_wstring(index) + L" 越界，有效范围 1～" + std::to_wstring(static_cast<long long>(snapshot->columnCount)) + L"。");
        return LB_ReturnText(L"");
    }
    return LB_ReturnText(LB_TableColumnName(*snapshot, static_cast<size_t>(index) - 1));
}

const wchar_t* 数据表_取文本(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return LB_ReturnText(L"");
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    return cell ? LB_ReturnText(*cell) : LB_ReturnText(L"");
}

// 0=空, 1=整数, 2=小数, 3=布尔, 4=文本；供建表和类型转换判定。
int 数据表_单元格类型(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return 0;
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    if (!cell) return 0;
    if (cell->empty()) return 0;
    if (LB_TableIntegerText(*cell)) return 1;
    if (LB_TableDecimalText(*cell)) return 2;
    if (LB_TableBooleanText(*cell)) return 3;
    return 4;
}

long long 数据表_取整数(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return 0;
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    if (!cell) return 0;
    try { return std::stoll(LB_WideToUtf8(cell->c_str())); }
    catch (...) { LB_TableFail(L"单元格(" + std::to_wstring(row) + L"," + std::to_wstring(column) + L") 不是整数：" + *cell); return 0; }
}

double 数据表_取小数(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return 0;
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    if (!cell) return 0;
    try { return std::stod(LB_WideToUtf8(cell->c_str())); }
    catch (...) { LB_TableFail(L"单元格(" + std::to_wstring(row) + L"," + std::to_wstring(column) + L") 不是小数：" + *cell); return 0; }
}

bool 数据表_取布尔(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return false;
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    if (!cell) return false;
    std::wstring upper;
    for (wchar_t ch : *cell) upper.push_back(static_cast<wchar_t>(towupper(ch)));
    return upper == L"TRUE" || upper == L"真" || upper == L"1" || upper == L"YES" || upper == L"是";
}

bool 数据表_单元格为空(long long table, int row, int column) {
    g_lbTableError.clear();
    const auto snapshot = LB_FindTable(table);
    if (!snapshot) return true;
    const std::wstring* cell = LB_TableCell(*snapshot, row, column);
    return !cell || cell->empty();
}

bool 数据表_关闭(long long table) {
    g_lbTableError.clear();
    if (table <= 0) { LB_TableFail(L"表格数据句柄无效（0），无需关闭。"); return false; }
    std::lock_guard<std::mutex> lock(g_lbTableMutex);
    return g_lbTableSnapshots.erase(table) > 0;
}

#endif // LB_TABULAR_SNAPSHOT_COMMANDS_INCLUDED
`;

/**
 * 共享内核铺设表：哪个模块用到哪段内核，只在这里登记一次。
 * 数组顺序即依赖顺序（编码内核必须先于表格内核）。
 */
const SHARED_TABLE_CHUNKS: Array<{ requires: string[]; code: string }> = [
  {
    requires: ['lingbuilder.std.encoding', 'lingbuilder.fs.core', 'lingbuilder.data.csv', 'lingbuilder.database.sqlite'],
    code: TEXT_CODECS_RUNTIME
  },
  {
    requires: ['lingbuilder.data.csv', 'lingbuilder.database.sqlite'],
    code: TABULAR_SOURCE_RUNTIME
  }
];

/** 返回启用模块需要的共享内核，每段在一个编译单元内只铺设一次；新增消费方只需登记到 SHARED_TABLE_CHUNKS。 */
export function generateSharedTableRuntime(enabledModuleIds: Iterable<string>): string {
  const enabled = new Set(enabledModuleIds);
  return SHARED_TABLE_CHUNKS.filter(chunk => chunk.requires.some(id => enabled.has(id))).map(chunk => chunk.code).join('\n');
}
