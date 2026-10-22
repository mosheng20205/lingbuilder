// aoa_record.cpp — 剧本录制回放：UTF-8 CSV（type,timestamp_ms,contact_id,a,b,c）
//
// 录制器为进程级单例（全局录制所有设备的注入动作流，单机剧本场景）；
// 回放按会话管理：每个 Session 同时最多一个回放线程，协作式停止。
// 回放线程执行动作时经 g_replay_suppress 抑制录制钩子，避免“回放又被录进去”。
//
// 剧本行格式（全部 ASCII 字段，text 载荷用 base64，无 CSV 转义问题）：
//   down,t,cid,x,y,0        手指按下（x/y 为录制时的逻辑坐标 0~32767）
//   move,t,cid,x,y,0        手指移动
//   up,t,cid,0,0,0          手指抬起
//   pendown,t,cid,x,y,prs   笔按下（pressure 0~32767）
//   penmove,t,cid,x,y,prs   笔移动
//   penup,t,cid,0,0,0       笔抬起
//   key,t,keycode,mods,0,0  键盘（mods=修饰键位掩码，非 0 走组合键）
//   text,t,<base64(UTF-8)>,0,0,0  文本（base64 字符集不含逗号，规避 CSV 转义坑）
//   mouse,t,buttons,dx,dy,wheel  鼠标
#include "aoa_hid_internal.h"

#include <atomic>
#include <cstdio>
#include <cstring>
#include <map>
#include <mutex>
#include <thread>
#include <chrono>

#ifdef _WIN32
#include <windows.h>
#endif

