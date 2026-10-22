// AOA HID spike 探针：枚举 libusb 设备，查询 AOA 协议版本，可触发配件模式并注入触摸 HID 事件。
// 用法：
//   probe.exe                          只读探测（列出手机/配件设备 + GET_PROTOCOL）
//   probe.exe --start <serial>         对序列号匹配的手机发送 ACCESSORY_START
//   probe.exe --tap <serial> <x> <y>   确保进入配件模式后注册单点触摸 HID，并在逻辑坐标 (0~32767) 处点击一次
#include <libusb.h>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <thread>
#include <chrono>

static const char* errname(int r) { return libusb_error_name(r); }

static bool read_string(libusb_device_handle* h, uint8_t index, char* out, size_t outlen) {
    if (!index) return false;
    return libusb_get_string_descriptor_ascii(h, index, (unsigned char*)out, (int)outlen) >= 0;
}

// 官方 AOAv2 示例同构的单点触摸屏描述符：Tip Switch + In Range + X/Y(0~32767)，报告 5 字节。
static const unsigned char kTouchDesc[] = {
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x04,       // USAGE (Touch Screen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x09, 0x22,       //   COLLECTION (Physical)
    0x09, 0x42,       //     USAGE (Tip Switch)
    0x15, 0x00,       //     LOGICAL_MINIMUM (0)
    0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //     REPORT_SIZE (1)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x32,       //     USAGE (In Range)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x95, 0x06,       //     REPORT_COUNT (6)
    0x81, 0x03,       //     INPUT (Const,Var,Abs)
    0x05, 0x01,       //     USAGE_PAGE (Generic Desktop)
    0x09, 0x30,       //     USAGE (X)
    0x26, 0xff, 0x7f, //     LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //     REPORT_SIZE (16)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x31,       //     USAGE (Y)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0xc0,             //   END_COLLECTION
    0xc0              // END_COLLECTION
};

struct Found {
    libusb_device* device = nullptr;
    bool accessory = false;
};

static bool is_accessory_pid(uint16_t pid) { return pid >= 0x2D00 && pid <= 0x2D05; }

static void port_path_of(libusb_device* dev, std::string& out) {
    uint8_t path[8] = {0};
    int n = libusb_get_port_numbers(dev, path, sizeof path);
    char buf[64] = {0};
    for (int i = 0; i < n; i++) snprintf(buf + strlen(buf), sizeof buf - strlen(buf), "%s%d", i ? "." : "", path[i]);
    out = buf;
}

// 找序列号匹配的手机（2717）或配件设备（18D1:2D0x）；配件模式按同总线同端口优先匹配（无驱动也能定位）。
static bool find_device(libusb_context* ctx, const std::string& serial, Found& found) {
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    std::string want_path;
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        libusb_get_device_descriptor(list[i], &d);
        if (d.idVendor == 0x2717 || (d.idVendor == 0x18D1 && d.idProduct >= 0x4EE0 && d.idProduct <= 0x4EFF)
            || (d.idVendor == 0x18D1 && is_accessory_pid(d.idProduct))) {
            libusb_device_handle* h = nullptr;
            char ser[256] = {0};
            if (libusb_open(list[i], &h) == 0) {
                read_string(h, d.iSerialNumber, ser, sizeof ser);
                libusb_close(h);
            }
            if (!serial.empty() && serial != ser && serial != "any") continue;
            std::string path;
            port_path_of(list[i], path);
            bool acc = d.idVendor == 0x18D1;
            if (acc && !want_path.empty() && path != want_path) continue; // 同一物理口的配件设备优先
            if (acc && want_path.empty()) want_path = path;
            found.device = list[i];
            found.accessory = acc;
            libusb_ref_device(found.device); // 抵消 free_device_list(unref=1)，供调用方继续使用
            if (acc) break;
        }
    }
    libusb_free_device_list(list, 1);
    return found.device != nullptr;
}

static int send_event(libusb_device_handle* h, int accessory_id, const unsigned char* report, int len) {
    return libusb_control_transfer(h, 0x40, 57, (uint16_t)accessory_id, 0,
                                   const_cast<unsigned char*>(report), (uint16_t)len, 1000);
}

static int emit_report(libusb_device_handle* h, unsigned char flags, int x, int y) {
    unsigned char report[5];
    report[0] = flags;
    report[1] = (unsigned char)(x & 0xff); report[2] = (unsigned char)(x >> 8);
    report[3] = (unsigned char)(y & 0xff); report[4] = (unsigned char)(y >> 8);
    int rr = send_event(h, 1, report, 5);
    if (rr < 0) printf("    SEND_HID_EVENT(flags=%u) 失败: %s\n", flags, errname(rr));
    return rr;
}

