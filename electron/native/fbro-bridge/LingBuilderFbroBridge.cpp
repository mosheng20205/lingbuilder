#include "LingBuilderFbroBridge.h"

#include "pch.h"
#include "FBroBaseType.h"
#include "FBroBrowser.h"
#include "FBroBrowserHost.h"
#include "FBroCallback.h"
#include "FBroControl.h"
#include "FBroCookieManager.h"
#include "FBroDragData.h"
#include "FBroFrame.h"
#include "FBroHsBaseEvent.h"
#include "FBroHsEvent.h"
#include "FBroInit.h"
#include "FBroDictionaryValue.h"
#include "FBroDownloadItem.h"
#include "FBroListValue.h"
#include "FBroImage.h"
#include "FBroMenuModel.h"
#include "FBroMiddleData.h"
#include "FBroRequest.h"
#include "FBroRequestContext.h"
#include "FBroStream.h"
#include "FBroSSLInfo.h"
#include "FBroString.h"
#include "FBroValue.h"
#include "FBroX509Certificate.h"
#include "FBroX509CertPrincipal.h"
#include "FBroVIPStruct.h"
#include "FBroVIPControl.h"
#include "FBroVIPEvent.h"
#include "FBroVIPEventInterface.h"
#include "FBroVIPInterface.h"
#include "FBroVIPUserAgentData.h"
#include "include/cef_parser.h"
#include "include/cef_navigation_entry.h"
#include "include/cef_ssl_status.h"
#include "include/cef_task.h"

#include <shobjidl.h>

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <chrono>
#include <climits>
#include <cstring>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iomanip>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace {

struct BrowserState;
class BridgeBrowserEvent;
BrowserState* Find(LB_FBRO_HANDLE handle);
void NotifyVipBrowser(CefRefPtr<CefBrowser> browser, int code, const std::wstring& data);

struct VipResourcePayload {
  std::vector<unsigned char> bytes;
  CefRefPtr<FBroDoubleString> headers;
};

std::recursive_mutex g_mutex;
std::condition_variable_any g_continuation_timer_condition;
std::unordered_map<LB_FBRO_HANDLE, std::unique_ptr<BrowserState>> g_browsers;
std::atomic<LB_FBRO_HANDLE> g_next_handle{1};
std::atomic<uint64_t> g_next_object_handle{0x100000000ULL};
std::atomic<uint64_t> g_event_sequence{1};
std::atomic<bool> g_initialized{false};
std::atomic<bool> g_ready{false};
std::atomic<bool> g_shutdown_started{false};
bool g_continuation_timer_stop = false;
std::thread g_continuation_timer_thread;
std::atomic<bool> g_license_attempted{false};
std::atomic<bool> g_license_valid{false};
bool g_winsock_started = false;
CefRefPtr<FBroHsInitEvent> g_init_event;
CefRefPtr<FBroVIPEvent> g_vip_event;
std::filesystem::path g_runtime_directory;
std::filesystem::path g_root_cache_directory;
std::wstring g_license_error;
std::wstring g_vip_proxy_url;
std::wstring g_vip_proxy_user;
std::wstring g_vip_proxy_password;
std::unordered_map<std::wstring, std::shared_ptr<VipResourcePayload>> g_global_vip_resource_payloads;

struct TaskState {
  LB_FBRO_TASK_HANDLE handle = 0;
  std::atomic<int> status{LB_FBRO_TASK_PENDING};
  std::wstring result;
  std::wstring error;
  LB_FBRO_OBJECT_HANDLE object = 0;
  LB_FBRO_BUFFER_HANDLE buffer = 0;
  LB_FBRO_TASK_CALLBACK callback = nullptr;
  void* user_data = nullptr;
};

struct BufferState {
  LB_FBRO_BUFFER_HANDLE handle = 0;
  std::vector<unsigned char> bytes;
};

struct ObjectState {
  LB_FBRO_OBJECT_HANDLE handle = 0;
  int type = LB_FBRO_OBJECT_UNKNOWN;
  DWORD owner_thread = 0;
  LB_FBRO_OBJECT_HANDLE parent = 0;
  CefRefPtr<CefValue> value;
  CefRefPtr<CefDictionaryValue> dictionary;
  CefRefPtr<CefListValue> list;
  CefRefPtr<CefStreamReader> stream;
  CefRefPtr<CefImage> image;
  CefRefPtr<CefX509Certificate> certificate;
  CefRefPtr<CefX509CertPrincipal> principal;
  CefRefPtr<CefDragData> drag_data;
  CefRefPtr<CefFrame> frame;
  std::vector<unsigned char> owned_bytes;
};

struct ContinuationState {
  LB_FBRO_CONTINUATION_HANDLE handle = 0;
  LB_FBRO_HANDLE browser = 0;
  std::wstring event_id;
  std::atomic<bool> completed{false};
  std::chrono::steady_clock::time_point deadline;
  int timeout_action = LB_FBRO_EVENT_ACTION_CANCEL;
  std::function<void(int, const std::wstring&)> completion;
};

std::unordered_map<LB_FBRO_TASK_HANDLE, std::shared_ptr<TaskState>> g_tasks;
std::unordered_map<LB_FBRO_BUFFER_HANDLE, std::shared_ptr<BufferState>> g_buffers;
std::unordered_map<LB_FBRO_OBJECT_HANDLE, std::shared_ptr<ObjectState>> g_objects;
std::unordered_map<LB_FBRO_CONTINUATION_HANDLE, std::shared_ptr<ContinuationState>> g_continuations;

struct BrowserState {
  LB_FBRO_HANDLE handle = 0;
  HWND host = nullptr;
  std::wstring url;
  std::wstring profile;
  std::wstring title;
  std::wstring user_agent;
  std::wstring last_event;
  std::wstring last_event_json;
  std::wstring last_fingerprint_json;
  LB_FBRO_OBJECT_HANDLE last_event_object = 0;
  std::wstring last_error;
  LB_FBRO_EVENT_CALLBACK callback = nullptr;
  void* user_data = nullptr;
  LB_FBRO_EVENT_CALLBACK_V2 callback_v2 = nullptr;
  void* user_data_v2 = nullptr;
  LB_FBRO_EVENT_CALLBACK_V3 callback_v3 = nullptr;
  void* user_data_v3 = nullptr;
  std::unordered_map<std::wstring, bool> event_subscriptions;
  std::unordered_map<std::wstring, uint32_t> event_sampling_rates;
  std::unordered_map<std::wstring, uint64_t> event_last_delivery;
  CefRefPtr<CefBrowser> browser;
  CefRefPtr<CefRequestContext> request_context;
  CefRefPtr<BridgeBrowserEvent> event;
  CefRefPtr<FBroHsDevToolsMessageObserver> devtools_observer;
  std::unordered_map<std::wstring, std::shared_ptr<VipResourcePayload>> vip_resource_payloads;
  bool create_started = false;
  bool chrome_ui = false;
  unsigned int flags = 7;
};

std::string ToAnsi(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_ACP, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
  std::string result(static_cast<size_t>(std::max(1, size)), '\0');
  WideCharToMultiByte(CP_ACP, 0, value.c_str(), -1, result.data(), size, nullptr, nullptr);
  if (!result.empty() && result.back() == '\0') result.pop_back();
  return result;
}

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
  if (size <= 1) return {};
  std::string result(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, result.data(), size, nullptr, nullptr);
  result.pop_back();
  return result;
}

std::wstring FromUtf8(const char* value) {
  if (!value || !*value) return {};
  int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value, -1, nullptr, 0);
  UINT code_page = CP_UTF8;
  DWORD flags = MB_ERR_INVALID_CHARS;
  if (size <= 0) {
    code_page = CP_ACP;
    flags = 0;
    size = MultiByteToWideChar(code_page, flags, value, -1, nullptr, 0);
  }
  if (size <= 1) return {};
  std::wstring result(static_cast<size_t>(size), L'\0');
  MultiByteToWideChar(code_page, flags, value, -1, result.data(), size);
  result.pop_back();
  return result;
}

std::wstring FromUtf8Bytes(const void* data, size_t size) {
  if (!data || size == 0 || size > static_cast<size_t>(INT_MAX)) return {};
  const char* bytes = static_cast<const char*>(data);
  int required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes,
                                     static_cast<int>(size), nullptr, 0);
  UINT code_page = CP_UTF8;
  DWORD flags = MB_ERR_INVALID_CHARS;
  if (required <= 0) {
    code_page = CP_ACP;
    flags = 0;
    required = MultiByteToWideChar(code_page, flags, bytes, static_cast<int>(size), nullptr, 0);
  }
  if (required <= 0) return {};
  std::wstring result(static_cast<size_t>(required), L'\0');
  MultiByteToWideChar(code_page, flags, bytes, static_cast<int>(size), result.data(), required);
  return result;
}

int CopyResult(const std::wstring& value, wchar_t* result, size_t capacity) {
  if (!result || capacity == 0) return -2;
  const size_t count = std::min(value.size(), capacity - 1);
  std::copy_n(value.c_str(), count, result);
  result[count] = L'\0';
  return count == value.size() ? 1 : -3;
}

std::wstring FromFbroString(CefRefPtr<FBroString> value) {
  if (!value) return {};
  const int size = FBroString_WSize(value);
  if (size <= 0) return {};
  std::vector<wchar_t> buffer(static_cast<size_t>(size) + 1, L'\0');
  FBroString_GetWcharData(value, buffer.data());
  return buffer.data();
}

int BoolStatus(BOOL value) { return value ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED; }

LB_FBRO_OBJECT_HANDLE RegisterObject(int type, CefRefPtr<CefValue> value,
                                     CefRefPtr<CefDictionaryValue> dictionary,
                                     CefRefPtr<CefListValue> list,
                                     LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!value && !dictionary && !list) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = type;
  state->owner_thread = GetCurrentThreadId();
  state->parent = parent;
  state->value = std::move(value);
  state->dictionary = std::move(dictionary);
  state->list = std::move(list);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterStream(CefRefPtr<CefStreamReader> stream,
                                     std::vector<unsigned char> owned_bytes = {}) {
  if (!stream) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_STREAM;
  state->owner_thread = GetCurrentThreadId();
  state->stream = std::move(stream);
  state->owned_bytes = std::move(owned_bytes);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterImage(CefRefPtr<CefImage> image, LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!image) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_IMAGE;
  state->owner_thread = 0;
  state->parent = parent;
  state->image = std::move(image);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterCertificate(CefRefPtr<CefX509Certificate> certificate,
                                          LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!certificate) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_CERTIFICATE;
  state->owner_thread = 0;
  state->parent = parent;
  state->certificate = std::move(certificate);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterPrincipal(CefRefPtr<CefX509CertPrincipal> principal,
                                        LB_FBRO_OBJECT_HANDLE parent) {
  if (!principal) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_CERT_PRINCIPAL;
  state->owner_thread = 0;
  state->parent = parent;
  state->principal = std::move(principal);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterDragData(CefRefPtr<CefDragData> drag_data) {
  if (!drag_data) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_DRAG_DATA;
  state->owner_thread = 0;
  state->drag_data = std::move(drag_data);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterFrame(CefRefPtr<CefFrame> frame,
                                    LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!frame) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_FRAME;
  // CefFrame is reference counted and its public browser/frame methods are safe
  // to invoke from the LingBuilder runtime thread. Do not bind the managed
  // handle to the transient CEF callback thread that produced it.
  state->owner_thread = 0;
  state->parent = parent;
  state->frame = std::move(frame);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_BUFFER_HANDLE RegisterBuffer(std::vector<unsigned char> bytes) {
  auto buffer = std::make_shared<BufferState>();
  buffer->handle = g_next_object_handle.fetch_add(1);
  buffer->bytes = std::move(bytes);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_buffers.emplace(buffer->handle, buffer);
  return buffer->handle;
}

std::shared_ptr<BufferState> GetBuffer(LB_FBRO_BUFFER_HANDLE handle, int& status) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_buffers.find(handle);
  if (found == g_buffers.end()) {
    status = LB_FBRO_ERROR_RELEASED_HANDLE;
    return {};
  }
  status = LB_FBRO_OK;
  return found->second;
}

LB_FBRO_BUFFER_HANDLE RegisterBinaryBuffer(CefRefPtr<CefBinaryValue> binary) {
  if (!binary) return 0;
  const int size = FBroHsBinaryValue_GetSize(binary);
  if (size < 0) return 0;
  std::vector<unsigned char> bytes(static_cast<size_t>(size));
  if (!bytes.empty()) FBroHsBinaryValue_GetData(binary, bytes.data(), bytes.size(), 0);
  return RegisterBuffer(std::move(bytes));
}

CefRefPtr<CefBinaryValue> CreateBinaryFromBuffer(LB_FBRO_BUFFER_HANDLE handle, int& status) {
  auto buffer = GetBuffer(handle, status);
  if (!buffer) return {};
  const void* data = buffer->bytes.empty() ? nullptr : buffer->bytes.data();
  auto binary = FBroHsBinaryValue_Create(data, buffer->bytes.size());
  if (!binary) status = LB_FBRO_ERROR_OPERATION_FAILED;
  return binary;
}

void AdoptObject(const std::shared_ptr<ObjectState>& child, LB_FBRO_OBJECT_HANDLE parent) {
  if (!child) return;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  child->parent = parent;
}

void EraseObjectTree(LB_FBRO_OBJECT_HANDLE parent) {
  std::vector<LB_FBRO_OBJECT_HANDLE> children;
  for (const auto& [handle, state] : g_objects) {
    if (state->parent == parent) children.push_back(handle);
  }
  for (LB_FBRO_OBJECT_HANDLE child : children) EraseObjectTree(child);
  g_objects.erase(parent);
}

std::shared_ptr<ObjectState> GetObject(LB_FBRO_OBJECT_HANDLE handle, int expected_type, int& status) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_objects.find(handle);
  if (found == g_objects.end()) {
    status = LB_FBRO_ERROR_RELEASED_HANDLE;
    return {};
  }
  if (found->second->type != expected_type) {
    status = LB_FBRO_ERROR_HANDLE_TYPE;
    return {};
  }
  if (found->second->owner_thread != 0 && found->second->owner_thread != GetCurrentThreadId()) {
    status = LB_FBRO_ERROR_WRONG_THREAD;
    return {};
  }
  status = LB_FBRO_OK;
  return found->second;
}

const wchar_t* EventName(int code) {
  switch (code) {
    case LB_FBRO_EVENT_CREATED: return L"Created";
    case LB_FBRO_EVENT_LOAD_END: return L"LoadEnd";
    case LB_FBRO_EVENT_ADDRESS_CHANGED: return L"AddressChanged";
    case LB_FBRO_EVENT_TITLE_CHANGED: return L"TitleChanged";
    case LB_FBRO_EVENT_CLOSED: return L"Closed";
    case LB_FBRO_EVENT_ERROR: return L"Error";
    case LB_FBRO_EVENT_BEFORE_POPUP: return L"BeforePopup";
    case LB_FBRO_EVENT_CERTIFICATE_ERROR: return L"CertificateError";
    case LB_FBRO_EVENT_DRAG_ENTER: return L"DragEnter";
    case LB_FBRO_EVENT_VIP_DEVTOOLS_MESSAGE: return L"VipDevToolsMessage";
    case LB_FBRO_EVENT_VIP_DEVTOOLS_RESULT: return L"VipDevToolsResult";
    case LB_FBRO_EVENT_VIP_DEVTOOLS_EVENT: return L"VipDevToolsEvent";
    case LB_FBRO_EVENT_VIP_DEVTOOLS_ATTACHED: return L"VipDevToolsAttached";
    case LB_FBRO_EVENT_VIP_DEVTOOLS_DETACHED: return L"VipDevToolsDetached";
    case LB_FBRO_EVENT_VIP_LIFECYCLE: return L"VipLifecycle";
    default: return L"Unknown";
  }
}

const wchar_t* StableEventId(int code) {
  switch (code) {
#define LB_FBRO_LEGACY_EVENT_ID_CASES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_LEGACY_EVENT_ID_CASES
    default: return nullptr;
  }
}

const wchar_t* StableEventId(const wchar_t* official_name) {
  if (!official_name) return nullptr;
#define LB_FBRO_OFFICIAL_EVENT_ID_CASES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_OFFICIAL_EVENT_ID_CASES
  return nullptr;
}

const wchar_t* ChineseEventName(const wchar_t* official_name) {
  if (!official_name) return L"未知事件";
#define LB_FBRO_OFFICIAL_EVENT_CHINESE_CASES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_OFFICIAL_EVENT_CHINESE_CASES
  return official_name;
}

const wchar_t* OfficialEventName(int code) {
  switch (code) {
    case LB_FBRO_EVENT_CREATED: return L"OnAfterCreated";
    case LB_FBRO_EVENT_LOAD_END: return L"OnLoadEnd";
    case LB_FBRO_EVENT_ADDRESS_CHANGED: return L"OnAddressChange";
    case LB_FBRO_EVENT_TITLE_CHANGED: return L"OnTitleChange";
    case LB_FBRO_EVENT_CLOSED: return L"OnBeforeClose";
    case LB_FBRO_EVENT_ERROR: return L"OnLoadError";
    case LB_FBRO_EVENT_BEFORE_POPUP: return L"OnBeforePopup";
    case LB_FBRO_EVENT_CERTIFICATE_ERROR: return L"OnCertificateError";
    case LB_FBRO_EVENT_DRAG_ENTER: return L"OnDragEnter";
    default: return EventName(code);
  }
}

const wchar_t* ChineseEventName(int code) {
  switch (code) {
    case LB_FBRO_EVENT_CREATED: return L"浏览器创建完成";
    case LB_FBRO_EVENT_LOAD_END: return L"加载完成";
    case LB_FBRO_EVENT_ADDRESS_CHANGED: return L"地址被改变";
    case LB_FBRO_EVENT_TITLE_CHANGED: return L"标题被改变";
    case LB_FBRO_EVENT_CLOSED: return L"浏览器即将关闭";
    case LB_FBRO_EVENT_ERROR: return L"加载失败";
    case LB_FBRO_EVENT_BEFORE_POPUP: return L"新窗口打开前";
    case LB_FBRO_EVENT_CERTIFICATE_ERROR: return L"证书错误";
    case LB_FBRO_EVENT_DRAG_ENTER: return L"拖入浏览器";
    default: return EventName(code);
  }
}

std::wstring JsonEscape(const std::wstring& value) {
  std::wstring result;
  result.reserve(value.size() + 16);
  for (wchar_t character : value) {
    switch (character) {
      case L'\\': result += L"\\\\"; break;
      case L'"': result += L"\\\""; break;
      case L'\r': result += L"\\r"; break;
      case L'\n': result += L"\\n"; break;
      case L'\t': result += L"\\t"; break;
      default:
        if (character < 0x20) {
          wchar_t escaped[7]{};
          swprintf_s(escaped, L"\\u%04X", static_cast<unsigned int>(character));
          result += escaped;
        } else result += character;
    }
  }
  return result;
}

std::wstring StringListJson(CefRefPtr<FBroCefStringList> values) {
  std::wstring json = L"[";
  const int count = values ? FBroCefStringList_Size(values) : 0;
  for (int index = 0; index < count; ++index) {
    if (index > 0) json += L",";
    json += L"\"" + JsonEscape(FromFbroString(FBroCefStringList_GetValue(values, index))) + L"\"";
  }
  json += L"]";
  return json;
}

std::wstring BuildEventJson(const BrowserState& state, int code, const std::wstring& data) {
  const wchar_t* field = code == LB_FBRO_EVENT_LOAD_END ? L"statusCode"
      : code == LB_FBRO_EVENT_ADDRESS_CHANGED || code == LB_FBRO_EVENT_BEFORE_POPUP ? L"url"
      : code == LB_FBRO_EVENT_TITLE_CHANGED ? L"title"
      : code == LB_FBRO_EVENT_ERROR ? L"message" : L"data";
  const bool numeric = code == LB_FBRO_EVENT_LOAD_END && !data.empty()
      && std::all_of(data.begin(), data.end(), [](wchar_t value) { return value == L'-' || iswdigit(value); });
  std::wstring json = L"{\"event\":\"" + std::wstring(EventName(code)) + L"\",\"data\":\"" + JsonEscape(data)
      + L"\",\"fields\":{\"" + field + L"\":";
  json += numeric ? data : L"\"" + JsonEscape(data) + L"\"";
  json += L"},\"instanceKind\":\"";
  json += state.chrome_ui ? L"chromeUi" : L"embedded";
  json += L"\",\"browserHandle\":\"" + std::to_wstring(state.handle)
      + L"\",\"objectHandle\":\"" + std::to_wstring(state.last_event_object) + L"\"}";
  return json;
}

uint64_t StableEventToken(const std::wstring& event_id) {
  uint64_t hash = 1469598103934665603ULL;
  for (const wchar_t character : event_id) {
    hash ^= static_cast<uint64_t>(static_cast<uint32_t>(character));
    hash *= 1099511628211ULL;
  }
  return hash;
}

uint64_t NowMilliseconds() {
  return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::system_clock::now().time_since_epoch()).count());
}

std::wstring BuildSafeFieldsJson(
    std::initializer_list<std::pair<const wchar_t*, std::wstring>> fields) {
  std::wstring json = L"{";
  bool first = true;
  for (const auto& field : fields) {
    if (!first) json += L",";
    first = false;
    json += L"\"" + JsonEscape(field.first ? field.first : L"value") + L"\":\""
        + JsonEscape(field.second) + L"\"";
  }
  json += L"}";
  return json;
}

bool ShouldDeliverEvent(BrowserState& state, const std::wstring& event_id,
                        const std::wstring& official_name, const std::wstring& event_name,
                        uint32_t flags, uint32_t default_max_hz) {
  bool explicitly_enabled = false;
  for (const auto& alias : {event_id, official_name, event_name}) {
    const auto subscription = state.event_subscriptions.find(alias);
    if (subscription != state.event_subscriptions.end() && !subscription->second) return false;
    if (subscription != state.event_subscriptions.end() && subscription->second) explicitly_enabled = true;
  }
  if ((flags & LB_FBRO_EVENT_FLAG_HIGH_FREQUENCY) == 0) return true;
  if (!explicitly_enabled) return false;
  uint32_t max_hz = default_max_hz;
  for (const auto& alias : {event_id, official_name, event_name}) {
    if (const auto found = state.event_sampling_rates.find(alias);
        found != state.event_sampling_rates.end()) { max_hz = found->second; break; }
  }
  if (max_hz == 0) return false;
  const uint64_t now = NowMilliseconds();
  const uint64_t interval = std::max<uint64_t>(1, 1000ULL / std::min<uint32_t>(max_hz, 1000));
  uint64_t& last = state.event_last_delivery[event_id];
  if (last != 0 && now - last < interval) return false;
  last = now;
  return true;
}

int DispatchEventV3(BrowserState& state, const std::wstring& event_id,
                    const std::wstring& official_name, const std::wstring& event_name,
                    const std::wstring& fields_json, int legacy_code, uint32_t flags,
                    uint32_t default_max_hz, LB_FBRO_OBJECT_HANDLE object,
                    LB_FBRO_CONTINUATION_HANDLE continuation,
                    std::wstring* response_json = nullptr) {
  if (!ShouldDeliverEvent(state, event_id, official_name, event_name, flags, default_max_hz)) return LB_FBRO_EVENT_ACTION_DEFAULT;
  state.last_event = event_name;
  state.last_event_object = object;
  state.last_event_json = L"{\"eventId\":\"" + JsonEscape(event_id)
      + L"\",\"event\":\"" + JsonEscape(event_name)
      + L"\",\"officialName\":\"" + JsonEscape(official_name)
      + L"\",\"fields\":" + (fields_json.empty() ? std::wstring(L"{}") : fields_json)
      + L",\"instanceKind\":\"" + (state.chrome_ui ? std::wstring(L"chromeUi") : std::wstring(L"embedded"))
      + L"\",\"browserHandle\":\"" + std::to_wstring(state.handle)
      + L"\",\"objectHandle\":\"" + std::to_wstring(object)
      + L"\",\"continuationHandle\":\"" + std::to_wstring(continuation) + L"\"}";

  if (state.callback_v3) {
    LB_FBRO_EVENT_PACKET_V3 packet{};
    packet.struct_size = sizeof(packet);
    packet.abi_version = LB_FBRO_ABI_VERSION_V3;
    packet.sequence = g_event_sequence.fetch_add(1);
    packet.timestamp_milliseconds = NowMilliseconds();
    packet.browser = state.handle;
    packet.event_token = StableEventToken(event_id);
    packet.legacy_event_code = legacy_code;
    packet.instance_kind = state.chrome_ui ? LB_FBRO_INSTANCE_CHROME_UI : LB_FBRO_INSTANCE_EMBEDDED;
    packet.flags = flags;
    packet.event_id = event_id.c_str();
    packet.event_name = event_name.c_str();
    packet.official_name = official_name.c_str();
    packet.fields_json = fields_json.c_str();
    packet.object = object;
    packet.continuation = continuation;
    LB_FBRO_EVENT_RESPONSE_V3 response{};
    response.struct_size = sizeof(response);
    response.abi_version = LB_FBRO_ABI_VERSION_V3;
    state.callback_v3(&packet, &response, state.user_data_v3);
    if (response_json && response.response_json) *response_json = response.response_json;
    return response.action;
  }

  if (state.callback_v2) {
    wchar_t callback_result[4096]{};
    LB_FBRO_EVENT_PACKET_V2 packet{};
    packet.struct_size = sizeof(packet);
    packet.abi_version = LB_FBRO_ABI_VERSION_V2;
    packet.sequence = g_event_sequence.fetch_add(1);
    packet.timestamp_milliseconds = NowMilliseconds();
    packet.browser = state.handle;
    packet.event_code = legacy_code;
    packet.instance_kind = state.chrome_ui ? LB_FBRO_INSTANCE_CHROME_UI : LB_FBRO_INSTANCE_EMBEDDED;
    packet.flags = flags;
    packet.event_name = official_name.c_str();
    packet.data_json = state.last_event_json.c_str();
    packet.object = object;
    const int action = state.callback_v2(&packet, callback_result, std::size(callback_result), state.user_data_v2);
    if (response_json) *response_json = callback_result;
    return action;
  }
  if (state.callback && legacy_code > 0) {
    state.callback(state.handle, legacy_code, fields_json.c_str(), state.user_data);
  }
  return LB_FBRO_EVENT_ACTION_DEFAULT;
}

int ParseContinuationAction(const std::wstring& response_json, int fallback) {
  if (response_json.empty()) return fallback;
  const auto parsed = CefParseJSON(response_json, JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_DICTIONARY) return fallback;
  const auto dictionary = parsed->GetDictionary();
  if (!dictionary || dictionary->GetType("action") != VTYPE_INT) return fallback;
  return dictionary->GetInt("action");
}

CefRefPtr<CefDictionaryValue> ParseEventResponse(const std::wstring& response_json) {
  if (response_json.empty()) return nullptr;
  const auto parsed = CefParseJSON(CefString(response_json), JSON_PARSER_ALLOW_TRAILING_COMMAS);
  return parsed && parsed->GetType() == VTYPE_DICTIONARY ? parsed->GetDictionary() : nullptr;
}

std::wstring EventResponseString(CefRefPtr<CefDictionaryValue> response, const char* key) {
  return response && response->GetType(key) == VTYPE_STRING
      ? response->GetString(key).ToWString() : std::wstring();
}

int EventResponseInt(CefRefPtr<CefDictionaryValue> response, const char* key, int fallback = 0) {
  if (!response || !response->HasKey(key)) return fallback;
  if (response->GetType(key) == VTYPE_INT) return response->GetInt(key);
  if (response->GetType(key) == VTYPE_BOOL) return response->GetBool(key) ? 1 : 0;
  return fallback;
}

bool EventResponseBool(CefRefPtr<CefDictionaryValue> response, const char* key, bool fallback = false) {
  return EventResponseInt(response, key, fallback ? 1 : 0) != 0;
}

CefRefPtr<FBroCefStringList> EventResponseStringList(
    CefRefPtr<CefDictionaryValue> response, const char* key) {
  if (!response || response->GetType(key) != VTYPE_LIST) return nullptr;
  const auto values = response->GetList(key);
  auto result = FBroCefStringList_Creat();
  if (!result) return nullptr;
  for (size_t index = 0; index < values->GetSize(); ++index) {
    if (values->GetType(index) == VTYPE_STRING) FBroCefStringList_Add(result, values->GetString(index));
  }
  return result;
}

