// usbdk_probe.cpp — 验证未安装 UsbDk 时 LIBUSB_OPTION_USE_USBDK 的行为（新增分支的安全前提）
// 结论用途：模块只在「复合设备 + LIBUSB_ERROR_ACCESS」时才尝试 UsbDk 后端，必须确认
// 没装驱动时 set_option / get_device_list / open 都只是失败返回，不会崩、不会污染主上下文。
#include <libusb.h>
#include <cstdio>

int main() {
    printf("--- 主上下文（默认后端）---\n");
    libusb_context* ctx = nullptr;
    printf("init=%d\n", libusb_init(&ctx));
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    printf("default get_device_list=%ld\n", (long)n);
    libusb_free_device_list(list, 1);
    libusb_exit(ctx);

    printf("--- UsbDk 上下文 ---\n");
    libusb_context* dctx = nullptr;
    printf("init=%d\n", libusb_init(&dctx));
    int rc = libusb_set_option(dctx, LIBUSB_OPTION_USE_USBDK);
    printf("set_option(USE_USBDK)=%d (%s)\n", rc, libusb_error_name(rc));
    ssize_t dn = libusb_get_device_list(dctx, &list);
    printf("usbdk get_device_list=%ld", (long)dn);
    int opened = 0, failed = 0;
    if (dn > 0) {
        for (ssize_t i = 0; i < dn; i++) {
            libusb_device_descriptor d{};
            if (libusb_get_device_descriptor(list[i], &d) != 0) continue;
            if (d.idVendor != 0x2717 && d.idVendor != 0x18D1) continue;
            libusb_device_handle* h = nullptr;
            int r = libusb_open(list[i], &h);
            printf(" [%04x:%04x open=%d(%s)]", d.idVendor, d.idProduct, r, libusb_error_name(r));
            if (r == 0) { opened++; libusb_close(h); } else failed++;
        }
        libusb_free_device_list(list, 1);
    }
    printf("\nphone opened=%d failed=%d\n", opened, failed);
    libusb_exit(dctx);
    printf("survived\n");
    return 0;
}
