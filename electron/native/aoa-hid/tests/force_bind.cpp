// force_bind.cpp — 把指定硬件 ID 的在线设备强制更新到指定 INF（等同设备管理器「更新驱动程序」）
// 用法：force_bind.exe <硬件ID> <INF 完整路径>
#include <windows.h>
#include <newdev.h>
#include <cstdio>
#include <string>

#pragma comment(lib, "newdev.lib")

static std::wstring widen(const char* s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0);
    std::wstring w(n ? n - 1 : 0, L'\0');
    if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s, -1, &w[0], n);
    return w;
}

int main(int argc, char** argv) {
    if (argc < 3) { printf("用法: force_bind.exe <硬件ID> <INF路径>\n"); return 2; }
    std::wstring hwid = widen(argv[1]);
    std::wstring inf = widen(argv[2]);
    printf("hardwareId=%s\ninf=%s\n", argv[1], argv[2]);
    BOOL reboot = FALSE;
    BOOL ok = UpdateDriverForPlugAndPlayDevicesW(nullptr, hwid.c_str(), inf.c_str(),
                                                INSTALLFLAG_FORCE, &reboot);
    printf("UpdateDriverForPlugAndPlayDevices -> %s reboot=%d err=%lu\n",
           ok ? "OK" : "FAIL", reboot, GetLastError());
    return ok ? 0 : 1;
}
