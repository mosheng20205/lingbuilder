import { EDGEVIEW_SAFE_API_CATALOG } from '../modules/edgeViewApiCatalog';
import { isWideStringAbiBindingType } from '../modules/bindingValueType';

const SETTING_MEMBERS: Array<[string, string, number]> = [
  ['脚本执行', 'IsScriptEnabled', 1], ['网页消息', 'IsWebMessageEnabled', 1], ['脚本对话框', 'AreDefaultScriptDialogsEnabled', 1],
  ['状态栏', 'IsStatusBarEnabled', 1], ['开发者工具', 'AreDevToolsEnabled', 1], ['右键菜单', 'AreDefaultContextMenusEnabled', 1],
  ['缩放控制', 'IsZoomControlEnabled', 1], ['内置错误页', 'IsBuiltInErrorPageEnabled', 1],
  ['快捷键', 'AreBrowserAcceleratorKeysEnabled', 3], ['密码自动保存', 'IsPasswordAutosaveEnabled', 4],
  ['通用自动填充', 'IsGeneralAutofillEnabled', 4], ['捏合缩放', 'IsPinchZoomEnabled', 5], ['滑动导航', 'IsSwipeNavigationEnabled', 6]
];

function settingsWrappers(): string {
  return SETTING_MEMBERS.map(([label, member, version]) => `
    int EdgeView设置_置${label}(const wchar_t* controlName, bool enabled) {
        return EdgeView设置_置布尔(controlName, L"${member}", ${version}, enabled);
    }
    int EdgeView设置_取${label}(const wchar_t* controlName) {
        return EdgeView设置_取布尔(controlName, L"${member}", ${version});
    }`).join('\n');
}

function printSettingsWrappers(): string {
  const intMembers: Array<[string, string, 1 | 2, string, string]> = [
    ['方向', 'Orientation', 1, 'COREWEBVIEW2_PRINT_ORIENTATION', 'COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT'],
    ['每面页数', 'PagesPerSide', 2, 'INT32', '1'], ['份数', 'Copies', 2, 'INT32', '1'],
    ['逐份打印', 'Collation', 2, 'COREWEBVIEW2_PRINT_COLLATION', 'COREWEBVIEW2_PRINT_COLLATION_DEFAULT'],
    ['颜色模式', 'ColorMode', 2, 'COREWEBVIEW2_PRINT_COLOR_MODE', 'COREWEBVIEW2_PRINT_COLOR_MODE_DEFAULT'],
    ['双面模式', 'Duplex', 2, 'COREWEBVIEW2_PRINT_DUPLEX', 'COREWEBVIEW2_PRINT_DUPLEX_DEFAULT'],
    ['纸张类型', 'MediaSize', 2, 'COREWEBVIEW2_PRINT_MEDIA_SIZE', 'COREWEBVIEW2_PRINT_MEDIA_SIZE_DEFAULT']
  ];
  const doubleMembers: Array<[string, string]> = [
    ['缩放倍数', 'ScaleFactor'], ['纸张宽度', 'PageWidth'], ['纸张高度', 'PageHeight'], ['上边距', 'MarginTop'],
    ['下边距', 'MarginBottom'], ['左边距', 'MarginLeft'], ['右边距', 'MarginRight']
  ];
  const boolMembers: Array<[string, string]> = [
    ['打印背景', 'ShouldPrintBackgrounds'], ['仅打印选区', 'ShouldPrintSelectionOnly'], ['打印页眉页脚', 'ShouldPrintHeaderAndFooter']
  ];
  const textMembers: Array<[string, string, 1 | 2]> = [
    ['页眉标题', 'HeaderTitle', 1], ['页脚地址', 'FooterUri', 1], ['页面范围', 'PageRanges', 2], ['打印机名称', 'PrinterName', 2]
  ];
  const intCode = intMembers.map(([label, member, version, cppType, defaultValue]) => `
    int EdgeView打印_置${label}(const wchar_t* controlName, int value) { auto settings = EdgeView打印_取设置${version === 2 ? '2' : ''}(controlName); return settings && SUCCEEDED(settings->put_${member}(static_cast<${cppType}>(value))) ? 1 : 0; }
    int EdgeView打印_取${label}(const wchar_t* controlName) { auto settings = EdgeView打印_取设置${version === 2 ? '2' : ''}(controlName); ${cppType} value = ${defaultValue}; return settings && SUCCEEDED(settings->get_${member}(&value)) ? static_cast<int>(value) : 0; }`).join('\n');
  const doubleCode = doubleMembers.map(([label, member]) => `
    int EdgeView打印_置${label}(const wchar_t* controlName, double value) { auto settings = EdgeView打印_取设置(controlName); return settings && SUCCEEDED(settings->put_${member}(value)) ? 1 : 0; }
    double EdgeView打印_取${label}(const wchar_t* controlName) { auto settings = EdgeView打印_取设置(controlName); double value = 0; return settings && SUCCEEDED(settings->get_${member}(&value)) ? value : 0; }`).join('\n');
  const boolCode = boolMembers.map(([label, member]) => `
    int EdgeView打印_置${label}(const wchar_t* controlName, bool value) { auto settings = EdgeView打印_取设置(controlName); return settings && SUCCEEDED(settings->put_${member}(value ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView打印_取${label}(const wchar_t* controlName) { auto settings = EdgeView打印_取设置(controlName); BOOL value = FALSE; return settings && SUCCEEDED(settings->get_${member}(&value)) && value ? 1 : 0; }`).join('\n');
  const textCode = textMembers.map(([label, member, version]) => `
    int EdgeView打印_置${label}(const wchar_t* controlName, const wchar_t* value) { auto settings = EdgeView打印_取设置${version === 2 ? '2' : ''}(controlName); return settings && SUCCEEDED(settings->put_${member}(value ? value : L"")) ? 1 : 0; }
    std::wstring EdgeView打印_取${label}(const wchar_t* controlName) { auto settings = EdgeView打印_取设置${version === 2 ? '2' : ''}(controlName); LPWSTR value = nullptr; if (settings) settings->get_${member}(&value); return EdgeView_接管字符串(value); }`).join('\n');
  return `${intCode}\n${doubleCode}\n${boolCode}\n${textCode}`;
}

function unavailableStubs(): string {
  return EDGEVIEW_SAFE_API_CATALOG.map(entry => {
    const parameters = (entry.binding.parameters || []).map((parameter, index) => {
      const type = isWideStringAbiBindingType(parameter.type) ? 'const wchar_t*'
        : parameter.type === 'longLong' || parameter.type === 'handle' ? 'long long'
          : parameter.type === 'double' ? 'double' : parameter.type === 'bool' ? 'bool' : 'int';
      return `${type} value${index}`;
    }).join(', ');
    const unused = (entry.binding.parameters || []).map((_, index) => `(void)value${index};`).join(' ');
    const returnType = entry.binding.returnType === 'void' ? 'void' : entry.binding.returnType === 'wideString' ? 'std::wstring'
      : entry.binding.returnType === 'longLong' || entry.binding.returnType === 'handle' ? 'long long'
        : entry.binding.returnType === 'double' ? 'double' : 'int';
    const fallback = returnType === 'void' ? '' : returnType === 'std::wstring' ? 'return L"";'
      : returnType === 'double' ? 'return 0.0;' : 'return 0;';
    return `    ${returnType} ${entry.runtimeSymbol}(${parameters}) { ${unused} EdgeView_报告接口缺失(L"${entry.runtimeSymbol}"); ${fallback} }`;
  }).join('\n');
}

/**
 * 注入 LingWindowBase 的 EdgeView 安全 API。这里只暴露文本、数字、JSON、文件路径和受管 ID；
 * COM、IStream、IUnknown 与内存地址始终停留在生成运行时内部。
 */
