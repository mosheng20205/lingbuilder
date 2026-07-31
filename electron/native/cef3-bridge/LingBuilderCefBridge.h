#pragma once

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#if defined(LINGBUILDER_CEF3_BRIDGE_EXPORTS)
#define LB_CEF3_API extern "C" __declspec(dllexport)
#else
#define LB_CEF3_API extern "C" __declspec(dllimport)
#endif
#define LB_CEF3_CALL __stdcall
#else
#define LB_CEF3_API extern "C"
#define LB_CEF3_CALL
#endif

typedef uint64_t LB_CEF3_HANDLE;
typedef uint64_t LB_CEF3_TASK_HANDLE;
typedef uint64_t LB_CEF3_BUFFER_HANDLE;

#define LB_CEF3_ABI_VERSION_V3 0x00030000u

enum LB_CEF3_RESULT_CODE {
  LB_CEF3_OK = 1,
  LB_CEF3_ERROR_NOT_FOUND = -1,
  LB_CEF3_ERROR_INVALID_ARGUMENT = -2,
  LB_CEF3_ERROR_BUFFER_TOO_SMALL = -3,
  LB_CEF3_ERROR_TIMEOUT = -4,
  LB_CEF3_ERROR_OPERATION_FAILED = -5,
  LB_CEF3_ERROR_WRONG_THREAD = -6,
  LB_CEF3_ERROR_RELEASED_HANDLE = -7,
  LB_CEF3_ERROR_HANDLE_TYPE = -8,
  LB_CEF3_ERROR_CANCELLED = -9,
  LB_CEF3_ERROR_NOT_SUPPORTED = -10,
  LB_CEF3_ERROR_PATH_DENIED = -11
};

enum LB_CEF3_HANDLE_TYPE {
  LB_CEF3_HANDLE_UNKNOWN = 0,
  LB_CEF3_HANDLE_BROWSER = 1,
  LB_CEF3_HANDLE_TASK = 2,
  LB_CEF3_HANDLE_BUFFER = 3,
  LB_CEF3_HANDLE_VALUE = 10,
  LB_CEF3_HANDLE_DICTIONARY = 11,
  LB_CEF3_HANDLE_LIST = 12,
  LB_CEF3_HANDLE_IMAGE = 13,
  LB_CEF3_HANDLE_MENU = 14,
  LB_CEF3_HANDLE_CERTIFICATE = 15,
  LB_CEF3_HANDLE_NAVIGATION_ENTRY = 16,
  LB_CEF3_HANDLE_REQUEST_CONTEXT = 17,
  LB_CEF3_HANDLE_REQUEST = 18,
  LB_CEF3_HANDLE_RESPONSE = 19,
  LB_CEF3_HANDLE_FRAME = 20,
  LB_CEF3_HANDLE_CERTIFICATE_PRINCIPAL = 21
};

enum LB_CEF3_TASK_STATUS {
  LB_CEF3_TASK_PENDING = 0,
  LB_CEF3_TASK_RUNNING = 1,
  LB_CEF3_TASK_SUCCEEDED = 2,
  LB_CEF3_TASK_FAILED = 3,
  LB_CEF3_TASK_CANCELLED = 4
};

enum LB_CEF3_VALUE_TYPE {
  LB_CEF3_VALUE_INVALID = 0,
  LB_CEF3_VALUE_NULL = 1,
  LB_CEF3_VALUE_BOOL = 2,
  LB_CEF3_VALUE_INT = 3,
  LB_CEF3_VALUE_DOUBLE = 4,
  LB_CEF3_VALUE_STRING = 5,
  LB_CEF3_VALUE_BINARY = 6,
  LB_CEF3_VALUE_DICTIONARY = 7,
  LB_CEF3_VALUE_LIST = 8
};

enum LB_CEF3_BROWSER_FLAGS {
  LB_CEF3_BROWSER_JAVASCRIPT = 1u << 0,
  LB_CEF3_BROWSER_IMAGES = 1u << 1,
  LB_CEF3_BROWSER_WEBGL = 1u << 2,
  LB_CEF3_BROWSER_DEVTOOLS = 1u << 3,
  LB_CEF3_BROWSER_CHROME_RUNTIME = 1u << 4
};

typedef struct LB_CEF3_EVENT_PACKET_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t sequence;
  uint64_t timestamp_milliseconds;
  LB_CEF3_HANDLE browser;
  uint64_t user_token;
  int32_t event_code;
  uint32_t flags;
  const wchar_t* event_name;
  const wchar_t* fields_json;
} LB_CEF3_EVENT_PACKET_V3;

typedef struct LB_CEF3_EVENT_RESPONSE_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t action;
  uint32_t flags;
  const wchar_t* response_json;
} LB_CEF3_EVENT_RESPONSE_V3;

