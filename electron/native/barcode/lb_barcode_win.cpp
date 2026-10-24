// lb_barcode_win.cpp — LingBuilder 一维条码模块 Windows 平台层（2026-10-24）。
// 职责：条码/识别结果句柄登记、HBITMAP 渲染（黑白模块）、BMP 保存、像素/位图/屏幕识别入口。
// 与 lb_barcode_core.cpp 拼接后由 generate-barcode-runtime.ts 注入生成器（String.raw 安全）。
// 红线：不得出现反引号与美元符号花括号序列。

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace lbbarwin {

using lbbar::BarcodeMatrix;
using lbbar::DecodeResult;

thread_local std::wstring g_barError;   // 生成侧
thread_local std::wstring g_recError;   // 识别侧

static std::string WideToUtf8Local(const std::wstring& text) {
    if (text.empty()) return {};
    int bytes = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0, nullptr, nullptr);
    std::string out(size_t(bytes > 0 ? bytes : 0), '\0');
    if (bytes > 0) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), int(text.size()), &out[0], bytes, nullptr, nullptr);
    return out;
}

static std::wstring Utf8ToWideLocal(const std::string& text) {
    if (text.empty()) return {};
    int chars = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), int(text.size()), nullptr, 0);
    std::wstring out(size_t(chars > 0 ? chars : 0), L'\0');
    if (chars > 0) MultiByteToWideChar(CP_UTF8, 0, text.c_str(), int(text.size()), &out[0], chars);
    return out;
}

// ---------------- 句柄登记 ----------------
struct BarcodeEntry {
    int kind = 0;             // 0=EAN13 1=EAN8 2=UPCA 3=Code128 4=Code39
    std::string fullText;     // 含校验位的完整数字 / 原文
    BarcodeMatrix matrix;
};
struct ResultEntry {
    DecodeResult result;
};

std::map<long long, std::unique_ptr<BarcodeEntry>> g_barcodes;
std::map<long long, std::unique_ptr<ResultEntry>> g_results;
long long g_nextBarcode = 1;
long long g_nextResult = 1;

static BarcodeEntry* BarcodeOf(long long handle) {
    const auto found = g_barcodes.find(handle);
    if (found == g_barcodes.end() || !found->second) { g_barError = L"条码句柄无效或已释放。"; return nullptr; }
    return found->second.get();
}

static ResultEntry* ResultOf(long long handle) {
    const auto found = g_results.find(handle);
    if (found == g_results.end() || !found->second) { g_recError = L"识别结果句柄无效或已释放。"; return nullptr; }
    return found->second.get();
}

// ---------------- 生成 ----------------
static long long CreateBarcode(int kind, const wchar_t* text) {
    g_barError.clear();
    lbbar::ClearError();
    const std::string utf8 = WideToUtf8Local(text ? text : L"");
    std::string input = utf8;
    // EAN/UPC：输入 12/7/11 位时自动补校验位；输入 13/8/12 位时校验后原样接受
    if (kind == 0 || kind == 1 || kind == 2) {
        const size_t bodyLen = kind == 0 ? 12 : (kind == 1 ? 7 : 11);
        if (utf8.size() == bodyLen) {
            std::vector<int> digits;
            for (char c : utf8) digits.push_back(c - '0');
            input = utf8 + char('0' + lbbar::EanCheckDigit(digits));
        }
    }
    auto entry = std::make_unique<BarcodeEntry>();
    if (!lbbar::Generate(kind, input, entry->matrix)) {
        g_barError = Utf8ToWideLocal(lbbar::g_error);
        return 0;
    }
    entry->kind = kind;
    entry->fullText = input;
    const long long handle = g_nextBarcode++;
    g_barcodes[handle] = std::move(entry);
    return handle;
}

// ---------------- 渲染与保存 ----------------
static HBITMAP RenderBitmap(const BarcodeEntry& entry, int pixelsPerModule) {
    if (pixelsPerModule < 1) pixelsPerModule = 2;
    if (pixelsPerModule > 20) pixelsPerModule = 20;
    const int width = entry.matrix.modules * pixelsPerModule;
    const int height = width / 3 > 24 ? width / 3 : 24; // 条高：宽度的 1/3，至少 24px
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = width;
    info.bmiHeader.biHeight = -height;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    void* bits = nullptr;
    HDC screen = GetDC(nullptr);
    HBITMAP bitmap = CreateDIBSection(screen, &info, DIB_RGB_COLORS, &bits, nullptr, 0);
    ReleaseDC(nullptr, screen);
    if (!bitmap || !bits) { g_barError = L"创建位图失败。"; return nullptr; }
    unsigned char* pixels = static_cast<unsigned char*>(bits);
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            const int module = x / pixelsPerModule;
            const unsigned char value = entry.matrix.data[size_t(module)] ? 0 : 255;
            unsigned char* px = pixels + (size_t(y) * width + x) * 4;
            px[0] = value; px[1] = value; px[2] = value; px[3] = 255;
        }
    }
    return bitmap;
}