export const EDGEVIEW_SAFE_API_NATIVE_MEMBERS = String.raw`
    struct EdgeViewTaskState {
        long long id = 0;
        int instanceId = 0;
        unsigned long long generation = 0;
        int status = 0;
        bool cancelled = false;
        std::wstring result;
        std::wstring error;
        std::wstring handler;
        ULONGLONG deadline = 0;
    };
    std::map<long long, std::shared_ptr<EdgeViewTaskState>> edgeViewTasks_;
    long long nextEdgeViewTaskId_ = 1;
    long long currentEdgeViewTaskId_ = 0;

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    struct EdgeViewManagedObjectState {
        long long id = 0;
        std::wstring type;
        int instanceId = 0;
        unsigned long long generation = 0;
        DWORD threadId = 0;
        bool released = false;
        Microsoft::WRL::ComPtr<IUnknown> object;
    };
    std::map<long long, std::shared_ptr<EdgeViewManagedObjectState>> edgeViewManagedObjects_;
    long long nextEdgeViewManagedObjectId_ = 1;
#endif

    void EdgeView_报告接口缺失(const wchar_t* command) {
        std::wstring message = L"EdgeView 命令不可用：";
        message += command ? command : L"未知命令";
        message += L"。当前 WebView2 Runtime 版本不足；v1 最低需要 141，v2 完整能力需要 150。";
        调试输出(message.c_str());
    }

    void EdgeView_报告回调内同步等待(const wchar_t* command) {
        std::wstring message = L"EdgeView 同步命令在浏览器事件处理器内不可用：";
        message += command ? command : L"未知命令";
        message += L"。WebView2 的完成回调要等界面线程回到消息循环才会派发，在事件处理器里自建消息泵只会等满 15 秒并返回空值。";
        message += L"请改用异步命令并把取值写进完成处理器，例如 EdgeView脚本_执行详情异步(控件名, 脚本, &完成处理器)，在完成处理器里用 EdgeView任务_取结果 取值。";
        调试输出(message.c_str());
    }

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    bool EdgeView_检查运行时版本() {
#ifndef LINGBUILDER_EDGEVIEW_REQUIRED_RUNTIME_MAJOR
#define LINGBUILDER_EDGEVIEW_REQUIRED_RUNTIME_MAJOR 141
#endif
        // Loader 已静态链接（WebView2LoaderStatic.lib），直接调用入口，不再经 LoadLibrary/GetProcAddress。
        LPWSTR version = nullptr;
        const HRESULT result = GetAvailableCoreWebView2BrowserVersionString(nullptr, &version);
        const long major = SUCCEEDED(result) && version ? wcstol(version, nullptr, 10) : 0; if (version) CoTaskMemFree(version);
        if (major >= LINGBUILDER_EDGEVIEW_REQUIRED_RUNTIME_MAJOR) return true;
        std::wstring message = L"EdgeView 启动被阻止：源码使用的 API 至少需要 WebView2 Runtime "; message += std::to_wstring(LINGBUILDER_EDGEVIEW_REQUIRED_RUNTIME_MAJOR); message += L"，当前 Runtime 为 "; message += major > 0 ? std::to_wstring(major) : L"未知"; message += L"。"; 调试输出(message.c_str()); return false;
    }
    std::shared_ptr<EdgeViewTaskState> EdgeView任务_新建(EdgeViewInstance* instance, const wchar_t* handler) {
        if (!instance || instance->closed) return {};
        auto task = std::make_shared<EdgeViewTaskState>();
        task->id = nextEdgeViewTaskId_++;
        task->instanceId = instance->id;
        task->generation = instance->generation;
        task->handler = handler ? handler : L"";
        task->deadline = GetTickCount64() + 30000;
        edgeViewTasks_[task->id] = task;
        return task;
    }
    bool EdgeView任务_实例仍有效(const std::shared_ptr<EdgeViewTaskState>& task) const {
        if (!task || task->cancelled) return false;
        auto found = edgeViews_.find(task->instanceId);
        return found != edgeViews_.end() && found->second && !found->second->closed && found->second->generation == task->generation;
    }
    void EdgeView任务_检查超时(const std::shared_ptr<EdgeViewTaskState>& task) {
        if (task && task->status == 0 && task->deadline && GetTickCount64() >= task->deadline) {
            task->cancelled = true; task->status = 4; task->error = L"WebView2 异步任务等待超时。";
        }
    }
    void EdgeView任务_完成(const std::shared_ptr<EdgeViewTaskState>& task, HRESULT error, const wchar_t* result) {
        if (!task || task->status != 0) return;
        EdgeView任务_检查超时(task); if (task->status != 0) return;
        if (!EdgeView任务_实例仍有效(task)) {
            task->cancelled = true; task->status = 3; task->error = L"控件已经关闭或重建，已拒绝迟到回调。"; return;
        }
        if (FAILED(error)) {
            task->status = 2;
            wchar_t code[32] = {}; swprintf_s(code, L"0x%08X", static_cast<unsigned int>(error));
            task->error = L"WebView2 异步操作失败："; task->error += code;
        } else {
            task->status = 1; task->result = result ? result : L"";
        }
        if (!task->handler.empty()) {
            const long long previous = currentEdgeViewTaskId_; currentEdgeViewTaskId_ = task->id;
            DispatchEdgeViewEvent(task->handler.c_str(), task->instanceId, L"任务完成", task->result.c_str());
            currentEdgeViewTaskId_ = previous;
        }
    }
    long long EdgeView任务_取当前任务ID() const { return currentEdgeViewTaskId_; }
    int EdgeView任务_取状态(long long taskId) { auto found = edgeViewTasks_.find(taskId); if (found == edgeViewTasks_.end()) return -1; EdgeView任务_检查超时(found->second); return found->second->status; }
    std::wstring EdgeView任务_取结果(long long taskId) { auto found = edgeViewTasks_.find(taskId); if (found == edgeViewTasks_.end()) return L""; EdgeView任务_检查超时(found->second); return found->second->result; }
    std::wstring EdgeView任务_取错误(long long taskId) { auto found = edgeViewTasks_.find(taskId); if (found == edgeViewTasks_.end()) return L"任务不存在或已经释放。"; EdgeView任务_检查超时(found->second); return found->second->error; }
    int EdgeView任务_取消(long long taskId) { auto found = edgeViewTasks_.find(taskId); if (found == edgeViewTasks_.end()) return 0; found->second->cancelled = true; found->second->status = 3; found->second->error = L"任务已取消。"; return 1; }
    int EdgeView任务_释放(long long taskId) { auto found = edgeViewTasks_.find(taskId); if (found == edgeViewTasks_.end()) return 0; if (found->second->status == 0) EdgeView任务_取消(taskId); edgeViewTasks_.erase(found); return 1; }

    long long EdgeView对象_注册(EdgeViewInstance* instance, const wchar_t* type, IUnknown* object) {
        if (!instance || instance->closed || !object || !type) return 0;
        auto state = std::make_shared<EdgeViewManagedObjectState>();
        state->id = nextEdgeViewManagedObjectId_++; state->type = type; state->instanceId = instance->id;
        state->generation = instance->generation; state->threadId = GetCurrentThreadId(); state->object = object;
        edgeViewManagedObjects_[state->id] = state; return state->id;
    }
    std::shared_ptr<EdgeViewManagedObjectState> EdgeView对象_查找(const wchar_t* controlName, long long objectId, const wchar_t* expectedType = nullptr) {
        auto found = edgeViewManagedObjects_.find(objectId); auto* instance = EdgeView_查找控件(controlName);
        if (found == edgeViewManagedObjects_.end() || !instance || !found->second || found->second->released || !found->second->object) return {};
        auto state = found->second;
        if (state->instanceId != instance->id || state->generation != instance->generation || state->threadId != GetCurrentThreadId()) return {};
        if (expectedType && state->type != expectedType) return {};
        return state;
    }
    template <typename T> Microsoft::WRL::ComPtr<T> EdgeView对象_取接口(const wchar_t* controlName, long long objectId, const wchar_t* expectedType = nullptr) {
        Microsoft::WRL::ComPtr<T> value; auto state = EdgeView对象_查找(controlName, objectId, expectedType);
        if (state && state->object) state->object.As(&value); return value;
    }
    std::wstring EdgeView对象_取状态JSON(long long objectId) {
        auto found = edgeViewManagedObjects_.find(objectId); if (found == edgeViewManagedObjects_.end() || !found->second) return L"{}";
        auto state = found->second;
        return EdgeView_事件数据({{L"id", EdgeView_数值(state->id)}, {L"type", state->type}, {L"instanceId", EdgeView_数值(state->instanceId)}, {L"generation", EdgeView_数值(state->generation)}, {L"threadId", EdgeView_数值(state->threadId)}, {L"released", state->released ? L"true" : L"false"}});
    }
    int EdgeView对象_释放(long long objectId) {
        auto found = edgeViewManagedObjects_.find(objectId); if (found == edgeViewManagedObjects_.end()) return 0;
        found->second->released = true; found->second->object.Reset(); edgeViewManagedObjects_.erase(found); return 1;
    }
    void EdgeView对象_释放控件(int instanceId) {
        for (auto iterator = edgeViewManagedObjects_.begin(); iterator != edgeViewManagedObjects_.end();) {
            if (iterator->second && iterator->second->instanceId == instanceId) { iterator->second->released = true; iterator->second->object.Reset(); iterator = edgeViewManagedObjects_.erase(iterator); }
            else ++iterator;
        }
    }

    int EdgeView导航_HTML(const wchar_t* controlName, const wchar_t* html) {
        auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && html && SUCCEEDED(instance->webView->NavigateToString(html)) ? 1 : 0;
    }
    int EdgeView导航_请求(const wchar_t* controlName, const wchar_t* uri, const wchar_t* method, const wchar_t* headers, const wchar_t* body) {
        auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->webView || !instance->environment || !uri) return 0;
        Microsoft::WRL::ComPtr<ICoreWebView2_2> webView2; Microsoft::WRL::ComPtr<ICoreWebView2Environment2> environment2;
        if (FAILED(instance->webView.As(&webView2)) || !webView2 || FAILED(instance->environment.As(&environment2)) || !environment2) { EdgeView_报告接口缺失(L"EdgeView导航_请求"); return 0; }
        Microsoft::WRL::ComPtr<ICoreWebView2Environment> currentEnvironment; webView2->get_Environment(&currentEnvironment); if (currentEnvironment) currentEnvironment.As(&environment2);
        Microsoft::WRL::ComPtr<IStream> content;
        if (body && body[0]) {
            const int bytes = WideCharToMultiByte(CP_UTF8, 0, body, -1, nullptr, 0, nullptr, nullptr);
            HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, static_cast<SIZE_T>(bytes > 0 ? bytes - 1 : 0));
            if (memory && bytes > 1) { void* target = GlobalLock(memory); WideCharToMultiByte(CP_UTF8, 0, body, -1, static_cast<char*>(target), bytes, nullptr, nullptr); GlobalUnlock(memory); }
            if (memory) CreateStreamOnHGlobal(memory, TRUE, &content);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2WebResourceRequest> request;
        HRESULT result = environment2->CreateWebResourceRequest(uri, method && method[0] ? method : L"GET", content.Get(), headers ? headers : L"", &request);
        return SUCCEEDED(result) && request && SUCCEEDED(webView2->NavigateWithWebResourceRequest(request.Get())) ? 1 : 0;
    }
    int EdgeView导航_停止(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && SUCCEEDED(instance->webView->Stop()) ? 1 : 0; }
    std::wstring EdgeView导航_取地址(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); return instance ? EdgeView_当前地址(instance->webView.Get()) : L""; }
    std::wstring EdgeView导航_取标题(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); LPWSTR value = nullptr; if (instance && instance->webView) instance->webView->get_DocumentTitle(&value); return EdgeView_接管字符串(value); }
    std::wstring EdgeView导航_取状态JSON(const wchar_t* controlName) {
        auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->webView) return L"{}";
        BOOL back = FALSE, forward = FALSE, suspended = FALSE; UINT32 processId = 0, frameId = 0;
        LPWSTR userDataFolder = nullptr, failureReportFolder = nullptr;
        instance->webView->get_CanGoBack(&back); instance->webView->get_CanGoForward(&forward); instance->webView->get_BrowserProcessId(&processId);
        Microsoft::WRL::ComPtr<ICoreWebView2_3> webView3; if (SUCCEEDED(instance->webView.As(&webView3)) && webView3) webView3->get_IsSuspended(&suspended);
        Microsoft::WRL::ComPtr<ICoreWebView2Environment7> environment7; if (instance->environment && SUCCEEDED(instance->environment.As(&environment7)) && environment7) environment7->get_UserDataFolder(&userDataFolder);
        Microsoft::WRL::ComPtr<ICoreWebView2Environment11> environment11; if (instance->environment && SUCCEEDED(instance->environment.As(&environment11)) && environment11) environment11->get_FailureReportFolderPath(&failureReportFolder);
        Microsoft::WRL::ComPtr<ICoreWebView2_20> webView20; if (SUCCEEDED(instance->webView.As(&webView20)) && webView20) webView20->get_FrameId(&frameId);
        return EdgeView_事件数据({{L"canGoBack", EdgeView_布尔值(back)}, {L"canGoForward", EdgeView_布尔值(forward)}, {L"suspended", EdgeView_布尔值(suspended)}, {L"browserProcessId", EdgeView_数值(processId)}, {L"frameId", EdgeView_数值(frameId)}, {L"userDataFolder", EdgeView_接管字符串(userDataFolder)}, {L"failureReportFolder", EdgeView_接管字符串(failureReportFolder)}});
    }
    long long EdgeView导航_取进程信息异步(const wchar_t* controlName, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2Environment13> environment13;
        if (!task) return 0;
        if (!instance->environment || FAILED(instance->environment.As(&environment13)) || !environment13) { Microsoft::WRL::ComPtr<ICoreWebView2Environment8> environment8; Microsoft::WRL::ComPtr<ICoreWebView2ProcessInfoCollection> processes; if (instance->environment && SUCCEEDED(instance->environment.As(&environment8)) && environment8 && SUCCEEDED(environment8->GetProcessInfos(&processes)) && processes) { std::wstring json = L"["; UINT32 count = 0; processes->get_Count(&count); for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2ProcessInfo> process; INT32 processId = 0; COREWEBVIEW2_PROCESS_KIND kind = COREWEBVIEW2_PROCESS_KIND_BROWSER; processes->GetValueAtIndex(index, &process); if (process) { process->get_ProcessId(&processId); process->get_Kind(&kind); } if (index) json += L","; json += EdgeView_事件数据({{L"processId", EdgeView_数值(processId)}, {L"kind", EdgeView_数值(kind)}, {L"associatedFrameCount", L"0"}}); } json += L"]"; EdgeView任务_完成(task, S_OK, json.c_str()); return task->id; } EdgeView_报告接口缺失(L"EdgeView导航_取进程信息异步"); EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; }
        HRESULT started = environment13->GetProcessExtendedInfos(Microsoft::WRL::Callback<ICoreWebView2GetProcessExtendedInfosCompletedHandler>([this, task](HRESULT error, ICoreWebView2ProcessExtendedInfoCollection* collection) -> HRESULT {
            std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && collection) collection->get_Count(&count);
            for (UINT32 index = 0; index < count; ++index) {
                Microsoft::WRL::ComPtr<ICoreWebView2ProcessExtendedInfo> extended; Microsoft::WRL::ComPtr<ICoreWebView2ProcessInfo> process; Microsoft::WRL::ComPtr<ICoreWebView2FrameInfoCollection> frames;
                INT32 processId = 0; COREWEBVIEW2_PROCESS_KIND kind = COREWEBVIEW2_PROCESS_KIND_BROWSER; UINT32 frameCount = 0;
                if (FAILED(collection->GetValueAtIndex(index, &extended)) || !extended) continue;
                extended->get_ProcessInfo(&process); extended->get_AssociatedFrameInfos(&frames);
                if (process) { process->get_ProcessId(&processId); process->get_Kind(&kind); }
                if (frames) { Microsoft::WRL::ComPtr<ICoreWebView2FrameInfoCollectionIterator> iterator; frames->GetIterator(&iterator); BOOL hasCurrent = FALSE; while (iterator && SUCCEEDED(iterator->get_HasCurrent(&hasCurrent)) && hasCurrent) { ++frameCount; BOOL moved = FALSE; iterator->MoveNext(&moved); if (!moved) break; } }
                if (json.size() > 1) json += L",";
                json += EdgeView_事件数据({{L"processId", EdgeView_数值(processId)}, {L"kind", EdgeView_数值(kind)}, {L"associatedFrameCount", EdgeView_数值(frameCount)}});
            }
            json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK;
        }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    long long EdgeView导航_挂起异步(const wchar_t* controlName, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); if (!task) return 0;
        Microsoft::WRL::ComPtr<ICoreWebView2_3> webView3; if (!instance->webView || FAILED(instance->webView.As(&webView3)) || !webView3) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; }
        HRESULT started = webView3->TrySuspend(Microsoft::WRL::Callback<ICoreWebView2TrySuspendCompletedHandler>([this, task](HRESULT error, BOOL success) -> HRESULT { EdgeView任务_完成(task, error, success ? L"true" : L"false"); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    int EdgeView导航_恢复(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_3> webView3; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView3)) && webView3 && SUCCEEDED(webView3->Resume()) ? 1 : 0; }
    int EdgeView导航_设置虚拟主机(const wchar_t* controlName, const wchar_t* host, const wchar_t* folder, int access) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_3> webView3; return instance && instance->webView && host && folder && SUCCEEDED(instance->webView.As(&webView3)) && webView3 && SUCCEEDED(webView3->SetVirtualHostNameToFolderMapping(host, folder, static_cast<COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND>(access))) ? 1 : 0; }
    int EdgeView导航_清除虚拟主机(const wchar_t* controlName, const wchar_t* host) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_3> webView3; return instance && instance->webView && host && SUCCEEDED(instance->webView.As(&webView3)) && webView3 && SUCCEEDED(webView3->ClearVirtualHostNameToFolderMapping(host)) ? 1 : 0; }

    long long EdgeView脚本_文档预注入异步(const wchar_t* controlName, const wchar_t* script, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); if (!task) return 0;
        HRESULT started = instance->webView->AddScriptToExecuteOnDocumentCreated(script ? script : L"", Microsoft::WRL::Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>([this, task](HRESULT error, LPCWSTR id) -> HRESULT { EdgeView任务_完成(task, error, id); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    int EdgeView脚本_移除文档预注入(const wchar_t* controlName, const wchar_t* scriptId) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && scriptId && SUCCEEDED(instance->webView->RemoveScriptToExecuteOnDocumentCreated(scriptId)) ? 1 : 0; }
    long long EdgeView脚本_执行异步(const wchar_t* controlName, const wchar_t* script, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); if (!task) return 0;
        HRESULT started = instance->webView->ExecuteScript(script ? script : L"", Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>([this, task](HRESULT error, LPCWSTR json) -> HRESULT { EdgeView任务_完成(task, error, json); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    long long EdgeView脚本_执行详情异步(const wchar_t* controlName, const wchar_t* script, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_21> webView21; if (!task) return 0; if (!instance->webView || FAILED(instance->webView.As(&webView21)) || !webView21) { EdgeView_报告接口缺失(L"EdgeView脚本_执行详情异步"); EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = webView21->ExecuteScriptWithResult(script ? script : L"", Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptWithResultCompletedHandler>([this, task](HRESULT error, ICoreWebView2ExecuteScriptResult* result) -> HRESULT { BOOL succeeded = FALSE, hasString = FALSE; LPWSTR json = nullptr, stringValue = nullptr, exceptionName = nullptr, exceptionMessage = nullptr, exceptionJson = nullptr; UINT32 line = 0, column = 0; Microsoft::WRL::ComPtr<ICoreWebView2ScriptException> exception; if (SUCCEEDED(error) && result) { result->get_Succeeded(&succeeded); result->get_ResultAsJson(&json); result->TryGetResultAsString(&stringValue, &hasString); result->get_Exception(&exception); } if (exception) { exception->get_Name(&exceptionName); exception->get_Message(&exceptionMessage); exception->get_LineNumber(&line); exception->get_ColumnNumber(&column); exception->get_ToJson(&exceptionJson); } std::wstring output = EdgeView_事件数据({{L"succeeded", EdgeView_布尔值(succeeded)}, {L"resultAsJson", EdgeView_接管字符串(json)}, {L"hasString", EdgeView_布尔值(hasString)}, {L"stringResult", EdgeView_接管字符串(stringValue)}, {L"exceptionName", EdgeView_接管字符串(exceptionName)}, {L"exceptionMessage", EdgeView_接管字符串(exceptionMessage)}, {L"exceptionLine", EdgeView_数值(line)}, {L"exceptionColumn", EdgeView_数值(column)}, {L"exceptionJson", EdgeView_接管字符串(exceptionJson)}}); EdgeView任务_完成(task, error, output.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    int EdgeView脚本_发送字符串消息(const wchar_t* controlName, const wchar_t* message) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && message && SUCCEEDED(instance->webView->PostWebMessageAsString(message)) ? 1 : 0; }
    int EdgeView脚本_发送JSON消息(const wchar_t* controlName, const wchar_t* json) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && json && SUCCEEDED(instance->webView->PostWebMessageAsJson(json)) ? 1 : 0; }

    Microsoft::WRL::ComPtr<ICoreWebView2Settings> EdgeView设置_取设置(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Settings> settings; auto* instance = EdgeView_查找控件(controlName); if (instance && instance->webView) instance->webView->get_Settings(&settings); return settings; }
    int EdgeView设置_置布尔(const wchar_t* controlName, const wchar_t* member, int version, bool enabled) {
        auto settings = EdgeView设置_取设置(controlName); if (!settings) return 0; const BOOL value = enabled ? TRUE : FALSE; HRESULT result = E_NOINTERFACE;
        if (version == 1) {
            if (wcscmp(member, L"IsScriptEnabled") == 0) result = settings->put_IsScriptEnabled(value);
            else if (wcscmp(member, L"IsWebMessageEnabled") == 0) result = settings->put_IsWebMessageEnabled(value);
            else if (wcscmp(member, L"AreDefaultScriptDialogsEnabled") == 0) result = settings->put_AreDefaultScriptDialogsEnabled(value);
            else if (wcscmp(member, L"IsStatusBarEnabled") == 0) result = settings->put_IsStatusBarEnabled(value);
            else if (wcscmp(member, L"AreDevToolsEnabled") == 0) result = settings->put_AreDevToolsEnabled(value);
            else if (wcscmp(member, L"AreDefaultContextMenusEnabled") == 0) result = settings->put_AreDefaultContextMenusEnabled(value);
            else if (wcscmp(member, L"IsZoomControlEnabled") == 0) result = settings->put_IsZoomControlEnabled(value);
            else if (wcscmp(member, L"IsBuiltInErrorPageEnabled") == 0) result = settings->put_IsBuiltInErrorPageEnabled(value);
        } else if (version == 3) { Microsoft::WRL::ComPtr<ICoreWebView2Settings3> value3; if (SUCCEEDED(settings.As(&value3)) && value3) result = value3->put_AreBrowserAcceleratorKeysEnabled(value); }
        else if (version == 4) { Microsoft::WRL::ComPtr<ICoreWebView2Settings4> value4; if (SUCCEEDED(settings.As(&value4)) && value4) result = wcscmp(member, L"IsPasswordAutosaveEnabled") == 0 ? value4->put_IsPasswordAutosaveEnabled(value) : value4->put_IsGeneralAutofillEnabled(value); }
        else if (version == 5) { Microsoft::WRL::ComPtr<ICoreWebView2Settings5> value5; if (SUCCEEDED(settings.As(&value5)) && value5) result = value5->put_IsPinchZoomEnabled(value); }
        else if (version == 6) { Microsoft::WRL::ComPtr<ICoreWebView2Settings6> value6; if (SUCCEEDED(settings.As(&value6)) && value6) result = value6->put_IsSwipeNavigationEnabled(value); }
        if (result == E_NOINTERFACE) EdgeView_报告接口缺失(member); return SUCCEEDED(result) ? 1 : 0;
    }
    int EdgeView设置_取布尔(const wchar_t* controlName, const wchar_t* member, int version) {
        auto settings = EdgeView设置_取设置(controlName); if (!settings) return 0; BOOL value = FALSE; HRESULT result = E_NOINTERFACE;
        if (version == 1) {
            if (wcscmp(member, L"IsScriptEnabled") == 0) result = settings->get_IsScriptEnabled(&value);
            else if (wcscmp(member, L"IsWebMessageEnabled") == 0) result = settings->get_IsWebMessageEnabled(&value);
            else if (wcscmp(member, L"AreDefaultScriptDialogsEnabled") == 0) result = settings->get_AreDefaultScriptDialogsEnabled(&value);
            else if (wcscmp(member, L"IsStatusBarEnabled") == 0) result = settings->get_IsStatusBarEnabled(&value);
            else if (wcscmp(member, L"AreDevToolsEnabled") == 0) result = settings->get_AreDevToolsEnabled(&value);
            else if (wcscmp(member, L"AreDefaultContextMenusEnabled") == 0) result = settings->get_AreDefaultContextMenusEnabled(&value);
            else if (wcscmp(member, L"IsZoomControlEnabled") == 0) result = settings->get_IsZoomControlEnabled(&value);
            else if (wcscmp(member, L"IsBuiltInErrorPageEnabled") == 0) result = settings->get_IsBuiltInErrorPageEnabled(&value);
        } else if (version == 3) { Microsoft::WRL::ComPtr<ICoreWebView2Settings3> value3; if (SUCCEEDED(settings.As(&value3)) && value3) result = value3->get_AreBrowserAcceleratorKeysEnabled(&value); }
        else if (version == 4) { Microsoft::WRL::ComPtr<ICoreWebView2Settings4> value4; if (SUCCEEDED(settings.As(&value4)) && value4) result = wcscmp(member, L"IsPasswordAutosaveEnabled") == 0 ? value4->get_IsPasswordAutosaveEnabled(&value) : value4->get_IsGeneralAutofillEnabled(&value); }
        else if (version == 5) { Microsoft::WRL::ComPtr<ICoreWebView2Settings5> value5; if (SUCCEEDED(settings.As(&value5)) && value5) result = value5->get_IsPinchZoomEnabled(&value); }
        else if (version == 6) { Microsoft::WRL::ComPtr<ICoreWebView2Settings6> value6; if (SUCCEEDED(settings.As(&value6)) && value6) result = value6->get_IsSwipeNavigationEnabled(&value); }
        if (result == E_NOINTERFACE) EdgeView_报告接口缺失(member); return SUCCEEDED(result) && value ? 1 : 0;
    }
${settingsWrappers()}
    EdgeViewCreationOptions* EdgeView创建选项_取状态(const wchar_t* controlName) { if (!controlName || !controlName[0]) return nullptr; return &edgeViewCreationOptions_[controlName]; }
    int EdgeView创建选项_置独占用户目录(const wchar_t* name, bool value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->exclusiveUserDataFolderAccess = value; return 1; }
    int EdgeView创建选项_取独占用户目录(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state && state->exclusiveUserDataFolderAccess ? 1 : 0; }
    int EdgeView创建选项_置自定义崩溃报告(const wchar_t* name, bool value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->customCrashReporting = value; return 1; }
    int EdgeView创建选项_取自定义崩溃报告(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state && state->customCrashReporting ? 1 : 0; }
    int EdgeView创建选项_置跟踪保护(const wchar_t* name, bool value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->trackingPrevention = value; return 1; }
    int EdgeView创建选项_取跟踪保护(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state && state->trackingPrevention ? 1 : 0; }
    int EdgeView创建选项_置浏览器扩展(const wchar_t* name, bool value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->browserExtensions = value; return 1; }
    int EdgeView创建选项_取浏览器扩展(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state && state->browserExtensions ? 1 : 0; }
    int EdgeView创建选项_置通道搜索方式(const wchar_t* name, int value) { auto* state = EdgeView创建选项_取状态(name); if (!state || value < 0 || value > 1) return 0; state->channelSearchKind = value; return 1; }
    int EdgeView创建选项_取通道搜索方式(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state ? state->channelSearchKind : 0; }
    int EdgeView创建选项_置发布通道(const wchar_t* name, int value) { auto* state = EdgeView创建选项_取状态(name); if (!state || value < 0 || (value & ~15) != 0) return 0; state->releaseChannels = static_cast<unsigned int>(value); return 1; }
    int EdgeView创建选项_取发布通道(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state ? static_cast<int>(state->releaseChannels) : 0; }
    int EdgeView创建选项_置滚动条样式(const wchar_t* name, int value) { auto* state = EdgeView创建选项_取状态(name); if (!state || value < 0 || value > 1) return 0; state->scrollBarStyle = value; return 1; }
    int EdgeView创建选项_取滚动条样式(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state ? state->scrollBarStyle : 0; }
    int EdgeView创建选项_置脚本区域(const wchar_t* name, const wchar_t* value) { auto* state = EdgeView创建选项_取状态(name); std::wstring locale = value ? value : L""; if (!state || locale.size() > 128) return 0; state->scriptLocale = std::move(locale); return 1; }
    std::wstring EdgeView创建选项_取脚本区域(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state ? state->scriptLocale : L""; }
    int EdgeView创建选项_置默认背景色(const wchar_t* name, int value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->defaultBackgroundArgb = value; return 1; }
    int EdgeView创建选项_取默认背景色(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state ? state->defaultBackgroundArgb : 0; }
    int EdgeView创建选项_置宿主输入处理(const wchar_t* name, bool value) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->allowHostInputProcessing = value; return 1; }
    int EdgeView创建选项_取宿主输入处理(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); return state && state->allowHostInputProcessing ? 1 : 0; }
    static bool EdgeView创建选项_协议名有效(const wchar_t* name) { if (!name || !name[0] || !iswalpha(name[0])) return false; size_t count = 0; for (const wchar_t* cursor = name; *cursor; ++cursor, ++count) if (count >= 64 || !(iswalnum(*cursor) || *cursor == L'+' || *cursor == L'-' || *cursor == L'.')) return false; return true; }
    int EdgeView创建选项_添加自定义协议(const wchar_t* controlName, const wchar_t* schemeName, bool hasAuthority, bool treatAsSecure, const wchar_t* allowedOrigins) { auto* state = EdgeView创建选项_取状态(controlName); if (!state || !EdgeView创建选项_协议名有效(schemeName) || state->customSchemes.size() >= 32) return 0; EdgeViewCustomSchemeSpec scheme; scheme.name = schemeName; scheme.hasAuthority = hasAuthority; scheme.treatAsSecure = treatAsSecure; std::wstring origins = allowedOrigins ? allowedOrigins : L""; size_t start = 0; while (start <= origins.size()) { size_t end = origins.find(L';', start); std::wstring origin = origins.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start); if (!origin.empty()) { if (origin.size() > 2048 || (origin.rfind(L"https://", 0) != 0 && origin.rfind(L"http://", 0) != 0)) return 0; scheme.allowedOrigins.push_back(origin); } if (end == std::wstring::npos) break; start = end + 1; } state->customSchemes.push_back(std::move(scheme)); return 1; }
    int EdgeView创建选项_清除自定义协议(const wchar_t* name) { auto* state = EdgeView创建选项_取状态(name); if (!state) return 0; state->customSchemes.clear(); return 1; }
    int EdgeView创建选项_重建控件(const wchar_t* controlName) { return EdgeView_创建控件(controlName); }

    int EdgeView设置_置用户代理(const wchar_t* controlName, const wchar_t* userAgent) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings2> settings2; return settings && SUCCEEDED(settings.As(&settings2)) && settings2 && SUCCEEDED(settings2->put_UserAgent(userAgent ? userAgent : L"")) ? 1 : 0; }
    std::wstring EdgeView设置_取用户代理(const wchar_t* controlName) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings2> settings2; LPWSTR value = nullptr; if (settings && SUCCEEDED(settings.As(&settings2)) && settings2) settings2->get_UserAgent(&value); return EdgeView_接管字符串(value); }
    int EdgeView设置_置缩放(const wchar_t* controlName, double zoom) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->controller && zoom > 0 && SUCCEEDED(instance->controller->put_ZoomFactor(zoom)) ? 1 : 0; }
    double EdgeView设置_取缩放(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); double value = 0; if (instance && instance->controller) instance->controller->get_ZoomFactor(&value); return value; }
    int EdgeView设置_置静音(const wchar_t* controlName, bool muted) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_8> webView8; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView8)) && webView8 && SUCCEEDED(webView8->put_IsMuted(muted ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView设置_取静音(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_8> webView8; BOOL value = FALSE; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView8)) && webView8 && SUCCEEDED(webView8->get_IsMuted(&value)) && value ? 1 : 0; }
    int EdgeView设置_置背景色(const wchar_t* controlName, int argb) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller2> controller2; COREWEBVIEW2_COLOR color = { static_cast<BYTE>((argb >> 24) & 255), static_cast<BYTE>((argb >> 16) & 255), static_cast<BYTE>((argb >> 8) & 255), static_cast<BYTE>(argb & 255) }; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller2)) && controller2 && SUCCEEDED(controller2->put_DefaultBackgroundColor(color)) ? 1 : 0; }
    int EdgeView设置_置可见(const wchar_t* controlName, bool visible) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->controller && SUCCEEDED(instance->controller->put_IsVisible(visible ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView设置_取可见(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); BOOL value = FALSE; return instance && instance->controller && SUCCEEDED(instance->controller->get_IsVisible(&value)) && value ? 1 : 0; }
    int EdgeView设置_置边界(const wchar_t* controlName, int left, int top, int width, int height) { auto* instance = EdgeView_查找控件(controlName); RECT bounds = { left, top, left + width, top + height }; return instance && instance->controller && width >= 0 && height >= 0 && SUCCEEDED(instance->controller->put_Bounds(bounds)) ? 1 : 0; }
    std::wstring EdgeView设置_取边界JSON(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); RECT bounds = {}; if (!instance || !instance->controller || FAILED(instance->controller->get_Bounds(&bounds))) return L"{}"; return EdgeView_事件数据({{L"left", EdgeView_数值(bounds.left)}, {L"top", EdgeView_数值(bounds.top)}, {L"width", EdgeView_数值(bounds.right - bounds.left)}, {L"height", EdgeView_数值(bounds.bottom - bounds.top)}}); }
    int EdgeView设置_移动焦点(const wchar_t* controlName, int reason) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->controller && SUCCEEDED(instance->controller->MoveFocus(static_cast<COREWEBVIEW2_MOVE_FOCUS_REASON>(reason))) ? 1 : 0; }
    int EdgeView设置_置光栅化缩放(const wchar_t* controlName, double scale) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; return instance && instance->controller && scale > 0 && SUCCEEDED(instance->controller.As(&controller3)) && controller3 && SUCCEEDED(controller3->put_RasterizationScale(scale)) ? 1 : 0; }
    double EdgeView设置_取光栅化缩放(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; double value = 0; if (instance && instance->controller && SUCCEEDED(instance->controller.As(&controller3)) && controller3) controller3->get_RasterizationScale(&value); return value; }
    int EdgeView设置_置自动检测显示器缩放(const wchar_t* controlName, bool enabled) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller3)) && controller3 && SUCCEEDED(controller3->put_ShouldDetectMonitorScaleChanges(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView设置_取自动检测显示器缩放(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; BOOL value = FALSE; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller3)) && controller3 && SUCCEEDED(controller3->get_ShouldDetectMonitorScaleChanges(&value)) && value ? 1 : 0; }
    int EdgeView设置_置边界模式(const wchar_t* controlName, int mode) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller3)) && controller3 && SUCCEEDED(controller3->put_BoundsMode(static_cast<COREWEBVIEW2_BOUNDS_MODE>(mode))) ? 1 : 0; }
    int EdgeView设置_取边界模式(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3; COREWEBVIEW2_BOUNDS_MODE value = COREWEBVIEW2_BOUNDS_MODE_USE_RAW_PIXELS; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller3)) && controller3 && SUCCEEDED(controller3->get_BoundsMode(&value)) ? static_cast<int>(value) : 0; }
    int EdgeView设置_置允许外部拖放(const wchar_t* controlName, bool enabled) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller4> controller4; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller4)) && controller4 && SUCCEEDED(controller4->put_AllowExternalDrop(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView设置_取允许外部拖放(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Controller4> controller4; BOOL value = FALSE; return instance && instance->controller && SUCCEEDED(instance->controller.As(&controller4)) && controller4 && SUCCEEDED(controller4->get_AllowExternalDrop(&value)) && value ? 1 : 0; }
    int EdgeView设置_置PDF工具栏隐藏项(const wchar_t* controlName, int mask) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings7> settings7; return settings && SUCCEEDED(settings.As(&settings7)) && settings7 && SUCCEEDED(settings7->put_HiddenPdfToolbarItems(static_cast<COREWEBVIEW2_PDF_TOOLBAR_ITEMS>(mask))) ? 1 : 0; }
    int EdgeView设置_取PDF工具栏隐藏项(const wchar_t* controlName) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings7> settings7; COREWEBVIEW2_PDF_TOOLBAR_ITEMS value = COREWEBVIEW2_PDF_TOOLBAR_ITEMS_NONE; return settings && SUCCEEDED(settings.As(&settings7)) && settings7 && SUCCEEDED(settings7->get_HiddenPdfToolbarItems(&value)) ? static_cast<int>(value) : 0; }
    int EdgeView设置_置信誉检查(const wchar_t* controlName, bool enabled) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings8> settings8; return settings && SUCCEEDED(settings.As(&settings8)) && settings8 && SUCCEEDED(settings8->put_IsReputationCheckingRequired(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView设置_取信誉检查(const wchar_t* controlName) { auto settings = EdgeView设置_取设置(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Settings8> settings8; BOOL value = FALSE; return settings && SUCCEEDED(settings.As(&settings8)) && settings8 && SUCCEEDED(settings8->get_IsReputationCheckingRequired(&value)) && value ? 1 : 0; }
    int EdgeView设置_置内存目标级别(const wchar_t* controlName, int level) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_19> webView19; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView19)) && webView19 && SUCCEEDED(webView19->put_MemoryUsageTargetLevel(static_cast<COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL>(level))) ? 1 : 0; }
    int EdgeView设置_取内存目标级别(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_19> webView19; COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL value = COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView19)) && webView19 && SUCCEEDED(webView19->get_MemoryUsageTargetLevel(&value)) ? static_cast<int>(value) : 0; }

    bool EdgeView会话_取Profile(const wchar_t* controlName, Microsoft::WRL::ComPtr<ICoreWebView2Profile>& profile) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_13> webView13; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView13)) && webView13 && SUCCEEDED(webView13->get_Profile(&profile)) && profile; }
    std::wstring EdgeView会话_取ProfileJSON(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; if (!EdgeView会话_取Profile(controlName, profile)) return L"{}"; LPWSTR name = nullptr, path = nullptr, download = nullptr; BOOL privateMode = FALSE; profile->get_ProfileName(&name); profile->get_ProfilePath(&path); profile->get_IsInPrivateModeEnabled(&privateMode); profile->get_DefaultDownloadFolderPath(&download); return EdgeView_事件数据({{L"name", EdgeView_接管字符串(name)}, {L"path", EdgeView_接管字符串(path)}, {L"inPrivate", EdgeView_布尔值(privateMode)}, {L"downloadFolder", EdgeView_接管字符串(download)}}); }
    Microsoft::WRL::ComPtr<ICoreWebView2CookieManager> EdgeView会话_取Cookie管理器(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2CookieManager> manager; Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile5> profile5; if (EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile5)) && profile5) profile5->get_CookieManager(&manager); if (manager) return manager; auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_2> webView2; if (instance && instance->webView && SUCCEEDED(instance->webView.As(&webView2)) && webView2) webView2->get_CookieManager(&manager); return manager; }
    long long EdgeView会话_取Cookie异步(const wchar_t* controlName, const wchar_t* uri, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto manager = EdgeView会话_取Cookie管理器(controlName); if (!task) return 0; if (!manager) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = manager->GetCookies(uri ? uri : L"", Microsoft::WRL::Callback<ICoreWebView2GetCookiesCompletedHandler>([this, task](HRESULT error, ICoreWebView2CookieList* list) -> HRESULT { std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && list) list->get_Count(&count); for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2Cookie> cookie; list->GetValueAtIndex(index, &cookie); LPWSTR name = nullptr, value = nullptr, domain = nullptr, path = nullptr; if (cookie) { cookie->get_Name(&name); cookie->get_Value(&value); cookie->get_Domain(&domain); cookie->get_Path(&path); } if (index) json += L","; json += EdgeView_事件数据({{L"name", EdgeView_接管字符串(name)}, {L"value", EdgeView_接管字符串(value)}, {L"domain", EdgeView_接管字符串(domain)}, {L"path", EdgeView_接管字符串(path)}}); } json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    int EdgeView会话_置Cookie(const wchar_t* controlName, const wchar_t* name, const wchar_t* value, const wchar_t* domain, const wchar_t* path) { auto manager = EdgeView会话_取Cookie管理器(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Cookie> cookie; return manager && name && domain && SUCCEEDED(manager->CreateCookie(name, value ? value : L"", domain, path ? path : L"/", &cookie)) && cookie && SUCCEEDED(manager->AddOrUpdateCookie(cookie.Get())) ? 1 : 0; }
    int EdgeView会话_删除Cookie(const wchar_t* controlName, const wchar_t* name, const wchar_t* domain, const wchar_t* path) { auto manager = EdgeView会话_取Cookie管理器(controlName); return manager && name && domain && SUCCEEDED(manager->DeleteCookiesWithDomainAndPath(name, domain, path ? path : L"/")) ? 1 : 0; }
    int EdgeView会话_删除全部Cookie(const wchar_t* controlName) { auto manager = EdgeView会话_取Cookie管理器(controlName); return manager && SUCCEEDED(manager->DeleteAllCookies()) ? 1 : 0; }
    long long EdgeView会话_清理浏览数据异步(const wchar_t* controlName, long long kinds, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile2> profile2; if (!task) return 0; if (!EdgeView会话_取Profile(controlName, profile) || FAILED(profile.As(&profile2)) || !profile2) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = profile2->ClearBrowsingData(static_cast<COREWEBVIEW2_BROWSING_DATA_KINDS>(kinds), Microsoft::WRL::Callback<ICoreWebView2ClearBrowsingDataCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView会话_清理全部浏览数据异步(const wchar_t* controlName, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile2> profile2; if (!task) return 0; if (!EdgeView会话_取Profile(controlName, profile) || FAILED(profile.As(&profile2)) || !profile2) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = profile2->ClearBrowsingDataAll(Microsoft::WRL::Callback<ICoreWebView2ClearBrowsingDataCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView会话_按时间清理浏览数据异步(const wchar_t* controlName, long long kinds, double startTime, double endTime, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile2> profile2; if (!task) return 0; if (startTime > endTime || !EdgeView会话_取Profile(controlName, profile) || FAILED(profile.As(&profile2)) || !profile2) { EdgeView任务_完成(task, E_INVALIDARG, L""); return task->id; } HRESULT started = profile2->ClearBrowsingDataInTimeRange(static_cast<COREWEBVIEW2_BROWSING_DATA_KINDS>(kinds), startTime, endTime, Microsoft::WRL::Callback<ICoreWebView2ClearBrowsingDataCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    int EdgeView会话_置下载目录(const wchar_t* controlName, const wchar_t* folder) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; return EdgeView会话_取Profile(controlName, profile) && folder && SUCCEEDED(profile->put_DefaultDownloadFolderPath(folder)) ? 1 : 0; }
    std::wstring EdgeView会话_取下载目录(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; LPWSTR value = nullptr; if (EdgeView会话_取Profile(controlName, profile)) profile->get_DefaultDownloadFolderPath(&value); return EdgeView_接管字符串(value); }
    int EdgeView会话_置配色方案(const wchar_t* controlName, int scheme) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile->put_PreferredColorScheme(static_cast<COREWEBVIEW2_PREFERRED_COLOR_SCHEME>(scheme))) ? 1 : 0; }
    int EdgeView会话_取配色方案(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; COREWEBVIEW2_PREFERRED_COLOR_SCHEME value = COREWEBVIEW2_PREFERRED_COLOR_SCHEME_AUTO; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile->get_PreferredColorScheme(&value)) ? static_cast<int>(value) : 0; }
    int EdgeView会话_置跟踪保护(const wchar_t* controlName, int level) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile3> profile3; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile3)) && profile3 && SUCCEEDED(profile3->put_PreferredTrackingPreventionLevel(static_cast<COREWEBVIEW2_TRACKING_PREVENTION_LEVEL>(level))) ? 1 : 0; }
    int EdgeView会话_取跟踪保护(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile3> profile3; COREWEBVIEW2_TRACKING_PREVENTION_LEVEL value = COREWEBVIEW2_TRACKING_PREVENTION_LEVEL_BALANCED; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile3)) && profile3 && SUCCEEDED(profile3->get_PreferredTrackingPreventionLevel(&value)) ? static_cast<int>(value) : 0; }
    int EdgeView会话_置密码保存(const wchar_t* controlName, bool enabled) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile6> profile6; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile6)) && profile6 && SUCCEEDED(profile6->put_IsPasswordAutosaveEnabled(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView会话_取密码保存(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile6> profile6; BOOL value = FALSE; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile6)) && profile6 && SUCCEEDED(profile6->get_IsPasswordAutosaveEnabled(&value)) && value ? 1 : 0; }
    int EdgeView会话_置自动填充(const wchar_t* controlName, bool enabled) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile6> profile6; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile6)) && profile6 && SUCCEEDED(profile6->put_IsGeneralAutofillEnabled(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView会话_取自动填充(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile6> profile6; BOOL value = FALSE; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile6)) && profile6 && SUCCEEDED(profile6->get_IsGeneralAutofillEnabled(&value)) && value ? 1 : 0; }
    int EdgeView会话_删除Profile(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile8> profile8; return EdgeView会话_取Profile(controlName, profile) && SUCCEEDED(profile.As(&profile8)) && profile8 && SUCCEEDED(profile8->Delete()) ? 1 : 0; }

    Microsoft::WRL::ComPtr<ICoreWebView2DownloadOperation> EdgeView下载_取操作(const wchar_t* controlName, long long downloadId) { auto* instance = EdgeView_查找控件(controlName); if (!instance) return {}; auto found = instance->downloads.find(downloadId); return found == instance->downloads.end() ? Microsoft::WRL::ComPtr<ICoreWebView2DownloadOperation>() : found->second; }
    std::wstring EdgeView下载_取请求路径(const wchar_t* controlName, long long downloadId) { auto* instance = EdgeView_查找控件(controlName); if (!instance) return L""; auto found = instance->eventDownloadPaths.find(downloadId); return found == instance->eventDownloadPaths.end() ? L"" : found->second; }
    long long EdgeView下载_取路径错误(const wchar_t* controlName, long long downloadId) { auto* instance = EdgeView_查找控件(controlName); if (!instance) return 0; auto found = instance->eventDownloadPathErrors.find(downloadId); return found == instance->eventDownloadPathErrors.end() ? 0 : static_cast<long long>(found->second); }
    std::wstring EdgeView下载_取状态JSON(const wchar_t* controlName, long long downloadId) { auto operation = EdgeView下载_取操作(controlName, downloadId); if (!operation) return L"{}"; INT64 received = 0, total = 0; BOOL canResume = FALSE; COREWEBVIEW2_DOWNLOAD_STATE state = COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS; COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON interrupt = COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON_NONE; LPWSTR path = nullptr, uri = nullptr, mime = nullptr, disposition = nullptr, estimated = nullptr; operation->get_BytesReceived(&received); operation->get_TotalBytesToReceive(&total); operation->get_State(&state); operation->get_ResultFilePath(&path); operation->get_CanResume(&canResume); operation->get_Uri(&uri); operation->get_MimeType(&mime); operation->get_ContentDisposition(&disposition); operation->get_EstimatedEndTime(&estimated); operation->get_InterruptReason(&interrupt); return EdgeView_事件数据({{L"id", EdgeView_数值(downloadId)}, {L"state", EdgeView_数值(state)}, {L"received", EdgeView_数值(received)}, {L"total", EdgeView_数值(total)}, {L"path", EdgeView_接管字符串(path)}, {L"canResume", EdgeView_布尔值(canResume)}, {L"uri", EdgeView_接管字符串(uri)}, {L"mimeType", EdgeView_接管字符串(mime)}, {L"contentDisposition", EdgeView_接管字符串(disposition)}, {L"estimatedEndTime", EdgeView_接管字符串(estimated)}, {L"interruptReason", EdgeView_数值(interrupt)}, {L"resultFilePathError", EdgeView_数值(EdgeView下载_取路径错误(controlName, downloadId))}, {L"pendingResultFilePath", EdgeView下载_取请求路径(controlName, downloadId)}}); }
    int EdgeView下载_暂停(const wchar_t* controlName, long long downloadId) { auto operation = EdgeView下载_取操作(controlName, downloadId); return operation && SUCCEEDED(operation->Pause()) ? 1 : 0; }
    int EdgeView下载_恢复(const wchar_t* controlName, long long downloadId) { auto operation = EdgeView下载_取操作(controlName, downloadId); return operation && SUCCEEDED(operation->Resume()) ? 1 : 0; }
    int EdgeView下载_取消(const wchar_t* controlName, long long downloadId) { auto operation = EdgeView下载_取操作(controlName, downloadId); return operation && SUCCEEDED(operation->Cancel()) ? 1 : 0; }
    int EdgeView下载_显示默认窗口(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView9)) && webView9 && SUCCEEDED(webView9->OpenDefaultDownloadDialog()) ? 1 : 0; }
    int EdgeView下载_关闭默认窗口(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView9)) && webView9 && SUCCEEDED(webView9->CloseDefaultDownloadDialog()) ? 1 : 0; }
    int EdgeView下载_置窗口角对齐(const wchar_t* controlName, int alignment) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView9)) && webView9 && SUCCEEDED(webView9->put_DefaultDownloadDialogCornerAlignment(static_cast<COREWEBVIEW2_DEFAULT_DOWNLOAD_DIALOG_CORNER_ALIGNMENT>(alignment))) ? 1 : 0; }
    int EdgeView下载_取窗口角对齐(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; COREWEBVIEW2_DEFAULT_DOWNLOAD_DIALOG_CORNER_ALIGNMENT value = COREWEBVIEW2_DEFAULT_DOWNLOAD_DIALOG_CORNER_ALIGNMENT_TOP_LEFT; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView9)) && webView9 && SUCCEEDED(webView9->get_DefaultDownloadDialogCornerAlignment(&value)) ? static_cast<int>(value) : 0; }
    int EdgeView下载_置窗口边距(const wchar_t* controlName, int horizontal, int vertical) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; POINT value = { horizontal, vertical }; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView9)) && webView9 && SUCCEEDED(webView9->put_DefaultDownloadDialogMargin(value)) ? 1 : 0; }
    std::wstring EdgeView下载_取窗口边距JSON(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9; POINT value = {}; if (!instance || !instance->webView || FAILED(instance->webView.As(&webView9)) || !webView9 || FAILED(webView9->get_DefaultDownloadDialogMargin(&value))) return L"{}"; return EdgeView_事件数据({{L"x", EdgeView_数值(value.x)}, {L"y", EdgeView_数值(value.y)}}); }

    Microsoft::WRL::ComPtr<ICoreWebView2Find> EdgeView查找_取对象(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_28> webView28; Microsoft::WRL::ComPtr<ICoreWebView2Find> find; if (instance && instance->webView && SUCCEEDED(instance->webView.As(&webView28)) && webView28) webView28->get_Find(&find); return find; }
    long long EdgeView查找_开始异步(const wchar_t* controlName, const wchar_t* text, const wchar_t*, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto find = EdgeView查找_取对象(controlName); Microsoft::WRL::ComPtr<ICoreWebView2FindOptions> options; Microsoft::WRL::ComPtr<ICoreWebView2Environment15> environment15; if (!task) return 0; if (!find || !instance->environment || FAILED(instance->environment.As(&environment15)) || !environment15 || FAILED(environment15->CreateFindOptions(&options)) || !options) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } options->put_FindTerm(text ? text : L""); HRESULT started = find->Start(options.Get(), Microsoft::WRL::Callback<ICoreWebView2FindStartCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    int EdgeView查找_下一项(const wchar_t* controlName) { auto find = EdgeView查找_取对象(controlName); return find && SUCCEEDED(find->FindNext()) ? 1 : 0; }
    int EdgeView查找_上一项(const wchar_t* controlName) { auto find = EdgeView查找_取对象(controlName); return find && SUCCEEDED(find->FindPrevious()) ? 1 : 0; }
    int EdgeView查找_停止(const wchar_t* controlName) { auto find = EdgeView查找_取对象(controlName); return find && SUCCEEDED(find->Stop()) ? 1 : 0; }
    std::wstring EdgeView查找_取状态JSON(const wchar_t* controlName) { auto find = EdgeView查找_取对象(controlName); INT32 count = 0, active = 0; if (!find) return L"{}"; find->get_MatchCount(&count); find->get_ActiveMatchIndex(&active); return EdgeView_事件数据({{L"matchCount", EdgeView_数值(count)}, {L"activeMatchIndex", EdgeView_数值(active)}}); }

    void EdgeView_确保父目录(const std::wstring& path) {
        const size_t slash = path.find_last_of(L"\\/");
        if (slash == std::wstring::npos || slash == 0) return;
        std::wstring segment = path.substr(0, slash);
        for (size_t i = 1; i <= segment.size(); ++i) {
            if (i == segment.size() || segment[i] == L'\\' || segment[i] == L'/') {
                const std::wstring prefix = segment.substr(0, i);
                if (!prefix.empty()) CreateDirectoryW(prefix.c_str(), nullptr);
            }
        }
    }
    void EdgeView_报告事件决策窗口缺失(const wchar_t* command) {
        std::wstring message = L"EdgeView 事件决策窗口未激活：";
        message += command ? command : L"";
        message += L" 只有在同步事件处理器执行期间调用它才有效。";
        调试输出(message.c_str());
    }
    std::wstring EdgeView_取绝对路径(const wchar_t* filePath) {
        if (!filePath || !filePath[0]) return L"";
        wchar_t buffer[8192] = {};
        DWORD length = GetFullPathNameW(filePath, static_cast<DWORD>(sizeof(buffer) / sizeof(buffer[0])), buffer, nullptr);
        if (length > 0 && length < static_cast<DWORD>(sizeof(buffer) / sizeof(buffer[0]))) return std::wstring(buffer, length);
        return std::wstring(filePath);
    }
    static std::wstring EdgeView_JSON取原始值(const std::wstring& json, const wchar_t* field, bool* found) {
        if (found) *found = false;
        if (!field) return L"";
        std::wstring needle = L"\""; needle += field; needle += L"\":";
        size_t position = json.find(needle);
        if (position == std::wstring::npos) return L"";
        if (found) *found = true;
        position += needle.size();
        while (position < json.size() && (json[position] == L' ' || json[position] == L'\t' || json[position] == L'\r' || json[position] == L'\n')) ++position;
        if (position >= json.size()) return L"";
        if (json[position] != L'"') {
            std::wstring value;
            for (; position < json.size(); ++position) { wchar_t character = json[position]; if (character == L',' || character == L'}' || character == L']') break; value.push_back(character); }
            while (!value.empty() && (value.back() == L' ' || value.back() == L'\t' || value.back() == L'\r' || value.back() == L'\n')) value.pop_back();
            return value;
        }
        std::wstring value; ++position; bool escaped = false;
        for (; position < json.size(); ++position) {
            wchar_t character = json[position];
            if (escaped) { value.push_back(character); escaped = false; }
            else if (character == static_cast<wchar_t>(92)) escaped = true;
            else if (character == L'"') break;
            else value.push_back(character);
        }
        return value;
    }
    bool EdgeView_打印设置JSON可用(const wchar_t* settingsJson) { return !settingsJson || !settingsJson[0] || settingsJson[0] == L'{'; }
    void EdgeView打印_应用设置JSON(const wchar_t* controlName, const wchar_t* settingsJson) {
        if (!settingsJson || !settingsJson[0]) return;
        const std::wstring json(settingsJson); bool found = false; std::wstring value;
        value = EdgeView_JSON取原始值(json, L"orientation", &found); if (found) EdgeView打印_置方向(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"pagesPerSide", &found); if (found) EdgeView打印_置每面页数(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"copies", &found); if (found) EdgeView打印_置份数(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"collation", &found); if (found) EdgeView打印_置逐份打印(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"colorMode", &found); if (found) EdgeView打印_置颜色模式(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"duplex", &found); if (found) EdgeView打印_置双面模式(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"mediaSize", &found); if (found) EdgeView打印_置纸张类型(controlName, static_cast<int>(wcstol(value.c_str(), nullptr, 10)));
        value = EdgeView_JSON取原始值(json, L"scaleFactor", &found); if (found) EdgeView打印_置缩放倍数(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"pageWidth", &found); if (found) EdgeView打印_置纸张宽度(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"pageHeight", &found); if (found) EdgeView打印_置纸张高度(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"marginTop", &found); if (found) EdgeView打印_置上边距(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"marginBottom", &found); if (found) EdgeView打印_置下边距(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"marginLeft", &found); if (found) EdgeView打印_置左边距(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"marginRight", &found); if (found) EdgeView打印_置右边距(controlName, wcstod(value.c_str(), nullptr));
        value = EdgeView_JSON取原始值(json, L"shouldPrintBackgrounds", &found); if (found) EdgeView打印_置打印背景(controlName, value == L"true");
        value = EdgeView_JSON取原始值(json, L"shouldPrintSelectionOnly", &found); if (found) EdgeView打印_置仅打印选区(controlName, value == L"true");
        value = EdgeView_JSON取原始值(json, L"shouldPrintHeaderAndFooter", &found); if (found) EdgeView打印_置打印页眉页脚(controlName, value == L"true");
        value = EdgeView_JSON取原始值(json, L"headerTitle", &found); if (found) EdgeView打印_置页眉标题(controlName, value.c_str());
        value = EdgeView_JSON取原始值(json, L"footerUri", &found); if (found) EdgeView打印_置页脚地址(controlName, value.c_str());
        value = EdgeView_JSON取原始值(json, L"pageRanges", &found); if (found) EdgeView打印_置页面范围(controlName, value.c_str());
        value = EdgeView_JSON取原始值(json, L"printerName", &found); if (found) EdgeView打印_置打印机名称(controlName, value.c_str());
    }
    void EdgeView任务_补充说明(const std::shared_ptr<EdgeViewTaskState>& task, const wchar_t* hint) { if (task && task->status == 2 && hint && hint[0]) { task->error += L' '; task->error += hint; } }
    Microsoft::WRL::ComPtr<ICoreWebView2PrintSettings> EdgeView打印_取设置(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Environment6> environment6; if (!instance || !instance->environment) return {}; if (!instance->printSettings && SUCCEEDED(instance->environment.As(&environment6)) && environment6) environment6->CreatePrintSettings(&instance->printSettings); return instance->printSettings; }
    Microsoft::WRL::ComPtr<ICoreWebView2PrintSettings2> EdgeView打印_取设置2(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2PrintSettings2> settings2; auto settings = EdgeView打印_取设置(controlName); if (settings) settings.As(&settings2); return settings2; }
${printSettingsWrappers()}
    int EdgeView打印_显示界面(const wchar_t* controlName, int kind) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_16> webView16; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView16)) && webView16 && SUCCEEDED(webView16->ShowPrintUI(static_cast<COREWEBVIEW2_PRINT_DIALOG_KIND>(kind))) ? 1 : 0; }
    long long EdgeView打印_PDF异步(const wchar_t* controlName, const wchar_t* filePath, const wchar_t* settingsJson, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_7> webView7; if (!task) return 0; if (!filePath || !filePath[0] || !instance->webView || FAILED(instance->webView.As(&webView7)) || !webView7) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } if (!EdgeView_打印设置JSON可用(settingsJson)) { EdgeView任务_完成(task, E_INVALIDARG, L""); EdgeView任务_补充说明(task, L"设置JSON 必须是 JSON 对象文本，例如 {\"scaleFactor\":0.5}。"); return task->id; } const std::wstring target = EdgeView_取绝对路径(filePath); EdgeView打印_应用设置JSON(controlName, settingsJson); HRESULT started = webView7->PrintToPdf(target.c_str(), EdgeView打印_取设置(controlName).Get(), Microsoft::WRL::Callback<ICoreWebView2PrintToPdfCompletedHandler>([this, task, target](HRESULT error, BOOL success) -> HRESULT { EdgeView任务_完成(task, SUCCEEDED(error) && success ? S_OK : FAILED(error) ? error : E_FAIL, target.c_str()); EdgeView任务_补充说明(task, L"PDF 导出失败时请确认目标目录已存在且文件路径是绝对路径。"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView打印_PDF流到文件异步(const wchar_t* controlName, const wchar_t* filePath, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_16> webView16; if (!task) return 0; if (!filePath || !filePath[0] || !instance->webView || FAILED(instance->webView.As(&webView16)) || !webView16) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } const std::wstring target = EdgeView_取绝对路径(filePath); auto settings = EdgeView打印_取设置(controlName); HRESULT started = webView16->PrintToPdfStream(settings.Get(), Microsoft::WRL::Callback<ICoreWebView2PrintToPdfStreamCompletedHandler>([this, task, target](HRESULT error, IStream* stream) -> HRESULT { if (SUCCEEDED(error) && !EdgeView_保存流到文件(stream, target.c_str())) error = E_FAIL; EdgeView任务_完成(task, error, target.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView打印_打印异步(const wchar_t* controlName, const wchar_t* settingsJson, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_16> webView16; if (!task) return 0; if (!instance->webView || FAILED(instance->webView.As(&webView16)) || !webView16) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } if (!EdgeView_打印设置JSON可用(settingsJson)) { EdgeView任务_完成(task, E_INVALIDARG, L""); EdgeView任务_补充说明(task, L"设置JSON 必须是 JSON 对象文本，例如 {\"scaleFactor\":0.5}。"); return task->id; } EdgeView打印_应用设置JSON(controlName, settingsJson); HRESULT started = webView16->Print(EdgeView打印_取设置(controlName).Get(), Microsoft::WRL::Callback<ICoreWebView2PrintCompletedHandler>([this, task](HRESULT error, COREWEBVIEW2_PRINT_STATUS status) -> HRESULT { std::wstring result = EdgeView_数值(status); EdgeView任务_完成(task, error, result.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }

    bool EdgeView_保存流到文件(IStream* stream, const wchar_t* filePath) { if (!stream || !filePath || !filePath[0]) return false; LARGE_INTEGER start = {}; stream->Seek(start, STREAM_SEEK_SET, nullptr); HANDLE file = CreateFileW(filePath, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false; BYTE buffer[16384]; ULONG read = 0; bool ok = true; while (SUCCEEDED(stream->Read(buffer, sizeof(buffer), &read)) && read > 0) { DWORD written = 0; if (!WriteFile(file, buffer, read, &written, nullptr) || written != read) { ok = false; break; } } CloseHandle(file); return ok; }
    long long EdgeView媒体_截图异步(const wchar_t* controlName, const wchar_t* filePath, int format, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<IStream> stream; if (!task) return 0; if (!filePath || FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &stream)) || !stream) { EdgeView任务_完成(task, E_FAIL, L""); return task->id; } const std::wstring target = EdgeView_取绝对路径(filePath); HRESULT started = instance->webView->CapturePreview(static_cast<COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT>(format), stream.Get(), Microsoft::WRL::Callback<ICoreWebView2CapturePreviewCompletedHandler>([this, task, stream, target](HRESULT error) -> HRESULT { if (SUCCEEDED(error) && !EdgeView_保存流到文件(stream.Get(), target.c_str())) error = E_FAIL; EdgeView任务_完成(task, error, target.c_str()); EdgeView任务_补充说明(task, L"截图写入失败时请确认目标目录已存在。"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView媒体_取Favicon异步(const wchar_t* controlName, const wchar_t* filePath, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_15> webView15; if (!task) return 0; if (!filePath || !filePath[0] || !instance->webView || FAILED(instance->webView.As(&webView15)) || !webView15) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } const std::wstring target = EdgeView_取绝对路径(filePath); HRESULT started = webView15->GetFavicon(COREWEBVIEW2_FAVICON_IMAGE_FORMAT_PNG, Microsoft::WRL::Callback<ICoreWebView2GetFaviconCompletedHandler>([this, task, target](HRESULT error, IStream* stream) -> HRESULT { if (SUCCEEDED(error) && !EdgeView_保存流到文件(stream, target.c_str())) error = E_FAIL; EdgeView任务_完成(task, error, target.c_str()); EdgeView任务_补充说明(task, L"图标写入失败时请确认目标目录已存在。"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    int EdgeView媒体_取全屏状态(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); BOOL value = FALSE; return instance && instance->webView && SUCCEEDED(instance->webView->get_ContainsFullScreenElement(&value)) && value ? 1 : 0; }
    int EdgeView媒体_取音频状态(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_8> webView8; BOOL value = FALSE; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView8)) && webView8 && SUCCEEDED(webView8->get_IsDocumentPlayingAudio(&value)) && value ? 1 : 0; }

    int EdgeView开发者工具_打开(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && SUCCEEDED(instance->webView->OpenDevToolsWindow()) ? 1 : 0; }
    int EdgeView开发者工具_打开任务管理器(const wchar_t* controlName) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_6> webView6; return instance && instance->webView && SUCCEEDED(instance->webView.As(&webView6)) && webView6 && SUCCEEDED(webView6->OpenTaskManagerWindow()) ? 1 : 0; }
    long long EdgeView开发者工具_调用异步(const wchar_t* controlName, const wchar_t* method, const wchar_t* json, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); if (!task) return 0; HRESULT started = instance->webView->CallDevToolsProtocolMethod(method ? method : L"", json && json[0] ? json : L"{}", Microsoft::WRL::Callback<ICoreWebView2CallDevToolsProtocolMethodCompletedHandler>([this, task](HRESULT error, LPCWSTR result) -> HRESULT { EdgeView任务_完成(task, error, result); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView开发者工具_调用会话异步(const wchar_t* controlName, const wchar_t* sessionId, const wchar_t* method, const wchar_t* json, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_11> webView11; if (!task) return 0; if (!instance->webView || FAILED(instance->webView.As(&webView11)) || !webView11) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = webView11->CallDevToolsProtocolMethodForSession(sessionId ? sessionId : L"", method ? method : L"", json && json[0] ? json : L"{}", Microsoft::WRL::Callback<ICoreWebView2CallDevToolsProtocolMethodCompletedHandler>([this, task](HRESULT error, LPCWSTR result) -> HRESULT { EdgeView任务_完成(task, error, result); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }

    int EdgeView资源_添加过滤器(const wchar_t* controlName, const wchar_t* pattern, int context, int sourceKinds) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_22> webView22; if (!instance || !instance->webView || !pattern) return 0; if (SUCCEEDED(instance->webView.As(&webView22)) && webView22) return SUCCEEDED(webView22->AddWebResourceRequestedFilterWithRequestSourceKinds(pattern, static_cast<COREWEBVIEW2_WEB_RESOURCE_CONTEXT>(context), static_cast<COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS>(sourceKinds))) ? 1 : 0; return SUCCEEDED(instance->webView->AddWebResourceRequestedFilter(pattern, static_cast<COREWEBVIEW2_WEB_RESOURCE_CONTEXT>(context))) ? 1 : 0; }
    int EdgeView资源_移除过滤器(const wchar_t* controlName, const wchar_t* pattern, int context) { auto* instance = EdgeView_查找控件(controlName); return instance && instance->webView && pattern && SUCCEEDED(instance->webView->RemoveWebResourceRequestedFilter(pattern, static_cast<COREWEBVIEW2_WEB_RESOURCE_CONTEXT>(context))) ? 1 : 0; }
    int EdgeView资源_移除来源过滤器(const wchar_t* controlName, const wchar_t* pattern, int context, int sources) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2_22> webView22; return instance && instance->webView && pattern && SUCCEEDED(instance->webView.As(&webView22)) && webView22 && SUCCEEDED(webView22->RemoveWebResourceRequestedFilterWithRequestSourceKinds(pattern, static_cast<COREWEBVIEW2_WEB_RESOURCE_CONTEXT>(context), static_cast<COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS>(sources))) ? 1 : 0; }
    long long EdgeView资源_读响应正文异步(const wchar_t* controlName, long long responseId, long long maximum, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto response = EdgeView对象_取接口<ICoreWebView2WebResourceResponseView>(controlName, responseId, L"WebResourceResponseView"); if (!task) return 0; if (!response) { EdgeView任务_完成(task, E_INVALIDARG, L""); EdgeView任务_补充说明(task, EdgeView_说明响应正文时效().c_str()); return task->id; } if (maximum < 0 || maximum > 4LL * 1024LL * 1024LL) { EdgeView任务_完成(task, E_INVALIDARG, L""); return task->id; } HRESULT started = response->GetContent(Microsoft::WRL::Callback<ICoreWebView2WebResourceResponseViewGetContentCompletedHandler>([this, task, maximum](HRESULT error, IStream* stream) -> HRESULT { std::wstring hex; static const wchar_t digits[] = L"0123456789ABCDEF"; long long total = 0; BYTE buffer[8192]; ULONG read = 0; if (SUCCEEDED(error) && stream) { while (total < maximum && SUCCEEDED(stream->Read(buffer, static_cast<ULONG>(std::min<long long>(sizeof(buffer), maximum - total)), &read)) && read > 0) { hex.reserve(hex.size() + static_cast<size_t>(read) * 2); for (ULONG index = 0; index < read; ++index) { hex.push_back(digits[(buffer[index] >> 4) & 15]); hex.push_back(digits[buffer[index] & 15]); } total += read; } } std::wstring json = EdgeView_事件数据({{L"byteCount", EdgeView_数值(total)}, {L"hex", hex}}); EdgeView任务_完成(task, error, json.c_str()); EdgeView任务_补充说明(task, EdgeView_说明响应正文时效().c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    static std::wstring EdgeView_说明响应正文时效() { return L"响应正文必须在 Web资源响应收到 处理器执行期间交给本命令；处理器返回后 WebView2 会释放该响应的正文内容，稍后再读会得到 WebView2 异步操作失败。"; }
    int EdgeView资源_设置事件响应文本(const wchar_t* controlName, int status, const wchar_t* reason, const wchar_t* headers, const wchar_t* body) { auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->eventDecisionActive || status < 100 || status > 599 || (body && wcslen(body) > 4 * 1024 * 1024)) return 0; instance->eventFields[L"responseStatus"] = EdgeView_数值(status); instance->eventFields[L"responseReason"] = reason ? reason : L""; instance->eventFields[L"responseHeaders"] = headers ? headers : L""; instance->eventFields[L"responseBody"] = body ? body : L""; instance->eventAction = 1; return 1; }

    std::wstring EdgeView框架_枚举JSON(const wchar_t* controlName) {
        auto* instance = EdgeView_查找控件(controlName); if (!instance) return L"[]"; std::wstring json = L"["; bool first = true;
        for (const auto& item : edgeViewManagedObjects_) {
            auto state = item.second; if (!state || state->released || state->instanceId != instance->id || state->generation != instance->generation || state->type != L"Frame") continue;
            auto frame = EdgeView对象_取接口<ICoreWebView2Frame>(controlName, state->id, L"Frame"); LPWSTR name = nullptr; BOOL destroyed = FALSE;
            if (frame) { frame->get_Name(&name); frame->IsDestroyed(&destroyed); }
            if (!first) json += L","; first = false; json += EdgeView_事件数据({{L"handle", EdgeView_数值(state->id)}, {L"name", EdgeView_接管字符串(name)}, {L"destroyed", EdgeView_布尔值(destroyed)}});
        }
        json += L"]"; return json;
    }
    std::wstring EdgeView框架_取信息JSON(const wchar_t* controlName, long long frameId) {
        auto frame = EdgeView对象_取接口<ICoreWebView2Frame>(controlName, frameId, L"Frame"); if (!frame) return L"{}";
        LPWSTR name = nullptr; BOOL destroyed = FALSE; UINT32 nativeId = 0; frame->get_Name(&name); frame->IsDestroyed(&destroyed); Microsoft::WRL::ComPtr<ICoreWebView2Frame5> frame5; if (SUCCEEDED(frame.As(&frame5)) && frame5) frame5->get_FrameId(&nativeId);
        return EdgeView_事件数据({{L"handle", EdgeView_数值(frameId)}, {L"frameId", EdgeView_数值(nativeId)}, {L"name", EdgeView_接管字符串(name)}, {L"destroyed", EdgeView_布尔值(destroyed)}});
    }
    long long EdgeView框架_执行脚本异步(const wchar_t* controlName, long long frameId, const wchar_t* script, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto frame = EdgeView对象_取接口<ICoreWebView2Frame2>(controlName, frameId, L"Frame");
        if (!task) return 0; if (!frame) { EdgeView任务_完成(task, E_INVALIDARG, L""); return task->id; }
        HRESULT started = frame->ExecuteScript(script ? script : L"", Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>([this, task](HRESULT error, LPCWSTR result) -> HRESULT { EdgeView任务_完成(task, error, result); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    int EdgeView框架_发送字符串消息(const wchar_t* controlName, long long frameId, const wchar_t* message) { auto frame = EdgeView对象_取接口<ICoreWebView2Frame2>(controlName, frameId, L"Frame"); return frame && message && SUCCEEDED(frame->PostWebMessageAsString(message)) ? 1 : 0; }
    int EdgeView框架_发送JSON消息(const wchar_t* controlName, long long frameId, const wchar_t* json) { auto frame = EdgeView对象_取接口<ICoreWebView2Frame2>(controlName, frameId, L"Frame"); return frame && json && SUCCEEDED(frame->PostWebMessageAsJson(json)) ? 1 : 0; }
    int EdgeView框架_发送共享缓冲(const wchar_t* controlName, long long frameId, long long bufferId, int access, const wchar_t* json) { auto frame = EdgeView对象_取接口<ICoreWebView2Frame4>(controlName, frameId, L"Frame"); auto buffer = EdgeView对象_取接口<ICoreWebView2SharedBuffer>(controlName, bufferId, L"SharedBuffer"); return frame && buffer && SUCCEEDED(frame->PostSharedBufferToScript(buffer.Get(), static_cast<COREWEBVIEW2_SHARED_BUFFER_ACCESS>(access), json && json[0] ? json : L"{}")) ? 1 : 0; }

    Microsoft::WRL::ComPtr<ICoreWebView2Profile9> EdgeView工作线程_取Profile9(const wchar_t* controlName) {
        Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile9> profile9;
        if (EdgeView会话_取Profile(controlName, profile)) profile.As(&profile9); return profile9;
    }
    long long EdgeView工作线程_枚举异步(const wchar_t* controlName, int type, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto profile9 = EdgeView工作线程_取Profile9(controlName);
        if (!task) return 0; if (!profile9) { EdgeView_报告接口缺失(L"EdgeView工作线程_枚举异步"); EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; }
        if (type == 2) {
            Microsoft::WRL::ComPtr<ICoreWebView2SharedWorkerManager> manager; HRESULT error = profile9->get_SharedWorkerManager(&manager);
            if (FAILED(error) || !manager) { EdgeView任务_完成(task, FAILED(error) ? error : E_NOINTERFACE, L""); return task->id; }
            if (EdgeView_保留事件源(*instance, manager.Get())) { EventRegistrationToken token = {}; EdgeViewInstance* raw = instance; manager->add_SharedWorkerCreated(Microsoft::WRL::Callback<ICoreWebView2SharedWorkerCreatedEventHandler>([this, raw](ICoreWebView2SharedWorkerManager*, ICoreWebView2SharedWorkerCreatedEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2SharedWorker> worker; args->get_Worker(&worker); EdgeView_附加共享工作线程事件(*raw, worker.Get()); long long handle = EdgeView对象_注册(raw, L"SharedWorker", worker.Get()); std::wstring data = EdgeView_事件数据({{L"handle", EdgeView_数值(handle)}}); EdgeView_记录事件(*raw, L"共享工作线程创建", data.c_str()); return S_OK; }).Get(), &token); }
            HRESULT started = manager->GetSharedWorkers(Microsoft::WRL::Callback<ICoreWebView2GetSharedWorkersCompletedHandler>([this, task](HRESULT error, ICoreWebView2SharedWorkerCollectionView* list) -> HRESULT {
                std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && list) list->get_Count(&count); auto found = edgeViews_.find(task->instanceId); EdgeViewInstance* instance = found == edgeViews_.end() ? nullptr : found->second.get();
                for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2SharedWorker> worker; list->GetValueAtIndex(index, &worker); LPWSTR origin = nullptr, uri = nullptr, top = nullptr; if (worker) { worker->get_Origin(&origin); worker->get_ScriptUri(&uri); worker->get_TopLevelOrigin(&top); } if (instance) EdgeView_附加共享工作线程事件(*instance, worker.Get()); long long id = instance ? EdgeView对象_注册(instance, L"SharedWorker", worker.Get()) : 0; if (index) json += L","; json += EdgeView_事件数据({{L"handle", EdgeView_数值(id)}, {L"type", L"shared"}, {L"origin", EdgeView_接管字符串(origin)}, {L"scriptUri", EdgeView_接管字符串(uri)}, {L"topLevelOrigin", EdgeView_接管字符串(top)}}); }
                json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK;
            }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
        }
        Microsoft::WRL::ComPtr<ICoreWebView2ServiceWorkerManager> manager; HRESULT error = profile9->get_ServiceWorkerManager(&manager);
        if (FAILED(error) || !manager) { EdgeView任务_完成(task, FAILED(error) ? error : E_NOINTERFACE, L""); return task->id; }
        if (EdgeView_保留事件源(*instance, manager.Get())) { EventRegistrationToken token = {}; EdgeViewInstance* raw = instance; manager->add_ServiceWorkerRegistered(Microsoft::WRL::Callback<ICoreWebView2ServiceWorkerRegisteredEventHandler>([this, raw](ICoreWebView2ServiceWorkerManager*, ICoreWebView2ServiceWorkerRegisteredEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2ServiceWorkerRegistration> registration; args->get_ServiceWorkerRegistration(&registration); EdgeView_附加服务工作线程注册事件(*raw, registration.Get()); LPWSTR scope = nullptr; if (registration) registration->get_ScopeUri(&scope); std::wstring data = EdgeView_事件数据({{L"scopeUri", EdgeView_接管字符串(scope)}}); EdgeView_记录事件(*raw, L"服务工作线程注册", data.c_str()); return S_OK; }).Get(), &token); }
        HRESULT started = manager->GetServiceWorkerRegistrations(Microsoft::WRL::Callback<ICoreWebView2GetServiceWorkerRegistrationsCompletedHandler>([this, task](HRESULT error, ICoreWebView2ServiceWorkerRegistrationCollectionView* list) -> HRESULT {
            std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && list) list->get_Count(&count); auto found = edgeViews_.find(task->instanceId); EdgeViewInstance* instance = found == edgeViews_.end() ? nullptr : found->second.get();
            for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2ServiceWorkerRegistration> registration; Microsoft::WRL::ComPtr<ICoreWebView2ServiceWorker> worker; list->GetValueAtIndex(index, &registration); LPWSTR origin = nullptr, scope = nullptr, top = nullptr, uri = nullptr; if (registration) { registration->get_Origin(&origin); registration->get_ScopeUri(&scope); registration->get_TopLevelOrigin(&top); registration->get_ActiveServiceWorker(&worker); } if (worker) worker->get_ScriptUri(&uri); if (instance) { EdgeView_附加服务工作线程注册事件(*instance, registration.Get()); EdgeView_附加服务工作线程事件(*instance, worker.Get()); } long long id = instance ? EdgeView对象_注册(instance, L"ServiceWorker", worker.Get()) : 0; if (index) json += L","; json += EdgeView_事件数据({{L"handle", EdgeView_数值(id)}, {L"type", L"service"}, {L"origin", EdgeView_接管字符串(origin)}, {L"scopeUri", EdgeView_接管字符串(scope)}, {L"topLevelOrigin", EdgeView_接管字符串(top)}, {L"scriptUri", EdgeView_接管字符串(uri)}}); }
            json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK;
        }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    std::wstring EdgeView工作线程_取信息JSON(const wchar_t* controlName, long long workerId) {
        auto state = EdgeView对象_查找(controlName, workerId); if (!state) return L"{}"; LPWSTR uri = nullptr, origin = nullptr, top = nullptr;
        if (state->type == L"DedicatedWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2DedicatedWorker>(controlName, workerId); if (worker) worker->get_ScriptUri(&uri); }
        else if (state->type == L"SharedWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2SharedWorker>(controlName, workerId); if (worker) { worker->get_ScriptUri(&uri); worker->get_Origin(&origin); worker->get_TopLevelOrigin(&top); } }
        else if (state->type == L"ServiceWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2ServiceWorker>(controlName, workerId); if (worker) worker->get_ScriptUri(&uri); }
        else return L"{}";
        return EdgeView_事件数据({{L"handle", EdgeView_数值(workerId)}, {L"type", state->type}, {L"scriptUri", EdgeView_接管字符串(uri)}, {L"origin", EdgeView_接管字符串(origin)}, {L"topLevelOrigin", EdgeView_接管字符串(top)}});
    }
    int EdgeView工作线程_发送字符串消息(const wchar_t* controlName, long long workerId, const wchar_t* message) {
        auto state = EdgeView对象_查找(controlName, workerId); if (!state || !message) return 0;
        if (state->type == L"DedicatedWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2DedicatedWorker>(controlName, workerId); return worker && SUCCEEDED(worker->PostWebMessageAsString(message)) ? 1 : 0; }
        if (state->type == L"ServiceWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2ServiceWorker>(controlName, workerId); return worker && SUCCEEDED(worker->PostWebMessageAsString(message)) ? 1 : 0; }
        return 0;
    }
    int EdgeView工作线程_发送JSON消息(const wchar_t* controlName, long long workerId, const wchar_t* json) {
        auto state = EdgeView对象_查找(controlName, workerId); if (!state || !json) return 0;
        if (state->type == L"DedicatedWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2DedicatedWorker>(controlName, workerId); return worker && SUCCEEDED(worker->PostWebMessageAsJson(json)) ? 1 : 0; }
        if (state->type == L"ServiceWorker") { auto worker = EdgeView对象_取接口<ICoreWebView2ServiceWorker>(controlName, workerId); return worker && SUCCEEDED(worker->PostWebMessageAsJson(json)) ? 1 : 0; }
        return 0;
    }
    int EdgeView工作线程_置ServiceWorker脚本API(const wchar_t* controlName, bool enabled) { auto profile = EdgeView工作线程_取Profile9(controlName); if (!profile) { EdgeView_报告接口缺失(L"EdgeView工作线程_置ServiceWorker脚本API"); return 0; } return SUCCEEDED(profile->put_AreWebViewScriptApisEnabledForServiceWorkers(enabled ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView工作线程_取ServiceWorker脚本API(const wchar_t* controlName) { auto profile = EdgeView工作线程_取Profile9(controlName); BOOL enabled = FALSE; if (!profile) { EdgeView_报告接口缺失(L"EdgeView工作线程_取ServiceWorker脚本API"); return 0; } return SUCCEEDED(profile->get_AreWebViewScriptApisEnabledForServiceWorkers(&enabled)) && enabled ? 1 : 0; }

    Microsoft::WRL::ComPtr<ICoreWebView2Profile7> EdgeView扩展_取Profile7(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile7> profile7; if (EdgeView会话_取Profile(controlName, profile)) profile.As(&profile7); return profile7; }
    long long EdgeView扩展_安装异步(const wchar_t* controlName, const wchar_t* folder, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto profile = EdgeView扩展_取Profile7(controlName); if (!task) return 0;
        if (!profile || !folder || !folder[0]) { EdgeView_报告接口缺失(L"EdgeView扩展_安装异步"); EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; }
        HRESULT started = profile->AddBrowserExtension(folder, Microsoft::WRL::Callback<ICoreWebView2ProfileAddBrowserExtensionCompletedHandler>([this, task](HRESULT error, ICoreWebView2BrowserExtension* extension) -> HRESULT { auto found = edgeViews_.find(task->instanceId); auto* instance = found == edgeViews_.end() ? nullptr : found->second.get(); long long id = instance ? EdgeView对象_注册(instance, L"BrowserExtension", extension) : 0; EdgeView任务_完成(task, error, EdgeView_数值(id).c_str()); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    long long EdgeView扩展_枚举异步(const wchar_t* controlName, const wchar_t* handler) {
        auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto profile = EdgeView扩展_取Profile7(controlName); if (!task) return 0;
        if (!profile) { EdgeView_报告接口缺失(L"EdgeView扩展_枚举异步"); EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; }
        HRESULT started = profile->GetBrowserExtensions(Microsoft::WRL::Callback<ICoreWebView2ProfileGetBrowserExtensionsCompletedHandler>([this, task](HRESULT error, ICoreWebView2BrowserExtensionList* list) -> HRESULT { std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && list) list->get_Count(&count); auto found = edgeViews_.find(task->instanceId); auto* instance = found == edgeViews_.end() ? nullptr : found->second.get(); for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2BrowserExtension> extension; list->GetValueAtIndex(index, &extension); LPWSTR idText = nullptr, name = nullptr; BOOL enabled = FALSE; if (extension) { extension->get_Id(&idText); extension->get_Name(&name); extension->get_IsEnabled(&enabled); } long long id = instance ? EdgeView对象_注册(instance, L"BrowserExtension", extension.Get()) : 0; if (index) json += L","; json += EdgeView_事件数据({{L"handle", EdgeView_数值(id)}, {L"id", EdgeView_接管字符串(idText)}, {L"name", EdgeView_接管字符串(name)}, {L"enabled", EdgeView_布尔值(enabled)}}); } json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK; }).Get());
        if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id;
    }
    long long EdgeView扩展_置启用异步(const wchar_t* controlName, long long extensionId, bool enabled, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto extension = EdgeView对象_取接口<ICoreWebView2BrowserExtension>(controlName, extensionId, L"BrowserExtension"); if (!task) return 0; if (!extension) { EdgeView任务_完成(task, E_INVALIDARG, L""); return task->id; } HRESULT started = extension->Enable(enabled ? TRUE : FALSE, Microsoft::WRL::Callback<ICoreWebView2BrowserExtensionEnableCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView扩展_删除异步(const wchar_t* controlName, long long extensionId, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto extension = EdgeView对象_取接口<ICoreWebView2BrowserExtension>(controlName, extensionId, L"BrowserExtension"); if (!task) return 0; if (!extension) { EdgeView任务_完成(task, E_INVALIDARG, L""); return task->id; } HRESULT started = extension->Remove(Microsoft::WRL::Callback<ICoreWebView2BrowserExtensionRemoveCompletedHandler>([this, task, extensionId](HRESULT error) -> HRESULT { if (SUCCEEDED(error)) EdgeView对象_释放(extensionId); EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }

    Microsoft::WRL::ComPtr<ICoreWebView2Profile4> EdgeView权限_取Profile4(const wchar_t* controlName) { Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile; Microsoft::WRL::ComPtr<ICoreWebView2Profile4> profile4; if (EdgeView会话_取Profile(controlName, profile)) profile.As(&profile4); return profile4; }
    long long EdgeView权限_枚举异步(const wchar_t* controlName, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto profile = EdgeView权限_取Profile4(controlName); if (!task) return 0; if (!profile) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = profile->GetNonDefaultPermissionSettings(Microsoft::WRL::Callback<ICoreWebView2GetNonDefaultPermissionSettingsCompletedHandler>([this, task](HRESULT error, ICoreWebView2PermissionSettingCollectionView* list) -> HRESULT { std::wstring json = L"["; UINT32 count = 0; if (SUCCEEDED(error) && list) list->get_Count(&count); for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2PermissionSetting> setting; list->GetValueAtIndex(index, &setting); COREWEBVIEW2_PERMISSION_KIND kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION; COREWEBVIEW2_PERMISSION_STATE state = COREWEBVIEW2_PERMISSION_STATE_DEFAULT; LPWSTR origin = nullptr; if (setting) { setting->get_PermissionKind(&kind); setting->get_PermissionState(&state); setting->get_PermissionOrigin(&origin); } if (index) json += L","; json += EdgeView_事件数据({{L"kind", EdgeView_数值(kind)}, {L"origin", EdgeView_接管字符串(origin)}, {L"state", EdgeView_数值(state)}}); } json += L"]"; EdgeView任务_完成(task, error, json.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView权限_设置异步(const wchar_t* controlName, int kind, const wchar_t* origin, int state, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); auto profile = EdgeView权限_取Profile4(controlName); if (!task) return 0; if (!profile || !origin) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = profile->SetPermissionState(static_cast<COREWEBVIEW2_PERMISSION_KIND>(kind), origin, static_cast<COREWEBVIEW2_PERMISSION_STATE>(state), Microsoft::WRL::Callback<ICoreWebView2SetPermissionStateCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }

    std::wstring EdgeView通知_取信息JSON(const wchar_t* controlName, long long notificationId) { auto notification = EdgeView对象_取接口<ICoreWebView2Notification>(controlName, notificationId, L"Notification"); if (!notification) return L"{}"; LPWSTR title = nullptr, body = nullptr, language = nullptr, tag = nullptr, icon = nullptr; BOOL silent = FALSE, interaction = FALSE; double timestamp = 0; notification->get_Title(&title); notification->get_Body(&body); notification->get_Language(&language); notification->get_Tag(&tag); notification->get_IconUri(&icon); notification->get_IsSilent(&silent); notification->get_RequiresInteraction(&interaction); notification->get_Timestamp(&timestamp); return EdgeView_事件数据({{L"handle", EdgeView_数值(notificationId)}, {L"title", EdgeView_接管字符串(title)}, {L"body", EdgeView_接管字符串(body)}, {L"language", EdgeView_接管字符串(language)}, {L"tag", EdgeView_接管字符串(tag)}, {L"iconUri", EdgeView_接管字符串(icon)}, {L"silent", EdgeView_布尔值(silent)}, {L"requiresInteraction", EdgeView_布尔值(interaction)}, {L"timestamp", std::to_wstring(timestamp)}}); }
    int EdgeView通知_报告已显示(const wchar_t* controlName, long long notificationId) { auto notification = EdgeView对象_取接口<ICoreWebView2Notification>(controlName, notificationId, L"Notification"); return notification && SUCCEEDED(notification->ReportShown()) ? 1 : 0; }
    int EdgeView通知_报告单击(const wchar_t* controlName, long long notificationId) { auto notification = EdgeView对象_取接口<ICoreWebView2Notification>(controlName, notificationId, L"Notification"); return notification && SUCCEEDED(notification->ReportClicked()) ? 1 : 0; }
    int EdgeView通知_报告关闭(const wchar_t* controlName, long long notificationId) { auto notification = EdgeView对象_取接口<ICoreWebView2Notification>(controlName, notificationId, L"Notification"); return notification && SUCCEEDED(notification->ReportClosed()) ? 1 : 0; }

    long long EdgeView缓冲_创建(const wchar_t* controlName, long long size) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Environment12> environment12; Microsoft::WRL::ComPtr<ICoreWebView2SharedBuffer> buffer; if (!instance || !instance->environment || size <= 0 || size > 16LL * 1024LL * 1024LL) return 0; if (FAILED(instance->environment.As(&environment12)) || !environment12) { EdgeView_报告接口缺失(L"EdgeView缓冲_创建"); return 0; } return SUCCEEDED(environment12->CreateSharedBuffer(static_cast<UINT64>(size), &buffer)) && buffer ? EdgeView对象_注册(instance, L"SharedBuffer", buffer.Get()) : 0; }
    long long EdgeView缓冲_取大小(const wchar_t* controlName, long long bufferId) { auto buffer = EdgeView对象_取接口<ICoreWebView2SharedBuffer>(controlName, bufferId, L"SharedBuffer"); UINT64 size = 0; return buffer && SUCCEEDED(buffer->get_Size(&size)) && size <= static_cast<UINT64>(LLONG_MAX) ? static_cast<long long>(size) : 0; }
    static int EdgeView缓冲_十六进制值(wchar_t value) { if (value >= L'0' && value <= L'9') return value - L'0'; if (value >= L'a' && value <= L'f') return value - L'a' + 10; if (value >= L'A' && value <= L'F') return value - L'A' + 10; return -1; }
    int EdgeView缓冲_写十六进制(const wchar_t* controlName, long long bufferId, const wchar_t* hex) { auto buffer = EdgeView对象_取接口<ICoreWebView2SharedBuffer>(controlName, bufferId, L"SharedBuffer"); if (!buffer || !hex) return 0; UINT64 size = 0; BYTE* bytes = nullptr; if (FAILED(buffer->get_Size(&size)) || FAILED(buffer->get_Buffer(&bytes)) || !bytes) return 0; UINT64 offset = 0; int high = -1; for (const wchar_t* cursor = hex; *cursor; ++cursor) { int value = EdgeView缓冲_十六进制值(*cursor); if (value < 0) { if (*cursor == L' ' || *cursor == L'\r' || *cursor == L'\n' || *cursor == L'\t') continue; return 0; } if (high < 0) high = value; else { if (offset >= size) return 0; bytes[offset++] = static_cast<BYTE>((high << 4) | value); high = -1; } } return high < 0 ? 1 : 0; }
    std::wstring EdgeView缓冲_读十六进制(const wchar_t* controlName, long long bufferId, long long maximum) { auto buffer = EdgeView对象_取接口<ICoreWebView2SharedBuffer>(controlName, bufferId, L"SharedBuffer"); if (!buffer || maximum < 0) return L""; UINT64 size = 0; BYTE* bytes = nullptr; if (FAILED(buffer->get_Size(&size)) || FAILED(buffer->get_Buffer(&bytes)) || !bytes) return L""; const long long limited = maximum < 16LL * 1024LL * 1024LL ? maximum : 16LL * 1024LL * 1024LL; const UINT64 requested = static_cast<UINT64>(limited); const UINT64 count = size < requested ? size : requested; static const wchar_t digits[] = L"0123456789ABCDEF"; std::wstring result; result.reserve(static_cast<size_t>(count * 2)); for (UINT64 index = 0; index < count; ++index) { result.push_back(digits[(bytes[index] >> 4) & 15]); result.push_back(digits[bytes[index] & 15]); } return result; }
    int EdgeView缓冲_发送到网页(const wchar_t* controlName, long long bufferId, int access, const wchar_t* json) { auto* instance = EdgeView_查找控件(controlName); auto buffer = EdgeView对象_取接口<ICoreWebView2SharedBuffer>(controlName, bufferId, L"SharedBuffer"); Microsoft::WRL::ComPtr<ICoreWebView2_17> webView17; if (!instance || !instance->webView || !buffer || FAILED(instance->webView.As(&webView17)) || !webView17) return 0; return SUCCEEDED(webView17->PostSharedBufferToScript(buffer.Get(), static_cast<COREWEBVIEW2_SHARED_BUFFER_ACCESS>(access), json && json[0] ? json : L"{}")) ? 1 : 0; }

    std::wstring EdgeView安全_取证书JSON(const wchar_t* controlName, long long certificateId) { auto state = EdgeView对象_查找(controlName, certificateId); if (!state || (state->type != L"Certificate" && state->type != L"ClientCertificate")) return L"{}"; LPWSTR subject = nullptr, issuer = nullptr, serial = nullptr, display = nullptr, pem = nullptr; double validFrom = 0, validTo = 0; int kind = -1; if (state->type == L"ClientCertificate") { auto certificate = EdgeView对象_取接口<ICoreWebView2ClientCertificate>(controlName, certificateId, L"ClientCertificate"); COREWEBVIEW2_CLIENT_CERTIFICATE_KIND certificateKind = COREWEBVIEW2_CLIENT_CERTIFICATE_KIND_SMART_CARD; if (!certificate) return L"{}"; certificate->get_Subject(&subject); certificate->get_Issuer(&issuer); certificate->get_ValidFrom(&validFrom); certificate->get_ValidTo(&validTo); certificate->get_DerEncodedSerialNumber(&serial); certificate->get_DisplayName(&display); certificate->ToPemEncoding(&pem); certificate->get_Kind(&certificateKind); kind = static_cast<int>(certificateKind); } else { auto certificate = EdgeView对象_取接口<ICoreWebView2Certificate>(controlName, certificateId, L"Certificate"); if (!certificate) return L"{}"; certificate->get_Subject(&subject); certificate->get_Issuer(&issuer); certificate->get_ValidFrom(&validFrom); certificate->get_ValidTo(&validTo); certificate->get_DerEncodedSerialNumber(&serial); certificate->get_DisplayName(&display); certificate->ToPemEncoding(&pem); } return EdgeView_事件数据({{L"handle", EdgeView_数值(certificateId)}, {L"type", state->type}, {L"subject", EdgeView_接管字符串(subject)}, {L"issuer", EdgeView_接管字符串(issuer)}, {L"validFrom", std::to_wstring(validFrom)}, {L"validTo", std::to_wstring(validTo)}, {L"serialNumber", EdgeView_接管字符串(serial)}, {L"displayName", EdgeView_接管字符串(display)}, {L"pem", EdgeView_接管字符串(pem)}, {L"kind", EdgeView_数值(kind)}}); }
    int EdgeView安全_选择客户端证书(const wchar_t* controlName, long long certificateId) { auto* instance = EdgeView_查找控件(controlName); auto certificate = EdgeView对象_取接口<ICoreWebView2ClientCertificate>(controlName, certificateId, L"ClientCertificate"); if (!instance || !instance->eventDecisionActive || !certificate) return 0; instance->eventObjectSelection = certificateId; instance->eventAction = 1; return 1; }
    long long EdgeView安全_清除证书错误决策异步(const wchar_t* controlName, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_14> webView14; if (!task) return 0; if (!instance->webView || FAILED(instance->webView.As(&webView14)) || !webView14) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = webView14->ClearServerCertificateErrorActions(Microsoft::WRL::Callback<ICoreWebView2ClearServerCertificateErrorActionsCompletedHandler>([this, task](HRESULT error) -> HRESULT { EdgeView任务_完成(task, error, L"true"); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }
    long long EdgeView安全_显示另存为界面异步(const wchar_t* controlName, const wchar_t* handler) { auto* instance = EdgeView_查找控件(controlName); auto task = EdgeView任务_新建(instance, handler); Microsoft::WRL::ComPtr<ICoreWebView2_25> webView25; if (!task) return 0; if (!instance->webView || FAILED(instance->webView.As(&webView25)) || !webView25) { EdgeView任务_完成(task, E_NOINTERFACE, L""); return task->id; } HRESULT started = webView25->ShowSaveAsUI(Microsoft::WRL::Callback<ICoreWebView2ShowSaveAsUICompletedHandler>([this, task](HRESULT error, COREWEBVIEW2_SAVE_AS_UI_RESULT result) -> HRESULT { std::wstring json = EdgeView_事件数据({{L"result", EdgeView_数值(result)}}); EdgeView任务_完成(task, error, json.c_str()); return S_OK; }).Get()); if (FAILED(started)) EdgeView任务_完成(task, started, L""); return task->id; }

    std::wstring EdgeView对象_取文件路径(const wchar_t* controlName, long long objectId) { auto file = EdgeView对象_取接口<ICoreWebView2File>(controlName, objectId, L"File"); LPWSTR path = nullptr; if (file) file->get_Path(&path); return EdgeView_接管字符串(path); }
    long long EdgeView对象_创建文件系统句柄(const wchar_t* controlName, const wchar_t* path, bool directory, int permission) { auto* instance = EdgeView_查找控件(controlName); Microsoft::WRL::ComPtr<ICoreWebView2Environment14> environment14; Microsoft::WRL::ComPtr<ICoreWebView2FileSystemHandle> handle; if (!instance || !path || !path[0] || !instance->environment || FAILED(instance->environment.As(&environment14)) || !environment14) return 0; std::wstring requested(path); if (!(requested.size() >= 3 && iswalpha(requested[0]) && requested[1] == L':' && (requested[2] == L'\\' || requested[2] == L'/')) && requested.rfind(L"\\\\", 0) != 0) return 0; DWORD attributes = GetFileAttributesW(requested.c_str()); if (attributes == INVALID_FILE_ATTRIBUTES || (((attributes & FILE_ATTRIBUTE_DIRECTORY) != 0) != directory)) return 0; HRESULT result = directory ? environment14->CreateWebFileSystemDirectoryHandle(requested.c_str(), static_cast<COREWEBVIEW2_FILE_SYSTEM_HANDLE_PERMISSION>(permission), &handle) : environment14->CreateWebFileSystemFileHandle(requested.c_str(), static_cast<COREWEBVIEW2_FILE_SYSTEM_HANDLE_PERMISSION>(permission), &handle); return SUCCEEDED(result) && handle ? EdgeView对象_注册(instance, L"FileSystemHandle", handle.Get()) : 0; }
    int EdgeView脚本_发送附加对象JSON(const wchar_t* controlName, const wchar_t* json, long long objectId) { auto* instance = EdgeView_查找控件(controlName); auto state = EdgeView对象_查找(controlName, objectId); Microsoft::WRL::ComPtr<ICoreWebView2Environment14> environment14; Microsoft::WRL::ComPtr<ICoreWebView2_23> webView23; Microsoft::WRL::ComPtr<ICoreWebView2ObjectCollection> collection; if (!instance || !state || state->type != L"FileSystemHandle" || !json || !instance->environment || !instance->webView || FAILED(instance->environment.As(&environment14)) || !environment14 || FAILED(instance->webView.As(&webView23)) || !webView23) return 0; IUnknown* objects[] = { state->object.Get() }; return SUCCEEDED(environment14->CreateObjectCollection(1, objects, &collection)) && collection && SUCCEEDED(webView23->PostWebMessageAsJsonWithAdditionalObjects(json, collection.Get())) ? 1 : 0; }

    std::wstring EdgeView事件_取菜单项JSON(const wchar_t* controlName, long long itemId) { auto* instance = EdgeView_查找控件(controlName); auto item = EdgeView对象_取接口<ICoreWebView2ContextMenuItem>(controlName, itemId, L"ContextMenuItem"); if (!instance || !item) return L"{}"; LPWSTR name = nullptr, label = nullptr, shortcut = nullptr; INT32 commandId = 0; BOOL checked = FALSE, enabled = FALSE; COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND kind = COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND; Microsoft::WRL::ComPtr<IStream> icon; Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItemCollection> children; item->get_Name(&name); item->get_Label(&label); item->get_ShortcutKeyDescription(&shortcut); item->get_CommandId(&commandId); item->get_IsChecked(&checked); item->get_IsEnabled(&enabled); item->get_Kind(&kind); item->get_Icon(&icon); item->get_Children(&children); std::wstring childHandles; UINT32 count = 0; if (children) children->get_Count(&count); for (UINT32 index = 0; index < count; ++index) { Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItem> child; children->GetValueAtIndex(index, &child); long long handle = EdgeView对象_注册(instance, L"ContextMenuItem", child.Get()); if (!childHandles.empty()) childHandles += L","; childHandles += EdgeView_数值(handle); } return EdgeView_事件数据({{L"handle", EdgeView_数值(itemId)}, {L"name", EdgeView_接管字符串(name)}, {L"label", EdgeView_接管字符串(label)}, {L"shortcut", EdgeView_接管字符串(shortcut)}, {L"commandId", EdgeView_数值(commandId)}, {L"checked", EdgeView_布尔值(checked)}, {L"enabled", EdgeView_布尔值(enabled)}, {L"kind", EdgeView_数值(kind)}, {L"hasIcon", icon ? L"true" : L"false"}, {L"childHandles", childHandles}}); }
    int EdgeView事件_置菜单项勾选(const wchar_t* controlName, long long itemId, bool checked) { auto item = EdgeView对象_取接口<ICoreWebView2ContextMenuItem>(controlName, itemId, L"ContextMenuItem"); return item && SUCCEEDED(item->put_IsChecked(checked ? TRUE : FALSE)) ? 1 : 0; }
    int EdgeView事件_置菜单项启用(const wchar_t* controlName, long long itemId, bool enabled) { auto item = EdgeView对象_取接口<ICoreWebView2ContextMenuItem>(controlName, itemId, L"ContextMenuItem"); return item && SUCCEEDED(item->put_IsEnabled(enabled ? TRUE : FALSE)) ? 1 : 0; }

    static std::wstring EdgeView事件_解析JSON字段(const std::wstring& json, const std::wstring& field) { if (field.empty()) return L""; std::wstring needle = L"\"" + field + L"\":\""; size_t position = json.find(needle); if (position == std::wstring::npos) return L""; position += needle.size(); std::wstring value; bool escaped = false; for (; position < json.size(); ++position) { wchar_t character = json[position]; if (escaped) { if (character == L'n') value.push_back(L'\n'); else if (character == L'r') value.push_back(L'\r'); else if (character == L't') value.push_back(L'\t'); else value.push_back(character); escaped = false; } else if (character == L'\\') escaped = true; else if (character == L'\"') break; else value.push_back(character); } return value; }
    std::wstring EdgeView事件_取字段(const wchar_t* controlName, const wchar_t* field) { auto* instance = EdgeView_查找控件(controlName); if (!instance || !field) return L""; auto found = instance->eventFields.find(field); return found == instance->eventFields.end() ? EdgeView事件_解析JSON字段(instance->lastEventData, field) : found->second; }
    int EdgeView事件_设置动作(const wchar_t* controlName, int action) { auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->eventDecisionActive) return 0; instance->eventAction = action; return 1; }
    int EdgeView事件_设置返回文本(const wchar_t* controlName, const wchar_t* text) { auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->eventDecisionActive) return 0; instance->eventResultText = text ? text : L""; return 1; }
    int EdgeView事件_设置认证(const wchar_t* controlName, const wchar_t* user, const wchar_t* password) { auto* instance = EdgeView_查找控件(controlName); if (!instance || !instance->eventDecisionActive) return 0; instance->eventFields[L"username"] = user ? user : L""; instance->eventFields[L"password"] = password ? password : L""; instance->eventAction = 1; return 1; }
    int EdgeView事件_设置下载路径(const wchar_t* controlName, const wchar_t* filePath) {
        auto* instance = EdgeView_查找控件(controlName);
        if (!instance || !instance->eventDecisionActive) { EdgeView_报告事件决策窗口缺失(L"EdgeView事件_设置下载路径"); return 0; }
        if (!filePath || !filePath[0]) { 调试输出(L"EdgeView事件_设置下载路径：文件路径为空，已忽略。"); return 0; }
        const std::wstring target = EdgeView_取绝对路径(filePath);
        EdgeView_确保父目录(target);
        instance->eventDownloadPath = target;
        return 1;
    }
#else
${unavailableStubs()}
#endif
`;
