#include <cstdio>
#include <string>
#include "ProjectDllCommands.h"
int main() {
    int a = 加法计算(123, 456);
    int n = 取字符数(L"灵码LingBuilder");
    double d = 两点距离计算(0, 0, 3, 4);
    wprintf(L"a=%d n=%d d=%.1f
", a, n, d);
    int fv = 0;
    填充值(&fv);
    wprintf(L"fv=%d
", fv);
    return 0;
}
