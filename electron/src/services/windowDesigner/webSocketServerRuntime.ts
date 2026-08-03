import { InstalledModule } from '../modules/types';

export const WEBSOCKET_SERVER_MODULE_ID = 'lingbuilder.websocket.server';

export function generateWebSocketServerRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_SERVER_MODULE_ID)) return '';
  return WEBSOCKET_SERVER_RUNTIME;
}

export function generateWebSocketServerWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_SERVER_MODULE_ID)) return '';
  return WEBSOCKET_SERVER_WINDOW_METHODS;
}

export function generateWebSocketServerGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_SERVER_MODULE_ID)) return '';
  return WEBSOCKET_SERVER_WINDOW_METHODS
    .replaceAll('wssRuntime_', 'g_wssRuntime')
    .replaceAll('wssReturnText_', 'g_wssReturnText')
    .replace(/^    /gmu, 'static ');
}

export function generateWebSocketServerGlobalMethodDeclarations(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === WEBSOCKET_SERVER_MODULE_ID)) return '';
  return WEBSOCKET_SERVER_WINDOW_METHODS
    .trim()
    .split(/\r?\n/u)
    .map(line => {
      const normalized = line.trim();
      const signatureEnd = normalized.indexOf(' {');
      if (signatureEnd < 0) throw new Error(`WebSocket 服务端包装方法缺少函数体：${normalized}`);
      return `static ${normalized.slice(0, signatureEnd)};`;
    })
    .join('\n');
}

