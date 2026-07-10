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
import { getPreferredModuleTarget, getUnsupportedModuleTargetDiagnostic } from '../modules/targetResolver';

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

interface OpenWindowCommand {
  target: string;
  placement?: string;
  x?: number;
  y?: number;
  hasCustomPosition?: boolean;
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
  const moduleTargetDiagnostics = enabledModules
    .filter(module => !module.isBuiltin)
    .map(module => getUnsupportedModuleTargetDiagnostic(module))
    .filter((diagnostic): diagnostic is string => Boolean(diagnostic));

  return {
    selectedWindow,
    diagnostics: [
      ...parseResult.diagnostics.map(diagnostic => `第 ${diagnostic.line} 行：${diagnostic.message}`),
      ...moduleTargetDiagnostics
    ],
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
    .map((window, index) => generateWindowClass(window, index, program, enabledModules))
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

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <commctrl.h>
#include <winhttp.h>
#include <wincrypt.h>
#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cwchar>
#include <sstream>
#include <string>
#include <vector>

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT)-4)
#endif

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "advapi32.lib")
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
    const wchar_t* openPlacement;
    int openX;
    int openY;
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

static bool TextEquals(const wchar_t* value, const wchar_t* expected) {
    return value && expected && std::wcscmp(value, expected) == 0;
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

    virtual ~LingWindowBase() {
        WS_关闭();
        HTTP_关闭服务();
        WSS_关闭服务();
        if (socketsStarted_) {
            WSACleanup();
            socketsStarted_ = false;
        }
    }

    HWND Open(int showCommand, const wchar_t* placement = nullptr, int x = CW_USEDEFAULT, int y = CW_USEDEFAULT, bool hasCustomPosition = false) {
        dpi_ = GetSystemDpiValue();
        RECT rect = { 0, 0, ScaleForDpi(spec_.width, dpi_), ScaleForDpi(spec_.height, dpi_) };
        AdjustWindowRectEx(&rect, WS_OVERLAPPEDWINDOW, TRUE, 0);
        int windowWidth = rect.right - rect.left;
        int windowHeight = rect.bottom - rect.top;
        int windowX = CW_USEDEFAULT;
        int windowY = CW_USEDEFAULT;
        ResolveWindowPlacement(spec_, windowWidth, windowHeight, placement, x, y, hasCustomPosition, windowX, windowY);

        hwnd_ = CreateWindowExW(
            0,
            GENERATED_WINDOW_CLASS,
            spec_.title,
            WS_OVERLAPPEDWINDOW,
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
        if (hwnd_) PostMessageW(hwnd_, WM_CLOSE, 0, 0);
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
        response << "HTTP/1.1 200 OK\\r\\n"
                 << "Content-Type: text/plain; charset=utf-8\\r\\n"
                 << "Content-Length: " << body.size() << "\\r\\n"
                 << "Connection: close\\r\\n\\r\\n"
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
            "HTTP/1.1 101 Switching Protocols\\r\\n"
            "Upgrade: websocket\\r\\n"
            "Connection: Upgrade\\r\\n"
            "Sec-WebSocket-Accept: " + acceptKey + "\\r\\n\\r\\n";
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
        std::string payload(static_cast<size_t>(payloadLength), '\\0');
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
        while (request.find("\\r\\n\\r\\n") == std::string::npos && request.size() < 64 * 1024) {
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
        const char* whitespace = " \\t\\r\\n";
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
        std::string bytes(static_cast<size_t>(needed), '\\0');
        WideCharToMultiByte(CP_UTF8, 0, text, -1, bytes.data(), needed, nullptr, nullptr);
        bytes.pop_back();
        return bytes;
    }

    std::wstring Utf8ToWide(const std::string& bytes) {
        if (bytes.empty()) return std::wstring();
        int needed = MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
        if (needed <= 0) return std::wstring();
        std::wstring text(static_cast<size_t>(needed), L'\\0');
        MultiByteToWideChar(CP_UTF8, 0, bytes.data(), static_cast<int>(bytes.size()), text.data(), needed);
        return text;
    }

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
      const target = getPreferredModuleTarget(module);
      const modulePath = `modules/${module.manifest.id}`;
      lines.push(`// LingBuilder 模块: ${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`);
      if (target) lines.push(`// 模块目标: ${target.id} / ${target.platform}-${target.toolchain}-${target.arch}`);
      (target?.headers || []).forEach(header => {
        lines.push(`#include "${escapeIncludePath(`${modulePath}/${header}`)}"`);
      });
      (target?.sources || []).forEach(source => lines.push(`// 模块源码: ${source}`));
      (target?.libs || []).forEach(lib => lines.push(`#pragma comment(lib, "${escapeWideString(`${modulePath}/${lib}`)}")`));
      (target?.runtimeFiles || []).forEach(runtimeFile => lines.push(`// 模块运行时文件: ${runtimeFile}`));
      (target?.defines || []).forEach(define => {
        const safeDefine = toCppDefineIdentifier(define);
        lines.push(`#ifndef ${safeDefine}\n#define ${safeDefine}\n#endif`);
      });
    });
  return lines.join('\n');
}

