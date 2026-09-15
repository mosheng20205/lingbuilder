/*
 * demo_mathdll.c
 * Minimal third-party style C DLL for the LingBuilder "DLL to module" demo.
 * Exports three cdecl functions covering int / wide string / double.
 */
#include <windows.h>
#include <wchar.h>
#include <math.h>

__declspec(dllexport) int __cdecl demo_add(int a, int b)
{
    return a + b;
}

__declspec(dllexport) int __cdecl demo_text_length(const wchar_t* text)
{
    return text ? (int)wcslen(text) : 0;
}

__declspec(dllexport) double __cdecl demo_distance(double x1, double y1, double x2, double y2)
{
    double dx = x2 - x1;
    double dy = y2 - y1;
    return sqrt(dx * dx + dy * dy);
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved)
{
    (void)instance;
    (void)reserved;
    (void)reason;
    return TRUE;
}
