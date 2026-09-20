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
typedef uint64_t LB_CEF3_CONTINUATION_HANDLE;
typedef uint64_t LB_CEF3_OPERATION_ID;

#define LB_CEF3_ABI_VERSION_V3 0x00030000u
#define LB_CEF3_ABI_VERSION_V4 0x00040000u

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
  LB_CEF3_HANDLE_CERTIFICATE_PRINCIPAL = 21,
  LB_CEF3_HANDLE_CONTINUATION = 22,
  LB_CEF3_HANDLE_POST_DATA = 23,
  LB_CEF3_HANDLE_POST_DATA_ELEMENT = 24,
  LB_CEF3_HANDLE_URL_REQUEST = 25,
  LB_CEF3_HANDLE_DOWNLOAD_ITEM = 26,
  LB_CEF3_HANDLE_PRINT_SETTINGS = 27,
  LB_CEF3_HANDLE_V8_CONTEXT = 28,
  LB_CEF3_HANDLE_V8_VALUE = 29,
  LB_CEF3_HANDLE_V8_EXCEPTION = 30,
  LB_CEF3_HANDLE_DOM_DOCUMENT = 31,
  LB_CEF3_HANDLE_DOM_NODE = 32,
  LB_CEF3_HANDLE_VIEW = 33,
  LB_CEF3_HANDLE_WINDOW = 34,
  LB_CEF3_HANDLE_LAYOUT = 35,
  LB_CEF3_HANDLE_OVERLAY = 36,
  LB_CEF3_HANDLE_OSR_SURFACE = 37,
  LB_CEF3_HANDLE_STREAM = 38,
  LB_CEF3_HANDLE_COMMAND_LINE = 39,
  LB_CEF3_HANDLE_XML_READER = 40,
  LB_CEF3_HANDLE_ZIP_READER = 41,
  LB_CEF3_HANDLE_JSHOOK = 42,
  LB_CEF3_HANDLE_COMPONENT_UPDATER = 43,
  LB_CEF3_HANDLE_PROCESS_MESSAGE = 44
  , LB_CEF3_HANDLE_SHARED_PROCESS_MESSAGE_BUILDER = 45
  , LB_CEF3_HANDLE_TASK_MANAGER = 46
  , LB_CEF3_HANDLE_WAITABLE_EVENT = 47
  , LB_CEF3_HANDLE_TASK_RUNNER = 48
  , LB_CEF3_HANDLE_COMPONENT = 49
  , LB_CEF3_HANDLE_THREAD = 50
  , LB_CEF3_HANDLE_STREAM_WRITER = 51
  , LB_CEF3_HANDLE_READ_HANDLER = 52
  , LB_CEF3_HANDLE_WRITE_HANDLER = 53
  , LB_CEF3_HANDLE_SHARED_MEMORY_REGION = 54
  , LB_CEF3_HANDLE_VIEW_DELEGATE = 55
  , LB_CEF3_HANDLE_DISPLAY = 56
  , LB_CEF3_HANDLE_DISPLAY_COLLECTION = 57
  , LB_CEF3_HANDLE_DRAG_DATA = 58
  , LB_CEF3_HANDLE_RESOURCE_BUNDLE = 59
  , LB_CEF3_HANDLE_CLIENT = 60
  , LB_CEF3_HANDLE_SSL_STATUS = 61
  , LB_CEF3_HANDLE_SSL_INFO = 62
  , LB_CEF3_HANDLE_DOWNLOAD_CALLBACK = 63
  , LB_CEF3_HANDLE_REQUEST_CONTEXT_HANDLER = 64
  , LB_CEF3_HANDLE_OBSERVER_REGISTRATION = 65
  , LB_CEF3_HANDLE_MEDIA_ROUTER = 66
  , LB_CEF3_HANDLE_MEDIA_SOURCE = 67
  , LB_CEF3_HANDLE_MEDIA_OBSERVER = 68
  , LB_CEF3_HANDLE_MEDIA_SINK_COLLECTION = 69
  , LB_CEF3_HANDLE_MEDIA_ROUTE_COLLECTION = 70
  , LB_CEF3_HANDLE_MEDIA_SINK = 71
  , LB_CEF3_HANDLE_MEDIA_ROUTE = 72
  , LB_CEF3_HANDLE_SERVER = 73
  , LB_CEF3_HANDLE_URL_REQUEST_CLIENT = 74
  , LB_CEF3_HANDLE_CERTIFICATE_COLLECTION = 75
  , LB_CEF3_HANDLE_RESPONSE_FILTER = 76
  , LB_CEF3_HANDLE_RESOURCE_HANDLER = 77
  , LB_CEF3_HANDLE_PRINT_DIALOG_CALLBACK = 78
  , LB_CEF3_HANDLE_PRINT_JOB_CALLBACK = 79
  , LB_CEF3_HANDLE_SCHEME_HANDLER_FACTORY = 80
  , LB_CEF3_HANDLE_V8_STACK_TRACE = 81
  , LB_CEF3_HANDLE_V8_STACK_FRAME = 82
  , LB_CEF3_HANDLE_V8_BACKING_STORE = 83
  , LB_CEF3_HANDLE_V8_ACCESSOR = 84
  , LB_CEF3_HANDLE_V8_INTERCEPTOR = 85
  , LB_CEF3_HANDLE_V8_ARRAY_BUFFER_RELEASE_CALLBACK = 86
  , LB_CEF3_HANDLE_V8_HANDLER = 87
  , LB_CEF3_HANDLE_V8_TASK_RUNNER = 88
  , LB_CEF3_HANDLE_V8_VALUE_COLLECTION = 89
  , LB_CEF3_HANDLE_MESSAGE_ROUTER = 90
  , LB_CEF3_HANDLE_RESOURCE_MANAGER = 91
  , LB_CEF3_HANDLE_STREAM_RESOURCE_HANDLER = 92
  , LB_CEF3_HANDLE_XML_OBJECT = 93
  , LB_CEF3_HANDLE_ZIP_ARCHIVE = 94
};

enum LB_CEF3_V8_CALLBACK_KIND {
  LB_CEF3_V8_CALLBACK_ACCESSOR = 1,
  LB_CEF3_V8_CALLBACK_INTERCEPTOR = 2,
  LB_CEF3_V8_CALLBACK_ARRAY_BUFFER_RELEASE = 3,
  LB_CEF3_V8_CALLBACK_FUNCTION = 4
};

enum LB_CEF3_SCHEME_OPTIONS {
  LB_CEF3_SCHEME_OPTION_NONE = 0,
  LB_CEF3_SCHEME_OPTION_STANDARD = 1 << 0,
  LB_CEF3_SCHEME_OPTION_LOCAL = 1 << 1,
  LB_CEF3_SCHEME_OPTION_DISPLAY_ISOLATED = 1 << 2,
  LB_CEF3_SCHEME_OPTION_SECURE = 1 << 3,
  LB_CEF3_SCHEME_OPTION_CORS_ENABLED = 1 << 4,
  LB_CEF3_SCHEME_OPTION_CSP_BYPASSING = 1 << 5,
  LB_CEF3_SCHEME_OPTION_FETCH_ENABLED = 1 << 6
};

enum LB_CEF3_THREAD_PRIORITY {
  LB_CEF3_THREAD_PRIORITY_BACKGROUND = 0,
  LB_CEF3_THREAD_PRIORITY_NORMAL = 1,
  LB_CEF3_THREAD_PRIORITY_DISPLAY = 2,
  LB_CEF3_THREAD_PRIORITY_REALTIME_AUDIO = 3
};

enum LB_CEF3_MESSAGE_LOOP_TYPE {
  LB_CEF3_MESSAGE_LOOP_DEFAULT = 0,
  LB_CEF3_MESSAGE_LOOP_UI = 1,
  LB_CEF3_MESSAGE_LOOP_IO = 2
};

enum LB_CEF3_COM_INIT_MODE {
  LB_CEF3_COM_INIT_NONE = 0,
  LB_CEF3_COM_INIT_STA = 1,
  LB_CEF3_COM_INIT_MTA = 2
};

enum LB_CEF3_STREAM_SEEK_ORIGIN {
  LB_CEF3_STREAM_SEEK_BEGIN = 0,
  LB_CEF3_STREAM_SEEK_CURRENT = 1,
  LB_CEF3_STREAM_SEEK_END = 2
};

enum LB_CEF3_XML_ENCODING_TYPE {
  LB_CEF3_XML_ENCODING_NONE = 0,
  LB_CEF3_XML_ENCODING_UTF8 = 1,
  LB_CEF3_XML_ENCODING_UTF16LE = 2,
  LB_CEF3_XML_ENCODING_UTF16BE = 3,
  LB_CEF3_XML_ENCODING_ASCII = 4
};

enum LB_CEF3_XML_NODE_TYPE {
  LB_CEF3_XML_NODE_UNSUPPORTED = 0,
  LB_CEF3_XML_NODE_PROCESSING_INSTRUCTION = 1,
  LB_CEF3_XML_NODE_DOCUMENT_TYPE = 2,
  LB_CEF3_XML_NODE_ELEMENT_START = 3,
  LB_CEF3_XML_NODE_ELEMENT_END = 4,
  LB_CEF3_XML_NODE_ATTRIBUTE = 5,
  LB_CEF3_XML_NODE_TEXT = 6,
  LB_CEF3_XML_NODE_CDATA = 7,
  LB_CEF3_XML_NODE_ENTITY_REFERENCE = 8,
  LB_CEF3_XML_NODE_WHITESPACE = 9,
  LB_CEF3_XML_NODE_COMMENT = 10
};

enum LB_CEF3_POST_DATA_ELEMENT_TYPE {
  LB_CEF3_POST_DATA_ELEMENT_EMPTY = 0,
  LB_CEF3_POST_DATA_ELEMENT_BYTES = 1,
  LB_CEF3_POST_DATA_ELEMENT_FILE = 2
};

enum LB_CEF3_JSHOOK_FRAME_SCOPE {
  LB_CEF3_JSHOOK_MAIN_FRAME = 0,
  LB_CEF3_JSHOOK_ALL_FRAMES = 1
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
  LB_CEF3_BROWSER_CHROME_RUNTIME = 1u << 4,
  /* 创建无窗口/OSR 浏览器。parent_window 仍用于 DPI、屏幕坐标和对话框归属。 */
  LB_CEF3_BROWSER_WINDOWLESS = 1u << 5
};

enum LB_CEF3_RUNTIME_STYLE {
  LB_CEF3_RUNTIME_STYLE_DEFAULT = 0,
  LB_CEF3_RUNTIME_STYLE_CHROME = 1,
  LB_CEF3_RUNTIME_STYLE_ALLOY = 2
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

/* 真无头（OSR）浏览器创建配置：V3 全字段 + 显式视口尺寸。
   osr_width/osr_height 必须同时为正数才作为权威视口；否则视为未设置，
   GetViewRect 依次回落到宿主窗口客户区（parent 为有效窗口时）与 LB_CEF3_DEFAULT_OSR_*。
   abi_version 为 V4 但 struct_size 未覆盖这两个尾部字段时，创建直接中文报错拒绝。 */
#define LB_CEF3_DEFAULT_OSR_WIDTH 1280
#define LB_CEF3_DEFAULT_OSR_HEIGHT 720

typedef struct LB_CEF3_BROWSER_CONFIG_V4 {
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
  uint32_t osr_width;
  uint32_t osr_height;
} LB_CEF3_BROWSER_CONFIG_V4;

typedef struct LB_CEF3_BROWSER_VIEW_CONFIG_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t user_token;
  uint32_t flags;
  const wchar_t* initial_url;
  LB_CEF3_HANDLE extra_info;
  LB_CEF3_HANDLE request_context;
} LB_CEF3_BROWSER_VIEW_CONFIG_V3;

enum LB_CEF3_KEY_EVENT_TYPE_V3 {
  LB_CEF3_KEY_EVENT_RAW_KEY_DOWN = 0,
  LB_CEF3_KEY_EVENT_KEY_DOWN = 1,
  LB_CEF3_KEY_EVENT_KEY_UP = 2,
  LB_CEF3_KEY_EVENT_CHAR = 3
};

