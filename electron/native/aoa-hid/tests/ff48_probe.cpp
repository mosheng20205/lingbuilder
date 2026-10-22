// ff48_probe.cpp — FF48 复合设备打开可行性探针（P2 定案用）
// 输出：每个匹配设备的总线/端口/VID:PID/类码/打开结果/配置与接口明细/控制传输 GET_PROTOCOL 结果
#include <libusb.h>
#include <cstdio>
#include <cstring>
#include <string>

static const char* adl(int speed) {
    switch (speed) {
        case LIBUSB_SPEED_LOW: return "low";
        case LIBUSB_SPEED_FULL: return "full";
        case LIBUSB_SPEED_HIGH: return "high";
        case LIBUSB_SPEED_SUPER: return "super";
        default: return "?";
    }
}

int main() {
    libusb_context* ctx = nullptr;
    int ir = libusb_init(&ctx);
    printf("libusb_init=%d api=0x%X\n", ir, LIBUSB_API_VERSION);
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    printf("device count=%ld\n", (long)n);
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        if (libusb_get_device_descriptor(list[i], &d) != 0) continue;
        if (d.idVendor != 0x2717 && d.idVendor != 0x18D1 && d.idVendor != 0x12D1) continue;
        uint8_t path[8] = {0};
        int pn = libusb_get_port_numbers(list[i], path, sizeof path);
        std::string pp;
        char tmp[8];
        for (int k = 0; k < pn; k++) { snprintf(tmp, sizeof tmp, "%s%d", k ? "." : "", path[k]); pp += tmp; }
        printf("\n=== bus=%d port=%s %04x:%04x class=%02x/%02x/%02x speed=%s\n",
               libusb_get_bus_number(list[i]), pp.c_str(), d.idVendor, d.idProduct,
               d.bDeviceClass, d.bDeviceSubClass, d.bDeviceProtocol, adl(libusb_get_device_speed(list[i])));
        libusb_device_handle* h = nullptr;
        int r = libusb_open(list[i], &h);
        printf("  libusb_open -> %d (%s)\n", r, libusb_error_name(r));
        if (h) {
            char ser[256] = {0}, mf[256] = {0}, pr[256] = {0};
            if (d.iSerialNumber) libusb_get_string_descriptor_ascii(h, d.iSerialNumber, (unsigned char*)ser, sizeof ser);
            if (d.iManufacturer) libusb_get_string_descriptor_ascii(h, d.iManufacturer, (unsigned char*)mf, sizeof mf);
            if (d.iProduct) libusb_get_string_descriptor_ascii(h, d.iProduct, (unsigned char*)pr, sizeof pr);
            printf("  serial=%s mf=%s prod=%s\n", ser, mf, pr);
            unsigned char proto[2] = {0, 0};
            int pr2 = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
            printf("  GET_PROTOCOL -> %d (%s) ver=%u.%u\n", pr2, libusb_error_name(pr2), proto[0], proto[1]);
            // 探测接口级控制传输：逐接口 claim 后发 GET_PROTOCOL（AOA 控制请求属设备级，接口 claim 只为诊断权限）
            libusb_config_descriptor* cfg = nullptr;
            if (libusb_get_active_config_descriptor(list[i], &cfg) == 0) {
                printf("  config: ifaces=%d\n", cfg->bNumInterfaces);
                for (int a = 0; a < cfg->bNumInterfaces; a++) {
                    const libusb_interface& ifc = cfg->interface[a];
                    for (int b = 0; b < ifc.num_altsetting; b++) {
                        const libusb_interface_descriptor& alt = ifc.altsetting[b];
                        printf("    iface %d alt %d class=%02x/%02x/%02x eps=%d",
                               alt.bInterfaceNumber, alt.bAlternateSetting,
                               alt.bInterfaceClass, alt.bInterfaceSubClass, alt.bInterfaceProtocol, alt.bNumEndpoints);
                        for (int e = 0; e < alt.bNumEndpoints; e++)
                            printf(" ep%02x(%s)", alt.endpoint[e].bEndpointAddress,
                                   (alt.endpoint[e].bmAttributes & 3) == 2 ? "bulk" :
                                   (alt.endpoint[e].bmAttributes & 3) == 3 ? "int" : "ctl");
                        int c = libusb_claim_interface(h, alt.bInterfaceNumber);
                        unsigned char p3[2] = {0, 0};
                        int pr3 = c == 0 ? libusb_control_transfer(h, 0xC0, 51, 0, 0, p3, 2, 800) : -999;
                        printf("  claim=%d(%s) GET_PROTOCOL_iface=%d ver=%u.%u\n",
                               c, libusb_error_name(c), pr3, p3[0], p3[1]);
                        if (c == 0) libusb_release_interface(h, alt.bInterfaceNumber);
                    }
                }
                libusb_free_config_descriptor(cfg);
            }
            libusb_close(h);
        }
    }
    libusb_free_device_list(list, 1);
    libusb_exit(ctx);
    return 0;
}
