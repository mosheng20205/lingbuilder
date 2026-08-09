#pragma once

#include <windows.h>
#include <bcrypt.h>
#include <filesystem>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <climits>
#include <condition_variable>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cwctype>
#include <cwchar>
#include <deque>
#include <functional>
#include <fstream>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <system_error>
#include <thread>
#include <unordered_map>
#include <vector>

#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ws2_32.lib")
// The main executable can host CEF3 while this process host loads FBro's CEF 135.
// Delay loading keeps either bridge out of a process until its code path actually runs.
#pragma comment(lib, "delayimp.lib")
#pragma comment(linker, "/delayload:LingBuilderFbroBridge.dll")
#pragma comment(linker, "/delayload:LingBuilderCefBridge.dll")
#pragma comment(linker, "/delayload:libcef.dll")

static constexpr UINT WM_LINGBUILDER_FBRO_PROCESS_EVENT = WM_APP + 0x5D;
static constexpr int LINGBUILDER_FBRO_HOST_NOT_REQUESTED = INT_MIN;
static constexpr int LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION = 1;
static constexpr UINT_PTR LINGBUILDER_FBRO_EXTENSION_TIMEOUT_TIMER = 0x4C42;

enum LingFbroProcessMode {
    LING_FBRO_PROCESS_IN_PROCESS = 0,
    LING_FBRO_PROCESS_EMBEDDED = 1,
    LING_FBRO_PROCESS_WINDOW = 2
};

struct LingFbroProcessConfig {
    std::wstring instanceId;
    HWND eventWindow = nullptr;
    HWND hostWindow = nullptr;
    int mode = LING_FBRO_PROCESS_EMBEDDED;
    int width = 1;
    int height = 1;
    bool visible = true;
    std::wstring url;
    std::wstring profileDirectory;
    std::wstring userAgent;
    std::wstring proxyServer;
    std::wstring fingerprintJson;
    std::wstring extensionDirectory;
    unsigned int flags = 0;
};

struct LingFbroProcessEventPacket {
    std::wstring instanceId;
    std::wstring eventName;
    std::wstring dataJson;
    unsigned long long generation = 0;
};

namespace lingbuilder_fbro_process_detail {

using Json = nlohmann::json;

inline std::string WideToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    const int required = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (required <= 0) return {};
    std::string result(static_cast<size_t>(required), '\0');
    if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), result.data(), required, nullptr, nullptr) != required) return {};
    return result;
}

inline std::wstring Utf8ToWide(const std::string& value) {
    if (value.empty()) return {};
    const int required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), nullptr, 0);
    if (required <= 0) return {};
    std::wstring result(static_cast<size_t>(required), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), result.data(), required) != required) return {};
    return result;
}

inline std::wstring JsonWide(const Json& value, const char* key, const std::wstring& fallback = {}) {
    const auto found = value.find(key);
    return found != value.end() && found->is_string() ? Utf8ToWide(found->get<std::string>()) : fallback;
}

inline std::string JsonUtf8(const std::wstring& value) {
    return WideToUtf8(value);
}

inline std::wstring JsonText(const Json& value) {
    return Utf8ToWide(value.dump());
}

inline Json ParseJson(const std::wstring& value) {
    try {
        return Json::parse(WideToUtf8(value));
    } catch (...) {
        return Json();
    }
}

inline std::wstring ExecutableDirectory() {
    std::vector<wchar_t> buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (!length || length >= buffer.size()) return {};
    std::filesystem::path executable(std::wstring(buffer.data(), length));
    return executable.parent_path().wstring();
}

inline std::wstring EnvironmentValue(const wchar_t* name) {
    const DWORD required = GetEnvironmentVariableW(name, nullptr, 0);
    if (!required) return {};
    std::wstring value(static_cast<size_t>(required), L'\0');
    const DWORD written = GetEnvironmentVariableW(name, value.data(), required);
    if (!written || written >= required) return {};
    value.resize(written);
    return value;
}

inline std::wstring RandomHex(size_t bytes) {
    std::vector<unsigned char> random(bytes);
    if (BCryptGenRandom(nullptr, random.data(), static_cast<ULONG>(random.size()),
        BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) return {};
    static constexpr wchar_t digits[] = L"0123456789abcdef";
    std::wstring result;
    result.reserve(bytes * 2);
    for (const unsigned char value : random) {
        result.push_back(digits[(value >> 4) & 0x0f]);
        result.push_back(digits[value & 0x0f]);
    }
    SecureZeroMemory(random.data(), random.size());
    return result;
}

inline std::wstring ChromiumExtensionIdForPath(const std::wstring& path) {
    const std::wstring normalized = std::filesystem::absolute(path).lexically_normal().wstring();
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD objectSize = 0;
    DWORD hashSize = 0;
    DWORD written = 0;
    std::wstring result;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0
        || BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
            reinterpret_cast<PUCHAR>(&objectSize), sizeof(objectSize), &written, 0) < 0
        || BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH,
            reinterpret_cast<PUCHAR>(&hashSize), sizeof(hashSize), &written, 0) < 0) {
        if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
        return result;
    }
    std::vector<unsigned char> object(objectSize);
    std::vector<unsigned char> digest(hashSize);
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectSize, nullptr, 0, 0) >= 0
        && BCryptHashData(hash, reinterpret_cast<PUCHAR>(
            const_cast<wchar_t*>(normalized.data())),
            static_cast<ULONG>(normalized.size() * sizeof(wchar_t)), 0) >= 0
        && BCryptFinishHash(hash, digest.data(), hashSize, 0) >= 0
        && digest.size() >= 16) {
        result.reserve(32);
        for (size_t index = 0; index < 16; ++index) {
            result.push_back(static_cast<wchar_t>(L'a' + ((digest[index] >> 4) & 0x0f)));
            result.push_back(static_cast<wchar_t>(L'a' + (digest[index] & 0x0f)));
        }
    }
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    SecureZeroMemory(object.data(), object.size());
    SecureZeroMemory(digest.data(), digest.size());
    return result;
}

inline bool StartsWithEnvironmentName(const std::wstring& entry, const std::wstring& name) {
    if (entry.size() <= name.size() || entry[name.size()] != L'=') return false;
    return _wcsnicmp(entry.c_str(), name.c_str(), name.size()) == 0;
}

inline std::vector<wchar_t> BuildEnvironmentBlock(
    const std::map<std::wstring, std::wstring>& additions) {
    std::vector<std::wstring> entries;
    LPWCH source = GetEnvironmentStringsW();
    if (source) {
        for (const wchar_t* cursor = source; *cursor; cursor += wcslen(cursor) + 1) entries.emplace_back(cursor);
        FreeEnvironmentStringsW(source);
    }
    for (const auto& addition : additions) {
        entries.erase(std::remove_if(entries.begin(), entries.end(), [&](const std::wstring& entry) {
            return StartsWithEnvironmentName(entry, addition.first);
        }), entries.end());
        entries.push_back(addition.first + L"=" + addition.second);
    }
    std::sort(entries.begin(), entries.end(), [](const std::wstring& left, const std::wstring& right) {
        return _wcsicmp(left.c_str(), right.c_str()) < 0;
    });
    size_t size = 1;
    for (const auto& entry : entries) size += entry.size() + 1;
    std::vector<wchar_t> block(size, L'\0');
    wchar_t* output = block.data();
    for (const auto& entry : entries) {
        std::copy(entry.begin(), entry.end(), output);
        output += entry.size() + 1;
    }
    return block;
}

inline int ReserveLoopbackPort() {
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) return 0;
    SOCKET socketValue = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (socketValue == INVALID_SOCKET) { WSACleanup(); return 0; }
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = 0;
    int port = 0;
    if (bind(socketValue, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == 0) {
        int size = sizeof(address);
        if (getsockname(socketValue, reinterpret_cast<sockaddr*>(&address), &size) == 0) port = ntohs(address.sin_port);
    }
    closesocket(socketValue);
    WSACleanup();
    return port;
}

inline bool EnsureDirectory(const std::filesystem::path& directory) {
    if (directory.empty()) return true;
    std::error_code error;
    std::filesystem::create_directories(directory, error);
    return !error;
}

inline std::wstring SafePathSegment(const std::wstring& value) {
    std::wstring result = value;
    for (wchar_t& character : result) {
        if (character < 32 || wcschr(L"<>:\"/\\|?*", character)) character = L'_';
    }
    while (!result.empty() && (result.back() == L'.' || result.back() == L' ')) result.pop_back();
    return result.empty() ? L"browser" : result;
}

inline bool SecureEquals(const std::wstring& left, const std::wstring& right) {
    const size_t maximum = (std::max)(left.size(), right.size());
    volatile unsigned int difference = static_cast<unsigned int>(left.size() ^ right.size());
    for (size_t index = 0; index < maximum; ++index) {
        const wchar_t leftValue = index < left.size() ? left[index] : L'\0';
        const wchar_t rightValue = index < right.size() ? right[index] : L'\0';
        difference |= static_cast<unsigned int>(leftValue ^ rightValue);
    }
    return difference == 0;
}

} // namespace lingbuilder_fbro_process_detail

class LingFbroProcessController {
public:
    using Json = lingbuilder_fbro_process_detail::Json;

    static LingFbroProcessController& Instance() {
        static auto* instance = new LingFbroProcessController();
        return *instance;
    }

