import { InstalledModule } from '../modules/types';

export const COM_MODULE_ID = 'lingbuilder.advanced.com';

export function generateComRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === COM_MODULE_ID)) return '';
  return COM_RUNTIME;
}

export function generateComWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === COM_MODULE_ID)) return '';
  return COM_WINDOW_METHODS;
}

export function generateComWndProcCase(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === COM_MODULE_ID)) return '';
  return [
    '        case WM_LINGBUILDER_COM_EVENT: {',
    '            LB_ComDrainQueuedEvents();',
    '            return 0;',
    '        }'
  ].join('\n');
}

/**
 * COM 自动化模块 v2 自由函数运行时。
 *
 * 全部为纯 C++/标准 COM 调用（无内联汇编、无指针宽度假设），MSVC 按
 * windows-msvc-win32 与 windows-msvc-x64 两个 target 编译同一份源码即可。
 * AtlAxWin 宿主从系统 atl.dll 动态加载，不引入新的静态链接依赖。
 */
export const COM_RUNTIME = String.raw`
#include <objbase.h>
#include <oaidl.h>
#include <ocidl.h>

#ifndef WM_FORWARDMSG
#define WM_FORWARDMSG 0x037F
#endif
#ifndef WM_LINGBUILDER_COM_EVENT
#define WM_LINGBUILDER_COM_EVENT (WM_APP + 0x5A)
#endif

static std::wstring g_lbComError;

struct LingComRecord {
    IDispatch* dispatch = nullptr;
    HWND ocxWindow = nullptr;
    HWND ownerWindow = nullptr;
    std::vector<std::pair<IConnectionPoint*, DWORD>> connections;
    struct Mapping { long long dispid = 0; std::wstring handler; long long userData = 0; };
    std::vector<Mapping> eventMaps;
};

static std::mutex g_lbComMutex;
static std::unordered_map<long long, LingComRecord*> g_lbComRecords;
static std::unordered_map<long long, long long> g_lbComOcxWindowToHandle;
static std::unordered_map<long long, std::function<void(const wchar_t*, long long, const wchar_t*)>> g_lbComDispatchers;
static long long g_lbComNextHandle = 1;
static int g_lbComOcxControlId = 500;

struct LingComQueuedEvent {
    long long objectId = 0;
    std::wstring handler;
    long long userData = 0;
    std::wstring params;
    std::vector<IDispatch*> objectParams;
};
static std::deque<LingComQueuedEvent> g_lbComEventQueue;
static thread_local std::vector<IDispatch*>* t_lbComEventObjectParams = nullptr;

static LingComRecord* LB_ComFind(long long handle) {
    std::lock_guard<std::mutex> lock(g_lbComMutex);
    auto found = g_lbComRecords.find(handle);
    return found == g_lbComRecords.end() ? nullptr : found->second;
}

static long long LB_ComRegister(IDispatch* dispatch, HWND ocxWindow, std::wstring& error) {
    if (!dispatch) { error = L"COM 对象指针为空。"; return 0; }
    std::lock_guard<std::mutex> lock(g_lbComMutex);
    const long long handle = g_lbComNextHandle++;
    auto* record = new LingComRecord();
    record->dispatch = dispatch;
    record->ocxWindow = ocxWindow;
    g_lbComRecords[handle] = record;
    if (ocxWindow) g_lbComOcxWindowToHandle[reinterpret_cast<long long>(ocxWindow)] = handle;
    return handle;
}

static std::wstring LB_ComHresultText(HRESULT hr) {
    wchar_t buffer[16] = {};
    swprintf(buffer, 16, L"0x%08lX", static_cast<unsigned long>(hr));
    return buffer;
}

static std::wstring LB_ComGuidToText(const GUID& guid);

static std::wstring LB_ComVariantToText(const VARIANT& value) {
    VARIANT direct;
    VariantInit(&direct);
    if (FAILED(VariantCopyInd(&direct, const_cast<VARIANT*>(&value)))) return L"";
    std::wstring output;
    switch (direct.vt) {
        case VT_BSTR: output = direct.bstrVal ? direct.bstrVal : L""; break;
        case VT_I2: output = std::to_wstring(direct.iVal); break;
        case VT_I4: case VT_INT: case VT_UI4: case VT_UINT: case VT_ERROR: case VT_HRESULT:
            output = std::to_wstring(direct.lVal); break;
        case VT_I8: case VT_UI8: output = std::to_wstring(direct.llVal); break;
        case VT_R4: output = std::to_wstring(static_cast<long long>(direct.fltVal)); break;
        case VT_R8: output = std::to_wstring(static_cast<long long>(direct.dblVal)); break;
        case VT_BOOL: output = direct.boolVal == VARIANT_FALSE ? L"假" : L"真"; break;
        case VT_EMPTY: case VT_NULL: break;
        default: {
            VARIANT text;
            VariantInit(&text);
            if (SUCCEEDED(VariantChangeType(&text, &direct, 0, VT_BSTR)) && text.bstrVal) output = text.bstrVal;
            VariantClear(&text);
            break;
        }
    }
    VariantClear(&direct);
    return output;
}

static void LB_ComAppendEventParam(const VARIANT& value, std::wstring& text, std::vector<IDispatch*>& objectParams) {
    VARIANT direct;
    VariantInit(&direct);
    if (FAILED(VariantCopyInd(&direct, const_cast<VARIANT*>(&value)))) return;
    if (!text.empty()) text.push_back(L'\t');
    if ((direct.vt == VT_DISPATCH || direct.vt == VT_UNKNOWN) && direct.pdispVal) {
        direct.pdispVal->AddRef();
        objectParams.push_back(direct.pdispVal);
        text += L"[COM对象]";
    } else {
        text += LB_ComVariantToText(direct);
    }
    VariantClear(&direct);
}

class LingComEventSink : public IDispatch {
public:
    explicit LingComEventSink(long long objectId) : objectId_(objectId) {}

    // 部分控件（VB6/Thunder 系，如 CCRP FolderTreeview）在 Advise 时会先按
    // 事件接口的 DIID 查询接收器，只接受 IID_IDispatch 会导致 Advise 返回
    // E_NOINTERFACE 而收不到任何事件。这里登记连接点声明的事件接口标识后
    // 一并接受；接收器本身仍以 IDispatch::Invoke 派发，语义不变。
    void AcceptEventInterface(const IID& diid) {
        std::lock_guard<std::mutex> lock(eventIidMutex_);
        eventIids_.push_back(diid);
    }

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** output) override {
        if (!output) return E_POINTER;
        *output = nullptr;
        if (riid == IID_IUnknown || riid == IID_IDispatch) {
            *output = static_cast<IDispatch*>(this);
            AddRef();
            return S_OK;
        }
        {
            std::lock_guard<std::mutex> lock(eventIidMutex_);
            for (const IID& accepted : eventIids_) {
                if (IsEqualIID(riid, accepted)) {
                    *output = static_cast<IDispatch*>(this);
                    AddRef();
                    return S_OK;
                }
            }
        }
        return E_NOINTERFACE;
    }

    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }

    ULONG STDMETHODCALLTYPE Release() override {
        const ULONG remaining = --refs_;
        if (remaining == 0) delete this;
        return remaining;
    }

    HRESULT STDMETHODCALLTYPE GetTypeInfoCount(UINT*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetTypeInfo(UINT, LCID, ITypeInfo**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetIDsOfNames(REFIID, LPOLESTR*, UINT, LCID, DISPID*) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE Invoke(DISPID dispid, REFIID, LCID, WORD, DISPPARAMS* params,
                                     VARIANT*, EXCEPINFO*, UINT*) override {
        LingComRecord* record = LB_ComFind(objectId_);
        if (!record || !params) return S_OK;
        std::wstring handler;
        long long userData = 0;
        {
            std::lock_guard<std::mutex> lock(g_lbComMutex);
            for (const auto& mapping : record->eventMaps) {
                if (mapping.dispid == dispid) { handler = mapping.handler; userData = mapping.userData; break; }
            }
        }
        if (handler.empty()) return S_OK;
        LingComQueuedEvent event;
        event.objectId = objectId_;
        event.handler = handler;
        event.userData = userData;
        if (params->cArgs > 0 && params->rgvarg) {
            // DISPPARAMS.rgvarg 为逆序存放，按自然参数顺序输出。
            for (int i = params->cArgs; i >= 1; --i) LB_ComAppendEventParam(params->rgvarg[i - 1], event.params, event.objectParams);
        }
        {
            std::lock_guard<std::mutex> lock(g_lbComMutex);
            g_lbComEventQueue.push_back(std::move(event));
        }
        if (record->ownerWindow && IsWindow(record->ownerWindow)) {
            PostMessageW(record->ownerWindow, WM_LINGBUILDER_COM_EVENT, 0, 0);
        }
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    long long objectId_;
    std::mutex eventIidMutex_;
    std::vector<IID> eventIids_;
};

void LB_ComDrainQueuedEvents() {
    std::deque<LingComQueuedEvent> batch;
    {
        std::lock_guard<std::mutex> lock(g_lbComMutex);
        batch.swap(g_lbComEventQueue);
    }
    while (!batch.empty()) {
        LingComQueuedEvent event = std::move(batch.front());
        batch.pop_front();
        std::function<void(const wchar_t*, long long, const wchar_t*)> dispatcher;
        {
            std::lock_guard<std::mutex> lock(g_lbComMutex);
            auto found = g_lbComDispatchers.find(event.objectId);
            if (found != g_lbComDispatchers.end()) dispatcher = found->second;
        }
        if (dispatcher) {
            t_lbComEventObjectParams = &event.objectParams;
            dispatcher(event.handler.c_str(), event.userData, event.params.c_str());
            t_lbComEventObjectParams = nullptr;
        }
        for (IDispatch* object : event.objectParams) if (object) object->Release();
    }
}

static long long LB_ComCreateFromClsid(const CLSID& clsid, std::wstring& error) {
    IDispatch* dispatch = nullptr;
    const HRESULT hr = CoCreateInstance(clsid, nullptr, CLSCTX_INPROC_SERVER | CLSCTX_LOCAL_SERVER, IID_IDispatch, reinterpret_cast<void**>(&dispatch));
    if (FAILED(hr) || !dispatch) {
        error = L"COM 对象创建失败（" + LB_ComHresultText(hr) + L"）。64 位程序只能加载 64 位组件，32 位程序只能加载 32 位组件。";
        return 0;
    }
    return LB_ComRegister(dispatch, nullptr, error);
}

static long long LB_ComCreateFromProgId(const wchar_t* progId, std::wstring& error) {
    error.clear();
    if (!progId || !progId[0]) { error = L"缺少 ProgID。"; return 0; }
    CLSID clsid {};
    const HRESULT hr = CLSIDFromProgID(progId, &clsid);
    if (FAILED(hr)) { error = L"无法解析 ProgID（" + LB_ComHresultText(hr) + L"）：" + progId; return 0; }
    return LB_ComCreateFromClsid(clsid, error);
}

using LB_DllGetClassObjectProc = HRESULT(__stdcall*)(const CLSID&, const IID&, void**);
using LB_DllRegisterServerProc = HRESULT(__stdcall*)();

static bool LB_ComRegisterServer(const wchar_t* dllPath, bool unregister, std::wstring& error) {
    error.clear();
    if (!dllPath || !dllPath[0]) { error = L"缺少组件 DLL 路径。"; return false; }
    std::filesystem::path path(LB_Wide(dllPath));
    if (!std::filesystem::exists(path)) { error = L"组件文件不存在：" + std::wstring(dllPath); return false; }
    // 用绝对路径加载；注册表写入按组件自身的 DllRegisterServer 实现。
    wchar_t absolutePath[MAX_PATH] = {};
    _wfullpath(absolutePath, path.c_str(), MAX_PATH);
    HMODULE module = LoadLibraryW(absolutePath);
    if (!module) {
        const DWORD code = GetLastError();
        error = code == ERROR_BAD_EXE_FORMAT
            ? std::wstring(L"组件位数与程序位数不匹配，无法加载：") + absolutePath
            : L"组件 DLL 加载失败（错误码 " + std::to_wstring(code) + L"）：" + absolutePath;
        return false;
    }
    auto proc = reinterpret_cast<LB_DllRegisterServerProc>(reinterpret_cast<void*>(GetProcAddress(module, unregister ? "DllUnregisterServer" : "DllRegisterServer")));
    if (!proc) { error = unregister ? L"组件缺少 DllUnregisterServer 入口。" : L"组件缺少 DllRegisterServer 入口。"; FreeLibrary(module); return false; }
    const HRESULT hr = proc();
    // 注册是持久操作，完成后立即卸载模块引用。
    FreeLibrary(module);
    if (FAILED(hr)) {
        error = (unregister ? std::wstring(L"组件注销失败（") : std::wstring(L"组件注册失败（")) + LB_ComHresultText(hr) + L"）：" + absolutePath;
        return false;
    }
    return true;
}

static long long LB_ComCreateRegistryFree(const wchar_t* clsidText, const wchar_t* dllPath, std::wstring& error) {
    error.clear();
    if (!clsidText || !clsidText[0]) { error = L"缺少对象 CLSID。"; return 0; }
    if (!dllPath || !dllPath[0]) { error = L"缺少组件 DLL 路径。"; return 0; }
    HMODULE module = LoadLibraryW(dllPath);
    if (!module) {
        const DWORD code = GetLastError();
        error = code == ERROR_BAD_EXE_FORMAT
            ? std::wstring(L"组件位数与程序位数不匹配，无法加载：") + dllPath
            : L"组件 DLL 加载失败（错误码 " + std::to_wstring(code) + L"）：" + dllPath;
        return 0;
    }
    auto proc = reinterpret_cast<LB_DllGetClassObjectProc>(reinterpret_cast<void*>(GetProcAddress(module, "DllGetClassObject")));
    if (!proc) { error = L"组件缺少 DllGetClassObject 入口：" + std::wstring(dllPath); FreeLibrary(module); return 0; }
    CLSID clsid {};
    if (FAILED(CLSIDFromString(clsidText, &clsid))) { error = L"无法解析对象 CLSID。"; FreeLibrary(module); return 0; }
    IClassFactory* factory = nullptr;
    HRESULT hr = proc(clsid, IID_IClassFactory, reinterpret_cast<void**>(&factory));
    if (FAILED(hr) || !factory) { error = L"获取 IClassFactory 失败（" + LB_ComHresultText(hr) + L"）。"; FreeLibrary(module); return 0; }
    IDispatch* dispatch = nullptr;
    hr = factory->CreateInstance(nullptr, IID_IDispatch, reinterpret_cast<void**>(&dispatch));
    factory->Release();
    if (FAILED(hr) || !dispatch) { error = L"免注册创建 COM 对象失败（" + LB_ComHresultText(hr) + L"）。"; FreeLibrary(module); return 0; }
    // 创建成功后保留模块引用计数，对象存活期间组件 DLL 必须保持加载。
    return LB_ComRegister(dispatch, nullptr, error);
}

using LB_AtlAxWinInitProc = BOOL(__stdcall*)();
using LB_AtlAxGetControlProc = HRESULT(__stdcall*)(HWND, IUnknown**);

static long long LB_ComCreateOcx(HWND parentWindow, const wchar_t* classId, int x, int y, int width, int height,
                                 int border, std::wstring& error) {
    error.clear();
    if (!parentWindow || !IsWindow(parentWindow)) { error = L"OCX 宿主的父窗口句柄无效。"; return 0; }
    if (!classId || !classId[0]) { error = L"缺少控件类标识（CLSID 或 ProgID）。"; return 0; }
    static LB_AtlAxWinInitProc atlInit = nullptr;
    static LB_AtlAxGetControlProc atlGetControl = nullptr;
    if (!atlInit || !atlGetControl) {
        HMODULE atl = LoadLibraryW(L"atl.dll");
        if (!atl) { error = L"系统 atl.dll 加载失败，无法宿主 OCX 控件。"; return 0; }
        atlInit = reinterpret_cast<LB_AtlAxWinInitProc>(reinterpret_cast<void*>(GetProcAddress(atl, "AtlAxWinInit")));
        atlGetControl = reinterpret_cast<LB_AtlAxGetControlProc>(reinterpret_cast<void*>(GetProcAddress(atl, "AtlAxGetControl")));
        if (!atlInit || !atlGetControl) { error = L"系统 atl.dll 缺少 ATL 宿主入口。"; return 0; }
    }
    if (!atlInit()) { error = L"AtlAxWin 窗口类初始化失败。"; return 0; }
    DWORD style = WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS;
    DWORD exStyle = 0;
    switch (border) {
        case 1: exStyle = WS_EX_CLIENTEDGE; break;
        case 2: exStyle = WS_EX_DLGMODALFRAME | WS_EX_WINDOWEDGE; break;
        case 3: exStyle = WS_EX_STATICEDGE; break;
        case 4: exStyle = WS_EX_DLGMODALFRAME | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_OVERLAPPEDWINDOW; break;
        case 5: style |= WS_BORDER; break;
        default: break;
    }
    const HWND ocxWindow = CreateWindowExW(exStyle, L"AtlAxWin", classId, style, x, y, width, height,
                                           parentWindow, reinterpret_cast<HMENU>(static_cast<INT_PTR>(++g_lbComOcxControlId)),
                                           GetModuleHandleW(nullptr), nullptr);
    if (!ocxWindow) { error = L"AtlAxWin 控件窗口创建失败。"; return 0; }
    IUnknown* unknown = nullptr;
    HRESULT hr = atlGetControl(ocxWindow, &unknown);
    if (FAILED(hr) || !unknown) { error = L"获取 OCX 控件对象失败（" + LB_ComHresultText(hr) + L"）。"; DestroyWindow(ocxWindow); return 0; }
    // AtlAxWin 在目标控件未注册时会静默回退创建 WebBrowser（把类标识当 URL 导航），
    // 界面上表现为「无法访问此页」而不是报错。这里用 IPersist::GetClassID 核对实际控件，
    // 不匹配就销毁并把原因明确告诉调用方，避免把回退控件当成功结果使用。
    {
        CLSID expected = {};
        CLSID actual = {};
        const bool expectedResolved = SUCCEEDED(CLSIDFromString(classId, &expected));
        IPersist* persist = nullptr;
        const bool actualResolved = SUCCEEDED(unknown->QueryInterface(IID_IPersist, reinterpret_cast<void**>(&persist)))
            && persist != nullptr
            && SUCCEEDED(persist->GetClassID(&actual));
        if (persist) persist->Release();
        if (expectedResolved && actualResolved && !IsEqualCLSID(expected, actual)) {
            unknown->Release();
            DestroyWindow(ocxWindow);
            error = L"控件未注册，AtlAxWin 回退创建了其它控件（类标识 "
                + std::wstring(classId) + L" 实际得到 " + LB_ComGuidToText(actual)
                + L"）。请先用 COM_注册组件 注册该 OCX，或改用已注册的类标识；32 位 OCX 不能被 64 位程序加载。";
            return 0;
        }
    }
    IDispatch* dispatch = nullptr;
    hr = unknown->QueryInterface(IID_IDispatch, reinterpret_cast<void**>(&dispatch));
    unknown->Release();
    if (FAILED(hr) || !dispatch) { error = L"OCX 控件不支持 IDispatch 自动化（" + LB_ComHresultText(hr) + L"）。"; DestroyWindow(ocxWindow); return 0; }
    LB_ComRegister(dispatch, ocxWindow, error);
    // 返回 OCX 宿主窗口句柄；COM 对象句柄用 COM_取OCX对象 按该窗口取回。
    return reinterpret_cast<long long>(ocxWindow);
}

static bool LB_ComInvokeMember(long long handle, const wchar_t* name, WORD flags,
                               VARIANT* arguments, UINT argumentCount, VARIANT* result, std::wstring& error) {
    error.clear();
    LingComRecord* record = LB_ComFind(handle);
    if (!record || !record->dispatch) { error = L"COM 对象句柄无效。"; return false; }
    if (!name || !name[0]) { error = L"缺少成员名称。"; return false; }
    LPOLESTR names[1] = { const_cast<LPOLESTR>(name) };
    DISPID dispid = 0;
    if (FAILED(record->dispatch->GetIDsOfNames(IID_NULL, names, 1, LOCALE_USER_DEFAULT, &dispid))) {
        error = L"未找到 COM 成员：" + std::wstring(name);
        return false;
    }
    DISPPARAMS dispatchParams { arguments, nullptr, argumentCount, 0 };
    const HRESULT hr = record->dispatch->Invoke(dispid, IID_NULL, LOCALE_USER_DEFAULT, flags, &dispatchParams, result, nullptr, nullptr);
    if (FAILED(hr)) { error = L"调用 COM 成员失败（" + LB_ComHresultText(hr) + L"）：" + std::wstring(name); return false; }
    return true;
}

template <class T> static void LB_ComFillVariant(VARIANT& target, T&& value) {
    using U = std::decay_t<T>;
    VariantInit(&target);
    if constexpr (std::is_same_v<U, std::wstring>) {
        target.vt = VT_BSTR;
        target.bstrVal = SysAllocStringLen(value.c_str(), static_cast<UINT>(value.size()));
    } else if constexpr (std::is_same_v<U, const wchar_t*> || std::is_same_v<U, wchar_t*>) {
        target.vt = VT_BSTR;
        target.bstrVal = SysAllocString(value ? value : L"");
    } else if constexpr (std::is_same_v<U, bool>) {
        target.vt = VT_BOOL;
        target.boolVal = value ? VARIANT_TRUE : VARIANT_FALSE;
    } else if constexpr (std::is_same_v<U, float> || std::is_same_v<U, double>) {
        target.vt = VT_R8;
        target.dblVal = static_cast<double>(value);
    } else if constexpr (std::is_same_v<U, long long> || std::is_same_v<U, unsigned long long>) {
        target.vt = VT_I8;
        target.llVal = static_cast<long long>(value);
    } else {
        target.vt = VT_I4;
        target.lVal = static_cast<long>(value);
    }
}

template <class... Args> static bool LB_ComInvokeVariadic(long long handle, const wchar_t* name, WORD flags,
                                                          VARIANT* result, std::wstring& error, Args&&... args) {
    VARIANT slots[sizeof...(Args) + 1];
    const size_t count = sizeof...(Args);
    size_t remaining = count;
    auto fillOne = [&](auto&& value) { LB_ComFillVariant(slots[--remaining], std::forward<decltype(value)>(value)); };
    (fillOne(std::forward<Args>(args)), ...);
    const bool ok = LB_ComInvokeMember(handle, name, flags, count ? slots : nullptr, static_cast<UINT>(count), result, error);
    for (size_t i = 0; i < count; ++i) VariantClear(&slots[i]);
    return ok;
}

static bool LB_ComCloseObject(long long handle, std::wstring& error) {
    error.clear();
    LingComRecord* record = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_lbComMutex);
        auto found = g_lbComRecords.find(handle);
        if (found == g_lbComRecords.end()) return false;
        record = found->second;
        g_lbComRecords.erase(found);
        g_lbComDispatchers.erase(handle);
        if (record->ocxWindow) g_lbComOcxWindowToHandle.erase(reinterpret_cast<long long>(record->ocxWindow));
    }
    for (auto& connection : record->connections) {
        connection.first->Unadvise(connection.second);
        connection.first->Release();
    }
    record->connections.clear();
    record->eventMaps.clear();
    if (record->ocxWindow && IsWindow(record->ocxWindow)) DestroyWindow(record->ocxWindow);
    if (record->dispatch) record->dispatch->Release();
    delete record;
    return true;
}

static bool LB_ComUnhook(long long handle, std::wstring& error) {
    error.clear();
    LingComRecord* record = LB_ComFind(handle);
    if (!record) { error = L"COM 对象句柄无效。"; return false; }
    std::lock_guard<std::mutex> lock(g_lbComMutex);
    for (auto& connection : record->connections) {
        connection.first->Unadvise(connection.second);
        connection.first->Release();
    }
    const bool hadConnections = !record->connections.empty();
    record->connections.clear();
    record->eventMaps.clear();
    g_lbComDispatchers.erase(handle);
    return hadConnections;
}

static HHOOK g_lbComMsgHook = nullptr;
static DWORD g_lbComHookThreadId = 0;

static LRESULT CALLBACK LB_ComGetMessageProc(int code, WPARAM wParam, LPARAM lParam) {
    if (code >= 0 && wParam == 1 && lParam) {
        const MSG* message = reinterpret_cast<const MSG*>(lParam);
        const bool keyboard = message->message >= WM_KEYFIRST && message->message <= WM_KEYLAST;
        const bool mouse = message->message >= WM_MOUSEFIRST && message->message <= WM_MOUSELAST;
        if (keyboard || mouse) {
            // 转发焦点窗口的祖先链，直到有窗口声明处理（返回非 0）为止。
            HWND current = ::GetParent(GetFocus());
            while (current) {
                if (SendMessageW(current, WM_FORWARDMSG, 0, lParam) != 0) break;
                current = ::GetParent(current);
            }
        }
    }
    return CallNextHookEx(g_lbComMsgHook, code, wParam, lParam);
}

static std::wstring LB_ComGuidToText(const GUID& guid) {
    wchar_t text[64] = {};
    StringFromGUID2(guid, text, 64);
    return text;
}

static std::wstring LB_ComDescribeObject(long long handle) {
    LingComRecord* record = LB_ComFind(handle);
    if (!record || !record->dispatch) return std::wstring(L"COM 对象句柄无效。");
    ITypeInfo* typeInfo = nullptr;
    if (FAILED(record->dispatch->GetTypeInfo(0, 0, &typeInfo)) || !typeInfo) {
        IProvideClassInfo* classInfo = nullptr;
        if (SUCCEEDED(record->dispatch->QueryInterface(IID_IProvideClassInfo, reinterpret_cast<void**>(&classInfo)))) {
            classInfo->GetClassInfo(&typeInfo);
            classInfo->Release();
        }
    }
    if (!typeInfo) return std::wstring(L"该 COM 对象未提供类型信息。");
    std::wstring output;
    TYPEATTR* attributes = nullptr;
    if (FAILED(typeInfo->GetTypeAttr(&attributes)) || !attributes) { typeInfo->Release(); return std::wstring(L"读取类型信息失败。"); }
    BSTR name = nullptr;
    if (SUCCEEDED(typeInfo->GetDocumentation(MEMBERID_NIL, &name, nullptr, nullptr, nullptr)) && name) {
        output += L"类型：" + std::wstring(name) + L"\n";
        SysFreeString(name);
    }
    output += L"GUID：" + LB_ComGuidToText(attributes->guid) + L"\n";
    std::wstring properties, methods, events;
    const UINT functionCount = attributes->cFuncs;
    for (UINT i = 0; i < functionCount; ++i) {
        FUNCDESC* descriptor = nullptr;
        if (FAILED(typeInfo->GetFuncDesc(i, &descriptor)) || !descriptor) continue;
        const bool hidden = (descriptor->wFuncFlags & FUNCFLAG_FRESTRICTED) || (descriptor->wFuncFlags & FUNCFLAG_FHIDDEN);
        if (!hidden) {
            BSTR memberName = nullptr;
            if (SUCCEEDED(typeInfo->GetDocumentation(descriptor->memid, &memberName, nullptr, nullptr, nullptr)) && memberName) {
                std::wstring line = std::wstring(memberName) + L"(" + std::to_wstring(descriptor->memid) + L")";
                SysFreeString(memberName);
                if (descriptor->invkind == INVOKE_PROPERTYGET || descriptor->invkind == INVOKE_PROPERTYPUT || descriptor->invkind == INVOKE_PROPERTYPUTREF) {
                    if (!properties.empty()) properties += L", ";
                    properties += line;
                } else {
                    if (!methods.empty()) methods += L", ";
                    methods += line;
                }
            }
        }
        typeInfo->ReleaseFuncDesc(descriptor);
    }
    // 事件接口：取第一个连接点的源接口并在类型库中定位。
    {
        IConnectionPointContainer* container = nullptr;
        if (SUCCEEDED(record->dispatch->QueryInterface(IID_IConnectionPointContainer, reinterpret_cast<void**>(&container)))) {
            IEnumConnectionPoints* enumerator = nullptr;
            if (SUCCEEDED(container->EnumConnectionPoints(&enumerator)) && enumerator) {
                IConnectionPoint* point = nullptr;
                ULONG fetched = 0;
                if (enumerator->Next(1, &point, &fetched) == S_OK && fetched > 0 && point) {
                    GUID sourceGuid {};
                    if (SUCCEEDED(point->GetConnectionInterface(&sourceGuid))) {
                        ITypeLib* typeLib = nullptr;
                        UINT typeIndex = 0;
                        if (SUCCEEDED(typeInfo->GetContainingTypeLib(&typeLib, &typeIndex)) && typeLib) {
                            ITypeInfo* eventInfo = nullptr;
                            if (SUCCEEDED(typeLib->GetTypeInfoOfGuid(sourceGuid, &eventInfo)) && eventInfo) {
                                TYPEATTR* eventAttributes = nullptr;
                                if (SUCCEEDED(eventInfo->GetTypeAttr(&eventAttributes)) && eventAttributes) {
                                    for (UINT i = 0; i < eventAttributes->cFuncs; ++i) {
                                        FUNCDESC* descriptor = nullptr;
                                        if (FAILED(eventInfo->GetFuncDesc(i, &descriptor)) || !descriptor) continue;
                                        if (descriptor->invkind == INVOKE_FUNC && !(descriptor->wFuncFlags & FUNCFLAG_FRESTRICTED) && !(descriptor->wFuncFlags & FUNCFLAG_FHIDDEN)) {
                                            BSTR memberName = nullptr;
                                            if (SUCCEEDED(eventInfo->GetDocumentation(descriptor->memid, &memberName, nullptr, nullptr, nullptr)) && memberName) {
                                                if (!events.empty()) events += L", ";
                                                events += std::wstring(memberName) + L"(" + std::to_wstring(descriptor->memid) + L")";
                                                SysFreeString(memberName);
                                            }
                                        }
                                        eventInfo->ReleaseFuncDesc(descriptor);
                                    }
                                    eventInfo->ReleaseTypeAttr(eventAttributes);
                                }
                                eventInfo->Release();
                            }
                            typeLib->Release();
                        }
                    }
                    point->Release();
                }
                enumerator->Release();
            }
            container->Release();
        }
    }
    typeInfo->ReleaseTypeAttr(attributes);
    typeInfo->Release();
    output += L"属性：" + (properties.empty() ? std::wstring(L"无") : properties) + L"\n";
    output += L"方法：" + (methods.empty() ? std::wstring(L"无") : methods) + L"\n";
    output += L"事件：" + (events.empty() ? std::wstring(L"无") : events);
    return output;
}
`;