const WEBSOCKET_SERVER_RUNTIME = String.raw`
class LingWebSocketServerRuntime {
public:
    using NotifyEvent = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingWebSocketServerRuntime(NotifyEvent notify) : notify_(std::move(notify)) {
        WSADATA data = {};
        socketsStarted_ = WSAStartup(MAKEWORD(2, 2), &data) == 0;
    }

    ~LingWebSocketServerRuntime() {
        Shutdown();
        if (socketsStarted_) WSACleanup();
    }

    long long CreateServer() {
        if (!socketsStarted_) return Fail(L"WebSocket 网络运行时初始化失败。");
        auto server = std::make_shared<Server>();
        server->id = nextServerId_.fetch_add(1);
        std::lock_guard<std::mutex> lock(mutex_);
        servers_[server->id] = server;
        return server->id;
    }

    bool Configure(long long id, const wchar_t* address, int port, int maximumClients) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改监听配置。");
        const std::wstring host = address && address[0] ? address : L"127.0.0.1";
        if (port < 0 || port > 65535) return ServerFail(server, L"WebSocket 端口必须在 0 到 65535 之间。");
        if (maximumClients < 1 || maximumClients > 4096) return ServerFail(server, L"WebSocket 最大客户端数必须在 1 到 4096 之间。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->address = host;
        server->configuredPort = port;
        server->actualPort = port;
        server->maximumClients = maximumClients;
        return true;
    }

    bool SetLimits(long long id, int handshakeHeaderKb, int messageMb, int sendQueueMb, int timeoutMs) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改资源限制。");
        if (handshakeHeaderKb < 4 || handshakeHeaderKb > 1024) return ServerFail(server, L"WebSocket 握手头上限必须在 4KB 到 1024KB 之间。");
        if (messageMb < 1 || messageMb > 1024) return ServerFail(server, L"WebSocket 消息上限必须在 1MB 到 1024MB 之间。");
        if (sendQueueMb < 1 || sendQueueMb > 1024) return ServerFail(server, L"WebSocket 单客户端发送队列上限必须在 1MB 到 1024MB 之间。");
        if (timeoutMs < 1000 || timeoutMs > 3600000) return ServerFail(server, L"WebSocket 超时必须在 1000 到 3600000 毫秒之间。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->maxHandshakeBytes = static_cast<size_t>(handshakeHeaderKb) * 1024;
        server->maxMessageBytes = static_cast<size_t>(messageMb) * 1024 * 1024;
        server->maxSendQueueBytes = static_cast<size_t>(sendQueueMb) * 1024 * 1024;
        server->timeoutMs = timeoutMs;
        return true;
    }

    bool SetHeartbeat(long long id, int intervalMs, int pongTimeoutMs) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改心跳配置。");
        if (intervalMs < 0 || intervalMs > 3600000) return ServerFail(server, L"WebSocket 心跳间隔必须在 0 到 3600000 毫秒之间。");
        if (intervalMs > 0 && (pongTimeoutMs < 1000 || pongTimeoutMs > intervalMs)) return ServerFail(server, L"WebSocket Pong 超时必须在 1000 毫秒到心跳间隔之间。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->heartbeatIntervalMs = intervalMs;
        server->pongTimeoutMs = intervalMs == 0 ? 0 : pongTimeoutMs;
        return true;
    }

    bool AllowExternal(long long id, bool allowed) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改外部监听权限。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->allowExternal = allowed;
        return true;
    }

    bool SetPath(long long id, const wchar_t* path) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        const std::wstring value = path ? path : L"";
        if (!value.empty() && value[0] != L'/') return ServerFail(server, L"WebSocket 访问路径必须以 / 开头。");
        if (value.find_first_of(L"\r\n") != std::wstring::npos) return ServerFail(server, L"WebSocket 访问路径包含非法换行字符。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改访问路径。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->path = value;
        return true;
    }

    bool SetOrigins(long long id, const wchar_t* origins) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        auto values = SplitList(origins ? origins : L"");
        for (const auto& value : values) if (value.find_first_of(L"\r\n") != std::wstring::npos) return ServerFail(server, L"WebSocket Origin 白名单包含非法字符。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改 Origin 白名单。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->allowedOrigins = std::move(values);
        return true;
    }

    bool SetProtocols(long long id, const wchar_t* protocols) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        auto values = SplitList(protocols ? protocols : L"");
        for (const auto& value : values) if (!ValidToken(value)) return ServerFail(server, L"WebSocket 子协议包含非法 token。");
        if (server->running.load()) return ServerFail(server, L"WebSocket 服务正在运行，不能修改子协议。");
        std::lock_guard<std::mutex> lock(server->mutex);
        server->protocols = std::move(values);
        return true;
    }

    bool BindHandler(long long id, int kind, const wchar_t* handler) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return ServerFail(server, L"WebSocket 事件处理器不能为空。");
        if (kind < 1 || kind > 4) return ServerFail(server, L"WebSocket 事件处理器类型无效。");
        std::lock_guard<std::mutex> lock(server->mutex);
        if (kind == 1) server->connectHandler = value;
        else if (kind == 2) server->messageHandler = value;
        else if (kind == 3) server->disconnectHandler = value;
        else if (kind == 4) server->errorHandler = value;
        return true;
    }

    bool Start(long long id) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        std::lock_guard<std::mutex> lifecycle(server->lifecycleMutex);
        if (server->running.load()) return true;
        {
            std::lock_guard<std::mutex> lock(server->mutex);
            if (!server->allowExternal && !IsLoopback(server->address)) {
                server->lastError = L"WebSocket 默认只允许回环监听；外部地址必须先显式调用 WSS_允许外部监听。";
                return false;
            }
            server->lastError.clear();
        }
        SOCKET listener = CreateListenSocket(server);
        if (listener == INVALID_SOCKET) return false;
        server->listenSocket = listener;
        server->stopping.store(false);
        server->running.store(true);
        try {
            server->reactor = std::thread([this, server]() { ReactorLoop(server); });
        } catch (...) {
            server->running.store(false);
            server->stopping.store(true);
            CloseSocket(server->listenSocket);
            return ServerFail(server, L"WebSocket 服务启动失败：无法创建后台线程。");
        }
        return true;
    }

    bool Stop(long long id) {
        auto server = FindServer(id);
        if (!server) return Fail(L"WebSocket 服务端句柄无效。");
        return StopServer(server);
    }

    bool Destroy(long long id) {
        std::shared_ptr<Server> server;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto found = servers_.find(id);
            if (found == servers_.end()) return FailLocked(L"WebSocket 服务端句柄不存在或已销毁。");
            server = found->second;
            servers_.erase(found);
        }
        StopServer(server);
        std::lock_guard<std::mutex> clientLock(clientsMutex_);
        for (auto iterator = clients_.begin(); iterator != clients_.end();) {
            if (iterator->second->serverId == id) iterator = clients_.erase(iterator);
            else ++iterator;
        }
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
            std::lock_guard<std::mutex> lock(clientsMutex_);
            clients_.clear();
        }
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            events_.clear();
            currentEvent_.reset();
        }
    }

    bool IsRunning(long long id) const { auto server = FindServer(id); return server && server->running.load(); }
    std::wstring Address(long long id) const { auto server = FindServer(id); if (!server) return L""; std::lock_guard<std::mutex> lock(server->mutex); return server->address; }
    int Port(long long id) const { auto server = FindServer(id); return server ? server->actualPort : 0; }
    int OnlineClients(long long id) const { auto server = FindServer(id); return server ? server->onlineClients.load() : 0; }
    long long TotalConnections(long long id) const { auto server = FindServer(id); return server ? server->totalConnections.load() : 0; }
    long long TotalMessages(long long id) const { auto server = FindServer(id); return server ? server->totalMessages.load() : 0; }
    std::wstring Error(long long id) const {
        auto server = FindServer(id);
        if (!server) { std::lock_guard<std::mutex> lock(mutex_); return lastError_.empty() ? L"WebSocket 服务端句柄无效。" : lastError_; }
        std::lock_guard<std::mutex> lock(server->mutex);
        return server->lastError;
    }

    bool ClientOnline(long long id) const { auto client = FindClient(id); return client && client->online.load() && !client->closing.load(); }
    std::wstring ClientAddress(long long id) const { auto client = FindClient(id); return client ? client->address : L""; }
    int ClientPort(long long id) const { auto client = FindClient(id); return client ? client->port : 0; }
    std::wstring ClientPath(long long id) const { auto client = FindClient(id); return client ? client->path : L""; }
    std::wstring ClientOrigin(long long id) const { auto client = FindClient(id); return client ? client->origin : L""; }
    std::wstring ClientProtocol(long long id) const { auto client = FindClient(id); return client ? client->protocol : L""; }
    long long ClientConnectedMilliseconds(long long id) const {
        auto client = FindClient(id); if (!client || client->connectedAt.time_since_epoch().count() == 0) return 0;
        return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - client->connectedAt).count();
    }

    std::wstring ClientsJson(long long serverId) const {
        auto server = FindServer(serverId); if (!server) return L"[]";
        std::vector<std::shared_ptr<Client>> snapshot;
        { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->online.load()) snapshot.push_back(pair.second); }
        std::wstring output = L"["; bool first = true;
        for (const auto& client : snapshot) {
            if (!first) output += L","; first = false;
            output += L"{\"id\":" + std::to_wstring(client->id)
                + L",\"address\":\"" + JsonEscape(client->address)
                + L"\",\"port\":" + std::to_wstring(client->port)
                + L",\"path\":\"" + JsonEscape(client->path)
                + L"\",\"origin\":\"" + JsonEscape(client->origin)
                + L"\",\"protocol\":\"" + JsonEscape(client->protocol) + L"\"}";
        }
        return output + L"]";
    }

    bool SendText(long long clientId, const wchar_t* text) {
        const std::string payload = WideToUtf8(text ? text : L"");
        return QueueData(clientId, 0x1, std::vector<unsigned char>(payload.begin(), payload.end()));
    }

    bool SendBinary(long long clientId, const std::vector<unsigned char>& data) { return QueueData(clientId, 0x2, data); }

    int BroadcastText(long long serverId, const wchar_t* text) {
        const std::string payload = WideToUtf8(text ? text : L"");
        return Broadcast(serverId, 0x1, std::vector<unsigned char>(payload.begin(), payload.end()));
    }

    int BroadcastBinary(long long serverId, const std::vector<unsigned char>& data) { return Broadcast(serverId, 0x2, data); }

    bool Ping(long long clientId, const wchar_t* text) {
        const std::string utf8 = WideToUtf8(text ? text : L"");
        if (utf8.size() > 125) return Fail(L"WebSocket Ping 数据不能超过 125 字节。");
        return QueueData(clientId, 0x9, std::vector<unsigned char>(utf8.begin(), utf8.end()));
    }

    bool CloseClient(long long clientId, int code, const wchar_t* reason) {
        auto client = FindClient(clientId);
        if (!client || !client->online.load()) return Fail(L"WebSocket 客户端句柄无效或已离线。");
        if (!ValidCloseCode(code)) return Fail(L"WebSocket 关闭状态码不合法。");
        const std::string reasonUtf8 = WideToUtf8(reason ? reason : L"");
        if (reasonUtf8.size() > 123 || !ValidUtf8(reinterpret_cast<const unsigned char*>(reasonUtf8.data()), reasonUtf8.size())) return Fail(L"WebSocket 关闭原因必须是最多 123 字节的有效 UTF-8 文本。");
        std::vector<unsigned char> payload { static_cast<unsigned char>((code >> 8) & 0xff), static_cast<unsigned char>(code & 0xff) };
        payload.insert(payload.end(), reasonUtf8.begin(), reasonUtf8.end());
        return BeginClose(client, code, reason ? reason : L"", payload);
    }

    bool ForceDisconnect(long long clientId) {
        auto client = FindClient(clientId);
        if (!client || !client->active.load()) return Fail(L"WebSocket 客户端句柄无效或已离线。");
        client->forceClose.store(true);
        return true;
    }

    bool DispatchEvent(long long eventId, const DispatchHandler& dispatch) {
        std::shared_ptr<Event> event;
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            auto found = events_.find(eventId);
            if (found == events_.end()) return false;
            event = found->second;
            events_.erase(found);
            currentEvent_ = event;
        }
        if (dispatch && !event->handler.empty()) dispatch(event->handler.c_str());
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            if (currentEvent_ == event) currentEvent_.reset();
        }
        return true;
    }

    std::wstring CurrentType() const { auto event = CurrentEvent(); return event ? event->type : L""; }
    long long CurrentClient() const { auto event = CurrentEvent(); return event ? event->clientId : 0; }
    std::wstring CurrentMessageType() const { auto event = CurrentEvent(); return event ? event->messageType : L""; }
    std::wstring CurrentText() const { auto event = CurrentEvent(); return event ? event->text : L""; }
    std::vector<unsigned char> CurrentBinary() const { auto event = CurrentEvent(); return event ? event->binary : std::vector<unsigned char>{}; }
    int CurrentCloseCode() const { auto event = CurrentEvent(); return event ? event->closeCode : 0; }
    std::wstring CurrentCloseReason() const { auto event = CurrentEvent(); return event ? event->closeReason : L""; }

    int LegacyStart(int port) {
        if (legacyServerId_ != 0) Destroy(legacyServerId_);
        legacyServerId_ = CreateServer();
        if (!legacyServerId_ || !Configure(legacyServerId_, L"127.0.0.1", port, 64) || !Start(legacyServerId_)) { legacyServerId_ = 0; return 0; }
        return 1;
    }

    int LegacyWaitConnection(int timeoutMs) {
        std::unique_lock<std::mutex> lock(legacyMutex_);
        return legacyChanged_.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&]() { return legacyLatestClient_ != 0 && ClientOnline(legacyLatestClient_); }) ? 1 : 0;
    }

    std::wstring LegacyReceiveText(int timeoutMs) {
        std::unique_lock<std::mutex> lock(legacyMutex_);
        if (!legacyChanged_.wait_for(lock, std::chrono::milliseconds(timeoutMs), [&]() { return !legacyTexts_.empty(); })) return L"";
        std::wstring result = std::move(legacyTexts_.front());
        legacyTexts_.pop_front();
        return result;
    }

    int LegacySendText(const wchar_t* text) { return legacyLatestClient_ != 0 && SendText(legacyLatestClient_, text) ? 1 : 0; }
    void LegacyClose() { if (legacyServerId_ != 0) { Destroy(legacyServerId_); legacyServerId_ = 0; } }

private:
    struct Outgoing {
        std::vector<unsigned char> data;
        size_t offset = 0;
    };

    struct Client {
        long long id = 0;
        long long serverId = 0;
        SOCKET socket = INVALID_SOCKET;
        std::atomic<bool> active { true };
        std::atomic<bool> online { false };
        std::atomic<bool> closing { false };
        std::atomic<bool> forceClose { false };
        bool closeSent = false;
        bool disconnectNotified = false;
        int closeCode = 1006;
        std::wstring closeReason;
        std::wstring address;
        int port = 0;
        std::wstring path;
        std::wstring origin;
        std::wstring protocol;
        std::vector<unsigned char> input;
        std::deque<Outgoing> output;
        size_t queuedBytes = 0;
        int fragmentedOpcode = 0;
        std::vector<unsigned char> fragmentedPayload;
        std::chrono::steady_clock::time_point acceptedAt = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point connectedAt {};
        std::chrono::steady_clock::time_point lastReceive = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point lastPing {};
        std::chrono::steady_clock::time_point lastPong = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point closeDeadline {};
        mutable std::mutex mutex;
    };

    struct Server {
        long long id = 0;
        std::wstring address = L"127.0.0.1";
        int configuredPort = 18080;
        int actualPort = 18080;
        int maximumClients = 512;
        size_t maxHandshakeBytes = 64 * 1024;
        size_t maxMessageBytes = 16 * 1024 * 1024;
        size_t maxSendQueueBytes = 8 * 1024 * 1024;
        int timeoutMs = 30000;
        int heartbeatIntervalMs = 30000;
        int pongTimeoutMs = 10000;
        bool allowExternal = false;
        std::wstring path;
        std::vector<std::wstring> allowedOrigins;
        std::vector<std::wstring> protocols;
        std::wstring connectHandler;
        std::wstring messageHandler;
        std::wstring disconnectHandler;
        std::wstring errorHandler;
        std::wstring lastError;
        SOCKET listenSocket = INVALID_SOCKET;
        std::thread reactor;
        std::atomic<bool> running { false };
        std::atomic<bool> stopping { false };
        std::atomic<int> onlineClients { 0 };
        std::atomic<long long> totalConnections { 0 };
        std::atomic<long long> totalMessages { 0 };
        std::unordered_map<long long, std::shared_ptr<Client>> clients;
        mutable std::mutex clientsMutex;
        mutable std::mutex mutex;
        std::mutex lifecycleMutex;
    };

    struct Event {
        long long id = 0;
        std::wstring handler;
        std::wstring type;
        long long clientId = 0;
        std::wstring messageType;
        std::wstring text;
        std::vector<unsigned char> binary;
        int closeCode = 0;
        std::wstring closeReason;
    };

    std::shared_ptr<Server> FindServer(long long id) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto found = servers_.find(id);
        return found == servers_.end() ? nullptr : found->second;
    }

    std::shared_ptr<Client> FindClient(long long id) const {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        auto found = clients_.find(id);
        return found == clients_.end() ? nullptr : found->second;
    }

    std::shared_ptr<Event> CurrentEvent() const { std::lock_guard<std::mutex> lock(eventsMutex_); return currentEvent_; }

    long long Fail(const std::wstring& message) const { std::lock_guard<std::mutex> lock(mutex_); return FailLocked(message); }
    long long FailLocked(const std::wstring& message) const { lastError_ = message; return 0; }
    bool ServerFail(const std::shared_ptr<Server>& server, const std::wstring& message) const { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = message; return false; }

    SOCKET CreateListenSocket(const std::shared_ptr<Server>& server) {
        addrinfoW hints = {};
        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        hints.ai_protocol = IPPROTO_TCP;
        hints.ai_flags = AI_PASSIVE;
        addrinfoW* addresses = nullptr;
        const std::wstring port = std::to_wstring(server->configuredPort);
        int resolved = GetAddrInfoW(server->address.empty() ? nullptr : server->address.c_str(), port.c_str(), &hints, &addresses);
        if (resolved != 0 || !addresses) { ServerFail(server, L"WebSocket 监听地址无法解析，错误码：" + std::to_wstring(resolved)); return INVALID_SOCKET; }
        SOCKET listener = INVALID_SOCKET;
        for (addrinfoW* item = addresses; item; item = item->ai_next) {
            listener = socket(item->ai_family, item->ai_socktype, item->ai_protocol);
            if (listener == INVALID_SOCKET) continue;
            BOOL exclusive = TRUE;
            setsockopt(listener, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<const char*>(&exclusive), sizeof(exclusive));
            u_long nonBlocking = 1;
            if (ioctlsocket(listener, FIONBIO, &nonBlocking) == SOCKET_ERROR
                || bind(listener, item->ai_addr, static_cast<int>(item->ai_addrlen)) == SOCKET_ERROR
                || listen(listener, SOMAXCONN) == SOCKET_ERROR) {
                closesocket(listener); listener = INVALID_SOCKET; continue;
            }
            sockaddr_storage bound = {}; int boundLength = sizeof(bound);
            if (getsockname(listener, reinterpret_cast<sockaddr*>(&bound), &boundLength) == 0) {
                if (bound.ss_family == AF_INET) server->actualPort = ntohs(reinterpret_cast<sockaddr_in*>(&bound)->sin_port);
                else if (bound.ss_family == AF_INET6) server->actualPort = ntohs(reinterpret_cast<sockaddr_in6*>(&bound)->sin6_port);
            }
            break;
        }
        FreeAddrInfoW(addresses);
        if (listener == INVALID_SOCKET) ServerFail(server, L"WebSocket 监听启动失败，Winsock 错误码：" + std::to_wstring(WSAGetLastError()));
        return listener;
    }

    bool StopServer(const std::shared_ptr<Server>& server) {
        std::lock_guard<std::mutex> lifecycle(server->lifecycleMutex);
        if (!server->running.load() && !server->reactor.joinable()) return true;
        server->stopping.store(true);
        CloseSocket(server->listenSocket);
        std::vector<std::shared_ptr<Client>> clients;
        { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->active.load()) clients.push_back(pair.second); }
        for (const auto& client : clients) {
            std::vector<unsigned char> payload { 0x03, 0xE9 };
            const std::string reason = "server shutdown";
            payload.insert(payload.end(), reason.begin(), reason.end());
            BeginClose(client, 1001, L"服务端停止", payload);
        }
        if (server->reactor.joinable() && server->reactor.get_id() != std::this_thread::get_id()) server->reactor.join();
        server->running.store(false);
        server->stopping.store(false);
        return true;
    }

    void ReactorLoop(const std::shared_ptr<Server>& server) {
        auto shutdownDeadline = std::chrono::steady_clock::time_point::max();
        while (true) {
            if (server->stopping.load() && shutdownDeadline == std::chrono::steady_clock::time_point::max()) shutdownDeadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(750);
            std::vector<std::shared_ptr<Client>> clients;
            { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->active.load()) clients.push_back(pair.second); }
            if (server->stopping.load() && (clients.empty() || std::chrono::steady_clock::now() >= shutdownDeadline)) break;

            std::vector<WSAPOLLFD> descriptors;
            std::vector<std::shared_ptr<Client>> descriptorClients;
            if (!server->stopping.load() && server->listenSocket != INVALID_SOCKET) descriptors.push_back({ server->listenSocket, POLLRDNORM, 0 });
            for (const auto& client : clients) {
                short events = POLLRDNORM;
                { std::lock_guard<std::mutex> lock(client->mutex); if (!client->output.empty()) events |= POLLWRNORM; }
                descriptors.push_back({ client->socket, events, 0 });
                descriptorClients.push_back(client);
            }
            if (!descriptors.empty()) WSAPoll(descriptors.data(), static_cast<ULONG>(descriptors.size()), 50);

            size_t offset = 0;
            if (!server->stopping.load() && server->listenSocket != INVALID_SOCKET) {
                if (!descriptors.empty() && (descriptors[0].revents & POLLRDNORM)) AcceptReady(server);
                offset = 1;
            }
            for (size_t index = 0; index < descriptorClients.size(); ++index) {
                auto client = descriptorClients[index];
                const short events = offset + index < descriptors.size() ? descriptors[offset + index].revents : 0;
                if (client->forceClose.load() || (events & (POLLERR | POLLHUP | POLLNVAL))) { RemoveClient(server, client, 1006, L"连接异常关闭"); continue; }
                if (events & POLLRDNORM) ReceiveReady(server, client);
                if (client->active.load() && (events & POLLWRNORM)) FlushOutput(server, client);
                if (client->active.load()) CheckTimeouts(server, client);
            }
        }
        std::vector<std::shared_ptr<Client>> remaining;
        { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->active.load()) remaining.push_back(pair.second); }
        for (const auto& client : remaining) RemoveClient(server, client, client->closeCode, client->closeReason.empty() ? L"服务端停止" : client->closeReason);
        server->running.store(false);
    }

    void AcceptReady(const std::shared_ptr<Server>& server) {
        while (true) {
            sockaddr_storage remote = {}; int remoteLength = sizeof(remote);
            SOCKET socketValue = accept(server->listenSocket, reinterpret_cast<sockaddr*>(&remote), &remoteLength);
            if (socketValue == INVALID_SOCKET) {
                const int error = WSAGetLastError();
                if (error != WSAEWOULDBLOCK && !server->stopping.load()) ReportServerError(server, L"WebSocket 接受连接失败，错误码：" + std::to_wstring(error));
                return;
            }
            int activeCount = 0;
            { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->active.load()) ++activeCount; }
            if (activeCount >= server->maximumClients) { SendHttpError(socketValue, 503, "Service Unavailable"); closesocket(socketValue); continue; }
            u_long nonBlocking = 1;
            ioctlsocket(socketValue, FIONBIO, &nonBlocking);
            BOOL noDelay = TRUE;
            setsockopt(socketValue, IPPROTO_TCP, TCP_NODELAY, reinterpret_cast<const char*>(&noDelay), sizeof(noDelay));
            auto client = std::make_shared<Client>();
            client->id = nextClientId_.fetch_add(1);
            client->serverId = server->id;
            client->socket = socketValue;
            wchar_t host[NI_MAXHOST] = {}; wchar_t service[NI_MAXSERV] = {};
            if (GetNameInfoW(reinterpret_cast<sockaddr*>(&remote), remoteLength, host, NI_MAXHOST, service, NI_MAXSERV, NI_NUMERICHOST | NI_NUMERICSERV) == 0) {
                client->address = host; client->port = _wtoi(service);
            }
            { std::lock_guard<std::mutex> lock(server->clientsMutex); server->clients[client->id] = client; }
            { std::lock_guard<std::mutex> lock(clientsMutex_); clients_[client->id] = client; }
        }
    }

    void ReceiveReady(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client) {
        unsigned char buffer[16384];
        while (client->active.load()) {
            int received = recv(client->socket, reinterpret_cast<char*>(buffer), sizeof(buffer), 0);
            if (received > 0) {
                client->lastReceive = std::chrono::steady_clock::now();
                client->input.insert(client->input.end(), buffer, buffer + received);
                if (!client->online.load()) {
                    if (client->input.size() > server->maxHandshakeBytes) { RejectHandshake(server, client, 431, "Request Header Fields Too Large", L"WebSocket 握手头超过限制。"); return; }
                    if (!ProcessHandshake(server, client)) return;
                }
                if (client->online.load() && !ProcessFrames(server, client)) return;
                continue;
            }
            if (received == 0) { RemoveClient(server, client, client->closing.load() ? client->closeCode : 1006, client->closeReason); return; }
            const int error = WSAGetLastError();
            if (error == WSAEWOULDBLOCK) return;
            RemoveClient(server, client, 1006, L"网络接收失败，错误码：" + std::to_wstring(error));
            return;
        }
    }

    bool ProcessHandshake(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client) {
        static const unsigned char delimiter[] = { '\r', '\n', '\r', '\n' };
        auto end = std::search(client->input.begin(), client->input.end(), std::begin(delimiter), std::end(delimiter));
        if (end == client->input.end()) return true;
        const size_t headerLength = static_cast<size_t>(end - client->input.begin()) + 4;
        const std::string request(client->input.begin(), client->input.begin() + headerLength);
        client->input.erase(client->input.begin(), client->input.begin() + headerLength);

        std::istringstream stream(request);
        std::string requestLine;
        if (!std::getline(stream, requestLine)) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 握手请求行缺失。");
        TrimAscii(requestLine);
        std::istringstream requestParts(requestLine);
        std::string method, target, version, extra;
        requestParts >> method >> target >> version >> extra;
        if (method != "GET" || target.empty() || version != "HTTP/1.1" || !extra.empty()) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 握手必须使用 GET HTTP/1.1。");
        if (target[0] != '/' || target.find_first_of("\r\n") != std::string::npos) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 请求目标不合法。");

        std::map<std::string, std::string> headers;
        std::string line;
        while (std::getline(stream, line)) {
            TrimAscii(line); if (line.empty()) continue;
            const size_t colon = line.find(':');
            if (colon == std::string::npos) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 握手头格式错误。");
            std::string name = LowerAscii(line.substr(0, colon)); std::string value = line.substr(colon + 1);
            TrimAscii(name); TrimAscii(value);
            if (!ValidHeaderName(name)) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 握手头名称不合法。");
            auto found = headers.find(name); if (found == headers.end()) headers[name] = value; else found->second += "," + value;
        }
        if (!HeaderHasToken(headers["upgrade"], "websocket") || !HeaderHasToken(headers["connection"], "upgrade")) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket Upgrade/Connection 握手头无效。");
        if (headers["sec-websocket-version"] != "13") return RejectHandshake(server, client, 426, "Upgrade Required", L"WebSocket 仅支持 RFC 6455 版本 13。", "Sec-WebSocket-Version: 13\r\n");
        std::vector<unsigned char> decodedKey;
        if (!Base64Decode(headers["sec-websocket-key"], decodedKey) || decodedKey.size() != 16) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket Sec-WebSocket-Key 无效。");

        const std::string rawPath = target.substr(0, target.find('?'));
        const std::wstring path = Utf8ToWide(rawPath);
        const std::wstring origin = Utf8ToWide(headers["origin"]);
        std::wstring requiredPath; std::vector<std::wstring> allowedOrigins; std::vector<std::wstring> protocols;
        { std::lock_guard<std::mutex> lock(server->mutex); requiredPath = server->path; allowedOrigins = server->allowedOrigins; protocols = server->protocols; }
        if (!requiredPath.empty() && path != requiredPath) return RejectHandshake(server, client, 404, "Not Found", L"WebSocket 请求路径不允许。");
        if (!allowedOrigins.empty() && std::find(allowedOrigins.begin(), allowedOrigins.end(), origin) == allowedOrigins.end()) return RejectHandshake(server, client, 403, "Forbidden", L"WebSocket Origin 不在允许列表中。");

        std::wstring selectedProtocol;
        const auto requestedProtocols = SplitList(Utf8ToWide(headers["sec-websocket-protocol"]));
        for (const auto& supported : protocols) {
            if (std::find(requestedProtocols.begin(), requestedProtocols.end(), supported) != requestedProtocols.end()) { selectedProtocol = supported; break; }
        }
        if (!requestedProtocols.empty() && !protocols.empty() && selectedProtocol.empty()) return RejectHandshake(server, client, 400, "Bad Request", L"WebSocket 子协议无法协商。");

        const std::string accept = MakeAcceptKey(headers["sec-websocket-key"]);
        if (accept.empty()) return RejectHandshake(server, client, 500, "Internal Server Error", L"WebSocket 握手摘要计算失败。");
        std::string response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n";
        if (!selectedProtocol.empty()) response += "Sec-WebSocket-Protocol: " + WideToUtf8(selectedProtocol) + "\r\n";
        response += "\r\n";
        QueueRaw(client, std::vector<unsigned char>(response.begin(), response.end()), server->maxSendQueueBytes);
        client->path = path; client->origin = origin; client->protocol = selectedProtocol;
        client->connectedAt = std::chrono::steady_clock::now(); client->lastPing = client->connectedAt; client->lastPong = client->connectedAt;
        client->online.store(true);
        server->onlineClients.fetch_add(1); server->totalConnections.fetch_add(1);
        {
            std::lock_guard<std::mutex> lock(legacyMutex_);
            if (server->id == legacyServerId_) legacyLatestClient_ = client->id;
        }
        legacyChanged_.notify_all();
        EmitEvent(server, client, L"连接", L"", L"", {}, 0, L"");
        return true;
    }

    bool ProcessFrames(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client) {
        while (client->input.size() >= 2) {
            const unsigned char first = client->input[0]; const unsigned char second = client->input[1];
            const bool finalFrame = (first & 0x80) != 0; const int opcode = first & 0x0f;
            if ((first & 0x70) != 0) return ProtocolFail(server, client, 1002, L"未协商扩展时 RSV 位必须为 0。");
            if ((second & 0x80) == 0) return ProtocolFail(server, client, 1002, L"客户端 WebSocket 帧必须使用掩码。");
            uint64_t length = second & 0x7f; size_t cursor = 2;
            if (length == 126) {
                if (client->input.size() < 4) return true;
                length = (static_cast<uint64_t>(client->input[2]) << 8) | client->input[3]; cursor = 4;
                if (length < 126) return ProtocolFail(server, client, 1002, L"WebSocket 帧使用了非最短长度编码。");
            } else if (length == 127) {
                if (client->input.size() < 10) return true;
                if ((client->input[2] & 0x80) != 0) return ProtocolFail(server, client, 1002, L"WebSocket 64 位负长度无效。");
                length = 0; for (int index = 0; index < 8; ++index) length = (length << 8) | client->input[2 + index]; cursor = 10;
                if (length <= 65535) return ProtocolFail(server, client, 1002, L"WebSocket 帧使用了非最短长度编码。");
            }
            const bool control = opcode >= 0x8;
            if (control && (!finalFrame || length > 125)) return ProtocolFail(server, client, 1002, L"WebSocket 控制帧必须完整且不超过 125 字节。");
            if (length > server->maxMessageBytes || length > static_cast<uint64_t>(std::numeric_limits<size_t>::max() - cursor - 4)) return ProtocolFail(server, client, 1009, L"WebSocket 消息超过服务端限制。");
            if (client->input.size() < cursor + 4 + static_cast<size_t>(length)) return true;
            unsigned char mask[4] = { client->input[cursor], client->input[cursor + 1], client->input[cursor + 2], client->input[cursor + 3] }; cursor += 4;
            std::vector<unsigned char> payload(static_cast<size_t>(length));
            for (size_t index = 0; index < payload.size(); ++index) payload[index] = client->input[cursor + index] ^ mask[index % 4];
            client->input.erase(client->input.begin(), client->input.begin() + cursor + payload.size());

            if (opcode == 0x0) {
                if (client->fragmentedOpcode == 0) return ProtocolFail(server, client, 1002, L"WebSocket 收到没有起始帧的继续帧。");
                if (client->fragmentedPayload.size() + payload.size() > server->maxMessageBytes) return ProtocolFail(server, client, 1009, L"WebSocket 分片消息超过服务端限制。");
                client->fragmentedPayload.insert(client->fragmentedPayload.end(), payload.begin(), payload.end());
                if (finalFrame) {
                    const int completeOpcode = client->fragmentedOpcode; client->fragmentedOpcode = 0;
                    auto complete = std::move(client->fragmentedPayload); client->fragmentedPayload.clear();
                    if (!DeliverMessage(server, client, completeOpcode, complete)) return false;
                }
            } else if (opcode == 0x1 || opcode == 0x2) {
                if (client->fragmentedOpcode != 0) return ProtocolFail(server, client, 1002, L"WebSocket 上一条分片消息尚未结束。");
                if (finalFrame) { if (!DeliverMessage(server, client, opcode, payload)) return false; }
                else { client->fragmentedOpcode = opcode; client->fragmentedPayload = std::move(payload); }
            } else if (opcode == 0x8) {
                if (payload.size() == 1) return ProtocolFail(server, client, 1002, L"WebSocket Close 帧负载长度不能为 1。");
                int code = 1000; std::wstring reason;
                if (payload.size() >= 2) {
                    code = (payload[0] << 8) | payload[1];
                    if (!ValidCloseCode(code)) return ProtocolFail(server, client, 1002, L"WebSocket Close 状态码无效。");
                    if (!ValidUtf8(payload.data() + 2, payload.size() - 2)) return ProtocolFail(server, client, 1007, L"WebSocket Close 原因不是有效 UTF-8。");
                    reason = Utf8ToWide(std::string(payload.begin() + 2, payload.end()));
                }
                client->closeCode = code; client->closeReason = reason;
                BeginClose(client, code, reason, payload);
                return true;
            } else if (opcode == 0x9) {
                if (!QueueRaw(client, BuildFrame(0xA, payload), server->maxSendQueueBytes)) {
                    ReportClientError(server, client, L"WebSocket Pong 发送队列已满，连接将被断开。");
                    client->forceClose.store(true);
                    return false;
                }
            } else if (opcode == 0xA) {
                client->lastPong = std::chrono::steady_clock::now();
            } else return ProtocolFail(server, client, 1002, L"WebSocket opcode 不受支持。");
        }
        return true;
    }

    bool DeliverMessage(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, int opcode, const std::vector<unsigned char>& payload) {
        if (opcode == 0x1 && !ValidUtf8(payload.data(), payload.size())) return ProtocolFail(server, client, 1007, L"WebSocket 文本消息不是有效 UTF-8。");
        server->totalMessages.fetch_add(1);
        if (opcode == 0x1) {
            const std::wstring text = Utf8ToWide(std::string(payload.begin(), payload.end()));
            if (server->id == legacyServerId_) { std::lock_guard<std::mutex> lock(legacyMutex_); legacyTexts_.push_back(text); while (legacyTexts_.size() > 1024) legacyTexts_.pop_front(); legacyChanged_.notify_all(); }
            EmitEvent(server, client, L"文本", L"文本", text, {}, 0, L"");
        } else EmitEvent(server, client, L"二进制", L"二进制", L"", payload, 0, L"");
        return true;
    }

    bool ProtocolFail(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, int code, const std::wstring& reason) {
        ReportClientError(server, client, reason);
        const std::string utf8 = WideToUtf8(reason);
        std::vector<unsigned char> payload { static_cast<unsigned char>((code >> 8) & 0xff), static_cast<unsigned char>(code & 0xff) };
        payload.insert(payload.end(), utf8.begin(), utf8.begin() + std::min<size_t>(utf8.size(), 123));
        BeginClose(client, code, reason, payload);
        return false;
    }

    bool BeginClose(const std::shared_ptr<Client>& client, int code, const std::wstring& reason, const std::vector<unsigned char>& payload) {
        if (!client->active.load()) return false;
        std::lock_guard<std::mutex> lock(client->mutex);
        if (!client->closeSent) {
            auto frame = BuildFrame(0x8, payload);
            client->queuedBytes += frame.size(); client->output.push_back({ std::move(frame), 0 }); client->closeSent = true;
        }
        client->closing.store(true); client->closeCode = code; client->closeReason = reason;
        client->closeDeadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(1000);
        return true;
    }

    bool QueueData(long long clientId, int opcode, const std::vector<unsigned char>& payload) {
        auto client = FindClient(clientId);
        if (!client || !client->online.load() || client->closing.load()) return Fail(L"WebSocket 客户端句柄无效、已离线或正在关闭。");
        auto server = FindServer(client->serverId);
        if (!server) return Fail(L"WebSocket 客户端所属服务已销毁。");
        if ((opcode == 0x1 || opcode == 0x2) && payload.size() > server->maxMessageBytes) return Fail(L"WebSocket 待发送消息超过服务端消息上限。");
        if (opcode >= 0x8 && payload.size() > 125) return Fail(L"WebSocket 控制帧不能超过 125 字节。");
        if (QueueRaw(client, BuildFrame(opcode, payload), server->maxSendQueueBytes)) return true;
        ReportClientError(server, client, L"WebSocket 客户端发送队列已满或连接已经关闭。");
        return false;
    }

    bool QueueRaw(const std::shared_ptr<Client>& client, std::vector<unsigned char> data, size_t maximum) {
        std::lock_guard<std::mutex> lock(client->mutex);
        if (!client->active.load() || client->queuedBytes + data.size() > maximum) return false;
        client->queuedBytes += data.size(); client->output.push_back({ std::move(data), 0 });
        return true;
    }

    int Broadcast(long long serverId, int opcode, const std::vector<unsigned char>& payload) {
        auto server = FindServer(serverId); if (!server) { Fail(L"WebSocket 服务端句柄无效。"); return 0; }
        std::vector<std::shared_ptr<Client>> clients;
        { std::lock_guard<std::mutex> lock(server->clientsMutex); for (const auto& pair : server->clients) if (pair.second->online.load() && !pair.second->closing.load()) clients.push_back(pair.second); }
        int sent = 0; for (const auto& client : clients) if (QueueRaw(client, BuildFrame(opcode, payload), server->maxSendQueueBytes)) ++sent;
        if (sent != static_cast<int>(clients.size())) ServerFail(server, L"WebSocket 广播未能进入全部客户端的发送队列。");
        return sent;
    }

    void FlushOutput(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client) {
        std::lock_guard<std::mutex> lock(client->mutex);
        while (!client->output.empty()) {
            auto& item = client->output.front();
            const size_t remaining = item.data.size() - item.offset;
            int sent = send(client->socket, reinterpret_cast<const char*>(item.data.data() + item.offset), static_cast<int>(std::min<size_t>(remaining, INT_MAX)), 0);
            if (sent > 0) { item.offset += sent; client->queuedBytes -= sent; if (item.offset == item.data.size()) client->output.pop_front(); continue; }
            const int error = WSAGetLastError();
            if (error == WSAEWOULDBLOCK) return;
            client->forceClose.store(true); ReportClientError(server, client, L"WebSocket 发送失败，错误码：" + std::to_wstring(error)); return;
        }
        if (client->closing.load()) client->forceClose.store(true);
    }

    void CheckTimeouts(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client) {
        const auto now = std::chrono::steady_clock::now();
        if (!client->online.load()) {
            if (now - client->acceptedAt > std::chrono::milliseconds(server->timeoutMs)) { RejectHandshake(server, client, 408, "Request Timeout", L"WebSocket 握手超时。"); client->forceClose.store(true); }
            return;
        }
        if (client->closing.load() && client->closeDeadline.time_since_epoch().count() != 0 && now >= client->closeDeadline) { client->forceClose.store(true); return; }
        if (server->heartbeatIntervalMs > 0 && client->lastPong < client->lastPing
            && now - client->lastPing >= std::chrono::milliseconds(server->pongTimeoutMs)) {
            ProtocolFail(server, client, 1001, L"WebSocket Pong 心跳超时。");
            return;
        }
        if (server->heartbeatIntervalMs > 0 && client->lastPong >= client->lastPing
            && now - client->lastPing >= std::chrono::milliseconds(server->heartbeatIntervalMs)) {
            const std::string stamp = std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count());
            if (!QueueRaw(client, BuildFrame(0x9, std::vector<unsigned char>(stamp.begin(), stamp.end())), server->maxSendQueueBytes)) {
                ReportClientError(server, client, L"WebSocket Ping 发送队列已满，连接将被断开。");
                client->forceClose.store(true);
                return;
            }
            client->lastPing = now;
        }
        if (now - client->lastReceive >= std::chrono::milliseconds(server->timeoutMs) && server->heartbeatIntervalMs == 0) {
            ProtocolFail(server, client, 1001, L"WebSocket 客户端空闲超时。");
        }
    }

    void RemoveClient(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, int code, const std::wstring& reason) {
        if (!client->active.exchange(false)) return;
        CloseSocket(client->socket);
        const bool wasOnline = client->online.exchange(false);
        if (wasOnline) server->onlineClients.fetch_sub(1);
        client->closing.store(true); client->closeCode = code; client->closeReason = reason;
        if (wasOnline && !client->disconnectNotified) { client->disconnectNotified = true; EmitEvent(server, client, L"断开", L"", L"", {}, code, reason); }
        PruneRetired(server);
    }

    void PruneRetired(const std::shared_ptr<Server>& server) {
        std::vector<long long> remove;
        { std::lock_guard<std::mutex> lock(server->clientsMutex); if (server->clients.size() <= static_cast<size_t>(server->maximumClients + 1024)) return; for (const auto& pair : server->clients) if (!pair.second->active.load()) { remove.push_back(pair.first); if (remove.size() >= 256) break; } for (long long id : remove) server->clients.erase(id); }
        if (!remove.empty()) { std::lock_guard<std::mutex> lock(clientsMutex_); for (long long id : remove) clients_.erase(id); }
    }

    void EmitEvent(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, const std::wstring& type,
        const std::wstring& messageType, const std::wstring& text, const std::vector<unsigned char>& binary, int closeCode, const std::wstring& closeReason) {
        std::wstring handler;
        { std::lock_guard<std::mutex> lock(server->mutex); handler = type == L"连接" ? server->connectHandler : (type == L"文本" || type == L"二进制") ? server->messageHandler : type == L"断开" ? server->disconnectHandler : server->errorHandler; }
        if (handler.empty()) return;
        auto event = std::make_shared<Event>(); event->id = nextEventId_.fetch_add(1); event->handler = handler; event->type = type;
        event->clientId = client ? client->id : 0; event->messageType = messageType; event->text = text; event->binary = binary; event->closeCode = closeCode; event->closeReason = closeReason;
        { std::lock_guard<std::mutex> lock(eventsMutex_); if (events_.size() >= 65536) { events_.erase(events_.begin()); } events_[event->id] = event; }
        if (!notify_ || !notify_(event->id)) { std::lock_guard<std::mutex> lock(eventsMutex_); events_.erase(event->id); }
    }

    void ReportServerError(const std::shared_ptr<Server>& server, const std::wstring& message) {
        { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = message; }
        EmitEvent(server, nullptr, L"错误", L"", message, {}, 0, L"");
    }

    void ReportClientError(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, const std::wstring& message) {
        { std::lock_guard<std::mutex> lock(server->mutex); server->lastError = message; }
        EmitEvent(server, client, L"错误", L"", message, {}, 0, L"");
    }

    bool RejectHandshake(const std::shared_ptr<Server>& server, const std::shared_ptr<Client>& client, int status, const char* reason, const std::wstring& message, const char* extra = "") {
        std::string body = WideToUtf8(message);
        std::ostringstream response; response << "HTTP/1.1 " << status << " " << reason << "\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " << body.size() << "\r\n" << extra << "\r\n" << body;
        const std::string value = response.str(); QueueRaw(client, std::vector<unsigned char>(value.begin(), value.end()), server->maxSendQueueBytes);
        client->closing.store(true); client->closeDeadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(250); ReportClientError(server, client, message); return false;
    }

    static void SendHttpError(SOCKET socketValue, int status, const char* reason) {
        std::ostringstream response; response << "HTTP/1.1 " << status << " " << reason << "\r\nConnection: close\r\nContent-Length: 0\r\n\r\n";
        const std::string value = response.str(); send(socketValue, value.data(), static_cast<int>(value.size()), 0);
    }

    static std::vector<unsigned char> BuildFrame(int opcode, const std::vector<unsigned char>& payload) {
        std::vector<unsigned char> frame; frame.reserve(payload.size() + 10); frame.push_back(static_cast<unsigned char>(0x80 | opcode));
        if (payload.size() <= 125) frame.push_back(static_cast<unsigned char>(payload.size()));
        else if (payload.size() <= 65535) { frame.push_back(126); frame.push_back(static_cast<unsigned char>((payload.size() >> 8) & 0xff)); frame.push_back(static_cast<unsigned char>(payload.size() & 0xff)); }
        else { frame.push_back(127); const uint64_t size = payload.size(); for (int shift = 56; shift >= 0; shift -= 8) frame.push_back(static_cast<unsigned char>((size >> shift) & 0xff)); }
        frame.insert(frame.end(), payload.begin(), payload.end()); return frame;
    }

    static bool IsLoopback(const std::wstring& address) {
        const std::wstring lower = Lower(address);
        return lower == L"localhost" || lower == L"127.0.0.1" || lower == L"::1" || lower == L"[::1]";
    }

    static bool ValidCloseCode(int code) {
        if (code < 1000 || code >= 5000) return false;
        return code != 1004 && code != 1005 && code != 1006 && code != 1015 && !(code >= 1016 && code <= 2999);
    }

    static bool ValidUtf8(const unsigned char* data, size_t size) {
        size_t index = 0;
        while (index < size) {
            const unsigned char first = data[index++];
            if (first <= 0x7f) continue;
            int continuation = 0; uint32_t value = 0; uint32_t minimum = 0;
            if (first >= 0xc2 && first <= 0xdf) { continuation = 1; value = first & 0x1f; minimum = 0x80; }
            else if (first >= 0xe0 && first <= 0xef) { continuation = 2; value = first & 0x0f; minimum = 0x800; }
            else if (first >= 0xf0 && first <= 0xf4) { continuation = 3; value = first & 0x07; minimum = 0x10000; }
            else return false;
            if (index + continuation > size) return false;
            for (int count = 0; count < continuation; ++count) { const unsigned char next = data[index++]; if ((next & 0xc0) != 0x80) return false; value = (value << 6) | (next & 0x3f); }
            if (value < minimum || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return false;
        }
        return true;
    }

    static bool ValidHeaderName(const std::string& name) {
        if (name.empty()) return false;
        for (unsigned char value : name) if (!(std::isalnum(value) || value == 0x60 || std::strchr("!#$%&'*+-.^_|~", value))) return false;
        return true;
    }

    static bool HeaderHasToken(const std::string& value, const std::string& token) {
        size_t start = 0; const std::string wanted = LowerAscii(token);
        while (start <= value.size()) { size_t end = value.find(',', start); if (end == std::string::npos) end = value.size(); std::string part = value.substr(start, end - start); TrimAscii(part); if (LowerAscii(part) == wanted) return true; if (end == value.size()) break; start = end + 1; }
        return false;
    }

    static std::wstring Lower(std::wstring value) { std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); }); return value; }
    static std::string LowerAscii(std::string value) { std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); }); return value; }
    static void TrimAscii(std::string& value) { const char* whitespace = " \t\r\n"; const size_t first = value.find_first_not_of(whitespace); const size_t last = value.find_last_not_of(whitespace); value = first == std::string::npos ? std::string() : value.substr(first, last - first + 1); }
    static void TrimWide(std::wstring& value) { const wchar_t* whitespace = L" \t\r\n"; const size_t first = value.find_first_not_of(whitespace); const size_t last = value.find_last_not_of(whitespace); value = first == std::wstring::npos ? std::wstring() : value.substr(first, last - first + 1); }
    static bool ValidToken(const std::wstring& value) { if (value.empty()) return false; for (wchar_t ch : value) if (!(std::iswalnum(ch) || ch == 0x60 || std::wcschr(L"!#$%&'*+-.^_|~", ch))) return false; return true; }
    static std::vector<std::wstring> SplitList(const std::wstring& value) { std::vector<std::wstring> result; size_t start = 0; while (start <= value.size()) { size_t end = value.find(L',', start); if (end == std::wstring::npos) end = value.size(); std::wstring item = value.substr(start, end - start); TrimWide(item); if (!item.empty() && std::find(result.begin(), result.end(), item) == result.end()) result.push_back(item); if (end == value.size()) break; start = end + 1; } return result; }

    static std::string WideToUtf8(const std::wstring& value) {
        if (value.empty()) return {};
        const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
        if (length <= 0) return {};
        std::string result(static_cast<size_t>(length), '\0'); WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr); return result;
    }

    static std::wstring Utf8ToWide(const std::string& value) {
        if (value.empty()) return {};
        const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
        if (length <= 0) return {};
        std::wstring result(static_cast<size_t>(length), L'\0'); MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), length); return result;
    }

    static std::wstring JsonEscape(const std::wstring& value) {
        std::wstring output; for (wchar_t ch : value) { if (ch == L'"') output += L"\\\""; else if (ch == L'\\') output += L"\\\\"; else if (ch == L'\b') output += L"\\b"; else if (ch == L'\f') output += L"\\f"; else if (ch == L'\n') output += L"\\n"; else if (ch == L'\r') output += L"\\r"; else if (ch == L'\t') output += L"\\t"; else if (ch < 0x20) { wchar_t escaped[7] = {}; swprintf_s(escaped, L"\\u%04x", static_cast<unsigned int>(ch)); output += escaped; } else output.push_back(ch); } return output;
    }

    static bool Base64Decode(const std::string& value, std::vector<unsigned char>& output) {
        static const std::string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (value.empty() || value.size() % 4 != 0) return false;
        output.clear();
        auto decode = [&](char ch, unsigned int& decoded) {
            const size_t index = alphabet.find(ch);
            if (index == std::string::npos) return false;
            decoded = static_cast<unsigned int>(index);
            return true;
        };
        for (size_t offset = 0; offset < value.size(); offset += 4) {
            const char a = value[offset], b = value[offset + 1], c = value[offset + 2], d = value[offset + 3];
            if (a == '=' || b == '=' || (c == '=' && d != '=') || (offset + 4 != value.size() && (c == '=' || d == '='))) return false;
            unsigned int va = 0, vb = 0, vc = 0, vd = 0;
            if (!decode(a, va) || !decode(b, vb) || (c != '=' && !decode(c, vc)) || (d != '=' && !decode(d, vd))) return false;
            output.push_back(static_cast<unsigned char>((va << 2) | (vb >> 4)));
            if (c != '=') output.push_back(static_cast<unsigned char>((vb << 4) | (vc >> 2)));
            if (d != '=') output.push_back(static_cast<unsigned char>((vc << 6) | vd));
        }
        return true;
    }

    static std::string MakeAcceptKey(const std::string& clientKey) {
        const std::string seed = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        HCRYPTPROV provider = 0; HCRYPTHASH hash = 0; BYTE digest[20] = {}; DWORD size = sizeof(digest);
        if (!CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) return {};
        if (!CryptCreateHash(provider, CALG_SHA1, 0, 0, &hash)) { CryptReleaseContext(provider, 0); return {}; }
        const BOOL ok = CryptHashData(hash, reinterpret_cast<const BYTE*>(seed.data()), static_cast<DWORD>(seed.size()), 0) && CryptGetHashParam(hash, HP_HASHVAL, digest, &size, 0);
        CryptDestroyHash(hash); CryptReleaseContext(provider, 0); if (!ok) return {};
        static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; std::string result;
        for (DWORD index = 0; index < size; index += 3) { const DWORD remaining = size - index; const BYTE a = digest[index], b = remaining > 1 ? digest[index + 1] : 0, c = remaining > 2 ? digest[index + 2] : 0; result.push_back(table[(a >> 2) & 63]); result.push_back(table[((a & 3) << 4) | (b >> 4)]); result.push_back(remaining > 1 ? table[((b & 15) << 2) | (c >> 6)] : '='); result.push_back(remaining > 2 ? table[c & 63] : '='); }
        return result;
    }

    static void CloseSocket(SOCKET& value) { if (value != INVALID_SOCKET) { shutdown(value, SD_BOTH); closesocket(value); value = INVALID_SOCKET; } }

    NotifyEvent notify_;
    bool socketsStarted_ = false;
    mutable std::mutex mutex_;
    mutable std::mutex clientsMutex_;
    mutable std::mutex eventsMutex_;
    mutable std::wstring lastError_;
    std::unordered_map<long long, std::shared_ptr<Server>> servers_;
    std::unordered_map<long long, std::shared_ptr<Client>> clients_;
    std::map<long long, std::shared_ptr<Event>> events_;
    std::shared_ptr<Event> currentEvent_;
    std::atomic<long long> nextServerId_ { 1 };
    std::atomic<long long> nextClientId_ { 1 };
    std::atomic<long long> nextEventId_ { 1 };
    long long legacyServerId_ = 0;
    long long legacyLatestClient_ = 0;
    std::deque<std::wstring> legacyTexts_;
    std::mutex legacyMutex_;
    std::condition_variable legacyChanged_;
};
`;

