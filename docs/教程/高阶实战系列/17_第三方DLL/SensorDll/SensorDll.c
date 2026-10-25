#include <windows.h>
#pragma pack(push, 1)
typedef struct SampleReport {
    int serial;
    unsigned char digest[16];
    int channels[4];
    wchar_t name[260];
} SampleReport;
#pragma pack(pop)

__declspec(dllexport) int SumReport(const SampleReport* r) {
    int sum = r->serial;
    for (int i = 0; i < 4; ++i) sum += r->channels[i];
    return sum;
}
__declspec(dllexport) int SumBytes(const unsigned char* data, int len) {
    int sum = 0;
    for (int i = 0; i < len; ++i) sum += data[i];
    return sum;
}
