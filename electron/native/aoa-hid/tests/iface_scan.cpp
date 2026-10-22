// iface_scan.cpp — 扫描某复合设备子接口暴露的全部设备接口类 GUID 与路径（P2 定案用）
#include <windows.h>
#include <cfgmgr32.h>
#include <cstdio>
#include <string>
#include <vector>

#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "advapi32.lib")

static std::string narrow(const wchar_t* s) {
    if (!s) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
    std::string o(n ? n - 1 : 0, '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s, -1, &o[0], n, nullptr, nullptr);
    return o;
}

// 枚举 HKLM\SYSTEM\CurrentControlSet\Control\DeviceClasses 下所有接口类 GUID
static std::vector<std::wstring> all_iface_classes() {
    std::vector<std::wstring> out;
    HKEY root = nullptr;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\Control\\DeviceClasses", 0,
                      KEY_ENUMERATE_SUB_KEYS | KEY_READ, &root) != ERROR_SUCCESS) return out;
    wchar_t name[256];
    DWORD idx = 0, len = 256;
    while (RegEnumKeyExW(root, idx++, name, &len, nullptr, nullptr, nullptr, nullptr) == ERROR_SUCCESS) {
        out.push_back(name);
        len = 256;
    }
    RegCloseKey(root);
    return out;
}

int main(int argc, char** argv) {
    const char* want = argc >= 2 ? argv[1] : "ff48";
    printf("=== 扫描所有设备接口类，匹配实例含 \"%s\" ===\n", want);
    std::wstring wwant;
    for (const char* p = want; *p; p++) wwant += (wchar_t)*p;
    for (auto& cls : all_iface_classes()) {
        // {GUID}
        std::wstring key = L"SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\" + cls;
        HKEY k = nullptr;
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, key.c_str(), 0, KEY_ENUMERATE_SUB_KEYS | KEY_READ, &k) != ERROR_SUCCESS) continue;
        wchar_t inst[1024];
        DWORD idx = 0, len = 1024;
        while (RegEnumKeyExW(k, idx++, inst, &len, nullptr, nullptr, nullptr, nullptr) == ERROR_SUCCESS) {
            len = 1024;
            std::string s = narrow(inst);
            std::string lower = s;
            for (auto& c : lower) c = (char)tolower((unsigned char)c);
            std::string w = want;
            for (auto& c : w) c = (char)tolower((unsigned char)c);
            if (lower.find(w) != std::string::npos) {
                printf("class=%s\n  instance=%s\n", narrow(cls.c_str()).c_str(), s.c_str());
            }
        }
        RegCloseKey(k);
    }
    return 0;
}
