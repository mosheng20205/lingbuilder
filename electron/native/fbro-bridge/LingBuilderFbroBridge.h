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
typedef uint64_t LB_FBRO_OBJECT_HANDLE;
typedef uint64_t LB_FBRO_TASK_HANDLE;
typedef uint64_t LB_FBRO_BUFFER_HANDLE;
typedef void(__stdcall* LB_FBRO_EVENT_CALLBACK)(LB_FBRO_HANDLE browser, int event_code,
                                                const wchar_t* data, void* user_data);

#define LB_FBRO_ABI_VERSION_V2 0x00020000u

enum LB_FBRO_RESULT_CODE {
  LB_FBRO_OK = 1,
  LB_FBRO_ERROR_NOT_FOUND = -1,
  LB_FBRO_ERROR_INVALID_ARGUMENT = -2,
  LB_FBRO_ERROR_BUFFER_TOO_SMALL = -3,
  LB_FBRO_ERROR_TIMEOUT = -4,
  LB_FBRO_ERROR_OPERATION_FAILED = -5,
  LB_FBRO_ERROR_WRONG_THREAD = -6,
  LB_FBRO_ERROR_RELEASED_HANDLE = -7,
  LB_FBRO_ERROR_HANDLE_TYPE = -8,
  LB_FBRO_ERROR_CANCELLED = -9,
  LB_FBRO_ERROR_NOT_SUPPORTED = -10
};

enum LB_FBRO_OBJECT_TYPE {
  LB_FBRO_OBJECT_UNKNOWN = 0,
  LB_FBRO_OBJECT_BROWSER = 1,
  LB_FBRO_OBJECT_TASK = 2,
  LB_FBRO_OBJECT_BUFFER = 3,
  LB_FBRO_OBJECT_VALUE = 10,
  LB_FBRO_OBJECT_DICTIONARY = 11,
  LB_FBRO_OBJECT_LIST = 12,
  LB_FBRO_OBJECT_STREAM = 13,
  LB_FBRO_OBJECT_IMAGE = 14,
  LB_FBRO_OBJECT_CERTIFICATE = 15,
  LB_FBRO_OBJECT_FRAME = 16,
  LB_FBRO_OBJECT_V8_VALUE = 17,
  LB_FBRO_OBJECT_CERT_PRINCIPAL = 18,
  LB_FBRO_OBJECT_DRAG_DATA = 19
};

enum LB_FBRO_TASK_STATUS {
  LB_FBRO_TASK_PENDING = 0,
  LB_FBRO_TASK_RUNNING = 1,
  LB_FBRO_TASK_COMPLETED = 2,
  LB_FBRO_TASK_FAILED = 3,
  LB_FBRO_TASK_CANCELLED = 4
};

enum LB_FBRO_INSTANCE_KIND {
  LB_FBRO_INSTANCE_EMBEDDED = 1,
  LB_FBRO_INSTANCE_CHROME_UI = 2,
  LB_FBRO_INSTANCE_OSR = 3
};

typedef struct LB_FBRO_EVENT_PACKET_V2 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t sequence;
  uint64_t timestamp_milliseconds;
  LB_FBRO_HANDLE browser;
  int32_t event_code;
  int32_t instance_kind;
  uint32_t flags;
  const wchar_t* event_name;
  const wchar_t* data_json;
  LB_FBRO_OBJECT_HANDLE object;
} LB_FBRO_EVENT_PACKET_V2;

/** 所有生成高级 wrapper 共用的只读调用包。args_json 由调用方持有，调用期间保持有效。 */
typedef struct LB_FBRO_CALL_V2 {
  uint32_t struct_size;
  uint32_t abi_version;
  LB_FBRO_HANDLE browser;
  LB_FBRO_OBJECT_HANDLE object;
  uint32_t overload_id;
  uint32_t flags;
  const wchar_t* args_json;
} LB_FBRO_CALL_V2;

/**
 * 所有生成高级 wrapper 共用的结果包。json/json_capacity 由调用方提供；
 * json_required 会返回包含结尾 NUL 所需的 wchar_t 数量。
 */
typedef struct LB_FBRO_RESULT_V2 {
  uint32_t struct_size;
  int32_t result_code;
  LB_FBRO_OBJECT_HANDLE object;
  LB_FBRO_TASK_HANDLE task;
  LB_FBRO_BUFFER_HANDLE buffer;
  wchar_t* json;
  size_t json_capacity;
  size_t json_required;
} LB_FBRO_RESULT_V2;

