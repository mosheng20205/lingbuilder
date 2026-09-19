#include "LingBuilderFbroBridge.h"

#include "pch.h"
#include "FBroBaseType.h"
#include "FBroBrowser.h"
#include "FBroBrowserHost.h"
#include "FBroCallback.h"
#include "FBroCommand.h"
#include "FBroControl.h"
#include "FBroCookieManager.h"
#include "FBroDom.h"
#include "FBroDragData.h"
#include "FBroFrame.h"
#include "FBroFrameTianBiao.h"
#include "FBroHsBaseEvent.h"
#include "FBroHsEvent.h"
#include "FBroInit.h"
#include "FBroDictionaryValue.h"
#include "FBroDownloadItem.h"
#include "FBroListValue.h"
#include "FBroImage.h"
#include "FBroMenuModel.h"
#include "FBroMiddleData.h"
#include "FBroPostData.h"
#include "FBroProcessMessage.h"
#include "FBroRequest.h"
#include "FBroResponseFilter.h"
#include "FBroResponse.h"
#include "FBroRequestContext.h"
#include "FBroServer.h"
#include "FBroSocket.h"
#include "FBroURLRequest.h"
#include "FBroWSSClient.h"
#include "FBroStream.h"
#include "FBroSSLInfo.h"
#include "FBroString.h"
#include "FBroValue.h"
#include "FBroVersion.h"
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
#include <cstdio>
#include <cstring>
#include <cwchar>
#include <cwctype>
#include <deque>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iomanip>
#include <memory>
#include <mutex>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace {

struct BrowserState;
class BridgeBrowserEvent;
struct ResourceBodyCaptureState;
BrowserState* Find(LB_FBRO_HANDLE handle);
void NotifyVipBrowser(CefRefPtr<CefBrowser> browser, int code, const std::wstring& data);
bool ApplyMenuModelOperations(CefRefPtr<CefMenuModel> model, const std::wstring& ops_json);

struct VipResourcePayload {
  std::vector<unsigned char> bytes;
  CefRefPtr<FBroDoubleString> headers;
};

