import { InstalledModule } from '../modules/types';

export const CRON_RUNTIME_MODULE_ID = 'lingbuilder.cron';

export function generateCronRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === CRON_RUNTIME_MODULE_ID)) return '';
  return `${CRON_CORE_RUNTIME}\n\n${CRON_WIN32_ADAPTER_RUNTIME}`;
}

// 核心只持有表达式、任务登记表、owner 派发队列和守护线程，不接触 HWND/文件/注册表；
// 文件、进程执行、邮件、注册表等平台能力经 LingCronPlatform* 前向声明放在下方 Win32 适配段，
// 与 threadingRuntime.ts 的 LingThreadPlatformReportError 同构，便于后续 macOS 派发器复用。
const CRON_CORE_RUNTIME = String.raw`
static void LingCronPlatformReportError(const std::wstring& message);
static void LingCronPlatformExecuteCommand(long long jobId, const std::wstring& commandLine);
static bool LingCronPlatformReadTextFile(const std::wstring& path, std::wstring& content);
static bool LingCronPlatformWriteTextFile(const std::wstring& path, const std::wstring& content);
static std::wstring LingCronPlatformDefaultTablePath();

struct LingCronFields {
    bool hasSeconds = false;
    bool reboot = false;
    bool domWildcard = true;
    bool dowWildcard = true;
    std::vector<char> seconds;  // 60
    std::vector<char> minutes;  // 60
    std::vector<char> hours;    // 24
    std::vector<char> days;     // 32（下标 1~31）
    std::vector<char> months;   // 13（下标 1~12）
    std::vector<char> weekdays; // 8（下标 0~7，0 与 7 都是周日）
};

class LingCronRuntime {
public:
    struct PendingDispatch {
        std::wstring handlerName;
        long long taskId = 0;
    };

    struct MailConfig {
        std::wstring host;
        int port = 0;
        std::wstring user;
        std::wstring password;
        std::wstring to;
        bool valid = false;
    };

    static LingCronRuntime& Instance() {
        static LingCronRuntime runtime;
        return runtime;
    }

    // ---------- 表达式解析 ----------

    std::shared_ptr<LingCronFields> ParseExpression(const std::wstring& text, std::wstring& error) const {
        std::wstring trimmed = Trim(text);
        if (trimmed.empty()) { error = L"cron 表达式不能为空。"; return nullptr; }
        auto fields = std::make_shared<LingCronFields>();
        std::wstring lowered = ToLower(trimmed);
        if (lowered.rfind(L"@", 0) == 0) {
            static const std::pair<const wchar_t*, const wchar_t*> aliases[] = {
                { L"@yearly", L"0 0 1 1 *" }, { L"@annually", L"0 0 1 1 *" },
                { L"@monthly", L"0 0 1 * *" }, { L"@weekly", L"0 0 * * 0" },
                { L"@daily", L"0 0 * * *" }, { L"@midnight", L"0 0 * * *" },
                { L"@hourly", L"0 * * * *" } };
            for (const auto& alias : aliases) {
                if (lowered == alias.first) { trimmed = alias.second; lowered = alias.second; break; }
            }
            if (lowered == L"@reboot") { fields->reboot = true; return fields; }
            if (lowered.rfind(L"@", 0) == 0) { error = L"不支持的 cron 简写：" + trimmed + L"。支持 @yearly/@monthly/@weekly/@daily/@hourly/@reboot。"; return nullptr; }
        }
        const std::vector<std::wstring> parts = SplitFields(trimmed);
        if (parts.size() != 5 && parts.size() != 6) {
            error = L"cron 表达式必须为 5 段（分 时 日 月 周）或 6 段（秒 分 时 日 月 周），当前是 " + std::to_wstring(parts.size()) + L" 段。";
            return nullptr;
        }
        size_t index = 0;
        if (parts.size() == 6) {
            fields->hasSeconds = true;
            if (!ParseField(parts[index++], 0, 59, false, fields->seconds, error)) return nullptr;
        } else {
            fields->seconds.assign(60, 1);
        }
        if (!ParseField(parts[index++], 0, 59, false, fields->minutes, error)) return nullptr;
        if (!ParseField(parts[index++], 0, 23, false, fields->hours, error)) return nullptr;
        if (!ParseField(parts[index++], 1, 31, false, fields->days, error)) return nullptr;
        if (!ParseField(parts[index++], 1, 12, false, fields->months, error)) return nullptr;
        if (!ParseField(parts[index++], 0, 7, true, fields->weekdays, error)) return nullptr;
        if (fields->weekdays[7]) fields->weekdays[0] = 1;
        fields->domWildcard = IsFullRange(fields->days, 1, 31);
        fields->dowWildcard = IsFullRange(fields->weekdays, 0, 6);
        return fields;
    }

    std::wstring ExpressionError(const std::wstring& text) const {
        std::wstring error;
        ParseExpression(text, error);
        return error;
    }

    bool ValidateExpression(const std::wstring& text) const {
        std::wstring error;
        return ParseExpression(text, error) != nullptr;
    }

    // ---------- 下次触发时间（本地时钟；日与周同时受限时命中其一即触发） ----------

    time_t NextFireTime(const LingCronFields& fields, time_t from) const {
        if (fields.reboot) return 0;
        std::tm current = {};
        localtime_s(&current, &from);
        current.tm_isdst = -1;
        if (fields.hasSeconds) current.tm_sec += 1;
        else { current.tm_sec = 0; current.tm_min += 1; }
        if (std::mktime(&current) == -1) return 0;
        for (int guard = 0; guard < 2000000; ++guard) {
            if (!fieldAt(fields.months, current.tm_mon + 1)) {
                current.tm_mon += 1; current.tm_mday = 1; current.tm_hour = 0; current.tm_min = 0; current.tm_sec = 0; current.tm_isdst = -1;
                if (std::mktime(&current) == -1) return 0;
                continue;
            }
            if (!DayMatches(fields, current)) {
                current.tm_mday += 1; current.tm_hour = 0; current.tm_min = 0; current.tm_sec = 0; current.tm_isdst = -1;
                if (std::mktime(&current) == -1) return 0;
                continue;
            }
            if (!fieldAt(fields.hours, current.tm_hour)) {
                current.tm_min = 0; current.tm_sec = 0; current.tm_hour += 1; current.tm_isdst = -1;
                if (std::mktime(&current) == -1) return 0;
                continue;
            }
            if (!fieldAt(fields.minutes, current.tm_min)) {
                current.tm_sec = 0; current.tm_min += 1; current.tm_isdst = -1;
                if (std::mktime(&current) == -1) return 0;
                continue;
            }
            if (fields.hasSeconds && !fieldAt(fields.seconds, current.tm_sec)) {
                current.tm_sec += 1; current.tm_isdst = -1;
                if (std::mktime(&current) == -1) return 0;
                continue;
            }
            return std::mktime(&current);
        }
        return 0;
    }

    std::wstring DescribeExpression(const std::wstring& text) const {
        std::wstring error;
        auto fields = ParseExpression(text, error);
        if (!fields) return L"";
        if (fields->reboot) return L"注册/守护启动时立即触发一次";
        std::wstring scope;
        if (!fields->domWildcard && fields->dowWildcard) scope = L"每月 " + NumberList(fields->days, 1, 31) + L" 日";
        else if (fields->domWildcard && !fields->dowWildcard) scope = L"每周" + WeekdayList(fields->weekdays);
        else if (!fields->domWildcard && !fields->dowWildcard) scope = L"每月 " + NumberList(fields->days, 1, 31) + L" 日或每周" + WeekdayList(fields->weekdays);
        else scope = L"每天";
        const bool minuteWild = IsFullRange(fields->minutes, 0, 59);
        const bool hourWild = IsFullRange(fields->hours, 0, 23);
        std::wstring result;
        if (minuteWild && hourWild) result = L"每分钟";
        else if (hourWild) result = L"每小时第 " + NumberList(fields->minutes, 0, 59) + L" 分";
        else if (minuteWild) result = NumberList(fields->hours, 0, 23) + L" 点的每一分";
        else {
            const std::wstring moment = Pad2(FirstSet(fields->hours, 0)) + L":" + Pad2(FirstSet(fields->minutes, 0));
            result = scope == L"每天" ? L"每天 " + moment : scope + L" " + moment;
        }
        if (!IsFullRange(fields->months, 1, 12)) result += L"，仅 " + NumberList(fields->months, 1, 12) + L" 月";
        if (fields->hasSeconds) result += L"（秒级）";
        return result;
    }

    // ---------- 任务登记 ----------

    long long StartHandlerJob(long long ownerId, const std::wstring& expression, const std::wstring& handlerName) {
        return RegisterJob(ownerId, expression, handlerName, L"", L"", 0);
    }

    long long StartWorkerJob(long long ownerId, const std::wstring& expression, const std::wstring& workerName, const std::wstring& completionName) {
        if (Trim(workerName).empty()) return FailId(L"cron_定时_提交线程 的工作处理器不能为空。");
        return RegisterJob(ownerId, expression, completionName, workerName, L"", 1);
    }

    long long StartCommandJob(const std::wstring& expression, const std::wstring& commandLine) {
        if (Trim(commandLine).empty()) { Fail(L"cron 命令型任务的命令行不能为空。"); return 0; }
        return RegisterJob(0, expression, L"", L"", commandLine, 2);
    }

    bool Stop(long long jobId) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        if (found == jobs_.end() || found->second->stopped) return Fail(L"定时任务不存在或已停止。");
        found->second->stopped = true;
        return true;
    }

    int StopAll() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        int count = 0;
        for (auto& pair : jobs_) {
            if (!pair.second->stopped) { pair.second->stopped = true; ++count; }
        }
        return count;
    }

    bool Pause(long long jobId) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        if (found == jobs_.end() || found->second->stopped) return Fail(L"定时任务不存在或已停止。");
        found->second->paused = true;
        return true;
    }

    bool Resume(long long jobId) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        if (found == jobs_.end() || found->second->stopped) return Fail(L"定时任务不存在或已停止。");
        if (!found->second->paused) return true;
        found->second->paused = false;
        found->second->nextFire = NextFireTime(*found->second->fields, std::time(nullptr));
        return true;
    }

    bool IsRunning(long long jobId) const {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        return found != jobs_.end() && !found->second->stopped && !found->second->paused;
    }

    std::wstring StatusName(long long jobId) const {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        if (found == jobs_.end()) return L"不存在";
        if (found->second->stopped) return L"已停止";
        if (found->second->paused) return L"已暂停";
        return L"等待中";
    }

    std::wstring NextFireText(long long jobId) const {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = jobs_.find(jobId);
        if (found == jobs_.end() || found->second->stopped || found->second->paused) return L"";
        return FormatLocalTime(found->second->nextFire);
    }

    bool FireNow(long long jobId) {
        std::shared_ptr<CronJob> job;
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            auto found = jobs_.find(jobId);
            if (found == jobs_.end() || found->second->stopped) return Fail(L"定时任务不存在或已停止。");
            job = found->second;
        }
        DispatchJob(job);
        return true;
    }

    int JobCount() const {
        std::lock_guard<std::mutex> lock(registryMutex_);
        int count = 0;
        for (const auto& pair : jobs_) if (!pair.second->stopped) ++count;
        return count;
    }

    std::wstring LastError() const {
        std::lock_guard<std::mutex> lock(errorMutex_);
        return lastError_;
    }

    void SetLastErrorPublic(const std::wstring& message) const {
        std::lock_guard<std::mutex> lock(errorMutex_);
        lastError_ = message;
        LingCronPlatformReportError(message);
    }

    // ---------- owner（注册窗口） ----------

    long long RegisterOwner(std::function<void(long long)> notify, std::function<void(const std::wstring&)> workerDispatcher) {
        auto owner = std::make_shared<Owner>();
        owner->id = NewId(9);
        owner->notify = std::move(notify);
        owner->workerDispatcher = std::move(workerDispatcher);
        std::lock_guard<std::mutex> lock(registryMutex_);
        owners_[owner->id] = owner;
        return owner->id;
    }

    void ShutdownOwner(long long ownerId) {
        std::shared_ptr<Owner> owner;
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            auto found = owners_.find(ownerId);
            if (found == owners_.end()) return;
            owner = found->second;
        }
        {
            std::lock_guard<std::mutex> ownerLock(owner->mutex);
            owner->alive = false;
            owner->pending.clear();
        }
        // 与 threading 运行时同口径：等运行中的 cron 工作处理器退出后才允许窗口销毁继续。
        {
            std::unique_lock<std::mutex> ownerLock(owner->mutex);
            owner->idle.wait(ownerLock, [&]() { return owner->running == 0; });
        }
        std::lock_guard<std::mutex> lock(registryMutex_);
        for (auto& pair : jobs_) {
            if (pair.second->ownerId == ownerId && !pair.second->stopped) pair.second->stopped = true;
        }
        owners_.erase(ownerId);
    }

    std::vector<PendingDispatch> DrainOwner(long long ownerId) {
        std::vector<PendingDispatch> result;
        std::shared_ptr<Owner> owner = FindOwner(ownerId);
        if (!owner) return result;
        std::lock_guard<std::mutex> lock(owner->mutex);
        if (!owner->alive) return result;
        result.assign(owner->pending.begin(), owner->pending.end());
        owner->pending.clear();
        return result;
    }

    // ---------- 调度 ----------

    void Tick() {
        const time_t now = std::time(nullptr);
        std::vector<std::shared_ptr<CronJob>> due;
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            for (auto& pair : jobs_) {
                auto& job = pair.second;
                if (job->stopped || job->paused) continue;
                if (now < job->nextFire) continue;
                const time_t next = NextFireTime(*job->fields, now);
                job->nextFire = next;
                if (next == 0) job->stopped = true;
                due.push_back(job);
            }
        }
        for (const auto& job : due) DispatchJob(job);
    }

    bool DaemonStart() {
        std::lock_guard<std::mutex> lock(daemonMutex_);
        if (daemonRunning_) return Fail(L"cron 守护已在运行。");
        daemonStop_ = false;
        daemonRunning_ = true;
        try {
            daemonThread_ = std::thread([this]() {
                while (!daemonStop_.load()) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(500));
                    if (!daemonStop_.load()) Tick();
                }
            });
        } catch (...) {
            daemonRunning_ = false;
            return Fail(L"无法创建 cron 守护线程。");
        }
        return true;
    }

    bool DaemonStop() {
        std::lock_guard<std::mutex> lock(daemonMutex_);
        if (!daemonRunning_) return Fail(L"cron 守护未在运行。");
        daemonStop_ = true;
        if (daemonThread_.joinable() && daemonThread_.get_id() != std::this_thread::get_id()) daemonThread_.join();
        daemonRunning_ = false;
        return true;
    }

    bool DaemonRunning() const { return daemonRunning_; }

    // ---------- 邮件配置 ----------

    void SetMailConfig(const MailConfig& config) {
        std::lock_guard<std::mutex> lock(mailMutex_);
        mail_ = config;
    }

    MailConfig Mail() const {
        std::lock_guard<std::mutex> lock(mailMutex_);
        return mail_;
    }

    void SetTableMailTo(const std::wstring& mailTo) {
        std::lock_guard<std::mutex> lock(mailMutex_);
        tableMailTo_ = mailTo;
    }

    std::wstring TableMailTo() const {
        std::lock_guard<std::mutex> lock(mailMutex_);
        return tableMailTo_;
    }

private:
    struct CronJob {
        long long id = 0;
        long long ownerId = 0;
        int kind = 0; // 0=到点处理器（UI 线程） 1=工作处理器（后台线程+完成派发） 2=命令型
        bool stopped = false;
        bool paused = false;
        std::shared_ptr<LingCronFields> fields;
        std::wstring handlerName;
        std::wstring workerName;
        std::wstring commandLine;
        time_t nextFire = 0;
    };

    struct Owner {
        long long id = 0;
        bool alive = true;
        int running = 0;
        std::function<void(long long)> notify;
        std::function<void(const std::wstring&)> workerDispatcher;
        std::mutex mutex;
        std::condition_variable idle;
        std::deque<PendingDispatch> pending;
    };

    long long RegisterJob(long long ownerId, const std::wstring& expression, const std::wstring& handlerName, const std::wstring& workerName, const std::wstring& commandLine, int kind) {
        std::wstring error;
        auto fields = ParseExpression(expression, error);
        if (!fields) { Fail(error); return 0; }
        if (Trim(handlerName).empty() && kind != 2) { Fail(L"cron_定时_启动 的处理器不能为空。"); return 0; }
        auto job = std::make_shared<CronJob>();
        job->id = NewId(3);
        job->ownerId = ownerId;
        job->kind = kind;
        job->fields = fields;
        job->handlerName = handlerName;
        job->workerName = workerName;
        job->commandLine = commandLine;
        if (fields->reboot) {
            // @reboot：立即触发一次，任务登记为已停止以便 ID 仍可查询状态。
            job->stopped = true;
            {
                std::lock_guard<std::mutex> lock(registryMutex_);
                jobs_[job->id] = job;
            }
            DispatchJob(job);
            return job->id;
        }
        job->nextFire = NextFireTime(*fields, std::time(nullptr));
        if (job->nextFire == 0) { Fail(L"该 cron 表达式在未来几年内没有可触发的时刻，请检查日/月/周字段。"); return 0; }
        std::lock_guard<std::mutex> lock(registryMutex_);
        jobs_[job->id] = job;
        return job->id;
    }

    void DispatchJob(const std::shared_ptr<CronJob>& job) {
        if (job->kind == 2) {
            std::thread([job]() {
                try { LingCronPlatformExecuteCommand(job->id, job->commandLine); }
                catch (...) { LingCronPlatformReportError(L"命令任务线程发生未知异常。"); }
            }).detach();
            return;
        }
        auto owner = FindOwner(job->ownerId);
        if (!owner) return;
        if (job->kind == 0) {
            QueueDispatch(owner, job->handlerName, job->id);
            return;
        }
        // 工作处理器：后台线程执行；结束后把完成处理器排回注册窗口的 UI 派发队列。
        const std::wstring workerName = job->workerName;
        const std::wstring completionName = job->handlerName;
        const long long taskId = job->id;
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            if (!owner->alive) return;
            if (!owner->workerDispatcher) { LingCronPlatformReportError(L"无窗口宿主不能执行 cron 工作处理器，请改用命令型任务。"); return; }
            ++owner->running;
        }
        std::thread([this, owner, workerName, completionName, taskId]() {
            try { owner->workerDispatcher(workerName); }
            catch (...) { LingCronPlatformReportError(L"cron 工作处理器发生未知异常。"); }
            {
                std::lock_guard<std::mutex> lock(owner->mutex);
                --owner->running;
                if (owner->running == 0) owner->idle.notify_all();
            }
            QueueDispatch(owner, completionName, taskId);
        }).detach();
    }

    void QueueDispatch(const std::shared_ptr<Owner>& owner, const std::wstring& handlerName, long long taskId) {
        std::function<void(long long)> notify;
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            if (!owner->alive) return;
            owner->pending.push_back(PendingDispatch{ handlerName, taskId });
            notify = owner->notify;
        }
        if (notify) notify(owner->id);
    }

    std::shared_ptr<Owner> FindOwner(long long id) const {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = owners_.find(id);
        return found == owners_.end() ? nullptr : found->second;
    }

    long long NewId(unsigned char kind) { return static_cast<long long>((nextSequence_.fetch_add(1) << 8) | kind); }
    bool Fail(const std::wstring& message) const {
        std::lock_guard<std::mutex> lock(errorMutex_);
        lastError_ = message;
        LingCronPlatformReportError(message);
        return false;
    }
    long long FailId(const std::wstring& message) { Fail(message); return 0; }

    static std::wstring Trim(const std::wstring& text) {
        size_t begin = 0; size_t end = text.size();
        while (begin < end && iswspace(static_cast<wint_t>(text[begin]))) ++begin;
        while (end > begin && iswspace(static_cast<wint_t>(text[end - 1]))) --end;
        return text.substr(begin, end - begin);
    }

    static std::wstring ToLower(const std::wstring& text) {
        std::wstring result = text;
        for (wchar_t& item : result) item = static_cast<wchar_t>(towlower(static_cast<wint_t>(item)));
        return result;
    }

    static bool fieldAt(const std::vector<char>& set, int value) {
        return value >= 0 && value < static_cast<int>(set.size()) && set[static_cast<size_t>(value)] != 0;
    }

    static bool DayMatches(const LingCronFields& fields, const std::tm& current) {
        const bool domOk = fieldAt(fields.days, current.tm_mday);
        const bool dowOk = fieldAt(fields.weekdays, current.tm_wday % 7);
        if (!fields.domWildcard && !fields.dowWildcard) return domOk || dowOk;
        return domOk && dowOk;
    }

    static std::vector<std::wstring> SplitFields(const std::wstring& text) {
        std::vector<std::wstring> parts;
        std::wstring current;
        for (wchar_t item : text) {
            if (item == L' ' || item == L'\t') {
                if (!current.empty()) { parts.push_back(current); current.clear(); }
            } else {
                current += item;
            }
        }
        if (!current.empty()) parts.push_back(current);
        return parts;
    }

    static int NameValue(const std::wstring& token, const wchar_t* const* names, size_t count, bool& matched) {
        matched = false;
        std::wstring lowered = ToLower(token);
        for (size_t index = 0; index < count; ++index) {
            if (lowered == names[index]) { matched = true; return static_cast<int>(index); }
        }
        return 0;
    }

    static bool ParseNumber(const std::wstring& token, int& value) {
        if (token.empty()) return false;
        int result = 0;
        for (wchar_t item : token) {
            if (item < L'0' || item > L'9') return false;
            result = result * 10 + (item - L'0');
            if (result > 100000) return false;
        }
        value = result;
        return true;
    }

    static bool ParseField(const std::wstring& spec, int minimum, int maximum, bool allowSevenAsSunday, std::vector<char>& set, std::wstring& error) {
        set.assign(static_cast<size_t>(maximum) + 1, 0);
        static const wchar_t* monthNames[] = { L"jan", L"feb", L"mar", L"apr", L"may", L"jun", L"jul", L"aug", L"sep", L"oct", L"nov", L"dec" };
        static const wchar_t* weekNames[] = { L"sun", L"mon", L"tue", L"wed", L"thu", L"fri", L"sat" };
        const wchar_t* const* names = maximum == 12 ? monthNames : weekNames;
        const size_t nameCount = maximum == 12 ? 12 : 7;
        size_t begin = 0;
        while (begin <= spec.size()) {
            size_t comma = spec.find(L',', begin);
            if (comma == std::wstring::npos) comma = spec.size();
            const std::wstring item = spec.substr(begin, comma - begin);
            if (item.empty()) { error = L"cron 字段「" + spec + L"」存在空子项。"; return false; }
            int step = 1;
            std::wstring rangePart = item;
            const size_t slash = item.find(L'/');
            if (slash != std::wstring::npos) {
                rangePart = item.substr(0, slash);
                if (!ParseNumber(item.substr(slash + 1), step) || step < 1) { error = L"cron 字段「" + spec + L"」的步进必须是不小于 1 的整数。"; return false; }
            }
            int low = minimum;
            int high = maximum;
            bool wildcard = false;
            if (rangePart == L"*") {
                wildcard = true;
            } else {
                const size_t dash = rangePart.find(L'-');
                if (dash != std::wstring::npos) {
                    std::wstring left = rangePart.substr(0, dash);
                    std::wstring right = rangePart.substr(dash + 1);
                    if (!ParseBound(left, minimum, maximum, names, nameCount, allowSevenAsSunday, low)
                        || !ParseBound(right, minimum, maximum, names, nameCount, allowSevenAsSunday, high)) {
                        error = L"cron 字段「" + spec + L"」含有无法识别的取值。"; return false;
                    }
                } else {
                    if (!ParseBound(rangePart, minimum, maximum, names, nameCount, allowSevenAsSunday, low)) {
                        error = L"cron 字段「" + spec + L"」含有无法识别的取值。"; return false;
                    }
                    high = rangePart == L"*" ? maximum : low;
                    if (slash == std::wstring::npos) high = low;
                }
            }
            if (low < minimum || high > maximum || low > high) {
                error = L"cron 字段「" + spec + L"」的取值超出范围 " + std::to_wstring(minimum) + L"~" + std::to_wstring(maximum) + L"。";
                return false;
            }
            for (int value = wildcard ? minimum : low; value <= (wildcard ? maximum : high); value += step) {
                set[static_cast<size_t>(value)] = 1;
                if (allowSevenAsSunday && value == 7) set[0] = 1;
            }
            if (comma == spec.size()) break;
            begin = comma + 1;
        }
        return true;
    }

    static bool ParseBound(const std::wstring& token, int minimum, int maximum, const wchar_t* const* names, size_t nameCount, bool allowSeven, int& value) {
        int parsed = 0;
        if (ParseNumber(token, parsed)) {
            if (allowSeven && parsed == 7) { value = 7; return true; }
            if (parsed < minimum || parsed > maximum) return false;
            value = parsed;
            return true;
        }
        bool matched = false;
        const int named = NameValue(token, names, nameCount, matched);
        if (!matched) return false;
        value = maximum == 7 ? named : named + 1; // 月份名 jan=0 → 1；周名 sun=0 → 0
        return true;
    }

    static bool IsFullRange(const std::vector<char>& set, int minimum, int maximum) {
        for (int value = minimum; value <= maximum; ++value) {
            if (!fieldAt(set, value)) return false;
        }
        return true;
    }

    static int FirstSet(const std::vector<char>& set, int minimum) {
        for (size_t index = static_cast<size_t>(minimum); index < set.size(); ++index) {
            if (set[index]) return static_cast<int>(index);
        }
        return minimum;
    }

    static std::wstring NumberList(const std::vector<char>& set, int minimum, int maximum) {
        std::wstring result;
        int runBegin = -1;
        for (int value = minimum; value <= maximum + 1; ++value) {
            const bool present = value <= maximum && fieldAt(set, value);
            if (present && runBegin < 0) runBegin = value;
            if (!present && runBegin >= 0) {
                if (!result.empty()) result += L",";
                if (value - runBegin >= 3) result += std::to_wstring(runBegin) + L"-" + std::to_wstring(value - 1);
                else {
                    for (int item = runBegin; item < value; ++item) {
                        if (item != runBegin) result += L",";
                        result += std::to_wstring(item);
                    }
                }
                runBegin = -1;
            }
        }
        return result;
    }

    static std::wstring WeekdayList(const std::vector<char>& set) {
        static const wchar_t* names[] = { L"日", L"一", L"二", L"三", L"四", L"五", L"六" };
        std::wstring result;
        for (int value = 0; value <= 6; ++value) {
            if (fieldAt(set, value)) result += names[value];
        }
        return result.empty() ? L"" : L"周" + result;
    }

    static std::wstring Pad2(int value) {
        if (value < 0) value = 0;
        if (value > 99) value = 99;
        const std::wstring text = std::to_wstring(value);
        return text.size() < 2 ? L"0" + text : text;
    }

    static std::wstring FormatLocalTime(time_t value) {
        if (value <= 0) return L"";
        std::tm current = {};
        localtime_s(&current, &value);
        std::wstring result;
        result += std::to_wstring(current.tm_year + 1900) + L"-";
        result += Pad2(current.tm_mon + 1) + L"-";
        result += Pad2(current.tm_mday) + L" ";
        result += Pad2(current.tm_hour) + L":";
        result += Pad2(current.tm_min) + L":";
        result += Pad2(current.tm_sec);
        return result;
    }

    mutable std::mutex registryMutex_;
    mutable std::mutex errorMutex_;
    mutable std::mutex mailMutex_;
    std::mutex daemonMutex_;
    mutable std::wstring lastError_;
    std::unordered_map<long long, std::shared_ptr<CronJob>> jobs_;
    std::unordered_map<long long, std::shared_ptr<Owner>> owners_;
    std::atomic<unsigned long long> nextSequence_ { 1 };
    std::atomic<bool> daemonStop_ { false };
    std::atomic<bool> daemonRunning_ { false };
    std::thread daemonThread_;
    MailConfig mail_;
    std::wstring tableMailTo_;
};`;