typedef int(__stdcall* LB_FBRO_WRAPPER_V2)(const LB_FBRO_CALL_V2* call, LB_FBRO_RESULT_V2* result);

/** 返回 0=默认、1=允许/继续、2=拒绝/取消、3=已处理。 */
typedef int(__stdcall* LB_FBRO_EVENT_CALLBACK_V2)(const LB_FBRO_EVENT_PACKET_V2* packet,
                                                  wchar_t* result_text,
                                                  size_t result_capacity,
                                                  void* user_data);
typedef void(__stdcall* LB_FBRO_TASK_CALLBACK)(LB_FBRO_TASK_HANDLE task, void* user_data);

enum LB_FBRO_EVENT_CODE {
  LB_FBRO_EVENT_CREATED = 1,
  LB_FBRO_EVENT_LOAD_END = 2,
  LB_FBRO_EVENT_ADDRESS_CHANGED = 3,
  LB_FBRO_EVENT_TITLE_CHANGED = 4,
  LB_FBRO_EVENT_CLOSED = 5,
  LB_FBRO_EVENT_ERROR = 6,
  LB_FBRO_EVENT_BEFORE_POPUP = 7,
  LB_FBRO_EVENT_CERTIFICATE_ERROR = 8,
  LB_FBRO_EVENT_DRAG_ENTER = 9,
  LB_FBRO_EVENT_VIP_DEVTOOLS_MESSAGE = 10,
  LB_FBRO_EVENT_VIP_DEVTOOLS_RESULT = 11,
  LB_FBRO_EVENT_VIP_DEVTOOLS_EVENT = 12,
  LB_FBRO_EVENT_VIP_DEVTOOLS_ATTACHED = 13,
  LB_FBRO_EVENT_VIP_DEVTOOLS_DETACHED = 14,
  LB_FBRO_EVENT_VIP_LIFECYCLE = 15
};

