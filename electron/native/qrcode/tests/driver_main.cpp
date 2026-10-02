// ============================================================================
// driver_main.cpp — 二维码模块验收驱动器
//
// 单编译单元：直接 include 模块两个源文件，拿到全部内部符号（含 lbqr 命名空间）。
// 用法（由 acceptance.ps1 / acceptance.sh 编排）：
//   driver selfcheck                 模块内建自检（已知答案+全表 RS+闭环+损伤）
//   driver known                     已知答案 1-3 打印
//   driver dump <out.json>           5 组载荷矩阵导出（供 Node 对拍）
//   driver readback <tmpdir>         ≥20 组 生成→PNG→识别 逐字节回读
//   driver verify <图像> <期望文本文件> [out.json]   识别一张图并比对（退化测试用）
//   driver screen <文本>             窗口绘制 + 二维码_识别屏幕 闭环
//   driver corrupt                   数据区扰动扫荡（修复码字数如实上报）
// ============================================================================

#ifdef LB_QRCODE_DRIVER_SINGLE_TU
#endif

// 单编译单元：直接 include 模块两个源文件，拿到全部内部符号（含 lbqr 命名空间）。
#include "../lb_qrcode_core.cpp"
#include "../lb_qrcode_win.cpp"

#include <cstdio>
#include <string>
#include <vector>
#include <fstream>

using namespace lbqr;

static int gFail = 0;
static int gPass = 0;

static void reportCheck(bool ok, const std::string& label) {
    if (ok) { ++gPass; std::printf("[PASS] %s\n", label.c_str()); }
    else { ++gFail; std::printf("[FAIL] %s\n", label.c_str()); }
}

static std::string wideToUtf8Local(const std::wstring& w) {
    if (w.empty()) return std::string();
    const int need = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), nullptr, 0, nullptr, nullptr);
    std::string out(static_cast<size_t>(need), 0);
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), static_cast<int>(w.size()), &out[0], need, nullptr, nullptr);
    return out;
}

static std::wstring utf8ToWideLocal(const std::string& s) {
    if (s.empty()) return std::wstring();
    const int need = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0);
    std::wstring out(static_cast<size_t>(need), 0);
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), &out[0], need);
    return out;
}

