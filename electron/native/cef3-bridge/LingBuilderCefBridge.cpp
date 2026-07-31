#include "LingBuilderCefBridge.h"

#include "include/cef_app.h"
#include "include/cef_browser.h"
#include "include/cef_client.h"
#include "include/cef_cookie.h"
#include "include/cef_devtools_message_observer.h"
#include "include/cef_display_handler.h"
#include "include/cef_focus_handler.h"
#include "include/cef_image.h"
#include "include/cef_keyboard_handler.h"
#include "include/cef_life_span_handler.h"
#include "include/cef_load_handler.h"
#include "include/cef_menu_model.h"
#include "include/cef_parser.h"
#include "include/cef_preference.h"
#include "include/cef_request_context_handler.h"
#include "include/cef_task.h"
#include "include/cef_values.h"
#include "include/cef_version.h"
#include "include/cef_x509_certificate.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iomanip>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#include <windows.h>

namespace {

bool RunOnCefUiSync(std::function<void()> callback);
std::wstring JsonEscape(const std::wstring& value);

struct TaskState {
  std::atomic<int> status{LB_CEF3_TASK_PENDING};
  std::mutex mutex;
  std::condition_variable changed;
  std::wstring result;
  std::wstring error;
  int message_id = 0;
  CefRefPtr<CefRegistration> registration;
};

struct BufferState {
  std::vector<unsigned char> bytes;
};

struct ValueState {
  std::mutex mutex;
  CefRefPtr<CefValue> value;
};

struct DictionaryState {
  std::mutex mutex;
  CefRefPtr<CefDictionaryValue> value;
};

struct ListState {
  std::mutex mutex;
  CefRefPtr<CefListValue> value;
};

struct RequestContextState {
  CefRefPtr<CefRequestContext> context;
};

struct ImageState {
  std::mutex mutex;
  CefRefPtr<CefImage> image;
  ~ImageState();
};

struct MenuState {
  CefRefPtr<CefMenuModel> menu;
  ~MenuState();
};

struct NavigationEntryState {
  bool valid = false;
  std::wstring url;
  std::wstring display_url;
  std::wstring original_url;
  std::wstring title;
  int transition_type = 0;
  bool has_post_data = false;
  double completion_time = 0.0;
  int http_status_code = 0;
};

struct CertificatePrincipalState {
  std::wstring display_name;
  std::wstring common_name;
  std::wstring locality_name;
  std::wstring state_or_province_name;
  std::wstring country_name;
  std::vector<std::wstring> organization_names;
  std::vector<std::wstring> organization_unit_names;
};

struct CertificateState {
  bool secure_connection = false;
  uint32_t cert_status = 0;
  int ssl_version = 0;
  uint32_t content_status = 0;
  CertificatePrincipalState subject;
  CertificatePrincipalState issuer;
  std::vector<unsigned char> serial_number;
  std::vector<unsigned char> der_encoded;
  std::vector<unsigned char> pem_encoded;
  int64_t valid_start = 0;
  int64_t valid_expiry = 0;
  std::vector<std::vector<unsigned char>> der_issuer_chain;
  std::vector<std::vector<unsigned char>> pem_issuer_chain;
};

struct HandleEntry {
  int type = LB_CEF3_HANDLE_UNKNOWN;
  uint32_t references = 1;
  std::shared_ptr<TaskState> task;
  std::shared_ptr<BufferState> buffer;
  std::shared_ptr<void> object;
};

std::mutex g_mutex;
std::unordered_map<LB_CEF3_HANDLE, HandleEntry> g_handles;
std::atomic<uint64_t> g_next_handle{0xCEF3000000000001ULL};
std::filesystem::path g_allowed_root;
thread_local std::wstring g_last_error;
std::atomic<bool> g_cef_initialized{false};
std::filesystem::path g_cef_root_cache;
LB_CEF3_EVENT_CALLBACK_V3 g_event_callback = nullptr;
void* g_event_user_data = nullptr;
std::atomic<uint64_t> g_event_sequence{1};

#define LB_CEF3_WIDEN_INNER(value) L##value
#define LB_CEF3_WIDEN(value) LB_CEF3_WIDEN_INNER(value)

int Fail(int code, std::wstring message) {
  g_last_error = std::move(message);
  return code;
}

int CopyWide(const std::wstring& value, wchar_t* result, size_t capacity, size_t* required) {
  const size_t needed = value.size() + 1;
  if (required) *required = needed;
  if (!result || capacity < needed) return Fail(LB_CEF3_ERROR_BUFFER_TOO_SMALL, L"输出缓冲区不足");
  std::copy(value.begin(), value.end(), result);
  result[value.size()] = L'\0';
  return LB_CEF3_OK;
}

LB_CEF3_HANDLE Register(HandleEntry entry) {
  const auto handle = g_next_handle.fetch_add(1, std::memory_order_relaxed);
  std::lock_guard<std::mutex> lock(g_mutex);
  g_handles.emplace(handle, std::move(entry));
  return handle;
}

bool GetEntry(LB_CEF3_HANDLE handle, int expected_type, HandleEntry& entry, int& status) {
  std::lock_guard<std::mutex> lock(g_mutex);
  const auto found = g_handles.find(handle);
  if (found == g_handles.end()) {
    status = Fail(LB_CEF3_ERROR_RELEASED_HANDLE, L"句柄不存在或已经释放");
    return false;
  }
  if (expected_type != LB_CEF3_HANDLE_UNKNOWN && found->second.type != expected_type) {
    status = Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"句柄类型不匹配");
    return false;
  }
  entry = found->second;
  status = LB_CEF3_OK;
  return true;
}

bool IsPathAllowed(const wchar_t* value, std::filesystem::path& resolved) {
  if (!value || !*value) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"文件路径不能为空");
    return false;
  }
  std::filesystem::path root;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    root = g_allowed_root;
  }
  if (root.empty()) {
    Fail(LB_CEF3_ERROR_PATH_DENIED, L"尚未配置允许的文件根目录");
    return false;
  }
  std::error_code error;
  resolved = std::filesystem::weakly_canonical(std::filesystem::path(value), error);
  if (error) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"无法解析文件路径");
    return false;
  }
  const auto root_text = root.native();
  const auto path_text = resolved.native();
  if (path_text.size() < root_text.size()
      || !std::equal(root_text.begin(), root_text.end(), path_text.begin(),
                     [](wchar_t left, wchar_t right) { return towlower(left) == towlower(right); })
      || (path_text.size() > root_text.size() && path_text[root_text.size()] != L'\\')) {
    Fail(LB_CEF3_ERROR_PATH_DENIED, L"文件路径超出允许根目录");
    return false;
  }
  return true;
}

std::shared_ptr<TaskState> GetTask(LB_CEF3_TASK_HANDLE handle, int& status) {
  HandleEntry entry;
  if (!GetEntry(handle, LB_CEF3_HANDLE_TASK, entry, status)) return {};
  return entry.task;
}

std::shared_ptr<BufferState> GetBuffer(LB_CEF3_BUFFER_HANDLE handle, int& status) {
  HandleEntry entry;
  if (!GetEntry(handle, LB_CEF3_HANDLE_BUFFER, entry, status)) return {};
  return entry.buffer;
}

struct BrowserState {
  std::mutex mutex;
  std::condition_variable changed;
  LB_CEF3_HANDLE handle = 0;
  uint64_t user_token = 0;
  HWND parent = nullptr;
  uint32_t flags = 0;
  std::wstring title;
  std::wstring url;
  std::wstring profile_path;
  std::wstring proxy_server;
  CefRefPtr<CefBrowser> browser;
  CefRefPtr<CefClient> client;
  CefRefPtr<CefRequestContext> request_context;
  bool closed = false;
  LB_CEF3_EVENT_CALLBACK_V3 event_callback = nullptr;
  void* event_user_data = nullptr;
};

template <typename T>
std::shared_ptr<T> GetObject(LB_CEF3_HANDLE handle, int expected_type, int& status) {
  HandleEntry entry;
  if (!GetEntry(handle, expected_type, entry, status) || !entry.object) return {};
  return std::static_pointer_cast<T>(entry.object);
}

std::shared_ptr<ValueState> GetValueState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<ValueState>(handle, LB_CEF3_HANDLE_VALUE, status);
}

std::shared_ptr<DictionaryState> GetDictionaryState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<DictionaryState>(handle, LB_CEF3_HANDLE_DICTIONARY, status);
}

std::shared_ptr<ListState> GetListState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<ListState>(handle, LB_CEF3_HANDLE_LIST, status);
}

std::shared_ptr<RequestContextState> GetRequestContextState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<RequestContextState>(handle, LB_CEF3_HANDLE_REQUEST_CONTEXT, status);
}

std::shared_ptr<ImageState> GetImageState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<ImageState>(handle, LB_CEF3_HANDLE_IMAGE, status);
}

std::shared_ptr<MenuState> GetMenuState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<MenuState>(handle, LB_CEF3_HANDLE_MENU, status);
}

std::shared_ptr<NavigationEntryState> GetNavigationEntryState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<NavigationEntryState>(handle, LB_CEF3_HANDLE_NAVIGATION_ENTRY, status);
}

std::shared_ptr<CertificateState> GetCertificateState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<CertificateState>(handle, LB_CEF3_HANDLE_CERTIFICATE, status);
}

std::shared_ptr<CertificatePrincipalState> GetCertificatePrincipalState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<CertificatePrincipalState>(handle, LB_CEF3_HANDLE_CERTIFICATE_PRINCIPAL, status);
}

LB_CEF3_HANDLE RegisterMenu(CefRefPtr<CefMenuModel> menu) {
  if (!menu) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF菜单对象创建失败");
    return 0;
  }
  auto state = std::make_shared<MenuState>();
  state->menu = menu;
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_MENU;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

LB_CEF3_HANDLE RegisterValue(CefRefPtr<CefValue> value) {
  if (!value) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF值对象创建失败");
    return 0;
  }
  auto state = std::make_shared<ValueState>();
  state->value = value;
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_VALUE;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

LB_CEF3_HANDLE RegisterDictionary(CefRefPtr<CefDictionaryValue> value) {
  if (!value) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF字典对象创建失败");
    return 0;
  }
  auto state = std::make_shared<DictionaryState>();
  state->value = value;
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_DICTIONARY;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

LB_CEF3_HANDLE RegisterList(CefRefPtr<CefListValue> value) {
  if (!value) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF列表对象创建失败");
    return 0;
  }
  auto state = std::make_shared<ListState>();
  state->value = value;
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_LIST;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

int ValueType(CefValueType type) {
  switch (type) {
    case VTYPE_NULL: return LB_CEF3_VALUE_NULL;
    case VTYPE_BOOL: return LB_CEF3_VALUE_BOOL;
    case VTYPE_INT: return LB_CEF3_VALUE_INT;
    case VTYPE_DOUBLE: return LB_CEF3_VALUE_DOUBLE;
    case VTYPE_STRING: return LB_CEF3_VALUE_STRING;
    case VTYPE_BINARY: return LB_CEF3_VALUE_BINARY;
    case VTYPE_DICTIONARY: return LB_CEF3_VALUE_DICTIONARY;
    case VTYPE_LIST: return LB_CEF3_VALUE_LIST;
    case VTYPE_INVALID:
    default: return LB_CEF3_VALUE_INVALID;
  }
}

std::wstring ValueJson(CefRefPtr<CefValue> value) {
  return value ? CefWriteJSON(value, JSON_WRITER_DEFAULT).ToWString() : std::wstring();
}

LB_CEF3_BUFFER_HANDLE RegisterBinaryBuffer(CefRefPtr<CefBinaryValue> binary) {
  if (!binary || !binary->IsValid()) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF二进制结果无效");
    return 0;
  }
  std::vector<unsigned char> bytes(binary->GetSize());
  if (!bytes.empty() && binary->GetData(bytes.data(), bytes.size(), 0) != bytes.size()) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"读取CEF二进制结果失败");
    return 0;
  }
  return LB_CEF3_BufferCreate(bytes.data(), bytes.size());
}

std::vector<unsigned char> CopyBinaryBytes(CefRefPtr<CefBinaryValue> binary) {
  if (!binary || !binary->IsValid()) return {};
  std::vector<unsigned char> bytes(binary->GetSize());
  if (!bytes.empty() && binary->GetData(bytes.data(), bytes.size(), 0) != bytes.size()) return {};
  return bytes;
}

LB_CEF3_BUFFER_HANDLE RegisterBytes(const std::vector<unsigned char>& bytes) {
  return LB_CEF3_BufferCreate(bytes.data(), bytes.size());
}

std::wstring StringVectorJson(const std::vector<std::wstring>& values) {
  std::wostringstream json;
  json << L"[";
  for (size_t index = 0; index < values.size(); ++index) {
    if (index > 0) json << L",";
    json << L"\"" << JsonEscape(values[index]) << L"\"";
  }
  json << L"]";
  return json.str();
}

std::wstring JsonEscape(const std::wstring& value) {
  std::wstring result;
  result.reserve(value.size() + 8);
  for (wchar_t ch : value) {
    switch (ch) {
      case L'\\': result += L"\\\\"; break;
      case L'"': result += L"\\\""; break;
      case L'\r': result += L"\\r"; break;
      case L'\n': result += L"\\n"; break;
      case L'\t': result += L"\\t"; break;
      default: result += ch; break;
    }
  }
  return result;
}

LB_CEF3_EVENT_RESPONSE_V3 EmitEvent(const std::shared_ptr<BrowserState>& state, int event_code, const wchar_t* event_name,
                                    const std::wstring& fields_json, bool synchronous = false) {
  LB_CEF3_EVENT_RESPONSE_V3 response{};
  response.struct_size = sizeof(response);
  response.abi_version = LB_CEF3_ABI_VERSION_V3;
  auto callback = state->event_callback ? state->event_callback : g_event_callback;
  if (!callback || !state) return response;
  LB_CEF3_EVENT_PACKET_V3 packet{};
  packet.struct_size = sizeof(packet);
  packet.abi_version = LB_CEF3_ABI_VERSION_V3;
  packet.sequence = g_event_sequence.fetch_add(1, std::memory_order_relaxed);
  packet.timestamp_milliseconds = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::system_clock::now().time_since_epoch()).count());
  packet.browser = state->handle;
  packet.user_token = state->user_token;
  packet.event_code = event_code;
  packet.flags = synchronous ? 1u : 0u;
  packet.event_name = event_name;
  packet.fields_json = fields_json.c_str();
  callback(&packet, &response, state->event_callback ? state->event_user_data : g_event_user_data);
  return response;
}

class BridgeFunctionTask final : public CefTask {
 public:
  explicit BridgeFunctionTask(std::function<void()> callback) : callback_(std::move(callback)) {}
  void Execute() override { callback_(); }
 private:
  std::function<void()> callback_;
  IMPLEMENT_REFCOUNTING(BridgeFunctionTask);
};

bool PostToCefUi(std::function<void()> callback) {
  if (CefCurrentlyOn(TID_UI)) {
    callback();
    return true;
  }
  return CefPostTask(TID_UI, new BridgeFunctionTask(std::move(callback)));
}

bool RunOnCefUiSync(std::function<void()> callback) {
  if (CefCurrentlyOn(TID_UI)) {
    callback();
    return true;
  }
  struct Completion {
    std::mutex mutex;
    std::condition_variable changed;
    bool done = false;
  };
  auto completion = std::make_shared<Completion>();
  if (!PostToCefUi([callback = std::move(callback), completion]() mutable {
        callback();
        {
          std::lock_guard<std::mutex> lock(completion->mutex);
          completion->done = true;
        }
        completion->changed.notify_all();
      })) return false;
  std::unique_lock<std::mutex> lock(completion->mutex);
  return completion->changed.wait_for(lock, std::chrono::seconds(5), [&] { return completion->done; });
}

