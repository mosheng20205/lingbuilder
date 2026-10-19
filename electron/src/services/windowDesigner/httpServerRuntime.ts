import { InstalledModule } from '../modules/types';
import { HTTP_SWAGGER_UI_BUNDLE_JS, HTTP_SWAGGER_UI_CSS, HTTP_SWAGGER_UI_VERSION } from './httpSwaggerUiInline.generated';

export const HTTP_SERVER_MODULE_ID = 'lingbuilder.http.server';

export function generateHttpServerRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return HTTP_SERVER_RUNTIME;
}

// 族门控：仅当项目源码实际调用 HTTP_启用接口文档 时，才把 Swagger UI 离线资源（约 1.7MB）
// 拼进生成工程；未用文档的 http.server 项目生成体积零增长。调用方用
// programUsesHttpDocsCommands（lingCppWin32Project.ts）扫描全部语句得出 docsUsed。
export function generateHttpServerDocsRuntime(enabledModules: InstalledModule[], docsUsed: boolean): string {
  if (!docsUsed || !enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return `// HTTP 接口文档离线资源：Swagger UI ${HTTP_SWAGGER_UI_VERSION}（UTF-8 字节集，生成自 scripts/generate-http-swagger-ui.ts）。
static const unsigned char kLingBuilderSwaggerUiJsBytes[] = {${toCppByteArray(Buffer.from(HTTP_SWAGGER_UI_BUNDLE_JS, 'utf8'))}};
static const size_t kLingBuilderSwaggerUiJsSize = sizeof(kLingBuilderSwaggerUiJsBytes);
static const unsigned char kLingBuilderSwaggerUiCssBytes[] = {${toCppByteArray(Buffer.from(HTTP_SWAGGER_UI_CSS, 'utf8'))}};
static const size_t kLingBuilderSwaggerUiCssSize = sizeof(kLingBuilderSwaggerUiCssBytes);
`;
}

function toCppByteArray(bytes: Buffer): string {
  const values: string[] = [];
  for (const value of bytes) values.push(String(value));
  return values.join(',');
}

export function generateHttpServerWindowMethods(enabledModules: InstalledModule[], docsUsed = false): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  return docsUsed ? HTTP_SERVER_WINDOW_METHODS + HTTP_SERVER_DOCS_WINDOW_METHODS : HTTP_SERVER_WINDOW_METHODS;
}

