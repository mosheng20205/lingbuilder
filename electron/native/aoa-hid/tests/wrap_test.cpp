// wrap_test.cpp — 验证 libusb_wrap_sys_device 走 WinUSB 子接口句柄可行（P2 方案②的插管验证）
// FF40 根节点自身是 WinUSB 且能被 libusb 直接打开，用它证明「CreateFile → wrap → 控制/批量传输」链路。
#include <libusb.h>
#include <windows.h>
#include <cfgmgr32.h>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")

static const GUID kWinUsbGuid = { 0xdee824ef, 0x729b, 0x4a0e, { 0x9c, 0x14, 0xb7, 0x11, 0x7d, 0x33, 0xa8, 0x17 } };

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

int main(int argc, char** argv) {
    const wchar_t* inst = argc >= 2 ? L"" : L"USB\\VID_2717&PID_FF40\\B3CF0C91";
    std::wstring w = argc >= 2 ? std::wstring() : std::wstring(inst);
    if (!w.empty()) { /* ok */ }
    ULONG len = 0;
    CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
    printf("iface list size=%lu\n", len);
    if (len <= 1) return 1;
    std::vector<wchar_t> buf(len);
    if (CM_Get_Device_Interface_ListW((LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, buf.data(), len,
                                      CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS) return 1;
    for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) {
        printf("path=%s\n", narrow(p).c_str());
        HANDLE h = CreateFileW(p, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                               OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
        if (h == INVALID_HANDLE_VALUE) { printf("  CreateFile FAIL err=%lu\n", GetLastError()); continue; }
        printf("  CreateFile OK\n");
        libusb_context* ctx = nullptr;
        libusb_init(&ctx);
        libusb_device_handle* dh = nullptr;
        int r = libusb_wrap_sys_device(ctx, (intptr_t)h, &dh);
        printf("  libusb_wrap_sys_device -> %d (%s)\n", r, libusb_error_name(r));
        if (r == 0) {
            unsigned char proto[2] = { 7, 7 };
            int n1 = libusb_control_transfer(dh, 0xC0, 51, 0, 0, proto, 2, 1000);
            printf("  wrap后 GET_PROTOCOL -> %d ver=%u.%u\n", n1, proto[0], proto[1]);
            // 读配置描述符（验证枚举路径也通）
            libusb_device* dev = libusb_get_device(dh);
            libusb_config_descriptor* cfg = nullptr;
            int cr = dev ? libusb_get_active_config_descriptor(dev, &cfg) : -999;
            printf("  wrap后 active_config -> %d ifaces=%d\n", cr, cr == 0 ? cfg->bNumInterfaces : -1);
            if (cr == 0) {
                for (int a = 0; a < cfg->bNumInterfaces; a++) {
                    const libusb_interface_descriptor& alt = cfg->interface[a].altsetting[0];
                    printf("    if%d cls=%02x/%02x/%02x eps=%d", alt.bInterfaceNumber, alt.bInterfaceClass,
                           alt.bInterfaceSubClass, alt.bInterfaceProtocol, alt.bNumEndpoints);
                    for (int e = 0; e < alt.bNumEndpoints; e++)
                        printf(" ep%02x", alt.endpoint[e].bEndpointAddress);
                    printf("\n");
                }
                libusb_free_config_descriptor(cfg);
            }
            // 批量传输（无设备侧对端时预期超时，只要不是崩溃/句柄无效即证明路径可用）
            unsigned char tmp[64] = {0};
            int got = 0;
            int br = libusb_bulk_transfer(dh, 0x81, tmp, sizeof tmp, &got, 300);
            printf("  wrap后 bulk IN(0x81) -> %d (%s) got=%d\n", br, libusb_error_name(br), got);
            libusb_close(dh);
        }
        libusb_exit(ctx);
        // libusb_close 会关掉 wrap 的句柄；此处不再 CloseHandle
    }
    return 0;
}
