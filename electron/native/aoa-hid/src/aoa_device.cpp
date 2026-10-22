// aoa_device.cpp — libusb 设备发现、AOA 协议控制传输、配件模式切换、会话承载与数据通道
#include "aoa_hid_internal.h"

#include <cstdio>
#include <cstring>
#include <map>
#include <thread>
#include <chrono>

namespace aoahid {

namespace {

thread_local std::string g_last_error;

// ---- 打开流程预算（2026-10-21 二轮 P1）---------------------------------------
// 调用方是宿主 UI 线程：open_by_serial 全程必须硬上限 45 秒内返回，否则界面冻结数分钟
// （宿主对失败槽位反复重试会叠加）。所有等待/重试共用同一个绝对截止时刻。
constexpr unsigned long long kOpenTotalBudgetMs = 45000;
constexpr unsigned long long kRevertGraceMs = 5000;   // 回退判定：原节点在 + 无配件节点持续 5 秒
constexpr unsigned long long kAccBindBudgetMs = 30000; // 配件节点出现后等驱动绑定的预算


bool set_err(const std::string& msg) { g_last_error = msg; return false; }

const char* ename(int r) { return libusb_error_name(r); }

bool is_accessory_pid(uint16_t pid) { return pid >= 0x2D00 && pid <= 0x2D05; }
bool is_phone_vid_pid(uint16_t vid, uint16_t pid) {
    return vid == 0x2717 || vid == 0x12D1 || (vid == 0x18D1 && pid >= 0x4EE0 && pid <= 0x4EFF); // 小米原生 / 华为(鸿蒙 4.x, 12D1:107E 等 MTP PID) 或 ADB 模式 Google 身份
}

std::string port_path_of(libusb_device* dev) {
    uint8_t path[8] = {0};
    int n = libusb_get_port_numbers(dev, path, sizeof path);
    std::string out;
    char buf[8];
    for (int i = 0; i < n; i++) { snprintf(buf, sizeof buf, "%s%d", i ? "." : "", path[i]); out += buf; }
    return out;
}

// 本进程亲手切换进配件模式的 手机序列号 → 配件端口路径。部分机型（如 MIUI 部分版本）
// 配件模式下读不到序列号（识别串未发送时描述符为空），重枚举与再打开时按端口路径兜底匹配。
std::map<std::string, std::string>& switched_ports() {
    static std::map<std::string, std::string> map;
    return map;
}

// 序列号大小写不敏感比较:设备描述符的大小写因机型/模式而异(MTP 返回小写 6929b744,
// Windows/人工习惯大写 6929B744),严格相等会让 AOA_打开设备 直接「未找到设备」。
bool ieq_serial(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); i++) {
        char ca = a[i], cb = b[i];
        if (ca >= 'A' && ca <= 'Z') ca = (char)(ca + 32);
        if (cb >= 'A' && cb <= 'Z') cb = (char)(cb + 32);
        if (ca != cb) return false;
    }
    return true;
}

bool fail(int r, const char* what) {
    char buf[256];
    snprintf(buf, sizeof buf, "%s 失败：%s", what, ename(r));
    return set_err(buf);
}

// ---- 传输护栏（2026-10-21 P1）-----------------------------------------------
// 设备重枚举（FF40↔2D00 切换、驱动重绑）或拔线之后，旧 libusb 句柄背后的 WinUSB 对象
// 已经释放；继续对它做 bulk/control 传输会抛结构化异常（访问违例）把宿主进程直接带走，
// 没有任何 WER 记录、也没有 LocalDumps（真机一天复现 3+ 次静默退出）。
// 两道防线：
//   ① __try/__except 兜住传输调用本身，异常转成 LIBUSB_ERROR_OTHER 返回，绝不让它逃逸；
//   ② 硬错误之后按「打开时记录的总线+端口」重新枚举核对设备是否还在，判死则把会话标记
//      为断开，后续所有命令一律返回中文原因，由宿主侧「失败 → 槽位标断开」自愈。
// 注意：__try 只能出现在不需要对象展开的函数里，所以下面的护栏函数一律只用 POD 参数。

void mark_dead(SessionImpl* s, const char* reason) {
    if (!s || s->dead) return;
    s->dead = true;
    s->dead_reason = reason;
}

// 打开成功后记录物理位置：重枚举会让 libusb_device* 换新，但同一端口的路径不变。
// 设备地址（dev_addr）在重枚举时会被系统重新分配，用来识破「同端口换了新节点」。
void remember_identity(SessionImpl* s) {
    libusb_device_descriptor d{};
    if (!s->device || libusb_get_device_descriptor(s->device, &d) != 0) return;
    s->dev_vid = d.idVendor;
    s->dev_pid = d.idProduct;
    s->dev_bus = libusb_get_bus_number(s->device);
    s->dev_port = port_path_of(s->device);
    s->dev_addr = libusb_get_device_address(s->device);
}

// 设备是否仍在线：按记录的总线+端口+VID/PID 重新枚举，并核对设备地址。
// 拔线后该端口没有节点；重枚举后同一端口会换成新节点（地址变化）——旧句柄两种情况下都已失效。
bool session_device_present(SessionImpl* s) {
    if (!s || !s->ctx || s->dev_port.empty()) return true; // 没记录位置就无从判断，交给传输层报错
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(s->ctx, &list);
    bool found = false;
    for (ssize_t i = 0; i < n && !found; i++) {
        libusb_device_descriptor d{};
        if (libusb_get_device_descriptor(list[i], &d) != 0) continue;
        if (d.idVendor != s->dev_vid || d.idProduct != s->dev_pid) continue;
        if (libusb_get_bus_number(list[i]) != s->dev_bus) continue;
        if (port_path_of(list[i]) != s->dev_port) continue;
        // 同端口同 ID 但地址变了 = 这块设备重新枚举过，手里的句柄指向旧节点，同样作废
        if (libusb_get_device_address(list[i]) != s->dev_addr) continue;
        found = true;
    }
    libusb_free_device_list(list, 1);
    return found;
}

// 定期在线探测（2026-10-21 P1 实测）：节点被移除后，WinUSB 句柄上的 bulk 读只是持续超时、
// 不返回硬错误，光靠「传输出错再判死」永远等不到。所以按 1 秒节流主动核对设备是否还在。
void probe_alive(SessionImpl* s) {
    if (!s || s->dead || !s->handle) return;
    unsigned long long now = (unsigned long long)host_clock_ms();
    // 有帧在流动就说明句柄活着，不必枚举——枚举走 SetupAPI（每次几毫秒），
    // 多槽同拍探测会啃 UI 线程；设备真的没了的表现就是「帧停了」，这时才探测。
    if (s->last_rx_ms != 0 && now - s->last_rx_ms < 2000) return;
    if (now - s->last_live_probe_ms < 1000) return;
    s->last_live_probe_ms = now;
    if (!session_device_present(s))
        mark_dead(s, "设备已断开（USB 节点已被移除或手机已重新枚举），请重新插拔数据线后重新 AOA_打开设备");
}

// 传输硬错误里只有「设备没了」才判死；超时、管道停顿、溢出都留在会话内处理（清 halt 重试）。
void note_transfer_error(SessionImpl* s, int r) {
    if (!s || s->dead) return;
    if (r != LIBUSB_ERROR_NO_DEVICE && r != LIBUSB_ERROR_NOT_FOUND && r != LIBUSB_ERROR_IO)
        return;
    if (!session_device_present(s))
        mark_dead(s, "设备已断开（USB 节点已被移除或手机已重新枚举），请重新插拔数据线后重新 AOA_打开设备");
    else if (r == LIBUSB_ERROR_NO_DEVICE)
        mark_dead(s, "设备已断开（系统报告 USB 句柄失效），请重新插拔数据线后重新 AOA_打开设备");
}

