import { CppFile, GlossaryTerm, ProblemItem } from '../types';

export const defaultGlossary: GlossaryTerm[] = [
  { english: 'initialize', chinese: '初始化', description: 'Setup variables or subsystem' },
  { english: 'render', chinese: '渲染', description: 'Draw graphical elements' },
  { english: 'buffer', chinese: '缓冲区', description: 'Temporary memory block' },
  { english: 'callback', chinese: '回调函数', description: 'Function passed to another to be executed' },
  { english: 'dialog', chinese: '对话框', description: 'Pop-up window for user interaction' },
  { english: 'configuration', chinese: '配置', description: 'System or application settings' },
  { english: 'error', chinese: '错误', description: 'Exceptional condition or failure' },
  { english: 'success', chinese: '成功', description: 'Normal completion of task' },
  { english: 'pointer', chinese: '指针', description: 'Address reference' },
  { english: 'thread', chinese: '线程', description: 'Execution context' }
];

export const initialFiles: CppFile[] = [
  {
    path: 'src/main.cpp',
    name: 'main.cpp',
    language: 'cpp',
    originalContent: `#include <windows.h>
#include <iostream>
#include "resource.h"

// Global Variables:
HINSTANCE hInst;
WCHAR szTitle[100] = L"My Awesome Game Client v1.0";
WCHAR szWindowClass[100] = L"GAME_CLIENT_CLASS";

// Forward declarations of functions included in this code module:
ATOM                MyRegisterClass(HINSTANCE hInstance);
BOOL                InitInstance(HINSTANCE, int);
LRESULT CALLBACK    WndProc(HWND, UINT, WPARAM, LPARAM);

int APIENTRY wWinMain(_In_ HINSTANCE hInstance,
                     _In_opt_ HINSTANCE hPrevInstance,
                     _In_ LPWSTR    lpCmdLine,
                     _In_ int       nCmdShow)
{
    // Initialize global strings
    LoadStringW(hInstance, IDS_APP_TITLE, szTitle, 100);
    
    // TODO: Add initialization code here.
    std::cout << "Starting initialization of game engine..." << std::endl;
    
    if (!InitInstance(hInstance, nCmdShow))
    {
        MessageBoxA(NULL, "Critical Error: Engine failed to initialize! Please check configuration.", "Initialization Failure", MB_ICONERROR | MB_OK);
        return FALSE;
    }

    std::cout << "Render engine active. Entering message loop." << std::endl;

    MSG msg;
    // Main message loop:
    while (GetMessage(&msg, nullptr, 0, 0))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return (int) msg.wParam;
}

BOOL InitInstance(HINSTANCE hInstance, int nCmdShow)
{
   hInst = hInstance; // Store instance handle in our global variable

   HWND hWnd = CreateWindowW(szWindowClass, szTitle, WS_OVERLAPPEDWINDOW,
      CW_USEDEFAULT, 0, 800, 600, nullptr, nullptr, hInstance, nullptr);

   if (!hWnd)
   {
      std::cerr << "Window creation failed with error code: " << GetLastError() << std::endl;
      return FALSE;
   }

   ShowWindow(hWnd, nCmdShow);
   UpdateWindow(hWnd);

   return TRUE;
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
    case WM_PAINT:
        {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hWnd, &ps);
            // TODO: Add any drawing code that uses hdc here...
            TextOutW(hdc, 50, 50, L"Welcome to the game world! Press Space to jump.", 46);
            EndPaint(hWnd, &ps);
        }
        break;
    case WM_COMMAND:
        {
            int wmId = LOWORD(wParam);
            // Parse the menu selections:
            switch (wmId)
            {
            case IDM_EXIT:
                if (MessageBoxA(hWnd, "Are you sure you want to quit?", "Quit Game", MB_YESNO | MB_ICONQUESTION) == IDYES)
                {
                    DestroyWindow(hWnd);
                }
                break;
            default:
                return DefWindowProc(hWnd, message, wParam, lParam);
            }
        }
        break;
    case WM_DESTROY:
        PostQuitMessage(0);
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}`,
    translatedContent: '',
    strings: [
      { id: 'm1', original: 'My Awesome Game Client v1.0', translated: '', line: 7, type: 'string', status: 'pending', context: 'WCHAR szTitle[100] = L"My Awesome Game Client v1.0";' },
      { id: 'm2', original: 'Starting initialization of game engine...', translated: '', line: 25, type: 'string', status: 'pending', context: 'std::cout << "Starting initialization of game engine..." << std::endl;' },
      { id: 'm3', original: 'Critical Error: Engine failed to initialize! Please check configuration.', translated: '', line: 29, type: 'string', status: 'pending', context: 'MessageBoxA(NULL, "Critical Error: Engine failed to initialize! Please check configuration.", "Initialization Failure", MB_ICONERROR | MB_OK);' },
      { id: 'm4', original: 'Initialization Failure', translated: '', line: 29, type: 'string', status: 'pending', context: 'MessageBoxA(NULL, "Critical Error...", "Initialization Failure", MB_ICONERROR | MB_OK);' },
      { id: 'm5', original: 'Render engine active. Entering message loop.', translated: '', line: 33, type: 'string', status: 'pending', context: 'std::cout << "Render engine active. Entering message loop." << std::endl;' },
      { id: 'm6', original: 'Window creation failed with error code: ', translated: '', line: 55, type: 'string', status: 'pending', context: 'std::cerr << "Window creation failed with error code: " << GetLastError() << std::endl;' },
      { id: 'm7', original: 'Welcome to the game world! Press Space to jump.', translated: '', line: 73, type: 'string', status: 'pending', context: 'TextOutW(hdc, 50, 50, L"Welcome to the game world! Press Space to jump.", 46);' },
      { id: 'm8', original: 'Are you sure you want to quit?', translated: '', line: 83, type: 'string', status: 'pending', context: 'if (MessageBoxA(hWnd, "Are you sure you want to quit?", "Quit Game", MB_YESNO | MB_ICONQUESTION) == IDYES)' },
      { id: 'm9', original: 'Quit Game', translated: '', line: 83, type: 'string', status: 'pending', context: 'if (MessageBoxA(hWnd, "Are you sure you want to quit?", "Quit Game", MB_YESNO | MB_ICONQUESTION) == IDYES)' },
      { id: 'm10', original: 'Global Variables:', translated: '', line: 5, type: 'comment', status: 'pending', context: '// Global Variables:' },
      { id: 'm11', original: 'Forward declarations of functions included in this code module:', translated: '', line: 10, type: 'comment', status: 'pending', context: '// Forward declarations of functions included in this code module:' },
      { id: 'm12', original: 'Initialize global strings', translated: '', line: 21, type: 'comment', status: 'pending', context: '// Initialize global strings' },
      { id: 'm13', original: 'TODO: Add initialization code here.', translated: '', line: 24, type: 'comment', status: 'pending', context: '// TODO: Add initialization code here.' },
      { id: 'm14', original: 'Main message loop:', translated: '', line: 36, type: 'comment', status: 'pending', context: '// Main message loop:' },
      { id: 'm15', original: 'Store instance handle in our global variable', translated: '', line: 49, type: 'comment', status: 'pending', context: 'hInst = hInstance; // Store instance handle in our global variable' },
      { id: 'm16', original: 'TODO: Add any drawing code that uses hdc here...', translated: '', line: 72, type: 'comment', status: 'pending', context: '// TODO: Add any drawing code that uses hdc here...' },
      { id: 'm17', original: 'Parse the menu selections:', translated: '', line: 80, type: 'comment', status: 'pending', context: '// Parse the menu selections:' }
    ],
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    isModified: false
  },
  {
    path: 'src/resource.h',
    name: 'resource.h',
    language: 'header',
    originalContent: `//{{NO_DEPENDENCIES}}
// Microsoft Visual C++ generated include file.
// Used by game_client.rc

#define IDS_APP_TITLE            103
#define IDI_GAME_CLIENT          107
#define IDI_SMALL                108
#define IDC_GAME_CLIENT          109

#define IDD_ABOUTBOX             110
#define IDM_ABOUT                120
#define IDM_EXIT                 121

// Next default values for new objects
// 
#ifdef APSTUDIO_INVOKED
#ifndef APSTUDIO_READONLY_SYMBOLS
#define _APS_NO_MFC              1
#define _APS_NEXT_RESOURCE_VALUE 129
#define _APS_NEXT_COMMAND_VALUE  32771
#define _APS_NEXT_CONTROL_VALUE  1000
#define _APS_NEXT_SYMED_VALUE    110
#endif
#endif`,
    translatedContent: '',
    strings: [
      { id: 'h1', original: 'Microsoft Visual C++ generated include file.', translated: '', line: 2, type: 'comment', status: 'pending', context: '// Microsoft Visual C++ generated include file.' },
      { id: 'h2', original: 'Used by game_client.rc', translated: '', line: 3, type: 'comment', status: 'pending', context: '// Used by game_client.rc' },
      { id: 'h3', original: 'Next default values for new objects', translated: '', line: 14, type: 'comment', status: 'pending', context: '// Next default values for new objects' }
    ],
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    isModified: false
  },
  {
    path: 'src/game_client.rc',
    name: 'game_client.rc',
    language: 'resource',
    originalContent: `#include "resource.h"
#include "winres.h"

// String Table
STRINGTABLE
BEGIN
    IDS_APP_TITLE       "Space Adventure Client"
    IDC_GAME_CLIENT     "SPACE_ADVENTURE_CLASS"
END

// Dialog
IDD_ABOUTBOX DIALOGEX 0, 0, 170, 62
STYLE DS_SETFONT | DS_MODALFRAME | DS_FIXEDSYS | WS_POPUP | WS_CAPTION | WS_SYSMENU
CAPTION "About Space Adventure"
FONT 8, "MS Shell Dlg", 0, 0, 0x1
BEGIN
    ICON            IDI_GAME_CLIENT,IDC_STATIC,14,14,21,20
    LTEXT           "Space Adventure, Version 1.0",IDC_STATIC,42,14,114,8,SS_NOPREFIX
    LTEXT           "Copyright (C) 2026 Space Dev. All rights reserved.",IDC_STATIC,42,26,114,8
    DEFPUSHBUTTON   "OK",IDOK,113,41,50,14,WS_GROUP
END`,
    translatedContent: '',
    strings: [
      { id: 'r1', original: 'Space Adventure Client', translated: '', line: 8, type: 'resource', status: 'pending', context: 'IDS_APP_TITLE       "Space Adventure Client"' },
      { id: 'r2', original: 'About Space Adventure', translated: '', line: 15, type: 'resource', status: 'pending', context: 'CAPTION "About Space Adventure"' },
      { id: 'r3', original: 'Space Adventure, Version 1.0', translated: '', line: 18, type: 'resource', status: 'pending', context: 'LTEXT           "Space Adventure, Version 1.0",IDC_STATIC,42,14,114,8,SS_NOPREFIX' },
      { id: 'r4', original: 'Copyright (C) 2026 Space Dev. All rights reserved.', translated: '', line: 19, type: 'resource', status: 'pending', context: 'LTEXT           "Copyright (C) 2026 Space Dev. All rights reserved.",IDC_STATIC,42,26,114,8' },
      { id: 'r5', original: 'OK', translated: '', line: 20, type: 'resource', status: 'pending', context: 'DEFPUSHBUTTON   "OK",IDOK,113,41,50,14,WS_GROUP' }
    ],
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    isModified: false
  },
  {
    path: 'config/config.ini',
    name: 'config.ini',
    language: 'ini',
    originalContent: `[Engine]
EnableShadows = true
ResolutionWidth = 1920
ResolutionHeight = 1080
EngineMode = "Performance Optimization Mode"

[UI]
WelcomeMessage = "Welcome Player! Connect to the server to start your journey."
ExitConfirmation = "Do you really want to exit the Game Universe?"
LoadingText = "Teleporting to outer space... Please wait."`,
    translatedContent: '',
    strings: [
      { id: 'i1', original: 'Performance Optimization Mode', translated: '', line: 5, type: 'string', status: 'pending', context: 'EngineMode = "Performance Optimization Mode"' },
      { id: 'i2', original: 'Welcome Player! Connect to the server to start your journey.', translated: '', line: 8, type: 'string', status: 'pending', context: 'WelcomeMessage = "Welcome Player! Connect to the server to start your journey."' },
      { id: 'i3', original: 'Do you really want to exit the Game Universe?', translated: '', line: 9, type: 'string', status: 'pending', context: 'ExitConfirmation = "Do you really want to exit the Game Universe?"' },
      { id: 'i4', original: 'Teleporting to outer space... Please wait.', translated: '', line: 10, type: 'string', status: 'pending', context: 'LoadingText = "Teleporting to outer space... Please wait."' }
    ],
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    isModified: false
  },
  {
    path: 'src/游戏主窗体.lcpp',
    name: '游戏主窗体.lcpp',
    language: 'lingcpp',
    originalContent: `包 太空冒险
使用 Win32窗口
使用 标准控件

类 游戏主窗体 : 公开 窗体
公开:
    文本型 关联设计文件 = "MainWindow.xml"
    按钮 按钮1
    按钮 按钮2
    文本型 系统配置

    构造()
        调试输出("太空冒险游戏主窗体初始化完毕。")

    事件 _游戏主窗体_创建完毕()
        调试输出("正在载入窗口设计文件。")

    事件 _按钮1_被单击()
        信息框("开始运行太空冒险游戏客户端！", 64, "运行成功")
        调试输出("玩家已点击：按钮1")

    事件 _按钮2_被单击()
        如果 (信息框("您确定要退出游戏吗？", 36, "退出确认") == 6)
            结束()
        如果结束
结束类`,
    translatedContent: '',
    strings: [
      { id: 'lc1', original: 'MainWindow.xml', translated: '', line: 6, type: 'string', status: 'pending', context: '文本型 关联设计文件 = "MainWindow.xml"' },
      { id: 'lc2', original: '开始运行太空冒险游戏客户端！', translated: '', line: 14, type: 'string', status: 'pending', context: '信息框("开始运行太空冒险游戏客户端！", 64, "运行成功")' },
      { id: 'lc3', original: '您确定要退出游戏吗？', translated: '', line: 18, type: 'string', status: 'pending', context: '如果 (信息框("您确定要退出游戏吗？", 36, "退出确认") == 6)' }
    ],
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    isModified: false
  }
];

