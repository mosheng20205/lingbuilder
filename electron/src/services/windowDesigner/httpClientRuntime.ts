import { InstalledModule } from '../modules/types';

export const HTTP_CLIENT_MODULE_ID = 'lingbuilder.net.http-client';

export function generateHttpClientRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_CLIENT_MODULE_ID)) return '';
  return HTTP_CLIENT_RUNTIME;
}

export function generateHttpClientWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_CLIENT_MODULE_ID)) return '';
  return HTTP_CLIENT_WINDOW_METHODS;
}

export function generateHttpClientGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_CLIENT_MODULE_ID)) return '';
  return HTTP_CLIENT_WINDOW_METHODS
    .replaceAll('httpClientRuntime_', 'g_httpClientRuntime')
    .replaceAll('httpClientReturnText_', 'g_httpClientReturnText')
    .replace(/^    /gmu, 'static ');
}

export function generateHttpClientGlobalMethodDeclarations(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === HTTP_CLIENT_MODULE_ID)) return '';
  return HTTP_CLIENT_WINDOW_METHODS.trim().split(/\r?\n/u).map(line => {
    const normalized = line.trim();
    const signatureEnd = normalized.indexOf(' {');
    if (signatureEnd < 0) throw new Error(`HTTP 客户端包装方法缺少函数体：${normalized}`);
    return `static ${normalized.slice(0, signatureEnd)};`;
  }).join('\n');
}

