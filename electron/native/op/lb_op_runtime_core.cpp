// ============================================================================
// lb_op_runtime_core.cpp — LingBuilder OP 后台图色模块核心（lingbuilder.op 1.0.0）
//
// 事实来源：随包内置运行库 op_c_api_x64.dll / op_c_api_x86.dll
//   （上游 WallBreaker2/op 0.4.8.3，MIT，SHA-256 基线见 third_party/op/NOTICE.md）。
// 经 LoadLibrary/GetProcAddress 懒加载（自包含 DLL，无导入库依赖），
// 函数指针 boilerplate 由 scripts/generate-op-runtime.ts 从
// native/op/op_c_api.h（钉版）解析生成，替换下方标记行注入。
//
// 红线：
//   * 生成器注入运行时，函数名即命令名（bindings.runtimeName = 后台_*），
//     函数签名必须与 opModules.ts 的 binding 参数一一对应，不得擅改。
//   * 本文件同时用于：1) 生成器注入（generate-op-runtime.ts 转 TS String.raw
//     拼进生成的 C++ 工程，Win32 与 new_emoji 双后端一致）；
//     2) 独立编译验收（scripts/smoke-op-native.ts 的探针直接 include）。
//   * 内容不得出现反引号与美元符号花括号序列（String.raw 注入安全）。
//   * 上游 FindPic 系列返回值是模板编号（首个=0，失败=-1）：后台_找图 已在
//     本层翻译为 真/假；后台_找图全部/编号 的字符串结果判空使用。
//   * 上游 OpGetLastError 返回 Win32 GetLastError 原始码，后台_取错误码 原样
//     透出，后台_取错误 返回本层中文错误（加载失败/句柄无效等）。
// ============================================================================

#ifndef LB_OP_RUNTIME_INCLUDED
#define LB_OP_RUNTIME_INCLUDED

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace lbop {

inline std::once_flag g_loadOnce;
inline bool g_ready = false;
inline std::wstring g_loadError;
inline thread_local std::wstring g_lastError;

inline void setError(const std::wstring& message) { g_lastError = message; }
inline void clearError() { g_lastError.clear(); }

namespace impl { inline bool loadAll(); }

inline bool ready();

// 句柄空检 + 运行库就绪二合一；每个包装函数的第一步。
inline bool prepare(long long handleValue, void*& handle) {
    if (!ready()) return false;
    if (handleValue == 0) {
        setError(L"OP句柄无效：请先用 后台_创建 创建句柄。");
        return false;
    }
    handle = reinterpret_cast<void*>(static_cast<intptr_t>(handleValue));
    return true;
}

inline std::wstring toW(const wchar_t* text) { return text ? std::wstring(text) : std::wstring(); }

//@generated-interop@

inline bool ready() {
    std::call_once(g_loadOnce, [] { g_ready = impl::loadAll(); });
    if (!g_ready) {
        setError(g_loadError.empty() ? std::wstring(L"op 运行库不可用。") : g_loadError);
        return false;
    }
    return true;
}

} // namespace lbop

// ============================================================================
// 中文命令包装层（214 条 = 上游 213 条一一映射 + 模块级 后台_取错误；函数名 = 命令名，签名 = binding ABI）
// ============================================================================

// ---------------------------- 基础与生命周期（15 = 上游 14 + 后台_取错误） ----------------------------
inline long long 后台_创建() {
    if (!lbop::ready()) return 0;
    lbop::clearError();
    return reinterpret_cast<long long>(lbop::p_OpCreate());
}

inline std::wstring 后台_取错误() {
    return lbop::g_lastError;
}

inline void 后台_销毁(long long 句柄) {
    if (句柄 == 0 || !lbop::ready()) return;
    lbop::p_OpDestroy(reinterpret_cast<void*>(static_cast<intptr_t>(句柄)));
}

inline std::wstring 后台_取版本() {
    if (!lbop::ready()) return std::wstring();
    return lbop::toW(lbop::p_OpVer());
}

inline bool 后台_置全局路径(long long 句柄, const wchar_t* 路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetPath(h, 路径) == 1;
}

inline std::wstring 后台_取全局路径(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetPath(h));
}

inline std::wstring 后台_取基础路径(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetBasePath(h));
}

inline int 后台_取引擎编号(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetID(h);
}

inline int 后台_取错误码(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetLastError(h);
}

inline bool 后台_置错误弹窗(long long 句柄, int 显示方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetShowErrorMsg(h, 显示方式) == 1;
}