function generateModuleDependencyReport(enabledModules: InstalledModule[]): string {
  if (enabledModules.length === 0) return '当前项目未启用模块。';
  return enabledModules.map(module => {
    const target = getPreferredModuleTarget(module);
    return [
      `模块: ${module.manifest.name}`,
      `ID: ${module.manifest.id}`,
      `版本: ${module.manifest.version}`,
      `内置: ${module.isBuiltin ? '是' : '否'}`,
      `目标: ${target ? `${target.id} (${target.platform}/${target.toolchain}/${target.arch})` : '无'}`,
      ...(!target && !module.isBuiltin ? [getUnsupportedModuleTargetDiagnostic(module) || '未提供兼容的 Win32/MSVC 模块目标。'] : []),
      `命令数: ${module.manifest.contributes?.commands?.length || 0}`,
      `控件数: ${module.manifest.contributes?.designerControls?.length || 0}`,
      `头文件: ${(target?.headers || []).join(', ') || '无'}`,
      `源码: ${(target?.sources || []).join(', ') || '无'}`,
      `库: ${(target?.libs || []).join(', ') || '无'}`,
      `运行时文件: ${(target?.runtimeFiles || []).join(', ') || '无'}`
    ].join('\n');
  }).join('\n\n');
}

function generateWindowClass(window: LingWindowModel, windowIndex: number, program: LingCppProgram, enabledModules: InstalledModule[]): string {
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
    .map(handler => generateHandlerMethod(handler, findLingCppMethod(program, handler), enabledModules));
  const userMethods = (sourceClass?.methods || []).filter(method => method.kind === 'method');
  const publicUserMethods = userMethods.filter(method => method.access === '公开').map(method => generateUserMethod(method, enabledModules));
  const protectedUserMethods = userMethods.filter(method => method.access === '保护').map(method => generateUserMethod(method, enabledModules));
  const privateUserMethods = userMethods.filter(method => method.access !== '公开' && method.access !== '保护').map(method => generateUserMethod(method, enabledModules));
  const publicUserMethodBlock = publicUserMethods.length ? `\n${publicUserMethods.join('\n\n')}\n` : '';
  const protectedUserMethodBlock = protectedUserMethods.length ? `\n${protectedUserMethods.join('\n\n')}\n` : '';
  const privateMethods = [...eventMethods, ...privateUserMethods].join('\n\n') || '    // 当前窗口暂无绑定事件。';
  const windowCreatedOverride = windowCreatedHandler
    ? `    void OnWindowCreated() override {\n        ${toCppIdentifier(windowCreatedHandler)}();\n    }\n\n`
    : '';

  return `class ${className} : public LingWindowBase {
public:
    explicit ${className}(const WindowSpec& spec) : LingWindowBase(spec) {}
${publicUserMethodBlock}

protected:
${windowCreatedOverride}
    void DispatchLingEvent(const ControlSpec& control) override {
${dispatchCases}
        LingWindowBase::DispatchLingEvent(control);
    }
${protectedUserMethodBlock}

private:
${privateMethods}
};`;
}

