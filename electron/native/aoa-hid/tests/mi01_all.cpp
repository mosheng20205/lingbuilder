// mi01_all.cpp — 枚举 FF48 MI_01 暴露的全部设备接口类路径，逐个尝试 CreateFile + WinUSB + AOA 控制传输
#include <windows.h>
#include <cfgmgr32.h>
#include <winusb.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "winusb.lib")
#pragma comment(lib, "advapi32.lib")

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}
static std::wstring widen(const std::string& s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
    std::wstring w(n ? n - 1 : 0, L'\0');
    if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &w[0], n);
    return w;
}

// HKLM\SYSTEM\CurrentControlSet\Control\DeviceClasses 下所有接口类
static std::vector<std::wstring> all_classes() {
    std::vector<std::wstring> out;
    HKEY root = nullptr;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\Control\\DeviceClasses", 0,
                      KEY_ENUMERATE_SUB_KEYS | KEY_READ, &root) != ERROR_SUCCESS) return out;
    wchar_t name[256]; DWORD idx = 0, len = 256;
    while (RegEnumKeyExW(root, idx++, name, &len, nullptr, nullptr, nullptr, nullptr) == ERROR_SUCCESS) {
        out.push_back(name); len = 256;
    }
    RegCloseKey(root);
    return out;
}

int main(int argc, char** argv) {
    const char* match = argc >= 2 ? argv[1] : "MI_01";
    printf("=== 扫描与 \"%s\" 相关的接口（同时尝试 CreateFile + WinUSB + GET_PROTOCOL）===\n", match);
    std::string m = match; for (auto& c : m) c = (char)tolower((unsigned char)c);
    for (auto& cls : all_classes()) {
        std::wstring key = L"SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\" + cls;
        HKEY k = nullptr;
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, key.c_str(), 0, KEY_ENUMERATE_SUB_KEYS | KEY_READ, &k) != ERROR_SUCCESS) continue;
        wchar_t inst[1024]; DWORD idx = 0, len = 1024;
        while (RegEnumKeyExW(k, idx++, inst, &len, nullptr, nullptr, nullptr, nullptr) == ERROR_SUCCESS) {
            len = 1024;
            std::string s = narrow(inst), low = s;
            for (auto& c : low) c = (char)tolower((unsigned char)c);
            if (low.find(m) == std::string::npos) continue;
            printf("\n--- class=%s\n    inst=%s\n", narrow(cls.c_str()).c_str(), s.c_str());
            // s 形态：##?#USB#VID_...#{guid} → 转成 \\?\USB#...#{guid}
            std::string path = s;
            size_t p = path.find("USB#");
            if (p == std::string::npos) continue;
            path = "\\\\?\\" + path.substr(p);
            std::wstring wp = widen(path);
            HANDLE h = CreateFileW(wp.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                   nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED, nullptr);
            printf("    CreateFile=%s err=%lu", h == INVALID_HANDLE_VALUE ? "FAIL" : "OK", GetLastError());
            if (h == INVALID_HANDLE_VALUE) { printf("\n"); continue; }
            WINUSB_INTERFACE_HANDLE wh = nullptr;
            if (!WinUsb_Initialize(h, &wh)) { printf(" WinUsb_Initialize=FAIL err=%lu\n", GetLastError()); CloseHandle(h); continue; }
            printf(" WinUsb=OK");
            WINUSB_SETUP_PACKET sp{};
            sp.RequestType = 0xC0; sp.Request = 51; sp.Length = 2;
            unsigned char proto[2] = { 0, 0 };
            ULONG got = 0;
            BOOL tr = WinUsb_ControlTransfer(wh, sp, proto, 2, &got, nullptr);
            printf(" GET_PROTOCOL=%s got=%lu ver=%u.%u err=%lu\n", tr ? "OK" : "FAIL", got, proto[0], proto[1], GetLastError());
            WinUsb_Free(wh);
            CloseHandle(h);
        }
        RegCloseKey(k);
    }
    return 0;
}