typedef void(LB_CEF3_CALL* LB_CEF3_EVENT_CALLBACK_V3)(
  const LB_CEF3_EVENT_PACKET_V3* packet,
  LB_CEF3_EVENT_RESPONSE_V3* response,
  void* user_data);

typedef struct LB_CEF3_INITIALIZE_CONFIG_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t application_instance;
  const wchar_t* root_cache_path;
  const wchar_t* resources_path;
  const wchar_t* locales_path;
  const wchar_t* subprocess_path;
  const wchar_t* user_agent;
  LB_CEF3_EVENT_CALLBACK_V3 event_callback;
  void* event_user_data;
} LB_CEF3_INITIALIZE_CONFIG_V3;

typedef struct LB_CEF3_BROWSER_CONFIG_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t parent_window;
  uint64_t user_token;
  uint32_t flags;
  const wchar_t* initial_url;
  const wchar_t* profile_key;
  const wchar_t* proxy_mode;
  const wchar_t* proxy_server;
  LB_CEF3_EVENT_CALLBACK_V3 event_callback;
  void* event_user_data;
} LB_CEF3_BROWSER_CONFIG_V3;

LB_CEF3_API uint32_t LB_CEF3_CALL LB_CEF3_GetAbiVersion(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetCefVersion(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetLastError(wchar_t* result, size_t capacity, size_t* required);

/* CEF核心生命周期。ExecuteSubProcess必须在创建任何窗口前调用；>=0表示子进程应直接退出。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ExecuteSubProcess(uint64_t application_instance);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_Initialize(const LB_CEF3_INITIALIZE_CONFIG_V3* config);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IsInitialized(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_Shutdown(void);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreate(const LB_CEF3_BROWSER_CONFIG_V3* config);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateChrome(const LB_CEF3_BROWSER_CONFIG_V3* config);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserClose(LB_CEF3_HANDLE browser, int force_close);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserResize(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserLoadUrl(LB_CEF3_HANDLE browser, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGoBack(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGoForward(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserReload(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserStopLoad(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanGoBack(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanGoForward(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsLoading(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetTitle(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetUrl(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetProfilePath(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetProxy(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetAudioMuted(LB_CEF3_HANDLE browser, int muted);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserEvaluateJavaScript(LB_CEF3_HANDLE browser, const wchar_t* script);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserStartDownload(LB_CEF3_HANDLE browser, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserPrint(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserShowDevTools(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCloseDevTools(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHasDevTools(LB_CEF3_HANDLE browser);

/* 文件缓冲读写只有配置允许根目录后才可调用。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetAllowedFileRoot(const wchar_t* root_directory);

LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleGetType(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleIsValid(LB_CEF3_HANDLE handle, int expected_type);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleRetain(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleRelease(LB_CEF3_HANDLE handle);

/* TaskCreate/Set* 供 Bridge 子系统产生异步任务；DSL 仅使用查询、取消和释放接口。 */
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_TaskCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetRunning(LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetResult(LB_CEF3_TASK_HANDLE task, const wchar_t* result_json);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetError(LB_CEF3_TASK_HANDLE task, const wchar_t* error_text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetStatus(LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetResult(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetError(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskCancel(LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRelease(LB_CEF3_TASK_HANDLE task);

LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferCreate(const void* data, size_t size);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferClone(LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferIsValid(LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferIsOwned(LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferIsSame(LB_CEF3_BUFFER_HANDLE buffer, LB_CEF3_BUFFER_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferIsEqual(LB_CEF3_BUFFER_HANDLE buffer, LB_CEF3_BUFFER_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferGetSize(LB_CEF3_BUFFER_HANDLE buffer, uint64_t* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferCopy(LB_CEF3_BUFFER_HANDLE buffer, void* data, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferToHex(LB_CEF3_BUFFER_HANDLE buffer, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferLoadFile(const wchar_t* path);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferSaveFile(LB_CEF3_BUFFER_HANDLE buffer, const wchar_t* path);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BufferRelease(LB_CEF3_BUFFER_HANDLE buffer);

/* 进程退出时释放仍由 Bridge 持有的受管对象。 */
/* Value/container operations copy at container boundaries. Returned child
   handles therefore have independent lifetime and never expose CEF pointers. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueCreate(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueCopy(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueIsValid(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueIsOwned(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueIsReadOnly(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueIsSame(LB_CEF3_HANDLE value, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueIsEqual(LB_CEF3_HANDLE value, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueGetType(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetNull(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetBool(LB_CEF3_HANDLE value, int data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetInt(LB_CEF3_HANDLE value, int data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetDouble(LB_CEF3_HANDLE value, double data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetString(LB_CEF3_HANDLE value, const wchar_t* data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetBuffer(LB_CEF3_HANDLE value, LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetDictionary(LB_CEF3_HANDLE value, LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueSetList(LB_CEF3_HANDLE value, LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueGetBool(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueGetInt(LB_CEF3_HANDLE value, int* data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueGetDouble(LB_CEF3_HANDLE value, double* data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueGetString(LB_CEF3_HANDLE value, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetBuffer(LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetDictionary(LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetList(LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueToJson(LB_CEF3_HANDLE value, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ValueRelease(LB_CEF3_HANDLE value);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryCreate(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryCopy(LB_CEF3_HANDLE dictionary, int exclude_empty_children);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryIsValid(LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryIsOwned(LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryIsReadOnly(LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryIsSame(LB_CEF3_HANDLE dictionary, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryIsEqual(LB_CEF3_HANDLE dictionary, LB_CEF3_HANDLE other);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_DictionaryGetSize(LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryHasKey(LB_CEF3_HANDLE dictionary, const wchar_t* key);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryGetKeysJson(LB_CEF3_HANDLE dictionary, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryGetType(LB_CEF3_HANDLE dictionary, const wchar_t* key);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionarySetValue(LB_CEF3_HANDLE dictionary, const wchar_t* key, LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryGetValue(LB_CEF3_HANDLE dictionary, const wchar_t* key);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryRemove(LB_CEF3_HANDLE dictionary, const wchar_t* key);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryClear(LB_CEF3_HANDLE dictionary);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryToJson(LB_CEF3_HANDLE dictionary, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DictionaryRelease(LB_CEF3_HANDLE dictionary);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListCreate(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListCopy(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListIsValid(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListIsOwned(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListIsReadOnly(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListIsSame(LB_CEF3_HANDLE list, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListIsEqual(LB_CEF3_HANDLE list, LB_CEF3_HANDLE other);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ListGetSize(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListSetSize(LB_CEF3_HANDLE list, uint64_t size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListGetType(LB_CEF3_HANDLE list, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListSetValue(LB_CEF3_HANDLE list, uint64_t index, LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListGetValue(LB_CEF3_HANDLE list, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListRemove(LB_CEF3_HANDLE list, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListClear(LB_CEF3_HANDLE list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListToJson(LB_CEF3_HANDLE list, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ListRelease(LB_CEF3_HANDLE list);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsSubMenu(LB_CEF3_HANDLE menu);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuClear(LB_CEF3_HANDLE menu);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_MenuGetCount(LB_CEF3_HANDLE menu);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuAddSeparator(LB_CEF3_HANDLE menu);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuAddItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuAddCheckItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuAddRadioItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label, int group_id);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuAddSubMenu(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuInsertSeparatorAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuInsertItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuInsertCheckItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuInsertRadioItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label, int group_id);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuInsertSubMenuAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuRemove(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuRemoveAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetIndexOf(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetCommandIdAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetCommandIdAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetLabel(LB_CEF3_HANDLE menu, int command_id, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetLabelAt(LB_CEF3_HANDLE menu, uint64_t index, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetLabel(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetLabelAt(LB_CEF3_HANDLE menu, uint64_t index, const wchar_t* label);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetType(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetTypeAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetGroupId(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetGroupIdAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetGroupId(LB_CEF3_HANDLE menu, int command_id, int group_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetGroupIdAt(LB_CEF3_HANDLE menu, uint64_t index, int group_id);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuGetSubMenu(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuGetSubMenuAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsVisible(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsVisibleAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetVisible(LB_CEF3_HANDLE menu, int command_id, int visible);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetVisibleAt(LB_CEF3_HANDLE menu, uint64_t index, int visible);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsEnabled(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsEnabledAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetEnabled(LB_CEF3_HANDLE menu, int command_id, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetEnabledAt(LB_CEF3_HANDLE menu, uint64_t index, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsChecked(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuIsCheckedAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetChecked(LB_CEF3_HANDLE menu, int command_id, int checked);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetCheckedAt(LB_CEF3_HANDLE menu, uint64_t index, int checked);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuHasAccelerator(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuHasAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetAccelerator(LB_CEF3_HANDLE menu, int command_id, int key_code, int shift, int control, int alt);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index, int key_code, int shift, int control, int alt);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuRemoveAccelerator(LB_CEF3_HANDLE menu, int command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuRemoveAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetAcceleratorJson(LB_CEF3_HANDLE menu, int command_id, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuGetAcceleratorAtJson(LB_CEF3_HANDLE menu, uint64_t index, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetColor(LB_CEF3_HANDLE menu, int command_id, int color_type, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetColorAt(LB_CEF3_HANDLE menu, int index, int color_type, uint32_t color);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_MenuGetColor(LB_CEF3_HANDLE menu, int command_id, int color_type);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_MenuGetColorAt(LB_CEF3_HANDLE menu, int index, int color_type);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetFontList(LB_CEF3_HANDLE menu, int command_id, const wchar_t* font_list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuSetFontListAt(LB_CEF3_HANDLE menu, int index, const wchar_t* font_list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuRelease(LB_CEF3_HANDLE menu);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ImageCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageIsEmpty(LB_CEF3_HANDLE image);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageIsSame(LB_CEF3_HANDLE image, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageAddBitmap(
    LB_CEF3_HANDLE image, double scale_factor, int pixel_width, int pixel_height,
    int color_type, int alpha_type, LB_CEF3_BUFFER_HANDLE pixels);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageAddPng(LB_CEF3_HANDLE image, double scale_factor, LB_CEF3_BUFFER_HANDLE png);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageAddJpeg(LB_CEF3_HANDLE image, double scale_factor, LB_CEF3_BUFFER_HANDLE jpeg);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ImageGetWidth(LB_CEF3_HANDLE image);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ImageGetHeight(LB_CEF3_HANDLE image);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageHasRepresentation(LB_CEF3_HANDLE image, double scale_factor);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageRemoveRepresentation(LB_CEF3_HANDLE image, double scale_factor);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageGetRepresentationInfo(
    LB_CEF3_HANDLE image, double scale_factor, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsBitmap(
    LB_CEF3_HANDLE image, double scale_factor, int color_type, int alpha_type);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsPng(
    LB_CEF3_HANDLE image, double scale_factor, int with_transparency);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsJpeg(
    LB_CEF3_HANDLE image, double scale_factor, int quality);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ImageRelease(LB_CEF3_HANDLE image);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetVisibleNavigationEntry(LB_CEF3_HANDLE browser);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetNavigationEntries(LB_CEF3_HANDLE browser, int current_only);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryIsValid(LB_CEF3_HANDLE entry);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetDisplayUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetOriginalUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetTitle(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetTransitionType(LB_CEF3_HANDLE entry);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryHasPostData(LB_CEF3_HANDLE entry);
LB_CEF3_API double LB_CEF3_CALL LB_CEF3_NavigationEntryGetCompletionTime(LB_CEF3_HANDLE entry);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryGetHttpStatusCode(LB_CEF3_HANDLE entry);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_NavigationEntryRelease(LB_CEF3_HANDLE entry);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetCurrentCertificate(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificateIsSecureConnection(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_CertificateGetCertStatus(LB_CEF3_HANDLE certificate);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificateGetSslVersion(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_CertificateGetContentStatus(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetSubject(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetIssuer(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetSerialNumber(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetDerEncoded(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetPemEncoded(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_CertificateGetValidStart(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_CertificateGetValidExpiry(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_CertificateGetIssuerChainSize(LB_CEF3_HANDLE certificate);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetDerIssuerChainItem(
    LB_CEF3_HANDLE certificate, uint64_t index);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetPemIssuerChainItem(
    LB_CEF3_HANDLE certificate, uint64_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificateRelease(LB_CEF3_HANDLE certificate);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetDisplayName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetCommonName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetLocalityName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetStateOrProvinceName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetCountryName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetOrganizationNamesJson(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetOrganizationUnitNamesJson(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificatePrincipalRelease(LB_CEF3_HANDLE principal);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetRequestContext(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetCachePath(LB_CEF3_HANDLE context, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextHasPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextCanSetPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetAllPreferences(LB_CEF3_HANDLE context, int include_defaults);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextSetPreference(LB_CEF3_HANDLE context, const wchar_t* name, LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpCache(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearCertificateExceptions(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpAuthCredentials(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextCloseAllConnections(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieVisitAll(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieVisitUrl(LB_CEF3_HANDLE context, const wchar_t* url, int include_http_only);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieSet(
    LB_CEF3_HANDLE context, const wchar_t* url, const wchar_t* name, const wchar_t* value,
    const wchar_t* domain, const wchar_t* path, int secure, int http_only, int64_t expires_unix_seconds);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieDelete(
    LB_CEF3_HANDLE context, const wchar_t* url, const wchar_t* name);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieFlush(LB_CEF3_HANDLE context);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextRelease(LB_CEF3_HANDLE context);

LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetExtensionsForMimeType(const wchar_t* mime_type, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsSwitches(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsStrings(wchar_t* result, size_t capacity, size_t* required);

LB_CEF3_API void LB_CEF3_CALL LB_CEF3_ShutdownRegistry(void);