ImageState::~ImageState() {
  auto* pending = new CefRefPtr<CefImage>();
  pending->swap(image);
  if (!*pending) {
    delete pending;
    return;
  }
  if (!RunOnCefUiSync([pending]() {
        pending->reset();
        delete pending;
      })) {
    // CEF UI线程不可用时保留该最终引用，避免在错误线程销毁CEF线程绑定对象。
  }
}

MenuState::~MenuState() {
  auto* pending = new CefRefPtr<CefMenuModel>();
  pending->swap(menu);
  if (!*pending) { delete pending; return; }
  if (!RunOnCefUiSync([pending]() {
        pending->reset();
        delete pending;
      })) {
    // CEF UI线程已停止时保留最终引用，避免在错误线程销毁线程绑定对象。
  }
}

class BridgeMenuDelegate final : public CefMenuModelDelegate {
 public:
  void ExecuteCommand(CefRefPtr<CefMenuModel>, int, cef_event_flags_t) override {}
 private:
  IMPLEMENT_REFCOUNTING(BridgeMenuDelegate);
};

int WithMenuInt(LB_CEF3_HANDLE handle, std::function<int(CefRefPtr<CefMenuModel>)> action) {
  int status = 0; auto state = GetMenuState(handle, status); if (!state) return status;
  auto result = std::make_shared<int>(LB_CEF3_ERROR_OPERATION_FAILED);
  if (!RunOnCefUiSync([state, result, action = std::move(action)]() { *result = action(state->menu); }))
    return Fail(LB_CEF3_ERROR_TIMEOUT, L"CEF菜单操作超时");
  return *result;
}

int64_t WithMenuInt64(LB_CEF3_HANDLE handle, std::function<int64_t(CefRefPtr<CefMenuModel>)> action) {
  int status = 0; auto state = GetMenuState(handle, status); if (!state) return status;
  auto result = std::make_shared<int64_t>(LB_CEF3_ERROR_OPERATION_FAILED);
  if (!RunOnCefUiSync([state, result, action = std::move(action)]() { *result = action(state->menu); })) {
    Fail(LB_CEF3_ERROR_TIMEOUT, L"CEF菜单操作超时");
    return LB_CEF3_ERROR_TIMEOUT;
  }
  return *result;
}

LB_CEF3_HANDLE WithMenuHandle(
    LB_CEF3_HANDLE handle, std::function<CefRefPtr<CefMenuModel>(CefRefPtr<CefMenuModel>)> action) {
  int status = 0; auto state = GetMenuState(handle, status); if (!state) return 0;
  auto result = std::make_shared<CefRefPtr<CefMenuModel>>();
  if (!RunOnCefUiSync([state, result, action = std::move(action)]() { *result = action(state->menu); })) {
    Fail(LB_CEF3_ERROR_TIMEOUT, L"CEF菜单操作超时");
    return 0;
  }
  return RegisterMenu(*result);
}

int WithMenuString(LB_CEF3_HANDLE handle, std::function<CefString(CefRefPtr<CefMenuModel>)> action,
                   wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetMenuState(handle, status); if (!state) return status;
  auto value = std::make_shared<CefString>();
  if (!RunOnCefUiSync([state, value, action = std::move(action)]() { *value = action(state->menu); }))
    return Fail(LB_CEF3_ERROR_TIMEOUT, L"CEF菜单操作超时");
  return CopyWide(value->ToWString(), result, capacity, required);
}

int64_t BaseTimeToUnixSeconds(const CefBaseTime& value) {
  if (value.val == 0) return 0;
  return static_cast<int64_t>(value.val / 1000000 - 11644473600LL);
}

CertificatePrincipalState SnapshotPrincipal(CefRefPtr<CefX509CertPrincipal> principal) {
  CertificatePrincipalState snapshot;
  if (!principal) return snapshot;
  snapshot.display_name = principal->GetDisplayName().ToWString();
  snapshot.common_name = principal->GetCommonName().ToWString();
  snapshot.locality_name = principal->GetLocalityName().ToWString();
  snapshot.state_or_province_name = principal->GetStateOrProvinceName().ToWString();
  snapshot.country_name = principal->GetCountryName().ToWString();
  std::vector<CefString> names;
  principal->GetOrganizationNames(names);
  for (const auto& name : names) snapshot.organization_names.push_back(name.ToWString());
  names.clear();
  principal->GetOrganizationUnitNames(names);
  for (const auto& name : names) snapshot.organization_unit_names.push_back(name.ToWString());
  return snapshot;
}

void SnapshotCertificate(CefRefPtr<CefX509Certificate> certificate, CertificateState& snapshot) {
  snapshot.subject = SnapshotPrincipal(certificate->GetSubject());
  snapshot.issuer = SnapshotPrincipal(certificate->GetIssuer());
  snapshot.serial_number = CopyBinaryBytes(certificate->GetSerialNumber());
  snapshot.der_encoded = CopyBinaryBytes(certificate->GetDEREncoded());
  snapshot.pem_encoded = CopyBinaryBytes(certificate->GetPEMEncoded());
  snapshot.valid_start = BaseTimeToUnixSeconds(certificate->GetValidStart());
  snapshot.valid_expiry = BaseTimeToUnixSeconds(certificate->GetValidExpiry());
  CefX509Certificate::IssuerChainBinaryList chain;
  certificate->GetDEREncodedIssuerChain(chain);
  for (const auto& item : chain) snapshot.der_issuer_chain.push_back(CopyBinaryBytes(item));
  chain.clear();
  certificate->GetPEMEncodedIssuerChain(chain);
  for (const auto& item : chain) snapshot.pem_issuer_chain.push_back(CopyBinaryBytes(item));
}

bool SetProxyPreference(CefRefPtr<CefRequestContext> context, const std::wstring& mode,
                        const std::wstring& server, std::wstring& error_text) {
  if (!context) { error_text = L"CEF3 RequestContext无效。"; return false; }
  CefString error;
  bool success = false;
  if (mode == L"system" || mode.empty()) {
    success = context->SetPreference(L"proxy", nullptr, error);
  } else {
    CefRefPtr<CefDictionaryValue> proxy = CefDictionaryValue::Create();
    proxy->SetString(L"mode", mode);
    if (mode == L"fixed_servers") proxy->SetString(L"server", server);
    CefRefPtr<CefValue> value = CefValue::Create();
    value->SetDictionary(proxy);
    success = context->SetPreference(L"proxy", value, error);
  }
  error_text = error.ToWString();
  return success;
}

class BridgeRequestContextHandler final : public CefRequestContextHandler {
 public:
  BridgeRequestContextHandler(std::wstring mode, std::wstring server)
      : mode_(std::move(mode)), server_(std::move(server)) {}
  void OnRequestContextInitialized(CefRefPtr<CefRequestContext> context) override {
    std::wstring error;
    if (!SetProxyPreference(context, mode_, server_, error) && !error.empty()) Fail(LB_CEF3_ERROR_OPERATION_FAILED, error);
  }
 private:
  std::wstring mode_;
  std::wstring server_;
  IMPLEMENT_REFCOUNTING(BridgeRequestContextHandler);
};

class BridgeClient final : public CefClient,
                           public CefDisplayHandler,
                           public CefFocusHandler,
                           public CefKeyboardHandler,
                           public CefLifeSpanHandler,
                           public CefLoadHandler {
 public:
  explicit BridgeClient(std::shared_ptr<BrowserState> state) : state_(std::move(state)) {}
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefFocusHandler> GetFocusHandler() override { return this; }
  CefRefPtr<CefKeyboardHandler> GetKeyboardHandler() override { return this; }
  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
  void OnAfterCreated(CefRefPtr<CefBrowser> browser) override {
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->browser = browser; state_->closed = false; }
    state_->changed.notify_all();
    EmitEvent(state_, 1, L"浏览器创建完成", L"{\"browserId\":" + std::to_wstring(browser->GetIdentifier()) + L"}");
  }
  bool DoClose(CefRefPtr<CefBrowser> browser) override {
    return EmitEvent(state_, 25, L"浏览器请求关闭", L"{\"browserId\":"
      + std::to_wstring(browser ? browser->GetIdentifier() : 0) + L"}", true).action == 3;
  }
  bool OnBeforePopup(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int popup_id,
                     const CefString& target_url, const CefString& target_frame_name,
                     WindowOpenDisposition target_disposition, bool user_gesture,
                     const CefPopupFeatures&, CefWindowInfo&, CefRefPtr<CefClient>&,
                     CefBrowserSettings&, CefRefPtr<CefDictionaryValue>&, bool*) override {
    const auto frame_id = frame ? frame->GetIdentifier() : CefString();
    auto response = EmitEvent(state_, 26, L"新窗口打开前", L"{\"url\":\""
      + JsonEscape(target_url.ToWString()) + L"\",\"frameName\":\""
      + JsonEscape(target_frame_name.ToWString()) + L"\",\"frameId\":\""
      + JsonEscape(frame_id.ToWString()) + L"\",\"popupId\":" + std::to_wstring(popup_id)
      + L",\"disposition\":" + std::to_wstring(target_disposition)
      + L",\"userGesture\":" + std::wstring(user_gesture ? L"true" : L"false") + L"}", true);
    return response.action == 2 || response.action == 3;
  }
  void OnBeforePopupAborted(CefRefPtr<CefBrowser>, int popup_id) override {
    EmitEvent(state_, 27, L"新窗口打开已中止", L"{\"popupId\":" + std::to_wstring(popup_id) + L"}");
  }
  void OnBeforeDevToolsPopup(CefRefPtr<CefBrowser>, CefWindowInfo&, CefRefPtr<CefClient>&,
                             CefBrowserSettings&, CefRefPtr<CefDictionaryValue>&, bool*) override {
    EmitEvent(state_, 28, L"开发者工具窗口打开前", L"{}");
  }
  void OnBeforeClose(CefRefPtr<CefBrowser>) override {
    EmitEvent(state_, 2, L"浏览器即将关闭", L"{}");
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->browser = nullptr; state_->closed = true; }
    state_->changed.notify_all();
  }
  void OnLoadingStateChange(CefRefPtr<CefBrowser>, bool loading, bool can_go_back, bool can_go_forward) override {
    EmitEvent(state_, 3, L"加载状态改变", L"{\"loading\":" + std::wstring(loading ? L"true" : L"false")
      + L",\"canGoBack\":" + (can_go_back ? L"true" : L"false")
      + L",\"canGoForward\":" + (can_go_forward ? L"true" : L"false") + L"}");
  }
  void OnLoadStart(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, TransitionType) override {
    const std::wstring url = frame ? frame->GetURL().ToWString() : L"";
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->url = url; }
    EmitEvent(state_, 4, L"开始加载", L"{\"url\":\"" + JsonEscape(url) + L"\"}");
  }
  void OnLoadEnd(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int status_code) override {
    const std::wstring url = frame ? frame->GetURL().ToWString() : L"";
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->url = url; }
    EmitEvent(state_, 5, L"加载完成", L"{\"url\":\"" + JsonEscape(url) + L"\",\"statusCode\":" + std::to_wstring(status_code) + L"}");
  }
  void OnLoadError(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, ErrorCode error_code,
                   const CefString& error_text, const CefString& failed_url) override {
    EmitEvent(state_, 6, L"加载失败", L"{\"url\":\"" + JsonEscape(failed_url.ToWString())
      + L"\",\"errorCode\":" + std::to_wstring(error_code) + L",\"error\":\""
      + JsonEscape(error_text.ToWString()) + L"\"}");
  }
  void OnAddressChange(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, const CefString& url) override {
    if (frame && !frame->IsMain()) return;
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->url = url.ToWString(); }
    EmitEvent(state_, 7, L"地址被改变", L"{\"url\":\"" + JsonEscape(url.ToWString()) + L"\"}");
  }
  void OnTitleChange(CefRefPtr<CefBrowser>, const CefString& title) override {
    { std::lock_guard<std::mutex> lock(state_->mutex); state_->title = title.ToWString(); }
    EmitEvent(state_, 8, L"标题被改变", L"{\"title\":\"" + JsonEscape(title.ToWString()) + L"\"}");
  }
  void OnFaviconURLChange(CefRefPtr<CefBrowser>, const std::vector<CefString>& icon_urls) override {
    std::wstring json = L"{\"count\":" + std::to_wstring(icon_urls.size()) + L",\"urls\":[";
    for (size_t index = 0; index < icon_urls.size(); ++index) {
      if (index > 0) json += L",";
      json += L"\"" + JsonEscape(icon_urls[index].ToWString()) + L"\"";
    }
    EmitEvent(state_, 9, L"网页图标地址改变", json + L"]}");
  }
  void OnFullscreenModeChange(CefRefPtr<CefBrowser>, bool fullscreen) override {
    EmitEvent(state_, 10, L"全屏状态改变", L"{\"fullscreen\":" + std::wstring(fullscreen ? L"true" : L"false") + L"}");
  }
  bool OnTooltip(CefRefPtr<CefBrowser>, CefString& text) override {
    auto response = EmitEvent(state_, 11, L"工具提示显示", L"{\"text\":\"" + JsonEscape(text.ToWString()) + L"\"}", true);
    if (response.response_json) text = response.response_json;
    return response.action == 3;
  }
  void OnStatusMessage(CefRefPtr<CefBrowser>, const CefString& value) override {
    EmitEvent(state_, 12, L"状态消息改变", L"{\"text\":\"" + JsonEscape(value.ToWString()) + L"\"}");
  }
  bool OnConsoleMessage(CefRefPtr<CefBrowser>, cef_log_severity_t level, const CefString& message,
                        const CefString& source, int line) override {
    auto response = EmitEvent(state_, 13, L"控制台消息", L"{\"level\":" + std::to_wstring(level)
      + L",\"message\":\"" + JsonEscape(message.ToWString()) + L"\",\"source\":\""
      + JsonEscape(source.ToWString()) + L"\",\"line\":" + std::to_wstring(line) + L"}", true);
    return response.action == 3;
  }
  bool OnAutoResize(CefRefPtr<CefBrowser>, const CefSize& size) override {
    auto response = EmitEvent(state_, 14, L"自动调整大小", L"{\"width\":" + std::to_wstring(size.width)
      + L",\"height\":" + std::to_wstring(size.height) + L"}", true);
    return response.action == 3;
  }
  void OnLoadingProgressChange(CefRefPtr<CefBrowser>, double progress) override {
    std::wostringstream json;
    json << L"{\"progress\":" << std::setprecision(17) << progress << L"}";
    EmitEvent(state_, 15, L"加载进度改变", json.str());
  }
  bool OnCursorChange(CefRefPtr<CefBrowser>, CefCursorHandle, cef_cursor_type_t type,
                      const CefCursorInfo&) override {
    auto response = EmitEvent(state_, 16, L"鼠标指针改变", L"{\"type\":" + std::to_wstring(type) + L"}", true);
    return response.action == 3;
  }
  void OnMediaAccessChange(CefRefPtr<CefBrowser>, bool video, bool audio) override {
    EmitEvent(state_, 17, L"媒体访问状态改变", L"{\"video\":" + std::wstring(video ? L"true" : L"false")
      + L",\"audio\":" + (audio ? L"true" : L"false") + L"}");
  }
