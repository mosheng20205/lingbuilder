// ============================================================================
// driver_main.cpp — 微信OCR模块验收驱动器
//
// 单编译单元：直接 include 模块源文件，拿到全部内部符号。
// 用法：
//   driver status                  探测本机微信与 OCR 组件（不启动进程）
//   driver ocr <图片绝对路径>       全链识别并打印全部结果命令 + JSON
//   driver ocrbytes <图片绝对路径>  字节集识别（读文件字节走 pic_data，验证内存入口）
//   driver ocrloop <图片> <次数>    连续识别（验证组件进程复用与句柄回收）
//   driver stop                    OCR_停止 复位会话
// ============================================================================

#include "../lb_wxocr_core.cpp"

#include <cstdio>
#include <gdiplus.h>
#pragma comment(lib, "gdiplus.lib")

static std::string wideToUtf8(const std::wstring& w) {
    return lbwxocr::utf8FromWide(w);
}

int main(int argc, char* argv[]) {
    SetConsoleOutputCP(CP_UTF8);
    if (argc < 2) {
        std::fprintf(stderr, "usage: driver status | ocr <img> | ocrloop <img> <n> | stop\n");
        return 2;
    }
    const std::string cmd = argv[1];
    if (cmd == "status") {
        std::printf("version: %s\n", wideToUtf8(OCR_取版本()).c_str());
        std::printf("status : %s\n", wideToUtf8(OCR_取微信状态()).c_str());
        return 0;
    }
    if (cmd == "stop") {
        const bool ok = OCR_停止();
        std::printf("stop: %s err=%s\n", ok ? "true" : "false", wideToUtf8(OCR_取错误()).c_str());
        return 0;
    }
    if (cmd == "ocr" && argc >= 3) {
        // 命令行窄字符参数按 ACP 解码转宽字符（驱动器仅本机验收用）
        wchar_t wpath[1024];
        MultiByteToWideChar(CP_ACP, 0, argv[2], -1, wpath, 1024);
        const long long h = OCR_识别(wpath);
        if (h == 0) {
            std::fprintf(stderr, "OCR_识别 failed: %s\n", wideToUtf8(OCR_取错误()).c_str());
            return 1;
        }
        std::printf("handle   : %lld\n", h);
        std::printf("lines    : %d\n", OCR结果_取行数(h));
        std::printf("size     : %d x %d\n", OCR结果_取宽度(h), OCR结果_取高度(h));
        const int n = OCR结果_取行数(h);
        for (int i = 0; i < n; ++i) {
            std::printf("line[%d]  : rate=%.3f box=[%d,%d,%d,%d] text=%s\n",
                i, OCR结果_取置信度(h, i),
                OCR结果_取左坐标(h, i), OCR结果_取上坐标(h, i), OCR结果_取右坐标(h, i), OCR结果_取下坐标(h, i),
                wideToUtf8(OCR结果_取文本(h, i)).c_str());
        }
        std::printf("allTextCRLF:\n%s\n", wideToUtf8(OCR结果_取全部文本(h, true)).c_str());
        std::printf("json     : %s\n", wideToUtf8(OCR结果_取JSON(h)).c_str());
        std::printf("release  : %s\n", OCR结果_释放(h) ? "true" : "false");
        return 0;
    }
    if (cmd == "ocrbytes" && argc >= 3) {
        wchar_t wpath[1024];
        MultiByteToWideChar(CP_ACP, 0, argv[2], -1, wpath, 1024);
        // 读文件字节 → OCR_识别字节集（内存入口，不落盘路径）
        HANDLE f = CreateFileW(wpath, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (f == INVALID_HANDLE_VALUE) { std::fprintf(stderr, "open failed\n"); return 1; }
        LARGE_INTEGER sz;
        if (!GetFileSizeEx(f, &sz) || sz.QuadPart <= 0 || sz.QuadPart > 64 * 1024 * 1024) { CloseHandle(f); std::fprintf(stderr, "bad size\n"); return 1; }
        std::vector<unsigned char> data(static_cast<size_t>(sz.QuadPart));
        DWORD readn = 0;
        if (!ReadFile(f, data.data(), static_cast<DWORD>(data.size()), &readn, nullptr) || readn != data.size()) { CloseHandle(f); std::fprintf(stderr, "read failed\n"); return 1; }
        CloseHandle(f);
        const long long h = OCR_识别字节集(data);
        if (h == 0) {
            // 组合实验：pic_path 与 pic_data 同传（环境变量 WXOCR_BYTES_KEEP_PATH=1 时）
            const char* keep = getenv("WXOCR_BYTES_KEEP_PATH");
            (void)keep;
            std::fprintf(stderr, "OCR_识别字节集 failed: %s\n", wideToUtf8(OCR_取错误()).c_str());
            return 1;
        }
        std::printf("bytes-handle: %lld\n", h);
        std::printf("bytes-lines : %d\n", OCR结果_取行数(h));
        const int n = OCR结果_取行数(h);
        for (int i = 0; i < n; ++i) {
            std::printf("bytes[%d]    : %s\n", i, wideToUtf8(OCR结果_取文本(h, i)).c_str());
        }
        OCR结果_释放(h);
        return 0;
    }
    if (cmd == "ocrdib" && argc >= 3) {
        // 模拟剪贴板路径：PNG → GDI+ 解码 → GetDIBits → DIB 裸字节 → OCR_识别字节集
        wchar_t wpath[1024];
        MultiByteToWideChar(CP_ACP, 0, argv[2], -1, wpath, 1024);
        ULONG_PTR token = 0;
        Gdiplus::GdiplusStartupInput input;
        if (Gdiplus::GdiplusStartup(&token, &input, nullptr) != Gdiplus::Ok) { std::fprintf(stderr, "gdi+ fail\n"); return 1; }
        std::vector<unsigned char> dib;
        {
            Gdiplus::Bitmap bmp(wpath);
            if (bmp.GetLastStatus() != Gdiplus::Ok) { std::fprintf(stderr, "decode fail\n"); return 1; }
            const UINT w = bmp.GetWidth(), h = bmp.GetHeight();
            BITMAPINFO info = {};
            info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
            info.bmiHeader.biWidth = static_cast<LONG>(w);
            info.bmiHeader.biHeight = static_cast<LONG>(h);
            info.bmiHeader.biPlanes = 1;
            info.bmiHeader.biBitCount = 32;
            info.bmiHeader.biCompression = BI_RGB;
            dib.resize(sizeof(BITMAPINFOHEADER) + static_cast<size_t>(w) * h * 4);
            BITMAPINFOHEADER* out = reinterpret_cast<BITMAPINFOHEADER*>(dib.data());
            *out = info.bmiHeader;
            HDC screen = GetDC(nullptr);
            HBITMAP handle = nullptr;
            if (bmp.GetHBITMAP(Gdiplus::Color(255, 255, 255, 255), &handle) != Gdiplus::Ok || !handle) { std::fprintf(stderr, "hbitmap fail"); return 1; }
            const int rows = GetDIBits(screen, handle, 0, h, dib.data() + sizeof(BITMAPINFOHEADER), &info, DIB_RGB_COLORS);
            DeleteObject(handle);
            ReleaseDC(nullptr, screen);
            if (rows != static_cast<int>(h)) { std::fprintf(stderr, "getdibits fail\n"); return 1; }
        }
        Gdiplus::GdiplusShutdown(token);
        const long long h2 = OCR_识别字节集(dib);
        if (h2 == 0) {
            std::fprintf(stderr, "DIB recognize failed: %s\n", wideToUtf8(OCR_取错误()).c_str());
            return 1;
        }
        std::printf("dib-lines  : %d\n", OCR结果_取行数(h2));
        std::printf("dib[0]     : %s\n", wideToUtf8(OCR结果_取文本(h2, 0)).c_str());
        OCR结果_释放(h2);
        return 0;
    }
    if (cmd == "ocrloop" && argc >= 4) {
        wchar_t wpath[1024];
        MultiByteToWideChar(CP_ACP, 0, argv[2], -1, wpath, 1024);
        const int times = atoi(argv[3]);
        int pass = 0;
        for (int i = 0; i < times; ++i) {
            const long long h = OCR_识别(wpath);
            if (h != 0 && OCR结果_取行数(h) > 0 && OCR结果_释放(h)) {
                ++pass;
            } else {
                std::fprintf(stderr, "loop %d failed: %s\n", i, wideToUtf8(OCR_取错误()).c_str());
                break;
            }
        }
        std::printf("loop pass %d/%d\n", pass, times);
        return pass == times ? 0 : 1;
    }
    std::fprintf(stderr, "bad args\n");
    return 2;
}
