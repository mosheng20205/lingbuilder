// aoa_bridge.cpp — 中文命令桥接实现：会话注册表 + 手势封装（单击/双击/长按/滑动/捏合）
// 1.1.0 新增：压感笔、键盘组合/多媒体键、多机同步组、剧本录制回放。
#include "aoa_bridge.h"
#include "aoa_hid.h"

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <map>
#include <mutex>
#include <thread>
#include <chrono>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#endif

namespace {

std::wstring g_last_bridge_error; // 最近一次中文命令失败的宽字符原因（AOA_取错误 读取）

// 会话/数据通道注册表锁：同步组与回放线程会并发查找，必须与用户线程的打开/关闭互斥
std::mutex g_registry_mutex;

std::map<long long, aoahid::Session*>& registry() {
    static std::map<long long, aoahid::Session*> map;
    return map;
}

long long g_next_id = 1;

aoahid::Session* lookup(long long 设备) {
    std::lock_guard<std::mutex> lk(g_registry_mutex);
    auto& map = registry();
    auto it = map.find(设备);
    return it == map.end() ? nullptr : it->second;
}

std::wstring to_wide(const char* s) {
    if (!s || !*s) return std::wstring();
    // 库内错误文本是 UTF-8 窄串，转宽字符串返回给 LingCpp
    std::wstring out;
    const unsigned char* p = (const unsigned char*)s;
    while (*p) {
        if (*p < 0x80) { out += (wchar_t)*p++; }
        else if ((*p & 0xE0) == 0xC0) { out += (wchar_t)(((p[0] & 0x1F) << 6) | (p[1] & 0x3F)); p += 2; }
        else if ((*p & 0xF0) == 0xE0) { out += (wchar_t)(((p[0] & 0x0F) << 12) | ((p[1] & 0x3F) << 6) | (p[2] & 0x3F)); p += 3; }
        else { out += (wchar_t)(0xFFFD); p += 4; }
    }
    return out;
}

void sleep_ms(long long ms) {
    if (ms > 0) std::this_thread::sleep_for(std::chrono::milliseconds(ms));
}

// 中文文本 → 窄字节（仅 ASCII 用于键盘输入）
bool wide_to_ascii(const std::wstring& 文本, std::string& out, std::wstring& err) {
    out.clear();
    for (wchar_t c : 文本) {
        if (c >= 0x20 && c < 0x7F) out += (char)c;
        else { err = L"键盘输入仅支持 ASCII 可见字符与空格换行，中文请改用输入法方案"; return false; }
    }
    return true;
}

// 数据通道句柄注册表：通道句柄 → 设备句柄（设备关闭时一并失效）
std::map<long long, long long>& channel_registry() {
    static std::map<long long, long long> map;
    return map;
}

aoahid::Session* channel_session(long long 通道, long long* out_device_id) {
    std::lock_guard<std::mutex> lk(g_registry_mutex);
    auto& map = channel_registry();
    auto it = map.find(通道);
    if (it == map.end()) return nullptr;
    auto& sessions = registry();
    auto sit = sessions.find(it->second);
    if (sit == sessions.end()) return nullptr;
    if (out_device_id) *out_device_id = it->second;
    return sit->second;
}

void drop_channels_of_device(long long 设备) {
    std::lock_guard<std::mutex> lk(g_registry_mutex);
    auto& map = channel_registry();
    for (auto it = map.begin(); it != map.end();) {
        if (it->second == 设备) it = map.erase(it);
        else ++it;
    }
}

// ---- 动作录制钩子（剧本录制；回放线程内部经核心库抑制标志自动跳过）--------------

long long steady_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

// 滑动动作（桥层手势与同步组共用的实现；单触点 down → 分步 move → up）
bool perform_swipe(aoahid::Session* s, long long x1, long long y1, long long x2, long long y2,
                   long long 时长毫秒, std::wstring* why) {
    const char* err = "";
    int cid = 0;
    if (aoahid::touch_down(s, (int)x1, (int)y1, &cid, &err)) { *why = to_wide(err); return false; }
    aoahid::record_note("down", cid, x1, y1, 0);
    int steps = (int)(时长毫秒 > 0 ? 时长毫秒 / 12 : 25);
    if (steps < 5) steps = 5;
    if (steps > 200) steps = 200;
    for (int i = 1; i <= steps; i++) {
        long long x = x1 + (x2 - x1) * i / steps;
        long long y = y1 + (y2 - y1) * i / steps;
        if (aoahid::touch_move(s, cid, (int)x, (int)y, &err)) {
            *why = to_wide(err);
            const char* e2 = "";
            aoahid::touch_reset(s, &e2);
            return false;
        }
        aoahid::record_note("move", cid, x, y, 0);
        sleep_ms(时长毫秒 > 0 ? 时长毫秒 / steps : 12);
    }
    if (aoahid::touch_up(s, cid, &err)) { *why = to_wide(err); return false; }
    aoahid::record_note("up", cid, 0, 0, 0);
    return true;
}

// ---- 多机同步组 ----------------------------------------------------------------

struct GroupTask {
    long long at = 0;          // 目标时刻（AOA_取时钟 时基）
    bool swipe = false;
    long long x1 = 0, y1 = 0, x2 = 0, y2 = 0, dur = 0;
};

struct SyncGroup {
    std::mutex mu;
    std::condition_variable cv;
    std::deque<GroupTask> tasks;
    std::vector<long long> devices;
    std::thread worker;
    bool running = false;
};

std::mutex g_groups_mutex;
std::map<long long, SyncGroup*> g_groups;
long long g_next_group_id = 1;

// 单设备到点动作：先对齐到目标时刻（线程提前启动，sleep_until 精确对齐），再执行动作
void group_device_run(aoahid::Session* s, const GroupTask& task, long long at, long long* sent_at) {
    auto target = std::chrono::steady_clock::time_point(std::chrono::milliseconds(at));
    std::this_thread::sleep_until(target);
    *sent_at = steady_ms();
    const char* err = "";
    if (!task.swipe) {
        int cid = 0;
        if (aoahid::touch_down(s, (int)task.x1, (int)task.y1, &cid, &err)) return;
        sleep_ms(80);
        aoahid::touch_up(s, cid, &err);
    } else {
        std::wstring why;
        perform_swipe(s, task.x1, task.y1, task.x2, task.y2, task.dur, &why);
    }
}

void group_worker(SyncGroup* g) {
    std::unique_lock<std::mutex> lk(g->mu);
    while (g->running) {
        if (g->tasks.empty()) { g->cv.wait(lk); continue; }
        auto earliest = std::min_element(g->tasks.begin(), g->tasks.end(),
                                         [](const GroupTask& a, const GroupTask& b) { return a.at < b.at; });
        long long at = earliest->at;
        long long now = steady_ms();
        if (at > now + 15) {
            // 提前 15ms 醒来给线程启动留时间；期间有新任务/清空会被 notify 唤醒重估
            std::chrono::steady_clock::time_point wake(std::chrono::milliseconds(at - 15));
            g->cv.wait_until(lk, wake);
            continue;
        }
        GroupTask task = *earliest;
        g->tasks.erase(earliest);
        std::vector<long long> devs = g->devices;
        lk.unlock();
        // 每设备一个线程：先全部启动（此刻距目标 ≤15ms），线程内 sleep_until 同一时刻对齐
        std::vector<std::thread> threads;
        std::vector<long long> sent_at(devs.size(), 0);
        for (size_t i = 0; i < devs.size(); i++) {
            aoahid::Session* s = lookup(devs[i]); // 设备可能已关闭，跳过
            if (!s) continue;
            threads.emplace_back(group_device_run, s, task, at, &sent_at[i]);
        }
        for (auto& t : threads) t.join();
        lk.lock();
    }
}

// 设备关闭时把该设备从所有同步组摘除（组与任务不受影响，到点时查不到设备自动跳过）
void remove_device_from_groups(long long 设备) {
    std::lock_guard<std::mutex> lk(g_groups_mutex);
    for (auto& kv : g_groups) {
        std::lock_guard<std::mutex> gk(kv.second->mu);
        kv.second->devices.erase(std::remove(kv.second->devices.begin(), kv.second->devices.end(), 设备),
                                 kv.second->devices.end());
    }
}

SyncGroup* find_group(long long 组ID) {
    std::lock_guard<std::mutex> lk(g_groups_mutex);
    auto it = g_groups.find(组ID);
    return it == g_groups.end() ? nullptr : it->second;
}

} // namespace