    int Start(const LingFbroProcessConfig& config, bool waitUntilReady = true) {
        if (config.instanceId.empty() || !config.eventWindow || !IsWindow(config.eventWindow)
            || !config.hostWindow || !IsWindow(config.hostWindow)
            || (config.mode != LING_FBRO_PROCESS_EMBEDDED && config.mode != LING_FBRO_PROCESS_WINDOW)) return 0;
        if (!EnsureServer()) return 0;
        LingFbroProcessConfig normalized = config;
        if (normalized.profileDirectory.empty()) {
            normalized.profileDirectory = (std::filesystem::path(
                lingbuilder_fbro_process_detail::ExecutableDirectory()) / L"fbro-profiles" /
                lingbuilder_fbro_process_detail::SafePathSegment(normalized.instanceId)).wstring();
        }
        if (std::filesystem::path(normalized.profileDirectory).is_relative()) {
            normalized.profileDirectory = (std::filesystem::path(
                lingbuilder_fbro_process_detail::ExecutableDirectory()) /
                normalized.profileDirectory).lexically_normal().wstring();
        }
        if (!lingbuilder_fbro_process_detail::EnsureDirectory(normalized.profileDirectory)) return 0;
        std::shared_ptr<InstanceState> instance;
        {
            std::lock_guard<std::mutex> lock(instancesMutex_);
            auto& slot = instances_[config.instanceId];
            if (!slot) slot = std::make_shared<InstanceState>();
            instance = slot;
        }
        bool needsLaunch = false;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            if (instance->status == L"就绪") return 1;
            if (instance->status == L"启动中" || instance->status == L"配置中") {
                // Another caller already launched the process; wait below for its handshake.
            } else {
                instance->config = normalized;
                instance->intentionalClose = false;
                instance->lastError.clear();
                instance->status = L"启动中";
                instance->stateChanged.notify_all();
                needsLaunch = true;
            }
        }
        if (needsLaunch && !Launch(instance)) return 0;
        if (!waitUntilReady) return 1;
        std::unique_lock<std::mutex> waitLock(instance->mutex);
        instance->stateChanged.wait_for(waitLock, std::chrono::seconds(15), [&] {
            return instance->status == L"就绪" || instance->status == L"故障"
                || instance->status == L"已关闭";
        });
        if (instance->status != L"就绪") {
            if (instance->lastError.empty()) instance->lastError = L"等待 FBro 独立进程就绪超时。";
            return 0;
        }
        return 1;
    }

    int Close(const std::wstring& instanceId) {
        auto instance = Find(instanceId);
        if (!instance) return 0;
        HANDLE process = nullptr;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->intentionalClose = true;
            process = instance->process;
        }
        Json ignored;
        // Keep the ready state until the request is queued. Otherwise Request rejects
        // the graceful close command and every shutdown unnecessarily waits for timeout.
        Request(instanceId, L"close", Json::object(), ignored, 1000);
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->status = L"关闭中";
        }
        if (process && WaitForSingleObject(process, 3000) == WAIT_TIMEOUT) TerminateProcess(process, 0);
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->status = L"已关闭";
            instance->clientId = 0;
            instance->stateChanged.notify_all();
        }
        return 1;
    }

    int Restart(const std::wstring& instanceId) {
        auto instance = Find(instanceId);
        if (!instance) return 0;
        LingFbroProcessConfig config;
        { std::lock_guard<std::mutex> lock(instance->mutex); config = instance->config; }
        Close(instanceId);
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->restartTimes.clear();
            instance->intentionalClose = false;
        }
        return Start(config);
    }

    bool Request(const std::wstring& instanceId, const std::wstring& method,
                 const Json& payload, Json& result, int timeoutMilliseconds = 10000) {
        auto instance = Find(instanceId);
        if (!instance || method.empty()) return false;
        long long clientId = 0;
        unsigned long long generation = 0;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            const bool acceptsClose = method == L"close" && instance->status == L"关闭中";
            if ((instance->status != L"就绪" && !acceptsClose) || !instance->clientId) {
                instance->lastError = L"FBro 独立进程尚未就绪。";
                return false;
            }
            clientId = instance->clientId;
            generation = instance->generation;
        }
        const std::wstring requestId = std::to_wstring(nextRequestId_.fetch_add(1));
        auto pending = std::make_shared<PendingRequest>();
        {
            std::lock_guard<std::mutex> lock(pendingMutex_);
            pending_[requestId] = pending;
        }
        Json request = {
            {"protocol", "lingbuilder.fbro.host"},
            {"version", LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION},
            {"type", "request"},
            {"instanceId", lingbuilder_fbro_process_detail::JsonUtf8(instanceId)},
            {"generation", generation},
            {"requestId", lingbuilder_fbro_process_detail::JsonUtf8(requestId)},
            {"method", lingbuilder_fbro_process_detail::JsonUtf8(method)},
            {"payload", payload}
        };
        if (!server_.SendText(clientId, lingbuilder_fbro_process_detail::JsonText(request).c_str())) {
            std::lock_guard<std::mutex> lock(pendingMutex_);
            pending_.erase(requestId);
            SetError(instance, L"向 FBro 独立进程发送命令失败。");
            return false;
        }
        std::unique_lock<std::mutex> waitLock(pending->mutex);
        const bool completed = pending->changed.wait_for(waitLock,
            std::chrono::milliseconds((std::max)(100, timeoutMilliseconds)), [&] { return pending->completed; });
        {
            std::lock_guard<std::mutex> lock(pendingMutex_);
            pending_.erase(requestId);
        }
        if (!completed) {
            SetError(instance, L"等待 FBro 独立进程响应超时。");
            return false;
        }
        if (!pending->ok) {
            SetError(instance, pending->error.empty() ? L"FBro 独立进程命令执行失败。" : pending->error);
            return false;
        }
        result = pending->result;
        return true;
    }

    bool Notify(const std::wstring& instanceId, const std::wstring& method,
                const Json& payload = Json::object()) {
        auto instance = Find(instanceId);
        if (!instance || method.empty()) return false;
        long long clientId = 0;
        unsigned long long generation = 0;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            if (instance->status != L"就绪" || !instance->clientId) {
                instance->lastError = L"FBro 独立进程尚未就绪。";
                return false;
            }
            clientId = instance->clientId;
            generation = instance->generation;
        }
        const std::wstring requestId = L"notify-" + std::to_wstring(nextRequestId_.fetch_add(1));
        Json request = {
            {"protocol", "lingbuilder.fbro.host"},
            {"version", LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION},
            {"type", "request"},
            {"notification", true},
            {"instanceId", lingbuilder_fbro_process_detail::JsonUtf8(instanceId)},
            {"generation", generation},
            {"requestId", lingbuilder_fbro_process_detail::JsonUtf8(requestId)},
            {"method", lingbuilder_fbro_process_detail::JsonUtf8(method)},
            {"payload", payload}
        };
        if (server_.SendText(clientId, lingbuilder_fbro_process_detail::JsonText(request).c_str())) return true;
        SetError(instance, L"向 FBro 独立进程发送通知失败。");
        return false;
    }

    std::wstring State(const std::wstring& instanceId) const {
        auto instance = Find(instanceId);
        if (!instance) return L"未启动";
        std::lock_guard<std::mutex> lock(instance->mutex);
        return instance->status;
    }

    unsigned long ProcessId(const std::wstring& instanceId) const {
        auto instance = Find(instanceId);
        if (!instance) return 0;
        std::lock_guard<std::mutex> lock(instance->mutex);
        return instance->processId;
    }

    int DebuggingPort(const std::wstring& instanceId) const {
        auto instance = Find(instanceId);
        if (!instance) return 0;
        std::lock_guard<std::mutex> lock(instance->mutex);
        return instance->debuggingPort;
    }

    std::wstring LastError(const std::wstring& instanceId) const {
        auto instance = Find(instanceId);
        if (!instance) return L"FBro 独立进程实例不存在。";
        std::lock_guard<std::mutex> lock(instance->mutex);
        return instance->lastError;
    }

    void Shutdown() {
        if (shuttingDown_.exchange(true)) return;
        std::vector<std::shared_ptr<InstanceState>> instances;
        {
            std::lock_guard<std::mutex> lock(instancesMutex_);
            for (const auto& item : instances_) instances.push_back(item.second);
        }
        for (const auto& instance : instances) {
            std::wstring id;
            { std::lock_guard<std::mutex> lock(instance->mutex); id = instance->config.instanceId; }
            Close(id);
        }
        server_.Shutdown();
        if (job_) { CloseHandle(job_); job_ = nullptr; }
    }

