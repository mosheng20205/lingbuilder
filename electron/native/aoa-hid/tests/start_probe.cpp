// start_probe.cpp — 手动执行 AOA 切换各步并打印每步返回值（P4 现场诊断）
// 用法：start_probe.exe [vidpid] [sendStrings 0/1]
#include <libusb.h>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <chrono>

static std::string port_path_of(libusb_device* dev) {
    uint8_t path[8] = {0};
    int n = libusb_get_port_numbers(dev, path, sizeof path);
    std::string out; char buf[8];
    for (int i = 0; i < n; i++) { snprintf(buf, sizeof buf, "%s%d", i ? "." : "", path[i]); out += buf; }
    return out;
}

int main(int argc, char** argv) {
    unsigned vid = 0x2717, pid = 0xff48;
    if (argc >= 2) sscanf(argv[1], "%x:%x", &vid, &pid);
    bool send_strings = argc >= 3 ? atoi(argv[2]) != 0 : true;
    printf("target %04x:%04x sendStrings=%d\n", vid, pid, (int)send_strings);

    libusb_context* ctx = nullptr;
    libusb_init(&ctx);
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    libusb_device* target = nullptr;
    std::string port;
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        libusb_get_device_descriptor(list[i], &d);
        if (d.idVendor == vid && d.idProduct == pid) { target = list[i]; port = port_path_of(list[i]); break; }
    }
    if (!target) { printf("target not found\n"); return 1; }
    printf("found at port=%s\n", port.c_str());
    libusb_device_handle* h = nullptr;
    int r = libusb_open(target, &h);
    printf("open -> %d (%s)\n", r, libusb_error_name(r));
    if (r != 0) return 1;

    unsigned char proto[2] = {0, 0};
    int pr = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
    printf("GET_PROTOCOL -> %d ver=%u.%u\n", pr, proto[0], proto[1]);

    if (send_strings) {
        const char* ss[3] = { "LingBuilder", "AOACompanion", "1.0" };
        for (int i2 = 0; i2 < 3; i2++) {
            int sr = libusb_control_transfer(h, 0x40, 52, 0, (uint16_t)i2,
                                             (unsigned char*)ss[i2], (uint16_t)(strlen(ss[i2]) + 1), 1000);
            printf("SEND_STRING[%d] -> %d (%s)\n", i2, sr, libusb_error_name(sr));
        }
    }
    int st = libusb_control_transfer(h, 0x40, 53, 0, 0, nullptr, 0, 2000);
    printf("ACCESSORY_START -> %d (%s)\n", st, libusb_error_name(st));
    libusb_close(h);
    libusb_free_device_list(list, 1);

    // 轮询 25 秒，看配件节点是否出现（同端口）
    for (int t = 0; t < 50; t++) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
        libusb_device** l2 = nullptr;
        ssize_t n2 = libusb_get_device_list(ctx, &l2);
        for (ssize_t i = 0; i < n2; i++) {
            libusb_device_descriptor d{};
            libusb_get_device_descriptor(l2[i], &d);
            std::string p = port_path_of(l2[i]);
            if (d.idVendor == 0x18D1 && d.idProduct >= 0x2D00 && d.idProduct <= 0x2D05) {
                printf("[%4dms] 配件节点出现 %04x:%04x port=%s\n", (t + 1) * 500, d.idVendor, d.idProduct, p.c_str());
                libusb_device_handle* hh = nullptr;
                int orr = libusb_open(l2[i], &hh);
                printf("          open=%d(%s)\n", orr, libusb_error_name(orr));
                if (hh) libusb_close(hh);
                libusb_free_device_list(l2, 1);
                libusb_exit(ctx);
                return 0;
            }
            if (d.idVendor == vid && d.idProduct == pid && p == port && t == 499)
                printf("[%4dms] 手机节点仍在\n", (t + 1) * 500);
        }
        libusb_free_device_list(l2, 1);
    }
    printf("25 秒内未出现配件节点\n");
    libusb_exit(ctx);
    return 1;
}
