import type { InstalledModule } from '../modules/types';
import { ARIA2_MODULE_ID } from '../modules/aria2Module';

export function generateAria2Runtime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === ARIA2_MODULE_ID)) return '';
  return ARIA2_RUNTIME;
}

const ARIA2_RUNTIME = String.raw`
#include <atomic>
#include <algorithm>
#include <cwctype>
#include <filesystem>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace LingAria2 {
enum class State { Downloading, Completed, Failed, Stopped };

struct Task {
    long long id = 0;
    HANDLE process = nullptr;
    HANDLE job = nullptr;
    HWND notificationWindow = nullptr;
    std::wstring progressHandler;
    std::wstring outputPath;
    std::mutex mutex;
    State state = State::Downloading;
    int progress = 0;
    unsigned long long totalBytes = 0;
    unsigned long long downloadedBytes = 0;
    unsigned long long reportedBytesPerSecond = 0;
    ULONGLONG lastReportedSpeedTick = 0;
    unsigned long long lastSampleBytes = 0;
    ULONGLONG lastSampleTick = 0;
    unsigned long long bytesPerSecond = 0;
    ULONGLONG lastProgressEventTick = 0;
    bool progressEventQueued = false;
    bool stopRequested = false;
    std::wstring detail;

    ~Task() {
        if (process) CloseHandle(process);
        if (job) CloseHandle(job);
    }
};

static std::mutex g_mutex;
static std::unordered_map<long long, std::shared_ptr<Task>> g_tasks;
static std::atomic<long long> g_nextId{1};
static constexpr UINT ProgressMessage = WM_APP + 0x57;

struct ProgressSnapshot {
    std::wstring handler;
    long long task = 0;
    int progress = 0;
    long long downloadedBytes = 0;
    long long totalBytes = 0;
    long long bytesPerSecond = 0;
    std::wstring state;
};

static bool ContainsControl(const std::wstring& value) {
    for (wchar_t character : value) if (character < 32) return true;
    return false;
}

static std::wstring ToLower(std::wstring value) {
    for (wchar_t& character : value) character = static_cast<wchar_t>(towlower(character));
    return value;
}

static bool IsAllowedAddress(const std::wstring& value) {
    if (value.empty() || ContainsControl(value)) return false;
    const std::wstring lowered = ToLower(value);
    return lowered.rfind(L"https://", 0) == 0 || lowered.rfind(L"http://", 0) == 0
        || lowered.rfind(L"ftp://", 0) == 0 || lowered.rfind(L"ftps://", 0) == 0
        || lowered.rfind(L"magnet:?", 0) == 0;
}

static std::wstring QuoteArgument(const std::wstring& value) {
    std::wstring result = L"\"";
    size_t slashes = 0;
    for (wchar_t character : value) {
        if (character == L'\\') { ++slashes; continue; }
        if (character == L'\"') result.append(slashes * 2 + 1, L'\\');
        else result.append(slashes, L'\\');
        result.push_back(character);
        slashes = 0;
    }
    result.append(slashes * 2, L'\\');
    result.push_back(L'\"');
    return result;
}

static std::wstring ExecutablePath() {
    std::wstring buffer(MAX_PATH, L'\0');
    for (;;) {
        const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
        if (!length) return L"";
        if (length < buffer.size() - 1) {
            buffer.resize(length);
            const size_t separator = buffer.find_last_of(L"\\/");
            return separator == std::wstring::npos ? L"aria2c.exe" : buffer.substr(0, separator + 1) + L"aria2c.exe";
        }
        buffer.resize(buffer.size() * 2);
    }
}

static unsigned long long FileSize(const std::wstring& file) {
    try {
        const auto size = std::filesystem::file_size(std::filesystem::path(file));
        return size > 0 ? static_cast<unsigned long long>(size) : 0;
    } catch (...) {
        return 0;
    }
}

static bool ParseByteQuantity(const std::wstring& text, size_t start, unsigned long long* value, size_t* end = nullptr) {
    if (!value || start >= text.size()) return false;
    while (start < text.size() && iswspace(text[start])) ++start;
    const size_t numberStart = start;
    bool decimal = false;
    while (start < text.size() && (iswdigit(text[start]) || (!decimal && text[start] == L'.'))) {
        if (text[start] == L'.') decimal = true;
        ++start;
    }
    if (start == numberStart) return false;
    const double amount = wcstod(text.substr(numberStart, start - numberStart).c_str(), nullptr);
    const size_t unitStart = start;
    while (start < text.size() && iswalpha(text[start])) ++start;
    std::wstring unit = ToLower(text.substr(unitStart, start - unitStart));
    unsigned long long multiplier = 1;
    if (unit == L"k" || unit == L"kb" || unit == L"kib") multiplier = 1024ULL;
    else if (unit == L"m" || unit == L"mb" || unit == L"mib") multiplier = 1024ULL * 1024ULL;
    else if (unit == L"g" || unit == L"gb" || unit == L"gib") multiplier = 1024ULL * 1024ULL * 1024ULL;
    else if (!unit.empty() && unit != L"b") return false;
    if (amount < 0.0 || amount > static_cast<double>(ULLONG_MAX / multiplier)) return false;
    *value = static_cast<unsigned long long>(amount * static_cast<double>(multiplier) + 0.5);
    if (end) *end = start;
    return true;
}

static bool ParseOutputDownloadSpeed(const std::wstring& text, unsigned long long* value) {
    const size_t marker = text.rfind(L"DL:");
    return marker != std::wstring::npos && ParseByteQuantity(text, marker + 3, value);
}

static bool ParseOutputTransfer(const std::wstring& text, unsigned long long* downloaded, unsigned long long* total) {
    if (!downloaded || !total) return false;
    const size_t percent = text.rfind(L'%');
    const size_t left = percent == std::wstring::npos ? std::wstring::npos : text.rfind(L'(', percent);
    const size_t slash = left == std::wstring::npos ? std::wstring::npos : text.rfind(L'/', left);
    if (slash == std::wstring::npos) return false;
    size_t start = slash;
    while (start > 0 && (iswalnum(text[start - 1]) || text[start - 1] == L'.')) --start;
    size_t ignored = 0;
    return ParseByteQuantity(text, start, downloaded, &ignored)
        && ParseByteQuantity(text, slash + 1, total, &ignored);
}

static long long DownloadSpeed(const std::shared_ptr<Task>& task) {
    const ULONGLONG now = GetTickCount64();
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        if (task->reportedBytesPerSecond > 0
            && (task->state != State::Downloading || now - task->lastReportedSpeedTick <= 2500)) {
            return static_cast<long long>(task->reportedBytesPerSecond);
        }
    }
    const unsigned long long bytes = FileSize(task->outputPath);
    std::lock_guard<std::mutex> lock(task->mutex);
    if (task->lastSampleTick != 0 && now > task->lastSampleTick) {
        const unsigned long long delta = bytes >= task->lastSampleBytes ? bytes - task->lastSampleBytes : 0;
        const ULONGLONG elapsed = now - task->lastSampleTick;
        // File-size sampling is only a fallback: aria2 may pre-allocate or
        // write segments out of order, so stdout DL: is the authoritative rate.
        if (task->state == State::Downloading || task->lastSampleBytes == 0) {
            task->bytesPerSecond = elapsed == 0 ? task->bytesPerSecond : (delta * 1000ULL) / elapsed;
        }
    }
    if (task->state == State::Downloading) {
        task->lastSampleBytes = bytes;
        task->lastSampleTick = now;
    }
    return static_cast<long long>(task->bytesPerSecond);
}

static std::wstring Utf8ToWide(const char* data, int size) {
    if (!data || size <= 0) return L"";
    const int required = MultiByteToWideChar(CP_UTF8, 0, data, size, nullptr, 0);
    if (required <= 0) return L"";
    std::wstring result(static_cast<size_t>(required), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, data, size, result.data(), required);
    return result;
}

static void QueueProgressEvent(const std::shared_ptr<Task>& task, bool force = false) {
    HWND window = nullptr;
    long long id = 0;
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        const ULONGLONG now = GetTickCount64();
        if (task->progressHandler.empty() || !task->notificationWindow || task->progressEventQueued
            || (!force && now - task->lastProgressEventTick < 100)) return;
        task->progressEventQueued = true;
        task->lastProgressEventTick = now;
        window = task->notificationWindow;
        id = task->id;
    }
    if (!PostMessageW(window, ProgressMessage, static_cast<WPARAM>(id), 0)) {
        std::lock_guard<std::mutex> lock(task->mutex);
        task->progressEventQueued = false;
    }
}

static void UpdateProgress(const std::shared_ptr<Task>& task, const std::wstring& text) {
    unsigned long long reportedSpeed = 0;
    const bool hasReportedSpeed = ParseOutputDownloadSpeed(text, &reportedSpeed);
    unsigned long long downloaded = 0;
    unsigned long long total = 0;
    const bool hasTransfer = ParseOutputTransfer(text, &downloaded, &total);
    {
    std::lock_guard<std::mutex> lock(task->mutex);
    const size_t left = text.rfind(L'(');
    const size_t percent = left == std::wstring::npos ? std::wstring::npos : text.find(L'%', left + 1);
    if (percent != std::wstring::npos) {
        const std::wstring digits = text.substr(left + 1, percent - left - 1);
        const int value = _wtoi(digits.c_str());
        if (value >= 0 && value <= 100) task->progress = std::max(task->progress, value);
    }
    if (hasTransfer) {
        task->downloadedBytes = std::max(task->downloadedBytes, downloaded);
        task->totalBytes = std::max(task->totalBytes, total);
    }
    if (hasReportedSpeed) {
        task->reportedBytesPerSecond = reportedSpeed;
        task->lastReportedSpeedTick = GetTickCount64();
    }
    if (!text.empty()) task->detail = text.size() > 4096 ? text.substr(text.size() - 4096) : text;
    }
    QueueProgressEvent(task);
}

static std::wstring StateLabel(State state) {
    switch (state) {
        case State::Completed: return L"已完成";
        case State::Failed: return L"已失败";
        case State::Stopped: return L"已停止";
        default: return L"下载中";
    }
}

static std::shared_ptr<Task> Find(long long id) {
    std::lock_guard<std::mutex> lock(g_mutex);
    const auto found = g_tasks.find(id);
    return found == g_tasks.end() ? nullptr : found->second;
}

static bool TakeProgressSnapshot(long long id, ProgressSnapshot* snapshot) {
    if (!snapshot) return false;
    const auto task = Find(id);
    if (!task) return false;
    std::lock_guard<std::mutex> lock(task->mutex);
    task->progressEventQueued = false;
    if (task->progressHandler.empty()) return false;
    snapshot->handler = task->progressHandler;
    snapshot->task = task->id;
    snapshot->progress = task->progress;
    snapshot->downloadedBytes = static_cast<long long>(task->downloadedBytes);
    snapshot->totalBytes = static_cast<long long>(task->totalBytes);
    snapshot->bytesPerSecond = static_cast<long long>(task->reportedBytesPerSecond > 0 ? task->reportedBytesPerSecond : task->bytesPerSecond);
    snapshot->state = StateLabel(task->state);
    return true;
}

static void ReadOutput(const std::shared_ptr<Task>& task, HANDLE pipe) {
    char bytes[2048];
    std::string pending;
    DWORD read = 0;
    while (ReadFile(pipe, bytes, static_cast<DWORD>(sizeof(bytes)), &read, nullptr) && read > 0) {
        pending.append(bytes, bytes + read);
        while (true) {
            const size_t lineEnd = pending.find_first_of("\r\n");
            if (lineEnd == std::string::npos) break;
            UpdateProgress(task, Utf8ToWide(pending.data(), static_cast<int>(lineEnd)));
            const size_t next = pending.find_first_not_of("\r\n", lineEnd);
            if (next == std::string::npos) { pending.clear(); break; }
            pending.erase(0, next);
        }
        if (pending.size() > 8192) {
            UpdateProgress(task, Utf8ToWide(pending.data(), static_cast<int>(pending.size())));
            pending.clear();
        }
    }
    if (!pending.empty()) UpdateProgress(task, Utf8ToWide(pending.data(), static_cast<int>(pending.size())));
    CloseHandle(pipe);

    WaitForSingleObject(task->process, INFINITE);
    DWORD exitCode = 1;
    GetExitCodeProcess(task->process, &exitCode);
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        if (task->stopRequested) {
            task->state = State::Stopped;
            if (task->detail.empty()) task->detail = L"下载任务已停止。";
        } else if (exitCode == 0) {
            task->state = State::Completed;
            task->progress = 100;
            task->downloadedBytes = FileSize(task->outputPath);
            task->totalBytes = task->downloadedBytes;
            task->detail.clear();
        } else {
            task->state = State::Failed;
            if (task->detail.empty()) task->detail = L"aria2c 下载失败，退出码：" + std::to_wstring(exitCode) + L"。";
        }
    }
    QueueProgressEvent(task, true);
}

static long long Start(HWND notificationWindow, const wchar_t* address, const wchar_t* directory, const wchar_t* fileName, int connections, int splitMb, const wchar_t* progressHandler) {
    const std::wstring url = address ? address : L"";
    std::wstring targetDirectory = directory ? directory : L"";
    const std::wstring targetName = fileName ? fileName : L"";
    if (!IsAllowedAddress(url) || targetDirectory.empty() || ContainsControl(targetDirectory)) return 0;
    const std::filesystem::path namePath(targetName);
    if (targetName.empty() || ContainsControl(targetName) || namePath.filename() != namePath || targetName == L"." || targetName == L"..") return 0;
    if (connections < 1 || connections > 16 || splitMb < 1 || splitMb > 64) return 0;

    const std::wstring aria2c = ExecutablePath();
    if (aria2c.empty() || GetFileAttributesW(aria2c.c_str()) == INVALID_FILE_ATTRIBUTES) return 0;
    try {
        const std::filesystem::path directoryPath = std::filesystem::absolute(std::filesystem::path(targetDirectory));
        std::filesystem::create_directories(directoryPath);
        targetDirectory = directoryPath.wstring();
    } catch (...) {
        return 0;
    }

    const std::vector<std::wstring> arguments = {
        aria2c, L"--continue=true", L"--allow-overwrite=true", L"--auto-file-renaming=false",
        L"--file-allocation=none", L"--max-connection-per-server=" + std::to_wstring(connections),
        L"--split=" + std::to_wstring(connections), L"--min-split-size=" + std::to_wstring(splitMb) + L"M",
        L"--max-tries=5", L"--retry-wait=2", L"--timeout=60", L"--connect-timeout=30",
        L"--check-certificate=true", L"--summary-interval=1", L"--console-log-level=notice",
        L"--enable-color=false", L"--dir=" + targetDirectory, L"--out=" + targetName, url
    };
    std::wstring commandLine;
    for (const std::wstring& argument : arguments) {
        if (!commandLine.empty()) commandLine.push_back(L' ');
        commandLine += QuoteArgument(argument);
    }
    if (commandLine.size() >= 32000) return 0;

    SECURITY_ATTRIBUTES attributes{sizeof(attributes), nullptr, TRUE};
    HANDLE outputRead = nullptr;
    HANDLE outputWrite = nullptr;
    if (!CreatePipe(&outputRead, &outputWrite, &attributes, 0)) return 0;
    SetHandleInformation(outputRead, HANDLE_FLAG_INHERIT, 0);
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    startup.wShowWindow = SW_HIDE;
    startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    startup.hStdOutput = outputWrite;
    startup.hStdError = outputWrite;
    PROCESS_INFORMATION process{};
    std::vector<wchar_t> mutableCommand(commandLine.begin(), commandLine.end());
    mutableCommand.push_back(L'\0');
    const BOOL started = CreateProcessW(
        aria2c.c_str(), mutableCommand.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW,
        nullptr, nullptr, &startup, &process
    );
    CloseHandle(outputWrite);
    if (!started) {
        CloseHandle(outputRead);
        return 0;
    }
    CloseHandle(process.hThread);

    HANDLE job = CreateJobObjectW(nullptr, nullptr);
    if (job) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof(limits));
        if (!AssignProcessToJobObject(job, process.hProcess)) {
            CloseHandle(job);
            job = nullptr;
        }
    }

    auto task = std::make_shared<Task>();
    task->id = g_nextId.fetch_add(1);
    task->process = process.hProcess;
    task->job = job;
    task->notificationWindow = notificationWindow;
    task->progressHandler = progressHandler ? progressHandler : L"";
    task->outputPath = (std::filesystem::path(targetDirectory) / namePath).wstring();
    task->lastSampleTick = GetTickCount64();
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_tasks[task->id] = task;
    }
    std::thread(ReadOutput, task, outputRead).detach();
    QueueProgressEvent(task, true);
    return task->id;
}

static bool Wait(long long id, int timeoutMs) {
    const auto task = Find(id);
    if (!task || timeoutMs < 0) return false;
    const DWORD result = WaitForSingleObject(task->process, static_cast<DWORD>(timeoutMs));
    if (result != WAIT_OBJECT_0) return false;
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        // The process can signal just before the detached output reader records
        // its final state. Resolve that small window deterministically for callers.
        if (task->state == State::Downloading) {
            DWORD exitCode = 1;
            GetExitCodeProcess(task->process, &exitCode);
            if (task->stopRequested) {
                task->state = State::Stopped;
            } else if (exitCode == 0) {
                task->state = State::Completed;
                task->progress = 100;
                task->downloadedBytes = FileSize(task->outputPath);
                task->totalBytes = task->downloadedBytes;
                task->detail.clear();
            } else {
                task->state = State::Failed;
                if (task->detail.empty()) task->detail = L"aria2c 下载失败，退出码：" + std::to_wstring(exitCode) + L"。";
            }
        }
    }
    QueueProgressEvent(task, true);
    std::lock_guard<std::mutex> lock(task->mutex);
    return task->state == State::Completed;
}

static bool Stop(long long id) {
    const auto task = Find(id);
    if (!task) return false;
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        if (task->state != State::Downloading) return false;
        task->stopRequested = true;
        if (!TerminateProcess(task->process, ERROR_CANCELLED)) {
            task->detail = L"停止下载任务失败。";
            return false;
        }
        task->state = State::Stopped;
    }
    QueueProgressEvent(task, true);
    return true;
}

static bool Release(long long id) {
    std::shared_ptr<Task> task;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        const auto found = g_tasks.find(id);
        if (found == g_tasks.end()) return false;
        task = found->second;
        g_tasks.erase(found);
    }
    {
        std::lock_guard<std::mutex> lock(task->mutex);
        task->stopRequested = true;
    }
    if (task->process) TerminateProcess(task->process, ERROR_CANCELLED);
    return true;
}

static void Shutdown() {
    std::vector<std::shared_ptr<Task>> tasks;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        for (const auto& entry : g_tasks) tasks.push_back(entry.second);
        g_tasks.clear();
    }
    for (const auto& task : tasks) {
        std::lock_guard<std::mutex> lock(task->mutex);
        task->stopRequested = true;
        if (task->process) TerminateProcess(task->process, ERROR_CANCELLED);
    }
}
}

// LCPP text expressions are generated as std::wstring. Taking values here also
// keeps literals and TextBox/variable values on the same safe ABI boundary.
static long long Aria2_下载(const std::wstring& address, const std::wstring& directory, const std::wstring& fileName, int connections, int splitMb) {
    return LingAria2::Start(nullptr, address.c_str(), directory.c_str(), fileName.c_str(), connections, splitMb, nullptr);
}
// This overload is selected only by LingCpp-generated calls that include
// &下载进度. The callback is delivered by WM_APP on the owning UI thread.
static long long Aria2_下载_窗口(HWND notificationWindow, const std::wstring& address, const std::wstring& directory, const std::wstring& fileName, int connections, int splitMb, const wchar_t* progressHandler) {
    return LingAria2::Start(notificationWindow, address.c_str(), directory.c_str(), fileName.c_str(), connections, splitMb, progressHandler);
}
static bool Aria2_等待(long long task, int timeoutMs) { return LingAria2::Wait(task, timeoutMs); }
static const wchar_t* Aria2_取状态(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return L"无效任务";
    thread_local std::wstring result;
    std::lock_guard<std::mutex> lock(item->mutex);
    result = LingAria2::StateLabel(item->state);
    return result.c_str();
}
static int Aria2_取进度(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return 0;
    std::lock_guard<std::mutex> lock(item->mutex);
    return item->progress;
}
static long long Aria2_取已下载字节(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return 0;
    std::lock_guard<std::mutex> lock(item->mutex);
    return static_cast<long long>(item->downloadedBytes > 0 ? item->downloadedBytes : LingAria2::FileSize(item->outputPath));
}
static long long Aria2_取总字节(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return 0;
    std::lock_guard<std::mutex> lock(item->mutex);
    return static_cast<long long>(item->totalBytes);
}
static const wchar_t* Aria2_取错误(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return L"下载任务不存在。";
    thread_local std::wstring result;
    std::lock_guard<std::mutex> lock(item->mutex);
    result = item->state == LingAria2::State::Completed ? L"" : item->detail;
    return result.c_str();
}
static long long Aria2_取下载速度(long long task) {
    const auto item = LingAria2::Find(task);
    return item ? LingAria2::DownloadSpeed(item) : 0;
}
static const wchar_t* Aria2_取保存目录(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return L"";
    thread_local std::wstring result;
    std::lock_guard<std::mutex> lock(item->mutex);
    result = std::filesystem::path(item->outputPath).parent_path().wstring();
    return result.c_str();
}
static bool Aria2_打开目录(long long task) {
    const auto item = LingAria2::Find(task);
    if (!item) return false;
    std::wstring directory;
    {
        std::lock_guard<std::mutex> lock(item->mutex);
        directory = std::filesystem::path(item->outputPath).parent_path().wstring();
    }
    if (directory.empty()) return false;
    return reinterpret_cast<intptr_t>(ShellExecuteW(nullptr, L"open", directory.c_str(), nullptr, nullptr, SW_SHOWNORMAL)) > 32;
}
static bool Aria2_停止(long long task) { return LingAria2::Stop(task); }
static bool Aria2_释放(long long task) { return LingAria2::Release(task); }
`;