export const mockProblems: ProblemItem[] = [
  {
    id: 'p1',
    filePath: 'src/main.cpp',
    line: 29,
    level: 'warning',
    message: 'Hardcoded string in MessageBoxA without prefix L. This should be a wide string (L"...") or resource ID to support multi-language unicode characters properly.',
    codeSnippet: 'MessageBoxA(NULL, "Critical Error: Engine failed to initialize!...", "Initialization Failure", ...)',
    suggestion: 'Use MessageBoxW and wrap string literals in L"" or, better, extract to game_client.rc string table.'
  },
  {
    id: 'p2',
    filePath: 'src/main.cpp',
    line: 73,
    level: 'error',
    message: 'Fixed character count (46) hardcoded in TextOutW. After translation, the Chinese string will have a different character length, causing the text to be truncated or trailing garbage characters.',
    codeSnippet: 'TextOutW(hdc, 50, 50, L"Welcome to the game world!...", 46);',
    suggestion: 'Use wcslen(translatedString) to dynamically measure string length instead of a hardcoded length parameter.'
  },
  {
    id: 'p3',
    filePath: 'src/game_client.rc',
    line: 16,
    level: 'info',
    message: 'Font "MS Shell Dlg" selected. After Chinese localization, this Western font might display glyphs with pixelated aliasing or box fallbacks.',
    codeSnippet: 'FONT 8, "MS Shell Dlg", 0, 0, 0x1',
    suggestion: 'Change to "Microsoft YaHei" (微软雅黑) or system default font for perfect Chinese display.'
  }
];

