import { LingControl, LingWindowModel, LingWindowProject } from './types';
import { getLingWindowSourceFileName } from './windowDesignerService';
import { findLingCppMethod, parseLingCpp } from '../lingCpp/parser';
import {
  LingCppAst,
  LingCppClass,
  LingCppMethod,
  LingCppNativeSourceMapEntry,
  LingCppParameter,
  LingCppProgram,
  LingCppStatement
} from '../lingCpp/types';
import { InstalledModule } from '../modules/types';

export interface LingCppNativeProjectFile {
  relativePath: string;
  content: string;
}

export interface GeneratedLingCppNativeProject {
  files: LingCppNativeProjectFile[];
  selectedWindow: LingWindowModel;
  diagnostics: string[];
  sourceMap: LingCppNativeSourceMapEntry[];
}

export interface GenerateLingCppNativeWin32ProjectOptions {
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  enabledModules?: InstalledModule[];
}

interface GeneratedWindowClassBlock {
  code: string;
  sourceMap: LingCppNativeSourceMapEntry[];
}

interface TranslatedStatementLine {
  code: string;
  sourceStartLine: number;
  sourceEndLine: number;
  kind: 'statement' | 'native-cpp';
}

const TITLE_BAR_HEIGHT = 28;

export function generateLingCppNativeWin32Project(
  project: LingWindowProject,
  options: GenerateLingCppNativeWin32ProjectOptions = {}
): GeneratedLingCppNativeProject {
  const selectedWindow = project.windows.find(window => window.id === options.activeWindowId) || project.windows[0];
  const sourceCode = options.lingCppSourceCode || '';
  const parseResult = parseLingCpp(sourceCode);
  const enabledModules = options.enabledModules || [];
  const sourceFilePath = options.lingCppSourceFilePath || getLingWindowSourceFileName(selectedWindow.fileName, selectedWindow.className);
  const mainCppContent = generateMainCpp(project, selectedWindow, parseResult.ast, enabledModules);
  const sourceMap = generateLingCppNativeSourceMap(mainCppContent, project, parseResult.program, sourceFilePath);
  const manifestContent = generateNativeManifest(project, selectedWindow, enabledModules, sourceFilePath, sourceMap);

  return {
    selectedWindow,
    diagnostics: parseResult.diagnostics.map(diagnostic => `第 ${diagnostic.line} 行：${diagnostic.message}`),
    sourceMap,
    files: [
      {
        relativePath: 'main.cpp',
        content: mainCppContent
      },
      {
        relativePath: 'layout.json',
        content: JSON.stringify(project, null, 2)
      },
      {
        relativePath: 'module-dependencies.txt',
        content: generateModuleDependencyReport(enabledModules)
      },
      {
        relativePath: 'README.txt',
        content: [
          'LingBuilder Chinese C++ Win32 project',
          '',
          `Project: ${project.name}`,
          `Selected window: ${selectedWindow.title}`,
          `Window count: ${project.windows.length}`,
          '',
          'This folder is generated from .lcpp source and the visual designer model.',
          'The generated main.cpp uses C++ classes for windows and dispatches UI events to class methods.'
        ].join('\n')
      },
      {
        relativePath: 'lingbuilder-native-manifest.json',
        content: manifestContent
      }
    ]
  };
}

