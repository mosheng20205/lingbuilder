#include "aoa_bridge.h"
#include "aoa_hid.h"
#include <cstdio>
#include <string>

static std::string to_narrow(const std::wstring& w) {
    std::string out;
    for (wchar_t c : w) out += (char)((c < 0x80) ? c : '?');
    return out;
}

int main() {
    std::wstring list = AOA_取设备列表();
    printf("list wide chars: %d\n%s\n", (int)list.size(), to_narrow(list).c_str());
    int x = 0, y = 0;
    aoahid::transform(1234, 23456, 90, &x, &y);
    printf("transform(90): (%d,%d)\n", x, y);
    long long h = AOA_打开设备(L"no-such-device");
    std::wstring err = AOA_取错误();
    printf("handle: %lld err_wide_len: %d first_char: %04x\n", h, (int)err.size(), err.empty() ? 0 : err[0]);
    return 0;
}
