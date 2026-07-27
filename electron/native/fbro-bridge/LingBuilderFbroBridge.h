#pragma once

#include <stddef.h>
#include <stdint.h>
#include <windows.h>

#if defined(LINGBUILDER_FBRO_BRIDGE_EXPORTS)
#define LB_FBRO_API extern "C" __declspec(dllexport)
#else
#define LB_FBRO_API extern "C" __declspec(dllimport)
#endif

typedef uintptr_t LB_FBRO_HANDLE;
typedef void(__stdcall* LB_FBRO_EVENT_CALLBACK)(LB_FBRO_HANDLE browser, int event_code,
                                                const wchar_t* data, void* user_data);

enum LB_FBRO_EVENT_CODE {
  LB_FBRO_EVENT_CREATED = 1,
  LB_FBRO_EVENT_LOAD_END = 2,
  LB_FBRO_EVENT_ADDRESS_CHANGED = 3,
  LB_FBRO_EVENT_TITLE_CHANGED = 4,
  LB_FBRO_EVENT_CLOSED = 5,
  LB_FBRO_EVENT_ERROR = 6,
  LB_FBRO_EVENT_BEFORE_POPUP = 7
};

LB_FBRO_API int __stdcall LB_FBro_Initialize(const wchar_t* runtime_directory);
LB_FBRO_API int __stdcall LB_FBro_IsReady(void);
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_Create(HWND host, const wchar_t* url,
                                                    const wchar_t* profile_directory,
                                                    LB_FBRO_EVENT_CALLBACK callback,
                                                    void* user_data);
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_CreateEx(HWND host, const wchar_t* url,
                                                      const wchar_t* profile_directory,
                                                      const wchar_t* user_agent, unsigned int flags,
                                                      LB_FBRO_EVENT_CALLBACK callback,
                                                      void* user_data);
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_CreateChromeUi(LB_FBRO_HANDLE owner,
                                                            const wchar_t* url,
                                                            LB_FBRO_EVENT_CALLBACK callback,
                                                            void* user_data);
LB_FBRO_API int __stdcall LB_FBro_Navigate(LB_FBRO_HANDLE browser, const wchar_t* url);
LB_FBRO_API int __stdcall LB_FBro_GoBack(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_GoForward(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_Reload(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_Stop(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_ExecuteJs(LB_FBRO_HANDLE browser, const wchar_t* script,
                                            wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_SetProxy(LB_FBRO_HANDLE browser, const wchar_t* proxy,
                                           const wchar_t* username, const wchar_t* password);
LB_FBRO_API int __stdcall LB_FBro_SetUserAgent(LB_FBRO_HANDLE browser, const wchar_t* user_agent);
LB_FBRO_API int __stdcall LB_FBro_GetCookies(LB_FBRO_HANDLE browser, const wchar_t* url,
                                             wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ClearCookies(LB_FBRO_HANDLE browser, const wchar_t* url);
LB_FBRO_API int __stdcall LB_FBro_GetTitle(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetUrl(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetLastEvent(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetLastError(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ApplyFingerprintJson(LB_FBRO_HANDLE browser, const wchar_t* json);
LB_FBRO_API int __stdcall LB_FBro_GetFingerprintCallCount(LB_FBRO_HANDLE browser,
                                                          wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ClearFingerprintCallCount(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_Resize(LB_FBRO_HANDLE browser);
LB_FBRO_API void __stdcall LB_FBro_Close(LB_FBRO_HANDLE browser);
LB_FBRO_API void __stdcall LB_FBro_Shutdown(void);