// 响应正文查找替换配置（非 VIP 能力）：字节在 Set 时整体复制，之后只读。
struct ResourceReplaceConfig {
  std::vector<unsigned char> find_bytes;
  std::vector<unsigned char> replacement_bytes;
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
std::atomic<bool> g_extension_plus_requested{false};
std::atomic<bool> g_extension_plus_enabled{false};
bool g_winsock_started = false;
CefRefPtr<FBroHsInitEvent> g_init_event;
CefRefPtr<FBroVIPEvent> g_vip_event;
std::filesystem::path g_runtime_directory;
std::filesystem::path g_root_cache_directory;
// 当前进程角色：Browser=生成 exe 的主进程（LB_FBro_InitializeEx）；
// CefSubprocess=被官方 CEF 以 --type= 拉起的子进程
// （LB_FBro_RunCefSubprocessIfRequested）。CefSubprocess 角色下五钩子 override
// 在渲染进程内被触发，派发改为经命名管道中继回浏览器进程（见
// 「WS 拦截五事件跨进程中继」一节）。
enum class BridgeProcessRole { Browser, CefSubprocess };
BridgeProcessRole g_process_role = BridgeProcessRole::Browser;
std::wstring g_license_error;
std::vector<wchar_t> g_pending_license_credential;
bool g_pending_credential_sets_browser_license = false;
std::wstring g_startup_extension_directory;
std::wstring g_startup_extension_status;
std::wstring g_startup_extension_id;
std::wstring g_startup_extension_event_path;
std::wstring g_startup_extension_error;
std::wstring g_startup_switches_json;
std::wstring g_startup_command_line;
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
  CefRefPtr<CefMenuModel> menu_model;
  CefRefPtr<CefContextMenuParams> context_menu_params;
  CefRefPtr<CefRequest> request;
  CefRefPtr<CefPostData> post_data;
  CefRefPtr<CefPostDataElement> post_data_element;
  CefRefPtr<CefProcessMessage> process_message;
  CefRefPtr<CefURLRequest> url_request;
  CefRefPtr<CefRequestContext> request_context;
  CefRefPtr<CefServer> server;
  CefRefPtr<CefDownloadItem> download_item;
  CefRefPtr<CefResponse> response;
  CefRefPtr<FBroDOMWssClient> wss_client;
  std::shared_ptr<struct DomSnapshot> dom_snapshot;
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
  std::wstring extension_directory;
  std::wstring extension_id;
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
  // 资源响应正文捕获：FBro 的资源事件可能来自多个 IO 线程，事件到达与
  // GetResourceResponseFilter 会交错，因此必须按请求标识精确配对：
  // resource_urls 记录每个请求的网址（LB_FBro_ResourceBodyBegin 取用），
  // resource_body_captures 按请求标识登记待安装的有界捕获。
  std::unordered_map<uint64_t, std::wstring> resource_urls;
  std::unordered_map<uint64_t, std::shared_ptr<ResourceBodyCaptureState>> resource_body_captures;
  // 响应正文查找替换配置（非 VIP）：g_mutex 保护下整体替换 shared_ptr；
  // GetResourceResponseFilter 按当前配置构造过滤器实例，传输中的资源继续
  // 沿用其安装时复制到的配置，新配置只对之后开始加载的资源生效。
  std::shared_ptr<const ResourceReplaceConfig> resource_replace;
  // 运行时上下文重建：先关闭旧浏览器，OnBeforeClose 后换上用户 RequestContext 重启。
  CefRefPtr<CefRequestContext> recreate_request_context;
  bool recreate_pending = false;
  bool create_started = false;
  bool extension_load_started = false;
  bool chrome_ui = false;
  bool background = false;
  std::wstring extra_info_json;
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

LB_FBRO_OBJECT_HANDLE RegisterDownloadItem(CefRefPtr<CefDownloadItem> item,
                                           LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!item) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_DOWNLOAD_ITEM;
  state->owner_thread = 0;
  state->parent = parent;
  state->download_item = std::move(item);
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

LB_FBRO_OBJECT_HANDLE RegisterResponse(CefRefPtr<CefResponse> response,
                                       LB_FBRO_OBJECT_HANDLE parent = 0) {
  if (!response) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_RESPONSE;
  state->owner_thread = 0;
  state->parent = parent;
  state->response = std::move(response);
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

// 新型受管对象注册。事件期临时对象（右键菜单、参数、资源事件里的请求）由
// 调用方传 owner_thread=GetCurrentThreadId() 限定在本回调周期消费；用户自建
// 对象（请求、PostData、进程消息、RequestContext 等）保持 owner_thread=0，
// 允许生成运行时线程注册、UI 线程任务消费。
template <typename T>
LB_FBRO_OBJECT_HANDLE RegisterCefObject(int type, CefRefPtr<T> object,
                                        CefRefPtr<T> ObjectState::*slot,
                                        LB_FBRO_OBJECT_HANDLE parent = 0,
                                        DWORD owner_thread = 0) {
  if (!object) return 0;
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = type;
  state->owner_thread = owner_thread;
  state->parent = parent;
  (*state).*slot = std::move(object);
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
    case LB_FBRO_EVENT_DOWNLOAD_START: return L"OnBeforeDownload";
    case LB_FBRO_EVENT_DOWNLOAD_UPDATED: return L"OnDownloadUpdated";
    default: return L"Unknown";
  }
}

const wchar_t* StableEventId(int code) {
  switch (code) {
    case LB_FBRO_EVENT_DOWNLOAD_START:
      return L"fbro.event.fbrohsbroevent.onbeforedownload.108a0eef290e";
    case LB_FBRO_EVENT_DOWNLOAD_UPDATED:
      return L"fbro.event.fbrohsbroevent.ondownloadupdated.d8506aae50d6";
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
    case LB_FBRO_EVENT_DOWNLOAD_START: return L"OnBeforeDownload";
    case LB_FBRO_EVENT_DOWNLOAD_UPDATED: return L"OnDownloadUpdated";
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
    case LB_FBRO_EVENT_DOWNLOAD_START: return L"下载开始";
    case LB_FBRO_EVENT_DOWNLOAD_UPDATED: return L"下载进度更新";
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

std::wstring AppendResponseHandleField(std::wstring fields_json,
                                       const CefRefPtr<CefResponse>& response) {
  if (fields_json.size() > 1 && fields_json.back() == L'}') {
    fields_json.pop_back();
    fields_json += L",\"response\":";
    fields_json += std::to_wstring(static_cast<long long>(RegisterResponse(response)));
    fields_json += L"}";
  }
  return fields_json;
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

struct ResourceBodyCaptureState;
void DispatchResourceBodyEvent(LB_FBRO_HANDLE handle,
                               const std::shared_ptr<ResourceBodyCaptureState>& capture,
                               const wchar_t* error);
void ScheduleBrowserStart(LB_FBRO_HANDLE handle);
void DebugTraceOrder(const wchar_t* label, uint64_t id) {
  FILE* f = nullptr;
  _wfopen_s(&f, L"T:/electron/lingbuilder/.lingbuilder-build/fbro-event-order.log", L"a");
  if (!f) return;
  fwprintf(f, L"%s %llu\n", label, id);
  fclose(f);
}

// ---------------------------------------------------------------------------
// 资源响应元数据与正文捕获
//
// “资源响应到达”/“资源加载完成”事件由 Bridge 直接读 CefRequest/CefResponse
// 生成字段：既保留旧的 0/1 标记（request/response），也新增 request_url、
// method、status_code、mime_type、charset 与 headers 对象——官方 SDK 的
// FBroHsResponse_* 能力由此进入 .lcpp 事件字段，不需要额外的取头命令。
// ---------------------------------------------------------------------------

constexpr uint64_t kMaxResourceBodyCaptureBytes = 16ULL * 1024ULL * 1024ULL;
// 与 CEF3 桥 BridgeResponseFilter 相同的流上限：查找/替换字节与流式缓冲的硬上限。
constexpr uint64_t kMaxResourceReplaceBytes = 64ULL * 1024ULL * 1024ULL;

struct ResourceBodyCaptureState {
  std::mutex mutex;
  std::vector<unsigned char> bytes;
  uint64_t max_bytes = 0;
  uint64_t received_bytes = 0;
  std::wstring url;
  std::wstring mime_type;
  int status_code = 0;
  bool truncated = false;
  bool failed = false;
};

std::wstring Base64EncodeBytes(const unsigned char* data, size_t size) {
  static const wchar_t* alphabet = L"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::wstring output;
  output.reserve(((size + 2) / 3) * 4);
  size_t index = 0;
  while (index + 2 < size) {
    const uint32_t triple = (static_cast<uint32_t>(data[index]) << 16)
        | (static_cast<uint32_t>(data[index + 1]) << 8) | data[index + 2];
    output += alphabet[(triple >> 18) & 0x3F];
    output += alphabet[(triple >> 12) & 0x3F];
    output += alphabet[(triple >> 6) & 0x3F];
    output += alphabet[triple & 0x3F];
    index += 3;
  }
  if (index + 1 == size) {
    const uint32_t triple = static_cast<uint32_t>(data[index]) << 16;
    output += alphabet[(triple >> 18) & 0x3F];
    output += alphabet[(triple >> 12) & 0x3F];
    output += L"==";
  } else if (index + 2 == size) {
    const uint32_t triple = (static_cast<uint32_t>(data[index]) << 16)
        | (static_cast<uint32_t>(data[index + 1]) << 8);
    output += alphabet[(triple >> 18) & 0x3F];
    output += alphabet[(triple >> 12) & 0x3F];
    output += alphabet[(triple >> 6) & 0x3F];
    output += L"=";
  }
  return output;
}

std::wstring BuildResourceFieldsJson(CefRefPtr<CefFrame> frame,
                                     CefRefPtr<CefRequest> request,
                                     CefRefPtr<CefResponse> response) {
  std::wstring json = L"{\"browser\":\"1\"";
  json += L",\"frame\":\"" + JsonEscape(frame ? frame->GetURL().ToWString() : L"") + L"\"";
  json += L",\"request\":\"" + std::to_wstring(request ? 1 : 0) + L"\"";
  json += L",\"response\":\"" + std::to_wstring(response ? 1 : 0) + L"\"";
  if (request) {
    json += L",\"request_id\":" + std::to_wstring(request->GetIdentifier());
    json += L",\"request_url\":\"" + JsonEscape(request->GetURL().ToWString()) + L"\"";
    json += L",\"method\":\"" + JsonEscape(request->GetMethod().ToWString()) + L"\"";
  }
  if (response) {
    json += L",\"status_code\":" + std::to_wstring(response->GetStatus());
    json += L",\"mime_type\":\"" + JsonEscape(response->GetMimeType().ToWString()) + L"\"";
    json += L",\"charset\":\"" + JsonEscape(response->GetCharset().ToWString()) + L"\"";
    CefResponse::HeaderMap header_map;
    response->GetHeaderMap(header_map);
    std::wstring headers = L"{";
    bool first = true;
    for (const auto& header : header_map) {
      if (!first) headers += L",";
      first = false;
      headers += L"\"" + JsonEscape(header.first.ToWString()) + L"\":\""
          + JsonEscape(header.second.ToWString()) + L"\"";
    }
    headers += L"}";
    json += L",\"headers\":" + headers;
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

bool DispatchPassiveLegacyEvent(LB_FBRO_HANDLE browser, int code,
                                const std::wstring& fields_json) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  BrowserState* state = Find(browser);
  if (!state || !state->callback) return false;
  state->last_event = EventName(code);
  state->last_event_json = L"{\"eventId\":\"" + JsonEscape(StableEventId(code))
      + L"\",\"event\":\"" + JsonEscape(ChineseEventName(code))
      + L"\",\"officialName\":\"" + JsonEscape(OfficialEventName(code))
      + L"\",\"fields\":" + (fields_json.empty() ? std::wstring(L"{}") : fields_json) + L"}";
  state->callback(state->handle, code, fields_json.c_str(), state->user_data);
  return true;
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

// 有界响应正文捕获过滤器：继承官方 FBroHsResponseFilter 并用
// FBroHsResponseFilter_Create 包装安装（与火山示例一致的唯一受支持路径）。
// 流式透传不改响应内容，只按捕获上限缓存字节；官方 End 回调在输入流结束后
// 触发，此时投递合成事件“资源响应正文到达”。

class LingFbroResourceBodyFilter final : public FBroHsResponseFilter {
 public:
  LingFbroResourceBodyFilter(LB_FBRO_HANDLE handle,
                             std::shared_ptr<ResourceBodyCaptureState> capture)
      : handle_(handle), capture_(std::move(capture)) {}

  void Start(int64_t) override {}
  bool InitFilter(int64_t) override { return capture_ != nullptr; }

  CefResponseFilter::FilterStatus Filter(int64_t, void* data_in, size_t data_in_size,
                                         size_t& data_in_read, void* data_out,
                                         size_t data_out_size,
                                         size_t& data_out_written) override {
    data_in_read = 0;
    data_out_written = 0;
    if ((data_in_size > 0 && !data_in) || (data_out_size > 0 && !data_out)) {
      std::lock_guard<std::mutex> lock(capture_->mutex);
      capture_->failed = true;
      return RESPONSE_FILTER_ERROR;
    }
    if (data_in_size > 0) {
      const size_t readable = std::min(data_in_size, data_out_size);
      if (readable > 0) {
        const auto* bytes = static_cast<const unsigned char*>(data_in);
        {
          std::lock_guard<std::mutex> lock(capture_->mutex);
          capture_->received_bytes += readable;
          const size_t remaining = capture_->bytes.size() < capture_->max_bytes
              ? static_cast<size_t>(capture_->max_bytes - capture_->bytes.size()) : 0;
          const size_t copy_count = std::min(readable, remaining);
          capture_->bytes.insert(capture_->bytes.end(), bytes, bytes + copy_count);
          if (copy_count < readable) capture_->truncated = true;
        }
        std::memcpy(data_out, data_in, readable);
        data_in_read = readable;
        data_out_written = readable;
      }
      return RESPONSE_FILTER_NEED_MORE_DATA;
    }
    return RESPONSE_FILTER_DONE;
  }

  void End(int64_t) override { DispatchResourceBodyEvent(handle_, capture_, L""); }

 private:
  LB_FBRO_HANDLE handle_;
  std::shared_ptr<ResourceBodyCaptureState> capture_;
  IMPLEMENT_REFCOUNTING(LingFbroResourceBodyFilter);
};

// 响应正文查找替换过滤器（非 VIP 能力）：继承官方 FBroHsResponseFilter 并用
// FBroHsResponseFilter_Create 包装安装（与正文捕获同一条唯一受支持路径）。
// 流式 UTF-8 字节查找替换算法与 CEF3 桥 BridgeResponseFilter 一致：输入先进入
// pending 缓冲，按查找字节 std::search 命中后改写，保留 find_bytes_.size()-1
// 字节处理跨块匹配；二进制安全，只改正文不改响应头和状态码。
// capture_ 非空时（与“读资源响应正文”同一请求并存）按原始输入字节捕获，
// 语义与 CEF3 桥一致：正文捕获得到的是服务器原始正文。
class LingFbroResourceReplaceFilter final : public FBroHsResponseFilter {
 public:
  LingFbroResourceReplaceFilter(
      LB_FBRO_HANDLE handle,
      std::shared_ptr<const ResourceReplaceConfig> config,
      std::shared_ptr<ResourceBodyCaptureState> capture = nullptr)
      : handle_(handle), config_(std::move(config)), capture_(std::move(capture)),
        find_bytes_(config_ ? config_->find_bytes : std::vector<unsigned char>()),
        replacement_bytes_(config_ ? config_->replacement_bytes : std::vector<unsigned char>()) {}

  void Start(int64_t) override {}
  bool InitFilter(int64_t) override {
    return !find_bytes_.empty()
        && find_bytes_.size() <= kMaxResourceReplaceBytes
        && replacement_bytes_.size() <= kMaxResourceReplaceBytes;
  }

  CefResponseFilter::FilterStatus Filter(int64_t, void* data_in, size_t data_in_size,
                                         size_t& data_in_read, void* data_out,
                                         size_t data_out_size,
                                         size_t& data_out_written) override {
    data_in_read = 0;
    data_out_written = 0;
    if (failed_ || (data_in_size > 0 && !data_in) || (data_out_size > 0 && !data_out)) {
      failed_ = true;
      if (capture_) {
        std::lock_guard<std::mutex> lock(capture_->mutex);
        capture_->failed = true;
      }
      return RESPONSE_FILTER_ERROR;
    }

    // 流控：只在输出队列排空后继续消费输入，避免输出缓冲不足时 pending 无界增长
    //（与 CEF3 桥 BridgeResponseFilter 相同的策略）。
    if (output_bytes_.empty()) {
      if (data_in_size > kMaxResourceReplaceBytes
          || pending_bytes_.size() > kMaxResourceReplaceBytes - data_in_size) {
        failed_ = true;
      } else if (data_in_size > 0) {
        const auto* bytes = static_cast<const unsigned char*>(data_in);
        pending_bytes_.insert(pending_bytes_.end(), bytes, bytes + data_in_size);
        if (capture_) AddCaptureBytes(bytes, data_in_size);
        data_in_read = data_in_size;
        ProcessPending(false);
      } else {
        end_of_stream_ = true;
        ProcessPending(true);
      }
    }

    if (!failed_ && data_out_size > 0 && !output_bytes_.empty()) {
      data_out_written = std::min(data_out_size, output_bytes_.size());
      auto* output = static_cast<unsigned char*>(data_out);
      for (size_t index = 0; index < data_out_written; ++index) {
        output[index] = output_bytes_.front();
        output_bytes_.pop_front();
      }
    }

    if (failed_) return RESPONSE_FILTER_ERROR;
    if (end_of_stream_ && pending_bytes_.empty() && output_bytes_.empty()) {
      return RESPONSE_FILTER_DONE;
    }
    return RESPONSE_FILTER_NEED_MORE_DATA;
  }

  void End(int64_t) override {
    if (capture_) DispatchResourceBodyEvent(handle_, capture_, L"");
  }

 private:
  bool AppendOutput(const unsigned char* source, size_t count) {
    if (count > kMaxResourceReplaceBytes - output_bytes_.size()) {
      failed_ = true;
      return false;
    }
    output_bytes_.insert(output_bytes_.end(), source, source + count);
    return true;
  }

  bool AppendReplacement() {
    if (replacement_bytes_.size() > kMaxResourceReplaceBytes - output_bytes_.size()) {
      failed_ = true;
      return false;
    }
    output_bytes_.insert(output_bytes_.end(), replacement_bytes_.begin(), replacement_bytes_.end());
    return true;
  }

  void AddCaptureBytes(const unsigned char* bytes, size_t count) {
    std::lock_guard<std::mutex> lock(capture_->mutex);
    capture_->received_bytes += count;
    const size_t remaining = capture_->bytes.size() < capture_->max_bytes
        ? static_cast<size_t>(capture_->max_bytes - capture_->bytes.size()) : 0;
    const size_t copy_count = std::min(count, remaining);
    capture_->bytes.insert(capture_->bytes.end(), bytes, bytes + copy_count);
    if (copy_count < count) capture_->truncated = true;
  }

  void ProcessPending(bool flush_all) {
    while (!failed_ && !pending_bytes_.empty()) {
      const auto match = std::search(
          pending_bytes_.begin(), pending_bytes_.end(),
          find_bytes_.begin(), find_bytes_.end());
      if (match != pending_bytes_.end()) {
        const size_t prefix = static_cast<size_t>(
            std::distance(pending_bytes_.begin(), match));
        if (!AppendOutput(pending_bytes_.data(), prefix) || !AppendReplacement()) return;
        pending_bytes_.erase(pending_bytes_.begin(), match + static_cast<long>(find_bytes_.size()));
        continue;
      }
      // 未命中：除尾部 find_bytes_.size()-1 字节（可能是跨块匹配前缀）外全部输出；
      // 流结束时全部输出。
      const size_t emit_count = flush_all
          ? pending_bytes_.size()
          : (pending_bytes_.size() >= find_bytes_.size()
                 ? pending_bytes_.size() - find_bytes_.size() + 1
                 : 0);
      if (emit_count > 0) {
        if (!AppendOutput(pending_bytes_.data(), emit_count)) return;
        pending_bytes_.erase(pending_bytes_.begin(), pending_bytes_.begin() + static_cast<long>(emit_count));
      }
      return;
    }
  }

  LB_FBRO_HANDLE handle_;
  std::shared_ptr<const ResourceReplaceConfig> config_;
  std::shared_ptr<ResourceBodyCaptureState> capture_;
  const std::vector<unsigned char> find_bytes_;
  const std::vector<unsigned char> replacement_bytes_;
  std::vector<unsigned char> pending_bytes_;
  std::deque<unsigned char> output_bytes_;
  bool end_of_stream_ = false;
  bool failed_ = false;
  IMPLEMENT_REFCOUNTING(LingFbroResourceReplaceFilter);
};

// 独立函数：把捕获结果组装为合成事件字段并派发（End 回调与错误路径共用）。
void DispatchResourceBodyEvent(LB_FBRO_HANDLE handle,
                               const std::shared_ptr<ResourceBodyCaptureState>& capture,
                               const wchar_t* error);

CefRefPtr<CefResponseFilter> TakeResourceBodyFilter(LB_FBRO_HANDLE handle,
                                                    CefRefPtr<CefRequest> request,
                                                    CefRefPtr<CefResponse> response) {
  if (!request) return nullptr;
  DebugTraceOrder(L"GetFilter", request->GetIdentifier());
  std::shared_ptr<ResourceBodyCaptureState> capture;
  std::shared_ptr<const ResourceReplaceConfig> replace;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle);
    if (!state) return nullptr;
    replace = state->resource_replace;
    const auto found = state->resource_body_captures.find(request->GetIdentifier());
    if (found != state->resource_body_captures.end()) {
      capture = found->second;
      state->resource_body_captures.erase(found);
      state->resource_urls.erase(request->GetIdentifier());
    } else if (!replace) {
      return nullptr;
    }
  }
  if (capture) {
    std::lock_guard<std::mutex> lock(capture->mutex);
    capture->status_code = response ? response->GetStatus() : 0;
    capture->mime_type = response ? response->GetMimeType().ToWString() : L"";
  }
  // 官方唯一受支持的安装路径：FBroHsResponseFilter_Create 包装后交给 CEF。
  // 查找替换配置存在时优先走替换过滤器；同一请求同时登记了正文捕获时，
  // 替换过滤器按原始输入字节顺带捕获并在 End 回调派发正文事件。
  if (replace) {
    CefRefPtr<FBroHsResponseFilter> hs_replace =
        new LingFbroResourceReplaceFilter(handle, std::move(replace), std::move(capture));
    return FBroHsResponseFilter_Create(hs_replace);
  }
  CefRefPtr<FBroHsResponseFilter> hs_filter = new LingFbroResourceBodyFilter(handle, std::move(capture));
  return FBroHsResponseFilter_Create(hs_filter);
}

void DispatchResourceBodyEvent(LB_FBRO_HANDLE handle,
                               const std::shared_ptr<ResourceBodyCaptureState>& capture,
                               const wchar_t* error) {
  std::vector<unsigned char> bytes;
  uint64_t received_bytes = 0;
  uint64_t max_bytes = 0;
  std::wstring url;
  std::wstring mime_type;
  int status_code = 0;
  bool truncated = false;
  bool failed = false;
  {
    std::lock_guard<std::mutex> lock(capture->mutex);
    bytes = capture->bytes;
    received_bytes = capture->received_bytes;
    max_bytes = capture->max_bytes;
    url = capture->url;
    mime_type = capture->mime_type;
    status_code = capture->status_code;
    truncated = capture->truncated;
    failed = capture->failed;
  }
  if (bytes.size() > max_bytes) {
    bytes.resize(static_cast<size_t>(max_bytes));
    truncated = true;
  }
  const std::wstring body_text = failed ? std::wstring() : FromUtf8Bytes(
      bytes.empty() ? nullptr : bytes.data(), bytes.size());
  const std::wstring body_base64 = failed ? std::wstring() : Base64EncodeBytes(
      bytes.empty() ? nullptr : bytes.data(), bytes.size());
  std::wstring fields = L"{\"url\":\"" + JsonEscape(url) + L"\"";
  fields += L",\"status_code\":" + std::to_wstring(status_code);
  fields += L",\"mime_type\":\"" + JsonEscape(mime_type) + L"\"";
  fields += L",\"received_bytes\":" + std::to_wstring(received_bytes);
  fields += std::wstring(L",\"truncated\":") + (truncated ? L"true" : L"false");
  fields += std::wstring(L",\"error\":\"" ) + JsonEscape(error) + L"\"";
  fields += L",\"body_text\":\"" + JsonEscape(body_text) + L"\"";
  fields += L",\"body_base64\":\"" + body_base64 + L"\"";
  fields += L"}";
  DispatchGeneratedBrowserEvent(handle, L"fbro.bridge.resource_response_body",
                                L"ResourceResponseBody", L"资源响应正文到达", fields, 0, 0);
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

// ============================================================================
// WS 拦截五事件跨进程中继（火山同款「生成 exe 兼任 CEF 子进程」架构）。
//
// 官方 FBroHsEvent.h 将 VIP WSS 拦截五事件归入 CefRenderProcessHandler 组，
// 在渲染进程触发；火山应用（vipkg_main.cpp）把 browser_subprocess_path 指向
// 自身 exe，FBroHsInitPro 在子进程内注册同一份事件类，五钩子因此直接打到
// 应用代码。本桥同构：LB_FBro_RunCefSubprocessIfRequested 在 CEF 子进程角色
// 里注册 BridgeInitEvent，渲染侧五钩子经本节命名管道中继回浏览器进程派发，
// 篡改响应原路带回渲染进程写回（HANDLE& 出参指针只在渲染进程内有效）。
//
// 依赖的官方公开契约（SDK 升级核对清单，签名漂移即编译失败、行为漂移即冒烟
// 失败；不使用任何官方内部符号、DLL 代理或二进制补丁）：
//   FBroHsInitPro(FBroInitSettings*, CefRefPtr<FBroHsInitEvent>, int)
//   FBroHsInitEvent::OnWebSocketClient{Create,Close,Connect,Message,Send}
//   FBroHsVIPControl_EnableWebsocketClientHook
//   FBroHsWSSClient_{IsNull,GetAddress,GetProtocol,GetExtensions}
//
// 线路协议（事件通道为「每请求一条短连接」的严格锁步问答，杜绝共享长连接的
// 交叉阻塞；查询通道为单条长连接）：
//   渲染 → 浏览器：op=wss-event（五钩子转发；payloadBase64 携带消息载荷）。
//   浏览器 → 渲染：op=wss-query（读取渲染侧 WSS 对象属性，供访问器命令路由）。
// 便捷语义（中继层扩展，不进入官方 API 面）：事件 fields 追加 "text"（载荷
// 可无损 UTF-8 解码时）；响应 JSON 支持 {"text":"..."} 简写，服务端换算为
// data(base64)+size 后交还渲染侧写回。

namespace {

constexpr uint32_t kRelayMaxMessageBytes = 64u << 20;
constexpr DWORD kRelayEventTimeoutMs = 6000;
constexpr DWORD kRelayQueryTimeoutMs = 3000;
// 渲染侧受管句柄加位 30 后再随事件下发，避免与浏览器进程本地句柄（自 2^32
// 起计数，位 30 恒为 0）混淆；加位后数值仍 < 2^33，可安全过 JSON 文本中转。
constexpr LB_FBRO_OBJECT_HANDLE kRemoteWssHandleBias = 0x40000000ULL;

void HookProbe(const wchar_t* stage) {
  FILE* f = nullptr;
  if (_wfopen_s(&f, L"T:/electron/lingbuilder/.lingbuilder-build/fbro-cb-debug.log", L"a") != 0 || !f) return;
  fwprintf(f, L"pid=%lu role=%s %s tick=%lu\n",
           static_cast<unsigned long>(GetCurrentProcessId()),
           g_process_role == BridgeProcessRole::CefSubprocess ? L"sub" : L"browser",
           stage, static_cast<unsigned long>(GetTickCount()));
  fclose(f);
}

bool RelayReadExact(HANDLE pipe, void* buffer, size_t size) {
  auto* cursor = static_cast<unsigned char*>(buffer);
  size_t remaining = size;
  while (remaining > 0) {
    DWORD read_bytes = 0;
    const DWORD chunk = static_cast<DWORD>((std::min)(remaining, static_cast<size_t>(1) << 20));
    if (!ReadFile(pipe, cursor, chunk, &read_bytes, nullptr) || read_bytes == 0) return false;
    cursor += read_bytes;
    remaining -= read_bytes;
  }
  return true;
}

bool RelayWriteAll(HANDLE pipe, const void* buffer, size_t size) {
  const auto* cursor = static_cast<const unsigned char*>(buffer);
  size_t remaining = size;
  while (remaining > 0) {
    DWORD written = 0;
    const DWORD chunk = static_cast<DWORD>((std::min)(remaining, static_cast<size_t>(1) << 20));
    if (!WriteFile(pipe, cursor, chunk, &written, nullptr) || written == 0) return false;
    cursor += written;
    remaining -= written;
  }
  return true;
}

bool RelayReadMessage(HANDLE pipe, std::string& message) {
  uint32_t size = 0;
  if (!RelayReadExact(pipe, &size, sizeof(size))) return false;
  if (size == 0 || size > kRelayMaxMessageBytes) return false;
  message.resize(size);
  return RelayReadExact(pipe, message.data(), size);
}

bool RelayWriteMessage(HANDLE pipe, const std::string& message) {
  if (message.empty() || message.size() > kRelayMaxMessageBytes) return false;
  const uint32_t size = static_cast<uint32_t>(message.size());
  if (!RelayWriteAll(pipe, &size, sizeof(size))) return false;
  return RelayWriteAll(pipe, message.data(), size);
}

CefRefPtr<CefDictionaryValue> RelayParseJson(const std::string& utf8) {
  if (utf8.empty()) return {};
  CefString text;
  if (!text.FromString(utf8)) return {};
  const auto value = CefParseJSON(text, JSON_PARSER_RFC);
  if (!value || value->GetType() != VTYPE_DICTIONARY) return {};
  return value->GetDictionary();
}

// 扁平 JSON 字段操作（BuildSafeFieldsJson 形态：键为简单标识符、值为带引号
// 字符串；数字/句柄一律以十进制字符串承载）。
bool RelayReplaceStringField(std::wstring& json, const std::wstring& key,
                             const std::wstring& value) {
  const std::wstring needle = L"\"" + key + L"\":\"";
  const size_t at = json.find(needle);
  if (at == std::wstring::npos) return false;
  size_t end = at + needle.size();
  while (end < json.size()) {
    if (json[end] == L'"' && json[end - 1] != L'\\') break;
    ++end;
  }
  if (end >= json.size()) return false;
  json.replace(at + needle.size(), end - (at + needle.size()), value);
  return true;
}

void RelayAppendStringField(std::wstring& json, const std::wstring& key,
                            const std::wstring& value) {
  if (json.size() < 2) return;
  const std::wstring field =
      L",\"" + JsonEscape(key) + L"\":\"" + JsonEscape(value) + L"\"";
  json.insert(json.size() - 1, field);
}

bool RelayReadHandleField(const std::wstring& json, const std::wstring& key,
                          LB_FBRO_OBJECT_HANDLE& value) {
  const std::wstring needle = L"\"" + key + L"\":\"";
  const size_t at = json.find(needle);
  if (at == std::wstring::npos) return false;
  size_t cursor = at + needle.size();
  unsigned long long parsed = 0;
  bool any = false;
  while (cursor < json.size() && json[cursor] >= L'0' && json[cursor] <= L'9') {
    parsed = parsed * 10 + static_cast<unsigned long long>(json[cursor] - L'0');
    ++cursor;
    any = true;
  }
  if (!any) return false;
  value = static_cast<LB_FBRO_OBJECT_HANDLE>(parsed);
  return true;
}

bool RelayDecodeStrictUtf8(const std::vector<unsigned char>& bytes, std::wstring& text) {
  if (bytes.empty()) return false;
  const int needed = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
      reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()), nullptr, 0);
  if (needed <= 0) return false;
  text.resize(static_cast<size_t>(needed));
  return MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
      reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()),
      text.data(), needed) > 0;
}

class RelayConnection : public std::enable_shared_from_this<RelayConnection> {
 public:
  using RequestHandler = std::function<std::string(const std::string&)>;
  RelayConnection(HANDLE pipe, RequestHandler handler)
      : pipe_(pipe), handler_(std::move(handler)) {}
  ~RelayConnection() { broken_.store(true); }
  std::mutex write_mutex;

  void SetHandler(RequestHandler handler) { handler_ = std::move(handler); }

  void Start() {
    auto self = shared_from_this();
    std::thread([self] { RelayConnection::ReaderLoop(self); }).detach();
  }

  bool Request(const std::string& body, std::string& response, DWORD timeout_ms) {
    if (broken_.load()) return false;
    const uint64_t seq = next_seq_.fetch_add(1);
    std::string wire = body;
    wire.insert(1, "\"seq\":" + std::to_string(seq) + ",");
    {
      std::lock_guard<std::mutex> lock(write_mutex);
      if (!RelayWriteMessage(pipe_, wire)) {
        broken_.store(true);
        return false;
      }
    }
    std::unique_lock<std::mutex> lock(pending_mutex_);
    const bool done = pending_cv_.wait_for(lock, std::chrono::milliseconds(timeout_ms),
        [&] { return responses_.count(seq) > 0 || broken_.load(); });
    const auto found = responses_.find(seq);
    if (!done || found == responses_.end()) {
      responses_.erase(seq);
      return false;
    }
    response = std::move(found->second);
    responses_.erase(found);
    return true;
  }

  bool IsBroken() const { return broken_.load(); }

 private:
  static void ReaderLoop(std::shared_ptr<RelayConnection> self) {
    for (;;) {
      std::string message;
      if (!RelayReadMessage(self->pipe_, message)) break;
      if (message.find("\"op\":") == std::string::npos) {
        const auto dict = RelayParseJson(message);
        const uint64_t seq = dict ? static_cast<uint64_t>(dict->GetInt("resp")) : 0;
        {
          std::lock_guard<std::mutex> lock(self->pending_mutex_);
          self->responses_.emplace(seq, std::move(message));
        }
        self->pending_cv_.notify_all();
        continue;
      }
      std::string answer;
      if (self->handler_) answer = self->handler_(message);
      if (answer.empty()) answer = "{\"resp\":0,\"action\":0}";
      std::lock_guard<std::mutex> lock(self->write_mutex);
      if (!RelayWriteMessage(self->pipe_, answer)) break;
    }
    self->broken_.store(true);
    self->pending_cv_.notify_all();
  }

  HANDLE pipe_;
  RequestHandler handler_;
  std::mutex pending_mutex_;
  std::condition_variable pending_cv_;
  std::map<uint64_t, std::string> responses_;
  std::atomic<uint64_t> next_seq_{1};
  std::atomic<bool> broken_{false};
};

BrowserState* FindBrowserStateByCefIdentifier(int identifier) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  for (auto& item : g_browsers) {
    if (item.second->browser && item.second->browser->GetIdentifier() == identifier) {
      return item.second.get();
    }
  }
  return nullptr;
}

std::wstring RelayExpandTextTamper(const std::wstring& response_json) {
  if (response_json.empty() || response_json == L"{}") return response_json;
  const auto dict = RelayParseJson(ToUtf8(response_json));
  if (!dict || dict->GetType("text") != VTYPE_STRING) return response_json;
  const std::string utf8 = ToUtf8(dict->GetString("text").ToWString());
  const std::wstring encoded = CefBase64Encode(utf8.c_str(), utf8.size()).ToWString();
  std::wstring rebuilt = L"{\"data\":\"" + encoded + L"\",\"size\":"
      + std::to_wstring(utf8.size()) + L"}";
  std::vector<CefString> keys;
  if (dict->GetKeys(keys)) {
    for (const auto& key : keys) {
      const std::wstring name = key.ToWString();
      if (name == L"text" || name == L"data" || name == L"size") continue;
      if (dict->GetType(key) == VTYPE_STRING) {
        rebuilt.insert(rebuilt.size() - 1,
            L",\"" + JsonEscape(name) + L"\":\""
                + JsonEscape(dict->GetString(key).ToWString()) + L"\"");
      }
    }
  }
  return rebuilt;
}

// 渲染侧读线程：应答浏览器进程的 WSS 对象属性查询。
std::string RelayAnswerWssQuery(const std::string& request_utf8) {
  const auto request = RelayParseJson(request_utf8);
  if (!request || request->GetType("op") != VTYPE_STRING
      || request->GetString("op").ToString() != "wss-query") {
    return "{\"resp\":0,\"ok\":false}";
  }
  const int seq = request->GetInt("seq");
  const auto fail = [seq] {
    return ToUtf8(L"{\"resp\":" + std::to_wstring(seq) + L",\"ok\":false}");
  };
  LB_FBRO_OBJECT_HANDLE handle = 0;
  if (request->GetType("handle") == VTYPE_STRING) {
    handle = static_cast<LB_FBRO_OBJECT_HANDLE>(
        wcstoull(request->GetString("handle").ToWString().c_str(), nullptr, 10));
  } else if (request->GetType("handle") == VTYPE_INT) {
    handle = static_cast<LB_FBRO_OBJECT_HANDLE>(request->GetInt("handle"));
  }
  handle &= ~kRemoteWssHandleBias;
  const std::wstring method = request->GetType("method") == VTYPE_STRING
      ? request->GetString("method").ToWString() : std::wstring();
  int status = LB_FBRO_OK;
  auto state = GetObject(handle, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return fail();
  if (method == L"isNull") {
    return ToUtf8(L"{\"resp\":" + std::to_wstring(seq) + L",\"ok\":true,\"flag\":"
        + std::to_wstring(FBroHsWSSClient_IsNull(state->wss_client) ? 1 : 0) + L"}");
  }
  CefRefPtr<FBroString> value;
  if (method == L"address") value = FBroHsWSSClient_GetAddress(state->wss_client);
  else if (method == L"protocol") value = FBroHsWSSClient_GetProtocol(state->wss_client);
  else if (method == L"extensions") value = FBroHsWSSClient_GetExtensions(state->wss_client);
  else return fail();
  return ToUtf8(L"{\"resp\":" + std::to_wstring(seq) + L",\"ok\":true,\"value\":\""
      + JsonEscape(FromFbroString(value)) + L"\"}");
}

void RelayRegisterRemoteWss(LB_FBRO_OBJECT_HANDLE handle, unsigned long renderer_pid);

// 浏览器进程侧：处理渲染进程转发的五钩子事件，按 CEF 浏览器 ID 找到本地
// BrowserState 同步派发（.lcpp 处理器 + 篡改响应），返回应答报文。
std::string RelayHandleEventRequest(const std::string& request_utf8) {
  const auto request = RelayParseJson(request_utf8);
  const auto respond = [](int seq, int action, const std::wstring& response_json) {
    return ToUtf8(L"{\"resp\":" + std::to_wstring(seq) + L",\"action\":"
        + std::to_wstring(action) + L",\"responseJson\":\""
        + JsonEscape(response_json) + L"\"}");
  };
  if (!request) return respond(0, LB_FBRO_EVENT_ACTION_DEFAULT, L"");
  const int seq = request->GetInt("seq");
  const int browser_id = request->GetInt("browserId");
  const uint32_t flags = static_cast<uint32_t>(request->GetInt("flags"));
  const std::wstring event_id = request->GetType("eventId") == VTYPE_STRING
      ? request->GetString("eventId").ToWString() : std::wstring();
  const std::wstring official_name = request->GetType("officialName") == VTYPE_STRING
      ? request->GetString("officialName").ToWString() : std::wstring();
  const std::wstring event_name = request->GetType("eventName") == VTYPE_STRING
      ? request->GetString("eventName").ToWString() : std::wstring();
  std::wstring fields = request->GetType("fields") == VTYPE_STRING
      ? request->GetString("fields").ToWString() : L"{}";

  LB_FBRO_OBJECT_HANDLE remote_handle = 0;
  RelayReadHandleField(fields, L"websocket", remote_handle);
  if (remote_handle) {
    RelayReplaceStringField(fields, L"websocket",
        std::to_wstring(remote_handle | kRemoteWssHandleBias));
  }

  std::vector<unsigned char> payload;
  if (request->GetType("payloadBase64") == VTYPE_STRING) {
    const std::string encoded = request->GetString("payloadBase64");
    if (!encoded.empty()) {
      if (auto binary = CefBase64Decode(encoded)) {
        const size_t size = static_cast<size_t>(binary->GetSize());
        payload.resize(size);
        if (size > 0) binary->GetData(payload.data(), size, 0);
      }
    }
  }
  if (!payload.empty()) {
    const LB_FBRO_BUFFER_HANDLE local = RegisterBuffer(payload);
    RelayReplaceStringField(fields, L"data", std::to_wstring(local));
  } else {
    RelayReplaceStringField(fields, L"data", L"0");
  }
  std::wstring text;
  if (!payload.empty() && RelayDecodeStrictUtf8(payload, text)) {
    RelayAppendStringField(fields, L"text", text);
  }
  if (remote_handle) {
    RelayRegisterRemoteWss(remote_handle | kRemoteWssHandleBias,
                           GetCurrentProcessId());
  }

  std::wstring response_json;
  int action = LB_FBRO_EVENT_ACTION_DEFAULT;
  if (BrowserState* state = FindBrowserStateByCefIdentifier(browser_id)) {
    action = DispatchEventV3(*state, event_id, official_name, event_name, fields, 0,
                             flags, 0, 0, 0, &response_json);
  }
  return respond(seq, action, RelayExpandTextTamper(response_json));
}

class HookRelayServer {
 public:
  static HookRelayServer& Instance() {
    static HookRelayServer server;
    return server;
  }

  bool Start() {
    std::lock_guard<std::mutex> lock(start_mutex_);
    if (running_.load()) return true;
    wchar_t name[MAX_PATH]{};
    swprintf_s(name, L"\\\\.\\pipe\\LingBuilderFbroHook-%lu",
               static_cast<unsigned long>(GetCurrentProcessId()));
    pipe_name_ = name;
    if (!SetEnvironmentVariableW(L"LINGBUILDER_FBRO_HOOK_PIPE", pipe_name_.c_str())) {
      return false;
    }
    running_.store(true);
    std::thread([this] { AcceptLoop(); }).detach();
    return true;
  }

  // 登记渲染进程的查询通道（pid → 查询连接），并记录远程 WSS 句柄归属。
  void BindQueryChannel(unsigned long renderer_pid,
                        std::shared_ptr<RelayConnection> connection) {
    std::lock_guard<std::mutex> lock(state_mutex_);
    query_channels_[renderer_pid] = std::move(connection);
  }

  void RegisterRemoteWss(LB_FBRO_OBJECT_HANDLE handle, unsigned long renderer_pid) {
    if (!handle) return;
    std::lock_guard<std::mutex> lock(state_mutex_);
    remote_wss_[handle] = renderer_pid;
  }

  bool QueryRemoteWss(LB_FBRO_OBJECT_HANDLE handle, const char* method,
                      std::wstring& value, int& flag) {
    std::shared_ptr<RelayConnection> channel;
    {
      std::lock_guard<std::mutex> lock(state_mutex_);
      const auto found = remote_wss_.find(handle);
      if (found == remote_wss_.end()) return false;
      const auto channel_found = query_channels_.find(found->second);
      if (channel_found == query_channels_.end()) return false;
      channel = channel_found->second;
    }
    if (!channel || channel->IsBroken()) return false;
    std::wstring request = L"{\"op\":\"wss-query\",\"handle\":\""
        + std::to_wstring(handle) + L"\",\"method\":\""
        + JsonEscape(FromUtf8(method)) + L"\"}";
    std::string response;
    if (!channel->Request(ToUtf8(request), response, kRelayQueryTimeoutMs)) return false;
    const auto dict = RelayParseJson(response);
    if (!dict || dict->GetType("ok") != VTYPE_BOOL || !dict->GetBool("ok")) return false;
    if (dict->GetType("flag") == VTYPE_INT) flag = dict->GetInt("flag");
    if (dict->GetType("value") == VTYPE_STRING) value = dict->GetString("value").ToWString();
    return true;
  }

 private:
  HookRelayServer() = default;

  void AcceptLoop() {
    while (running_.load()) {
      HANDLE pipe = CreateNamedPipeW(pipe_name_.c_str(), PIPE_ACCESS_DUPLEX,
          PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT, PIPE_UNLIMITED_INSTANCES,
          1 << 20, 1 << 20, 0, nullptr);
      if (pipe == INVALID_HANDLE_VALUE) {
        if (!running_.load()) break;
        Sleep(200);
        continue;
      }
      BOOL connected = ConnectNamedPipe(pipe, nullptr);
      if (!connected && GetLastError() == ERROR_PIPE_CONNECTED) connected = TRUE;
      if (!connected) {
        CloseHandle(pipe);
        continue;
      }
      HookProbe(L"server-accepted");
      std::thread([pipe] { HookRelayServer::ServeConnection(pipe); }).detach();
    }
  }

  // 每条连接一个服务线程：首条消息 hello → 查询通道长连接（应答 wss-query）；
  // 否则视为一次五钩子事件转发：处理、应答、断开（严格锁步，无共享状态）。
  static void ServeConnection(HANDLE pipe) {
    std::string message;
    if (!RelayReadMessage(pipe, message)) {
      CloseHandle(pipe);
      return;
    }
    const auto first = RelayParseJson(message);
    if (first && first->GetType("op") == VTYPE_STRING
        && first->GetString("op").ToString() == "hello") {
      const unsigned long renderer_pid =
          static_cast<unsigned long>(first->GetInt("pid"));
      auto connection = std::make_shared<RelayConnection>(
          pipe, [](const std::string& request) { return RelayAnswerWssQuery(request); });
      HookRelayServer::Instance().BindQueryChannel(renderer_pid, connection);
      connection->Start();
      return;
    }
    const std::string answer = RelayHandleEventRequest(message);
    RelayWriteMessage(pipe, answer);
    FlushFileBuffers(pipe);
    DisconnectNamedPipe(pipe);
    CloseHandle(pipe);
  }

  std::mutex start_mutex_;
  std::wstring pipe_name_;
  std::atomic<bool> running_{false};
  std::mutex state_mutex_;
  std::map<unsigned long, std::shared_ptr<RelayConnection>> query_channels_;
  std::map<LB_FBRO_OBJECT_HANDLE, unsigned long> remote_wss_;
};

void RelayRegisterRemoteWss(LB_FBRO_OBJECT_HANDLE handle, unsigned long renderer_pid) {
  HookRelayServer::Instance().RegisterRemoteWss(handle, renderer_pid);
}

class HookRelayClient {
 public:
  static HookRelayClient& Instance() {
    static HookRelayClient client;
    return client;
  }

  // 查询通道：连接成功后先发 hello，浏览器据此把 wss-query 路由到本渲染进程。
  bool EnsureConnected() {
    std::lock_guard<std::mutex> lock(connect_mutex_);
    if (connection_ && !connection_->IsBroken()) return true;
    if (pipe_name_.empty()) {
      wchar_t name[MAX_PATH]{};
      if (GetEnvironmentVariableW(L"LINGBUILDER_FBRO_HOOK_PIPE", name, MAX_PATH) == 0) {
        return false;
      }
      pipe_name_ = name;
    }
    for (int attempt = 0; attempt < 20 && !connection_; ++attempt) {
      HANDLE pipe = CreateFileW(pipe_name_.c_str(), GENERIC_READ | GENERIC_WRITE, 0,
                                nullptr, OPEN_EXISTING, 0, nullptr);
      if (pipe != INVALID_HANDLE_VALUE) {
        connection_ = std::make_shared<RelayConnection>(
            pipe, [](const std::string& request) { return RelayAnswerWssQuery(request); });
        connection_->Start();
        const std::wstring hello = L"{\"op\":\"hello\",\"pid\":"
            + std::to_wstring(static_cast<unsigned long>(GetCurrentProcessId())) + L"}";
        {
          std::lock_guard<std::mutex> write_lock(connection_->write_mutex);
          RelayWriteMessage(pipe, ToUtf8(hello));
        }
        break;
      }
      if (GetLastError() != ERROR_PIPE_BUSY) return false;
      WaitNamedPipeW(pipe_name_.c_str(), 200);
    }
    return connection_ && !connection_->IsBroken();
  }

  int DispatchWssEvent(unsigned long renderer_pid, int browser_id,
                       const wchar_t* event_id, const wchar_t* official_name,
                       const wchar_t* event_name, const std::wstring& fields_json,
                       uint32_t flags, std::wstring* response_json) {
    std::wstring fields = fields_json.empty() ? L"{}" : fields_json;
    // 载荷缓冲注册在渲染进程：把字节随事件带给浏览器进程重新注册为本地受管
    // 缓冲，.lcpp 侧 FBro缓冲_* 命令才可读；本地句柄字段清零占位。
    std::string payload_base64;
    LB_FBRO_OBJECT_HANDLE payload_handle = 0;
    if (RelayReadHandleField(fields, L"data", payload_handle) && payload_handle) {
      int status = LB_FBRO_OK;
      auto buffer = GetBuffer(static_cast<LB_FBRO_BUFFER_HANDLE>(payload_handle), status);
      if (buffer && !buffer->bytes.empty()) {
        payload_base64 =
            CefBase64Encode(buffer->bytes.data(), buffer->bytes.size()).ToString();
      }
      RelayReplaceStringField(fields, L"data", L"0");
    }
    LB_FBRO_OBJECT_HANDLE wss_handle = 0;
    if (RelayReadHandleField(fields, L"websocket", wss_handle) && wss_handle) {
      RelayReplaceStringField(fields, L"websocket",
          std::to_wstring(wss_handle | kRemoteWssHandleBias));
    }
    std::wstring request = L"{\"op\":\"wss-event\",\"pid\":"
        + std::to_wstring(static_cast<unsigned long>(renderer_pid))
        + L",\"browserId\":" + std::to_wstring(browser_id) + L",\"eventId\":\""
        + JsonEscape(event_id ? event_id : L"") + L"\",\"officialName\":\""
        + JsonEscape(official_name ? official_name : L"") + L"\",\"eventName\":\""
        + JsonEscape(event_name ? event_name : L"") + L"\",\"flags\":"
        + std::to_wstring(static_cast<unsigned long long>(flags)) + L",\"fields\":\""
        + JsonEscape(fields) + L"\"";
    if (!payload_base64.empty()) {
      request += L",\"payloadBase64\":\"" + FromUtf8(payload_base64.c_str()) + L"\"";
    }
    request += L"}";

    // 每次事件一条短连接：连接 → 写请求 → 读应答 → 关闭，严格锁步。
    for (int attempt = 0; attempt < 20; ++attempt) {
      HANDLE pipe = CreateFileW(pipe_name_.c_str(), GENERIC_READ | GENERIC_WRITE, 0,
                                nullptr, OPEN_EXISTING, 0, nullptr);
      if (pipe == INVALID_HANDLE_VALUE) {
        if (GetLastError() != ERROR_PIPE_BUSY) return LB_FBRO_EVENT_ACTION_DEFAULT;
        WaitNamedPipeW(pipe_name_.c_str(), 200);
        continue;
      }
      if (!RelayWriteMessage(pipe, ToUtf8(request))) {
        CloseHandle(pipe);
        return LB_FBRO_EVENT_ACTION_DEFAULT;
      }
      std::string response;
      const bool ok = RelayReadMessage(pipe, response);
      CloseHandle(pipe);
      if (!ok) return LB_FBRO_EVENT_ACTION_DEFAULT;
      const auto dict = RelayParseJson(response);
      if (!dict) return LB_FBRO_EVENT_ACTION_DEFAULT;
      if (response_json) {
        *response_json = dict->GetType("responseJson") == VTYPE_STRING
            ? dict->GetString("responseJson").ToWString() : std::wstring();
      }
      return dict->GetInt("action");
    }
    return LB_FBRO_EVENT_ACTION_DEFAULT;
  }

 private:
  HookRelayClient() = default;

  std::mutex connect_mutex_;
  std::shared_ptr<RelayConnection> connection_;
  std::wstring pipe_name_;
};

int RelayDispatchWssEventToBrowser(CefRefPtr<CefBrowser> browser, const wchar_t* event_id,
                                   const wchar_t* official_name, const wchar_t* event_name,
                                   const std::wstring& fields_json, uint32_t flags,
                                   std::wstring* response_json) {
  HookProbe(L"relay-dispatch-enter");
  // 实验开关：置 1 时五钩子直通（不中继），用于隔离渲染侧行为。
  if (GetEnvironmentVariableW(L"LINGBUILDER_FBRO_RELAY_DISABLE", nullptr, 0) != 0) {
    return LB_FBRO_EVENT_ACTION_DEFAULT;
  }
  if (!HookRelayClient::Instance().EnsureConnected()) return LB_FBRO_EVENT_ACTION_DEFAULT;
  const int browser_id = browser ? browser->GetIdentifier() : -1;
  return HookRelayClient::Instance().DispatchWssEvent(
      static_cast<unsigned long>(GetCurrentProcessId()), browser_id, event_id,
      official_name, event_name, fields_json, flags, response_json);
}

bool QueryRemoteWssText(LB_FBRO_OBJECT_HANDLE object, const char* method,
                        std::wstring& value, int& flag) {
  return HookRelayServer::Instance().QueryRemoteWss(object, method, value, flag);
}

}  // namespace

// 五钩子稳定事件 ID 的公共前缀（fbro.event.fbrohsinitevent.onwebsocketclient*）。
bool IsRelayedWssEventId(const std::wstring& event_id) {
  return event_id.rfind(L"fbro.event.fbrohsinitevent.onwebsocketclient", 0) == 0;
}

int DispatchGeneratedInitEvent(CefRefPtr<CefBrowser> browser, const wchar_t* event_id,
                               const wchar_t* official_name, const wchar_t* event_name,
                               const std::wstring& fields_json, uint32_t flags,
                               uint32_t max_hz, std::wstring* response_json = nullptr) {
  // 渲染进程角色：五钩子事件经命名管道中继回浏览器进程派发；其余渲染侧回调
  // （生成的 InitEvent override）与官方 FBroSubprocess.exe 薄壳一样缺省放行。
  if (g_process_role == BridgeProcessRole::CefSubprocess) {
    if (event_id && IsRelayedWssEventId(event_id)) {
      HookProbe(L"renderer-hook-entry");
      const int action = RelayDispatchWssEventToBrowser(browser, event_id, official_name,
          event_name, fields_json, flags, response_json);
      HookProbe(L"renderer-hook-exit");
      return action;
    }
    return LB_FBRO_EVENT_ACTION_DEFAULT;
  }
  if (event_id && IsRelayedWssEventId(event_id)) HookProbe(L"browser-hook-entry");
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
  if (!state) {
    if (event_id && IsRelayedWssEventId(event_id)) HookProbe(L"browser-hook-exit-no-state");
    return LB_FBRO_EVENT_ACTION_DEFAULT;
  }
  if (event_id && IsRelayedWssEventId(event_id)) HookProbe(L"browser-hook-exit-dispatch");
  return DispatchEventV3(*state, event_id ? event_id : L"", official_name ? official_name : L"",
                         event_name ? event_name : L"", fields_json, 0, flags, max_hz, 0, 0,
                         response_json);
}

namespace {

// VIP WebSocket 拦截事件的写回辅助：官方层用 new[] 分配的 char* 接管篡改结果，
// 未写回（响应缺省）表示原样放行，与火山示例语义一致。
std::vector<unsigned char> CopyPayloadBytes(const void* data, int size) {
  if (!data || size <= 0 || size > (64 << 20)) return {};
  const auto* begin = static_cast<const unsigned char*>(data);
  return std::vector<unsigned char>(begin, begin + size);
}

char* DuplicateAnsiBytes(const std::string& bytes) {
  char* copy = new char[bytes.size() + 1];
  memcpy(copy, bytes.data(), bytes.size());
  copy[bytes.size()] = '\0';
  return copy;
}

std::string DecodeBase64Value(CefRefPtr<CefDictionaryValue> response, const char* key) {
  if (!response || response->GetType(key) != VTYPE_STRING) return {};
  const CefString encoded = response->GetString(key);
  if (encoded.empty()) return {};
  auto binary = CefBase64Decode(encoded);
  if (!binary) return {};
  const size_t size = static_cast<size_t>(binary->GetSize());
  std::string bytes(size, '\0');
  if (size > 0) binary->GetData(bytes.data(), size, 0);
  return bytes;
}

bool ApplyWssDataReplacement(const std::wstring& response_json, HANDLE& data, int& size) {
  const auto response = ParseEventResponse(response_json);
  if (!response) return false;
  const std::string replacement = DecodeBase64Value(response, "data");
  if (replacement.empty()) return false;
  data = reinterpret_cast<HANDLE>(DuplicateAnsiBytes(replacement));
  size = static_cast<int>(replacement.size());
  return true;
}

}  // namespace


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
    bool require_subscription = true, int timeout_action = LB_FBRO_EVENT_ACTION_CANCEL) {
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
      timeout_action, std::move(completion));
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
  bool OnBeforePopup(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int,
                     const CefString& target_url, const CefString&,
                     CefLifeSpanHandler::WindowOpenDisposition, bool,
                     const CefPopupFeatures&, CefWindowInfo&, CefBrowserSettings&,
                     bool*, CefRefPtr<FBroUseExtraData>) override {
    std::unique_lock<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle_);
    lock.unlock();
    if (state) Notify(*state, LB_FBRO_EVENT_BEFORE_POPUP, target_url.ToWString());
    if (frame && !target_url.empty()) frame->LoadURL(target_url);
    return true;
  }
  void OnBeforeClose(CefRefPtr<CefBrowser>) override {
    CancelContinuationsForBrowser(handle_);
    bool all_browsers_closed = false;
    LB_FBRO_HANDLE recreate_handle = 0;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(handle_)) {
        state->browser = nullptr;
        Notify(*state, LB_FBRO_EVENT_CLOSED, L"浏览器关闭完成");
        if (state->recreate_pending && state->recreate_request_context) {
          // 上下文重建：换上用户上下文后原地重启（递归锁允许锁内调度）。
          state->recreate_pending = false;
          state->request_context = state->recreate_request_context;
          state->recreate_request_context = nullptr;
          state->create_started = false;
          state->extension_load_started = false;
          recreate_handle = state->handle;
        }
      }
      all_browsers_closed = std::all_of(g_browsers.begin(), g_browsers.end(), [](const auto& item) {
        return !item.second->browser;
      });
    }
    if (recreate_handle) ScheduleBrowserStart(recreate_handle);
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
    const LB_FBRO_OBJECT_HANDLE item_object = RegisterDownloadItem(item, handle_);
    const std::wstring fields = BuildSafeFieldsJson({
            {L"downloadId", item ? std::to_wstring(FBroHsDownloadItem_GetDownloadId(item)) : L"0"},
            {L"downloadItem", std::to_wstring(item_object)},
            {L"url", item ? FromFbroString(FBroHsDownloadItem_GetDownloadURL(item)) : L""},
            {L"suggestedName", suggested_name.ToWString()},
            {L"totalBytes", item ? std::to_wstring(FBroHsDownloadItem_GetTotalBytes(item)) : L"0"}});
    if (DispatchManagedBrowserEvent(handle_, L"OnBeforeDownload", fields,
        120000, [callback](int action, const std::wstring& response_json) {
          if (action != LB_FBRO_EVENT_ACTION_CONTINUE) return;
          const auto response = ParseEventResponse(response_json);
          FBroHsBeforeDownloadCallback_Continue(callback,
              CefString(EventResponseString(response, "path")),
              EventResponseBool(response, "showDialog", false));
        })) return true;
    if (!DispatchPassiveLegacyEvent(handle_, LB_FBRO_EVENT_DOWNLOAD_START, fields)) return false;
    FBroHsBeforeDownloadCallback_Continue(callback, CefString(), false);
    return true;
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
    const std::wstring fields = BuildSafeFieldsJson({
            {L"downloadId", item ? std::to_wstring(FBroHsDownloadItem_GetDownloadId(item)) : L"0"},
            {L"downloadItem", std::to_wstring(RegisterDownloadItem(item, handle_))},
            {L"percent", item ? std::to_wstring(FBroHsDownloadItem_GetPercentComplete(item)) : L"-1"},
            {L"receivedBytes", item ? std::to_wstring(FBroHsDownloadItem_GetReceivedBytes(item)) : L"0"},
            {L"totalBytes", item ? std::to_wstring(FBroHsDownloadItem_GetTotalBytes(item)) : L"0"},
            {L"fullPath", item ? FromFbroString(FBroHsDownloadItem_GetFullPath(item)) : L""},
            {L"suggestedName", item ? FromFbroString(FBroHsDownloadItem_GetSuggestedFileName(item)) : L""},
            {L"url", item ? FromFbroString(FBroHsDownloadItem_GetDownloadURL(item)) : L""},
            {L"isInProgress", item && FBroHsDownloadItem_IsInProgress(item) ? L"1" : L"0"},
            {L"isComplete", item && FBroHsDownloadItem_IsComplete(item) ? L"1" : L"0"},
            {L"isCanceled", item && FBroHsDownloadItem_IsCanceled(item) ? L"1" : L"0"},
            {L"currentSpeed", item ? std::to_wstring(FBroHsDownloadItem_GetCurrentSpeed(item)) : L"0"}});
    if (!DispatchManagedBrowserEvent(handle_, L"OnDownloadUpdated", fields,
        120000, [callback](int action, const std::wstring& response_json) {
          const auto response = ParseEventResponse(response_json);
          const int download_action = EventResponseInt(response, "downloadAction",
              action == LB_FBRO_EVENT_ACTION_CONTINUE ? 2 : 0);
          if (download_action == 1) FBroHsBeforeDownloadCallback_Pause(callback);
          else if (download_action == 2) FBroHsBeforeDownloadCallback_Resume(callback);
          else FBroHsBeforeDownloadCallback_Cancel(callback);
        })) {
      DispatchPassiveLegacyEvent(handle_, LB_FBRO_EVENT_DOWNLOAD_UPDATED, fields);
    }
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

  void OnBeforeContextMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                           CefRefPtr<CefContextMenuParams> params,
                           CefRefPtr<CefMenuModel> model) override {
    if (!model || !params) return;
    // 菜单与参数只在本回调期有效：注册为当前线程限定句柄，派发完成后立即回收。
    const LB_FBRO_OBJECT_HANDLE menu_handle = RegisterCefObject(
        LB_FBRO_OBJECT_MENU_MODEL, model, &ObjectState::menu_model, 0, GetCurrentThreadId());
    const LB_FBRO_OBJECT_HANDLE params_handle = RegisterCefObject(
        LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, params, &ObjectState::context_menu_params, 0,
        GetCurrentThreadId());
    std::wstring response;
    DispatchGeneratedBrowserEvent(handle_,
        L"fbro.event.fbrohsbroevent.onbeforecontextmenu.32288e654974",
        L"OnBeforeContextMenu", L"上下文菜单显示前",
        BuildSafeFieldsJson({
            {L"frameUrl", frame ? frame->GetURL().ToWString() : L""},
            {L"menuHandle", std::to_wstring(menu_handle)},
            {L"paramsHandle", std::to_wstring(params_handle)},
            {L"x", std::to_wstring(FBroHsContextMenuParams_pGetXCoord(params))},
            {L"y", std::to_wstring(FBroHsContextMenuParams_pGetYCoord(params))}}),
        0, 0, &response);
    if (!response.empty()) ApplyMenuModelOperations(model, response);
    EraseObjectTree(menu_handle);
    EraseObjectTree(params_handle);
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

  // 手写覆盖：资源响应事件直接读 CefRequest/CefResponse 输出完整字段
  // （请求网址、方法、状态码、MIME、响应头对象）；生成器把这三个事件列在
  // MANAGED_CALLBACK_EVENT_NAMES 中跳过生成，稳定事件 ID 必须与官方签名哈希一致。
  bool OnResourceResponse(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                          CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response) override {
    if (request) {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(handle_)) {
        state->resource_urls[request->GetIdentifier()] = request->GetURL().ToWString();
        if (state->resource_urls.size() > 32) state->resource_urls.erase(state->resource_urls.begin());
      }
      DebugTraceOrder(L"ResponseArrive", request->GetIdentifier());
    }
    const int action = DispatchGeneratedBrowserEvent(handle_,
        L"fbro.event.fbrohsbroevent.onresourceresponse.8841d0c12824",
        L"OnResourceResponse", L"资源响应到达",
        AppendResponseHandleField(BuildResourceFieldsJson(frame, request, response), response),
        LB_FBRO_EVENT_FLAG_SYNCHRONOUS, 0);
    return action == LB_FBRO_EVENT_ACTION_CANCEL || action == LB_FBRO_EVENT_ACTION_HANDLED;
  }
  void OnResourceLoadComplete(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                              CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response,
                              CefResourceRequestHandler::URLRequestStatus status,
                              int64_t received_content_length) override {
    std::wstring fields = BuildResourceFieldsJson(frame, request, response);
    fields.pop_back();
    fields += L",\"response\":" + std::to_wstring(static_cast<long long>(RegisterResponse(response)));
    fields += L",\"status\":" + std::to_wstring(static_cast<long long>(status));
    fields += L",\"received_content_length\":"
        + std::to_wstring(static_cast<long long>(received_content_length));
    fields += L"}";
    DispatchGeneratedBrowserEvent(handle_,
        L"fbro.event.fbrohsbroevent.onresourceloadcomplete.b58a5747af0a",
        L"OnResourceLoadComplete", L"资源加载完成", fields, 0, 0);
  }
  CefRefPtr<CefResponseFilter> GetResourceResponseFilter(CefRefPtr<CefBrowser> browser,
                                                         CefRefPtr<CefFrame> frame,
                                                         CefRefPtr<CefRequest> request,
                                                         CefRefPtr<CefResponse> response) override {
    DispatchGeneratedBrowserEvent(handle_,
        L"fbro.event.fbrohsbroevent.getresourceresponsefilter.1f59120c72bd",
        L"GetResourceResponseFilter", L"资源响应过滤器查询",
        BuildSafeFieldsJson({{L"browser", browser ? L"1" : L"0"},
                             {L"frame", frame ? frame->GetURL().ToWString() : L""},
                             {L"request", request ? L"1" : L"0"},
                             {L"response", response ? L"1" : L"0"}}),
        LB_FBRO_EVENT_FLAG_SYNCHRONOUS, 0);
    return TakeResourceBodyFilter(handle_, request, response);
  }

