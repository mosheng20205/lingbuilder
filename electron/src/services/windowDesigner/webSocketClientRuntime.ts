import { InstalledModule } from '../modules/types';

export const WEBSOCKET_CLIENT_MODULE_ID = 'lingbuilder.websocket.client';

export function generateWebSocketClientRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_CLIENT_MODULE_ID)) return '';
  return WEBSOCKET_CLIENT_RUNTIME;
}

export function generateWebSocketClientWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_CLIENT_MODULE_ID)) return '';
  return WEBSOCKET_CLIENT_WINDOW_METHODS;
}

export function generateWebSocketClientGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_CLIENT_MODULE_ID)) return '';
  return WEBSOCKET_CLIENT_WINDOW_METHODS
    .replaceAll('wsClientRuntime_', 'g_wsClientRuntime')
    .replaceAll('wsClientReturnText_', 'g_wsClientReturnText')
    .replace(/^    /gmu, 'static ');
}

export function generateWebSocketClientGlobalMethodDeclarations(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_CLIENT_MODULE_ID)) return '';
  return WEBSOCKET_CLIENT_WINDOW_METHODS
    .trim()
    .split(/\r?\n/u)
    .map(line => {
      const normalized = line.trim();
      const signatureEnd = normalized.indexOf(' {');
      if (signatureEnd < 0) throw new Error(`WebSocket 客户端包装方法缺少函数体：${normalized}`);
      return `static ${normalized.slice(0, signatureEnd)};`;
    })
    .join('\n');
}

