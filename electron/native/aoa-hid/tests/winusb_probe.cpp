// winusb_probe.cpp — 复合设备接口级 WinUSB 打开可行性探针（P2 方案②定案用）
// 目标：对 MI_01（ADB，winusb.inf）单独开句柄，验证能否在其上发设备级 AOA 控制传输（GET_PROTOCOL）。
#include <windows.h>
#include <setupapi.h>
#include <cfgmgr32.h>
#include <winusb.h>
#include <devguid.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "winusb.lib")
#pragma comment(lib, "cfgmgr32.lib")

static std::wstring widen(const char* s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0);
    std::wstring w(n ? n - 1 : 0, L'\0');
    if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s, -1, &w[0], n);
    return w;
}
static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

struct IfaceEntry {
    std::string instanceId;
    std::string path;
};

// CM_Get_Device_Interface_List：按设备接口类 GUID 取某个设备实例的接口路径（复合设备的子接口各自有）
static std::vector<std::string> cm_ifaces(const std::string& instanceId, const GUID& guid) {
    std::vector<std::string> out;
    std::wstring wid = widen(instanceId.c_str());
    ULONG len = 0;
    CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&guid, (DEVINSTID_W)wid.c_str(), CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
    if (!len || len == 1) return out;
    std::vector<wchar_t> buf(len);
    if (CM_Get_Device_Interface_ListW((LPGUID)&guid, (DEVINSTID_W)wid.c_str(), buf.data(), len,
                                      CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS)
        return out;
    for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) out.push_back(narrow(p));
    return out;
}

static const GUID kWinUsbGuid  = { 0xdee824ef, 0x729b, 0x4a0e, { 0x9c, 0x14, 0xb7, 0x11, 0x7d, 0x33, 0xa8, 0x17 } };
static const GUID kUsbDeviceGuid = { 0xA5DCBF10, 0x6530, 0x11D2, { 0x90, 0x1F, 0x00, 0xC0, 0x4F, 0xB9, 0x51, 0xED } };

// 枚举 present 的全部 USB 设备接口，按父复合设备实例 ID 前缀匹配
static std::vector<IfaceEntry> enum_child_interfaces(const std::string& parentPrefix) {
    std::vector<IfaceEntry> out;
    HDEVINFO set = SetupDiGetClassDevsW(nullptr, nullptr, nullptr, DIGCF_ALLCLASSES | DIGCF_PRESENT);
    if (set == INVALID_HANDLE_VALUE) { printf("  SetupDiGetClassDevs FAIL err=%lu\n", GetLastError()); return out; }
    for (DWORD i = 0;; i++) {
        SP_DEVINFO_DATA info{};
        info.cbSize = sizeof info;
        if (!SetupDiEnumDeviceInfo(set, i, &info)) break;
        wchar_t id[512] = {0};
        if (!SetupDiGetDeviceInstanceIdW(set, &info, id, 512, nullptr)) continue;
        std::string inst = narrow(id);
        if (inst.compare(0, parentPrefix.size(), parentPrefix) != 0) continue;
        // 取该设备信息集的第一个显示名 + 服务名（诊断用）
        wchar_t name[512] = {0};
        SetupDiGetDeviceRegistryPropertyW(set, &info, SPDRP_DEVICEDESC, nullptr, (PBYTE)name, sizeof name, nullptr);
        wchar_t svc[256] = {0};
        SetupDiGetDeviceRegistryPropertyW(set, &info, SPDRP_SERVICE, nullptr, (PBYTE)svc, sizeof svc, nullptr);
        printf("  child inst=%s desc=%s svc=%s\n", inst.c_str(), narrow(name).c_str(), narrow(svc).c_str());
        // 枚举该设备的接口路径（WinUSB 接口类 + USBDevice 接口类都要试）
        for (const GUID& g : { kWinUsbGuid, kUsbDeviceGuid }) {
            for (auto& p : cm_ifaces(inst, g)) {
                out.push_back({ inst, p });
                printf("    path=%s\n", p.c_str());
            }
        }
    }
    SetupDiDestroyDeviceInfoList(set);
    return out;
}

int main(int argc, char** argv) {
    const char* parent = argc >= 2 ? argv[1] : "USB\\VID_2717&PID_FF48\\";
    printf("=== 枚举 %s 的子接口 ===\n", parent);
    auto list = enum_child_interfaces(parent);
    printf("共 %zu 个接口路径\n", list.size());
    for (auto& e : list) {
        printf("\n--- 开 %s\n", e.instanceId.c_str());
        std::wstring wp = widen(e.path.c_str());
        HANDLE h = CreateFileW(wp.c_str(), GENERIC_READ | GENERIC_WRITE,
                               FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                               FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
        printf("  CreateFile -> %s\n", h == INVALID_HANDLE_VALUE ? "FAIL" : "OK");
        if (h == INVALID_HANDLE_VALUE) { printf("  err=%lu\n", GetLastError()); continue; }
        WINUSB_INTERFACE_HANDLE wh = nullptr;
        if (!WinUsb_Initialize(h, &wh)) {
            printf("  WinUsb_Initialize FAIL err=%lu（该接口非 WinUSB 驱动，属预期）\n", GetLastError());
            CloseHandle(h);
            continue;
        }
        printf("  WinUsb_Initialize OK\n");
        USB_INTERFACE_DESCRIPTOR desc{};
        if (WinUsb_QueryInterfaceSettings(wh, 0, &desc)) {
            printf("  iface desc: num=%u class=%02x/%02x/%02x\n", desc.bInterfaceNumber,
                   desc.bInterfaceClass, desc.bInterfaceSubClass, desc.bInterfaceProtocol);
        }
        // AOA GET_PROTOCOL：bmRequestType=0xC0 bRequest=51 wValue=0 wIndex=0 len=2（设备级请求）
        WINUSB_SETUP_PACKET sp{};
        sp.RequestType = 0xC0;
        sp.Request = 51;
        sp.Value = 0;
        sp.Index = 0;
        sp.Length = 2;
        unsigned char proto[2] = {0, 0};
        ULONG got = 0;
        BOOL ok = WinUsb_ControlTransfer(wh, sp, proto, 2, &got, nullptr);
        printf("  GET_PROTOCOL -> %s got=%lu ver=%u.%u err=%lu\n",
               ok ? "OK" : "FAIL", got, proto[0], proto[1], GetLastError());
        WinUsb_Free(wh);
        CloseHandle(h);
    }
    return 0;
}