int guarded_libusb_open(libusb_device* dev, libusb_device_handle** out) {
    if (out) *out = nullptr;
    if (!dev || !out) return LIBUSB_ERROR_INVALID_PARAM;
#ifdef _MSC_VER
    __try { return libusb_open(dev, out); }
    __except (EXCEPTION_EXECUTE_HANDLER) { *out = nullptr; return LIBUSB_ERROR_OTHER; }
#else
    try { return libusb_open(dev, out); } catch (...) { *out = nullptr; return LIBUSB_ERROR_OTHER; }
#endif
}

// 控制传输护栏：faulted 非空时回报是否走了异常路径（异常路径下返回值不可信）。
int guarded_control_transfer(SessionImpl* s, uint8_t request_type, uint8_t request, uint16_t value,
                             uint16_t index, unsigned char* data, uint16_t length, unsigned int timeout,
                             int* faulted = nullptr) {
    if (faulted) *faulted = 0;
    if (!s || !s->handle) return LIBUSB_ERROR_NO_DEVICE;
    if (s->dead) return LIBUSB_ERROR_NO_DEVICE;
    int r = LIBUSB_ERROR_OTHER;
#ifdef _MSC_VER
    __try {
        r = libusb_control_transfer(s->handle, request_type, request, value, index, data, length, timeout);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        if (faulted) *faulted = 1;
        r = LIBUSB_ERROR_OTHER;
    }
#else
    try {
        r = libusb_control_transfer(s->handle, request_type, request, value, index, data, length, timeout);
    } catch (...) {
        if (faulted) *faulted = 1;
        r = LIBUSB_ERROR_OTHER;
    }
#endif
    if (faulted && *faulted)
        mark_dead(s, "USB 传输异常（设备句柄已失效，通常是数据线被拔出或手机重新枚举），请重新插拔后重新 AOA_打开设备");
    else if (r < 0)
        note_transfer_error(s, r);
    return r;
}

int guarded_bulk_transfer(SessionImpl* s, unsigned char endpoint, unsigned char* data, int length,
                          int* transferred, unsigned int timeout, int* faulted) {
    if (faulted) *faulted = 0;
    if (transferred) *transferred = 0;
    if (!s || !s->handle) return LIBUSB_ERROR_NO_DEVICE;
    if (s->dead) return LIBUSB_ERROR_NO_DEVICE;
    int r = LIBUSB_ERROR_OTHER;
#ifdef _MSC_VER
    __try {
        r = libusb_bulk_transfer(s->handle, endpoint, data, length, transferred, timeout);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        if (faulted) *faulted = 1;
        if (transferred) *transferred = 0;
        r = LIBUSB_ERROR_OTHER;
    }
#else
    try {
        r = libusb_bulk_transfer(s->handle, endpoint, data, length, transferred, timeout);
    } catch (...) {
        if (faulted) *faulted = 1;
        if (transferred) *transferred = 0;
        r = LIBUSB_ERROR_OTHER;
    }
#endif
    if (faulted && *faulted)
        mark_dead(s, "USB 传输异常（设备句柄已失效，通常是数据线被拔出或手机重新枚举），请重新插拔后重新 AOA_打开设备");
    else if (r < 0)
        note_transfer_error(s, r);
    return r;
}

int guarded_claim_interface(SessionImpl* s, int iface) {
    if (!s || !s->handle) return LIBUSB_ERROR_NO_DEVICE;
    if (s->dead) return LIBUSB_ERROR_NO_DEVICE;
    int r = LIBUSB_ERROR_OTHER;
#ifdef _MSC_VER
    __try { r = libusb_claim_interface(s->handle, iface); }
    __except (EXCEPTION_EXECUTE_HANDLER) { r = LIBUSB_ERROR_OTHER; }
#else
    try { r = libusb_claim_interface(s->handle, iface); } catch (...) { r = LIBUSB_ERROR_OTHER; }
#endif
    if (r < 0) note_transfer_error(s, r);
    return r;
}

void guarded_release_interface(SessionImpl* s, int iface) {
    if (!s || !s->handle) return;
#ifdef _MSC_VER
    __try { libusb_release_interface(s->handle, iface); }
    __except (EXCEPTION_EXECUTE_HANDLER) { }
#else
    try { libusb_release_interface(s->handle, iface); } catch (...) { }
#endif
}

void guarded_clear_halt(SessionImpl* s, unsigned char endpoint) {
    if (!s || !s->handle || s->dead) return;
#ifdef _MSC_VER
    __try { libusb_clear_halt(s->handle, endpoint); }
    __except (EXCEPTION_EXECUTE_HANDLER) { }
#else
    try { libusb_clear_halt(s->handle, endpoint); } catch (...) { }
#endif
}

// 关闭句柄同样可能踩到已失效的 WinUSB 对象（卸载驱动、拔线后清理阶段），一并兜住。
void guarded_close_handle(libusb_device_handle* h) {
    if (!h) return;
#ifdef _MSC_VER
    __try { libusb_close(h); }
    __except (EXCEPTION_EXECUTE_HANDLER) { }
#else
    try { libusb_close(h); } catch (...) { }
#endif
}

// 复合设备判定：USB 调试打开时手机是 MTP+ADB 多接口复合设备（父节点 usbccgp）。
// 未打开的设备也能读配置描述符（真机实测 FF48 在 libusb_open 失败时配置描述符照样可读）。
bool is_composite_device(libusb_device* dev) {
    libusb_config_descriptor* cfg = nullptr;
    if (!dev || libusb_get_active_config_descriptor(dev, &cfg) != 0) return false;
    bool composite = cfg->bNumInterfaces >= 2;
    libusb_free_config_descriptor(cfg);
    return composite;
}

// P2（2026-10-21 真机定案，MI 8 / 2717:ff48）：
// ① 捆绑的 libusb 已是 1.0.28（1.0.27+ 的复合设备改进已在位），仍打不开；
// ② 父设备由 usbccgp 独占，libusb_open 恒为 LIBUSB_ERROR_ACCESS（提权运行、adb 全杀、MTP 子节点
//    禁用后依旧）；MI_01 的 WinUSB 子接口路径 CreateFile 也直接 ERROR_ACCESS_DENIED，接口级路由不通；
// ③ 把复合父设备整体强绑 WinUSB 之后 libusb 能开、能读 AOA 2.0、SEND_STRING 与 ACCESSORY_START
//    都返回成功，但手机在「USB 调试开启」状态下并不切换配件（25 秒内不重枚举）——厂商策略，模块侧无解。
// 结论：这种形态给可执行的处置，而不是一句「被占用」。
std::string composite_guidance(uint16_t vid, uint16_t pid) {
    char id[16];
    snprintf(id, sizeof id, "%04x:%04x", vid, pid);
    return std::string("手机当前是「USB 调试 + MTP」复合形态（") + id +
           "：MTP 与 ADB 两个接口共用同一条 USB 设备）。Windows 不允许用户态驱动接管这种复合父设备"
           "（libusb 只能拿到 LIBUSB_ERROR_ACCESS，关 adb、提权运行都一样）；即使把父设备强绑 WinUSB 打开，"
           "实测该状态下手机也会忽略 AOA 切换请求，无法建立配件会话。请任选其一："
           "① 关闭手机「USB 调试」后重插数据线——手机变成单接口 MTP 形态（2717:ff40），AOA_打开设备 可直接切换配件；"
           "② 改用伴侣 App 的 Wi-Fi 推流连接，完全不占 USB（推荐：调试态也能投屏）；"
           "③ 若必须在调试态保留 USB：安装开源驱动 UsbDk（github.com/daynix/UsbDk）后重试，本模块已编入该后端，"
           "装好后会自动接管（不影响 MTP/ADB；部分机型调试态仍不切换配件，届时本命令会明确报出）。";
}