const WEBSOCKET_CLIENT_RUNTIME = String.raw`
class LingWebSocketClientRuntime {
public:
    using NotifyEvent = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingWebSocketClientRuntime(NotifyEvent notify) : notify_(std::move(notify)) {}
    ~LingWebSocketClientRuntime() { Shutdown(); }

    long long Create() {
        auto connection = std::make_shared<Connection>();
        connection->id = nextConnectionId_.fetch_add(1);
        std::lock_guard<std::mutex> lock(connectionsMutex_);
        connections_[connection->id] = connection;
        return connection->id;
    }

    bool Configure(long long id, const wchar_t* url) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        const std::wstring address = url ? url : L"";
        if (!IsWebSocketUrl(address)) return ConnectionFail(connection, L"WebSocket 地址必须使用 ws:// 或 wss://，并且不能为空。");
        if (!RequireStopped(connection)) return false;
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->url = address;
        connection->state = L"已停止";
        connection->lastError.clear();
        return true;
    }

    bool SetLimits(long long id, int connectTimeoutMs, int receiveTimeoutMs, int messageMb, int sendMb) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!RequireStopped(connection)) return false;
        if (connectTimeoutMs < 1000 || connectTimeoutMs > 300000) return ConnectionFail(connection, L"WebSocket 连接超时必须在 1000 到 300000 毫秒之间。");
        if (receiveTimeoutMs < 1000 || receiveTimeoutMs > 3600000) return ConnectionFail(connection, L"WebSocket 接收超时必须在 1000 到 3600000 毫秒之间。");
        if (messageMb < 1 || messageMb > 1024 || sendMb < 1 || sendMb > 1024) return ConnectionFail(connection, L"WebSocket 消息和发送上限必须在 1MB 到 1024MB 之间。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->connectTimeoutMs = connectTimeoutMs;
        connection->receiveTimeoutMs = receiveTimeoutMs;
        connection->maxMessageBytes = static_cast<size_t>(messageMb) * 1024 * 1024;
        connection->maxSendBytes = static_cast<size_t>(sendMb) * 1024 * 1024;
        return true;
    }

    bool SetUserAgent(long long id, const wchar_t* value) { return SetSafeText(id, value, 1); }
    bool SetHeaders(long long id, const wchar_t* value) { return SetSafeText(id, value, 2); }
    bool SetOrigin(long long id, const wchar_t* value) { return SetSafeText(id, value, 3); }
    bool SetProtocols(long long id, const wchar_t* value) { return SetSafeText(id, value, 4); }

    bool SetProxy(long long id, int mode, const wchar_t* address, const wchar_t* bypass) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!RequireStopped(connection)) return false;
        if (mode < 0 || mode > 2) return ConnectionFail(connection, L"WebSocket 代理模式必须为 0（系统自动）、1（直连）或 2（固定代理）。");
        const std::wstring proxy = address ? address : L"";
        const std::wstring ignored = bypass ? bypass : L"";
        if (ContainsNewline(proxy) || ContainsNewline(ignored) || (mode == 2 && proxy.empty())) return ConnectionFail(connection, L"WebSocket 固定代理地址不能为空，且代理配置不能包含换行。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->proxyMode = mode; connection->proxy = proxy; connection->proxyBypass = ignored;
        return true;
    }

    bool SetCredentials(long long id, const wchar_t* user, const wchar_t* password, bool proxy) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!RequireStopped(connection)) return false;
        const std::wstring name = user ? user : L"";
        const std::wstring secret = password ? password : L"";
        if (ContainsNewline(name) || ContainsNewline(secret)) return ConnectionFail(connection, L"WebSocket 身份验证凭据不能包含换行。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        if (proxy) { connection->proxyUser = name; connection->proxyPassword = secret; }
        else { connection->serverUser = name; connection->serverPassword = secret; }
        return true;
    }

    bool SetTls(long long id, bool verify, bool allowSelfSigned, const wchar_t* sha256) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!RequireStopped(connection)) return false;
        std::wstring pin = NormalizeFingerprint(sha256 ? sha256 : L"");
        if (!pin.empty() && (pin.size() != 64 || !std::all_of(pin.begin(), pin.end(), [](wchar_t ch) { return std::iswxdigit(ch) != 0; }))) {
            return ConnectionFail(connection, L"WebSocket 证书 SHA-256 必须是 64 位十六进制文本，可包含冒号或空格。");
        }
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->verifyCertificate = verify; connection->allowSelfSigned = allowSelfSigned; connection->certificatePin = std::move(pin);
        return true;
    }

    bool SetReconnect(long long id, bool enabled, int maximumAttempts, int initialDelayMs, int maximumDelayMs) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!RequireStopped(connection)) return false;
        if (enabled && (maximumAttempts < 1 || maximumAttempts > 1000)) return ConnectionFail(connection, L"WebSocket 自动重连最大次数必须在 1 到 1000 之间。");
        if (initialDelayMs < 100 || initialDelayMs > 300000 || maximumDelayMs < initialDelayMs || maximumDelayMs > 3600000) return ConnectionFail(connection, L"WebSocket 重连延迟范围无效；初始延迟至少 100 毫秒，最大延迟不得小于初始延迟。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->autoReconnect = enabled; connection->maximumReconnectAttempts = maximumAttempts;
        connection->initialReconnectDelayMs = initialDelayMs; connection->maximumReconnectDelayMs = maximumDelayMs;
        return true;
    }

    bool BindHandler(long long id, int kind, const wchar_t* handler) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty() || ContainsNewline(value)) return ConnectionFail(connection, L"WebSocket 事件处理器不能为空或包含换行。");
        if (kind < 1 || kind > 5) return ConnectionFail(connection, L"WebSocket 事件处理器类型无效。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        if (kind == 1) connection->connectedHandler = value;
        else if (kind == 2) connection->messageHandler = value;
        else if (kind == 3) connection->disconnectedHandler = value;
        else if (kind == 4) connection->errorHandler = value;
        else connection->reconnectHandler = value;
        return true;
    }

    bool Start(long long id) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        bool configured = false;
        { std::lock_guard<std::mutex> lock(connection->mutex); configured = !connection->url.empty(); }
        if (!configured) return ConnectionFail(connection, L"WebSocket 连接尚未配置地址。");
        if (connection->workerRunning.exchange(true)) return ConnectionFail(connection, L"WebSocket 连接已经启动。");
        if (connection->worker.joinable()) connection->worker.join();
        connection->stopRequested.store(false); connection->manualClose.store(false); connection->connected.store(false);
        connection->reconnectAttempts.store(0);
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"连接中"; connection->lastError.clear(); }
        try {
            connection->worker = std::thread([this, connection]() { WorkerLoop(connection); });
        } catch (...) {
            connection->workerRunning.store(false);
            return ConnectionFail(connection, L"WebSocket 无法创建后台连接线程。");
        }
        return true;
    }

    bool WaitConnected(long long id, int timeoutMs) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (timeoutMs < 0 || timeoutMs > 3600000) return ConnectionFail(connection, L"WebSocket 等待超时必须在 0 到 3600000 毫秒之间。");
        std::unique_lock<std::mutex> lock(connection->mutex);
        connection->stateChanged.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&]() {
            return connection->connected.load() || !connection->workerRunning.load() || connection->state == L"错误";
        });
        return connection->connected.load();
    }

    bool Close(long long id, int code, const wchar_t* reason) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        const std::wstring closeReason = reason ? reason : L"";
        std::string reasonBytes;
        if (!ValidCloseCode(code) || !WideToUtf8(closeReason, reasonBytes) || reasonBytes.size() > 123) return ConnectionFail(connection, L"WebSocket 关闭状态码无效，或 UTF-8 原因超过 123 字节。");
        connection->manualClose.store(true); connection->stopRequested.store(true);
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"关闭中"; }
        HINTERNET socket = nullptr;
        { std::lock_guard<std::mutex> lock(connection->handlesMutex); socket = connection->socket; }
        if (socket) WinHttpWebSocketClose(socket, static_cast<USHORT>(code), reasonBytes.empty() ? nullptr : reasonBytes.data(), static_cast<DWORD>(reasonBytes.size()));
        CloseHandles(connection);
        connection->controlChanged.notify_all(); connection->legacyChanged.notify_all();
        JoinWorker(connection);
        connection->connected.store(false);
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"已停止"; }
        return true;
    }

    bool ForceDisconnect(long long id) {
        auto connection = Find(id);
        if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        connection->manualClose.store(true); connection->stopRequested.store(true);
        CloseHandles(connection); connection->controlChanged.notify_all(); connection->legacyChanged.notify_all(); JoinWorker(connection);
        connection->connected.store(false);
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"已停止"; }
        return true;
    }

    bool Destroy(long long id) {
        std::shared_ptr<Connection> connection;
        { std::lock_guard<std::mutex> lock(connectionsMutex_); auto found = connections_.find(id); if (found == connections_.end()) return false; connection = found->second; connections_.erase(found); }
        connection->manualClose.store(true); connection->stopRequested.store(true); CloseHandles(connection);
        connection->controlChanged.notify_all(); connection->legacyChanged.notify_all(); JoinWorker(connection);
        ClearSensitiveState(connection);
        if (legacyConnectionId_ == id) legacyConnectionId_ = 0;
        return true;
    }

    bool SendText(long long id, const wchar_t* text) {
        std::string payload;
        if (!WideToUtf8(text ? text : L"", payload)) return Fail(L"WebSocket 文本包含无效 UTF-16，无法转换为 UTF-8。");
        return Send(id, WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE, reinterpret_cast<const unsigned char*>(payload.data()), payload.size());
    }

    bool SendBinary(long long id, const std::vector<unsigned char>& data) { return Send(id, WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE, data.data(), data.size()); }

    bool IsConnected(long long id) const { auto connection = Find(id); return connection && connection->connected.load(); }
    std::wstring State(long long id) const { auto connection = Find(id); if (!connection) return L"无效连接"; std::lock_guard<std::mutex> lock(connection->mutex); return connection->state; }
    std::wstring Url(long long id) const { return TextProperty(id, 1); }
    std::wstring Protocol(long long id) const { return TextProperty(id, 2); }
    std::wstring ResponseHeaders(long long id) const { return TextProperty(id, 3); }
    std::wstring Error(long long id) const { auto connection = Find(id); if (!connection) { std::lock_guard<std::mutex> lock(errorMutex_); return lastError_; } std::lock_guard<std::mutex> lock(connection->mutex); return connection->lastError; }
    int StatusCode(long long id) const { auto connection = Find(id); if (!connection) return 0; std::lock_guard<std::mutex> lock(connection->mutex); return connection->handshakeStatus; }
    long long ConnectedMilliseconds(long long id) const { auto connection = Find(id); if (!connection || !connection->connected.load()) return 0; std::lock_guard<std::mutex> lock(connection->mutex); return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - connection->connectedAt).count(); }
    long long SentBytes(long long id) const { auto connection = Find(id); return connection ? connection->sentBytes.load() : 0; }
    long long ReceivedBytes(long long id) const { auto connection = Find(id); return connection ? connection->receivedBytes.load() : 0; }
    long long SentMessages(long long id) const { auto connection = Find(id); return connection ? connection->sentMessages.load() : 0; }
    long long ReceivedMessages(long long id) const { auto connection = Find(id); return connection ? connection->receivedMessages.load() : 0; }
    int ReconnectAttempts(long long id) const { auto connection = Find(id); return connection ? connection->reconnectAttempts.load() : 0; }

    void DispatchEvent(long long eventId, const DispatchHandler& dispatch) {
        std::shared_ptr<Event> event;
        { std::lock_guard<std::mutex> lock(eventsMutex_); auto found = events_.find(eventId); if (found == events_.end()) return; event = found->second; events_.erase(found); currentEvent_ = event; }
        if (dispatch && !event->handler.empty()) dispatch(event->handler.c_str());
        { std::lock_guard<std::mutex> lock(eventsMutex_); if (currentEvent_ == event) currentEvent_.reset(); }
    }

    std::wstring CurrentType() const { auto event = CurrentEvent(); return event ? event->type : L""; }
    long long CurrentConnection() const { auto event = CurrentEvent(); return event ? event->connectionId : 0; }
    std::wstring CurrentMessageType() const { auto event = CurrentEvent(); return event ? event->messageType : L""; }
    std::wstring CurrentText() const { auto event = CurrentEvent(); return event ? event->text : L""; }
    std::vector<unsigned char> CurrentBinary() const { auto event = CurrentEvent(); return event ? event->binary : std::vector<unsigned char>{}; }
    int CurrentCloseCode() const { auto event = CurrentEvent(); return event ? event->closeCode : 0; }
    std::wstring CurrentCloseReason() const { auto event = CurrentEvent(); return event ? event->closeReason : L""; }
    std::wstring CurrentError() const { auto event = CurrentEvent(); return event ? event->error : L""; }
    int CurrentReconnectAttempt() const { auto event = CurrentEvent(); return event ? event->reconnectAttempt : 0; }

    int LegacyConnect(const wchar_t* url) {
        LegacyClose(); const long long id = Create(); legacyConnectionId_ = id;
        if (!Configure(id, url) || !Start(id) || !WaitConnected(id, 30000)) { Destroy(id); legacyConnectionId_ = 0; return 0; }
        return 1;
    }
    int LegacySendText(const wchar_t* text) { return legacyConnectionId_ && SendText(legacyConnectionId_, text) ? 1 : 0; }
    std::wstring LegacyReceiveText(int timeoutMs) {
        auto connection = Find(legacyConnectionId_); if (!connection) return L"";
        std::unique_lock<std::mutex> lock(connection->legacyMutex);
        connection->legacyChanged.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&]() { return !connection->legacyTexts.empty() || !connection->workerRunning.load(); });
        if (connection->legacyTexts.empty()) return L"";
        std::wstring value = std::move(connection->legacyTexts.front()); connection->legacyTexts.pop_front(); return value;
    }
    void LegacyClose() { const long long id = legacyConnectionId_; legacyConnectionId_ = 0; if (id) Destroy(id); }

    void Shutdown() {
        std::vector<std::shared_ptr<Connection>> values;
        { std::lock_guard<std::mutex> lock(connectionsMutex_); for (const auto& pair : connections_) values.push_back(pair.second); connections_.clear(); legacyConnectionId_ = 0; }
        for (const auto& connection : values) { connection->manualClose.store(true); connection->stopRequested.store(true); CloseHandles(connection); connection->controlChanged.notify_all(); connection->legacyChanged.notify_all(); }
        for (const auto& connection : values) { JoinWorker(connection); ClearSensitiveState(connection); }
        std::lock_guard<std::mutex> lock(eventsMutex_); events_.clear(); currentEvent_.reset();
    }

private:
    struct Event {
        long long id = 0; long long connectionId = 0; std::wstring handler; std::wstring type; std::wstring messageType; std::wstring text;
        std::vector<unsigned char> binary; int closeCode = 0; std::wstring closeReason; std::wstring error; int reconnectAttempt = 0;
    };

    struct Connection {
        long long id = 0;
        mutable std::mutex mutex; mutable std::mutex handlesMutex; std::mutex sendMutex; std::mutex controlMutex;
        std::condition_variable stateChanged; std::condition_variable controlChanged; std::thread worker;
        std::atomic<bool> workerRunning{false}; std::atomic<bool> stopRequested{false}; std::atomic<bool> manualClose{false}; std::atomic<bool> connected{false};
        std::wstring url; std::wstring userAgent = L"LingBuilder WebSocket Client/2.0"; std::wstring headers; std::wstring origin; std::wstring protocols;
        int proxyMode = 0; std::wstring proxy; std::wstring proxyBypass; std::wstring serverUser; std::wstring serverPassword; std::wstring proxyUser; std::wstring proxyPassword;
        bool verifyCertificate = true; bool allowSelfSigned = false; std::wstring certificatePin;
        int connectTimeoutMs = 15000; int receiveTimeoutMs = 60000; size_t maxMessageBytes = 16 * 1024 * 1024; size_t maxSendBytes = 8 * 1024 * 1024;
        bool autoReconnect = false; int maximumReconnectAttempts = 8; int initialReconnectDelayMs = 500; int maximumReconnectDelayMs = 30000;
        std::wstring connectedHandler; std::wstring messageHandler; std::wstring disconnectedHandler; std::wstring errorHandler; std::wstring reconnectHandler;
        std::wstring state = L"未配置"; std::wstring lastError; std::wstring selectedProtocol; std::wstring responseHeaders; int handshakeStatus = 0;
        std::chrono::steady_clock::time_point connectedAt{};
        HINTERNET session = nullptr; HINTERNET connect = nullptr; HINTERNET request = nullptr; HINTERNET socket = nullptr;
        std::atomic<long long> sentBytes{0}; std::atomic<long long> receivedBytes{0}; std::atomic<long long> sentMessages{0}; std::atomic<long long> receivedMessages{0}; std::atomic<int> reconnectAttempts{0};
        std::mutex legacyMutex; std::condition_variable legacyChanged; std::deque<std::wstring> legacyTexts;
    };

    struct Config {
        std::wstring url, userAgent, headers, origin, protocols, proxy, proxyBypass, serverUser, serverPassword, proxyUser, proxyPassword, certificatePin;
        int proxyMode = 0, connectTimeoutMs = 15000, receiveTimeoutMs = 60000;
        size_t maxMessageBytes = 0; bool verifyCertificate = true, allowSelfSigned = false;
    };

    std::shared_ptr<Connection> Find(long long id) const {
        std::lock_guard<std::mutex> lock(connectionsMutex_); auto found = connections_.find(id); return found == connections_.end() ? nullptr : found->second;
    }
    std::shared_ptr<Event> CurrentEvent() const { std::lock_guard<std::mutex> lock(eventsMutex_); return currentEvent_; }
    bool RequireStopped(const std::shared_ptr<Connection>& connection) {
        if (connection->workerRunning.load() || connection->connected.load()) return ConnectionFail(connection, L"WebSocket 连接正在运行，不能修改此配置。");
        return true;
    }
    bool SetSafeText(long long id, const wchar_t* value, int kind) {
        auto connection = Find(id); if (!connection) return Fail(L"WebSocket 连接 ID 无效。"); if (!RequireStopped(connection)) return false;
        const std::wstring text = value ? value : L"";
        if (kind != 2 && ContainsNewline(text)) return ConnectionFail(connection, L"WebSocket 配置值不能包含换行。");
        if (kind == 2 && !ValidateHeaders(text)) return ConnectionFail(connection, L"WebSocket 请求头必须每行使用“名称: 值”，且不能覆盖 Upgrade、Connection、Host、Sec-WebSocket-Key 或 Sec-WebSocket-Version。");
        if (kind == 4 && !ValidateProtocols(text)) return ConnectionFail(connection, L"WebSocket 子协议列表包含非法 token。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        if (kind == 1) connection->userAgent = text.empty() ? L"LingBuilder WebSocket Client/2.0" : text;
        else if (kind == 2) connection->headers = text;
        else if (kind == 3) connection->origin = text;
        else connection->protocols = text;
        return true;
    }

    void WorkerLoop(const std::shared_ptr<Connection>& connection) {
        int attempt = 0;
        while (!connection->stopRequested.load()) {
            const bool opened = ConnectOnce(connection);
            const bool closeEventReceived = opened ? ReceiveLoop(connection) : false;
            if (opened && !closeEventReceived) {
                Emit(connection, L"已断开", L"", L"", {}, connection->manualClose.load() ? 1000 : 1006,
                    connection->manualClose.load() ? L"客户端主动关闭" : L"连接异常中断", L"", connection->reconnectAttempts.load());
            }
            CloseHandles(connection); connection->connected.store(false); connection->stateChanged.notify_all(); connection->legacyChanged.notify_all();
            if (connection->stopRequested.load() || connection->manualClose.load()) break;
            bool reconnect = false; int maximum = 0; int initial = 0; int limit = 0;
            { std::lock_guard<std::mutex> lock(connection->mutex); reconnect = connection->autoReconnect; maximum = connection->maximumReconnectAttempts; initial = connection->initialReconnectDelayMs; limit = connection->maximumReconnectDelayMs; }
            if (!reconnect || attempt >= maximum) break;
            ++attempt; connection->reconnectAttempts.store(attempt);
            const long long multiplier = 1LL << std::min(attempt - 1, 20);
            const int delay = static_cast<int>(std::min<long long>(limit, static_cast<long long>(initial) * multiplier));
            { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"重连等待"; }
            Emit(connection, L"重连", L"", L"", {}, 0, L"", L"", attempt);
            std::unique_lock<std::mutex> lock(connection->controlMutex);
            connection->controlChanged.wait_for(lock, std::chrono::milliseconds(delay), [&]() { return connection->stopRequested.load(); });
            if (!connection->stopRequested.load()) { std::lock_guard<std::mutex> stateLock(connection->mutex); connection->state = L"连接中"; }
        }
        connection->connected.store(false); connection->workerRunning.store(false);
        { std::lock_guard<std::mutex> lock(connection->mutex); if (connection->manualClose.load()) connection->state = L"已停止"; else if (connection->state != L"错误") connection->state = L"错误"; }
        connection->stateChanged.notify_all(); connection->legacyChanged.notify_all();
    }

    bool ConnectOnce(const std::shared_ptr<Connection>& connection) {
        Config config;
        { std::lock_guard<std::mutex> lock(connection->mutex); config = Snapshot(*connection); connection->state = L"连接中"; connection->handshakeStatus = 0; connection->selectedProtocol.clear(); connection->responseHeaders.clear(); }
        std::wstring normalized = config.url;
        if (normalized.rfind(L"ws://", 0) == 0) normalized.replace(0, 5, L"http://");
        else if (normalized.rfind(L"wss://", 0) == 0) normalized.replace(0, 6, L"https://");
        URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts); parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1); parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(normalized.c_str(), 0, 0, &parts)) return NetworkFail(connection, L"WebSocket 无法解析连接地址。", GetLastError());
        const bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
        std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/";
        if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);

        DWORD accessType = config.proxyMode == 1 ? WINHTTP_ACCESS_TYPE_NO_PROXY : config.proxyMode == 2 ? WINHTTP_ACCESS_TYPE_NAMED_PROXY : WINHTTP_ACCESS_TYPE_DEFAULT_PROXY;
        HINTERNET session = WinHttpOpen(config.userAgent.c_str(), accessType,
            config.proxyMode == 2 ? config.proxy.c_str() : WINHTTP_NO_PROXY_NAME,
            config.proxyMode == 2 && !config.proxyBypass.empty() ? config.proxyBypass.c_str() : WINHTTP_NO_PROXY_BYPASS, 0);
        if (!session) return NetworkFail(connection, L"WebSocket 无法创建 WinHTTP 会话。", GetLastError());
        PublishHandle(connection, 1, session);
        WinHttpSetTimeouts(session, config.connectTimeoutMs, config.connectTimeoutMs, config.connectTimeoutMs, config.receiveTimeoutMs);
        HINTERNET connect = WinHttpConnect(session, host.c_str(), parts.nPort, 0);
        if (!connect) return NetworkFail(connection, L"WebSocket 无法连接目标主机。", GetLastError());
        PublishHandle(connection, 2, connect);
        HINTERNET request = WinHttpOpenRequest(connect, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, secure ? WINHTTP_FLAG_SECURE : 0);
        if (!request) return NetworkFail(connection, L"WebSocket 无法创建握手请求。", GetLastError());
        PublishHandle(connection, 3, request);
        if (!WinHttpSetOption(request, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0)) return NetworkFail(connection, L"WebSocket 无法启用协议升级。", GetLastError());
        if (secure && (!config.verifyCertificate || config.allowSelfSigned)) {
            DWORD securityFlags = config.allowSelfSigned ? SECURITY_FLAG_IGNORE_UNKNOWN_CA : 0;
            if (!config.verifyCertificate) securityFlags |= SECURITY_FLAG_IGNORE_CERT_CN_INVALID | SECURITY_FLAG_IGNORE_CERT_DATE_INVALID | SECURITY_FLAG_IGNORE_CERT_WRONG_USAGE | SECURITY_FLAG_IGNORE_UNKNOWN_CA;
            if (!WinHttpSetOption(request, WINHTTP_OPTION_SECURITY_FLAGS, &securityFlags, sizeof(securityFlags))) return NetworkFail(connection, L"WebSocket 无法应用 TLS 验证策略。", GetLastError());
        }
        if (!config.serverUser.empty() && !WinHttpSetCredentials(request, WINHTTP_AUTH_TARGET_SERVER, WINHTTP_AUTH_SCHEME_BASIC, config.serverUser.c_str(), config.serverPassword.c_str(), nullptr)) return NetworkFail(connection, L"WebSocket 无法设置服务器 Basic 凭据。", GetLastError());
        if (!config.proxyUser.empty() && !WinHttpSetCredentials(request, WINHTTP_AUTH_TARGET_PROXY, WINHTTP_AUTH_SCHEME_BASIC, config.proxyUser.c_str(), config.proxyPassword.c_str(), nullptr)) return NetworkFail(connection, L"WebSocket 无法设置代理 Basic 凭据。", GetLastError());
        if (!config.headers.empty() && !WinHttpAddRequestHeaders(request, config.headers.c_str(), static_cast<DWORD>(-1), WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE)) return NetworkFail(connection, L"WebSocket 无法添加自定义请求头。", GetLastError());
        if (!config.origin.empty() && !AddHeader(request, L"Origin", config.origin)) return NetworkFail(connection, L"WebSocket 无法设置 Origin。", GetLastError());
        if (!config.protocols.empty() && !AddHeader(request, L"Sec-WebSocket-Protocol", config.protocols)) return NetworkFail(connection, L"WebSocket 无法设置子协议。", GetLastError());
        if (!WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0)) return NetworkFail(connection, L"WebSocket 发送握手请求失败。", GetLastError());
        if (!WinHttpReceiveResponse(request, nullptr)) return NetworkFail(connection, L"WebSocket 接收握手响应失败。", GetLastError());

        DWORD status = 0, statusSize = sizeof(status);
        WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
        const std::wstring responseHeaders = QueryHeader(request, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX);
        const std::wstring selectedProtocol = QueryHeader(request, WINHTTP_QUERY_CUSTOM, L"Sec-WebSocket-Protocol");
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->handshakeStatus = static_cast<int>(status); connection->responseHeaders = responseHeaders; connection->selectedProtocol = selectedProtocol; }
        if (status != 101) return ConnectionFailWithEvent(connection, L"WebSocket 握手失败，HTTP 状态码：" + std::to_wstring(status));
        if (!selectedProtocol.empty() && !ProtocolListed(config.protocols, selectedProtocol)) return ConnectionFailWithEvent(connection, L"WebSocket 服务端返回了客户端未请求的子协议。");
        if (secure && !config.certificatePin.empty() && !VerifyCertificatePin(request, config.certificatePin)) return ConnectionFailWithEvent(connection, L"WebSocket TLS 证书 SHA-256 固定值不匹配。");

        HINTERNET socket = WinHttpWebSocketCompleteUpgrade(request, 0);
        if (!socket) return NetworkFail(connection, L"WebSocket 完成协议升级失败。", GetLastError());
        { std::lock_guard<std::mutex> lock(connection->handlesMutex); if (connection->request) WinHttpCloseHandle(connection->request); connection->request = nullptr; connection->socket = socket; }
        connection->connected.store(true);
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"已连接"; connection->lastError.clear(); connection->connectedAt = std::chrono::steady_clock::now(); }
        connection->stateChanged.notify_all();
        Emit(connection, L"已连接", L"", L"", {}, 0, L"", L"", connection->reconnectAttempts.load());
        return true;
    }

    bool ReceiveLoop(const std::shared_ptr<Connection>& connection) {
        std::vector<unsigned char> payload; bool textMessage = false; bool messageStarted = false;
        while (!connection->stopRequested.load() && connection->connected.load()) {
            unsigned char buffer[8192] = {}; DWORD read = 0; WINHTTP_WEB_SOCKET_BUFFER_TYPE type = WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE;
            HINTERNET socket = nullptr; { std::lock_guard<std::mutex> lock(connection->handlesMutex); socket = connection->socket; }
            if (!socket) break;
            const DWORD result = WinHttpWebSocketReceive(socket, buffer, sizeof(buffer), &read, &type);
            if (result != ERROR_SUCCESS) {
                if (!connection->stopRequested.load()) NetworkFail(connection, result == ERROR_WINHTTP_TIMEOUT ? L"WebSocket 接收超时。" : L"WebSocket 接收失败。", result);
                break;
            }
            if (type == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) {
                USHORT code = 1000; unsigned char reason[124] = {}; DWORD reasonLength = 0;
                if (WinHttpWebSocketQueryCloseStatus(socket, &code, reason, sizeof(reason), &reasonLength) != ERROR_SUCCESS) { code = 1006; reasonLength = 0; }
                const std::wstring closeReason = Utf8ToWide(reason, reasonLength);
                Emit(connection, L"已断开", L"", L"", {}, code, closeReason, L"", connection->reconnectAttempts.load());
                connection->connected.store(false); return true;
            }
            const bool fragment = type == WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE || type == WINHTTP_WEB_SOCKET_BINARY_FRAGMENT_BUFFER_TYPE;
            const bool text = type == WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE || type == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE;
            if (!messageStarted) { textMessage = text; messageStarted = true; }
            else if (textMessage != text) { ConnectionFailWithEvent(connection, L"WebSocket 收到跨类型分片消息。"); break; }
            if (payload.size() + read > MaxMessageBytes(connection)) { ConnectionFailWithEvent(connection, L"WebSocket 接收消息超过配置上限。"); break; }
            payload.insert(payload.end(), buffer, buffer + read);
            if (fragment) continue;
            connection->receivedBytes.fetch_add(static_cast<long long>(payload.size())); connection->receivedMessages.fetch_add(1);
            if (textMessage) {
                const std::wstring textValue = Utf8ToWide(payload.data(), payload.size());
                if (!payload.empty() && textValue.empty()) { ConnectionFailWithEvent(connection, L"WebSocket 收到无效 UTF-8 文本消息。"); break; }
                { std::lock_guard<std::mutex> lock(connection->legacyMutex); if (connection->legacyTexts.size() >= 1024) connection->legacyTexts.pop_front(); connection->legacyTexts.push_back(textValue); }
                connection->legacyChanged.notify_all();
                Emit(connection, L"文本", L"文本", textValue, {}, 0, L"", L"", connection->reconnectAttempts.load());
            } else Emit(connection, L"二进制", L"二进制", L"", payload, 0, L"", L"", connection->reconnectAttempts.load());
            payload.clear(); messageStarted = false;
        }
        connection->connected.store(false);
        return false;
    }

    bool Send(long long id, WINHTTP_WEB_SOCKET_BUFFER_TYPE type, const unsigned char* data, size_t size) {
        auto connection = Find(id); if (!connection) return Fail(L"WebSocket 连接 ID 无效。");
        if (!connection->connected.load()) return ConnectionFail(connection, L"WebSocket 尚未连接，无法发送消息。");
        size_t maximum = 0; { std::lock_guard<std::mutex> lock(connection->mutex); maximum = connection->maxSendBytes; }
        if (size > maximum || size > MAXDWORD) return ConnectionFail(connection, L"WebSocket 发送消息超过配置上限。");
        std::lock_guard<std::mutex> sendLock(connection->sendMutex);
        HINTERNET socket = nullptr; { std::lock_guard<std::mutex> lock(connection->handlesMutex); socket = connection->socket; }
        if (!socket) return ConnectionFail(connection, L"WebSocket 底层连接已经关闭。");
        const DWORD result = WinHttpWebSocketSend(socket, type, size ? const_cast<unsigned char*>(data) : nullptr, static_cast<DWORD>(size));
        if (result != ERROR_SUCCESS) return NetworkFail(connection, L"WebSocket 发送消息失败。", result);
        connection->sentBytes.fetch_add(static_cast<long long>(size)); connection->sentMessages.fetch_add(1); return true;
    }

    void Emit(const std::shared_ptr<Connection>& connection, const std::wstring& type, const std::wstring& messageType,
        const std::wstring& text, const std::vector<unsigned char>& binary, int closeCode, const std::wstring& closeReason,
        const std::wstring& error, int reconnectAttempt) {
        std::wstring handler;
        { std::lock_guard<std::mutex> lock(connection->mutex); handler = type == L"已连接" ? connection->connectedHandler : (type == L"文本" || type == L"二进制") ? connection->messageHandler : type == L"已断开" ? connection->disconnectedHandler : type == L"重连" ? connection->reconnectHandler : connection->errorHandler; }
        if (handler.empty()) return;
        auto event = std::make_shared<Event>(); event->id = nextEventId_.fetch_add(1); event->connectionId = connection->id; event->handler = handler; event->type = type;
        event->messageType = messageType; event->text = text; event->binary = binary; event->closeCode = closeCode; event->closeReason = closeReason; event->error = error; event->reconnectAttempt = reconnectAttempt;
        { std::lock_guard<std::mutex> lock(eventsMutex_); if (events_.size() >= 65536) events_.erase(events_.begin()); events_[event->id] = event; }
        if (!notify_ || !notify_(event->id)) { std::lock_guard<std::mutex> lock(eventsMutex_); events_.erase(event->id); }
    }

    bool Fail(const std::wstring& message) { std::lock_guard<std::mutex> lock(errorMutex_); lastError_ = message; return false; }
    bool ConnectionFail(const std::shared_ptr<Connection>& connection, const std::wstring& message) { std::lock_guard<std::mutex> lock(connection->mutex); connection->lastError = message; return false; }
    bool ConnectionFailWithEvent(const std::shared_ptr<Connection>& connection, const std::wstring& message) {
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->lastError = message; connection->state = L"错误"; }
        connection->stateChanged.notify_all(); Emit(connection, L"错误", L"", L"", {}, 0, L"", message, connection->reconnectAttempts.load()); return false;
    }
    bool NetworkFail(const std::shared_ptr<Connection>& connection, const std::wstring& prefix, DWORD code) {
        if (connection->stopRequested.load()) return false;
        return ConnectionFailWithEvent(connection, prefix + L" 错误码：" + std::to_wstring(code));
    }

    static Config Snapshot(const Connection& connection) {
        Config value; value.url = connection.url; value.userAgent = connection.userAgent; value.headers = connection.headers; value.origin = connection.origin; value.protocols = connection.protocols;
        value.proxyMode = connection.proxyMode; value.proxy = connection.proxy; value.proxyBypass = connection.proxyBypass; value.serverUser = connection.serverUser; value.serverPassword = connection.serverPassword;
        value.proxyUser = connection.proxyUser; value.proxyPassword = connection.proxyPassword; value.verifyCertificate = connection.verifyCertificate; value.allowSelfSigned = connection.allowSelfSigned;
        value.certificatePin = connection.certificatePin; value.connectTimeoutMs = connection.connectTimeoutMs; value.receiveTimeoutMs = connection.receiveTimeoutMs; value.maxMessageBytes = connection.maxMessageBytes; return value;
    }
    static void PublishHandle(const std::shared_ptr<Connection>& connection, int kind, HINTERNET handle) { std::lock_guard<std::mutex> lock(connection->handlesMutex); if (kind == 1) connection->session = handle; else if (kind == 2) connection->connect = handle; else connection->request = handle; }
    static void CloseHandles(const std::shared_ptr<Connection>& connection) {
        std::lock_guard<std::mutex> lock(connection->handlesMutex);
        if (connection->socket) { WinHttpCloseHandle(connection->socket); connection->socket = nullptr; }
        if (connection->request) { WinHttpCloseHandle(connection->request); connection->request = nullptr; }
        if (connection->connect) { WinHttpCloseHandle(connection->connect); connection->connect = nullptr; }
        if (connection->session) { WinHttpCloseHandle(connection->session); connection->session = nullptr; }
    }
    static void JoinWorker(const std::shared_ptr<Connection>& connection) { if (connection->worker.joinable() && connection->worker.get_id() != std::this_thread::get_id()) connection->worker.join(); }
    static void ClearSensitiveState(const std::shared_ptr<Connection>& connection) {
        std::lock_guard<std::mutex> lock(connection->mutex);
        auto clear = [](std::wstring& value) { if (!value.empty()) SecureZeroMemory(value.data(), value.size() * sizeof(wchar_t)); value.clear(); };
        clear(connection->serverPassword); clear(connection->proxyPassword); clear(connection->headers); clear(connection->responseHeaders);
    }
    static size_t MaxMessageBytes(const std::shared_ptr<Connection>& connection) { std::lock_guard<std::mutex> lock(connection->mutex); return connection->maxMessageBytes; }
    std::wstring TextProperty(long long id, int kind) const { auto connection = Find(id); if (!connection) return L""; std::lock_guard<std::mutex> lock(connection->mutex); return kind == 1 ? connection->url : kind == 2 ? connection->selectedProtocol : connection->responseHeaders; }

    static bool IsWebSocketUrl(const std::wstring& value) { return value.size() > 5 && (value.rfind(L"ws://", 0) == 0 || value.rfind(L"wss://", 0) == 0) && !ContainsNewline(value); }
    static bool ContainsNewline(const std::wstring& value) { return value.find_first_of(L"\r\n") != std::wstring::npos; }
    static bool ValidCloseCode(int code) { return code >= 1000 && code < 5000 && code != 1004 && code != 1005 && code != 1006 && code != 1015 && !(code >= 1016 && code <= 2999); }
    static bool ValidToken(const std::wstring& value) { if (value.empty()) return false; for (wchar_t ch : value) if (!(std::iswalnum(ch) || ch == 0x60 || std::wcschr(L"!#$%&'*+-.^_|~", ch))) return false; return true; }
    static std::vector<std::wstring> SplitList(const std::wstring& value) {
        std::vector<std::wstring> result; size_t start = 0;
        while (start <= value.size()) { size_t end = value.find(L',', start); if (end == std::wstring::npos) end = value.size(); std::wstring item = value.substr(start, end - start); Trim(item); if (!item.empty()) result.push_back(item); if (end == value.size()) break; start = end + 1; }
        return result;
    }
    static bool ValidateProtocols(const std::wstring& value) { const auto items = SplitList(value); if (value.empty()) return true; if (items.empty()) return false; std::set<std::wstring> unique; for (const auto& item : items) if (!ValidToken(item) || !unique.insert(item).second) return false; return true; }
    static bool ProtocolListed(const std::wstring& requested, std::wstring selected) { Trim(selected); const auto items = SplitList(requested); return std::find(items.begin(), items.end(), selected) != items.end(); }
    static bool ValidateHeaders(const std::wstring& value) {
        if (value.empty()) return true; size_t start = 0;
        while (start <= value.size()) { size_t end = value.find(L'\n', start); if (end == std::wstring::npos) end = value.size(); std::wstring line = value.substr(start, end - start); if (!line.empty() && line.back() == L'\r') line.pop_back(); if (line.empty()) return false;
            const size_t separator = line.find(L':'); if (separator == std::wstring::npos) return false; std::wstring name = line.substr(0, separator); Trim(name); if (!ValidToken(name)) return false;
            std::transform(name.begin(), name.end(), name.begin(), [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); });
            if (name == L"upgrade" || name == L"connection" || name == L"host" || name == L"sec-websocket-key" || name == L"sec-websocket-version" || name == L"sec-websocket-extensions" || name == L"sec-websocket-protocol" || name == L"origin") return false;
            if (line.find(L'\0') != std::wstring::npos) return false; if (end == value.size()) break; start = end + 1;
        }
        return true;
    }
    static void Trim(std::wstring& value) { const wchar_t* whitespace = L" \t\r\n"; const size_t first = value.find_first_not_of(whitespace); const size_t last = value.find_last_not_of(whitespace); value = first == std::wstring::npos ? std::wstring() : value.substr(first, last - first + 1); }
    static std::wstring NormalizeFingerprint(std::wstring value) { value.erase(std::remove_if(value.begin(), value.end(), [](wchar_t ch) { return ch == L':' || std::iswspace(ch); }), value.end()); std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(std::towupper(ch)); }); return value; }
    static bool AddHeader(HINTERNET request, const wchar_t* name, const std::wstring& value) { const std::wstring header = std::wstring(name) + L": " + value; return WinHttpAddRequestHeaders(request, header.c_str(), static_cast<DWORD>(-1), WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE) != FALSE; }
    static std::wstring QueryHeader(HINTERNET request, DWORD query, const wchar_t* name) {
        DWORD size = 0; WinHttpQueryHeaders(request, query, name, nullptr, &size, WINHTTP_NO_HEADER_INDEX); if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || size < sizeof(wchar_t)) return L"";
        std::vector<wchar_t> buffer(size / sizeof(wchar_t) + 1, L'\0'); if (!WinHttpQueryHeaders(request, query, name, buffer.data(), &size, WINHTTP_NO_HEADER_INDEX)) return L""; return buffer.data();
    }
    static bool VerifyCertificatePin(HINTERNET request, const std::wstring& expected) {
        PCCERT_CONTEXT certificate = nullptr; DWORD size = sizeof(certificate);
        if (!WinHttpQueryOption(request, WINHTTP_OPTION_SERVER_CERT_CONTEXT, &certificate, &size) || !certificate) return false;
        unsigned char digest[32] = {}; DWORD digestSize = sizeof(digest);
        const BOOL ok = CryptHashCertificate2(BCRYPT_SHA256_ALGORITHM, 0, nullptr, certificate->pbCertEncoded, certificate->cbCertEncoded, digest, &digestSize);
        CertFreeCertificateContext(certificate); if (!ok || digestSize != sizeof(digest)) return false;
        static const wchar_t digits[] = L"0123456789ABCDEF"; std::wstring actual; actual.reserve(64);
        for (unsigned char byte : digest) { actual.push_back(digits[(byte >> 4) & 0x0f]); actual.push_back(digits[byte & 0x0f]); }
        return actual == expected;
    }
    static bool WideToUtf8(const std::wstring& value, std::string& output) {
        output.clear(); if (value.empty()) return true; const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr); if (length <= 0) return false;
        output.resize(static_cast<size_t>(length)); return WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), length, nullptr, nullptr) == length;
    }
    static std::wstring Utf8ToWide(const unsigned char* data, size_t size) {
        if (!data || size == 0) return L""; if (size > static_cast<size_t>(INT_MAX)) return L""; const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(data), static_cast<int>(size), nullptr, 0); if (length <= 0) return L"";
        std::wstring result(static_cast<size_t>(length), L'\0'); MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(data), static_cast<int>(size), result.data(), length); return result;
    }

    NotifyEvent notify_;
    mutable std::mutex connectionsMutex_; mutable std::mutex eventsMutex_; mutable std::mutex errorMutex_;
    std::unordered_map<long long, std::shared_ptr<Connection>> connections_; std::map<long long, std::shared_ptr<Event>> events_; std::shared_ptr<Event> currentEvent_; std::wstring lastError_;
    std::atomic<long long> nextConnectionId_{1}; std::atomic<long long> nextEventId_{1}; std::atomic<long long> legacyConnectionId_{0};
};
`;