inline bool 后台_休眠(long long 句柄, int 毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSleep(h, 毫秒) == 1;
}

inline bool 后台_注入DLL(long long 句柄, const wchar_t* 进程名, const wchar_t* DLL路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpInjectDll(h, 进程名, DLL路径) == 1;
}

inline bool 后台_置图片缓存(long long 句柄, int 启用) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpEnablePicCache(h, 启用) == 1;
}

inline bool 后台_截屏预处理(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCapturePre(h, 文件名) == 1;
}

inline bool 后台_置屏幕数据模式(long long 句柄, int 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetScreenDataMode(h, 模式) == 1;
}

// ---------------------------- 算法（2） ----------------------------
inline std::wstring 后台_A星寻路(long long 句柄, int 地图宽度, int 地图高度, const wchar_t* 禁用点,
                                 int 起点横坐标, int 起点纵坐标, int 终点横坐标, int 终点纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpAStarFindPath(h, 地图宽度, 地图高度, 禁用点, 起点横坐标, 起点纵坐标, 终点横坐标, 终点纵坐标));
}

inline std::wstring 后台_取最近位置(long long 句柄, const wchar_t* 位置集, int 类型, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindNearestPos(h, 位置集, 类型, 横坐标, 纵坐标));
}

// ---------------------------- 窗口与进程（41） ----------------------------
inline std::wstring 后台_枚举窗口(long long 句柄, long long 父窗口, const wchar_t* 标题, const wchar_t* 类名, int 过滤) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumWindow(h, static_cast<intptr_t>(父窗口), 标题, 类名, 过滤));
}

inline std::wstring 后台_按进程枚举窗口(long long 句柄, const wchar_t* 进程名, const wchar_t* 标题, const wchar_t* 类名, int 过滤) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumWindowByProcess(h, 进程名, 标题, 类名, 过滤));
}

inline std::wstring 后台_枚举进程(long long 句柄, const wchar_t* 进程名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpEnumProcess(h, 进程名));
}

inline bool 后台_客户区转屏幕(long long 句柄, long long 窗口句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpClientToScreen(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline long long 后台_找窗口(long long 句柄, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindow(h, 类名, 标题));
}

inline long long 后台_按进程找窗口(long long 句柄, const wchar_t* 进程名, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowByProcess(h, 进程名, 类名, 标题));
}

inline long long 后台_按进程ID找窗口(long long 句柄, int 进程ID, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowByProcessId(h, 进程ID, 类名, 标题));
}

inline long long 后台_找子窗口(long long 句柄, long long 父窗口, const wchar_t* 类名, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpFindWindowEx(h, static_cast<intptr_t>(父窗口), 类名, 标题));
}

inline bool 后台_取窗口客户区(long long 句柄, long long 窗口句柄, int* 左, int* 上, int* 右, int* 下) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetClientRect(h, static_cast<intptr_t>(窗口句柄), 左, 上, 右, 下) == 1;
}

inline bool 后台_取客户区尺寸(long long 句柄, long long 窗口句柄, int* 宽度, int* 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetClientSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline long long 后台_取前台焦点(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetForegroundFocus(h));
}

inline long long 后台_取前台窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetForegroundWindow(h));
}

inline long long 后台_取鼠标所在窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetMousePointWindow(h));
}

inline long long 后台_取坐标处窗口(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetPointWindow(h, 横坐标, 纵坐标));
}

inline std::wstring 后台_取进程信息(long long 句柄, int 进程ID) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetProcessInfo(h, 进程ID));
}

inline long long 后台_取特殊窗口(long long 句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetSpecialWindow(h, 标志));
}

inline long long 后台_取关联窗口(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetWindow(h, static_cast<intptr_t>(窗口句柄), 标志));
}

inline std::wstring 后台_取窗口类名(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowClass(h, static_cast<intptr_t>(窗口句柄)));
}

inline int 后台_取窗口进程ID(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetWindowProcessId(h, static_cast<intptr_t>(窗口句柄));
}

inline std::wstring 后台_取窗口进程路径(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowProcessPath(h, static_cast<intptr_t>(窗口句柄)));
}

inline bool 后台_取窗口矩形(long long 句柄, long long 窗口句柄, int* 左, int* 上, int* 右, int* 下) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWindowRect(h, static_cast<intptr_t>(窗口句柄), 左, 上, 右, 下) == 1;
}

inline bool 后台_取窗口状态(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWindowState(h, static_cast<intptr_t>(窗口句柄), 标志) == 1;
}

