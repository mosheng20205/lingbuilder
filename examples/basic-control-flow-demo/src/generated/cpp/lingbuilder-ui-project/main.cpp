#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif


#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winternl.h>
#include <commctrl.h>
#include <commdlg.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <richedit.h>
#include <uxtheme.h>
#include <mfapi.h>
#include <mfplay.h>
#include <wincodec.h>
#include <gdiplus.h>
#include <winhttp.h>
#include <wininet.h>
#include <wincrypt.h>
#include <bcrypt.h>
#include <sql.h>
#include <sqlext.h>
#include <mmsystem.h>
#include <oleacc.h>
#include <intrin.h>
#if defined(LINGBUILDER_EDGEVIEW_MODULE) && __has_include(<WebView2.h>)
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>
#include <wrl.h>
#define LINGBUILDER_EDGEVIEW_AVAILABLE 1
#else
#define LINGBUILDER_EDGEVIEW_AVAILABLE 0
#endif
#if defined(LINGBUILDER_CEF3_MODULE) && __has_include(<include/cef_app.h>)
#include <include/cef_app.h>
#include <include/cef_browser.h>
#include <include/cef_client.h>
#include <include/cef_command_line.h>
#include <include/cef_parser.h>
#include <include/wrapper/cef_helpers.h>
#define LINGBUILDER_CEF3_AVAILABLE 1
#else
#define LINGBUILDER_CEF3_AVAILABLE 0
#endif
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <ctime>
#include <cstring>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <functional>
#include <fstream>
#include <iterator>
#include <initializer_list>
#include <random>
#include <regex>
#include <sstream>
#include <map>
#include <string>
#include <thread>
#include <utility>
#include <mutex>
#include <memory>
#include <new>
#include <stdexcept>
#include <unordered_map>
#include <vector>

class LingFinallyGuard {
public:
    explicit LingFinallyGuard(std::function<void()> action) : action_(std::move(action)) {}
    ~LingFinallyGuard() { if (action_) action_(); }
    LingFinallyGuard(const LingFinallyGuard&) = delete;
    LingFinallyGuard& operator=(const LingFinallyGuard&) = delete;
private:
    std::function<void()> action_;
};

static std::string LingCppWideToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    int length = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    std::string result(static_cast<size_t>((std::max)(0, length)), '\0');
    if (length > 0) WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr);
    return result;
}

static std::wstring LingCppUtf8ToWide(const char* value) {
    if (!value || !value[0]) return {};
    int length = MultiByteToWideChar(CP_UTF8, 0, value, -1, nullptr, 0);
    std::wstring result(static_cast<size_t>((std::max)(0, length)), L'\0');
    if (length > 1) MultiByteToWideChar(CP_UTF8, 0, value, -1, result.data(), length);
    if (!result.empty() && result.back() == L'\0') result.pop_back();
    return result;
}

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "windowscodecs.lib")
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "odbc32.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "oleacc.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "uxtheme.lib")
#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfplay.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(linker, "/manifestdependency:\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")
#ifndef UNICODE
#define UNICODE
#endif
#ifndef UNICODE
#define UNICODE
#endif

static Gdiplus::Color ToGdiPlusColor(COLORREF color) {
    return Gdiplus::Color(255, GetRValue(color), GetGValue(color), GetBValue(color));
}

static void AddRoundedRectanglePath(Gdiplus::GraphicsPath& path, const Gdiplus::RectF& rect, float radius) {
    float safeRadius = std::max(0.0f, std::min(radius, std::min(rect.Width, rect.Height) / 2.0f));
    if (safeRadius <= 0.0f) { path.AddRectangle(rect); return; }
    float diameter = safeRadius * 2.0f;
    path.AddArc(rect.X, rect.Y, diameter, diameter, 180.0f, 90.0f);
    path.AddArc(rect.GetRight() - diameter, rect.Y, diameter, diameter, 270.0f, 90.0f);
    path.AddArc(rect.GetRight() - diameter, rect.GetBottom() - diameter, diameter, diameter, 0.0f, 90.0f);
    path.AddArc(rect.X, rect.GetBottom() - diameter, diameter, diameter, 90.0f, 90.0f);
    path.CloseFigure();
}

static bool DrawAntiAliasedRoundedRectangle(HDC hdc, const RECT& rect, int radius, COLORREF fill, COLORREF border, bool fillShape, float borderWidth = 1.0f) {
    Gdiplus::Graphics graphics(hdc);
    if (graphics.GetLastStatus() != Gdiplus::Ok) return false;
    graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    graphics.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
    Gdiplus::RectF bounds(static_cast<Gdiplus::REAL>(rect.left) + 0.5f, static_cast<Gdiplus::REAL>(rect.top) + 0.5f,
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.right - rect.left) - 1.0f),
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.bottom - rect.top) - 1.0f));
    Gdiplus::GraphicsPath path;
    AddRoundedRectanglePath(path, bounds, static_cast<float>(radius));
    if (fillShape) { Gdiplus::SolidBrush brush(ToGdiPlusColor(fill)); graphics.FillPath(&brush, &path); }
    Gdiplus::Pen pen(ToGdiPlusColor(border), borderWidth);
    graphics.DrawPath(&pen, &path);
    return true;
}

typedef HRESULT (WINAPI* DwmSetWindowAttributeFunction)(HWND, DWORD, LPCVOID, DWORD);

static DwmSetWindowAttributeFunction ResolveDwmSetWindowAttribute() {
    static HMODULE module = LoadLibraryW(L"dwmapi.dll");
    static DwmSetWindowAttributeFunction function = module
        ? reinterpret_cast<DwmSetWindowAttributeFunction>(GetProcAddress(module, "DwmSetWindowAttribute"))
        : nullptr;
    return function;
}

static HICON CreateLingBuilderWindowIcon(int size) {
    size = std::max(16, size);
    BITMAPV5HEADER header = {};
    header.bV5Size = sizeof(header);
    header.bV5Width = size;
    header.bV5Height = -size;
    header.bV5Planes = 1;
    header.bV5BitCount = 32;
    header.bV5Compression = BI_BITFIELDS;
    header.bV5RedMask = 0x00FF0000;
    header.bV5GreenMask = 0x0000FF00;
    header.bV5BlueMask = 0x000000FF;
    header.bV5AlphaMask = 0xFF000000;
    void* rawPixels = nullptr;
    HDC screen = GetDC(nullptr);
    HBITMAP color = CreateDIBSection(screen, reinterpret_cast<BITMAPINFO*>(&header), DIB_RGB_COLORS, &rawPixels, nullptr, 0);
    if (screen) ReleaseDC(nullptr, screen);
    if (!color || !rawPixels) { if (color) DeleteObject(color); return nullptr; }
    auto* pixels = static_cast<std::uint32_t*>(rawPixels);
    std::fill(pixels, pixels + size * size, 0u);
    auto put = [pixels, size](int x, int y, std::uint32_t argb) {
        if (x >= 0 && y >= 0 && x < size && y < size) pixels[y * size + x] = argb;
    };
    int left = std::max(2, size / 8);
    int top = std::max(2, size / 7);
    int right = size - left - 1;
    int bottom = size - std::max(5, size / 4);
    int stroke = std::max(2, size / 10);
    for (int y = top; y <= bottom; ++y) for (int x = left; x <= right; ++x) {
        bool border = x < left + stroke || x > right - stroke || y < top + stroke || y > bottom - stroke;
        put(x, y, border ? 0xFFFFB000u : 0xFF1F2937u);
    }
    int center = size / 2;
    for (int y = bottom + 1; y < std::min(size, bottom + 1 + stroke); ++y)
        for (int x = center - stroke / 2; x <= center + stroke / 2; ++x) put(x, y, 0xFFFFB000u);
    for (int y = std::min(size - 1, bottom + stroke); y < std::min(size, bottom + stroke * 2); ++y)
        for (int x = center - size / 5; x <= center + size / 5; ++x) put(x, y, 0xFFFFB000u);
    HBITMAP mask = CreateBitmap(size, size, 1, 1, nullptr);
    ICONINFO info = { TRUE, 0, 0, mask, color };
    HICON icon = CreateIconIndirect(&info);
    if (mask) DeleteObject(mask);
    DeleteObject(color);
    return icon;
}

struct ControlSpec {
    int id;
    int parentId;
    const wchar_t* type;
    const wchar_t* name;
    const wchar_t* text;
    int x;
    int y;
    int width;
    int height;
    int fontSize;
    const wchar_t* fontFamily;
    bool fontBold;
    bool fontItalic;
    bool fontUnderline;
    int cornerRadius;
    int listBorderWidth;
    COLORREF listBorderColor;
    COLORREF listSelectionStart;
    COLORREF listSelectionEnd;
    COLORREF listSelectionBorder;
    int listSelectionCornerRadius;
    int listItemHeight;
    int listItemSpacing;
    int listHeaderHeight;
    int listContentPadding;
    int listScrollBarVisibility;
    int listScrollBarWidth;
    COLORREF listScrollBarTrack;
    COLORREF listScrollBarThumb;
    int treeBorderWidth;
    COLORREF treeBorderColor;
    int treeNodeSpacing;
    int treeNodePadding;
    COLORREF background;
    bool backgroundTransparent;
    COLORREF foreground;
    bool enabled;
    const wchar_t* data;
    const wchar_t* data2;
    const wchar_t* tooltip;
    int tooltipDelay;
    const wchar_t* containerSlot;
    const wchar_t* option1;
    const wchar_t* option2;
    int minimum;
    int maximum;
    int value;
    int selectedIndex;
    unsigned int flags;
    const wchar_t* events;
};

struct ImageListSpec {
    const wchar_t* id;
    int width;
    int height;
    const wchar_t* images;
};

struct PropertySheetSpec { const wchar_t* id; const wchar_t* title; const wchar_t* pages; };
struct FileDialogSpec {
    const wchar_t* id; const wchar_t* name; int ownerWindowIndex;
    int triggerControlId; int dropTargetControlId; bool multiple; bool allowDrop;
    const wchar_t* title; const wchar_t* filter;
};
struct MenuResourceSpec {
    const wchar_t* id; const wchar_t* name; int ownerWindowIndex;
    int targetControlId; bool contextMenu; const wchar_t* items;
};
struct PropertySheetPageContext {
    const wchar_t* title; const wchar_t* content; const wchar_t* resourceId;
    void* eventOwner; void (*applied)(void*, const wchar_t*);
    void* pageOwner; void (*initialize)(void*, HWND);
};

enum ControlFlags : unsigned int {
    CF_CHECKED = 1u << 0, CF_THREE_STATE = 1u << 1, CF_MULTILINE = 1u << 2,
    CF_PASSWORD = 1u << 3, CF_READ_ONLY = 1u << 4, CF_NUMERIC = 1u << 5,
    CF_SORTED = 1u << 6, CF_MULTIPLE = 1u << 7, CF_EDITABLE = 1u << 8,
    CF_MARQUEE = 1u << 9, CF_GRID_LINES = 1u << 10, CF_CHECKBOXES = 1u << 11,
    CF_WORD_WRAP = 1u << 12, CF_AUTO_PLAY = 1u << 13, CF_LOOP = 1u << 14,
    CF_HORIZONTAL = 1u << 15, CF_BUTTON_DEFAULT = 1u << 16,
    CF_BUTTON_TOGGLE = 1u << 17, CF_BUTTON_SPLIT = 1u << 18,
    CF_BUTTON_COMMAND_LINK = 1u << 19, CF_ALIGN_CENTER = 1u << 20,
    CF_ALIGN_RIGHT = 1u << 21, CF_VIEW_ICON = 1u << 22,
    CF_VIEW_SMALL_ICON = 1u << 23, CF_VIEW_LIST = 1u << 24,
    CF_SHOW_BORDER = 1u << 25, CF_MULTI_SELECT = 1u << 26,
    CF_SHOW_LINES = 1u << 27, CF_HIDE_TAB_HEADER = 1u << 28,
    CF_HIDDEN = 1u << 29, CF_COLOR_TEXT = 1u << 30
};

struct WindowSpec {
    int index;
    const wchar_t* className;
    const wchar_t* title;
    int width;
    int height;
    COLORREF background;
    COLORREF titleBarBackground;
    COLORREF titleBarForeground;
    int cornerPreference;
    const wchar_t* iconStyle;
    const wchar_t* iconPath;
    const wchar_t* openPlacement;
    int openX;
    int openY;
    bool resizable;
    bool maximizable;
    const ControlSpec* controls;
    int controlCount;
    const wchar_t* menuItems;
    COLORREF menuBackground;
    COLORREF menuForeground;
    const wchar_t* menuFontFamily;
    int menuFontSize;
    bool menuFontBold;
    bool menuFontItalic;
    bool menuFontUnderline;
    const wchar_t* events;
};

static constexpr UINT WM_LINGBUILDER_VIDEO_EVENT = WM_APP + 0x4B;
static constexpr UINT WM_LINGBUILDER_LAYOUT_DATE_PICKER = WM_APP + 0x4C;
static constexpr UINT WM_LINGBUILDER_THREAD_UI_UPDATE = WM_APP + 0x4D;
static constexpr UINT WM_LINGBUILDER_CEF_EVENT = WM_APP + 0x4E;
static constexpr UINT WM_LINGBUILDER_WEB_ASYNC_COMPLETE = WM_APP + 0x4F;

struct LingCefEventPacket {
    int controlId = 0;
    std::wstring name;
    std::wstring data;
    std::map<std::wstring, std::wstring> fields;
    int action = 0; // 0=默认，1=允许/继续，2=拒绝/取消，3=已处理
    std::wstring resultText;
    bool synchronous = false;
};

class LingVideoPlayerCallback final : public IMFPMediaPlayerCallback {
public:
    LingVideoPlayerCallback(HWND notificationWindow, int controlId)
        : notificationWindow_(notificationWindow), controlId_(controlId) {}

    STDMETHODIMP QueryInterface(REFIID iid, void** object) override {
        if (!object) return E_POINTER;
        if (iid == IID_IUnknown || iid == __uuidof(IMFPMediaPlayerCallback)) {
            *object = static_cast<IMFPMediaPlayerCallback*>(this);
            AddRef();
            return S_OK;
        }
        *object = nullptr;
        return E_NOINTERFACE;
    }
    STDMETHODIMP_(ULONG) AddRef() override { return ++references_; }
    STDMETHODIMP_(ULONG) Release() override {
        ULONG remaining = --references_;
        if (!remaining) delete this;
        return remaining;
    }
    void STDMETHODCALLTYPE OnMediaPlayerEvent(MFP_EVENT_HEADER* eventHeader) override {
        if (!eventHeader || !notificationWindow_) return;
        LPARAM eventCode = FAILED(eventHeader->hrEvent) ? 3
            : eventHeader->eEventType == MFP_EVENT_TYPE_MEDIAITEM_SET ? 1
            : eventHeader->eEventType == MFP_EVENT_TYPE_PLAYBACK_ENDED ? 2 : 0;
        if (eventCode) PostMessageW(notificationWindow_, WM_LINGBUILDER_VIDEO_EVENT, static_cast<WPARAM>(controlId_), eventCode);
    }

private:
    std::atomic<ULONG> references_{1};
    HWND notificationWindow_;
    int controlId_;
};

struct RuntimeControl {
    int id;
    HWND hwnd;
    HWND frameHwnd;
    HFONT font;
    HBRUSH brush;
    HGDIOBJ resource;
    bool iconResource;
    bool mouseInside;
    int checkState;
    bool hideTabHeader;
    IMFPMediaPlayer* mediaPlayer;
    LingVideoPlayerCallback* mediaCallback;
    std::vector<std::wstring> uploadFiles;
    Gdiplus::Image* animatedImage = nullptr;
    GUID animatedDimension = {};
    UINT animatedFrame = 0;
    UINT animatedFrameCount = 0;
    std::vector<UINT> animatedFrameDelays;
    UINT_PTR animatedTimer = 0;
    bool animatedLoop = false;
    COLORREF colorValue = RGB(59, 130, 246);
    bool colorDialogOpen = false;
};

struct RuntimeTabPage {
    int tabControlId;
    std::wstring slot;
    HWND hwnd;
    RECT contentRect;
};

struct ModernColorPickerState {
    HWND hwnd = nullptr;
    HWND owner = nullptr;
    HWND hexEdit = nullptr;
    COLORREF current = RGB(59, 130, 246);
    double hue = 215.0;
    double saturation = 0.76;
    double value = 0.96;
    bool accepted = false;
    bool draggingSpectrum = false;
    bool draggingHue = false;
    bool syncingText = false;
    HFONT font = nullptr;
    HBRUSH editBrush = nullptr;
    std::vector<std::uint32_t> spectrumPixels;
    int spectrumPixelWidth = 0;
    int spectrumPixelHeight = 0;
    double spectrumPixelHue = -1.0;
};

static int ModernColorScale(HWND hwnd, int value) {
    UINT dpi = GetDpiForWindow(hwnd);
    return MulDiv(value, dpi ? static_cast<int>(dpi) : 96, 96);
}

static COLORREF ModernHsvToColor(double hue, double saturation, double value) {
    double chroma = value * saturation;
    double section = std::fmod(std::max(0.0, hue), 360.0) / 60.0;
    double x = chroma * (1.0 - std::fabs(std::fmod(section, 2.0) - 1.0));
    double red = 0.0, green = 0.0, blue = 0.0;
    if (section < 1.0) { red = chroma; green = x; }
    else if (section < 2.0) { red = x; green = chroma; }
    else if (section < 3.0) { green = chroma; blue = x; }
    else if (section < 4.0) { green = x; blue = chroma; }
    else if (section < 5.0) { red = x; blue = chroma; }
    else { red = chroma; blue = x; }
    double match = value - chroma;
    return RGB(
        static_cast<int>(std::round((red + match) * 255.0)),
        static_cast<int>(std::round((green + match) * 255.0)),
        static_cast<int>(std::round((blue + match) * 255.0))
    );
}

static void ModernColorToHsv(COLORREF color, double& hue, double& saturation, double& value) {
    double red = GetRValue(color) / 255.0;
    double green = GetGValue(color) / 255.0;
    double blue = GetBValue(color) / 255.0;
    double maximum = std::max(red, std::max(green, blue));
    double minimum = std::min(red, std::min(green, blue));
    double delta = maximum - minimum;
    value = maximum;
    saturation = maximum <= 0.0 ? 0.0 : delta / maximum;
    if (delta <= 0.0) hue = 0.0;
    else if (maximum == red) hue = 60.0 * std::fmod((green - blue) / delta, 6.0);
    else if (maximum == green) hue = 60.0 * (((blue - red) / delta) + 2.0);
    else hue = 60.0 * (((red - green) / delta) + 4.0);
    if (hue < 0.0) hue += 360.0;
}

static RECT ModernSpectrumRect(HWND hwnd) {
    return { ModernColorScale(hwnd, 20), ModernColorScale(hwnd, 52), ModernColorScale(hwnd, 340), ModernColorScale(hwnd, 272) };
}

static RECT ModernHueRect(HWND hwnd) {
    return { ModernColorScale(hwnd, 356), ModernColorScale(hwnd, 52), ModernColorScale(hwnd, 380), ModernColorScale(hwnd, 272) };
}

static void ModernSyncHexEdit(ModernColorPickerState& state) {
    if (!state.hexEdit) return;
    wchar_t text[16] = {};
    swprintf_s(text, L"#%02X%02X%02X", GetRValue(state.current), GetGValue(state.current), GetBValue(state.current));
    state.syncingText = true;
    SetWindowTextW(state.hexEdit, text);
    state.syncingText = false;
}

static void ModernCenterHexEdit(ModernColorPickerState& state) {
    if (!state.hwnd || !state.hexEdit) return;
    RECT field = { ModernColorScale(state.hwnd, 404), ModernColorScale(state.hwnd, 160), ModernColorScale(state.hwnd, 496), ModernColorScale(state.hwnd, 192) };
    int editHeight = ModernColorScale(state.hwnd, 24);
    HDC editDc = GetDC(state.hexEdit);
    if (editDc) {
        HFONT previousFont = state.font ? reinterpret_cast<HFONT>(SelectObject(editDc, state.font)) : nullptr;
        TEXTMETRICW metrics = {};
        if (GetTextMetricsW(editDc, &metrics)) editHeight = metrics.tmHeight + ModernColorScale(state.hwnd, 6);
        if (previousFont) SelectObject(editDc, previousFont);
        ReleaseDC(state.hexEdit, editDc);
    }
    int fieldHeight = field.bottom - field.top;
    editHeight = std::clamp(editHeight, ModernColorScale(state.hwnd, 20), fieldHeight);
    int horizontalPadding = ModernColorScale(state.hwnd, 4);
    SetWindowPos(state.hexEdit, nullptr, field.left + horizontalPadding, field.top + (fieldHeight - editHeight) / 2,
        (field.right - field.left) - horizontalPadding * 2, editHeight, SWP_NOZORDER | SWP_NOACTIVATE);
}

static bool ModernParseHexColor(const wchar_t* text, COLORREF& color) {
    if (!text) return false;
    const wchar_t* value = text[0] == L'#' ? text + 1 : text;
    if (wcslen(value) != 6) return false;
    wchar_t* end = nullptr;
    unsigned long parsed = wcstoul(value, &end, 16);
    if (!end || *end != L'\0') return false;
    color = RGB((parsed >> 16) & 0xFF, (parsed >> 8) & 0xFF, parsed & 0xFF);
    return true;
}

static void ModernUpdateSpectrumFromPoint(ModernColorPickerState& state, int x, int y) {
    RECT rect = ModernSpectrumRect(state.hwnd);
    state.saturation = std::clamp((x - rect.left) / static_cast<double>(std::max(1L, rect.right - rect.left)), 0.0, 1.0);
    state.value = 1.0 - std::clamp((y - rect.top) / static_cast<double>(std::max(1L, rect.bottom - rect.top)), 0.0, 1.0);
    state.current = ModernHsvToColor(state.hue, state.saturation, state.value);
    ModernSyncHexEdit(state);
    InvalidateRect(state.hwnd, nullptr, FALSE);
}

static void ModernUpdateHueFromPoint(ModernColorPickerState& state, int y) {
    RECT rect = ModernHueRect(state.hwnd);
    state.hue = std::clamp((y - rect.top) / static_cast<double>(std::max(1L, rect.bottom - rect.top)), 0.0, 1.0) * 359.999;
    state.current = ModernHsvToColor(state.hue, state.saturation, state.value);
    ModernSyncHexEdit(state);
    InvalidateRect(state.hwnd, nullptr, FALSE);
}

static void ModernPaintColorPicker(ModernColorPickerState& state, HDC hdc) {
    RECT client = {}; GetClientRect(state.hwnd, &client);
    HBRUSH background = CreateSolidBrush(RGB(15, 23, 42));
    FillRect(hdc, &client, background); DeleteObject(background);
    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, RGB(226, 232, 240));
    HFONT previousFont = state.font ? reinterpret_cast<HFONT>(SelectObject(hdc, state.font)) : nullptr;
    RECT heading = { ModernColorScale(state.hwnd, 20), ModernColorScale(state.hwnd, 16), ModernColorScale(state.hwnd, 500), ModernColorScale(state.hwnd, 42) };
    DrawTextW(hdc, L"选择颜色", -1, &heading, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);

    RECT spectrum = ModernSpectrumRect(state.hwnd);
    int width = std::max(1L, spectrum.right - spectrum.left);
    int height = std::max(1L, spectrum.bottom - spectrum.top);
    if (state.spectrumPixelWidth != width || state.spectrumPixelHeight != height || state.spectrumPixelHue != state.hue) {
        state.spectrumPixels.resize(static_cast<size_t>(width * height));
        for (int y = 0; y < height; ++y) {
            double brightness = 1.0 - y / static_cast<double>(std::max(1, height - 1));
            for (int x = 0; x < width; ++x) {
                COLORREF color = ModernHsvToColor(state.hue, x / static_cast<double>(std::max(1, width - 1)), brightness);
                state.spectrumPixels[static_cast<size_t>(y * width + x)] = (static_cast<std::uint32_t>(GetRValue(color)) << 16)
                    | (static_cast<std::uint32_t>(GetGValue(color)) << 8) | GetBValue(color);
            }
        }
        state.spectrumPixelWidth = width;
        state.spectrumPixelHeight = height;
        state.spectrumPixelHue = state.hue;
    }
    BITMAPINFO bitmap = {}; bitmap.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bitmap.bmiHeader.biWidth = width; bitmap.bmiHeader.biHeight = -height;
    bitmap.bmiHeader.biPlanes = 1; bitmap.bmiHeader.biBitCount = 32; bitmap.bmiHeader.biCompression = BI_RGB;
    StretchDIBits(hdc, spectrum.left, spectrum.top, width, height, 0, 0, width, height, state.spectrumPixels.data(), &bitmap, DIB_RGB_COLORS, SRCCOPY);

    RECT hue = ModernHueRect(state.hwnd);
    for (int y = hue.top; y < hue.bottom; ++y) {
        double value = (y - hue.top) / static_cast<double>(std::max(1L, hue.bottom - hue.top - 1));
        HBRUSH hueBrush = CreateSolidBrush(ModernHsvToColor(value * 359.999, 1.0, 1.0));
        RECT line = { hue.left, y, hue.right, y + 1 }; FillRect(hdc, &line, hueBrush); DeleteObject(hueBrush);
    }

    int markerX = spectrum.left + static_cast<int>(state.saturation * width);
    int markerY = spectrum.top + static_cast<int>((1.0 - state.value) * height);
    HPEN markerPen = CreatePen(PS_SOLID, ModernColorScale(state.hwnd, 2), RGB(255, 255, 255));
    HGDIOBJ oldPen = SelectObject(hdc, markerPen); HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
    Ellipse(hdc, markerX - ModernColorScale(state.hwnd, 6), markerY - ModernColorScale(state.hwnd, 6), markerX + ModernColorScale(state.hwnd, 6), markerY + ModernColorScale(state.hwnd, 6));
    int hueY = hue.top + static_cast<int>((state.hue / 360.0) * (hue.bottom - hue.top));
    Rectangle(hdc, hue.left - ModernColorScale(state.hwnd, 2), hueY - ModernColorScale(state.hwnd, 2), hue.right + ModernColorScale(state.hwnd, 2), hueY + ModernColorScale(state.hwnd, 3));
    SelectObject(hdc, oldBrush); SelectObject(hdc, oldPen); DeleteObject(markerPen);

    RECT preview = { ModernColorScale(state.hwnd, 404), ModernColorScale(state.hwnd, 52), ModernColorScale(state.hwnd, 496), ModernColorScale(state.hwnd, 136) };
    HBRUSH previewBrush = CreateSolidBrush(state.current); FillRect(hdc, &preview, previewBrush); DeleteObject(previewBrush);
    FrameRect(hdc, &preview, reinterpret_cast<HBRUSH>(GetStockObject(GRAY_BRUSH)));
    RECT hexField = { ModernColorScale(state.hwnd, 404), ModernColorScale(state.hwnd, 160), ModernColorScale(state.hwnd, 496), ModernColorScale(state.hwnd, 192) };
    HBRUSH hexFieldBrush = CreateSolidBrush(RGB(30, 41, 59)); FillRect(hdc, &hexField, hexFieldBrush); DeleteObject(hexFieldBrush);
    RECT rgb = { ModernColorScale(state.hwnd, 404), ModernColorScale(state.hwnd, 208), ModernColorScale(state.hwnd, 506), ModernColorScale(state.hwnd, 270) };
    wchar_t rgbText[96] = {}; swprintf_s(rgbText, L"红  %d\n绿  %d\n蓝  %d", GetRValue(state.current), GetGValue(state.current), GetBValue(state.current));
    SetTextColor(hdc, RGB(148, 163, 184)); DrawTextW(hdc, rgbText, -1, &rgb, DT_LEFT | DT_TOP | DT_NOPREFIX);

    static const COLORREF presets[] = { RGB(15,23,42), RGB(51,65,85), RGB(239,68,68), RGB(249,115,22), RGB(234,179,8), RGB(34,197,94), RGB(6,182,212), RGB(59,130,246), RGB(139,92,246), RGB(236,72,153), RGB(255,255,255) };
    SetTextColor(hdc, RGB(203, 213, 225));
    RECT presetLabel = { ModernColorScale(state.hwnd, 20), ModernColorScale(state.hwnd, 290), ModernColorScale(state.hwnd, 180), ModernColorScale(state.hwnd, 316) };
    DrawTextW(hdc, L"常用颜色", -1, &presetLabel, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    for (int index = 0; index < static_cast<int>(std::size(presets)); ++index) {
        int left = ModernColorScale(state.hwnd, 20 + index * 40);
        RECT swatch = { left, ModernColorScale(state.hwnd, 322), left + ModernColorScale(state.hwnd, 30), ModernColorScale(state.hwnd, 352) };
        HBRUSH brush = CreateSolidBrush(presets[index]); FillRect(hdc, &swatch, brush); DeleteObject(brush);
        FrameRect(hdc, &swatch, reinterpret_cast<HBRUSH>(GetStockObject(GRAY_BRUSH)));
    }

    RECT cancel = { ModernColorScale(state.hwnd, 322), ModernColorScale(state.hwnd, 374), ModernColorScale(state.hwnd, 408), ModernColorScale(state.hwnd, 410) };
    RECT confirm = { ModernColorScale(state.hwnd, 418), ModernColorScale(state.hwnd, 374), ModernColorScale(state.hwnd, 504), ModernColorScale(state.hwnd, 410) };
    HBRUSH cancelBrush = CreateSolidBrush(RGB(30, 41, 59)); FillRect(hdc, &cancel, cancelBrush); DeleteObject(cancelBrush);
    HBRUSH confirmBrush = CreateSolidBrush(RGB(37, 99, 235)); FillRect(hdc, &confirm, confirmBrush); DeleteObject(confirmBrush);
    SetTextColor(hdc, RGB(226, 232, 240)); DrawTextW(hdc, L"取消", -1, &cancel, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    SetTextColor(hdc, RGB(255, 255, 255)); DrawTextW(hdc, L"确定", -1, &confirm, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    if (previousFont) SelectObject(hdc, previousFont);
}

static LRESULT CALLBACK ModernColorPickerWindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    ModernColorPickerState* state = reinterpret_cast<ModernColorPickerState*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        CREATESTRUCTW* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
        state = reinterpret_cast<ModernColorPickerState*>(create->lpCreateParams);
        state->hwnd = hwnd; SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
    }
    if (!state) return DefWindowProcW(hwnd, message, wParam, lParam);
    switch (message) {
    case WM_CREATE:
        state->font = CreateFontW(-ModernColorScale(hwnd, 14), 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Microsoft YaHei UI");
        state->editBrush = CreateSolidBrush(RGB(30, 41, 59));
        state->hexEdit = CreateWindowExW(0, L"EDIT", L"", WS_CHILD | WS_VISIBLE | WS_TABSTOP | ES_CENTER | ES_AUTOHSCROLL,
            ModernColorScale(hwnd, 404), ModernColorScale(hwnd, 160), ModernColorScale(hwnd, 92), ModernColorScale(hwnd, 24), hwnd, reinterpret_cast<HMENU>(7001), GetModuleHandleW(nullptr), nullptr);
        if (state->font) SendMessageW(state->hexEdit, WM_SETFONT, reinterpret_cast<WPARAM>(state->font), TRUE);
        ModernCenterHexEdit(*state); ModernSyncHexEdit(*state); return 0;
    case WM_CTLCOLOREDIT: {
        HDC editDc = reinterpret_cast<HDC>(wParam); SetTextColor(editDc, RGB(226, 232, 240)); SetBkColor(editDc, RGB(30, 41, 59));
        return reinterpret_cast<LRESULT>(state->editBrush);
    }
    case WM_COMMAND:
        if (LOWORD(wParam) == 7001 && HIWORD(wParam) == EN_CHANGE && !state->syncingText) {
            wchar_t text[32] = {}; GetWindowTextW(state->hexEdit, text, 32); COLORREF parsed = 0;
            if (ModernParseHexColor(text, parsed)) { state->current = parsed; ModernColorToHsv(parsed, state->hue, state->saturation, state->value); InvalidateRect(hwnd, nullptr, FALSE); }
        }
        return 0;
    case WM_LBUTTONDOWN: {
        POINT point = { static_cast<int>(static_cast<short>(LOWORD(lParam))), static_cast<int>(static_cast<short>(HIWORD(lParam))) };
        RECT spectrum = ModernSpectrumRect(hwnd), hue = ModernHueRect(hwnd);
        if (PtInRect(&spectrum, point)) { state->draggingSpectrum = true; SetCapture(hwnd); ModernUpdateSpectrumFromPoint(*state, point.x, point.y); }
        else if (PtInRect(&hue, point)) { state->draggingHue = true; SetCapture(hwnd); ModernUpdateHueFromPoint(*state, point.y); }
        else {
            for (int index = 0; index < 11; ++index) {
                int left = ModernColorScale(hwnd, 20 + index * 40);
                RECT swatch = { left, ModernColorScale(hwnd, 322), left + ModernColorScale(hwnd, 30), ModernColorScale(hwnd, 352) };
                if (PtInRect(&swatch, point)) {
                    static const COLORREF presets[] = { RGB(15,23,42), RGB(51,65,85), RGB(239,68,68), RGB(249,115,22), RGB(234,179,8), RGB(34,197,94), RGB(6,182,212), RGB(59,130,246), RGB(139,92,246), RGB(236,72,153), RGB(255,255,255) };
                    state->current = presets[index]; ModernColorToHsv(state->current, state->hue, state->saturation, state->value); ModernSyncHexEdit(*state); InvalidateRect(hwnd, nullptr, FALSE); return 0;
                }
            }
            RECT cancel = { ModernColorScale(hwnd, 322), ModernColorScale(hwnd, 374), ModernColorScale(hwnd, 408), ModernColorScale(hwnd, 410) };
            RECT confirm = { ModernColorScale(hwnd, 418), ModernColorScale(hwnd, 374), ModernColorScale(hwnd, 504), ModernColorScale(hwnd, 410) };
            if (PtInRect(&cancel, point)) { state->accepted = false; DestroyWindow(hwnd); }
            else if (PtInRect(&confirm, point)) { state->accepted = true; DestroyWindow(hwnd); }
        }
        return 0;
    }
    case WM_MOUSEMOVE:
        if (state->draggingSpectrum) ModernUpdateSpectrumFromPoint(*state, static_cast<int>(static_cast<short>(LOWORD(lParam))), static_cast<int>(static_cast<short>(HIWORD(lParam))));
        else if (state->draggingHue) ModernUpdateHueFromPoint(*state, static_cast<int>(static_cast<short>(HIWORD(lParam))));
        return 0;
    case WM_LBUTTONUP:
        state->draggingSpectrum = state->draggingHue = false; if (GetCapture() == hwnd) ReleaseCapture(); return 0;
    case WM_KEYDOWN:
        if (wParam == VK_RETURN) { state->accepted = true; DestroyWindow(hwnd); return 0; }
        if (wParam == VK_ESCAPE) { state->accepted = false; DestroyWindow(hwnd); return 0; }
        break;
    case WM_ERASEBKGND:
        return 1;
    case WM_PAINT: {
        PAINTSTRUCT paint = {}; HDC hdc = BeginPaint(hwnd, &paint);
        RECT client = {}; GetClientRect(hwnd, &client);
        HDC bufferDc = CreateCompatibleDC(hdc);
        HBITMAP bufferBitmap = bufferDc ? CreateCompatibleBitmap(hdc, std::max(1L, client.right - client.left), std::max(1L, client.bottom - client.top)) : nullptr;
        if (bufferDc && bufferBitmap) {
            HGDIOBJ previousBitmap = SelectObject(bufferDc, bufferBitmap);
            ModernPaintColorPicker(*state, bufferDc);
            BitBlt(hdc, 0, 0, client.right - client.left, client.bottom - client.top, bufferDc, 0, 0, SRCCOPY);
            SelectObject(bufferDc, previousBitmap);
        } else {
            ModernPaintColorPicker(*state, hdc);
        }
        if (bufferBitmap) DeleteObject(bufferBitmap);
        if (bufferDc) DeleteDC(bufferDc);
        EndPaint(hwnd, &paint); return 0;
    }
    case WM_CLOSE:
        state->accepted = false; DestroyWindow(hwnd); return 0;
    case WM_DESTROY:
        if (state->font) { DeleteObject(state->font); state->font = nullptr; }
        if (state->editBrush) { DeleteObject(state->editBrush); state->editBrush = nullptr; }
        return 0;
    }
    return DefWindowProcW(hwnd, message, wParam, lParam);
}

static bool ShowModernColorPickerDialog(HWND owner, const wchar_t* title, COLORREF initial, COLORREF& selected) {
    static bool registered = false;
    if (!registered) {
        WNDCLASSEXW windowClass = { sizeof(WNDCLASSEXW) };
        windowClass.lpfnWndProc = ModernColorPickerWindowProc; windowClass.hInstance = GetModuleHandleW(nullptr);
        windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW); windowClass.lpszClassName = L"LingBuilderModernColorPicker";
        registered = RegisterClassExW(&windowClass) != 0 || GetLastError() == ERROR_CLASS_ALREADY_EXISTS;
    }
    if (!registered) return false;
    ModernColorPickerState state; state.owner = owner; state.current = initial;
    ModernColorToHsv(initial, state.hue, state.saturation, state.value);
    UINT dpi = owner ? GetDpiForWindow(owner) : 96;
    int width = MulDiv(524, dpi ? static_cast<int>(dpi) : 96, 96);
    int height = MulDiv(458, dpi ? static_cast<int>(dpi) : 96, 96);
    RECT ownerRect = {}; if (owner) GetWindowRect(owner, &ownerRect);
    int x = owner ? ownerRect.left + ((ownerRect.right - ownerRect.left) - width) / 2 : CW_USEDEFAULT;
    int y = owner ? ownerRect.top + ((ownerRect.bottom - ownerRect.top) - height) / 2 : CW_USEDEFAULT;
    HWND dialog = CreateWindowExW(WS_EX_DLGMODALFRAME | WS_EX_CONTROLPARENT, L"LingBuilderModernColorPicker",
        title && title[0] ? title : L"选择颜色", WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_CLIPCHILDREN,
        x, y, width, height, owner, nullptr, GetModuleHandleW(nullptr), &state);
    if (!dialog) return false;
    if (auto dwm = ResolveDwmSetWindowAttribute()) { BOOL dark = TRUE; dwm(dialog, 20, &dark, sizeof(dark)); }
    if (owner) EnableWindow(owner, FALSE);
    ShowWindow(dialog, SW_SHOW); UpdateWindow(dialog); SetForegroundWindow(dialog);
    MSG message = {};
    while (IsWindow(dialog)) {
        int messageResult = static_cast<int>(GetMessageW(&message, nullptr, 0, 0));
        if (messageResult <= 0) { if (messageResult == 0) PostQuitMessage(static_cast<int>(message.wParam)); break; }
        if (!IsDialogMessageW(dialog, &message)) { TranslateMessage(&message); DispatchMessageW(&message); }
    }
    if (owner && IsWindow(owner)) { EnableWindow(owner, TRUE); SetForegroundWindow(owner); }
    if (state.accepted) selected = state.current;
    return state.accepted;
}

static HINSTANCE g_instance = nullptr;
static int g_openWindowCount = 0;
static const wchar_t* GENERATED_WINDOW_CLASS = L"LingBuilderChineseCppWindowClass";

class LingWindowBase;
static LingWindowBase* CreateWindowObject(int windowIndex);
#if LINGBUILDER_CEF3_AVAILABLE
class LingCefClient;
CefRefPtr<CefClient> LingCreateCefClient(LingWindowBase* owner, int controlId);
#endif

static ImageListSpec g_imageLists[] = { { L"", 16, 16, L"" } };
static const int g_imageListCount = 0;
static PropertySheetSpec g_propertySheets[] = { { L"", L"", L"" } };
static const int g_propertySheetCount = 0;
static FileDialogSpec g_fileDialogs[] = { { L"", L"", -1, 0, 0, false, false, L"", L"" } };
static const int g_fileDialogCount = 0;
static MenuResourceSpec g_menuResources[] = { { L"", L"", -1, 0, false, L"" } };
static const int g_menuResourceCount = 0;

static ControlSpec g_controls_0[] = {
    { 1001, 0, L"Label", L"标题标签", L"基础控制类命令演示", 20, 16, 500, 34, 20, L"Microsoft YaHei UI", false, false, false, 0, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 0, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(30, 30, 36), true, RGB(255, 255, 255), true, L"", L"", L"", 500, L"", L"text", L"left", 0, 100, 0, 0, 0, L"" },
    { 1002, 0, L"Label", L"状态标签", L"准备中...", 20, 56, 770, 26, 13, L"Microsoft YaHei UI", false, false, false, 0, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 0, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(30, 30, 36), true, RGB(79, 195, 247), true, L"", L"", L"", 500, L"", L"text", L"left", 0, 100, 0, 0, 0, L"" },
    { 1003, 0, L"ListBox", L"演示日志", L"", 20, 92, 770, 390, 12, L"Microsoft YaHei UI", false, false, false, 0, 1, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 4, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(51, 65, 85), 2, 3, RGB(15, 23, 42), false, RGB(226, 232, 240), true, L"", L"", L"", 500, L"", L"", L"", 0, 100, 0, 0, 33554432, L"" },
    { 1004, 0, L"Button", L"运行演示按钮", L"运行完整演示", 20, 500, 180, 40, 13, L"Microsoft YaHei UI", false, false, false, 6, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 0, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(37, 99, 235), false, RGB(255, 255, 255), true, L"", L"", L"", 500, L"", L"push", L"", 0, 100, 0, 0, 0, L"Click=_运行演示按钮_被单击" },
    { 1005, 0, L"Button", L"清空日志按钮", L"清空日志", 220, 500, 130, 40, 13, L"Microsoft YaHei UI", false, false, false, 6, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 0, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(51, 65, 85), false, RGB(255, 255, 255), true, L"", L"", L"", 500, L"", L"push", L"", 0, 100, 0, 0, 0, L"Click=_清空日志按钮_被单击" },
    { 1006, 0, L"Button", L"退出按钮", L"退出", 660, 500, 130, 40, 13, L"Microsoft YaHei UI", false, false, false, 6, 0, RGB(51, 65, 85), RGB(124, 58, 237), RGB(8, 145, 178), RGB(56, 189, 248), 0, 28, 0, 28, 4, 0, 8, RGB(23, 32, 51), RGB(14, 116, 144), 0, RGB(100, 116, 139), 2, 3, RGB(127, 29, 29), false, RGB(255, 255, 255), true, L"", L"", L"", 500, L"", L"push", L"", 0, 100, 0, 0, 0, L"Click=_退出按钮_被单击" }
};

static WindowSpec g_windows[] = {
    { 0, L"MainWindow", L"LingBuilder 基础控制类命令 Demo", 820, 572, RGB(30, 30, 36), RGB(45, 45, 48), RGB(203, 213, 225), 2, L"lingbuilder", L"", L"default", CW_USEDEFAULT, CW_USEDEFAULT, true, true, g_controls_0, 6, L"", RGB(255, 255, 255), RGB(0, 0, 0), L"Microsoft YaHei UI", 11, false, false, false, L"Loaded=创建完毕" }
};

static const int g_windowCount = static_cast<int>(sizeof(g_windows) / sizeof(g_windows[0]));
static const int g_startWindowIndex = 0;

static HWND OpenGeneratedWindow(int windowIndex, int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false);
static HWND OpenGeneratedWindowByName(const wchar_t* windowName, int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false);

static void EnableDpiAwareness() {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (!user32) return;
    using SetProcessDpiAwarenessContextProc = BOOL (WINAPI*)(DPI_AWARENESS_CONTEXT);
    auto setDpiAwarenessContext = reinterpret_cast<SetProcessDpiAwarenessContextProc>(
        GetProcAddress(user32, "SetProcessDpiAwarenessContext")
    );
    if (setDpiAwarenessContext && setDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) return;
    using SetProcessDPIAwareProc = BOOL (WINAPI*)();
    auto setProcessDpiAware = reinterpret_cast<SetProcessDPIAwareProc>(GetProcAddress(user32, "SetProcessDPIAware"));
    if (setProcessDpiAware) setProcessDpiAware();
}

static UINT GetSystemDpiValue() {
    HDC hdc = GetDC(nullptr);
    UINT dpi = hdc ? static_cast<UINT>(GetDeviceCaps(hdc, LOGPIXELSX)) : 96;
    if (hdc) ReleaseDC(nullptr, hdc);
    return dpi ? dpi : 96;
}

static int ScaleForDpi(int value, UINT dpi) {
    return MulDiv(value, static_cast<int>(dpi ? dpi : 96), 96);
}

static HFONT CreateControlFont(const wchar_t* family, int cssPx, bool bold, bool italic, bool underline, UINT dpi) {
    return CreateFontW(
        -MulDiv(cssPx, static_cast<int>(dpi ? dpi : 96), 96),
        0, 0, 0, bold ? FW_BOLD : FW_NORMAL, italic ? TRUE : FALSE, underline ? TRUE : FALSE, FALSE, DEFAULT_CHARSET,
        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
        DEFAULT_PITCH | FF_SWISS, family && family[0] ? family : L"Microsoft YaHei UI"
    );
}

static bool IsType(const ControlSpec& control, const wchar_t* type) {
    return std::wcscmp(control.type, type) == 0;
}

static std::wstring GetCef3DesignerEventId(const wchar_t* eventName) {
    if (eventName && std::wcscmp(eventName, L"浏览器创建完成") == 0) return L"OnAfterCreated";
    if (eventName && std::wcscmp(eventName, L"浏览器即将关闭") == 0) return L"OnBeforeClose";
    if (eventName && std::wcscmp(eventName, L"新窗口打开已中止") == 0) return L"OnBeforePopupAborted";
    if (eventName && std::wcscmp(eventName, L"开发者工具窗口打开前") == 0) return L"OnBeforeDevToolsPopup";
    if (eventName && std::wcscmp(eventName, L"浏览器请求关闭") == 0) return L"DoClose";
    if (eventName && std::wcscmp(eventName, L"新窗口打开前") == 0) return L"OnBeforePopup";
    if (eventName && std::wcscmp(eventName, L"加载状态改变") == 0) return L"OnLoadingStateChange";
    if (eventName && std::wcscmp(eventName, L"开始加载") == 0) return L"LoadStart";
    if (eventName && std::wcscmp(eventName, L"加载完成") == 0) return L"LoadEnd";
    if (eventName && std::wcscmp(eventName, L"加载失败") == 0) return L"LoadError";
    if (eventName && std::wcscmp(eventName, L"地址被改变") == 0) return L"AddressChanged";
    if (eventName && std::wcscmp(eventName, L"标题被改变") == 0) return L"TitleChanged";
    if (eventName && std::wcscmp(eventName, L"网页图标地址改变") == 0) return L"OnFaviconURLChange";
    if (eventName && std::wcscmp(eventName, L"全屏状态改变") == 0) return L"OnFullscreenModeChange";
    if (eventName && std::wcscmp(eventName, L"状态消息改变") == 0) return L"OnStatusMessage";
    if (eventName && std::wcscmp(eventName, L"媒体访问状态改变") == 0) return L"OnMediaAccessChange";
    if (eventName && std::wcscmp(eventName, L"加载进度改变") == 0) return L"OnLoadingProgressChange";
    if (eventName && std::wcscmp(eventName, L"工具提示显示") == 0) return L"OnTooltip";
    if (eventName && std::wcscmp(eventName, L"控制台消息") == 0) return L"OnConsoleMessage";
    if (eventName && std::wcscmp(eventName, L"自动调整大小") == 0) return L"OnAutoResize";
    if (eventName && std::wcscmp(eventName, L"鼠标指针改变") == 0) return L"OnCursorChange";
    if (eventName && std::wcscmp(eventName, L"内容边界改变") == 0) return L"OnContentsBoundsChange";
    if (eventName && std::wcscmp(eventName, L"根窗口屏幕区域查询") == 0) return L"GetRootWindowScreenRect";
    if (eventName && std::wcscmp(eventName, L"上下文菜单显示前") == 0) return L"OnBeforeContextMenu";
    if (eventName && std::wcscmp(eventName, L"上下文菜单已关闭") == 0) return L"OnContextMenuDismissed";
    if (eventName && std::wcscmp(eventName, L"快速菜单已关闭") == 0) return L"OnQuickMenuDismissed";
    if (eventName && std::wcscmp(eventName, L"脚本对话框状态重置") == 0) return L"OnResetDialogState";
    if (eventName && std::wcscmp(eventName, L"脚本对话框已关闭") == 0) return L"OnDialogClosed";
    if (eventName && std::wcscmp(eventName, L"运行上下文菜单") == 0) return L"RunContextMenu";
    if (eventName && std::wcscmp(eventName, L"上下文菜单命令") == 0) return L"OnContextMenuCommand";
    if (eventName && std::wcscmp(eventName, L"运行快速菜单") == 0) return L"RunQuickMenu";
    if (eventName && std::wcscmp(eventName, L"快速菜单命令") == 0) return L"OnQuickMenuCommand";
    if (eventName && std::wcscmp(eventName, L"文件对话框请求") == 0) return L"OnFileDialog";
    if (eventName && std::wcscmp(eventName, L"脚本对话框请求") == 0) return L"OnJSDialog";
    if (eventName && std::wcscmp(eventName, L"离开页面确认请求") == 0) return L"OnBeforeUnloadDialog";
    if (eventName && std::wcscmp(eventName, L"焦点即将移出") == 0) return L"OnTakeFocus";
    if (eventName && std::wcscmp(eventName, L"浏览器获得焦点") == 0) return L"OnGotFocus";
    if (eventName && std::wcscmp(eventName, L"网页可拖动区域改变") == 0) return L"OnDraggableRegionsChanged";
    if (eventName && std::wcscmp(eventName, L"页内查找结果") == 0) return L"OnFindResult";
    if (eventName && std::wcscmp(eventName, L"浏览器请求焦点") == 0) return L"OnSetFocus";
    if (eventName && std::wcscmp(eventName, L"键盘事件预处理") == 0) return L"OnPreKeyEvent";
    if (eventName && std::wcscmp(eventName, L"键盘事件") == 0) return L"OnKeyEvent";
    if (eventName && std::wcscmp(eventName, L"拖入浏览器") == 0) return L"OnDragEnter";
    if (eventName && std::wcscmp(eventName, L"Chrome命令") == 0) return L"OnChromeCommand";
    if (eventName && std::wcscmp(eventName, L"应用菜单项可见性查询") == 0) return L"IsChromeAppMenuItemVisible";
    if (eventName && std::wcscmp(eventName, L"应用菜单项启用查询") == 0) return L"IsChromeAppMenuItemEnabled";
    if (eventName && std::wcscmp(eventName, L"页面动作图标可见性查询") == 0) return L"IsChromePageActionIconVisible";
    if (eventName && std::wcscmp(eventName, L"工具栏按钮可见性查询") == 0) return L"IsChromeToolbarButtonVisible";
    if (eventName && std::wcscmp(eventName, L"下载许可查询") == 0) return L"CanDownload";
    if (eventName && std::wcscmp(eventName, L"下载开始") == 0) return L"OnBeforeDownload";
    if (eventName && std::wcscmp(eventName, L"下载进度更新") == 0) return L"OnDownloadUpdated";
    if (eventName && std::wcscmp(eventName, L"网站权限提示关闭") == 0) return L"OnDismissPermissionPrompt";
    if (eventName && std::wcscmp(eventName, L"媒体权限请求") == 0) return L"OnRequestMediaAccessPermission";
    if (eventName && std::wcscmp(eventName, L"网站权限请求") == 0) return L"OnShowPermissionPrompt";
    if (eventName && std::wcscmp(eventName, L"身份验证请求") == 0) return L"GetAuthCredentials";
    if (eventName && std::wcscmp(eventName, L"证书错误") == 0) return L"OnCertificateError";
    if (eventName && std::wcscmp(eventName, L"客户端证书选择") == 0) return L"OnSelectClientCertificate";
    if (eventName && std::wcscmp(eventName, L"导航请求前") == 0) return L"OnBeforeBrowse";
    if (eventName && std::wcscmp(eventName, L"标签页打开地址请求") == 0) return L"OnOpenURLFromTab";
    if (eventName && std::wcscmp(eventName, L"资源加载前") == 0) return L"OnBeforeResourceLoad";
    if (eventName && std::wcscmp(eventName, L"资源响应到达") == 0) return L"OnResourceResponse";
    if (eventName && std::wcscmp(eventName, L"外部协议执行请求") == 0) return L"OnProtocolExecution";
    if (eventName && std::wcscmp(eventName, L"发送Cookie查询") == 0) return L"CanSendCookie";
    if (eventName && std::wcscmp(eventName, L"保存Cookie查询") == 0) return L"CanSaveCookie";
    if (eventName && std::wcscmp(eventName, L"资源请求处理器查询") == 0) return L"GetResourceRequestHandler";
    if (eventName && std::wcscmp(eventName, L"Cookie过滤器查询") == 0) return L"GetCookieAccessFilter";
    if (eventName && std::wcscmp(eventName, L"自定义资源处理器查询") == 0) return L"GetResourceHandler";
    if (eventName && std::wcscmp(eventName, L"资源响应过滤器查询") == 0) return L"GetResourceResponseFilter";
    if (eventName && std::wcscmp(eventName, L"资源重定向") == 0) return L"OnResourceRedirect";
    if (eventName && std::wcscmp(eventName, L"资源加载完成") == 0) return L"OnResourceLoadComplete";
    if (eventName && std::wcscmp(eventName, L"音频参数请求") == 0) return L"GetAudioParameters";
    if (eventName && std::wcscmp(eventName, L"打印对话框请求") == 0) return L"OnPrintDialog";
    if (eventName && std::wcscmp(eventName, L"打印任务提交") == 0) return L"OnPrintJob";
    if (eventName && std::wcscmp(eventName, L"PDF纸张大小查询") == 0) return L"GetPdfPaperSize";
    if (eventName && std::wcscmp(eventName, L"音频流开始") == 0) return L"OnAudioStreamStarted";
    if (eventName && std::wcscmp(eventName, L"音频流停止") == 0) return L"OnAudioStreamStopped";
    if (eventName && std::wcscmp(eventName, L"音频流错误") == 0) return L"OnAudioStreamError";
    if (eventName && std::wcscmp(eventName, L"打印开始") == 0) return L"OnPrintStart";
    if (eventName && std::wcscmp(eventName, L"打印设置请求") == 0) return L"OnPrintSettings";
    if (eventName && std::wcscmp(eventName, L"打印状态重置") == 0) return L"OnPrintReset";
    if (eventName && std::wcscmp(eventName, L"音频数据包") == 0) return L"OnAudioStreamPacket";
    if (eventName && std::wcscmp(eventName, L"框架创建") == 0) return L"OnFrameCreated";
    if (eventName && std::wcscmp(eventName, L"框架销毁") == 0) return L"OnFrameDestroyed";
    if (eventName && std::wcscmp(eventName, L"框架附加") == 0) return L"OnFrameAttached";
    if (eventName && std::wcscmp(eventName, L"框架分离") == 0) return L"OnFrameDetached";
    if (eventName && std::wcscmp(eventName, L"主框架改变") == 0) return L"OnMainFrameChanged";
    if (eventName && std::wcscmp(eventName, L"渲染视图就绪") == 0) return L"OnRenderViewReady";
    if (eventName && std::wcscmp(eventName, L"渲染进程恢复响应") == 0) return L"OnRenderProcessResponsive";
    if (eventName && std::wcscmp(eventName, L"渲染进程终止") == 0) return L"OnRenderProcessTerminated";
    if (eventName && std::wcscmp(eventName, L"主文档可用") == 0) return L"OnDocumentAvailableInMainFrame";
    if (eventName && std::wcscmp(eventName, L"进程消息收到") == 0) return L"OnProcessMessageReceived";
    if (eventName && std::wcscmp(eventName, L"渲染进程无响应") == 0) return L"OnRenderProcessUnresponsive";
    return eventName ? eventName : L"";
}

static std::wstring GetEventHandler(const ControlSpec& control, const wchar_t* eventName) {
    if (!control.events || !eventName) return L"";
    std::wstring source(control.events);
    std::wstring prefix(eventName);
    prefix += L"=";
    size_t start = 0;
    while (start < source.size()) {
        size_t end = source.find(L'\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (row.rfind(prefix, 0) == 0) return row.substr(prefix.size());
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return L"";
}

static std::wstring GetWindowEventHandler(const WindowSpec& window, const wchar_t* eventName) {
    if (!window.events || !eventName) return L"";
    std::wstring source(window.events);
    std::wstring prefix(eventName);
    prefix += L"=";
    size_t start = 0;
    while (start < source.size()) {
        size_t end = source.find(L'\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (row.rfind(prefix, 0) == 0) return row.substr(prefix.size());
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return L"";
}

static std::vector<std::wstring> SplitControlData(const wchar_t* data) {
    std::vector<std::wstring> rows;
    if (!data) return rows;
    std::wstring source(data);
    size_t start = 0;
    while (start <= source.size()) {
        size_t end = source.find(L'\n', start);
        std::wstring row = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        if (!row.empty()) rows.push_back(row);
        if (end == std::wstring::npos) break;
        start = end + 1;
    }
    return rows;
}

static std::vector<std::vector<std::wstring>> DecodeControlRecords(const wchar_t* data, int fieldCount) {
    std::vector<std::vector<std::wstring>> records;
    if (!data || fieldCount <= 0) return records;
    std::wstring source(data);
    size_t offset = 0;
    while (offset < source.size()) {
        std::vector<std::wstring> record;
        for (int fieldIndex = 0; fieldIndex < fieldCount; ++fieldIndex) {
            size_t colon = source.find(L':', offset);
            if (colon == std::wstring::npos || colon == offset) return records;
            size_t length = 0;
            for (size_t index = offset; index < colon; ++index) {
                if (source[index] < L'0' || source[index] > L'9') return records;
                length = length * 10 + static_cast<size_t>(source[index] - L'0');
            }
            offset = colon + 1;
            if (offset + length > source.size()) return records;
            record.push_back(source.substr(offset, length));
            offset += length;
        }
        records.push_back(std::move(record));
    }
    return records;
}

static bool ParseDateTimeValue(const wchar_t* value, const wchar_t* format, SYSTEMTIME& result) {
    if (!value || !value[0]) return false;
    if (format && wcscmp(format, L"time") == 0) {
        unsigned int hour = 0, minute = 0, second = 0;
        int fields = swscanf_s(value, L"%u:%u:%u", &hour, &minute, &second);
        if (fields < 2 || hour > 23 || minute > 59 || second > 59) return false;
        GetLocalTime(&result);
        result.wHour = static_cast<WORD>(hour);
        result.wMinute = static_cast<WORD>(minute);
        result.wSecond = static_cast<WORD>(second);
        result.wMilliseconds = 0;
        return true;
    }
    unsigned int year = 0, month = 0, day = 0;
    if (swscanf_s(value, L"%u-%u-%u", &year, &month, &day) != 3) return false;
    if (year < 1601 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    result = {}; result.wYear = static_cast<WORD>(year); result.wMonth = static_cast<WORD>(month); result.wDay = static_cast<WORD>(day);
    return true;
}

static WORD ParseHotKeyValue(const wchar_t* value) {
    if (!value || !value[0]) return 0;
    std::wstring text(value);
    std::transform(text.begin(), text.end(), text.begin(), ::towupper);
    BYTE modifiers = 0;
    if (text.find(L"CTRL+") != std::wstring::npos) modifiers |= HOTKEYF_CONTROL;
    if (text.find(L"ALT+") != std::wstring::npos) modifiers |= HOTKEYF_ALT;
    if (text.find(L"SHIFT+") != std::wstring::npos) modifiers |= HOTKEYF_SHIFT;
    size_t separator = text.find_last_of(L'+');
    std::wstring key = separator == std::wstring::npos ? text : text.substr(separator + 1);
    BYTE virtualKey = key.size() == 1 ? static_cast<BYTE>(key[0]) : 0;
    if (key == L"F1") virtualKey = VK_F1;
    else if (key == L"F2") virtualKey = VK_F2;
    else if (key == L"F3") virtualKey = VK_F3;
    else if (key == L"F4") virtualKey = VK_F4;
    else if (key == L"F5") virtualKey = VK_F5;
    else if (key == L"F6") virtualKey = VK_F6;
    else if (key == L"F7") virtualKey = VK_F7;
    else if (key == L"F8") virtualKey = VK_F8;
    else if (key == L"F9") virtualKey = VK_F9;
    else if (key == L"F10") virtualKey = VK_F10;
    else if (key == L"F11") virtualKey = VK_F11;
    else if (key == L"F12") virtualKey = VK_F12;
    return MAKEWORD(virtualKey, modifiers);
}

static bool TextEquals(const wchar_t* value, const wchar_t* expected);

static HBITMAP LoadWicBitmap(const wchar_t* path, int requestedWidth, int requestedHeight, const wchar_t* stretchMode) {
    if (!path || !path[0]) return nullptr;
    IWICImagingFactory* factory = nullptr;
    IWICBitmapDecoder* decoder = nullptr;
    IWICBitmapFrameDecode* frame = nullptr;
    IWICBitmapSource* source = nullptr;
    IWICBitmapScaler* scaler = nullptr;
    IWICFormatConverter* converter = nullptr;
    HBITMAP bitmap = nullptr;
    UINT sourceWidth = 0, sourceHeight = 0, targetWidth = 0, targetHeight = 0;
    BITMAPINFO info = {};
    void* pixels = nullptr;
    if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory)))) goto cleanup;
    if (FAILED(factory->CreateDecoderFromFilename(path, nullptr, GENERIC_READ, WICDecodeMetadataCacheOnLoad, &decoder))) goto cleanup;
    if (FAILED(decoder->GetFrame(0, &frame))) goto cleanup;
    if (FAILED(frame->GetSize(&sourceWidth, &sourceHeight)) || sourceWidth == 0 || sourceHeight == 0) goto cleanup;
    targetWidth = sourceWidth; targetHeight = sourceHeight;
    if (!TextEquals(stretchMode, L"none") && requestedWidth > 0 && requestedHeight > 0) {
        double scaleX = static_cast<double>(requestedWidth) / sourceWidth;
        double scaleY = static_cast<double>(requestedHeight) / sourceHeight;
        if (TextEquals(stretchMode, L"fill")) {
            targetWidth = requestedWidth; targetHeight = requestedHeight;
        } else {
            double scale = TextEquals(stretchMode, L"uniformToFill") ? std::max(scaleX, scaleY) : std::min(scaleX, scaleY);
            targetWidth = std::max(1u, static_cast<UINT>(sourceWidth * scale));
            targetHeight = std::max(1u, static_cast<UINT>(sourceHeight * scale));
        }
    }
    source = frame; source->AddRef();
    if (targetWidth != sourceWidth || targetHeight != sourceHeight) {
        if (FAILED(factory->CreateBitmapScaler(&scaler))) goto cleanup;
        if (FAILED(scaler->Initialize(frame, targetWidth, targetHeight, WICBitmapInterpolationModeFant))) goto cleanup;
        source->Release(); source = scaler; source->AddRef();
    }
    if (FAILED(factory->CreateFormatConverter(&converter))) goto cleanup;
    if (FAILED(converter->Initialize(source, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, nullptr, 0, WICBitmapPaletteTypeCustom))) goto cleanup;
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = static_cast<LONG>(targetWidth);
    info.bmiHeader.biHeight = -static_cast<LONG>(targetHeight);
    info.bmiHeader.biPlanes = 1; info.bmiHeader.biBitCount = 32; info.bmiHeader.biCompression = BI_RGB;
    bitmap = CreateDIBSection(nullptr, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
    if (!bitmap || !pixels) goto cleanup;
    if (FAILED(converter->CopyPixels(nullptr, targetWidth * 4, targetWidth * targetHeight * 4, static_cast<BYTE*>(pixels)))) {
        DeleteObject(bitmap); bitmap = nullptr;
    }
cleanup:
    if (converter) converter->Release();
    if (scaler) scaler->Release();
    if (source) source->Release();
    if (frame) frame->Release();
    if (decoder) decoder->Release();
    if (factory) factory->Release();
    return bitmap;
}

static HBITMAP RenderGdiPlusImage(Gdiplus::Image* image, int requestedWidth, int requestedHeight, const wchar_t* stretchMode, COLORREF background) {
    if (!image || image->GetLastStatus() != Gdiplus::Ok || requestedWidth <= 0 || requestedHeight <= 0) return nullptr;
    const UINT sourceWidth = image->GetWidth();
    const UINT sourceHeight = image->GetHeight();
    if (!sourceWidth || !sourceHeight) return nullptr;
    Gdiplus::Bitmap canvas(requestedWidth, requestedHeight, PixelFormat32bppARGB);
    Gdiplus::Graphics graphics(&canvas);
    graphics.Clear(Gdiplus::Color(255, GetRValue(background), GetGValue(background), GetBValue(background)));
    graphics.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic);
    float drawWidth = static_cast<float>(sourceWidth);
    float drawHeight = static_cast<float>(sourceHeight);
    if (!TextEquals(stretchMode, L"none")) {
        const float scaleX = static_cast<float>(requestedWidth) / sourceWidth;
        const float scaleY = static_cast<float>(requestedHeight) / sourceHeight;
        if (TextEquals(stretchMode, L"fill")) {
            drawWidth = static_cast<float>(requestedWidth);
            drawHeight = static_cast<float>(requestedHeight);
        } else {
            const float scale = TextEquals(stretchMode, L"uniformToFill") ? std::max(scaleX, scaleY) : std::min(scaleX, scaleY);
            drawWidth = sourceWidth * scale;
            drawHeight = sourceHeight * scale;
        }
    }
    const float drawX = (requestedWidth - drawWidth) / 2.0f;
    const float drawY = (requestedHeight - drawHeight) / 2.0f;
    graphics.DrawImage(image, Gdiplus::RectF(drawX, drawY, drawWidth, drawHeight));
    HBITMAP bitmap = nullptr;
    canvas.GetHBITMAP(Gdiplus::Color(255, GetRValue(background), GetGValue(background), GetBValue(background)), &bitmap);
    return bitmap;
}

static bool TextEquals(const wchar_t* value, const wchar_t* expected) {
    return value && expected && std::wcscmp(value, expected) == 0;
}

struct RichEditStreamState { std::string bytes; size_t offset = 0; };
static DWORD CALLBACK StreamRichEditData(DWORD_PTR cookie, LPBYTE buffer, LONG count, LONG* written) {
    RichEditStreamState* state = reinterpret_cast<RichEditStreamState*>(cookie);
    if (!state || !buffer || !written) return 1;
    size_t remaining = state->bytes.size() - state->offset;
    size_t amount = std::min(remaining, static_cast<size_t>(count));
    if (amount > 0) std::memcpy(buffer, state->bytes.data() + state->offset, amount);
    state->offset += amount; *written = static_cast<LONG>(amount); return 0;
}

static std::vector<BYTE> BuildPropertySheetTemplate() {
    std::vector<BYTE> bytes(sizeof(DLGTEMPLATE) + sizeof(WORD) * 3, 0);
    DLGTEMPLATE* dialog = reinterpret_cast<DLGTEMPLATE*>(bytes.data());
    dialog->style = WS_CHILD | WS_VISIBLE | DS_CONTROL; dialog->dwExtendedStyle = 0; dialog->cdit = 0;
    dialog->x = 0; dialog->y = 0; dialog->cx = 250; dialog->cy = 170;
    return bytes;
}

static INT_PTR CALLBACK GeneratedPropertySheetPageProc(HWND dialog, UINT message, WPARAM, LPARAM lParam) {
    if (message == WM_INITDIALOG) {
        PROPSHEETPAGEW* page = reinterpret_cast<PROPSHEETPAGEW*>(lParam);
        PropertySheetPageContext* context = page ? reinterpret_cast<PropertySheetPageContext*>(page->lParam) : nullptr;
        SetWindowLongPtrW(dialog, DWLP_USER, reinterpret_cast<LONG_PTR>(context));
        if (context) CreateWindowExW(0, L"STATIC", context->content, WS_CHILD | WS_VISIBLE | SS_LEFT,
            12, 12, 330, 190, dialog, nullptr, GetModuleHandleW(nullptr), nullptr);
        if (context && context->initialize) context->initialize(context->pageOwner, dialog);
        return TRUE;
    }
    if (message == WM_NOTIFY) {
        NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
        if (header && header->code == PSN_APPLY) {
            PropertySheetPageContext* context = reinterpret_cast<PropertySheetPageContext*>(GetWindowLongPtrW(dialog, DWLP_USER));
            if (context && context->applied) context->applied(context->eventOwner, context->resourceId);
            SetWindowLongPtrW(dialog, DWLP_MSGRESULT, PSNRET_NOERROR); return TRUE;
        }
    }
    return FALSE;
}

static bool IsPlacement(const wchar_t* placement, const wchar_t* first, const wchar_t* second = nullptr, const wchar_t* third = nullptr) {
    return TextEquals(placement, first) || TextEquals(placement, second) || TextEquals(placement, third);
}

static void ResolveWindowPlacement(
    const WindowSpec& spec,
    int windowWidth,
    int windowHeight,
    const wchar_t* placementOverride,
    int xOverride,
    int yOverride,
    bool hasCustomPosition,
    int& x,
    int& y
) {
    const wchar_t* placement = placementOverride && placementOverride[0] ? placementOverride : spec.openPlacement;
    if (!placement || placement[0] == 0 || IsPlacement(placement, L"default", L"默认", L"系统默认")) return;

    const bool customPlacement = hasCustomPosition || IsPlacement(placement, L"custom", L"自定义", L"自定义坐标");
    if (customPlacement) {
        x = hasCustomPosition ? xOverride : spec.openX;
        y = hasCustomPosition ? yOverride : spec.openY;
        return;
    }

    RECT workArea = {};
    if (!SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0)) return;

    if (IsPlacement(placement, L"center", L"居中", L"居中显示")) {
        x = workArea.left + ((workArea.right - workArea.left) - windowWidth) / 2;
        y = workArea.top + ((workArea.bottom - workArea.top) - windowHeight) / 2;
        return;
    }
    if (IsPlacement(placement, L"top-left", L"left-top", L"左上角")) {
        x = workArea.left;
        y = workArea.top;
        return;
    }
    if (IsPlacement(placement, L"top-right", L"right-top", L"右上角")) {
        x = workArea.right - windowWidth;
        y = workArea.top;
        return;
    }
    if (IsPlacement(placement, L"bottom-left", L"left-bottom", L"左下角")) {
        x = workArea.left;
        y = workArea.bottom - windowHeight;
        return;
    }
    if (IsPlacement(placement, L"bottom-right", L"right-bottom", L"右下角")) {
        x = workArea.right - windowWidth;
        y = workArea.bottom - windowHeight;
    }
}



class LingWindowBase {
public:
    explicit LingWindowBase(const WindowSpec& spec)
        : spec_(spec),
          hwnd_(nullptr),
          windowBrush_(nullptr),
          menuBrush_(nullptr),
          menuFont_(nullptr),
          dpi_(96),
          wsSession_(nullptr),
          wsConnect_(nullptr),
          wsRequest_(nullptr),
          wsSocket_(nullptr),
          socketsStarted_(false),
          httpListenSocket_(INVALID_SOCKET),
          httpClientSocket_(INVALID_SOCKET),
          wsServerListenSocket_(INVALID_SOCKET),
          wsServerClientSocket_(INVALID_SOCKET) {}

    // 当前项目暂无独立功能库。

    virtual ~LingWindowBase() {
        线程_等待全部();
        WS_关闭();
        HTTP_关闭服务();
        WSS_关闭服务();
        EdgeView_关闭();
        if (menuFont_) {
            DeleteObject(menuFont_);
            menuFont_ = nullptr;
        }
        if (socketsStarted_) {
            WSACleanup();
            socketsStarted_ = false;
        }
    }

    HWND Open(int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        dpi_ = GetSystemDpiValue();
        DWORD windowStyle = WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
        if (!spec_.resizable) windowStyle &= ~WS_THICKFRAME;
        if (!spec_.maximizable) windowStyle &= ~WS_MAXIMIZEBOX;
        RECT rect = { 0, 0, ScaleForDpi(spec_.width, dpi_), ScaleForDpi(spec_.height, dpi_) };
        BOOL hasMenu = spec_.menuItems && spec_.menuItems[0] ? TRUE : FALSE;
        AdjustWindowRectEx(&rect, windowStyle, hasMenu, 0);
        int windowWidth = rect.right - rect.left;
        int windowHeight = rect.bottom - rect.top;
        int windowX = CW_USEDEFAULT;
        int windowY = CW_USEDEFAULT;
        ResolveWindowPlacement(spec_, windowWidth, windowHeight, placement, x, y, hasCustomPosition, windowX, windowY);

        hwnd_ = CreateWindowExW(
            0,
            GENERATED_WINDOW_CLASS,
            spec_.title,
            windowStyle,
            windowX,
            windowY,
            windowWidth,
            windowHeight,
            nullptr,
            CreateMenuForWindow(),
            g_instance,
            this
        );

        if (!hwnd_) return nullptr;
        ApplyWindowAppearance();
        ShowWindow(hwnd_, showCommand);
        UpdateWindow(hwnd_);
        SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        SetForegroundWindow(hwnd_);
        BringWindowToTop(hwnd_);
        SetFocus(hwnd_);
        SetTimer(hwnd_, 0x4C42, 900, nullptr);
        return hwnd_;
    }

    void AttachPropertyPage(HWND host) {
        hwnd_ = host; dpi_ = GetSystemDpiValue(); CreateImageLists(); RebuildControls();
    }

    void ReleasePropertyPage() {
        DestroyControls(); hwnd_ = nullptr;
    }

    static LingWindowBase* FromMessageWindow(HWND messageWindow) {
        if (!messageWindow) return nullptr;
        HWND root = GetAncestor(messageWindow, GA_ROOT);
        if (!root) root = messageWindow;
        return reinterpret_cast<LingWindowBase*>(GetWindowLongPtrW(root, GWLP_USERDATA));
    }

    bool PreTranslateKeyboardMessage(const MSG& message) {
        const wchar_t* eventName = nullptr;
        if (message.message == WM_KEYDOWN || message.message == WM_SYSKEYDOWN) eventName = L"KeyDown";
        else if (message.message == WM_KEYUP || message.message == WM_SYSKEYUP) eventName = L"KeyUp";
        else if (message.message == WM_CHAR || message.message == WM_SYSCHAR) eventName = L"TextInput";
        if (!eventName || GetWindowEventHandler(spec_, eventName).empty()) return false;

        eventKeyCode_ = static_cast<int>(message.wParam);
        eventCtrlDown_ = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
        eventShiftDown_ = (GetKeyState(VK_SHIFT) & 0x8000) != 0;
        eventAltDown_ = (GetKeyState(VK_MENU) & 0x8000) != 0;
        eventCharacter_.clear();

        if (message.message == WM_CHAR || message.message == WM_SYSCHAR) {
            wchar_t character = static_cast<wchar_t>(message.wParam);
            if (character >= 0xD800 && character <= 0xDBFF) {
                pendingHighSurrogate_ = character;
                return false;
            }
            if (pendingHighSurrogate_) {
                if (character >= 0xDC00 && character <= 0xDFFF) eventCharacter_.push_back(pendingHighSurrogate_);
                pendingHighSurrogate_ = 0;
            }
            eventCharacter_.push_back(character);
        }

        keyboardEventActive_ = true;
        keyboardHandled_ = false;
        DispatchWindowEvent(eventName);
        keyboardEventActive_ = false;
        return keyboardHandled_;
    }

protected:
    const WindowSpec& spec_;
    HWND hwnd_;
    std::vector<HWND> tooltipWindows_;
    std::vector<RuntimeControl> runtimeControls_;
    std::vector<RuntimeTabPage> tabPages_;
    std::map<std::wstring, HIMAGELIST> imageLists_;
    std::map<int, HIMAGELIST> listViewSizingImageLists_;
    HBRUSH windowBrush_;
    HBRUSH menuBrush_;
    HFONT menuFont_;
    HICON largeWindowIcon_ = nullptr;
    HICON smallWindowIcon_ = nullptr;
    bool ownsWindowIcons_ = false;
    UINT dpi_;
    bool closingEventActive_ = false;
    bool closingCancelled_ = false;
    bool keyboardEventActive_ = false;
    bool keyboardHandled_ = false;
    bool closedDispatched_ = false;
    bool active_ = false;
    bool visible_ = false;
    bool sizeBaselineReady_ = false;
    bool moveBaselineReady_ = false;
    bool windowStateBaselineReady_ = false;
    int listScrollDragControlId_ = 0;
    int listScrollDragOffset_ = 0;
    std::map<int, int> listWheelDeltaRemainders_;
    int eventWidth_ = 0;
    int eventHeight_ = 0;
    int eventX_ = 0;
    int eventY_ = 0;
    int windowState_ = 0;
    int eventKeyCode_ = 0;
    bool eventCtrlDown_ = false;
    bool eventShiftDown_ = false;
    bool eventAltDown_ = false;
    std::wstring eventCharacter_;
    wchar_t pendingHighSurrogate_ = 0;
    std::vector<std::wstring> droppedFiles_;
    std::map<std::wstring, std::vector<std::wstring>> fileDialogFiles_;
    std::map<std::wstring, std::wstring> lastMenuItems_;
    HINTERNET wsSession_;
    HINTERNET wsConnect_;
    HINTERNET wsRequest_;
    HINTERNET wsSocket_;
    std::wstring wsLastMessage_;
    bool socketsStarted_;
    SOCKET httpListenSocket_;
    SOCKET httpClientSocket_;
    SOCKET wsServerListenSocket_;
    SOCKET wsServerClientSocket_;
    std::wstring httpLastRequest_;
    std::wstring wssLastMessage_;
    FINDREPLACEW findReplace_ = {};
    wchar_t findBuffer_[256] = {};
    wchar_t replaceBuffer_[256] = {};
    HWND findDialog_ = nullptr;
    int lastDialogStatus_ = 0;
    int lastToolbarCommand_ = 0;
    int lastStatusPart_ = -1;
    int nextToolbarCommandId_ = 60000;
    std::map<int, int> toolbarCommandOwners_;
    std::map<int, int> toolbarCommandValues_;
    std::wstring lastFindAction_;
    std::wstring lastFindText_;
    std::wstring lastReplaceText_;
    RECT lastPageMargins_ = {};
    std::vector<std::thread> threadTasks_;
    std::mutex threadTasksMutex_;
    std::atomic<int> activeThreadTasks_{0};
    std::atomic<int> nextThreadTaskId_{1};
    struct ThreadUiUpdate { int kind; std::wstring controlName; std::wstring text; };
    std::vector<ThreadUiUpdate> threadUiQueue_;
    std::mutex threadUiMutex_;
    struct AsyncWebResult {
        std::wstring handler;
        std::wstring text;
        std::wstring cookies;
        std::wstring headers;
        std::wstring error;
        int statusCode = 0;
        bool completed = false;
        bool cancelled = false;
    };
    std::map<int, AsyncWebResult> asyncWebResults_;
    std::mutex asyncWebMutex_;
    std::mutex asyncWebExecutionMutex_;
    std::atomic<int> nextAsyncWebRequestId_{1};
    int currentAsyncWebRequestId_ = 0;
    struct BatchProgress {
        std::atomic<int> completed{0};
        std::atomic<int> threadsDone{0};
        int totalTasks = 0;
        int totalThreads = 0;
        int lastLvSample = 0;
        std::wstring lvName;
        std::wstring logName;
        std::wstring stName;
        bool active = false;
    };
    std::unique_ptr<BatchProgress> batchProgress_;
    struct EdgeViewInstance {
        int id = 0;
        int controlId = 0;
        HWND host = nullptr;
        bool ownsHost = false;
        std::wstring cacheDirectory;
        std::wstring proxyServer;
        std::wstring lastEvent;
        std::wstring lastEventData;
        std::map<std::wstring, std::wstring> handlers;
        std::map<std::wstring, UINT64> eventCounts;
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment;
        Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller;
        Microsoft::WRL::ComPtr<ICoreWebView2> webView;
        std::vector<Microsoft::WRL::ComPtr<IUnknown>> eventSources;
#endif
    };
#if LINGBUILDER_EDGEVIEW_AVAILABLE
    HMODULE edgeViewLoader_ = nullptr;
#endif
    std::map<int, std::unique_ptr<EdgeViewInstance>> edgeViews_;
    std::wstring edgeViewGlobalProxy_;

    struct CefBrowserInstance {
        int controlId = 0;
        HWND host = nullptr;
        std::wstring url;
        std::wstring cacheDirectory;
        std::wstring proxyServer;
        std::wstring userAgent;
        std::wstring lastEvent;
        std::wstring lastEventData;
        std::wstring currentTitle;
        std::wstring currentUrl;
        std::map<std::wstring, std::wstring> eventFields;
        int eventAction = 0;
        std::wstring eventResultText;
        bool enableJs = true;
        bool enableDevTools = true;
        bool loadImages = true;
        bool enableWebGL = false;
        bool muteAudio = false;
        bool created = false;
        bool canGoBack = false;
        bool canGoForward = false;
        bool isLoading = false;
        std::map<std::wstring, std::wstring> handlers;
#if LINGBUILDER_CEF3_AVAILABLE
        CefRefPtr<CefBrowser> browser;
#endif
    };
    std::map<int, std::unique_ptr<CefBrowserInstance>> cefBrowsers_;
    bool cefInitialized_ = false;

    virtual void OnWindowCreated() { EdgeView_创建控件(nullptr); CEF3_创建(nullptr); DispatchWindowEvent(L"Loaded"); }
    virtual void DispatchWindowEvent(const wchar_t* eventName) {
        std::wstring handler = GetWindowEventHandler(spec_, eventName);
        if (handler.empty()) return;
        std::wstring message = L"窗口事件未绑定到中文处理器：";
        message += handler;
        调试输出(message.c_str());
    }
    virtual void DispatchDesignerResourceEvent(const wchar_t*, const wchar_t*) {}

    virtual void DispatchAsyncWebEvent(const wchar_t* handler) {
        std::wstring message = L"网页异步访问完成处理器未绑定：";
        message += handler ? handler : L"";
        调试输出(message.c_str());
    }

    virtual void DispatchEdgeViewEvent(const wchar_t* handler, int instanceId, const wchar_t* eventName, const wchar_t* data) {
        std::wstring message = L"EdgeView 事件未绑定到中文处理器：";
        message += handler ? handler : L"";
        message += L" / ";
        message += eventName ? eventName : L"";
        调试输出(message.c_str());
        (void)instanceId; (void)data;
    }

    virtual void DispatchLingEvent(const ControlSpec& control, const wchar_t* eventName) {
        std::wstring handler = GetEventHandler(control, eventName);
        if (handler.empty()) return;
        std::wstring message = L"已触发中文 C++ 事件：";
        message += handler;
        MessageBoxW(hwnd_, message.c_str(), L"LingBuilder 中文 C++", MB_OK | MB_ICONINFORMATION);
    }

    bool IsUploadControl(const ControlSpec& control) const {
        return IsType(control, L"Upload") || IsType(control, L"DragUpload");
    }

    void RefreshUploadFileList(RuntimeControl& runtime) {
        HWND list = GetDlgItem(runtime.hwnd, 2);
        if (!list) return;
        SendMessageW(list, LB_RESETCONTENT, 0, 0);
        for (const auto& path : runtime.uploadFiles) {
            size_t separator = path.find_last_of(L"\\/");
            const wchar_t* name = separator == std::wstring::npos ? path.c_str() : path.c_str() + separator + 1;
            SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(name));
        }
    }

    bool UploadFileMatches(const ControlSpec& control, const std::wstring& path) const {
        std::wstring accept = control.data2 ? control.data2 : L"*.*";
        if (accept.empty() || accept == L"*" || accept == L"*.*") return true;
        std::wstring lowerPath = path;
        std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(), [](wchar_t value) { return static_cast<wchar_t>(towlower(value)); });
        size_t start = 0;
        while (start <= accept.size()) {
            size_t end = accept.find_first_of(L",;|", start);
            std::wstring token = accept.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
            while (!token.empty() && iswspace(token.front())) token.erase(token.begin());
            while (!token.empty() && iswspace(token.back())) token.pop_back();
            std::transform(token.begin(), token.end(), token.begin(), [](wchar_t value) { return static_cast<wchar_t>(towlower(value)); });
            if (token == L"*" || token == L"*.*") return true;
            if (token.rfind(L"*.", 0) == 0) token.erase(token.begin());
            if (!token.empty() && token.front() != L'.' && token.find(L'/') == std::wstring::npos) token.insert(token.begin(), L'.');
            if (!token.empty() && token.front() == L'.' && lowerPath.size() >= token.size()
                && lowerPath.compare(lowerPath.size() - token.size(), token.size(), token) == 0) return true;
            start = end == std::wstring::npos ? accept.size() + 1 : end + 1;
        }
        return false;
    }

    bool AddUploadFiles(const ControlSpec& control, RuntimeControl& runtime, const std::vector<std::wstring>& files) {
        bool changed = false;
        for (const auto& path : files) {
            if (path.empty() || !UploadFileMatches(control, path)) continue;
            if (control.maximum > 0) {
                WIN32_FILE_ATTRIBUTE_DATA info = {};
                if (GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &info)) {
                    ULARGE_INTEGER size = {}; size.HighPart = info.nFileSizeHigh; size.LowPart = info.nFileSizeLow;
                    if (size.QuadPart > static_cast<ULONGLONG>(control.maximum) * 1024ull) continue;
                }
            }
            if (!(control.flags & CF_MULTIPLE)) runtime.uploadFiles.clear();
            if (std::find(runtime.uploadFiles.begin(), runtime.uploadFiles.end(), path) == runtime.uploadFiles.end()) {
                if (control.minimum > 0 && static_cast<int>(runtime.uploadFiles.size()) >= control.minimum) break;
                runtime.uploadFiles.push_back(path);
                changed = true;
            }
            if (!(control.flags & CF_MULTIPLE)) break;
        }
        if (!changed) return false;
        RefreshUploadFileList(runtime);
        DispatchLingEvent(control, L"FilesSelected");
        if (control.selectedIndex & 1) DispatchLingEvent(control, L"UploadAction");
        return true;
    }

    bool OpenUploadFileDialog(const ControlSpec& control, RuntimeControl& runtime) {
        HRESULT initialized = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        IFileOpenDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
        if (FAILED(result) || !dialog) { if (SUCCEEDED(initialized)) CoUninitialize(); return false; }
        FILEOPENDIALOGOPTIONS options = FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST;
        if (control.flags & CF_MULTIPLE) options |= FOS_ALLOWMULTISELECT;
        dialog->SetOptions(options);
        std::wstring accept = control.data2 && control.data2[0] ? control.data2 : L"*.*";
        std::wstring pattern;
        size_t patternStart = 0;
        while (patternStart <= accept.size()) {
            size_t patternEnd = accept.find_first_of(L",;|", patternStart);
            std::wstring token = accept.substr(patternStart, patternEnd == std::wstring::npos ? std::wstring::npos : patternEnd - patternStart);
            while (!token.empty() && iswspace(token.front())) token.erase(token.begin());
            while (!token.empty() && iswspace(token.back())) token.pop_back();
            if (!token.empty()) {
                if (token.front() == L'.') token.insert(token.begin(), L'*');
                if (!pattern.empty()) pattern += L';';
                pattern += token;
            }
            patternStart = patternEnd == std::wstring::npos ? accept.size() + 1 : patternEnd + 1;
        }
        if (pattern.empty()) pattern = L"*.*";
        COMDLG_FILTERSPEC filters[] = {{ L"允许的文件", pattern.c_str() }, { L"所有文件", L"*.*" }};
        dialog->SetFileTypes(2, filters);
        result = dialog->Show(hwnd_);
        std::vector<std::wstring> files;
        if (SUCCEEDED(result)) {
            IShellItemArray* items = nullptr;
            if (SUCCEEDED(dialog->GetResults(&items)) && items) {
                DWORD count = 0; items->GetCount(&count);
                for (DWORD index = 0; index < count; ++index) {
                    IShellItem* item = nullptr; PWSTR path = nullptr;
                    if (SUCCEEDED(items->GetItemAt(index, &item)) && item && SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                        files.emplace_back(path); CoTaskMemFree(path);
                    }
                    if (item) item->Release();
                }
                items->Release();
            }
        }
        dialog->Release();
        if (SUCCEEDED(initialized)) CoUninitialize();
        return AddUploadFiles(control, runtime, files);
    }

    bool 上传_打开文件选择(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) ? OpenUploadFileDialog(*control, *runtime) : false;
    }
    bool 上传_开始(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsUploadControl(*control)) return false;
        DispatchLingEvent(*control, L"UploadAction"); return true;
    }
    bool 上传_清空文件(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsUploadControl(*control)) return false;
        runtime->uploadFiles.clear(); RefreshUploadFileList(*runtime); return true;
    }
    int 上传_取文件数量(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) ? static_cast<int>(runtime->uploadFiles.size()) : 0;
    }
    std::wstring 上传_取文件(const wchar_t* controlName, int index) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsUploadControl(*control) && index >= 0 && index < static_cast<int>(runtime->uploadFiles.size()) ? runtime->uploadFiles[static_cast<size_t>(index)] : L"";
    }

    void InitializeUploadControl(const ControlSpec& control, RuntimeControl& runtime) {
        auto labels = DecodeControlRecords(control.option2, 2);
        const wchar_t* triggerText = !labels.empty() && !labels[0][0].empty() ? labels[0][0].c_str() : L"选择文件";
        const wchar_t* submitText = !labels.empty() && !labels[0][1].empty() ? labels[0][1].c_str() : L"上传";
        int padding = ScaleForDpi(10, dpi_);
        int buttonHeight = ScaleForDpi(32, dpi_);
        int width = ScaleForDpi(control.width, dpi_);
        int height = ScaleForDpi(control.height, dpi_);
        int cursorY = padding;
        if (control.selectedIndex & 4) {
            HWND tip = CreateWindowExW(0, L"STATIC", control.option1 && control.option1[0] ? control.option1 : (IsType(control, L"DragUpload") ? L"将文件拖到这里，或点击选择文件" : L"支持点击选择文件"),
                WS_CHILD | WS_VISIBLE | SS_LEFT, padding, cursorY, std::max(20, width - padding * 2), ScaleForDpi(38, dpi_), runtime.hwnd, reinterpret_cast<HMENU>(4), g_instance, nullptr);
            if (tip && runtime.font) SendMessageW(tip, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
            cursorY += ScaleForDpi(42, dpi_);
        }
        HWND trigger = CreateWindowExW(0, L"BUTTON", triggerText, WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
            padding, cursorY, std::min(ScaleForDpi(130, dpi_), std::max(20, width - padding * 2)), buttonHeight,
            runtime.hwnd, reinterpret_cast<HMENU>(1), g_instance, nullptr);
        if (trigger && runtime.font) SendMessageW(trigger, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        cursorY += buttonHeight + padding;
        int actionSpace = (control.selectedIndex & 8) ? buttonHeight + padding : 0;
        if (control.selectedIndex & 2) {
            HWND list = CreateWindowExW(WS_EX_CLIENTEDGE, L"LISTBOX", L"", WS_CHILD | WS_VISIBLE | WS_VSCROLL | LBS_NOINTEGRALHEIGHT,
                padding, cursorY, std::max(20, width - padding * 2), std::max(28, height - cursorY - actionSpace - padding),
                runtime.hwnd, reinterpret_cast<HMENU>(2), g_instance, nullptr);
            if (list && runtime.font) SendMessageW(list, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        }
        if (control.selectedIndex & 8) {
            HWND submit = CreateWindowExW(0, L"BUTTON", submitText, WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
                std::max(padding, width - padding - ScaleForDpi(130, dpi_)), std::max(cursorY, height - padding - buttonHeight),
                std::min(ScaleForDpi(130, dpi_), std::max(20, width - padding * 2)), buttonHeight,
                runtime.hwnd, reinterpret_cast<HMENU>(3), g_instance, nullptr);
            if (submit && runtime.font) SendMessageW(submit, WM_SETFONT, reinterpret_cast<WPARAM>(runtime.font), TRUE);
        }
        auto initialFiles = DecodeControlRecords(control.data, 1);
        for (const auto& row : initialFiles) if (!row.empty() && !row[0].empty()) runtime.uploadFiles.push_back(row[0]);
        RefreshUploadFileList(runtime);
    }

    void 写入调试输出(const wchar_t* text) {
        if (!text || text[0] == 0) return;
        OutputDebugStringW(text);
        OutputDebugStringW(L"\n");
        int sizeNeeded = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
        if (sizeNeeded > 0) {
            std::vector<char> utf8(sizeNeeded);
            WideCharToMultiByte(CP_UTF8, 0, text, -1, utf8.data(), sizeNeeded, nullptr, nullptr);
            std::printf("[调试输出] %s\n", utf8.data());
            std::fflush(stdout);
        }
    }

    static void 追加调试参数(std::wstring& output, bool value) { output += value ? L"真" : L"假"; }
    static void 追加调试参数(std::wstring& output, const wchar_t* value) { output += value ? value : L"(空)"; }
    static void 追加调试参数(std::wstring& output, const std::wstring& value) { output += value; }
    template <typename T> static void 追加调试参数(std::wstring& output, const T& value) {
        std::wostringstream stream;
        stream << value;
        output += stream.str();
    }
    template <typename... Args> void 调试输出(const Args&... args) {
        std::wstring output;
        bool first = true;
        auto append = [&](const auto& value) {
            if (!first) output += L", ";
            first = false;
            追加调试参数(output, value);
        };
        (append(args), ...);
        写入调试输出(output.c_str());
    }

    int 信息框(const wchar_t* text, UINT flags, const wchar_t* title) {
        return MessageBoxW(hwnd_, text, title && title[0] ? title : L"LingBuilder 中文 C++", flags);
    }

    // 旧单实例实现保留在生成模板中但不参与编译，便于旧产物差异审查。
#if 0
    int EdgeView_创建(long long parentHandle, const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeView_关闭();
        edgeViewHost_ = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!edgeViewHost_ || !IsWindow(edgeViewHost_)) {
            调试输出(L"EdgeView 创建失败：父组件句柄无效。");
            return 0;
        }
        edgeViewLoader_ = LoadLibraryW(L"WebView2Loader.dll");
        if (!edgeViewLoader_) {
            调试输出(L"EdgeView 创建失败：未找到 WebView2Loader.dll。请安装 WebView2 SDK 并把 Loader DLL 放到 exe 同目录。");
            return 0;
        }
        using CreateEnvironmentProc = HRESULT (STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
        auto createEnvironment = reinterpret_cast<CreateEnvironmentProc>(GetProcAddress(edgeViewLoader_, "CreateCoreWebView2EnvironmentWithOptions"));
        if (!createEnvironment) {
            调试输出(L"EdgeView 创建失败：WebView2Loader.dll 不包含所需入口。");
            EdgeView_关闭();
            return 0;
        }
        bool completed = false;
        HRESULT result = E_FAIL;
        auto environmentCallback = Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, &completed, &result](HRESULT environmentResult, ICoreWebView2Environment* environment) -> HRESULT {
                result = environmentResult;
                if (SUCCEEDED(environmentResult) && environment) {
                    return environment->CreateCoreWebView2Controller(edgeViewHost_, Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [this, &completed, &result](HRESULT controllerResult, ICoreWebView2Controller* controller) -> HRESULT {
                            result = controllerResult;
                            if (SUCCEEDED(controllerResult) && controller) {
                                edgeViewController_ = controller;
                                controller->get_CoreWebView2(&edgeView_);
                                EdgeView_调整大小();
                                EdgeView_注册事件();
                            }
                            completed = true;
                            return S_OK;
                        }).Get());
                }
                completed = true;
                return S_OK;
            });
        result = createEnvironment(nullptr, nullptr, nullptr, environmentCallback.Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000) || !edgeView_) {
            调试输出(L"EdgeView 创建失败：无法初始化 WebView2 环境或等待超时。");
            EdgeView_关闭();
            return 0;
        }
        edgeViewLastEvent_ = L"浏览器创建完成";
        edgeViewLastEventData_ = address ? address : L"";
        if (address && address[0]) edgeView_->Navigate(address);
        return 1;
#else
        (void)parentHandle; (void)address;
        调试输出(L"EdgeView 不可用：当前 C++ 构建环境缺少 WebView2.h。请通过 NuGet 安装 Microsoft.Web.WebView2 SDK。");
        return 0;
#endif
    }

    int EdgeView_导航(const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        return edgeView_ && address && SUCCEEDED(edgeView_->Navigate(address)) ? 1 : 0;
#else
        (void)address; return 0;
#endif
    }

    std::wstring EdgeView_执行JS(const wchar_t* script) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (!edgeView_ || !script) return L"";
        bool completed = false;
        std::wstring value;
        HRESULT result = edgeView_->ExecuteScript(script, Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
            [&completed, &value](HRESULT error, LPCWSTR json) -> HRESULT {
                if (SUCCEEDED(error) && json) value = json;
                completed = true;
                return S_OK;
            }).Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000)) {
            调试输出(L"EdgeView 执行 JavaScript 失败或等待返回值超时。");
            return L"";
        }
        return value;
#else
        (void)script; return L"";
#endif
    }

    std::wstring EdgeView_取最近事件() const { return edgeViewLastEvent_; }
    std::wstring EdgeView_取事件数据() const { return edgeViewLastEventData_; }
    int EdgeView_后退() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        BOOL allowed = FALSE; if (!edgeView_ || FAILED(edgeView_->get_CanGoBack(&allowed)) || !allowed) return 0; edgeView_->GoBack(); return 1;
#else
        return 0;
#endif
    }
    int EdgeView_前进() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        BOOL allowed = FALSE; if (!edgeView_ || FAILED(edgeView_->get_CanGoForward(&allowed)) || !allowed) return 0; edgeView_->GoForward(); return 1;
#else
        return 0;
#endif
    }
    void EdgeView_刷新() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeView_) edgeView_->Reload();
#endif
    }
    void EdgeView_关闭() {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeViewController_) edgeViewController_->Close();
        edgeView_.Reset(); edgeViewController_.Reset();
        if (edgeViewLoader_) { FreeLibrary(edgeViewLoader_); edgeViewLoader_ = nullptr; }
#endif
        edgeViewHost_ = nullptr;
    }

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    bool EdgeView_等待(bool* completed, DWORD timeout) {
        DWORD started = GetTickCount();
        MSG message = {};
        while (!*completed && GetTickCount() - started < timeout) {
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return *completed;
    }
    void EdgeView_调整大小() {
        if (!edgeViewController_ || !edgeViewHost_) return;
        RECT bounds = {}; GetClientRect(edgeViewHost_, &bounds); edgeViewController_->put_Bounds(bounds);
    }
    void EdgeView_记录事件(const wchar_t* name, const wchar_t* data) {
        edgeViewLastEvent_ = name ? name : L""; edgeViewLastEventData_ = data ? data : L"";
    }
    void EdgeView_注册事件() {
        if (!edgeView_) return;
        EventRegistrationToken token = {};
        edgeView_->add_NavigationStarting(Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>([this](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; args->get_Uri(&uri); EdgeView_记录事件(L"导航开始", uri); CoTaskMemFree(uri); return S_OK; }).Get(), &token);
        edgeView_->add_NavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>([this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; args->get_IsSuccess(&ok); EdgeView_记录事件(L"导航完成", ok ? L"成功" : L"失败"); return S_OK; }).Get(), &token);
        edgeView_->add_DocumentTitleChanged(Microsoft::WRL::Callback<ICoreWebView2DocumentTitleChangedEventHandler>([this](ICoreWebView2* sender, IUnknown*) -> HRESULT { LPWSTR title = nullptr; sender->get_DocumentTitle(&title); EdgeView_记录事件(L"标题改变", title); CoTaskMemFree(title); return S_OK; }).Get(), &token);
        edgeView_->add_WebMessageReceived(Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>([this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT { LPWSTR message = nullptr; if (FAILED(args->TryGetWebMessageAsString(&message))) args->get_WebMessageAsJson(&message); EdgeView_记录事件(L"网页消息", message); CoTaskMemFree(message); return S_OK; }).Get(), &token);
    }
#endif
#endif

    EdgeViewInstance* EdgeView_查找(int instanceId) {
        auto found = edgeViews_.find(instanceId);
        return found == edgeViews_.end() ? nullptr : found->second.get();
    }

    EdgeViewInstance* EdgeView_查找控件(const wchar_t* controlName) {
        if (!controlName) return nullptr;
        for (auto& item : edgeViews_) {
            if (item.second->controlId <= 0) continue;
            const ControlSpec* control = FindControl(item.second->controlId);
            if (control && TextEquals(control->name, controlName)) return item.second.get();
        }
        return nullptr;
    }

    const wchar_t* EdgeView_取设计器事件ID(const wchar_t* eventName) const {
        if (TextEquals(eventName, L"导航开始")) return L"NavigationStarting";
        if (TextEquals(eventName, L"内容加载")) return L"ContentLoading";
        if (TextEquals(eventName, L"地址改变")) return L"SourceChanged";
        if (TextEquals(eventName, L"历史记录改变")) return L"HistoryChanged";
        if (TextEquals(eventName, L"导航完成")) return L"NavigationCompleted";
        if (TextEquals(eventName, L"框架导航开始")) return L"FrameNavigationStarting";
        if (TextEquals(eventName, L"框架导航完成")) return L"FrameNavigationCompleted";
        if (TextEquals(eventName, L"DOM加载完成")) return L"DOMContentLoaded";
        if (TextEquals(eventName, L"标题改变")) return L"TitleChanged";
        if (TextEquals(eventName, L"全屏元素状态改变")) return L"ContainsFullScreenElementChanged";
        if (TextEquals(eventName, L"窗口关闭请求")) return L"WindowCloseRequested";
        if (TextEquals(eventName, L"脚本对话框打开")) return L"ScriptDialogOpening";
        if (TextEquals(eventName, L"网页消息")) return L"WebMessageReceived";
        if (TextEquals(eventName, L"新窗口请求")) return L"NewWindowRequested";
        if (TextEquals(eventName, L"外部URI方案启动")) return L"LaunchingExternalUriScheme";
        if (TextEquals(eventName, L"权限请求")) return L"PermissionRequested";
        if (TextEquals(eventName, L"Web资源请求")) return L"WebResourceRequested";
        if (TextEquals(eventName, L"Web资源响应收到")) return L"WebResourceResponseReceived";
        if (TextEquals(eventName, L"客户端证书请求")) return L"ClientCertificateRequested";
        if (TextEquals(eventName, L"基本身份验证请求")) return L"BasicAuthenticationRequested";
        if (TextEquals(eventName, L"服务器证书错误")) return L"ServerCertificateErrorDetected";
        if (TextEquals(eventName, L"保存文件安全检查开始")) return L"SaveFileSecurityCheckStarting";
        if (TextEquals(eventName, L"屏幕捕获开始")) return L"ScreenCaptureStarting";
        if (TextEquals(eventName, L"进程失败")) return L"ProcessFailed";
        if (TextEquals(eventName, L"框架创建")) return L"FrameCreated";
        if (TextEquals(eventName, L"下载开始")) return L"DownloadStarting";
        if (TextEquals(eventName, L"静音状态改变")) return L"IsMutedChanged";
        if (TextEquals(eventName, L"音频播放状态改变")) return L"IsDocumentPlayingAudioChanged";
        if (TextEquals(eventName, L"下载对话框状态改变")) return L"IsDefaultDownloadDialogOpenChanged";
        if (TextEquals(eventName, L"右键菜单请求")) return L"ContextMenuRequested";
        if (TextEquals(eventName, L"状态栏文本改变")) return L"StatusBarTextChanged";
        if (TextEquals(eventName, L"网站图标改变")) return L"FaviconChanged";
        if (TextEquals(eventName, L"网页通知收到")) return L"NotificationReceived";
        if (TextEquals(eventName, L"另存为界面显示")) return L"SaveAsUIShowing";
        if (TextEquals(eventName, L"缩放比例改变")) return L"Controller.ZoomFactorChanged";
        if (TextEquals(eventName, L"移动焦点请求")) return L"Controller.MoveFocusRequested";
        if (TextEquals(eventName, L"浏览器获得焦点")) return L"Controller.GotFocus";
        if (TextEquals(eventName, L"浏览器失去焦点")) return L"Controller.LostFocus";
        if (TextEquals(eventName, L"浏览器快捷键按下")) return L"Controller.AcceleratorKeyPressed";
        if (TextEquals(eventName, L"光栅化缩放改变")) return L"Controller.RasterizationScaleChanged";
        if (TextEquals(eventName, L"新浏览器版本可用")) return L"Environment.NewBrowserVersionAvailable";
        if (TextEquals(eventName, L"浏览器进程退出")) return L"Environment.BrowserProcessExited";
        if (TextEquals(eventName, L"进程信息改变")) return L"Environment.ProcessInfosChanged";
        if (TextEquals(eventName, L"下载字节数改变")) return L"Download.BytesReceivedChanged";
        if (TextEquals(eventName, L"下载预计结束时间改变")) return L"Download.EstimatedEndTimeChanged";
        if (TextEquals(eventName, L"下载状态改变")) return L"Download.StateChanged";
        if (TextEquals(eventName, L"查找当前匹配改变")) return L"Find.ActiveMatchIndexChanged";
        if (TextEquals(eventName, L"查找匹配数改变")) return L"Find.MatchCountChanged";
        if (TextEquals(eventName, L"子框架名称改变")) return L"Frame.NameChanged";
        if (TextEquals(eventName, L"子框架销毁")) return L"Frame.Destroyed";
        if (TextEquals(eventName, L"子框架导航开始")) return L"Frame.NavigationStarting";
        if (TextEquals(eventName, L"子框架内容加载")) return L"Frame.ContentLoading";
        if (TextEquals(eventName, L"子框架导航完成")) return L"Frame.NavigationCompleted";
        if (TextEquals(eventName, L"子框架DOM加载完成")) return L"Frame.DOMContentLoaded";
        if (TextEquals(eventName, L"子框架网页消息")) return L"Frame.WebMessageReceived";
        if (TextEquals(eventName, L"子框架权限请求")) return L"Frame.PermissionRequested";
        if (TextEquals(eventName, L"子框架屏幕捕获开始")) return L"Frame.ScreenCaptureStarting";
        if (TextEquals(eventName, L"嵌套子框架创建")) return L"Frame.FrameCreated";
        if (TextEquals(eventName, L"网页通知关闭请求")) return L"Notification.CloseRequested";
        if (TextEquals(eventName, L"浏览器配置删除")) return L"Profile.Deleted";
        if (TextEquals(eventName, L"开发者工具协议事件")) return L"DevToolsProtocolEventReceived";
        if (TextEquals(eventName, L"自定义右键菜单项选择")) return L"ContextMenuItem.CustomItemSelected";
        return eventName ? eventName : L"";
    }

    int EdgeView_创建控件(const wchar_t* controlName) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        int created = 0;
        for (int index = 0; index < spec_.controlCount; ++index) {
            const ControlSpec& control = spec_.controls[index];
            if (!IsType(control, L"EdgeBrowser")) continue;
            if (controlName && controlName[0] && !TextEquals(control.name, controlName)) continue;
            RuntimeControl* runtime = FindRuntimeControl(control.id);
            if (!runtime || !runtime->hwnd || !IsWindow(runtime->hwnd)) continue;
            EdgeView_关闭实例(control.id);
            std::wstring cacheDirectory;
            std::wstring proxyServer = edgeViewGlobalProxy_;
            if (control.data2 && control.data2[0]) {
                auto records = DecodeControlRecords(control.data2, 3);
                if (!records.empty()) {
                    const auto& fields = records[0];
                    if (fields.size() > 0) cacheDirectory = fields[0];
                    if (fields.size() > 2 && fields[1] == L"custom") proxyServer = fields[2];
                }
            }
            if (!EdgeView_创建核心(control.id, runtime->hwnd, false, control.data, cacheDirectory.c_str(), proxyServer.c_str())) continue;
            EdgeViewInstance* instance = EdgeView_查找(control.id);
            if (instance) instance->controlId = control.id;
            ++created;
        }
        return created > 0 ? 1 : 0;
#else
        (void)controlName;
        return 0;
#endif
    }

    void EdgeView_关闭设计器控件() {
        std::vector<int> instanceIds;
        for (const auto& item : edgeViews_) if (item.second->controlId > 0) instanceIds.push_back(item.first);
        for (int instanceId : instanceIds) EdgeView_关闭实例(instanceId);
    }

    int EdgeView_创建(long long parentHandle, const wchar_t* address) {
        return EdgeView_创建实例(0, parentHandle, address, L"");
    }

    int EdgeView_创建实例(int instanceId, long long parentHandle, const wchar_t* address, const wchar_t* cacheDirectory) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (instanceId < 0) { 调试输出(L"EdgeView 创建失败：实例编号不能为负数。"); return 0; }
        EdgeView_关闭实例(instanceId);
        HWND host = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!host || !IsWindow(host)) { 调试输出(L"EdgeView 创建失败：父组件句柄无效。"); return 0; }
        return EdgeView_创建核心(instanceId, host, false, address, cacheDirectory, edgeViewGlobalProxy_.c_str());
#else
        (void)instanceId; (void)parentHandle; (void)address; (void)cacheDirectory;
        调试输出(L"EdgeView 不可用：构建环境缺少 WebView2.h，请恢复 Microsoft.Web.WebView2 SDK。");
        return 0;
#endif
    }

    int EdgeView_创建实例代理(int instanceId, long long parentHandle, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeView_关闭实例(instanceId);
        HWND host = parentHandle ? reinterpret_cast<HWND>(static_cast<INT_PTR>(parentHandle)) : hwnd_;
        if (!host || !IsWindow(host)) { 调试输出(L"EdgeView 创建失败：父组件句柄无效。"); return 0; }
        return EdgeView_创建核心(instanceId, host, false, address, cacheDirectory, proxyServer);
#else
        (void)instanceId; (void)parentHandle; (void)address; (void)cacheDirectory; (void)proxyServer; return 0;
#endif
    }

    int EdgeView_创建区域(int instanceId, int x, int y, int width, int height, const wchar_t* address, const wchar_t* cacheDirectory) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (width <= 0 || height <= 0) { 调试输出(L"EdgeView 创建失败：区域宽高必须大于零。"); return 0; }
        EdgeView_关闭实例(instanceId);
        HWND host = CreateWindowExW(WS_EX_CONTROLPARENT, L"STATIC", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
            x, y, width, height, hwnd_, nullptr, g_instance, nullptr);
        if (!host) { 调试输出(L"EdgeView 创建失败：无法创建浏览器承载组件。"); return 0; }
        if (!EdgeView_创建核心(instanceId, host, true, address, cacheDirectory, edgeViewGlobalProxy_.c_str())) { DestroyWindow(host); return 0; }
        return 1;
#else
        (void)instanceId; (void)x; (void)y; (void)width; (void)height; (void)address; (void)cacheDirectory;
        return 0;
#endif
    }

    int EdgeView_创建区域代理(int instanceId, int x, int y, int width, int height, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (width <= 0 || height <= 0) return 0;
        EdgeView_关闭实例(instanceId);
        HWND host = CreateWindowExW(WS_EX_CONTROLPARENT, L"STATIC", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
            x, y, width, height, hwnd_, nullptr, g_instance, nullptr);
        if (!host) return 0;
        if (!EdgeView_创建核心(instanceId, host, true, address, cacheDirectory, proxyServer)) { DestroyWindow(host); return 0; }
        return 1;
#else
        (void)instanceId; (void)x; (void)y; (void)width; (void)height; (void)address; (void)cacheDirectory; (void)proxyServer; return 0;
#endif
    }

    bool EdgeView_代理有效(const wchar_t* proxyServer) const {
        if (!proxyServer || !proxyServer[0]) return true;
        std::wstring value(proxyServer);
        if (value.find_first_of(L" \t\r\n\"") != std::wstring::npos) return false;
        return value.rfind(L"http://", 0) == 0 || value.rfind(L"https://", 0) == 0 || value.rfind(L"socks5://", 0) == 0;
    }
    int EdgeView_设置全局代理(const wchar_t* proxyServer) {
        if (!EdgeView_代理有效(proxyServer) || !proxyServer || !proxyServer[0]) {
            调试输出(L"EdgeView 全局代理无效：请使用 http://、https:// 或 socks5:// 地址，且不要包含空白或引号。");
            return 0;
        }
        edgeViewGlobalProxy_ = proxyServer;
        return 1;
    }
    void EdgeView_清除全局代理() { edgeViewGlobalProxy_.clear(); }
    std::wstring EdgeView_取全局代理() const { return edgeViewGlobalProxy_; }
    std::wstring EdgeView_取实例代理(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->proxyServer;
    }

    int EdgeView_绑定事件(int instanceId, const wchar_t* eventName, const wchar_t* handler) {
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !eventName || !eventName[0] || !handler || !handler[0]) return 0;
        instance->handlers[eventName] = handler;
        return 1;
    }

    int EdgeView_监听开发者工具事件(int instanceId, const wchar_t* protocolEventName) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !instance->webView || !protocolEventName || !protocolEventName[0]) return 0;
        Microsoft::WRL::ComPtr<ICoreWebView2DevToolsProtocolEventReceiver> receiver;
        if (FAILED(instance->webView->GetDevToolsProtocolEventReceiver(protocolEventName, &receiver)) || !receiver || !EdgeView_保留事件源(*instance, receiver.Get())) return 0;
        const std::wstring eventName = protocolEventName;
        EdgeViewInstance* raw = instance; EventRegistrationToken token = {};
        HRESULT result = receiver->add_DevToolsProtocolEventReceived(Microsoft::WRL::Callback<ICoreWebView2DevToolsProtocolEventReceivedEventHandler>([this, raw, eventName](ICoreWebView2*, ICoreWebView2DevToolsProtocolEventReceivedEventArgs* args) -> HRESULT { LPWSTR json = nullptr; args->get_ParameterObjectAsJson(&json); std::wstring data = EdgeView_事件数据({{L"protocolEvent", eventName}, {L"parameters", EdgeView_接管字符串(json)}}); EdgeView_记录事件(*raw, L"开发者工具协议事件", data.c_str()); return S_OK; }).Get(), &token);
        return SUCCEEDED(result) ? 1 : 0;
#else
        (void)instanceId; (void)protocolEventName; return 0;
#endif
    }

    int EdgeView_等待事件(int instanceId, const wchar_t* eventName, int timeoutMilliseconds) {
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !eventName || timeoutMilliseconds < 0) return 0;
        const UINT64 initialCount = instance->eventCounts[eventName];
        DWORD started = GetTickCount(); MSG message = {};
        while (GetTickCount() - started < static_cast<DWORD>(timeoutMilliseconds)) {
            if (instance->eventCounts[eventName] > initialCount) return 1;
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return instance->eventCounts[eventName] > initialCount ? 1 : 0;
    }

    int EdgeView_导航实例(int instanceId, const wchar_t* address) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !instance->webView || !address) return 0;
        instance->lastEvent.clear(); instance->lastEventData.clear();
        return SUCCEEDED(instance->webView->Navigate(address)) ? 1 : 0;
#else
        (void)instanceId; (void)address; return 0;
#endif
    }
    int EdgeView_导航(const wchar_t* address) { return EdgeView_导航实例(0, address); }

    int EdgeView_导航控件(const wchar_t* controlName, const wchar_t* address) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_导航实例(instance->id, address) : 0;
    }

    std::wstring EdgeView_执行JS实例(int instanceId, const wchar_t* script) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId);
        if (!instance || !instance->webView || !script) return L"";
        bool completed = false;
        std::wstring value;
        HRESULT result = instance->webView->ExecuteScript(script, Microsoft::WRL::Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
            [&completed, &value](HRESULT error, LPCWSTR json) -> HRESULT {
                if (SUCCEEDED(error) && json) value = json;
                completed = true;
                return S_OK;
            }).Get());
        if (FAILED(result) || !EdgeView_等待(&completed, 15000)) {
            调试输出(L"EdgeView 执行 JavaScript 失败或等待返回值超时。");
            return L"";
        }
        return value;
#else
        (void)instanceId; (void)script; return L"";
#endif
    }
    std::wstring EdgeView_执行JS(const wchar_t* script) { return EdgeView_执行JS实例(0, script); }
    std::wstring EdgeView_执行JS控件(const wchar_t* controlName, const wchar_t* script) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_执行JS实例(instance->id, script) : L"";
    }

    std::wstring EdgeView_取最近事件实例(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->lastEvent;
    }
    std::wstring EdgeView_取事件数据实例(int instanceId) const {
        auto found = edgeViews_.find(instanceId); return found == edgeViews_.end() ? L"" : found->second->lastEventData;
    }
    std::wstring EdgeView_取最近事件() const { return EdgeView_取最近事件实例(0); }
    std::wstring EdgeView_取事件数据() const { return EdgeView_取事件数据实例(0); }
    std::wstring EdgeView_取最近事件控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? instance->lastEvent : L"";
    }
    std::wstring EdgeView_取事件数据控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? instance->lastEventData : L"";
    }

    int EdgeView_后退实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); BOOL allowed = FALSE;
        if (!instance || !instance->webView || FAILED(instance->webView->get_CanGoBack(&allowed)) || !allowed) return 0;
        instance->webView->GoBack(); return 1;
#else
        (void)instanceId; return 0;
#endif
    }
    int EdgeView_前进实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); BOOL allowed = FALSE;
        if (!instance || !instance->webView || FAILED(instance->webView->get_CanGoForward(&allowed)) || !allowed) return 0;
        instance->webView->GoForward(); return 1;
#else
        (void)instanceId; return 0;
#endif
    }
    int EdgeView_后退() { return EdgeView_后退实例(0); }
    int EdgeView_前进() { return EdgeView_前进实例(0); }
    int EdgeView_后退控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_后退实例(instance->id) : 0;
    }
    int EdgeView_前进控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_前进实例(instance->id) : 0;
    }
    void EdgeView_刷新实例(int instanceId) {
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        EdgeViewInstance* instance = EdgeView_查找(instanceId); if (instance && instance->webView) instance->webView->Reload();
#else
        (void)instanceId;
#endif
    }
    void EdgeView_刷新() { EdgeView_刷新实例(0); }
    void EdgeView_刷新控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        if (instance) EdgeView_刷新实例(instance->id);
    }
    int EdgeView_绑定控件事件(const wchar_t* controlName, const wchar_t* eventName, const wchar_t* handler) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_绑定事件(instance->id, eventName, handler) : 0;
    }
    int EdgeView_监听开发者工具事件控件(const wchar_t* controlName, const wchar_t* protocolEventName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        return instance ? EdgeView_监听开发者工具事件(instance->id, protocolEventName) : 0;
    }
    void EdgeView_关闭控件(const wchar_t* controlName) {
        EdgeViewInstance* instance = EdgeView_查找控件(controlName);
        if (instance) EdgeView_关闭实例(instance->id);
    }
    void EdgeView_关闭实例(int instanceId) {
        auto found = edgeViews_.find(instanceId);
        if (found == edgeViews_.end()) return;
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (found->second->controller) found->second->controller->Close();
#endif
        if (found->second->ownsHost && found->second->host && IsWindow(found->second->host)) DestroyWindow(found->second->host);
        edgeViews_.erase(found);
#if LINGBUILDER_EDGEVIEW_AVAILABLE
        if (edgeViews_.empty() && edgeViewLoader_) { FreeLibrary(edgeViewLoader_); edgeViewLoader_ = nullptr; }
#endif
    }
    void EdgeView_关闭() {
        while (!edgeViews_.empty()) EdgeView_关闭实例(edgeViews_.begin()->first);
    }

#if LINGBUILDER_EDGEVIEW_AVAILABLE
    int EdgeView_创建核心(int instanceId, HWND host, bool ownsHost, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer) {
        if (!EdgeView_代理有效(proxyServer)) {
            调试输出(L"EdgeView 创建失败：代理地址无效。");
            return 0;
        }
        if (!edgeViewLoader_) edgeViewLoader_ = LoadLibraryW(L"WebView2Loader.dll");
        if (!edgeViewLoader_) { 调试输出(L"EdgeView 创建失败：exe 同目录缺少 WebView2Loader.dll。"); return 0; }
        using CreateEnvironmentProc = HRESULT (STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
        auto createEnvironment = reinterpret_cast<CreateEnvironmentProc>(GetProcAddress(edgeViewLoader_, "CreateCoreWebView2EnvironmentWithOptions"));
        if (!createEnvironment) { 调试输出(L"EdgeView 创建失败：Loader 入口无效。"); return 0; }
        auto instance = std::make_unique<EdgeViewInstance>();
        instance->id = instanceId; instance->host = host; instance->ownsHost = ownsHost;
        instance->cacheDirectory = cacheDirectory ? cacheDirectory : L"";
        instance->proxyServer = proxyServer ? proxyServer : L"";
        EdgeViewInstance* raw = instance.get(); edgeViews_[instanceId] = std::move(instance);
        bool completed = false; HRESULT asyncResult = E_FAIL;
        auto environmentCallback = Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, raw, &completed, &asyncResult](HRESULT result, ICoreWebView2Environment* environment) -> HRESULT {
                asyncResult = result;
                if (FAILED(result) || !environment) { completed = true; return S_OK; }
                raw->environment = environment;
                return environment->CreateCoreWebView2Controller(raw->host, Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [this, raw, &completed, &asyncResult](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        asyncResult = result;
                        if (SUCCEEDED(result) && controller) {
                            raw->controller = controller; controller->get_CoreWebView2(&raw->webView);
                            controller->put_IsVisible(TRUE);
                            EdgeView_调整大小(*raw); EdgeView_注册事件(*raw);
                            ShowWindow(raw->host, SW_SHOW);
                            SetWindowPos(raw->host, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
                            InvalidateRect(raw->host, nullptr, TRUE);
                            UpdateWindow(raw->host);
                        }
                        completed = true; return S_OK;
                    }).Get());
            });
        Microsoft::WRL::ComPtr<CoreWebView2EnvironmentOptions> environmentOptions;
        if (!raw->proxyServer.empty()) {
            environmentOptions = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
            std::wstring arguments = L"--proxy-server=" + raw->proxyServer;
            environmentOptions->put_AdditionalBrowserArguments(arguments.c_str());
        }
        HRESULT startResult = createEnvironment(nullptr, raw->cacheDirectory.empty() ? nullptr : raw->cacheDirectory.c_str(), environmentOptions.Get(), environmentCallback.Get());
        if (FAILED(startResult) || !EdgeView_等待(&completed, 15000) || FAILED(asyncResult) || !raw->webView) {
            调试输出(L"EdgeView 创建失败：WebView2 环境初始化失败或超时。"); EdgeView_关闭实例(instanceId); return 0;
        }
        EdgeView_记录事件(*raw, L"浏览器创建完成", raw->cacheDirectory.c_str());
        if (address && address[0]) raw->webView->Navigate(address);
        return 1;
    }
    bool EdgeView_等待(bool* completed, DWORD timeout) {
        DWORD started = GetTickCount(); MSG message = {};
        while (!*completed && GetTickCount() - started < timeout) {
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 10, QS_ALLINPUT);
        }
        return *completed;
    }
    void EdgeView_调整大小(EdgeViewInstance& instance) {
        if (!instance.controller || !instance.host) return;
        RECT bounds = {};
        GetClientRect(instance.host, &bounds);
        instance.controller->put_Bounds(bounds);
        instance.controller->NotifyParentWindowPositionChanged();
        instance.controller->put_IsVisible(IsWindowVisible(instance.host) ? TRUE : FALSE);
    }
    void EdgeView_调整全部大小() { for (auto& item : edgeViews_) EdgeView_调整大小(*item.second); }
    void EdgeView_记录事件(EdgeViewInstance& instance, const wchar_t* name, const wchar_t* data) {
        instance.lastEvent = name ? name : L""; instance.lastEventData = data ? data : L"";
        ++instance.eventCounts[instance.lastEvent];
        auto handler = instance.handlers.find(instance.lastEvent);
        std::wstring callback = handler == instance.handlers.end() ? L"" : handler->second;
        if (callback.empty() && instance.controlId > 0) {
            const ControlSpec* control = FindControl(instance.controlId);
            if (control) callback = GetEventHandler(*control, EdgeView_取设计器事件ID(instance.lastEvent.c_str()));
        }
        if (!callback.empty()) DispatchEdgeViewEvent(callback.c_str(), instance.id, instance.lastEvent.c_str(), instance.lastEventData.c_str());
    }
    static std::wstring EdgeView_接管字符串(LPWSTR value) {
        std::wstring result = value ? value : L"";
        if (value) CoTaskMemFree(value);
        return result;
    }
    static std::wstring EdgeView_布尔值(BOOL value) { return value ? L"true" : L"false"; }
    template <typename T> static std::wstring EdgeView_数值(T value) { return std::to_wstring(static_cast<long long>(value)); }
    static std::wstring EdgeView_JSON转义(const std::wstring& value) {
        std::wstring escaped;
        for (wchar_t ch : value) {
            if (ch == static_cast<wchar_t>(92) || ch == static_cast<wchar_t>(34)) { escaped.push_back(static_cast<wchar_t>(92)); escaped.push_back(ch); }
            else if (ch == static_cast<wchar_t>(10)) { escaped.push_back(static_cast<wchar_t>(92)); escaped.push_back(L'n'); }
            else if (ch == static_cast<wchar_t>(13)) { escaped.push_back(static_cast<wchar_t>(92)); escaped.push_back(L'r'); }
            else if (ch == static_cast<wchar_t>(9)) { escaped.push_back(static_cast<wchar_t>(92)); escaped.push_back(L't'); }
            else escaped.push_back(ch);
        }
        return escaped;
    }
    static std::wstring EdgeView_事件数据(std::initializer_list<std::pair<std::wstring, std::wstring>> fields) {
        std::wstring result; result.push_back(L'{'); bool first = true;
        for (const auto& field : fields) {
            if (!first) result.push_back(L',');
            first = false;
            result.push_back(static_cast<wchar_t>(34)); result += EdgeView_JSON转义(field.first); result.push_back(static_cast<wchar_t>(34));
            result.push_back(L':'); result.push_back(static_cast<wchar_t>(34)); result += EdgeView_JSON转义(field.second); result.push_back(static_cast<wchar_t>(34));
        }
        result.push_back(L'}'); return result;
    }
    static std::wstring EdgeView_当前地址(ICoreWebView2* webView) {
        LPWSTR value = nullptr; if (webView) webView->get_Source(&value); return EdgeView_接管字符串(value);
    }
    bool EdgeView_保留事件源(EdgeViewInstance& instance, IUnknown* source) {
        if (!source) return false;
        Microsoft::WRL::ComPtr<IUnknown> identity;
        if (FAILED(source->QueryInterface(IID_PPV_ARGS(&identity))) || !identity) return false;
        for (const auto& existing : instance.eventSources) if (existing.Get() == identity.Get()) return false;
        instance.eventSources.push_back(identity); return true;
    }
    void EdgeView_注册事件(EdgeViewInstance& instance) {
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        instance.webView->add_NavigationStarting(Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; BOOL user = FALSE, redirected = FALSE; UINT64 navigationId = 0; args->get_Uri(&uri); args->get_IsUserInitiated(&user); args->get_IsRedirected(&redirected); args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"userInitiated", EdgeView_布尔值(user)}, {L"redirected", EdgeView_布尔值(redirected)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"导航开始", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_ContentLoading(Microsoft::WRL::Callback<ICoreWebView2ContentLoadingEventHandler>([this, raw](ICoreWebView2* sender, ICoreWebView2ContentLoadingEventArgs* args) -> HRESULT { BOOL errorPage = FALSE; UINT64 navigationId = 0; args->get_IsErrorPage(&errorPage); args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_当前地址(sender)}, {L"errorPage", EdgeView_布尔值(errorPage)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"内容加载", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_SourceChanged(Microsoft::WRL::Callback<ICoreWebView2SourceChangedEventHandler>([this, raw](ICoreWebView2* sender, ICoreWebView2SourceChangedEventArgs* args) -> HRESULT { BOOL newDocument = FALSE; args->get_IsNewDocument(&newDocument); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_当前地址(sender)}, {L"newDocument", EdgeView_布尔值(newDocument)}}); EdgeView_记录事件(*raw, L"地址改变", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_HistoryChanged(Microsoft::WRL::Callback<ICoreWebView2HistoryChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { BOOL back = FALSE, forward = FALSE; sender->get_CanGoBack(&back); sender->get_CanGoForward(&forward); std::wstring data = EdgeView_事件数据({{L"canGoBack", EdgeView_布尔值(back)}, {L"canGoForward", EdgeView_布尔值(forward)}}); EdgeView_记录事件(*raw, L"历史记录改变", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_NavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; COREWEBVIEW2_WEB_ERROR_STATUS status = COREWEBVIEW2_WEB_ERROR_STATUS_UNKNOWN; UINT64 navigationId = 0; args->get_IsSuccess(&ok); args->get_WebErrorStatus(&status); args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"success", EdgeView_布尔值(ok)}, {L"webErrorStatus", EdgeView_数值(status)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"导航完成", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_FrameNavigationStarting(Microsoft::WRL::Callback<ICoreWebView2NavigationStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; args->get_Uri(&uri); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}}); EdgeView_记录事件(*raw, L"框架导航开始", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_FrameNavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2NavigationCompletedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; args->get_IsSuccess(&ok); std::wstring data = EdgeView_事件数据({{L"success", EdgeView_布尔值(ok)}}); EdgeView_记录事件(*raw, L"框架导航完成", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_ScriptDialogOpening(Microsoft::WRL::Callback<ICoreWebView2ScriptDialogOpeningEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2ScriptDialogOpeningEventArgs* args) -> HRESULT { LPWSTR uri = nullptr, message = nullptr; COREWEBVIEW2_SCRIPT_DIALOG_KIND kind = COREWEBVIEW2_SCRIPT_DIALOG_KIND_ALERT; args->get_Uri(&uri); args->get_Message(&message); args->get_Kind(&kind); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"message", EdgeView_接管字符串(message)}, {L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"脚本对话框打开", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_PermissionRequested(Microsoft::WRL::Callback<ICoreWebView2PermissionRequestedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2PermissionRequestedEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; COREWEBVIEW2_PERMISSION_KIND kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION; BOOL user = FALSE; args->get_Uri(&uri); args->get_PermissionKind(&kind); args->get_IsUserInitiated(&user); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"kind", EdgeView_数值(kind)}, {L"userInitiated", EdgeView_布尔值(user)}}); EdgeView_记录事件(*raw, L"权限请求", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_ProcessFailed(Microsoft::WRL::Callback<ICoreWebView2ProcessFailedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2ProcessFailedEventArgs* args) -> HRESULT { COREWEBVIEW2_PROCESS_FAILED_KIND kind = COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED; args->get_ProcessFailedKind(&kind); std::wstring data = EdgeView_事件数据({{L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"进程失败", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_WebMessageReceived(Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT { LPWSTR source = nullptr, message = nullptr; args->get_Source(&source); if (FAILED(args->TryGetWebMessageAsString(&message))) args->get_WebMessageAsJson(&message); std::wstring data = EdgeView_事件数据({{L"source", EdgeView_接管字符串(source)}, {L"message", EdgeView_接管字符串(message)}}); EdgeView_记录事件(*raw, L"网页消息", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_NewWindowRequested(Microsoft::WRL::Callback<ICoreWebView2NewWindowRequestedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; BOOL user = FALSE; args->get_Uri(&uri); args->get_IsUserInitiated(&user); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"userInitiated", EdgeView_布尔值(user)}}); EdgeView_记录事件(*raw, L"新窗口请求", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_DocumentTitleChanged(Microsoft::WRL::Callback<ICoreWebView2DocumentTitleChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { LPWSTR value = nullptr; sender->get_DocumentTitle(&value); std::wstring data = EdgeView_事件数据({{L"title", EdgeView_接管字符串(value)}}); EdgeView_记录事件(*raw, L"标题改变", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_ContainsFullScreenElementChanged(Microsoft::WRL::Callback<ICoreWebView2ContainsFullScreenElementChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { BOOL value = FALSE; sender->get_ContainsFullScreenElement(&value); std::wstring data = EdgeView_事件数据({{L"containsFullScreenElement", EdgeView_布尔值(value)}}); EdgeView_记录事件(*raw, L"全屏元素状态改变", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->AddWebResourceRequestedFilter(L"*", COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
        instance.webView->add_WebResourceRequested(Microsoft::WRL::Callback<ICoreWebView2WebResourceRequestedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2WebResourceRequestedEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2WebResourceRequest> request; LPWSTR uri = nullptr, method = nullptr; COREWEBVIEW2_WEB_RESOURCE_CONTEXT context = COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL; args->get_Request(&request); args->get_ResourceContext(&context); if (request) { request->get_Uri(&uri); request->get_Method(&method); } std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"method", EdgeView_接管字符串(method)}, {L"context", EdgeView_数值(context)}}); EdgeView_记录事件(*raw, L"Web资源请求", data.c_str()); return S_OK; }).Get(), &token);
        instance.webView->add_WindowCloseRequested(Microsoft::WRL::Callback<ICoreWebView2WindowCloseRequestedEventHandler>([this, raw](ICoreWebView2*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"窗口关闭请求", L"{}"); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2_2> webView2;
        if (SUCCEEDED(instance.webView.As(&webView2)) && webView2) {
            webView2->add_WebResourceResponseReceived(Microsoft::WRL::Callback<ICoreWebView2WebResourceResponseReceivedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2WebResourceResponseReceivedEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2WebResourceRequest> request; Microsoft::WRL::ComPtr<ICoreWebView2WebResourceResponseView> response; LPWSTR uri = nullptr; int status = 0; args->get_Request(&request); args->get_Response(&response); if (request) request->get_Uri(&uri); if (response) response->get_StatusCode(&status); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"statusCode", EdgeView_数值(status)}}); EdgeView_记录事件(*raw, L"Web资源响应收到", data.c_str()); return S_OK; }).Get(), &token);
            webView2->add_DOMContentLoaded(Microsoft::WRL::Callback<ICoreWebView2DOMContentLoadedEventHandler>([this, raw](ICoreWebView2* sender, ICoreWebView2DOMContentLoadedEventArgs* args) -> HRESULT { UINT64 navigationId = 0; args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_当前地址(sender)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"DOM加载完成", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_4> webView4;
        if (SUCCEEDED(instance.webView.As(&webView4)) && webView4) {
            webView4->add_FrameCreated(Microsoft::WRL::Callback<ICoreWebView2FrameCreatedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2FrameCreatedEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2Frame> frame; args->get_Frame(&frame); EdgeView_附加框架事件(*raw, frame.Get()); LPWSTR name = nullptr; if (frame) frame->get_Name(&name); std::wstring data = EdgeView_事件数据({{L"name", EdgeView_接管字符串(name)}}); EdgeView_记录事件(*raw, L"框架创建", data.c_str()); return S_OK; }).Get(), &token);
            webView4->add_DownloadStarting(Microsoft::WRL::Callback<ICoreWebView2DownloadStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2DownloadStartingEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2DownloadOperation> operation; args->get_DownloadOperation(&operation); EdgeView_附加下载事件(*raw, operation.Get()); LPWSTR uri = nullptr, path = nullptr; if (operation) operation->get_Uri(&uri); args->get_ResultFilePath(&path); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"resultFilePath", EdgeView_接管字符串(path)}}); EdgeView_记录事件(*raw, L"下载开始", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_5> webView5;
        if (SUCCEEDED(instance.webView.As(&webView5)) && webView5) {
            webView5->add_ClientCertificateRequested(Microsoft::WRL::Callback<ICoreWebView2ClientCertificateRequestedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2ClientCertificateRequestedEventArgs* args) -> HRESULT { LPWSTR host = nullptr; INT32 port = 0; BOOL proxy = FALSE; args->get_Host(&host); args->get_Port(&port); args->get_IsProxy(&proxy); std::wstring data = EdgeView_事件数据({{L"host", EdgeView_接管字符串(host)}, {L"port", EdgeView_数值(port)}, {L"isProxy", EdgeView_布尔值(proxy)}}); EdgeView_记录事件(*raw, L"客户端证书请求", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_8> webView8;
        if (SUCCEEDED(instance.webView.As(&webView8)) && webView8) {
            webView8->add_IsMutedChanged(Microsoft::WRL::Callback<ICoreWebView2IsMutedChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2_8> current; BOOL value = FALSE; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_IsMuted(&value); std::wstring data = EdgeView_事件数据({{L"isMuted", EdgeView_布尔值(value)}}); EdgeView_记录事件(*raw, L"静音状态改变", data.c_str()); return S_OK; }).Get(), &token);
            webView8->add_IsDocumentPlayingAudioChanged(Microsoft::WRL::Callback<ICoreWebView2IsDocumentPlayingAudioChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2_8> current; BOOL value = FALSE; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_IsDocumentPlayingAudio(&value); std::wstring data = EdgeView_事件数据({{L"isDocumentPlayingAudio", EdgeView_布尔值(value)}}); EdgeView_记录事件(*raw, L"音频播放状态改变", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_9> webView9;
        if (SUCCEEDED(instance.webView.As(&webView9)) && webView9) {
            webView9->add_IsDefaultDownloadDialogOpenChanged(Microsoft::WRL::Callback<ICoreWebView2IsDefaultDownloadDialogOpenChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2_9> current; BOOL value = FALSE; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_IsDefaultDownloadDialogOpen(&value); std::wstring data = EdgeView_事件数据({{L"isOpen", EdgeView_布尔值(value)}}); EdgeView_记录事件(*raw, L"下载对话框状态改变", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_10> webView10;
        if (SUCCEEDED(instance.webView.As(&webView10)) && webView10) {
            webView10->add_BasicAuthenticationRequested(Microsoft::WRL::Callback<ICoreWebView2BasicAuthenticationRequestedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2BasicAuthenticationRequestedEventArgs* args) -> HRESULT { LPWSTR uri = nullptr, challenge = nullptr; args->get_Uri(&uri); args->get_Challenge(&challenge); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"challenge", EdgeView_接管字符串(challenge)}}); EdgeView_记录事件(*raw, L"基本身份验证请求", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_11> webView11;
        if (SUCCEEDED(instance.webView.As(&webView11)) && webView11) {
            webView11->add_ContextMenuRequested(Microsoft::WRL::Callback<ICoreWebView2ContextMenuRequestedEventHandler>(
                [this, raw](ICoreWebView2*, ICoreWebView2ContextMenuRequestedEventArgs* args) -> HRESULT {
                    POINT location = {}; args->get_Location(&location);
                    std::wstring eventData = EdgeView_事件数据({{L"x", EdgeView_数值(location.x)}, {L"y", EdgeView_数值(location.y)}});
                    EdgeView_记录事件(*raw, L"右键菜单请求", eventData.c_str());
                    Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItemCollection> menuItems;
                    if (FAILED(args->get_MenuItems(&menuItems)) || !menuItems) return S_OK;
                    Microsoft::WRL::ComPtr<ICoreWebView2Environment9> environment9;
                    if (!raw->environment || FAILED(raw->environment.As(&environment9)) || !environment9) return S_OK;
                    Microsoft::WRL::ComPtr<ICoreWebView2ContextMenuItem> refreshItem;
                    if (FAILED(environment9->CreateContextMenuItem(L"刷新", nullptr, COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND, &refreshItem)) || !refreshItem) return S_OK;
                    EventRegistrationToken selectedToken = {};
                    refreshItem->add_CustomItemSelected(Microsoft::WRL::Callback<ICoreWebView2CustomItemSelectedEventHandler>(
                        [this, raw](ICoreWebView2ContextMenuItem*, IUnknown*) -> HRESULT {
                            std::wstring data = EdgeView_事件数据({{L"name", L"刷新"}});
                            EdgeView_记录事件(*raw, L"自定义右键菜单项选择", data.c_str());
                            EdgeView_刷新实例(raw->id);
                            return S_OK;
                        }).Get(), &selectedToken);
                    UINT32 count = 0;
                    menuItems->get_Count(&count);
                    menuItems->InsertValueAtIndex(count, refreshItem.Get());
                    return S_OK;
                }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_12> webView12;
        if (SUCCEEDED(instance.webView.As(&webView12)) && webView12) {
            webView12->add_StatusBarTextChanged(Microsoft::WRL::Callback<ICoreWebView2StatusBarTextChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2_12> current; LPWSTR value = nullptr; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_StatusBarText(&value); std::wstring data = EdgeView_事件数据({{L"text", EdgeView_接管字符串(value)}}); EdgeView_记录事件(*raw, L"状态栏文本改变", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_14> webView14;
        if (SUCCEEDED(instance.webView.As(&webView14)) && webView14) {
            webView14->add_ServerCertificateErrorDetected(Microsoft::WRL::Callback<ICoreWebView2ServerCertificateErrorDetectedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2ServerCertificateErrorDetectedEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; COREWEBVIEW2_WEB_ERROR_STATUS status = COREWEBVIEW2_WEB_ERROR_STATUS_UNKNOWN; args->get_RequestUri(&uri); args->get_ErrorStatus(&status); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"errorStatus", EdgeView_数值(status)}}); EdgeView_记录事件(*raw, L"服务器证书错误", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_15> webView15;
        if (SUCCEEDED(instance.webView.As(&webView15)) && webView15) {
            webView15->add_FaviconChanged(Microsoft::WRL::Callback<ICoreWebView2FaviconChangedEventHandler>([this, raw](ICoreWebView2* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2_15> current; LPWSTR value = nullptr; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_FaviconUri(&value); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(value)}}); EdgeView_记录事件(*raw, L"网站图标改变", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_18> webView18;
        if (SUCCEEDED(instance.webView.As(&webView18)) && webView18) {
            webView18->add_LaunchingExternalUriScheme(Microsoft::WRL::Callback<ICoreWebView2LaunchingExternalUriSchemeEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2LaunchingExternalUriSchemeEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; BOOL user = FALSE; args->get_Uri(&uri); args->get_IsUserInitiated(&user); std::wstring data = EdgeView_事件数据({{L"uri", EdgeView_接管字符串(uri)}, {L"userInitiated", EdgeView_布尔值(user)}}); EdgeView_记录事件(*raw, L"外部URI方案启动", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_24> webView24;
        if (SUCCEEDED(instance.webView.As(&webView24)) && webView24) {
            webView24->add_NotificationReceived(Microsoft::WRL::Callback<ICoreWebView2NotificationReceivedEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2NotificationReceivedEventArgs* args) -> HRESULT { LPWSTR origin = nullptr; Microsoft::WRL::ComPtr<ICoreWebView2Notification> notification; args->get_SenderOrigin(&origin); args->get_Notification(&notification); EdgeView_附加通知事件(*raw, notification.Get()); std::wstring data = EdgeView_事件数据({{L"origin", EdgeView_接管字符串(origin)}}); EdgeView_记录事件(*raw, L"网页通知收到", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_25> webView25;
        if (SUCCEEDED(instance.webView.As(&webView25)) && webView25) {
            webView25->add_SaveAsUIShowing(Microsoft::WRL::Callback<ICoreWebView2SaveAsUIShowingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2SaveAsUIShowingEventArgs* args) -> HRESULT { LPWSTR mime = nullptr, path = nullptr; BOOL allowReplace = FALSE; COREWEBVIEW2_SAVE_AS_KIND kind = COREWEBVIEW2_SAVE_AS_KIND_DEFAULT; args->get_ContentMimeType(&mime); args->get_SaveAsFilePath(&path); args->get_AllowReplace(&allowReplace); args->get_Kind(&kind); std::wstring data = EdgeView_事件数据({{L"mimeType", EdgeView_接管字符串(mime)}, {L"saveAsFilePath", EdgeView_接管字符串(path)}, {L"allowReplace", EdgeView_布尔值(allowReplace)}, {L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"另存为界面显示", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_26> webView26;
        if (SUCCEEDED(instance.webView.As(&webView26)) && webView26) {
            webView26->add_SaveFileSecurityCheckStarting(Microsoft::WRL::Callback<ICoreWebView2SaveFileSecurityCheckStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2SaveFileSecurityCheckStartingEventArgs* args) -> HRESULT { BOOL cancel = FALSE; args->get_CancelSave(&cancel); std::wstring data = EdgeView_事件数据({{L"cancelSave", EdgeView_布尔值(cancel)}}); EdgeView_记录事件(*raw, L"保存文件安全检查开始", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2_27> webView27;
        if (SUCCEEDED(instance.webView.As(&webView27)) && webView27) {
            webView27->add_ScreenCaptureStarting(Microsoft::WRL::Callback<ICoreWebView2ScreenCaptureStartingEventHandler>([this, raw](ICoreWebView2*, ICoreWebView2ScreenCaptureStartingEventArgs* args) -> HRESULT { BOOL cancel = FALSE; args->get_Cancel(&cancel); std::wstring data = EdgeView_事件数据({{L"cancel", EdgeView_布尔值(cancel)}}); EdgeView_记录事件(*raw, L"屏幕捕获开始", data.c_str()); return S_OK; }).Get(), &token);
        }
        EdgeView_附加控制器事件(instance);
        EdgeView_附加环境事件(instance);
        EdgeView_附加查找事件(instance);
        EdgeView_附加配置事件(instance);
    }
    void EdgeView_附加下载事件(EdgeViewInstance& instance, ICoreWebView2DownloadOperation* operation) {
        if (!EdgeView_保留事件源(instance, operation)) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        operation->add_BytesReceivedChanged(Microsoft::WRL::Callback<ICoreWebView2BytesReceivedChangedEventHandler>([this, raw](ICoreWebView2DownloadOperation* sender, IUnknown*) -> HRESULT { INT64 received = 0, total = 0; sender->get_BytesReceived(&received); sender->get_TotalBytesToReceive(&total); std::wstring data = EdgeView_事件数据({{L"bytesReceived", EdgeView_数值(received)}, {L"totalBytes", EdgeView_数值(total)}}); EdgeView_记录事件(*raw, L"下载字节数改变", data.c_str()); return S_OK; }).Get(), &token);
        operation->add_EstimatedEndTimeChanged(Microsoft::WRL::Callback<ICoreWebView2EstimatedEndTimeChangedEventHandler>([this, raw](ICoreWebView2DownloadOperation* sender, IUnknown*) -> HRESULT { LPWSTR value = nullptr; sender->get_EstimatedEndTime(&value); std::wstring data = EdgeView_事件数据({{L"estimatedEndTime", EdgeView_接管字符串(value)}}); EdgeView_记录事件(*raw, L"下载预计结束时间改变", data.c_str()); return S_OK; }).Get(), &token);
        operation->add_StateChanged(Microsoft::WRL::Callback<ICoreWebView2StateChangedEventHandler>([this, raw](ICoreWebView2DownloadOperation* sender, IUnknown*) -> HRESULT { COREWEBVIEW2_DOWNLOAD_STATE state = COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS; sender->get_State(&state); std::wstring data = EdgeView_事件数据({{L"state", EdgeView_数值(state)}}); EdgeView_记录事件(*raw, L"下载状态改变", data.c_str()); return S_OK; }).Get(), &token);
    }
    void EdgeView_附加通知事件(EdgeViewInstance& instance, ICoreWebView2Notification* notification) {
        if (!EdgeView_保留事件源(instance, notification)) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        notification->add_CloseRequested(Microsoft::WRL::Callback<ICoreWebView2NotificationCloseRequestedEventHandler>([this, raw](ICoreWebView2Notification*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"网页通知关闭请求", L"{}"); return S_OK; }).Get(), &token);
    }
    static std::wstring EdgeView_框架名称(ICoreWebView2Frame* frame) {
        LPWSTR value = nullptr; if (frame) frame->get_Name(&value); return EdgeView_接管字符串(value);
    }
    void EdgeView_附加框架事件(EdgeViewInstance& instance, ICoreWebView2Frame* frame) {
        if (!EdgeView_保留事件源(instance, frame)) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        frame->add_NameChanged(Microsoft::WRL::Callback<ICoreWebView2FrameNameChangedEventHandler>([this, raw](ICoreWebView2Frame* sender, IUnknown*) -> HRESULT { std::wstring data = EdgeView_事件数据({{L"name", EdgeView_框架名称(sender)}}); EdgeView_记录事件(*raw, L"子框架名称改变", data.c_str()); return S_OK; }).Get(), &token);
        frame->add_Destroyed(Microsoft::WRL::Callback<ICoreWebView2FrameDestroyedEventHandler>([this, raw](ICoreWebView2Frame* sender, IUnknown*) -> HRESULT { std::wstring data = EdgeView_事件数据({{L"name", EdgeView_框架名称(sender)}}); EdgeView_记录事件(*raw, L"子框架销毁", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Frame2> frame2;
        if (SUCCEEDED(frame->QueryInterface(IID_PPV_ARGS(&frame2))) && frame2) {
            frame2->add_NavigationStarting(Microsoft::WRL::Callback<ICoreWebView2FrameNavigationStartingEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT { LPWSTR uri = nullptr; args->get_Uri(&uri); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"uri", EdgeView_接管字符串(uri)}}); EdgeView_记录事件(*raw, L"子框架导航开始", data.c_str()); return S_OK; }).Get(), &token);
            frame2->add_ContentLoading(Microsoft::WRL::Callback<ICoreWebView2FrameContentLoadingEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2ContentLoadingEventArgs* args) -> HRESULT { UINT64 navigationId = 0; args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"子框架内容加载", data.c_str()); return S_OK; }).Get(), &token);
            frame2->add_NavigationCompleted(Microsoft::WRL::Callback<ICoreWebView2FrameNavigationCompletedEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT { BOOL ok = FALSE; args->get_IsSuccess(&ok); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"success", EdgeView_布尔值(ok)}}); EdgeView_记录事件(*raw, L"子框架导航完成", data.c_str()); return S_OK; }).Get(), &token);
            frame2->add_DOMContentLoaded(Microsoft::WRL::Callback<ICoreWebView2FrameDOMContentLoadedEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2DOMContentLoadedEventArgs* args) -> HRESULT { UINT64 navigationId = 0; args->get_NavigationId(&navigationId); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"navigationId", EdgeView_数值(navigationId)}}); EdgeView_记录事件(*raw, L"子框架DOM加载完成", data.c_str()); return S_OK; }).Get(), &token);
            frame2->add_WebMessageReceived(Microsoft::WRL::Callback<ICoreWebView2FrameWebMessageReceivedEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT { LPWSTR message = nullptr; if (FAILED(args->TryGetWebMessageAsString(&message))) args->get_WebMessageAsJson(&message); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"message", EdgeView_接管字符串(message)}}); EdgeView_记录事件(*raw, L"子框架网页消息", data.c_str()); return S_OK; }).Get(), &token);
        }
        Microsoft::WRL::ComPtr<ICoreWebView2Frame3> frame3;
        if (SUCCEEDED(frame->QueryInterface(IID_PPV_ARGS(&frame3))) && frame3) frame3->add_PermissionRequested(Microsoft::WRL::Callback<ICoreWebView2FramePermissionRequestedEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2PermissionRequestedEventArgs* args) -> HRESULT { COREWEBVIEW2_PERMISSION_KIND kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION; args->get_PermissionKind(&kind); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"子框架权限请求", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Frame6> frame6;
        if (SUCCEEDED(frame->QueryInterface(IID_PPV_ARGS(&frame6))) && frame6) frame6->add_ScreenCaptureStarting(Microsoft::WRL::Callback<ICoreWebView2FrameScreenCaptureStartingEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2ScreenCaptureStartingEventArgs* args) -> HRESULT { BOOL cancel = FALSE; args->get_Cancel(&cancel); std::wstring data = EdgeView_事件数据({{L"frame", EdgeView_框架名称(sender)}, {L"cancel", EdgeView_布尔值(cancel)}}); EdgeView_记录事件(*raw, L"子框架屏幕捕获开始", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Frame7> frame7;
        if (SUCCEEDED(frame->QueryInterface(IID_PPV_ARGS(&frame7))) && frame7) frame7->add_FrameCreated(Microsoft::WRL::Callback<ICoreWebView2FrameChildFrameCreatedEventHandler>([this, raw](ICoreWebView2Frame* sender, ICoreWebView2FrameCreatedEventArgs* args) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2Frame> child; args->get_Frame(&child); EdgeView_附加框架事件(*raw, child.Get()); std::wstring data = EdgeView_事件数据({{L"parent", EdgeView_框架名称(sender)}, {L"child", EdgeView_框架名称(child.Get())}}); EdgeView_记录事件(*raw, L"嵌套子框架创建", data.c_str()); return S_OK; }).Get(), &token);
    }
    void EdgeView_附加控制器事件(EdgeViewInstance& instance) {
        if (!instance.controller) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        instance.controller->add_ZoomFactorChanged(Microsoft::WRL::Callback<ICoreWebView2ZoomFactorChangedEventHandler>([this, raw](ICoreWebView2Controller* sender, IUnknown*) -> HRESULT { double value = 1.0; sender->get_ZoomFactor(&value); std::wstring data = EdgeView_事件数据({{L"zoomFactor", std::to_wstring(value)}}); EdgeView_记录事件(*raw, L"缩放比例改变", data.c_str()); return S_OK; }).Get(), &token);
        instance.controller->add_MoveFocusRequested(Microsoft::WRL::Callback<ICoreWebView2MoveFocusRequestedEventHandler>([this, raw](ICoreWebView2Controller*, ICoreWebView2MoveFocusRequestedEventArgs* args) -> HRESULT { COREWEBVIEW2_MOVE_FOCUS_REASON reason = COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC; args->get_Reason(&reason); std::wstring data = EdgeView_事件数据({{L"reason", EdgeView_数值(reason)}}); EdgeView_记录事件(*raw, L"移动焦点请求", data.c_str()); return S_OK; }).Get(), &token);
        instance.controller->add_GotFocus(Microsoft::WRL::Callback<ICoreWebView2FocusChangedEventHandler>([this, raw](ICoreWebView2Controller*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"浏览器获得焦点", L"{}"); return S_OK; }).Get(), &token);
        instance.controller->add_LostFocus(Microsoft::WRL::Callback<ICoreWebView2FocusChangedEventHandler>([this, raw](ICoreWebView2Controller*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"浏览器失去焦点", L"{}"); return S_OK; }).Get(), &token);
        instance.controller->add_AcceleratorKeyPressed(Microsoft::WRL::Callback<ICoreWebView2AcceleratorKeyPressedEventHandler>([this, raw](ICoreWebView2Controller*, ICoreWebView2AcceleratorKeyPressedEventArgs* args) -> HRESULT { UINT key = 0; COREWEBVIEW2_KEY_EVENT_KIND kind = COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN; args->get_VirtualKey(&key); args->get_KeyEventKind(&kind); std::wstring data = EdgeView_事件数据({{L"virtualKey", EdgeView_数值(key)}, {L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"浏览器快捷键按下", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Controller3> controller3;
        if (SUCCEEDED(instance.controller.As(&controller3)) && controller3) controller3->add_RasterizationScaleChanged(Microsoft::WRL::Callback<ICoreWebView2RasterizationScaleChangedEventHandler>([this, raw](ICoreWebView2Controller* sender, IUnknown*) -> HRESULT { Microsoft::WRL::ComPtr<ICoreWebView2Controller3> current; double value = 1.0; if (SUCCEEDED(sender->QueryInterface(IID_PPV_ARGS(&current))) && current) current->get_RasterizationScale(&value); std::wstring data = EdgeView_事件数据({{L"rasterizationScale", std::to_wstring(value)}}); EdgeView_记录事件(*raw, L"光栅化缩放改变", data.c_str()); return S_OK; }).Get(), &token);
    }
    void EdgeView_附加环境事件(EdgeViewInstance& instance) {
        if (!instance.environment) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        instance.environment->add_NewBrowserVersionAvailable(Microsoft::WRL::Callback<ICoreWebView2NewBrowserVersionAvailableEventHandler>([this, raw](ICoreWebView2Environment* sender, IUnknown*) -> HRESULT { LPWSTR version = nullptr; sender->get_BrowserVersionString(&version); std::wstring data = EdgeView_事件数据({{L"version", EdgeView_接管字符串(version)}}); EdgeView_记录事件(*raw, L"新浏览器版本可用", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Environment5> environment5;
        if (SUCCEEDED(instance.environment.As(&environment5)) && environment5) environment5->add_BrowserProcessExited(Microsoft::WRL::Callback<ICoreWebView2BrowserProcessExitedEventHandler>([this, raw](ICoreWebView2Environment*, ICoreWebView2BrowserProcessExitedEventArgs* args) -> HRESULT { UINT32 processId = 0; COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND kind = COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND_NORMAL; args->get_BrowserProcessId(&processId); args->get_BrowserProcessExitKind(&kind); std::wstring data = EdgeView_事件数据({{L"processId", EdgeView_数值(processId)}, {L"kind", EdgeView_数值(kind)}}); EdgeView_记录事件(*raw, L"浏览器进程退出", data.c_str()); return S_OK; }).Get(), &token);
        Microsoft::WRL::ComPtr<ICoreWebView2Environment8> environment8;
        if (SUCCEEDED(instance.environment.As(&environment8)) && environment8) environment8->add_ProcessInfosChanged(Microsoft::WRL::Callback<ICoreWebView2ProcessInfosChangedEventHandler>([this, raw](ICoreWebView2Environment*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"进程信息改变", L"{}"); return S_OK; }).Get(), &token);
    }
    void EdgeView_附加查找事件(EdgeViewInstance& instance) {
        Microsoft::WRL::ComPtr<ICoreWebView2_28> webView28;
        Microsoft::WRL::ComPtr<ICoreWebView2Find> find;
        if (!instance.webView || FAILED(instance.webView.As(&webView28)) || !webView28 || FAILED(webView28->get_Find(&find)) || !find || !EdgeView_保留事件源(instance, find.Get())) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        find->add_ActiveMatchIndexChanged(Microsoft::WRL::Callback<ICoreWebView2FindActiveMatchIndexChangedEventHandler>([this, raw](ICoreWebView2Find* sender, IUnknown*) -> HRESULT { INT32 value = 0; sender->get_ActiveMatchIndex(&value); std::wstring data = EdgeView_事件数据({{L"activeMatchIndex", EdgeView_数值(value)}}); EdgeView_记录事件(*raw, L"查找当前匹配改变", data.c_str()); return S_OK; }).Get(), &token);
        find->add_MatchCountChanged(Microsoft::WRL::Callback<ICoreWebView2FindMatchCountChangedEventHandler>([this, raw](ICoreWebView2Find* sender, IUnknown*) -> HRESULT { INT32 value = 0; sender->get_MatchCount(&value); std::wstring data = EdgeView_事件数据({{L"matchCount", EdgeView_数值(value)}}); EdgeView_记录事件(*raw, L"查找匹配数改变", data.c_str()); return S_OK; }).Get(), &token);
    }
    void EdgeView_附加配置事件(EdgeViewInstance& instance) {
        Microsoft::WRL::ComPtr<ICoreWebView2_13> webView13;
        Microsoft::WRL::ComPtr<ICoreWebView2Profile> profile;
        Microsoft::WRL::ComPtr<ICoreWebView2Profile8> profile8;
        if (!instance.webView || FAILED(instance.webView.As(&webView13)) || !webView13 || FAILED(webView13->get_Profile(&profile)) || !profile || FAILED(profile.As(&profile8)) || !profile8 || !EdgeView_保留事件源(instance, profile8.Get())) return;
        EventRegistrationToken token = {}; EdgeViewInstance* raw = &instance;
        profile8->add_Deleted(Microsoft::WRL::Callback<ICoreWebView2ProfileDeletedEventHandler>([this, raw](ICoreWebView2Profile*, IUnknown*) -> HRESULT { EdgeView_记录事件(*raw, L"浏览器配置删除", L"{}"); return S_OK; }).Get(), &token);
    }
#else
    void EdgeView_调整全部大小() {}
#endif

    // ================= CEF3 浏览器模块运行时 =================
    CefBrowserInstance* CEF3_查找实例(const wchar_t* controlName) {
        if (!controlName) return nullptr;
        for (auto& item : cefBrowsers_) {
            const ControlSpec* control = FindControl(item.second->controlId);
            if (control && TextEquals(control->name, controlName)) return item.second.get();
        }
        return nullptr;
    }

    CefBrowserInstance* CEF3_确保实例(int controlId) {
        auto found = cefBrowsers_.find(controlId);
        if (found != cefBrowsers_.end()) return found->second.get();
        auto instance = std::make_unique<CefBrowserInstance>();
        instance->controlId = controlId;
        CefBrowserInstance* raw = instance.get();
        cefBrowsers_[controlId] = std::move(instance);
        return raw;
    }

    int CEF3_初始化() {
#if LINGBUILDER_CEF3_AVAILABLE
        if (cefInitialized_) return 1;
        wchar_t modulePath[MAX_PATH] = {};
        GetModuleFileNameW(nullptr, modulePath, MAX_PATH);
        std::wstring resourcesDir = modulePath;
        size_t lastSlash = resourcesDir.find_last_of(L"\\/");
        if (lastSlash != std::wstring::npos) resourcesDir = resourcesDir.substr(0, lastSlash);
        std::wstring cachePath;
        for (int i = 0; i < spec_.controlCount && cachePath.empty(); ++i) {
            const ControlSpec& control = spec_.controls[i];
            if (!IsType(control, L"CefBrowser") || !control.data2 || !control.data2[0]) continue;
            auto records = DecodeControlRecords(control.data2, 4);
            if (!records.empty() && !records[0].empty() && !records[0][0].empty()) cachePath = records[0][0];
        }
        if (cachePath.empty()) cachePath = L".cef3\\cache";
        wchar_t absoluteCache[MAX_PATH] = {};
        if (GetFullPathNameW(cachePath.c_str(), MAX_PATH, absoluteCache, nullptr) > 0) cachePath = absoluteCache;
        CreateDirectoryW(cachePath.c_str(), nullptr);
        std::wstring globalUserAgent;
        for (int i = 0; i < spec_.controlCount && globalUserAgent.empty(); ++i) {
            const ControlSpec& control = spec_.controls[i];
            if (!IsType(control, L"CefBrowser") || !control.data2 || !control.data2[0]) continue;
            auto records = DecodeControlRecords(control.data2, 4);
            if (!records.empty() && records[0].size() > 1 && !records[0][1].empty()) globalUserAgent = records[0][1];
        }
        CefMainArgs mainArgs(GetModuleHandleW(nullptr));
        CefSettings settings = {};
        settings.size = sizeof(settings);
        settings.no_sandbox = true;
        settings.multi_threaded_message_loop = true;
        settings.windowless_rendering_enabled = false;
        CefString(&settings.cache_path).FromWString(cachePath);
        CefString(&settings.resources_dir_path).FromWString(resourcesDir);
        CefString(&settings.locales_dir_path).FromWString(resourcesDir + L"\\locales");
        if (!globalUserAgent.empty()) CefString(&settings.user_agent).FromWString(globalUserAgent);
        CefString(&settings.browser_subprocess_path).FromWString(std::wstring(modulePath));
        cefInitialized_ = CefInitialize(mainArgs, settings, nullptr, nullptr);
        if (!cefInitialized_) 调试输出(L"CEF3 初始化失败：请确认 exe 同目录存在 libcef.dll 和资源文件。");
        return cefInitialized_ ? 1 : 0;
#else
        调试输出(L"CEF3 不可用：构建环境缺少 CEF3 SDK 头文件，请恢复 Chromium Embedded Framework SDK。");
        return 0;
#endif
    }

    int CEF3_创建(const wchar_t* controlName) {
        bool hasTarget = false;
        for (int i = 0; i < spec_.controlCount; ++i) {
            const ControlSpec& control = spec_.controls[i];
            if (!IsType(control, L"CefBrowser")) continue;
            if (controlName && controlName[0] && !TextEquals(control.name, controlName)) continue;
            hasTarget = true;
            break;
        }
        if (!hasTarget) return 0;
#if LINGBUILDER_CEF3_AVAILABLE
        if (!CEF3_初始化()) return 0;
        int created = 0;
        for (int i = 0; i < spec_.controlCount; ++i) {
            const ControlSpec& control = spec_.controls[i];
            if (!IsType(control, L"CefBrowser")) continue;
            if (controlName && controlName[0] && !TextEquals(control.name, controlName)) continue;
            if (CEF3_创建单个(control)) ++created;
        }
        return created > 0 ? 1 : 0;
#else
        (void)controlName;
        调试输出(L"CEF3 不可用：构建环境缺少 CEF3 SDK。");
        return 0;
#endif
    }

#if LINGBUILDER_CEF3_AVAILABLE
    int CEF3_创建单个(const ControlSpec& control) {
        RuntimeControl* runtime = FindRuntimeControl(control.id);
        if (!runtime || !runtime->hwnd || !IsWindow(runtime->hwnd)) return 0;
        CefBrowserInstance* instance = CEF3_确保实例(control.id);
        if (instance->created && instance->browser) return 1;
        instance->host = runtime->hwnd;
        if (instance->url.empty() && control.data && control.data[0]) instance->url = control.data;
        RECT bounds = {};
        GetClientRect(instance->host, &bounds);
        CefRect cefBounds(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
        CefWindowInfo windowInfo = {};
        windowInfo.SetAsChild(instance->host, cefBounds);
        CefBrowserSettings browserSettings = {};
        browserSettings.size = sizeof(browserSettings);
        if (!instance->enableJs) browserSettings.javascript = STATE_DISABLED;
        if (!instance->loadImages) browserSettings.image_loading = STATE_DISABLED;
        if (!instance->enableWebGL) browserSettings.webgl = STATE_DISABLED;
        CefRefPtr<CefClient> client = LingCreateCefClient(this, control.id);
        std::wstring url = instance->url.empty() ? L"about:blank" : instance->url;
        instance->currentUrl = url;
        instance->created = true;
        bool requested = CefBrowserHost::CreateBrowser(windowInfo, client, url, browserSettings, nullptr, nullptr);
        if (!requested) { 调试输出(L"CEF3 创建浏览器请求失败。"); instance->created = false; return 0; }
        return 1;
    }
#else
    int CEF3_创建单个(const ControlSpec&) { return 0; }
#endif

    int CEF3_导航(const wchar_t* controlName, const wchar_t* address) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance) { 调试输出(L"CEF3 导航失败：找不到浏览器控件。"); return 0; }
        if (!instance->created || !instance->browser) {
            const ControlSpec* control = FindControl(instance->controlId);
            if (control) { instance->url = address ? address : L""; return CEF3_创建单个(*control); }
            return 0;
        }
        if (!address || !address[0]) return 0;
        instance->browser->GetMainFrame()->LoadURL(address);
        instance->currentUrl = address;
        return 1;
#else
        (void)controlName; (void)address; return 0;
#endif
    }

    std::wstring CEF3_执行JS(const wchar_t* controlName, const wchar_t* script) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || !instance->created || !instance->browser || !script) return L"";
        std::wstring wrapped = L"(function(){ try { var __r = (";
        wrapped += script;
        wrapped += L"); return (__r === undefined ? '' : String(__r)); } catch(e) { return 'JS错误: ' + e.message; } })();";
        instance->browser->GetMainFrame()->ExecuteJavaScript(wrapped, instance->currentUrl, 0);
        return L"";
#else
        (void)controlName; (void)script; return L"";
#endif
    }

    int CEF3_后退(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || !instance->browser || !instance->browser->CanGoBack()) return 0;
        instance->browser->GoBack(); return 1;
#else
        (void)controlName; return 0;
#endif
    }

    int CEF3_前进(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || !instance->browser || !instance->browser->CanGoForward()) return 0;
        instance->browser->GoForward(); return 1;
#else
        (void)controlName; return 0;
#endif
    }

    void CEF3_刷新(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (instance && instance->browser) instance->browser->Reload();
#else
        (void)controlName;
#endif
    }

    void CEF3_停止(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (instance && instance->browser) instance->browser->StopLoad();
#else
        (void)controlName;
#endif
    }

    std::wstring CEF3_取标题(const wchar_t* controlName) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance ? instance->currentTitle : L"";
    }

    std::wstring CEF3_取地址(const wchar_t* controlName) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance ? instance->currentUrl : L"";
    }

    int CEF3_设置缓存目录(const wchar_t* controlName, const wchar_t* directory) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance) return 0;
        if (instance->created) { 调试输出(L"CEF3 设置缓存目录需在创建前调用。"); return 0; }
        instance->cacheDirectory = directory ? directory : L"";
        return 1;
    }

    int CEF3_设置代理(const wchar_t* controlName, const wchar_t* proxy) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance) return 0;
        if (instance->created) { 调试输出(L"CEF3 设置代理需在创建前调用。"); return 0; }
        instance->proxyServer = proxy ? proxy : L"";
        return 1;
    }

    void CEF3_关闭(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        for (auto it = cefBrowsers_.begin(); it != cefBrowsers_.end();) {
            const ControlSpec* control = FindControl(it->second->controlId);
            bool match = !controlName || !controlName[0] || (control && TextEquals(control->name, controlName));
            if (match) {
                if (it->second->browser) it->second->browser->GetHost()->CloseBrowser(true);
                it = cefBrowsers_.erase(it);
            } else ++it;
        }
#else
        (void)controlName;
#endif
    }

    std::wstring CEF3_取最近事件(const wchar_t* controlName) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance ? instance->lastEvent : L"";
    }

    std::wstring CEF3_取事件数据(const wchar_t* controlName) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance ? instance->lastEventData : L"";
    }

    std::wstring CEF3_取事件字段(const wchar_t* controlName, const wchar_t* fieldName) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || !fieldName) return L"";
        auto found = instance->eventFields.find(fieldName);
        return found == instance->eventFields.end() ? L"" : found->second;
    }

    int CEF3_设置事件结果(const wchar_t* controlName, int action) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || action < 0 || action > 3) return 0;
        instance->eventAction = action;
        return 1;
    }

    int CEF3_设置事件返回文本(const wchar_t* controlName, const wchar_t* value) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance) return 0;
        instance->eventResultText = value ? value : L"";
        return 1;
    }

    int CEF3_绑定事件(const wchar_t* controlName, const wchar_t* eventName, const wchar_t* handler) {
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        if (!instance || !eventName || !handler) return 0;
        instance->handlers[eventName] = handler;
        return 1;
    }

    int CEF3_是否可后退(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance && instance->browser && instance->browser->CanGoBack() ? 1 : 0;
#else
        (void)controlName; return 0;
#endif
    }

    int CEF3_是否可前进(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance && instance->browser && instance->browser->CanGoForward() ? 1 : 0;
#else
        (void)controlName; return 0;
#endif
    }

    int CEF3_是否加载中(const wchar_t* controlName) {
#if LINGBUILDER_CEF3_AVAILABLE
        CefBrowserInstance* instance = CEF3_查找实例(controlName);
        return instance && instance->browser && instance->browser->IsLoading() ? 1 : 0;
#else
        (void)controlName; return 0;
#endif
    }

    void CEF3_记录事件(CefBrowserInstance& instance, const wchar_t* name, const wchar_t* data) {
        instance.lastEvent = name ? name : L"";
        instance.lastEventData = data ? data : L"";
        auto handler = instance.handlers.find(instance.lastEvent);
        if (handler != instance.handlers.end()) DispatchCefBrowserEvent(handler->second.c_str(), instance.controlId, instance.lastEvent.c_str(), instance.lastEventData.c_str());
    }

    void CEF3_处理事件包(LingCefEventPacket& packet) {
        auto found = cefBrowsers_.find(packet.controlId);
        if (found == cefBrowsers_.end()) return;
        CefBrowserInstance& instance = *found->second;
        instance.eventAction = 0;
        instance.eventResultText.clear();
        instance.eventFields = packet.fields;
        instance.lastEvent = packet.name;
        instance.lastEventData = packet.data;
        if (instance.lastEvent == L"标题被改变") instance.currentTitle = packet.data;
        if (instance.lastEvent == L"地址被改变") instance.currentUrl = packet.data;
        if (instance.lastEvent == L"开始加载") instance.isLoading = true;
        if (instance.lastEvent == L"加载完成" || instance.lastEvent == L"加载失败") instance.isLoading = false;
        std::wstring callback;
        auto explicitHandler = instance.handlers.find(instance.lastEvent);
        if (explicitHandler != instance.handlers.end()) callback = explicitHandler->second;
        if (callback.empty()) {
            const ControlSpec* control = FindControl(instance.controlId);
            if (control) {
                std::wstring eventId = GetCef3DesignerEventId(instance.lastEvent.c_str());
                callback = GetEventHandler(*control, eventId.c_str());
            }
        }
        if (!callback.empty()) DispatchCefBrowserEvent(callback.c_str(), instance.controlId, instance.lastEvent.c_str(), instance.lastEventData.c_str());
        packet.action = instance.eventAction;
        packet.resultText = instance.eventResultText;
    }

    void CEF3_发送事件(LingCefEventPacket& packet) {
        if (!hwnd_ || !IsWindow(hwnd_)) return;
        DWORD windowThread = GetWindowThreadProcessId(hwnd_, nullptr);
        if (windowThread == GetCurrentThreadId()) {
            CEF3_处理事件包(packet);
            return;
        }
        packet.synchronous = true;
        SendMessageW(hwnd_, WM_LINGBUILDER_CEF_EVENT, 0, reinterpret_cast<LPARAM>(&packet));
    }

    void CEF3_投递事件(int controlId, const wchar_t* name, const wchar_t* data,
                       std::map<std::wstring, std::wstring> fields = {}) {
        if (!hwnd_ || !IsWindow(hwnd_)) return;
        auto* packet = new LingCefEventPacket();
        packet->controlId = controlId;
        packet->name = name ? name : L"";
        packet->data = data ? data : L"";
        packet->fields = std::move(fields);
        if (!PostMessageW(hwnd_, WM_LINGBUILDER_CEF_EVENT, 0, reinterpret_cast<LPARAM>(packet))) delete packet;
    }

    virtual void DispatchCefBrowserEvent(const wchar_t* handler, int controlId, const wchar_t* eventName, const wchar_t* data) {
        std::wstring message = L"CEF3 事件未绑定到中文处理器：";
        message += handler ? handler : L"";
        message += L" / ";
        message += eventName ? eventName : L"";
        调试输出(message.c_str());
        (void)controlId; (void)data;
    }

    void CEF3_调整全部大小() {
#if LINGBUILDER_CEF3_AVAILABLE
        for (auto& item : cefBrowsers_) {
            if (!item.second->created || !item.second->host) continue;
            RECT bounds = {};
            GetClientRect(item.second->host, &bounds);
            HWND browserHwnd = item.second->browser ? item.second->browser->GetHost()->GetWindowHandle() : nullptr;
            if (browserHwnd && IsWindow(browserHwnd)) SetWindowPos(browserHwnd, nullptr, 0, 0, bounds.right, bounds.bottom, SWP_NOZORDER | SWP_NOACTIVATE);
        }
#endif
    }

    void CEF3_关闭全部() {
#if LINGBUILDER_CEF3_AVAILABLE
        for (auto& item : cefBrowsers_) {
            if (item.second->browser) item.second->browser->GetHost()->CloseBrowser(true);
        }
        cefBrowsers_.clear();
#endif
    }

#if LINGBUILDER_CEF3_AVAILABLE
    friend class LingCefClient;
#endif
    void CEF3_通知加载状态(int controlId, bool isLoading, bool canGoBack, bool canGoForward) {
        auto found = cefBrowsers_.find(controlId);
        if (found == cefBrowsers_.end()) return;
        CefBrowserInstance& instance = *found->second;
        bool wasLoading = instance.isLoading;
        instance.isLoading = isLoading;
        instance.canGoBack = canGoBack;
        instance.canGoForward = canGoForward;
        if (isLoading && !wasLoading) CEF3_记录事件(instance, L"开始加载", instance.currentUrl.c_str());
    }

    void CEF3_通知加载完成(int controlId, bool success, const wchar_t* url) {
        auto found = cefBrowsers_.find(controlId);
        if (found == cefBrowsers_.end()) return;
        CefBrowserInstance& instance = *found->second;
        if (url && url[0]) instance.currentUrl = url;
        CEF3_记录事件(instance, success ? L"加载完成" : L"加载失败", instance.currentUrl.c_str());
    }

    void CEF3_通知标题(int controlId, const wchar_t* title) {
        auto found = cefBrowsers_.find(controlId);
        if (found == cefBrowsers_.end()) return;
        CefBrowserInstance& instance = *found->second;
        instance.currentTitle = title ? title : L"";
        CEF3_记录事件(instance, L"标题被改变", instance.currentTitle.c_str());
    }

    void CEF3_通知地址(int controlId, const wchar_t* url) {
        auto found = cefBrowsers_.find(controlId);
        if (found == cefBrowsers_.end()) return;
        CefBrowserInstance& instance = *found->second;
        instance.currentUrl = url ? url : L"";
        CEF3_记录事件(instance, L"地址被改变", instance.currentUrl.c_str());
    }

    void CEF3_通知关闭(int controlId) {
        cefBrowsers_.erase(controlId);
    }

#if LINGBUILDER_CEF3_AVAILABLE
    void CEF3_通知已创建(int controlId, CefRefPtr<CefBrowser> browser) {
        auto found = cefBrowsers_.find(controlId);
        if (found == cefBrowsers_.end()) return;
        found->second->browser = browser;
        if (found->second->muteAudio && browser && browser->GetHost()) browser->GetHost()->SetAudioMuted(true);
        CEF3_调整全部大小();
    }
#endif

    std::wstring 选择系统项目(const wchar_t* title, const wchar_t* filter, bool save, bool folder) {
        lastDialogStatus_ = -1;
        IFileDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(
            save ? CLSID_FileSaveDialog : CLSID_FileOpenDialog,
            nullptr,
            CLSCTX_INPROC_SERVER,
            IID_PPV_ARGS(&dialog)
        );
        if (FAILED(result) || !dialog) return L"";
        if (title && title[0]) dialog->SetTitle(title);
        std::vector<std::wstring> filterParts;
        if (filter && filter[0] && !folder) {
            std::wstring source(filter); size_t start = 0;
            while (start <= source.size()) { size_t end = source.find(L'|', start); filterParts.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
            if (filterParts.size() >= 2) {
                std::vector<COMDLG_FILTERSPEC> specs;
                for (size_t index = 0; index + 1 < filterParts.size(); index += 2) specs.push_back({ filterParts[index].c_str(), filterParts[index + 1].c_str() });
                dialog->SetFileTypes(static_cast<UINT>(specs.size()), specs.data()); dialog->SetFileTypeIndex(1);
            }
        }
        if (folder) {
            FILEOPENDIALOGOPTIONS options = {};
            dialog->GetOptions(&options);
            dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
        }
        std::wstring path;
        result = dialog->Show(hwnd_);
        if (SUCCEEDED(result)) {
            lastDialogStatus_ = 1;
            IShellItem* item = nullptr;
            if (SUCCEEDED(dialog->GetResult(&item)) && item) {
                PWSTR value = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &value)) && value) {
                    path = value;
                    CoTaskMemFree(value);
                }
                item->Release();
            }
        } else if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) lastDialogStatus_ = 0;
        dialog->Release();
        return path;
    }

    std::wstring 打开文件(const wchar_t* title, const wchar_t* filter) { return 选择系统项目(title, filter, false, false); }
    std::wstring 保存文件(const wchar_t* title, const wchar_t* filter) { return 选择系统项目(title, filter, true, false); }
    std::wstring 选择文件夹(const wchar_t* title) { return 选择系统项目(title, nullptr, false, true); }
    int 系统对话框_状态() const { return lastDialogStatus_; }

    const FileDialogSpec* FindFileDialog(const wchar_t* componentName) const {
        if (!componentName) return nullptr;
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex != spec_.index) continue;
            if (TextEquals(dialog.name, componentName) || TextEquals(dialog.id, componentName)) return &dialog;
        }
        return nullptr;
    }

    bool OpenFileDialogResource(const FileDialogSpec& spec) {
        lastDialogStatus_ = -1;
        IFileOpenDialog* dialog = nullptr;
        HRESULT result = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
        if (FAILED(result) || !dialog) return false;
        if (spec.title && spec.title[0]) dialog->SetTitle(spec.title);
        FILEOPENDIALOGOPTIONS options = {};
        dialog->GetOptions(&options);
        dialog->SetOptions(options | FOS_FORCEFILESYSTEM | (spec.multiple ? FOS_ALLOWMULTISELECT : 0));
        std::vector<std::wstring> filterParts;
        if (spec.filter && spec.filter[0]) {
            std::wstring source(spec.filter); size_t start = 0;
            while (start <= source.size()) { size_t end = source.find(L'|', start); filterParts.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
            if (filterParts.size() >= 2) {
                std::vector<COMDLG_FILTERSPEC> filters;
                for (size_t index = 0; index + 1 < filterParts.size(); index += 2) filters.push_back({ filterParts[index].c_str(), filterParts[index + 1].c_str() });
                dialog->SetFileTypes(static_cast<UINT>(filters.size()), filters.data());
                dialog->SetFileTypeIndex(1);
            }
        }
        result = dialog->Show(hwnd_);
        if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
            lastDialogStatus_ = 0;
            dialog->Release();
            DispatchDesignerResourceEvent(spec.id, L"Cancelled");
            return false;
        }
        if (FAILED(result)) { dialog->Release(); return false; }
        std::vector<std::wstring> files;
        IShellItemArray* items = nullptr;
        if (SUCCEEDED(dialog->GetResults(&items)) && items) {
            DWORD count = 0; items->GetCount(&count);
            for (DWORD index = 0; index < count; ++index) {
                IShellItem* item = nullptr;
                if (FAILED(items->GetItemAt(index, &item)) || !item) continue;
                PWSTR path = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) { files.emplace_back(path); CoTaskMemFree(path); }
                item->Release();
            }
            items->Release();
        }
        dialog->Release();
        if (!spec.multiple && files.size() > 1) files.resize(1);
        UpdateFileDialogImageTarget(spec, files);
        fileDialogFiles_[spec.id] = std::move(files);
        lastDialogStatus_ = 1;
        DispatchDesignerResourceEvent(spec.id, L"FilesSelected");
        return true;
    }

    bool 文件对话框_打开(const wchar_t* componentName) {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) { lastDialogStatus_ = -1; return false; }
        return OpenFileDialogResource(*dialog);
    }
    bool 文件对话框_清空(const wchar_t* componentName) {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return false;
        fileDialogFiles_[dialog->id].clear();
        return true;
    }
    int 文件对话框_取文件数量(const wchar_t* componentName) const {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return 0;
        auto found = fileDialogFiles_.find(dialog->id);
        return found == fileDialogFiles_.end() ? 0 : static_cast<int>(found->second.size());
    }
    const wchar_t* 文件对话框_取文件(const wchar_t* componentName, int index) const {
        const FileDialogSpec* dialog = FindFileDialog(componentName);
        if (!dialog) return L"";
        auto found = fileDialogFiles_.find(dialog->id);
        return found != fileDialogFiles_.end() && index >= 0 && index < static_cast<int>(found->second.size()) ? found->second[static_cast<size_t>(index)].c_str() : L"";
    }
    bool HandleFileDialogTrigger(int controlId) {
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex == spec_.index && dialog.triggerControlId == controlId) return OpenFileDialogResource(dialog);
        }
        return false;
    }
    bool HasFileDialogDropTarget() const {
        for (int index = 0; index < g_fileDialogCount; ++index) if (g_fileDialogs[index].ownerWindowIndex == spec_.index && g_fileDialogs[index].allowDrop) return true;
        return false;
    }
    bool FileDialogAcceptsPath(const FileDialogSpec& dialog, const std::wstring& path) const {
        if (!dialog.filter || !dialog.filter[0]) return true;
        std::wstring source(dialog.filter); std::wstring patterns; size_t start = 0; int part = 0;
        while (start <= source.size()) {
            size_t end = source.find(L'|', start);
            std::wstring value = source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
            if ((part % 2) == 1 && !value.empty()) { if (!patterns.empty()) patterns += L";"; patterns += value; }
            if (end == std::wstring::npos) break;
            start = end + 1; ++part;
        }
        return patterns.empty() || PathMatchSpecW(path.c_str(), patterns.c_str()) == TRUE;
    }
    void UpdateFileDialogImageTarget(const FileDialogSpec& dialog, const std::vector<std::wstring>& files) {
        if (dialog.dropTargetControlId == 0 || files.empty()) return;
        const ControlSpec* control = FindControl(dialog.dropTargetControlId);
        RuntimeControl* runtime = FindRuntimeControl(dialog.dropTargetControlId);
        if (!control || !runtime || !runtime->hwnd || !IsType(*control, L"Image")) return;
        HBITMAP bitmap = LoadWicBitmap(files.front().c_str(), ScaleForDpi(control->width, dpi_), ScaleForDpi(control->height, dpi_), control->option1);
        if (!bitmap) return;
        HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap)));
        if (previous && previous != bitmap) DeleteObject(previous);
        runtime->resource = bitmap;
        runtime->iconResource = false;
        InvalidateRect(runtime->hwnd, nullptr, TRUE);
    }
    bool HandleFileDialogDrop(POINT dropPoint, const std::vector<std::wstring>& files) {
        for (int index = 0; index < g_fileDialogCount; ++index) {
            const FileDialogSpec& dialog = g_fileDialogs[index];
            if (dialog.ownerWindowIndex != spec_.index || !dialog.allowDrop) continue;
            if (dialog.dropTargetControlId != 0) {
                RuntimeControl* runtime = FindRuntimeControl(dialog.dropTargetControlId);
                if (!runtime || !runtime->hwnd) continue;
                RECT bounds = {}; GetWindowRect(runtime->hwnd, &bounds);
                MapWindowPoints(HWND_DESKTOP, hwnd_, reinterpret_cast<POINT*>(&bounds), 2);
                if (!PtInRect(&bounds, dropPoint)) continue;
            }
            std::vector<std::wstring> accepted;
            for (const auto& path : files) if (FileDialogAcceptsPath(dialog, path)) accepted.push_back(path);
            if (accepted.empty()) return true;
            if (!dialog.multiple && accepted.size() > 1) accepted.resize(1);
            UpdateFileDialogImageTarget(dialog, accepted);
            fileDialogFiles_[dialog.id] = std::move(accepted);
            lastDialogStatus_ = 1;
            DispatchDesignerResourceEvent(dialog.id, L"FilesDropped");
            return true;
        }
        return false;
    }
    const MenuResourceSpec* FindMenuResource(const wchar_t* componentName) const {
        if (!componentName) return nullptr;
        for (int index = 0; index < g_menuResourceCount; ++index) {
            const MenuResourceSpec& menu = g_menuResources[index];
            if (menu.ownerWindowIndex != spec_.index) continue;
            if (TextEquals(menu.name, componentName) || TextEquals(menu.id, componentName)) return &menu;
        }
        return nullptr;
    }
    bool ShowMenuResource(const MenuResourceSpec& spec, POINT screenPoint) {
        auto rows = DecodeControlRecords(spec.items, 6);
        HMENU menu = CreatePopupMenu();
        if (!menu) return false;
        std::map<UINT, std::wstring> itemIds;
        UINT nextCommand = 62000;
        for (const auto& row : rows) {
            if (row.size() < 6) continue;
            bool separator = row[2] == L"1";
            if (separator) { AppendMenuW(menu, MF_SEPARATOR, 0, nullptr); continue; }
            UINT flags = MF_STRING;
            if (row[3] != L"1") flags |= MF_GRAYED;
            if (row[4] == L"1") flags |= MF_CHECKED;
            UINT command = nextCommand++;
            AppendMenuW(menu, flags, command, row[1].c_str());
            itemIds.emplace(command, row[0]);
        }
        SetForegroundWindow(hwnd_);
        UINT selected = TrackPopupMenuEx(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, screenPoint.x, screenPoint.y, hwnd_, nullptr);
        DestroyMenu(menu);
        auto found = itemIds.find(selected);
        if (found == itemIds.end()) return false;
        lastMenuItems_[spec.id] = found->second;
        DispatchDesignerResourceEvent(spec.id, found->second.c_str());
        return true;
    }
    bool ShowMenuAtCursor(const MenuResourceSpec& spec) {
        POINT point = {}; GetCursorPos(&point);
        return ShowMenuResource(spec, point);
    }
    bool 上下文菜单_显示(const wchar_t* componentName) {
        const MenuResourceSpec* menu = FindMenuResource(componentName);
        return menu && menu->contextMenu ? ShowMenuAtCursor(*menu) : false;
    }
    bool 弹出菜单_显示(const wchar_t* componentName) {
        const MenuResourceSpec* menu = FindMenuResource(componentName);
        return menu && !menu->contextMenu ? ShowMenuAtCursor(*menu) : false;
    }
    bool 弹出菜单_在坐标显示(const wchar_t* componentName, int x, int y) {
        const MenuResourceSpec* menu = FindMenuResource(componentName);
        if (!menu || menu->contextMenu) return false;
        POINT point = { x, y };
        return ShowMenuResource(*menu, point);
    }
    const wchar_t* 菜单_取最后项目(const wchar_t* componentName) const {
        const MenuResourceSpec* menu = FindMenuResource(componentName);
        if (!menu) return L"";
        auto found = lastMenuItems_.find(menu->id);
        return found == lastMenuItems_.end() ? L"" : found->second.c_str();
    }
    bool HandleContextMenu(HWND source, LPARAM coordinates) {
        int targetControlId = !source || source == hwnd_ ? 0 : GetDlgCtrlID(source);
        for (int index = 0; index < g_menuResourceCount; ++index) {
            const MenuResourceSpec& menu = g_menuResources[index];
            if (!menu.contextMenu || menu.ownerWindowIndex != spec_.index || menu.targetControlId != targetControlId) continue;
            POINT point = { static_cast<short>(LOWORD(coordinates)), static_cast<short>(HIWORD(coordinates)) };
            if (point.x == -1 && point.y == -1) {
                RECT bounds = {}; GetWindowRect(source && source != hwnd_ ? source : hwnd_, &bounds);
                point = { bounds.left + 8, bounds.top + 24 };
            }
            return ShowMenuResource(menu, point);
        }
        return false;
    }
    int 工具栏_最后命令() const { return lastToolbarCommand_; }
    int 状态栏_最后分区() const { return lastStatusPart_; }
    std::wstring 查找替换_动作() const { return lastFindAction_; }
    std::wstring 查找替换_查找内容() const { return lastFindText_; }
    std::wstring 查找替换_替换内容() const { return lastReplaceText_; }

    bool 颜色选择器_打开(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsType(*control, L"ColorPicker") || runtime->colorDialogOpen) return false;
        runtime->colorDialogOpen = true;
        DispatchLingEvent(*control, L"Opened");
        COLORREF selected = runtime->colorValue;
        bool confirmed = ShowModernColorPickerDialog(hwnd_, control->option1, runtime->colorValue, selected);
        if (confirmed) {
            COLORREF previous = runtime->colorValue;
            runtime->colorValue = selected;
            InvalidateRect(runtime->hwnd, nullptr, TRUE);
            if (previous != runtime->colorValue) DispatchLingEvent(*control, L"ColorChanged");
            DispatchLingEvent(*control, L"Confirmed");
        } else {
            DispatchLingEvent(*control, L"Cancelled");
        }
        runtime->colorDialogOpen = false;
        DispatchLingEvent(*control, L"Closed");
        return confirmed;
    }

    bool 颜色选择器_置颜色(const wchar_t* controlName, int color) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsType(*control, L"ColorPicker")) return false;
        COLORREF next = static_cast<COLORREF>(color) & 0x00FFFFFFu;
        if (runtime->colorValue == next) return true;
        runtime->colorValue = next;
        InvalidateRect(runtime->hwnd, nullptr, TRUE);
        DispatchLingEvent(*control, L"ColorChanged");
        return true;
    }

    int 颜色选择器_取颜色(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsType(*control, L"ColorPicker")
            ? static_cast<int>(runtime->colorValue)
            : -1;
    }

    int 选择颜色(int defaultColor) {
        lastDialogStatus_ = 0;
        COLORREF selected = static_cast<COLORREF>(defaultColor) & 0x00FFFFFFu;
        if (!ShowModernColorPickerDialog(hwnd_, L"选择颜色", selected, selected)) return defaultColor;
        lastDialogStatus_ = 1;
        return static_cast<int>(selected);
    }

    std::wstring 选择字体(int defaultSize) {
        lastDialogStatus_ = 0;
        LOGFONTW font = {};
        wcscpy_s(font.lfFaceName, L"Microsoft YaHei UI");
        font.lfHeight = -MulDiv(defaultSize > 0 ? defaultSize : 12, static_cast<int>(dpi_), 72);
        CHOOSEFONTW dialog = {};
        dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_; dialog.lpLogFont = &font;
        dialog.Flags = CF_SCREENFONTS | CF_INITTOLOGFONTSTRUCT;
        if (!ChooseFontW(&dialog)) return L"";
        lastDialogStatus_ = 1;
        std::wstringstream result;
        result << font.lfFaceName << L"," << (dialog.iPointSize / 10);
        return result.str();
    }

    void 查找文本(const wchar_t* initial) {
        wcsncpy_s(findBuffer_, initial ? initial : L"", _TRUNCATE);
        findReplace_ = {}; findReplace_.lStructSize = sizeof(findReplace_); findReplace_.hwndOwner = hwnd_;
        findReplace_.lpstrFindWhat = findBuffer_; findReplace_.wFindWhatLen = 256;
        findDialog_ = FindTextW(&findReplace_);
        lastDialogStatus_ = findDialog_ ? 1 : -1;
    }

    void 替换文本(const wchar_t* initial, const wchar_t* replacement) {
        wcsncpy_s(findBuffer_, initial ? initial : L"", _TRUNCATE);
        wcsncpy_s(replaceBuffer_, replacement ? replacement : L"", _TRUNCATE);
        findReplace_ = {}; findReplace_.lStructSize = sizeof(findReplace_); findReplace_.hwndOwner = hwnd_;
        findReplace_.lpstrFindWhat = findBuffer_; findReplace_.wFindWhatLen = 256;
        findReplace_.lpstrReplaceWith = replaceBuffer_; findReplace_.wReplaceWithLen = 256;
        findDialog_ = ReplaceTextW(&findReplace_);
        lastDialogStatus_ = findDialog_ ? 1 : -1;
    }

    bool 打印文本(const wchar_t* documentName, const wchar_t* text) {
        lastDialogStatus_ = 0;
        PRINTDLGW dialog = {}; dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_;
        dialog.Flags = PD_RETURNDC | PD_NOPAGENUMS;
        bool accepted = PrintDlgW(&dialog) == TRUE;
        if (accepted && dialog.hDC) {
            DOCINFOW info = {}; info.cbSize = sizeof(info); info.lpszDocName = documentName && documentName[0] ? documentName : L"LingBuilder 文档";
            if (StartDocW(dialog.hDC, &info) > 0) {
                if (StartPage(dialog.hDC) > 0) {
                    RECT area = { 120, 120, GetDeviceCaps(dialog.hDC, HORZRES) - 120, GetDeviceCaps(dialog.hDC, VERTRES) - 120 };
                    std::wstring printable = text ? text : L"";
                    DrawTextW(dialog.hDC, printable.data(), static_cast<int>(printable.size()), &area, DT_LEFT | DT_TOP | DT_WORDBREAK | DT_NOPREFIX);
                    EndPage(dialog.hDC);
                }
                EndDoc(dialog.hDC);
                lastDialogStatus_ = 1;
            } else lastDialogStatus_ = -1;
        }
        if (dialog.hDC) DeleteDC(dialog.hDC);
        if (dialog.hDevMode) GlobalFree(dialog.hDevMode);
        if (dialog.hDevNames) GlobalFree(dialog.hDevNames);
        return accepted;
    }
    bool 打印() { return 打印文本(L"LingBuilder 文档", L""); }

    bool 页面设置() {
        lastDialogStatus_ = 0;
        PAGESETUPDLGW dialog = {}; dialog.lStructSize = sizeof(dialog); dialog.hwndOwner = hwnd_;
        bool accepted = PageSetupDlgW(&dialog) == TRUE;
        if (accepted) { lastPageMargins_ = dialog.rtMargin; lastDialogStatus_ = 1; }
        if (dialog.hDevMode) GlobalFree(dialog.hDevMode);
        if (dialog.hDevNames) GlobalFree(dialog.hDevNames);
        return accepted;
    }
    int 页面设置_左边距() const { return lastPageMargins_.left; }
    int 页面设置_上边距() const { return lastPageMargins_.top; }
    int 页面设置_右边距() const { return lastPageMargins_.right; }
    int 页面设置_下边距() const { return lastPageMargins_.bottom; }

    int 属性页_显示(const wchar_t* resourceId) {
        const PropertySheetSpec* spec = nullptr;
        for (int index = 0; index < g_propertySheetCount; ++index) if (TextEquals(g_propertySheets[index].id, resourceId)) { spec = &g_propertySheets[index]; break; }
        if (!spec) { lastDialogStatus_ = -1; 调试输出(L"属性页资源不存在。"); return -1; }
        auto rows = DecodeControlRecords(spec->pages, 4);
        if (rows.empty()) { lastDialogStatus_ = -1; 调试输出(L"属性页资源没有页面。"); return -1; }
        std::vector<PropertySheetPageContext> contexts(rows.size());
        std::vector<std::vector<BYTE>> templates(rows.size());
        std::vector<PROPSHEETPAGEW> pages(rows.size());
        std::vector<std::unique_ptr<LingWindowBase>> pageOwners(rows.size());
        for (size_t index = 0; index < rows.size(); ++index) {
            int sourceWindowIndex = _wtoi(rows[index][3].c_str());
            if (sourceWindowIndex >= 0 && sourceWindowIndex < g_windowCount) pageOwners[index].reset(CreateWindowObject(sourceWindowIndex));
            contexts[index] = { rows[index][1].c_str(), rows[index][2].c_str(), spec->id, this, nullptr, pageOwners[index].get(), nullptr };
            if (pageOwners[index]) contexts[index].initialize = [](void* owner, HWND host) { static_cast<LingWindowBase*>(owner)->AttachPropertyPage(host); };
            if (index == 0) contexts[index].applied = [](void* owner, const wchar_t* id) { static_cast<LingWindowBase*>(owner)->DispatchDesignerResourceEvent(id, L"Applied"); };
            templates[index] = BuildPropertySheetTemplate();
            PROPSHEETPAGEW page = {}; page.dwSize = sizeof(page); page.dwFlags = PSP_DLGINDIRECT | PSP_USETITLE;
            page.hInstance = g_instance; page.pResource = reinterpret_cast<LPCDLGTEMPLATE>(templates[index].data());
            page.pszTitle = contexts[index].title; page.pfnDlgProc = GeneratedPropertySheetPageProc; page.lParam = reinterpret_cast<LPARAM>(&contexts[index]);
            pages[index] = page;
        }
        PROPSHEETHEADERW header = {}; header.dwSize = sizeof(header); header.dwFlags = PSH_PROPSHEETPAGE | PSH_PROPTITLE;
        header.hwndParent = hwnd_; header.hInstance = g_instance; header.pszCaption = spec->title;
        header.nPages = static_cast<UINT>(pages.size()); header.ppsp = pages.data();
        INT_PTR result = PropertySheetW(&header); lastDialogStatus_ = result == -1 ? -1 : result == 0 ? 0 : 1;
        for (auto& owner : pageOwners) if (owner) owner->ReleasePropertyPage();
        return static_cast<int>(result);
    }

    int 任务对话框(const wchar_t* title, const wchar_t* content) {
        lastDialogStatus_ = -1;
        int button = 0;
        HRESULT result = TaskDialog(hwnd_, g_instance, title, title, content, TDCBF_OK_BUTTON, TD_INFORMATION_ICON, &button);
        if (FAILED(result)) { int fallback = MessageBoxW(hwnd_, content, title, MB_OK | MB_ICONINFORMATION); lastDialogStatus_ = fallback ? 1 : -1; return fallback; }
        lastDialogStatus_ = 1;
        return button;
    }

    void 结束() {
        if (hwnd_) PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    }

    int 线程_启动延时输出(const wchar_t* text, int delayMs) {
        const int taskId = nextThreadTaskId_.fetch_add(1);
        const std::wstring message = text ? text : L"";
        const int safeDelayMs = (std::max)(0, delayMs);
        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, message, safeDelayMs]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(safeDelayMs));
                std::wstring output = message;
                output += L"\n";
                OutputDebugStringW(output.c_str());
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) {
            activeThreadTasks_.fetch_sub(1);
            调试输出(L"线程任务启动失败：无法创建后台线程。");
            return 0;
        }
        return taskId;
    }

    void 线程_等待全部() {
        std::vector<std::thread> tasks;
        {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            tasks.swap(threadTasks_);
        }
        for (auto& task : tasks) {
            if (task.joinable()) task.join();
        }
    }

    int 线程_活动数量() const {
        return activeThreadTasks_.load();
    }

    int 线程_硬件并发数() const {
        return static_cast<int>(std::thread::hardware_concurrency());
    }

    void 线程_休眠(int milliseconds) {
        std::this_thread::sleep_for(std::chrono::milliseconds((std::max)(0, milliseconds)));
    }

    int 线程_启动延时设置文本(const wchar_t* controlName, const wchar_t* text, int delayMs) {
        const int taskId = nextThreadTaskId_.fetch_add(1);
        const std::wstring name = controlName ? controlName : L"";
        const std::wstring content = text ? text : L"";
        const int safeDelayMs = (std::max)(0, delayMs);
        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, name, content, safeDelayMs]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(safeDelayMs));
                { std::lock_guard<std::mutex> uiLock(threadUiMutex_); threadUiQueue_.push_back({ 0, name, content }); }
                if (hwnd_) PostMessageW(hwnd_, WM_LINGBUILDER_THREAD_UI_UPDATE, 0, 0);
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) { activeThreadTasks_.fetch_sub(1); return 0; }
        return taskId;
    }

    int 线程_启动延时添加行(const wchar_t* controlName, const wchar_t* tabSeparatedCells, int delayMs) {
        const int taskId = nextThreadTaskId_.fetch_add(1);
        const std::wstring name = controlName ? controlName : L"";
        const std::wstring content = tabSeparatedCells ? tabSeparatedCells : L"";
        const int safeDelayMs = (std::max)(0, delayMs);
        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, name, content, safeDelayMs]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(safeDelayMs));
                { std::lock_guard<std::mutex> uiLock(threadUiMutex_); threadUiQueue_.push_back({ 1, name, content }); }
                if (hwnd_) PostMessageW(hwnd_, WM_LINGBUILDER_THREAD_UI_UPDATE, 0, 0);
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) { activeThreadTasks_.fetch_sub(1); return 0; }
        return taskId;
    }

    int 线程_启动延时添加项目(const wchar_t* controlName, const wchar_t* text, int delayMs) {
        const int taskId = nextThreadTaskId_.fetch_add(1);
        const std::wstring name = controlName ? controlName : L"";
        const std::wstring content = text ? text : L"";
        const int safeDelayMs = (std::max)(0, delayMs);
        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, name, content, safeDelayMs]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(safeDelayMs));
                { std::lock_guard<std::mutex> uiLock(threadUiMutex_); threadUiQueue_.push_back({ 2, name, content }); }
                if (hwnd_) PostMessageW(hwnd_, WM_LINGBUILDER_THREAD_UI_UPDATE, 0, 0);
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) { activeThreadTasks_.fetch_sub(1); return 0; }
        return taskId;
    }

#ifdef LINGBUILDER_WEB_HTTP_MODULE
    int 网页_异步访问(const wchar_t* url, int accessMethod, const wchar_t* completionHandler) {
        const std::wstring address = url ? url : L"";
        const std::wstring handler = completionHandler ? completionHandler : L"";
        if (address.empty() || handler.empty()) {
            调试输出(L"网页异步访问启动失败：网址和完成处理器不能为空。");
            return 0;
        }

        const int requestId = nextAsyncWebRequestId_.fetch_add(1);
        {
            std::lock_guard<std::mutex> lock(asyncWebMutex_);
            AsyncWebResult pending;
            pending.handler = handler;
            asyncWebResults_[requestId] = std::move(pending);
        }

        activeThreadTasks_.fetch_add(1);
        try {
            std::lock_guard<std::mutex> lock(threadTasksMutex_);
            threadTasks_.emplace_back([this, requestId, address, accessMethod]() {
                AsyncWebResult completed;
                {
                    std::lock_guard<std::mutex> executionLock(asyncWebExecutionMutex_);
                    网页_访问_对象(address, accessMethod);
                    completed.text = 网页_取返回文本();
                    completed.cookies = 网页_取返回Cookies();
                    completed.headers = 网页_取返回协议头();
                    completed.statusCode = 网页_取返回状态代码();
                    completed.error = 网页_取错误信息();
                }

                bool notify = false;
                {
                    std::lock_guard<std::mutex> resultLock(asyncWebMutex_);
                    auto found = asyncWebResults_.find(requestId);
                    if (found != asyncWebResults_.end()) {
                        completed.handler = found->second.handler;
                        completed.cancelled = found->second.cancelled;
                        if (completed.cancelled) {
                            completed.text.clear();
                            completed.error = L"请求已取消。";
                        }
                        completed.completed = true;
                        found->second = std::move(completed);
                        notify = true;
                    }
                }

                if (notify && hwnd_) {
                    PostMessageW(hwnd_, WM_LINGBUILDER_WEB_ASYNC_COMPLETE, static_cast<WPARAM>(requestId), 0);
                }
                activeThreadTasks_.fetch_sub(1);
            });
        } catch (...) {
            activeThreadTasks_.fetch_sub(1);
            std::lock_guard<std::mutex> resultLock(asyncWebMutex_);
            auto found = asyncWebResults_.find(requestId);
            if (found != asyncWebResults_.end()) {
                found->second.completed = true;
                found->second.error = L"无法创建网页访问后台线程。";
            }
            return 0;
        }
        return requestId;
    }

    std::wstring 网页_异步取返回文本(int requestId) {
        std::lock_guard<std::mutex> lock(asyncWebMutex_);
        auto found = asyncWebResults_.find(requestId);
        return found == asyncWebResults_.end() ? L"" : found->second.text;
    }

    int 网页_异步取状态代码(int requestId) {
        std::lock_guard<std::mutex> lock(asyncWebMutex_);
        auto found = asyncWebResults_.find(requestId);
        return found == asyncWebResults_.end() ? 0 : found->second.statusCode;
    }

    std::wstring 网页_异步取错误信息(int requestId) {
        std::lock_guard<std::mutex> lock(asyncWebMutex_);
        auto found = asyncWebResults_.find(requestId);
        return found == asyncWebResults_.end() ? L"请求编号不存在。" : found->second.error;
    }

    int 网页_异步取当前请求编号() const {
        return currentAsyncWebRequestId_;
    }

    bool 网页_异步取消(int requestId) {
        std::lock_guard<std::mutex> lock(asyncWebMutex_);
        auto found = asyncWebResults_.find(requestId);
        if (found == asyncWebResults_.end() || found->second.completed) return false;
        found->second.cancelled = true;
        return true;
    }
#endif

    void 线程_批量启动(const wchar_t* taskCountControl, const wchar_t* threadCountControl, const wchar_t* listViewName, const wchar_t* logListName, const wchar_t* statusLabelName) {
        int taskCount = 20;
        int threadCount = 4;
        std::wstring taskText = 控件_取文本(taskCountControl);
        std::wstring threadText = 控件_取文本(threadCountControl);
        if (!taskText.empty()) { int parsed = _wtoi(taskText.c_str()); if (parsed > 0) taskCount = parsed; }
        if (!threadText.empty()) { int parsed = _wtoi(threadText.c_str()); if (parsed > 0) threadCount = parsed; }
        if (taskCount > 100000) taskCount = 100000;
        if (threadCount > 64) threadCount = 64;
        batchProgress_ = std::make_unique<BatchProgress>();
        batchProgress_->totalTasks = taskCount;
        batchProgress_->totalThreads = threadCount;
        batchProgress_->lvName = listViewName ? listViewName : L"";
        batchProgress_->logName = logListName ? logListName : L"";
        batchProgress_->stName = statusLabelName ? statusLabelName : L"";
        batchProgress_->active = true;
        batchProgress_->completed.store(0);
        batchProgress_->threadsDone.store(0);
        batchProgress_->lastLvSample = 0;
        控件_添加项目(batchProgress_->logName.c_str(), (L"[配置] 任务数=" + std::to_wstring(taskCount) + L" 线程数=" + std::to_wstring(threadCount)).c_str());
        if (hwnd_) SetTimer(hwnd_, 0x4C44, 80, nullptr);
        const int totalTasks = taskCount;
        const int totalThreads = threadCount;
        const int tasksPerThread = (totalTasks + totalThreads - 1) / totalThreads;
        for (int t = 0; t < totalThreads; ++t) {
            const int threadIndex = t + 1;
            const int startTask = t * tasksPerThread + 1;
            const int endTask = (std::min)((t + 1) * tasksPerThread, totalTasks);
            if (startTask > totalTasks) break;
            activeThreadTasks_.fetch_add(1);
            try {
                std::lock_guard<std::mutex> lock(threadTasksMutex_);
                threadTasks_.emplace_back([this, threadIndex, startTask, endTask]() {
                    for (int i = startTask; i <= endTask; ++i) {
                        std::this_thread::sleep_for(std::chrono::milliseconds(1 + (i * 7 + threadIndex * 13) % 5));
                        batchProgress_->completed.fetch_add(1);
                    }
                    batchProgress_->threadsDone.fetch_add(1);
                    activeThreadTasks_.fetch_sub(1);
                });
            } catch (...) { activeThreadTasks_.fetch_sub(1); batchProgress_->threadsDone.fetch_add(1); }
        }
    }

    int WS_连接(const wchar_t* url) {
        WS_关闭();
        if (!url || !url[0]) {
            调试输出(L"WebSocket 连接失败：地址为空。");
            return 0;
        }

        std::wstring normalizedUrl = url;
        if (normalizedUrl.rfind(L"ws://", 0) == 0) {
            normalizedUrl.replace(0, 5, L"http://");
        } else if (normalizedUrl.rfind(L"wss://", 0) == 0) {
            normalizedUrl.replace(0, 6, L"https://");
        }

        URL_COMPONENTSW parts = {};
        wchar_t host[256] = {};
        wchar_t path[2048] = {};
        parts.dwStructSize = sizeof(parts);
        parts.lpszHostName = host;
        parts.dwHostNameLength = static_cast<DWORD>(_countof(host));
        parts.lpszUrlPath = path;
        parts.dwUrlPathLength = static_cast<DWORD>(_countof(path));

        if (!WinHttpCrackUrl(normalizedUrl.c_str(), 0, 0, &parts)) {
            调试输出(L"WebSocket 连接失败：无法解析地址。");
            return 0;
        }

        bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        if (!(parts.nScheme == INTERNET_SCHEME_HTTP || parts.nScheme == INTERNET_SCHEME_HTTPS)) {
            调试输出(L"WebSocket 连接失败：地址必须使用 ws:// 或 wss://。");
            return 0;
        }

        wsSession_ = WinHttpOpen(L"LingBuilder WebSocket/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        if (!wsSession_) return WS_报告网络错误(L"WebSocket 连接失败：无法创建 WinHTTP 会话。");

        wsConnect_ = WinHttpConnect(wsSession_, host, parts.nPort, 0);
        if (!wsConnect_) return WS_报告网络错误(L"WebSocket 连接失败：无法连接主机。");

        const wchar_t* requestPath = path[0] ? path : L"/";
        DWORD flags = secure ? WINHTTP_FLAG_SECURE : 0;
        wsRequest_ = WinHttpOpenRequest(wsConnect_, L"GET", requestPath, nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
        if (!wsRequest_) return WS_报告网络错误(L"WebSocket 连接失败：无法创建握手请求。");

        if (!WinHttpSetOption(wsRequest_, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0)) {
            return WS_报告网络错误(L"WebSocket 连接失败：无法启用升级握手。");
        }
        if (!WinHttpSendRequest(wsRequest_, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0)) {
            return WS_报告网络错误(L"WebSocket 连接失败：发送握手请求失败。");
        }
        if (!WinHttpReceiveResponse(wsRequest_, nullptr)) {
            return WS_报告网络错误(L"WebSocket 连接失败：服务端握手响应失败。");
        }

        wsSocket_ = WinHttpWebSocketCompleteUpgrade(wsRequest_, 0);
        WinHttpCloseHandle(wsRequest_);
        wsRequest_ = nullptr;
        if (!wsSocket_) return WS_报告网络错误(L"WebSocket 连接失败：协议升级失败。");

        调试输出(L"WebSocket 已连接。");
        return 1;
    }

    int WS_发送文本(const wchar_t* text) {
        if (!wsSocket_) {
            调试输出(L"WebSocket 发送失败：尚未连接。");
            return 0;
        }
        std::string utf8 = WideToUtf8(text ? text : L"");
        DWORD result = WinHttpWebSocketSend(wsSocket_, WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE, utf8.empty() ? nullptr : utf8.data(), static_cast<DWORD>(utf8.size()));
        if (result != ERROR_SUCCESS) {
            SetLastError(result);
            return WS_报告网络错误(L"WebSocket 发送失败。");
        }
        return 1;
    }

    const wchar_t* WS_接收文本() {
        wsLastMessage_.clear();
        if (!wsSocket_) {
            调试输出(L"WebSocket 接收失败：尚未连接。");
            return wsLastMessage_.c_str();
        }

        std::string bytes;
        BYTE buffer[4096];
        WINHTTP_WEB_SOCKET_BUFFER_TYPE bufferType = WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE;
        DWORD bytesRead = 0;

        while (true) {
            DWORD result = WinHttpWebSocketReceive(wsSocket_, buffer, static_cast<DWORD>(sizeof(buffer)), &bytesRead, &bufferType);
            if (result != ERROR_SUCCESS) {
                SetLastError(result);
                WS_报告网络错误(L"WebSocket 接收失败。");
                return wsLastMessage_.c_str();
            }

            if (bufferType == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) {
                调试输出(L"WebSocket 已收到关闭帧。");
                WS_关闭();
                return wsLastMessage_.c_str();
            }

            if (bytesRead > 0) bytes.append(reinterpret_cast<const char*>(buffer), bytesRead);
            if (bufferType == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE || bufferType == WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE) break;
        }

        wsLastMessage_ = Utf8ToWide(bytes);
        return wsLastMessage_.c_str();
    }

    int WS_接收到调试输出() {
        const wchar_t* text = WS_接收文本();
        if (!text || !text[0]) return 0;
        调试输出(text);
        return 1;
    }

    void WS_关闭() {
        if (wsSocket_) {
            WinHttpWebSocketClose(wsSocket_, WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS, nullptr, 0);
            WinHttpCloseHandle(wsSocket_);
            wsSocket_ = nullptr;
        }
        if (wsRequest_) {
            WinHttpCloseHandle(wsRequest_);
            wsRequest_ = nullptr;
        }
        if (wsConnect_) {
            WinHttpCloseHandle(wsConnect_);
            wsConnect_ = nullptr;
        }
        if (wsSession_) {
            WinHttpCloseHandle(wsSession_);
            wsSession_ = nullptr;
        }
        wsLastMessage_.clear();
    }

    int HTTP_启动服务(int port) {
        HTTP_关闭服务();
        if (!EnsureSocketsStarted()) return 0;
        httpListenSocket_ = CreateListenSocket(port, L"HTTP 服务端启动失败");
        if (httpListenSocket_ == INVALID_SOCKET) return 0;
        std::wstring message = L"HTTP 服务端已启动，端口：";
        message += std::to_wstring(port);
        调试输出(message.c_str());
        return 1;
    }

    const wchar_t* HTTP_等待请求() {
        httpLastRequest_.clear();
        if (httpListenSocket_ == INVALID_SOCKET) {
            调试输出(L"HTTP 等待请求失败：服务尚未启动。");
            return httpLastRequest_.c_str();
        }
        CloseSocket(httpClientSocket_);
        httpClientSocket_ = accept(httpListenSocket_, nullptr, nullptr);
        if (httpClientSocket_ == INVALID_SOCKET) {
            ReportSocketError(L"HTTP 等待请求失败。");
            return httpLastRequest_.c_str();
        }
        httpLastRequest_ = Utf8ToWide(ReceiveHttpHeaders(httpClientSocket_));
        return httpLastRequest_.c_str();
    }

    int HTTP_等待请求到调试输出() {
        const wchar_t* request = HTTP_等待请求();
        if (!request || !request[0]) return 0;
        调试输出(request);
        return 1;
    }

    int HTTP_回复文本(const wchar_t* text) {
        if (httpClientSocket_ == INVALID_SOCKET) {
            调试输出(L"HTTP 回复失败：当前没有已接入的请求。");
            return 0;
        }
        std::string body = WideToUtf8(text ? text : L"");
        std::ostringstream response;
        response << "HTTP/1.1 200 OK\r\n"
                 << "Content-Type: text/plain; charset=utf-8\r\n"
                 << "Content-Length: " << body.size() << "\r\n"
                 << "Connection: close\r\n\r\n"
                 << body;
        const std::string payload = response.str();
        int ok = SendAll(httpClientSocket_, payload.data(), payload.size());
        CloseSocket(httpClientSocket_);
        return ok;
    }

    void HTTP_关闭服务() {
        CloseSocket(httpClientSocket_);
        CloseSocket(httpListenSocket_);
        httpLastRequest_.clear();
    }

    int WSS_启动服务(int port) {
        WSS_关闭服务();
        if (!EnsureSocketsStarted()) return 0;
        wsServerListenSocket_ = CreateListenSocket(port, L"WebSocket 服务端启动失败");
        if (wsServerListenSocket_ == INVALID_SOCKET) return 0;
        std::wstring message = L"WebSocket 服务端已启动，端口：";
        message += std::to_wstring(port);
        调试输出(message.c_str());
        return 1;
    }

    int WSS_等待连接() {
        if (wsServerListenSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端等待连接失败：服务尚未启动。");
            return 0;
        }
        CloseSocket(wsServerClientSocket_);
        wsServerClientSocket_ = accept(wsServerListenSocket_, nullptr, nullptr);
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            ReportSocketError(L"WebSocket 服务端接入失败。");
            return 0;
        }

        std::string request = ReceiveHttpHeaders(wsServerClientSocket_);
        std::string key = ExtractHttpHeader(request, "sec-websocket-key");
        if (key.empty()) {
            调试输出(L"WebSocket 服务端握手失败：缺少 Sec-WebSocket-Key。");
            CloseSocket(wsServerClientSocket_);
            return 0;
        }

        std::string acceptKey = MakeWebSocketAcceptKey(key);
        if (acceptKey.empty()) {
            调试输出(L"WebSocket 服务端握手失败：无法生成握手密钥。");
            CloseSocket(wsServerClientSocket_);
            return 0;
        }

        std::string response =
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";
        if (!SendAll(wsServerClientSocket_, response.data(), response.size())) {
            CloseSocket(wsServerClientSocket_);
            return 0;
        }
        调试输出(L"WebSocket 服务端已完成握手。");
        return 1;
    }

    const wchar_t* WSS_接收文本() {
        wssLastMessage_.clear();
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端接收失败：当前没有客户端连接。");
            return wssLastMessage_.c_str();
        }

        unsigned char header[2] = {};
        if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(header), 2)) {
            ReportSocketError(L"WebSocket 服务端读取帧失败。");
            return wssLastMessage_.c_str();
        }

        const bool masked = (header[1] & 0x80) != 0;
        uint64_t payloadLength = header[1] & 0x7f;
        if (payloadLength == 126) {
            unsigned char ext[2] = {};
            if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(ext), 2)) return wssLastMessage_.c_str();
            payloadLength = (static_cast<uint64_t>(ext[0]) << 8) | ext[1];
        } else if (payloadLength == 127) {
            unsigned char ext[8] = {};
            if (!RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(ext), 8)) return wssLastMessage_.c_str();
            payloadLength = 0;
            for (int i = 0; i < 8; ++i) payloadLength = (payloadLength << 8) | ext[i];
        }
        if (payloadLength > 1024 * 1024) {
            调试输出(L"WebSocket 服务端接收失败：消息超过 1MB 限制。");
            return wssLastMessage_.c_str();
        }

        unsigned char mask[4] = {};
        if (masked && !RecvExact(wsServerClientSocket_, reinterpret_cast<char*>(mask), 4)) return wssLastMessage_.c_str();
        std::string payload(static_cast<size_t>(payloadLength), '\0');
        if (payloadLength > 0 && !RecvExact(wsServerClientSocket_, payload.data(), static_cast<int>(payload.size()))) return wssLastMessage_.c_str();
        if (masked) {
            for (size_t i = 0; i < payload.size(); ++i) payload[i] = static_cast<char>(payload[i] ^ mask[i % 4]);
        }

        const unsigned char opcode = header[0] & 0x0f;
        if (opcode == 0x8) {
            调试输出(L"WebSocket 服务端已收到关闭帧。");
            CloseSocket(wsServerClientSocket_);
            return wssLastMessage_.c_str();
        }
        wssLastMessage_ = Utf8ToWide(payload);
        return wssLastMessage_.c_str();
    }

    int WSS_接收到调试输出() {
        const wchar_t* text = WSS_接收文本();
        if (!text || !text[0]) return 0;
        调试输出(text);
        return 1;
    }

    int WSS_发送文本(const wchar_t* text) {
        if (wsServerClientSocket_ == INVALID_SOCKET) {
            调试输出(L"WebSocket 服务端发送失败：当前没有客户端连接。");
            return 0;
        }
        std::string payload = WideToUtf8(text ? text : L"");
        std::string frame;
        frame.push_back(static_cast<char>(0x81));
        if (payload.size() <= 125) {
            frame.push_back(static_cast<char>(payload.size()));
        } else if (payload.size() <= 65535) {
            frame.push_back(static_cast<char>(126));
            frame.push_back(static_cast<char>((payload.size() >> 8) & 0xff));
            frame.push_back(static_cast<char>(payload.size() & 0xff));
        } else {
            frame.push_back(static_cast<char>(127));
            uint64_t length = static_cast<uint64_t>(payload.size());
            for (int i = 7; i >= 0; --i) frame.push_back(static_cast<char>((length >> (i * 8)) & 0xff));
        }
        frame += payload;
        return SendAll(wsServerClientSocket_, frame.data(), frame.size());
    }

    void WSS_关闭服务() {
        CloseSocket(wsServerClientSocket_);
        CloseSocket(wsServerListenSocket_);
        wssLastMessage_.clear();
    }

    HWND 窗口_打开(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        HWND opened = OpenGeneratedWindowByName(windowName, SW_SHOWNORMAL, placement, x, y, hasCustomPosition);
        if (!opened) {
            std::wstring message = L"未找到要打开的窗口：";
            message += (windowName && windowName[0]) ? windowName : L"(空)";
            调试输出(message.c_str());
        }
        return opened;
    }

    HWND 打开窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    HWND 载入窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    HWND 载入新窗口(const wchar_t* windowName, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        return 窗口_打开(windowName, placement, x, y, hasCustomPosition);
    }

    bool 窗口_取消关闭() {
        if (!closingEventActive_) return false;
        closingCancelled_ = true;
        return true;
    }
    int 窗口_取事件宽度() const { return eventWidth_; }
    int 窗口_取事件高度() const { return eventHeight_; }
    int 窗口_取事件横坐标() const { return eventX_; }
    int 窗口_取事件纵坐标() const { return eventY_; }
    bool 窗口_取是否激活() const { return active_; }
    bool 窗口_取是否可见() const { return hwnd_ && IsWindowVisible(hwnd_) != FALSE; }
    int 窗口_取当前状态() const { return windowState_; }
    int 窗口_取事件键码() const { return eventKeyCode_; }
    const wchar_t* 窗口_取事件字符() const { return eventCharacter_.c_str(); }
    bool 窗口_取Ctrl键状态() const { return eventCtrlDown_; }
    bool 窗口_取Shift键状态() const { return eventShiftDown_; }
    bool 窗口_取Alt键状态() const { return eventAltDown_; }
    bool 窗口_标记按键已处理() {
        if (!keyboardEventActive_) return false;
        keyboardHandled_ = true;
        return true;
    }
    int 窗口_取事件DPI() const { return static_cast<int>(dpi_); }
    int 窗口_取拖入文件数量() const { return static_cast<int>(droppedFiles_.size()); }
    const wchar_t* 窗口_取拖入文件(int index) const {
        return index >= 0 && index < static_cast<int>(droppedFiles_.size())
            ? droppedFiles_[static_cast<size_t>(index)].c_str()
            : L"";
    }

    int 到整数(const std::wstring& value) const {
        if (value.empty()) return 0;
        wchar_t* end = nullptr;
        long converted = wcstol(value.c_str(), &end, 10);
        return end == value.c_str() ? 0 : static_cast<int>(converted);
    }

    int 取鼠标水平位置() const {
        POINT point = {};
        return GetCursorPos(&point) ? point.x : 0;
    }

    int 取鼠标垂直位置() const {
        POINT point = {};
        return GetCursorPos(&point) ? point.y : 0;
    }

    bool RenderAnimatedImage(RuntimeControl& runtime, const ControlSpec& control) {
        if (!runtime.animatedImage || runtime.animatedFrame >= runtime.animatedFrameCount) return false;
        if (runtime.animatedImage->SelectActiveFrame(&runtime.animatedDimension, runtime.animatedFrame) != Gdiplus::Ok) return false;
        HBITMAP bitmap = RenderGdiPlusImage(runtime.animatedImage, ScaleForDpi(control.width, dpi_), ScaleForDpi(control.height, dpi_), control.option1, control.background);
        if (!bitmap) return false;
        HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime.hwnd, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap)));
        if (previous && previous != bitmap) DeleteObject(previous);
        runtime.resource = bitmap;
        InvalidateRect(runtime.hwnd, nullptr, TRUE);
        return true;
    }

    bool InitializeAnimatedImage(const ControlSpec& control, RuntimeControl& runtime) {
        if (!control.data || !control.data[0]) return false;
        Gdiplus::Image* image = new Gdiplus::Image(control.data);
        if (!image || image->GetLastStatus() != Gdiplus::Ok) { delete image; return false; }
        const UINT dimensionCount = image->GetFrameDimensionsCount();
        if (!dimensionCount) { delete image; return false; }
        std::vector<GUID> dimensions(dimensionCount);
        if (image->GetFrameDimensionsList(dimensions.data(), dimensionCount) != Gdiplus::Ok) { delete image; return false; }
        GUID dimension = dimensions[0];
        for (const GUID& candidate : dimensions) if (candidate == Gdiplus::FrameDimensionTime) { dimension = candidate; break; }
        const UINT frameCount = image->GetFrameCount(&dimension);
        if (!frameCount) { delete image; return false; }
        runtime.animatedImage = image;
        runtime.animatedDimension = dimension;
        runtime.animatedFrame = 0;
        runtime.animatedFrameCount = frameCount;
        runtime.animatedLoop = (control.flags & CF_LOOP) != 0;
        runtime.animatedFrameDelays.assign(frameCount, 100);
        const UINT propertySize = image->GetPropertyItemSize(0x5100);
        if (propertySize >= sizeof(Gdiplus::PropertyItem)) {
            std::vector<BYTE> propertyBuffer(propertySize);
            auto* property = reinterpret_cast<Gdiplus::PropertyItem*>(propertyBuffer.data());
            if (image->GetPropertyItem(0x5100, propertySize, property) == Gdiplus::Ok && property->value && property->length >= sizeof(UINT)) {
                const auto* delays = static_cast<const UINT*>(property->value);
                const UINT delayCount = std::min(frameCount, static_cast<UINT>(property->length / sizeof(UINT)));
                for (UINT index = 0; index < delayCount; ++index) runtime.animatedFrameDelays[index] = std::max(20u, delays[index] * 10u);
            }
        }
        if (!RenderAnimatedImage(runtime, control)) return false;
        if ((control.flags & CF_AUTO_PLAY) && frameCount > 1) {
            runtime.animatedTimer = 0x4C470000u + static_cast<UINT_PTR>(control.id);
            SetTimer(hwnd_, runtime.animatedTimer, runtime.animatedFrameDelays[0], nullptr);
        }
        return true;
    }

    bool AdvanceAnimatedImage(UINT_PTR timerId) {
        for (auto& runtime : runtimeControls_) {
            if (!runtime.animatedImage || runtime.animatedTimer != timerId) continue;
            const ControlSpec* control = FindControl(runtime.id);
            if (!control) return true;
            UINT nextFrame = runtime.animatedFrame + 1;
            if (nextFrame >= runtime.animatedFrameCount) {
                if (!runtime.animatedLoop) {
                    KillTimer(hwnd_, runtime.animatedTimer);
                    runtime.animatedTimer = 0;
                    DispatchLingEvent(*control, L"Finished");
                    return true;
                }
                nextFrame = 0;
            }
            runtime.animatedFrame = nextFrame;
            RenderAnimatedImage(runtime, *control);
            SetTimer(hwnd_, timerId, runtime.animatedFrameDelays[nextFrame], nullptr);
            return true;
        }
        return false;
    }

    bool 控件_设置文本(const wchar_t* controlName, const std::wstring& text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        return SetWindowTextW(runtime->hwnd, text.c_str()) == TRUE;
    }
    bool InitializeVideoPlayer(RuntimeControl& runtime, const ControlSpec& control, const std::wstring& source, bool autoPlay) {
        if (runtime.mediaPlayer) { runtime.mediaPlayer->Shutdown(); runtime.mediaPlayer->Release(); runtime.mediaPlayer = nullptr; }
        if (runtime.mediaCallback) { runtime.mediaCallback->Release(); runtime.mediaCallback = nullptr; }
        if (source.empty()) { InvalidateRect(runtime.hwnd, nullptr, TRUE); return true; }
        wchar_t absolutePath[MAX_PATH] = {};
        const wchar_t* mediaUrl = source.c_str();
        if (GetFullPathNameW(source.c_str(), MAX_PATH, absolutePath, nullptr) > 0) mediaUrl = absolutePath;
        auto* callback = new (std::nothrow) LingVideoPlayerCallback(hwnd_, control.id);
        if (!callback) { PostMessageW(hwnd_, WM_LINGBUILDER_VIDEO_EVENT, static_cast<WPARAM>(control.id), 3); return false; }
        IMFPMediaPlayer* player = nullptr;
        HRESULT result = MFPCreateMediaPlayer(mediaUrl, autoPlay ? TRUE : FALSE, 0, callback, runtime.hwnd, &player);
        if (FAILED(result) || !player) {
            callback->Release();
            PostMessageW(hwnd_, WM_LINGBUILDER_VIDEO_EVENT, static_cast<WPARAM>(control.id), 3);
            return false;
        }
        runtime.mediaCallback = callback;
        runtime.mediaPlayer = player;
        player->SetVolume(static_cast<float>(std::max(0, std::min(100, control.value))) / 100.0f);
        player->UpdateVideo();
        return true;
    }
    bool 视频播放器_设置文件(const wchar_t* controlName, const std::wstring& videoPath) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsType(*control, L"VideoPlayer")
            ? InitializeVideoPlayer(*runtime, *control, videoPath, false)
            : false;
    }
    bool 视频播放器_播放(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        return runtime && runtime->mediaPlayer && SUCCEEDED(runtime->mediaPlayer->Play());
    }
    bool 视频播放器_暂停(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        return runtime && runtime->mediaPlayer && SUCCEEDED(runtime->mediaPlayer->Pause());
    }
    bool 视频播放器_停止(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        return runtime && runtime->mediaPlayer && SUCCEEDED(runtime->mediaPlayer->Stop());
    }
    bool 视频播放器_设置音量(const wchar_t* controlName, int volume) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        return runtime && runtime->mediaPlayer && SUCCEEDED(runtime->mediaPlayer->SetVolume(static_cast<float>(std::max(0, std::min(100, volume))) / 100.0f));
    }
    int 视频播放器_取状态(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        MFP_MEDIAPLAYER_STATE state = MFP_MEDIAPLAYER_STATE_EMPTY;
        return runtime && runtime->mediaPlayer && SUCCEEDED(runtime->mediaPlayer->GetState(&state)) ? static_cast<int>(state) : -1;
    }
    bool 控件_设置图片(const wchar_t* controlName, const std::wstring& imagePath) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !runtime->hwnd || !control || !IsType(*control, L"Image")) return false;
        if (imagePath.empty()) {
            HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, 0));
            if (previous) DeleteObject(previous);
            runtime->resource = nullptr;
            runtime->iconResource = false;
            InvalidateRect(runtime->hwnd, nullptr, TRUE);
            return true;
        }
        HBITMAP bitmap = LoadWicBitmap(imagePath.c_str(), ScaleForDpi(control->width, dpi_), ScaleForDpi(control->height, dpi_), control->option1);
        if (!bitmap) return false;
        HGDIOBJ previous = reinterpret_cast<HGDIOBJ>(SendMessageW(runtime->hwnd, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap)));
        if (previous && previous != bitmap) DeleteObject(previous);
        runtime->resource = bitmap;
        runtime->iconResource = false;
        InvalidateRect(runtime->hwnd, nullptr, TRUE);
        return true;
    }
    std::wstring 控件_取文本(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return L"";
        int length = GetWindowTextLengthW(runtime->hwnd); std::wstring value(static_cast<size_t>(length + 1), L'\0');
        GetWindowTextW(runtime->hwnd, value.data(), length + 1); value.resize(static_cast<size_t>(length)); return value;
    }
    bool 控件_设置启用(const wchar_t* controlName, bool enabled) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        BOOL result = EnableWindow(runtime->hwnd, enabled);
        if (runtime->frameHwnd) EnableWindow(runtime->frameHwnd, enabled);
        return result != FALSE;
    }
    bool 控件_设置可见(const wchar_t* controlName, bool visible) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false;
        if (runtime->frameHwnd) {
            ShowWindow(runtime->frameHwnd, visible ? SW_SHOW : SW_HIDE);
            ShowWindow(runtime->hwnd, visible ? SW_SHOW : SW_HIDE);
        } else {
            ShowWindow(runtime->hwnd, visible ? SW_SHOW : SW_HIDE);
        }
        return true;
    }
    bool 控件_设置勾选(const wchar_t* controlName, bool checked) { RuntimeControl* runtime = FindRuntimeControlByName(controlName); if (!runtime) return false; SendMessageW(runtime->hwnd, BM_SETCHECK, checked ? BST_CHECKED : BST_UNCHECKED, 0); return true; }
    bool 控件_取勾选(const wchar_t* controlName) { RuntimeControl* runtime = FindRuntimeControlByName(controlName); return runtime && SendMessageW(runtime->hwnd, BM_GETCHECK, 0, 0) != BST_UNCHECKED; }
    bool 控件_设置数值(const wchar_t* controlName, int value) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        value = std::max(control->minimum, std::min(control->maximum, value));
        if (IsType(*control, L"ProgressBar")) SendMessageW(runtime->hwnd, PBM_SETPOS, value, 0);
        else if (IsType(*control, L"TrackBar")) SendMessageW(runtime->hwnd, TBM_SETPOS, TRUE, value);
        else if (IsType(*control, L"UpDown")) SendMessageW(runtime->hwnd, UDM_SETPOS32, 0, value);
        else if (IsType(*control, L"ScrollBar")) SetScrollPos(runtime->hwnd, SB_CTL, value, TRUE);
        else if (IsType(*control, L"FlatScrollBar")) FlatSB_SetScrollPos(runtime->hwnd, (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT, value, TRUE);
        else return false; return true;
    }
    int 控件_取数值(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return 0;
        if (IsType(*control, L"ProgressBar")) return static_cast<int>(SendMessageW(runtime->hwnd, PBM_GETPOS, 0, 0));
        if (IsType(*control, L"TrackBar")) return static_cast<int>(SendMessageW(runtime->hwnd, TBM_GETPOS, 0, 0));
        if (IsType(*control, L"UpDown")) return static_cast<int>(SendMessageW(runtime->hwnd, UDM_GETPOS32, 0, 0));
        if (IsType(*control, L"ScrollBar")) return GetScrollPos(runtime->hwnd, SB_CTL);
        if (IsType(*control, L"FlatScrollBar")) return FlatSB_GetScrollPos(runtime->hwnd, (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT);
        return 0;
    }
    bool 控件_设置选择项(const wchar_t* controlName, int index) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        if (IsType(*control, L"ListBox")) return SendMessageW(runtime->hwnd, LB_SETCURSEL, index, 0) != LB_ERR;
        if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) return SendMessageW(runtime->hwnd, CB_SETCURSEL, index, 0) != CB_ERR;
        if (IsType(*control, L"TabControl")) { TabCtrl_SetCurSel(runtime->hwnd, index); UpdateTabChildren(*control); return true; }
        if (IsType(*control, L"ListView")) { ListView_SetItemState(runtime->hwnd, index, LVIS_SELECTED | LVIS_FOCUSED, LVIS_SELECTED | LVIS_FOCUSED); return true; }
        return false;
    }
    int 控件_取选择项(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return -1;
        if (IsType(*control, L"ListBox")) return static_cast<int>(SendMessageW(runtime->hwnd, LB_GETCURSEL, 0, 0));
        if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) return static_cast<int>(SendMessageW(runtime->hwnd, CB_GETCURSEL, 0, 0));
        if (IsType(*control, L"TabControl")) return TabCtrl_GetCurSel(runtime->hwnd);
        if (IsType(*control, L"ListView")) return ListView_GetNextItem(runtime->hwnd, -1, LVNI_SELECTED);
        return -1;
    }
    int 控件_添加项目(const wchar_t* controlName, const wchar_t* text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return -1;
        if (IsType(*control, L"ListBox")) return static_cast<int>(SendMessageW(runtime->hwnd, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(text)));
        if (IsType(*control, L"ComboBox")) return static_cast<int>(SendMessageW(runtime->hwnd, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(text)));
        if (IsType(*control, L"ComboBoxEx")) { COMBOBOXEXITEMW item = {}; item.mask = CBEIF_TEXT; item.iItem = -1; item.pszText = const_cast<wchar_t*>(text ? text : L""); return static_cast<int>(SendMessageW(runtime->hwnd, CBEM_INSERTITEMW, 0, reinterpret_cast<LPARAM>(&item))); }
        return -1;
    }
    bool 控件_清空项目(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control) return false;
        if (IsType(*control, L"ListBox")) SendMessageW(runtime->hwnd, LB_RESETCONTENT, 0, 0);
        else if (IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) SendMessageW(runtime->hwnd, CB_RESETCONTENT, 0, 0);
        else if (IsType(*control, L"ListView")) ListView_DeleteAllItems(runtime->hwnd);
        else if (IsType(*control, L"TreeView")) TreeView_DeleteAllItems(runtime->hwnd);
        else if (IsType(*control, L"TabControl")) TabCtrl_DeleteAllItems(runtime->hwnd);
        else return false; return true;
    }
    int 列表视图_添加行(const wchar_t* controlName, const wchar_t* tabSeparatedCells) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"ListView")) return -1;
        std::vector<std::wstring> cells; std::wstring source = tabSeparatedCells ? tabSeparatedCells : L""; size_t start = 0;
        while (start <= source.size()) { size_t end = source.find(L'	', start); cells.push_back(source.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start)); if (end == std::wstring::npos) break; start = end + 1; }
        LVITEMW item = {}; item.mask = LVIF_TEXT; item.iItem = ListView_GetItemCount(runtime->hwnd); item.pszText = const_cast<wchar_t*>((cells.empty() ? L"" : cells[0].c_str()));
        int row = ListView_InsertItem(runtime->hwnd, &item); for (int column = 1; row >= 0 && column < static_cast<int>(cells.size()); ++column) ListView_SetItemText(runtime->hwnd, row, column, const_cast<wchar_t*>(cells[column].c_str())); return row;
    }
    bool 树形框_添加节点(const wchar_t* controlName, const wchar_t* parentText, const wchar_t* text) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"TreeView")) return false;
        HTREEITEM parent = parentText && parentText[0] ? FindTreeItemByText(runtime->hwnd, TreeView_GetRoot(runtime->hwnd), parentText) : TVI_ROOT;
        TVINSERTSTRUCTW item = {}; item.hParent = parent ? parent : TVI_ROOT; item.hInsertAfter = TVI_LAST; item.item.mask = TVIF_TEXT; item.item.pszText = const_cast<wchar_t*>(text ? text : L""); return TreeView_InsertItem(runtime->hwnd, &item) != nullptr;
    }
    int 选项卡_添加页(const wchar_t* controlName, const wchar_t* title) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName); const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr; if (!runtime || !control || !IsType(*control, L"TabControl")) return -1;
        TCITEMW item = {}; item.mask = TCIF_TEXT; item.pszText = const_cast<wchar_t*>(title ? title : L""); int index = TabCtrl_GetItemCount(runtime->hwnd);
        int inserted = TabCtrl_InsertItem(runtime->hwnd, index, &item);
        if (inserted >= 0) UpdateTabHeaderMinimumWidth(*control, *runtime);
        return inserted;
    }
    bool 选项卡_设置隐藏表头(const wchar_t* controlName, bool hidden) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        if (!runtime || !control || !IsType(*control, L"TabControl")) return false;
        runtime->hideTabHeader = hidden;
        RECT pageRect = {};
        GetClientRect(runtime->hwnd, &pageRect);
        if (!hidden) {
            SendMessageW(runtime->hwnd, TCM_SETPADDING, 0, MAKELPARAM(TabHeaderHorizontalPadding(), TabHeaderVerticalPadding()));
            UpdateTabHeaderMinimumWidth(*control, *runtime);
            TabCtrl_AdjustRect(runtime->hwnd, FALSE, &pageRect);
        }
        for (auto& page : tabPages_) {
            if (page.tabControlId != control->id) continue;
            page.contentRect = pageRect;
            SetWindowPos(page.hwnd, nullptr, pageRect.left, pageRect.top,
                std::max(0L, pageRect.right - pageRect.left),
                std::max(0L, pageRect.bottom - pageRect.top),
                SWP_NOZORDER | SWP_NOACTIVATE);
        }
        UpdateTabChildren(*control);
        RedrawWindow(runtime->hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN);
        return true;
    }
    bool 选项卡_取隐藏表头(const wchar_t* controlName) {
        RuntimeControl* runtime = FindRuntimeControlByName(controlName);
        const ControlSpec* control = runtime ? FindControl(runtime->id) : nullptr;
        return runtime && control && IsType(*control, L"TabControl") && runtime->hideTabHeader;
    }

private:
    bool EnsureSocketsStarted() {
        if (socketsStarted_) return true;
        WSADATA data = {};
        int result = WSAStartup(MAKEWORD(2, 2), &data);
        if (result != 0) {
            std::wstring message = L"网络服务初始化失败，错误码：";
            message += std::to_wstring(result);
            调试输出(message.c_str());
            return false;
        }
        socketsStarted_ = true;
        return true;
    }

    SOCKET CreateListenSocket(int port, const wchar_t* errorPrefix) {
        if (port <= 0 || port > 65535) {
            调试输出(L"服务端启动失败：端口必须在 1 到 65535 之间。");
            return INVALID_SOCKET;
        }

        SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (server == INVALID_SOCKET) {
            ReportSocketError(errorPrefix);
            return INVALID_SOCKET;
        }

        u_long reuse = 1;
        setsockopt(server, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));

        sockaddr_in address = {};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        address.sin_port = htons(static_cast<u_short>(port));
        if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
            ReportSocketError(errorPrefix);
            closesocket(server);
            return INVALID_SOCKET;
        }
        if (listen(server, SOMAXCONN) == SOCKET_ERROR) {
            ReportSocketError(errorPrefix);
            closesocket(server);
            return INVALID_SOCKET;
        }
        return server;
    }

    void CloseSocket(SOCKET& value) {
        if (value != INVALID_SOCKET) {
            shutdown(value, SD_BOTH);
            closesocket(value);
            value = INVALID_SOCKET;
        }
    }

    int ReportSocketError(const wchar_t* prefix) {
        int error = WSAGetLastError();
        std::wstring message = prefix ? prefix : L"网络服务操作失败。";
        message += L" 错误码：";
        message += std::to_wstring(error);
        调试输出(message.c_str());
        return 0;
    }

    int SendAll(SOCKET socketValue, const char* data, size_t length) {
        size_t sentTotal = 0;
        while (sentTotal < length) {
            int sent = send(socketValue, data + sentTotal, static_cast<int>(length - sentTotal), 0);
            if (sent == SOCKET_ERROR || sent == 0) return ReportSocketError(L"网络服务发送失败。");
            sentTotal += static_cast<size_t>(sent);
        }
        return 1;
    }

    bool RecvExact(SOCKET socketValue, char* data, int length) {
        int receivedTotal = 0;
        while (receivedTotal < length) {
            int received = recv(socketValue, data + receivedTotal, length - receivedTotal, 0);
            if (received <= 0) {
                ReportSocketError(L"网络服务接收失败。");
                return false;
            }
            receivedTotal += received;
        }
        return true;
    }

    std::string ReceiveHttpHeaders(SOCKET socketValue) {
        std::string request;
        char buffer[1024];
        while (request.find("\r\n\r\n") == std::string::npos && request.size() < 64 * 1024) {
            int received = recv(socketValue, buffer, static_cast<int>(sizeof(buffer)), 0);
            if (received <= 0) break;
            request.append(buffer, static_cast<size_t>(received));
        }
        return request;
    }

    static std::string ToLowerAscii(std::string value) {
        std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
        return value;
    }

    static void TrimAscii(std::string& value) {
        const char* whitespace = " \t\r\n";
        size_t first = value.find_first_not_of(whitespace);
        size_t last = value.find_last_not_of(whitespace);
        value = first == std::string::npos ? std::string() : value.substr(first, last - first + 1);
    }

    std::string ExtractHttpHeader(const std::string& request, const std::string& headerName) {
        std::istringstream stream(request);
        std::string line;
        std::string wanted = ToLowerAscii(headerName);
        while (std::getline(stream, line)) {
            size_t colon = line.find(':');
            if (colon == std::string::npos) continue;
            std::string name = ToLowerAscii(line.substr(0, colon));
            TrimAscii(name);
            if (name != wanted) continue;
            std::string value = line.substr(colon + 1);
            TrimAscii(value);
            return value;
        }
        return std::string();
    }

    std::string MakeWebSocketAcceptKey(const std::string& clientKey) {
        const std::string seed = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        HCRYPTPROV provider = 0;
        HCRYPTHASH hash = 0;
        BYTE digest[20] = {};
        DWORD digestSize = sizeof(digest);
        if (!CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) return std::string();
        if (!CryptCreateHash(provider, CALG_SHA1, 0, 0, &hash)) {
            CryptReleaseContext(provider, 0);
            return std::string();
        }
        BOOL ok = CryptHashData(hash, reinterpret_cast<const BYTE*>(seed.data()), static_cast<DWORD>(seed.size()), 0)
            && CryptGetHashParam(hash, HP_HASHVAL, digest, &digestSize, 0);
        CryptDestroyHash(hash);
        CryptReleaseContext(provider, 0);
        return ok ? Base64Encode(digest, digestSize) : std::string();
    }

    static std::string Base64Encode(const BYTE* data, DWORD length) {
        static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string out;
        for (DWORD i = 0; i < length; i += 3) {
            DWORD remaining = length - i;
            BYTE a = data[i];
            BYTE b = remaining > 1 ? data[i + 1] : 0;
            BYTE c = remaining > 2 ? data[i + 2] : 0;
            out.push_back(table[(a >> 2) & 0x3f]);
            out.push_back(table[((a & 0x03) << 4) | ((b >> 4) & 0x0f)]);
            out.push_back(remaining > 1 ? table[((b & 0x0f) << 2) | ((c >> 6) & 0x03)] : '=');
            out.push_back(remaining > 2 ? table[c & 0x3f] : '=');
        }
        return out;
    }

    int WS_报告网络错误(const wchar_t* prefix) {
        DWORD error = GetLastError();
        std::wstring message = prefix ? prefix : L"WebSocket 操作失败。";
        message += L" 错误码：";
        message += std::to_wstring(error);
        调试输出(message.c_str());
        WS_关闭();
        return 0;
    }

    std::string WideToUtf8(const wchar_t* text) {
        if (!text || !text[0]) return std::string();
        int needed = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
        if (needed <= 1) return std::string();
        std::string bytes(static_cast<size_t>(needed), '\0');
        WideCharToMultiByte(CP_UTF8, 0, text, -1, bytes.data(), needed, nullptr, nullptr);
        bytes.pop_back();
        return bytes;
    }

    std::wstring Utf8ToWide(const std::string& bytes) {
        if (bytes.empty()) return std::wstring();
        int needed = MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
        if (needed <= 0) return std::wstring();
        std::wstring text(static_cast<size_t>(needed), L'\0');
        MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), text.data(), needed);
        return text;
    }

    HMENU CreateMenuForWindow() {
        std::wstring items = spec_.menuItems ? spec_.menuItems : L"";
        if (items.find_first_not_of(L" \t\r\n,") == std::wstring::npos) return nullptr;
        HMENU root = CreateMenu();
        HMENU windowMenu = CreatePopupMenu();
        size_t pos = 0;
        int index = 0;
        while (!items.empty()) {
            size_t next = items.find(L',', pos);
            std::wstring item = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            trim(item);
            if (!item.empty()) {
                AppendMenuW(windowMenu, MF_OWNERDRAW, 50000 + index, reinterpret_cast<LPCWSTR>(static_cast<ULONG_PTR>(index + 1)));
                ++index;
            }
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        if (index == 0) {
            DestroyMenu(windowMenu);
            DestroyMenu(root);
            return nullptr;
        }
        AppendMenuW(root, MF_POPUP | MF_OWNERDRAW, reinterpret_cast<UINT_PTR>(windowMenu), reinterpret_cast<LPCWSTR>(L"窗口"));
        menuFont_ = CreateControlFont(spec_.menuFontFamily, spec_.menuFontSize, spec_.menuFontBold, spec_.menuFontItalic, spec_.menuFontUnderline, dpi_);
        menuBrush_ = CreateSolidBrush(spec_.menuBackground);
        if (menuBrush_) {
            MENUINFO menuInfo = {};
            menuInfo.cbSize = sizeof(menuInfo);
            menuInfo.fMask = MIM_BACKGROUND;
            menuInfo.hbrBack = menuBrush_;
            SetMenuInfo(root, &menuInfo);
            SetMenuInfo(windowMenu, &menuInfo);
        }
        return root;
    }

    std::wstring GetOwnerDrawMenuText(UINT itemId) const {
        if (itemId < 50000 || itemId >= 50100) return L"窗口";
        std::wstring items = spec_.menuItems ? spec_.menuItems : L"";
        int target = static_cast<int>(itemId) - 50000;
        int index = 0;
        size_t pos = 0;
        while (pos <= items.size()) {
            size_t next = items.find(L',', pos);
            std::wstring text = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            trim(text);
            if (!text.empty() && index++ == target) return text;
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        return L"";
    }

    void PaintMenuBarItem(DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_MENU || !item->itemData || !menuBrush_) return;
        std::wstring text = GetOwnerDrawMenuText(item->itemID);
        FillRect(item->hDC, &item->rcItem, menuBrush_);
        if ((item->itemState & (ODS_SELECTED | ODS_HOTLIGHT)) != 0) {
            COLORREF base = spec_.menuBackground;
            HBRUSH hoverBrush = CreateSolidBrush(RGB(
                std::min(255, static_cast<int>(GetRValue(base)) + 28),
                std::min(255, static_cast<int>(GetGValue(base)) + 28),
                std::min(255, static_cast<int>(GetBValue(base)) + 28)));
            FillRect(item->hDC, &item->rcItem, hoverBrush);
            DeleteObject(hoverBrush);
        }
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, spec_.menuForeground);
        HGDIOBJ oldFont = menuFont_ ? SelectObject(item->hDC, menuFont_) : nullptr;
        RECT textRect = item->rcItem;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right -= ScaleForDpi(8, dpi_);
        DrawTextW(item->hDC, text.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        if (oldFont) SelectObject(item->hDC, oldFont);
    }

    void PaintMenuBarBackground() {
        HMENU menu = hwnd_ ? GetMenu(hwnd_) : nullptr;
        if (!menu || !menuBrush_) return;
        MENUBARINFO info = {};
        info.cbSize = sizeof(info);
        if (!GetMenuBarInfo(hwnd_, OBJID_MENU, 0, &info)) return;
        RECT windowRect = {};
        if (!GetWindowRect(hwnd_, &windowRect)) return;
        RECT barRect = info.rcBar;
        OffsetRect(&barRect, -windowRect.left, -windowRect.top);
        POINT clientOrigin = { 0, 0 };
        if (ClientToScreen(hwnd_, &clientOrigin)) {
            barRect.bottom = std::max(barRect.bottom, clientOrigin.y - windowRect.top);
        }
        HDC hdc = GetWindowDC(hwnd_);
        if (!hdc) return;
        FillRect(hdc, &barRect, menuBrush_);
        int count = GetMenuItemCount(menu);
        for (int position = 0; position < count; ++position) {
            RECT itemRect = {};
            if (!GetMenuItemRect(hwnd_, menu, position, &itemRect)) continue;
            OffsetRect(&itemRect, -windowRect.left, -windowRect.top);
            DRAWITEMSTRUCT item = {};
            item.CtlType = ODT_MENU;
            item.itemID = static_cast<UINT>(-1);
            item.itemState = (GetMenuState(menu, position, MF_BYPOSITION) & MF_HILITE) ? ODS_SELECTED : 0;
            item.hDC = hdc;
            item.rcItem = itemRect;
            item.itemData = reinterpret_cast<ULONG_PTR>(L"窗口");
            PaintMenuBarItem(&item);
        }
        ReleaseDC(hwnd_, hdc);
    }

    static void trim(std::wstring& value) {
        const wchar_t* whitespace = L" \t\r\n";
        size_t first = value.find_first_not_of(whitespace);
        size_t last = value.find_last_not_of(whitespace);
        value = first == std::wstring::npos ? L"" : value.substr(first, last - first + 1);
    }

    const ControlSpec* FindControl(int id) const {
        for (int i = 0; i < spec_.controlCount; ++i) {
            if (spec_.controls[i].id == id) return &spec_.controls[i];
        }
        return nullptr;
    }

    RuntimeControl* FindRuntimeControl(int id) {
        for (auto& control : runtimeControls_) {
            if (control.id == id) return &control;
        }
        return nullptr;
    }

    const RuntimeControl* FindRuntimeControl(int id) const {
        for (const auto& control : runtimeControls_) {
            if (control.id == id) return &control;
        }
        return nullptr;
    }

    const ControlSpec* FindControlByName(const wchar_t* name) const {
        if (!name || !name[0]) return nullptr;
        for (int index = 0; index < spec_.controlCount; ++index) if (TextEquals(spec_.controls[index].name, name)) return &spec_.controls[index];
        return nullptr;
    }

    RuntimeControl* FindRuntimeControlByName(const wchar_t* name) {
        const ControlSpec* control = FindControlByName(name); return control ? FindRuntimeControl(control->id) : nullptr;
    }

    HTREEITEM FindTreeItemByText(HWND tree, HTREEITEM item, const wchar_t* text) {
        while (item) {
            wchar_t buffer[512] = {}; TVITEMW info = {}; info.mask = TVIF_TEXT; info.hItem = item; info.pszText = buffer; info.cchTextMax = 512;
            if (TreeView_GetItem(tree, &info) && TextEquals(buffer, text)) return item;
            HTREEITEM child = TreeView_GetChild(tree, item); HTREEITEM found = child ? FindTreeItemByText(tree, child, text) : nullptr; if (found) return found;
            item = TreeView_GetNextSibling(tree, item);
        }
        return nullptr;
    }

    void SelectRadioControl(const ControlSpec& selected, HWND selectedHwnd) {
        for (auto& runtime : runtimeControls_) {
            const ControlSpec* candidate = FindControl(runtime.id);
            if (!candidate || !IsType(*candidate, L"RadioButton") || candidate->id == selected.id) continue;
            bool sameNamedGroup = selected.option1 && selected.option1[0] && candidate->option1 && std::wcscmp(selected.option1, candidate->option1) == 0;
            bool sameDefaultGroup = (!selected.option1 || !selected.option1[0]) && (!candidate->option1 || !candidate->option1[0]) && candidate->parentId == selected.parentId;
            if (!(sameNamedGroup || sameDefaultGroup)) continue;
            if (SendMessageW(runtime.hwnd, BM_GETCHECK, 0, 0) == BST_CHECKED) {
                SendMessageW(runtime.hwnd, BM_SETCHECK, BST_UNCHECKED, 0);
                InvalidateRect(runtime.hwnd, nullptr, TRUE);
                DispatchLingEvent(*candidate, L"Unchecked");
            }
        }
        SendMessageW(selectedHwnd, BM_SETCHECK, BST_CHECKED, 0);
        InvalidateRect(selectedHwnd, nullptr, TRUE);
        DispatchLingEvent(selected, L"Checked");
    }

    RuntimeTabPage* FindTabPage(int tabControlId, const wchar_t* slot) {
        RuntimeTabPage* first = nullptr;
        for (auto& page : tabPages_) {
            if (page.tabControlId != tabControlId) continue;
            if (!first) first = &page;
            if (slot && slot[0] && page.slot == slot) return &page;
        }
        return first;
    }

    RuntimeTabPage* FindTabPageByHwnd(HWND hwnd) {
        for (auto& page : tabPages_) if (page.hwnd == hwnd) return &page;
        return nullptr;
    }

    COLORREF ResolveTabBackground(const ControlSpec& control) const {
        return control.backgroundTransparent ? GetSysColor(COLOR_WINDOW) : control.background;
    }

    void PaintTabPage(HWND hwnd, HDC hdc) {
        RuntimeTabPage* page = FindTabPageByHwnd(hwnd);
        const ControlSpec* control = page ? FindControl(page->tabControlId) : nullptr;
        RuntimeControl* tabRuntime = page ? FindRuntimeControl(page->tabControlId) : nullptr;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        HBRUSH brush = control && !control->backgroundTransparent
            ? CreateSolidBrush(control->background)
            : GetSysColorBrush(COLOR_WINDOW);
        FillRect(hdc, &clientRect, brush);
        if (control && !control->backgroundTransparent) DeleteObject(brush);
        if (control && (!tabRuntime || !tabRuntime->hideTabHeader)) {
            COLORREF border = BlendColor(ResolveTabBackground(*control), control->foreground, 18);
            HPEN pen = CreatePen(PS_SOLID, 1, border);
            HGDIOBJ oldPen = SelectObject(hdc, pen);
            HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            Rectangle(hdc, clientRect.left, clientRect.top, clientRect.right, clientRect.bottom);
            SelectObject(hdc, oldBrush);
            SelectObject(hdc, oldPen);
            DeleteObject(pen);
        }
    }

    static LRESULT CALLBACK TabPageSubclassProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam, UINT_PTR subclassId, DWORD_PTR referenceData) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (self && message == WM_ERASEBKGND) {
            self->PaintTabPage(hwnd, reinterpret_cast<HDC>(wParam));
            return 1;
        }
        if (self && message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            self->PaintTabPage(hwnd, hdc);
            EndPaint(hwnd, &paint);
            return 0;
        }
        if (self && (
            message == WM_COMMAND || message == WM_NOTIFY || message == WM_HSCROLL || message == WM_VSCROLL
            || message == WM_DRAWITEM || message == WM_MEASUREITEM || message == WM_COMPAREITEM || message == WM_DELETEITEM
            || message == WM_CTLCOLORSTATIC || message == WM_CTLCOLOREDIT || message == WM_CTLCOLORBTN
            || message == WM_CTLCOLORLISTBOX || message == WM_CTLCOLORSCROLLBAR || message == WM_CONTEXTMENU
        )) return SendMessageW(self->hwnd_, message, wParam, lParam);
        if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, TabPageSubclassProc, subclassId);
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    void UpdateTabChildren(const ControlSpec& tabControl) {
        RuntimeControl* tabRuntime = FindRuntimeControl(tabControl.id);
        if (!tabRuntime || !tabRuntime->hwnd) return;
        auto tabs = DecodeControlRecords(tabControl.data, 3);
        int selectedIndex = TabCtrl_GetCurSel(tabRuntime->hwnd);
        std::wstring activeSlot = selectedIndex >= 0 && selectedIndex < static_cast<int>(tabs.size()) ? tabs[selectedIndex][0] : L"";
        RuntimeTabPage* activePage = nullptr;
        for (auto& page : tabPages_) {
            if (page.tabControlId != tabControl.id) continue;
            if (page.slot == activeSlot) activePage = &page;
            else ShowWindow(page.hwnd, SW_HIDE);
        }
        RedrawWindow(tabRuntime->hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_UPDATENOW);
        if (activePage) {
            const RECT& rect = activePage->contentRect;
            SetWindowPos(activePage->hwnd, HWND_TOP, rect.left, rect.top,
                std::max(0L, rect.right - rect.left),
                std::max(0L, rect.bottom - rect.top),
                SWP_NOACTIVATE | SWP_SHOWWINDOW);
            RedrawWindow(activePage->hwnd, nullptr, nullptr,
                RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
        }
    }

    void WireCompositeControls() {
        for (int index = 0; index < spec_.controlCount; ++index) {
            const ControlSpec& control = spec_.controls[index];
            RuntimeControl* runtime = FindRuntimeControl(control.id);
            if (!runtime || !runtime->hwnd) continue;
            if (IsType(control, L"UpDown") && control.option1 && control.option1[0]) {
                RuntimeControl* buddy = FindRuntimeControl(_wtoi(control.option1));
                if (buddy && buddy->hwnd) SendMessageW(runtime->hwnd, UDM_SETBUDDY, reinterpret_cast<WPARAM>(buddy->hwnd), 0);
            } else if (IsType(control, L"ReBar")) {
                auto bands = DecodeControlRecords(control.data, 8);
                for (const auto& band : bands) {
                    RuntimeControl* child = FindRuntimeControl(_wtoi(band[2].c_str()));
                    if (!child || !child->hwnd) continue;
                    REBARBANDINFOW info = {}; info.cbSize = sizeof(info);
                    info.fMask = RBBIM_TEXT | RBBIM_CHILD | RBBIM_CHILDSIZE | RBBIM_SIZE | RBBIM_STYLE;
                    auto rebarOptions = DecodeControlRecords(control.data2, 5);
                    bool locked = !rebarOptions.empty() && rebarOptions[0][0] == L"1";
                    bool showGrippers = (rebarOptions.empty() || rebarOptions[0][1] == L"1") && !locked;
                    bool fixedHeight = !rebarOptions.empty() && rebarOptions[0][2] == L"1";
                    bool resizable = band[7] != L"0";
                    info.fStyle = RBBS_CHILDEDGE
                        | (showGrippers ? RBBS_GRIPPERALWAYS : RBBS_NOGRIPPER)
                        | (band[4] == L"1" ? RBBS_BREAK : 0)
                        | (resizable ? 0 : RBBS_FIXEDSIZE);
                    info.lpText = const_cast<wchar_t*>(band[1].c_str());
                    info.hwndChild = child->frameHwnd ? child->frameHwnd : child->hwnd;
                    info.cxMinChild = ScaleForDpi(std::max(1, _wtoi(band[5].c_str())), dpi_);
                    info.cyMinChild = ScaleForDpi(std::max(1, _wtoi(band[6].c_str())), dpi_);
                    info.cyChild = info.cyMinChild;
                    info.cyMaxChild = fixedHeight ? info.cyMinChild : ScaleForDpi(std::max(_wtoi(band[6].c_str()), control.height), dpi_);
                    info.cx = ScaleForDpi(std::max(_wtoi(band[3].c_str()), _wtoi(band[5].c_str())), dpi_);
                    SendMessageW(runtime->hwnd, RB_INSERTBANDW, static_cast<WPARAM>(-1), reinterpret_cast<LPARAM>(&info));
                }
            } else if (IsType(control, L"Pager")) {
                for (auto& candidate : runtimeControls_) {
                    const ControlSpec* child = FindControl(candidate.id);
                    if (child && child->parentId == control.id) { SendMessageW(runtime->hwnd, PGM_SETCHILD, 0, reinterpret_cast<LPARAM>(candidate.frameHwnd ? candidate.frameHwnd : candidate.hwnd)); break; }
                }
            } else if (IsType(control, L"TabControl")) {
                UpdateTabChildren(control);
            }
        }
    }

    void AttachTooltip(HWND child, const ControlSpec& control) {
        if (!control.tooltip || !control.tooltip[0]) return;
        HWND tooltip = CreateWindowExW(WS_EX_TOPMOST, TOOLTIPS_CLASSW, nullptr,
            WS_POPUP | TTS_ALWAYSTIP | TTS_NOPREFIX,
            CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT,
            hwnd_, nullptr, g_instance, nullptr);
        if (!tooltip) return;
        SetWindowPos(tooltip, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        SendMessageW(tooltip, TTM_SETDELAYTIME, TTDT_INITIAL, MAKELPARAM(std::max(0, control.tooltipDelay), 0));
        TOOLINFOW info = {};
        info.cbSize = sizeof(info); info.uFlags = TTF_IDISHWND | TTF_SUBCLASS;
        info.hwnd = hwnd_; info.uId = reinterpret_cast<UINT_PTR>(child);
        info.lpszText = const_cast<wchar_t*>(control.tooltip);
        SendMessageW(tooltip, TTM_ADDTOOLW, 0, reinterpret_cast<LPARAM>(&info));
        tooltipWindows_.push_back(tooltip);
    }

    static COLORREF BlendColor(COLORREF source, COLORREF target, int targetPercent) {
        int percent = std::clamp(targetPercent, 0, 100);
        int sourcePercent = 100 - percent;
        return RGB(
            (GetRValue(source) * sourcePercent + GetRValue(target) * percent + 50) / 100,
            (GetGValue(source) * sourcePercent + GetGValue(target) * percent + 50) / 100,
            (GetBValue(source) * sourcePercent + GetBValue(target) * percent + 50) / 100
        );
    }

    bool IsButtonControl(const ControlSpec& control) const {
        return IsType(control, L"Button")
            || IsType(control, L"CheckBox")
            || IsType(control, L"RadioButton");
    }

    bool IsOwnerDrawControl(const ControlSpec& control) const {
        if (!IsButtonControl(control)) return false;
        if (IsType(control, L"CheckBox") || IsType(control, L"RadioButton")) return true;
        return IsType(control, L"Button")
            && !(control.flags & (CF_BUTTON_TOGGLE | CF_BUTTON_SPLIT | CF_BUTTON_COMMAND_LINK));
    }

    COLORREF ResolveControlSurroundingColor(const ControlSpec& control, HWND controlHwnd) const {
        HWND parentHwnd = controlHwnd ? GetParent(controlHwnd) : nullptr;
        for (const auto& page : tabPages_) {
            if (page.hwnd != parentHwnd) continue;
            const ControlSpec* tabControl = FindControl(page.tabControlId);
            return tabControl ? ResolveTabBackground(*tabControl) : GetSysColor(COLOR_WINDOW);
        }
        if (control.parentId > 0) {
            const ControlSpec* parent = FindControl(control.parentId);
            if (parent) {
                if (!parent->backgroundTransparent) return parent->background;
                const RuntimeControl* parentRuntime = FindRuntimeControl(parent->id);
                return ResolveControlSurroundingColor(*parent, parentRuntime ? parentRuntime->hwnd : nullptr);
            }
        }
        return spec_.background;
    }

    HBRUSH ResolveControlSurroundingBrush(const ControlSpec& control, HWND controlHwnd) const {
        HWND parentHwnd = controlHwnd ? GetParent(controlHwnd) : nullptr;
        for (const auto& page : tabPages_) {
            if (page.hwnd != parentHwnd) continue;
            const ControlSpec* tabControl = FindControl(page.tabControlId);
            if (!tabControl || tabControl->backgroundTransparent) return GetSysColorBrush(COLOR_WINDOW);
            const RuntimeControl* tabRuntime = FindRuntimeControl(page.tabControlId);
            return tabRuntime && tabRuntime->brush ? tabRuntime->brush : GetSysColorBrush(COLOR_WINDOW);
        }
        if (control.parentId > 0) {
            const RuntimeControl* parent = FindRuntimeControl(control.parentId);
            const ControlSpec* parentSpec = FindControl(control.parentId);
            if (parentSpec && parentSpec->backgroundTransparent) {
                return ResolveControlSurroundingBrush(*parentSpec, parent ? parent->hwnd : nullptr);
            }
            if (parent && parent->brush) return parent->brush;
        }
        return windowBrush_;
    }

    std::wstring FormatHotKeyDisplay(HWND hwnd) const {
        WORD value = static_cast<WORD>(SendMessageW(hwnd, HKM_GETHOTKEY, 0, 0));
        BYTE virtualKey = LOBYTE(value);
        BYTE modifiers = HIBYTE(value);
        if (!virtualKey) return L"无";

        std::wstring result;
        auto append = [&result](const wchar_t* part) {
            if (!result.empty()) result += L" + ";
            result += part;
        };
        if (modifiers & HOTKEYF_CONTROL) append(L"Ctrl");
        if (modifiers & HOTKEYF_ALT) append(L"Alt");
        if (modifiers & HOTKEYF_SHIFT) append(L"Shift");

        wchar_t keyName[64] = {};
        UINT scanCode = MapVirtualKeyW(virtualKey, MAPVK_VK_TO_VSC) << 16;
        if (modifiers & HOTKEYF_EXT) scanCode |= 1u << 24;
        if (GetKeyNameTextW(static_cast<LONG>(scanCode), keyName, static_cast<int>(std::size(keyName))) > 0) {
            append(keyName);
        } else {
            wchar_t fallback[2] = { static_cast<wchar_t>(virtualKey), 0 };
            append(fallback);
        }
        return result;
    }

    void PaintHotKeyControl(HWND hwnd, HDC providedHdc, const ControlSpec& control, RuntimeControl& runtime) {
        PAINTSTRUCT paint = {};
        HDC hdc = providedHdc ? providedHdc : BeginPaint(hwnd, &paint);
        if (!hdc) return;

        RECT rect = {};
        GetClientRect(hwnd, &rect);
        COLORREF background = control.backgroundTransparent
            ? ResolveControlSurroundingColor(control, hwnd)
            : control.background;
        HBRUSH brush = control.backgroundTransparent
            ? ResolveControlSurroundingBrush(control, hwnd)
            : runtime.brush;
        if (!brush) brush = windowBrush_;
        FillRect(hdc, &rect, brush);

        COLORREF foreground = IsWindowEnabled(hwnd)
            ? control.foreground
            : BlendColor(control.foreground, background, 55);
        SetTextColor(hdc, foreground);
        SetBkMode(hdc, TRANSPARENT);
        HFONT oldFont = runtime.font ? static_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        std::wstring text = FormatHotKeyDisplay(hwnd);
        RECT textRect = rect;
        textRect.left += ScaleForDpi(4, dpi_);
        textRect.right -= ScaleForDpi(4, dpi_);
        DrawTextW(hdc, text.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);

        if (GetFocus() == hwnd) {
            SIZE textSize = {};
            TEXTMETRICW metrics = {};
            GetTextExtentPoint32W(hdc, text.c_str(), static_cast<int>(text.size()), &textSize);
            GetTextMetricsW(hdc, &metrics);
            SetCaretPos(
                std::min(textRect.right - 1, textRect.left + textSize.cx + ScaleForDpi(1, dpi_)),
                std::max(0, static_cast<int>(rect.bottom - rect.top - metrics.tmHeight) / 2)
            );
        }
        if (oldFont) SelectObject(hdc, oldFont);
        if (!providedHdc) EndPaint(hwnd, &paint);
    }

    int TabHeaderHorizontalPadding() const { return ScaleForDpi(12, dpi_); }
    int TabHeaderVerticalPadding() const { return ScaleForDpi(4, dpi_); }
    int TabHeaderIconGap() const { return ScaleForDpi(6, dpi_); }

    void UpdateTabHeaderMinimumWidth(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.hwnd || runtime.hideTabHeader) return;
        HDC hdc = GetDC(runtime.hwnd);
        if (!hdc) return;
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        HIMAGELIST imageList = TabCtrl_GetImageList(runtime.hwnd);
        int iconWidth = 0;
        int iconHeight = 0;
        if (imageList) ImageList_GetIconSize(imageList, &iconWidth, &iconHeight);
        int minimumWidth = ScaleForDpi(48, dpi_);
        int itemCount = TabCtrl_GetItemCount(runtime.hwnd);
        for (int index = 0; index < itemCount; ++index) {
            wchar_t title[512] = {};
            TCITEMW item = {};
            item.mask = TCIF_TEXT | TCIF_IMAGE;
            item.pszText = title;
            item.cchTextMax = 512;
            item.iImage = -1;
            if (!TabCtrl_GetItem(runtime.hwnd, index, &item)) continue;
            SIZE textSize = {};
            GetTextExtentPoint32W(hdc, title, static_cast<int>(std::wcslen(title)), &textSize);
            int desiredWidth = textSize.cx + TabHeaderHorizontalPadding() * 2;
            if (imageList && item.iImage >= 0) desiredWidth += iconWidth + TabHeaderIconGap();
            minimumWidth = std::max(minimumWidth, desiredWidth);
        }
        if (oldFont) SelectObject(hdc, oldFont);
        ReleaseDC(runtime.hwnd, hdc);
        SendMessageW(runtime.hwnd, TCM_SETMINTABWIDTH, 0, minimumWidth);
        InvalidateRect(runtime.hwnd, nullptr, FALSE);
    }

    void PaintTabControl(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        COLORREF pageBackground = ResolveTabBackground(control);
        COLORREF headerBackground = BlendColor(pageBackground, RGB(0, 0, 0), 8);
        COLORREF selectedBackground = BlendColor(pageBackground, RGB(255, 255, 255), 7);
        COLORREF inactiveForeground = BlendColor(control.foreground, pageBackground, 30);
        COLORREF accent = RGB(245, 158, 11);
        if (runtime.hideTabHeader) {
            HBRUSH pageBrush = CreateSolidBrush(pageBackground);
            FillRect(hdc, &clientRect, pageBrush);
            DeleteObject(pageBrush);
            return;
        }
        HBRUSH headerBrush = CreateSolidBrush(headerBackground);
        FillRect(hdc, &clientRect, headerBrush);
        DeleteObject(headerBrush);

        int selectedIndex = TabCtrl_GetCurSel(hwnd);
        POINT cursor = {};
        GetCursorPos(&cursor);
        ScreenToClient(hwnd, &cursor);
        TCHITTESTINFO hit = { cursor, 0 };
        int hoveredIndex = PtInRect(&clientRect, cursor) ? TabCtrl_HitTest(hwnd, &hit) : -1;
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        HIMAGELIST imageList = TabCtrl_GetImageList(hwnd);
        int iconWidth = 0;
        int iconHeight = 0;
        if (imageList) ImageList_GetIconSize(imageList, &iconWidth, &iconHeight);

        int itemCount = TabCtrl_GetItemCount(hwnd);
        for (int index = 0; index < itemCount; ++index) {
            RECT itemRect = {};
            if (!TabCtrl_GetItemRect(hwnd, index, &itemRect)) continue;
            bool selected = index == selectedIndex;
            bool hovered = index == hoveredIndex && !selected;
            COLORREF itemBackground = selected
                ? selectedBackground
                : hovered ? BlendColor(headerBackground, RGB(255, 255, 255), 5) : headerBackground;
            HBRUSH itemBrush = CreateSolidBrush(itemBackground);
            FillRect(hdc, &itemRect, itemBrush);
            DeleteObject(itemBrush);
            wchar_t title[512] = {};
            TCITEMW tabItem = {};
            tabItem.mask = TCIF_TEXT | TCIF_IMAGE;
            tabItem.pszText = title;
            tabItem.cchTextMax = 512;
            tabItem.iImage = -1;
            TabCtrl_GetItem(hwnd, index, &tabItem);
            int padding = TabHeaderHorizontalPadding();
            RECT textRect = itemRect;
            textRect.left += padding;
            textRect.right -= padding;
            if (imageList && tabItem.iImage >= 0) {
                int iconTop = itemRect.top + (itemRect.bottom - itemRect.top - iconHeight) / 2;
                ImageList_Draw(imageList, tabItem.iImage, hdc, textRect.left, iconTop, ILD_TRANSPARENT);
                textRect.left += iconWidth + TabHeaderIconGap();
            }
            COLORREF textColor = IsWindowEnabled(hwnd)
                ? (selected ? control.foreground : inactiveForeground)
                : BlendColor(control.foreground, itemBackground, 55);
            SetTextColor(hdc, textColor);
            DrawTextW(hdc, title, -1, &textRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
            if (selected) {
                HBRUSH accentBrush = CreateSolidBrush(accent);
                RECT accentRect = { itemRect.left + ScaleForDpi(8, dpi_), itemRect.bottom - ScaleForDpi(2, dpi_), itemRect.right - ScaleForDpi(8, dpi_), itemRect.bottom };
                FillRect(hdc, &accentRect, accentBrush);
                DeleteObject(accentBrush);
            }
        }
        if (oldFont) SelectObject(hdc, oldFont);
    }

    bool PaintOwnerButton(const DRAWITEMSTRUCT* item) {
        if (!item) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime) return false;
        HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        bool pressed = enabled && (item->itemState & ODS_SELECTED);
        bool hovered = enabled && !pressed && runtime->mouseInside;
        bool focused = enabled
            && (item->itemState & ODS_FOCUS)
            && !(item->itemState & ODS_NOFOCUSRECT);
        COLORREF surrounding = ResolveControlSurroundingColor(*control, item->hwndItem);
        COLORREF background = control->background;
        COLORREF rowBackground = control->backgroundTransparent ? surrounding : control->background;
        COLORREF foreground = control->foreground;
        COLORREF border = BlendColor(control->background, RGB(255, 255, 255), 18);
        if (!enabled) {
            background = BlendColor(control->background, surrounding, 55);
            if (!control->backgroundTransparent) rowBackground = background;
            foreground = BlendColor(control->foreground, surrounding, 55);
            border = BlendColor(border, surrounding, 55);
        } else if (pressed) {
            background = BlendColor(control->background, RGB(0, 0, 0), 16);
            border = BlendColor(control->background, RGB(255, 255, 255), 24);
        } else if (hovered) {
            background = BlendColor(control->background, RGB(255, 255, 255), 10);
            border = BlendColor(control->background, RGB(255, 255, 255), 34);
        }
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, foreground);

        if (IsType(*control, L"ColorPicker")) {
            HBRUSH backgroundBrush = CreateSolidBrush(rowBackground);
            FillRect(item->hDC, &item->rcItem, backgroundBrush);
            DeleteObject(backgroundBrush);
            HPEN borderPen = CreatePen(PS_SOLID, 1, border);
            HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
            HGDIOBJ oldBrush = SelectObject(item->hDC, GetStockObject(NULL_BRUSH));
            Rectangle(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom);
            int inset = ScaleForDpi(5, dpi_);
            int swatchWidth = std::min(ScaleForDpi(32, dpi_), std::max(ScaleForDpi(18, dpi_), static_cast<int>(item->rcItem.right - item->rcItem.left) / 4));
            RECT swatch = { item->rcItem.left + inset, item->rcItem.top + inset, item->rcItem.left + inset + swatchWidth, item->rcItem.bottom - inset };
            HBRUSH colorBrush = CreateSolidBrush(runtime->colorValue);
            FillRect(item->hDC, &swatch, colorBrush);
            FrameRect(item->hDC, &swatch, reinterpret_cast<HBRUSH>(GetStockObject(GRAY_BRUSH)));
            DeleteObject(colorBrush);
            RECT arrowRect = item->rcItem;
            arrowRect.left = arrowRect.right - ScaleForDpi(22, dpi_);
            DrawTextW(item->hDC, L"▼", -1, &arrowRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
            if (control->flags & CF_COLOR_TEXT) {
                wchar_t valueText[16] = {};
                swprintf_s(valueText, L"#%02X%02X%02X", GetRValue(runtime->colorValue), GetGValue(runtime->colorValue), GetBValue(runtime->colorValue));
                RECT textRect = item->rcItem;
                textRect.left = swatch.right + ScaleForDpi(8, dpi_);
                textRect.right = arrowRect.left;
                DrawTextW(item->hDC, valueText, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
            }
            SelectObject(item->hDC, oldBrush);
            SelectObject(item->hDC, oldPen);
            DeleteObject(borderPen);
        } else if (IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton")) {
            HBRUSH backgroundBrush = CreateSolidBrush(rowBackground);
            FillRect(item->hDC, &item->rcItem, backgroundBrush);
            DeleteObject(backgroundBrush);
            int boxSize = ScaleForDpi(14, dpi_);
            int boxTop = item->rcItem.top + (item->rcItem.bottom - item->rcItem.top - boxSize) / 2;
            RECT box = { item->rcItem.left, boxTop, item->rcItem.left + boxSize, boxTop + boxSize };
            HBRUSH boxBrush = CreateSolidBrush(RGB(17, 24, 39));
            COLORREF boxBorder = enabled
                ? (pressed
                    ? RGB(148, 163, 184)
                    : (hovered || focused) ? RGB(125, 211, 252) : RGB(100, 116, 139))
                : BlendColor(RGB(100, 116, 139), spec_.background, 55);
            HPEN borderPen = CreatePen(PS_SOLID, 1, boxBorder);
            HGDIOBJ oldBrush = SelectObject(item->hDC, boxBrush);
            HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
            if (IsType(*control, L"RadioButton")) Ellipse(item->hDC, box.left, box.top, box.right, box.bottom);
            else Rectangle(item->hDC, box.left, box.top, box.right, box.bottom);
            int checkState = static_cast<int>(SendMessageW(item->hwndItem, BM_GETCHECK, 0, 0));
            if (checkState != BST_UNCHECKED) {
                HPEN markPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(2, dpi_)), foreground);
                HGDIOBJ previousMarkPen = SelectObject(item->hDC, markPen);
                if (IsType(*control, L"RadioButton")) {
                    HBRUSH dot = CreateSolidBrush(foreground);
                    HGDIOBJ previousDotBrush = SelectObject(item->hDC, dot);
                    int inset = ScaleForDpi(4, dpi_); Ellipse(item->hDC, box.left + inset, box.top + inset, box.right - inset, box.bottom - inset);
                    SelectObject(item->hDC, previousDotBrush);
                    DeleteObject(dot);
                } else if (checkState == BST_INDETERMINATE) {
                    int centerY = box.top + boxSize / 2;
                    MoveToEx(item->hDC, box.left + ScaleForDpi(3, dpi_), centerY, nullptr);
                    LineTo(item->hDC, box.right - ScaleForDpi(3, dpi_), centerY);
                } else {
                    MoveToEx(item->hDC, box.left + ScaleForDpi(3, dpi_), box.top + ScaleForDpi(7, dpi_), nullptr);
                    LineTo(item->hDC, box.left + ScaleForDpi(6, dpi_), box.top + ScaleForDpi(10, dpi_));
                    LineTo(item->hDC, box.right - ScaleForDpi(3, dpi_), box.top + ScaleForDpi(4, dpi_));
                }
                SelectObject(item->hDC, previousMarkPen);
                DeleteObject(markPen);
            }
            SelectObject(item->hDC, oldBrush); SelectObject(item->hDC, oldPen);
            DeleteObject(boxBrush); DeleteObject(borderPen);
            RECT textRect = item->rcItem; textRect.left = box.right + ScaleForDpi(8, dpi_);
            DrawTextW(item->hDC, control->text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        } else {
            HBRUSH cornerBrush = CreateSolidBrush(surrounding);
            FillRect(item->hDC, &item->rcItem, cornerBrush);
            DeleteObject(cornerBrush);
            int itemWidth = static_cast<int>(item->rcItem.right - item->rcItem.left);
            int itemHeight = static_cast<int>(item->rcItem.bottom - item->rcItem.top);
            int maxRadius = std::max(0, std::min(itemWidth, itemHeight) / 2);
            int radius = std::clamp(ScaleForDpi(control->cornerRadius, dpi_), 0, maxRadius);
            if (!DrawAntiAliasedRoundedRectangle(item->hDC, item->rcItem, radius, background, border, true)) {
                HBRUSH buttonBrush = CreateSolidBrush(background);
                HPEN borderPen = CreatePen(PS_SOLID, 1, border);
                HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
                HGDIOBJ oldBrush = SelectObject(item->hDC, buttonBrush);
                if (radius == 0) Rectangle(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom);
                else RoundRect(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom, radius * 2, radius * 2);
                SelectObject(item->hDC, oldBrush); SelectObject(item->hDC, oldPen);
                DeleteObject(buttonBrush); DeleteObject(borderPen);
            }
            RECT textRect = item->rcItem;
            if (pressed) OffsetRect(&textRect, ScaleForDpi(1, dpi_), ScaleForDpi(1, dpi_));
            DrawTextW(item->hDC, control->text, -1, &textRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
        if (focused && !IsType(*control, L"CheckBox") && !IsType(*control, L"RadioButton")) {
            RECT focusRect = item->rcItem;
            int focusInset = std::max(ScaleForDpi(3, dpi_), 2);
            InflateRect(&focusRect, -focusInset, -focusInset);
            if (focusRect.right > focusRect.left && focusRect.bottom > focusRect.top) {
                int focusItemWidth = static_cast<int>(item->rcItem.right - item->rcItem.left);
                int focusItemHeight = static_cast<int>(item->rcItem.bottom - item->rcItem.top);
                int outerRadius = std::clamp(ScaleForDpi(control->cornerRadius, dpi_), 0,
                    std::max(0, std::min(focusItemWidth, focusItemHeight) / 2));
                int focusRadius = std::max(0, outerRadius - focusInset);
                if (!DrawAntiAliasedRoundedRectangle(item->hDC, focusRect, focusRadius, RGB(0, 0, 0), RGB(125, 211, 252), false,
                    static_cast<float>(std::max(1, ScaleForDpi(1, dpi_))))) {
                    HPEN focusPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(1, dpi_)), RGB(125, 211, 252));
                    HGDIOBJ oldFocusPen = SelectObject(item->hDC, focusPen);
                    HGDIOBJ oldFocusBrush = SelectObject(item->hDC, GetStockObject(NULL_BRUSH));
                    if (focusRadius == 0) Rectangle(item->hDC, focusRect.left, focusRect.top, focusRect.right, focusRect.bottom);
                    else RoundRect(item->hDC, focusRect.left, focusRect.top, focusRect.right, focusRect.bottom, focusRadius * 2, focusRadius * 2);
                    SelectObject(item->hDC, oldFocusBrush);
                    SelectObject(item->hDC, oldFocusPen);
                    DeleteObject(focusPen);
                }
            }
        }
        if (oldFont) SelectObject(item->hDC, oldFont);
        return true;
    }

    bool PaintOwnerListBox(const DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_LISTBOX) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime || !IsType(*control, L"ListBox")) return false;

        HBRUSH backgroundBrush = CreateSolidBrush(control->background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        bool selected = item->itemID != static_cast<UINT>(-1) && (item->itemState & ODS_SELECTED);
        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        if (selected) {
            RECT selectionRect = item->rcItem;
            int itemSpacing = std::max(0, ScaleForDpi(control->listItemSpacing, dpi_));
            selectionRect.top += itemSpacing / 2;
            selectionRect.bottom -= itemSpacing - itemSpacing / 2;
            InflateRect(&selectionRect, -ScaleForDpi(2, dpi_), -ScaleForDpi(1, dpi_));
            if (selectionRect.right > selectionRect.left && selectionRect.bottom > selectionRect.top) {
                Gdiplus::Graphics graphics(item->hDC);
                graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
                graphics.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
                Gdiplus::RectF bounds(
                    static_cast<Gdiplus::REAL>(selectionRect.left) + 0.5f,
                    static_cast<Gdiplus::REAL>(selectionRect.top) + 0.5f,
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.right - selectionRect.left) - 1.0f),
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.bottom - selectionRect.top) - 1.0f)
                );
                Gdiplus::GraphicsPath path;
                AddRoundedRectanglePath(path, bounds, static_cast<float>(ScaleForDpi(control->listSelectionCornerRadius, dpi_)));
                COLORREF start = enabled ? control->listSelectionStart : BlendColor(control->listSelectionStart, control->background, 55);
                COLORREF end = enabled ? control->listSelectionEnd : BlendColor(control->listSelectionEnd, control->background, 55);
                Gdiplus::PointF gradientStart(bounds.X, bounds.Y);
                Gdiplus::PointF gradientEnd(bounds.GetRight(), bounds.Y);
                Gdiplus::LinearGradientBrush selectionBrush(gradientStart, gradientEnd, ToGdiPlusColor(start), ToGdiPlusColor(end));
                graphics.FillPath(&selectionBrush, &path);
                COLORREF selectionBorder = enabled
                    ? control->listSelectionBorder
                    : BlendColor(control->listSelectionBorder, control->background, 55);
                Gdiplus::Pen borderPen(ToGdiPlusColor(selectionBorder), static_cast<float>(std::max(1, ScaleForDpi(1, dpi_))));
                graphics.DrawPath(&borderPen, &path);
            }
        }

        if (item->itemID != static_cast<UINT>(-1)) {
            int textLength = static_cast<int>(SendMessageW(item->hwndItem, LB_GETTEXTLEN, item->itemID, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\0');
                SendMessageW(item->hwndItem, LB_GETTEXT, item->itemID, reinterpret_cast<LPARAM>(text.data()));
                HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
                SetBkMode(item->hDC, TRANSPARENT);
                SetTextColor(item->hDC, enabled ? control->foreground : BlendColor(control->foreground, control->background, 55));
                RECT textRect = item->rcItem;
                textRect.left += ScaleForDpi(10, dpi_);
                textRect.right -= ScaleForDpi(8, dpi_);
                DrawTextW(item->hDC, text.data(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
                if (oldFont) SelectObject(item->hDC, oldFont);
            }
        }
        return true;
    }

    void PaintGroupBox(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        if (!hwnd || !hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        HBRUSH backgroundBrush = CreateSolidBrush(control.background);
        FillRect(hdc, &clientRect, backgroundBrush);

        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        RECT titleRect = { 0, 0, 0, 0 };
        DrawTextW(hdc, control.text, -1, &titleRect, DT_CALCRECT | DT_SINGLELINE | DT_NOPREFIX);
        int horizontalPadding = ScaleForDpi(6, dpi_);
        int outerPadding = ScaleForDpi(8, dpi_);
        int titleHeight = std::max(ScaleForDpi(control.fontSize, dpi_), static_cast<int>(titleRect.bottom - titleRect.top));
        int frameTop = std::max(1, titleHeight / 2);
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0,
            std::max(0, std::min(static_cast<int>(clientRect.right - clientRect.left), static_cast<int>(clientRect.bottom - clientRect.top)) / 2));
        if (borderWidth > 0) {
            RECT frameRect = clientRect;
            frameRect.top += frameTop;
            frameRect.right = std::max(frameRect.left, frameRect.right - 1);
            frameRect.bottom = std::max(frameRect.top, frameRect.bottom - 1);
            HPEN borderPen = CreatePen(PS_SOLID, borderWidth, control.listBorderColor);
            HGDIOBJ oldPen = SelectObject(hdc, borderPen);
            HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            Rectangle(hdc, frameRect.left, frameRect.top, frameRect.right, frameRect.bottom);
            SelectObject(hdc, oldBrush);
            SelectObject(hdc, oldPen);
            DeleteObject(borderPen);
        }

        int clientWidth = std::max(0, static_cast<int>(clientRect.right - clientRect.left));
        int titleWidth = std::min(clientWidth, static_cast<int>(titleRect.right - titleRect.left) + horizontalPadding * 2);
        int titleLeft = outerPadding;
        if (TextEquals(control.option1, L"center")) titleLeft = std::max(0, (clientWidth - titleWidth) / 2);
        else if (TextEquals(control.option1, L"right")) titleLeft = std::max(0, clientWidth - titleWidth - outerPadding);
        titleRect.left = titleLeft;
        titleRect.top = 0;
        titleRect.right = std::min(static_cast<int>(clientRect.right), titleLeft + titleWidth);
        titleRect.bottom = std::min(static_cast<int>(clientRect.bottom), titleHeight);
        if (control.text && control.text[0]) {
            FillRect(hdc, &titleRect, backgroundBrush);
            RECT textRect = titleRect;
            textRect.left += horizontalPadding;
            textRect.right -= horizontalPadding;
            SetBkMode(hdc, TRANSPARENT);
            SetTextColor(hdc, IsWindowEnabled(hwnd) ? control.foreground : BlendColor(control.foreground, control.background, 55));
            DrawTextW(hdc, control.text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
        if (oldFont) SelectObject(hdc, oldFont);
        DeleteObject(backgroundBrush);
    }

    void PaintTransparentSysLink(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        if (!hwnd || !hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        FillRect(hdc, &clientRect, ResolveControlSurroundingBrush(control, hwnd));

        int savedDc = SaveDC(hdc);
        if (runtime.font) SelectObject(hdc, runtime.font);
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, control.enabled ? control.foreground : GetSysColor(COLOR_GRAYTEXT));

        RECT textRect = clientRect;
        textRect.left += ScaleForDpi(1, dpi_);
        textRect.right -= ScaleForDpi(1, dpi_);
        DrawTextW(hdc, control.text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);

        RECT measured = textRect;
        DrawTextW(hdc, control.text, -1, &measured, DT_LEFT | DT_SINGLELINE | DT_CALCRECT | DT_NOPREFIX);
        int textHeight = std::max(1, static_cast<int>(measured.bottom - measured.top));
        int textTop = static_cast<int>(clientRect.top) + std::max(0, static_cast<int>(clientRect.bottom - clientRect.top) - textHeight) / 2;
        int underlineRight = std::min(static_cast<int>(clientRect.right) - ScaleForDpi(1, dpi_), static_cast<int>(measured.right));
        int underlineY = std::min(static_cast<int>(clientRect.bottom) - 1, textTop + textHeight);
        HPEN underline = CreatePen(PS_SOLID, 1, control.enabled ? control.foreground : GetSysColor(COLOR_GRAYTEXT));
        HPEN oldPen = reinterpret_cast<HPEN>(SelectObject(hdc, underline));
        MoveToEx(hdc, textRect.left, underlineY, nullptr);
        LineTo(hdc, underlineRight, underlineY);
        SelectObject(hdc, oldPen);
        DeleteObject(underline);

        if (GetFocus() == hwnd) {
            RECT focusRect = { textRect.left, textTop, underlineRight + 1, std::min(static_cast<int>(clientRect.bottom), underlineY + ScaleForDpi(2, dpi_)) };
            HPEN focusPen = CreatePen(PS_DOT, 1, control.enabled ? control.foreground : GetSysColor(COLOR_GRAYTEXT));
            HGDIOBJ oldFocusPen = SelectObject(hdc, focusPen);
            HGDIOBJ oldFocusBrush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            Rectangle(hdc, focusRect.left, focusRect.top, focusRect.right, focusRect.bottom);
            SelectObject(hdc, oldFocusBrush);
            SelectObject(hdc, oldFocusPen);
            DeleteObject(focusPen);
        }
        RestoreDC(hdc, savedDc);
    }

    bool PaintOwnerComboBox(const DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_COMBOBOX) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = FindRuntimeControl(static_cast<int>(item->CtlID));
        if (!control || !runtime || !IsType(*control, L"ComboBox") || (control->flags & CF_EDITABLE)) return false;

        bool enabled = IsWindowEnabled(item->hwndItem) != FALSE && !(item->itemState & ODS_DISABLED);
        bool collapsedSelection = (item->itemState & ODS_COMBOBOXEDIT) != 0;
        bool selected = !collapsedSelection && item->itemID != static_cast<UINT>(-1) && (item->itemState & ODS_SELECTED);
        HBRUSH backgroundBrush = CreateSolidBrush(control->background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        if (selected) {
            RECT selectionRect = item->rcItem;
            InflateRect(&selectionRect, -ScaleForDpi(2, dpi_), -ScaleForDpi(1, dpi_));
            if (selectionRect.right > selectionRect.left && selectionRect.bottom > selectionRect.top) {
                Gdiplus::Graphics graphics(item->hDC);
                graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
                Gdiplus::RectF bounds(
                    static_cast<Gdiplus::REAL>(selectionRect.left) + 0.5f,
                    static_cast<Gdiplus::REAL>(selectionRect.top) + 0.5f,
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.right - selectionRect.left) - 1.0f),
                    std::max(0.0f, static_cast<Gdiplus::REAL>(selectionRect.bottom - selectionRect.top) - 1.0f)
                );
                Gdiplus::PointF gradientStart(bounds.X, bounds.Y);
                Gdiplus::PointF gradientEnd(bounds.GetRight(), bounds.Y);
                Gdiplus::LinearGradientBrush selectionBrush(
                    gradientStart, gradientEnd,
                    ToGdiPlusColor(enabled ? control->listSelectionStart : BlendColor(control->listSelectionStart, control->background, 55)),
                    ToGdiPlusColor(enabled ? control->listSelectionEnd : BlendColor(control->listSelectionEnd, control->background, 55))
                );
                graphics.FillRectangle(&selectionBrush, bounds);
            }
        }

        int index = item->itemID == static_cast<UINT>(-1)
            ? static_cast<int>(SendMessageW(item->hwndItem, CB_GETCURSEL, 0, 0))
            : static_cast<int>(item->itemID);
        if (index >= 0) {
            int textLength = static_cast<int>(SendMessageW(item->hwndItem, CB_GETLBTEXTLEN, index, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\0');
                SendMessageW(item->hwndItem, CB_GETLBTEXT, index, reinterpret_cast<LPARAM>(text.data()));
                HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
                SetBkMode(item->hDC, TRANSPARENT);
                SetTextColor(item->hDC, enabled ? control->foreground : BlendColor(control->foreground, control->background, 55));
                RECT textRect = item->rcItem;
                textRect.left += ScaleForDpi(collapsedSelection ? 8 : 10, dpi_);
                textRect.right -= ScaleForDpi(6, dpi_);
                DrawTextW(item->hDC, text.data(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
                if (oldFont) SelectObject(item->hDC, oldFont);
            }
        }
        return true;
    }

    bool PaintOwnerStatusBar(const DRAWITEMSTRUCT* item) {
        if (!item) return false;
        const ControlSpec* control = FindControl(static_cast<int>(item->CtlID));
        RuntimeControl* runtime = control ? FindRuntimeControl(control->id) : nullptr;
        if (!control || !runtime || !IsType(*control, L"StatusBar")) return false;

        COLORREF background = control->backgroundTransparent
            ? ResolveControlSurroundingColor(*control, runtime->hwnd)
            : control->background;
        COLORREF foreground = IsWindowEnabled(runtime->hwnd)
            ? control->foreground
            : BlendColor(control->foreground, background, 55);
        HBRUSH backgroundBrush = CreateSolidBrush(background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        HPEN borderPen = CreatePen(PS_SOLID, 1, BlendColor(background, foreground, 22));
        HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
        MoveToEx(item->hDC, item->rcItem.right - 1, item->rcItem.top, nullptr);
        LineTo(item->hDC, item->rcItem.right - 1, item->rcItem.bottom);
        SelectObject(item->hDC, oldPen);
        DeleteObject(borderPen);

        auto rows = DecodeControlRecords(control->data, 2);
        size_t partIndex = static_cast<size_t>(item->itemID);
        const wchar_t* text = partIndex < rows.size() ? rows[partIndex][0].c_str() : control->text;
        RECT textRect = item->rcItem;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right -= ScaleForDpi(6, dpi_);
        HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font)) : nullptr;
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, foreground);
        UINT textFormat = (control->flags & CF_ALIGN_CENTER) ? DT_CENTER
            : (control->flags & CF_ALIGN_RIGHT) ? DT_RIGHT
            : DT_LEFT;
        DrawTextW(item->hDC, text ? text : L"", -1, &textRect, textFormat | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        if (oldFont) SelectObject(item->hDC, oldFont);
        return true;
    }

    bool PaintOwnerComboBoxEx(const ControlSpec& control, RuntimeControl& runtime, const DRAWITEMSTRUCT* item) {
        if (!item || item->CtlType != ODT_COMBOBOX) return false;
        bool collapsedSelection = (item->itemState & ODS_COMBOBOXEDIT) != 0;
        bool selected = !collapsedSelection && item->itemID != static_cast<UINT>(-1)
            && (item->itemState & ODS_SELECTED) != 0;
        bool enabled = IsWindowEnabled(runtime.hwnd) != FALSE && (item->itemState & ODS_DISABLED) == 0;
        COLORREF background = enabled ? control.background : BlendColor(control.background, spec_.background, 45);
        COLORREF foreground = enabled ? control.foreground : BlendColor(control.foreground, background, 55);
        COLORREF itemBackground = selected ? BlendColor(background, foreground, 18) : background;
        HBRUSH backgroundBrush = CreateSolidBrush(itemBackground);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        HWND combo = reinterpret_cast<HWND>(SendMessageW(runtime.hwnd, CBEM_GETCOMBOCONTROL, 0, 0));
        int index = item->itemID == static_cast<UINT>(-1)
            ? (combo ? static_cast<int>(SendMessageW(combo, CB_GETCURSEL, 0, 0)) : -1)
            : static_cast<int>(item->itemID);
        wchar_t text[1024] = {};
        int image = -1;
        int selectedImage = -1;
        if (index >= 0) {
            COMBOBOXEXITEMW info = {};
            info.mask = CBEIF_TEXT | CBEIF_IMAGE | CBEIF_SELECTEDIMAGE;
            info.iItem = index;
            info.pszText = text;
            info.cchTextMax = static_cast<int>(std::size(text));
            if (SendMessageW(runtime.hwnd, CBEM_GETITEMW, 0, reinterpret_cast<LPARAM>(&info))) {
                image = info.iImage;
                selectedImage = info.iSelectedImage;
            }
        } else if (control.text) {
            wcsncpy_s(text, control.text, _TRUNCATE);
        }

        RECT textRect = item->rcItem;
        textRect.left += ScaleForDpi(8, dpi_);
        HIMAGELIST imageList = reinterpret_cast<HIMAGELIST>(SendMessageW(runtime.hwnd, CBEM_GETIMAGELIST, 0, 0));
        int drawImage = selected && selectedImage >= 0 ? selectedImage : image;
        if (imageList && drawImage >= 0) {
            int imageWidth = 0;
            int imageHeight = 0;
            ImageList_GetIconSize(imageList, &imageWidth, &imageHeight);
            int imageY = item->rcItem.top + std::max(0L, (item->rcItem.bottom - item->rcItem.top - imageHeight) / 2);
            ImageList_Draw(imageList, drawImage, item->hDC, textRect.left, imageY, enabled ? ILD_NORMAL : ILD_BLEND50);
            textRect.left += imageWidth + ScaleForDpi(6, dpi_);
        }
        textRect.right -= ScaleForDpi(collapsedSelection ? 28 : 6, dpi_);
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime.font)) : nullptr;
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, foreground);
        DrawTextW(item->hDC, text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        if (oldFont) SelectObject(item->hDC, oldFont);
        if ((item->itemState & ODS_FOCUS) != 0) {
            RECT focusRect = item->rcItem;
            InflateRect(&focusRect, -ScaleForDpi(2, dpi_), -ScaleForDpi(2, dpi_));
            HBRUSH focusBrush = CreateSolidBrush(RGB(125, 211, 252));
            FrameRect(item->hDC, &focusRect, focusBrush);
            DeleteObject(focusBrush);
        }
        return true;
    }

    void PaintCollapsedComboBox(HWND hwnd, HDC hdc, const ControlSpec& control) {
        if (!hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        RECT collapsedRect = clientRect;
        collapsedRect.bottom = std::min(
            collapsedRect.bottom,
            collapsedRect.top + ScaleForDpi(control.height, dpi_)
        );
        if (collapsedRect.right <= collapsedRect.left || collapsedRect.bottom <= collapsedRect.top) return;
        int savedDc = SaveDC(hdc);
        IntersectClipRect(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom);
        const ControlSpec* parent = control.parentId ? FindControl(control.parentId) : nullptr;
        COLORREF surrounding = parent ? parent->background : spec_.background;
        HBRUSH surroundingBrush = CreateSolidBrush(surrounding);
        FillRect(hdc, &collapsedRect, surroundingBrush);
        DeleteObject(surroundingBrush);

        bool enabled = IsWindowEnabled(hwnd) != FALSE;
        COLORREF background = enabled ? control.background : BlendColor(control.background, surrounding, 45);
        COLORREF foreground = enabled ? control.foreground : BlendColor(control.foreground, background, 55);
        COLORREF border = enabled ? control.listBorderColor : BlendColor(control.listBorderColor, background, 55);
        int clientWidth = static_cast<int>(collapsedRect.right - collapsedRect.left);
        int clientHeight = static_cast<int>(collapsedRect.bottom - collapsedRect.top);
        int radius = std::clamp(ScaleForDpi(control.listSelectionCornerRadius, dpi_), 0,
            std::max(0, std::min(clientWidth, clientHeight) / 2));
        if (!DrawAntiAliasedRoundedRectangle(hdc, collapsedRect, radius, background, border, true)) {
            HBRUSH backgroundBrush = CreateSolidBrush(background);
            HPEN borderPen = CreatePen(PS_SOLID, std::max(1, ScaleForDpi(1, dpi_)), border);
            HGDIOBJ oldBrush = SelectObject(hdc, backgroundBrush);
            HGDIOBJ oldBorderPen = SelectObject(hdc, borderPen);
            if (radius > 0) RoundRect(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom, radius * 2, radius * 2);
            else Rectangle(hdc, collapsedRect.left, collapsedRect.top, collapsedRect.right, collapsedRect.bottom);
            SelectObject(hdc, oldBorderPen);
            SelectObject(hdc, oldBrush);
            DeleteObject(borderPen);
            DeleteObject(backgroundBrush);
        }

        int buttonWidth = std::clamp(clientHeight, ScaleForDpi(24, dpi_), ScaleForDpi(36, dpi_));
        RECT textRect = collapsedRect;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right -= buttonWidth + ScaleForDpi(2, dpi_);
        int selectedIndex = static_cast<int>(SendMessageW(hwnd, CB_GETCURSEL, 0, 0));
        std::wstring selectedText = control.text ? control.text : L"";
        if (selectedIndex >= 0) {
            int textLength = static_cast<int>(SendMessageW(hwnd, CB_GETLBTEXTLEN, selectedIndex, 0));
            if (textLength >= 0) {
                std::vector<wchar_t> text(static_cast<size_t>(textLength) + 1, L'\0');
                SendMessageW(hwnd, CB_GETLBTEXT, selectedIndex, reinterpret_cast<LPARAM>(text.data()));
                selectedText.assign(text.data());
            }
        }
        RuntimeControl* runtime = FindRuntimeControl(control.id);
        HFONT oldFont = runtime && runtime->font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime->font)) : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, foreground);
        DrawTextW(hdc, selectedText.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        if (oldFont) SelectObject(hdc, oldFont);

        int centerX = collapsedRect.right - buttonWidth / 2;
        int centerY = (collapsedRect.top + collapsedRect.bottom) / 2;
        COLORREF arrowColor = enabled ? BlendColor(foreground, background, 28) : BlendColor(foreground, background, 55);
        Gdiplus::Graphics arrowGraphics(hdc);
        arrowGraphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
        Gdiplus::Pen arrowPen(ToGdiPlusColor(arrowColor), std::max(1.25f, static_cast<float>(ScaleForDpi(1, dpi_))));
        Gdiplus::PointF arrowPoints[] = {
            { static_cast<Gdiplus::REAL>(centerX - ScaleForDpi(4, dpi_)), static_cast<Gdiplus::REAL>(centerY - ScaleForDpi(2, dpi_)) },
            { static_cast<Gdiplus::REAL>(centerX), static_cast<Gdiplus::REAL>(centerY + ScaleForDpi(2, dpi_)) },
            { static_cast<Gdiplus::REAL>(centerX + ScaleForDpi(4, dpi_)), static_cast<Gdiplus::REAL>(centerY - ScaleForDpi(2, dpi_)) }
        };
        arrowGraphics.DrawLines(&arrowPen, arrowPoints, 3);
        if (savedDc) RestoreDC(hdc, savedDc);
    }

    LRESULT PaintHeader(const ControlSpec& control, NMCUSTOMDRAW* draw, bool tintBackground) {
        if (!draw) return CDRF_DODEFAULT;
        if (draw->dwDrawStage == CDDS_PREPAINT) return CDRF_NOTIFYITEMDRAW | CDRF_NOTIFYPOSTPAINT;
        if (draw->dwDrawStage == CDDS_POSTPAINT) {
            RECT clientRect = {};
            if (!GetClientRect(draw->hdr.hwndFrom, &clientRect)) return CDRF_DODEFAULT;
            int paintedRight = clientRect.left;
            int itemCount = Header_GetItemCount(draw->hdr.hwndFrom);
            if (itemCount > 0) {
                RECT lastItemRect = {};
                if (Header_GetItemRect(draw->hdr.hwndFrom, itemCount - 1, &lastItemRect)) {
                    paintedRight = (std::min)(clientRect.right, lastItemRect.right);
                }
            }
            if (paintedRight < clientRect.right) {
                COLORREF background = tintBackground
                    ? BlendColor(control.background, RGB(255, 255, 255), 12)
                    : control.background;
                COLORREF border = BlendColor(control.background, RGB(255, 255, 255), 24);
                RECT trailingRect = { paintedRight, clientRect.top, clientRect.right, clientRect.bottom };
                HBRUSH brush = CreateSolidBrush(background);
                FillRect(draw->hdc, &trailingRect, brush);
                DeleteObject(brush);
                HPEN borderPen = CreatePen(PS_SOLID, 1, border);
                HGDIOBJ oldPen = SelectObject(draw->hdc, borderPen);
                MoveToEx(draw->hdc, trailingRect.left, trailingRect.bottom - 1, nullptr);
                LineTo(draw->hdc, trailingRect.right, trailingRect.bottom - 1);
                SelectObject(draw->hdc, oldPen);
                DeleteObject(borderPen);
            }
            return CDRF_DODEFAULT;
        }
        if (draw->dwDrawStage != CDDS_ITEMPREPAINT) return CDRF_DODEFAULT;
        wchar_t text[512] = {};
        HDITEMW item = {};
        item.mask = HDI_TEXT | HDI_FORMAT;
        item.pszText = text;
        item.cchTextMax = 512;
        Header_GetItem(draw->hdr.hwndFrom, static_cast<int>(draw->dwItemSpec), &item);
        COLORREF background = tintBackground
            ? BlendColor(control.background, RGB(255, 255, 255), 12)
            : control.background;
        bool pressed = (draw->uItemState & CDIS_SELECTED) != 0;
        bool hot = (draw->uItemState & CDIS_HOT) != 0;
        if (pressed) background = BlendColor(background, RGB(0, 0, 0), 18);
        else if (hot) background = BlendColor(background, control.foreground, 10);
        COLORREF border = BlendColor(background, control.foreground, 24);
        HBRUSH brush = CreateSolidBrush(background);
        FillRect(draw->hdc, &draw->rc, brush);
        DeleteObject(brush);
        HPEN pen = CreatePen(PS_SOLID, 1, border);
        HGDIOBJ oldPen = SelectObject(draw->hdc, pen);
        MoveToEx(draw->hdc, draw->rc.right - 1, draw->rc.top, nullptr);
        LineTo(draw->hdc, draw->rc.right - 1, draw->rc.bottom);
        MoveToEx(draw->hdc, draw->rc.left, draw->rc.bottom - 1, nullptr);
        LineTo(draw->hdc, draw->rc.right, draw->rc.bottom - 1);
        SelectObject(draw->hdc, oldPen);
        DeleteObject(pen);
        RECT textRect = draw->rc;
        int padding = ScaleForDpi(6, dpi_);
        textRect.left += padding;
        textRect.right -= padding;
        if (pressed) OffsetRect(&textRect, ScaleForDpi(1, dpi_), ScaleForDpi(1, dpi_));
        RuntimeControl* runtime = FindRuntimeControl(control.id);
        HFONT oldFont = runtime && runtime->font
            ? reinterpret_cast<HFONT>(SelectObject(draw->hdc, runtime->font))
            : nullptr;
        SetBkMode(draw->hdc, TRANSPARENT);
        COLORREF textColor = (draw->uItemState & CDIS_DISABLED)
            ? BlendColor(control.foreground, background, 55)
            : control.foreground;
        SetTextColor(draw->hdc, textColor);
        UINT format = DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX;
        if (item.fmt & HDF_CENTER) format |= DT_CENTER;
        else if (item.fmt & HDF_RIGHT) format |= DT_RIGHT;
        else format |= DT_LEFT;
        DrawTextW(draw->hdc, text, -1, &textRect, format);
        if (oldFont) SelectObject(draw->hdc, oldFont);
        return CDRF_SKIPDEFAULT;
    }

    LRESULT PaintListViewHeader(const ControlSpec& control, NMCUSTOMDRAW* draw) {
        return PaintHeader(control, draw, true);
    }

    LRESULT PaintStandaloneHeader(const ControlSpec& control, NMCUSTOMDRAW* draw) {
        return PaintHeader(control, draw, false);
    }

    LRESULT PaintToolBar(const ControlSpec& control, NMTBCUSTOMDRAW* draw) {
        if (!draw) return CDRF_DODEFAULT;
        if (draw->nmcd.dwDrawStage == CDDS_PREPAINT) {
            return CDRF_NOTIFYITEMDRAW;
        }
        if (draw->nmcd.dwDrawStage != CDDS_ITEMPREPAINT) return CDRF_DODEFAULT;
        COLORREF background = control.background;
        COLORREF foreground = (draw->nmcd.uItemState & CDIS_DISABLED)
            ? BlendColor(control.foreground, background, 55)
            : control.foreground;
        draw->clrText = foreground;
        draw->clrTextHighlight = foreground;
        draw->clrBtnFace = background;
        draw->clrBtnHighlight = BlendColor(background, control.foreground, 12);
        draw->clrHighlightHotTrack = BlendColor(background, control.foreground, 18);
        draw->nStringBkMode = TRANSPARENT;
        draw->nHLStringBkMode = TRANSPARENT;
        SetBkMode(draw->nmcd.hdc, TRANSPARENT);
        SetTextColor(draw->nmcd.hdc, foreground);
        SetBkColor(draw->nmcd.hdc, background);
        return CDRF_DODEFAULT | TBCDRF_USECDCOLORS;
    }

    void ApplyMonthCalendarColors(HWND calendar, const ControlSpec& control) {
        if (!calendar) return;
        SetWindowTheme(calendar, L"", L"");
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_BACKGROUND, static_cast<LPARAM>(control.background));
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_MONTHBK, static_cast<LPARAM>(control.background));
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_TEXT, static_cast<LPARAM>(control.foreground));
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_TITLEBK, static_cast<LPARAM>(control.background));
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_TITLETEXT, static_cast<LPARAM>(control.foreground));
        SendMessageW(calendar, MCM_SETCOLOR, MCSC_TRAILINGTEXT, static_cast<LPARAM>(control.foreground));
        InvalidateRect(calendar, nullptr, TRUE);
    }

    void ApplyDateTimePickerCalendarAppearance(HWND picker, const ControlSpec& control) {
        if (!picker) return;
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_BACKGROUND, static_cast<LPARAM>(control.background));
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_MONTHBK, static_cast<LPARAM>(control.background));
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_TEXT, static_cast<LPARAM>(control.foreground));
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_TITLEBK, static_cast<LPARAM>(control.background));
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_TITLETEXT, static_cast<LPARAM>(control.foreground));
        SendMessageW(picker, DTM_SETMCCOLOR, MCSC_TRAILINGTEXT, static_cast<LPARAM>(control.foreground));
        HWND calendar = reinterpret_cast<HWND>(SendMessageW(picker, DTM_GETMONTHCAL, 0, 0));
        if (calendar) {
            ApplyMonthCalendarColors(calendar, control);
            RECT minimumRect = {};
            SendMessageW(calendar, MCM_GETMINREQRECT, 0, reinterpret_cast<LPARAM>(&minimumRect));
            int todayWidth = static_cast<int>(SendMessageW(calendar, MCM_GETMAXTODAYWIDTH, 0, 0));
            int requestedHeight = ScaleForDpi(std::max(200, _wtoi(control.data2)), dpi_);
            int calendarWidth = std::max(static_cast<int>(minimumRect.right), todayWidth);
            int calendarHeight = std::max(
                requestedHeight,
                static_cast<int>(minimumRect.bottom));

            HWND dropDown = GetParent(calendar);
            if (!dropDown || dropDown == picker || dropDown == hwnd_) dropDown = calendar;
            RECT dropDownRect = {};
            RECT pickerRect = {};
            GetWindowRect(dropDown, &dropDownRect);
            GetWindowRect(picker, &pickerRect);

            WINDOWINFO dropDownInfo = {};
            dropDownInfo.cbSize = sizeof(dropDownInfo);
            GetWindowInfo(dropDown, &dropDownInfo);
            RECT requiredDropDown = { 0, 0, calendarWidth, calendarHeight };
            InflateRect(&requiredDropDown, ScaleForDpi(3, dpi_), ScaleForDpi(3, dpi_));
            AdjustWindowRectEx(&requiredDropDown, dropDownInfo.dwStyle, FALSE, dropDownInfo.dwExStyle);
            int dropDownWidth = requiredDropDown.right - requiredDropDown.left;
            int dropDownHeight = requiredDropDown.bottom - requiredDropDown.top;

            MONITORINFO monitorInfo = {};
            monitorInfo.cbSize = sizeof(monitorInfo);
            GetMonitorInfoW(MonitorFromWindow(picker, MONITOR_DEFAULTTONEAREST), &monitorInfo);
            int x = std::clamp(
                static_cast<int>(dropDownRect.left),
                static_cast<int>(monitorInfo.rcWork.left),
                std::max(static_cast<int>(monitorInfo.rcWork.left), static_cast<int>(monitorInfo.rcWork.right) - dropDownWidth));
            int y = pickerRect.bottom + dropDownHeight <= monitorInfo.rcWork.bottom
                ? pickerRect.bottom
                : pickerRect.top - dropDownHeight;
            y = std::clamp(
                y,
                static_cast<int>(monitorInfo.rcWork.top),
                std::max(static_cast<int>(monitorInfo.rcWork.top), static_cast<int>(monitorInfo.rcWork.bottom) - dropDownHeight));

            SetWindowPos(dropDown, HWND_TOP, x, y, dropDownWidth, dropDownHeight,
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
            if (dropDown != calendar) {
                int padding = ScaleForDpi(3, dpi_);
                SetWindowPos(calendar, nullptr, padding, padding, calendarWidth, calendarHeight,
                    SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
            }
            RedrawWindow(calendar, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
        }
    }

    void PaintDateTimePicker(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime) {
        if (!hdc) return;
        RECT rect = {};
        GetClientRect(hwnd, &rect);
        bool enabled = IsWindowEnabled(hwnd) != FALSE;
        COLORREF background = control.background;
        COLORREF foreground = enabled
            ? control.foreground
            : BlendColor(control.foreground, background, 55);
        COLORREF border = GetFocus() == hwnd
            ? BlendColor(control.foreground, background, 18)
            : BlendColor(control.foreground, background, 55);
        HBRUSH backgroundBrush = CreateSolidBrush(background);
        HBRUSH borderBrush = CreateSolidBrush(border);
        FillRect(hdc, &rect, backgroundBrush);
        FrameRect(hdc, &rect, borderBrush);

        int minimumButtonWidth = ScaleForDpi(18, dpi_);
        int buttonWidth = std::clamp(GetSystemMetrics(SM_CXVSCROLL), minimumButtonWidth,
            std::max(minimumButtonWidth, static_cast<int>(rect.right - rect.left)));
        RECT buttonRect = rect;
        buttonRect.left = std::max(rect.left + 1, rect.right - buttonWidth);
        InflateRect(&buttonRect, 0, -1);
        COLORREF buttonBackground = runtime.mouseInside
            ? BlendColor(background, foreground, 16)
            : BlendColor(background, foreground, 8);
        HBRUSH buttonBrush = CreateSolidBrush(buttonBackground);
        FillRect(hdc, &buttonRect, buttonBrush);

        int arrowHalfWidth = std::max(3, ScaleForDpi(4, dpi_));
        int arrowHalfHeight = std::max(2, ScaleForDpi(2, dpi_));
        int arrowCenterX = (buttonRect.left + buttonRect.right) / 2;
        int arrowCenterY = (buttonRect.top + buttonRect.bottom) / 2;
        POINT arrow[3] = {
            { arrowCenterX - arrowHalfWidth, arrowCenterY - arrowHalfHeight },
            { arrowCenterX + arrowHalfWidth, arrowCenterY - arrowHalfHeight },
            { arrowCenterX, arrowCenterY + arrowHalfHeight }
        };
        HBRUSH arrowBrush = CreateSolidBrush(foreground);
        HPEN arrowPen = CreatePen(PS_SOLID, 1, foreground);
        HGDIOBJ oldBrush = SelectObject(hdc, arrowBrush);
        HGDIOBJ oldPen = SelectObject(hdc, arrowPen);
        Polygon(hdc, arrow, 3);
        SelectObject(hdc, oldPen);
        SelectObject(hdc, oldBrush);

        wchar_t text[256] = {};
        GetWindowTextW(hwnd, text, static_cast<int>(std::size(text)));
        RECT textRect = rect;
        textRect.left += ScaleForDpi(8, dpi_);
        textRect.right = std::max(textRect.left, buttonRect.left - ScaleForDpi(5, dpi_));
        HFONT oldFont = runtime.font
            ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font))
            : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, foreground);
        DrawTextW(hdc, text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        if (oldFont) SelectObject(hdc, oldFont);

        DeleteObject(arrowPen);
        DeleteObject(arrowBrush);
        DeleteObject(buttonBrush);
        DeleteObject(borderBrush);
        DeleteObject(backgroundBrush);
    }

    void ApplyWindowAppearance() {
        if (!hwnd_) return;
        if (DwmSetWindowAttributeFunction setAttribute = ResolveDwmSetWindowAttribute()) {
            BOOL dark = (GetRValue(spec_.titleBarBackground) * 299 + GetGValue(spec_.titleBarBackground) * 587 + GetBValue(spec_.titleBarBackground) * 114) < 128000;
            const DWORD useImmersiveDarkMode = 20;
            const DWORD cornerPreference = 33;
            const DWORD captionColor = 35;
            const DWORD textColor = 36;
            setAttribute(hwnd_, useImmersiveDarkMode, &dark, sizeof(dark));
            setAttribute(hwnd_, captionColor, &spec_.titleBarBackground, sizeof(spec_.titleBarBackground));
            setAttribute(hwnd_, textColor, &spec_.titleBarForeground, sizeof(spec_.titleBarForeground));
            if (spec_.cornerPreference >= 0) {
                setAttribute(hwnd_, cornerPreference, &spec_.cornerPreference, sizeof(spec_.cornerPreference));
            }
        }
        if (TextEquals(spec_.iconStyle, L"none")) return;
        if (TextEquals(spec_.iconStyle, L"system")) {
            largeWindowIcon_ = LoadIconW(nullptr, IDI_APPLICATION);
            smallWindowIcon_ = largeWindowIcon_;
        } else if (TextEquals(spec_.iconStyle, L"custom") && spec_.iconPath && spec_.iconPath[0]) {
            largeWindowIcon_ = reinterpret_cast<HICON>(LoadImageW(nullptr, spec_.iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
            smallWindowIcon_ = reinterpret_cast<HICON>(LoadImageW(nullptr, spec_.iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
            ownsWindowIcons_ = true;
        } else {
            largeWindowIcon_ = CreateLingBuilderWindowIcon(GetSystemMetrics(SM_CXICON));
            smallWindowIcon_ = CreateLingBuilderWindowIcon(GetSystemMetrics(SM_CXSMICON));
            ownsWindowIcons_ = true;
        }
        if (largeWindowIcon_) SendMessageW(hwnd_, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(largeWindowIcon_));
        if (smallWindowIcon_) SendMessageW(hwnd_, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(smallWindowIcon_));
    }

    void DestroyWindowIcons() {
        if (ownsWindowIcons_) {
            if (largeWindowIcon_) DestroyIcon(largeWindowIcon_);
            if (smallWindowIcon_ && smallWindowIcon_ != largeWindowIcon_) DestroyIcon(smallWindowIcon_);
        }
        largeWindowIcon_ = nullptr;
        smallWindowIcon_ = nullptr;
        ownsWindowIcons_ = false;
    }

    void CreateImageLists() {
        for (int index = 0; index < g_imageListCount; ++index) {
            const ImageListSpec& spec = g_imageLists[index];
            HIMAGELIST list = ImageList_Create(ScaleForDpi(spec.width, dpi_), ScaleForDpi(spec.height, dpi_), ILC_COLOR32 | ILC_MASK, 4, 4);
            if (!list) continue;
            auto images = DecodeControlRecords(spec.images, 1);
            for (const auto& image : images) {
                HBITMAP bitmap = LoadWicBitmap(image[0].c_str(), ScaleForDpi(spec.width, dpi_), ScaleForDpi(spec.height, dpi_), L"fill");
                if (bitmap) { ImageList_Add(list, bitmap, nullptr); DeleteObject(bitmap); }
            }
            imageLists_[spec.id] = list;
        }
    }

    HIMAGELIST FindImageList(const wchar_t* id) const {
        if (!id || !id[0]) return nullptr;
        auto found = imageLists_.find(id);
        return found == imageLists_.end() ? nullptr : found->second;
    }

    void ApplyTextBoxFrameRegion(HWND frameHwnd) {
        if (!frameHwnd) return;
        RECT rect = {}; GetClientRect(frameHwnd, &rect);
        int width = std::max(1, static_cast<int>(rect.right - rect.left));
        int height = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int cornerDiameter = std::max(ScaleForDpi(8, dpi_), 4);
        HRGN region = CreateRoundRectRgn(0, 0, width, height, cornerDiameter, cornerDiameter);
        if (!region) return;
        if (SetWindowRgn(frameHwnd, region, TRUE) == 0) DeleteObject(region);
    }

    void LayoutTextBoxControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int inset = std::max(ScaleForDpi(2, dpi_), 2);
        int contentWidth = std::max(1, frameWidth - inset * 2);
        int contentHeight = std::max(1, frameHeight - inset * 2);
        int editY = inset;
        int editHeight = contentHeight;
        if (!(control.flags & CF_MULTILINE)) {
            int textHeight = std::max(ScaleForDpi(control.fontSize, dpi_), 8);
            HDC hdc = GetDC(runtime.hwnd);
            if (hdc) {
                HGDIOBJ oldFont = runtime.font ? SelectObject(hdc, runtime.font) : nullptr;
                TEXTMETRICW metrics = {};
                if (GetTextMetricsW(hdc, &metrics)) textHeight = metrics.tmHeight + metrics.tmExternalLeading;
                if (oldFont) SelectObject(hdc, oldFont);
                ReleaseDC(runtime.hwnd, hdc);
            }
            editHeight = std::min(contentHeight, std::max(textHeight + ScaleForDpi(4, dpi_), ScaleForDpi(18, dpi_)));
            if (TextEquals(control.data2, L"bottom")) editY = std::max(inset, frameHeight - inset - editHeight);
            else if (!TextEquals(control.data2, L"top")) editY = std::max(inset, (frameHeight - editHeight) / 2);
        }
        SetWindowPos(runtime.hwnd, nullptr, inset, editY, contentWidth, editHeight,
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    static LRESULT CALLBACK TextBoxFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int cornerDiameter = std::max(ScaleForDpi(8, self->dpi_), 4);
                COLORREF borderColor = GetFocus() == runtime->hwnd
                    ? RGB(14, 165, 233)
                    : IsWindowEnabled(runtime->hwnd) ? RGB(51, 65, 85) : RGB(63, 63, 70);
                HBRUSH borderBrush = CreateSolidBrush(borderColor);
                HRGN outerRegion = CreateRoundRectRgn(
                    rect.left, rect.top, rect.right, rect.bottom,
                    cornerDiameter, cornerDiameter
                );
                if (borderBrush && outerRegion) FillRgn(hdc, outerRegion, borderBrush);
                int borderWidth = 1;
                if (rect.right - rect.left > borderWidth * 2 && rect.bottom - rect.top > borderWidth * 2) {
                    HRGN innerRegion = CreateRoundRectRgn(
                        rect.left + borderWidth, rect.top + borderWidth,
                        rect.right - borderWidth, rect.bottom - borderWidth,
                        std::max(2, cornerDiameter - borderWidth * 2),
                        std::max(2, cornerDiameter - borderWidth * 2)
                    );
                    if (innerRegion) {
                        if (runtime->brush) FillRgn(hdc, innerRegion, runtime->brush);
                        DeleteObject(innerRegion);
                    }
                }
                if (outerRegion) DeleteObject(outerRegion);
                if (borderBrush) DeleteObject(borderBrush);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->ApplyTextBoxFrameRegion(hwnd);
            self->LayoutTextBoxControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_LBUTTONDOWN) {
            if (IsWindowEnabled(runtime->hwnd)) SetFocus(runtime->hwnd);
            return 0;
        }
        if (message == WM_SETCURSOR) {
            SetCursor(LoadCursorW(nullptr, IDC_IBEAM));
            return TRUE;
        }
        if (message == WM_ENABLE) {
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, WM_COMMAND, wParam, lParam);
        } else if (message == WM_CTLCOLOREDIT || message == WM_CTLCOLORSTATIC) {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdc, control->foreground);
            SetBkColor(hdc, control->background);
            return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, TextBoxFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    int GetListBoxPageSize(const ControlSpec& control, const RuntimeControl& runtime) const {
        if (!runtime.frameHwnd) return 1;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int contentHeight = std::max(1, frameHeight - contentInset * 2);
        int itemHeight = std::max(1, ScaleForDpi(control.listItemHeight, dpi_));
        int itemSpacing = std::max(0, ScaleForDpi(control.listItemSpacing, dpi_));
        return std::max(1, contentHeight / std::max(1, itemHeight + itemSpacing));
    }

    bool ShouldShowListBoxScrollBar(const ControlSpec& control, const RuntimeControl& runtime) const {
        if (!runtime.hwnd || control.listScrollBarVisibility == 2) return false;
        if (control.listScrollBarVisibility == 1) return true;
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        return itemCount > GetListBoxPageSize(control, runtime);
    }

    bool GetListBoxScrollBarRects(const ControlSpec& control, const RuntimeControl& runtime, RECT& track, RECT& thumb) const {
        if (!runtime.frameHwnd || !runtime.hwnd || !ShouldShowListBoxScrollBar(control, runtime)) return false;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int scrollBarWidth = std::clamp(ScaleForDpi(control.listScrollBarWidth, dpi_), 1, std::max(1, frameWidth - contentInset * 2));
        track = { std::max(contentInset, frameWidth - contentInset - scrollBarWidth), contentInset,
            std::max(contentInset + 1, frameWidth - contentInset), std::max(contentInset + 1, frameHeight - contentInset) };
        int trackHeight = std::max(1, static_cast<int>(track.bottom - track.top));
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int pageSize = GetListBoxPageSize(control, runtime);
        int minimumThumb = std::min(trackHeight, std::max(ScaleForDpi(18, dpi_), scrollBarWidth * 2));
        int thumbHeight = itemCount <= pageSize || itemCount == 0
            ? trackHeight
            : std::max(minimumThumb, trackHeight * pageSize / itemCount);
        thumbHeight = std::min(trackHeight, thumbHeight);
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int topIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        int travel = std::max(0, trackHeight - thumbHeight);
        int thumbTop = track.top + (maximumTopIndex > 0 ? topIndex * travel / maximumTopIndex : 0);
        thumb = { track.left, thumbTop, track.right, thumbTop + thumbHeight };
        return true;
    }

    void SetListBoxScrollFromThumb(const ControlSpec& control, RuntimeControl& runtime, const RECT& track, const RECT& thumb, int desiredThumbTop) {
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int pageSize = GetListBoxPageSize(control, runtime);
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int travel = std::max(0, static_cast<int>((track.bottom - track.top) - (thumb.bottom - thumb.top)));
        int clampedTop = std::clamp(desiredThumbTop, static_cast<int>(track.top), static_cast<int>(track.top) + travel);
        int topIndex = travel > 0 ? (clampedTop - track.top) * maximumTopIndex / travel : 0;
        int currentTopIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        if (topIndex == currentTopIndex) return;
        SendMessageW(runtime.hwnd, LB_SETTOPINDEX, topIndex, 0);
        InvalidateRect(runtime.frameHwnd, nullptr, FALSE);
    }

    void ScrollListBoxByWheel(const ControlSpec& control, RuntimeControl& runtime, WPARAM wParam) {
        if (!runtime.hwnd) return;
        int& remainder = listWheelDeltaRemainders_[control.id];
        remainder += GET_WHEEL_DELTA_WPARAM(wParam);
        int detents = remainder / WHEEL_DELTA;
        remainder %= WHEEL_DELTA;
        if (detents == 0) return;

        UINT configuredLines = 3;
        SystemParametersInfoW(SPI_GETWHEELSCROLLLINES, 0, &configuredLines, 0);
        if (configuredLines == 0) return;
        int pageSize = GetListBoxPageSize(control, runtime);
        int itemsPerDetent = configuredLines == WHEEL_PAGESCROLL
            ? pageSize
            : std::max(1, static_cast<int>(configuredLines));
        int itemCount = std::max(0, static_cast<int>(SendMessageW(runtime.hwnd, LB_GETCOUNT, 0, 0)));
        int maximumTopIndex = std::max(0, itemCount - pageSize);
        int currentTopIndex = std::clamp(static_cast<int>(SendMessageW(runtime.hwnd, LB_GETTOPINDEX, 0, 0)), 0, maximumTopIndex);
        int nextTopIndex = std::clamp(currentTopIndex - detents * itemsPerDetent, 0, maximumTopIndex);
        if (nextTopIndex == currentTopIndex) return;
        SendMessageW(runtime.hwnd, LB_SETTOPINDEX, nextTopIndex, 0);
        if (runtime.frameHwnd) InvalidateRect(runtime.frameHwnd, nullptr, FALSE);
    }

    void PaintListBoxScrollBar(HDC hdc, const ControlSpec& control, const RuntimeControl& runtime) {
        RECT track = {}, thumb = {};
        if (!GetListBoxScrollBarRects(control, runtime, track, thumb)) return;
        int radius = std::max(1, static_cast<int>(track.right - track.left) / 2);
        COLORREF trackColor = control.enabled ? control.listScrollBarTrack : BlendColor(control.listScrollBarTrack, control.background, 55);
        COLORREF thumbColor = control.enabled ? control.listScrollBarThumb : BlendColor(control.listScrollBarThumb, control.background, 55);
        DrawAntiAliasedRoundedRectangle(hdc, track, radius, trackColor, trackColor, true);
        DrawAntiAliasedRoundedRectangle(hdc, thumb, radius, thumbColor, thumbColor, true);
    }

    void LayoutListBoxControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentPadding = std::clamp(ScaleForDpi(control.listContentPadding, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int contentInset = std::clamp(borderWidth + contentPadding, 0, std::min(frameWidth, frameHeight) / 2);
        int scrollBarSpace = ShouldShowListBoxScrollBar(control, runtime)
            ? std::clamp(ScaleForDpi(control.listScrollBarWidth + 2, dpi_), 1, std::max(1, frameWidth - contentInset * 2))
            : 0;
        SetWindowPos(runtime.hwnd, nullptr, contentInset, contentInset,
            std::max(1, frameWidth - contentInset * 2 - scrollBarSpace), std::max(1, frameHeight - contentInset * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    void LayoutListViewControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        SetWindowPos(runtime.hwnd, nullptr, borderWidth, borderWidth,
            std::max(1, frameWidth - borderWidth * 2), std::max(1, frameHeight - borderWidth * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);
    }

    static LRESULT CALLBACK ListViewFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->listBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->listBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                if (borderWidth == 0 && runtime->brush) FillRect(hdc, &rect, runtime->brush);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutListViewControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_NOTIFY || message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, ListViewFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    void LayoutTreeViewControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT rect = {}; GetClientRect(runtime.frameHwnd, &rect);
        int frameWidth = std::max(1, static_cast<int>(rect.right - rect.left));
        int frameHeight = std::max(1, static_cast<int>(rect.bottom - rect.top));
        int borderWidth = std::clamp(ScaleForDpi(control.treeBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        int horizontalPadding = std::clamp(ScaleForDpi(control.treeNodePadding, dpi_), 0, std::max(0, frameWidth / 4));
        int horizontalInset = std::clamp(borderWidth + horizontalPadding, 0, frameWidth / 2);
        SetWindowPos(runtime.hwnd, nullptr, horizontalInset, borderWidth,
            std::max(1, frameWidth - horizontalInset * 2), std::max(1, frameHeight - borderWidth * 2),
            SWP_NOZORDER | SWP_NOACTIVATE);

        int textHeight = std::max(ScaleForDpi(control.fontSize, dpi_), 8);
        HDC hdc = GetDC(runtime.hwnd);
        if (hdc) {
            HFONT previous = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
            TEXTMETRICW metrics = {};
            if (GetTextMetricsW(hdc, &metrics)) textHeight = std::max(textHeight, static_cast<int>(metrics.tmHeight));
            if (previous) SelectObject(hdc, previous);
            ReleaseDC(runtime.hwnd, hdc);
        }
        int verticalPadding = ScaleForDpi(control.treeNodePadding, dpi_);
        int nodeSpacing = ScaleForDpi(control.treeNodeSpacing, dpi_);
        int itemHeight = std::max(1, textHeight + verticalPadding * 2 + nodeSpacing);
        SendMessageW(runtime.hwnd, TVM_SETITEMHEIGHT, static_cast<WPARAM>(itemHeight), 0);
        SendMessageW(runtime.hwnd, TVM_SETINDENT, static_cast<WPARAM>(std::max(ScaleForDpi(19, dpi_), ScaleForDpi(16 + control.treeNodePadding * 2, dpi_))), 0);
    }

    static LRESULT CALLBACK TreeViewFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->treeBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->treeBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                RECT contentRect = rect;
                InflateRect(&contentRect, -borderWidth, -borderWidth);
                if (runtime->brush && contentRect.right > contentRect.left && contentRect.bottom > contentRect.top) {
                    FillRect(hdc, &contentRect, runtime->brush);
                }
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutTreeViewControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_NOTIFY || message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, TreeViewFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    static LRESULT CALLBACK ListViewHeaderHeightSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        if (message == HDM_LAYOUT && control && lParam) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            HDLAYOUT* layout = reinterpret_cast<HDLAYOUT*>(lParam);
            int height = ScaleForDpi(control->listHeaderHeight, self->dpi_);
            if (layout->pwpos) layout->pwpos->cy = height;
            if (layout->prc) layout->prc->top = height;
            return result;
        }
        if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, ListViewHeaderHeightSubclassProc, subclassId);
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    HIMAGELIST CreateListViewSizingImageList(const ControlSpec& control, HIMAGELIST source) {
        int width = 1;
        int sourceHeight = 1;
        if (source) ImageList_GetIconSize(source, &width, &sourceHeight);
        int height = ScaleForDpi(control.listItemHeight, dpi_);
        int count = source ? ImageList_GetImageCount(source) : 0;
        HIMAGELIST sizing = ImageList_Create(std::max(1, width), std::max(1, height), ILC_COLOR32 | ILC_MASK, std::max(1, count), 1);
        if (!sizing) return source;
        for (int index = 0; index < count; ++index) {
            HICON icon = ImageList_GetIcon(source, index, ILD_TRANSPARENT);
            if (icon) {
                ImageList_AddIcon(sizing, icon);
                DestroyIcon(icon);
            }
        }
        listViewSizingImageLists_[control.id] = sizing;
        return sizing;
    }

    static LRESULT CALLBACK ListBoxFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {}; GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->listBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->listBorderColor);
                FillRect(hdc, &rect, borderBrush);
                DeleteObject(borderBrush);
                if (borderWidth == 0) {
                    if (runtime->brush) FillRect(hdc, &rect, runtime->brush);
                } else {
                    RECT contentRect = rect;
                    InflateRect(&contentRect, -borderWidth, -borderWidth);
                    if (contentRect.right > contentRect.left && contentRect.bottom > contentRect.top && runtime->brush) {
                        FillRect(hdc, &contentRect, runtime->brush);
                    }
                }
                self->PaintListBoxScrollBar(hdc, *control, *runtime);
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutListBoxControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_MOUSEWHEEL) {
            self->ScrollListBoxByWheel(*control, *runtime, wParam);
            return 0;
        }
        if (message == WM_LBUTTONDOWN) {
            RECT track = {}, thumb = {};
            POINT point = { static_cast<short>(LOWORD(lParam)), static_cast<short>(HIWORD(lParam)) };
            if (self->GetListBoxScrollBarRects(*control, *runtime, track, thumb) && PtInRect(&track, point)) {
                SetFocus(runtime->hwnd);
                if (PtInRect(&thumb, point)) {
                    self->listScrollDragControlId_ = control->id;
                    self->listScrollDragOffset_ = point.y - thumb.top;
                    SetCapture(hwnd);
                } else {
                    int pageSize = self->GetListBoxPageSize(*control, *runtime);
                    int topIndex = static_cast<int>(SendMessageW(runtime->hwnd, LB_GETTOPINDEX, 0, 0));
                    SendMessageW(runtime->hwnd, LB_SETTOPINDEX, std::max(0, topIndex + (point.y < thumb.top ? -pageSize : pageSize)), 0);
                    InvalidateRect(hwnd, nullptr, FALSE);
                }
                return 0;
            }
        }
        if (message == WM_MOUSEMOVE && self->listScrollDragControlId_ == control->id && GetCapture() == hwnd) {
            RECT track = {}, thumb = {};
            if (self->GetListBoxScrollBarRects(*control, *runtime, track, thumb)) {
                int pointerY = static_cast<short>(HIWORD(lParam));
                self->SetListBoxScrollFromThumb(*control, *runtime, track, thumb, pointerY - self->listScrollDragOffset_);
            }
            return 0;
        }
        if ((message == WM_LBUTTONUP || message == WM_CAPTURECHANGED || message == WM_CANCELMODE)
            && self->listScrollDragControlId_ == control->id) {
            self->listScrollDragControlId_ = 0;
            self->listScrollDragOffset_ = 0;
            if (message == WM_LBUTTONUP && GetCapture() == hwnd) ReleaseCapture();
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_COMMAND || message == WM_DRAWITEM || message == WM_MEASUREITEM) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_CTLCOLORLISTBOX) {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdc, control->foreground);
            SetBkColor(hdc, control->background);
            return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, ListBoxFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    void PaintIPAddressChrome(HWND hwnd, HDC hdc, const ControlSpec& control, const RuntimeControl& runtime) {
        if (!hdc) return;
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        RECT fields[8] = {};
        int fieldCount = 0;
        for (HWND child = GetWindow(hwnd, GW_CHILD); child && fieldCount < 8; child = GetWindow(child, GW_HWNDNEXT)) {
            wchar_t className[32] = {};
            GetClassNameW(child, className, static_cast<int>(std::size(className)));
            if (_wcsicmp(className, L"Edit") != 0 || !IsWindowVisible(child)) continue;
            RECT fieldRect = {};
            GetWindowRect(child, &fieldRect);
            MapWindowPoints(nullptr, hwnd, reinterpret_cast<POINT*>(&fieldRect), 2);
            RECT clippedRect = {};
            if (IntersectRect(&clippedRect, &fieldRect, &clientRect)) fields[fieldCount++] = clippedRect;
        }
        std::sort(fields, fields + fieldCount, [](const RECT& left, const RECT& right) {
            return left.left < right.left;
        });

        HRGN backgroundRegion = CreateRectRgnIndirect(&clientRect);
        if (backgroundRegion) {
            for (int index = 0; index < fieldCount; ++index) {
                HRGN fieldRegion = CreateRectRgnIndirect(&fields[index]);
                if (fieldRegion) {
                    CombineRgn(backgroundRegion, backgroundRegion, fieldRegion, RGN_DIFF);
                    DeleteObject(fieldRegion);
                }
            }
            FillRgn(hdc, backgroundRegion, runtime.brush ? runtime.brush : windowBrush_);
            DeleteObject(backgroundRegion);
        }

        int savedDc = SaveDC(hdc);
        HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, control.foreground);
        for (int index = 0; index + 1 < fieldCount; ++index) {
            RECT separatorRect = {
                fields[index].right,
                fields[index].top,
                fields[index + 1].left,
                fields[index].bottom
            };
            if (separatorRect.right > separatorRect.left) {
                DrawTextW(hdc, L".", 1, &separatorRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
            }
        }
        if (oldFont) SelectObject(hdc, oldFont);
        if (savedDc) RestoreDC(hdc, savedDc);

    }

    void LayoutIPAddressFields(HWND hwnd, const ControlSpec& control, const RuntimeControl& runtime) {
        RECT clientRect = {};
        GetClientRect(hwnd, &clientRect);
        int clientWidth = static_cast<int>(clientRect.right - clientRect.left);
        int clientHeight = static_cast<int>(clientRect.bottom - clientRect.top);
        int contentInset = runtime.frameHwnd
            ? 0
            : std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(clientWidth, clientHeight) / 2);
        int availableHeight = std::max(1, clientHeight - contentInset * 2);
        int textHeight = ScaleForDpi(std::max(1, control.fontSize), dpi_);
        HDC hdc = GetDC(hwnd);
        if (hdc) {
            HFONT oldFont = runtime.font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime.font)) : nullptr;
            TEXTMETRICW metrics = {};
            if (GetTextMetricsW(hdc, &metrics)) textHeight = static_cast<int>(metrics.tmHeight);
            if (oldFont) SelectObject(hdc, oldFont);
            ReleaseDC(hwnd, hdc);
        }
        int fieldHeight = std::min(availableHeight, std::max(1, textHeight + ScaleForDpi(2, dpi_)));
        int fieldY = contentInset;
        if (TextEquals(control.option1, L"bottom")) fieldY = clientHeight - contentInset - fieldHeight;
        else if (!TextEquals(control.option1, L"top")) fieldY = contentInset + (availableHeight - fieldHeight) / 2;

        for (HWND child = GetWindow(hwnd, GW_CHILD); child; child = GetWindow(child, GW_HWNDNEXT)) {
            wchar_t className[32] = {};
            GetClassNameW(child, className, static_cast<int>(std::size(className)));
            if (_wcsicmp(className, L"Edit") != 0) continue;
            RECT fieldRect = {};
            GetWindowRect(child, &fieldRect);
            MapWindowPoints(nullptr, hwnd, reinterpret_cast<POINT*>(&fieldRect), 2);
            int fieldLeft = std::max(contentInset, static_cast<int>(fieldRect.left));
            int fieldRight = std::min(clientWidth - contentInset, static_cast<int>(fieldRect.right));
            SetWindowPos(child, nullptr, fieldLeft, fieldY, std::max(1, fieldRight - fieldLeft), fieldHeight,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOCOPYBITS);
        }
        RedrawWindow(hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN);
    }

    void LayoutIPAddressControl(const ControlSpec& control, RuntimeControl& runtime) {
        if (!runtime.frameHwnd || !runtime.hwnd) return;
        RECT frameRect = {};
        GetClientRect(runtime.frameHwnd, &frameRect);
        int frameWidth = static_cast<int>(frameRect.right - frameRect.left);
        int frameHeight = static_cast<int>(frameRect.bottom - frameRect.top);
        int borderWidth = std::clamp(ScaleForDpi(control.listBorderWidth, dpi_), 0, std::min(frameWidth, frameHeight) / 2);
        SetWindowPos(runtime.hwnd, nullptr, borderWidth, borderWidth,
            std::max(1, frameWidth - borderWidth * 2), std::max(1, frameHeight - borderWidth * 2),
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOCOPYBITS);
        LayoutIPAddressFields(runtime.hwnd, control, runtime);
    }

    static LRESULT CALLBACK IPAddressFrameSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (!control || !runtime) return DefSubclassProc(hwnd, message, wParam, lParam);
        if (message == WM_ERASEBKGND) return 1;
        if (message == WM_PAINT) {
            PAINTSTRUCT paint = {};
            HDC hdc = BeginPaint(hwnd, &paint);
            if (hdc) {
                RECT rect = {};
                GetClientRect(hwnd, &rect);
                int borderWidth = std::clamp(ScaleForDpi(control->listBorderWidth, self->dpi_), 0,
                    std::min(static_cast<int>(rect.right - rect.left), static_cast<int>(rect.bottom - rect.top)) / 2);
                HBRUSH borderBrush = CreateSolidBrush(control->listBorderColor);
                FillRect(hdc, &rect, borderWidth > 0 ? borderBrush : (runtime->brush ? runtime->brush : self->windowBrush_));
                DeleteObject(borderBrush);
                if (borderWidth > 0) {
                    RECT contentRect = rect;
                    InflateRect(&contentRect, -borderWidth, -borderWidth);
                    if (contentRect.right > contentRect.left && contentRect.bottom > contentRect.top) {
                        FillRect(hdc, &contentRect, runtime->brush ? runtime->brush : self->windowBrush_);
                    }
                }
                EndPaint(hwnd, &paint);
            }
            return 0;
        }
        if (message == WM_SIZE) {
            self->LayoutIPAddressControl(*control, *runtime);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        if (message == WM_LBUTTONDOWN) {
            if (IsWindowEnabled(hwnd)) SetFocus(runtime->hwnd);
            return 0;
        }
        if (message == WM_SETCURSOR) {
            SetCursor(LoadCursorW(nullptr, IDC_IBEAM));
            return TRUE;
        }
        if (message == WM_NOTIFY || message == WM_COMMAND) {
            return SendMessageW(self->hwnd_, message, wParam, lParam);
        }
        if (message == WM_ENABLE) {
            EnableWindow(runtime->hwnd, IsWindowEnabled(hwnd));
            InvalidateRect(hwnd, nullptr, FALSE);
        } else if (message == WM_NCDESTROY) {
            RemoveWindowSubclass(hwnd, IPAddressFrameSubclassProc, subclassId);
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    static LRESULT CALLBACK ControlSubclassProc(
        HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
        UINT_PTR subclassId, DWORD_PTR referenceData
    ) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(referenceData);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        const ControlSpec* control = self->FindControl(static_cast<int>(subclassId));
        RuntimeControl* runtime = self->FindRuntimeControl(static_cast<int>(subclassId));
        if (control && runtime) {
            if (message == WM_CONTEXTMENU && self->HandleContextMenu(hwnd, lParam)) return 0;
            if (IsType(*control, L"HotKey")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    self->PaintHotKeyControl(hwnd, nullptr, *control, *runtime);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintHotKeyControl(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
                if (message == HKM_SETHOTKEY || message == WM_KEYDOWN || message == WM_KEYUP
                    || message == WM_SYSKEYDOWN || message == WM_SYSKEYUP || message == WM_SETFOCUS
                    || message == WM_KILLFOCUS || message == WM_ENABLE || message == WM_SETFONT) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    if (message == WM_SETFOCUS) self->DispatchLingEvent(*control, L"GotFocus");
                    else if (message == WM_KILLFOCUS) self->DispatchLingEvent(*control, L"LostFocus");
                    return result;
                }
            }
            if (IsType(*control, L"IPAddress")
                && (message == WM_CTLCOLOREDIT || message == WM_CTLCOLORSTATIC)) {
                HDC hdc = reinterpret_cast<HDC>(wParam);
                SetTextColor(hdc, control->foreground);
                SetBkColor(hdc, control->background);
                SetBkMode(hdc, OPAQUE);
                return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
            }
            if (IsType(*control, L"FlatScrollBar") && (message == WM_HSCROLL || message == WM_VSCROLL)) {
                int bar = (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT;
                int position = FlatSB_GetScrollPos(hwnd, bar);
                switch (LOWORD(wParam)) {
                case SB_LINELEFT: position -= 1; break;
                case SB_LINERIGHT: position += 1; break;
                case SB_PAGELEFT: position -= 10; break;
                case SB_PAGERIGHT: position += 10; break;
                case SB_THUMBPOSITION:
                case SB_THUMBTRACK: position = HIWORD(wParam); break;
                }
                position = std::max(control->minimum, std::min(control->maximum, position));
                FlatSB_SetScrollPos(hwnd, bar, position, TRUE);
                self->DispatchLingEvent(*control, L"ValueChanged");
                return 0;
            }
            if (self->IsUploadControl(*control)) {
                if (message == WM_COMMAND && HIWORD(wParam) == BN_CLICKED) {
                    if (LOWORD(wParam) == 1) self->OpenUploadFileDialog(*control, *runtime);
                    else if (LOWORD(wParam) == 3) self->DispatchLingEvent(*control, L"UploadAction");
                    return 0;
                }
                if (message == WM_CTLCOLORSTATIC || message == WM_CTLCOLORLISTBOX) {
                    HDC hdc = reinterpret_cast<HDC>(wParam);
                    SetTextColor(hdc, control->foreground); SetBkColor(hdc, control->background);
                    return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
                }
                if (message == WM_NCDESTROY) RemoveWindowSubclass(hwnd, ControlSubclassProc, subclassId);
            }
            if (IsType(*control, L"GroupBox") && (
                message == WM_COMMAND
                || message == WM_NOTIFY
                || message == WM_DRAWITEM
                || message == WM_MEASUREITEM
                || message == WM_COMPAREITEM
                || message == WM_DELETEITEM
                || message == WM_HSCROLL
                || message == WM_VSCROLL
                || message == WM_CTLCOLORBTN
                || message == WM_CTLCOLORSTATIC
                || message == WM_CTLCOLOREDIT
                || message == WM_CTLCOLORLISTBOX
                || message == WM_CTLCOLORSCROLLBAR
            )) {
                return SendMessageW(self->hwnd_, message, wParam, lParam);
            }
            if (message == WM_DRAWITEM) {
                DRAWITEMSTRUCT* item = reinterpret_cast<DRAWITEMSTRUCT*>(lParam);
                const ControlSpec* drawnControl = item ? self->FindControl(static_cast<int>(item->CtlID)) : nullptr;
                if (drawnControl && IsType(*drawnControl, L"StatusBar")) {
                    return SendMessageW(self->hwnd_, message, wParam, lParam);
                }
            }
            if (message == WM_NOTIFY && IsType(*control, L"ListView")) {
                NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
                if (header && header->code == NM_CUSTOMDRAW && header->hwndFrom == ListView_GetHeader(hwnd)) {
                    return self->PaintListViewHeader(*control, reinterpret_cast<NMCUSTOMDRAW*>(lParam));
                }
            }
            if (IsType(*control, L"ComboBoxEx") && message == WM_DRAWITEM) {
                return self->PaintOwnerComboBoxEx(*control, *runtime, reinterpret_cast<DRAWITEMSTRUCT*>(lParam)) ? TRUE : FALSE;
            }
            if (IsType(*control, L"ComboBoxEx") && (
                message == WM_CTLCOLORLISTBOX || message == WM_CTLCOLOREDIT || message == WM_CTLCOLORSTATIC
            )) {
                HDC hdc = reinterpret_cast<HDC>(wParam);
                SetTextColor(hdc, control->foreground);
                SetBkColor(hdc, control->background);
                SetBkMode(hdc, OPAQUE);
                return reinterpret_cast<LRESULT>(runtime->brush ? runtime->brush : self->windowBrush_);
            }
            if (message == WM_CTLCOLORLISTBOX) {
                return SendMessageW(self->hwnd_, message, wParam, lParam);
            }
            if (IsType(*control, L"ListBox") && message == WM_MOUSEWHEEL) {
                self->ScrollListBoxByWheel(*control, *runtime, wParam);
                return 0;
            }
            if (IsType(*control, L"ListBox") && (
                message == WM_KEYDOWN
                || message == WM_VSCROLL
                || message == WM_LBUTTONUP
                || message == LB_ADDSTRING
                || message == LB_INSERTSTRING
                || message == LB_DELETESTRING
                || message == LB_RESETCONTENT
                || message == LB_SETTOPINDEX
                || message == LB_SETITEMHEIGHT
                || message == LB_SETCURSEL
                || message == LB_SETSEL
            )) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (runtime->frameHwnd) {
                    if (message == LB_ADDSTRING || message == LB_INSERTSTRING || message == LB_DELETESTRING
                        || message == LB_RESETCONTENT || message == LB_SETITEMHEIGHT) {
                        self->LayoutListBoxControl(*control, *runtime);
                    }
                    InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                }
                return result;
            }
            if (IsType(*control, L"DateTimePicker")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintDateTimePicker(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintDateTimePicker(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
                if (message == WM_MOUSEMOVE && !runtime->mouseInside) {
                    runtime->mouseInside = true;
                    TRACKMOUSEEVENT tracking = { sizeof(TRACKMOUSEEVENT), TME_LEAVE, hwnd, 0 };
                    TrackMouseEvent(&tracking);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    self->DispatchLingEvent(*control, L"MouseEnter");
                } else if (message == WM_MOUSELEAVE) {
                    runtime->mouseInside = false;
                    InvalidateRect(hwnd, nullptr, FALSE);
                }
                if (message == DTM_SETSYSTEMTIME || message == DTM_SETFORMATW
                    || message == WM_SETFONT || message == WM_ENABLE
                    || message == WM_SETFOCUS || message == WM_KILLFOCUS
                    || message == WM_LBUTTONDOWN || message == WM_LBUTTONUP
                    || message == WM_KEYDOWN || message == WM_KEYUP) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    if (message == WM_LBUTTONDOWN) self->DispatchLingEvent(*control, L"MouseDown");
                    else if (message == WM_SETFOCUS) self->DispatchLingEvent(*control, L"GotFocus");
                    else if (message == WM_KILLFOCUS) self->DispatchLingEvent(*control, L"LostFocus");
                    return result;
                }
            }
            bool buttonControl = self->IsButtonControl(*control);
            bool ownerDraw = self->IsOwnerDrawControl(*control);
            bool ownerDrawSelection = IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton");
            if (ownerDrawSelection && message == BM_GETCHECK) {
                return static_cast<LRESULT>(runtime->checkState);
            }
            if (ownerDrawSelection && message == BM_SETCHECK) {
                int nextState = wParam == BST_CHECKED
                    ? BST_CHECKED
                    : wParam == BST_INDETERMINATE ? BST_INDETERMINATE : BST_UNCHECKED;
                if (runtime->checkState != nextState) {
                    runtime->checkState = nextState;
                    InvalidateRect(hwnd, nullptr, FALSE);
                    NotifyWinEvent(EVENT_OBJECT_STATECHANGE, hwnd, OBJID_CLIENT, CHILDID_SELF);
                }
                return 0;
            }
            if (message == WM_PAINT && IsType(*control, L"ProgressBar") && !(control->flags & CF_MARQUEE)) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                HDC hdc = GetDC(hwnd);
                if (hdc) {
                    RECT rect = {}; GetClientRect(hwnd, &rect);
                    int minimum = control->minimum;
                    int maximum = std::max(minimum + 1, control->maximum);
                    int current = static_cast<int>(SendMessageW(hwnd, PBM_GETPOS, 0, 0));
                    int percent = std::clamp((current - minimum) * 100 / (maximum - minimum), 0, 100);
                    wchar_t label[16] = {}; swprintf_s(label, L"%d%%", percent);
                    HFONT oldFont = runtime->font ? reinterpret_cast<HFONT>(SelectObject(hdc, runtime->font)) : nullptr;
                    SetBkMode(hdc, TRANSPARENT);
                    RECT shadowRect = rect; OffsetRect(&shadowRect, 1, 1);
                    SetTextColor(hdc, RGB(24, 24, 28));
                    DrawTextW(hdc, label, -1, &shadowRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
                    SetTextColor(hdc, RGB(255, 255, 255));
                    DrawTextW(hdc, label, -1, &rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
                    if (oldFont) SelectObject(hdc, oldFont);
                    ReleaseDC(hwnd, hdc);
                }
                return result;
            }
            if (IsType(*control, L"IPAddress") && message == WM_PAINT) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                HDC hdc = GetDC(hwnd);
                if (hdc) {
                    self->PaintIPAddressChrome(hwnd, hdc, *control, *runtime);
                    ReleaseDC(hwnd, hdc);
                }
                return result;
            }
            if (IsType(*control, L"IPAddress") && message == WM_PRINTCLIENT) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                self->PaintIPAddressChrome(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                return result;
            }
            if (IsType(*control, L"IPAddress") && (message == WM_SIZE || message == WM_SETFONT)) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                self->LayoutIPAddressFields(hwnd, *control, *runtime);
                return result;
            }
            if (IsType(*control, L"GroupBox")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintGroupBox(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintGroupBox(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
            }
            if (IsType(*control, L"SysLink") && control->backgroundTransparent) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintTransparentSysLink(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintTransparentSysLink(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
            }
            if (IsType(*control, L"TabControl")) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintTabControl(hwnd, hdc, *control, *runtime);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintTabControl(hwnd, reinterpret_cast<HDC>(wParam), *control, *runtime);
                    return 0;
                }
                if (message == WM_MOUSEMOVE || message == WM_MOUSELEAVE) InvalidateRect(hwnd, nullptr, FALSE);
                if (message == WM_LBUTTONDOWN || message == WM_LBUTTONUP
                    || message == WM_KEYDOWN || message == WM_KEYUP
                    || message == WM_SETFOCUS || message == WM_KILLFOCUS) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    if (message == WM_LBUTTONDOWN) self->DispatchLingEvent(*control, L"MouseDown");
                    else if (message == WM_SETFOCUS) self->DispatchLingEvent(*control, L"GotFocus");
                    else if (message == WM_KILLFOCUS) self->DispatchLingEvent(*control, L"LostFocus");
                    return result;
                }
            }
            if (IsType(*control, L"ComboBox") && !(control->flags & CF_EDITABLE)) {
                if (message == WM_ERASEBKGND) return 1;
                if (message == WM_NCPAINT) return 0;
                if (message == WM_PAINT) {
                    PAINTSTRUCT paint = {};
                    HDC hdc = BeginPaint(hwnd, &paint);
                    self->PaintCollapsedComboBox(hwnd, hdc, *control);
                    EndPaint(hwnd, &paint);
                    return 0;
                }
                if (message == WM_PRINTCLIENT) {
                    self->PaintCollapsedComboBox(hwnd, reinterpret_cast<HDC>(wParam), *control);
                    return 0;
                }
            }
            if (message == WM_MOUSEMOVE && !runtime->mouseInside) {
                runtime->mouseInside = true;
                TRACKMOUSEEVENT tracking = { sizeof(TRACKMOUSEEVENT), TME_LEAVE, hwnd, 0 };
                TrackMouseEvent(&tracking);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"MouseEnter");
            } else if (message == WM_MOUSELEAVE) {
                runtime->mouseInside = false;
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"MouseLeave");
            } else if (message == WM_LBUTTONDOWN) {
                if (buttonControl) {
                    LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                    if (!IsWindow(hwnd)) return result;
                    RuntimeControl* liveRuntime = self->FindRuntimeControl(static_cast<int>(subclassId));
                    if (!liveRuntime || liveRuntime->hwnd != hwnd) return result;
                    if (ownerDraw) {
                        InvalidateRect(hwnd, nullptr, FALSE);
                        UpdateWindow(hwnd);
                    }
                    if (!IsWindow(hwnd)) return result;
                    self->DispatchLingEvent(*control, L"MouseDown");
                    return result;
                }
                self->DispatchLingEvent(*control, L"MouseDown");
            } else if (message == WM_SETFOCUS) {
                if (runtime->frameHwnd) InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"GotFocus");
            } else if (message == WM_KILLFOCUS) {
                if (runtime->frameHwnd) InvalidateRect(runtime->frameHwnd, nullptr, FALSE);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                self->DispatchLingEvent(*control, L"LostFocus");
            } else if (message == WM_ENABLE) {
                runtime->mouseInside = false;
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                return result;
            } else if (
                message == WM_LBUTTONUP
                || message == WM_CAPTURECHANGED
                || message == WM_CANCELMODE
                || message == BM_SETSTATE
                || message == BM_SETCHECK
                || ((message == WM_KEYDOWN || message == WM_KEYUP) && wParam == VK_SPACE)
            ) {
                LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
                if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE);
                return result;
            } else if (message == WM_NCDESTROY) {
                RemoveWindowSubclass(hwnd, ControlSubclassProc, subclassId);
            }
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    bool CreateGeneratedControl(const ControlSpec& control) {
        DWORD style = WS_CHILD | WS_VISIBLE;
        if (control.flags & CF_HIDDEN) style &= ~WS_VISIBLE;
        DWORD exStyle = 0;
        const wchar_t* className = L"STATIC";
        const wchar_t* text = control.text;
        HWND parentHwnd = hwnd_;
        int parentContentOffsetX = 0;
        int parentContentOffsetY = 0;
        if (control.parentId > 0) {
            RuntimeControl* parent = FindRuntimeControl(control.parentId);
            if (!parent || !parent->hwnd) return false;
            parentHwnd = parent->hwnd;
            const ControlSpec* parentSpec = FindControl(control.parentId);
            if (parentSpec && IsType(*parentSpec, L"TabControl")) {
                RuntimeTabPage* page = FindTabPage(parentSpec->id, control.containerSlot);
                if (!page || !page->hwnd) return false;
                parentHwnd = page->hwnd;
                parentContentOffsetX = page->contentRect.left;
                parentContentOffsetY = page->contentRect.top;
            }
        }

        if (!control.enabled) style |= WS_DISABLED;
        if (IsType(control, L"Button") || IsType(control, L"ColorPicker")) {
            className = L"BUTTON";
            style |= WS_TABSTOP;
            if (IsType(control, L"ColorPicker")) style |= BS_OWNERDRAW;
            else if (!(control.flags & (CF_BUTTON_TOGGLE | CF_BUTTON_SPLIT | CF_BUTTON_COMMAND_LINK))) style |= BS_OWNERDRAW;
            else if (control.flags & CF_BUTTON_DEFAULT) style |= BS_DEFPUSHBUTTON;
            else if (control.flags & CF_BUTTON_TOGGLE) style |= BS_AUTOCHECKBOX | BS_PUSHLIKE;
            else if (control.flags & CF_BUTTON_SPLIT) style |= BS_SPLITBUTTON;
            else if (control.flags & CF_BUTTON_COMMAND_LINK) style |= BS_COMMANDLINK;
            else style |= BS_PUSHBUTTON;
        } else if (IsType(control, L"TextBox")) {
            className = L"EDIT";
            style |= WS_TABSTOP;
            if (control.flags & CF_MULTILINE) style |= ES_MULTILINE | ES_WANTRETURN;
            if (TextEquals(control.option2, L"horizontal") || TextEquals(control.option2, L"both")) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            if (TextEquals(control.option2, L"vertical") || TextEquals(control.option2, L"both")) style |= ES_AUTOVSCROLL | WS_VSCROLL;
            if (!(control.flags & CF_MULTILINE)) style |= ES_AUTOHSCROLL;
            if (control.flags & CF_PASSWORD) style |= ES_PASSWORD;
            if (control.flags & CF_READ_ONLY) style |= ES_READONLY;
            if (control.flags & CF_NUMERIC) style |= ES_NUMBER;
            if (control.flags & CF_ALIGN_CENTER) style |= ES_CENTER;
            if (control.flags & CF_ALIGN_RIGHT) style |= ES_RIGHT;
            exStyle = 0;
        } else if (IsType(control, L"Label")) {
            className = L"STATIC";
            style |= SS_NOTIFY;
            if (TextEquals(control.option1, L"bitmap")) style |= SS_BITMAP | SS_CENTERIMAGE;
            else if (TextEquals(control.option1, L"icon")) style |= SS_ICON | SS_CENTERIMAGE;
            else if (TextEquals(control.option1, L"frame")) style |= SS_BLACKFRAME;
            else if (control.flags & CF_ALIGN_CENTER) style |= SS_CENTER;
            else if (control.flags & CF_ALIGN_RIGHT) style |= SS_RIGHT;
            else style |= SS_LEFT;
        } else if (IsType(control, L"CheckBox")) {
            className = L"BUTTON";
            style |= WS_TABSTOP | BS_OWNERDRAW;
        } else if (IsType(control, L"RadioButton")) {
            className = L"BUTTON";
            style |= WS_TABSTOP | BS_OWNERDRAW;
        } else if (IsType(control, L"GroupBox")) {
            className = L"STATIC";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            exStyle |= WS_EX_CONTROLPARENT;
        } else if (IsType(control, L"EdgeBrowser")) {
            className = L"STATIC";
            text = L"";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            exStyle |= WS_EX_CONTROLPARENT;
        } else if (IsType(control, L"ListBox")) {
            className = L"LISTBOX";
            style |= WS_TABSTOP | LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS;
            if (control.flags & CF_SORTED) style |= LBS_SORT;
            if (control.flags & CF_MULTIPLE) style |= LBS_EXTENDEDSEL;
            exStyle = 0;
        } else if (IsType(control, L"ProgressBar")) {
            className = PROGRESS_CLASSW;
            text = L"";
        } else if (IsType(control, L"ComboBox")) {
            className = L"COMBOBOX";
            style |= (control.flags & CF_EDITABLE) ? CBS_DROPDOWN : CBS_DROPDOWNLIST;
            if (!(control.flags & CF_EDITABLE)) style |= CBS_OWNERDRAWFIXED | CBS_HASSTRINGS;
            if (control.flags & CF_SORTED) style |= CBS_SORT;
            style |= WS_VSCROLL;
        } else if (IsType(control, L"ScrollBar")) {
            className = L"SCROLLBAR";
            style |= (control.flags & CF_HORIZONTAL) ? SBS_HORZ : SBS_VERT;
        } else if (IsType(control, L"FlatScrollBar")) {
            className = L"STATIC";
            style |= WS_BORDER | ((control.flags & CF_HORIZONTAL) ? WS_HSCROLL : WS_VSCROLL);
        } else if (IsType(control, L"Image") || IsType(control, L"AnimatedImage")) {
            className = L"STATIC";
            // Runtime image assignment uses STM_SETIMAGE with IMAGE_BITMAP, so
            // even an initially empty image control must keep the SS_BITMAP
            // type. Otherwise the path can load successfully while the STATIC
            // control still paints as a text placeholder.
            style |= SS_BITMAP | SS_CENTERIMAGE | SS_NOTIFY;
            if (!control.data || !control.data[0]) style |= WS_BORDER;
        } else if (IsType(control, L"Grid")) {
            className = L"STATIC";
            // SS_WHITERECT bypasses WM_CTLCOLORSTATIC and always paints a
            // system-white rectangle. Keep the static control neutral so the
            // shared control brush can paint the designer model background.
            style |= SS_NOTIFY;
            if (control.flags & CF_SHOW_BORDER) style |= WS_BORDER;
        } else if (IsUploadControl(control)) {
            className = L"STATIC";
            text = L"";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            exStyle |= WS_EX_CONTROLPARENT | WS_EX_CLIENTEDGE;
        } else if (IsType(control, L"ListView")) {
            className = WC_LISTVIEWW;
            if (control.flags & CF_VIEW_ICON) style |= LVS_ICON;
            else if (control.flags & CF_VIEW_SMALL_ICON) style |= LVS_SMALLICON;
            else if (control.flags & CF_VIEW_LIST) style |= LVS_LIST;
            else style |= LVS_REPORT;
            style |= LVS_SHOWSELALWAYS;
            if (!(control.flags & CF_MULTIPLE)) style |= LVS_SINGLESEL;
            exStyle = 0;
        } else if (IsType(control, L"TreeView")) {
            className = WC_TREEVIEWW;
            style |= TVS_HASBUTTONS | TVS_NONEVENHEIGHT;
            if (control.flags & CF_SHOW_LINES) style |= TVS_HASLINES | TVS_LINESATROOT;
            if (control.flags & CF_CHECKBOXES) style |= TVS_CHECKBOXES;
            exStyle = 0;
        } else if (IsType(control, L"TabControl")) {
            className = WC_TABCONTROLW;
            style |= WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
        } else if (IsType(control, L"Header")) {
            className = WC_HEADERW;
            // Header controls otherwise apply the common-control top alignment
            // behavior and can stretch into a full-width line at y=0 when their
            // tab page is shown. Keep the designer's explicit bounds instead.
            style |= HDS_BUTTONS | HDS_HOTTRACK | HDS_HORZ | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"ComboBoxEx")) {
            className = WC_COMBOBOXEXW;
            style |= CBS_DROPDOWNLIST;
        } else if (IsType(control, L"SysLink")) {
            className = WC_LINK;
            if (control.backgroundTransparent) style |= LWS_TRANSPARENT;
        } else if (IsType(control, L"DateTimePicker")) {
            className = DATETIMEPICK_CLASSW;
            if (TextEquals(control.option1, L"longDate")) style |= DTS_LONGDATEFORMAT;
            else if (TextEquals(control.option1, L"time")) style |= DTS_TIMEFORMAT;
            else style |= DTS_SHORTDATEFORMAT;
        } else if (IsType(control, L"MonthCalendar")) {
            className = MONTHCAL_CLASSW;
            if (control.flags & CF_MULTI_SELECT) style |= MCS_MULTISELECT;
        } else if (IsType(control, L"TrackBar")) {
            className = TRACKBAR_CLASSW;
            style |= TBS_AUTOTICKS;
        } else if (IsType(control, L"UpDown")) {
            className = UPDOWN_CLASSW;
            style |= UDS_ARROWKEYS | UDS_SETBUDDYINT;
        } else if (IsType(control, L"HotKey")) {
            className = HOTKEY_CLASSW;
        } else if (IsType(control, L"IPAddress")) {
            className = WC_IPADDRESSW;
        } else if (IsType(control, L"ToolBar")) {
            className = TOOLBARCLASSNAMEW;
            style |= TBSTYLE_FLAT | TBSTYLE_TOOLTIPS | CCS_NODIVIDER | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"StatusBar")) {
            className = STATUSCLASSNAMEW;
            style |= CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
        } else if (IsType(control, L"ReBar")) {
            className = REBARCLASSNAMEW;
            auto rebarOptions = DecodeControlRecords(control.data2, 5);
            bool locked = !rebarOptions.empty() && rebarOptions[0][0] == L"1";
            bool fixedHeight = !rebarOptions.empty() && rebarOptions[0][2] == L"1";
            bool showBandBorders = !rebarOptions.empty() && rebarOptions[0][3] == L"1";
            style |= CCS_NODIVIDER | CCS_NOPARENTALIGN | CCS_NOMOVEY | CCS_NORESIZE;
            if (!fixedHeight) style |= RBS_VARHEIGHT;
            if (locked) style |= RBS_FIXEDORDER;
            if (showBandBorders) style |= RBS_BANDBORDERS;
        } else if (IsType(control, L"Pager")) {
            className = WC_PAGESCROLLERW;
            if (TextEquals(control.option1, L"vertical")) style |= PGS_VERT;
        } else if (IsType(control, L"RichEdit")) {
            className = MSFTEDIT_CLASS;
            style |= WS_BORDER;
            if (control.flags & CF_MULTILINE) style |= ES_MULTILINE | ES_WANTRETURN;
            if (TextEquals(control.option1, L"horizontal") || TextEquals(control.option1, L"both")) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            if (TextEquals(control.option1, L"vertical") || TextEquals(control.option1, L"both")) style |= ES_AUTOVSCROLL | WS_VSCROLL;
            if (control.flags & CF_READ_ONLY) style |= ES_READONLY;
            if (!(control.flags & CF_WORD_WRAP)) style |= ES_AUTOHSCROLL | WS_HSCROLL;
            exStyle = WS_EX_CLIENTEDGE;
        } else if (IsType(control, L"Animation") || IsType(control, L"VideoPlayer")) {
            className = L"STATIC";
            text = L"";
            style |= SS_NOTIFY | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
        }

        int controlX = ScaleForDpi(control.x, dpi_) - parentContentOffsetX;
        int controlY = ScaleForDpi(control.y, dpi_) - parentContentOffsetY;
        int controlWidth = ScaleForDpi(control.width, dpi_);
        int controlHeight = ScaleForDpi(control.height, dpi_);
        HWND frameHwnd = nullptr;
        HWND childParent = parentHwnd;
        int childX = controlX;
        int childY = controlY;
        int childWidth = controlWidth;
        int childHeight = controlHeight;
        if (IsType(control, L"ComboBox") || IsType(control, L"ComboBoxEx")) {
            int dropDownHeight = std::max(control.height, _wtoi(control.option2));
            childHeight = controlHeight + ScaleForDpi(dropDownHeight, dpi_);
        }
        if (IsType(control, L"TextBox") || IsType(control, L"ListBox") || IsType(control, L"ListView")
            || IsType(control, L"TreeView") || IsType(control, L"IPAddress")) {
            DWORD frameStyle = WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | SS_NOTIFY;
            if (control.flags & CF_HIDDEN) frameStyle &= ~WS_VISIBLE;
            if (!control.enabled) frameStyle |= WS_DISABLED;
            frameHwnd = CreateWindowExW(
                0, L"STATIC", L"", frameStyle,
                controlX, controlY, controlWidth, controlHeight,
                parentHwnd, nullptr, g_instance, nullptr
            );
            if (!frameHwnd) return false;
            childParent = frameHwnd;
            childX = 0;
            childY = 0;
            childWidth = controlWidth;
            childHeight = controlHeight;
        }

        HWND child = CreateWindowExW(
            exStyle,
            className,
            text,
            style,
            childX,
            childY,
            childWidth,
            childHeight,
            childParent,
            reinterpret_cast<HMENU>(static_cast<INT_PTR>(control.id)),
            g_instance,
            nullptr
        );
        if (!child) {
            if (frameHwnd) DestroyWindow(frameHwnd);
            return false;
        }

        HFONT font = CreateControlFont(control.fontFamily, control.fontSize, control.fontBold, control.fontItalic, control.fontUnderline, dpi_);
        HBRUSH brush = CreateSolidBrush(control.background);
        runtimeControls_.push_back({
            control.id,
            child,
            frameHwnd,
            font,
            brush,
            nullptr,
            false,
            false,
            (control.flags & CF_CHECKED) ? BST_CHECKED : BST_UNCHECKED,
            (control.flags & CF_HIDE_TAB_HEADER) != 0,
            nullptr,
            nullptr
        });
        if (IsType(control, L"ColorPicker")) runtimeControls_.back().colorValue = static_cast<COLORREF>(control.value) & 0x00FFFFFFu;
        SetWindowSubclass(child, ControlSubclassProc, static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
        if (frameHwnd) {
            SetWindowSubclass(frameHwnd,
                IsType(control, L"ListBox") ? ListBoxFrameSubclassProc
                    : IsType(control, L"ListView") ? ListViewFrameSubclassProc
                    : IsType(control, L"TreeView") ? TreeViewFrameSubclassProc
                    : IsType(control, L"IPAddress") ? IPAddressFrameSubclassProc
                    : TextBoxFrameSubclassProc,
                static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
        }
        AttachTooltip(child, control);
        HIMAGELIST imageList = FindImageList(IsType(control, L"ListView") ? control.option2 : control.option1);
        if (IsType(control, L"ListView")) {
            ListView_SetImageList(child, CreateListViewSizingImageList(control, imageList), LVSIL_SMALL);
        } else if (imageList) {
            if (IsType(control, L"TreeView")) TreeView_SetImageList(child, imageList, TVSIL_NORMAL);
            else if (IsType(control, L"TabControl")) TabCtrl_SetImageList(child, imageList);
            else if (IsType(control, L"Header")) Header_SetImageList(child, imageList);
            else if (IsType(control, L"ComboBoxEx")) SendMessageW(child, CBEM_SETIMAGELIST, 0, reinterpret_cast<LPARAM>(imageList));
            else if (IsType(control, L"ToolBar")) SendMessageW(child, TB_SETIMAGELIST, 0, reinterpret_cast<LPARAM>(imageList));
        }
        if (font) SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
        if (IsUploadControl(control)) {
            InitializeUploadControl(control, runtimeControls_.back());
        } else if (IsType(control, L"TextBox")) {
            SendMessageW(child, EM_SETMARGINS, EC_LEFTMARGIN | EC_RIGHTMARGIN, MAKELPARAM(ScaleForDpi(10, dpi_), ScaleForDpi(10, dpi_)));
            RuntimeControl& runtime = runtimeControls_.back();
            ApplyTextBoxFrameRegion(frameHwnd);
            LayoutTextBoxControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"ListBox")) {
            RuntimeControl& runtime = runtimeControls_.back();
            SendMessageW(child, LB_SETITEMHEIGHT, 0, ScaleForDpi(control.listItemHeight + control.listItemSpacing, dpi_));
            LayoutListBoxControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"ListView")) {
            RuntimeControl& runtime = runtimeControls_.back();
            LayoutListViewControl(control, runtime);
            HWND header = ListView_GetHeader(child);
            if (header) {
                SetWindowSubclass(header, ListViewHeaderHeightSubclassProc,
                    static_cast<UINT_PTR>(control.id), reinterpret_cast<DWORD_PTR>(this));
                SetWindowPos(child, nullptr, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            }
            InvalidateRect(frameHwnd, nullptr, FALSE);
        } else if (IsType(control, L"TreeView")) {
            RuntimeControl& runtime = runtimeControls_.back();
            LayoutTreeViewControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
        }
        if ((IsType(control, L"CheckBox") || IsType(control, L"RadioButton") || IsType(control, L"Button")) && (control.flags & CF_CHECKED)) {
            SendMessageW(child, BM_SETCHECK, BST_CHECKED, 0);
        }
        if (IsType(control, L"ProgressBar")) {
            SendMessageW(child, PBM_SETRANGE32, control.minimum, control.maximum);
            SendMessageW(child, PBM_SETPOS, control.value, 0);
            SendMessageW(child, PBM_SETBKCOLOR, 0, static_cast<LPARAM>(control.background));
            SendMessageW(child, PBM_SETBARCOLOR, 0, static_cast<LPARAM>(control.foreground));
            if (control.flags & CF_MARQUEE) SendMessageW(child, PBM_SETMARQUEE, TRUE, 30);
        } else if (IsType(control, L"ComboBox")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty() && control.text[0]) rows.push_back({ control.text, L"-1" });
            for (const auto& row : rows) SendMessageW(child, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(row[0].c_str()));
            if (!(control.flags & CF_EDITABLE)) {
                SendMessageW(child, CB_SETITEMHEIGHT, static_cast<WPARAM>(-1), std::max(16, controlHeight - ScaleForDpi(6, dpi_)));
                SendMessageW(child, CB_SETITEMHEIGHT, 0, ScaleForDpi(control.listItemHeight, dpi_));
            }
            SendMessageW(child, CB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"SysLink") && control.data && control.data[0]) {
            std::wstring markup = L"<a href=\"";
            markup += control.data; markup += L"\">"; markup += control.text; markup += L"</a>";
            SetWindowTextW(child, markup.c_str());
        } else if (IsType(control, L"IPAddress")) {
            RuntimeControl& runtime = runtimeControls_.back();
            LayoutIPAddressControl(control, runtime);
            InvalidateRect(frameHwnd, nullptr, FALSE);
            if (control.data && control.data[0]) {
                unsigned int a = 0, b = 0, c = 0, d = 0;
                if (swscanf_s(control.data, L"%u.%u.%u.%u", &a, &b, &c, &d) == 4) {
                    SendMessageW(child, IPM_SETADDRESS, 0, MAKEIPADDRESS(a, b, c, d));
                }
            }
            LayoutIPAddressFields(child, control, runtime);
        } else if (IsType(control, L"DateTimePicker") && TextEquals(control.option1, L"custom") && control.option2 && control.option2[0]) {
            SendMessageW(child, DTM_SETFORMATW, 0, reinterpret_cast<LPARAM>(control.option2));
            SYSTEMTIME date = {}; if (ParseDateTimeValue(control.data, control.option1, date)) SendMessageW(child, DTM_SETSYSTEMTIME, GDT_VALID, reinterpret_cast<LPARAM>(&date));
            ApplyDateTimePickerCalendarAppearance(child, control);
        } else if (IsType(control, L"DateTimePicker")) {
            SYSTEMTIME date = {}; if (ParseDateTimeValue(control.data, control.option1, date)) SendMessageW(child, DTM_SETSYSTEMTIME, GDT_VALID, reinterpret_cast<LPARAM>(&date));
            ApplyDateTimePickerCalendarAppearance(child, control);
        } else if (IsType(control, L"MonthCalendar")) {
            ApplyMonthCalendarColors(child, control);
            SYSTEMTIME date = {}; if (ParseDateTimeValue(control.data, nullptr, date)) {
                if (control.flags & CF_MULTI_SELECT) { SYSTEMTIME range[2] = { date, date }; SendMessageW(child, MCM_SETSELRANGE, 0, reinterpret_cast<LPARAM>(range)); }
                else SendMessageW(child, MCM_SETCURSEL, 0, reinterpret_cast<LPARAM>(&date));
            }
        } else if (IsType(control, L"HotKey")) {
            SendMessageW(child, HKM_SETHOTKEY, ParseHotKeyValue(control.data), 0);
        } else if (IsType(control, L"ListBox")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty() && control.text[0]) rows.push_back({ control.text, L"-1" });
            for (const auto& row : rows) SendMessageW(child, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(row[0].c_str()));
            if (control.flags & CF_MULTIPLE) SendMessageW(child, LB_SETSEL, TRUE, control.selectedIndex);
            else SendMessageW(child, LB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"ScrollBar")) {
            SetScrollRange(child, SB_CTL, control.minimum, control.maximum, FALSE);
            SetScrollPos(child, SB_CTL, control.value, TRUE);
        } else if (IsType(control, L"FlatScrollBar")) {
            InitializeFlatSB(child);
            int bar = (control.flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT;
            FlatSB_SetScrollRange(child, bar, control.minimum, control.maximum, FALSE);
            FlatSB_SetScrollPos(child, bar, control.value, TRUE);
        } else if (IsType(control, L"TrackBar")) {
            SendMessageW(child, TBM_SETRANGE, TRUE, MAKELPARAM(control.minimum, control.maximum));
            SendMessageW(child, TBM_SETPOS, TRUE, control.value);
            SendMessageW(child, TBM_SETTICFREQ, control.selectedIndex > 0 ? control.selectedIndex : 1, 0);
        } else if (IsType(control, L"UpDown")) {
            SendMessageW(child, UDM_SETRANGE32, control.minimum, control.maximum);
            SendMessageW(child, UDM_SETPOS32, 0, control.value);
            if (control.option1 && control.option1[0]) {
                int buddyId = _wtoi(control.option1);
                RuntimeControl* buddy = FindRuntimeControl(buddyId);
                if (buddy && buddy->hwnd) SendMessageW(child, UDM_SETBUDDY, reinterpret_cast<WPARAM>(buddy->hwnd), 0);
            }
        } else if (IsType(control, L"ListView")) {
            DWORD extended = LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER;
            if (control.flags & CF_GRID_LINES) extended |= LVS_EX_GRIDLINES;
            ListView_SetExtendedListViewStyle(child, extended);
            ListView_SetBkColor(child, control.background);
            ListView_SetTextBkColor(child, control.background);
            ListView_SetTextColor(child, control.foreground);
            auto columns = DecodeControlRecords(control.data, 4);
            if (columns.empty()) columns.push_back({ L"内容", L"140", L"-1", L"left" });
            bool alignFirstColumn = !columns.empty() && columns[0][3] != L"left";
            if (alignFirstColumn) {
                wchar_t emptyText[] = L"";
                LVCOLUMNW placeholder = { LVCF_TEXT | LVCF_WIDTH | LVCF_FMT, LVCFMT_LEFT, 0, emptyText };
                ListView_InsertColumn(child, 0, &placeholder);
            }
            for (int index = 0; index < static_cast<int>(columns.size()); ++index) {
                int image = _wtoi(columns[index][2].c_str());
                int format = columns[index][3] == L"center" ? LVCFMT_CENTER : columns[index][3] == L"right" ? LVCFMT_RIGHT : LVCFMT_LEFT;
                LVCOLUMNW column = { static_cast<UINT>(LVCF_TEXT | LVCF_WIDTH | LVCF_FMT | (image >= 0 ? LVCF_IMAGE : 0)), format, ScaleForDpi(_wtoi(columns[index][1].c_str()), dpi_), const_cast<wchar_t*>(columns[index][0].c_str()), 0, 0, image };
                ListView_InsertColumn(child, index + (alignFirstColumn ? 1 : 0), &column);
            }
            if (alignFirstColumn) ListView_DeleteColumn(child, 0);
            auto rows = DecodeControlRecords(control.data2, 3);
            for (int rowIndex = 0; rowIndex < static_cast<int>(rows.size()); ++rowIndex) {
                auto decodedCells = DecodeControlRecords(rows[rowIndex][1].c_str(), static_cast<int>(columns.size()));
                std::vector<std::wstring> cells = decodedCells.empty() ? std::vector<std::wstring>{ rows[rowIndex][0] } : decodedCells[0];
                int image = _wtoi(rows[rowIndex][2].c_str());
                LVITEMW item = { static_cast<UINT>(LVIF_TEXT | (image >= 0 ? LVIF_IMAGE : 0)), rowIndex, 0, 0, 0, const_cast<wchar_t*>(cells[0].c_str()), 0, image };
                int inserted = ListView_InsertItem(child, &item);
                for (int columnIndex = 1; columnIndex < static_cast<int>(cells.size()); ++columnIndex) ListView_SetItemText(child, inserted, columnIndex, const_cast<wchar_t*>(cells[columnIndex].c_str()));
            }
        } else if (IsType(control, L"TreeView")) {
            SendMessageW(child, TVM_SETBKCOLOR, 0, static_cast<LPARAM>(control.background));
            SendMessageW(child, TVM_SETTEXTCOLOR, 0, static_cast<LPARAM>(control.foreground));
            SendMessageW(child, TVM_SETLINECOLOR, 0, static_cast<LPARAM>(control.foreground));
            auto rows = DecodeControlRecords(control.data, 5);
            if (rows.empty() && control.text[0]) rows.push_back({ L"root", L"", control.text, L"-1", L"0" });
            std::map<std::wstring, HTREEITEM> insertedItems;
            for (const auto& row : rows) {
                TVINSERTSTRUCTW item = {};
                auto parent = insertedItems.find(row[1]);
                item.hParent = parent == insertedItems.end() ? TVI_ROOT : parent->second; item.hInsertAfter = TVI_LAST;
                int image = _wtoi(row[3].c_str());
                item.item.mask = TVIF_TEXT | (image >= 0 ? TVIF_IMAGE | TVIF_SELECTEDIMAGE : 0); item.item.pszText = const_cast<wchar_t*>(row[2].c_str()); item.item.iImage = image; item.item.iSelectedImage = image;
                insertedItems[row[0]] = TreeView_InsertItem(child, &item);
            }
            for (const auto& row : rows) {
                auto inserted = insertedItems.find(row[0]);
                if (row[4] == L"1" && inserted != insertedItems.end() && inserted->second) TreeView_Expand(child, inserted->second, TVE_EXPAND);
            }
        } else if (IsType(control, L"TabControl")) {
            auto rows = DecodeControlRecords(control.data, 3);
            if (rows.empty()) rows.push_back({ L"page1", L"标签页 1", L"-1" });
            SendMessageW(child, TCM_SETPADDING, 0, MAKELPARAM(TabHeaderHorizontalPadding(), TabHeaderVerticalPadding()));
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                int image = _wtoi(rows[index][2].c_str());
                TCITEMW item = { static_cast<UINT>(TCIF_TEXT | (image >= 0 ? TCIF_IMAGE : 0)), 0, 0, const_cast<wchar_t*>(rows[index][1].c_str()), 0, image };
                TabCtrl_InsertItem(child, index, &item);
            }
            UpdateTabHeaderMinimumWidth(control, runtimeControls_.back());
            TabCtrl_SetCurSel(child, control.selectedIndex);
            RECT pageRect = { 0, 0, controlWidth, controlHeight };
            if (!runtimeControls_.back().hideTabHeader) TabCtrl_AdjustRect(child, FALSE, &pageRect);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                HWND page = CreateWindowExW(
                    WS_EX_CONTROLPARENT,
                    L"STATIC",
                    L"",
                    WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | SS_NOTIFY,
                    pageRect.left,
                    pageRect.top,
                    std::max(0L, pageRect.right - pageRect.left),
                    std::max(0L, pageRect.bottom - pageRect.top),
                    child,
                    nullptr,
                    g_instance,
                    nullptr
                );
                if (!page) continue;
                SetWindowSubclass(page, TabPageSubclassProc,
                    static_cast<UINT_PTR>(control.id * 1000 + index + 1), reinterpret_cast<DWORD_PTR>(this));
                tabPages_.push_back({ control.id, rows[index][0], page, pageRect });
            }
        } else if (IsType(control, L"StatusBar")) {
            auto rows = DecodeControlRecords(control.data, 2);
            if (rows.empty()) rows.push_back({ control.text, L"140" });
            std::vector<int> edges(rows.size(), 0);
            int edge = 0;
            for (size_t index = 0; index < rows.size(); ++index) { edge += _wtoi(rows[index][1].c_str()); edges[index] = index + 1 == rows.size() ? -1 : ScaleForDpi(edge, dpi_); }
            SendMessageW(child, SB_SETPARTS, static_cast<WPARAM>(edges.size()), reinterpret_cast<LPARAM>(edges.data()));
            COLORREF statusBackground = control.backgroundTransparent
                ? ResolveControlSurroundingColor(control, child)
                : control.background;
            SendMessageW(child, SB_SETBKCOLOR, 0, static_cast<LPARAM>(statusBackground));
            for (size_t index = 0; index < rows.size(); ++index) {
                SendMessageW(child, SB_SETTEXTW, static_cast<WPARAM>(index) | SBT_OWNERDRAW, static_cast<LPARAM>(index));
            }
        } else if (IsType(control, L"RichEdit")) {
            SendMessageW(child, EM_SETEVENTMASK, 0, ENM_CHANGE | ENM_SELCHANGE);
            if (control.data && control.data[0]) {
                int byteCount = WideCharToMultiByte(CP_UTF8, 0, control.data, -1, nullptr, 0, nullptr, nullptr);
                RichEditStreamState state;
                if (byteCount > 1) {
                    state.bytes.resize(static_cast<size_t>(byteCount));
                    WideCharToMultiByte(CP_UTF8, 0, control.data, -1, state.bytes.data(), byteCount, nullptr, nullptr);
                    state.bytes.pop_back();
                    EDITSTREAM stream = {}; stream.dwCookie = reinterpret_cast<DWORD_PTR>(&state); stream.pfnCallback = StreamRichEditData;
                    SendMessageW(child, EM_STREAMIN, SF_RTF, reinterpret_cast<LPARAM>(&stream));
                }
            }
            COLORREF richEditBackground = control.backgroundTransparent
                ? ResolveControlSurroundingColor(control, child)
                : control.background;
            SendMessageW(child, EM_SETBKGNDCOLOR, FALSE, static_cast<LPARAM>(richEditBackground));
            CHARFORMAT2W richEditFormat = {};
            richEditFormat.cbSize = sizeof(richEditFormat);
            richEditFormat.dwMask = CFM_COLOR;
            richEditFormat.crTextColor = control.foreground;
            SendMessageW(child, EM_SETCHARFORMAT, SCF_ALL, reinterpret_cast<LPARAM>(&richEditFormat));
            SendMessageW(child, EM_SETCHARFORMAT, SCF_DEFAULT, reinterpret_cast<LPARAM>(&richEditFormat));
        } else if (IsType(control, L"AnimatedImage") && control.data && control.data[0]) {
            RuntimeControl* runtime = FindRuntimeControl(control.id);
            if (runtime) InitializeAnimatedImage(control, *runtime);
        } else if (IsType(control, L"Image") && control.data && control.data[0]) {
            HBITMAP bitmap = LoadWicBitmap(control.data, ScaleForDpi(control.width, dpi_), ScaleForDpi(control.height, dpi_), control.option1);
            if (bitmap) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap));
                RuntimeControl* runtime = FindRuntimeControl(control.id);
                if (runtime) runtime->resource = bitmap;
            }
        } else if (IsType(control, L"Label") && control.data && control.data[0] && TextEquals(control.option1, L"bitmap")) {
            HBITMAP bitmap = LoadWicBitmap(control.data, ScaleForDpi(control.width, dpi_), ScaleForDpi(control.height, dpi_), L"uniform");
            if (bitmap) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_BITMAP, reinterpret_cast<LPARAM>(bitmap));
                RuntimeControl* runtime = FindRuntimeControl(control.id); if (runtime) runtime->resource = bitmap;
            }
        } else if (IsType(control, L"Label") && control.data && control.data[0] && TextEquals(control.option1, L"icon")) {
            HICON icon = reinterpret_cast<HICON>(LoadImageW(nullptr, control.data, IMAGE_ICON, control.width, control.height, LR_LOADFROMFILE));
            if (icon) {
                SendMessageW(child, STM_SETIMAGE, IMAGE_ICON, reinterpret_cast<LPARAM>(icon));
                RuntimeControl* runtime = FindRuntimeControl(control.id); if (runtime) { runtime->resource = icon; runtime->iconResource = true; }
            }
        } else if (IsType(control, L"Header")) {
            auto rows = DecodeControlRecords(control.data, 4);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                HDITEMW item = {};
                int image = _wtoi(rows[index][2].c_str());
                item.mask = HDI_TEXT | HDI_WIDTH | HDI_FORMAT | (image >= 0 ? HDI_IMAGE : 0);
                item.cxy = ScaleForDpi(_wtoi(rows[index][1].c_str()), dpi_);
                item.pszText = const_cast<wchar_t*>(rows[index][0].c_str());
                item.iImage = image;
                item.fmt = rows[index][3] == L"center" ? HDF_CENTER : rows[index][3] == L"right" ? HDF_RIGHT : HDF_LEFT;
                if (image >= 0) item.fmt |= HDF_IMAGE;
                Header_InsertItem(child, index, &item);
            }
        } else if (IsType(control, L"ComboBoxEx")) {
            auto rows = DecodeControlRecords(control.data, 2);
            for (int index = 0; index < static_cast<int>(rows.size()); ++index) {
                COMBOBOXEXITEMW item = {}; int image = _wtoi(rows[index][1].c_str()); item.mask = CBEIF_TEXT | (image >= 0 ? CBEIF_IMAGE | CBEIF_SELECTEDIMAGE : 0); item.iItem = index; item.pszText = const_cast<wchar_t*>(rows[index][0].c_str()); item.iImage = image; item.iSelectedImage = image;
                SendMessageW(child, CBEM_INSERTITEMW, 0, reinterpret_cast<LPARAM>(&item));
            }
            SendMessageW(child, CB_SETCURSEL, control.selectedIndex, 0);
        } else if (IsType(control, L"ToolBar")) {
            SetWindowTheme(child, L"", L"");
            SendMessageW(child, CCM_SETBKCOLOR, 0, static_cast<LPARAM>(control.background));
            SendMessageW(child, TB_BUTTONSTRUCTSIZE, sizeof(TBBUTTON), 0);
            auto rows = DecodeControlRecords(control.data, 4);
            if (rows.empty() && control.text[0]) rows.push_back({ L"1", control.text, L"-1", L"button" });
            for (const auto& row : rows) {
                int logicalCommand = _wtoi(row[0].c_str());
                int nativeCommand = nextToolbarCommandId_ <= 65534 ? nextToolbarCommandId_++ : control.id;
                toolbarCommandOwners_[nativeCommand] = control.id;
                toolbarCommandValues_[nativeCommand] = logicalCommand > 0 ? logicalCommand : control.id;
                TBBUTTON button = {}; button.idCommand = nativeCommand; button.fsState = TBSTATE_ENABLED;
                button.fsStyle = row[3] == L"separator" ? BTNS_SEP : row[3] == L"check" ? BTNS_CHECK : row[3] == L"dropdown" ? BTNS_DROPDOWN : BTNS_BUTTON | BTNS_AUTOSIZE;
                button.iBitmap = _wtoi(row[2].c_str()); if (button.iBitmap < 0) button.iBitmap = I_IMAGENONE; button.iString = reinterpret_cast<INT_PTR>(row[1].c_str());
                SendMessageW(child, TB_ADDBUTTONSW, 1, reinterpret_cast<LPARAM>(&button));
            }
            SendMessageW(child, TB_AUTOSIZE, 0, 0);
            SetWindowPos(child, nullptr, childX, childY, childWidth, childHeight, SWP_NOZORDER | SWP_NOACTIVATE);
        } else if (IsType(control, L"ReBar")) {
            SetWindowPos(child, nullptr, childX, childY, childWidth, childHeight, SWP_NOZORDER | SWP_NOACTIVATE);
        } else if ((IsType(control, L"Animation") || IsType(control, L"VideoPlayer")) && control.data && control.data[0]) {
            InitializeVideoPlayer(runtimeControls_.back(), control, control.data, (control.flags & CF_AUTO_PLAY) != 0);
        } else if (IsType(control, L"CefBrowser")) {
            CefBrowserInstance* instance = CEF3_确保实例(control.id);
            instance->host = child;
            if (control.data && control.data[0]) instance->url = control.data;
            if (control.data2 && control.data2[0]) {
                auto records = DecodeControlRecords(control.data2, 4);
                if (!records.empty()) {
                    const auto& fields = records[0];
                    if (fields.size() > 0 && !fields[0].empty()) instance->cacheDirectory = fields[0];
                    if (fields.size() > 1 && !fields[1].empty()) instance->userAgent = fields[1];
                    if (fields.size() > 3 && !fields[3].empty() && fields[2] == L"custom") instance->proxyServer = fields[3];
                }
            }
            instance->enableJs = (control.value & 1) != 0;
            instance->loadImages = (control.value & 2) != 0;
            instance->enableWebGL = (control.value & 4) != 0;
            instance->muteAudio = (control.value & 8) != 0;
            instance->enableDevTools = (control.value & 16) != 0;
        }
        return true;
    }

    void RebuildControls() {
        std::vector<const ControlSpec*> pending;
        for (int i = 0; i < spec_.controlCount; ++i) pending.push_back(&spec_.controls[i]);
        while (!pending.empty()) {
            size_t before = pending.size();
            for (auto item = pending.begin(); item != pending.end();) {
                if (CreateGeneratedControl(**item)) item = pending.erase(item);
                else ++item;
            }
            if (pending.size() == before) {
                for (const ControlSpec* control : pending) {
                    ControlSpec rootFallback = *control;
                    rootFallback.parentId = 0;
                    CreateGeneratedControl(rootFallback);
                }
                break;
            }
        }
        WireCompositeControls();
    }

    void DestroyControls() {
        HWND child = GetWindow(hwnd_, GW_CHILD);
        while (child) {
            HWND next = GetWindow(child, GW_HWNDNEXT);
            DestroyWindow(child);
            child = next;
        }
        for (auto& control : runtimeControls_) {
            const ControlSpec* spec = FindControl(control.id);
            if (spec && IsType(*spec, L"FlatScrollBar") && control.hwnd) UninitializeFlatSB(control.hwnd);
            if (control.mediaPlayer) { control.mediaPlayer->Shutdown(); control.mediaPlayer->Release(); control.mediaPlayer = nullptr; }
            if (control.mediaCallback) { control.mediaCallback->Release(); control.mediaCallback = nullptr; }
            if (control.font) DeleteObject(control.font);
            if (control.brush) DeleteObject(control.brush);
            if (control.resource) {
                if (control.iconResource) DestroyIcon(reinterpret_cast<HICON>(control.resource));
                else DeleteObject(control.resource);
            }
            if (control.animatedTimer) KillTimer(hwnd_, control.animatedTimer);
            delete control.animatedImage;
            control.animatedImage = nullptr;
        }
        runtimeControls_.clear();
        tabPages_.clear();
        toolbarCommandOwners_.clear(); toolbarCommandValues_.clear(); nextToolbarCommandId_ = 60000;
        for (auto& imageList : imageLists_) ImageList_Destroy(imageList.second);
        imageLists_.clear();
        for (auto& imageList : listViewSizingImageLists_) ImageList_Destroy(imageList.second);
        listViewSizingImageLists_.clear();
        for (HWND tooltip : tooltipWindows_) if (tooltip) DestroyWindow(tooltip);
        tooltipWindows_.clear();
    }

    LRESULT OnMessage(UINT message, WPARAM wParam, LPARAM lParam) {
        static const UINT findMessage = RegisterWindowMessageW(FINDMSGSTRINGW);
        if (message == findMessage) {
            FINDREPLACEW* event = reinterpret_cast<FINDREPLACEW*>(lParam);
            if (!event) return 0;
            lastFindText_ = event->lpstrFindWhat ? event->lpstrFindWhat : L"";
            lastReplaceText_ = event->lpstrReplaceWith ? event->lpstrReplaceWith : L"";
            if (event->Flags & FR_DIALOGTERM) { lastFindAction_ = L"关闭"; findDialog_ = nullptr; }
            else if (event->Flags & FR_REPLACEALL) lastFindAction_ = L"全部替换";
            else if (event->Flags & FR_REPLACE) lastFindAction_ = L"替换";
            else if (event->Flags & FR_FINDNEXT) lastFindAction_ = L"查找下一个";
            return 0;
        }
        switch (message) {
        case WM_LINGBUILDER_WEB_ASYNC_COMPLETE: {
#ifdef LINGBUILDER_WEB_HTTP_MODULE
            const int requestId = static_cast<int>(wParam);
            std::wstring handler;
            {
                std::lock_guard<std::mutex> resultLock(asyncWebMutex_);
                auto found = asyncWebResults_.find(requestId);
                if (found != asyncWebResults_.end() && found->second.completed) handler = found->second.handler;
            }
            if (!handler.empty()) {
                const int previousRequestId = currentAsyncWebRequestId_;
                currentAsyncWebRequestId_ = requestId;
                DispatchAsyncWebEvent(handler.c_str());
                currentAsyncWebRequestId_ = previousRequestId;
            }
#else
            (void)wParam;
#endif
            return 0;
        }
        case WM_LINGBUILDER_THREAD_UI_UPDATE: {
            std::vector<ThreadUiUpdate> updates;
            { std::lock_guard<std::mutex> uiLock(threadUiMutex_); updates.swap(threadUiQueue_); }
            for (auto& update : updates) {
                if (update.kind == 0) 控件_设置文本(update.controlName.c_str(), update.text);
                else if (update.kind == 1) 列表视图_添加行(update.controlName.c_str(), update.text.c_str());
                else if (update.kind == 2) 控件_添加项目(update.controlName.c_str(), update.text.c_str());
            }
            return 0;
        }
        case WM_LINGBUILDER_CEF_EVENT: {
            auto* packet = reinterpret_cast<LingCefEventPacket*>(lParam);
            if (!packet) return 0;
            CEF3_处理事件包(*packet);
            if (!packet->synchronous) delete packet;
            return 0;
        }
        case WM_LINGBUILDER_LAYOUT_DATE_PICKER: {
            const ControlSpec* control = FindControl(static_cast<int>(wParam));
            RuntimeControl* runtime = control ? FindRuntimeControl(control->id) : nullptr;
            if (control && runtime && IsType(*control, L"DateTimePicker")) {
                ApplyDateTimePickerCalendarAppearance(runtime->hwnd, *control);
            }
            return 0;
        }
        case WM_LINGBUILDER_VIDEO_EVENT: {
            const ControlSpec* control = FindControl(static_cast<int>(wParam));
            RuntimeControl* runtime = control ? FindRuntimeControl(control->id) : nullptr;
            if (!control || !runtime || (!IsType(*control, L"Animation") && !IsType(*control, L"VideoPlayer"))) return 0;
            const bool animation = IsType(*control, L"Animation");
            if (lParam == 1) {
                if (!animation) DispatchLingEvent(*control, L"MediaOpened");
            }
            else if (lParam == 2) {
                if (animation) DispatchLingEvent(*control, L"Finished");
                else DispatchLingEvent(*control, L"PlaybackEnded");
                if ((control->flags & CF_LOOP) && runtime->mediaPlayer) {
                    PROPVARIANT position = {};
                    position.vt = VT_I8;
                    position.hVal.QuadPart = 0;
                    if (SUCCEEDED(runtime->mediaPlayer->SetPosition(MFP_POSITIONTYPE_100NS, &position))) runtime->mediaPlayer->Play();
                }
            } else if (lParam == 3) {
                if (animation) {
                    SetWindowTextW(runtime->hwnd, L"AVI 播放失败");
                    OutputDebugStringW(L"LingBuilder：动画控件无法播放 AVI，请检查文件是否损坏或系统是否具备对应解码器。\n");
                } else {
                    DispatchLingEvent(*control, L"Error");
                }
            }
            return 0;
        }
        case WM_NCPAINT: {
            LRESULT result = DefWindowProcW(hwnd_, message, wParam, lParam);
            PaintMenuBarBackground();
            return result;
        }
        case WM_NCACTIVATE: {
            LRESULT result = DefWindowProcW(hwnd_, message, wParam, lParam);
            PaintMenuBarBackground();
            return result;
        }
        case WM_MEASUREITEM: {
            MEASUREITEMSTRUCT* item = reinterpret_cast<MEASUREITEMSTRUCT*>(lParam);
            if (item && item->CtlType == ODT_MENU && item->itemData) {
                HDC hdc = GetDC(hwnd_);
                SIZE size = {};
                std::wstring text = GetOwnerDrawMenuText(item->itemID);
                if (hdc) {
                    HGDIOBJ oldFont = menuFont_ ? SelectObject(hdc, menuFont_) : nullptr;
                    GetTextExtentPoint32W(hdc, text.c_str(), static_cast<int>(text.size()), &size);
                    if (oldFont) SelectObject(hdc, oldFont);
                    ReleaseDC(hwnd_, hdc);
                }
                item->itemWidth = static_cast<UINT>(size.cx + ScaleForDpi(16, dpi_));
                item->itemHeight = static_cast<UINT>(std::max(static_cast<int>(size.cy) + ScaleForDpi(6, dpi_), GetSystemMetrics(SM_CYMENU)));
                return TRUE;
            }
            break;
        }
        case WM_CREATE: {
            windowBrush_ = CreateSolidBrush(spec_.background);
            ++g_openWindowCount;
            CreateImageLists();
            RebuildControls();
            bool acceptsDroppedFiles = !GetWindowEventHandler(spec_, L"FileDropped").empty() || HasFileDialogDropTarget();
            for (int index = 0; !acceptsDroppedFiles && index < spec_.controlCount; ++index) {
                acceptsDroppedFiles = IsUploadControl(spec_.controls[index]) && (spec_.controls[index].selectedIndex & 16);
            }
            if (acceptsDroppedFiles) DragAcceptFiles(hwnd_, TRUE);
            OnWindowCreated();
            return 0;
        }
        case WM_CLOSE:
            closingEventActive_ = true;
            closingCancelled_ = false;
            DispatchWindowEvent(L"Closing");
            closingEventActive_ = false;
            if (!closingCancelled_) DestroyWindow(hwnd_);
            return 0;
        case WM_SHOWWINDOW: {
            bool nextVisible = wParam != FALSE;
            if (visible_ != nextVisible) {
                visible_ = nextVisible;
                DispatchWindowEvent(L"VisibilityChanged");
            }
            break;
        }
        case WM_MOVE: {
            int nextX = static_cast<int>(static_cast<short>(LOWORD(lParam)));
            int nextY = static_cast<int>(static_cast<short>(HIWORD(lParam)));
            bool changed = eventX_ != nextX || eventY_ != nextY;
            eventX_ = nextX;
            eventY_ = nextY;
            if (moveBaselineReady_ && changed) DispatchWindowEvent(L"Moved");
            moveBaselineReady_ = true;
            return 0;
        }
        case WM_SIZE:
#if LINGBUILDER_EDGEVIEW_AVAILABLE
            EdgeView_调整全部大小();
#endif
            CEF3_调整全部大小();
            {
                int nextWidth = static_cast<int>(LOWORD(lParam));
                int nextHeight = static_cast<int>(HIWORD(lParam));
                int nextState = wParam == SIZE_MINIMIZED ? 1 : wParam == SIZE_MAXIMIZED ? 2 : 0;
                bool sizeChanged = eventWidth_ != nextWidth || eventHeight_ != nextHeight;
                bool stateChanged = windowState_ != nextState;
                eventWidth_ = nextWidth;
                eventHeight_ = nextHeight;
                windowState_ = nextState;
                if (sizeBaselineReady_ && sizeChanged) DispatchWindowEvent(L"SizeChanged");
                if (windowStateBaselineReady_ && stateChanged) {
                    DispatchWindowEvent(nextState == 1 ? L"Minimized" : nextState == 2 ? L"Maximized" : L"Restored");
                }
                sizeBaselineReady_ = true;
                windowStateBaselineReady_ = true;
            }
            return 0;
        case WM_ACTIVATE: {
            bool nextActive = LOWORD(wParam) != WA_INACTIVE;
            if (active_ != nextActive) {
                active_ = nextActive;
                DispatchWindowEvent(nextActive ? L"Activated" : L"Deactivated");
            }
            return 0;
        }
        case WM_SETFOCUS:
            DispatchWindowEvent(L"GotFocus");
            return 0;
        case WM_KILLFOCUS:
            DispatchWindowEvent(L"LostFocus");
            return 0;
        case WM_DPICHANGED: {
            dpi_ = HIWORD(wParam);
            RECT* suggested = reinterpret_cast<RECT*>(lParam);
            if (suggested) {
                SetWindowPos(hwnd_, nullptr, suggested->left, suggested->top,
                    suggested->right - suggested->left, suggested->bottom - suggested->top,
                    SWP_NOZORDER | SWP_NOACTIVATE);
            }
            EdgeView_关闭设计器控件();
            DestroyControls();
            CreateImageLists();
            RebuildControls();
#if LINGBUILDER_EDGEVIEW_AVAILABLE
            EdgeView_创建控件(nullptr);
#endif
            CEF3_调整全部大小();
            DispatchWindowEvent(L"DpiChanged");
            return 0;
        }
        case WM_DROPFILES: {
            HDROP drop = reinterpret_cast<HDROP>(wParam);
            POINT dropPoint = {}; DragQueryPoint(drop, &dropPoint);
            droppedFiles_.clear();
            UINT count = DragQueryFileW(drop, 0xFFFFFFFF, nullptr, 0);
            for (UINT index = 0; index < count; ++index) {
                UINT length = DragQueryFileW(drop, index, nullptr, 0);
                std::wstring path(static_cast<size_t>(length + 1), L'\0');
                DragQueryFileW(drop, index, path.data(), length + 1);
                path.resize(static_cast<size_t>(length));
                droppedFiles_.push_back(path);
            }
            DragFinish(drop);
            for (auto& runtime : runtimeControls_) {
                const ControlSpec* control = FindControl(runtime.id);
                if (!control || !IsUploadControl(*control) || !(control->selectedIndex & 16)) continue;
                RECT bounds = {}; GetWindowRect(runtime.hwnd, &bounds);
                MapWindowPoints(HWND_DESKTOP, hwnd_, reinterpret_cast<POINT*>(&bounds), 2);
                if (PtInRect(&bounds, dropPoint)) {
                    AddUploadFiles(*control, runtime, droppedFiles_);
                    return 0;
                }
            }
            if (HandleFileDialogDrop(dropPoint, droppedFiles_)) return 0;
            DispatchWindowEvent(L"FileDropped");
            return 0;
        }
        case WM_CONTEXTMENU:
            if (HandleContextMenu(reinterpret_cast<HWND>(wParam), lParam)) return 0;
            break;
        case WM_TIMER:
            if (AdvanceAnimatedImage(static_cast<UINT_PTR>(wParam))) return 0;
            if (wParam == 0x4C44) {
                if (!batchProgress_ || !batchProgress_->active) { KillTimer(hwnd_, 0x4C44); return 0; }
                const int completed = batchProgress_->completed.load();
                const int threadsDone = batchProgress_->threadsDone.load();
                const int totalTasks = batchProgress_->totalTasks;
                const int totalThreads = batchProgress_->totalThreads;
                std::wstring status = L"进度：" + std::to_wstring(completed) + L"/" + std::to_wstring(totalTasks) + L"  线程完成：" + std::to_wstring(threadsDone) + L"/" + std::to_wstring(totalThreads);
                控件_设置文本(batchProgress_->stName.c_str(), status);
                const int sampleInterval = (std::max)(1, totalTasks / 200);
                int lastSample = batchProgress_->lastLvSample;
                int nextSample = (completed / sampleInterval) * sampleInterval;
                if (nextSample > lastSample) {
                    static const wchar_t* taskTypes[] = { L"数据采集", L"文件读取", L"网络请求", L"缓存写入", L"日志归档", L"数据解析", L"图片下载", L"压缩打包", L"索引构建", L"消息推送" };
                    RuntimeControl* rc = FindRuntimeControlByName(batchProgress_->lvName.c_str());
                    HWND lvHwnd = rc ? rc->hwnd : nullptr;
                    if (lvHwnd) SendMessageW(lvHwnd, WM_SETREDRAW, FALSE, 0);
                    for (int s = lastSample + sampleInterval; s <= nextSample && s <= totalTasks; s += sampleInterval) {
                        int threadIdx = (s * totalThreads / totalTasks) + 1;
                        const wchar_t* taskType = taskTypes[s % 10];
                        std::wstring row = L"任务" + std::to_wstring(s) + L"	线程" + std::to_wstring(threadIdx) + L"	" + taskType + L"	完成";
                        列表视图_添加行(batchProgress_->lvName.c_str(), row.c_str());
                    }
                    if (lvHwnd) { SendMessageW(lvHwnd, WM_SETREDRAW, TRUE, 0); InvalidateRect(lvHwnd, nullptr, TRUE); }
                    batchProgress_->lastLvSample = nextSample;
                    std::wstring log = L"[进度] 已完成 " + std::to_wstring(completed) + L"/" + std::to_wstring(totalTasks) + L" (" + std::to_wstring(completed * 100 / totalTasks) + L"%)";
                    控件_添加项目(batchProgress_->logName.c_str(), log.c_str());
                }
                if (threadsDone >= totalThreads && completed >= totalTasks) {
                    控件_设置文本(batchProgress_->stName.c_str(), (L"全部 " + std::to_wstring(totalTasks) + L" 个任务完成！" + std::to_wstring(totalThreads) + L" 个线程已安全回收").c_str());
                    控件_添加项目(batchProgress_->logName.c_str(), (L"[完成] " + std::to_wstring(totalTasks) + L"个任务全部完成，" + std::to_wstring(totalThreads) + L"个线程已安全回收").c_str());
                    列表视图_添加行(batchProgress_->lvName.c_str(), (L"汇总	全部线程	" + std::to_wstring(totalTasks) + L"个任务	已完成").c_str());
                    batchProgress_->active = false;
                    KillTimer(hwnd_, 0x4C44);
                }
                return 0;
            }
            if (wParam == 0x4C42) {
                KillTimer(hwnd_, 0x4C42);
                SetWindowPos(hwnd_, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                SetForegroundWindow(hwnd_);
                BringWindowToTop(hwnd_);
                SetFocus(hwnd_);
                return 0;
            }
            break;
        case WM_COMMAND: {
            int controlId = LOWORD(wParam);
            int notification = HIWORD(wParam);
            const ControlSpec* control = FindControl(controlId);
            auto toolbarOwner = toolbarCommandOwners_.find(controlId);
            if (!control && toolbarOwner != toolbarCommandOwners_.end()) control = FindControl(toolbarOwner->second);
            if (!control && lParam) control = FindControl(GetDlgCtrlID(reinterpret_cast<HWND>(lParam)));
            if (controlId >= 50000 && controlId < 50100 && control) {
                DispatchLingEvent(*control, L"Select");
                return 0;
            }
            if (!control) return 0;
            if (notification == BN_CLICKED || notification == STN_CLICKED) HandleFileDialogTrigger(control->id);
            if (IsType(*control, L"CheckBox") && notification == BN_CLICKED) {
                HWND child = reinterpret_cast<HWND>(lParam);
                int currentState = static_cast<int>(SendMessageW(child, BM_GETCHECK, 0, 0));
                int nextState = BST_UNCHECKED;
                if (control->flags & CF_THREE_STATE) {
                    nextState = currentState == BST_UNCHECKED
                        ? BST_CHECKED
                        : currentState == BST_CHECKED ? BST_INDETERMINATE : BST_UNCHECKED;
                } else {
                    nextState = currentState == BST_CHECKED ? BST_UNCHECKED : BST_CHECKED;
                }
                SendMessageW(child, BM_SETCHECK, nextState, 0);
                InvalidateRect(child, nullptr, TRUE);
                DispatchLingEvent(*control, nextState == BST_CHECKED ? L"Checked" : L"Unchecked");
            } else if (IsType(*control, L"RadioButton") && notification == BN_CLICKED) {
                SelectRadioControl(*control, reinterpret_cast<HWND>(lParam));
            } else if (IsType(*control, L"ColorPicker") && notification == BN_CLICKED) {
                颜色选择器_打开(control->name);
            } else if ((IsType(*control, L"Button") || IsType(*control, L"Label") || IsType(*control, L"Image") || IsType(*control, L"AnimatedImage") || IsType(*control, L"SysLink")) && (notification == BN_CLICKED || notification == STN_CLICKED)) {
                DispatchLingEvent(*control, L"Click");
            } else if ((IsType(*control, L"TextBox") || IsType(*control, L"RichEdit")) && notification == EN_CHANGE) {
                DispatchLingEvent(*control, L"TextChanged");
            } else if (IsType(*control, L"ListBox") && notification == LBN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"ListBox") && notification == LBN_DBLCLK) {
                DispatchLingEvent(*control, L"DoubleClick");
            } else if ((IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) && notification == CBN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if ((IsType(*control, L"ComboBox") || IsType(*control, L"ComboBoxEx")) && notification == CBN_EDITCHANGE) {
                DispatchLingEvent(*control, L"TextChanged");
            } else if (IsType(*control, L"HotKey") && notification == EN_CHANGE) {
                DispatchLingEvent(*control, L"ValueChanged");
            } else if (IsType(*control, L"ToolBar") && notification == 0) {
                auto logical = toolbarCommandValues_.find(controlId);
                lastToolbarCommand_ = logical == toolbarCommandValues_.end() ? controlId : logical->second;
                DispatchLingEvent(*control, L"Click");
            } else if (IsType(*control, L"Animation") && notification == ACN_STOP) {
                DispatchLingEvent(*control, L"Finished");
            }
            return 0;
        }
        case WM_DRAWITEM: {
            DRAWITEMSTRUCT* item = reinterpret_cast<DRAWITEMSTRUCT*>(lParam);
            if (item && item->CtlType == ODT_MENU && item->itemData) {
                PaintMenuBarItem(item);
                return TRUE;
            }
            return (PaintOwnerListBox(item)
                || PaintOwnerComboBox(item)
                || PaintOwnerStatusBar(item)
                || PaintOwnerButton(item)) ? TRUE : FALSE;
        }
        case WM_NOTIFY: {
            NMHDR* header = reinterpret_cast<NMHDR*>(lParam);
            if (!header) return 0;
            const ControlSpec* control = FindControl(static_cast<int>(header->idFrom));
            if (!control) return 0;
            if (IsType(*control, L"Header") && header->code == NM_CUSTOMDRAW) {
                return PaintStandaloneHeader(*control, reinterpret_cast<NMCUSTOMDRAW*>(lParam));
            } else if (IsType(*control, L"ToolBar") && header->code == NM_CUSTOMDRAW) {
                return PaintToolBar(*control, reinterpret_cast<NMTBCUSTOMDRAW*>(lParam));
            } else if (IsType(*control, L"DateTimePicker") && header->code == DTN_DROPDOWN) {
                ApplyDateTimePickerCalendarAppearance(header->hwndFrom, *control);
                PostMessageW(hwnd_, WM_LINGBUILDER_LAYOUT_DATE_PICKER, static_cast<WPARAM>(control->id), 0);
            } else if ((IsType(*control, L"ListView") && header->code == LVN_ITEMCHANGED) ||
                (IsType(*control, L"TreeView") && header->code == TVN_SELCHANGEDW) ||
                (IsType(*control, L"TabControl") && header->code == TCN_SELCHANGE)) {
                if (IsType(*control, L"TabControl")) UpdateTabChildren(*control);
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"ListView") && header->code == LVN_COLUMNCLICK) {
                DispatchLingEvent(*control, L"ColumnClick");
            } else if ((IsType(*control, L"ListView") || IsType(*control, L"TreeView")) && header->code == NM_DBLCLK) {
                DispatchLingEvent(*control, L"DoubleClick");
            } else if (IsType(*control, L"TreeView") && header->code == TVN_ITEMEXPANDEDW) {
                NMTREEVIEWW* tree = reinterpret_cast<NMTREEVIEWW*>(lParam);
                DispatchLingEvent(*control, tree->action == TVE_COLLAPSE ? L"Collapsed" : L"Expanded");
            } else if (IsType(*control, L"Header") && header->code == HDN_ITEMCLICKW) {
                DispatchLingEvent(*control, L"ColumnClick");
            } else if (IsType(*control, L"Header") && header->code == HDN_ENDTRACKW) {
                DispatchLingEvent(*control, L"ColumnResized");
            } else if ((IsType(*control, L"DateTimePicker") && header->code == DTN_DATETIMECHANGE) ||
                       (IsType(*control, L"MonthCalendar") && header->code == MCN_SELCHANGE) ||
                       (IsType(*control, L"UpDown") && header->code == UDN_DELTAPOS) ||
                       (IsType(*control, L"IPAddress") && header->code == IPN_FIELDCHANGED)) {
                DispatchLingEvent(*control, L"ValueChanged");
            } else if (IsType(*control, L"SysLink") && (header->code == NM_CLICK || header->code == NM_RETURN)) {
                NMLINK* link = reinterpret_cast<NMLINK*>(lParam);
                const wchar_t* target = link && link->item.szUrl[0] ? link->item.szUrl : control->data;
                if (target && target[0]) {
                    ShellExecuteW(hwnd_, L"open", target, nullptr, nullptr, SW_SHOWNORMAL);
                }
                DispatchLingEvent(*control, L"Click");
            } else if (IsType(*control, L"RichEdit") && header->code == EN_SELCHANGE) {
                DispatchLingEvent(*control, L"SelectionChanged");
            } else if (IsType(*control, L"StatusBar") && header->code == NM_DBLCLK) {
                NMMOUSE* mouse = reinterpret_cast<NMMOUSE*>(lParam);
                lastStatusPart_ = mouse ? static_cast<int>(mouse->dwItemSpec) : -1;
                DispatchLingEvent(*control, L"DoubleClick");
            } else if (IsType(*control, L"Pager") && header->code == PGN_CALCSIZE) {
                NMPGCALCSIZE* size = reinterpret_cast<NMPGCALCSIZE*>(lParam);
                RuntimeControl* pager = FindRuntimeControl(control->id);
                if (size && pager) {
                    HWND child = GetWindow(pager->hwnd, GW_CHILD);
                    RECT area = {}; if (child) GetWindowRect(child, &area);
                    if (size->dwFlag == PGF_CALCWIDTH) size->iWidth = std::max(1L, area.right - area.left);
                    else size->iHeight = std::max(1L, area.bottom - area.top);
                }
            } else if (IsType(*control, L"Pager") && header->code == PGN_SCROLL) {
                DispatchLingEvent(*control, L"Scroll");
            } else if (IsType(*control, L"ReBar") && header->code == RBN_BEGINDRAG) {
                DispatchLingEvent(*control, L"BandDragStarted");
            } else if (IsType(*control, L"ReBar") && header->code == RBN_ENDDRAG) {
                DispatchLingEvent(*control, L"BandDragEnded");
            } else if (IsType(*control, L"ReBar") && header->code == RBN_HEIGHTCHANGE) {
                DispatchLingEvent(*control, L"HeightChanged");
            } else if (IsType(*control, L"ReBar") && header->code == RBN_LAYOUTCHANGED) {
                DispatchLingEvent(*control, L"LayoutChanged");
            }
            return 0;
        }
        case WM_HSCROLL:
        case WM_VSCROLL: {
            HWND child = reinterpret_cast<HWND>(lParam);
            if (!child) return 0;
            const ControlSpec* control = FindControl(GetDlgCtrlID(child));
            if (control && (IsType(*control, L"TrackBar") || IsType(*control, L"ScrollBar") || IsType(*control, L"FlatScrollBar"))) {
                if (IsType(*control, L"ScrollBar") || IsType(*control, L"FlatScrollBar")) {
                    int bar = (control->flags & CF_HORIZONTAL) ? SB_HORZ : SB_VERT;
                    int position = IsType(*control, L"FlatScrollBar") ? FlatSB_GetScrollPos(child, bar) : GetScrollPos(child, SB_CTL);
                    switch (LOWORD(wParam)) {
                    case SB_LINELEFT: position -= 1; break;
                    case SB_LINERIGHT: position += 1; break;
                    case SB_PAGELEFT: position -= 10; break;
                    case SB_PAGERIGHT: position += 10; break;
                    case SB_THUMBPOSITION:
                    case SB_THUMBTRACK: position = HIWORD(wParam); break;
                    }
                    position = std::max(control->minimum, std::min(control->maximum, position));
                    if (IsType(*control, L"FlatScrollBar")) FlatSB_SetScrollPos(child, bar, position, TRUE);
                    else SetScrollPos(child, SB_CTL, position, TRUE);
                }
                DispatchLingEvent(*control, L"ValueChanged");
            }
            return 0;
        }
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLORBTN:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            HWND child = reinterpret_cast<HWND>(lParam);
            int controlId = GetDlgCtrlID(child);
            const ControlSpec* control = FindControl(controlId);
            RuntimeControl* runtime = FindRuntimeControl(controlId);
            if (control) {
                SetTextColor(hdc, control->foreground);
                const bool usesTransparentParent =
                    (message == WM_CTLCOLORSTATIC && control->backgroundTransparent && (IsType(*control, L"Label") || IsType(*control, L"SysLink")))
                    || (control->backgroundTransparent
                        && (message == WM_CTLCOLOREDIT || message == WM_CTLCOLORSTATIC) && IsType(*control, L"HotKey"));
                if (usesTransparentParent) {
                    SetBkMode(hdc, TRANSPARENT);
                    SetBkColor(hdc, ResolveControlSurroundingColor(*control, child));
                    return reinterpret_cast<LRESULT>(ResolveControlSurroundingBrush(*control, child));
                }
                SetBkColor(hdc, control->background);
            }
            if (runtime && runtime->brush) return reinterpret_cast<LRESULT>(runtime->brush);
            return reinterpret_cast<LRESULT>(windowBrush_);
        }
        case WM_ERASEBKGND: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            RECT rect;
            GetClientRect(hwnd_, &rect);
            FillRect(hdc, &rect, windowBrush_);
            return 1;
        }
        case WM_DESTROY:
            if (!closedDispatched_) {
                closedDispatched_ = true;
                DispatchWindowEvent(L"Closed");
            }
            EdgeView_关闭();
            CEF3_关闭全部();
            DestroyControls();
            DestroyWindowIcons();
            if (windowBrush_) {
                DeleteObject(windowBrush_);
                windowBrush_ = nullptr;
            }
            if (menuBrush_) {
                DeleteObject(menuBrush_);
                menuBrush_ = nullptr;
            }
            if (menuFont_) {
                DeleteObject(menuFont_);
                menuFont_ = nullptr;
            }
            --g_openWindowCount;
            if (g_openWindowCount <= 0) PostQuitMessage(0);
            return 0;
        }
        return DefWindowProcW(hwnd_, message, wParam, lParam);
    }

public:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
        LingWindowBase* self = reinterpret_cast<LingWindowBase*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
        if (message == WM_NCCREATE) {
            auto createStruct = reinterpret_cast<CREATESTRUCTW*>(lParam);
            self = reinterpret_cast<LingWindowBase*>(createStruct->lpCreateParams);
            self->hwnd_ = hwnd;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
            return DefWindowProcW(hwnd, message, wParam, lParam);
        }
        if (!self) return DefWindowProcW(hwnd, message, wParam, lParam);
        LRESULT result = self->OnMessage(message, wParam, lParam);
        if (message == WM_NCDESTROY) {
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            delete self;
        }
        return result;
    }
};

#if LINGBUILDER_CEF3_AVAILABLE
class LingCefClient final : public CefClient,
    public CefAudioHandler, public CefCommandHandler, public CefContextMenuHandler,
    public CefDialogHandler, public CefDisplayHandler, public CefDownloadHandler,
    public CefDragHandler, public CefFindHandler, public CefFocusHandler,
    public CefFrameHandler, public CefPermissionHandler, public CefJSDialogHandler,
    public CefKeyboardHandler, public CefLifeSpanHandler, public CefLoadHandler,
    public CefPrintHandler, public CefRequestHandler, public CefResourceRequestHandler,
    public CefCookieAccessFilter {
public:
    LingCefClient(LingWindowBase* owner, int controlId) : owner_(owner), controlId_(controlId) {}

    CefRefPtr<CefAudioHandler> GetAudioHandler() override { return this; }
    CefRefPtr<CefCommandHandler> GetCommandHandler() override { return this; }
    CefRefPtr<CefContextMenuHandler> GetContextMenuHandler() override { return this; }
    CefRefPtr<CefDialogHandler> GetDialogHandler() override { return this; }
    CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
    CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
    CefRefPtr<CefDownloadHandler> GetDownloadHandler() override { return this; }
    CefRefPtr<CefDragHandler> GetDragHandler() override { return this; }
    CefRefPtr<CefFindHandler> GetFindHandler() override { return this; }
    CefRefPtr<CefFocusHandler> GetFocusHandler() override { return this; }
    CefRefPtr<CefFrameHandler> GetFrameHandler() override { return this; }
    CefRefPtr<CefPermissionHandler> GetPermissionHandler() override { return this; }
    CefRefPtr<CefJSDialogHandler> GetJSDialogHandler() override { return this; }
    CefRefPtr<CefKeyboardHandler> GetKeyboardHandler() override { return this; }
    CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
    CefRefPtr<CefPrintHandler> GetPrintHandler() override { return this; }
    CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }

    bool OnProcessMessageReceived(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                                  CefProcessId sourceProcess, CefRefPtr<CefProcessMessage> message) override {
        LingCefEventPacket packet = Sync(L"进程消息收到", message ? message->GetName().ToWString() : L"", {
            {L"frameId", FrameId(frame)}, {L"sourceProcess", I(sourceProcess)},
            {L"message", message ? message->GetName().ToWString() : L""}
        });
        return packet.action == 3;
    }

    void OnAfterCreated(CefRefPtr<CefBrowser> browser) override {
        if (owner_) owner_->CEF3_通知已创建(controlId_, browser);
        Async(L"浏览器创建完成", I(browser ? browser->GetIdentifier() : 0), {{L"browserId", I(browser ? browser->GetIdentifier() : 0)}});
    }
    bool DoClose(CefRefPtr<CefBrowser> browser) override {
        return Sync(L"浏览器请求关闭", L"", {{L"browserId", I(browser ? browser->GetIdentifier() : 0)}}).action == 3;
    }
    void OnBeforeClose(CefRefPtr<CefBrowser> browser) override {
        Async(L"浏览器即将关闭", I(browser ? browser->GetIdentifier() : 0));
        if (owner_) owner_->CEF3_通知关闭(controlId_);
    }
    bool OnBeforePopup(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int popupId,
                       const CefString& targetUrl, const CefString& targetFrameName,
                       CefLifeSpanHandler::WindowOpenDisposition disposition, bool userGesture,
                       const CefPopupFeatures&, CefWindowInfo&, CefRefPtr<CefClient>&,
                       CefBrowserSettings&, CefRefPtr<CefDictionaryValue>&, bool*) override {
        auto packet = Sync(L"新窗口打开前", targetUrl.ToWString(), {
            {L"url", targetUrl.ToWString()}, {L"frameName", targetFrameName.ToWString()},
            {L"frameId", FrameId(frame)}, {L"popupId", I(popupId)},
            {L"disposition", I(disposition)}, {L"userGesture", B(userGesture)}
        });
        return packet.action == 2 || packet.action == 3;
    }
    void OnBeforePopupAborted(CefRefPtr<CefBrowser>, int popupId) override {
        Async(L"新窗口打开已中止", I(popupId), {{L"popupId", I(popupId)}});
    }
    void OnBeforeDevToolsPopup(CefRefPtr<CefBrowser>, CefWindowInfo&, CefRefPtr<CefClient>&,
                               CefBrowserSettings&, CefRefPtr<CefDictionaryValue>&, bool*) override {
        Async(L"开发者工具窗口打开前", L"");
    }

    void OnLoadingStateChange(CefRefPtr<CefBrowser>, bool loading, bool canBack, bool canForward) override {
        Async(L"加载状态改变", B(loading), {{L"loading", B(loading)}, {L"canGoBack", B(canBack)}, {L"canGoForward", B(canForward)}});
    }
    void OnLoadStart(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, TransitionType transition) override {
        Async(L"开始加载", frame ? frame->GetURL().ToWString() : L"", FrameFields(frame, {{L"transition", I(transition)}}));
    }
    void OnLoadEnd(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int statusCode) override {
        Async(L"加载完成", frame ? frame->GetURL().ToWString() : L"", FrameFields(frame, {{L"statusCode", I(statusCode)}}));
    }
    void OnLoadError(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, ErrorCode code,
                     const CefString& text, const CefString& failedUrl) override {
        Async(L"加载失败", text.ToWString(), FrameFields(frame, {{L"errorCode", I(code)}, {L"errorText", text.ToWString()}, {L"url", failedUrl.ToWString()}}));
    }
    void OnAddressChange(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefString& url) override {
        Async(L"地址被改变", url.ToWString(), FrameFields(frame, {{L"url", url.ToWString()}}));
    }
    void OnTitleChange(CefRefPtr<CefBrowser>, const CefString& title) override { Async(L"标题被改变", title.ToWString(), {{L"title", title.ToWString()}}); }
    void OnFaviconURLChange(CefRefPtr<CefBrowser>, const std::vector<CefString>& urls) override {
        Async(L"网页图标地址改变", urls.empty() ? L"" : urls.front().ToWString(), {{L"count", I(urls.size())}, {L"url", urls.empty() ? L"" : urls.front().ToWString()}});
    }
    void OnFullscreenModeChange(CefRefPtr<CefBrowser>, bool value) override { Async(L"全屏状态改变", B(value), {{L"fullscreen", B(value)}}); }
    bool OnTooltip(CefRefPtr<CefBrowser>, CefString& text) override {
        auto packet = Sync(L"工具提示显示", text.ToWString(), {{L"text", text.ToWString()}});
        if (!packet.resultText.empty()) text = packet.resultText;
        return packet.action == 3;
    }
    void OnStatusMessage(CefRefPtr<CefBrowser>, const CefString& value) override { Async(L"状态消息改变", value.ToWString(), {{L"text", value.ToWString()}}); }
    bool OnConsoleMessage(CefRefPtr<CefBrowser>, cef_log_severity_t level, const CefString& message,
                          const CefString& source, int line) override {
        return Sync(L"控制台消息", message.ToWString(), {{L"level", I(level)}, {L"message", message.ToWString()}, {L"source", source.ToWString()}, {L"line", I(line)}}).action == 3;
    }
    bool OnAutoResize(CefRefPtr<CefBrowser>, const CefSize& size) override {
        return Sync(L"自动调整大小", I(size.width) + L"," + I(size.height), {{L"width", I(size.width)}, {L"height", I(size.height)}}).action == 3;
    }
    void OnLoadingProgressChange(CefRefPtr<CefBrowser>, double progress) override {
        if (Throttle(lastProgressEvent_, 50)) Async(L"加载进度改变", D(progress), {{L"progress", D(progress)}});
    }
    bool OnCursorChange(CefRefPtr<CefBrowser>, CefCursorHandle, cef_cursor_type_t type, const CefCursorInfo&) override {
        return Sync(L"鼠标指针改变", I(type), {{L"type", I(type)}}).action == 3;
    }
    void OnMediaAccessChange(CefRefPtr<CefBrowser>, bool video, bool audio) override {
        Async(L"媒体访问状态改变", B(video || audio), {{L"video", B(video)}, {L"audio", B(audio)}});
    }
    bool OnContentsBoundsChange(CefRefPtr<CefBrowser>, const CefRect& rect) override {
        return Sync(L"内容边界改变", Rect(rect), RectFields(rect)).action == 3;
    }
    bool GetRootWindowScreenRect(CefRefPtr<CefBrowser>, CefRect& rect) override {
        auto packet = Sync(L"根窗口屏幕区域查询", Rect(rect), RectFields(rect));
        int x = 0, y = 0, width = 0, height = 0;
        if ((packet.action == 1 || packet.action == 3) && swscanf_s(packet.resultText.c_str(), L"%d,%d,%d,%d", &x, &y, &width, &height) == 4) {
            rect = CefRect(x, y, width, height); return true;
        }
        return false;
    }

    void OnTakeFocus(CefRefPtr<CefBrowser>, bool next) override { Async(L"焦点即将移出", B(next), {{L"next", B(next)}}); }
    bool OnSetFocus(CefRefPtr<CefBrowser>, FocusSource source) override { return Sync(L"浏览器请求焦点", I(source), {{L"source", I(source)}}).action == 2; }
    void OnGotFocus(CefRefPtr<CefBrowser>) override { Async(L"浏览器获得焦点", L""); }
    bool OnPreKeyEvent(CefRefPtr<CefBrowser>, const CefKeyEvent& e, CefEventHandle, bool* shortcut) override {
        auto packet = Sync(L"键盘事件预处理", I(e.windows_key_code), KeyFields(e));
        if (shortcut && packet.action == 1) *shortcut = true;
        return packet.action == 3;
    }
    bool OnKeyEvent(CefRefPtr<CefBrowser>, const CefKeyEvent& e, CefEventHandle) override {
        return Sync(L"键盘事件", I(e.windows_key_code), KeyFields(e)).action == 3;
    }
    bool OnDragEnter(CefRefPtr<CefBrowser>, CefRefPtr<CefDragData> data, DragOperationsMask mask) override {
        return Sync(L"拖入浏览器", data && data->IsFile() ? L"file" : L"data", {{L"mask", I(mask)}, {L"isFile", B(data && data->IsFile())}, {L"isLink", B(data && data->IsLink())}}).action == 2;
    }
    void OnDraggableRegionsChanged(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const std::vector<CefDraggableRegion>& regions) override {
        Async(L"网页可拖动区域改变", I(regions.size()), FrameFields(frame, {{L"count", I(regions.size())}}));
    }
    void OnFindResult(CefRefPtr<CefBrowser>, int identifier, int count, const CefRect& rect, int active, bool finalUpdate) override {
        Async(L"页内查找结果", I(count), {{L"identifier", I(identifier)}, {L"count", I(count)}, {L"active", I(active)}, {L"final", B(finalUpdate)}, {L"rect", Rect(rect)}});
    }

    void OnFrameCreated(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame) override { Async(L"框架创建", FrameId(frame), FrameFields(frame)); }
    void OnFrameDestroyed(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame) override { Async(L"框架销毁", FrameId(frame), FrameFields(frame)); }
    void OnFrameAttached(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, bool reattached) override { Async(L"框架附加", FrameId(frame), FrameFields(frame, {{L"reattached", B(reattached)}})); }
    void OnFrameDetached(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame) override { Async(L"框架分离", FrameId(frame), FrameFields(frame)); }
    void OnMainFrameChanged(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> oldFrame, CefRefPtr<CefFrame> newFrame) override {
        Async(L"主框架改变", FrameId(newFrame), {{L"oldFrameId", FrameId(oldFrame)}, {L"newFrameId", FrameId(newFrame)}});
    }

    void OnBeforeContextMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                             CefRefPtr<CefContextMenuParams> params, CefRefPtr<CefMenuModel> model) override {
        Fields fields = FrameFields(frame, {{L"itemCount", I(model ? model->GetCount() : 0)}});
        if (params) { fields[L"x"] = I(params->GetXCoord()); fields[L"y"] = I(params->GetYCoord()); fields[L"linkUrl"] = params->GetLinkUrl().ToWString(); fields[L"selection"] = params->GetSelectionText().ToWString(); }
        Async(L"上下文菜单显示前", fields[L"linkUrl"], std::move(fields));
    }
    bool RunContextMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefContextMenuParams>,
                        CefRefPtr<CefMenuModel>, CefRefPtr<CefRunContextMenuCallback> callback) override {
        auto packet = Sync(L"运行上下文菜单", L"", FrameFields(frame));
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        if (packet.action == 3 && callback) { callback->Continue(packet.resultText.empty() ? 0 : _wtoi(packet.resultText.c_str()), EVENTFLAG_NONE); return true; }
        return false;
    }
    bool OnContextMenuCommand(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefContextMenuParams>, int commandId, EventFlags flags) override {
        return Sync(L"上下文菜单命令", I(commandId), FrameFields(frame, {{L"commandId", I(commandId)}, {L"flags", I(flags)}})).action == 3;
    }
    void OnContextMenuDismissed(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame) override { Async(L"上下文菜单已关闭", L"", FrameFields(frame)); }
    bool RunQuickMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefPoint& location, const CefSize& size,
                      QuickMenuEditStateFlags flags, CefRefPtr<CefRunQuickMenuCallback> callback) override {
        auto packet = Sync(L"运行快速菜单", L"", FrameFields(frame, {{L"x", I(location.x)}, {L"y", I(location.y)}, {L"width", I(size.width)}, {L"height", I(size.height)}, {L"flags", I(flags)}}));
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        if (packet.action == 3 && callback) { callback->Continue(packet.resultText.empty() ? 0 : _wtoi(packet.resultText.c_str()), EVENTFLAG_NONE); return true; }
        return false;
    }
    bool OnQuickMenuCommand(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int commandId, EventFlags flags) override {
        return Sync(L"快速菜单命令", I(commandId), FrameFields(frame, {{L"commandId", I(commandId)}, {L"flags", I(flags)}})).action == 3;
    }
    void OnQuickMenuDismissed(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame) override { Async(L"快速菜单已关闭", L"", FrameFields(frame)); }

    bool OnFileDialog(CefRefPtr<CefBrowser>, FileDialogMode mode, const CefString& title, const CefString& defaultPath,
                      const std::vector<CefString>& filters, const std::vector<CefString>&,
                      const std::vector<CefString>&, CefRefPtr<CefFileDialogCallback> callback) override {
        auto packet = Sync(L"文件对话框请求", title.ToWString(), {{L"mode", I(mode)}, {L"title", title.ToWString()}, {L"defaultPath", defaultPath.ToWString()}, {L"filterCount", I(filters.size())}});
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        if ((packet.action == 1 || packet.action == 3) && callback) { std::vector<CefString> paths; if (!packet.resultText.empty()) paths.push_back(packet.resultText); callback->Continue(paths); return true; }
        return false;
    }
    bool OnJSDialog(CefRefPtr<CefBrowser>, const CefString& origin, JSDialogType type, const CefString& message,
                    const CefString& prompt, CefRefPtr<CefJSDialogCallback> callback, bool& suppress) override {
        auto packet = Sync(L"脚本对话框请求", message.ToWString(), {{L"origin", origin.ToWString()}, {L"type", I(type)}, {L"message", message.ToWString()}, {L"defaultText", prompt.ToWString()}});
        if (packet.action == 2) { suppress = true; if (callback) callback->Continue(false, CefString()); return true; }
        if ((packet.action == 1 || packet.action == 3) && callback) { callback->Continue(true, packet.resultText); return true; }
        return false;
    }
    bool OnBeforeUnloadDialog(CefRefPtr<CefBrowser>, const CefString& message, bool reload, CefRefPtr<CefJSDialogCallback> callback) override {
        auto packet = Sync(L"离开页面确认请求", message.ToWString(), {{L"message", message.ToWString()}, {L"reload", B(reload)}});
        if (packet.action == 2 && callback) { callback->Continue(false, CefString()); return true; }
        if ((packet.action == 1 || packet.action == 3) && callback) { callback->Continue(true, CefString()); return true; }
        return false;
    }
    void OnResetDialogState(CefRefPtr<CefBrowser>) override { Async(L"脚本对话框状态重置", L""); }
    void OnDialogClosed(CefRefPtr<CefBrowser>) override { Async(L"脚本对话框已关闭", L""); }

    bool CanDownload(CefRefPtr<CefBrowser>, const CefString& url, const CefString& method) override {
        return Sync(L"下载许可查询", url.ToWString(), {{L"url", url.ToWString()}, {L"method", method.ToWString()}}).action != 2;
    }
    bool OnBeforeDownload(CefRefPtr<CefBrowser>, CefRefPtr<CefDownloadItem> item, const CefString& suggested,
                          CefRefPtr<CefBeforeDownloadCallback> callback) override {
        auto packet = Sync(L"下载开始", suggested.ToWString(), DownloadFields(item, {{L"suggestedName", suggested.ToWString()}}));
        if (packet.action == 2) return true;
        if ((packet.action == 1 || packet.action == 3) && callback) { callback->Continue(packet.resultText, false); return true; }
        return false;
    }
    void OnDownloadUpdated(CefRefPtr<CefBrowser>, CefRefPtr<CefDownloadItem> item, CefRefPtr<CefDownloadItemCallback> callback) override {
        if (!Throttle(lastDownloadEvent_, 80) && item && !item->IsComplete() && !item->IsCanceled()) return;
        auto packet = Sync(L"下载进度更新", item ? I(item->GetPercentComplete()) : L"", DownloadFields(item));
        if (packet.action == 2 && callback) callback->Cancel();
    }

    bool OnRequestMediaAccessPermission(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefString& origin,
                                        uint32_t permissions, CefRefPtr<CefMediaAccessCallback> callback) override {
        auto packet = Sync(L"媒体权限请求", origin.ToWString(), FrameFields(frame, {{L"origin", origin.ToWString()}, {L"permissions", I(permissions)}}));
        if (packet.action == 1 && callback) { callback->Continue(permissions); return true; }
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        return false;
    }
    bool OnShowPermissionPrompt(CefRefPtr<CefBrowser>, uint64_t promptId, const CefString& origin,
                                uint32_t permissions, CefRefPtr<CefPermissionPromptCallback> callback) override {
        auto packet = Sync(L"网站权限请求", origin.ToWString(), {{L"promptId", I(promptId)}, {L"origin", origin.ToWString()}, {L"permissions", I(permissions)}});
        if (packet.action == 1 && callback) { callback->Continue(CEF_PERMISSION_RESULT_ACCEPT); return true; }
        if (packet.action == 2 && callback) { callback->Continue(CEF_PERMISSION_RESULT_DENY); return true; }
        return false;
    }
    void OnDismissPermissionPrompt(CefRefPtr<CefBrowser>, uint64_t promptId, cef_permission_request_result_t result) override {
        Async(L"网站权限提示关闭", I(result), {{L"promptId", I(promptId)}, {L"result", I(result)}});
    }

    bool OnBeforeBrowse(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, bool gesture, bool redirect) override {
        return Sync(L"导航请求前", RequestUrl(request), FrameFields(frame, RequestFields(request, {{L"userGesture", B(gesture)}, {L"redirect", B(redirect)}}))).action == 2;
    }
    bool OnOpenURLFromTab(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefString& url, CefRequestHandler::WindowOpenDisposition disposition, bool gesture) override {
        return Sync(L"标签页打开地址请求", url.ToWString(), FrameFields(frame, {{L"url", url.ToWString()}, {L"disposition", I(disposition)}, {L"userGesture", B(gesture)}})).action == 2;
    }
    CefRefPtr<CefResourceRequestHandler> GetResourceRequestHandler(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, bool navigation, bool download, const CefString& initiator, bool& disableDefault) override {
        auto packet = Sync(L"资源请求处理器查询", RequestUrl(request), FrameFields(frame, RequestFields(request, {{L"navigation", B(navigation)}, {L"download", B(download)}, {L"initiator", initiator.ToWString()}})));
        disableDefault = packet.action == 2; return this;
    }
    CefRefPtr<CefCookieAccessFilter> GetCookieAccessFilter(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request) override {
        Sync(L"Cookie过滤器查询", RequestUrl(request), FrameFields(frame, RequestFields(request))); return this;
    }
    ReturnValue OnBeforeResourceLoad(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefCallback>) override {
        auto packet = Sync(L"资源加载前", RequestUrl(request), FrameFields(frame, RequestFields(request)));
        if (!packet.resultText.empty() && request) request->SetURL(packet.resultText);
        return packet.action == 2 ? RV_CANCEL : RV_CONTINUE;
    }
    CefRefPtr<CefResourceHandler> GetResourceHandler(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request) override {
        Sync(L"自定义资源处理器查询", RequestUrl(request), FrameFields(frame, RequestFields(request))); return nullptr;
    }
    void OnResourceRedirect(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response, CefString& newUrl) override {
        auto packet = Sync(L"资源重定向", newUrl.ToWString(), FrameFields(frame, RequestFields(request, {{L"newUrl", newUrl.ToWString()}, {L"statusCode", I(response ? response->GetStatus() : 0)}})));
        if (!packet.resultText.empty()) newUrl = packet.resultText;
    }
    bool OnResourceResponse(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response) override {
        return Sync(L"资源响应到达", RequestUrl(request), FrameFields(frame, RequestFields(request, {{L"statusCode", I(response ? response->GetStatus() : 0)}, {L"mimeType", response ? response->GetMimeType().ToWString() : L""}}))).action == 3;
    }
    CefRefPtr<CefResponseFilter> GetResourceResponseFilter(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response) override {
        Sync(L"资源响应过滤器查询", RequestUrl(request), FrameFields(frame, RequestFields(request, {{L"statusCode", I(response ? response->GetStatus() : 0)}}))); return nullptr;
    }
    void OnResourceLoadComplete(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response, URLRequestStatus status, int64_t length) override {
        Async(L"资源加载完成", RequestUrl(request), FrameFields(frame, RequestFields(request, {{L"status", I(status)}, {L"statusCode", I(response ? response->GetStatus() : 0)}, {L"receivedBytes", I(length)}})));
    }
    void OnProtocolExecution(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, bool& allow) override {
        allow = Sync(L"外部协议执行请求", RequestUrl(request), FrameFields(frame, RequestFields(request))).action == 1;
    }
    bool CanSendCookie(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, const CefCookie& cookie) override {
        return Sync(L"发送Cookie查询", CefString(&cookie.name).ToWString(), FrameFields(frame, RequestFields(request, CookieFields(cookie)))).action != 2;
    }
    bool CanSaveCookie(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request, CefRefPtr<CefResponse>, const CefCookie& cookie) override {
        return Sync(L"保存Cookie查询", CefString(&cookie.name).ToWString(), FrameFields(frame, RequestFields(request, CookieFields(cookie)))).action != 2;
    }
    bool GetAuthCredentials(CefRefPtr<CefBrowser>, const CefString& origin, bool proxy, const CefString& host,
                            int port, const CefString& realm, const CefString& scheme, CefRefPtr<CefAuthCallback> callback) override {
        auto packet = Sync(L"身份验证请求", host.ToWString(), {{L"origin", origin.ToWString()}, {L"proxy", B(proxy)}, {L"host", host.ToWString()}, {L"port", I(port)}, {L"realm", realm.ToWString()}, {L"scheme", scheme.ToWString()}});
        if (packet.action != 1 || !callback) return false;
        size_t split = packet.resultText.find(L'	');
        callback->Continue(split == std::wstring::npos ? packet.resultText : packet.resultText.substr(0, split), split == std::wstring::npos ? L"" : packet.resultText.substr(split + 1));
        return true;
    }
    bool OnCertificateError(CefRefPtr<CefBrowser>, cef_errorcode_t error, const CefString& url, CefRefPtr<CefSSLInfo>, CefRefPtr<CefCallback> callback) override {
        auto packet = Sync(L"证书错误", url.ToWString(), {{L"url", url.ToWString()}, {L"errorCode", I(error)}});
        if (packet.action == 1 && callback) { callback->Continue(); return true; }
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        return false;
    }
    bool OnSelectClientCertificate(CefRefPtr<CefBrowser>, bool proxy, const CefString& host, int port,
                                   const X509CertificateList& certificates, CefRefPtr<CefSelectClientCertificateCallback> callback) override {
        auto packet = Sync(L"客户端证书选择", host.ToWString(), {{L"proxy", B(proxy)}, {L"host", host.ToWString()}, {L"port", I(port)}, {L"count", I(certificates.size())}});
        if (packet.action == 2 && callback) { callback->Select(nullptr); return true; }
        if (packet.action == 1 && callback && !certificates.empty()) { callback->Select(certificates.front()); return true; }
        return false;
    }
    void OnRenderViewReady(CefRefPtr<CefBrowser>) override { Async(L"渲染视图就绪", L""); }
    bool OnRenderProcessUnresponsive(CefRefPtr<CefBrowser>, CefRefPtr<CefUnresponsiveProcessCallback> callback) override {
        auto packet = Sync(L"渲染进程无响应", L"");
        if (packet.action == 1 && callback) { callback->Wait(); return true; }
        if (packet.action == 2 && callback) { callback->Terminate(); return true; }
        return packet.action == 3;
    }
    void OnRenderProcessResponsive(CefRefPtr<CefBrowser>) override { Async(L"渲染进程恢复响应", L""); }
    void OnRenderProcessTerminated(CefRefPtr<CefBrowser>, TerminationStatus status, int errorCode, const CefString& error) override {
        Async(L"渲染进程终止", error.ToWString(), {{L"status", I(status)}, {L"errorCode", I(errorCode)}, {L"error", error.ToWString()}});
    }
    void OnDocumentAvailableInMainFrame(CefRefPtr<CefBrowser>) override { Async(L"主文档可用", L""); }

    bool OnChromeCommand(CefRefPtr<CefBrowser>, int commandId, cef_window_open_disposition_t disposition) override {
        return Sync(L"Chrome命令", I(commandId), {{L"commandId", I(commandId)}, {L"disposition", I(disposition)}}).action == 3;
    }
    bool IsChromeAppMenuItemVisible(CefRefPtr<CefBrowser>, int commandId) override { return VisibilityDecision(L"应用菜单项可见性查询", commandId, true); }
    bool IsChromeAppMenuItemEnabled(CefRefPtr<CefBrowser>, int commandId) override { return VisibilityDecision(L"应用菜单项启用查询", commandId, true); }
    bool IsChromePageActionIconVisible(cef_chrome_page_action_icon_type_t type) override { return VisibilityDecision(L"页面动作图标可见性查询", type, true); }
    bool IsChromeToolbarButtonVisible(cef_chrome_toolbar_button_type_t type) override { return VisibilityDecision(L"工具栏按钮可见性查询", type, true); }

    bool GetAudioParameters(CefRefPtr<CefBrowser>, CefAudioParameters& params) override {
        auto packet = Sync(L"音频参数请求", I(params.sample_rate), {{L"sampleRate", I(params.sample_rate)}, {L"framesPerBuffer", I(params.frames_per_buffer)}, {L"channelLayout", I(params.channel_layout)}});
        return packet.action == 3;
    }
    void OnAudioStreamStarted(CefRefPtr<CefBrowser>, const CefAudioParameters& params, int channels) override {
        Async(L"音频流开始", I(params.sample_rate), {{L"sampleRate", I(params.sample_rate)}, {L"framesPerBuffer", I(params.frames_per_buffer)}, {L"channels", I(channels)}});
    }
    void OnAudioStreamPacket(CefRefPtr<CefBrowser>, const float**, int frames, int64_t pts) override {
        if (Throttle(lastAudioEvent_, 100)) Async(L"音频数据包", I(frames), {{L"frames", I(frames)}, {L"pts", I(pts)}});
    }
    void OnAudioStreamStopped(CefRefPtr<CefBrowser>) override { Async(L"音频流停止", L""); }
    void OnAudioStreamError(CefRefPtr<CefBrowser>, const CefString& message) override { Async(L"音频流错误", message.ToWString(), {{L"message", message.ToWString()}}); }

    void OnPrintStart(CefRefPtr<CefBrowser>) override { Async(L"打印开始", L""); }
    void OnPrintSettings(CefRefPtr<CefBrowser>, CefRefPtr<CefPrintSettings>, bool defaults) override { Async(L"打印设置请求", B(defaults), {{L"getDefaults", B(defaults)}}); }
    bool OnPrintDialog(CefRefPtr<CefBrowser>, bool selection, CefRefPtr<CefPrintDialogCallback> callback) override {
        auto packet = Sync(L"打印对话框请求", B(selection), {{L"hasSelection", B(selection)}});
        if (packet.action == 2 && callback) { callback->Cancel(); return true; }
        return false;
    }
    bool OnPrintJob(CefRefPtr<CefBrowser>, const CefString& document, const CefString& pdfPath, CefRefPtr<CefPrintJobCallback> callback) override {
        auto packet = Sync(L"打印任务提交", document.ToWString(), {{L"documentName", document.ToWString()}, {L"pdfPath", pdfPath.ToWString()}});
        if (packet.action == 1 && callback) { callback->Continue(); return true; }
        return false;
    }
    void OnPrintReset(CefRefPtr<CefBrowser>) override { Async(L"打印状态重置", L""); }
    CefSize GetPdfPaperSize(CefRefPtr<CefBrowser>, int dpi) override {
        auto packet = Sync(L"PDF纸张大小查询", I(dpi), {{L"dpi", I(dpi)}});
        int width = 0, height = 0;
        if (swscanf_s(packet.resultText.c_str(), L"%d,%d", &width, &height) == 2) return CefSize(width, height);
        return CefSize();
    }

private:
    using Fields = std::map<std::wstring, std::wstring>;
    static std::wstring I(long long value) { return std::to_wstring(value); }
    static std::wstring B(bool value) { return value ? L"1" : L"0"; }
    static std::wstring D(double value) { std::wostringstream out; out << value; return out.str(); }
    static std::wstring FrameId(CefRefPtr<CefFrame> frame) { return frame ? frame->GetIdentifier().ToWString() : L""; }
    static std::wstring Rect(const CefRect& r) { return I(r.x) + L"," + I(r.y) + L"," + I(r.width) + L"," + I(r.height); }
    static Fields RectFields(const CefRect& r) { return {{L"x", I(r.x)}, {L"y", I(r.y)}, {L"width", I(r.width)}, {L"height", I(r.height)}}; }
    static Fields FrameFields(CefRefPtr<CefFrame> frame, Fields extra = {}) {
        extra[L"frameId"] = FrameId(frame); extra[L"isMain"] = B(frame && frame->IsMain());
        extra[L"url"] = frame ? frame->GetURL().ToWString() : L""; return extra;
    }
    static Fields KeyFields(const CefKeyEvent& e) {
        return {{L"type", I(e.type)}, {L"modifiers", I(e.modifiers)}, {L"windowsKeyCode", I(e.windows_key_code)},
                {L"nativeKeyCode", I(e.native_key_code)}, {L"character", I(e.character)}, {L"systemKey", B(e.is_system_key)}};
    }
    static std::wstring RequestUrl(CefRefPtr<CefRequest> request) { return request ? request->GetURL().ToWString() : L""; }
    static Fields RequestFields(CefRefPtr<CefRequest> request, Fields extra = {}) {
        extra[L"url"] = RequestUrl(request); extra[L"method"] = request ? request->GetMethod().ToWString() : L"";
        extra[L"resourceType"] = request ? I(request->GetResourceType()) : L""; return extra;
    }
    static Fields CookieFields(const CefCookie& cookie) {
        return {{L"cookieName", CefString(&cookie.name).ToWString()}, {L"cookieDomain", CefString(&cookie.domain).ToWString()},
                {L"cookiePath", CefString(&cookie.path).ToWString()}, {L"secure", B(cookie.secure != 0)}, {L"httpOnly", B(cookie.httponly != 0)}};
    }
    static Fields DownloadFields(CefRefPtr<CefDownloadItem> item, Fields extra = {}) {
        if (!item) return extra;
        extra[L"id"] = I(item->GetId()); extra[L"url"] = item->GetURL().ToWString(); extra[L"fullPath"] = item->GetFullPath().ToWString();
        extra[L"percent"] = I(item->GetPercentComplete()); extra[L"receivedBytes"] = I(item->GetReceivedBytes()); extra[L"totalBytes"] = I(item->GetTotalBytes());
        extra[L"complete"] = B(item->IsComplete()); extra[L"canceled"] = B(item->IsCanceled()); extra[L"inProgress"] = B(item->IsInProgress()); return extra;
    }
    bool VisibilityDecision(const wchar_t* name, int value, bool defaultValue) {
        auto packet = Sync(name, I(value), {{L"value", I(value)}});
        if (packet.action == 1) return true; if (packet.action == 2) return false; return defaultValue;
    }
    static bool Throttle(std::atomic<int64_t>& last, int intervalMs) {
        int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
        int64_t previous = last.load();
        return now - previous >= intervalMs && last.compare_exchange_strong(previous, now);
    }
    void Async(const wchar_t* name, const std::wstring& data, Fields fields = {}) {
        if (owner_) owner_->CEF3_投递事件(controlId_, name, data.c_str(), std::move(fields));
    }
    LingCefEventPacket Sync(const wchar_t* name, const std::wstring& data, Fields fields = {}) {
        LingCefEventPacket packet; packet.controlId = controlId_; packet.name = name; packet.data = data; packet.fields = std::move(fields);
        if (owner_) owner_->CEF3_发送事件(packet); return packet;
    }
    IMPLEMENT_REFCOUNTING(LingCefClient);
    LingWindowBase* owner_;
    int controlId_;
    std::atomic<int64_t> lastProgressEvent_{0};
    std::atomic<int64_t> lastDownloadEvent_{0};
    std::atomic<int64_t> lastAudioEvent_{0};
};

CefRefPtr<CefClient> LingCreateCefClient(LingWindowBase* owner, int controlId) {
    return new LingCefClient(owner, controlId);
}
#endif





class MainWindow : public LingWindowBase {
public:
    explicit MainWindow(const WindowSpec& spec) : LingWindowBase(spec) {}


    int 演示返回(int 输入值) {
        if (输入值>0) {
        return 100;
        }
        return 0;
        return 0;
    }


protected:

    void DispatchWindowEvent(const wchar_t* eventName) override {
        std::wstring handler = GetWindowEventHandler(spec_, eventName);
        if (handler == L"创建完毕") { 创建完毕(); return; }
        if (handler == L"_运行演示按钮_被单击") { 运行演示按钮_被单击(); return; }
        if (handler == L"_清空日志按钮_被单击") { 清空日志按钮_被单击(); return; }
        if (handler == L"_退出按钮_被单击") { 退出按钮_被单击(); return; }
        LingWindowBase::DispatchWindowEvent(eventName);
    }
    void DispatchDesignerResourceEvent(const wchar_t* resourceId, const wchar_t* eventName) override {
        (void)resourceId; (void)eventName;
    }
    void DispatchAsyncWebEvent(const wchar_t* handler) override {
        std::wstring callback = handler ? handler : L"";
        if (callback == L"创建完毕") { 创建完毕(); return; }
        if (callback == L"_运行演示按钮_被单击") { 运行演示按钮_被单击(); return; }
        if (callback == L"_清空日志按钮_被单击") { 清空日志按钮_被单击(); return; }
        if (callback == L"_退出按钮_被单击") { 退出按钮_被单击(); return; }
        LingWindowBase::DispatchAsyncWebEvent(handler);
    }
    void DispatchLingEvent(const ControlSpec& control, const wchar_t* eventName) override {
        std::wstring handler = GetEventHandler(control, eventName);
        if (handler == L"创建完毕") { 创建完毕(); return; }
        if (handler == L"_运行演示按钮_被单击") { 运行演示按钮_被单击(); return; }
        if (handler == L"_清空日志按钮_被单击") { 清空日志按钮_被单击(); return; }
        if (handler == L"_退出按钮_被单击") { 退出按钮_被单击(); return; }
        LingWindowBase::DispatchLingEvent(control, eventName);
    }
    void DispatchEdgeViewEvent(const wchar_t* handler, int instanceId, const wchar_t* eventName, const wchar_t* data) override {
        std::wstring callback = handler ? handler : L"";
        if (callback == L"创建完毕") { 创建完毕(); return; }
        if (callback == L"_运行演示按钮_被单击") { 运行演示按钮_被单击(); return; }
        if (callback == L"_清空日志按钮_被单击") { 清空日志按钮_被单击(); return; }
        if (callback == L"_退出按钮_被单击") { 退出按钮_被单击(); return; }
        LingWindowBase::DispatchEdgeViewEvent(handler, instanceId, eventName, data);
    }
    void DispatchCefBrowserEvent(const wchar_t* handler, int controlId, const wchar_t* eventName, const wchar_t* data) override {
        std::wstring callback = handler ? handler : L"";
        if (callback == L"创建完毕") { 创建完毕(); return; }
        if (callback == L"_运行演示按钮_被单击") { 运行演示按钮_被单击(); return; }
        if (callback == L"_清空日志按钮_被单击") { 清空日志按钮_被单击(); return; }
        if (callback == L"_退出按钮_被单击") { 退出按钮_被单击(); return; }
        LingWindowBase::DispatchCefBrowserEvent(handler, controlId, eventName, data);
    }


private:

    void 创建完毕() {
        控件_设置文本(L"状态标签", L"就绪：点击“运行完整演示”");
        控件_添加项目(L"演示日志", L"程序已启动，等待运行控制流演示。");
    }

    void 运行演示按钮_被单击() {
        int 数值 = 2;
        int 索引 = 0;
        int 当前项 = 0;
        int 返回结果 = 0;
        std::vector<int> 数字列表 = {2, 4, 6};
        控件_清空项目(L"演示日志");
        控件_设置文本(L"状态标签", L"正在运行基础控制流演示...");
        if (数值==2) {
        控件_添加项目(L"演示日志", L"1. 如果真：数值等于 2");
        } else if (数值==3) {
        控件_添加项目(L"演示日志", L"1. 否则如果：数值等于 3");
        } else {
        控件_添加项目(L"演示日志", L"1. 否则：数值不是 2 或 3");
        }
        switch (数值) {
        case 1: {
        控件_添加项目(L"演示日志", L"2. 选择：命中分支 1");
        break; } case 2: case 3: {
        控件_添加项目(L"演示日志", L"2. 选择：命中分支 2 或 3");
        break; } default: {
        控件_添加项目(L"演示日志", L"2. 选择：命中默认分支");
        break; } }
        while (true) {
        控件_添加项目(L"演示日志", L"3. 无限循环：执行一次后跳出");
        break;
        }
        索引 = 0;
        while (索引<2) {
        索引 = 索引+1;
        控件_添加项目(L"演示日志", L"4. 判断循环：执行一轮");
        }
        do {
        控件_添加项目(L"演示日志", L"5. 循环判断：至少执行一次");
        } while (false);
        for (int __ling_37_index = 1, __ling_37_count = static_cast<int>(3); __ling_37_index <= __ling_37_count; ++__ling_37_index) { 索引 = __ling_37_index;
        if (索引==2) {
        continue;
        }
        控件_添加项目(L"演示日志", L"6. 计次循环：第 2 次被跳过");
        调试输出(L"计次循环索引", 索引);
        }
        for (索引 = 1; (1) >= 0 ? 索引 <= (3) : 索引 >= (3); 索引 += (1)) {
        if (索引==2) {
        continue;
        }
        控件_添加项目(L"演示日志", L"7. 变量循环：非跳过轮次");
        调试输出(L"变量循环索引", 索引);
        }
        for (const auto& __ling_53_item : 数字列表) { 当前项 = __ling_53_item;
        控件_添加项目(L"演示日志", L"8. 枚举循环：读取一个数组成员");
        调试输出(L"枚举成员", 当前项);
        }
        { LingFinallyGuard __ling_58_finally([&]() {
        控件_添加项目(L"演示日志", L"9. 最终：无论是否异常都会执行");
    }); try {
        throw std::runtime_error(LingCppWideToUtf8(L"这是用于演示的异常"));
        } catch (const std::exception& __ling_60_exception) { std::wstring 错误信息 = LingCppUtf8ToWide(__ling_60_exception.what());
        控件_添加项目(L"演示日志", L"9. 捕获：异常已被安全接住");
        调试输出(L"捕获到异常", 错误信息);
        }
        }
        返回结果 = 演示返回(数值);
        if (返回结果==100) {
        控件_添加项目(L"演示日志", L"10. 返回：方法返回了 100");
        }
        控件_设置文本(L"状态标签", L"演示完成：全部基础控制流已执行");
        控件_添加项目(L"演示日志", L"全部演示完成。");
    }

    void 清空日志按钮_被单击() {
        控件_清空项目(L"演示日志");
        控件_设置文本(L"状态标签", L"日志已清空");
    }

    void 退出按钮_被单击() {
        结束();
    }
};

static LingWindowBase* CreateWindowObject(int windowIndex) {
    switch (windowIndex) {
    case 0: return new MainWindow(g_windows[0]);
    default: return nullptr;
    }
}

static HWND OpenGeneratedWindow(int windowIndex, int showCommand, const wchar_t* placement, int x, int y, bool hasCustomPosition) {
    LingWindowBase* window = CreateWindowObject(windowIndex);
    if (!window) return nullptr;
    HWND hwnd = window->Open(showCommand, placement, x, y, hasCustomPosition);
    if (!hwnd) {
        // If CreateWindowEx reached WM_NCCREATE, WM_NCDESTROY owns deletion.
        // Avoid double-free when user code closes the window during creation.
        return nullptr;
    }
    return hwnd;
}

static bool WindowSpecMatchesName(const WindowSpec& spec, const wchar_t* windowName) {
    if (!windowName || windowName[0] == 0) return false;
    return (spec.title && std::wcscmp(spec.title, windowName) == 0) ||
        (spec.className && std::wcscmp(spec.className, windowName) == 0);
}

static HWND OpenGeneratedWindowByName(const wchar_t* windowName, int showCommand, const wchar_t* placement, int x, int y, bool hasCustomPosition) {
    for (int index = 0; index < g_windowCount; ++index) {
        if (WindowSpecMatchesName(g_windows[index], windowName)) {
            return OpenGeneratedWindow(index, showCommand, placement, x, y, hasCustomPosition);
        }
    }
    return nullptr;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
#if LINGBUILDER_CEF3_AVAILABLE
    CefMainArgs cefMainArgs(instance);
    int cefExitCode = CefExecuteProcess(cefMainArgs, nullptr, nullptr);
    if (cefExitCode >= 0) return cefExitCode;
#endif
    g_instance = instance;
    EnableDpiAwareness();
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    Gdiplus::GdiplusStartupInput gdiplusInput;
    ULONG_PTR gdiplusToken = 0;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusInput, nullptr);
    HRESULT mediaFoundationResult = MFStartup(MF_VERSION);

    INITCOMMONCONTROLSEX controls = {};
    controls.dwSize = sizeof(INITCOMMONCONTROLSEX);
    controls.dwICC = ICC_WIN95_CLASSES | ICC_DATE_CLASSES | ICC_USEREX_CLASSES |
        ICC_COOL_CLASSES | ICC_BAR_CLASSES | ICC_TAB_CLASSES |
        ICC_TREEVIEW_CLASSES | ICC_LISTVIEW_CLASSES |
        ICC_PAGESCROLLER_CLASS | ICC_LINK_CLASS;
    InitCommonControlsEx(&controls);
    LoadLibraryW(L"Msftedit.dll");

    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.lpfnWndProc = LingWindowBase::WindowProc;
    windowClass.hInstance = instance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.hbrBackground = nullptr;
    windowClass.lpszClassName = GENERATED_WINDOW_CLASS;

    if (!RegisterClassExW(&windowClass)) { if (SUCCEEDED(mediaFoundationResult)) MFShutdown(); if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken); CoUninitialize(); return 0; }
    HWND startWindow = OpenGeneratedWindow(g_startWindowIndex, showCommand);

    MSG message;
    while (GetMessageW(&message, nullptr, 0, 0)) {
        HWND navigationRoot = message.hwnd ? GetAncestor(message.hwnd, GA_ROOT) : startWindow;
        LingWindowBase* messageOwner = LingWindowBase::FromMessageWindow(navigationRoot);
        if (messageOwner && messageOwner->PreTranslateKeyboardMessage(message)) continue;
        if (navigationRoot && IsWindow(navigationRoot) && IsDialogMessageW(navigationRoot, &message)) continue;
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
    if (SUCCEEDED(mediaFoundationResult)) MFShutdown();
    if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken);
#if LINGBUILDER_CEF3_AVAILABLE
    CefShutdown();
#endif
    CoUninitialize();
    return static_cast<int>(message.wParam);
}
