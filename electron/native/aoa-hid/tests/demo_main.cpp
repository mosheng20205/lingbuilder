// demo_main.cpp — AOA HID 核心库的真机演示/验收 CLI
// 用法：
//   demo list                                  列出手机/配件设备
//   demo rotcheck                              旋转坐标映射自检
//   demo tap <serial> <x> <y>                  单点触摸（逻辑坐标 0~32767）
//   demo drag <serial> <x1> <y1> <x2> <y2>     拖动/滑动
//   demo pinch <serial>                        双指捏合（主屏可见壁纸缩放）
//   demo type <serial> <文本>                  HID 键盘输入 ASCII
//   demo mouse <serial> <dx> <dy> [按钮]       鼠标移动/点击
//   demo wheel <serial> <delta>                鼠标滚轮
#include "aoa_hid.h"
#include "aoa_hid_internal.h"
#include "aoa_bridge.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <chrono>

using namespace aoahid;

static void sleep_ms(int ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }

// 便捷封装：单指按下→逐步移动→抬起（内部用状态机真实触点）
static int gesture_drag(Session* s, int x1, int y1, int x2, int y2, int steps, int step_ms) {
    const char* err = "";
    int cidA = 0;
    if (touch_down(s, x1, y1, &cidA, &err)) { fprintf(stderr, "touch_down 失败: %s\n", err); return 1; }
    sleep_ms(30);
    for (int i = 1; i <= steps; i++) {
        int x = x1 + (int)((long long)(x2 - x1) * i / steps);
        int y = y1 + (int)((long long)(y2 - y1) * i / steps);
        if (touch_move(s, cidA, x, y, &err)) { fprintf(stderr, "touch_move 失败: %s\n", err); touch_reset(s, &err); return 1; }
        sleep_ms(step_ms);
    }
    if (touch_up(s, cidA, &err)) { fprintf(stderr, "touch_up 失败: %s\n", err); return 1; }
    return 0;
}