private:
    struct PendingRequest {
        std::mutex mutex;
        std::condition_variable changed;
        bool completed = false;
        bool ok = false;
        Json result;
        std::wstring error;
    };

    struct InstanceState {
        mutable std::mutex mutex;
        std::condition_variable stateChanged;
        LingFbroProcessConfig config;
        HANDLE process = nullptr;
        unsigned long processId = 0;
        long long clientId = 0;
        unsigned long long generation = 0;
        int debuggingPort = 0;
        std::wstring status = L"未启动";
        std::wstring lastError;
        std::wstring currentUrl;
        std::wstring currentTitle;
        bool intentionalClose = false;
        std::deque<unsigned long long> restartTimes;
    };

    LingFbroProcessController()
        : server_([this](long long eventId) {
            return server_.DispatchEvent(eventId, [this](const wchar_t*) { HandleServerEvent(); });
          }) {}

    std::shared_ptr<InstanceState> Find(const std::wstring& id) const {
        std::lock_guard<std::mutex> lock(instancesMutex_);
        const auto found = instances_.find(id);
        return found == instances_.end() ? nullptr : found->second;
    }

    void SetError(const std::shared_ptr<InstanceState>& instance, const std::wstring& error) const {
        if (!instance) return;
        std::lock_guard<std::mutex> lock(instance->mutex);
        instance->lastError = error;
    }

    bool EnsureServer() {
        std::lock_guard<std::mutex> lock(serverMutex_);
        if (serverId_ && server_.IsRunning(serverId_)) return true;
        token_ = lingbuilder_fbro_process_detail::RandomHex(32);
        sessionId_ = lingbuilder_fbro_process_detail::RandomHex(16);
        if (token_.empty() || sessionId_.empty()) return false;
        serverId_ = server_.CreateServer();
        const std::wstring path = L"/lingbuilder/fbro/" + sessionId_;
        if (!serverId_ || !server_.Configure(serverId_, L"127.0.0.1", 0, 256)
            || !server_.SetLimits(serverId_, 32, 8, 8, 30000)
            || !server_.SetHeartbeat(serverId_, 5000, 3000)
            || !server_.SetPath(serverId_, path.c_str())
            || !server_.BindHandler(serverId_, 1, L"__fbro_process")
            || !server_.BindHandler(serverId_, 2, L"__fbro_process")
            || !server_.BindHandler(serverId_, 3, L"__fbro_process")
            || !server_.BindHandler(serverId_, 4, L"__fbro_process")
            || !server_.Start(serverId_)) return false;
        endpoint_ = L"ws://127.0.0.1:" + std::to_wstring(server_.Port(serverId_)) + path;
        if (!job_) {
            job_ = CreateJobObjectW(nullptr, nullptr);
            if (job_) {
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION info{};
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                SetInformationJobObject(job_, JobObjectExtendedLimitInformation, &info, sizeof(info));
            }
        }
        return true;
    }

    bool EnsureHostExecutable(std::filesystem::path& hostPath) {
        std::lock_guard<std::mutex> lock(hostExecutableMutex_);
        std::vector<wchar_t> buffer(32768, L'\0');
        const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
        if (!length || length >= buffer.size()) return false;
        const std::filesystem::path source(std::wstring(buffer.data(), length));
        hostPath = source.parent_path() / L"fbro-host" / L"LingBuilderFbroHost.exe";
        if (!lingbuilder_fbro_process_detail::EnsureDirectory(hostPath.parent_path())) return false;
        std::error_code sourceError;
        if (!std::filesystem::exists(source, sourceError) || sourceError) return false;
        std::error_code hostError;
        bool needsCopy = !std::filesystem::exists(hostPath, hostError) || hostError;
        if (!needsCopy) {
            std::error_code sizeError;
            const auto sourceSize = std::filesystem::file_size(source, sizeError);
            const auto hostSize = std::filesystem::file_size(hostPath, sizeError);
            const auto sourceTime = std::filesystem::last_write_time(source, sizeError);
            const auto hostTime = std::filesystem::last_write_time(hostPath, sizeError);
            needsCopy = sizeError || sourceSize != hostSize || sourceTime > hostTime;
        }
        if (needsCopy && !CopyFileW(source.c_str(), hostPath.c_str(), FALSE)) return false;
        return true;
    }

    bool Launch(const std::shared_ptr<InstanceState>& instance) {
        if (!instance || shuttingDown_.load() || !EnsureServer()) return false;
        std::filesystem::path hostPath;
        if (!EnsureHostExecutable(hostPath)) {
            SetError(instance, L"无法准备 LingBuilderFbroHost.exe。");
            return false;
        }
        unsigned long long generation = 0;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            generation = ++instance->generation;
            instance->status = L"启动中";
            instance->clientId = 0;
            instance->debuggingPort = 0;
            instance->stateChanged.notify_all();
        }
        const std::wstring mainRuntimeDirectory = hostPath.parent_path().parent_path().wstring();
        const std::wstring inheritedPath = lingbuilder_fbro_process_detail::EnvironmentValue(L"PATH");
        const std::wstring childPath = mainRuntimeDirectory
            + (inheritedPath.empty() ? std::wstring() : L";" + inheritedPath);
        auto environment = lingbuilder_fbro_process_detail::BuildEnvironmentBlock({
            {L"LINGBUILDER_FBRO_HOST", L"1"},
            {L"LINGBUILDER_FBRO_ENDPOINT", endpoint_},
            {L"LINGBUILDER_FBRO_TOKEN", token_},
            {L"LINGBUILDER_FBRO_INSTANCE", instance->config.instanceId},
            {L"LINGBUILDER_FBRO_GENERATION", std::to_wstring(generation)},
            {L"LINGBUILDER_FBRO_CONTROLLER_PID", std::to_wstring(GetCurrentProcessId())},
            {L"PATH", childPath}
        });
        std::wstring commandLine = L"\"" + hostPath.wstring() + L"\"";
        STARTUPINFOW startup{};
        startup.cb = sizeof(startup);
        PROCESS_INFORMATION process{};
        const BOOL created = CreateProcessW(hostPath.c_str(), commandLine.data(), nullptr, nullptr, FALSE,
            CREATE_UNICODE_ENVIRONMENT | CREATE_NEW_PROCESS_GROUP, environment.data(), hostPath.parent_path().c_str(),
            &startup, &process);
        SecureZeroMemory(environment.data(), environment.size() * sizeof(wchar_t));
        if (!created) {
            SetError(instance, L"启动 LingBuilderFbroHost.exe 失败，错误码：" + std::to_wstring(GetLastError()));
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->status = L"故障";
            return false;
        }
        CloseHandle(process.hThread);
        if (job_) AssignProcessToJobObject(job_, process.hProcess);
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            instance->process = process.hProcess;
            instance->processId = process.dwProcessId;
        }
        std::thread([this, instance, processHandle = process.hProcess, generation]() {
            WaitForSingleObject(processHandle, INFINITE);
            DWORD exitCode = 0;
            GetExitCodeProcess(processHandle, &exitCode);
            bool shouldRestart = false;
            int restartIndex = 0;
            {
                std::lock_guard<std::mutex> lock(instance->mutex);
                if (instance->process == processHandle) {
                    instance->process = nullptr;
                    instance->processId = 0;
                    instance->clientId = 0;
                }
                if (!shuttingDown_.load() && !instance->intentionalClose && instance->generation == generation) {
                    const unsigned long long now = GetTickCount64();
                    while (!instance->restartTimes.empty() && now - instance->restartTimes.front() > 600000ULL) instance->restartTimes.pop_front();
                    if (instance->restartTimes.size() < 3) {
                        instance->restartTimes.push_back(now);
                        restartIndex = static_cast<int>(instance->restartTimes.size());
                        instance->status = L"重启等待";
                        shouldRestart = true;
                    } else {
                        instance->status = L"故障";
                        instance->lastError = L"FBro 独立进程在十分钟内已自动重启三次，已停止重启。退出码：" + std::to_wstring(exitCode);
                    }
                } else if (instance->intentionalClose) instance->status = L"已关闭";
                instance->stateChanged.notify_all();
            }
            CloseHandle(processHandle);
            if (shouldRestart) {
                PostEvent(instance, L"ProcessState", Json{{"state", "重启等待"}, {"exitCode", exitCode}});
                std::this_thread::sleep_for(std::chrono::seconds(1 << (restartIndex - 1)));
                if (!shuttingDown_.load()) Launch(instance);
            }
        }).detach();
        return true;
    }

    void HandleServerEvent() {
        const std::wstring type = server_.CurrentType();
        const long long clientId = server_.CurrentClient();
        if (type == L"文本") HandleServerText(clientId, server_.CurrentText());
        else if (type == L"断开") {
            std::lock_guard<std::mutex> lock(instancesMutex_);
            for (const auto& item : instances_) {
                std::lock_guard<std::mutex> instanceLock(item.second->mutex);
                if (item.second->clientId == clientId) item.second->clientId = 0;
            }
        }
    }

    void HandleServerText(long long clientId, const std::wstring& text) {
        const Json message = lingbuilder_fbro_process_detail::ParseJson(text);
        if (!message.is_object() || message.value("protocol", "") != "lingbuilder.fbro.host"
            || message.value("version", 0) != LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION) {
            server_.CloseClient(clientId, 1008, L"FBro 协议版本不兼容");
            return;
        }
        const std::wstring type = lingbuilder_fbro_process_detail::JsonWide(message, "type");
        const std::wstring instanceId = lingbuilder_fbro_process_detail::JsonWide(message, "instanceId");
        auto instance = Find(instanceId);
        if (!instance) { server_.CloseClient(clientId, 1008, L"FBro 实例不存在"); return; }
        const unsigned long long generation = message.value("generation", 0ULL);
        if (type == L"hello") {
            const std::wstring suppliedToken = lingbuilder_fbro_process_detail::JsonWide(message, "token");
            const unsigned long pid = message.value("pid", 0UL);
            bool accepted = false;
            {
                std::lock_guard<std::mutex> lock(instance->mutex);
                accepted = lingbuilder_fbro_process_detail::SecureEquals(suppliedToken, token_)
                    && generation == instance->generation && pid == instance->processId;
                if (accepted) {
                    instance->clientId = clientId;
                    instance->status = L"配置中";
                    instance->stateChanged.notify_all();
                }
            }
            if (!accepted) { server_.CloseClient(clientId, 1008, L"FBro 身份验证失败"); return; }
            SendConfigure(instance);
            return;
        }
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            if (generation != instance->generation || clientId != instance->clientId) return;
        }
        if (type == L"ready") {
            {
                std::lock_guard<std::mutex> lock(instance->mutex);
                instance->status = L"就绪";
                instance->debuggingPort = message.value("debuggingPort", 0);
                instance->stateChanged.notify_all();
            }
            PostEvent(instance, L"Created", Json{{"debuggingPort", message.value("debuggingPort", 0)}});
        } else if (type == L"response") {
            const std::wstring requestId = lingbuilder_fbro_process_detail::JsonWide(message, "requestId");
            std::shared_ptr<PendingRequest> pending;
            {
                std::lock_guard<std::mutex> lock(pendingMutex_);
                const auto found = pending_.find(requestId);
                if (found != pending_.end()) pending = found->second;
            }
            if (pending) {
                std::lock_guard<std::mutex> lock(pending->mutex);
                pending->completed = true;
                pending->ok = message.value("ok", false);
                pending->result = message.value("result", Json::object());
                pending->error = lingbuilder_fbro_process_detail::JsonWide(message, "error");
                pending->changed.notify_all();
            }
        } else if (type == L"event") {
            const std::wstring eventName = lingbuilder_fbro_process_detail::JsonWide(message, "event");
            const Json data = message.value("data", Json::object());
            {
                std::lock_guard<std::mutex> lock(instance->mutex);
                if (eventName == L"AddressChanged") instance->currentUrl = lingbuilder_fbro_process_detail::JsonWide(data, "value");
                if (eventName == L"TitleChanged") instance->currentTitle = lingbuilder_fbro_process_detail::JsonWide(data, "value");
                if (eventName == L"Error") instance->lastError = lingbuilder_fbro_process_detail::JsonWide(data, "value");
            }
            PostEvent(instance, eventName, data);
        }
    }

    void SendConfigure(const std::shared_ptr<InstanceState>& instance) {
        LingFbroProcessConfig config;
        long long clientId = 0;
        unsigned long long generation = 0;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            config = instance->config;
            clientId = instance->clientId;
            generation = instance->generation;
        }
        const HWND owner = GetAncestor(config.hostWindow, GA_ROOT);
        Json message = {
            {"protocol", "lingbuilder.fbro.host"},
            {"version", LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION},
            {"type", "configure"},
            {"instanceId", lingbuilder_fbro_process_detail::JsonUtf8(config.instanceId)},
            {"generation", generation},
            {"mode", config.mode},
            {"parentHwnd", std::to_string(reinterpret_cast<uintptr_t>(config.hostWindow))},
            {"ownerHwnd", std::to_string(reinterpret_cast<uintptr_t>(owner))},
            {"width", (std::max)(1, config.width)},
            {"height", (std::max)(1, config.height)},
            {"visible", config.visible},
            {"url", lingbuilder_fbro_process_detail::JsonUtf8(config.url)},
            {"profileDirectory", lingbuilder_fbro_process_detail::JsonUtf8(config.profileDirectory)},
            {"userAgent", lingbuilder_fbro_process_detail::JsonUtf8(config.userAgent)},
            {"proxyServer", lingbuilder_fbro_process_detail::JsonUtf8(config.proxyServer)},
            {"fingerprintJson", lingbuilder_fbro_process_detail::JsonUtf8(config.fingerprintJson)},
            {"extensionDirectory", lingbuilder_fbro_process_detail::JsonUtf8(config.extensionDirectory)},
            {"flags", config.flags}
        };
        if (!server_.SendText(clientId, lingbuilder_fbro_process_detail::JsonText(message).c_str())) {
            SetError(instance, L"向 FBro 独立进程发送启动配置失败。");
        }
    }

    void PostEvent(const std::shared_ptr<InstanceState>& instance, const std::wstring& eventName,
                   const Json& data) const {
        LingFbroProcessConfig config;
        unsigned long long generation = 0;
        {
            std::lock_guard<std::mutex> lock(instance->mutex);
            config = instance->config;
            generation = instance->generation;
        }
        auto* packet = new LingFbroProcessEventPacket();
        packet->instanceId = config.instanceId;
        packet->eventName = eventName;
        packet->dataJson = lingbuilder_fbro_process_detail::JsonText(data);
        packet->generation = generation;
        if (!config.eventWindow || !IsWindow(config.eventWindow)
            || !PostMessageW(config.eventWindow, WM_LINGBUILDER_FBRO_PROCESS_EVENT, 0,
            reinterpret_cast<LPARAM>(packet))) delete packet;
    }

    mutable std::mutex instancesMutex_;
    mutable std::mutex pendingMutex_;
    std::mutex serverMutex_;
    std::mutex hostExecutableMutex_;
    std::unordered_map<std::wstring, std::shared_ptr<InstanceState>> instances_;
    std::unordered_map<std::wstring, std::shared_ptr<PendingRequest>> pending_;
    LingWebSocketServerRuntime server_;
    long long serverId_ = 0;
    std::wstring token_;
    std::wstring sessionId_;
    std::wstring endpoint_;
    HANDLE job_ = nullptr;
    std::atomic<unsigned long long> nextRequestId_{1};
    std::atomic<bool> shuttingDown_{false};
};