class BridgeContinuationCompletionTask final : public CefTask {
 public:
  BridgeContinuationCompletionTask(std::shared_ptr<ContinuationState> continuation,
                                   int action, std::wstring response_json)
      : continuation_(std::move(continuation)), action_(action),
        response_json_(std::move(response_json)) {}
  void Execute() override {
    if (continuation_ && continuation_->completion) {
      continuation_->completion(action_, response_json_);
    }
  }
 private:
  std::shared_ptr<ContinuationState> continuation_;
  int action_;
  std::wstring response_json_;
  IMPLEMENT_REFCOUNTING(BridgeContinuationCompletionTask);
};

int CompleteContinuationInternal(LB_FBRO_CONTINUATION_HANDLE handle, int action,
                                 const std::wstring& response_json);

void ContinuationTimerLoop() {
  std::unique_lock<std::recursive_mutex> lock(g_mutex);
  while (!g_continuation_timer_stop) {
    if (g_continuations.empty()) {
      g_continuation_timer_condition.wait(lock, [] {
        return g_continuation_timer_stop || !g_continuations.empty();
      });
      continue;
    }
    auto earliest = std::min_element(g_continuations.begin(), g_continuations.end(),
        [](const auto& left, const auto& right) {
          return left.second->deadline < right.second->deadline;
        });
    const auto deadline = earliest->second->deadline;
    if (g_continuation_timer_condition.wait_until(lock, deadline) != std::cv_status::timeout) {
      continue;
    }
    std::vector<std::pair<LB_FBRO_CONTINUATION_HANDLE, int>> expired;
    const auto now = std::chrono::steady_clock::now();
    for (const auto& item : g_continuations) {
      if (item.second->deadline <= now) {
        expired.emplace_back(item.first, item.second->timeout_action);
      }
    }
    lock.unlock();
    for (const auto& item : expired) {
      CompleteContinuationInternal(item.first, item.second, L"{\"reason\":\"timeout\"}");
    }
    lock.lock();
  }
}

void EnsureContinuationTimerThread() {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  if (g_continuation_timer_thread.joinable()) return;
  g_continuation_timer_stop = false;
  g_continuation_timer_thread = std::thread(ContinuationTimerLoop);
}

void StopContinuationTimerThread() {
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_continuation_timer_stop = true;
    g_continuation_timer_condition.notify_all();
  }
  if (g_continuation_timer_thread.joinable()) g_continuation_timer_thread.join();
}

class BridgeCloseBrowserTask final : public CefTask {
 public:
  explicit BridgeCloseBrowserTask(CefRefPtr<CefBrowser> browser)
      : browser_(std::move(browser)) {}
  void Execute() override {
    if (browser_ && browser_->GetHost()) {
      FBroHsBrowserHost_CloseBrowser(browser_, true);
    }
  }
 private:
  CefRefPtr<CefBrowser> browser_;
  IMPLEMENT_REFCOUNTING(BridgeCloseBrowserTask);
};

bool RequestBrowserClose(CefRefPtr<CefBrowser> browser) {
  if (!browser || !browser->GetHost()) return false;
  if (CefCurrentlyOn(TID_UI)) {
    FBroHsBrowserHost_CloseBrowser(browser, true);
    return true;
  }
  return CefPostTask(TID_UI, new BridgeCloseBrowserTask(std::move(browser)));
}

struct BrowserCloseBatchState {
  BrowserCloseBatchState() : completed(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}
  ~BrowserCloseBatchState() { if (completed) CloseHandle(completed); }
  HANDLE completed = nullptr;
};

class BridgeCloseBrowserBatchTask final : public CefTask {
 public:
  BridgeCloseBrowserBatchTask(std::vector<CefRefPtr<CefBrowser>> browsers,
                              std::shared_ptr<BrowserCloseBatchState> state)
      : browsers_(std::move(browsers)), state_(std::move(state)) {}
  void Execute() override {
    for (auto& browser : browsers_) {
      if (browser && browser->GetHost()) FBroHsBrowserHost_CloseBrowser(browser, true);
    }
    if (state_ && state_->completed) SetEvent(state_->completed);
  }
 private:
  std::vector<CefRefPtr<CefBrowser>> browsers_;
  std::shared_ptr<BrowserCloseBatchState> state_;
  IMPLEMENT_REFCOUNTING(BridgeCloseBrowserBatchTask);
};

void RequestBrowserCloseBatchAndWait(std::vector<CefRefPtr<CefBrowser>> browsers) {
  if (browsers.empty()) return;
  if (CefCurrentlyOn(TID_UI)) {
    for (auto& browser : browsers) {
      if (browser && browser->GetHost()) FBroHsBrowserHost_CloseBrowser(browser, true);
    }
    return;
  }
  auto state = std::make_shared<BrowserCloseBatchState>();
  if (!state->completed || !CefPostTask(TID_UI,
      new BridgeCloseBrowserBatchTask(std::move(browsers), state))) return;
  WaitForSingleObject(state->completed, 2000);
}

int CompleteContinuationInternal(LB_FBRO_CONTINUATION_HANDLE handle, int action,
                                 const std::wstring& response_json) {
  std::shared_ptr<ContinuationState> continuation;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    const auto found = g_continuations.find(handle);
    if (found == g_continuations.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
    continuation = found->second;
    g_continuations.erase(found);
    g_continuation_timer_condition.notify_all();
  }
  bool expected = false;
  if (!continuation->completed.compare_exchange_strong(expected, true)) {
    return LB_FBRO_ERROR_RELEASED_HANDLE;
  }
  if (!continuation->completion) return LB_FBRO_OK;
  if (CefCurrentlyOn(TID_UI)) {
    continuation->completion(action, response_json);
    return LB_FBRO_OK;
  }
  return CefPostTask(TID_UI,
      new BridgeContinuationCompletionTask(continuation, action, response_json))
      ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED;
}

LB_FBRO_CONTINUATION_HANDLE CreateContinuation(
    LB_FBRO_HANDLE browser, const std::wstring& event_id, uint32_t timeout_milliseconds,
    int timeout_action, std::function<void(int, const std::wstring&)> completion) {
  auto continuation = std::make_shared<ContinuationState>();
  continuation->handle = g_next_object_handle.fetch_add(1);
  continuation->browser = browser;
  continuation->event_id = event_id;
  continuation->deadline = std::chrono::steady_clock::now()
      + std::chrono::milliseconds(timeout_milliseconds);
  continuation->timeout_action = timeout_action;
  continuation->completion = std::move(completion);
  EnsureContinuationTimerThread();
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_continuations.emplace(continuation->handle, continuation);
    g_continuation_timer_condition.notify_all();
  }
  return continuation->handle;
}

void CancelContinuationsForBrowser(LB_FBRO_HANDLE browser) {
  std::vector<LB_FBRO_CONTINUATION_HANDLE> handles;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (const auto& item : g_continuations) {
      if (item.second->browser == browser) handles.push_back(item.first);
    }
  }
  for (const auto handle : handles) {
    CompleteContinuationInternal(handle, LB_FBRO_EVENT_ACTION_CANCEL,
                                 L"{\"reason\":\"browserClosed\"}");
  }
}

int Notify(BrowserState& state, int code, const std::wstring& data,
           std::wstring* result_text = nullptr, LB_FBRO_OBJECT_HANDLE object = 0) {
  if (code == LB_FBRO_EVENT_ERROR) state.last_error = data;
  const std::wstring event_name = EventName(code);
  const wchar_t* stable_id = StableEventId(code);
  const std::wstring event_id = stable_id ? stable_id : L"fbro.legacy." + event_name;
  const wchar_t* field = code == LB_FBRO_EVENT_LOAD_END ? L"statusCode"
      : code == LB_FBRO_EVENT_ADDRESS_CHANGED || code == LB_FBRO_EVENT_BEFORE_POPUP ? L"url"
      : code == LB_FBRO_EVENT_TITLE_CHANGED ? L"title"
      : code == LB_FBRO_EVENT_ERROR ? L"message" : L"data";
  uint32_t flags = (code == LB_FBRO_EVENT_BEFORE_POPUP || code == LB_FBRO_EVENT_CERTIFICATE_ERROR
      || code == LB_FBRO_EVENT_DRAG_ENTER) ? LB_FBRO_EVENT_FLAG_SYNCHRONOUS : 0;
  return DispatchEventV3(state, event_id, OfficialEventName(code), ChineseEventName(code),
      BuildSafeFieldsJson({{field, data}}), code, flags, 0, object, 0, result_text);
}

int DispatchGeneratedBrowserEvent(LB_FBRO_HANDLE handle, const wchar_t* event_id,
                                  const wchar_t* official_name, const wchar_t* event_name,
                                  const std::wstring& fields_json, uint32_t flags,
                                  uint32_t max_hz, std::wstring* response_json = nullptr) {
  BrowserState* state = nullptr;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    state = Find(handle);
  }
  if (!state) return LB_FBRO_EVENT_ACTION_DEFAULT;
  return DispatchEventV3(*state, event_id ? event_id : L"", official_name ? official_name : L"",
                         event_name ? event_name : L"", fields_json, 0, flags, max_hz, 0, 0,
                         response_json);
}

template <typename T>
void ApplyEventResponse(const std::wstring&, const char*, T&) {}

void ApplyEventResponse(const std::wstring& response_json, const char* key, bool& value) {
  value = EventResponseBool(ParseEventResponse(response_json), key, value);
}

void ApplyEventResponse(const std::wstring& response_json, const char* key, int& value) {
  value = EventResponseInt(ParseEventResponse(response_json), key, value);
}

void ApplyEventResponse(const std::wstring& response_json, const char* key, CefRect& value) {
  const auto response = ParseEventResponse(response_json);
  if (!response || response->GetType(key) != VTYPE_DICTIONARY) return;
  const auto rect = response->GetDictionary(key);
  value.x = EventResponseInt(rect, "x", value.x);
  value.y = EventResponseInt(rect, "y", value.y);
  value.width = EventResponseInt(rect, "width", value.width);
  value.height = EventResponseInt(rect, "height", value.height);
}

void ApplyEventResponse(const std::wstring& response_json, const char* key,
                        CefScreenInfo& value) {
  const auto response = ParseEventResponse(response_json);
  if (!response || response->GetType(key) != VTYPE_DICTIONARY) return;
  const auto screen = response->GetDictionary(key);
  if (screen->GetType("deviceScaleFactor") == VTYPE_DOUBLE) {
    value.device_scale_factor = static_cast<float>(screen->GetDouble("deviceScaleFactor"));
  } else if (screen->GetType("deviceScaleFactor") == VTYPE_INT) {
    value.device_scale_factor = static_cast<float>(screen->GetInt("deviceScaleFactor"));
  }
  value.depth = EventResponseInt(screen, "depth", value.depth);
  value.depth_per_component = EventResponseInt(screen, "depthPerComponent", value.depth_per_component);
  value.is_monochrome = EventResponseBool(screen, "isMonochrome", value.is_monochrome);
  if (screen->GetType("rect") == VTYPE_DICTIONARY) {
    auto wrapper = CefDictionaryValue::Create(); wrapper->SetDictionary(key, screen->GetDictionary("rect"));
    auto root = CefValue::Create(); root->SetDictionary(wrapper);
    ApplyEventResponse(CefWriteJSON(root, JSON_WRITER_DEFAULT).ToWString(), key, value.rect);
  }
  if (screen->GetType("availableRect") == VTYPE_DICTIONARY) {
    auto wrapper = CefDictionaryValue::Create(); wrapper->SetDictionary(key, screen->GetDictionary("availableRect"));
    auto root = CefValue::Create(); root->SetDictionary(wrapper);
    ApplyEventResponse(CefWriteJSON(root, JSON_WRITER_DEFAULT).ToWString(), key, value.available_rect);
  }
}

void ApplyEventResponse(const std::wstring& response_json, const char* key,
                        CefAudioParameters& value) {
  const auto response = ParseEventResponse(response_json);
  if (!response || response->GetType(key) != VTYPE_DICTIONARY) return;
  const auto audio = response->GetDictionary(key);
  value.channel_layout = static_cast<cef_channel_layout_t>(
      EventResponseInt(audio, "channelLayout", static_cast<int>(value.channel_layout)));
  value.sample_rate = EventResponseInt(audio, "sampleRate", value.sample_rate);
  value.frames_per_buffer = EventResponseInt(audio, "framesPerBuffer", value.frames_per_buffer);
}

int DispatchGeneratedInitEvent(CefRefPtr<CefBrowser> browser, const wchar_t* event_id,
                               const wchar_t* official_name, const wchar_t* event_name,
                               const std::wstring& fields_json, uint32_t flags,
                               uint32_t max_hz) {
  BrowserState* state = nullptr;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (auto& item : g_browsers) {
      if (browser && item.second->browser && item.second->browser->IsSame(browser)) {
        state = item.second.get();
        break;
      }
    }
  }
  if (!state) return LB_FBRO_EVENT_ACTION_DEFAULT;
  return DispatchEventV3(*state, event_id ? event_id : L"", official_name ? official_name : L"",
                         event_name ? event_name : L"", fields_json, 0, flags, max_hz, 0, 0);
}

bool HasExplicitEventSubscription(const BrowserState& state, const std::wstring& event_id,
                                  const wchar_t* official_name, const wchar_t* event_name,
                                  int legacy_code) {
  for (const std::wstring alias : {event_id,
       official_name ? std::wstring(official_name) : std::wstring(),
       event_name ? std::wstring(event_name) : std::wstring(),
       legacy_code > 0 ? std::wstring(EventName(legacy_code)) : std::wstring()}) {
    if (alias.empty()) continue;
    if (const auto found = state.event_subscriptions.find(alias);
        found != state.event_subscriptions.end() && found->second) return true;
  }
  return false;
}

bool DispatchManagedBrowserEvent(
    LB_FBRO_HANDLE browser, const wchar_t* official_name, const std::wstring& fields_json,
    uint32_t timeout_milliseconds,
    std::function<void(int, const std::wstring&)> completion,
    LB_FBRO_OBJECT_HANDLE object = 0, int legacy_code = 0,
    bool require_subscription = true) {
  const wchar_t* stable_id_value = StableEventId(official_name);
  const wchar_t* chinese_name = ChineseEventName(official_name);
  const std::wstring event_id = stable_id_value ? stable_id_value : L"fbro.event.unknown";
  BrowserState* state = nullptr;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    state = Find(browser);
    if (!state || !state->callback_v3) return false;
    if (require_subscription
        && !HasExplicitEventSubscription(*state, event_id, official_name, chinese_name,
                                         legacy_code)) return false;
  }
  const auto continuation = CreateContinuation(browser, event_id, timeout_milliseconds,
      LB_FBRO_EVENT_ACTION_CANCEL, std::move(completion));
  std::wstring response_json;
  const int action = DispatchEventV3(*state, event_id, official_name, chinese_name,
      fields_json, legacy_code, LB_FBRO_EVENT_FLAG_DEFERRED, 0, object,
      continuation, &response_json);
  if (action == LB_FBRO_EVENT_ACTION_CONTINUE || action == LB_FBRO_EVENT_ACTION_CANCEL
      || action == LB_FBRO_EVENT_ACTION_HANDLED) {
    CompleteContinuationInternal(continuation, action, response_json);
  }
  return true;
}

BrowserState* Find(LB_FBRO_HANDLE handle) {
  const auto found = g_browsers.find(handle);
  return found == g_browsers.end() ? nullptr : found->second.get();
}

std::filesystem::path AbsoluteNormalizedPath(const std::filesystem::path& value) {
  std::error_code ignored;
  auto absolute = std::filesystem::absolute(value, ignored);
  return (ignored ? value : absolute).lexically_normal();
}

bool IsChildPath(const std::filesystem::path& root, const std::filesystem::path& candidate) {
  std::wstring root_text = AbsoluteNormalizedPath(root).wstring();
  std::wstring candidate_text = AbsoluteNormalizedPath(candidate).wstring();
  std::replace(root_text.begin(), root_text.end(), L'/', L'\\');
  std::replace(candidate_text.begin(), candidate_text.end(), L'/', L'\\');
  std::transform(root_text.begin(), root_text.end(), root_text.begin(), ::towlower);
  std::transform(candidate_text.begin(), candidate_text.end(), candidate_text.begin(), ::towlower);
  while (!root_text.empty() && root_text.back() == L'\\') root_text.pop_back();
  return candidate_text.size() > root_text.size()
      && candidate_text.compare(0, root_text.size(), root_text) == 0
      && candidate_text[root_text.size()] == L'\\';
}

bool ResolveRuntimeAssetPath(const std::wstring& supplied, bool require_directory,
                             std::filesystem::path& resolved, std::wstring& error) {
  if (supplied.empty()) {
    error = L"路径不能为空";
    return false;
  }
  std::error_code path_error;
  const auto runtime_root = std::filesystem::weakly_canonical(g_runtime_directory, path_error);
  const auto safe_root = path_error ? AbsoluteNormalizedPath(g_runtime_directory) : runtime_root;
  std::filesystem::path candidate(supplied);
  if (candidate.is_relative()) candidate = safe_root / candidate;
  path_error.clear();
  const auto canonical = std::filesystem::weakly_canonical(candidate, path_error);
  resolved = path_error ? AbsoluteNormalizedPath(candidate) : canonical;
  if (resolved != safe_root && !IsChildPath(safe_root, resolved)) {
    error = L"路径必须位于当前生成程序目录内";
    return false;
  }
  path_error.clear();
  const bool valid_type = require_directory
      ? std::filesystem::is_directory(resolved, path_error)
      : std::filesystem::is_regular_file(resolved, path_error);
  if (path_error || !valid_type) {
    error = require_directory ? L"扩展目录不存在或不可访问" : L"文件不存在或不可访问";
    return false;
  }
  return true;
}

std::filesystem::path ResolveProfileDirectory(const std::wstring& profile, LB_FBRO_HANDLE handle,
                                              std::wstring& warning) {
  if (profile.empty()) return {};
  std::filesystem::path requested(profile);
  std::filesystem::path candidate;
  if (requested.is_relative()) {
    const auto first = requested.begin();
    candidate = first != requested.end() && (*first == L".fbro-global-cache")
        ? g_runtime_directory / requested
        : g_root_cache_directory / requested;
  } else {
    candidate = requested;
  }
  candidate = AbsoluteNormalizedPath(candidate);
  const auto normalized_root = AbsoluteNormalizedPath(g_root_cache_directory);
  if (IsChildPath(normalized_root, candidate) && candidate.parent_path() == normalized_root) return candidate;

  std::wstring stable_source = profile.empty() ? std::to_wstring(handle) : profile;
  unsigned long long hash = 1469598103934665603ULL;
  for (wchar_t character : stable_source) {
    hash ^= static_cast<unsigned long long>(static_cast<unsigned int>(character));
    hash *= 1099511628211ULL;
  }
  std::wstring label = requested.filename().wstring();
  for (wchar_t& character : label) {
    if (!std::iswalnum(character) && character != L'-' && character != L'_') character = L'_';
  }
  if (label.empty()) label = L"browser";
  if (label.size() > 32) label.resize(32);
  wchar_t hash_text[32]{};
  swprintf_s(hash_text, L"%016llx", hash);
  if (requested.is_absolute() && !IsChildPath(normalized_root, candidate)) {
    warning = L"缓存目录必须位于 FBro 全局缓存根目录内，已改用隔离目录";
  }
  return normalized_root / (L"profile-" + label + L"-" + hash_text);
}

class BridgeBrowserEvent final : public FBroHsBroEvent {
 public:
  explicit BridgeBrowserEvent(LB_FBRO_HANDLE handle) : handle_(handle) { type_ = BroEventType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }

  void OnAfterCreated(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDictionaryValue>) override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      state->browser = browser;
      if ((state->flags & 8U) != 0 && browser->GetHost()) browser->GetHost()->SetAudioMuted(true);
      Notify(*state, LB_FBRO_EVENT_CREATED, L"浏览器创建完成");
    }
  }
  bool OnBeforePopup(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, int,
                     const CefString& target_url, const CefString&,
                     CefLifeSpanHandler::WindowOpenDisposition, bool,
                     const CefPopupFeatures&, CefWindowInfo&, CefBrowserSettings&,
                     bool*, CefRefPtr<FBroUseExtraData>) override {
    std::unique_lock<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle_);
    lock.unlock();
    const int action = state ? Notify(*state, LB_FBRO_EVENT_BEFORE_POPUP, target_url.ToWString()) : 0;
    // 默认保持单窗口接管；处理器显式返回 1 时才允许 SDK 创建 popup。
    return action != 1;
  }
  void OnBeforeClose(CefRefPtr<CefBrowser>) override {
    CancelContinuationsForBrowser(handle_);
    bool all_browsers_closed = false;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(handle_)) {
        state->browser = nullptr;
        Notify(*state, LB_FBRO_EVENT_CLOSED, L"浏览器关闭完成");
      }
      all_browsers_closed = std::all_of(g_browsers.begin(), g_browsers.end(), [](const auto& item) {
        return !item.second->browser;
      });
    }
    if (all_browsers_closed && g_shutdown_started) FBroQuitMessageLoop();
  }
  void OnAddressChange(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefString& url) override {
    if (!frame || !frame->IsMain()) return;
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      state->url = url.ToWString();
      Notify(*state, LB_FBRO_EVENT_ADDRESS_CHANGED, state->url);
    }
  }
  void OnTitleChange(CefRefPtr<CefBrowser>, const CefString& title) override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      state->title = title.ToWString();
      Notify(*state, LB_FBRO_EVENT_TITLE_CHANGED, state->title);
    }
  }
  void OnLoadEnd(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int status) override {
    if (!frame || !frame->IsMain()) return;
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) Notify(*state, LB_FBRO_EVENT_LOAD_END, std::to_wstring(status));
  }
  void OnLoadError(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                   CefLoadHandler::ErrorCode code, const CefString& text,
                   const CefString& failed_url) override {
    if (!frame || !frame->IsMain()) return;
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      Notify(*state, LB_FBRO_EVENT_ERROR, std::to_wstring(static_cast<int>(code)) + L": " +
             text.ToWString() + L" / " + failed_url.ToWString());
    }
  }
  bool OnCertificateError(CefRefPtr<CefBrowser>, cef_errorcode_t cert_error,
                          const CefString& request_url, CefRefPtr<CefSSLInfo> ssl_info,
                          CefRefPtr<CefCallback> callback) override {
    const int cert_status = ssl_info ? FBroHsSSLInfo_GetCertStatus(ssl_info) : 0;
    const auto certificate = ssl_info ? FBroHsSSLInfo_GetX509Certificate(ssl_info) : nullptr;
    const LB_FBRO_OBJECT_HANDLE object = RegisterCertificate(certificate);
    if (callback && DispatchManagedBrowserEvent(handle_, L"OnCertificateError",
        BuildSafeFieldsJson({
            {L"errorCode", std::to_wstring(static_cast<int>(cert_error))},
            {L"certificateStatus", std::to_wstring(cert_status)},
            {L"url", request_url.ToWString()}}),
        5000, [callback](int completion_action, const std::wstring&) {
          if (completion_action == LB_FBRO_EVENT_ACTION_CONTINUE) FBroCallback_Continue(callback);
          else FBroCallback_Cancel(callback);
        }, object, LB_FBRO_EVENT_CERTIFICATE_ERROR)) return true;

    int action = 0;
    std::unique_lock<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle_);
    const bool uses_v3 = state && state->callback_v3;
    lock.unlock();
    if (uses_v3) return false;
    if (state) {
      const std::wstring data = std::to_wstring(static_cast<int>(cert_error)) + L":"
          + std::to_wstring(cert_status) + L":" + request_url.ToWString();
      action = Notify(*state, LB_FBRO_EVENT_CERTIFICATE_ERROR, data, nullptr, object);
    }
    if (!callback) return false;
    if (action == 1) FBroCallback_Continue(callback);
    else FBroCallback_Cancel(callback);
    return true;
  }
  bool OnDragEnter(CefRefPtr<CefBrowser>, CefRefPtr<CefDragData> drag_data,
                   CefDragHandler::DragOperationsMask mask) override {
    const auto clone = drag_data ? FBroHsDragData_Clone(drag_data) : nullptr;
    const LB_FBRO_OBJECT_HANDLE object = RegisterDragData(clone);
    int action = 0;
    std::unique_lock<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle_);
    lock.unlock();
    if (state) {
      action = Notify(*state, LB_FBRO_EVENT_DRAG_ENTER,
                      std::to_wstring(static_cast<int>(mask)), nullptr, object);
    }
    return action == 2;
  }

  bool GetAuthCredentials(CefRefPtr<CefBrowser>, const CefString& origin_url,
                          bool is_proxy, const CefString& host, int port,
                          const CefString& realm, const CefString& scheme,
                          CefRefPtr<CefAuthCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"GetAuthCredentials",
        BuildSafeFieldsJson({
            {L"originUrl", origin_url.ToWString()}, {L"isProxy", is_proxy ? L"1" : L"0"},
            {L"host", host.ToWString()}, {L"port", std::to_wstring(port)},
            {L"realm", realm.ToWString()}, {L"scheme", scheme.ToWString()}}),
        5000, [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) {
            callback->Cancel();
            return;
          }
          const auto response = ParseEventResponse(response_json);
          FBroAuthCallback_Continue(callback, CefString(EventResponseString(response, "username")),
                                    CefString(EventResponseString(response, "password")));
        }, 0, 0, false);
  }

  bool OnBeforeDownload(CefRefPtr<CefBrowser>, CefRefPtr<CefDownloadItem> item,
                        const CefString& suggested_name,
                        CefRefPtr<CefBeforeDownloadCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"OnBeforeDownload",
        BuildSafeFieldsJson({
            {L"downloadId", item ? std::to_wstring(FBroHsDownloadItem_GetDownloadId(item)) : L"0"},
            {L"url", item ? FromFbroString(FBroHsDownloadItem_GetDownloadURL(item)) : L""},
            {L"suggestedName", suggested_name.ToWString()},
            {L"totalBytes", item ? std::to_wstring(FBroHsDownloadItem_GetTotalBytes(item)) : L"0"}}),
        120000, [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) return;
          const auto response = ParseEventResponse(response_json);
          FBroHsBeforeDownloadCallback_Continue(callback,
              CefString(EventResponseString(response, "path")),
              EventResponseBool(response, "showDialog", false));
        });
  }

  CefResourceRequestHandler::ReturnValue OnBeforeResourceLoad(
      CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request,
      CefRefPtr<CefCallback> callback) override {
    if (!callback) return RV_CONTINUE;
    const bool managed = DispatchManagedBrowserEvent(handle_, L"OnBeforeResourceLoad",
        BuildSafeFieldsJson({
            {L"frameUrl", frame ? frame->GetURL().ToWString() : L""},
            {L"url", request ? FromFbroString(FBroHsRequest_GetURL(request)) : L""},
            {L"method", request ? FromFbroString(FBroHsRequest_GetMethod(request)) : L""},
            {L"identifier", request ? std::to_wstring(FBroHsRequest_GetIdentifier(request)) : L"0"}}),
        30000, [callback](int action, const std::wstring&) {
          if (action == LB_FBRO_EVENT_ACTION_CONTINUE) FBroCallback_Continue(callback);
          else FBroCallback_Cancel(callback);
        });
    return managed ? RV_CONTINUE_ASYNC : RV_CONTINUE;
  }

  bool OnBeforeUnloadDialog(CefRefPtr<CefBrowser>, const CefString& message_text,
                            bool is_reload, CefRefPtr<CefJSDialogCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"OnBeforeUnloadDialog",
        BuildSafeFieldsJson({{L"message", message_text.ToWString()},
                             {L"isReload", is_reload ? L"1" : L"0"}}),
        120000, [callback](int action, const std::wstring& response_json) {
          const auto response = ParseEventResponse(response_json);
          const bool success = action == LB_FBRO_EVENT_ACTION_CONTINUE
              && EventResponseBool(response, "success", true);
          FBroJSDialogCallback_Continue(callback, success,
                                        CefString(EventResponseString(response, "userInput")));
        });
  }

  void OnDownloadUpdated(CefRefPtr<CefBrowser>, CefRefPtr<CefDownloadItem> item,
                         CefRefPtr<CefDownloadItemCallback> callback) override {
    if (!callback) return;
    DispatchManagedBrowserEvent(handle_, L"OnDownloadUpdated",
        BuildSafeFieldsJson({
            {L"downloadId", item ? std::to_wstring(FBroHsDownloadItem_GetDownloadId(item)) : L"0"},
            {L"percent", item ? std::to_wstring(FBroHsDownloadItem_GetPercentComplete(item)) : L"-1"},
            {L"receivedBytes", item ? std::to_wstring(FBroHsDownloadItem_GetReceivedBytes(item)) : L"0"},
            {L"totalBytes", item ? std::to_wstring(FBroHsDownloadItem_GetTotalBytes(item)) : L"0"},
            {L"fullPath", item ? FromFbroString(FBroHsDownloadItem_GetFullPath(item)) : L""}}),
        120000, [callback](int action, const std::wstring& response_json) {
          const auto response = ParseEventResponse(response_json);
          const int download_action = EventResponseInt(response, "downloadAction",
              action == LB_FBRO_EVENT_ACTION_CONTINUE ? 2 : 0);
          if (download_action == 1) FBroHsBeforeDownloadCallback_Pause(callback);
          else if (download_action == 2) FBroHsBeforeDownloadCallback_Resume(callback);
          else FBroHsBeforeDownloadCallback_Cancel(callback);
        });
  }

  bool OnFileDialog(CefRefPtr<CefBrowser>, CefDialogHandler::FileDialogMode mode,
                    const CefString& title, const CefString& default_file_path,
                    CefRefPtr<FBroCefStringList> accept_filters,
                    CefRefPtr<FBroCefStringList> accept_extensions,
                    CefRefPtr<FBroCefStringList> accept_descriptions,
                    CefRefPtr<CefFileDialogCallback> callback) override {
    if (!callback) return false;
    std::wstring fields = L"{\"mode\":\"" + std::to_wstring(static_cast<int>(mode))
        + L"\",\"title\":\"" + JsonEscape(title.ToWString())
        + L"\",\"defaultPath\":\"" + JsonEscape(default_file_path.ToWString())
        + L"\",\"acceptFilters\":" + StringListJson(accept_filters)
        + L",\"acceptExtensions\":" + StringListJson(accept_extensions)
        + L",\"acceptDescriptions\":" + StringListJson(accept_descriptions) + L"}";
    return DispatchManagedBrowserEvent(handle_, L"OnFileDialog", fields, 120000,
        [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) {
            FBroFileDialogCallback_Cancel(callback);
            return;
          }
          const auto response = ParseEventResponse(response_json);
          const auto paths = EventResponseStringList(response, "paths");
          if (paths && FBroCefStringList_Size(paths) > 0) FBroFileDialogCallback_Continue(callback, paths);
          else FBroFileDialogCallback_Cancel(callback);
        });
  }

  bool OnJSDialog(CefRefPtr<CefBrowser>, const CefString& origin_url,
                  CefJSDialogHandler::JSDialogType dialog_type, const CefString& message_text,
                  const CefString& default_prompt_text, CefRefPtr<CefJSDialogCallback> callback,
                  bool& suppress_message) override {
    if (!callback) return false;
    suppress_message = false;
    return DispatchManagedBrowserEvent(handle_, L"OnJSDialog",
        BuildSafeFieldsJson({
            {L"originUrl", origin_url.ToWString()},
            {L"dialogType", std::to_wstring(static_cast<int>(dialog_type))},
            {L"message", message_text.ToWString()},
            {L"defaultPrompt", default_prompt_text.ToWString()}}),
        120000, [callback](int action, const std::wstring& response_json) {
          const auto response = ParseEventResponse(response_json);
          const bool success = action == LB_FBRO_EVENT_ACTION_CONTINUE
              && EventResponseBool(response, "success", true);
          FBroJSDialogCallback_Continue(callback, success,
                                        CefString(EventResponseString(response, "userInput")));
        });
  }

  bool OnQuotaRequest(CefRefPtr<CefBrowser>, const CefString& origin_url,
                      int64_t new_size, CefRefPtr<CefCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"OnQuotaRequest",
        BuildSafeFieldsJson({{L"originUrl", origin_url.ToWString()},
                             {L"newSize", std::to_wstring(new_size)}}),
        5000, [callback](int action, const std::wstring&) {
          if (action == LB_FBRO_EVENT_ACTION_CONTINUE) FBroCallback_Continue(callback);
          else FBroCallback_Cancel(callback);
        });
  }

  bool OnRequestMediaAccessPermission(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                                      const CefString& requesting_origin,
                                      uint32_t requested_permissions,
                                      CefRefPtr<CefMediaAccessCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"OnRequestMediaAccessPermission",
        BuildSafeFieldsJson({
            {L"frameUrl", frame ? frame->GetURL().ToWString() : L""},
            {L"requestingOrigin", requesting_origin.ToWString()},
            {L"requestedPermissions", std::to_wstring(requested_permissions)}}),
        5000, [callback, requested_permissions](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) {
            FBroHsMediaAccessCallback_Cancel(callback);
            return;
          }
          const auto response = ParseEventResponse(response_json);
          FBroHsMediaAccessCallback_Continue(callback,
              EventResponseInt(response, "allowedPermissions",
                               static_cast<int>(requested_permissions)));
        });
  }

  bool OnSelectClientCertificate(CefRefPtr<CefBrowser>, bool is_proxy, const CefString& host,
                                 int port, CefRefPtr<FBroX509CertificateList> certificates,
                                 CefRefPtr<CefSelectClientCertificateCallback> callback) override {
    if (!callback) return false;
    const int certificate_count = certificates ? FBroX509CertificateList_Size(certificates) : 0;
    return DispatchManagedBrowserEvent(handle_, L"OnSelectClientCertificate",
        BuildSafeFieldsJson({{L"isProxy", is_proxy ? L"1" : L"0"},
                             {L"host", host.ToWString()}, {L"port", std::to_wstring(port)},
                             {L"certificateCount", std::to_wstring(certificate_count)}}),
        5000, [callback, certificates, certificate_count](int action, const std::wstring& response_json) {
          CefRefPtr<CefX509Certificate> selected;
          if (action == LB_FBRO_EVENT_ACTION_CONTINUE) {
            const auto response = ParseEventResponse(response_json);
            const int index = EventResponseInt(response, "certificateIndex", -1);
            if (index >= 0 && index < certificate_count) selected = FBroX509CertificateList_GetValue(certificates, index);
          }
          FBroSelectClientCertificateCallback_Select(callback, selected);
        });
  }

  bool OnShowPermissionPrompt(CefRefPtr<CefBrowser>, uint64_t prompt_id,
                              const CefString& requesting_origin, uint32_t requested_permissions,
                              CefRefPtr<CefPermissionPromptCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"OnShowPermissionPrompt",
        BuildSafeFieldsJson({{L"promptId", std::to_wstring(prompt_id)},
                             {L"requestingOrigin", requesting_origin.ToWString()},
                             {L"requestedPermissions", std::to_wstring(requested_permissions)}}),
        5000, [callback](int action, const std::wstring& response_json) {
          const auto response = ParseEventResponse(response_json);
          const int result = action == LB_FBRO_EVENT_ACTION_CONTINUE
              ? EventResponseInt(response, "permissionResult", CEF_PERMISSION_RESULT_ACCEPT)
              : CEF_PERMISSION_RESULT_DENY;
          FBroHsPermissionPromptCallback_Continue(callback, result);
        });
  }

  bool RunContextMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefContextMenuParams> params, CefRefPtr<CefMenuModel> model,
                      CefRefPtr<CefRunContextMenuCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"RunContextMenu",
        BuildSafeFieldsJson({
            {L"frameUrl", frame ? frame->GetURL().ToWString() : L""},
            {L"selectionText", params ? FromFbroString(FBroHsContextMenuParams_GetSelectionText(params)) : L""},
            {L"editStateFlags", params ? std::to_wstring(FBroHsContextMenuParams_GetEditStateFlags(params)) : L"0"},
            {L"itemCount", model ? std::to_wstring(FBroHsMenuModel_GetCount(model)) : L"0"}}),
        30000, [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) {
            FBroRunContextMenuCallback_Cancel(callback);
            return;
          }
          const auto response = ParseEventResponse(response_json);
          FBroRunContextMenuCallback_Continue(callback,
              EventResponseInt(response, "commandId", -1),
              static_cast<cef_event_flags_t>(EventResponseInt(response, "eventFlags", 0)));
        });
  }

  bool RunQuickMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                    PTELIB_ELEMENT_AT location, POINT_SIZE size, int edit_state_flags,
                    CefRefPtr<CefRunQuickMenuCallback> callback) override {
    if (!callback) return false;
    return DispatchManagedBrowserEvent(handle_, L"RunQuickMenu",
        BuildSafeFieldsJson({
            {L"frameUrl", frame ? frame->GetURL().ToWString() : L""},
            {L"x", location ? std::to_wstring(location->x) : L"0"},
            {L"y", location ? std::to_wstring(location->y) : L"0"},
            {L"width", size ? std::to_wstring(size->width) : L"0"},
            {L"height", size ? std::to_wstring(size->height) : L"0"},
            {L"editStateFlags", std::to_wstring(edit_state_flags)}}),
        30000, [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) {
            FBroHsRunQuickMenuCallback_Cancel(callback);
            return;
          }
          const auto response = ParseEventResponse(response_json);
          FBroHsRunQuickMenuCallback_Continue(callback,
              EventResponseInt(response, "commandId", -1),
              EventResponseInt(response, "eventFlags", 0));
        });
  }