inline std::wstring 后台_取窗口标题(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWindowTitle(h, static_cast<intptr_t>(窗口句柄)));
}

inline bool 后台_移动窗口(long long 句柄, long long 窗口句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveWindow(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline bool 后台_屏幕转客户区(long long 句柄, long long 窗口句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpScreenToClient(h, static_cast<intptr_t>(窗口句柄), 横坐标, 纵坐标) == 1;
}

inline bool 后台_发送粘贴(long long 句柄, long long 窗口句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendPaste(h, static_cast<intptr_t>(窗口句柄)) == 1;
}

inline bool 后台_置客户区尺寸(long long 句柄, long long 窗口句柄, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetClientSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline bool 后台_置窗口状态(long long 句柄, long long 窗口句柄, int 标志) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowState(h, static_cast<intptr_t>(窗口句柄), 标志) == 1;
}

inline bool 后台_置窗口尺寸(long long 句柄, long long 窗口句柄, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowSize(h, static_cast<intptr_t>(窗口句柄), 宽度, 高度) == 1;
}

inline bool 后台_排列窗口(long long 句柄, const wchar_t* 窗口句柄集, int 布局方式, int 列数, int 起始横坐标, int 起始纵坐标,
                          int 间距横, int 间距纵, int 尺寸模式, int 窗口宽度, int 窗口高度, int 锚点模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLayoutWindows(h, 窗口句柄集, 布局方式, 列数, 起始横坐标, 起始纵坐标, 间距横, 间距纵,
                                   尺寸模式, 窗口宽度, 窗口高度, 锚点模式) == 1;
}

inline bool 后台_置窗口标题(long long 句柄, long long 窗口句柄, const wchar_t* 标题) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowText(h, static_cast<intptr_t>(窗口句柄), 标题) == 1;
}

inline bool 后台_置窗口透明(long long 句柄, long long 窗口句柄, int 透明度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetWindowTransparent(h, static_cast<intptr_t>(窗口句柄), 透明度) == 1;
}

inline bool 后台_发文本(long long 句柄, long long 窗口句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendString(h, static_cast<intptr_t>(窗口句柄), 文本) == 1;
}

inline bool 后台_发文本输入法(long long 句柄, long long 窗口句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSendStringIme(h, static_cast<intptr_t>(窗口句柄), 文本) == 1;
}

inline bool 后台_运行程序(long long 句柄, const wchar_t* 命令行, int 显示模式, long long* 进程ID) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    uint32_t pid = 0;
    const bool ok = lbop::p_OpRunApp(h, 命令行, 显示模式, &pid) == 1;
    if (进程ID) *进程ID = static_cast<long long>(pid);
    return ok;
}

inline bool 后台_执行命令(long long 句柄, const wchar_t* 命令行, int 显示方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWinExec(h, 命令行, 显示方式) == 1;
}

inline std::wstring 后台_取命令输出(long long 句柄, const wchar_t* 命令, int 超时毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetCmdStr(h, 命令, 超时毫秒));
}

inline bool 后台_置剪贴板(long long 句柄, const wchar_t* 文本) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetClipboard(h, 文本) == 1;
}

inline std::wstring 后台_取剪贴板(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetClipboard(h));
}

inline bool 后台_延迟(long long 句柄, int 毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDelay(h, 毫秒) == 1;
}

inline bool 后台_随机延迟(long long 句柄, int 最小毫秒, int 最大毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDelays(h, 最小毫秒, 最大毫秒) == 1;
}

// ---------------------------- 后台绑定（6） ----------------------------
inline bool 后台_绑定窗口(long long 句柄, long long 窗口句柄, const wchar_t* 显示后端, const wchar_t* 鼠标模式,
                          const wchar_t* 键盘模式, int 绑定模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpBindWindow(h, static_cast<intptr_t>(窗口句柄), 显示后端, 鼠标模式, 键盘模式, 绑定模式) == 1;
}

inline bool 后台_绑定窗口扩展(long long 句柄, long long 显示窗口句柄, long long 输入窗口句柄, const wchar_t* 显示后端,
                              const wchar_t* 鼠标模式, const wchar_t* 键盘模式, int 绑定模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpBindWindowEx(h, static_cast<intptr_t>(显示窗口句柄), static_cast<intptr_t>(输入窗口句柄),
                                  显示后端, 鼠标模式, 键盘模式, 绑定模式) == 1;
}

inline bool 后台_解绑窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpUnBindWindow(h) == 1;
}

