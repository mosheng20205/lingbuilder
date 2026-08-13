import { LingControl, LingWindowModel, LingWindowProject } from './types';
import {
  EplRuntimeEventRuleMap,
  getEplRuntimeEventRule,
  parseEplRuntimeEventRules
} from './eplToCppRules';
import { normalizeControlFont } from './controlFont';

export interface NativeProjectFile {
  relativePath: string;
  content: string;
}

export interface GeneratedNativeProject {
  files: NativeProjectFile[];
  selectedWindow: LingWindowModel;
}

export interface GenerateNativeWin32ProjectOptions {
  activeWindowId?: string;
  eplSourceCode?: string;
}

const TITLE_BAR_HEIGHT = 28;

export function generateNativeWin32Project(
  project: LingWindowProject,
  activeWindowIdOrOptions?: string | GenerateNativeWin32ProjectOptions
): GeneratedNativeProject {
  const options = typeof activeWindowIdOrOptions === 'string'
    ? { activeWindowId: activeWindowIdOrOptions }
    : activeWindowIdOrOptions || {};
  const activeWindowId = options.activeWindowId;
  const selectedWindow = project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  const eventRules = parseEplRuntimeEventRules(options.eplSourceCode);

  return {
    selectedWindow,
    files: [
      {
        relativePath: 'main.cpp',
        content: generateMainCpp(project, selectedWindow, eventRules)
      },
      {
        relativePath: 'layout.json',
        content: JSON.stringify(project, null, 2)
      },
      {
        relativePath: 'README.txt',
        content: [
          'LingBuilder Win32 native preview project',
          '',
          `Project: ${project.name}`,
          `Selected window: ${selectedWindow.title}`,
          `Window count: ${project.windows.length}`,
          '',
          'This folder is generated from the visual designer model.',
          'The native preview is DPI-aware and uses Win32 controls so the running window can follow the designer layout.',
          'Use the native menu "窗口" to open every window generated from the designer project.'
        ].join('\n')
      }
    ]
  };
}

