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
typedef uint64_t LB_FBRO_CONTINUATION_HANDLE;
typedef void(__stdcall* LB_FBRO_EVENT_CALLBACK)(LB_FBRO_HANDLE browser, int event_code,
                                                const wchar_t* data, void* user_data);

#define LB_FBRO_ABI_VERSION_V2 0x00020000u
#define LB_FBRO_ABI_VERSION_V3 0x00030000u

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
  LB_FBRO_OBJECT_DRAG_DATA = 19,
  LB_FBRO_OBJECT_MENU_MODEL = 20,
  LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS = 21,
  LB_FBRO_OBJECT_REQUEST = 22,
  LB_FBRO_OBJECT_POST_DATA = 23,
  LB_FBRO_OBJECT_POST_DATA_ELEMENT = 24,
  LB_FBRO_OBJECT_PROCESS_MESSAGE = 25,
  LB_FBRO_OBJECT_URL_REQUEST = 26,
  LB_FBRO_OBJECT_REQUEST_CONTEXT = 27,
  LB_FBRO_OBJECT_SERVER = 28,
  LB_FBRO_OBJECT_WSS_CLIENT = 29,
  LB_FBRO_OBJECT_DOM_SNAPSHOT = 30,
  LB_FBRO_OBJECT_DOWNLOAD_ITEM = 31,
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

enum LB_FBRO_EVENT_FLAGS {
  LB_FBRO_EVENT_FLAG_SYNCHRONOUS = 1u << 0,
  LB_FBRO_EVENT_FLAG_DEFERRED = 1u << 1,
  LB_FBRO_EVENT_FLAG_HIGH_FREQUENCY = 1u << 2,
  LB_FBRO_EVENT_FLAG_COALESCED = 1u << 3,
  LB_FBRO_EVENT_FLAG_INTERNAL = 1u << 4
};

enum LB_FBRO_EVENT_ACTION {
  LB_FBRO_EVENT_ACTION_DEFAULT = 0,
  LB_FBRO_EVENT_ACTION_CONTINUE = 1,
  LB_FBRO_EVENT_ACTION_CANCEL = 2,
  LB_FBRO_EVENT_ACTION_HANDLED = 3,
  LB_FBRO_EVENT_ACTION_DEFER = 4
};

/** v3 只暴露复制后的 UTF-16 JSON 和受管句柄；所有指针仅在回调期间有效。 */
typedef struct LB_FBRO_EVENT_PACKET_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t sequence;
  uint64_t timestamp_milliseconds;
  LB_FBRO_HANDLE browser;
  uint64_t event_token;
  int32_t legacy_event_code;
  int32_t instance_kind;
  uint32_t flags;
  const wchar_t* event_id;
  const wchar_t* event_name;
  const wchar_t* official_name;
  const wchar_t* fields_json;
  LB_FBRO_OBJECT_HANDLE object;
  LB_FBRO_CONTINUATION_HANDLE continuation;
} LB_FBRO_EVENT_PACKET_V3;

typedef struct LB_FBRO_EVENT_RESPONSE_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t action;
  uint32_t flags;
  const wchar_t* response_json;
} LB_FBRO_EVENT_RESPONSE_V3;

typedef void(__stdcall* LB_FBRO_EVENT_CALLBACK_V3)(
    const LB_FBRO_EVENT_PACKET_V3* packet,
    LB_FBRO_EVENT_RESPONSE_V3* response,
    void* user_data);

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
  LB_FBRO_EVENT_VIP_LIFECYCLE = 15,
  LB_FBRO_EVENT_DOWNLOAD_START = 16,
  LB_FBRO_EVENT_DOWNLOAD_UPDATED = 17
};

typedef struct LB_FBRO_INITIALIZE_OPTIONS_V1 {
  uint32_t struct_size;
  uint32_t abi_version;
  const wchar_t* runtime_directory;
  int32_t remote_debugging_port;
} LB_FBRO_INITIALIZE_OPTIONS_V1;

#define LB_FBRO_INITIALIZE_OPTIONS_VERSION_V1 0x00010000u