inline bool 后台_锁定输入(long long 句柄, int 锁定方式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLockInput(h, 锁定方式) == 1;
}

inline long long 后台_取绑定窗口(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetBindWindow(h));
}

inline bool 后台_是否已绑定(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpIsBind(h) == 1;
}

// ---------------------------- 鼠标（35） ----------------------------
inline bool 后台_取鼠标位置(long long 句柄, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetCursorPos(h, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_取鼠标形状(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetCursorShape(h));
}

inline bool 后台_相对移动(long long 句柄, int 横偏移, int 纵偏移) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveR(h, 横偏移, 纵偏移) == 1;
}

inline bool 后台_移动到(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveTo(h, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_区域随机移动(long long 句柄, int 横坐标, int 纵坐标, int 宽度, int 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMoveToEx(h, 横坐标, 纵坐标, 宽度, 高度));
}

inline bool 后台_平滑移动(long long 句柄, int 横坐标, int 纵坐标, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMoveToSmooth(h, 横坐标, 纵坐标, 时长毫秒) == 1;
}

inline std::wstring 后台_区域随机平滑移动(long long 句柄, int 横坐标, int 纵坐标, int 宽度, int 高度, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMoveToExSmooth(h, 横坐标, 纵坐标, 宽度, 高度, 时长毫秒));
}

inline bool 后台_轨迹移动(long long 句柄, const wchar_t* 路径点, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMovePath(h, 路径点, 时长毫秒) == 1;
}

inline bool 后台_拖拽路径(long long 句柄, const wchar_t* 路径点, int 时长毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpDragPath(h, 路径点, 时长毫秒) == 1;
}

inline bool 后台_置鼠标轨迹(long long 句柄, int 模式, int 最小时长, int 最大时长, int 抖动, int 起始延迟, int 结束延迟) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMouseTrajectory(h, 模式, 最小时长, 最大时长, 抖动, 起始延迟, 结束延迟) == 1;
}

inline bool 后台_左键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftClick(h) == 1;
}
inline bool 后台_左键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftDoubleClick(h) == 1;
}
inline bool 后台_左键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftDown(h) == 1;
}
inline bool 后台_左键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLeftUp(h) == 1;
}
inline bool 后台_中键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleClick(h) == 1;
}
inline bool 后台_中键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleDoubleClick(h) == 1;
}
inline bool 后台_中键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleDown(h) == 1;
}
inline bool 后台_中键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpMiddleUp(h) == 1;
}
inline bool 后台_右键单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightClick(h) == 1;
}
inline bool 后台_右键双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightDoubleClick(h) == 1;
}
inline bool 后台_右键按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightDown(h) == 1;
}
inline bool 后台_右键弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpRightUp(h) == 1;
}
inline bool 后台_侧键1单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Click(h) == 1;
}
inline bool 后台_侧键1双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1DoubleClick(h) == 1;
}
inline bool 后台_侧键1按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Down(h) == 1;
}
inline bool 后台_侧键1弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton1Up(h) == 1;
}
inline bool 后台_侧键2单击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Click(h) == 1;
}
inline bool 后台_侧键2双击(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2DoubleClick(h) == 1;
}
inline bool 后台_侧键2按下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Down(h) == 1;
}
inline bool 后台_侧键2弹起(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpXButton2Up(h) == 1;
}

inline bool 后台_滚轮滚动(long long 句柄, int 增量) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheel(h, 增量) == 1;
}

inline bool 后台_水平滚轮滚动(long long 句柄, int 增量) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpHWheel(h, 增量) == 1;
}

inline bool 后台_滚轮向下(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheelDown(h) == 1;
}

inline bool 后台_滚轮向上(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWheelUp(h) == 1;
}

inline bool 后台_置鼠标延迟(long long 句柄, const wchar_t* 类型, int 延迟毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMouseDelay(h, 类型, 延迟毫秒) == 1;
}

// ---------------------------- 键盘（10） ----------------------------
inline bool 后台_取按键状态(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetKeyState(h, 虚拟键码) == 1;
}

inline bool 后台_按下按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyDown(h, 虚拟键码) == 1;
}

inline bool 后台_按字符按下(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyDownChar(h, 字符) == 1;
}

inline bool 后台_弹起按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyUp(h, 虚拟键码) == 1;
}

inline bool 后台_按字符弹起(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyUpChar(h, 字符) == 1;
}