function generateMainCpp(
  project: LingWindowProject,
  selectedWindow: LingWindowModel,
  eventRules: EplRuntimeEventRuleMap
): string {
  const selectedWindowIndex = Math.max(0, project.windows.findIndex(window => window.id === selectedWindow.id));
  const windowComment = project.windows
    .map(window => `// - ${escapeCppComment(window.title)} (${escapeCppComment(window.fileName)}), controls: ${window.controls.length}`)
    .join('\n');
  const controlArrays = project.windows
    .map((window, index) => generateControlArray(window, index, eventRules))
    .join('\n\n');
  const windowSpecs = project.windows
    .map((window, index) => generateWindowSpec(window, index))
    .join(',\n');

  return `#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>
#include <commctrl.h>
#include <gdiplus.h>
#include <algorithm>
#include <string>
#include <vector>
#include <cwchar>

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(linker, "/manifestdependency:\\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\\"")

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

static bool DrawAntiAliasedRoundedRectangle(HDC hdc, const RECT& rect, int radius, COLORREF fill, COLORREF border) {
    Gdiplus::Graphics graphics(hdc);
    if (graphics.GetLastStatus() != Gdiplus::Ok) return false;
    graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    graphics.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
    Gdiplus::RectF bounds(static_cast<Gdiplus::REAL>(rect.left) + 0.5f, static_cast<Gdiplus::REAL>(rect.top) + 0.5f,
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.right - rect.left) - 1.0f),
        std::max(0.0f, static_cast<Gdiplus::REAL>(rect.bottom - rect.top) - 1.0f));
    Gdiplus::GraphicsPath path;
    AddRoundedRectanglePath(path, bounds, static_cast<float>(radius));
    Gdiplus::SolidBrush brush(ToGdiPlusColor(fill));
    graphics.FillPath(&brush, &path);
    Gdiplus::Pen pen(ToGdiPlusColor(border), 1.0f);
    graphics.DrawPath(&pen, &path);
    return true;
}

struct ControlSpec {
    int id;
    const wchar_t* type;
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
    COLORREF background;
    COLORREF foreground;
    bool enabled;
    int progress;
    const wchar_t* handler;
    const wchar_t* handlerMessage;
    const wchar_t* handlerTitle;
    UINT handlerFlags;
    const wchar_t* handlerDebug;
    bool closeWindowOnConfirm;
};

struct WindowSpec {
    int index;
    const wchar_t* title;
    int width;
    int height;
    COLORREF background;
    const wchar_t* iconStyle;
    const wchar_t* iconPath;
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
    bool resizable;
    bool maximizable;
};

struct RuntimeControl {
    int id;
    HFONT font;
    HBRUSH brush;
};

struct WindowState {
    const WindowSpec* spec;
    std::vector<RuntimeControl> runtimeControls;
    HBRUSH windowBrush;
    HBRUSH menuBrush;
    HFONT menuFont;
    HICON largeIcon;
    HICON smallIcon;
    bool ownsIcons;
    UINT dpi;
};

static HINSTANCE g_instance = nullptr;
static int g_openWindowCount = 0;
static const UINT MENU_WINDOW_BASE = 40000;
static const wchar_t* GENERATED_WINDOW_CLASS = L"LingBuilderGeneratedWindowClass";

// LingBuilder generated window set:
${windowComment}

${controlArrays}

static WindowSpec g_windows[] = {
${windowSpecs}
};

static const int g_windowCount = static_cast<int>(sizeof(g_windows) / sizeof(g_windows[0]));
static const int g_startWindowIndex = ${selectedWindowIndex};

static WindowState* GetState(HWND hwnd) {
    return reinterpret_cast<WindowState*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
}

static void EnableDpiAwareness() {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (!user32) {
        return;
    }

    using SetProcessDpiAwarenessContextProc = BOOL (WINAPI*)(DPI_AWARENESS_CONTEXT);
    auto setDpiAwarenessContext = reinterpret_cast<SetProcessDpiAwarenessContextProc>(
        GetProcAddress(user32, "SetProcessDpiAwarenessContext")
    );
    if (setDpiAwarenessContext && setDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
        return;
    }

    using SetProcessDPIAwareProc = BOOL (WINAPI*)();
    auto setProcessDpiAware = reinterpret_cast<SetProcessDPIAwareProc>(
        GetProcAddress(user32, "SetProcessDPIAware")
    );
    if (setProcessDpiAware) {
        setProcessDpiAware();
    }
}

static UINT GetSystemDpiValue() {
    HDC hdc = GetDC(nullptr);
    UINT dpi = hdc ? static_cast<UINT>(GetDeviceCaps(hdc, LOGPIXELSX)) : 96;
    if (hdc) {
        ReleaseDC(nullptr, hdc);
    }
    return dpi ? dpi : 96;
}

static UINT GetWindowDpiValue(HWND hwnd) {
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (user32) {
        using GetDpiForWindowProc = UINT (WINAPI*)(HWND);
        auto getDpiForWindow = reinterpret_cast<GetDpiForWindowProc>(
            GetProcAddress(user32, "GetDpiForWindow")
        );
        if (getDpiForWindow) {
            UINT dpi = getDpiForWindow(hwnd);
            if (dpi) {
                return dpi;
            }
        }
    }
    return GetSystemDpiValue();
}

static int ScaleForDpi(int value, UINT dpi) {
    return MulDiv(value, static_cast<int>(dpi ? dpi : 96), 96);
}

static RECT GetWindowRectForSpec(const WindowSpec& spec, UINT dpi) {
    RECT rect = {
        0,
        0,
        ScaleForDpi(spec.width, dpi),
        ScaleForDpi(spec.height, dpi)
    };
    DWORD windowStyle = WS_OVERLAPPEDWINDOW;
    if (!spec.resizable) windowStyle &= ~WS_THICKFRAME;
    if (!spec.maximizable) windowStyle &= ~WS_MAXIMIZEBOX;
    AdjustWindowRectEx(&rect, windowStyle, TRUE, 0);
    return rect;
}

static HFONT CreateControlFont(const wchar_t* family, int cssPx, bool bold, bool italic, bool underline, UINT dpi);

static HMENU CreateGeneratedMenu(int activeWindowIndex, HBRUSH& menuBrush, HFONT& menuFont, UINT dpi) {
    HMENU rootMenu = CreateMenu();
    HMENU windowsMenu = CreatePopupMenu();
    const WindowSpec& spec = g_windows[activeWindowIndex];
    
    if (spec.menuItems != nullptr && spec.menuItems[0] != 0) {
        std::wstring itemsStr = spec.menuItems;
        size_t pos = 0;
        int idx = 0;
        while (true) {
            size_t nextPos = itemsStr.find(L',', pos);
            std::wstring item = (nextPos == std::wstring::npos) ? itemsStr.substr(pos) : itemsStr.substr(pos, nextPos - pos);
            size_t first = item.find_first_not_of(L" \\t\\r\\n");
            size_t last = item.find_last_not_of(L" \\t\\r\\n");
            if (first != std::wstring::npos && last != std::wstring::npos) {
                item = item.substr(first, last - first + 1);
            }
            if (!item.empty()) {
                AppendMenuW(windowsMenu, MF_OWNERDRAW, 50000 + idx, reinterpret_cast<LPCWSTR>(static_cast<ULONG_PTR>(idx + 1)));
                idx++;
            }
            if (nextPos == std::wstring::npos) break;
            pos = nextPos + 1;
        }
    } else {
        for (int i = 0; i < g_windowCount; ++i) {
            UINT flags = MF_OWNERDRAW;
            if (i == activeWindowIndex) {
                flags |= MF_CHECKED;
            }
            AppendMenuW(windowsMenu, flags, MENU_WINDOW_BASE + i, reinterpret_cast<LPCWSTR>(static_cast<ULONG_PTR>(i + 1)));
        }
    }
    
    AppendMenuW(rootMenu, MF_POPUP | MF_OWNERDRAW, reinterpret_cast<UINT_PTR>(windowsMenu), reinterpret_cast<LPCWSTR>(L"窗口"));
    menuFont = CreateControlFont(spec.menuFontFamily, spec.menuFontSize, spec.menuFontBold, spec.menuFontItalic, spec.menuFontUnderline, dpi);
    menuBrush = CreateSolidBrush(spec.menuBackground);
    if (menuBrush) {
        MENUINFO menuInfo = {};
        menuInfo.cbSize = sizeof(menuInfo);
        menuInfo.fMask = MIM_BACKGROUND;
        menuInfo.hbrBack = menuBrush;
        SetMenuInfo(rootMenu, &menuInfo);
        SetMenuInfo(windowsMenu, &menuInfo);
    }
    return rootMenu;
}

static std::wstring GetGeneratedMenuItemText(const WindowState& state, UINT itemId) {
    if (itemId >= 50000 && itemId < 50100) {
        std::wstring items = state.spec->menuItems ? state.spec->menuItems : L"";
        int target = static_cast<int>(itemId) - 50000;
        int index = 0;
        size_t pos = 0;
        while (pos <= items.size()) {
            size_t next = items.find(L',', pos);
            std::wstring text = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            size_t first = text.find_first_not_of(L" \\t\\r\\n");
            size_t last = text.find_last_not_of(L" \\t\\r\\n");
            text = first == std::wstring::npos ? L"" : text.substr(first, last - first + 1);
            if (!text.empty() && index++ == target) return text;
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        return L"";
    }
    if (itemId >= MENU_WINDOW_BASE && itemId < MENU_WINDOW_BASE + static_cast<UINT>(g_windowCount)) {
        return g_windows[itemId - MENU_WINDOW_BASE].title;
    }
    return L"窗口";
}

static void PaintGeneratedMenuItem(const WindowState& state, DRAWITEMSTRUCT* item) {
    if (!item || item->CtlType != ODT_MENU || !item->itemData || !state.menuBrush) return;
    std::wstring text = GetGeneratedMenuItemText(state, item->itemID);
    FillRect(item->hDC, &item->rcItem, state.menuBrush);
    if ((item->itemState & (ODS_SELECTED | ODS_HOTLIGHT)) != 0) {
        COLORREF base = state.spec->menuBackground;
        HBRUSH hoverBrush = CreateSolidBrush(RGB(
            std::min(255, static_cast<int>(GetRValue(base)) + 28),
            std::min(255, static_cast<int>(GetGValue(base)) + 28),
            std::min(255, static_cast<int>(GetBValue(base)) + 28)));
        FillRect(item->hDC, &item->rcItem, hoverBrush);
        DeleteObject(hoverBrush);
    }
    SetBkMode(item->hDC, TRANSPARENT);
    SetTextColor(item->hDC, state.spec->menuForeground);
    HGDIOBJ oldFont = state.menuFont ? SelectObject(item->hDC, state.menuFont) : nullptr;
    RECT textRect = item->rcItem;
    textRect.left += ScaleForDpi(8, state.dpi);
    textRect.right -= ScaleForDpi(8, state.dpi);
    DrawTextW(item->hDC, text.c_str(), -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    if (oldFont) SelectObject(item->hDC, oldFont);
}

static void PaintGeneratedMenuBar(HWND hwnd, const WindowState& state) {
    HMENU menu = GetMenu(hwnd);
    if (!menu || !state.menuBrush) return;
    MENUBARINFO info = {};
    info.cbSize = sizeof(info);
    if (!GetMenuBarInfo(hwnd, OBJID_MENU, 0, &info)) return;
    RECT windowRect = {};
    if (!GetWindowRect(hwnd, &windowRect)) return;
    RECT barRect = info.rcBar;
    OffsetRect(&barRect, -windowRect.left, -windowRect.top);
    POINT clientOrigin = { 0, 0 };
    if (ClientToScreen(hwnd, &clientOrigin)) {
        barRect.bottom = std::max(barRect.bottom, clientOrigin.y - windowRect.top);
    }
    HDC hdc = GetWindowDC(hwnd);
    if (!hdc) return;
    FillRect(hdc, &barRect, state.menuBrush);
    int count = GetMenuItemCount(menu);
    for (int position = 0; position < count; ++position) {
        RECT itemRect = {};
        if (!GetMenuItemRect(hwnd, menu, position, &itemRect)) continue;
        OffsetRect(&itemRect, -windowRect.left, -windowRect.top);
        DRAWITEMSTRUCT item = {};
        item.CtlType = ODT_MENU;
        item.itemID = static_cast<UINT>(-1);
        item.itemState = (GetMenuState(menu, position, MF_BYPOSITION) & MF_HILITE) ? ODS_SELECTED : 0;
        item.hDC = hdc;
        item.rcItem = itemRect;
        item.itemData = reinterpret_cast<ULONG_PTR>(L"窗口");
        PaintGeneratedMenuItem(state, &item);
    }
    ReleaseDC(hwnd, hdc);
}

static HWND OpenGeneratedWindow(int windowIndex, int showCommand);

static void ApplyGeneratedWindowIcon(HWND hwnd, WindowState& state) {
    if (!hwnd || !state.spec || std::wcscmp(state.spec->iconStyle, L"none") == 0) return;
    if (std::wcscmp(state.spec->iconStyle, L"custom") == 0 && state.spec->iconPath && state.spec->iconPath[0]) {
        state.largeIcon = reinterpret_cast<HICON>(LoadImageW(nullptr, state.spec->iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
        state.smallIcon = reinterpret_cast<HICON>(LoadImageW(nullptr, state.spec->iconPath, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_LOADFROMFILE | LR_DEFAULTCOLOR));
        state.ownsIcons = true;
    } else {
        state.largeIcon = LoadIconW(nullptr, IDI_APPLICATION);
        state.smallIcon = state.largeIcon;
    }
    if (state.largeIcon) SendMessageW(hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(state.largeIcon));
    if (state.smallIcon) SendMessageW(hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(state.smallIcon));
}

static bool IsType(const ControlSpec& control, const wchar_t* type) {
    return std::wcscmp(control.type, type) == 0;
}

static const ControlSpec* FindControl(const WindowSpec& spec, int id) {
    for (int i = 0; i < spec.controlCount; ++i) {
        if (spec.controls[i].id == id) {
            return &spec.controls[i];
        }
    }
    return nullptr;
}

static RuntimeControl* FindRuntimeControl(WindowState& state, int id) {
    for (auto& control : state.runtimeControls) {
        if (control.id == id) {
            return &control;
        }
    }
    return nullptr;
}

static HFONT CreateControlFont(const wchar_t* family, int cssPx, bool bold, bool italic, bool underline, UINT dpi) {
    int height = -MulDiv(cssPx, static_cast<int>(dpi ? dpi : 96), 96);
    return CreateFontW(
        height,
        0,
        0,
        0,
        bold ? FW_BOLD : FW_NORMAL,
        italic ? TRUE : FALSE,
        underline ? TRUE : FALSE,
        FALSE,
        DEFAULT_CHARSET,
        OUT_DEFAULT_PRECIS,
        CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY,
        DEFAULT_PITCH | FF_SWISS,
        family && family[0] ? family : L"Microsoft YaHei UI"
    );
}

static void ShowGeneratedEvent(HWND hwnd, const ControlSpec& control) {
    if (control.handler == nullptr || control.handler[0] == 0) {
        return;
    }

    bool hasDebug = (control.handlerDebug != nullptr && control.handlerDebug[0] != 0);
    if (hasDebug) {
        OutputDebugStringW(control.handlerDebug);
        OutputDebugStringW(L"\\n");
        
        int size_needed = WideCharToMultiByte(CP_UTF8, 0, control.handlerDebug, -1, NULL, 0, NULL, NULL);
        if (size_needed > 0) {
            std::vector<char> utf8_str(size_needed);
            WideCharToMultiByte(CP_UTF8, 0, control.handlerDebug, -1, &utf8_str[0], size_needed, NULL, NULL);
            std::printf("[调试输出] %s\\n", &utf8_str[0]);
            std::fflush(stdout);
        }
    }

    if (control.handlerMessage != nullptr && control.handlerMessage[0] != 0) {
        int result = MessageBoxW(
            hwnd,
            control.handlerMessage,
            (control.handlerTitle != nullptr && control.handlerTitle[0] != 0) ? control.handlerTitle : L"LingBuilder 运行时事件",
            control.handlerFlags
        );
        if (control.closeWindowOnConfirm && result == IDYES) {
            DestroyWindow(hwnd);
        }
        return;
    }

    if (hasDebug) {
        return;
    }

    std::wstring message = L"已触发中文事件处理器：";
    message += control.handler;
    message += L"\\n\\n控件：";
    message += control.text;
    MessageBoxW(hwnd, message.c_str(), L"LingBuilder 运行时事件", MB_OK | MB_ICONINFORMATION);
}

static void ShowGeneratedEvent_OLD_UNUSED(HWND hwnd, const ControlSpec& control) {
    if (control.handler == nullptr || control.handler[0] == 0) {
        return;
    }

    if (control.handlerDebug != nullptr && control.handlerDebug[0] != 0) {
        OutputDebugStringW(control.handlerDebug);
        OutputDebugStringW(L"\\n");
    }

    if (control.handlerMessage != nullptr && control.handlerMessage[0] != 0) {
        int result = MessageBoxW(
            hwnd,
            control.handlerMessage,
            (control.handlerTitle != nullptr && control.handlerTitle[0] != 0) ? control.handlerTitle : L"LingBuilder 运行时事件",
            control.handlerFlags
        );
        if (control.closeWindowOnConfirm && result == IDYES) {
            DestroyWindow(hwnd);
        }
        return;
    }

    std::wstring message = L"已触发中文事件处理器：";
    message += control.handler;
    message += L"\\n\\n控件：";
    message += control.text;
    MessageBoxW(hwnd, message.c_str(), L"LingBuilder 运行时事件", MB_OK | MB_ICONINFORMATION);
}

static HWND CreateGeneratedControl(HWND hwnd, WindowState& state, const ControlSpec& control) {
    DWORD style = WS_CHILD | WS_VISIBLE;
    DWORD exStyle = 0;
    const wchar_t* className = L"STATIC";
    const wchar_t* text = control.text;

    if (!control.enabled) {
        style |= WS_DISABLED;
    }

    if (IsType(control, L"Button")) {
        className = L"BUTTON";
        style |= BS_OWNERDRAW;
    } else if (IsType(control, L"TextBox")) {
        className = L"EDIT";
        style |= WS_BORDER | ES_AUTOHSCROLL;
        exStyle = WS_EX_CLIENTEDGE;
    } else if (IsType(control, L"Label")) {
        className = L"STATIC";
        style |= SS_LEFT | SS_NOPREFIX | SS_NOTIFY;
    } else if (IsType(control, L"CheckBox")) {
        className = L"BUTTON";
        style |= BS_OWNERDRAW;
    } else if (IsType(control, L"RadioButton")) {
        className = L"BUTTON";
        style |= BS_OWNERDRAW;
    } else if (IsType(control, L"ProgressBar")) {
        className = PROGRESS_CLASSW;
        text = L"";
    } else if (IsType(control, L"ComboBox")) {
        className = L"COMBOBOX";
        style |= CBS_DROPDOWNLIST | WS_VSCROLL;
    } else if (IsType(control, L"Image")) {
        className = L"STATIC";
        style |= SS_CENTER | SS_SUNKEN | SS_NOTIFY;
    }

    HWND child = CreateWindowExW(
        exStyle,
        className,
        text,
        style,
        ScaleForDpi(control.x, state.dpi),
        ScaleForDpi(control.y, state.dpi),
        ScaleForDpi(control.width, state.dpi),
        ScaleForDpi(control.height, state.dpi),
        hwnd,
        reinterpret_cast<HMENU>(static_cast<INT_PTR>(control.id)),
        GetModuleHandleW(nullptr),
        nullptr
    );

    if (!child) {
        return nullptr;
    }

    HFONT font = CreateControlFont(control.fontFamily, control.fontSize, control.fontBold, control.fontItalic, control.fontUnderline, state.dpi);
    HBRUSH brush = CreateSolidBrush(control.background);
    state.runtimeControls.push_back({ control.id, font, brush });

    if (font) {
        SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
    }

    if (IsType(control, L"ProgressBar")) {
        SendMessageW(child, PBM_SETRANGE, 0, MAKELPARAM(0, 100));
        SendMessageW(child, PBM_SETPOS, control.progress, 0);
        SendMessageW(child, PBM_SETBARCOLOR, 0, control.foreground);
        SendMessageW(child, PBM_SETBKCOLOR, 0, control.background);
    } else if (IsType(control, L"ComboBox")) {
        SendMessageW(child, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(control.text));
        SendMessageW(child, CB_SETCURSEL, 0, 0);
    }

    return child;
}

static void DestroyGeneratedControls(HWND hwnd, WindowState& state) {
    HWND child = GetWindow(hwnd, GW_CHILD);
    while (child) {
        HWND next = GetWindow(child, GW_HWNDNEXT);
        DestroyWindow(child);
        child = next;
    }

    for (auto& control : state.runtimeControls) {
        if (control.font) {
            DeleteObject(control.font);
        }
        if (control.brush) {
            DeleteObject(control.brush);
        }
    }
    state.runtimeControls.clear();
}

static void RebuildGeneratedControls(HWND hwnd, WindowState& state) {
    for (int i = 0; i < state.spec->controlCount; ++i) {
        CreateGeneratedControl(hwnd, state, state.spec->controls[i]);
    }
}

static void PaintOwnerButton(const DRAWITEMSTRUCT* item, WindowState& state) {
    const ControlSpec* control = FindControl(*state.spec, static_cast<int>(item->CtlID));
    if (!control) {
        return;
    }

    RuntimeControl* runtime = FindRuntimeControl(state, static_cast<int>(item->CtlID));
    HFONT oldFont = nullptr;
    if (runtime && runtime->font) {
        oldFont = reinterpret_cast<HFONT>(SelectObject(item->hDC, runtime->font));
    }

    if (IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton")) {
        HBRUSH backgroundBrush = CreateSolidBrush(control->background);
        FillRect(item->hDC, &item->rcItem, backgroundBrush);
        DeleteObject(backgroundBrush);

        int boxSize = ScaleForDpi(14, state.dpi);
        int boxLeft = item->rcItem.left;
        int boxTop = item->rcItem.top + ((item->rcItem.bottom - item->rcItem.top - boxSize) / 2);
        RECT boxRect = { boxLeft, boxTop, boxLeft + boxSize, boxTop + boxSize };

        HBRUSH boxBrush = CreateSolidBrush(RGB(17, 24, 39));
        HPEN borderPen = CreatePen(PS_SOLID, 1, control->enabled ? RGB(100, 116, 139) : RGB(70, 70, 78));
        HGDIOBJ oldBrush = SelectObject(item->hDC, boxBrush);
        HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);

        if (IsType(*control, L"RadioButton")) {
            Ellipse(item->hDC, boxRect.left, boxRect.top, boxRect.right, boxRect.bottom);
            int inset = ScaleForDpi(4, state.dpi);
            HBRUSH dotBrush = CreateSolidBrush(control->enabled ? control->foreground : RGB(170, 170, 176));
            SelectObject(item->hDC, dotBrush);
            Ellipse(item->hDC, boxRect.left + inset, boxRect.top + inset, boxRect.right - inset, boxRect.bottom - inset);
            DeleteObject(dotBrush);
        } else {
            Rectangle(item->hDC, boxRect.left, boxRect.top, boxRect.right, boxRect.bottom);
            HPEN checkPen = CreatePen(PS_SOLID, ScaleForDpi(2, state.dpi), control->enabled ? control->foreground : RGB(170, 170, 176));
            SelectObject(item->hDC, checkPen);
            MoveToEx(item->hDC, boxRect.left + ScaleForDpi(3, state.dpi), boxRect.top + ScaleForDpi(7, state.dpi), nullptr);
            LineTo(item->hDC, boxRect.left + ScaleForDpi(6, state.dpi), boxRect.top + ScaleForDpi(10, state.dpi));
            LineTo(item->hDC, boxRect.right - ScaleForDpi(3, state.dpi), boxRect.top + ScaleForDpi(4, state.dpi));
            DeleteObject(checkPen);
        }

        SelectObject(item->hDC, oldBrush);
        SelectObject(item->hDC, oldPen);
        DeleteObject(boxBrush);
        DeleteObject(borderPen);

        RECT textRect = item->rcItem;
        textRect.left = boxRect.right + ScaleForDpi(8, state.dpi);
        SetBkMode(item->hDC, TRANSPARENT);
        SetTextColor(item->hDC, control->enabled ? control->foreground : RGB(170, 170, 176));
        DrawTextW(item->hDC, control->text, -1, &textRect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);

        if ((item->itemState & ODS_FOCUS) == ODS_FOCUS) {
            DrawFocusRect(item->hDC, &item->rcItem);
        }

        if (oldFont) {
            SelectObject(item->hDC, oldFont);
        }
        return;
    }

    HBRUSH cornerBrush = CreateSolidBrush(state.spec->background);
    FillRect(item->hDC, &item->rcItem, cornerBrush);
    DeleteObject(cornerBrush);

    COLORREF fillColor = control->enabled ? control->background : RGB(80, 80, 86);
    COLORREF borderColor = control->enabled ? RGB(100, 116, 139) : RGB(70, 70, 78);
    int itemWidth = static_cast<int>(item->rcItem.right - item->rcItem.left);
    int itemHeight = static_cast<int>(item->rcItem.bottom - item->rcItem.top);
    int maxRadius = std::max(0, std::min(itemWidth, itemHeight) / 2);
    int radius = std::clamp(ScaleForDpi(control->cornerRadius, state.dpi), 0, maxRadius);
    if (!DrawAntiAliasedRoundedRectangle(item->hDC, item->rcItem, radius, fillColor, borderColor)) {
        HBRUSH fillBrush = CreateSolidBrush(fillColor);
        HPEN borderPen = CreatePen(PS_SOLID, 1, borderColor);
        HGDIOBJ oldBrush = SelectObject(item->hDC, fillBrush);
        HGDIOBJ oldPen = SelectObject(item->hDC, borderPen);
        if (radius == 0) Rectangle(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom);
        else RoundRect(item->hDC, item->rcItem.left, item->rcItem.top, item->rcItem.right, item->rcItem.bottom, radius * 2, radius * 2);
        SelectObject(item->hDC, oldPen);
        SelectObject(item->hDC, oldBrush);
        DeleteObject(borderPen);
        DeleteObject(fillBrush);
    }

    SetBkMode(item->hDC, TRANSPARENT);
    SetTextColor(item->hDC, control->enabled ? control->foreground : RGB(170, 170, 176));
    DrawTextW(item->hDC, control->text, -1, const_cast<RECT*>(&item->rcItem), DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);

    if ((item->itemState & ODS_FOCUS) == ODS_FOCUS) {
        DrawFocusRect(item->hDC, &item->rcItem);
    }

    if (oldFont) {
        SelectObject(item->hDC, oldFont);
    }
}

static LRESULT CALLBACK GeneratedWindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    WindowState* state = GetState(hwnd);

    switch (message) {
    case WM_NCCREATE: {
        auto createStruct = reinterpret_cast<CREATESTRUCTW*>(lParam);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(createStruct->lpCreateParams));
        return TRUE;
    }

    case WM_CREATE:
        state = GetState(hwnd);
        if (!state || !state->spec) {
            return -1;
        }
        state->dpi = GetWindowDpiValue(hwnd);
        state->windowBrush = CreateSolidBrush(state->spec->background);
        ++g_openWindowCount;
        RebuildGeneratedControls(hwnd, *state);
        return 0;

    case WM_NCPAINT: {
        LRESULT result = DefWindowProcW(hwnd, message, wParam, lParam);
        if (state) PaintGeneratedMenuBar(hwnd, *state);
        return result;
    }

    case WM_NCACTIVATE: {
        LRESULT result = DefWindowProcW(hwnd, message, wParam, lParam);
        if (state) PaintGeneratedMenuBar(hwnd, *state);
        return result;
    }

    case WM_MEASUREITEM: {
        auto item = reinterpret_cast<MEASUREITEMSTRUCT*>(lParam);
        if (state && item && item->CtlType == ODT_MENU && item->itemData) {
            HDC hdc = GetDC(hwnd);
            SIZE size = {};
            std::wstring text = GetGeneratedMenuItemText(*state, item->itemID);
            if (hdc) {
                HGDIOBJ oldFont = state->menuFont ? SelectObject(hdc, state->menuFont) : nullptr;
                GetTextExtentPoint32W(hdc, text.c_str(), static_cast<int>(text.size()), &size);
                if (oldFont) SelectObject(hdc, oldFont);
                ReleaseDC(hwnd, hdc);
            }
            item->itemWidth = static_cast<UINT>(size.cx + ScaleForDpi(16, state->dpi));
            item->itemHeight = static_cast<UINT>(std::max(static_cast<int>(size.cy) + ScaleForDpi(6, state->dpi), GetSystemMetrics(SM_CYMENU)));
            return TRUE;
        }
        break;
    }

    case WM_COMMAND: {
        int controlId = LOWORD(wParam);
        if (controlId >= 50000 && controlId < 50100) {
            if (state && state->spec) {
                const ControlSpec* control = FindControl(*state->spec, controlId);
                if (control) {
                    ShowGeneratedEvent(hwnd, *control);
                }
            }
            return 0;
        }
        if (controlId >= static_cast<int>(MENU_WINDOW_BASE) && controlId < static_cast<int>(MENU_WINDOW_BASE) + g_windowCount) {
            if (state && state->spec) {
                const ControlSpec* control = FindControl(*state->spec, controlId);
                if (control) {
                    ShowGeneratedEvent(hwnd, *control);
                }
            }
            OpenGeneratedWindow(controlId - static_cast<int>(MENU_WINDOW_BASE), SW_SHOWNORMAL);
            return 0;
        }

        if (!state || !state->spec) {
            return 0;
        }

        int notification = HIWORD(wParam);
        const ControlSpec* control = FindControl(*state->spec, controlId);
        if (!control) {
            return 0;
        }
        if ((IsType(*control, L"Button") && notification == BN_CLICKED) ||
            (IsType(*control, L"CheckBox") && notification == BN_CLICKED) ||
            (IsType(*control, L"RadioButton") && notification == BN_CLICKED) ||
            (IsType(*control, L"ComboBox") && notification == CBN_SELCHANGE) ||
            (IsType(*control, L"Label") && notification == STN_CLICKED) ||
            (IsType(*control, L"Image") && notification == STN_CLICKED)) {
            ShowGeneratedEvent(hwnd, *control);
        }
        return 0;
    }

    case WM_DRAWITEM:
        if (state) {
            auto item = reinterpret_cast<DRAWITEMSTRUCT*>(lParam);
            if (item && item->CtlType == ODT_MENU && item->itemData) {
                PaintGeneratedMenuItem(*state, item);
                return TRUE;
            }
            PaintOwnerButton(item, *state);
        }
        return TRUE;

    case WM_CTLCOLORSTATIC:
    case WM_CTLCOLORBTN:
    case WM_CTLCOLOREDIT: {
        if (!state || !state->spec) {
            return DefWindowProcW(hwnd, message, wParam, lParam);
        }

        HDC hdc = reinterpret_cast<HDC>(wParam);
        HWND child = reinterpret_cast<HWND>(lParam);
        int controlId = GetDlgCtrlID(child);
        const ControlSpec* control = FindControl(*state->spec, controlId);
        RuntimeControl* runtime = FindRuntimeControl(*state, controlId);

        if (control) {
            SetTextColor(hdc, control->foreground);
            SetBkColor(hdc, control->background);
            if (IsType(*control, L"Label") || IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton")) {
                SetBkMode(hdc, TRANSPARENT);
                return reinterpret_cast<LRESULT>(state->windowBrush);
            }
        }

        if (runtime && runtime->brush) {
            return reinterpret_cast<LRESULT>(runtime->brush);
        }
        return reinterpret_cast<LRESULT>(state->windowBrush);
    }

    case WM_DPICHANGED: {
        if (!state) {
            return 0;
        }

        state->dpi = HIWORD(wParam);
        auto suggestedRect = reinterpret_cast<RECT*>(lParam);
        if (suggestedRect) {
            SetWindowPos(
                hwnd,
                nullptr,
                suggestedRect->left,
                suggestedRect->top,
                suggestedRect->right - suggestedRect->left,
                suggestedRect->bottom - suggestedRect->top,
                SWP_NOZORDER | SWP_NOACTIVATE
            );
        }
        DestroyGeneratedControls(hwnd, *state);
        RebuildGeneratedControls(hwnd, *state);
        InvalidateRect(hwnd, nullptr, TRUE);
        return 0;
    }

    case WM_ERASEBKGND: {
        if (!state || !state->windowBrush) {
            return DefWindowProcW(hwnd, message, wParam, lParam);
        }
        HDC hdc = reinterpret_cast<HDC>(wParam);
        RECT rect;
        GetClientRect(hwnd, &rect);
        FillRect(hdc, &rect, state->windowBrush);
        return 1;
    }

    case WM_DESTROY:
        if (state) {
            DestroyGeneratedControls(hwnd, *state);
            if (state->windowBrush) {
                DeleteObject(state->windowBrush);
                state->windowBrush = nullptr;
            }
            if (state->menuBrush) {
                DeleteObject(state->menuBrush);
                state->menuBrush = nullptr;
            }
            if (state->menuFont) {
                DeleteObject(state->menuFont);
                state->menuFont = nullptr;
            }
            if (state->ownsIcons) {
                if (state->largeIcon) DestroyIcon(state->largeIcon);
                if (state->smallIcon && state->smallIcon != state->largeIcon) DestroyIcon(state->smallIcon);
            }
        }
        --g_openWindowCount;
        if (g_openWindowCount <= 0) {
            PostQuitMessage(0);
        }
        return 0;

    case WM_NCDESTROY:
        if (state) {
            delete state;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
        }
        break;
    }

    return DefWindowProcW(hwnd, message, wParam, lParam);
}

static HWND OpenGeneratedWindow(int windowIndex, int showCommand) {
    if (windowIndex < 0 || windowIndex >= g_windowCount) {
        return nullptr;
    }

    const WindowSpec& spec = g_windows[windowIndex];
    UINT dpi = GetSystemDpiValue();
    RECT rect = GetWindowRectForSpec(spec, dpi);
    DWORD windowStyle = WS_OVERLAPPEDWINDOW;
    if (!spec.resizable) windowStyle &= ~WS_THICKFRAME;
    if (!spec.maximizable) windowStyle &= ~WS_MAXIMIZEBOX;

    auto state = new WindowState();
    state->spec = &spec;
    state->windowBrush = nullptr;
    state->menuBrush = nullptr;
    state->menuFont = nullptr;
    state->largeIcon = nullptr;
    state->smallIcon = nullptr;
    state->ownsIcons = false;
    state->dpi = dpi;

    HWND hwnd = CreateWindowExW(
        0,
        GENERATED_WINDOW_CLASS,
        spec.title,
        windowStyle,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        rect.right - rect.left,
        rect.bottom - rect.top,
        nullptr,
        CreateGeneratedMenu(spec.index, state->menuBrush, state->menuFont, state->dpi),
        g_instance,
        state
    );

    if (!hwnd) {
        if (state->menuBrush) DeleteObject(state->menuBrush);
        if (state->menuFont) DeleteObject(state->menuFont);
        delete state;
        return nullptr;
    }

    SetWindowTextW(hwnd, spec.title);
    ApplyGeneratedWindowIcon(hwnd, *state);
    ShowWindow(hwnd, showCommand);
    UpdateWindow(hwnd);
    return hwnd;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
    g_instance = instance;
    EnableDpiAwareness();
    Gdiplus::GdiplusStartupInput gdiplusInput;
    ULONG_PTR gdiplusToken = 0;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusInput, nullptr);

    INITCOMMONCONTROLSEX controls;
    controls.dwSize = sizeof(INITCOMMONCONTROLSEX);
    controls.dwICC = ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&controls);

    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.lpfnWndProc = GeneratedWindowProc;
    windowClass.hInstance = instance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.hbrBackground = nullptr;
    windowClass.lpszClassName = GENERATED_WINDOW_CLASS;

    if (!RegisterClassExW(&windowClass)) {
        if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken);
        return 0;
    }

    OpenGeneratedWindow(g_startWindowIndex, showCommand);

    MSG message;
    while (GetMessageW(&message, nullptr, 0, 0)) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }

    if (gdiplusToken) Gdiplus::GdiplusShutdown(gdiplusToken);
    return static_cast<int>(message.wParam);
}
`;
}

