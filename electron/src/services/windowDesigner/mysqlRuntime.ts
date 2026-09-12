export const MYSQL_RUNTIME = String.raw`
namespace LingBuilderMysql {
constexpr int TypeLong = 3;
constexpr int TypeDouble = 5;
constexpr int TypeNull = 6;
constexpr int TypeLongLong = 8;
constexpr int TypeBlob = 252;
constexpr int TypeString = 254;
constexpr int FetchNoData = 100;
constexpr int OptConnectTimeout = 0;
constexpr int OptSetCharsetName = 7;
constexpr int OptReadTimeout = 11;
constexpr int OptWriteTimeout = 12;
constexpr int OptSslEnforce = 38;

struct MYSQL; struct MYSQL_STMT; struct MYSQL_RES;
typedef char LB_MyBool;
typedef long long LB_MyUlonglong;

struct LB_Field {
    char* name; char* orgName; char* table; char* orgTable; char* db; char* catalog; char* def;
    unsigned long length; unsigned long maxLength;
    unsigned int nameLength; unsigned int orgNameLength; unsigned int tableLength; unsigned int orgTableLength;
    unsigned int dbLength; unsigned int catalogLength; unsigned int defLength;
    unsigned int flags; unsigned int decimals; unsigned int charsetNr;
    int type; void* extension;
};

struct LB_Bind {
    unsigned long* length;
    LB_MyBool* isNull;
    void* buffer;
    LB_MyBool* error;
    union { unsigned char* rowPtr; char* indicator; } u;
    void (*storeParamFunc)(void*, void*);
    void (*fetchResult)(void*, void*, unsigned char**);
    void (*skipResult)(void*, void*, unsigned char**);
    unsigned long bufferLength;
    unsigned long offset;
    unsigned long lengthValue;
    unsigned int flags;
    unsigned int packLength;
    int bufferType;
    LB_MyBool errorValue;
    LB_MyBool isUnsigned;
    LB_MyBool longDataUsed;
    LB_MyBool isNullValue;
    void* extension;
};

#define LB_MYSQL_STDCALL __stdcall
using FnServerInit = int(LB_MYSQL_STDCALL*)(int, char**, char**);
using FnInit = MYSQL*(LB_MYSQL_STDCALL*)(MYSQL*);
using FnOptions = int(LB_MYSQL_STDCALL*)(MYSQL*, int, const void*);
using FnRealConnect = MYSQL*(LB_MYSQL_STDCALL*)(MYSQL*, const char*, const char*, const char*, const char*, unsigned, const char*, unsigned long);
using FnClose = void(LB_MYSQL_STDCALL*)(MYSQL*);
using FnErrno = unsigned int(LB_MYSQL_STDCALL*)(MYSQL*);
using FnError = const char*(LB_MYSQL_STDCALL*)(MYSQL*);
using FnGetServerInfo = const char*(LB_MYSQL_STDCALL*)(MYSQL*);
using FnGetClientInfo = const char*(LB_MYSQL_STDCALL*)();
using FnGetClientVersion = unsigned long(LB_MYSQL_STDCALL*)();
using FnSelectDb = int(LB_MYSQL_STDCALL*)(MYSQL*, const char*);
using FnSetCharacterSet = int(LB_MYSQL_STDCALL*)(MYSQL*, const char*);
using FnRealQuery = int(LB_MYSQL_STDCALL*)(MYSQL*, const char*, unsigned long);
using FnAffectedRows = LB_MyUlonglong(LB_MYSQL_STDCALL*)(MYSQL*);
using FnInsertId = LB_MyUlonglong(LB_MYSQL_STDCALL*)(MYSQL*);
using FnAutocommit = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL*, LB_MyBool);
using FnCommit = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL*);
using FnRollback = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL*);
using FnStoreResult = MYSQL_RES*(LB_MYSQL_STDCALL*)(MYSQL*);
using FnFreeResult = void(LB_MYSQL_STDCALL*)(MYSQL_RES*);
using FnFetchRow = char**(LB_MYSQL_STDCALL*)(MYSQL_RES*);
using FnFetchLengths = unsigned long*(LB_MYSQL_STDCALL*)(MYSQL_RES*);
using FnFetchFieldDirect = LB_Field*(LB_MYSQL_STDCALL*)(MYSQL_RES*, unsigned int);
using FnStmtInit = MYSQL_STMT*(LB_MYSQL_STDCALL*)(MYSQL*);
using FnStmtPrepare = int(LB_MYSQL_STDCALL*)(MYSQL_STMT*, const char*, unsigned long);
using FnStmtExecute = int(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtFetch = int(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtFetchColumn = int(LB_MYSQL_STDCALL*)(MYSQL_STMT*, LB_Bind*, unsigned int, unsigned long);
using FnStmtBindParam = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL_STMT*, LB_Bind*);
using FnStmtAffectedRows = LB_MyUlonglong(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtClose = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtReset = LB_MyBool(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtErrno = unsigned int(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtError = const char*(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtFieldCount = unsigned int(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtParamCount = unsigned long(LB_MYSQL_STDCALL*)(MYSQL_STMT*);
using FnStmtResultMetadata = MYSQL_RES*(LB_MYSQL_STDCALL*)(MYSQL_STMT*);

#define LB_MYSQL_FUNCTIONS(X) \
    X(server_init, FnServerInit) X(init, FnInit) X(options, FnOptions) X(real_connect, FnRealConnect) \
    X(close, FnClose) X(errno, FnErrno) X(error, FnError) X(get_server_info, FnGetServerInfo) \
    X(get_client_info, FnGetClientInfo) X(get_client_version, FnGetClientVersion) X(select_db, FnSelectDb) \
    X(set_character_set, FnSetCharacterSet) X(real_query, FnRealQuery) X(affected_rows, FnAffectedRows) \
    X(insert_id, FnInsertId) X(autocommit, FnAutocommit) X(commit, FnCommit) X(rollback, FnRollback) \
    X(store_result, FnStoreResult) X(free_result, FnFreeResult) X(fetch_row, FnFetchRow) \
    X(fetch_lengths, FnFetchLengths) X(fetch_field_direct, FnFetchFieldDirect) \
    X(stmt_init, FnStmtInit) X(stmt_prepare, FnStmtPrepare) X(stmt_execute, FnStmtExecute) \
    X(stmt_fetch, FnStmtFetch) X(stmt_fetch_column, FnStmtFetchColumn) X(stmt_bind_param, FnStmtBindParam) \
    X(stmt_close, FnStmtClose) X(stmt_reset, FnStmtReset) X(stmt_errno, FnStmtErrno) \
    X(stmt_affected_rows, FnStmtAffectedRows) \
    X(stmt_error, FnStmtError) X(stmt_field_count, FnStmtFieldCount) X(stmt_param_count, FnStmtParamCount) \
    X(stmt_result_metadata, FnStmtResultMetadata)

#define LB_MYSQL_DECLARE(name, type) static type fn_##name = nullptr;
LB_MYSQL_FUNCTIONS(LB_MYSQL_DECLARE)
#undef LB_MYSQL_DECLARE

static HMODULE module = nullptr;
static bool serverInitialized = false;
static std::mutex moduleMutex;
static std::mutex registryMutex;
static std::atomic<long long> nextConnectionId{1};
static std::atomic<long long> nextStatementId{1};
static thread_local std::wstring lastError;
static thread_local unsigned int lastErrorCode = 0;

struct Connection {
    long long id = 0;
    MYSQL* handle = nullptr;
    std::recursive_mutex mutex;
};

enum class ParamKind { Null = 0, Integer = TypeLong, LongInteger = TypeLongLong, Double = TypeDouble, Text = TypeString, Bytes = TypeBlob };

struct StatementParam {
    ParamKind kind = ParamKind::Null;
    char isNull = 1;
    unsigned long length = 0;
    long long integerValue = 0;
    double doubleValue = 0.0;
    std::string bytes;
};

struct Statement {
    long long id = 0;
    MYSQL_STMT* handle = nullptr;
    std::shared_ptr<Connection> connection;
    std::vector<LB_Bind> binds;
    std::vector<StatementParam> params;
    bool executedSinceChange = false;
    MYSQL_RES* metadata = nullptr;
};

static std::unordered_map<long long, std::shared_ptr<Connection>> connections;
static std::unordered_map<long long, std::shared_ptr<Statement>> statements;

static void ClearError() {
    lastError.clear();
    lastErrorCode = 0;
}

static bool Fail(const std::wstring& operation, const std::wstring& detail, unsigned int code) {
    lastErrorCode = code;
    lastError = operation + L"失败";
    if (!detail.empty()) lastError += L"：" + detail;
    if (code) lastError += L"（错误码 " + std::to_wstring(code) + L"）";
    return false;
}

static bool Fail(const std::wstring& operation, const std::wstring& detail) {
    return Fail(operation, detail, 0);
}

static bool FailServer(const wchar_t* operation, MYSQL* handle) {
    const unsigned int code = handle && fn_errno ? fn_errno(handle) : 0;
    const char* message = handle && fn_error ? fn_error(handle) : nullptr;
    return Fail(operation, message && message[0] ? LB_Utf8ToWide(message) : L"服务器未提供错误详情", code);
}

static bool FailStatement(const wchar_t* operation, MYSQL_STMT* handle) {
    const unsigned int code = handle && fn_stmt_errno ? fn_stmt_errno(handle) : 0;
    const char* message = handle && fn_stmt_error ? fn_stmt_error(handle) : nullptr;
    return Fail(operation, message && message[0] ? LB_Utf8ToWide(message) : L"服务器未提供错误详情", code);
}

static void ResetFunctions() {
#define LB_MYSQL_RESET(name, type) fn_##name = nullptr;
    LB_MYSQL_FUNCTIONS(LB_MYSQL_RESET)
#undef LB_MYSQL_RESET
}

static bool HasActiveResources() {
    return !connections.empty() || !statements.empty();
}

static void ReleaseStatementLocked(const std::shared_ptr<Statement>& statementValue) {
    if (statementValue->metadata) {
        fn_free_result(statementValue->metadata);
        statementValue->metadata = nullptr;
    }
    if (statementValue->handle) fn_stmt_close(statementValue->handle);
    statementValue->handle = nullptr;
}

static void UnloadLibraryUnlocked() {
    if (module) FreeLibrary(module);
    module = nullptr;
    serverInitialized = false;
    ResetFunctions();
}

static bool LoadLibraryUnlocked(const wchar_t* path) {
    if (module) return true;
    module = LoadLibraryW(path && path[0] ? path : L"libmariadb.dll");
    if (!module) return Fail(L"加载 MySQL 运行库", L"无法加载 libmariadb.dll，请确认随附运行库位于 exe 同目录或通过 MySQL_加载运行库 指定路径", static_cast<unsigned int>(GetLastError()));
    bool valid = true;
#define LB_MYSQL_LOAD_REQUIRED(name, type) fn_##name = reinterpret_cast<type>(GetProcAddress(module, "mysql_" #name)); valid = valid && fn_##name;
    LB_MYSQL_FUNCTIONS(LB_MYSQL_LOAD_REQUIRED)
#undef LB_MYSQL_LOAD_REQUIRED
    if (!valid) {
        UnloadLibraryUnlocked();
        return Fail(L"加载 MySQL 运行库", L"运行库缺少 MySQL 数据库模块 1.0 所需的标准 MariaDB Connector/C 导出，请使用随附运行库");
    }
    if (!serverInitialized) {
        if (fn_server_init(0, nullptr, nullptr) != 0) {
            UnloadLibraryUnlocked();
            return Fail(L"加载 MySQL 运行库", L"客户端库初始化失败");
        }
        serverInitialized = true;
    }
    ClearError();
    return true;
}

static std::shared_ptr<Connection> FindConnection(long long id, const wchar_t* operation) {
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = connections.find(id);
    if (id <= 0 || found == connections.end()) {
        Fail(operation, L"MySQL 连接无效或已经关闭");
        return {};
    }
    return found->second;
}

static std::shared_ptr<Statement> FindStatement(long long id, const wchar_t* operation) {
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = statements.find(id);
    if (id <= 0 || found == statements.end()) {
        Fail(operation, L"MySQL 语句无效或已经释放");
        return {};
    }
    return found->second;
}

static bool EnsureLive(const std::shared_ptr<Connection>& connectionValue, const wchar_t* operation) {
    return connectionValue && connectionValue->handle
        ? true
        : Fail(operation, L"MySQL 连接已关闭");
}

static bool EnsureLive(const std::shared_ptr<Statement>& statementValue, const wchar_t* operation) {
    return statementValue && statementValue->handle && statementValue->connection && statementValue->connection->handle
        ? true
        : Fail(operation, L"MySQL 语句所属连接已关闭");
}

static void RefreshBind(Statement& statementValue, size_t index) {
    StatementParam& param = statementValue.params[index];
    LB_Bind& bind = statementValue.binds[index];
    bind = LB_Bind{};
    switch (param.kind) {
        case ParamKind::Integer:
            bind.bufferType = TypeLong;
            bind.buffer = &param.integerValue;
            bind.isNull = &param.isNull;
            break;
        case ParamKind::LongInteger:
            bind.bufferType = TypeLongLong;
            bind.buffer = &param.integerValue;
            bind.isNull = &param.isNull;
            break;
        case ParamKind::Double:
            bind.bufferType = TypeDouble;
            bind.buffer = &param.doubleValue;
            bind.isNull = &param.isNull;
            break;
        case ParamKind::Text:
        case ParamKind::Bytes:
            bind.bufferType = static_cast<int>(param.kind);
            bind.buffer = param.bytes.empty() ? const_cast<char*>("") : &param.bytes[0];
            bind.bufferLength = static_cast<unsigned long>(param.bytes.size());
            bind.length = &param.length;
            bind.isNull = &param.isNull;
            break;
        default:
            bind.bufferType = TypeNull;
            break;
    }
    param.length = static_cast<unsigned long>(param.bytes.size());
}

static long long ExecuteStatementLocked(const std::shared_ptr<Statement>& statementValue, const wchar_t* operation) {
    if (fn_stmt_bind_param(statementValue->handle, statementValue->binds.empty() ? nullptr : statementValue->binds.data()) != 0) {
        FailStatement(operation, statementValue->handle);
        return -1;
    }
    if (fn_stmt_execute(statementValue->handle) != 0) {
        FailStatement(operation, statementValue->handle);
        return -1;
    }
    statementValue->executedSinceChange = true;
    ClearError();
    // SELECT 语句没有受影响行数，MariaDB 会返回 (my_ulonglong)-1；这不是失败，按 0 处理。
    const LB_MyUlonglong affected = fn_stmt_affected_rows(statementValue->handle);
    return affected == ~(LB_MyUlonglong)0 ? 0 : static_cast<long long>(affected);
}

static bool CloseConnection(long long id) {
    std::unique_lock<std::mutex> registryLock(registryMutex);
    auto found = connections.find(id);
    if (id <= 0 || found == connections.end()) return Fail(L"关闭 MySQL 连接", L"连接无效或已经关闭");
    const auto connectionValue = found->second;
    std::lock_guard<std::recursive_mutex> connectionLock(connectionValue->mutex);
    for (auto iterator = statements.begin(); iterator != statements.end();) {
        if (iterator->second->connection == connectionValue) {
            ReleaseStatementLocked(iterator->second);
            iterator = statements.erase(iterator);
        } else {
            ++iterator;
        }
    }
    if (connectionValue->handle) fn_close(connectionValue->handle);
    connectionValue->handle = nullptr;
    connections.erase(found);
    ClearError();
    return true;
}

static long long OpenConnection(const wchar_t* operation, const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database, int timeoutSeconds, bool enableSsl) {
    {
        std::lock_guard<std::mutex> lock(moduleMutex);
        if (!LoadLibraryUnlocked(L"")) {
            lastError = std::wstring(operation) + L"前" + lastError;
            return 0;
        }
    }
    if (port < 0 || port > 65535) {
        Fail(operation, L"端口必须在 0 到 65535 之间");
        return 0;
    }
    if (timeoutSeconds < 0 || timeoutSeconds > 86400) {
        Fail(operation, L"连接超时秒必须在 0 到 86400 之间");
        return 0;
    }
    MYSQL* raw = nullptr;
    {
        std::lock_guard<std::mutex> lock(moduleMutex);
        raw = fn_init(nullptr);
    }
    if (!raw) {
        Fail(operation, L"初始化 MySQL 客户端失败");
        return 0;
    }
    const std::string utf8Host = host && host[0] ? LB_WideToUtf8(host) : std::string("127.0.0.1");
    const std::string utf8User = user ? LB_WideToUtf8(user) : std::string();
    const std::string utf8Password = password ? LB_WideToUtf8(password) : std::string();
    const std::string utf8Database = database && database[0] ? LB_WideToUtf8(database) : std::string();
    const std::string charset = "utf8mb4";
    int result = fn_options(raw, OptSetCharsetName, charset.c_str());
    if (result == 0 && timeoutSeconds > 0) {
        const unsigned int seconds = static_cast<unsigned int>(timeoutSeconds);
        result = fn_options(raw, OptConnectTimeout, &seconds);
        if (result == 0) result = fn_options(raw, OptReadTimeout, &seconds);
        if (result == 0) result = fn_options(raw, OptWriteTimeout, &seconds);
    }
    if (result == 0 && enableSsl) {
        const unsigned int enforce = 1;
        result = fn_options(raw, OptSslEnforce, &enforce);
    }
    if (result != 0) {
        FailServer(operation, raw);
        fn_close(raw);
        return 0;
    }
    MYSQL* connected = fn_real_connect(raw, utf8Host.c_str(), utf8User.c_str(), utf8Password.c_str(),
        utf8Database.empty() ? nullptr : utf8Database.c_str(),
        static_cast<unsigned int>(port), nullptr, 0);
    if (!connected) {
        FailServer(operation, raw);
        fn_close(raw);
        return 0;
    }
    if (fn_set_character_set(connected, charset.c_str()) != 0) {
        FailServer(operation, connected);
        fn_close(connected);
        return 0;
    }
    const long long id = nextConnectionId++;
    std::lock_guard<std::mutex> lock(registryMutex);
    connections[id] = std::make_shared<Connection>();
    connections[id]->id = id;
    connections[id]->handle = connected;
    ClearError();
    return id;
}

static bool FetchColumnValue(const std::shared_ptr<Statement>& statementValue, int index, int bufferType, void* buffer, unsigned long bufferLength, unsigned long* lengthOut, char* nullOut, const wchar_t* operation) {
    LB_Bind bind;
    memset(&bind, 0, sizeof bind);
    char truncated = 0;
    bind.bufferType = bufferType;
    bind.buffer = buffer;
    bind.bufferLength = bufferLength;
    bind.length = lengthOut;
    bind.isNull = nullOut;
    bind.error = &truncated;
    if (fn_stmt_fetch_column(statementValue->handle, &bind, static_cast<unsigned int>(index), 0) != 0) {
        FailStatement(operation, statementValue->handle);
        return false;
    }
    return true;
}

static bool BeginColumnRead(const std::shared_ptr<Statement>& statementValue, int index, const wchar_t* operation) {
    if (!EnsureLive(statementValue, operation)) return false;
    if (index < 0 || static_cast<unsigned int>(index) >= fn_stmt_field_count(statementValue->handle)) {
        Fail(operation, L"列索引超出结果集范围");
        return false;
    }
    return true;
}

// stmt_result_metadata 返回的是语句内部字段数组的浅包装；必须让它在整个语句生命周期内存活，
// 否则释放后 stmt->fields 悬空，后续 mysql_stmt_fetch_column 会从已释放内存读取类型信息
//（实测数值列读回垃圾值且无任何错误）。缓存到语句上，仅在释放语句时释放。
static bool EnsureMetadata(const std::shared_ptr<Statement>& statementValue, MYSQL_RES** out, const wchar_t* operation) {
    if (!statementValue->metadata) {
        statementValue->metadata = fn_stmt_result_metadata(statementValue->handle);
        if (!statementValue->metadata) {
            FailStatement(operation, statementValue->handle);
            return false;
        }
    }
    *out = statementValue->metadata;
    return true;
}

static bool BeginParameterBind(const std::shared_ptr<Statement>& statementValue, int parameterIndex, ParamKind kind, const wchar_t* operation) {
    if (!EnsureLive(statementValue, operation)) return false;
    if (parameterIndex <= 0 || static_cast<size_t>(parameterIndex) > statementValue->params.size()) {
        std::wstring detail = L"参数索引超出范围，该语句共有 " + std::to_wstring(statementValue->params.size()) + L" 个参数";
        Fail(operation, detail);
        return false;
    }
    StatementParam& param = statementValue->params[static_cast<size_t>(parameterIndex) - 1];
    param = StatementParam{};
    param.kind = kind;
    param.isNull = 0;
    return true;
}
}

long long MySQL_连接(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database) {
    return LingBuilderMysql::OpenConnection(L"连接 MySQL 服务器", host, port, user, password, database, 0, false);
}

long long MySQL_连接扩展(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* database, int timeoutSeconds, bool enableSsl) {
    return LingBuilderMysql::OpenConnection(L"连接 MySQL 服务器", host, port, user, password, database, timeoutSeconds, enableSsl);
}

bool MySQL_加载运行库(const wchar_t* path) {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (module && HasActiveResources()) return Fail(L"加载 MySQL 运行库", L"存在活动连接或语句，不能切换运行库");
    if (module) UnloadLibraryUnlocked();
    if (!LoadLibraryUnlocked(path)) return false;
    return true;
}

bool MySQL_卸载运行库() {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (module) {
        std::lock_guard<std::mutex> registryLock(registryMutex);
        if (HasActiveResources()) return Fail(L"卸载 MySQL 运行库", L"存在活动连接或语句，请先全部关闭");
        UnloadLibraryUnlocked();
    }
    ClearError();
    return true;
}

const wchar_t* MySQL_取运行库版本() {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (!LoadLibraryUnlocked(L"")) return LB_ReturnText(L"");
    return LB_ReturnText(LB_Utf8ToWide(fn_get_client_info()));
}

int MySQL_取客户端版本() {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(moduleMutex);
    if (!LoadLibraryUnlocked(L"")) return 0;
    return static_cast<int>(fn_get_client_version());
}

bool MySQL_关闭连接(long long connectionId) {
    return LingBuilderMysql::CloseConnection(connectionId);
}

void MySQL_关闭全部() {
    using namespace LingBuilderMysql;
    std::unique_lock<std::mutex> registryLock(registryMutex);
    for (auto& item : statements) {
        const auto& statementValue = item.second;
        if (statementValue->connection) {
            std::lock_guard<std::recursive_mutex> connectionLock(statementValue->connection->mutex);
            ReleaseStatementLocked(statementValue);
        }
    }
    statements.clear();
    for (auto& item : connections) {
        const auto& connectionValue = item.second;
        std::lock_guard<std::recursive_mutex> connectionLock(connectionValue->mutex);
        if (connectionValue->handle) fn_close(connectionValue->handle);
        connectionValue->handle = nullptr;
    }
    connections.clear();
    ClearError();
}

bool MySQL_连接是否有效(long long connectionId) {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = connections.find(connectionId);
    if (found == connections.end()) return false;
    return found->second->handle != nullptr;
}

bool MySQL_切换数据库(long long connectionId, const wchar_t* database) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"切换 MySQL 数据库");
    if (!connectionValue) return false;
    if (!database || !database[0]) return Fail(L"切换 MySQL 数据库", L"数据库名不能为空");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"切换 MySQL 数据库")) return false;
    if (fn_select_db(connectionValue->handle, LB_WideToUtf8(database).c_str()) != 0) {
        return FailServer(L"切换 MySQL 数据库", connectionValue->handle);
    }
    ClearError();
    return true;
}

bool MySQL_设置字符集(long long connectionId, const wchar_t* charset) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"设置 MySQL 字符集");
    if (!connectionValue) return false;
    if (!charset || !charset[0]) return Fail(L"设置 MySQL 字符集", L"字符集不能为空");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"设置 MySQL 字符集")) return false;
    if (fn_set_character_set(connectionValue->handle, LB_WideToUtf8(charset).c_str()) != 0) {
        return FailServer(L"设置 MySQL 字符集", connectionValue->handle);
    }
    ClearError();
    return true;
}

const wchar_t* MySQL_取服务器信息(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"读取 MySQL 服务器信息");
    if (!connectionValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 MySQL 服务器信息")) return LB_ReturnText(L"");
    const char* info = fn_get_server_info(connectionValue->handle);
    ClearError();
    return info ? LB_ReturnText(LB_Utf8ToWide(info)) : LB_ReturnText(L"");
}

long long MySQL_执行(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"执行 MySQL 语句");
    if (!connectionValue) return -1;
    if (!sql || !sql[0]) {
        Fail(L"执行 MySQL 语句", L"SQL 语句不能为空");
        return -1;
    }
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"执行 MySQL 语句")) return -1;
    const std::string utf8Sql = LB_WideToUtf8(sql);
    if (fn_real_query(connectionValue->handle, utf8Sql.c_str(), static_cast<unsigned long>(utf8Sql.size())) != 0) {
        FailServer(L"执行 MySQL 语句", connectionValue->handle);
        return -1;
    }
    ClearError();
    return static_cast<long long>(fn_affected_rows(connectionValue->handle));
}

const wchar_t* MySQL_查询首值(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"MySQL 查询首值");
    if (!connectionValue) return LB_ReturnText(L"");
    if (!sql || !sql[0]) {
        Fail(L"MySQL 查询首值", L"SQL 语句不能为空");
        return LB_ReturnText(L"");
    }
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"MySQL 查询首值")) return LB_ReturnText(L"");
    const std::string utf8Sql = LB_WideToUtf8(sql);
    if (fn_real_query(connectionValue->handle, utf8Sql.c_str(), static_cast<unsigned long>(utf8Sql.size())) != 0) {
        FailServer(L"MySQL 查询首值", connectionValue->handle);
        return LB_ReturnText(L"");
    }
    MYSQL_RES* result = fn_store_result(connectionValue->handle);
    if (!result) {
        if (fn_errno(connectionValue->handle) != 0) {
            FailServer(L"MySQL 查询首值", connectionValue->handle);
            return LB_ReturnText(L"");
        }
        ClearError();
        return LB_ReturnText(L"");
    }
    std::wstring value;
    char** row = fn_fetch_row(result);
    unsigned long* lengths = row ? fn_fetch_lengths(result) : nullptr;
    if (row && row[0] && lengths) {
        value = LB_Utf8ToWide(std::string(row[0], static_cast<size_t>(lengths[0])));
    }
    fn_free_result(result);
    ClearError();
    return LB_ReturnText(std::move(value));
}

long long MySQL_取最后插入ID(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"读取 MySQL 最后插入 ID");
    if (!connectionValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 MySQL 最后插入 ID")) return 0;
    ClearError();
    return static_cast<long long>(fn_insert_id(connectionValue->handle));
}

long long MySQL_准备(long long connectionId, const wchar_t* sql) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"准备 MySQL 语句");
    if (!connectionValue) return 0;
    if (!sql || !sql[0]) {
        Fail(L"准备 MySQL 语句", L"SQL 语句不能为空");
        return 0;
    }
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"准备 MySQL 语句")) return 0;
    MYSQL_STMT* raw = fn_stmt_init(connectionValue->handle);
    if (!raw) {
        FailServer(L"准备 MySQL 语句", connectionValue->handle);
        return 0;
    }
    const std::string utf8Sql = LB_WideToUtf8(sql);
    if (fn_stmt_prepare(raw, utf8Sql.c_str(), static_cast<unsigned long>(utf8Sql.size())) != 0) {
        FailStatement(L"准备 MySQL 语句", raw);
        fn_stmt_close(raw);
        return 0;
    }
    const unsigned long parameterCount = fn_stmt_param_count(raw);
    const long long id = nextStatementId++;
    std::lock_guard<std::mutex> registryLock(registryMutex);
    auto statementValue = std::make_shared<Statement>();
    statementValue->id = id;
    statementValue->handle = raw;
    statementValue->connection = connectionValue;
    statementValue->binds.resize(parameterCount);
    statementValue->params.resize(parameterCount);
    statementValue->executedSinceChange = false;
    statements[id] = statementValue;
    ClearError();
    return id;
}

bool MySQL_语句是否有效(long long statementId) {
    using namespace LingBuilderMysql;
    std::lock_guard<std::mutex> lock(registryMutex);
    auto found = statements.find(statementId);
    if (found == statements.end()) return false;
    return found->second->handle != nullptr;
}

long long MySQL_语句执行(long long statementId) {
    using namespace LingBuilderMysql;
    auto statementValue = FindStatement(statementId, L"执行 MySQL 预编译语句");
    if (!statementValue) return -1;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"执行 MySQL 预编译语句")) return -1;
    return ExecuteStatementLocked(statementValue, L"执行 MySQL 预编译语句");
}

int MySQL_语句步进(long long statementId) {
    using namespace LingBuilderMysql;
    auto statementValue = FindStatement(statementId, L"读取 MySQL 结果行");
    if (!statementValue) return -1;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 MySQL 结果行")) return -1;
    if (!statementValue->executedSinceChange) {
        if (ExecuteStatementLocked(statementValue, L"读取 MySQL 结果行") < 0) return -1;
    }
    const int result = fn_stmt_fetch(statementValue->handle);
    if (result == 0) {
        ClearError();
        return 1;
    }
    if (result == FetchNoData) {
        ClearError();
        return 0;
    }
    FailStatement(L"读取 MySQL 结果行", statementValue->handle);
    return -1;
}

bool MySQL_语句重置(long long statementId) {
    using namespace LingBuilderMysql;
    auto statementValue = FindStatement(statementId, L"重置 MySQL 语句");
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"重置 MySQL 语句")) return false;
    if (fn_stmt_reset(statementValue->handle) != 0) {
        return FailStatement(L"重置 MySQL 语句", statementValue->handle);
    }
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_语句清空绑定(long long statementId) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"清空 MySQL 绑定";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, operation)) return false;
    for (size_t index = 0; index < statementValue->params.size(); ++index) {
        statementValue->params[index] = StatementParam{};
        RefreshBind(*statementValue, index);
    }
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_语句释放(long long statementId) {
    using namespace LingBuilderMysql;
    std::unique_lock<std::mutex> registryLock(registryMutex);
    auto found = statements.find(statementId);
    if (statementId <= 0 || found == statements.end()) return Fail(L"释放 MySQL 语句", L"语句无效或已经释放");
    const auto statementValue = found->second;
    std::lock_guard<std::recursive_mutex> connectionLock(statementValue->connection->mutex);
    ReleaseStatementLocked(statementValue);
    statements.erase(found);
    ClearError();
    return true;
}

bool MySQL_绑定空值(long long statementId, int parameterIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 空值";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::Null, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].isNull = 1;
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_绑定整数(long long statementId, int parameterIndex, int value) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 整数";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::Integer, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].integerValue = value;
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_绑定长整数(long long statementId, int parameterIndex, long long value) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 长整数";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::LongInteger, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].integerValue = value;
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_绑定小数(long long statementId, int parameterIndex, double value) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 小数";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::Double, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].doubleValue = value;
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_绑定文本(long long statementId, int parameterIndex, const wchar_t* text) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 文本";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::Text, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].bytes = text ? LB_WideToUtf8(text) : std::string();
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

bool MySQL_绑定字节集(long long statementId, int parameterIndex, const std::vector<unsigned char>& data) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"绑定 MySQL 字节集";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginParameterBind(statementValue, parameterIndex, ParamKind::Bytes, operation)) return false;
    statementValue->params[static_cast<size_t>(parameterIndex) - 1].bytes.assign(reinterpret_cast<const char*>(data.data()), data.size());
    RefreshBind(*statementValue, static_cast<size_t>(parameterIndex) - 1);
    statementValue->executedSinceChange = false;
    ClearError();
    return true;
}

int MySQL_取列数量(long long statementId) {
    using namespace LingBuilderMysql;
    auto statementValue = FindStatement(statementId, L"读取 MySQL 列数量");
    if (!statementValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 MySQL 列数量")) return 0;
    ClearError();
    return static_cast<int>(fn_stmt_field_count(statementValue->handle));
}

const wchar_t* MySQL_取列名称(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    auto statementValue = FindStatement(statementId, L"读取 MySQL 列名称");
    if (!statementValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!EnsureLive(statementValue, L"读取 MySQL 列名称")) return LB_ReturnText(L"");
    const unsigned int columnCount = fn_stmt_field_count(statementValue->handle);
    if (columnIndex < 0 || static_cast<unsigned int>(columnIndex) >= columnCount) {
        Fail(L"读取 MySQL 列名称", L"列索引超出结果集范围");
        return LB_ReturnText(L"");
    }
    MYSQL_RES* metadata = nullptr;
    if (!EnsureMetadata(statementValue, &metadata, L"读取 MySQL 列名称")) return LB_ReturnText(L"");
    LB_Field* field = fn_fetch_field_direct(metadata, static_cast<unsigned int>(columnIndex));
    std::wstring name = field && field->name ? LB_Utf8ToWide(field->name) : std::wstring();
    ClearError();
    return LB_ReturnText(std::move(name));
}

bool MySQL_取列是否为空(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"读取 MySQL 列空值";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return false;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginColumnRead(statementValue, columnIndex, operation)) return false;
    char buffer[sizeof(long long)] = {};
    unsigned long length = 0;
    char isNull = 0;
    if (!FetchColumnValue(statementValue, columnIndex, TypeLongLong, buffer, sizeof(buffer), &length, &isNull, operation)) return false;
    ClearError();
    return isNull != 0;
}

long long MySQL_取列长整数(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"读取 MySQL 整数列";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return 0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginColumnRead(statementValue, columnIndex, operation)) return 0;
    long long value = 0;
    unsigned long length = 0;
    char isNull = 0;
    if (!FetchColumnValue(statementValue, columnIndex, TypeLongLong, &value, sizeof(value), &length, &isNull, operation)) return 0;
    ClearError();
    return isNull ? 0 : value;
}

int MySQL_取列整数(long long statementId, int columnIndex) {
    return static_cast<int>(MySQL_取列长整数(statementId, columnIndex));
}

double MySQL_取列小数(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"读取 MySQL 小数列";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return 0.0;
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginColumnRead(statementValue, columnIndex, operation)) return 0.0;
    double value = 0.0;
    unsigned long length = 0;
    char isNull = 0;
    if (!FetchColumnValue(statementValue, columnIndex, TypeDouble, &value, sizeof(value), &length, &isNull, operation)) return 0.0;
    ClearError();
    return isNull ? 0.0 : value;
}

const wchar_t* MySQL_取列文本(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"读取 MySQL 文本列";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginColumnRead(statementValue, columnIndex, operation)) return LB_ReturnText(L"");
    unsigned long realLength = 0;
    char isNull = 0;
    if (!FetchColumnValue(statementValue, columnIndex, TypeString, nullptr, 0, &realLength, &isNull, operation)) return LB_ReturnText(L"");
    if (isNull) {
        ClearError();
        return LB_ReturnText(L"");
    }
    std::string buffer(realLength, '\0');
    if (realLength > 0) {
        if (!FetchColumnValue(statementValue, columnIndex, TypeString, &buffer[0], realLength, &realLength, &isNull, operation)) return LB_ReturnText(L"");
    }
    ClearError();
    return LB_ReturnText(LB_Utf8ToWide(buffer));
}

std::vector<unsigned char> MySQL_取列字节集(long long statementId, int columnIndex) {
    using namespace LingBuilderMysql;
    const wchar_t* operation = L"读取 MySQL 字节集列";
    auto statementValue = FindStatement(statementId, operation);
    if (!statementValue) return std::vector<unsigned char>{};
    std::lock_guard<std::recursive_mutex> lock(statementValue->connection->mutex);
    if (!BeginColumnRead(statementValue, columnIndex, operation)) return std::vector<unsigned char>{};
    unsigned long realLength = 0;
    char isNull = 0;
    if (!FetchColumnValue(statementValue, columnIndex, TypeBlob, nullptr, 0, &realLength, &isNull, operation)) return std::vector<unsigned char>{};
    if (isNull) {
        ClearError();
        return std::vector<unsigned char>{};
    }
    std::vector<unsigned char> buffer(realLength);
    if (realLength > 0) {
        if (!FetchColumnValue(statementValue, columnIndex, TypeBlob, buffer.data(), realLength, &realLength, &isNull, operation)) return std::vector<unsigned char>{};
    }
    ClearError();
    return buffer;
}

bool MySQL_开始事务(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"开始 MySQL 事务");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"开始 MySQL 事务")) return false;
    const char* sql = "START TRANSACTION";
    if (fn_real_query(connectionValue->handle, sql, static_cast<unsigned long>(strlen(sql))) != 0) {
        return FailServer(L"开始 MySQL 事务", connectionValue->handle);
    }
    ClearError();
    return true;
}

bool MySQL_提交(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"提交 MySQL 事务");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"提交 MySQL 事务")) return false;
    if (fn_commit(connectionValue->handle) != 0) {
        return FailServer(L"提交 MySQL 事务", connectionValue->handle);
    }
    ClearError();
    return true;
}

bool MySQL_回滚(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"回滚 MySQL 事务");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"回滚 MySQL 事务")) return false;
    if (fn_rollback(connectionValue->handle) != 0) {
        return FailServer(L"回滚 MySQL 事务", connectionValue->handle);
    }
    ClearError();
    return true;
}

bool MySQL_设置自动提交(long long connectionId, bool enable) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"设置 MySQL 自动提交");
    if (!connectionValue) return false;
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"设置 MySQL 自动提交")) return false;
    if (fn_autocommit(connectionValue->handle, enable ? 1 : 0) != 0) {
        return FailServer(L"设置 MySQL 自动提交", connectionValue->handle);
    }
    ClearError();
    return true;
}

const wchar_t* MySQL_取错误() {
    return LB_ReturnText(LingBuilderMysql::lastError);
}

int MySQL_取错误码() {
    return static_cast<int>(LingBuilderMysql::lastErrorCode);
}

const wchar_t* MySQL_取连接错误(long long connectionId) {
    using namespace LingBuilderMysql;
    auto connectionValue = FindConnection(connectionId, L"读取 MySQL 连接错误");
    if (!connectionValue) return LB_ReturnText(L"");
    std::lock_guard<std::recursive_mutex> lock(connectionValue->mutex);
    if (!EnsureLive(connectionValue, L"读取 MySQL 连接错误")) return LB_ReturnText(lastError);
    const unsigned int code = fn_errno(connectionValue->handle);
    const char* message = fn_error(connectionValue->handle);
    ClearError();
    if (code == 0 || !message || !message[0]) return LB_ReturnText(L"");
    return LB_ReturnText(LB_Utf8ToWide(message));
}
`;