#define LB_FBRO_BROWSER_EVENT_OVERRIDES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_BROWSER_EVENT_OVERRIDES

 private:
  LB_FBRO_HANDLE handle_;
  IMPLEMENT_REFCOUNTING(BridgeBrowserEvent);
};

bool StartBrowser(BrowserState& state) {
  if (!g_ready || state.create_started
      || (!state.chrome_ui && !state.background && !IsWindow(state.host))) return false;
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
  // 用户经 FBro会话_创建上下文+使用上下文重建 注入的 RequestContext 优先；
  // 仅在没有任何现成上下文时才按 profile 目录创建隔离上下文。
  if (!state.request_context && !state.profile.empty()) {
    CefRequestContextSettings context_settings{};
    CefString(&context_settings.cache_path).FromWString(state.profile);
    context_settings.persist_session_cookies = true;
    // Keep the C# FBro VIP ordering: create an isolated RequestContext, load
    // the unpacked extension into it, then create the browser that owns it.
    // Deferring LoadExtension to OnRequestContextInitialized proved unreliable
    // for this FBro build because the first navigation could win that race.
    state.request_context = CefRequestContext::CreateContext(context_settings, nullptr);
  }
  if (state.request_context && !state.user_agent.empty()) {
    auto value = CefValue::Create();
    value->SetString(state.user_agent);
    auto error = FBroString_Creat();
    FBroHsRequestContext_SetPreference(state.request_context, CefString("general.useragent.override"), value, error);
  }
  if (state.request_context && !state.extension_directory.empty() && g_extension_plus_enabled
      && !state.extension_load_started) {
    state.extension_load_started = true;
    FBroHsVIPRequestContext_LoadExtension(state.request_context, state.extension_directory);
  } else if (!state.extension_directory.empty() && !g_extension_plus_enabled) {
    const std::wstring extension_directory = state.extension_directory;
    state.extension_directory.clear();
    Notify(state, LB_FBRO_EVENT_VIP_LIFECYCLE,
           L"{\"phase\":\"extension\",\"status\":\"failed\","
           L"\"extensionId\":\"\",\"path\":\"" + JsonEscape(extension_directory)
           + L"\",\"error\":\"FBro VIP 授权不可用，浏览器插件未加载。\"}");
  }
  auto extra = CefDictionaryValue::Create();
  extra->SetString("flag", "LingBuilderFbroBridge");
  if (!state.extra_info_json.empty()) {
    auto parsed = CefParseJSON(CefString(state.extra_info_json), JSON_PARSER_RFC);
    if (parsed && parsed->GetType() == VTYPE_DICTIONARY) {
      auto incoming = parsed->GetDictionary();
      CefDictionaryValue::KeyList keys;
      incoming->GetKeys(keys);
      for (const auto& key : keys) {
        if (!extra->HasKey(key)) extra->SetValue(key, incoming->GetValue(key));
      }
    } else {
      state.last_error = L"附加信息 JSON 需为对象";
    }
  }
  if (state.background) {
    // 后台创建：无窗口信息，事件仍通过 state.event 正常分发。
    if (!FBroHsCreateBackground(CefString(state.url.empty() ? L"about:blank" : state.url),
                                &settings, state.request_context, extra, state.event,
                                nullptr, CefString(std::to_wstring(state.handle)))) {
      state.create_started = false;
      Notify(state, LB_FBRO_EVENT_ERROR, L"FBroHsCreateBackground 创建浏览器失败");
      return false;
    }
    return true;
  }
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
    BrowserState* state = nullptr;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (g_shutdown_started) return;
      state = Find(handle_);
    }
    // 绝不能在 g_mutex 下执行 StartBrowser：浏览器创建会对主窗口宿主 HWND 做
    // 跨线程窗口操作（SetWindowLong 等），必须等主线程消息泵应答；若主线程此刻
    // 正在桥接调用里等这把锁（创建完毕处理器里的任何 FBro_ 命令都会），就会形成
    // “CEF 线程持锁等主窗口应答 / 主线程等锁”的互等死锁。浏览器启动只发生在
    // CEF UI 线程，StartBrowser 内的状态写入因此无需这把锁保护。
    if (state) StartBrowser(*state);
  }

 private:
  LB_FBRO_HANDLE handle_;
  IMPLEMENT_REFCOUNTING(BridgeBrowserStartTask);
};

void ScheduleBrowserStart(LB_FBRO_HANDLE handle) {
  if (!g_ready || g_shutdown_started) return;
  if (CefCurrentlyOn(TID_UI)) {
    BrowserState* state = nullptr;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      state = Find(handle);
    }
    // 同 BridgeBrowserStartTask：锁外执行 StartBrowser，避免跨线程窗口操作死锁。
    if (state) StartBrowser(*state);
    return;
  }
  if (!CefPostTask(TID_UI, new BridgeBrowserStartTask(handle))) {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle)) Notify(*state, LB_FBRO_EVENT_ERROR, L"无法投递 FBro 浏览器创建任务");
  }
}

void StartPendingBrowsers() {
  std::vector<BrowserState*> pending;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    pending.reserve(g_browsers.size());
    for (auto& item : g_browsers) pending.push_back(item.second.get());
  }
  // 同 BridgeBrowserStartTask：锁外执行 StartBrowser，避免跨线程窗口操作死锁。
  for (auto* state : pending) StartBrowser(*state);
}

void SecureClearPendingLicenseCredential() {
  if (!g_pending_license_credential.empty()) {
    SecureZeroMemory(g_pending_license_credential.data(),
                     g_pending_license_credential.size() * sizeof(wchar_t));
    g_pending_license_credential.clear();
    g_pending_license_credential.shrink_to_fit();
  }
  g_pending_credential_sets_browser_license = false;
}

std::wstring RedactLicenseCredential(std::wstring error,
                                     const std::vector<wchar_t>& credential);

// The online VIP licence check runs through FBrowserVIP -> FBrowserCEF3lib ->
// libcef, so it must run AFTER FBroHsInitPro. Calling it earlier makes libcef
// fail a CHECK (0x80000003) and kills the host process. It must still complete
// before any browser is created, so the VIP extension hooks that content
// scripts depend on are active by then.
bool ApplyPendingLicenseAfterInitialize() {
  std::vector<wchar_t> credential;
  bool set_browser_license = false;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    credential.swap(g_pending_license_credential);
    set_browser_license = g_pending_credential_sets_browser_license;
    g_pending_credential_sets_browser_license = false;
  }
  if (credential.empty()) {
    return !g_license_attempted || g_license_valid;
  }

  const CefString license_credential(credential.data());
  if (set_browser_license) {
    FBroHsBrowser_SetLicenceKey(license_credential);
  }
  const bool license_valid = FBroHsOnlineLicenseControl_SetKey(license_credential) == TRUE;
  std::wstring license_error;
  if (!license_valid) {
    license_error = RedactLicenseCredential(
        FromFbroString(FBroHsOnlineLicenseControl_GetError()), credential);
    if (license_error.empty()) license_error = L"FBro VIP 授权码无效";
  }
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_license_valid = license_valid;
    g_license_error = std::move(license_error);
  }

  SecureZeroMemory(credential.data(), credential.size() * sizeof(wchar_t));
  credential.clear();
  credential.shrink_to_fit();
  return license_valid;
}

std::wstring RedactLicenseCredential(std::wstring error,
                                     const std::vector<wchar_t>& credential) {
  if (credential.size() <= 1) return error;
  const std::wstring supplied(credential.data(), credential.size() - 1);
  size_t position = 0;
  while (!supplied.empty()
         && (position = error.find(supplied, position)) != std::wstring::npos) {
    error.replace(position, supplied.size(), L"[已隐藏]");
    position += 5;
  }
  return error;
}

void RejectPendingExtensions(const std::wstring& error) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  for (auto& [handle, state] : g_browsers) {
    (void)handle;
    if (!state || state->extension_directory.empty()) continue;
    const std::wstring extension_directory = state->extension_directory;
    state->extension_directory.clear();
    state->extension_id.clear();
    const std::wstring payload = L"{\"phase\":\"extension\",\"status\":\"failed\","
        L"\"extensionId\":\"\",\"path\":\"" + JsonEscape(extension_directory)
        + L"\",\"error\":\"" + JsonEscape(error) + L"\"}";
    Notify(*state, LB_FBRO_EVENT_VIP_LIFECYCLE, payload);
  }
}

void NotifyExtensionContext(CefRefPtr<CefRequestContext> request_context,
                            const wchar_t* status,
                            const CefString& extension_id = CefString(),
                            const CefString& path = CefString(),
                            const CefString& error = CefString()) {
  std::filesystem::path event_path(path.ToWString());
  if (event_path.empty() && request_context && !extension_id.empty()
      && g_extension_plus_enabled) {
    event_path = FromFbroString(FBroHsVIPRequestContext_GetExtensionPath(
        request_context, extension_id));
  }
  // OnCreateExtension is also raised for FBro/Chromium built-in extensions.
  // Those callbacks do not carry a filesystem path and must not be treated as
  // the user-configured extension merely because only one browser exists.
  if ((status && (wcscmp(status, L"loaded") == 0 || wcscmp(status, L"failed") == 0))
      && event_path.empty()) {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    const bool known_extension = std::any_of(
        g_browsers.begin(), g_browsers.end(), [&extension_id](const auto& item) {
          return item.second && !extension_id.empty()
              && item.second->extension_id == extension_id.ToWString();
        });
    if (!known_extension) return;
  }
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  const bool startup_extension_event = !g_startup_extension_directory.empty()
      && !event_path.empty()
      && AbsoluteNormalizedPath(event_path)
          == AbsoluteNormalizedPath(g_startup_extension_directory);
  if (startup_extension_event) {
    g_startup_extension_status = status ? status : L"";
    g_startup_extension_id = extension_id.ToWString();
    g_startup_extension_event_path = event_path.wstring();
    g_startup_extension_error = error.ToWString();
  }
  for (auto& [handle, state] : g_browsers) {
    (void)handle;
    if (!state) continue;
    const bool same_context = state->request_context && request_context
        && request_context->IsSame(state->request_context);
    const bool same_path = !event_path.empty() && !state->extension_directory.empty()
        && AbsoluteNormalizedPath(event_path)
            == AbsoluteNormalizedPath(state->extension_directory);
    const bool single_configured_browser = g_browsers.size() == 1
        && !state->extension_directory.empty();
    if (!same_context && !same_path && !single_configured_browser) continue;
    if (!event_path.empty() && !state->extension_directory.empty()) {
      const auto configured = AbsoluteNormalizedPath(state->extension_directory);
      const auto failed = AbsoluteNormalizedPath(event_path);
      if (configured != failed && !IsChildPath(configured, failed)) continue;
    }
    if (status && wcscmp(status, L"failed") == 0 && event_path.empty()
        && (state->extension_id.empty() || state->extension_id != extension_id.ToWString())) continue;
    if (status && wcscmp(status, L"removed") == 0
        && !state->extension_id.empty() && state->extension_id != extension_id.ToWString()) continue;
    if (status && wcscmp(status, L"loaded") == 0 && !extension_id.empty()
        && state->extension_id.empty()) {
      state->extension_id = extension_id.ToWString();
    }
    const std::wstring payload = L"{\"phase\":\"extension\",\"status\":\""
        + JsonEscape(status ? status : L"")
        + L"\",\"extensionId\":\"" + JsonEscape(extension_id.ToWString())
        + L"\",\"path\":\"" + JsonEscape(event_path.empty() && state
            ? state->extension_directory : event_path.wstring())
        + L"\",\"error\":\"" + JsonEscape(error.ToWString()) + L"\"}";
    Notify(*state, LB_FBRO_EVENT_VIP_LIFECYCLE, payload);
  }
}

namespace {

/** 生成器烘焙的开关 JSON 形态受控（{"key":true,...}），纯字符串判定，避免 CEF 值 API 在初始化前未注册包装而 FATAL。 */
bool SwitchJsonEnabled(const std::wstring& json, const wchar_t* key) {
  const std::wstring needle = std::wstring(L"\"") + key + L"\"";
  size_t pos = json.find(needle);
  while (pos != std::wstring::npos) {
    pos += needle.size();
    while (pos < json.size() && (json[pos] == L' ' || json[pos] == L'\t')) ++pos;
    if (pos < json.size() && json[pos] == L':') {
      ++pos;
      while (pos < json.size() && (json[pos] == L' ' || json[pos] == L'\t')) ++pos;
      if (json.compare(pos, 4, L"true") == 0) return true;
    }
    pos = json.find(needle, pos);
  }
  return false;
}

/** 把烘焙的启动开关应用到给定的 CEF 命令行对象（权威时机为 OnBeforeCommandLineProcessing）。 */
void ApplyStartupSwitchesTo(const std::wstring& json, CefRefPtr<CefCommandLine> command_line) {
  if (SwitchJsonEnabled(json, L"disableGpu")) FBroHsCommandLine_DisableGpu(command_line);
  if (SwitchJsonEnabled(json, L"disableGpuCache")) FBroHsCommandLine_DisableGpuCache(command_line);
  if (SwitchJsonEnabled(json, L"disableGpuBlockList")) FBroHsCommandLine_DisableGpuBlockList(command_line);
  if (SwitchJsonEnabled(json, L"enableMediaStream")) FBroHsCommandLine_EnableMediaStream(command_line);
  if (SwitchJsonEnabled(json, L"enableSpeechInput")) FBroHsCommandLine_EnableSpeechInput(command_line);
  if (SwitchJsonEnabled(json, L"enableAutoplay")) FBroHsCommandLine_EnableAutoplayPoliey(command_line);
  // headless 是 CEF 进程级开关：启用后本进程所有浏览器均无窗口渲染，不得与可见 FBro 控件混用。
  if (SwitchJsonEnabled(json, L"headless")) FBroHsCommandLine_EnableHeadless(command_line);
}

}  // namespace

