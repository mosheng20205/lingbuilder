// aoa_hid_internal.h — 库内部各编译单元之间的共享接口（不对外安装）
#ifndef AOA_HID_INTERNAL_H
#define AOA_HID_INTERNAL_H

#include "aoa_hid.h"
#include <mutex>
#include <libusb.h>

namespace aoahid {

// 与 AOA 规范一致的请求码
constexpr uint8_t kReqGetProtocol = 51;
constexpr uint8_t kReqSendString = 52;
constexpr uint8_t kReqStart = 53;
constexpr uint8_t kReqRegisterHid = 54;
constexpr uint8_t kReqUnregisterHid = 55;
constexpr uint8_t kReqSetHidReportDesc = 56;
constexpr uint8_t kReqSendHidEvent = 57;

// 会话布局（与 aoa_device.cpp 唯一定义保持一致）
struct SessionImpl {
    libusb_context* ctx = nullptr;
    libusb_device* device = nullptr;
    libusb_device_handle* handle = nullptr;
    std::string serial;
    std::string want_port_path;
    bool accessory = false;
    bool touch_registered = false;
    bool kbd_registered = false;
    bool mouse_registered = false;
    int next_contact_id = 1;
    bool contact_active[kMaxContacts] = {};
    int contact_ids[kMaxContacts] = {};
    int mouse_buttons = 0;              // 当前按下的鼠标键位图
    unsigned char kbd_report[8] = {};   // 当前键盘报表（含修饰键状态）
    int rotation = 0;                   // 设备当前旋转角 0/90/180/270，触摸命令自动换算
    // 1.1.0：HID 事件互斥。所有 HID 对外入口（触摸/键盘/鼠标/笔/多媒体）持锁串行化，
    // 多线程调同一句柄安全；不同设备各持各锁互不阻塞。
    // 数据通道 bulk 传输有意不进此锁：视频收帧（常超时阻塞）与 HID 点击走独立端点，并行不互相拖住。
    std::mutex hid_mutex;
    // 1.1.0：压感笔（Digitizers/Pen，独立 accessory_id=4，可与手指触摸共存）
    bool pen_registered = false;
    bool pen_active = false;            // 当前活动笔触点（单笔）
    int pen_contact_id = 0;             // 活动笔触点号（生命周期同手指触点）
    int next_pen_contact_id = 1;
    // 1.1.0：多媒体键（Consumer Page，独立 accessory_id=5）
    bool consumer_registered = false;
    // 数据通道（AOAv2 配件 bulk 端点，与 HID 控制传输共存）
    bool data_claimed = false;          // 配件接口已认领
    int data_iface_index = -1;          // 承载 bulk 端点的接口号（扫描发现，不固定为 0）
    unsigned char data_ep_in = 0;       // bulk IN 端点地址（手机 → 电脑）
    unsigned char data_ep_out = 0;      // bulk OUT 端点地址（电脑 → 手机）
    // 设备在线探测（2026-10-21）：重枚举/拔出/驱动重绑之后，旧 libusb 句柄对应的 WinUSB
    // 对象已经释放；继续 bulk/control 传输可能抛结构化异常把宿主进程静默带走（无 WER 记录）。
    // 打开时记录物理位置，传输链路出错时据此判定「设备是不是真的没了」，判定为断开后
    // 所有命令一律返回中文错误，由宿主侧「失败→标槽断开」自愈，而不是继续撞旧句柄。
    uint8_t dev_bus = 0;
    std::string dev_port;               // 端口路径（如 "9"、"2.1.4"），重枚举后端口不变
    uint16_t dev_vid = 0;
    uint16_t dev_pid = 0;
    uint8_t dev_addr = 0;               // USB 设备地址：重枚举后系统会重新分配，据此识破「同端口换了新节点」
    unsigned long long last_live_probe_ms = 0;
    unsigned long long last_rx_ms = 0;          // 最后一次收到帧的时刻（有帧流动=句柄活着，免枚举探测）
    bool dead = false;                  // 会话已判死（设备断开/句柄失效）
    std::string dead_reason;            // 判死原因（UTF-8 中文，直接回给 AOA_取错误）
};

// 协议原语（aoa_device.cpp 提供）
int send_event_raw(SessionImpl* s, int accessory_id, const unsigned char* report, int len);
int register_hid_desc(SessionImpl* s, int accessory_id, const unsigned char* desc, int desc_len);
int unregister_hid_id(SessionImpl* s, int accessory_id);

} // namespace aoahid

#endif // AOA_HID_INTERNAL_H