long long AOA_打开设备(const std::wstring& 序列号) {
    std::string serial;
    for (wchar_t c : 序列号) {
        if (c < 0x80) serial += (char)c;
        else { g_last_bridge_error = L"序列号只能包含 ASCII 字符"; return 0; }
    }
    aoahid::Session* s = aoahid::open_by_serial(serial.empty() ? "any" : serial);
    if (!s) { g_last_bridge_error = to_wide(aoahid::last_error().c_str()); return 0; }
    std::lock_guard<std::mutex> lk(g_registry_mutex);
    long long id = g_next_id++;
    registry()[id] = s;
    return id;
}

bool AOA_关闭设备(long long 设备) {
    aoahid::Session* s = nullptr;
    {
        std::lock_guard<std::mutex> lk(g_registry_mutex);
        auto& map = registry();
        auto it = map.find(设备);
        if (it == map.end()) { g_last_bridge_error = L"设备句柄无效"; return false; }
        s = it->second;
        map.erase(it);
    }
    // 先回收依赖该会话的后台资源（回放线程持有会话指针，必须先停再关）
    aoahid::replay_dispose(s);
    aoahid::close_session(s);
    drop_channels_of_device(设备);
    remove_device_from_groups(设备);
    return true;
}

std::wstring AOA_取设备列表() {
    std::wstring out;
    for (auto& d : aoahid::list_devices()) {
        std::wstring line;
        for (char c : d.serial) line += (wchar_t)c;
        line += L"|";
        for (char c : d.product) line += (wchar_t)c;
        line += d.accessory ? L"|配件模式" : L"|普通模式";
        if (d.accessory)
            line += d.driver_ok ? L"|可打开" : L"|需驱动";
        if (!out.empty()) out += L"\n";
        out += line;
    }
    return out;
}