#define LB_FBRO_BROWSER_EVENT_OVERRIDES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_BROWSER_EVENT_OVERRIDES

 private:
  LB_FBRO_HANDLE handle_;
  IMPLEMENT_REFCOUNTING(BridgeBrowserEvent);
};

bool StartBrowser(BrowserState& state) {
  if (!g_ready || state.create_started || (!state.chrome_ui && !IsWindow(state.host))) return false;
  state.create_started = true;
  E_WINDOWS_INFO window{};
  window.is_null = FALSE;
  if (state.chrome_ui) {
    // Chrome Runtime owns this desktop popup. LingBuilder deliberately supplies
    // no host/parent HWND, so it cannot be embedded into or cover the main window.
    window.ex_style = WS_EX_APPWINDOW;
    window.window_name = const_cast<char*>("FBro Chrome UI");
    window.style = WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
    window.x = CW_USEDEFAULT;
    window.y = CW_USEDEFAULT;
    window.width = CW_USEDEFAULT;
    window.height = CW_USEDEFAULT;
    window.parent_window = nullptr;
    window.window = nullptr;
    window.runtime_style = CEF_RUNTIME_STYLE_CHROME;
  } else {
    RECT bounds{};
    GetClientRect(state.host, &bounds);
    window.parent_window = state.host;
    window.x = 0;
    window.y = 0;
    window.width = std::max<LONG>(1, bounds.right - bounds.left);
    window.height = std::max<LONG>(1, bounds.bottom - bounds.top);
    window.style = WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
    window.runtime_style = CEF_RUNTIME_STYLE_ALLOY;
  }
  FBroBrowserSetting settings{};
  settings.is_null = FALSE;
  settings.background_color = 0x00FFFFFF;
  settings.javascript = (state.flags & 1U) != 0 ? 1 : -1;
  settings.image_loading = (state.flags & 2U) != 0 ? 1 : -1;
  settings.webgl = (state.flags & 4U) != 0 ? 1 : -1;
  state.event = new BridgeBrowserEvent(state.handle);
  if (!state.profile.empty()) {
    CefRequestContextSettings context_settings{};
    CefString(&context_settings.cache_path).FromWString(state.profile);
    context_settings.persist_session_cookies = true;
    state.request_context = CefRequestContext::CreateContext(context_settings, nullptr);
  }
  if (state.request_context && !state.user_agent.empty()) {
    auto value = CefValue::Create();
    value->SetString(state.user_agent);
    auto error = FBroString_Creat();
    FBroHsRequestContext_SetPreference(state.request_context, CefString("general.useragent.override"), value, error);
  }
  auto extra = CefDictionaryValue::Create();
  extra->SetString("flag", "LingBuilderFbroBridge");
  if (!FBroHsCreate(CefString(state.url.empty() ? L"about:blank" : state.url), &window,
                    &settings, state.request_context, extra, state.event, nullptr,
                    CefString(std::to_wstring(state.handle)))) {
    state.create_started = false;
    Notify(state, LB_FBRO_EVENT_ERROR, L"FBroHsCreate 创建浏览器失败");
    return false;
  }
  return true;
}

class BridgeBrowserStartTask final : public CefTask {
 public:
  explicit BridgeBrowserStartTask(LB_FBRO_HANDLE handle) : handle_(handle) {}
  void Execute() override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (g_shutdown_started) return;
    if (auto* state = Find(handle_)) StartBrowser(*state);
  }

 private:
  LB_FBRO_HANDLE handle_;
  IMPLEMENT_REFCOUNTING(BridgeBrowserStartTask);
};

void ScheduleBrowserStart(LB_FBRO_HANDLE handle) {
  if (!g_ready || g_shutdown_started) return;
  if (CefCurrentlyOn(TID_UI)) {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle)) StartBrowser(*state);
    return;
  }
  if (!CefPostTask(TID_UI, new BridgeBrowserStartTask(handle))) {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle)) Notify(*state, LB_FBRO_EVENT_ERROR, L"无法投递 FBro 浏览器创建任务");
  }
}

void StartPendingBrowsers() {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  for (auto& item : g_browsers) StartBrowser(*item.second);
}

class BridgeInitEvent final : public FBroHsInitEvent {
 public:
  BridgeInitEvent() { type_ = InitEventType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void OnBeforeCommandLineProcessing(const CefString&,
                                     CefRefPtr<CefCommandLine> command_line) override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (command_line && !g_vip_proxy_url.empty()) {
      FBroHsVIPCommandLine_SetProxy(command_line, g_vip_proxy_url,
                                    g_vip_proxy_user, g_vip_proxy_password);
    }
  }
  void OnContextInitialized() override {
    g_ready = true;
    StartPendingBrowsers();
  }
#define LB_FBRO_INIT_EVENT_OVERRIDES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_INIT_EVENT_OVERRIDES
 private:
  IMPLEMENT_REFCOUNTING(BridgeInitEvent);
};

class BridgeVipEvent final : public FBroVIPEvent {
 public:
  void OnContextInitialized() override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (auto& [handle, state] : g_browsers) {
      (void)handle;
      Notify(*state, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"contextInitialized\"}");
    }
  }
  void OnAfterCreated(CefRefPtr<CefBrowser> browser, CefRefPtr<CefBrowser>) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"afterCreated\"}");
  }
  void AfterCreated(CefRefPtr<CefBrowser> browser) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"created\"}");
  }
  bool OnBeforePopup(CefRefPtr<CefBrowser> browser) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"beforePopup\"}");
    return false;
  }
  void OnBeforeClose(CefRefPtr<CefBrowser> browser) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"beforeClose\"}");
  }
  void Shutdown() override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (auto& [handle, state] : g_browsers) {
      (void)handle;
      Notify(*state, LB_FBRO_EVENT_VIP_LIFECYCLE, L"{\"phase\":\"shutdown\"}");
    }
  }

 private:
  IMPLEMENT_REFCOUNTING(BridgeVipEvent);
};

int WithBrowser(LB_FBRO_HANDLE handle, const std::function<void(CefRefPtr<CefBrowser>)>& action) {
  CefRefPtr<CefBrowser> browser;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* state = Find(handle);
    if (!state || !state->browser) return -1;
    browser = state->browser;
  }
  action(browser);
  return 1;
}

int WithFrame(LB_FBRO_OBJECT_HANDLE handle,
              const std::function<void(CefRefPtr<CefFrame>)>& action) {
  int status = LB_FBRO_OK;
  auto state = GetObject(handle, LB_FBRO_OBJECT_FRAME, status);
  if (!state || !state->frame) return status == LB_FBRO_OK ? LB_FBRO_ERROR_RELEASED_HANDLE : status;
  action(state->frame);
  return LB_FBRO_OK;
}

struct CookieVisitState {
  std::mutex mutex;
  std::condition_variable changed;
  std::wstring text;
  bool done = false;
};

class CookieVisitor final : public CefCookieVisitor {
 public:
  explicit CookieVisitor(std::shared_ptr<CookieVisitState> state) : state_(std::move(state)) {}
  bool Visit(const CefCookie& cookie, int count, int total, bool&) override {
    std::lock_guard<std::mutex> lock(state_->mutex);
    if (!state_->text.empty()) state_->text += L"; ";
    state_->text += CefString(&cookie.name).ToWString();
    state_->text += L"=";
    state_->text += CefString(&cookie.value).ToWString();
    if (count + 1 >= total) { state_->done = true; state_->changed.notify_all(); }
    return true;
  }
 private:
  std::shared_ptr<CookieVisitState> state_;
  IMPLEMENT_REFCOUNTING(CookieVisitor);
};

struct CookieDeleteState {
  std::mutex mutex;
  std::condition_variable changed;
  int deleted = -1;
};

class CookieDeleteCallback final : public CefDeleteCookiesCallback {
 public:
  explicit CookieDeleteCallback(std::shared_ptr<CookieDeleteState> state) : state_(std::move(state)) {}
  void OnComplete(int count) override {
    std::lock_guard<std::mutex> lock(state_->mutex);
    state_->deleted = count;
    state_->changed.notify_all();
  }
 private:
  std::shared_ptr<CookieDeleteState> state_;
  IMPLEMENT_REFCOUNTING(CookieDeleteCallback);
};

struct JsExecutionState {
  std::mutex mutex;
  std::condition_variable changed;
  std::wstring value;
  bool done = false;
  bool success = true;
};

class BridgeJsCallback final : public FBroHsJsCallback {
 public:
  explicit BridgeJsCallback(std::shared_ptr<JsExecutionState> state) : state_(std::move(state)) {
    type_ = JsCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }

  void Callback(CefRefPtr<CefListValue> values) override {
    std::lock_guard<std::mutex> lock(state_->mutex);
    try {
      if (!values || values->GetSize() <= 1) {
        state_->value = L"JavaScript 未返回可读取的数据";
        state_->success = false;
      } else {
        const int value_type = values->GetInt(1);
        if (value_type == 2 && values->GetSize() > 2) state_->value = values->GetString(2).ToWString();
        else if (value_type == 3 && values->GetSize() > 2) state_->value = values->GetBool(2) ? L"true" : L"false";
        else if (value_type == 1 && values->GetSize() > 2) state_->value = std::to_wstring(values->GetInt(2));
        else if (value_type == 4 && values->GetSize() > 2) state_->value = std::to_wstring(values->GetDouble(2));
        else if (value_type == -1 && values->GetSize() > 3) {
          state_->value = values->GetString(3).ToWString();
          state_->success = false;
        } else if (value_type == 0) state_->value = L"null";
        else {
          state_->value = L"未知 JavaScript 返回类型: " + std::to_wstring(value_type);
          state_->success = false;
        }
      }
    } catch (...) {
      state_->value = L"解析 JavaScript 返回值时发生异常";
      state_->success = false;
    }
    state_->done = true;
    state_->changed.notify_all();
  }

 private:
  std::shared_ptr<JsExecutionState> state_;
  IMPLEMENT_REFCOUNTING(BridgeJsCallback);
};

std::pair<bool, std::wstring> ReadJsCallbackValue(CefRefPtr<CefListValue> values) {
  if (!values || values->GetSize() <= 1) return {false, L"JavaScript 未返回可读取的数据"};
  const int value_type = values->GetInt(1);
  if (value_type == 2 && values->GetSize() > 2) return {true, values->GetString(2).ToWString()};
  if (value_type == 3 && values->GetSize() > 2) return {true, values->GetBool(2) ? L"true" : L"false"};
  if (value_type == 1 && values->GetSize() > 2) return {true, std::to_wstring(values->GetInt(2))};
  if (value_type == 4 && values->GetSize() > 2) return {true, std::to_wstring(values->GetDouble(2))};
  if (value_type == -1 && values->GetSize() > 3) return {false, values->GetString(3).ToWString()};
  if (value_type == 0) return {true, L"null"};
  return {false, L"未知 JavaScript 返回类型: " + std::to_wstring(value_type)};
}

class BridgeAsyncJsCallback final : public FBroHsJsCallback {
 public:
  explicit BridgeAsyncJsCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) { type_ = JsCallbackType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }

  void Callback(CefRefPtr<CefListValue> values) override {
    if (task_->status == LB_FBRO_TASK_CANCELLED) return;
    try {
      auto [success, value] = ReadJsCallbackValue(values);
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        if (task_->status == LB_FBRO_TASK_CANCELLED) return;
        if (success) task_->result = std::move(value);
        else task_->error = std::move(value);
        task_->status = success ? LB_FBRO_TASK_COMPLETED : LB_FBRO_TASK_FAILED;
      }
    } catch (...) {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      task_->error = L"解析 JavaScript 返回值时发生异常";
      task_->status = LB_FBRO_TASK_FAILED;
    }
    const auto callback = task_->callback;
    if (callback) callback(task_->handle, task_->user_data);
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeAsyncJsCallback);
};

void CompleteObjectTask(const std::shared_ptr<TaskState>& task,
                        LB_FBRO_OBJECT_HANDLE object, const std::wstring& error = {}) {
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (task->status == LB_FBRO_TASK_CANCELLED) {
      if (object) EraseObjectTree(object);
      return;
    }
    task->object = object;
    task->error = error;
    task->status = object ? LB_FBRO_TASK_COMPLETED : LB_FBRO_TASK_FAILED;
  }
  if (task->callback) task->callback(task->handle, task->user_data);
}

std::shared_ptr<TaskState> CreateTask(LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = std::make_shared<TaskState>();
  task->handle = g_next_object_handle.fetch_add(1);
  task->status = LB_FBRO_TASK_RUNNING;
  task->callback = callback;
  task->user_data = user_data;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_tasks.emplace(task->handle, task);
  return task;
}

void CompleteTextTask(const std::shared_ptr<TaskState>& task, std::wstring result,
                      const std::wstring& error = {}) {
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (task->status == LB_FBRO_TASK_CANCELLED) return;
    task->result = std::move(result);
    task->error = error;
    task->status = error.empty() ? LB_FBRO_TASK_COMPLETED : LB_FBRO_TASK_FAILED;
  }
  if (task->callback) task->callback(task->handle, task->user_data);
}

void CompleteBufferTask(const std::shared_ptr<TaskState>& task, LB_FBRO_BUFFER_HANDLE buffer,
                        std::wstring result, const std::wstring& error = {}) {
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (task->status == LB_FBRO_TASK_CANCELLED) {
      if (buffer) g_buffers.erase(buffer);
      return;
    }
    task->buffer = buffer;
    task->result = std::move(result);
    task->error = error;
    task->status = buffer && error.empty() ? LB_FBRO_TASK_COMPLETED : LB_FBRO_TASK_FAILED;
  }
  if (task->callback) task->callback(task->handle, task->user_data);
}

std::wstring CookieTimeJson(const E_TIMEDATA& value) {
  return L"{\"year\":" + std::to_wstring(value.year)
      + L",\"month\":" + std::to_wstring(value.month)
      + L",\"day\":" + std::to_wstring(value.day)
      + L",\"hour\":" + std::to_wstring(value.hour)
      + L",\"minute\":" + std::to_wstring(value.minute)
      + L",\"second\":" + std::to_wstring(value.second)
      + L",\"millisecond\":" + std::to_wstring(value.millisecond) + L"}";
}

class BridgeCookieVisitor final : public FBroHsCookieVisitor {
 public:
  explicit BridgeCookieVisitor(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = CookieVisitorType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }

  void Start() override {
    json_ = L"[";
    count_ = 0;
  }
  bool Visit(POINT_COOKIEDATA cookie, int, int, bool& delete_cookie) override {
    delete_cookie = false;
    if (!cookie) return true;
    if (count_++ > 0) json_ += L",";
    json_ += L"{\"name\":\"" + JsonEscape(FromUtf8(cookie->name))
        + L"\",\"value\":\"" + JsonEscape(FromUtf8(cookie->value))
        + L"\",\"domain\":\"" + JsonEscape(FromUtf8(cookie->domain))
        + L"\",\"path\":\"" + JsonEscape(FromUtf8(cookie->path))
        + L"\",\"httpOnly\":" + std::wstring(cookie->httponly ? L"true" : L"false")
        + L",\"secure\":" + std::wstring(cookie->secure ? L"true" : L"false")
        + L",\"hasExpires\":" + std::wstring(cookie->has_expires ? L"true" : L"false")
        + L",\"sameSite\":" + std::to_wstring(cookie->same_site)
        + L",\"priority\":" + std::to_wstring(cookie->priority)
        + L",\"expires\":" + CookieTimeJson(cookie->expires_time)
        + L",\"lastAccess\":" + CookieTimeJson(cookie->last_access_time) + L"}";
    return true;
  }
  void End() override {
    json_ += L"]";
    CompleteTextTask(task_, std::move(json_));
  }

 private:
  std::shared_ptr<TaskState> task_;
  std::wstring json_ = L"[";
  int count_ = 0;
  IMPLEMENT_REFCOUNTING(BridgeCookieVisitor);
};

enum class CookieTaskOperation { VisitAll, VisitUrl, Set, Delete, Flush };

class BridgeCookieTask final : public CefTask {
 public:
  BridgeCookieTask(LB_FBRO_HANDLE browser, CookieTaskOperation operation,
                   std::vector<std::wstring> arguments, int include_http_only,
                   int secure, int http_only, std::shared_ptr<TaskState> task)
      : browser_(browser), operation_(operation), arguments_(std::move(arguments)),
        include_http_only_(include_http_only), secure_(secure), http_only_(http_only),
        task_(std::move(task)) {}

  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteTextTask(task_, L"", L"浏览器尚未创建");
      return;
    }
    auto context = FBroHsBrowserHost_GetRequestContext(browser);
    auto manager = context ? FBroHsRequestContext_GetCookieManager(context)
                           : FBroHsCookieManager_GetGlobalManager();
    if (!manager) {
      CompleteTextTask(task_, L"", L"无法取得 Cookie 管理器");
      return;
    }
    BOOL accepted = FALSE;
    if (operation_ == CookieTaskOperation::VisitAll) {
      CefRefPtr<BridgeCookieVisitor> visitor = new BridgeCookieVisitor(task_);
      accepted = FBroHsCookieManager_VisitAllCookies(manager, visitor);
    } else if (operation_ == CookieTaskOperation::VisitUrl) {
      CefRefPtr<BridgeCookieVisitor> visitor = new BridgeCookieVisitor(task_);
      accepted = FBroHsCookieManager_VisitUrlCookies(
          manager, CefString(arguments_.empty() ? L"" : arguments_[0]), include_http_only_ != 0, visitor);
    } else if (operation_ == CookieTaskOperation::Set) {
      std::string name = ToUtf8(arguments_[1]);
      std::string value = ToUtf8(arguments_[2]);
      std::string domain = ToUtf8(arguments_[3]);
      std::string path = ToUtf8(arguments_[4]);
      E_COOKIEDATA cookie{};
      cookie.name = name.empty() ? nullptr : name.data();
      cookie.value = value.empty() ? nullptr : value.data();
      cookie.domain = domain.empty() ? nullptr : domain.data();
      cookie.path = path.empty() ? nullptr : path.data();
      cookie.secure = secure_ != 0;
      cookie.httponly = http_only_ != 0;
      accepted = FBroHsCookieManager_SetCookie(manager, CefString(arguments_[0]), &cookie);
      CompleteTextTask(task_, accepted ? L"{\"accepted\":true}" : L"",
                       accepted ? L"" : L"FBro 拒绝设置 Cookie");
      return;
    } else if (operation_ == CookieTaskOperation::Delete) {
      accepted = FBroHsCookieManager_DeleteCookies(manager, CefString(arguments_[0]), CefString(arguments_[1]));
      CompleteTextTask(task_, accepted ? L"{\"accepted\":true}" : L"",
                       accepted ? L"" : L"FBro 拒绝删除 Cookie");
      return;
    } else {
      accepted = FBroHsCookieManager_FlushStore(manager);
      CompleteTextTask(task_, accepted ? L"{\"accepted\":true}" : L"",
                       accepted ? L"" : L"FBro 拒绝刷新 Cookie 存储");
      return;
    }
    if (!accepted) CompleteTextTask(task_, L"", L"FBro 拒绝启动 Cookie 遍历");
  }

 private:
  LB_FBRO_HANDLE browser_;
  CookieTaskOperation operation_;
  std::vector<std::wstring> arguments_;
  int include_http_only_;
  int secure_;
  int http_only_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeCookieTask);
};

class BridgeClearCacheCallback final : public FBroHsClearCacheCallback {
 public:
  explicit BridgeClearCacheCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = ClearCacheCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void DoFinish(bool success) override {
    CompleteTextTask(task_, success ? L"{\"success\":true}" : L"",
                     success ? L"" : L"FBro 清理缓存失败");
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeClearCacheCallback);
};