export function generateHttpServerGlobalMethods(enabledModules: InstalledModule[], docsUsed = false): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_SERVER_MODULE_ID)) return '';
  const methods = docsUsed ? HTTP_SERVER_WINDOW_METHODS + HTTP_SERVER_DOCS_WINDOW_METHODS : HTTP_SERVER_WINDOW_METHODS;
  return methods
    .replaceAll('httpServerRuntime_', 'g_httpServerRuntime')
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

    // 返回文本槽：thread_local 轮转，多线程（工作线程处理器等）并发调用文本类命令互不踩踏。
    const wchar_t* ReturnText(std::wstring value) const {
        static thread_local std::vector<std::wstring> slots(16);
        static thread_local size_t index = 0;
        std::wstring& slot = slots[index++ % slots.size()];
        slot = std::move(value);
        return slot.c_str();
    }

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
        if (workers < 1) return ServerFail(server, L"HTTP 工作线程数必须大于 0；不设固定上限，但过大值会受系统线程资源约束。");
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
        // 文档内置路由（/docs 页面、swagger-ui 资源、openapi.json）不属于显式路由，清空时保留。
        server->routes.erase(std::remove_if(server->routes.begin(), server->routes.end(), [](const Route& item) { return !item.docRoute; }), server->routes.end());
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
            return ServerFail(server, L"HTTP 服务启动失败：无法创建工作线程（系统线程资源不足或数值过大）。");
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
        { std::lock_guard<std::mutex> lock(request->mutex); if (request->completed) return false; request->aborted = true; request->completed = true; request->changed.notify_all(); }
        FinalizeSseSession(request);
        return true;
    }

    // —— SSE（Server-Sent Events）单向推送：开始后连接脱离工作线程，会话由运行时接管，推送命令可从任意线程调用 ——
    bool BeginSse(long long requestId) {
        auto request = FindRequest(requestId);
        if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        auto server = FindServer(request->serverId);
        bool ok = false; std::wstring error;
        {
            std::lock_guard<std::mutex> sendLock(request->sendMutex);
            std::lock_guard<std::mutex> lock(request->mutex);
            if (request->completed) error = L"HTTP 请求已经响应或中止，不能再开始 SSE 推送。";
            else if (request->streaming) error = L"该请求已处于 SSE 推送状态，不能重复开始。";
            else if (request->socket == INVALID_SOCKET) error = L"SSE 只能在请求处理器内对当前请求开启。";
            else {
                const std::string headers = BuildSseHeaders(*request);
                if (!SendAll(request->socket, headers.data(), headers.size())) error = L"SSE 响应头发送失败，客户端连接可能已断开。";
                else {
                    request->streaming = true;
                    request->changed.notify_all();
                    if (server) { server->activeConnections.fetch_add(1); server->sseSessions.fetch_add(1); }
                    ok = true;
                }
            }
        }
        return ok ? true : Fail(error);
    }
    bool SsePush(long long requestId, const wchar_t* eventName, const wchar_t* data) {
        auto request = FindRequest(requestId);
        if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        return SseSend(request, BuildSseEvent(eventName ? eventName : L"", data ? data : L""));
    }
    bool SsePing(long long requestId) {
        auto request = FindRequest(requestId);
        if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        static const std::string ping = ": ping\n\n";
        return SseSend(request, ping);
    }
    bool SseEnd(long long requestId) {
        auto request = FindRequest(requestId);
        if (!request) return Fail(L"HTTP 请求句柄无效或已过期。");
        return FinalizeSseSession(request) ? true : Fail(L"该请求没有进行中的 SSE 推送会话。");
    }
    bool SseConnected(long long requestId) {
        auto request = FindRequest(requestId); if (!request) return false;
        bool alive = false;
        {
            std::lock_guard<std::mutex> sendLock(request->sendMutex);
            std::lock_guard<std::mutex> lock(request->mutex);
            if (!request->streaming || request->sseDead || request->socket == INVALID_SOCKET) return false;
            u_long nonBlocking = 1;
            if (ioctlsocket(request->socket, FIONBIO, &nonBlocking) == 0) {
                char probe = 0;
                int result = recv(request->socket, &probe, 1, MSG_PEEK);
                // 错误码必须在 recv 之后立刻捕获：恢复阻塞模式的 ioctlsocket 是一次成功的
                // Winsock 调用，会把本线程的 last error 冲掉，之后 WSAGetLastError 恒为 0。
                int probeError = result == SOCKET_ERROR ? WSAGetLastError() : 0;
                u_long blocking = 0;
                ioctlsocket(request->socket, FIONBIO, &blocking);
                // WSAEWOULDBLOCK=对端没有关闭只是暂时无数据；收到 0（对端关闭）或其他错误视为离线；
                // 收到正数说明对端发来了数据（SSE 客户端一般不发），仍视为在线。
                alive = result == SOCKET_ERROR ? probeError == WSAEWOULDBLOCK : result > 0;
            } else alive = true;
        }
        if (!alive) FinalizeSseSession(request);
        return alive;
    }
    int SseSessions(long long id) const { auto server = FindServer(id); return server ? server->sseSessions.load() : 0; }

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
        // SSE 流式会话：streaming=true 表示响应头已冲出、连接已从工作线程分离；socket 仅在 sendMutex 保护下访问。
        bool streaming = false, sseDead = false; SOCKET socket = INVALID_SOCKET; std::mutex sendMutex;
        Response response; mutable std::mutex mutex; std::condition_variable changed;
    };
    struct StaticResponse { int status = 200; std::string body; std::wstring filePath, contentType = L"text/plain; charset=utf-8", downloadName; };
    struct Route { std::wstring method, pattern, handler; std::shared_ptr<StaticResponse> staticResponse; bool docRoute = false; };
    // 接口文档登记（HTTP_启用接口文档/登记接口/登记接口参数/登记接口示例）：声明性数据，
    // 只影响 /openapi.json 与 /docs 页面内容，不参与路由分发校验。
    struct DocParam { int in = 0; std::wstring name, description, example; bool required = false; };
    struct DocApi {
        std::wstring method, path, name, description, requestExample, responseExample, responseContentType = L"application/json";
        std::vector<DocParam> params;
    };
    struct DocInfo { bool enabled = false; std::wstring prefix, title = L"接口文档"; std::vector<DocApi> apis; };
    struct Connection { SOCKET socket = INVALID_SOCKET; std::wstring address; int port = 0; };
    struct Server {
        long long id = 0; std::wstring address = L"127.0.0.1", defaultHandler, lastError; int configuredPort = 0, actualPort = 0, workerCount = 4, queueLimit = 256, timeoutMs = 30000;
        size_t maxHeaderBytes = 64 * 1024, maxBodyBytes = 16 * 1024 * 1024; bool allowExternal = false, legacy = false;
        std::vector<Route> routes; std::atomic<bool> running{false}, stopping{false}; std::atomic<int> activeConnections{0}; std::atomic<long long> totalRequests{0}; std::atomic<long long> rotationLimit{100}; std::atomic<int> sseSessions{0};
        DocInfo doc;
        SOCKET listenSocket = INVALID_SOCKET; std::thread acceptThread; std::vector<std::thread> workers; std::deque<Connection> queue; std::set<SOCKET> activeSockets;
        std::deque<long long> legacyRequests; mutable std::mutex mutex, lifecycleMutex; std::condition_variable queueChanged, legacyChanged;
    };

    std::shared_ptr<Server> FindServer(long long id) const { std::lock_guard<std::mutex> lock(mutex_); auto found = servers_.find(id); return found == servers_.end() ? nullptr : found->second; }
    std::shared_ptr<Request> FindRequest(long long id) const { std::lock_guard<std::mutex> lock(mutex_); auto found = requests_.find(id); return found == requests_.end() ? nullptr : found->second; }
    bool Fail(const std::wstring& message) const { std::lock_guard<std::mutex> lock(mutex_); return FailLocked(message); }
    long long FailId(const std::wstring& message) const { Fail(message); return 0; }
    bool FailLocked(const std::wstring& message) const { lastError_ = message; return false; }
    static bool ServerFail(const std::shared_ptr<Server>& server, const std::wstring& message) { server->lastError = message; return false; }