#if CEF_API_ADDED(13700)
  bool OnContentsBoundsChange(CefRefPtr<CefBrowser>, const CefRect& rect) override {
    auto response = EmitEvent(state_, 18, L"内容边界改变", L"{\"x\":" + std::to_wstring(rect.x)
      + L",\"y\":" + std::to_wstring(rect.y) + L",\"width\":" + std::to_wstring(rect.width)
      + L",\"height\":" + std::to_wstring(rect.height) + L"}", true);
    return response.action == 3;
  }
  bool GetRootWindowScreenRect(CefRefPtr<CefBrowser>, CefRect& rect) override {
    auto response = EmitEvent(state_, 19, L"根窗口屏幕区域查询", L"{\"x\":" + std::to_wstring(rect.x)
      + L",\"y\":" + std::to_wstring(rect.y) + L",\"width\":" + std::to_wstring(rect.width)
      + L",\"height\":" + std::to_wstring(rect.height) + L"}", true);
    int x = 0, y = 0, width = 0, height = 0;
    if ((response.action == 1 || response.action == 3) && response.response_json
        && swscanf_s(response.response_json, L"%d,%d,%d,%d", &x, &y, &width, &height) == 4) {
      rect = CefRect(x, y, width, height);
      return true;
    }
    return false;
  }
#endif
  void OnTakeFocus(CefRefPtr<CefBrowser>, bool next) override {
    EmitEvent(state_, 20, L"焦点即将移出", L"{\"next\":" + std::wstring(next ? L"true" : L"false") + L"}");
  }
  bool OnSetFocus(CefRefPtr<CefBrowser>, FocusSource source) override {
    return EmitEvent(state_, 21, L"浏览器请求焦点", L"{\"source\":" + std::to_wstring(source) + L"}", true).action == 2;
  }
  void OnGotFocus(CefRefPtr<CefBrowser>) override {
    EmitEvent(state_, 22, L"浏览器获得焦点", L"{}");
  }
  bool OnPreKeyEvent(CefRefPtr<CefBrowser>, const CefKeyEvent& event, CefEventHandle,
                     bool* is_keyboard_shortcut) override {
    auto response = EmitEvent(state_, 23, L"键盘事件预处理", L"{\"type\":" + std::to_wstring(event.type)
      + L",\"modifiers\":" + std::to_wstring(event.modifiers)
      + L",\"windowsKeyCode\":" + std::to_wstring(event.windows_key_code)
      + L",\"nativeKeyCode\":" + std::to_wstring(event.native_key_code)
      + L",\"systemKey\":" + std::wstring(event.is_system_key ? L"true" : L"false") + L"}", true);
    if (is_keyboard_shortcut && response.action == 1) *is_keyboard_shortcut = true;
    return response.action == 3;
  }
  bool OnKeyEvent(CefRefPtr<CefBrowser>, const CefKeyEvent& event, CefEventHandle) override {
    auto response = EmitEvent(state_, 24, L"键盘事件", L"{\"type\":" + std::to_wstring(event.type)
      + L",\"modifiers\":" + std::to_wstring(event.modifiers)
      + L",\"windowsKeyCode\":" + std::to_wstring(event.windows_key_code)
      + L",\"nativeKeyCode\":" + std::to_wstring(event.native_key_code)
      + L",\"systemKey\":" + std::wstring(event.is_system_key ? L"true" : L"false") + L"}", true);
    return response.action == 3;
  }
 private:
  std::shared_ptr<BrowserState> state_;
  IMPLEMENT_REFCOUNTING(BridgeClient);
};

void CompleteTask(const std::shared_ptr<TaskState>& state, bool success, std::wstring value) {
  if (!state) return;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->status.load() == LB_CEF3_TASK_CANCELLED) return;
    if (success) state->result = std::move(value); else state->error = std::move(value);
    state->status.store(success ? LB_CEF3_TASK_SUCCEEDED : LB_CEF3_TASK_FAILED);
    state->registration = nullptr;
  }
  state->changed.notify_all();
}

class BridgeCompletionCallback final : public CefCompletionCallback {
 public:
  BridgeCompletionCallback(std::shared_ptr<TaskState> state, std::wstring result)
      : state_(std::move(state)), result_(std::move(result)) {}
  void OnComplete() override { CompleteTask(state_, true, result_); }
 private:
  std::shared_ptr<TaskState> state_;
  std::wstring result_;
  IMPLEMENT_REFCOUNTING(BridgeCompletionCallback);
};

class BridgeSetCookieCallback final : public CefSetCookieCallback {
 public:
  explicit BridgeSetCookieCallback(std::shared_ptr<TaskState> state) : state_(std::move(state)) {}
  void OnComplete(bool success) override {
    CompleteTask(state_, success, success ? L"{\"success\":true}" : L"设置Cookie失败");
  }
 private:
  std::shared_ptr<TaskState> state_;
  IMPLEMENT_REFCOUNTING(BridgeSetCookieCallback);
};

class BridgeDeleteCookiesCallback final : public CefDeleteCookiesCallback {
 public:
  explicit BridgeDeleteCookiesCallback(std::shared_ptr<TaskState> state) : state_(std::move(state)) {}
  void OnComplete(int num_deleted) override {
    CompleteTask(state_, true, L"{\"deleted\":" + std::to_wstring(num_deleted) + L"}");
  }
 private:
  std::shared_ptr<TaskState> state_;
  IMPLEMENT_REFCOUNTING(BridgeDeleteCookiesCallback);
};

double BaseTimeSeconds(const cef_basetime_t value) {
  CefTime converted;
  return cef_time_from_basetime(value, &converted) ? converted.GetDoubleT() : 0.0;
}

class BridgeCookieVisitor final : public CefCookieVisitor {
 public:
  explicit BridgeCookieVisitor(std::shared_ptr<TaskState> state) : state_(std::move(state)) {}
  ~BridgeCookieVisitor() override { if (started_.load()) Finish(); }

  void MarkStarted() { started_.store(true); }

  bool Visit(const CefCookie& cookie, int count, int total, bool& delete_cookie) override {
    started_.store(true);
    delete_cookie = false;
    const auto name = CefString(&cookie.name).ToWString();
    const auto value = CefString(&cookie.value).ToWString();
    const auto domain = CefString(&cookie.domain).ToWString();
    const auto path = CefString(&cookie.path).ToWString();
    std::wostringstream item;
    item << L"{\"name\":\"" << JsonEscape(name)
         << L"\",\"value\":\"" << JsonEscape(value)
         << L"\",\"domain\":\"" << JsonEscape(domain)
         << L"\",\"path\":\"" << JsonEscape(path)
         << L"\",\"secure\":" << (cookie.secure ? L"true" : L"false")
         << L",\"httpOnly\":" << (cookie.httponly ? L"true" : L"false")
         << L",\"hasExpires\":" << (cookie.has_expires ? L"true" : L"false")
         << L",\"expires\":" << std::fixed << std::setprecision(0)
         << (cookie.has_expires ? BaseTimeSeconds(cookie.expires) : 0.0)
         << L",\"sameSite\":" << static_cast<int>(cookie.same_site)
         << L",\"priority\":" << static_cast<int>(cookie.priority) << L"}";
    items_.push_back(item.str());
    if (count + 1 >= total) Finish();
    return true;
  }

 private:
  void Finish() {
    if (finished_.exchange(true)) return;
    std::wstring json = L"[";
    for (size_t index = 0; index < items_.size(); ++index) {
      if (index > 0) json += L",";
      json += items_[index];
    }
    json += L"]";
    CompleteTask(state_, true, std::move(json));
  }

  std::shared_ptr<TaskState> state_;
  std::vector<std::wstring> items_;
  std::atomic<bool> started_{false};
  std::atomic<bool> finished_{false};
  IMPLEMENT_REFCOUNTING(BridgeCookieVisitor);
};

class BridgeNavigationEntryVisitor final : public CefNavigationEntryVisitor {
 public:
  explicit BridgeNavigationEntryVisitor(std::shared_ptr<TaskState> state) : state_(std::move(state)) {}
  ~BridgeNavigationEntryVisitor() override { Finish(); }

  bool Visit(CefRefPtr<CefNavigationEntry> entry, bool current, int index, int total) override {
    if (entry) {
      const auto completion = entry->GetCompletionTime();
      const double completion_seconds = completion.val == 0
        ? 0.0 : static_cast<double>(completion.val) / 1000000.0 - 11644473600.0;
      std::wostringstream item;
      item << L"{\"current\":" << (current ? L"true" : L"false")
           << L",\"index\":" << index << L",\"total\":" << total
           << L",\"valid\":" << (entry->IsValid() ? L"true" : L"false")
           << L",\"url\":\"" << JsonEscape(entry->GetURL().ToWString())
           << L"\",\"displayUrl\":\"" << JsonEscape(entry->GetDisplayURL().ToWString())
           << L"\",\"originalUrl\":\"" << JsonEscape(entry->GetOriginalURL().ToWString())
           << L"\",\"title\":\"" << JsonEscape(entry->GetTitle().ToWString())
           << L"\",\"transitionType\":" << static_cast<int>(entry->GetTransitionType())
           << L",\"hasPostData\":" << (entry->HasPostData() ? L"true" : L"false")
           << L",\"completionTime\":" << std::fixed << std::setprecision(6) << completion_seconds
           << L",\"httpStatusCode\":" << entry->GetHttpStatusCode() << L"}";
      items_.push_back(item.str());
    }
    if (index + 1 >= total) Finish();
    return true;
  }

 private:
  void Finish() {
    if (finished_.exchange(true)) return;
    std::wstring json = L"[";
    for (size_t index = 0; index < items_.size(); ++index) {
      if (index) json += L",";
      json += items_[index];
    }
    json += L"]";
    CompleteTask(state_, true, std::move(json));
  }
  std::shared_ptr<TaskState> state_;
  std::vector<std::wstring> items_;
  std::atomic<bool> finished_{false};
  IMPLEMENT_REFCOUNTING(BridgeNavigationEntryVisitor);
};

std::wstring Utf8ToWide(const void* data, size_t size) {
  if (!data || size == 0 || size > static_cast<size_t>(INT_MAX)) return L"";
  int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, static_cast<const char*>(data),
                                  static_cast<int>(size), nullptr, 0);
  if (count <= 0) return L"";
  std::wstring result(static_cast<size_t>(count), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, static_cast<const char*>(data),
                      static_cast<int>(size), result.data(), count);
  return result;
}

class BridgeEvalObserver final : public CefDevToolsMessageObserver {
 public:
  explicit BridgeEvalObserver(std::shared_ptr<TaskState> state) : state_(std::move(state)) {}
  void OnDevToolsMethodResult(CefRefPtr<CefBrowser>, int message_id, bool success,
                              const void* result, size_t result_size) override {
    if (state_->message_id != 0 && state_->message_id != message_id) return;
    CompleteTask(state_, success, Utf8ToWide(result, result_size));
  }
 private:
  std::shared_ptr<TaskState> state_;
  IMPLEMENT_REFCOUNTING(BridgeEvalObserver);
};

std::wstring NormalizeProfileKey(const wchar_t* value, uint64_t user_token) {
  std::wstring key = value && *value ? value : std::to_wstring(user_token);
  const size_t digest = std::hash<std::wstring>{}(key);
  return L"profile-" + std::to_wstring(user_token) + L"-" + std::to_wstring(static_cast<unsigned long long>(digest));
}

LB_CEF3_HANDLE CreateBrowserHandle(const LB_CEF3_BROWSER_CONFIG_V3* config, bool chrome_runtime) {
  if (!g_cef_initialized.load()) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3尚未初始化"); return 0; }
  if (!config || config->struct_size < sizeof(LB_CEF3_BROWSER_CONFIG_V3)
      || config->abi_version != LB_CEF3_ABI_VERSION_V3) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"浏览器配置版本无效"); return 0;
  }
  if (!chrome_runtime && config->parent_window == 0) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"内嵌浏览器必须提供独立宿主HWND"); return 0;
  }
  auto state = std::make_shared<BrowserState>();
  state->user_token = config->user_token;
  state->parent = reinterpret_cast<HWND>(static_cast<uintptr_t>(config->parent_window));
  state->flags = config->flags;
  state->event_callback = config->event_callback;
  state->event_user_data = config->event_user_data;
  state->url = config->initial_url && *config->initial_url ? config->initial_url : L"about:blank";
  state->profile_path = (g_cef_root_cache / NormalizeProfileKey(config->profile_key, config->user_token)).wstring();
  state->proxy_server = config->proxy_server ? config->proxy_server : L"";
  std::error_code directory_error;
  std::filesystem::create_directories(state->profile_path, directory_error);
  if (directory_error) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"无法创建CEF3独立缓存目录"); return 0; }

  CefRequestContextSettings context_settings{};
  context_settings.size = sizeof(context_settings);
  CefString(&context_settings.cache_path).FromWString(state->profile_path);
  std::wstring proxy_mode = config->proxy_mode ? config->proxy_mode : L"system";
  if (proxy_mode == L"none") proxy_mode = L"direct";
  if (proxy_mode == L"custom") proxy_mode = L"fixed_servers";
  CefRefPtr<CefRequestContextHandler> context_handler = new BridgeRequestContextHandler(
    proxy_mode, config->proxy_server ? config->proxy_server : L"");
  state->request_context = CefRequestContext::CreateContext(context_settings, context_handler);
  if (!state->request_context) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"无法创建独立RequestContext"); return 0; }

  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_BROWSER;
  entry.object = state;
  state->handle = Register(std::move(entry));
  CefRefPtr<BridgeClient> client = new BridgeClient(state);
  state->client = client;

  const std::wstring initial_url = state->url;
  const bool posted = PostToCefUi([state, client, initial_url, chrome_runtime]() {
    CefWindowInfo window_info{};
    if (chrome_runtime) {
      window_info.SetAsPopup(nullptr, L"谷歌原生UI浏览器");
      window_info.parent_window = nullptr;
      window_info.ex_style |= WS_EX_APPWINDOW;
      window_info.style &= ~WS_CHILD;
      window_info.runtime_style = CEF_RUNTIME_STYLE_CHROME;
    } else {
      RECT bounds{};
      GetClientRect(state->parent, &bounds);
      window_info.SetAsChild(state->parent, CefRect(0, 0, bounds.right - bounds.left, bounds.bottom - bounds.top));
    }
    CefBrowserSettings browser_settings{};
    browser_settings.size = sizeof(browser_settings);
    if ((state->flags & LB_CEF3_BROWSER_JAVASCRIPT) == 0) browser_settings.javascript = STATE_DISABLED;
    if ((state->flags & LB_CEF3_BROWSER_IMAGES) == 0) browser_settings.image_loading = STATE_DISABLED;
    if ((state->flags & LB_CEF3_BROWSER_WEBGL) == 0) browser_settings.webgl = STATE_DISABLED;
    if (!CefBrowserHost::CreateBrowser(window_info, client, initial_url, browser_settings, nullptr, state->request_context)) {
      Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3创建浏览器请求失败");
    }
  });
  if (!posted) { LB_CEF3_HandleRelease(state->handle); Fail(LB_CEF3_ERROR_WRONG_THREAD, L"无法投递CEF UI线程"); return 0; }
  return state->handle;
}

std::shared_ptr<BrowserState> GetBrowserState(LB_CEF3_HANDLE handle, int& status) {
  return GetObject<BrowserState>(handle, LB_CEF3_HANDLE_BROWSER, status);
}

CefRefPtr<CefBrowser> SnapshotBrowser(const std::shared_ptr<BrowserState>& state) {
  if (!state) return nullptr;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->browser;
}

int PostBrowserAction(LB_CEF3_HANDLE handle, std::function<void(CefRefPtr<CefBrowser>, const std::shared_ptr<BrowserState>&)> action) {
  int status = 0;
  auto state = GetBrowserState(handle, status);
  if (!state) return status;
  auto browser = SnapshotBrowser(state);
  if (!browser) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3浏览器尚未创建完成或已经关闭");
  return PostToCefUi([state, browser, action = std::move(action)]() { action(browser, state); })
    ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_WRONG_THREAD, L"无法投递CEF UI线程");
}