LB_FBRO_API int __stdcall LB_FBro_Initialize(const wchar_t* runtime_directory);
LB_FBRO_API int __stdcall LB_FBro_InitializeEx(
    const LB_FBRO_INITIALIZE_OPTIONS_V1* options);
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
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_CreateEx2(HWND host, const wchar_t* url,
                                                       const wchar_t* profile_directory,
                                                       const wchar_t* user_agent,
                                                       const wchar_t* extension_directory,
                                                       unsigned int flags,
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
// 输入注入族：把合成鼠标/键盘/触摸事件派发给浏览器宿主，等价官方 FBroHsBrowserHost_Send*。
// character/unmodified_character 为宽字符编码：低 8 位为低字节，高 8 位为高字节。
LB_FBRO_API int __stdcall LB_FBro_SendKeyEvent(LB_FBRO_HANDLE browser, int type, long long modifiers,
                                               int windows_key_code, int native_key_code, int is_system_key,
                                               int character, int unmodified_character,
                                               int focus_on_editable_field);
LB_FBRO_API int __stdcall LB_FBro_SendMouseClickEvent(LB_FBRO_HANDLE browser, int button_type,
                                                      int x, int y, long long modifiers,
                                                      int mouse_up, int click_count);
LB_FBRO_API int __stdcall LB_FBro_SendMouseMoveEvent(LB_FBRO_HANDLE browser, int x, int y,
                                                     long long modifiers, int mouse_leave);
LB_FBRO_API int __stdcall LB_FBro_SendMouseWheelEvent(LB_FBRO_HANDLE browser, int x, int y,
                                                      long long modifiers, int delta_x, int delta_y);
LB_FBRO_API int __stdcall LB_FBro_SendTouchEvent(LB_FBRO_HANDLE browser, int type, long long modifiers,
                                                 int pointer_type, int touch_id, double x, double y,
                                                 double radius_x, double radius_y,
                                                 double rotation_angle, double pressure);
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
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieSetJsonAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* cookie_json,
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
LB_FBRO_API int __stdcall LB_FBro_SetEventCallbackV3(LB_FBRO_HANDLE browser,
                                                     LB_FBRO_EVENT_CALLBACK_V3 callback,
                                                     void* user_data);
LB_FBRO_API int __stdcall LB_FBro_SetEventSubscription(LB_FBRO_HANDLE browser,
                                                       const wchar_t* event_id,
                                                       int enabled);
LB_FBRO_API int __stdcall LB_FBro_SetEventSamplingRate(LB_FBRO_HANDLE browser,
                                                       const wchar_t* event_id,
                                                       uint32_t max_hz);
/* 仅允许在“资源响应到达”（OnResourceResponse）处理器执行期间调用：
   request_id 取当前事件包的 request_id 字段（FBro 资源事件在多个 IO 线程上交错，
   必须按请求标识与 GetResourceResponseFilter 精确配对）。
   为该请求安装有界响应正文捕获（流式透传，不重新发起请求），
   正文收集完成后通过合成事件“资源响应正文到达”（fbro.bridge.resource_response_body）投递，
   字段：url、status_code、mime_type、received_bytes、truncated、error、body_text、body_base64。 */
LB_FBRO_API int __stdcall LB_FBro_ResourceBodyBegin(LB_FBRO_HANDLE browser,
                                                    uint64_t request_id,
                                                    int64_t max_bytes);
/* 设置浏览器级响应正文查找替换（非 VIP 能力，基于官方 FBroHsResponseFilter 包装）：
   之后开始加载的全部资源正文按 UTF-8 字节流式查找 find_buffer 内容并改写为
   replacement_buffer 内容；replacement_buffer 传 0 表示删除查找内容。
   find_buffer 不能为空且查找/替换字节均不得超过 64 MiB。
   重复调用覆盖上一次配置；正在传输中的资源继续沿用其安装时复制到的配置。
   只修改响应正文，不改变响应头和状态码。 */
LB_FBRO_API int __stdcall LB_FBro_ResourceReplaceSet(LB_FBRO_HANDLE browser,
                                                     LB_FBRO_BUFFER_HANDLE find_buffer,
                                                     LB_FBRO_BUFFER_HANDLE replacement_buffer);
/* 清除浏览器级响应正文查找替换配置，之后加载的资源恢复原始正文；
   已加载页面与正在传输中的资源不受影响。 */
LB_FBRO_API int __stdcall LB_FBro_ResourceReplaceClear(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_CompleteEventContinuation(
    LB_FBRO_CONTINUATION_HANDLE continuation, const wchar_t* response_json);
LB_FBRO_API int __stdcall LB_FBro_CancelEventContinuation(
    LB_FBRO_CONTINUATION_HANDLE continuation);
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
/** 宿主窗口、实例注册表与运行时信息查询（同步，任意线程）。 */
LB_FBRO_API int __stdcall LB_FBro_GetWindowHandle(LB_FBRO_HANDLE browser, int64_t* window);
LB_FBRO_API int __stdcall LB_FBro_GetOpenerWindowHandle(LB_FBRO_HANDLE browser, int64_t* window);
LB_FBRO_API int __stdcall LB_FBro_GetParentWindowHandle(LB_FBRO_HANDLE browser, int64_t* window);
LB_FBRO_API int __stdcall LB_FBro_GetRuntimeStyle(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_GetSdkVersionJson(wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetInstanceCount(void);
LB_FBRO_API int __stdcall LB_FBro_GetInstanceHandlesJson(wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetInstanceFlagsJson(wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_IsInstanceAlive(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_IsGlobalRequestContext(LB_FBRO_HANDLE browser);
LB_FBRO_API int __stdcall LB_FBro_GetRequestContextCachePath(LB_FBRO_HANDLE browser,
                                                             wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetBrowserFlag(LB_FBRO_HANDLE browser, wchar_t* result,
                                                 size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_GetBrowserExtraInfoJson(LB_FBRO_HANDLE browser, wchar_t* result,
                                                          size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_CreateDataUri(const wchar_t* mime_type, const wchar_t* data,
                                                wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_IsBufferValid(LB_FBRO_BUFFER_HANDLE buffer);
/** 显示官方 DevTools 顶层窗口 / 移动浏览器子窗口：UI 线程任务内执行。 */
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ShowDevToolsWindowAsync(
    LB_FBRO_HANDLE browser, const wchar_t* title, int x, int y, int width, int height,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_MoveBrowserWindowAsync(LB_FBRO_HANDLE browser,
                                                                         int x, int y, int width,
                                                                         int height,
                                                                         LB_FBRO_TASK_CALLBACK callback,
                                                                         void* user_data);
/** CEF 内嵌服务器（HTTP/WebSocket）。browser 为创建者浏览器句柄，服务器事件将派发给该实例。 */
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ServerCreateAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, int port, int max_connections,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_ServerSendWebSocketMessage(LB_FBRO_OBJECT_HANDLE object,
                                                             int connection_id,
                                                             const wchar_t* text);
LB_FBRO_API int __stdcall LB_FBro_ServerSendWebSocketBuffer(LB_FBRO_OBJECT_HANDLE object,
                                                             int connection_id,
                                                             LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_ServerGetAddress(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ServerHasConnection(LB_FBRO_OBJECT_HANDLE object,
                                                      int connection_id);
LB_FBRO_API int __stdcall LB_FBro_ServerShutdown(LB_FBRO_OBJECT_HANDLE object);
/** VIP WebSocket 客户端拦截（wssClient 句柄来自拦截事件，LB_FBro_ObjectRelease 释放）。 */
LB_FBRO_API int __stdcall LB_FBro_WssIsNull(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_WssGetAddress(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_WssGetProtocol(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                 size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_WssGetExtensions(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                   size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_WssSend(LB_FBRO_OBJECT_HANDLE object, const wchar_t* text);
LB_FBRO_API int __stdcall LB_FBro_WssSendBuffer(LB_FBRO_OBJECT_HANDLE object,
                                                LB_FBRO_BUFFER_HANDLE buffer);
/** 拦截回传通道：把数据按通道名推送给页面内挂钩脚本（UTF-8 传输）。 */
LB_FBRO_API int __stdcall LB_FBro_SocketServerSendByBrowser(LB_FBRO_HANDLE browser,
                                                            const wchar_t* name,
                                                            const wchar_t* text);
LB_FBRO_API int __stdcall LB_FBro_SocketServerSendByBrowserBuffer(LB_FBRO_HANDLE browser,
                                                                  const wchar_t* name,
                                                                  LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_SocketClientSendByBrowser(LB_FBRO_HANDLE browser,
                                                            const wchar_t* name,
                                                            const wchar_t* text);
LB_FBRO_API int __stdcall LB_FBro_SocketClientSendByBrowserBuffer(LB_FBRO_HANDLE browser,
                                                                  const wchar_t* name,
                                                                  LB_FBRO_BUFFER_HANDLE buffer);
LB_FBRO_API int __stdcall LB_FBro_RequestGetMethod(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                   size_t capacity);
/** DOM 遍历快照：官方 VisitDOM 序列化为受管快照（遍历句柄），节点按序号访问。
 * 路径为 JSON 数组（如 [0,2,1]），按路径写回会重新 VisitDOM 定位官方节点。 */
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameVisitDomAsync(
    LB_FBRO_OBJECT_HANDLE frame, int max_depth, int max_nodes, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API int __stdcall LB_FBro_DomGetTitle(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                              size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetBaseUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeType(LB_FBRO_OBJECT_HANDLE object, int node_index);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeCount(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodePath(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                                 wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeName(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                                 wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeValue(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                                  wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeInnerText(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                                      wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeAttributeCount(LB_FBRO_OBJECT_HANDLE object,
                                                           int node_index);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeAttributeName(LB_FBRO_OBJECT_HANDLE object,
                                                          int node_index, int attribute_index,
                                                          wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeAttributeValue(LB_FBRO_OBJECT_HANDLE object,
                                                           int node_index, int attribute_index,
                                                           wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetNodeAttributeByName(LB_FBRO_OBJECT_HANDLE object,
                                                            int node_index, const wchar_t* name,
                                                            wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomGetFocusedPath(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                    size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DomFindNodeByPath(LB_FBRO_OBJECT_HANDLE object,
                                                    const wchar_t* path_json);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DomSetAttributeByPathAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* path_json,
                                                             const wchar_t* name,
                                                             const wchar_t* value,
                                                             LB_FBRO_TASK_CALLBACK callback,
                                                             void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DomSetValueByPathAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                         const wchar_t* path_json,
                                                         const wchar_t* value,
                                                         LB_FBRO_TASK_CALLBACK callback,
                                                         void* user_data);
/** 运行时创建独立 RequestContext；设置 JSON：cachePath/persistSessionCookies/
 * acceptLanguageList/cookieableSchemesList/cookieableSchemesExcludeDefaults。
 * 任务结果 JSON 含 context 句柄。 */
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_RequestContextCreateAsync(
    const wchar_t* settings_json, LB_FBRO_TASK_CALLBACK callback, void* user_data);
/** 用指定 RequestContext 原地重建浏览器实例：先关闭旧浏览器，关闭完成后自动重启。 */
LB_FBRO_API int __stdcall LB_FBro_RecreateBrowserWithContext(LB_FBRO_HANDLE browser,
                                                             LB_FBRO_OBJECT_HANDLE context);
/** 取弹出窗口所属主浏览器的已登记实例句柄；未知浏览器返回 0。 */
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_BrowserHostGetMainBrowser(LB_FBRO_HANDLE browser);
/** 右键菜单句柄命令（事件期内使用，回调结束后句柄失效）。 */
LB_FBRO_API int __stdcall LB_FBro_MenuModelAddItem(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                                   const wchar_t* label);
LB_FBRO_API int __stdcall LB_FBro_MenuModelAddSubMenu(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                                      const wchar_t* label);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetAccelerator(LB_FBRO_OBJECT_HANDLE object,
                                                          int command_id, int key_code, int shift,
                                                          int ctrl, int alt);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetColor(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                                    int color_type, wchar_t* result,
                                                    size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetX(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetY(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetTypeFlags(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_MenuModelClear(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetCount(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_MenuModelAddSeparator(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_MenuModelAddCheckItem(LB_FBRO_OBJECT_HANDLE object, int command_id, const wchar_t* label);
LB_FBRO_API int __stdcall LB_FBro_MenuModelAddRadioItem(LB_FBRO_OBJECT_HANDLE object, int command_id, const wchar_t* label, int group_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelRemove(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetLabel(LB_FBRO_OBJECT_HANDLE object, int command_id, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetLabel(LB_FBRO_OBJECT_HANDLE object, int command_id, const wchar_t* label);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetType(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetGroup(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetGroup(LB_FBRO_OBJECT_HANDLE object, int command_id, int group_id);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_MenuModelGetSubMenu(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelIsVisible(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetVisible(LB_FBRO_OBJECT_HANDLE object, int command_id, int visible);
LB_FBRO_API int __stdcall LB_FBro_MenuModelIsEnabled(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetEnabled(LB_FBRO_OBJECT_HANDLE object, int command_id, int enable);
LB_FBRO_API int __stdcall LB_FBro_MenuModelIsChecked(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetChecked(LB_FBRO_OBJECT_HANDLE object, int command_id, int check);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetCheckedAt(LB_FBRO_OBJECT_HANDLE object, int index, int check);
LB_FBRO_API int __stdcall LB_FBro_MenuModelHasAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelHasAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index, int key_code, int shift, int ctrl, int alt);
LB_FBRO_API int __stdcall LB_FBro_MenuModelRemoveAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id);
LB_FBRO_API int __stdcall LB_FBro_MenuModelRemoveAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetColor(LB_FBRO_OBJECT_HANDLE object, int command_id, int color_type, int alpha, int red, int green, int blue);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetColorAt(LB_FBRO_OBJECT_HANDLE object, int index, int color_type, int alpha, int red, int green, int blue);
LB_FBRO_API int __stdcall LB_FBro_MenuModelGetColorAt(LB_FBRO_OBJECT_HANDLE object, int index, int color_type, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetFontList(LB_FBRO_OBJECT_HANDLE object, int command_id, const wchar_t* font_list);
LB_FBRO_API int __stdcall LB_FBro_MenuModelSetFontListAt(LB_FBRO_OBJECT_HANDLE object, int index, const wchar_t* font_list);

LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetLinkUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetUnfilteredLinkUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetSourceUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetPageUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetFrameCharset(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetFrameUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsHasImageContents(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetMediaType(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetMediaStateFlags(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetSelectionText(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetMisspelledWord(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetDictionarySuggestions(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsIsEditable(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsIsSpellCheckEnabled(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsGetEditStateFlags(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_ContextMenuParamsIsCustomMenu(LB_FBRO_OBJECT_HANDLE object);
/** 下载项快照读取族：句柄来自「下载开始/下载进度更新」事件字段 downloadItem。 */
LB_FBRO_API int __stdcall LB_FBro_DownloadItemIsInProgress(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemIsComplete(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemIsCanceled(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetPercentComplete(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetDownloadId(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API long long __stdcall LB_FBro_DownloadItemGetCurrentSpeedBytes(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API long long __stdcall LB_FBro_DownloadItemGetTotalBytes(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API long long __stdcall LB_FBro_DownloadItemGetReceivedBytes(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API long long __stdcall LB_FBro_DownloadItemGetStartTime(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API long long __stdcall LB_FBro_DownloadItemGetEndTime(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetFullPath(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetDownloadURL(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetDownloadOriginalUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetSuggestedFileName(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetDownloadMimeType(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_DownloadItemGetContentDisposition(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity);

/** 启用页面调原生 JS 扩展（必须在首个浏览器创建前调用）。 */
LB_FBRO_API int __stdcall LB_FBro_EnableJsQuery(const wchar_t* query_function,
                                                const wchar_t* cancel_function);
/** 启动命令行开关：必须在 LB_FBro_Initialize* 之前调用。 */
LB_FBRO_API int __stdcall LB_FBro_SetStartupSwitches(const wchar_t* switches_json);
LB_FBRO_API int __stdcall LB_FBro_GetStartupCommandLine(wchar_t* result, size_t capacity);
/** 后台创建：无窗口承载，事件仍正常分发。 */
LB_FBRO_API LB_FBRO_HANDLE __stdcall LB_FBro_CreateBackground(
    const wchar_t* url, const wchar_t* profile_directory, const wchar_t* extra_info_json,
    LB_FBRO_EVENT_CALLBACK callback, void* user_data);
/** 受管请求构造与数据族（句柄对象，任意线程注册、按各对象线程约定使用）。 */
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_RequestCreate(void);
LB_FBRO_API int __stdcall LB_FBro_RequestGetUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                size_t capacity);
LB_FBRO_API int __stdcall LB_FBro_RequestSetUrl(LB_FBRO_OBJECT_HANDLE object, const wchar_t* url);
LB_FBRO_API int __stdcall LB_FBro_RequestSetMethod(LB_FBRO_OBJECT_HANDLE object,
                                                   const wchar_t* method);
LB_FBRO_API int __stdcall LB_FBro_RequestSetReferrer(LB_FBRO_OBJECT_HANDLE object,
                                                     const wchar_t* referrer, int policy);
LB_FBRO_API int __stdcall LB_FBro_RequestSetHeaderMapJson(LB_FBRO_OBJECT_HANDLE object,
                                                          const wchar_t* headers_json);
LB_FBRO_API int __stdcall LB_FBro_RequestComposeSet(LB_FBRO_OBJECT_HANDLE object,
                                                    const wchar_t* url, const wchar_t* method,
                                                    LB_FBRO_OBJECT_HANDLE post_data,
                                                    const wchar_t* headers_json);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_PostDataCreate(void);
LB_FBRO_API int __stdcall LB_FBro_PostDataAddElement(LB_FBRO_OBJECT_HANDLE object,
                                                     LB_FBRO_OBJECT_HANDLE element);
LB_FBRO_API int __stdcall LB_FBro_PostDataGetElementCount(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_PostDataGetElementHandlesJson(LB_FBRO_OBJECT_HANDLE object,
                                                                wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_PostDataElementCreate(void);
LB_FBRO_API int __stdcall LB_FBro_PostDataElementSetBytes(LB_FBRO_OBJECT_HANDLE object,
                                                          const wchar_t* text);
LB_FBRO_API int __stdcall LB_FBro_PostDataElementGetBytesCount(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_PostDataElementGetText(LB_FBRO_OBJECT_HANDLE object,
                                                         wchar_t* result, size_t capacity);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ProcessMessageCreate(const wchar_t* name);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ProcessMessageGetArgumentList(
    LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API int __stdcall LB_FBro_FrameLoadRequest(LB_FBRO_OBJECT_HANDLE frame,
                                                   LB_FBRO_OBJECT_HANDLE request);
LB_FBRO_API int __stdcall LB_FBro_FrameSendProcessMessage(LB_FBRO_OBJECT_HANDLE frame,
                                                          int target_process,
                                                          LB_FBRO_OBJECT_HANDLE message);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_UrlRequestStartAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_OBJECT_HANDLE request, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API int __stdcall LB_FBro_UrlRequestGetStatus(LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_UrlRequestGetRequestObject(
    LB_FBRO_OBJECT_HANDLE object);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameCreateUrlRequestAsync(
    LB_FBRO_OBJECT_HANDLE frame, LB_FBRO_OBJECT_HANDLE request, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
/** 填表自动化与页面源码/文本提取。 */
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoClick(LB_FBRO_OBJECT_HANDLE frame,
                                                     const wchar_t* selector, int index);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoScrollIntoView(LB_FBRO_OBJECT_HANDLE frame,
                                                              const wchar_t* selector, int index,
                                                              int to_top);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetFocus(LB_FBRO_OBJECT_HANDLE frame,
                                                        const wchar_t* selector, int index,
                                                        int focus);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetValue(LB_FBRO_OBJECT_HANDLE frame,
                                                        const wchar_t* selector, int index,
                                                        const wchar_t* value);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetValueAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetPointAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetChecked(LB_FBRO_OBJECT_HANDLE frame,
                                                           const wchar_t* selector, int index, int check);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetSelected(LB_FBRO_OBJECT_HANDLE frame,
                                                            const wchar_t* selector, int index, int select_index);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetInnerText(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* selector, int index, const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetOuterText(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* selector, int index, const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetInnerHTML(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* selector, int index, const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetOuterHTML(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* selector, int index, const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoSetAttribute(LB_FBRO_OBJECT_HANDLE frame,
                                                             const wchar_t* selector, int index, const wchar_t* name,
                                                             const wchar_t* value);
LB_FBRO_API int __stdcall LB_FBro_FrameTianBiaoDispatchEvent(LB_FBRO_OBJECT_HANDLE frame,
                                                              const wchar_t* selector, int index,
                                                              const wchar_t* event_flag, int key_code);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetCheckedAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetSelectedAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetInnerTextAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetOuterTextAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetInnerHTMLAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetOuterHTMLAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetAttributeAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, const wchar_t* name,
    LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoHasAttributeAsync(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector, int index, LB_FBRO_TASK_CALLBACK callback,
    void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameGetSourceAsync(
    LB_FBRO_OBJECT_HANDLE frame, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameGetTextAsync(
    LB_FBRO_OBJECT_HANDLE frame, LB_FBRO_TASK_CALLBACK callback, void* user_data);
LB_FBRO_API int __stdcall LB_FBro_BufferToText(LB_FBRO_BUFFER_HANDLE buffer, wchar_t* result,
                                               size_t capacity);
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