typedef struct LB_CEF3_KEY_EVENT_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint32_t type;
  uint32_t modifiers;
  int32_t windows_key_code;
  int32_t native_key_code;
  int32_t is_system_key;
  uint32_t character;
  uint32_t unmodified_character;
  int32_t focus_on_editable_field;
} LB_CEF3_KEY_EVENT_V3;

typedef struct LB_CEF3_MOUSE_EVENT_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t x;
  int32_t y;
  uint32_t modifiers;
} LB_CEF3_MOUSE_EVENT_V3;

enum LB_CEF3_MOUSE_BUTTON_TYPE {
  LB_CEF3_MOUSE_BUTTON_LEFT = 0,
  LB_CEF3_MOUSE_BUTTON_MIDDLE = 1,
  LB_CEF3_MOUSE_BUTTON_RIGHT = 2
};

typedef struct LB_CEF3_TOUCH_EVENT_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t id;
  float x;
  float y;
  float radius_x;
  float radius_y;
  float rotation_angle;
  float pressure;
  uint32_t type;
  uint32_t modifiers;
  uint32_t pointer_type;
} LB_CEF3_TOUCH_EVENT_V3;

typedef struct LB_CEF3_POINT_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t x;
  int32_t y;
} LB_CEF3_POINT_V3;

typedef struct LB_CEF3_SIZE_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t width;
  int32_t height;
} LB_CEF3_SIZE_V3;

typedef struct LB_CEF3_RECT_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t x;
  int32_t y;
  int32_t width;
  int32_t height;
} LB_CEF3_RECT_V3;

typedef struct LB_CEF3_INSETS_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t top;
  int32_t left;
  int32_t bottom;
  int32_t right;
} LB_CEF3_INSETS_V3;

typedef struct LB_CEF3_DRAGGABLE_REGION_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  LB_CEF3_RECT_V3 bounds;
  int32_t draggable;
} LB_CEF3_DRAGGABLE_REGION_V3;

typedef struct LB_CEF3_RANGE_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint32_t from;
  uint32_t to;
} LB_CEF3_RANGE_V3;

typedef struct LB_CEF3_COMPOSITION_UNDERLINE_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  LB_CEF3_RANGE_V3 range;
  uint32_t color;
  uint32_t background_color;
  int32_t thick;
  int32_t style;
} LB_CEF3_COMPOSITION_UNDERLINE_V3;

typedef struct LB_CEF3_PDF_PRINT_SETTINGS_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t landscape;
  int32_t print_background;
  double scale;
  double paper_width;
  double paper_height;
  int32_t prefer_css_page_size;
  int32_t margin_type;
  double margin_top;
  double margin_right;
  double margin_bottom;
  double margin_left;
  const wchar_t* page_ranges;
  int32_t display_header_footer;
  const wchar_t* header_template;
  const wchar_t* footer_template;
  int32_t generate_tagged_pdf;
  int32_t generate_document_outline;
} LB_CEF3_PDF_PRINT_SETTINGS_V3;

typedef struct LB_CEF3_BOX_LAYOUT_SETTINGS_V3 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t horizontal;
  int32_t inside_border_horizontal_spacing;
  int32_t inside_border_vertical_spacing;
  LB_CEF3_INSETS_V3 inside_border_insets;
  int32_t between_child_spacing;
  int32_t main_axis_alignment;
  int32_t cross_axis_alignment;
  int32_t minimum_cross_axis_size;
  int32_t default_flex;
} LB_CEF3_BOX_LAYOUT_SETTINGS_V3;

enum LB_CEF3_TOUCH_EVENT_TYPE {
  LB_CEF3_TOUCH_EVENT_RELEASED = 0,
  LB_CEF3_TOUCH_EVENT_PRESSED = 1,
  LB_CEF3_TOUCH_EVENT_MOVED = 2,
  LB_CEF3_TOUCH_EVENT_CANCELLED = 3
};

enum LB_CEF3_POINTER_TYPE {
  LB_CEF3_POINTER_TYPE_TOUCH = 0,
  LB_CEF3_POINTER_TYPE_MOUSE = 1,
  LB_CEF3_POINTER_TYPE_PEN = 2,
  LB_CEF3_POINTER_TYPE_ERASER = 3,
  LB_CEF3_POINTER_TYPE_UNKNOWN = 4
};

enum LB_CEF3_VALUE_KIND_V4 {
  LB_CEF3_VALUE_V4_VOID = 0,
  LB_CEF3_VALUE_V4_INTEGER = 1,
  LB_CEF3_VALUE_V4_DOUBLE = 2,
  LB_CEF3_VALUE_V4_BOOLEAN = 3,
  LB_CEF3_VALUE_V4_TEXT = 4,
  LB_CEF3_VALUE_V4_HANDLE = 5,
  LB_CEF3_VALUE_V4_BUFFER = 6,
  LB_CEF3_VALUE_V4_JSON = 7
};

enum LB_CEF3_CALL_FLAGS_V4 {
  LB_CEF3_CALL_V4_NONE = 0,
  LB_CEF3_CALL_V4_ASYNC = 1u << 0
};

typedef struct LB_CEF3_ARGUMENT_V4 {
  uint32_t struct_size;
  uint32_t value_kind;
  int64_t integer_value;
  double double_value;
  LB_CEF3_HANDLE handle_value;
  LB_CEF3_BUFFER_HANDLE buffer_value;
  const wchar_t* text_value;
} LB_CEF3_ARGUMENT_V4;

typedef struct LB_CEF3_CALL_V4 {
  uint32_t struct_size;
  uint32_t abi_version;
  LB_CEF3_OPERATION_ID operation_id;
  LB_CEF3_HANDLE target;
  const LB_CEF3_ARGUMENT_V4* arguments;
  size_t argument_count;
  uint32_t flags;
  uint32_t reserved;
} LB_CEF3_CALL_V4;

typedef struct LB_CEF3_RESULT_V4 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t status;
  uint32_t value_kind;
  int64_t integer_value;
  double double_value;
  LB_CEF3_HANDLE handle_value;
  LB_CEF3_BUFFER_HANDLE buffer_value;
  wchar_t* text;
  size_t text_capacity;
  size_t text_required;
} LB_CEF3_RESULT_V4;

typedef struct LB_CEF3_EVENT_PACKET_V4 {
  uint32_t struct_size;
  uint32_t abi_version;
  uint64_t sequence;
  uint64_t timestamp_milliseconds;
  LB_CEF3_HANDLE browser;
  LB_CEF3_HANDLE subject;
  LB_CEF3_CONTINUATION_HANDLE continuation;
  uint64_t user_token;
  LB_CEF3_OPERATION_ID event_id;
  uint32_t flags;
  uint32_t timeout_milliseconds;
  const wchar_t* event_name;
  const wchar_t* fields_json;
} LB_CEF3_EVENT_PACKET_V4;

typedef struct LB_CEF3_EVENT_RESPONSE_V4 {
  uint32_t struct_size;
  uint32_t abi_version;
  int32_t action;
  uint32_t flags;
  const wchar_t* response_json;
} LB_CEF3_EVENT_RESPONSE_V4;

typedef void(LB_CEF3_CALL* LB_CEF3_EVENT_CALLBACK_V4)(
  const LB_CEF3_EVENT_PACKET_V4* packet,
  LB_CEF3_EVENT_RESPONSE_V4* response,
  void* user_data);