class LingFbroHostRuntime {
public:
    using Json = lingbuilder_fbro_process_detail::Json;

    int Run(HINSTANCE instance) {
        instance_ = instance;
        endpoint_ = lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_ENDPOINT");
        token_ = lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_TOKEN");
        instanceId_ = lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_INSTANCE");
        generation_ = _wcstoui64(lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_GENERATION").c_str(), nullptr, 10);
        controllerPid_ = wcstoul(lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_CONTROLLER_PID").c_str(), nullptr, 10);
        SetEnvironmentVariableW(L"LINGBUILDER_FBRO_TOKEN", nullptr);
        if (endpoint_.empty() || token_.empty() || instanceId_.empty() || !generation_ || !controllerPid_) return 20;
        if (!CreateCommandWindow()) return 21;
        connection_ = client_.Create();
        if (!connection_ || !client_.Configure(connection_, endpoint_.c_str())
            || !client_.SetLimits(connection_, 15000, 30000, 8, 8)
            || !client_.BindHandler(connection_, 1, L"connected")
            || !client_.BindHandler(connection_, 2, L"message")
            || !client_.BindHandler(connection_, 3, L"disconnected")
            || !client_.BindHandler(connection_, 4, L"error")
            || !client_.Start(connection_)
            || !client_.WaitConnected(connection_, 15000)) return 22;
        controllerProcess_ = OpenProcess(SYNCHRONIZE, FALSE, controllerPid_);
        if (controllerProcess_) {
            std::thread([this]() {
                WaitForSingleObject(controllerProcess_, INFINITE);
                if (commandWindow_) PostMessageW(commandWindow_, WM_CLOSE, 0, 0);
            }).detach();
        }
        MSG message{};
        while (GetMessageW(&message, nullptr, 0, 0) > 0) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        Shutdown();
        return 0;
    }

private:
    static constexpr UINT WM_HOST_PROTOCOL = WM_APP + 0x201;
    static constexpr UINT WM_HOST_DISCONNECTED = WM_APP + 0x202;
    static constexpr UINT WM_HOST_CLIENT_EVENT = WM_APP + 0x203;

    struct BrowserEventContext { LingFbroHostRuntime* self = nullptr; };

    LingFbroHostRuntime()
        : client_([this](long long eventId) {
            return commandWindow_ && IsWindow(commandWindow_)
                && PostMessageW(commandWindow_, WM_HOST_CLIENT_EVENT, static_cast<WPARAM>(eventId), 0) != FALSE;
          }) {}

public:
    static LingFbroHostRuntime& Instance() {
        static auto* runtime = new LingFbroHostRuntime();
        return *runtime;
    }

private:
    void HandleClientEvent(const wchar_t* handler) {
        const std::wstring type = handler ? handler : L"";
        if (type == L"connected") {
            Json hello = {
                {"protocol", "lingbuilder.fbro.host"},
                {"version", LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION},
                {"type", "hello"},
                {"instanceId", lingbuilder_fbro_process_detail::JsonUtf8(instanceId_)},
                {"generation", generation_},
                {"pid", GetCurrentProcessId()},
                {"token", lingbuilder_fbro_process_detail::JsonUtf8(token_)}
            };
            client_.SendText(connection_, lingbuilder_fbro_process_detail::JsonText(hello).c_str());
            SecureZeroMemory(token_.data(), token_.size() * sizeof(wchar_t));
            token_.clear();
        } else if (type == L"message" && client_.CurrentMessageType() == L"文本") {
            auto* text = new std::wstring(client_.CurrentText());
            if (!PostMessageW(commandWindow_, WM_HOST_PROTOCOL, 0, reinterpret_cast<LPARAM>(text))) delete text;
        } else if (type == L"disconnected" || type == L"error") {
            PostMessageW(commandWindow_, WM_HOST_DISCONNECTED, 0, 0);
        }
    }

    bool CreateCommandWindow() {
        const wchar_t* className = L"LingBuilder.FBro.Host.Command";
        WNDCLASSEXW windowClass{};
        windowClass.cbSize = sizeof(windowClass);
        windowClass.hInstance = instance_;
        windowClass.lpfnWndProc = CommandWindowProc;
        windowClass.lpszClassName = className;
        if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;
        commandWindow_ = CreateWindowExW(0, className, L"", 0, 0, 0, 0, 0, HWND_MESSAGE,
            nullptr, instance_, this);
        return commandWindow_ != nullptr;
    }

    static LRESULT CALLBACK CommandWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
        auto* self = reinterpret_cast<LingFbroHostRuntime*>(GetWindowLongPtrW(window, GWLP_USERDATA));
        if (message == WM_NCCREATE) {
            auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
            self = static_cast<LingFbroHostRuntime*>(create->lpCreateParams);
            SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        }
        if (!self) return DefWindowProcW(window, message, wParam, lParam);
        if (message == WM_HOST_CLIENT_EVENT) {
            self->client_.DispatchEvent(static_cast<long long>(wParam), [self](const wchar_t* handler) {
                self->HandleClientEvent(handler);
            });
            return 0;
        }
        if (message == WM_HOST_PROTOCOL) {
            std::unique_ptr<std::wstring> text(reinterpret_cast<std::wstring*>(lParam));
            if (text) self->HandleProtocol(*text);
            return 0;
        }
        if (message == WM_TIMER && wParam == LINGBUILDER_FBRO_EXTENSION_TIMEOUT_TIMER) {
            KillTimer(window, LINGBUILDER_FBRO_EXTENSION_TIMEOUT_TIMER);
            if (self->extensionStatus_ == L"插件加载中") {
                std::wstring verificationError;
                if (self->VerifyExtensionLoaded(verificationError)) {
                    self->extensionStatus_ = L"插件已加载";
                    self->extensionError_.clear();
                } else {
                    self->extensionStatus_ = L"插件加载失败";
                    self->extensionError_ = verificationError.empty()
                        ? L"等待 FBro 插件加载确认超时。" : verificationError;
                }
                self->SendExtensionState(self->extensionStatus_, self->extensionError_);
            }
            return 0;
        }
        if (message == WM_HOST_DISCONNECTED || message == WM_CLOSE) {
            DestroyWindow(window);
            return 0;
        }
        if (message == WM_DESTROY) { PostQuitMessage(0); return 0; }
        return DefWindowProcW(window, message, wParam, lParam);
    }

    static LRESULT CALLBACK BrowserWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
        auto* self = reinterpret_cast<LingFbroHostRuntime*>(GetWindowLongPtrW(window, GWLP_USERDATA));
        if (message == WM_NCCREATE) {
            auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
            self = static_cast<LingFbroHostRuntime*>(create->lpCreateParams);
            SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        }
        if (self && message == WM_SIZE && self->browser_) LB_FBro_Resize(self->browser_);
        if (self && message == WM_CLOSE) {
            if (self->browser_) LB_FBro_Close(self->browser_);
            ShowWindow(window, SW_HIDE);
            return 0;
        }
        return DefWindowProcW(window, message, wParam, lParam);
    }

