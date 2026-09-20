import { InstalledModule } from '../modules/types';

export const HTTP_SERVER_MODULE_ID = 'lingbuilder.http.server';

export function generateHttpServerRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return HTTP_SERVER_RUNTIME;
}

export function generateHttpServerWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return HTTP_SERVER_WINDOW_METHODS;
}

export function generateHttpServerGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return HTTP_SERVER_WINDOW_METHODS
    .replaceAll('httpServerRuntime_', 'g_httpServerRuntime')
    .replaceAll('httpServerReturnText_', 'g_httpServerReturnText')
    .replace(/^    /gmu, 'static ');
}

const HTTP_SERVER_RUNTIME = String.raw`
class LingHttpServerRuntime {
public:
    using NotifyRequest = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingHttpServerRuntime(NotifyRequest notify) : notify_(std::move(notify)) {
        WSADATA data = {};
        socketsStarted_ = WSAStartup(MAKEWORD(2, 2), &data) == 0;
    }
    ~LingHttpServerRuntime() { Shutdown(); if (socketsStarted_) WSACleanup(); }

    long long CreateServer() {
        if (!socketsStarted_) return FailId(L"HTTP 网络运行时初始化失败。");
        auto server = std::make_shared<Server>();
        server->id = nextServerId_.fetch_add(1);
        std::lock_guard<std::mutex> lock(mutex_);
        servers_[server->id] = server;
        return server->id;
    }

    bool Configure(long long id, const wchar_t* address, int port, int workers, int queueLimit) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        if (server->running.load()) return ServerFail(server, L"HTTP 服务正在运行，不能修改监听配置。");
        const std::wstring host = address && address[0] ? address : L"127.0.0.1";
        if (port < 0 || port > 65535) return ServerFail(server, L"HTTP 端口必须在 0 到 65535 之间。");
        if (workers < 1 || workers > 64) return ServerFail(server, L"HTTP 工作线程数必须在 1 到 64 之间。");
        if (queueLimit < 1 || queueLimit > 65535) return ServerFail(server, L"HTTP 等待队列上限必须在 1 到 65535 之间。");
        server->address = host;
        server->configuredPort = port;
        server->actualPort = port;
        server->workerCount = workers;
        server->queueLimit = queueLimit;
        return true;
    }

    bool SetLimits(long long id, int headerKb, int bodyMb, int timeoutMs) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        if (server->running.load()) return ServerFail(server, L"HTTP 服务正在运行，不能修改请求限制。");
        if (headerKb < 4 || headerKb > 1024) return ServerFail(server, L"HTTP 请求头上限必须在 4KB 到 1024KB 之间。");
        if (bodyMb < 0 || bodyMb > 1024) return ServerFail(server, L"HTTP 请求体上限必须在 0MB 到 1024MB 之间。");
        if (timeoutMs < 100 || timeoutMs > 3600000) return ServerFail(server, L"HTTP 请求超时必须在 100 到 3600000 毫秒之间。");
        server->maxHeaderBytes = static_cast<size_t>(headerKb) * 1024;
        server->maxBodyBytes = static_cast<size_t>(bodyMb) * 1024 * 1024;
        server->timeoutMs = timeoutMs;
        return true;
    }

    bool AllowExternal(long long id, bool allowed) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        if (server->running.load()) return ServerFail(server, L"HTTP 服务正在运行，不能修改外部监听权限。");
        server->allowExternal = allowed;
        return true;
    }

    bool BindHandler(long long id, const wchar_t* handler) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        std::wstring value = handler ? handler : L"";
        if (value.empty()) return ServerFail(server, L"HTTP 请求处理器不能为空。");
        server->defaultHandler = value;
        return true;
    }

    bool AddRoute(long long id, const wchar_t* method, const wchar_t* pattern, const wchar_t* handler) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePattern = pattern ? pattern : L"";
        std::wstring routeHandler = handler ? handler : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (routeHandler.empty()) return ServerFail(server, L"HTTP 路由的方法、路径和处理器不能为空。");
        const wchar_t* keyError = RouteKeyError(routeMethod, routePattern);
        if (keyError) return ServerFail(server, keyError);
        UpsertRoute(server, { routeMethod, routePattern, routeHandler, nullptr });
        return true;
    }

    bool AddStaticRoute(long long id, const wchar_t* method, const wchar_t* pattern, const wchar_t* content, const wchar_t* contentType) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePattern = pattern ? pattern : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        const wchar_t* keyError = RouteKeyError(routeMethod, routePattern);
        if (keyError) return ServerFail(server, keyError);
        auto response = std::make_shared<StaticResponse>();
        response->body = LB_WideToUtf8(content ? content : L"");
        response->contentType = contentType && contentType[0] ? contentType : L"text/plain; charset=utf-8";
        UpsertRoute(server, { routeMethod, routePattern, L"", response });
        return true;
    }

    bool AddStaticFileRoute(long long id, const wchar_t* method, const wchar_t* pattern, const wchar_t* filePath, const wchar_t* downloadName, const wchar_t* contentType) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePattern = pattern ? pattern : L"";
        std::wstring routeFile = filePath ? filePath : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        const wchar_t* keyError = RouteKeyError(routeMethod, routePattern);
        if (keyError) return ServerFail(server, keyError);
        if (routeFile.empty()) return ServerFail(server, L"HTTP 静态文件路由的文件路径不能为空。");
        auto response = std::make_shared<StaticResponse>();
        response->filePath = routeFile;
        response->contentType = contentType && contentType[0] ? contentType : L"application/octet-stream";
        std::wstring safe = downloadName ? downloadName : L"";
        safe.erase(std::remove_if(safe.begin(), safe.end(), [](wchar_t ch) { return ch == L'\r' || ch == L'\n' || ch == L'"'; }), safe.end());
        response->downloadName = safe;
        UpsertRoute(server, { routeMethod, routePattern, L"", response });
        return true;
    }

    bool SetRotation(long long id, long long requests) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        if (requests < 1 || requests > 1000000) return ServerFail(server, L"HTTP 连接轮转请求数必须在 1 到 1000000 之间。");
        server->rotationLimit.store(requests);
        return true;
    }

    bool ClearRoutes(long long id) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->routes.clear();
        return true;
    }

    bool Start(long long id) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::lock_guard<std::mutex> lifecycle(server->lifecycleMutex);
        if (server->running.load()) return true;
        if (!server->workers.empty() || server->acceptThread.joinable()) {
            server->stopping.store(true);
            server->queueChanged.notify_all();
            JoinThreads(server);
            server->stopping.store(false);
        }
        { std::lock_guard<std::mutex> lock(server->mutex); server->lastError.clear(); }
        SOCKET listenSocket = CreateListenSocket(server);
        if (listenSocket == INVALID_SOCKET) return false;
        server->listenSocket = listenSocket;
        server->stopping.store(false);
        server->running.store(true);
        try {
            for (int index = 0; index < server->workerCount; ++index) {
                server->workers.emplace_back([this, server]() { WorkerLoop(server); });
            }
            server->acceptThread = std::thread([this, server]() { AcceptLoop(server); });
        } catch (...) {
            server->running.store(false);
            server->stopping.store(true);
            CloseSocket(server->listenSocket);
            server->queueChanged.notify_all();
            JoinThreads(server);
            return ServerFail(server, L"HTTP 服务启动失败：无法创建工作线程。");
        }
        return true;
    }

    bool Stop(long long id) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        return StopServer(server);
    }

    bool Destroy(long long id) {
        std::shared_ptr<Server> server;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto found = servers_.find(id);
            if (found == servers_.end()) return FailLocked(L"HTTP 服务端句柄不存在或已销毁。");
            server = found->second;
            servers_.erase(found);
        }
        StopServer(server);
        return true;
    }

    void Shutdown() {
        std::vector<std::shared_ptr<Server>> servers;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            for (const auto& pair : servers_) servers.push_back(pair.second);
            servers_.clear();
        }
        for (const auto& server : servers) StopServer(server);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            requests_.clear();
            lastError_.clear();
        }
        {
            std::lock_guard<std::mutex> lock(currentMutex_);
            currentRequest_.reset();
        }
        legacyServerId_.store(0);
        legacyRequestId_ = 0;
    }

    bool IsRunning(long long id) const { auto server = FindServer(id); return server && server->running.load(); }
    std::wstring Address(long long id) const { auto server = FindServer(id); if (!server) return L""; std::lock_guard<std::mutex> lock(server->mutex); return server->address; }
    int Port(long long id) const { auto server = FindServer(id); return server ? server->actualPort : 0; }
    int ActiveConnections(long long id) const { auto server = FindServer(id); return server ? server->activeConnections.load() : 0; }
    long long TotalRequests(long long id) const { auto server = FindServer(id); return server ? server->totalRequests.load() : 0; }
    std::wstring Error(long long id) const {
        auto server = FindServer(id);
        if (!server) { std::lock_guard<std::mutex> lock(mutex_); return lastError_.empty() ? L"HTTP 服务端句柄无效。" : lastError_; }
        std::lock_guard<std::mutex> lock(server->mutex);
        return server->lastError;
    }

    std::wstring RequestHandler(long long requestId) const { auto request = FindRequest(requestId); return request ? request->handler : L""; }
    bool DispatchRequest(long long requestId, const DispatchHandler& dispatch) {
        auto request = FindRequest(requestId);
        if (!request) return false;
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            if (request->completed && request->aborted) return false;
            request->dispatching = true;
        }
        { std::lock_guard<std::mutex> lock(currentMutex_); currentRequest_ = request; }
        if (dispatch && !request->handler.empty()) dispatch(request->handler.c_str());
        { std::lock_guard<std::mutex> lock(currentMutex_); if (currentRequest_ == request) currentRequest_.reset(); }
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            request->dispatching = false;
            request->changed.notify_all();
        }
        return true;
    }
    long long CurrentRequest() const { std::lock_guard<std::mutex> lock(currentMutex_); return currentRequest_ ? currentRequest_->id : 0; }
    long long RequestServer(long long requestId) const { auto request = FindRequest(requestId); return request ? request->serverId : 0; }
    std::wstring RequestMethod(long long requestId) const { auto request = FindRequest(requestId); return request ? request->method : L""; }
    std::wstring RequestTarget(long long requestId) const { auto request = FindRequest(requestId); return request ? request->target : L""; }
    std::wstring RequestPath(long long requestId) const { auto request = FindRequest(requestId); return request ? request->path : L""; }
    std::wstring RequestQuery(long long requestId) const { auto request = FindRequest(requestId); return request ? request->query : L""; }
    std::wstring RequestProtocol(long long requestId) const { auto request = FindRequest(requestId); return request ? request->protocol : L""; }
    std::wstring RequestClientAddress(long long requestId) const { auto request = FindRequest(requestId); return request ? request->clientAddress : L""; }
    int RequestClientPort(long long requestId) const { auto request = FindRequest(requestId); return request ? request->clientPort : 0; }
    long long RequestBodySize(long long requestId) const { auto request = FindRequest(requestId); return request ? static_cast<long long>(request->body.size()) : 0; }
    std::wstring RequestBody(long long requestId) const { auto request = FindRequest(requestId); return request ? LB_Utf8ToWide(request->body) : L""; }
    std::wstring RequestBodyHex(long long requestId) const {
        auto request = FindRequest(requestId); if (!request) return L"";
        static const wchar_t digits[] = L"0123456789abcdef";
        std::wstring output; output.reserve(request->body.size() * 2);
        for (unsigned char value : request->body) { output.push_back(digits[value >> 4]); output.push_back(digits[value & 15]); }
        return output;
    }
    std::wstring RequestHeader(long long requestId, const wchar_t* name) const {
        auto request = FindRequest(requestId); if (!request) return L"";
        auto found = request->headers.find(Lower(name ? name : L""));
        return found == request->headers.end() ? L"" : found->second;
    }
    std::wstring RequestHeadersJson(long long requestId) const {
        auto request = FindRequest(requestId); if (!request) return L"{}";
        std::wstring output = L"{"; bool first = true;
        for (const auto& pair : request->headers) {
            if (!first) output += L","; first = false;
            output += L"\"" + JsonEscape(pair.first) + L"\":\"" + JsonEscape(pair.second) + L"\"";
        }
        return output + L"}";
    }
    std::wstring RequestQueryValue(long long requestId, const wchar_t* name) const {
        auto request = FindRequest(requestId); if (!request) return L"";
        const std::wstring wanted = name ? name : L"";
        size_t start = 0;
        while (start <= request->query.size()) {
            size_t end = request->query.find(L'&', start); if (end == std::wstring::npos) end = request->query.size();
            std::wstring item = request->query.substr(start, end - start);
            size_t equals = item.find(L'=');
            std::wstring key = UrlDecode(item.substr(0, equals), true);
            if (key == wanted) return equals == std::wstring::npos ? L"" : UrlDecode(item.substr(equals + 1), true);
            if (end == request->query.size()) break;
            start = end + 1;
        }
        return L"";
    }

    bool SetStatus(long long requestId, int status) {
        if (status < 100 || status > 599) return Fail(L"HTTP 状态码必须在 100 到 599 之间。");
        auto request = FindRequest(requestId); if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false; request->response.status = status; return true;
    }
    bool SetHeader(long long requestId, const wchar_t* name, const wchar_t* value, bool append) {
        auto request = FindRequest(requestId); if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        std::wstring key = name ? name : L""; std::wstring content = value ? value : L"";
        if (!ValidHeaderName(key) || !ValidHeaderValue(content)) return Fail(L"HTTP 响应头名称或值不合法。");
        const std::wstring lower = Lower(key);
        if (lower == L"content-length" || lower == L"connection" || lower == L"transfer-encoding") return Fail(L"该 HTTP 响应头由运行时统一管理，不能手工设置。");
        std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false;
        if (!append) request->response.headers.erase(std::remove_if(request->response.headers.begin(), request->response.headers.end(), [&](const ResponseHeader& item) { return Lower(item.name) == lower; }), request->response.headers.end());
        request->response.headers.push_back({ key, content }); return true;
    }
    bool SetCookie(long long requestId, const wchar_t* name, const wchar_t* value, const wchar_t* path, int maxAge, bool httpOnly, bool secure, const wchar_t* sameSite) {
        std::wstring cookieName = name ? name : L""; std::wstring cookieValue = value ? value : L"";
        if (!ValidCookiePart(cookieName) || cookieValue.find_first_of(L";\r\n") != std::wstring::npos) return Fail(L"Cookie 名称或值包含非法字符。");
        std::wstring output = cookieName + L"=" + UrlEncode(cookieValue);
        std::wstring cookiePath = path && path[0] ? path : L"/";
        if (cookiePath.find_first_of(L";\r\n") != std::wstring::npos) return Fail(L"Cookie 路径包含非法字符。");
        output += L"; Path=" + cookiePath;
        if (maxAge >= 0) output += L"; Max-Age=" + std::to_wstring(maxAge);
        if (httpOnly) output += L"; HttpOnly";
        if (secure) output += L"; Secure";
        std::wstring site = sameSite ? sameSite : L"";
        if (!site.empty()) {
            std::wstring normalized = Lower(site);
            if (normalized != L"lax" && normalized != L"strict" && normalized != L"none") return Fail(L"Cookie SameSite 只支持 Lax、Strict 或 None。");
            if (normalized == L"none" && !secure) return Fail(L"SameSite=None 的 Cookie 必须同时启用 Secure。");
            site[0] = static_cast<wchar_t>(std::towupper(site[0])); output += L"; SameSite=" + site;
        }
        return SetHeader(requestId, L"Set-Cookie", output.c_str(), true);
    }
    bool CompleteText(long long requestId, const wchar_t* text, const wchar_t* contentType, int status) {
        std::string body = LB_WideToUtf8(text ? text : L"");
        return Complete(requestId, body, contentType && contentType[0] ? contentType : L"text/plain; charset=utf-8", status);
    }
    bool CompleteJson(long long requestId, const wchar_t* json, int status) { return Complete(requestId, LB_WideToUtf8(json ? json : L""), L"application/json; charset=utf-8", status); }
    bool CompleteHex(long long requestId, const wchar_t* hex, const wchar_t* contentType, int status) {
        std::wstring value = hex ? hex : L""; if ((value.size() % 2) != 0) return Fail(L"HTTP 十六进制响应必须是偶数长度。");
        std::string bytes; bytes.reserve(value.size() / 2);
        for (size_t index = 0; index < value.size(); index += 2) {
            int high = Hex(value[index]), low = Hex(value[index + 1]); if (high < 0 || low < 0) return Fail(L"HTTP 十六进制响应包含非法字符。");
            bytes.push_back(static_cast<char>((high << 4) | low));
        }
        return Complete(requestId, bytes, contentType && contentType[0] ? contentType : L"application/octet-stream", status);
    }
    bool CompleteFile(long long requestId, const wchar_t* filePath, const wchar_t* downloadName, const wchar_t* contentType, int status) {
        if (status < 100 || status > 599 || !filePath || !filePath[0]) return Fail(L"HTTP 文件响应参数无效。");
        auto request = FindRequest(requestId); if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false;
        request->response.status = status; request->response.filePath = filePath;
        request->response.contentType = contentType && contentType[0] ? contentType : L"application/octet-stream";
        if (downloadName && downloadName[0]) {
            std::wstring safe = downloadName; safe.erase(std::remove_if(safe.begin(), safe.end(), [](wchar_t ch) { return ch == L'\r' || ch == L'\n' || ch == L'"'; }), safe.end());
            request->response.headers.push_back({ L"Content-Disposition", L"attachment; filename*=UTF-8''" + UrlEncode(safe) });
        }
        request->completed = true; request->changed.notify_all(); return true;
    }
    bool Redirect(long long requestId, const wchar_t* location, int status) {
        if (status != 301 && status != 302 && status != 303 && status != 307 && status != 308) return Fail(L"HTTP 重定向状态码必须是 301、302、303、307 或 308。");
        if (!location || !location[0]) return Fail(L"HTTP 重定向地址不能为空。");
        if (!SetHeader(requestId, L"Location", location, false)) return false;
        return Complete(requestId, std::string(), L"text/plain; charset=utf-8", status);
    }
    bool CompleteEmpty(long long requestId, int status) { return Complete(requestId, std::string(), L"text/plain; charset=utf-8", status); }
    bool IsCompleted(long long requestId) const { auto request = FindRequest(requestId); if (!request) return true; std::lock_guard<std::mutex> lock(request->mutex); return request->completed; }
    bool Abort(long long requestId) {
        auto request = FindRequest(requestId); if (!request) return false;
        std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false;
        request->aborted = true; request->completed = true; request->changed.notify_all(); return true;
    }

    bool SetLegacyServer(long long id) { auto server = FindServer(id); if (!server) return false; { std::lock_guard<std::mutex> lock(server->mutex); server->legacy = true; } legacyServerId_ = id; return true; }
    long long LegacyServer() const { return legacyServerId_; }
    long long WaitLegacyRequest() {
        auto server = FindServer(legacyServerId_); if (!server) { Fail(L"HTTP 旧版服务尚未启动。"); return 0; }
        std::unique_lock<std::mutex> lock(server->mutex);
        server->legacyChanged.wait(lock, [&]() { return !server->legacyRequests.empty() || !server->running.load(); });
        if (server->legacyRequests.empty()) return 0;
        long long id = server->legacyRequests.front(); server->legacyRequests.pop_front(); return id;
    }
    std::wstring RequestRaw(long long requestId) const { auto request = FindRequest(requestId); return request ? request->raw : L""; }
    int LegacyStart(int port) {
        LegacyClose();
        long long id = CreateServer();
        if (!id || !Configure(id, L"127.0.0.1", port, 1, 64) || !SetLegacyServer(id) || !Start(id)) { if (id) Destroy(id); legacyServerId_ = 0; return 0; }
        return 1;
    }
    std::wstring LegacyWaitRaw() { legacyRequestId_ = WaitLegacyRequest(); return RequestRaw(legacyRequestId_); }
    int LegacyReply(const wchar_t* text) { long long request = CurrentRequest(); if (!request) request = legacyRequestId_; return request && CompleteText(request, text, L"text/plain; charset=utf-8", 200) ? 1 : 0; }
    void LegacyClose() { long long id = legacyServerId_.exchange(0); if (id) Destroy(id); legacyRequestId_ = 0; }

private:
    struct ResponseHeader { std::wstring name; std::wstring value; };
    struct Response { int status = 200; std::vector<ResponseHeader> headers; std::string body; std::wstring filePath; std::wstring contentType = L"text/plain; charset=utf-8"; };
    struct Request {
        long long id = 0, serverId = 0; std::wstring handler, method, target, path, query, protocol, clientAddress, raw; int clientPort = 0;
        std::map<std::wstring, std::wstring> headers; std::string body; bool keepAlive = false, completed = false, aborted = false, dispatching = false;
        Response response; mutable std::mutex mutex; std::condition_variable changed;
    };
    struct StaticResponse { int status = 200; std::string body; std::wstring filePath, contentType = L"text/plain; charset=utf-8", downloadName; };
    struct Route { std::wstring method, pattern, handler; std::shared_ptr<StaticResponse> staticResponse; };
    struct Connection { SOCKET socket = INVALID_SOCKET; std::wstring address; int port = 0; };
    struct Server {
        long long id = 0; std::wstring address = L"127.0.0.1", defaultHandler, lastError; int configuredPort = 0, actualPort = 0, workerCount = 4, queueLimit = 256, timeoutMs = 30000;
        size_t maxHeaderBytes = 64 * 1024, maxBodyBytes = 16 * 1024 * 1024; bool allowExternal = false, legacy = false;
        std::vector<Route> routes; std::atomic<bool> running{false}, stopping{false}; std::atomic<int> activeConnections{0}; std::atomic<long long> totalRequests{0}; std::atomic<long long> rotationLimit{100};
        SOCKET listenSocket = INVALID_SOCKET; std::thread acceptThread; std::vector<std::thread> workers; std::deque<Connection> queue; std::set<SOCKET> activeSockets;
        std::deque<long long> legacyRequests; mutable std::mutex mutex, lifecycleMutex; std::condition_variable queueChanged, legacyChanged;
    };

    std::shared_ptr<Server> FindServer(long long id) const { std::lock_guard<std::mutex> lock(mutex_); auto found = servers_.find(id); return found == servers_.end() ? nullptr : found->second; }
    std::shared_ptr<Request> FindRequest(long long id) const { std::lock_guard<std::mutex> lock(mutex_); auto found = requests_.find(id); return found == requests_.end() ? nullptr : found->second; }
    bool Fail(const std::wstring& message) const { std::lock_guard<std::mutex> lock(mutex_); return FailLocked(message); }
    long long FailId(const std::wstring& message) const { Fail(message); return 0; }
    bool FailLocked(const std::wstring& message) const { lastError_ = message; return false; }
    static bool ServerFail(const std::shared_ptr<Server>& server, const std::wstring& message) { server->lastError = message; return false; }

    SOCKET CreateListenSocket(const std::shared_ptr<Server>& server) {
        std::wstring configuredAddress; int configuredPort = 0, queueLimit = 0; bool allowExternal = false;
        { std::lock_guard<std::mutex> lock(server->mutex); configuredAddress = server->address; configuredPort = server->configuredPort; queueLimit = server->queueLimit; allowExternal = server->allowExternal; }
        std::wstring lookupAddress = configuredAddress;
        if (lookupAddress.size() > 2 && lookupAddress.front() == L'[' && lookupAddress.back() == L']') lookupAddress = lookupAddress.substr(1, lookupAddress.size() - 2);
        ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; hints.ai_socktype = SOCK_STREAM; hints.ai_protocol = IPPROTO_TCP; if (lookupAddress == L"*") hints.ai_flags = AI_PASSIVE;
        const std::wstring port = std::to_wstring(configuredPort); PADDRINFOW addresses = nullptr;
        int lookup = GetAddrInfoW(lookupAddress == L"*" ? nullptr : lookupAddress.c_str(), port.c_str(), &hints, &addresses);
        if (lookup != 0 || !addresses) { std::lock_guard<std::mutex> lock(server->mutex); ServerFail(server, L"HTTP 监听地址无法解析，错误码：" + std::to_wstring(lookup)); return INVALID_SOCKET; }
        SOCKET result = INVALID_SOCKET; bool rejectedExternal = false; int socketError = 0;
        for (PADDRINFOW item = addresses; item; item = item->ai_next) {
            if (!allowExternal && !IsLoopbackAddress(item->ai_addr)) { rejectedExternal = true; continue; }
            SOCKET candidate = socket(item->ai_family, item->ai_socktype, item->ai_protocol); if (candidate == INVALID_SOCKET) continue;
            BOOL exclusive = TRUE; setsockopt(candidate, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<const char*>(&exclusive), sizeof(exclusive));
            if (bind(candidate, item->ai_addr, static_cast<int>(item->ai_addrlen)) == 0 && listen(candidate, queueLimit) == 0) { result = candidate; break; }
            socketError = WSAGetLastError();
            closesocket(candidate);
        }
        FreeAddrInfoW(addresses);
        if (result == INVALID_SOCKET) {
            std::lock_guard<std::mutex> lock(server->mutex);
            ServerFail(server, rejectedExternal
                ? L"HTTP 默认只允许解析后为回环地址的监听目标；外部地址必须先显式调用 HTTP_允许外部监听。"
                : L"HTTP 监听失败，Winsock 错误码：" + std::to_wstring(socketError));
            return result;
        }
        sockaddr_storage local = {}; int length = sizeof(local);
        if (getsockname(result, reinterpret_cast<sockaddr*>(&local), &length) == 0) { std::lock_guard<std::mutex> lock(server->mutex); server->actualPort = local.ss_family == AF_INET ? ntohs(reinterpret_cast<sockaddr_in*>(&local)->sin_port) : ntohs(reinterpret_cast<sockaddr_in6*>(&local)->sin6_port); }
        return result;
    }

    void AcceptLoop(const std::shared_ptr<Server>& server) {
        while (server->running.load()) {
            sockaddr_storage peer = {}; int peerLength = sizeof(peer); SOCKET client = accept(server->listenSocket, reinterpret_cast<sockaddr*>(&peer), &peerLength);
            if (client == INVALID_SOCKET) {
                if (!server->stopping.load()) {
                    { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = L"HTTP 接受连接失败，Winsock 错误码：" + std::to_wstring(WSAGetLastError()); }
                    server->running.store(false);
                    server->stopping.store(true);
                    server->queueChanged.notify_all();
                }
                break;
            }
            Connection connection; connection.socket = client; wchar_t host[NI_MAXHOST] = {}, service[NI_MAXSERV] = {};
            if (GetNameInfoW(reinterpret_cast<sockaddr*>(&peer), peerLength, host, NI_MAXHOST, service, NI_MAXSERV, NI_NUMERICHOST | NI_NUMERICSERV) == 0) { connection.address = host; connection.port = _wtoi(service); }
            bool queued = false;
            {
                std::lock_guard<std::mutex> lock(server->mutex);
                if (server->queue.size() < static_cast<size_t>(server->queueLimit) && server->running.load()) { server->queue.push_back(connection); queued = true; }
            }
            if (queued) server->queueChanged.notify_one();
            else { SendSimpleError(client, 503, "Service Unavailable"); CloseSocket(client); }
        }
    }

    void WorkerLoop(const std::shared_ptr<Server>& server) {
        while (true) {
            Connection connection;
            {
                std::unique_lock<std::mutex> lock(server->mutex);
                server->queueChanged.wait(lock, [&]() { return !server->queue.empty() || server->stopping.load(); });
                if (server->queue.empty()) { if (server->stopping.load()) return; continue; }
                connection = server->queue.front(); server->queue.pop_front(); server->activeSockets.insert(connection.socket);
            }
            server->activeConnections.fetch_add(1);
            try { HandleConnection(server, connection); }
            catch (...) { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = L"HTTP 工作线程处理连接时发生未预期错误。"; }
            server->activeConnections.fetch_sub(1);
            { std::lock_guard<std::mutex> lock(server->mutex); server->activeSockets.erase(connection.socket); }
            CloseSocket(connection.socket);
        }
    }

    void HandleConnection(const std::shared_ptr<Server>& server, Connection& connection) {
        int timeout = server->timeoutMs; setsockopt(connection.socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout)); setsockopt(connection.socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
        std::string pending;
        for (long long requestIndex = 0; server->running.load(); ++requestIndex) {
            const bool allowKeepAlive = requestIndex + 1 < server->rotationLimit.load();
            auto request = std::make_shared<Request>(); request->id = nextRequestId_.fetch_add(1); request->serverId = server->id; request->clientAddress = connection.address; request->clientPort = connection.port;
            int parseStatus = ParseRequest(connection.socket, pending, server, *request);
            if (parseStatus == 0) break;
            if (parseStatus != 200) { SendSimpleError(connection.socket, parseStatus, Reason(parseStatus)); break; }
            Route route = MatchRoute(server, request->method, request->path);
            request->handler = route.handler;
            server->totalRequests.fetch_add(1);
            if (route.staticResponse) {
                const StaticResponse& value = *route.staticResponse;
                request->response.status = value.status; request->response.body = value.body;
                request->response.filePath = value.filePath; request->response.contentType = value.contentType;
                if (!value.downloadName.empty()) request->response.headers.push_back({ L"Content-Disposition", L"attachment; filename*=UTF-8''" + UrlEncode(value.downloadName) });
                if (!SendResponse(connection.socket, *request, allowKeepAlive)) break;
                continue;
            }
            { std::lock_guard<std::mutex> lock(mutex_); requests_[request->id] = request; }
            bool delivered = false;
            if (server->legacy) {
                std::lock_guard<std::mutex> lock(server->mutex); server->legacyRequests.push_back(request->id); server->legacyChanged.notify_one(); delivered = true;
            } else if (!request->handler.empty()) delivered = notify_ && notify_(request->id);
            if (!delivered) Complete(request->id, "Not Found", L"text/plain; charset=utf-8", request->handler.empty() ? 404 : 503);
            {
                std::unique_lock<std::mutex> lock(request->mutex);
                if (!request->changed.wait_for(lock, std::chrono::milliseconds(server->timeoutMs), [&]() { return (request->completed && !request->dispatching) || server->stopping.load(); })) {
                    request->response.status = 504; request->response.body = "Gateway Timeout"; request->response.contentType = L"text/plain; charset=utf-8"; request->completed = true;
                }
                while (request->dispatching && !server->stopping.load()) request->changed.wait(lock);
                if (server->stopping.load() && !request->completed) { request->aborted = true; request->completed = true; }
            }
            bool keepAlive = SendResponse(connection.socket, *request, allowKeepAlive);
            { std::lock_guard<std::mutex> lock(mutex_); requests_.erase(request->id); }
            if (!keepAlive) break;
        }
    }

    int ParseRequest(SOCKET socketValue, std::string& pending, const std::shared_ptr<Server>& server, Request& request) {
        const std::string separator = "\r\n\r\n"; size_t marker = pending.find(separator);
        while (marker == std::string::npos) {
            if (pending.size() >= server->maxHeaderBytes) return 431;
            char buffer[4096]; int count = recv(socketValue, buffer, sizeof(buffer), 0);
            if (count == 0) return 0; if (count < 0) return WSAGetLastError() == WSAETIMEDOUT ? 408 : 400;
            pending.append(buffer, static_cast<size_t>(count)); marker = pending.find(separator);
        }
        if (marker + separator.size() > server->maxHeaderBytes) return 431;
        std::string headerBytes = pending.substr(0, marker + separator.size()); pending.erase(0, marker + separator.size());
        if (!HasValidCrLf(headerBytes)) return 400;
        std::istringstream stream(headerBytes); std::string line;
        if (!std::getline(stream, line)) return 400; TrimCr(line);
        std::istringstream first(line); std::string method, target, protocol, extra; if (!(first >> method >> target >> protocol) || (first >> extra)) return 400;
        if (!IsAsciiToken(method) || !ValidRequestTarget(method, target) || target.size() > 16384 || (protocol != "HTTP/1.0" && protocol != "HTTP/1.1")) return 400;
        request.method = Upper(LB_Utf8ToWide(method)); request.target = LB_Utf8ToWide(target); request.protocol = LB_Utf8ToWide(protocol);
        size_t query = request.target.find(L'?'); std::wstring encodedPath = request.target.substr(0, query); request.query = query == std::wstring::npos ? L"" : request.target.substr(query + 1);
        std::wstring decodedQuery;
        if (!ValidPercentEncoding(encodedPath) || !ValidPercentEncoding(request.query)
            || !TryUrlDecode(encodedPath, false, request.path) || !TryUrlDecode(request.query, true, decodedQuery)
            || HasUnsafePathCharacter(request.path)) return 400;
        int hostCount = 0;
        while (std::getline(stream, line)) {
            TrimCr(line); if (line.empty()) break; size_t colon = line.find(':'); if (colon == std::string::npos) return 400;
            std::string name = line.substr(0, colon), value = line.substr(colon + 1); if (!IsAsciiToken(name)) return 400; TrimAscii(value); if (!ValidHeaderValueBytes(value)) return 400;
            std::wstring key = Lower(LB_Utf8ToWide(name)), wideValue = LB_Utf8ToWide(value); auto found = request.headers.find(key);
            if (!value.empty() && wideValue.empty()) return 400;
            if (key == L"host" && ++hostCount > 1) return 400;
            if (found == request.headers.end()) request.headers[key] = wideValue; else found->second += L", " + wideValue;
        }
        if (protocol == "HTTP/1.1" && (hostCount != 1 || RequestHeaderValue(request, L"host").empty())) return 400;
        std::wstring transfer = Lower(RequestHeaderValue(request, L"transfer-encoding")); std::wstring lengthText = RequestHeaderValue(request, L"content-length");
        if (!transfer.empty() && !lengthText.empty()) return 400;
        std::wstring expect = Lower(RequestHeaderValue(request, L"expect"));
        if (!expect.empty() && expect != L"100-continue") return 417;
        if (expect == L"100-continue") { static const char response[] = "HTTP/1.1 100 Continue\r\n\r\n"; if (!SendAll(socketValue, response, sizeof(response) - 1)) return 400; }
        if (!transfer.empty()) {
            if (transfer != L"chunked") return 501;
            int result = ReadChunked(socketValue, pending, server->maxBodyBytes, request.body); if (result != 200) return result;
        } else if (!lengthText.empty()) {
            unsigned long long length = 0; if (!ParseUnsigned(lengthText, length)) return 400; if (length > server->maxBodyBytes) return 413;
            int result = ReadBytes(socketValue, pending, static_cast<size_t>(length), request.body); if (result != 200) return result;
        }
        request.keepAlive = protocol == "HTTP/1.1" ? Lower(RequestHeaderValue(request, L"connection")) != L"close" : Lower(RequestHeaderValue(request, L"connection")) == L"keep-alive";
        request.raw = LB_Utf8ToWide(headerBytes + request.body); return 200;
    }

    static int ReadBytes(SOCKET socketValue, std::string& pending, size_t length, std::string& output) {
        output.clear(); size_t take = (std::min)(length, pending.size()); output.append(pending.data(), take); pending.erase(0, take);
        while (output.size() < length) { char buffer[8192]; size_t wanted = (std::min)(sizeof(buffer), length - output.size()); int count = recv(socketValue, buffer, static_cast<int>(wanted), 0); if (count <= 0) return count < 0 && WSAGetLastError() == WSAETIMEDOUT ? 408 : 400; output.append(buffer, static_cast<size_t>(count)); }
        return 200;
    }
    static int ReadLine(SOCKET socketValue, std::string& pending, std::string& line) {
        size_t end = pending.find("\r\n");
        while (end == std::string::npos) { if (pending.size() > 8192) return 400; char buffer[2048]; int count = recv(socketValue, buffer, sizeof(buffer), 0); if (count <= 0) return count < 0 && WSAGetLastError() == WSAETIMEDOUT ? 408 : 400; pending.append(buffer, static_cast<size_t>(count)); end = pending.find("\r\n"); }
        line = pending.substr(0, end); pending.erase(0, end + 2); return 200;
    }
    static int ReadChunked(SOCKET socketValue, std::string& pending, size_t maximum, std::string& output) {
        output.clear();
        while (true) {
            std::string sizeLine; int lineStatus = ReadLine(socketValue, pending, sizeLine); if (lineStatus != 200) return lineStatus;
            size_t semicolon = sizeLine.find(';'); std::string hex = sizeLine.substr(0, semicolon); TrimAscii(hex); if (hex.empty() || hex.size() > 16) return 400;
            unsigned long long length = 0; for (char ch : hex) { int value = Hex(ch); if (value < 0 || length > (std::numeric_limits<unsigned long long>::max() >> 4)) return 400; length = (length << 4) | static_cast<unsigned>(value); }
            if (length == 0) { while (true) { std::string trailer; int status = ReadLine(socketValue, pending, trailer); if (status != 200) return status; if (trailer.empty()) return 200; if (trailer.find(':') == std::string::npos) return 400; } }
            if (length > maximum || output.size() > maximum - static_cast<size_t>(length)) return 413;
            std::string chunk; int status = ReadBytes(socketValue, pending, static_cast<size_t>(length), chunk); if (status != 200) return status; output += chunk;
            std::string terminator; status = ReadLine(socketValue, pending, terminator); if (status != 200 || !terminator.empty()) return 400;
        }
    }

    bool Complete(long long requestId, const std::string& body, const wchar_t* contentType, int status) {
        if (status < 100 || status > 599) return Fail(L"HTTP 状态码必须在 100 到 599 之间。");
        auto request = FindRequest(requestId); if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false;
        request->response.status = status; request->response.body = body; request->response.contentType = contentType ? contentType : L"application/octet-stream"; request->completed = true; request->changed.notify_all(); return true;
    }
    bool SendResponse(SOCKET socketValue, Request& request, bool allowKeepAlive) {
        Response response; bool aborted = false;
        { std::lock_guard<std::mutex> lock(request.mutex); response = request.response; aborted = request.aborted; }
        if (aborted) return false;
        std::ifstream file; unsigned long long contentLength = response.body.size();
        if (!response.filePath.empty()) {
            file.open(std::filesystem::path(response.filePath), std::ios::binary); if (!file) { response.status = 404; response.body = "File Not Found"; response.filePath.clear(); response.contentType = L"text/plain; charset=utf-8"; contentLength = response.body.size(); }
            else { file.seekg(0, std::ios::end); auto end = file.tellg(); if (end < 0) { response.status = 500; response.body = "File Read Error"; response.filePath.clear(); response.contentType = L"text/plain; charset=utf-8"; contentLength = response.body.size(); } else { contentLength = static_cast<unsigned long long>(end); file.seekg(0, std::ios::beg); } }
        }
        if (response.status == 204 || response.status == 304 || (response.status >= 100 && response.status < 200)) { response.body.clear(); response.filePath.clear(); contentLength = 0; }
        bool keepAlive = request.keepAlive && allowKeepAlive;
        std::ostringstream header; header << (request.protocol == L"HTTP/1.0" ? "HTTP/1.0 " : "HTTP/1.1 ") << response.status << " " << Reason(response.status) << "\r\n";
        bool hasType = false; for (const auto& item : response.headers) { if (Lower(item.name) == L"content-type") hasType = true; header << LB_WideToUtf8(item.name.c_str()) << ": " << LB_WideToUtf8(item.value.c_str()) << "\r\n"; }
        if (!hasType && contentLength > 0) header << "Content-Type: " << LB_WideToUtf8(response.contentType.c_str()) << "\r\n";
        header << "Content-Length: " << contentLength << "\r\nConnection: " << (keepAlive ? "keep-alive" : "close") << "\r\nX-Content-Type-Options: nosniff\r\n\r\n";
        const std::string head = header.str(); if (!SendAll(socketValue, head.data(), head.size())) return false;
        if (request.method == L"HEAD") return keepAlive;
        if (!response.filePath.empty()) { char buffer[64 * 1024]; while (file) { file.read(buffer, sizeof(buffer)); std::streamsize count = file.gcount(); if (count > 0 && !SendAll(socketValue, buffer, static_cast<size_t>(count))) return false; } }
        else if (!response.body.empty() && !SendAll(socketValue, response.body.data(), response.body.size())) return false;
        return keepAlive;
    }

    static const wchar_t* RouteKeyError(const std::wstring& routeMethod, const std::wstring& routePattern) {
        if (routeMethod.empty() || routePattern.empty()) return L"HTTP 路由的方法与路径不能为空。";
        if (routeMethod != L"*" && !IsMethodToken(routeMethod)) return L"HTTP 路由方法包含非法字符。";
        if (routePattern.empty() || routePattern[0] != L'/') return L"HTTP 路由路径必须以 / 开头。";
        if (routePattern.find(L'*') != std::wstring::npos && (routePattern.size() < 2 || routePattern.substr(routePattern.size() - 2) != L"/*")) return L"HTTP 路由仅支持末尾 /* 前缀通配符。";
        return nullptr;
    }
    void UpsertRoute(const std::shared_ptr<Server>& server, Route route) {
        auto found = std::find_if(server->routes.begin(), server->routes.end(), [&](const Route& item) { return item.method == route.method && item.pattern == route.pattern; });
        if (found != server->routes.end()) *found = std::move(route);
        else server->routes.push_back(std::move(route));
    }

    Route MatchRoute(const std::shared_ptr<Server>& server, const std::wstring& method, const std::wstring& path) const {
        std::lock_guard<std::mutex> lock(server->mutex);
        Route route;
        if (TryMatchRoute(server, method, path, route)) return route;
        if (method == L"HEAD" && TryMatchRoute(server, L"GET", path, route)) return route;
        Route fallback; fallback.handler = server->defaultHandler; return fallback;
    }
    static bool TryMatchRoute(const std::shared_ptr<Server>& server, const std::wstring& method, const std::wstring& path, Route& output) {
        for (const auto& route : server->routes) {
            if (route.method != L"*" && route.method != method) continue;
            if (route.pattern == path) { output = route; return true; }
            if (route.pattern.size() >= 2 && route.pattern.substr(route.pattern.size() - 2) == L"/*") {
                std::wstring prefix = route.pattern.substr(0, route.pattern.size() - 1); if (path.rfind(prefix, 0) == 0) { output = route; return true; }
            }
        }
        return false;
    }
    bool StopServer(const std::shared_ptr<Server>& server) {
        std::lock_guard<std::mutex> lifecycle(server->lifecycleMutex);
        if (!server->running.exchange(false) && server->workers.empty() && !server->acceptThread.joinable()) return true;
        server->stopping.store(true); CloseSocket(server->listenSocket);
        std::deque<Connection> queued; std::vector<SOCKET> active;
        { std::lock_guard<std::mutex> lock(server->mutex); queued.swap(server->queue); server->legacyRequests.clear(); active.assign(server->activeSockets.begin(), server->activeSockets.end()); }
        for (auto& item : queued) CloseSocket(item.socket); for (SOCKET value : active) shutdown(value, SD_BOTH);
        server->queueChanged.notify_all(); server->legacyChanged.notify_all();
        std::vector<std::shared_ptr<Request>> pendingRequests;
        { std::lock_guard<std::mutex> lock(mutex_); for (const auto& pair : requests_) if (pair.second->serverId == server->id) pendingRequests.push_back(pair.second); }
        for (const auto& request : pendingRequests) { std::lock_guard<std::mutex> lock(request->mutex); request->aborted = true; request->completed = true; request->changed.notify_all(); }
        JoinThreads(server); server->stopping.store(false); return true;
    }
    static void JoinThreads(const std::shared_ptr<Server>& server) { if (server->acceptThread.joinable()) server->acceptThread.join(); for (auto& worker : server->workers) if (worker.joinable()) worker.join(); server->workers.clear(); }
    static void CloseSocket(SOCKET& value) { SOCKET current = value; value = INVALID_SOCKET; if (current != INVALID_SOCKET) { shutdown(current, SD_BOTH); closesocket(current); } }
    static bool SendAll(SOCKET socketValue, const char* data, size_t length) { size_t sent = 0; while (sent < length) { int count = send(socketValue, data + sent, static_cast<int>((std::min)(length - sent, static_cast<size_t>(INT_MAX))), 0); if (count <= 0) return false; sent += static_cast<size_t>(count); } return true; }
    static void SendSimpleError(SOCKET socketValue, int status, const char* reason) { std::string body = reason ? reason : "HTTP Error"; std::ostringstream output; output << "HTTP/1.1 " << status << " " << body << "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " << body.size() << "\r\nConnection: close\r\n\r\n" << body; std::string value = output.str(); SendAll(socketValue, value.data(), value.size()); }
    static const char* Reason(int status) { switch (status) { case 100:return "Continue"; case 200:return "OK"; case 201:return "Created"; case 202:return "Accepted"; case 204:return "No Content"; case 301:return "Moved Permanently"; case 302:return "Found"; case 303:return "See Other"; case 304:return "Not Modified"; case 307:return "Temporary Redirect"; case 308:return "Permanent Redirect"; case 400:return "Bad Request"; case 401:return "Unauthorized"; case 403:return "Forbidden"; case 404:return "Not Found"; case 405:return "Method Not Allowed"; case 408:return "Request Timeout"; case 409:return "Conflict"; case 413:return "Payload Too Large"; case 415:return "Unsupported Media Type"; case 417:return "Expectation Failed"; case 422:return "Unprocessable Content"; case 429:return "Too Many Requests"; case 431:return "Request Header Fields Too Large"; case 500:return "Internal Server Error"; case 501:return "Not Implemented"; case 502:return "Bad Gateway"; case 503:return "Service Unavailable"; case 504:return "Gateway Timeout"; default:return "Status"; } }
    static std::wstring RequestHeaderValue(const Request& request, const std::wstring& name) { auto found = request.headers.find(name); return found == request.headers.end() ? L"" : found->second; }
    static bool ParseUnsigned(const std::wstring& text, unsigned long long& value) { if (text.empty()) return false; value = 0; for (wchar_t ch : text) { if (ch < L'0' || ch > L'9' || value > (std::numeric_limits<unsigned long long>::max() - static_cast<unsigned>(ch - L'0')) / 10) return false; value = value * 10 + static_cast<unsigned>(ch - L'0'); } return true; }
    static void TrimCr(std::string& value) { if (!value.empty() && value.back() == '\r') value.pop_back(); }
    static void TrimAscii(std::string& value) { const char* whitespace = " \t\r\n"; size_t first = value.find_first_not_of(whitespace), last = value.find_last_not_of(whitespace); value = first == std::string::npos ? std::string() : value.substr(first, last - first + 1); }
    static bool IsAsciiToken(const std::string& value) { if (value.empty()) return false; for (unsigned char ch : value) if (!std::isalnum(ch) && ch != 0x60 && std::string("!#$%&'*+-.^_|~").find(static_cast<char>(ch)) == std::string::npos) return false; return true; }
    static bool ValidRequestTarget(const std::string& method, const std::string& value) { if (value == "*") return method == "OPTIONS"; if (value.empty() || value[0] != '/') return false; for (unsigned char ch : value) if (ch <= 0x20 || ch >= 0x7f || ch == '#') return false; return true; }
    static bool HasValidCrLf(const std::string& value) { for (size_t index = 0; index < value.size(); ++index) { if (value[index] == '\r' && (index + 1 >= value.size() || value[index + 1] != '\n')) return false; if (value[index] == '\n' && (index == 0 || value[index - 1] != '\r')) return false; } return true; }
    static bool ValidHeaderValueBytes(const std::string& value) { for (unsigned char ch : value) if ((ch < 0x20 && ch != '\t') || ch == 0x7f) return false; return true; }
    static bool IsMethodToken(const std::wstring& value) { if (value.empty()) return false; for (wchar_t ch : value) if (!(ch >= L'A' && ch <= L'Z') && ch != L'-') return false; return true; }
    static bool ValidHeaderName(const std::wstring& value) { if (value.empty()) return false; for (wchar_t ch : value) if (!(ch >= L'0' && ch <= L'9') && !(ch >= L'A' && ch <= L'Z') && !(ch >= L'a' && ch <= L'z') && ch != 0x60 && std::wstring(L"!#$%&'*+-.^_|~").find(ch) == std::wstring::npos) return false; return true; }
    static bool ValidHeaderValue(const std::wstring& value) { for (wchar_t ch : value) if ((ch < 0x20 && ch != L'\t') || ch == 0x7f) return false; return true; }
    static bool ValidCookiePart(const std::wstring& value) { return ValidHeaderName(value); }
    static std::wstring Lower(std::wstring value) { std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); }); return value; }
    static std::wstring Upper(std::wstring value) { std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(std::towupper(ch)); }); return value; }
    static bool IsLoopbackAddress(const sockaddr* value) {
        if (!value) return false;
        if (value->sa_family == AF_INET) return (ntohl(reinterpret_cast<const sockaddr_in*>(value)->sin_addr.s_addr) & 0xff000000UL) == 0x7f000000UL;
        if (value->sa_family == AF_INET6) return IN6_IS_ADDR_LOOPBACK(&reinterpret_cast<const sockaddr_in6*>(value)->sin6_addr) != 0;
        return false;
    }
    static int Hex(wchar_t ch) { if (ch >= L'0' && ch <= L'9') return ch - L'0'; if (ch >= L'a' && ch <= L'f') return ch - L'a' + 10; if (ch >= L'A' && ch <= L'F') return ch - L'A' + 10; return -1; }
    static int Hex(char ch) { return Hex(static_cast<wchar_t>(static_cast<unsigned char>(ch))); }
    static bool ValidPercentEncoding(const std::wstring& value) { for (size_t index = 0; index < value.size(); ++index) if (value[index] == L'%') { if (index + 2 >= value.size() || Hex(value[index + 1]) < 0 || Hex(value[index + 2]) < 0) return false; index += 2; } return true; }
    static bool HasUnsafePathCharacter(const std::wstring& value) { for (wchar_t ch : value) if (ch < 0x20 || ch == 0x7f || ch == L'\\') return true; return false; }
    static bool TryUrlDecode(const std::wstring& value, bool plusAsSpace, std::wstring& output) { std::string bytes; for (size_t index = 0; index < value.size(); ++index) { wchar_t ch = value[index]; if (plusAsSpace && ch == L'+') bytes.push_back(' '); else if (ch == L'%' && index + 2 < value.size() && Hex(value[index + 1]) >= 0 && Hex(value[index + 2]) >= 0) { bytes.push_back(static_cast<char>((Hex(value[index + 1]) << 4) | Hex(value[index + 2]))); index += 2; } else { std::wstring one(1, ch); bytes += LB_WideToUtf8(one.c_str()); } } output = LB_Utf8ToWide(bytes); return bytes.empty() || !output.empty(); }
    static std::wstring UrlDecode(const std::wstring& value, bool plusAsSpace) { std::wstring output; return TryUrlDecode(value, plusAsSpace, output) ? output : L""; }
    static std::wstring UrlEncode(const std::wstring& value) { static const wchar_t digits[] = L"0123456789ABCDEF"; std::string bytes = LB_WideToUtf8(value.c_str()); std::wstring output; for (unsigned char ch : bytes) { if (std::isalnum(ch) || ch == '-' || ch == '_' || ch == '.' || ch == '~') output.push_back(static_cast<wchar_t>(ch)); else { output += L'%'; output.push_back(digits[ch >> 4]); output.push_back(digits[ch & 15]); } } return output; }
    static std::wstring JsonEscape(const std::wstring& value) { std::wstring output; for (wchar_t ch : value) { switch (ch) { case L'\\': output += L"\\\\"; break; case L'"': output += L"\\\""; break; case L'\r': output += L"\\r"; break; case L'\n': output += L"\\n"; break; case L'\t': output += L"\\t"; break; default: if (ch < 0x20) { wchar_t buffer[7] = {}; swprintf_s(buffer, L"\\u%04x", static_cast<unsigned>(ch)); output += buffer; } else output.push_back(ch); } } return output; }

    NotifyRequest notify_; mutable std::mutex mutex_, currentMutex_; mutable std::wstring lastError_; std::map<long long, std::shared_ptr<Server>> servers_; std::map<long long, std::shared_ptr<Request>> requests_; std::shared_ptr<Request> currentRequest_;
    std::atomic<long long> nextServerId_{1}, nextRequestId_{1}; std::atomic<long long> legacyServerId_{0}; long long legacyRequestId_ = 0; bool socketsStarted_ = false;
};
`;

