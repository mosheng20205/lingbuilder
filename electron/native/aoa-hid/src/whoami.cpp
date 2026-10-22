
#include "aoa_hid.h"
#include "aoa_hid_internal.h"
#include <cstdio>
using namespace aoahid;
int main(int argc, char** argv) {
    aoahid::Session* s = aoahid::open_by_serial("any");
    if (!s) { printf("open any failed: %s\n", aoahid::last_error().c_str()); return 1; }
    SessionImpl* impl = (SessionImpl*)s;
    printf("opened serial=[%s] accessory=%d\n", impl->serial.c_str(), (int)impl->accessory);
    aoahid::close_session(s);
    return 0;
}
