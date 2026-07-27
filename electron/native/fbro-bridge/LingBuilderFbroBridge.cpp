#include "LingBuilderFbroBridge.h"

#include "pch.h"
#include "FBroBaseType.h"
#include "FBroBrowser.h"
#include "FBroBrowserHost.h"
#include "FBroControl.h"
#include "FBroFrame.h"
#include "FBroHsBaseEvent.h"
#include "FBroHsEvent.h"
#include "FBroInit.h"
#include "FBroRequestContext.h"
#include "FBroString.h"
#include "FBroVIPStruct.h"
#include "FBroVIPControl.h"
#include "FBroVIPInterface.h"
#include "include/cef_parser.h"
#include "include/cef_task.h"

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cwctype>
#include <filesystem>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

struct BrowserState;
class BridgeBrowserEvent;

std::recursive_mutex g_mutex;
std::condition_variable_any g_close_condition;
std::unordered_map<LB_FBRO_HANDLE, std::unique_ptr<BrowserState>> g_browsers;
std::atomic<LB_FBRO_HANDLE> g_next_handle{1};
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

struct BrowserState {
  LB_FBRO_HANDLE handle = 0;
  HWND host = nullptr;
  std::wstring url;
  std::wstring profile;
  std::wstring title;
  std::wstring user_agent;
  std::wstring last_event;
  std::wstring last_error;
  LB_FBRO_EVENT_CALLBACK callback = nullptr;
  void* user_data = nullptr;
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

void Notify(BrowserState& state, int code, const std::wstring& data) {
  state.last_event = data;
  if (code == LB_FBRO_EVENT_ERROR) state.last_error = data;
  const auto callback = state.callback;
  if (callback) callback(state.handle, code, data.c_str(), state.user_data);
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
    std::lock_guard<std::recursive_mutex> lock(g_mutex);
    if (auto* state = Find(handle_)) {
      Notify(*state, LB_FBRO_EVENT_BEFORE_POPUP, target_url.ToWString());
    }
    // Cancel the popup. LingBuilder dispatches the URL to the bound LCPP event,
    // where the project can navigate the existing browser instance instead.
    return true;
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

}  // namespace

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
int __stdcall LB_FBro_Stop(LB_FBRO_HANDLE browser) { return WithBrowser(browser, [](auto value) { FBroHsBrowser_StopLoad(value); }); }
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
  g_browsers.clear(); g_init_event = nullptr; g_ready = false; g_initialized = false;
  if (g_winsock_started) { WSACleanup(); g_winsock_started = false; }
}