namespace aoahid {

namespace {

long long steady_now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

// ---- base64（RFC 4648，自含实现避免额外依赖）---------------------------------

const char kBase64Table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string base64_encode(const std::string& in) {
    std::string out;
    out.reserve((in.size() + 2) / 3 * 4);
    size_t i = 0;
    while (i + 2 < in.size()) {
        unsigned v = (unsigned char)in[i] << 16 | (unsigned char)in[i + 1] << 8 | (unsigned char)in[i + 2];
        out += kBase64Table[(v >> 18) & 63];
        out += kBase64Table[(v >> 12) & 63];
        out += kBase64Table[(v >> 6) & 63];
        out += kBase64Table[v & 63];
        i += 3;
    }
    if (i + 1 == in.size()) {
        unsigned v = (unsigned char)in[i] << 16;
        out += kBase64Table[(v >> 18) & 63];
        out += kBase64Table[(v >> 12) & 63];
        out += "==";
    } else if (i + 2 == in.size()) {
        unsigned v = (unsigned char)in[i] << 16 | (unsigned char)in[i + 1] << 8;
        out += kBase64Table[(v >> 18) & 63];
        out += kBase64Table[(v >> 12) & 63];
        out += kBase64Table[(v >> 6) & 63];
        out += "=";
    }
    return out;
}

bool base64_decode(const std::string& in, std::string* out) {
    static int rev[256];
    static bool ready = false;
    if (!ready) {
        for (int i = 0; i < 256; i++) rev[i] = -1;
        for (int i = 0; i < 64; i++) rev[(unsigned char)kBase64Table[i]] = i;
        ready = true;
    }
    out->clear();
    unsigned buf = 0;
    int bits = 0;
    for (unsigned char c : in) {
        if (c == '=' || c == '\r' || c == '\n') continue;
        int v = rev[c];
        if (v < 0) return false;
        buf = buf << 6 | (unsigned)v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out->push_back((char)((buf >> bits) & 0xff));
        }
    }
    return true;
}

// ---- 录制器（进程级单例）------------------------------------------------------

struct Recorder {
    std::mutex mu;
    FILE* file = nullptr;
    long long start_ms = 0;
    long long last_error_line = 0;
};

Recorder& recorder() {
    static Recorder r;
    return r;
}

std::atomic<int> g_replay_suppress{0}; // 回放线程执行期间 >0，抑制录制钩子

void utf8_to_file(FILE* f, const std::string& s) {
    fwrite(s.data(), 1, s.size(), f);
}

// UTF-8 窄串 → 宽路径（.lcpp 传来的中文路径在桥层已是 wchar_t*，核心库直接收宽串）
FILE* open_wide(const wchar_t* path, const wchar_t* mode) {
#ifdef _WIN32
    return _wfopen(path, mode);
#else
    (void)path; (void)mode;
    return nullptr;
#endif
}

// 逐级创建文件路径的父目录（_wfopen 不建目录；.lcpp 用户常给不存在的剧本目录）
void ensure_parent_directory(const wchar_t* path) {
#ifdef _WIN32
    std::wstring dir(path);
    size_t slash = dir.find_last_of(L"\\/");
    if (slash == std::wstring::npos || slash == 0) return;
    dir.resize(slash);
    if (dir.size() <= 2) return; // 盘符根
    for (size_t i = 1; i < dir.size(); i++) {
        if (dir[i] == L'\\' || dir[i] == L'/') {
            std::wstring level = dir.substr(0, i);
            if (level.size() > 2) CreateDirectoryW(level.c_str(), nullptr); // 盘符根跳过
        }
    }
    CreateDirectoryW(dir.c_str(), nullptr);
#else
    (void)path;
#endif
}

// ---- 回放器（每会话一个任务；Replay 由 map 持有到会话关闭）----------------------

struct Replay {
    std::thread worker;                 // 由外部 join 收尸（见 replay_stop）
    std::mutex mu;
    std::string status = "空闲";
    std::atomic<bool> stop{false};
    std::atomic<bool> active{false};
    long long loops_total = 0;
};

std::mutex& replay_map_mutex() {
    static std::mutex m;
    return m;
}

std::map<Session*, Replay*>& replay_map() {
    static std::map<Session*, Replay*> m;
    return m;
}

Replay* replay_of(Session* s) {
    std::lock_guard<std::mutex> lk(replay_map_mutex());
    auto it = replay_map().find(s);
    if (it != replay_map().end()) return it->second;
    Replay* r = new Replay();
    replay_map()[s] = r;
    return r;
}

void replay_set_status(Replay* r, const std::string& text) {
    std::lock_guard<std::mutex> lk(r->mu);
    r->status = text;
}

std::string replay_get_status(Replay* r) {
    std::lock_guard<std::mutex> lk(r->mu);
    return r->status;
}

// CSV 行解析：按逗号拆分为最多 6 列（字段不含引号/逗号——格式由本库写出）
int split_csv_line(const std::string& line, std::string cols[6]) {
    int n = 0;
    size_t pos = 0;
    while (n < 6) {
        size_t comma = line.find(',', pos);
        if (comma == std::string::npos) { cols[n++] = line.substr(pos); break; }
        cols[n++] = line.substr(pos, comma - pos);
        pos = comma + 1;
    }
    return n;
}

bool parse_ll(const std::string& s, long long* out) {
    if (s.empty()) return false;
    char* end = nullptr;
    *out = strtoll(s.c_str(), &end, 10);
    return end && *end == '\0';
}

// UTF-8 → 宽字符（文本载荷解码后送键盘；键盘输入本身仅 ASCII，超范围字符会被拒）
std::wstring utf8_to_wide(const std::string& in) {
    std::wstring out;
    size_t i = 0;
    while (i < in.size()) {
        unsigned char c = (unsigned char)in[i];
        if (c < 0x80) { out += (wchar_t)c; i += 1; }
        else if ((c & 0xE0) == 0xC0 && i + 1 < in.size()) {
            out += (wchar_t)(((c & 0x1F) << 6) | (in[i + 1] & 0x3F)); i += 2;
        } else if ((c & 0xF0) == 0xE0 && i + 2 < in.size()) {
            out += (wchar_t)(((c & 0x0F) << 12) | ((in[i + 1] & 0x3F) << 6) | (in[i + 2] & 0x3F)); i += 3;
        } else { out += 0xFFFD; i += 4; }
    }
    return out;
}

// 执行单行剧本。csv_cid → live_cid 映射由调用方维护（finger 类行）。
// 返回 "" 成功；非空 = 中文失败原因。
std::string replay_execute_line(Session* s, const std::string cols[6], int ncols,
                                std::map<int, int>& cid_map) {
    const std::string& type = cols[0];
    const char* err = "";
    if (type == "down" && ncols >= 6) {
        long long x = 0, y = 0;
        if (!parse_ll(cols[3], &x) || !parse_ll(cols[4], &y)) return "剧本行数值字段非法";
        long long csv_cid = 0;
        parse_ll(cols[2], &csv_cid);
        int live_cid = 0;
        if (touch_down(s, (int)x, (int)y, &live_cid, &err)) return err;
        cid_map[(int)csv_cid] = live_cid;
    } else if (type == "move" && ncols >= 6) {
        long long csv_cid = 0, x = 0, y = 0;
        parse_ll(cols[2], &csv_cid); parse_ll(cols[3], &x); parse_ll(cols[4], &y);
        auto it = cid_map.find((int)csv_cid);
        if (it == cid_map.end()) return "剧本 move 行引用了未按下的触点";
        if (touch_move(s, it->second, (int)x, (int)y, &err)) return err;
    } else if (type == "up" && ncols >= 3) {
        long long csv_cid = 0;
        parse_ll(cols[2], &csv_cid);
        auto it = cid_map.find((int)csv_cid);
        if (it == cid_map.end()) return ""; // 已抬起（重复 up）按幂等处理
        if (touch_up(s, it->second, &err)) return err;
        cid_map.erase(it);
    } else if (type == "pendown" && ncols >= 6) {
        long long x = 0, y = 0, prs = 0;
        parse_ll(cols[3], &x); parse_ll(cols[4], &y); parse_ll(cols[5], &prs);
        long long csv_cid = 0;
        parse_ll(cols[2], &csv_cid);
        int live_cid = 0;
        if (pen_down(s, (int)x, (int)y, (int)prs, &live_cid, &err)) return err;
        cid_map[(int)csv_cid] = live_cid;
    } else if (type == "penmove" && ncols >= 6) {
        long long csv_cid = 0, x = 0, y = 0, prs = 0;
        parse_ll(cols[2], &csv_cid); parse_ll(cols[3], &x); parse_ll(cols[4], &y); parse_ll(cols[5], &prs);
        auto it = cid_map.find((int)csv_cid);
        if (it == cid_map.end()) return "剧本 penmove 行引用了未按下的笔触点";
        if (pen_move(s, it->second, (int)x, (int)y, (int)prs, &err)) return err;
    } else if (type == "penup" && ncols >= 3) {
        long long csv_cid = 0;
        parse_ll(cols[2], &csv_cid);
        auto it = cid_map.find((int)csv_cid);
        if (it == cid_map.end()) return "";
        if (pen_up(s, it->second, &err)) return err;
        cid_map.erase(it);
    } else if (type == "key" && ncols >= 4) {
        long long keycode = 0, mods = 0;
        parse_ll(cols[2], &keycode); parse_ll(cols[3], &mods);
        if (mods) {
            if (key_combo(s, (uint8_t)mods, (uint8_t)keycode, &err)) return err;
        } else {
            if (key_down(s, (uint8_t)keycode, &err)) return err;
            std::this_thread::sleep_for(std::chrono::milliseconds(30));
            if (key_up(s, (uint8_t)keycode, &err)) return err;
        }
    } else if (type == "text" && ncols >= 3) {
        std::string decoded;
        if (!base64_decode(cols[2], &decoded)) return "剧本 text 行 base64 非法";
        if (type_text(s, decoded.c_str(), &err)) return err;
    } else if (type == "mouse" && ncols >= 6) {
        long long buttons = 0, dx = 0, dy = 0, wheel = 0;
        parse_ll(cols[2], &buttons); parse_ll(cols[3], &dx); parse_ll(cols[4], &dy); parse_ll(cols[5], &wheel);
        if (dx || dy) { if (mouse_move(s, (int)dx, (int)dy, &err)) return err; }
        if (buttons) {
            for (int b = 1; b <= 3; b++) {
                if (buttons & (1ll << (b - 1))) {
                    if (mouse_button(s, b, true, &err)) return err;
                    std::this_thread::sleep_for(std::chrono::milliseconds(50));
                    if (mouse_button(s, b, false, &err)) return err;
                }
            }
        }
        if (wheel) { if (mouse_wheel(s, (int)wheel, &err)) return err; }
    } else if (type == "type" || type == "timestamp_ms") {
        // 表头或未知行：跳过
    } else {
        return "未知剧本行类型：" + type;
    }
    return "";
}

void replay_worker(Session* s, Replay* r, std::vector<std::string> lines, double speed, long long loops) {
    g_replay_suppress++;
    long long done = 0;
    std::string failure;
    for (long long loop = 0; loop < loops && !r->stop; loop++) {
        replay_set_status(r, "回放中(第 " + std::to_string(loop + 1) + "/" + std::to_string(loops) + " 次)");
        long long prev_t = 0;
        std::map<int, int> cid_map;
        bool aborted = false;
        for (const std::string& line : lines) {
            if (r->stop) { aborted = true; break; }
            std::string cols[6];
            int ncols = split_csv_line(line, cols);
            if (ncols < 2) continue;
            long long t = 0;
            parse_ll(cols[1], &t);
            // 时间轴推进（倍速缩放）；停止请求在 sleep 中最多滞后一小段（分段睡保证响应）
            long long target = t - prev_t;
            if (target < 0) target = 0;
            long long waited = 0;
            long long scaled = (long long)((double)target / speed);
            while (waited < scaled && !r->stop) {
                long long step = scaled - waited > 20 ? 20 : scaled - waited;
                std::this_thread::sleep_for(std::chrono::milliseconds(step));
                waited += step;
            }
            if (r->stop) { aborted = true; break; }
            prev_t = t;
            std::string problem = replay_execute_line(s, cols, ncols, cid_map);
            if (!problem.empty()) { failure = problem; aborted = true; break; }
        }
        if (aborted) break;
        done = loop + 1;
    }
    // 收尾：清残留触点（失败/停止路径可能留按下状态）
    const char* err = "";
    touch_reset(s, &err);
    if (failure.empty()) {
        replay_set_status(r, r->stop ? "已停止（完成 " + std::to_string(done) + " 次）"
                                     : "已完成 " + std::to_string(done) + " 次");
    } else {
        replay_set_status(r, "失败：" + failure + "（完成 " + std::to_string(done) + " 次）");
    }
    r->loops_total = done;
    r->active = false;
    g_replay_suppress--;
}

std::vector<std::string> read_script_lines(const wchar_t* path, std::string* problem) {
    std::vector<std::string> lines;
    FILE* f = open_wide(path, L"rb");
    if (!f) { *problem = "无法打开剧本文件"; return lines; }
    std::string all;
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof buf, f)) > 0) all.append(buf, n);
    fclose(f);
    if (all.size() >= 3 && (unsigned char)all[0] == 0xEF && (unsigned char)all[1] == 0xBB && (unsigned char)all[2] == 0xBF)
        all.erase(0, 3); // 容忍 BOM
    size_t pos = 0;
    while (pos <= all.size()) {
        size_t eol = all.find('\n', pos);
        std::string line = all.substr(pos, eol == std::string::npos ? std::string::npos : eol - pos);
        while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
        if (!line.empty()) lines.push_back(line);
        if (eol == std::string::npos) break;
        pos = eol + 1;
    }
    if (lines.empty()) *problem = "剧本文件为空";
    return lines;
}

} // namespace