inline bool 后台_等待按键(long long 句柄, int 虚拟键码, int 超时毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWaitKey(h, 虚拟键码, 超时毫秒) == 1;
}

inline bool 后台_敲击按键(long long 句柄, int 虚拟键码) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPress(h, 虚拟键码) == 1;
}

inline bool 后台_按字符敲击(long long 句柄, const wchar_t* 字符) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPressChar(h, 字符) == 1;
}

inline bool 后台_置键盘延迟(long long 句柄, const wchar_t* 类型, int 延迟毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetKeypadDelay(h, 类型, 延迟毫秒) == 1;
}

inline bool 后台_连发按键串(long long 句柄, const wchar_t* 按键串, int 间隔毫秒) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpKeyPressStr(h, 按键串, 间隔毫秒) == 1;
}

// ---------------------------- 图色（22） ----------------------------
inline bool 后台_截图(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCapture(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 文件名) == 1;
}

inline bool 后台_比色(long long 句柄, int 横坐标, int 纵坐标, const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCmpColor(h, 横坐标, 纵坐标, 颜色, 相似度) == 1;
}

inline bool 后台_找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 颜色, double 相似度, int 方向, int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    // 上游返回命中颜色序号（首个=0，失败 -1），与找图的模板编号同语义；本层翻译为 真/假。
    return lbop::p_OpFindColor(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 方向,
                               结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindColorEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 方向));
}

inline bool 后台_多点找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                          const wchar_t* 首色, const wchar_t* 偏移色, double 相似度, int 方向,
                          int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindMultiColor(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 首色, 偏移色, 相似度, 方向,
                                    结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_多点找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 首色, const wchar_t* 偏移色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindMultiColorEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 首色, 偏移色, 相似度, 方向));
}

inline bool 后台_找图(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向,
                      int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    // 上游返回命中模板编号（首个=0），失败 -1；本层翻译为 真/假。
    return lbop::p_OpFindPic(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向,
                             结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_找图全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindPicEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向));
}

inline std::wstring 后台_找图全部编号(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 图片集, const wchar_t* 偏差色, double 相似度, int 方向) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindPicExS(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 图片集, 偏差色, 相似度, 方向));
}

inline bool 后台_色块找色(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                          const wchar_t* 颜色, double 相似度, int 最少像素数, int 最小高度, int 最小宽度,
                          int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindColorBlock(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                    最少像素数, 最小高度, 最小宽度, 结果横坐标, 结果纵坐标) >= 0;
}

inline std::wstring 后台_色块找色全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 颜色, double 相似度, int 最少像素数, int 最小高度, int 最小宽度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindColorBlockEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                                最少像素数, 最小高度, 最小宽度));
}

inline std::wstring 后台_取颜色(long long 句柄, int 横坐标, int 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetColor(h, 横坐标, 纵坐标));
}

inline int 后台_颜色计数(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                         const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetColorNum(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度);
}

inline bool 后台_置显示输入模式(long long 句柄, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetDisplayInput(h, 模式) == 1;
}

inline bool 后台_加载图片(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLoadPic(h, 文件名) == 1;
}

inline bool 后台_释放图片(long long 句柄, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFreePic(h, 文件名) == 1;
}

inline bool 后台_加载内存图片(long long 句柄, const wchar_t* 名称, const std::vector<unsigned char>& 图片数据) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpLoadMemPic(h, 名称, const_cast<void*>(static_cast<const void*>(图片数据.data())),
                                static_cast<int>(图片数据.size())) == 1;
}

inline bool 后台_取图片尺寸(long long 句柄, const wchar_t* 图片名, int* 宽度, int* 高度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetPicSize(h, 图片名, 宽度, 高度) == 1;
}

inline long long 后台_取屏幕数据(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                 int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetScreenData(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 成功标记));
}

inline long long 后台_取屏幕数据BMP(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    int* 数据大小, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return static_cast<long long>(lbop::p_OpGetScreenDataBmp(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标,
                                                             数据大小, 成功标记));
}

inline void 后台_取屏幕帧信息(long long 句柄, int* 帧号, int* 时间) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return;
    lbop::p_OpGetScreenFrameInfo(h, 帧号, 时间);
}

inline std::wstring 后台_匹配图片名(long long 句柄, const wchar_t* 图片名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpMatchPicName(h, 图片名));
}

// ---------------------------- OpenCV（35） ----------------------------
inline bool 后台_CV加载模板(long long 句柄, const wchar_t* 模板名, const wchar_t* 文件路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadTemplate(h, 模板名, 文件路径) == 1;
}