const HTTP_CLIENT_RUNTIME = String.raw`
class LingHttpClientRuntime {
public:
    using NotifyEvent = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingHttpClientRuntime(NotifyEvent notify) : notify_(std::move(notify)) {}
    ~LingHttpClientRuntime() { Shutdown(); }

    long long CreateClient() {
        auto client = std::make_shared<Client>();
        client->id = nextClientId_.fetch_add(1);
        std::lock_guard<std::mutex> lock(clientsMutex_);
        clients_[client->id] = client;
        return client->id;
    }

    bool DestroyClient(long long id) {
        std::shared_ptr<Client> client;
        {
            std::lock_guard<std::mutex> lock(clientsMutex_);
            auto found = clients_.find(id);
            if (found == clients_.end()) return false;
            client = found->second;
            clients_.erase(found);
        }
        std::vector<std::shared_ptr<Request>> requests;
        {
            std::lock_guard<std::mutex> lock(requestsMutex_);
            for (const auto& item : requests_) if (item.second->clientId == id) requests.push_back(item.second);
        }
        for (const auto& request : requests) {
            CancelRequest(request);
            JoinRequest(request);
        }
        CloseClientSession(client);
        ClearSensitiveClientState(client);
        if (legacyClientId_ == id) { legacyClientId_ = 0; legacyRequestId_ = 0; }
        return true;
    }

    bool SetUserAgent(long long id, const wchar_t* value) {
        return UpdateClient(id, [&](Client& client) {
            const std::wstring text = value ? value : L"";
            if (text.empty() || ContainsControl(text)) return ClientFail(client, L"HTTP User-Agent 不能为空或包含控制字符。");
            client.userAgent = text; return true;
        });
    }

    bool SetTimeouts(long long id, int resolveMs, int connectMs, int sendMs, int receiveMs) {
        return UpdateClient(id, [&](Client& client) {
            if (!ValidTimeout(resolveMs) || !ValidTimeout(connectMs) || !ValidTimeout(sendMs) || !ValidTimeout(receiveMs)) return ClientFail(client, L"HTTP 超时必须在 100 到 3600000 毫秒之间。");
            client.resolveTimeoutMs = resolveMs; client.connectTimeoutMs = connectMs; client.sendTimeoutMs = sendMs; client.receiveTimeoutMs = receiveMs; return true;
        });
    }

    bool SetLimits(long long id, int headerKb, int bodyMb, int uploadMb, int redirects) {
        return UpdateClient(id, [&](Client& client) {
            if (headerKb < 1 || headerKb > 1024 || bodyMb < 1 || bodyMb > 4096 || uploadMb < 1 || uploadMb > 4096 || redirects < 0 || redirects > 100) return ClientFail(client, L"HTTP 资源限制超出范围：响应头 1-1024KB，响应体/上传 1-4096MB，重定向 0-100 次。");
            client.maxHeaderBytes = static_cast<size_t>(headerKb) * 1024; client.maxBodyBytes = static_cast<size_t>(bodyMb) * 1024 * 1024; client.maxUploadBytes = static_cast<size_t>(uploadMb) * 1024 * 1024; client.maxRedirects = redirects; return true;
        });
    }

    bool SetRedirectPolicy(long long id, bool allow, bool allowDowngrade) {
        return UpdateClient(id, [&](Client& client) { client.allowRedirects = allow; client.allowHttpsDowngrade = allowDowngrade; return true; });
    }

    bool SetProxy(long long id, int mode, const wchar_t* address, const wchar_t* bypass) {
        return UpdateClient(id, [&](Client& client) {
            const std::wstring proxy = address ? address : L""; const std::wstring ignored = bypass ? bypass : L"";
            if (mode < 0 || mode > 2 || ContainsControl(proxy) || ContainsControl(ignored) || (mode == 2 && proxy.empty())) return ClientFail(client, L"HTTP 代理模式或地址无效；固定代理必须提供地址且不能包含换行。");
            client.proxyMode = mode; client.proxy = proxy; client.proxyBypass = ignored; return true;
        });
    }

    bool SetCredentials(long long id, const wchar_t* user, const wchar_t* password, bool proxy) {
        return UpdateClient(id, [&](Client& client) {
            const std::wstring name = user ? user : L""; const std::wstring secret = password ? password : L"";
            if (ContainsControl(name) || ContainsControl(secret)) return ClientFail(client, L"HTTP 身份验证凭据不能包含控制字符。");
            if (proxy) { client.proxyUser = name; client.proxyPassword = secret; } else { client.serverUser = name; client.serverPassword = secret; }
            return true;
        });
    }

    bool SetTls(long long id, bool verify, bool allowSelfSigned) {
        return UpdateClient(id, [&](Client& client) { client.verifyCertificate = verify; client.allowSelfSigned = allowSelfSigned; return true; });
    }

    bool SetCertificatePin(long long id, const wchar_t* fingerprint) {
        return UpdateClient(id, [&](Client& client) {
            const std::wstring normalized = NormalizeFingerprint(fingerprint ? fingerprint : L"");
            if (!normalized.empty() && (normalized.size() != 64 || !std::all_of(normalized.begin(), normalized.end(), [](wchar_t ch) { return std::iswxdigit(ch) != 0; }))) return ClientFail(client, L"HTTP 证书 SHA-256 指纹必须是 64 位十六进制文本，可包含冒号或空格。");
            client.certificatePin = normalized; return true;
        });
    }

    bool SetDecompression(long long id, bool enabled) { return UpdateClient(id, [&](Client& client) { client.autoDecompression = enabled; return true; }); }
    bool SetCookies(long long id, bool enabled) { return UpdateClient(id, [&](Client& client) { client.cookiesEnabled = enabled; return true; }); }

    bool SetClientHeader(long long id, const wchar_t* name, const wchar_t* value, bool append) {
        return UpdateClient(id, [&](Client& client) { return SetHeaderList(client.defaultHeaders, name, value, append, L"客户端"); });
    }
    bool DeleteClientHeader(long long id, const wchar_t* name) {
        return UpdateClient(id, [&](Client& client) { return DeleteHeaderList(client.defaultHeaders, name); });
    }
    bool ClearClientHeaders(long long id) { return UpdateClient(id, [&](Client& client) { client.defaultHeaders.clear(); return true; }); }
    int CancelAll(long long id) {
        auto client = FindClient(id); if (!client) return 0;
        std::vector<std::shared_ptr<Request>> requests;
        { std::lock_guard<std::mutex> lock(requestsMutex_); for (const auto& item : requests_) if (item.second->clientId == id) requests.push_back(item.second); }
        int count = 0; for (const auto& request : requests) if (CancelRequest(request)) ++count; return count;
    }
    int ActiveCount(long long id) const { auto client = FindClient(id); return client ? client->activeCount.load() : 0; }
    long long TotalCount(long long id) const { auto client = FindClient(id); return client ? client->totalCount.load() : 0; }
    std::wstring ClientError(long long id) const { auto client = FindClient(id); if (!client) return L"HTTP 客户端 ID 无效。"; std::lock_guard<std::mutex> lock(client->mutex); return client->lastError; }

    long long CreateRequest(long long clientId, const wchar_t* method, const wchar_t* url) {
        auto client = FindClient(clientId); if (!client) { SetGlobalError(L"HTTP 客户端 ID 无效。"); return 0; }
        const std::wstring verb = NormalizeMethod(method ? method : L"GET"); const std::wstring address = url ? url : L"";
        if (!ValidMethod(verb) || ContainsControl(address) || !ValidUrl(address)) { ClientFail(*client, L"HTTP 请求方法或地址无效；地址必须使用 http:// 或 https://，且不能包含控制字符。"); return 0; }
        auto request = std::make_shared<Request>(); request->id = nextRequestId_.fetch_add(1); request->clientId = clientId; request->method = verb; request->url = address;
        { std::lock_guard<std::mutex> lock(requestsMutex_); requests_[request->id] = request; }
        return request->id;
    }

    bool SetRequestHeader(long long id, const wchar_t* name, const wchar_t* value, bool append) { return UpdateRequest(id, [&](Request& request) { return SetHeaderList(request.headers, name, value, append, L"请求"); }); }
    bool DeleteRequestHeader(long long id, const wchar_t* name) { return UpdateRequest(id, [&](Request& request) { return DeleteHeaderList(request.headers, name); }); }
    bool ClearRequestHeaders(long long id) { return UpdateRequest(id, [&](Request& request) { request.headers.clear(); return true; }); }
    bool SetTextBody(long long id, const wchar_t* text, const wchar_t* contentType) { return UpdateRequest(id, [&](Request& request) { const std::string utf8 = LB_WideToUtf8(text); request.body.assign(utf8.begin(), utf8.end()); request.bodyMime = contentType && contentType[0] ? contentType : L"text/plain; charset=utf-8"; request.uploadPath.clear(); return true; }); }
    bool SetJsonBody(long long id, const wchar_t* json) { return SetTextBody(id, json, L"application/json; charset=utf-8"); }
    bool SetBinaryBody(long long id, const std::vector<unsigned char>& data, const wchar_t* contentType) { return UpdateRequest(id, [&](Request& request) { request.body = data; request.bodyMime = contentType && contentType[0] ? contentType : L"application/octet-stream"; request.uploadPath.clear(); return true; }); }
    bool SetHexBody(long long id, const wchar_t* hex, const wchar_t* contentType) {
        const std::wstring value = hex ? hex : L""; std::vector<unsigned char> bytes;
        if (value.size() % 2 != 0 || !DecodeHex(value, bytes)) { SetRequestError(id, L"HTTP 十六进制正文必须是偶数长度的十六进制文本。", ERROR_INVALID_DATA); return false; }
        return SetBinaryBody(id, bytes, contentType);
    }
    bool SetFileBody(long long id, const wchar_t* path, const wchar_t* contentType) { return UpdateRequest(id, [&](Request& request) { const std::wstring file = path ? path : L""; if (file.empty()) return RequestFailUnlocked(request, L"HTTP 上传文件路径不能为空。", ERROR_INVALID_PARAMETER); request.uploadPath = file; request.body.clear(); request.bodyMime = contentType && contentType[0] ? contentType : L"application/octet-stream"; return true; }); }
    bool SetResponseFile(long long id, const wchar_t* path, bool overwrite) { return UpdateRequest(id, [&](Request& request) { const std::wstring file = path ? path : L""; if (file.empty()) return RequestFailUnlocked(request, L"HTTP 响应文件路径不能为空。", ERROR_INVALID_PARAMETER); request.responsePath = file; request.responseAllowOverwrite = overwrite; return true; }); }
    bool BindHandler(long long id, const wchar_t* handler) { return UpdateRequest(id, [&](Request& request) { const std::wstring value = handler ? handler : L""; if (value.empty() || ContainsControl(value)) return RequestFailUnlocked(request, L"HTTP 完成处理器不能为空或包含控制字符。", ERROR_INVALID_PARAMETER); request.handler = value; return true; }); }

    bool Start(long long id) {
        auto request = FindRequest(id); if (!request) return false;
        { std::lock_guard<std::mutex> lock(request->mutex); if (request->state != L"未开始") return RequestFailUnlocked(*request, L"HTTP 请求已经启动或已结束。", ERROR_INVALID_STATE); request->state = L"运行中"; request->startedAt = std::chrono::steady_clock::now(); request->async = true; }
        auto client = FindClient(request->clientId); if (!client) return RequestFail(*request, L"HTTP 客户端已销毁。", ERROR_INVALID_HANDLE);
        client->activeCount.fetch_add(1); client->totalCount.fetch_add(1);
        try { request->worker = std::thread([this, request, client]() { ExecuteAndComplete(request, client); }); }
        catch (...) { client->activeCount.fetch_sub(1); RequestFail(*request, L"HTTP 无法创建后台线程。", ERROR_NOT_ENOUGH_MEMORY); return false; }
        return true;
    }

    bool ExecuteSync(long long id) {
        auto request = FindRequest(id); if (!request) return false;
        { std::lock_guard<std::mutex> lock(request->mutex); if (request->state != L"未开始") return RequestFailUnlocked(*request, L"HTTP 请求已经启动或已结束。", ERROR_INVALID_STATE); request->state = L"运行中"; request->startedAt = std::chrono::steady_clock::now(); request->async = false; }
        auto client = FindClient(request->clientId); if (!client) return RequestFail(*request, L"HTTP 客户端已销毁。", ERROR_INVALID_HANDLE);
        client->activeCount.fetch_add(1); client->totalCount.fetch_add(1); ExecuteAndComplete(request, client); return IsSuccess(id);
    }

    bool Wait(long long id, int timeoutMs) {
        auto request = FindRequest(id); if (!request) return false; if (timeoutMs < 0 || timeoutMs > 3600000) return RequestFail(*request, L"HTTP 等待超时必须在 0 到 3600000 毫秒之间。", ERROR_INVALID_PARAMETER);
        std::unique_lock<std::mutex> lock(request->mutex); request->changed.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&]() { return request->completed; }); return request->completed;
    }
    bool Cancel(long long id) { auto request = FindRequest(id); return request && CancelRequest(request); }
    bool DestroyRequest(long long id) {
        std::shared_ptr<Request> request;
        { std::lock_guard<std::mutex> lock(requestsMutex_); auto found = requests_.find(id); if (found == requests_.end()) return false; request = found->second; requests_.erase(found); }
        CancelRequest(request); JoinRequest(request); if (legacyRequestId_ == id) legacyRequestId_ = 0; return true;
    }

    long long RequestClient(long long id) const { auto request = FindRequest(id); return request ? request->clientId : 0; }
    std::wstring RequestMethod(long long id) const { return RequestText(id, 1); }
    std::wstring RequestUrl(long long id) const { return RequestText(id, 2); }
    std::wstring RequestState(long long id) const { return RequestText(id, 3); }
    bool IsComplete(long long id) const { auto request = FindRequest(id); if (!request) return false; std::lock_guard<std::mutex> lock(request->mutex); return request->completed; }
    bool IsSuccess(long long id) const { auto request = FindRequest(id); if (!request) return false; std::lock_guard<std::mutex> lock(request->mutex); return request->completed && request->statusCode >= 200 && request->statusCode < 300 && request->error.empty() && !request->cancelled; }
    std::wstring RequestError(long long id) const { auto request = FindRequest(id); return request ? RequestText(id, 4) : L"HTTP 请求 ID 无效。"; }
    int SystemError(long long id) const { auto request = FindRequest(id); return request ? request->systemError : ERROR_INVALID_HANDLE; }
    long long Duration(long long id) const { auto request = FindRequest(id); return request ? request->durationMs.load() : 0; }
    long long Uploaded(long long id) const { auto request = FindRequest(id); return request ? request->uploadedBytes.load() : 0; }
    long long Downloaded(long long id) const { auto request = FindRequest(id); return request ? request->downloadedBytes.load() : 0; }
    int StatusCode(long long id) const { auto request = FindRequest(id); if (!request) return 0; std::lock_guard<std::mutex> lock(request->mutex); return request->statusCode; }
    std::wstring StatusText(long long id) const { return RequestText(id, 5); }
    std::wstring Protocol(long long id) const { return RequestText(id, 6); }
    std::wstring FinalUrl(long long id) const { return RequestText(id, 7); }
    std::wstring Headers(long long id) const { return RequestText(id, 8); }
    std::wstring HeadersJson(long long id) const { return RequestText(id, 9); }
    std::wstring ResponseHex(long long id) const { auto request = FindRequest(id); if (!request) return L""; std::lock_guard<std::mutex> lock(request->mutex); return request->responsePath.empty() ? BytesToHex(request->response) : L""; }
    long long ResponseSize(long long id) const { auto request = FindRequest(id); return request ? request->responseSize.load() : 0; }
    std::wstring ResponseFile(long long id) const { return RequestText(id, 10); }
    std::wstring ContentType(long long id) const { return RequestText(id, 11); }
    std::wstring CertificateSha256(long long id) const { return RequestText(id, 12); }
    std::wstring ResponseHeader(long long id, const wchar_t* name) const {
        auto request = FindRequest(id); if (!request) return L""; const std::wstring expected = Lower(name ? name : L"");
        std::lock_guard<std::mutex> lock(request->mutex); std::wstring result;
        for (const auto& item : request->headerItems) if (Lower(item.first) == expected) { if (!result.empty()) result += L", "; result += item.second; }
        return result;
    }
    std::vector<unsigned char> ResponseBytes(long long id) const { auto request = FindRequest(id); if (!request) return {}; std::lock_guard<std::mutex> lock(request->mutex); return request->responsePath.empty() ? request->response : std::vector<unsigned char>{}; }
    std::wstring ResponseText(long long id, const wchar_t* encoding) const { auto request = FindRequest(id); if (!request) return L""; std::lock_guard<std::mutex> lock(request->mutex); return request->responsePath.empty() ? DecodeText(request->response, encoding) : L""; }
    bool SaveResponse(long long id, const wchar_t* path, bool overwrite) {
        auto request = FindRequest(id); if (!request) return false; std::vector<unsigned char> data; { std::lock_guard<std::mutex> lock(request->mutex); data = request->response; }
        return SaveBytes(path ? path : L"", data, overwrite, *request);
    }
    long long CurrentRequest() const { std::lock_guard<std::mutex> lock(eventsMutex_); return currentEvent_ ? currentEvent_->requestId : 0; }

    void DispatchEvent(long long eventId, const DispatchHandler& dispatch) {
        std::shared_ptr<Event> event;
        { std::lock_guard<std::mutex> lock(eventsMutex_); auto found = events_.find(eventId); if (found == events_.end()) return; event = found->second; events_.erase(found); currentEvent_ = event; }
        if (dispatch && !event->handler.empty()) dispatch(event->handler.c_str());
        { std::lock_guard<std::mutex> lock(eventsMutex_); if (currentEvent_ == event) currentEvent_.reset(); }
    }

    long long LegacyRequest(const wchar_t* method, const wchar_t* url, const wchar_t* body, int timeoutMs) {
        if (!legacyClientId_) legacyClientId_ = CreateClient();
        const int effectiveTimeout = timeoutMs <= 0 ? 30000 : (std::max)(100, (std::min)(3600000, timeoutMs));
        SetTimeouts(legacyClientId_, effectiveTimeout, effectiveTimeout, effectiveTimeout, effectiveTimeout);
        if (legacyRequestId_) DestroyRequest(legacyRequestId_);
        legacyRequestId_ = CreateRequest(legacyClientId_, method, url); if (!legacyRequestId_) return 0;
        if (body && body[0]) SetJsonBody(legacyRequestId_, body);
        ExecuteSync(legacyRequestId_);
        return legacyRequestId_;
    }
    bool LegacyGet(const wchar_t* url) { return LegacyRequest(L"GET", url, L"", 30000) != 0 && IsSuccess(legacyRequestId_); }
    bool LegacyPost(const wchar_t* url, const wchar_t* body) { return LegacyRequest(L"POST", url, body, 30000) != 0 && IsSuccess(legacyRequestId_); }
    int LegacyStatus() const { return StatusCode(legacyRequestId_); }
    std::wstring LegacyText() const { return ResponseText(legacyRequestId_, L"UTF-8"); }
    std::wstring LegacyError() const { return RequestError(legacyRequestId_); }
    void LegacyClear() { if (legacyRequestId_) DestroyRequest(legacyRequestId_); legacyRequestId_ = 0; }

    void Shutdown() {
        std::vector<std::shared_ptr<Request>> requests; { std::lock_guard<std::mutex> lock(requestsMutex_); for (const auto& item : requests_) requests.push_back(item.second); requests_.clear(); }
        for (const auto& request : requests) { CancelRequest(request); JoinRequest(request); }
        std::vector<std::shared_ptr<Client>> clients; { std::lock_guard<std::mutex> lock(clientsMutex_); for (const auto& item : clients_) clients.push_back(item.second); clients_.clear(); }
        for (const auto& client : clients) { CloseClientSession(client); ClearSensitiveClientState(client); }
        std::lock_guard<std::mutex> lock(eventsMutex_); events_.clear(); currentEvent_.reset(); legacyClientId_ = 0; legacyRequestId_ = 0;
    }

private:
    struct Client {
        long long id = 0; mutable std::mutex mutex; std::wstring userAgent = L"LingBuilder HTTP/2.0"; int resolveTimeoutMs = 10000; int connectTimeoutMs = 15000; int sendTimeoutMs = 30000; int receiveTimeoutMs = 30000;
        size_t maxHeaderBytes = 64 * 1024; size_t maxBodyBytes = 64 * 1024 * 1024; size_t maxUploadBytes = 64 * 1024 * 1024; int maxRedirects = 10; bool allowRedirects = true; bool allowHttpsDowngrade = false; int proxyMode = 0; std::wstring proxy, proxyBypass, serverUser, serverPassword, proxyUser, proxyPassword, certificatePin; bool verifyCertificate = true; bool allowSelfSigned = false; bool autoDecompression = true; bool cookiesEnabled = true;
        std::vector<std::pair<std::wstring, std::wstring>> defaultHeaders; std::atomic<int> activeCount{0}; std::atomic<long long> totalCount{0}; std::wstring lastError; HINTERNET session = nullptr;
    };
    struct Request {
        long long id = 0, clientId = 0; mutable std::mutex mutex; std::condition_variable changed; std::wstring method, url, state = L"未开始", handler, error, statusText, protocol, finalUrl, headersText, headersJson, responsePath, contentType, certificateSha256, bodyMime = L"application/octet-stream"; std::vector<std::pair<std::wstring, std::wstring>> headers, headerItems; std::vector<unsigned char> body, response; std::wstring uploadPath; bool responseAllowOverwrite = false, async = false, completed = false, cancelled = false; int statusCode = 0, systemError = 0; std::atomic<long long> responseSize{0}; std::atomic<long long> uploadedBytes{0}, downloadedBytes{0}, durationMs{0}; std::chrono::steady_clock::time_point startedAt; std::thread worker; std::atomic<bool> cancelRequested{false}; std::mutex handlesMutex; HINTERNET connection = nullptr, request = nullptr;
    };
    struct Event { long long requestId = 0; std::wstring handler; };

    static bool ValidTimeout(int value) { return value >= 100 && value <= 3600000; }
    static bool ContainsControl(const std::wstring& value) { return std::any_of(value.begin(), value.end(), [](wchar_t ch) { return ch == L'\r' || ch == L'\n' || ch == 0; }); }
    static std::wstring Lower(const wchar_t* value) { std::wstring result = value ? value : L""; return Lower(result); }
    static std::wstring Lower(const std::wstring& value) { std::wstring result = value; std::transform(result.begin(), result.end(), result.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); }); return result; }
    static std::wstring NormalizeMethod(const wchar_t* method) { std::wstring result = method && method[0] ? method : L"GET"; std::transform(result.begin(), result.end(), result.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towupper(ch)); }); return result; }
    static bool ValidMethod(const std::wstring& method) { return !method.empty() && method.size() <= 32 && std::all_of(method.begin(), method.end(), [](wchar_t ch) { return iswalnum(ch) || ch == L'!' || ch == L'#' || ch == L'$' || ch == L'%' || ch == L'&' || ch == L'\'' || ch == L'*' || ch == L'+' || ch == L'-' || ch == L'.' || ch == L'^' || ch == L'_' || ch == static_cast<wchar_t>(96) || ch == L'|' || ch == L'~'; }); }
    static bool ValidUrl(const std::wstring& url) { URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts); parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1); parts.dwUrlPathLength = static_cast<DWORD>(-1); return !url.empty() && WinHttpCrackUrl(url.c_str(), 0, 0, &parts) && (parts.nScheme == INTERNET_SCHEME_HTTP || parts.nScheme == INTERNET_SCHEME_HTTPS) && parts.dwHostNameLength > 0; }
    static std::wstring NormalizeFingerprint(const std::wstring& value) { std::wstring result; for (wchar_t ch : value) if (ch != L':' && !iswspace(ch)) result.push_back(static_cast<wchar_t>(towupper(ch))); return result; }
    static bool IsManagedHeader(const std::wstring& name) { const std::wstring lower = Lower(name); return lower == L"host" || lower == L"content-length" || lower == L"connection" || lower == L"transfer-encoding" || lower == L"cookie" || lower == L"set-cookie"; }
    static bool ValidHeaderName(const std::wstring& name) { return !name.empty() && name.size() <= 256 && !ContainsControl(name) && std::all_of(name.begin(), name.end(), [](wchar_t ch) { return iswalnum(ch) || ch == L'!' || ch == L'#' || ch == L'$' || ch == L'%' || ch == L'&' || ch == L'\'' || ch == L'*' || ch == L'+' || ch == L'-' || ch == L'.' || ch == L'^' || ch == L'_' || ch == static_cast<wchar_t>(96) || ch == L'|' || ch == L'~'; }); }
    static bool SetHeaderList(std::vector<std::pair<std::wstring, std::wstring>>& list, const wchar_t* rawName, const wchar_t* rawValue, bool append, const wchar_t* scope) {
        const std::wstring name = rawName ? rawName : L""; const std::wstring value = rawValue ? rawValue : L"";
        if (!ValidHeaderName(name) || ContainsControl(value) || IsManagedHeader(name)) return false;
        if (!append) { list.erase(std::remove_if(list.begin(), list.end(), [&](const auto& item) { return Lower(item.first) == Lower(name); }), list.end()); }
        list.emplace_back(name, value); (void)scope; return true;
    }
    static bool DeleteHeaderList(std::vector<std::pair<std::wstring, std::wstring>>& list, const wchar_t* rawName) { const std::wstring name = rawName ? rawName : L""; if (!ValidHeaderName(name)) return false; list.erase(std::remove_if(list.begin(), list.end(), [&](const auto& item) { return Lower(item.first) == Lower(name); }), list.end()); return true; }
    static std::string LB_WideToUtf8(const wchar_t* value) { if (!value || !value[0]) return {}; const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, nullptr, 0, nullptr, nullptr); if (size <= 1) return {}; std::string output(static_cast<size_t>(size), '\0'); if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, output.data(), size, nullptr, nullptr) != size) return {}; output.resize(static_cast<size_t>(size - 1)); return output; }
    static bool DecodeHex(const std::wstring& value, std::vector<unsigned char>& output) { output.clear(); if (value.size() % 2 != 0) return false; for (size_t index = 0; index < value.size(); index += 2) { auto digit = [](wchar_t ch) { if (ch >= L'0' && ch <= L'9') return ch - L'0'; if (ch >= L'a' && ch <= L'f') return ch - L'a' + 10; if (ch >= L'A' && ch <= L'F') return ch - L'A' + 10; return -1; }; const int high = digit(value[index]), low = digit(value[index + 1]); if (high < 0 || low < 0) return false; output.push_back(static_cast<unsigned char>((high << 4) | low)); } return true; }
    static std::wstring BytesToHex(const std::vector<unsigned char>& bytes) { static constexpr wchar_t digits[] = L"0123456789abcdef"; std::wstring result; result.reserve(bytes.size() * 2); for (unsigned char byte : bytes) { result.push_back(digits[(byte >> 4) & 15]); result.push_back(digits[byte & 15]); } return result; }
    static std::wstring EscapeJson(const std::wstring& value) { std::wstring result; for (wchar_t ch : value) { if (ch == L'"') result += L"\\\""; else if (ch == L'\\') result += L"\\\\"; else if (ch == L'\r') result += L"\\r"; else if (ch == L'\n') result += L"\\n"; else if (ch == L'\t') result += L"\\t"; else result.push_back(ch); } return result; }
    static std::wstring DecodeText(const std::vector<unsigned char>& bytes, const wchar_t* encoding) {
        const std::wstring wanted = Lower(encoding ? encoding : L"auto"); size_t offset = 0; UINT codePage = CP_UTF8;
        if (wanted == L"gbk") codePage = 936; else if (wanted == L"gb18030") codePage = 54936; else if (wanted == L"ansi") codePage = CP_ACP; else if (wanted == L"utf-16le") { if (bytes.size() < 2) return L""; return std::wstring(reinterpret_cast<const wchar_t*>(bytes.data() + ((bytes.size() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) ? 2 : 0)), (bytes.size() - ((bytes.size() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) ? 2 : 0)) / sizeof(wchar_t)); } else if (wanted == L"utf-16be") { std::wstring result; offset = bytes.size() >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff ? 2 : 0; for (size_t i = offset; i + 1 < bytes.size(); i += 2) result.push_back(static_cast<wchar_t>((bytes[i] << 8) | bytes[i + 1])); return result; }
        if (wanted == L"auto" || wanted.empty()) { if (bytes.size() >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf) offset = 3; else if (bytes.size() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) { return DecodeText(bytes, L"utf-16le"); } else if (bytes.size() >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff) { return DecodeText(bytes, L"utf-16be"); } }
        if (bytes.size() - offset > static_cast<size_t>((std::numeric_limits<int>::max)())) return L""; const int length = MultiByteToWideChar(codePage, codePage == CP_UTF8 || codePage == 54936 ? MB_ERR_INVALID_CHARS : 0, reinterpret_cast<const char*>(bytes.data() + offset), static_cast<int>(bytes.size() - offset), nullptr, 0); if (length <= 0) return L""; std::wstring result(static_cast<size_t>(length), L'\0'); MultiByteToWideChar(codePage, codePage == CP_UTF8 || codePage == 54936 ? MB_ERR_INVALID_CHARS : 0, reinterpret_cast<const char*>(bytes.data() + offset), static_cast<int>(bytes.size() - offset), result.data(), length); return result;
    }
    static bool SaveBytes(const std::wstring& path, const std::vector<unsigned char>& bytes, bool overwrite, Request& request) { if (path.empty()) return RequestFail(request, L"HTTP 保存路径不能为空。", ERROR_INVALID_PARAMETER); if (!overwrite && GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return RequestFail(request, L"HTTP 目标文件已存在，且未允许覆盖。", ERROR_FILE_EXISTS); const std::wstring temporary = path + L".lingbuilder-http-tmp"; { std::ofstream stream(std::filesystem::path(temporary), std::ios::binary | std::ios::trunc); if (!stream) return RequestFail(request, L"HTTP 响应文件创建失败。", GetLastError()); if (!bytes.empty()) stream.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size())); } if (!MoveFileExW(temporary.c_str(), path.c_str(), overwrite ? MOVEFILE_REPLACE_EXISTING : MOVEFILE_COPY_ALLOWED)) { DeleteFileW(temporary.c_str()); return RequestFail(request, L"HTTP 响应文件原子替换失败。", GetLastError()); } return true; }
    static bool RequestFailUnlocked(Request& request, const wchar_t* message, int code) { request.error = message ? message : L"HTTP 请求失败。"; request.systemError = code; if (!request.completed) request.state = L"错误"; request.changed.notify_all(); return false; }
    static bool RequestFail(Request& request, const wchar_t* message, int code) { std::lock_guard<std::mutex> lock(request.mutex); return RequestFailUnlocked(request, message, code); }
    bool ClientFail(Client& client, const wchar_t* message) { client.lastError = message ? message : L"HTTP 客户端操作失败。"; SetGlobalError(client.lastError.c_str()); return false; }
    bool SetGlobalError(const wchar_t* message) { std::lock_guard<std::mutex> lock(errorMutex_); lastError_ = message ? message : L""; return false; }
    template <typename F> bool UpdateClient(long long id, F&& update) { auto client = FindClient(id); if (!client) { SetGlobalError(L"HTTP 客户端 ID 无效。"); return false; } if (client->activeCount.load() > 0) return ClientFail(*client, L"HTTP 客户端存在活动请求，当前配置不能修改。"); std::lock_guard<std::mutex> lock(client->mutex); if (client->session) { WinHttpCloseHandle(client->session); client->session = nullptr; } return update(*client); }
    template <typename F> bool UpdateRequest(long long id, F&& update) { auto request = FindRequest(id); if (!request) return false; std::lock_guard<std::mutex> lock(request->mutex); if (request->state != L"未开始") return RequestFailUnlocked(*request, L"HTTP 请求已启动，不能修改配置。", ERROR_INVALID_STATE); return update(*request); }
    std::shared_ptr<Client> FindClient(long long id) const { std::lock_guard<std::mutex> lock(clientsMutex_); auto found = clients_.find(id); return found == clients_.end() ? nullptr : found->second; }
    std::shared_ptr<Request> FindRequest(long long id) const { std::lock_guard<std::mutex> lock(requestsMutex_); auto found = requests_.find(id); return found == requests_.end() ? nullptr : found->second; }
    bool EnsureSession(const std::shared_ptr<Client>& client, HINTERNET& session) {
        std::lock_guard<std::mutex> lock(client->mutex); if (client->session) { session = client->session; return true; }
        session = WinHttpOpen(client->userAgent.c_str(), client->proxyMode == 1 ? WINHTTP_ACCESS_TYPE_NO_PROXY : client->proxyMode == 2 ? WINHTTP_ACCESS_TYPE_NAMED_PROXY : WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, client->proxyMode == 2 ? client->proxy.c_str() : WINHTTP_NO_PROXY_NAME, client->proxyMode == 2 ? client->proxyBypass.c_str() : WINHTTP_NO_PROXY_BYPASS, 0); if (!session) { client->lastError = L"HTTP 会话创建失败。"; return false; }
        client->session = session; if (!WinHttpSetTimeouts(session, client->resolveTimeoutMs, client->connectTimeoutMs, client->sendTimeoutMs, client->receiveTimeoutMs)) { WinHttpCloseHandle(session); client->session = nullptr; return false; }
        if (!client->cookiesEnabled) { DWORD feature = WINHTTP_DISABLE_COOKIES; WinHttpSetOption(session, WINHTTP_OPTION_DISABLE_FEATURE, &feature, sizeof(feature)); }
        return true;
    }
    void CloseClientSession(const std::shared_ptr<Client>& client) { std::lock_guard<std::mutex> lock(client->mutex); if (client->session) { WinHttpCloseHandle(client->session); client->session = nullptr; } }
    static void ClearSensitiveClientState(const std::shared_ptr<Client>& client) { std::lock_guard<std::mutex> lock(client->mutex); client->serverPassword.clear(); client->proxyPassword.clear(); }
    void JoinRequest(const std::shared_ptr<Request>& request) { if (request->worker.joinable() && request->worker.get_id() != std::this_thread::get_id()) request->worker.join(); }
    bool CancelRequest(const std::shared_ptr<Request>& request) { std::lock_guard<std::mutex> lock(request->mutex); if (request->completed || request->state == L"未开始") return false; request->cancelRequested.store(true); request->cancelled = true; request->state = L"取消中"; { std::lock_guard<std::mutex> handleLock(request->handlesMutex); if (request->request) WinHttpCloseHandle(request->request); request->request = nullptr; } return true; }

    void ExecuteAndComplete(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client) {
        Execute(request, client); { std::lock_guard<std::mutex> lock(request->mutex); request->completed = true; if (request->cancelRequested.load() || request->cancelled) { request->state = L"已取消"; request->error = L"请求已取消。"; } else if (request->error.empty()) request->state = L"已完成"; else request->state = L"错误"; request->durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - request->startedAt).count(); }
        request->changed.notify_all(); client->activeCount.fetch_sub(1); if (request->async && !request->handler.empty()) { auto event = std::make_shared<Event>(); event->requestId = request->id; { std::lock_guard<std::mutex> lock(request->mutex); event->handler = request->handler; } long long eventId = nextEventId_.fetch_add(1); { std::lock_guard<std::mutex> lock(eventsMutex_); events_[eventId] = event; } if (notify_ && !notify_(eventId)) { std::lock_guard<std::mutex> lock(eventsMutex_); events_.erase(eventId); } }
    }

    void Execute(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client) {
        HINTERNET session = nullptr; if (!EnsureSession(client, session)) { RequestFail(*request, L"HTTP 会话创建失败。", GetLastError()); return; }
        URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts); parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1); parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(request->url.c_str(), 0, 0, &parts) || (parts.nScheme != INTERNET_SCHEME_HTTP && parts.nScheme != INTERNET_SCHEME_HTTPS)) { RequestFail(*request, L"HTTP 地址解析失败。", GetLastError()); return; }
        const std::wstring host(parts.lpszHostName, parts.dwHostNameLength); std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/"; if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
        HINTERNET connection = WinHttpConnect(session, host.c_str(), parts.nPort, 0); if (!connection) { RequestFail(*request, L"HTTP 主机连接失败。", GetLastError()); return; }
        HINTERNET nativeRequest = WinHttpOpenRequest(connection, request->method.c_str(), path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, parts.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0); if (!nativeRequest) { WinHttpCloseHandle(connection); RequestFail(*request, L"HTTP 请求创建失败。", GetLastError()); return; }
        { std::lock_guard<std::mutex> lock(request->handlesMutex); request->connection = connection; request->request = nativeRequest; }
        std::wstring headers;
        std::wstring certificatePin;
        DWORD redirectPolicy = WINHTTP_OPTION_REDIRECT_POLICY_DEFAULT;
        DWORD decompression = 0;
        size_t maxUploadBytes = 0;
        {
            std::lock_guard<std::mutex> lock(client->mutex);
            for (const auto& item : client->defaultHeaders) headers += item.first + L": " + item.second + L"\r\n";
            certificatePin = client->certificatePin;
            redirectPolicy = !client->allowRedirects ? WINHTTP_OPTION_REDIRECT_POLICY_NEVER : (client->allowHttpsDowngrade ? WINHTTP_OPTION_REDIRECT_POLICY_ALWAYS : WINHTTP_OPTION_REDIRECT_POLICY_DISALLOW_HTTPS_TO_HTTP);
            decompression = client->autoDecompression ? WINHTTP_DECOMPRESSION_FLAG_ALL : 0;
            maxUploadBytes = client->maxUploadBytes;
            if (!client->serverUser.empty() && !WinHttpSetCredentials(nativeRequest, WINHTTP_AUTH_TARGET_SERVER, WINHTTP_AUTH_SCHEME_BASIC, client->serverUser.c_str(), client->serverPassword.c_str(), nullptr)) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 服务器凭据设置失败。", GetLastError()); return; }
            if (!client->proxyUser.empty() && !WinHttpSetCredentials(nativeRequest, WINHTTP_AUTH_TARGET_PROXY, WINHTTP_AUTH_SCHEME_BASIC, client->proxyUser.c_str(), client->proxyPassword.c_str(), nullptr)) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 代理凭据设置失败。", GetLastError()); return; }
            DWORD security = 0;
            if (!client->verifyCertificate) security = SECURITY_FLAG_IGNORE_UNKNOWN_CA | SECURITY_FLAG_IGNORE_CERT_DATE_INVALID | SECURITY_FLAG_IGNORE_CERT_CN_INVALID | SECURITY_FLAG_IGNORE_CERT_WRONG_USAGE;
            else if (client->allowSelfSigned) security = SECURITY_FLAG_IGNORE_UNKNOWN_CA;
            if (security && !WinHttpSetOption(nativeRequest, WINHTTP_OPTION_SECURITY_FLAGS, &security, sizeof(security))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP TLS 安全策略设置失败。", GetLastError()); return; }
        }
        if (!WinHttpSetOption(nativeRequest, WINHTTP_OPTION_REDIRECT_POLICY, &redirectPolicy, sizeof(redirectPolicy))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 重定向策略设置失败。", GetLastError()); return; }
        if (!WinHttpSetOption(nativeRequest, WINHTTP_OPTION_DECOMPRESSION, &decompression, sizeof(decompression))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 自动解压策略设置失败。", GetLastError()); return; }
        { std::lock_guard<std::mutex> lock(request->mutex); for (const auto& item : request->headers) headers += item.first + L": " + item.second + L"\r\n"; if (!request->bodyMime.empty() && (!request->body.empty() || !request->uploadPath.empty())) headers += L"Content-Type: " + request->bodyMime + L"\r\n"; }
        const std::vector<unsigned char> body = request->body; std::wstring uploadPath; { std::lock_guard<std::mutex> lock(request->mutex); uploadPath = request->uploadPath; }
        std::ifstream upload; std::uintmax_t uploadSize = 0; if (!uploadPath.empty()) { std::error_code error; uploadSize = std::filesystem::file_size(std::filesystem::path(uploadPath), error); if (error || uploadSize > maxUploadBytes || uploadSize > (std::numeric_limits<DWORD>::max)()) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 上传文件不存在或超过资源限制。", ERROR_FILE_TOO_LARGE); return; } upload.open(std::filesystem::path(uploadPath), std::ios::binary); if (!upload) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 上传文件打开失败。", GetLastError()); return; } }
        if (body.size() > maxUploadBytes || body.size() > (std::numeric_limits<DWORD>::max)()) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 请求正文超过上传资源限制或 WinHTTP 单次发送上限。", ERROR_FILE_TOO_LARGE); return; }
        BOOL sent = WinHttpSendRequest(nativeRequest, headers.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headers.c_str(), headers.empty() ? 0 : static_cast<DWORD>(-1L), uploadPath.empty() ? (body.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<unsigned char*>(body.data())) : WINHTTP_NO_REQUEST_DATA, uploadPath.empty() ? static_cast<DWORD>(body.size()) : static_cast<DWORD>(uploadSize), static_cast<DWORD>(uploadPath.empty() ? body.size() : uploadSize), 0);
        if (sent && uploadPath.empty()) request->uploadedBytes = static_cast<long long>(body.size());
        if (sent && !uploadPath.empty()) { std::array<unsigned char, 64 * 1024> buffer = {}; while (sent && upload) { upload.read(reinterpret_cast<char*>(buffer.data()), static_cast<std::streamsize>(buffer.size())); const std::streamsize count = upload.gcount(); if (count <= 0) break; DWORD written = 0; sent = WinHttpWriteData(nativeRequest, buffer.data(), static_cast<DWORD>(count), &written); request->uploadedBytes += written; if (written != static_cast<DWORD>(count)) sent = FALSE; } }
        if (sent) sent = WinHttpReceiveResponse(nativeRequest, nullptr); if (!sent) { const int code = GetLastError(); CloseRequestHandles(request); RequestFail(*request, request->cancelRequested.load() ? L"请求已取消。" : L"HTTP 请求发送或接收失败。", code); return; }
        QueryResponse(request, client, nativeRequest, parts.nScheme == INTERNET_SCHEME_HTTPS, certificatePin); CloseRequestHandles(request);
    }

    static void CloseRequestHandles(const std::shared_ptr<Request>& request) { std::lock_guard<std::mutex> lock(request->handlesMutex); if (request->request) WinHttpCloseHandle(request->request); if (request->connection) WinHttpCloseHandle(request->connection); request->request = nullptr; request->connection = nullptr; }
    void QueryResponse(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client, HINTERNET nativeRequest, bool secure, const std::wstring& expectedCertificatePin) {
        DWORD status = 0, statusSize = sizeof(status);
        WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            request->statusCode = static_cast<int>(status);
        }
        DWORD size = 0;
        WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_STATUS_TEXT, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &size, WINHTTP_NO_HEADER_INDEX);
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && size > 0) {
            std::vector<wchar_t> text(size / sizeof(wchar_t) + 1);
            if (WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_STATUS_TEXT, WINHTTP_HEADER_NAME_BY_INDEX, text.data(), &size, WINHTTP_NO_HEADER_INDEX)) {
                std::lock_guard<std::mutex> lock(request->mutex);
                request->statusText = text.data();
            }
        }
        size = 0;
        WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_VERSION, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &size, WINHTTP_NO_HEADER_INDEX);
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && size > 0) {
            std::vector<wchar_t> version(size / sizeof(wchar_t) + 1);
            if (WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_VERSION, WINHTTP_HEADER_NAME_BY_INDEX, version.data(), &size, WINHTTP_NO_HEADER_INDEX)) {
                std::lock_guard<std::mutex> lock(request->mutex);
                request->protocol = version.data();
            }
        }
        size = 0;
        WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &size, WINHTTP_NO_HEADER_INDEX);
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && size > client->maxHeaderBytes + sizeof(wchar_t)) {
            RequestFail(*request, L"HTTP 响应头超过资源限制。", ERROR_FILE_TOO_LARGE);
            return;
        }
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && size > 0) {
            std::vector<wchar_t> raw(size / sizeof(wchar_t) + 1);
            if (WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, raw.data(), &size, WINHTTP_NO_HEADER_INDEX)) {
                std::lock_guard<std::mutex> lock(request->mutex);
                request->headersText = raw.data();
                ParseResponseHeaders(*request);
            }
        }
        size = 0;
        WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_CONTENT_TYPE, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &size, WINHTTP_NO_HEADER_INDEX);
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && size > 0) {
            std::vector<wchar_t> type(size / sizeof(wchar_t) + 1);
            if (WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_CONTENT_TYPE, WINHTTP_HEADER_NAME_BY_INDEX, type.data(), &size, WINHTTP_NO_HEADER_INDEX)) {
                std::lock_guard<std::mutex> lock(request->mutex);
                request->contentType = type.data();
            }
        }
        DWORD urlSize = 0;
        WinHttpQueryOption(nativeRequest, WINHTTP_OPTION_URL, nullptr, &urlSize);
        if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && urlSize > 0) {
            std::vector<wchar_t> url(urlSize / sizeof(wchar_t) + 1);
            if (WinHttpQueryOption(nativeRequest, WINHTTP_OPTION_URL, url.data(), &urlSize)) {
                std::lock_guard<std::mutex> lock(request->mutex);
                request->finalUrl = url.data();
            }
        }
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            if (request->finalUrl.empty()) request->finalUrl = request->url;
        }
        if (secure && !QueryCertificate(*request, nativeRequest, expectedCertificatePin)) {
            RequestFail(*request, L"HTTP 服务器证书指纹与固定值不匹配。", ERROR_INVALID_DATA);
            return;
        }
        std::vector<unsigned char> bytes;
        std::ofstream file;
        std::wstring responsePath;
        std::wstring temporary;
        bool toFile = false;
        bool allowOverwrite = false;
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            responsePath = request->responsePath;
            allowOverwrite = request->responseAllowOverwrite;
        }
        toFile = !responsePath.empty();
        if (toFile) {
            temporary = responsePath + L".lingbuilder-http-tmp";
            if (!allowOverwrite && GetFileAttributesW(responsePath.c_str()) != INVALID_FILE_ATTRIBUTES) {
                RequestFail(*request, L"HTTP 目标响应文件已存在，且未允许覆盖。", ERROR_FILE_EXISTS);
                return;
            }
            file.open(std::filesystem::path(temporary), std::ios::binary | std::ios::trunc);
            if (!file) {
                RequestFail(*request, L"HTTP 响应文件创建失败。", GetLastError());
                return;
            }
        }
        while (true) {
            DWORD available = 0;
            if (!WinHttpQueryDataAvailable(nativeRequest, &available)) { RequestFail(*request, L"HTTP 查询响应大小失败。", GetLastError()); break; }
            if (available == 0) break;
            if (request->downloadedBytes.load() + available > static_cast<long long>(client->maxBodyBytes)) { RequestFail(*request, L"HTTP 响应正文超过资源限制。", ERROR_FILE_TOO_LARGE); break; }
            std::vector<unsigned char> chunk(available);
            DWORD read = 0;
            if (!WinHttpReadData(nativeRequest, chunk.data(), available, &read)) { RequestFail(*request, L"HTTP 读取响应正文失败。", GetLastError()); break; }
            chunk.resize(read);
            request->downloadedBytes += read;
            request->responseSize += read;
            if (toFile) {
                file.write(reinterpret_cast<const char*>(chunk.data()), static_cast<std::streamsize>(chunk.size()));
                if (!file) { RequestFail(*request, L"HTTP 写入响应文件失败。", GetLastError()); break; }
            } else {
                bytes.insert(bytes.end(), chunk.begin(), chunk.end());
            }
        }
        if (file.is_open()) {
            file.close();
            bool hasError = false;
            {
                std::lock_guard<std::mutex> lock(request->mutex);
                hasError = !request->error.empty();
            }
            if (hasError) {
                DeleteFileW(temporary.c_str());
            } else if (!MoveFileExW(temporary.c_str(), responsePath.c_str(), allowOverwrite ? MOVEFILE_REPLACE_EXISTING : MOVEFILE_COPY_ALLOWED)) {
                DeleteFileW(temporary.c_str());
                RequestFail(*request, L"HTTP 响应文件原子替换失败。", GetLastError());
            }
        }
        std::vector<std::pair<std::wstring, std::wstring>> headerItems;
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            if (!toFile) request->response = std::move(bytes);
            headerItems = request->headerItems;
            request->headersJson = HeadersToJson(headerItems);
        }
    }
    static void ParseResponseHeaders(Request& request) { request.headerItems.clear(); std::wstringstream stream(request.headersText); std::wstring line; while (std::getline(stream, line)) { if (!line.empty() && line.back() == L'\r') line.pop_back(); const size_t colon = line.find(L':'); if (colon == std::wstring::npos) continue; std::wstring name = line.substr(0, colon), value = line.substr(colon + 1); while (!value.empty() && iswspace(value.front())) value.erase(value.begin()); request.headerItems.emplace_back(std::move(name), std::move(value)); } }
    static std::wstring HeadersToJson(const std::vector<std::pair<std::wstring, std::wstring>>& headers) { std::map<std::wstring, std::wstring> values; for (const auto& item : headers) { const std::wstring key = Lower(item.first); if (!values[key].empty()) values[key] += L", "; values[key] += item.second; } std::wstring result = L"{"; bool first = true; for (const auto& item : values) { if (!first) result += L","; first = false; result += L"\"" + EscapeJson(item.first) + L"\":\"" + EscapeJson(item.second) + L"\""; } return result + L"}"; }
    static bool QueryCertificate(Request& request, HINTERNET nativeRequest, const std::wstring& expectedPin) {
        PCCERT_CONTEXT context = nullptr;
        DWORD size = sizeof(context);
        if (!WinHttpQueryOption(nativeRequest, WINHTTP_OPTION_SERVER_CERT_CONTEXT, &context, &size) || !context) return expectedPin.empty();
        std::wstring actual;
        DWORD hashSize = 0;
        if (CertGetCertificateContextProperty(context, CERT_HASH_PROP_ID, nullptr, &hashSize) && hashSize > 0) {
            std::vector<unsigned char> hash(hashSize);
            if (CertGetCertificateContextProperty(context, CERT_HASH_PROP_ID, hash.data(), &hashSize)) actual = BytesToHex(hash);
        }
        CertFreeCertificateContext(context);
        {
            std::lock_guard<std::mutex> lock(request.mutex);
            request.certificateSha256 = actual;
        }
        return expectedPin.empty() || Lower(actual) == Lower(expectedPin);
    }
    std::wstring RequestText(long long id, int kind) const { auto request = FindRequest(id); if (!request) return L"HTTP 请求 ID 无效。"; std::lock_guard<std::mutex> lock(request->mutex); switch (kind) { case 1: return request->method; case 2: return request->url; case 3: return request->state; case 4: return request->error; case 5: return request->statusText; case 6: return request->protocol; case 7: return request->finalUrl; case 8: return request->headersText; case 9: return request->headersJson; case 10: return request->responsePath; case 11: return request->contentType; case 12: return request->certificateSha256; default: return L""; } }
    void SetRequestError(long long id, const wchar_t* message, int code) { auto request = FindRequest(id); if (request) RequestFail(*request, message, code); }

    mutable std::mutex clientsMutex_, requestsMutex_, eventsMutex_, errorMutex_; std::unordered_map<long long, std::shared_ptr<Client>> clients_; std::unordered_map<long long, std::shared_ptr<Request>> requests_; std::map<long long, std::shared_ptr<Event>> events_; std::shared_ptr<Event> currentEvent_; std::wstring lastError_; NotifyEvent notify_; std::atomic<long long> nextClientId_{1}, nextRequestId_{1}, nextEventId_{1}; long long legacyClientId_ = 0, legacyRequestId_ = 0;
};
`;

