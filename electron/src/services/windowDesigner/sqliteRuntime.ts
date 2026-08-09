export const SQLITE_RUNTIME = String.raw`
struct sqlite3;
struct sqlite3_stmt;
struct sqlite3_backup;

namespace LingBuilderSqlite {
constexpr int Ok = 0;
constexpr int Error = 1;
constexpr int Busy = 5;
constexpr int Locked = 6;
constexpr int Misuse = 21;
constexpr int Row = 100;
constexpr int Done = 101;
constexpr int Integer = 1;
constexpr int Float = 2;
constexpr int Text = 3;
constexpr int Blob = 4;
constexpr int Null = 5;
constexpr int OpenReadOnly = 0x00000001;
constexpr int OpenReadWrite = 0x00000002;
constexpr int OpenCreate = 0x00000004;
constexpr int OpenMemory = 0x00000080;
constexpr int OpenFullMutex = 0x00010000;
static void(*const Transient)(void*) = reinterpret_cast<void(*)(void*)>(-1);

using sqlite3_int64 = long long;
using FnOpenV2 = int(*)(const char*, sqlite3**, int, const char*);
using FnCloseV2 = int(*)(sqlite3*);
using FnExec = int(*)(sqlite3*, const char*, int(*)(void*, int, char**, char**), void*, char**);
using FnFree = void(*)(void*);
using FnErrmsg = const char*(*)(sqlite3*);
using FnErrcode = int(*)(sqlite3*);
using FnExtendedErrcode = int(*)(sqlite3*);
using FnExtendedResultCodes = int(*)(sqlite3*, int);
using FnSystemErrno = int(*)(sqlite3*);
using FnErrstr = const char*(*)(int);
using FnBusyTimeout = int(*)(sqlite3*, int);
using FnPrepareV2 = int(*)(sqlite3*, const char*, int, sqlite3_stmt**, const char**);
using FnStep = int(*)(sqlite3_stmt*);
using FnReset = int(*)(sqlite3_stmt*);
using FnClearBindings = int(*)(sqlite3_stmt*);
using FnFinalize = int(*)(sqlite3_stmt*);
using FnStmtReadonly = int(*)(sqlite3_stmt*);
using FnBindParameterCount = int(*)(sqlite3_stmt*);
using FnBindParameterIndex = int(*)(sqlite3_stmt*, const char*);
using FnBindNull = int(*)(sqlite3_stmt*, int);
using FnBindInt = int(*)(sqlite3_stmt*, int, int);
using FnBindInt64 = int(*)(sqlite3_stmt*, int, sqlite3_int64);
using FnBindDouble = int(*)(sqlite3_stmt*, int, double);
using FnBindText = int(*)(sqlite3_stmt*, int, const char*, int, void(*)(void*));
using FnBindBlob = int(*)(sqlite3_stmt*, int, const void*, int, void(*)(void*));
using FnBindBlob64 = int(*)(sqlite3_stmt*, int, const void*, unsigned long long, void(*)(void*));
using FnColumnCount = int(*)(sqlite3_stmt*);
using FnColumnName = const char*(*)(sqlite3_stmt*, int);
using FnColumnType = int(*)(sqlite3_stmt*, int);
using FnColumnInt = int(*)(sqlite3_stmt*, int);
using FnColumnInt64 = sqlite3_int64(*)(sqlite3_stmt*, int);
using FnColumnDouble = double(*)(sqlite3_stmt*, int);
using FnColumnText = const unsigned char*(*)(sqlite3_stmt*, int);
using FnColumnBlob = const void*(*)(sqlite3_stmt*, int);
using FnColumnBytes = int(*)(sqlite3_stmt*, int);
using FnChanges = int(*)(sqlite3*);
using FnChanges64 = sqlite3_int64(*)(sqlite3*);
using FnTotalChanges = int(*)(sqlite3*);
using FnTotalChanges64 = sqlite3_int64(*)(sqlite3*);
using FnLastInsertRowid = sqlite3_int64(*)(sqlite3*);
using FnGetAutocommit = int(*)(sqlite3*);
using FnInterrupt = void(*)(sqlite3*);
using FnBackupInit = sqlite3_backup*(*)(sqlite3*, const char*, sqlite3*, const char*);
using FnBackupStep = int(*)(sqlite3_backup*, int);
using FnBackupFinish = int(*)(sqlite3_backup*);
using FnWalAutocheckpoint = int(*)(sqlite3*, int);
using FnWalCheckpointV2 = int(*)(sqlite3*, const char*, int, int*, int*);
using FnDbReadonly = int(*)(sqlite3*, const char*);
using FnLibversion = const char*(*)();
using FnThreadsafe = int(*)();

static HMODULE module = nullptr;
static std::mutex moduleMutex;
static std::mutex registryMutex;
static std::atomic<long long> nextConnectionId{1};
static std::atomic<long long> nextStatementId{1};
static long long defaultConnectionId = 0;
static thread_local std::wstring lastError;
static thread_local int lastErrorCode = 0;
static thread_local int lastExtendedErrorCode = 0;
static thread_local int lastSystemErrorCode = 0;
static thread_local int lastWalLogFrames = 0;
static thread_local int lastWalCheckpointedFrames = 0;

#define LB_SQLITE_FUNCTIONS(X) \
    X(open_v2, FnOpenV2) X(close_v2, FnCloseV2) X(exec, FnExec) X(free, FnFree) \
    X(errmsg, FnErrmsg) X(errcode, FnErrcode) X(extended_errcode, FnExtendedErrcode) \
    X(extended_result_codes, FnExtendedResultCodes) X(busy_timeout, FnBusyTimeout) \
    X(prepare_v2, FnPrepareV2) X(step, FnStep) X(reset, FnReset) X(clear_bindings, FnClearBindings) \
    X(finalize, FnFinalize) X(stmt_readonly, FnStmtReadonly) X(bind_parameter_count, FnBindParameterCount) \
    X(bind_parameter_index, FnBindParameterIndex) X(bind_null, FnBindNull) X(bind_int, FnBindInt) \
    X(bind_int64, FnBindInt64) X(bind_double, FnBindDouble) X(bind_text, FnBindText) X(bind_blob, FnBindBlob) \
    X(column_count, FnColumnCount) X(column_name, FnColumnName) X(column_type, FnColumnType) X(column_int, FnColumnInt) \
    X(column_int64, FnColumnInt64) X(column_double, FnColumnDouble) X(column_text, FnColumnText) \
    X(column_blob, FnColumnBlob) X(column_bytes, FnColumnBytes) X(changes, FnChanges) X(total_changes, FnTotalChanges) \
    X(last_insert_rowid, FnLastInsertRowid) X(get_autocommit, FnGetAutocommit) X(interrupt, FnInterrupt) \
    X(backup_init, FnBackupInit) X(backup_step, FnBackupStep) X(backup_finish, FnBackupFinish) \
    X(wal_autocheckpoint, FnWalAutocheckpoint) X(wal_checkpoint_v2, FnWalCheckpointV2) X(db_readonly, FnDbReadonly) \
    X(libversion, FnLibversion) X(threadsafe, FnThreadsafe)

#define LB_SQLITE_DECLARE(name, type) static type name = nullptr;
LB_SQLITE_FUNCTIONS(LB_SQLITE_DECLARE)
#undef LB_SQLITE_DECLARE

static FnChanges64 changes64 = nullptr;
static FnTotalChanges64 total_changes64 = nullptr;
static FnBindBlob64 bind_blob64 = nullptr;
static FnSystemErrno system_errno = nullptr;
static FnErrstr errstr = nullptr;

struct Connection {
    long long id = 0;
    sqlite3* database = nullptr;
    std::recursive_mutex mutex;
};

struct Statement {
    long long id = 0;
    sqlite3_stmt* statement = nullptr;
    std::shared_ptr<Connection> connection;
    bool hasRow = false;
};

static std::unordered_map<long long, std::shared_ptr<Connection>> connections;
static std::unordered_map<long long, std::shared_ptr<Statement>> statements;

static void ClearError() {
    lastError.clear();
    lastErrorCode = 0;
    lastExtendedErrorCode = 0;
    lastSystemErrorCode = 0;
}

static bool Fail(const std::wstring& operation, const std::wstring& detail, int code = Error, int extended = 0, int system = 0) {
    lastErrorCode = code;
    lastExtendedErrorCode = extended ? extended : code;
    lastSystemErrorCode = system;
    lastError = operation + L"失败";
    if (!detail.empty()) lastError += L"：" + detail;
    lastError += L"（错误码 " + std::to_wstring(lastErrorCode);
    if (lastExtendedErrorCode != lastErrorCode) lastError += L"，扩展错误码 " + std::to_wstring(lastExtendedErrorCode);
    if (lastSystemErrorCode) lastError += L"，系统错误码 " + std::to_wstring(lastSystemErrorCode);
    lastError += L"）";
    return false;
}

static bool FailDatabase(const wchar_t* operation, sqlite3* database, int result) {
    const int code = database && errcode ? errcode(database) : result;
    const int extended = database && extended_errcode ? extended_errcode(database) : result;
    const int system = database && system_errno ? system_errno(database) : 0;
    const char* message = database && errmsg ? errmsg(database) : nullptr;
    return Fail(operation, message ? LB_Utf8ToWide(message) : L"SQLite 未提供错误详情", code, extended, system);
}

static void ResetFunctions() {
#define LB_SQLITE_RESET(name, type) name = nullptr;
    LB_SQLITE_FUNCTIONS(LB_SQLITE_RESET)
#undef LB_SQLITE_RESET
    changes64 = nullptr;
    total_changes64 = nullptr;
    bind_blob64 = nullptr;
    system_errno = nullptr;
    errstr = nullptr;
}

static bool HasActiveResources() {
    return !connections.empty() || !statements.empty();
}

static void UnloadLibraryUnlocked() {
    if (module) FreeLibrary(module);
    module = nullptr;
    ResetFunctions();
}

static bool LoadLibraryUnlocked(const wchar_t* path) {
    if (module) return true;
    module = LoadLibraryW(path && path[0] ? path : L"sqlite3.dll");
    if (!module) return Fail(L"加载 SQLite 运行库", L"无法加载 sqlite3.dll，请提供与目标架构一致的官方运行库", Error, Error, static_cast<int>(GetLastError()));
    bool valid = true;
#define LB_SQLITE_LOAD_REQUIRED(name, type) name = reinterpret_cast<type>(GetProcAddress(module, "sqlite3_" #name)); valid = valid && name;
    LB_SQLITE_FUNCTIONS(LB_SQLITE_LOAD_REQUIRED)
#undef LB_SQLITE_LOAD_REQUIRED
    changes64 = reinterpret_cast<FnChanges64>(GetProcAddress(module, "sqlite3_changes64"));
    total_changes64 = reinterpret_cast<FnTotalChanges64>(GetProcAddress(module, "sqlite3_total_changes64"));
    bind_blob64 = reinterpret_cast<FnBindBlob64>(GetProcAddress(module, "sqlite3_bind_blob64"));
    system_errno = reinterpret_cast<FnSystemErrno>(GetProcAddress(module, "sqlite3_system_errno"));
    errstr = reinterpret_cast<FnErrstr>(GetProcAddress(module, "sqlite3_errstr"));
    if (!valid) {
        UnloadLibraryUnlocked();
        return Fail(L"加载 SQLite 运行库", L"运行库缺少模块 2.0 所需的标准 SQLite 导出，请升级官方 sqlite3.dll");
    }
    ClearError();
    return true;
}

static std::shared_ptr<Connection> FindConnection(long long id, const wchar_t* operation) {
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = connections.find(id);
    if (id <= 0 || found == connections.end()) {
        Fail(operation, L"SQLite 连接无效或已经关闭", Misuse);
        return {};
    }
    return found->second;
}

static std::shared_ptr<Statement> FindStatement(long long id, const wchar_t* operation) {
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = statements.find(id);
    if (id <= 0 || found == statements.end()) {
        Fail(operation, L"SQLite 语句无效或已经释放", Misuse);
        return {};
    }
    return found->second;
}

static bool EnsureLive(const std::shared_ptr<Connection>& connectionValue, const wchar_t* operation) {
    return connectionValue && connectionValue->database
        ? true
        : Fail(operation, L"SQLite 连接已关闭", Misuse);
}

static bool EnsureLive(const std::shared_ptr<Statement>& statementValue, const wchar_t* operation) {
    return statementValue && statementValue->statement && statementValue->connection && statementValue->connection->database
        ? true
        : Fail(operation, L"SQLite 语句所属连接已关闭", Misuse);
}

static bool ExecuteLocked(const std::shared_ptr<Connection>& connectionValue, const wchar_t* operation, const std::wstring& sql) {
    char* errorMessage = nullptr;
    const std::string utf8Sql = LB_WideToUtf8(sql.c_str());
    const int result = exec(connectionValue->database, utf8Sql.c_str(), nullptr, nullptr, &errorMessage);
    if (result != Ok) {
        const std::wstring detail = errorMessage ? LB_Utf8ToWide(errorMessage) : L"";
        if (errorMessage) free(errorMessage);
        if (!detail.empty()) {
            const int code = errcode(connectionValue->database);
            const int extended = extended_errcode(connectionValue->database);
            const int system = system_errno ? system_errno(connectionValue->database) : 0;
            return Fail(operation, detail, code, extended, system);
        }
        return FailDatabase(operation, connectionValue->database, result);
    }
    ClearError();
    return true;
}

static std::wstring QuoteIdentifier(const wchar_t* value) {
    std::wstring input = LB_Wide(value);
    if (input.empty() || input.size() > 255) return {};
    std::wstring output = L"\"";
    for (wchar_t character : input) {
        if (character == L'\0' || character == L'\r' || character == L'\n') return {};
        if (character == L'\"') output += L"\"\"";
        else output.push_back(character);
    }
    output += L"\"";
    return output;
}

static long long OpenConnection(const wchar_t* path, int mode, int waitMilliseconds) {
    std::unique_lock<std::mutex> registryLock(registryMutex);
    std::lock_guard<std::mutex> moduleLock(moduleMutex);
    if (!LoadLibraryUnlocked(L"")) return 0;
    if (waitMilliseconds < 0 || waitMilliseconds > 600000) {
        Fail(L"打开 SQLite 连接", L"忙等待毫秒必须在 0 到 600000 之间", Misuse);
        return 0;
    }
    int flags = OpenFullMutex;
    std::wstring normalizedPath = LB_Wide(path);
    switch (mode) {
        case 0: flags |= OpenReadWrite | OpenCreate; break;
        case 1: flags |= OpenReadOnly; break;
        case 2: flags |= OpenReadWrite; break;
        case 3: flags |= OpenReadWrite | OpenCreate | OpenMemory; normalizedPath = L":memory:"; break;
        default: Fail(L"打开 SQLite 连接", L"打开模式必须为 0、1、2 或 3", Misuse); return 0;
    }
    if (normalizedPath.empty()) {
        Fail(L"打开 SQLite 连接", L"数据库路径不能为空", Misuse);
        return 0;
    }
    sqlite3* database = nullptr;
    const std::string utf8Path = LB_WideToUtf8(normalizedPath.c_str());
    const int result = open_v2(utf8Path.c_str(), &database, flags, nullptr);
    if (result != Ok || !database) {
        FailDatabase(L"打开 SQLite 连接", database, result);
        if (database) close_v2(database);
        return 0;
    }
    extended_result_codes(database, 1);
    if (busy_timeout(database, waitMilliseconds) != Ok) {
        FailDatabase(L"设置 SQLite 忙等待", database, Error);
        close_v2(database);
        return 0;
    }
    auto connectionValue = std::make_shared<Connection>();
    connectionValue->id = nextConnectionId.fetch_add(1);
    connectionValue->database = database;
    if (!ExecuteLocked(connectionValue, L"启用 SQLite 外键", L"PRAGMA foreign_keys=ON")) {
        close_v2(database);
        return 0;
    }
    connections.emplace(connectionValue->id, connectionValue);
    ClearError();
    return connectionValue->id;
}

static bool CloseConnection(long long id) {
    std::unique_lock<std::mutex> registryLock(registryMutex);
    auto found = connections.find(id);
    if (id <= 0 || found == connections.end()) return Fail(L"关闭 SQLite 连接", L"连接无效或已经关闭", Misuse);
    const auto connectionValue = found->second;
    std::lock_guard<std::recursive_mutex> connectionLock(connectionValue->mutex);
    for (auto iterator = statements.begin(); iterator != statements.end();) {
        if (iterator->second->connection == connectionValue) {
            if (iterator->second->statement) finalize(iterator->second->statement);
            iterator->second->statement = nullptr;
            iterator = statements.erase(iterator);
        } else {
            ++iterator;
        }
    }
    const int result = connectionValue->database ? close_v2(connectionValue->database) : Ok;
    connectionValue->database = nullptr;
    connections.erase(found);
    if (defaultConnectionId == id) defaultConnectionId = 0;
    if (result != Ok) return Fail(L"关闭 SQLite 连接", L"sqlite3_close_v2 返回失败", result);
    ClearError();
    return true;
}

static bool BindResult(const std::shared_ptr<Statement>& statementValue, const wchar_t* operation, int result) {
    if (result == Ok) {
        ClearError();
        return true;
    }
    return FailDatabase(operation, statementValue->connection->database, result);
}

static bool ValidateColumn(const std::shared_ptr<Statement>& statementValue, int index, const wchar_t* operation) {
    if (!statementValue->hasRow) return Fail(operation, L"当前语句没有可读取的结果行，请先确认 SQLite_语句步进 返回 1", Misuse);
    if (index < 0 || index >= column_count(statementValue->statement)) return Fail(operation, L"结果列索引越界", Misuse);
    return true;
}
}

bool SQLite_加载运行库(const wchar_t* path) {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> registryLock(registryMutex);
    std::lock_guard<std::mutex> moduleLock(moduleMutex);
    if (HasActiveResources()) return Fail(L"加载 SQLite 运行库", L"存在活动连接，必须先关闭全部连接", Misuse);
    UnloadLibraryUnlocked();
    return LoadLibraryUnlocked(path);
}

bool SQLite_卸载运行库() {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> registryLock(registryMutex);
    std::lock_guard<std::mutex> moduleLock(moduleMutex);
    if (HasActiveResources()) return Fail(L"卸载 SQLite 运行库", L"存在活动连接或语句", Misuse);
    UnloadLibraryUnlocked();
    ClearError();
    return true;
}

const wchar_t* SQLite_取运行库版本() {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (!LoadLibraryUnlocked(L"")) return LB_ReturnText(L"");
    return LB_ReturnText(LB_Utf8ToWide(libversion()));
}

bool SQLite_运行库线程安全() {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(moduleMutex);
    return LoadLibraryUnlocked(L"") && threadsafe() != 0;
}

long long SQLite_打开连接(const wchar_t* path, int mode, int waitMilliseconds) {
    return LingBuilderSqlite::OpenConnection(path, mode, waitMilliseconds);
}

long long SQLite_打开内存库(const wchar_t*) {
    return LingBuilderSqlite::OpenConnection(L":memory:", 3, 5000);
}

bool SQLite_打开(const wchar_t* path) {
    using namespace LingBuilderSqlite;
    long long previous = 0;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        previous = defaultConnectionId;
    }
    if (previous && !CloseConnection(previous)) return false;
    const long long opened = OpenConnection(path, 0, 5000);
    if (!opened) return false;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        defaultConnectionId = opened;
    }
    return true;
}

bool SQLite_关闭连接(long long connectionId) {
    return LingBuilderSqlite::CloseConnection(connectionId);
}

void SQLite_关闭全部() {
    using namespace LingBuilderSqlite;
    std::unique_lock<std::mutex> registryLock(registryMutex);
    for (auto& item : statements) {
        const auto& statementValue = item.second;
        if (statementValue->connection) {
            std::lock_guard<std::recursive_mutex> connectionLock(statementValue->connection->mutex);
            if (statementValue->statement) finalize(statementValue->statement);
        }
        statementValue->statement = nullptr;
    }
    statements.clear();
    for (auto& item : connections) {
        const auto& connectionValue = item.second;
        std::lock_guard<std::recursive_mutex> connectionLock(connectionValue->mutex);
        if (connectionValue->database) close_v2(connectionValue->database);
        connectionValue->database = nullptr;
    }
    connections.clear();
    defaultConnectionId = 0;
    registryLock.unlock();
    std::lock_guard<std::mutex> moduleLock(moduleMutex);
    UnloadLibraryUnlocked();
    ClearError();
}

void SQLite_关闭() {
    using namespace LingBuilderSqlite;
    long long current = 0;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        current = defaultConnectionId;
    }
    if (current) CloseConnection(current);
    std::lock_guard<std::mutex> registryLock(registryMutex);
    if (!HasActiveResources()) {
        std::lock_guard<std::mutex> moduleLock(moduleMutex);
        UnloadLibraryUnlocked();
    }
}

bool SQLite_连接是否有效(long long connectionId) {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(registryMutex);
    const auto found = connections.find(connectionId);
    return found != connections.end() && found->second->database != nullptr;
}

bool SQLite_连接是否只读(long long connectionId) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"读取 SQLite 只读状态");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 SQLite 只读状态")) return false;
    const int result = db_readonly(connectionValue->database, "main");
    if (result < 0) return FailDatabase(L"读取 SQLite 只读状态", connectionValue->database, result);
    ClearError();
    return result == 1;
}

bool SQLite_连接是否在事务中(long long connectionId) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"读取 SQLite 事务状态");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 SQLite 事务状态")) return false;
    ClearError();
    return get_autocommit(connectionValue->database) == 0;
}

bool SQLite_设置忙等待(long long connectionId, int milliseconds) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"设置 SQLite 忙等待");
    if (!connectionValue) return false;
    if (milliseconds < 0 || milliseconds > 600000) return Fail(L"设置 SQLite 忙等待", L"毫秒必须在 0 到 600000 之间", Misuse);
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"设置 SQLite 忙等待")) return false;
    const int result = busy_timeout(connectionValue->database, milliseconds);
    return result == Ok ? (ClearError(), true) : FailDatabase(L"设置 SQLite 忙等待", connectionValue->database, result);
}

bool SQLite_执行于(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"执行 SQLite SQL");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"执行 SQLite SQL")) return false;
    return ExecuteLocked(connectionValue, L"执行 SQLite SQL", LB_Wide(sql));
}

bool SQLite_执行(const wchar_t* sql) {
    using namespace LingBuilderSqlite;
    long long current = 0;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        current = defaultConnectionId;
    }
    return current ? SQLite_执行于(current, sql) : Fail(L"执行 SQLite SQL", L"默认连接尚未打开", Misuse);
}

bool SQLite_设置外键(long long connectionId, bool enabled) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"设置 SQLite 外键");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"设置 SQLite 外键")) return false;
    if (get_autocommit(connectionValue->database) == 0) return Fail(L"设置 SQLite 外键", L"事务或保存点活动期间不能修改 foreign_keys", Misuse);
    return ExecuteLocked(connectionValue, L"设置 SQLite 外键", enabled ? L"PRAGMA foreign_keys=ON" : L"PRAGMA foreign_keys=OFF");
}

bool SQLite_设置同步模式(long long connectionId, int mode) {
    static const wchar_t* values[] = { L"OFF", L"NORMAL", L"FULL", L"EXTRA" };
    if (mode < 0 || mode > 3) return LingBuilderSqlite::Fail(L"设置 SQLite 同步模式", L"模式必须为 0 到 3", LingBuilderSqlite::Misuse);
    return SQLite_执行于(connectionId, (std::wstring(L"PRAGMA synchronous=") + values[mode]).c_str());
}

const wchar_t* SQLite_查询首值于(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"查询 SQLite 首值");
    if (!connectionValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"查询 SQLite 首值")) return LB_ReturnText(L"");
    const std::string query = LB_WideToUtf8(sql);
    sqlite3_stmt* rawStatement = nullptr;
    const int prepareResult = prepare_v2(connectionValue->database, query.c_str(), -1, &rawStatement, nullptr);
    if (prepareResult != Ok || !rawStatement) {
        FailDatabase(L"查询 SQLite 首值", connectionValue->database, prepareResult);
        return LB_ReturnText(L"");
    }
    std::wstring value;
    const int stepResult = step(rawStatement);
    if (stepResult == Row) {
        const unsigned char* textValue = column_text(rawStatement, 0);
        const int byteCount = column_bytes(rawStatement, 0);
        if (textValue && byteCount > 0) value = LB_Utf8ToWide(std::string(reinterpret_cast<const char*>(textValue), static_cast<size_t>(byteCount)));
        ClearError();
    } else if (stepResult == Done) {
        ClearError();
    } else {
        FailDatabase(L"查询 SQLite 首值", connectionValue->database, stepResult);
    }
    finalize(rawStatement);
    return LB_ReturnText(std::move(value));
}

const wchar_t* SQLite_查询首值(const wchar_t* sql) {
    using namespace LingBuilderSqlite;
    long long current = 0;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        current = defaultConnectionId;
    }
    if (!current) {
        Fail(L"查询 SQLite 首值", L"默认连接尚未打开", Misuse);
        return LB_ReturnText(L"");
    }
    return SQLite_查询首值于(current, sql);
}

long long SQLite_准备(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderSqlite;
    std::unique_lock<std::mutex> registryLock(registryMutex);
    auto found = connections.find(connectionId);
    if (connectionId <= 0 || found == connections.end()) {
        Fail(L"准备 SQLite 语句", L"SQLite 连接无效或已经关闭", Misuse);
        return 0;
    }
    const auto connectionValue = found->second;
    std::lock_guard<std::recursive_mutex> connectionLock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"准备 SQLite 语句")) return 0;
    const std::string query = LB_WideToUtf8(sql);
    if (query.empty()) {
        Fail(L"准备 SQLite 语句", L"SQL 不能为空", Misuse);
        return 0;
    }
    sqlite3_stmt* rawStatement = nullptr;
    const char* tail = nullptr;
    const int result = prepare_v2(connectionValue->database, query.c_str(), -1, &rawStatement, &tail);
    if (result != Ok || !rawStatement) {
        FailDatabase(L"准备 SQLite 语句", connectionValue->database, result);
        if (rawStatement) finalize(rawStatement);
        return 0;
    }
    if (tail) {
        while (*tail && (std::isspace(static_cast<unsigned char>(*tail)) || *tail == ';')) ++tail;
        if (*tail) {
            finalize(rawStatement);
            Fail(L"准备 SQLite 语句", L"一次只能准备一条 SQL", Misuse);
            return 0;
        }
    }
    auto statementValue = std::make_shared<Statement>();
    statementValue->id = nextStatementId.fetch_add(1);
    statementValue->statement = rawStatement;
    statementValue->connection = connectionValue;
    statements.emplace(statementValue->id, statementValue);
    ClearError();
    return statementValue->id;
}

bool SQLite_语句是否有效(long long statementId) {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(registryMutex);
    const auto found = statements.find(statementId);
    return found != statements.end() && found->second->statement && found->second->connection && found->second->connection->database;
}

int SQLite_语句步进(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"步进 SQLite 语句");
    if (!statementValue) return -1;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"步进 SQLite 语句")) return -1;
    const int result = step(statementValue->statement);
    statementValue->hasRow = result == Row;
    if (result == Row) { ClearError(); return 1; }
    if (result == Done) { ClearError(); return 0; }
    FailDatabase(L"步进 SQLite 语句", statementValue->connection->database, result);
    return -1;
}

bool SQLite_语句重置(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"重置 SQLite 语句");
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"重置 SQLite 语句")) return false;
    statementValue->hasRow = false;
    return BindResult(statementValue, L"重置 SQLite 语句", reset(statementValue->statement));
}

bool SQLite_语句清空绑定(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"清空 SQLite 绑定");
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"清空 SQLite 绑定")) return false;
    return BindResult(statementValue, L"清空 SQLite 绑定", clear_bindings(statementValue->statement));
}

bool SQLite_语句释放(long long statementId) {
    using namespace LingBuilderSqlite;
    std::unique_lock<std::mutex> registryLock(registryMutex);
    auto found = statements.find(statementId);
    if (statementId <= 0 || found == statements.end()) return Fail(L"释放 SQLite 语句", L"语句无效或已经释放", Misuse);
    const auto statementValue = found->second;
    std::lock_guard<std::recursive_mutex> connectionLock(statementValue->connection->mutex);
    const int result = statementValue->statement ? finalize(statementValue->statement) : Ok;
    statementValue->statement = nullptr;
    statements.erase(found);
    if (result != Ok) return FailDatabase(L"释放 SQLite 语句", statementValue->connection->database, result);
    ClearError();
    return true;
}

bool SQLite_语句是否只读(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"读取 SQLite 语句属性");
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 SQLite 语句属性")) return false;
    ClearError();
    return stmt_readonly(statementValue->statement) != 0;
}

int SQLite_语句取参数数量(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"读取 SQLite 参数数量");
    if (!statementValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 SQLite 参数数量")) return 0;
    ClearError();
    return bind_parameter_count(statementValue->statement);
}

int SQLite_语句取参数索引(long long statementId, const wchar_t* name) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"读取 SQLite 参数索引");
    if (!statementValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 SQLite 参数索引")) return 0;
    const std::string utf8Name = LB_WideToUtf8(name);
    const int result = bind_parameter_index(statementValue->statement, utf8Name.c_str());
    if (!result) Fail(L"读取 SQLite 参数索引", L"没有找到指定命名参数", Misuse); else ClearError();
    return result;
}

#define LB_SQLITE_BIND_BEGIN(operation) \
    using namespace LingBuilderSqlite; \
    auto statementValue = FindStatement(statementId, operation); \
    if (!statementValue) return false; \
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex); \
    if (!EnsureLive(statementValue, operation)) return false

bool SQLite_绑定空值(long long statementId, int index) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite NULL");
    return BindResult(statementValue, L"绑定 SQLite NULL", bind_null(statementValue->statement, index));
}
bool SQLite_绑定整数(long long statementId, int index, int value) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite 整数");
    return BindResult(statementValue, L"绑定 SQLite 整数", bind_int(statementValue->statement, index, value));
}
bool SQLite_绑定长整数(long long statementId, int index, long long value) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite 长整数");
    return BindResult(statementValue, L"绑定 SQLite 长整数", bind_int64(statementValue->statement, index, value));
}
bool SQLite_绑定小数(long long statementId, int index, double value) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite 小数");
    return BindResult(statementValue, L"绑定 SQLite 小数", bind_double(statementValue->statement, index, value));
}
bool SQLite_绑定文本(long long statementId, int index, const wchar_t* value) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite 文本");
    const std::string utf8Value = LB_WideToUtf8(value);
    if (utf8Value.size() > static_cast<size_t>((std::numeric_limits<int>::max)())) return Fail(L"绑定 SQLite 文本", L"文本超过 SQLite 单值接口上限", Misuse);
    return BindResult(statementValue, L"绑定 SQLite 文本", bind_text(statementValue->statement, index, utf8Value.data(), static_cast<int>(utf8Value.size()), Transient));
}
bool SQLite_绑定字节集(long long statementId, int index, const std::vector<unsigned char>& value) {
    LB_SQLITE_BIND_BEGIN(L"绑定 SQLite 字节集");
    static const unsigned char emptyBlob = 0;
    const void* data = value.empty() ? static_cast<const void*>(&emptyBlob) : static_cast<const void*>(value.data());
    const int result = bind_blob64
        ? bind_blob64(statementValue->statement, index, data, static_cast<unsigned long long>(value.size()), Transient)
        : value.size() <= static_cast<size_t>((std::numeric_limits<int>::max)())
            ? bind_blob(statementValue->statement, index, data, static_cast<int>(value.size()), Transient)
            : Misuse;
    if (result == Misuse && !bind_blob64 && value.size() > static_cast<size_t>((std::numeric_limits<int>::max)())) return Fail(L"绑定 SQLite 字节集", L"运行库过旧，无法绑定超过 2 GB 的 BLOB", Misuse);
    return BindResult(statementValue, L"绑定 SQLite 字节集", result);
}
#undef LB_SQLITE_BIND_BEGIN

#define LB_SQLITE_COLUMN_BEGIN(operation, fallback) \
    using namespace LingBuilderSqlite; \
    auto statementValue = FindStatement(statementId, operation); \
    if (!statementValue) return fallback; \
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex); \
    if (!EnsureLive(statementValue, operation) || !ValidateColumn(statementValue, index, operation)) return fallback

int SQLite_取列数量(long long statementId) {
    using namespace LingBuilderSqlite;
    auto statementValue = FindStatement(statementId, L"读取 SQLite 列数量");
    if (!statementValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 SQLite 列数量")) return 0;
    ClearError();
    return column_count(statementValue->statement);
}
const wchar_t* SQLite_取列名称(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 列名", LB_ReturnText(L""));
    const char* value = column_name(statementValue->statement, index);
    ClearError();
    return LB_ReturnText(value ? LB_Utf8ToWide(value) : L"");
}
int SQLite_取列类型(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 列类型", 0);
    ClearError();
    return column_type(statementValue->statement, index);
}
bool SQLite_取列是否为空(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite NULL 状态", false);
    ClearError();
    return column_type(statementValue->statement, index) == Null;
}
int SQLite_取列整数(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 整数", 0);
    ClearError();
    return column_int(statementValue->statement, index);
}
long long SQLite_取列长整数(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 长整数", 0);
    ClearError();
    return column_int64(statementValue->statement, index);
}
double SQLite_取列小数(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 小数", 0.0);
    ClearError();
    return column_double(statementValue->statement, index);
}
const wchar_t* SQLite_取列文本(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 文本", LB_ReturnText(L""));
    const unsigned char* value = column_text(statementValue->statement, index);
    const int size = column_bytes(statementValue->statement, index);
    if (!value || size <= 0) { ClearError(); return LB_ReturnText(L""); }
    ClearError();
    return LB_ReturnText(LB_Utf8ToWide(std::string(reinterpret_cast<const char*>(value), static_cast<size_t>(size))));
}
std::vector<unsigned char> SQLite_取列字节集(long long statementId, int index) {
    LB_SQLITE_COLUMN_BEGIN(L"读取 SQLite 字节集", std::vector<unsigned char>{});
    const void* value = column_blob(statementValue->statement, index);
    const int size = column_bytes(statementValue->statement, index);
    if (!value || size <= 0) { ClearError(); return {}; }
    const auto* first = static_cast<const unsigned char*>(value);
    ClearError();
    return std::vector<unsigned char>(first, first + size);
}
#undef LB_SQLITE_COLUMN_BEGIN

bool SQLite_开始事务(long long connectionId, int mode) {
    static const wchar_t* modes[] = { L"BEGIN DEFERRED", L"BEGIN IMMEDIATE", L"BEGIN EXCLUSIVE" };
    if (mode < 0 || mode > 2) return LingBuilderSqlite::Fail(L"开始 SQLite 事务", L"模式必须为 0、1 或 2", LingBuilderSqlite::Misuse);
    return SQLite_执行于(connectionId, modes[mode]);
}
bool SQLite_提交事务(long long connectionId) { return SQLite_执行于(connectionId, L"COMMIT"); }
bool SQLite_回滚事务(long long connectionId) { return SQLite_执行于(connectionId, L"ROLLBACK"); }

static bool LB_SqliteSavepoint(long long connectionId, const wchar_t* operation, const wchar_t* keyword, const wchar_t* name) {
    const std::wstring quoted = LingBuilderSqlite::QuoteIdentifier(name);
    if (quoted.empty()) return LingBuilderSqlite::Fail(operation, L"保存点名称不能为空、不能包含换行且不能超过 255 个字符", LingBuilderSqlite::Misuse);
    return SQLite_执行于(connectionId, (std::wstring(keyword) + L" " + quoted).c_str());
}
bool SQLite_创建保存点(long long connectionId, const wchar_t* name) { return LB_SqliteSavepoint(connectionId, L"创建 SQLite 保存点", L"SAVEPOINT", name); }
bool SQLite_释放保存点(long long connectionId, const wchar_t* name) { return LB_SqliteSavepoint(connectionId, L"释放 SQLite 保存点", L"RELEASE SAVEPOINT", name); }
bool SQLite_回滚到保存点(long long connectionId, const wchar_t* name) { return LB_SqliteSavepoint(connectionId, L"回滚到 SQLite 保存点", L"ROLLBACK TO SAVEPOINT", name); }

bool SQLite_启用WAL(long long connectionId) {
    const std::wstring mode = SQLite_查询首值于(connectionId, L"PRAGMA journal_mode=WAL");
    if (_wcsicmp(mode.c_str(), L"wal") == 0) return true;
    return LingBuilderSqlite::Fail(L"启用 SQLite WAL", mode.empty() ? L"SQLite 未返回日志模式" : L"实际日志模式为 " + mode);
}

bool SQLite_设置WAL自动检查点(long long connectionId, int pages) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"设置 SQLite WAL 自动检查点");
    if (!connectionValue) return false;
    if (pages <= 0) return Fail(L"设置 SQLite WAL 自动检查点", L"页数必须大于 0", Misuse);
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"设置 SQLite WAL 自动检查点")) return false;
    const int result = wal_autocheckpoint(connectionValue->database, pages);
    return result == Ok ? (ClearError(), true) : FailDatabase(L"设置 SQLite WAL 自动检查点", connectionValue->database, result);
}

int SQLite_WAL检查点(long long connectionId, int mode) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"执行 SQLite WAL 检查点");
    if (!connectionValue) return -1;
    if (mode < 0 || mode > 3) { Fail(L"执行 SQLite WAL 检查点", L"模式必须为 0 到 3", Misuse); return -1; }
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"执行 SQLite WAL 检查点")) return -1;
    lastWalLogFrames = 0;
    lastWalCheckpointedFrames = 0;
    const int result = wal_checkpoint_v2(connectionValue->database, "main", mode, &lastWalLogFrames, &lastWalCheckpointedFrames);
    if (result == Ok) { ClearError(); return 0; }
    if ((result & 0xff) == Busy) { FailDatabase(L"执行 SQLite WAL 检查点", connectionValue->database, result); return 1; }
    FailDatabase(L"执行 SQLite WAL 检查点", connectionValue->database, result);
    return -1;
}
int SQLite_取WAL日志帧数() { return LingBuilderSqlite::lastWalLogFrames; }
int SQLite_取WAL已检查点帧数() { return LingBuilderSqlite::lastWalCheckpointedFrames; }

bool SQLite_备份到文件(long long connectionId, const wchar_t* targetPath, int maximumWaitMilliseconds) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"备份 SQLite 数据库");
    if (!connectionValue) return false;
    if (!targetPath || !targetPath[0]) return Fail(L"备份 SQLite 数据库", L"目标路径不能为空", Misuse);
    if (maximumWaitMilliseconds < 0 || maximumWaitMilliseconds > 600000) return Fail(L"备份 SQLite 数据库", L"忙等待毫秒必须在 0 到 600000 之间", Misuse);
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"备份 SQLite 数据库")) return false;
    sqlite3* target = nullptr;
    const std::string path = LB_WideToUtf8(targetPath);
    int result = open_v2(path.c_str(), &target, OpenReadWrite | OpenCreate | OpenFullMutex, nullptr);
    if (result != Ok || !target) {
        FailDatabase(L"打开 SQLite 备份目标", target, result);
        if (target) close_v2(target);
        return false;
    }
    sqlite3_backup* backup = backup_init(target, "main", connectionValue->database, "main");
    if (!backup) {
        FailDatabase(L"初始化 SQLite 备份", target, Error);
        close_v2(target);
        return false;
    }
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(maximumWaitMilliseconds);
    do {
        result = backup_step(backup, 128);
        if (result == Busy || result == Locked) {
            if (maximumWaitMilliseconds == 0 || std::chrono::steady_clock::now() >= deadline) break;
            Sleep(10);
        }
    } while (result == Ok || result == Busy || result == Locked);
    const int finishResult = backup_finish(backup);
    if (result == Done && finishResult == Ok) {
        close_v2(target);
        ClearError();
        return true;
    }
    FailDatabase(L"执行 SQLite 在线备份", target, result == Done ? finishResult : result);
    close_v2(target);
    return false;
}

const wchar_t* SQLite_完整性检查(long long connectionId, bool quick) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"检查 SQLite 完整性");
    if (!connectionValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"检查 SQLite 完整性")) return LB_ReturnText(L"");
    const char* sql = quick ? "PRAGMA quick_check" : "PRAGMA integrity_check";
    sqlite3_stmt* rawStatement = nullptr;
    int result = prepare_v2(connectionValue->database, sql, -1, &rawStatement, nullptr);
    if (result != Ok || !rawStatement) {
        FailDatabase(L"检查 SQLite 完整性", connectionValue->database, result);
        if (rawStatement) finalize(rawStatement);
        return LB_ReturnText(L"");
    }
    std::wstring report;
    while ((result = step(rawStatement)) == Row) {
        const unsigned char* value = column_text(rawStatement, 0);
        const int size = column_bytes(rawStatement, 0);
        if (!report.empty()) report += L"\n";
        if (value && size > 0) report += LB_Utf8ToWide(std::string(reinterpret_cast<const char*>(value), static_cast<size_t>(size)));
    }
    if (result != Done) FailDatabase(L"检查 SQLite 完整性", connectionValue->database, result); else ClearError();
    finalize(rawStatement);
    return LB_ReturnText(std::move(report));
}

bool SQLite_中断(long long connectionId) {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = connections.find(connectionId);
    if (found == connections.end() || !found->second->database) return Fail(L"中断 SQLite 执行", L"连接无效或已经关闭", Misuse);
    interrupt(found->second->database);
    ClearError();
    return true;
}

long long SQLite_取连接更改行数(long long connectionId) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"读取 SQLite 更改行数");
    if (!connectionValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 SQLite 更改行数")) return 0;
    ClearError();
    return changes64 ? changes64(connectionValue->database) : changes(connectionValue->database);
}

long long SQLite_取累计更改行数(long long connectionId) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"读取 SQLite 累计更改行数");
    if (!connectionValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 SQLite 累计更改行数")) return 0;
    ClearError();
    return total_changes64 ? total_changes64(connectionValue->database) : total_changes(connectionValue->database);
}

long long SQLite_取最后插入行号(long long connectionId) {
    using namespace LingBuilderSqlite;
    auto connectionValue = FindConnection(connectionId, L"读取 SQLite 最后插入行号");
    if (!connectionValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 SQLite 最后插入行号")) return 0;
    ClearError();
    return last_insert_rowid(connectionValue->database);
}

int SQLite_取更改行数() {
    using namespace LingBuilderSqlite;
    long long current = 0;
    {
        std::lock_guard<std::mutex> lock(registryMutex);
        current = defaultConnectionId;
    }
    const long long value = current ? SQLite_取连接更改行数(current) : 0;
    return value > (std::numeric_limits<int>::max)() ? (std::numeric_limits<int>::max)() : static_cast<int>(value);
}

const wchar_t* SQLite_取错误() { return LB_ReturnText(LingBuilderSqlite::lastError); }
int SQLite_取错误码() { return LingBuilderSqlite::lastErrorCode; }
int SQLite_取扩展错误码() { return LingBuilderSqlite::lastExtendedErrorCode; }
int SQLite_取系统错误码() { return LingBuilderSqlite::lastSystemErrorCode; }
const wchar_t* SQLite_错误码到文本(int code) {
    using namespace LingBuilderSqlite;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (!LoadLibraryUnlocked(L"")) return LB_ReturnText(L"");
    if (errstr) return LB_ReturnText(LB_Utf8ToWide(errstr(code)));
    return LB_ReturnText(L"SQLite 错误码 " + std::to_wstring(code));
}
`;
