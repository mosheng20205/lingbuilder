// devnode_tree.cpp — 打印某设备节点的子节点树（诊断 usbccgp 是否还在报告 MI_01 功能）
#include <windows.h>
#include <cfgmgr32.h>
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

static void dump(DEVINST dev, int depth) {
    wchar_t id[MAX_DEVICE_ID_LEN] = {0};
    if (CM_Get_Device_IDW(dev, id, MAX_DEVICE_ID_LEN, 0) != CR_SUCCESS) return;
    ULONG status = 0, problem = 0;
    CM_Get_DevNode_Status(&status, &problem, dev, 0);
    printf("%*s%s status=0x%lx problem=%lu\n", depth * 2, "", narrow(id).c_str(), status, problem);
    DEVINST child = 0;
    CONFIGRET cr = CM_Get_Child(&child, dev, 0);
    while (cr == CR_SUCCESS) {
        dump(child, depth + 1);
        DEVINST sibling = 0;
        cr = CM_Get_Sibling(&sibling, child, 0);
        child = sibling;
    }
}

int main(int argc, char** argv) {
    const char* target = argc >= 2 ? argv[1] : "USB\\VID_2717&PID_FF48\\6929B744";
    std::wstring w;
    for (const char* p = target; *p; p++) w += (wchar_t)*p;
    DEVINST dev = 0;
    CONFIGRET cr = CM_Locate_DevNodeW(&dev, (DEVINSTID_W)w.c_str(), CM_LOCATE_DEVNODE_NORMAL);
    printf("locate(%s) -> %lu\n", target, cr);
    if (cr != CR_SUCCESS) return 1;
    dump(dev, 0);
    return 0;
}