function findLingCppClassForWindow(program: LingCppProgram, window: LingWindowModel): LingCppClass | undefined {
  const direct = program.classes.find(cls => cls.name === window.className);
  if (direct) return direct;
  return program.classes.find(cls => toCppIdentifier(cls.name) === toCppIdentifier(window.className));
}

function generateHandlerMethod(handler: string, method: LingCppMethod | undefined, enabledModules: InstalledModule[]): string {
  const body = method
    ? translateMethodStatements(method, enabledModules)
    : `        调试输出(L"未找到 ${escapeWideString(handler)} 的中文 C++ 事件实现。");`;
  return `    void ${toCppIdentifier(handler)}() {
${body || '        // 空事件处理器。'}
    }`;
}

function generateUserMethod(method: LingCppMethod, enabledModules: InstalledModule[]): string {
  const returnType = toCppType(method.returnType, 'return');
  const parameters = formatCppParameters(method.parameters);
  const body = translateMethodStatements(method, enabledModules);
  const fallbackReturn = defaultReturnStatement(returnType);
  const staticPrefix = method.isStatic ? 'static ' : '';
  const bodyWithFallback = [
    body,
    fallbackReturn ? `        ${fallbackReturn}` : ''
  ].filter(Boolean).join('\n') || '        // 空功能代码。';

  return `    ${staticPrefix}${returnType} ${toCppIdentifier(method.name)}(${parameters}) {
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

function translateMethodStatementsWithMetadata(method: LingCppMethod, enabledModules: InstalledModule[] = []): TranslatedStatementLine[] {
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

    lines.push(translateStatementToMetadata(currentStatement, enabledModules));
  }

  return lines;
}

function translateStatementToMetadata(statement: LingCppStatement, enabledModules: InstalledModule[] = []): TranslatedStatementLine {
  const text = statement.text.trim();
  const nativeCpp = parseNativeCppStatement(text);

  return {
    code: nativeCpp !== undefined ? nativeCpp : translateStatement(text, enabledModules),
    sourceStartLine: statement.line,
    sourceEndLine: statement.line,
    kind: nativeCpp !== undefined ? 'native-cpp' : 'statement'
  };
}

function translateMethodStatements(method: LingCppMethod, enabledModules: InstalledModule[] = []): string {
  return translateMethodStatementsWithMetadata(method, enabledModules)
    .map(item => `        ${item.code}`)
    .join('\n');
}

function translateStatement(statement: string, enabledModules: InstalledModule[] = []): string {
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

  const openWindowCommand = parseOpenWindowCommand(statement);
  if (openWindowCommand !== undefined) {
    return formatOpenWindowCall(openWindowCommand);
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
    const binding = findModuleCommandBinding(callStatement.name, enabledModules);
    if (binding) return `${toCppIdentifier(binding.runtimeName)}(${translateCallArguments(callStatement.argumentsText)});`;
    const looksLikeModuleCommand = enabledModules.some(module =>
      (module.manifest.contributes?.commands || []).some(command => command.name === callStatement.name)
    );
    if (looksLikeModuleCommand) {
      return `// 模块命令缺少 v2 binding，无法生成确定性 C++ 调用：${escapeCppComment(callStatement.name)}`;
    }
    return `${toCppIdentifier(callStatement.name)}(${translateCallArguments(callStatement.argumentsText)});`;
  }

  return `// 暂不支持的中文 C++ 语句：${escapeCppComment(statement)}`;
}