    void HandleProtocol(const std::wstring& text) {
        const Json message = lingbuilder_fbro_process_detail::ParseJson(text);
        if (!message.is_object() || message.value("protocol", "") != "lingbuilder.fbro.host"
            || message.value("version", 0) != LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION
            || lingbuilder_fbro_process_detail::JsonWide(message, "instanceId") != instanceId_
            || message.value("generation", 0ULL) != generation_) return;
        const std::wstring type = lingbuilder_fbro_process_detail::JsonWide(message, "type");
        if (type == L"configure") Configure(message);
        else if (type == L"request") ExecuteRequest(message);
    }

    void Configure(const Json& config) {
        if (browser_) return;
        const int mode = config.value("mode", LING_FBRO_PROCESS_EMBEDDED);
        const int width = (std::max)(1, config.value("width", 1));
        const int height = (std::max)(1, config.value("height", 1));
        const bool visible = config.value("visible", true);
        const unsigned int flags = config.value("flags", 0U);
        const uintptr_t parentValue = static_cast<uintptr_t>(std::strtoull(config.value("parentHwnd", "0").c_str(), nullptr, 10));
        const uintptr_t ownerValue = static_cast<uintptr_t>(std::strtoull(config.value("ownerHwnd", "0").c_str(), nullptr, 10));
        HWND parent = reinterpret_cast<HWND>(parentValue);
        HWND owner = reinterpret_cast<HWND>(ownerValue);
        if (mode == LING_FBRO_PROCESS_EMBEDDED && (!parent || !IsWindow(parent))) {
            SendError(L"FBro 独立嵌入模式的父窗口无效。");
            return;
        }
        const wchar_t* className = L"LingBuilder.FBro.Host.Browser";
        WNDCLASSEXW windowClass{};
        windowClass.cbSize = sizeof(windowClass);
        windowClass.hInstance = instance_;
        windowClass.lpfnWndProc = BrowserWindowProc;
        windowClass.lpszClassName = className;
        windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
        if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
            SendError(L"FBro Host 无法注册浏览器窗口类。");
            return;
        }
        const DWORD style = mode == LING_FBRO_PROCESS_EMBEDDED
            ? WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS
            : WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN;
        int windowWidth = width;
        int windowHeight = height;
        if (mode == LING_FBRO_PROCESS_WINDOW) {
            RECT adjusted{0, 0, width, height};
            AdjustWindowRectEx(&adjusted, style, FALSE, 0);
            windowWidth = adjusted.right - adjusted.left;
            windowHeight = adjusted.bottom - adjusted.top;
        }
        mode_ = mode;
        browserWindow_ = CreateWindowExW(0, className, L"FBro 独立浏览器", style,
            mode == LING_FBRO_PROCESS_EMBEDDED ? 0 : CW_USEDEFAULT,
            mode == LING_FBRO_PROCESS_EMBEDDED ? 0 : CW_USEDEFAULT,
            windowWidth, windowHeight, mode == LING_FBRO_PROCESS_EMBEDDED ? parent : owner,
            nullptr, instance_, this);
        if (!browserWindow_) { SendError(L"FBro Host 创建浏览器窗口失败。"); return; }
        // Embedded browser visibility follows its controller-owned parent HWND. Keeping the
        // cross-process child visible avoids a synchronous parent/child show deadlock.
        if (visible || mode == LING_FBRO_PROCESS_EMBEDDED) {
            SetWindowPos(browserWindow_, HWND_TOP, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        }

        debuggingPort_ = (flags & 16U) ? lingbuilder_fbro_process_detail::ReserveLoopbackPort() : 0;
        const std::wstring runtimeDirectory = lingbuilder_fbro_process_detail::ExecutableDirectory();
        const std::wstring profile = lingbuilder_fbro_process_detail::JsonWide(config, "profileDirectory");
        const std::wstring rootCacheDirectory = profile.empty()
            ? (std::filesystem::path(runtimeDirectory) / L".fbro-host-cache" /
                lingbuilder_fbro_process_detail::SafePathSegment(instanceId_)).wstring()
            : profile;
        const std::wstring requestContextProfile =
            (std::filesystem::path(rootCacheDirectory) / L"CachePath").lexically_normal().wstring();
        const std::wstring configuredExtension = lingbuilder_fbro_process_detail::JsonWide(config, "extensionDirectory");
        std::wstring extensionError;
        std::wstring extension = ValidateExtensionDirectory(configuredExtension, extensionError)
            ? configuredExtension : L"";
        extensionDirectory_ = extension;
        extensionId_ = extension.empty()
            ? L"" : lingbuilder_fbro_process_detail::ChromiumExtensionIdForPath(extension);
        SetEnvironmentVariableW(L"LINGBUILDER_FBRO_ROOT_CACHE_DIRECTORY", rootCacheDirectory.c_str());
        SetEnvironmentVariableW(L"LINGBUILDER_FBRO_DISABLE_AUTO_MULTIPLE", L"1");
        SetEnvironmentVariableW(L"LINGBUILDER_FBRO_STARTUP_EXTENSION",
            extension.empty() ? nullptr : extension.c_str());
#ifdef LINGBUILDER_FBRO_EMBEDDED_VIP_AUTHORIZATION_CODE
        // 仅供内部分发构建使用：授权码通过构建命令的 /D 注入，绝不写入仓库文件。
        // 环境变量优先，编译期内嵌值只作为兜底，便于运维临时换码而无需重新编译。
        // 注意：内嵌值在 exe 中为明文，可被提取；只能分发给受信任的内部用户。
        if (lingbuilder_fbro_process_detail::EnvironmentValue(
                L"LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE").empty()
            && lingbuilder_fbro_process_detail::EnvironmentValue(
                L"LINGBUILDER_FBRO_VIP_KEY").empty()) {
            SetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE",
                LINGBUILDER_FBRO_EMBEDDED_VIP_AUTHORIZATION_CODE);
        }
#endif
        SetDllDirectoryW(runtimeDirectory.c_str());
        LB_FBRO_INITIALIZE_OPTIONS_V1 options{};
        options.struct_size = sizeof(options);
        options.abi_version = LB_FBRO_INITIALIZE_OPTIONS_VERSION_V1;
        options.runtime_directory = runtimeDirectory.c_str();
        options.remote_debugging_port = debuggingPort_;
        const int initializeResult = LB_FBro_InitializeEx(&options);
        SetEnvironmentVariableW(L"LINGBUILDER_FBRO_STARTUP_EXTENSION", nullptr);
        if (initializeResult <= 0) {
            SendError(L"FBro Host 初始化 CEF 135 失败。");
            PostMessageW(commandWindow_, WM_CLOSE, 0, 0);
            return;
        }
        initialized_ = true;
        const std::wstring url = lingbuilder_fbro_process_detail::JsonWide(config, "url", L"about:blank");
        const std::wstring userAgent = lingbuilder_fbro_process_detail::JsonWide(config, "userAgent");
        if (!extension.empty()) {
            std::vector<wchar_t> licenseBuffer(32768, L'\0');
            const int licenseLength = LB_FBro_GetVipLicenseInfoJson(licenseBuffer.data(), licenseBuffer.size());
            const Json license = licenseLength > 0
                ? lingbuilder_fbro_process_detail::ParseJson(licenseBuffer.data()) : Json::object();
            const bool licenseFailed = license.value("licenseAttempted", false)
                && !license.value("licenseValid", false)
                && !license.value("error", "").empty();
            if (!license.value("extensionPlusEnabled", false)
                && (!license.value("extensionPlusRequested", false) || licenseFailed)) {
                extension.clear();
                extensionError = licenseFailed
                    ? L"FBro VIP 授权校验失败，浏览器继续运行但插件未加载。"
                    : L"FBro VIP 授权未配置，浏览器继续运行但插件未加载。";
            }
        }
        extensionStatus_ = configuredExtension.empty() ? L"未配置"
            : extension.empty() ? (extensionError.find(L"不存在") != std::wstring::npos ? L"插件缺失" : L"插件加载失败")
            : L"插件加载中";
        extensionError_ = extensionError;
        if (extensionStatus_ == L"插件加载中") {
            SetTimer(commandWindow_, LINGBUILDER_FBRO_EXTENSION_TIMEOUT_TIMER, 20000, nullptr);
        }
        browser_ = LB_FBro_CreateEx2(browserWindow_, url.c_str(), requestContextProfile.c_str(), userAgent.c_str(),
            extension.c_str(), flags, BrowserEvent, this);
        if (!browser_) {
            SendError(L"FBro Host 创建浏览器实例失败。");
            PostMessageW(commandWindow_, WM_CLOSE, 0, 0);
            return;
        }
        const std::wstring proxy = lingbuilder_fbro_process_detail::JsonWide(config, "proxyServer");
        const std::wstring fingerprint = lingbuilder_fbro_process_detail::JsonWide(config, "fingerprintJson");
        if (!proxy.empty()) LB_FBro_SetProxy(browser_, proxy.c_str(), L"", L"");
        if (!fingerprint.empty()) LB_FBro_ApplyFingerprintJson(browser_, fingerprint.c_str());
        Json ready = Envelope("ready");
        ready["debuggingPort"] = debuggingPort_;
        ready["hostHwnd"] = std::to_string(reinterpret_cast<uintptr_t>(browserWindow_));
        ready["extensionStatus"] = lingbuilder_fbro_process_detail::JsonUtf8(extensionStatus_);
        Send(ready);
        SendExtensionState(extensionStatus_, extensionError_);
    }

    static void __stdcall BrowserEvent(LB_FBRO_HANDLE, int eventCode, const wchar_t* data, void* userData) {
        auto* self = static_cast<LingFbroHostRuntime*>(userData);
        if (!self) return;
        const Json fields = lingbuilder_fbro_process_detail::ParseJson(data ? data : L"");
        const char* valueField = eventCode == LB_FBRO_EVENT_ADDRESS_CHANGED
            || eventCode == LB_FBRO_EVENT_BEFORE_POPUP ? "url"
            : eventCode == LB_FBRO_EVENT_TITLE_CHANGED ? "title"
            : eventCode == LB_FBRO_EVENT_ERROR ? "message"
            : eventCode == LB_FBRO_EVENT_LOAD_END ? "statusCode" : "data";
        std::wstring value;
        if (fields.is_object() && fields.contains(valueField)) {
            const Json& fieldValue = fields[valueField];
            if (fieldValue.is_string()) value = lingbuilder_fbro_process_detail::Utf8ToWide(fieldValue.get<std::string>());
            else if (fieldValue.is_number_integer()) value = std::to_wstring(fieldValue.get<long long>());
            else if (fieldValue.is_number_unsigned()) value = std::to_wstring(fieldValue.get<unsigned long long>());
            else value = lingbuilder_fbro_process_detail::JsonText(fieldValue);
        } else {
            value = data ? data : L"";
        }
        Json lifecycleDetail;
        const bool extensionLifecycle = eventCode == LB_FBRO_EVENT_VIP_LIFECYCLE
            && (lifecycleDetail = lingbuilder_fbro_process_detail::ParseJson(value)).is_object()
            && lifecycleDetail.value("phase", "") == "extension";
        const wchar_t* name = eventCode == LB_FBRO_EVENT_CREATED ? L"Created"
            : eventCode == LB_FBRO_EVENT_LOAD_END ? L"LoadEnd"
            : eventCode == LB_FBRO_EVENT_ADDRESS_CHANGED ? L"AddressChanged"
            : eventCode == LB_FBRO_EVENT_TITLE_CHANGED ? L"TitleChanged"
            : eventCode == LB_FBRO_EVENT_CLOSED ? L"Closed"
            : eventCode == LB_FBRO_EVENT_DOWNLOAD_START ? L"OnBeforeDownload"
            : eventCode == LB_FBRO_EVENT_DOWNLOAD_UPDATED ? L"OnDownloadUpdated"
            : extensionLifecycle ? L"ExtensionState"
            : eventCode == LB_FBRO_EVENT_VIP_LIFECYCLE ? L"VipLifecycle"
            : L"Error";
        Json event = self->Envelope("event");
        event["event"] = lingbuilder_fbro_process_detail::JsonUtf8(name);
        if (extensionLifecycle) {
            Json detail = std::move(lifecycleDetail);
            const std::string rawStatus = detail.value("status", "failed");
            const std::wstring status = rawStatus == "loaded" ? L"插件已加载"
                : rawStatus == "removed" ? L"插件已移除" : L"插件加载失败";
            self->extensionStatus_ = status;
            self->extensionError_ = lingbuilder_fbro_process_detail::JsonWide(detail, "error");
            KillTimer(self->commandWindow_, LINGBUILDER_FBRO_EXTENSION_TIMEOUT_TIMER);
            detail["statusText"] = lingbuilder_fbro_process_detail::JsonUtf8(status);
            detail["value"] = detail.value("error", "");
            detail["code"] = eventCode;
            event["data"] = std::move(detail);
        } else if (eventCode == LB_FBRO_EVENT_VIP_LIFECYCLE && lifecycleDetail.is_object()) {
            lifecycleDetail["code"] = eventCode;
            event["data"] = std::move(lifecycleDetail);
        } else if ((eventCode == LB_FBRO_EVENT_DOWNLOAD_START
            || eventCode == LB_FBRO_EVENT_DOWNLOAD_UPDATED) && fields.is_object()) {
            Json detail = fields;
            detail["code"] = eventCode;
            event["data"] = std::move(detail);
        } else {
            event["data"] = Json{{"value", lingbuilder_fbro_process_detail::JsonUtf8(value)}, {"code", eventCode}};
        }
        self->Send(event);
    }

    void ExecuteRequest(const Json& request) {
        const std::wstring requestId = lingbuilder_fbro_process_detail::JsonWide(request, "requestId");
        const std::wstring method = lingbuilder_fbro_process_detail::JsonWide(request, "method");
        const bool notification = request.value("notification", false);
        const Json payload = request.value("payload", Json::object());
        Json result = Json::object();
        bool ok = browser_ != 0;
        std::wstring error;
        if (method == L"close") {
            ok = true;
        } else if (!browser_) {
            error = L"FBro 浏览器尚未创建。";
        } else if (method == L"navigate") {
            ok = LB_FBro_Navigate(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "url").c_str()) > 0;
        } else if (method == L"back") ok = LB_FBro_GoBack(browser_) > 0;
        else if (method == L"forward") ok = LB_FBro_GoForward(browser_) > 0;
        else if (method == L"reload") ok = LB_FBro_Reload(browser_) > 0;
        else if (method == L"reloadIgnoreCache") ok = LB_FBro_ReloadIgnoreCache(browser_) > 0;
        else if (method == L"stop") ok = LB_FBro_Stop(browser_) > 0;
        else if (method == L"canGoBack") result["value"] = LB_FBro_CanGoBack(browser_) > 0;
        else if (method == L"canGoForward") result["value"] = LB_FBro_CanGoForward(browser_) > 0;
        else if (method == L"isLoading") result["value"] = LB_FBro_IsLoading(browser_) > 0;
        else if (method == L"getTitle" || method == L"getUrl") {
            std::vector<wchar_t> buffer(65536, L'\0');
            ok = (method == L"getTitle" ? LB_FBro_GetTitle(browser_, buffer.data(), buffer.size())
                                         : LB_FBro_GetUrl(browser_, buffer.data(), buffer.size())) > 0;
            result["value"] = lingbuilder_fbro_process_detail::JsonUtf8(buffer.data());
        } else if (method == L"executeJavaScript") {
            std::vector<wchar_t> buffer(1024 * 1024, L'\0');
            ok = LB_FBro_ExecuteJs(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "script").c_str(),
                buffer.data(), buffer.size()) > 0;
            result["value"] = lingbuilder_fbro_process_detail::JsonUtf8(buffer.data());
        } else if (method == L"getCookies") {
            std::vector<wchar_t> buffer(1024 * 1024, L'\0');
            ok = LB_FBro_GetCookies(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "url").c_str(),
                buffer.data(), buffer.size()) > 0;
            result["value"] = lingbuilder_fbro_process_detail::JsonUtf8(buffer.data());
        } else if (method == L"visitCookies") {
            const bool allSites = payload.value("allSites", false);
            const std::wstring url = lingbuilder_fbro_process_detail::JsonWide(payload, "url");
            const LB_FBRO_TASK_HANDLE task = allSites
                ? LB_FBro_CookieVisitAllAsync(browser_, nullptr, nullptr)
                : LB_FBro_CookieVisitUrlAsync(browser_, url.c_str(), 1, nullptr, nullptr);
            const int waitResult = task ? LB_FBro_TaskWait(task, 30000) : LB_FBRO_ERROR_OPERATION_FAILED;
            std::vector<wchar_t> buffer(4 * 1024 * 1024, L'\0');
            ok = task && waitResult == LB_FBRO_OK && LB_FBro_TaskGetResult(task, buffer.data(), buffer.size()) > 0;
            if (ok) {
                Json cookies = lingbuilder_fbro_process_detail::ParseJson(buffer.data());
                ok = cookies.is_array();
                if (ok) result["cookies"] = std::move(cookies);
                else error = L"FBro 返回了无效的 Cookie JSON。";
            }
            if (!ok && error.empty() && task) {
                std::vector<wchar_t> taskError(32768, L'\0');
                if (LB_FBro_TaskGetError(task, taskError.data(), taskError.size()) > 0) error = taskError.data();
            }
            if (task) LB_FBro_TaskRelease(task);
        } else if (method == L"setCookieJson") {
            const std::wstring url = lingbuilder_fbro_process_detail::JsonWide(payload, "url");
            const Json cookie = payload.value("cookie", Json::object());
            if (url.empty() || !cookie.is_object()) {
                ok = false;
                error = L"Cookie 地址或结构化记录无效。";
            } else {
                const std::wstring cookieJson = lingbuilder_fbro_process_detail::JsonText(cookie);
                const LB_FBRO_TASK_HANDLE task = LB_FBro_CookieSetJsonAsync(browser_, url.c_str(), cookieJson.c_str(), nullptr, nullptr);
                ok = task && LB_FBro_TaskWait(task, 30000) == LB_FBRO_OK;
                if (!ok && task) {
                    std::vector<wchar_t> taskError(32768, L'\0');
                    if (LB_FBro_TaskGetError(task, taskError.data(), taskError.size()) > 0) error = taskError.data();
                }
                if (task) LB_FBro_TaskRelease(task);
                result["value"] = ok;
            }
        } else if (method == L"clearCache") {
            const uint32_t removeFlags = payload.value("includeCookies", false)
                ? 0xFFFFFFFFU : (0xFFFFFFFFU & ~2U);
            const LB_FBRO_TASK_HANDLE task = LB_FBro_ClearCacheAsync(browser_, L"", removeFlags, 0xFFFFFFFFU, nullptr, nullptr);
            ok = task && LB_FBro_TaskWait(task, 60000) == LB_FBRO_OK;
            if (!ok && task) {
                std::vector<wchar_t> taskError(32768, L'\0');
                if (LB_FBro_TaskGetError(task, taskError.data(), taskError.size()) > 0) error = taskError.data();
            }
            if (task) LB_FBro_TaskRelease(task);
            result["value"] = ok;
        } else if (method == L"setCookie") {
            const std::wstring url = lingbuilder_fbro_process_detail::JsonWide(payload, "url");
            const std::wstring name = lingbuilder_fbro_process_detail::JsonWide(payload, "name");
            const std::wstring value = lingbuilder_fbro_process_detail::JsonWide(payload, "value");
            const std::wstring domain = lingbuilder_fbro_process_detail::JsonWide(payload, "domain");
            const std::wstring path = lingbuilder_fbro_process_detail::JsonWide(payload, "path", L"/");
            if (url.empty() || name.empty()) {
                ok = false;
                error = L"Cookie 地址和名称不能为空。";
            } else {
                const LB_FBRO_TASK_HANDLE task = LB_FBro_CookieSetAsync(browser_, url.c_str(), name.c_str(), value.c_str(),
                    domain.c_str(), path.empty() ? L"/" : path.c_str(),
                    payload.value("secure", false) ? 1 : 0,
                    payload.value("httpOnly", false) ? 1 : 0, nullptr, nullptr);
                const int waitResult = task ? LB_FBro_TaskWait(task, 30000) : LB_FBRO_ERROR_OPERATION_FAILED;
                ok = task && waitResult == LB_FBRO_OK;
                if (!ok && task) {
                    std::vector<wchar_t> taskError(32768, L'\0');
                    if (LB_FBro_TaskGetError(task, taskError.data(), taskError.size()) > 0 && taskError[0]) {
                        error = taskError.data();
                    }
                }
                if (task) LB_FBro_TaskRelease(task);
                if (ok) {
                    const LB_FBRO_TASK_HANDLE flushTask = LB_FBro_CookieFlushAsync(browser_, nullptr, nullptr);
                    const int flushResult = flushTask ? LB_FBro_TaskWait(flushTask, 30000) : LB_FBRO_ERROR_OPERATION_FAILED;
                    ok = flushTask && flushResult == LB_FBRO_OK;
                    if (!ok && flushTask) {
                        std::vector<wchar_t> flushError(32768, L'\0');
                        if (LB_FBro_TaskGetError(flushTask, flushError.data(), flushError.size()) > 0 && flushError[0]) {
                            error = flushError.data();
                        }
                    }
                    if (flushTask) LB_FBro_TaskRelease(flushTask);
                }
                if (ok) {
                    bool verified = false;
                    std::vector<wchar_t> cookieBuffer(1024 * 1024, L'\0');
                    const auto verifyDeadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
                    while (std::chrono::steady_clock::now() < verifyDeadline && !verified) {
                        std::fill(cookieBuffer.begin(), cookieBuffer.end(), L'\0');
                        if (LB_FBro_GetCookies(browser_, url.c_str(), cookieBuffer.data(), cookieBuffer.size()) > 0) {
                            const std::wstring cookies(cookieBuffer.data());
                            size_t start = 0;
                            while (start <= cookies.size() && !verified) {
                                const size_t end = cookies.find(L';', start);
                                std::wstring pair = cookies.substr(start,
                                    end == std::wstring::npos ? std::wstring::npos : end - start);
                                while (!pair.empty() && iswspace(pair.front())) pair.erase(pair.begin());
                                while (!pair.empty() && iswspace(pair.back())) pair.pop_back();
                                const size_t equals = pair.find(L'=');
                                verified = equals != std::wstring::npos
                                    && pair.substr(0, equals) == name
                                    && pair.substr(equals + 1) == value;
                                if (end == std::wstring::npos) break;
                                start = end + 1;
                            }
                        }
                        if (!verified) Sleep(100);
                    }
                    ok = verified;
                    if (!ok) error = L"Cookie 写入未在当前独立会话中生效。";
                }
                result["value"] = ok;
            }
        } else if (method == L"getZoom") {
            double value = 0; ok = LB_FBro_GetZoomLevel(browser_, &value) > 0; result["value"] = value;
        } else if (method == L"setZoom") ok = LB_FBro_SetZoomLevel(browser_, payload.value("value", 0.0)) > 0;
        else if (method == L"isMuted") result["value"] = LB_FBro_IsAudioMuted(browser_) > 0;
        else if (method == L"setMuted") ok = LB_FBro_SetAudioMuted(browser_, payload.value("value", false) ? 1 : 0) > 0;
        else if (method == L"focus") ok = LB_FBro_SetFocus(browser_, payload.value("value", true) ? 1 : 0) > 0;
        else if (method == L"setProxy") ok = LB_FBro_SetProxy(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "value").c_str(), L"", L"") > 0;
        else if (method == L"setUserAgent") ok = LB_FBro_SetUserAgent(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "value").c_str()) > 0;
        else if (method == L"applyFingerprint") ok = LB_FBro_ApplyFingerprintJson(browser_, lingbuilder_fbro_process_detail::JsonWide(payload, "value").c_str()) > 0;
        else if (method == L"show") {
            ok = SetWindowPos(browserWindow_, HWND_TOP, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW) != FALSE;
            if (ok) LB_FBro_Resize(browser_);
        }
        else if (method == L"hide") {
            ok = SetWindowPos(browserWindow_, nullptr, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_HIDEWINDOW) != FALSE;
        }
        else if (method == L"resize") {
            const int width = (std::max)(1, payload.value("width", 1));
            const int height = (std::max)(1, payload.value("height", 1));
            int windowWidth = width;
            int windowHeight = height;
            if (mode_ == LING_FBRO_PROCESS_WINDOW) {
                RECT adjusted{0, 0, width, height};
                AdjustWindowRectEx(&adjusted, static_cast<DWORD>(GetWindowLongPtrW(browserWindow_, GWL_STYLE)), FALSE,
                    static_cast<DWORD>(GetWindowLongPtrW(browserWindow_, GWL_EXSTYLE)));
                windowWidth = adjusted.right - adjusted.left;
                windowHeight = adjusted.bottom - adjusted.top;
            }
            ok = SetWindowPos(browserWindow_, nullptr, 0, 0, windowWidth, windowHeight,
                SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE) != FALSE;
            if (ok) LB_FBro_Resize(browser_);
        } else if (method == L"screenshotToFile") {
            const std::wstring path = lingbuilder_fbro_process_detail::JsonWide(payload, "path");
            const std::wstring format = lingbuilder_fbro_process_detail::JsonWide(payload, "format", L"png");
            const int quality = (std::max)(1, (std::min)(100, payload.value("quality", 90)));
            const std::filesystem::path outputPath(path);
            const std::filesystem::path parentDirectory = outputPath.parent_path();
            std::error_code directoryError;
            if (!parentDirectory.empty()) std::filesystem::create_directories(parentDirectory, directoryError);
            if (directoryError) error = L"无法创建截图输出目录。";
            const LB_FBRO_TASK_HANDLE task = error.empty()
                ? LB_FBro_CaptureScreenshotAsync(browser_, format.c_str(), quality,
                    0, 0, 0, 0, 1, 1, 1, nullptr, nullptr)
                : 0;
            ok = error.empty() && task && LB_FBro_TaskWait(task, 30000) == LB_FBRO_TASK_COMPLETED;
            if (ok) {
                const LB_FBRO_BUFFER_HANDLE buffer = LB_FBro_TaskGetBuffer(task);
                ok = buffer && LB_FBro_BufferSaveFile(buffer, path.c_str()) > 0;
                if (buffer) LB_FBro_BufferRelease(buffer);
            }
            if (task) LB_FBro_TaskRelease(task);
            result["path"] = lingbuilder_fbro_process_detail::JsonUtf8(path);
        } else {
            ok = false;
            error = L"FBro 独立进程模式暂不支持命令：" + method;
        }
        if (!ok && error.empty()) error = ReadBridgeError();
        Json response = Envelope("response");
        response["requestId"] = lingbuilder_fbro_process_detail::JsonUtf8(requestId);
        response["ok"] = ok;
        response["result"] = result;
        response["error"] = lingbuilder_fbro_process_detail::JsonUtf8(error);
        if (!notification) Send(response);
        if (method == L"close") {
            if (browser_) { LB_FBro_Close(browser_); browser_ = 0; }
            PostMessageW(commandWindow_, WM_CLOSE, 0, 0);
        }
    }

    std::wstring ReadBridgeError() const {
        if (!browser_) return L"FBro 浏览器句柄无效。";
        std::vector<wchar_t> buffer(32768, L'\0');
        return LB_FBro_GetLastError(browser_, buffer.data(), buffer.size()) > 0
            ? std::wstring(buffer.data()) : L"FBro 命令执行失败。";
    }

    bool ValidateExtensionDirectory(const std::wstring& directory, std::wstring& error) const {
        if (directory.empty()) return false;
        const std::filesystem::path root(directory);
        std::error_code filesystemError;
        if (!root.is_absolute() || !std::filesystem::is_directory(root, filesystemError) || filesystemError) {
            error = L"插件目录不存在或不可访问。";
            return false;
        }
        const std::filesystem::path manifestPath = root / L"manifest.json";
        if (!std::filesystem::is_regular_file(manifestPath, filesystemError) || filesystemError) {
            error = L"插件目录缺少 manifest.json。";
            return false;
        }
        std::ifstream stream(manifestPath, std::ios::binary);
        Json manifest = Json::parse(stream, nullptr, false);
        if (!manifest.is_object()) {
            error = L"插件 manifest.json 不是合法 UTF-8 JSON。";
            return false;
        }
        const int manifestVersion = manifest.value("manifest_version", 0);
        if ((manifestVersion != 2 && manifestVersion != 3)
            || !manifest.contains("name") || !manifest["name"].is_string()
            || !manifest.contains("version") || !manifest["version"].is_string()) {
            error = manifestVersion != 2 && manifestVersion != 3
                ? L"插件 manifest_version 不受支持。" : L"插件清单缺少 name 或 version。";
            return false;
        }
        return true;
    }

    void SendExtensionState(const std::wstring& status, const std::wstring& error) {
        Json event = Envelope("event");
        event["event"] = "ExtensionState";
        event["data"] = Json{
            {"statusText", lingbuilder_fbro_process_detail::JsonUtf8(status)},
            {"error", lingbuilder_fbro_process_detail::JsonUtf8(error)},
            {"value", lingbuilder_fbro_process_detail::JsonUtf8(error)}
        };
        Send(event);
    }

    bool VerifyExtensionLoaded(std::wstring& error) {
        if (!browser_ || extensionDirectory_.empty() || extensionId_.empty()) {
            error = L"插件路径或扩展 ID 无效。";
            return false;
        }
        const Json args = {{"extensionId", lingbuilder_fbro_process_detail::JsonUtf8(extensionId_)}};
        const std::wstring argsJson = lingbuilder_fbro_process_detail::JsonText(args);
        const LB_FBRO_TASK_HANDLE task = LB_FBro_VipExtensionCommandAsync(
            browser_, L"getExtensionPath", argsJson.c_str(), nullptr, nullptr);
        const int waitResult = task ? LB_FBro_TaskWait(task, 10000)
            : LB_FBRO_ERROR_OPERATION_FAILED;
        std::vector<wchar_t> buffer(32768, L'\0');
        const bool completed = task && waitResult == LB_FBRO_OK
            && LB_FBro_TaskGetResult(task, buffer.data(), buffer.size()) > 0;
        std::wstring reportedPath;
        if (completed) {
            const Json result = lingbuilder_fbro_process_detail::ParseJson(buffer.data());
            reportedPath = result.is_object()
                ? lingbuilder_fbro_process_detail::JsonWide(result, "value") : L"";
        }
        if (!completed && task) {
            std::vector<wchar_t> taskError(32768, L'\0');
            if (LB_FBro_TaskGetError(task, taskError.data(), taskError.size()) > 0) {
                error = taskError.data();
            }
        }
        if (task) LB_FBro_TaskRelease(task);
        if (reportedPath.empty()) {
            if (error.empty()) error = L"FBro 未返回已加载插件路径。";
            return false;
        }
        const auto expected = std::filesystem::absolute(extensionDirectory_).lexically_normal();
        const auto actual = std::filesystem::absolute(reportedPath).lexically_normal();
        if (expected != actual) {
            error = L"FBro 返回的插件路径与部署路径不一致。";
            return false;
        }
        return true;
    }

    Json Envelope(const char* type) const {
        return Json{
            {"protocol", "lingbuilder.fbro.host"},
            {"version", LINGBUILDER_FBRO_PROCESS_PROTOCOL_VERSION},
            {"type", type},
            {"instanceId", lingbuilder_fbro_process_detail::JsonUtf8(instanceId_)},
            {"generation", generation_}
        };
    }

    void SendError(const std::wstring& error) {
        Json event = Envelope("event");
        event["event"] = "Error";
        event["data"] = Json{{"value", lingbuilder_fbro_process_detail::JsonUtf8(error)}};
        Send(event);
    }

    void Send(const Json& message) {
        const std::wstring text = lingbuilder_fbro_process_detail::JsonText(message);
        if (!text.empty() && connection_) client_.SendText(connection_, text.c_str());
    }

    void Shutdown() {
        if (browser_) { LB_FBro_Close(browser_); browser_ = 0; }
        if (initialized_) { LB_FBro_Shutdown(); initialized_ = false; }
        client_.Shutdown();
        if (controllerProcess_) { CloseHandle(controllerProcess_); controllerProcess_ = nullptr; }
        if (browserWindow_ && IsWindow(browserWindow_)) DestroyWindow(browserWindow_);
    }

    HINSTANCE instance_ = nullptr;
    HWND commandWindow_ = nullptr;
    HWND browserWindow_ = nullptr;
    HANDLE controllerProcess_ = nullptr;
    unsigned long controllerPid_ = 0;
    unsigned long long generation_ = 0;
    int debuggingPort_ = 0;
    int mode_ = LING_FBRO_PROCESS_EMBEDDED;
    bool initialized_ = false;
    LB_FBRO_HANDLE browser_ = 0;
    LingWebSocketClientRuntime client_;
    long long connection_ = 0;
    std::wstring endpoint_;
    std::wstring token_;
    std::wstring instanceId_;
    std::wstring extensionStatus_ = L"未配置";
    std::wstring extensionError_;
    std::wstring extensionDirectory_;
    std::wstring extensionId_;
};