// ---- 录制 --------------------------------------------------------------------

int record_begin(const wchar_t* path, const char** err) {
    *err = "";
    record_stop(err);
    ensure_parent_directory(path); // 父目录不存在时逐级创建（_wfopen 不建目录）
    std::lock_guard<std::mutex> lk(recorder().mu);
    FILE* f = open_wide(path, L"wb");
    if (!f) { *err = "无法创建录制文件（检查路径与权限）"; return -1; }
    utf8_to_file(f, "type,timestamp_ms,contact_id,a,b,c\n");
    recorder().file = f;
    recorder().start_ms = steady_now_ms();
    return 0;
}

int record_stop(const char** err) {
    *err = "";
    std::lock_guard<std::mutex> lk(recorder().mu);
    if (recorder().file) {
        fclose(recorder().file);
        recorder().file = nullptr;
    }
    return 0;
}

bool record_active() {
    std::lock_guard<std::mutex> lk(recorder().mu);
    return recorder().file != nullptr;
}

void record_note(const char* type, int contact_id, long long a, long long b, long long c) {
    if (g_replay_suppress.load() > 0) return; // 回放产生的动作不录
    std::lock_guard<std::mutex> lk(recorder().mu);
    if (!recorder().file) return;
    long long t = steady_now_ms() - recorder().start_ms;
    char line[192];
    snprintf(line, sizeof line, "%s,%lld,%d,%lld,%lld,%lld\n", type, t, contact_id, a, b, c);
    fwrite(line, 1, strlen(line), recorder().file);
    fflush(recorder().file); // 崩溃/强退时保住已录内容
}

