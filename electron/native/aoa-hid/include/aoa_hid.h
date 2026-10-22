// aoa_hid.h — LingBuilder AOA HID 模块核心库（M1 内部 API；M2 在此之上出 C ABI 桥）
//
// 坐标口径：对外一律使用逻辑坐标 0~32767（相对当前屏幕方向），
// 由 transform() 按设备当前旋转角映射到原生面板坐标后再进状态机。
#ifndef AOA_HID_H
#define AOA_HID_H

#include <cstdint>
#include <string>
#include <vector>

namespace aoahid {

constexpr int kLogicalMax = 32767;      // 逻辑坐标上限（两轴同域）
constexpr int kMaxContacts = 10;        // 状态机支持的并发触点上限

// 设备发现 ----------------------------------------------------------------

struct DeviceInfo {
    std::string serial;
    std::string manufacturer;
    std::string product;
    uint16_t vid = 0, pid = 0;
    uint8_t bus = 0;
    uint8_t port[8] = {0};
    int port_count = 0;
    bool accessory = false;             // 是否已处于 AOA 配件模式
    bool driver_ok = true;              // 配件设备：能否被 libusb 打开（false=需装 WinUSB 驱动）
};

std::string last_error();               // 最近一次失败的中文原因（线程内单场景使用）
std::vector<DeviceInfo> list_devices(); // 仅列出手机/配件设备

// 会话 --------------------------------------------------------------------

struct SessionImpl;
using Session = SessionImpl;

// 打开：按序列号匹配；若手机在普通模式则完成 协议校验→START→等同端口重枚举→重开 全流程。
// 返回 nullptr 时用 last_error() 取中文原因。
Session* open_by_serial(const std::string& serial);
void close_session(Session*& s);

// 触摸 HID ----------------------------------------------------------------

// 注册触摸设备（V3：Report ID=1 的 MT-B 单指描述符，多指用逐指报告）。
// 注册成功后内部等待 Android 挂载输入设备。
int register_touch(Session* s, const char** err);
int unregister_touch(Session* s, const char** err);

// 触点操作：contact_id 由状态机分配，整个生命周期不复用，touch_reset 后才回收。
// x/y 为逻辑坐标（0~32767），内部已按旋转映射。
int touch_down(Session* s, int x, int y, int* out_contact_id, const char** err);
int touch_move(Session* s, int contact_id, int x, int y, const char** err);
int touch_up(Session* s, int contact_id, const char** err);
int touch_reset(Session* s, const char** err);   // 强制抬起全部触点

// 键盘 HID（Report ID=1 的标准 6 键无滚报键盘）--------------------------------

int key_down(Session* s, uint8_t hid_keycode, const char** err);
int key_up(Session* s, uint8_t hid_keycode, const char** err);
int type_text(Session* s, const char* ascii, const char** err); // 仅 ASCII 可映射字符

// 键盘组合：modifiers 为修饰键位掩码（bit0=LCtrl bit1=LShift bit2=LAlt bit3=LGUI，与 HID 报表位图一致）。
// 一次完整组合 = 修饰+键同按 → 键抬起 → 修饰抬起。例：Ctrl+C = key_combo(s, 0x01, 0x06)。
int key_combo(Session* s, uint8_t modifiers, uint8_t hid_keycode, const char** err);

// 多媒体键（Consumer Page，独立 HID 设备）：0xCD 播放/暂停、0xE2 静音、0xE9/0xEA 音量加/减、
// 0x223 AC Home、0x224 AC Back（安卓映射为 HOME/BACK/媒体键，随 ROM 略有差异）。
int media_key(Session* s, unsigned usage, const char** err);

// 压感笔（Digitizers/Pen，Report ID=4，与手指触摸共存；各用独立 HID 设备）----------
// pressure 逻辑域 0~32767（0=抬笔力/悬停）；坐标同触摸：逻辑坐标 0~32767，按会话旋转自动换算。
int register_pen(Session* s, const char** err);
int pen_down(Session* s, int x, int y, int pressure, int* out_contact_id, const char** err);
int pen_move(Session* s, int contact_id, int x, int y, int pressure, const char** err);
int pen_up(Session* s, int contact_id, const char** err);

// 主机时钟（steady_clock 毫秒；多机同步的时基，单调不回拨）
long long host_clock_ms();

// 鼠标 HID（Boot 协议，Report ID=2）------------------------------------------

int mouse_move(Session* s, int dx, int dy, const char** err);       // 相对移动
int mouse_button(Session* s, int button, bool down, const char** err); // button: 1左 2右 3中
int mouse_wheel(Session* s, int delta, const char** err);           // 正=上滚

// 屏幕旋转坐标映射（纯函数）--------------------------------------------------
// rotation：设备当前旋转角（0/90/180/270），与 Android Display.getRotation() 同向
// （相对自然竖屏逆时针）。输入/输出均为 0~32767 逻辑域。
void transform(int x, int y, int rotation, int* out_x, int* out_y);

// 会话级旋转：设置后所有触摸命令的坐标自动按该角度换算。
int set_session_rotation(Session* s, int rotation, const char** err);

// 数据通道（AOAv2 配件 bulk 端点，与 HID 控制传输共存）------------------------
// 帧格式 LBAC：4 字节 magic "LBAC" + 2 字节通道 ID（小端）+ 4 字节载荷长度（小端）+ 载荷。
// 约定通道 1 = 视频 JPEG、通道 2 = 控制/事件 JSON。

// 认领配件接口并清空残留帧（握手）；成功后 收帧/发帧 可用。返回 0 成功，<0 失败。
int open_data_channel(Session* s, long long timeout_ms, const char** err);
// 发送一帧（LBAC 打包 + bulk OUT）。返回 0 成功，<0 失败。
int data_send(Session* s, int channel_id, const unsigned char* data, int len, const char** err);
// 接收一帧载荷（自动去 LBAC 帧头）。返回 0=收到帧（out 填载荷），1=超时无帧，<0=失败。
int data_recv(Session* s, long long timeout_ms, std::vector<unsigned char>* out, int* out_channel, const char** err);
// 释放配件接口；设备关闭时会自动释放。
void close_data_channel(Session* s);

// 剧本录制回放（CSV：type,timestamp_ms,contact_id,a,b,c；时间戳为开始录制后相对毫秒）----
// 录制器为进程级单例（跨设备全局）：桥层把每个动作命令的成功路径经 record_note 记入文件。
// 回放按会话管理：每个 Session 同时最多一个回放任务；回放线程执行动作时自动抑制录制。

// 开始录制到 UTF-8 CSV 文件（宽字符路径）。重复调用=先停止旧录制再开新文件。
int record_begin(const wchar_t* path, const char** err);
// 停止录制并落盘关闭文件。未在录制时返回 0（幂等）。
int record_stop(const char** err);
bool record_active();
// 桥层动作钩子：type 取 "down"/"move"/"up"/"pendown"/"penmove"/"penup"/"key"/"mouse"，
// contact_id 为触点号，a/b/c 按剧本格式填充。
void record_note(const char* type, int contact_id, long long a, long long b, long long c);
// 文本动作钩子（UTF-8 载荷自动 base64 后写 text 行）
void record_note_text(const std::string& utf8_text);
// 宽字符 → UTF-8 窄串（桥层文本进入录制前的编码）
std::string wide_to_utf8(const std::wstring& in);

// 异步回放：后台线程按 CSV 时间轴回放（倍速=时间轴缩放，>0；loops>=1，循环次数）。
// 返回 0=已启动；<0=失败（占用/文件非法/空剧本）。每步协作式检查停止标记。
int replay_start(Session* s, const wchar_t* path, double speed, long long loops, const char** err);
// 回放状态中文文本（UTF-8）：空闲/回放中(第 x/y 次)/已完成 N 次/已停止/失败：原因
std::string replay_status(Session* s);
// 请求停止（协作式：当前步执行完后退出）并等待线程收尾。未在回放时幂等返回 0。
int replay_stop(Session* s);
// 会话关闭前必须调用：停止回放并回收线程与状态（防 use-after-free）。
void replay_dispose(Session* s);

} // namespace aoahid

#endif // AOA_HID_H
