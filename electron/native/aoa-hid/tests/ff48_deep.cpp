// ff48_deep.cpp — FF48 复合设备深度探测：全设备列表 + 配置描述符可读性 + 子接口 WinUSB 句柄
#include <libusb.h>
#include <windows.h>
#include <cfgmgr32.h>
#include <winusb.h>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "winusb.lib")

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

int main() {
    libusb_context* ctx = nullptr;
    libusb_init(&ctx);
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    printf("=== libusb 全设备列表（%ld）===\n", (long)n);
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        libusb_get_device_descriptor(list[i], &d);
        uint8_t path[8] = {0};
        int pn = libusb_get_port_numbers(list[i], path, sizeof path);
        std::string pp;
        char tmp[8];
        for (int k = 0; k < pn; k++) { snprintf(tmp, sizeof tmp, "%s%d", k ? "." : "", path[k]); pp += tmp; }
        libusb_device_handle* h = nullptr;
        int r = libusb_open(list[i], &h);
        printf("bus=%d port=%-6s %04x:%04x  open=%d(%s)\n", libusb_get_bus_number(list[i]), pp.c_str(),
               d.idVendor, d.idProduct, r, libusb_error_name(r));
        if (h) libusb_close(h);
        if (d.idVendor == 0x2717 && d.idProduct == 0xff48) {
            libusb_config_descriptor* cfg = nullptr;
            int cr = libusb_get_active_config_descriptor(list[i], &cfg);
            printf("   [FF48] get_active_config -> %d(%s)", cr, libusb_error_name(cr));
            if (cr == 0) {
                printf(" ifaces=%d", cfg->bNumInterfaces);
                for (int a = 0; a < cfg->bNumInterfaces; a++) {
                    const libusb_interface& ifc = cfg->interface[a];
                    for (int b = 0; b < ifc.num_altsetting; b++) {
                        const libusb_interface_descriptor& alt = ifc.altsetting[b];
                        printf(" [if%d cls=%02x/%02x/%02x ep=%d]", alt.bInterfaceNumber,
                               alt.bInterfaceClass, alt.bInterfaceSubClass, alt.bInterfaceProtocol, alt.bNumEndpoints);
                    }
                }
                libusb_free_config_descriptor(cfg);
            }
            printf("\n");
            // 内核驱动活动性
        }
    }
    libusb_free_device_list(list, 1);
    libusb_exit(ctx);

    // WinUSB 子接口层：直接对 MI_01 开 WinUSB 句柄并发设备级 AOA 请求
    printf("\n=== MI_01 WinUSB 子接口探测 ===\n");
    const GUID kWinUsbGuid = { 0xdee824ef, 0x729b, 0x4a0e, { 0x9c, 0x14, 0xb7, 0x11, 0x7d, 0x33, 0xa8, 0x17 } };
    const wchar_t* inst = L"USB\\VID_2717&PID_FF48&MI_01\\9&ECA604F&1&0001";
    ULONG len = 0;
    CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
    printf("iface list size=%lu\n", len);
    if (len > 1) {
        std::vector<wchar_t> buf(len);
        if (CM_Get_Device_Interface_ListW((LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, buf.data(), len,
                                          CM_GET_DEVICE_INTERFACE_LIST_PRESENT) == CR_SUCCESS) {
            for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) {
                printf("  path=%s\n", narrow(p).c_str());
                HANDLE h = CreateFileW(p, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                       nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
                printf("    CreateFile=%s err=%lu\n", h == INVALID_HANDLE_VALUE ? "FAIL" : "OK", GetLastError());
                if (h == INVALID_HANDLE_VALUE) continue;
                WINUSB_INTERFACE_HANDLE wh = nullptr;
                if (!WinUsb_Initialize(h, &wh)) {
                    printf("    WinUsb_Initialize FAIL err=%lu\n", GetLastError());
                    CloseHandle(h);
                    continue;
                }
                printf("    WinUsb_Initialize OK\n");
                WINUSB_SETUP_PACKET sp{};
                sp.RequestType = 0xC0; sp.Request = 51; sp.Value = 0; sp.Index = 0; sp.Length = 2;
                unsigned char proto[2] = {0, 0};
                ULONG got = 0;
                BOOL ok = WinUsb_ControlTransfer(wh, sp, proto, 2, &got, nullptr);
                printf("    GET_PROTOCOL(device-recipient) -> %s got=%lu ver=%u.%u err=%lu\n",
                       ok ? "OK" : "FAIL", got, proto[0], proto[1], GetLastError());
                WinUsb_Free(wh);
                CloseHandle(h);
            }
        }
    }
    return 0;
}