const CRON_WIN32_ADAPTER_RUNTIME = String.raw`
// Win32 适配段：错误输出、表文件、命令执行（cmd.exe /c + 管道捕获 + MAILTO 通知）、
// 守护互斥体与开机自启（当前用户 Run 键）。核心段不接触这些平台能力。
static void LingCronPlatformReportError(const std::wstring& message) {
    const std::wstring line = L"LingBuilder 定时任务：" + message + L"\n";
    OutputDebugStringW(line.c_str());
}

static const wchar_t* LingCronReturnText(std::wstring value) {
    static thread_local std::vector<std::wstring> slots(4);
    static thread_local size_t index = 0;
    std::wstring& slot = slots[index++ % slots.size()];
    slot = std::move(value);
    return slot.c_str();
}

static bool LingCronEnsureSockets() {
    static bool initialized = false;
    static bool ok = false;
    static std::once_flag flag;
    std::call_once(flag, []() {
        WSADATA data = {};
        ok = WSAStartup(MAKEWORD(2, 2), &data) == 0;
        initialized = true;
    });
    (void)initialized;
    return ok;
}

static bool LingCronMkdirs(const std::wstring& directory) {
    if (directory.empty()) return false;
    std::wstring current = directory;
    for (wchar_t& item : current) if (item == L'/') item = L'\\';
    size_t position = 0;
    while (position < current.size()) {
        const size_t slash = current.find(L'\\', position);
        const std::wstring part = current.substr(0, slash == std::wstring::npos ? current.size() : slash);
        if (!part.empty() && part.find(L':') == std::wstring::npos && part != L".") {
            if (!CreateDirectoryW(part.c_str(), nullptr) && GetLastError() != ERROR_ALREADY_EXISTS) return false;
        }
        if (slash == std::wstring::npos) break;
        position = slash + 1;
    }
    return true;
}

static std::wstring LingCronDirectoryOf(const std::wstring& path) {
    const size_t slash = path.find_last_of(L"\\/");
    return slash == std::wstring::npos ? std::wstring() : path.substr(0, slash);
}

static bool LingCronPlatformReadTextFile(const std::wstring& path, std::wstring& content) {
    HANDLE handle = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return false;
    std::string bytes;
    char buffer[4096];
    DWORD read = 0;
    while (ReadFile(handle, buffer, sizeof(buffer), &read, nullptr) && read > 0) bytes.append(buffer, read);
    CloseHandle(handle);
    if (bytes.size() >= 3 && static_cast<unsigned char>(bytes[0]) == 0xEF && static_cast<unsigned char>(bytes[1]) == 0xBB && static_cast<unsigned char>(bytes[2]) == 0xBF) bytes.erase(0, 3);
    content = LingCppUtf8ToWide(bytes.c_str());
    return true;
}

static bool LingCronPlatformWriteTextFile(const std::wstring& path, const std::wstring& content) {
    const std::wstring directory = LingCronDirectoryOf(path);
    if (!directory.empty() && !LingCronMkdirs(directory)) return false;
    HANDLE handle = CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_READ, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return false;
    const std::string utf8 = std::string("\xEF\xBB\xBF") + LingCppWideToUtf8(content);
    DWORD written = 0;
    const bool ok = WriteFile(handle, utf8.data(), static_cast<DWORD>(utf8.size()), &written, nullptr) && written == utf8.size();
    CloseHandle(handle);
    return ok;
}

static std::wstring LingCronPlatformDefaultTablePath() {
    wchar_t appData[MAX_PATH] = {};
    if (SHGetFolderPathW(nullptr, CSIDL_APPDATA, nullptr, 0, appData) != S_OK || !appData[0]) {
        DWORD size = GetEnvironmentVariableW(L"APPDATA", appData, MAX_PATH);
        if (size == 0 || size >= MAX_PATH) return L"";
    }
    std::wstring path = std::wstring(appData) + L"\\LingBuilder\\cron\\crontab.txt";
    LingCronMkdirs(LingCronDirectoryOf(path));
    return path;
}

static std::wstring LingCronResolveTablePath(const wchar_t* path) {
    const std::wstring given = path ? path : L"";
    if (!given.empty()) return given;
    return LingCronPlatformDefaultTablePath();
}

static std::vector<std::wstring> LingCronSplitLines(const std::wstring& content) {
    std::vector<std::wstring> lines;
    std::wstring current;
    for (wchar_t item : content) {
        if (item == L'\n') { lines.push_back(current); current.clear(); }
        else if (item != L'\r') current += item;
    }
    lines.push_back(current);
    return lines;
}

static std::wstring LingCronJoinLines(const std::vector<std::wstring>& lines) {
    std::wstring result;
    for (const std::wstring& line : lines) { result += line; result += L"\r\n"; }
    return result;
}

static const wchar_t* cron_定时_表路径() {
    return LingCronReturnText(LingCronPlatformDefaultTablePath());
}

static const wchar_t* cron_定时_表读取(const wchar_t* path = nullptr) {
    std::wstring content;
    if (!LingCronPlatformReadTextFile(LingCronResolveTablePath(path), content)) return LingCronReturnText(L"");
    return LingCronReturnText(content);
}

static bool cron_定时_表保存(const wchar_t* content, const wchar_t* path = nullptr) {
    return LingCronPlatformWriteTextFile(LingCronResolveTablePath(path), content ? std::wstring(content) : std::wstring());
}

static bool cron_定时_表添加(const wchar_t* expression, const wchar_t* commandLine, const wchar_t* comment = nullptr, const wchar_t* path = nullptr) {
    const std::wstring expr = expression ? expression : L"";
    const std::wstring command = commandLine ? commandLine : L"";
    std::wstring error;
    if (!LingCronRuntime::Instance().ParseExpression(expr, error)) { LingCronRuntime::Instance().SetLastErrorPublic(error); return false; }
    if (command.empty()) { LingCronRuntime::Instance().SetLastErrorPublic(L"crontab 表添加的命令行不能为空。"); return false; }
    const std::wstring tablePath = LingCronResolveTablePath(path);
    std::wstring content;
    LingCronPlatformReadTextFile(tablePath, content);
    if (!content.empty() && content.back() != L'\n') content += L"\r\n";
    const std::wstring note = comment ? comment : L"";
    if (!note.empty()) content += L"# " + note + L"\r\n";
    content += expr + L" " + command + L"\r\n";
    return LingCronPlatformWriteTextFile(tablePath, content);
}

static bool cron_定时_表删除(int lineNo, const wchar_t* path = nullptr) {
    if (lineNo < 1) return false;
    const std::wstring tablePath = LingCronResolveTablePath(path);
    std::wstring content;
    if (!LingCronPlatformReadTextFile(tablePath, content)) return false;
    std::vector<std::wstring> lines = LingCronSplitLines(content);
    int dataLine = 0;
    for (size_t index = 0; index < lines.size(); ++index) {
        const std::wstring trimmed = lines[index];
        size_t begin = 0; size_t end = trimmed.size();
        while (begin < end && iswspace(static_cast<wint_t>(trimmed[begin]))) ++begin;
        while (end > begin && iswspace(static_cast<wint_t>(trimmed[end - 1]))) --end;
        const bool blank = begin >= end;
        const bool comment = !blank && trimmed[begin] == L'#';
        if (blank || comment) continue;
        ++dataLine;
        if (dataLine == lineNo) { lines.erase(lines.begin() + static_cast<ptrdiff_t>(index)); return LingCronPlatformWriteTextFile(tablePath, LingCronJoinLines(lines)); }
    }
    return false;
}

static bool cron_定时_表清空(const wchar_t* path = nullptr) {
    return LingCronPlatformWriteTextFile(LingCronResolveTablePath(path), L"");
}

struct LingCronTableLine {
    std::wstring expression;
    std::wstring command;
};

// crontab 行分词：@简写行取第 1 个词为表达式；普通行先按 5 个词尝试（分钟粒度），
// 失败再按 6 个词尝试（秒级）；余下部分整体作为命令行保留其中的空格。
static bool LingCronSplitTableLine(const std::wstring& line, LingCronTableLine& result) {
    std::vector<std::pair<size_t, size_t>> tokens;
    size_t position = 0;
    while (position < line.size()) {
        while (position < line.size() && iswspace(static_cast<wint_t>(line[position]))) ++position;
        if (position >= line.size()) break;
        const size_t begin = position;
        while (position < line.size() && !iswspace(static_cast<wint_t>(line[position]))) ++position;
        tokens.emplace_back(begin, position - begin);
    }
    if (tokens.empty()) return false;
    if (line[tokens[0].first] == L'@') {
        if (tokens.size() < 2) return false;
        result.expression = line.substr(tokens[0].first, tokens[0].second);
        size_t commandBegin = tokens[1].first;
        result.command = line.substr(commandBegin);
        return true;
    }
    for (const size_t fieldCount : { static_cast<size_t>(6), static_cast<size_t>(5) }) {
        if (tokens.size() <= fieldCount) continue;
        std::wstring expression;
        for (size_t index = 0; index < fieldCount; ++index) {
            if (index > 0) expression += L' ';
            expression += line.substr(tokens[index].first, tokens[index].second);
        }
        result.expression = expression;
        result.command = line.substr(tokens[fieldCount].first);
        std::wstring error;
        if (LingCronRuntime::Instance().ParseExpression(expression, error)) return true;
    }
    return false;
}

static int cron_定时_表载入运行(const wchar_t* path = nullptr) {
    std::wstring content;
    if (!LingCronPlatformReadTextFile(LingCronResolveTablePath(path), content)) return 0;
    int registered = 0;
    std::wstring errors;
    LingCronRuntime::Instance().SetTableMailTo(L"");
    for (const std::wstring& rawLine : LingCronSplitLines(content)) {
        size_t begin = 0; size_t end = rawLine.size();
        while (begin < end && iswspace(static_cast<wint_t>(rawLine[begin]))) ++begin;
        while (end > begin && iswspace(static_cast<wint_t>(rawLine[end - 1]))) --end;
        if (begin >= end) continue;
        const std::wstring line = rawLine.substr(begin, end - begin);
        if (line[0] == L'#') continue;
        if (line.rfind(L"MAILTO=", 0) == 0 || line.rfind(L"mailto=", 0) == 0) {
            LingCronRuntime::Instance().SetTableMailTo(line.substr(7));
            continue;
        }
        LingCronTableLine parsed;
        if (!LingCronSplitTableLine(line, parsed)) {
            errors += L"cron 表行无法识别（行：" + line.substr(0, 40) + L"）。";
            continue;
        }
        const long long jobId = LingCronRuntime::Instance().StartCommandJob(parsed.expression, parsed.command);
        if (jobId != 0) ++registered;
        else errors += LingCronRuntime::Instance().LastError();
    }
    if (!errors.empty()) LingCronRuntime::Instance().SetLastErrorPublic(errors);
    return registered;
}

static bool cron_定时_守护启动() {
    static HANDLE daemonMutex = nullptr;
    if (LingCronRuntime::Instance().DaemonRunning()) return false;
    if (!daemonMutex) {
        const std::wstring tablePath = LingCronPlatformDefaultTablePath();
        unsigned long long hash = 1469598103934665603ULL;
        for (wchar_t item : tablePath) { hash ^= static_cast<unsigned long long>(item); hash *= 1099511628211ULL; }
        wchar_t name[64] = {};
        swprintf_s(name, L"Local\\LingBuilderCronDaemon_%016llX", hash);
        daemonMutex = CreateMutexW(nullptr, TRUE, name);
        if (daemonMutex && GetLastError() == ERROR_ALREADY_EXISTS) {
            LingCronRuntime::Instance().SetLastErrorPublic(L"另一个进程已启动同一张系统表的 cron 守护，本进程不重复启动。");
            ReleaseMutex(daemonMutex);
            CloseHandle(daemonMutex);
            daemonMutex = nullptr;
            return false;
        }
    }
    cron_定时_表载入运行(nullptr);
    return LingCronRuntime::Instance().DaemonStart();
}

static bool cron_定时_守护停止() {
    const bool ok = LingCronRuntime::Instance().DaemonStop();
    return ok;
}

static bool cron_定时_守护是否运行() {
    return LingCronRuntime::Instance().DaemonRunning();
}

static bool cron_定时_开机自启(bool enable) {
    wchar_t exePath[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring valueName = L"LingBuilderCron_";
    const std::wstring exe = exePath;
    const size_t slash = exe.find_last_of(L"\\/");
    std::wstring base = slash == std::wstring::npos ? exe : exe.substr(slash + 1);
    const size_t dot = base.rfind(L'.');
    if (dot != std::wstring::npos) base.resize(dot);
    for (wchar_t& item : base) {
        const bool ok = (item >= L'0' && item <= L'9') || (item >= L'A' && item <= L'Z') || (item >= L'a' && item <= L'z');
        if (!ok) item = L'_';
    }
    valueName += base;
    HKEY key = nullptr;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, nullptr, REG_OPTION_NON_VOLATILE, KEY_SET_VALUE | KEY_QUERY_VALUE, nullptr, &key, nullptr) != ERROR_SUCCESS) return false;
    bool ok = true;
    if (enable) {
        const std::wstring data = L"\"" + exe + L"\" --lingbuilder-cron-daemon";
        ok = RegSetValueExW(key, valueName.c_str(), 0, REG_SZ, reinterpret_cast<const BYTE*>(data.c_str()), static_cast<DWORD>((data.size() + 1) * sizeof(wchar_t))) == ERROR_SUCCESS;
    } else {
        RegDeleteValueW(key, valueName.c_str());
        ok = true;
    }
    RegCloseKey(key);
    return ok;
}

static bool cron_定时_是否开机自启() {
    wchar_t exePath[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring valueName = L"LingBuilderCron_";
    const std::wstring exe = exePath;
    const size_t slash = exe.find_last_of(L"\\/");
    std::wstring base = slash == std::wstring::npos ? exe : exe.substr(slash + 1);
    const size_t dot = base.rfind(L'.');
    if (dot != std::wstring::npos) base.resize(dot);
    for (wchar_t& item : base) {
        const bool ok = (item >= L'0' && item <= L'9') || (item >= L'A' && item <= L'Z') || (item >= L'a' && item <= L'z');
        if (!ok) item = L'_';
    }
    valueName += base;
    HKEY key = nullptr;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_QUERY_VALUE, &key) != ERROR_SUCCESS) return false;
    DWORD type = 0;
    const bool ok = RegQueryValueExW(key, valueName.c_str(), nullptr, &type, nullptr, nullptr) == ERROR_SUCCESS;
    RegCloseKey(key);
    return ok;
}

static bool cron_定时_邮件配置(const wchar_t* host, int port, const wchar_t* user, const wchar_t* password, const wchar_t* to) {
    LingCronRuntime::MailConfig config;
    config.host = host ? host : L"";
    config.port = port;
    config.user = user ? user : L"";
    config.password = password ? password : L"";
    config.to = to ? to : L"";
    config.valid = !config.host.empty() && !config.to.empty() && port > 0 && port <= 65535;
    LingCronRuntime::Instance().SetMailConfig(config);
    if (!config.valid) LingCronRuntime::Instance().SetLastErrorPublic(L"邮件配置无效：SMTP 服务器、端口与收件地址都不能为空。");
    return config.valid;
}

static std::string LingCronSmtpBase64(const std::string& input) {
    static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string output;
    for (size_t offset = 0; offset < input.size(); offset += 3) {
        unsigned int block = static_cast<unsigned char>(input[offset]) << 16;
        if (offset + 1 < input.size()) block |= static_cast<unsigned char>(input[offset + 1]) << 8;
        if (offset + 2 < input.size()) block |= static_cast<unsigned char>(input[offset + 2]);
        output.push_back(alphabet[(block >> 18) & 63]);
        output.push_back(alphabet[(block >> 12) & 63]);
        output.push_back(offset + 1 < input.size() ? alphabet[(block >> 6) & 63] : '=');
        output.push_back(offset + 2 < input.size() ? alphabet[block & 63] : '=');
    }
    return output;
}

static bool LingCronSmtpRead(SOCKET socket, int expectedClass, std::wstring& error) {
    std::string response;
    char buffer[4096] = {};
    int count = recv(socket, buffer, sizeof(buffer) - 1, 0);
    if (count > 0) response.append(buffer, count);
    if (response.size() < 3 || response[0] - '0' != expectedClass) {
        error = L"SMTP 会话失败：" + LingCppUtf8ToWide(response.c_str());
        return false;
    }
    return true;
}

static bool LingCronSmtpSend(SOCKET socket, const std::string& command, int expectedClass, std::wstring& error) {
    size_t sent = 0;
    while (sent < command.size()) {
        const int count = send(socket, command.data() + static_cast<int>(sent), static_cast<int>(command.size() - sent), 0);
        if (count <= 0) { error = L"SMTP 连接已中断。"; return false; }
        sent += static_cast<size_t>(count);
    }
    return LingCronSmtpRead(socket, expectedClass, error);
}

static bool LingCronSendMail(const LingCronRuntime::MailConfig& config, const std::wstring& mailTo, const std::wstring& subject, const std::wstring& body, std::wstring& error) {
    error.clear();
    if (!LingCronEnsureSockets()) { error = L"Winsock 初始化失败。"; return false; }
    ADDRINFOW hints = {};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    ADDRINFOW* addresses = nullptr;
    const std::wstring service = std::to_wstring(config.port);
    if (GetAddrInfoW(config.host.c_str(), service.c_str(), &hints, &addresses) != 0 || !addresses) { error = L"SMTP 服务器域名解析失败。"; return false; }
    SOCKET socketHandle = INVALID_SOCKET;
    for (ADDRINFOW* address = addresses; address; address = address->ai_next) {
        socketHandle = socket(address->ai_family, address->ai_socktype, address->ai_protocol);
        if (socketHandle != INVALID_SOCKET && connect(socketHandle, address->ai_addr, static_cast<int>(address->ai_addrlen)) == 0) break;
        if (socketHandle != INVALID_SOCKET) closesocket(socketHandle);
        socketHandle = INVALID_SOCKET;
    }
    FreeAddrInfoW(addresses);
    if (socketHandle == INVALID_SOCKET) { error = L"SMTP 连接失败。"; return false; }
    DWORD timeout = 30000;
    setsockopt(socketHandle, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    setsockopt(socketHandle, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    const std::string fromUtf8 = LingCppWideToUtf8(config.user.empty() ? mailTo : config.user);
    const std::string toUtf8 = LingCppWideToUtf8(mailTo);
    bool ok = LingCronSmtpRead(socketHandle, 2, error)
        && LingCronSmtpSend(socketHandle, "EHLO LingBuilder\r\n", 2, error);
    if (ok && !config.user.empty()) {
        ok = LingCronSmtpSend(socketHandle, "AUTH LOGIN\r\n", 3, error)
            && LingCronSmtpSend(socketHandle, LingCronSmtpBase64(LingCppWideToUtf8(config.user)) + "\r\n", 3, error)
            && LingCronSmtpSend(socketHandle, LingCronSmtpBase64(LingCppWideToUtf8(config.password)) + "\r\n", 2, error);
    }
    if (ok) ok = LingCronSmtpSend(socketHandle, "MAIL FROM:<" + fromUtf8 + ">\r\n", 2, error)
        && LingCronSmtpSend(socketHandle, "RCPT TO:<" + toUtf8 + ">\r\n", 2, error)
        && LingCronSmtpSend(socketHandle, "DATA\r\n", 3, error);
    if (ok) {
        std::string payload = "From: <" + fromUtf8 + ">\r\nTo: <" + toUtf8 + ">\r\n";
        payload += "Subject: =?UTF-8?B?" + LingCronSmtpBase64(LingCppWideToUtf8(subject)) + "?=\r\n";
        payload += "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n";
        // SMTP 点透传：行首的 . 补一个点，避免正文提前结束会话。
        std::string bodyUtf8 = LingCppWideToUtf8(body);
        size_t position = 0;
        while (position < bodyUtf8.size()) {
            if (bodyUtf8[position] == '.' && (position == 0 || bodyUtf8[position - 1] == '\n')) payload += '.';
            while (position < bodyUtf8.size() && bodyUtf8[position] != '\n') payload += bodyUtf8[position++];
            if (position < bodyUtf8.size()) { payload += "\r\n"; ++position; }
        }
        payload += "\r\n.\r\n";
        ok = LingCronSmtpSend(socketHandle, payload, 2, error);
    }
    if (ok) LingCronSmtpSend(socketHandle, "QUIT\r\n", 2, error);
    closesocket(socketHandle);
    return ok;
}

static bool cron_定时_邮件测试() {
    const LingCronRuntime::MailConfig config = LingCronRuntime::Instance().Mail();
    if (!config.valid) { LingCronRuntime::Instance().SetLastErrorPublic(L"尚未配置 SMTP，请先调用 cron_定时_邮件配置。"); return false; }
    const std::wstring mailTo = config.to;
    std::wstring error;
    const bool ok = LingCronSendMail(config, mailTo, L"LingBuilder cron 邮件测试", L"这是一封来自 LingBuilder 定时任务模块的测试邮件。\r\n收到即代表 SMTP 配置可用。", error);
    if (!ok) LingCronRuntime::Instance().SetLastErrorPublic(error);
    return ok;
}

static void LingCronPlatformExecuteCommand(long long jobId, const std::wstring& commandLine) {
    (void)jobId;
    SECURITY_ATTRIBUTES security = { sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE };
    HANDLE readEnd = nullptr;
    HANDLE writeEnd = nullptr;
    if (!CreatePipe(&readEnd, &writeEnd, &security, 0)) {
        LingCronRuntime::Instance().SetLastErrorPublic(L"创建命令输出管道失败。");
        return;
    }
    SetHandleInformation(writeEnd, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    HANDLE nullInput = CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, &security, OPEN_EXISTING, 0, nullptr);
    STARTUPINFOW startup = {};
    startup.cb = sizeof(STARTUPINFOW);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdInput = nullInput;
    startup.hStdOutput = writeEnd;
    startup.hStdError = writeEnd;
    PROCESS_INFORMATION process = {};
    std::wstring command = L"cmd.exe /c " + commandLine;
    const unsigned long long startedAt = GetTickCount64();
    const BOOL created = CreateProcessW(nullptr, command.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process);
    CloseHandle(writeEnd);
    if (!created) {
        if (nullInput != INVALID_HANDLE_VALUE) CloseHandle(nullInput);
        CloseHandle(readEnd);
        LingCronRuntime::Instance().SetLastErrorPublic(L"命令启动失败：" + commandLine);
        return;
    }
    std::string output;
    char buffer[4096];
    DWORD read = 0;
    for (;;) {
        if (!PeekNamedPipe(readEnd, nullptr, 0, nullptr, &read, nullptr)) break;
        if (read > 0) {
            DWORD taken = 0;
            if (!ReadFile(readEnd, buffer, sizeof(buffer), &taken, nullptr) || taken == 0) break;
            output.append(buffer, taken);
            continue;
        }
        if (WaitForSingleObject(process.hProcess, 200) != WAIT_TIMEOUT) {
            while (PeekNamedPipe(readEnd, nullptr, 0, nullptr, &read, nullptr) && read > 0) {
                DWORD taken = 0;
                if (!ReadFile(readEnd, buffer, sizeof(buffer), &taken, nullptr) || taken == 0) break;
                output.append(buffer, taken);
            }
            break;
        }
    }
    DWORD exitCode = 0;
    GetExitCodeProcess(process.hProcess, &exitCode);
    const unsigned long long elapsed = GetTickCount64() - startedAt;
    CloseHandle(readEnd);
    if (nullInput != INVALID_HANDLE_VALUE) CloseHandle(nullInput);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    const std::wstring outputText = output.empty() ? std::wstring() : LingCppUtf8ToWide(output.c_str());
    wchar_t summary[128] = {};
    swprintf_s(summary, L"[cron] 命令任务已结束，退出码 %lu，耗时 %llu 毫秒。", static_cast<unsigned long>(exitCode), elapsed);
    OutputDebugStringW(summary);
    OutputDebugStringW(L"\n");
    if (!outputText.empty()) OutputDebugStringW((outputText.substr(0, 2000) + L"\n").c_str());
    const bool failed = exitCode != 0;
    const bool hasOutput = !outputText.empty();
    if (!failed && !hasOutput) return;
    const LingCronRuntime::MailConfig config = LingCronRuntime::Instance().Mail();
    std::wstring mailTo = LingCronRuntime::Instance().TableMailTo();
    if (mailTo.empty()) mailTo = config.to;
    if (!config.valid || mailTo.empty()) return;
    std::wstring body = L"LingBuilder cron 命令任务通知\r\n\r\n命令行：" + commandLine;
    body += L"\r\n退出码：" + std::to_wstring(static_cast<unsigned long long>(exitCode));
    body += L"\r\n耗时（毫秒）：" + std::to_wstring(elapsed);
    if (!outputText.empty()) {
        body += L"\r\n\r\n任务输出：\r\n";
        body += outputText.substr(0, 60000);
    }
    std::wstring error;
    if (!LingCronSendMail(config, mailTo, L"LingBuilder cron 任务通知", body, error)) {
        LingCronRuntime::Instance().SetLastErrorPublic(L"cron 通知邮件发送失败：" + error);
    }
}

// 任务状态查询族与表达式工具族：核心能力的静态包装。
static bool cron_定时_停止(long long task) { return LingCronRuntime::Instance().Stop(task); }
static int cron_定时_停止全部() { return LingCronRuntime::Instance().StopAll(); }
static bool cron_定时_暂停(long long task) { return LingCronRuntime::Instance().Pause(task); }
static bool cron_定时_恢复(long long task) { return LingCronRuntime::Instance().Resume(task); }
static bool cron_定时_是否运行(long long task) { return LingCronRuntime::Instance().IsRunning(task); }
static const wchar_t* cron_定时_取状态(long long task) { return LingCronReturnText(LingCronRuntime::Instance().StatusName(task)); }
static const wchar_t* cron_定时_下次触发时间(long long task) { return LingCronReturnText(LingCronRuntime::Instance().NextFireText(task)); }
static bool cron_定时_立即触发(long long task) { return LingCronRuntime::Instance().FireNow(task); }
static bool cron_定时_校验表达式(const wchar_t* expression) { return LingCronRuntime::Instance().ValidateExpression(expression ? expression : L""); }
static const wchar_t* cron_定时_取表达式错误(const wchar_t* expression) { return LingCronReturnText(LingCronRuntime::Instance().ExpressionError(expression ? expression : L"")); }
static const wchar_t* cron_定时_表达式说明(const wchar_t* expression) { return LingCronReturnText(LingCronRuntime::Instance().DescribeExpression(expression ? expression : L"")); }
static int cron_定时_取任务数量() { return LingCronRuntime::Instance().JobCount(); }
static const wchar_t* cron_定时_取错误() { return LingCronReturnText(LingCronRuntime::Instance().LastError()); }

static bool LingCronCommandLineWantsDaemon() {
    return GetCommandLineW() && wcsstr(GetCommandLineW(), L"--lingbuilder-cron-daemon") != nullptr;
}
// 开机自启守护模式的全局开关 g_lingbuilderCronDaemonMode 定义在生成器模板 g_startWindowIndex 旁，
// 这里只提供检测函数与置位逻辑，避免双重定义。`;