class BridgeClearCacheTask final : public CefTask {
 public:
  BridgeClearCacheTask(LB_FBRO_HANDLE browser, bool global, std::wstring origin,
                       unsigned long remove_flags, unsigned long quota_flags,
                       CefRefPtr<BridgeClearCacheCallback> callback,
                       std::shared_ptr<TaskState> task)
      : browser_(browser), global_(global), origin_(std::move(origin)),
        remove_flags_(remove_flags), quota_flags_(quota_flags),
        callback_(std::move(callback)), task_(std::move(task)) {}
  void Execute() override {
    if (global_) {
      FBroHsBrowser_ClearGlobalCacheData(CefString(origin_), remove_flags_, quota_flags_, callback_);
      return;
    }
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteTextTask(task_, L"", L"浏览器尚未创建");
      return;
    }
    FBroHsBrowser_ClearCacheData(browser, CefString(origin_), remove_flags_, quota_flags_, callback_);
  }

 private:
  LB_FBRO_HANDLE browser_;
  bool global_;
  std::wstring origin_;
  unsigned long remove_flags_;
  unsigned long quota_flags_;
  CefRefPtr<BridgeClearCacheCallback> callback_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeClearCacheTask);
};

void ScheduleManagedTask(CefRefPtr<CefTask> start, const std::shared_ptr<TaskState>& task,
                         const wchar_t* failure) {
  if (CefCurrentlyOn(TID_UI)) {
    start->Execute();
    return;
  }
  if (!CefPostTask(TID_UI, start)) CompleteTextTask(task, L"", failure);
}

struct PdfPrintOptions {
  int landscape = 0;
  int print_background = 1;
  double scale = 1.0;
  double paper_width = 0;
  double paper_height = 0;
  int prefer_css_page_size = 0;
  int margin_type = 0;
  double margin_top = 0;
  double margin_right = 0;
  double margin_bottom = 0;
  double margin_left = 0;
  std::string page_ranges;
  int display_header_footer = 0;
  std::string header_template;
  std::string footer_template;
  int generate_tagged_pdf = 0;
  int generate_document_outline = 0;
};

double ReadJsonNumber(CefRefPtr<CefDictionaryValue> value, const char* key, double fallback) {
  if (!value || !value->HasKey(key)) return fallback;
  const auto type = value->GetType(key);
  if (type == VTYPE_DOUBLE) return value->GetDouble(key);
  if (type == VTYPE_INT) return value->GetInt(key);
  return fallback;
}

int ReadJsonBool(CefRefPtr<CefDictionaryValue> value, const char* key, int fallback) {
  if (!value || !value->HasKey(key)) return fallback;
  const auto type = value->GetType(key);
  if (type == VTYPE_BOOL) return value->GetBool(key) ? 1 : 0;
  if (type == VTYPE_INT) return value->GetInt(key) != 0 ? 1 : 0;
  return fallback;
}

uint64_t ReadJsonUInt64(CefRefPtr<CefDictionaryValue> value, const char* key, uint64_t fallback = 0) {
  if (!value || !value->HasKey(key)) return fallback;
  const auto type = value->GetType(key);
  if (type == VTYPE_INT) return static_cast<uint64_t>(std::max(0, value->GetInt(key)));
  if (type == VTYPE_DOUBLE) {
    const double number = value->GetDouble(key);
    return number >= 0 ? static_cast<uint64_t>(number) : fallback;
  }
  if (type == VTYPE_STRING) {
    try { return std::stoull(value->GetString(key).ToWString()); } catch (...) { return fallback; }
  }
  return fallback;
}

std::string ReadJsonUtf8(CefRefPtr<CefDictionaryValue> value, const char* key) {
  if (!value || value->GetType(key) != VTYPE_STRING) return {};
  return ToUtf8(value->GetString(key).ToWString());
}

std::wstring ReadJsonWide(CefRefPtr<CefDictionaryValue> value, const char* key) {
  if (!value || value->GetType(key) != VTYPE_STRING) return {};
  return value->GetString(key).ToWString();
}

CefRefPtr<CefDictionaryValue> ReadJsonDictionary(CefRefPtr<CefDictionaryValue> value, const char* key) {
  return value && value->GetType(key) == VTYPE_DICTIONARY ? value->GetDictionary(key) : nullptr;
}

CefRefPtr<CefListValue> ReadJsonList(CefRefPtr<CefDictionaryValue> value, const char* key) {
  return value && value->GetType(key) == VTYPE_LIST ? value->GetList(key) : nullptr;
}

CefRefPtr<CefDictionaryValue> ParseVipArgs(const std::wstring& json, std::wstring& error) {
  if (json.empty()) return CefDictionaryValue::Create();
  auto parsed = CefParseJSON(CefString(json), JSON_PARSER_ALLOW_TRAILING_COMMAS);
  if (!parsed || parsed->GetType() != VTYPE_DICTIONARY) {
    error = L"VIP 命令参数必须是 UTF-16 JSON 对象";
    return nullptr;
  }
  return parsed->GetDictionary();
}

std::wstring NormalizeVipCommand(std::wstring command, const wchar_t* prefix) {
  if (prefix && command.rfind(prefix, 0) == 0) command.erase(0, wcslen(prefix));
  std::transform(command.begin(), command.end(), command.begin(), ::towlower);
  return command;
}

std::wstring JsonFromRawData(const void* data, size_t size) {
  if (!data || size == 0) return L"{}";
  auto parsed = CefParseJSON(data, size, JSON_PARSER_RFC);
  if (parsed) {
    const auto json = CefWriteJSON(parsed, JSON_WRITER_DEFAULT).ToWString();
    if (!json.empty()) return json;
  }
  return L"{\"raw\":\"" + JsonEscape(FromUtf8Bytes(data, size)) + L"\"}";
}

std::wstring JsonFromList(CefRefPtr<CefListValue> list) {
  if (!list) return L"[]";
  auto value = CefValue::Create();
  value->SetList(list);
  const auto json = CefWriteJSON(value, JSON_WRITER_DEFAULT).ToWString();
  return json.empty() ? L"[]" : json;
}

CefRefPtr<FBroDoubleString> CreateDoubleStringFromJson(CefRefPtr<CefDictionaryValue> value,
                                                        const char* key) {
  auto entries = ReadJsonList(value, key);
  if (!entries) return nullptr;
  auto result = FBroDoubleString_Creat();
  if (!result) return nullptr;
  for (size_t index = 0; index < entries->GetSize(); ++index) {
    if (entries->GetType(index) != VTYPE_DICTIONARY) continue;
    auto entry = entries->GetDictionary(index);
    if (!entry || entry->GetType("name") != VTYPE_STRING || entry->GetType("value") != VTYPE_STRING) continue;
    FBroDoubleString_Add(result, entry->GetString("name"), entry->GetString("value"));
  }
  return result;
}

CefRefPtr<FBroCefStringList> CreateStringListFromJson(CefRefPtr<CefDictionaryValue> value,
                                                       const char* key) {
  auto entries = ReadJsonList(value, key);
  if (!entries) return nullptr;
  auto result = FBroCefStringList_Creat();
  if (!result) return nullptr;
  for (size_t index = 0; index < entries->GetSize(); ++index) {
    if (entries->GetType(index) == VTYPE_STRING) FBroCefStringList_Add(result, entries->GetString(index));
  }
  return result;
}

std::wstring DoubleStringJson(CefRefPtr<FBroDoubleString> values) {
  std::wstring json = L"[";
  const int count = values ? FBroDoubleString_Size(values) : 0;
  if (count > 0) FBroDoubleString_ToBegin(values);
  for (int index = 0; index < count; ++index) {
    if (index > 0) json += L",";
    json += L"{\"name\":\"" + JsonEscape(FromFbroString(FBroDoubleString_GetCurrentData_Key(values)))
        + L"\",\"value\":\"" + JsonEscape(FromFbroString(FBroDoubleString_GetCurrentData_Value(values))) + L"\"}";
    if (index + 1 < count) FBroDoubleString_ToNext(values);
  }
  json += L"]";
  return json;
}

std::wstring VipUserAgentJson(CefRefPtr<FBroVIPUserAgentData> value) {
  if (!value) return L"{}";
  std::wstring json = L"{";
  json += L"\"mainUserAgent\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetMainUserAgent(value))) + L"\",";
  json += L"\"mainAcceptLanguage\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetMainAcceptLanguage(value))) + L"\",";
  json += L"\"mainPlatform\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetMainPlatform(value))) + L"\",";
  json += L"\"brands\":" + DoubleStringJson(FBroHsVIPUserAgentData_GetBrands(value)) + L",";
  json += L"\"fullVersionList\":" + DoubleStringJson(FBroHsVIPUserAgentData_GetFullVersionList(value)) + L",";
  json += L"\"fullVersion\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetFullVersion(value))) + L"\",";
  json += L"\"platform\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetPlatform(value))) + L"\",";
  json += L"\"platformVersion\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetPlatformVersion(value))) + L"\",";
  json += L"\"architecture\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetArchitecture(value))) + L"\",";
  json += L"\"model\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetModel(value))) + L"\",";
  json += L"\"mobile\":" + std::wstring(FBroHsVIPUserAgentData_GetMobile(value) ? L"true" : L"false") + L",";
  json += L"\"bitness\":\"" + JsonEscape(FromFbroString(FBroHsVIPUserAgentData_GetBitness(value))) + L"\",";
  json += L"\"wow64\":" + std::wstring(FBroHsVIPUserAgentData_GetWow64(value) ? L"true" : L"false") + L",";
  json += L"\"formFactors\":" + StringListJson(FBroHsVIPUserAgentData_GetFormFactors(value));
  json += L"}";
  return json;
}

void NotifyVipBrowser(CefRefPtr<CefBrowser> browser, int code, const std::wstring& data) {
  if (!browser) return;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  for (auto& [handle, state] : g_browsers) {
    (void)handle;
    if (state->browser && state->browser->IsSame(browser)) {
      Notify(*state, code, data);
      return;
    }
  }
}

class BridgeVipResultCallback final : public FBroHsGeneralResultCallback {
 public:
  explicit BridgeVipResultCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = GeneralResultCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Callback_Data(CefRefPtr<CefBrowser>, int message_id, bool success,
                     const void* data, size_t size) override {
    if (!success) {
      CompleteTextTask(task_, L"", L"FBro VIP 异步命令执行失败");
      return;
    }
    CompleteTextTask(task_, L"{\"messageId\":" + std::to_wstring(message_id)
        + L",\"success\":true,\"result\":" + JsonFromRawData(data, size) + L"}");
  }
  void Callback_ListData(CefRefPtr<CefBrowser>, int message_id, bool success,
                         CefRefPtr<CefListValue> list) override {
    if (!success) {
      CompleteTextTask(task_, L"", L"FBro VIP 异步命令执行失败");
      return;
    }
    CompleteTextTask(task_, L"{\"messageId\":" + std::to_wstring(message_id)
        + L",\"success\":true,\"result\":" + JsonFromList(list) + L"}");
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeVipResultCallback);
};

class BridgeDevToolsObserver final : public FBroHsDevToolsMessageObserver {
 public:
  BridgeDevToolsObserver() { type_ = DevToolsMessageObserverType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  bool OnDevToolsMessage(CefRefPtr<CefBrowser> browser, const void* message,
                         size_t message_size) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_DEVTOOLS_MESSAGE,
                     JsonFromRawData(message, message_size));
    return false;
  }
  void OnDevToolsMethodResult(CefRefPtr<CefBrowser> browser, int message_id, bool success,
                              const void* result, size_t result_size) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_DEVTOOLS_RESULT,
        L"{\"messageId\":" + std::to_wstring(message_id)
        + L",\"success\":" + std::wstring(success ? L"true" : L"false")
        + L",\"result\":" + JsonFromRawData(result, result_size) + L"}");
  }
  void OnDevToolsEvent(CefRefPtr<CefBrowser> browser, const CefString& method,
                       const void* params, size_t params_size) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_DEVTOOLS_EVENT,
        L"{\"method\":\"" + JsonEscape(method.ToWString())
        + L"\",\"params\":" + JsonFromRawData(params, params_size) + L"}");
  }
  void OnDevToolsAgentAttached(CefRefPtr<CefBrowser> browser) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_DEVTOOLS_ATTACHED, L"{}");
  }
  void OnDevToolsAgentDetached(CefRefPtr<CefBrowser> browser) override {
    NotifyVipBrowser(browser, LB_FBRO_EVENT_VIP_DEVTOOLS_DETACHED, L"{}");
  }

 private:
  IMPLEMENT_REFCOUNTING(BridgeDevToolsObserver);
};

class BridgeVipDomTask final : public CefTask {
 public:
  BridgeVipDomTask(LB_FBRO_HANDLE browser, std::wstring command, std::wstring args_json,
                   std::shared_ptr<TaskState> task)
      : browser_(browser), command_(std::move(command)), args_json_(std::move(args_json)),
        task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteTextTask(task_, L"", L"浏览器尚未创建");
      return;
    }
    std::wstring error;
    auto args = ParseVipArgs(args_json_, error);
    if (!args) {
      CompleteTextTask(task_, L"", error);
      return;
    }
    const std::wstring action = NormalizeVipCommand(command_, L"FBroHsDevToolsDOM_");
    const int node_id = static_cast<int>(ReadJsonNumber(args, "nodeId", 0));
    auto complete = [&] { CompleteTextTask(task_, L"{\"success\":true}"); };
    CefRefPtr<BridgeVipResultCallback> callback = new BridgeVipResultCallback(task_);
    if (action == L"enable") {
      FBroHsDevToolsDOM_enable(browser, ReadJsonWide(args, "includeWhitespace")); complete();
    } else if (action == L"disable") {
      FBroHsDevToolsDOM_disable(browser); complete();
    } else if (action == L"focuselement") {
      FBroHsDevToolsDOM_focusElement(browser, node_id); complete();
    } else if (action == L"removeattribute") {
      FBroHsDevToolsDOM_removeAttribute(browser, node_id, ReadJsonWide(args, "name")); complete();
    } else if (action == L"removenode") {
      FBroHsDevToolsDOM_removeNode(browser, node_id); complete();
    } else if (action == L"setattributesastext") {
      FBroHsDevToolsDOM_setAttributesAsText(browser, node_id, ReadJsonWide(args, "text"),
                                             ReadJsonWide(args, "name")); complete();
    } else if (action == L"setattributevalue") {
      FBroHsDevToolsDOM_setAttributeValue(browser, node_id, ReadJsonWide(args, "name"),
                                           ReadJsonWide(args, "value")); complete();
    } else if (action == L"setnodevalue") {
      FBroHsDevToolsDOM_setNodeValue(browser, node_id, ReadJsonWide(args, "value")); complete();
    } else if (action == L"setouterhtml") {
      FBroHsDevToolsDOM_setOuterHTML(browser, node_id, ReadJsonWide(args, "outerHTML")); complete();
    } else if (action == L"discardsearchresults") {
      FBroHsDevToolsDOM_discardSearchResults(browser, ReadJsonWide(args, "searchId")); complete();
    } else if (action == L"getdocument") {
      FBroHsDevToolsDOM_getDocument(browser, static_cast<int>(ReadJsonNumber(args, "depth", -1)),
          ReadJsonBool(args, "pierce", 0) ? TRUE : FALSE, callback, nullptr, 0);
    } else if (action == L"getattributes") {
      FBroHsDevToolsDOM_getAttributes(browser, node_id, callback, nullptr, 0);
    } else if (action == L"getouterhtml") {
      FBroHsDevToolsDOM_getOuterHTML(browser, node_id, callback, nullptr, 0);
    } else if (action == L"queryselector") {
      FBroHsDevToolsDOM_querySelector(browser, node_id, ReadJsonWide(args, "selector"), callback, nullptr, 0);
    } else if (action == L"queryselectorall") {
      FBroHsDevToolsDOM_querySelectorAll(browser, node_id, ReadJsonWide(args, "selector"), callback, nullptr, 0);
    } else if (action == L"setnodename") {
      FBroHsDevToolsDOM_setNodeName(browser, node_id, ReadJsonWide(args, "name"), callback, nullptr, 0);
    } else if (action == L"getcontainerfornode") {
      FBroHsDevToolsDOM_getContainerForNode(browser, node_id, ReadJsonWide(args, "containerName"), callback, nullptr, 0);
    } else if (action == L"performsearch") {
      FBroHsDevToolsDOM_performSearch(browser, ReadJsonWide(args, "query"),
          ReadJsonBool(args, "includeUserAgentShadowDOM", 0) ? TRUE : FALSE, callback, nullptr, 0);
    } else if (action == L"getsearchresults") {
      FBroHsDevToolsDOM_getSearchResults(browser, ReadJsonWide(args, "searchId"),
          static_cast<int>(ReadJsonNumber(args, "fromIndex", 0)),
          static_cast<int>(ReadJsonNumber(args, "toIndex", 0)), callback, nullptr, 0);
    } else {
      CompleteTextTask(task_, L"", L"未知的 FBro VIP DOM 命令");
    }
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring command_;
  std::wstring args_json_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeVipDomTask);
};

class BridgeVipExtensionTask final : public CefTask {
 public:
  BridgeVipExtensionTask(LB_FBRO_HANDLE browser, std::wstring command, std::wstring args_json,
                         std::shared_ptr<TaskState> task)
      : browser_(browser), command_(std::move(command)), args_json_(std::move(args_json)),
        task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    CefRefPtr<CefRequestContext> context;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) {
        browser = state->browser;
        context = state->request_context;
      }
    }
    if (!browser) {
      CompleteTextTask(task_, L"", L"浏览器尚未创建");
      return;
    }
    if (!context) context = FBroHsBrowserHost_GetRequestContext(browser);
    if (!context) {
      CompleteTextTask(task_, L"", L"无法取得浏览器 RequestContext");
      return;
    }
    std::wstring error;
    auto args = ParseVipArgs(args_json_, error);
    if (!args) { CompleteTextTask(task_, L"", error); return; }
    const std::wstring action = NormalizeVipCommand(command_, L"FBroHsVIPRequestContext_");
    const std::wstring extension_id = ReadJsonWide(args, "extensionId");
    if (action == L"enableextensionplus") {
      FBroHsVIPRequestContext_EnableExtensionPlus();
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"loadextension" || action == L"installcrx") {
      std::filesystem::path path;
      const bool directory = action == L"loadextension";
      if (!ResolveRuntimeAssetPath(ReadJsonWide(args, "path"), directory, path, error)) {
        CompleteTextTask(task_, L"", error); return;
      }
      if (directory) FBroHsVIPRequestContext_LoadExtension(context, path.wstring());
      else FBroHsVIPRequestContext_InstallCrx(context, path.wstring());
      CompleteTextTask(task_, L"{\"success\":true,\"path\":\"" + JsonEscape(path.wstring()) + L"\"}");
    } else if (action == L"unstallextension") {
      FBroHsVIPRequestContext_UnstallExtension(context, extension_id);
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"getextensionpath") {
      CompleteTextTask(task_, L"{\"value\":\"" + JsonEscape(FromFbroString(
          FBroHsVIPRequestContext_GetExtensionPath(context, extension_id))) + L"\"}");
    } else if (action == L"getextensionurl") {
      CompleteTextTask(task_, L"{\"value\":\"" + JsonEscape(FromFbroString(
          FBroHsVIPRequestContext_GetExtensionURL(context, extension_id))) + L"\"}");
    } else if (action == L"getextensionname") {
      CompleteTextTask(task_, L"{\"value\":\"" + JsonEscape(FromFbroString(
          FBroHsVIPRequestContext_GetExtensionName(context, extension_id))) + L"\"}");
    } else {
      CompleteTextTask(task_, L"", L"未知的 FBro VIP 扩展命令");
    }
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring command_;
  std::wstring args_json_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeVipExtensionTask);
};

class BridgeVipResourceTask final : public CefTask {
 public:
  BridgeVipResourceTask(LB_FBRO_HANDLE browser, std::wstring command, std::wstring args_json,
                        std::shared_ptr<TaskState> task)
      : browser_(browser), command_(std::move(command)), args_json_(std::move(args_json)),
        task_(std::move(task)) {}
  void Execute() override {
    std::wstring error;
    auto args = ParseVipArgs(args_json_, error);
    if (!args) { CompleteTextTask(task_, L"", error); return; }
    if (!g_license_valid) {
      CompleteTextTask(task_, L"", L"资源规则需要有效的 FBro VIP Key");
      return;
    }
    const bool global = ReadJsonBool(args, "global", 0) != 0;
    CefRefPtr<FBroVIPControl> vip;
    if (!global) {
      CefRefPtr<CefBrowser> browser;
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        if (auto* state = Find(browser_)) browser = state->browser;
      }
      if (!browser) { CompleteTextTask(task_, L"", L"浏览器尚未创建"); return; }
      vip = FBroHsBrowser_GetVIPControl(browser);
      if (!vip || FBroHsVIPControl_IsNULL(vip)) {
        CompleteTextTask(task_, L"", L"当前浏览器没有可用的 VIP 控制器"); return;
      }
    }
    const std::wstring action = NormalizeVipCommand(command_, nullptr);
    const std::wstring url = ReadJsonWide(args, "url");
    const int find_type = static_cast<int>(ReadJsonNumber(args, "findType", 0));
    const std::wstring resource_key = L"resource|" + url;
    const std::wstring response_key = L"response|" + url;
    auto store_payload = [&](const std::wstring& key, const std::shared_ptr<VipResourcePayload>& payload) {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (global) g_global_vip_resource_payloads[key] = payload;
      else if (auto* state = Find(browser_)) state->vip_resource_payloads[key] = payload;
    };
    auto erase_payload = [&](const std::wstring& key) {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (global) g_global_vip_resource_payloads.erase(key);
      else if (auto* state = Find(browser_)) state->vip_resource_payloads.erase(key);
    };
    auto clear_payloads = [&](const std::wstring& prefix) {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      auto clear_matching = [&](auto& values) {
        for (auto iterator = values.begin(); iterator != values.end();) {
          if (iterator->first.rfind(prefix, 0) == 0) iterator = values.erase(iterator);
          else ++iterator;
        }
      };
      if (global) clear_matching(g_global_vip_resource_payloads);
      else if (auto* state = Find(browser_)) clear_matching(state->vip_resource_payloads);
    };
    if (action == L"addresourcedata") {
      int status = LB_FBRO_OK;
      auto buffer = GetBuffer(ReadJsonUInt64(args, "bufferHandle"), status);
      if (!buffer || buffer->bytes.empty()) {
        CompleteTextTask(task_, L"", L"资源替换需要有效的非空受管缓冲句柄"); return;
      }
      auto payload = std::make_shared<VipResourcePayload>();
      payload->bytes = buffer->bytes;
      payload->headers = CreateDoubleStringFromJson(args, "headers");
      if (global) {
        FBroHsVIPResourceHandler_AddChangeData(find_type, url, ReadJsonWide(args, "mimeType"),
            payload->headers, payload->bytes.data(), payload->bytes.size());
      } else {
        FBroHsVIPControl_AddResourceHandlerChangeData(vip, find_type, url, ReadJsonWide(args, "mimeType"),
            payload->headers, payload->bytes.data(), payload->bytes.size());
      }
      store_payload(resource_key, payload);
      CompleteTextTask(task_, L"{\"success\":true,\"bytes\":" + std::to_wstring(payload->bytes.size()) + L"}");
    } else if (action == L"addresourcefile") {
      std::filesystem::path path;
      if (!ResolveRuntimeAssetPath(ReadJsonWide(args, "path"), false, path, error)) {
        CompleteTextTask(task_, L"", error); return;
      }
      auto payload = std::make_shared<VipResourcePayload>();
      payload->headers = CreateDoubleStringFromJson(args, "headers");
      if (global) FBroHsVIPResourceHandler_AddChangeFile(find_type, url, ReadJsonWide(args, "mimeType"), payload->headers, path.wstring());
      else FBroHsVIPControl_AddResourceHandlerChangeFile(vip, find_type, url, ReadJsonWide(args, "mimeType"), payload->headers, path.wstring());
      store_payload(resource_key, payload);
      CompleteTextTask(task_, L"{\"success\":true,\"path\":\"" + JsonEscape(path.wstring()) + L"\"}");
    } else if (action == L"deleteresource") {
      if (global) FBroHsVIPResourceHandler_DeleteChangeData(url);
      else FBroHsVIPControl_DeleteResourceHandlerChangeData(vip, url);
      erase_payload(resource_key);
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"clearresources") {
      if (global) FBroHsVIPResourceHandler_DeleteAllData();
      else FBroHsVIPControl_DeleteResourceHandlerAllData(vip);
      clear_payloads(L"resource|");
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"addresponsefilter") {
      if (global) {
        FBroHsVIPResponseFilter_AddChangeData(find_type, url,
            static_cast<int>(ReadJsonNumber(args, "changeType", 0)),
            ReadJsonWide(args, "key"), ReadJsonWide(args, "data"));
      } else {
        FBroHsVIPControl_AddResponseFilterChangeData(vip, find_type, url,
            static_cast<int>(ReadJsonNumber(args, "changeType", 0)),
            ReadJsonWide(args, "key"), ReadJsonWide(args, "data"));
      }
      store_payload(response_key, std::make_shared<VipResourcePayload>());
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"deleteresponsefilter") {
      if (global) FBroHsVIPResponseFilter_DeleteChangeData(url);
      else FBroHsVIPControl_DeletResponseFiltereChangeData(vip, url);
      erase_payload(response_key);
      CompleteTextTask(task_, L"{\"success\":true}");
    } else if (action == L"clearresponsefilters") {
      if (global) FBroHsVIPResponseFilter_DeleteAllData();
      else FBroHsVIPControl_DeleteResponseFilterAllData(vip);
      clear_payloads(L"response|");
      CompleteTextTask(task_, L"{\"success\":true}");
    } else {
      CompleteTextTask(task_, L"", L"未知的 FBro VIP 资源规则命令");
    }
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring command_;
  std::wstring args_json_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeVipResourceTask);
};