public:
    // —— 接口文档（OpenAPI 3.0.3 + 离线 Swagger UI，HTTP_启用接口文档 命令族）——
    static std::wstring DocInLabel(int position) { return position == 1 ? L"path" : position == 2 ? L"query" : L"header"; }
    static bool DocPrefixPatternHits(const std::wstring& pattern, const std::wstring& path) {
        if (pattern.size() < 2 || pattern.compare(pattern.size() - 2, 2, L"/*") != 0) return false;
        const std::wstring base = pattern.substr(0, pattern.size() - 1);
        return path.size() >= base.size() && path.compare(0, base.size(), base) == 0;
    }
    static void DocReplaceAll(std::string& text, const std::string& from, const std::string& to) {
        size_t at = 0;
        while ((at = text.find(from, at)) != std::string::npos) { text.replace(at, from.size(), to); at += to.size(); }
    }
    static DocApi* FindDocApiLockedMutable(Server& server, const std::wstring& method, const std::wstring& path) {
        for (auto& item : server.doc.apis) if (item.method == method && item.path == path) return &item;
        return nullptr;
    }
    void RefreshDocsRouteLocked(const std::shared_ptr<Server>& server) {
        if (!server->doc.enabled) return;
        auto response = std::make_shared<StaticResponse>();
        response->body = LB_WideToUtf8(BuildDocsJsonLocked(*server).c_str());
        response->contentType = L"application/json; charset=utf-8";
        UpsertRoute(server, { L"GET", server->doc.prefix + L"/openapi.json", L"", response, true });
    }
    // OpenAPI 3.0.3 文档；只产出 summary/description/parameters/示例，schema 恒 string（一期不做对象建模）。
    static std::wstring BuildDocsJsonLocked(const Server& server) {
        std::wstring out = L"{\"openapi\":\"3.0.3\",\"info\":{\"title\":\"" + JsonEscape(server.doc.title) + L"\",\"version\":\"1.0.0\"},\"servers\":[{\"url\":\"/\"}],\"paths\":{";
        bool firstPath = true;
        for (size_t index = 0; index < server.doc.apis.size(); ++index) {
            const DocApi& api = server.doc.apis[index];
            bool clustered = false;
            for (size_t prior = 0; prior < index; ++prior) if (server.doc.apis[prior].path == api.path) { clustered = true; break; }
            if (clustered) continue;
            if (!firstPath) out += L",";
            firstPath = false;
            out += L"\"" + JsonEscape(api.path) + L"\":{";
            bool firstMethod = true;
            for (size_t next = index; next < server.doc.apis.size(); ++next) {
                const DocApi& item = server.doc.apis[next];
                if (item.path != api.path) continue;
                if (!firstMethod) out += L",";
                firstMethod = false;
                out += L"\"" + Lower(item.method) + L"\":{\"summary\":\"" + JsonEscape(item.name.empty() ? item.method + L" " + item.path : item.name) + L"\"";
                if (!item.description.empty()) out += L",\"description\":\"" + JsonEscape(item.description) + L"\"";
                if (!item.params.empty()) {
                    out += L",\"parameters\":[";
                    bool firstParam = true;
                    for (const auto& param : item.params) {
                        if (!firstParam) out += L",";
                        firstParam = false;
                        out += L"{\"name\":\"" + JsonEscape(param.name) + L"\",\"in\":\"" + DocInLabel(param.in) + L"\",\"required\":" + (param.required ? L"true" : L"false")
                            + L",\"description\":\"" + JsonEscape(param.description.empty() ? param.name : param.description)
                            + L"\",\"schema\":{\"type\":\"string\"},\"example\":\"" + JsonEscape(param.example) + L"\"}";
                    }
                    out += L"]";
                }
                if (!item.requestExample.empty()) {
                    out += L",\"requestBody\":{\"required\":false,\"content\":{\"application/json\":{\"example\":\"" + JsonEscape(item.requestExample) + L"\"}}}";
                }
                out += L",\"responses\":{\"200\":{\"description\":\"成功\"";
                if (!item.responseExample.empty()) {
                    out += L",\"content\":{\"" + JsonEscape(item.responseContentType.empty() ? L"application/json" : item.responseContentType) + L"\":{\"example\":\"" + JsonEscape(item.responseExample) + L"\"}}";
                }
                out += L"}}}";
            }
            out += L"}";
        }
        out += L"}}";
        return out;
    }
    bool EnableDocs(long long id, const wchar_t* prefix, const wchar_t* title, const unsigned char* jsBytes, size_t jsSize, const unsigned char* cssBytes, size_t cssSize) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring docPrefix = prefix ? prefix : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (!jsBytes || jsSize == 0 || !cssBytes || cssSize == 0) return ServerFail(server, L"HTTP 接口文档离线资源缺失，请重新生成工程。");
        while (docPrefix.size() > 1 && docPrefix.back() == L'/') docPrefix.pop_back();
        if (docPrefix.empty() || docPrefix[0] != L'/') return ServerFail(server, L"HTTP 接口文档路径前缀必须以 / 开头，如 \"/docs\"。");
        if (docPrefix.find(L'*') != std::wstring::npos) return ServerFail(server, L"HTTP 接口文档路径前缀不支持 * 通配，请填写精确路径，如 \"/docs\"。");
        const std::wstring specPath = docPrefix + L"/openapi.json";
        const std::wstring jsPath = docPrefix + L"/swagger-ui-bundle.js";
        const std::wstring cssPath = docPrefix + L"/swagger-ui.css";
        for (const auto& route : server->routes) {
            if (route.docRoute) continue;
            if (route.method != L"GET" && route.method != L"*") continue;
            if (route.pattern == docPrefix || route.pattern == specPath || route.pattern == jsPath || route.pattern == cssPath
                || DocPrefixPatternHits(route.pattern, docPrefix) || DocPrefixPatternHits(route.pattern, specPath)
                || DocPrefixPatternHits(route.pattern, jsPath) || DocPrefixPatternHits(route.pattern, cssPath)) {
                return ServerFail(server, L"HTTP 接口文档路径与已有路由冲突：请更换前缀，或先移除同路径的显式路由。");
            }
        }
        // 重复启用：移除全部旧文档路由后整体覆盖注册。
        server->routes.erase(std::remove_if(server->routes.begin(), server->routes.end(), [](const Route& item) { return item.docRoute; }), server->routes.end());
        std::string titleUtf8 = LB_WideToUtf8(title && title[0] ? title : server->doc.title.c_str());
        DocReplaceAll(titleUtf8, "<", "&lt;");
        std::string page = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>";
        page += titleUtf8;
        page += "</title>\n<link rel=\"icon\" href=\"data:,\">\n<link rel=\"stylesheet\" href=\"";
        page += LB_WideToUtf8(cssPath.c_str());
        page += "\">\n</head>\n<body>\n<div id=\"swagger-ui\"></div>\n<script src=\"";
        page += LB_WideToUtf8(jsPath.c_str());
        page += "\"></script>\n<script>\nwindow.addEventListener('DOMContentLoaded', function () {\n  window.ui = SwaggerUIBundle({\n    url: '";
        page += LB_WideToUtf8(specPath.c_str());
        page += "',\n    dom_id: '#swagger-ui',\n    docExpansion: 'list',\n    defaultModelsExpandDepth: -1,\n    tryItOutEnabled: true\n  });\n});\n</script>\n</body>\n</html>\n";
        auto pageResponse = std::make_shared<StaticResponse>();
        pageResponse->body = std::move(page);
        pageResponse->contentType = L"text/html; charset=utf-8";
        UpsertRoute(server, { L"GET", docPrefix, L"", pageResponse, true });
        auto jsResponse = std::make_shared<StaticResponse>();
        jsResponse->body.assign(reinterpret_cast<const char*>(jsBytes), jsSize);
        jsResponse->contentType = L"text/javascript; charset=utf-8";
        UpsertRoute(server, { L"GET", jsPath, L"", jsResponse, true });
        auto cssResponse = std::make_shared<StaticResponse>();
        cssResponse->body.assign(reinterpret_cast<const char*>(cssBytes), cssSize);
        cssResponse->contentType = L"text/css; charset=utf-8";
        UpsertRoute(server, { L"GET", cssPath, L"", cssResponse, true });
        server->doc.enabled = true;
        server->doc.prefix = docPrefix;
        if (title && title[0]) server->doc.title = title;
        RefreshDocsRouteLocked(server);
        return true;
    }
    bool RegisterApi(long long id, const wchar_t* method, const wchar_t* path, const wchar_t* name, const wchar_t* description) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePath = path ? path : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (!server->doc.enabled) return ServerFail(server, L"请先调用 HTTP_启用接口文档 启用接口文档，再登记接口。");
        if (routeMethod.empty() || routeMethod == L"*") return ServerFail(server, L"HTTP_登记接口 必须写具体方法（GET、POST 等），不支持 * 通配。");
        if (!IsMethodToken(routeMethod)) return ServerFail(server, L"HTTP_登记接口 的方法包含非法字符。");
        if (routePath.empty() || routePath[0] != L'/') return ServerFail(server, L"HTTP_登记接口 的路径必须以 / 开头。");
        if (routePath.find(L'*') != std::wstring::npos) return ServerFail(server, L"HTTP_登记接口 的路径不支持 * 通配，请登记具体路径或代表性路径。");
        auto found = std::find_if(server->doc.apis.begin(), server->doc.apis.end(), [&](const DocApi& item) { return item.method == routeMethod && item.path == routePath; });
        if (found != server->doc.apis.end()) {
            // 重复登记：名称与说明覆盖，已登记的参数与示例保留。
            found->name = name ? name : L"";
            found->description = description ? description : L"";
        } else {
            server->doc.apis.push_back({ routeMethod, routePath, name ? name : L"", description ? description : L"" });
        }
        RefreshDocsRouteLocked(server);
        return true;
    }
    bool RegisterApiParam(long long id, const wchar_t* method, const wchar_t* path, int position, const wchar_t* name, const wchar_t* description, const wchar_t* example, bool required) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePath = path ? path : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (!server->doc.enabled) return ServerFail(server, L"请先调用 HTTP_启用接口文档 启用接口文档，再登记参数。");
        if (position < 1 || position > 3) return ServerFail(server, L"HTTP_登记接口参数 的参数位置必须是 #接口参数_路径、#接口参数_查询 或 #接口参数_请求头。");
        if (!name || !name[0]) return ServerFail(server, L"HTTP_登记接口参数 的参数名不能为空。");
        DocApi* api = FindDocApiLockedMutable(*server, routeMethod, routePath);
        if (!api) return ServerFail(server, L"HTTP_登记接口参数 找不到对应接口：请先用 HTTP_登记接口 登记同方法同路径的接口。");
        DocParam param;
        param.in = position;
        param.name = name;
        param.description = description ? description : L"";
        param.example = example ? example : L"";
        param.required = position == 1 ? true : required;
        auto found = std::find_if(api->params.begin(), api->params.end(), [&](const DocParam& item) { return item.in == param.in && item.name == param.name; });
        if (found != api->params.end()) *found = param;
        else api->params.push_back(std::move(param));
        RefreshDocsRouteLocked(server);
        return true;
    }
    bool RegisterApiExample(long long id, const wchar_t* method, const wchar_t* path, const wchar_t* requestExample, const wchar_t* responseExample, const wchar_t* responseContentType) {
        auto server = FindServer(id);
        if (!server) return Fail(L"HTTP 服务端句柄无效。");
        std::wstring routeMethod = Upper(method ? method : L"");
        std::wstring routePath = path ? path : L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (!server->doc.enabled) return ServerFail(server, L"请先调用 HTTP_启用接口文档 启用接口文档，再登记示例。");
        DocApi* api = FindDocApiLockedMutable(*server, routeMethod, routePath);
        if (!api) return ServerFail(server, L"HTTP_登记接口示例 找不到对应接口：请先用 HTTP_登记接口 登记同方法同路径的接口。");
        const bool hasRequest = requestExample && requestExample[0];
        const bool hasResponse = responseExample && responseExample[0];
        if (!hasRequest && !hasResponse) return ServerFail(server, L"HTTP_登记接口示例 的请求体示例与响应示例不能同时为空。");
        if (hasRequest) api->requestExample = requestExample;
        if (hasResponse) {
            api->responseExample = responseExample;
            if (responseContentType && responseContentType[0]) api->responseContentType = responseContentType;
            else if (api->responseContentType.empty()) api->responseContentType = L"application/json";
        }
        RefreshDocsRouteLocked(server);
        return true;
    }
    std::wstring DocsJson(long long id) const {
        auto server = FindServer(id);
        if (!server) return L"";
        std::lock_guard<std::mutex> lock(server->mutex);
        if (!server->doc.enabled) return L"";
        return BuildDocsJsonLocked(*server);
    }

