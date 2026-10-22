// share_matrix.cpp — 对 FF48 MI_01 / MI_00 / FF40 根，穷举 access×share 组合尝试 CreateFile
#include <windows.h>
#include <cfgmgr32.h>
#include <winusb.h>
#include <devpkey.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "winusb.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "propsys.lib")

static const GUID kWinUsbGuid = { 0xdee824ef, 0x729b, 0x4a0e, { 0x9c, 0x14, 0xb7, 0x11, 0x7d, 0x33, 0xa8, 0x17 } };

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

static void test_inst(const wchar_t* inst) {
    printf("\n=== %s\n", narrow(inst).c_str());
    ULONG len = 0;
    CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
    if (len <= 1) { printf("  no winusb iface (len=%lu)\n", len); return; }
    std::vector<wchar_t> buf(len);
    if (CM_Get_Device_Interface_ListW((LPGUID)&kWinUsbGuid, (DEVINSTID_W)inst, buf.data(), len,
                                      CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS) return;
    for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) {
        printf("  path=%s\n", narrow(p).c_str());
        DWORD accs[] = { GENERIC_READ | GENERIC_WRITE, GENERIC_READ, GENERIC_WRITE, 0 };
        DWORD shares[] = { FILE_SHARE_READ | FILE_SHARE_WRITE, 0, FILE_SHARE_READ, FILE_SHARE_WRITE };
        for (DWORD a : accs) for (DWORD s : shares) {
            HANDLE h = CreateFileW(p, a, s, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
            printf("    acc=%08lx share=%lx -> %s err=%lu", a, s, h == INVALID_HANDLE_VALUE ? "FAIL" : "OK", GetLastError());
            if (h != INVALID_HANDLE_VALUE) {
                WINUSB_INTERFACE_HANDLE wh = nullptr;
                printf(" winusb=%s", WinUsb_Initialize(h, &wh) ? "OK" : "FAIL");
                if (wh) WinUsb_Free(wh);
                CloseHandle(h);
            }
            printf("\n");
        }
        // 安全描述符（该设备接口的 SDS）
        wchar_t inst2[512] = {0};
        wcscpy_s(inst2, inst);
        DEVINST dev = 0;
        if (CM_Locate_DevNodeW(&dev, (DEVINSTID_W)inst2, CM_LOCATE_DEVNODE_NORMAL) == CR_SUCCESS) {
            wchar_t sddl[1024] = {0};
            ULONG sz = sizeof sddl; DEVPROPTYPE dt = 0; ULONG sz2 = sizeof sddl;
            if (CM_Get_DevNode_PropertyW(dev, &DEVPKEY_Device_SecuritySDS, &dt, (PBYTE)sddl, &sz2, 0) == CR_SUCCESS)
                printf("    SDS=%s\n", narrow(sddl).c_str());
        }
    }
}

int main() {
    test_inst(L"USB\\VID_2717&PID_FF48&MI_01\\9&ECA604F&1&0001");
    test_inst(L"USB\\VID_2717&PID_FF48&MI_00\\9&ECA604F&1&0000");
    test_inst(L"USB\\VID_2717&PID_FF40\\B3CF0C91");
    return 0;
}
