#include "LingBuilderCefBridge.h"

#include <array>
#include <atomic>
#include <cassert>
#include <cmath>
#include <filesystem>
#include <string>

#include <windows.h>

namespace {

std::atomic<int> g_browser_created_events{0};
std::atomic<int> g_console_events{0};

void LB_CEF3_CALL TestEventCallback(const LB_CEF3_EVENT_PACKET_V3* packet,
                                    LB_CEF3_EVENT_RESPONSE_V3* response, void*) {
  assert(packet != nullptr);
  assert(packet->abi_version == LB_CEF3_ABI_VERSION_V3);
  assert(packet->event_name != nullptr);
  assert(packet->fields_json != nullptr);
  if (std::wstring(packet->event_name) == L"浏览器创建完成") ++g_browser_created_events;
  if (std::wstring(packet->event_name) == L"控制台消息") {
    assert(std::wstring(packet->fields_json).find(L"bridge-event-test") != std::wstring::npos);
    ++g_console_events;
    if (response) response->action = 3;
  }
}

int WaitTask(LB_CEF3_TASK_HANDLE task, DWORD timeout_milliseconds = 5000) {
  const auto deadline = GetTickCount64() + timeout_milliseconds;
  int status = LB_CEF3_TaskGetStatus(task);
  while ((status == LB_CEF3_TASK_PENDING || status == LB_CEF3_TASK_RUNNING) && GetTickCount64() < deadline) {
    Sleep(10);
    status = LB_CEF3_TaskGetStatus(task);
  }
  return status;
}

std::wstring TaskResult(LB_CEF3_TASK_HANDLE task) {
  size_t required = 0;
  if (LB_CEF3_TaskGetResult(task, nullptr, 0, &required) != LB_CEF3_ERROR_BUFFER_TOO_SMALL || required == 0) return L"";
  std::wstring result(required, L'\0');
  if (LB_CEF3_TaskGetResult(task, result.data(), result.size(), &required) != LB_CEF3_OK) return L"";
  result.resize(wcslen(result.c_str()));
  return result;
}

}  // namespace