inline bool 后台_CV加载掩码模板(long long 句柄, const wchar_t* 模板名, const wchar_t* 模板路径, const wchar_t* 掩码路径) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadMaskedTemplate(h, 模板名, 模板路径, 掩码路径) == 1;
}

inline bool 后台_CV移除模板(long long 句柄, const wchar_t* 模板名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvRemoveTemplate(h, 模板名) == 1;
}

inline bool 后台_CV移除全部模板(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvRemoveAllTemplates(h) == 1;
}

inline bool 后台_CV存在模板(long long 句柄, const wchar_t* 模板名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvHasTemplate(h, 模板名) == 1;
}

inline int 后台_CV取模板数量(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpCvGetTemplateCount(h);
}

inline std::wstring 后台_CV取全部模板名(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvGetAllTemplateNames(h));
}

inline std::wstring 后台_CV取OpenCV版本(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvGetOpenCvVersion(h));
}

inline bool 后台_CV加载模板列表(long long 句柄, const wchar_t* 模板列表) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvLoadTemplateList(h, 模板列表) == 1;
}

inline bool 后台_CV转灰度(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToGray(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转二值(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToBinary(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转边缘(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToEdge(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV转轮廓(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvToOutline(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV去噪(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvDenoise(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV直方图均衡(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvEqualize(h, 源文件, 目标文件) == 1;
}

inline bool 后台_CV限制对比度均衡(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 裁剪限制, int 网格尺寸) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCLAHE(h, 源文件, 目标文件, 裁剪限制, 网格尺寸) == 1;
}

inline bool 后台_CV模糊(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式, int 核尺寸) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvBlur(h, 源文件, 目标文件, 模式, 核尺寸) == 1;
}

inline bool 后台_CV锐化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 强度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvSharpen(h, 源文件, 目标文件, 强度) == 1;
}

inline bool 后台_CV裁有效区域(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCropValid(h, 源文件, 目标文件) == 1;
}

inline std::wstring 后台_CV连通域分析(long long 句柄, const wchar_t* 源文件, double 最小面积) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvConnectedComponents(h, 源文件, 最小面积));
}

inline std::wstring 后台_CV找轮廓(long long 句柄, const wchar_t* 源文件, double 最小面积) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvFindContours(h, 源文件, 最小面积));
}

inline bool 后台_CV预处理管线(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 管线) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvPreprocessPipeline(h, 源文件, 目标文件, 管线) == 1;
}

inline bool 后台_CV裁剪(long long 句柄, const wchar_t* 源文件, int 横坐标, int 纵坐标, int 宽度, int 高度, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvCrop(h, 源文件, 横坐标, 纵坐标, 宽度, 高度, 目标文件) == 1;
}

inline bool 后台_CV缩放(long long 句柄, const wchar_t* 源文件, int 宽度, int 高度, const wchar_t* 目标文件) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvResize(h, 源文件, 宽度, 高度, 目标文件) == 1;
}

inline bool 后台_CV阈值化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, double 阈值, double 最大值, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvThreshold(h, 源文件, 目标文件, 阈值, 最大值, 模式) == 1;
}

inline bool 后台_CV通道范围(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 颜色空间, const wchar_t* 下界, const wchar_t* 上界) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvInRange(h, 源文件, 目标文件, 颜色空间, 下界, 上界) == 1;
}

inline bool 后台_CV形态学(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式, int 核尺寸, int 迭代次数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvMorphology(h, 源文件, 目标文件, 模式, 核尺寸, 迭代次数) == 1;
}

inline bool 后台_CV细化(long long 句柄, const wchar_t* 源文件, const wchar_t* 目标文件, const wchar_t* 模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpCvThin(h, 源文件, 目标文件, 模式) == 1;
}

inline std::wstring 后台_CV模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值,
                                               方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV缩放模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名, const wchar_t* 缩放集, double 阈值, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchTemplateScale(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 缩放集,
                                                    阈值, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV任一模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名集, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchAnyTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名集, 阈值,
                                                  方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV全部模板匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                        const wchar_t* 模板名集, double 阈值, int 方向, int 去重模式, int 匹配方法, int 颜色模式) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvMatchAllTemplates(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名集, 阈值,
                                                   方向, 去重模式, 匹配方法, 颜色模式));
}

inline std::wstring 后台_CV特征点匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                      const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvFeatureMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

inline std::wstring 后台_CV边缘匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvEdgeMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