class BridgeInitEvent final : public FBroHsInitEvent {
 public:
  BridgeInitEvent() { type_ = InitEventType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void OnBeforeCommandLineProcessing(const CefString& process_type,
                                     CefRefPtr<CefCommandLine> command_line) override {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    // 启动开关只对浏览器进程生效一次（子进程回调只用于透传）；此处是官方唯一可写时机。
    if (command_line && process_type.empty() && !g_startup_switches_json.empty()) {
      ApplyStartupSwitchesTo(g_startup_switches_json, command_line);
      g_startup_command_line = FromFbroString(FBroHsCommandLine_GetString(command_line));
    }
    if (command_line && g_extension_plus_requested) {
      command_line->AppendSwitch("enable-chrome-runtime");
    }
    if (command_line && !g_vip_proxy_url.empty()) {
      FBroHsVIPCommandLine_SetProxy(command_line, g_vip_proxy_url,
                                    g_vip_proxy_user, g_vip_proxy_password);
    }
  }
  void OnContextInitialized() override {
    if (g_extension_plus_requested && !g_extension_plus_enabled) {
      RejectPendingExtensions(g_license_error.empty()
          ? L"FBro VIP 授权无效，浏览器插件未加载。" : g_license_error);
    }
    g_ready = true;
    StartPendingBrowsers();
  }
  void OnCreateExtension(CefRefPtr<CefRequestContext> request_context,
                         const CefString& extension_id) override {
    NotifyExtensionContext(request_context, L"loaded", extension_id);
  }
  void OnCreateExtensionError(CefRefPtr<CefRequestContext> request_context,
                              const CefString& extension_id,
                              const CefString& path,
                              const CefString& error) override {
    NotifyExtensionContext(request_context, L"failed", extension_id, path, error);
  }
  void OnAddExtension(CefRefPtr<CefRequestContext> request_context,
                      const CefString& extension_id) override {
    NotifyExtensionContext(request_context, L"loaded", extension_id);
  }
  void OnRemoveExtension(CefRefPtr<CefRequestContext> request_context,
                         const CefString& extension_id) override {
    NotifyExtensionContext(request_context, L"removed", extension_id);
  }
  // ---- VIP WebSocket 客户端拦截五事件（手写覆盖）----
  // wss 客户端注册为持久受管句柄（LB_FBro_ObjectRelease 释放），数据载荷复制进
  // 受管缓冲；同步事件支持经响应 JSON 篡改写回：连接改 url/protocols（UTF-8），
  // 消息/发送改 data（Base64）+size，缺省不写回即原样放行。
  void OnWebSocketClientCreate(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                               CefRefPtr<FBroDOMWssClient> websocket) override {
    DispatchWssLifecycleEvent(browser, frame, websocket,
        L"fbro.event.fbrohsinitevent.onwebsocketclientcreate.d39fa3514858",
        L"OnWebSocketClientCreate", L"初始化WebSocket客户端创建");
  }
  void OnWebSocketClientClose(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                              CefRefPtr<FBroDOMWssClient> websocket) override {
    DispatchWssLifecycleEvent(browser, frame, websocket,
        L"fbro.event.fbrohsinitevent.onwebsocketclientclose.c31f8ced04b4",
        L"OnWebSocketClientClose", L"初始化WebSocket客户端关闭");
  }
  void OnWebSocketClientConnect(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                CefRefPtr<FBroDOMWssClient> websocket, HANDLE& returl,
                                HANDLE& protocols) override {
    const LB_FBRO_OBJECT_HANDLE wss = RegisterCefObject(
        LB_FBRO_OBJECT_WSS_CLIENT, websocket, &ObjectState::wss_client);
    const std::wstring current_url =
        returl ? FromUtf8(static_cast<const char*>(returl)) : std::wstring();
    const std::wstring current_protocols =
        protocols ? FromUtf8(static_cast<const char*>(protocols)) : std::wstring();
    std::wstring response_json;
    DispatchGeneratedInitEvent(browser,
        L"fbro.event.fbrohsinitevent.onwebsocketclientconnect.14c3d07078ae",
        L"OnWebSocketClientConnect", L"初始化WebSocket客户端连接",
        BuildSafeFieldsJson({
            {L"websocket", std::to_wstring(wss)},
            {L"url", current_url},
            {L"protocols", current_protocols}}),
        LB_FBRO_EVENT_FLAG_SYNCHRONOUS, 0, &response_json);
    const auto response = ParseEventResponse(response_json);
    // 与火山示例一致：未写回（响应缺省）时置 NULL 表示放行原值，避免官方层
    // 把保留的原指针当作替换缓冲接管释放。
    const std::string new_url = response ? DecodeBase64Value(response, "url") : std::string();
    const std::string new_protocols =
        response ? DecodeBase64Value(response, "protocols") : std::string();
    returl = new_url.empty() ? nullptr : reinterpret_cast<HANDLE>(DuplicateAnsiBytes(new_url));
    protocols = new_protocols.empty()
        ? nullptr
        : reinterpret_cast<HANDLE>(DuplicateAnsiBytes(new_protocols));
  }
  bool OnWebSocketClientMessage(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                CefRefPtr<FBroDOMWssClient> websocket, int type,
                                HANDLE& data, int& size) override {
    return DispatchWssDataEvent(browser, frame, websocket, type, data, size,
        L"fbro.event.fbrohsinitevent.onwebsocketclientmessage.394aa56d3766",
        L"OnWebSocketClientMessage", L"初始化WebSocket客户端消息");
  }
  bool OnWebSocketClientSend(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                             CefRefPtr<FBroDOMWssClient> websocket, int type,
                             HANDLE& retdata, int offsize, int& size) override {
    (void)offsize;
    return DispatchWssDataEvent(browser, frame, websocket, type, retdata, size,
        L"fbro.event.fbrohsinitevent.onwebsocketclientsend.1e4294bbc5cf",
        L"OnWebSocketClientSend", L"初始化WebSocket客户端发送");
  }

#define LB_FBRO_INIT_EVENT_OVERRIDES
#include "FbroEventOverrides.generated.inc"
#undef LB_FBRO_INIT_EVENT_OVERRIDES
 private:
  void DispatchWssLifecycleEvent(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                 CefRefPtr<FBroDOMWssClient> websocket, const wchar_t* event_id,
                                 const wchar_t* official_name, const wchar_t* event_name) {
    const LB_FBRO_OBJECT_HANDLE wss = RegisterCefObject(
        LB_FBRO_OBJECT_WSS_CLIENT, websocket, &ObjectState::wss_client);
    DispatchGeneratedInitEvent(browser, event_id, official_name, event_name,
        BuildSafeFieldsJson({
            {L"websocket", std::to_wstring(wss)},
            {L"frame", frame ? frame->GetURL().ToWString() : L""}}), 0, 0);
  }
  bool DispatchWssDataEvent(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                            CefRefPtr<FBroDOMWssClient> websocket, int type, HANDLE& data,
                            int& size, const wchar_t* event_id, const wchar_t* official_name,
                            const wchar_t* event_name) {
    const LB_FBRO_OBJECT_HANDLE wss = RegisterCefObject(
        LB_FBRO_OBJECT_WSS_CLIENT, websocket, &ObjectState::wss_client);
    const LB_FBRO_BUFFER_HANDLE payload =
        RegisterBuffer(CopyPayloadBytes(data, size));
    std::wstring response_json;
    const int action = DispatchGeneratedInitEvent(browser, event_id, official_name, event_name,
        BuildSafeFieldsJson({
            {L"websocket", std::to_wstring(wss)},
            {L"type", std::to_wstring(static_cast<long long>(type))},
            {L"data", std::to_wstring(payload)},
            {L"size", std::to_wstring(static_cast<long long>(size))}}),
        LB_FBRO_EVENT_FLAG_SYNCHRONOUS, 0, &response_json);
    if (!ApplyWssDataReplacement(response_json, data, size)) {
      // 与火山示例一致：未篡改置 NULL 表示放行原值，防止官方层接管释放原指针。
      data = nullptr;
    }
    return action == LB_FBRO_EVENT_ACTION_CANCEL || action == LB_FBRO_EVENT_ACTION_HANDLED;
  }
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
        + L",\"session\":" + std::wstring(cookie->has_expires ? L"false" : L"true")
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

class BridgeSetCookieCallback final : public CefSetCookieCallback {
 public:
  explicit BridgeSetCookieCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {}

  void OnComplete(bool success) override {
    CompleteTextTask(task_, success ? L"{\"success\":true}" : L"",
                     success ? L"" : L"FBro 设置 Cookie 失败");
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeSetCookieCallback);
};

class BridgeCookieFlushCallback final : public CefCompletionCallback {
 public:
  explicit BridgeCookieFlushCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {}

  void OnComplete() override {
    CompleteTextTask(task_, L"{\"success\":true}");
  }

 private:
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeCookieFlushCallback);
};

enum class CookieTaskOperation { VisitAll, VisitUrl, Set, SetJson, Delete, Flush };

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
    } else if (operation_ == CookieTaskOperation::Set || operation_ == CookieTaskOperation::SetJson) {
      CefCookie cookie{};
      if (operation_ == CookieTaskOperation::SetJson) {
        const auto parsed_value = CefParseJSON(CefString(arguments_[1]), JSON_PARSER_RFC);
        const auto parsed = parsed_value && parsed_value->GetType() == VTYPE_DICTIONARY
            ? parsed_value->GetDictionary() : nullptr;
        if (!parsed || parsed->GetType("name") != VTYPE_STRING || parsed->GetString("name").empty()) {
          CompleteTextTask(task_, L"", L"Cookie JSON 缺少有效 name");
          return;
        }
        const auto read_string = [&](const char* key) {
          return parsed->GetType(key) == VTYPE_STRING ? parsed->GetString(key).ToWString() : std::wstring();
        };
        const auto read_bool = [&](const char* key, bool fallback) {
          return parsed->GetType(key) == VTYPE_BOOL ? parsed->GetBool(key) : fallback;
        };
        const auto read_int = [](CefRefPtr<CefDictionaryValue> dictionary, const char* key, int fallback) {
          return dictionary && dictionary->GetType(key) == VTYPE_INT ? dictionary->GetInt(key) : fallback;
        };
        CefString(&cookie.name) = read_string("name");
        CefString(&cookie.value) = read_string("value");
        CefString(&cookie.domain) = read_string("domain");
        const std::wstring cookie_path = read_string("path");
        CefString(&cookie.path) = cookie_path.empty() ? L"/" : cookie_path;
        cookie.secure = read_bool("secure", false) ? 1 : 0;
        cookie.httponly = read_bool("httpOnly", false) ? 1 : 0;
        const bool session = read_bool("session", false);
        const auto expires = parsed->GetType("expires") == VTYPE_DICTIONARY
            ? parsed->GetDictionary("expires") : nullptr;
        cookie.has_expires = !session && expires;
        if (cookie.has_expires) {
          cef_time_t expires_time{};
          expires_time.year = read_int(expires, "year", 0);
          expires_time.month = read_int(expires, "month", 0);
          expires_time.day_of_month = read_int(expires, "day", 0);
          expires_time.hour = read_int(expires, "hour", 0);
          expires_time.minute = read_int(expires, "minute", 0);
          expires_time.second = read_int(expires, "second", 0);
          expires_time.millisecond = read_int(expires, "millisecond", 0);
          SYSTEMTIME system_time{};
          system_time.wYear = static_cast<WORD>(expires_time.year);
          system_time.wMonth = static_cast<WORD>(expires_time.month);
          system_time.wDay = static_cast<WORD>(expires_time.day_of_month);
          system_time.wHour = static_cast<WORD>(expires_time.hour);
          system_time.wMinute = static_cast<WORD>(expires_time.minute);
          system_time.wSecond = static_cast<WORD>(expires_time.second);
          system_time.wMilliseconds = static_cast<WORD>(expires_time.millisecond);
          FILETIME file_time{};
          if (!SystemTimeToFileTime(&system_time, &file_time)
              || !cef_time_to_basetime(&expires_time, &cookie.expires)) {
            CompleteTextTask(task_, L"", L"Cookie JSON 的 expires 无效");
            return;
          }
        }
        cookie.same_site = static_cast<cef_cookie_same_site_t>((std::max)(0, (std::min)(3, read_int(parsed, "sameSite", 0))));
        cookie.priority = static_cast<cef_cookie_priority_t>((std::max)(0, (std::min)(3, read_int(parsed, "priority", 0))));
      } else {
        CefString(&cookie.name) = arguments_[1];
        CefString(&cookie.value) = arguments_[2];
        CefString(&cookie.domain) = arguments_[3];
        CefString(&cookie.path) = arguments_[4].empty() ? L"/" : arguments_[4];
        cookie.secure = secure_ != 0;
        cookie.httponly = http_only_ != 0;
      }
      CefRefPtr<BridgeSetCookieCallback> callback = new BridgeSetCookieCallback(task_);
      accepted = manager->SetCookie(CefString(arguments_[0]), cookie, callback);
      if (!accepted) CompleteTextTask(task_, L"", L"FBro 拒绝提交 Cookie 写入");
      return;
    } else if (operation_ == CookieTaskOperation::Delete) {
      accepted = FBroHsCookieManager_DeleteCookies(manager, CefString(arguments_[0]), CefString(arguments_[1]));
      CompleteTextTask(task_, accepted ? L"{\"accepted\":true}" : L"",
                       accepted ? L"" : L"FBro 拒绝删除 Cookie");
      return;
    } else {
      CefRefPtr<BridgeCookieFlushCallback> callback = new BridgeCookieFlushCallback(task_);
      accepted = manager->FlushStore(callback);
      if (!accepted) CompleteTextTask(task_, L"", L"FBro 拒绝刷新 Cookie 存储");
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

/** 从根级 JSON 数组构造受管键值映射，形状：[{"name":"...","value":"..."}]。 */
CefRefPtr<FBroDoubleString> CreateDoubleStringFromEntriesJson(const wchar_t* json) {
  auto parsed = CefParseJSON(CefString(json && *json ? json : L"[]"), JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_LIST) return nullptr;
  auto entries = parsed->GetList();
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
      std::wstring extension_path = FromFbroString(
          FBroHsVIPRequestContext_GetExtensionPath(context, extension_id));
      if (extension_path.empty() && !context->IsGlobal()) {
        extension_path = FromFbroString(FBroHsVIPRequestContext_GetExtensionPath(
            CefRequestContext::GetGlobalContext(), extension_id));
      }
      CompleteTextTask(task_, L"{\"value\":\"" + JsonEscape(extension_path) + L"\"}");
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
  LB_FBRO_INITIALIZE_OPTIONS_V1 options{};
  options.struct_size = sizeof(options);
  options.abi_version = LB_FBRO_INITIALIZE_OPTIONS_VERSION_V1;
  options.runtime_directory = runtime_directory;
  options.remote_debugging_port = 0;
  return LB_FBro_InitializeEx(&options);
}

int __stdcall LB_FBro_SetStartupSwitches(const wchar_t* switches_json) {
  g_startup_switches_json = switches_json ? switches_json : L"";
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_GetStartupCommandLine(wchar_t* result, size_t capacity) {
  return CopyResult(g_startup_command_line, result, capacity);
}

int __stdcall LB_FBro_InitializeEx(const LB_FBRO_INITIALIZE_OPTIONS_V1* options) {
  if (g_initialized) return 1;
  if (!options || options->struct_size < sizeof(LB_FBRO_INITIALIZE_OPTIONS_V1)
      || options->abi_version != LB_FBRO_INITIALIZE_OPTIONS_VERSION_V1) return -1;
  const wchar_t* runtime_directory = options->runtime_directory;
  if (!runtime_directory || !*runtime_directory) return -1;
  if (options->remote_debugging_port != 0
      && (options->remote_debugging_port < 1024 || options->remote_debugging_port > 65535)) return -1;
  g_shutdown_started = false;
  g_license_attempted = false;
  g_license_valid = false;
  g_extension_plus_requested = false;
  g_extension_plus_enabled = false;
  g_license_error.clear();
  SecureClearPendingLicenseCredential();
  g_ready = false;
  g_startup_extension_directory.clear();
  g_startup_extension_status.clear();
  g_startup_extension_id.clear();
  g_startup_extension_event_path.clear();
  g_startup_extension_error.clear();
  g_runtime_directory = runtime_directory;
  wchar_t root_cache_override[32768]{};
  const DWORD root_cache_length = GetEnvironmentVariableW(
      L"LINGBUILDER_FBRO_ROOT_CACHE_DIRECTORY", root_cache_override,
      static_cast<DWORD>(_countof(root_cache_override)));
  g_root_cache_directory = root_cache_length > 0 && root_cache_length < _countof(root_cache_override)
      ? AbsoluteNormalizedPath(root_cache_override)
      : AbsoluteNormalizedPath(g_runtime_directory / L".fbro-global-cache");
  SetEnvironmentVariableW(L"LINGBUILDER_FBRO_ROOT_CACHE_DIRECTORY", nullptr);
  std::error_code cache_error;
  std::filesystem::create_directories(g_root_cache_directory, cache_error);
  WSADATA winsock{};
  if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) return -3;
  g_winsock_started = true;
  // 火山同款架构（可选）：browser_subprocess_path 指向生成 exe 自身，由
  // wWinMain 最先调用的 LB_FBro_RunCefSubprocessIfRequested 承接子进程角色。
  // 旧生成工程未设 use_self_subprocess 时保持官方 FBroSubprocess.exe 薄壳。
  const bool use_self_subprocess =
      options->struct_size
          >= offsetof(LB_FBRO_INITIALIZE_OPTIONS_V1, use_self_subprocess)
              + sizeof(int32_t)
      && options->use_self_subprocess != 0;
  wchar_t self_executable[MAX_PATH]{};
  if (use_self_subprocess) GetModuleFileNameW(nullptr, self_executable, MAX_PATH);
  const auto subprocess = use_self_subprocess && self_executable[0]
      ? std::filesystem::path(self_executable)
      : g_runtime_directory / L"FBroSubprocess.exe";
  // 命名管道中继服务端必须在 FBroHsInitPro（即 CEF 首个子进程派生）之前就绪，
  // 管道名经环境变量继承给子进程；启动失败仅降级（五钩子事件缺省放行）。
  HookRelayServer::Instance().Start();
  const auto cache = g_root_cache_directory;
  const auto log = g_root_cache_directory / L"fbro.log";
  const auto locales = g_runtime_directory / L"locales";
  const std::string runtime_ansi = ToAnsi(g_runtime_directory.wstring());
  const std::string subprocess_ansi = ToAnsi(subprocess.wstring());
  const std::string cache_ansi = ToAnsi(cache.wstring());
  const std::string log_ansi = ToAnsi(log.wstring());
  const std::string locales_ansi = ToAnsi(locales.wstring());
  wchar_t proxy_url[4096]{};
  wchar_t proxy_user[4096]{};
  wchar_t proxy_password[4096]{};
  wchar_t disable_auto_multiple[8]{};
  const bool auto_multiple_disabled = GetEnvironmentVariableW(
      L"LINGBUILDER_FBRO_DISABLE_AUTO_MULTIPLE", disable_auto_multiple,
      static_cast<DWORD>(_countof(disable_auto_multiple))) > 0;
  SetEnvironmentVariableW(L"LINGBUILDER_FBRO_DISABLE_AUTO_MULTIPLE", nullptr);
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
  wchar_t authorization_code[4096]{};
  const DWORD authorization_length = GetEnvironmentVariableW(
      L"LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE", authorization_code,
      static_cast<DWORD>(_countof(authorization_code)));
  SetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE", nullptr);
  wchar_t vip_key[4096]{};
  const DWORD vip_key_length = GetEnvironmentVariableW(
      L"LINGBUILDER_FBRO_VIP_KEY", vip_key, static_cast<DWORD>(_countof(vip_key)));
  SetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_KEY", nullptr);
  g_license_attempted = authorization_length > 0 || vip_key_length > 0;
  if (authorization_length > 0 && authorization_length < _countof(authorization_code)) {
    g_pending_license_credential.assign(
        authorization_code, authorization_code + authorization_length);
    g_pending_license_credential.push_back(L'\0');
  } else if (vip_key_length > 0 && vip_key_length < _countof(vip_key)) {
    g_pending_license_credential.assign(vip_key, vip_key + vip_key_length);
    g_pending_license_credential.push_back(L'\0');
    g_pending_credential_sets_browser_license = true;
  } else if (g_license_attempted) {
    g_license_error = L"FBro VIP 授权码长度无效";
  }
  g_extension_plus_requested = !g_pending_license_credential.empty();
  SecureZeroMemory(authorization_code, sizeof(authorization_code));
  SecureZeroMemory(vip_key, sizeof(vip_key));
  wchar_t startup_extension[32768]{};
  const DWORD startup_extension_length = GetEnvironmentVariableW(
      L"LINGBUILDER_FBRO_STARTUP_EXTENSION", startup_extension,
      static_cast<DWORD>(_countof(startup_extension)));
  SetEnvironmentVariableW(L"LINGBUILDER_FBRO_STARTUP_EXTENSION", nullptr);
  if (startup_extension_length > 0
      && startup_extension_length < _countof(startup_extension)) {
    g_startup_extension_directory.assign(startup_extension, startup_extension_length);
  }
  SecureZeroMemory(startup_extension, sizeof(startup_extension));
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
  settings.remote_debugging_port = options->remote_debugging_port;
  settings.enable_auto_multiple = auto_multiple_disabled ? FALSE : TRUE;
  g_init_event = new BridgeInitEvent();
  g_vip_event = new BridgeVipEvent();
  FBroSetVipEvent(g_vip_event);
  // 启动开关不在此处应用：GetGlobalCommandLine 在 CefInitialize 前是空对象，
  // 官方唯一可写时机是 BridgeInitEvent::OnBeforeCommandLineProcessing（InitPro 内部回调）。
  if (!FBroHsInitPro(&settings, g_init_event, 1024)) {
    SecureClearPendingLicenseCredential();
    g_init_event = nullptr;
    g_vip_event = nullptr;
    WSACleanup();
    g_winsock_started = false;
    return -2;
  }
  // The online VIP licence check runs through FBrowserVIP -> FBrowserCEF3lib ->
  // libcef, so it must not execute before CEF exists. Calling it earlier makes
  // libcef fail a CHECK (0x80000003) and kills the host process; a full crash
  // dump resolved the faulting frame to LB_FBro_InitializeEx -> FBrowserVIP.
  // The reference C# app gets away with the reverse order because it applies the
  // code in a plain GUI process, not inside the CEF host itself.
  if (!ApplyPendingLicenseAfterInitialize() && g_extension_plus_requested) {
    // Keep running so ordinary browser functionality remains available;
    // extension requests will receive a precise VIP authorization failure.
    g_extension_plus_enabled = false;
  }
  if (g_extension_plus_requested && g_license_valid) {
    FBroHsVIPRequestContext_EnableExtensionPlus();
    g_extension_plus_enabled = true;
  }
  g_initialized = true;
  return 1;
}

int __stdcall LB_FBro_IsReady(void) { return g_ready ? 1 : 0; }

// CEF 子进程角色入口（火山同款：生成的 exe 兼任 browser_subprocess_path）。
// 由生成的 wWinMain 在任何初始化之前调用：命令行含 --type=（renderer/gpu/
// utility 等）时，与官方 FBroSubprocess.exe 薄壳一样以 FBroHsInitPro 进入
// 子进程流程（内部阻塞至子进程退出），并因注册了 BridgeInitEvent 而让 WS
// 拦截五钩子在渲染进程可达（事件经命名管道中继回浏览器进程）。非子进程
// 角色立即返回 LB_FBRO_CEF_SUBPROCESS_NOT_REQUESTED，调用方继续正常启动。
int __stdcall LB_FBro_RunCefSubprocessIfRequested(void) {
  int argument_count = 0;
  wchar_t** arguments = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  if (!arguments) return LB_FBRO_CEF_SUBPROCESS_NOT_REQUESTED;
  bool subprocess_role = false;
  for (int index = 1; index < argument_count; ++index) {
    if (wcsncmp(arguments[index], L"--type=", 7) == 0) {
      subprocess_role = true;
      break;
    }
  }
  LocalFree(arguments);
  if (!subprocess_role) return LB_FBRO_CEF_SUBPROCESS_NOT_REQUESTED;

  static std::atomic<bool> entered{false};
  if (entered.exchange(true)) return 0;
  g_process_role = BridgeProcessRole::CefSubprocess;

  wchar_t self_executable[MAX_PATH]{};
  GetModuleFileNameW(nullptr, self_executable, MAX_PATH);
  std::filesystem::path runtime_directory = std::filesystem::path(self_executable);
  g_runtime_directory = runtime_directory.parent_path();
  g_root_cache_directory =
      AbsoluteNormalizedPath(g_runtime_directory / L".fbro-global-cache");
  std::error_code cache_error;
  std::filesystem::create_directories(g_root_cache_directory, cache_error);
  const std::string runtime_ansi = ToAnsi(g_runtime_directory.wstring());
  const std::string subprocess_ansi = ToAnsi(std::wstring(self_executable));
  const std::string cache_ansi = ToAnsi(g_root_cache_directory.wstring());
  const std::string log_ansi = ToAnsi((g_root_cache_directory / L"fbro.log").wstring());
  const std::string locales_ansi = ToAnsi((g_runtime_directory / L"locales").wstring());
  FBroSetV8DefaultsHeapSize(4, 2048);
  FBroInitSettings settings{};
  settings.no_sandbox = TRUE;
  settings.browser_subprocess_path = const_cast<char*>(subprocess_ansi.c_str());
  settings.multi_threaded_message_loop = TRUE;
  settings.external_message_pump = FALSE;
  settings.windowless_rendering_enabled = FALSE;
  settings.command_line_args_disabled = FALSE;
  settings.cache_path = const_cast<char*>(cache_ansi.c_str());
  settings.locale = const_cast<char*>("zh-CN");
  settings.accept_language_list = const_cast<char*>("zh-CN,zh,en");
  settings.log_file = const_cast<char*>(log_ansi.c_str());
  settings.log_severity = LOGSEVERITY_DEFAULT;
  settings.resources_dir_path = const_cast<char*>(runtime_ansi.c_str());
  settings.locales_dir_path = const_cast<char*>(locales_ansi.c_str());
  // 渲染进程不得重复预留 CDP 调试端口；浏览器进程已消费 VIP 环境变量，此处
  // 亦不做授权/扩展钩子（火山在非浏览器进程直接跳过这些步骤）。
  settings.remote_debugging_port = 0;
  // 实验开关：LINGBUILDER_FBRO_PLAIN_RENDERER=1 时渲染分支注册裸事件类
  // （与官方 FBroSubprocess.exe 薄壳一致），用于对照排查。
  wchar_t plain_renderer[8]{};
  const bool use_plain_renderer =
      GetEnvironmentVariableW(L"LINGBUILDER_FBRO_PLAIN_RENDERER", plain_renderer,
                              _countof(plain_renderer)) > 0
      && wcscmp(plain_renderer, L"1") == 0;
  g_init_event = use_plain_renderer ? new FBroHsInitEvent() : new BridgeInitEvent();
  if (!FBroHsInitPro(&settings, g_init_event, 1024)) {
    g_init_event = nullptr;
    return 1;
  }
  g_init_event = nullptr;
  return 0;
}

int __stdcall LB_FBro_GetVipLicenseInfoJson(wchar_t* result, size_t capacity) {
  const auto text = [](CefRefPtr<FBroString> value) { return JsonEscape(FromFbroString(value)); };
  const bool ready = g_ready.load();
  std::wstring license_error;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    license_error = g_license_error;
  }
  std::wstring json = L"{";
  json += L"\"licenseAttempted\":" + std::wstring(g_license_attempted ? L"true" : L"false") + L",";
  json += L"\"licenseValid\":" + std::wstring(g_license_valid ? L"true" : L"false") + L",";
  json += L"\"extensionPlusRequested\":" + std::wstring(g_extension_plus_requested ? L"true" : L"false") + L",";
  json += L"\"extensionPlusEnabled\":" + std::wstring(g_extension_plus_enabled ? L"true" : L"false") + L",";
  json += L"\"sdkReportsLicense\":"
      + std::wstring(ready && FBroBrowser_IsLicenceKey() ? L"true" : L"false") + L",";
  json += L"\"machineCode\":\"" + (ready ? text(FBroHsBrowser_GetMachineCode()) : L"") + L"\",";
  json += L"\"expirationTime\":\"" + (ready ? text(FBroHsBrowser_GetExpirationTime()) : L"") + L"\",";
  json += L"\"registrationTime\":\"" + (ready ? text(FBroHsBrowser_GetRegistrationTime()) : L"") + L"\",";
  json += L"\"version\":\"" + (ready ? text(FBroHsBrowser_GetVersionStr()) : L"") + L"\",";
  json += L"\"functions\":\"" + (ready ? text(FBroHsBrowser_GetFunctionStr()) : L"") + L"\",";
  json += L"\"licenseType\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseType()) : L"") + L"\",";
  json += L"\"licenseStartDate\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseStartDate()) : L"") + L"\",";
  json += L"\"licenseEndDate\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseEndDate()) : L"") + L"\",";
  json += L"\"devTools\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseDevTool()) : L"") + L"\",";
  json += L"\"licensedFunctions\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseFunction()) : L"") + L"\",";
  json += L"\"systemVersion\":\"" + (ready ? text(FBroHsOnlineLicenseControl_GetShowLicenseSysVersion()) : L"") + L"\",";
  json += L"\"error\":\"" + JsonEscape(license_error) + L"\"}";
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
  return LB_FBro_CreateEx2(host, url, profile_directory, user_agent, L"", flags, callback, user_data);
}

