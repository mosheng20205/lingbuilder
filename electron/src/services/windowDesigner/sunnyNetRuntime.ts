import { InstalledModule } from '../modules/types';

export const SUNNYNET_MODULE_ID = 'lingbuilder.sunnynet';

export function generateSunnyNetRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === SUNNYNET_MODULE_ID)) return '';
  return SUNNYNET_RUNTIME;
}

export function generateSunnyNetWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === SUNNYNET_MODULE_ID)) return '';
  return SUNNYNET_WINDOW_METHODS;
}

export function generateSunnyNetGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === SUNNYNET_MODULE_ID)) return '';
  return SUNNYNET_WINDOW_METHODS
    .replaceAll('sunnyNetRuntime_', 'g_sunnyNetRuntime')
    .replaceAll('sunnyNetReturnText_', 'g_sunnyNetReturnText')
    .replaceAll('sunnyNetBytesReturn_', 'g_sunnyNetBytesReturn')
    .replace(/^    /gmu, 'static ');
}

const SUNNYNET_RUNTIME = String.raw`
// ===== SunnyNet 网络中间件运行时（LingBuilder 生成；底层库 MIT，见模块文档） =====
#include <wincrypt.h>
#pragma comment(lib, "crypt32.lib")

#ifdef _WIN64
typedef long long LB_SunnyIntPtr;
#else
typedef int LB_SunnyIntPtr;
#endif

class LingSunnyNetRuntime {
public:
    using NotifyEvent = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingSunnyNetRuntime(NotifyEvent notify) : notify_(std::move(notify)) {}
    ~LingSunnyNetRuntime() { Shutdown(); }

    LingSunnyNetRuntime(const LingSunnyNetRuntime&) = delete;
    LingSunnyNetRuntime& operator=(const LingSunnyNetRuntime&) = delete;

    void SetDispatcher(DispatchHandler dispatcher) { dispatcher_ = std::move(dispatcher); }

    bool EnsureLoaded() {
        std::lock_guard<std::mutex> lock(loadMutex_);
        if (dll_) return true;
#ifdef _WIN64
        HMODULE module = LoadLibraryW(L"SunnyNet64.dll");
#else
        HMODULE module = LoadLibraryW(L"SunnyNet.dll");
#endif
        if (!module) { lastError_ = L"找不到或无法加载网络中间件运行库 SunnyNet.dll（错误码 " + std::to_wstring(GetLastError()) + L"；请确认项目已安装 lingbuilder.sunnynet.sdk 且已重新构建）。"; return false; }
#define LB_SUNNY_BIND(field, name) field = reinterpret_cast<decltype(field)>(GetProcAddress(module, name)); if (!field) { lastError_ = L"网络中间件运行库缺少导出：" + LB_Utf8ToWide(name); return false; }
        LB_SUNNY_BIND(fnVersion_, "GetSunnyVersion")
        LB_SUNNY_BIND(fnFree_, "Free")
        LB_SUNNY_BIND(fnCreate_, "CreateSunnyNet")
        LB_SUNNY_BIND(fnRelease_, "ReleaseSunnyNet")
        LB_SUNNY_BIND(fnClose_, "SunnyNetClose")
        LB_SUNNY_BIND(fnStart_, "SunnyNetStart")
        LB_SUNNY_BIND(fnSetPort_, "SunnyNetSetPort")
        LB_SUNNY_BIND(fnSetCallback_, "SunnyNetSetCallback")
        LB_SUNNY_BIND(fnError_, "SunnyNetError")
        LB_SUNNY_BIND(fnCreateCert_, "CreateCertificate")
        LB_SUNNY_BIND(fnCreateCA_, "CreateCA")
        LB_SUNNY_BIND(fnRemoveCert_, "RemoveCertificate")
        LB_SUNNY_BIND(fnSetCert_, "SunnyNetSetCert")
        LB_SUNNY_BIND(fnInstallCert_, "SunnyNetInstallCert")
        LB_SUNNY_BIND(fnExportCert_, "ExportCert")
        LB_SUNNY_BIND(fnGetReqBody_, "GetRequestBody")
        LB_SUNNY_BIND(fnGetReqBodyLen_, "GetRequestBodyLen")
        LB_SUNNY_BIND(fnSetReqData_, "SetRequestData")
        LB_SUNNY_BIND(fnSetReqUrl_, "SetRequestUrl")
        LB_SUNNY_BIND(fnGetReqHeader_, "GetRequestHeader")
        LB_SUNNY_BIND(fnSetReqHeader_, "SetRequestHeader")
        LB_SUNNY_BIND(fnDelReqHeader_, "DelRequestHeader")
        LB_SUNNY_BIND(fnGetReqCookie_, "GetRequestCookie")
        LB_SUNNY_BIND(fnSetReqCookie_, "SetRequestCookie")
        LB_SUNNY_BIND(fnGetRespBody_, "GetResponseBody")
        LB_SUNNY_BIND(fnGetRespBodyLen_, "GetResponseBodyLen")
        LB_SUNNY_BIND(fnSetRespData_, "SetResponseData")
        LB_SUNNY_BIND(fnGetRespStatus_, "GetResponseStatus")
        LB_SUNNY_BIND(fnGetRespStatusCode_, "GetResponseStatusCode")
        LB_SUNNY_BIND(fnSetRespStatus_, "SetResponseStatus")
        LB_SUNNY_BIND(fnGetRespHeader_, "GetResponseHeader")
        LB_SUNNY_BIND(fnSetRespHeader_, "SetResponseHeader")
        LB_SUNNY_BIND(fnDelRespHeader_, "DelResponseHeader")
        LB_SUNNY_BIND(fnGetClientIp_, "GetRequestClientIp")
        LB_SUNNY_BIND(fnSocksAdd_, "SunnyNetSocket5AddUser")
        LB_SUNNY_BIND(fnSocksDel_, "SunnyNetSocket5DelUser")
        LB_SUNNY_BIND(fnSocksVerify_, "SunnyNetVerifyUser")
        LB_SUNNY_BIND(fnSetGlobalProxy_, "SetGlobalProxy")
        LB_SUNNY_BIND(fnSetReqProxy_, "SetRequestProxy")
        LB_SUNNY_BIND(fnSetIeProxy_, "SetIeProxy")
        LB_SUNNY_BIND(fnCancelIeProxy_, "CancelIEProxy")
        LB_SUNNY_BIND(fnTcpSend_, "TcpSendMsg")
        LB_SUNNY_BIND(fnTcpClose_, "TcpCloseClient")
        LB_SUNNY_BIND(fnWsSend_, "SendWebsocketBody")
        LB_SUNNY_BIND(fnWsClose_, "CloseWebsocket")
        LB_SUNNY_BIND(fnUdpToServer_, "UdpSendToServer")
        LB_SUNNY_BIND(fnUdpToClient_, "UdpSendToClient")
        LB_SUNNY_BIND(fnOpenDrive_, "OpenDrive")
        LB_SUNNY_BIND(fnUnDrive_, "UnDrive")
        LB_SUNNY_BIND(fnProcAddName_, "ProcessAddName")
        LB_SUNNY_BIND(fnProcDelName_, "ProcessDelName")
        LB_SUNNY_BIND(fnProcAddPid_, "ProcessAddPid")
        LB_SUNNY_BIND(fnProcCancelAll_, "ProcessCancelAll")
#undef LB_SUNNY_BIND
        dll_ = module;
        return true;
    }

    std::wstring Version() {
        if (!EnsureLoaded() || !fnVersion_) return L"";
        LB_SunnyIntPtr text = fnVersion_();
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }

    long long Create() {
        if (!EnsureLoaded()) return 0;
        LB_SunnyIntPtr context = fnCreate_();
        if (!context) { lastError_ = L"创建网络中间件实例失败。"; return 0; }
        std::lock_guard<std::mutex> lock(mutex_);
        auto item = std::make_shared<MiddlewareContext>();
        item->sunny = static_cast<long long>(context);
        middlewares_[item->sunny] = item;
        RegisterTrampolines(item);
        return item->sunny;
    }

    bool Destroy(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (fnCancelIeProxy_) fnCancelIeProxy_(static_cast<LB_SunnyIntPtr>(item->sunny));
        if (item->driverLoaded) {
            // 底层缺陷：驱动加载后调用 Close 会与内部协程双重关闭而崩溃（close of closed channel），
            // 因此跳过 Close，仅做文件清理与释放，语义见模块文档“销毁”。
            CleanupDriverFiles();
            if (fnRelease_) fnRelease_(static_cast<LB_SunnyIntPtr>(item->sunny));
        } else {
            if (fnClose_) fnClose_(static_cast<LB_SunnyIntPtr>(item->sunny));
            if (fnRelease_) fnRelease_(static_cast<LB_SunnyIntPtr>(item->sunny));
        }
        {
            std::lock_guard<std::mutex> lock(mutex_);
            middlewares_.erase(id);
        }
        return true;
    }

    bool SetPort(long long id, int port) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (port < 1 || port > 65535) { lastError_ = L"代理端口必须在 1 到 65535 之间。"; return false; }
        return BoolCall(item, fnSetPort_(static_cast<LB_SunnyIntPtr>(item->sunny), static_cast<LB_SunnyIntPtr>(port)));
    }

    bool Start(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        return BoolCall(item, fnStart_(static_cast<LB_SunnyIntPtr>(item->sunny)));
    }

    bool Stop(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (item->driverLoaded) { lastError_ = L"进程代理驱动已加载，请先执行 网络中间件_卸载进程代理文件 或 网络中间件_彻底清理驱动并重启计算机 后再停止。"; return false; }
        // 官方 Stop 语义：先还原 WinINET 系统代理再关闭，否则程序退出后系统代理残留导致断网。
        if (fnCancelIeProxy_) fnCancelIeProxy_(static_cast<LB_SunnyIntPtr>(item->sunny));
        return BoolCall(item, fnClose_(static_cast<LB_SunnyIntPtr>(item->sunny)));
    }

    std::wstring LastError(long long id) {
        // 底层 SunnyNetError 在无错误时返回未初始化内容（实测乱码），只回桥接维护的中文错误。
        (void)id;
        return lastError_;
    }

    // ===== 证书 =====
    long long CreateCertManager() {
        if (!EnsureLoaded()) return 0;
        LB_SunnyIntPtr cert = fnCreateCert_();
        if (!cert) { lastError_ = L"创建证书管理器失败。"; return 0; }
        const char* commonName = "LingBuilder.Sunny.Root";
        const char* org = "LingBuilder";
        const char* unit = "LingBuilder";
        const char* country = "CN";
        const char* province = "BeiJing";
        const char* city = "BeiJing";
        if (!fnCreateCA_(cert, reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(country)), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(org)), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(unit)), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(province)), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(commonName)), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(city)), static_cast<LB_SunnyIntPtr>(2048), static_cast<LB_SunnyIntPtr>(3650))) {
            fnRemoveCert_(cert);
            lastError_ = L"生成根证书失败。";
            return 0;
        }
        std::lock_guard<std::mutex> lock(mutex_);
        certManagers_[static_cast<long long>(cert)] = true;
        return static_cast<long long>(cert);
    }

    void DestroyCertManager(long long id) {
        if (!id) return;
        if (fnRemoveCert_) fnRemoveCert_(static_cast<LB_SunnyIntPtr>(id));
        std::lock_guard<std::mutex> lock(mutex_);
        certManagers_.erase(id);
    }

    bool BindCert(long long id, long long certId) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!certManagers_.count(certId)) { lastError_ = L"证书管理器句柄无效。"; return false; }
        }
        return BoolCall(item, fnSetCert_(static_cast<LB_SunnyIntPtr>(item->sunny), static_cast<LB_SunnyIntPtr>(certId)));
    }

    bool IsRootCertInstalled() {
        static const wchar_t* subject = L"LingBuilder.Sunny.Root";
        HCERTSTORE stores[2] = {nullptr, nullptr};
        stores[0] = CertOpenSystemStoreW(0, L"ROOT");
        stores[1] = CertOpenStore(CERT_STORE_PROV_SYSTEM, 0, 0, CERT_SYSTEM_STORE_LOCAL_MACHINE, L"ROOT");
        bool found = false;
        for (HCERTSTORE store : stores) {
            if (!store) continue;
            const CERT_CONTEXT* match = CertFindCertificateInStore(store, X509_ASN_ENCODING, 0, CERT_FIND_SUBJECT_STR, subject, nullptr);
            if (match) found = true;
            if (match) CertFreeCertificateContext(match);
            CertCloseStore(store, 0);
        }
        return found;
    }

    bool InstallRootCert(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (!EnsureLoaded()) return false;
        if (IsRootCertInstalled()) return true;
        int choice = MessageBoxW(nullptr, L"网络中间件即将向系统受信任的根证书库安装根证书（LingBuilder.Sunny.Root），用于 HTTPS 抓包解密。\n\n这是系统级操作，是否继续？", L"LingBuilder 网络中间件", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND);
        if (choice != IDYES) { lastError_ = L"用户取消了根证书安装。"; return false; }
        LB_SunnyIntPtr message = fnInstallCert_(static_cast<LB_SunnyIntPtr>(item->sunny));
        std::wstring raw = message ? LB_GbkToWide(reinterpret_cast<const char*>(static_cast<size_t>(message))) : L"";
        if (message && fnFree_) fnFree_(message);
        if (IsRootCertInstalled()) return true;
        lastError_ = L"根证书安装失败" + (raw.empty() ? L"。" : (L"：" + raw));
        return false;
    }

    bool UninstallRootCert() {
        static const wchar_t* subject = L"LingBuilder.Sunny.Root";
        bool anyRemoved = false;
        bool machineFailed = false;
        struct StoreSpec { const wchar_t* name; DWORD flags; };
        StoreSpec specs[2] = { { L"ROOT", 0 }, { L"ROOT", CERT_SYSTEM_STORE_LOCAL_MACHINE } };
        for (const StoreSpec& spec : specs) {
            HCERTSTORE store = CertOpenStore(CERT_STORE_PROV_SYSTEM, 0, 0, spec.flags, spec.name);
            if (!store) { if (spec.flags) machineFailed = true; continue; }
            const CERT_CONTEXT* match = CertFindCertificateInStore(store, X509_ASN_ENCODING, 0, CERT_FIND_SUBJECT_STR, subject, nullptr);
            while (match) {
                if (CertDeleteCertificateFromStore(match)) { anyRemoved = true; match = CertFindCertificateInStore(store, X509_ASN_ENCODING, 0, CERT_FIND_SUBJECT_STR, subject, nullptr); }
                else { if (spec.flags) machineFailed = true; CertFreeCertificateContext(match); match = nullptr; }
            }
            CertCloseStore(store, 0);
        }
        if (!anyRemoved && machineFailed) { lastError_ = L"移除本地计算机根证书需要管理员权限，请以管理员身份运行后再试。"; }
        return anyRemoved && !machineFailed;
    }

    bool ExportRootCert(long long id, const wchar_t* path) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (!path || !path[0]) { lastError_ = L"导出路径不能为空。"; return false; }
        LB_SunnyIntPtr pem = fnExportCert_(static_cast<LB_SunnyIntPtr>(item->sunny));
        if (!pem) { lastError_ = L"导出根证书失败。"; return false; }
        const char* text = reinterpret_cast<const char*>(static_cast<size_t>(pem));
        FILE* file = nullptr;
        bool ok = _wfopen_s(&file, path, L"wb") == 0 && file;
        if (file) {
            size_t length = strlen(text);
            fwrite(text, 1, length, file);
            fclose(file);
        }
        if (fnFree_) fnFree_(pem);
        if (!ok) lastError_ = L"写入证书文件失败。";
        return ok;
    }

    // ===== 事件绑定 =====
    bool BindHttpHandler(long long id, const wchar_t* handler) { return BindHandler(id, handler, 1); }
    bool BindTcpHandler(long long id, const wchar_t* handler) { return BindHandler(id, handler, 2); }
    bool BindWsHandler(long long id, const wchar_t* handler) { return BindHandler(id, handler, 3); }
    bool BindUdpHandler(long long id, const wchar_t* handler) { return BindHandler(id, handler, 4); }

    bool BindHandler(long long id, const wchar_t* handler, int family) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (!handler || !handler[0]) { lastError_ = L"处理器名不能为空。"; return false; }
        {
            std::lock_guard<std::mutex> lock(mutex_);
            switch (family) {
                case 1: item->httpHandler = handler; break;
                case 2: item->tcpHandler = handler; break;
                case 3: item->wsHandler = handler; break;
                case 4: item->udpHandler = handler; break;
            }
        }
        RegisterTrampolines(item);
        return true;
    }

    // ===== 当前事件上下文（仅事件处理器内有效，UI 线程） =====
    long long CurrentEventId() const { return currentMessageId_; }
    int CurrentEventType() const { return currentEventType_; }
    long long CurrentPid() const { return currentPid_; }
    long long CurrentConnectionId() const { return currentConnectionId_; }
    std::wstring CurrentMethod() const { return currentMethod_; }
    std::wstring CurrentUrl() const { return currentUrl_; }
    std::wstring CurrentClientIp() {
        if (!fnGetClientIp_ || !currentMessageId_) return L"";
        LB_SunnyIntPtr text = fnGetClientIp_(static_cast<LB_SunnyIntPtr>(currentMessageId_));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    std::wstring CurrentLocalAddress() const { return currentLocalAddress_; }
    std::wstring CurrentRemoteAddress() const { return currentRemoteAddress_; }
    std::vector<unsigned char> CurrentTcpData() const { return currentFamily_ == 2 ? currentData_ : std::vector<unsigned char>(); }
    std::vector<unsigned char> CurrentWsData() const { return currentFamily_ == 3 ? currentData_ : std::vector<unsigned char>(); }
    std::vector<unsigned char> CurrentUdpData() const { return currentFamily_ == 4 ? currentData_ : std::vector<unsigned char>(); }

    // ===== HTTP 请求读写（当前事件上下文） =====
    std::wstring GetRequestHeader(const wchar_t* name) {
        if (!fnGetReqHeader_ || !currentMessageId_) return L"";
        std::string utf8 = LB_WideToUtf8(name);
        LB_SunnyIntPtr text = fnGetReqHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(utf8.c_str())));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    bool SetRequestHeader(const wchar_t* name, const wchar_t* value) {
        if (!fnSetReqHeader_ || !currentMessageId_) return FailCurrent(L"设请求头只能在 HTTP 事件处理器内使用。");
        std::string n = LB_WideToUtf8(name); std::string v = LB_WideToUtf8(value);
        fnSetReqHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(n.c_str())), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(v.c_str())));
        return true;
    }
    bool DeleteRequestHeader(const wchar_t* name) {
        if (!fnDelReqHeader_ || !currentMessageId_) return FailCurrent(L"删请求头只能在 HTTP 事件处理器内使用。");
        std::string n = LB_WideToUtf8(name);
        fnDelReqHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(n.c_str())));
        return true;
    }
    std::wstring GetRequestBody() {
        if (!fnGetReqBody_ || !currentMessageId_) return L"";
        LB_SunnyIntPtr text = fnGetReqBody_(static_cast<LB_SunnyIntPtr>(currentMessageId_));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    long long GetRequestBodyLength() { return fnGetReqBodyLen_ && currentMessageId_ ? static_cast<long long>(fnGetReqBodyLen_(static_cast<LB_SunnyIntPtr>(currentMessageId_))) : 0; }
    bool SetRequestBody(const wchar_t* content) {
        if (!fnSetReqData_ || !currentMessageId_) return FailCurrent(L"设请求体只能在 HTTP 请求事件处理器内使用。");
        std::string data = LB_WideToUtf8(content);
        return fnSetReqData_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(data.c_str())), static_cast<LB_SunnyIntPtr>(data.size()));
    }
    bool SetRequestUrl(const wchar_t* url) {
        if (!fnSetReqUrl_ || !currentMessageId_) return FailCurrent(L"设请求URL只能在 HTTP 请求事件处理器内使用。");
        std::string data = LB_WideToUtf8(url);
        return fnSetReqUrl_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(data.c_str())));
    }
    std::wstring GetRequestCookie(const wchar_t* name) {
        if (!fnGetReqCookie_ || !currentMessageId_) return L"";
        std::string utf8 = LB_WideToUtf8(name);
        LB_SunnyIntPtr text = fnGetReqCookie_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(utf8.c_str())));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    bool SetRequestCookie(const wchar_t* name, const wchar_t* value) {
        if (!fnSetReqCookie_ || !currentMessageId_) return false;
        std::string n = LB_WideToUtf8(name); std::string v = LB_WideToUtf8(value);
        fnSetReqCookie_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(n.c_str())), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(v.c_str())));
        return true;
    }

    // ===== HTTP 响应读写（当前事件上下文） =====
    int GetResponseStatusCode() { return fnGetRespStatusCode_ && currentMessageId_ ? static_cast<int>(fnGetRespStatusCode_(static_cast<LB_SunnyIntPtr>(currentMessageId_))) : 0; }
    bool SetResponseStatusCode(int code) {
        if (!fnSetRespStatus_ || !currentMessageId_) return FailCurrent(L"设响应状态码只能在 HTTP 响应事件处理器内使用。");
        fnSetRespStatus_(static_cast<LB_SunnyIntPtr>(currentMessageId_), static_cast<LB_SunnyIntPtr>(code));
        return true;
    }
    std::wstring GetResponseHeader(const wchar_t* name) {
        if (!fnGetRespHeader_ || !currentMessageId_) return L"";
        std::string utf8 = LB_WideToUtf8(name);
        LB_SunnyIntPtr text = fnGetRespHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(utf8.c_str())));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    bool SetResponseHeader(const wchar_t* name, const wchar_t* value) {
        if (!fnSetRespHeader_ || !currentMessageId_) return FailCurrent(L"设响应头只能在 HTTP 响应事件处理器内使用。");
        std::string n = LB_WideToUtf8(name); std::string v = LB_WideToUtf8(value);
        fnSetRespHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(n.c_str())), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(v.c_str())));
        return true;
    }
    bool DeleteResponseHeader(const wchar_t* name) {
        if (!fnDelRespHeader_ || !currentMessageId_) return FailCurrent(L"删响应头只能在 HTTP 响应事件处理器内使用。");
        std::string n = LB_WideToUtf8(name);
        fnDelRespHeader_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(n.c_str())));
        return true;
    }
    std::wstring GetResponseBody() {
        if (!fnGetRespBody_ || !currentMessageId_) return L"";
        LB_SunnyIntPtr text = fnGetRespBody_(static_cast<LB_SunnyIntPtr>(currentMessageId_));
        std::wstring output = LB_Utf8ToWide(text ? reinterpret_cast<const char*>(static_cast<size_t>(text)) : "");
        if (text && fnFree_) fnFree_(text);
        return output;
    }
    long long GetResponseBodyLength() { return fnGetRespBodyLen_ && currentMessageId_ ? static_cast<long long>(fnGetRespBodyLen_(static_cast<LB_SunnyIntPtr>(currentMessageId_))) : 0; }
    bool SetResponseBody(const wchar_t* content) {
        if (!fnSetRespData_ || !currentMessageId_) return FailCurrent(L"设响应体只能在 HTTP 响应事件处理器内使用。");
        std::string data = LB_WideToUtf8(content);
        return fnSetRespData_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
    }
    bool SetResponseBodyBytes(const std::vector<unsigned char>& data) {
        if (!fnSetRespData_ || !currentMessageId_) return FailCurrent(L"设响应体字节集只能在 HTTP 响应事件处理器内使用。");
        return fnSetRespData_(static_cast<LB_SunnyIntPtr>(currentMessageId_), reinterpret_cast<LB_SunnyIntPtr>(const_cast<unsigned char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
    }

    // ===== 连接收发 =====
    bool TcpSend(long long connectionId, const std::vector<unsigned char>& data) {
        if (!fnTcpSend_ || !connectionId) return false;
        return fnTcpSend_(static_cast<LB_SunnyIntPtr>(connectionId), reinterpret_cast<LB_SunnyIntPtr>(const_cast<unsigned char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
    }
    bool TcpClose(long long connectionId) { return fnTcpClose_ && connectionId ? fnTcpClose_(static_cast<LB_SunnyIntPtr>(connectionId)) : false; }
    bool WsSend(long long messageId, const wchar_t* text) {
        if (!fnWsSend_ || !messageId) return false;
        std::string data = LB_WideToUtf8(text);
        return fnWsSend_(static_cast<LB_SunnyIntPtr>(messageId), static_cast<LB_SunnyIntPtr>(1), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
    }
    bool WsSendBytes(long long messageId, const std::vector<unsigned char>& data) {
        if (!fnWsSend_ || !messageId) return false;
        return fnWsSend_(static_cast<LB_SunnyIntPtr>(messageId), static_cast<LB_SunnyIntPtr>(2), reinterpret_cast<LB_SunnyIntPtr>(const_cast<unsigned char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
    }
    bool WsClose(long long connectionId) { return fnWsClose_ && connectionId ? fnWsClose_(static_cast<LB_SunnyIntPtr>(connectionId)) : false; }
    bool UdpSend(long long connectionId, const std::vector<unsigned char>& data, bool toClient) {
        if (!connectionId) return false;
        if (toClient && fnUdpToClient_) return fnUdpToClient_(static_cast<LB_SunnyIntPtr>(connectionId), reinterpret_cast<LB_SunnyIntPtr>(const_cast<unsigned char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
        if (fnUdpToServer_) return fnUdpToServer_(static_cast<LB_SunnyIntPtr>(connectionId), reinterpret_cast<LB_SunnyIntPtr>(const_cast<unsigned char*>(data.data())), static_cast<LB_SunnyIntPtr>(data.size()));
        return false;
    }

    // ===== 进程代理（高级） =====
    bool LoadDriver(long long id, int mode) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (mode < 0 || mode > 2) { lastError_ = L"进程代理模式只允许 0（Proxifier）、1（NFAPI）、2（Tun）。"; return false; }
        if (IsAdmin()) {
            int choice = MessageBoxW(nullptr, L"进程代理将加载内核级驱动捕获指定进程的网络流量。\n\n此操作需要管理员权限，且可能被安全软件提示，是否继续？", L"LingBuilder 网络中间件", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND);
            if (choice != IDYES) { lastError_ = L"用户取消了进程代理驱动加载。"; return false; }
        }
        bool ok = fnOpenDrive_(static_cast<LB_SunnyIntPtr>(item->sunny), static_cast<LB_SunnyIntPtr>(mode));
        if (ok) item->driverLoaded = true;
        else lastError_ = L"加载进程代理驱动失败：需要以管理员身份运行；同一时刻只允许一个中间件使用驱动。";
        return ok;
    }
    bool AddProcessName(long long id, const wchar_t* name) {
        auto item = Find(id);
        if (!item || !item->driverLoaded) { lastError_ = L"请先成功加载进程代理驱动。"; return false; }
        std::string utf8 = LB_WideToUtf8(name);
        fnProcAddName_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(utf8.c_str())));
        return true;
    }
    bool RemoveProcessName(long long id, const wchar_t* name) {
        auto item = Find(id);
        if (!item || !item->driverLoaded) { lastError_ = L"请先成功加载进程代理驱动。"; return false; }
        std::string utf8 = LB_WideToUtf8(name);
        fnProcDelName_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(utf8.c_str())));
        return true;
    }
    bool AddProcessPid(long long id, int pid) {
        auto item = Find(id);
        if (!item || !item->driverLoaded) { lastError_ = L"请先成功加载进程代理驱动。"; return false; }
        fnProcAddPid_(static_cast<LB_SunnyIntPtr>(item->sunny), static_cast<LB_SunnyIntPtr>(pid));
        return true;
    }
    bool ClearProcesses(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        fnProcCancelAll_(static_cast<LB_SunnyIntPtr>(item->sunny));
        return true;
    }
    bool UninstallDriverFiles(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        bool ok = CleanupDriverFiles();
        if (ok) item->driverLoaded = false;
        else lastError_ = L"进程代理驱动清理未全部成功（停止或删除驱动服务失败），可重试一次。";
        return ok;
    }
    bool RebootUnloadDriver(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (!item->driverLoaded) { lastError_ = L"本程序尚未加载进程代理驱动，无需重启。"; return false; }
        int choice = MessageBoxW(nullptr, L"卸载进程代理驱动必须重启计算机才能完成。\n\n点击“是”将立即重启计算机；点击“否”取消本次操作。", L"LingBuilder 网络中间件", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND);
        if (choice != IDYES) { lastError_ = L"用户取消了重启卸载。"; return false; }
        fnUnDrive_(static_cast<LB_SunnyIntPtr>(item->sunny));
        return true;
    }

    // ===== SOCKS5 按进程代理（无驱动路径） =====
    bool SocksAddUser(long long id, const wchar_t* user, const wchar_t* pass) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        std::string un = LB_WideToUtf8(user), pw = LB_WideToUtf8(pass);
        return BoolCall(item, fnSocksAdd_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(un.c_str())), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(pw.c_str()))));
    }
    bool SocksDeleteUser(long long id, const wchar_t* user, const wchar_t* pass) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        std::string un = LB_WideToUtf8(user), pw = LB_WideToUtf8(pass);
        return BoolCall(item, fnSocksDel_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(un.c_str())), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(pw.c_str()))));
    }
    bool SocksVerify(long long id, bool open) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        return BoolCall(item, fnSocksVerify_(static_cast<LB_SunnyIntPtr>(item->sunny), open));
    }

    // ===== 上游代理 =====
    bool SetUpstreamProxy(long long id, const wchar_t* proxyUrl, int timeoutMs) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        if (timeoutMs < 1000 || timeoutMs > 3600000) { lastError_ = L"上游代理超时必须在 1000 到 3600000 毫秒之间。"; return false; }
        std::string url = LB_WideToUtf8(proxyUrl);
        return BoolCall(item, fnSetGlobalProxy_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(url.c_str())), static_cast<LB_SunnyIntPtr>(timeoutMs)));
    }
    bool CancelUpstreamProxy(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        const char* empty = "";
        return BoolCall(item, fnSetGlobalProxy_(static_cast<LB_SunnyIntPtr>(item->sunny), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(empty)), static_cast<LB_SunnyIntPtr>(30000)));
    }
    bool SetRequestUpstreamProxy(long long messageId, const wchar_t* proxyUrl, int timeoutMs) {
        if (!messageId) return FailCurrent(L"设请求代理只能在 HTTP 请求事件处理器内使用。");
        if (timeoutMs < 1000 || timeoutMs > 3600000) { lastError_ = L"上游代理超时必须在 1000 到 3600000 毫秒之间。"; return false; }
        std::string url = LB_WideToUtf8(proxyUrl);
        return fnSetReqProxy_(static_cast<LB_SunnyIntPtr>(messageId), reinterpret_cast<LB_SunnyIntPtr>(const_cast<char*>(url.c_str())), static_cast<LB_SunnyIntPtr>(timeoutMs));
    }

    // ===== 系统代理 =====
    bool SetSystemProxy(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        return BoolCall(item, fnSetIeProxy_(static_cast<LB_SunnyIntPtr>(item->sunny)));
    }
    bool CancelSystemProxy(long long id) {
        auto item = Find(id);
        if (!item) { lastError_ = L"网络中间件句柄无效。"; return false; }
        return BoolCall(item, fnCancelIeProxy_(static_cast<LB_SunnyIntPtr>(item->sunny)));
    }

    // ===== 事件派发（UI 线程） =====
    void DispatchPending(DispatchHandler dispatcher) {
        dispatcher_ = std::move(dispatcher);
        for (;;) {
            std::shared_ptr<PendingEvent> event;
            {
                std::lock_guard<std::mutex> lock(pendingMutex_);
                if (pending_.empty()) break;
                event = pending_.front();
                pending_.pop_front();
            }
            DispatchOne(event);
        }
    }

    void Shutdown() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!middlewares_.empty()) {
                for (auto& entry : middlewares_) {
                    if (fnCancelIeProxy_) fnCancelIeProxy_(static_cast<LB_SunnyIntPtr>(entry.second->sunny));
                    if (fnClose_ && !entry.second->driverLoaded) fnClose_(static_cast<LB_SunnyIntPtr>(entry.second->sunny));
                }
            }
            middlewares_.clear();
            certManagers_.clear();
        }
        {
            std::lock_guard<std::mutex> pendingLock(pendingMutex_);
            for (auto& event : pending_) { event->done = true; }
            pending_.clear();
            pendingCondition_.notify_all();
        }
        activeRuntime_ = nullptr;
    }

private:
    struct MiddlewareContext {
        long long sunny = 0;
        std::wstring httpHandler, tcpHandler, wsHandler, udpHandler;
        bool driverLoaded = false;
        bool callbacksBound = false;
    };
    struct PendingEvent {
        long long id = 0;
        int family = 0;
        long long messageId = 0;
        int eventType = 0;
        long long pid = 0;
        long long connectionId = 0;
        std::wstring handler;
        std::wstring method, url, localAddress, remoteAddress;
        std::vector<unsigned char> data;
        std::shared_ptr<MiddlewareContext> context;
        bool hasHandler = false;
        bool done = false;
        std::mutex mutex;
        std::condition_variable condition;
    };

    std::shared_ptr<MiddlewareContext> Find(long long id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = middlewares_.find(id);
        return it == middlewares_.end() ? nullptr : it->second;
    }

    bool BoolCall(const std::shared_ptr<MiddlewareContext>& item, bool ok) {
        (void)item;
        if (ok) return true;
        if (lastError_.empty()) lastError_ = L"底层操作失败，原因未提供（句柄或参数可能无效）。";
        return false;
    }

    bool FailCurrent(const wchar_t* message) { lastError_ = message; return false; }

    void RegisterTrampolines(const std::shared_ptr<MiddlewareContext>& item) {
        if (!fnSetCallback_ || item->callbacksBound) return;
        fnSetCallback_(static_cast<LB_SunnyIntPtr>(item->sunny),
            reinterpret_cast<LB_SunnyIntPtr>(&LingSunnyNetRuntime::HttpTrampoline),
            reinterpret_cast<LB_SunnyIntPtr>(&LingSunnyNetRuntime::TcpTrampoline),
            reinterpret_cast<LB_SunnyIntPtr>(&LingSunnyNetRuntime::WsTrampoline),
            reinterpret_cast<LB_SunnyIntPtr>(&LingSunnyNetRuntime::UdpTrampoline));
        item->callbacksBound = true;
        activeRuntime_ = this;
    }

    std::shared_ptr<PendingEvent> Enqueue(int family, const std::shared_ptr<MiddlewareContext>& context, const wchar_t* handler) {
        auto event = std::make_shared<PendingEvent>();
        event->family = family;
        event->context = context;
        event->handler = handler ? handler : L"";
        event->hasHandler = handler && handler[0];
        {
            std::lock_guard<std::mutex> lock(pendingMutex_);
            event->id = nextEventId_++;
            pending_.push_back(event);
        }
        notify_(event->id);
        return event;
    }

    static void WaitHandled(const std::shared_ptr<PendingEvent>& event) {
        if (!event->hasHandler) return;
        std::unique_lock<std::mutex> lock(event->mutex);
        event->condition.wait_for(lock, std::chrono::seconds(30), [&event]() { return event->done; });
    }

    static void HttpTrampoline(LB_SunnyIntPtr context, LB_SunnyIntPtr requestId, LB_SunnyIntPtr messageId, LB_SunnyIntPtr messageType, char* method, char* url, char* error, LB_SunnyIntPtr pid) {
        (void)requestId; (void)error;
        LingSunnyNetRuntime* runtime = activeRuntime_;
        if (!runtime) return;
        std::shared_ptr<MiddlewareContext> item;
        {
            std::lock_guard<std::mutex> lock(runtime->mutex_);
            auto it = runtime->middlewares_.find(static_cast<long long>(context));
            if (it != runtime->middlewares_.end()) item = it->second;
        }
        if (!item) return;
        auto event = runtime->Enqueue(1, item, item->httpHandler.c_str());
        event->messageId = static_cast<long long>(messageId);
        event->eventType = static_cast<int>(messageType);
        event->pid = static_cast<long long>(pid);
        event->method = LB_Utf8ToWide(method ? method : "");
        event->url = LB_Utf8ToWide(url ? url : "");
        WaitHandled(event);
    }

    static void TcpTrampoline(LB_SunnyIntPtr context, char* localAddress, char* remoteAddress, LB_SunnyIntPtr messageType, LB_SunnyIntPtr messageId, LB_SunnyIntPtr data, LB_SunnyIntPtr dataLength, LB_SunnyIntPtr requestId, LB_SunnyIntPtr pid) {
        LingSunnyNetRuntime* runtime = activeRuntime_;
        if (!runtime) return;
        std::shared_ptr<MiddlewareContext> item;
        {
            std::lock_guard<std::mutex> lock(runtime->mutex_);
            auto it = runtime->middlewares_.find(static_cast<long long>(context));
            if (it != runtime->middlewares_.end()) item = it->second;
        }
        if (!item) return;
        auto event = runtime->Enqueue(2, item, item->tcpHandler.c_str());
        event->messageId = static_cast<long long>(messageId);
        event->eventType = static_cast<int>(messageType);
        event->pid = static_cast<long long>(pid);
        event->connectionId = static_cast<long long>(requestId);
        event->localAddress = LB_Utf8ToWide(localAddress ? localAddress : "");
        event->remoteAddress = LB_Utf8ToWide(remoteAddress ? remoteAddress : "");
        if (data && dataLength > 0) event->data.assign(reinterpret_cast<const unsigned char*>(static_cast<size_t>(data)), reinterpret_cast<const unsigned char*>(static_cast<size_t>(data)) + dataLength);
        WaitHandled(event);
    }

    static void WsTrampoline(LB_SunnyIntPtr context, LB_SunnyIntPtr requestId, LB_SunnyIntPtr messageId, LB_SunnyIntPtr messageType, char* method, char* url, LB_SunnyIntPtr pid, LB_SunnyIntPtr wsMessageType) {
        (void)requestId; (void)method; (void)wsMessageType;
        LingSunnyNetRuntime* runtime = activeRuntime_;
        if (!runtime) return;
        std::shared_ptr<MiddlewareContext> item;
        {
            std::lock_guard<std::mutex> lock(runtime->mutex_);
            auto it = runtime->middlewares_.find(static_cast<long long>(context));
            if (it != runtime->middlewares_.end()) item = it->second;
        }
        if (!item) return;
        auto event = runtime->Enqueue(3, item, item->wsHandler.c_str());
        event->messageId = static_cast<long long>(messageId);
        event->eventType = static_cast<int>(messageType);
        event->pid = static_cast<long long>(pid);
        event->url = LB_Utf8ToWide(url ? url : "");
        WaitHandled(event);
    }

    static void UdpTrampoline(LB_SunnyIntPtr context, char* localAddress, char* remoteAddress, LB_SunnyIntPtr messageType, LB_SunnyIntPtr messageId, LB_SunnyIntPtr requestId, LB_SunnyIntPtr pid) {
        LingSunnyNetRuntime* runtime = activeRuntime_;
        if (!runtime) return;
        std::shared_ptr<MiddlewareContext> item;
        {
            std::lock_guard<std::mutex> lock(runtime->mutex_);
            auto it = runtime->middlewares_.find(static_cast<long long>(context));
            if (it != runtime->middlewares_.end()) item = it->second;
        }
        if (!item) return;
        auto event = runtime->Enqueue(4, item, item->udpHandler.c_str());
        event->messageId = static_cast<long long>(messageId);
        event->eventType = static_cast<int>(messageType);
        event->pid = static_cast<long long>(pid);
        event->connectionId = static_cast<long long>(requestId);
        event->localAddress = LB_Utf8ToWide(localAddress ? localAddress : "");
        event->remoteAddress = LB_Utf8ToWide(remoteAddress ? remoteAddress : "");
        WaitHandled(event);
    }

    void DispatchOne(const std::shared_ptr<PendingEvent>& event) {
        currentFamily_ = event->family;
        currentMessageId_ = event->messageId;
        currentEventType_ = event->eventType;
        currentPid_ = event->pid;
        currentConnectionId_ = event->connectionId;
        currentMethod_ = event->method;
        currentUrl_ = event->url;
        currentLocalAddress_ = event->localAddress;
        currentRemoteAddress_ = event->remoteAddress;
        currentData_ = event->data;
        if (event->hasHandler && dispatcher_) dispatcher_(event->handler.c_str());
        {
            std::lock_guard<std::mutex> lock(event->mutex);
            event->done = true;
        }
        event->condition.notify_all();
    }

    bool IsAdmin() const {
        BOOL elevated = FALSE;
        TOKEN_ELEVATION elevation = {};
        DWORD size = 0;
        HANDLE token = nullptr;
        if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) {
            if (GetTokenInformation(token, TokenElevation, &elevation, sizeof(elevation), &size)) elevated = elevation.TokenIsElevated;
            CloseHandle(token);
        }
        return elevated != FALSE;
    }

    bool CleanupDriverFiles() {
        RunHiddenCommand(L"sc stop WinDivert");
        bool deleted = RunHiddenCommand(L"sc delete WinDivert");
        RunHiddenCommand(L"sc stop netfilter2");
        RunHiddenCommand(L"sc delete netfilter2");
        PVOID redirectionState = nullptr;
        const bool redirectionDisabled = DisableRedirection(&redirectionState);
        wchar_t systemDirectory[MAX_PATH] = {};
        UINT length = GetSystemDirectoryW(systemDirectory, MAX_PATH);
        std::wstring driversDirectory = length ? (std::wstring(systemDirectory, length) + L"\\drivers") : L"";
        wchar_t tempDirectory[MAX_PATH] = {};
        GetTempPathW(MAX_PATH, tempDirectory);
        srand(static_cast<unsigned>(GetTickCount64()));
        const wchar_t* files[3] = { L"\\WinDivert64.sys", L"\\WinDivert32.sys", L"\\netfilter2.sys" };
        for (const wchar_t* file : files) {
            if (driversDirectory.empty()) break;
            std::wstring source = driversDirectory + file;
            if (GetFileAttributesW(source.c_str()) == INVALID_FILE_ATTRIBUTES) continue;
            std::wstring target = std::wstring(tempDirectory) + L"Sunny_" + std::to_wstring(rand() % 100000) + L".sys";
            MoveFileExW(source.c_str(), target.c_str(), MOVEFILE_REPLACE_EXISTING);
        }
        if (redirectionDisabled) RevertRedirection(redirectionState);
        return deleted;
    }

    static bool DisableRedirection(PVOID* state) {
#ifdef _WIN64
        (void)state;
        return false;
#else
        return Wow64DisableWow64FsRedirection(state) != FALSE;
#endif
    }
    static void RevertRedirection(PVOID state) {
#ifdef _WIN64
        (void)state;
#else
        Wow64RevertWow64FsRedirection(state);
#endif
    }

    static bool RunHiddenCommand(const std::wstring& arguments) {
        std::wstring command = L"cmd.exe /c " + arguments;
        STARTUPINFOW startup = {};
        startup.cb = sizeof(startup);
        startup.dwFlags = STARTF_USESHOWWINDOW;
        startup.wShowWindow = SW_HIDE;
        PROCESS_INFORMATION process = {};
        std::vector<wchar_t> buffer(command.begin(), command.end());
        buffer.push_back(L'\0');
        if (!CreateProcessW(nullptr, buffer.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process)) return false;
        WaitForSingleObject(process.hProcess, 10000);
        DWORD exitCode = 1;
        GetExitCodeProcess(process.hProcess, &exitCode);
        CloseHandle(process.hThread);
        CloseHandle(process.hProcess);
        return exitCode == 0;
    }

    static std::wstring LB_GbkToWide(const char* text) {
        if (!text || !text[0]) return L"";
        int size = MultiByteToWideChar(936, 0, text, -1, nullptr, 0);
        if (size <= 0) return L"";
        std::wstring output(static_cast<size_t>(size - 1), L'\0');
        MultiByteToWideChar(936, 0, text, -1, output.data(), size);
        return output;
    }

    NotifyEvent notify_;
    DispatchHandler dispatcher_;
    HMODULE dll_ = nullptr;
    mutable std::mutex mutex_, loadMutex_, pendingMutex_;
    std::condition_variable pendingCondition_;
    std::wstring lastError_;
    std::map<long long, std::shared_ptr<MiddlewareContext>> middlewares_;
    std::map<long long, bool> certManagers_;
    std::deque<std::shared_ptr<PendingEvent>> pending_;
    long long nextEventId_ = 1;
    int currentFamily_ = 0;
    int currentEventType_ = 0;
    long long currentMessageId_ = 0;
    long long currentPid_ = 0;
    long long currentConnectionId_ = 0;
    std::wstring currentMethod_, currentUrl_, currentLocalAddress_, currentRemoteAddress_;
    std::vector<unsigned char> currentData_;
    static LingSunnyNetRuntime* activeRuntime_;

#define LB_SUNNY_FN_PTR(name) LB_SunnyIntPtr(__cdecl *name)(...)
    LB_SunnyIntPtr(__cdecl *fnVersion_)() = nullptr;
    void (__cdecl *fnFree_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnCreate_)() = nullptr;
    LB_SunnyIntPtr(__cdecl *fnRelease_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnClose_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnStart_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetPort_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetCallback_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnError_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnCreateCert_)() = nullptr;
    bool (__cdecl *fnCreateCA_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnRemoveCert_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetCert_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnInstallCert_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnExportCert_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetReqBody_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetReqBodyLen_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetReqData_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetReqUrl_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetReqHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnSetReqHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnDelReqHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetReqCookie_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnSetReqCookie_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetRespBody_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetRespBodyLen_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetRespData_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetRespStatus_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetRespStatusCode_)(LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnSetRespStatus_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetRespHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnSetRespHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnDelRespHeader_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnGetClientIp_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSocksAdd_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSocksDel_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSocksVerify_)(LB_SunnyIntPtr, bool) = nullptr;
    bool (__cdecl *fnSetGlobalProxy_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetReqProxy_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnSetIeProxy_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnCancelIeProxy_)(LB_SunnyIntPtr) = nullptr;
    LB_SunnyIntPtr(__cdecl *fnTcpSend_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnTcpClose_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnWsSend_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnWsClose_)(LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnUdpToServer_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnUdpToClient_)(LB_SunnyIntPtr, LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnOpenDrive_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    bool (__cdecl *fnUnDrive_)(LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnProcAddName_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnProcDelName_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnProcAddPid_)(LB_SunnyIntPtr, LB_SunnyIntPtr) = nullptr;
    void (__cdecl *fnProcCancelAll_)(LB_SunnyIntPtr) = nullptr;
};

LingSunnyNetRuntime* LingSunnyNetRuntime::activeRuntime_ = nullptr;
`;