inline std::wstring 后台_CV形状匹配(long long 句柄, int 区域横坐标, int 区域纵坐标, int 区域宽度, int 区域高度,
                                    const wchar_t* 模板名, double 阈值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCvShapeMatchTemplate(h, 区域横坐标, 区域纵坐标, 区域宽度, 区域高度, 模板名, 阈值));
}

// ---------------------------- YOLO 检测（3） ----------------------------
inline bool 后台_置YOLO引擎(long long 句柄, const wchar_t* 引擎路径, const wchar_t* 服务DLL, const wchar_t* 启动参数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetYoloEngine(h, 引擎路径, 服务DLL, 启动参数) == 1;
}

inline std::wstring 后台_YOLO检测(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  double 置信度, double 交并比) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpYoloDetect(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 置信度, 交并比));
}

inline std::wstring 后台_YOLO检测文件(long long 句柄, const wchar_t* 文件名, double 置信度, double 交并比) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpYoloDetectFromFile(h, 文件名, 置信度, 交并比));
}

// ---------------------------- 点阵字库识字（35） ----------------------------
inline bool 后台_加载字库(long long 句柄, int 字库序号, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetDict(h, 字库序号, 文件名) == 1;
}

inline std::wstring 后台_取字库条目(long long 句柄, int 字库序号, int 字体索引) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetDict(h, 字库序号, 字体索引));
}

inline bool 后台_加载内存字库(long long 句柄, int 字库序号, const std::vector<unsigned char>& 字库数据) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetMemDict(h, 字库序号, const_cast<void*>(static_cast<const void*>(字库数据.data())),
                                static_cast<int>(字库数据.size())) == 1;
}

inline bool 后台_切换字库(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpUseDict(h, 字库序号) == 1;
}

inline bool 后台_追加字库(long long 句柄, int 字库序号, const wchar_t* 字库信息) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpAddDict(h, 字库序号, 字库信息) == 1;
}

inline bool 后台_保存字库(long long 句柄, int 字库序号, const wchar_t* 文件名) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSaveDict(h, 字库序号, 文件名) == 1;
}

inline bool 后台_清空字库(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpClearDict(h, 字库序号) == 1;
}

inline int 后台_取字库条数(long long 句柄, int 字库序号) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetDictCount(h, 字库序号);
}

inline int 后台_取当前字库序号(long long 句柄) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetNowDict(h);
}

inline bool 后台_置二值化预处理(long long 句柄, int 模式, int 孤点阈值, int 最小连通面积, int 桥接间距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpSetBinaryPreprocess(h, 模式, 孤点阈值, 最小连通面积, 桥接间距) == 1;
}

inline bool 后台_取二值化预处理(long long 句柄, int* 模式, int* 孤点阈值, int* 最小连通面积, int* 桥接间距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetBinaryPreprocess(h, 模式, 孤点阈值, 最小连通面积, 桥接间距) == 1;
}

inline std::wstring 后台_取词(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                              const wchar_t* 颜色, const wchar_t* 词) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWord(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 词));
}

inline std::wstring 后台_取词相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, const wchar_t* 词) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词));
}

inline std::wstring 后台_提取词框(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 颜色, double 相似度, int 最小词高) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpExtractWordRects(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 最小词高));
}

inline std::wstring 后台_提取词框相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                      const wchar_t* 颜色, double 相似度, int 最小词宽, int 最小词高, int 边距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpExtractWordRectsEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度,
                                                  最小词宽, 最小词高, 边距));
}

inline std::wstring 后台_取词组(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                const wchar_t* 颜色, double 相似度, const wchar_t* 词集, int 最小词高) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWords(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集, 最小词高));
}

inline std::wstring 后台_取词组相似(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, const wchar_t* 词集, int 最小词宽, int 最小词高, int 边距) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordsEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集,
                                            最小词宽, 最小词高, 边距));
}

inline std::wstring 后台_按框取词组(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, const wchar_t* 词集, const wchar_t* 矩形集) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFetchWordsByRects(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 词集, 矩形集));
}

inline std::wstring 后台_二值化预览(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetBinaryPreview(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度, 成功标记));
}

inline std::wstring 后台_单字预览(long long 句柄, const wchar_t* 字库信息, int* 成功标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordPreview(h, 字库信息, 成功标记));
}

inline std::wstring 后台_校验字库(long long 句柄, const wchar_t* 字库信息, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpCheckWordDict(h, 字库信息, 结果标记));
}