LB_FBRO_HANDLE __stdcall LB_FBro_CreateEx2(HWND host, const wchar_t* url,
                                           const wchar_t* profile_directory,
                                           const wchar_t* user_agent,
                                           const wchar_t* extension_directory,
                                           unsigned int flags,
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
  state->extension_directory = extension_directory ? extension_directory : L"";
  state->flags = flags;
  state->callback = callback;
  state->user_data = user_data;
  const LB_FBRO_HANDLE handle = state->handle;
  bool should_start = false;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    g_browsers.emplace(handle, std::move(state));
    auto* inserted = Find(handle);
    if (inserted && !inserted->extension_directory.empty()
        && !g_startup_extension_status.empty()
        && AbsoluteNormalizedPath(inserted->extension_directory)
            == AbsoluteNormalizedPath(g_startup_extension_directory)) {
      if (g_startup_extension_status == L"loaded") {
        inserted->extension_id = g_startup_extension_id;
      }
      const std::wstring payload = L"{\"phase\":\"extension\",\"status\":\""
          + JsonEscape(g_startup_extension_status) + L"\",\"extensionId\":\""
          + JsonEscape(g_startup_extension_id) + L"\",\"path\":\""
          + JsonEscape(g_startup_extension_event_path) + L"\",\"error\":\""
          + JsonEscape(g_startup_extension_error) + L"\"}";
      Notify(*inserted, LB_FBRO_EVENT_VIP_LIFECYCLE, payload);
    }
    should_start = g_ready && !g_shutdown_started;
  }
  if (should_start) ScheduleBrowserStart(handle);
  return handle;
}

LB_FBRO_HANDLE __stdcall LB_FBro_CreateBackground(const wchar_t* url,
                                                  const wchar_t* profile_directory,
                                                  const wchar_t* extra_info_json,
                                                  LB_FBRO_EVENT_CALLBACK callback,
                                                  void* user_data) {
  if (!g_initialized) return 0;
  auto state = std::make_unique<BrowserState>();
  state->handle = g_next_handle.fetch_add(1);
  state->background = true;
  state->url = url ? url : L"about:blank";
  std::wstring profile_warning;
  state->profile = ResolveProfileDirectory(profile_directory ? profile_directory : L"", state->handle,
                                           profile_warning).wstring();
  state->last_error = profile_warning;
  state->extra_info_json = extra_info_json ? extra_info_json : L"";
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
int __stdcall LB_FBro_SendKeyEvent(LB_FBRO_HANDLE browser, int type, long long modifiers,
                                   int windows_key_code, int native_key_code, int is_system_key,
                                   int character, int unmodified_character,
                                   int focus_on_editable_field) {
  E_KEYEVENT event = {};
  event.type = type;
  event.modifiers = static_cast<int>(modifiers);
  event.windows_key_code = windows_key_code;
  event.native_key_code = native_key_code;
  event.is_system_key = is_system_key;
  event.h_character = static_cast<char>((character >> 8) & 0xFF);
  event.character = static_cast<char>(character & 0xFF);
  event.h_unmodified_character = static_cast<char>((unmodified_character >> 8) & 0xFF);
  event.unmodified_character = static_cast<char>(unmodified_character & 0xFF);
  event.focus_on_editable_field = focus_on_editable_field;
  return WithBrowser(browser, [&event](auto value) {
    FBroHsBrowserHost_SendKeyEvent(value, &event);
  });
}
int __stdcall LB_FBro_SendMouseClickEvent(LB_FBRO_HANDLE browser, int button_type, int x, int y,
                                          long long modifiers, int mouse_up, int click_count) {
  E_MOUSEEVENT event = {};
  event.x = x;
  event.y = y;
  event.modifiers = static_cast<int>(modifiers);
  return WithBrowser(browser, [&event, button_type, mouse_up, click_count](auto value) {
    FBroHsBrowserHost_SendMouseClickEvent(value, static_cast<CefBrowserHost::MouseButtonType>(button_type),
                                          &event, mouse_up != 0, click_count);
  });
}
int __stdcall LB_FBro_SendMouseMoveEvent(LB_FBRO_HANDLE browser, int x, int y, long long modifiers,
                                         int mouse_leave) {
  E_MOUSEEVENT event = {};
  event.x = x;
  event.y = y;
  event.modifiers = static_cast<int>(modifiers);
  return WithBrowser(browser, [&event, mouse_leave](auto value) {
    FBroHsBrowserHost_SendMouseMoveEvent(value, &event, mouse_leave != 0);
  });
}
int __stdcall LB_FBro_SendMouseWheelEvent(LB_FBRO_HANDLE browser, int x, int y, long long modifiers,
                                          int delta_x, int delta_y) {
  E_MOUSEEVENT event = {};
  event.x = x;
  event.y = y;
  event.modifiers = static_cast<int>(modifiers);
  return WithBrowser(browser, [&event, delta_x, delta_y](auto value) {
    FBroHsBrowserHost_SendMouseWheelEvent(value, &event, delta_x, delta_y);
  });
}
int __stdcall LB_FBro_SendTouchEvent(LB_FBRO_HANDLE browser, int type, long long modifiers,
                                     int pointer_type, int touch_id, double x, double y,
                                     double radius_x, double radius_y, double rotation_angle,
                                     double pressure) {
  E_TOUCH_EVENT event = {};
  event.type = type;
  event.modifiers = static_cast<int>(modifiers);
  event.pointer_type = pointer_type;
  event.id = touch_id;
  event.x = static_cast<float>(x);
  event.y = static_cast<float>(y);
  event.radius_x = static_cast<float>(radius_x);
  event.radius_y = static_cast<float>(radius_y);
  event.rotation_angle = static_cast<float>(rotation_angle);
  event.pressure = static_cast<float>(pressure);
  return WithBrowser(browser, [&event](auto value) {
    FBroHsBrowserHost_SendTouchEvent(value, &event);
  });
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
namespace {
/** 在 UI 线程执行一次浏览器动作并完成的通用任务（窗口类操作专用）。 */
class BridgeUiActionTask final : public CefTask {
 public:
  BridgeUiActionTask(LB_FBRO_HANDLE browser, std::function<void(CefRefPtr<CefBrowser>)> action,
                     std::shared_ptr<TaskState> task, std::wstring error)
      : browser_(browser), action_(std::move(action)), task_(std::move(task)),
        missing_error_(std::move(error)) {}
  void Execute() override {
    CefRefPtr<CefBrowser> browser;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      if (auto* state = Find(browser_)) browser = state->browser;
    }
    if (!browser) {
      CompleteTextTask(task_, L"", missing_error_);
      return;
    }
    action_(browser);
    CompleteTextTask(task_, L"{\"success\":true}");
  }

 private:
  LB_FBRO_HANDLE browser_;
  std::function<void(CefRefPtr<CefBrowser>)> action_;
  std::shared_ptr<TaskState> task_;
  std::wstring missing_error_;
  IMPLEMENT_REFCOUNTING(BridgeUiActionTask);
};
}  // namespace

int __stdcall LB_FBro_GetWindowHandle(LB_FBRO_HANDLE browser, int64_t* window) {
  if (!window) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int64_t value = 0;
  const int status = WithBrowser(browser, [&value](auto item) {
    value = reinterpret_cast<int64_t>(FBroHsBrowserHost_GetWindowHandle(item));
  });
  if (status > 0) *window = value;
  return status;
}
int __stdcall LB_FBro_GetOpenerWindowHandle(LB_FBRO_HANDLE browser, int64_t* window) {
  if (!window) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int64_t value = 0;
  const int status = WithBrowser(browser, [&value](auto item) {
    value = reinterpret_cast<int64_t>(FBroHsBrowserHost_GetOpenerWindowHandle(item));
  });
  if (status > 0) *window = value;
  return status;
}
int __stdcall LB_FBro_GetParentWindowHandle(LB_FBRO_HANDLE browser, int64_t* window) {
  if (!window) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int64_t value = 0;
  const int status = WithBrowser(browser, [&value](auto item) {
    value = reinterpret_cast<int64_t>(FBroHsBrowserHost_GetParent(item));
  });
  if (status > 0) *window = value;
  return status;
}
int __stdcall LB_FBro_GetRuntimeStyle(LB_FBRO_HANDLE browser) {
  int result = 0;
  const int status = WithBrowser(browser, [&result](auto item) { result = FBroHsBrowserHost_GetRuntimeStyle(item); });
  return status > 0 ? result : status;
}
int __stdcall LB_FBro_GetSdkVersionJson(wchar_t* result, size_t capacity) {
  std::wstring json = L"{\"main\":" + std::to_wstring(FBroHsVersion_GetMain())
      + L",\"edit\":" + std::to_wstring(FBroHsVersion_GetEdit())
      + L",\"debug\":" + std::to_wstring(FBroHsVersion_GetDedug()) + L"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_GetInstanceCount(void) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  size_t count = 0;
  for (const auto& entry : g_browsers) {
    if (entry.second->browser) ++count;
  }
  return static_cast<int>(count);
}
int __stdcall LB_FBro_GetInstanceHandlesJson(wchar_t* result, size_t capacity) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  std::wstring json = L"[";
  bool first = true;
  for (const auto& entry : g_browsers) {
    if (!entry.second->browser) continue;
    if (!first) json += L",";
    first = false;
    json += std::to_wstring(entry.first);
  }
  json += L"]";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_GetInstanceFlagsJson(wchar_t* result, size_t capacity) {
  // 创建标记即 StartBrowser 传入的实例句柄字符串；仅统计仍存活的实例。
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  std::wstring json = L"[";
  bool first = true;
  for (const auto& entry : g_browsers) {
    if (!entry.second->browser) continue;
    if (!first) json += L",";
    first = false;
    json += L"\"" + std::to_wstring(entry.first) + L"\"";
  }
  json += L"]";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_IsInstanceAlive(LB_FBRO_HANDLE browser) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  return state && state->browser ? 1 : 0;
}
int __stdcall LB_FBro_IsGlobalRequestContext(LB_FBRO_HANDLE browser) {
  CefRefPtr<CefRequestContext> context;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(browser)) context = state->request_context;
  }
  if (!context) {
    context = FBroHsRequestContext_GetGlobalContext();
    if (!context) return LB_FBRO_ERROR_OPERATION_FAILED;
  }
  return FBroHsRequestContext_IsGlobal(context) ? 1 : 0;
}
int __stdcall LB_FBro_GetRequestContextCachePath(LB_FBRO_HANDLE browser, wchar_t* result,
                                                 size_t capacity) {
  CefRefPtr<CefRequestContext> context;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(browser)) context = state->request_context;
  }
  const bool global = !context;
  if (!context) {
    context = FBroHsRequestContext_GetGlobalContext();
    if (!context) return LB_FBRO_ERROR_OPERATION_FAILED;
  }
  const std::wstring path = FromFbroString(FBroHsRequestContext_GetCachePath(context));
  std::wstring json = L"{\"global\":" + std::wstring(global ? L"true" : L"false")
      + L",\"cachePath\":\"" + JsonEscape(path) + L"\"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_GetBrowserFlag(LB_FBRO_HANDLE browser, wchar_t* result, size_t capacity) {
  std::wstring flag;
  const int status = WithBrowser(browser, [&flag](auto item) {
    flag = FromFbroString(FBroHsBrowser_GetFlag(item));
  });
  if (status > 0) return CopyResult(flag, result, capacity);
  return status;
}
int __stdcall LB_FBro_GetBrowserExtraInfoJson(LB_FBRO_HANDLE browser, wchar_t* result,
                                              size_t capacity) {
  std::wstring json = L"{}";
  const int status = WithBrowser(browser, [&json](auto item) {
    if (auto extra = FBroHsBrowser_GetExtrainfo(item)) {
      auto value = CefValue::Create();
      value->SetDictionary(extra);
      const auto serialized = CefWriteJSON(value, JSON_WRITER_DEFAULT).ToWString();
      if (!serialized.empty()) json = serialized;
    }
  });
  if (status > 0) return CopyResult(json, result, capacity);
  return status;
}
int __stdcall LB_FBro_CreateDataUri(const wchar_t* mime_type, const wchar_t* data,
                                    wchar_t* result, size_t capacity) {
  if (!data) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  auto uri = FBroHsGetDataURI(CefString(mime_type ? mime_type : L""),
                              CefString(data));
  if (!uri) return LB_FBRO_ERROR_OPERATION_FAILED;
  return CopyResult(FromFbroString(uri), result, capacity);
}
int __stdcall LB_FBro_IsBufferValid(LB_FBRO_BUFFER_HANDLE buffer) {
  int status = LB_FBRO_OK;
  const auto state = GetBuffer(buffer, status);
  return status == LB_FBRO_OK ? 1 : 0;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ShowDevToolsWindowAsync(LB_FBRO_HANDLE browser,
                                                              const wchar_t* title, int x, int y,
                                                              int width, int height,
                                                              LB_FBRO_TASK_CALLBACK callback,
                                                              void* user_data) {
  if (!browser) return 0;
  CefRefPtr<FBroHsBroEvent> browser_event;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(browser)) browser_event = state->event;
  }
  auto task = CreateTask(callback, user_data);
  const std::wstring title_value = title && *title ? title : L"DevTools";
  CefRefPtr<BridgeUiActionTask> start = new BridgeUiActionTask(
      browser,
      [title_value, x, y, width, height, browser_event](CefRefPtr<CefBrowser> value) {
        FBroBrowserSetting setting{};
        setting.is_null = TRUE;
        E_ELEMENT_AT element_at{};
        Event_Disable_Control event_control{};
        FBroHsBrowserHost_ShowDevTools(value, CefString(title_value), nullptr, x, y, width,
                                       height, &setting, &element_at, browser_event,
                                       &event_control);
      },
      task, L"浏览器尚未创建");
  ScheduleManagedTask(start, task, L"无法投递开发者工具窗口任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_MoveBrowserWindowAsync(LB_FBRO_HANDLE browser, int x, int y,
                                                             int width, int height,
                                                             LB_FBRO_TASK_CALLBACK callback,
                                                             void* user_data) {
  if (!browser || width <= 0 || height <= 0) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeUiActionTask> start = new BridgeUiActionTask(
      browser,
      [x, y, width, height](CefRefPtr<CefBrowser> value) {
        FBroHsBrowserHost_MoveWindow(value, x, y, width, height, TRUE);
      },
      task, L"浏览器尚未创建");
  ScheduleManagedTask(start, task, L"无法投递浏览器窗口移动任务");
  return task->handle;
}
namespace {
/** URL 请求客户端：完成时把 CefURLRequest 注册为受管对象并回传状态 JSON。 */
class BridgeUrlRequestClient final : public FBroHsURLRequestClient {
 public:
  explicit BridgeUrlRequestClient(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = URLRequestClientType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void OnRequestComplete(int64_t flag, CefRefPtr<CefURLRequest> request) override {
    (void)flag;
    LB_FBRO_OBJECT_HANDLE handle = 0;
    int status_code = 0;
    int error_code = 0;
    bool cached = false;
    if (request) {
      auto state = std::make_shared<ObjectState>();
      state->handle = g_next_object_handle.fetch_add(1);
      state->type = LB_FBRO_OBJECT_URL_REQUEST;
      state->owner_thread = 0;
      state->url_request = request;
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        g_objects.emplace(state->handle, state);
      }
      handle = state->handle;
      status_code = FBroHsURLRequest_GetRequestStatus(request);
      error_code = FBroHsURLRequest_GetRequestError(request);
      cached = FBroHsURLRequest_ResponseWasCached(request) ? true : false;
    }
    std::wstring json = L"{\"urlRequest\":" + std::to_wstring(handle)
        + L",\"status\":" + std::to_wstring(status_code)
        + L",\"error\":" + std::to_wstring(error_code)
        + L",\"cached\":" + std::wstring(cached ? L"true" : L"false") + L"}";
    CompleteTextTask(task_, json);
  }

 private:
  std::shared_ptr<TaskState> task_;
};

/** URL 请求发起任务：UI 线程内创建，失败立即完成，成功由客户端回调完成。 */
class BridgeUrlRequestStartTask final : public CefTask {
 public:
  BridgeUrlRequestStartTask(CefRefPtr<CefRequest> request, CefRefPtr<CefRequestContext> context,
                            CefRefPtr<BridgeUrlRequestClient> client,
                            CefRefPtr<CefFrame> frame, std::shared_ptr<TaskState> task)
      : request_(std::move(request)), context_(std::move(context)), client_(std::move(client)),
        frame_(std::move(frame)), task_(std::move(task)) {}
  void Execute() override {
    if (frame_) {
      FBroHsBrowserFrame_CreateURLRequest(frame_, request_, client_, 0);
      return;
    }
    // FBro 的 client 不直接继承 CEF 客户端接口，必须经官方包装创建；失败时无同步返回，由任务等待超时兜底。
    FBroHsURLRequest_Create(request_, context_, client_, 0);
  }

 private:
  CefRefPtr<CefRequest> request_;
  CefRefPtr<CefRequestContext> context_;
  CefRefPtr<BridgeUrlRequestClient> client_;
  CefRefPtr<CefFrame> frame_;
  std::shared_ptr<TaskState> task_;
  IMPLEMENT_REFCOUNTING(BridgeUrlRequestStartTask);
};
}  // namespace

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_RequestCreate(void) {
  auto request = FBroHsRequest_Create();
  return RegisterCefObject(LB_FBRO_OBJECT_REQUEST, request, &ObjectState::request);
}

int __stdcall LB_FBro_RequestGetUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsRequest_GetURL(state->request)), result, capacity);
}

int __stdcall LB_FBro_RequestSetUrl(LB_FBRO_OBJECT_HANDLE object, const wchar_t* url) {
  if (!url) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  FBroHsRequest_SetURL(state->request, CefString(url));
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_RequestSetMethod(LB_FBRO_OBJECT_HANDLE object, const wchar_t* method) {
  if (!method || !*method) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  FBroHsRequest_SetMethod(state->request, CefString(method));
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_RequestSetReferrer(LB_FBRO_OBJECT_HANDLE object, const wchar_t* referrer,
                                         int policy) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  FBroHsRequest_SetReferrer(state->request, CefString(referrer ? referrer : L""), policy);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_RequestSetHeaderMapJson(LB_FBRO_OBJECT_HANDLE object,
                                              const wchar_t* headers_json) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  auto headers = CreateDoubleStringFromEntriesJson(headers_json);
  if (!headers) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  FBroHsRequest_SetHeaderMap_Array(state->request, headers, false);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_RequestComposeSet(LB_FBRO_OBJECT_HANDLE object, const wchar_t* url,
                                        const wchar_t* method, LB_FBRO_OBJECT_HANDLE post_data,
                                        const wchar_t* headers_json) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  FBroHsRequest_SetURL(state->request, CefString(url ? url : L""));
  FBroHsRequest_SetMethod(state->request, CefString(method && *method ? method : L"GET"));
  if (headers_json && *headers_json) {
    auto headers = CreateDoubleStringFromEntriesJson(headers_json);
    if (!headers) return LB_FBRO_ERROR_INVALID_ARGUMENT;
    FBroHsRequest_SetHeaderMap_Array(state->request, headers, false);
  }
  if (post_data) {
    auto post_state = GetObject(post_data, LB_FBRO_OBJECT_POST_DATA, status);
    if (!post_state) return status;
    FBroHsRequest_SetPostData(state->request, post_state->post_data);
  }
  return LB_FBRO_OK;
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_PostDataCreate(void) {
  auto post_data = FBroHsPostData_Create();
  return RegisterCefObject(LB_FBRO_OBJECT_POST_DATA, post_data, &ObjectState::post_data);
}

int __stdcall LB_FBro_PostDataAddElement(LB_FBRO_OBJECT_HANDLE object,
                                         LB_FBRO_OBJECT_HANDLE element) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA, status);
  if (!state) return status;
  auto element_state = GetObject(element, LB_FBRO_OBJECT_POST_DATA_ELEMENT, status);
  if (!element_state) return status;
  FBroHsPostData_AddElement(state->post_data, element_state->post_data_element);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_PostDataGetElementCount(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA, status);
  if (!state) return status;
  return FBroHsPostData_GetElementCount(state->post_data);
}

int __stdcall LB_FBro_PostDataGetElementHandlesJson(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                                    size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA, status);
  if (!state) return status;
  std::vector<CefRefPtr<CefPostDataElement>> elements;
  state->post_data->GetElements(elements);
  std::wstring json = L"[";
  for (size_t index = 0; index < elements.size(); ++index) {
    if (index) json += L",";
    json += std::to_wstring(RegisterCefObject(LB_FBRO_OBJECT_POST_DATA_ELEMENT, elements[index],
                                              &ObjectState::post_data_element, object));
  }
  json += L"]";
  return CopyResult(json, result, capacity);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_PostDataElementCreate(void) {
  auto element = FBroHsPostDataElement_Create();
  return RegisterCefObject(LB_FBRO_OBJECT_POST_DATA_ELEMENT, element,
                                            &ObjectState::post_data_element);
}

int __stdcall LB_FBro_PostDataElementSetBytes(LB_FBRO_OBJECT_HANDLE object, const wchar_t* text) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA_ELEMENT, status);
  if (!state) return status;
  std::string bytes = ToUtf8(text ? text : L"");
  FBroHsPostDataElement_SetToData(state->post_data_element,
                                  bytes.empty() ? nullptr : bytes.data(), bytes.size());
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_PostDataElementGetBytesCount(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA_ELEMENT, status);
  if (!state) return status;
  return FBroHsPostDataElement_GetBytesCount(state->post_data_element);
}

int __stdcall LB_FBro_PostDataElementGetText(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                             size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_POST_DATA_ELEMENT, status);
  if (!state) return status;
  const int size = FBroHsPostDataElement_GetBytesCount(state->post_data_element);
  if (size <= 0) return CopyResult(L"", result, capacity);
  std::vector<char> bytes(static_cast<size_t>(size));
  FBroHsPostDataElement_GetBytes(state->post_data_element, bytes.size(), bytes.data());
  return CopyResult(FromUtf8Bytes(bytes.data(), bytes.size()), result, capacity);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ProcessMessageCreate(const wchar_t* name) {
  auto message = FBroHsProcessMessage_Create(CefString(name ? name : L""));
  return RegisterCefObject(LB_FBRO_OBJECT_PROCESS_MESSAGE, message,
                                            &ObjectState::process_message);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_ProcessMessageGetArgumentList(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_PROCESS_MESSAGE, status);
  if (!state) return 0;
  auto list = FBroHsProcessMessage_GetArgumentList(state->process_message);
  return RegisterObject(LB_FBRO_OBJECT_LIST, nullptr, nullptr, list, object);
}

int __stdcall LB_FBro_FrameLoadRequest(LB_FBRO_OBJECT_HANDLE frame, LB_FBRO_OBJECT_HANDLE request) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return status;
  auto request_state = GetObject(request, LB_FBRO_OBJECT_REQUEST, status);
  if (!request_state) return status;
  FBroHsBrowserFrame_LoadRequest(frame_state->frame, request_state->request);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_FrameSendProcessMessage(LB_FBRO_OBJECT_HANDLE frame, int target_process,
                                              LB_FBRO_OBJECT_HANDLE message) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return status;
  auto message_state = GetObject(message, LB_FBRO_OBJECT_PROCESS_MESSAGE, status);
  if (!message_state) return status;
  FBroHsBrowserFrame_SendProcessMessage(frame_state->frame,
                                        static_cast<CefProcessId>(target_process),
                                        message_state->process_message);
  return LB_FBRO_OK;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_UrlRequestStartAsync(LB_FBRO_HANDLE browser,
                                                           LB_FBRO_OBJECT_HANDLE request_object,
                                                           LB_FBRO_TASK_CALLBACK callback,
                                                           void* user_data) {
  int status = LB_FBRO_OK;
  auto request_state = GetObject(request_object, LB_FBRO_OBJECT_REQUEST, status);
  if (!request_state) return 0;
  CefRefPtr<CefRequestContext> context;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(browser)) context = state->request_context;
  }
  if (!context) context = FBroHsRequestContext_GetGlobalContext();
  if (!context) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeUrlRequestClient> client = new BridgeUrlRequestClient(task);
  CefRefPtr<BridgeUrlRequestStartTask> start = new BridgeUrlRequestStartTask(
      request_state->request, context, client, nullptr, task);
  ScheduleManagedTask(start, task, L"无法投递 URL 请求任务");
  return task->handle;
}

int __stdcall LB_FBro_UrlRequestGetStatus(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_URL_REQUEST, status);
  if (!state) return status;
  return FBroHsURLRequest_GetRequestStatus(state->url_request);
}

LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_UrlRequestGetRequestObject(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_URL_REQUEST, status);
  if (!state) return 0;
  auto request = FBroHsURLRequest_GetRequest(state->url_request);
  return RegisterCefObject(LB_FBRO_OBJECT_REQUEST, request, &ObjectState::request,
                                            object);
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameCreateUrlRequestAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                                 LB_FBRO_OBJECT_HANDLE request,
                                                                 LB_FBRO_TASK_CALLBACK callback,
                                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto request_state = GetObject(request, LB_FBRO_OBJECT_REQUEST, status);
  if (!request_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeUrlRequestClient> client = new BridgeUrlRequestClient(task);
  CefRefPtr<BridgeUrlRequestStartTask> start = new BridgeUrlRequestStartTask(
      request_state->request, nullptr, client, frame_state->frame, task);
  ScheduleManagedTask(start, task, L"无法投递框架 URL 请求任务");
  return task->handle;
}

namespace {
/** 填表取值回调：把 FBroHsJsCallback 的 ListValue 以 JSON 完成任务。 */
class BridgeTianBiaoValueCallback final : public FBroHsJsCallback {
 public:
  explicit BridgeTianBiaoValueCallback(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = JsCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Callback(CefRefPtr<CefListValue> values) override {
    CompleteTextTask(task_, JsonFromList(values));
  }

 private:
  std::shared_ptr<TaskState> task_;
};

/** 取源码/取文本访客：按 UTF-8 字节进受管缓冲，避免大页面截断。 */
class BridgeFrameStringVisitor final : public FBroHsStringVisitor {
 public:
  explicit BridgeFrameStringVisitor(std::shared_ptr<TaskState> task) : task_(std::move(task)) {
    type_ = StringVisitorType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Visit(const CefString& string) override {
    const std::string utf8 = ToUtf8(string.ToWString());
    CompleteBufferTask(task_, RegisterBuffer(std::vector<unsigned char>(utf8.begin(), utf8.end())), L"");
  }

 private:
  std::shared_ptr<TaskState> task_;
};

/** 框架异步动作起始任务：UI 线程内发起，完成由回调驱动。 */
class BridgeFrameActionTask final : public CefTask {
 public:
  BridgeFrameActionTask(std::function<void()> action, std::shared_ptr<TaskState> task,
                        std::wstring error)
      : action_(std::move(action)), task_(std::move(task)), missing_error_(std::move(error)) {}
  void Execute() override {
    if (!action_) {
      CompleteTextTask(task_, L"", missing_error_);
      return;
    }
    action_();
  }

 private:
  std::function<void()> action_;
  std::shared_ptr<TaskState> task_;
  std::wstring missing_error_;
  IMPLEMENT_REFCOUNTING(BridgeFrameActionTask);
};
}  // namespace

// 填表参数引号转义：官方 TianBiao 函数把选择器/文本拼进双引号 JS 字符串，
// 与易语言封装层的「内置引号处理」同款语义（只转义双引号，反斜杠保持原样）。
namespace {
std::wstring EscapeTianBiaoText(const wchar_t* text) {
  if (!text) return L"";
  std::wstring value(text);
  std::size_t position = 0;
  while ((position = value.find(L'"', position)) != std::wstring::npos) {
    value.insert(position, L"\\");
    position += 2;
  }
  return value;
}
}  // namespace

int __stdcall LB_FBro_FrameTianBiaoClick(LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector,
                                         int index) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetClick(state->frame, CefString(EscapeTianBiaoText(selector)), index);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoScrollIntoView(LB_FBRO_OBJECT_HANDLE frame,
                                                  const wchar_t* selector, int index,
                                                  int to_top) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetScrollIntoView(state->frame, CefString(EscapeTianBiaoText(selector)),
                                               index, to_top ? TRUE : FALSE);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetFocus(LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector,
                                            int index, int focus) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetFocus(state->frame, CefString(EscapeTianBiaoText(selector)), index,
                                      focus ? TRUE : FALSE);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetValue(LB_FBRO_OBJECT_HANDLE frame, const wchar_t* selector,
                                            int index, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetValue(state->frame, CefString(EscapeTianBiaoText(selector)), index,
                                      CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetValueAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                                 const wchar_t* selector,
                                                                 int index,
                                                                 LB_FBRO_TASK_CALLBACK callback,
                                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetValue(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                            value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取值任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetPointAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                                 const wchar_t* selector,
                                                                 int index,
                                                                 LB_FBRO_TASK_CALLBACK callback,
                                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetPoint(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                            value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取坐标任务");
  return task->handle;
}
int __stdcall LB_FBro_FrameTianBiaoSetChecked(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, int check) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetChecked(state->frame, CefString(EscapeTianBiaoText(selector)), index, check ? TRUE : FALSE);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetSelected(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, int select_index) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetSelected(state->frame, CefString(EscapeTianBiaoText(selector)), index, select_index);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetInnerText(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetInnerText(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetOuterText(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetOuterText(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetInnerHTML(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetInnerHTML(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetOuterHTML(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetOuterHTML(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoSetAttribute(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* name, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_SetAttribute(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(name)), CefString(EscapeTianBiaoText(value)));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_FrameTianBiaoDispatchEvent(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector, int index, const wchar_t* event_flag, int key_code) {
  int status = LB_FBRO_OK;
  auto state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!state) return status;
  FBroHsBrowserFrameTianBiao_DispatchEvent(state->frame, CefString(EscapeTianBiaoText(selector)), index, CefString(EscapeTianBiaoText(event_flag)), key_code);
  return LB_FBRO_OK;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetCheckedAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetChecked(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取选择框任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetSelectedAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetSelected(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取选择项任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetInnerTextAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetInnerText(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取内文本任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetOuterTextAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetOuterText(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取外文本任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetInnerHTMLAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetInnerHTML(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取内代码任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetOuterHTMLAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetOuterHTML(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取外代码任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoGetAttributeAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 const wchar_t* name,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  const std::wstring name_value = name ? name : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, name_value, value_callback]() {
        FBroHsBrowserFrameTianBiao_GetAttribute(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                            CefString(EscapeTianBiaoText(name_value.c_str())),
                                            value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表取属性任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameTianBiaoHasAttributeAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* selector,
                                                 int index,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeTianBiaoValueCallback> value_callback = new BridgeTianBiaoValueCallback(task);
  const std::wstring selector_value = selector ? selector : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, selector_value, index, value_callback]() {
        FBroHsBrowserFrameTianBiao_HasAttribute(frame_state->frame,
                                      CefString(EscapeTianBiaoText(selector_value.c_str())), index,
                                      value_callback);
      },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递填表元素是否存在任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameGetSourceAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                          LB_FBRO_TASK_CALLBACK callback,
                                                          void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeFrameStringVisitor> visitor = new BridgeFrameStringVisitor(task);
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, visitor]() { FBroHsBrowserFrame_GetSource(frame_state->frame, visitor); },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递取源码任务");
  return task->handle;
}
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameGetTextAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                        LB_FBRO_TASK_CALLBACK callback,
                                                        void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeFrameStringVisitor> visitor = new BridgeFrameStringVisitor(task);
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [frame_state, visitor]() { FBroHsBrowserFrame_GetText(frame_state->frame, visitor); },
      task, L"框架已释放");
  ScheduleManagedTask(start, task, L"无法投递取文本任务");
  return task->handle;
}
int __stdcall LB_FBro_BufferToText(LB_FBRO_BUFFER_HANDLE buffer, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetBuffer(buffer, status);
  if (!state) return status;
  return CopyResult(FromUtf8Bytes(state->bytes.data(), state->bytes.size()), result, capacity);
}
namespace {
// JS 扩展调用超时的自定义动作值：completion 收到该值时按 Failure 应答页面。
constexpr int kJsQueryTimeoutAction = 99;

/** 把 .lcpp 应答的菜单操作 JSON 应用到官方菜单模型（同步，回调期内完成）。 */
bool ApplyMenuModelOperations(CefRefPtr<CefMenuModel> model, const std::wstring& ops_json) {
  auto parsed = CefParseJSON(CefString(ops_json), JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_LIST) return false;
  auto ops = parsed->GetList();
  for (size_t index = 0; index < ops->GetSize(); ++index) {
    if (ops->GetType(index) != VTYPE_DICTIONARY) continue;
    auto op = ops->GetDictionary(index);
    if (!op) continue;
    const std::wstring type = op->GetString("op").ToWString();
    const int id = op->GetType("id") == VTYPE_INT ? static_cast<int>(op->GetInt("id")) : 0;
    const CefString label = CefString(op->GetType("label") == VTYPE_STRING ? op->GetString("label").ToWString() : std::wstring());
    if (type == L"addItem") {
      FBroHsMenuModel_AddItem(model, id, label);
    } else if (type == L"addCheckItem") {
      FBroHsMenuModel_AddCheckItem(model, id, label);
    } else if (type == L"addSeparator") {
      FBroHsMenuModel_AddSeparator(model);
    } else if (type == L"addSubMenu") {
      FBroHsMenuModel_AddSubMenu(model, id, label);
    } else if (type == L"remove") {
      FBroHsMenuModel_Remove(model, id);
    } else if (type == L"clear") {
      FBroHsMenuModel_Clear(model);
    } else if (type == L"setChecked") {
      FBroHsMenuModel_SetCheck(model, id, op->GetType("value") == VTYPE_BOOL ? op->GetBool("value") : false);
    } else if (type == L"setEnabled") {
      FBroHsMenuModel_SetEnable(model, id, op->GetType("value") != VTYPE_BOOL || op->GetBool("value"));
    } else if (type == L"setLabel") {
      FBroHsMenuModel_SetLable(model, id, label);
    } else if (type == L"setAccelerator") {
      FBroHsMenuModel_SetAccelerator(model, id, static_cast<int>(op->GetType("keyCode") == VTYPE_INT ? static_cast<int>(op->GetInt("keyCode")) : 0),
          op->GetType("shift") == VTYPE_BOOL && op->GetBool("shift"),
          op->GetType("ctrl") == VTYPE_BOOL && op->GetBool("ctrl"),
          op->GetType("alt") == VTYPE_BOOL && op->GetBool("alt"));
    }
  }
  return true;
}

/** 页面调用原生函数（JS 扩展）处理器：事件应答经 continuation 链回传 Success/Failure。
 * 与火山一致，多条通道共享同一个处理器实例；CEF 的 OnQuery 不携带查询函数名，
 * FBro 又把先注册的处理器放在分发链首，因此处理器无法也不需要区分来源通道。 */
class BridgeQueryHandler final : public FBroHsQueryHandler {
 public:
  BridgeQueryHandler() { type_ = QueryHandlerType; }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  bool OnQuery(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame, int64_t query_id,
               const CefString& request, bool persistent,
               CefRefPtr<CefMessageRouterBrowserSide::Handler::Callback> callback) override {
    (void)frame;
    if (!callback) return false;
    LB_FBRO_HANDLE handle = 0;
    {
      std::lock_guard<std::recursive_mutex> lock(g_mutex);
      for (auto& item : g_browsers) {
        if (browser && item.second->browser && item.second->browser->IsSame(browser)) {
          handle = item.first;
          break;
        }
      }
    }
    if (!handle) return false;
    const std::wstring fields = BuildSafeFieldsJson({
        {L"queryId", std::to_wstring(query_id)},
        {L"request", request.ToWString()},
        {L"persistent", persistent ? L"true" : L"false"}});
    CefRefPtr<CefMessageRouterBrowserSide::Handler::Callback> captured = callback;
    auto completion = [captured](int action, const std::wstring& response_json) {
      if (action == LB_FBRO_EVENT_ACTION_CONTINUE) {
        auto response = ParseEventResponse(response_json);
        if (EventResponseBool(response, "success", true)) {
          FBroJSFunctionCallback_Success(captured,
              CefString(EventResponseString(response, "result")));
        } else {
          FBroJSFunctionCallback_Failure(captured,
              EventResponseInt(response, "errorCode", -1),
              CefString(EventResponseString(response, "error")));
        }
      } else if (action == kJsQueryTimeoutAction) {
        FBroJSFunctionCallback_Failure(captured, -4,
            CefString(L"JS 扩展调用超时"));
      }
    };
    if (!DispatchManagedBrowserEvent(handle, L"OnQuery", fields, 120000, std::move(completion),
                                     0, 0, true, kJsQueryTimeoutAction)) return false;
    return true;
  }
};

// 单处理器实例被全部通道共享；g_js_query_names 按 JS 查询函数名去重。
CefRefPtr<BridgeQueryHandler> g_query_handler;
std::set<std::wstring> g_js_query_names;
}  // namespace

int __stdcall LB_FBro_EnableJsQuery(const wchar_t* query_function, const wchar_t* cancel_function) {
  if (g_ready.load()) return LB_FBRO_ERROR_OPERATION_FAILED;
  const std::wstring query_name = query_function && *query_function ? query_function : L"lingQuery";
  const std::wstring cancel_name = cancel_function && *cancel_function ? cancel_function : L"lingQueryCancel";
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    // 窗口模板在 OnWindowCreated 里先创建 FBroBrowser 控件（此时 CEF 尚未
    // 就绪，CreateEx2 只登记 pending 状态、真正的浏览器要等 g_ready 后的
    // StartPendingBrowsers），随后才派发“创建完毕”。因此只要没有任何浏览器
    // 真正启动，就仍处于注册窗口内，不能拿 pending 条目当已建浏览器拒绝。
    for (const auto& item : g_browsers) {
      if (item.second->create_started || item.second->browser) {
        return LB_FBRO_ERROR_OPERATION_FAILED;
      }
    }
    // 火山同款语义：允许注册多条通道（如 cefQuery 与 cefQuerytest），
    // 同名重复注册按幂等成功处理；所有通道共用同一个处理器实例。
    if (g_js_query_names.count(query_name)) return LB_FBRO_OK;
    if (!g_query_handler) g_query_handler = new BridgeQueryHandler();
    g_js_query_names.insert(query_name);
  }
  FBroHsQueryFunctions(CefString(query_name), CefString(cancel_name), g_query_handler);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_MenuModelClear(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_Clear(state->menu_model));
}
int __stdcall LB_FBro_MenuModelGetCount(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return FBroHsMenuModel_GetCount(state->menu_model);
}
int __stdcall LB_FBro_MenuModelAddSeparator(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_AddSeparator(state->menu_model));
}
int __stdcall LB_FBro_MenuModelAddCheckItem(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                             const wchar_t* label) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_AddCheckItem(state->menu_model, command_id,
                                                 CefString(label ? label : L"")));
}
int __stdcall LB_FBro_MenuModelAddRadioItem(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                             const wchar_t* label, int group_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_AddRadioItem(state->menu_model, command_id,
                                                 CefString(label ? label : L""), group_id));
}
int __stdcall LB_FBro_MenuModelRemove(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_Remove(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelGetLabel(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                         wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsMenuModel_GetLable(state->menu_model, command_id)), result, capacity);
}
int __stdcall LB_FBro_MenuModelSetLabel(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                         const wchar_t* label) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetLable(state->menu_model, command_id,
                                             CefString(label ? label : L"")));
}
int __stdcall LB_FBro_MenuModelGetType(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return FBroHsMenuModel_GetType(state->menu_model, command_id);
}
int __stdcall LB_FBro_MenuModelGetGroup(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return FBroHsMenuModel_GetGroup(state->menu_model, command_id);
}
int __stdcall LB_FBro_MenuModelSetGroup(LB_FBRO_OBJECT_HANDLE object, int command_id, int group_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetGroup(state->menu_model, command_id, group_id));
}
LB_FBRO_OBJECT_HANDLE __stdcall LB_FBro_MenuModelGetSubMenu(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return 0;
  auto sub = FBroHsMenuModel_GetSubMenu(state->menu_model, command_id);
  if (!sub) return 0;
  return RegisterCefObject(LB_FBRO_OBJECT_MENU_MODEL, sub, &ObjectState::menu_model,
                           object, GetCurrentThreadId());
}
int __stdcall LB_FBro_MenuModelIsVisible(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_IsVisable(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelSetVisible(LB_FBRO_OBJECT_HANDLE object, int command_id, int visible) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetVisable(state->menu_model, command_id, visible != 0));
}
int __stdcall LB_FBro_MenuModelIsEnabled(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_IsEnable(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelSetEnabled(LB_FBRO_OBJECT_HANDLE object, int command_id, int enable) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetEnable(state->menu_model, command_id, enable != 0));
}
int __stdcall LB_FBro_MenuModelIsChecked(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_IsChecked(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelSetChecked(LB_FBRO_OBJECT_HANDLE object, int command_id, int check) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetCheck(state->menu_model, command_id, check != 0));
}
int __stdcall LB_FBro_MenuModelSetCheckedAt(LB_FBRO_OBJECT_HANDLE object, int index, int check) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetCheckedAt(state->menu_model, index, check ? TRUE : FALSE));
}
int __stdcall LB_FBro_MenuModelHasAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_HasAccelerator(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelHasAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_HasAcceleratorAt(state->menu_model, index));
}
int __stdcall LB_FBro_MenuModelSetAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index, int key_code,
                                                 int shift, int ctrl, int alt) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetAcceleratorAt(state->menu_model, index, key_code,
                                                     shift ? TRUE : FALSE, ctrl ? TRUE : FALSE,
                                                     alt ? TRUE : FALSE));
}
int __stdcall LB_FBro_MenuModelRemoveAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_RemoveAccelerator(state->menu_model, command_id));
}
int __stdcall LB_FBro_MenuModelRemoveAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_RemoveAcceleratorAt(state->menu_model, index));
}
int __stdcall LB_FBro_MenuModelGetAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                               wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  int key_code = 0;
  BOOL shift_pressed = FALSE;
  BOOL ctrl_pressed = FALSE;
  BOOL alt_pressed = FALSE;
  if (!FBroHsMenuModel_GetAccelerator(state->menu_model, command_id, key_code, shift_pressed,
                                      ctrl_pressed, alt_pressed)) {
    return LB_FBRO_ERROR_OPERATION_FAILED;
  }
  std::wstring json = L"{\"key\":" + std::to_wstring(key_code)
      + L",\"shift\":" + std::to_wstring(shift_pressed ? 1 : 0)
      + L",\"ctrl\":" + std::to_wstring(ctrl_pressed ? 1 : 0)
      + L",\"alt\":" + std::to_wstring(alt_pressed ? 1 : 0) + L"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_MenuModelGetAcceleratorAt(LB_FBRO_OBJECT_HANDLE object, int index,
                                                wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  int key_code = 0;
  BOOL shift_pressed = FALSE;
  BOOL ctrl_pressed = FALSE;
  BOOL alt_pressed = FALSE;
  if (!FBroHsMenuModel_GetAcceleratorAt(state->menu_model, index, key_code, shift_pressed,
                                        ctrl_pressed, alt_pressed)) {
    return LB_FBRO_ERROR_OPERATION_FAILED;
  }
  std::wstring json = L"{\"key\":" + std::to_wstring(key_code)
      + L",\"shift\":" + std::to_wstring(shift_pressed ? 1 : 0)
      + L",\"ctrl\":" + std::to_wstring(ctrl_pressed ? 1 : 0)
      + L",\"alt\":" + std::to_wstring(alt_pressed ? 1 : 0) + L"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_MenuModelSetColor(LB_FBRO_OBJECT_HANDLE object, int command_id, int color_type,
                                        int alpha, int red, int green, int blue) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetColor(state->menu_model, command_id, color_type, alpha,
                                             red, green, blue));
}
int __stdcall LB_FBro_MenuModelSetColorAt(LB_FBRO_OBJECT_HANDLE object, int index, int color_type,
                                          int alpha, int red, int green, int blue) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetColorAt(state->menu_model, index, color_type, alpha,
                                               red, green, blue));
}
int __stdcall LB_FBro_MenuModelGetColorAt(LB_FBRO_OBJECT_HANDLE object, int index, int color_type,
                                          wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  int red = 0;
  int green = 0;
  int blue = 0;
  int alpha = 0;
  const BOOL ok = FBroHsMenuModel_GetColorAt(state->menu_model, index, color_type, red, green,
                                             blue, alpha);
  if (!ok) return LB_FBRO_ERROR_OPERATION_FAILED;
  std::wstring json = L"{\"red\":" + std::to_wstring(red) + L",\"green\":" + std::to_wstring(green)
      + L",\"blue\":" + std::to_wstring(blue) + L",\"alpha\":" + std::to_wstring(alpha) + L"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_MenuModelSetFontList(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                           const wchar_t* font_list) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetFontList(state->menu_model, command_id,
                                                CefString(font_list ? font_list : L"")));
}
int __stdcall LB_FBro_MenuModelSetFontListAt(LB_FBRO_OBJECT_HANDLE object, int index,
                                             const wchar_t* font_list) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetFontListAt(state->menu_model, index,
                                                  CefString(font_list ? font_list : L"")));
}
int __stdcall LB_FBro_ContextMenuParamsGetLinkUrl(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetLinkUrl(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetUnfilteredLinkUrl(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetUnfilteredLinkUrl(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetSourceUrl(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetSourceUrl(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetPageUrl(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetPageUrl(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetFrameCharset(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetFrameCharset(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetFrameUrl(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_pGetFrameUrl(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetSelectionText(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_GetSelectionText(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetMisspelledWord(LB_FBRO_OBJECT_HANDLE object,
                                                   wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsContextMenuParams_GetMisspelledWord(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetDictionarySuggestions(LB_FBRO_OBJECT_HANDLE object,
                                                                 wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return CopyResult(StringListJson(FBroHsContextMenuParams_GetDictionarySuggestions(state->context_menu_params)), result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsHasImageContents(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return BoolStatus(FBroHsContextMenuParams_HasImageContents(state->context_menu_params));
}
int __stdcall LB_FBro_ContextMenuParamsIsEditable(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return BoolStatus(FBroHsContextMenuParams_IsEditable(state->context_menu_params));
}
int __stdcall LB_FBro_ContextMenuParamsIsSpellCheckEnabled(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return BoolStatus(FBroHsContextMenuParams_IsSpellCheckEnabled(state->context_menu_params));
}
int __stdcall LB_FBro_ContextMenuParamsIsCustomMenu(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return BoolStatus(FBroHsContextMenuParams_IsCustomMenu(state->context_menu_params));
}
int __stdcall LB_FBro_DownloadItemIsInProgress(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return FBroHsDownloadItem_IsInProgress(state->download_item) != 0 ? 1 : 0;
}
int __stdcall LB_FBro_DownloadItemIsComplete(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return FBroHsDownloadItem_IsComplete(state->download_item) != 0 ? 1 : 0;
}
int __stdcall LB_FBro_DownloadItemIsCanceled(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return FBroHsDownloadItem_IsCanceled(state->download_item) != 0 ? 1 : 0;
}
int __stdcall LB_FBro_DownloadItemGetPercentComplete(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return FBroHsDownloadItem_GetPercentComplete(state->download_item);
}
int __stdcall LB_FBro_DownloadItemGetDownloadId(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return static_cast<int>(FBroHsDownloadItem_GetDownloadId(state->download_item));
}
long long __stdcall LB_FBro_DownloadItemGetCurrentSpeedBytes(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return 0;
  return static_cast<long long>(FBroHsDownloadItem_GetCurrentSpeed(state->download_item));
}
long long __stdcall LB_FBro_DownloadItemGetTotalBytes(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return 0;
  return static_cast<long long>(FBroHsDownloadItem_GetTotalBytes(state->download_item));
}
long long __stdcall LB_FBro_DownloadItemGetReceivedBytes(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return 0;
  return static_cast<long long>(FBroHsDownloadItem_GetReceivedBytes(state->download_item));
}
long long __stdcall LB_FBro_DownloadItemGetStartTime(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return 0;
  return static_cast<long long>(FBroHsDownloadItem_GetStartTime(state->download_item));
}
long long __stdcall LB_FBro_DownloadItemGetEndTime(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return 0;
  return static_cast<long long>(FBroHsDownloadItem_GetEndTime(state->download_item));
}
int __stdcall LB_FBro_DownloadItemGetFullPath(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetFullPath(state->download_item)), result, capacity);
}
int __stdcall LB_FBro_DownloadItemGetDownloadURL(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetDownloadURL(state->download_item)), result, capacity);
}
int __stdcall LB_FBro_DownloadItemGetDownloadOriginalUrl(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetDownloadOriginalUrl(state->download_item)), result, capacity);
}
int __stdcall LB_FBro_DownloadItemGetSuggestedFileName(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetSuggestedFileName(state->download_item)), result, capacity);
}
int __stdcall LB_FBro_DownloadItemGetDownloadMimeType(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetDownloadMimeType(state->download_item)), result, capacity);
}
int __stdcall LB_FBro_DownloadItemGetContentDisposition(LB_FBRO_OBJECT_HANDLE object,
                                                  wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_DOWNLOAD_ITEM, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsDownloadItem_GetContentDisposition(state->download_item)), result, capacity);
}
long long __stdcall LB_FBro_ResponseCreate() {
  return RegisterResponse(FBroHsResponse_Create());
}
int __stdcall LB_FBro_ResponseIsReadOnly(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return FBroHsResponse_IsReadOnly(state->response) != 0 ? 1 : 0;
}
int __stdcall LB_FBro_ResponseGetError(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return FBroHsResponse_GetError(state->response);
}
int __stdcall LB_FBro_ResponseSetError(LB_FBRO_OBJECT_HANDLE object, int error) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetError(state->response, error);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetStatus(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return FBroHsResponse_GetStatus(state->response);
}
int __stdcall LB_FBro_ResponseSetStatus(LB_FBRO_OBJECT_HANDLE object, int status) {
  int get_status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, get_status);
  if (!state) return get_status;
  FBroHsResponse_SetStatus(state->response, status);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetStatusText(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsResponse_GetStatusText(state->response)), result, capacity);
}
int __stdcall LB_FBro_ResponseSetStatusText(LB_FBRO_OBJECT_HANDLE object, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetStatusText(state->response, CefString(value ? value : L""));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetMimeType(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsResponse_GetMimeType(state->response)), result, capacity);
}
int __stdcall LB_FBro_ResponseSetMimeType(LB_FBRO_OBJECT_HANDLE object, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetMimeType(state->response, CefString(value ? value : L""));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetCharset(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsResponse_GetCharset(state->response)), result, capacity);
}
int __stdcall LB_FBro_ResponseSetCharset(LB_FBRO_OBJECT_HANDLE object, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetCharset(state->response, CefString(value ? value : L""));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetURL(LB_FBRO_OBJECT_HANDLE object, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsResponse_GetURL(state->response)), result, capacity);
}
int __stdcall LB_FBro_ResponseSetURL(LB_FBRO_OBJECT_HANDLE object, const wchar_t* value) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetURL(state->response, CefString(value ? value : L""));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetHeaderByName(LB_FBRO_OBJECT_HANDLE object, const wchar_t* name, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsResponse_GetHeaderByName(state->response, CefString(name ? name : L""))), result, capacity);
}
int __stdcall LB_FBro_ResponseSetHeaderByName(LB_FBRO_OBJECT_HANDLE object, const wchar_t* name, const wchar_t* value, int overwrite) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_SetHeaderByName(state->response, CefString(name ? name : L""), CefString(value ? value : L""), overwrite ? TRUE : FALSE);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseGetHeaderMap(LB_FBRO_OBJECT_HANDLE object,
                                             wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  return CopyResult(DoubleStringJson(FBroHsResponse_GetHeaderMap(state->response)), result, capacity);
}
int __stdcall LB_FBro_ResponseSetHeaderMapJson(LB_FBRO_OBJECT_HANDLE object,
                                                const wchar_t* headers_json,
                                                int delete_other) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  auto headers = CreateDoubleStringFromEntriesJson(headers_json);
  if (!headers) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  FBroHsResponse_SetHeaderMap_Array(state->response, headers, delete_other != 0);
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ResponseDeleteHeaderMap(LB_FBRO_OBJECT_HANDLE object,
                                               const wchar_t* key) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_RESPONSE, status);
  if (!state) return status;
  FBroHsResponse_DeleteHeaderMap(state->response, CefString(key ? key : L""));
  return LB_FBRO_OK;
}
int __stdcall LB_FBro_ContextMenuParamsGetMediaType(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_GetMediaType(state->context_menu_params);
}
int __stdcall LB_FBro_ContextMenuParamsGetMediaStateFlags(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_GetMediaStateFlags(state->context_menu_params);
}
int __stdcall LB_FBro_ContextMenuParamsGetEditStateFlags(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_GetEditStateFlags(state->context_menu_params);
}
int __stdcall LB_FBro_MenuModelAddItem(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                       const wchar_t* label) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_AddItem(state->menu_model, command_id,
                                            CefString(label ? label : L"")));
}
int __stdcall LB_FBro_MenuModelAddSubMenu(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                          const wchar_t* label) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  auto sub = FBroHsMenuModel_AddSubMenu(state->menu_model, command_id,
                                        CefString(label ? label : L""));
  return static_cast<int>(RegisterCefObject(LB_FBRO_OBJECT_MENU_MODEL, sub,
                                            &ObjectState::menu_model, object,
                                            GetCurrentThreadId()));
}
int __stdcall LB_FBro_MenuModelSetAccelerator(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                              int key_code, int shift, int ctrl, int alt) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  return BoolStatus(FBroHsMenuModel_SetAccelerator(state->menu_model, command_id, key_code,
                                                   shift != 0, ctrl != 0, alt != 0));
}
int __stdcall LB_FBro_MenuModelGetColor(LB_FBRO_OBJECT_HANDLE object, int command_id,
                                        int color_type, wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_MENU_MODEL, status);
  if (!state) return status;
  int red = 0;
  int green = 0;
  int blue = 0;
  int alpha = 0;
  const BOOL ok = FBroHsMenuModel_GetColor(state->menu_model, command_id, color_type, red, green,
                                           blue, alpha);
  if (!ok) return LB_FBRO_ERROR_OPERATION_FAILED;
  std::wstring json = L"{\"red\":" + std::to_wstring(red) + L",\"green\":" + std::to_wstring(green)
      + L",\"blue\":" + std::to_wstring(blue) + L",\"alpha\":" + std::to_wstring(alpha) + L"}";
  return CopyResult(json, result, capacity);
}
int __stdcall LB_FBro_ContextMenuParamsGetX(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_pGetXCoord(state->context_menu_params);
}
int __stdcall LB_FBro_ContextMenuParamsGetY(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_pGetYCoord(state->context_menu_params);
}