static bool SaveBmpFile(const std::wstring& path, const BarcodeEntry& entry, int pixelsPerModule) {
    if (pixelsPerModule < 1) pixelsPerModule = 2;
    if (pixelsPerModule > 20) pixelsPerModule = 20;
    const int width = entry.matrix.modules * pixelsPerModule;
    const int height = width / 3 > 24 ? width / 3 : 24;
    const int rowBytes = ((width * 3 + 3) / 4) * 4; // 24bpp 按 4 字节对齐
    BITMAPFILEHEADER fileHeader = {};
    fileHeader.bfType = 0x4D42;
    fileHeader.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
    fileHeader.bfSize = fileHeader.bfOffBits + DWORD(rowBytes * height);
    BITMAPINFOHEADER infoHeader = {};
    infoHeader.biSize = sizeof(BITMAPINFOHEADER);
    infoHeader.biWidth = width;
    infoHeader.biHeight = height;
    infoHeader.biPlanes = 1;
    infoHeader.biBitCount = 24;
    infoHeader.biCompression = BI_RGB;
    infoHeader.biSizeImage = DWORD(rowBytes * height);
    HANDLE file = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) { g_barError = L"无法写出 BMP 文件：" + path; return false; }
    std::vector<unsigned char> buffer(size_t(rowBytes) * height, 255);
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            const int module = x / pixelsPerModule;
            const unsigned char value = entry.matrix.data[size_t(module)] ? 0 : 255;
            // 自底向上行序（BMP 正高度）
            unsigned char* px = &buffer[size_t(height - 1 - y) * rowBytes + size_t(x) * 3];
            px[0] = value; px[1] = value; px[2] = value;
        }
    }
    DWORD written = 0;
    BOOL ok = WriteFile(file, &fileHeader, sizeof(fileHeader), &written, nullptr)
        && WriteFile(file, &infoHeader, sizeof(infoHeader), &written, nullptr)
        && WriteFile(file, buffer.data(), DWORD(buffer.size()), &written, nullptr);
    CloseHandle(file);
    if (!ok) { g_barError = L"写出 BMP 文件失败。"; return false; }
    return true;
}

// ---------------- 识别 ----------------
static long long RecognizeGray(const std::vector<unsigned char>& gray, int width, int height) {
    g_recError.clear();
    lbbar::ClearError();
    auto entry = std::make_unique<ResultEntry>();
    if (!lbbar::Decode(gray.data(), width, height, entry->result)) {
        g_recError = Utf8ToWideLocal(lbbar::g_error);
        return 0;
    }
    const long long handle = g_nextResult++;
    g_results[handle] = std::move(entry);
    return handle;
}

static bool ReadFileBytesW(const std::wstring& path, std::vector<unsigned char>& out) {
    HANDLE file = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) { g_recError = L"无法打开文件：" + path; return false; }
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(file, &size) || size.QuadPart < 0 || size.QuadPart > 256 * 1024 * 1024) { CloseHandle(file); g_recError = L"文件大小非法。"; return false; }
    out.resize(size_t(size.QuadPart));
    DWORD read = 0;
    if (!out.empty() && !ReadFile(file, out.data(), DWORD(out.size()), &read, nullptr)) { CloseHandle(file); g_recError = L"读取文件失败。"; return false; }
    out.resize(read);
    CloseHandle(file);
    return true;
}

// BMP 文件 → 灰度
static bool DecodeBmpToGray(const std::vector<unsigned char>& bytes, std::vector<unsigned char>& gray, int& width, int& height) {
    if (bytes.size() < 54 || bytes[0] != 'B' || bytes[1] != 'M') { g_recError = L"不是有效的 BMP 文件。"; return false; }
    BITMAPINFOHEADER info = {};
    memcpy(&info, bytes.data() + 14, sizeof(info));
    if (info.biCompression != BI_RGB || (info.biBitCount != 24 && info.biBitCount != 32)) {
        g_recError = L"仅支持未压缩的 24/32 位 BMP。";
        return false;
    }
    width = info.biWidth;
    height = info.biHeight < 0 ? -info.biHeight : info.biHeight;
    const bool bottomUp = info.biHeight > 0;
    const int channels = info.biBitCount / 8;
    if (width <= 0 || height <= 0 || width > 20000 || height > 20000) { g_recError = L"BMP 尺寸非法。"; return false; }
    const size_t offset = *reinterpret_cast<const uint32_t*>(bytes.data() + 10);
    const int rowBytes = ((width * channels + 3) / 4) * 4;
    if (offset + size_t(rowBytes) * height > bytes.size()) { g_recError = L"BMP 数据不完整。"; return false; }
    gray.assign(size_t(width) * height, 255);
    for (int y = 0; y < height; y++) {
        const int sourceRow = bottomUp ? height - 1 - y : y;
        const unsigned char* row = bytes.data() + offset + size_t(sourceRow) * rowBytes;
        for (int x = 0; x < width; x++) {
            const unsigned char* px = row + size_t(x) * channels;
            gray[size_t(y) * width + x] = unsigned char((int(px[0]) + int(px[1]) + int(px[2])) / 3);
        }
    }
    return true;
}

} // namespace lbbarwin