// ---- 驱动安装（引导式一期；libwdi 静默助手为二期）------------------------------
// 段 B 实测定案：联网机器（Win11 + NAT）插上配件设备 Windows Update 自动装 WinUSB，零手动；
// 离线/驱动被清的场景走引导式：自动下载（有网）并拉起 Zadig，分步中文指引进 AOA_取错误()。

namespace {

// 动态加载 urlmon/shell32：桥随用户工程编译，不得引入新链接库依赖
typedef HRESULT (__stdcall *URLDownloadToFileW_t)(void*, const wchar_t*, const wchar_t*, DWORD, void*);
typedef void* (__stdcall *ShellExecuteW_t)(HWND, const wchar_t*, const wchar_t*, const wchar_t*, const wchar_t*, int);

std::wstring local_app_data() {
    wchar_t path[MAX_PATH] = {0};
    GetEnvironmentVariableW(L"LOCALAPPDATA", path, MAX_PATH);
    return path;
}

} // namespace

bool AOA_安装驱动(long long 序列号) {
    (void)序列号; // 一期引导式不区分设备：Zadig 列表里用户自己选 Android Accessory Interface
    // 1) 目标目录 %LOCALAPPDATA%\LingBuilder
    std::wstring dir = local_app_data() + L"\\LingBuilder";
    CreateDirectoryW(dir.c_str(), nullptr);
    std::wstring exe = dir + L"\\zadig-2.9.exe";
    // 2) 无缓存则下载（官方直链；下载失败仍尝试拉起本地旧版）
    // 2026-10-20 修正：zadig.akeo.ie/downloads 路径已 404，Zadig 发布挂在 libwdi 的
    // GitHub Releases（tag 是 libwdi 版本号，不是 zadig 版本号）。
    DWORD attr = GetFileAttributesW(exe.c_str());
    if (attr == INVALID_FILE_ATTRIBUTES || (attr & FILE_ATTRIBUTE_DIRECTORY)) {
        HMODULE urlmon = LoadLibraryW(L"urlmon.dll");
        if (urlmon) {
            URLDownloadToFileW_t dl = (URLDownloadToFileW_t)GetProcAddress(urlmon, "URLDownloadToFileW");
            if (dl) dl(nullptr, L"https://github.com/pbatard/libwdi/releases/download/v1.5.1/zadig-2.9.exe", exe.c_str(), 0, nullptr);
            FreeLibrary(urlmon);
        }
    }
    attr = GetFileAttributesW(exe.c_str());
    if (attr == INVALID_FILE_ATTRIBUTES) {
        g_last_bridge_error =
            L"未能在本机准备 Zadig（需联网下载或手动放置）。手动方案：浏览器打开 "
            L"github.com/pbatard/libwdi/releases 下载 Zadig。需要给两处装 WinUSB："
            L"①配件模式设备 Android Accessory Interface（18D1:2D0x）；"
            L"②手机引导口（MTP 模式 2717:FF40）——②在拔插后会漂回 MTP 驱动属 Windows 排名机制"
            L"（inbox 恒优于自签），每次插线重装一次即可，完成后再试 AOA_打开设备。"
            L"免 Zadig 的无人值守方案：签名 WinUSB INF + UpdateDriverForPlugAndPlayDevices "
            L"强配（工具链见 electron/native/aoa-hid/driver/）。";
        return false;
    }
    // 3) 拉起 Zadig（其清单自带 UAC 提权）
    HMODULE shell32 = LoadLibraryW(L"shell32.dll");
    bool launched = false;
    if (shell32) {
        ShellExecuteW_t sh = (ShellExecuteW_t)GetProcAddress(shell32, "ShellExecuteW");
        if (sh) {
            void* r = sh(nullptr, L"open", exe.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
            launched = (INT_PTR)r > 32;
        }
        FreeLibrary(shell32);
    }
    if (!launched) {
        g_last_bridge_error = L"Zadig 已在本地但拉起失败，请手动运行：" + exe;
        return false;
    }
    g_last_bridge_error =
        L"已拉起 Zadig 驱动安装器，分步指引：① 下拉设备框选「Android Accessory Interface "
        L"(18D1:2D0x)」；② 右侧驱动选 WinUSB；③ 点 Install Driver 等待完成；"
        L"④ 完成后重插一次数据线再 AOA_打开设备。此命令返回假属正常（安装需人工确认）。";
    return false; // 引导式：需要用户在 Zadig 里确认，返回假并把指引留在错误通道
}

bool AOA_注册触摸(long long 设备) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    int r = aoahid::register_touch(s, &err);
    if (r) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

long long AOA_手指按下(long long 设备, long long x, long long y) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return 0; }
    const char* err = "";
    int cid = 0;
    if (aoahid::touch_down(s, (int)x, (int)y, &cid, &err)) { g_last_bridge_error = to_wide(err); return 0; }
    aoahid::record_note("down", cid, x, y, 0);
    return cid;
}

