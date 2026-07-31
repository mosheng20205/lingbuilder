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
#include "FBroListValue.h"
#include "FBroImage.h"
#include "FBroMiddleData.h"
#include "FBroRequestContext.h"
#include "FBroStream.h"
#include "FBroSSLInfo.h"
#include "FBroString.h"
#include "FBroValue.h"
#include "FBroX509Certificate.h"
#include "FBroX509CertPrincipal.h"
#include "FBroVIPStruct.h"
#include "FBroVIPControl.h"
#include "FBroVIPEventInterface.h"
#include "FBroVIPInterface.h"
#include "include/cef_parser.h"
#include "include/cef_navigation_entry.h"
#include "include/cef_ssl_status.h"
#include "include/cef_task.h"

#include <shobjidl.h>

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <chrono>
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
#include <vector>

namespace {

struct BrowserState;
class BridgeBrowserEvent;

std::recursive_mutex g_mutex;
std::condition_variable_any g_close_condition;
std::unordered_map<LB_FBRO_HANDLE, std::unique_ptr<BrowserState>> g_browsers;
std::atomic<LB_FBRO_HANDLE> g_next_handle{1};
std::atomic<uint64_t> g_next_object_handle{0x100000000ULL};
std::atomic<uint64_t> g_event_sequence{1};
std::atomic<bool> g_initialized{false};
std::atomic<bool> g_ready{false};
std::atomic<bool> g_shutdown_started{false};
std::atomic<bool> g_license_attempted{false};
std::atomic<bool> g_license_valid{false};
bool g_winsock_started = false;
CefRefPtr<FBroHsInitEvent> g_init_event;
std::filesystem::path g_runtime_directory;
std::filesystem::path g_root_cache_directory;
std::wstring g_license_error;

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

std::unordered_map<LB_FBRO_TASK_HANDLE, std::shared_ptr<TaskState>> g_tasks;
std::unordered_map<LB_FBRO_BUFFER_HANDLE, std::shared_ptr<BufferState>> g_buffers;
std::unordered_map<LB_FBRO_OBJECT_HANDLE, std::shared_ptr<ObjectState>> g_objects;

struct BrowserState {
  LB_FBRO_HANDLE handle = 0;
  HWND host = nullptr;
  std::wstring url;
  std::wstring profile;
  std::wstring title;
  std::wstring user_agent;
  std::wstring last_event;
  std::wstring last_event_json;
  LB_FBRO_OBJECT_HANDLE last_event_object = 0;
  std::wstring last_error;
  LB_FBRO_EVENT_CALLBACK callback = nullptr;
  void* user_data = nullptr;
  LB_FBRO_EVENT_CALLBACK_V2 callback_v2 = nullptr;
  void* user_data_v2 = nullptr;
  CefRefPtr<CefBrowser> browser;
  CefRefPtr<CefRequestContext> request_context;
  CefRefPtr<BridgeBrowserEvent> event;
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
    default: return L"Unknown";
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

int Notify(BrowserState& state, int code, const std::wstring& data,
           std::wstring* result_text = nullptr, LB_FBRO_OBJECT_HANDLE object = 0) {
  state.last_event = EventName(code);
  state.last_event_object = object;
  state.last_event_json = BuildEventJson(state, code, data);
  if (code == LB_FBRO_EVENT_ERROR) state.last_error = data;
  const auto callback = state.callback;
  const auto callback_v2 = state.callback_v2;
  if (callback && !callback_v2) callback(state.handle, code, data.c_str(), state.user_data);
  if (!callback_v2) return 0;
  wchar_t callback_result[4096]{};
  LB_FBRO_EVENT_PACKET_V2 packet{};
  packet.struct_size = sizeof(packet);
  packet.abi_version = LB_FBRO_ABI_VERSION_V2;
  packet.sequence = g_event_sequence.fetch_add(1);
  packet.timestamp_milliseconds = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::system_clock::now().time_since_epoch()).count());
  packet.browser = state.handle;
  packet.event_code = code;
  packet.instance_kind = state.chrome_ui ? LB_FBRO_INSTANCE_CHROME_UI : LB_FBRO_INSTANCE_EMBEDDED;
  packet.event_name = EventName(code);
  packet.data_json = state.last_event_json.c_str();
  packet.object = object;
  const int action = callback_v2(&packet, callback_result, std::size(callback_result), state.user_data_v2);
  if (result_text) *result_text = callback_result;
  return action;
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
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      state->browser = nullptr;
      Notify(*state, LB_FBRO_EVENT_CLOSED, L"浏览器关闭完成");
      g_close_condition.notify_all();
    }
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
    int action = 0;
    std::unique_lock<std::recursive_mutex> lock(g_mutex);
    auto* state = Find(handle_);
    lock.unlock();
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
  void OnContextInitialized() override {
    g_ready = true;
    StartPendingBrowsers();
  }
 private:
  IMPLEMENT_REFCOUNTING(BridgeInitEvent);
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