int wmain() {
  const auto application_instance = reinterpret_cast<uint64_t>(GetModuleHandleW(nullptr));
  const int subprocess_exit = LB_CEF3_ExecuteSubProcess(application_instance);
  if (subprocess_exit >= 0) return subprocess_exit;
  assert(LB_CEF3_GetAbiVersion() == LB_CEF3_ABI_VERSION_V3);
  assert(LB_CEF3_IsInitialized() == 0);
  assert(LB_CEF3_BrowserCreate(nullptr) == 0);
  assert(LB_CEF3_HandleIsValid(0, LB_CEF3_HANDLE_BROWSER) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_INITIALIZE_CONFIG_V3 invalid_config{};
  invalid_config.struct_size = sizeof(invalid_config);
  invalid_config.abi_version = LB_CEF3_ABI_VERSION_V3;
  assert(LB_CEF3_Initialize(&invalid_config) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::array<wchar_t, 128> version{};
  size_t required = 0;
  assert(LB_CEF3_GetCefVersion(version.data(), version.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(version.data()).rfind(L"150.", 0) == 0);

  std::array<wchar_t, 32768> sdk_root_text{};
  const auto sdk_root_length = GetEnvironmentVariableW(L"LB_CEF3_TEST_SDK_ROOT", sdk_root_text.data(), static_cast<DWORD>(sdk_root_text.size()));
  assert(sdk_root_length > 0 && sdk_root_length < sdk_root_text.size());
  const std::filesystem::path sdk_root(sdk_root_text.data());
  const auto root = std::filesystem::temp_directory_path() / L"lingbuilder-cef3-bridge-test";
  std::filesystem::remove_all(root);
  std::filesystem::create_directories(root);
  const auto resources = sdk_root / L"Resources";
  const auto locales = resources / L"locales";
  std::array<wchar_t, 32768> executable_text{};
  const auto executable_length = GetModuleFileNameW(nullptr, executable_text.data(), static_cast<DWORD>(executable_text.size()));
  assert(executable_length > 0 && executable_length < executable_text.size());
  const std::filesystem::path executable(executable_text.data());
  LB_CEF3_INITIALIZE_CONFIG_V3 config{};
  config.struct_size = sizeof(config);
  config.abi_version = LB_CEF3_ABI_VERSION_V3;
  config.application_instance = application_instance;
  config.root_cache_path = root.c_str();
  config.resources_path = resources.c_str();
  config.locales_path = locales.c_str();
  config.subprocess_path = executable.c_str();
  config.event_callback = TestEventCallback;
  assert(LB_CEF3_Initialize(&config) == LB_CEF3_OK);
  assert(LB_CEF3_IsInitialized() == 1);

  const unsigned char input[] = {0x00, 0x7f, 0xff};
  const auto first = LB_CEF3_BufferCreate(input, sizeof(input));
  assert(first != 0);
  assert(LB_CEF3_HandleGetType(first) == LB_CEF3_HANDLE_BUFFER);
  std::array<wchar_t, 16> hex{};
  assert(LB_CEF3_BufferToHex(first, hex.data(), hex.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(hex.data()) == L"007fff");
  assert(LB_CEF3_BufferRelease(first) == LB_CEF3_OK);
  assert(LB_CEF3_HandleIsValid(first, LB_CEF3_HANDLE_BUFFER) == LB_CEF3_ERROR_RELEASED_HANDLE);
  const auto second = LB_CEF3_BufferCreate(input, sizeof(input));
  assert(second != first);

  assert(LB_CEF3_SetAllowedFileRoot(root.c_str()) == LB_CEF3_OK);
  const auto file = root / L"buffer.bin";
  assert(LB_CEF3_BufferSaveFile(second, file.c_str()) == LB_CEF3_OK);
  const auto loaded = LB_CEF3_BufferLoadFile(file.c_str());
  assert(loaded != 0);
  const auto buffer_clone = LB_CEF3_BufferClone(second);
  assert(buffer_clone != 0);
  assert(LB_CEF3_BufferIsValid(second) == 1);
  assert(LB_CEF3_BufferIsOwned(second) == 0);
  assert(LB_CEF3_BufferIsSame(second, second) == 1);
  assert(LB_CEF3_BufferIsSame(second, buffer_clone) == 0);
  assert(LB_CEF3_BufferIsEqual(second, buffer_clone) == 1);
  assert(LB_CEF3_BufferSaveFile(second, (root.parent_path() / L"denied.bin").c_str()) == LB_CEF3_ERROR_PATH_DENIED);

  const auto task = LB_CEF3_TaskCreate();
  assert(LB_CEF3_TaskGetStatus(task) == LB_CEF3_TASK_PENDING);
  assert(LB_CEF3_TaskSetRunning(task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskSetResult(task, L"{\"ok\":true}") == LB_CEF3_OK);
  std::array<wchar_t, 64> task_result{};
  assert(LB_CEF3_TaskGetResult(task, task_result.data(), task_result.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(task_result.data()) == L"{\"ok\":true}");
  assert(LB_CEF3_TaskRelease(task) == LB_CEF3_OK);

  const auto host_a = CreateWindowExW(0, L"STATIC", L"CEF3测试A", WS_OVERLAPPEDWINDOW,
                                      0, 0, 320, 240, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
  const auto host_b = CreateWindowExW(0, L"STATIC", L"CEF3测试B", WS_OVERLAPPEDWINDOW,
                                      0, 0, 320, 240, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
  assert(host_a != nullptr && host_b != nullptr);
  LB_CEF3_BROWSER_CONFIG_V3 browser_config_a{};
  browser_config_a.struct_size = sizeof(browser_config_a);
  browser_config_a.abi_version = LB_CEF3_ABI_VERSION_V3;
  browser_config_a.parent_window = reinterpret_cast<uint64_t>(host_a);
  browser_config_a.user_token = 101;
  browser_config_a.flags = LB_CEF3_BROWSER_JAVASCRIPT;
  browser_config_a.initial_url = L"about:blank";
  browser_config_a.profile_key = L"native-test-a";
  browser_config_a.proxy_mode = L"direct";
  auto browser_a = LB_CEF3_BrowserCreate(&browser_config_a);
  assert(browser_a != 0);
  auto browser_config_b = browser_config_a;
  browser_config_b.parent_window = reinterpret_cast<uint64_t>(host_b);
  browser_config_b.user_token = 102;
  browser_config_b.profile_key = L"native-test-b";
  auto browser_b = LB_CEF3_BrowserCreate(&browser_config_b);
  assert(browser_b != 0);
  const auto browser_deadline = GetTickCount64() + 5000;
  while (g_browser_created_events.load() < 2 && GetTickCount64() < browser_deadline) Sleep(10);
  assert(g_browser_created_events.load() >= 2);
  LB_CEF3_HANDLE navigation_entry = 0;
  const auto navigation_deadline = GetTickCount64() + 5000;
  while (navigation_entry == 0 && GetTickCount64() < navigation_deadline) {
    navigation_entry = LB_CEF3_BrowserGetVisibleNavigationEntry(browser_a);
    if (navigation_entry == 0) Sleep(10);
  }
  assert(navigation_entry != 0);
  assert(LB_CEF3_HandleGetType(navigation_entry) == LB_CEF3_HANDLE_NAVIGATION_ENTRY);
  assert(LB_CEF3_NavigationEntryIsValid(navigation_entry) == 1);
  std::array<wchar_t, 128> navigation_url{};
  assert(LB_CEF3_NavigationEntryGetUrl(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(navigation_url.data()) == L"about:blank");
  assert(LB_CEF3_NavigationEntryGetDisplayUrl(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetOriginalUrl(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetTitle(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetTransitionType(navigation_entry) >= 0);
  assert(LB_CEF3_NavigationEntryHasPostData(navigation_entry) == 0);
  assert(LB_CEF3_NavigationEntryGetCompletionTime(navigation_entry) >= 0.0);
  assert(LB_CEF3_NavigationEntryGetHttpStatusCode(navigation_entry) >= 0);
  assert(LB_CEF3_NavigationEntryRelease(navigation_entry) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserLoadUrl(browser_a, L"https://example.com/") == LB_CEF3_OK);
  LB_CEF3_HANDLE certificate = 0;
  const auto certificate_deadline = GetTickCount64() + 15000;
  while (certificate == 0 && GetTickCount64() < certificate_deadline) {
    certificate = LB_CEF3_BrowserGetCurrentCertificate(browser_a);
    if (certificate == 0) Sleep(50);
  }
  assert(certificate != 0);
  assert(LB_CEF3_HandleGetType(certificate) == LB_CEF3_HANDLE_CERTIFICATE);
  assert(LB_CEF3_CertificateIsSecureConnection(certificate) == 1);
  assert(LB_CEF3_CertificateGetCertStatus(certificate) >= 0);
  assert(LB_CEF3_CertificateGetSslVersion(certificate) >= 0);
  assert(LB_CEF3_CertificateGetContentStatus(certificate) >= 0);
  const auto subject = LB_CEF3_CertificateGetSubject(certificate);
  const auto issuer = LB_CEF3_CertificateGetIssuer(certificate);
  assert(subject != 0 && issuer != 0);
  assert(LB_CEF3_HandleGetType(subject) == LB_CEF3_HANDLE_CERTIFICATE_PRINCIPAL);
  std::array<wchar_t, 512> principal_text{};
  assert(LB_CEF3_CertificatePrincipalGetDisplayName(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(principal_text.data()).find(L"example") != std::wstring::npos);
  assert(LB_CEF3_CertificatePrincipalGetCommonName(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_CertificatePrincipalGetLocalityName(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_CertificatePrincipalGetStateOrProvinceName(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_CertificatePrincipalGetCountryName(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_CertificatePrincipalGetOrganizationNamesJson(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_CertificatePrincipalGetOrganizationUnitNamesJson(subject, principal_text.data(), principal_text.size(), &required) == LB_CEF3_OK);
  const auto serial = LB_CEF3_CertificateGetSerialNumber(certificate);
  const auto der = LB_CEF3_CertificateGetDerEncoded(certificate);
  const auto pem = LB_CEF3_CertificateGetPemEncoded(certificate);
  assert(serial != 0 && der != 0 && pem != 0);
  uint64_t certificate_size = 0;
  assert(LB_CEF3_BufferGetSize(serial, &certificate_size) == LB_CEF3_OK && certificate_size > 0);
  assert(LB_CEF3_BufferGetSize(der, &certificate_size) == LB_CEF3_OK && certificate_size > 0);
  assert(LB_CEF3_BufferGetSize(pem, &certificate_size) == LB_CEF3_OK && certificate_size > 0);
  assert(LB_CEF3_CertificateGetValidStart(certificate) > 0);
  assert(LB_CEF3_CertificateGetValidExpiry(certificate) > LB_CEF3_CertificateGetValidStart(certificate));
  const auto chain_size = LB_CEF3_CertificateGetIssuerChainSize(certificate);
  assert(chain_size >= 0);
  if (chain_size > 0) {
    const auto der_chain = LB_CEF3_CertificateGetDerIssuerChainItem(certificate, 0);
    const auto pem_chain = LB_CEF3_CertificateGetPemIssuerChainItem(certificate, 0);
    assert(der_chain != 0 && pem_chain != 0);
    LB_CEF3_BufferRelease(der_chain);
    LB_CEF3_BufferRelease(pem_chain);
  }
  LB_CEF3_BufferRelease(serial);
  LB_CEF3_BufferRelease(der);
  LB_CEF3_BufferRelease(pem);
  LB_CEF3_CertificatePrincipalRelease(subject);
  LB_CEF3_CertificatePrincipalRelease(issuer);
  LB_CEF3_CertificateRelease(certificate);
  const auto navigation_history = LB_CEF3_BrowserGetNavigationEntries(browser_a, 0);
  assert(navigation_history != 0);
  assert(WaitTask(navigation_history) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(navigation_history).find(L"example.com") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(navigation_history) == LB_CEF3_OK);
  const auto javascript_task = LB_CEF3_BrowserEvaluateJavaScript(browser_a, L"console.log('bridge-event-test'); 'ok'");
  assert(javascript_task != 0);
  assert(WaitTask(javascript_task) == LB_CEF3_TASK_SUCCEEDED);
  const auto console_deadline = GetTickCount64() + 5000;
  while (g_console_events.load() < 1 && GetTickCount64() < console_deadline) Sleep(10);
  assert(g_console_events.load() >= 1);
  assert(LB_CEF3_TaskRelease(javascript_task) == LB_CEF3_OK);
  const auto context_a = LB_CEF3_BrowserGetRequestContext(browser_a);
  const auto context_b = LB_CEF3_BrowserGetRequestContext(browser_b);
  assert(context_a != 0 && context_b != 0);
  assert(LB_CEF3_HandleGetType(context_a) == LB_CEF3_HANDLE_REQUEST_CONTEXT);
  std::array<wchar_t, 1024> cache_a{};
  std::array<wchar_t, 1024> cache_b{};
  assert(LB_CEF3_RequestContextGetCachePath(context_a, cache_a.data(), cache_a.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetCachePath(context_b, cache_b.data(), cache_b.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(cache_a.data()) != std::wstring(cache_b.data()));
  assert(LB_CEF3_RequestContextHasPreference(context_a, L"proxy") == 1);
  assert(LB_CEF3_RequestContextCanSetPreference(context_a, L"proxy") == 1);
  const auto proxy_preference = LB_CEF3_RequestContextGetPreference(context_a, L"proxy");
  const auto all_preferences = LB_CEF3_RequestContextGetAllPreferences(context_a, 0);
  assert(proxy_preference != 0 && all_preferences != 0);
  assert(LB_CEF3_HandleGetType(proxy_preference) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_HandleGetType(all_preferences) == LB_CEF3_HANDLE_DICTIONARY);
  assert(LB_CEF3_RequestContextSetPreference(context_a, L"proxy", 0) == LB_CEF3_OK);
  LB_CEF3_ValueRelease(proxy_preference);
  LB_CEF3_DictionaryRelease(all_preferences);

  std::array<wchar_t, 2048> platform_json{};
  assert(LB_CEF3_GetExtensionsForMimeType(L"text/html", platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(platform_json.data()).find(L"html") != std::wstring::npos);
  assert(LB_CEF3_GetChromeVariationsAsSwitches(platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_GetChromeVariationsAsStrings(platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);

  const auto set_cookie = LB_CEF3_CookieSet(context_a, L"https://lingbuilder.test/", L"isolated", L"alpha",
                                             L"", L"/", 1, 1, 0);
  assert(set_cookie != 0);
  assert(WaitTask(set_cookie) == LB_CEF3_TASK_SUCCEEDED);
  const auto flush_cookie = LB_CEF3_CookieFlush(context_a);
  assert(flush_cookie != 0);
  assert(WaitTask(flush_cookie) == LB_CEF3_TASK_SUCCEEDED);
  const auto cookies_a = LB_CEF3_CookieVisitUrl(context_a, L"https://lingbuilder.test/", 1);
  const auto cookies_b = LB_CEF3_CookieVisitUrl(context_b, L"https://lingbuilder.test/", 1);
  assert(cookies_a != 0 && cookies_b != 0);
  assert(WaitTask(cookies_a) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(cookies_b) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(cookies_a).find(L"\"isolated\"") != std::wstring::npos);
  assert(TaskResult(cookies_b) == L"[]");
  const auto clear_cache = LB_CEF3_RequestContextClearHttpCache(context_a);
  assert(clear_cache != 0);
  assert(WaitTask(clear_cache) == LB_CEF3_TASK_SUCCEEDED);
  const auto delete_cookie = LB_CEF3_CookieDelete(context_a, L"https://lingbuilder.test/", L"isolated");
  assert(delete_cookie != 0);
  assert(WaitTask(delete_cookie) == LB_CEF3_TASK_SUCCEEDED);
  const auto clear_certificates = LB_CEF3_RequestContextClearCertificateExceptions(context_a);
  const auto clear_auth = LB_CEF3_RequestContextClearHttpAuthCredentials(context_a);
  const auto close_connections = LB_CEF3_RequestContextCloseAllConnections(context_a);
  assert(clear_certificates != 0 && clear_auth != 0 && close_connections != 0);
  assert(WaitTask(clear_certificates) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(clear_auth) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(close_connections) == LB_CEF3_TASK_SUCCEEDED);
  for (const auto session_task : {set_cookie, flush_cookie, cookies_a, cookies_b, clear_cache, delete_cookie,
                                  clear_certificates, clear_auth, close_connections}) {
    assert(LB_CEF3_TaskRelease(session_task) == LB_CEF3_OK);
  }

  const auto value = LB_CEF3_ValueCreate();
  assert(value != 0);
  assert(LB_CEF3_HandleGetType(value) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_ValueGetType(value) == LB_CEF3_VALUE_NULL);
  assert(LB_CEF3_ValueSetInt(value, -42) == LB_CEF3_OK);
  int integer = 0;
  assert(LB_CEF3_ValueGetInt(value, &integer) == LB_CEF3_OK);
  assert(integer == -42);
  assert(LB_CEF3_ValueGetBool(value) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ValueSetDouble(value, 3.5) == LB_CEF3_OK);
  double decimal = 0.0;
  assert(LB_CEF3_ValueGetDouble(value, &decimal) == LB_CEF3_OK);
  assert(std::abs(decimal - 3.5) < 0.0001);
  assert(LB_CEF3_ValueSetString(value, L"中文值") == LB_CEF3_OK);
  std::array<wchar_t, 64> value_text{};
  assert(LB_CEF3_ValueGetString(value, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()) == L"中文值");
  assert(LB_CEF3_ValueSetBuffer(value, second) == LB_CEF3_OK);
  const auto value_buffer = LB_CEF3_ValueGetBuffer(value);
  assert(value_buffer != 0);
  std::array<unsigned char, 3> copied{};
  size_t copied_size = 0;
  assert(LB_CEF3_BufferCopy(value_buffer, copied.data(), copied.size(), &copied_size) == LB_CEF3_OK);
  assert(copied_size == sizeof(input));
  const std::array<unsigned char, 3> expected_copy{0x00, 0x7f, 0xff};
  assert(copied == expected_copy);
  assert(LB_CEF3_ValueIsValid(value) == 1);
  assert(LB_CEF3_ValueIsOwned(value) == 0);
  assert(LB_CEF3_ValueIsReadOnly(value) == 0);
  const auto value_copy = LB_CEF3_ValueCopy(value);
  assert(value_copy != 0);
  assert(LB_CEF3_ValueIsSame(value, value) == 1);
  assert(LB_CEF3_ValueIsSame(value, value_copy) == 0);
  assert(LB_CEF3_ValueIsEqual(value, value_copy) == 1);

  const auto dictionary_value = LB_CEF3_ValueCreate();
  assert(LB_CEF3_ValueSetString(dictionary_value, L"初始") == LB_CEF3_OK);
  const auto dictionary = LB_CEF3_DictionaryCreate();
  assert(dictionary != 0);
  assert(LB_CEF3_DictionarySetValue(dictionary, L"name", dictionary_value) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryGetSize(dictionary) == 1);
  assert(LB_CEF3_DictionaryHasKey(dictionary, L"name") == 1);
  assert(LB_CEF3_DictionaryGetType(dictionary, L"name") == LB_CEF3_VALUE_STRING);
  assert(LB_CEF3_ValueSetString(dictionary_value, L"已修改") == LB_CEF3_OK);
  const auto copied_value = LB_CEF3_DictionaryGetValue(dictionary, L"name");
  assert(copied_value != 0);
  value_text.fill(L'\0');
  assert(LB_CEF3_ValueGetString(copied_value, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()) == L"初始");
  std::array<wchar_t, 128> json{};
  assert(LB_CEF3_DictionaryGetKeysJson(dictionary, json.data(), json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(json.data()) == L"[\"name\"]");
  assert(LB_CEF3_DictionaryToJson(dictionary, json.data(), json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(json.data()) == L"{\"name\":\"初始\"}");
  assert(LB_CEF3_DictionaryIsValid(dictionary) == 1);
  assert(LB_CEF3_DictionaryIsOwned(dictionary) == 0);
  assert(LB_CEF3_DictionaryIsReadOnly(dictionary) == 0);
  const auto dictionary_copy = LB_CEF3_DictionaryCopy(dictionary, 0);
  assert(dictionary_copy != 0);
  assert(LB_CEF3_DictionaryIsSame(dictionary, dictionary) == 1);
  assert(LB_CEF3_DictionaryIsSame(dictionary, dictionary_copy) == 0);
  assert(LB_CEF3_DictionaryIsEqual(dictionary, dictionary_copy) == 1);

  const auto nested_value = LB_CEF3_ValueCreate();
  assert(LB_CEF3_ValueSetDictionary(nested_value, dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ValueGetType(nested_value) == LB_CEF3_VALUE_DICTIONARY);
  const auto nested_dictionary = LB_CEF3_ValueGetDictionary(nested_value);
  assert(nested_dictionary != 0);
  assert(LB_CEF3_DictionaryIsEqual(dictionary, nested_dictionary) == 1);

  const auto list = LB_CEF3_ListCreate();
  assert(list != 0);
  assert(LB_CEF3_ValueSetInt(value, -42) == LB_CEF3_OK);
  assert(LB_CEF3_ListSetSize(list, 2) == LB_CEF3_OK);
  assert(LB_CEF3_ListSetValue(list, 0, dictionary_value) == LB_CEF3_OK);
  assert(LB_CEF3_ListSetValue(list, 1, value) == LB_CEF3_OK);
  assert(LB_CEF3_ListGetSize(list) == 2);
  assert(LB_CEF3_ListGetType(list, 0) == LB_CEF3_VALUE_STRING);
  assert(LB_CEF3_ListGetType(list, 2) == LB_CEF3_ERROR_NOT_FOUND);
  const auto list_value = LB_CEF3_ListGetValue(list, 0);
  assert(list_value != 0);
  value_text.fill(L'\0');
  assert(LB_CEF3_ValueGetString(list_value, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()) == L"已修改");
  assert(LB_CEF3_ListToJson(list, json.data(), json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(json.data()) == L"[\"已修改\",-42]");
  assert(LB_CEF3_ListIsValid(list) == 1);
  assert(LB_CEF3_ListIsOwned(list) == 0);
  assert(LB_CEF3_ListIsReadOnly(list) == 0);
  const auto list_copy = LB_CEF3_ListCopy(list);
  assert(list_copy != 0);
  assert(LB_CEF3_ListIsSame(list, list) == 1);
  assert(LB_CEF3_ListIsSame(list, list_copy) == 0);
  assert(LB_CEF3_ListIsEqual(list, list_copy) == 1);
  assert(LB_CEF3_ValueSetList(nested_value, list) == LB_CEF3_OK);
  assert(LB_CEF3_ValueGetType(nested_value) == LB_CEF3_VALUE_LIST);
  const auto nested_list = LB_CEF3_ValueGetList(nested_value);
  assert(nested_list != 0);
  assert(LB_CEF3_ListIsEqual(list, nested_list) == 1);
  assert(LB_CEF3_ListRemove(list, 0) == LB_CEF3_OK);
  assert(LB_CEF3_ListGetSize(list) == 1);
  assert(LB_CEF3_ListClear(list) == LB_CEF3_OK);
  assert(LB_CEF3_ListGetSize(list) == 0);

  const auto menu = LB_CEF3_MenuCreate();
  assert(menu != 0);
  assert(LB_CEF3_HandleGetType(menu) == LB_CEF3_HANDLE_MENU);
  assert(LB_CEF3_MenuIsSubMenu(menu) == 0);
  assert(LB_CEF3_MenuAddItem(menu, 1, L"普通") == LB_CEF3_OK);
  assert(LB_CEF3_MenuAddCheckItem(menu, 2, L"勾选") == LB_CEF3_OK);
  assert(LB_CEF3_MenuAddRadioItem(menu, 3, L"单选", 7) == LB_CEF3_OK);
  assert(LB_CEF3_MenuAddSeparator(menu) == LB_CEF3_OK);
  const auto menu_child = LB_CEF3_MenuAddSubMenu(menu, 4, L"子菜单");
  assert(menu_child != 0 && LB_CEF3_MenuIsSubMenu(menu_child) == 1);
  assert(LB_CEF3_MenuGetCount(menu) == 5);
  assert(LB_CEF3_MenuGetIndexOf(menu, 1) == 0);
  assert(LB_CEF3_MenuGetCommandIdAt(menu, 0) == 1);
  assert(LB_CEF3_MenuSetCommandIdAt(menu, 0, 11) == LB_CEF3_OK);
  assert(LB_CEF3_MenuSetLabel(menu, 11, L"已修改") == LB_CEF3_OK);
  value_text.fill(L'\0');
  assert(LB_CEF3_MenuGetLabel(menu, 11, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()) == L"已修改");
  assert(LB_CEF3_MenuGetType(menu, 11) >= 0);
  assert(LB_CEF3_MenuGetGroupId(menu, 3) == 7);
  assert(LB_CEF3_MenuSetGroupId(menu, 3, 8) == LB_CEF3_OK);
  assert(LB_CEF3_MenuGetGroupId(menu, 3) == 8);
  assert(LB_CEF3_MenuIsVisible(menu, 11) == 1);
  assert(LB_CEF3_MenuSetVisible(menu, 11, 0) == LB_CEF3_OK);
  assert(LB_CEF3_MenuIsVisible(menu, 11) == 0);
  assert(LB_CEF3_MenuIsEnabled(menu, 11) == 1);
  assert(LB_CEF3_MenuSetEnabled(menu, 11, 0) == LB_CEF3_OK);
  assert(LB_CEF3_MenuIsEnabled(menu, 11) == 0);
  assert(LB_CEF3_MenuSetChecked(menu, 2, 1) == LB_CEF3_OK);
  assert(LB_CEF3_MenuIsChecked(menu, 2) == 1);
  const auto menu_child_lookup = LB_CEF3_MenuGetSubMenu(menu, 4);
  assert(menu_child_lookup != 0 && LB_CEF3_MenuIsSubMenu(menu_child_lookup) == 1);
  assert(LB_CEF3_MenuInsertItemAt(menu, 0, 20, L"索引项目") == LB_CEF3_OK);
  assert(LB_CEF3_MenuInsertCheckItemAt(menu, 1, 21, L"索引勾选") == LB_CEF3_OK);
  assert(LB_CEF3_MenuInsertRadioItemAt(menu, 2, 22, L"索引单选", 9) == LB_CEF3_OK);
  assert(LB_CEF3_MenuInsertSeparatorAt(menu, 3) == LB_CEF3_OK);
  const auto inserted_child = LB_CEF3_MenuInsertSubMenuAt(menu, 4, 23, L"索引子菜单");
  assert(inserted_child != 0);
  assert(LB_CEF3_MenuSetLabelAt(menu, 0, L"索引已修改") == LB_CEF3_OK);
  value_text.fill(L'\0');
  assert(LB_CEF3_MenuGetLabelAt(menu, 0, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()) == L"索引已修改");
  assert(LB_CEF3_MenuGetTypeAt(menu, 0) >= 0);
  assert(LB_CEF3_MenuGetGroupIdAt(menu, 2) == 9);
  assert(LB_CEF3_MenuSetGroupIdAt(menu, 2, 10) == LB_CEF3_OK);
  assert(LB_CEF3_MenuGetGroupIdAt(menu, 2) == 10);
  const auto inserted_child_lookup = LB_CEF3_MenuGetSubMenuAt(menu, 4);
  assert(inserted_child_lookup != 0);
  assert(LB_CEF3_MenuSetVisibleAt(menu, 0, 0) == LB_CEF3_OK && LB_CEF3_MenuIsVisibleAt(menu, 0) == 0);
  assert(LB_CEF3_MenuSetEnabledAt(menu, 0, 0) == LB_CEF3_OK && LB_CEF3_MenuIsEnabledAt(menu, 0) == 0);
  assert(LB_CEF3_MenuSetCheckedAt(menu, 1, 1) == LB_CEF3_OK && LB_CEF3_MenuIsCheckedAt(menu, 1) == 1);
  assert(LB_CEF3_MenuSetAccelerator(menu, 20, 'K', 1, 1, 0) == LB_CEF3_OK);
  assert(LB_CEF3_MenuHasAccelerator(menu, 20) == 1 && LB_CEF3_MenuHasAcceleratorAt(menu, 0) == 1);
  value_text.fill(L'\0');
  assert(LB_CEF3_MenuGetAcceleratorJson(menu, 20, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(value_text.data()).find(L"\"keyCode\":75") != std::wstring::npos);
  assert(LB_CEF3_MenuGetAcceleratorAtJson(menu, 0, value_text.data(), value_text.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRemoveAcceleratorAt(menu, 0) == LB_CEF3_OK);
  assert(LB_CEF3_MenuSetAcceleratorAt(menu, 0, 'L', 0, 1, 0) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRemoveAccelerator(menu, 20) == LB_CEF3_OK);
  assert(LB_CEF3_MenuSetColor(menu, 20, 0, 0xff112233u) == LB_CEF3_OK);
  assert(LB_CEF3_MenuGetColor(menu, 20, 0) == 0xff112233u);
  assert(LB_CEF3_MenuSetColorAt(menu, 0, 0, 0xff334455u) == LB_CEF3_OK);
  assert(LB_CEF3_MenuGetColorAt(menu, 0, 0) == 0xff334455u);
  assert(LB_CEF3_MenuSetFontList(menu, 20, L"Arial, 14px") == LB_CEF3_OK);
  assert(LB_CEF3_MenuSetFontListAt(menu, 0, L"Arial, Bold 14px") == LB_CEF3_OK);
  assert(LB_CEF3_MenuRemoveAt(menu, 3) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRemove(menu, 11) == LB_CEF3_OK);
  assert(LB_CEF3_MenuClear(menu) == LB_CEF3_OK);
  assert(LB_CEF3_MenuGetCount(menu) == 0);
  assert(LB_CEF3_MenuRelease(menu_child) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRelease(menu_child_lookup) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRelease(inserted_child) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRelease(inserted_child_lookup) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRelease(menu) == LB_CEF3_OK);

  const unsigned char red_pixel[] = {0x00, 0x00, 0xff, 0xff};
  const auto pixel_buffer = LB_CEF3_BufferCreate(red_pixel, sizeof(red_pixel));
  const auto image = LB_CEF3_ImageCreate();
  const auto other_image = LB_CEF3_ImageCreate();
  assert(image != 0 && other_image != 0);
  assert(LB_CEF3_ImageIsEmpty(image) == 1);
  assert(LB_CEF3_ImageIsSame(image, other_image) == 1);
  assert(LB_CEF3_ImageAddBitmap(image, 1.0, 1, 1, 1, 1, pixel_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_ImageIsEmpty(image) == 0);
  assert(LB_CEF3_ImageIsSame(image, other_image) == 0);
  assert(LB_CEF3_ImageGetWidth(image) == 1);
  assert(LB_CEF3_ImageGetHeight(image) == 1);
  assert(LB_CEF3_ImageHasRepresentation(image, 1.0) == 1);
  assert(LB_CEF3_ImageGetRepresentationInfo(image, 1.0, json.data(), json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(json.data()).find(L"\"width\":1") != std::wstring::npos);
  const auto image_bitmap = LB_CEF3_ImageGetAsBitmap(image, 1.0, 1, 1);
  const auto image_png = LB_CEF3_ImageGetAsPng(image, 1.0, 1);
  const auto image_jpeg = LB_CEF3_ImageGetAsJpeg(image, 1.0, 90);
  assert(image_bitmap != 0 && image_png != 0 && image_jpeg != 0);
  uint64_t image_size = 0;
  assert(LB_CEF3_BufferGetSize(image_bitmap, &image_size) == LB_CEF3_OK && image_size == 4);
  assert(LB_CEF3_BufferGetSize(image_png, &image_size) == LB_CEF3_OK && image_size > 4);
  assert(LB_CEF3_BufferGetSize(image_jpeg, &image_size) == LB_CEF3_OK && image_size > 4);
  assert(LB_CEF3_ImageRemoveRepresentation(image, 1.0) == LB_CEF3_OK);
  assert(LB_CEF3_ImageIsEmpty(image) == 1);

  assert(LB_CEF3_DictionarySetValue(dictionary, L"bad", dictionary) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_DictionaryRemove(dictionary, L"name") == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryClear(dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_ERROR_RELEASED_HANDLE);

  LB_CEF3_ValueRelease(value);
  LB_CEF3_ValueRelease(dictionary_value);
  LB_CEF3_ValueRelease(copied_value);
  LB_CEF3_ValueRelease(list_value);
  LB_CEF3_ValueRelease(value_copy);
  LB_CEF3_ValueRelease(nested_value);
  LB_CEF3_DictionaryRelease(dictionary_copy);
  LB_CEF3_DictionaryRelease(nested_dictionary);
  LB_CEF3_ListRelease(list_copy);
  LB_CEF3_ListRelease(nested_list);
  LB_CEF3_ListRelease(list);
  LB_CEF3_BufferRelease(value_buffer);
  LB_CEF3_BufferRelease(pixel_buffer);
  LB_CEF3_BufferRelease(image_bitmap);
  LB_CEF3_BufferRelease(image_png);
  LB_CEF3_BufferRelease(image_jpeg);
  LB_CEF3_ImageRelease(image);
  LB_CEF3_ImageRelease(other_image);
  LB_CEF3_RequestContextRelease(context_a);
  LB_CEF3_RequestContextRelease(context_b);

  LB_CEF3_BufferRelease(second);
  LB_CEF3_BufferRelease(loaded);
  LB_CEF3_BufferRelease(buffer_clone);
  const auto shutdown_image = LB_CEF3_ImageCreate();
  assert(shutdown_image != 0);
  assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
  assert(LB_CEF3_HandleIsValid(shutdown_image, LB_CEF3_HANDLE_IMAGE) == LB_CEF3_ERROR_RELEASED_HANDLE);
  DestroyWindow(host_a);
  DestroyWindow(host_b);
  LB_CEF3_ShutdownRegistry();
  std::filesystem::remove_all(root);
  return 0;
}