class BridgeVipDevToolsTask final : public CefTask {
 public:
  BridgeVipDevToolsTask(LB_FBRO_HANDLE browser, std::wstring command, std::wstring args_json,
                        std::shared_ptr<TaskState> task)
      : browser_(browser), command_(std::move(command)), args_json_(std::move(args_json)),
        task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    CefRefPtr<FBroHsBroEvent> browser_event;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) {
        browser = state->browser;
        browser_event = state->event;
      }
    }
    if (!browser) { CompleteTextTask(task_, L"", L"浏览器尚未创建"); return; }
    auto vip = FBroHsBrowser_GetVIPControl(browser);
    if (!vip || FBroHsVIPControl_IsNULL(vip)) {
      CompleteTextTask(task_, L"", L"当前浏览器没有可用的 VIP 控制器"); return;
    }
    std::wstring error;
    auto args = ParseVipArgs(args_json_, error);
    if (!args) { CompleteTextTask(task_, L"", error); return; }
    const std::wstring action = NormalizeVipCommand(command_, L"FBroHsVIPControl_");
    auto complete = [&] { CompleteTextTask(task_, L"{\"success\":true}"); };
    CefRefPtr<BridgeVipResultCallback> callback = new BridgeVipResultCallback(task_);
    if (action == L"senddevtoolsmessage") {
      FBroHsVIPControl_SendDevToolsMessage(vip, ReadJsonWide(args, "message")); complete();
    } else if (action == L"executedevtoolsmethod") {
      auto params = ReadJsonDictionary(args, "params");
      FBroHsVIPControl_ExecuteDevToolsMethod(vip,
          static_cast<int>(ReadJsonNumber(args, "messageId", 1)), ReadJsonWide(args, "method"),
          params ? params->Copy(false) : CefDictionaryValue::Create()); complete();
    } else if (action == L"adddevtoolsmessageobserver") {
      CefRefPtr<BridgeDevToolsObserver> observer = new BridgeDevToolsObserver();
      if (!FBroHsVIPControl_AddDevToolsMessageObserver(vip, observer)) {
        CompleteTextTask(task_, L"", L"FBro 拒绝注册 DevTools 消息观察器"); return;
      }
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        if (auto* state = Find(browser_)) state->devtools_observer = observer;
      }
      complete();
    } else if (action == L"deletedevtoolsmessageobserver") {
      const BOOL removed = FBroHsVIPControl_DeleteDevToolsMessageObserver(vip);
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        if (auto* state = Find(browser_)) state->devtools_observer = nullptr;
      }
      if (removed) complete(); else CompleteTextTask(task_, L"", L"FBro 未删除 DevTools 消息观察器");
    } else if (action == L"runtimeenable") {
      FBroHsVIPControl_RuntimeEnable(vip, ReadJsonBool(args, "enabled", 1) ? TRUE : FALSE); complete();
    } else if (action == L"pagegetcontextid") {
      CompleteTextTask(task_, L"{\"success\":true,\"result\":"
          + JsonFromList(FBroHsVIPControl_PageGetContextID(vip)) + L"}");
    } else if (action == L"runtimeevaluate") {
      FBroHsVIPControl_RuntimeEvaluate(vip, ReadJsonWide(args, "expression"),
          ReadJsonBool(args, "includeCommandLineAPI", 0) ? TRUE : FALSE,
          static_cast<int>(ReadJsonNumber(args, "contextId", 0)),
          ReadJsonBool(args, "silent", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "userGesture", 0) ? TRUE : FALSE,
          std::clamp(static_cast<int>(ReadJsonNumber(args, "timeout", 30000)), 0, 600000),
          ReadJsonBool(args, "disableBreaks", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "replMode", 0) ? TRUE : FALSE, callback, nullptr, 0);
    } else if (action == L"runtimeevaluate_frameid") {
      FBroHsVIPControl_RuntimeEvaluate_FrameID(vip, ReadJsonWide(args, "expression"),
          ReadJsonBool(args, "includeCommandLineAPI", 0) ? TRUE : FALSE,
          static_cast<int>(ReadJsonNumber(args, "type", 0)),
          static_cast<int>(ReadJsonNumber(args, "frameNumber", 0)), ReadJsonWide(args, "frameId"),
          ReadJsonBool(args, "silent", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "userGesture", 0) ? TRUE : FALSE,
          std::clamp(static_cast<int>(ReadJsonNumber(args, "timeout", 30000)), 0, 600000),
          ReadJsonBool(args, "disableBreaks", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "replMode", 0) ? TRUE : FALSE, callback, nullptr, 0);
    } else if (action == L"dispatchtouchevent") {
      auto points_json = ReadJsonList(args, "touchPoints");
      std::vector<E_DEV_TOUCHPOINT> points;
      if (points_json) {
        points.reserve(std::min<size_t>(points_json->GetSize(), 16));
        for (size_t index = 0; index < points_json->GetSize() && index < 16; ++index) {
          if (points_json->GetType(index) != VTYPE_DICTIONARY) continue;
          auto point = points_json->GetDictionary(index);
          E_DEV_TOUCHPOINT value{};
          value.x = static_cast<int>(ReadJsonNumber(point, "x", 0));
          value.y = static_cast<int>(ReadJsonNumber(point, "y", 0));
          value.radiusX = static_cast<int>(ReadJsonNumber(point, "radiusX", 1));
          value.radiusY = static_cast<int>(ReadJsonNumber(point, "radiusY", 1));
          value.rotationAngle = static_cast<int>(ReadJsonNumber(point, "rotationAngle", 0));
          value.force = static_cast<int>(ReadJsonNumber(point, "force", 1));
          value.id = static_cast<int>(ReadJsonNumber(point, "id", static_cast<double>(index)));
          points.push_back(value);
        }
      }
      FBroHsVIPControl_DispatchTouchEvent(vip,
          static_cast<int>(ReadJsonNumber(args, "type", 0)), points.empty() ? nullptr : points.data(),
          static_cast<int>(ReadJsonNumber(args, "modifiers", 0))); complete();
    } else if (action == L"dispatchkeyevent") {
      FBroHsVIPControl_DispatchKeyEvent(vip, ReadJsonWide(args, "type"),
          static_cast<int>(ReadJsonNumber(args, "modifiers", 0)), ReadJsonWide(args, "text"),
          ReadJsonWide(args, "unmodifiedText"), ReadJsonWide(args, "keyIdentifier"),
          ReadJsonWide(args, "code"), ReadJsonWide(args, "key"),
          static_cast<int>(ReadJsonNumber(args, "windowsVirtualKeyCode", 0)),
          static_cast<int>(ReadJsonNumber(args, "nativeVirtualKeyCode", 0)),
          ReadJsonBool(args, "autoRepeat", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "isKeypad", 0) ? TRUE : FALSE,
          ReadJsonBool(args, "isSystemKey", 0) ? TRUE : FALSE,
          static_cast<int>(ReadJsonNumber(args, "location", 0))); complete();
    } else if (action == L"dispatchmouseevent") {
      FBroHsVIPControl_DispatchMouseEvent(vip, ReadJsonWide(args, "type"),
          static_cast<int>(ReadJsonNumber(args, "x", 0)),
          static_cast<int>(ReadJsonNumber(args, "y", 0)),
          static_cast<int>(ReadJsonNumber(args, "modifiers", 0)), ReadJsonWide(args, "button"),
          static_cast<int>(ReadJsonNumber(args, "buttons", 0)),
          static_cast<int>(ReadJsonNumber(args, "clickCount", 1)),
          static_cast<int>(ReadJsonNumber(args, "deltaX", 0)),
          static_cast<int>(ReadJsonNumber(args, "deltaY", 0)), ReadJsonWide(args, "pointerType")); complete();
    } else if (action == L"addtabat") {
      auto extra = ReadJsonDictionary(args, "extraInfo");
      Event_Disable_Control event_control{};
      FBroHsVIPControl_AddTabAt(vip, ReadJsonWide(args, "url"),
          static_cast<int>(ReadJsonNumber(args, "index", -1)),
          ReadJsonBool(args, "foreground", 1) ? TRUE : FALSE,
          extra ? extra->Copy(false) : CefDictionaryValue::Create(), browser_event, &event_control,
          ReadJsonWide(args, "userFlag")); complete();
    } else {
      CompleteTextTask(task_, L"", L"未知的 FBro VIP DevTools/输入命令");
    }
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring command_;
  std::wstring args_json_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeVipDevToolsTask);
};

bool ParsePdfPrintOptions(const wchar_t* json, PdfPrintOptions& options, std::wstring& error) {
  if (!json || !*json) return true;
  auto parsed = CefParseJSON(CefString(json), JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_DICTIONARY) {
    error = L"PDF 设置必须是 UTF-16 JSON 对象";
    return false;
  }
  auto value = parsed->GetDictionary();
  options.landscape = ReadJsonBool(value, "landscape", options.landscape);
  options.print_background = ReadJsonBool(value, "printBackground", options.print_background);
  options.scale = ReadJsonNumber(value, "scale", options.scale);
  options.paper_width = ReadJsonNumber(value, "paperWidth", options.paper_width);
  options.paper_height = ReadJsonNumber(value, "paperHeight", options.paper_height);
  options.prefer_css_page_size = ReadJsonBool(value, "preferCssPageSize", options.prefer_css_page_size);
  options.margin_type = static_cast<int>(ReadJsonNumber(value, "marginType", options.margin_type));
  options.margin_top = ReadJsonNumber(value, "marginTop", options.margin_top);
  options.margin_right = ReadJsonNumber(value, "marginRight", options.margin_right);
  options.margin_bottom = ReadJsonNumber(value, "marginBottom", options.margin_bottom);
  options.margin_left = ReadJsonNumber(value, "marginLeft", options.margin_left);
  options.page_ranges = ReadJsonUtf8(value, "pageRanges");
  options.display_header_footer = ReadJsonBool(value, "displayHeaderFooter", options.display_header_footer);
  options.header_template = ReadJsonUtf8(value, "headerTemplate");
  options.footer_template = ReadJsonUtf8(value, "footerTemplate");
  options.generate_tagged_pdf = ReadJsonBool(value, "generateTaggedPdf", options.generate_tagged_pdf);
  options.generate_document_outline = ReadJsonBool(value, "generateDocumentOutline", options.generate_document_outline);
  if (options.scale < 0 || options.scale > 2 || options.paper_width < 0 || options.paper_height < 0
      || options.margin_type < 0 || options.margin_type > 2) {
    error = L"PDF 设置中的缩放、纸张尺寸或边距类型超出允许范围";
    return false;
  }
  return true;
}

bool ParseStringArray(const wchar_t* json, std::vector<std::wstring>& values, std::wstring& error) {
  if (!json || !*json) return true;
  auto parsed = CefParseJSON(CefString(json), JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_LIST) {
    error = L"文件筛选器必须是 UTF-16 JSON 字符串数组";
    return false;
  }
  auto list = parsed->GetList();
  if (!list || list->GetSize() > 64) {
    error = L"文件筛选器数量不能超过 64 项";
    return false;
  }
  for (size_t index = 0; index < list->GetSize(); ++index) {
    if (list->GetType(index) != VTYPE_STRING) {
      error = L"文件筛选器只能包含文本";
      return false;
    }
    values.push_back(list->GetString(index).ToWString());
  }
  return true;
}

class BridgePdfPrintCallback final : public FBroHsPdfPrintCallback {
 public:
  explicit BridgePdfPrintCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = PdfPrintCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void OnPdfPrintFinished(const CefString& path, bool ok) override {
    const std::wstring output = path.ToWString();
    CompleteTextTask(task_, ok ? L"{\"success\":true,\"path\":\"" + JsonEscape(output) + L"\"}" : L"",
                     ok ? L"" : L"FBro 生成 PDF 失败：" + output);
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgePdfPrintCallback);
};

class BridgePdfPrintTask final : public CefTask {
 public:
  BridgePdfPrintTask(LB_FBRO_HANDLE browser, std::wstring path, PdfPrintOptions options,
                     CefRefPtr<BridgePdfPrintCallback> callback, std::shared_ptr<TaskState> task)
      : browser_(browser), path_(std::move(path)), options_(std::move(options)),
        callback_(std::move(callback)), task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteTextTask(task_, L"", L"浏览器尚未创建");
      return;
    }
    FBroPdfPrintSettings settings{};
    settings.landscape = options_.landscape;
    settings.print_background = options_.print_background;
    settings.scale = options_.scale;
    settings.paper_width = options_.paper_width;
    settings.paper_height = options_.paper_height;
    settings.prefer_css_page_size = options_.prefer_css_page_size;
    settings.margin_type = options_.margin_type;
    settings.margin_top = options_.margin_top;
    settings.margin_right = options_.margin_right;
    settings.margin_bottom = options_.margin_bottom;
    settings.margin_left = options_.margin_left;
    settings.page_ranges = options_.page_ranges.empty() ? nullptr : options_.page_ranges.data();
    settings.display_header_footer = options_.display_header_footer;
    settings.header_template = options_.header_template.empty() ? nullptr : options_.header_template.data();
    settings.footer_template = options_.footer_template.empty() ? nullptr : options_.footer_template.data();
    settings.generate_tagged_pdf = options_.generate_tagged_pdf;
    settings.generate_document_outline = options_.generate_document_outline;
    FBroHsBrowserHost_PrintToPDF(browser, CefString(path_), &settings, callback_);
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring path_;
  PdfPrintOptions options_;
  CefRefPtr<BridgePdfPrintCallback> callback_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgePdfPrintTask);
};

std::pair<std::wstring, std::wstring> NormalizeDialogFilter(const std::wstring& raw, size_t index) {
  const size_t separator = raw.find(L'|');
  std::wstring name = separator == std::wstring::npos ? L"文件类型 " + std::to_wstring(index + 1)
                                                       : raw.substr(0, separator);
  std::wstring pattern = separator == std::wstring::npos ? raw : raw.substr(separator + 1);
  if (name.empty()) name = L"文件类型 " + std::to_wstring(index + 1);
  if (pattern.empty() || pattern.find(L'/') != std::wstring::npos) pattern = L"*.*";
  std::wstringstream input(pattern);
  std::wstring part;
  pattern.clear();
  while (std::getline(input, part, L';')) {
    if (part.empty()) continue;
    if (part.front() == L'.') part.insert(part.begin(), L'*');
    else if (part.find_first_of(L"*?") == std::wstring::npos) part = L"*." + part;
    if (!pattern.empty()) pattern += L';';
    pattern += part;
  }
  return {std::move(name), pattern.empty() ? L"*.*" : std::move(pattern)};
}

void RunWindowsFileDialog(const std::shared_ptr<TaskState>& task, HWND owner, int mode,
                          std::wstring title, std::wstring default_path,
                          std::vector<std::wstring> raw_filters) {
  const HRESULT initialize = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  if (FAILED(initialize) && initialize != RPC_E_CHANGED_MODE) {
    CompleteTextTask(task, L"", L"无法初始化文件对话框 COM 环境");
    return;
  }
  IFileDialog* dialog = nullptr;
  const HRESULT created = mode == FILE_DIALOG_SAVE
      ? CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog))
      : CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
  if (FAILED(created) || !dialog) {
    if (SUCCEEDED(initialize)) CoUninitialize();
    CompleteTextTask(task, L"", L"无法创建 Windows 文件对话框");
    return;
  }
  if (!title.empty()) dialog->SetTitle(title.c_str());
  FILEOPENDIALOGOPTIONS options = FOS_FORCEFILESYSTEM | FOS_NOCHANGEDIR;
  if (mode == FILE_DIALOG_SAVE) options |= FOS_OVERWRITEPROMPT;
  else options |= FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST;
  if (mode == FILE_DIALOG_OPEN_MULTIPLE) options |= FOS_ALLOWMULTISELECT;
  if (mode == FILE_DIALOG_OPEN_FOLDER) options |= FOS_PICKFOLDERS;
  dialog->SetOptions(options);

  std::vector<std::wstring> filter_names;
  std::vector<std::wstring> filter_patterns;
  filter_names.reserve(raw_filters.size());
  filter_patterns.reserve(raw_filters.size());
  for (size_t index = 0; index < raw_filters.size(); ++index) {
    auto normalized = NormalizeDialogFilter(raw_filters[index], index);
    filter_names.push_back(std::move(normalized.first));
    filter_patterns.push_back(std::move(normalized.second));
  }
  std::vector<COMDLG_FILTERSPEC> filter_specs;
  filter_specs.reserve(filter_names.size());
  for (size_t index = 0; index < filter_names.size(); ++index) {
    filter_specs.push_back({filter_names[index].c_str(), filter_patterns[index].c_str()});
  }
  if (!filter_specs.empty()) dialog->SetFileTypes(static_cast<UINT>(filter_specs.size()), filter_specs.data());

  if (!default_path.empty()) {
    std::filesystem::path requested(default_path);
    std::error_code path_error;
    const bool directory = std::filesystem::is_directory(requested, path_error);
    const auto folder_path = directory ? requested : requested.parent_path();
    if (!folder_path.empty()) {
      IShellItem* folder = nullptr;
      if (SUCCEEDED(SHCreateItemFromParsingName(folder_path.c_str(), nullptr, IID_PPV_ARGS(&folder)))) {
        dialog->SetFolder(folder);
        folder->Release();
      }
    }
    if (!directory && !requested.filename().empty()) dialog->SetFileName(requested.filename().c_str());
  }

  // The dialog owns a dedicated STA thread. Do not use the browser host HWND as
  // owner because callers may synchronously query the task from that HWND's UI
  // thread; cross-thread owner activation would otherwise deadlock Show().
  const HRESULT shown = dialog->Show(nullptr);
  if (shown == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
    CompleteTextTask(task, L"{\"cancelled\":true,\"paths\":[]}");
  } else if (FAILED(shown)) {
    CompleteTextTask(task, L"", L"Windows 文件对话框打开失败");
  } else {
    std::vector<std::wstring> paths;
    IFileOpenDialog* open_dialog = nullptr;
    if (mode == FILE_DIALOG_OPEN_MULTIPLE
        && SUCCEEDED(dialog->QueryInterface(IID_PPV_ARGS(&open_dialog)))) {
      IShellItemArray* results = nullptr;
      if (SUCCEEDED(open_dialog->GetResults(&results)) && results) {
        DWORD count = 0;
        results->GetCount(&count);
        for (DWORD index = 0; index < count; ++index) {
          IShellItem* item = nullptr;
          PWSTR path = nullptr;
          if (SUCCEEDED(results->GetItemAt(index, &item)) && item
              && SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
            paths.emplace_back(path);
          }
          if (path) CoTaskMemFree(path);
          if (item) item->Release();
        }
        results->Release();
      }
      open_dialog->Release();
    } else {
      IShellItem* result = nullptr;
      PWSTR path = nullptr;
      if (SUCCEEDED(dialog->GetResult(&result)) && result
          && SUCCEEDED(result->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
        paths.emplace_back(path);
      }
      if (path) CoTaskMemFree(path);
      if (result) result->Release();
    }
    std::wstring json = L"{\"cancelled\":false,\"paths\":[";
    for (size_t index = 0; index < paths.size(); ++index) {
      if (index > 0) json += L',';
      json += L"\"" + JsonEscape(paths[index]) + L"\"";
    }
    CompleteTextTask(task, json + L"]}");
  }
  dialog->Release();
  if (SUCCEEDED(initialize)) CoUninitialize();
}

class BridgeScreenshotCallback final : public FBroHsGeneralResultCallback {
 public:
  BridgeScreenshotCallback(std::shared_ptr<TaskState> task, std::wstring format)
      : task_(std::move(task)), format_(std::move(format)) { type_ = GeneralResultCallbackType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Callback_Data(CefRefPtr<CefBrowser>, int, bool success, const void* data, size_t size) override {
    if (!success || !data || size == 0) {
      CompleteBufferTask(task_, 0, L"", L"FBro 截图调用失败");
      return;
    }
    auto parsed = CefParseJSON(data, size, JSON_PARSER_RFC);
    CefRefPtr<CefDictionaryValue> dictionary = parsed && parsed->GetType() == VTYPE_DICTIONARY
        ? parsed->GetDictionary() : nullptr;
    CefString encoded;
    if (dictionary && dictionary->GetType("data") == VTYPE_STRING) encoded = dictionary->GetString("data");
    if (encoded.empty() && dictionary && dictionary->GetType("result") == VTYPE_DICTIONARY) {
      auto result = dictionary->GetDictionary("result");
      if (result && result->GetType("data") == VTYPE_STRING) encoded = result->GetString("data");
    }
    auto binary = encoded.empty() ? nullptr : CefBase64Decode(encoded);
    const auto buffer = RegisterBinaryBuffer(binary);
    if (!buffer) {
      CompleteBufferTask(task_, 0, L"", L"FBro 截图响应不包含有效的 Base64 图像数据");
      return;
    }
    int status = LB_FBRO_OK;
    auto stored = GetBuffer(buffer, status);
    const uint64_t bytes = stored ? static_cast<uint64_t>(stored->bytes.size()) : 0;
    CompleteBufferTask(task_, buffer, L"{\"format\":\"" + JsonEscape(format_)
        + L"\",\"bytes\":" + std::to_wstring(bytes) + L"}");
  }
  void Callback_ListData(CefRefPtr<CefBrowser>, int, bool, CefRefPtr<CefListValue>) override {
    CompleteBufferTask(task_, 0, L"", L"FBro 截图返回了不支持的列表结果");
  }

 private:
  std::shared_ptr<TaskState> task_;
  std::wstring format_;
  IMPLEMENT_REFCOUNTING(BridgeScreenshotCallback);
};

class BridgeScreenshotTask final : public CefTask {
 public:
  BridgeScreenshotTask(LB_FBRO_HANDLE browser, std::wstring format, int quality,
                       int x, int y, int width, int height, int scale,
                       int from_surface, int capture_beyond_viewport,
                       CefRefPtr<BridgeScreenshotCallback> callback, std::shared_ptr<TaskState> task)
      : browser_(browser), format_(std::move(format)), quality_(quality), x_(x), y_(y),
        width_(width), height_(height), scale_(scale), from_surface_(from_surface),
        capture_beyond_viewport_(capture_beyond_viewport), callback_(std::move(callback)),
        task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteBufferTask(task_, 0, L"", L"浏览器尚未创建");
      return;
    }
    if (!g_license_valid) {
      const std::wstring detail = g_license_attempted && !g_license_error.empty()
          ? L"：" + g_license_error : L"；请配置 LINGBUILDER_FBRO_VIP_KEY";
      CompleteBufferTask(task_, 0, L"", L"FBro 截图需要有效 VIP Key" + detail);
      return;
    }
    auto vip = FBroHsBrowser_GetVIPControl(browser);
    if (!vip || FBroHsVIPControl_IsNULL(vip)) {
      CompleteBufferTask(task_, 0, L"", L"当前浏览器没有可用的 VIP 控制器");
      return;
    }
    VIEWPORT viewport{};
    viewport.x = x_;
    viewport.y = y_;
    viewport.width = width_;
    viewport.height = height_;
    viewport.scale = scale_;
    VIEWPORT_POINT viewport_pointer = width_ > 0 && height_ > 0 ? &viewport : nullptr;
    FBroHsVIPControl_PageCaptureScreenshot(vip, CefString(format_), quality_, viewport_pointer,
                                           from_surface_ != 0, capture_beyond_viewport_ != 0,
                                           callback_, nullptr, 0);
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring format_;
  int quality_;
  int x_;
  int y_;
  int width_;
  int height_;
  int scale_;
  int from_surface_;
  int capture_beyond_viewport_;
  CefRefPtr<BridgeScreenshotCallback> callback_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeScreenshotTask);
};

class BridgeDownloadImageCallback final : public FBroHsDownloadImageCallback {
 public:
  explicit BridgeDownloadImageCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = DownloadImageCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }

  void OnDownloadImageFinished(const CefString& image_url, int http_status_code,
                               CefRefPtr<CefImage> image) override {
    if (!image || FBroHsImage_IsEmpty(image)) {
      CompleteObjectTask(task_, 0, L"图像下载失败：HTTP " + std::to_wstring(http_status_code)
          + L"，地址 " + image_url.ToWString());
      return;
    }
    CompleteObjectTask(task_, RegisterImage(image));
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeDownloadImageCallback);
};

class BridgeStartImageDownloadTask final : public CefTask {
 public:
  BridgeStartImageDownloadTask(LB_FBRO_HANDLE browser, std::wstring url, bool is_favicon,
                               uint32_t max_image_size, bool bypass_cache,
                               CefRefPtr<BridgeDownloadImageCallback> callback,
                               std::shared_ptr<TaskState> task)
      : browser_(browser), url_(std::move(url)), is_favicon_(is_favicon),
        max_image_size_(max_image_size), bypass_cache_(bypass_cache),
        callback_(std::move(callback)), task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteObjectTask(task_, 0, L"浏览器尚未创建");
      return;
    }
    FBroHsBrowserHost_DownloadImage(browser, CefString(url_), is_favicon_, max_image_size_,
                                    bypass_cache_, callback_);
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::wstring url_;
  bool is_favicon_;
  uint32_t max_image_size_;
  bool bypass_cache_;
  CefRefPtr<BridgeDownloadImageCallback> callback_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeStartImageDownloadTask);
};

class BridgeCurrentCertificateTask final : public CefTask {
 public:
  BridgeCurrentCertificateTask(LB_FBRO_HANDLE browser, std::shared_ptr<TaskState> task)
      : browser_(browser), task_(std::move(task)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser || !browser->GetHost()) {
      CompleteObjectTask(task_, 0, L"浏览器尚未创建");
      return;
    }
    auto entry = browser->GetHost()->GetVisibleNavigationEntry();
    auto ssl_status = entry ? entry->GetSSLStatus() : nullptr;
    auto certificate = ssl_status ? ssl_status->GetX509Certificate() : nullptr;
    CompleteObjectTask(task_, RegisterCertificate(certificate),
                       certificate ? L"" : L"当前页面没有可读取的 TLS 证书");
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeCurrentCertificateTask);
};

}  // namespace

uint32_t __stdcall LB_FBro_GetAbiVersion(void) { return LB_FBRO_ABI_VERSION_V3; }

int __stdcall LB_FBro_SetVipStartupProxy(const wchar_t* url,
                                         const wchar_t* user,
                                         const wchar_t* password) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  if (g_initialized) return LB_FBRO_ERROR_OPERATION_FAILED;
  if (!g_vip_proxy_password.empty()) {
    SecureZeroMemory(g_vip_proxy_password.data(),
                     g_vip_proxy_password.size() * sizeof(wchar_t));
  }
  g_vip_proxy_url = url ? url : L"";
  g_vip_proxy_user = user ? user : L"";
  g_vip_proxy_password = password ? password : L"";
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_Initialize(const wchar_t* runtime_directory) {
  if (g_initialized) return 1;
  if (!runtime_directory || !*runtime_directory) return -1;
  g_shutdown_started = false;
  g_license_attempted = false;
  g_license_valid = false;
  g_license_error.clear();
  g_runtime_directory = runtime_directory;
  g_root_cache_directory = AbsoluteNormalizedPath(g_runtime_directory / L".fbro-global-cache");
  std::error_code cache_error;
  std::filesystem::create_directories(g_root_cache_directory, cache_error);
  WSADATA winsock{};
  if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) return -3;
  g_winsock_started = true;
  const auto subprocess = g_runtime_directory / L"FBroSubprocess.exe";
  const auto cache = g_root_cache_directory;
  const auto log = g_runtime_directory / L"fbro.log";
  const auto locales = g_runtime_directory / L"locales";
  const std::string runtime_ansi = ToAnsi(g_runtime_directory.wstring());
  const std::string subprocess_ansi = ToAnsi(subprocess.wstring());
  const std::string cache_ansi = ToAnsi(cache.wstring());
  const std::string log_ansi = ToAnsi(log.wstring());
  const std::string locales_ansi = ToAnsi(locales.wstring());
  wchar_t proxy_url[4096]{};
  wchar_t proxy_user[4096]{};
  wchar_t proxy_password[4096]{};
  if (GetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_PROXY_URL", proxy_url, 4096) > 0) {
    g_vip_proxy_url = proxy_url;
    GetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_PROXY_USER", proxy_user, 4096);
    GetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_PROXY_PASSWORD", proxy_password, 4096);
    g_vip_proxy_user = proxy_user;
    g_vip_proxy_password = proxy_password;
  }
  SecureZeroMemory(proxy_password, sizeof(proxy_password));
  // DPI awareness is owned by the generated host and must be set before it creates any HWND.
  FBroSetV8DefaultsHeapSize(4, 2048);
  wchar_t vip_key[4096]{};
  if (GetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_KEY", vip_key, 4096) > 0) {
    g_license_attempted = true;
    FBroHsBrowser_SetLicenceKey(CefString(vip_key));
    const BOOL license_result = FBroHsOnlineLicenseControl_SetKey(CefString(vip_key));
    g_license_valid = license_result == TRUE;
    if (!g_license_valid) {
      g_license_error = FromFbroString(FBroHsOnlineLicenseControl_GetError());
      const std::wstring supplied_key(vip_key);
      if (!supplied_key.empty()) {
        size_t position = 0;
        while ((position = g_license_error.find(supplied_key, position)) != std::wstring::npos) {
          g_license_error.replace(position, supplied_key.size(), L"[已隐藏]");
          position += 5;
        }
      }
      if (g_license_error.empty()) g_license_error = L"授权服务拒绝了该 VIP Key";
    }
    SecureZeroMemory(vip_key, sizeof(vip_key));
  }
  FBroInitSettings settings{};
  settings.no_sandbox = TRUE;
  settings.browser_subprocess_path = const_cast<char*>(subprocess_ansi.c_str());
  settings.multi_threaded_message_loop = TRUE;
  settings.external_message_pump = FALSE;
  settings.windowless_rendering_enabled = FALSE;
  settings.command_line_args_disabled = FALSE;
  settings.cache_path = const_cast<char*>(cache_ansi.c_str());
  settings.persist_session_cookies = TRUE;
  settings.locale = const_cast<char*>("zh-CN");
  settings.accept_language_list = const_cast<char*>("zh-CN,zh,en");
  settings.log_file = const_cast<char*>(log_ansi.c_str());
  settings.log_severity = LOGSEVERITY_DEFAULT;
  settings.resources_dir_path = const_cast<char*>(runtime_ansi.c_str());
  settings.locales_dir_path = const_cast<char*>(locales_ansi.c_str());
  settings.enable_auto_multiple = TRUE;
  g_init_event = new BridgeInitEvent();
  g_vip_event = new BridgeVipEvent();
  FBroSetVipEvent(g_vip_event);
  if (!FBroHsInitPro(&settings, g_init_event, 1024)) {
    g_init_event = nullptr;
    g_vip_event = nullptr;
    WSACleanup();
    g_winsock_started = false;
    return -2;
  }
  g_initialized = true;
  return 1;
}

int __stdcall LB_FBro_IsReady(void) { return g_ready ? 1 : 0; }