std::pair<LB_CEF3_TASK_HANDLE, std::shared_ptr<TaskState>> CreateRunningTask() {
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_TASK;
  entry.task = std::make_shared<TaskState>();
  entry.task->status.store(LB_CEF3_TASK_RUNNING);
  auto state = entry.task;
  return {Register(std::move(entry)), std::move(state)};
}

CefRefPtr<CefCookieManager> GetContextCookieManager(const std::shared_ptr<RequestContextState>& state) {
  return state && state->context ? state->context->GetCookieManager(nullptr) : nullptr;
}

}  // namespace

uint32_t LB_CEF3_CALL LB_CEF3_GetAbiVersion(void) { return LB_CEF3_ABI_VERSION_V3; }

int LB_CEF3_CALL LB_CEF3_GetCefVersion(wchar_t* result, size_t capacity, size_t* required) {
  return CopyWide(LB_CEF3_WIDEN(CEF_VERSION), result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_GetLastError(wchar_t* result, size_t capacity, size_t* required) {
  return CopyWide(g_last_error, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_ExecuteSubProcess(uint64_t application_instance) {
  CefMainArgs args(reinterpret_cast<HINSTANCE>(static_cast<uintptr_t>(application_instance)));
  return CefExecuteProcess(args, nullptr, nullptr);
}

int LB_CEF3_CALL LB_CEF3_Initialize(const LB_CEF3_INITIALIZE_CONFIG_V3* config) {
  if (g_cef_initialized.load()) return LB_CEF3_OK;
  if (!config || config->struct_size < sizeof(LB_CEF3_INITIALIZE_CONFIG_V3)
      || config->abi_version != LB_CEF3_ABI_VERSION_V3 || !config->root_cache_path
      || !config->resources_path || !config->subprocess_path) {
    return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"CEF3初始化配置无效");
  }
  std::error_code error;
  g_cef_root_cache = std::filesystem::weakly_canonical(config->root_cache_path, error);
  if (error) {
    error.clear();
    g_cef_root_cache = std::filesystem::absolute(config->root_cache_path, error);
  }
  if (error || !std::filesystem::create_directories(g_cef_root_cache, error) && error) {
    return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"CEF3根缓存目录不可用");
  }
  g_event_callback = config->event_callback;
  g_event_user_data = config->event_user_data;
  CefSettings settings{};
  settings.size = sizeof(settings);
  settings.no_sandbox = true;
  settings.multi_threaded_message_loop = true;
  settings.windowless_rendering_enabled = false;
  CefString(&settings.root_cache_path).FromWString(g_cef_root_cache.wstring());
  CefString(&settings.resources_dir_path).FromWString(config->resources_path);
  CefString(&settings.locales_dir_path).FromWString(config->locales_path ? config->locales_path : L"");
  CefString(&settings.browser_subprocess_path).FromWString(config->subprocess_path);
  if (config->user_agent && *config->user_agent) CefString(&settings.user_agent).FromWString(config->user_agent);
  CefMainArgs args(reinterpret_cast<HINSTANCE>(static_cast<uintptr_t>(config->application_instance)));
  if (!CefInitialize(args, settings, nullptr, nullptr)) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3初始化失败");
  g_cef_initialized.store(true);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_IsInitialized(void) { return g_cef_initialized.load() ? 1 : 0; }

int LB_CEF3_CALL LB_CEF3_Shutdown(void) {
  if (!g_cef_initialized.exchange(false)) return LB_CEF3_OK;
  std::vector<std::shared_ptr<BrowserState>> browsers;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    for (const auto& item : g_handles) {
      if (item.second.type == LB_CEF3_HANDLE_BROWSER && item.second.object) {
        browsers.push_back(std::static_pointer_cast<BrowserState>(item.second.object));
      }
    }
  }
  for (const auto& state : browsers) {
    auto browser = SnapshotBrowser(state);
    if (browser && browser->GetHost()) browser->GetHost()->CloseBrowser(true);
  }
  for (const auto& state : browsers) {
    std::unique_lock<std::mutex> lock(state->mutex);
    if (state->browser) state->changed.wait_for(lock, std::chrono::seconds(5), [&] { return state->closed || !state->browser; });
  }
  std::unordered_map<LB_CEF3_HANDLE, HandleEntry> released_handles;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    released_handles.swap(g_handles);
  }
  released_handles.clear();
  browsers.clear();
  CefShutdown();
  g_event_callback = nullptr;
  g_event_user_data = nullptr;
  return LB_CEF3_OK;
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreate(const LB_CEF3_BROWSER_CONFIG_V3* config) {
  return CreateBrowserHandle(config, false);
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateChrome(const LB_CEF3_BROWSER_CONFIG_V3* config) {
  return CreateBrowserHandle(config, true);
}

int LB_CEF3_CALL LB_CEF3_BrowserClose(LB_CEF3_HANDLE browser, int force_close) {
  return PostBrowserAction(browser, [force_close](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) {
    if (value->GetHost()) value->GetHost()->CloseBrowser(force_close != 0);
  });
}

int LB_CEF3_CALL LB_CEF3_BrowserResize(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>& state) {
    HWND browser_window = value->GetHost() ? value->GetHost()->GetWindowHandle() : nullptr;
    if (!state->parent || !browser_window) return;
    RECT bounds{};
    GetClientRect(state->parent, &bounds);
    SetWindowPos(browser_window, nullptr, 0, 0, bounds.right - bounds.left, bounds.bottom - bounds.top,
                 SWP_NOZORDER | SWP_NOACTIVATE);
  });
}

int LB_CEF3_CALL LB_CEF3_BrowserLoadUrl(LB_CEF3_HANDLE browser, const wchar_t* url) {
  if (!url || !*url) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"导航地址不能为空");
  const std::wstring target = url;
  return PostBrowserAction(browser, [target](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>& state) {
    value->GetMainFrame()->LoadURL(target);
    std::lock_guard<std::mutex> lock(state->mutex);
    state->url = target;
  });
}

int LB_CEF3_CALL LB_CEF3_BrowserGoBack(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { if (value->CanGoBack()) value->GoBack(); });
}
int LB_CEF3_CALL LB_CEF3_BrowserGoForward(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { if (value->CanGoForward()) value->GoForward(); });
}
int LB_CEF3_CALL LB_CEF3_BrowserReload(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { value->Reload(); });
}
int LB_CEF3_CALL LB_CEF3_BrowserStopLoad(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { value->StopLoad(); });
}

int LB_CEF3_CALL LB_CEF3_BrowserCanGoBack(LB_CEF3_HANDLE browser) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  auto value = SnapshotBrowser(state); return value && value->CanGoBack() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_BrowserCanGoForward(LB_CEF3_HANDLE browser) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  auto value = SnapshotBrowser(state); return value && value->CanGoForward() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_BrowserIsLoading(LB_CEF3_HANDLE browser) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  auto value = SnapshotBrowser(state); return value && value->IsLoading() ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_BrowserGetTitle(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return CopyWide(state->title, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_BrowserGetUrl(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return CopyWide(state->url, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_BrowserGetProfilePath(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return CopyWide(state->profile_path, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_BrowserGetProxy(LB_CEF3_HANDLE browser, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return CopyWide(state->proxy_server, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_BrowserSetAudioMuted(LB_CEF3_HANDLE browser, int muted) {
  return PostBrowserAction(browser, [muted](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) {
    value->GetHost()->SetAudioMuted(muted != 0);
  });
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserEvaluateJavaScript(LB_CEF3_HANDLE browser, const wchar_t* script) {
  if (!script) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"JavaScript不能为空"); return 0; }
  int status = 0;
  auto browser_state = GetBrowserState(browser, status);
  if (!browser_state) return 0;
  auto browser_ref = SnapshotBrowser(browser_state);
  if (!browser_ref) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF3浏览器尚未创建完成"); return 0; }
  const auto task_handle = LB_CEF3_TaskCreate();
  auto task_state = GetTask(task_handle, status);
  task_state->status.store(LB_CEF3_TASK_RUNNING);
  const std::wstring expression = script;
  if (!PostToCefUi([browser_ref, task_state, expression]() {
      CefRefPtr<BridgeEvalObserver> observer = new BridgeEvalObserver(task_state);
      task_state->registration = browser_ref->GetHost()->AddDevToolsMessageObserver(observer);
      CefRefPtr<CefDictionaryValue> parameters = CefDictionaryValue::Create();
      parameters->SetString(L"expression", expression);
      parameters->SetBool(L"returnByValue", true);
      parameters->SetBool(L"awaitPromise", true);
      task_state->message_id = browser_ref->GetHost()->ExecuteDevToolsMethod(0, L"Runtime.evaluate", parameters);
      if (task_state->message_id <= 0 || !task_state->registration) CompleteTask(task_state, false, L"提交Runtime.evaluate失败");
    })) {
    CompleteTask(task_state, false, L"无法投递CEF UI线程");
  }
  return task_handle;
}

int LB_CEF3_CALL LB_CEF3_BrowserStartDownload(LB_CEF3_HANDLE browser, const wchar_t* url) {
  if (!url || !*url) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"下载地址不能为空");
  const std::wstring target = url;
  return PostBrowserAction(browser, [target](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { value->GetHost()->StartDownload(target); });
}
int LB_CEF3_CALL LB_CEF3_BrowserPrint(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { value->GetHost()->Print(); });
}
int LB_CEF3_CALL LB_CEF3_BrowserShowDevTools(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>& state) {
    if ((state->flags & LB_CEF3_BROWSER_DEVTOOLS) == 0) return;
    CefWindowInfo info{}; info.SetAsPopup(nullptr, L"CEF3开发者工具");
    CefBrowserSettings settings{}; settings.size = sizeof(settings);
    value->GetHost()->ShowDevTools(info, state->client, settings, CefPoint());
  });
}
int LB_CEF3_CALL LB_CEF3_BrowserCloseDevTools(LB_CEF3_HANDLE browser) {
  return PostBrowserAction(browser, [](CefRefPtr<CefBrowser> value, const std::shared_ptr<BrowserState>&) { value->GetHost()->CloseDevTools(); });
}
int LB_CEF3_CALL LB_CEF3_BrowserHasDevTools(LB_CEF3_HANDLE browser) {
  int status = 0; auto state = GetBrowserState(browser, status); if (!state) return status;
  auto value = SnapshotBrowser(state); return value && value->GetHost()->HasDevTools() ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_SetAllowedFileRoot(const wchar_t* root_directory) {
  if (!root_directory || !*root_directory) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"允许根目录不能为空");
  std::error_code error;
  auto root = std::filesystem::weakly_canonical(std::filesystem::path(root_directory), error);
  if (error || !std::filesystem::is_directory(root, error)) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"允许根目录不存在");
  std::lock_guard<std::mutex> lock(g_mutex);
  g_allowed_root = std::move(root);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_HandleGetType(LB_CEF3_HANDLE handle) {
  HandleEntry entry;
  int status = 0;
  return GetEntry(handle, LB_CEF3_HANDLE_UNKNOWN, entry, status) ? entry.type : status;
}

int LB_CEF3_CALL LB_CEF3_HandleIsValid(LB_CEF3_HANDLE handle, int expected_type) {
  HandleEntry entry;
  int status = 0;
  return GetEntry(handle, expected_type, entry, status) ? LB_CEF3_OK : status;
}

int LB_CEF3_CALL LB_CEF3_HandleRetain(LB_CEF3_HANDLE handle) {
  std::lock_guard<std::mutex> lock(g_mutex);
  const auto found = g_handles.find(handle);
  if (found == g_handles.end()) return Fail(LB_CEF3_ERROR_RELEASED_HANDLE, L"句柄不存在或已经释放");
  ++found->second.references;
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_HandleRelease(LB_CEF3_HANDLE handle) {
  HandleEntry released;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    const auto found = g_handles.find(handle);
    if (found == g_handles.end()) return Fail(LB_CEF3_ERROR_RELEASED_HANDLE, L"句柄已经释放");
    if (--found->second.references != 0) return LB_CEF3_OK;
    released = std::move(found->second);
    g_handles.erase(found);
  }
  return LB_CEF3_OK;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_TaskCreate(void) {
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_TASK;
  entry.task = std::make_shared<TaskState>();
  return Register(std::move(entry));
}

int LB_CEF3_CALL LB_CEF3_TaskSetRunning(LB_CEF3_TASK_HANDLE task) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  int expected = LB_CEF3_TASK_PENDING;
  return state->status.compare_exchange_strong(expected, LB_CEF3_TASK_RUNNING)
    ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"任务状态不允许进入运行态");
}

int LB_CEF3_CALL LB_CEF3_TaskSetResult(LB_CEF3_TASK_HANDLE task, const wchar_t* result_json) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  const int current = state->status.load();
  if (current == LB_CEF3_TASK_CANCELLED) return Fail(LB_CEF3_ERROR_CANCELLED, L"任务已取消");
  if (current == LB_CEF3_TASK_SUCCEEDED || current == LB_CEF3_TASK_FAILED) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"任务已结束");
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    state->result = result_json ? result_json : L"null";
    state->error.clear();
  }
  state->status.store(LB_CEF3_TASK_SUCCEEDED);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_TaskSetError(LB_CEF3_TASK_HANDLE task, const wchar_t* error_text) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  const int current = state->status.load();
  if (current == LB_CEF3_TASK_CANCELLED) return Fail(LB_CEF3_ERROR_CANCELLED, L"任务已取消");
  if (current == LB_CEF3_TASK_SUCCEEDED || current == LB_CEF3_TASK_FAILED) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"任务已结束");
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    state->result.clear();
    state->error = error_text ? error_text : L"CEF3异步任务失败";
  }
  state->status.store(LB_CEF3_TASK_FAILED);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_TaskGetStatus(LB_CEF3_TASK_HANDLE task) {
  int status = 0;
  auto state = GetTask(task, status);
  return state ? state->status.load() : status;
}

