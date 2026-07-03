#include <windows.h>
#include <iostream>
#include "resource.h"

// 全局变量：
HINSTANCE hInst;
WCHAR szTitle[100] = L"我的绝佳游戏客户端 v1.0";
WCHAR szWindowClass[100] = L"GAME_CLIENT_CLASS";

// 本代码模块中包含的函数前置声明：
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
            // 待办：在此处添加任何使用 hdc 的绘制代码...
            TextOutW(hdc, 50, 50, L"欢迎来到游戏世界！按空格键跳跃。", 46);
            EndPaint(hWnd, &ps);
        }
        break;
    case WM_COMMAND:
        {
            int wmId = LOWORD(wParam);
            // 解析菜单选择：
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
}