bool AOA_手指移动(long long 设备, long long 触点号, long long x, long long y) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::touch_move(s, (int)触点号, (int)x, (int)y, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("move", (int)触点号, x, y, 0);
    return true;
}

bool AOA_手指抬起(long long 设备, long long 触点号) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::touch_up(s, (int)触点号, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("up", (int)触点号, 0, 0, 0);
    return true;
}

bool AOA_单击(long long 设备, long long x, long long y) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    int cid = 0;
    if (aoahid::touch_down(s, (int)x, (int)y, &cid, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("down", cid, x, y, 0);
    sleep_ms(80);
    if (aoahid::touch_up(s, cid, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("up", cid, 0, 0, 0);
    return true;
}

bool AOA_双击(long long 设备, long long x, long long y) {
    if (!AOA_单击(设备, x, y)) return false;
    sleep_ms(90);
    return AOA_单击(设备, x, y);
}

bool AOA_长按(long long 设备, long long x, long long y, long long 毫秒) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    int cid = 0;
    if (aoahid::touch_down(s, (int)x, (int)y, &cid, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("down", cid, x, y, 0);
    sleep_ms(毫秒 > 0 ? 毫秒 : 800);
    if (aoahid::touch_up(s, cid, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("up", cid, 0, 0, 0);
    return true;
}

bool AOA_滑动(long long 设备, long long x1, long long y1, long long x2, long long y2, long long 时长毫秒) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    std::wstring why;
    if (!perform_swipe(s, x1, y1, x2, y2, 时长毫秒, &why)) { g_last_bridge_error = why; return false; }
    return true;
}

bool AOA_捏合(long long 设备, long long 中心x, long long 中心y, long long 起始间距, long long 结束间距, long long 时长毫秒) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    int cidA = 0, cidB = 0;
    if (aoahid::touch_down(s, (int)(中心x - 起始间距), (int)中心y, &cidA, &err) ||
        aoahid::touch_down(s, (int)(中心x + 起始间距), (int)中心y, &cidB, &err)) {
        g_last_bridge_error = to_wide(err); aoahid::touch_reset(s, &err); return false;
    }
    aoahid::record_note("down", cidA, 中心x - 起始间距, 中心y, 0);
    aoahid::record_note("down", cidB, 中心x + 起始间距, 中心y, 0);
    int steps = (int)(时长毫秒 > 0 ? 时长毫秒 / 16 : 24);
    if (steps < 5) steps = 5;
    if (steps > 200) steps = 200;
    for (int i = 1; i <= steps; i++) {
        long long d = 起始间距 + (结束间距 - 起始间距) * i / steps;
        if (aoahid::touch_move(s, cidA, (int)(中心x - d), (int)中心y, &err) ||
            aoahid::touch_move(s, cidB, (int)(中心x + d), (int)中心y, &err)) {
            g_last_bridge_error = to_wide(err); aoahid::touch_reset(s, &err); return false;
        }
        aoahid::record_note("move", cidA, 中心x - d, 中心y, 0);
        aoahid::record_note("move", cidB, 中心x + d, 中心y, 0);
        sleep_ms(时长毫秒 > 0 ? 时长毫秒 / steps : 16);
    }
    if (aoahid::touch_up(s, cidA, &err) || aoahid::touch_up(s, cidB, &err)) {
        g_last_bridge_error = to_wide(err); return false;
    }
    aoahid::record_note("up", cidA, 0, 0, 0);
    aoahid::record_note("up", cidB, 0, 0, 0);
    return true;
}

bool AOA_重置触摸(long long 设备) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    aoahid::touch_reset(s, &err);
    return true;
}

bool AOA_键盘输入(long long 设备, const std::wstring& 文本) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    std::string ascii;
    std::wstring why;
    if (!wide_to_ascii(文本, ascii, why)) { g_last_bridge_error = why; return false; }
    const char* err = "";
    if (aoahid::type_text(s, ascii.c_str(), &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note_text(aoahid::wide_to_utf8(文本));
    return true;
}

bool AOA_键盘按键(long long 设备, long long 键码) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::key_down(s, (unsigned char)键码, &err)) { g_last_bridge_error = to_wide(err); return false; }
    sleep_ms(30);
    if (aoahid::key_up(s, (unsigned char)键码, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("key", 0, 键码, 0, 0);
    return true;
}

bool AOA_键盘组合(long long 设备, long long 修饰键, long long 键码) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    if (修饰键 <= 0 || 修饰键 > 15) { g_last_bridge_error = L"修饰键掩码非法（1=Ctrl 2=Shift 4=Alt 8=GUI，可组合）"; return false; }
    const char* err = "";
    if (aoahid::key_combo(s, (unsigned char)修饰键, (unsigned char)键码, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("key", 0, 键码, 修饰键, 0);
    return true;
}

bool AOA_多媒体键(long long 设备, long long 键码) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::media_key(s, (unsigned)键码, &err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

bool AOA_鼠标移动(long long 设备, long long dx, long long dy) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::mouse_move(s, (int)dx, (int)dy, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("mouse", 0, dx, dy, 0);
    return true;
}

bool AOA_鼠标点击(long long 设备, long long 按钮) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::mouse_button(s, (int)按钮, true, &err)) { g_last_bridge_error = to_wide(err); return false; }
    sleep_ms(50);
    if (aoahid::mouse_button(s, (int)按钮, false, &err)) { g_last_bridge_error = to_wide(err); return false; }
    int mask = 按钮 == 1 ? 1 : 按钮 == 2 ? 2 : 4;
    aoahid::record_note("mouse", mask, 0, 0, 0);
    return true;
}

bool AOA_鼠标滚轮(long long 设备, long long 滚动量) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::mouse_wheel(s, (int)滚动量, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("mouse", 0, 0, 0, 滚动量);
    return true;
}

bool AOA_设置屏幕旋转(long long 设备, long long 角度) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::set_session_rotation(s, (int)角度, &err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

// ---- 数据通道（AOAv2 配件 bulk 端点）----------------------------------------

long long AOA_打开数据通道(long long 设备, long long 超时毫秒) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return 0; }
    const char* err = "";
    if (aoahid::open_data_channel(s, 超时毫秒, &err)) { g_last_bridge_error = to_wide(err); return 0; }
    // 成功即清空错误通道：宿主常在成功后也把 AOA_取错误 打进日志（"ch=1 err=..."），
    // 残留上一次失败文案会让人误判通道有问题。
    g_last_bridge_error.clear();
    static long long g_next_channel_id = 1;
    long long id = g_next_channel_id++;
    channel_registry()[id] = 设备;
    return id;
}

std::vector<unsigned char> AOA_数据通道收帧(long long 通道, long long 超时毫秒) {
    std::vector<unsigned char> empty;
    long long 设备 = 0;
    aoahid::Session* s = channel_session(通道, &设备);
    if (!s) { g_last_bridge_error = L"数据通道句柄无效（设备可能已关闭）"; return empty; }
    const char* err = "";
    std::vector<unsigned char> payload;
    int channel_id = -1;
    int r = aoahid::data_recv(s, 超时毫秒, &payload, &channel_id, &err);
    if (r < 0) { g_last_bridge_error = to_wide(err); return empty; }
    // 2026-10-21：成功与超时都清空错误通道。宿主靠「AOA_取错误 非空」区分
    // 「这一拍没帧（正常）」和「这条通道已经坏了（设备拔出/重枚举）」，残留旧错误会误判。
    g_last_bridge_error.clear();
    return payload; // r == 1 超时无帧 → 空字节集
}

bool AOA_数据通道发帧(long long 通道, const std::vector<unsigned char>& 数据) {
    long long 设备 = 0;
    aoahid::Session* s = channel_session(通道, &设备);
    if (!s) { g_last_bridge_error = L"数据通道句柄无效（设备可能已关闭）"; return false; }
    const char* err = "";
    // PC → 手机方向固定走 LBAC 通道 2（控制/事件）；通道 1 保留给手机侧视频流
    if (aoahid::data_send(s, 2, 数据.empty() ? nullptr : 数据.data(), (int)数据.size(), &err)) {
        g_last_bridge_error = to_wide(err);
        return false;
    }
    return true;
}

bool AOA_关闭数据通道(long long 通道) {
    long long 设备 = 0;
    aoahid::Session* s = channel_session(通道, &设备);
    if (!s) { g_last_bridge_error = L"数据通道句柄无效"; return false; }
    aoahid::close_data_channel(s);
    channel_registry().erase(通道);
    return true;
}

// ---- 压感笔（数位板/绘画压感；独立 HID 设备，可与手指触摸共存）------------------

bool AOA_注册触摸笔(long long 设备) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::register_pen(s, &err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

long long AOA_笔按下(long long 设备, long long x, long long y, long long 压力) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return 0; }
    const char* err = "";
    int cid = 0;
    if (aoahid::pen_down(s, (int)x, (int)y, (int)压力, &cid, &err)) { g_last_bridge_error = to_wide(err); return 0; }
    aoahid::record_note("pendown", cid, x, y, 压力);
    return cid;
}

bool AOA_笔移动(long long 设备, long long 触点号, long long x, long long y, long long 压力) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::pen_move(s, (int)触点号, (int)x, (int)y, (int)压力, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("penmove", (int)触点号, x, y, 压力);
    return true;
}

bool AOA_笔抬起(long long 设备, long long 触点号) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::pen_up(s, (int)触点号, &err)) { g_last_bridge_error = to_wide(err); return false; }
    aoahid::record_note("penup", (int)触点号, 0, 0, 0);
    return true;
}