function findModuleCommandBinding(commandName: string, enabledModules: InstalledModule[]) {
  for (const module of enabledModules) {
    const binding = (module.manifest.bindings?.commands || []).find(item => item.command === commandName);
    if (binding) return binding;
  }
  return undefined;
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

function parseOpenWindowCommand(statement: string): OpenWindowCommand | undefined {
  const call = statement.match(/^(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*(.*?)\s*[）)]\s*;?$/u);
  const rawArguments = call?.[1]?.trim();
  if (rawArguments) {
    const args = splitCallArguments(rawArguments);
    const rawTarget = args[0]?.trim();
    if (!rawTarget) return undefined;
    const command: OpenWindowCommand = {
      target: stripLingCppStringLiteral(rawTarget)
    };

    const directX = parseIntegerArgument(args[1]);
    const directY = parseIntegerArgument(args[2]);
    if (directX !== undefined && directY !== undefined) {
      return { ...command, placement: 'custom', x: directX, y: directY, hasCustomPosition: true };
    }

    const rawPlacement = args[1]?.trim();
    if (rawPlacement) {
      command.placement = normalizeOpenWindowPlacement(stripLingCppStringLiteral(rawPlacement));
      const x = parseIntegerArgument(args[2]);
      const y = parseIntegerArgument(args[3]);
      if (x !== undefined && y !== undefined) {
        command.x = x;
        command.y = y;
        command.hasCustomPosition = true;
        command.placement = 'custom';
      }
    }

    return command;
  }

  const plain = statement.match(/^(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s+(.+?)\s*;?$/u);
  return plain?.[1] ? { target: stripLingCppStringLiteral(plain[1].trim()) } : undefined;
}

function formatOpenWindowCall(command: OpenWindowCommand): string {
  const target = `L"${escapeWideString(command.target)}"`;
  if (command.hasCustomPosition && command.x !== undefined && command.y !== undefined) {
    return `窗口_打开(${target}, L"custom", ${int(command.x)}, ${int(command.y)}, true);`;
  }
  if (command.placement) {
    return `窗口_打开(${target}, L"${escapeWideString(command.placement)}");`;
  }
  return `窗口_打开(${target});`;
}

function parseIntegerArgument(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^-?\d+$/u.test(trimmed)) return undefined;
  return Number.parseInt(trimmed, 10);
}

function normalizeOpenWindowPlacement(value: string | undefined): string {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'default';
  if (['center', 'middle', '居中', '居中显示', '屏幕居中'].includes(normalized)) return 'center';
  if (['top-left', 'left-top', '左上角', '左上', '左上方'].includes(normalized)) return 'top-left';
  if (['top-right', 'right-top', '右上角', '右上', '右上方'].includes(normalized)) return 'top-right';
  if (['bottom-left', 'left-bottom', '左下角', '左下', '左下方'].includes(normalized)) return 'bottom-left';
  if (['bottom-right', 'right-bottom', '右下角', '右下', '右下方'].includes(normalized)) return 'bottom-right';
  if (['custom', '自定义', '自定义坐标', '坐标'].includes(normalized)) return 'custom';
  if (['default', '默认', '系统默认'].includes(normalized)) return 'default';
  return value?.trim() || 'default';
}

function stripLingCppStringLiteral(value: string): string {
  const quoted = value.match(/^(?:L)?["“](.*)["”]$/u);
  return quoted ? (quoted[1] || '').trim() : value.trim();
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
  const openPlacement = normalizeOpenWindowPlacement(window.openPlacement || 'default');
  const openX = openPlacement === 'custom' ? int(window.openX ?? 120) : 'CW_USEDEFAULT';
  const openY = openPlacement === 'custom' ? int(window.openY ?? 80) : 'CW_USEDEFAULT';
  return `    { ${windowIndex}, L"${escapeWideString(window.className)}", L"${escapeWideString(window.title)}", ${Math.max(360, window.width)}, ${Math.max(220, window.height - TITLE_BAR_HEIGHT)}, ${toColorRef(window.background)}, L"${escapeWideString(openPlacement)}", ${openX}, ${openY}, g_controls_${windowIndex}, ${visibleCount}, L"${escapeWideString(menuItemsStr)}" }`;
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

function escapeIncludePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/"/g, '\\"');
}

function escapeCppComment(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\*\//g, '* /');
}

function int(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}