inline void LB_FBroProcess_EnableDpiAwareness() {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (!user32) return;
    using SetProcessDpiAwarenessContextProc = BOOL (WINAPI*)(HANDLE);
    auto setProcessDpiAwarenessContext = reinterpret_cast<SetProcessDpiAwarenessContextProc>(
        GetProcAddress(user32, "SetProcessDpiAwarenessContext")
    );
    if (setProcessDpiAwarenessContext
        && setProcessDpiAwarenessContext(reinterpret_cast<HANDLE>(static_cast<intptr_t>(-4)))) return;
    using SetProcessDPIAwareProc = BOOL (WINAPI*)();
    auto setProcessDpiAware = reinterpret_cast<SetProcessDPIAwareProc>(
        GetProcAddress(user32, "SetProcessDPIAware")
    );
    if (setProcessDpiAware) setProcessDpiAware();
}

inline int LB_FBroProcess_RunHostIfRequested(HINSTANCE instance) {
    if (lingbuilder_fbro_process_detail::EnvironmentValue(L"LINGBUILDER_FBRO_HOST") != L"1") {
        return LINGBUILDER_FBRO_HOST_NOT_REQUESTED;
    }
    LB_FBroProcess_EnableDpiAwareness();
    SetEnvironmentVariableW(L"LINGBUILDER_FBRO_HOST", nullptr);
    return LingFbroHostRuntime::Instance().Run(instance);
}