static std::string readFileOrEmpty(const std::string& path) {
    std::ifstream f(path.c_str(), std::ios::binary);
    if (!f) return std::string();
    std::string data((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    return data;
}

static const char* XHS_URL =
    "https://www.xiaohongshu.com/mobile/login?qrId=59651790843686678&ruleId=4&xhs_code=359447"
    "&timestamp=1790843686691&channel_type=web&component_id=c86ac7a449d64a3b922ce0bd16bf9992";

// ===== 已知答案 =====
static int cmdKnown() {
    std::printf("== 已知答案 ==\n");
    reportCheck(formatBitsValue(1, 0) == 0x5412, "format M+掩码0 == 0x5412 (0b101010000010010)");
    reportCheck(formatBitsValue(1, 3) == 0x5B4B, "format M+掩码3 == 0x5B4B (0b101101101001011)");
    {
        EncodeResult e;
        std::wstring err;
        const bool ok = encodeQrInternal("HELLO WORLD", EncodeOptions{ 1, 0, 0 }, e, err)
            && e.version == 1 && e.size == 21;
        reportCheck(ok, "\"HELLO WORLD\" -> 版本1-M 模块数21");
    }
    {
        EncodeResult e;
        std::wstring err;
        const bool ok = encodeQrInternal(XHS_URL, EncodeOptions{ 1, 0, 0 }, e, err)
            && e.version == 9 && e.size == 53;
        reportCheck(ok, "175字节URL -> 版本9-M 模块数53");
        std::printf("   v=%d mask=%d size=%d penalty=%ld\n", e.version, e.mask, e.size, e.penalty);
    }
    std::printf("已知答案：PASS=%d FAIL=%d\n", gPass, gFail);
    return gFail == 0 ? 0 : 1;
}

// ===== 矩阵导出（Node 对拍） =====
static int cmdDump(const std::string& outPath) {
    std::string p40 = "https://lingbuilder.example.com/p/40bytes-payload!!";
    p40.resize(40);
    std::string p300;
    const std::string base = "https://lingbuilder.example.com/qr-matrix-compare?n=";
    while (p300.size() < 300) {
        char buf[64];
        std::snprintf(buf, sizeof(buf), "%d&", static_cast<int>(p300.size()));
        p300 += base + buf;
    }
    p300.resize(300);
    struct Case { const char* text; int len; } cases[5] = {
        { "#", 1 },
        { "hello:world", 11 },
        { p40.c_str(), 40 },
        { XHS_URL, 175 },
        { p300.c_str(), 300 },
    };
    std::string json = "{\n  \"cases\": [\n";
    for (int i = 0; i < 5; ++i) {
        const std::string text = cases[i].text;
        if (static_cast<int>(text.size()) != cases[i].len) {
            std::printf("[FAIL] 载荷 %d 长度 %d != %d\n", i, static_cast<int>(text.size()), cases[i].len);
            return 1;
        }
        EncodeResult e;
        std::wstring err;
        if (!encodeQrInternal(text, EncodeOptions{ 1, 0, 0 }, e, err)) {
            std::printf("[FAIL] 载荷 %d 编码失败: %s\n", i, wideToUtf8Local(err).c_str());
            return 1;
        }
        unsigned long long hash = 1469598103934665603ULL; // FNV-1a
        std::string rows = "[";
        for (int r = 0; r < e.size; ++r) {
            rows += "\"";
            for (int c = 0; c < e.size; ++c) {
                rows += e.matrix[static_cast<size_t>(r) * e.size + c] ? '1' : '0';
                hash = (hash ^ e.matrix[static_cast<size_t>(r) * e.size + c]) * 1099511628211ULL;
            }
            rows += "\"";
            if (r + 1 < e.size) rows += ",";
        }
        rows += "]";
        char head[160];
        std::snprintf(head, sizeof(head), "    { \"len\": %d, \"version\": %d, \"mask\": %d, \"size\": %d, \"fnv1a\": %llu, \"rows\": ",
            cases[i].len, e.version, e.mask, e.size, hash);
        std::string item = std::string(head) + rows + (i + 1 < 5 ? " },\n" : " }\n");
        json += item;
        std::printf("case%d len=%d v=%d mask=%d size=%d fnv1a=%016llx\n",
            i, cases[i].len, e.version, e.mask, e.size, hash);
    }
    json += "  ]\n}\n";
    std::ofstream f(outPath.c_str(), std::ios::binary);
    f << json;
    std::printf("矩阵已导出：%s\n", outPath.c_str());
    return gFail == 0 ? 0 : 1;
}

// ===== 回读覆盖 =====
static int cmdReadback(const std::string& tmpDir) {
    std::printf("== 回读覆盖（生成→PNG→识别 与 生成→字节集→识别 双路） ==\n");
    struct Case {
        const char* text;
        const char* level;
        int edge;
        int quiet;
        long long fg;
        long long bg;
    };
    static const long long BLACK = 0xFF000000LL, WHITE = 0xFFFFFFFFLL, RED = 0xFFCC2222LL,
        BLUE = 0xFF2244CCLL, YELLOW = 0xFFEEE522LL;
    std::string p40 = "https://lingbuilder.example.com/p/40bytes-payload!!";
    p40.resize(40);
    std::string p300;
    const std::string base300 = "https://lingbuilder.example.com/long-payload-300B?i=";
    while (p300.size() < 300) p300 += base300 + std::to_string(p300.size()) + "&";
    p300.resize(300);
    const std::vector<Case> cases = {
        { "HELLO WORLD", "M", 8, 4, BLACK, WHITE },
        { "A", "M", 8, 4, BLACK, WHITE },
        { "12345678901234567890", "M", 8, 4, BLACK, WHITE },
        { "https://example.com/path?q=1&r=%26+%2B", "M", 8, 4, BLACK, WHITE },
        { "二维码模块闭环自校验：中文内容逐字节一致", "M", 8, 4, BLACK, WHITE },
        { "码上点赞👍 mixed-emoji-utf8", "M", 8, 4, BLACK, WHITE },
        { XHS_URL, "M", 8, 4, BLACK, WHITE },
        { p300.c_str(), "M", 8, 4, BLACK, WHITE },
        { "L-level-short", "L", 8, 4, BLACK, WHITE },
        { "Q-level-mid-payload-123", "Q", 8, 4, BLACK, WHITE },
        { "H-level-tough", "H", 8, 4, BLACK, WHITE },
        { "123456789012345678901234567890123", "M", 8, 4, BLACK, WHITE },
        { "edge2-quiet2", "M", 2, 2, BLACK, WHITE },
        { "edge16-quiet6", "M", 16, 6, BLACK, WHITE },
        { "red-on-white", "M", 8, 4, RED, WHITE },
        { "blue-on-yellow", "M", 8, 4, BLUE, YELLOW },
        { "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:", "M", 8, 4, BLACK, WHITE },
        { "01234567890123", "M", 8, 4, BLACK, WHITE },
        { "escape-sensitive?&%=#+-.", "M", 8, 4, BLACK, WHITE },
        { "数字模式自动选择000111222333", "M", 8, 4, BLACK, WHITE },
        { "混合模式Mixed MODE 2026-10-01 12:00:00", "M", 8, 4, BLACK, WHITE },
        { "quiet0-edge4", "M", 4, 0, BLACK, WHITE },
        { "https://xmexample.com/！！全中文标点，。；：测试", "M", 8, 4, BLACK, WHITE },
        { p40.c_str(), "M", 8, 4, BLACK, WHITE },
    };
    for (size_t i = 0; i < cases.size(); ++i) {
        const Case& cs = cases[i];
        const std::string label = "case" + std::to_string(i + 1) + "(" + std::string(cs.text).substr(0, 24) + "...)";
        const long long h = ::二维码_生成(utf8ToWideLocal(cs.text).c_str(), utf8ToWideLocal(cs.level).c_str(), cs.edge, cs.quiet);
        if (!h) {
            reportCheck(false, label + " 生成失败：" + wideToUtf8Local(::二维码_取错误()));
            continue;
        }
        const std::string pngPath = tmpDir + "\\qr_case" + std::to_string(i + 1) + ".png";
        if (!::二维码_保存PNG(h, utf8ToWideLocal(pngPath).c_str(), cs.fg, cs.bg)) {
            reportCheck(false, label + " 保存PNG失败：" + wideToUtf8Local(::二维码_取错误()));
            ::二维码_释放(h);
            continue;
        }
        const long long r = ::二维码_识别PNG(utf8ToWideLocal(pngPath).c_str());
        if (!r) {
            reportCheck(false, label + " 识别PNG失败：" + wideToUtf8Local(::二维码_识别取错误()));
            ::二维码_释放(h);
            continue;
        }
        const std::wstring gotText = ::二维码_识别取文本(r);
        const bool textOk = gotText == utf8ToWideLocal(cs.text);
        const std::vector<unsigned char> raw = ::二维码_识别取字节(r);
        const std::string rawStr(raw.begin(), raw.end());
        const bool bytesOk = rawStr == std::string(cs.text);
        reportCheck(textOk && bytesOk, label + " PNG回读逐字节一致");
        if (!textOk || !bytesOk) {
            std::printf("   got-len=%zu want-len=%zu version=%d mask=%d level=%s mode=%s corrected=%d text=%s\n",
                rawStr.size(), std::string(cs.text).size(), ::二维码_识别取版本(r), ::二维码_识别取掩码(r),
                wideToUtf8Local(::二维码_识别取纠错级别(r)).c_str(), wideToUtf8Local(::二维码_识别取模式(r)).c_str(),
                ::二维码_识别取修复码字数(r), wideToUtf8Local(::二维码_识别取文本(r)).c_str());
        }
        // 第二路：矩阵 → 灰度字节集 → 识别字节集
        const int n = ::二维码_取模块数(h);
        std::vector<unsigned char> gray(static_cast<size_t>(n) * n);
        for (int rr = 0; rr < n; ++rr)
            for (int cc = 0; cc < n; ++cc)
                gray[static_cast<size_t>(rr) * n + cc] = ::二维码_取深色(h, rr, cc) ? 0 : 255;
        const long long r2 = ::二维码_识别字节集(gray, n, n, 1);
        bool second = false;
        if (r2) {
            const std::vector<unsigned char> raw2 = ::二维码_识别取字节(r2);
            second = std::string(raw2.begin(), raw2.end()) == std::string(cs.text);
            if (!second) std::printf("   byteset got=%s\n", wideToUtf8Local(::二维码_识别取文本(r2)).c_str());
            ::二维码_识别释放(r2);
        } else {
            std::printf("   byteset err=%s\n", wideToUtf8Local(::二维码_识别取错误()).c_str());
        }
        reportCheck(second, label + " 字节集直解逐字节一致");
        ::二维码_识别释放(r);
        ::二维码_释放(h);
    }
    std::printf("回读覆盖：PASS=%d FAIL=%d\n", gPass, gFail);
    return gFail == 0 ? 0 : 1;
}

// ===== verify：识别一张图并比对期望文本 =====
static int cmdVerify(const std::string& imagePath, const std::string& expectedPath, const std::string& outJson) {
    const std::string expected = readFileOrEmpty(expectedPath);
    const long long r = ::二维码_识别PNG(utf8ToWideLocal(imagePath).c_str());
    if (!r) {
        std::printf("[FAIL] verify %s 识别失败：%s\n", imagePath.c_str(), wideToUtf8Local(::二维码_识别取错误()).c_str());
        return 1;
    }
    const std::vector<unsigned char> raw = ::二维码_识别取字节(r);
    const std::string got(raw.begin(), raw.end());
    const bool ok = got == expected;
    char json[1024];
    std::snprintf(json, sizeof(json),
        "{ \"image\": \"%s\", \"ok\": %s, \"version\": %d, \"mask\": %d, \"corrected\": %d, \"finders\": %d }\n",
        imagePath.c_str(), ok ? "true" : "false", ::二维码_识别取版本(r), ::二维码_识别取掩码(r),
        ::二维码_识别取修复码字数(r), ::二维码_识别取定位点数(r));
    std::printf("%s", json);
    if (!outJson.empty()) {
        std::ofstream f(outJson.c_str(), std::ios::binary);
        f << json;
    }
    reportCheck(ok, "verify " + imagePath);
    ::二维码_识别释放(r);
    return ok ? 0 : 1;
}

// ===== 屏幕闭环 =====
static LRESULT CALLBACK QrPaintProc(HWND w, UINT m, WPARAM wp, LPARAM lp) {
    if (m == WM_PAINT) {
        PAINTSTRUCT ps;
        HDC dc = BeginPaint(w, &ps);
        const HBITMAP bmp = reinterpret_cast<HBITMAP>(GetWindowLongPtrW(w, GWLP_USERDATA));
        if (bmp) {
            HDC mem = CreateCompatibleDC(dc);
            const HGDIOBJ old = SelectObject(mem, bmp);
            RECT rc = {};
            GetClientRect(w, &rc);
            BitBlt(dc, 0, 0, rc.right, rc.bottom, mem, 0, 0, SRCCOPY);
            SelectObject(mem, old);
            DeleteDC(mem);
        }
        EndPaint(w, &ps);
        return 0;
    }
    return DefWindowProcW(w, m, wp, lp);
}

static int cmdScreen(const char* text) {
    std::printf("== 屏幕抓取闭环 ==\n");
    const long long h = ::二维码_生成(utf8ToWideLocal(text).c_str(), L"M", 6, 4);
    if (!h) { std::printf("[FAIL] screen 生成失败：%s\n", wideToUtf8Local(::二维码_取错误()).c_str()); return 1; }
    const long long bmpHandle = ::二维码_取位图(h, 0xFF000000LL, 0xFFFFFFFFLL);
    if (!bmpHandle) { std::printf("[FAIL] screen 取位图失败：%s\n", wideToUtf8Local(::二维码_取错误()).c_str()); return 1; }
    const HBITMAP bmp = reinterpret_cast<HBITMAP>(bmpHandle);
    BITMAP bm = {};
    GetObjectW(bmp, sizeof(bm), &bm);
    // 位图自检：GetDIBits 取回并落盘，验证 二维码_取位图 渲染本身正确
    {
        BITMAPINFO bi = {};
        bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        bi.bmiHeader.biWidth = bm.bmWidth;
        bi.bmiHeader.biHeight = -std::abs(bm.bmHeight);
        bi.bmiHeader.biPlanes = 1;
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = BI_RGB;
        std::vector<unsigned char> px(static_cast<size_t>(bm.bmWidth) * std::abs(bm.bmHeight) * 4);
        HDC tdc = GetDC(nullptr);
        GetDIBits(tdc, bmp, 0, std::abs(bm.bmHeight), px.data(), &bi, DIB_RGB_COLORS);
        ReleaseDC(nullptr, tdc);
        std::vector<unsigned char> gray(px.size() / 4);
        for (size_t i = 0; i < gray.size(); ++i)
            gray[i] = static_cast<unsigned char>((px[i * 4 + 2] * 299 + px[i * 4 + 1] * 587 + px[i * 4] * 114) / 1000);
        std::vector<unsigned char> png;
        std::wstring perr;
        if (lbqr::encodePngToBytes(bm.bmWidth, std::abs(bm.bmHeight), gray, true, png, perr)) {
            FILE* f = nullptr;
            if (_wfopen_s(&f, L"tmp/bitmap_check.png", L"wb") == 0 && f) {
                std::fwrite(png.data(), 1, png.size(), f);
                std::fclose(f);
            }
        }
        const long long rchk = ::二维码_识别字节集(gray, bm.bmWidth, std::abs(bm.bmHeight), 1);
        std::printf("bitmap selfcheck decode=%s text=%s\n", rchk ? "OK" : "FAIL",
            rchk ? wideToUtf8Local(::二维码_识别取文本(rchk)).c_str() : "?");
        if (rchk) ::二维码_识别释放(rchk);
    }
    // 弹出边框窗口绘制位图，等待绘制完成后抓屏
    WNDCLASSW wc = {};
    wc.lpfnWndProc = QrPaintProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.lpszClassName = L"LBQRScreenTestWnd";
    wc.hCursor = LoadCursorW(nullptr, MAKEINTRESOURCEW(32512));
    RegisterClassW(&wc);
    SetProcessDPIAware(); // 屏幕抓取按物理像素，避开 150% 缩放的 DPI 虚拟化
    const int winW = bm.bmWidth + 2 * GetSystemMetrics(SM_CXFIXEDFRAME);
    const int winH = bm.bmHeight + 2 * GetSystemMetrics(SM_CYFIXEDFRAME) + GetSystemMetrics(SM_CYCAPTION);
    HWND wnd = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, wc.lpszClassName, L"LBQR", WS_OVERLAPPEDWINDOW,
        20, 20, winW, winH, nullptr, nullptr, wc.hInstance, nullptr);
    SetWindowLongPtrW(wnd, GWLP_USERDATA, static_cast<LONG_PTR>(bmpHandle));
    RECT frame = { 0, 0, bm.bmWidth, bm.bmHeight };
    AdjustWindowRect(&frame, WS_OVERLAPPEDWINDOW, FALSE);
    SetWindowPos(wnd, nullptr, 20, 20, frame.right - frame.left, frame.bottom - frame.top, SWP_NOZORDER);
    // 自绘：WM_PAINT 由 DefWindowProc 不画位图，这里改用背景刷绘制一次到位
    HDC screenDC = GetDC(nullptr);
    HDC memDC = CreateCompatibleDC(screenDC);
    const HGDIOBJ oldBmp = SelectObject(memDC, bmp);
    ShowWindow(wnd, SW_SHOWNOACTIVATE);
    SetWindowPos(wnd, HWND_TOPMOST, 20, 20, winW, winH, SWP_SHOWWINDOW);
    SetForegroundWindow(wnd);
    UpdateWindow(wnd);
    // WM_PAINT 负责绘制；泵消息等待首帧绘制完成
    RECT rc = {};
    GetClientRect(wnd, &rc);
    for (int i = 0; i < 40; ++i) {
        MSG msg;
        while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
        Sleep(25);
    }
    RedrawWindow(wnd, nullptr, nullptr, RDW_INVALIDATE | RDW_UPDATENOW);
    for (int i = 0; i < 16; ++i) {
        MSG msg;
        while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
        Sleep(25);
    }
    // 抓窗口客户区
    POINT pt = { 0, 0 };
    ClientToScreen(wnd, &pt);
    const long long r = ::二维码_识别屏幕(pt.x, pt.y, rc.right, rc.bottom);
    // 抓屏内容存档便于排查：直接用模块内部 PNG 编码器落盘
    {
        std::vector<unsigned char> cap(static_cast<size_t>(rc.right) * rc.bottom * 4);
        BITMAPINFO info2 = {};
        info2.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        info2.bmiHeader.biWidth = rc.right;
        info2.bmiHeader.biHeight = -rc.bottom;
        info2.bmiHeader.biPlanes = 1;
        info2.bmiHeader.biBitCount = 32;
        info2.bmiHeader.biCompression = BI_RGB;
        HDC mem2 = CreateCompatibleDC(screenDC);
        HBITMAP bmp2 = CreateCompatibleBitmap(screenDC, rc.right, rc.bottom);
        const HGDIOBJ old2 = SelectObject(mem2, bmp2);
        BitBlt(mem2, 0, 0, rc.right, rc.bottom, screenDC, pt.x, pt.y, SRCCOPY | CAPTUREBLT);
        GetDIBits(mem2, bmp2, 0, rc.bottom, cap.data(), &info2, DIB_RGB_COLORS);
        SelectObject(mem2, old2);
        DeleteObject(bmp2);
        DeleteDC(mem2);
        std::vector<unsigned char> gray(cap.size() / 4);
        for (size_t i = 0; i < gray.size(); ++i)
            gray[i] = static_cast<unsigned char>((cap[i * 4 + 2] * 299 + cap[i * 4 + 1] * 587 + cap[i * 4] * 114) / 1000);
        std::vector<unsigned char> png;
        std::wstring perr;
        if (lbqr::encodePngToBytes(rc.right, rc.bottom, gray, true, png, perr)) {
            FILE* f = nullptr;
            if (_wfopen_s(&f, L"tmp/screen_capture.png", L"wb") == 0 && f) {
                std::fwrite(png.data(), 1, png.size(), f);
                std::fclose(f);
                std::printf("capture saved tmp/screen_capture.png %dx%d\n", rc.right, rc.bottom);
            }
        }
    }
    bool ok = false;
    if (r) {
        const std::vector<unsigned char> raw = ::二维码_识别取字节(r);
        ok = std::string(raw.begin(), raw.end()) == std::string(text);
        reportCheck(ok, "识别屏幕闭环");
        std::printf("   corrected=%d finders=%d\n", ::二维码_识别取修复码字数(r), ::二维码_识别取定位点数(r));
        ::二维码_识别释放(r);
    } else {
        reportCheck(false, "识别屏幕闭环：" + wideToUtf8Local(::二维码_识别取错误()));
    }
    ReleaseDC(nullptr, screenDC);
    SelectObject(memDC, oldBmp);
    DeleteDC(memDC);
    DestroyWindow(wnd);
    UnregisterClassW(wc.lpszClassName, wc.hInstance);
    ::二维码_释放(h);
    return ok ? 0 : 1;
}

// ===== 数据区扰动扫荡 =====
static int cmdCorrupt() {
    std::printf("== 数据区扰动扫荡（如实上报修复码字数） ==\n");
    struct Spec { int version; int level; int flips; };
    const Spec specs[] = {
        { 3, 1, 1 }, { 3, 1, 4 }, { 3, 1, 8 }, { 3, 1, 13 },
        { 7, 1, 4 }, { 7, 1, 9 }, { 7, 1, 14 },
        { 12, 1, 6 }, { 12, 1, 11 },
        { 3, 3, 4 }, { 7, 0, 4 }, { 7, 2, 5 },
    };
    for (const Spec& spec : specs) {
        const std::string text = "corruption-sweep-v" + std::to_string(spec.version) + "-lvl" + std::to_string(spec.level);
        EncodeResult e;
        std::wstring err;
        if (!encodeQrInternal(text, EncodeOptions{ spec.level, spec.version, MODE_BYTE }, e, err)) {
            reportCheck(false, "corrupt v" + std::to_string(spec.version) + " 编码失败");
            continue;
        }
        // 数据区模块位扰动（避开功能图形：用 fn 表过滤）
        QrMatrix fn = buildFunctionPattern(spec.version);
        std::vector<size_t> dataIdx;
        for (int r = 0; r < e.size; ++r)
            for (int c = 0; c < e.size; ++c)
                if (!fn.f(r, c)) dataIdx.push_back(static_cast<size_t>(r) * e.size + c);
        for (int k = 0; k < spec.flips; ++k) {
            const size_t idx = dataIdx[(k * 48271 + 11) % dataIdx.size()];
            e.matrix[idx] ^= 1;
        }
        std::vector<unsigned char> pixels;
        bool gray = false;
        rasterizeMatrix(e.matrix, e.size, 4, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (e.size + 8) * 4;
        GrayImage img;
        img.w = size;
        img.h = size;
        img.px = pixels;
        DecodeOutput dec;
        int finders = 0;
        Quad quad;
        const bool ok = decodeGrayImage(img, dec, finders, quad, err) && dec.utf8 == text;
        reportCheck(ok, "corrupt v" + std::to_string(spec.version) + "-L" + LEVEL_NAMES[spec.level]
            + " 扰动" + std::to_string(spec.flips) + "模块");
        if (ok) std::printf("   corrected=%d\n", dec.corrected);
        else std::printf("   err=%s\n", wideToUtf8Local(err).c_str());
    }
    std::printf("扰动扫荡：PASS=%d FAIL=%d\n", gPass, gFail);
    return gFail == 0 ? 0 : 1;
}

int main(int argc, char** argv) {
    if (getenv("LBQR_DBG")) lbqr::lbqrDbg = 1;
    if (argc < 2) {
        std::printf("用法：driver selfcheck|known|dump <json>|readback <dir>|verify <img> <txt> [json]|screen <文本>|corrupt\n");
        return 2;
    }
    SetConsoleOutputCP(CP_UTF8);
    const std::string mode = argv[1];
    if (mode == "selfcheck") {
        const bool ok = ::二维码_自检();
        reportCheck(ok, "二维码_自检（闭环）");
        if (!ok) std::printf("   错误：%s\n", wideToUtf8Local(::二维码_取错误()).c_str());
        std::printf("自检：PASS=%d FAIL=%d\n", gPass, gFail);
        return gFail == 0 ? 0 : 1;
    }
    if (mode == "debug") {
        EncodeResult e; std::wstring err;
        const int target = (std::max)(1, dataCodewords(1, 0) * 2 / 3);
        std::string payload;
        static const char CHUNK[] = "QR\xE4\xBA\x8C\xE7\xBB\xB4\xE7\xA0\x81#9";
        while (static_cast<int>(payload.size()) < target) payload += CHUNK;
        payload.resize(static_cast<size_t>(target));
        if (!encodeQrInternal(payload, EncodeOptions{ 0, 1, MODE_BYTE }, e, err)) { std::printf("enc fail: %s\n", wideToUtf8Local(err).c_str()); return 1; }
        std::printf("enc v=%d mask=%d size=%d level=%d payload=%d bytes\n", e.version, e.mask, e.size, e.level, (int)payload.size());
        {
            const std::vector<uint8_t> cw = interleave(payload, MODE_BYTE, 4, 3);
            std::string hex;
            for (uint8_t b : cw) { char buf[8]; std::snprintf(buf, sizeof(buf), "%02X ", b); hex += buf; }
            std::printf("cw(26)=%s\n", hex.c_str());
            std::vector<uint8_t> full(cw.begin(), cw.begin() + dataCodewords(4, 3));
            std::vector<uint8_t> rem;
            rsRemainder(full, ECC_PER_BLOCK[3][4], rem);
            std::string rhex;
            for (uint8_t b : rem) { char buf[8]; std::snprintf(buf, sizeof(buf), "%02X ", b); rhex += buf; }
            std::printf("remainder(should be 00 x7)=%s\n", rhex.c_str());
            std::vector<uint8_t> fullCw = cw;
            std::printf("syndromeZero(full)=%d\n", (int)rsSyndromeZero(fullCw, ECC_PER_BLOCK[3][4]));
            const GfTables& g = gf();
            for (int i = 0; i < 16; ++i) {
                int v = 0;
                for (int j = 0; j < 26; ++j) v = g.mul(v, g.exp[i]) ^ fullCw[j];
                std::printf("S%d=%02X ", i, v);
            }
            std::printf("\n");
        }
        DecodeOutput d;
        const bool ok = decodeMatrix(e.size, e.matrix, d, err);
        std::printf("raw decodeMatrix ok=%d err=%s text-len=%zu match=%d\n", (int)ok, wideToUtf8Local(err).c_str(), d.utf8.size(), d.utf8 == payload);
        {
            // 逐步复刻 decodeMatrix：读格式 → 去掩码 → 蛇形 → 打包 → 与编码器码字比对
            const int n = e.size; const int ver = (n - 17) / 4;
            const QrMatrix fnm = buildFunctionPattern((e.size - 17) / 4);
            std::vector<uint8_t> grid(static_cast<size_t>(n) * n, 0);
            for (int r = 0; r < n; ++r) for (int c = 0; c < n; ++c) {
                uint8_t v = e.matrix[r * n + c];
                if (!fnm.f(r, c) && maskFormula(e.mask, r, c)) v ^= 1;
                grid[r * n + c] = v;
            }
            std::vector<uint8_t> stream;
            for (int right = n - 1; right >= 1; right -= 2) {
                if (right == 6) right = 5;
                for (int vert = 0; vert < n; ++vert) {
                    for (int j = 0; j < 2; ++j) {
                        const int c = right - j;
                        const bool upward = ((right + 1) & 2) == 0;
                        const int r = upward ? n - 1 - vert : vert;
                        if (fnm.f(r, c)) continue;
                        stream.push_back(grid[r * n + c]);
                    }
                }
            }
            std::vector<uint8_t> packed;
            for (size_t i = 0; i + 8 <= stream.size(); i += 8) {
                unsigned b = 0;
                for (int k = 0; k < 8; ++k) b = (b << 1) | stream[i + k];
                packed.push_back(static_cast<uint8_t>(b));
            }
            const std::vector<uint8_t> cw = interleave(payload, MODE_BYTE, 1, 0);
            int firstDiff = -1, diffCount = 0;
            for (size_t i = 0; i < (std::min)(packed.size(), cw.size()); ++i)
                if (packed[i] != cw[i]) { if (firstDiff < 0) firstDiff = (int)i; ++diffCount; }
            std::printf("packed=%zu cw=%zu firstDiff=%d diffCount=%d streamBits=%zu\n",
                packed.size(), cw.size(), firstDiff, diffCount, stream.size());
            // 差异位 → 矩阵坐标
            for (size_t i = 0; i < (std::min)(packed.size(), cw.size()); ++i) {
                if (packed[i] == cw[i]) continue;
                for (int k = 0; k < 8; ++k) {
                    const bool a = (packed[i] >> (7 - k)) & 1, b = (cw[i] >> (7 - k)) & 1;
                    if (a != b) {
                        const size_t bitIndex = i * 8 + k;
                        // 重新走一遍蛇形找该数据位的位置
                        size_t idx = 0;
                        for (int right = n - 1; right >= 1 && idx <= bitIndex; right -= 2) {
                            if (right == 6) right = 5;
                            for (int vert = 0; vert < n && idx <= bitIndex; ++vert) {
                                for (int j = 0; j < 2 && idx <= bitIndex; ++j) {
                                    const int c = right - j;
                                    const bool upward = ((right + 1) & 2) == 0;
                                    const int r = upward ? n - 1 - vert : vert;
                                    if (fnm.f(r, c)) continue;
                                    if (idx == bitIndex) std::printf("  diff bit at cw%zu bit%d -> (r=%d,c=%d) grid=%d enc=%d fn=%d maskOn=%d\n",
                                        i, k, r, c, grid[r * n + c], e.matrix[r * n + c], fnm.f(r, c), (int)maskFormula(6, r, c));
                                    ++idx;
                                }
                            }
                        }
                    }
                }
            }
        }
        {
            int raw1 = 0, raw2 = 0;
            const int n = e.size;
            for (int i = 0; i < 15; ++i) {
                int b1 = 0, b2 = 0;
                if (i < 6) b1 = e.matrix[i * n + 8];
                else if (i < 8) b1 = e.matrix[(i + 1) * n + 8];
                else b1 = e.matrix[(n - 15 + i) * n + 8];
                if (i <= 7) b2 = e.matrix[8 * n + (n - 1 - i)];
                else b2 = e.matrix[8 * n + (14 - i)];
                raw1 |= b1 << i;
                raw2 |= b2 << i;
            }
            int lv = -1, mk = -1;
            const bool f1 = hammingDecodeFormat(raw1, lv, mk);
            std::printf("raw1=%04X raw2=%04X dec(f1=%d level=%d mask=%d) expect(level=0 mask=%d fmt=%04X)\n",
                raw1, raw2, (int)f1, lv, mk, e.mask, formatBitsValue(e.level, e.mask));
        }
        std::vector<unsigned char> pixels; bool gray = false;
        rasterizeMatrix(e.matrix, e.size, 3, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        GrayImage img; img.w = img.h = (e.size + 8) * 3; img.px = pixels;
        DecodeOutput out2; int finders = 0; Quad quad;
        const bool full = decodeGrayImage(img, out2, finders, quad, err);
        std::printf("decodeGrayImage ok=%d err=%s corrected=%d\n", (int)full, wideToUtf8Local(err).c_str(), out2.corrected);
        // 手动管线差分
        std::vector<uint8_t> bin; binarizeOtsu(img, bin);
        std::vector<FinderHit> hits;
        scanRowFinders(bin, img.w, img.h, hits);
        std::vector<FinderHit> verified2, clusters;
        for (const FinderHit& f : hits) if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) verified2.push_back(f);
        clusterHits(verified2, clusters);
        if (clusters.size() >= 3) {
            const FinderHit& T = clusters[0];
            const FinderHit& P = clusters[1];
            const FinderHit& Q = clusters[2];
            const double cross = (P.x - T.x) * (Q.y - T.y) - (P.y - T.y) * (Q.x - T.x);
            const FinderHit& trHit = cross > 0 ? P : Q;
            const FinderHit& blHit = cross > 0 ? Q : P;
            Localization loc;
            const int N = e.size; if (buildHomographyFor(img, bin, T, trHit, blHit, N, loc)) {
                // 与 decodeGrayImage 完全一致的 9 点采样
                double ax, ay, bx, by;
                loc.h.map(0, 0, ax, ay);
                loc.h.map(1, 0, bx, by);
                const double modulePx = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
                const bool nearest = modulePx < 1.5;
                auto samplePoint = [&](double x, double y) -> unsigned char {
                    if (!nearest) return img.bilinear(x, y);
                    return img.at(static_cast<int>(std::floor(x)), static_cast<int>(std::floor(y)));
                };
                std::vector<unsigned char> sampled(N * N);
                for (int r = 0; r < N; ++r) for (int cc = 0; cc < N; ++cc) {
                    double ox, oy;
                    loc.h.map(cc + 0.5, r + 0.5, ox, oy);
                    sampled[r * N + cc] = samplePoint(ox, oy);
                }
                GrayImage gridImg; gridImg.w = N; gridImg.h = N; gridImg.px = sampled;
                const int gridThreshold = otsuThreshold(gridImg);
                std::printf("gridThreshold=%d modulePx=%.2f nearest=%d\n", gridThreshold, modulePx, (int)nearest);
                static const double OFF9[9][2] = { { 0, 0 }, { -0.25, -0.25 }, { 0.25, -0.25 }, { -0.25, 0.25 }, { 0.25, 0.25 }, { -0.25, 0 }, { 0.25, 0 }, { 0, -0.25 }, { 0, 0.25 } };
                int diff = 0;
                for (int r = 0; r < N; ++r) for (int cc = 0; cc < N; ++cc) {
                    double ox, oy;
                    loc.h.map(cc + 0.5, r + 0.5, ox, oy);
                    int dark = 0;
                    for (int k = 0; k < 9; ++k)
                        if (samplePoint(ox + OFF9[k][0] * modulePx, oy + OFF9[k][1] * modulePx) <= gridThreshold) ++dark;
                    const int bit = dark >= 5 ? 1 : 0;
                    if (bit != e.matrix[r * N + cc]) {
                        if (diff < 8) std::printf("  diff at r=%d c=%d got=%d want=%d dark=%d px=%.2f,%.2f\n", r, cc, bit, e.matrix[r * N + cc], dark, ox, oy);
                        ++diff;
                    }
                }
                std::printf("matrix diff=%d\n", diff);
            }
        }
        return 0;
    }
    if (mode == "fliptest") {
        EncodeResult e; std::wstring err;
        if (!encodeQrInternal("QR-ERROR-CORRECTION-CHECK-2026", EncodeOptions{ 1, 5, MODE_BYTE }, e, err)) { std::printf("enc fail\n"); return 1; }
        std::printf("enc v=%d mask=%d size=%d\n", e.version, e.mask, e.size);
        int flipped = 0;
        for (int r = 9; r < e.size - 9 && flipped < 6; ++r)
            for (int c = 9; c < e.size - 9 && flipped < 6; ++c)
                if (e.matrix[static_cast<size_t>(r) * e.size + c]) {
                    e.matrix[static_cast<size_t>(r) * e.size + c] = 0;
                    ++flipped;
                    std::printf("flip at (%d,%d)\n", r, c);
                    c += 5;
                }
        std::printf("flipped=%d\n", flipped);
        std::vector<unsigned char> pixels; bool gray = false;
        rasterizeMatrix(e.matrix, e.size, 4, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (e.size + 8) * 4;
        GrayImage img; img.w = size; img.h = size; img.px = pixels;
        DecodeOutput dec; int finders = 0; Quad quad;
        const bool ok = decodeGrayImage(img, dec, finders, quad, err);
        std::printf("decode ok=%d corrected=%d text=%s err=%s\n", (int)ok, dec.corrected, dec.utf8.c_str(), wideToUtf8Local(err).c_str());
        std::vector<uint8_t> bin; binarizeOtsu(img, bin);
        std::vector<FinderHit> hits; scanRowFinders(bin, img.w, img.h, hits);
        std::vector<FinderHit> ver2, clusters;
        for (const FinderHit& f : hits) if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) ver2.push_back(f);
        clusterHits(ver2, clusters);
        std::printf("clusters=%zu\n", clusters.size());
        return 0;
    }
    if (mode == "rstest") {
        // 独立 RS 纠错复现：v1-M 单块，人为翻转 k 个码字
        const std::string payload = "HELLO WORLD";
        { EncodeResult e2; std::wstring e3; encodeQrInternal(payload, EncodeOptions{ 1, 0, 0 }, e2, e3); std::printf("auto-mode=%d\n", e2.mode); DecodeOutput dd; const bool ok = decodeMatrix(e2.size, e2.matrix, dd, e3); std::printf("alnum raw decode ok=%d text=%s err=%s\n", (int)ok, dd.utf8.c_str(), wideToUtf8Local(e3).c_str()); }
        const std::vector<uint8_t> cw = interleave(payload, MODE_BYTE, 1, 1);
        { const GfTables& g = gf(); std::printf("mul(FF,EA)=%02X pow(EA,2)=%02X S1expect=%02X\n", g.mul(0xFF,0xEA), g.pow(0xEA,2), g.mul(0xFF, g.pow(0xEA,1))); }
        {
            const long long h = ::二维码_生成(utf8ToWideLocal("HELLO WORLD").c_str(), L"M", 8, 4);
            const std::string pngPath = "tmp/probe_case1.png";
            const bool saved = ::二维码_保存PNG(h, utf8ToWideLocal(pngPath).c_str(), 0xFF000000LL, 0xFFFFFFFFLL);
            const long long r = ::二维码_识别PNG(utf8ToWideLocal(pngPath).c_str());
            std::printf("public roundtrip saved=%d r=%lld mask=%d level=%s mode=%s corrected=%d text=%s err=%s\n",
                (int)saved, r, r ? ::二维码_识别取掩码(r) : -1, r ? wideToUtf8Local(::二维码_识别取纠错级别(r)).c_str() : "?",
                r ? wideToUtf8Local(::二维码_识别取模式(r)).c_str() : "?", r ? ::二维码_识别取修复码字数(r) : -1,
                r ? wideToUtf8Local(::二维码_识别取文本(r)).c_str() : "", r ? "" : wideToUtf8Local(::二维码_识别取错误()).c_str());
            if (r) ::二维码_识别释放(r);
            ::二维码_释放(h);
        }
        {
            // 字节集直解复现：N×N 灰度矩阵 1 像素/模块
            const long long h = ::二维码_生成(utf8ToWideLocal("HELLO WORLD").c_str(), L"M", 8, 4);
            const int n = ::二维码_取模块数(h);
            std::vector<unsigned char> gray(static_cast<size_t>(n) * n);
            for (int rr = 0; rr < n; ++rr)
                for (int cc = 0; cc < n; ++cc)
                    gray[static_cast<size_t>(rr) * n + cc] = ::二维码_取深色(h, rr, cc) ? 0 : 255;
            const long long r2 = ::二维码_识别字节集(gray, n, n, 1);
            std::printf("byteset n=%d r2=%lld text=%s err=%s\n", n, r2,
                r2 ? wideToUtf8Local(::二维码_识别取文本(r2)).c_str() : "?",
                r2 ? "" : wideToUtf8Local(::二维码_识别取错误()).c_str());
            {
                GrayImage img; img.w = n; img.h = n; img.px = gray;
                std::vector<uint8_t> bin; binarizeOtsu(img, bin);
                std::vector<FinderHit> hits; scanRowFinders(bin, img.w, img.h, hits);
                int verified = 0;
                for (const FinderHit& f : hits) if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) ++verified;
                std::vector<FinderHit> clusters; clusterHits(
                    [&] { std::vector<FinderHit> v; for (const FinderHit& f : hits) if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) v.push_back(f); return v; }(),
                    clusters);
                std::printf("byteset diag hits=%d verified=%d clusters=%zu\n", (int)hits.size(), verified, clusters.size());
                for (int yy = 0; yy < 8; ++yy) {
                    std::string row;
                    for (int x = 0; x < 21; ++x) row += bin[static_cast<size_t>(yy) * n + x] ? '#' : '.';
                    std::printf("  row%d: %s\n", yy, row.c_str());
                }
                if (verified > 0) for (const FinderHit& f : hits) if (verticalCrossCheck(bin, img.w, img.h, f.x, f.y, f.unit)) std::printf("  vhit (%.1f,%.1f) u=%.2f\n", f.x, f.y, f.unit);
            }
            if (r2) ::二维码_识别释放(r2);
            ::二维码_释放(h);
        }
        std::printf("cw size=%zu\n", cw.size());
        for (int k = 1; k <= 4; ++k) {
            std::vector<uint8_t> bad = cw;
            for (int t = 0; t < k; ++t) bad[(t * 7 + 3) % bad.size()] ^= 0xFF;
            std::vector<uint8_t> work = bad;
            const int fixed = rsDecode(work, 10);
            std::printf("k=%d fixed=%d restored=%s\n", k, fixed, work == cw ? "YES" : "NO");
        }
        return 0;
    }
    if (mode == "pngwrite") {
        const long long h = ::二维码_生成(utf8ToWideLocal("HELLO WORLD").c_str(), L"M", 8, 4);
        if (!h) { std::printf("gen fail\n"); return 1; }
        const bool ok = ::二维码_保存PNG(h, utf8ToWideLocal(argv[2]).c_str(), 0xFF000000LL, 0xFFFFFFFFLL);
        std::printf("save=%d err=%s\n", (int)ok, wideToUtf8Local(::二维码_取错误()).c_str());
        ::二维码_释放(h);
        return ok ? 0 : 1;
    }
    if (mode == "penalty") {
        const std::string payload = XHS_URL;
        const std::vector<uint8_t> cwv = interleave(payload, MODE_BYTE, 9, 1);
        {
            std::string hex;
            char buf[8];
            for (int i = 0; i < 12 && i < static_cast<int>(cwv.size()); ++i) {
                std::snprintf(buf, sizeof(buf), "%02X ", cwv[i]);
                hex += buf;
            }
            std::printf("cpp cw[0..11]=%s\n", hex.c_str());
        }
        std::vector<uint8_t> stream;
        for (uint8_t b : cwv) pushBits(stream, b, 8);
        for (int mask = 0; mask < 8; ++mask) {
            QrMatrix mm = buildFunctionPattern(9);
            placeData(mm, stream);
            applyMask(mm, mask);
            placeFormat(mm, formatBitsValue(1, mask));
            placeVersion(mm, versionBitsValue(9));
            std::printf("mask%d penalty=%ld\n", mask, penaltyScore(mm));
            if (mask == 0) {
                // 导出 mask0 矩阵供 JS 逐格 diff
                std::string rows = "[";
                for (int r = 0; r < mm.size; ++r) {
                    rows += "\"";
                    for (int c = 0; c < mm.size; ++c) rows += mm.at(r, c) ? '1' : '0';
                    rows += r + 1 < mm.size ? "\"," : "\"";
                }
                rows += "]";
                std::ofstream f("cpp-mask0.json", std::ios::binary);
                f << "{\"size\":" << mm.size << ",\"rows\":" << rows << "}";
                std::printf("cpp-mask0.json written\n");
            }
        }
        return 0;
    }
    if (mode == "printtext") {
        const long long r = ::二维码_识别PNG(utf8ToWideLocal(argv[2]).c_str());
        if (!r) { std::printf("FAIL: %s\n", wideToUtf8Local(::二维码_识别取错误()).c_str()); return 1; }
        std::printf("text=%s\n", wideToUtf8Local(::二维码_识别取文本(r)).c_str());
        std::printf("version=%d mask=%d corrected=%d finders=%d\n", ::二维码_识别取版本(r), ::二维码_识别取掩码(r), ::二维码_识别取修复码字数(r), ::二维码_识别取定位点数(r));
        ::二维码_识别释放(r);
        return 0;
    }
    if (mode == "known") return cmdKnown();
    if (mode == "dump" && argc >= 3) return cmdDump(argv[2]);
    if (mode == "readback" && argc >= 3) return cmdReadback(argv[2]);
    if (mode == "verify" && argc >= 4) return cmdVerify(argv[2], argv[3], argc >= 5 ? argv[4] : "");
    if (mode == "screen" && argc >= 3) return cmdScreen(argv[2]);
    if (mode == "corrupt") return cmdCorrupt();
    std::printf("未知模式：%s\n", mode.c_str());
    return 2;
}