int main(int argc, char** argv) {
    if (argc < 2) { fprintf(stderr, "缺少子命令，运行不带参数查看用法\n"); return 2; }
    std::string cmd = argv[1];

    if (cmd == "list") {
        for (auto& d : list_devices())
            printf("%s  %04x:%04x  %s %s  序列号=%s%s\n",
                   d.accessory ? "[配件]" : "[手机]", d.vid, d.pid,
                   d.manufacturer.c_str(), d.product.c_str(),
                   d.serial.c_str(), d.accessory ? "（已配件模式）" : "");
        return 0;
    }

    if (cmd == "rotcheck") {
        struct Case { const char* name; int rot; };
        Case cases[] = { {"0°", 0}, {"90°", 90}, {"180°", 180}, {"270°", 270} };
        int fail_count = 0;
        for (auto& c : cases) {
            int x, y;
            transform(0, 0, c.rot, &x, &y);
            bool ok1 = x >= 0 && x <= kLogicalMax && y >= 0 && y <= kLogicalMax; // 角仍在域内
            int inv = c.rot == 90 ? 270 : c.rot == 270 ? 90 : c.rot;             // 互逆角
            int rx, ry;
            transform(x, y, inv, &rx, &ry);
            bool ok2 = rx == 0 && ry == 0;                                        // 角往返还原
            int px = 1234, py = 23456, qx, qy, px2, py2;
            transform(px, py, c.rot, &qx, &qy);
            transform(qx, qy, inv, &px2, &py2);
            bool ok3 = px2 == px && py2 == py;                                    // 任意点往返还原
            bool ok4 = qx >= 0 && qx <= kLogicalMax && qy >= 0 && qy <= kLogicalMax;
            printf("%-5s 角(0,0)->(%5d,%5d) 角还原:%s 任意点还原:%s 域内:%s\n",
                   c.name, x, y, ok2 ? "√" : "×", ok3 ? "√" : "×", ok4 ? "√" : "×");
            if (!ok1 || !ok2 || !ok3 || !ok4) fail_count++;
        }
        // 方向钉子（1.1.0）：与 Android Display.getRotation() 逆时针约定一致——
        // 90 度（设备逆时针横放）时，视觉左上角对应原生面板右上角。
        int ax, ay, bx, by;
        transform(0, 0, 90, &ax, &ay);
        bool ok_dir90 = ax == kLogicalMax && ay == 0;
        transform(0, 0, 270, &bx, &by);
        bool ok_dir270 = bx == 0 && by == kLogicalMax;
        printf("方向钉 90:(0,0)->(%5d,%5d)=%s  270:(0,0)->(%5d,%5d)=%s\n",
               ax, ay, ok_dir90 ? "√" : "×", bx, by, ok_dir270 ? "√" : "×");
        if (!ok_dir90 || !ok_dir270) fail_count++;
        printf(fail_count ? "rotcheck 未通过\n" : "rotcheck 全部通过\n");
        return fail_count ? 1 : 0;
    }

    if (argc < 3) { fprintf(stderr, "缺少序列号参数\n"); return 2; }
    std::string serial = argv[2];

    if (cmd == "record" && argc >= 4) {
        // record <serial> <file_utf8>：录制三步动作（下拉通知栏 → 收起 → 单击正中）
        // 走桥层命令链路（与 .lcpp 用户同路径）：录制钩子插桩在桥层动作命令里，直调核心库录不到。
        // 位于公共 open_by_serial 之前：close 后立刻重开同一设备会撞瞬态，会话交给桥层命令自管。
        // -1 换算返回含终结符长度；逐字符桥接会把 NUL 拼进 std::string（序列号比较永不相等），
        // 故转完必须 pop_back 去掉终结符。
        int wchars = MultiByteToWideChar(CP_UTF8, 0, argv[3], -1, nullptr, 0);
        std::wstring wpath(wchars, 0);
        MultiByteToWideChar(CP_UTF8, 0, argv[3], -1, &wpath[0], wchars);
        wpath.pop_back();
        int swchars = MultiByteToWideChar(CP_UTF8, 0, argv[2], -1, nullptr, 0);
        std::wstring wserial(swchars, 0);
        MultiByteToWideChar(CP_UTF8, 0, argv[2], -1, &wserial[0], swchars);
        wserial.pop_back();
        long long dev = AOA_打开设备(wserial);
        if (!dev) {
            std::wstring e = AOA_取错误();
            std::string ne;
            for (wchar_t c : e) ne += (char)((c < 0x80) ? c : '?');
            fprintf(stderr, "打开失败: %s\n", ne.c_str());
            return 1;
        }
        if (!AOA_开始录制(wpath)) { printf("开始录制失败\n"); AOA_关闭设备(dev); return 1; }
        printf("录制中：下拉通知栏\n");
        bool ok = AOA_滑动(dev, kLogicalMax / 2, 200, kLogicalMax / 2, 9000, 350);
        sleep_ms(400);
        if (ok) { printf("收起通知栏\n"); ok = AOA_滑动(dev, kLogicalMax / 2, 9000, kLogicalMax / 2, 200, 350); }
        sleep_ms(300);
        if (ok) { printf("单击正中\n"); ok = AOA_单击(dev, kLogicalMax / 2, kLogicalMax / 2); }
        AOA_停止录制();
        AOA_关闭设备(dev);
        printf(ok ? "录制完成 → %s\n" : "录制失败\n", argv[3]);
        // 桥层已自行开关会话；提前 return 避免走公共打开
        return ok ? 0 : 1;
    }

    Session* s = open_by_serial(serial);
    if (!s) { fprintf(stderr, "打开失败: %s\n", last_error().c_str()); return 1; }

    int rc = 0;
    const char* err = "";
    if (cmd == "tap" && argc >= 5) {
        int cid = 0;
        if (touch_down(s, atoi(argv[3]), atoi(argv[4]), &cid, &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
        sleep_ms(80);
        if (!rc && touch_up(s, cid, &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
    } else if (cmd == "drag" && argc >= 7) {
        rc = gesture_drag(s, atoi(argv[3]), atoi(argv[4]), atoi(argv[5]), atoi(argv[6]), 25, 12);
    } else if (cmd == "pinch") {
        // 主屏双指捏合（内→外为放大，外→内为缩小）
        int cx = kLogicalMax / 2, cy = (int)(kLogicalMax * 0.55);
        int span = 9000, steps = 24, dir = argc >= 4 ? atoi(argv[3]) : -1; // -1=捏合缩小 1=张开放大
        int cidA = 0, cidB = 0;
        if (touch_down(s, cx - span, cy, &cidA, &err) || touch_down(s, cx + span, cy, &cidB, &err)) {
            fprintf(stderr, "双指按下失败: %s\n", err); rc = 1;
        } else {
            sleep_ms(40);
            for (int i = 1; i <= steps && !rc; i++) {
                int d; // dir=-1: 双指靠拢（捏合缩小）；dir=1: 双指张开（放大）
                if (dir < 0) d = span - (int)((long long)span * 9 / 10 * i / steps);
                else d = span + (int)((long long)span * 6 / 10 * i / steps);
                if (touch_move(s, cidA, cx - d, cy, &err) || touch_move(s, cidB, cx + d, cy, &err)) {
                    fprintf(stderr, "双指移动失败: %s\n", err); rc = 1; break;
                }
                sleep_ms(16);
            }
            int ca = touch_up(s, cidA, &err), cb = touch_up(s, cidB, &err);
            if (ca || cb) rc = 1;
        }
    } else if (cmd == "taps" && argc >= 5) {
        // taps <serial> <x1> <y1> [<x2> <y2> ...]：同一会话内连续多次单击（避免逐次注册竞态）
        int total = (argc - 3) / 2;
        for (int i = 0; i < total && !rc; i++) {
            int x = atoi(argv[3 + i * 2]), y = atoi(argv[4 + i * 2]);
            int cid = 0;
            if (touch_down(s, x, y, &cid, &err)) { fprintf(stderr, "tap%d down 失败: %s\n", i + 1, err); rc = 1; break; }
            sleep_ms(90);
            if (touch_up(s, cid, &err)) { fprintf(stderr, "tap%d up 失败: %s\n", i + 1, err); rc = 1; }
            sleep_ms(160);
        }
        printf(rc ? "连续点击失败\n" : "连续点击 %d 次完成\n", total);
    } else if (cmd == "type" && argc >= 4) {
        std::string text = argv[3];
        for (int i = 4; i < argc; i++) { text += " "; text += argv[i]; }
        if (type_text(s, text.c_str(), &err)) { fprintf(stderr, "打字失败: %s\n", err); rc = 1; }
    } else if (cmd == "channel" && argc >= 4) {
        // channel <serial> <duration_sec>：数据通道与 HID 并行验收探针。
        // 打开数据通道后：收帧统计（通道 1 视频/通道 2 控制）、每秒发 ping、每 5 秒一次 HID 单击。
        int duration = argc >= 5 ? atoi(argv[4]) : 30;
        const char* cerr = "";
        if (open_data_channel(s, 1000, &cerr)) { fprintf(stderr, "打开数据通道失败: %s\n", cerr); return 1; }
        printf("数据通道已打开，持续 %d 秒（HID 每 5 秒单击一次屏幕中心）\n", duration);
        long long video_frames = 0, control_frames = 0, pings_sent = 0, pongs = 0, taps = 0;
        long long video_bytes = 0;
        int elapsed_ms = 0;
        std::string last_video_head;
        while (elapsed_ms < duration * 1000) {
            std::vector<unsigned char> payload;
            int channel_id = -1;
            int r = data_recv(s, 200, &payload, &channel_id, &cerr);
            if (r == 0) {
                if (channel_id == 1) {
                    video_frames++;
                    video_bytes += (long long)payload.size();
                    if (last_video_head.empty() && payload.size() >= 3) {
                        char head[32];
                        snprintf(head, sizeof head, "%02x%02x%02x (%zu B)", payload[0], payload[1],
                                 payload[2], payload.size());
                        last_video_head = head;
                    }
                } else if (channel_id == 2) {
                    control_frames++;
                    std::string text(payload.begin(), payload.end());
                    if (text.find("pong") != std::string::npos) pongs++;
                }
            } else if (r < 0) {
                fprintf(stderr, "收帧失败: %s\n", cerr);
                break;
            }
            elapsed_ms += 200;
            if (elapsed_ms % 1000 == 0) {
                const char* ping_err = "";
                std::string ping = "{\"cmd\":\"ping\",\"t\":" + std::to_string(elapsed_ms) + "}";
                if (data_send(s, 2, (const unsigned char*)ping.data(), (int)ping.size(), &ping_err)) {
                    fprintf(stderr, "发帧失败: %s\n", ping_err);
                    break;
                }
                pings_sent++;
            }
            if (elapsed_ms % 5000 == 0) {
                int cid = 0;
                if (touch_down(s, kLogicalMax / 2, kLogicalMax / 2, &cid, &cerr)) {
                    fprintf(stderr, "HID 按下失败: %s\n", cerr);
                    break;
                }
                sleep_ms(60);
                if (touch_up(s, cid, &cerr)) { fprintf(stderr, "HID 抬起失败: %s\n", cerr); break; }
                taps++;
            }
        }
        close_data_channel(s);
        printf("---- 数据通道验收 ----\n视频帧 %lld（%lld KB，首帧头 %s）控制帧 %lld（pong %lld/%lld）HID 单击 %lld\n",
               video_frames, video_bytes / 1024, last_video_head.c_str(), control_frames, pongs, pings_sent, taps);
        return (video_frames > 0 && pongs > 0 && taps > 0) ? 0 : 1;
    } else if (cmd == "cfgdump" && argc >= 3) {
        // cfgdump <serial>：打印活动配置的接口类码与端点，诊断数据通道接口归属
        libusb_config_descriptor* config = nullptr;
        if (libusb_get_active_config_descriptor(((SessionImpl*)s)->device, &config) != 0) {
            fprintf(stderr, "读配置描述符失败\n");
            return 1;
        }
        printf("bNumInterfaces=%d\n", config->bNumInterfaces);
        for (int i = 0; i < config->bNumInterfaces; i++) {
            const libusb_interface& iface = config->interface[i];
            for (int a = 0; a < iface.num_altsetting; a++) {
                const libusb_interface_descriptor& alt = iface.altsetting[a];
                printf("iface %d alt %d: number=%d class=%02x subclass=%02x protocol=%02x endpoints=%d\n",
                       i, a, alt.bInterfaceNumber, alt.bInterfaceClass, alt.bInterfaceSubClass, alt.bInterfaceProtocol, alt.bNumEndpoints);
                for (int e = 0; e < alt.bNumEndpoints; e++) {
                    const libusb_endpoint_descriptor& ep = alt.endpoint[e];
                    printf("  ep %02x attrs=%02x type=%s maxpkt=%d\n", ep.bEndpointAddress, ep.bmAttributes,
                           (ep.bmAttributes & 3) == 2 ? "bulk" : ((ep.bmAttributes & 3) == 3 ? "intr" : "other"), ep.wMaxPacketSize);
                }
            }
        }
        libusb_free_config_descriptor(config);
        return 0;
    } else if (cmd == "rawread" && argc >= 4) {
        // rawread <serial> <ms>：认领扫描到的 bulk 接口，读原始字节打印十六进制（诊断流归属）
        const char* cerr = "";
        if (open_data_channel(s, 100, &cerr)) { fprintf(stderr, "open_data_channel: %s\n", cerr); return 1; }
        SessionImpl* impl = (SessionImpl*)s;
        {
            libusb_config_descriptor* diag = nullptr;
            if (libusb_get_active_config_descriptor(impl->device, &diag) == 0) {
                printf("diag: bNumInterfaces=%d\n", diag->bNumInterfaces);
                for (int i = 0; i < diag->bNumInterfaces; i++) {
                    const libusb_interface_descriptor& alt = diag->interface[i].altsetting[0];
                    printf("diag: iface[%d] number=%d class=%02x/%02x/%02x eps=%d\n", i, alt.bInterfaceNumber,
                           alt.bInterfaceClass, alt.bInterfaceSubClass, alt.bInterfaceProtocol, alt.bNumEndpoints);
                }
                libusb_free_config_descriptor(diag);
            }
        }
        printf("claimed iface %d ep_in=%02x ep_out=%02x\n", impl->data_iface_index, impl->data_ep_in, impl->data_ep_out);
        {
            const unsigned char* p = (const unsigned char*)impl;
            printf("impl hex[0..200]:");
            for (int i = 0; i < 200; i++) { if (i % 32 == 0) printf("\n  %03x:", i); printf(" %02x", p[i]); }
            printf("\noffsetof(data_claimed)=%d data_iface_index=%d data_ep_in=%d data_ep_out=%d\n",
                   (int)((unsigned char*)&impl->data_claimed - p), (int)((unsigned char*)&impl->data_iface_index - p),
                   (int)((unsigned char*)&impl->data_ep_in - p), (int)((unsigned char*)&impl->data_ep_out - p));
        }
        unsigned char buf[48];
        int transferred = 0;
        unsigned long long deadline = GetTickCount64() + (unsigned long long)atoi(argv[3]);
        while (GetTickCount64() < deadline) {
            if (libusb_bulk_transfer(impl->handle, impl->data_ep_in, buf, sizeof buf, &transferred, 200) == 0 && transferred > 0) {
                printf("recv %d bytes:", transferred);
                for (int i = 0; i < transferred && i < 32; i++) printf(" %02x", buf[i]);
                printf("\n");
            }
        }
        close_data_channel(s);
        return 0;
    } else if (cmd == "mouse" && argc >= 5) {
        if (mouse_move(s, atoi(argv[3]), atoi(argv[4]), &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
        if (!rc && argc >= 6) {
            int btn = atoi(argv[5]);
            if (mouse_button(s, btn, true, &err) || mouse_button(s, btn, false, &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
        }
    } else if (cmd == "wheel" && argc >= 4) {
        if (mouse_wheel(s, atoi(argv[3]), &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
    } else if (cmd == "pen" && argc >= 6) {
        // pen <serial> <x> <y> <pressure>：单点压感按下抬起
        int cid = 0;
        if (pen_down(s, atoi(argv[3]), atoi(argv[4]), atoi(argv[5]), &cid, &err)) { fprintf(stderr, "pen_down 失败: %s\n", err); rc = 1; }
        if (!rc) {
            sleep_ms(120);
            if (pen_up(s, cid, &err)) { fprintf(stderr, "pen_up 失败: %s\n", err); rc = 1; }
            else printf("笔触点 %d 完成\n", cid);
        }
    } else if (cmd == "penstroke" && argc >= 3) {
        // penstroke <serial>：中心横向笔迹，压力 0→满→0 渐变（数位板粗细变化验收）
        int y = kLogicalMax / 2;
        int cid = 0;
        if (pen_down(s, 2000, y, 3000, &cid, &err)) { fprintf(stderr, "pen_down 失败: %s\n", err); rc = 1; }
        for (int i = 1; i <= 40 && !rc; i++) {
            int x = 2000 + (kLogicalMax - 4000) * i / 40;
            int pressure = (int)(3000 + (kLogicalMax - 6000) * (i <= 20 ? i : 40 - i) / 20);
            if (pen_move(s, cid, x, y, pressure, &err)) { fprintf(stderr, "pen_move 失败: %s\n", err); rc = 1; }
            sleep_ms(20);
        }
        if (!rc && pen_up(s, cid, &err)) { fprintf(stderr, "pen_up 失败: %s\n", err); rc = 1; }
        printf(rc ? "笔迹失败\n" : "笔迹完成（压力渐变 40 步）\n");
    } else if (cmd == "pentrace" && argc >= 8) {
        // pentrace <serial> <x1> <y1> <x2> <y2> <pressure>：恒定压力直线笔迹（轻重对比验收）
        int x1 = atoi(argv[3]), y1 = atoi(argv[4]), x2 = atoi(argv[5]), y2 = atoi(argv[6]);
        int pressure = atoi(argv[7]);
        int cid = 0;
        if (pen_down(s, x1, y1, pressure, &cid, &err)) { fprintf(stderr, "pen_down 失败: %s\n", err); rc = 1; }
        for (int i = 1; i <= 24 && !rc; i++) {
            int x = x1 + (int)((long long)(x2 - x1) * i / 24);
            int y = y1 + (int)((long long)(y2 - y1) * i / 24);
            if (pen_move(s, cid, x, y, pressure, &err)) { fprintf(stderr, "pen_move 失败: %s\n", err); rc = 1; }
            sleep_ms(18);
        }
        if (!rc && pen_up(s, cid, &err)) { fprintf(stderr, "pen_up 失败: %s\n", err); rc = 1; }
        printf(rc ? "笔迹失败\n" : "笔迹完成（恒压 %d）\n", pressure);
    } else if (cmd == "combo" && argc >= 5) {
        // combo <serial> <modifiers> <keycode>：组合键（例 Ctrl+C = combo <serial> 1 6）
        if (key_combo(s, (uint8_t)atoi(argv[3]), (uint8_t)atoi(argv[4]), &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
        else printf("组合键 mods=%s key=%s 完成\n", argv[3], argv[4]);
    } else if (cmd == "media" && argc >= 4) {
        // media <serial> <usage>：多媒体键（0xCD 播放暂停 / 0xE2 静音 / 0xE9 音量+ / 0x223 Home）
        unsigned usage = (unsigned)strtoul(argv[3], nullptr, 0);
        if (media_key(s, usage, &err)) { fprintf(stderr, "失败: %s\n", err); rc = 1; }
        else printf("多媒体键 0x%X 完成\n", usage);
    } else if (cmd == "sync" && argc >= 6) {
        // sync <serial1> <serial2> <x> <y>：两台设备对齐到同一主机时刻点击，输出实际发送时刻差
        Session* b = open_by_serial(argv[3]);
        if (!b) { fprintf(stderr, "第二台打开失败: %s\n", last_error().c_str()); close_session(s); return 1; }
        int x = atoi(argv[4]), y = atoi(argv[5]);
        long long target = host_clock_ms() + 800; // 800ms 后到点
        long long sent_a = 0, sent_b = 0;
        auto run_a = [&]() {
            auto target_tp = std::chrono::steady_clock::time_point(std::chrono::milliseconds(target));
            std::this_thread::sleep_until(target_tp);
            sent_a = host_clock_ms();
            const char* e = "";
            int cid = 0;
            if (!touch_down(s, x, y, &cid, &e)) { sleep_ms(80); touch_up(s, cid, &e); }
        };
        auto run_b = [&]() {
            auto target_tp = std::chrono::steady_clock::time_point(std::chrono::milliseconds(target));
            std::this_thread::sleep_until(target_tp);
            sent_b = host_clock_ms();
            const char* e = "";
            int cid = 0;
            if (!touch_down(b, x, y, &cid, &e)) { sleep_ms(80); touch_up(b, cid, &e); }
        };
        std::thread ta(run_a), tb(run_b);
        ta.join(); tb.join();
        long long diff = sent_a > sent_b ? sent_a - sent_b : sent_b - sent_a;
        printf("目标时刻 %lld  实际发送 A=%lld B=%lld  偏差=%lldms %s\n",
               target, sent_a, sent_b, diff, diff <= 10 ? "(≤10ms 达标)" : "(超标)");
        close_session(b);
        rc = diff <= 10 ? 0 : 1;
    } else if (cmd == "replay" && argc >= 4) {
        // replay <serial> <file_utf8> [speed] [loops]：异步回放 + 状态轮询
        double speed = argc >= 5 ? atof(argv[4]) : 1.0;
        long long loops = argc >= 6 ? atoll(argv[5]) : 1;
        int wchars = MultiByteToWideChar(CP_UTF8, 0, argv[3], -1, nullptr, 0);
        std::wstring wpath(wchars, 0);
        MultiByteToWideChar(CP_UTF8, 0, argv[3], -1, &wpath[0], wchars);
        wpath.pop_back(); // 去掉 -1 换算带回的终结符（_wfopen 靠它没事，但保持一致干净）
        long long t0 = host_clock_ms();
        if (replay_start(s, wpath.c_str(), speed, loops, &err)) { fprintf(stderr, "回放启动失败: %s\n", err); rc = 1; }
        else {
            while (true) {
                std::string st = replay_status(s);
                printf("[%lldms] %s\n", host_clock_ms() - t0, st.c_str());
                if (st.find("回放中") == std::string::npos) break;
                sleep_ms(300);
            }
            std::string st = replay_status(s);
            rc = st.find("已完成") != std::string::npos ? 0 : 1;
        }
    } else if (cmd == "clock") {
        printf("clock=%lld\n", host_clock_ms());
    } else if (cmd == "cmd" && argc >= 4) {
        // cmd <serial> <json...>：发送自定义控制 JSON（LBAC 通道 2）并收 6 秒回执/事件帧
        std::string payload = argv[3];
        for (int i = 4; i < argc; i++) { payload += " "; payload += argv[i]; }
        const char* cerr = "";
        if (open_data_channel(s, 1000, &cerr)) {
            fprintf(stderr, "打开数据通道失败: %s\n", cerr);
            fprintf(stderr, "err hex:");
            for (const unsigned char* p = (const unsigned char*)cerr; *p; p++) fprintf(stderr, " %02x", *p);
            fprintf(stderr, "\n");
            rc = 1;
        }
        else {
            const std::string ping = "{\"cmd\":\"ping\",\"t\":0}";
            if (data_send(s, 2, (const unsigned char*)ping.data(), (int)ping.size(), &cerr)) {
                fprintf(stderr, "发 ping 失败: %s\n", cerr); rc = 1;
            } else if (data_send(s, 2, (const unsigned char*)payload.data(), (int)payload.size(), &cerr)) {
                fprintf(stderr, "发指令失败: %s\n", cerr); rc = 1;
            } else {
                printf("已发送: %s\n", payload.c_str());
                long long deadline = host_clock_ms() + 6000;
                while (host_clock_ms() < deadline) {
                    std::vector<unsigned char> frame;
                    int ch = -1;
                    int r = data_recv(s, 400, &frame, &ch, &cerr);
                    if (r == 0 && ch == 2) {
                        std::string text(frame.begin(), frame.end());
                        printf("收到: %s\n", text.c_str());
                        if (text.find("\"type\":\"result\"") != std::string::npos) break;
                    } else if (r < 0) { fprintf(stderr, "收帧失败: %s\n", cerr); break; }
                }
            }
            close_data_channel(s);
        }
    } else {
        fprintf(stderr, "未知子命令或参数不足: %s\n", cmd.c_str()); rc = 2;
    }

    close_session(s);
    return rc;
}
