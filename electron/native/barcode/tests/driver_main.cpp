// 一维条码驱动器 — 直接编译 core+win 验证五码制生成/识别闭环（批次4 验收门槛）
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <cstdio>
#include <string>
#include <vector>

// 生成器 prelude 的返回文本工具（驱动器本地实现）
static thread_local std::wstring g_returnBuffer;
static const wchar_t* LB_ReturnText(std::wstring text) {
    g_returnBuffer = std::move(text);
    return g_returnBuffer.c_str();
}

#include "lb_barcode_core.cpp"
#include "lb_barcode_win.cpp"

namespace {
int g_failed = 0, g_passed = 0;
void check(bool ok, const char* name, const std::string& detail = "") {
    if (ok) { g_passed++; printf("[PASS] %s\n", name); }
    else { g_failed++; printf("[FAIL] %s %s\n", name, detail.c_str()); }
}
std::wstring toWide(const std::string& s) { return lbbarwin::Utf8ToWideLocal(s); }
} // namespace

int main() {
    setvbuf(stdout, nullptr, _IONBF, 0);

    // ===== 自检 =====
    check(条码_自检(), "自检（生成→解码闭环 + 损坏样本拒绝）", lbbarwin::WideToUtf8Local(lbbarwin::g_barError));

    // ===== 生成与回读 =====
    struct Case { const char* name; int gen; const wchar_t* input; const wchar_t* expectText; const wchar_t* symbology; };
    const Case cases[] = {
        {"EAN-13 补校验位", 0, L"590123412345", L"5901234123457", L"EAN-13"},
        {"EAN-13 含校验位", 0, L"5901234123457", L"5901234123457", L"EAN-13"},
        {"EAN-8", 1, L"9638507", L"96385074", L"EAN-8"},
        {"UPC-A", 2, L"03600029145", L"036000291452", L"UPC-A"},
        {"Code128 字母数字", 3, L"ABC-abc-123", L"ABC-abc-123", L"Code128"},
        {"Code128 纯数字(C子集)", 3, L"12345678", L"12345678", L"Code128"},
        {"Code39", 4, L"HELLO WORLD", L"HELLO WORLD", L"Code39"},
    };
    for (const auto& item : cases) {
        long long barcode = 0;
        switch (item.gen) {
            case 0: barcode = 条码_生成EAN13(item.input); break;
            case 1: barcode = 条码_生成EAN8(item.input); break;
            case 2: barcode = 条码_生成UPCA(item.input); break;
            case 3: barcode = 条码_生成Code128(item.input); break;
            case 4: barcode = 条码_生成Code39(item.input); break;
        }
        check(barcode != 0, (std::string(item.name) + " 生成").c_str(), lbbarwin::WideToUtf8Local(lbbarwin::g_barError));
        if (!barcode) continue;
        // 位图渲染 → 识别位图 回读
        const long long bitmap = 条码_取位图(barcode, 3);
        check(bitmap != 0, (std::string(item.name) + " 位图").c_str());
        long long result = 0;
        if (bitmap) {
            result = 条码_识别位图(bitmap);
            check(result != 0, (std::string(item.name) + " 识别").c_str(), lbbarwin::WideToUtf8Local(lbbarwin::g_recError));
            if (result) {
                check(条码_识别取文本(result) == std::wstring(item.expectText), (std::string(item.name) + " 文本一致").c_str(),
                      lbbarwin::WideToUtf8Local(条码_识别取文本(result)));
                check(条码_识别取码制(result) == std::wstring(item.symbology), (std::string(item.name) + " 码制一致").c_str(),
                      lbbarwin::WideToUtf8Local(条码_识别取码制(result)));
                check(条码_识别取校验通过(result), (std::string(item.name) + " 校验通过").c_str());
                条码_识别释放(result);
            }
            DeleteObject(reinterpret_cast<HBITMAP>(bitmap));
        }
        条码_释放(barcode);
    }

    // ===== BMP 保存与识别回读 =====
    {
        long long barcode = 条码_生成EAN13(L"590123412345");
        check(barcode != 0, "BMP 用例生成");
        if (barcode) {
            check(条码_保存BMP(barcode, L"barcode-test.bmp", 3), "保存BMP", lbbarwin::WideToUtf8Local(lbbarwin::g_barError));
            long long result = 条码_识别BMP(L"barcode-test.bmp");
            check(result != 0, "识别BMP 回读", lbbarwin::WideToUtf8Local(lbbarwin::g_recError));
            if (result) {
                check(std::wstring(条码_识别取文本(result)) == L"5901234123457", "BMP 回读文本一致",
                      lbbarwin::WideToUtf8Local(条码_识别取文本(result)));
                条码_识别释放(result);
            }
            条码_释放(barcode);
        }
    }

    // ===== 旋转 90°（纵向识别） =====
    {
        long long barcode = 条码_生成Code128(L"ROTATE-90");
        check(barcode != 0, "旋转用例生成");
        if (barcode) {
            const long long bitmap = 条码_取位图(barcode, 3);
            if (bitmap) {
                // 位图顺时针旋转 90°
                BITMAP bm = {};
                GetObjectW(reinterpret_cast<HBITMAP>(bitmap), sizeof(bm), &bm);
                const int w = bm.bmWidth, h = bm.bmHeight;
                BITMAPINFO info = {};
                info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
                info.bmiHeader.biWidth = w;
                info.bmiHeader.biHeight = -h;
                info.bmiHeader.biPlanes = 1;
                info.bmiHeader.biBitCount = 32;
                std::vector<unsigned char> buffer(size_t(w) * h * 4);
                HDC screen = GetDC(nullptr);
                HDC mem = CreateCompatibleDC(screen);
                GetDIBits(mem, reinterpret_cast<HBITMAP>(bitmap), 0, h, buffer.data(), &info, DIB_RGB_COLORS);
                BITMAPINFO rotated = {};
                rotated.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
                rotated.bmiHeader.biWidth = h;
                rotated.bmiHeader.biHeight = -w;
                rotated.bmiHeader.biPlanes = 1;
                rotated.bmiHeader.biBitCount = 32;
                void* rotatedBits = nullptr;
                HBITMAP rotatedBitmap = CreateDIBSection(screen, &rotated, DIB_RGB_COLORS, &rotatedBits, nullptr, 0);
                ReleaseDC(nullptr, screen);
                if (rotatedBitmap && rotatedBits) {
                    unsigned char* dst = static_cast<unsigned char*>(rotatedBits);
                    for (int y = 0; y < h; y++)
                        for (int x = 0; x < w; x++) {
                            // (x,y) → (h-1-y, x)
                            const unsigned char* src = &buffer[(size_t(y) * w + x) * 4];
                            unsigned char* target = &dst[(size_t(x) * h + size_t(h - 1 - y)) * 4];
                            target[0] = src[0]; target[1] = src[1]; target[2] = src[2]; target[3] = 255;
                        }
                    long long result = 条码_识别位图(reinterpret_cast<long long>(rotatedBitmap));
                    check(result != 0, "旋转 90° 识别", lbbarwin::WideToUtf8Local(lbbarwin::g_recError));
                    if (result) {
                        check(std::wstring(条码_识别取文本(result)) == L"ROTATE-90", "旋转回读文本一致");
                        条码_识别释放(result);
                    }
                    DeleteObject(rotatedBitmap);
                }
                DeleteDC(mem);
                DeleteObject(reinterpret_cast<HBITMAP>(bitmap));
            }
            条码_释放(barcode);
        }
    }

    // ===== 非法输入明确拒绝 =====
    {
        check(条码_生成EAN13(L"5901234123458") == 0, "EAN-13 错校验位拒绝"); // 末位应为 7
        check(条码_生成Code39(L"abc*") == 0, "Code39 星号拒绝");
        check(条码_生成Code128(L"\x01") == 0, "Code128 控制字符拒绝");
        check(条码_识别BMP(L"no-such-file.bmp") == 0, "不存在文件明确失败");
        check(条码_取模块数(999) == 0, "坏句柄模块数 0");
    }

    printf("\n===== 结果：%d 通过 / %d 失败 =====\n", g_passed, g_failed);
    return g_failed ? 1 : 0;
}
