// devnode_ctl.cpp — 用 SetupAPI 对设备树节点做 disable/enable/restart，触发父复合设备重新枚举子接口
// 用法：devnode_ctl.exe <instanceId> disable|enable|restart|remove
#include <windows.h>
#include <setupapi.h>
#include <newdev.h>
#include <cfgmgr32.h>
#include <cstdio>
#include <string>

#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "cfgmgr32.lib")
#pragma comment(lib, "newdev.lib")

static std::wstring widen(const char* s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0);
    std::wstring w(n ? n - 1 : 0, L'\0');
    if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s, -1, &w[0], n);
    return w;
}

static HDEVINFO open_set() {
    return SetupDiGetClassDevsW(nullptr, nullptr, nullptr, DIGCF_ALLCLASSES | DIGCF_PRESENT);
}

static bool change_state(const std::wstring& inst, DWORD state) {
    HDEVINFO set = open_set();
    if (set == INVALID_HANDLE_VALUE) return false;
    SP_DEVINFO_DATA info{};
    info.cbSize = sizeof info;
    bool ok = false;
    for (DWORD i = 0;; i++) {
        info.cbSize = sizeof info;
        if (!SetupDiEnumDeviceInfo(set, i, &info)) break;
        wchar_t id[1024] = {0};
        if (!SetupDiGetDeviceInstanceIdW(set, &info, id, 1024, nullptr)) continue;
        if (_wcsicmp(id, inst.c_str()) != 0) continue;
        SP_PROPCHANGE_PARAMS pcp{};
        pcp.ClassInstallHeader.cbSize = sizeof pcp.ClassInstallHeader;
        pcp.ClassInstallHeader.InstallFunction = DIF_PROPERTYCHANGE;
        pcp.StateChange = state;
        pcp.Scope = DICS_FLAG_GLOBAL;
        pcp.HwProfile = 0;
        ok = SetupDiSetClassInstallParamsW(set, &info, &pcp.ClassInstallHeader, sizeof pcp)
             && SetupDiCallClassInstaller(DIF_PROPERTYCHANGE, set, &info);
        printf("  change_state(%s) state=%lu -> %s err=%lu\n",
               std::string(id, id + wcslen(id)).c_str(), state, ok ? "OK" : "FAIL", GetLastError());
        break;
    }
    SetupDiDestroyDeviceInfoList(set);
    return ok;
}

int main(int argc, char** argv) {
    if (argc < 3) { printf("用法: devnode_ctl.exe <instanceId> disable|enable|restart|reenum\n"); return 2; }
    std::wstring inst = widen(argv[1]);
    std::wstring action = widen(argv[2]);
    printf("target=%s action=%s\n", argv[1], argv[2]);
    if (action == L"disable") return change_state(inst, DICS_DISABLE) ? 0 : 1;
    if (action == L"enable") return change_state(inst, DICS_ENABLE) ? 0 : 1;
    if (action == L"reenum") {
        // CM_Reenumerate_DevNode：让 PnP 管理器重新枚举该节点及其子节点（恢复被 /remove-device 删掉的子功能）
        DEVINST dev = 0;
        std::wstring id = inst;
        CONFIGRET cr = CM_Locate_DevNodeW(&dev, (DEVINSTID_W)id.c_str(), CM_LOCATE_DEVNODE_PHANTOM);
        if (cr != CR_SUCCESS) cr = CM_Locate_DevNodeW(&dev, (DEVINSTID_W)id.c_str(), CM_LOCATE_DEVNODE_NORMAL);
        printf("  CM_Locate_DevNode -> %lu\n", cr);
        if (cr != CR_SUCCESS) return 1;
        cr = CM_Reenumerate_DevNode(dev, CM_REENUMERATE_SYNCHRONOUS);
        printf("  CM_Reenumerate_DevNode -> %lu\n", cr);
        return cr == CR_SUCCESS ? 0 : 1;
    }
    if (action == L"restart") {
        // DICS_PROPCHANGE 触发重新启动（等同 卸载+重装 驱动栈），复合父节点会重新枚举子功能
        bool ok = change_state(inst, DICS_PROPCHANGE);
        if (!ok) { change_state(inst, DICS_DISABLE); Sleep(500); ok = change_state(inst, DICS_ENABLE); }
        return ok ? 0 : 1;
    }
    printf("未知动作\n");
    return 2;
}