// ---- 多机同步组（主机时钟时基；到点并行派发）------------------------------------

long long AOA_取时钟() {
    return steady_ms();
}

long long AOA_创建同步组() {
    std::lock_guard<std::mutex> lk(g_groups_mutex);
    SyncGroup* g = new SyncGroup();
    g->running = true;
    g->worker = std::thread(group_worker, g);
    long long id = g_next_group_id++;
    g_groups[id] = g;
    return id;
}

bool AOA_组加入设备(long long 组ID, long long 设备) {
    SyncGroup* g = find_group(组ID);
    if (!g) { g_last_bridge_error = L"同步组 ID 无效"; return false; }
    if (!lookup(设备)) { g_last_bridge_error = L"设备句柄无效"; return false; }
    std::lock_guard<std::mutex> gk(g->mu);
    for (long long d : g->devices)
        if (d == 设备) return true; // 重复加入按幂等成功
    g->devices.push_back(设备);
    return true;
}

bool AOA_组单击(long long 组ID, long long x, long long y, long long 目标时刻毫秒) {
    SyncGroup* g = find_group(组ID);
    if (!g) { g_last_bridge_error = L"同步组 ID 无效"; return false; }
    GroupTask task;
    task.at = 目标时刻毫秒;
    task.x1 = x; task.y1 = y;
    {
        std::lock_guard<std::mutex> gk(g->mu);
        g->tasks.push_back(task);
    }
    g->cv.notify_one();
    return true;
}