inline std::wstring 后台_规范化字库(long long 句柄, const wchar_t* 字库信息, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpNormalizeWordDict(h, 字库信息, 结果标记));
}

inline std::wstring 后台_字库改名(long long 句柄, const wchar_t* 字库信息, const wchar_t* 新词, int* 结果标记) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpRenameWordDict(h, 字库信息, 新词, 结果标记));
}

inline std::wstring 后台_无字库取词(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordsNoDict(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色));
}

inline int 后台_取词结果数量(long long 句柄, const wchar_t* 结果) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return 0;
    return lbop::p_OpGetWordResultCount(h, 结果);
}

inline bool 后台_取词结果坐标(long long 句柄, const wchar_t* 结果, int 索引, int* 横坐标, int* 纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpGetWordResultPos(h, 结果, 索引, 横坐标, 纵坐标) == 1;
}

inline std::wstring 后台_取词结果文本(long long 句柄, const wchar_t* 结果, int 索引) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpGetWordResultStr(h, 结果, 索引));
}

inline std::wstring 后台_识字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                              const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcr(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

inline std::wstring 后台_识字带坐标(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                    const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

inline bool 后台_找字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                      const wchar_t* 字串集, const wchar_t* 颜色, double 相似度, int* 结果横坐标, int* 结果纵坐标) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpFindStr(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 字串集, 颜色, 相似度,
                             结果横坐标, 结果纵坐标) == 1;
}

inline std::wstring 后台_找字全部(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  const wchar_t* 字串集, const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindStrEx(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 字串集, 颜色, 相似度));
}

inline std::wstring 后台_自动识字(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                  double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrAuto(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 相似度));
}

inline std::wstring 后台_文件识字(long long 句柄, const wchar_t* 文件名, const wchar_t* 颜色格式, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrFromFile(h, 文件名, 颜色格式, 相似度));
}

inline std::wstring 后台_文件自动识字(long long 句柄, const wchar_t* 文件名, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpOcrAutoFromFile(h, 文件名, 相似度));
}

inline std::wstring 后台_找直线(long long 句柄, int 左上横坐标, int 左上纵坐标, int 右下横坐标, int 右下纵坐标,
                                const wchar_t* 颜色, double 相似度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpFindLine(h, 左上横坐标, 左上纵坐标, 右下横坐标, 右下纵坐标, 颜色, 相似度));
}

// ---------------------------- 内存读写（10） ----------------------------
inline bool 后台_写内存数据(long long 句柄, long long 窗口句柄, const wchar_t* 地址, const wchar_t* 十六进制数据, int 字节数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteData(h, static_cast<intptr_t>(窗口句柄), 地址, 十六进制数据, 字节数) == 1;
}

inline std::wstring 后台_读内存数据(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 字节数) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpReadData(h, static_cast<intptr_t>(窗口句柄), 地址, 字节数));
}

inline bool 后台_读内存整数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 类型, long long* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    int64_t value = 0;
    const bool ok = lbop::p_OpReadInt(h, static_cast<intptr_t>(窗口句柄), 地址, 类型, &value) == 1;
    if (数值) *数值 = static_cast<long long>(value);
    return ok;
}

inline bool 后台_写内存整数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 类型, long long 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteInt(h, static_cast<intptr_t>(窗口句柄), 地址, 类型, static_cast<int64_t>(数值)) == 1;
}

inline bool 后台_读内存单精度(long long 句柄, long long 窗口句柄, const wchar_t* 地址, float* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpReadFloat(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_写内存单精度(long long 句柄, long long 窗口句柄, const wchar_t* 地址, float 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteFloat(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_读内存小数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, double* 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpReadDouble(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline bool 后台_写内存小数(long long 句柄, long long 窗口句柄, const wchar_t* 地址, double 数值) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteDouble(h, static_cast<intptr_t>(窗口句柄), 地址, 数值) == 1;
}

inline std::wstring 后台_读内存文本(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 编码, int 长度) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return std::wstring();
    return lbop::toW(lbop::p_OpReadString(h, static_cast<intptr_t>(窗口句柄), 地址, 编码, 长度));
}

inline bool 后台_写内存文本(long long 句柄, long long 窗口句柄, const wchar_t* 地址, int 编码, const wchar_t* 内容) {
    void* h = nullptr;
    if (!lbop::prepare(句柄, h)) return false;
    return lbop::p_OpWriteString(h, static_cast<intptr_t>(窗口句柄), 地址, 编码, 内容) == 1;
}

#endif // LB_OP_RUNTIME_INCLUDED