private:
    // —— SSE 会话内部管理 ——
    static void CloseSseSocketLocked(const std::shared_ptr<Request>& request) {
        if (request->socket != INVALID_SOCKET) { shutdown(request->socket, SD_BOTH); closesocket(request->socket); request->socket = INVALID_SOCKET; }
    }
    // 关闭 SSE 会话并从注册表移除（非流式请求为无害空操作）；调用方不得在持有 request->sendMutex / mutex_ 时进入本函数。
    bool FinalizeSseSession(const std::shared_ptr<Request>& request) {
        bool wasStreaming = false;
        {
            std::lock_guard<std::mutex> sendLock(request->sendMutex);
            std::lock_guard<std::mutex> lock(request->mutex);
            if (!request->streaming) return false;
            wasStreaming = true;
            CloseSseSocketLocked(request);
            request->streaming = false; request->sseDead = true; request->completed = true;
            request->changed.notify_all();
        }
        auto server = FindServer(request->serverId);
        if (server) { server->activeConnections.fetch_sub(1); server->sseSessions.fetch_sub(1); }
        { std::lock_guard<std::mutex> lock(mutex_); requests_.erase(request->id); }
        return wasStreaming;
    }
    bool SseSend(const std::shared_ptr<Request>& request, const std::string& payload) {
        bool dead = false, sendFailed = false;
        {
            std::lock_guard<std::mutex> sendLock(request->sendMutex);
            std::lock_guard<std::mutex> lock(request->mutex);
            if (!request->streaming || request->sseDead) dead = true;
            else if (request->socket == INVALID_SOCKET) sendFailed = true;
            else if (!SendAll(request->socket, payload.data(), payload.size())) sendFailed = true;
        }
        if (sendFailed) FinalizeSseSession(request);
        if (dead) return Fail(L"SSE 会话尚未开始或已结束，不能推送。");
        if (sendFailed) return Fail(L"SSE 推送失败，客户端连接已断开。");
        return true;
    }
    static std::string BuildSseHeaders(const Request& request) {
        std::ostringstream header;
        header << (request.protocol == L"HTTP/1.0" ? "HTTP/1.0 " : "HTTP/1.1 ") << "200 OK\r\n";
        for (const auto& item : request.response.headers) {
            // SSE 的 Content-Type 必须是 text/event-stream，用户通过 HTTP_设置响应头 写入的同名头在此统一覆盖。
            if (Lower(item.name) == L"content-type") continue;
            header << LB_WideToUtf8(item.name.c_str()) << ": " << LB_WideToUtf8(item.value.c_str()) << "\r\n";
        }
        header << "Content-Type: text/event-stream; charset=utf-8\r\nCache-Control: no-cache\r\nConnection: close\r\nX-Accel-Buffering: no\r\n\r\n";
        return header.str();
    }
    // 组装单条 SSE 事件：事件名一行（剔除 CR/LF），数据按行拆分为多条 data: 字段，空行结束事件。
    static std::string BuildSseEvent(const std::wstring& eventName, const std::wstring& data) {
        std::string output;
        std::wstring name = eventName;
        name.erase(std::remove_if(name.begin(), name.end(), [](wchar_t ch) { return ch == L'\r' || ch == L'\n'; }), name.end());
        if (!name.empty()) output += "event: " + LB_WideToUtf8(name.c_str()) + "\n";
        std::vector<std::wstring> lines;
        size_t start = 0;
        while (start <= data.size()) {
            size_t pos = data.find_first_of(L"\r\n", start);
            if (pos == std::wstring::npos) { lines.push_back(data.substr(start)); break; }
            lines.push_back(data.substr(start, pos - start));
            start = data[pos] == L'\r' && pos + 1 < data.size() && data[pos + 1] == L'\n' ? pos + 2 : pos + 1;
        }
        if (lines.size() > 1 && lines.back().empty()) lines.pop_back();
        for (const auto& line : lines) output += "data: " + LB_WideToUtf8(line.c_str()) + "\n";
        output += "\n";
        return output;
    }

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
            bool detached = false;
            try { detached = HandleConnection(server, connection); }
            catch (...) { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = L"HTTP 工作线程处理连接时发生未预期错误。"; }
            server->activeConnections.fetch_sub(1);
            { std::lock_guard<std::mutex> lock(server->mutex); server->activeSockets.erase(connection.socket); }
            // SSE 会话分离后连接所有权移交运行时（请求句柄继续可推送），工作线程不得关闭该套接字。
            if (!detached) CloseSocket(connection.socket);
        }
    }

    bool HandleConnection(const std::shared_ptr<Server>& server, Connection& connection) {
        int timeout = server->timeoutMs; setsockopt(connection.socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout)); setsockopt(connection.socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
        std::string pending;
        for (long long requestIndex = 0; server->running.load(); ++requestIndex) {
            const bool allowKeepAlive = requestIndex + 1 < server->rotationLimit.load();
            auto request = std::make_shared<Request>(); request->id = nextRequestId_.fetch_add(1); request->serverId = server->id; request->clientAddress = connection.address; request->clientPort = connection.port; request->socket = connection.socket;
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
                if (!request->changed.wait_for(lock, std::chrono::milliseconds(server->timeoutMs), [&]() { return (request->completed && !request->dispatching) || request->streaming || server->stopping.load(); })) {
                    request->response.status = 504; request->response.body = "Gateway Timeout"; request->response.contentType = L"text/plain; charset=utf-8"; request->completed = true;
                }
                while (request->dispatching && !server->stopping.load()) request->changed.wait(lock);
                // SSE：HTTP_SSE_开始 已冲出响应头，连接所有权移交会话；请求句柄保留在注册表中供推送命令使用。
                if (request->streaming) return true;
                if (server->stopping.load() && !request->completed) { request->aborted = true; request->completed = true; }
            }
            bool keepAlive = SendResponse(connection.socket, *request, allowKeepAlive);
            { std::lock_guard<std::mutex> lock(mutex_); requests_.erase(request->id); }
            if (!keepAlive) break;
        }
        return false;
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
        // —— Range 断点续传：只对成功打开的文件响应生效（静态文件路由与 HTTP_发送文件 共用本路径） ——
        bool isRange = false, rangeUnsatisfiable = false; unsigned long long rangeStart = 0, rangeEnd = 0, totalSize = contentLength;
        if (!response.filePath.empty() && file.is_open() && request.method != L"HEAD") {
            auto rangeHeader = request.headers.find(L"range");
            if (rangeHeader != request.headers.end()) {
                LB_HttpRange range = ParseRangeHeader(rangeHeader->second, contentLength);
                if (range.unsatisfiable) rangeUnsatisfiable = true;
                else if (range.valid) { isRange = true; rangeStart = range.start; rangeEnd = range.end; }
            }
        }
        if (rangeUnsatisfiable) {
            response.status = 416; response.body = "Requested Range Not Satisfiable"; response.filePath.clear(); response.contentType = L"text/plain; charset=utf-8"; contentLength = response.body.size();
            response.headers.push_back({ L"Content-Range", L"bytes */" + std::to_wstring(totalSize) });
        } else if (isRange) {
            response.status = 206; contentLength = rangeEnd - rangeStart + 1;
            response.headers.push_back({ L"Content-Range", L"bytes " + std::to_wstring(rangeStart) + L"-" + std::to_wstring(rangeEnd) + L"/" + std::to_wstring(totalSize) });
        }
        if (!response.filePath.empty() && !rangeUnsatisfiable) response.headers.push_back({ L"Accept-Ranges", L"bytes" });
        if (response.status == 204 || response.status == 304 || (response.status >= 100 && response.status < 200)) { response.body.clear(); response.filePath.clear(); contentLength = 0; }
        bool keepAlive = request.keepAlive && allowKeepAlive;
        std::ostringstream header; header << (request.protocol == L"HTTP/1.0" ? "HTTP/1.0 " : "HTTP/1.1 ") << response.status << " " << Reason(response.status) << "\r\n";
        bool hasType = false; for (const auto& item : response.headers) { if (Lower(item.name) == L"content-type") hasType = true; header << LB_WideToUtf8(item.name.c_str()) << ": " << LB_WideToUtf8(item.value.c_str()) << "\r\n"; }
        if (!hasType && contentLength > 0) header << "Content-Type: " << LB_WideToUtf8(response.contentType.c_str()) << "\r\n";
        header << "Content-Length: " << contentLength << "\r\nConnection: " << (keepAlive ? "keep-alive" : "close") << "\r\nX-Content-Type-Options: nosniff\r\n\r\n";
        const std::string head = header.str(); if (!SendAll(socketValue, head.data(), head.size())) return false;
        if (request.method == L"HEAD") return keepAlive;
        if (!response.filePath.empty()) {
            if (isRange) file.seekg(static_cast<std::streamoff>(rangeStart), std::ios::beg);
            char buffer[64 * 1024]; unsigned long long remaining = isRange ? contentLength : 0;
            while (file) {
                if (isRange && remaining == 0) break;
                // sizeof(buffer) 在 32 位构建下是 unsigned int，与 remaining（unsigned long long）直接进 std::min 会让模板参数推导失败（C2672），必须先统一成同类型。
                const size_t wanted = isRange ? static_cast<size_t>((std::min)(static_cast<unsigned long long>(sizeof(buffer)), remaining)) : sizeof(buffer);
                file.read(buffer, static_cast<std::streamsize>(wanted));
                std::streamsize count = file.gcount();
                if (count <= 0) break;
                if (!SendAll(socketValue, buffer, static_cast<size_t>(count))) return false;
                if (isRange) remaining -= static_cast<unsigned long long>(count);
            }
        }
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
        JoinThreads(server);
        // 工作线程全部退出后，关闭该服务端残存的 SSE 流式会话（连接所有权在会话手中，上面 activeSockets 的 shutdown 管不到）。
        std::vector<std::shared_ptr<Request>> streamingSessions;
        { std::lock_guard<std::mutex> lock(mutex_); for (const auto& pair : requests_) if (pair.second->serverId == server->id && pair.second->streaming) streamingSessions.push_back(pair.second); }
        for (const auto& request : streamingSessions) FinalizeSseSession(request);
        server->stopping.store(false); return true;
    }
    static void JoinThreads(const std::shared_ptr<Server>& server) { if (server->acceptThread.joinable()) server->acceptThread.join(); for (auto& worker : server->workers) if (worker.joinable()) worker.join(); server->workers.clear(); }
    static void CloseSocket(SOCKET& value) { SOCKET current = value; value = INVALID_SOCKET; if (current != INVALID_SOCKET) { shutdown(current, SD_BOTH); closesocket(current); } }
    static bool SendAll(SOCKET socketValue, const char* data, size_t length) { size_t sent = 0; while (sent < length) { int count = send(socketValue, data + sent, static_cast<int>((std::min)(length - sent, static_cast<size_t>(INT_MAX))), 0); if (count <= 0) return false; sent += static_cast<size_t>(count); } return true; }
    static void SendSimpleError(SOCKET socketValue, int status, const char* reason) { std::string body = reason ? reason : "HTTP Error"; std::ostringstream output; output << "HTTP/1.1 " << status << " " << body << "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " << body.size() << "\r\nConnection: close\r\n\r\n" << body; std::string value = output.str(); SendAll(socketValue, value.data(), value.size()); }
    static const char* Reason(int status) { switch (status) { case 100:return "Continue"; case 200:return "OK"; case 201:return "Created"; case 202:return "Accepted"; case 204:return "No Content"; case 206:return "Partial Content"; case 301:return "Moved Permanently"; case 302:return "Found"; case 303:return "See Other"; case 304:return "Not Modified"; case 307:return "Temporary Redirect"; case 308:return "Permanent Redirect"; case 400:return "Bad Request"; case 401:return "Unauthorized"; case 403:return "Forbidden"; case 404:return "Not Found"; case 405:return "Method Not Allowed"; case 408:return "Request Timeout"; case 409:return "Conflict"; case 413:return "Payload Too Large"; case 415:return "Unsupported Media Type"; case 416:return "Requested Range Not Satisfiable"; case 417:return "Expectation Failed"; case 422:return "Unprocessable Content"; case 429:return "Too Many Requests"; case 431:return "Request Header Fields Too Large"; case 500:return "Internal Server Error"; case 501:return "Not Implemented"; case 502:return "Bad Gateway"; case 503:return "Service Unavailable"; case 504:return "Gateway Timeout"; default:return "Status"; } }
    static std::wstring RequestHeaderValue(const Request& request, const std::wstring& name) { auto found = request.headers.find(name); return found == request.headers.end() ? L"" : found->second; }
    static bool ParseUnsigned(const std::wstring& text, unsigned long long& value) { if (text.empty()) return false; value = 0; for (wchar_t ch : text) { if (ch < L'0' || ch > L'9' || value > (std::numeric_limits<unsigned long long>::max() - static_cast<unsigned>(ch - L'0')) / 10) return false; value = value * 10 + static_cast<unsigned>(ch - L'0'); } return true; }
    static std::wstring TrimWide(const std::wstring& value) { const wchar_t* whitespace = L" \t"; size_t first = value.find_first_not_of(whitespace), last = value.find_last_not_of(whitespace); return first == std::wstring::npos ? std::wstring() : value.substr(first, last - first + 1); }
    // Range 头解析（RFC 9110 §14）：bytes=start-end / bytes=start- / bytes=-suffix；
    // 多段范围、语法非法一律按无 Range 处理（返回 200 全量）；start 超出文件大小按 416 处理。
    struct LB_HttpRange { bool valid = false; bool unsatisfiable = false; unsigned long long start = 0, end = 0; };
    static LB_HttpRange ParseRangeHeader(const std::wstring& header, unsigned long long fileSize) {
        LB_HttpRange range;
        std::wstring value = Lower(header);
        if (value.rfind(L"bytes=", 0) != 0) return range;
        const std::wstring spec = value.substr(6);
        if (spec.find(L',') != std::wstring::npos) return range;
        const size_t dash = spec.find(L'-'); if (dash == std::wstring::npos) return range;
        const std::wstring left = TrimWide(spec.substr(0, dash)), right = TrimWide(spec.substr(dash + 1));
        if (left.empty() && right.empty()) return range;
        if (left.empty()) {
            unsigned long long suffix = 0;
            if (!ParseUnsigned(right, suffix) || suffix == 0 || fileSize == 0) return range;
            range.valid = true; range.start = fileSize > suffix ? fileSize - suffix : 0; range.end = fileSize - 1; return range;
        }
        if (!ParseUnsigned(left, range.start)) return range;
        if (range.start >= fileSize) { range.unsatisfiable = true; return range; }
        range.valid = true;
        if (right.empty()) { range.end = fileSize - 1; return range; }
        if (!ParseUnsigned(right, range.end)) { range.valid = false; return range; }
        if (range.end < range.start) { range.valid = false; return range; }
        if (range.end > fileSize - 1) range.end = fileSize - 1;
        return range;
    }
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
    const wchar_t* HTTP_取监听地址(long long server) { return httpServerRuntime_.ReturnText(httpServerRuntime_.Address(server)); }
    int HTTP_取监听端口(long long server) { return httpServerRuntime_.Port(server); }
    int HTTP_取活动连接数(long long server) { return httpServerRuntime_.ActiveConnections(server); }
    long long HTTP_取累计请求数(long long server) { return httpServerRuntime_.TotalRequests(server); }
    const wchar_t* HTTP_取服务错误(long long server) { return httpServerRuntime_.ReturnText(httpServerRuntime_.Error(server)); }
    long long HTTP_取当前请求() { return httpServerRuntime_.CurrentRequest(); }
    long long HTTP_取请求服务(long long request) { return httpServerRuntime_.RequestServer(request); }
    const wchar_t* HTTP_取请求方法(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestMethod(request)); }
    const wchar_t* HTTP_取请求目标(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestTarget(request)); }
    const wchar_t* HTTP_取请求路径(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestPath(request)); }
    const wchar_t* HTTP_取查询字符串(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestQuery(request)); }
    const wchar_t* HTTP_取查询参数(long long request, const wchar_t* name) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestQueryValue(request, name)); }
    const wchar_t* HTTP_取请求头(long long request, const wchar_t* name) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestHeader(request, name)); }
    const wchar_t* HTTP_取全部请求头(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestHeadersJson(request)); }
    const wchar_t* HTTP_取请求正文(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestBody(request)); }
    const wchar_t* HTTP_取请求正文十六进制(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestBodyHex(request)); }
    long long HTTP_取请求正文大小(long long request) { return httpServerRuntime_.RequestBodySize(request); }
    const wchar_t* HTTP_取客户端地址(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestClientAddress(request)); }
    int HTTP_取客户端端口(long long request) { return httpServerRuntime_.RequestClientPort(request); }
    const wchar_t* HTTP_取协议版本(long long request) { return httpServerRuntime_.ReturnText(httpServerRuntime_.RequestProtocol(request)); }
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
    const wchar_t* HTTP_等待请求() { return httpServerRuntime_.ReturnText(httpServerRuntime_.LegacyWaitRaw()); }
    int HTTP_等待请求到调试输出() { const wchar_t* request = HTTP_等待请求(); if (!request || !request[0]) return 0; 调试输出(request); return 1; }
    int HTTP_回复文本(const wchar_t* text) { return httpServerRuntime_.LegacyReply(text); }
    void HTTP_关闭服务() { httpServerRuntime_.LegacyClose(); }
    bool HTTP_SSE_开始(long long request) { return httpServerRuntime_.BeginSse(request); }
    bool HTTP_SSE_推送(long long request, const wchar_t* data) { return httpServerRuntime_.SsePush(request, nullptr, data); }
    bool HTTP_SSE_推送事件(long long request, const wchar_t* eventName, const wchar_t* data) { return httpServerRuntime_.SsePush(request, eventName, data); }
    bool HTTP_SSE_推送心跳(long long request) { return httpServerRuntime_.SsePing(request); }
    bool HTTP_SSE_结束(long long request) { return httpServerRuntime_.SseEnd(request); }
    bool HTTP_SSE_是否连接(long long request) { return httpServerRuntime_.SseConnected(request); }
    int HTTP_SSE_取连接数(long long server) { return httpServerRuntime_.SseSessions(server); }