bool AOA_组滑动(long long 组ID, long long x1, long long y1, long long x2, long long y2,
                long long 时长毫秒, long long 目标时刻毫秒) {
    SyncGroup* g = find_group(组ID);
    if (!g) { g_last_bridge_error = L"同步组 ID 无效"; return false; }
    GroupTask task;
    task.at = 目标时刻毫秒;
    task.swipe = true;
    task.x1 = x1; task.y1 = y1; task.x2 = x2; task.y2 = y2; task.dur = 时长毫秒;
    {
        std::lock_guard<std::mutex> gk(g->mu);
        g->tasks.push_back(task);
    }
    g->cv.notify_one();
    return true;
}

bool AOA_组清空(long long 组ID) {
    SyncGroup* g = find_group(组ID);
    if (!g) { g_last_bridge_error = L"同步组 ID 无效"; return false; }
    {
        std::lock_guard<std::mutex> gk(g->mu);
        g->tasks.clear();
    }
    g->cv.notify_one();
    return true;
}

bool AOA_销毁同步组(long long 组ID) {
    {
        std::lock_guard<std::mutex> lk(g_groups_mutex);
        auto it = g_groups.find(组ID);
        if (it == g_groups.end()) { g_last_bridge_error = L"同步组 ID 无效"; return false; }
        SyncGroup* g = it->second;
        {
            std::lock_guard<std::mutex> gk(g->mu);
            g->tasks.clear();
            g->running = false;
        }
        g->cv.notify_all();
        if (g->worker.joinable()) g->worker.join(); // 等当前批次动作收尾（最多一个滑动时长）
        delete g;
        g_groups.erase(it);
    }
    return true;
}

// ---- 剧本录制回放 ---------------------------------------------------------------

bool AOA_开始录制(const std::wstring& 文件路径) {
    const char* err = "";
    if (aoahid::record_begin(文件路径.c_str(), &err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

bool AOA_停止录制() {
    const char* err = "";
    if (aoahid::record_stop(&err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

bool AOA_异步回放(long long 设备, const std::wstring& 文件路径, double 倍速, long long 循环次数) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    const char* err = "";
    if (aoahid::replay_start(s, 文件路径.c_str(), 倍速, 循环次数, &err)) { g_last_bridge_error = to_wide(err); return false; }
    return true;
}

std::wstring AOA_取回放状态(long long 设备) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return std::wstring(); }
    return to_wide(aoahid::replay_status(s).c_str());
}

bool AOA_停止回放(long long 设备) {
    aoahid::Session* s = lookup(设备);
    if (!s) { g_last_bridge_error = L"设备句柄无效"; return false; }
    aoahid::replay_stop(s);
    return true;
}

std::wstring AOA_取错误() {
    return g_last_bridge_error;
}