LB_FBRO_API int __stdcall LB_FBro_Initialize(const wchar_t* runtime_directory);
LB_FBRO_API uint32_t __stdcall LB_FBro_GetAbiVersion(void);
LB_FBRO_API int __stdcall LB_FBro_IsReady(void);
LB_FBRO_API int __stdcall LB_FBro_GetVipLicenseInfoJson(wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_SetVipStartupProxy(const wchar_t* url,
                                                      const wchar_t* user,
                                                      const wchar_t* password);
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
LB_FBRO_API int __stdcall LB_FBro_ReloadIgnoreCache(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_Stop(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_CanGoBack(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_CanGoForward(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_IsLoading(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_GetZoomLevel(LB_FBRO_HANDLE browser, double* zoom_level);
LB_FBRO_API int __stdcall LB_FBro_SetZoomLevel(LB_FBRO_HANDLE browser, double zoom_level);
LB_FBRO_API int __stdcall LB_FBro_IsAudioMuted(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_SetAudioMuted(LB_FBRO_HANDLE browser, int muted);
LB_FBRO_API int __stdcall LB_FBro_SendFocusEvent(LB_FBRO_HANDLE browser, int focused);
LB_FBRO_API int __stdcall LB_FBro_Find(LB_FBRO_HANDLE browser, const wchar_t* text,
                                       int forward, int match_case, int find_next);
LB_FBRO_API int __stdcall LB_FBro_StopFinding(LB_FBRO_HANDLE browser, int clear_selection);
LB_FBRO_API int __stdcall LB_FBro_HasDevTools(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_CloseDevTools(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_GetIdentifier(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_IsSame(LB_FBRO_HANDLE browser, LB_FBRO_HANDLE other);
LB_FBRO_API int __stdcall LB_FBro_IsPopup(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_HasDocument(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_TryCloseBrowser(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_SetFocus(LB_FBRO_HANDLE browser, int focused);
LB_FBRO_API int __stdcall LB_FBro_HasView(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_SetAutoResizeEnabled(LB_FBRO_HANDLE browser, int enabled,
                                                       int min_height, int min_width,
                                                       int max_height, int max_width);
LB_FBRO_API int __stdcall LB_FBro_ExecuteJs(LB_FBRO_HANDLE browser, const wchar_t* script,
                                            wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_SetProxy(LB_FBRO_HANDLE browser, const wchar_t* proxy,
                                           const wchar_t* username, const wchar_t* password);
LB_FBRO_API int __stdcall LB_FBro_SetUserAgent(LB_FBRO_HANDLE browser, const wchar_t* user_agent);
LB_FBRO_API int __stdcall LB_FBro_GetCookies(LB_FBRO_HANDLE browser, const wchar_t* url,
                                             wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ClearCookies(LB_FBRO_HANDLE browser, const wchar_t* url);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieVisitAllAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieVisitUrlAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, int include_http_only,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieSetAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* name, const wchar_t* value,
    const wchar_t* domain, const wchar_t* path, int secure, int http_only,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieDeleteAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* name,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieFlushAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ClearCacheAsync(
    LB_FBRO_HANDLE browser, const wchar_t* origin, uint32_t remove_flags, uint32_t quota_flags,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ClearGlobalCacheAsync(
    const wchar_t* origin, uint32_t remove_flags, uint32_t quota_flags,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_StartDownload(LB_FBRO_HANDLE browser, const wchar_t* url);
LB_FBRO_API int __stdcall LB_FBro_Print(LB_FBRO_HANDLE browser);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_PrintToPdfAsync(
    LB_FBRO_HANDLE browser, const wchar_t* path, const wchar_t* settings_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_RunFileDialogAsync(
    LB_FBRO_HANDLE browser, int mode, const wchar_t* title, const wchar_t* default_path,
    const wchar_t* accept_filters_json, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CaptureScreenshotAsync(
    LB_FBRO_HANDLE browser, const wchar_t* format, int quality,
    int x, int y, int width, int height, int scale,
    int from_surface, int capture_beyond_viewport,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_GetTitle(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetUrl(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetLastEvent(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetLastError(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_SetEventCallbackV2(LB_FBRO_HANDLE browser,
                                                     LB_FBRO_EVENT_CALLBACK_V2 callback,
                                                     void* user_data);
LB_FBRO_API int __stdcall LB_FBro_GetLastEventJson(LB_FBRO_HANDLE browser,
                                                   wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetInstanceKind(LB_FBRO_HANDLE browser);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ExecuteJsAsync(LB_FBRO_HANDLE browser,
                                                                 const wchar_t* script,
                                                                 LB_FBRO_TASK_CALLBACK callback,
                                                                 void* user_data);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetMainFrame(LB_FBRO_HANDLE browser);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFocusedFrame(LB_FBRO_HANDLE browser);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFrameByIdentifier(
    LB_FBRO_HANDLE browser, const wchar_t* identifier);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFrameByName(
    LB_FBRO_HANDLE browser, const wchar_t* name);
LB_FBRO_API int __stdcall LB_FBro_BrowserGetFrameIdentifiersJson(
    LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_BrowserGetFrameNamesJson(
    LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_FrameIsValid(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameIsMain(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameIsFocused(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameGetUrl(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_FrameGetName(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_FrameGetIdentifier(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_FrameGetParent(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_FrameGetBrowser(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameUndo(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameRedo(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameCut(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameCopy(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FramePaste(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameDelete(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameSelectAll(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameViewSource(LB_FBRO_OBJECT_HANDLE frame);
LB_FBRO_API int __stdcall LB_FBro_FrameLoadUrl(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* url);
LB_FBRO_API int __stdcall LB_FBro_FrameExecuteJavaScript(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* code, const wchar_t* script_url, int start_line);
LB_FBRO_API int __stdcall LB_FBro_TaskGetStatus(LB_FBRO_TASK_HANDLE task);
LB_FBRO_API int __stdcall LB_FBro_TaskGetResult(LB_FBRO_TASK_HANDLE task, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_TaskGetError(LB_FBRO_TASK_HANDLE task, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_TaskWait(LB_FBRO_TASK_HANDLE task, int timeout_milliseconds);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_TaskGetObject(LB_FBRO_TASK_HANDLE task);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_TaskGetBuffer(LB_FBRO_TASK_HANDLE task);
LB_FBRO_API int __stdcall LB_FBro_TaskCancel(LB_FBRO_TASK_HANDLE task);
LB_FBRO_API int __stdcall LB_FBro_TaskRelease(LB_FBRO_TASK_HANDLE task);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_BufferCreate(const void* data, size_t size);
LB_FBRO_API int __stdcall LB_FBro_BufferGetSize(LB_FBRO_BUFFER_HANDLE buffer, uint64_t* size);
LB_FBRO_API int __stdcall LB_FBro_BufferToHex(LB_FBRO_BUFFER_HANDLE buffer, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_BufferSaveFile(LB_FBRO_BUFFER_HANDLE buffer, const wchar_t* path);
LB_FBRO_API int __stdcall LB_FBro_BufferRelease(LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_ObjectGetType(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ObjectRelease(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueCreate(void);
LB_FBRO_API int __stdcall LB_FBro_ValueIsValid(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueIsOwned(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueIsReadOnly(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API int __stdcall LB_FBro_ValueIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueCopy(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueGetType(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueGetBool(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueGetInt(LB_FBRO_OBJECT_HANDLE object, int* value);
LB_FBRO_API int __stdcall LB_FBro_ValueGetDouble(LB_FBRO_OBJECT_HANDLE object, double* value);
LB_FBRO_API int __stdcall LB_FBro_ValueGetString(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ValueSetNull(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueSetBool(LB_FBRO_OBJECT_HANDLE object, int value);
LB_FBRO_API int __stdcall LB_FBro_ValueSetInt(LB_FBRO_OBJECT_HANDLE object, int value);
LB_FBRO_API int __stdcall LB_FBro_ValueSetDouble(LB_FBRO_OBJECT_HANDLE object, double value);
LB_FBRO_API int __stdcall LB_FBro_ValueSetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* value);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ValueGetBinary(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueSetBinary(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueGetDictionary(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueGetList(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ValueSetDictionary(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE dictionary);
LB_FBRO_API int __stdcall LB_FBro_ValueSetList(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE list);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryCreate(void);
LB_FBRO_API int __stdcall LB_FBro_DictionaryIsValid(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DictionaryIsOwned(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DictionaryIsReadOnly(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DictionaryIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API int __stdcall LB_FBro_DictionaryIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryCopy(LB_FBRO_OBJECT_HANDLE object, int exclude_empty_children);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetSize(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DictionaryClear(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DictionaryHasKey(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionaryRemove(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetType(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetBool(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetInt(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int* value);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetDouble(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, double* value);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                       wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DictionaryGetKeysJson(LB_FBRO_OBJECT_HANDLE object,
                                                         wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetValue(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_DictionaryGetBinary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetDictionary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetList(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetNull(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetBool(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int value);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetInt(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int value);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetDouble(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, double value);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                       const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetValue(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                      LB_FBRO_OBJECT_HANDLE value);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetBinary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                       LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetDictionary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                           LB_FBRO_OBJECT_HANDLE dictionary);
LB_FBRO_API int __stdcall LB_FBro_DictionarySetList(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                                     LB_FBRO_OBJECT_HANDLE list);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListCreate(void);
LB_FBRO_API int __stdcall LB_FBro_ListIsValid(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListIsOwned(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListIsReadOnly(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API int __stdcall LB_FBro_ListIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListCopy(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListSetSize(LB_FBRO_OBJECT_HANDLE object, int size);
LB_FBRO_API int __stdcall LB_FBro_ListGetSize(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListClear(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ListRemove(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_ListGetType(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_ListGetBool(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_ListGetInt(LB_FBRO_OBJECT_HANDLE object, int index, int* value);
LB_FBRO_API int __stdcall LB_FBro_ListGetDouble(LB_FBRO_OBJECT_HANDLE object, int index, double* value);
LB_FBRO_API int __stdcall LB_FBro_ListGetString(LB_FBRO_OBJECT_HANDLE object, int index,
                                                 wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetValue(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ListGetBinary(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetDictionary(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetList(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_ListSetNull(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_ListSetBool(LB_FBRO_OBJECT_HANDLE object, int index, int value);
LB_FBRO_API int __stdcall LB_FBro_ListSetInt(LB_FBRO_OBJECT_HANDLE object, int index, int value);
LB_FBRO_API int __stdcall LB_FBro_ListSetDouble(LB_FBRO_OBJECT_HANDLE object, int index, double value);
LB_FBRO_API int __stdcall LB_FBro_ListSetString(LB_FBRO_OBJECT_HANDLE object, int index, const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_ListSetValue(LB_FBRO_OBJECT_HANDLE object, int index, LB_FBRO_OBJECT_HANDLE value);
LB_FBRO_API int __stdcall LB_FBro_ListSetBinary(LB_FBRO_OBJECT_HANDLE object, int index, LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_ListSetDictionary(LB_FBRO_OBJECT_HANDLE object, int index,
                                                     LB_FBRO_OBJECT_HANDLE dictionary);
LB_FBRO_API int __stdcall LB_FBro_ListSetList(LB_FBRO_OBJECT_HANDLE object, int index, LB_FBRO_OBJECT_HANDLE list);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_StreamCreateForFile(const wchar_t* path);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_StreamCreateForBuffer(LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_StreamRead(LB_FBRO_OBJECT_HANDLE stream, size_t size, size_t count);
LB_FBRO_API int __stdcall LB_FBro_StreamSeek(LB_FBRO_OBJECT_HANDLE stream, int64_t offset, int whence);
LB_FBRO_API int __stdcall LB_FBro_StreamTell(LB_FBRO_OBJECT_HANDLE stream, int64_t* offset);
LB_FBRO_API int __stdcall LB_FBro_StreamEof(LB_FBRO_OBJECT_HANDLE stream);
LB_FBRO_API int __stdcall LB_FBro_StreamMayBlock(LB_FBRO_OBJECT_HANDLE stream);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DownloadImageAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, int is_favicon, uint32_t max_image_size,
    int bypass_cache, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_ImageIsEmpty(LB_FBRO_OBJECT_HANDLE image);
LB_FBRO_API int __stdcall LB_FBro_ImageGetWidth(LB_FBRO_OBJECT_HANDLE image);
LB_FBRO_API int __stdcall LB_FBro_ImageGetHeight(LB_FBRO_OBJECT_HANDLE image);
LB_FBRO_API int __stdcall LB_FBro_ImageGetRepresentationInfo(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, float* actual_scale_factor,
    int* pixel_width, int* pixel_height);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsBitmap(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int color_type, int alpha_type,
    int* pixel_width, int* pixel_height);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsJpeg(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int quality,
    int* pixel_width, int* pixel_height);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsPng(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int with_transparency,
    int* pixel_width, int* pixel_height);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_GetCurrentCertificateAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_CertificateGetSubject(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_CertificateGetIssuer(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetSerialNumber(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetDerEncoded(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetPemEncoded(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API int __stdcall LB_FBro_CertificateGetValidStart(LB_FBRO_OBJECT_HANDLE certificate, int64_t* value);
LB_FBRO_API int __stdcall LB_FBro_CertificateGetValidExpiry(LB_FBRO_OBJECT_HANDLE certificate, int64_t* value);
LB_FBRO_API int __stdcall LB_FBro_CertificateGetIssuerChainSize(LB_FBRO_OBJECT_HANDLE certificate);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetDerIssuerChainItem(
    LB_FBRO_OBJECT_HANDLE certificate, int index);
LB_FBRO_API LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetPemIssuerChainItem(
    LB_FBRO_OBJECT_HANDLE certificate, int index);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetDisplayName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetCommonName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetLocalityName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetStateOrProvinceName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetCountryName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetOrganizationNamesJson(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_PrincipalGetOrganizationUnitNamesJson(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_GetLastEventObject(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_DragDataHasImage(LB_FBRO_OBJECT_HANDLE drag_data);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DragDataGetImage(LB_FBRO_OBJECT_HANDLE drag_data);
LB_FBRO_API int __stdcall LB_FBro_ApplyFingerprintJson(LB_FBRO_HANDLE browser, const wchar_t* json);
LB_FBRO_API int __stdcall LB_FBro_GetAppliedFingerprintJson(LB_FBRO_HANDLE browser,
                                                            wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetFingerprintCallCount(LB_FBRO_HANDLE browser,
                                                          wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ClearFingerprintCallCount(LB_FBRO_HANDLE browser);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipDomCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipExtensionCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipResourceCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipDevToolsCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_Resize(LB_FBRO_HANDLE browser);
LB_FBRO_API void __stdcall LB_FBro_Close(LB_FBRO_HANDLE browser);
LB_FBRO_API void __stdcall LB_FBro_Shutdown(void);