int __stdcall LB_FBro_GetVipLicenseInfoJson(wchar_t* result, size_t capacity) {
  const auto text = [](CefRefPtr<FBroString> value) { return JsonEscape(FromFbroString(value)); };
  std::wstring json = L"{";
  json += L"\"licenseAttempted\":" + std::wstring(g_license_attempted ? L"true" : L"false") + L",";
  json += L"\"licenseValid\":" + std::wstring(g_license_valid ? L"true" : L"false") + L",";
  json += L"\"sdkReportsLicense\":" + std::wstring(FBroBrowser_IsLicenceKey() ? L"true" : L"false") + L",";
  json += L"\"machineCode\":\"" + text(FBroHsBrowser_GetMachineCode()) + L"\",";
  json += L"\"expirationTime\":\"" + text(FBroHsBrowser_GetExpirationTime()) + L"\",";
  json += L"\"registrationTime\":\"" + text(FBroHsBrowser_GetRegistrationTime()) + L"\",";
  json += L"\"version\":\"" + text(FBroHsBrowser_GetVersionStr()) + L"\",";
  json += L"\"functions\":\"" + text(FBroHsBrowser_GetFunctionStr()) + L"\",";
  json += L"\"licenseType\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseType()) + L"\",";
  json += L"\"licenseStartDate\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseStartDate()) + L"\",";
  json += L"\"licenseEndDate\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseEndDate()) + L"\",";
  json += L"\"devTools\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseDevTool()) + L"\",";
  json += L"\"licensedFunctions\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseFunction()) + L"\",";
  json += L"\"systemVersion\":\"" + text(FBroHsOnlineLicenseControl_GetShowLicenseSysVersion()) + L"\",";
  json += L"\"error\":\"" + JsonEscape(g_license_error) + L"\"}";
  return CopyResult(json, result, capacity);
}

LB_FBRO_HANDLE __stdcall LB_FBro_Create(HWND host, const wchar_t* url,
                                        const wchar_t* profile_directory,
                                        LB_FBRO_EVENT_CALLBACK callback, void* user_data) {
  return LB_FBro_CreateEx(host, url, profile_directory, L"", 7U, callback, user_data);
}

LB_FBRO_HANDLE __stdcall LB_FBro_CreateEx(HWND host, const wchar_t* url,
                                          const wchar_t* profile_directory,
                                          const wchar_t* user_agent, unsigned int flags,
                                          LB_FBRO_EVENT_CALLBACK callback, void* user_data) {
  if (!g_initialized || !IsWindow(host)) return 0;
  auto state = std::make_unique<BrowserState>();
  state->handle = g_next_handle.fetch_add(1);
  state->host = host;
  state->url = url ? url : L"about:blank";
  std::wstring profile_warning;
  state->profile = ResolveProfileDirectory(profile_directory ? profile_directory : L"", state->handle,
                                           profile_warning).wstring();
  state->last_error = profile_warning;
  state->user_agent = user_agent ? user_agent : L"";
  state->flags = flags;
  state->callback = callback;
  state->user_data = user_data;
  const LB_FBRO_HANDLE handle = state->handle;
  bool should_start = false;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_browsers.emplace(handle, std::move(state));
    should_start = g_ready && !g_shutdown_started;
  }
  if (should_start) ScheduleBrowserStart(handle);
  return handle;
}

LB_FBRO_HANDLE __stdcall LB_FBro_CreateChromeUi(LB_FBRO_HANDLE owner,
                                                 const wchar_t* url,
                                                 LB_FBRO_EVENT_CALLBACK callback,
                                                 void* user_data) {
  if (!g_initialized) return 0;
  auto state = std::make_unique<BrowserState>();
  bool should_start = false;
  LB_FBRO_HANDLE handle = 0;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* owner_state = Find(owner);
    // The originating embedded browser supplies the initialized profile/context
    // and proves that CEF is ready. No caller-owned HWND is accepted here.
    if (!owner_state || !owner_state->browser) return 0;
    state->handle = g_next_handle.fetch_add(1);
    state->url = url && *url ? url : owner_state->url;
    if (state->url.empty()) state->url = L"about:blank";
    state->user_agent = owner_state->user_agent;
    state->flags = owner_state->flags;
    state->callback = callback;
    state->user_data = user_data;
    state->request_context = owner_state->request_context;
    state->chrome_ui = true;
    handle = state->handle;
    g_browsers.emplace(handle, std::move(state));
    should_start = g_ready && !g_shutdown_started;
  }
  if (should_start) ScheduleBrowserStart(handle);
  return handle;
}

