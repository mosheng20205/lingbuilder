/*
 * demo_mathdll.h - public surface of the demo third-party DLL.
 * Copy this header into the module's include/ directory.
 */
#pragma once
#ifndef DEMO_MATHDLL_H
#define DEMO_MATHDLL_H

#ifdef __cplusplus
extern "C" {
#endif

int __cdecl demo_add(int a, int b);
int __cdecl demo_text_length(const wchar_t* text);
double __cdecl demo_distance(double x1, double y1, double x2, double y2);

#ifdef __cplusplus
}
#endif

#endif /* DEMO_MATHDLL_H */
