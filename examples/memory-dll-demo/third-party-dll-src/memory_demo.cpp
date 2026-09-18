/*
 * memory_demo.cpp —— 内存加载 DLL 演示用第三方 DLL（自建，非官方 SDK）。
 *
 * 用途：验证 LingBuilder 的「内存加载 DLL」链路——DLL 字节以 RCDATA 内嵌进 EXE，
 * 运行期手工 PE 映射到内存（不落盘），再按导出名解析并调用。
 *
 * 覆盖的关键点：
 *   memo_add            最普通的整数计算
 *   memo_divide         除零保护（不使用 C++ 异常，见下方限制说明）
 *   memo_entry_count    DLL 入口函数（DllMain）是否真的执行过
 *   memo_text_length    宽字符参数
 *   memo_make_text      返回宽字符指针（静态缓冲区，指针在 DLL 内有效）
 *   memo_static_counter 静态局部变量：验证 .data 段可写
 *   memo_self_path      查询自身模块状态：内存加载模块不在 OS 模块链表中，返回 0
 *
 * 限制（实测，务必遵守）：手工映射的模块不在 Windows 加载器模块链表中，
 * 因此 **不要在内存加载的 DLL 里使用 MSVC C++ 异常（throw/catch）**：x64 下异常
 * 不会被派发到映射模块的帧，进程会以未处理异常终止。x86（WOW64）下 __try/__except
 * 同样不派发。需要异常机制的 DLL 请改用「同目录加载」。
 *
 * 编译：见同目录 build-memory-demo-dll.cmd（/MT 静态 CRT，只依赖 kernel32）。
 */
#include <windows.h>
#include <string>

static int g_entryCount = 0;
static std::wstring g_textBuffer;

static int memo_staticCounter = 0;

extern "C" __declspec(dllexport) int __cdecl memo_add(int a, int b)
{
    return a + b;
}

extern "C" __declspec(dllexport) int __cdecl memo_divide(int a, int b)
{
    if (b == 0)
    {
        return -1;
    }
    return a / b;
}

extern "C" __declspec(dllexport) int __cdecl memo_entry_count(void)
{
    return g_entryCount;
}

extern "C" __declspec(dllexport) int __cdecl memo_text_length(const wchar_t* text)
{
    return text ? static_cast<int>(wcslen(text)) : 0;
}

extern "C" __declspec(dllexport) const wchar_t* __cdecl memo_make_text(const wchar_t* prefix)
{
    g_textBuffer = std::wstring(L"[") + (prefix ? prefix : L"") + L"] 来自内存 DLL";
    return g_textBuffer.c_str();
}

extern "C" __declspec(dllexport) int __cdecl memo_static_counter(void)
{
    ++memo_staticCounter;
    return memo_staticCounter;
}

/* 内存加载的模块不在 OS 模块链表中：GetModuleHandleW(库名) 取不到，返回 0 是正常行为。 */
extern "C" __declspec(dllexport) int __cdecl memo_self_path(int unused)
{
    (void)unused;
    return GetModuleHandleW(L"memory_demo.dll") == nullptr ? 0 : 1;
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved)
{
    (void)reserved;
    if (reason == DLL_PROCESS_ATTACH)
    {
        g_entryCount = 42;
        DisableThreadLibraryCalls(instance);
    }
    return TRUE;
}