void record_note_text(const std::string& utf8_text) {
    if (g_replay_suppress.load() > 0) return;
    std::lock_guard<std::mutex> lk(recorder().mu);
    if (!recorder().file) return;
    long long t = steady_now_ms() - recorder().start_ms;
    std::string b64 = base64_encode(utf8_text);
    std::string line = "text," + std::to_string(t) + "," + b64 + ",0,0,0\n";
    fwrite(line.data(), 1, line.size(), recorder().file);
    fflush(recorder().file);
}

// 桥层键盘文本编码钩子：宽字符 → UTF-8 窄串（供 base64）
std::string wide_to_utf8(const std::wstring& in) {
    std::string out;
    for (wchar_t c : in) {
        unsigned v = (unsigned)c;
        if (v < 0x80) out += (char)v;
        else if (v < 0x800) {
            out += (char)(0xC0 | (v >> 6));
            out += (char)(0x80 | (v & 0x3F));
        } else {
            out += (char)(0xE0 | (v >> 12));
            out += (char)(0x80 | ((v >> 6) & 0x3F));
            out += (char)(0x80 | (v & 0x3F));
        }
    }
    return out;
}

// ---- 回放 --------------------------------------------------------------------

int replay_start(Session* s, const wchar_t* path, double speed, long long loops, const char** err) {
    *err = "";
    if (!s) { *err = "设备会话无效"; return -1; }
    if (speed <= 0) speed = 1.0;
    if (loops < 1) loops = 1;
    std::string problem;
    std::vector<std::string> lines = read_script_lines(path, &problem);
    if (!problem.empty()) { *err = problem.c_str(); return -1; }
    Replay* r = replay_of(s);
    if (r->active.load()) { *err = "该设备已有回放任务在运行（先 AOA_停止回放）"; return -1; }
    // 收上次线程尸（已完成但未 join）
    if (r->worker.joinable()) r->worker.join();
    r->stop = false;
    r->active = true;
    r->loops_total = 0;
    replay_set_status(r, "回放中(第 1/" + std::to_string(loops) + " 次)");
    r->worker = std::thread(replay_worker, s, r, std::move(lines), speed, loops);
    return 0;
}

std::string replay_status(Session* s) {
    Replay* r = replay_of(s);
    return replay_get_status(r);
}

int replay_stop(Session* s) {
    Replay* r = replay_of(s);
    r->stop = true;
    if (r->worker.joinable() && r->worker.get_id() != std::this_thread::get_id()) {
        r->worker.join(); // 等线程函数完全返回，随后可安全复用/销毁
    }
    return 0;
}

void replay_dispose(Session* s) {
    // 会话关闭前调用：停止并回收回放线程与状态对象
    replay_stop(s);
    std::lock_guard<std::mutex> lk(replay_map_mutex());
    auto it = replay_map().find(s);
    if (it == replay_map().end()) return;
    if (it->second->worker.joinable()) it->second->worker.join();
    delete it->second;
    replay_map().erase(it);
}

} // namespace aoahid