int __stdcall LB_FBro_ContextMenuParamsGetTypeFlags(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_CONTEXT_MENU_PARAMS, status);
  if (!state) return status;
  return FBroHsContextMenuParams_pGetTypeFlags(state->context_menu_params);
}

namespace {
/** CEF 服务器句柄：创建完成注册受管对象并把连接事件缓存到最近事件。
 * 全部 8 个官方回调都派发给创建者浏览器实例；握手请求默认放行（Continue），
 * 用户处理器返回取消动作时改调 Cancel。事件里下发的 server/请求句柄为持久
 * 受管句柄，用 LB_FBro_ObjectRelease 释放，消息数据用 LB_FBro_BufferRelease 释放。 */
class BridgeServerHandle final : public FBroHsServerHandle {
 public:
  BridgeServerHandle(std::shared_ptr<TaskState> task, LB_FBRO_HANDLE browser)
      : task_(std::move(task)), browser_(browser) {
    type_ = ServerHandleType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void OnServerCreated(CefRefPtr<CefServer> server) override {
    LB_FBRO_OBJECT_HANDLE handle = 0;
    std::wstring address;
    if (server) {
      auto state = std::make_shared<ObjectState>();
      state->handle = g_next_object_handle.fetch_add(1);
      state->type = LB_FBRO_OBJECT_SERVER;
      state->owner_thread = 0;
      state->server = server;
      {
        std::lock_guard<std::recursive_mutex> lock(g_mutex);
        g_objects.emplace(state->handle, state);
      }
      handle = state->handle;
      address = FromFbroString(FBroHsServer_GetAddress(server));
    }
    CompleteTextTask(task_, L"{\"server\":" + std::to_wstring(handle)
        + L",\"address\":\"" + JsonEscape(address) + L"\"}");
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onservercreated.9f8423783d4d",
        L"OnServerCreated", L"本地服务器服务器已创建",
        {{L"server", std::to_wstring(handle)}, {L"address", address}});
  }
  void OnServerDestroyed(CefRefPtr<CefServer>) override {
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onserverdestroyed.74d2ad62e7bf",
        L"OnServerDestroyed", L"本地服务器服务器已销毁", {});
  }
  void OnClientConnected(CefRefPtr<CefServer>, int connection_id) override {
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onclientconnected.73f6ab2955f9",
        L"OnClientConnected", L"本地服务器客户端已连接",
        {{L"connectionId", std::to_wstring(static_cast<long long>(connection_id))}});
  }
  void OnClientDisconnected(CefRefPtr<CefServer>, int connection_id) override {
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onclientdisconnected.679265737354",
        L"OnClientDisconnected", L"本地服务器客户端已断开",
        {{L"connectionId", std::to_wstring(static_cast<long long>(connection_id))}});
  }
  void OnWebSocketConnected(CefRefPtr<CefServer>, int connection_id) override {
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onwebsocketconnected.6eb0eda88679",
        L"OnWebSocketConnected", L"本地服务器WebSocket已连接",
        {{L"connectionId", std::to_wstring(static_cast<long long>(connection_id))}});
  }
  void OnWebSocketMessage(CefRefPtr<CefServer>, int connection_id, const void* data,
                          size_t data_size) override {
    const LB_FBRO_BUFFER_HANDLE payload = RegisterBuffer(
        CopyPayloadBytes(data, static_cast<int>(data_size)));
    DispatchServerEvent(L"fbro.event.fbrohsserverhandle.onwebsocketmessage.d0f74963dbf2",
        L"OnWebSocketMessage", L"本地服务器WebSocket消息到达",
        {{L"connectionId", std::to_wstring(static_cast<long long>(connection_id))},
         {L"data", std::to_wstring(payload)},
         {L"text", FromUtf8Bytes(data, data_size)},
         {L"size", std::to_wstring(static_cast<long long>(data_size))}});
  }
  void OnWebSocketRequest(CefRefPtr<CefServer>, int connection_id,
                          const CefString& client_address, CefRefPtr<CefRequest> request,
                          CefRefPtr<CefCallback> callback) override {
    const int action = DispatchRequestEvent(
        L"fbro.event.fbrohsserverhandle.onwebsocketrequest.e0c62091ea5e",
        L"OnWebSocketRequest", L"本地服务器WebSocket握手请求", connection_id,
        client_address, request, true);
    if (callback) {
      if (action == LB_FBRO_EVENT_ACTION_CANCEL) callback->Cancel();
      else callback->Continue();
    }
  }
  void OnHttpRequest(CefRefPtr<CefServer>, int connection_id, const CefString& client_address,
                     CefRefPtr<CefRequest> request) override {
    DispatchRequestEvent(L"fbro.event.fbrohsserverhandle.onhttprequest.806dd090ad0b",
        L"OnHttpRequest", L"本地服务器HTTP请求到达", connection_id, client_address, request,
        false);
  }

 private:
  void DispatchServerEvent(const wchar_t* event_id, const wchar_t* official_name,
                           const wchar_t* event_name,
                           std::initializer_list<std::pair<const wchar_t*, std::wstring>> fields) {
    DispatchGeneratedBrowserEvent(browser_, event_id, official_name, event_name,
                                  BuildSafeFieldsJson(fields), 0, 0);
  }
  int DispatchRequestEvent(const wchar_t* event_id, const wchar_t* official_name,
                           const wchar_t* event_name, int connection_id,
                           const CefString& client_address, CefRefPtr<CefRequest> request,
                           bool synchronous) {
    const LB_FBRO_OBJECT_HANDLE request_handle = RegisterCefObject(
        LB_FBRO_OBJECT_REQUEST, request, &ObjectState::request);
    return DispatchGeneratedBrowserEvent(browser_, event_id, official_name, event_name,
        BuildSafeFieldsJson({
            {L"connectionId", std::to_wstring(static_cast<long long>(connection_id))},
            {L"clientAddress", client_address.ToWString()},
            {L"request", std::to_wstring(request_handle)},
            {L"method", request ? FromFbroString(FBroHsRequest_GetMethod(request)) : L""},
            {L"url", request ? FromFbroString(FBroHsRequest_GetURL(request)) : L""}}),
        synchronous ? LB_FBRO_EVENT_FLAG_SYNCHRONOUS : 0, 0);
  }
  std::shared_ptr<TaskState> task_;
  LB_FBRO_HANDLE browser_;
};

/** 服务器 IO 任务：在 server 自身 task runner 上执行发送动作。 */
class BridgeServerSendTask final : public CefTask {
 public:
  BridgeServerSendTask(CefRefPtr<CefServer> server, int connection_id,
                       std::vector<unsigned char> bytes)
      : server_(std::move(server)), connection_id_(connection_id), bytes_(std::move(bytes)) {}
  void Execute() override {
    FBroHsServer_SendWebSocketMessage(server_, connection_id_,
                                      bytes_.empty() ? nullptr : bytes_.data(),
                                      static_cast<int>(bytes_.size()));
  }

 private:
  CefRefPtr<CefServer> server_;
  int connection_id_;
  std::vector<unsigned char> bytes_;
  IMPLEMENT_REFCOUNTING(BridgeServerSendTask);
};
}  // namespace

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_ServerCreateAsync(LB_FBRO_HANDLE browser, const wchar_t* url,
                                                        int port, int max_connections,
                                                        LB_FBRO_TASK_CALLBACK callback,
                                                        void* user_data) {
  if (!url || !*url || port <= 0 || max_connections <= 0) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeServerHandle> server_handle = new BridgeServerHandle(task, browser);
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask(
      [url = std::wstring(url), port, max_connections, server_handle]() {
        FBroHsServer_CreateServer(CefString(url), port, max_connections, server_handle);
      },
      task, L"");
  ScheduleManagedTask(start, task, L"无法投递服务器创建任务");
  return task->handle;
}

int __stdcall LB_FBro_ServerSendWebSocketMessage(LB_FBRO_OBJECT_HANDLE object, int connection_id,
                                                 const wchar_t* text) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_SERVER, status);
  if (!state) return status;
  if (!text) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  const std::string bytes = ToUtf8(text);
  auto runner = FBroHsServer_GetTaskRunner(state->server);
  if (!runner) return LB_FBRO_ERROR_OPERATION_FAILED;
  auto owned_server = state->server;
  runner->PostTask(new BridgeServerSendTask(owned_server, connection_id,
                                            std::vector<unsigned char>(bytes.begin(), bytes.end())));
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_ServerSendWebSocketBuffer(LB_FBRO_OBJECT_HANDLE object, int connection_id,
                                                LB_FBRO_BUFFER_HANDLE buffer) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_SERVER, status);
  if (!state) return status;
  auto buffer_state = GetBuffer(buffer, status);
  if (!buffer_state) return status;
  auto runner = FBroHsServer_GetTaskRunner(state->server);
  if (!runner) return LB_FBRO_ERROR_OPERATION_FAILED;
  auto owned_server = state->server;
  auto bytes = buffer_state->bytes;
  runner->PostTask(new BridgeServerSendTask(owned_server, connection_id, std::move(bytes)));
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_ServerGetAddress(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                       size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_SERVER, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsServer_GetAddress(state->server)), result, capacity);
}

int __stdcall LB_FBro_ServerHasConnection(LB_FBRO_OBJECT_HANDLE object, int connection_id) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_SERVER, status);
  if (!state) return status;
  return FBroHsServer_HasConnection(state->server) ? 1 : 0;
}

int __stdcall LB_FBro_ServerShutdown(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_SERVER, status);
  if (!state) return status;
  FBroHsServer_Shutdown(state->server);
  return LB_FBRO_OK;
}

// ---- VIP WebSocket 客户端拦截：受管 wssClient 句柄命令 ----
// 与事件字段配套：拦截事件下发 websocket 句柄，用户用它读取连接信息或回发数据。
// FBro 的 WSS 客户端接口要求在界面线程调用，生成的 wrapper 在 .lcpp 事件/方法
// 中调用时天然满足该约定，桥内不做二次投递。

int __stdcall LB_FBro_WssIsNull(LB_FBRO_OBJECT_HANDLE object) {
  // 渲染进程受管的远程 WSS 句柄（位 30 偏见）：路由回渲染进程查询。
  if (object & kRemoteWssHandleBias) {
    std::wstring value;
    int flag = 1;
    if (!QueryRemoteWssText(object, "isNull", value, flag)) return 1;
    return flag ? 1 : 0;
  }
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return 1;
  return FBroHsWSSClient_IsNull(state->wss_client) ? 1 : 0;
}

int __stdcall LB_FBro_WssGetAddress(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                    size_t capacity) {
  if (object & kRemoteWssHandleBias) {
    std::wstring value;
    int flag = 0;
    if (!QueryRemoteWssText(object, "address", value, flag)) {
      return LB_FBRO_ERROR_RELEASED_HANDLE;
    }
    return CopyResult(value, result, capacity);
  }
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsWSSClient_GetAddress(state->wss_client)), result,
                    capacity);
}

int __stdcall LB_FBro_WssGetProtocol(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                     size_t capacity) {
  if (object & kRemoteWssHandleBias) {
    std::wstring value;
    int flag = 0;
    if (!QueryRemoteWssText(object, "protocol", value, flag)) {
      return LB_FBRO_ERROR_RELEASED_HANDLE;
    }
    return CopyResult(value, result, capacity);
  }
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsWSSClient_GetProtocol(state->wss_client)), result,
                    capacity);
}

int __stdcall LB_FBro_WssGetExtensions(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                       size_t capacity) {
  if (object & kRemoteWssHandleBias) {
    std::wstring value;
    int flag = 0;
    if (!QueryRemoteWssText(object, "extensions", value, flag)) {
      return LB_FBRO_ERROR_RELEASED_HANDLE;
    }
    return CopyResult(value, result, capacity);
  }
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsWSSClient_GetExtensions(state->wss_client)), result,
                    capacity);
}

int __stdcall LB_FBro_WssSend(LB_FBRO_OBJECT_HANDLE object, const wchar_t* text) {
  if (object & kRemoteWssHandleBias) return LB_FBRO_ERROR_NOT_SUPPORTED;
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return status;
  if (!text) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  FBroHsWSSClient_Send(state->wss_client, CefString(text));
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_WssSendBuffer(LB_FBRO_OBJECT_HANDLE object, LB_FBRO_BUFFER_HANDLE buffer) {
  if (object & kRemoteWssHandleBias) return LB_FBRO_ERROR_NOT_SUPPORTED;
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_WSS_CLIENT, status);
  if (!state) return status;
  auto buffer_state = GetBuffer(buffer, status);
  if (!buffer_state) return status;
  const size_t size = buffer_state->bytes.size();
  FBroHsWSSClient_SendData(state->wss_client,
                           size ? buffer_state->bytes.data() : nullptr, size);
  return LB_FBRO_OK;
}

// ---- 拦截回传通道：按通道名向页面内挂钩脚本推送数据（UTF-8 传输） ----

namespace {
int SendByBrowserWithBrowser(LB_FBRO_HANDLE browser, const wchar_t* name,
                             const std::vector<unsigned char>& bytes, bool use_client_channel) {
  if (!name || !*name) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  const std::string channel = ToUtf8(name);
  int send_status = LB_FBRO_ERROR_OPERATION_FAILED;
  const int status = WithBrowser(browser, [&](CefRefPtr<CefBrowser> target) {
    if (use_client_channel) {
      send_status = FBroHsSocketClient_SendByBrowser(target, channel.c_str(),
          bytes.empty() ? nullptr : reinterpret_cast<const char*>(bytes.data()),
          static_cast<int>(bytes.size())) ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED;
    } else {
      send_status = FBroHsSocketServer_SendByBrowser(target, channel.c_str(),
          bytes.empty() ? nullptr : reinterpret_cast<const char*>(bytes.data()),
          static_cast<int>(bytes.size())) ? LB_FBRO_OK : LB_FBRO_ERROR_OPERATION_FAILED;
    }
  });
  return status <= 0 ? status : send_status;
}
}  // namespace

int __stdcall LB_FBro_SocketServerSendByBrowser(LB_FBRO_HANDLE browser, const wchar_t* name,
                                                const wchar_t* text) {
  if (!text) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  const std::string bytes = ToUtf8(text);
  return SendByBrowserWithBrowser(browser, name,
                                  std::vector<unsigned char>(bytes.begin(), bytes.end()), false);
}

int __stdcall LB_FBro_SocketServerSendByBrowserBuffer(LB_FBRO_HANDLE browser, const wchar_t* name,
                                                      LB_FBRO_BUFFER_HANDLE buffer) {
  int status = LB_FBRO_OK;
  auto buffer_state = GetBuffer(buffer, status);
  if (!buffer_state) return status;
  return SendByBrowserWithBrowser(browser, name, buffer_state->bytes, false);
}

int __stdcall LB_FBro_SocketClientSendByBrowser(LB_FBRO_HANDLE browser, const wchar_t* name,
                                                const wchar_t* text) {
  if (!text) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  const std::string bytes = ToUtf8(text);
  return SendByBrowserWithBrowser(browser, name,
                                  std::vector<unsigned char>(bytes.begin(), bytes.end()), true);
}

int __stdcall LB_FBro_SocketClientSendByBrowserBuffer(LB_FBRO_HANDLE browser, const wchar_t* name,
                                                      LB_FBRO_BUFFER_HANDLE buffer) {
  int status = LB_FBRO_OK;
  auto buffer_state = GetBuffer(buffer, status);
  if (!buffer_state) return status;
  return SendByBrowserWithBrowser(browser, name, buffer_state->bytes, true);
}

int __stdcall LB_FBro_RequestGetMethod(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                       size_t capacity) {
  int status = LB_FBRO_OK;
  auto state = GetObject(object, LB_FBRO_OBJECT_REQUEST, status);
  if (!state) return status;
  return CopyResult(FromFbroString(FBroHsRequest_GetMethod(state->request)), result, capacity);
}

// ---- DOM 遍历快照 ----
// 官方 FBroHsBrowserFrame_VisitDOM 的 Visit 回调按 CEF 语义可能在渲染进程执行，
// 因此不保留官方 DOM 对象：Visit 里把 CefDOMDocument 确定性序列化成有界快照
// （纯数据），通过任务句柄把快照交回调用方。路径为 JSON 数组字符串（如 [0,2]），
// 按路径写回会重新 VisitDOM 定位官方节点后调用 SetElementAttribute/SetValue。

namespace {

constexpr int kDomDefaultMaxDepth = 16;
constexpr int kDomDefaultMaxNodes = 4000;
constexpr size_t kDomMaxTextLength = 4096;
constexpr int kDomMaxAttributesPerNode = 256;

struct DomSnapshotNode {
  std::wstring path;
  int type = 0;
  bool is_element = false;
  std::wstring name;
  std::wstring value;
  std::wstring inner_text;
  std::vector<std::pair<std::wstring, std::wstring>> attributes;
};

struct DomSnapshot {
  int document_type = 0;
  std::wstring title;
  std::wstring base_url;
  std::wstring head_inner_text;
  std::wstring focused_path;
  std::vector<DomSnapshotNode> nodes;
};

std::wstring TruncateDomText(std::wstring value) {
  if (value.size() > kDomMaxTextLength) value.resize(kDomMaxTextLength);
  return value;
}

void WalkDomSnapshot(DomSnapshot& snapshot, CefRefPtr<CefDOMNode> node,
                     const std::wstring& path, int depth, int max_depth, size_t max_nodes,
                     CefRefPtr<CefDOMNode> focused) {
  if (!node || depth > max_depth || snapshot.nodes.size() >= max_nodes) return;
  DomSnapshotNode record;
  record.path = path;
  record.type = FBroHsDOMNode_GetType(node);
  record.is_element = FBroHsDOMNode_IsElement(node) != 0;
  record.name = TruncateDomText(FromFbroString(FBroHsDOMNode_GetName(node)));
  record.value = TruncateDomText(FromFbroString(FBroHsDOMNode_GetValue(node)));
  if (record.is_element) {
    record.inner_text =
        TruncateDomText(FromFbroString(FBroHsDOMNode_GetElementInnerText(node)));
    auto attributes = FBroHsDOMNode_GetElementAttributes(node);
    if (attributes) {
      const int size = FBroDoubleString_Size(attributes);
      FBroDoubleString_ToBegin(attributes);
      for (int index = 0; index < size && index < kDomMaxAttributesPerNode; ++index) {
        record.attributes.emplace_back(
            TruncateDomText(FromFbroString(FBroDoubleString_GetCurrentData_Key(attributes))),
            TruncateDomText(FromFbroString(FBroDoubleString_GetCurrentData_Value(attributes))));
        if (!FBroDoubleString_ToNext(attributes)) break;
      }
    }
  }
  if (focused && snapshot.focused_path.empty() && FBroHsDOMNode_IsSame(node, focused)) {
    snapshot.focused_path = path;
  }
  snapshot.nodes.push_back(std::move(record));
  if (!record.is_element || !FBroHsDOMNode_HasChildren(node)) return;
  CefRefPtr<CefDOMNode> child = FBroHsDOMNode_GetFirstChild(node);
  int child_index = 0;
  while (child && snapshot.nodes.size() < max_nodes) {
    WalkDomSnapshot(snapshot, child, path + L"[" + std::to_wstring(child_index) + L"]",
                    depth + 1, max_depth, max_nodes, focused);
    child = FBroHsDOMNode_GetNextSibling(child);
    ++child_index;
  }
}

// 解析路径 JSON（如 "[0,2]"，"[]" 表示 Body 本身）。返回是否解析成功。
bool ParseDomPath(const wchar_t* path_json, std::vector<int>& path) {
  path.clear();
  if (!path_json || !*path_json) return false;
  const auto parsed = CefParseJSON(CefString(path_json), JSON_PARSER_RFC);
  if (!parsed || parsed->GetType() != VTYPE_LIST) return false;
  auto list = parsed->GetList();
  const size_t size = list ? list->GetSize() : 0;
  for (size_t index = 0; index < size; ++index) {
    path.push_back(list->GetInt(index));
  }
  return true;
}

}  // namespace

// DOM 任务共享完成标记：官方 VisitDOM 与页面内 JS 序列化兜底竞争同一任务，
// 先完成者生效，另一方静默退出，避免重复完成任务。
struct DomTaskShared {
  std::shared_ptr<TaskState> task;
  std::atomic<bool> finished{false};
  bool TryFinish() { return !finished.exchange(true); }
};

LB_FBRO_OBJECT_HANDLE RegisterDomSnapshot(const std::shared_ptr<DomSnapshot>& snapshot) {
  auto state = std::make_shared<ObjectState>();
  state->handle = g_next_object_handle.fetch_add(1);
  state->type = LB_FBRO_OBJECT_DOM_SNAPSHOT;
  state->owner_thread = 0;
  state->dom_snapshot = snapshot;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  g_objects.emplace(state->handle, state);
  return state->handle;
}

class BridgeDomVisitor final : public FBroHsDOMVisitor {
 public:
  explicit BridgeDomVisitor(std::shared_ptr<DomTaskShared> shared, int max_depth, int max_nodes)
      : shared_(std::move(shared)), max_depth_(max_depth), max_nodes_(max_nodes) {}
  void Visit(CefRefPtr<CefDOMDocument> document) override {
    if (!shared_->TryFinish()) return;
    auto snapshot = std::make_shared<DomSnapshot>();
    if (document) {
      snapshot->document_type = FBroHsDOMDocument_GetType(document);
      snapshot->title = TruncateDomText(FromFbroString(FBroHsDOMDocument_GetTitle(document)));
      snapshot->base_url =
          TruncateDomText(FromFbroString(FBroHsDOMDocument_GetBaseURL(document)));
      if (auto head = FBroHsDOMDocument_GetHead(document)) {
        snapshot->head_inner_text =
            TruncateDomText(FromFbroString(FBroHsDOMNode_GetElementInnerText(head)));
      }
      CefRefPtr<CefDOMNode> focused = FBroHsDOMDocument_GetFocusedNode(document);
      CefRefPtr<CefDOMNode> root = FBroHsDOMDocument_GetBody(document);
      if (!root) root = FBroHsDOMDocument_GetDocument(document);
      WalkDomSnapshot(*snapshot, root, L"[]", 0, max_depth_, max_nodes_, focused);
    }
    const LB_FBRO_OBJECT_HANDLE snapshot_handle = RegisterDomSnapshot(snapshot);
    CompleteTextTask(shared_->task, L"{\"snapshot\":" + std::to_wstring(snapshot_handle)
        + L",\"nodes\":" + std::to_wstring(snapshot->nodes.size()) + L"}");
  }

 private:
  std::shared_ptr<DomTaskShared> shared_;
  int max_depth_;
  int max_nodes_;
  IMPLEMENT_REFCOUNTING(BridgeDomVisitor);
};

class BridgeDomApplyVisitor final : public FBroHsDOMVisitor {
 public:
  BridgeDomApplyVisitor(std::shared_ptr<DomTaskShared> shared, std::vector<int> path,
                        std::wstring name, std::wstring value)
      : shared_(std::move(shared)), path_(std::move(path)), name_(std::move(name)),
        value_(std::move(value)) {}
  void Visit(CefRefPtr<CefDOMDocument> document) override {
    if (!shared_->TryFinish()) return;
    CefRefPtr<CefDOMNode> node = document ? FBroHsDOMDocument_GetBody(document) : nullptr;
    if (!node) node = document ? FBroHsDOMDocument_GetDocument(document) : nullptr;
    CefRefPtr<CefDOMNode> target = FindByPath(node, 0);
    if (!target) {
      CompleteTextTask(shared_->task, L"", L"DOM 写回失败：路径不存在或文档已变化，请重新遍历。");
      return;
    }
    const bool ok = name_.empty()
        ? FBroHsDOMNode_SetValue(target, CefString(value_)) != 0
        : FBroHsDOMNode_SetElementAttribute(target, CefString(name_), CefString(value_)) != 0;
    if (!ok) {
      CompleteTextTask(shared_->task, L"", L"DOM 写回失败：官方节点拒绝写入该属性或值。");
      return;
    }
    CompleteTextTask(shared_->task, L"1");
  }

 private:
  CefRefPtr<CefDOMNode> FindByPath(CefRefPtr<CefDOMNode> node, int depth) {
    if (!node) return nullptr;
    if (depth >= static_cast<int>(path_.size())) return node;
    if (!FBroHsDOMNode_HasChildren(node)) return nullptr;
    CefRefPtr<CefDOMNode> child = FBroHsDOMNode_GetFirstChild(node);
    int index = 0;
    while (child) {
      if (index == path_[depth]) return FindByPath(child, depth + 1);
      child = FBroHsDOMNode_GetNextSibling(child);
      ++index;
    }
    return nullptr;
  }
  std::shared_ptr<DomTaskShared> shared_;
  std::vector<int> path_;
  std::wstring name_;
  std::wstring value_;
  IMPLEMENT_REFCOUNTING(BridgeDomApplyVisitor);
};