const WEBSOCKET_SERVER_WINDOW_METHODS = String.raw`
    long long WSS_创建服务() { return wssRuntime_.CreateServer(); }
    bool WSS_配置服务(long long server, const wchar_t* address, int port, int maximumClients) { return wssRuntime_.Configure(server, address, port, maximumClients); }
    bool WSS_设置资源限制(long long server, int handshakeKb, int messageMb, int sendQueueMb, int timeoutMs) { return wssRuntime_.SetLimits(server, handshakeKb, messageMb, sendQueueMb, timeoutMs); }
    bool WSS_设置心跳(long long server, int intervalMs, int pongTimeoutMs) { return wssRuntime_.SetHeartbeat(server, intervalMs, pongTimeoutMs); }
    bool WSS_允许外部监听(long long server, bool allowed) { return wssRuntime_.AllowExternal(server, allowed); }
    bool WSS_设置访问路径(long long server, const wchar_t* path) { return wssRuntime_.SetPath(server, path); }
    bool WSS_设置允许来源(long long server, const wchar_t* origins) { return wssRuntime_.SetOrigins(server, origins); }
    bool WSS_设置子协议(long long server, const wchar_t* protocols) { return wssRuntime_.SetProtocols(server, protocols); }
    bool WSS_绑定连接处理器(long long server, const wchar_t* handler) { return wssRuntime_.BindHandler(server, 1, handler); }
    bool WSS_绑定消息处理器(long long server, const wchar_t* handler) { return wssRuntime_.BindHandler(server, 2, handler); }
    bool WSS_绑定断开处理器(long long server, const wchar_t* handler) { return wssRuntime_.BindHandler(server, 3, handler); }
    bool WSS_绑定错误处理器(long long server, const wchar_t* handler) { return wssRuntime_.BindHandler(server, 4, handler); }
    bool WSS_启动(long long server) { return wssRuntime_.Start(server); }
    bool WSS_停止(long long server) { return wssRuntime_.Stop(server); }
    bool WSS_销毁服务(long long server) { return wssRuntime_.Destroy(server); }
    bool WSS_是否运行(long long server) { return wssRuntime_.IsRunning(server); }
    const wchar_t* WSS_取监听地址(long long server) { wssReturnText_ = wssRuntime_.Address(server); return wssReturnText_.c_str(); }
    int WSS_取监听端口(long long server) { return wssRuntime_.Port(server); }
    int WSS_取在线客户端数(long long server) { return wssRuntime_.OnlineClients(server); }
    long long WSS_取累计连接数(long long server) { return wssRuntime_.TotalConnections(server); }
    long long WSS_取累计消息数(long long server) { return wssRuntime_.TotalMessages(server); }
    const wchar_t* WSS_取服务错误(long long server) { wssReturnText_ = wssRuntime_.Error(server); return wssReturnText_.c_str(); }
    const wchar_t* WSS_取当前事件类型() { wssReturnText_ = wssRuntime_.CurrentType(); return wssReturnText_.c_str(); }
    long long WSS_取当前客户端() { return wssRuntime_.CurrentClient(); }
    const wchar_t* WSS_取当前消息类型() { wssReturnText_ = wssRuntime_.CurrentMessageType(); return wssReturnText_.c_str(); }
    const wchar_t* WSS_取当前文本() { wssReturnText_ = wssRuntime_.CurrentText(); return wssReturnText_.c_str(); }
    std::vector<unsigned char> WSS_取当前二进制() { return wssRuntime_.CurrentBinary(); }
    int WSS_取当前关闭代码() { return wssRuntime_.CurrentCloseCode(); }
    const wchar_t* WSS_取当前关闭原因() { wssReturnText_ = wssRuntime_.CurrentCloseReason(); return wssReturnText_.c_str(); }
    bool WSS_客户端是否在线(long long client) { return wssRuntime_.ClientOnline(client); }
    const wchar_t* WSS_取客户端地址(long long client) { wssReturnText_ = wssRuntime_.ClientAddress(client); return wssReturnText_.c_str(); }
    int WSS_取客户端端口(long long client) { return wssRuntime_.ClientPort(client); }
    const wchar_t* WSS_取客户端路径(long long client) { wssReturnText_ = wssRuntime_.ClientPath(client); return wssReturnText_.c_str(); }
    const wchar_t* WSS_取客户端来源(long long client) { wssReturnText_ = wssRuntime_.ClientOrigin(client); return wssReturnText_.c_str(); }
    const wchar_t* WSS_取客户端子协议(long long client) { wssReturnText_ = wssRuntime_.ClientProtocol(client); return wssReturnText_.c_str(); }
    long long WSS_取客户端连接时长(long long client) { return wssRuntime_.ClientConnectedMilliseconds(client); }
    const wchar_t* WSS_取客户端列表JSON(long long server) { wssReturnText_ = wssRuntime_.ClientsJson(server); return wssReturnText_.c_str(); }
    bool WSS_发送文本给客户端(long long client, const wchar_t* text) { return wssRuntime_.SendText(client, text); }
    bool WSS_发送二进制给客户端(long long client, const std::vector<unsigned char>& data) { return wssRuntime_.SendBinary(client, data); }
    int WSS_广播文本(long long server, const wchar_t* text) { return wssRuntime_.BroadcastText(server, text); }
    int WSS_广播二进制(long long server, const std::vector<unsigned char>& data) { return wssRuntime_.BroadcastBinary(server, data); }
    bool WSS_发送Ping(long long client, const wchar_t* data) { return wssRuntime_.Ping(client, data); }
    bool WSS_关闭客户端(long long client, int code, const wchar_t* reason) { return wssRuntime_.CloseClient(client, code, reason); }
    bool WSS_强制断开客户端(long long client) { return wssRuntime_.ForceDisconnect(client); }
    int WSS_启动服务(int port) { return wssRuntime_.LegacyStart(port); }
    int WSS_等待连接() { return wssRuntime_.LegacyWaitConnection(30000); }
    const wchar_t* WSS_接收文本() { wssReturnText_ = wssRuntime_.LegacyReceiveText(30000); return wssReturnText_.c_str(); }
    int WSS_接收到调试输出() { const wchar_t* text = WSS_接收文本(); if (!text || !text[0]) return 0; 调试输出(text); return 1; }
    int WSS_发送文本(const wchar_t* text) { return wssRuntime_.LegacySendText(text); }
    void WSS_关闭服务() { wssRuntime_.LegacyClose(); }
`;