// ============================ .lcpp 命令包装器（全局可见） ============================

long long 条码_生成EAN13(const wchar_t* 内容) { return lbbarwin::CreateBarcode(0, 内容); }
long long 条码_生成EAN8(const wchar_t* 内容) { return lbbarwin::CreateBarcode(1, 内容); }
long long 条码_生成UPCA(const wchar_t* 内容) { return lbbarwin::CreateBarcode(2, 内容); }
long long 条码_生成Code128(const wchar_t* 内容) { return lbbarwin::CreateBarcode(3, 内容); }
long long 条码_生成Code39(const wchar_t* 内容) { return lbbarwin::CreateBarcode(4, 内容); }

int 条码_取模块数(long long 条码) {
    lbbarwin::g_barError.clear();
    const lbbarwin::BarcodeEntry* entry = lbbarwin::BarcodeOf(条码);
    return entry ? entry->matrix.modules : 0;
}

const wchar_t* 条码_取内容(long long 条码) {
    lbbarwin::g_barError.clear();
    const lbbarwin::BarcodeEntry* entry = lbbarwin::BarcodeOf(条码);
    if (!entry) return LB_ReturnText(L"");
    return LB_ReturnText(lbbarwin::Utf8ToWideLocal(entry->fullText));
}

long long 条码_取位图(long long 条码, int 每模块像素) {
    lbbarwin::g_barError.clear();
    const lbbarwin::BarcodeEntry* entry = lbbarwin::BarcodeOf(条码);
    if (!entry) return 0;
    const HBITMAP bitmap = lbbarwin::RenderBitmap(*entry, 每模块像素);
    return bitmap ? reinterpret_cast<long long>(bitmap) : 0;
}

bool 条码_保存BMP(long long 条码, const wchar_t* 路径, int 每模块像素) {
    lbbarwin::g_barError.clear();
    const lbbarwin::BarcodeEntry* entry = lbbarwin::BarcodeOf(条码);
    if (!entry) return false;
    if (!路径 || !*路径) { lbbarwin::g_barError = L"输出路径为空。"; return false; }
    return lbbarwin::SaveBmpFile(路径, *entry, 每模块像素);
}

bool 条码_释放(long long 条码) {
    lbbarwin::g_barError.clear();
    return lbbarwin::g_barcodes.erase(条码) == 1 ? true : (lbbarwin::g_barError = L"条码句柄无效或已释放。", false);
}

void 条码_释放全部() { lbbarwin::g_barError.clear(); lbbarwin::g_barcodes.clear(); }

long long 条码_识别像素(const std::vector<unsigned char>& 数据, int 宽度, int 高度, int 通道数) {
    using namespace lbbarwin;
    g_recError.clear();
    if (宽度 <= 0 || 高度 <= 0) { g_recError = L"宽度与高度必须大于 0。"; return 0; }
    if (通道数 != 1 && 通道数 != 3 && 通道数 != 4) { g_recError = L"通道数只支持 1（灰度）、3（BGR）、4（BGRX）。"; return 0; }
    if (数据.size() != size_t(宽度) * 高度 * 通道数) {
        g_recError = L"字节集长度与 宽度×高度×通道数 不一致。";
        return 0;
    }
    std::vector<unsigned char> gray(size_t(宽度) * 高度);
    for (size_t i = 0; i < gray.size(); i++) {
        const unsigned char* px = &数据[i * 通道数];
        gray[i] = 通道数 == 1 ? px[0] : unsigned char((int(px[0]) + int(px[1]) + int(px[2])) / 3);
    }
    return RecognizeGray(gray, 宽度, 高度);
}