int __stdcall LB_FBro_Navigate(LB_FBRO_HANDLE browser, const wchar_t* url) {
  if (!url) return -2;
  return WithBrowser(browser, [url](CefRefPtr<CefBrowser> value) {
    if (auto frame = FBroHsBrowser_GetMainFrame(value)) FBroHsBrowserFrame_LoadURL(frame, CefString(url));
  });
}
int __stdcall LB_FBro_GoBack(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_GoBack(value); }); }
int __stdcall LB_FBro_GoForward(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_GoForward(value); }); }
int __stdcall LB_FBro_Reload(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_Reload(value); }); }
int __stdcall LB_FBro_ReloadIgnoreCache(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_ReloadIgnoreCache(value); }); }
int __stdcall LB_FBro_Stop(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_StopLoad(value); }); }
int __stdcall LB_FBro_CanGoBack(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_CanGoBack(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_CanGoForward(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_CanGoForward(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_IsLoading(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_IsLoading(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_GetZoomLevel(LB_FBRO_HANDLE browser, double* zoom_level) {
  if (!zoom_level) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  return WithBrowser(browser, [zoom_level](auto value) { *zoom_level = FBroHsBrowserHost_GetZoomLevel(value); });
}
int __stdcall LB_FBro_SetZoomLevel(LB_FBRO_HANDLE browser, double zoom_level) {
  return WithBrowser(browser, [zoom_level](auto value) { FBroHsBrowserHost_SetZoomLevel(value, zoom_level); });
}
int __stdcall LB_FBro_IsAudioMuted(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowserHost_IsAudioMuted(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_SetAudioMuted(LB_FBRO_HANDLE browser, int muted) {
  return WithBrowser(browser, [muted](auto value) { FBroHsBrowserHost_SetAudioMuted(value, muted != 0); });
}
int __stdcall LB_FBro_SendFocusEvent(LB_FBRO_HANDLE browser, int focused) {
  return WithBrowser(browser, [focused](auto value) { FBroHsBrowserHost_SendFocusEvent(value, focused != 0); });
}
int __stdcall LB_FBro_Find(LB_FBRO_HANDLE browser, const wchar_t* text,
                            int forward, int match_case, int find_next) {
  if (!text) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  return WithBrowser(browser, [=](auto value) {
    FBroHsBrowserHost_Find(value, CefString(text), forward != 0, match_case != 0, find_next != 0);
  });
}
int __stdcall LB_FBro_StopFinding(LB_FBRO_HANDLE browser, int clear_selection) {
  return WithBrowser(browser, [clear_selection](auto value) {
    FBroHsBrowserHost_StopFinding(value, clear_selection != 0);
  });
}
int __stdcall LB_FBro_HasDevTools(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowserHost_HasDevTools(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_CloseDevTools(LB_FBRO_HANDLE browser) {
  return WithBrowser(browser, [](auto value) { FBroHsBrowserHost_CloseDevTools(value); });
}
int __stdcall LB_FBro_GetIdentifier(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_GetIdentifier(value); });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_IsSame(LB_FBRO_HANDLE browser, LB_FBRO_HANDLE other) {
  CefRefPtr<CefBrowser> other_browser;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* other_state = Find(other);
    if (!other_state || !other_state->browser) return LB_FBRO_ERROR_NOT_FOUND;
    other_browser = other_state->browser;
  }
  int result = 0;
  const int status = WithBrowser(browser, [&result, other_browser](auto value) {
    result = FBroHsBrowser_IsSame(value, other_browser) ? 1 : 0;
  });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_IsPopup(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_IsPopup(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_HasDocument(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowser_HasDocument(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_TryCloseBrowser(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowserHost_TryCloseBrowser(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_SetFocus(LB_FBRO_HANDLE browser, int focused) {
  return WithBrowser(browser, [focused](auto value) { FBroHsBrowserHost_SetFocus(value, focused != 0); });
}
int __stdcall LB_FBro_HasView(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto value) { result = FBroHsBrowserHost_HasView(value) ? 1 : 0; });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_SetAutoResizeEnabled(LB_FBRO_HANDLE browser, int enabled,
                                            int min_height, int min_width,
                                            int max_height, int max_width) {
  if (min_height < 0 || min_width < 0 || max_height < min_height || max_width < min_width) {
    return LB_FBRO_ERROR_INVALID_ARGUMENT;
  }
  return WithBrowser(browser, [=](auto value) {
    FBroHsBrowserHost_SetAutoResizeEnabled(value, enabled != 0, min_height, min_width, max_height, max_width);
  });
}
int __stdcall LB_FBro_ExecuteJs(LB_FBRO_HANDLE browser, const wchar_t* script, wchar_t* result, size_t capacity) {
  if (!script) return -2;
  auto state = std::make_shared<JsExecutionState>();
  CefRefPtr<BridgeJsCallback> callback = new BridgeJsCallback(state);
  const int status = WithBrowser(browser, [script, callback](CefRefPtr<CefBrowser> value) {
    if (auto frame = FBroHsBrowser_GetMainFrame(value)) {
      FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn(
          frame, CefString(script), CefString(L"lingbuilder://execute-js"), 1, callback);
    }
  });
  if (status <= 0) return status;
  std::unique_lock<std::mutex> lock(state->mutex);
  if (!state->changed.wait_for(lock, std::chrono::seconds(5), [&] { return state->done; })) {
    CopyResult(L"等待 JavaScript 返回值超时", result, capacity);
    return -4;
  }
  const int copied = CopyResult(state->value, result, capacity);
  if (copied < 0) return copied;
  return state->success ? 1 : -5;
}
int __stdcall LB_FBro_SetProxy(LB_FBRO_HANDLE browser, const wchar_t* proxy,
                               const wchar_t* username, const wchar_t* password) {
  return WithBrowser(browser, [=](auto value) {
    if (proxy && *proxy) FBroHsBrowser_SetProxy(value, CefString(proxy), CefString(username ? username : L""), CefString(password ? password : L""));
    else FBroHsBrowser_ClearProxy(value);
  });
}
int __stdcall LB_FBro_SetUserAgent(LB_FBRO_HANDLE browser, const wchar_t* user_agent) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  BrowserState* state = Find(browser);
  if (!state) return -1;
  state->user_agent = user_agent ? user_agent : L"";
  if (!state->request_context) return state->create_started ? -2 : 1;
  auto value = CefValue::Create();
  value->SetString(state->user_agent);
  auto error = FBroString_Creat();
  return FBroHsRequestContext_SetPreference(state->request_context, CefString("general.useragent.override"), value, error) ? 1 : -3;
}
int __stdcall LB_FBro_GetCookies(LB_FBRO_HANDLE browser, const wchar_t* url, wchar_t* result, size_t capacity) {
  CefRefPtr<CefCookieManager> manager;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* state = Find(browser);
    if (!state || !state->browser) return -1;
    auto context = state->request_context ? state->request_context : CefRequestContext::GetGlobalContext();
    manager = context ? context->GetCookieManager(nullptr) : nullptr;
  }
  if (!manager) return -2;
  auto state = std::make_shared<CookieVisitState>();
  CefRefPtr<CookieVisitor> visitor = new CookieVisitor(state);
  if (!manager->VisitUrlCookies(CefString(url ? url : L""), true, visitor)) return -3;
  std::unique_lock<std::mutex> lock(state->mutex);
  state->changed.wait_for(lock, std::chrono::seconds(2), [&] { return state->done; });
  return CopyResult(state->text, result, capacity);
}
int __stdcall LB_FBro_ClearCookies(LB_FBRO_HANDLE browser, const wchar_t* url) {
  CefRefPtr<CefCookieManager> manager;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* state = Find(browser);
    if (!state || !state->browser) return -1;
    auto context = state->request_context ? state->request_context : CefRequestContext::GetGlobalContext();
    manager = context ? context->GetCookieManager(nullptr) : nullptr;
  }
  if (!manager) return -2;
  auto state = std::make_shared<CookieDeleteState>();
  CefRefPtr<CookieDeleteCallback> callback = new CookieDeleteCallback(state);
  if (!manager->DeleteCookies(CefString(url ? url : L""), CefString(), callback)) return -3;
  std::unique_lock<std::mutex> lock(state->mutex);
  if (!state->changed.wait_for(lock, std::chrono::seconds(2), [&] { return state->deleted >= 0; })) return -4;
  return state->deleted;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieVisitAllAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::VisitAll, {}, 1, 0, 0, task);
  ScheduleManagedTask(start, task, L"无法投递 Cookie 遍历任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieVisitUrlAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, int include_http_only,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!url || !*url) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::VisitUrl, {url}, include_http_only, 0, 0, task);
  ScheduleManagedTask(start, task, L"无法投递 Cookie 遍历任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieSetAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* name, const wchar_t* value,
    const wchar_t* domain, const wchar_t* path, int secure, int http_only,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!url || !*url || !name || !*name) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::Set,
      {url, name, value ? value : L"", domain ? domain : L"", path ? path : L""},
      0, secure, http_only, task);
  ScheduleManagedTask(start, task, L"无法投递 Cookie 设置任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieDeleteAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* name,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!url) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::Delete, {url, name ? name : L""}, 0, 0, 0, task);
  ScheduleManagedTask(start, task, L"无法投递 Cookie 删除任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieFlushAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::Flush, {}, 0, 0, 0, task);
  ScheduleManagedTask(start, task, L"无法投递 Cookie 刷新任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ClearCacheAsync(
    LB_FBRO_HANDLE browser, const wchar_t* origin, uint32_t remove_flags, uint32_t quota_flags,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeClearCacheCallback> cache_callback = new BridgeClearCacheCallback(task);
  CefRefPtr<BridgeClearCacheTask> start = new BridgeClearCacheTask(
      browser, false, origin ? origin : L"", remove_flags, quota_flags, cache_callback, task);
  ScheduleManagedTask(start, task, L"无法投递缓存清理任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ClearGlobalCacheAsync(
    const wchar_t* origin, uint32_t remove_flags, uint32_t quota_flags,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeClearCacheCallback> cache_callback = new BridgeClearCacheCallback(task);
  CefRefPtr<BridgeClearCacheTask> start = new BridgeClearCacheTask(
      0, true, origin ? origin : L"", remove_flags, quota_flags, cache_callback, task);
  ScheduleManagedTask(start, task, L"无法投递全局缓存清理任务");
  return task->handle;
}
int __stdcall LB_FBro_StartDownload(LB_FBRO_HANDLE browser, const wchar_t* url) {
  if (!url || !*url) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  return WithBrowser(browser, [url](CefRefPtr<CefBrowser> value) {
    FBroHsBrowserHost_StartDownload(value, CefString(url));
  });
}
int __stdcall LB_FBro_Print(LB_FBRO_HANDLE browser) {
  return WithBrowser(browser, [](CefRefPtr<CefBrowser> value) { FBroHsBrowserHost_Print(value); });
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_PrintToPdfAsync(
    LB_FBRO_HANDLE browser, const wchar_t* path, const wchar_t* settings_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!path || !*path) return 0;
  PdfPrintOptions options;
  std::wstring error;
  if (!ParsePdfPrintOptions(settings_json, options, error)) return 0;
  std::error_code path_error;
  auto output = std::filesystem::absolute(std::filesystem::path(path), path_error).lexically_normal();
  std::wstring extension = output.extension().wstring();
  std::transform(extension.begin(), extension.end(), extension.begin(), ::towlower);
  if (path_error || extension != L".pdf") return 0;
  if (!output.parent_path().empty()) std::filesystem::create_directories(output.parent_path(), path_error);
  if (path_error) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgePdfPrintCallback> pdf_callback = new BridgePdfPrintCallback(task);
  CefRefPtr<BridgePdfPrintTask> start = new BridgePdfPrintTask(
      browser, output.wstring(), std::move(options), pdf_callback, task);
  ScheduleManagedTask(start, task, L"无法投递 PDF 生成任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_RunFileDialogAsync(
    LB_FBRO_HANDLE browser, int mode, const wchar_t* title, const wchar_t* default_path,
    const wchar_t* accept_filters_json, LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (mode < FILE_DIALOG_OPEN || mode >= FILE_DIALOG_NUM_VALUES) return 0;
  std::vector<std::wstring> filters;
  std::wstring error;
  if (!ParseStringArray(accept_filters_json, filters, error)) return 0;
  HWND owner = nullptr;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(browser);
    if (!state || !state->browser) return 0;
    owner = state->host;
  }
  auto task = CreateTask(callback, user_data);
  std::thread(RunWindowsFileDialog, task, owner, mode, title ? title : L"",
              default_path ? default_path : L"", std::move(filters)).detach();
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CaptureScreenshotAsync(
    LB_FBRO_HANDLE browser, const wchar_t* format, int quality,
    int x, int y, int width, int height, int scale,
    int from_surface, int capture_beyond_viewport,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  std::wstring normalized = format && *format ? format : L"png";
  std::transform(normalized.begin(), normalized.end(), normalized.begin(), ::towlower);
  if ((normalized != L"png" && normalized != L"jpeg") || quality < 0 || quality > 100
      || x < 0 || y < 0 || width < 0 || height < 0 || scale < 0 || scale > 8) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeScreenshotCallback> screenshot_callback = new BridgeScreenshotCallback(task, normalized);
  CefRefPtr<BridgeScreenshotTask> start = new BridgeScreenshotTask(
      browser, normalized, quality, x, y, width, height, scale,
      from_surface, capture_beyond_viewport, screenshot_callback, task);
  ScheduleManagedTask(start, task, L"无法投递截图任务");
  return task->handle;
}
int __stdcall LB_FBro_GetTitle(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); auto* state = Find(browser); return state ? CopyResult(state->title, result, capacity) : -1;
}
int __stdcall LB_FBro_GetUrl(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); auto* state = Find(browser); return state ? CopyResult(state->url, result, capacity) : -1;
}
int __stdcall LB_FBro_GetLastEvent(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); auto* state = Find(browser); return state ? CopyResult(state->last_event, result, capacity) : -1;
}
int __stdcall LB_FBro_GetLastError(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); auto* state = Find(browser); return state ? CopyResult(state->last_error, result, capacity) : -1;
}

int __stdcall LB_FBro_SetEventCallbackV2(LB_FBRO_HANDLE browser,
                                          LB_FBRO_EVENT_CALLBACK_V2 callback,
                                          void* user_data) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->callback_v2 = callback;
  state->user_data_v2 = user_data;
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_SetEventCallbackV3(LB_FBRO_HANDLE browser,
                                          LB_FBRO_EVENT_CALLBACK_V3 callback,
                                          void* user_data) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->callback_v3 = callback;
  state->user_data_v3 = user_data;
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_SetEventSubscription(LB_FBRO_HANDLE browser,
                                            const wchar_t* event_id,
                                            int enabled) {
  if (!event_id || !*event_id) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->event_subscriptions[event_id] = enabled != 0;
  for (int code = LB_FBRO_EVENT_CREATED; code <= LB_FBRO_EVENT_DRAG_ENTER; ++code) {
    if (std::wcscmp(event_id, EventName(code)) != 0) continue;
    if (const wchar_t* stable_id = StableEventId(code)) {
      state->event_subscriptions[stable_id] = enabled != 0;
    }
    break;
  }
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_SetEventSamplingRate(LB_FBRO_HANDLE browser,
                                            const wchar_t* event_id,
                                            uint32_t max_hz) {
  if (!event_id || !*event_id || max_hz > 1000) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->event_sampling_rates[event_id] = max_hz;
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_CompleteEventContinuation(
    LB_FBRO_CONTINUATION_HANDLE continuation, const wchar_t* response_json) {
  const std::wstring response = response_json ? response_json : L"{}";
  return CompleteContinuationInternal(continuation,
      ParseContinuationAction(response, LB_FBRO_EVENT_ACTION_CONTINUE), response);
}

int __stdcall LB_FBro_CancelEventContinuation(
    LB_FBRO_CONTINUATION_HANDLE continuation) {
  return CompleteContinuationInternal(continuation, LB_FBRO_EVENT_ACTION_CANCEL,
                                      L"{\"reason\":\"cancelled\"}");
}

int __stdcall LB_FBro_GetLastEventJson(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  return state ? CopyResult(state->last_event_json, result, capacity) : LB_FBRO_ERROR_NOT_FOUND;
}

int __stdcall LB_FBro_GetInstanceKind(LB_FBRO_HANDLE browser) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  return state->chrome_ui ? LB_FBRO_INSTANCE_CHROME_UI : LB_FBRO_INSTANCE_EMBEDDED;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ExecuteJsAsync(LB_FBRO_HANDLE browser,
                                                      const wchar_t* script,
                                                      LB_FBRO_TASK_CALLBACK callback,
                                                      void* user_data) {
  if (!script) return 0;
  auto task = std::make_shared<TaskState>();
  task->handle = g_next_object_handle.fetch_add(1);
  task->status = LB_FBRO_TASK_RUNNING;
  task->callback = callback;
  task->user_data = user_data;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_tasks.emplace(task->handle, task);
  }
  CefRefPtr<BridgeAsyncJsCallback> js_callback = new BridgeAsyncJsCallback(task);
  const int status = WithBrowser(browser, [script, js_callback](CefRefPtr<CefBrowser> value) {
    if (auto frame = FBroHsBrowser_GetMainFrame(value)) {
      FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn(
          frame, CefString(script), CefString(L"lingbuilder://execute-js-async"), 1, js_callback);
    }
  });
  if (status <= 0) {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    task->status = LB_FBRO_TASK_FAILED;
    task->error = L"浏览器句柄不存在或主框架尚未创建";
    if (task->callback) task->callback(task->handle, task->user_data);
  }
  return task->handle;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetMainFrame(LB_FBRO_HANDLE browser) {
  LB_FBRO_OBJECT_HANDLE result = 0;
  WithBrowser(browser, [&result](CefRefPtr<CefBrowser> value) {
    result = RegisterFrame(FBroHsBrowser_GetMainFrame(value));
  });
  return result;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFocusedFrame(LB_FBRO_HANDLE browser) {
  LB_FBRO_OBJECT_HANDLE result = 0;
  WithBrowser(browser, [&result](CefRefPtr<CefBrowser> value) {
    result = RegisterFrame(FBroHsBrowser_GetFocusedFrame(value));
  });
  return result;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFrameByIdentifier(
    LB_FBRO_HANDLE browser, const wchar_t* identifier) {
  if (!identifier) return 0;
  LB_FBRO_OBJECT_HANDLE result = 0;
  WithBrowser(browser, [identifier, &result](CefRefPtr<CefBrowser> value) {
    result = RegisterFrame(FBroHsBrowser_GetFrameById(value, CefString(identifier)));
  });
  return result;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_BrowserGetFrameByName(
    LB_FBRO_HANDLE browser, const wchar_t* name) {
  if (!name) return 0;
  LB_FBRO_OBJECT_HANDLE result = 0;
  WithBrowser(browser, [name, &result](CefRefPtr<CefBrowser> value) {
    result = RegisterFrame(FBroHsBrowser_GetFrameByName(value, CefString(name)));
  });
  return result;
}

int __stdcall LB_FBro_BrowserGetFrameIdentifiersJson(
    LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::wstring json;
  const int status = WithBrowser(browser, [&json](CefRefPtr<CefBrowser> value) {
    json = StringListJson(FBroHsBrowser_GetFrameIdentifiers(value));
  });
  return status > 0 ? CopyResult(json, result, capacity) : status;
}

int __stdcall LB_FBro_BrowserGetFrameNamesJson(
    LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::wstring json;
  const int status = WithBrowser(browser, [&json](CefRefPtr<CefBrowser> value) {
    json = StringListJson(FBroHsBrowser_GetFrameNames(value));
  });
  return status > 0 ? CopyResult(json, result, capacity) : status;
}

int __stdcall LB_FBro_FrameIsValid(LB_FBRO_OBJECT_HANDLE frame) {
  int result = 0;
  const int status = WithFrame(frame, [&result](CefRefPtr<CefFrame> value) {
    result = FBroHsBrowserFrame_IsValid(value) ? 1 : 0;
  });
  return status > 0 ? result : status;
}

int __stdcall LB_FBro_FrameIsMain(LB_FBRO_OBJECT_HANDLE frame) {
  int result = 0;
  const int status = WithFrame(frame, [&result](CefRefPtr<CefFrame> value) {
    result = FBroHsBrowserFrame_IsMain(value) ? 1 : 0;
  });
  return status > 0 ? result : status;
}

int __stdcall LB_FBro_FrameIsFocused(LB_FBRO_OBJECT_HANDLE frame) {
  int result = 0;
  const int status = WithFrame(frame, [&result](CefRefPtr<CefFrame> value) {
    result = FBroHsBrowserFrame_IsFocused(value) ? 1 : 0;
  });
  return status > 0 ? result : status;
}

int __stdcall LB_FBro_FrameGetUrl(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity) {
  std::wstring value;
  const int status = WithFrame(frame, [&value](CefRefPtr<CefFrame> current) {
    value = FromFbroString(FBroHsBrowserFrame_GetURL(current));
  });
  return status > 0 ? CopyResult(value, result, capacity) : status;
}

int __stdcall LB_FBro_FrameGetName(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity) {
  std::wstring value;
  const int status = WithFrame(frame, [&value](CefRefPtr<CefFrame> current) {
    value = FromFbroString(FBroHsBrowserFrame_GetName(current));
  });
  return status > 0 ? CopyResult(value, result, capacity) : status;
}

int __stdcall LB_FBro_FrameGetIdentifier(
    LB_FBRO_OBJECT_HANDLE frame, wchar_t* result, size_t capacity) {
  std::wstring value;
  const int status = WithFrame(frame, [&value](CefRefPtr<CefFrame> current) {
    value = FromFbroString(FBroHsBrowserFrame_GetIdentifier(current));
  });
  return status > 0 ? CopyResult(value, result, capacity) : status;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_FrameGetParent(LB_FBRO_OBJECT_HANDLE frame) {
  LB_FBRO_OBJECT_HANDLE result = 0;
  WithFrame(frame, [frame, &result](CefRefPtr<CefFrame> value) {
    result = RegisterFrame(FBroHsBrowserFrame_GetParent(value), frame);
  });
  return result;
}

LB_FBRO_HANDLE __stdcall LB_FBro_FrameGetBrowser(LB_FBRO_OBJECT_HANDLE frame) {
  CefRefPtr<CefBrowser> browser;
  if (WithFrame(frame, [&browser](CefRefPtr<CefFrame> value) {
        browser = FBroHsBrowserFrame_GetBrowser(value);
      }) <= 0 || !browser) return 0;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  for (const auto& [handle, state] : g_browsers) {
    if (state->browser && state->browser->IsSame(browser)) return handle;
  }
  return 0;
}

int __stdcall LB_FBro_FrameUndo(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Undo(value); });
}
int __stdcall LB_FBro_FrameRedo(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Redo(value); });
}
int __stdcall LB_FBro_FrameCut(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Cut(value); });
}
int __stdcall LB_FBro_FrameCopy(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Copy(value); });
}
int __stdcall LB_FBro_FramePaste(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Paste(value); });
}
int __stdcall LB_FBro_FrameDelete(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_Delete(value); });
}
int __stdcall LB_FBro_FrameSelectAll(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_SelectAll(value); });
}
int __stdcall LB_FBro_FrameViewSource(LB_FBRO_OBJECT_HANDLE frame) {
  return WithFrame(frame, [](auto value) { FBroHsBrowserFrame_ViewSource(value); });
}
int __stdcall LB_FBro_FrameLoadUrl(LB_FBRO_OBJECT_HANDLE frame, const wchar_t* url) {
  if (!url) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  return WithFrame(frame, [url](auto value) {
    FBroHsBrowserFrame_LoadURL(value, CefString(url));
  });
}
int __stdcall LB_FBro_FrameExecuteJavaScript(
    LB_FBRO_OBJECT_HANDLE frame, const wchar_t* code, const wchar_t* script_url, int start_line) {
  if (!code || start_line < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  return WithFrame(frame, [=](auto value) {
    FBroHsBrowserFrame_ExecuteJavaScript(
        value, CefString(code), CefString(script_url ? script_url : L"lingbuilder://frame-script"), start_line);
  });
}

int __stdcall LB_FBro_TaskGetStatus(LB_FBRO_TASK_HANDLE task) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  return found == g_tasks.end() ? LB_FBRO_ERROR_RELEASED_HANDLE : found->second->status.load();
}

int __stdcall LB_FBro_TaskGetResult(LB_FBRO_TASK_HANDLE task, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  if (found == g_tasks.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
  if (found->second->status == LB_FBRO_TASK_CANCELLED) return LB_FBRO_ERROR_CANCELLED;
  if (found->second->status != LB_FBRO_TASK_COMPLETED) return LB_FBRO_ERROR_OPERATION_FAILED;
  return CopyResult(found->second->result, result, capacity);
}

int __stdcall LB_FBro_TaskGetError(LB_FBRO_TASK_HANDLE task, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  return found == g_tasks.end() ? LB_FBRO_ERROR_RELEASED_HANDLE : CopyResult(found->second->error, result, capacity);
}

int __stdcall LB_FBro_TaskWait(LB_FBRO_TASK_HANDLE task, int timeout_milliseconds) {
  if (timeout_milliseconds < 0 || timeout_milliseconds > 600000) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeout_milliseconds);
  while (true) {
    const int status = LB_FBro_TaskGetStatus(task);
    if (status < 0) return status;
    if (status == LB_FBRO_TASK_COMPLETED) return LB_FBRO_OK;
    if (status == LB_FBRO_TASK_FAILED) return LB_FBRO_ERROR_OPERATION_FAILED;
    if (status == LB_FBRO_TASK_CANCELLED) return LB_FBRO_ERROR_CANCELLED;
    if (std::chrono::steady_clock::now() >= deadline) return LB_FBRO_ERROR_TIMEOUT;
    Sleep(10);
  }
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_TaskGetObject(LB_FBRO_TASK_HANDLE task) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  if (found == g_tasks.end() || found->second->status != LB_FBRO_TASK_COMPLETED) return 0;
  return found->second->object;
}

LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_TaskGetBuffer(LB_FBRO_TASK_HANDLE task) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  if (found == g_tasks.end() || found->second->status != LB_FBRO_TASK_COMPLETED) return 0;
  return found->second->buffer;
}

int __stdcall LB_FBro_TaskCancel(LB_FBRO_TASK_HANDLE task) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  if (found == g_tasks.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
  const int status = found->second->status.load();
  if (status == LB_FBRO_TASK_COMPLETED || status == LB_FBRO_TASK_FAILED) return LB_FBRO_ERROR_OPERATION_FAILED;
  found->second->status = LB_FBRO_TASK_CANCELLED;
  found->second->error = L"任务已取消";
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_TaskRelease(LB_FBRO_TASK_HANDLE task) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_tasks.find(task);
  if (found == g_tasks.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
  const int status = found->second->status.load();
  if (status == LB_FBRO_TASK_PENDING || status == LB_FBRO_TASK_RUNNING) {
    found->second->status = LB_FBRO_TASK_CANCELLED;
    found->second->error = L"任务已释放";
  }
  found->second->callback = nullptr;
  found->second->user_data = nullptr;
  g_tasks.erase(found);
  return LB_FBRO_OK;
}

LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_BufferCreate(const void* data, size_t size) {
  if (size > 0 && !data) return 0;
  std::vector<unsigned char> bytes;
  if (size > 0) {
    const auto* source = static_cast<const unsigned char*>(data);
    bytes.assign(source, source + size);
  }
  return RegisterBuffer(std::move(bytes));
}

int __stdcall LB_FBro_BufferGetSize(LB_FBRO_BUFFER_HANDLE buffer, uint64_t* size) {
  if (!size) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_buffers.find(buffer);
  if (found == g_buffers.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
  *size = static_cast<uint64_t>(found->second->bytes.size());
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_BufferToHex(LB_FBRO_BUFFER_HANDLE buffer, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const auto found = g_buffers.find(buffer);
  if (found == g_buffers.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
  std::wostringstream stream;
  stream << std::uppercase << std::hex << std::setfill(L'0');
  for (unsigned char byte : found->second->bytes) stream << std::setw(2) << static_cast<unsigned int>(byte);
  return CopyResult(stream.str(), result, capacity);
}

int __stdcall LB_FBro_BufferSaveFile(LB_FBRO_BUFFER_HANDLE buffer, const wchar_t* path) {
  if (!path || !*path) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  std::shared_ptr<BufferState> value;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    const auto found = g_buffers.find(buffer);
    if (found == g_buffers.end()) return LB_FBRO_ERROR_RELEASED_HANDLE;
    value = found->second;
  }
  std::ofstream output(std::filesystem::path(path), std::ios::binary | std::ios::trunc);
  if (!output) return LB_FBRO_ERROR_OPERATION_FAILED;
  if (!value->bytes.empty()) output.write(reinterpret_cast<const char*>(value->bytes.data()), static_cast<std::streamsize>(value->bytes.size()));
  return output.good() ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED;
}

int __stdcall LB_FBro_BufferRelease(LB_FBRO_BUFFER_HANDLE buffer) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  return g_buffers.erase(buffer) > 0 ? LB_FBRO_OK : LB_FBRO_ERROR_RELEASED_HANDLE;
}

int __stdcall LB_FBro_ObjectGetType(LB_FBRO_OBJECT_HANDLE object) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  if (g_tasks.find(object) != g_tasks.end()) return LB_FBRO_OBJECT_TASK;
  if (g_buffers.find(object) != g_buffers.end()) return LB_FBRO_OBJECT_BUFFER;
  const auto managed = g_objects.find(object);
  if (managed != g_objects.end()) {
    if (managed->second->owner_thread != 0 && managed->second->owner_thread != GetCurrentThreadId()) {
      return LB_FBRO_ERROR_WRONG_THREAD;
    }
    return managed->second->type;
  }
  if (g_browsers.find(static_cast<LB_FBRO_HANDLE>(object)) != g_browsers.end()) return LB_FBRO_OBJECT_BROWSER;
  return LB_FBRO_ERROR_RELEASED_HANDLE;
}

int __stdcall LB_FBro_ObjectRelease(LB_FBRO_OBJECT_HANDLE object) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  if (g_tasks.erase(object) > 0 || g_buffers.erase(object) > 0) return LB_FBRO_OK;
  const auto managed = g_objects.find(object);
  if (managed != g_objects.end()) {
    if (managed->second->owner_thread != 0 && managed->second->owner_thread != GetCurrentThreadId()) {
      return LB_FBRO_ERROR_WRONG_THREAD;
    }
    EraseObjectTree(object);
    return LB_FBRO_OK;
  }
  if (g_browsers.find(static_cast<LB_FBRO_HANDLE>(object)) != g_browsers.end()) return LB_FBRO_ERROR_HANDLE_TYPE;
  return LB_FBRO_ERROR_RELEASED_HANDLE;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueCreate(void) {
  return RegisterObject(LB_FBRO_OBJECT_VALUE, FBroHsValue_Create(), nullptr, nullptr);
}
int __stdcall LB_FBro_ValueIsValid(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? (FBroHsValue_IsValid(value->value) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ValueIsOwned(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? (FBroHsValue_IsOwned(value->value) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ValueIsReadOnly(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? (FBroHsValue_IsReadOnly(value->value) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ValueIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_VALUE, status);
  return that ? (FBroHsValue_IsSame(value->value, that->value) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ValueIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_VALUE, status);
  return that ? (FBroHsValue_IsEqual(value->value, that->value) ? 1 : 0) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueCopy(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_VALUE, FBroHsValue_Copy(value->value), nullptr, nullptr) : 0;
}
int __stdcall LB_FBro_ValueGetType(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? FBroHsValue_GetType(value->value) : status;
}
int __stdcall LB_FBro_ValueGetBool(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? (FBroHsValue_GetBool(value->value) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ValueGetInt(LB_FBRO_OBJECT_HANDLE object, int* result) {
  if (!result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status; *result = FBroHsValue_GetInt(value->value); return LB_FBRO_OK;
}
int __stdcall LB_FBro_ValueGetDouble(LB_FBRO_OBJECT_HANDLE object, double* result) {
  if (!result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status; *result = FBroHsValue_GetDouble(value->value); return LB_FBRO_OK;
}
int __stdcall LB_FBro_ValueGetString(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? CopyResult(FromFbroString(FBroHsValue_GetString(value->value)), result, capacity) : status;
}
int __stdcall LB_FBro_ValueSetNull(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? BoolStatus(FBroHsValue_SetNull(value->value)) : status;
}
int __stdcall LB_FBro_ValueSetBool(LB_FBRO_OBJECT_HANDLE object, int input) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? BoolStatus(FBroHsValue_SetBool(value->value, input != 0)) : status;
}
int __stdcall LB_FBro_ValueSetInt(LB_FBRO_OBJECT_HANDLE object, int input) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? BoolStatus(FBroHsValue_SetInt(value->value, input)) : status;
}
int __stdcall LB_FBro_ValueSetDouble(LB_FBRO_OBJECT_HANDLE object, double input) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? BoolStatus(FBroHsValue_SetDouble(value->value, input)) : status;
}
int __stdcall LB_FBro_ValueSetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* input) {
  if (!input) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? BoolStatus(FBroHsValue_SetString(value->value, CefString(input))) : status;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ValueGetBinary(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? RegisterBinaryBuffer(FBroHsValue_GetBinary(value->value)) : 0;
}
int __stdcall LB_FBro_ValueSetBinary(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_BUFFER_HANDLE buffer) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status;
  auto binary = CreateBinaryFromBuffer(buffer, status);
  return binary ? BoolStatus(FBroHsValue_SetBinary(value->value, binary)) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueGetDictionary(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_DICTIONARY, nullptr,
      FBroHsValue_GetDictionary(value->value), nullptr, object) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ValueGetList(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr,
      FBroHsValue_GetList(value->value), object) : 0;
}
int __stdcall LB_FBro_ValueSetDictionary(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE dictionary) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status;
  auto child = GetObject(dictionary, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!child) return status;
  const BOOL applied = FBroHsValue_SetDictionary(value->value, child->dictionary);
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}
int __stdcall LB_FBro_ValueSetList(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE list) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_VALUE, status);
  if (!value) return status;
  auto child = GetObject(list, LB_FBRO_OBJECT_LIST, status);
  if (!child) return status;
  const BOOL applied = FBroHsValue_SetList(value->value, child->list);
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryCreate(void) {
  return RegisterObject(LB_FBRO_OBJECT_DICTIONARY, nullptr, FBroHsDictionaryValue_Create(), nullptr);
}
int __stdcall LB_FBro_DictionaryIsValid(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? (FBroHsDictionaryValue_IsValid(value->dictionary) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryIsOwned(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? (FBroHsDictionaryValue_IsOwned(value->dictionary) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryIsReadOnly(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? (FBroHsDictionaryValue_IsReadOnly(value->dictionary) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_DICTIONARY, status);
  return that ? (FBroHsDictionaryValue_IsSame(value->dictionary, that->dictionary) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_DICTIONARY, status);
  return that ? (FBroHsDictionaryValue_IsEqual(value->dictionary, that->dictionary) ? 1 : 0) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryCopy(LB_FBRO_OBJECT_HANDLE object, int exclude_empty_children) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_DICTIONARY, nullptr,
      FBroHsDictionaryValue_Copy(value->dictionary, exclude_empty_children != 0), nullptr) : 0;
}
int __stdcall LB_FBro_DictionaryGetSize(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? FBroHsDictionaryValue_GetSize(value->dictionary) : status;
}
int __stdcall LB_FBro_DictionaryClear(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_Clear(value->dictionary)) : status;
}
int __stdcall LB_FBro_DictionaryHasKey(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? (FBroHsDictionaryValue_HasKey(value->dictionary, CefString(key)) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryRemove(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_Remove(value->dictionary, CefString(key))) : status;
}
int __stdcall LB_FBro_DictionaryGetType(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? FBroHsDictionaryValue_GetType(value->dictionary, CefString(key)) : status;
}
int __stdcall LB_FBro_DictionaryGetBool(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? (FBroHsDictionaryValue_GetBool(value->dictionary, CefString(key)) ? 1 : 0) : status;
}
int __stdcall LB_FBro_DictionaryGetInt(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int* result) {
  if (!key || !result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status; *result = FBroHsDictionaryValue_GetInt(value->dictionary, CefString(key)); return LB_FBRO_OK;
}
int __stdcall LB_FBro_DictionaryGetDouble(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, double* result) {
  if (!key || !result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status; *result = FBroHsDictionaryValue_GetDouble(value->dictionary, CefString(key)); return LB_FBRO_OK;
}
int __stdcall LB_FBro_DictionaryGetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                           wchar_t* result, size_t capacity) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? CopyResult(FromFbroString(FBroHsDictionaryValue_GetString(value->dictionary, CefString(key))), result, capacity) : status;
}
int __stdcall LB_FBro_DictionaryGetKeysJson(LB_FBRO_OBJECT_HANDLE object,
                                             wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto keys = FBroHsDictionaryValue_GetKeys(value->dictionary);
  std::wstring json = L"[";
  const int count = keys ? FBroCefStringList_Size(keys) : 0;
  for (int index = 0; index < count; ++index) {
    if (index > 0) json += L",";
    json += L"\"" + JsonEscape(FromFbroString(FBroCefStringList_GetValue(keys, index))) + L"\"";
  }
  json += L"]";
  return CopyResult(json, result, capacity);
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetValue(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_VALUE,
      FBroHsDictionaryValue_GetValue(value->dictionary, CefString(key)), nullptr, nullptr, object) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_DictionaryGetBinary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? RegisterBinaryBuffer(FBroHsDictionaryValue_GetBinary(value->dictionary, CefString(key))) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetDictionary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_DICTIONARY, nullptr,
      FBroHsDictionaryValue_GetDictionary(value->dictionary, CefString(key)), nullptr, object) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DictionaryGetList(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr,
      FBroHsDictionaryValue_GetList(value->dictionary, CefString(key)), object) : 0;
}
int __stdcall LB_FBro_DictionarySetNull(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_SetNull(value->dictionary, CefString(key))) : status;
}
int __stdcall LB_FBro_DictionarySetBool(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int input) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_SetBool(value->dictionary, CefString(key), input != 0)) : status;
}
int __stdcall LB_FBro_DictionarySetInt(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, int input) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_SetInt(value->dictionary, CefString(key), input)) : status;
}
int __stdcall LB_FBro_DictionarySetDouble(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, double input) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_SetDouble(value->dictionary, CefString(key), input)) : status;
}
int __stdcall LB_FBro_DictionarySetString(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key, const wchar_t* input) {
  if (!key || !input) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  return value ? BoolStatus(FBroHsDictionaryValue_SetString(value->dictionary, CefString(key), CefString(input))) : status;
}
int __stdcall LB_FBro_DictionarySetValue(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                          LB_FBRO_OBJECT_HANDLE child_handle) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_VALUE, status);
  if (!child) return status;
  const BOOL applied = FBroHsDictionaryValue_SetValue(value->dictionary, child->value, CefString(key));
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}
int __stdcall LB_FBro_DictionarySetBinary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                           LB_FBRO_BUFFER_HANDLE buffer) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto binary = CreateBinaryFromBuffer(buffer, status);
  return binary ? BoolStatus(FBroHsDictionaryValue_SetBinary(value->dictionary, CefString(key), binary)) : status;
}
int __stdcall LB_FBro_DictionarySetDictionary(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                               LB_FBRO_OBJECT_HANDLE child_handle) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!child) return status;
  const BOOL applied = FBroHsDictionaryValue_SetDictionary(value->dictionary, child->dictionary, CefString(key));
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}
int __stdcall LB_FBro_DictionarySetList(LB_FBRO_OBJECT_HANDLE object, const wchar_t* key,
                                         LB_FBRO_OBJECT_HANDLE child_handle) {
  if (!key) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_LIST, status);
  if (!child) return status;
  const BOOL applied = FBroHsDictionaryValue_SetList(value->dictionary, child->list, CefString(key));
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListCreate(void) {
  return RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr, FBroHsListValue_Create());
}
int __stdcall LB_FBro_ListIsValid(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? (FBroHsListValue_IsValid(value->list) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ListIsOwned(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? (FBroHsListValue_IsOwned(value->list) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ListIsReadOnly(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? (FBroHsListValue_IsReadOnly(value->list) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ListIsSame(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_LIST, status);
  return that ? (FBroHsListValue_IsSame(value->list, that->list) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ListIsEqual(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_OBJECT_HANDLE other) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto that = GetObject(other, LB_FBRO_OBJECT_LIST, status);
  return that ? (FBroHsListValue_IsEqual(value->list, that->list) ? 1 : 0) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListCopy(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr, FBroHsListValue_Copy(value->list)) : 0;
}
int __stdcall LB_FBro_ListSetSize(LB_FBRO_OBJECT_HANDLE object, int size) {
  if (size < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetSize(value->list, size)) : status;
}
int __stdcall LB_FBro_ListGetSize(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? FBroHsListValue_GetSize(value->list) : status;
}
int __stdcall LB_FBro_ListClear(LB_FBRO_OBJECT_HANDLE object) {
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_Clear(value->list)) : status;
}
int __stdcall LB_FBro_ListRemove(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_Remove(value->list, index)) : status;
}
int __stdcall LB_FBro_ListGetType(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? static_cast<int>(FBroHsListValue_GetType(value->list, index)) : status;
}
int __stdcall LB_FBro_ListGetBool(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? (FBroHsListValue_GetBool(value->list, index) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ListGetInt(LB_FBRO_OBJECT_HANDLE object, int index, int* result) {
  if (index < 0 || !result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status; *result = FBroHsListValue_GetInt(value->list, index); return LB_FBRO_OK;
}
int __stdcall LB_FBro_ListGetDouble(LB_FBRO_OBJECT_HANDLE object, int index, double* result) {
  if (index < 0 || !result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status; *result = FBroHsListValue_GetDouble(value->list, index); return LB_FBRO_OK;
}
int __stdcall LB_FBro_ListGetString(LB_FBRO_OBJECT_HANDLE object, int index, wchar_t* result, size_t capacity) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? CopyResult(FromFbroString(FBroHsListValue_GetString(value->list, index)), result, capacity) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetValue(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_VALUE,
      FBroHsListValue_GetValue(value->list, static_cast<size_t>(index)), nullptr, nullptr, object) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ListGetBinary(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? RegisterBinaryBuffer(FBroHsListValue_GetBinary(value->list, index)) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetDictionary(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_DICTIONARY, nullptr,
      FBroHsListValue_GetDictionary(value->list, static_cast<size_t>(index)), nullptr, object) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ListGetList(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr,
      FBroHsListValue_GetList(value->list, static_cast<size_t>(index)), object) : 0;
}
int __stdcall LB_FBro_ListSetNull(LB_FBRO_OBJECT_HANDLE object, int index) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetNull(value->list, index)) : status;
}
int __stdcall LB_FBro_ListSetBool(LB_FBRO_OBJECT_HANDLE object, int index, int input) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetBool(value->list, index, input != 0)) : status;
}
int __stdcall LB_FBro_ListSetInt(LB_FBRO_OBJECT_HANDLE object, int index, int input) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetInt(value->list, index, input)) : status;
}
int __stdcall LB_FBro_ListSetDouble(LB_FBRO_OBJECT_HANDLE object, int index, double input) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetDouble(value->list, index, input)) : status;
}
int __stdcall LB_FBro_ListSetString(LB_FBRO_OBJECT_HANDLE object, int index, const wchar_t* input) {
  if (index < 0 || !input) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  return value ? BoolStatus(FBroHsListValue_SetString(value->list, index, CefString(input))) : status;
}
int __stdcall LB_FBro_ListSetValue(LB_FBRO_OBJECT_HANDLE object, int index,
                                    LB_FBRO_OBJECT_HANDLE child_handle) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_VALUE, status);
  if (!child) return status;
  const BOOL applied = FBroHsListValue_SetValue(value->list, static_cast<size_t>(index), child->value);
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}
int __stdcall LB_FBro_ListSetBinary(LB_FBRO_OBJECT_HANDLE object, int index,
                                     LB_FBRO_BUFFER_HANDLE buffer) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto binary = CreateBinaryFromBuffer(buffer, status);
  return binary ? BoolStatus(FBroHsListValue_SetBinary(value->list, index, binary)) : status;
}
int __stdcall LB_FBro_ListSetDictionary(LB_FBRO_OBJECT_HANDLE object, int index,
                                         LB_FBRO_OBJECT_HANDLE child_handle) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_DICTIONARY, status);
  if (!child) return status;
  const BOOL applied = FBroHsListValue_SetDictionary(value->list, static_cast<size_t>(index), child->dictionary);
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}
int __stdcall LB_FBro_ListSetList(LB_FBRO_OBJECT_HANDLE object, int index,
                                   LB_FBRO_OBJECT_HANDLE child_handle) {
  if (index < 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(object, LB_FBRO_OBJECT_LIST, status);
  if (!value) return status;
  auto child = GetObject(child_handle, LB_FBRO_OBJECT_LIST, status);
  if (!child) return status;
  const BOOL applied = FBroHsListValue_SetList(value->list, static_cast<size_t>(index), child->list);
  if (applied) AdoptObject(child, object);
  return BoolStatus(applied);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_StreamCreateForFile(const wchar_t* path) {
  if (!path || !*path) return 0;
  return RegisterStream(FBroStream_CreateForFile(CefString(path)));
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_StreamCreateForBuffer(LB_FBRO_BUFFER_HANDLE buffer) {
  int status = 0; auto source = GetBuffer(buffer, status);
  if (!source) return 0;
  std::vector<unsigned char> bytes = source->bytes;
  void* data = bytes.empty() ? nullptr : bytes.data();
  auto stream = FBroStream_CreateForData(data, bytes.size());
  return RegisterStream(stream, std::move(bytes));
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_StreamRead(LB_FBRO_OBJECT_HANDLE stream, size_t size, size_t count) {
  constexpr size_t kMaximumReadBytes = 256U * 1024U * 1024U;
  if (size != 0 && count > kMaximumReadBytes / size) return 0;
  int status = 0; auto value = GetObject(stream, LB_FBRO_OBJECT_STREAM, status);
  if (!value) return 0;
  const size_t requested = size * count;
  if (requested == 0) return RegisterBuffer({});
  std::vector<unsigned char> bytes(requested);
  const size_t units_read = FBroStream_Read(value->stream, bytes.data(), size, count);
  if (units_read > count) return 0;
  bytes.resize(units_read * size);
  return RegisterBuffer(std::move(bytes));
}
int __stdcall LB_FBro_StreamSeek(LB_FBRO_OBJECT_HANDLE stream, int64_t offset, int whence) {
  if (whence != SEEK_SET && whence != SEEK_CUR && whence != SEEK_END) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(stream, LB_FBRO_OBJECT_STREAM, status);
  if (!value) return status;
  return FBroStream_Seek(value->stream, offset, whence) == 0 ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED;
}
int __stdcall LB_FBro_StreamTell(LB_FBRO_OBJECT_HANDLE stream, int64_t* offset) {
  if (!offset) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(stream, LB_FBRO_OBJECT_STREAM, status);
  if (!value) return status;
  const int64_t position = FBroStream_Tell(value->stream);
  if (position < 0) return LB_FBRO_ERROR_OPERATION_FAILED;
  *offset = position;
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_StreamEof(LB_FBRO_OBJECT_HANDLE stream) {
  int status = 0; auto value = GetObject(stream, LB_FBRO_OBJECT_STREAM, status);
  return value ? (FBroStream_Eof(value->stream) != 0 ? 1 : 0) : status;
}
int __stdcall LB_FBro_StreamMayBlock(LB_FBRO_OBJECT_HANDLE stream) {
  int status = 0; auto value = GetObject(stream, LB_FBRO_OBJECT_STREAM, status);
  return value ? (FBroStream_MayBlock(value->stream) ? 1 : 0) : status;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DownloadImageAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, int is_favicon, uint32_t max_image_size,
    int bypass_cache, LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!url || !*url || max_image_size > 16384) return 0;
  auto task = std::make_shared<TaskState>();
  task->handle = g_next_object_handle.fetch_add(1);
  task->status = LB_FBRO_TASK_RUNNING;
  task->callback = callback;
  task->user_data = user_data;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (!Find(browser)) return 0;
    g_tasks.emplace(task->handle, task);
  }
  CefRefPtr<BridgeDownloadImageCallback> image_callback = new BridgeDownloadImageCallback(task);
  CefRefPtr<BridgeStartImageDownloadTask> start = new BridgeStartImageDownloadTask(
      browser, url, is_favicon != 0, max_image_size, bypass_cache != 0, image_callback, task);
  if (CefCurrentlyOn(TID_UI)) start->Execute();
  else if (!CefPostTask(TID_UI, start)) CompleteObjectTask(task, 0, L"无法投递图像下载任务");
  return task->handle;
}
int __stdcall LB_FBro_ImageIsEmpty(LB_FBRO_OBJECT_HANDLE image) {
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? (FBroHsImage_IsEmpty(value->image) ? 1 : 0) : status;
}
int __stdcall LB_FBro_ImageGetWidth(LB_FBRO_OBJECT_HANDLE image) {
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? FBroHsImage_GetWidth(value->image) : status;
}
int __stdcall LB_FBro_ImageGetHeight(LB_FBRO_OBJECT_HANDLE image) {
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? FBroHsImage_GetHeight(value->image) : status;
}
int __stdcall LB_FBro_ImageGetRepresentationInfo(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, float* actual_scale_factor,
    int* pixel_width, int* pixel_height) {
  if (scale_factor <= 0 || !actual_scale_factor || !pixel_width || !pixel_height) {
    return LB_FBRO_ERROR_INVALID_ARGUMENT;
  }
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? BoolStatus(FBroHsImage_GetRepresentationInfo(
      value->image, scale_factor, *actual_scale_factor, *pixel_width, *pixel_height)) : status;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsBitmap(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int color_type, int alpha_type,
    int* pixel_width, int* pixel_height) {
  if (scale_factor <= 0 || !pixel_width || !pixel_height) return 0;
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? RegisterBinaryBuffer(FBroHsImage_GetAsBitmap(
      value->image, scale_factor, color_type, alpha_type, *pixel_width, *pixel_height)) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsJpeg(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int quality,
    int* pixel_width, int* pixel_height) {
  if (scale_factor <= 0 || quality < 0 || quality > 100 || !pixel_width || !pixel_height) return 0;
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? RegisterBinaryBuffer(FBroHsImage_GetAsJPEG(
      value->image, scale_factor, quality, *pixel_width, *pixel_height)) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_ImageGetAsPng(
    LB_FBRO_OBJECT_HANDLE image, float scale_factor, int with_transparency,
    int* pixel_width, int* pixel_height) {
  if (scale_factor <= 0 || !pixel_width || !pixel_height) return 0;
  int status = 0; auto value = GetObject(image, LB_FBRO_OBJECT_IMAGE, status);
  return value ? RegisterBinaryBuffer(FBroHsImage_GetAsPNG(
      value->image, scale_factor, with_transparency != 0, *pixel_width, *pixel_height)) : 0;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_GetCurrentCertificateAsync(
    LB_FBRO_HANDLE browser, LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  auto task = std::make_shared<TaskState>();
  task->handle = g_next_object_handle.fetch_add(1);
  task->status = LB_FBRO_TASK_RUNNING;
  task->callback = callback;
  task->user_data = user_data;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (!Find(browser)) return 0;
    g_tasks.emplace(task->handle, task);
  }
  CefRefPtr<BridgeCurrentCertificateTask> read = new BridgeCurrentCertificateTask(browser, task);
  if (CefCurrentlyOn(TID_UI)) read->Execute();
  else if (!CefPostTask(TID_UI, read)) CompleteObjectTask(task, 0, L"无法投递证书读取任务");
  return task->handle;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_CertificateGetSubject(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? RegisterPrincipal(FBroHsX509Certificate_GetSubject(value->certificate), certificate) : 0;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_CertificateGetIssuer(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? RegisterPrincipal(FBroHsX509Certificate_GetIssuer(value->certificate), certificate) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetSerialNumber(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? RegisterBinaryBuffer(FBroHsX509Certificate_GetSerialNumber(value->certificate)) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetDerEncoded(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? RegisterBinaryBuffer(FBroHsX509Certificate_GetDEREncoded(value->certificate)) : 0;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetPemEncoded(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? RegisterBinaryBuffer(FBroHsX509Certificate_GetPEMEncoded(value->certificate)) : 0;
}
int __stdcall LB_FBro_CertificateGetValidStart(LB_FBRO_OBJECT_HANDLE certificate, int64_t* result) {
  if (!result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  if (!value) return status;
  *result = static_cast<int64_t>(FBroHsX509Certificate_GetValidStart(value->certificate));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_CertificateGetValidExpiry(LB_FBRO_OBJECT_HANDLE certificate, int64_t* result) {
  if (!result) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  if (!value) return status;
  *result = static_cast<int64_t>(FBroHsX509Certificate_GetValidExpiry(value->certificate));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_CertificateGetIssuerChainSize(LB_FBRO_OBJECT_HANDLE certificate) {
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  return value ? static_cast<int>(FBroHsX509Certificate_GetIssuerChainSize(value->certificate)) : status;
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetDerIssuerChainItem(
    LB_FBRO_OBJECT_HANDLE certificate, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  if (!value) return 0;
  auto items = FBroHsX509Certificate_GetDEREncodedIssuerChain(value->certificate);
  if (!items || index >= FBroBinaryValueList_Size(items)) return 0;
  return RegisterBinaryBuffer(FBroBinaryValueList_GetValue(items, index));
}
LB_FBRO_BUFFER_HANDLE __stdcall LB_FBro_CertificateGetPemIssuerChainItem(
    LB_FBRO_OBJECT_HANDLE certificate, int index) {
  if (index < 0) return 0;
  int status = 0; auto value = GetObject(certificate, LB_FBRO_OBJECT_CERTIFICATE, status);
  if (!value) return 0;
  auto items = FBroHsX509Certificate_GetPEMEncodedIssuerChain(value->certificate);
  if (!items || index >= FBroBinaryValueList_Size(items)) return 0;
  return RegisterBinaryBuffer(FBroBinaryValueList_GetValue(items, index));
}
int __stdcall LB_FBro_PrincipalGetDisplayName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(FromFbroString(FBroHsX509CertPrincipal_GetDisplayName(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetCommonName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(FromFbroString(FBroHsX509CertPrincipal_GetCommonName(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetLocalityName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(FromFbroString(FBroHsX509CertPrincipal_GetLocalityName(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetStateOrProvinceName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(FromFbroString(FBroHsX509CertPrincipal_GetStateOrProvinceName(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetCountryName(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(FromFbroString(FBroHsX509CertPrincipal_GetCountryName(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetOrganizationNamesJson(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(StringListJson(FBroHsX509CertPrincipal_GetOrganizationNames(value->principal)), result, capacity) : status;
}
int __stdcall LB_FBro_PrincipalGetOrganizationUnitNamesJson(LB_FBRO_OBJECT_HANDLE principal, wchar_t* result, size_t capacity) {
  int status = 0; auto value = GetObject(principal, LB_FBRO_OBJECT_CERT_PRINCIPAL, status);
  return value ? CopyResult(StringListJson(FBroHsX509CertPrincipal_GetOrganizationUnitNames(value->principal)), result, capacity) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_GetLastEventObject(LB_FBRO_HANDLE browser) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  return state ? state->last_event_object : 0;
}
int __stdcall LB_FBro_DragDataHasImage(LB_FBRO_OBJECT_HANDLE drag_data) {
  int status = 0; auto value = GetObject(drag_data, LB_FBRO_OBJECT_DRAG_DATA, status);
  return value ? (FBroHsDragData_HasImage(value->drag_data) ? 1 : 0) : status;
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_DragDataGetImage(LB_FBRO_OBJECT_HANDLE drag_data) {
  int status = 0; auto value = GetObject(drag_data, LB_FBRO_OBJECT_DRAG_DATA, status);
  return value ? RegisterImage(FBroHsDragData_GetImage(value->drag_data), drag_data) : 0;
}

int __stdcall LB_FBro_ApplyFingerprintJson(LB_FBRO_HANDLE browser, const wchar_t* json) {
  if (!json) return -2;
  CefRefPtr<CefValue> parsed = CefParseJSON(CefString(json), JSON_PARSER_ALLOW_TRAILING_COMMAS);
  if (!parsed || parsed->GetType() != VTYPE_DICTIONARY) return -3;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  BrowserState* state = Find(browser);
  if (!state || !state->browser) return -1;
  if (g_license_attempted && !g_license_valid) {
    state->last_error = L"FBro VIP 授权码校验失败";
    if (!g_license_error.empty()) state->last_error += L"：" + g_license_error;
    return -5;
  }
  auto vip = FBroHsBrowser_GetVIPControl(state->browser);
  if (!vip || FBroHsVIPControl_IsNULL(vip)) {
    state->last_error = L"VIP Key 未配置或 FBro VIP 控件不可用";
    return -4;
  }
  auto dict = parsed->GetDictionary();

#define LB_FBRO_APPLY_STRING(key, fn) \
  if (dict->GetType(key) == VTYPE_STRING) fn(vip, dict->GetString(key))
#define LB_FBRO_APPLY_INT(key, fn) \
  if (dict->GetType(key) == VTYPE_INT) fn(vip, dict->GetInt(key))
#define LB_FBRO_APPLY_NUMBER(key, fn) \
  if (dict->HasKey(key)) fn(vip, ReadJsonNumber(dict, key, 0))
#define LB_FBRO_APPLY_BOOL(key, fn) \
  if (dict->HasKey(key)) fn(vip, ReadJsonBool(dict, key, 0) ? TRUE : FALSE)

  LB_FBRO_APPLY_STRING("productSub", FBroHsVIPControl_SetVirProductSub);
  LB_FBRO_APPLY_STRING("vendor", FBroHsVIPControl_SetVirVendor);
  LB_FBRO_APPLY_STRING("vendorSub", FBroHsVIPControl_SetVirVendorSub);
  LB_FBRO_APPLY_STRING("platform", FBroHsVIPControl_SetVirPlatform);
  LB_FBRO_APPLY_STRING("acceptLanguages", FBroHsVIPControl_SetVirAcceptlanguages);
  LB_FBRO_APPLY_STRING("languages", FBroHsVIPControl_SetVirLanguages);
  LB_FBRO_APPLY_STRING("appCodeName", FBroHsVIPControl_SetVirAppCodeName);
  LB_FBRO_APPLY_STRING("appName", FBroHsVIPControl_SetVirAppName);
  LB_FBRO_APPLY_STRING("appVersion", FBroHsVIPControl_SetVirAppVersion);
  LB_FBRO_APPLY_STRING("product", FBroHsVIPControl_SetVirProduct);
  LB_FBRO_APPLY_INT("hardwareConcurrency", FBroHsVIPControl_SetVirHardwareConcurrency);
  LB_FBRO_APPLY_BOOL("cookieEnabled", FBroHsVIPControl_SetVirCookieEnabled);
  LB_FBRO_APPLY_INT("deviceMemory", FBroHsVIPControl_SetVirDeviceMemory);
  LB_FBRO_APPLY_BOOL("javaEnabled", FBroHsVIPControl_SetVirJavaEnabled);
  LB_FBRO_APPLY_BOOL("webdriver", FBroHsVIPControl_SetVirWebdriver);
  LB_FBRO_APPLY_BOOL("online", FBroHsVIPControl_SetVirOnLine);
  LB_FBRO_APPLY_NUMBER("canvas2dFontFingerprint", FBroHsVIPControl_SetVirCanvas2DFontFingerprint);
  LB_FBRO_APPLY_INT("screenColorDepth", FBroHsVIPControl_SetVirScreencolorDepth);
  LB_FBRO_APPLY_INT("screenPixelDepth", FBroHsVIPControl_SetVirScreenpixelDepth);
  LB_FBRO_APPLY_NUMBER("devicePixelRatio", FBroHsVIPControl_SetVirDevicePixelRatio);
  LB_FBRO_APPLY_STRING("webglVendor", FBroHsVIPControl_SetVirWebglvendor);
  LB_FBRO_APPLY_STRING("webglRenderer", FBroHsVIPControl_SetVirWebglrenderer);
  LB_FBRO_APPLY_STRING("audioInput", FBroHsVIPControl_SetVirAudioInput);
  LB_FBRO_APPLY_STRING("videoInput", FBroHsVIPControl_SetVirVideoInput);
  LB_FBRO_APPLY_STRING("audioOutput", FBroHsVIPControl_SetVirAudioOutput);
  LB_FBRO_APPLY_INT("kernel", FBroHsVIPControl_SetVirKernel);
  LB_FBRO_APPLY_STRING("speechSynthesisVoices", FBroHsVIPControl_SetVirSpeechSynthesisVoices);
  LB_FBRO_APPLY_STRING("gpuVendor", FBroHsVIPControl_SetVirGPUVendor);
  LB_FBRO_APPLY_STRING("gpuArchitecture", FBroHsVIPControl_SetVirGPUArchitecture);
  LB_FBRO_APPLY_STRING("gpuDevice", FBroHsVIPControl_SetVirGPUDevice);
  LB_FBRO_APPLY_STRING("gpuDescription", FBroHsVIPControl_SetVirGPUDescription);
  if (dict->GetType("gpuSubgroupMinSize") == VTYPE_INT)
    FBroHsVIPControl_SetVirGPUSubgroupMinSize(vip, static_cast<unsigned>(std::max(0, dict->GetInt("gpuSubgroupMinSize"))));
  if (dict->GetType("gpuSubgroupMaxSize") == VTYPE_INT)
    FBroHsVIPControl_SetVirGPUSubgroupMaxSize(vip, static_cast<unsigned>(std::max(0, dict->GetInt("gpuSubgroupMaxSize"))));
  LB_FBRO_APPLY_BOOL("isTrusted", FBroHsVIPControl_SetVirisTrusted);
  LB_FBRO_APPLY_INT("webFeatureKernel", FBroHsVIPControl_SetWebFeatureKernel);
  LB_FBRO_APPLY_INT("cssKernel", FBroHsVIPControl_SetCSSKernel);
  LB_FBRO_APPLY_INT("v8Kernel", FBroHsVIPControl_SetV8Kernel);
  LB_FBRO_APPLY_BOOL("disableDebugger", FBroHsVIPControl_SetDisableDebugger);
  LB_FBRO_APPLY_BOOL("disableConsoleDebug", FBroHsVIPControl_SetDisableConsoleDebug);
  LB_FBRO_APPLY_BOOL("disableConsoleWarn", FBroHsVIPControl_SetDisableConsoleWarn);
  LB_FBRO_APPLY_BOOL("disableConsoleError", FBroHsVIPControl_SetDisableConsoleError);
  LB_FBRO_APPLY_BOOL("disableConsoleInfo", FBroHsVIPControl_SetDisableConsoleInfo);
  LB_FBRO_APPLY_BOOL("disableConsoleLog", FBroHsVIPControl_SetDisableConsoleLog);
  LB_FBRO_APPLY_BOOL("disableConsoleAssert", FBroHsVIPControl_SetDisableConsoleAssert);
  LB_FBRO_APPLY_BOOL("disableConsoleDir", FBroHsVIPControl_SetDisableConsoleDir);
  LB_FBRO_APPLY_BOOL("disableConsoleTable", FBroHsVIPControl_SetDisableConsoleTable);
  LB_FBRO_APPLY_BOOL("disableConsoleGroup", FBroHsVIPControl_SetDisableConsoleGroup);
  LB_FBRO_APPLY_BOOL("disableConsoleTime", FBroHsVIPControl_SetDisableConsoleTime);
  LB_FBRO_APPLY_BOOL("disableConsoleProfile", FBroHsVIPControl_SetDisableConsoleProfile);
  LB_FBRO_APPLY_BOOL("disableConsoleCount", FBroHsVIPControl_SetDisableConsoleCount);
  LB_FBRO_APPLY_BOOL("disableConsoleTrace", FBroHsVIPControl_SetDisableConsoleTrace);
  LB_FBRO_APPLY_BOOL("disableConsoleClear", FBroHsVIPControl_SetDisableConsoleClear);
  if (ReadJsonBool(dict, "enableWebsocketClientHook", 0)) FBroHsVIPControl_EnableWebsocketClientHook(vip);
  if (ReadJsonBool(dict, "clearAllData", 0)) FBroHsVIPControl_ClearAllData(vip);
  if (ReadJsonBool(dict, "clearS5Auth", 0)) FBroHsVIPControl_ClearS5Auth(vip);

  auto vip_browser = FBroHsVIPControl_GetBrowser(vip);
  if (!vip_browser || !FBroHsBrowser_IsSame(vip_browser, state->browser)) {
    state->last_error = L"FBro VIP 控件返回了不一致的浏览器实例";
    return -7;
  }
  if (auto value = ReadJsonDictionary(dict, "emitTouchEventsForMouse")) {
    FBroHsVIPControl_SetEmitTouchEventsForMouse(vip, ReadJsonBool(value, "enabled", 0) ? TRUE : FALSE,
      static_cast<int>(ReadJsonNumber(value, "configuration", 0)));
  }
  if (auto value = ReadJsonDictionary(dict, "performanceCheck")) {
    FBroHsVIPControl_SetDisablePerformanceCheck(vip, ReadJsonBool(value, "disabled", 0) ? TRUE : FALSE,
      ReadJsonNumber(value, "minimum", 0), ReadJsonNumber(value, "maximum", 0));
  }
  if (auto value = ReadJsonDictionary(dict, "s5Auth")) {
    const auto url = ReadJsonWide(value, "url");
    const auto username = ReadJsonWide(value, "username");
    const auto password = ReadJsonWide(value, "password");
    const BOOL close_message = ReadJsonBool(value, "closeMessage", 1) ? TRUE : FALSE;
    if (ReadJsonBool(value, "global", 0)) FBroHsVIPGlobal_SetS5Auth(username, password, close_message);
    else FBroHsVIPControl_SetS5Auth(vip, url, username, password, close_message);
  }

  if (dict->GetType("plugins") == VTYPE_DICTIONARY) {
    auto value = dict->GetDictionary("plugins");
    FBroHsVIPControl_SetPlugins(vip, static_cast<int>(ReadJsonNumber(value, "changeType", 0)), ReadJsonWide(value, "data"));
  }
  if (dict->GetType("cssFontFingerprint") == VTYPE_DICTIONARY) {
    auto value = dict->GetDictionary("cssFontFingerprint");
    FBroHsVIPControl_SetVirCSSFontFingerprint(vip, ReadJsonWide(value, "data"),
      static_cast<int>(ReadJsonNumber(value, "x", 0)), static_cast<int>(ReadJsonNumber(value, "y", 0)));
  }
  if (dict->HasKey("screenX") && dict->HasKey("screenY"))
    FBroHsVIPControl_SetVirScreenXAndY(vip, static_cast<int>(ReadJsonNumber(dict, "screenX", 0)),
      static_cast<int>(ReadJsonNumber(dict, "screenY", 0)));
  if (dict->HasKey("screenWidth") && dict->HasKey("screenHeight"))
    FBroHsVIPControl_SetVirScreenHeightAndWidth(vip, static_cast<int>(ReadJsonNumber(dict, "screenHeight", 0)),
      static_cast<int>(ReadJsonNumber(dict, "screenWidth", 0)));
  if (dict->HasKey("screenAvailWidth") && dict->HasKey("screenAvailHeight"))
    FBroHsVIPControl_SetVirScreenavailHeightAndWidth(vip, static_cast<int>(ReadJsonNumber(dict, "screenAvailHeight", 0)),
      static_cast<int>(ReadJsonNumber(dict, "screenAvailWidth", 0)));

  if (auto value = ReadJsonDictionary(dict, "rectFingerprint")) {
    FBroHsVIPControl_SetVirRectFingerprint(vip, static_cast<int>(ReadJsonNumber(value, "x", 0)),
      static_cast<int>(ReadJsonNumber(value, "y", 0)), static_cast<int>(ReadJsonNumber(value, "width", 0)),
      static_cast<int>(ReadJsonNumber(value, "height", 0)));
  }
  if (auto value = ReadJsonDictionary(dict, "webrtc")) {
    FBroHsVIPControl_SetVirWebrtcIP(vip, ReadJsonWide(value, "publicIp"), ReadJsonWide(value, "localIp"),
      ReadJsonWide(value, "host"), ReadJsonBool(value, "disable", 0) ? TRUE : FALSE);
  }
  if (auto value = ReadJsonDictionary(dict, "timeZone")) {
    FBroHsVIPControl_SetVirTimeZone(vip, static_cast<int>(ReadJsonNumber(value, "hour", 0)),
      static_cast<int>(ReadJsonNumber(value, "minute", 0)), ReadJsonWide(value, "name"),
      ReadJsonWide(value, "standardName"));
  }
  if (auto value = ReadJsonDictionary(dict, "touchEmulation")) {
    FBroHsVIPControl_SetTouchEventEmulationEnabled(vip, ReadJsonBool(value, "enabled", 0) ? TRUE : FALSE,
      static_cast<int>(ReadJsonNumber(value, "maxTouchPoints", 1)));
  }
  if (auto value = ReadJsonDictionary(dict, "battery")) {
    if (value->HasKey("charging")) FBroHsVIPControl_SetVirBatteryManagerCharging(vip, ReadJsonBool(value, "charging", 0) ? TRUE : FALSE);
    if (value->HasKey("chargingTime")) FBroHsVIPControl_SetVirBatteryManagerChargingTime(vip, ReadJsonNumber(value, "chargingTime", 0));
    if (value->HasKey("dischargingTime")) FBroHsVIPControl_SetVirBatteryManagerDischargingTime(vip, ReadJsonNumber(value, "dischargingTime", 0));
    if (value->HasKey("level")) FBroHsVIPControl_SetVirBatteryManagerLevel(vip, ReadJsonNumber(value, "level", 0));
  }
  if (auto value = ReadJsonDictionary(dict, "geolocation")) {
    FBroHsVIPControl_SetVirLongitudeAndLatitude(vip, ReadJsonNumber(value, "longitude", 0),
      ReadJsonNumber(value, "latitude", 0), ReadJsonNumber(value, "altitude", 0),
      ReadJsonNumber(value, "accuracy", 0), ReadJsonNumber(value, "altitudeAccuracy", 0),
      ReadJsonNumber(value, "heading", 0), ReadJsonNumber(value, "speed", 0));
  }
  if (auto value = ReadJsonDictionary(dict, "viewport")) {
    FBroHsVIPControl_SetVirViewport(vip, static_cast<int>(ReadJsonNumber(value, "x", 0)),
      static_cast<int>(ReadJsonNumber(value, "y", 0)), static_cast<int>(ReadJsonNumber(value, "width", 0)),
      static_cast<int>(ReadJsonNumber(value, "height", 0)));
  }
  if (auto value = ReadJsonDictionary(dict, "sslCipher")) {
    FBroHsVIPControl_SetSSLCipher(vip, static_cast<int>(ReadJsonNumber(value, "minimumVersion", 0)),
      static_cast<int>(ReadJsonNumber(value, "maximumVersion", 0)), ReadJsonWide(value, "command"));
  }
  if (auto value = ReadJsonDictionary(dict, "orientation")) {
    FBroHsVIPControl_SetVirOrientation(vip, static_cast<int>(ReadJsonNumber(value, "angle", 0)),
      static_cast<int>(ReadJsonNumber(value, "type", 0)));
  }
  if (auto limits = ReadJsonList(dict, "gpuLimits")) {
    for (size_t index = 0; index < limits->GetSize(); ++index) {
      if (limits->GetType(index) != VTYPE_DICTIONARY) continue;
      auto value = limits->GetDictionary(index);
      const int type = static_cast<int>(ReadJsonNumber(value, "type", 0));
      int64_t limit = static_cast<int64_t>(ReadJsonNumber(value, "value", 0));
      if (value->GetType("value") == VTYPE_STRING) {
        try { limit = std::stoll(value->GetString("value").ToWString()); } catch (...) { continue; }
      }
      FBroHsVIPControl_SetVirGPULimits(vip, type, limit);
    }
  }

  const int seed = static_cast<int>(ReadJsonNumber(dict, "seed", 128));
  auto fingerprints = ReadJsonDictionary(dict, "fingerprints");
  auto apply_fingerprint = [&](const char* name, int default_min, int default_max, int seed_offset) {
    auto value = ReadJsonDictionary(fingerprints, name);
    const std::wstring constant = ReadJsonWide(value, "constant");
    if (!constant.empty()) {
      if (strcmp(name, "canvas") == 0) FBroHsVIPControl_SetCanvasFingerPrint_constant(vip, constant);
      else if (strcmp(name, "webgl") == 0) FBroHsVIPControl_SetWebGLFingerPrint_constant(vip, constant);
      else FBroHsVIPControl_SetAudioFingerPrint_constant(vip, constant);
      return;
    }
    const int minimum = static_cast<int>(ReadJsonNumber(value, "minimum", default_min));
    const int maximum = static_cast<int>(ReadJsonNumber(value, "maximum", default_max));
    const int value_seed = static_cast<int>(ReadJsonNumber(value, "seed", seed + seed_offset));
    if (strcmp(name, "canvas") == 0) FBroHsVIPControl_SetCanvasFingerPrint_random(vip, minimum, maximum, value_seed);
    else if (strcmp(name, "webgl") == 0) FBroHsVIPControl_SetWebGLFingerPrint_random(vip, minimum, maximum, value_seed);
    else FBroHsVIPControl_SetAudioFingerPrint_random(vip, minimum, maximum, value_seed);
  };
  apply_fingerprint("canvas", 1, 16, 0);
  apply_fingerprint("webgl", 1, 100, 17);
  apply_fingerprint("audio", 100, 1000, 31);

  std::wstring user_agent_json = L"{}";
  if (auto value = ReadJsonDictionary(dict, "userAgent")) {
    auto user_agent = FBroHsVIPUserAgentData_Create();
    if (!user_agent) {
      state->last_error = L"创建 FBro VIP User-Agent Data 失败";
      return -6;
    }
#define LB_FBRO_APPLY_UA_STRING(key, fn) \
    if (value->GetType(key) == VTYPE_STRING) fn(user_agent, value->GetString(key))
    LB_FBRO_APPLY_UA_STRING("mainUserAgent", FBroHsVIPUserAgentData_SetMainUserAgent);
    LB_FBRO_APPLY_UA_STRING("mainAcceptLanguage", FBroHsVIPUserAgentData_SetMainAcceptLanguage);
    LB_FBRO_APPLY_UA_STRING("mainPlatform", FBroHsVIPUserAgentData_SetMainPlatform);
    LB_FBRO_APPLY_UA_STRING("fullVersion", FBroHsVIPUserAgentData_SetFullVersion);
    LB_FBRO_APPLY_UA_STRING("platform", FBroHsVIPUserAgentData_SetPlatform);
    LB_FBRO_APPLY_UA_STRING("platformVersion", FBroHsVIPUserAgentData_SetPlatformVersion);
    LB_FBRO_APPLY_UA_STRING("architecture", FBroHsVIPUserAgentData_SetArchitecture);
    LB_FBRO_APPLY_UA_STRING("model", FBroHsVIPUserAgentData_SetModel);
    LB_FBRO_APPLY_UA_STRING("bitness", FBroHsVIPUserAgentData_SetBitness);
    if (value->HasKey("mobile")) FBroHsVIPUserAgentData_SetMobile(user_agent, ReadJsonBool(value, "mobile", 0) ? TRUE : FALSE);
    if (value->HasKey("wow64")) FBroHsVIPUserAgentData_SetWow64(user_agent, ReadJsonBool(value, "wow64", 0) ? TRUE : FALSE);
    if (auto brands = CreateDoubleStringFromJson(value, "brands")) FBroHsVIPUserAgentData_SetBrands(user_agent, brands);
    if (auto versions = CreateDoubleStringFromJson(value, "fullVersionList")) FBroHsVIPUserAgentData_SetFullVersionList(user_agent, versions);
    if (auto factors = CreateStringListFromJson(value, "formFactors")) FBroHsVIPUserAgentData_SetFormFactors(user_agent, factors);
    FBroHsVIPControl_SetVirUserAgent(vip, user_agent);
    user_agent_json = VipUserAgentJson(user_agent);
#undef LB_FBRO_APPLY_UA_STRING
  }

  const std::wstring normalized = CefWriteJSON(parsed, JSON_WRITER_DEFAULT).ToWString();
  state->last_fingerprint_json = L"{\"configuration\":" + (normalized.empty() ? std::wstring(L"{}") : normalized)
      + L",\"userAgent\":" + user_agent_json + L"}";

#undef LB_FBRO_APPLY_STRING
#undef LB_FBRO_APPLY_INT
#undef LB_FBRO_APPLY_NUMBER
#undef LB_FBRO_APPLY_BOOL
  return 1;
}

int __stdcall LB_FBro_GetAppliedFingerprintJson(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  BrowserState* state = Find(browser);
  if (!state) return -1;
  return CopyResult(state->last_fingerprint_json.empty() ? L"{}" : state->last_fingerprint_json, result, capacity);
}

int __stdcall LB_FBro_GetFingerprintCallCount(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); BrowserState* state = Find(browser);
  if (!state || !state->browser) return -1;
  auto vip = FBroHsBrowser_GetVIPControl(state->browser);
  if (!vip || FBroHsVIPControl_IsNULL(vip)) return -4;
  return CopyResult(FromFbroString(FBroHsVIPControl_GetFingerCount(vip)), result, capacity);
}
int __stdcall LB_FBro_ClearFingerprintCallCount(LB_FBRO_HANDLE browser) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex); BrowserState* state = Find(browser);
  if (!state || !state->browser) return -1;
  auto vip = FBroHsBrowser_GetVIPControl(state->browser);
  if (!vip || FBroHsVIPControl_IsNULL(vip)) return -4;
  FBroHsVIPControl_ClearFingerCount(vip); return 1;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipDomCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!browser || !command || !*command) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeVipDomTask> start = new BridgeVipDomTask(
      browser, command, args_json ? args_json : L"{}", task);
  ScheduleManagedTask(start, task, L"无法投递 FBro VIP DOM 任务");
  return task->handle;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipExtensionCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!browser || !command || !*command) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeVipExtensionTask> start = new BridgeVipExtensionTask(
      browser, command, args_json ? args_json : L"{}", task);
  ScheduleManagedTask(start, task, L"无法投递 FBro VIP 扩展任务");
  return task->handle;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipResourceCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!command || !*command) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeVipResourceTask> start = new BridgeVipResourceTask(
      browser, command, args_json ? args_json : L"{}", task);
  ScheduleManagedTask(start, task, L"无法投递 FBro VIP 资源规则任务");
  return task->handle;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_VipDevToolsCommandAsync(
    LB_FBRO_HANDLE browser, const wchar_t* command, const wchar_t* args_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!browser || !command || !*command) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeVipDevToolsTask> start = new BridgeVipDevToolsTask(
      browser, command, args_json ? args_json : L"{}", task);
  ScheduleManagedTask(start, task, L"无法投递 FBro VIP DevTools 任务");
  return task->handle;
}

int __stdcall LB_FBro_Resize(LB_FBRO_HANDLE browser) {
  HWND host = nullptr;
  {
    // WM_SIZE runs on the host window thread. Browser creation runs on CEF's UI
    // thread and may temporarily hold the registry mutex while synchronously
    // creating native windows. Never make the host message pump wait for it.
    std::unique_lock<std::recursive_mutex> lock(g_mutex, std::try_to_lock);
    if (!lock.owns_lock()) return 0;
    BrowserState* state = Find(browser);
    if (!state || !IsWindow(state->host)) return -1;
    host = state->host;
  }
  RECT bounds{};
  if (!GetClientRect(host, &bounds)) return -1;
  const int width = std::max<LONG>(1, bounds.right - bounds.left);
  const int height = std::max<LONG>(1, bounds.bottom - bounds.top);
  // EnumChildWindows is recursive and also returns Chromium's internal HWNDs.
  // Resizing every descendant can synchronously re-enter CEF and freeze the
  // parent window. Only resize the browser windows directly parented to host.
  for (HWND child = GetWindow(host, GW_CHILD); child;) {
    const HWND next = GetWindow(child, GW_HWNDNEXT);
    MoveWindow(child, 0, 0, width, height, TRUE);
    child = next;
  }
  return 1;
}
void __stdcall LB_FBro_Close(LB_FBRO_HANDLE browser) {
  CancelContinuationsForBrowser(browser);
  CefRefPtr<CefBrowser> native_browser;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* state = Find(browser);
    if (state) native_browser = state->browser;
  }
  RequestBrowserClose(std::move(native_browser));
}
void __stdcall LB_FBro_Shutdown(void) {
  if (!g_initialized || g_shutdown_started.exchange(true)) return;
  std::vector<CefRefPtr<CefBrowser>> native_browsers;
  std::vector<LB_FBRO_CONTINUATION_HANDLE> pending_continuations;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (auto& item : g_browsers) {
      if (item.second->browser) native_browsers.push_back(item.second->browser);
    }
    for (const auto& item : g_continuations) pending_continuations.push_back(item.first);
  }
  for (const auto continuation : pending_continuations) {
    CompleteContinuationInternal(continuation, LB_FBRO_EVENT_ACTION_CANCEL,
                                 L"{\"reason\":\"shutdown\"}");
  }
  StopContinuationTimerThread();
  const bool had_live_browsers = !native_browsers.empty();
  RequestBrowserCloseBatchAndWait(std::move(native_browsers));
  // FBroShutdown(FALSE) starts the framework's asynchronous close protocol.
  // The host Win32 message pump must remain alive until OnBeforeClose arrives;
  // waiting here would block that pump and deadlock normal application exit.
  FBroShutdown(FALSE);
  if (!had_live_browsers) FBroQuitMessageLoop();
}
