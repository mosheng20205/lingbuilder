import { InstalledModule } from '../modules/types';

export const THREADING_MODULE_ID = 'lingbuilder.threading';

export function generateThreadingRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === THREADING_MODULE_ID)) return '';
  return `${THREADING_CORE_RUNTIME}\n\n${THREADING_WIN32_ADAPTER_RUNTIME}`;
}

// The core owns only managed IDs, C++ synchronization objects and platform-neutral
// callbacks. HWND/PostMessageW/OutputDebugStringW live in the Win32 adapter below.
const THREADING_CORE_RUNTIME = String.raw`
static void LingThreadPlatformReportError(const std::wstring& message);

class LingThreadProjectRuntime {
public:
    static constexpr int Invalid = -1;
    static constexpr int Queued = 0;
    static constexpr int Running = 1;
    static constexpr int Succeeded = 2;
    static constexpr int Failed = 3;
    static constexpr int CancellationRequested = 4;
    static constexpr int Cancelled = 5;

    static LingThreadProjectRuntime& Instance() {
        static LingThreadProjectRuntime runtime;
        return runtime;
    }

    long long RegisterOwner(std::function<void(long long)> notify) {
        if (!notify) return 0;
        auto owner = std::make_shared<Owner>();
        owner->id = NewId(2);
        owner->notify = std::move(notify);
        std::lock_guard<std::mutex> lock(registryMutex_);
        owners_[owner->id] = owner;
        return owner->id;
    }

    void ShutdownOwner(long long ownerId) {
        auto owner = FindOwner(ownerId);
        if (!owner) return;
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            owner->alive = false;
            owner->callbacks.clear();
        }
        std::vector<std::shared_ptr<Task>> cancelled;
        std::vector<std::shared_ptr<Pool>> pools = SnapshotPools();
        for (const auto& pool : pools) {
            std::lock_guard<std::mutex> poolLock(pool->mutex);
            for (auto item = pool->queue.begin(); item != pool->queue.end();) {
                if ((*item)->ownerId == ownerId) {
                    (*item)->cancelRequested.store(true);
                    (*item)->status.store(Cancelled);
                    cancelled.push_back(*item);
                    item = pool->queue.erase(item);
                } else {
                    ++item;
                }
            }
            if (pool->queue.empty() && pool->running == 0) pool->idle.notify_all();
        }
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            for (const auto& pair : tasks_) {
                if (pair.second->ownerId == ownerId && !IsTerminal(pair.second->status.load())) {
                    pair.second->cancelRequested.store(true);
                    if (pair.second->status.load() == Running) pair.second->status.store(CancellationRequested);
                }
            }
        }
        for (const auto& task : cancelled) FinishTask(task, Cancelled, L"窗口已关闭，排队任务已取消。", false);
        std::unique_lock<std::mutex> ownerLock(owner->mutex);
        owner->idle.wait(ownerLock, [&]() { return owner->running == 0; });
        owner->callbacks.clear();
        ownerLock.unlock();
        std::lock_guard<std::mutex> lock(registryMutex_);
        owners_.erase(ownerId);
    }

    void DrainOwnerCallbacks(long long ownerId) {
        auto owner = FindOwner(ownerId);
        if (!owner) return;
        std::deque<std::function<void()>> callbacks;
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            if (!owner->alive) return;
            callbacks.swap(owner->callbacks);
        }
        for (auto& callback : callbacks) {
            try { callback(); }
            catch (...) { ReportError(L"线程 UI 回调发生未处理异常。"); }
        }
    }

    long long DefaultPool() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        if (defaultPoolId_ != 0) return defaultPoolId_;
        const int concurrency = (std::min)(8, (std::max)(1, HardwareConcurrency()));
        auto pool = std::make_shared<Pool>();
        pool->id = NewId(3);
        pool->concurrency = concurrency;
        pool->capacity = 100000;
        pool->isDefault = true;
        pools_[pool->id] = pool;
        defaultPoolId_ = pool->id;
        StartPool(pool);
        return defaultPoolId_;
    }

    long long CreatePool(int concurrency, int capacity) {
        if (concurrency < 1 || concurrency > 64) return FailId(L"线程池并发数必须在 1 到 64 之间。");
        if (capacity < 1 || capacity > 100000) return FailId(L"线程池队列容量必须在 1 到 100000 之间。");
        auto pool = std::make_shared<Pool>();
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            int customCount = 0;
            for (const auto& pair : pools_) if (!pair.second->isDefault) ++customCount;
            if (customCount >= 16) return FailIdLocked(L"一个项目最多创建 16 个自定义线程池。");
            pool->id = NewId(3);
            pool->concurrency = concurrency;
            pool->capacity = capacity;
            pools_[pool->id] = pool;
        }
        StartPool(pool);
        return pool->id;
    }

    template<class Work>
    long long Submit(long long ownerId, long long poolId, Work&& work) {
        auto task = PrepareTask(ownerId, poolId);
        if (!task) return 0;
        using WorkType = typename std::decay<Work>::type;
        task->execute = [callable = WorkType(std::forward<Work>(work))]() mutable { (void)callable(); };
        return Enqueue(task);
    }

    template<class Work, class Complete>
    long long SubmitComplete(long long ownerId, long long poolId, Work&& work, Complete&& complete) {
        auto task = PrepareTask(ownerId, poolId);
        if (!task) return 0;
        using WorkType = typename std::decay<Work>::type;
        using CompleteType = typename std::decay<Complete>::type;
        using Result = typename std::invoke_result<WorkType&>::type;
        auto completion = std::make_shared<CompleteType>(std::forward<Complete>(complete));
        if constexpr (std::is_void<Result>::value) {
            task->execute = [callable = WorkType(std::forward<Work>(work))]() mutable { callable(); };
            task->complete = [completion](long long taskId, int) mutable { (*completion)(taskId); };
        } else {
            static_assert(std::is_default_constructible<Result>::value, "线程任务返回值必须可默认构造");
            static_assert(std::is_copy_constructible<Result>::value, "线程任务返回值必须可复制");
            auto result = std::make_shared<Result>();
            task->execute = [callable = WorkType(std::forward<Work>(work)), result]() mutable { *result = callable(); };
            task->complete = [completion, result](long long taskId, int finalState) mutable {
                if (finalState == Succeeded) (*completion)(taskId, *result);
                else (*completion)(taskId, Result{});
            };
        }
        return Enqueue(task);
    }

    template<class Work, class Progress, class Complete>
    long long SubmitProgress(long long ownerId, long long poolId, Work&& work, Progress&& progress, Complete&& complete) {
        auto task = PrepareTask(ownerId, poolId);
        if (!task) return 0;
        using WorkType = typename std::decay<Work>::type;
        using ProgressType = typename std::decay<Progress>::type;
        using CompleteType = typename std::decay<Complete>::type;
        using Result = typename std::invoke_result<WorkType&>::type;
        auto progressCallback = std::make_shared<ProgressType>(std::forward<Progress>(progress));
        auto completion = std::make_shared<CompleteType>(std::forward<Complete>(complete));
        task->progress = [progressCallback](long long taskId, int percent, const std::wstring& text) mutable { (*progressCallback)(taskId, percent, text); };
        if constexpr (std::is_void<Result>::value) {
            task->execute = [callable = WorkType(std::forward<Work>(work))]() mutable { callable(); };
            task->complete = [completion](long long taskId, int) mutable { (*completion)(taskId); };
        } else {
            static_assert(std::is_default_constructible<Result>::value, "线程任务返回值必须可默认构造");
            static_assert(std::is_copy_constructible<Result>::value, "线程任务返回值必须可复制");
            auto result = std::make_shared<Result>();
            task->execute = [callable = WorkType(std::forward<Work>(work)), result]() mutable { *result = callable(); };
            task->complete = [completion, result](long long taskId, int finalState) mutable {
                if (finalState == Succeeded) (*completion)(taskId, *result);
                else (*completion)(taskId, Result{});
            };
        }
        return Enqueue(task);
    }

    long long CurrentTask() const { return currentTask_; }

    bool RequestCancel(long long taskId) {
        auto task = FindTask(taskId);
        if (!task || IsTerminal(task->status.load())) return false;
        task->cancelRequested.store(true);
        int state = task->status.load();
        while (!IsTerminal(state)) {
            if (state == CancellationRequested) return true;
            if (state != Queued && state != Running) return false;
            if (task->status.compare_exchange_weak(state, CancellationRequested)) return true;
        }
        return false;
    }

    bool IsCancellationRequested(long long taskId) const {
        if (taskId == 0) taskId = currentTask_;
        auto task = FindTask(taskId);
        return task && task->cancelRequested.load();
    }

    int Status(long long taskId) const {
        auto task = FindTask(taskId);
        return task ? task->status.load() : Invalid;
    }

    std::wstring StatusName(long long taskId) const {
        switch (Status(taskId)) {
        case Queued: return L"排队";
        case Running: return L"运行";
        case Succeeded: return L"成功";
        case Failed: return L"失败";
        case CancellationRequested: return L"请求取消";
        case Cancelled: return L"已取消";
        default: return L"无效";
        }
    }

    bool IsDone(long long taskId) const { return IsTerminal(Status(taskId)); }

    std::wstring Error(long long taskId) const {
        if (taskId == 0) {
            std::lock_guard<std::mutex> lock(errorMutex_);
            return lastError_;
        }
        auto task = FindTask(taskId);
        if (!task) return L"任务不存在或已释放。";
        std::lock_guard<std::mutex> lock(task->mutex);
        return task->error;
    }

    bool Wait(long long taskId, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        if (taskId != 0 && taskId == currentTask_) return Fail(L"线程任务不能等待自身。");
        auto task = FindTask(taskId);
        if (!task) return Fail(L"线程任务不存在或已释放。");
        std::unique_lock<std::mutex> lock(task->mutex);
        auto done = [&]() { return IsTerminal(task->status.load()); };
        if (timeoutMs == -1) { task->changed.wait(lock, done); return true; }
        return task->changed.wait_for(lock, std::chrono::milliseconds(timeoutMs), done);
    }

    bool WaitAll(const std::vector<long long>& taskIds, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        const auto deadline = timeoutMs < 0 ? std::chrono::steady_clock::time_point::max()
            : std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
        for (long long taskId : taskIds) {
            int remaining = -1;
            if (timeoutMs >= 0) {
                const auto now = std::chrono::steady_clock::now();
                if (now >= deadline) return IsDone(taskId);
                remaining = static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(deadline - now).count());
            }
            if (!Wait(taskId, remaining)) return false;
        }
        return true;
    }

    bool CooperativeWait(int milliseconds) {
        if (milliseconds < 0) return Fail(L"线程_协作等待的毫秒数不能小于 0。");
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(milliseconds);
        do {
            if (currentTask_ != 0 && IsCancellationRequested(currentTask_)) return false;
            const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - std::chrono::steady_clock::now()).count();
            if (remaining <= 0) break;
            std::this_thread::sleep_for(std::chrono::milliseconds((std::min)(remaining, static_cast<long long>(10))));
        } while (std::chrono::steady_clock::now() < deadline);
        return currentTask_ == 0 || !IsCancellationRequested(currentTask_);
    }

    bool ReportProgress(int percent, const std::wstring& text) {
        auto task = FindTask(currentTask_);
        if (!task) return Fail(L"线程_报告进度只能在受管工作处理器中调用。");
        percent = (std::max)(0, (std::min)(100, percent));
        bool dispatch = false;
        {
            std::lock_guard<std::mutex> lock(task->mutex);
            task->progressPercent = percent;
            task->progressText = text;
            ++task->progressVersion;
            const auto now = std::chrono::steady_clock::now();
            dispatch = task->lastProgressDispatch.time_since_epoch().count() == 0
                || now - task->lastProgressDispatch >= std::chrono::milliseconds(80);
            if (dispatch) task->lastProgressDispatch = now;
        }
        if (dispatch) DispatchLatestProgress(task);
        return true;
    }

    int Progress(long long taskId) const {
        auto task = FindTask(taskId);
        if (!task) return -1;
        std::lock_guard<std::mutex> lock(task->mutex);
        return task->progressPercent;
    }

    std::wstring ProgressText(long long taskId) const {
        auto task = FindTask(taskId);
        if (!task) return L"";
        std::lock_guard<std::mutex> lock(task->mutex);
        return task->progressText;
    }

    bool ReleaseTask(long long taskId) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto found = tasks_.find(taskId);
        if (found == tasks_.end() || !IsTerminal(found->second->status.load())) return false;
        tasks_.erase(found);
        return true;
    }

    int CleanupCompleted() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        int count = 0;
        for (auto item = tasks_.begin(); item != tasks_.end();) {
            if (IsTerminal(item->second->status.load())) { item = tasks_.erase(item); ++count; }
            else ++item;
        }
        return count;
    }

    bool SetPoolConcurrency(long long poolId, int concurrency) {
        if (concurrency < 1 || concurrency > 64) return Fail(L"线程池并发数必须在 1 到 64 之间。");
        auto pool = FindPool(poolId);
        if (!pool || !IsPoolIdle(pool)) return Fail(L"只能在线程池空闲时调整并发数。");
        if (!ClosePool(poolId, -1)) return false;
        pool->concurrency = concurrency;
        return RestartPool(poolId);
    }

    int PoolConcurrency(long long poolId) const { auto pool = FindPool(poolId); return pool ? pool->concurrency : 0; }
    int PoolWaiting(long long poolId) const { auto pool = FindPool(poolId); if (!pool) return -1; std::lock_guard<std::mutex> lock(pool->mutex); return static_cast<int>(pool->queue.size()); }
    int PoolRunning(long long poolId) const { auto pool = FindPool(poolId); if (!pool) return -1; std::lock_guard<std::mutex> lock(pool->mutex); return pool->running; }
    bool PoolIdle(long long poolId) const { auto pool = FindPool(poolId); return pool && IsPoolIdle(pool); }

    bool WaitPoolIdle(long long poolId, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        auto pool = FindPool(poolId);
        if (!pool) return Fail(L"线程池不存在或已销毁。");
        if (CurrentTaskBelongsToPool(pool->id)) return Fail(L"工作处理器不能等待自身所属线程池空闲。");
        std::unique_lock<std::mutex> lock(pool->mutex);
        auto idle = [&]() { return pool->queue.empty() && pool->running == 0; };
        if (timeoutMs == -1) { pool->idle.wait(lock, idle); return true; }
        return pool->idle.wait_for(lock, std::chrono::milliseconds(timeoutMs), idle);
    }

    bool RequestStopPool(long long poolId) {
        auto pool = FindPool(poolId);
        if (!pool) return Fail(L"线程池不存在或已销毁。");
        std::vector<std::shared_ptr<Task>> cancelled;
        {
            std::lock_guard<std::mutex> lock(pool->mutex);
            pool->stopRequested = true;
            while (!pool->queue.empty()) {
                auto task = pool->queue.front(); pool->queue.pop_front();
                task->cancelRequested.store(true); task->status.store(Cancelled); cancelled.push_back(task);
            }
            if (pool->running == 0) pool->idle.notify_all();
        }
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            for (const auto& pair : tasks_) if (pair.second->poolId == poolId && pair.second->status.load() == Running) {
                pair.second->cancelRequested.store(true);
                pair.second->status.store(CancellationRequested);
            }
        }
        for (const auto& task : cancelled) FinishTask(task, Cancelled, L"线程池已请求停止，排队任务已取消。", true);
        pool->ready.notify_all();
        return true;
    }

    bool ClosePool(long long poolId, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        auto pool = FindPool(poolId);
        if (!pool) return Fail(L"线程池不存在或已销毁。");
        if (CurrentTaskBelongsToPool(pool->id)) return Fail(L"工作处理器不能关闭自身所属线程池。");
        if (!RequestStopPool(poolId)) return false;
        if (!WaitPoolIdle(poolId, timeoutMs)) return Fail(L"线程池关闭等待超时；工作线程未被强制终止。");
        {
            std::lock_guard<std::mutex> lock(pool->mutex);
            pool->closed = true;
        }
        pool->ready.notify_all();
        JoinPool(pool);
        return true;
    }

    bool RestartPool(long long poolId) {
        auto pool = FindPool(poolId);
        if (!pool) return Fail(L"线程池不存在或已销毁。");
        {
            std::lock_guard<std::mutex> lock(pool->mutex);
            if (!pool->closed || !pool->queue.empty() || pool->running != 0) return Fail(L"线程池必须已关闭且空闲后才能重启。");
            pool->closed = false;
            pool->stopRequested = false;
        }
        StartPool(pool);
        return true;
    }

    bool DestroyPool(long long poolId) {
        auto pool = FindPool(poolId);
        if (!pool) return false;
        if (pool->isDefault) return Fail(L"项目默认线程池不能销毁。");
        {
            std::lock_guard<std::mutex> lock(pool->mutex);
            if (!pool->closed || !pool->queue.empty() || pool->running != 0) return Fail(L"自定义线程池只有停止且空闲后才能销毁。");
        }
        JoinPool(pool);
        std::lock_guard<std::mutex> lock(registryMutex_);
        return pools_.erase(poolId) > 0;
    }

    int HardwareConcurrency() const { return (std::max)(1u, std::thread::hardware_concurrency()); }

    long long CreateMutex() { auto value = std::make_shared<ManagedMutex>(); return AddResource(mutexes_, value, 4); }
    template<class Callback> bool WithMutex(long long id, int timeoutMs, Callback&& callback) {
        if (!ValidTimeout(timeoutMs)) return false;
        auto value = FindResource(mutexes_, id);
        if (!value) return Fail(L"线程互斥锁不存在或已销毁。");
        {
            std::lock_guard<std::mutex> lock(value->stateMutex);
            if (value->destroyed) return false;
            if (value->owner == std::this_thread::get_id()) return Fail(L"非递归互斥锁不允许同线程重入。");
            ++value->waiters;
        }
        const bool locked = timeoutMs == -1 ? (value->mutex.lock(), true)
            : value->mutex.try_lock_for(std::chrono::milliseconds(timeoutMs));
        {
            std::lock_guard<std::mutex> lock(value->stateMutex);
            --value->waiters;
            if (!locked || value->destroyed) { if (locked) value->mutex.unlock(); return false; }
            value->owner = std::this_thread::get_id();
        }
        struct Guard {
            std::shared_ptr<ManagedMutex> value;
            ~Guard() { std::lock_guard<std::mutex> lock(value->stateMutex); value->owner = {}; value->mutex.unlock(); }
        } guard { value };
        try { (void)callback(); return true; }
        catch (const std::exception& error) { return Fail(LingCppUtf8ToWide(error.what())); }
        catch (...) { return Fail(L"互斥锁处理器发生未知异常。"); }
    }
    bool DestroyMutex(long long id) {
        auto value = FindResource(mutexes_, id); if (!value) return false;
        std::lock_guard<std::mutex> state(value->stateMutex);
        if (value->waiters != 0 || value->owner != std::thread::id{}) return Fail(L"互斥锁仍被持有或存在等待者，不能销毁。");
        value->destroyed = true;
        std::lock_guard<std::mutex> lock(registryMutex_); return mutexes_.erase(id) > 0;
    }

    long long CreateAtomic(long long initial) { return AddResource(atomics_, std::make_shared<std::atomic<long long>>(initial), 5); }
    long long ReadAtomic(long long id) const { auto value = FindResource(atomics_, id); return value ? value->load() : 0; }
    long long WriteAtomic(long long id, long long next) { auto value = FindResource(atomics_, id); return value ? value->exchange(next) : 0; }
    long long AddAtomic(long long id, long long delta) { auto value = FindResource(atomics_, id); return value ? value->fetch_add(delta) + delta : 0; }
    bool CompareExchangeAtomic(long long id, long long expected, long long next) { auto value = FindResource(atomics_, id); return value && value->compare_exchange_strong(expected, next); }
    bool DestroyAtomic(long long id) { std::lock_guard<std::mutex> lock(registryMutex_); return atomics_.erase(id) > 0; }

    long long CreateEvent(bool manualReset, bool initialState) {
        auto value = std::make_shared<ManagedEvent>(); value->manualReset = manualReset; value->signaled = initialState;
        return AddResource(events_, value, 6);
    }
    bool SetEvent(long long id) { auto value = FindResource(events_, id); if (!value) return false; std::lock_guard<std::mutex> lock(value->mutex); if (value->destroyed) return false; value->signaled = true; if (value->manualReset) value->changed.notify_all(); else value->changed.notify_one(); return true; }
    bool ResetEvent(long long id) { auto value = FindResource(events_, id); if (!value) return false; std::lock_guard<std::mutex> lock(value->mutex); if (value->destroyed) return false; value->signaled = false; return true; }
    bool WaitEvent(long long id, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        auto value = FindResource(events_, id); if (!value) return false;
        std::unique_lock<std::mutex> lock(value->mutex); ++value->waiters;
        auto done = [&]() { return value->destroyed || value->signaled; };
        bool ready = timeoutMs == -1 ? (value->changed.wait(lock, done), true) : value->changed.wait_for(lock, std::chrono::milliseconds(timeoutMs), done);
        --value->waiters;
        if (!ready || value->destroyed) return false;
        if (!value->manualReset) value->signaled = false;
        return true;
    }
    bool DestroyEvent(long long id) {
        auto value = FindResource(events_, id); if (!value) return false;
        { std::lock_guard<std::mutex> lock(value->mutex); value->destroyed = true; value->changed.notify_all(); }
        std::lock_guard<std::mutex> lock(registryMutex_); return events_.erase(id) > 0;
    }

    long long CreateSemaphore(int initial, int maximum) {
        if (maximum < 1 || initial < 0 || initial > maximum) return FailId(L"信号量必须满足最大值大于 0，且初始值位于 0 到最大值之间。");
        auto value = std::make_shared<ManagedSemaphore>(); value->count = initial; value->maximum = maximum;
        return AddResource(semaphores_, value, 7);
    }
    bool WaitSemaphore(long long id, int timeoutMs) {
        if (!ValidTimeout(timeoutMs)) return false;
        auto value = FindResource(semaphores_, id); if (!value) return false;
        std::unique_lock<std::mutex> lock(value->mutex); ++value->waiters;
        auto readyPredicate = [&]() { return value->destroyed || value->count > 0; };
        bool ready = timeoutMs == -1 ? (value->changed.wait(lock, readyPredicate), true) : value->changed.wait_for(lock, std::chrono::milliseconds(timeoutMs), readyPredicate);
        --value->waiters;
        if (!ready || value->destroyed) return false;
        --value->count; return true;
    }
    bool ReleaseSemaphore(long long id, int amount) {
        if (amount < 1) return Fail(L"信号量释放数量必须大于 0。");
        auto value = FindResource(semaphores_, id); if (!value) return false;
        std::lock_guard<std::mutex> lock(value->mutex);
        if (value->destroyed || amount > value->maximum - value->count) return Fail(L"信号量释放后将超过最大值。");
        value->count += amount;
        for (int index = 0; index < amount; ++index) value->changed.notify_one();
        return true;
    }
    int SemaphoreAvailable(long long id) const { auto value = FindResource(semaphores_, id); if (!value) return -1; std::lock_guard<std::mutex> lock(value->mutex); return value->count; }
    bool DestroySemaphore(long long id) {
        auto value = FindResource(semaphores_, id); if (!value) return false;
        { std::lock_guard<std::mutex> lock(value->mutex); value->destroyed = true; value->changed.notify_all(); }
        std::lock_guard<std::mutex> lock(registryMutex_); return semaphores_.erase(id) > 0;
    }

private:
    struct Owner {
        long long id = 0; bool alive = true; int running = 0;
        std::function<void(long long)> notify;
        std::mutex mutex; std::condition_variable idle; std::deque<std::function<void()>> callbacks;
    };
    struct Task {
        long long id = 0; long long ownerId = 0; long long poolId = 0;
        std::atomic<int> status { Queued }; std::atomic<bool> cancelRequested { false };
        std::mutex mutex; std::condition_variable changed; std::wstring error;
        int progressPercent = 0; std::wstring progressText; unsigned long long progressVersion = 0; unsigned long long dispatchedProgressVersion = 0;
        std::chrono::steady_clock::time_point lastProgressDispatch {};
        std::function<void()> execute; std::function<void(long long, int)> complete;
        std::function<void(long long, int, const std::wstring&)> progress;
        std::atomic<bool> completionQueued { false };
    };
    struct Pool {
        long long id = 0; int concurrency = 1; int capacity = 1; int running = 0; bool isDefault = false; bool stopRequested = false; bool closed = false;
        std::mutex mutex; std::condition_variable ready; std::condition_variable idle;
        std::deque<std::shared_ptr<Task>> queue; std::vector<std::thread> workers;
    };
    struct ManagedMutex { std::timed_mutex mutex; std::mutex stateMutex; std::thread::id owner; int waiters = 0; bool destroyed = false; };
    struct ManagedEvent { std::mutex mutex; std::condition_variable changed; bool manualReset = false; bool signaled = false; bool destroyed = false; int waiters = 0; };
    struct ManagedSemaphore { std::mutex mutex; std::condition_variable changed; int count = 0; int maximum = 1; bool destroyed = false; int waiters = 0; };

    LingThreadProjectRuntime() = default;
    ~LingThreadProjectRuntime() {
        for (const auto& pool : SnapshotPools()) ClosePool(pool->id, -1);
    }
    LingThreadProjectRuntime(const LingThreadProjectRuntime&) = delete;
    LingThreadProjectRuntime& operator=(const LingThreadProjectRuntime&) = delete;

    long long NewId(unsigned char kind) { return static_cast<long long>((nextSequence_.fetch_add(1) << 8) | kind); }
    static bool IsTerminal(int state) { return state == Succeeded || state == Failed || state == Cancelled; }
    bool ValidTimeout(int timeoutMs) { return timeoutMs >= -1 || Fail(L"等待超时只能为 -1 或非负毫秒数。"); }
    bool Fail(const std::wstring& message) const { ReportError(message); return false; }
    long long FailId(const std::wstring& message) const { ReportError(message); return 0; }
    long long FailIdLocked(const std::wstring& message) const { std::lock_guard<std::mutex> lock(errorMutex_); ReportErrorLocked(message); return 0; }
    void ReportError(const std::wstring& message) const { std::lock_guard<std::mutex> lock(errorMutex_); ReportErrorLocked(message); }
    void ReportErrorLocked(const std::wstring& message) const { lastError_ = message; LingThreadPlatformReportError(message); }

    std::shared_ptr<Owner> FindOwner(long long id) const { std::lock_guard<std::mutex> lock(registryMutex_); auto found = owners_.find(id); return found == owners_.end() ? nullptr : found->second; }
    std::shared_ptr<Task> FindTask(long long id) const { std::lock_guard<std::mutex> lock(registryMutex_); auto found = tasks_.find(id); return found == tasks_.end() ? nullptr : found->second; }
    std::shared_ptr<Pool> FindPool(long long id) const { if (id == 0) id = const_cast<LingThreadProjectRuntime*>(this)->DefaultPool(); std::lock_guard<std::mutex> lock(registryMutex_); auto found = pools_.find(id); return found == pools_.end() ? nullptr : found->second; }
    std::vector<std::shared_ptr<Pool>> SnapshotPools() const { std::lock_guard<std::mutex> lock(registryMutex_); std::vector<std::shared_ptr<Pool>> result; for (const auto& pair : pools_) result.push_back(pair.second); return result; }
    bool IsPoolIdle(const std::shared_ptr<Pool>& pool) const { std::lock_guard<std::mutex> lock(pool->mutex); return pool->queue.empty() && pool->running == 0; }
    bool CurrentTaskBelongsToPool(long long poolId) const { auto task = currentTask_ == 0 ? nullptr : FindTask(currentTask_); return task && task->poolId == poolId; }

    template<class T> long long AddResource(std::unordered_map<long long, std::shared_ptr<T>>& registry, const std::shared_ptr<T>& value, unsigned char kind) {
        std::lock_guard<std::mutex> lock(registryMutex_); const long long id = NewId(kind); registry[id] = value; return id;
    }
    template<class T> std::shared_ptr<T> FindResource(const std::unordered_map<long long, std::shared_ptr<T>>& registry, long long id) const {
        std::lock_guard<std::mutex> lock(registryMutex_); auto found = registry.find(id); return found == registry.end() ? nullptr : found->second;
    }

    std::shared_ptr<Task> PrepareTask(long long ownerId, long long poolId) {
        if (poolId == 0) poolId = DefaultPool();
        auto owner = FindOwner(ownerId); auto pool = FindPool(poolId);
        if (!owner) { Fail(L"提交任务的窗口 owner 已失效。"); return nullptr; }
        if (!pool) { Fail(L"线程池不存在或已销毁。"); return nullptr; }
        { std::lock_guard<std::mutex> ownerLock(owner->mutex); if (!owner->alive) { Fail(L"窗口正在关闭，不能再提交线程任务。"); return nullptr; } }
        auto task = std::make_shared<Task>(); task->id = NewId(1); task->ownerId = ownerId; task->poolId = poolId;
        std::lock_guard<std::mutex> lock(registryMutex_);
        if (tasks_.size() >= 100000) { FailIdLocked(L"项目中的活动任务记录已达到 100000 上限。"); return nullptr; }
        tasks_[task->id] = task; return task;
    }

    long long Enqueue(const std::shared_ptr<Task>& task) {
        auto pool = FindPool(task->poolId);
        if (!pool) { ReleasePreparedTask(task->id, L"线程池不存在或已销毁。"); return 0; }
        {
            std::lock_guard<std::mutex> lock(pool->mutex);
            if (pool->closed || pool->stopRequested) { ReleasePreparedTask(task->id, L"线程池已停止或关闭，不能提交任务。"); return 0; }
            if (static_cast<int>(pool->queue.size()) >= pool->capacity) { ReleasePreparedTask(task->id, L"线程池有界队列已满，任务未提交。"); return 0; }
            pool->queue.push_back(task);
        }
        pool->ready.notify_one(); return task->id;
    }

    void ReleasePreparedTask(long long id, const std::wstring& error) {
        { std::lock_guard<std::mutex> lock(registryMutex_); tasks_.erase(id); }
        ReportError(error);
    }

    void StartPool(const std::shared_ptr<Pool>& pool) {
        for (int index = 0; index < pool->concurrency; ++index) pool->workers.emplace_back([this, pool]() { WorkerLoop(pool); });
    }
    void JoinPool(const std::shared_ptr<Pool>& pool) {
        for (auto& worker : pool->workers) if (worker.joinable() && worker.get_id() != std::this_thread::get_id()) worker.join();
        pool->workers.clear();
    }
    void WorkerLoop(const std::shared_ptr<Pool>& pool) {
        for (;;) {
            std::shared_ptr<Task> task;
            {
                std::unique_lock<std::mutex> lock(pool->mutex);
                pool->ready.wait(lock, [&]() { return pool->closed || pool->stopRequested || !pool->queue.empty(); });
                if ((pool->closed || pool->stopRequested) && pool->queue.empty()) break;
                task = pool->queue.front(); pool->queue.pop_front(); ++pool->running;
            }
            ExecuteTask(task);
            {
                std::lock_guard<std::mutex> lock(pool->mutex);
                --pool->running;
                if (pool->queue.empty() && pool->running == 0) pool->idle.notify_all();
            }
        }
    }

    void ExecuteTask(const std::shared_ptr<Task>& task) {
        auto owner = FindOwner(task->ownerId);
        if (!owner) { FinishTask(task, Cancelled, L"发起窗口已销毁。", false); return; }
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            if (!owner->alive) { FinishTask(task, Cancelled, L"发起窗口已关闭。", false); return; }
            ++owner->running;
        }
        int terminalState = Succeeded; std::wstring error;
        if (task->cancelRequested.load() || task->status.load() == CancellationRequested) { terminalState = Cancelled; error = L"任务在运行前已取消。"; }
        else {
            task->status.store(Running); currentTask_ = task->id;
            try { task->execute(); if (task->cancelRequested.load() || task->status.load() == CancellationRequested) { terminalState = Cancelled; error = L"任务已协作取消。"; } }
            catch (const std::exception& exception) { terminalState = Failed; error = LingCppUtf8ToWide(exception.what()); }
            catch (...) { terminalState = Failed; error = L"工作处理器发生未知异常。"; }
            currentTask_ = 0;
        }
        FinishTask(task, terminalState, error, true);
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            --owner->running;
            if (owner->running == 0) owner->idle.notify_all();
        }
    }

    void FinishTask(const std::shared_ptr<Task>& task, int state, const std::wstring& error, bool dispatchCallbacks) {
        if (task->completionQueued.exchange(true)) return;
        {
            std::lock_guard<std::mutex> lock(task->mutex);
            task->status.store(state); task->error = error;
        }
        task->changed.notify_all();
        if (!dispatchCallbacks) return;
        DispatchLatestProgress(task);
        if (task->complete) {
            auto callback = task->complete; const long long taskId = task->id;
            QueueOwnerCallback(task->ownerId, [callback, taskId, state]() mutable { callback(taskId, state); });
        }
    }

    void DispatchLatestProgress(const std::shared_ptr<Task>& task) {
        if (!task->progress) return;
        int percent = 0; std::wstring text; unsigned long long version = 0;
        {
            std::lock_guard<std::mutex> lock(task->mutex);
            if (task->progressVersion == task->dispatchedProgressVersion) return;
            version = task->progressVersion; task->dispatchedProgressVersion = version;
            percent = task->progressPercent; text = task->progressText;
        }
        auto callback = task->progress; const long long taskId = task->id;
        QueueOwnerCallback(task->ownerId, [callback, taskId, percent, text]() mutable { callback(taskId, percent, text); });
    }

    void QueueOwnerCallback(long long ownerId, std::function<void()> callback) {
        auto owner = FindOwner(ownerId); if (!owner) return;
        std::function<void(long long)> notify;
        {
            std::lock_guard<std::mutex> lock(owner->mutex);
            if (!owner->alive) return;
            owner->callbacks.push_back(std::move(callback)); notify = owner->notify;
        }
        if (notify) notify(ownerId);
    }

    mutable std::mutex registryMutex_;
    mutable std::mutex errorMutex_;
    mutable std::wstring lastError_;
    std::atomic<unsigned long long> nextSequence_ { 1 };
    long long defaultPoolId_ = 0;
    std::unordered_map<long long, std::shared_ptr<Owner>> owners_;
    std::unordered_map<long long, std::shared_ptr<Task>> tasks_;
    std::unordered_map<long long, std::shared_ptr<Pool>> pools_;
    std::unordered_map<long long, std::shared_ptr<ManagedMutex>> mutexes_;
    std::unordered_map<long long, std::shared_ptr<std::atomic<long long>>> atomics_;
    std::unordered_map<long long, std::shared_ptr<ManagedEvent>> events_;
    std::unordered_map<long long, std::shared_ptr<ManagedSemaphore>> semaphores_;
    inline static thread_local long long currentTask_ = 0;
};`;

const THREADING_WIN32_ADAPTER_RUNTIME = String.raw`
// Win32 is only the notification/error adapter. The managed core and public IDs
// do not expose HWND/HANDLE and can be reused by a later macOS dispatcher.
static void LingThreadPlatformReportError(const std::wstring& message) {
    const std::wstring line = L"LingBuilder 多线程：" + message + L"\\n";
    OutputDebugStringW(line.c_str());
}

static long long LingThreadRegisterWindowOwner(HWND window) {
    if (!window) return 0;
    return LingThreadProjectRuntime::Instance().RegisterOwner([window](long long ownerId) {
        const unsigned long long generation = static_cast<unsigned long long>(ownerId);
        PostMessageW(window, WM_LINGBUILDER_THREAD_UI_UPDATE,
            static_cast<WPARAM>(generation & 0xffffffffULL),
            static_cast<LPARAM>((generation >> 32) & 0xffffffffULL));
    });
}

static void LingThreadDrainWindowCallbacks(long long ownerId) {
    LingThreadProjectRuntime::Instance().DrainOwnerCallbacks(ownerId);
}`;