LB_CEF3_API uint32_t LB_CEF3_CALL LB_CEF3_GetAbiVersion(void);
LB_CEF3_API uint32_t LB_CEF3_CALL LB_CEF3_GetLatestAbiVersion(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetCefVersion(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetLastError(wchar_t* result, size_t capacity, size_t* required);

/* v4 安全操作目录。operation_id 由完整 CEF 签名的 SHA-256 前 64 位确定。 */
LB_CEF3_API size_t LB_CEF3_CALL LB_CEF3_GetOperationCountV4(void);
LB_CEF3_API LB_CEF3_OPERATION_ID LB_CEF3_CALL LB_CEF3_GetOperationIdAtV4(size_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetOperationInfoV4(
  LB_CEF3_OPERATION_ID operation_id, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_InvokeV4(const LB_CEF3_CALL_V4* call, LB_CEF3_RESULT_V4* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetEventCallbackV4(
  LB_CEF3_HANDLE browser, LB_CEF3_EVENT_CALLBACK_V4 callback, void* user_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ContinuationCompleteV4(
  LB_CEF3_CONTINUATION_HANDLE continuation, int action, const wchar_t* response_json);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ContinuationCancelV4(LB_CEF3_CONTINUATION_HANDLE continuation);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ContinuationReleaseV4(LB_CEF3_CONTINUATION_HANDLE continuation);

/* JS 交互（cefQuery）通道。注册必须在 LB_CEF3_Initialize 之前完成：查询函数名
   随 CefMessageRouterConfig 在渲染进程 OnWebKitInitialized 时注入 window，
   CEF 初始化后注册的通道不生效。一个程序可注册多条通道（上限 16 条），下标即
   「查询请求」事件 channelIndex 字段的通道号；每条通道的查询名与取消名都必须是
   合法 JS 标识符且跨通道互不重复，完全相同的重复注册按幂等成功处理，冲突返回
   失败。对外查询ID 由桥全局递增分配（多条通道的 CEF query_id 会互相重号）。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_EnableJsQuery(
    const wchar_t* query_function, const wchar_t* cancel_function);
/* 按查询 ID 应答页面查询：success 非 0 时以 result_text 调用 onSuccess，
   否则以 error_code 与 error_text 调用 onFailure。查询 ID 从「查询请求」
   事件的 queryId 字段读出。查询已被应答、取消或不存在时返回失败。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_JsQueryRespond(
    LB_CEF3_HANDLE browser, const wchar_t* query_id, int success,
    const wchar_t* result_text, int error_code, const wchar_t* error_text);

/* V8 objects never leave the renderer process. These entry points route the
   official operation ID to the renderer and return a managed Task. Any
   resulting object is represented by a typed proxy handle whose renderer
   lease is invalidated when its context is released. */
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8GlobalInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8ContextInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8ValueInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8ExceptionInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8StackTraceInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8StackFrameInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8BackingStoreInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8AccessorInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8InterceptorInvoke(
    const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL
LB_CEF3_V8ArrayBufferReleaseCallbackInvoke(const LB_CEF3_CALL_V4* call);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_FrameGetV8Context(
    LB_CEF3_HANDLE frame);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8CallbackCreate(
    LB_CEF3_HANDLE context, int32_t callback_kind);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_V8StackTraceGetFrame(
    LB_CEF3_HANDLE stack_trace, int32_t index);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_V8ValueCollectionCreate(
    const LB_CEF3_HANDLE* values, size_t value_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeV8Result(
    LB_CEF3_TASK_HANDLE task, int32_t expected_type, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeV8BufferResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeV8ListResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
/* Must be configured in every process before ExecuteSubProcess. The renderer
   calls CefRegisterExtension from OnWebKitInitialized with a Bridge-owned
   handler; caller-provided CefV8Handler pointers are never accepted. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_V8RegisterExtension(
    const wchar_t* extension_name, const wchar_t* javascript_code);

/* 自定义Scheme配置必须在每个进程调用ExecuteSubProcess之前完成。BridgeApp在
   OnRegisterCustomSchemes中复制配置并真实调用registrar->AddCustomScheme。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_AppRegisterCustomScheme(
    const wchar_t* scheme_name, int32_t options);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SchemeRegistrarAddCustomScheme(
    const wchar_t* scheme_name, int32_t options);
/* CEF核心生命周期。ExecuteSubProcess必须在创建任何窗口前调用；>=0表示子进程应直接退出。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ExecuteSubProcess(uint64_t application_instance);
/* ResourceBundleHandler configuration is copied into Bridge-owned storage and
   becomes immutable when CEF initialization begins. Binary resources are
   accepted only through managedBuffer handles. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleHandlerSetLocalizedString(
    int32_t string_id, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleHandlerSetDataResource(
    int32_t resource_id, LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleHandlerSetDataResourceForScale(
    int32_t resource_id, int32_t scale_factor,
    LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_Initialize(const LB_CEF3_INITIALIZE_CONFIG_V3* config);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetCommandLineSwitch(
    const wchar_t* process_type, const wchar_t* name, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IsInitialized(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_Shutdown(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DoMessageLoopWork(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RunMessageLoop(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_QuitMessageLoop(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHostGetBrowserByIdentifier(
    int32_t browser_id, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHostCreateBrowserSync(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE client, const wchar_t* url,
    LB_CEF3_HANDLE settings, LB_CEF3_HANDLE extra_info,
    LB_CEF3_HANDLE request_context, LB_CEF3_HANDLE* result);

LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreate(const LB_CEF3_BROWSER_CONFIG_V3* config);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateChrome(const LB_CEF3_BROWSER_CONFIG_V3* config);
/* 创建真无头浏览器：必须带 LB_CEF3_BROWSER_WINDOWLESS，全进程不为其创建任何 HWND。
   parent_window 允许为 0；视口取 osr_width/osr_height，二者未同时为正数时视为未设置，
   由 GetViewRect 回落到宿主窗口客户区（parent 有效时）或 LB_CEF3_DEFAULT_OSR_*。
   旧导出 LB_CEF3_BrowserCreate / LB_CEF3_BrowserCreateChrome 仍收 V3 配置，
   无尾部视口字段，OSR 浏览器继续按宿主窗口客户区取尺寸（行为与加宽前一致）。 */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateWindowless(
    const LB_CEF3_BROWSER_CONFIG_V4* config);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserClose(LB_CEF3_HANDLE browser, int force_close);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserTryClose(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserNotifyMoveOrResizeStarted(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserNotifyScreenInfoChanged(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendCaptureLostEvent(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserImeCancelComposition(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserImeFinishComposingText(
    LB_CEF3_HANDLE browser, int keep_selection);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserAddWordToDictionary(
    LB_CEF3_HANDLE browser, const wchar_t* word);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserReplaceMisspelling(
    LB_CEF3_HANDLE browser, const wchar_t* word);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragSourceSystemDragEnded(
    LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragTargetDragLeave(
    LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserWasHidden(
    LB_CEF3_HANDLE browser, int hidden);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserExitFullscreen(
    LB_CEF3_HANDLE browser, int will_cause_resize);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserResize(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserLoadUrl(LB_CEF3_HANDLE browser, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGoBack(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGoForward(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserReload(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserReloadIgnoreCache(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserStopLoad(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserFind(
    LB_CEF3_HANDLE browser, const wchar_t* search_text, int forward, int match_case, int find_next);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserStopFinding(LB_CEF3_HANDLE browser, int clear_selection);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetFocus(LB_CEF3_HANDLE browser, int focus);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendMouseClickEvent(
    LB_CEF3_HANDLE browser, const LB_CEF3_MOUSE_EVENT_V3* event,
    int button_type, int mouse_up, int click_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendMouseMoveEvent(
    LB_CEF3_HANDLE browser, const LB_CEF3_MOUSE_EVENT_V3* event, int mouse_leave);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendMouseWheelEvent(
    LB_CEF3_HANDLE browser, const LB_CEF3_MOUSE_EVENT_V3* event, int delta_x, int delta_y);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendTouchEvent(
    LB_CEF3_HANDLE browser, const LB_CEF3_TOUCH_EVENT_V3* event);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendKeyEvent(
    LB_CEF3_HANDLE browser, const LB_CEF3_KEY_EVENT_V3* event);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanGoBack(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanGoForward(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsLoading(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsValid(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsPopup(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsSame(LB_CEF3_HANDLE browser, LB_CEF3_HANDLE other_browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHasDocument(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFocusedFrame(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFrameByIdentifier(
    LB_CEF3_HANDLE browser, const wchar_t* identifier, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFrameByName(
    LB_CEF3_HANDLE browser, const wchar_t* name, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFrameCount(
    LB_CEF3_HANDLE browser, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFrameIdentifiers(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetFrameNames(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameIsValid(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameUndo(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameRedo(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameCut(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameCopy(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FramePaste(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FramePasteAndMatchStyle(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameDelete(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameSelectAll(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameViewSource(LB_CEF3_HANDLE frame);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_FrameGetSource(
    LB_CEF3_HANDLE frame);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_FrameGetText(
    LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StringVisitorVisit(
    LB_CEF3_TASK_HANDLE visitor_task, const wchar_t* value);
/* VisitDOM executes in the renderer process. The task owns a copied,
   structured DOM snapshot; no CefDOMDocument/CefDOMNode pointer crosses ABI. */
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_FrameVisitDom(
    LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomVisitorVisit(
    LB_CEF3_TASK_HANDLE visitor_task, LB_CEF3_HANDLE* document);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetType(
    LB_CEF3_HANDLE document, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetDocument(
    LB_CEF3_HANDLE document, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetBody(
    LB_CEF3_HANDLE document, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetHead(
    LB_CEF3_HANDLE document, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetTitle(
    LB_CEF3_HANDLE document, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetElementById(
    LB_CEF3_HANDLE document, const wchar_t* id, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetFocusedNode(
    LB_CEF3_HANDLE document, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentHasSelection(
    LB_CEF3_HANDLE document);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetSelectionStartOffset(
    LB_CEF3_HANDLE document, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetSelectionEndOffset(
    LB_CEF3_HANDLE document, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetSelectionAsMarkup(
    LB_CEF3_HANDLE document, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetSelectionAsText(
    LB_CEF3_HANDLE document, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetBaseUrl(
    LB_CEF3_HANDLE document, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomDocumentGetCompleteUrl(
    LB_CEF3_HANDLE document, const wchar_t* partial_url, wchar_t* result,
    size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetType(
    LB_CEF3_HANDLE node, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeIsText(LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeIsElement(LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeIsEditable(LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeIsFormControlElement(
    LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetFormControlElementType(
    LB_CEF3_HANDLE node, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeIsSame(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetName(
    LB_CEF3_HANDLE node, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetValue(
    LB_CEF3_HANDLE node, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_DomNodeSetValue(
    LB_CEF3_HANDLE node, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetAsMarkup(
    LB_CEF3_HANDLE node, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetDocument(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetParent(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetPreviousSibling(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetNextSibling(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeHasChildren(LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetFirstChild(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetLastChild(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetElementTagName(
    LB_CEF3_HANDLE node, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeHasElementAttributes(
    LB_CEF3_HANDLE node);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeHasElementAttribute(
    LB_CEF3_HANDLE node, const wchar_t* attribute_name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetElementAttribute(
    LB_CEF3_HANDLE node, const wchar_t* attribute_name, wchar_t* result,
    size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetElementAttributes(
    LB_CEF3_HANDLE node, LB_CEF3_HANDLE* result);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_DomNodeSetElementAttribute(
    LB_CEF3_HANDLE node, const wchar_t* attribute_name, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetElementInnerText(
    LB_CEF3_HANDLE node, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DomNodeGetElementBounds(
    LB_CEF3_HANDLE node, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameLoadRequest(
    LB_CEF3_HANDLE frame, LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameLoadUrl(
    LB_CEF3_HANDLE frame, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameExecuteJavaScript(
    LB_CEF3_HANDLE frame, const wchar_t* code, const wchar_t* script_url,
    int start_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameIsMain(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameIsFocused(LB_CEF3_HANDLE frame);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameGetName(
    LB_CEF3_HANDLE frame, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameGetIdentifier(
    LB_CEF3_HANDLE frame, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameGetParent(
    LB_CEF3_HANDLE frame, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameGetUrl(
    LB_CEF3_HANDLE frame, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameGetBrowser(
    LB_CEF3_HANDLE frame, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameSendProcessMessage(
    LB_CEF3_HANDLE frame, int target_process, LB_CEF3_HANDLE message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameCreateUrlRequest(
    LB_CEF3_HANDLE frame, LB_CEF3_HANDLE request,
    LB_CEF3_HANDLE client, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsWindowRenderingDisabled(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsFullscreen(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHasView(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOpenerIdentifier(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanExecuteChromeCommand(
    LB_CEF3_HANDLE browser, int32_t command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserExecuteChromeCommand(
    LB_CEF3_HANDLE browser, int32_t command_id, int32_t disposition);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetBrowser(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetClient(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClientGetRenderHandlerAvailable(
    LB_CEF3_HANDLE client);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClientGetFrameHandlerAvailable(
    LB_CEF3_HANDLE client);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClientGetDownloadHandlerAvailable(
    LB_CEF3_HANDLE client);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClientGetPrintHandlerAvailable(
    LB_CEF3_HANDLE client);
/* Native HWND values never cross the ABI. Successful calls return a retained
   managed Browser alias representing the associated native window. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetWindowHandle(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOpenerWindowHandle(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsReadyToBeClosed(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsRenderProcessUnresponsive(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetRuntimeStyle(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetWindowlessFrameRate(
    LB_CEF3_HANDLE browser, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetWindowlessFrameRate(
    LB_CEF3_HANDLE browser, int32_t frame_rate);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserInvalidate(
    LB_CEF3_HANDLE browser, int32_t paint_element_type);
/* OSR 视口读写与出帧计数：只对 LB_CEF3_BROWSER_WINDOWLESS 浏览器有效，窗口浏览器
   一律返回 LB_CEF3_ERROR_NOT_SUPPORTED 并给中文诊断。SetOsrViewport 写入选定视口后
   触发 NotifyScreenInfoChanged + Invalidate(PET_VIEW)，让 CEF 立刻重查 GetViewRect；
   GetOsrViewport 与 GetViewRect 共用同一条解析链（显式视口 -> 宿主窗口客户区 ->
   LB_CEF3_DEFAULT_OSR_*），因此未显式设置时报告的是 CEF 实际在用的尺寸而非 0×0。
   帧数只统计已交付的像素帧，不携带像素，也不代表宿主已取走帧内容。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetOsrViewport(
    LB_CEF3_HANDLE browser, uint32_t width, uint32_t height);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrViewport(
    LB_CEF3_HANDLE browser, uint32_t* width, uint32_t* height);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrPaintCount(
    LB_CEF3_HANDLE browser, uint64_t* paint_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendExternalBeginFrame(
    LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserImeCommitText(
    LB_CEF3_HANDLE browser, const wchar_t* text,
    const LB_CEF3_RANGE_V3* replacement_range, int32_t relative_cursor_pos);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserImeSetComposition(
    LB_CEF3_HANDLE browser, const wchar_t* text,
    const LB_CEF3_COMPOSITION_UNDERLINE_V3* underlines, size_t underline_count,
    const LB_CEF3_RANGE_V3* replacement_range,
    const LB_CEF3_RANGE_V3* selection_range);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragSourceEndedAt(
    LB_CEF3_HANDLE browser, int32_t x, int32_t y, uint32_t operation);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragTargetDragEnter(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE drag_data,
    const LB_CEF3_MOUSE_EVENT_V3* event, uint32_t allowed_operations);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragTargetDragOver(
    LB_CEF3_HANDLE browser, const LB_CEF3_MOUSE_EVENT_V3* event,
    uint32_t allowed_operations);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserDragTargetDrop(
    LB_CEF3_HANDLE browser, const LB_CEF3_MOUSE_EVENT_V3* event);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetAccessibilityState(
    LB_CEF3_HANDLE browser, int32_t accessibility_state);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetAutoResizeEnabled(
    LB_CEF3_HANDLE browser, int enabled, const LB_CEF3_SIZE_V3* minimum_size,
    const LB_CEF3_SIZE_V3* maximum_size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetAxViewportCollapse(
    LB_CEF3_HANDLE browser, int enabled);
/* Render, accessibility and frame callback subjects are managed handles.
   Paint bytes are delivered only as managed buffers. Callback subjects are
   valid for the callback duration unless retained explicitly. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderProcessHandlerGetLoadHandlerAvailable(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderProcessHandlerSubscribeFocusedNodeChanged(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderProcessHandlerSubscribeUncaughtException(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderProcessHandlerSubscribeWebKitInitialized(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeAccessibilityHandler(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeRootScreenRect(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeScreenInfo(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeScreenPoint(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeTouchHandleSize(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeViewRect(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeAcceleratedPaint(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeImeCompositionRangeChanged(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribePaint(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribePopupShow(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribePopupSize(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeScrollOffsetChanged(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeTextSelectionChanged(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeTouchHandleStateChanged(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeVirtualKeyboardRequested(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeStartDragging(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RenderHandlerSubscribeUpdateDragCursor(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_AccessibilityHandlerSubscribeLocationChange(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_AccessibilityHandlerSubscribeTreeChange(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameHandlerSubscribeAttached(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameHandlerSubscribeCreated(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameHandlerSubscribeDestroyed(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameHandlerSubscribeDetached(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FrameHandlerSubscribeMainFrameChanged(
    LB_CEF3_HANDLE browser, int enabled);

/* PrintHandler callbacks are delivered on the CEF UI thread. PrintSettings
   subjects are callback-scoped and become invalid when the callback returns.
   Dialog/job callback subjects are one-shot typed handles; retain them during
   the event callback for asynchronous completion and release them afterwards. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribeStart(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribeSettings(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribeDialog(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribeJob(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribeReset(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintHandlerSubscribePdfPaperSize(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSendDevToolsMessage(
    LB_CEF3_HANDLE browser, LB_CEF3_BUFFER_HANDLE message);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserDownloadImage(
    LB_CEF3_HANDLE browser, const wchar_t* image_url, int is_favicon,
    uint32_t maximum_image_size, int bypass_cache);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserPrintToPdf(
    LB_CEF3_HANDLE browser, const wchar_t* path,
    const LB_CEF3_PDF_PRINT_SETTINGS_V3* settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetZoomLevel(LB_CEF3_HANDLE browser, double* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetDefaultZoomLevel(LB_CEF3_HANDLE browser, double* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetZoomLevel(LB_CEF3_HANDLE browser, double zoom_level);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCanZoom(LB_CEF3_HANDLE browser, int command);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserZoom(LB_CEF3_HANDLE browser, int command);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetTitle(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetUrl(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetProfilePath(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetProxy(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);

LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserIsAudioMuted(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetAudioMuted(LB_CEF3_HANDLE browser, int muted);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserEvaluateJavaScript(LB_CEF3_HANDLE browser, const wchar_t* script);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserRunFileDialog(
    LB_CEF3_HANDLE browser, int mode, const wchar_t* title,
    const wchar_t* default_file_path, const wchar_t* accept_filters_json);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserStartDownload(LB_CEF3_HANDLE browser, const wchar_t* url);
/* CefDownloadItem is callback-scoped by CEF. This returns a retained managed
   snapshot handle and never exposes or retains the CEF object itself. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetLastDownloadItem(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
/* Download handler callbacks remain owned by BridgeClient. These switches
   expose each official callback as an opt-in managed V4 event without ever
   exposing the callback-scoped CEF objects. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadSubscribeCanDownload(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadSubscribeBeforeDownload(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadSubscribeUpdated(
    LB_CEF3_HANDLE browser, int enabled);
/* CefRequestHandler is owned by BridgeClient. These switches expose the
   navigation and render lifecycle callbacks through managed V4 events. A
   callback-scoped Request subject must be retained explicitly if needed after
   the event callback returns. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeBeforeBrowse(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeDocumentAvailable(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeOpenUrlFromTab(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeRenderProcessTerminated(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeRenderViewReady(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestHandlerSubscribeSelectClientCertificate(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeProtocolExecution(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeResourceLoadComplete(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeResourceRedirect(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeResourceResponse(
    LB_CEF3_HANDLE browser, int enabled);
/* 在当前“资源响应到达”事件上下文中标记 request，随后由响应过滤器有界捕获正文。
   正文完成后通过同一浏览器事件回调发出“资源响应正文到达”。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceResponseBodyBegin(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE request, int64_t max_bytes);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSubscribeCookieAccessFilter(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CookieAccessFilterSubscribeCanSendCookie(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CookieAccessFilterSubscribeCanSaveCookie(
    LB_CEF3_HANDLE browser, int enabled);
/* ResponseFilter配置只保存managedBuffer字节副本，不持有CEF缓冲地址。
   附加后每个响应创建独立CEF过滤实例；传入0可从Browser解除附加。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseFilterCreate(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseFilterSetReplacement(
    LB_CEF3_HANDLE filter, LB_CEF3_BUFFER_HANDLE find_bytes,
    LB_CEF3_BUFFER_HANDLE replacement_bytes);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSetResponseFilter(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE filter);
/* ResourceHandler响应源匹配经CefParseURL规范化的scheme/host/port/path前缀，
   正文与异步读写只使用managedBuffer和受管Continuation。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerCreate(
    const wchar_t* url_prefix, LB_CEF3_BUFFER_HANDLE body,
    LB_CEF3_HANDLE* result);
/* SchemeHandlerFactory句柄仅持有受管ResourceHandler配置。每次CEF IO线程回调
   Create时都会创建独立CefResourceHandler；句柄释放不撤销已注册的CEF工厂。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SchemeHandlerFactoryCreate(
    LB_CEF3_HANDLE resource_handler, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSetLegacyOpen(
    LB_CEF3_HANDLE handler, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSetResponse(
    LB_CEF3_HANDLE handler, int32_t status_code, const wchar_t* mime_type,
    const wchar_t* redirect_url, LB_CEF3_HANDLE header_map);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSetAsyncSkip(
    LB_CEF3_HANDLE handler, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSetAsyncRead(
    LB_CEF3_HANDLE handler, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSetLegacyRead(
    LB_CEF3_HANDLE handler, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceHandlerSubscribeCancel(
    LB_CEF3_HANDLE handler, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceReadCallbackContinue(
    LB_CEF3_CONTINUATION_HANDLE continuation, int32_t bytes_read);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceSkipCallbackContinue(
    LB_CEF3_CONTINUATION_HANDLE continuation, int64_t bytes_skipped);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceRequestHandlerSetResourceHandler(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE handler);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificateCollectionGetCount(
    LB_CEF3_HANDLE collection, uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CertificateCollectionGetAt(
    LB_CEF3_HANDLE collection, uint64_t index, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SelectClientCertificateCallbackSelect(
    LB_CEF3_CONTINUATION_HANDLE continuation, LB_CEF3_HANDLE certificate);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BeforeDownloadCallbackContinue(
    LB_CEF3_CONTINUATION_HANDLE continuation, const wchar_t* download_path,
    int show_dialog);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetLastDownloadCallback(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemCallbackCancel(
    LB_CEF3_HANDLE callback);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemCallbackPause(
    LB_CEF3_HANDLE callback);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemCallbackResume(
    LB_CEF3_HANDLE callback);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintDialogCallbackContinue(
    LB_CEF3_HANDLE callback, LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintDialogCallbackCancel(
    LB_CEF3_HANDLE callback);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintJobCallbackContinue(
    LB_CEF3_HANDLE callback);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsValid(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsInProgress(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsComplete(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsCanceled(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsInterrupted(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemIsPaused(LB_CEF3_HANDLE item);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetInterruptReason(
    LB_CEF3_HANDLE item, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetCurrentSpeed(
    LB_CEF3_HANDLE item, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetPercentComplete(
    LB_CEF3_HANDLE item, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetTotalBytes(
    LB_CEF3_HANDLE item, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetReceivedBytes(
    LB_CEF3_HANDLE item, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetStartTime(
    LB_CEF3_HANDLE item, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetEndTime(
    LB_CEF3_HANDLE item, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetFullPath(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetId(
    LB_CEF3_HANDLE item, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetUrl(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetOriginalUrl(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetSuggestedFileName(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetContentDisposition(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DownloadItemGetMimeType(
    LB_CEF3_HANDLE item, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserPrint(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserShowDevTools(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserCloseDevTools(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserHasDevTools(LB_CEF3_HANDLE browser);
/* DevTools protocol is intentionally the only dynamic JSON surface. Results are
   returned through a managed task and notifications use the normal browser
   event route. */
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_DevToolsExecuteMethod(
    LB_CEF3_HANDLE browser, const wchar_t* method, const wchar_t* parameters_json);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DevToolsSubscribeAgentAttached(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DevToolsSubscribeAgentDetached(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DevToolsSubscribeEvent(
    LB_CEF3_HANDLE browser, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DevToolsSubscribeMessage(
    LB_CEF3_HANDLE browser, int enabled);

/* JSHook 在渲染进程 OnContextCreated 阶段执行；动态注册默认从当前/下一个上下文生效。 */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_JsHookRegister(
  LB_CEF3_HANDLE browser, const wchar_t* name, const wchar_t* script,
  const wchar_t* url_pattern, int frame_scope, int execute_existing_contexts);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_JsHookRemove(LB_CEF3_HANDLE hook);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_JsHookClear(LB_CEF3_HANDLE browser);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_JsHookList(
  LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_JsHookReply(
  LB_CEF3_HANDLE browser, uint64_t request_id, int success, const wchar_t* response_text);

/* 文件缓冲读写只有配置允许根目录后才可调用。 */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetAllowedFileRoot(const wchar_t* root_directory);

LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleGetType(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleIsValid(LB_CEF3_HANDLE handle, int expected_type);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleRetain(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_HandleRelease(LB_CEF3_HANDLE handle);
/* CEF base ownership is projected onto managed handle references. These
   exports never expose or mutate a raw CEF base pointer. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RefCountedAddRef(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RefCountedRelease(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RefCountedHasOneRef(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RefCountedHasAtLeastOneRef(LB_CEF3_HANDLE handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScopedDelete(LB_CEF3_HANDLE handle);

/* TaskCreate/Set* 供 Bridge 子系统产生异步任务；DSL 仅使用查询、取消和释放接口。 */
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_TaskCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetRunning(LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetResult(LB_CEF3_TASK_HANDLE task, const wchar_t* result_json);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskSetError(LB_CEF3_TASK_HANDLE task, const wchar_t* error_text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetStatus(LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetResult(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetError(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required);
/* DownloadImage tasks expose their optional CefImage exactly once as a managed
   Image handle. No CEF pointer or numeric handle is embedded in task JSON. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeImageResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
/* Media observer tasks expose Sink/Route vectors exactly once as managed
   collection handles. Element access returns only typed managed handles. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeMediaCollectionResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeMediaRouteResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeMediaBufferResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeServerResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeServerRequestResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetServerConnectionId(
    LB_CEF3_TASK_HANDLE task, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskGetServerClientAddress(
    LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity,
    size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeServerBufferResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeServerContinuationResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_CONTINUATION_HANDLE* result);
/* URLRequest callback payloads are copied into Bridge-owned storage before
   the CEF callback returns. Each payload/continuation can be taken once. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeUrlRequestBufferResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeUrlRequestAuthContinuationResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_CONTINUATION_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskTakeDomDocumentResult(
    LB_CEF3_TASK_HANDLE task, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskExecute(LB_CEF3_TASK_HANDLE task);
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

/* StreamReader retains the source managed buffer for the lifetime of the
   opaque stream handle. Read returns a new managed buffer and never exposes
   caller-owned memory to CEF. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_StreamReaderCreateForBuffer(
    LB_CEF3_BUFFER_HANDLE buffer);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_StreamReaderCreateForFile(
    const wchar_t* path);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_StreamReaderRead(
    LB_CEF3_HANDLE reader, uint64_t maximum_bytes);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamReaderSeek(
    LB_CEF3_HANDLE reader, int64_t offset, int whence);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_StreamReaderTell(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamReaderEof(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamReaderMayBlock(LB_CEF3_HANDLE reader);

/* Custom stream handlers are backed only by Bridge-managed buffers. The read
   handler retains its source buffer; the write handler owns a bounded in-memory
   sink that can be retrieved as a new managed buffer. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ReadHandlerCreateForBuffer(
    LB_CEF3_BUFFER_HANDLE buffer, int may_block);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ReadHandlerRead(
    LB_CEF3_HANDLE handler, uint64_t maximum_bytes);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ReadHandlerSeek(
    LB_CEF3_HANDLE handler, int64_t offset, int whence);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ReadHandlerTell(LB_CEF3_HANDLE handler);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ReadHandlerEof(LB_CEF3_HANDLE handler);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ReadHandlerMayBlock(LB_CEF3_HANDLE handler);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_StreamReaderCreateForHandler(
    LB_CEF3_HANDLE handler);

/* StreamWriter accepts only bridge-owned buffers. File paths are checked
   against the configured project file root before CEF opens the file. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_StreamWriterCreateForFile(
    const wchar_t* path);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_StreamWriterWrite(
    LB_CEF3_HANDLE writer, LB_CEF3_BUFFER_HANDLE buffer,
    uint64_t source_offset, uint64_t byte_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamWriterSeek(
    LB_CEF3_HANDLE writer, int64_t offset, int whence);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_StreamWriterTell(LB_CEF3_HANDLE writer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamWriterFlush(LB_CEF3_HANDLE writer);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamWriterMayBlock(LB_CEF3_HANDLE writer);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_WriteHandlerCreate(int may_block);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_WriteHandlerWrite(
    LB_CEF3_HANDLE handler, LB_CEF3_BUFFER_HANDLE buffer,
    uint64_t source_offset, uint64_t byte_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WriteHandlerSeek(
    LB_CEF3_HANDLE handler, int64_t offset, int whence);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_WriteHandlerTell(LB_CEF3_HANDLE handler);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WriteHandlerFlush(LB_CEF3_HANDLE handler);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WriteHandlerMayBlock(LB_CEF3_HANDLE handler);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_WriteHandlerGetBuffer(
    LB_CEF3_HANDLE handler);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_StreamWriterCreateForHandler(
    LB_CEF3_HANDLE handler);

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
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_NavigationEntryGetSslStatus(LB_CEF3_HANDLE entry);
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
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_SslInfoCreateFromCertificate(LB_CEF3_HANDLE certificate);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SslStatusIsSecureConnection(LB_CEF3_HANDLE ssl_status);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SslStatusGetCertStatus(LB_CEF3_HANDLE ssl_status);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SslStatusGetSslVersion(LB_CEF3_HANDLE ssl_status);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SslStatusGetContentStatus(LB_CEF3_HANDLE ssl_status);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_SslStatusGetX509Certificate(LB_CEF3_HANDLE ssl_status);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SslInfoGetCertStatus(LB_CEF3_HANDLE ssl_info);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_SslInfoGetX509Certificate(LB_CEF3_HANDLE ssl_info);
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
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetHandler(
    LB_CEF3_HANDLE context, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextHandlerGetInitializedContext(
    LB_CEF3_HANDLE handler, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextAddPreferenceObserver(
    LB_CEF3_HANDLE context, const wchar_t* name, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PreferenceObserverNextEvent(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextAddSettingObserver(
    LB_CEF3_HANDLE context, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SettingObserverNextEvent(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetMediaRouter(
    LB_CEF3_HANDLE context, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterGetGlobal(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterGetSource(
    LB_CEF3_HANDLE router, const wchar_t* urn, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSourceGetId(
    LB_CEF3_HANDLE source, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSourceIsCast(
    LB_CEF3_HANDLE source);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSourceIsDial(
    LB_CEF3_HANDLE source);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterNotifyCurrentRoutes(
    LB_CEF3_HANDLE router);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterNotifyCurrentSinks(
    LB_CEF3_HANDLE router);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterAddObserver(
    LB_CEF3_HANDLE router, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaObserverNextSinks(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaObserverNextRoutes(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaObserverNextRouteState(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaObserverNextRouteMessage(
    LB_CEF3_HANDLE observer, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaCollectionGetCount(
    LB_CEF3_HANDLE collection, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaCollectionGetItem(
    LB_CEF3_HANDLE collection, int64_t index, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouterCreateRoute(
    LB_CEF3_HANDLE router, LB_CEF3_HANDLE source, LB_CEF3_HANDLE sink,
    LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteCreateGetResult(
    LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity,
    size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkGetId(
    LB_CEF3_HANDLE sink, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkGetName(
    LB_CEF3_HANDLE sink, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkGetIconType(
    LB_CEF3_HANDLE sink, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkGetDeviceInfo(
    LB_CEF3_HANDLE sink, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkDeviceInfoGetResult(
    LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity,
    size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkIsCast(
    LB_CEF3_HANDLE sink);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkIsDial(
    LB_CEF3_HANDLE sink);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaSinkIsCompatibleWith(
    LB_CEF3_HANDLE sink, LB_CEF3_HANDLE source);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteGetId(
    LB_CEF3_HANDLE route, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteGetSource(
    LB_CEF3_HANDLE route, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteGetSink(
    LB_CEF3_HANDLE route, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteSendMessage(
    LB_CEF3_HANDLE route, LB_CEF3_BUFFER_HANDLE message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MediaRouteTerminate(
    LB_CEF3_HANDLE route);
/* CefServer owns a dedicated CEF server thread. Creation and handler events
   are surfaced as managed Tasks; HTTP request objects can be taken exactly
   once from the corresponding event Task as a typed REQUEST handle. Response
   bytes remain in a managed BUFFER and custom headers in a managed DICTIONARY
   whose keys and values are UTF-16 strings. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerCreate(
    const wchar_t* address, uint16_t port, int32_t backlog,
    LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextDestroyed(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextClientConnected(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextClientDisconnected(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextHttpRequest(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextWebSocketRequest(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextWebSocketConnected(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerNextWebSocketMessage(
    LB_CEF3_HANDLE server, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerGetTaskRunner(
    LB_CEF3_HANDLE server, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerShutdown(LB_CEF3_HANDLE server);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerIsRunning(LB_CEF3_HANDLE server);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerGetAddress(
    LB_CEF3_HANDLE server, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerHasConnection(LB_CEF3_HANDLE server);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerIsValidConnection(
    LB_CEF3_HANDLE server, int32_t connection_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendHttp200Response(
    LB_CEF3_HANDLE server, int32_t connection_id,
    const wchar_t* content_type, LB_CEF3_BUFFER_HANDLE data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendHttp404Response(
    LB_CEF3_HANDLE server, int32_t connection_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendHttp500Response(
    LB_CEF3_HANDLE server, int32_t connection_id,
    const wchar_t* error_message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendHttpResponse(
    LB_CEF3_HANDLE server, int32_t connection_id, int32_t response_code,
    const wchar_t* content_type, int64_t content_length,
    LB_CEF3_HANDLE extra_headers);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendRawData(
    LB_CEF3_HANDLE server, int32_t connection_id,
    LB_CEF3_BUFFER_HANDLE data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerCloseConnection(
    LB_CEF3_HANDLE server, int32_t connection_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ServerSendWebSocketMessage(
    LB_CEF3_HANDLE server, int32_t connection_id,
    LB_CEF3_BUFFER_HANDLE data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetGlobal(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextCreateShared(
    LB_CEF3_HANDLE other, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextIsSame(
    LB_CEF3_HANDLE context, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextIsSharingWith(
    LB_CEF3_HANDLE context, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextIsGlobal(
    LB_CEF3_HANDLE context);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextRegisterSchemeHandlerFactory(
    LB_CEF3_HANDLE context, const wchar_t* scheme_name,
    const wchar_t* domain_name, LB_CEF3_HANDLE factory);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RegisterSchemeHandlerFactory(
    const wchar_t* scheme_name, const wchar_t* domain_name,
    LB_CEF3_HANDLE factory);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextClearSchemeHandlerFactories(
    LB_CEF3_HANDLE context);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClearSchemeHandlerFactories(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetWebsiteSetting(
    LB_CEF3_HANDLE context, const wchar_t* requesting_url,
    const wchar_t* top_level_url, int32_t content_type, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextSetWebsiteSetting(
    LB_CEF3_HANDLE context, const wchar_t* requesting_url,
    const wchar_t* top_level_url, int32_t content_type, LB_CEF3_HANDLE value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetContentSetting(
    LB_CEF3_HANDLE context, const wchar_t* requesting_url,
    const wchar_t* top_level_url, int32_t content_type, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextSetContentSetting(
    LB_CEF3_HANDLE context, const wchar_t* requesting_url,
    const wchar_t* top_level_url, int32_t content_type, int32_t value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextSetChromeColorScheme(
    LB_CEF3_HANDLE context, int32_t variant, uint32_t user_color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetChromeColorSchemeMode(
    LB_CEF3_HANDLE context, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetChromeColorSchemeColor(
    LB_CEF3_HANDLE context, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextGetChromeColorSchemeVariant(
    LB_CEF3_HANDLE context, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextHasPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextCanSetPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetPreference(LB_CEF3_HANDLE context, const wchar_t* name);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetAllPreferences(LB_CEF3_HANDLE context, int include_defaults);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestContextSetPreference(LB_CEF3_HANDLE context, const wchar_t* name, LB_CEF3_HANDLE value);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpCache(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearCertificateExceptions(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpAuthCredentials(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextCloseAllConnections(LB_CEF3_HANDLE context);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextResolveHost(
    LB_CEF3_HANDLE context, const wchar_t* origin);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResolveCallbackGetResult(
    LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required);
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
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetMimeType(const wchar_t* extension, wchar_t* result, size_t capacity, size_t* required);
// Builds a URL from a managed CEF dictionary containing cef_urlparts_t fields.
// Supported keys: spec, scheme, username, password, host, port, origin, path,
// query and fragment. The result is UTF-16 and uses the standard two-pass
// buffer contract.
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CreateUrl(
    LB_CEF3_HANDLE parts_dictionary, wchar_t* result, size_t capacity, size_t* required);
// Parses a URL into a managed dictionary using the same cef_urlparts_t field
// names accepted by LB_CEF3_CreateUrl.
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ParseUrl(const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResolveUrl(
    const wchar_t* base_url, const wchar_t* relative_url,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_Base64Encode(
    LB_CEF3_BUFFER_HANDLE data, uint64_t data_size,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_Base64Decode(const wchar_t* data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_FormatUrlForSecurityDisplay(
    const wchar_t* origin_url, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UriEncode(
    const wchar_t* text, int use_plus, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UriDecode(
    const wchar_t* text, int convert_to_utf8, int unescape_rule,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ParseJson(const wchar_t* json, int options);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ParseJsonBuffer(
    LB_CEF3_BUFFER_HANDLE json, uint64_t json_size, int options);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ParseJsonAndReturnError(
    const wchar_t* json, int options,
    wchar_t* error_result, size_t error_capacity, size_t* error_required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WriteJson(
    LB_CEF3_HANDLE value, int options,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_AddCrossOriginWhitelistEntry(
    const wchar_t* source_origin, const wchar_t* target_protocol,
    const wchar_t* target_domain, int allow_target_subdomains);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RemoveCrossOriginWhitelistEntry(
    const wchar_t* source_origin, const wchar_t* target_protocol,
    const wchar_t* target_domain, int allow_target_subdomains);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ClearCrossOriginWhitelist(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_TaskManagerGet(void);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_TaskManagerGetTasksCount(LB_CEF3_HANDLE manager);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskManagerGetTaskIdsList(
    LB_CEF3_HANDLE manager, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_TaskManagerGetTaskIdForBrowserId(
    LB_CEF3_HANDLE manager, int browser_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskManagerKillTask(
    LB_CEF3_HANDLE manager, int64_t task_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskManagerGetTaskInfo(
    LB_CEF3_HANDLE manager, int64_t task_id,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_TaskRunnerGetForCurrentThread(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_TaskRunnerGetForThread(int thread_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRunnerBelongsToCurrentThread(LB_CEF3_HANDLE runner);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRunnerBelongsToThread(
    LB_CEF3_HANDLE runner, int thread_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRunnerIsSame(
    LB_CEF3_HANDLE runner, LB_CEF3_HANDLE other_runner);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRunnerPostDelayedTask(
    LB_CEF3_HANDLE runner, LB_CEF3_TASK_HANDLE task, int64_t delay_ms);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TaskRunnerPostTask(
    LB_CEF3_HANDLE runner, LB_CEF3_TASK_HANDLE task);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ThreadCreate(
    const wchar_t* display_name, int priority, int message_loop_type,
    int stoppable, int com_init_mode);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ThreadGetPlatformThreadId(
    LB_CEF3_HANDLE thread_handle);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ThreadGetTaskRunner(
    LB_CEF3_HANDLE thread_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ThreadIsRunning(LB_CEF3_HANDLE thread_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ThreadStop(LB_CEF3_HANDLE thread_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostTask(
    int thread_id, LB_CEF3_TASK_HANDLE task);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDelayedTask(
    int thread_id, LB_CEF3_TASK_HANDLE task, int64_t delay_ms);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ComponentGetId(
    LB_CEF3_HANDLE component, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ComponentGetName(
    LB_CEF3_HANDLE component, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ComponentGetState(LB_CEF3_HANDLE component);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ComponentGetVersion(
    LB_CEF3_HANDLE component, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ComponentUpdaterGetComponentById(
    LB_CEF3_HANDLE updater, const wchar_t* component_id);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_ComponentUpdaterGetComponentCount(
    LB_CEF3_HANDLE updater);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ComponentUpdaterGetComponents(
    LB_CEF3_HANDLE updater, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_ComponentUpdaterUpdate(
    LB_CEF3_HANDLE updater, const wchar_t* component_id, int priority);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_WaitableEventCreate(int automatic_reset, int initially_signaled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WaitableEventReset(LB_CEF3_HANDLE event_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WaitableEventSignal(LB_CEF3_HANDLE event_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WaitableEventIsSignaled(LB_CEF3_HANDLE event_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WaitableEventTimedWait(LB_CEF3_HANDLE event_handle, int64_t max_ms);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WaitableEventWait(LB_CEF3_HANDLE event_handle);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetExitCode(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IsRtl(void);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_NowFromSystemTraceTime(void);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BeginTracing(const wchar_t* categories);
LB_CEF3_API LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_EndTracing(const wchar_t* tracing_file);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IsCertStatusError(int status);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CrashReportingEnabled(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetCrashKeyValue(const wchar_t* key, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IdForCommandIdName(const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IdForPackResourceName(const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_IdForPackStringName(const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleGetGlobal(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleGetLocalizedString(
    LB_CEF3_HANDLE resource_bundle, int32_t string_id,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleGetDataResource(
    LB_CEF3_HANDLE resource_bundle, int32_t resource_id,
    LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceBundleGetDataResourceForScale(
    LB_CEF3_HANDLE resource_bundle, int32_t resource_id, int32_t scale_factor,
    LB_CEF3_BUFFER_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DirectoryExists(const wchar_t* path);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CreateDirectory(const wchar_t* path);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DeleteFile(const wchar_t* path, int recursive);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetTempDirectory(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CreateNewTempDirectory(const wchar_t* prefix, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CreateTempDirectoryInDirectory(const wchar_t* base_dir, const wchar_t* prefix, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipDirectory(const wchar_t* src_dir, const wchar_t* dest_file, int include_hidden_files);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LoadCrlsetsFile(const wchar_t* path);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetPath(int key, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CurrentlyOn(int thread_id);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ComponentUpdaterGet(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_PrintSettingsCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsIsValid(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsIsReadOnly(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetOrientation(
    LB_CEF3_HANDLE settings, int landscape);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsIsLandscape(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetPrinterPrintableArea(
    LB_CEF3_HANDLE settings, LB_CEF3_HANDLE physical_size,
    LB_CEF3_HANDLE printable_area, int landscape_needs_flip);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetDeviceName(
    LB_CEF3_HANDLE settings, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsGetDeviceName(
    LB_CEF3_HANDLE settings, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetDpi(
    LB_CEF3_HANDLE settings, int dpi);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsGetDpi(LB_CEF3_HANDLE settings);
/* Returns a managed List of {from:number,to:number} dictionaries. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_PrintSettingsGetPageRanges(
    LB_CEF3_HANDLE settings);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_PrintSettingsGetPageRangesCount(
    LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetPageRanges(
    LB_CEF3_HANDLE settings, LB_CEF3_HANDLE ranges);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetSelectionOnly(
    LB_CEF3_HANDLE settings, int selection_only);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsIsSelectionOnly(
    LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetCollate(
    LB_CEF3_HANDLE settings, int collate);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsWillCollate(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetColorModel(
    LB_CEF3_HANDLE settings, int model);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsGetColorModel(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetCopies(
    LB_CEF3_HANDLE settings, int copies);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsGetCopies(LB_CEF3_HANDLE settings);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsSetDuplexMode(
    LB_CEF3_HANDLE settings, int mode);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PrintSettingsGetDuplexMode(LB_CEF3_HANDLE settings);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ProcessMessageCreate(const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ProcessMessageIsValid(LB_CEF3_HANDLE message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ProcessMessageIsReadOnly(LB_CEF3_HANDLE message);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ProcessMessageCopy(LB_CEF3_HANDLE message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ProcessMessageGetName(
    LB_CEF3_HANDLE message, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ProcessMessageGetArgumentList(
    LB_CEF3_HANDLE message);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ProcessMessageGetSharedMemoryRegion(
    LB_CEF3_HANDLE message);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ProcessMessageSend(
    LB_CEF3_HANDLE browser, int target_process, LB_CEF3_HANDLE message);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_PostDataCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataIsReadOnly(LB_CEF3_HANDLE post_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataHasExcludedElements(
    LB_CEF3_HANDLE post_data);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_PostDataGetElementCount(
    LB_CEF3_HANDLE post_data);
/* Returns a JSON array of decimal-string managed PostDataElement handles.
   Callers own each returned handle and must release it with HandleRelease. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataGetElementsJson(
    LB_CEF3_HANDLE post_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataAddElement(
    LB_CEF3_HANDLE post_data, LB_CEF3_HANDLE element);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataRemoveElement(
    LB_CEF3_HANDLE post_data, LB_CEF3_HANDLE element);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataRemoveElements(
    LB_CEF3_HANDLE post_data);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_PostDataElementCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementIsReadOnly(LB_CEF3_HANDLE element);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementSetToEmpty(LB_CEF3_HANDLE element);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementSetToFile(
    LB_CEF3_HANDLE element, const wchar_t* file_name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementSetToBytes(
    LB_CEF3_HANDLE element, LB_CEF3_BUFFER_HANDLE buffer,
    uint64_t offset, uint64_t byte_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementGetType(LB_CEF3_HANDLE element);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PostDataElementGetFile(
    LB_CEF3_HANDLE element, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_PostDataElementGetBytesCount(
    LB_CEF3_HANDLE element);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_PostDataElementGetBytes(
    LB_CEF3_HANDLE element, uint64_t maximum_bytes);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestIsReadOnly(LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetUrl(
    LB_CEF3_HANDLE request, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetUrl(
    LB_CEF3_HANDLE request, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetMethod(
    LB_CEF3_HANDLE request, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetMethod(
    LB_CEF3_HANDLE request, const wchar_t* method);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetFirstPartyForCookies(
    LB_CEF3_HANDLE request, wchar_t* result, size_t capacity, size_t* required);
/* Returns a managed List handle of ordered {name:string,value:string} dictionaries. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestGetHeaderMap(
    LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetHeaderByName(
    LB_CEF3_HANDLE request, const wchar_t* name,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSet(
    LB_CEF3_HANDLE request, const wchar_t* url, const wchar_t* method,
    LB_CEF3_HANDLE post_data, LB_CEF3_HANDLE header_map);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetFirstPartyForCookies(
    LB_CEF3_HANDLE request, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetHeaderMap(
    LB_CEF3_HANDLE request, LB_CEF3_HANDLE header_map);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetHeaderByName(
    LB_CEF3_HANDLE request, const wchar_t* name, const wchar_t* value,
    int overwrite);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetReferrer(
    LB_CEF3_HANDLE request, const wchar_t* referrer_url, int policy);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetFlags(LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetFlags(
    LB_CEF3_HANDLE request, int flags);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_RequestGetIdentifier(
    LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetReferrerUrl(
    LB_CEF3_HANDLE request, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetReferrerPolicy(
    LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetResourceType(
    LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestGetTransitionType(
    LB_CEF3_HANDLE request);
/* Returns an independently owned managed PostData handle, or zero on Bridge error. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestGetPostData(
    LB_CEF3_HANDLE request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_RequestSetPostData(
    LB_CEF3_HANDLE request, LB_CEF3_HANDLE post_data);
/* URLRequest clients are managed callback queues. The CEF client object is
   never exposed; all callback data is projected through managed Tasks. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_UrlRequestClientCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestClientNextRequestComplete(
    LB_CEF3_HANDLE client, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestClientNextUploadProgress(
    LB_CEF3_HANDLE client, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestClientNextDownloadProgress(
    LB_CEF3_HANDLE client, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestClientNextDownloadData(
    LB_CEF3_HANDLE client, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestClientNextAuthCredentials(
    LB_CEF3_HANDLE client, LB_CEF3_TASK_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestCreate(
    LB_CEF3_HANDLE request, LB_CEF3_HANDLE client,
    LB_CEF3_HANDLE request_context, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestGetRequest(
    LB_CEF3_HANDLE url_request, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestGetClient(
    LB_CEF3_HANDLE url_request, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestGetRequestStatus(
    LB_CEF3_HANDLE url_request, int32_t* result);
/* CEF error codes are signed and may be negative. The Bridge status is the
   function return value; the original CEF code is written to |result|. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestGetRequestError(
    LB_CEF3_HANDLE url_request, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestGetResponse(
    LB_CEF3_HANDLE url_request, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestResponseWasCached(
    LB_CEF3_HANDLE url_request);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_UrlRequestCancel(
    LB_CEF3_HANDLE url_request);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ResponseCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseIsReadOnly(LB_CEF3_HANDLE response);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetError(LB_CEF3_HANDLE response);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetError(
    LB_CEF3_HANDLE response, int error);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetStatus(LB_CEF3_HANDLE response);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetStatus(
    LB_CEF3_HANDLE response, int status);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetStatusText(
    LB_CEF3_HANDLE response, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetStatusText(
    LB_CEF3_HANDLE response, const wchar_t* status_text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetMimeType(
    LB_CEF3_HANDLE response, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetMimeType(
    LB_CEF3_HANDLE response, const wchar_t* mime_type);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetCharset(
    LB_CEF3_HANDLE response, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetCharset(
    LB_CEF3_HANDLE response, const wchar_t* charset);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetUrl(
    LB_CEF3_HANDLE response, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetUrl(
    LB_CEF3_HANDLE response, const wchar_t* url);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseGetHeaderByName(
    LB_CEF3_HANDLE response, const wchar_t* name,
    wchar_t* result, size_t capacity, size_t* required);
/* Returns a managed List handle of ordered {name:string,value:string} dictionaries. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ResponseGetHeaderMap(
    LB_CEF3_HANDLE response);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetHeaderByName(
    LB_CEF3_HANDLE response, const wchar_t* name, const wchar_t* value,
    int overwrite);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResponseSetHeaderMap(
    LB_CEF3_HANDLE response, LB_CEF3_HANDLE header_map);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_SharedProcessMessageBuilderCreate(const wchar_t* name, uint64_t byte_size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SharedProcessMessageBuilderIsValid(LB_CEF3_HANDLE builder);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SharedProcessMessageBuilderSize(LB_CEF3_HANDLE builder);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_SharedProcessMessageBuilderMemory(
    LB_CEF3_HANDLE builder);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_SharedProcessMessageBuilderBuild(
    LB_CEF3_HANDLE builder);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SharedMemoryRegionIsValid(LB_CEF3_HANDLE region);
LB_CEF3_API int64_t LB_CEF3_CALL LB_CEF3_SharedMemoryRegionSize(LB_CEF3_HANDLE region);
LB_CEF3_API LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_SharedMemoryRegionMemory(
    LB_CEF3_HANDLE region);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_SetNestableTasksAllowed(int allowed);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsSwitches(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsStrings(wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineCreate(void);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineGetGlobal(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineIsValid(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineIsReadOnly(LB_CEF3_HANDLE command_line);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineCopy(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineInitFromArgv(
    LB_CEF3_HANDLE command_line, LB_CEF3_HANDLE arguments);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineInitFromString(LB_CEF3_HANDLE command_line, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineGetString(LB_CEF3_HANDLE command_line, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineGetProgram(LB_CEF3_HANDLE command_line, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineSetProgram(LB_CEF3_HANDLE command_line, const wchar_t* program);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineHasSwitches(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineHasSwitch(LB_CEF3_HANDLE command_line, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineAppendSwitch(LB_CEF3_HANDLE command_line, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineAppendSwitchWithValue(
    LB_CEF3_HANDLE command_line, const wchar_t* name, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineGetSwitchValue(
    LB_CEF3_HANDLE command_line, const wchar_t* name, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineRemoveSwitch(
    LB_CEF3_HANDLE command_line, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineHasArguments(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineAppendArgument(
    LB_CEF3_HANDLE command_line, const wchar_t* argument);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineReset(LB_CEF3_HANDLE command_line);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineGetArgv(LB_CEF3_HANDLE command_line);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineGetArguments(LB_CEF3_HANDLE command_line);
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CommandLineGetSwitches(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLinePrependWrapper(
    LB_CEF3_HANDLE command_line, const wchar_t* wrapper);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_CommandLineRelease(LB_CEF3_HANDLE command_line);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LaunchProcess(LB_CEF3_HANDLE command_line);

/* Safe projections of CEF C++ wrapper capabilities. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MessageRouterCreate(LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ResourceManagerCreate(LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_StreamResourceHandlerCreate(
    const wchar_t* mime_type, LB_CEF3_HANDLE stream_reader, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlObjectCreate(
    const wchar_t* name, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipArchiveCreate(LB_CEF3_HANDLE* result);

/* CEF Views handles own CefRefPtr values internally and never expose native pointers. */
LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_PanelCreate(void);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewAsBrowserView(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewCreate(
    const LB_CEF3_BROWSER_VIEW_CONFIG_V3* config, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewCreateWithDelegate(
    const LB_CEF3_BROWSER_VIEW_CONFIG_V3* config, LB_CEF3_HANDLE delegate,
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateCreate(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSubscribeBrowserCreated(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSubscribeBrowserDestroyed(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSubscribePopupCreated(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSubscribeGestureCommand(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSetRuntimeStyle(
    LB_CEF3_HANDLE delegate, int32_t runtime_style);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSetChromeToolbarType(
    LB_CEF3_HANDLE delegate, int32_t toolbar_type);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSetUseFramelessPictureInPicture(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSetAllowMovePictureInPicture(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewDelegateSetAllowPictureInPictureWithoutUserActivation(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewGetForBrowser(
    LB_CEF3_HANDLE browser, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewGetBrowser(
    LB_CEF3_HANDLE browser_view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewGetChromeToolbar(
    LB_CEF3_HANDLE browser_view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewSetPreferAccelerators(
    LB_CEF3_HANDLE browser_view, int prefer_accelerators);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserViewGetRuntimeStyle(
    LB_CEF3_HANDLE browser_view, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewAsButton(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewAsPanel(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewAsScrollView(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewAsTextfield(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointFromScreen(
    LB_CEF3_HANDLE view, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointFromView(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE other, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointFromWindow(
    LB_CEF3_HANDLE view, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointToScreen(
    LB_CEF3_HANDLE view, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointToView(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE other, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewConvertPointToWindow(
    LB_CEF3_HANDLE view, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetBackgroundColor(
    LB_CEF3_HANDLE view, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetBounds(
    LB_CEF3_HANDLE view, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetBoundsInScreen(
    LB_CEF3_HANDLE view, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetDelegate(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateGetPreferredSize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateGetMinimumSize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateGetMaximumSize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateGetHeightForWidth(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, int32_t width, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnParentViewChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, int added, LB_CEF3_HANDLE parent);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnChildViewChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, int added, LB_CEF3_HANDLE child);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnWindowChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, int added);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnLayoutChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view, const LB_CEF3_RECT_V3* bounds);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnFocus(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnBlur(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewDelegateOnThemeChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetGroupId(
    LB_CEF3_HANDLE view, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetHeightForWidth(
    LB_CEF3_HANDLE view, int32_t width, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetId(
    LB_CEF3_HANDLE view, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetInsets(
    LB_CEF3_HANDLE view, LB_CEF3_INSETS_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetMaximumSize(
    LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetMinimumSize(
    LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetParentView(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetPosition(
    LB_CEF3_HANDLE view, LB_CEF3_POINT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetPreferredSize(
    LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetSize(
    LB_CEF3_HANDLE view, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetThemeColor(
    LB_CEF3_HANDLE view, int32_t color_id, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetTypeString(
    LB_CEF3_HANDLE view, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetViewForId(
    LB_CEF3_HANDLE view, int32_t id, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewGetWindow(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewHasFocus(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewInvalidateLayout(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsAccessibilityFocusable(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsAttached(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsDrawn(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsEnabled(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsFocusable(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsSame(
    LB_CEF3_HANDLE view, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsValid(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewIsVisible(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewRequestFocus(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetBackgroundColor(
    LB_CEF3_HANDLE view, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetBounds(
    LB_CEF3_HANDLE view, const LB_CEF3_RECT_V3* bounds);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetEnabled(
    LB_CEF3_HANDLE view, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetFocusable(
    LB_CEF3_HANDLE view, int focusable);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetGroupId(
    LB_CEF3_HANDLE view, int32_t group_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetId(
    LB_CEF3_HANDLE view, int32_t id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetInsets(
    LB_CEF3_HANDLE view, const LB_CEF3_INSETS_V3* insets);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetPosition(
    LB_CEF3_HANDLE view, const LB_CEF3_POINT_V3* position);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetSize(
    LB_CEF3_HANDLE view, const LB_CEF3_SIZE_V3* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSetVisible(
    LB_CEF3_HANDLE view, int visible);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewSizeToPreferredSize(LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ViewToString(
    LB_CEF3_HANDLE view, int include_children,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonCreate(
    const wchar_t* text, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonDelegateCreate(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonDelegateSubscribePressed(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonDelegateSubscribeStateChanged(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonCreateWithDelegate(
    const wchar_t* text, LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuButtonDelegateCreate(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuButtonDelegateSubscribePressed(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuButtonCreate(
    LB_CEF3_HANDLE delegate, const wchar_t* text, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuButtonShowMenu(
    LB_CEF3_HANDLE button, LB_CEF3_HANDLE menu,
    const LB_CEF3_POINT_V3* screen_point, int32_t anchor_position);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_MenuButtonTriggerMenu(
    LB_CEF3_HANDLE button);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonAsLabelButton(
    LB_CEF3_HANDLE button, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonGetState(
    LB_CEF3_HANDLE button, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonSetAccessibleName(
    LB_CEF3_HANDLE button, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonSetInkDropEnabled(
    LB_CEF3_HANDLE button, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonSetState(
    LB_CEF3_HANDLE button, int32_t state);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ButtonSetTooltipText(
    LB_CEF3_HANDLE button, const wchar_t* tooltip_text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonAsMenuButton(
    LB_CEF3_HANDLE button, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonGetImage(
    LB_CEF3_HANDLE button, int32_t button_state, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonGetText(
    LB_CEF3_HANDLE button, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetEnabledTextColors(
    LB_CEF3_HANDLE button, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetFontList(
    LB_CEF3_HANDLE button, const wchar_t* font_list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetHorizontalAlignment(
    LB_CEF3_HANDLE button, int32_t alignment);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetImage(
    LB_CEF3_HANDLE button, int32_t button_state, LB_CEF3_HANDLE image);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetMaximumSize(
    LB_CEF3_HANDLE button, const LB_CEF3_SIZE_V3* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetMinimumSize(
    LB_CEF3_HANDLE button, const LB_CEF3_SIZE_V3* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetText(
    LB_CEF3_HANDLE button, const wchar_t* text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LabelButtonSetTextColor(
    LB_CEF3_HANDLE button, int32_t button_state, uint32_t color);
/* Window and Overlay handles retain CEF objects internally; platform handles never cross the ABI. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateAcceptsFirstMouse(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateCanClose(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateCanMaximize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateCanMinimize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateCanResize(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetInitialBounds(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetInitialShowState(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetLinuxWindowProperties(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetParentWindow(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result,
    int* is_menu, int* can_activate_menu);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetTitlebarHeight(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window,
    float* titlebar_height, int* overridden);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateGetWindowRuntimeStyle(
    LB_CEF3_HANDLE delegate, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateIsFrameless(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateIsWindowModalDialog(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnAccelerator(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int32_t command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnKeyEvent(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window,
    const LB_CEF3_KEY_EVENT_V3* event);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnThemeColorsChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int chrome_theme);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowActivationChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int active);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowBoundsChanged(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, const LB_CEF3_RECT_V3* bounds);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowClosing(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowCreated(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowDestroyed(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateOnWindowFullscreenTransition(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window, int is_completed);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDelegateWithStandardWindowButtons(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowCreateTopLevel(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowActivate(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowAddOverlayView(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE view, int32_t docking_mode,
    int can_activate, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowBringToTop(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowCancelMenu(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowCenter(
    LB_CEF3_HANDLE window, const LB_CEF3_SIZE_V3* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowClose(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowDeactivate(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetClientAreaBoundsInScreen(
    LB_CEF3_HANDLE window, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetDisplay(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetFocusedView(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetRuntimeStyle(
    LB_CEF3_HANDLE window, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetTitle(
    LB_CEF3_HANDLE window, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetWindowAppIcon(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result);
/* Verifies that a native window exists and returns a managed Window alias, never a raw HWND. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetWindowHandle(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowGetWindowIcon(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowHide(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsActive(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsAlwaysOnTop(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsClosed(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsFullscreen(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsMaximized(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowIsMinimized(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowMaximize(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowMinimize(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowRemoveAccelerator(
    LB_CEF3_HANDLE window, int32_t command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowRemoveAllAccelerators(
    LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowRestore(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSendKeyPress(
    LB_CEF3_HANDLE window, int32_t key_code, uint32_t event_flags);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSendMouseEvents(
    LB_CEF3_HANDLE window, int32_t button, int mouse_down, int mouse_up);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSendMouseMove(
    LB_CEF3_HANDLE window, int32_t screen_x, int32_t screen_y);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetAccelerator(
    LB_CEF3_HANDLE window, int32_t command_id, int32_t key_code,
    int shift_pressed, int ctrl_pressed, int alt_pressed, int high_priority);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetAlwaysOnTop(
    LB_CEF3_HANDLE window, int on_top);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetDraggableRegions(
    LB_CEF3_HANDLE window, const LB_CEF3_DRAGGABLE_REGION_V3* regions,
    size_t region_count);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetFullscreen(
    LB_CEF3_HANDLE window, int fullscreen);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetThemeColor(
    LB_CEF3_HANDLE window, int32_t color_id, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetTitle(
    LB_CEF3_HANDLE window, const wchar_t* title);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetWindowAppIcon(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE image);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowSetWindowIcon(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE image);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowShow(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowShowAsBrowserModalDialog(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE browser_view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowShowMenu(
    LB_CEF3_HANDLE window, LB_CEF3_HANDLE menu,
    const LB_CEF3_POINT_V3* screen_point, int32_t anchor_position);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_WindowThemeChanged(LB_CEF3_HANDLE window);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayDestroy(LB_CEF3_HANDLE overlay);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetBounds(
    LB_CEF3_HANDLE overlay, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetBoundsInScreen(
    LB_CEF3_HANDLE overlay, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetContentsView(
    LB_CEF3_HANDLE overlay, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetDockingMode(
    LB_CEF3_HANDLE overlay, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetInsets(
    LB_CEF3_HANDLE overlay, LB_CEF3_INSETS_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetPosition(
    LB_CEF3_HANDLE overlay, LB_CEF3_POINT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetSize(
    LB_CEF3_HANDLE overlay, LB_CEF3_SIZE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayGetWindow(
    LB_CEF3_HANDLE overlay, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayIsDrawn(LB_CEF3_HANDLE overlay);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayIsSame(
    LB_CEF3_HANDLE overlay, LB_CEF3_HANDLE other);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayIsValid(LB_CEF3_HANDLE overlay);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlayIsVisible(LB_CEF3_HANDLE overlay);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySetBounds(
    LB_CEF3_HANDLE overlay, const LB_CEF3_RECT_V3* bounds);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySetInsets(
    LB_CEF3_HANDLE overlay, const LB_CEF3_INSETS_V3* insets);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySetPosition(
    LB_CEF3_HANDLE overlay, const LB_CEF3_POINT_V3* position);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySetSize(
    LB_CEF3_HANDLE overlay, const LB_CEF3_SIZE_V3* size);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySetVisible(
    LB_CEF3_HANDLE overlay, int visible);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_OverlaySizeToPreferredSize(
    LB_CEF3_HANDLE overlay);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelAddChildView(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE child);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelAddChildViewAt(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE child, int32_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelAsWindow(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelGetChildViewCount(
    LB_CEF3_HANDLE panel, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelGetLayout(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelLayout(LB_CEF3_HANDLE panel);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelRemoveAllChildViews(LB_CEF3_HANDLE panel);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelRemoveChildView(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE child);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelReorderChildView(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE child, int32_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelSetToBoxLayout(
    LB_CEF3_HANDLE panel, const LB_CEF3_BOX_LAYOUT_SETTINGS_V3* settings,
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_PanelSetToFillLayout(
    LB_CEF3_HANDLE panel, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LayoutAsBoxLayout(
    LB_CEF3_HANDLE layout, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LayoutAsFillLayout(
    LB_CEF3_HANDLE layout, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_LayoutIsValid(LB_CEF3_HANDLE layout);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BoxLayoutClearFlexForView(
    LB_CEF3_HANDLE layout, LB_CEF3_HANDLE view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BoxLayoutSetFlexForView(
    LB_CEF3_HANDLE layout, LB_CEF3_HANDLE view, int32_t flex);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewCreate(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewSetContentView(
    LB_CEF3_HANDLE scroll_view, LB_CEF3_HANDLE content_view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewGetContentView(
    LB_CEF3_HANDLE scroll_view, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewGetVisibleContentRect(
    LB_CEF3_HANDLE scroll_view, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewHasHorizontalScrollbar(
    LB_CEF3_HANDLE scroll_view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewGetHorizontalScrollbarHeight(
    LB_CEF3_HANDLE scroll_view, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewHasVerticalScrollbar(
    LB_CEF3_HANDLE scroll_view);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ScrollViewGetVerticalScrollbarWidth(
    LB_CEF3_HANDLE scroll_view, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldCreate(
    LB_CEF3_HANDLE delegate, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldDelegateCreate(
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldDelegateSubscribeKeyEvent(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldDelegateSubscribeAfterUserAction(
    LB_CEF3_HANDLE delegate, int enabled);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetPasswordInput(
    LB_CEF3_HANDLE textfield, int password_input);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldIsPasswordInput(LB_CEF3_HANDLE textfield);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetReadOnly(
    LB_CEF3_HANDLE textfield, int read_only);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldIsReadOnly(LB_CEF3_HANDLE textfield);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetText(
    LB_CEF3_HANDLE textfield, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetText(
    LB_CEF3_HANDLE textfield, const wchar_t* text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldAppendText(
    LB_CEF3_HANDLE textfield, const wchar_t* text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldInsertOrReplaceText(
    LB_CEF3_HANDLE textfield, const wchar_t* text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldHasSelection(LB_CEF3_HANDLE textfield);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetSelectedText(
    LB_CEF3_HANDLE textfield, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSelectAll(
    LB_CEF3_HANDLE textfield, int reversed);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldClearSelection(LB_CEF3_HANDLE textfield);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetSelectedRange(
    LB_CEF3_HANDLE textfield, LB_CEF3_RANGE_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSelectRange(
    LB_CEF3_HANDLE textfield, const LB_CEF3_RANGE_V3* range);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetCursorPosition(
    LB_CEF3_HANDLE textfield, uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetFontList(
    LB_CEF3_HANDLE textfield, const wchar_t* font_list);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldApplyTextColor(
    LB_CEF3_HANDLE textfield, uint32_t color, const LB_CEF3_RANGE_V3* range);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldApplyTextStyle(
    LB_CEF3_HANDLE textfield, int32_t style, int add,
    const LB_CEF3_RANGE_V3* range);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldIsCommandEnabled(
    LB_CEF3_HANDLE textfield, int32_t command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldExecuteCommand(
    LB_CEF3_HANDLE textfield, int32_t command_id);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldClearEditHistory(LB_CEF3_HANDLE textfield);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetPlaceholderText(
    LB_CEF3_HANDLE textfield, const wchar_t* text);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetPlaceholderText(
    LB_CEF3_HANDLE textfield, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetAccessibleName(
    LB_CEF3_HANDLE textfield, const wchar_t* name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetTextColor(
    LB_CEF3_HANDLE textfield, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetTextColor(
    LB_CEF3_HANDLE textfield, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetSelectionTextColor(
    LB_CEF3_HANDLE textfield, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetSelectionTextColor(
    LB_CEF3_HANDLE textfield, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetSelectionBackgroundColor(
    LB_CEF3_HANDLE textfield, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldGetSelectionBackgroundColor(
    LB_CEF3_HANDLE textfield, uint32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_TextfieldSetPlaceholderTextColor(
    LB_CEF3_HANDLE textfield, uint32_t color);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetPrimary(LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetNearestPoint(
    const LB_CEF3_POINT_V3* point, int input_pixel_coords, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetMatchingBounds(
    const LB_CEF3_RECT_V3* bounds, int input_pixel_coords, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetCount(uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetAll(LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayCollectionGetCount(
    LB_CEF3_HANDLE collection, uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayCollectionGetAt(
    LB_CEF3_HANDLE collection, uint64_t index, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertScreenPointToPixels(
    const LB_CEF3_POINT_V3* point, LB_CEF3_POINT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertScreenPointFromPixels(
    const LB_CEF3_POINT_V3* point, LB_CEF3_POINT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertScreenRectToPixels(
    const LB_CEF3_RECT_V3* rect, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertScreenRectFromPixels(
    const LB_CEF3_RECT_V3* rect, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetId(
    LB_CEF3_HANDLE display, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetDeviceScaleFactor(
    LB_CEF3_HANDLE display, double* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertPointToPixels(
    LB_CEF3_HANDLE display, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayConvertPointFromPixels(
    LB_CEF3_HANDLE display, LB_CEF3_POINT_V3* point);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetBounds(
    LB_CEF3_HANDLE display, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetWorkArea(
    LB_CEF3_HANDLE display, LB_CEF3_RECT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DisplayGetRotation(
    LB_CEF3_HANDLE display, int32_t* result);

/* DragData is represented by a bridge-owned typed handle. Text is read with
   the standard two-pass UTF-16 contract; file lists are managed List handles
   and file contents may only be written to a managed StreamWriter handle. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataCreate(LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataClone(
    LB_CEF3_HANDLE drag_data, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataIsReadOnly(LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataIsLink(LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataIsFragment(LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataIsFile(LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetLinkUrl(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetLinkTitle(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetLinkMetadata(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFragmentText(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFragmentHtml(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFragmentBaseUrl(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFileName(
    LB_CEF3_HANDLE drag_data, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFileContents(
    LB_CEF3_HANDLE drag_data, LB_CEF3_HANDLE writer, uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFileNames(
    LB_CEF3_HANDLE drag_data, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetFilePaths(
    LB_CEF3_HANDLE drag_data, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetLinkUrl(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetLinkTitle(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetLinkMetadata(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetFragmentText(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetFragmentHtml(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataSetFragmentBaseUrl(
    LB_CEF3_HANDLE drag_data, const wchar_t* value);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataResetFileContents(
    LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataAddFile(
    LB_CEF3_HANDLE drag_data, const wchar_t* path, const wchar_t* display_name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataClearFilenames(
    LB_CEF3_HANDLE drag_data);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetImage(
    LB_CEF3_HANDLE drag_data, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataGetImageHotspot(
    LB_CEF3_HANDLE drag_data, LB_CEF3_POINT_V3* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_DragDataHasImage(LB_CEF3_HANDLE drag_data);

/* XmlReader handles are owned by their creation thread. Every operation,
   including final HandleRelease, must run on that thread. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderCreate(
    LB_CEF3_HANDLE stream, int32_t encoding_type, const wchar_t* uri,
    LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToNextNode(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderClose(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderHasError(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetError(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetType(
    LB_CEF3_HANDLE reader, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetDepth(
    LB_CEF3_HANDLE reader, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetLocalName(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetPrefix(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetQualifiedName(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetNamespaceUri(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetBaseUri(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetXmlLang(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderIsEmptyElement(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderHasValue(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetValue(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderHasAttributes(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetAttributeCount(
    LB_CEF3_HANDLE reader, uint64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetAttributeByIndex(
    LB_CEF3_HANDLE reader, int32_t index, wchar_t* result, size_t capacity,
    size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetAttributeByQualifiedName(
    LB_CEF3_HANDLE reader, const wchar_t* qualified_name, wchar_t* result,
    size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetAttributeByLocalName(
    LB_CEF3_HANDLE reader, const wchar_t* local_name, const wchar_t* namespace_uri,
    wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetInnerXml(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetOuterXml(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderGetLineNumber(
    LB_CEF3_HANDLE reader, int32_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToAttributeByIndex(
    LB_CEF3_HANDLE reader, int32_t index);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToAttributeByQualifiedName(
    LB_CEF3_HANDLE reader, const wchar_t* qualified_name);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToAttributeByLocalName(
    LB_CEF3_HANDLE reader, const wchar_t* local_name, const wchar_t* namespace_uri);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToFirstAttribute(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToNextAttribute(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_XmlReaderMoveToCarryingElement(
    LB_CEF3_HANDLE reader);

/* ZipReader handles are owned by their creation thread. ReadFile returns a
   managed buffer and preserves the raw signed CEF read result separately. */
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderCreate(
    LB_CEF3_HANDLE stream, LB_CEF3_HANDLE* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderMoveToFirstFile(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderMoveToNextFile(
    LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderMoveToFile(
    LB_CEF3_HANDLE reader, const wchar_t* file_name, int case_sensitive);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderClose(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderGetFileName(
    LB_CEF3_HANDLE reader, wchar_t* result, size_t capacity, size_t* required);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderGetFileSize(
    LB_CEF3_HANDLE reader, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderGetFileLastModified(
    LB_CEF3_HANDLE reader, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderOpenFile(
    LB_CEF3_HANDLE reader, const wchar_t* password);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderCloseFile(LB_CEF3_HANDLE reader);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderReadFile(
    LB_CEF3_HANDLE reader, uint64_t maximum_bytes,
    LB_CEF3_BUFFER_HANDLE* result, int32_t* read_result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderTell(
    LB_CEF3_HANDLE reader, int64_t* result);
LB_CEF3_API int LB_CEF3_CALL LB_CEF3_ZipReaderEof(LB_CEF3_HANDLE reader);

LB_CEF3_API void LB_CEF3_CALL LB_CEF3_ShutdownRegistry(void);