std::string ReadJsonUtf8(CefRefPtr<CefDictionaryValue> value, const char* key) {
  if (!value || value->GetType(key) != VTYPE_STRING) return {};
  return ToUtf8(value->GetString(key).ToWString());
}

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

uint32_t __stdcall LB_FBro_GetAbiVersion(void) { return LB_FBRO_ABI_VERSION_V2; }

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
  // DPI awareness is owned by the generated host and must be set before it creates any HWND.
  FBroSetV8DefaultsHeapSize(4, 2048);
  wchar_t vip_key[4096]{};
  if (GetEnvironmentVariableW(L"LINGBUILDER_FBRO_VIP_KEY", vip_key, 4096) > 0) {
    g_license_attempted = true;
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
  if (!FBroHsInitPro(&settings, g_init_event, 1024)) {
    g_init_event = nullptr;
    WSACleanup();
    g_winsock_started = false;
    return -2;
  }
  g_initialized = true;
  return 1;
}

int __stdcall LB_FBro_IsReady(void) { return g_ready ? 1 : 0; }

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
  if (dict->HasKey("platform")) FBroHsVIPControl_SetVirPlatform(vip, dict->GetString("platform"));
  if (dict->HasKey("languages")) FBroHsVIPControl_SetVirLanguages(vip, dict->GetString("languages"));
  if (dict->HasKey("hardwareConcurrency")) FBroHsVIPControl_SetVirHardwareConcurrency(vip, dict->GetInt("hardwareConcurrency"));
  if (dict->HasKey("deviceMemory")) FBroHsVIPControl_SetVirDeviceMemory(vip, dict->GetInt("deviceMemory"));
  if (dict->HasKey("screenWidth") && dict->HasKey("screenHeight"))
    FBroHsVIPControl_SetVirScreenHeightAndWidth(vip, dict->GetInt("screenHeight"), dict->GetInt("screenWidth"));
  if (dict->HasKey("devicePixelRatio")) FBroHsVIPControl_SetVirDevicePixelRatio(vip, dict->GetDouble("devicePixelRatio"));
  if (dict->HasKey("webglVendor")) FBroHsVIPControl_SetVirWebglvendor(vip, dict->GetString("webglVendor"));
  if (dict->HasKey("webglRenderer")) FBroHsVIPControl_SetVirWebglrenderer(vip, dict->GetString("webglRenderer"));
  const int seed = dict->HasKey("seed") ? dict->GetInt("seed") : 128;
  FBroHsVIPControl_SetCanvasFingerPrint_random(vip, 1, 16, seed);
  FBroHsVIPControl_SetWebGLFingerPrint_random(vip, 1, 100, seed + 17);
  FBroHsVIPControl_SetAudioFingerPrint_random(vip, 100, 1000, seed + 31);
  return 1;
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
  std::lock_guard<std::recursive_mutex> lock(g_mutex); BrowserState* state = Find(browser);
  if (state && state->browser) FBroHsBrowserHost_CloseBrowser(state->browser, true);
}
void __stdcall LB_FBro_Shutdown(void) {
  if (!g_initialized || g_shutdown_started.exchange(true)) return;
  {
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    for (auto& item : g_browsers) if (item.second->browser) FBroHsBrowserHost_CloseBrowser(item.second->browser, true);
  }
  FBroShutdown(FALSE);
  std::unique_lock<std::recursive_mutex> lock(g_mutex);
  g_close_condition.wait_for(lock, std::chrono::seconds(3), [] {
    return std::all_of(g_browsers.begin(), g_browsers.end(), [](const auto& item) {
      return !item.second->browser;
    });
  });
  g_browsers.clear(); g_tasks.clear(); g_buffers.clear(); g_objects.clear();
  g_init_event = nullptr; g_ready = false; g_initialized = false;
  if (g_winsock_started) { WSACleanup(); g_winsock_started = false; }
}