// ---- 本进程持有会话登记表（2026-10-21 P3）------------------------------------
// WinUSB 同一时刻只认第一个初始化成功的句柄：设备已被本进程打开时，列表再 libusb_open 会拿到
// ACCESS，于是正在正常投屏的配件设备在列表里被标成「需驱动」、序列号/型号也读不出来，变成
// 「||配件模式|需驱动」这种空序列号幻影行（宿主只能当假设备跳过，用户看着像故障）。
// 这里按物理位置登记，列表据此把「自己占着的设备」如实报成可打开，并补上会话里读到的描述符文本。

struct HeldDevice {
    int refs = 0;
    std::string serial;
    std::string product;
    std::string manufacturer;
};

std::mutex& held_mutex() {
    static std::mutex m;
    return m;
}

std::map<std::string, HeldDevice>& held_devices() {
    static std::map<std::string, HeldDevice> map;
    return map;
}

std::string held_key(uint8_t bus, const std::string& port, uint16_t vid, uint16_t pid) {
    char buf[48];
    snprintf(buf, sizeof buf, "%u|%04x|%04x|", (unsigned)bus, (unsigned)vid, (unsigned)pid);
    return std::string(buf) + port;
}

void held_add(uint8_t bus, const std::string& port, uint16_t vid, uint16_t pid,
              const std::string& serial, const std::string& product, const std::string& manufacturer) {
    if (port.empty()) return;
    std::lock_guard<std::mutex> lk(held_mutex());
    HeldDevice& h = held_devices()[held_key(bus, port, vid, pid)];
    h.refs++;
    if (!serial.empty()) h.serial = serial;
    if (!product.empty()) h.product = product;
    if (!manufacturer.empty()) h.manufacturer = manufacturer;
}

void held_remove(uint8_t bus, const std::string& port, uint16_t vid, uint16_t pid) {
    if (port.empty()) return;
    std::lock_guard<std::mutex> lk(held_mutex());
    auto& map = held_devices();
    auto it = map.find(held_key(bus, port, vid, pid));
    if (it == map.end()) return;
    if (--it->second.refs <= 0) map.erase(it);
}

bool held_lookup(uint8_t bus, const std::string& port, uint16_t vid, uint16_t pid, HeldDevice* out) {
    if (port.empty()) return false;
    std::lock_guard<std::mutex> lk(held_mutex());
    auto& map = held_devices();
    auto it = map.find(held_key(bus, port, vid, pid));
    if (it == map.end()) return false;
    if (out) *out = it->second;
    return true;
}

// 读描述符里的 序列号/厂商/型号（打开成功后调用；也让列表能替自己占着的设备补全这些文本）
void read_descriptor_strings(SessionImpl* s, std::string* serial, std::string* manufacturer, std::string* product) {
    libusb_device_descriptor d{};
    if (!s->handle || !s->device || libusb_get_device_descriptor(s->device, &d) != 0) return;
    char buf[256];
    auto read_one = [&](uint8_t index, std::string* out) {
        if (!index || !out) return;
        buf[0] = 0;
        if (libusb_get_string_descriptor_ascii(s->handle, index, (unsigned char*)buf, sizeof buf) > 0) *out = buf;
    };
    read_one(d.iSerialNumber, serial);
    read_one(d.iManufacturer, manufacturer);
    read_one(d.iProduct, product);
}

} // namespace

std::string last_error() { return g_last_error; }

std::vector<DeviceInfo> list_devices() {
    std::vector<DeviceInfo> out;
    libusb_context* ctx = nullptr;
    if (libusb_init(&ctx)) return out;
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        libusb_get_device_descriptor(list[i], &d);
        bool acc = d.idVendor == 0x18D1 && is_accessory_pid(d.idProduct);
        if (!acc && !is_phone_vid_pid(d.idVendor, d.idProduct)) continue;
        DeviceInfo info;
        info.vid = d.idVendor; info.pid = d.idProduct;
        info.bus = libusb_get_bus_number(list[i]);
        info.port_count = libusb_get_port_numbers(list[i], info.port, sizeof info.port);
        info.accessory = acc;
        // 「可打开/需驱动」必须是实测结论（2026-10-21 P3）：旧口径只在配件设备打开失败时
        // 置假、其余默认真，于是列表会给「配件模式|可打开」的假承诺，AOA_打开设备 却打不开
        // （Mi 10 病态节点：驱动排名装不上，绑定永远完不成）。这里统一按 libusb_open 实测记。
        libusb_device_handle* h = nullptr;
        int open_result = guarded_libusb_open(list[i], &h);
        info.driver_ok = (open_result == 0);
        if (h) {
            char buf[256] = {0};
            if (d.iSerialNumber && libusb_get_string_descriptor_ascii(h, d.iSerialNumber, (unsigned char*)buf, sizeof buf) > 0) info.serial = buf;
            buf[0] = 0;
            if (d.iManufacturer && libusb_get_string_descriptor_ascii(h, d.iManufacturer, (unsigned char*)buf, sizeof buf) > 0) info.manufacturer = buf;
            buf[0] = 0;
            if (d.iProduct && libusb_get_string_descriptor_ascii(h, d.iProduct, (unsigned char*)buf, sizeof buf) > 0) info.product = buf;
            guarded_close_handle(h);
        } else {
            // 本进程自己占着的设备：WinUSB 只认第一个初始化句柄，这里的 open 必然 ACCESS。
            // 它不是「缺驱动」，按可打开报，并从会话登记里补回描述符文本（避免空序列号幻影行）。
            std::string port = port_path_of(list[i]);
            HeldDevice held;
            if (held_lookup(info.bus, port, info.vid, info.pid, &held)) {
                info.driver_ok = true;
                info.serial = held.serial;
                info.manufacturer = held.manufacturer;
                info.product = held.product;
            }
        }
        out.push_back(std::move(info));
    }
    libusb_free_device_list(list, 1);
    libusb_exit(ctx);

    // 同一物理端口只留一行（2026-10-21 P3）：切换/驱动重绑期间，同一台手机可能同时留下
    // 手机节点与配件节点、或残留一个描述符读不出来的旧节点，于是出现「||配件模式|需驱动」
    // 这类空序列号幻影行，干扰宿主按序号分配槽位。合并时保留信息量更大的那行。
    std::vector<DeviceInfo> merged;
    for (auto& row : out) {
        bool appended = false;
        for (auto& kept : merged) {
            if (kept.bus != row.bus || kept.port_count != row.port_count) continue;
            if (kept.port_count > 0 && std::memcmp(kept.port, row.port, (size_t)kept.port_count) != 0) continue;
            if (kept.port_count <= 0) continue; // 没端口信息的不参与合并，避免误吞
            int score_kept = (kept.driver_ok ? 2 : 0) + (kept.serial.empty() ? 0 : 1);
            int score_row = (row.driver_ok ? 2 : 0) + (row.serial.empty() ? 0 : 1);
            if (score_row > score_kept || (score_row == score_kept && row.accessory && !kept.accessory))
                kept = row;
            appended = true;
            break;
        }
        if (!appended) merged.push_back(row);
    }
    return merged;
}