function generateControlArray(
  window: LingWindowModel,
  windowIndex: number,
  eventRules: EplRuntimeEventRuleMap
): string {
  const visibleControls = [...getVisibleControls(window)];
  
  if ((window as any).menuEvents && (window as any).menuEvents['Select']?.trim()) {
    visibleControls.push({
      id: `__virtual_menu_bar_${windowIndex}`,
      type: 'MenuBar' as any,
      name: (window as any).menuName || '窗口菜单栏',
      content: '窗口菜单',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fontSize: 12,
      background: '#ffffff',
      foreground: '#000000',
      isEnabled: true,
      visibility: 'Visible',
      events: { 'Select': (window as any).menuEvents['Select'] }
    });
  }

  const items = ((window as any).menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  items.forEach((item, idx) => {
    const handler = (window as any).menuEvents?.[`Item_${idx}`] || `_${window.className}_${item}_被选择`;
    visibleControls.push({
      id: `__virtual_menu_item_${windowIndex}_${idx}`,
      type: 'MenuItem' as any,
      name: item,
      content: item,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fontSize: 12,
      background: '#ffffff',
      foreground: '#000000',
      isEnabled: true,
      visibility: 'Visible',
      events: { 'Select': handler }
    });
  });

  const controls = visibleControls
    .map((control, index) => {
      let id = index + 1001;
      if (control.id.startsWith('__virtual_menu_bar_')) {
        id = 40000 + windowIndex;
      } else if (control.id.startsWith('__virtual_menu_item_')) {
        const parts = control.id.split('_');
        const idx = parseInt(parts[parts.length - 1], 10);
        id = 50000 + idx;
      }
      return generateControlSpec(control, id, eventRules);
    })
    .join(',\n') || '    { 0, L"", L"", 0, 0, 0, 0, 12, RGB(0, 0, 0), RGB(0, 0, 0), true, 0, L"", L"", L"", MB_OK, L"", false }';

  return `static ControlSpec g_controls_${windowIndex}[] = {
${controls}
};`;
}

function generateWindowSpec(window: LingWindowModel, windowIndex: number): string {
  const items = ((window as any).menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const visibleCount = getVisibleControls(window).length + 
    (((window as any).menuEvents && (window as any).menuEvents['Select']?.trim()) ? 1 : 0) +
    items.length;

  const menuItemsStr = (window as any).menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件';
  const iconStyle = window.iconStyle || 'lingbuilder';
  const normalizedIconPath = window.iconPath?.trim().replace(/\\/gu, '/') || '';
  const iconPath = iconStyle === 'custom'
    && normalizedIconPath.startsWith('assets/')
    && normalizedIconPath.toLowerCase().endsWith('.ico')
    && !normalizedIconPath.split('/').includes('..')
    ? normalizedIconPath
    : '';
  const menuFont = normalizeControlFont({
    fontFamily: window.menuFontFamily,
    fontSize: window.menuFontSize ?? 11,
    fontBold: window.menuFontBold,
    fontItalic: window.menuFontItalic,
    fontUnderline: window.menuFontUnderline
  });
  return `    { ${windowIndex}, L"${escapeWideString(window.title)}", ${Math.max(360, window.width)}, ${Math.max(220, window.height - TITLE_BAR_HEIGHT)}, ${toColorRef(window.background)}, L"${escapeWideString(iconStyle)}", L"${escapeWideString(iconPath)}", g_controls_${windowIndex}, ${visibleCount}, L"${escapeWideString(menuItemsStr)}", ${toColorRef(window.menuBackground || '#ffffff')}, ${toColorRef(window.menuForeground || '#000000')}, L"${escapeWideString(menuFont.family)}", ${menuFont.size}, ${menuFont.bold}, ${menuFont.italic}, ${menuFont.underline}, ${window.resizable !== false}, ${window.maximizable !== false} }`;
}

function generateControlSpec(control: LingControl, id: number, eventRules: EplRuntimeEventRuleMap): string {
  const handler = Object.values(control.events || {}).find(value => value.trim()) || '';
  const eventRule = handler ? getEplRuntimeEventRule(eventRules, handler) : undefined;
  const messageBox = eventRule?.messageBox;
  const debugText = eventRule?.debugOutputs.join('\n') || '';
  const background = control.background === 'transparent' ? '#1E1E24' : control.background;

  const cornerRadius = control.type === 'Button' ? clampInteger(control.properties?.cornerRadius, 6, 0, 100) : 0;
  const font = normalizeControlFont(control);
  return `    { ${id}, L"${control.type}", L"${escapeWideString(control.content)}", ${int(control.x)}, ${int(control.y)}, ${int(control.width)}, ${int(control.height)}, ${font.size}, L"${escapeWideString(font.family)}", ${font.bold ? 'true' : 'false'}, ${font.italic ? 'true' : 'false'}, ${font.underline ? 'true' : 'false'}, ${cornerRadius}, ${toColorRef(background)}, ${toColorRef(control.foreground)}, ${control.isEnabled ? 'true' : 'false'}, ${parseProgress(control)}, L"${escapeWideString(handler)}", L"${escapeWideString(messageBox?.text || '')}", L"${escapeWideString(messageBox?.title || '')}", ${messageBox?.cppFlagsExpression || 'MB_OK'}, L"${escapeWideString(debugText)}", ${eventRule?.closesWindowOnConfirm ? 'true' : 'false'} }`;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function getVisibleControls(window: LingWindowModel): LingControl[] {
  return window.controls.filter(control => control.visibility === 'Visible');
}

function parseProgress(control: LingControl): number {
  if (control.type !== 'ProgressBar') {
    return 0;
  }
  const value = Number.parseInt(control.content, 10);
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function toColorRef(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return 'RGB(30, 30, 36)';
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `RGB(${r}, ${g}, ${b})`;
}

function escapeWideString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function escapeCppComment(value: string): string {
  return value.replace(/\r?\n/g, ' ');
}

function int(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}
