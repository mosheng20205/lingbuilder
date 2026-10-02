// ============================================================================
// lb_qrcode_win.cpp — 二维码模块 GDI 集成、句柄管理与公开中文命令
//
// 续接 lb_qrcode_core.cpp（同一编译单元）。公开命令的 ABI 与模块 bindings
// 一致：文本=const wchar_t*、整数=int、长整数/句柄=long long、逻辑=bool、
// 字节集=const std::vector<unsigned char>& / std::vector<unsigned char>、
// wideString 返回=std::wstring。
// ============================================================================

#include <cstdio>
#include <cwctype>

namespace lbqr {

// ---------------------------------------------------------------------------
// 句柄注册表（生成 / 识别各一套），代次计数防句柄复用串扰
// ---------------------------------------------------------------------------
struct QrCodeState {
    EncodeResult enc;
    std::wstring text;
    std::string utf8;
    int edge = 8;
    int quiet = 4;
    std::map<long long, HBITMAP> bitmaps; // (前景色<<32|背景色) → 位图，随句柄释放
};
struct QrRecState {
    DecodeOutput dec;
    std::wstring text;
    int finders = 0;
    Quad quad;
    bool hasQuad = false;
};

static SRWLOCK g_qrLock = SRWLOCK_INIT;
static std::map<long long, std::shared_ptr<QrCodeState>> g_qrCodes;
static std::map<long long, std::shared_ptr<QrRecState>> g_qrRecs;
static long long g_qrNextId = 0x7100000000000000LL;
static long long g_qrNextRecId = 0x7200000000000000LL;

static std::wstring g_qrGenError;
static std::wstring g_qrRecError;

static std::shared_ptr<QrCodeState> qrFindCode(long long handle) {
    AcquireSRWLockShared(&g_qrLock);
    auto it = g_qrCodes.find(handle);
    auto state = it != g_qrCodes.end() ? it->second : nullptr;
    ReleaseSRWLockShared(&g_qrLock);
    return state;
}
static std::shared_ptr<QrRecState> qrFindRec(long long handle) {
    AcquireSRWLockShared(&g_qrLock);
    auto it = g_qrRecs.find(handle);
    auto state = it != g_qrRecs.end() ? it->second : nullptr;
    ReleaseSRWLockShared(&g_qrLock);
    return state;
}

static bool parseLevelText(const wchar_t* text, int& level) {
    const std::wstring v = text ? text : L"";
    if (v.empty()) return false;
    const wint_t c = towupper(v[0]);
    if (c == L'L') { level = 0; return true; }
    if (c == L'M') { level = 1; return true; }
    if (c == L'Q') { level = 2; return true; }
    if (c == L'H') { level = 3; return true; }
    return false;
}

static void splitArgb(long long argb, unsigned char& r, unsigned char& g, unsigned char& b) {
    const unsigned long long v = static_cast<unsigned long long>(argb) & 0xFFFFFFFFULL;
    r = static_cast<unsigned char>((v >> 16) & 0xFF);
    g = static_cast<unsigned char>((v >> 8) & 0xFF);
    b = static_cast<unsigned char>(v & 0xFF);
}

static bool writeFileBytes(const wchar_t* path, const std::vector<unsigned char>& bytes, std::wstring& err) {
    FILE* f = nullptr;
    if (_wfopen_s(&f, path, L"wb") != 0 || !f) {
        err = L"无法写入文件（路径或权限问题）：" + std::wstring(path ? path : L"");
        return false;
    }
    const bool ok = bytes.empty() || std::fwrite(bytes.data(), 1, bytes.size(), f) == bytes.size();
    std::fclose(f);
    if (!ok) { err = L"写入文件失败：" + std::wstring(path ? path : L""); return false; }
    return true;
}

static bool readFileBytes(const wchar_t* path, std::vector<unsigned char>& bytes, std::wstring& err) {
    FILE* f = nullptr;
    if (_wfopen_s(&f, path, L"rb") != 0 || !f) {
        err = L"无法读取文件（不存在、被占用或路径无权限）：" + std::wstring(path ? path : L"");
        return false;
    }
    _fseeki64(f, 0, SEEK_END);
    const long long size = _ftelli64(f);
    _fseeki64(f, 0, SEEK_SET);
    if (size <= 0 || size > 256LL * 1024 * 1024) {
        std::fclose(f);
        err = L"图像文件为空或超过 256MB 上限。";
        return false;
    }
    bytes.resize(static_cast<size_t>(size));
    const bool ok = std::fread(bytes.data(), 1, bytes.size(), f) == bytes.size();
    std::fclose(f);
    if (!ok) { err = L"读取图像文件失败：" + std::wstring(path ? path : L""); return false; }
    return true;
}

// DIB 内存布局为 BGRA
static GrayImage grayFromBgra(int w, int h, const unsigned char* bgra) {
    GrayImage img;
    img.w = w;
    img.h = h;
    img.px.resize(static_cast<size_t>(w) * h);
    for (size_t i = 0; i < img.px.size(); ++i) {
        const unsigned char bb = bgra[i * 4], gg = bgra[i * 4 + 1], rr = bgra[i * 4 + 2];
        img.px[i] = static_cast<unsigned char>((rr * 299 + gg * 587 + bb * 114) / 1000);
    }
    return img;
}

static long long recognizeGray(const GrayImage& img, std::wstring& err) {
    QrRecState state;
    DecodeOutput dec;
    int finders = 0;
    Quad quad;
    if (!decodeGrayImage(img, dec, finders, quad, err)) return 0;
    state.dec = std::move(dec);
    state.text = LB_Utf8ToWide(state.dec.utf8);
    state.finders = finders;
    state.quad = quad;
    state.hasQuad = true;
    AcquireSRWLockExclusive(&g_qrLock);
    const long long id = ++g_qrNextRecId;
    g_qrRecs[id] = std::make_shared<QrRecState>(std::move(state));
    ReleaseSRWLockExclusive(&g_qrLock);
    return id;
}

// ---------------------------------------------------------------------------
// 公开命令 · 生成侧
// ---------------------------------------------------------------------------
std::wstring 二维码_取版本() {
    return LB_ReturnText(L"lingbuilder.qrcode 1.0.0（ISO/IEC 18004，纯本地实现，内置 PNG/JPEG 编解码与图像定位）");
}

long long 二维码_生成(const wchar_t* 内容, const wchar_t* 纠错级别, int 边长像素, int 空白边模块数) {
    g_qrGenError.clear();
    int level = 1;
    if (!parseLevelText(纠错级别, level)) {
        g_qrGenError = L"纠错级别无效：只允许 L、M、Q、H。";
        return 0;
    }
    if (边长像素 <= 0) {
        g_qrGenError = L"边长像素必须大于 0（默认 8）。";
        return 0;
    }
    if (边长像素 > 64) {
        g_qrGenError = L"边长像素过大：上限 64（默认 8）。";
        return 0;
    }
    if (空白边模块数 < 0 || 空白边模块数 > 32) {
        g_qrGenError = L"空白边模块数越界：允许 0～32（默认 4）。";
        return 0;
    }
    const std::string utf8 = LB_WideToUtf8(内容 ? 内容 : L"");
    EncodeResult enc;
    std::wstring err;
    if (!encodeQrInternal(utf8, EncodeOptions{ level, 0, 0 }, enc, err)) {
        g_qrGenError = err;
        return 0;
    }
    const int pixelEdge = (enc.size + 空白边模块数 * 2) * 边长像素;
    if (pixelEdge > 4096) {
        g_qrGenError = L"输出边长 " + std::to_wstring(pixelEdge) + L" 像素超过 4096 上限，请减小边长像素或空白边模块数。";
        return 0;
    }
    QrCodeState state;
    state.enc = std::move(enc);
    state.utf8 = utf8;
    state.text = 内容 ? 内容 : L"";
    state.edge = 边长像素;
    state.quiet = 空白边模块数;
    AcquireSRWLockExclusive(&g_qrLock);
    const long long id = ++g_qrNextId;
    g_qrCodes[id] = std::make_shared<QrCodeState>(std::move(state));
    ReleaseSRWLockExclusive(&g_qrLock);
    return id;
}

std::wstring 二维码_取错误() {
    return LB_ReturnText(g_qrGenError);
}

int 二维码_取模块数(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.size : 0;
}

int 二维码_取版本号(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.version : 0;
}

int 二维码_取掩码(long long 码) {
    const auto s = qrFindCode(码);
    return s ? s->enc.mask : -1;
}

std::wstring 二维码_取纠错级别(long long 码) {
    const auto s = qrFindCode(码);
    if (!s) return LB_ReturnText(L"");
    return LB_ReturnText(LEVEL_WNAMES[s->enc.level]);
}

bool 二维码_取深色(long long 码, int 行, int 列) {
    const auto s = qrFindCode(码);
    if (!s || 行 < 0 || 列 < 0 || 行 >= s->enc.size || 列 >= s->enc.size) return false;
    return s->enc.matrix[static_cast<size_t>(行) * s->enc.size + 列] != 0;
}

bool 二维码_保存PNG(long long 码, const wchar_t* 路径, long long 前景色, long long 背景色) {
    g_qrGenError.clear();
    const auto s = qrFindCode(码);
    if (!s) {
        g_qrGenError = L"二维码句柄无效（可能已释放）。";
        return false;
    }
    unsigned char fr, fg, fb, br, bg, bb;
    splitArgb(前景色, fr, fg, fb);
    splitArgb(背景色, br, bg, bb);
    std::vector<unsigned char> pixels;
    bool gray = false;
    rasterizeMatrix(s->enc.matrix, s->enc.size, s->edge, s->quiet, fr, fg, fb, br, bg, bb, pixels, gray);
    const int size = (s->enc.size + s->quiet * 2) * s->edge;
    std::vector<unsigned char> png;
    std::wstring err;
    if (!encodePngToBytes(size, size, pixels, gray, png, err)) {
        g_qrGenError = err;
        return false;
    }
    if (!writeFileBytes(路径, png, err)) {
        g_qrGenError = err;
        return false;
    }
    return true;
}

long long 二维码_取位图(long long 码, long long 前景色, long long 背景色) {
    g_qrGenError.clear();
    const auto s = qrFindCode(码);
    if (!s) {
        g_qrGenError = L"二维码句柄无效（可能已释放）。";
        return 0;
    }
    const long long key = ((前景色 & 0xFFFFFFFFLL) << 32) | (背景色 & 0xFFFFFFFFLL);
    AcquireSRWLockShared(&g_qrLock);
    auto it = s->bitmaps.find(key);
    if (it != s->bitmaps.end()) {
        const HBITMAP cached = it->second;
        ReleaseSRWLockShared(&g_qrLock);
        return reinterpret_cast<long long>(cached);
    }
    ReleaseSRWLockShared(&g_qrLock);
    unsigned char fr, fg, fb, br, bg, bb;
    splitArgb(前景色, fr, fg, fb);
    splitArgb(背景色, br, bg, bb);
    const int size = (s->enc.size + s->quiet * 2) * s->edge;
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = size;
    info.bmiHeader.biHeight = -size;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    void* bitsPtr = nullptr;
    HDC screen = GetDC(nullptr);
    HBITMAP bmp = CreateDIBSection(screen, &info, DIB_RGB_COLORS, &bitsPtr, nullptr, 0);
    ReleaseDC(nullptr, screen);
    if (!bmp || !bitsPtr) {
        if (bmp) DeleteObject(bmp);
        g_qrGenError = L"创建位图失败。";
        return 0;
    }
    auto* dst = static_cast<unsigned char*>(bitsPtr);
    const bool gray = fr == fg && fg == fb && br == bg && bg == bb;
    for (int y = 0; y < size; ++y) {
        const int mr = y / s->edge - s->quiet;
        for (int x = 0; x < size; ++x) {
            const int mc = x / s->edge - s->quiet;
            const bool isDark = mr >= 0 && mc >= 0 && mr < s->enc.size && mc < s->enc.size
                && s->enc.matrix[static_cast<size_t>(mr) * s->enc.size + mc];
            const size_t o = (static_cast<size_t>(y) * size + x) * 4;
            if (gray) {
                const unsigned char v = isDark ? fr : br;
                dst[o] = v;
                dst[o + 1] = v;
                dst[o + 2] = v;
            } else {
                dst[o] = isDark ? fb : bb;
                dst[o + 1] = isDark ? fg : bg;
                dst[o + 2] = isDark ? fr : br;
            }
            dst[o + 3] = 255;
        }
    }
    AcquireSRWLockExclusive(&g_qrLock);
    s->bitmaps[key] = bmp;
    ReleaseSRWLockExclusive(&g_qrLock);
    return reinterpret_cast<long long>(bmp);
}

bool 二维码_释放(long long 码) {
    AcquireSRWLockExclusive(&g_qrLock);
    auto it = g_qrCodes.find(码);
    if (it == g_qrCodes.end()) {
        ReleaseSRWLockExclusive(&g_qrLock);
        return false;
    }
    for (auto& pair : it->second->bitmaps) DeleteObject(pair.second);
    g_qrCodes.erase(it);
    ReleaseSRWLockExclusive(&g_qrLock);
    return true;
}

void 二维码_释放全部() {
    AcquireSRWLockExclusive(&g_qrLock);
    for (auto& pair : g_qrCodes)
        for (auto& bmp : pair.second->bitmaps) DeleteObject(bmp.second);
    g_qrCodes.clear();
    ReleaseSRWLockExclusive(&g_qrLock);
}

// ---------------------------------------------------------------------------
// 公开命令 · 识别侧
// ---------------------------------------------------------------------------
long long 二维码_识别PNG(const wchar_t* 路径) {
    g_qrRecError.clear();
    std::vector<unsigned char> bytes;
    std::wstring err;
    if (!readFileBytes(路径, bytes, err)) {
        g_qrRecError = err;
        return 0;
    }
    GrayImage img;
    if (!decodeImageBytesToGray(bytes, img, err)) {
        g_qrRecError = err;
        return 0;
    }
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别位图(long long 位图句柄) {
    g_qrRecError.clear();
    const HBITMAP bmp = reinterpret_cast<HBITMAP>(位图句柄);
    BITMAP bm = {};
    if (!bmp || !GetObjectW(bmp, sizeof(bm), &bm) || bm.bmWidth <= 0 || bm.bmHeight <= 0) {
        g_qrRecError = L"位图句柄无效。";
        return 0;
    }
    const int w = bm.bmWidth, h = std::abs(bm.bmHeight);
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = w;
    info.bmiHeader.biHeight = -h;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(static_cast<size_t>(w) * h * 4);
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    const int got = GetDIBits(mem, bmp, 0, h, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (got == 0) {
        g_qrRecError = L"读取位图像素失败。";
        return 0;
    }
    const GrayImage img = grayFromBgra(w, h, buffer.data());
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别字节集(const std::vector<unsigned char>& 数据, int 宽度, int 高度, int 通道数) {
    g_qrRecError.clear();
    if (宽度 <= 0 || 高度 <= 0) {
        g_qrRecError = L"宽度与高度必须大于 0。";
        return 0;
    }
    if (通道数 != 1 && 通道数 != 3 && 通道数 != 4) {
        g_qrRecError = L"通道数只支持 1（灰度）、3（BGR）、4（BGRX）。";
        return 0;
    }
    if (数据.size() != static_cast<size_t>(宽度) * 高度 * 通道数) {
        g_qrRecError = L"字节集长度 " + std::to_wstring(数据.size()) + L" 与 宽度×高度×通道数 "
            + std::to_wstring(static_cast<long long>(宽度) * 高度 * 通道数) + L" 不一致。";
        return 0;
    }
    GrayImage img;
    img.w = 宽度;
    img.h = 高度;
    img.px.resize(static_cast<size_t>(宽度) * 高度);
    for (size_t i = 0; i < img.px.size(); ++i) {
        if (通道数 == 1) img.px[i] = 数据[i];
        else {
            const unsigned char bb = 数据[i * 通道数], gg = 数据[i * 通道数 + 1], rr = 数据[i * 通道数 + 2];
            img.px[i] = static_cast<unsigned char>((rr * 299 + gg * 587 + bb * 114) / 1000);
        }
    }
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

long long 二维码_识别屏幕(int 横, int 纵, int 宽, int 高) {
    g_qrRecError.clear();
    if (宽 <= 0 || 高 <= 0) {
        g_qrRecError = L"截图区域的宽高必须大于 0。";
        return 0;
    }
    const int screenW = GetSystemMetrics(SM_CXSCREEN);
    const int screenH = GetSystemMetrics(SM_CYSCREEN);
    if (横 < 0 || 纵 < 0 || 横 + 宽 > screenW || 纵 + 高 > screenH) {
        g_qrRecError = L"截图区域越界：屏幕为 " + std::to_wstring(screenW) + L"×" + std::to_wstring(screenH)
            + L"，请求区域 (" + std::to_wstring(横) + L"," + std::to_wstring(纵) + L") "
            + std::to_wstring(宽) + L"×" + std::to_wstring(高) + L"。";
        return 0;
    }
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    HBITMAP bmp = CreateCompatibleBitmap(screen, 宽, 高);
    const HGDIOBJ old = SelectObject(mem, bmp);
    BitBlt(mem, 0, 0, 宽, 高, screen, 横, 纵, SRCCOPY | CAPTUREBLT);
    SelectObject(mem, old);
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = 宽;
    info.bmiHeader.biHeight = -高;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(static_cast<size_t>(宽) * 高 * 4);
    const int got = GetDIBits(mem, bmp, 0, 高, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteObject(bmp);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (got == 0) {
        g_qrRecError = L"屏幕抓取失败。";
        return 0;
    }
    const GrayImage img = grayFromBgra(宽, 高, buffer.data());
    std::wstring err;
    const long long id = recognizeGray(img, err);
    if (!id) g_qrRecError = err;
    return id;
}

std::wstring 二维码_识别取文本(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? LB_ReturnText(s->text) : LB_ReturnText(L"");
}

std::vector<unsigned char> 二维码_识别取字节(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.raw : std::vector<unsigned char>();
}

int 二维码_识别取版本(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.version : 0;
}

int 二维码_识别取掩码(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.mask : -1;
}

std::wstring 二维码_识别取纠错级别(long long 结果) {
    const auto s = qrFindRec(结果);
    if (!s || s->dec.level < 0 || s->dec.level > 3) return LB_ReturnText(L"");
    return LB_ReturnText(LEVEL_WNAMES[s->dec.level]);
}

std::wstring 二维码_识别取模式(long long 结果) {
    const auto s = qrFindRec(结果);
    if (!s) return LB_ReturnText(L"");
    switch (s->dec.mode) {
        case MODE_NUMERIC: return LB_ReturnText(L"数字");
        case MODE_ALNUM: return LB_ReturnText(L"字母数字");
        case MODE_BYTE: return LB_ReturnText(L"字节");
        case MODE_KANJI: return LB_ReturnText(L"汉字");
        default: return LB_ReturnText(L"其它");
    }
}

int 二维码_识别取修复码字数(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->dec.corrected : -1;
}

int 二维码_识别取定位点数(long long 结果) {
    const auto s = qrFindRec(结果);
    return s ? s->finders : -1;
}

int 二维码_识别取角点横坐标(long long 结果, int 索引, int 角点) {
    const auto s = qrFindRec(结果);
    if (!s || 索引 != 0 || 角点 < 0 || 角点 > 3 || !s->hasQuad) return -1;
    return s->quad.x[角点];
}

int 二维码_识别取角点纵坐标(long long 结果, int 索引, int 角点) {
    const auto s = qrFindRec(结果);
    if (!s || 索引 != 0 || 角点 < 0 || 角点 > 3 || !s->hasQuad) return -1;
    return s->quad.y[角点];
}

std::vector<unsigned char> 二维码_识别取外接四边形(long long 结果, int 索引) {
    const auto s = qrFindRec(结果);
    std::vector<unsigned char> out;
    if (!s || 索引 != 0 || !s->hasQuad) return out;
    out.resize(32);
    for (int i = 0; i < 4; ++i) {
        const int xi = s->quad.x[i], yi = s->quad.y[i];
        out[i * 8 + 0] = static_cast<unsigned char>(xi & 0xFF);
        out[i * 8 + 1] = static_cast<unsigned char>((xi >> 8) & 0xFF);
        out[i * 8 + 2] = static_cast<unsigned char>((xi >> 16) & 0xFF);
        out[i * 8 + 3] = static_cast<unsigned char>((xi >> 24) & 0xFF);
        out[i * 8 + 4] = static_cast<unsigned char>(yi & 0xFF);
        out[i * 8 + 5] = static_cast<unsigned char>((yi >> 8) & 0xFF);
        out[i * 8 + 6] = static_cast<unsigned char>((yi >> 16) & 0xFF);
        out[i * 8 + 7] = static_cast<unsigned char>((yi >> 24) & 0xFF);
    }
    return out;
}

std::wstring 二维码_识别取错误() {
    return LB_ReturnText(g_qrRecError);
}

bool 二维码_识别释放(long long 结果) {
    AcquireSRWLockExclusive(&g_qrLock);
    const bool ok = g_qrRecs.erase(结果) != 0;
    ReleaseSRWLockExclusive(&g_qrLock);
    return ok;
}

void 二维码_识别释放全部() {
    AcquireSRWLockExclusive(&g_qrLock);
    g_qrRecs.clear();
    ReleaseSRWLockExclusive(&g_qrLock);
}

// ---------------------------------------------------------------------------
// 自检：已知答案 + 全表 RS 伴随式 + 生成→渲染→识别 闭环 + 带损伤纠错
// ---------------------------------------------------------------------------
static bool qrSelfCheckInternal(std::wstring& report) {
    // 1) format 已知答案：M+掩码0 = 0x5412；M+掩码3 = 0x5B4B
    if (formatBitsValue(1, 0) != 0x5412) { report = L"format 已知答案失败：M+掩码0 应为 0x5412。"; return false; }
    if (formatBitsValue(1, 3) != 0x5B4B) { report = L"format 已知答案失败：M+掩码3 应为 0x5B4B。"; return false; }
    // 2) 版本选择已知答案："HELLO WORLD" → v1-M、21 模块
    {
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal("HELLO WORLD", EncodeOptions{ 1, 0, 0 }, enc, err)
            || enc.version != 1 || enc.size != 21) {
            report = L"已知答案失败：\"HELLO WORLD\" 应为版本 1、21 模块。";
            return false;
        }
    }
    // 3) M 级 v1-20 数据码字数与参考实现逐项核对
    static const int M_DATA_V1_20[20] = { 16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669 };
    for (int v = 1; v <= 20; ++v) {
        if (dataCodewords(v, 1) != M_DATA_V1_20[v - 1]) {
            report = L"分块表核对失败：版本 " + std::to_wstring(v) + L" 的 M 级数据码字数与标准不符。";
            return false;
        }
    }
    // 4) 全表 160 组合：字节模式满容量编码 → 每块 RS 伴随式必须全零
    for (int v = 1; v <= 40; ++v) for (int level = 0; level < 4; ++level) {
        const int dataCw = dataCodewords(v, level);
        if (dataCw <= 0) {
            report = L"分块表异常：版本 " + std::to_wstring(v) + L" 级别 " + std::to_wstring(level) + L"。";
            return false;
        }
        std::string payload;
        payload.resize(static_cast<size_t>(v <= 9 ? (dataCw * 8 - 16) / 8 : (dataCw * 8 - 24) / 8));
        for (size_t i = 0; i < payload.size(); ++i) payload[i] = static_cast<char>(0x21 + (i * 31 + 7) % 90);
        const std::vector<uint8_t> cw = interleave(payload, MODE_BYTE, v, level);
        if (static_cast<int>(cw.size()) != totalCodewords(v)) {
            report = L"码字总数异常：版本 " + std::to_wstring(v) + L"。";
            return false;
        }
        const int ecc = ECC_PER_BLOCK[level][v];
        const int blocks = NUM_BLOCKS[level][v];
        const int shortLen = dataCw / blocks;
        const int longCount = dataCw - shortLen * blocks;
        // 先反交织还原各块，再做伴随式校验
        std::vector<std::vector<uint8_t>> blockFull(blocks);
        {
            std::vector<std::vector<uint8_t>> dataOf(blocks);
            size_t pos = 0;
            for (int i = 0; i < shortLen + 1; ++i)
                for (int b = 0; b < blocks; ++b)
                    if (i < shortLen + (b < blocks - longCount ? 0 : 1)) dataOf[b].push_back(cw[pos++]);
            for (int i = 0; i < ecc; ++i)
                for (int b = 0; b < blocks; ++b) blockFull[b].push_back(cw[pos++]);
            for (int b = 0; b < blocks; ++b)
                blockFull[b].insert(blockFull[b].begin(), dataOf[b].begin(), dataOf[b].end());
        }
        for (int b = 0; b < blocks; ++b) {
            if (!rsSyndromeZero(blockFull[b], ecc)) {
                report = L"RS 伴随式校验失败：版本 " + std::to_wstring(v) + L" 级别 " + std::to_wstring(level) + L" 块 " + std::to_wstring(b + 1) + L"。";
                return false;
            }
        }
    }
    // 5) 闭环：生成 → 栅格化 → 识别，文本逐字节一致、版本/掩码/级别一致
    static const int LOOP_V[10] = { 1, 4, 7, 10, 15, 20, 25, 30, 35, 40 };
    for (int vi = 0; vi < 10; ++vi) for (int level = 0; level < 4; ++level) {
        const int v = LOOP_V[vi];
        const int target = (std::max)(1, dataCodewords(v, level) * 2 / 3);
        std::string payload;
        payload.reserve(static_cast<size_t>(target));
        static const char CHUNK[] = "QR\xE4\xBA\x8C\xE7\xBB\xB4\xE7\xA0\x81#9";
        while (static_cast<int>(payload.size()) < target) payload += CHUNK;
        payload.resize(static_cast<size_t>(target));
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal(payload, EncodeOptions{ level, v, MODE_BYTE }, enc, err)) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 编码失败：" + err;
            return false;
        }
        std::vector<unsigned char> pixels;
        bool gray = false;
        rasterizeMatrix(enc.matrix, enc.size, 3, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (enc.size + 8) * 3;
        GrayImage img;
        img.w = size;
        img.h = size;
        img.px = pixels;
        DecodeOutput dec;
        int finders = 0;
        Quad quad;
        if (!decodeGrayImage(img, dec, finders, quad, err)) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 识别失败：" + err;
            return false;
        }
        if (dec.utf8 != payload || dec.version != enc.version || dec.mask != enc.mask || dec.level != level) {
            report = L"闭环失败：v" + std::to_wstring(v) + L"-" + LEVEL_WNAMES[level] + L" 回读不一致。";
            return false;
        }
    }
    // 6) 带损伤纠错：对 v5-M 扰动 6 个非功能图形模块（RS 可纠），必须原样解出
    {
        EncodeResult enc;
        std::wstring err;
        if (!encodeQrInternal("QR-ERROR-CORRECTION-CHECK-2026", EncodeOptions{ 1, 5, MODE_BYTE }, enc, err)) {
            report = L"损伤测试失败：编码阶段出错。";
            return false;
        }
        int flipped = 0;
        for (int r = 9; r < enc.size - 9 && flipped < 6; ++r)
            for (int c = 9; c < enc.size - 9 && flipped < 6; ++c)
                if (enc.matrix[static_cast<size_t>(r) * enc.size + c]) {
                    enc.matrix[static_cast<size_t>(r) * enc.size + c] = 0;
                    ++flipped;
                    c += 5;
                }
        std::vector<unsigned char> pixels;
        bool gray = false;
        rasterizeMatrix(enc.matrix, enc.size, 4, 4, 0, 0, 0, 255, 255, 255, pixels, gray);
        const int size = (enc.size + 8) * 4;
        GrayImage img;
        img.w = size;
        img.h = size;
        img.px = pixels;
        DecodeOutput dec;
        int finders = 0;
        Quad quad;
        if (!decodeGrayImage(img, dec, finders, quad, err) || dec.utf8 != "QR-ERROR-CORRECTION-CHECK-2026") {
            report = L"损伤测试失败：扰动后未能原样解出。";
            return false;
        }
    }
    report.clear();
    return true;
}

} // namespace lbqr

// ---------------------------------------------------------------------------
// 公开命令（全局命名空间，符号名与 bindings.runtimeName 一致）
// ---------------------------------------------------------------------------
std::wstring 二维码_取版本() { return lbqr::二维码_取版本(); }
long long 二维码_生成(const wchar_t* 内容, const wchar_t* 纠错级别, int 边长像素, int 空白边模块数) { return lbqr::二维码_生成(内容, 纠错级别, 边长像素, 空白边模块数); }
std::wstring 二维码_取错误() { return lbqr::二维码_取错误(); }
int 二维码_取模块数(long long 码) { return lbqr::二维码_取模块数(码); }
int 二维码_取版本号(long long 码) { return lbqr::二维码_取版本号(码); }
int 二维码_取掩码(long long 码) { return lbqr::二维码_取掩码(码); }
std::wstring 二维码_取纠错级别(long long 码) { return lbqr::二维码_取纠错级别(码); }
bool 二维码_取深色(long long 码, int 行, int 列) { return lbqr::二维码_取深色(码, 行, 列); }
bool 二维码_保存PNG(long long 码, const wchar_t* 路径, long long 前景色, long long 背景色) { return lbqr::二维码_保存PNG(码, 路径, 前景色, 背景色); }
long long 二维码_取位图(long long 码, long long 前景色, long long 背景色) { return lbqr::二维码_取位图(码, 前景色, 背景色); }
bool 二维码_释放(long long 码) { return lbqr::二维码_释放(码); }
void 二维码_释放全部() { lbqr::二维码_释放全部(); }
long long 二维码_识别PNG(const wchar_t* 路径) { return lbqr::二维码_识别PNG(路径); }
long long 二维码_识别位图(long long 位图句柄) { return lbqr::二维码_识别位图(位图句柄); }
long long 二维码_识别字节集(const std::vector<unsigned char>& 数据, int 宽度, int 高度, int 通道数) { return lbqr::二维码_识别字节集(数据, 宽度, 高度, 通道数); }
long long 二维码_识别屏幕(int 横, int 纵, int 宽, int 高) { return lbqr::二维码_识别屏幕(横, 纵, 宽, 高); }
std::wstring 二维码_识别取文本(long long 结果) { return lbqr::二维码_识别取文本(结果); }
std::vector<unsigned char> 二维码_识别取字节(long long 结果) { return lbqr::二维码_识别取字节(结果); }
int 二维码_识别取版本(long long 结果) { return lbqr::二维码_识别取版本(结果); }
int 二维码_识别取掩码(long long 结果) { return lbqr::二维码_识别取掩码(结果); }
std::wstring 二维码_识别取纠错级别(long long 结果) { return lbqr::二维码_识别取纠错级别(结果); }
std::wstring 二维码_识别取模式(long long 结果) { return lbqr::二维码_识别取模式(结果); }
int 二维码_识别取修复码字数(long long 结果) { return lbqr::二维码_识别取修复码字数(结果); }
int 二维码_识别取定位点数(long long 结果) { return lbqr::二维码_识别取定位点数(结果); }
int 二维码_识别取角点横坐标(long long 结果, int 索引, int 角点) { return lbqr::二维码_识别取角点横坐标(结果, 索引, 角点); }
int 二维码_识别取角点纵坐标(long long 结果, int 索引, int 角点) { return lbqr::二维码_识别取角点纵坐标(结果, 索引, 角点); }
std::vector<unsigned char> 二维码_识别取外接四边形(long long 结果, int 索引) { return lbqr::二维码_识别取外接四边形(结果, 索引); }
std::wstring 二维码_识别取错误() { return lbqr::二维码_识别取错误(); }
bool 二维码_识别释放(long long 结果) { return lbqr::二维码_识别释放(结果); }
void 二维码_识别释放全部() { lbqr::二维码_识别释放全部(); }
bool 二维码_自检() {
    lbqr::g_qrGenError.clear();
    std::wstring report;
    if (!lbqr::qrSelfCheckInternal(report)) {
        lbqr::g_qrGenError = report.empty() ? std::wstring(L"自检失败。") : report;
        return false;
    }
    return true;
}