// 解析页面内序列化出的快照 JSON 到受管 DomSnapshot。
CefRefPtr<CefDictionaryValue> ParseDomSnapshotRoot(const std::wstring& json_text) {
  if (json_text.empty()) return nullptr;
  auto parsed = CefParseJSON(CefString(json_text), JSON_PARSER_RFC);
  int guard = 0;
  while (parsed && guard++ < 4) {
    if (parsed->GetType() == VTYPE_DICTIONARY) return parsed->GetDictionary();
    if (parsed->GetType() != VTYPE_LIST) return nullptr;
    auto list = parsed->GetList();
    if (!list || list->GetSize() < 1) return nullptr;
    if (list->GetType(0) == VTYPE_STRING) {
      parsed = CefParseJSON(list->GetString(0), JSON_PARSER_RFC);
    } else if (list->GetType(0) == VTYPE_DICTIONARY) {
      return list->GetDictionary(0);
    } else {
      return nullptr;
    }
  }
  return nullptr;
}

bool ParseDomSnapshotJson(const std::wstring& json_text, DomSnapshot& snapshot) {
  auto dict = ParseDomSnapshotRoot(json_text);
  if (!dict) return false;
  snapshot.document_type = dict->GetType("documentType") == VTYPE_INT ? dict->GetInt("documentType") : 0;
  if (dict->GetType("title") == VTYPE_STRING) snapshot.title = dict->GetString("title").ToWString();
  if (dict->GetType("baseUrl") == VTYPE_STRING) snapshot.base_url = dict->GetString("baseUrl").ToWString();
  if (dict->GetType("headInnerText") == VTYPE_STRING) {
    snapshot.head_inner_text = dict->GetString("headInnerText").ToWString();
  }
  if (dict->GetType("focusedPath") == VTYPE_STRING) {
    snapshot.focused_path = dict->GetString("focusedPath").ToWString();
  }
  if (dict->GetType("nodes") != VTYPE_LIST) return snapshot.nodes.empty();
  auto nodes = dict->GetList("nodes");
  const size_t count = nodes ? nodes->GetSize() : 0;
  for (size_t index = 0; index < count; ++index) {
    if (nodes->GetType(index) != VTYPE_DICTIONARY) continue;
    auto item = nodes->GetDictionary(index);
    if (!item) continue;
    DomSnapshotNode record;
    if (item->GetType("path") == VTYPE_STRING) record.path = item->GetString("path").ToWString();
    record.type = item->GetType("type") == VTYPE_INT ? item->GetInt("type") : 0;
    record.is_element = item->GetType("element") == VTYPE_BOOL ? item->GetBool("element") : false;
    if (item->GetType("name") == VTYPE_STRING) record.name = item->GetString("name").ToWString();
    if (item->GetType("value") == VTYPE_STRING) record.value = item->GetString("value").ToWString();
    if (item->GetType("innerText") == VTYPE_STRING) {
      record.inner_text = item->GetString("innerText").ToWString();
    }
    if (item->GetType("attributes") == VTYPE_LIST) {
      auto attributes = item->GetList("attributes");
      const size_t attribute_count = attributes ? attributes->GetSize() : 0;
      for (size_t attribute_index = 0; attribute_index < attribute_count; ++attribute_index) {
        if (attributes->GetType(attribute_index) != VTYPE_LIST) continue;
        auto pair = attributes->GetList(attribute_index);
        if (!pair || pair->GetSize() < 2) continue;
        record.attributes.emplace_back(pair->GetString(0).ToWString(), pair->GetString(1).ToWString());
      }
    }
    snapshot.nodes.push_back(std::move(record));
  }
  return true;
}

// 页面内 DOM 序列化兜底：与官方 VisitDOM 语义同构的 JS 片段，在页面主世界
// 按 childNodes 路径遍历，输出与受管快照一致的 JSON。深度与节点数上限由调用方传入。
std::wstring BuildDomSnapshotJsSource(int max_depth, int max_nodes) {
  std::wstring js = L"(function(){var maxDepth=";
  js += std::to_wstring(max_depth);
  js += L";var maxNodes=";
  js += std::to_wstring(max_nodes);
  js += LR"JS(;var nodes=[];var focused=document.activeElement;function text(v){try{return v==null?'':String(v).slice(0,4096);}catch(e){return '';}}
function attrs(n){var out=[];try{var m=n.attributes;for(var i=0;i<m.length&&i<256;i++){out.push([m[i].name,m[i].value]);}}catch(e){}
return out;}
function walk(n,path,depth){if(!n||depth>maxDepth||nodes.length>=maxNodes)return;var rec={path:path,type:n.nodeType,element:n.nodeType===1,name:n.nodeName||'',value:text(n.nodeValue),innerText:'',attributes:[]};
if(rec.element){try{rec.innerText=text(n.innerText);}catch(e){}rec.attributes=attrs(n);}
if(focused&&n===focused)rec.focused=true;
nodes.push(rec);
if(rec.element){var kids=n.childNodes;for(var i=0;i<kids.length&&nodes.length<maxNodes;i++){walk(kids[i],path+'['+i+']',depth+1);}}}
var root=document.body||document.documentElement;
walk(root,'[]',0);
var fp='';
if(focused){var chain=[];var node=focused;var parent=node.parentNode;
while(parent&&parent!==document.body&&parent!==document.documentElement&&chain.length<64){chain.unshift(Array.prototype.indexOf.call(parent.childNodes,node));node=parent;parent=node.parentNode;}
fp='['+chain.join(',')+']';}
var head=document.head;
return JSON.stringify({documentType:document.compatMode==='CSS1Compat'?1:0,title:document.title||'',baseUrl:document.baseURI||'',headInnerText:head?text(head.innerText):'',focusedPath:fp,nodes:nodes});})())JS";
  return js;
}

// 页面内按路径写回兜底：childNodes 逐层定位后 setAttribute/value。
std::wstring BuildDomApplyJsSource(const std::vector<int>& path, const std::wstring& name,
                                   const std::wstring& value) {
  CefRefPtr<CefValue> name_value = CefValue::Create();
  name_value->SetString(name);
  CefRefPtr<CefValue> value_value = CefValue::Create();
  value_value->SetString(value);
  const std::wstring name_json = CefWriteJSON(name_value, JSON_WRITER_DEFAULT).ToWString();
  const std::wstring value_json = CefWriteJSON(value_value, JSON_WRITER_DEFAULT).ToWString();
  std::wstring js = L"(function(){var node=document.body;if(!node)return '0';var path=";
  js += L"[";
  for (size_t index = 0; index < path.size(); ++index) {
    if (index) js += L",";
    js += std::to_wstring(path[index]);
  }
  js += L"];";
  js += LR"JS(for(var i=0;i<path.length;i++){node=node.childNodes[path[i]];if(!node)return '0';}
try{
)JS";
  if (name.empty()) {
    js += L"node.value=" + value_json + L";";
  } else {
    js += L"node.setAttribute(" + name_json + L"," + value_json + L");";
  }
  js += LR"JS(return '1';}catch(e){return '0';}})())JS";
  return js;
}

/** DOM 快照 JS 兜底回调：解析页面内序列化 JSON 并注册受管快照。 */
class BridgeDomSnapshotJsCallback final : public FBroHsJsCallback {
 public:
  BridgeDomSnapshotJsCallback(std::shared_ptr<DomTaskShared> shared, int max_depth, int max_nodes)
      : shared_(std::move(shared)), max_depth_(max_depth), max_nodes_(max_nodes) {
    type_ = JsCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Callback(CefRefPtr<CefListValue> values) override {
    (void)max_depth_;
    (void)max_nodes_;
    if (!shared_->TryFinish()) return;
    // FBro ExecuteJavaScriptToHasReturn 的回调载荷形如 [状态, 类型, 返回值, 错误]：
    // 返回值在索引 2（字符串）；这里扫描全部元素取第一个可解析出 nodes 键的 JSON。
    std::wstring json;
    if (values) {
      for (size_t index = 0; index < values->GetSize(); ++index) {
        if (values->GetType(index) != VTYPE_STRING) continue;
        const std::wstring candidate = values->GetString(index).ToWString();
        if (candidate.find(L"nodes") == std::wstring::npos) continue;
        json = candidate;
        break;
      }
      if (json.empty()) json = JsonFromList(values);
    }
    auto snapshot = std::make_shared<DomSnapshot>();
    if (!ParseDomSnapshotJson(json, *snapshot)) {
      CompleteTextTask(shared_->task, L"", L"DOM 遍历失败：页面内序列化返回无效数据。");
      return;
    }
    const LB_FBRO_OBJECT_HANDLE snapshot_handle = RegisterDomSnapshot(snapshot);
    CompleteTextTask(shared_->task, L"{\"snapshot\":" + std::to_wstring(snapshot_handle)
        + L",\"nodes\":" + std::to_wstring(snapshot->nodes.size()) + L"}");
  }

 private:
  std::shared_ptr<DomTaskShared> shared_;
  int max_depth_;
  int max_nodes_;
  IMPLEMENT_REFCOUNTING(BridgeDomSnapshotJsCallback);
};

/** DOM 写回 JS 兜底回调：页面内 setAttribute/value 写回结果。 */
class BridgeDomApplyJsCallback final : public FBroHsJsCallback {
 public:
  explicit BridgeDomApplyJsCallback(std::shared_ptr<DomTaskShared> shared)
      : shared_(std::move(shared)) {
    type_ = JsCallbackType;
  }
  static void* operator new(size_t size) { return FBroMallocManger_New(size); }
  static void operator delete(void* pointer) noexcept { if (pointer) FBroMallocManger_Free(pointer); }
  void Callback(CefRefPtr<CefListValue> values) override {
    if (!shared_->TryFinish()) return;
    // 载荷形如 [状态, 类型, 返回值, 错误]，扫描字符串元素找 '1' 成功标记。
    if (values) {
      for (size_t index = 0; index < values->GetSize(); ++index) {
        if (values->GetType(index) == VTYPE_STRING && values->GetString(index) == "1") {
          CompleteTextTask(shared_->task, L"1");
          return;
        }
      }
    }
    CompleteTextTask(shared_->task, L"", L"DOM 写回失败：路径节点未找到或页面拒绝写入。");
  }

 private:
  std::shared_ptr<DomTaskShared> shared_;
  IMPLEMENT_REFCOUNTING(BridgeDomApplyJsCallback);
};

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_FrameVisitDomAsync(LB_FBRO_OBJECT_HANDLE frame_handle,
                                                         int max_depth, int max_nodes,
                                                         LB_FBRO_TASK_CALLBACK callback,
                                                         void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame_handle, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state || !frame_state->frame) return 0;
  if (max_depth <= 0) max_depth = kDomDefaultMaxDepth;
  if (max_nodes <= 0) max_nodes = kDomDefaultMaxNodes;
  auto task = CreateTask(callback, user_data);
  auto shared = std::make_shared<DomTaskShared>();
  shared->task = task;
  auto owned_frame = frame_state->frame;
  // 主路径：页面内 JS 序列化。实测（2026-09-09 冒烟）：官方 VisitDOM 在浏览器进程
  // 调用会卡死/拖垮 CEF UI 线程（CEF 语义 VisitDOM 只允许渲染进程调用），因此
  // BridgeDomVisitor 官方路径仅保留在桥源中作为参考实现，不参与默认调度。
  CefRefPtr<BridgeDomSnapshotJsCallback> js_callback =
      new BridgeDomSnapshotJsCallback(shared, max_depth, max_nodes);
  const std::wstring snapshot_js = BuildDomSnapshotJsSource(max_depth, max_nodes);
  // ExecuteJavaScriptToHasReturn 的结果投递实测（2026-09-09 冒烟）：在 CEF UI
  // 线程提交约 60 秒后回调到达；在普通工作线程提交则回调不派发。因此保持
  // CEF UI 线程提交，wrapper 侧等待上限覆盖该延迟。
  CefRefPtr<BridgeFrameActionTask> js_start = new BridgeFrameActionTask(
      [owned_frame, snapshot_js, js_callback]() {
        FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn(
            owned_frame, CefString(snapshot_js), CefString(L"lingbuilder://dom-snapshot"), 1,
            js_callback);
      },
      task, L"");
  ScheduleManagedTask(js_start, task, L"无法投递 DOM 遍历任务");
  return task->handle;
}

namespace {

std::shared_ptr<DomSnapshot> GetDomSnapshot(LB_FBRO_OBJECT_HANDLE object, int& status) {
  auto state = GetObject(object, LB_FBRO_OBJECT_DOM_SNAPSHOT, status);
  if (!state) return nullptr;
  return state->dom_snapshot;
}

const DomSnapshotNode* GetDomSnapshotNode(const std::shared_ptr<DomSnapshot>& snapshot,
                                          int node_index) {
  if (!snapshot || node_index < 0
      || node_index >= static_cast<int>(snapshot->nodes.size())) {
    return nullptr;
  }
  return &snapshot->nodes[static_cast<size_t>(node_index)];
}

LB_FBRO_TASK_HANDLE ScheduleDomApply(LB_FBRO_OBJECT_HANDLE frame_handle,
                                     const wchar_t* path_json, const wchar_t* name,
                                     const wchar_t* value, LB_FBRO_TASK_CALLBACK callback,
                                     void* user_data) {
  int status = LB_FBRO_OK;
  auto frame_state = GetObject(frame_handle, LB_FBRO_OBJECT_FRAME, status);
  if (!frame_state || !frame_state->frame) return 0;
  std::vector<int> path;
  const bool path_ok = ParseDomPath(path_json, path);
  if (!path_ok) return 0;
  auto task = CreateTask(callback, user_data);
  auto shared = std::make_shared<DomTaskShared>();
  shared->task = task;
  auto owned_frame = frame_state->frame;
  auto apply_name = name ? std::wstring(name) : std::wstring();
  auto apply_value = value ? std::wstring(value) : std::wstring();
  // 主路径：页面内 JS 按路径写回（官方 VisitDOM 写回路径同上，仅保留参考实现）。
  CefRefPtr<BridgeDomApplyJsCallback> js_callback = new BridgeDomApplyJsCallback(shared);
  const std::wstring apply_js = BuildDomApplyJsSource(path, apply_name, apply_value);
  CefRefPtr<BridgeFrameActionTask> js_start = new BridgeFrameActionTask(
      [owned_frame, apply_js, js_callback]() {
        FBroHsBrowserFrame_ExecuteJavaScriptToHasReturn(
            owned_frame, CefString(apply_js), CefString(L"lingbuilder://dom-apply"), 1, js_callback);
      },
      task, L"");
  ScheduleManagedTask(js_start, task, L"无法投递 DOM 写回任务");
  return task->handle;
}

}  // namespace

int __stdcall LB_FBro_DomGetTitle(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                  size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  if (!snapshot) return status;
  return CopyResult(snapshot->title, result, capacity);
}

int __stdcall LB_FBro_DomGetBaseUrl(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                    size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  if (!snapshot) return status;
  return CopyResult(snapshot->base_url, result, capacity);
}

int __stdcall LB_FBro_DomGetNodeCount(LB_FBRO_OBJECT_HANDLE object) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  if (!snapshot) return status;
  return static_cast<int>(snapshot->nodes.size());
}

int __stdcall LB_FBro_DomGetNodeType(LB_FBRO_OBJECT_HANDLE object, int node_index) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return node->type;
}

int __stdcall LB_FBro_DomGetNodePath(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                     wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return CopyResult(node->path, result, capacity);
}

int __stdcall LB_FBro_DomGetNodeName(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                     wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return CopyResult(node->name, result, capacity);
}

int __stdcall LB_FBro_DomGetNodeValue(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                      wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return CopyResult(node->value, result, capacity);
}

int __stdcall LB_FBro_DomGetNodeInnerText(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                          wchar_t* result, size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return CopyResult(node->inner_text, result, capacity);
}

int __stdcall LB_FBro_DomGetNodeAttributeCount(LB_FBRO_OBJECT_HANDLE object, int node_index) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  return static_cast<int>(node->attributes.size());
}

int __stdcall LB_FBro_DomGetNodeAttributeName(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                              int attribute_index, wchar_t* result,
                                              size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node || attribute_index < 0
      || attribute_index >= static_cast<int>(node->attributes.size())) {
    return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  }
  return CopyResult(node->attributes[static_cast<size_t>(attribute_index)].first, result,
                    capacity);
}

int __stdcall LB_FBro_DomGetNodeAttributeValue(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                               int attribute_index, wchar_t* result,
                                               size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node || attribute_index < 0
      || attribute_index >= static_cast<int>(node->attributes.size())) {
    return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  }
  return CopyResult(node->attributes[static_cast<size_t>(attribute_index)].second, result,
                    capacity);
}

int __stdcall LB_FBro_DomGetNodeAttributeByName(LB_FBRO_OBJECT_HANDLE object, int node_index,
                                                const wchar_t* name, wchar_t* result,
                                                size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  const auto* node = GetDomSnapshotNode(snapshot, node_index);
  if (!node || !name) return status == LB_FBRO_OK ? LB_FBRO_ERROR_INVALID_ARGUMENT : status;
  for (const auto& attribute : node->attributes) {
    if (attribute.first == name) return CopyResult(attribute.second, result, capacity);
  }
  return CopyResult(std::wstring(), result, capacity);
}

int __stdcall LB_FBro_DomGetFocusedPath(LB_FBRO_OBJECT_HANDLE object, wchar_t* result,
                                        size_t capacity) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  if (!snapshot) return status;
  return CopyResult(snapshot->focused_path, result, capacity);
}

int __stdcall LB_FBro_DomFindNodeByPath(LB_FBRO_OBJECT_HANDLE object, const wchar_t* path_json) {
  int status = LB_FBRO_OK;
  auto snapshot = GetDomSnapshot(object, status);
  if (!snapshot) return status;
  const std::wstring wanted = path_json ? path_json : L"";
  for (size_t index = 0; index < snapshot->nodes.size(); ++index) {
    if (snapshot->nodes[index].path == wanted) return static_cast<int>(index);
  }
  return -1;
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DomSetAttributeByPathAsync(LB_FBRO_OBJECT_HANDLE frame,
                                                 const wchar_t* path_json, const wchar_t* name,
                                                 const wchar_t* value,
                                                 LB_FBRO_TASK_CALLBACK callback,
                                                 void* user_data) {
  return ScheduleDomApply(frame, path_json, name, value, callback, user_data);
}

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_DomSetValueByPathAsync(LB_FBRO_OBJECT_HANDLE frame,
                                             const wchar_t* path_json, const wchar_t* value,
                                             LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  return ScheduleDomApply(frame, path_json, nullptr, value, callback, user_data);
}

// ---- 运行时独立 RequestContext（指纹双窗口隔离场景） ----

LB_FBRO_TASK_HANDLE __stdcall LB_FBro_RequestContextCreateAsync(const wchar_t* settings_json,
                                                                LB_FBRO_TASK_CALLBACK callback,
                                                                void* user_data) {
  auto task = CreateTask(callback, user_data);
  const std::wstring settings = settings_json ? settings_json : L"";
  CefRefPtr<BridgeFrameActionTask> start = new BridgeFrameActionTask([settings, task]() {
    std::string cache_path;
    std::string accept_language;
    std::string cookieable_schemes;
    BOOL persist_session_cookies = TRUE;
    int exclude_defaults = 0;
    if (!settings.empty()) {
      auto parsed = CefParseJSON(CefString(settings), JSON_PARSER_RFC);
      if (!parsed || parsed->GetType() != VTYPE_DICTIONARY) {
        CompleteTextTask(task, L"", L"创建 RequestContext 失败：设置 JSON 需为对象。");
        return;
      }
      auto dict = parsed->GetDictionary();
      if (dict->GetType("cachePath") == VTYPE_STRING) {
        cache_path = ToUtf8(dict->GetString("cachePath").ToWString());
      }
      if (dict->GetType("acceptLanguageList") == VTYPE_STRING) {
        accept_language = ToUtf8(dict->GetString("acceptLanguageList").ToWString());
      }
      if (dict->GetType("cookieableSchemesList") == VTYPE_STRING) {
        cookieable_schemes = ToUtf8(dict->GetString("cookieableSchemesList").ToWString());
      }
      if (dict->GetType("persistSessionCookies") == VTYPE_BOOL) {
        persist_session_cookies = dict->GetBool("persistSessionCookies") ? 1 : 0;
      }
      if (dict->GetType("cookieableSchemesExcludeDefaults") == VTYPE_BOOL) {
        exclude_defaults = dict->GetBool("cookieableSchemesExcludeDefaults") ? 1 : 0;
      }
    }
    // 官方结构体只保存 char* 指针，CreateContext 调用期间必须保持存活，
    // 因此字符串挂在本次任务的局部作用域内。
    E_REQUSETCONTEXT_SET context_set{};
    context_set.cache_path = cache_path.empty() ? nullptr : cache_path.data();
    context_set.persist_session_cookies = persist_session_cookies;
    context_set.accept_language_list =
        accept_language.empty() ? nullptr : accept_language.data();
    context_set.cookieable_schemes_list =
        cookieable_schemes.empty() ? nullptr : cookieable_schemes.data();
    context_set.cookieable_schemes_exclude_defaults = exclude_defaults;
    auto context = FBroHsRequestContext_CreateContext(&context_set);
    if (!context) {
      CompleteTextTask(task, L"", L"创建 RequestContext 失败：官方接口返回空。");
      return;
    }
    const LB_FBRO_OBJECT_HANDLE handle = RegisterCefObject(
        LB_FBRO_OBJECT_REQUEST_CONTEXT, context, &ObjectState::request_context);
    CompleteTextTask(task, L"{\"context\":" + std::to_wstring(handle) + L"}");
  }, task, L"");
  ScheduleManagedTask(start, task, L"无法投递 RequestContext 创建任务");
  return task->handle;
}

int __stdcall LB_FBro_RecreateBrowserWithContext(LB_FBRO_HANDLE browser,
                                                 LB_FBRO_OBJECT_HANDLE context) {
  int status = LB_FBRO_OK;
  auto context_state = GetObject(context, LB_FBRO_OBJECT_REQUEST_CONTEXT, status);
  if (!context_state || !context_state->request_context) {
    return LB_FBRO_ERROR_INVALID_ARGUMENT;
  }
  CefRefPtr<CefRequestContext> user_context = context_state->request_context;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  BrowserState* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_RELEASED_HANDLE;
  if (state->browser) {
    // 旧浏览器异步关闭，OnBeforeClose 后换上用户上下文自动重启。
    state->recreate_request_context = user_context;
    state->recreate_pending = true;
    FBroHsBrowserHost_TryCloseBrowser(state->browser);
    return 1;
  }
  state->request_context = user_context;
  state->recreate_request_context = nullptr;
  state->recreate_pending = false;
  state->create_started = false;
  state->extension_load_started = false;
  ScheduleBrowserStart(browser);
  return 1;
}

LB_FBRO_HANDLE __stdcall LB_FBro_BrowserHostGetMainBrowser(LB_FBRO_HANDLE browser) {
  CefRefPtr<CefBrowser> main_browser;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    BrowserState* state = Find(browser);
    if (!state || !state->browser) return 0;
    main_browser = FBroHsBrowserHost_GetMainBrowser(state->browser);
    if (!main_browser) return 0;
    if (main_browser->IsSame(state->browser)) return browser;
    for (auto& item : g_browsers) {
      if (item.second->browser && item.second->browser->IsSame(main_browser)) {
        return item.first;
      }
    }
  }
  return 0;
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
LB_FBRO_TASK_HANDLE __stdcall LB_FBro_CookieSetJsonAsync(
    LB_FBRO_HANDLE browser, const wchar_t* url, const wchar_t* cookie_json,
    LB_FBRO_TASK_CALLBACK callback, void* user_data) {
  if (!url || !*url || !cookie_json || !*cookie_json) return 0;
  auto task = CreateTask(callback, user_data);
  CefRefPtr<BridgeCookieTask> start = new BridgeCookieTask(
      browser, CookieTaskOperation::SetJson, {url, cookie_json}, 0, 0, 0, task);
  ScheduleManagedTask(start, task, L"无法投递结构化 Cookie 设置任务");
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

int __stdcall LB_FBro_ResourceBodyBegin(LB_FBRO_HANDLE browser, uint64_t request_id,
                                        int64_t max_bytes) {
  if (max_bytes <= 0) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  if (request_id == 0) return LB_FBRO_ERROR_OPERATION_FAILED;
  const uint64_t bounded = static_cast<uint64_t>(max_bytes);
  if (bounded > kMaxResourceBodyCaptureBytes) return LB_FBRO_ERROR_INVALID_ARGUMENT;
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  // request_id 来自当前“资源响应到达”事件包字段；事件与过滤器按请求标识精确配对，
  // 不依赖可能被并发资源事件覆盖的单一“当前请求”槽位。
  auto capture = std::make_shared<ResourceBodyCaptureState>();
  capture->max_bytes = bounded;
  const auto url = state->resource_urls.find(request_id);
  capture->url = url != state->resource_urls.end() ? url->second : std::wstring();
  state->resource_body_captures[request_id] = capture;
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_ResourceReplaceSet(LB_FBRO_HANDLE browser,
                                         LB_FBRO_BUFFER_HANDLE find_buffer,
                                         LB_FBRO_BUFFER_HANDLE replacement_buffer) {
  int status = LB_FBRO_OK;
  std::shared_ptr<BufferState> find_state = GetBuffer(find_buffer, status);
  if (find_buffer && !find_state) return status;
  std::shared_ptr<BufferState> replacement_state;
  if (replacement_buffer) {
    replacement_state = GetBuffer(replacement_buffer, status);
    if (!replacement_state) return status;
  }
  if (!find_state || find_state->bytes.empty()
      || find_state->bytes.size() > kMaxResourceReplaceBytes
      || (replacement_state && replacement_state->bytes.size() > kMaxResourceReplaceBytes)) {
    return LB_FBRO_ERROR_INVALID_ARGUMENT;
  }
  auto config = std::make_shared<ResourceReplaceConfig>();
  config->find_bytes = find_state->bytes;
  if (replacement_state) config->replacement_bytes = replacement_state->bytes;
  // 只在互斥锁下复制并整体替换 shared_ptr，不触碰 CEF 对象：任意线程同步安全，
  // 生成代码创建受管缓冲 → 调用本导出 → 立即释放缓冲的顺序是安全的。
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->resource_replace = std::move(config);
  return LB_FBRO_OK;
}

int __stdcall LB_FBro_ResourceReplaceClear(LB_FBRO_HANDLE browser) {
  std::lock_guard<std::recursive_mutex> lock(g_mutex);
  auto* state = Find(browser);
  if (!state) return LB_FBRO_ERROR_NOT_FOUND;
  state->resource_replace.reset();
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
  // 实验开关：LINGBUILDER_FBRO_HOOK_DISABLE=1 时跳过启用 WS 客户端钩子，
  // 用于对照排查钩子启用后的行为。
  wchar_t hook_disable[8]{};
  const bool hook_disabled =
      GetEnvironmentVariableW(L"LINGBUILDER_FBRO_HOOK_DISABLE", hook_disable,
                              _countof(hook_disable)) > 0
      && wcscmp(hook_disable, L"1") == 0;
  if (!hook_disabled && ReadJsonBool(dict, "enableWebsocketClientHook", 0)) FBroHsVIPControl_EnableWebsocketClientHook(vip);
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
