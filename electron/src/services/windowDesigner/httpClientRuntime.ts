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
            client.userAgent = text; client.userAgentExplicit = true; return true;
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

    bool SetRequestProxy(long long id, const wchar_t* address) {
        return UpdateRequest(id, [&](Request& request) {
            const std::wstring proxy = address ? address : L"";
            if (ContainsControl(proxy)) return RequestFailUnlocked(request, L"HTTP 请求代理地址不能包含控制字符。", ERROR_INVALID_PARAMETER);
            if (proxy.empty()) { request.proxyMode = -1; request.proxy.clear(); request.proxyBypass.clear(); return true; }
            request.proxyMode = 2; request.proxy = proxy; request.proxyBypass.clear(); return true;
        });
    }

    bool SetRequestCredentials(long long id, const wchar_t* user, const wchar_t* password) {
        return UpdateRequest(id, [&](Request& request) {
            const std::wstring name = user ? user : L""; const std::wstring secret = password ? password : L"";
            if (ContainsControl(name) || ContainsControl(secret)) return RequestFailUnlocked(request, L"HTTP 请求代理凭据不能包含控制字符。", ERROR_INVALID_PARAMETER);
            request.proxyUser = name; request.proxyPassword = secret; return true;
        });
    }

    bool SetTls(long long id, bool verify, bool allowSelfSigned) {
        return UpdateClient(id, [&](Client& client) { client.verifyCertificate = verify; client.allowSelfSigned = allowSelfSigned; return true; });
    }

    // 设置 TLS 指纹仿真目标（curl-impersonate）：设好后该客户端全部请求改走 Chromium/BoringSSL 仿真网络栈，
    // TLS ClientHello、HTTP/2 SETTINGS 与浏览器默认头与目标浏览器一致；空文本恢复 WinHTTP 直连。
    // 指纹名规范化（小写、去连字符与空格、点号映射为下划线，下划线保留——safari17_2_ios 等真档案名含下划线，
    // 历史版本连 _ 一起删导致 safari-17.2 形态永远被误判未知）后用一次性句柄实测；
    // 未知档案立即给中文诊断，并列出当前 DLL 逐个实测可用的档案名清单（纯本地句柄校验，零网络）。
    bool SetImpersonateTarget(long long id, const wchar_t* target) {
        const std::wstring raw = target ? target : L"";
        std::wstring normalized;
        for (wchar_t ch : raw) {
            if (ch == L'-' || ch == L' ') continue;
            if (ch == L'.') { normalized.push_back(L'_'); continue; }
            normalized.push_back(static_cast<wchar_t>(towlower(ch)));
        }
        CurlImpersonateApi& api = CurlImpersonate();
        if (!api.ok) return ClientFailLastError(api.loadError);
        if (!normalized.empty()) {
            const int probe = api.impersonateProbe(normalized);
            if (probe != 0) {
                std::wstring available;
                int availableCount = 0;
                for (const std::wstring& candidate : ImpersonateTargetCandidates()) {
                    if (api.impersonateProbe(candidate) != 0) continue;
                    if (availableCount < 24) { if (availableCount > 0) available += L"、"; available += candidate; }
                    availableCount += 1;
                }
                std::wstring message = L"TLS 指纹档案「" + normalized + L"」不受支持（libcurl-impersonate 返回码 " + std::to_wstring(probe) + L"）。";
                if (availableCount > 0) {
                    message += L"当前 libcurl-impersonate.dll 实测可用档案 " + std::to_wstring(availableCount) + L" 个：" + available + (availableCount > 24 ? L" 等。" : L"。");
                } else {
                    message += L"当前 libcurl-impersonate.dll 未实测出任何可用档案，文件可能损坏，请重装 LingBuilder。";
                }
                return ClientFailLastError(message);
            }
        }
        return UpdateClient(id, [&](Client& client) {
            client.impersonateTarget = normalized;
            return true;
        });
    }

    std::wstring GetImpersonateTarget(long long id) {
        auto client = FindClient(id); if (!client) return L"";
        std::lock_guard<std::mutex> lock(client->mutex);
        return client->impersonateTarget;
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

    bool SetManualCookie(long long id, const wchar_t* name, const wchar_t* value, const wchar_t* domain, const wchar_t* path) {
        return UpdateClient(id, [&](Client& client) {
            const std::wstring n = name ? name : L""; const std::wstring v = value ? value : L""; const std::wstring d = domain ? domain : L""; const std::wstring p = path && path[0] ? path : L"/";
            if (n.empty() || n.find(L'=') != std::wstring::npos || ContainsControl(n) || ContainsControl(v) || ContainsControl(d) || ContainsControl(p)) return ClientFail(client, L"HTTP 手工 Cookie 无效：名称不能为空且不能包含等号，名称、值、域和路径不得包含控制字符。");
            for (auto& item : client.manualCookies) { if (item.name == n && Lower(item.domain) == Lower(d) && item.path == p) { item.value = v; return true; } }
            client.manualCookies.push_back({ n, v, d, p }); return true;
        });
    }
    bool ClearManualCookies(long long id) { return UpdateClient(id, [&](Client& client) { client.manualCookies.clear(); return true; }); }
    std::wstring ManualCookiesJson(long long id) const {
        auto client = FindClient(id); if (!client) return L"[]";
        std::lock_guard<std::mutex> lock(client->mutex);
        std::wstring result = L"["; bool first = true;
        for (const auto& item : client->manualCookies) { if (!first) result += L","; first = false; result += L"{\"name\":\"" + EscapeJson(item.name) + L"\",\"value\":\"" + EscapeJson(item.value) + L"\",\"domain\":\"" + EscapeJson(item.domain) + L"\",\"path\":\"" + EscapeJson(item.path) + L"\"}"; }
        return result + L"]";
    }
    bool SetRequestCookie(long long id, const wchar_t* cookie) {
        return UpdateRequest(id, [&](Request& request) { const std::wstring text = cookie ? cookie : L""; if (ContainsControl(text)) return RequestFailUnlocked(request, L"HTTP 请求 Cookie 不能包含 CR、LF 或其它控制字符。", ERROR_INVALID_DATA); request.cookieOverride = text; return true; });
    }

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
    bool SetResponseFile(long long id, const wchar_t* path, bool overwrite) { return UpdateRequest(id, [&](Request& request) { const std::wstring file = path ? path : L""; if (file.empty()) return RequestFailUnlocked(request, L"HTTP 响应文件路径不能为空。", ERROR_INVALID_PARAMETER); request.responsePath = file; request.resumePath.clear(); request.responseAllowOverwrite = overwrite; return true; }); }
    bool SetResumeFile(long long id, const wchar_t* path) { return UpdateRequest(id, [&](Request& request) { const std::wstring file = path ? path : L""; if (file.empty()) return RequestFailUnlocked(request, L"HTTP 续传文件路径不能为空。", ERROR_INVALID_PARAMETER); request.resumePath = file; request.responsePath.clear(); request.responseAllowOverwrite = true; return true; }); }
    bool BindHandler(long long id, const wchar_t* handler) { return UpdateRequest(id, [&](Request& request) { const std::wstring value = handler ? handler : L""; if (value.empty() || ContainsControl(value)) return RequestFailUnlocked(request, L"HTTP 完成处理器不能为空或包含控制字符。", ERROR_INVALID_PARAMETER); request.handler = value; return true; }); }

    // 解析跳转链：手动跟随 3xx Location 直到非跳转状态或次数用尽，返回最终地址；失败返回空文本。
    // 供分享短链/跳转口令解析使用（如 xhslink.com → xiaohongshu.com/explore/...?xsec_token=...）。
    // 同步阻塞实现，适合后台线程或控制台程序；窗口事件中请改用异步请求自行处理。
    std::wstring ResolveRedirectChain(long long clientId, const wchar_t* rawUrl, int maxHops) {
        auto client = FindClient(clientId); if (!client) { SetGlobalError(L"HTTP 客户端 ID 无效。"); return L""; }
        std::wstring current = rawUrl ? rawUrl : L"";
        if (!ValidUrl(current)) { ClientFail(*client, L"HTTP 起始地址无效；必须使用 http:// 或 https://。"); return L""; }
        const int hops = maxHops < 0 ? 10 : (maxHops > 20 ? 20 : maxHops);
        HINTERNET session = nullptr; if (!EnsureSession(client, session)) return L"";
        for (int index = 0; index < hops; ++index) {
            URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts);
            parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1);
            parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
            if (!WinHttpCrackUrl(current.c_str(), 0, 0, &parts) || (parts.nScheme != INTERNET_SCHEME_HTTP && parts.nScheme != INTERNET_SCHEME_HTTPS)) return current;
            const bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
            const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
            std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/";
            if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
            HINTERNET connection = WinHttpConnect(session, host.c_str(), parts.nPort, 0);
            if (!connection) return L"";
            HINTERNET nativeRequest = WinHttpOpenRequest(connection, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, secure ? WINHTTP_FLAG_SECURE : 0);
            if (!nativeRequest) { WinHttpCloseHandle(connection); return L""; }
            const DWORD disableRedirects = WINHTTP_DISABLE_REDIRECTS;
            WinHttpSetOption(nativeRequest, WINHTTP_OPTION_DISABLE_FEATURE, (LPVOID)&disableRedirects, sizeof(disableRedirects));
            const bool sent = WinHttpSendRequest(nativeRequest, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, (DWORD_PTR)nullptr) != FALSE
                && WinHttpReceiveResponse(nativeRequest, nullptr) != FALSE;
            if (!sent) { WinHttpCloseHandle(nativeRequest); WinHttpCloseHandle(connection); return L""; }
            DWORD status = 0, statusSize = sizeof(status);
            WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
            if (status < 300 || status >= 400) {
                WinHttpCloseHandle(nativeRequest); WinHttpCloseHandle(connection);
                return current;
            }
            DWORD locationSize = 0;
            WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_LOCATION, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &locationSize, WINHTTP_NO_HEADER_INDEX);
            if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || locationSize == 0) {
                WinHttpCloseHandle(nativeRequest); WinHttpCloseHandle(connection);
                return current;
            }
            std::wstring location(locationSize / sizeof(wchar_t) + 1, L'\0');
            if (!WinHttpQueryHeaders(nativeRequest, WINHTTP_QUERY_LOCATION, WINHTTP_HEADER_NAME_BY_INDEX, location.data(), &locationSize, WINHTTP_NO_HEADER_INDEX)) {
                WinHttpCloseHandle(nativeRequest); WinHttpCloseHandle(connection);
                return L"";
            }
            WinHttpCloseHandle(nativeRequest); WinHttpCloseHandle(connection);
            while (!location.empty() && location.back() == L'\0') location.pop_back();
            if (location.rfind(L"https://", 0) == 0 || location.rfind(L"http://", 0) == 0) {
                current = location;
            } else if (location.rfind(L"//", 0) == 0) {
                current = std::wstring(secure ? L"https:" : L"http:") + location;
            } else if (!location.empty() && location.front() == L'/') {
                current = std::wstring(secure ? L"https://" : L"http://") + host + location;
            } else {
                current = std::wstring(secure ? L"https://" : L"http://") + host + L"/" + location;
            }
        }
        return current;
    }

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
    struct ManualCookie { std::wstring name, value, domain, path; };
    struct Client {
        long long id = 0; mutable std::mutex mutex; std::wstring userAgent = L"LingBuilder HTTP/2.0"; int resolveTimeoutMs = 10000; int connectTimeoutMs = 15000; int sendTimeoutMs = 30000; int receiveTimeoutMs = 30000;
        size_t maxHeaderBytes = 64 * 1024; size_t maxBodyBytes = 64 * 1024 * 1024; size_t maxUploadBytes = 64 * 1024 * 1024; int maxRedirects = 10; bool allowRedirects = true; bool allowHttpsDowngrade = false; int proxyMode = 0; std::wstring proxy, proxyBypass, serverUser, serverPassword, proxyUser, proxyPassword, certificatePin; bool verifyCertificate = true; bool allowSelfSigned = false; bool autoDecompression = true; bool cookiesEnabled = true;
        std::vector<std::pair<std::wstring, std::wstring>> defaultHeaders; std::vector<ManualCookie> manualCookies; std::atomic<int> activeCount{0}; std::atomic<long long> totalCount{0}; std::wstring lastError; HINTERNET session = nullptr; std::wstring impersonateTarget; bool userAgentExplicit = false;
    };
    struct Request {
        long long id = 0, clientId = 0; mutable std::mutex mutex; std::condition_variable changed; std::wstring method, url, state = L"未开始", handler, error, statusText, protocol, finalUrl, headersText, headersJson, responsePath, resumePath, contentType, certificateSha256, bodyMime = L"application/octet-stream", cookieOverride; std::vector<std::pair<std::wstring, std::wstring>> headers, headerItems; std::vector<unsigned char> body, response; std::wstring uploadPath; bool responseAllowOverwrite = false, async = false, completed = false, cancelled = false; int statusCode = 0, systemError = 0; int proxyMode = -1; std::wstring proxy, proxyBypass, proxyUser, proxyPassword; std::atomic<long long> responseSize{0}; std::atomic<long long> uploadedBytes{0}, downloadedBytes{0}, durationMs{0}; std::chrono::steady_clock::time_point startedAt; std::thread worker; std::atomic<bool> cancelRequested{false}; std::mutex handlesMutex; HINTERNET connection = nullptr, request = nullptr;
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
    // 手工 Cookie 域的匹配：空域匹配任意主机；前导点匹配该域及其子域；其余按精确主机或子域匹配（RFC 6265 风格）。
    static bool ManualCookieDomainMatches(const std::wstring& host, const std::wstring& domain) {
        if (domain.empty()) return true;
        const std::wstring h = Lower(host), d = Lower(domain);
        if (d.front() == L'.') return h == d.substr(1) || (h.size() > d.size() && h.compare(h.size() - d.size(), d.size(), d) == 0);
        return h == d || (h.size() > d.size() + 1 && h.compare(h.size() - d.size() - 1, d.size() + 1, L"." + d) == 0);
    }
    static bool ManualCookiePathMatches(const std::wstring& urlPath, const std::wstring& cookiePath) {
        if (cookiePath.empty() || cookiePath == L"/") return true;
        if (urlPath.empty() || urlPath.front() != L'/') return false;
        if (urlPath.size() < cookiePath.size()) return false;
        if (urlPath.compare(0, cookiePath.size(), cookiePath) != 0) return false;
        return cookiePath.back() == L'/' || urlPath.size() == cookiePath.size() || urlPath[cookiePath.size()] == L'/';
    }
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
    bool ClientFailLastError(const std::wstring& message) { SetGlobalError(message.c_str()); return false; }
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
    static void ClearSensitiveClientState(const std::shared_ptr<Client>& client) { std::lock_guard<std::mutex> lock(client->mutex); client->serverPassword.clear(); client->proxyPassword.clear(); client->manualCookies.clear(); }
    void JoinRequest(const std::shared_ptr<Request>& request) { if (request->worker.joinable() && request->worker.get_id() != std::this_thread::get_id()) request->worker.join(); }
    bool CancelRequest(const std::shared_ptr<Request>& request) { std::lock_guard<std::mutex> lock(request->mutex); if (request->completed || request->state == L"未开始") return false; request->cancelRequested.store(true); request->cancelled = true; request->state = L"取消中"; { std::lock_guard<std::mutex> handleLock(request->handlesMutex); if (request->request) WinHttpCloseHandle(request->request); request->request = nullptr; } return true; }

    void ExecuteAndComplete(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client) {
        Execute(request, client); { std::lock_guard<std::mutex> lock(request->mutex); request->completed = true; if (request->cancelRequested.load() || request->cancelled) { request->state = L"已取消"; request->error = L"请求已取消。"; } else if (request->error.empty()) request->state = L"已完成"; else request->state = L"错误"; request->durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - request->startedAt).count(); }
        request->changed.notify_all(); client->activeCount.fetch_sub(1); if (request->async && !request->handler.empty()) { auto event = std::make_shared<Event>(); event->requestId = request->id; { std::lock_guard<std::mutex> lock(request->mutex); event->handler = request->handler; } long long eventId = nextEventId_.fetch_add(1); { std::lock_guard<std::mutex> lock(eventsMutex_); events_[eventId] = event; } if (notify_ && !notify_(eventId)) { std::lock_guard<std::mutex> lock(eventsMutex_); events_.erase(eventId); } }
    }

    // ================= curl-impersonate 仿真后端（TLS 指纹客户端专用，动态加载） =================
    // 客户端设置了 TLS 指纹后，该客户端的全部请求改走 libcurl-impersonate（BoringSSL + Chrome H2）：
    // ClientHello、HTTP/2 SETTINGS、浏览器默认头与目标档案一致，正文按 Accept-Encoding 自动解压。
    // 选项常量必须与随包 include/curl/curl.h（libcurl 8.22）逐一核对，升级 DLL 时必须重核。
    // 2026-09-30 实锤：CAINFO 曾误写 10098——curl.h 不存在该选项号，setopt 返回 48 被静默丢弃，
    // 随包 cacert.pem 从未生效；正确值 = CURLOPTTYPE_STRINGPOINT + 65 = 10065。
    // 已核对（对照 .lingbuilder-build/curl-impersonate/include/curl/curl.h 逐字）：
    //   URL=10002 ERRORBUFFER=10010 WRITEFUNCTION=20011 HEADERFUNCTION=20079 WRITEDATA=10001
    //   HEADERDATA=10029 NOPROGRESS=43 ACCEPT_ENCODING=10102 FOLLOWLOCATION=52 MAXREDIRS=68
    //   TIMEOUT_MS=155 CONNECTTIMEOUT_MS=156 SSL_VERIFYPEER=64 SSL_VERIFYHOST=81 CAINFO=10065
    //   PINNEDPUBLICKEY=10230 USERAGENT=10018 HTTPHEADER=10023 POSTFIELDS=10015
    //   POSTFIELDSIZE_LARGE=30120 CUSTOMREQUEST=10036 PROXY=10004 PROXYUSERPWD=10006
    //   USERPWD=10005 COOKIE=10022 INFO_RESPONSE_CODE=2097154 INFO_EFFECTIVE_URL=1048577
    static const int LB_CURL_OPT_URL = 10002;
    static const int LB_CURL_OPT_ERRORBUFFER = 10010;
    static const int LB_CURL_OPT_USERAGENT = 10018;
    static const int LB_CURL_OPT_HTTPHEADER = 10023;
    static const int LB_CURL_OPT_USERPWD = 10005;
    static const int LB_CURL_OPT_PROXY = 10004;
    static const int LB_CURL_OPT_PROXYUSERPWD = 10006;
    static const int LB_CURL_OPT_COOKIE = 10022;
    static const int LB_CURL_OPT_FOLLOWLOCATION = 52;
    static const int LB_CURL_OPT_MAXREDIRS = 68;
    static const int LB_CURL_OPT_TIMEOUT_MS = 155;
    static const int LB_CURL_OPT_CONNECTTIMEOUT_MS = 156;
    static const int LB_CURL_OPT_POSTFIELDS = 10015;
    static const int LB_CURL_OPT_POSTFIELDSIZE_LARGE = 30120;
    static const int LB_CURL_OPT_CUSTOMREQUEST = 10036;
    static const int LB_CURL_OPT_ACCEPT_ENCODING = 10102;
    static const int LB_CURL_OPT_SSL_VERIFYPEER = 64;
    static const int LB_CURL_OPT_SSL_VERIFYHOST = 81;
    static const int LB_CURL_OPT_PINNEDPUBLICKEY = 10230;
    static const int LB_CURL_OPT_NOPROGRESS = 43;
    static const int LB_CURL_OPT_WRITEFUNCTION = 20011;
    static const int LB_CURL_OPT_HEADERFUNCTION = 20079;
    static const int LB_CURL_OPT_WRITEDATA = 10001;
    static const int LB_CURL_OPT_HEADERDATA = 10029;
    static const int LB_CURL_OPT_CAINFO = 10065;
    // CA 包主路径走内存 BLOB 形态（CURLOPT_CAINFO_BLOB = CURLOPTTYPE_BLOB + 309 = 40309，curl.h 逐字核对）。
    // 红线：CAINFO 路径形态只能作 BLOB 不可用时的兜底，且必须经 keepAnsiPath（8.3 短路径/ACP）转换、
    // 禁止 keepUtf8 直传——BoringSSL 按 ANSI fopen 打开 CAfile，程序目录含非 ASCII（真机实锤：
    // T:\逆向\蓝奏云\...，rc=77 "error adding trust anchors from locations"）时 UTF-8 字节路径必打不开；
    // blob 结构与 CURL_BLOB_COPY=1/NOCOPY=0 见随包 curl/easy.h；curl 侧 BLOB 优先于 CAINFO。
    static const int LB_CURL_OPT_CAINFO_BLOB = 40309;
    static const int LB_CURL_INFO_RESPONSE_CODE = 2097154;
    static const int LB_CURL_INFO_EFFECTIVE_URL = 1048577;

    struct CurlImpersonateApi {
        HMODULE module = nullptr;
        bool attempted = false;
        bool ok = false;
        std::wstring loadError;
        void* (*easyInit)() = nullptr;
        void (*easyCleanup)(void*) = nullptr;
        int (*easyPerform)(void*) = nullptr;
        int (*easySetopt)(void*, int, ...) = nullptr;
        int (*easyGetinfo)(void*, int, ...) = nullptr;
        void* (*slistAppend)(void*, const char*) = nullptr;
        void (*slistFreeAll)(void*) = nullptr;
        // lexiforest v2.2.3 Windows 构建的仿真入口是函数导出（不是 CURLOPT_IMPERSONATE 选项，
        // 实测该选项返回 48 未知选项）；第三参非零 = 启用目标浏览器的默认头集合。
        int (*easyImpersonate)(void*, const char*, int) = nullptr;

        int impersonateProbe(const std::wstring& target) {
            if (!easyInit || !easySetopt || !easyCleanup || !easyImpersonate) return -1;
            void* handle = easyInit();
            if (!handle) return -1;
            const std::string utf8 = LB_WideToUtf8(target.c_str());
            const int result = easyImpersonate(handle, utf8.c_str(), 1);
            easyCleanup(handle);
            return result;
        }
    };

    // 候选表 = 2026-09-30 对随包 libcurl-impersonate.dll（lexiforest v2.2.3）逐个实测通过的档案全集
    //（桌面版 safari17_2 在该构建不存在，只有 safari17_2_ios）；仅用于「未知档案名」诊断展示，
    // 升级 DLL 后以实测为准。
    static std::vector<std::wstring> ImpersonateTargetCandidates() {
        return {
            L"chrome99", L"chrome100", L"chrome101", L"chrome104", L"chrome107", L"chrome110", L"chrome116",
            L"chrome119", L"chrome120", L"chrome123", L"chrome124", L"chrome131", L"chrome133a", L"chrome136",
            L"chrome142", L"chrome150", L"edge99", L"edge101", L"safari15_3", L"safari15_5", L"safari17_0",
            L"safari17_2_ios", L"safari18_0", L"safari18_4_ios", L"firefox133", L"firefox135",
        };
    }

    static CurlImpersonateApi& CurlImpersonate() {
        static CurlImpersonateApi api;
        if (!api.attempted) {
            api.attempted = true;
            api.module = LoadLibraryW(L"libcurl-impersonate.dll");
            if (!api.module) {
                api.loadError = L"未找到 TLS 指纹仿真运行时 libcurl-impersonate.dll（应位于程序目录，随 LingBuilder x64 分发）；请升级或重装 LingBuilder，或改用未设置 TLS 指纹的客户端。";
                return api;
            }
            const auto resolve = [](const char* name) -> void* {
                return reinterpret_cast<void*>(GetProcAddress(api.module, name));
            };
            api.easyInit = reinterpret_cast<void* (*)()>(resolve("curl_easy_init"));
            api.easyCleanup = reinterpret_cast<void (*)(void*)>(resolve("curl_easy_cleanup"));
            api.easyPerform = reinterpret_cast<int (*)(void*)>(resolve("curl_easy_perform"));
            api.easySetopt = reinterpret_cast<int (*)(void*, int, ...)>(resolve("curl_easy_setopt"));
            api.easyGetinfo = reinterpret_cast<int (*)(void*, int, ...)>(resolve("curl_easy_getinfo"));
            api.slistAppend = reinterpret_cast<void* (*)(void*, const char*)>(resolve("curl_slist_append"));
            api.slistFreeAll = reinterpret_cast<void (*)(void*)>(resolve("curl_slist_free_all"));
            api.easyImpersonate = reinterpret_cast<int (*)(void*, const char*, int)>(resolve("curl_easy_impersonate"));
            if (!api.easyInit || !api.easyCleanup || !api.easyPerform || !api.easySetopt || !api.easyGetinfo || !api.slistAppend || !api.slistFreeAll || !api.easyImpersonate) {
                api.loadError = L"libcurl-impersonate.dll 缺少必需导出（curl_easy_init/setopt/getinfo/perform/slist/impersonate），文件可能损坏，请重装 LingBuilder。";
                return api;
            }
            api.ok = true;
        }
        return api;
    }

    static std::string LBCurlUtf8ToHexBase64(const std::vector<unsigned char>& bytes) {
        // 证书固定需要 "sha256//<base64>" 形态：先转 base64 标准字母表。
        static const char* alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string output;
        output.reserve(((bytes.size() + 2) / 3) * 4);
        for (size_t index = 0; index < bytes.size(); index += 3) {
            const unsigned int value = (static_cast<unsigned int>(bytes[index]) << 16)
                | (index + 1 < bytes.size() ? static_cast<unsigned int>(bytes[index + 1]) << 8 : 0u)
                | (index + 2 < bytes.size() ? static_cast<unsigned int>(bytes[index + 2]) : 0u);
            output.push_back(alphabet[(value >> 18) & 63]);
            output.push_back(alphabet[(value >> 12) & 63]);
            output.push_back(index + 1 < bytes.size() ? alphabet[(value >> 6) & 63] : '=');
            output.push_back(index + 2 < bytes.size() ? alphabet[value & 63] : '=');
        }
        return output;
    }

    static std::wstring LBCurlUtf8ToWide(const std::string& value) {
        if (value.empty()) return L"";
        const int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
        if (length <= 0) return L"";
        std::wstring result(static_cast<size_t>(length), L'\0');
        MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), length);
        return result;
    }

    // 与随包 curl/easy.h 的 curl_blob 逐字同形（CURL_BLOB_COPY=1 / CURL_BLOB_NOCOPY=0）。
    struct LBCurlBlob { void* data; size_t len; unsigned int flags; };

    struct CurlTransferBuffer {
        std::vector<unsigned char> body;
        std::string headers;
        size_t maxBytes = 0;
        bool tooLarge = false;
    };

    static size_t LB_CURL_WRITE_CALLBACK(char* ptr, size_t size, size_t nmemb, void* userdata) {
        auto* buffer = static_cast<CurlTransferBuffer*>(userdata);
        const size_t total = size * nmemb;
        if (buffer->maxBytes && buffer->body.size() + total > buffer->maxBytes) {
            buffer->tooLarge = true;
            return 0;
        }
        buffer->body.insert(buffer->body.end(), ptr, ptr + total);
        return total;
    }

    static size_t LB_CURL_HEADER_CALLBACK(char* ptr, size_t size, size_t nmemb, void* userdata) {
        auto* buffer = static_cast<CurlTransferBuffer*>(userdata);
        const size_t total = size * nmemb;
        const std::string line(ptr, ptr + total);
        // 重定向链上每一跳都有状态行：只保留最后一跳的完整响应头（与 WinHTTP 原始头语义一致）。
        if (line.rfind("HTTP/", 0) == 0) buffer->headers.clear();
        buffer->headers.append(line);
        return total;
    }

    static std::wstring LBCurlErrorMessage(int code) {
        switch (code) {
            case 3: return L"TLS 指纹请求：地址格式无效。";
            case 6: return L"TLS 指纹请求：无法解析主机名。";
            case 7: return L"TLS 指纹请求：无法连接目标主机或代理。";
            case 23: return L"TLS 指纹请求：响应正文超过资源上限。";
            case 28: return L"TLS 指纹请求：超时。";
            case 35: return L"TLS 指纹请求：TLS 握手失败。";
            case 47: return L"TLS 指纹请求：重定向次数过多。";
            case 55: return L"TLS 指纹请求：发送失败。";
            case 56: return L"TLS 指纹请求：接收失败。";
            case 60: return L"TLS 指纹请求：对端证书校验失败。";
            case 77: return L"TLS 指纹请求：CA 证书包无法加载。";
            default: return L"TLS 指纹请求失败（libcurl 错误码见系统错误码）。";
        }
    }

    // 仿真请求执行：与 WinHTTP 路径写同一组 Request 字段，响应解析复用 ParseResponseHeaders。
    // v1 边界：不支持文件上传/断点续传（流式）与运行中取消（取消在请求结束后生效），给中文阻断诊断。
    void ExecuteWithImpersonation(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client) {
        CurlImpersonateApi& api = CurlImpersonate();
        if (!api.ok) { RequestFail(*request, api.loadError.c_str(), ERROR_NOT_SUPPORTED); return; }
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            if (!request->uploadPath.empty()) { RequestFailUnlocked(*request, L"TLS 指纹客户端暂不支持文件上传正文，请改用字节集/文本正文或未设指纹的客户端。", ERROR_NOT_SUPPORTED); return; }
            if (!request->resumePath.empty()) { RequestFailUnlocked(*request, L"TLS 指纹客户端暂不支持断点续传落盘，请改用设置响应文件或未设指纹的客户端。", ERROR_NOT_SUPPORTED); return; }
        }
        std::wstring impersonateTarget; bool userAgentExplicit = false;
        {
            std::lock_guard<std::mutex> lock(client->mutex);
            impersonateTarget = client->impersonateTarget;
        }
        if (impersonateTarget.empty()) { RequestFail(*request, L"TLS 指纹目标为空。", ERROR_INVALID_STATE); return; }
        int requestProxyMode = -1; std::wstring requestProxy, requestProxyUser, requestProxyPassword;
        { std::lock_guard<std::mutex> lock(request->mutex); requestProxyMode = request->proxyMode; requestProxy = request->proxy; requestProxyUser = request->proxyUser; requestProxyPassword = request->proxyPassword; }
        std::wstring proxyText; std::wstring proxyCredentials; bool forceNoProxy = false;
        if (requestProxyMode == 2) {
            proxyText = requestProxy;
            if (!requestProxyUser.empty()) proxyCredentials = requestProxyUser + L":" + requestProxyPassword;
        } else if (requestProxyMode == 1) {
            proxyText = L""; forceNoProxy = true;
        } else {
            std::lock_guard<std::mutex> lock(client->mutex);
            if (client->proxyMode == 2) { proxyText = client->proxy; if (!client->proxyUser.empty()) proxyCredentials = client->proxyUser + L":" + client->proxyPassword; }
            else if (client->proxyMode == 1) { proxyText = L""; forceNoProxy = true; }
        }
        std::wstring method, url; std::vector<std::pair<std::wstring, std::wstring>> headerList; std::vector<unsigned char> body; std::wstring cookieLine;
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            method = request->method; url = request->url; headerList = request->headers; body = request->body;
            cookieLine = request->cookieOverride;
        }
        URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts);
        parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1);
        parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        const bool cracked = WinHttpCrackUrl(url.c_str(), 0, 0, &parts);
        const std::wstring requestHost = cracked ? std::wstring(parts.lpszHostName, parts.dwHostNameLength) : L"";
        const std::wstring requestPath = cracked ? std::wstring(parts.dwUrlPathLength ? parts.lpszUrlPath : L"/", parts.dwUrlPathLength ? parts.dwUrlPathLength : 1) : L"";
        {
            std::lock_guard<std::mutex> lock(client->mutex);
            if (cookieLine.empty() && client->cookiesEnabled) {
                for (const auto& item : client->manualCookies) {
                    if (ManualCookieDomainMatches(requestHost, item.domain) && ManualCookiePathMatches(requestPath, item.path)) {
                        if (!cookieLine.empty()) cookieLine += L"; ";
                        cookieLine += item.name + L"=" + item.value;
                    }
                }
            } else if (cookieLine.empty() && !client->cookiesEnabled) {
                // 与 WinHTTP 路径一致：关闭 Cookie 时既不注入手工 Cookie 也不启用引擎。
            }
        }
        size_t maxBodyBytes = 0; std::wstring certificatePin;
        bool verifyCertificate = true, allowSelfSigned = false, allowRedirects = true; int maxRedirects = 10;
        int connectTimeoutMs = 15000, receiveTimeoutMs = 30000;
        std::wstring explicitUserAgent;
        {
            std::lock_guard<std::mutex> lock(client->mutex);
            maxBodyBytes = client->maxBodyBytes;
            certificatePin = client->certificatePin;
            verifyCertificate = client->verifyCertificate;
            allowSelfSigned = client->allowSelfSigned;
            allowRedirects = client->allowRedirects;
            maxRedirects = client->maxRedirects;
            connectTimeoutMs = client->connectTimeoutMs;
            receiveTimeoutMs = client->receiveTimeoutMs;
            explicitUserAgent = client->userAgentExplicit ? client->userAgent : L"";
        }
        void* handle = api.easyInit();
        if (!handle) { RequestFail(*request, L"TLS 指纹仿真会话初始化失败。", ERROR_NOT_ENOUGH_MEMORY); return; }
        CurlTransferBuffer transfer;
        transfer.maxBytes = maxBodyBytes;
        std::string errorBuffer(256, static_cast<char>(0));
        bool certificatePinned = false;
        // 指针保活：curl 只保存 slist 指针，全部字符串必须活到 perform 结束。
        std::vector<std::string> stringStorage;
        // CA 证书包保活：BLOB 指针必须活到 perform 结束。
        std::vector<unsigned char> caBlobStorage;
        LBCurlBlob caBlob = { nullptr, 0, 1 };
        std::vector<std::string> stringStorage;
        const auto keepUtf8 = [&](const std::wstring& value) -> const char* {
            stringStorage.push_back(LB_WideToUtf8(value.c_str()));
            return stringStorage.back().c_str();
        };
        // 文件路径类选项（CAINFO）必须交给 curl 一个 Windows 能真正打开的路径：curl 在 Windows 上按
        // ANSI(ACP) 而非 UTF-8 打开文件，含中文的目录名（如 T:\逆向\小红书\...）按 UTF-8 传会 fopen 失败，
        // SSL 信任链缺失 → 请求在第 0 步失败（CAINFO 在 10065 修复后真正生效才暴露）。优先取 8.3 短路径
        // （纯 ASCII，任何代码页都能打开），退化时按 ACP 编码。
        const auto keepAnsiPath = [&](const std::wstring& value) -> const char* {
            std::wstring filePath = value;
            wchar_t shortPath[MAX_PATH] = {};
            if (GetShortPathNameW(value.c_str(), shortPath, MAX_PATH) > 0) filePath.assign(shortPath);
            std::string output;
            const int size = WideCharToMultiByte(CP_ACP, 0, filePath.c_str(), -1, nullptr, 0, nullptr, nullptr);
            if (size > 1) {
                output.resize(static_cast<size_t>(size), '\0');
                WideCharToMultiByte(CP_ACP, 0, filePath.c_str(), -1, output.data(), size, nullptr, nullptr);
                output.resize(static_cast<size_t>(size - 1));
            }
            stringStorage.push_back(std::move(output));
            return stringStorage.back().c_str();
        };
        // 全部 setopt 返回值必须检查：未知选项号（CAINFO 曾误写 10098）会以返回码 48 被静默丢弃，
        // 配置看似生效实则从未应用；失败项汇总后在 perform 前给中文阻断诊断，不外发请求。
        std::vector<std::wstring> rejectedOptions;
        const auto setoptChecked = [&](int option, const wchar_t* label, auto value) -> bool {
            const int result = api.easySetopt(handle, option, value);
            if (result != 0) rejectedOptions.push_back(std::wstring(label) + L"(CURLOPT " + std::to_wstring(option) + L"，返回码 " + std::to_wstring(result) + L")");
            return result == 0;
        };
        setoptChecked(LB_CURL_OPT_ERRORBUFFER, L"ERRORBUFFER", errorBuffer.data());
        setoptChecked(LB_CURL_OPT_URL, L"URL", keepUtf8(url));
        setoptChecked(LB_CURL_OPT_WRITEFUNCTION, L"WRITEFUNCTION", reinterpret_cast<void*>(&LB_CURL_WRITE_CALLBACK));
        setoptChecked(LB_CURL_OPT_HEADERFUNCTION, L"HEADERFUNCTION", reinterpret_cast<void*>(&LB_CURL_HEADER_CALLBACK));
        setoptChecked(LB_CURL_OPT_WRITEDATA, L"WRITEDATA", static_cast<void*>(&transfer));
        setoptChecked(LB_CURL_OPT_HEADERDATA, L"HEADERDATA", static_cast<void*>(&transfer));
        setoptChecked(LB_CURL_OPT_NOPROGRESS, L"NOPROGRESS", static_cast<long>(1));
        // Accept-Encoding 置空串 = 用 libcurl 支持的全部压缩并自动解压响应正文
        // （impersonate 默认头只是声明协商能力，不解压；不设此项会拿到原始压缩字节）。
        setoptChecked(LB_CURL_OPT_ACCEPT_ENCODING, L"ACCEPT_ENCODING", "");
        setoptChecked(LB_CURL_OPT_FOLLOWLOCATION, L"FOLLOWLOCATION", static_cast<long>(allowRedirects ? 1 : 0));
        setoptChecked(LB_CURL_OPT_MAXREDIRS, L"MAXREDIRS", static_cast<long>(maxRedirects));
        setoptChecked(LB_CURL_OPT_CONNECTTIMEOUT_MS, L"CONNECTTIMEOUT_MS", static_cast<long>(connectTimeoutMs));
        setoptChecked(LB_CURL_OPT_TIMEOUT_MS, L"TIMEOUT_MS", static_cast<long>(receiveTimeoutMs));
        setoptChecked(LB_CURL_OPT_SSL_VERIFYPEER, L"SSL_VERIFYPEER", static_cast<long>(verifyCertificate ? 1 : 0));
        setoptChecked(LB_CURL_OPT_SSL_VERIFYHOST, L"SSL_VERIFYHOST", static_cast<long>(verifyCertificate ? 2 : 0));
        if (certificatePin.size() == 64) {
            std::vector<unsigned char> pinBytes;
            bool pinHexValid = true;
            for (size_t index = 0; index + 1 < certificatePin.size(); index += 2) {
                const auto digit = [](wchar_t ch) -> int {
                    if (ch >= L'0' && ch <= L'9') return ch - L'0';
                    if (ch >= L'a' && ch <= L'f') return ch - L'a' + 10;
                    if (ch >= L'A' && ch <= L'F') return ch - L'A' + 10;
                    return -1;
                };
                const int high = digit(certificatePin[index]);
                const int low = digit(certificatePin[index + 1]);
                if (high < 0 || low < 0) { pinHexValid = false; break; }
                pinBytes.push_back(static_cast<unsigned char>((high << 4) | low));
            }
            if (pinHexValid && pinBytes.size() == 32) {
                const std::string pinned = "sha256//" + LBCurlUtf8ToHexBase64(pinBytes);
                if (setoptChecked(LB_CURL_OPT_PINNEDPUBLICKEY, L"PINNEDPUBLICKEY", pinned.c_str())) certificatePinned = true;
            }
        }
        if (verifyCertificate) {
            // BoringSSL 无 Windows 证书库集成：把随包 CA 证书包（cacert.pem，程序目录）喂给 curl。
            // 主路径：宽字符 std::ifstream 读入内存走 CURLOPT_CAINFO_BLOB——对非 ASCII 程序目录免疫
            // （真机实锤：T:\逆向\蓝奏云\... 下路径形态 rc=77 "error adding trust anchors"，
            // BoringSSL 按 ANSI fopen 打开 CAfile，UTF-8 字节路径必打不开；本地 A/B 探针实证 BLOB 200）。
            // 兜底：CAINFO 路径形态（keepAnsiPath → 8.3 短路径/ACP），仅在 DLL 不支持 BLOB 时才会被消费；
            // 禁止 keepUtf8 直传路径。与其它 setopt 不同，本组失败不阻断（不进 rejectedOptions）：
            // CA 包不可用就退回 DLL 内置默认 CA（该回退真机长期可用），不把「CA 包不可用」升级成「请求失败」。
            wchar_t exePath[MAX_PATH] = {};
            GetModuleFileNameW(nullptr, exePath, MAX_PATH);
            std::wstring exeDirectory(exePath);
            const size_t slash = exeDirectory.find_last_of(L"\\/");
            if (slash != std::wstring::npos) exeDirectory.resize(slash + 1);
            const std::wstring caBundle = exeDirectory + L"cacert.pem";
            if (GetFileAttributesW(caBundle.c_str()) != INVALID_FILE_ATTRIBUTES) {
                setoptChecked(LB_CURL_OPT_CAINFO, L"CAINFO", keepAnsiPath(caBundle));
            }
            std::ifstream caStream(std::filesystem::path(caBundle), std::ios::binary);
            if (caStream) {
                caStream.seekg(0, std::ios::end);
                const std::streamsize caSize = caStream.tellg();
                if (caSize > 0) {
                    caStream.seekg(0, std::ios::beg);
                    caBlobStorage.resize(static_cast<size_t>(caSize));
                    caStream.read(reinterpret_cast<char*>(caBlobStorage.data()), caSize);
                    caBlob.data = caBlobStorage.data();
                    caBlob.len = caBlobStorage.size();
                    api.easySetopt(handle, LB_CURL_OPT_CAINFO_BLOB, &caBlob);
            }
        }
        if (!proxyText.empty()) {
            setoptChecked(LB_CURL_OPT_PROXY, L"PROXY", keepUtf8(proxyText));
            if (!proxyCredentials.empty()) setoptChecked(LB_CURL_OPT_PROXYUSERPWD, L"PROXYUSERPWD", keepUtf8(proxyCredentials));
        } else if (forceNoProxy) {
            setoptChecked(LB_CURL_OPT_PROXY, L"PROXY", "");
        }
        // 头顺序 = 仿真目标默认头（UA/sec-ch-ua/Accept-Encoding 等，libcurl 内部 base 头，IMPERSONATE "目标:yes" 启用）
        // 之后按用户设置顺序追加；同名头以用户头为准。显式 UA 覆盖目标默认 UA。
        if (!explicitUserAgent.empty()) setoptChecked(LB_CURL_OPT_USERAGENT, L"USERAGENT", keepUtf8(explicitUserAgent));
        std::vector<std::string> headerStorage;
        void* headerSlist = nullptr;
        const auto appendHeader = [&](const std::wstring& name, const std::wstring& value) {
            headerStorage.push_back(LB_WideToUtf8((name + L": " + value).c_str()));
            headerSlist = api.slistAppend(headerSlist, headerStorage.back().c_str());
        };
        for (const auto& item : headerList) appendHeader(item.first, item.second);
        if (!cookieLine.empty()) appendHeader(L"Cookie", cookieLine);
        if (headerSlist) setoptChecked(LB_CURL_OPT_HTTPHEADER, L"HTTPHEADER", headerSlist);
        if (api.easyImpersonate(handle, keepUtf8(impersonateTarget), 1) != 0) {
            const std::wstring impersonateError = L"TLS 指纹档案「" + impersonateTarget + L"」未被 libcurl-impersonate.dll 接受，请升级 LingBuilder 或改用已支持档案。";
            RequestFail(*request, impersonateError.c_str(), ERROR_NOT_SUPPORTED);
            api.easyCleanup(handle);
            if (headerSlist) api.slistFreeAll(headerSlist);
            return;
        }
        if (!body.empty() && method == L"POST") {
            setoptChecked(LB_CURL_OPT_POSTFIELDS, L"POSTFIELDS", reinterpret_cast<void*>(const_cast<unsigned char*>(body.data())));
            setoptChecked(LB_CURL_OPT_POSTFIELDSIZE_LARGE, L"POSTFIELDSIZE_LARGE", static_cast<long long>(body.size()));
        } else if (!body.empty()) {
            setoptChecked(LB_CURL_OPT_POSTFIELDS, L"POSTFIELDS", reinterpret_cast<void*>(const_cast<unsigned char*>(body.data())));
            setoptChecked(LB_CURL_OPT_POSTFIELDSIZE_LARGE, L"POSTFIELDSIZE_LARGE", static_cast<long long>(body.size()));
            setoptChecked(LB_CURL_OPT_CUSTOMREQUEST, L"CUSTOMREQUEST", keepUtf8(method));
        } else if (method != L"GET" && method != L"POST") {
            setoptChecked(LB_CURL_OPT_CUSTOMREQUEST, L"CUSTOMREQUEST", keepUtf8(method));
        }
        if (!rejectedOptions.empty()) {
            std::wstring detail;
            for (const auto& item : rejectedOptions) { if (!detail.empty()) detail += L"、"; detail += item; }
            RequestFail(*request, (L"TLS 指纹请求初始化失败：以下 curl 选项被随包 libcurl-impersonate.dll 拒绝：" + detail + L"。多为选项常量与 DLL 版本不匹配，请升级或重装 LingBuilder。").c_str(), ERROR_NOT_SUPPORTED);
            api.easyCleanup(handle);
            if (headerSlist) api.slistFreeAll(headerSlist);
            return;
        }

        const int performResult = api.easyPerform(handle);
        long responseCode = 0;
        char* effectiveUrlUtf8 = nullptr;
        api.easyGetinfo(handle, LB_CURL_INFO_RESPONSE_CODE, &responseCode);
        api.easyGetinfo(handle, LB_CURL_INFO_EFFECTIVE_URL, &effectiveUrlUtf8);
        const std::string headersUtf8 = transfer.headers;
        const std::vector<unsigned char> responseBytes = transfer.body;
        const bool responseTooLarge = transfer.tooLarge;
        if (headerSlist) api.slistFreeAll(headerSlist);
        api.easyCleanup(handle);

        if (performResult != 0 || responseTooLarge) {
            const int code = responseTooLarge ? 23 : performResult;
            std::wstring message = LBCurlErrorMessage(code);
            if (!responseTooLarge && errorBuffer[0] != static_cast<char>(0)) {
                const std::wstring detail = LBCurlUtf8ToWide(errorBuffer.c_str());
                if (!detail.empty()) message += L"：" + detail;
            }
            RequestFail(*request, message.c_str(), code);
            return;
        }
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            request->statusCode = static_cast<int>(responseCode);
            std::string statusLine = headersUtf8.substr(0, headersUtf8.find('\n'));
            while (!statusLine.empty() && (statusLine.back() == '\r' || statusLine.back() == '\n')) statusLine.pop_back();
            const size_t firstSpace = statusLine.find(' ');
            const size_t secondSpace = firstSpace == std::string::npos ? std::string::npos : statusLine.find(' ', firstSpace + 1);
            request->protocol = LBCurlUtf8ToWide(firstSpace == std::string::npos ? statusLine : statusLine.substr(0, firstSpace));
            if (!request->protocol.empty() && request->protocol.back() == L':') request->protocol.pop_back();
            request->statusText = secondSpace == std::string::npos ? L"" : LBCurlUtf8ToWide(statusLine.substr(secondSpace + 1));
            request->headersText = LBCurlUtf8ToWide(headersUtf8);
            if (effectiveUrlUtf8) request->finalUrl = LBCurlUtf8ToWide(effectiveUrlUtf8);
            request->response = responseBytes;
            request->responseSize = static_cast<long long>(responseBytes.size());
            request->downloadedBytes = static_cast<long long>(responseBytes.size());
            ParseResponseHeaders(*request);
        }
        if (!request->responsePath.empty()) {
            bool allowOverwrite = false;
            { std::lock_guard<std::mutex> lock(request->mutex); allowOverwrite = request->responseAllowOverwrite; }
            if (!SaveBytes(request->responsePath, responseBytes, allowOverwrite, *request)) return;
            // 与 WinHTTP 流式落盘同一契约：文件响应不占内存正文，取响应字节集返回空字节集。
            std::lock_guard<std::mutex> lock(request->mutex);
            request->response.clear();
        }
        (void)certificatePinned;
    }

    void Execute(const std::shared_ptr<Request>& request, const std::shared_ptr<Client>& client) {
        // 设置了 TLS 指纹的客户端整体改走 curl-impersonate 仿真栈（不经 WinHTTP 会话）。
        // 判定必须在锁外完成：执行路径内部还会取 client->mutex（std::mutex 不可重入）。
        const bool impersonated = [&client]() {
            std::lock_guard<std::mutex> lock(client->mutex);
            return !client->impersonateTarget.empty();
        }();
        if (impersonated) { ExecuteWithImpersonation(request, client); return; }
        // 逐请求代理覆盖：设置了固定代理的请求使用请求私有会话（代理在会话创建时固化），其余复用客户端缓存会话。
        struct OwnedSessionCloser { HINTERNET handle = nullptr; ~OwnedSessionCloser() { if (handle) WinHttpCloseHandle(handle); } } ownedSessionCloser;
        int requestProxyMode = -1; std::wstring requestProxy, requestProxyBypass, requestProxyUser, requestProxyPassword;
        { std::lock_guard<std::mutex> lock(request->mutex); requestProxyMode = request->proxyMode; requestProxy = request->proxy; requestProxyBypass = request->proxyBypass; requestProxyUser = request->proxyUser; requestProxyPassword = request->proxyPassword; }
        HINTERNET session = nullptr; bool ownedSession = false;
        if (requestProxyMode == 2) {
            std::lock_guard<std::mutex> lock(client->mutex);
            session = WinHttpOpen(client->userAgent.c_str(), WINHTTP_ACCESS_TYPE_NAMED_PROXY, requestProxy.c_str(), requestProxyBypass.empty() ? WINHTTP_NO_PROXY_BYPASS : requestProxyBypass.c_str(), 0);
            if (session) { ownedSession = true; ownedSessionCloser.handle = session; WinHttpSetTimeouts(session, client->resolveTimeoutMs, client->connectTimeoutMs, client->sendTimeoutMs, client->receiveTimeoutMs); }
        } else if (!EnsureSession(client, session)) { RequestFail(*request, L"HTTP 会话创建失败。", GetLastError()); return; }
        if (!session) { RequestFail(*request, L"HTTP 请求代理会话创建失败。", GetLastError()); return; }
        URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts); parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1); parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(request->url.c_str(), 0, 0, &parts) || (parts.nScheme != INTERNET_SCHEME_HTTP && parts.nScheme != INTERNET_SCHEME_HTTPS)) { RequestFail(*request, L"HTTP 地址解析失败。", GetLastError()); return; }
        const std::wstring host(parts.lpszHostName, parts.dwHostNameLength); std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/"; const std::wstring urlPath = path; if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
        std::wstring requestCookie; { std::lock_guard<std::mutex> lock(request->mutex); requestCookie = request->cookieOverride; }
        HINTERNET connection = WinHttpConnect(session, host.c_str(), parts.nPort, 0); if (!connection) { RequestFail(*request, L"HTTP 主机连接失败。", GetLastError()); return; }
        HINTERNET nativeRequest = WinHttpOpenRequest(connection, request->method.c_str(), path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, parts.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0); if (!nativeRequest) { WinHttpCloseHandle(connection); RequestFail(*request, L"HTTP 请求创建失败。", GetLastError()); return; }
        { std::lock_guard<std::mutex> lock(request->handlesMutex); request->connection = connection; request->request = nativeRequest; }
        std::wstring headers;
        std::wstring certificatePin;
        DWORD redirectPolicy = WINHTTP_OPTION_REDIRECT_POLICY_DEFAULT;
        DWORD decompression = 0;
        size_t maxUploadBytes = 0;
        std::wstring jarCookie;
        {
            std::lock_guard<std::mutex> lock(client->mutex);
            for (const auto& item : client->defaultHeaders) headers += item.first + L": " + item.second + L"\r\n";
            if (requestCookie.empty()) for (const auto& item : client->manualCookies) { if (ManualCookieDomainMatches(host, item.domain) && ManualCookiePathMatches(urlPath, item.path)) { if (!jarCookie.empty()) jarCookie += L"; "; jarCookie += item.name + L"=" + item.value; } }
            certificatePin = client->certificatePin;
            redirectPolicy = !client->allowRedirects ? WINHTTP_OPTION_REDIRECT_POLICY_NEVER : (client->allowHttpsDowngrade ? WINHTTP_OPTION_REDIRECT_POLICY_ALWAYS : WINHTTP_OPTION_REDIRECT_POLICY_DISALLOW_HTTPS_TO_HTTP);
            decompression = client->autoDecompression ? WINHTTP_DECOMPRESSION_FLAG_ALL : 0;
            maxUploadBytes = client->maxUploadBytes;
            if (!client->serverUser.empty() && !WinHttpSetCredentials(nativeRequest, WINHTTP_AUTH_TARGET_SERVER, WINHTTP_AUTH_SCHEME_BASIC, client->serverUser.c_str(), client->serverPassword.c_str(), nullptr)) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 服务器凭据设置失败。", GetLastError()); return; }
            { const std::wstring& proxyUser = !requestProxyUser.empty() ? requestProxyUser : client->proxyUser; const std::wstring& proxyPassword = !requestProxyUser.empty() ? requestProxyPassword : client->proxyPassword;
            if (!proxyUser.empty() && !WinHttpSetCredentials(nativeRequest, WINHTTP_AUTH_TARGET_PROXY, WINHTTP_AUTH_SCHEME_BASIC, proxyUser.c_str(), proxyPassword.c_str(), nullptr)) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 代理凭据设置失败。", GetLastError()); return; } }
            DWORD security = 0;
            if (!client->verifyCertificate) security = SECURITY_FLAG_IGNORE_UNKNOWN_CA | SECURITY_FLAG_IGNORE_CERT_DATE_INVALID | SECURITY_FLAG_IGNORE_CERT_CN_INVALID | SECURITY_FLAG_IGNORE_CERT_WRONG_USAGE;
            else if (client->allowSelfSigned) security = SECURITY_FLAG_IGNORE_UNKNOWN_CA;
            if (security && !WinHttpSetOption(nativeRequest, WINHTTP_OPTION_SECURITY_FLAGS, &security, sizeof(security))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP TLS 安全策略设置失败。", GetLastError()); return; }
        }
        if (!WinHttpSetOption(nativeRequest, WINHTTP_OPTION_REDIRECT_POLICY, &redirectPolicy, sizeof(redirectPolicy))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 重定向策略设置失败。", GetLastError()); return; }
        if (!WinHttpSetOption(nativeRequest, WINHTTP_OPTION_DECOMPRESSION, &decompression, sizeof(decompression))) { CloseRequestHandles(request); RequestFail(*request, L"HTTP 自动解压策略设置失败。", GetLastError()); return; }
        { std::lock_guard<std::mutex> lock(request->mutex); for (const auto& item : request->headers) headers += item.first + L": " + item.second + L"\r\n"; if (!request->bodyMime.empty() && (!request->body.empty() || !request->uploadPath.empty())) headers += L"Content-Type: " + request->bodyMime + L"\r\n"; }
        if (requestCookie.empty()) requestCookie = jarCookie;
        if (!requestCookie.empty()) {
            headers += L"Cookie: " + requestCookie + L"\r\n";
            // 手工 Cookie 与自动罐不混发：本请求（含重定向）关闭 WinHTTP 自动 Cookie 回送，避免双 Cookie 头。
            DWORD disableCookies = WINHTTP_DISABLE_COOKIES; WinHttpSetOption(nativeRequest, WINHTTP_OPTION_DISABLE_FEATURE, &disableCookies, sizeof(disableCookies));
        }
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
        bool appendMode = false;
        bool allowOverwrite = false;
        {
            std::lock_guard<std::mutex> lock(request->mutex);
            responsePath = request->responsePath;
            allowOverwrite = request->responseAllowOverwrite;
            if (responsePath.empty()) { responsePath = request->resumePath; appendMode = !responsePath.empty(); }
        }
        toFile = !responsePath.empty();
        if (toFile && !appendMode) {
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
        } else if (toFile) {
            // 续传模式：直接以追加方式打开目标文件，不清空已有内容、不走临时文件替换；
            // 下载中断时已写入的字节保留在目标文件中，正是下一次 Range 续传的起点。
            file.open(std::filesystem::path(responsePath), std::ios::binary | std::ios::app);
            if (!file) {
                RequestFail(*request, L"HTTP 续传文件打开失败。", GetLastError());
                return;
            }
        }
        while (true) {
            DWORD available = 0;
            if (!WinHttpQueryDataAvailable(nativeRequest, &available)) { RequestFail(*request, L"HTTP 查询响应大小失败。", GetLastError()); break; }
            if (available == 0) break;
            // 流式写文件的响应按盘落盘、不驻留内存，不受响应体内存上限约束；上限只保护内存响应。
            if (!toFile && request->downloadedBytes.load() + available > static_cast<long long>(client->maxBodyBytes)) { RequestFail(*request, L"HTTP 响应正文超过资源限制。", ERROR_FILE_TOO_LARGE); break; }
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
                if (!appendMode) DeleteFileW(temporary.c_str());
                // 追加模式出错时保留已写入内容，作为下一次断点续传的起点。
            } else if (!appendMode && !MoveFileExW(temporary.c_str(), responsePath.c_str(), allowOverwrite ? MOVEFILE_REPLACE_EXISTING : MOVEFILE_COPY_ALLOWED)) {
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
    std::wstring RequestText(long long id, int kind) const { auto request = FindRequest(id); if (!request) return L"HTTP 请求 ID 无效。"; std::lock_guard<std::mutex> lock(request->mutex); switch (kind) { case 1: return request->method; case 2: return request->url; case 3: return request->state; case 4: return request->error; case 5: return request->statusText; case 6: return request->protocol; case 7: return request->finalUrl; case 8: return request->headersText; case 9: return request->headersJson; case 10: return request->responsePath.empty() ? request->resumePath : request->responsePath; case 11: return request->contentType; case 12: return request->certificateSha256; default: return L""; } }
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
    const wchar_t* HTTP客户端_解析跳转链(long long client, const wchar_t* url, int maxHops) { httpClientReturnText_ = httpClientRuntime_.ResolveRedirectChain(client, url, maxHops); return httpClientReturnText_.c_str(); }
    int HTTP客户端请求_设置代理(long long request, const wchar_t* address) { return httpClientRuntime_.SetRequestProxy(request, address) ? 1 : 0; }
    int HTTP客户端请求_设置代理凭据(long long request, const wchar_t* user, const wchar_t* password) { return httpClientRuntime_.SetRequestCredentials(request, user, password) ? 1 : 0; }
    int HTTP客户端_设置TLS指纹(long long client, const wchar_t* target) { return httpClientRuntime_.SetImpersonateTarget(client, target) ? 1 : 0; }
    const wchar_t* HTTP客户端_取TLS指纹(long long client) { httpClientReturnText_ = httpClientRuntime_.GetImpersonateTarget(client); return httpClientReturnText_.c_str(); }
    bool HTTP客户端_设置TLS策略(long long client, bool verify, bool allowSelfSigned) { return httpClientRuntime_.SetTls(client, verify, allowSelfSigned); }
    bool HTTP客户端_设置证书固定(long long client, const wchar_t* fingerprint) { return httpClientRuntime_.SetCertificatePin(client, fingerprint); }
    bool HTTP客户端_设置自动解压(long long client, bool enabled) { return httpClientRuntime_.SetDecompression(client, enabled); }
    bool HTTP客户端_设置Cookie(long long client, bool enabled) { return httpClientRuntime_.SetCookies(client, enabled); }
    bool HTTP客户端_置Cookie(long long client, const wchar_t* name, const wchar_t* value, const wchar_t* domain, const wchar_t* path) { return httpClientRuntime_.SetManualCookie(client, name, value, domain, path); }
    const wchar_t* HTTP客户端_取CookieJSON(long long client) { httpClientReturnText_ = httpClientRuntime_.ManualCookiesJson(client); return httpClientReturnText_.c_str(); }
    bool HTTP客户端_删除全部Cookie(long long client) { return httpClientRuntime_.ClearManualCookies(client); }
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
    bool HTTP客户端_请求置Cookie(long long request, const wchar_t* cookie) { return httpClientRuntime_.SetRequestCookie(request, cookie); }
    bool HTTP客户端_设置文本正文(long long request, const wchar_t* body, const wchar_t* contentType) { return httpClientRuntime_.SetTextBody(request, body, contentType); }
    bool HTTP客户端_设置JSON正文(long long request, const wchar_t* body) { return httpClientRuntime_.SetJsonBody(request, body); }
    bool HTTP客户端_设置二进制正文(long long request, const std::vector<unsigned char>& body, const wchar_t* contentType) { return httpClientRuntime_.SetBinaryBody(request, body, contentType); }
    bool HTTP客户端_设置十六进制正文(long long request, const wchar_t* body, const wchar_t* contentType) { return httpClientRuntime_.SetHexBody(request, body, contentType); }
    bool HTTP客户端_设置文件正文(long long request, const wchar_t* path, const wchar_t* contentType) { return httpClientRuntime_.SetFileBody(request, path, contentType); }
    bool HTTP客户端_设置响应文件(long long request, const wchar_t* path, bool overwrite) { return httpClientRuntime_.SetResponseFile(request, path, overwrite); }
    bool HTTP客户端_设置续传文件(long long request, const wchar_t* path) { return httpClientRuntime_.SetResumeFile(request, path); }
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
