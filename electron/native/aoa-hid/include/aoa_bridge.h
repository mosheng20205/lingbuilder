#pragma once

#include <string>
#include <vector>

// LingBuilder AOA HID 模块 —— 中文命令桥接接口（随用户工程编译，配合 bindings.commands 生成调用）。
//
// 坐标口径：全部触摸命令使用逻辑坐标 0~32767（两轴同域，相对当前屏幕方向）；
// 通过 AOA_设置屏幕旋转 声明设备旋转角后自动换算到原生面板坐标。
//
// 会话语义：AOA_打开设备 返回受管句柄（0 表示失败），进程内不复用；用 AOA_关闭设备 释放。
// 同步红线：打开设备前必须关闭 adb / scrcpy 等占用手机 ADB 接口的工具（Windows 上
// libusb 与 adb 互斥，占用时打不开并给出中文原因）。

// 设备与会话
long long AOA_打开设备(const std::wstring& 序列号);
bool AOA_关闭设备(long long 设备);
std::wstring AOA_取设备列表();  // 每行：序列号|产品|模式|驱动状态（配件设备=可打开/需驱动）
bool AOA_安装驱动(long long 序列号); // 引导式：下载并拉起 Zadig + 分步中文指引进 AOA_取错误()

// 触摸
bool AOA_注册触摸(long long 设备);
long long AOA_手指按下(long long 设备, long long x, long long y);
bool AOA_手指移动(long long 设备, long long 触点号, long long x, long long y);
bool AOA_手指抬起(long long 设备, long long 触点号);
bool AOA_单击(long long 设备, long long x, long long y);
bool AOA_双击(long long 设备, long long x, long long y);
bool AOA_长按(long long 设备, long long x, long long y, long long 毫秒);
bool AOA_滑动(long long 设备, long long x1, long long y1, long long x2, long long y2, long long 时长毫秒);
bool AOA_捏合(long long 设备, long long 中心x, long long 中心y, long long 起始间距, long long 结束间距, long long 时长毫秒);
bool AOA_重置触摸(long long 设备);

// 键盘（仅 ASCII 可映射字符；中文会被拒绝并给中文原因）
bool AOA_键盘输入(long long 设备, const std::wstring& 文本);
bool AOA_键盘按键(long long 设备, long long 键码);

// 键盘组合：修饰键位掩码 1=LeftCtrl 2=LeftShift 4=LeftAlt 8=LeftGUI；例 Ctrl+C = AOA_键盘组合(设备, 1, 6)
bool AOA_键盘组合(long long 设备, long long 修饰键, long long 键码);
// 多媒体键（Consumer Page）：0xCD 播放/暂停、0xE2 静音、0xE9/0xEA 音量加减、0x223 Home、0x224 返回
bool AOA_多媒体键(long long 设备, long long 键码);

// 压感笔（数位板/绘画类压感输入；可与手指触摸共存，独立 HID 设备）
bool AOA_注册触摸笔(long long 设备);
long long AOA_笔按下(long long 设备, long long x, long long y, long long 压力);
bool AOA_笔移动(long long 设备, long long 触点号, long long x, long long y, long long 压力);
bool AOA_笔抬起(long long 设备, long long 触点号);

// 鼠标
bool AOA_鼠标移动(long long 设备, long long dx, long long dy);
bool AOA_鼠标点击(long long 设备, long long 按钮);
bool AOA_鼠标滚轮(long long 设备, long long 滚动量);

// 屏幕
bool AOA_设置屏幕旋转(long long 设备, long long 角度);

// 数据通道（AOAv2 配件 bulk 端点；LBAC 帧，通道 1=视频 JPEG、通道 2=控制/事件 JSON）
long long AOA_打开数据通道(long long 设备, long long 超时毫秒);
std::vector<unsigned char> AOA_数据通道收帧(long long 通道, long long 超时毫秒);
bool AOA_数据通道发帧(long long 通道, const std::vector<unsigned char>& 数据);
bool AOA_关闭数据通道(long long 通道);

// 多机同步（主机 steady_clock 时基；目标时刻早于当前 = 立即执行）-------------------
// 组为进程内注册表；到点后组内每台设备由独立线程并行发送，发送时刻偏差目标 ≤10ms。

// 主机时钟毫秒（单调不回拨）。同步组目标时刻、录制时间戳都用它。
long long AOA_取时钟();
long long AOA_创建同步组();                       // 返回组 ID（0=失败）
bool AOA_组加入设备(long long 组ID, long long 设备); // 可重复调用加入多台
bool AOA_组单击(long long 组ID, long long x, long long y, long long 目标时刻毫秒);
bool AOA_组滑动(long long 组ID, long long x1, long long y1, long long x2, long long y2,
                long long 时长毫秒, long long 目标时刻毫秒);
bool AOA_组清空(long long 组ID);                  // 清空未到点任务（不停派发线程）
bool AOA_销毁同步组(long long 组ID);

// 剧本录制回放（CSV 格式见 docs/剧本格式.md）--------------------------------------
// 录制器为进程级单例：记录所有设备的注入动作流（单机剧本场景）。
bool AOA_开始录制(const std::wstring& 文件路径);
bool AOA_停止录制();
// 异步回放：后台线程按 CSV 时间轴回放（倍速>0，支持 1.5 等小数；循环次数>=1）。每设备同时仅一个任务。
// 完成与否经 AOA_取回放状态 轮询读取（"回放中(第 x/y 次)"/"已完成 N 次"/"已停止"/"失败：原因"）。
bool AOA_异步回放(long long 设备, const std::wstring& 文件路径, double 倍速, long long 循环次数);
std::wstring AOA_取回放状态(long long 设备);
bool AOA_停止回放(long long 设备);

// 错误
std::wstring AOA_取错误();