const HTTP_SERVER_WINDOW_METHODS = String.raw`
    long long HTTP_创建服务() { return httpServerRuntime_.CreateServer(); }
    bool HTTP_配置服务(long long server, const wchar_t* address, int port, int workers, int queueLimit) { return httpServerRuntime_.Configure(server, address, port, workers, queueLimit); }
    bool HTTP_设置请求限制(long long server, int headerKb, int bodyMb, int timeoutMs) { return httpServerRuntime_.SetLimits(server, headerKb, bodyMb, timeoutMs); }
    bool HTTP_允许外部监听(long long server, bool allowed) { return httpServerRuntime_.AllowExternal(server, allowed); }
    bool HTTP_绑定请求处理器(long long server, const wchar_t* handler) { return httpServerRuntime_.BindHandler(server, handler); }
    bool HTTP_添加路由(long long server, const wchar_t* method, const wchar_t* path, const wchar_t* handler) { return httpServerRuntime_.AddRoute(server, method, path, handler); }
    bool HTTP_添加静态路由(long long server, const wchar_t* method, const wchar_t* path, const wchar_t* content, const wchar_t* contentType) { return httpServerRuntime_.AddStaticRoute(server, method, path, content, contentType); }
    bool HTTP_添加静态文件路由(long long server, const wchar_t* method, const wchar_t* path, const wchar_t* filePath, const wchar_t* downloadName, const wchar_t* contentType) { return httpServerRuntime_.AddStaticFileRoute(server, method, path, filePath, downloadName, contentType); }
    bool HTTP_设置连接轮转(long long server, long long requests) { return httpServerRuntime_.SetRotation(server, requests); }
    bool HTTP_清空路由(long long server) { return httpServerRuntime_.ClearRoutes(server); }
    bool HTTP_启动(long long server) { return httpServerRuntime_.Start(server); }
    bool HTTP_停止(long long server) { return httpServerRuntime_.Stop(server); }
    bool HTTP_销毁服务(long long server) { return httpServerRuntime_.Destroy(server); }
    bool HTTP_是否运行(long long server) { return httpServerRuntime_.IsRunning(server); }
    const wchar_t* HTTP_取监听地址(long long server) { httpServerReturnText_ = httpServerRuntime_.Address(server); return httpServerReturnText_.c_str(); }
    int HTTP_取监听端口(long long server) { return httpServerRuntime_.Port(server); }
    int HTTP_取活动连接数(long long server) { return httpServerRuntime_.ActiveConnections(server); }
    long long HTTP_取累计请求数(long long server) { return httpServerRuntime_.TotalRequests(server); }
    const wchar_t* HTTP_取服务错误(long long server) { httpServerReturnText_ = httpServerRuntime_.Error(server); return httpServerReturnText_.c_str(); }
    long long HTTP_取当前请求() { return httpServerRuntime_.CurrentRequest(); }
    long long HTTP_取请求服务(long long request) { return httpServerRuntime_.RequestServer(request); }
    const wchar_t* HTTP_取请求方法(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestMethod(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取请求目标(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestTarget(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取请求路径(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestPath(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取查询字符串(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestQuery(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取查询参数(long long request, const wchar_t* name) { httpServerReturnText_ = httpServerRuntime_.RequestQueryValue(request, name); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取请求头(long long request, const wchar_t* name) { httpServerReturnText_ = httpServerRuntime_.RequestHeader(request, name); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取全部请求头(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestHeadersJson(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取请求正文(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestBody(request); return httpServerReturnText_.c_str(); }
    const wchar_t* HTTP_取请求正文十六进制(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestBodyHex(request); return httpServerReturnText_.c_str(); }
    long long HTTP_取请求正文大小(long long request) { return httpServerRuntime_.RequestBodySize(request); }
    const wchar_t* HTTP_取客户端地址(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestClientAddress(request); return httpServerReturnText_.c_str(); }
    int HTTP_取客户端端口(long long request) { return httpServerRuntime_.RequestClientPort(request); }
    const wchar_t* HTTP_取协议版本(long long request) { httpServerReturnText_ = httpServerRuntime_.RequestProtocol(request); return httpServerReturnText_.c_str(); }
    bool HTTP_设置状态码(long long request, int status) { return httpServerRuntime_.SetStatus(request, status); }
    bool HTTP_设置响应头(long long request, const wchar_t* name, const wchar_t* value) { return httpServerRuntime_.SetHeader(request, name, value, false); }
    bool HTTP_添加响应头(long long request, const wchar_t* name, const wchar_t* value) { return httpServerRuntime_.SetHeader(request, name, value, true); }
    bool HTTP_设置Cookie(long long request, const wchar_t* name, const wchar_t* value, const wchar_t* path, int maxAge, bool httpOnly, bool secure, const wchar_t* sameSite) { return httpServerRuntime_.SetCookie(request, name, value, path, maxAge, httpOnly, secure, sameSite); }
    bool HTTP_发送文本(long long request, const wchar_t* text, const wchar_t* contentType, int status) { return httpServerRuntime_.CompleteText(request, text, contentType, status); }
    bool HTTP_发送JSON(long long request, const wchar_t* json, int status) { return httpServerRuntime_.CompleteJson(request, json, status); }
    bool HTTP_发送十六进制(long long request, const wchar_t* hex, const wchar_t* contentType, int status) { return httpServerRuntime_.CompleteHex(request, hex, contentType, status); }
    bool HTTP_发送文件(long long request, const wchar_t* path, const wchar_t* name, const wchar_t* contentType, int status) { return httpServerRuntime_.CompleteFile(request, path, name, contentType, status); }
    bool HTTP_重定向(long long request, const wchar_t* location, int status) { return httpServerRuntime_.Redirect(request, location, status); }
    bool HTTP_发送空响应(long long request, int status) { return httpServerRuntime_.CompleteEmpty(request, status); }
    bool HTTP_是否已响应(long long request) { return httpServerRuntime_.IsCompleted(request); }
    bool HTTP_中止请求(long long request) { return httpServerRuntime_.Abort(request); }
    int HTTP_启动服务(int port) { return httpServerRuntime_.LegacyStart(port); }
    const wchar_t* HTTP_等待请求() { httpServerReturnText_ = httpServerRuntime_.LegacyWaitRaw(); return httpServerReturnText_.c_str(); }
    int HTTP_等待请求到调试输出() { const wchar_t* request = HTTP_等待请求(); if (!request || !request[0]) return 0; 调试输出(request); return 1; }
    int HTTP_回复文本(const wchar_t* text) { return httpServerRuntime_.LegacyReply(text); }
    void HTTP_关闭服务() { httpServerRuntime_.LegacyClose(); }
`;
