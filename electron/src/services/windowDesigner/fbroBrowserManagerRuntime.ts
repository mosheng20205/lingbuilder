export interface FbroBrowserManagerRuntime {
  members: string;
  methods: string;
}

export function generateFbroBrowserManagerRuntime(enabled: boolean): FbroBrowserManagerRuntime {
  if (!enabled) {
    // Keep the generated window base class link-safe when a packaged SDK makes
    // LINGBUILDER_FBRO_AVAILABLE visible despite this project not enabling FBro.
    // The full manager below replaces these overloads when FBro is enabled.
    return {
      members: '',
      methods: String.raw`
    void 浏览器管理器_调整页面() {}
    bool 浏览器管理器_是否全部关闭() const { return true; }
    void 浏览器管理器_关闭全部() {}
    void 浏览器管理器_控件重建前() {}
    void 浏览器管理器_控件重建后() {}
    bool 浏览器管理器_处理插件检查定时器(UINT_PTR) { return false; }
    template<typename TPacket>
    bool 浏览器管理器_处理进程事件(TPacket&) { return false; }
`
    };
  }
  return {
    members: String.raw`
    struct BrowserManagerInstance {
        std::wstring id;
        std::wstring name;
        std::wstring url;
        std::wstring createdAt;
        std::wstring profileDirectory;
        std::wstring processInstanceId;
        std::wstring pluginStatus = L"待启动";
        std::wstring pluginError;
        std::wstring pluginPageStatus = L"尚未检测页面注入";
        std::wstring lastError;
        long long lastDownloadId = 0;
        std::wstring downloadStatus = L"暂无下载";
        std::wstring downloadFile;
        std::wstring downloadFullPath;
        std::wstring downloadDirectory;
        int downloadPercent = -1;
        long long downloadReceivedBytes = 0;
        long long downloadTotalBytes = 0;
        long long downloadCurrentSpeed = 0;
        HWND pageHwnd = nullptr;
        bool open = false;
        bool loading = false;
        bool pluginRegistered = false;
        bool pluginPageActive = false;
        bool extensionDiagnosticsVisible = false;
        int pluginProbeAttemptsRemaining = 0;
        bool pluginReloadedAfterRegistration = false;
    };
    struct BrowserManagerState {
        bool initialized = false;
        bool loadingPersistence = false;
        bool persistenceFaulted = false;
        int tabControlId = 0;
        int listControlId = 0;
        int addressControlId = 0;
        int downloadDetailControlId = 0;
        int downloadProgressControlId = 0;
        std::wstring workspaceKey;
        std::filesystem::path persistenceRoot;
        std::filesystem::path persistencePath;
        std::wstring persistenceDiagnostic;
        std::wstring selectedId;
        std::vector<BrowserManagerInstance> instances;
    } browserManager_;
    struct FbroRegionInstance {
        int id = 0;
        HWND host = nullptr;
        std::wstring processInstanceId;
        std::wstring url;
        std::wstring profileDirectory;
        std::wstring proxyServer;
        std::wstring userAgent;
        int x = 0;
        int y = 0;
        int width = 0;
        int height = 0;
        bool started = false;
    };
    std::vector<FbroRegionInstance> fbroRegions_;
`,
    methods: String.raw`
    // ================= Win32 多实例独立浏览器管理器 =================
    static std::wstring 浏览器管理器_时间戳() {
        SYSTEMTIME now{};
        GetSystemTime(&now);
        wchar_t buffer[48]{};
        swprintf_s(buffer, L"%04u-%02u-%02uT%02u:%02u:%02u.%03uZ",
            now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond, now.wMilliseconds);
        return buffer;
    }

    static std::wstring 浏览器管理器_裁剪文本(const std::wstring& value) {
        size_t start = 0;
        while (start < value.size() && iswspace(value[start])) ++start;
        size_t end = value.size();
        while (end > start && iswspace(value[end - 1])) --end;
        return value.substr(start, end - start);
    }

    static bool 浏览器管理器_地址可导航(const std::wstring& value) {
        return !value.empty() && value.find_first_of(L"\r\n") == std::wstring::npos;
    }

    static bool 浏览器管理器_是插件检查地址(const std::wstring& value) {
        std::wstring normalized = 浏览器管理器_裁剪文本(value);
        while (!normalized.empty() && normalized.back() == L'/') normalized.pop_back();
        std::transform(normalized.begin(), normalized.end(), normalized.begin(), towlower);
        return normalized == L"chrome://extensions";
    }

    static bool 浏览器管理器_插件适用地址(const std::wstring& value) {
        std::wstring normalized = value;
        std::transform(normalized.begin(), normalized.end(), normalized.begin(), towlower);
        return normalized.rfind(L"https://www.doubao.com/chat/", 0) == 0;
    }

    static std::wstring 浏览器管理器_HTML转义(const std::wstring& value) {
        std::wstring result;
        result.reserve(value.size());
        for (const wchar_t character : value) {
            if (character == L'&') result += L"&amp;";
            else if (character == L'<') result += L"&lt;";
            else if (character == L'>') result += L"&gt;";
            else if (character == L'\"') result += L"&quot;";
            else if (character == L'\'') result += L"&#39;";
            else result.push_back(character);
        }
        return result;
    }

    static std::wstring 浏览器管理器_Data地址(const std::wstring& html) {
        const std::string utf8 = lingbuilder_fbro_process_detail::WideToUtf8(html);
        static constexpr char digits[] = "0123456789ABCDEF";
        std::string encoded = "data:text/html;charset=utf-8,";
        encoded.reserve(utf8.size() * 3 + 32);
        for (const unsigned char value : utf8) {
            if ((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z')
                || (value >= '0' && value <= '9') || value == '-' || value == '_'
                || value == '.' || value == '~') {
                encoded.push_back(static_cast<char>(value));
            } else {
                encoded.push_back('%');
                encoded.push_back(digits[(value >> 4) & 0x0f]);
                encoded.push_back(digits[value & 0x0f]);
            }
        }
        return lingbuilder_fbro_process_detail::Utf8ToWide(encoded);
    }

    static bool 浏览器管理器_合法ID(const std::wstring& value) {
        if (value.size() < 14 || value.size() > 56 || value.rfind(L"browser-", 0) != 0) return false;
        for (size_t index = 8; index < value.size(); ++index) {
            const wchar_t character = value[index];
            if (!((character >= L'a' && character <= L'z') || (character >= L'0' && character <= L'9') || character == L'-')) return false;
        }
        return value == lingbuilder_fbro_process_detail::SafePathSegment(value);
    }

    std::filesystem::path 浏览器管理器_程序目录() const {
        return std::filesystem::path(lingbuilder_fbro_process_detail::ExecutableDirectory()).lexically_normal();
    }

    std::filesystem::path 浏览器管理器_数据根(const std::wstring& workspaceKey) const {
        PWSTR localAppData = nullptr;
        std::filesystem::path root;
        if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &localAppData)) && localAppData) {
            root = std::filesystem::path(localAppData) / L"LingBuilder" / L"browser-workspaces"
                / lingbuilder_fbro_process_detail::SafePathSegment(workspaceKey);
            CoTaskMemFree(localAppData);
        }
        if (root.empty()) root = 浏览器管理器_程序目录() / L"browser-data"
            / lingbuilder_fbro_process_detail::SafePathSegment(workspaceKey);
        return root.lexically_normal();
    }

    std::filesystem::path 浏览器管理器_Profile路径(const std::wstring& id) const {
        return (browserManager_.persistenceRoot / L"profiles" / id).lexically_normal();
    }

    std::filesystem::path 浏览器管理器_插件路径() const {
        const auto executableDirectory = 浏览器管理器_程序目录();
        const auto direct = (executableDirectory / L"doubao-downloader").lexically_normal();
        std::error_code error;
        if (std::filesystem::is_directory(direct, error) && !error) return direct;
        error.clear();
        const auto assetsRoot = (executableDirectory / L"assets").lexically_normal();
        const auto sharedAsset = (assetsRoot / L"doubao-downloader").lexically_normal();
        if (std::filesystem::is_directory(sharedAsset, error) && !error) return sharedAsset;
        error.clear();
        for (std::filesystem::directory_iterator iterator(assetsRoot, error), end;
             !error && iterator != end; iterator.increment(error)) {
            if (!iterator->is_directory(error) || error) {
                error.clear();
                continue;
            }
            const auto projectAsset = (iterator->path() / L"doubao-downloader").lexically_normal();
            if (std::filesystem::is_directory(projectAsset, error) && !error) return projectAsset;
            error.clear();
        }
        return direct;
    }

    std::wstring 浏览器管理器_插件检查页地址(const BrowserManagerInstance& instance) const {
        std::wstring pluginName = L"豆包下载器";
        std::wstring pluginVersion = L"未知";
        std::ifstream stream(浏览器管理器_插件路径() / L"manifest.json", std::ios::binary);
        const auto manifest = stream ? LingFbroProcessController::Json::parse(stream, nullptr, false)
                                     : LingFbroProcessController::Json();
        if (manifest.is_object()) {
            pluginName = lingbuilder_fbro_process_detail::JsonWide(manifest, "name", pluginName);
            pluginVersion = lingbuilder_fbro_process_detail::JsonWide(manifest, "version", pluginVersion);
        }
        const std::wstring registration = instance.pluginRegistered
            ? L"已由 FBro VIP RequestContext 正式加载" : instance.pluginStatus;
        const std::wstring pageStatus = instance.pluginPageStatus.empty()
            ? L"尚未检测页面注入" : instance.pluginPageStatus;
        const std::wstring errorBlock = instance.pluginError.empty() ? L""
            : L"<div class='error'><strong>诊断：</strong>" + 浏览器管理器_HTML转义(instance.pluginError) + L"</div>";
        const std::wstring html = L"<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>"
            L"<title>LingBuilder 扩展检查</title><style>"
            L"body{margin:0;background:#f5f6f8;color:#202124;font:14px 'Microsoft YaHei',sans-serif}"
            L"main{max-width:920px;margin:42px auto;padding:0 24px}h1{font-size:26px;margin:0 0 8px}"
            L".note{color:#5f6368;margin-bottom:24px}.extension{background:#fff;border:1px solid #dfe1e5;border-radius:8px;padding:20px}"
            L".title{font-size:19px;font-weight:600}.version{color:#5f6368;margin-left:10px}.grid{display:grid;grid-template-columns:150px 1fr;gap:12px;margin-top:20px}"
            L".label{color:#5f6368}.value{overflow-wrap:anywhere}.ok{color:#137333}.error{margin-top:18px;padding:12px;background:#fce8e6;color:#a50e0e;border-radius:4px}"
            L"code{font-family:Consolas,monospace}</style></head><body><main><h1>扩展检查</h1>"
            L"<div class='note'>FBro 嵌入式 Alloy 运行时不提供 Chrome 自带的扩展管理界面；本页使用 VIP 加载回调、RequestContext 路径回读和页面 DOM 探针展示真实状态。</div>"
            L"<section class='extension'><div><span class='title'>" + 浏览器管理器_HTML转义(pluginName)
            + L"</span><span class='version'>" + 浏览器管理器_HTML转义(pluginVersion) + L"</span></div>"
            L"<div class='grid'><div class='label'>扩展登记</div><div class='value ok'>" + 浏览器管理器_HTML转义(registration)
            + L"</div><div class='label'>页面生效检查</div><div class='value'>" + 浏览器管理器_HTML转义(pageStatus)
            + L"</div><div class='label'>扩展 ID</div><div class='value'><code>"
            + 浏览器管理器_HTML转义(lingbuilder_fbro_process_detail::ChromiumExtensionIdForPath(浏览器管理器_插件路径().wstring()))
            + L"</code></div><div class='label'>加载目录</div><div class='value'><code>"
            + 浏览器管理器_HTML转义(浏览器管理器_插件路径().wstring()) + L"</code></div></div>"
            + errorBlock + L"</section></main></body></html>";
        return 浏览器管理器_Data地址(html);
    }

    BrowserManagerInstance* 浏览器管理器_查找(const std::wstring& id) {
        for (auto& instance : browserManager_.instances) if (instance.id == id) return &instance;
        return nullptr;
    }

    const BrowserManagerInstance* 浏览器管理器_查找(const std::wstring& id) const {
        for (const auto& instance : browserManager_.instances) if (instance.id == id) return &instance;
        return nullptr;
    }

    int 浏览器管理器_查找索引(const std::wstring& id) const {
        for (int index = 0; index < static_cast<int>(browserManager_.instances.size()); ++index) {
            if (browserManager_.instances[static_cast<size_t>(index)].id == id) return index;
        }
        return -1;
    }

    BrowserManagerInstance* 浏览器管理器_当前() {
        return 浏览器管理器_查找(browserManager_.selectedId);
    }

    const BrowserManagerInstance* 浏览器管理器_当前() const {
        return 浏览器管理器_查找(browserManager_.selectedId);
    }

    RuntimeControl* 浏览器管理器_标签控件() {
        return FindRuntimeControl(browserManager_.tabControlId);
    }

    RuntimeControl* 浏览器管理器_列表控件() {
        return FindRuntimeControl(browserManager_.listControlId);
    }

    RuntimeControl* 浏览器管理器_地址控件() {
        return FindRuntimeControl(browserManager_.addressControlId);
    }

    RuntimeControl* 浏览器管理器_下载详情控件() {
        return FindRuntimeControl(browserManager_.downloadDetailControlId);
    }

    RuntimeControl* 浏览器管理器_下载进度控件() {
        return FindRuntimeControl(browserManager_.downloadProgressControlId);
    }

    void 浏览器管理器_同步地址栏() {
        RuntimeControl* address = 浏览器管理器_地址控件();
        const BrowserManagerInstance* instance = 浏览器管理器_当前();
        if (address && address->hwnd && IsWindow(address->hwnd)) {
            SetWindowTextW(address->hwnd, instance ? instance->url.c_str() : L"");
        }
    }

    std::wstring 浏览器管理器_下载详情文本(const BrowserManagerInstance* instance) const {
        if (!instance) return L"PID 0 | 页面 HWND 0\r\n下载：暂无下载\r\n文件：-\r\n目录：-";
        const int processId = instance->open
            ? static_cast<int>(LingFbroProcessController::Instance().ProcessId(instance->processInstanceId)) : 0;
        std::wstring status = instance->downloadStatus.empty() ? L"暂无下载" : instance->downloadStatus;
        if (instance->downloadReceivedBytes > 0 || instance->downloadTotalBytes > 0) {
            status += L" | " + std::to_wstring(instance->downloadReceivedBytes) + L" / "
                + std::to_wstring(instance->downloadTotalBytes) + L" 字节";
        }
        return L"PID " + std::to_wstring(processId) + L" | 页面 HWND "
            + std::to_wstring(reinterpret_cast<uintptr_t>(instance->pageHwnd))
            + L"\r\n下载：" + status
            + L"\r\n文件：" + (instance->downloadFile.empty() ? std::wstring(L"-") : instance->downloadFile)
            + L"\r\n目录：" + (instance->downloadDirectory.empty() ? std::wstring(L"-") : instance->downloadDirectory);
    }

    void 浏览器管理器_同步下载视图() {
        RuntimeControl* detail = 浏览器管理器_下载详情控件();
        RuntimeControl* progress = 浏览器管理器_下载进度控件();
        const BrowserManagerInstance* instance = 浏览器管理器_当前();
        if (detail && detail->hwnd && IsWindow(detail->hwnd)) {
            const std::wstring text = 浏览器管理器_下载详情文本(instance);
            SetWindowTextW(detail->hwnd, text.c_str());
        }
        if (progress && progress->hwnd && IsWindow(progress->hwnd)) {
            int percent = instance ? instance->downloadPercent : 0;
            if (instance && instance->downloadStatus == L"下载完成") percent = 100;
            percent = (std::max)(0, (std::min)(100, percent));
            SendMessageW(progress->hwnd, PBM_SETRANGE32, 0, 100);
            SendMessageW(progress->hwnd, PBM_SETPOS, static_cast<WPARAM>(percent), 0);
        }
    }

    bool 浏览器管理器_请求(BrowserManagerInstance& instance, const wchar_t* method,
                          const LingFbroProcessController::Json& payload,
                          LingFbroProcessController::Json& result) {
        if (!instance.open || !method) return false;
        if (LingFbroProcessController::Instance().Request(instance.processInstanceId, method, payload, result)) return true;
        instance.lastError = LingFbroProcessController::Instance().LastError(instance.processInstanceId);
        return false;
    }

    bool 浏览器管理器_通知(BrowserManagerInstance& instance, const wchar_t* method,
                          const LingFbroProcessController::Json& payload = LingFbroProcessController::Json::object()) {
        if (!instance.open || !method) return false;
        if (LingFbroProcessController::Instance().Notify(instance.processInstanceId, method, payload)) return true;
        instance.lastError = LingFbroProcessController::Instance().LastError(instance.processInstanceId);
        return false;
    }

    bool 浏览器管理器_逻辑(BrowserManagerInstance& instance, const wchar_t* method,
                          const LingFbroProcessController::Json& payload = LingFbroProcessController::Json::object()) {
        LingFbroProcessController::Json result;
        if (!浏览器管理器_请求(instance, method, payload, result)) return false;
        return !result.contains("value") || result.value("value", false);
    }

    void 浏览器管理器_清空页面() {
        RuntimeControl* tab = 浏览器管理器_标签控件();
        for (auto item = tabPages_.begin(); item != tabPages_.end();) {
            if (item->tabControlId != browserManager_.tabControlId) { ++item; continue; }
            if (item->hwnd && IsWindow(item->hwnd)) DestroyWindow(item->hwnd);
            item = tabPages_.erase(item);
        }
        if (tab && tab->hwnd) TabCtrl_DeleteAllItems(tab->hwnd);
        for (auto& instance : browserManager_.instances) instance.pageHwnd = nullptr;
    }

    HWND 浏览器管理器_创建页面(BrowserManagerInstance& instance, int index) {
        RuntimeControl* tab = 浏览器管理器_标签控件();
        const ControlSpec* control = tab ? FindControl(tab->id) : nullptr;
        if (!tab || !tab->hwnd || !control || !IsType(*control, L"TabControl")) return nullptr;
        TCITEMW item{};
        item.mask = TCIF_TEXT;
        item.pszText = const_cast<wchar_t*>(instance.name.c_str());
        if (TabCtrl_InsertItem(tab->hwnd, index, &item) < 0) return nullptr;
        RECT pageRect{};
        GetClientRect(tab->hwnd, &pageRect);
        if (!tab->hideTabHeader) TabCtrl_AdjustRect(tab->hwnd, FALSE, &pageRect);
        HWND page = CreateWindowExW(
            WS_EX_CONTROLPARENT, L"STATIC", L"",
            WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | SS_NOTIFY,
            pageRect.left, pageRect.top,
            (std::max)(0L, pageRect.right - pageRect.left),
            (std::max)(0L, pageRect.bottom - pageRect.top),
            tab->hwnd, nullptr, g_instance, nullptr);
        if (!page) {
            TabCtrl_DeleteItem(tab->hwnd, index);
            return nullptr;
        }
        SetWindowSubclass(page, TabPageSubclassProc,
            static_cast<UINT_PTR>(control->id * 1000 + index + 501), reinterpret_cast<DWORD_PTR>(this));
        tabPages_.push_back({control->id, instance.id, page, pageRect});
        instance.pageHwnd = page;
        return page;
    }

    void 浏览器管理器_删除页面(int index) {
        if (index < 0 || index >= static_cast<int>(browserManager_.instances.size())) return;
        HWND page = browserManager_.instances[static_cast<size_t>(index)].pageHwnd;
        if (page && IsWindow(page)) DestroyWindow(page);
        tabPages_.erase(std::remove_if(tabPages_.begin(), tabPages_.end(), [&](const RuntimeTabPage& item) {
            return item.tabControlId == browserManager_.tabControlId && item.hwnd == page;
        }), tabPages_.end());
        RuntimeControl* tab = 浏览器管理器_标签控件();
        if (tab && tab->hwnd) TabCtrl_DeleteItem(tab->hwnd, index);
    }

    bool 浏览器管理器_启动(BrowserManagerInstance& instance) {
        if (!instance.pageHwnd || !IsWindow(instance.pageHwnd)) {
            instance.lastError = L"浏览器页面 HWND 无效。";
            return false;
        }
        std::error_code directoryError;
        std::filesystem::create_directories(instance.profileDirectory, directoryError);
        if (directoryError) {
            instance.lastError = L"无法创建实例 Profile 目录。";
            return false;
        }
        RECT bounds{};
        GetClientRect(instance.pageHwnd, &bounds);
        LingFbroProcessConfig config;
        config.instanceId = instance.processInstanceId;
        config.eventWindow = hwnd_;
        config.hostWindow = instance.pageHwnd;
        config.mode = LING_FBRO_PROCESS_EMBEDDED;
        config.width = (std::max)(1L, bounds.right - bounds.left);
        config.height = (std::max)(1L, bounds.bottom - bounds.top);
        config.visible = instance.id == browserManager_.selectedId;
        instance.extensionDiagnosticsVisible = 浏览器管理器_是插件检查地址(instance.url);
        config.url = instance.extensionDiagnosticsVisible
            ? 浏览器管理器_插件检查页地址(instance)
            : instance.url.empty() ? L"https://www.doubao.com/" : instance.url;
        config.profileDirectory = instance.profileDirectory;
        config.extensionDirectory = 浏览器管理器_插件路径().wstring();
        config.flags = 7U;
        instance.pluginStatus = L"插件加载中";
        instance.pluginError.clear();
        instance.pluginPageStatus = L"尚未检测页面注入";
        instance.pluginRegistered = false;
        instance.pluginPageActive = false;
        instance.pluginProbeAttemptsRemaining = 0;
        instance.pluginReloadedAfterRegistration = false;
        instance.loading = true;
        if (LingFbroProcessController::Instance().Start(config, false) <= 0) {
            instance.open = false;
            instance.loading = false;
            instance.lastError = LingFbroProcessController::Instance().LastError(instance.processInstanceId);
            if (instance.lastError.empty()) instance.lastError = L"独立 FBro Host 启动失败。";
            return false;
        }
        instance.open = true;
        instance.lastError.clear();
        return true;
    }

    void 浏览器管理器_同步列表() {
        RuntimeControl* list = 浏览器管理器_列表控件();
        const ControlSpec* control = list ? FindControl(list->id) : nullptr;
        if (!list || !list->hwnd || !control || !IsType(*control, L"ListBox")) return;
        SendMessageW(list->hwnd, WM_SETREDRAW, FALSE, 0);
        SendMessageW(list->hwnd, LB_RESETCONTENT, 0, 0);
        int selected = -1;
        for (int index = 0; index < static_cast<int>(browserManager_.instances.size()); ++index) {
            const auto& instance = browserManager_.instances[static_cast<size_t>(index)];
            const std::wstring state = instance.open
                ? LingFbroProcessController::Instance().State(instance.processInstanceId) : L"已关闭";
            const std::wstring plugin = instance.pluginError.empty()
                ? instance.pluginStatus : instance.pluginStatus + L"：" + instance.pluginError;
            const std::wstring text = (instance.id == browserManager_.selectedId ? L"● " : L"○ ")
                + instance.name + L"  [" + state + L" / " + plugin + L"]";
            SendMessageW(list->hwnd, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(text.c_str()));
            if (instance.id == browserManager_.selectedId) selected = index;
        }
        SendMessageW(list->hwnd, LB_SETCURSEL, selected, 0);
        SendMessageW(list->hwnd, WM_SETREDRAW, TRUE, 0);
        InvalidateRect(list->hwnd, nullptr, TRUE);
    }

    void 浏览器管理器_显示索引(int selectedIndex, bool focusBrowser) {
        RuntimeControl* tab = 浏览器管理器_标签控件();
        if (!tab || !tab->hwnd || selectedIndex < 0
            || selectedIndex >= static_cast<int>(browserManager_.instances.size())) return;
        BrowserManagerInstance& selected = browserManager_.instances[static_cast<size_t>(selectedIndex)];
        if (!selected.open) 浏览器管理器_启动(selected);
        RECT pageRect{};
        GetClientRect(tab->hwnd, &pageRect);
        if (!tab->hideTabHeader) TabCtrl_AdjustRect(tab->hwnd, FALSE, &pageRect);
        TabCtrl_SetCurSel(tab->hwnd, selectedIndex);
        if (selected.pageHwnd && IsWindow(selected.pageHwnd)) {
            SetWindowPos(selected.pageHwnd, HWND_TOP, pageRect.left, pageRect.top,
                (std::max)(0L, pageRect.right - pageRect.left),
                (std::max)(0L, pageRect.bottom - pageRect.top),
                SWP_NOACTIVATE | SWP_SHOWWINDOW);
            浏览器管理器_通知(selected, L"show");
            浏览器管理器_通知(selected, L"resize", {
                {"width", (std::max)(1L, pageRect.right - pageRect.left)},
                {"height", (std::max)(1L, pageRect.bottom - pageRect.top)}
            });
            if (focusBrowser) 浏览器管理器_通知(selected, L"focus", {{"value", true}});
        }
        for (int index = 0; index < static_cast<int>(browserManager_.instances.size()); ++index) {
            if (index == selectedIndex) continue;
            auto& instance = browserManager_.instances[static_cast<size_t>(index)];
            if (instance.pageHwnd && IsWindow(instance.pageHwnd)) ShowWindow(instance.pageHwnd, SW_HIDE);
            浏览器管理器_通知(instance, L"hide");
        }
        browserManager_.selectedId = selected.id;
        浏览器管理器_同步列表();
        浏览器管理器_同步地址栏();
        浏览器管理器_同步下载视图();
    }

    std::wstring 浏览器管理器_生成稳定ID() const {
        for (int attempt = 0; attempt < 32; ++attempt) {
            const std::wstring candidate = L"browser-" + lingbuilder_fbro_process_detail::RandomHex(8);
            if (浏览器管理器_合法ID(candidate) && !浏览器管理器_查找(candidate)) return candidate;
        }
        return L"";
    }

    bool 浏览器管理器_保存配置() {
        if (!browserManager_.initialized || browserManager_.loadingPersistence) return true;
        if (browserManager_.persistenceFaulted || browserManager_.persistencePath.empty()) return false;
        LingFbroProcessController::Json document = {
            {"schemaVersion", 1},
            {"workspaceType", "lingbuilder.multi-browser-workbench"},
            {"selectedInstanceId", lingbuilder_fbro_process_detail::JsonUtf8(browserManager_.selectedId)},
            {"pluginDirectory", "doubao-downloader"},
            {"instances", LingFbroProcessController::Json::array()}
        };
        for (int index = 0; index < static_cast<int>(browserManager_.instances.size()); ++index) {
            const auto& instance = browserManager_.instances[static_cast<size_t>(index)];
            document["instances"].push_back({
                {"id", lingbuilder_fbro_process_detail::JsonUtf8(instance.id)},
                {"name", lingbuilder_fbro_process_detail::JsonUtf8(instance.name)},
                {"order", index},
                {"cacheDirectory", "profiles/" + lingbuilder_fbro_process_detail::JsonUtf8(instance.id)},
                {"lastUrl", lingbuilder_fbro_process_detail::JsonUtf8(instance.url)},
                {"createdAt", lingbuilder_fbro_process_detail::JsonUtf8(instance.createdAt)},
                {"restoreOpen", true},
                {"pluginStatus", lingbuilder_fbro_process_detail::JsonUtf8(instance.pluginStatus)}
            });
        }
        std::error_code error;
        std::filesystem::create_directories(browserManager_.persistencePath.parent_path(), error);
        if (error) {
            browserManager_.persistenceDiagnostic = L"无法创建浏览器实例配置目录。";
            return false;
        }
        const std::filesystem::path temporary = browserManager_.persistencePath.wstring()
            + L".tmp-" + std::to_wstring(GetCurrentProcessId());
        {
            std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
            const std::string utf8 = document.dump(2) + "\n";
            stream.write(utf8.data(), static_cast<std::streamsize>(utf8.size()));
            stream.flush();
            if (!stream.good()) {
                stream.close();
                DeleteFileW(temporary.c_str());
                browserManager_.persistenceDiagnostic = L"浏览器实例配置临时文件写入失败。";
                return false;
            }
        }
        const std::filesystem::path backup = browserManager_.persistencePath.wstring() + L".bak";
        if (std::filesystem::exists(browserManager_.persistencePath)) {
            CopyFileW(browserManager_.persistencePath.c_str(), backup.c_str(), FALSE);
        }
        if (!MoveFileExW(temporary.c_str(), browserManager_.persistencePath.c_str(),
                         MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            DeleteFileW(temporary.c_str());
            browserManager_.persistenceDiagnostic = L"浏览器实例配置原子替换失败，错误码："
                + std::to_wstring(GetLastError());
            return false;
        }
        return true;
    }

    LingFbroProcessController::Json 浏览器管理器_读取配置(const std::filesystem::path& file) const {
        std::ifstream stream(file, std::ios::binary);
        if (!stream) return {};
        auto document = LingFbroProcessController::Json::parse(stream, nullptr, false);
        return document.is_object() ? document : LingFbroProcessController::Json();
    }

    bool 浏览器管理器_新增内部(const std::wstring& requestedId, const std::wstring& requestedName,
                              const std::wstring& requestedUrl, const std::wstring& createdAt) {
        const std::wstring id = requestedId.empty() ? 浏览器管理器_生成稳定ID() : requestedId;
        const std::wstring name = 浏览器管理器_裁剪文本(requestedName);
        const std::wstring url = 浏览器管理器_裁剪文本(requestedUrl);
        if (!浏览器管理器_合法ID(id) || 浏览器管理器_查找(id) || name.empty() || name.size() > 80
            || !浏览器管理器_地址可导航(url)) return false;
        BrowserManagerInstance instance;
        instance.id = id;
        instance.name = name;
        instance.url = url;
        instance.createdAt = createdAt.empty() ? 浏览器管理器_时间戳() : createdAt;
        instance.profileDirectory = 浏览器管理器_Profile路径(id).wstring();
        instance.processInstanceId = L"win32-browser-manager:"
            + std::to_wstring(reinterpret_cast<uintptr_t>(hwnd_)) + L":" + id;
        browserManager_.instances.push_back(std::move(instance));
        BrowserManagerInstance& created = browserManager_.instances.back();
        const int index = static_cast<int>(browserManager_.instances.size()) - 1;
        if (!浏览器管理器_创建页面(created, index)) {
            browserManager_.instances.pop_back();
            return false;
        }
        browserManager_.selectedId = created.id;
        const bool started = 浏览器管理器_启动(created);
        浏览器管理器_显示索引(index, true);
        浏览器管理器_同步列表();
        if (!browserManager_.loadingPersistence) 浏览器管理器_保存配置();
        return started;
    }

    int 浏览器管理器_加载配置() {
        if (!std::filesystem::exists(browserManager_.persistencePath)) return 0;
        auto document = 浏览器管理器_读取配置(browserManager_.persistencePath);
        bool recovered = false;
        if (document.is_null()) {
            const std::filesystem::path backup = browserManager_.persistencePath.wstring() + L".bak";
            document = 浏览器管理器_读取配置(backup);
            if (document.is_null()) {
                browserManager_.persistenceFaulted = true;
                browserManager_.persistenceDiagnostic = L"浏览器实例配置和备份均损坏；原文件已保留，本次使用临时默认实例。";
                return -1;
            }
            recovered = true;
            const std::filesystem::path corrupt = browserManager_.persistencePath.wstring()
                + L".corrupt-" + lingbuilder_fbro_process_detail::SafePathSegment(浏览器管理器_时间戳());
            MoveFileExW(browserManager_.persistencePath.c_str(), corrupt.c_str(), MOVEFILE_WRITE_THROUGH);
            browserManager_.persistenceDiagnostic = L"主配置损坏，已从备份恢复并保留损坏文件。";
        }
        if (document.value("schemaVersion", 0) != 1
            || document.value("workspaceType", "") != "lingbuilder.multi-browser-workbench"
            || document.value("pluginDirectory", "") != "doubao-downloader"
            || !document.contains("instances") || !document["instances"].is_array()) {
            browserManager_.persistenceFaulted = true;
            browserManager_.persistenceDiagnostic = L"浏览器实例配置版本、类型或插件目录无效；原文件未覆盖。";
            return -1;
        }
        struct RestoreItem { int order = 0; LingFbroProcessController::Json value; };
        std::vector<RestoreItem> restored;
        std::set<std::wstring> ids;
        std::set<std::wstring> names;
        for (const auto& item : document["instances"]) {
            if (!item.is_object()) continue;
            const std::wstring id = lingbuilder_fbro_process_detail::JsonWide(item, "id");
            const std::string expectedProfile = "profiles/" + lingbuilder_fbro_process_detail::JsonUtf8(id);
            if (!浏览器管理器_合法ID(id) || ids.count(id) || item.value("cacheDirectory", "") != expectedProfile) {
                browserManager_.persistenceDiagnostic = L"已跳过 ID 重复、缓存路径重复或结构无效的浏览器实例。";
                continue;
            }
            ids.insert(id);
            restored.push_back({item.value("order", static_cast<int>(restored.size())), item});
        }
        std::stable_sort(restored.begin(), restored.end(), [](const auto& left, const auto& right) {
            return left.order < right.order;
        });
        browserManager_.loadingPersistence = true;
        int loaded = 0;
        for (const auto& restoredItem : restored) {
            const auto& item = restoredItem.value;
            const std::wstring id = lingbuilder_fbro_process_detail::JsonWide(item, "id");
            std::wstring name = 浏览器管理器_裁剪文本(lingbuilder_fbro_process_detail::JsonWide(item, "name", id));
            if (name.empty()) name = id;
            if (names.count(name)) {
                name += L"（" + std::to_wstring(loaded + 1) + L"）";
                browserManager_.persistenceDiagnostic = L"配置含重复实例名称，已在内存中安全区分。";
            }
            names.insert(name);
            const std::wstring url = lingbuilder_fbro_process_detail::JsonWide(item, "lastUrl", L"https://www.doubao.com/");
            const std::wstring createdAt = lingbuilder_fbro_process_detail::JsonWide(item, "createdAt", 浏览器管理器_时间戳());
            if (浏览器管理器_新增内部(id, name, url, createdAt)) ++loaded;
        }
        browserManager_.loadingPersistence = false;
        const std::wstring selected = lingbuilder_fbro_process_detail::JsonWide(document, "selectedInstanceId");
        const int selectedIndex = 浏览器管理器_查找索引(selected);
        if (selectedIndex >= 0) 浏览器管理器_显示索引(selectedIndex, true);
        else if (!browserManager_.instances.empty()) 浏览器管理器_显示索引(0, true);
        if (loaded > 0 && !recovered) 浏览器管理器_保存配置();
        return loaded;
    }

    int 浏览器管理器_初始化(HWND tabControlHandle, HWND listControlHandle,
                          const std::wstring& workspaceKey) {
        RuntimeControl* tab = nullptr;
        RuntimeControl* list = nullptr;
        for (auto& runtime : runtimeControls_) {
            if (runtime.hwnd == tabControlHandle) tab = &runtime;
            if (runtime.hwnd == listControlHandle) list = &runtime;
        }
        const ControlSpec* tabSpec = tab ? FindControl(tab->id) : nullptr;
        const ControlSpec* listSpec = list ? FindControl(list->id) : nullptr;
        if (!tab || !list || !tabSpec || !listSpec || !IsType(*tabSpec, L"TabControl") || !IsType(*listSpec, L"ListBox")) {
            调试输出(L"浏览器管理器初始化失败：必须传入 Win32 选项卡和列表框控件。");
            return -1;
        }
        if (workspaceKey.empty() || workspaceKey != lingbuilder_fbro_process_detail::SafePathSegment(workspaceKey)) {
            调试输出(L"浏览器管理器初始化失败：工作区键无效。");
            return -1;
        }
        浏览器管理器_关闭全部();
        browserManager_ = BrowserManagerState{};
        browserManager_.initialized = true;
        browserManager_.tabControlId = tab->id;
        browserManager_.listControlId = list->id;
        browserManager_.workspaceKey = workspaceKey;
        browserManager_.persistenceRoot = 浏览器管理器_数据根(workspaceKey);
        browserManager_.persistencePath = browserManager_.persistenceRoot / L"browser-instances.json";
        tab->hideTabHeader = true;
        浏览器管理器_清空页面();
        std::error_code error;
        std::filesystem::create_directories(browserManager_.persistenceRoot / L"profiles", error);
        if (error) {
            browserManager_.persistenceFaulted = true;
            browserManager_.persistenceDiagnostic = L"无法创建浏览器实例数据目录。";
        }
        int loaded = error ? -1 : 浏览器管理器_加载配置();
        if (browserManager_.instances.empty()) {
            browserManager_.loadingPersistence = true;
            浏览器管理器_新增内部(L"", L"浏览器 1", L"https://www.doubao.com/", L"");
            browserManager_.loadingPersistence = false;
            if (!browserManager_.persistenceFaulted) 浏览器管理器_保存配置();
        }
        浏览器管理器_同步列表();
        return loaded > 0 ? loaded : static_cast<int>(browserManager_.instances.size());
    }

    bool 浏览器管理器_绑定下载视图(HWND detailControlHandle, HWND progressControlHandle) {
        RuntimeControl* detail = nullptr;
        RuntimeControl* progress = nullptr;
        for (auto& runtime : runtimeControls_) {
            if (runtime.hwnd == detailControlHandle) detail = &runtime;
            if (runtime.hwnd == progressControlHandle) progress = &runtime;
        }
        const ControlSpec* detailSpec = detail ? FindControl(detail->id) : nullptr;
        const ControlSpec* progressSpec = progress ? FindControl(progress->id) : nullptr;
        if (!detail || !detailSpec || (!IsType(*detailSpec, L"TextBox") && !IsType(*detailSpec, L"Label"))
            || !progress || !progressSpec || !IsType(*progressSpec, L"ProgressBar")) {
            调试输出(L"浏览器管理器绑定下载视图失败：必须传入文本框或标签，以及进度条控件。");
            return false;
        }
        browserManager_.downloadDetailControlId = detail->id;
        browserManager_.downloadProgressControlId = progress->id;
        浏览器管理器_同步下载视图();
        return true;
    }

    bool 浏览器管理器_绑定地址栏(HWND addressControlHandle) {
        RuntimeControl* address = nullptr;
        for (auto& runtime : runtimeControls_) {
            if (runtime.hwnd == addressControlHandle) { address = &runtime; break; }
        }
        const ControlSpec* addressSpec = address ? FindControl(address->id) : nullptr;
        if (!address || !addressSpec || !IsType(*addressSpec, L"TextBox")) {
            调试输出(L"浏览器管理器绑定地址栏失败：必须传入当前窗口的文本框控件。");
            return false;
        }
        browserManager_.addressControlId = address->id;
        浏览器管理器_同步地址栏();
        return true;
    }

    bool 浏览器管理器_新增实例(const std::wstring& name, const std::wstring& address) {
        return browserManager_.initialized && 浏览器管理器_新增内部(L"", name, address, L"");
    }

    // 纯 Win32 动态内嵌区域（不依赖 new_emoji）：在宿主窗口客户区指定矩形新建 WS_CHILD 承载子窗，
    // 复用已出货的 LING_FBRO_PROCESS_EMBEDDED 跨进程内嵌路径把独立进程浏览器作为其子窗挂入。
    int FBro_创建区域(int instanceId, int left, int top, int width, int height,
                      const wchar_t* address, const wchar_t* cacheDirectory,
                      const wchar_t* proxyServer, const wchar_t* userAgent) {
#if LINGBUILDER_FBRO_AVAILABLE
        if (!hwnd_ || width <= 0 || height <= 0) { 调试输出(L"FBro 创建区域失败：窗口未就绪或尺寸非法。"); return 0; }
        for (const auto& existing : fbroRegions_) if (existing.id == instanceId) { 调试输出(L"FBro 创建区域失败：该实例编号已存在。"); return 0; }
        const UINT dpi = GetDpiForWindow(hwnd_);
        const auto scale = [dpi](int value) { return MulDiv(value, static_cast<int>(dpi ? dpi : 96), 96); };
        HWND host = CreateWindowExW(0, L"STATIC", L"", WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
            scale(left), scale(top), (std::max)(1, scale(width)), (std::max)(1, scale(height)),
            hwnd_, nullptr, g_instance, nullptr);
        if (!host) { 调试输出(L"FBro 创建区域失败：无法创建承载子窗口。"); return 0; }
        FbroRegionInstance region;
        region.id = instanceId; region.host = host;
        region.x = left; region.y = top; region.width = width; region.height = height;
        region.processInstanceId = L"win32-region:" + std::to_wstring(reinterpret_cast<uintptr_t>(hwnd_)) + L":" + std::to_wstring(instanceId);
        region.url = address ? address : L"";
        region.proxyServer = proxyServer ? proxyServer : L"";
        region.userAgent = userAgent ? userAgent : L"";
        region.profileDirectory = (cacheDirectory && cacheDirectory[0]) ? cacheDirectory : (L".fbro-region-" + std::to_wstring(instanceId));
        std::error_code directoryError;
        std::filesystem::create_directories(region.profileDirectory, directoryError);
        RECT bounds{}; GetClientRect(host, &bounds);
        LingFbroProcessConfig config;
        config.instanceId = region.processInstanceId;
        config.eventWindow = hwnd_;
        config.hostWindow = host;
        config.mode = LING_FBRO_PROCESS_EMBEDDED;
        config.width = (std::max)(1L, bounds.right - bounds.left);
        config.height = (std::max)(1L, bounds.bottom - bounds.top);
        config.visible = true;
        config.url = region.url.empty() ? L"about:blank" : region.url;
        config.profileDirectory = region.profileDirectory;
        config.userAgent = region.userAgent;
        config.proxyServer = region.proxyServer;
        config.flags = 7U;
        if (LingFbroProcessController::Instance().Start(config, false) <= 0) {
            调试输出((std::wstring(L"FBro 创建区域失败：") + LingFbroProcessController::Instance().LastError(region.processInstanceId)).c_str());
            DestroyWindow(host);
            return 0;
        }
        region.started = true;
        fbroRegions_.push_back(std::move(region));
        ShowWindow(host, SW_SHOWNOACTIVATE);
        return 1;
#else
        (void)instanceId; (void)left; (void)top; (void)width; (void)height;
        (void)address; (void)cacheDirectory; (void)proxyServer; (void)userAgent;
        调试输出(L"FBro 创建区域失败：当前构建未启用 FBro 独立进程运行时。"); return 0;
#endif
    }

    void FBro_调整区域实例() {
#if LINGBUILDER_FBRO_AVAILABLE
        if (!hwnd_) return;
        const UINT dpi = GetDpiForWindow(hwnd_);
        const auto scale = [dpi](int value) { return MulDiv(value, static_cast<int>(dpi ? dpi : 96), 96); };
        for (auto& region : fbroRegions_) {
            if (!region.host || !IsWindow(region.host)) continue;
            const int w = (std::max)(1, scale(region.width));
            const int h = (std::max)(1, scale(region.height));
            SetWindowPos(region.host, nullptr, scale(region.x), scale(region.y), w, h, SWP_NOZORDER | SWP_NOACTIVATE);
            if (region.started && LingFbroProcessController::Instance().State(region.processInstanceId) == L"就绪") {
                LingFbroProcessController::Instance().Notify(region.processInstanceId, L"resize",
                    LingFbroProcessController::Json{{"width", w}, {"height", h}});
            }
        }
#endif
    }

    std::wstring FBro_取区域实例JSON() {
        LingFbroProcessController::Json items = LingFbroProcessController::Json::array();
        for (const auto& region : fbroRegions_) {
            LingFbroProcessController::Json item = LingFbroProcessController::Json::object();
            item["实例编号"] = region.id;
            item["地址"] = lingbuilder_fbro_process_detail::JsonUtf8(region.url);
            item["左"] = region.x;
            item["顶"] = region.y;
            item["宽"] = region.width;
            item["高"] = region.height;
            item["状态"] = lingbuilder_fbro_process_detail::JsonUtf8(LingFbroProcessController::Instance().State(region.processInstanceId));
            item["是否有效"] = region.host && IsWindow(region.host);
            items.push_back(item);
        }
        return lingbuilder_fbro_process_detail::JsonText(items);
    }

    int FBro_关闭全部区域() {
#if LINGBUILDER_FBRO_AVAILABLE
        const int count = static_cast<int>(fbroRegions_.size());
        for (auto& region : fbroRegions_) {
            if (region.started) LingFbroProcessController::Instance().Close(region.processInstanceId);
            if (region.host && IsWindow(region.host)) DestroyWindow(region.host);
        }
        fbroRegions_.clear();
        return count;
#else
        return 0;
#endif
    }

    bool 浏览器管理器_切换索引(int index) {
        if (index < 0 || index >= static_cast<int>(browserManager_.instances.size())) return false;
        浏览器管理器_显示索引(index, true);
        return 浏览器管理器_保存配置();
    }

    bool 浏览器管理器_重命名当前(const std::wstring& requestedName) {
        auto* instance = 浏览器管理器_当前();
        const std::wstring name = 浏览器管理器_裁剪文本(requestedName);
        if (!instance || name.empty() || name.size() > 80) return false;
        instance->name = name;
        const int index = 浏览器管理器_查找索引(instance->id);
        RuntimeControl* tab = 浏览器管理器_标签控件();
        if (tab && tab->hwnd && index >= 0) {
            TCITEMW item{}; item.mask = TCIF_TEXT; item.pszText = const_cast<wchar_t*>(instance->name.c_str());
            TabCtrl_SetItem(tab->hwnd, index, &item);
        }
        浏览器管理器_同步列表();
        return 浏览器管理器_保存配置();
    }

    bool 浏览器管理器_导航(const std::wstring& address) {
        auto* instance = 浏览器管理器_当前();
        const std::wstring url = 浏览器管理器_裁剪文本(address);
        if (!instance || !浏览器管理器_地址可导航(url)) return false;
        const bool extensionDiagnostics = 浏览器管理器_是插件检查地址(url);
        instance->url = extensionDiagnostics ? L"chrome://extensions/" : url;
        instance->extensionDiagnosticsVisible = extensionDiagnostics;
        instance->pluginProbeAttemptsRemaining = 0;
        instance->loading = true;
        const std::wstring navigationUrl = extensionDiagnostics
            ? 浏览器管理器_插件检查页地址(*instance) : url;
        const bool result = 浏览器管理器_逻辑(*instance, L"navigate", {{"url", lingbuilder_fbro_process_detail::JsonUtf8(navigationUrl)}});
        if (result) {
            浏览器管理器_同步地址栏();
            浏览器管理器_保存配置();
        } else {
            instance->extensionDiagnosticsVisible = false;
        }
        return result;
    }

    bool 浏览器管理器_后退() { auto* value = 浏览器管理器_当前(); return value && 浏览器管理器_逻辑(*value, L"back"); }
    bool 浏览器管理器_前进() { auto* value = 浏览器管理器_当前(); return value && 浏览器管理器_逻辑(*value, L"forward"); }
    bool 浏览器管理器_刷新() { auto* value = 浏览器管理器_当前(); return value && 浏览器管理器_逻辑(*value, L"reload"); }
    bool 浏览器管理器_停止() { auto* value = 浏览器管理器_当前(); return value && 浏览器管理器_逻辑(*value, L"stop"); }
    bool 浏览器管理器_强制刷新() { auto* value = 浏览器管理器_当前(); return value && 浏览器管理器_逻辑(*value, L"reloadIgnoreCache"); }

    std::wstring 浏览器管理器_取当前稳定ID() const { return browserManager_.selectedId; }
    std::wstring 浏览器管理器_取当前名称() const { const auto* value = 浏览器管理器_当前(); return value ? value->name : L""; }
    std::wstring 浏览器管理器_取当前地址() const { const auto* value = 浏览器管理器_当前(); return value ? value->url : L""; }
    std::wstring 浏览器管理器_取当前插件状态() const { const auto* value = 浏览器管理器_当前(); return value ? value->pluginStatus : L"没有当前实例"; }
    std::wstring 浏览器管理器_取当前插件错误() const { const auto* value = 浏览器管理器_当前(); return value ? value->pluginError : L""; }
    std::wstring 浏览器管理器_取当前下载状态() const { const auto* value = 浏览器管理器_当前(); return value ? value->downloadStatus : L"暂无下载"; }
    std::wstring 浏览器管理器_取当前下载文件() const { const auto* value = 浏览器管理器_当前(); return value ? value->downloadFile : L""; }
    std::wstring 浏览器管理器_取当前下载完整路径() const { const auto* value = 浏览器管理器_当前(); return value ? value->downloadFullPath : L""; }
    std::wstring 浏览器管理器_取当前下载目录() const { const auto* value = 浏览器管理器_当前(); return value ? value->downloadDirectory : L""; }
    std::wstring 浏览器管理器_取当前错误() const {
        const auto* value = 浏览器管理器_当前();
        if (!value) return L"没有当前实例。";
        const std::wstring controller = LingFbroProcessController::Instance().LastError(value->processInstanceId);
        return controller.empty() ? value->lastError : controller;
    }
    std::wstring 浏览器管理器_取持久化诊断() const { return browserManager_.persistenceDiagnostic; }
    std::wstring 浏览器管理器_取当前缓存目录() const { const auto* value = 浏览器管理器_当前(); return value ? value->profileDirectory : L""; }
    std::wstring 浏览器管理器_取当前进程状态() const {
        const auto* value = 浏览器管理器_当前();
        return value && value->open ? LingFbroProcessController::Instance().State(value->processInstanceId) : L"已关闭";
    }
    int 浏览器管理器_取当前进程ID() const {
        const auto* value = 浏览器管理器_当前();
        return value && value->open ? static_cast<int>(LingFbroProcessController::Instance().ProcessId(value->processInstanceId)) : 0;
    }
    long long 浏览器管理器_取当前页面句柄() const {
        const auto* value = 浏览器管理器_当前();
        return value && value->pageHwnd && IsWindow(value->pageHwnd)
            ? static_cast<long long>(reinterpret_cast<intptr_t>(value->pageHwnd)) : 0;
    }
    int 浏览器管理器_取实例数量() const { return static_cast<int>(browserManager_.instances.size()); }
    std::wstring 浏览器管理器_取实例顺序JSON() const {
        LingFbroProcessController::Json result = LingFbroProcessController::Json::array();
        for (const auto& instance : browserManager_.instances) result.push_back(lingbuilder_fbro_process_detail::JsonUtf8(instance.id));
        return lingbuilder_fbro_process_detail::JsonText(result);
    }
    std::wstring 浏览器管理器_取运行快照JSON() const {
        LingFbroProcessController::Json result = LingFbroProcessController::Json::array();
        for (const auto& instance : browserManager_.instances) result.push_back({
            {"id", lingbuilder_fbro_process_detail::JsonUtf8(instance.id)},
            {"profileDirectory", lingbuilder_fbro_process_detail::JsonUtf8(instance.profileDirectory)},
            {"pageHwnd", std::to_string(reinterpret_cast<uintptr_t>(instance.pageHwnd))},
            {"processId", instance.open ? LingFbroProcessController::Instance().ProcessId(instance.processInstanceId) : 0},
            {"pluginStatus", lingbuilder_fbro_process_detail::JsonUtf8(instance.pluginStatus)},
            {"downloadStatus", lingbuilder_fbro_process_detail::JsonUtf8(instance.downloadStatus)},
            {"downloadFile", lingbuilder_fbro_process_detail::JsonUtf8(instance.downloadFile)},
            {"downloadDirectory", lingbuilder_fbro_process_detail::JsonUtf8(instance.downloadDirectory)}
        });
        return lingbuilder_fbro_process_detail::JsonText(result);
    }

    bool 浏览器管理器_属于受管Profile(const std::filesystem::path& candidate) const {
        if (candidate.empty() || browserManager_.persistenceRoot.empty()) return false;
        std::error_code error;
        const std::filesystem::path root = std::filesystem::weakly_canonical(browserManager_.persistenceRoot / L"profiles", error);
        if (error) return false;
        const std::filesystem::path resolved = std::filesystem::weakly_canonical(candidate, error);
        if (error || resolved == root) return false;
        const std::wstring rootPrefix = root.wstring() + std::wstring(1, std::filesystem::path::preferred_separator);
        const std::wstring target = resolved.wstring();
        if (target.size() <= rootPrefix.size() || _wcsnicmp(target.c_str(), rootPrefix.c_str(), rootPrefix.size()) != 0) return false;
        std::filesystem::path cursor = root;
        const auto relative = resolved.lexically_relative(root);
        for (const auto& component : relative) {
            if (component == L"." || component == L"..") return false;
            cursor /= component;
            const DWORD attributes = GetFileAttributesW(cursor.c_str());
            if (attributes != INVALID_FILE_ATTRIBUTES && (attributes & FILE_ATTRIBUTE_REPARSE_POINT)) return false;
        }
        return true;
    }

    bool 浏览器管理器_打开当前缓存目录() {
        const auto* instance = 浏览器管理器_当前();
        if (!instance || !浏览器管理器_属于受管Profile(instance->profileDirectory)) return false;
        std::error_code error;
        std::filesystem::create_directories(instance->profileDirectory, error);
        return !error && reinterpret_cast<intptr_t>(ShellExecuteW(hwnd_, L"open", instance->profileDirectory.c_str(),
            nullptr, nullptr, SW_SHOWNORMAL)) > 32;
    }

    bool 浏览器管理器_打开当前下载目录() {
        const auto* instance = 浏览器管理器_当前();
        if (!instance || instance->downloadDirectory.empty()) return false;
        const std::filesystem::path directory(instance->downloadDirectory);
        std::error_code error;
        if (!std::filesystem::exists(directory, error) || error
            || !std::filesystem::is_directory(directory, error) || error) return false;
        return reinterpret_cast<intptr_t>(ShellExecuteW(hwnd_, L"open", directory.c_str(),
            nullptr, nullptr, SW_SHOWNORMAL)) > 32;
    }

    bool 浏览器管理器_清理当前缓存(bool includeCookies) {
        auto* instance = 浏览器管理器_当前();
        if (!instance || !instance->open) return false;
        const wchar_t* message = includeCookies
            ? L"将清理当前实例的缓存、Cookie、站点存储和插件私有数据。其他实例不受影响。是否继续？"
            : L"将清理当前实例的网页缓存和站点存储，但保留 Cookie。是否继续？";
        if (MessageBoxW(hwnd_, message, L"确认清理浏览器数据", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2) != IDYES) return false;
        return 浏览器管理器_逻辑(*instance, L"clearCache", {{"includeCookies", includeCookies}});
    }

    std::filesystem::path 浏览器管理器_Cookie文件(const std::wstring& fileName) const {
        std::filesystem::path requested(fileName.empty() ? L"cookies.lingbuilder.json" : fileName);
        if (requested.is_absolute()) return requested.lexically_normal();
        return (browserManager_.persistenceRoot / L"cookie-files" / requested.filename()).lexically_normal();
    }

    static bool 浏览器管理器_Cookie有效(const LingFbroProcessController::Json& cookie) {
        return cookie.is_object() && cookie.contains("name") && cookie["name"].is_string() && !cookie["name"].get<std::string>().empty()
            && cookie.contains("value") && cookie["value"].is_string()
            && cookie.contains("domain") && cookie["domain"].is_string() && !cookie["domain"].get<std::string>().empty()
            && cookie.contains("path") && cookie["path"].is_string()
            && cookie.contains("httpOnly") && cookie["httpOnly"].is_boolean()
            && cookie.contains("secure") && cookie["secure"].is_boolean()
            && cookie.contains("sameSite") && cookie["sameSite"].is_number_integer()
            && cookie.contains("session") && cookie["session"].is_boolean();
    }

    static std::wstring 浏览器管理器_Cookie键(const LingFbroProcessController::Json& cookie) {
        return lingbuilder_fbro_process_detail::JsonWide(cookie, "domain") + L"\n"
            + lingbuilder_fbro_process_detail::JsonWide(cookie, "path", L"/") + L"\n"
            + lingbuilder_fbro_process_detail::JsonWide(cookie, "name");
    }

    static bool 浏览器管理器_Cookie过期(const LingFbroProcessController::Json& cookie) {
        if (cookie.value("session", false) || !cookie.value("hasExpires", false)
            || !cookie.contains("expires") || !cookie["expires"].is_object()) return false;
        const auto& expires = cookie["expires"];
        SYSTEMTIME expiry{};
        expiry.wYear = static_cast<WORD>(expires.value("year", 0)); expiry.wMonth = static_cast<WORD>(expires.value("month", 0));
        expiry.wDay = static_cast<WORD>(expires.value("day", 0)); expiry.wHour = static_cast<WORD>(expires.value("hour", 0));
        expiry.wMinute = static_cast<WORD>(expires.value("minute", 0)); expiry.wSecond = static_cast<WORD>(expires.value("second", 0));
        expiry.wMilliseconds = static_cast<WORD>(expires.value("millisecond", 0));
        SYSTEMTIME now{}; GetSystemTime(&now);
        FILETIME expiryFile{}, nowFile{};
        if (!SystemTimeToFileTime(&expiry, &expiryFile) || !SystemTimeToFileTime(&now, &nowFile)) return true;
        ULARGE_INTEGER left{}, right{};
        left.LowPart = expiryFile.dwLowDateTime; left.HighPart = expiryFile.dwHighDateTime;
        right.LowPart = nowFile.dwLowDateTime; right.HighPart = nowFile.dwHighDateTime;
        return left.QuadPart <= right.QuadPart;
    }

    static std::wstring 浏览器管理器_Cookie网址(const LingFbroProcessController::Json& cookie) {
        std::wstring domain = lingbuilder_fbro_process_detail::JsonWide(cookie, "domain");
        while (!domain.empty() && domain.front() == L'.') domain.erase(domain.begin());
        if (domain.empty()) return L"";
        return (cookie.value("secure", false) ? L"https://" : L"http://") + domain
            + lingbuilder_fbro_process_detail::JsonWide(cookie, "path", L"/");
    }

    std::wstring 浏览器管理器_导出Cookie(const std::wstring& fileName, bool allSites) {
        auto* instance = 浏览器管理器_当前();
        if (!instance || !instance->open) return L"Cookie 导出失败：当前实例未运行。";
        LingFbroProcessController::Json result;
        if (!浏览器管理器_请求(*instance, L"visitCookies", {
                {"allSites", allSites}, {"url", lingbuilder_fbro_process_detail::JsonUtf8(instance->url)}
            }, result) || !result.contains("cookies") || !result["cookies"].is_array()) {
            return L"Cookie 导出失败：" + instance->lastError;
        }
        const auto output = 浏览器管理器_Cookie文件(fileName);
        const std::wstring preview = L"当前浏览器实例：" + instance->name
            + L"\n导出范围：" + (allSites ? L"全部网站" : L"当前网站")
            + L"\nCookie 数量：" + std::to_wstring(result["cookies"].size())
            + L"\n保存位置：" + output.wstring()
            + L"\n\nCookie 含登录凭据等敏感信息，请妥善保管。是否继续？";
        if (MessageBoxW(hwnd_, preview.c_str(), L"导出 Cookie", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2) != IDYES) {
            return L"已取消 Cookie 导出。";
        }
        LingFbroProcessController::Json document = {
            {"format", "lingbuilder.browser.cookies"}, {"version", 1},
            {"exportedAt", lingbuilder_fbro_process_detail::JsonUtf8(浏览器管理器_时间戳())},
            {"scope", {{"type", allSites ? "all" : "currentSite"},
                       {"url", allSites ? "" : lingbuilder_fbro_process_detail::JsonUtf8(instance->url)}}},
            {"cookies", result["cookies"]}
        };
        std::error_code error;
        std::filesystem::create_directories(output.parent_path(), error);
        if (error) return L"Cookie 导出失败：无法创建目标目录。";
        const auto temporary = std::filesystem::path(output.wstring() + L".tmp-" + std::to_wstring(GetCurrentProcessId()));
        {
            std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
            const std::string utf8 = document.dump(2) + "\n";
            stream.write(utf8.data(), static_cast<std::streamsize>(utf8.size()));
            stream.flush();
            if (!stream.good()) { stream.close(); DeleteFileW(temporary.c_str()); return L"Cookie 导出失败：写入临时文件失败。"; }
        }
        if (!MoveFileExW(temporary.c_str(), output.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            DeleteFileW(temporary.c_str());
            return L"Cookie 导出失败：原子替换目标文件失败。";
        }
        return L"Cookie 已导出 " + std::to_wstring(result["cookies"].size()) + L" 条到：" + output.wstring();
    }

    std::wstring 浏览器管理器_导入Cookie(const std::wstring& fileName, bool overwriteConflicts) {
        auto* instance = 浏览器管理器_当前();
        if (!instance || !instance->open) return L"Cookie 导入失败：当前实例未运行。";
        const auto input = 浏览器管理器_Cookie文件(fileName);
        std::error_code error;
        if (!std::filesystem::is_regular_file(input, error) || error
            || std::filesystem::file_size(input, error) > 64ULL * 1024ULL * 1024ULL) {
            return L"Cookie 导入失败：文件不存在、不可读或超过 64 MiB。";
        }
        std::ifstream stream(input, std::ios::binary);
        auto document = LingFbroProcessController::Json::parse(stream, nullptr, false);
        if (!document.is_object() || document.value("format", "") != "lingbuilder.browser.cookies"
            || document.value("version", 0) != 1 || !document.contains("cookies") || !document["cookies"].is_array()) {
            return L"Cookie 导入失败：不是兼容的 LingBuilder Cookie JSON。";
        }
        LingFbroProcessController::Json existingResult;
        浏览器管理器_请求(*instance, L"visitCookies", {{"allSites", true}, {"url", ""}}, existingResult);
        std::set<std::wstring> existingKeys;
        if (existingResult.contains("cookies") && existingResult["cookies"].is_array()) {
            for (const auto& cookie : existingResult["cookies"]) existingKeys.insert(浏览器管理器_Cookie键(cookie));
        }
        int valid = 0, invalid = 0, expired = 0, conflicts = 0;
        std::set<std::wstring> domains;
        for (const auto& cookie : document["cookies"]) {
            if (!浏览器管理器_Cookie有效(cookie)) { ++invalid; continue; }
            ++valid;
            if (浏览器管理器_Cookie过期(cookie)) ++expired;
            if (existingKeys.count(浏览器管理器_Cookie键(cookie))) ++conflicts;
            domains.insert(lingbuilder_fbro_process_detail::JsonWide(cookie, "domain"));
        }
        const std::wstring preview = L"当前浏览器实例：" + instance->name
            + L"\n有效记录：" + std::to_wstring(valid)
            + L"\n无效记录：" + std::to_wstring(invalid)
            + L"\n过期记录：" + std::to_wstring(expired)
            + L"\n涉及域名：" + std::to_wstring(domains.size())
            + L"\n冲突记录：" + std::to_wstring(conflicts)
            + L"\n\n无效和过期记录将跳过。是否导入？";
        if (MessageBoxW(hwnd_, preview.c_str(), L"Cookie 导入预览", MB_YESNO | MB_ICONINFORMATION | MB_DEFBUTTON2) != IDYES) {
            return L"已取消 Cookie 导入。";
        }
        int imported = 0, skipped = 0, failed = 0;
        for (const auto& cookie : document["cookies"]) {
            if (!浏览器管理器_Cookie有效(cookie) || 浏览器管理器_Cookie过期(cookie)) { ++skipped; continue; }
            const bool conflict = existingKeys.count(浏览器管理器_Cookie键(cookie)) > 0;
            if (conflict && !overwriteConflicts) { ++skipped; continue; }
            const std::wstring url = 浏览器管理器_Cookie网址(cookie);
            if (url.empty() || !浏览器管理器_逻辑(*instance, L"setCookieJson", {
                    {"url", lingbuilder_fbro_process_detail::JsonUtf8(url)}, {"cookie", cookie}
                })) ++failed;
            else ++imported;
        }
        if (imported > 0) 浏览器管理器_逻辑(*instance, L"reload");
        return L"Cookie 导入完成：成功 " + std::to_wstring(imported) + L"，跳过 "
            + std::to_wstring(skipped) + L"，失败 " + std::to_wstring(failed) + L"。";
    }

    std::wstring 浏览器管理器_删除当前(bool clearData) {
        const int index = 浏览器管理器_查找索引(browserManager_.selectedId);
        if (index < 0) return L"删除失败：当前实例不存在。";
        if (browserManager_.instances.size() <= 1) return L"删除失败：至少必须保留一个可用浏览器实例。";
        BrowserManagerInstance removed = browserManager_.instances[static_cast<size_t>(index)];
        const wchar_t* first = clearData
            ? L"将删除当前浏览器实例并清除缓存、Cookie 和插件存储。是否继续？"
            : L"将删除当前浏览器实例记录并保留磁盘缓存。是否继续？";
        if (MessageBoxW(hwnd_, first, L"删除浏览器实例", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2) != IDYES) return L"已取消删除。";
        if (clearData && MessageBoxW(hwnd_, L"再次确认：此操作不可恢复，只会清除当前实例的受管 Profile。",
            L"二次确认清除数据", MB_YESNO | MB_ICONERROR | MB_DEFBUTTON2) != IDYES) return L"已取消清除数据。";
        if (clearData && (!浏览器管理器_属于受管Profile(removed.profileDirectory)
            || std::filesystem::path(removed.profileDirectory).lexically_normal() != 浏览器管理器_Profile路径(removed.id))) {
            return L"删除失败：目标目录未通过受管 Profile 边界校验。";
        }
        if (removed.open) LingFbroProcessController::Instance().Close(removed.processInstanceId);
        浏览器管理器_删除页面(index);
        browserManager_.instances.erase(browserManager_.instances.begin() + index);
        const int next = (std::min)(index, static_cast<int>(browserManager_.instances.size()) - 1);
        browserManager_.selectedId = browserManager_.instances[static_cast<size_t>(next)].id;
        浏览器管理器_显示索引(next, true);
        浏览器管理器_保存配置();
        if (!clearData) return L"实例记录已删除，缓存已保留。";
        std::error_code removeError;
        const uintmax_t count = std::filesystem::remove_all(removed.profileDirectory, removeError);
        if (removeError) return L"实例记录已删除，但缓存清理失败："
            + lingbuilder_fbro_process_detail::Utf8ToWide(removeError.message());
        return L"实例及其独立缓存、Cookie 和插件存储已清除，共删除 " + std::to_wstring(count) + L" 个文件系统项。";
    }

    void 浏览器管理器_排队检查插件页面(BrowserManagerInstance& instance) {
        if (!instance.open || !instance.pluginRegistered || instance.loading
            || !浏览器管理器_插件适用地址(instance.url)) return;
        instance.pluginPageActive = false;
        instance.pluginPageStatus = L"正在检查当前豆包页面的插件入口";
        instance.pluginStatus = L"插件已加载，正在验证页面";
        instance.pluginError.clear();
        instance.pluginProbeAttemptsRemaining = 12;
        SetTimer(hwnd_, 0x4C47, 500, nullptr);
    }

    bool 浏览器管理器_处理插件检查定时器(UINT_PTR timerId) {
        if (timerId != 0x4C47) return false;
        KillTimer(hwnd_, 0x4C47);
        bool hasPending = false;
        bool changed = false;
        for (auto& instance : browserManager_.instances) {
            if (instance.pluginProbeAttemptsRemaining <= 0) continue;
            if (!instance.open || instance.loading || !instance.pluginRegistered
                || !浏览器管理器_插件适用地址(instance.url)) {
                instance.pluginProbeAttemptsRemaining = 0;
                continue;
            }
            LingFbroProcessController::Json result;
            const bool requested = 浏览器管理器_请求(instance, L"executeJavaScript", {
                {"script", "document.getElementById('doubao-downloader') ? 'root' : (document.documentElement && document.documentElement.getAttribute('data-lingbuilder-doubao-downloader') === 'loaded' ? 'marker' : 'none')"}
            }, result);
            const std::wstring probeValue = requested
                ? lingbuilder_fbro_process_detail::JsonWide(result, "value") : L"request-failed";
            const bool active = probeValue == L"root";
            if (active) {
                instance.pluginPageActive = true;
                instance.pluginPageStatus = L"当前豆包页面已检测到 #doubao-downloader，插件已生效";
                instance.pluginStatus = L"插件已生效";
                instance.pluginError.clear();
                instance.pluginProbeAttemptsRemaining = 0;
                changed = true;
                continue;
            }
            --instance.pluginProbeAttemptsRemaining;
            if (instance.pluginProbeAttemptsRemaining <= 0) {
                instance.pluginPageActive = false;
                instance.pluginPageStatus = L"当前豆包页面未检测到 #doubao-downloader";
                instance.pluginStatus = L"插件未在当前页面生效";
                instance.pluginError = requested
                    ? (probeValue == L"marker"
                        ? L"扩展脚本已注入，但下载器入口初始化失败。当前地址：" + instance.url
                        : L"FBro 已登记扩展目录，但当前地址 " + instance.url
                            + L" 在 6 秒内没有出现下载器入口。")
                    : L"页面插件探针执行失败：" + instance.lastError;
                changed = true;
            } else {
                hasPending = true;
            }
        }
        if (hasPending) SetTimer(hwnd_, 0x4C47, 500, nullptr);
        if (changed || hasPending) 浏览器管理器_同步列表();
        return true;
    }

    bool 浏览器管理器_处理进程事件(LingFbroProcessEventPacket& packet) {
        for (auto& instance : browserManager_.instances) {
            if (instance.processInstanceId != packet.instanceId) continue;
            const auto data = lingbuilder_fbro_process_detail::ParseJson(packet.dataJson);
            const std::wstring value = data.is_object() ? lingbuilder_fbro_process_detail::JsonWide(data, "value") : L"";
            if (packet.eventName == L"AddressChanged" && !value.empty()) {
                const bool diagnosticDataAddress = instance.extensionDiagnosticsVisible
                    && value.rfind(L"data:text/html;charset=utf-8,", 0) == 0;
                if (!diagnosticDataAddress) {
                    instance.extensionDiagnosticsVisible = false;
                    instance.url = value;
                    instance.pluginProbeAttemptsRemaining = 0;
                    if (instance.pluginRegistered && !浏览器管理器_插件适用地址(instance.url)) {
                        instance.pluginPageActive = false;
                        instance.pluginStatus = L"插件已加载（当前页面不适用）";
                    }
                }
            }
            if (packet.eventName == L"Created") { instance.open = true; instance.loading = true; }
            if (packet.eventName == L"LoadEnd") {
                instance.loading = false;
                if (instance.pluginRegistered && 浏览器管理器_插件适用地址(instance.url)) {
                    浏览器管理器_排队检查插件页面(instance);
                } else if (instance.pluginRegistered) {
                    instance.pluginStatus = L"插件已加载（当前页面不适用）";
                }
            }
            if (packet.eventName == L"Closed") { instance.open = false; instance.loading = false; }
            if (packet.eventName == L"Error") instance.lastError = value;
            if (packet.eventName == L"ExtensionState") {
                const std::wstring reportedStatus = lingbuilder_fbro_process_detail::JsonWide(data, "statusText", L"插件加载失败");
                instance.pluginRegistered = reportedStatus == L"插件已加载";
                instance.pluginStatus = instance.pluginRegistered
                    ? (浏览器管理器_插件适用地址(instance.url)
                        ? L"插件已加载，等待页面验证" : L"插件已加载（当前页面不适用）")
                    : reportedStatus;
                instance.pluginError = lingbuilder_fbro_process_detail::JsonWide(data, "error");
                if (instance.pluginRegistered && !instance.pluginReloadedAfterRegistration
                    && 浏览器管理器_插件适用地址(instance.url)) {
                    // The first navigation can precede RequestContext extension registration.
                    instance.pluginReloadedAfterRegistration = true;
                    if (浏览器管理器_逻辑(instance, L"reload")) {
                        instance.loading = true;
                        instance.pluginPageStatus = L"扩展已注册，正在刷新当前豆包页面";
                        instance.pluginStatus = L"插件已加载，正在验证页面";
                    } else {
                        instance.pluginError = L"扩展已注册，但刷新当前豆包页面失败：" + instance.lastError;
                    }
                }
                if (instance.pluginRegistered && !instance.loading
                    && 浏览器管理器_插件适用地址(instance.url)) {
                    浏览器管理器_排队检查插件页面(instance);
                }
            }
            if (packet.eventName == L"OnBeforeDownload") {
                instance.lastDownloadId = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "downloadId", L"0").c_str(), nullptr, 10);
                instance.downloadStatus = L"准备下载";
                instance.downloadFile = lingbuilder_fbro_process_detail::JsonWide(data, "suggestedName");
                instance.downloadFullPath.clear();
                instance.downloadDirectory.clear();
                instance.downloadPercent = -1;
                instance.downloadReceivedBytes = 0;
                instance.downloadTotalBytes = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "totalBytes", L"0").c_str(), nullptr, 10);
                instance.downloadCurrentSpeed = 0;
            }
            if (packet.eventName == L"OnDownloadUpdated") {
                instance.lastDownloadId = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "downloadId", L"0").c_str(), nullptr, 10);
                instance.downloadPercent = _wtoi(
                    lingbuilder_fbro_process_detail::JsonWide(data, "percent", L"-1").c_str());
                instance.downloadReceivedBytes = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "receivedBytes", L"0").c_str(), nullptr, 10);
                instance.downloadTotalBytes = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "totalBytes", L"0").c_str(), nullptr, 10);
                instance.downloadCurrentSpeed = _wcstoi64(
                    lingbuilder_fbro_process_detail::JsonWide(data, "currentSpeed", L"0").c_str(), nullptr, 10);
                const std::wstring fullPath = lingbuilder_fbro_process_detail::JsonWide(data, "fullPath");
                const std::wstring suggestedName = lingbuilder_fbro_process_detail::JsonWide(data, "suggestedName");
                if (!fullPath.empty()) {
                    const std::filesystem::path path(fullPath);
                    instance.downloadFullPath = path.lexically_normal().wstring();
                    instance.downloadDirectory = path.parent_path().lexically_normal().wstring();
                    instance.downloadFile = path.filename().wstring();
                } else if (!suggestedName.empty()) {
                    instance.downloadFile = suggestedName;
                }
                const bool isCanceled = lingbuilder_fbro_process_detail::JsonWide(data, "isCanceled") == L"1";
                const bool isComplete = lingbuilder_fbro_process_detail::JsonWide(data, "isComplete") == L"1";
                const bool isInProgress = lingbuilder_fbro_process_detail::JsonWide(data, "isInProgress") == L"1";
                if (isCanceled) instance.downloadStatus = L"下载已取消";
                else if (isComplete) instance.downloadStatus = L"下载完成";
                else if (isInProgress && instance.downloadPercent >= 0)
                    instance.downloadStatus = L"下载中 " + std::to_wstring(instance.downloadPercent) + L"%";
                else if (isInProgress) instance.downloadStatus = L"下载中";
                else instance.downloadStatus = L"下载状态已更新";
            }
            浏览器管理器_同步列表();
            if (instance.id == browserManager_.selectedId) {
                浏览器管理器_同步地址栏();
                浏览器管理器_同步下载视图();
            }
            if (packet.eventName == L"AddressChanged" || packet.eventName == L"ExtensionState"
                || packet.eventName == L"Closed") 浏览器管理器_保存配置();
            return true;
        }
        return false;
    }

    void 浏览器管理器_调整页面() {
        FBro_调整区域实例();
        if (!browserManager_.initialized) return;
        RuntimeControl* tab = 浏览器管理器_标签控件();
        if (!tab || !tab->hwnd) return;
        RECT pageRect{};
        GetClientRect(tab->hwnd, &pageRect);
        if (!tab->hideTabHeader) TabCtrl_AdjustRect(tab->hwnd, FALSE, &pageRect);
        for (auto& page : tabPages_) if (page.tabControlId == browserManager_.tabControlId) page.contentRect = pageRect;
        for (auto& instance : browserManager_.instances) {
            if (!instance.pageHwnd || !IsWindow(instance.pageHwnd)) continue;
            SetWindowPos(instance.pageHwnd, nullptr, pageRect.left, pageRect.top,
                (std::max)(0L, pageRect.right - pageRect.left), (std::max)(0L, pageRect.bottom - pageRect.top),
                SWP_NOZORDER | SWP_NOACTIVATE);
            浏览器管理器_通知(instance, L"resize", {
                {"width", (std::max)(1L, pageRect.right - pageRect.left)},
                {"height", (std::max)(1L, pageRect.bottom - pageRect.top)}
            });
        }
    }

    void 浏览器管理器_控件重建前() {
        if (!browserManager_.initialized) return;
        KillTimer(hwnd_, 0x4C47);
        for (auto& instance : browserManager_.instances) {
            if (instance.open) LingFbroProcessController::Instance().Close(instance.processInstanceId);
            instance.open = false;
            instance.pageHwnd = nullptr;
        }
    }

    void 浏览器管理器_控件重建后() {
        if (!browserManager_.initialized) return;
        RuntimeControl* tab = 浏览器管理器_标签控件();
        if (!tab || !tab->hwnd) return;
        tab->hideTabHeader = true;
        浏览器管理器_清空页面();
        for (int index = 0; index < static_cast<int>(browserManager_.instances.size()); ++index) {
            auto& instance = browserManager_.instances[static_cast<size_t>(index)];
            if (浏览器管理器_创建页面(instance, index)) 浏览器管理器_启动(instance);
        }
        const int selected = (std::max)(0, 浏览器管理器_查找索引(browserManager_.selectedId));
        if (!browserManager_.instances.empty()) 浏览器管理器_显示索引(selected, true);
    }

    void 浏览器管理器_关闭全部() {
        if (!browserManager_.initialized) return;
        KillTimer(hwnd_, 0x4C47);
        浏览器管理器_保存配置();
        for (auto& instance : browserManager_.instances) {
            if (instance.open) LingFbroProcessController::Instance().Close(instance.processInstanceId);
            instance.open = false;
        }
    }

    bool 浏览器管理器_是否全部关闭() const {
        for (const auto& instance : browserManager_.instances) {
            const std::wstring state = LingFbroProcessController::Instance().State(instance.processInstanceId);
            if (state != L"已关闭" && state != L"未启动" && state != L"故障") return false;
        }
        return true;
    }
`
  };
}