// Local instant translator mapping (fallback/mock translation if API key is not configured or for super-fast offline use)
export const localTranslations: Record<string, string> = {
  'My Awesome Game Client v1.0': '我的绝佳游戏客户端 v1.0',
  'Starting initialization of game engine...': '开始初始化游戏引擎...',
  'Critical Error: Engine failed to initialize! Please check configuration.': '关键错误：引擎初始化失败！请检查系统配置。',
  'Initialization Failure': '初始化失败',
  'Render engine active. Entering message loop.': '渲染引擎已激活。正在进入消息循环。',
  'Window creation failed with error code: ': '窗口创建失败，错误代码：',
  'Welcome to the game world! Press Space to jump.': '欢迎来到游戏世界！按空格键跳跃。',
  'Are you sure you want to quit?': '您确定要退出游戏吗？',
  'Quit Game': '退出游戏',
  'Global Variables:': '全局变量：',
  'Forward declarations of functions included in this code module:': '本代码模块中包含的函数前置声明：',
  'Initialize global strings': '初始化全局字符串',
  'TODO: Add initialization code here.': '待办：在此处添加初始化代码。',
  'Main message loop:': '主消息循环：',
  'Store instance handle in our global variable': '在全局变量中保存实例句柄',
  'TODO: Add any drawing code that uses hdc here...': '待办：在此处添加任何使用 hdc 的绘制代码...',
  'Parse the menu selections:': '解析菜单选择：',
  'Microsoft Visual C++ generated include file.': 'Microsoft Visual C++ 自动生成的头文件。',
  'Used by game_client.rc': '供 game_client.rc 使用',
  'Next default values for new objects': '新对象的下一个默认值',
  'Space Adventure Client': '太空冒险游戏客户端',
  'About Space Adventure': '关于太空冒险',
  'Space Adventure, Version 1.0': '太空冒险，版本 1.0',
  'Copyright (C) 2026 Space Dev. All rights reserved.': '版权所有 (C) 2026 太空开发团队。保留所有权利。',
  'OK': '确定',
  'Performance Optimization Mode': '性能优化模式',
  'Welcome Player! Connect to the server to start your journey.': '欢迎玩家！连接服务器以开启您的旅程。',
  'Do you really want to exit the Game Universe?': '您真的想要退出游戏宇宙吗？',
  'Teleporting to outer space... Please wait.': '正在传送到外太空... 请稍候。'
};