`;

// 接口文档命令族门面：仅当项目源码实际调用 HTTP_启用接口文档 时随族门控拼入
// （kLingBuilderSwaggerUi*Bytes 同门控，见 generateHttpServerDocsRuntime）。
const HTTP_SERVER_DOCS_WINDOW_METHODS = String.raw`
    bool HTTP_启用接口文档(long long server, const wchar_t* prefix, const wchar_t* title) { return httpServerRuntime_.EnableDocs(server, prefix, title, kLingBuilderSwaggerUiJsBytes, sizeof(kLingBuilderSwaggerUiJsBytes), kLingBuilderSwaggerUiCssBytes, sizeof(kLingBuilderSwaggerUiCssBytes)); }
    bool HTTP_登记接口(long long server, const wchar_t* method, const wchar_t* path, const wchar_t* name, const wchar_t* description) { return httpServerRuntime_.RegisterApi(server, method, path, name, description); }
    bool HTTP_登记接口参数(long long server, const wchar_t* method, const wchar_t* path, int position, const wchar_t* name, const wchar_t* description, const wchar_t* example, bool required) { return httpServerRuntime_.RegisterApiParam(server, method, path, position, name, description, example, required); }
    bool HTTP_登记接口示例(long long server, const wchar_t* method, const wchar_t* path, const wchar_t* requestExample, const wchar_t* responseExample, const wchar_t* responseContentType) { return httpServerRuntime_.RegisterApiExample(server, method, path, requestExample, responseExample, responseContentType); }
    const wchar_t* HTTP_取接口文档JSON(long long server) { return httpServerRuntime_.ReturnText(httpServerRuntime_.DocsJson(server)); }
`;