static int register_touch(libusb_device_handle* h) {
    // 注册 HID 设备 id=1，wIndex = 描述符总长（AOA 规范要求）。
    int desc_len = (int)sizeof kTouchDesc;
    int r = libusb_control_transfer(h, 0x40, 54, 1, (uint16_t)desc_len, nullptr, 0, 1000);
    if (r < 0) { printf("    REGISTER_HID 失败: %s\n", errname(r)); return r; }

    // 分包发送描述符（按 ep0 包长；描述符小于包长时一次发完）。
    libusb_device_descriptor dd{};
    libusb_get_device_descriptor(libusb_get_device(h), &dd);
    int chunk = dd.bMaxPacketSize0 > 0 ? dd.bMaxPacketSize0 : 64;
    for (int off = 0; off < desc_len; off += chunk) {
        int n = desc_len - off < chunk ? desc_len - off : chunk;
        r = libusb_control_transfer(h, 0x40, 56, 1, (uint16_t)off,
                                    const_cast<unsigned char*>(kTouchDesc + off), (uint16_t)n, 1000);
        if (r < 0) { printf("    SET_HID_REPORT_DESC(offset=%d) 失败: %s\n", off, errname(r)); return r; }
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
    return 0;
}

static int tap_once(libusb_device_handle* h, int x, int y) {
    int r = register_touch(h);
    if (r) return r;
    emit_report(h, 0x00, x, y); // 先发一帧“无接触”，建立干净基线
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    if (emit_report(h, 0x03, x, y) < 0) return -1; // Tip Switch=1 + In Range=1，手指按下
    std::this_thread::sleep_for(std::chrono::milliseconds(80));
    if (emit_report(h, 0x00, x, y) < 0) return -1; // 抬起
    return 0;
}

static int drag_once(libusb_device_handle* h, int x1, int y1, int x2, int y2) {
    int r = register_touch(h);
    if (r) return r;
    emit_report(h, 0x00, x1, y1);
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    if (emit_report(h, 0x03, x1, y1) < 0) return -1; // 按下
    const int steps = 25;
    for (int s = 1; s <= steps; s++) {
        int x = x1 + (int)((long long)(x2 - x1) * s / steps);
        int y = y1 + (int)((long long)(y2 - y1) * s / steps);
        if (emit_report(h, 0x03, x, y) < 0) return -1; // 手指移动
        std::this_thread::sleep_for(std::chrono::milliseconds(12));
    }
    if (emit_report(h, 0x00, x2, y2) < 0) return -1; // 抬起
    return 0;
}

// 教科书级 Boot 协议鼠标描述符（按钮3 + 相对X/Y，报告 4 字节），用于判定 HID→输入路径是否可用。
static const unsigned char kMouseDesc[] = {
    0x05, 0x01,       // USAGE_PAGE (Generic Desktop)
    0x09, 0x02,       // USAGE (Mouse)
    0xa1, 0x01,       // COLLECTION (Application)
    0x09, 0x01,       //   USAGE (Pointer)
    0xa1, 0x00,       //   COLLECTION (Physical)
    0x05, 0x09,       //     USAGE_PAGE (Button)
    0x19, 0x01,       //     USAGE_MINIMUM (Button 1)
    0x29, 0x03,       //     USAGE_MAXIMUM (Button 3)
    0x15, 0x00,       //     LOGICAL_MINIMUM (0)
    0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
    0x95, 0x03,       //     REPORT_COUNT (3)
    0x75, 0x01,       //     REPORT_SIZE (1)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x75, 0x05,       //     REPORT_SIZE (5)
    0x81, 0x03,       //     INPUT (Const,Var,Abs) 填充
    0x05, 0x01,       //     USAGE_PAGE (Generic Desktop)
    0x09, 0x30,       //     USAGE (X)
    0x09, 0x31,       //     USAGE (Y)
    0x15, 0x81,       //     LOGICAL_MINIMUM (-127)
    0x25, 0x7f,       //     LOGICAL_MAXIMUM (127)
    0x75, 0x08,       //     REPORT_SIZE (8)
    0x95, 0x02,       //     REPORT_COUNT (2)
    0x81, 0x06,       //     INPUT (Data,Var,Rel)
    0xc0,             //   END_COLLECTION
    0xc0              // END_COLLECTION
};

// MT 协议 B 多点触控描述符（1 触点起步，带 Contact Identifier + Contact Count），报告 6 字节。
static const unsigned char kTouchMtDesc[] = {
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x04,       // USAGE (Touch Screen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x09, 0x22,       //   COLLECTION (Physical)
    0x09, 0x42,       //     USAGE (Tip Switch)
    0x15, 0x00,       //     LOGICAL_MINIMUM (0)
    0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //     REPORT_SIZE (1)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x32,       //     USAGE (In Range)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x95, 0x06,       //     REPORT_COUNT (6)
    0x81, 0x03,       //     INPUT (Const,Var,Abs) 填充
    0x09, 0x51,       //     USAGE (Contact Identifier)
    0x75, 0x08,       //     REPORT_SIZE (8)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x05, 0x01,       //     USAGE_PAGE (Generic Desktop)
    0x26, 0xff, 0x7f, //     LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //     REPORT_SIZE (16)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x09, 0x30,       //     USAGE (X)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x31,       //     USAGE (Y)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0xc0              // END_COLLECTION (Application)
};

// V3：带 Report ID 的 MT 触摸描述符（报告 7 字节：ID + 原有 6 字节）。
static const unsigned char kTouchMtDescRid[] = {
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x04,       // USAGE (Touch Screen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x85, 0x01,       //   REPORT_ID (1)
    0x09, 0x42,       //   USAGE (Tip Switch)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x25, 0x01,       //   LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //   REPORT_SIZE (1)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x09, 0x32,       //   USAGE (In Range)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x95, 0x06,       //   REPORT_COUNT (6)
    0x81, 0x03,       //   INPUT (Const,Var,Abs) 填充
    0x09, 0x51,       //   USAGE (Contact Identifier)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x05, 0x01,       //   USAGE_PAGE (Generic Desktop)
    0x26, 0xff, 0x7f, //   LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //   REPORT_SIZE (16)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x09, 0x30,       //   USAGE (X)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x09, 0x31,       //   USAGE (Y)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0xc0              // END_COLLECTION
};

// V4：无 ID 但带 Contact Count FEATURE 的平衡版（hid-multitouch 经典要求）。
static const unsigned char kTouchMtDescFeat[] = {
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x04,       // USAGE (Touch Screen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x09, 0x42,       //   USAGE (Tip Switch)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x25, 0x01,       //   LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //   REPORT_SIZE (1)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x09, 0x32,       //   USAGE (In Range)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x95, 0x06,       //   REPORT_COUNT (6)
    0x81, 0x03,       //   INPUT (Const,Var,Abs) 填充
    0x09, 0x51,       //   USAGE (Contact Identifier)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x05, 0x01,       //   USAGE_PAGE (Generic Desktop)
    0x26, 0xff, 0x7f, //   LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //   REPORT_SIZE (16)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x09, 0x30,       //   USAGE (X)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x09, 0x31,       //   USAGE (Y)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x05, 0x0d,       //   USAGE_PAGE (Digitizers)
    0x09, 0x55,       //   USAGE (Contact Count)
    0x25, 0x08,       //   LOGICAL_MAXIMUM (8)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0xb1, 0x02,       //   FEATURE (Data,Var,Abs)
    0xc0              // END_COLLECTION
};

static int unregister_hid_id(libusb_device_handle* h, int accessory_id) {
    int r = libusb_control_transfer(h, 0x40, 55, (uint16_t)accessory_id, 0, nullptr, 0, 1000);
    return r < 0 ? r : 0; // 未注册时失败忽略
}

static int send_mt_report(libusb_device_handle* h, int accessory_id, unsigned char tip_inrange,
                          unsigned char contact_id, int x, int y) {
    unsigned char report[6] = { tip_inrange, contact_id,
                                (unsigned char)(x & 0xff), (unsigned char)(x >> 8),
                                (unsigned char)(y & 0xff), (unsigned char)(y >> 8) };
    int rr = libusb_control_transfer(h, 0x40, 57, (uint16_t)accessory_id, 0, report, 6, 1000);
    if (rr < 0) printf("    SEND_HID_EVENT(MT) 失败: %s\n", errname(rr));
    return rr;
}

static int register_desc(libusb_device_handle* h, int accessory_id, const unsigned char* desc, int desc_len) {
    int r = libusb_control_transfer(h, 0x40, 54, (uint16_t)accessory_id, (uint16_t)desc_len, nullptr, 0, 1000);
    if (r < 0) { printf("    REGISTER_HID(id=%d) 失败: %s\n", accessory_id, errname(r)); return r; }
    libusb_device_descriptor dd{};
    libusb_get_device_descriptor(libusb_get_device(h), &dd);
    int chunk = dd.bMaxPacketSize0 > 0 ? dd.bMaxPacketSize0 : 64;
    for (int off = 0; off < desc_len; off += chunk) {
        int n = desc_len - off < chunk ? desc_len - off : chunk;
        r = libusb_control_transfer(h, 0x40, 56, (uint16_t)accessory_id, (uint16_t)off,
                                    const_cast<unsigned char*>(desc + off), (uint16_t)n, 1000);
        if (r < 0) { printf("    SET_HID_REPORT_DESC(id=%d offset=%d) 失败: %s\n", accessory_id, off, errname(r)); return r; }
    }
    return 0;
}

static int touch_mt_once(libusb_device_handle* h, int x1, int y1, int x2, int y2) {
    // LB_TOUCH_V 选择变体：plain=当前无 ID 版(id=3)，rid=带 Report ID(id=4)，feat=带 Contact Count FEATURE(id=5)。
    // LB_SKIP_REG=1 时跳过重注册，复用已挂载稳定的输入设备。
    const char* v = getenv("LB_TOUCH_V");
    int acc_id = 3;
    const unsigned char* desc = kTouchMtDesc;
    int desc_len = (int)sizeof kTouchMtDesc;
    bool use_rid = false;
    if (v && !strcmp(v, "rid")) { acc_id = 4; desc = kTouchMtDescRid; desc_len = (int)sizeof kTouchMtDescRid; use_rid = true; }
    else if (v && !strcmp(v, "feat")) { acc_id = 5; desc = kTouchMtDescFeat; desc_len = (int)sizeof kTouchMtDescFeat; }

    if (!getenv("LB_SKIP_REG")) {
        unregister_hid_id(h, acc_id);
        int r = register_desc(h, acc_id, desc, desc_len);
        if (r) return r;
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
    }

    unsigned char rep[8];
    auto emit = [&](unsigned char tip_inrange, unsigned char cid, int x, int y) {
        int n = 0;
        if (use_rid) rep[n++] = 1;
        rep[n++] = tip_inrange; rep[n++] = cid;
        rep[n++] = (unsigned char)(x & 0xff); rep[n++] = (unsigned char)(x >> 8);
        rep[n++] = (unsigned char)(y & 0xff); rep[n++] = (unsigned char)(y >> 8);
        int rr = libusb_control_transfer(h, 0x40, 57, (uint16_t)acc_id, 0, rep, (uint16_t)n, 1000);
        if (rr < 0) printf("    SEND_HID_EVENT(id=%d) 失败: %s\n", acc_id, errname(rr));
        return rr;
    };

    emit(0x00, 0, x1, y1); // 无接触基线帧
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    if (emit(0x03, 0, x1, y1) < 0) return -1; // 按下
    const int steps = 25;
    for (int s = 1; s <= steps; s++) {
        int x = x1 + (int)((long long)(x2 - x1) * s / steps);
        int y = y1 + (int)((long long)(y2 - y1) * s / steps);
        if (emit(0x03, 0, x, y) < 0) return -1; // 移动
        std::this_thread::sleep_for(std::chrono::milliseconds(12));
    }
    if (emit(0x00, 0, x2, y2) < 0) return -1; // 抬起
    return 0;
}

static int send_mouse_event(libusb_device_handle* h, int accessory_id, int buttons, int dx, int dy) {
    unsigned char report[4] = { (unsigned char)buttons, (unsigned char)dx, (unsigned char)dy, 0 };
    int rr = libusb_control_transfer(h, 0x40, 57, (uint16_t)accessory_id, 0, report, 3, 1000);
    if (rr < 0) printf("    SEND_HID_EVENT(mouse) 失败: %s\n", errname(rr));
    return rr;
}

static int mouse_once(libusb_device_handle* h, int dx, int dy) {
    int desc_len = (int)sizeof kMouseDesc;
    int r = libusb_control_transfer(h, 0x40, 54, 2, (uint16_t)desc_len, nullptr, 0, 1000);
    if (r < 0) { printf("    REGISTER_HID(id=2 mouse) 失败: %s\n", errname(r)); return r; }
    libusb_device_descriptor dd{};
    libusb_get_device_descriptor(libusb_get_device(h), &dd);
    int chunk = dd.bMaxPacketSize0 > 0 ? dd.bMaxPacketSize0 : 64;
    for (int off = 0; off < desc_len; off += chunk) {
        int n = desc_len - off < chunk ? desc_len - off : chunk;
        r = libusb_control_transfer(h, 0x40, 56, 2, (uint16_t)off,
                                    const_cast<unsigned char*>(kMouseDesc + off), (uint16_t)n, 1000);
        if (r < 0) { printf("    SET_HID_REPORT_DESC(mouse offset=%d) 失败: %s\n", off, errname(r)); return r; }
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
    // 相对移动：分 20 步走完 (dx, dy)
    for (int s = 1; s <= 20; s++) {
        if (send_mouse_event(h, 2, 0, dx / 20, dy / 20) < 0) return -1;
        std::this_thread::sleep_for(std::chrono::milliseconds(15));
    }
    if (send_mouse_event(h, 2, 0, 0, 0) < 0) return -1;
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    if (send_mouse_event(h, 2, 1, 0, 0) < 0) return -1; // 左键按下
    std::this_thread::sleep_for(std::chrono::milliseconds(60));
    if (send_mouse_event(h, 2, 0, 0, 0) < 0) return -1; // 左键抬起
    return 0;
}

int main(int argc, char** argv) {
    std::string mode, serial;
    int x = 16384, y = 16384, x2 = 0, y2 = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--start") && i + 1 < argc) { mode = "start"; serial = argv[++i]; }
        else if (!strcmp(argv[i], "--tap") && i + 3 < argc) { mode = "tap"; serial = argv[++i]; x = atoi(argv[++i]); y = atoi(argv[++i]); }
        else if (!strcmp(argv[i], "--drag") && i + 5 < argc) { mode = "drag"; serial = argv[++i]; x = atoi(argv[++i]); y = atoi(argv[++i]); x2 = atoi(argv[++i]); y2 = atoi(argv[++i]); }
        else if (!strcmp(argv[i], "--mouse") && i + 3 < argc) { mode = "mouse"; serial = argv[++i]; x2 = atoi(argv[++i]); y2 = atoi(argv[++i]); }
        else if (!strcmp(argv[i], "--touch2") && i + 5 < argc) { mode = "touch2"; serial = argv[++i]; x = atoi(argv[++i]); y = atoi(argv[++i]); x2 = atoi(argv[++i]); y2 = atoi(argv[++i]); }
    }

    libusb_context* ctx = nullptr;
    int r = libusb_init(&ctx);
    if (r) { printf("libusb_init 失败: %s\n", errname(r)); return 1; }

    if (mode.empty()) {
        libusb_device** list = nullptr;
        ssize_t n = libusb_get_device_list(ctx, &list);
        printf("libusb 设备总数: %zd\n", n);
        for (ssize_t i = 0; i < n; i++) {
            libusb_device_descriptor d{};
            libusb_get_device_descriptor(list[i], &d);
            bool is_phone = d.idVendor == 0x2717 || (d.idVendor == 0x18D1 && d.idProduct >= 0x4EE0 && d.idProduct <= 0x4EFF); // 小米原生 VID 或 ADB 模式的 Google VID
            bool is_acc = d.idVendor == 0x18D1 && is_accessory_pid(d.idProduct);
            if (!is_phone && !is_acc) continue;
            printf("[%zd] %04x:%04x bus=%d port=%d%s\n", i, d.idVendor, d.idProduct,
                   libusb_get_bus_number(list[i]), libusb_get_port_number(list[i]), is_acc ? "  (AOA配件模式)" : "  (手机)");
            libusb_device_handle* h = nullptr;
            int rr = libusb_open(list[i], &h);
            if (rr) { printf("    libusb_open 失败: %s\n", errname(rr)); continue; }
            char man[256] = {0}, prod[256] = {0}, ser[256] = {0};
            read_string(h, d.iManufacturer, man, sizeof man);
            read_string(h, d.iProduct, prod, sizeof prod);
            read_string(h, d.iSerialNumber, ser, sizeof ser);
            printf("    厂商=\"%s\" 产品=\"%s\" 序列号=\"%s\"\n", man, prod, ser);
            unsigned char proto[2] = {0, 0};
            r = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
            if (r == 2) printf("    AOA 协议版本 = %d\n", proto[0] | (proto[1] << 8));
            else printf("    AOA_GET_PROTOCOL 失败: %s\n", errname(r));
            libusb_close(h);
        }
        libusb_free_device_list(list, 1);
        libusb_exit(ctx);
        return 0;
    }

    Found found{};
    if (!find_device(ctx, serial, found)) { printf("未找到序列号为 %s 的手机/配件设备。\n", serial.c_str()); return 1; }

    if (mode == "start") {
        libusb_device_handle* h = nullptr;
        if (libusb_open(found.device, &h)) { printf("libusb_open 失败\n"); return 1; }
        unsigned char proto[2] = {0, 0};
        r = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
        if (r != 2 || proto[0] < 2) { printf("协议版本校验失败: %s\n", r ? errname(r) : "版本<2"); libusb_close(h); return 1; }
        r = libusb_control_transfer(h, 0x40, 53, 0, 0, nullptr, 0, 2000);
        printf("ACCESSORY_START: %s\n", r ? errname(r) : "已发送");
        libusb_close(h);
    } else if (mode == "tap" || mode == "drag" || mode == "mouse" || mode == "touch2") {
        // 尚未处于配件模式时：查询协议 → START → 等待同端口出现 18D1:2D0x。
        if (!found.accessory) {
            libusb_device_handle* h = nullptr;
            if (libusb_open(found.device, &h)) { printf("libusb_open 失败\n"); return 1; }
            unsigned char proto[2] = {0, 0};
            r = libusb_control_transfer(h, 0xC0, 51, 0, 0, proto, 2, 1000);
            if (r != 2 || proto[0] < 2) { printf("协议版本校验失败\n"); libusb_close(h); return 1; }
            std::string path;
            port_path_of(found.device, path);
            r = libusb_control_transfer(h, 0x40, 53, 0, 0, nullptr, 0, 2000);
            libusb_close(h);
            if (r) { printf("ACCESSORY_START 失败: %s\n", errname(r)); return 1; }
            printf("ACCESSORY_START 已发送，等待重枚举（端口路径 %s）...\n", path.c_str());
            libusb_device* acc = nullptr;
            for (int tries = 0; tries < 50 && !acc; tries++) {
                std::this_thread::sleep_for(std::chrono::milliseconds(300));
                Found f{};
                if (find_device(ctx, serial, f) && f.accessory) acc = f.device;
                else if (f.device) libusb_unref_device(f.device);
            }
            if (!acc) { printf("等待配件设备超时（15 秒内未在同端口看到 18D1:2D0x）。\n"); return 1; }
            found.device = acc; found.accessory = true;
        }
        libusb_device_handle* h = nullptr;
        for (int tries = 1; !h && tries <= 10; tries++) {
            r = libusb_open(found.device, &h);
            if (r) { h = nullptr; std::this_thread::sleep_for(std::chrono::milliseconds(300)); }
        }
        if (!h) { printf("配件设备 libusb_open 失败: %s（重试 10 次仍失败；裸机无驱动场景，属段B 范围）\n", errname(r)); return 1; }
        int rr;
        if (mode == "tap") {
            printf("在逻辑坐标 (%d, %d) 注入一次点击...\n", x, y);
            rr = tap_once(h, x, y);
            printf(rr ? "点击注入失败。\n" : "点击注入完成：按下→抬起 各 1 帧。\n");
        } else if (mode == "drag") {
            printf("从 (%d, %d) 拖动到 (%d, %d)（25 步插值移动）...\n", x, y, x2, y2);
            rr = drag_once(h, x, y, x2, y2);
            printf(rr ? "拖动注入失败。\n" : "拖动注入完成：按下→25 步移动→抬起。\n");
        } else if (mode == "touch2") {
            printf("MT-B 描述符：从 (%d, %d) 拖动到 (%d, %d)...\n", x, y, x2, y2);
            rr = touch_mt_once(h, x, y, x2, y2);
            printf(rr ? "MT 触摸注入失败。\n" : "MT 触摸注入完成：按下→25 步移动→抬起。\n");
        } else {
            printf("注入鼠标移动 (%d, %d) + 左键点击（Boot 协议判定实验）...\n", x2, y2);
            rr = mouse_once(h, x2, y2);
            printf(rr ? "鼠标注入失败。\n" : "鼠标注入完成：20 步移动 + 单击。\n");
        }
        libusb_close(h);
        libusb_exit(ctx);
        return rr;
    }

    libusb_exit(ctx);
    return 0;
}