/**
 * COM 自动化模块 v2 窗口类成员方法。
 * 事件命令需要访问 hwnd_（事件投递目标）与 this（派发桥），与多线程模块的
 * 窗口类成员命令形态一致；句柄制支持多 COM 对象并存。
 */
const COM_WINDOW_METHODS = String.raw`
    // ===== COM 自动化模块 v2 =====
    long long COM_创建对象(const wchar_t* progId) { return LB_ComCreateFromProgId(progId, g_lbComError); }
    long long COM_创建对象免注册(const wchar_t* clsid, const wchar_t* dllPath) { return LB_ComCreateRegistryFree(clsid, dllPath, g_lbComError); }
    bool COM_注册组件(const wchar_t* dllPath) { return LB_ComRegisterServer(dllPath, false, g_lbComError); }
    bool COM_注销组件(const wchar_t* dllPath) { return LB_ComRegisterServer(dllPath, true, g_lbComError); }
    std::wstring COM_取组件路径(const wchar_t* fileName) {
        wchar_t modulePath[MAX_PATH] = {};
        GetModuleFileNameW(nullptr, modulePath, MAX_PATH);
        return LB_ReturnText((std::filesystem::path(modulePath).parent_path() / (fileName ? std::wstring(fileName) : std::wstring())).lexically_normal().wstring());
    }
    long long COM_创建OCX组件(HWND parentWindow, const wchar_t* classId, int x, int y, int width, int height, int border) {
        return LB_ComCreateOcx(parentWindow, classId, x, y, width, height, border, g_lbComError);
    }
    long long COM_取OCX对象(long long ocxWindowHandle) {
        std::lock_guard<std::mutex> lock(g_lbComMutex);
        auto found = g_lbComOcxWindowToHandle.find(ocxWindowHandle);
        if (found == g_lbComOcxWindowToHandle.end()) {
            g_lbComError = L"该窗口句柄不是 COM_创建OCX组件 创建的 OCX 宿主窗口。";
            return 0;
        }
        g_lbComError.clear();
        return found->second;
    }

    std::wstring COM_取文本属性(long long handle, const wchar_t* name) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeMember(handle, name, DISPATCH_PROPERTYGET | DISPATCH_METHOD, nullptr, 0, &result, g_lbComError)) return LB_ReturnText(L"");
        std::wstring output = LB_ComVariantToText(result);
        VariantClear(&result);
        return LB_ReturnText(std::move(output));
    }

    double COM_取数值属性(long long handle, const wchar_t* name) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeMember(handle, name, DISPATCH_PROPERTYGET | DISPATCH_METHOD, nullptr, 0, &result, g_lbComError)) return 0.0;
        VARIANT number;
        VariantInit(&number);
        double output = 0.0;
        if (SUCCEEDED(VariantChangeType(&number, &result, 0, VT_R8))) output = number.dblVal;
        VariantClear(&number);
        VariantClear(&result);
        return output;
    }

    bool COM_取逻辑属性(long long handle, const wchar_t* name) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeMember(handle, name, DISPATCH_PROPERTYGET | DISPATCH_METHOD, nullptr, 0, &result, g_lbComError)) return false;
        VARIANT flag;
        VariantInit(&flag);
        bool output = false;
        if (SUCCEEDED(VariantChangeType(&flag, &result, 0, VT_BOOL))) output = flag.boolVal != VARIANT_FALSE;
        VariantClear(&flag);
        VariantClear(&result);
        return output;
    }

    long long COM_取对象属性(long long handle, const wchar_t* name) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeMember(handle, name, DISPATCH_PROPERTYGET | DISPATCH_METHOD, nullptr, 0, &result, g_lbComError)) return 0;
        long long output = 0;
        if ((result.vt == VT_DISPATCH || result.vt == VT_UNKNOWN) && result.pdispVal) {
            IDispatch* dispatch = nullptr;
            if (SUCCEEDED(result.pdispVal->QueryInterface(IID_IDispatch, reinterpret_cast<void**>(&dispatch))) && dispatch) {
                output = LB_ComRegister(dispatch, nullptr, g_lbComError);
            } else {
                result.pdispVal->AddRef();
                output = LB_ComRegister(result.pdispVal, nullptr, g_lbComError);
            }
        }
        VariantClear(&result);
        return output;
    }

    bool COM_置文本属性(long long handle, const wchar_t* name, const wchar_t* value) {
        VARIANT argument;
        LB_ComFillVariant(argument, value ? std::wstring(value) : std::wstring());
        DISPID named = DISPID_PROPERTYPUT;
        DISPPARAMS dispatchParams { &argument, &named, 1, 1 };
        LingComRecord* record = LB_ComFind(handle);
        if (!record || !record->dispatch) { g_lbComError = L"COM 对象句柄无效。"; VariantClear(&argument); return false; }
        LPOLESTR names[1] = { const_cast<LPOLESTR>(name ? name : L"") };
        DISPID dispid = 0;
        if (FAILED(record->dispatch->GetIDsOfNames(IID_NULL, names, 1, LOCALE_USER_DEFAULT, &dispid))) {
            g_lbComError = L"未找到 COM 成员：" + std::wstring(name ? name : L"");
            VariantClear(&argument);
            return false;
        }
        const HRESULT hr = record->dispatch->Invoke(dispid, IID_NULL, LOCALE_USER_DEFAULT, DISPATCH_PROPERTYPUT, &dispatchParams, nullptr, nullptr, nullptr);
        VariantClear(&argument);
        if (FAILED(hr)) { g_lbComError = L"写入 COM 属性失败（" + LB_ComHresultText(hr) + L"）：" + std::wstring(name ? name : L""); return false; }
        g_lbComError.clear();
        return true;
    }

    template <class... Args> bool COM_调用方法(long long handle, const wchar_t* name, Args&&... args) {
        return LB_ComInvokeVariadic(handle, name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, nullptr, g_lbComError, std::forward<Args>(args)...);
    }
    template <class... Args> std::wstring COM_调用文本方法(long long handle, const wchar_t* name, Args&&... args) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeVariadic(handle, name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, &result, g_lbComError, std::forward<Args>(args)...)) return LB_ReturnText(L"");
        std::wstring output = LB_ComVariantToText(result);
        VariantClear(&result);
        return LB_ReturnText(std::move(output));
    }
    template <class... Args> double COM_调用数值方法(long long handle, const wchar_t* name, Args&&... args) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeVariadic(handle, name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, &result, g_lbComError, std::forward<Args>(args)...)) return 0.0;
        VARIANT number;
        VariantInit(&number);
        double output = 0.0;
        if (SUCCEEDED(VariantChangeType(&number, &result, 0, VT_R8))) output = number.dblVal;
        VariantClear(&number);
        VariantClear(&result);
        return output;
    }
    template <class... Args> bool COM_调用逻辑方法(long long handle, const wchar_t* name, Args&&... args) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeVariadic(handle, name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, &result, g_lbComError, std::forward<Args>(args)...)) return false;
        VARIANT flag;
        VariantInit(&flag);
        bool output = false;
        if (SUCCEEDED(VariantChangeType(&flag, &result, 0, VT_BOOL))) output = flag.boolVal != VARIANT_FALSE;
        VariantClear(&flag);
        VariantClear(&result);
        return output;
    }
    template <class... Args> long long COM_调用对象方法(long long handle, const wchar_t* name, Args&&... args) {
        VARIANT result;
        VariantInit(&result);
        if (!LB_ComInvokeVariadic(handle, name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, &result, g_lbComError, std::forward<Args>(args)...)) return 0;
        long long output = 0;
        if ((result.vt == VT_DISPATCH || result.vt == VT_UNKNOWN) && result.pdispVal) {
            IDispatch* dispatch = nullptr;
            if (SUCCEEDED(result.pdispVal->QueryInterface(IID_IDispatch, reinterpret_cast<void**>(&dispatch))) && dispatch) {
                output = LB_ComRegister(dispatch, nullptr, g_lbComError);
            } else {
                result.pdispVal->AddRef();
                output = LB_ComRegister(result.pdispVal, nullptr, g_lbComError);
            }
        }
        VariantClear(&result);
        return output;
    }

    int COM_挂接事件(long long handle) {
        LingComRecord* record = LB_ComFind(handle);
        if (!record || !record->dispatch) { g_lbComError = L"COM 对象句柄无效。"; return 0; }
        g_lbComError.clear();
        if (record->connections.empty()) {
            IConnectionPointContainer* container = nullptr;
            if (FAILED(record->dispatch->QueryInterface(IID_IConnectionPointContainer, reinterpret_cast<void**>(&container)))) {
                g_lbComError = L"该 COM 对象不支持事件（缺少 IConnectionPointContainer）。";
                return 0;
            }
            IEnumConnectionPoints* enumerator = nullptr;
            if (FAILED(container->EnumConnectionPoints(&enumerator)) || !enumerator) {
                container->Release();
                g_lbComError = L"枚举 COM 事件连接点失败。";
                return 0;
            }
            IConnectionPoint* point = nullptr;
            ULONG fetched = 0;
            std::wstring adviseFailure;
            // Advise 全部连接点，兼容暴露多个事件源接口的控件。
            while (enumerator->Next(1, &point, &fetched) == S_OK && fetched > 0 && point) {
                DWORD cookie = 0;
                IID connectionIid = {};
                point->GetConnectionInterface(&connectionIid);
                auto* sink = new LingComEventSink(handle);
                // 先登记事件接口标识，满足按 DIID 校验接收器的控件。
                sink->AcceptEventInterface(connectionIid);
                const HRESULT advised = point->Advise(sink, &cookie);
                sink->Release();
                if (SUCCEEDED(advised) && cookie) {
                    std::lock_guard<std::mutex> lock(g_lbComMutex);
                    record->connections.push_back({point, cookie});
                } else {
                    if (adviseFailure.empty()) {
                        adviseFailure = L"Advise 失败（" + LB_ComHresultText(advised) + L"，事件接口 "
                            + LB_ComGuidToText(connectionIid) + L"）";
                    }
                    point->Release();
                }
                point = nullptr;
            }
            enumerator->Release();
            container->Release();
            if (record->connections.empty()) {
                g_lbComError = adviseFailure.empty() ? std::wstring(L"该 COM 对象没有可用的连接点。") : adviseFailure;
                return 0;
            }
            record->ownerWindow = hwnd_;
            g_lbComDispatchers[handle] = [this](const wchar_t* handler, long long userData, const wchar_t* params) {
                LingDispatchComEventByName(handler, userData, params);
            };
        }
        return static_cast<int>(handle);
    }

    bool COM_映射事件(long long handle, int eventId, const wchar_t* handlerName, int userData) {
        LingComRecord* record = LB_ComFind(handle);
        if (!record) { g_lbComError = L"COM 对象句柄无效。"; return false; }
        std::lock_guard<std::mutex> lock(g_lbComMutex);
        for (auto& mapping : record->eventMaps) {
            if (mapping.dispid == eventId) {
                mapping.handler = handlerName ? handlerName : L"";
                mapping.userData = userData;
                g_lbComError.clear();
                return true;
            }
        }
        record->eventMaps.push_back({eventId, handlerName ? handlerName : L"", userData});
        g_lbComError.clear();
        return true;
    }

    bool COM_取消挂接事件(long long handle, int eventHandle) {
        (void)eventHandle;
        return LB_ComUnhook(handle, g_lbComError);
    }

    long long COM_取事件对象参数(int index) {
        if (!t_lbComEventObjectParams || index < 0 || index >= static_cast<int>(t_lbComEventObjectParams->size())) return 0;
        IDispatch* raw = (*t_lbComEventObjectParams)[static_cast<size_t>(index)];
        if (!raw) return 0;
        IDispatch* dispatch = nullptr;
        if (SUCCEEDED(raw->QueryInterface(IID_IDispatch, reinterpret_cast<void**>(&dispatch))) && dispatch) {
            return LB_ComRegister(dispatch, nullptr, g_lbComError);
        }
        raw->AddRef();
        return LB_ComRegister(raw, nullptr, g_lbComError);
    }

    bool COM_启用OCX消息转发() {
        if (g_lbComMsgHook) { g_lbComError.clear(); return true; }
        g_lbComHookThreadId = GetCurrentThreadId();
        g_lbComMsgHook = SetWindowsHookExW(WH_GETMESSAGE, LB_ComGetMessageProc, nullptr, g_lbComHookThreadId);
        if (!g_lbComMsgHook) { g_lbComError = L"安装 OCX 消息转发钩子失败。"; return false; }
        g_lbComError.clear();
        return true;
    }

    bool COM_移除OCX消息转发() {
        if (!g_lbComMsgHook) return false;
        const bool ok = UnhookWindowsHookEx(g_lbComMsgHook) != FALSE;
        g_lbComMsgHook = nullptr;
        g_lbComHookThreadId = 0;
        return ok;
    }

    std::wstring COM_取接口信息(long long handle) { return LB_ReturnText(LB_ComDescribeObject(handle)); }

    bool COM_关闭(long long handle) { return LB_ComCloseObject(handle, g_lbComError); }
    bool COM_关闭全部() {
        std::vector<long long> handles;
        {
            std::lock_guard<std::mutex> lock(g_lbComMutex);
            handles.reserve(g_lbComRecords.size());
            for (const auto& entry : g_lbComRecords) handles.push_back(entry.first);
        }
        bool closedAny = false;
        for (long long handle : handles) closedAny = LB_ComCloseObject(handle, g_lbComError) || closedAny;
        return closedAny;
    }

    std::wstring COM_取错误() { return LB_ReturnText(g_lbComError); }

    virtual void LingDispatchComEventByName(const wchar_t* handler, long long userData, const wchar_t* paramsText) {
        (void)handler; (void)userData; (void)paramsText;
    }
`;