const SUNNYNET_WINDOW_METHODS = String.raw`
    long long 网络中间件_创建() { return sunnyNetRuntime_.Create(); }
    bool 网络中间件_销毁(long long middleware) { return sunnyNetRuntime_.Destroy(middleware); }
    bool 网络中间件_设置端口(long long middleware, int port) { return sunnyNetRuntime_.SetPort(middleware, port); }
    bool 网络中间件_启动(long long middleware) { return sunnyNetRuntime_.Start(middleware); }
    bool 网络中间件_停止(long long middleware) { return sunnyNetRuntime_.Stop(middleware); }
    std::wstring 网络中间件_取错误(long long middleware) { return sunnyNetRuntime_.LastError(middleware); }
    std::wstring 网络中间件_取版本() { return sunnyNetRuntime_.Version(); }
    long long 网络中间件_创建证书管理器() { return sunnyNetRuntime_.CreateCertManager(); }
    void 网络中间件_销毁证书管理器(long long certManager) { sunnyNetRuntime_.DestroyCertManager(certManager); }
    bool 网络中间件_绑定证书(long long middleware, long long certManager) { return sunnyNetRuntime_.BindCert(middleware, certManager); }
    bool 网络中间件_是否已安装根证书() { return sunnyNetRuntime_.IsRootCertInstalled(); }
    bool 网络中间件_安装根证书(long long middleware) { return sunnyNetRuntime_.InstallRootCert(middleware); }
    bool 网络中间件_卸载根证书() { return sunnyNetRuntime_.UninstallRootCert(); }
    bool 网络中间件_导出根证书(long long middleware, const wchar_t* path) { return sunnyNetRuntime_.ExportRootCert(middleware, path); }
    bool 网络中间件_设置HTTP事件(long long middleware, const wchar_t* handler) { return sunnyNetRuntime_.BindHttpHandler(middleware, handler); }
    bool 网络中间件_设置TCP事件(long long middleware, const wchar_t* handler) { return sunnyNetRuntime_.BindTcpHandler(middleware, handler); }
    bool 网络中间件_设置WebSocket事件(long long middleware, const wchar_t* handler) { return sunnyNetRuntime_.BindWsHandler(middleware, handler); }
    bool 网络中间件_设置UDP事件(long long middleware, const wchar_t* handler) { return sunnyNetRuntime_.BindUdpHandler(middleware, handler); }
    long long 网络中间件_取当前事件ID() { return sunnyNetRuntime_.CurrentEventId(); }
    int 网络中间件_取当前事件类型() { return sunnyNetRuntime_.CurrentEventType(); }
    long long 网络中间件_取当前进程ID() { return sunnyNetRuntime_.CurrentPid(); }
    long long 网络中间件_取当前连接ID() { return sunnyNetRuntime_.CurrentConnectionId(); }
    std::wstring 网络中间件_取当前方法() { return sunnyNetRuntime_.CurrentMethod(); }
    std::wstring 网络中间件_取当前URL() { return sunnyNetRuntime_.CurrentUrl(); }
    std::wstring 网络中间件_取当前客户IP() { return sunnyNetRuntime_.CurrentClientIp(); }
    std::wstring 网络中间件_取当前本地地址() { return sunnyNetRuntime_.CurrentLocalAddress(); }
    std::wstring 网络中间件_取当前对端地址() { return sunnyNetRuntime_.CurrentRemoteAddress(); }
    std::vector<unsigned char> 网络中间件_取当前TCP数据() { return sunnyNetRuntime_.CurrentTcpData(); }
    std::vector<unsigned char> 网络中间件_取当前WS数据() { return sunnyNetRuntime_.CurrentWsData(); }
    std::vector<unsigned char> 网络中间件_取当前UDP数据() { return sunnyNetRuntime_.CurrentUdpData(); }
    std::wstring 网络中间件_取请求头(const wchar_t* name) { return sunnyNetRuntime_.GetRequestHeader(name); }
    bool 网络中间件_设请求头(const wchar_t* name, const wchar_t* value) { return sunnyNetRuntime_.SetRequestHeader(name, value); }
    bool 网络中间件_删请求头(const wchar_t* name) { return sunnyNetRuntime_.DeleteRequestHeader(name); }
    std::wstring 网络中间件_取请求体() { return sunnyNetRuntime_.GetRequestBody(); }
    long long 网络中间件_取请求体长度() { return sunnyNetRuntime_.GetRequestBodyLength(); }
    bool 网络中间件_设请求体(const wchar_t* content) { return sunnyNetRuntime_.SetRequestBody(content); }
    bool 网络中间件_设请求URL(const wchar_t* url) { return sunnyNetRuntime_.SetRequestUrl(url); }
    std::wstring 网络中间件_取请求Cookie(const wchar_t* name) { return sunnyNetRuntime_.GetRequestCookie(name); }
    bool 网络中间件_设请求Cookie(const wchar_t* name, const wchar_t* value) { return sunnyNetRuntime_.SetRequestCookie(name, value); }
    int 网络中间件_取响应状态码() { return sunnyNetRuntime_.GetResponseStatusCode(); }
    bool 网络中间件_设响应状态码(int code) { return sunnyNetRuntime_.SetResponseStatusCode(code); }
    std::wstring 网络中间件_取响应头(const wchar_t* name) { return sunnyNetRuntime_.GetResponseHeader(name); }
    bool 网络中间件_设响应头(const wchar_t* name, const wchar_t* value) { return sunnyNetRuntime_.SetResponseHeader(name, value); }
    bool 网络中间件_删响应头(const wchar_t* name) { return sunnyNetRuntime_.DeleteResponseHeader(name); }
    std::wstring 网络中间件_取响应体() { return sunnyNetRuntime_.GetResponseBody(); }
    long long 网络中间件_取响应体长度() { return sunnyNetRuntime_.GetResponseBodyLength(); }
    bool 网络中间件_设响应体(const wchar_t* content) { return sunnyNetRuntime_.SetResponseBody(content); }
    bool 网络中间件_设响应体字节集(const std::vector<unsigned char>& data) { return sunnyNetRuntime_.SetResponseBodyBytes(data); }
    bool 网络中间件_TCP发送数据(long long connectionId, const std::vector<unsigned char>& data) { return sunnyNetRuntime_.TcpSend(connectionId, data); }
    bool 网络中间件_TCP关闭连接(long long connectionId) { return sunnyNetRuntime_.TcpClose(connectionId); }
    bool 网络中间件_WS发送文本(long long messageId, const wchar_t* text) { return sunnyNetRuntime_.WsSend(messageId, text); }
    bool 网络中间件_WS发送字节集(long long messageId, const std::vector<unsigned char>& data) { return sunnyNetRuntime_.WsSendBytes(messageId, data); }
    bool 网络中间件_WS关闭连接(long long connectionId) { return sunnyNetRuntime_.WsClose(connectionId); }
    bool 网络中间件_UDP发送数据(long long connectionId, const std::vector<unsigned char>& data, bool toClient) { return sunnyNetRuntime_.UdpSend(connectionId, data, toClient); }
    bool 网络中间件_加载进程代理驱动(long long middleware, int mode) { return sunnyNetRuntime_.LoadDriver(middleware, mode); }
    bool 网络中间件_添加代理进程(long long middleware, const wchar_t* name) { return sunnyNetRuntime_.AddProcessName(middleware, name); }
    bool 网络中间件_移除代理进程(long long middleware, const wchar_t* name) { return sunnyNetRuntime_.RemoveProcessName(middleware, name); }
    bool 网络中间件_按PID添加代理进程(long long middleware, int pid) { return sunnyNetRuntime_.AddProcessPid(middleware, pid); }
    bool 网络中间件_清空代理进程(long long middleware) { return sunnyNetRuntime_.ClearProcesses(middleware); }
    bool 网络中间件_卸载进程代理文件(long long middleware) { return sunnyNetRuntime_.UninstallDriverFiles(middleware); }
    bool 网络中间件_彻底清理驱动并重启计算机(long long middleware) { return sunnyNetRuntime_.RebootUnloadDriver(middleware); }
    bool 网络中间件_添加SOCKS用户(long long middleware, const wchar_t* user, const wchar_t* pass) { return sunnyNetRuntime_.SocksAddUser(middleware, user, pass); }
    bool 网络中间件_删除SOCKS用户(long long middleware, const wchar_t* user, const wchar_t* pass) { return sunnyNetRuntime_.SocksDeleteUser(middleware, user, pass); }
    bool 网络中间件_开启SOCKS用户校验(long long middleware, bool open) { return sunnyNetRuntime_.SocksVerify(middleware, open); }
    bool 网络中间件_设置上游代理(long long middleware, const wchar_t* proxyUrl, int timeoutMs) { return sunnyNetRuntime_.SetUpstreamProxy(middleware, proxyUrl, timeoutMs); }
    bool 网络中间件_取消上游代理(long long middleware) { return sunnyNetRuntime_.CancelUpstreamProxy(middleware); }
    bool 网络中间件_设请求代理(long long messageId, const wchar_t* proxyUrl, int timeoutMs) { return sunnyNetRuntime_.SetRequestUpstreamProxy(messageId, proxyUrl, timeoutMs); }
    bool 网络中间件_设置系统代理(long long middleware) { return sunnyNetRuntime_.SetSystemProxy(middleware); }
    bool 网络中间件_取消系统代理(long long middleware) { return sunnyNetRuntime_.CancelSystemProxy(middleware); }
`;
