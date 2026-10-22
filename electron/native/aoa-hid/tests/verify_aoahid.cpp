// verify_aoahid.cpp — AOA 模块健壮性验收探针（桥接层，P1/P2/P3/P4 逐项验证）
// 用法：
//   verify list                         打印 AOA_取设备列表 原文（P3：可打开/需驱动 与幻影行）
//   verify open <序列号|vid:pid>        打开设备并计时（P2 FF48 诊断文案 / P4 切换重试）
//   verify pump <序列号> [秒数]          打开设备+数据通道后持续收帧并打心跳（P1 拔线存活）
#include "aoa_bridge.h"
#include "aoa_hid.h"

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <chrono>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#endif

static std::string u8(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string o((size_t)(n > 0 ? n : 0), '\0');
    if (n > 0) WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &o[0], n, nullptr, nullptr);
    return o;
}

static std::wstring wide(const char* s) {
    std::wstring w;
    for (const char* p = s; *p; ++p) w += (wchar_t)(unsigned char)*p;
    return w;
}

static long long now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

int main(int argc, char** argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
#endif
    std::string cmd = argc >= 2 ? argv[1] : "list";

    if (cmd == "list") {
        std::wstring list = AOA_取设备列表();
        printf("--- 设备列表（原样，| 分隔）---\n%s\n--- 行数=%d ---\n",
               u8(list).c_str(), (int)std::count(list.begin(), list.end(), L'\n') + (list.empty() ? 0 : 1));
        printf("err=%s\n", u8(AOA_取错误()).c_str());
        return 0;
    }

    if (cmd == "open" && argc >= 3) {
        long long t0 = now_ms();
        long long dev = AOA_打开设备(wide(argv[2]));
        long long dt = now_ms() - t0;
        if (!dev) {
            printf("open(%s) FAILED in %lldms\n错误：%s\n", argv[2], dt, u8(AOA_取错误()).c_str());
            return 1;
        }
        printf("open(%s) OK handle=%lld in %lldms\n", argv[2], dev, dt);
        printf("list after open:\n%s\n", u8(AOA_取设备列表()).c_str());
        AOA_关闭设备(dev);
        printf("closed\n");
        return 0;
    }

    if (cmd == "pump" && argc >= 3) {
        int seconds = argc >= 4 ? atoi(argv[3]) : 30;
        long long dev = AOA_打开设备(wide(argv[2]));
        if (!dev) { printf("open FAILED: %s\n", u8(AOA_取错误()).c_str()); return 1; }
        long long ch = AOA_打开数据通道(dev, 1500);
        if (!ch) { printf("channel FAILED: %s\n", u8(AOA_取错误()).c_str()); AOA_关闭设备(dev); return 1; }
        printf("pump start dev=%lld ch=%lld seconds=%d\n", dev, ch, seconds);
        long long t0 = now_ms();
        int frames = 0, empty = 0;
        std::wstring last_err;
        while ((now_ms() - t0) < (long long)seconds * 1000) {
            std::vector<unsigned char> f = AOA_数据通道收帧(ch, 200);
            if (f.empty()) {
                empty++;
                std::wstring e = AOA_取错误();
                if (!e.empty() && e != last_err) {
                    last_err = e;
                    printf("[%5lldms] 收帧失败：%s\n", now_ms() - t0, u8(e).c_str());
                }
            } else {
                frames++;
                if (frames % 30 == 1) printf("[%5lldms] 累计帧=%d 本帧=%d 字节\n", now_ms() - t0, frames, (int)f.size());
            }
            if ((now_ms() - t0) % 2000 < 220) fflush(stdout);
        }
        printf("pump end 累计帧=%d 空拍=%d 存活=是\n", frames, empty);
        AOA_关闭数据通道(ch);
        AOA_关闭设备(dev);
        printf("cleanup done\n");
        return 0;
    }


    if (cmd == "hold" && argc >= 3) {
        long long dev = AOA_打开设备(wide(argv[2]));
        if (!dev) { printf("open FAILED: %s\n", u8(AOA_取错误()).c_str()); return 1; }
        printf("open OK handle=%lld\n", dev);
        for (int i = 0; i < 3; i++) {
            printf("--- 第 %d 次列表（会话持有中）---\n%s\n", i + 1, u8(AOA_取设备列表()).c_str());
            printf("--- aoahid::list_devices 明细 ---\n");
            for (auto& d : aoahid::list_devices()) {
                std::string port;
                char buf[8];
                for (int k = 0; k < d.port_count; k++) { snprintf(buf, sizeof buf, "%s%d", k ? "." : "", d.port[k]); port += buf; }
                printf("  %04x:%04x bus=%u port=%-6s acc=%d driver_ok=%d serial=<%s> product=<%s>\n",
                       d.vid, d.pid, d.bus, port.c_str(), (int)d.accessory, (int)d.driver_ok,
                       d.serial.c_str(), d.product.c_str());
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1200));
        }
        printf("--- 关闭设备后列表 ---\n%s\n", u8(AOA_取设备列表()).c_str());
        AOA_关闭设备(dev);
        return 0;
    }

    printf("用法: verify list | verify open <序列号> | verify pump <序列号> [秒数]\n");
    return 2;
}