const WEBSOCKET_CLIENT_WINDOW_METHODS = String.raw`
    long long WS_创建连接() { return wsClientRuntime_.Create(); }
    bool WS_配置连接(long long connection, const wchar_t* url) { return wsClientRuntime_.Configure(connection, url); }
    bool WS_设置资源限制(long long connection, int connectTimeoutMs, int receiveTimeoutMs, int messageMb, int sendMb) { return wsClientRuntime_.SetLimits(connection, connectTimeoutMs, receiveTimeoutMs, messageMb, sendMb); }
    bool WS_设置UserAgent(long long connection, const wchar_t* value) { return wsClientRuntime_.SetUserAgent(connection, value); }
    bool WS_设置请求头(long long connection, const wchar_t* value) { return wsClientRuntime_.SetHeaders(connection, value); }
    bool WS_设置Origin(long long connection, const wchar_t* value) { return wsClientRuntime_.SetOrigin(connection, value); }
    bool WS_设置子协议(long long connection, const wchar_t* value) { return wsClientRuntime_.SetProtocols(connection, value); }
    bool WS_设置代理(long long connection, int mode, const wchar_t* proxy, const wchar_t* bypass) { return wsClientRuntime_.SetProxy(connection, mode, proxy, bypass); }
    bool WS_设置服务器凭据(long long connection, const wchar_t* user, const wchar_t* password) { return wsClientRuntime_.SetCredentials(connection, user, password, false); }
    bool WS_设置代理凭据(long long connection, const wchar_t* user, const wchar_t* password) { return wsClientRuntime_.SetCredentials(connection, user, password, true); }
    bool WS_设置TLS验证(long long connection, bool verify, bool allowSelfSigned, const wchar_t* sha256) { return wsClientRuntime_.SetTls(connection, verify, allowSelfSigned, sha256); }
    bool WS_设置自动重连(long long connection, bool enabled, int maximumAttempts, int initialDelayMs, int maximumDelayMs) { return wsClientRuntime_.SetReconnect(connection, enabled, maximumAttempts, initialDelayMs, maximumDelayMs); }
    bool WS_绑定已连接处理器(long long connection, const wchar_t* handler) { return wsClientRuntime_.BindHandler(connection, 1, handler); }
    bool WS_绑定消息处理器(long long connection, const wchar_t* handler) { return wsClientRuntime_.BindHandler(connection, 2, handler); }
    bool WS_绑定已断开处理器(long long connection, const wchar_t* handler) { return wsClientRuntime_.BindHandler(connection, 3, handler); }
    bool WS_绑定错误处理器(long long connection, const wchar_t* handler) { return wsClientRuntime_.BindHandler(connection, 4, handler); }
    bool WS_绑定重连处理器(long long connection, const wchar_t* handler) { return wsClientRuntime_.BindHandler(connection, 5, handler); }
    bool WS_开始连接(long long connection) { return wsClientRuntime_.Start(connection); }
    bool WS_等待连接(long long connection, int timeoutMs) { return wsClientRuntime_.WaitConnected(connection, timeoutMs); }
    bool WS_关闭连接(long long connection, int code, const wchar_t* reason) { return wsClientRuntime_.Close(connection, code, reason); }
    bool WS_强制断开(long long connection) { return wsClientRuntime_.ForceDisconnect(connection); }
    bool WS_销毁连接(long long connection) { return wsClientRuntime_.Destroy(connection); }
    bool WS_是否已连接(long long connection) { return wsClientRuntime_.IsConnected(connection); }
    const wchar_t* WS_取连接状态(long long connection) { wsClientReturnText_ = wsClientRuntime_.State(connection); return wsClientReturnText_.c_str(); }
    const wchar_t* WS_取连接地址(long long connection) { wsClientReturnText_ = wsClientRuntime_.Url(connection); return wsClientReturnText_.c_str(); }
    const wchar_t* WS_取协商子协议(long long connection) { wsClientReturnText_ = wsClientRuntime_.Protocol(connection); return wsClientReturnText_.c_str(); }
    const wchar_t* WS_取握手响应头(long long connection) { wsClientReturnText_ = wsClientRuntime_.ResponseHeaders(connection); return wsClientReturnText_.c_str(); }
    int WS_取握手状态码(long long connection) { return wsClientRuntime_.StatusCode(connection); }
    const wchar_t* WS_取连接错误(long long connection) { wsClientReturnText_ = wsClientRuntime_.Error(connection); return wsClientReturnText_.c_str(); }
    long long WS_取连接时长(long long connection) { return wsClientRuntime_.ConnectedMilliseconds(connection); }
    long long WS_取发送字节数(long long connection) { return wsClientRuntime_.SentBytes(connection); }
    long long WS_取接收字节数(long long connection) { return wsClientRuntime_.ReceivedBytes(connection); }
    long long WS_取发送消息数(long long connection) { return wsClientRuntime_.SentMessages(connection); }
    long long WS_取接收消息数(long long connection) { return wsClientRuntime_.ReceivedMessages(connection); }
    int WS_取重连次数(long long connection) { return wsClientRuntime_.ReconnectAttempts(connection); }
    bool WS_发送文本到连接(long long connection, const wchar_t* text) { return wsClientRuntime_.SendText(connection, text); }
    bool WS_发送二进制到连接(long long connection, const std::vector<unsigned char>& data) { return wsClientRuntime_.SendBinary(connection, data); }
    const wchar_t* WS_取当前事件类型() { wsClientReturnText_ = wsClientRuntime_.CurrentType(); return wsClientReturnText_.c_str(); }
    long long WS_取当前连接() { return wsClientRuntime_.CurrentConnection(); }
    const wchar_t* WS_取当前消息类型() { wsClientReturnText_ = wsClientRuntime_.CurrentMessageType(); return wsClientReturnText_.c_str(); }
    const wchar_t* WS_取当前文本() { wsClientReturnText_ = wsClientRuntime_.CurrentText(); return wsClientReturnText_.c_str(); }
    std::vector<unsigned char> WS_取当前二进制() { return wsClientRuntime_.CurrentBinary(); }
    int WS_取当前关闭代码() { return wsClientRuntime_.CurrentCloseCode(); }
    const wchar_t* WS_取当前关闭原因() { wsClientReturnText_ = wsClientRuntime_.CurrentCloseReason(); return wsClientReturnText_.c_str(); }
    const wchar_t* WS_取当前错误() { wsClientReturnText_ = wsClientRuntime_.CurrentError(); return wsClientReturnText_.c_str(); }
    int WS_取当前重连次数() { return wsClientRuntime_.CurrentReconnectAttempt(); }
    int WS_连接(const wchar_t* url) { return wsClientRuntime_.LegacyConnect(url); }
    int WS_发送文本(const wchar_t* text) { return wsClientRuntime_.LegacySendText(text); }
    int WS_接收到调试输出() { const std::wstring text = wsClientRuntime_.LegacyReceiveText(30000); if (text.empty()) return 0; 调试输出(text.c_str()); return 1; }
    const wchar_t* WS_接收文本() { wsClientReturnText_ = wsClientRuntime_.LegacyReceiveText(30000); return wsClientReturnText_.c_str(); }
    void WS_关闭() { wsClientRuntime_.LegacyClose(); }
`;
