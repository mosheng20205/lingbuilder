// aoa_hid_core.cpp — HID 描述符、多点触控状态机、键盘/鼠标报表与旋转坐标映射
#include "aoa_hid_internal.h"

#include <cstring>
#include <thread>
#include <chrono>

namespace aoahid {

namespace {

// V3 已验证形态：Report ID=1 的 MT-B 触摸屏（TipSwitch+InRange+填充+ContactID+X/Y16bit）。
// 多指采用“逐指报告”：每次报告携带一个触点，靠 Contact ID 区分手指（hid-multitouch 按轨迹 ID 分槽）。
const unsigned char kTouchDesc[] = {
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

// 标准 6 键无滚报键盘（Report ID=1；不声明 LED 输出报表，避免宿主 SET_REPORT 语义差异）
const unsigned char kKeyboardDesc[] = {
    0x05, 0x01,       // USAGE_PAGE (Generic Desktop)
    0x09, 0x06,       // USAGE (Keyboard)
    0xa1, 0x01,       // COLLECTION (Application)
    0x85, 0x01,       //   REPORT_ID (1)
    0x05, 0x07,       //   USAGE_PAGE (Keyboard/Keypad)
    0x19, 0xe0,       //   USAGE_MINIMUM (Left Control)
    0x29, 0xe7,       //   USAGE_MAXIMUM (Right GUI)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x25, 0x01,       //   LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //   REPORT_SIZE (1)
    0x95, 0x08,       //   REPORT_COUNT (8)
    0x81, 0x02,       //   INPUT (Data,Var,Abs) 修饰键位图
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x81, 0x03,       //   INPUT (Const,Var,Abs) 保留字节
    0x95, 0x06,       //   REPORT_COUNT (6)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x25, 0x65,       //   LOGICAL_MAXIMUM (101)
    0x05, 0x07,       //   USAGE_PAGE (Keyboard/Keypad)
    0x19, 0x00,       //   USAGE_MINIMUM (0)
    0x29, 0x65,       //   USAGE_MAXIMUM (101)
    0x81, 0x00,       //   INPUT (Data,Array,Abs) 键位槽
    0xc0              // END_COLLECTION
};

// Boot 鼠标 + 滚轮（Report ID=2；AC Pan 即垂直滚轮）
const unsigned char kMouseDesc[] = {
    0x05, 0x01,       // USAGE_PAGE (Generic Desktop)
    0x09, 0x02,       // USAGE (Mouse)
    0xa1, 0x01,       // COLLECTION (Application)
    0x85, 0x02,       //   REPORT_ID (2)
    0x09, 0x01,       //   USAGE (Pointer)
    0xa1, 0x00,       //   COLLECTION (Physical)
    0x05, 0x09,       //     USAGE_PAGE (Button)
    0x19, 0x01,       //     USAGE_MINIMUM (Button 1)
    0x29, 0x03,       //     USAGE_MAXIMUM (Button 3)
    0x15, 0x00,       //     LOGICAL_MINIMUM (0)
    0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //     REPORT_SIZE (1)
    0x95, 0x03,       //     REPORT_COUNT (3)
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
    0x05, 0x0c,       //     USAGE_PAGE (Consumer)
    0x09, 0x38,       //     USAGE (Wheel)
    0x15, 0x81,       //     LOGICAL_MINIMUM (-127)
    0x25, 0x7f,       //     LOGICAL_MAXIMUM (127)
    0x75, 0x08,       //     REPORT_SIZE (8)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x81, 0x06,       //     INPUT (Data,Var,Rel)
    0xc0,             //   END_COLLECTION
    0xc0              // END_COLLECTION
};

constexpr int kAccIdTouch = 1;   // 触摸 HID 的配件设备 ID
constexpr int kAccIdKeyboard = 2;
constexpr int kAccIdMouse = 3;
constexpr int kAccIdPen = 4;     // 1.1.0 压感笔（与手指触摸并存）
constexpr int kAccIdConsumer = 5; // 1.1.0 多媒体键（Consumer Page）

// 1.1.0 压感笔（Digitizers，Report ID=4）。字段顺序：Tip/In-Range 2bit + 6bit 填充 →
// Pressure(16bit, 0~32767) → Contact ID(8bit) → X/Y(16bit, 0~32767)。
// 集合结构：1 个 Application 集合（开闭严格平衡，手写描述符红线——集合不平衡会静默失败）。
// Application 用 Touch Screen(0x04) 而非 Pen(0x02)：MIUI 实测定案——Pen application 会被
// InputReader 走成 source=MOUSE 的 HOVER_MOVE 指针路径（绘画 App 不消费、画不出笔迹），
// Touch Screen application 则与手指同源直接入画板，且 ABS_MT_PRESSURE 压力轴完整保留。
// flags: 0x03=Tip+InRange（按下/移动），0x00=抬笔。
// 报告 9 字节：[04, flags, 压力L, 压力H, cid, xL, xH, yL, yH]。flags: bit0=Tip bit1=InRange；按下/移动=0x03，抬笔=0x00。
const unsigned char kPenDesc[] = {
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x04,       // USAGE (Touch Screen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x85, 0x04,       //   REPORT_ID (4)
    0x09, 0x42,       //   USAGE (Tip Switch)
    0x09, 0x32,       //   USAGE (In Range)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x25, 0x01,       //   LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //   REPORT_SIZE (1)
    0x95, 0x02,       //   REPORT_COUNT (2)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x95, 0x06,       //   REPORT_COUNT (6)
    0x81, 0x03,       //   INPUT (Const,Var,Abs) 填充
    0x09, 0x30,       //   USAGE (Pressure)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x26, 0xff, 0x7f, //   LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //   REPORT_SIZE (16)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x09, 0x51,       //   USAGE (Contact Identifier)
    0x75, 0x08,       //   REPORT_SIZE (8)
    0x95, 0x01,       //   REPORT_COUNT (1)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0x05, 0x01,       //   USAGE_PAGE (Generic Desktop)
    0x09, 0x30,       //   USAGE (X)
    0x09, 0x31,       //   USAGE (Y)
    0x15, 0x00,       //   LOGICAL_MINIMUM (0)
    0x26, 0xff, 0x7f, //   LOGICAL_MAXIMUM (32767)
    0x75, 0x10,       //   REPORT_SIZE (16)
    0x95, 0x02,       //   REPORT_COUNT (2)
    0x81, 0x02,       //   INPUT (Data,Var,Abs)
    0xc0              // END_COLLECTION
};

// 1.1.0 多媒体键（Consumer Page，Report ID=5，位图报表——Android 实测定案形态）。
// 一开始用「0~1023 数组报表」内核不产任何事件（usage 超 Linux KEY_MAX 或数组路径不吃）；
// 收到 0~767 也不行；位图形态（逐 usage 声明 Input 位）是安卓上经验证可用的经典写法。
// 报告 2 字节：[05, 位图L][+位图H]；位序=usage 声明序。
const unsigned char kConsumerDesc[] = {
    0x05, 0x0c,             // USAGE_PAGE (Consumer)
    0x09, 0x01,             // USAGE (Consumer Control)
    0xa1, 0x01,             // COLLECTION (Application)
    0x85, 0x05,             //   REPORT_ID (5)
    0x15, 0x00,             //   LOGICAL_MINIMUM (0)
    0x25, 0x01,             //   LOGICAL_MAXIMUM (1)
    0x09, 0xcd,             //   USAGE (Play/Pause)         bit0
    0x09, 0xe2,             //   USAGE (Mute)               bit1
    0x09, 0xe9,             //   USAGE (Volume Up)          bit2
    0x09, 0xea,             //   USAGE (Volume Down)        bit3
    0x09, 0xb5,             //   USAGE (Scan Next Track)    bit4
    0x09, 0xb6,             //   USAGE (Scan Previous Track) bit5
    0x09, 0xb7,             //   USAGE (Stop)               bit6
    0x0a, 0x23, 0x02,       //   USAGE (AC Home)            bit7
    0x0a, 0x24, 0x02,       //   USAGE (AC Back)            bit8
    0x75, 0x01,             //   REPORT_SIZE (1)
    0x95, 0x09,             //   REPORT_COUNT (9)
    0x81, 0x02,             //   INPUT (Data,Var,Abs)
    0x95, 0x07,             //   REPORT_COUNT (7)
    0x81, 0x03,             //   INPUT (Const,Var,Abs) 填充
    0xc0                    // END_COLLECTION
};

// 位图位序表：usage → bit。AOA_多媒体键 的键码即 Consumer usage，查表落位。
struct ConsumerBit { unsigned usage; int bit; };
const ConsumerBit kConsumerBits[] = {
    { 0xCD, 0 }, { 0xE2, 1 }, { 0xE9, 2 }, { 0xEA, 3 },
    { 0xB5, 4 }, { 0xB6, 5 }, { 0xB7, 6 }, { 0x223, 7 }, { 0x224, 8 },
};

thread_local const char* g_err = "";

// 加锁约定：全部对外入口持 s->hid_mutex；下列 ensure_*/send_* 均为无锁内部实现，
// 只允许在持锁环境下调用。type_text/unregister_touch 等内部级联也只调无锁版本。

int ensure_touch(SessionImpl* s) {
    if (s->touch_registered) return 0;
    unregister_hid_id(s, kAccIdTouch);
    int r = register_hid_desc(s, kAccIdTouch, kTouchDesc, (int)sizeof kTouchDesc);
    if (r < 0) { g_err = "注册触摸 HID 失败"; return r; }
    s->touch_registered = true;
    std::this_thread::sleep_for(std::chrono::milliseconds(500)); // 等待 Android 解析描述符并挂载输入设备
    // 发送一帧“无接触”基线报告，暖热 InputReader 对新设备的配置管线（否则首次触摸可能被丢弃）
    unsigned char base[7] = { 0x01, 0x00, 0, 0, 0, 0, 0 };
    send_event_raw(s, kAccIdTouch, base, 7);
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    return 0;
}

// 发送单指报告；x/y 已是原生域坐标。返回 0 成功，<0 失败（控制传输的正数字节数归一化为 0）。
int send_finger(SessionImpl* s, unsigned char tip_inrange, int contact_id, int nx, int ny) {
    unsigned char rep[7] = { 0x01, tip_inrange, (unsigned char)contact_id,
                             (unsigned char)(nx & 0xff), (unsigned char)(nx >> 8),
                             (unsigned char)(ny & 0xff), (unsigned char)(ny >> 8) };
    int r = send_event_raw(s, kAccIdTouch, rep, 7);
    if (r < 0) g_err = "触摸报告发送失败";
    return r < 0 ? r : 0;
}

void apply_rotation(SessionImpl* s, int x, int y, int* nx, int* ny) {
    transform(x, y, s->rotation, nx, ny); // 会话级旋转：触摸命令统一换算到原生面板坐标
}

int clamp_logic(int v) { return v < 0 ? 0 : (v > kLogicalMax ? kLogicalMax : v); }

int ensure_keyboard(SessionImpl* s) {
    if (s->kbd_registered) return 0;
    unregister_hid_id(s, kAccIdKeyboard);
    int r = register_hid_desc(s, kAccIdKeyboard, kKeyboardDesc, (int)sizeof kKeyboardDesc);
    if (r < 0) { g_err = "注册键盘 HID 失败"; return r; }
    s->kbd_registered = true;
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    return 0;
}

int ensure_mouse(SessionImpl* s) {
    if (s->mouse_registered) return 0;
    unregister_hid_id(s, kAccIdMouse);
    int r = register_hid_desc(s, kAccIdMouse, kMouseDesc, (int)sizeof kMouseDesc);
    if (r < 0) { g_err = "注册鼠标 HID 失败"; return r; }
    s->mouse_registered = true;
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    return 0;
}

int ensure_pen(SessionImpl* s) {
    if (s->pen_registered) return 0;
    unregister_hid_id(s, kAccIdPen);
    int r = register_hid_desc(s, kAccIdPen, kPenDesc, (int)sizeof kPenDesc);
    if (r < 0) { g_err = "注册压感笔 HID 失败"; return r; }
    s->pen_registered = true;
    std::this_thread::sleep_for(std::chrono::milliseconds(500)); // 等待 Android 挂载笔输入设备
    // 无接触基线帧：暖热 InputReader 配置管线（与手指触摸同款措施）
    unsigned char base[9] = { 0x04, 0x00, 0, 0, 0, 0, 0, 0, 0 };
    send_event_raw(s, kAccIdPen, base, 9);
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    return 0;
}

int ensure_consumer(SessionImpl* s) {
    if (s->consumer_registered) return 0;
    unregister_hid_id(s, kAccIdConsumer);
    int r = register_hid_desc(s, kAccIdConsumer, kConsumerDesc, (int)sizeof kConsumerDesc);
    if (r < 0) { g_err = "注册多媒体键 HID 失败"; return r; }
    s->consumer_registered = true;
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    return 0;
}

int find_slot_by_id(SessionImpl* s, int contact_id) {
    for (int i = 0; i < kMaxContacts; i++)
        if (s->contact_active[i] && s->contact_ids[i] == contact_id) return i;
    return -1;
}

} // namespace

// ---- 触摸（对外入口持 hid_mutex；以下公开实现均为锁内逻辑）-------------------

int register_touch(Session* s_, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    int r = ensure_touch(s); (void)s;
    if (err) *err = r ? g_err : "";
    return r;
}

namespace {
int touch_reset_unlocked(SessionImpl* s, const char** err) {
    *err = "";
    for (int i = 0; i < kMaxContacts; i++) {
        if (s->contact_active[i]) {
            send_finger(s, 0x00, s->contact_ids[i], 0, 0);
            s->contact_active[i] = false;
            s->contact_ids[i] = 0;
        }
    }
    s->next_contact_id = 1;
    return 0;
}
} // namespace

int unregister_touch(Session* s_, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    const char* reset_err = "";
    touch_reset_unlocked(s, &reset_err);
    int r = unregister_hid_id(s, kAccIdTouch);
    s->touch_registered = false;
    if (err) *err = "";
    return r;
}

int touch_down(Session* s_, int x, int y, int* out_contact_id, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_touch(s); (void)s;
    if (r) { *err = g_err; return r; }
    int slot = -1;
    for (int i = 0; i < kMaxContacts; i++) if (!s->contact_active[i]) { slot = i; break; }
    if (slot < 0) { *err = "触点已满（最多 10 指）"; return -1; }
    int cid = s->next_contact_id++;
    int nx, ny;
    apply_rotation(s, clamp_logic(x), clamp_logic(y), &nx, &ny);
    r = send_finger(s, 0x03, cid, nx, ny);
    if (r < 0) { *err = g_err; return r; }
    s->contact_active[slot] = true;
    s->contact_ids[slot] = cid;
    if (out_contact_id) *out_contact_id = cid;
    return 0;
}

int touch_move(Session* s_, int contact_id, int x, int y, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int slot = find_slot_by_id(s, contact_id);
    if (slot < 0) { *err = "触点不存在或已抬起"; return -1; }
    int nx, ny;
    apply_rotation(s, clamp_logic(x), clamp_logic(y), &nx, &ny);
    int r = send_finger(s, 0x03, contact_id, nx, ny);
    if (r < 0) *err = g_err;
    return r;
}

int touch_up(Session* s_, int contact_id, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int slot = find_slot_by_id(s, contact_id);
    if (slot < 0) { *err = "触点不存在或已抬起"; return -1; }
    int r = send_finger(s, 0x00, contact_id, 0, 0);
    if (r < 0) { *err = g_err; return r; }
    s->contact_active[slot] = false;
    s->contact_ids[slot] = 0;
    return 0;
}

int touch_reset(Session* s_, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    return touch_reset_unlocked(s, err);
}

// ---- 键盘（对外入口持 hid_mutex；unlocked 版本供 type_text/key_combo 级联）---

namespace {
// ASCII → (HID 键码, 是否 Shift)。覆盖字母/数字/常用符号；未映射返回 false。
bool ascii_to_key(char c, uint8_t* keycode, bool* shift) {
    *shift = false; *keycode = 0;
    if (c >= 'a' && c <= 'z') { *keycode = (uint8_t)(0x04 + (c - 'a')); return true; }
    if (c >= 'A' && c <= 'Z') { *keycode = (uint8_t)(0x04 + (c - 'A')); *shift = true; return true; }
    if (c >= '1' && c <= '9') { *keycode = (uint8_t)(0x1e + (c - '1')); return true; }
    switch (c) {
        case '0': *keycode = 0x27; return true;
        case ' ': *keycode = 0x2c; return true;
        case '-': *keycode = 0x2d; return true;
        case '=': *keycode = 0x2e; return true;
        case '[': *keycode = 0x2f; return true;
        case ']': *keycode = 0x30; return true;
        case '\\': *keycode = 0x31; return true;
        case ';': *keycode = 0x33; return true;
        case '\'': *keycode = 0x34; return true;
        case '`': *keycode = 0x35; return true;
        case ',': *keycode = 0x36; return true;
        case '.': *keycode = 0x37; return true;
        case '/': *keycode = 0x38; return true;
        case '\n': *keycode = 0x28; return true;
        case '!': *keycode = 0x1e; *shift = true; return true;
        case '@': *keycode = 0x1f; *shift = true; return true;
        case '#': *keycode = 0x20; *shift = true; return true;
        case '?': *keycode = 0x38; *shift = true; return true;
        case '_': *keycode = 0x2d; *shift = true; return true;
        case ':': *keycode = 0x33; *shift = true; return true;
        default: return false;
    }
}

int key_down_unlocked(SessionImpl* s, uint8_t hid_keycode, const char** err) {
    *err = "";
    int r = ensure_keyboard(s);
    if (r) { *err = g_err; return r; }
    unsigned char* rep = s->kbd_report;
    rep[0] = 0x01;
    if (hid_keycode >= 0xe0 && hid_keycode <= 0xe7) {
        rep[1] |= (unsigned char)(1 << (hid_keycode - 0xe0));
    } else {
        bool placed = false;
        for (int i = 3; i < 8 && !placed; i++) if (rep[i] == 0) { rep[i] = hid_keycode; placed = true; }
        if (!placed) { *err = "键盘六键位已满"; return -1; }
    }
    r = send_event_raw(s, kAccIdKeyboard, rep, 8);
    if (r < 0) { *err = "键盘报告发送失败"; return r; }
    return 0;
}

int key_up_unlocked(SessionImpl* s, uint8_t hid_keycode, const char** err) {
    *err = "";
    unsigned char* rep = s->kbd_report;
    rep[0] = 0x01;
    if (hid_keycode >= 0xe0 && hid_keycode <= 0xe7) {
        rep[1] &= (unsigned char)~(1 << (hid_keycode - 0xe0));
    } else {
        for (int i = 3; i < 8; i++) if (rep[i] == hid_keycode) rep[i] = 0;
    }
    int r = send_event_raw(s, kAccIdKeyboard, rep, 8);
    if (r < 0) { *err = "键盘报告发送失败"; return r; }
    return 0;
}
} // namespace

int key_down(Session* s_, uint8_t hid_keycode, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    return key_down_unlocked(s, hid_keycode, err);
}

int key_up(Session* s_, uint8_t hid_keycode, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    return key_up_unlocked(s, hid_keycode, err);
}

int type_text(Session* s_, const char* ascii, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    for (const char* p = ascii; *p; p++) {
        uint8_t kc = 0; bool shift = false;
        if (!ascii_to_key(*p, &kc, &shift)) { *err = "字符无法通过 HID 键盘输入"; return -1; }
        if (shift && key_down_unlocked(s, 0xe1, err)) return -1;   // 左 Shift
        if (key_down_unlocked(s, kc, err)) return -1;
        if (key_up_unlocked(s, kc, err)) return -1;
        if (shift && key_up_unlocked(s, 0xe1, err)) return -1;
        std::this_thread::sleep_for(std::chrono::milliseconds(12));
    }
    return 0;
}

int key_combo(Session* s_, uint8_t modifiers, uint8_t hid_keycode, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_keyboard(s);
    if (r) { *err = g_err; return r; }
    unsigned char* rep = s->kbd_report;
    rep[0] = 0x01;
    if (hid_keycode == 0 || (hid_keycode >= 0xe0 && hid_keycode <= 0xe7)) {
        *err = "组合键码必须是普通键（不能为 0 或修饰键）";
        return -1;
    }
    bool placed = false;
    for (int i = 3; i < 8 && !placed; i++) if (rep[i] == 0) { rep[i] = hid_keycode; placed = true; }
    if (!placed) { *err = "键盘六键位已满"; return -1; }
    rep[1] |= modifiers; // 修饰键与主键同帧按下（modifiers 与 HID 修饰位图同定义）
    r = send_event_raw(s, kAccIdKeyboard, rep, 8);
    if (r < 0) { *err = "键盘报告发送失败"; return r; }
    std::this_thread::sleep_for(std::chrono::milliseconds(30));
    for (int i = 3; i < 8; i++) if (rep[i] == hid_keycode) rep[i] = 0;
    r = send_event_raw(s, kAccIdKeyboard, rep, 8); // 先松主键（修饰仍按住）
    if (r < 0) { *err = "键盘报告发送失败"; return r; }
    rep[1] &= (unsigned char)~modifiers;
    r = send_event_raw(s, kAccIdKeyboard, rep, 8); // 再松修饰键
    if (r < 0) { *err = "键盘报告发送失败"; return r; }
    return 0;
}

// ---- 鼠标（对外入口持 hid_mutex）---------------------------------------------

namespace {
int send_mouse(SessionImpl* s, int buttons, int dx, int dy, int wheel) {
    unsigned char rep[5] = { 0x02, (unsigned char)buttons,
                             (unsigned char)(dx & 0xff), (unsigned char)(dy & 0xff),
                             (unsigned char)(wheel & 0xff) };
    int r = send_event_raw(s, kAccIdMouse, rep, 5);
    if (r < 0) g_err = "鼠标报告发送失败";
    return r;
}
} // namespace

int mouse_move(Session* s_, int dx, int dy, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_mouse(s);
    if (r) { *err = g_err; return r; }
    // 大位移拆分为 <=127 的步进（Boot 协议报表为 8 位有符号）
    while (dx != 0 || dy != 0) {
        int sx = dx > 127 ? 127 : (dx < -127 ? -127 : dx);
        int sy = dy > 127 ? 127 : (dy < -127 ? -127 : dy);
        if (send_mouse(s, 0, sx, sy, 0) < 0) { *err = g_err; return -1; }
        dx -= sx; dy -= sy;
        if (sx || sy) std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
    return 0;
}

int mouse_button(Session* s_, int button, bool down, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_mouse(s);
    if (r) { *err = g_err; return r; }
    int bit = button == 1 ? 0x01 : button == 2 ? 0x02 : button == 3 ? 0x04 : 0;
    if (!bit) { *err = "鼠标键号无效（1 左 / 2 右 / 3 中）"; return -1; }
    if (down) s->mouse_buttons |= bit; else s->mouse_buttons &= ~bit;
    r = send_mouse(s, s->mouse_buttons, 0, 0, 0);
    if (r < 0) *err = g_err;
    return r;
}

int mouse_wheel(Session* s_, int delta, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_mouse(s);
    if (r) { *err = g_err; return r; }
    while (delta != 0) {
        int step = delta > 127 ? 127 : (delta < -127 ? -127 : delta);
        if (send_mouse(s, 0, 0, 0, step) < 0) { *err = g_err; return -1; }
        delta -= step;
    }
    return 0;
}

// ---- 旋转坐标映射（纯函数）---------------------------------------------------
// 口径：rotation 与 Android Display.getRotation() 同向——设备相对自然竖屏的逆时针旋转角。
// 90 度（设备逆时针横放）：视觉 (u,v) 对应原生 (1-v, u)；270 度（顺时针横放）反之。
// 逻辑域两轴同为 0~32767（正方形），换算后仍落在域内。
// 1.0.0 的 90/270 分支与该约定正好互换（自检只验证了往返自洽，测不出方向），1.1.0 修正。
void transform(int x, int y, int rotation, int* out_x, int* out_y) {
    x = clamp_logic(x); y = clamp_logic(y);
    switch (rotation) {
        case 90:  *out_x = kLogicalMax - y; *out_y = x; break;
        case 180: *out_x = kLogicalMax - x; *out_y = kLogicalMax - y; break;
        case 270: *out_x = y; *out_y = kLogicalMax - x; break;
        default:  *out_x = x; *out_y = y; break;
    }
}

int set_session_rotation(Session* s_, int rotation, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    if (rotation != 0 && rotation != 90 && rotation != 180 && rotation != 270) {
        *err = "旋转角只支持 0 / 90 / 180 / 270";
        return -1;
    }
    s->rotation = rotation;
    return 0;
}

// ---- 压感笔（对外入口持 hid_mutex）-------------------------------------------

int register_pen(Session* s_, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    int r = ensure_pen(s);
    if (err) *err = r ? g_err : "";
    return r;
}

namespace {
int send_pen(SessionImpl* s, unsigned char flags, int contact_id, int nx, int ny, int pressure) {
    unsigned char rep[9] = { 0x04, flags,
                             (unsigned char)(pressure & 0xff), (unsigned char)((pressure >> 8) & 0xff),
                             (unsigned char)contact_id,
                             (unsigned char)(nx & 0xff), (unsigned char)(nx >> 8),
                             (unsigned char)(ny & 0xff), (unsigned char)(ny >> 8) };
    int r = send_event_raw(s, kAccIdPen, rep, 9);
    if (r < 0) g_err = "压感笔报告发送失败";
    return r < 0 ? r : 0;
}
} // namespace

int pen_down(Session* s_, int x, int y, int pressure, int* out_contact_id, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_pen(s);
    if (r) { *err = g_err; return r; }
    if (s->pen_active) { *err = "已有活动笔触点（先 AOA_笔抬起）"; return -1; }
    if (pressure < 0 || pressure > kLogicalMax) { *err = "压力超出 0~32767"; return -1; }
    int cid = s->next_pen_contact_id++;
    int nx, ny;
    apply_rotation(s, clamp_logic(x), clamp_logic(y), &nx, &ny);
    r = send_pen(s, 0x03, cid, nx, ny, pressure); // tip+inrange 按下
    if (r < 0) { *err = g_err; return r; }
    s->pen_active = true;
    s->pen_contact_id = cid;
    if (out_contact_id) *out_contact_id = cid;
    return 0;
}

int pen_move(Session* s_, int contact_id, int x, int y, int pressure, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    if (!s->pen_active || s->pen_contact_id != contact_id) { *err = "笔触点不存在或已抬起"; return -1; }
    if (pressure < 0 || pressure > kLogicalMax) { *err = "压力超出 0~32767"; return -1; }
    int nx, ny;
    apply_rotation(s, clamp_logic(x), clamp_logic(y), &nx, &ny);
    int r = send_pen(s, 0x03, contact_id, nx, ny, pressure);
    if (r < 0) *err = g_err;
    return r;
}

int pen_up(Session* s_, int contact_id, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    if (!s->pen_active || s->pen_contact_id != contact_id) { *err = "笔触点不存在或已抬起"; return -1; }
    int r = send_pen(s, 0x00, contact_id, 0, 0, 0); // 抬笔：全零 flags + 零压力
    if (r < 0) { *err = g_err; return r; }
    s->pen_active = false;
    s->pen_contact_id = 0;
    return 0;
}

// ---- 多媒体键与主机时钟 -------------------------------------------------------

int media_key(Session* s_, unsigned usage, const char** err) {
    SessionImpl* s = s_;
    std::lock_guard<std::mutex> lk(s->hid_mutex);
    *err = "";
    int r = ensure_consumer(s);
    if (r) { *err = g_err; return r; }
    int bit = -1;
    for (const ConsumerBit& cb : kConsumerBits)
        if (cb.usage == usage) { bit = cb.bit; break; }
    if (bit < 0) {
        g_err = "不支持的多媒体键码（支持 0xCD 播放/暂停 0xE2 静音 0xE9/0xEA 音量加减 "
                "0xB5 下一曲 0xB6 上一曲 0xB7 停止 0x223 Home 0x224 返回）";
        return -1;
    }
    unsigned short bitmap = (unsigned short)(1u << bit);
    unsigned char rep[3] = { 0x05, (unsigned char)(bitmap & 0xff), (unsigned char)(bitmap >> 8) };
    r = send_event_raw(s, kAccIdConsumer, rep, 3);
    if (r < 0) { *err = "多媒体键报告发送失败"; return r; }
    std::this_thread::sleep_for(std::chrono::milliseconds(40));
    rep[1] = 0; rep[2] = 0; // 松键：位图归零，否则系统视为长按
    r = send_event_raw(s, kAccIdConsumer, rep, 3);
    if (r < 0) { *err = "多媒体键报告发送失败"; return r; }
    return 0;
}

long long host_clock_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

} // namespace aoahid