function generateMainCpp(
  project: LingWindowProject,
  selectedWindow: LingWindowModel,
  ast: LingCppAst,
  enabledModules: InstalledModule[] = []
): string {
  const program = ast.program;
  const selectedWindowIndex = Math.max(0, project.windows.findIndex(window => window.id === selectedWindow.id));
  const controlArrays = project.windows
    .map((window, index) => generateControlArray(window, index, program))
    .join('\n\n');
  const windowSpecs = project.windows
    .map((window, index) => generateWindowSpec(window, index))
    .join(',\n');
  const classDefinitions = project.windows
    .map((window, index) => generateWindowClass(window, index, program))
    .join('\n\n');
  const factoryCases = project.windows
    .map((window, index) => `    case ${index}: return new ${toCppIdentifier(window.className)}(g_windows[${index}]);`)
    .join('\n');
  const moduleCppPreamble = generateModuleCppPreamble(enabledModules);

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
#include <cstdio>
#include <cwchar>
#include <string>
#include <vector>

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

#pragma comment(lib, "comctl32.lib")
#pragma comment(linker, "/manifestdependency:\\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\\"")
${moduleCppPreamble}

struct ControlSpec {
    int id;
    const wchar_t* type;
    const wchar_t* text;
    int x;
    int y;
    int width;
    int height;
    int fontSize;
    COLORREF background;
    COLORREF foreground;
    bool enabled;
    int progress;
    const wchar_t* handler;
};

struct WindowSpec {
    int index;
    const wchar_t* className;
    const wchar_t* title;
    int width;
    int height;
    COLORREF background;
    const ControlSpec* controls;
    int controlCount;
    const wchar_t* menuItems;
};

struct RuntimeControl {
    int id;
    HFONT font;
    HBRUSH brush;
};

static HINSTANCE g_instance = nullptr;
static int g_openWindowCount = 0;
static const wchar_t* GENERATED_WINDOW_CLASS = L"LingBuilderChineseCppWindowClass";

${controlArrays}

static WindowSpec g_windows[] = {
${windowSpecs}
};

static const int g_windowCount = static_cast<int>(sizeof(g_windows) / sizeof(g_windows[0]));
static const int g_startWindowIndex = ${selectedWindowIndex};

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

static HFONT CreateControlFont(int cssPx, UINT dpi) {
    return CreateFontW(
        -MulDiv(cssPx, static_cast<int>(dpi ? dpi : 96), 96),
        0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
        DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI"
    );
}

static bool IsType(const ControlSpec& control, const wchar_t* type) {
    return std::wcscmp(control.type, type) == 0;
}

class LingWindowBase {
public:
    explicit LingWindowBase(const WindowSpec& spec) : spec_(spec), hwnd_(nullptr), windowBrush_(nullptr), dpi_(96) {}
    virtual ~LingWindowBase() = default;

    HWND Open(int showCommand) {
        dpi_ = GetSystemDpiValue();
        RECT rect = { 0, 0, ScaleForDpi(spec_.width, dpi_), ScaleForDpi(spec_.height, dpi_) };
        AdjustWindowRectEx(&rect, WS_OVERLAPPEDWINDOW, TRUE, 0);

        hwnd_ = CreateWindowExW(
            0,
            GENERATED_WINDOW_CLASS,
            spec_.title,
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            rect.right - rect.left,
            rect.bottom - rect.top,
            nullptr,
            CreateMenuForWindow(),
            g_instance,
            this
        );

        if (!hwnd_) return nullptr;
        ShowWindow(hwnd_, showCommand);
        UpdateWindow(hwnd_);
        return hwnd_;
    }

protected:
    const WindowSpec& spec_;
    HWND hwnd_;
    std::vector<RuntimeControl> runtimeControls_;
    HBRUSH windowBrush_;
    UINT dpi_;

    virtual void OnWindowCreated() {}

    virtual void DispatchLingEvent(const ControlSpec& control) {
        std::wstring message = L"已触发中文 C++ 事件：";
        message += control.handler;
        MessageBoxW(hwnd_, message.c_str(), L"LingBuilder 中文 C++", MB_OK | MB_ICONINFORMATION);
    }

    void 调试输出(const wchar_t* text) {
        if (!text || text[0] == 0) return;
        OutputDebugStringW(text);
        OutputDebugStringW(L"\\n");
        int sizeNeeded = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
        if (sizeNeeded > 0) {
            std::vector<char> utf8(sizeNeeded);
            WideCharToMultiByte(CP_UTF8, 0, text, -1, utf8.data(), sizeNeeded, nullptr, nullptr);
            std::printf("[调试输出] %s\\n", utf8.data());
            std::fflush(stdout);
        }
    }

    int 信息框(const wchar_t* text, UINT flags, const wchar_t* title) {
        return MessageBoxW(hwnd_, text, title && title[0] ? title : L"LingBuilder 中文 C++", flags);
    }

    void 结束() {
        if (hwnd_) DestroyWindow(hwnd_);
    }

private:
    HMENU CreateMenuForWindow() {
        HMENU root = CreateMenu();
        HMENU windowMenu = CreatePopupMenu();
        std::wstring items = spec_.menuItems ? spec_.menuItems : L"";
        size_t pos = 0;
        int index = 0;
        while (!items.empty()) {
            size_t next = items.find(L',', pos);
            std::wstring item = next == std::wstring::npos ? items.substr(pos) : items.substr(pos, next - pos);
            trim(item);
            if (!item.empty()) {
                AppendMenuW(windowMenu, MF_STRING, 50000 + index, item.c_str());
                ++index;
            }
            if (next == std::wstring::npos) break;
            pos = next + 1;
        }
        AppendMenuW(root, MF_POPUP, reinterpret_cast<UINT_PTR>(windowMenu), L"窗口");
        return root;
    }

    static void trim(std::wstring& value) {
        const wchar_t* whitespace = L" \\t\\r\\n";
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

    void CreateGeneratedControl(const ControlSpec& control) {
        DWORD style = WS_CHILD | WS_VISIBLE;
        DWORD exStyle = 0;
        const wchar_t* className = L"STATIC";
        const wchar_t* text = control.text;

        if (!control.enabled) style |= WS_DISABLED;
        if (IsType(control, L"Button")) {
            className = L"BUTTON";
            style |= BS_PUSHBUTTON;
        } else if (IsType(control, L"TextBox")) {
            className = L"EDIT";
            style |= WS_BORDER | ES_AUTOHSCROLL;
            exStyle = WS_EX_CLIENTEDGE;
        } else if (IsType(control, L"Label")) {
            className = L"STATIC";
            style |= SS_LEFT | SS_NOTIFY;
        } else if (IsType(control, L"CheckBox")) {
            className = L"BUTTON";
            style |= BS_AUTOCHECKBOX;
        } else if (IsType(control, L"RadioButton")) {
            className = L"BUTTON";
            style |= BS_AUTORADIOBUTTON;
        } else if (IsType(control, L"ProgressBar")) {
            className = PROGRESS_CLASSW;
            text = L"";
        } else if (IsType(control, L"ComboBox")) {
            className = L"COMBOBOX";
            style |= CBS_DROPDOWNLIST | WS_VSCROLL;
        }

        HWND child = CreateWindowExW(
            exStyle,
            className,
            text,
            style,
            ScaleForDpi(control.x, dpi_),
            ScaleForDpi(control.y, dpi_),
            ScaleForDpi(control.width, dpi_),
            ScaleForDpi(control.height, dpi_),
            hwnd_,
            reinterpret_cast<HMENU>(static_cast<INT_PTR>(control.id)),
            g_instance,
            nullptr
        );
        if (!child) return;

        HFONT font = CreateControlFont(control.fontSize, dpi_);
        HBRUSH brush = CreateSolidBrush(control.background);
        runtimeControls_.push_back({ control.id, font, brush });
        if (font) SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
        if (IsType(control, L"ProgressBar")) {
            SendMessageW(child, PBM_SETRANGE, 0, MAKELPARAM(0, 100));
            SendMessageW(child, PBM_SETPOS, control.progress, 0);
        } else if (IsType(control, L"ComboBox")) {
            SendMessageW(child, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(control.text));
            SendMessageW(child, CB_SETCURSEL, 0, 0);
        }
    }

    void RebuildControls() {
        for (int i = 0; i < spec_.controlCount; ++i) {
            CreateGeneratedControl(spec_.controls[i]);
        }
    }

    void DestroyControls() {
        HWND child = GetWindow(hwnd_, GW_CHILD);
        while (child) {
            HWND next = GetWindow(child, GW_HWNDNEXT);
            DestroyWindow(child);
            child = next;
        }
        for (auto& control : runtimeControls_) {
            if (control.font) DeleteObject(control.font);
            if (control.brush) DeleteObject(control.brush);
        }
        runtimeControls_.clear();
    }

    LRESULT OnMessage(UINT message, WPARAM wParam, LPARAM lParam) {
        switch (message) {
        case WM_CREATE:
            windowBrush_ = CreateSolidBrush(spec_.background);
            ++g_openWindowCount;
            RebuildControls();
            OnWindowCreated();
            return 0;
        case WM_COMMAND: {
            int controlId = LOWORD(wParam);
            int notification = HIWORD(wParam);
            const ControlSpec* control = FindControl(controlId);
            if (controlId >= 50000 && controlId < 50100 && control) {
                DispatchLingEvent(*control);
                return 0;
            }
            if (!control) return 0;
            if ((IsType(*control, L"Button") && notification == BN_CLICKED) ||
                (IsType(*control, L"CheckBox") && notification == BN_CLICKED) ||
                (IsType(*control, L"RadioButton") && notification == BN_CLICKED) ||
                (IsType(*control, L"ComboBox") && notification == CBN_SELCHANGE) ||
                (IsType(*control, L"Label") && notification == STN_CLICKED)) {
                DispatchLingEvent(*control);
            }
            return 0;
        }
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLORBTN:
        case WM_CTLCOLOREDIT: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            HWND child = reinterpret_cast<HWND>(lParam);
            int controlId = GetDlgCtrlID(child);
            const ControlSpec* control = FindControl(controlId);
            RuntimeControl* runtime = FindRuntimeControl(controlId);
            if (control) {
                SetTextColor(hdc, control->foreground);
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
            DestroyControls();
            if (windowBrush_) {
                DeleteObject(windowBrush_);
                windowBrush_ = nullptr;
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
            return TRUE;
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

${classDefinitions}

static LingWindowBase* CreateWindowObject(int windowIndex) {
    switch (windowIndex) {
${factoryCases}
    default: return nullptr;
    }
}

static HWND OpenGeneratedWindow(int windowIndex, int showCommand) {
    LingWindowBase* window = CreateWindowObject(windowIndex);
    if (!window) return nullptr;
    HWND hwnd = window->Open(showCommand);
    if (!hwnd) {
        delete window;
        return nullptr;
    }
    return hwnd;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
    g_instance = instance;
    EnableDpiAwareness();

    INITCOMMONCONTROLSEX controls = {};
    controls.dwSize = sizeof(INITCOMMONCONTROLSEX);
    controls.dwICC = ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&controls);

    WNDCLASSEXW windowClass = {};
    windowClass.cbSize = sizeof(WNDCLASSEXW);
    windowClass.lpfnWndProc = LingWindowBase::WindowProc;
    windowClass.hInstance = instance;
    windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    windowClass.hbrBackground = nullptr;
    windowClass.lpszClassName = GENERATED_WINDOW_CLASS;

    if (!RegisterClassExW(&windowClass)) return 0;
    OpenGeneratedWindow(g_startWindowIndex, showCommand);

    MSG message;
    while (GetMessageW(&message, nullptr, 0, 0)) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
    return static_cast<int>(message.wParam);
}
`;
}

function generateNativeManifest(
  project: LingWindowProject,
  selectedWindow: LingWindowModel,
  enabledModules: InstalledModule[],
  sourceFilePath: string,
  sourceMap: LingCppNativeSourceMapEntry[]
): string {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name
    },
    selectedWindow: {
      id: selectedWindow.id,
      fileName: selectedWindow.fileName,
      className: selectedWindow.className,
      title: selectedWindow.title
    },
    sourceFilePath,
    modules: enabledModules.map(module => ({
      id: module.manifest.id,
      name: module.manifest.name,
      version: module.manifest.version,
      builtin: Boolean(module.isBuiltin)
    })),
    files: ['main.cpp', 'layout.json', 'module-dependencies.txt', 'README.txt', 'lingbuilder-native-manifest.json'],
    sourceMap
  }, null, 2);
}

function generateLingCppNativeSourceMap(
  mainCppContent: string,
  project: LingWindowProject,
  program: LingCppProgram,
  sourceFilePath: string
): LingCppNativeSourceMapEntry[] {
  const lines = mainCppContent.split('\n');
  const entries: LingCppNativeSourceMapEntry[] = [];
  project.windows.forEach(window => {
    const sourceClass = findLingCppClassForWindow(program, window);
    const className = sourceClass?.name || window.className;
    const classBoundary = findGeneratedClassBoundary(lines, toCppIdentifier(window.className));

    if (sourceClass && classBoundary) {
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: classBoundary.startLine,
        generatedEndLine: classBoundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: sourceClass.line,
        sourceEndLine: sourceClass.endLine || sourceClass.line,
        kind: 'class',
        symbolName: sourceClass.name,
        className: sourceClass.name
      });
    }

    const handlers = getWindowHandlers(window);
    const windowCreatedHandler = findWindowCreatedHandler(window, program);
    const methodHandlers = windowCreatedHandler
      ? [windowCreatedHandler, ...handlers.filter(handler => handler !== windowCreatedHandler)]
      : handlers;

    methodHandlers.forEach(handler => {
      const method = findLingCppMethod(program, handler);
      if (!method) return;
      const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(handler), classBoundary);
      if (!boundary) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: boundary.startLine,
        generatedEndLine: boundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: method.line,
        sourceEndLine: method.endLine || method.line,
        kind: 'event',
        symbolName: method.name,
        className
      });

      const statementEntries = translateMethodStatementsWithMetadata(method);
      let searchLine = boundary.startLine + 1;
      statementEntries.forEach(statement => {
        const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
        if (targetLine === -1) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: targetLine,
          generatedEndLine: targetLine,
          sourceFile: sourceFilePath,
          sourceStartLine: statement.sourceStartLine,
          sourceEndLine: statement.sourceEndLine,
          kind: statement.kind,
          symbolName: method.name,
          className
        });
        searchLine = targetLine + 1;
      });
    });

    (sourceClass?.methods || [])
      .filter(method => method.kind === 'method')
      .forEach(method => {
        const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(method.name), classBoundary);
        if (!boundary) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: boundary.startLine,
          generatedEndLine: boundary.endLine,
          sourceFile: sourceFilePath,
          sourceStartLine: method.line,
          sourceEndLine: method.endLine || method.line,
          kind: 'method',
          symbolName: method.name,
          className
        });

        const statementEntries = translateMethodStatementsWithMetadata(method);
        let searchLine = boundary.startLine + 1;
        statementEntries.forEach(statement => {
          const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
          if (targetLine === -1) return;
          entries.push({
            generatedFile: 'main.cpp',
            generatedStartLine: targetLine,
            generatedEndLine: targetLine,
            sourceFile: sourceFilePath,
            sourceStartLine: statement.sourceStartLine,
            sourceEndLine: statement.sourceEndLine,
            kind: statement.kind,
            symbolName: method.name,
            className
          });
          searchLine = targetLine + 1;
        });
      });
  });

  return entries;
}

function buildWindowClassSourceMap(
  classCode: string,
  window: LingWindowModel,
  program: LingCppProgram,
  sourceFilePath: string
): LingCppNativeSourceMapEntry[] {
  const lines = classCode.split('\n');
  const sourceClass = findLingCppClassForWindow(program, window);
  const entries: LingCppNativeSourceMapEntry[] = [];
  const className = sourceClass?.name || window.className;

  if (sourceClass) {
    entries.push({
      generatedFile: 'main.cpp',
      generatedStartLine: 1,
      generatedEndLine: lines.length,
      sourceFile: sourceFilePath,
      sourceStartLine: sourceClass.line,
      sourceEndLine: sourceClass.endLine || sourceClass.line,
      kind: 'class',
      symbolName: sourceClass.name,
      className: sourceClass.name
    });
  }

  const handlers = getWindowHandlers(window);
  const windowCreatedHandler = findWindowCreatedHandler(window, program);
  const methodHandlers = windowCreatedHandler
    ? [windowCreatedHandler, ...handlers.filter(handler => handler !== windowCreatedHandler)]
    : handlers;

  methodHandlers.forEach(handler => {
    const method = findLingCppMethod(program, handler);
    if (!method) return;
    const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(handler));
    if (!boundary) return;
    entries.push({
      generatedFile: 'main.cpp',
      generatedStartLine: boundary.startLine,
      generatedEndLine: boundary.endLine,
      sourceFile: sourceFilePath,
      sourceStartLine: method.line,
      sourceEndLine: method.endLine || method.line,
      kind: 'event',
      symbolName: method.name,
      className
    });

    const statementEntries = translateMethodStatementsWithMetadata(method);
    let searchLine = boundary.startLine + 1;
    statementEntries.forEach(statement => {
      const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
      if (targetLine === -1) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: targetLine,
        generatedEndLine: targetLine,
        sourceFile: sourceFilePath,
        sourceStartLine: statement.sourceStartLine,
        sourceEndLine: statement.sourceEndLine,
        kind: statement.kind,
        symbolName: method.name,
        className
      });
      searchLine = targetLine + 1;
    });
  });

  (sourceClass?.methods || [])
    .filter(method => method.kind === 'method')
    .forEach(method => {
      const boundary = findGeneratedMethodBoundary(lines, toCppIdentifier(method.name));
      if (!boundary) return;
      entries.push({
        generatedFile: 'main.cpp',
        generatedStartLine: boundary.startLine,
        generatedEndLine: boundary.endLine,
        sourceFile: sourceFilePath,
        sourceStartLine: method.line,
        sourceEndLine: method.endLine || method.line,
        kind: 'method',
        symbolName: method.name,
        className
      });

      const statementEntries = translateMethodStatementsWithMetadata(method);
      let searchLine = boundary.startLine + 1;
      statementEntries.forEach(statement => {
        const targetLine = findGeneratedStatementLine(lines, statement.code, searchLine, boundary.endLine);
        if (targetLine === -1) return;
        entries.push({
          generatedFile: 'main.cpp',
          generatedStartLine: targetLine,
          generatedEndLine: targetLine,
          sourceFile: sourceFilePath,
          sourceStartLine: statement.sourceStartLine,
          sourceEndLine: statement.sourceEndLine,
          kind: statement.kind,
          symbolName: method.name,
          className
        });
        searchLine = targetLine + 1;
      });
    });

  return entries;
}

function findBlockStartLine(lines: string[], block: string, fromLine: number): number {
  const blockLines = block.split('\n');
  if (blockLines.length === 0) return -1;

  for (let line = Math.max(1, fromLine); line <= lines.length - blockLines.length + 1; line += 1) {
    let matched = true;
    for (let offset = 0; offset < blockLines.length; offset += 1) {
      if (lines[line + offset - 1] !== blockLines[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return line;
  }

  return -1;
}

function findGeneratedClassBoundary(
  lines: string[],
  cppIdentifier: string
): { startLine: number; endLine: number } | undefined {
  const classPattern = new RegExp(`^class\\s+${escapeRegexLiteral(cppIdentifier)}\\s*:\\s*public\\s+LingWindowBase`);
  for (let line = 1; line <= lines.length; line += 1) {
    if (!classPattern.test((lines[line - 1] || '').trim())) continue;
    for (let scan = line; scan <= lines.length; scan += 1) {
      if ((lines[scan - 1] || '').trim() === '};') {
        return { startLine: line, endLine: scan };
      }
    }
  }
  return undefined;
}

function findGeneratedMethodBoundary(
  lines: string[],
  cppIdentifier: string,
  range?: { startLine: number; endLine: number }
): { startLine: number; endLine: number } | undefined {
  const startLine = range?.startLine || 1;
  const endLine = range?.endLine || lines.length;
  const declarationPatterns = [
    new RegExp(`^\\s*void\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*int\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*long\\s+long\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*double\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*bool\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*unsigned\\s+char\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*std::wstring\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*HWND\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`),
    new RegExp(`^\\s*void\\*\\s+${escapeRegexLiteral(cppIdentifier)}\\s*\\(`)
  ];
  const fallbackPattern = new RegExp(`\\b${escapeRegexLiteral(cppIdentifier)}\\s*\\(`);

  for (let line = startLine; line <= endLine; line += 1) {
    const text = lines[line - 1] || '';
    const isDeclaration = declarationPatterns.some(pattern => pattern.test(text));
    if (!isDeclaration && !fallbackPattern.test(text)) continue;
    let braceDepth = 0;
    let seenOpeningBrace = false;
    for (let scan = line; scan <= endLine; scan += 1) {
      const scanText = lines[scan - 1] || '';
      for (const char of scanText) {
        if (char === '{') {
          braceDepth += 1;
          seenOpeningBrace = true;
        } else if (char === '}') {
          braceDepth = Math.max(0, braceDepth - 1);
        }
      }
      if (seenOpeningBrace && braceDepth === 0) {
        return { startLine: line, endLine: scan };
      }
    }
  }

  return undefined;
}

function findGeneratedStatementLine(lines: string[], code: string, fromLine: number, endLine: number): number {
  for (let line = Math.max(1, fromLine); line <= Math.min(lines.length, endLine); line += 1) {
    if ((lines[line - 1] || '').trim() === code.trim()) {
      return line;
    }
  }
  return -1;
}

function generateModuleCppPreamble(enabledModules: InstalledModule[]): string {
  const lines: string[] = [];
  enabledModules
    .filter(module => !module.isBuiltin)
    .forEach(module => {
      const cpp = module.manifest.contributes?.cpp;
      lines.push(`// LingBuilder 模块: ${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`);
      (cpp?.headers || []).forEach(header => lines.push(`// 模块头文件: ${header}`));
      (cpp?.sources || []).forEach(source => lines.push(`// 模块源码: ${source}`));
      (cpp?.libs || []).forEach(lib => lines.push(`#pragma comment(lib, "${escapeWideString(lib)}")`));
      (cpp?.defines || []).forEach(define => {
        const safeDefine = toCppDefineIdentifier(define);
        lines.push(`#ifndef ${safeDefine}\n#define ${safeDefine}\n#endif`);
      });
    });
  return lines.join('\n');
}

function generateModuleDependencyReport(enabledModules: InstalledModule[]): string {
  if (enabledModules.length === 0) return '当前项目未启用模块。';
  return enabledModules.map(module => {
    const cpp = module.manifest.contributes?.cpp;
    return [
      `模块: ${module.manifest.name}`,
      `ID: ${module.manifest.id}`,
      `版本: ${module.manifest.version}`,
      `内置: ${module.isBuiltin ? '是' : '否'}`,
      `命令数: ${module.manifest.contributes?.commands?.length || 0}`,
      `控件数: ${module.manifest.contributes?.designerControls?.length || 0}`,
      `头文件: ${(cpp?.headers || []).join(', ') || '无'}`,
      `源码: ${(cpp?.sources || []).join(', ') || '无'}`,
      `库: ${(cpp?.libs || []).join(', ') || '无'}`
    ].join('\n');
  }).join('\n\n');
}

function generateWindowClass(window: LingWindowModel, windowIndex: number, program: LingCppProgram): string {
  const className = toCppIdentifier(window.className);
  const sourceClass = findLingCppClassForWindow(program, window);
  const handlers = getWindowHandlers(window);
  const windowCreatedHandler = findWindowCreatedHandler(window, program);
  const methodHandlers = windowCreatedHandler
    ? [windowCreatedHandler, ...handlers.filter(handler => handler !== windowCreatedHandler)]
    : handlers;
  const dispatchCases = handlers
    .map(handler => `        if (std::wcscmp(control.handler, L"${escapeWideString(handler)}") == 0) { ${toCppIdentifier(handler)}(); return; }`)
    .join('\n') || '        (void)control;';
  const eventMethods = methodHandlers
    .map(handler => generateHandlerMethod(handler, findLingCppMethod(program, handler)));
  const userMethods = (sourceClass?.methods || [])
    .filter(method => method.kind === 'method')
    .map(generateUserMethod);
  const methods = [...eventMethods, ...userMethods].join('\n\n') || '    // 当前窗口暂无绑定事件。';
  const windowCreatedOverride = windowCreatedHandler
    ? `    void OnWindowCreated() override {\n        ${toCppIdentifier(windowCreatedHandler)}();\n    }\n\n`
    : '';

  return `class ${className} : public LingWindowBase {
public:
    explicit ${className}(const WindowSpec& spec) : LingWindowBase(spec) {}

protected:
${windowCreatedOverride}
    void DispatchLingEvent(const ControlSpec& control) override {
${dispatchCases}
        LingWindowBase::DispatchLingEvent(control);
    }

private:
${methods}
};`;
}

function findLingCppClassForWindow(program: LingCppProgram, window: LingWindowModel): LingCppClass | undefined {
  const direct = program.classes.find(cls => cls.name === window.className);
  if (direct) return direct;
  return program.classes.find(cls => toCppIdentifier(cls.name) === toCppIdentifier(window.className));
}

function generateHandlerMethod(handler: string, method?: LingCppMethod): string {
  const body = method
    ? translateMethodStatements(method)
    : `        调试输出(L"未找到 ${escapeWideString(handler)} 的中文 C++ 事件实现。");`;
  return `    void ${toCppIdentifier(handler)}() {
${body || '        // 空事件处理器。'}
    }`;
}

function generateUserMethod(method: LingCppMethod): string {
  const returnType = toCppType(method.returnType, 'return');
  const parameters = formatCppParameters(method.parameters);
  const body = translateMethodStatements(method);
  const fallbackReturn = defaultReturnStatement(returnType);
  const bodyWithFallback = [
    body,
    fallbackReturn ? `        ${fallbackReturn}` : ''
  ].filter(Boolean).join('\n') || '        // 空功能代码。';

  return `    ${returnType} ${toCppIdentifier(method.name)}(${parameters}) {
${bodyWithFallback}
    }`;
}

function formatCppParameters(parameters: LingCppParameter[]): string {
  return parameters
    .map(parameter => `${toCppType(parameter.type, 'parameter')} ${toCppIdentifier(parameter.name)}`)
    .join(', ');
}

function toCppType(type: string, position: 'parameter' | 'return'): string {
  const normalized = type.trim();
  if (!normalized || normalized === '空') return position === 'return' ? 'void' : 'void*';
  if (/^(文本型|文本|字符串|字符串型)$/u.test(normalized)) return 'std::wstring';
  if (/^(整数型|整数)$/u.test(normalized)) return 'int';
  if (/^(长整数型|长整数)$/u.test(normalized)) return 'long long';
  if (/^(小数型|小数|双精度|双精度型)$/u.test(normalized)) return 'double';
  if (/^(逻辑型|逻辑|布尔型|布尔)$/u.test(normalized)) return 'bool';
  if (/^(字节型|字节)$/u.test(normalized)) return 'unsigned char';
  if (/按钮|标签|编辑框|复选框|单选框|下拉框|控件|窗体/u.test(normalized)) return 'HWND';
  return 'void*';
}

function defaultReturnStatement(returnType: string): string {
  if (returnType === 'void') return '';
  if (returnType === 'bool') return 'return false;';
  if (returnType === 'std::wstring') return 'return L"";';
  if (returnType.endsWith('*')) return 'return nullptr;';
  if (returnType === 'double' || returnType === 'float') return 'return 0.0;';
  return 'return 0;';
}

function translateMethodStatementsWithMetadata(method: LingCppMethod): TranslatedStatementLine[] {
  const lines: TranslatedStatementLine[] = [];

  for (let index = 0; index < method.statements.length; index += 1) {
    const currentStatement = method.statements[index];
    const nextStatement = method.statements[index + 1];
    const thirdStatement = method.statements[index + 2];
    const current = currentStatement?.text.trim() || '';
    const next = nextStatement?.text.trim() || '';
    const third = thirdStatement?.text.trim() || '';

    if (!current || !currentStatement) continue;

    const messageBox = parseMessageBox(current);
    if (
      messageBox &&
      /[=＝]{1,2}\s*6/.test(current) &&
      /^(\u7ed3\u675f)\s*[\uFF08(]?\s*[\uFF09)]?$/.test(next)
    ) {
      const consumesThird = third.startsWith('\u5982\u679c\u7ed3\u675f');
      lines.push({
        code: `if (\u4fe1\u606f\u6846(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}") == IDYES) { \u7ed3\u675f(); return; }`,
        sourceStartLine: currentStatement.line,
        sourceEndLine: consumesThird ? (thirdStatement?.line || nextStatement?.line || currentStatement.line) : (nextStatement?.line || currentStatement.line),
        kind: 'statement'
      });
      index += consumesThird ? 2 : 1;
      continue;
    }

    lines.push(translateStatementToMetadata(currentStatement));
  }

  return lines;
}

function translateStatementToMetadata(statement: LingCppStatement): TranslatedStatementLine {
  const text = statement.text.trim();
  const nativeCpp = parseNativeCppStatement(text);

  return {
    code: nativeCpp !== undefined ? nativeCpp : translateStatement(text),
    sourceStartLine: statement.line,
    sourceEndLine: statement.line,
    kind: nativeCpp !== undefined ? 'native-cpp' : 'statement'
  };
}

function translateMethodStatements(method: LingCppMethod): string {
  return translateMethodStatementsWithMetadata(method)
    .map(item => `        ${item.code}`)
    .join('\n');
  const lines: string[] = [];

  for (let index = 0; index < method.statements.length; index += 1) {
    const current = method.statements[index]?.text.trim() || '';
    const next = method.statements[index + 1]?.text.trim() || '';
    const third = method.statements[index + 2]?.text.trim() || '';

    if (!current) continue;

    const messageBox = parseMessageBox(current);
    if (
      /^如果(?:\s|[（(])/.test(current) &&
      messageBox &&
      /[=＝]{1,2}\s*6/.test(current) &&
      /^结束\s*[（(]?\s*[）)]?$/.test(next)
    ) {
      lines.push(
        `        if (信息框(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}") == IDYES) { 结束(); return; }`
      );
      index += /^如果结束/.test(third) ? 2 : 1;
      continue;
    }

    lines.push(`        ${translateStatement(current)}`);
  }

  return lines.join('\n');
}

function translateStatement(statement: string): string {
  const nativeCpp = parseNativeCppStatement(statement);
  if (nativeCpp !== undefined) return nativeCpp;

  const messageBox = parseMessageBox(statement);
  if (/^如果(?:\s|[（(])/.test(statement) && messageBox && /[=＝]{1,2}\s*6/.test(statement)) {
    return `if (信息框(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}") == IDYES) { 结束(); return; }`;
  }
  if (messageBox) {
    return `信息框(L"${escapeWideString(messageBox.text)}", ${messageBox.flags}, L"${escapeWideString(messageBox.title)}");`;
  }

  const debugMatch = statement.match(/调试输出\s*[（(]\s*[“"]([^”"]*)[”"]\s*[）)]/u);
  if (debugMatch) {
    return `调试输出(L"${escapeWideString(debugMatch[1] || '')}");`;
  }

  if (/^结束\s*[（(]?\s*[）)]?/.test(statement)) {
    return '结束();';
  }

  const returnValue = parseReturnValue(statement);
  if (returnValue !== undefined) {
    return `return ${translateLingCppExpression(returnValue)};`;
  }

  if (/^返回\b/.test(statement)) {
    return 'return;';
  }

  const callStatement = parseCallStatement(statement);
  if (callStatement) {
    return `${toCppIdentifier(callStatement.name)}(${translateCallArguments(callStatement.argumentsText)});`;
  }

  return `// 暂不支持的中文 C++ 语句：${escapeCppComment(statement)}`;
}

function parseNativeCppStatement(statement: string): string | undefined {
  if (!statement.startsWith('@')) return undefined;
  const raw = statement.slice(1);
  return raw.startsWith(' ') ? raw.slice(1) : raw;
}

function parseReturnValue(statement: string): string | undefined {
  const parenthesized = statement.match(/^返回\s*[（(]\s*(.*?)\s*[）)]\s*;?$/u);
  if (parenthesized) return parenthesized[1]?.trim() || undefined;
  const plain = statement.match(/^返回\s+(.+?)\s*;?$/u);
  return plain?.[1]?.trim() || undefined;
}

function parseCallStatement(statement: string): { name: string; argumentsText: string } | undefined {
  const match = statement.match(/^([\w\u4e00-\u9fa5]+)\s*[（(](.*)[）)]\s*;?$/u);
  if (!match) return undefined;
  return {
    name: match[1] || '',
    argumentsText: match[2] || ''
  };
}

function translateCallArguments(raw: string): string {
  return splitCallArguments(raw)
    .map(translateLingCppExpression)
    .join(', ');
}

function splitCallArguments(raw: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | '“' | null = null;

  for (const char of raw) {
    if (quote) {
      current += char;
      if ((quote === '"' && char === '"') || (quote === '“' && char === '”')) quote = null;
      continue;
    }
    if (char === '"' || char === '“') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '（') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if ((char === ',' || char === '，') && depth === 0) {
      if (current.trim()) args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function translateLingCppExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  if (/^L"/u.test(trimmed)) return trimmed;
  const quoted = trimmed.match(/^["“]([^"”]*)["”]$/u);
  if (quoted) return `L"${escapeWideString(quoted[1] || '')}"`;
  if (trimmed === '真') return 'true';
  if (trimmed === '假') return 'false';
  return trimmed;
}

function parseMessageBox(statement: string): { text: string; flags: string; title: string } | undefined {
  const match = statement.match(/信息框\s*[（(]\s*[“"]([^”"]*)[”"]\s*[,，]\s*(\d+)\s*[,，]\s*[“"]([^”"]*)[”"]\s*[）)]/u);
  if (!match) return undefined;
  return {
    text: match[1] || '',
    flags: toMessageBoxFlagsExpression(Number.parseInt(match[2] || '0', 10)),
    title: match[3] || '提示'
  };
}

function toMessageBoxFlagsExpression(flagCode: number): string {
  const parts: string[] = [];
  switch (flagCode & 0x0f) {
    case 1:
      parts.push('MB_OKCANCEL');
      break;
    case 2:
      parts.push('MB_ABORTRETRYIGNORE');
      break;
    case 3:
      parts.push('MB_YESNOCANCEL');
      break;
    case 4:
      parts.push('MB_YESNO');
      break;
    case 5:
      parts.push('MB_RETRYCANCEL');
      break;
    default:
      parts.push('MB_OK');
      break;
  }
  const iconCode = flagCode & 0xf0;
  if (iconCode === 16) parts.push('MB_ICONERROR');
  if (iconCode === 32) parts.push('MB_ICONQUESTION');
  if (iconCode === 48) parts.push('MB_ICONWARNING');
  if (iconCode === 64) parts.push('MB_ICONINFORMATION');
  return parts.join(' | ');
}

function generateControlArray(window: LingWindowModel, windowIndex: number, program: LingCppProgram): string {
  const visibleControls = [...getVisibleControls(window)];
  const items = ((window as any).menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);

  items.forEach((item: string, idx: number) => {
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
      events: { Select: handler }
    });
  });

  const controls = visibleControls
    .map((control, index) => {
      let id = index + 1001;
      if (control.id.startsWith('__virtual_menu_item_')) {
        const parts = control.id.split('_');
        id = 50000 + Number.parseInt(parts[parts.length - 1], 10);
      }
      return generateControlSpec(control, id);
    })
    .join(',\n') || '    { 0, L"", L"", 0, 0, 0, 0, 12, RGB(0, 0, 0), RGB(0, 0, 0), true, 0, L"" }';

  return `static ControlSpec g_controls_${windowIndex}[] = {
${controls}
};`;
}

function generateWindowSpec(window: LingWindowModel, windowIndex: number): string {
  const menuItemsStr = (window as any).menuItems || '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件';
  const visibleCount = getVisibleControls(window).length + menuItemsStr.split(',').map((item: string) => item.trim()).filter(Boolean).length;
  return `    { ${windowIndex}, L"${escapeWideString(window.className)}", L"${escapeWideString(window.title)}", ${Math.max(360, window.width)}, ${Math.max(220, window.height - TITLE_BAR_HEIGHT)}, ${toColorRef(window.background)}, g_controls_${windowIndex}, ${visibleCount}, L"${escapeWideString(menuItemsStr)}" }`;
}

function generateControlSpec(control: LingControl, id: number): string {
  const handler = Object.values(control.events || {}).find(value => value.trim()) || '';
  const background = control.background === 'transparent' ? '#1E1E24' : control.background;
  return `    { ${id}, L"${control.type}", L"${escapeWideString(control.content)}", ${int(control.x)}, ${int(control.y)}, ${int(control.width)}, ${int(control.height)}, ${int(control.fontSize)}, ${toColorRef(background)}, ${toColorRef(control.foreground)}, ${control.isEnabled ? 'true' : 'false'}, ${parseProgress(control)}, L"${escapeWideString(handler)}" }`;
}

function getWindowHandlers(window: LingWindowModel): string[] {
  const handlers = new Set<string>();
  window.controls.forEach(control => {
    Object.values(control.events || {}).forEach(handler => {
      if (handler.trim()) handlers.add(handler.trim());
    });
  });
  Object.values((window as any).menuEvents || {}).forEach((handler: any) => {
    if (typeof handler === 'string' && handler.trim()) handlers.add(handler.trim());
  });
  return [...handlers];
}

function findWindowCreatedHandler(window: LingWindowModel, program: LingCppProgram): string | undefined {
  const candidates = [
    `_${window.className}_创建完毕`,
    `${window.className}_创建完毕`
  ];

  return candidates.find(candidate => Boolean(findLingCppMethod(program, candidate)));
}

function getVisibleControls(window: LingWindowModel): LingControl[] {
  return window.controls.filter(control => control.visibility === 'Visible');
}

function parseProgress(control: LingControl): number {
  if (control.type !== 'ProgressBar') return 0;
  const value = Number.parseInt(control.content, 10);
  return Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
}

function toColorRef(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 'RGB(30, 30, 36)';
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `RGB(${r}, ${g}, ${b})`;
}

function toCppIdentifier(value: string): string {
  const normalized = value.trim().replace(/[^\w\u4e00-\u9fa5]/g, '_').replace(/^_+/, '');
  const safe = normalized || '未命名';
  return /^\d/.test(safe) ? `_${safe}` : safe;
}

function toCppDefineIdentifier(value: string): string {
  const normalized = value.trim().replace(/[^\w]/g, '_').replace(/^_+/, '');
  const safe = normalized || 'LINGBUILDER_MODULE_DEFINE';
  return /^\d/.test(safe) ? `_${safe}` : safe;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  return value.replace(/\r?\n/g, ' ').replace(/\*\//g, '* /');
}

function int(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}