int LB_CEF3_CALL LB_CEF3_TaskGetResult(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  if (state->status.load() != LB_CEF3_TASK_SUCCEEDED) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"任务尚未成功完成");
  std::lock_guard<std::mutex> lock(state->mutex);
  return CopyWide(state->result, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_TaskGetError(LB_CEF3_TASK_HANDLE task, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return CopyWide(state->error, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_TaskCancel(LB_CEF3_TASK_HANDLE task) {
  int status = 0;
  auto state = GetTask(task, status);
  if (!state) return status;
  const int current = state->status.load();
  if (current == LB_CEF3_TASK_SUCCEEDED || current == LB_CEF3_TASK_FAILED) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"已完成任务不能取消");
  state->status.store(LB_CEF3_TASK_CANCELLED);
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_TaskRelease(LB_CEF3_TASK_HANDLE task) { return LB_CEF3_HandleRelease(task); }

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferCreate(const void* data, size_t size) {
  if (size > 0 && !data) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"非空缓冲必须提供数据地址");
    return 0;
  }
  auto buffer = std::make_shared<BufferState>();
  if (size > 0) {
    const auto* bytes = static_cast<const unsigned char*>(data);
    buffer->bytes.assign(bytes, bytes + size);
  }
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_BUFFER;
  entry.buffer = std::move(buffer);
  return Register(std::move(entry));
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferClone(LB_CEF3_BUFFER_HANDLE buffer) {
  int status = 0; auto state = GetBuffer(buffer, status); if (!state) return 0;
  return LB_CEF3_BufferCreate(state->bytes.data(), state->bytes.size());
}
int LB_CEF3_CALL LB_CEF3_BufferIsValid(LB_CEF3_BUFFER_HANDLE buffer) {
  int status = 0; return GetBuffer(buffer, status) ? 1 : status;
}
int LB_CEF3_CALL LB_CEF3_BufferIsOwned(LB_CEF3_BUFFER_HANDLE buffer) {
  int status = 0; return GetBuffer(buffer, status) ? 0 : status;
}
int LB_CEF3_CALL LB_CEF3_BufferIsSame(LB_CEF3_BUFFER_HANDLE buffer, LB_CEF3_BUFFER_HANDLE other) {
  int left_status = 0; if (!GetBuffer(buffer, left_status)) return left_status;
  int right_status = 0; if (!GetBuffer(other, right_status)) return right_status;
  return buffer == other ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_BufferIsEqual(LB_CEF3_BUFFER_HANDLE buffer, LB_CEF3_BUFFER_HANDLE other) {
  int left_status = 0; auto left = GetBuffer(buffer, left_status); if (!left) return left_status;
  int right_status = 0; auto right = GetBuffer(other, right_status); if (!right) return right_status;
  return left->bytes == right->bytes ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_BufferGetSize(LB_CEF3_BUFFER_HANDLE buffer, uint64_t* size) {
  if (!size) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"size不能为空");
  int status = 0;
  auto state = GetBuffer(buffer, status);
  if (!state) return status;
  *size = static_cast<uint64_t>(state->bytes.size());
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_BufferCopy(LB_CEF3_BUFFER_HANDLE buffer, void* data, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetBuffer(buffer, status);
  if (!state) return status;
  if (required) *required = state->bytes.size();
  if (capacity < state->bytes.size() || (!data && !state->bytes.empty())) return Fail(LB_CEF3_ERROR_BUFFER_TOO_SMALL, L"输出缓冲区不足");
  if (!state->bytes.empty()) std::copy(state->bytes.begin(), state->bytes.end(), static_cast<unsigned char*>(data));
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_BufferToHex(LB_CEF3_BUFFER_HANDLE buffer, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetBuffer(buffer, status);
  if (!state) return status;
  std::wostringstream text;
  text << std::hex << std::setfill(L'0');
  for (const auto byte : state->bytes) text << std::setw(2) << static_cast<unsigned int>(byte);
  return CopyWide(text.str(), result, capacity, required);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_BufferLoadFile(const wchar_t* path) {
  std::filesystem::path resolved;
  if (!IsPathAllowed(path, resolved)) return 0;
  std::ifstream stream(resolved, std::ios::binary);
  if (!stream) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"无法打开缓冲文件");
    return 0;
  }
  std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
  return LB_CEF3_BufferCreate(bytes.data(), bytes.size());
}

int LB_CEF3_CALL LB_CEF3_BufferSaveFile(LB_CEF3_BUFFER_HANDLE buffer, const wchar_t* path) {
  int status = 0;
  auto state = GetBuffer(buffer, status);
  if (!state) return status;
  std::filesystem::path resolved;
  if (!IsPathAllowed(path, resolved)) return LB_CEF3_ERROR_PATH_DENIED;
  std::error_code error;
  std::filesystem::create_directories(resolved.parent_path(), error);
  if (error) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"无法创建缓冲文件目录");
  std::ofstream stream(resolved, std::ios::binary | std::ios::trunc);
  if (!stream) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"无法写入缓冲文件");
  if (!state->bytes.empty()) stream.write(reinterpret_cast<const char*>(state->bytes.data()), static_cast<std::streamsize>(state->bytes.size()));
  return stream.good() ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"写入缓冲文件失败");
}

int LB_CEF3_CALL LB_CEF3_BufferRelease(LB_CEF3_BUFFER_HANDLE buffer) { return LB_CEF3_HandleRelease(buffer); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueCreate(void) {
  return RegisterValue(CefValue::Create());
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueCopy(LB_CEF3_HANDLE value) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return 0;
  std::lock_guard<std::mutex> lock(state->mutex);
  return RegisterValue(state->value->Copy());
}

int LB_CEF3_CALL LB_CEF3_ValueIsValid(LB_CEF3_HANDLE value) {
  int status = 0; auto state = GetValueState(value, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsValid() ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_ValueIsOwned(LB_CEF3_HANDLE value) {
  int status = 0; auto state = GetValueState(value, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsOwned() ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_ValueIsReadOnly(LB_CEF3_HANDLE value) {
  int status = 0; auto state = GetValueState(value, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsReadOnly() ? 1 : 0;
}

int CompareValues(LB_CEF3_HANDLE value, LB_CEF3_HANDLE other, bool equal) {
  int left_status = 0; auto left = GetValueState(value, left_status); if (!left) return left_status;
  int right_status = 0; auto right = GetValueState(other, right_status); if (!right) return right_status;
  CefRefPtr<CefValue> left_value; CefRefPtr<CefValue> right_value;
  { std::lock_guard<std::mutex> lock(left->mutex); left_value = left->value; }
  { std::lock_guard<std::mutex> lock(right->mutex); right_value = right->value; }
  return (equal ? left_value->IsEqual(right_value) : left_value->IsSame(right_value)) ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_ValueIsSame(LB_CEF3_HANDLE value, LB_CEF3_HANDLE other) { return CompareValues(value, other, false); }
int LB_CEF3_CALL LB_CEF3_ValueIsEqual(LB_CEF3_HANDLE value, LB_CEF3_HANDLE other) { return CompareValues(value, other, true); }

int LB_CEF3_CALL LB_CEF3_ValueGetType(LB_CEF3_HANDLE value) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return ValueType(state->value->GetType());
}

int LB_CEF3_CALL LB_CEF3_ValueSetNull(LB_CEF3_HANDLE value) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetNull() ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置空值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetBool(LB_CEF3_HANDLE value, int data) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetBool(data != 0) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置逻辑值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetInt(LB_CEF3_HANDLE value, int data) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetInt(data) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置整数值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetDouble(LB_CEF3_HANDLE value, double data) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetDouble(data) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置小数值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetString(LB_CEF3_HANDLE value, const wchar_t* data) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetString(data ? data : L"") ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置文本值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetBuffer(LB_CEF3_HANDLE value, LB_CEF3_BUFFER_HANDLE buffer) {
  int value_status = 0;
  auto value_state = GetValueState(value, value_status);
  if (!value_state) return value_status;
  int buffer_status = 0;
  auto buffer_state = GetBuffer(buffer, buffer_status);
  if (!buffer_state) return buffer_status;
  const unsigned char empty = 0;
  const void* data = buffer_state->bytes.empty() ? static_cast<const void*>(&empty) : buffer_state->bytes.data();
  auto binary = CefBinaryValue::Create(data, buffer_state->bytes.size());
  if (!binary) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"创建CEF二进制值失败");
  std::lock_guard<std::mutex> lock(value_state->mutex);
  return value_state->value->SetBinary(binary) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置二进制值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetDictionary(LB_CEF3_HANDLE value, LB_CEF3_HANDLE dictionary) {
  int value_status = 0; auto value_state = GetValueState(value, value_status); if (!value_state) return value_status;
  int dictionary_status = 0; auto dictionary_state = GetDictionaryState(dictionary, dictionary_status); if (!dictionary_state) return dictionary_status;
  CefRefPtr<CefDictionaryValue> copy;
  { std::lock_guard<std::mutex> lock(dictionary_state->mutex); copy = dictionary_state->value->Copy(false); }
  std::lock_guard<std::mutex> lock(value_state->mutex);
  return value_state->value->SetDictionary(copy) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置字典值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueSetList(LB_CEF3_HANDLE value, LB_CEF3_HANDLE list) {
  int value_status = 0; auto value_state = GetValueState(value, value_status); if (!value_state) return value_status;
  int list_status = 0; auto list_state = GetListState(list, list_status); if (!list_state) return list_status;
  CefRefPtr<CefListValue> copy;
  { std::lock_guard<std::mutex> lock(list_state->mutex); copy = list_state->value->Copy(); }
  std::lock_guard<std::mutex> lock(value_state->mutex);
  return value_state->value->SetList(copy) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置列表值失败");
}

int LB_CEF3_CALL LB_CEF3_ValueGetBool(LB_CEF3_HANDLE value) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->value->GetType() != VTYPE_BOOL) return Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是逻辑类型");
  return state->value->GetBool() ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_ValueGetInt(LB_CEF3_HANDLE value, int* data) {
  if (!data) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"data不能为空");
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->value->GetType() != VTYPE_INT) return Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是整数类型");
  *data = state->value->GetInt();
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_ValueGetDouble(LB_CEF3_HANDLE value, double* data) {
  if (!data) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"data不能为空");
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->value->GetType() != VTYPE_DOUBLE) return Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是小数类型");
  *data = state->value->GetDouble();
  return LB_CEF3_OK;
}

int LB_CEF3_CALL LB_CEF3_ValueGetString(LB_CEF3_HANDLE value, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->value->GetType() != VTYPE_STRING) return Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是文本类型");
  return CopyWide(state->value->GetString().ToWString(), result, capacity, required);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetBuffer(LB_CEF3_HANDLE value) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return 0;
  CefRefPtr<CefBinaryValue> binary;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->value->GetType() != VTYPE_BINARY) {
      Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是二进制类型");
      return 0;
    }
    binary = state->value->GetBinary();
  }
  if (!binary || !binary->IsValid()) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF二进制值无效");
    return 0;
  }
  std::vector<unsigned char> bytes(binary->GetSize());
  if (!bytes.empty() && binary->GetData(bytes.data(), bytes.size(), 0) != bytes.size()) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"读取CEF二进制值失败");
    return 0;
  }
  return LB_CEF3_BufferCreate(bytes.data(), bytes.size());
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetDictionary(LB_CEF3_HANDLE value) {
  int status = 0; auto state = GetValueState(value, status); if (!state) return 0;
  CefRefPtr<CefDictionaryValue> copy;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->value->GetType() != VTYPE_DICTIONARY) { Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是字典类型"); return 0; }
    const auto nested = state->value->GetDictionary();
    if (nested) copy = nested->Copy(false);
  }
  return RegisterDictionary(copy);
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ValueGetList(LB_CEF3_HANDLE value) {
  int status = 0; auto state = GetValueState(value, status); if (!state) return 0;
  CefRefPtr<CefListValue> copy;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->value->GetType() != VTYPE_LIST) { Fail(LB_CEF3_ERROR_HANDLE_TYPE, L"CEF值不是列表类型"); return 0; }
    const auto nested = state->value->GetList();
    if (nested) copy = nested->Copy();
  }
  return RegisterList(copy);
}

int LB_CEF3_CALL LB_CEF3_ValueToJson(LB_CEF3_HANDLE value, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetValueState(value, status);
  if (!state) return status;
  CefRefPtr<CefValue> copy;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    copy = state->value->Copy();
  }
  const auto json = ValueJson(copy);
  if (json.empty()) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF值JSON序列化失败");
  return CopyWide(json, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_ValueRelease(LB_CEF3_HANDLE value) { return LB_CEF3_HandleRelease(value); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryCreate(void) {
  return RegisterDictionary(CefDictionaryValue::Create());
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryCopy(LB_CEF3_HANDLE dictionary, int exclude_empty_children) {
  int status = 0; auto state = GetDictionaryState(dictionary, status); if (!state) return 0;
  std::lock_guard<std::mutex> lock(state->mutex);
  return RegisterDictionary(state->value->Copy(exclude_empty_children != 0));
}

int LB_CEF3_CALL LB_CEF3_DictionaryIsValid(LB_CEF3_HANDLE dictionary) {
  int status = 0; auto state = GetDictionaryState(dictionary, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsValid() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_DictionaryIsOwned(LB_CEF3_HANDLE dictionary) {
  int status = 0; auto state = GetDictionaryState(dictionary, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsOwned() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_DictionaryIsReadOnly(LB_CEF3_HANDLE dictionary) {
  int status = 0; auto state = GetDictionaryState(dictionary, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsReadOnly() ? 1 : 0;
}
int CompareDictionaries(LB_CEF3_HANDLE dictionary, LB_CEF3_HANDLE other, bool equal) {
  int left_status = 0; auto left = GetDictionaryState(dictionary, left_status); if (!left) return left_status;
  int right_status = 0; auto right = GetDictionaryState(other, right_status); if (!right) return right_status;
  CefRefPtr<CefDictionaryValue> left_value; CefRefPtr<CefDictionaryValue> right_value;
  { std::lock_guard<std::mutex> lock(left->mutex); left_value = left->value; }
  { std::lock_guard<std::mutex> lock(right->mutex); right_value = right->value; }
  return (equal ? left_value->IsEqual(right_value) : left_value->IsSame(right_value)) ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_DictionaryIsSame(LB_CEF3_HANDLE dictionary, LB_CEF3_HANDLE other) { return CompareDictionaries(dictionary, other, false); }
int LB_CEF3_CALL LB_CEF3_DictionaryIsEqual(LB_CEF3_HANDLE dictionary, LB_CEF3_HANDLE other) { return CompareDictionaries(dictionary, other, true); }

int64_t LB_CEF3_CALL LB_CEF3_DictionaryGetSize(LB_CEF3_HANDLE dictionary) {
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return static_cast<int64_t>(state->value->GetSize());
}

int LB_CEF3_CALL LB_CEF3_DictionaryHasKey(LB_CEF3_HANDLE dictionary, const wchar_t* key) {
  if (!key) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"key不能为空");
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->HasKey(key) ? 1 : 0;
}

int LB_CEF3_CALL LB_CEF3_DictionaryGetKeysJson(LB_CEF3_HANDLE dictionary, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  CefDictionaryValue::KeyList keys;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (!state->value->GetKeys(keys)) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"读取CEF字典键失败");
  }
  auto list = CefListValue::Create();
  list->SetSize(keys.size());
  for (size_t index = 0; index < keys.size(); ++index) list->SetString(index, keys[index]);
  auto wrapper = CefValue::Create();
  wrapper->SetList(list);
  const auto json = ValueJson(wrapper);
  if (json.empty()) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF字典键JSON序列化失败");
  return CopyWide(json, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_DictionaryGetType(LB_CEF3_HANDLE dictionary, const wchar_t* key) {
  if (!key) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"key不能为空");
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return ValueType(state->value->GetType(key));
}

int LB_CEF3_CALL LB_CEF3_DictionarySetValue(LB_CEF3_HANDLE dictionary, const wchar_t* key, LB_CEF3_HANDLE value) {
  if (!key) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"key不能为空");
  int dictionary_status = 0;
  auto dictionary_state = GetDictionaryState(dictionary, dictionary_status);
  if (!dictionary_state) return dictionary_status;
  int value_status = 0;
  auto value_state = GetValueState(value, value_status);
  if (!value_state) return value_status;
  CefRefPtr<CefValue> copy;
  {
    std::lock_guard<std::mutex> lock(value_state->mutex);
    copy = value_state->value->Copy();
  }
  std::lock_guard<std::mutex> lock(dictionary_state->mutex);
  return dictionary_state->value->SetValue(key, copy) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置CEF字典值失败");
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_DictionaryGetValue(LB_CEF3_HANDLE dictionary, const wchar_t* key) {
  if (!key) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"key不能为空");
    return 0;
  }
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return 0;
  CefRefPtr<CefValue> value;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    value = state->value->GetValue(key);
    if (value) value = value->Copy();
  }
  if (!value) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF字典键不存在");
    return 0;
  }
  return RegisterValue(value);
}

int LB_CEF3_CALL LB_CEF3_DictionaryRemove(LB_CEF3_HANDLE dictionary, const wchar_t* key) {
  if (!key) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"key不能为空");
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->Remove(key) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF字典键不存在");
}

int LB_CEF3_CALL LB_CEF3_DictionaryClear(LB_CEF3_HANDLE dictionary) {
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->Clear() ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"清空CEF字典失败");
}

int LB_CEF3_CALL LB_CEF3_DictionaryToJson(LB_CEF3_HANDLE dictionary, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetDictionaryState(dictionary, status);
  if (!state) return status;
  auto wrapper = CefValue::Create();
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    wrapper->SetDictionary(state->value->Copy(false));
  }
  const auto json = ValueJson(wrapper);
  if (json.empty()) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF字典JSON序列化失败");
  return CopyWide(json, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_DictionaryRelease(LB_CEF3_HANDLE dictionary) { return LB_CEF3_HandleRelease(dictionary); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListCreate(void) {
  return RegisterList(CefListValue::Create());
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListCopy(LB_CEF3_HANDLE list) {
  int status = 0; auto state = GetListState(list, status); if (!state) return 0;
  std::lock_guard<std::mutex> lock(state->mutex); return RegisterList(state->value->Copy());
}
int LB_CEF3_CALL LB_CEF3_ListIsValid(LB_CEF3_HANDLE list) {
  int status = 0; auto state = GetListState(list, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsValid() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_ListIsOwned(LB_CEF3_HANDLE list) {
  int status = 0; auto state = GetListState(list, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsOwned() ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_ListIsReadOnly(LB_CEF3_HANDLE list) {
  int status = 0; auto state = GetListState(list, status); if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex); return state->value->IsReadOnly() ? 1 : 0;
}
int CompareLists(LB_CEF3_HANDLE list, LB_CEF3_HANDLE other, bool equal) {
  int left_status = 0; auto left = GetListState(list, left_status); if (!left) return left_status;
  int right_status = 0; auto right = GetListState(other, right_status); if (!right) return right_status;
  CefRefPtr<CefListValue> left_value; CefRefPtr<CefListValue> right_value;
  { std::lock_guard<std::mutex> lock(left->mutex); left_value = left->value; }
  { std::lock_guard<std::mutex> lock(right->mutex); right_value = right->value; }
  return (equal ? left_value->IsEqual(right_value) : left_value->IsSame(right_value)) ? 1 : 0;
}
int LB_CEF3_CALL LB_CEF3_ListIsSame(LB_CEF3_HANDLE list, LB_CEF3_HANDLE other) { return CompareLists(list, other, false); }
int LB_CEF3_CALL LB_CEF3_ListIsEqual(LB_CEF3_HANDLE list, LB_CEF3_HANDLE other) { return CompareLists(list, other, true); }

int64_t LB_CEF3_CALL LB_CEF3_ListGetSize(LB_CEF3_HANDLE list) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return static_cast<int64_t>(state->value->GetSize());
}

int LB_CEF3_CALL LB_CEF3_ListSetSize(LB_CEF3_HANDLE list, uint64_t size) {
  if (size > static_cast<uint64_t>(SIZE_MAX)) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"列表大小超出平台限制");
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->SetSize(static_cast<size_t>(size)) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置CEF列表大小失败");
}

int LB_CEF3_CALL LB_CEF3_ListGetType(LB_CEF3_HANDLE list, uint64_t index) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (index >= state->value->GetSize()) return Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF列表索引越界");
  return ValueType(state->value->GetType(static_cast<size_t>(index)));
}

int LB_CEF3_CALL LB_CEF3_ListSetValue(LB_CEF3_HANDLE list, uint64_t index, LB_CEF3_HANDLE value) {
  int list_status = 0;
  auto list_state = GetListState(list, list_status);
  if (!list_state) return list_status;
  int value_status = 0;
  auto value_state = GetValueState(value, value_status);
  if (!value_state) return value_status;
  CefRefPtr<CefValue> copy;
  {
    std::lock_guard<std::mutex> lock(value_state->mutex);
    copy = value_state->value->Copy();
  }
  std::lock_guard<std::mutex> lock(list_state->mutex);
  if (index >= list_state->value->GetSize()) return Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF列表索引越界");
  return list_state->value->SetValue(static_cast<size_t>(index), copy) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"设置CEF列表值失败");
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ListGetValue(LB_CEF3_HANDLE list, uint64_t index) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return 0;
  CefRefPtr<CefValue> value;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (index >= state->value->GetSize()) {
      Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF列表索引越界");
      return 0;
    }
    value = state->value->GetValue(static_cast<size_t>(index));
    if (value) value = value->Copy();
  }
  if (!value) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"读取CEF列表值失败");
    return 0;
  }
  return RegisterValue(value);
}

