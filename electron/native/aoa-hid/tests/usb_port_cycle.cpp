// usb_port_cycle.cpp — 对指定根集线器的指定端口做 USB 端口电源循环（IOCTL_USB_HUB_CYCLE_PORT）
// 用途：测试中 pnputil /remove-device 之后 devnode 卡在 DN_WILL_BE_REMOVED，
// 只有真实重新枚举（物理插拔或端口掉电重上）才能清掉；本工具等价于一次软件插拔。
// 用法：usb_port_cycle.exe [<根集线器实例ID>] <端口号>
#include <windows.h>
#include <cfgmgr32.h>
#include <usbioctl.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

// USB 集线器设备接口类 GUID：{F18A0E88-C30C-11D0-8815-00A0C906BED8}
static const GUID kUsbHubGuid = { 0xF18A0E88, 0xC30C, 0x11D0, { 0x88, 0x15, 0x00, 0xA0, 0xC9, 0x06, 0xBE, 0xD8 } };

int main(int argc, char** argv) {
    if (argc < 2) {
        printf("用法: usb_port_cycle.exe [<根集线器实例ID>] <端口号>\n");
        return 2;
    }
    std::string hubInst = argc >= 3 ? argv[1] : "USB\\ROOT_HUB30\\7&7360633&0&0";
    USHORT port = (USHORT)atoi(argc >= 3 ? argv[2] : argv[1]);
    printf("hub=%s port=%u\n", hubInst.c_str(), port);

    std::wstring wid;
    for (char c : hubInst) wid += (wchar_t)c;
    ULONG len = 0;
    CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&kUsbHubGuid, (DEVINSTID_W)wid.c_str(), CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
    printf("hub iface list size=%lu\n", len);
    if (len <= 1) { printf("找不到集线器接口\n"); return 1; }
    std::vector<wchar_t> buf(len);
    if (CM_Get_Device_Interface_ListW((LPGUID)&kUsbHubGuid, (DEVINSTID_W)wid.c_str(), buf.data(), len,
                                      CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS) return 1;
    const wchar_t* path = buf.data();
    printf("hub path=%s\n", narrow(path).c_str());

    HANDLE h = CreateFileW(path, GENERIC_WRITE, FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
    if (h == INVALID_HANDLE_VALUE) {
        printf("CreateFile FAIL err=%lu\n", GetLastError());
        return 1;
    }
    printf("CreateFile OK\n");

    // 端口信息（诊断）
    std::vector<BYTE> info(sizeof(USB_NODE_CONNECTION_INFORMATION_EX) + 0x100);
    auto* in = (USB_NODE_CONNECTION_INFORMATION_EX*)info.data();
    in->ConnectionIndex = port;
    DWORD ret = 0;
    if (DeviceIoControl(h, IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX, in, (DWORD)info.size(), in, (DWORD)info.size(), &ret, nullptr))
        printf("port %u 当前：已连接=%d 设备地址=%d 速度=%d\n", port, in->ConnectionStatus, in->DeviceAddress, in->Speed);
    else
        printf("port %u 查询失败 err=%lu\n", port, GetLastError());

    // 端口电源循环：等价于软件插拔
    USB_CYCLE_PORT_PARAMS cyc{};
    cyc.ConnectionIndex = port;
    BOOL ok = DeviceIoControl(h, IOCTL_USB_HUB_CYCLE_PORT, &cyc, sizeof cyc, &cyc, sizeof cyc, &ret, nullptr);
    printf("IOCTL_USB_HUB_CYCLE_PORT -> %s err=%lu status=%lu\n", ok ? "OK" : "FAIL", GetLastError(), cyc.StatusReturned);
    CloseHandle(h);
    return ok ? 0 : 1;
}