const HTTP_CLIENT_WINDOW_METHODS = String.raw`
    long long HTTP客户端_创建客户端() { return httpClientRuntime_.CreateClient(); }
    bool HTTP客户端_销毁客户端(long long client) { return httpClientRuntime_.DestroyClient(client); }
    bool HTTP客户端_设置UserAgent(long long client, const wchar_t* value) { return httpClientRuntime_.SetUserAgent(client, value); }
    bool HTTP客户端_设置超时(long long client, int resolveMs, int connectMs, int sendMs, int receiveMs) { return httpClientRuntime_.SetTimeouts(client, resolveMs, connectMs, sendMs, receiveMs); }
    bool HTTP客户端_设置资源限制(long long client, int headerKb, int bodyMb, int uploadMb, int redirects) { return httpClientRuntime_.SetLimits(client, headerKb, bodyMb, uploadMb, redirects); }
    bool HTTP客户端_设置重定向策略(long long client, bool allow, bool downgrade) { return httpClientRuntime_.SetRedirectPolicy(client, allow, downgrade); }
    bool HTTP客户端_设置代理(long long client, int mode, const wchar_t* address, const wchar_t* bypass) { return httpClientRuntime_.SetProxy(client, mode, address, bypass); }
    bool HTTP客户端_设置服务器凭据(long long client, const wchar_t* user, const wchar_t* password) { return httpClientRuntime_.SetCredentials(client, user, password, false); }
    bool HTTP客户端_设置代理凭据(long long client, const wchar_t* user, const wchar_t* password) { return httpClientRuntime_.SetCredentials(client, user, password, true); }
    bool HTTP客户端_设置TLS策略(long long client, bool verify, bool allowSelfSigned) { return httpClientRuntime_.SetTls(client, verify, allowSelfSigned); }
    bool HTTP客户端_设置证书固定(long long client, const wchar_t* fingerprint) { return httpClientRuntime_.SetCertificatePin(client, fingerprint); }
    bool HTTP客户端_设置自动解压(long long client, bool enabled) { return httpClientRuntime_.SetDecompression(client, enabled); }
    bool HTTP客户端_设置Cookie(long long client, bool enabled) { return httpClientRuntime_.SetCookies(client, enabled); }
    bool HTTP客户端_设置默认请求头(long long client, const wchar_t* name, const wchar_t* value) { return httpClientRuntime_.SetClientHeader(client, name, value, false); }
    bool HTTP客户端_添加默认请求头(long long client, const wchar_t* name, const wchar_t* value) { return httpClientRuntime_.SetClientHeader(client, name, value, true); }
    bool HTTP客户端_删除默认请求头(long long client, const wchar_t* name) { return httpClientRuntime_.DeleteClientHeader(client, name); }
    bool HTTP客户端_清空默认请求头(long long client) { return httpClientRuntime_.ClearClientHeaders(client); }
    int HTTP客户端_取消全部请求(long long client) { return httpClientRuntime_.CancelAll(client); }
    int HTTP客户端_取活动请求数(long long client) { return httpClientRuntime_.ActiveCount(client); }
    long long HTTP客户端_取累计请求数(long long client) { return httpClientRuntime_.TotalCount(client); }
    const wchar_t* HTTP客户端_取客户端错误(long long client) { httpClientReturnText_ = httpClientRuntime_.ClientError(client); return httpClientReturnText_.c_str(); }
    long long HTTP客户端_创建请求(long long client, const wchar_t* method, const wchar_t* url) { return httpClientRuntime_.CreateRequest(client, method, url); }
    bool HTTP客户端_设置请求头(long long request, const wchar_t* name, const wchar_t* value) { return httpClientRuntime_.SetRequestHeader(request, name, value, false); }
    bool HTTP客户端_添加请求头(long long request, const wchar_t* name, const wchar_t* value) { return httpClientRuntime_.SetRequestHeader(request, name, value, true); }
    bool HTTP客户端_删除请求头(long long request, const wchar_t* name) { return httpClientRuntime_.DeleteRequestHeader(request, name); }
    bool HTTP客户端_清空请求头(long long request) { return httpClientRuntime_.ClearRequestHeaders(request); }
    bool HTTP客户端_设置文本正文(long long request, const wchar_t* body, const wchar_t* contentType) { return httpClientRuntime_.SetTextBody(request, body, contentType); }
    bool HTTP客户端_设置JSON正文(long long request, const wchar_t* body) { return httpClientRuntime_.SetJsonBody(request, body); }
    bool HTTP客户端_设置二进制正文(long long request, const std::vector<unsigned char>& body, const wchar_t* contentType) { return httpClientRuntime_.SetBinaryBody(request, body, contentType); }
    bool HTTP客户端_设置十六进制正文(long long request, const wchar_t* body, const wchar_t* contentType) { return httpClientRuntime_.SetHexBody(request, body, contentType); }
    bool HTTP客户端_设置文件正文(long long request, const wchar_t* path, const wchar_t* contentType) { return httpClientRuntime_.SetFileBody(request, path, contentType); }
    bool HTTP客户端_设置响应文件(long long request, const wchar_t* path, bool overwrite) { return httpClientRuntime_.SetResponseFile(request, path, overwrite); }
    bool HTTP客户端_绑定完成处理器(long long request, const wchar_t* handler) { return httpClientRuntime_.BindHandler(request, handler); }
    bool HTTP客户端_开始请求(long long request) { return httpClientRuntime_.Start(request); }
    bool HTTP客户端_执行同步(long long request) { return httpClientRuntime_.ExecuteSync(request); }
    bool HTTP客户端_等待请求(long long request, int timeoutMs) { return httpClientRuntime_.Wait(request, timeoutMs); }
    bool HTTP客户端_取消请求(long long request) { return httpClientRuntime_.Cancel(request); }
    bool HTTP客户端_销毁请求(long long request) { return httpClientRuntime_.DestroyRequest(request); }
    long long HTTP客户端_取请求客户端(long long request) { return httpClientRuntime_.RequestClient(request); }
    const wchar_t* HTTP客户端_取请求方法(long long request) { httpClientReturnText_ = httpClientRuntime_.RequestMethod(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取请求地址(long long request) { httpClientReturnText_ = httpClientRuntime_.RequestUrl(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取请求状态(long long request) { httpClientReturnText_ = httpClientRuntime_.RequestState(request); return httpClientReturnText_.c_str(); }
    bool HTTP客户端_请求是否完成(long long request) { return httpClientRuntime_.IsComplete(request); }
    bool HTTP客户端_请求是否成功(long long request) { return httpClientRuntime_.IsSuccess(request); }
    const wchar_t* HTTP客户端_取请求错误(long long request) { httpClientReturnText_ = httpClientRuntime_.RequestError(request); return httpClientReturnText_.c_str(); }
    int HTTP客户端_取系统错误码(long long request) { return httpClientRuntime_.SystemError(request); }
    long long HTTP客户端_取请求耗时(long long request) { return httpClientRuntime_.Duration(request); }
    long long HTTP客户端_取上传字节数(long long request) { return httpClientRuntime_.Uploaded(request); }
    long long HTTP客户端_取下载字节数(long long request) { return httpClientRuntime_.Downloaded(request); }
    int HTTP客户端_取响应状态码(long long request) { return httpClientRuntime_.StatusCode(request); }
    const wchar_t* HTTP客户端_取响应状态文本(long long request) { httpClientReturnText_ = httpClientRuntime_.StatusText(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取响应协议(long long request) { httpClientReturnText_ = httpClientRuntime_.Protocol(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取最终地址(long long request) { httpClientReturnText_ = httpClientRuntime_.FinalUrl(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取全部响应头(long long request) { httpClientReturnText_ = httpClientRuntime_.Headers(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取响应头JSON(long long request) { httpClientReturnText_ = httpClientRuntime_.HeadersJson(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取响应十六进制(long long request) { httpClientReturnText_ = httpClientRuntime_.ResponseHex(request); return httpClientReturnText_.c_str(); }
    long long HTTP客户端_取响应大小(long long request) { return httpClientRuntime_.ResponseSize(request); }
    const wchar_t* HTTP客户端_取响应文件(long long request) { httpClientReturnText_ = httpClientRuntime_.ResponseFile(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取内容类型(long long request) { httpClientReturnText_ = httpClientRuntime_.ContentType(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取服务器证书SHA256(long long request) { httpClientReturnText_ = httpClientRuntime_.CertificateSha256(request); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取响应头(long long request, const wchar_t* name) { httpClientReturnText_ = httpClientRuntime_.ResponseHeader(request, name); return httpClientReturnText_.c_str(); }
    std::vector<unsigned char> HTTP客户端_取响应字节集(long long request) { return httpClientRuntime_.ResponseBytes(request); }
    const wchar_t* HTTP客户端_取响应文本编码(long long request, const wchar_t* encoding) { httpClientReturnText_ = httpClientRuntime_.ResponseText(request, encoding); return httpClientReturnText_.c_str(); }
    bool HTTP客户端_保存响应文件(long long request, const wchar_t* path, bool overwrite) { return httpClientRuntime_.SaveResponse(request, path, overwrite); }
    long long HTTP客户端_取当前请求() { return httpClientRuntime_.CurrentRequest(); }
    long long HTTP客户端_GET异步(long long client, const wchar_t* url, const wchar_t* handler) { const long long request = httpClientRuntime_.CreateRequest(client, L"GET", url); if (!request || !httpClientRuntime_.BindHandler(request, handler) || !httpClientRuntime_.Start(request)) return 0; return request; }
    long long HTTP客户端_POSTJSON异步(long long client, const wchar_t* url, const wchar_t* body, const wchar_t* handler) { const long long request = httpClientRuntime_.CreateRequest(client, L"POST", url); if (!request || !httpClientRuntime_.SetJsonBody(request, body) || !httpClientRuntime_.BindHandler(request, handler) || !httpClientRuntime_.Start(request)) return 0; return request; }
    bool HTTP客户端_请求(const wchar_t* method, const wchar_t* url, const wchar_t* body, int timeoutMs) { const long long request = httpClientRuntime_.LegacyRequest(method, url, body, timeoutMs); return request != 0 && httpClientRuntime_.IsSuccess(request); }
    bool HTTP客户端_GET(const wchar_t* url) { return httpClientRuntime_.LegacyGet(url); }
    bool HTTP客户端_POST(const wchar_t* url, const wchar_t* body) { return httpClientRuntime_.LegacyPost(url, body); }
    int HTTP客户端_取状态码() { return httpClientRuntime_.LegacyStatus(); }
    const wchar_t* HTTP客户端_取响应文本() { httpClientReturnText_ = httpClientRuntime_.LegacyText(); return httpClientReturnText_.c_str(); }
    const wchar_t* HTTP客户端_取错误() { httpClientReturnText_ = httpClientRuntime_.LegacyError(); return httpClientReturnText_.c_str(); }
    void HTTP客户端_清空状态() { httpClientRuntime_.LegacyClear(); }
`;