long long 条码_识别位图(long long 位图句柄) {
    using namespace lbbarwin;
    g_recError.clear();
    const HBITMAP bitmap = reinterpret_cast<HBITMAP>(位图句柄);
    BITMAP bm = {};
    if (!bitmap || !GetObjectW(bitmap, sizeof(bm), &bm) || bm.bmWidth <= 0 || bm.bmHeight <= 0) {
        g_recError = L"位图句柄无效。";
        return 0;
    }
    const int w = bm.bmWidth, h = bm.bmHeight < 0 ? -bm.bmHeight : bm.bmHeight;
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = w;
    info.bmiHeader.biHeight = -h;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(size_t(w) * h * 4);
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    const int got = GetDIBits(mem, bitmap, 0, h, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (got == 0) { g_recError = L"读取位图像素失败。"; return 0; }
    std::vector<unsigned char> gray(size_t(w) * h);
    for (size_t i = 0; i < gray.size(); i++) {
        const unsigned char* px = &buffer[i * 4];
        gray[i] = unsigned char((int(px[0]) + int(px[1]) + int(px[2])) / 3);
    }
    return RecognizeGray(gray, w, h);
}

long long 条码_识别屏幕(int 横, int 纵, int 宽, int 高) {
    using namespace lbbarwin;
    g_recError.clear();
    if (宽 <= 0 || 高 <= 0 || 宽 > 10000 || 高 > 10000) { g_recError = L"区域尺寸必须为 1~10000 像素。"; return 0; }
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    HBITMAP bitmap = CreateCompatibleBitmap(screen, 宽, 高);
    const HGDIOBJ old = SelectObject(mem, bitmap);
    const BOOL copied = BitBlt(mem, 0, 0, 宽, 高, screen, 横, 纵, SRCCOPY);
    SelectObject(mem, old);
    ReleaseDC(nullptr, screen);
    if (!copied) { DeleteDC(mem); DeleteObject(bitmap); g_recError = L"屏幕区域抓取失败。"; return 0; }
    BITMAPINFO info = {};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = 宽;
    info.bmiHeader.biHeight = -高;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    std::vector<unsigned char> buffer(size_t(宽) * 高 * 4);
    const int got = GetDIBits(mem, bitmap, 0, 高, buffer.data(), &info, DIB_RGB_COLORS);
    DeleteDC(mem);
    DeleteObject(bitmap);
    if (got == 0) { g_recError = L"读取屏幕像素失败。"; return 0; }
    std::vector<unsigned char> gray(size_t(宽) * 高);
    for (size_t i = 0; i < gray.size(); i++) {
        const unsigned char* px = &buffer[i * 4];
        gray[i] = unsigned char((int(px[0]) + int(px[1]) + int(px[2])) / 3);
    }
    return RecognizeGray(gray, 宽, 高);
}

long long 条码_识别BMP(const wchar_t* 路径) {
    using namespace lbbarwin;
    g_recError.clear();
    if (!路径 || !*路径) { g_recError = L"路径为空。"; return 0; }
    std::vector<unsigned char> bytes;
    if (!ReadFileBytesW(路径, bytes)) return 0;
    std::vector<unsigned char> gray;
    int width = 0, height = 0;
    if (!DecodeBmpToGray(bytes, gray, width, height)) return 0;
    return RecognizeGray(gray, width, height);
}

const wchar_t* 条码_识别取文本(long long 结果) {
    lbbarwin::g_recError.clear();
    const lbbarwin::ResultEntry* entry = lbbarwin::ResultOf(结果);
    if (!entry) return LB_ReturnText(L"");
    return LB_ReturnText(lbbarwin::Utf8ToWideLocal(entry->result.text));
}

const wchar_t* 条码_识别取码制(long long 结果) {
    lbbarwin::g_recError.clear();
    const lbbarwin::ResultEntry* entry = lbbarwin::ResultOf(结果);
    if (!entry) return LB_ReturnText(L"");
    const wchar_t* names[] = { L"EAN-13", L"EAN-8", L"UPC-A", L"Code128", L"Code39" };
    const int kind = entry->result.kind;
    return LB_ReturnText(kind >= 0 && kind <= 4 ? names[kind] : L"未知");
}

bool 条码_识别取校验通过(long long 结果) {
    lbbarwin::g_recError.clear();
    const lbbarwin::ResultEntry* entry = lbbarwin::ResultOf(结果);
    return entry ? entry->result.checkPassed : false;
}

bool 条码_识别释放(long long 结果) {
    lbbarwin::g_recError.clear();
    return lbbarwin::g_results.erase(结果) == 1 ? true : (lbbarwin::g_recError = L"识别结果句柄无效或已释放。", false);
}

void 条码_识别释放全部() { lbbarwin::g_recError.clear(); lbbarwin::g_results.clear(); }

bool 条码_自检() {
    lbbarwin::g_barError.clear();
    lbbar::ClearError();
    return lbbar::SelfTest() ? true : (lbbarwin::g_barError = lbbarwin::Utf8ToWideLocal(lbbar::g_error), false);
}

const wchar_t* 条码_取错误() { return LB_ReturnText(lbbarwin::g_barError); }
const wchar_t* 条码_识别取错误() { return LB_ReturnText(lbbarwin::g_recError); }
const wchar_t* 条码_取版本() { return LB_ReturnText(L"一维条码模块 1.0.0（EAN-13/EAN-8/UPC-A/Code128/Code39，纯本地实现）"); }
bool 条码_是否可用() { return true; }