namespace {

// 找序列号匹配的设备；配件设备与普通手机同时命中时取配件（同端口优先的歧义由调用方 START 流程规避）。
// prefer_port 非空时：空序列号的配件设备若端口路径与之相符也视作命中（部分机型配件模式读不到序列号）；
// 无 prefer_port 时，仅在“可见的空序列号配件设备唯一”时把它作为兜底命中。
bool find_by_serial(libusb_context* ctx, const std::string& serial, libusb_device** out, bool* out_acc, std::string* out_port,
                    const std::string& prefer_port = std::string()) {
    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(ctx, &list);
    libusb_device* acc_dev = nullptr;
    libusb_device* phone_dev = nullptr;
    libusb_device* acc_fallback = nullptr;
    std::string acc_path, phone_path, acc_fallback_path;
    int empty_serial_acc_count = 0;
    bool phone_openable = false;
    // "vid:pid" 形态（如 2717:ff40）：按 USB ID 匹配——关 USB 调试后 MTP 模式读不到序列号，
    // 多台手机里精准寻址唯一手段（1.1.0 能力补齐新增）。
    // 2026-10-21 P4：vid:pid 指向的是「物理设备」，切换配件后设备变成 18D1:2D0x、序列号也可能变可读，
    // 所以这个模式下必须把同端口的配件节点也算候选——否则送完 ACCESSORY_START 永远找不到配件设备。
    bool vidpid_mode = false;
    unsigned want_vid = 0, want_pid = 0;
    if (serial.size() > 5 && serial.find(':') != std::string::npos &&
        sscanf(serial.c_str(), "%x:%x", &want_vid, &want_pid) == 2)
        vidpid_mode = true;
    for (ssize_t i = 0; i < n; i++) {
        libusb_device_descriptor d{};
        libusb_get_device_descriptor(list[i], &d);
        bool acc = d.idVendor == 0x18D1 && is_accessory_pid(d.idProduct);
        if (!acc && !is_phone_vid_pid(d.idVendor, d.idProduct)) continue;
        char ser[256] = {0};
        bool opened = false;
        libusb_device_handle* h = nullptr;
        if (guarded_libusb_open(list[i], &h) == 0) {
            opened = true;
            if (d.iSerialNumber) libusb_get_string_descriptor_ascii(h, d.iSerialNumber, (unsigned char*)ser, sizeof ser);
            guarded_close_handle(h);
        }
        // 配件节点兜底候选：普通序列号寻址时只有「配件节点读不到序列号」才算候选（MIUI 配件
        // 描述符为空）；vid:pid 寻址时配件节点是 18D1:2D0x、其序列号与 ff48 无关，也算候选，
        // 但因无法核对身份，最终只允许按「已记录的端口」命中（见 fallback_ok）——否则会把别的
        // 手机正在配件的节点认成目标（2026-10-21 真机踩坑：2717:ff48 命中了正在配件的 Mi 10）。
        if (acc && ((ser[0] == '\0' && !vidpid_mode) || vidpid_mode)) {
            empty_serial_acc_count++;
            std::string p = port_path_of(list[i]);
            bool port_hit = !prefer_port.empty() && p == prefer_port;
            if (!acc_fallback || port_hit) { acc_fallback = list[i]; acc_fallback_path = p; }
        }
        bool vidpid_hit = vidpid_mode && d.idVendor == want_vid && d.idProduct == want_pid;
        if (serial != "any" && !ieq_serial(serial, ser) && !vidpid_hit) continue;
        if (acc && !acc_dev) { acc_dev = list[i]; acc_path = port_path_of(list[i]); }
        else if (!acc && !phone_dev) { phone_dev = list[i]; phone_path = port_path_of(list[i]); phone_openable = opened; }
        // 多机同 vid:pid（如另一台节点被禁用仍被枚举）：打不开的候选让位给能打开的，
        // 否则 open_by_serial 会对禁用节点重试后整体失败（真机踩坑：Mi 8 禁用节点排在 Mi 10 前）。
        else if (!acc && phone_dev && !phone_openable && opened) {
            phone_dev = list[i]; phone_path = port_path_of(list[i]); phone_openable = true;
        }
    }
    if (!acc_dev && acc_fallback) {
        bool fallback_ok = false;
        if (serial == "any")
            fallback_ok = true;                             // 打开第一台：配件设备优先
        else if (!prefer_port.empty())
            fallback_ok = acc_fallback_path == prefer_port; // 本进程切换过：按端口认回同一台
        else if (!vidpid_mode)
            fallback_ok = empty_serial_acc_count == 1;      // 空序列号配件唯一的兜底
        // vidpid_mode 且没有端口记录：身份无法核对，宁可不认——认错设备会把触摸注入到别人手机上
        if (fallback_ok) { acc_dev = acc_fallback; acc_path = acc_fallback_path; }
    }
    bool ok = true;
    if (acc_dev && phone_dev && phone_path == acc_path) { *out = phone_dev; *out_acc = false; *out_port = phone_path; }
    else if (acc_dev) { *out = acc_dev; *out_acc = true; *out_port = acc_path; }
    else if (phone_dev) { *out = phone_dev; *out_acc = false; *out_port = phone_path; }
    else ok = false;
    if (ok) libusb_ref_device(*out);
    libusb_free_device_list(list, 1);
    return ok;
}

// 打开句柄（驱动刚绑上时可能短暂失败，重试）。返回 0 成功，否则最后一次的 libusb 错误码。
int open_handle_with_retry(SessionImpl* s, int tries, int interval_ms) {
    int last = LIBUSB_ERROR_OTHER;
    for (int i = 0; i < tries; i++) {
        last = guarded_libusb_open(s->device, &s->handle);
        if (last == 0) return 0;
        s->handle = nullptr;
        std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
    }
    return last;
}

// AOAv2 识别串：START 之前发送。Android 按 厂商/型号 匹配注册了 usb.accessory
// intent-filter 的伴生应用并自动拉起（LingBuilder 投屏伴侣）。未装伴生 APK 的手机会
// 静默忽略这些请求，纯 HID 流程不受影响。
// 2026-10-22：识别串扩到 5 段（0=厂商 1=型号 2=描述 3=版本 4=序列号）——第 5 段发
// 手机真实序列号（open_by_serial 的已知 SN），手机切进配件模式后伴生 APK 经
// UsbAccessory.getSerial() 读到并随自动发现信标上报，PC 端据此把 Wi-Fi 视频槽与
// USB HID 槽自动对齐。序列号未知（空）时保持旧三段，行为不变。
void send_accessory_ident(SessionImpl* s) {
    const char* strings[4] = { "LingBuilder", "AOACompanion", "1.0", "1.0" };
    for (int idx = 0; idx < 4; idx++) {
        guarded_control_transfer(s, 0x40, kReqSendString, 0, (uint16_t)idx,
                                 (unsigned char*)strings[idx], (uint16_t)(strlen(strings[idx]) + 1), 1000);
    }
    if (!s->serial.empty()) {
        guarded_control_transfer(s, 0x40, kReqSendString, 0, 4,
                                 (unsigned char*)s->serial.c_str(),
                                 (uint16_t)(s->serial.size() + 1), 1000);
    }
}

// 枚举一次：端口上有没有配件节点，能打开就打开。
// acc_seen 回报「配件节点出现过」（区分重枚举超时与驱动未绑定）；
// phone_seen 回报「原手机节点仍在这个端口上」（2026-10-21 二轮：回退快速判定用）。
bool try_open_accessory_once(SessionImpl* s, const std::string& serial, const std::string& port,
                             bool* acc_seen, bool* phone_seen) {
    if (acc_seen) *acc_seen = false;
    if (phone_seen) *phone_seen = false;
    libusb_device* dev = nullptr;
    bool acc = false;
    std::string p;
    bool found = find_by_serial(s->ctx, serial, &dev, &acc, &p, port);
    if (!found || !acc) {
        if (found && dev) {
            if (phone_seen && p == port) *phone_seen = true; // 手机还挂在本端口：没切过去或已回退
            libusb_unref_device(dev);                        // 命中的是手机节点，交回枚举
        }
        return false;
    }
    if (acc_seen) *acc_seen = true;
    if (s->device) libusb_unref_device(s->device);
    s->device = dev;
    s->accessory = true;
    s->want_port_path = port;
    if (guarded_libusb_open(s->device, &s->handle) == 0) return true;
    // 打不开不留指针：驱动重绑会让这个节点失效，下一轮必须重新枚举拿新节点（真机踩坑根因）
    s->handle = nullptr;
    libusb_unref_device(s->device);
    s->device = nullptr;
    return false;
}

// 等配件节点出现并打开。返回失败形态，由调用方翻译成中文文案。
enum class AccWaitResult {
    Opened = 0,        // 打开成功
    DriverNotBound,    // 配件节点已出现，但 libusb_open 一直失败（驱动未绑定）
    NotAppeared,       // 截止前没见过配件节点
    Reverted,          // 手机回退到普通模式（原节点还在 + 没有任何配件节点，连续 5 秒）
};

// deadline 是绝对截止时刻（host_clock_ms 时基），两个阶段都不得越过。
// 快速失败（2026-10-21 二轮 P1）：MIUI 关调试时配件模式挂不住，START 后手机会回退成普通模式。
// 判定 =「原手机节点仍在本端口 且 全场没有任何配件节点」连续保持 5 秒；满足即立刻返回，不再等满预算。
// 不会误判正在切换的手机：它会在几秒内从总线消失，消失即归零计时（真机实测回退后列表稳定为普通模式）。
AccWaitResult wait_open_accessory(SessionImpl* s, const std::string& serial, const std::string& port,
                                  unsigned long long deadline, bool allow_fast_revert) {
    unsigned long long revert_since = 0;
    bool appeared = false;
    for (;;) {
        bool seen_acc = false, seen_phone = false;
        if (try_open_accessory_once(s, serial, port, &seen_acc, &seen_phone)) return AccWaitResult::Opened;
        if (seen_acc) { appeared = true; break; }
        unsigned long long now = (unsigned long long)host_clock_ms();
        if (allow_fast_revert && seen_phone) {
            if (revert_since == 0) revert_since = now;
            else if (now - revert_since >= kRevertGraceMs) return AccWaitResult::Reverted;
        } else {
            revert_since = 0;
        }
        if (now >= deadline) break;
        std::this_thread::sleep_for(std::chrono::milliseconds(300));
    }
    if (!appeared) return AccWaitResult::NotAppeared;

    // 第二阶段：节点在，等 WinUSB 驱动绑定完成（预算 30 秒，且不越过总截止）
    unsigned long long bind_deadline = (unsigned long long)host_clock_ms() + kAccBindBudgetMs;
    if (bind_deadline > deadline) bind_deadline = deadline;
    while ((unsigned long long)host_clock_ms() < bind_deadline) {
        if (try_open_accessory_once(s, serial, port, nullptr, nullptr)) return AccWaitResult::Opened;
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    return AccWaitResult::DriverNotBound;
}

// 复合设备 + ACCESS 时的第二条路（2026-10-22，开源方案）：UsbDk 后端。
// 背景（开源侧结论一致）：Windows 把复合设备拆成 usbccgp 子节点，libusb 打开父设备恒 ACCESS；
// libusb 维护者给的标准解法是「把复合父设备整体换成 WinUSB」（会丢 MTP/ADB），而 daynix/UsbDk
// 是另一条开源路——它把设备从 PnP 驱动栈临时摘下做用户态镜像，能绕开独占、且不影响 MTP/ADB。
// 本模块捆绑的 libusb 1.0.28 已编入该后端：装了 UsbDk 驱动时这里能成功，没装时 set_option
// 直接返回 LIBUSB_ERROR_NOT_FOUND（实测），本函数返回 false，调用方走可执行诊断。
// 用独立上下文实现：失败不影响主上下文的默认后端。
bool reopen_with_usbdk(SessionImpl* s) {
    if (!s || !s->device) return false;
    libusb_device_descriptor d{};
    if (libusb_get_device_descriptor(s->device, &d) != 0) return false;
    const uint8_t bus = libusb_get_bus_number(s->device);
    const std::string port = port_path_of(s->device);
    const uint16_t vid = d.idVendor, pid = d.idProduct;

    libusb_context* nctx = nullptr;
    if (libusb_init(&nctx) != 0) return false;
    if (libusb_set_option(nctx, LIBUSB_OPTION_USE_USBDK) != LIBUSB_SUCCESS) { libusb_exit(nctx); return false; }

    libusb_device** list = nullptr;
    ssize_t n = libusb_get_device_list(nctx, &list);
    libusb_device* target = nullptr;
    for (ssize_t i = 0; i < n && !target; i++) {
        libusb_device_descriptor dd{};
        if (libusb_get_device_descriptor(list[i], &dd) != 0) continue;
        if (dd.idVendor != vid || dd.idProduct != pid) continue;
        if (libusb_get_bus_number(list[i]) != bus || port_path_of(list[i]) != port) continue;
        target = list[i];
    }
    bool ok = false;
    if (target) {
        libusb_device_handle* h = nullptr;
        if (guarded_libusb_open(target, &h) == 0) {
            libusb_ref_device(target); // 列表释放后仍要持有该设备
            if (s->handle) { guarded_close_handle(s->handle); s->handle = nullptr; }
            if (s->device) { libusb_unref_device(s->device); s->device = nullptr; }
            if (s->ctx) { libusb_exit(s->ctx); s->ctx = nullptr; }
            s->ctx = nctx;
            s->device = target;
            s->handle = h;
            ok = true;
        }
    }
    libusb_free_device_list(list, 1);
    if (!ok) libusb_exit(nctx);
    return ok;
}

// 失败形态 → 中文文案（P1 要求区分「手机回退」与「驱动没绑上」：两者处置完全不同）
std::string acc_wait_message(AccWaitResult r, bool composite, uint16_t vid, uint16_t pid) {
    switch (r) {
        case AccWaitResult::Reverted:
            return "手机未保持配件模式（设备已回退）。请确认手机上投屏伴侣正在运行，必要时重新开始投屏后再试";
        case AccWaitResult::DriverNotBound:
            return "配件设备驱动绑定未完成（等待 30 秒超时），请重插一次数据线";
        case AccWaitResult::NotAppeared:
            // 复合设备（开 USB 调试的 FF48）即使能打开也不会切换，直接给专用处置，比「超时」有用
            if (composite)
                return composite_guidance(vid, pid) + "（本次已尝试切换配件，手机没有切过去）";
            return "等待配件设备重枚举超时（45 秒预算用尽），请重插一次数据线后再试（手机屏幕需保持解锁）";
        default:
            return "";
    }
}

} // namespace

// ---- 内部协议原语（aoa_hid_internal.h 声明）---------------------------------

int send_event_raw(SessionImpl* s, int accessory_id, const unsigned char* report, int len) {
    return guarded_control_transfer(s, 0x40, kReqSendHidEvent, (uint16_t)accessory_id, 0,
                                    const_cast<unsigned char*>(report), (uint16_t)len, 1000);
}

int register_hid_desc(SessionImpl* s, int accessory_id, const unsigned char* desc, int desc_len) {
    int r = guarded_control_transfer(s, 0x40, kReqRegisterHid, (uint16_t)accessory_id, (uint16_t)desc_len, nullptr, 0, 1000);
    if (r < 0) return r;
    libusb_device_descriptor dd{};
    libusb_get_device_descriptor(s->device, &dd);
    int chunk = dd.bMaxPacketSize0 > 0 ? dd.bMaxPacketSize0 : 64;
    for (int off = 0; off < desc_len; off += chunk) {
        int n = desc_len - off < chunk ? desc_len - off : chunk;
        r = guarded_control_transfer(s, 0x40, kReqSetHidReportDesc, (uint16_t)accessory_id, (uint16_t)off,
                                     const_cast<unsigned char*>(desc + off), (uint16_t)n, 1000);
        if (r < 0) return r;
    }
    return 0;
}

int unregister_hid_id(SessionImpl* s, int accessory_id) {
    int r = guarded_control_transfer(s, 0x40, kReqUnregisterHid, (uint16_t)accessory_id, 0, nullptr, 0, 1000);
    return r < 0 ? r : 0;
}

// ---- 会话 -------------------------------------------------------------------

namespace {

// 打开成功的统一收尾：记录物理位置 → 读描述符文本 → 登记「本进程持有」（列表据此报可打开）
Session* finish_open(SessionImpl* s) {
    remember_identity(s);
    std::string serial, manufacturer, product;
    read_descriptor_strings(s, &serial, &manufacturer, &product);
    held_add(s->dev_bus, s->dev_port, s->dev_vid, s->dev_pid, serial, product, manufacturer);
    switched_ports()[s->serial] = s->dev_port;
    return s;
}

} // namespace

Session* open_by_serial(const std::string& serial) {
    // P1：整个打开流程（发现/校验/切换/重试/等驱动绑定）共用一个绝对截止时刻，
    // 超时立即返回——调用方是宿主 UI 线程，无上限会冻结界面数分钟。
    const unsigned long long deadline = (unsigned long long)host_clock_ms() + kOpenTotalBudgetMs;
    SessionImpl* s = new SessionImpl();
    if (libusb_init(&s->ctx)) { set_err("libusb 初始化失败"); delete s; return nullptr; }
    // 本进程切换过的 手机序列号 → 配件端口：空序列号配件按端口兜底匹配
    std::string prefer_port;
    {
        auto& ports = switched_ports();
        auto it = ports.find(serial);
        if (it != ports.end()) prefer_port = it->second;
    }
    bool acc = false;
    std::string path;
    if (!find_by_serial(s->ctx, serial, &s->device, &acc, &path, prefer_port)) {
        // 用 vid:pid 寻址时无法核对配件节点身份（配件态是 18D1:2D0x），如果手机其实已经在
        // 配件模式，只能提示改用序列号/18d1:2d0x 打开，绝不猜一台来开（认错会注入到别人手机上）。
        bool vidpid_like = serial.size() > 5 && serial.find(':') != std::string::npos;
        if (vidpid_like)
            set_err("未找到 USB ID 为 " + serial + " 的手机节点（若手机已切到配件模式，设备会显示为 "
                    "18d1:2d00/2d01，请用 AOA_取设备列表 里的序列号或 18d1:2d00 打开）");
        else
            set_err("未找到序列号为 " + serial + " 的手机/配件设备");
        libusb_exit(s->ctx); delete s; return nullptr;
    }
    s->accessory = acc;
    s->serial = serial;
    s->want_port_path = path;

    // ① 已经是配件模式：只等驱动绑定完成即可（配件节点已在，不必再触发切换）
    if (acc) {
        AccWaitResult wr = wait_open_accessory(s, serial, path, deadline, false);
        if (wr != AccWaitResult::Opened) {
            set_err(acc_wait_message(wr, false, 0, 0));
            if (s->device) libusb_unref_device(s->device);
            libusb_exit(s->ctx); delete s; return nullptr;
        }
        return finish_open(s);
    }

    // ② 普通模式：协议校验 → 触发配件模式 → 等重枚举 → 重开。
    // 2026-10-21 P4：MIUI 机型单次 START 经常配不上（手机侧配件切换半途失败/重枚举没赶上），
    // 旧实现「单次 15 秒等待 + 单次重开」失败即整体失败。现在整体重试 3 轮：每轮失败都把
    // 残留句柄关掉、旧的 libusb_device 解引用，重新枚举拿新节点；每轮送 START 前先用
    // GET_PROTOCOL 确认手机仍在可切状态（如果上一轮其实已切过去，会被下面的认领分支接走）。
    const int kSwitchAttempts = 3;
    std::string why;   // 仅记录真正的底层失败原因（纯超时留空，避免文案里出现无意义的尾巴）
    AccWaitResult last_wait = AccWaitResult::NotAppeared;
    // 记录手机节点是不是「复合设备」：复合形态即使能打开（父设备强绑 WinUSB 的情形），
    // 实测手机在调试态也会忽略 ACCESSORY_START——收尾时给复合形态专用处置，比「重枚举超时」有用。
    bool phone_composite = false;
    unsigned phone_vid = 0, phone_pid = 0;

    for (int attempt = 1; attempt <= kSwitchAttempts; attempt++) {
        // 硬上限：每轮开头先查截止，超时立刻收尾（不管还有几轮没跑）
        if ((unsigned long long)host_clock_ms() >= deadline) break;
        // 上一轮 START 可能已经成功，只是我们没赶上重枚举——先认领配件节点，避免重复触发
        if (try_open_accessory_once(s, serial, path, nullptr, nullptr)) {
            return finish_open(s);
        }

        // 每轮重新枚举：驱动重绑/重枚举会让上一轮的 libusb_device 指针失效，禁止复用
        if (s->device) { libusb_unref_device(s->device); s->device = nullptr; }
        if (s->handle) { guarded_close_handle(s->handle); s->handle = nullptr; }

        libusb_device* phone = nullptr;
        bool phone_acc = false;
        std::string phone_path;
        if (!find_by_serial(s->ctx, serial, &phone, &phone_acc, &phone_path, path)) {
            why = "配件切换重试期间找不到手机（手机可能已进入配件模式但未完成重枚举）";
            continue;
        }
        if (phone_acc) { // 已经切过去了，交给下一轮的认领分支打开
            libusb_unref_device(phone);
            why = "配件节点已出现但未能打开，正在重试";
            continue;
        }
        s->device = phone;
        int open_result = open_handle_with_retry(s, 3, 300);
        // 复合设备（开 USB 调试的 FF48）：父节点被 usbccgp 独占，常规 open 恒 ACCESS。
        // 装了 UsbDk 就换它的后端再试一次（绕开独占且保留 MTP/ADB），没装则走诊断文案。
        bool composite_access = (open_result == LIBUSB_ERROR_ACCESS) && is_composite_device(s->device);
        if (composite_access && reopen_with_usbdk(s)) {
            open_result = 0;
        }
        if (open_result == 0 && !phone_composite) {
            libusb_device_descriptor dd{};
            if (libusb_get_device_descriptor(s->device, &dd) == 0) {
                phone_vid = dd.idVendor;
                phone_pid = dd.idProduct;
            }
            phone_composite = is_composite_device(s->device);
        }
        if (open_result != 0) {
            if (composite_access) {
                // P2：复合设备（开 USB 调试的 FF48 形态）——再重试也没用，直接给可执行处置
                libusb_device_descriptor dd{};
                unsigned vid = 0, pid = 0;
                if (libusb_get_device_descriptor(s->device, &dd) == 0) { vid = dd.idVendor; pid = dd.idProduct; }
                set_err(composite_guidance((uint16_t)vid, (uint16_t)pid));
                libusb_unref_device(s->device); s->device = nullptr;
                libusb_exit(s->ctx); delete s; return nullptr;
            }
            why = std::string("手机节点打开失败：") + ename(open_result) +
                  (open_result == LIBUSB_ERROR_ACCESS ? "（被其他程序占用：请先退出 adb / scrcpy / 手机助手）" : "");
            libusb_unref_device(s->device); s->device = nullptr;
            continue;
        }

        unsigned char proto[2] = {0, 0};
        int pr = guarded_control_transfer(s, 0xC0, kReqGetProtocol, 0, 0, proto, 2, 1000);
        if (pr < 0) {
            why = std::string("AOA 协议查询失败：") + ename(pr);
            guarded_close_handle(s->handle); s->handle = nullptr;
            libusb_unref_device(s->device); s->device = nullptr;
            continue;
        }
        if (pr != 2 || proto[0] < 2) {
            // 能力问题，重试无意义
            set_err("手机不支持 AOA 2.0（协议版本 < 2）");
            guarded_close_handle(s->handle);
            libusb_unref_device(s->device);
            libusb_exit(s->ctx); delete s; return nullptr;
        }

        // AOAv2 识别串先于 START 发送，供伴生 APK（usb.accessory）自动拉起
        send_accessory_ident(s);
        int sr = guarded_control_transfer(s, 0x40, kReqStart, 0, 0, nullptr, 0, 2000);
        guarded_close_handle(s->handle); s->handle = nullptr;
        libusb_unref_device(s->device); s->device = nullptr;
        if (sr < 0) {
            why = std::string("ACCESSORY_START 失败：") + ename(sr);
            continue;
        }

        // 等重枚举 + 等驱动绑定（共用总截止时刻；回退判定开启）。
        last_wait = wait_open_accessory(s, serial, path, deadline, true);
        if (last_wait == AccWaitResult::Opened) return finish_open(s);
        // 手机已回退成普通模式：再重发 START 只会重复同样结局，立即终止（P1 快速失败）
        if (last_wait == AccWaitResult::Reverted) break;
        // 配件节点在但驱动始终没绑上：重发 START 也不会变好，交给收尾报「重插数据线」
        if (last_wait == AccWaitResult::DriverNotBound) break;
        // 这一轮没成：清干净再重来（handle/device 已在上面或 wait 内部回收）
    }

    // 收尾文案：优先给「失败形态」对应的处置（回退 / 驱动没绑上 / 复合设备 / 通用超时）。
    // 复合形态（开 USB 调试的 FF48）专用的处置在 acc_wait_message 里，比「退出码式超时」有用。
    if (last_wait == AccWaitResult::Opened)
        set_err("配件模式切换成功但会话建立失败，请重试");  // 理论上到不了这里
    else
        set_err(acc_wait_message(last_wait, phone_composite, (uint16_t)phone_vid, (uint16_t)phone_pid));
    if (!why.empty() && last_wait == AccWaitResult::NotAppeared && !phone_composite) {
        // 保留底层原因（如 ACCESSORY_START 失败、节点打不开）供排障，附在最后
        std::string cur = last_error();
        set_err(cur + " [底层原因：" + why + "]");
    }
    if (s->handle) guarded_close_handle(s->handle);
    if (s->device) libusb_unref_device(s->device);
    libusb_exit(s->ctx); delete s;
    return nullptr;
}

void close_session(Session*& s) {
    if (!s) return;
    held_remove(s->dev_bus, s->dev_port, s->dev_vid, s->dev_pid);
    if (s->data_claimed && s->data_iface_index >= 0) guarded_release_interface(s, s->data_iface_index);
    guarded_close_handle(s->handle);
    if (s->device) libusb_unref_device(s->device);
    if (s->ctx) libusb_exit(s->ctx);
    delete s;
    s = nullptr;
}

// ---- 数据通道（AOAv2 配件 bulk 端点；帧格式 LBAC：4B magic + 2B 通道ID LE + 4B 长度 LE + 载荷）----

namespace {

constexpr int kLbacHeaderSize = 10;
constexpr unsigned int kLbacMaxPayload = 16u * 1024u * 1024u;

bool find_accessory_endpoints(SessionImpl* s) {
    libusb_config_descriptor* config = nullptr;
    if (libusb_get_active_config_descriptor(s->device, &config) != 0) return false;
    // 配件数据接口判定（接口号各机型不固定，2D01 复合设备里还与 adb 口并存）：
    // 1) 端点地址为 AOA 标准形态 IN=0x81 + OUT=0x01 的 bulk 对（MIUI 配件口虽报 ff/ff/00
    //    但端点就是这对；adb 口是 OUT=0x01/IN=0x82 形态，可据此区分）；
    // 2) 退回 AOA 标准类码 ff/42/01 的 bulk 对；
    // 3) 再退回任一 bulk 对。
    int aoa_addr = -1, aoa_class = -1, any_bulk = -1;
    unsigned char aoa_addr_in = 0, aoa_addr_out = 0, aoa_class_in = 0, aoa_class_out = 0, any_in = 0, any_out = 0;
    for (int i = 0; i < config->bNumInterfaces; i++) {
        const libusb_interface& iface = config->interface[i];
        for (int a = 0; a < iface.num_altsetting; a++) {
            const libusb_interface_descriptor& alt = iface.altsetting[a];
            unsigned char in = 0, out = 0;
            for (int e = 0; e < alt.bNumEndpoints; e++) {
                const libusb_endpoint_descriptor& ep = alt.endpoint[e];
                if ((ep.bmAttributes & 0x03) != 0x02) continue; // 只认 bulk
                if (ep.bEndpointAddress & 0x80) in = ep.bEndpointAddress;
                else out = ep.bEndpointAddress;
            }
            if (in == 0 || out == 0) continue;
            if (aoa_addr < 0 && in == 0x81 && out == 0x01) { aoa_addr = i; aoa_addr_in = in; aoa_addr_out = out; }
            if (aoa_class < 0 && alt.bInterfaceClass == 0xFF && alt.bInterfaceSubClass == 0x42 && alt.bInterfaceProtocol == 0x01) {
                aoa_class = i; aoa_class_in = in; aoa_class_out = out;
            }
            if (any_bulk < 0) { any_bulk = i; any_in = in; any_out = out; }
        }
    }
    // 优先级：AOA 标准类码（ff/42/01）> 端点地址启发（81/01，部分机型 ff/42/01 缺席时兜底）> 任一 bulk 对。
    // 红线：81/01 不能抢在类码前——Mi 10 的厂商接口 MI_00（ff/ff/00，无驱动）同样是 81/01 端点，
    // 端点优先会认领到无驱动接口报 NOT_SUPPORTED（真机踩坑定案）。
    if (aoa_class >= 0) {
        s->data_iface_index = aoa_class; s->data_ep_in = aoa_class_in; s->data_ep_out = aoa_class_out;
    } else if (aoa_addr >= 0) {
        s->data_iface_index = aoa_addr; s->data_ep_in = aoa_addr_in; s->data_ep_out = aoa_addr_out;
    } else {
        s->data_iface_index = any_bulk; s->data_ep_in = any_in; s->data_ep_out = any_out;
    }
    bool ok = s->data_iface_index >= 0;
    libusb_free_config_descriptor(config);
    return ok;
}

bool lbac_read_full(SessionImpl* s, unsigned char* buffer, int length, long long timeout_ms) {
    int received = 0;
    while (received < length) {
        int transferred = 0;
        int faulted = 0;
        int r = guarded_bulk_transfer(s, s->data_ep_in, buffer + received, length - received,
                                      &transferred, (unsigned int)(timeout_ms > 0 ? timeout_ms : 1), &faulted);
        if (r == LIBUSB_ERROR_TIMEOUT && transferred == 0) return false;
        if (r < 0) return false; // 结构性异常/设备消失已在护栏里判死并留了中文原因
        received += transferred;
    }
    return true;
}

} // namespace

int open_data_channel(Session* s_, long long timeout_ms, const char** err) {
    SessionImpl* s = s_;
    *err = "";
    if (!s || !s->handle) { *err = "设备会话无效"; return -1; }
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    if (!s->accessory) { *err = "数据通道需要手机处于配件模式（先 AOA_打开设备）"; return -1; }
    if (s->data_claimed) return 0;
    if (!find_accessory_endpoints(s)) { *err = "未找到配件 bulk 端点（手机固件不支持 AOAv2 数据通道）"; return -1; }
    int r = guarded_claim_interface(s, s->data_iface_index);
    if (r != 0) {
        // 局部数组返回即销毁——err 是出参指针，必须用 thread_local 静态存储（历史 bug：栈垃圾当错误文本）
        static thread_local char buf[192];
        if (s->dead) {
            snprintf(buf, sizeof buf, "%s", s->dead_reason.c_str());
        } else {
            snprintf(buf, sizeof buf, "认领配件接口 %d 失败：%s（需该接口绑定 WinUSB 系驱动）", s->data_iface_index, ename(r));
            s->data_iface_index = -1;
        }
        *err = buf;
        return -1;
    }
    s->data_claimed = true;
    // 握手：按“整帧”清空 IN 端点上残留的旧帧（不能按固定字节清——会把帧读岔，
    // 后续 magic 全部错位），同时验证 bulk 读路径可用。
    unsigned int flush_timeout = timeout_ms > 0 && timeout_ms < 300 ? (unsigned int)timeout_ms : 30;
    for (int i = 0; i < 64; i++) {
        unsigned char header[kLbacHeaderSize];
        if (!lbac_read_full(s, header, kLbacHeaderSize, flush_timeout)) break; // 超时=无更多残留
        if (std::memcmp(header, "LBAC", 4) != 0) break;                        // 流本就错位，放弃清理
        unsigned int len = (unsigned int)header[6] | ((unsigned int)header[7] << 8) |
                           ((unsigned int)header[8] << 16) | ((unsigned int)header[9] << 24);
        if (len > kLbacMaxPayload) break;
        std::vector<unsigned char> skip(len);
        if (len > 0 && !lbac_read_full(s, skip.data(), (int)len, 3000)) break;
    }
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    return 0;
}

int data_send(Session* s_, int channel_id, const unsigned char* data, int len, const char** err) {
    SessionImpl* s = s_;
    *err = "";
    if (!s || !s->handle || !s->data_claimed) { *err = "数据通道未打开（先 AOA_打开数据通道）"; return -1; }
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    probe_alive(s);
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    if (len < 0 || (unsigned int)len > kLbacMaxPayload) { *err = "载荷超出 16MB 上限"; return -1; }
    if (channel_id < 0 || channel_id > 65535) { *err = "通道 ID 非法（0~65535）"; return -1; }
    std::vector<unsigned char> frame(kLbacHeaderSize + (size_t)len);
    frame[0] = 'L'; frame[1] = 'B'; frame[2] = 'A'; frame[3] = 'C';
    frame[4] = (unsigned char)(channel_id & 0xff);
    frame[5] = (unsigned char)((channel_id >> 8) & 0xff);
    unsigned int n = (unsigned int)len;
    frame[6] = (unsigned char)(n & 0xff);
    frame[7] = (unsigned char)((n >> 8) & 0xff);
    frame[8] = (unsigned char)((n >> 16) & 0xff);
    frame[9] = (unsigned char)((n >> 24) & 0xff);
    if (len > 0) std::memcpy(frame.data() + kLbacHeaderSize, data, (size_t)len);
    int transferred = 0;
    int faulted = 0;
    int r = guarded_bulk_transfer(s, s->data_ep_out, frame.data(), (int)frame.size(), &transferred, 5000, &faulted);
    if (r < 0 || transferred != (int)frame.size()) {
        // 出参指针不能指向局部数组（悬空）——与认领失败处同款修复
        static thread_local char buf[256];
        if (s->dead)
            snprintf(buf, sizeof buf, "%s", s->dead_reason.c_str());
        else
            snprintf(buf, sizeof buf, "数据通道发送失败：%s", ename(r));
        *err = buf;
        return -1;
    }
    return 0;
}

int data_recv(Session* s_, long long timeout_ms, std::vector<unsigned char>* out, int* out_channel, const char** err) {
    SessionImpl* s = s_;
    *err = "";
    out->clear();
    if (out_channel) *out_channel = -1;
    if (!s || !s->handle || !s->data_claimed) { *err = "数据通道未打开（先 AOA_打开数据通道）"; return -1; }
    // P1：设备已判死（拔线/重枚举）时立刻给中文原因，不再对失效句柄发起任何传输
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    probe_alive(s); // 节点被移除后 bulk 读只会一直超时，必须主动核对设备是否还在
    if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
    unsigned char header[kLbacHeaderSize];
    if (!lbac_read_full(s, header, kLbacHeaderSize, timeout_ms)) {
        if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
        // 手机侧 fd 翻新（轻量↔服务通道切换、App 重建）会把配件 IN 管道打停——
        // 宿主侧清 halt 后重试一次即可恢复收帧（真机实锤：服务接管后 40 轮零帧）。
        guarded_clear_halt(s, s->data_ep_in);
        guarded_clear_halt(s, s->data_ep_out);
        if (!lbac_read_full(s, header, kLbacHeaderSize, timeout_ms)) {
            if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
            return 1; // 超时无帧
        }
    }
    if (std::memcmp(header, "LBAC", 4) != 0) {
        // 1.2.5 同款自愈：字节流可能从投屏视频中段开始读（[头][头][载荷] 重排/中段切入），
        // 按字节滑动窗口搜索 "LBAC" 重对齐（上限 256KB，防死循环），失败才报错。
        static thread_local char badbuf[192];
        int hb = 0;
        hb += snprintf(badbuf + hb, sizeof badbuf - hb,
                       "收到非法帧（magic 不符），滑动重对齐。流前字节:");
        for (int i = 0; i < kLbacHeaderSize; i++) hb += snprintf(badbuf + hb, sizeof badbuf - hb, " %02x", header[i]);
        *err = badbuf;
        unsigned long long deadline = (unsigned long long)host_clock_ms() + 5000;
        unsigned char w[4] = {header[0], header[1], header[2], header[3]};
        bool hit = false;
        unsigned long long scanned = 0;
        while (!hit && scanned < 256u * 1024u && (unsigned long long)host_clock_ms() < deadline) {
            unsigned char one = 0;
            if (!lbac_read_full(s, &one, 1, 400)) {
                if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
                return 1; // 滑动中超时无数据＝当次无帧
            }
            scanned++;
            w[0] = w[1]; w[1] = w[2]; w[2] = w[3]; w[3] = one;
            if (w[0] == 'L' && w[1] == 'B' && w[2] == 'A' && w[3] == 'C') hit = true;
        }
        if (!hit) { *err = "滑动重对齐失败（256KB 内未找到 LBAC 魔数），建议关闭后重开数据通道"; return -1; }
        std::memcpy(header, w, 4);
        if (!lbac_read_full(s, header + 4, kLbacHeaderSize - 4, 1000)) {
            if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
            return 1;
        }
        if (std::memcmp(header, "LBAC", 4) != 0) { *err = "重对齐后魔数仍不符，建议关闭后重开数据通道"; return -1; }
    }
    int channel_id = header[4] | (header[5] << 8);
    unsigned int len = (unsigned int)header[6] | ((unsigned int)header[7] << 8) |
                       ((unsigned int)header[8] << 16) | ((unsigned int)header[9] << 24);
    if (len > kLbacMaxPayload) { *err = "帧载荷超出 16MB 上限，数据流异常，建议关闭后重开数据通道"; return -1; }
    out->assign(len, 0);
    if (len > 0 && !lbac_read_full(s, out->data(), (int)len, 3000)) {
        if (s->dead) { *err = s->dead_reason.c_str(); return -1; }
        *err = "帧载荷读取不完整，数据流异常，建议关闭后重开数据通道";
        return -1;
    }
    if (out_channel) *out_channel = channel_id;
    s->last_rx_ms = (unsigned long long)host_clock_ms();
    return 0;
}

void close_data_channel(Session* s_) {
    SessionImpl* s = s_;
    if (!s || !s->handle || !s->data_claimed) return;
    guarded_release_interface(s, s->data_iface_index);
    s->data_claimed = false;
}

} // namespace aoahid