int LB_CEF3_CALL LB_CEF3_ListRemove(LB_CEF3_HANDLE list, uint64_t index) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (index >= state->value->GetSize()) return Fail(LB_CEF3_ERROR_NOT_FOUND, L"CEF列表索引越界");
  return state->value->Remove(static_cast<size_t>(index)) ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"删除CEF列表值失败");
}

int LB_CEF3_CALL LB_CEF3_ListClear(LB_CEF3_HANDLE list) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  std::lock_guard<std::mutex> lock(state->mutex);
  return state->value->Clear() ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"清空CEF列表失败");
}

int LB_CEF3_CALL LB_CEF3_ListToJson(LB_CEF3_HANDLE list, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetListState(list, status);
  if (!state) return status;
  auto wrapper = CefValue::Create();
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    wrapper->SetList(state->value->Copy());
  }
  const auto json = ValueJson(wrapper);
  if (json.empty()) return Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF列表JSON序列化失败");
  return CopyWide(json, result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_ListRelease(LB_CEF3_HANDLE list) { return LB_CEF3_HandleRelease(list); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuCreate(void) {
  auto result = std::make_shared<CefRefPtr<CefMenuModel>>();
  if (!RunOnCefUiSync([result]() {
        CefRefPtr<CefMenuModelDelegate> delegate = new BridgeMenuDelegate();
        *result = CefMenuModel::CreateMenuModel(delegate);
      })) { Fail(LB_CEF3_ERROR_TIMEOUT, L"创建CEF菜单超时"); return 0; }
  return RegisterMenu(*result);
}

int LB_CEF3_CALL LB_CEF3_MenuIsSubMenu(LB_CEF3_HANDLE menu) {
  return WithMenuInt(menu, [](auto value) { return value->IsSubMenu() ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuClear(LB_CEF3_HANDLE menu) {
  return WithMenuInt(menu, [](auto value) { return value->Clear() ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int64_t LB_CEF3_CALL LB_CEF3_MenuGetCount(LB_CEF3_HANDLE menu) {
  return WithMenuInt64(menu, [](auto value) { return static_cast<int64_t>(value->GetCount()); });
}
int LB_CEF3_CALL LB_CEF3_MenuAddSeparator(LB_CEF3_HANDLE menu) {
  return WithMenuInt(menu, [](auto value) { return value->AddSeparator() ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuAddItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label) {
  const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [command_id, text](auto value) { return value->AddItem(command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuAddCheckItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label) {
  const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [command_id, text](auto value) { return value->AddCheckItem(command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuAddRadioItem(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label, int group_id) {
  const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [command_id, text, group_id](auto value) { return value->AddRadioItem(command_id, text, group_id) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuAddSubMenu(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label) {
  const auto text = std::wstring(label ? label : L"");
  return WithMenuHandle(menu, [command_id, text](auto value) { return value->AddSubMenu(command_id, text); });
}
int LB_CEF3_CALL LB_CEF3_MenuInsertSeparatorAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->InsertSeparatorAt(static_cast<size_t>(index)) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuInsertItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT; const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [index, command_id, text](auto value) { return value->InsertItemAt(static_cast<size_t>(index), command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuInsertCheckItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT; const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [index, command_id, text](auto value) { return value->InsertCheckItemAt(static_cast<size_t>(index), command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
int LB_CEF3_CALL LB_CEF3_MenuInsertRadioItemAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label, int group_id) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT; const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [index, command_id, text, group_id](auto value) { return value->InsertRadioItemAt(static_cast<size_t>(index), command_id, text, group_id) ? LB_CEF3_OK : LB_CEF3_ERROR_OPERATION_FAILED; });
}
LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuInsertSubMenuAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id, const wchar_t* label) {
  if (index > SIZE_MAX) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"菜单索引超出平台限制"); return 0; } const auto text = std::wstring(label ? label : L"");
  return WithMenuHandle(menu, [index, command_id, text](auto value) { return value->InsertSubMenuAt(static_cast<size_t>(index), command_id, text); });
}
int LB_CEF3_CALL LB_CEF3_MenuRemove(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->Remove(command_id) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuRemoveAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->RemoveAt(static_cast<size_t>(index)) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuGetIndexOf(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->GetIndexOf(command_id); });
}
int LB_CEF3_CALL LB_CEF3_MenuGetCommandIdAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"菜单索引超出平台限制");
  return WithMenuInt(menu, [index](auto value) { return value->GetCommandIdAt(static_cast<size_t>(index)); });
}
int LB_CEF3_CALL LB_CEF3_MenuSetCommandIdAt(LB_CEF3_HANDLE menu, uint64_t index, int command_id) {
  if (index > SIZE_MAX) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"菜单索引超出平台限制");
  return WithMenuInt(menu, [index, command_id](auto value) { return value->SetCommandIdAt(static_cast<size_t>(index), command_id) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuGetLabel(
    LB_CEF3_HANDLE menu, int command_id, wchar_t* result, size_t capacity, size_t* required) {
  return WithMenuString(menu, [command_id](auto value) { return value->GetLabel(command_id); }, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_MenuGetLabelAt(
    LB_CEF3_HANDLE menu, uint64_t index, wchar_t* result, size_t capacity, size_t* required) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuString(menu, [index](auto value) { return value->GetLabelAt(static_cast<size_t>(index)); }, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_MenuSetLabel(LB_CEF3_HANDLE menu, int command_id, const wchar_t* label) {
  const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [command_id, text](auto value) { return value->SetLabel(command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetLabelAt(LB_CEF3_HANDLE menu, uint64_t index, const wchar_t* label) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT; const auto text = std::wstring(label ? label : L"");
  return WithMenuInt(menu, [index, text](auto value) { return value->SetLabelAt(static_cast<size_t>(index), text) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuGetType(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return static_cast<int>(value->GetType(command_id)); });
}
int LB_CEF3_CALL LB_CEF3_MenuGetTypeAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return static_cast<int>(value->GetTypeAt(static_cast<size_t>(index))); });
}
int LB_CEF3_CALL LB_CEF3_MenuGetGroupId(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->GetGroupId(command_id); });
}
int LB_CEF3_CALL LB_CEF3_MenuGetGroupIdAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->GetGroupIdAt(static_cast<size_t>(index)); });
}
int LB_CEF3_CALL LB_CEF3_MenuSetGroupId(LB_CEF3_HANDLE menu, int command_id, int group_id) {
  return WithMenuInt(menu, [command_id, group_id](auto value) { return value->SetGroupId(command_id, group_id) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetGroupIdAt(LB_CEF3_HANDLE menu, uint64_t index, int group_id) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index, group_id](auto value) { return value->SetGroupIdAt(static_cast<size_t>(index), group_id) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuGetSubMenu(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuHandle(menu, [command_id](auto value) { return value->GetSubMenu(command_id); });
}
LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_MenuGetSubMenuAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"菜单索引超出平台限制"); return 0; }
  return WithMenuHandle(menu, [index](auto value) { return value->GetSubMenuAt(static_cast<size_t>(index)); });
}
int LB_CEF3_CALL LB_CEF3_MenuIsVisible(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->IsVisible(command_id) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuIsVisibleAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->IsVisibleAt(static_cast<size_t>(index)) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetVisible(LB_CEF3_HANDLE menu, int command_id, int visible) {
  return WithMenuInt(menu, [command_id, visible](auto value) { return value->SetVisible(command_id, visible != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetVisibleAt(LB_CEF3_HANDLE menu, uint64_t index, int visible) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index, visible](auto value) { return value->SetVisibleAt(static_cast<size_t>(index), visible != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuIsEnabled(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->IsEnabled(command_id) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuIsEnabledAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->IsEnabledAt(static_cast<size_t>(index)) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetEnabled(LB_CEF3_HANDLE menu, int command_id, int enabled) {
  return WithMenuInt(menu, [command_id, enabled](auto value) { return value->SetEnabled(command_id, enabled != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetEnabledAt(LB_CEF3_HANDLE menu, uint64_t index, int enabled) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index, enabled](auto value) { return value->SetEnabledAt(static_cast<size_t>(index), enabled != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuIsChecked(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->IsChecked(command_id) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuIsCheckedAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->IsCheckedAt(static_cast<size_t>(index)) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetChecked(LB_CEF3_HANDLE menu, int command_id, int checked) {
  return WithMenuInt(menu, [command_id, checked](auto value) { return value->SetChecked(command_id, checked != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetCheckedAt(LB_CEF3_HANDLE menu, uint64_t index, int checked) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index, checked](auto value) { return value->SetCheckedAt(static_cast<size_t>(index), checked != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuHasAccelerator(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->HasAccelerator(command_id) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuHasAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->HasAcceleratorAt(static_cast<size_t>(index)) ? 1 : 0; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetAccelerator(LB_CEF3_HANDLE menu, int command_id, int key_code, int shift, int control, int alt) {
  return WithMenuInt(menu, [=](auto value) { return value->SetAccelerator(command_id, key_code, shift != 0, control != 0, alt != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index, int key_code, int shift, int control, int alt) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [=](auto value) { return value->SetAcceleratorAt(static_cast<size_t>(index), key_code, shift != 0, control != 0, alt != 0) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuRemoveAccelerator(LB_CEF3_HANDLE menu, int command_id) {
  return WithMenuInt(menu, [command_id](auto value) { return value->RemoveAccelerator(command_id) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuRemoveAcceleratorAt(LB_CEF3_HANDLE menu, uint64_t index) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return WithMenuInt(menu, [index](auto value) { return value->RemoveAcceleratorAt(static_cast<size_t>(index)) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}

int MenuGetAcceleratorJson(LB_CEF3_HANDLE menu, int64_t selector, bool by_index,
                           wchar_t* result, size_t capacity, size_t* required) {
  int status = 0; auto state = GetMenuState(menu, status); if (!state) return status;
  struct Accelerator { bool found = false; int key = 0; bool shift = false; bool control = false; bool alt = false; };
  auto output = std::make_shared<Accelerator>();
  if (!RunOnCefUiSync([state, output, selector, by_index]() {
        output->found = by_index
          ? state->menu->GetAcceleratorAt(static_cast<size_t>(selector), output->key, output->shift, output->control, output->alt)
          : state->menu->GetAccelerator(static_cast<int>(selector), output->key, output->shift, output->control, output->alt);
      })) return Fail(LB_CEF3_ERROR_TIMEOUT, L"读取菜单快捷键超时");
  if (!output->found) return Fail(LB_CEF3_ERROR_NOT_FOUND, L"菜单快捷键不存在");
  std::wostringstream json;
  json << L"{\"keyCode\":" << output->key << L",\"shift\":" << (output->shift ? L"true" : L"false")
       << L",\"control\":" << (output->control ? L"true" : L"false")
       << L",\"alt\":" << (output->alt ? L"true" : L"false") << L"}";
  return CopyWide(json.str(), result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_MenuGetAcceleratorJson(LB_CEF3_HANDLE menu, int command_id, wchar_t* result, size_t capacity, size_t* required) {
  return MenuGetAcceleratorJson(menu, command_id, false, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_MenuGetAcceleratorAtJson(LB_CEF3_HANDLE menu, uint64_t index, wchar_t* result, size_t capacity, size_t* required) {
  if (index > SIZE_MAX) return LB_CEF3_ERROR_INVALID_ARGUMENT;
  return MenuGetAcceleratorJson(menu, static_cast<int64_t>(index), true, result, capacity, required);
}
int LB_CEF3_CALL LB_CEF3_MenuSetColor(LB_CEF3_HANDLE menu, int command_id, int color_type, uint32_t color) {
  return WithMenuInt(menu, [=](auto value) { return value->SetColor(command_id, static_cast<cef_menu_color_type_t>(color_type), color) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetColorAt(LB_CEF3_HANDLE menu, int index, int color_type, uint32_t color) {
  return WithMenuInt(menu, [=](auto value) { return value->SetColorAt(index, static_cast<cef_menu_color_type_t>(color_type), color) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int64_t LB_CEF3_CALL LB_CEF3_MenuGetColor(LB_CEF3_HANDLE menu, int command_id, int color_type) {
  return WithMenuInt64(menu, [=](auto value) { cef_color_t color = 0; return value->GetColor(command_id, static_cast<cef_menu_color_type_t>(color_type), color) ? static_cast<int64_t>(color) : static_cast<int64_t>(LB_CEF3_ERROR_NOT_FOUND); });
}
int64_t LB_CEF3_CALL LB_CEF3_MenuGetColorAt(LB_CEF3_HANDLE menu, int index, int color_type) {
  return WithMenuInt64(menu, [=](auto value) { cef_color_t color = 0; return value->GetColorAt(index, static_cast<cef_menu_color_type_t>(color_type), color) ? static_cast<int64_t>(color) : static_cast<int64_t>(LB_CEF3_ERROR_NOT_FOUND); });
}
int LB_CEF3_CALL LB_CEF3_MenuSetFontList(LB_CEF3_HANDLE menu, int command_id, const wchar_t* font_list) {
  const auto text = std::wstring(font_list ? font_list : L"");
  return WithMenuInt(menu, [command_id, text](auto value) { return value->SetFontList(command_id, text) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuSetFontListAt(LB_CEF3_HANDLE menu, int index, const wchar_t* font_list) {
  const auto text = std::wstring(font_list ? font_list : L"");
  return WithMenuInt(menu, [index, text](auto value) { return value->SetFontListAt(index, text) ? LB_CEF3_OK : LB_CEF3_ERROR_NOT_FOUND; });
}
int LB_CEF3_CALL LB_CEF3_MenuRelease(LB_CEF3_HANDLE menu) { return LB_CEF3_HandleRelease(menu); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_ImageCreate(void) {
  auto state = std::make_shared<ImageState>();
  if (!RunOnCefUiSync([state]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        state->image = CefImage::CreateImage();
      })) {
    Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法创建图像对象");
    return 0;
  }
  if (!state->image) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"CEF图像对象创建失败");
    return 0;
  }
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_IMAGE;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

int LB_CEF3_CALL LB_CEF3_ImageIsEmpty(LB_CEF3_HANDLE image) {
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  auto result = std::make_shared<int>(LB_CEF3_ERROR_OPERATION_FAILED);
  if (!RunOnCefUiSync([state, result]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *result = state->image && state->image->IsEmpty() ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取图像状态");
  return *result;
}

int LB_CEF3_CALL LB_CEF3_ImageIsSame(LB_CEF3_HANDLE image, LB_CEF3_HANDLE other) {
  int left_status = 0;
  auto left = GetImageState(image, left_status);
  if (!left) return left_status;
  int right_status = 0;
  auto right = GetImageState(other, right_status);
  if (!right) return right_status;
  auto result = std::make_shared<int>(LB_CEF3_ERROR_OPERATION_FAILED);
  if (!RunOnCefUiSync([left, right, result]() {
        CefRefPtr<CefImage> left_image;
        CefRefPtr<CefImage> right_image;
        {
          std::lock_guard<std::mutex> lock(left->mutex);
          left_image = left->image;
        }
        {
          std::lock_guard<std::mutex> lock(right->mutex);
          right_image = right->image;
        }
        *result = left_image && right_image && left_image->IsSame(right_image) ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法比较图像对象");
  return *result;
}

int LB_CEF3_CALL LB_CEF3_ImageAddBitmap(
    LB_CEF3_HANDLE image, double scale_factor, int pixel_width, int pixel_height,
    int color_type, int alpha_type, LB_CEF3_BUFFER_HANDLE pixels) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0 || pixel_width <= 0 || pixel_height <= 0) {
    return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放和像素尺寸必须为正数");
  }
  const auto expected = static_cast<uint64_t>(pixel_width) * static_cast<uint64_t>(pixel_height) * 4u;
  int buffer_status = 0;
  auto buffer = GetBuffer(pixels, buffer_status);
  if (!buffer) return buffer_status;
  if (expected != buffer->bytes.size()) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"位图缓冲大小必须等于宽乘高乘4");
  const auto bytes = buffer->bytes;
  int image_status = 0;
  auto state = GetImageState(image, image_status);
  if (!state) return image_status;
  auto added = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([state, added, bytes, scale_factor, pixel_width, pixel_height, color_type, alpha_type]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *added = state->image && state->image->AddBitmap(
          static_cast<float>(scale_factor), pixel_width, pixel_height,
          static_cast<cef_color_type_t>(color_type), static_cast<cef_alpha_type_t>(alpha_type),
          bytes.data(), bytes.size());
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法添加位图表示");
  return *added ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"添加CEF位图表示失败");
}

int LB_CEF3_CALL LB_CEF3_ImageAddPng(LB_CEF3_HANDLE image, double scale_factor, LB_CEF3_BUFFER_HANDLE png) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数");
  int buffer_status = 0;
  auto buffer = GetBuffer(png, buffer_status);
  if (!buffer || buffer->bytes.empty()) return buffer ? Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"PNG缓冲不能为空") : buffer_status;
  const auto bytes = buffer->bytes;
  int image_status = 0;
  auto state = GetImageState(image, image_status);
  if (!state) return image_status;
  auto added = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([state, added, bytes, scale_factor]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *added = state->image && state->image->AddPNG(static_cast<float>(scale_factor), bytes.data(), bytes.size());
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法添加PNG表示");
  return *added ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"添加CEF PNG表示失败");
}

int LB_CEF3_CALL LB_CEF3_ImageAddJpeg(LB_CEF3_HANDLE image, double scale_factor, LB_CEF3_BUFFER_HANDLE jpeg) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数");
  int buffer_status = 0;
  auto buffer = GetBuffer(jpeg, buffer_status);
  if (!buffer || buffer->bytes.empty()) return buffer ? Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"JPEG缓冲不能为空") : buffer_status;
  const auto bytes = buffer->bytes;
  int image_status = 0;
  auto state = GetImageState(image, image_status);
  if (!state) return image_status;
  auto added = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([state, added, bytes, scale_factor]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *added = state->image && state->image->AddJPEG(static_cast<float>(scale_factor), bytes.data(), bytes.size());
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法添加JPEG表示");
  return *added ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"添加CEF JPEG表示失败");
}

int64_t LB_CEF3_CALL LB_CEF3_ImageGetWidth(LB_CEF3_HANDLE image) {
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  auto result = std::make_shared<int64_t>(0);
  if (!RunOnCefUiSync([state, result]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) *result = static_cast<int64_t>(state->image->GetWidth());
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取图像宽度");
  return *result;
}

int64_t LB_CEF3_CALL LB_CEF3_ImageGetHeight(LB_CEF3_HANDLE image) {
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  auto result = std::make_shared<int64_t>(0);
  if (!RunOnCefUiSync([state, result]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) *result = static_cast<int64_t>(state->image->GetHeight());
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取图像高度");
  return *result;
}

int LB_CEF3_CALL LB_CEF3_ImageHasRepresentation(LB_CEF3_HANDLE image, double scale_factor) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数");
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  auto result = std::make_shared<int>(0);
  if (!RunOnCefUiSync([state, result, scale_factor]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *result = state->image && state->image->HasRepresentation(static_cast<float>(scale_factor)) ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取图像表示");
  return *result;
}

int LB_CEF3_CALL LB_CEF3_ImageRemoveRepresentation(LB_CEF3_HANDLE image, double scale_factor) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数");
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  auto removed = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([state, removed, scale_factor]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        *removed = state->image && state->image->RemoveRepresentation(static_cast<float>(scale_factor));
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法删除图像表示");
  return *removed ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_NOT_FOUND, L"图像表示不存在");
}

int LB_CEF3_CALL LB_CEF3_ImageGetRepresentationInfo(
    LB_CEF3_HANDLE image, double scale_factor, wchar_t* result, size_t capacity, size_t* required) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数");
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return status;
  struct RepresentationInfo { bool found = false; float actual = 0.0f; int width = 0; int height = 0; };
  auto info = std::make_shared<RepresentationInfo>();
  if (!RunOnCefUiSync([state, info, scale_factor]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) info->found = state->image->GetRepresentationInfo(
          static_cast<float>(scale_factor), info->actual, info->width, info->height);
      })) return Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取图像表示信息");
  if (!info->found) return Fail(LB_CEF3_ERROR_NOT_FOUND, L"图像表示不存在");
  std::wostringstream json;
  json << L"{\"scale\":" << std::setprecision(9) << info->actual << L",\"width\":" << info->width
       << L",\"height\":" << info->height << L"}";
  return CopyWide(json.str(), result, capacity, required);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsBitmap(
    LB_CEF3_HANDLE image, double scale_factor, int color_type, int alpha_type) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数"); return 0; }
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return 0;
  struct BinaryResult { CefRefPtr<CefBinaryValue> binary; int width = 0; int height = 0; };
  auto output = std::make_shared<BinaryResult>();
  if (!RunOnCefUiSync([state, output, scale_factor, color_type, alpha_type]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) output->binary = state->image->GetAsBitmap(
          static_cast<float>(scale_factor), static_cast<cef_color_type_t>(color_type),
          static_cast<cef_alpha_type_t>(alpha_type), output->width, output->height);
      })) { Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法导出位图"); return 0; }
  return RegisterBinaryBuffer(output->binary);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsPng(
    LB_CEF3_HANDLE image, double scale_factor, int with_transparency) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放必须为正数"); return 0; }
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return 0;
  struct BinaryResult { CefRefPtr<CefBinaryValue> binary; int width = 0; int height = 0; };
  auto output = std::make_shared<BinaryResult>();
  if (!RunOnCefUiSync([state, output, scale_factor, with_transparency]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) output->binary = state->image->GetAsPNG(
          static_cast<float>(scale_factor), with_transparency != 0, output->width, output->height);
      })) { Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法导出PNG"); return 0; }
  return RegisterBinaryBuffer(output->binary);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_ImageGetAsJpeg(
    LB_CEF3_HANDLE image, double scale_factor, int quality) {
  if (!std::isfinite(scale_factor) || scale_factor <= 0.0 || quality < 0 || quality > 100) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"图像缩放或JPEG质量无效");
    return 0;
  }
  int status = 0;
  auto state = GetImageState(image, status);
  if (!state) return 0;
  struct BinaryResult { CefRefPtr<CefBinaryValue> binary; int width = 0; int height = 0; };
  auto output = std::make_shared<BinaryResult>();
  if (!RunOnCefUiSync([state, output, scale_factor, quality]() {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->image) output->binary = state->image->GetAsJPEG(
          static_cast<float>(scale_factor), quality, output->width, output->height);
      })) { Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法导出JPEG"); return 0; }
  return RegisterBinaryBuffer(output->binary);
}

int LB_CEF3_CALL LB_CEF3_ImageRelease(LB_CEF3_HANDLE image) { return LB_CEF3_HandleRelease(image); }

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetVisibleNavigationEntry(LB_CEF3_HANDLE browser) {
  int status = 0;
  auto browser_state = GetBrowserState(browser, status);
  if (!browser_state) return 0;
  auto snapshot = std::make_shared<NavigationEntryState>();
  auto found = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([browser_state, snapshot, found]() {
        CefRefPtr<CefBrowser> cef_browser;
        {
          std::lock_guard<std::mutex> lock(browser_state->mutex);
          cef_browser = browser_state->browser;
        }
        if (!cef_browser || !cef_browser->GetHost()) return;
        const auto entry = cef_browser->GetHost()->GetVisibleNavigationEntry();
        if (!entry) return;
        snapshot->valid = entry->IsValid();
        if (snapshot->valid) {
          snapshot->url = entry->GetURL().ToWString();
          snapshot->display_url = entry->GetDisplayURL().ToWString();
          snapshot->original_url = entry->GetOriginalURL().ToWString();
          snapshot->title = entry->GetTitle().ToWString();
          snapshot->transition_type = static_cast<int>(entry->GetTransitionType());
          snapshot->has_post_data = entry->HasPostData();
          const auto completion_time = entry->GetCompletionTime();
          snapshot->completion_time = completion_time.val == 0
            ? 0.0 : static_cast<double>(completion_time.val) / 1000000.0 - 11644473600.0;
          snapshot->http_status_code = entry->GetHttpStatusCode();
        }
        *found = true;
      })) {
    Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法取得可见导航项");
    return 0;
  }
  if (!*found) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"浏览器当前没有可见导航项");
    return 0;
  }
  HandleEntry handle_entry;
  handle_entry.type = LB_CEF3_HANDLE_NAVIGATION_ENTRY;
  handle_entry.object = std::move(snapshot);
  return Register(std::move(handle_entry));
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetNavigationEntries(LB_CEF3_HANDLE browser, int current_only) {
  int status = 0; auto browser_state = GetBrowserState(browser, status); if (!browser_state) return 0;
  auto cef_browser = SnapshotBrowser(browser_state);
  if (!cef_browser || !cef_browser->GetHost()) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"浏览器宿主不可用"); return 0; }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefNavigationEntryVisitor> visitor = new BridgeNavigationEntryVisitor(task_state);
  if (!PostToCefUi([cef_browser, visitor, current_only]() {
        cef_browser->GetHost()->GetNavigationEntries(visitor, current_only != 0);
      })) CompleteTask(task_state, false, L"无法投递导航历史读取任务");
  return task;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryIsValid(LB_CEF3_HANDLE entry) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? (state->valid ? 1 : 0) : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? CopyWide(state->url, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetDisplayUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? CopyWide(state->display_url, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetOriginalUrl(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? CopyWide(state->original_url, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetTitle(
    LB_CEF3_HANDLE entry, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? CopyWide(state->title, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetTransitionType(LB_CEF3_HANDLE entry) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? state->transition_type : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryHasPostData(LB_CEF3_HANDLE entry) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? (state->has_post_data ? 1 : 0) : status;
}

double LB_CEF3_CALL LB_CEF3_NavigationEntryGetCompletionTime(LB_CEF3_HANDLE entry) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? state->completion_time : -1.0;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryGetHttpStatusCode(LB_CEF3_HANDLE entry) {
  int status = 0;
  auto state = GetNavigationEntryState(entry, status);
  return state ? state->http_status_code : status;
}

int LB_CEF3_CALL LB_CEF3_NavigationEntryRelease(LB_CEF3_HANDLE entry) {
  return LB_CEF3_HandleRelease(entry);
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetCurrentCertificate(LB_CEF3_HANDLE browser) {
  int status = 0;
  auto browser_state = GetBrowserState(browser, status);
  if (!browser_state) return 0;
  auto snapshot = std::make_shared<CertificateState>();
  auto found = std::make_shared<bool>(false);
  if (!RunOnCefUiSync([browser_state, snapshot, found]() {
        CefRefPtr<CefBrowser> cef_browser;
        {
          std::lock_guard<std::mutex> lock(browser_state->mutex);
          cef_browser = browser_state->browser;
        }
        if (!cef_browser || !cef_browser->GetHost()) return;
        const auto navigation = cef_browser->GetHost()->GetVisibleNavigationEntry();
        const auto ssl_status = navigation ? navigation->GetSSLStatus() : nullptr;
        const auto certificate = ssl_status ? ssl_status->GetX509Certificate() : nullptr;
        if (!certificate) return;
        snapshot->secure_connection = ssl_status->IsSecureConnection();
        snapshot->cert_status = static_cast<uint32_t>(ssl_status->GetCertStatus());
        snapshot->ssl_version = static_cast<int>(ssl_status->GetSSLVersion());
        snapshot->content_status = static_cast<uint32_t>(ssl_status->GetContentStatus());
        SnapshotCertificate(certificate, *snapshot);
        *found = true;
      })) {
    Fail(LB_CEF3_ERROR_WRONG_THREAD, L"CEF UI线程不可用，无法读取当前证书");
    return 0;
  }
  if (!*found) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"当前可见导航项没有TLS证书");
    return 0;
  }
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_CERTIFICATE;
  entry.object = std::move(snapshot);
  return Register(std::move(entry));
}

int LB_CEF3_CALL LB_CEF3_CertificateIsSecureConnection(LB_CEF3_HANDLE certificate) {
  int status = 0; auto state = GetCertificateState(certificate, status);
  return state ? (state->secure_connection ? 1 : 0) : status;
}
int64_t LB_CEF3_CALL LB_CEF3_CertificateGetCertStatus(LB_CEF3_HANDLE certificate) {
  int status = 0; auto state = GetCertificateState(certificate, status);
  return state ? static_cast<int64_t>(state->cert_status) : status;
}
int LB_CEF3_CALL LB_CEF3_CertificateGetSslVersion(LB_CEF3_HANDLE certificate) {
  int status = 0; auto state = GetCertificateState(certificate, status);
  return state ? state->ssl_version : status;
}
int64_t LB_CEF3_CALL LB_CEF3_CertificateGetContentStatus(LB_CEF3_HANDLE certificate) {
  int status = 0; auto state = GetCertificateState(certificate, status);
  return state ? static_cast<int64_t>(state->content_status) : status;
}

LB_CEF3_HANDLE RegisterCertificatePrincipal(const CertificatePrincipalState& snapshot) {
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_CERTIFICATE_PRINCIPAL;
  entry.object = std::make_shared<CertificatePrincipalState>(snapshot);
  return Register(std::move(entry));
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetSubject(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? RegisterCertificatePrincipal(state->subject) : 0;
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetIssuer(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? RegisterCertificatePrincipal(state->issuer) : 0;
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetSerialNumber(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? RegisterBytes(state->serial_number) : 0;
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetDerEncoded(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? RegisterBytes(state->der_encoded) : 0;
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetPemEncoded(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? RegisterBytes(state->pem_encoded) : 0;
}

int64_t LB_CEF3_CALL LB_CEF3_CertificateGetValidStart(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? state->valid_start : status;
}

int64_t LB_CEF3_CALL LB_CEF3_CertificateGetValidExpiry(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? state->valid_expiry : status;
}

int64_t LB_CEF3_CALL LB_CEF3_CertificateGetIssuerChainSize(LB_CEF3_HANDLE certificate) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  return state ? static_cast<int64_t>(state->der_issuer_chain.size()) : status;
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetDerIssuerChainItem(
    LB_CEF3_HANDLE certificate, uint64_t index) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  if (!state) return 0;
  if (index >= state->der_issuer_chain.size()) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"DER颁发链索引越界");
    return 0;
  }
  return RegisterBytes(state->der_issuer_chain[static_cast<size_t>(index)]);
}

LB_CEF3_BUFFER_HANDLE LB_CEF3_CALL LB_CEF3_CertificateGetPemIssuerChainItem(
    LB_CEF3_HANDLE certificate, uint64_t index) {
  int status = 0;
  auto state = GetCertificateState(certificate, status);
  if (!state) return 0;
  if (index >= state->pem_issuer_chain.size()) {
    Fail(LB_CEF3_ERROR_NOT_FOUND, L"PEM颁发链索引越界");
    return 0;
  }
  return RegisterBytes(state->pem_issuer_chain[static_cast<size_t>(index)]);
}

int LB_CEF3_CALL LB_CEF3_CertificateRelease(LB_CEF3_HANDLE certificate) {
  return LB_CEF3_HandleRelease(certificate);
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetDisplayName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(state->display_name, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetCommonName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(state->common_name, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetLocalityName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(state->locality_name, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetStateOrProvinceName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(state->state_or_province_name, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetCountryName(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(state->country_name, result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetOrganizationNamesJson(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(StringVectorJson(state->organization_names), result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalGetOrganizationUnitNamesJson(
    LB_CEF3_HANDLE principal, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetCertificatePrincipalState(principal, status);
  return state ? CopyWide(StringVectorJson(state->organization_unit_names), result, capacity, required) : status;
}

int LB_CEF3_CALL LB_CEF3_CertificatePrincipalRelease(LB_CEF3_HANDLE principal) {
  return LB_CEF3_HandleRelease(principal);
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserGetRequestContext(LB_CEF3_HANDLE browser) {
  int status = 0;
  auto browser_state = GetBrowserState(browser, status);
  if (!browser_state) return 0;
  CefRefPtr<CefRequestContext> context;
  {
    std::lock_guard<std::mutex> lock(browser_state->mutex);
    context = browser_state->request_context;
  }
  if (!context) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"浏览器RequestContext不可用");
    return 0;
  }
  auto state = std::make_shared<RequestContextState>();
  state->context = context;
  HandleEntry entry;
  entry.type = LB_CEF3_HANDLE_REQUEST_CONTEXT;
  entry.object = std::move(state);
  return Register(std::move(entry));
}

int LB_CEF3_CALL LB_CEF3_RequestContextGetCachePath(
    LB_CEF3_HANDLE context, wchar_t* result, size_t capacity, size_t* required) {
  int status = 0;
  auto state = GetRequestContextState(context, status);
  if (!state) return status;
  return CopyWide(state->context->GetCachePath().ToWString(), result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_RequestContextHasPreference(LB_CEF3_HANDLE context, const wchar_t* name) {
  if (!name || !*name) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Preference名称不能为空");
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return status;
  auto value = std::make_shared<int>(0);
  if (!RunOnCefUiSync([state, value, preference = std::wstring(name)]() {
        *value = state->context->HasPreference(preference) ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_TIMEOUT, L"读取Preference是否存在超时");
  return *value;
}

int LB_CEF3_CALL LB_CEF3_RequestContextCanSetPreference(LB_CEF3_HANDLE context, const wchar_t* name) {
  if (!name || !*name) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Preference名称不能为空");
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return status;
  auto value = std::make_shared<int>(0);
  if (!RunOnCefUiSync([state, value, preference = std::wstring(name)]() {
        *value = state->context->CanSetPreference(preference) ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_TIMEOUT, L"读取Preference可写状态超时");
  return *value;
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetPreference(LB_CEF3_HANDLE context, const wchar_t* name) {
  if (!name || !*name) { Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Preference名称不能为空"); return 0; }
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return 0;
  auto value = std::make_shared<CefRefPtr<CefValue>>();
  if (!RunOnCefUiSync([state, value, preference = std::wstring(name)]() {
        *value = state->context->GetPreference(preference);
      })) { Fail(LB_CEF3_ERROR_TIMEOUT, L"读取Preference超时"); return 0; }
  if (!*value) { Fail(LB_CEF3_ERROR_NOT_FOUND, L"Preference不存在"); return 0; }
  return RegisterValue((*value)->Copy());
}

LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextGetAllPreferences(LB_CEF3_HANDLE context, int include_defaults) {
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return 0;
  auto value = std::make_shared<CefRefPtr<CefDictionaryValue>>();
  if (!RunOnCefUiSync([state, value, include_defaults]() {
        *value = state->context->GetAllPreferences(include_defaults != 0);
      })) { Fail(LB_CEF3_ERROR_TIMEOUT, L"读取全部Preference超时"); return 0; }
  if (!*value) { Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"读取全部Preference失败"); return 0; }
  return RegisterDictionary((*value)->Copy(false));
}

int LB_CEF3_CALL LB_CEF3_RequestContextSetPreference(
    LB_CEF3_HANDLE context, const wchar_t* name, LB_CEF3_HANDLE value) {
  if (!name || !*name) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Preference名称不能为空");
  int context_status = 0; auto state = GetRequestContextState(context, context_status); if (!state) return context_status;
  CefRefPtr<CefValue> copied;
  if (value != 0) {
    int value_status = 0; auto value_state = GetValueState(value, value_status); if (!value_state) return value_status;
    std::lock_guard<std::mutex> lock(value_state->mutex);
    copied = value_state->value->Copy();
  }
  auto success = std::make_shared<int>(0);
  auto error = std::make_shared<CefString>();
  if (!RunOnCefUiSync([state, copied, success, error, preference = std::wstring(name)]() {
        *success = state->context->SetPreference(preference, copied, *error) ? 1 : 0;
      })) return Fail(LB_CEF3_ERROR_TIMEOUT, L"设置Preference超时");
  return *success ? LB_CEF3_OK : Fail(LB_CEF3_ERROR_OPERATION_FAILED,
    error->empty() ? L"设置Preference失败" : error->ToWString());
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpCache(LB_CEF3_HANDLE context) {
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefCompletionCallback> callback = new BridgeCompletionCallback(task_state, L"{\"cleared\":true}");
  context_state->context->ClearHttpCache(callback);
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearCertificateExceptions(LB_CEF3_HANDLE context) {
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return 0;
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefCompletionCallback> callback = new BridgeCompletionCallback(task_state, L"{\"cleared\":true}");
  if (!PostToCefUi([state, callback]() { state->context->ClearCertificateExceptions(callback); }))
    CompleteTask(task_state, false, L"无法投递证书例外清理任务");
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextClearHttpAuthCredentials(LB_CEF3_HANDLE context) {
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return 0;
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefCompletionCallback> callback = new BridgeCompletionCallback(task_state, L"{\"cleared\":true}");
  if (!PostToCefUi([state, callback]() { state->context->ClearHttpAuthCredentials(callback); }))
    CompleteTask(task_state, false, L"无法投递HTTP认证清理任务");
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_RequestContextCloseAllConnections(LB_CEF3_HANDLE context) {
  int status = 0; auto state = GetRequestContextState(context, status); if (!state) return 0;
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefCompletionCallback> callback = new BridgeCompletionCallback(task_state, L"{\"closed\":true}");
  if (!PostToCefUi([state, callback]() { state->context->CloseAllConnections(callback); }))
    CompleteTask(task_state, false, L"无法投递连接关闭任务");
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieVisitAll(LB_CEF3_HANDLE context) {
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto manager = GetContextCookieManager(context_state);
  if (!manager) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"Cookie管理器不可用");
    return 0;
  }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<BridgeCookieVisitor> visitor = new BridgeCookieVisitor(task_state);
  if (!manager->VisitAllCookies(visitor)) {
    CompleteTask(task_state, false, L"无法读取Cookie");
  } else {
    visitor->MarkStarted();
  }
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieVisitUrl(
    LB_CEF3_HANDLE context, const wchar_t* url, int include_http_only) {
  if (!url || !*url) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Cookie地址不能为空");
    return 0;
  }
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto manager = GetContextCookieManager(context_state);
  if (!manager) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"Cookie管理器不可用");
    return 0;
  }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<BridgeCookieVisitor> visitor = new BridgeCookieVisitor(task_state);
  if (!manager->VisitUrlCookies(url, include_http_only != 0, visitor)) {
    CompleteTask(task_state, false, L"无法读取指定地址Cookie");
  } else {
    visitor->MarkStarted();
  }
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieSet(
    LB_CEF3_HANDLE context, const wchar_t* url, const wchar_t* name, const wchar_t* value,
    const wchar_t* domain, const wchar_t* path, int secure, int http_only, int64_t expires_unix_seconds) {
  if (!url || !*url || !name || !*name) {
    Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Cookie地址和名称不能为空");
    return 0;
  }
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto manager = GetContextCookieManager(context_state);
  if (!manager) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"Cookie管理器不可用");
    return 0;
  }
  CefCookie cookie;
  CefString(&cookie.name) = name;
  CefString(&cookie.value) = value ? value : L"";
  CefString(&cookie.domain) = domain ? domain : L"";
  CefString(&cookie.path) = path && *path ? path : L"/";
  cookie.secure = secure != 0;
  cookie.httponly = http_only != 0;
  if (expires_unix_seconds > 0) {
    CefTime expires(static_cast<time_t>(expires_unix_seconds));
    if (!cef_time_to_basetime(&expires, &cookie.expires)) {
      Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"Cookie过期时间无效");
      return 0;
    }
    cookie.has_expires = true;
  }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefSetCookieCallback> callback = new BridgeSetCookieCallback(task_state);
  if (!manager->SetCookie(url, cookie, callback)) CompleteTask(task_state, false, L"提交Cookie写入失败");
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieDelete(
    LB_CEF3_HANDLE context, const wchar_t* url, const wchar_t* name) {
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto manager = GetContextCookieManager(context_state);
  if (!manager) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"Cookie管理器不可用");
    return 0;
  }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefDeleteCookiesCallback> callback = new BridgeDeleteCookiesCallback(task_state);
  if (!manager->DeleteCookies(url ? url : L"", name ? name : L"", callback)) {
    CompleteTask(task_state, false, L"提交Cookie删除失败");
  }
  return task;
}

LB_CEF3_TASK_HANDLE LB_CEF3_CALL LB_CEF3_CookieFlush(LB_CEF3_HANDLE context) {
  int status = 0;
  auto context_state = GetRequestContextState(context, status);
  if (!context_state) return 0;
  auto manager = GetContextCookieManager(context_state);
  if (!manager) {
    Fail(LB_CEF3_ERROR_OPERATION_FAILED, L"Cookie管理器不可用");
    return 0;
  }
  auto [task, task_state] = CreateRunningTask();
  CefRefPtr<CefCompletionCallback> callback = new BridgeCompletionCallback(task_state, L"{\"flushed\":true}");
  if (!manager->FlushStore(callback)) CompleteTask(task_state, false, L"提交Cookie落盘失败");
  return task;
}

int LB_CEF3_CALL LB_CEF3_RequestContextRelease(LB_CEF3_HANDLE context) {
  return LB_CEF3_HandleRelease(context);
}

int LB_CEF3_CALL LB_CEF3_GetExtensionsForMimeType(
    const wchar_t* mime_type, wchar_t* result, size_t capacity, size_t* required) {
  if (!mime_type || !*mime_type) return Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"MIME类型不能为空");
  std::vector<CefString> extensions;
  CefGetExtensionsForMimeType(mime_type, extensions);
  std::vector<std::wstring> values;
  values.reserve(extensions.size());
  for (const auto& item : extensions) values.push_back(item.ToWString());
  return CopyWide(StringVectorJson(values), result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsSwitches(
    wchar_t* result, size_t capacity, size_t* required) {
  auto values = std::make_shared<std::vector<CefString>>();
  if (!RunOnCefUiSync([values]() { CefPreferenceManager::GetChromeVariationsAsSwitches(*values); }))
    return Fail(LB_CEF3_ERROR_TIMEOUT, L"读取Chrome Variations开关超时");
  std::vector<std::wstring> output;
  output.reserve(values->size());
  for (const auto& item : *values) output.push_back(item.ToWString());
  return CopyWide(StringVectorJson(output), result, capacity, required);
}

int LB_CEF3_CALL LB_CEF3_GetChromeVariationsAsStrings(
    wchar_t* result, size_t capacity, size_t* required) {
  auto values = std::make_shared<std::vector<CefString>>();
  if (!RunOnCefUiSync([values]() { CefPreferenceManager::GetChromeVariationsAsStrings(*values); }))
    return Fail(LB_CEF3_ERROR_TIMEOUT, L"读取Chrome Variations说明超时");
  std::vector<std::wstring> output;
  output.reserve(values->size());
  for (const auto& item : *values) output.push_back(item.ToWString());
  return CopyWide(StringVectorJson(output), result, capacity, required);
}

void LB_CEF3_CALL LB_CEF3_ShutdownRegistry(void) {
  std::unordered_map<LB_CEF3_HANDLE, HandleEntry> released_handles;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    released_handles.swap(g_handles);
    g_allowed_root.clear();
  }
  released_handles.clear();
}
