// wu_open_test.cpp — 对比 FF48 MI_01 / FF40 根节点的 WinUSB CreateFile 可open性（含多种共享/等待标志）
#include <windows.h>
#include <cfgmgr32.h>
#include <winusb.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "winusb.lib")
#pragma comment(lib, "advapi32.lib")

static const GUID kWinUsbGuid = { 0xdee824ef, 0x729b, 0x4a0e, { 0x9c, 0x14, 0xb7, 0x11, 0x7d, 0x33, 0xa8, 0x17 } };

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

static void try_open(const std::string& label, const std::wstring& path) {
    struct Mode { const char* name; DWORD access; DWORD share; DWORD flags; };
    Mode modes[] = {
        { "RW|overlapped",   GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED },
        { "RW|plain",        GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL },
        { "W|plain",         GENERIC_WRITE,                FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL },
        { "R|plain",         GENERIC_READ,                 FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL },
        { "0|plain",         0,                             FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL },
    };
    printf("  [%s] %s\n", label.c_str(), narrow(path.c_str()).c_str());
    for (auto& m : modes) {
        HANDLE h = CreateFileW(path.c_str(), m.access, m.share, nullptr, OPEN_EXISTING, m.flags, nullptr);
        if (h == INVALID_HANDLE_VALUE) {
            printf("    %-16s FAIL err=%lu\n", m.name, GetLastError());
            continue;
        }
        WINUSB_INTERFACE_HANDLE wh = nullptr;
        BOOL ok = WinUsb_Initialize(h, &wh);
        printf("    %-16s open=OK WinUsb_Initialize=%s err=%lu", m.name, ok ? "OK" : "FAIL", GetLastError());
        if (ok) {
            WINUSB_SETUP_PACKET sp{};
            sp.RequestType = 0xC0; sp.Request = 51; sp.Length = 2;
            unsigned char proto[2] = { 0, 0 };
            ULONG got = 0;
            BOOL tr = WinUsb_ControlTransfer(wh, sp, proto, 2, &got, nullptr);
            printf(" GET_PROTOCOL=%s ver=%u.%u", tr ? "OK" : "FAIL", proto[0], proto[1]);
            WinUsb_Free(wh);
        }
        printf("\n");
        CloseHandle(h);
    }
}

int main() {
    const wchar_t* insts[] = {
        L"USB\\VID_2717&PID_FF48&MI_01\\9&ECA604F&1&0001",
        L"USB\\VID_2717&PID_FF40\\B3CF0C91",
    };
    const char* labels[] = { "FF48-MI_01(ADB)", "FF40-Mi10" };
    for (int i = 0; i < 2; i++) {
        ULONG len = 0;
        CM_Get_Device_Interface_List_SizeW(&len, (LPGUID)&kWinUsbGuid, (DEVINSTID_W)insts[i], CM_GET_DEVICE_INTERFACE_LIST_PRESENT);
        printf("=== %s iface-list-size=%lu\n", labels[i], len);
        if (len <= 1) continue;
        std::vector<wchar_t> buf(len);
        if (CM_Get_Device_Interface_ListW((LPGUID)&kWinUsbGuid, (DEVINSTID_W)insts[i], buf.data(), len,
                                          CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS) continue;
        for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) try_open(labels[i], p);
    }
    // 是否有提权
    HANDLE tok = nullptr;
    printf("\n进程提权状态探测: ");
    printf("IsUserAnAdmin=");
    // IsUserAnAdmin 链接需要 shell32；直接查 token elevation 更稳
    TOKEN_ELEVATION te{};
    DWORD n = 0;
    HANDLE hTok = nullptr;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hTok)) {
        TOKEN_ELEVATION_TYPE tet{};
        if (GetTokenInformation(hTok, TokenElevationType, &tet, sizeof tet, &n)) printf("type=%d ", tet);
        if (GetTokenInformation(hTok, TokenElevation, &te, sizeof te, &n)) printf("elevated=%d", te.TokenIsElevated);
        CloseHandle(hTok);
    }
    printf("\n");
    return 0;
}
