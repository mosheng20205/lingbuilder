// start_probe2.cpp — 识别串组合实验：参数=索引掩码位0..5
// 用法：start_probe2.exe <vid:pid> <mask hex> 例如 3F=发0..5, 27=发0,1,2,5
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
    unsigned vid = 0x12d1, pid = 0x107e;
    if (argc >= 2) sscanf(argv[1], "%x:%x", &vid, &pid);
    unsigned mask = argc >= 3 ? (unsigned)strtoul(argv[2], nullptr, 16) : 0x07;
    const char* ss[6] = { "LingBuilder", "AOACompanion", "1.0", "1.0", "", "PQY0221113016888" };
    printf("target %04x:%04x mask=0x%02X (idx:", vid, pid, mask);
    for (int i = 0; i < 6; i++) if (mask & (1u << i)) printf(" %d", i);
    printf(" )\n");

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
    libusb_device_handle* h = nullptr;
    int r = libusb_open(target, &h);
    printf("open -> %d\n", r);
    if (r != 0) return 1;
    unsigned char proto[2] = {0, 0};
    int pr = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
    printf("GET_PROTOCOL -> %d ver=%u.%u\n", pr, proto[0], proto[1]);
    for (int i = 0; i < 6; i++) {
        if (!(mask & (1u << i)) || ss[i][0] == '\0') continue;
        int sr = libusb_control_transfer(h, 0x40, 52, 0, (uint16_t)i,
                                         (unsigned char*)ss[i], (uint16_t)(strlen(ss[i]) + 1), 1000);
        printf("SEND_STRING[%d] -> %d bytes%s\n", i, sr, sr < 0 ? " (ERR)" : "");
    }
    int st = libusb_control_transfer(h, 0x40, 53, 0, 0, nullptr, 0, 2000);
    printf("ACCESSORY_START -> %d\n", st);
    libusb_close(h);
    libusb_free_device_list(list, 1);
    for (int t = 0; t < 30; t++) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
        libusb_device** l2 = nullptr;
        ssize_t n2 = libusb_get_device_list(ctx, &l2);
        for (ssize_t i = 0; i < n2; i++) {
            libusb_device_descriptor d{};
            libusb_get_device_descriptor(l2[i], &d);
            if (d.idVendor == 0x18D1 && d.idProduct >= 0x2D00 && d.idProduct <= 0x2D05) {
                printf("[%4dms] SWITCHED %04x:%04x port=%s\n", (t + 1) * 500, d.idVendor, d.idProduct, port_path_of(l2[i]).c_str());
                libusb_free_device_list(l2, 1); libusb_exit(ctx);
                return 0;
            }
        }
        libusb_free_device_list(l2, 1);
    }
    printf("15 秒内未切换\n");
    libusb_exit(ctx);
    return 1;
}
