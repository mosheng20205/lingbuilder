#include "LingBuilderCefBridge.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <functional>
#include <limits>
#include <string>
#include <thread>
#include <tuple>
#include <utility>
#include <vector>

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#undef assert
#define assert(expression) do { \
  if (!(expression)) { \
    std::fprintf(stderr, "CEF3 native test assertion failed: %s (%s:%d)\n", \
                 #expression, __FILE__, __LINE__); \
    std::fflush(stderr); \
    std::abort(); \
  } \
} while (false)

namespace {

void EnsureWinsock() {
  static const bool initialized = []() {
    WSADATA data{};
    return WSAStartup(MAKEWORD(2, 2), &data) == 0;
  }();
  assert(initialized);
}

uint16_t FindAvailableLoopbackPort() {
  EnsureWinsock();
  const SOCKET socket_handle = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  assert(socket_handle != INVALID_SOCKET);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = 0;
  assert(bind(socket_handle, reinterpret_cast<const sockaddr*>(&address),
              sizeof(address)) == 0);
  int address_size = sizeof(address);
  assert(getsockname(socket_handle, reinterpret_cast<sockaddr*>(&address),
                     &address_size) == 0);
  const uint16_t port = ntohs(address.sin_port);
  closesocket(socket_handle);
  assert(port >= 1025);
  return port;
}

std::string SendLoopbackHttpRequest(uint16_t port, const std::string& path) {
  EnsureWinsock();
  const SOCKET socket_handle = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  assert(socket_handle != INVALID_SOCKET);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = htons(port);
  int connect_status = SOCKET_ERROR;
  for (int attempt = 0; attempt < 100 && connect_status == SOCKET_ERROR;
       ++attempt) {
    connect_status = connect(
        socket_handle, reinterpret_cast<const sockaddr*>(&address),
        sizeof(address));
    if (connect_status == SOCKET_ERROR) Sleep(10);
  }
  assert(connect_status == 0);
  const std::string request =
      "GET " + path + " HTTP/1.1\r\nHost: 127.0.0.1\r\n"
      "Connection: close\r\n\r\n";
  size_t sent = 0;
  while (sent < request.size()) {
    const int count = send(
        socket_handle, request.data() + sent,
        static_cast<int>(request.size() - sent), 0);
    assert(count > 0);
    sent += static_cast<size_t>(count);
  }
  std::string response;
  std::array<char, 4096> chunk{};
  for (;;) {
    const int count = recv(
        socket_handle, chunk.data(), static_cast<int>(chunk.size()), 0);
    if (count == 0) break;
    assert(count > 0);
    response.append(chunk.data(), static_cast<size_t>(count));
  }
  closesocket(socket_handle);
  return response;
}

SOCKET ConnectLoopbackSocket(uint16_t port) {
  EnsureWinsock();
  const SOCKET socket_handle = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  assert(socket_handle != INVALID_SOCKET);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = htons(port);
  int connect_status = SOCKET_ERROR;
  for (int attempt = 0; attempt < 100 && connect_status == SOCKET_ERROR;
       ++attempt) {
    connect_status = connect(
        socket_handle, reinterpret_cast<const sockaddr*>(&address),
        sizeof(address));
    if (connect_status == SOCKET_ERROR) Sleep(10);
  }
  assert(connect_status == 0);
  return socket_handle;
}

void SendSocketBytes(SOCKET socket_handle, const void* data, size_t size) {
  const auto* bytes = static_cast<const char*>(data);
  size_t sent = 0;
  while (sent < size) {
    const int count = send(
        socket_handle, bytes + sent, static_cast<int>(size - sent), 0);
    assert(count > 0);
    sent += static_cast<size_t>(count);
  }
}

std::vector<unsigned char> ReceiveSocketBytes(
    SOCKET socket_handle, size_t size) {
  std::vector<unsigned char> result(size);
  size_t received = 0;
  while (received < size) {
    const int count = recv(
        socket_handle, reinterpret_cast<char*>(result.data() + received),
        static_cast<int>(size - received), 0);
    assert(count > 0);
    received += static_cast<size_t>(count);
  }
  return result;
}

std::string ReceiveHttpHeaders(SOCKET socket_handle) {
  std::string result;
  std::array<char, 1024> chunk{};
  while (result.find("\r\n\r\n") == std::string::npos) {
    const int count = recv(
        socket_handle, chunk.data(), static_cast<int>(chunk.size()), 0);
    assert(count > 0);
    result.append(chunk.data(), static_cast<size_t>(count));
  }
  return result;
}

void SendMaskedWebSocketText(
    SOCKET socket_handle, const std::string& payload) {
  assert(payload.size() < 126);
  std::vector<unsigned char> frame;
  frame.reserve(payload.size() + 6);
  frame.push_back(0x81);
  frame.push_back(static_cast<unsigned char>(0x80 | payload.size()));
  constexpr std::array<unsigned char, 4> mask = {0x11, 0x22, 0x33, 0x44};
  frame.insert(frame.end(), mask.begin(), mask.end());
  for (size_t index = 0; index < payload.size(); ++index) {
    frame.push_back(static_cast<unsigned char>(payload[index])
                    ^ mask[index % mask.size()]);
  }
  SendSocketBytes(socket_handle, frame.data(), frame.size());
}

std::string ReceiveWebSocketPayload(SOCKET socket_handle) {
  const auto header = ReceiveSocketBytes(socket_handle, 2);
  assert((header[0] & 0x80) != 0);
  assert((header[0] & 0x0f) == 1 || (header[0] & 0x0f) == 2);
  assert((header[1] & 0x80) == 0);
  uint64_t size = header[1] & 0x7f;
  if (size == 126) {
    const auto extended = ReceiveSocketBytes(socket_handle, 2);
    size = (static_cast<uint64_t>(extended[0]) << 8) | extended[1];
  } else if (size == 127) {
    const auto extended = ReceiveSocketBytes(socket_handle, 8);
    size = 0;
    for (const auto value : extended) size = (size << 8) | value;
  }
  assert(size <= 1024);
  const auto payload = ReceiveSocketBytes(
      socket_handle, static_cast<size_t>(size));
  return std::string(payload.begin(), payload.end());
}

std::atomic<int> g_browser_created_events{0};
std::atomic<int> g_browser_closed_events{0};
std::atomic<int> g_console_events{0};
std::atomic<int> g_response_filter_console_events{0};
std::atomic<int> g_resource_handler_async_console_events{0};
std::atomic<int> g_resource_handler_legacy_console_events{0};
std::atomic<int> g_loading_state_events{0};
std::atomic<int> g_load_start_events{0};
std::atomic<int> g_load_end_events{0};
std::atomic<int> g_focus_request_events{0};
std::atomic<int> g_focus_received_events{0};
std::atomic<int> g_pre_key_events{0};
std::atomic<int> g_key_events{0};
std::atomic<int> g_find_events{0};
std::atomic<int> g_find_final_events{0};
std::atomic<int> g_find_positive_final_events{0};
std::atomic<int> g_find_zero_final_events{0};
std::atomic<int> g_js_dialog_events{0};
std::atomic<int> g_before_unload_events{0};
std::atomic<int> g_dialog_reset_events{0};
std::atomic<int> g_dialog_closed_events{0};
std::atomic<int> g_context_menu_before_events{0};
std::atomic<int> g_context_menu_run_events{0};
std::atomic<int> g_context_menu_command_events{0};
std::atomic<int> g_context_menu_dismissed_events{0};
std::atomic<int> g_jshook_messages{0};
std::atomic<int> g_js_query_events{0};
std::atomic<int> g_js_query_cancel_events{0};
std::atomic<int> g_navigation_events{0};
std::atomic<int> g_osr_touch_events{0};
std::atomic<int> g_v4_file_dialog_events{0};
std::atomic<LB_CEF3_CONTINUATION_HANDLE> g_v4_file_dialog_continuation{0};
std::atomic<int> g_v4_devtools_agent_attached_events{0};
std::atomic<int> g_v4_devtools_agent_detached_events{0};
std::atomic<int> g_v4_devtools_event_events{0};
std::atomic<int> g_v4_devtools_message_events{0};
std::atomic<int> g_can_download_events{0};
std::atomic<int> g_before_download_events{0};
std::atomic<int> g_download_updated_events{0};
std::atomic<int> g_v4_can_download_events{0};
std::atomic<int> g_v4_before_download_events{0};
std::atomic<int> g_v4_download_updated_events{0};
std::atomic<int> g_v4_before_browse_events{0};
std::atomic<int> g_v4_document_available_events{0};
std::atomic<int> g_v4_open_url_from_tab_events{0};
std::atomic<int> g_v4_render_process_terminated_events{0};
std::atomic<int> g_v4_render_view_ready_events{0};
std::atomic<int> g_v4_select_client_certificate_events{0};
std::atomic<int> g_v4_before_resource_load_events{0};
std::atomic<int> g_v4_protocol_execution_events{0};
std::atomic<int> g_v4_resource_load_complete_events{0};
std::atomic<int> g_v4_resource_redirect_events{0};
std::atomic<int> g_v4_resource_response_events{0};
std::atomic<int> g_v4_cookie_access_filter_events{0};
std::atomic<int> g_v4_cookie_send_events{0};
std::atomic<int> g_v4_cookie_save_events{0};
std::atomic<int> g_v4_response_filter_get_events{0};
std::atomic<int> g_v4_response_filter_init_events{0};
std::atomic<int> g_v4_response_filter_chunk_events{0};
std::atomic<int> g_v4_resource_handler_get_events{0};
std::atomic<int> g_v4_resource_handler_open_events{0};
std::atomic<int> g_v4_resource_handler_process_events{0};
std::atomic<int> g_v4_resource_handler_headers_events{0};
std::atomic<int> g_v4_resource_handler_skip_events{0};
std::atomic<int> g_v4_resource_handler_read_events{0};
std::atomic<int> g_v4_resource_handler_legacy_read_events{0};
std::atomic<int> g_v4_resource_handler_cancel_events{0};
std::atomic<int> g_v4_render_handler_events{0};
std::atomic<int> g_v4_paint_events{0};
std::atomic<int> g_v4_view_rect_events{0};
/* 最近一次「OSR视图矩形请求」的 fields_json；先赋值再递增 g_v4_view_rect_events，
   读侧以计数器作为可见性屏障（CEF UI 线程写、测试线程读）。 */
std::wstring g_last_osr_view_rect_fields;
std::atomic<int> g_v4_frame_handler_events{0};
std::atomic<int> g_v4_accessibility_handler_events{0};
std::atomic<int> g_v4_browser_view_created_events{0};
std::atomic<int> g_v4_browser_view_destroyed_events{0};
std::atomic<int> g_v4_textfield_key_events{0};
std::atomic<int> g_v4_textfield_user_action_events{0};
std::atomic<int> g_v4_button_pressed_events{0};
std::atomic<int> g_v4_button_state_events{0};
std::atomic<int> g_v4_menu_button_pressed_events{0};
std::atomic<int> g_v4_render_webkit_initialized_events{0};
std::atomic<int> g_v4_render_focused_node_events{0};
std::atomic<int> g_v4_render_uncaught_exception_events{0};
std::atomic<LB_CEF3_HANDLE> g_menu_button_test_menu{0};
std::atomic<int> g_menu_button_show_status{LB_CEF3_ERROR_NOT_FOUND};
std::atomic<bool> g_menu_button_show_v4{false};
std::atomic<bool> g_hold_resource_read{false};
std::atomic<LB_CEF3_CONTINUATION_HANDLE> g_held_resource_read_continuation{0};
std::atomic<LB_CEF3_CONTINUATION_HANDLE> g_v4_before_download_continuation{0};
std::atomic<int> g_v4_download_control_phase{0};
std::atomic<bool> g_cancel_next_can_download{false};
std::wstring g_context_menu_response;

void LB_CEF3_CALL TestEventCallback(const LB_CEF3_EVENT_PACKET_V3* packet,
                                    LB_CEF3_EVENT_RESPONSE_V3* response, void*) {
  assert(packet != nullptr);
  assert(packet->abi_version == LB_CEF3_ABI_VERSION_V3);
  assert(packet->event_name != nullptr);
  assert(packet->fields_json != nullptr);
  if (std::wstring(packet->event_name) == L"浏览器创建完成") ++g_browser_created_events;
  if (std::wstring(packet->event_name) == L"浏览器即将关闭") ++g_browser_closed_events;
  if (std::wstring(packet->event_name) == L"加载状态改变") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"loading\":") != std::wstring::npos);
    assert(fields.find(L"\"canGoBack\":") != std::wstring::npos);
    assert(fields.find(L"\"canGoForward\":") != std::wstring::npos);
    ++g_loading_state_events;
  }
  if (std::wstring(packet->event_name) == L"开始加载") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    assert(fields.find(L"\"transitionType\":") != std::wstring::npos);
    ++g_load_start_events;
  }
  if (std::wstring(packet->event_name) == L"加载完成") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    ++g_load_end_events;
  }
  if (std::wstring(packet->event_name) == L"浏览器请求焦点") {
    assert(std::wstring(packet->fields_json).find(L"\"source\":") != std::wstring::npos);
    ++g_focus_request_events;
  }
  if (std::wstring(packet->event_name) == L"浏览器获得焦点") {
    assert(std::wstring(packet->fields_json) == L"{}");
    ++g_focus_received_events;
  }
  if (std::wstring(packet->event_name) == L"键盘事件预处理"
      || std::wstring(packet->event_name) == L"键盘事件") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"type\":") != std::wstring::npos);
    assert(fields.find(L"\"modifiers\":") != std::wstring::npos);
    assert(fields.find(L"\"windowsKeyCode\":") != std::wstring::npos);
    assert(fields.find(L"\"nativeKeyCode\":") != std::wstring::npos);
    assert(fields.find(L"\"systemKey\":") != std::wstring::npos);
    assert(fields.find(L"\"character\":") != std::wstring::npos);
    assert(fields.find(L"\"unmodifiedCharacter\":") != std::wstring::npos);
    assert(fields.find(L"\"focusOnEditableField\":") != std::wstring::npos);
    if (std::wstring(packet->event_name) == L"键盘事件预处理") ++g_pre_key_events;
    else ++g_key_events;
  }
  if (std::wstring(packet->event_name) == L"页内查找结果") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"identifier\":") != std::wstring::npos);
    assert(fields.find(L"\"count\":") != std::wstring::npos);
    assert(fields.find(L"\"selectionRect\":{") != std::wstring::npos);
    assert(fields.find(L"\"x\":") != std::wstring::npos);
    assert(fields.find(L"\"y\":") != std::wstring::npos);
    assert(fields.find(L"\"width\":") != std::wstring::npos);
    assert(fields.find(L"\"height\":") != std::wstring::npos);
    assert(fields.find(L"\"activeMatchOrdinal\":") != std::wstring::npos);
    assert(fields.find(L"\"finalUpdate\":") != std::wstring::npos);
    const wchar_t* count = wcsstr(fields.c_str(), L"\"count\":");
    assert(count != nullptr);
    const int result_count = _wtoi(count + wcslen(L"\"count\":"));
    // CEF reports the current number of identified matches. A terminal update
    // after StopFinding or a navigation can legitimately contain zero.
    assert(result_count >= 0);
    ++g_find_events;
    if (fields.find(L"\"finalUpdate\":true") != std::wstring::npos) {
      ++g_find_final_events;
      if (result_count > 0) ++g_find_positive_final_events;
      else ++g_find_zero_final_events;
    }
  }
  if (std::wstring(packet->event_name) == L"脚本对话框请求") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"originUrl\":") != std::wstring::npos);
    assert(fields.find(L"\"dialogType\":") != std::wstring::npos);
    assert(fields.find(L"\"messageText\":\"bridge-jsdialog-test\"") != std::wstring::npos);
    assert(fields.find(L"\"defaultPromptText\":") != std::wstring::npos);
    ++g_js_dialog_events;
    if (response) {
      response->action = 1;
      response->response_json = L"accepted";
    }
  }
  if (std::wstring(packet->event_name) == L"离开页面确认请求") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"messageText\":") != std::wstring::npos);
    assert(fields.find(L"\"isReload\":") != std::wstring::npos);
    ++g_before_unload_events;
    if (response) response->action = 1;
  }
  if (std::wstring(packet->event_name) == L"脚本对话框状态重置") {
    assert(std::wstring(packet->fields_json) == L"{}");
    ++g_dialog_reset_events;
  }
  if (std::wstring(packet->event_name) == L"脚本对话框已关闭") {
    assert(std::wstring(packet->fields_json) == L"{}");
    ++g_dialog_closed_events;
  }
  if (std::wstring(packet->event_name) == L"上下文菜单显示前"
      || std::wstring(packet->event_name) == L"运行上下文菜单") {
    const std::wstring fields(packet->fields_json);
    for (const wchar_t* key : {L"\"x\":", L"\"y\":", L"\"typeFlags\":",
         L"\"linkUrl\":", L"\"unfilteredLinkUrl\":", L"\"sourceUrl\":",
         L"\"hasImageContents\":", L"\"titleText\":", L"\"pageUrl\":",
         L"\"contextFrameUrl\":", L"\"frameCharset\":", L"\"mediaType\":",
         L"\"mediaStateFlags\":", L"\"selectionText\":", L"\"misspelledWord\":",
         L"\"hasDictionarySuggestions\":", L"\"dictionarySuggestions\":",
         L"\"editable\":", L"\"spellCheckEnabled\":", L"\"editStateFlags\":",
         L"\"customMenu\":", L"\"modelItemCount\":", L"\"firstCommandId\":"}) {
      assert(fields.find(key) != std::wstring::npos);
    }
    if (std::wstring(packet->event_name) == L"上下文菜单显示前") {
      ++g_context_menu_before_events;
    } else {
      const wchar_t* command = wcsstr(packet->fields_json, L"\"firstCommandId\":");
      assert(command != nullptr);
      command += wcslen(L"\"firstCommandId\":");
      const int command_id = _wtoi(command);
      assert(command_id >= 0);
      g_context_menu_response = L"{\"commandId\":" + std::to_wstring(command_id)
          + L",\"eventFlags\":0}";
      ++g_context_menu_run_events;
      if (response) {
        response->action = 1;
        response->response_json = g_context_menu_response.c_str();
      }
    }
  }
  if (std::wstring(packet->event_name) == L"上下文菜单命令") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"commandId\":") != std::wstring::npos);
    assert(fields.find(L"\"eventFlags\":") != std::wstring::npos);
    ++g_context_menu_command_events;
    if (response) response->action = 3;
  }
  if (std::wstring(packet->event_name) == L"上下文菜单已关闭") {
    assert(std::wstring(packet->fields_json).find(L"\"frameUrl\":") != std::wstring::npos);
    ++g_context_menu_dismissed_events;
  }
  if (std::wstring(packet->event_name) == L"控制台消息") {
    const std::wstring fields(packet->fields_json);
    if (fields.find(L"bridge-event-test") != std::wstring::npos) {
      ++g_console_events;
      if (response) response->action = 3;
    }
    if (fields.find(L"osr-touch-event") != std::wstring::npos) {
      ++g_osr_touch_events;
      if (response) response->action = 3;
    }
    if (fields.find(L"response-filter:bridge-filtered")
        != std::wstring::npos) {
      ++g_response_filter_console_events;
    }
    if (fields.find(L"resource-handler:async") != std::wstring::npos) {
      ++g_resource_handler_async_console_events;
    }
    if (fields.find(L"resource-handler:legacy") != std::wstring::npos) {
      ++g_resource_handler_legacy_console_events;
    }
  }
  if (std::wstring(packet->event_name) == L"地址被改变"
      && (std::wstring(packet->fields_json).find(L"native-test") != std::wstring::npos
          || std::wstring(packet->fields_json).find(L"example.com") != std::wstring::npos)) {
    ++g_navigation_events;
  }
  if (std::wstring(packet->event_name) == L"下载许可请求") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"browserId\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    assert(fields.find(L"\"requestMethod\":") != std::wstring::npos);
    ++g_can_download_events;
    if (response && g_cancel_next_can_download.exchange(false)) {
      response->action = 2;
    }
  }
  if (std::wstring(packet->event_name) == L"下载开始前") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"id\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    ++g_before_download_events;
  }
  if (std::wstring(packet->event_name) == L"下载状态更新") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"id\":") != std::wstring::npos);
    assert(fields.find(L"\"inProgress\":") != std::wstring::npos);
    assert(fields.find(L"\"receivedBytes\":") != std::wstring::npos);
    ++g_download_updated_events;
  }
  if (std::wstring(packet->event_name) == L"进程消息收到"
      && std::wstring(packet->fields_json).find(L"\"source\":\"jshook\"") != std::wstring::npos) {
    const wchar_t* request = wcsstr(packet->fields_json, L"\"requestId\":");
    assert(request != nullptr);
    request += wcslen(L"\"requestId\":");
    const auto request_id = _wcstoui64(request, nullptr, 10);
    assert(request_id != 0);
    assert(LB_CEF3_JsHookReply(packet->browser, request_id, 1, L"pong") == LB_CEF3_OK);
    ++g_jshook_messages;
  }
}

void LB_CEF3_CALL TestEventCallbackV4(const LB_CEF3_EVENT_PACKET_V4* packet,
                                      LB_CEF3_EVENT_RESPONSE_V4* response, void*) {
  assert(packet != nullptr);
  assert(packet->abi_version == LB_CEF3_ABI_VERSION_V4);
  assert(packet->event_name != nullptr);
  assert(packet->fields_json != nullptr);
  assert(response != nullptr);
  assert(response->abi_version == LB_CEF3_ABI_VERSION_V4);
  const std::wstring event_name(packet->event_name);
  if (event_name == L"查询请求") {
    const std::wstring fields(packet->fields_json);
    const wchar_t* query_id = wcsstr(fields.c_str(), L"\"queryId\":\"");
    assert(query_id != nullptr);
    query_id += wcslen(L"\"queryId\":\"");
    ++g_js_query_events;
    // 「jsquery-cancel-me」留给页面取消，验证「查询已取消」派发；其余直接应答。
    if (fields.find(L"jsquery-cancel-me") == std::wstring::npos) {
      assert(LB_CEF3_JsQueryRespond(packet->browser, query_id, 1, L"jsquery-pong", 0, L"")
          == LB_CEF3_OK);
    }
    return;
  }
  if (event_name == L"查询已取消") {
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"queryId\":") != std::wstring::npos);
    ++g_js_query_cancel_events;
    return;
  }
  if (event_name == L"渲染进程 WebKit 已初始化") {
    assert(packet->event_id == UINT64_C(0xd2442ca04f10291d));
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(std::wstring(packet->fields_json) == L"{}");
    ++g_v4_render_webkit_initialized_events;
    return;
  }
  if (event_name == L"渲染进程焦点节点已改变") {
    assert(packet->event_id == UINT64_C(0xf4084ca9d840b953));
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    const std::wstring fields(packet->fields_json);
    for (const wchar_t* key : {
             L"\"browserId\":", L"\"frameIdentifier\":",
             L"\"frameUrl\":", L"\"nodePresent\":",
             L"\"nodeType\":", L"\"name\":", L"\"value\":",
             L"\"tagName\":", L"\"editable\":",
             L"\"formControl\":", L"\"formControlType\":"}) {
      assert(fields.find(key) != std::wstring::npos);
    }
    ++g_v4_render_focused_node_events;
    return;
  }
  if (event_name == L"渲染进程未捕获异常") {
    assert(packet->event_id == UINT64_C(0xde64f6cc11240149));
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"bridge-render-uncaught") != std::wstring::npos);
    assert(fields.find(L"\"stackFrames\":[") != std::wstring::npos);
    assert(fields.find(L"\"scriptResourceName\":") != std::wstring::npos);
    ++g_v4_render_uncaught_exception_events;
    return;
  }
  if (event_name == L"Textfield按键事件"
      || event_name == L"Textfield用户操作完成"
      || event_name == L"Button已按下"
      || event_name == L"Button状态已改变"
      || event_name == L"MenuButton已按下") {
    assert(packet->browser == 0);
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_VIEW);
    const std::wstring fields(packet->fields_json);
    if (event_name == L"Textfield按键事件") {
      assert(packet->event_id == UINT64_C(0x7b3180a8bed0ff0f));
      assert(fields.find(L"\"windowsKeyCode\":") != std::wstring::npos);
      response->action = 1;
      ++g_v4_textfield_key_events;
    } else if (event_name == L"Textfield用户操作完成") {
      assert(packet->event_id == UINT64_C(0xd1066034883ed59e));
      assert(fields.find(L"\"text\":") != std::wstring::npos);
      ++g_v4_textfield_user_action_events;
    } else if (event_name == L"Button已按下") {
      assert(packet->event_id == UINT64_C(0x4a965e1b2e8b038e));
      ++g_v4_button_pressed_events;
    } else if (event_name == L"Button状态已改变") {
      assert(packet->event_id == UINT64_C(0x622de69f8e720453));
      ++g_v4_button_state_events;
    } else {
      assert(packet->event_id == UINT64_C(0xc9ff527eddb31aea));
      assert(fields.find(L"\"x\":") != std::wstring::npos);
      const auto menu = g_menu_button_test_menu.load();
      if (menu != 0) {
        LB_CEF3_POINT_V3 point{
            sizeof(point), LB_CEF3_ABI_VERSION_V3, 0, 0};
        int status = LB_CEF3_ERROR_NOT_FOUND;
        if (!g_menu_button_show_v4.load()) {
          status = LB_CEF3_MenuButtonShowMenu(
              packet->subject, menu, &point, 0);
        } else {
          std::array<LB_CEF3_ARGUMENT_V4, 4> arguments{};
          for (auto& argument : arguments) {
            argument.struct_size = sizeof(argument);
            argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
          }
          arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
          arguments[0].handle_value = menu;
          LB_CEF3_CALL_V4 call{};
          call.struct_size = sizeof(call);
          call.abi_version = LB_CEF3_ABI_VERSION_V4;
          call.operation_id = UINT64_C(0x2a10d34972afda2d);
          call.target = packet->subject;
          call.arguments = arguments.data();
          call.argument_count = arguments.size();
          LB_CEF3_RESULT_V4 result{};
          result.struct_size = sizeof(result);
          status = LB_CEF3_InvokeV4(&call, &result);
          if (status == LB_CEF3_OK)
            assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
        }
        g_menu_button_show_status.store(status);
      }
      ++g_v4_menu_button_pressed_events;
    }
    return;
  }
  if (event_name == L"BrowserView浏览器已创建"
      || event_name == L"BrowserView浏览器已销毁") {
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_VIEW);
    assert(std::wstring(packet->fields_json).find(L"\"browserId\":")
        != std::wstring::npos);
    if (event_name == L"BrowserView浏览器已创建") {
      assert(packet->event_id == UINT64_C(0xa8da6d0c58b50567));
      ++g_v4_browser_view_created_events;
    } else {
      assert(packet->event_id == UINT64_C(0xd18d2c164688253c));
      ++g_v4_browser_view_destroyed_events;
    }
    return;
  }
  if (event_name.rfind(L"OSR", 0) == 0) {
    assert(packet->browser != 0);
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"browserId\":") != std::wstring::npos);
    if (event_name == L"OSR像素帧") {
      assert(packet->event_id == UINT64_C(0x60172846b544426a));
      assert(packet->subject != 0);
      assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_BUFFER);
      uint64_t byte_count = 0;
      assert(LB_CEF3_BufferGetSize(packet->subject, &byte_count) == LB_CEF3_OK);
      assert(byte_count > 0);
      assert(fields.find(L"\"dirtyRects\":[") != std::wstring::npos);
      ++g_v4_paint_events;
    }
    if (event_name == L"OSR视图矩形请求") {
      g_last_osr_view_rect_fields = fields;
      ++g_v4_view_rect_events;
    }
    ++g_v4_render_handler_events;
    return;
  }
  if (event_name == L"Frame已创建" || event_name == L"Frame已附加"
      || event_name == L"Frame已分离" || event_name == L"Frame已销毁"
      || event_name == L"主Frame改变") {
    assert(packet->browser != 0);
    const std::wstring fields(packet->fields_json);
    assert(fields.find(L"\"browserId\":") != std::wstring::npos);
    if (packet->subject != packet->browser) {
      assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_FRAME);
    }
    ++g_v4_frame_handler_events;
    return;
  }
  if (event_name == L"无障碍树改变" || event_name == L"无障碍位置改变") {
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(packet->subject != packet->browser);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_VALUE);
    ++g_v4_accessibility_handler_events;
    return;
  }
  if (event_name == L"开发工具代理已附加") {
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(std::wstring(packet->fields_json).find(L"\"browserId\":") != std::wstring::npos);
    ++g_v4_devtools_agent_attached_events;
    return;
  }
  if (event_name == L"开发工具代理已分离") {
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(std::wstring(packet->fields_json).find(L"\"browserId\":") != std::wstring::npos);
    ++g_v4_devtools_agent_detached_events;
    return;
  }
  if (event_name == L"开发工具协议事件") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(fields.find(L"\"browserId\":") != std::wstring::npos);
    assert(fields.find(L"\"method\":") != std::wstring::npos);
    assert(fields.find(L"\"paramsJson\":") != std::wstring::npos);
    assert(fields.find(L"\"byteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"truncated\":") != std::wstring::npos);
    assert(fields.find(L"\"utf8Valid\":") != std::wstring::npos);
    ++g_v4_devtools_event_events;
    return;
  }
  if (event_name == L"开发工具协议消息") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(fields.find(L"\"browserId\":") != std::wstring::npos);
    assert(fields.find(L"\"message\":") != std::wstring::npos);
    assert(fields.find(L"\"byteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"truncated\":") != std::wstring::npos);
    assert(fields.find(L"\"utf8Valid\":") != std::wstring::npos);
    ++g_v4_devtools_message_events;
    return;
  }
  if (event_name == L"下载许可请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0xf5055a5a6c107622));
    assert(packet->continuation == 0);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    assert(fields.find(L"\"requestMethod\":") != std::wstring::npos);
    ++g_v4_can_download_events;
    return;
  }
  if (event_name == L"下载开始前") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0x20b960324dca2993));
    assert(packet->continuation != 0);
    assert(fields.find(L"\"id\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    ++g_v4_before_download_events;
    g_v4_before_download_continuation.store(packet->continuation);
    return;
  }
  if (event_name == L"下载状态更新") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(packet->subject != packet->browser);
    assert(LB_CEF3_HandleGetType(packet->subject)
        == LB_CEF3_HANDLE_DOWNLOAD_CALLBACK);
    assert(packet->event_id == UINT64_C(0x476494197c092f12));
    assert(packet->continuation == 0);
    assert(fields.find(L"\"id\":") != std::wstring::npos);
    assert(fields.find(L"\"receivedBytes\":") != std::wstring::npos);
    int expected_phase = 0;
    uint64_t operation_id = UINT64_C(0x97bcf023fbe149da);
    if (!g_v4_download_control_phase.compare_exchange_strong(
            expected_phase, 1)) {
      expected_phase = 1;
      operation_id = UINT64_C(0x20af7c5c534345bb);
      if (!g_v4_download_control_phase.compare_exchange_strong(
              expected_phase, 2)) {
        ++g_v4_download_updated_events;
        return;
      }
    }
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = packet->subject;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
    ++g_v4_download_updated_events;
    return;
  }
  if (event_name == L"浏览前请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(packet->subject != packet->browser);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->event_id == UINT64_C(0x68376fb9f74e1c33));
    assert(packet->continuation == 0);
    assert((packet->flags & 1u) != 0);
    for (const wchar_t* key : {
        L"\"browserId\":", L"\"frameIdentifier\":",
        L"\"requestIdentifier\":", L"\"url\":", L"\"method\":",
        L"\"resourceType\":", L"\"transitionType\":",
        L"\"userGesture\":", L"\"redirect\":"}) {
      assert(fields.find(key) != std::wstring::npos);
    }
    ++g_v4_before_browse_events;
    return;
  }
  if (event_name == L"主框架文档可用") {
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0x5973027f3dcdf4a2));
    assert(packet->continuation == 0);
    assert(std::wstring(packet->fields_json).find(L"\"browserId\":")
        != std::wstring::npos);
    ++g_v4_document_available_events;
    return;
  }
  if (event_name == L"标签打开地址请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0xd597e9e1ceaebbee));
    assert(packet->continuation == 0);
    assert((packet->flags & 1u) != 0);
    assert(fields.find(L"\"targetUrl\":") != std::wstring::npos);
    assert(fields.find(L"\"targetDisposition\":") != std::wstring::npos);
    ++g_v4_open_url_from_tab_events;
    return;
  }
  if (event_name == L"渲染进程意外终止") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0xb36cc01b1ecc4345));
    assert(fields.find(L"\"status\":") != std::wstring::npos);
    assert(fields.find(L"\"errorCode\":") != std::wstring::npos);
    assert(fields.find(L"\"errorString\":") != std::wstring::npos);
    ++g_v4_render_process_terminated_events;
    return;
  }
  if (event_name == L"渲染视图就绪") {
    assert(packet->browser != 0);
    assert(packet->subject == packet->browser);
    assert(packet->event_id == UINT64_C(0x032c68dddd1c844d));
    assert(std::wstring(packet->fields_json).find(L"\"browserId\":")
        != std::wstring::npos);
    ++g_v4_render_view_ready_events;
    return;
  }
  if (event_name == L"客户端证书选择请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(packet->subject != packet->browser);
    assert(LB_CEF3_HandleGetType(packet->subject)
        == LB_CEF3_HANDLE_CERTIFICATE_COLLECTION);
    assert(packet->event_id == UINT64_C(0xf3e849b56f9a96b5));
    assert(packet->continuation != 0);
    assert(packet->timeout_milliseconds == 30000);
    assert(fields.find(L"\"isProxy\":") != std::wstring::npos);
    assert(fields.find(L"\"host\":") != std::wstring::npos);
    assert(fields.find(L"\"port\":") != std::wstring::npos);
    assert(fields.find(L"\"certificateCount\":") != std::wstring::npos);
    ++g_v4_select_client_certificate_events;
    return;
  }
  if (event_name == L"资源加载前请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->browser != 0);
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->event_id == UINT64_C(0xa3693dfc0581f9b6));
    assert(packet->continuation != 0);
    assert(packet->timeout_milliseconds == 30000);
    assert(fields.find(L"\"requestIdentifier\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    assert(fields.find(L"\"method\":") != std::wstring::npos);
    ++g_v4_before_resource_load_events;
    assert(LB_CEF3_ContinuationCompleteV4(
        packet->continuation, 1, L"{}") == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(packet->continuation) == LB_CEF3_OK);
    return;
  }
  if (event_name == L"外部协议执行请求") {
    assert(packet->event_id == UINT64_C(0xfff56fd9517bd931));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->continuation == 0);
    ++g_v4_protocol_execution_events;
    return;
  }
  if (event_name == L"资源加载完成") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xe0ceda2dcb349971));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(fields.find(L"\"status\":") != std::wstring::npos);
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    assert(fields.find(L"\"receivedContentLength\":") != std::wstring::npos);
    ++g_v4_resource_load_complete_events;
    return;
  }
  if (event_name == L"资源重定向") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xc30d43360af59c98));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->continuation == 0);
    assert(fields.find(L"\"oldUrl\":") != std::wstring::npos);
    assert(fields.find(L"\"newUrl\":") != std::wstring::npos);
    ++g_v4_resource_redirect_events;
    return;
  }
  if (event_name == L"资源响应已接收") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x9c7ef5d6cf414ec9));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->continuation == 0);
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    assert(fields.find(L"\"mimeType\":") != std::wstring::npos);
    ++g_v4_resource_response_events;
    return;
  }
  if (event_name == L"Cookie访问过滤器请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x0eff952ecd77e212));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(packet->continuation == 0);
    assert(fields.find(L"\"requestIdentifier\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    ++g_v4_cookie_access_filter_events;
    return;
  }
  if (event_name == L"Cookie发送许可请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x3ecbc994204fbd96));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert((packet->flags & 1u) != 0);
    for (const wchar_t* key : {
        L"\"requestIdentifier\":", L"\"url\":", L"\"cookie\":{",
        L"\"name\":", L"\"value\":", L"\"domain\":",
        L"\"path\":", L"\"secure\":", L"\"httpOnly\":",
        L"\"hasExpires\":", L"\"sameSite\":", L"\"priority\":"}) {
      assert(fields.find(key) != std::wstring::npos);
    }
    ++g_v4_cookie_send_events;
    if (response) {
      response->action = 1;
      response->response_json = L"{\"allow\":true}";
    }
    return;
  }
  if (event_name == L"Cookie保存许可请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xc690761fd9ae0316));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert((packet->flags & 1u) != 0);
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    assert(fields.find(L"\"mimeType\":") != std::wstring::npos);
    assert(fields.find(L"\"cookie\":{") != std::wstring::npos);
    assert(fields.find(L"\"name\":") != std::wstring::npos);
    assert(fields.find(L"\"value\":") != std::wstring::npos);
    ++g_v4_cookie_save_events;
    if (response) {
      response->action = 1;
      response->response_json = L"{\"allow\":true}";
    }
    return;
  }
  if (event_name == L"响应过滤器请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x324e71e8a4dfdbc9));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(fields.find(L"\"requestIdentifier\":") != std::wstring::npos);
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    assert(fields.find(L"\"findByteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"replacementByteCount\":") != std::wstring::npos);
    ++g_v4_response_filter_get_events;
    return;
  }
  if (event_name == L"响应过滤器初始化") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xa86bbf85dc8790a8));
    assert(packet->subject == packet->browser);
    assert(fields.find(L"\"findByteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"replacementByteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"valid\":true") != std::wstring::npos);
    ++g_v4_response_filter_init_events;
    return;
  }
  if (event_name == L"响应字节过滤") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x06c0c2087bd6dd8a));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_BUFFER);
    uint64_t byte_count = 0;
    assert(LB_CEF3_BufferGetSize(packet->subject, &byte_count) == LB_CEF3_OK);
    assert(byte_count > 0);
    assert(fields.find(L"\"inputByteCount\":") != std::wstring::npos);
    assert(fields.find(L"\"inputRead\":") != std::wstring::npos);
    assert(fields.find(L"\"outputWritten\":") != std::wstring::npos);
    assert(fields.find(L"\"status\":") != std::wstring::npos);
    ++g_v4_response_filter_chunk_events;
    return;
  }
  if (event_name == L"受管资源处理器请求") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x23d8b19b2d7bbc83));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(fields.find(L"\"requestIdentifier\":") != std::wstring::npos);
    assert(fields.find(L"\"url\":") != std::wstring::npos);
    ++g_v4_resource_handler_get_events;
    return;
  }
  if (event_name == L"受管资源打开") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x0ce530725a088529));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    assert(fields.find(L"\"legacyOpen\":") != std::wstring::npos);
    ++g_v4_resource_handler_open_events;
    return;
  }
  if (event_name == L"受管资源旧式处理") {
    assert(packet->event_id == UINT64_C(0x0a0bb2a0d4cb61a5));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_REQUEST);
    ++g_v4_resource_handler_process_events;
    return;
  }
  if (event_name == L"受管资源响应头") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xa568e9aace100bc9));
    assert(fields.find(L"\"statusCode\":") != std::wstring::npos);
    assert(fields.find(L"\"mimeType\":") != std::wstring::npos);
    assert(fields.find(L"\"responseLength\":") != std::wstring::npos);
    assert(fields.find(L"\"headerCount\":") != std::wstring::npos);
    ++g_v4_resource_handler_headers_events;
    return;
  }
  if (event_name == L"受管资源异步跳过") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0xcb04475fe8b923df));
    assert(packet->continuation != 0);
    const wchar_t* maximum = wcsstr(fields.c_str(), L"\"maximumBytes\":");
    assert(maximum != nullptr);
    const int64_t count = _wtoi64(maximum + wcslen(L"\"maximumBytes\":"));
    assert(count >= 0);
    const auto continuation = packet->continuation;
    std::thread([continuation, count]() {
      Sleep(1);
      LB_CEF3_ARGUMENT_V4 argument{};
      argument.struct_size = sizeof(argument);
      argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
      argument.integer_value = count;
      LB_CEF3_CALL_V4 call{};
      call.struct_size = sizeof(call);
      call.abi_version = LB_CEF3_ABI_VERSION_V4;
      call.operation_id = UINT64_C(0x6c2e9a952b9b8ecd);
      call.target = continuation;
      call.arguments = &argument;
      call.argument_count = 1;
      LB_CEF3_RESULT_V4 result{};
      result.struct_size = sizeof(result);
      assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
      assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
      assert(LB_CEF3_HandleRelease(continuation) == LB_CEF3_OK);
    }).detach();
    ++g_v4_resource_handler_skip_events;
    return;
  }
  if (event_name == L"受管资源异步读取") {
    const std::wstring fields(packet->fields_json);
    assert(packet->event_id == UINT64_C(0x04e855cec82ad27b));
    assert(packet->continuation != 0);
    assert(fields.find(L"\"bytesToRead\":") != std::wstring::npos);
    const wchar_t* maximum = wcsstr(fields.c_str(), L"\"maximumBytes\":");
    assert(maximum != nullptr);
    const int64_t count = _wtoi64(maximum + wcslen(L"\"maximumBytes\":"));
    assert(count > 0 && count <= std::numeric_limits<int32_t>::max());
    ++g_v4_resource_handler_read_events;
    if (g_hold_resource_read.exchange(false)) {
      g_held_resource_read_continuation.store(packet->continuation);
      return;
    }
    const auto continuation = packet->continuation;
    std::thread([continuation, count]() {
      Sleep(1);
      LB_CEF3_ARGUMENT_V4 argument{};
      argument.struct_size = sizeof(argument);
      argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
      argument.integer_value = count;
      LB_CEF3_CALL_V4 call{};
      call.struct_size = sizeof(call);
      call.abi_version = LB_CEF3_ABI_VERSION_V4;
      call.operation_id = UINT64_C(0xa4e89d0519c10709);
      call.target = continuation;
      call.arguments = &argument;
      call.argument_count = 1;
      LB_CEF3_RESULT_V4 result{};
      result.struct_size = sizeof(result);
      assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
      assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
      assert(LB_CEF3_HandleRelease(continuation) == LB_CEF3_OK);
    }).detach();
    return;
  }
  if (event_name == L"受管资源旧式读取") {
    assert(packet->event_id == UINT64_C(0xda6c5fde45a2c54c));
    assert(packet->subject != 0);
    assert(LB_CEF3_HandleGetType(packet->subject) == LB_CEF3_HANDLE_BUFFER);
    ++g_v4_resource_handler_legacy_read_events;
    return;
  }
  if (event_name == L"受管资源已取消") {
    assert(packet->event_id == UINT64_C(0x8894e928b5819d0d));
    assert(std::wstring(packet->fields_json).find(L"\"sourceUrl\":")
        != std::wstring::npos);
    ++g_v4_resource_handler_cancel_events;
    return;
  }
  if (event_name != L"文件对话框请求") return;
  assert(packet->browser != 0);
  assert(packet->subject == packet->browser);
  assert(packet->event_id != 0);
  assert(packet->continuation != 0);
  assert(packet->timeout_milliseconds == 2000);
  assert(std::wstring(packet->fields_json).find(L"\"acceptFilters\":") != std::wstring::npos);
  g_v4_file_dialog_continuation.store(packet->continuation);
  ++g_v4_file_dialog_events;
}

void PumpHostMessages() {
  MSG message{};
  while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
}

int WaitTask(LB_CEF3_TASK_HANDLE task, DWORD timeout_milliseconds = 5000) {
  const auto deadline = GetTickCount64() + timeout_milliseconds;
  int status = LB_CEF3_TaskGetStatus(task);
  while ((status == LB_CEF3_TASK_PENDING || status == LB_CEF3_TASK_RUNNING) && GetTickCount64() < deadline) {
    PumpHostMessages();
    Sleep(10);
    status = LB_CEF3_TaskGetStatus(task);
  }
  return status;
}

bool IsTestFlagEnabled(const wchar_t* name) {
  std::array<wchar_t, 8> value{};
  const auto length = GetEnvironmentVariableW(
      name, value.data(), static_cast<DWORD>(value.size()));
  return length == 1 && value[0] == L'1';
}

std::wstring TaskResult(LB_CEF3_TASK_HANDLE task) {
  size_t required = 0;
  if (LB_CEF3_TaskGetResult(task, nullptr, 0, &required) != LB_CEF3_ERROR_BUFFER_TOO_SMALL || required == 0) return L"";
  std::wstring result(required, L'\0');
  if (LB_CEF3_TaskGetResult(task, result.data(), result.size(), &required) != LB_CEF3_OK) return L"";
  result.resize(wcslen(result.c_str()));
  return result;
}

std::wstring TaskError(LB_CEF3_TASK_HANDLE task) {
  size_t required = 0;
  if (LB_CEF3_TaskGetError(task, nullptr, 0, &required) != LB_CEF3_ERROR_BUFFER_TOO_SMALL || required == 0) return L"";
  std::wstring result(required, L'\0');
  if (LB_CEF3_TaskGetError(task, result.data(), result.size(), &required) != LB_CEF3_OK) return L"";
  result.resize(wcslen(result.c_str()));
  return result;
}

LB_CEF3_HANDLE CreateTextList(const std::vector<std::wstring>& values) {
  const auto list = LB_CEF3_ListCreate();
  assert(list != 0);
  assert(LB_CEF3_ListSetSize(list, values.size()) == LB_CEF3_OK);
  for (size_t index = 0; index < values.size(); ++index) {
    const auto value = LB_CEF3_ValueCreate();
    assert(value != 0);
    assert(LB_CEF3_ValueSetString(value, values[index].c_str()) == LB_CEF3_OK);
    assert(LB_CEF3_ListSetValue(list, index, value) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
  }
  return list;
}

std::wstring ReadTextListItem(LB_CEF3_HANDLE list, size_t index) {
  const auto value = LB_CEF3_ListGetValue(list, index);
  assert(value != 0);
  size_t required = 0;
  assert(LB_CEF3_ValueGetString(value, nullptr, 0, &required) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring result(required, L'\0');
  assert(LB_CEF3_ValueGetString(value, result.data(), result.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
  result.resize(wcslen(result.c_str()));
  return result;
}

using ManagedTextGetter = int (LB_CEF3_CALL*)(
    LB_CEF3_HANDLE, wchar_t*, size_t, size_t*);

std::wstring ReadManagedText(LB_CEF3_HANDLE handle, ManagedTextGetter getter) {
  size_t required = 0;
  assert(getter(handle, nullptr, 0, &required) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(required >= 1);
  std::wstring result(required, L'\0');
  for (int attempt = 0; attempt < 4; ++attempt) {
    const int status = getter(handle, result.data(), result.size(), &required);
    if (status == LB_CEF3_OK) break;
    assert(status == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
    assert(required > result.size());
    result.assign(required, L'\0');
    assert(attempt < 3);
  }
  result.resize(wcslen(result.c_str()));
  return result;
}

std::wstring ReadV4Text(LB_CEF3_CALL_V4 call) {
  LB_CEF3_RESULT_V4 result{};
  result.struct_size = sizeof(result);
  assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(result.text_required >= 1);
  std::wstring text(result.text_required, L'\0');
  result.struct_size = sizeof(result);
  result.text = text.data();
  result.text_capacity = text.size();
  assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
  text.resize(wcslen(text.c_str()));
  return text;
}

std::wstring ReadV4Json(LB_CEF3_CALL_V4 call) {
  LB_CEF3_RESULT_V4 result{};
  result.struct_size = sizeof(result);
  assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(result.value_kind == LB_CEF3_VALUE_V4_JSON);
  assert(result.text_required >= 1);
  std::wstring text(result.text_required, L'\0');
  result.struct_size = sizeof(result);
  result.text = text.data();
  result.text_capacity = text.size();
  assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
  assert(result.value_kind == LB_CEF3_VALUE_V4_JSON);
  text.resize(wcslen(text.c_str()));
  return text;
}

LB_CEF3_HANDLE CreateHeaderMapList(
    const std::vector<std::pair<std::wstring, std::wstring>>& headers) {
  const auto list = LB_CEF3_ListCreate();
  assert(list != 0);
  assert(LB_CEF3_ListSetSize(list, headers.size()) == LB_CEF3_OK);
  for (size_t index = 0; index < headers.size(); ++index) {
    const auto dictionary = LB_CEF3_DictionaryCreate();
    assert(dictionary != 0);
    const auto set_field = [dictionary](const wchar_t* key, const std::wstring& text) {
      const auto field = LB_CEF3_ValueCreate();
      assert(field != 0);
      assert(LB_CEF3_ValueSetString(field, text.c_str()) == LB_CEF3_OK);
      assert(LB_CEF3_DictionarySetValue(dictionary, key, field) == LB_CEF3_OK);
      assert(LB_CEF3_ValueRelease(field) == LB_CEF3_OK);
    };
    set_field(L"name", headers[index].first);
    set_field(L"value", headers[index].second);
    const auto item = LB_CEF3_ValueCreate();
    assert(item != 0);
    assert(LB_CEF3_ValueSetDictionary(item, dictionary) == LB_CEF3_OK);
    assert(LB_CEF3_ListSetValue(list, index, item) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(item) == LB_CEF3_OK);
    assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  }
  return list;
}

std::wstring ReadHeaderMapField(
    LB_CEF3_HANDLE header_map, size_t index, const wchar_t* key) {
  const auto item = LB_CEF3_ListGetValue(header_map, index);
  assert(item != 0);
  const auto dictionary = LB_CEF3_ValueGetDictionary(item);
  assert(dictionary != 0);
  const auto field = LB_CEF3_DictionaryGetValue(dictionary, key);
  assert(field != 0);
  size_t required = 0;
  assert(LB_CEF3_ValueGetString(field, nullptr, 0, &required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring result(required, L'\0');
  assert(LB_CEF3_ValueGetString(field, result.data(), result.size(), &required) == LB_CEF3_OK);
  result.resize(wcslen(result.c_str()));
  assert(LB_CEF3_ValueRelease(field) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(item) == LB_CEF3_OK);
  return result;
}

LB_CEF3_HANDLE CreateIntegerDictionary(
    const std::vector<std::pair<std::wstring, int>>& fields) {
  const auto dictionary = LB_CEF3_DictionaryCreate();
  assert(dictionary != 0);
  for (const auto& [key, number] : fields) {
    const auto value = LB_CEF3_ValueCreate();
    assert(value != 0);
    assert(LB_CEF3_ValueSetInt(value, number) == LB_CEF3_OK);
    assert(LB_CEF3_DictionarySetValue(dictionary, key.c_str(), value) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
  }
  return dictionary;
}

LB_CEF3_HANDLE CreatePageRangeList(
    const std::vector<std::pair<uint32_t, uint32_t>>& ranges) {
  const auto list = LB_CEF3_ListCreate();
  assert(list != 0);
  assert(LB_CEF3_ListSetSize(list, ranges.size()) == LB_CEF3_OK);
  for (size_t index = 0; index < ranges.size(); ++index) {
    const auto dictionary = LB_CEF3_DictionaryCreate();
    assert(dictionary != 0);
    for (const auto& [key, number] : {
             std::pair<const wchar_t*, uint32_t>{L"from", ranges[index].first},
             std::pair<const wchar_t*, uint32_t>{L"to", ranges[index].second}}) {
      const auto value = LB_CEF3_ValueCreate();
      assert(value != 0);
      assert(LB_CEF3_ValueSetDouble(value, static_cast<double>(number)) == LB_CEF3_OK);
      assert(LB_CEF3_DictionarySetValue(dictionary, key, value) == LB_CEF3_OK);
      assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
    }
    const auto item = LB_CEF3_ValueCreate();
    assert(item != 0);
    assert(LB_CEF3_ValueSetDictionary(item, dictionary) == LB_CEF3_OK);
    assert(LB_CEF3_ListSetValue(list, index, item) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(item) == LB_CEF3_OK);
    assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  }
  return list;
}

LB_CEF3_HANDLE CreateDraggableRegionList(
    int x, int y, int width, int height, bool draggable) {
  const auto list = LB_CEF3_ListCreate();
  const auto dictionary = LB_CEF3_DictionaryCreate();
  assert(list != 0 && dictionary != 0);
  assert(LB_CEF3_ListSetSize(list, 1) == LB_CEF3_OK);
  for (const auto& [key, number] : {
           std::pair<const wchar_t*, int>{L"x", x},
           std::pair<const wchar_t*, int>{L"y", y},
           std::pair<const wchar_t*, int>{L"width", width},
           std::pair<const wchar_t*, int>{L"height", height}}) {
    const auto value = LB_CEF3_ValueCreate();
    assert(value != 0);
    assert(LB_CEF3_ValueSetInt(value, number) == LB_CEF3_OK);
    assert(LB_CEF3_DictionarySetValue(dictionary, key, value) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
  }
  const auto draggable_value = LB_CEF3_ValueCreate();
  assert(draggable_value != 0);
  assert(LB_CEF3_ValueSetBool(draggable_value, draggable ? 1 : 0) == LB_CEF3_OK);
  assert(LB_CEF3_DictionarySetValue(
      dictionary, L"draggable", draggable_value) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(draggable_value) == LB_CEF3_OK);
  const auto item = LB_CEF3_ValueCreate();
  assert(item != 0);
  assert(LB_CEF3_ValueSetDictionary(item, dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ListSetValue(list, 0, item) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(item) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  return list;
}

double ReadPageRangeField(LB_CEF3_HANDLE ranges, size_t index, const wchar_t* key) {
  const auto item = LB_CEF3_ListGetValue(ranges, index);
  assert(item != 0);
  const auto dictionary = LB_CEF3_ValueGetDictionary(item);
  assert(dictionary != 0);
  const auto field = LB_CEF3_DictionaryGetValue(dictionary, key);
  assert(field != 0);
  double result = 0;
  assert(LB_CEF3_ValueGetDouble(field, &result) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(field) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(item) == LB_CEF3_OK);
  return result;
}

}  // namespace

int wmain() {
  const bool browser_process = wcsstr(GetCommandLineW(), L"--type=") == nullptr;
  if (browser_process) {
    std::fprintf(stderr, "CEF3 test checkpoint: process-entry\n");
    std::fflush(stderr);
  }
  const auto application_instance = reinterpret_cast<uint64_t>(GetModuleHandleW(nullptr));
  constexpr int32_t kCustomSchemeOptions =
      LB_CEF3_SCHEME_OPTION_STANDARD | LB_CEF3_SCHEME_OPTION_SECURE
      | LB_CEF3_SCHEME_OPTION_CORS_ENABLED | LB_CEF3_SCHEME_OPTION_FETCH_ENABLED;
  assert(LB_CEF3_AppRegisterCustomScheme(
             L"http", kCustomSchemeOptions)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_AppRegisterCustomScheme(
             L"lingbuilder", kCustomSchemeOptions)
      == LB_CEF3_OK);
  assert(LB_CEF3_SchemeRegistrarAddCustomScheme(
             L"lingbuilderdirect", kCustomSchemeOptions)
      == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 custom_scheme_arguments[2]{};
  custom_scheme_arguments[0].struct_size = sizeof(custom_scheme_arguments[0]);
  custom_scheme_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  custom_scheme_arguments[0].text_value = L"lingbuilderappv4";
  custom_scheme_arguments[1].struct_size = sizeof(custom_scheme_arguments[1]);
  custom_scheme_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  custom_scheme_arguments[1].integer_value = kCustomSchemeOptions;
  LB_CEF3_CALL_V4 custom_scheme_call{};
  custom_scheme_call.struct_size = sizeof(custom_scheme_call);
  custom_scheme_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  custom_scheme_call.operation_id = UINT64_C(0x16d1c995ea0afd8f);
  custom_scheme_call.arguments = custom_scheme_arguments;
  custom_scheme_call.argument_count = 2;
  LB_CEF3_RESULT_V4 custom_scheme_result{};
  custom_scheme_result.struct_size = sizeof(custom_scheme_result);
  assert(LB_CEF3_InvokeV4(&custom_scheme_call, &custom_scheme_result)
      == LB_CEF3_OK);
  assert(custom_scheme_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  custom_scheme_arguments[0].text_value = L"lingbuilderv4";
  custom_scheme_call.operation_id = UINT64_C(0xa002c872f1a6325e);
  custom_scheme_result = {};
  custom_scheme_result.struct_size = sizeof(custom_scheme_result);
  assert(LB_CEF3_InvokeV4(&custom_scheme_call, &custom_scheme_result)
      == LB_CEF3_OK);
  assert(custom_scheme_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(custom_scheme_result.integer_value == 1);
  custom_scheme_call.target = UINT64_C(0x1234);
  assert(LB_CEF3_InvokeV4(&custom_scheme_call, &custom_scheme_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  custom_scheme_call.target = 0;
  const int subprocess_exit = LB_CEF3_ExecuteSubProcess(application_instance);
  if (browser_process) {
    std::fprintf(stderr, "CEF3 test checkpoint: execute-subprocess=%d\n", subprocess_exit);
    std::fflush(stderr);
  }
  if (subprocess_exit >= 0) return subprocess_exit;
  assert(LB_CEF3_AppRegisterCustomScheme(
             L"lingbuilderlate", kCustomSchemeOptions)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_SchemeRegistrarAddCustomScheme(
             L"lingbuilderlate", kCustomSchemeOptions)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_GetAbiVersion() == LB_CEF3_ABI_VERSION_V3);
  assert(LB_CEF3_GetLatestAbiVersion() == LB_CEF3_ABI_VERSION_V4);
  assert(LB_CEF3_GetOperationCountV4() == 1577);
  const auto first_operation = LB_CEF3_GetOperationIdAtV4(0);
  assert(first_operation != 0);
  size_t operation_info_required = 0;
  assert(LB_CEF3_GetOperationInfoV4(first_operation, nullptr, 0, &operation_info_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring operation_info(operation_info_required, L'\0');
  assert(LB_CEF3_GetOperationInfoV4(first_operation, operation_info.data(), operation_info.size(),
                                    &operation_info_required) == LB_CEF3_OK);
  assert(operation_info.find(L"\"operationId\"") != std::wstring::npos);
  assert(LB_CEF3_GetOperationIdAtV4(LB_CEF3_GetOperationCountV4()) == 0);
  assert(LB_CEF3_IsInitialized() == 0);
  assert(LB_CEF3_RenderProcessHandlerGetLoadHandlerAvailable() == 1);
  LB_CEF3_CALL_V4 render_load_handler_call{};
  render_load_handler_call.struct_size = sizeof(render_load_handler_call);
  render_load_handler_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  render_load_handler_call.operation_id = UINT64_C(0x9210aba6f608884e);
  LB_CEF3_RESULT_V4 render_load_handler_result{};
  render_load_handler_result.struct_size = sizeof(render_load_handler_result);
  assert(LB_CEF3_InvokeV4(
             &render_load_handler_call, &render_load_handler_result)
      == LB_CEF3_OK);
  assert(render_load_handler_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(render_load_handler_result.integer_value == 1);
  render_load_handler_call.target = 1;
  assert(LB_CEF3_InvokeV4(
             &render_load_handler_call, &render_load_handler_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_DoMessageLoopWork() == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_BrowserCreate(nullptr) == 0);
  assert(LB_CEF3_BrowserReloadIgnoreCache(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserFind(0, L"missing", 1, 0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserFind(0, L"", 1, 0, 0) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserStopFinding(0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSetFocus(0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_MOUSE_EVENT_V3 invalid_mouse_event{};
  invalid_mouse_event.struct_size = sizeof(invalid_mouse_event);
  invalid_mouse_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  assert(LB_CEF3_BrowserSendMouseClickEvent(0, &invalid_mouse_event, 0, 0, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseClickEvent(0, nullptr, 0, 0, 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSendMouseClickEvent(0, &invalid_mouse_event, 3, 0, 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSendMouseMoveEvent(0, &invalid_mouse_event, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseMoveEvent(0, nullptr, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_MOUSE_EVENT_V3 invalid_mouse_move_event = invalid_mouse_event;
  invalid_mouse_move_event.abi_version = 0;
  assert(LB_CEF3_BrowserSendMouseMoveEvent(0, &invalid_mouse_move_event, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSendMouseWheelEvent(0, &invalid_mouse_event, 0, 120)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseWheelEvent(0, nullptr, 0, 120)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSendMouseWheelEvent(0, &invalid_mouse_move_event, 0, 120)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_TOUCH_EVENT_V3 invalid_touch_event{};
  invalid_touch_event.struct_size = sizeof(invalid_touch_event);
  invalid_touch_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  invalid_touch_event.id = 0;
  invalid_touch_event.pressure = 0.5f;
  invalid_touch_event.type = LB_CEF3_TOUCH_EVENT_PRESSED;
  invalid_touch_event.pointer_type = LB_CEF3_POINTER_TYPE_TOUCH;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendTouchEvent(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_touch_event.id = -1;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_touch_event.id = 0;
  invalid_touch_event.radius_x = -1.0f;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_touch_event.radius_x = 0.0f;
  invalid_touch_event.pressure = 1.1f;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_touch_event.pressure = 0.5f;
  invalid_touch_event.pointer_type = LB_CEF3_POINTER_TYPE_UNKNOWN + 1;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_touch_event.pointer_type = LB_CEF3_POINTER_TYPE_TOUCH;
  invalid_touch_event.abi_version = 0;
  assert(LB_CEF3_BrowserSendTouchEvent(0, &invalid_touch_event)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_KEY_EVENT_V3 invalid_key_event{};
  invalid_key_event.struct_size = sizeof(invalid_key_event);
  invalid_key_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  invalid_key_event.type = LB_CEF3_KEY_EVENT_KEY_UP;
  assert(LB_CEF3_BrowserSendKeyEvent(0, &invalid_key_event) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendKeyEvent(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_key_event.type = 99;
  assert(LB_CEF3_BrowserSendKeyEvent(0, &invalid_key_event) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserIsValid(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsPopup(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsSame(0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserHasDocument(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_HANDLE invalid_frame_result = UINT64_C(0x1234);
  assert(LB_CEF3_BrowserGetFocusedFrame(0, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(invalid_frame_result == UINT64_C(0x1234));
  assert(LB_CEF3_BrowserGetFocusedFrame(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetFrameByIdentifier(0, L"missing", &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameByIdentifier(0, nullptr, &invalid_frame_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetFrameByIdentifier(0, L"missing", nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetFrameByName(0, L"missing", &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameByName(0, nullptr, &invalid_frame_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  int64_t invalid_frame_count = 4321;
  assert(LB_CEF3_BrowserGetFrameCount(0, &invalid_frame_count)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(invalid_frame_count == 4321);
  assert(LB_CEF3_BrowserGetFrameCount(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetFrameIdentifiers(0, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameIdentifiers(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetFrameNames(0, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameNames(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameIsValid(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  for (const auto action : {
      LB_CEF3_FrameUndo, LB_CEF3_FrameRedo, LB_CEF3_FrameCut,
      LB_CEF3_FrameCopy, LB_CEF3_FramePaste, LB_CEF3_FramePasteAndMatchStyle,
      LB_CEF3_FrameDelete, LB_CEF3_FrameSelectAll, LB_CEF3_FrameViewSource}) {
    assert(action(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  }
  assert(LB_CEF3_FrameGetSource(0) == 0);
  assert(LB_CEF3_FrameGetText(0) == 0);
  assert(LB_CEF3_FrameLoadRequest(0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameLoadUrl(0, L"about:blank") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameLoadUrl(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameExecuteJavaScript(0, L"void 0", L"", 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameExecuteJavaScript(0, nullptr, L"", 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameExecuteJavaScript(0, L"void 0", L"", -1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameIsMain(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameIsFocused(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  std::array<wchar_t, 8> invalid_frame_text{};
  size_t invalid_frame_text_required = 0;
  assert(LB_CEF3_FrameGetName(
      0, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetIdentifier(
      0, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetUrl(
      0, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  invalid_frame_result = UINT64_C(0x1234);
  assert(LB_CEF3_FrameGetParent(0, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetParent(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameGetBrowser(0, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetBrowser(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameSendProcessMessage(0, 99, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_FrameSendProcessMessage(0, 1, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsWindowRenderingDisabled(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsFullscreen(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserHasView(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetOpenerIdentifier(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsReadyToBeClosed(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsRenderProcessUnresponsive(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetRuntimeStyle(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  double invalid_zoom_level = 123.0;
  assert(LB_CEF3_BrowserGetZoomLevel(0, &invalid_zoom_level) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(invalid_zoom_level == 123.0);
  assert(LB_CEF3_BrowserGetZoomLevel(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  double invalid_default_zoom_level = 456.0;
  assert(LB_CEF3_BrowserGetDefaultZoomLevel(0, &invalid_default_zoom_level) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(invalid_default_zoom_level == 456.0);
  assert(LB_CEF3_BrowserGetDefaultZoomLevel(0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSetZoomLevel(0, 0.0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSetZoomLevel(0, std::numeric_limits<double>::quiet_NaN()) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserCanZoom(0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserCanZoom(0, 3) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserZoom(0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserZoom(0, 3) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserTryClose(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserNotifyMoveOrResizeStarted(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendCaptureLostEvent(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserImeCancelComposition(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserImeFinishComposingText(0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserAddWordToDictionary(0, L"lingbuilder") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserAddWordToDictionary(0, L"") == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserReplaceMisspelling(0, L"lingbuilder") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserReplaceMisspelling(0, L"") == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserDragSourceSystemDragEnded(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserDragTargetDragLeave(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserWasHidden(0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserExitFullscreen(0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsAudioMuted(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleIsValid(0, LB_CEF3_HANDLE_BROWSER) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_INITIALIZE_CONFIG_V3 invalid_config{};
  invalid_config.struct_size = sizeof(invalid_config);
  invalid_config.abi_version = LB_CEF3_ABI_VERSION_V3;
  assert(LB_CEF3_Initialize(&invalid_config) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_SetCommandLineSwitch(
             L"", L"lingbuilder-test-switch", L"enabled") == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 command_line_switch_arguments[3]{};
  command_line_switch_arguments[0].struct_size = sizeof(command_line_switch_arguments[0]);
  command_line_switch_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_switch_arguments[0].text_value = L"";
  command_line_switch_arguments[1].struct_size = sizeof(command_line_switch_arguments[1]);
  command_line_switch_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_switch_arguments[1].text_value = L"lingbuilder-test-v4-switch";
  command_line_switch_arguments[2].struct_size = sizeof(command_line_switch_arguments[2]);
  command_line_switch_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_switch_arguments[2].text_value = L"v4-enabled";
  LB_CEF3_CALL_V4 command_line_switch_call{};
  command_line_switch_call.struct_size = sizeof(command_line_switch_call);
  command_line_switch_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_switch_call.operation_id = UINT64_C(0x19294ffce41eb759);
  command_line_switch_call.arguments = command_line_switch_arguments;
  command_line_switch_call.argument_count = 3;
  LB_CEF3_RESULT_V4 command_line_switch_result{};
  command_line_switch_result.struct_size = sizeof(command_line_switch_result);
  assert(LB_CEF3_InvokeV4(&command_line_switch_call, &command_line_switch_result) == LB_CEF3_OK);
  assert(command_line_switch_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
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
  constexpr int32_t kDirectLocalizedOverrideId = 0x7fffef00;
  constexpr int32_t kV4LocalizedOverrideId = 0x7fffef01;
  const int32_t kDirectDataOverrideId =
      LB_CEF3_IdForPackResourceName(L"IDR_CEF_LICENSE_TXT");
  const int32_t kV4DataOverrideId =
      LB_CEF3_IdForPackResourceName(L"IDR_CHROME_EXTENSION_API_FEATURES");
  const int32_t kDirectScaledDataOverrideId =
      LB_CEF3_IdForPackResourceName(L"IDR_CHROME_APP_API_FEATURES");
  const int32_t kV4ScaledDataOverrideId =
      LB_CEF3_IdForPackResourceName(
          L"IDR_CHROME_CONTROLLED_FRAME_API_FEATURES");
  assert(kDirectDataOverrideId >= 0 && kV4DataOverrideId >= 0
      && kDirectScaledDataOverrideId >= 0
      && kV4ScaledDataOverrideId >= 0);
  const std::array<unsigned char, 4> direct_resource_bytes = {
      0x4c, 0x42, 0x44, 0x31};
  const std::array<unsigned char, 5> v4_resource_bytes = {
      0x4c, 0x42, 0x56, 0x34, 0x21};
  const auto direct_resource_override = LB_CEF3_BufferCreate(
      direct_resource_bytes.data(), direct_resource_bytes.size());
  const auto v4_resource_override = LB_CEF3_BufferCreate(
      v4_resource_bytes.data(), v4_resource_bytes.size());
  assert(direct_resource_override != 0 && v4_resource_override != 0);
  assert(LB_CEF3_ResourceBundleHandlerSetLocalizedString(
             kDirectLocalizedOverrideId, L"LingBuilder direct resource")
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceBundleHandlerSetLocalizedString(
             kDirectLocalizedOverrideId, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceBundleHandlerSetDataResource(
             kDirectDataOverrideId, direct_resource_override)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceBundleHandlerSetDataResourceForScale(
             kDirectScaledDataOverrideId, 1, direct_resource_override)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceBundleHandlerSetDataResourceForScale(
             kDirectScaledDataOverrideId, 10, direct_resource_override)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  std::array<LB_CEF3_ARGUMENT_V4, 3> resource_handler_arguments{};
  for (auto& argument : resource_handler_arguments)
    argument.struct_size = sizeof(argument);
  resource_handler_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  resource_handler_arguments[0].integer_value = kV4LocalizedOverrideId;
  resource_handler_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resource_handler_arguments[1].text_value = L"LingBuilder v4 resource";
  LB_CEF3_CALL_V4 resource_handler_call{};
  resource_handler_call.struct_size = sizeof(resource_handler_call);
  resource_handler_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  resource_handler_call.operation_id = UINT64_C(0xf71bf41160b11325);
  resource_handler_call.arguments = resource_handler_arguments.data();
  resource_handler_call.argument_count = 2;
  LB_CEF3_RESULT_V4 resource_handler_result{};
  resource_handler_result.struct_size = sizeof(resource_handler_result);
  assert(LB_CEF3_InvokeV4(
             &resource_handler_call, &resource_handler_result) == LB_CEF3_OK);
  assert(resource_handler_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  resource_handler_arguments[0].integer_value = kV4DataOverrideId;
  resource_handler_arguments[1].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  resource_handler_arguments[1].buffer_value = v4_resource_override;
  resource_handler_call.operation_id = UINT64_C(0xa5590083052bb1af);
  resource_handler_result = {};
  resource_handler_result.struct_size = sizeof(resource_handler_result);
  assert(LB_CEF3_InvokeV4(
             &resource_handler_call, &resource_handler_result) == LB_CEF3_OK);
  assert(resource_handler_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  resource_handler_arguments[0].integer_value = kV4ScaledDataOverrideId;
  resource_handler_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  resource_handler_arguments[1].integer_value = 1;
  resource_handler_arguments[2].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  resource_handler_arguments[2].buffer_value = v4_resource_override;
  resource_handler_call.operation_id = UINT64_C(0x41b73940d3e6a1cd);
  resource_handler_call.argument_count = 3;
  resource_handler_result = {};
  resource_handler_result.struct_size = sizeof(resource_handler_result);
  assert(LB_CEF3_InvokeV4(
             &resource_handler_call, &resource_handler_result) == LB_CEF3_OK);
  assert(resource_handler_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_BufferRelease(direct_resource_override) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(v4_resource_override) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: initialize\n");
  std::fflush(stderr);
  // JS 交互通道必须在 CEF 初始化之前注册；这里赶在 LB_CEF3_Initialize 前启用，
  // 并验证初始化后的重复/异名注册与无 pending 应答都会被拒绝。
  assert(LB_CEF3_EnableJsQuery(L"cefQuery", L"cefQueryCancel") == LB_CEF3_OK);
  assert(LB_CEF3_EnableJsQuery(L"cefQuery", L"cefQueryCancel") == LB_CEF3_OK);
  assert(LB_CEF3_Initialize(&config) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: initialized\n");
  std::fflush(stderr);
  assert(LB_CEF3_IsInitialized() == 1);
  assert(LB_CEF3_EnableJsQuery(L"cefQuery", L"cefQueryCancel")
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_EnableJsQuery(L"otherQuery", L"otherQueryCancel")
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_JsQueryRespond(0, L"1", 1, L"x", 0, L"")
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_JsQueryRespond(0, L"not-a-number", 1, L"x", 0, L"")
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_JsQueryRespond(0, nullptr, 1, L"x", 0, L"")
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  // Execute the negative ABI paths for wrappers whose successful behavior is
  // covered by the object-specific tests below. These probes verify that every
  // exported entry point rejects an untyped/invalid handle without exposing a
  // native CEF object or crashing the process.
  LB_CEF3_HANDLE abi_probe_handle = 0;
  LB_CEF3_TASK_HANDLE abi_probe_task = 0;
  int32_t abi_probe_integer = 0;
  (void)LB_CEF3_ResourceHandlerSetAsyncSkip(0, 1);
  (void)LB_CEF3_ResourceHandlerSetLegacyRead(0, 1);
  (void)LB_CEF3_ResourceHandlerSubscribeCancel(0, 1);
  (void)LB_CEF3_ServerNextDestroyed(0, &abi_probe_task);
  (void)LB_CEF3_ServerNextWebSocketRequest(0, &abi_probe_task);
  (void)LB_CEF3_ServerNextWebSocketConnected(0, &abi_probe_task);
  (void)LB_CEF3_ServerNextWebSocketMessage(0, &abi_probe_task);
  (void)LB_CEF3_ServerSendHttp404Response(0, 0);
  (void)LB_CEF3_ServerSendHttp500Response(0, 0, L"probe");
  (void)LB_CEF3_ServerSendWebSocketMessage(0, 0, 0);
  (void)LB_CEF3_ServerShutdown(0);
  (void)LB_CEF3_StringVisitorVisit(0, L"probe");
  (void)LB_CEF3_UrlRequestClientNextAuthCredentials(0, &abi_probe_task);
  (void)LB_CEF3_UrlRequestClientNextDownloadProgress(0, &abi_probe_task);
  (void)LB_CEF3_UrlRequestClientNextUploadProgress(0, &abi_probe_task);
  (void)LB_CEF3_UrlRequestCancel(0);
  (void)LB_CEF3_UrlRequestGetRequestError(0, &abi_probe_integer);
  (void)LB_CEF3_UrlRequestGetRequestStatus(0, &abi_probe_integer);
  (void)LB_CEF3_UrlRequestGetResponse(0, &abi_probe_handle);
  (void)LB_CEF3_UrlRequestResponseWasCached(0);
  (void)LB_CEF3_WindowShowAsBrowserModalDialog(0, 0);
  assert(LB_CEF3_MessageRouterCreate(&abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceManagerCreate(&abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(abi_probe_handle) == LB_CEF3_OK);
  (void)LB_CEF3_StreamResourceHandlerCreate(L"text/plain", 0, &abi_probe_handle);
  assert(LB_CEF3_XmlObjectCreate(L"probe", &abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_ZipArchiveCreate(&abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(abi_probe_handle) == LB_CEF3_OK);
  assert(LB_CEF3_V8GlobalInvoke(nullptr) == 0);
  assert(LB_CEF3_V8ContextInvoke(nullptr) == 0);
  assert(LB_CEF3_V8ValueInvoke(nullptr) == 0);
  assert(LB_CEF3_V8ExceptionInvoke(nullptr) == 0);
  assert(LB_CEF3_V8StackTraceInvoke(nullptr) == 0);
  assert(LB_CEF3_V8StackFrameInvoke(nullptr) == 0);
  assert(LB_CEF3_V8BackingStoreInvoke(nullptr) == 0);
  assert(LB_CEF3_V8AccessorInvoke(nullptr) == 0);
  assert(LB_CEF3_V8InterceptorInvoke(nullptr) == 0);
  assert(LB_CEF3_V8ArrayBufferReleaseCallbackInvoke(nullptr) == 0);
  assert(LB_CEF3_V8RegisterExtension(nullptr, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_HANDLE resource_bundle = 0;
  assert(LB_CEF3_ResourceBundleGetGlobal(nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceBundleGetGlobal(&resource_bundle) == LB_CEF3_OK);
  assert(resource_bundle != 0);
  assert(LB_CEF3_HandleIsValid(resource_bundle, LB_CEF3_HANDLE_RESOURCE_BUNDLE)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceBundleHandlerSetLocalizedString(
             kDirectLocalizedOverrideId, L"late mutation")
      == LB_CEF3_ERROR_OPERATION_FAILED);
  const auto read_resource_override_text = [&](int32_t id) {
    size_t text_required = 0;
    assert(LB_CEF3_ResourceBundleGetLocalizedString(
               resource_bundle, id, nullptr, 0, &text_required)
        == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
    std::vector<wchar_t> text(text_required, L'\0');
    assert(LB_CEF3_ResourceBundleGetLocalizedString(
               resource_bundle, id, text.data(), text.size(), &text_required)
        == LB_CEF3_OK);
    return std::wstring(text.data());
  };
  assert(read_resource_override_text(kDirectLocalizedOverrideId)
      == L"LingBuilder direct resource");
  assert(read_resource_override_text(kV4LocalizedOverrideId)
      == L"LingBuilder v4 resource");

  const auto assert_resource_override_bytes = [&] (
      int32_t id, bool scaled, const auto& expected) {
    LB_CEF3_BUFFER_HANDLE value = 0;
    const int status = scaled
        ? LB_CEF3_ResourceBundleGetDataResourceForScale(
              resource_bundle, id, 1, &value)
        : LB_CEF3_ResourceBundleGetDataResource(resource_bundle, id, &value);
    assert(status == LB_CEF3_OK);
    assert(value != 0);
    size_t byte_count = 0;
    std::array<unsigned char, 16> bytes{};
    assert(LB_CEF3_BufferCopy(
               value, bytes.data(), bytes.size(), &byte_count) == LB_CEF3_OK);
    assert(byte_count == expected.size());
    assert(std::equal(
        expected.begin(), expected.end(), bytes.begin(), bytes.begin() + byte_count));
    assert(LB_CEF3_BufferRelease(value) == LB_CEF3_OK);
  };
  assert_resource_override_bytes(
      kDirectDataOverrideId, false, direct_resource_bytes);
  assert_resource_override_bytes(
      kV4DataOverrideId, false, v4_resource_bytes);
  assert_resource_override_bytes(
      kDirectScaledDataOverrideId, true, direct_resource_bytes);
  assert_resource_override_bytes(
      kV4ScaledDataOverrideId, true, v4_resource_bytes);
  const int localized_string_id = LB_CEF3_IdForPackStringName(L"IDS_PRODUCT_NAME");
  const int string_id = localized_string_id >= 0
      ? localized_string_id : std::numeric_limits<int32_t>::max();
  size_t resource_text_required = 0;
  assert(LB_CEF3_ResourceBundleGetLocalizedString(
      resource_bundle, string_id, nullptr, 0, &resource_text_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(resource_text_required >= 1);
  std::vector<wchar_t> resource_text(resource_text_required, L'\0');
  assert(LB_CEF3_ResourceBundleGetLocalizedString(
      resource_bundle, string_id, resource_text.data(), resource_text.size(),
      &resource_text_required) == LB_CEF3_OK);
  LB_CEF3_BUFFER_HANDLE resource_buffer = UINT64_MAX;
  assert(LB_CEF3_ResourceBundleGetDataResource(
      resource_bundle, std::numeric_limits<int32_t>::max(), &resource_buffer)
      == LB_CEF3_OK);
  assert(resource_buffer == 0);
  assert(LB_CEF3_ResourceBundleGetDataResource(
      resource_bundle, 0, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceBundleGetDataResourceForScale(
      resource_bundle, std::numeric_limits<int32_t>::max(), 0, &resource_buffer)
      == LB_CEF3_OK);
  assert(resource_buffer == 0);
  assert(LB_CEF3_ResourceBundleGetDataResourceForScale(
      resource_bundle, 0, 10, &resource_buffer) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto wrong_resource_bundle = LB_CEF3_BufferCreate(nullptr, 0);
  assert(wrong_resource_bundle != 0);
  assert(LB_CEF3_ResourceBundleGetLocalizedString(
      wrong_resource_bundle, string_id, nullptr, 0, &resource_text_required)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_BufferRelease(wrong_resource_bundle) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 resource_bundle_call{};
  resource_bundle_call.struct_size = sizeof(resource_bundle_call);
  resource_bundle_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  resource_bundle_call.operation_id = UINT64_C(0xd4133ca5200e1c68);
  LB_CEF3_RESULT_V4 resource_bundle_result{};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result) == LB_CEF3_OK);
  assert(resource_bundle_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto resource_bundle_v4 = resource_bundle_result.handle_value;
  assert(resource_bundle_v4 != 0);

  LB_CEF3_ARGUMENT_V4 resource_argument{};
  resource_argument.struct_size = sizeof(resource_argument);
  resource_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  resource_argument.integer_value = string_id;
  resource_bundle_call.target = resource_bundle_v4;
  resource_bundle_call.operation_id = UINT64_C(0x3132d1abb9212c6e);
  resource_bundle_call.arguments = &resource_argument;
  resource_bundle_call.argument_count = 1;
  resource_bundle_result = {};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(resource_bundle_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  std::vector<wchar_t> resource_text_v4(resource_bundle_result.text_required, L'\0');
  resource_bundle_result = {};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  resource_bundle_result.text = resource_text_v4.data();
  resource_bundle_result.text_capacity = resource_text_v4.size();
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result) == LB_CEF3_OK);

  resource_argument.integer_value = std::numeric_limits<int32_t>::max();
  resource_bundle_call.operation_id = UINT64_C(0xc4b2066bdc33839c);
  resource_bundle_result = {};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result) == LB_CEF3_OK);
  assert(resource_bundle_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(resource_bundle_result.buffer_value == 0);

  LB_CEF3_ARGUMENT_V4 scaled_resource_arguments[2]{};
  scaled_resource_arguments[0] = resource_argument;
  scaled_resource_arguments[1].struct_size = sizeof(scaled_resource_arguments[1]);
  scaled_resource_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  scaled_resource_arguments[1].integer_value = 0;
  resource_bundle_call.operation_id = UINT64_C(0xf4269c22713cad14);
  resource_bundle_call.arguments = scaled_resource_arguments;
  resource_bundle_call.argument_count = 2;
  resource_bundle_result = {};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result) == LB_CEF3_OK);
  assert(resource_bundle_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(resource_bundle_result.buffer_value == 0);
  scaled_resource_arguments[1].integer_value = 10;
  resource_bundle_result = {};
  resource_bundle_result.struct_size = sizeof(resource_bundle_result);
  assert(LB_CEF3_InvokeV4(&resource_bundle_call, &resource_bundle_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_HandleRelease(resource_bundle_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(resource_bundle) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceBundleGetLocalizedString(
      resource_bundle, string_id, nullptr, 0, &resource_text_required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  std::array<wchar_t, 8> minimal_shutdown_flag{};
  const auto minimal_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_MINIMAL_SHUTDOWN", minimal_shutdown_flag.data(),
      static_cast<DWORD>(minimal_shutdown_flag.size()));
  if (minimal_shutdown_flag_length == 1 && minimal_shutdown_flag[0] == L'1') {
    std::fprintf(stderr, "CEF3 test checkpoint: minimal-shutdown\n");
    std::fflush(stderr);
    assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
    std::fprintf(stderr, "CEF3 test checkpoint: minimal-shutdown-complete\n");
    std::fflush(stderr);
    return 0;
  }
  std::array<wchar_t, 8> browser_shutdown_flag{};
  const auto browser_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_BROWSER_SHUTDOWN", browser_shutdown_flag.data(),
      static_cast<DWORD>(browser_shutdown_flag.size()));
  std::array<wchar_t, 8> evaluate_shutdown_flag{};
  const auto evaluate_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_EVALUATE_SHUTDOWN", evaluate_shutdown_flag.data(),
      static_cast<DWORD>(evaluate_shutdown_flag.size()));
  std::array<wchar_t, 8> pending_evaluate_shutdown_flag{};
  const auto pending_evaluate_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_PENDING_EVALUATE_SHUTDOWN", pending_evaluate_shutdown_flag.data(),
      static_cast<DWORD>(pending_evaluate_shutdown_flag.size()));
  std::array<wchar_t, 8> osr_shutdown_flag{};
  const auto osr_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_OSR_SHUTDOWN", osr_shutdown_flag.data(),
      static_cast<DWORD>(osr_shutdown_flag.size()));
  std::array<wchar_t, 8> active_browser_shutdown_flag{};
  const auto active_browser_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_ACTIVE_BROWSER_SHUTDOWN", active_browser_shutdown_flag.data(),
      static_cast<DWORD>(active_browser_shutdown_flag.size()));
  const bool run_minimal_browser_shutdown = browser_shutdown_flag_length == 1
      && browser_shutdown_flag[0] == L'1';
  const bool run_evaluate_shutdown = evaluate_shutdown_flag_length == 1
      && evaluate_shutdown_flag[0] == L'1';
  const bool run_pending_evaluate_shutdown = pending_evaluate_shutdown_flag_length == 1
      && pending_evaluate_shutdown_flag[0] == L'1';
  const bool run_osr_shutdown = osr_shutdown_flag_length == 1 && osr_shutdown_flag[0] == L'1';
  const bool run_active_browser_shutdown = active_browser_shutdown_flag_length == 1
      && active_browser_shutdown_flag[0] == L'1';
  if (run_minimal_browser_shutdown || run_evaluate_shutdown || run_pending_evaluate_shutdown
      || run_osr_shutdown || run_active_browser_shutdown) {
    const auto host = CreateWindowExW(0, L"STATIC", L"CEF3最小生命周期测试", WS_OVERLAPPEDWINDOW,
                                      0, 0, 320, 240, nullptr, nullptr,
                                      GetModuleHandleW(nullptr), nullptr);
    assert(host != nullptr);
    LB_CEF3_BROWSER_CONFIG_V3 browser_config{};
    browser_config.struct_size = sizeof(browser_config);
    browser_config.abi_version = LB_CEF3_ABI_VERSION_V3;
    browser_config.parent_window = reinterpret_cast<uint64_t>(host);
    browser_config.initial_url = L"about:blank";
    browser_config.profile_key = run_osr_shutdown ? L"minimal-osr-shutdown"
                                                  : L"minimal-browser-shutdown";
    browser_config.flags = LB_CEF3_BROWSER_JAVASCRIPT
        | (run_osr_shutdown ? LB_CEF3_BROWSER_WINDOWLESS : 0);
    const auto browser = LB_CEF3_BrowserCreate(&browser_config);
    assert(browser != 0);
    const auto created_deadline = GetTickCount64() + 30000;
    while (g_browser_created_events.load() < 1 && GetTickCount64() < created_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_created_events.load() >= 1);
    if (run_active_browser_shutdown) {
      std::fprintf(stderr, "CEF3 test checkpoint: active-browser-shutdown\n");
      std::fflush(stderr);
      assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
      if (IsWindow(host)) assert(DestroyWindow(host) != 0);
      std::fprintf(stderr, "CEF3 test checkpoint: active-browser-shutdown-complete\n");
      std::fflush(stderr);
      return 0;
    }
    if (run_evaluate_shutdown || run_pending_evaluate_shutdown) {
      const auto document_deadline = GetTickCount64() + 5000;
      while (LB_CEF3_BrowserHasDocument(browser) != 1 && GetTickCount64() < document_deadline) {
        PumpHostMessages();
        Sleep(10);
      }
      assert(LB_CEF3_BrowserHasDocument(browser) == 1);
      const auto evaluate_task = LB_CEF3_BrowserEvaluateJavaScript(
          browser, run_pending_evaluate_shutdown ? L"new Promise(() => {})" : L"'minimal-evaluate'");
      assert(evaluate_task != 0);
      if (run_pending_evaluate_shutdown) {
        const auto running_deadline = GetTickCount64() + 1000;
        while (LB_CEF3_TaskGetStatus(evaluate_task) == LB_CEF3_TASK_PENDING
            && GetTickCount64() < running_deadline) {
          PumpHostMessages();
          Sleep(10);
        }
        assert(LB_CEF3_TaskGetStatus(evaluate_task) == LB_CEF3_TASK_RUNNING);
      } else {
        assert(WaitTask(evaluate_task) == LB_CEF3_TASK_SUCCEEDED);
      }
      assert(LB_CEF3_TaskRelease(evaluate_task) == LB_CEF3_OK);
    }
    assert(LB_CEF3_BrowserClose(browser, 1) == LB_CEF3_OK);
    const auto closed_deadline = GetTickCount64() + 10000;
    while (g_browser_closed_events.load() < 1 && GetTickCount64() < closed_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_closed_events.load() >= 1);
    assert(LB_CEF3_HandleRelease(browser) == LB_CEF3_OK);
    if (IsWindow(host)) assert(DestroyWindow(host) != 0);
    std::fprintf(stderr, "CEF3 test checkpoint: %s\n", run_osr_shutdown
                 ? "minimal-osr-shutdown"
                 : (run_pending_evaluate_shutdown ? "minimal-pending-evaluate-shutdown"
                    : (run_evaluate_shutdown ? "minimal-evaluate-shutdown"
                                             : "minimal-browser-shutdown")));
    std::fflush(stderr);
    assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
    std::fprintf(stderr, "CEF3 test checkpoint: %s\n", run_osr_shutdown
                 ? "minimal-osr-shutdown-complete"
                 : (run_pending_evaluate_shutdown ? "minimal-pending-evaluate-shutdown-complete"
                    : (run_evaluate_shutdown ? "minimal-evaluate-shutdown-complete"
                                             : "minimal-browser-shutdown-complete")));
    std::fflush(stderr);
    return 0;
  }
  std::array<wchar_t, 8> try_close_shutdown_flag{};
  const auto try_close_shutdown_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_TRY_CLOSE_SHUTDOWN", try_close_shutdown_flag.data(),
      static_cast<DWORD>(try_close_shutdown_flag.size()));
  if (try_close_shutdown_flag_length == 1 && try_close_shutdown_flag[0] == L'1') {
    const auto host = CreateWindowExW(0, L"STATIC", L"CEF3 TryClose 生命周期测试", WS_OVERLAPPEDWINDOW,
                                      0, 0, 320, 240, nullptr, nullptr,
                                      GetModuleHandleW(nullptr), nullptr);
    assert(host != nullptr);
    LB_CEF3_BROWSER_CONFIG_V3 browser_config{};
    browser_config.struct_size = sizeof(browser_config);
    browser_config.abi_version = LB_CEF3_ABI_VERSION_V3;
    browser_config.parent_window = reinterpret_cast<uint64_t>(host);
    browser_config.initial_url = L"about:blank";
    browser_config.profile_key = L"try-close-browser-shutdown";
    browser_config.flags = LB_CEF3_BROWSER_JAVASCRIPT;
    const auto browser = LB_CEF3_BrowserCreate(&browser_config);
    assert(browser != 0);
    const auto created_deadline = GetTickCount64() + 30000;
    while (g_browser_created_events.load() < 1 && GetTickCount64() < created_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_created_events.load() >= 1);
    const int try_close = LB_CEF3_BrowserTryClose(browser);
    assert(try_close == 0 || try_close == 1);
    if (try_close == 1) assert(DestroyWindow(host) != 0);
    else assert(LB_CEF3_BrowserClose(browser, 1) == LB_CEF3_OK);
    const auto closed_deadline = GetTickCount64() + 10000;
    while (g_browser_closed_events.load() < 1 && GetTickCount64() < closed_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_closed_events.load() >= 1);
    assert(LB_CEF3_HandleRelease(browser) == LB_CEF3_OK);
    if (IsWindow(host)) assert(DestroyWindow(host) != 0);
    std::fprintf(stderr, "CEF3 test checkpoint: try-close-browser-shutdown result=%d\n", try_close);
    std::fflush(stderr);
    assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
    std::fprintf(stderr, "CEF3 test checkpoint: try-close-browser-shutdown-complete\n");
    std::fflush(stderr);
    return 0;
  }
  const bool run_multi_browser_shutdown = IsTestFlagEnabled(L"LB_CEF3_TEST_MULTI_BROWSER_SHUTDOWN");
  const bool run_multi_browser_osr_shutdown =
      IsTestFlagEnabled(L"LB_CEF3_TEST_MULTI_BROWSER_OSR_SHUTDOWN");
  if (run_multi_browser_shutdown || run_multi_browser_osr_shutdown) {
    const auto host_a = CreateWindowExW(0, L"STATIC", L"CEF3 multi lifecycle A", WS_OVERLAPPEDWINDOW,
                                        0, 0, 320, 240, nullptr, nullptr,
                                        GetModuleHandleW(nullptr), nullptr);
    const auto host_b = CreateWindowExW(0, L"STATIC", L"CEF3 multi lifecycle B", WS_OVERLAPPEDWINDOW,
                                        0, 0, 320, 240, nullptr, nullptr,
                                        GetModuleHandleW(nullptr), nullptr);
    const auto host_osr = run_multi_browser_osr_shutdown
        ? CreateWindowExW(0, L"STATIC", L"CEF3 multi lifecycle OSR", WS_OVERLAPPEDWINDOW,
                          0, 0, 320, 240, nullptr, nullptr,
                          GetModuleHandleW(nullptr), nullptr)
        : nullptr;
    assert(host_a != nullptr && host_b != nullptr
        && (!run_multi_browser_osr_shutdown || host_osr != nullptr));
    LB_CEF3_BROWSER_CONFIG_V3 browser_config{};
    browser_config.struct_size = sizeof(browser_config);
    browser_config.abi_version = LB_CEF3_ABI_VERSION_V3;
    browser_config.parent_window = reinterpret_cast<uint64_t>(host_a);
    browser_config.initial_url = L"about:blank";
    browser_config.profile_key = L"multi-browser-shutdown-a";
    browser_config.flags = LB_CEF3_BROWSER_JAVASCRIPT;
    const auto browser_a = LB_CEF3_BrowserCreate(&browser_config);
    browser_config.parent_window = reinterpret_cast<uint64_t>(host_b);
    browser_config.profile_key = L"multi-browser-shutdown-b";
    const auto browser_b = LB_CEF3_BrowserCreate(&browser_config);
    LB_CEF3_HANDLE browser_osr = 0;
    if (run_multi_browser_osr_shutdown) {
      browser_config.parent_window = reinterpret_cast<uint64_t>(host_osr);
      browser_config.profile_key = L"multi-browser-shutdown-osr";
      browser_config.flags = LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_WINDOWLESS;
      browser_osr = LB_CEF3_BrowserCreate(&browser_config);
    }
    assert(browser_a != 0 && browser_b != 0
        && (!run_multi_browser_osr_shutdown || browser_osr != 0));
    const int expected_browser_count = run_multi_browser_osr_shutdown ? 3 : 2;
    const auto created_deadline = GetTickCount64() + 30000;
    while (g_browser_created_events.load() < expected_browser_count
        && GetTickCount64() < created_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_created_events.load() >= expected_browser_count);
    assert(LB_CEF3_BrowserClose(browser_a, 1) == LB_CEF3_OK);
    assert(LB_CEF3_BrowserClose(browser_b, 1) == LB_CEF3_OK);
    if (browser_osr != 0) assert(LB_CEF3_BrowserClose(browser_osr, 1) == LB_CEF3_OK);
    const auto closed_deadline = GetTickCount64() + 10000;
    while (g_browser_closed_events.load() < expected_browser_count
        && GetTickCount64() < closed_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_closed_events.load() >= expected_browser_count);
    assert(LB_CEF3_HandleRelease(browser_a) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(browser_b) == LB_CEF3_OK);
    if (browser_osr != 0) assert(LB_CEF3_HandleRelease(browser_osr) == LB_CEF3_OK);
    assert(DestroyWindow(host_a) != 0);
    assert(DestroyWindow(host_b) != 0);
    if (host_osr) assert(DestroyWindow(host_osr) != 0);
    std::fprintf(stderr, "CEF3 test checkpoint: multi-browser%s-shutdown\n",
                 run_multi_browser_osr_shutdown ? "-osr" : "");
    std::fflush(stderr);
    assert(LB_CEF3_Shutdown() == LB_CEF3_OK);
    std::fprintf(stderr, "CEF3 test checkpoint: multi-browser%s-shutdown-complete\n",
                 run_multi_browser_osr_shutdown ? "-osr" : "");
    std::fflush(stderr);
    return 0;
  }
  assert(LB_CEF3_DoMessageLoopWork() == LB_CEF3_OK);
  assert(LB_CEF3_RunMessageLoop() == LB_CEF3_ERROR_NOT_SUPPORTED);
  assert(LB_CEF3_QuitMessageLoop() == LB_CEF3_ERROR_NOT_SUPPORTED);
  LB_CEF3_HANDLE browser_by_identifier = 0;
  assert(LB_CEF3_BrowserHostGetBrowserByIdentifier(
      INT32_MAX, &browser_by_identifier) == LB_CEF3_OK);
  assert(browser_by_identifier == 0);
  assert(LB_CEF3_BrowserHostGetBrowserByIdentifier(
      -1, &browser_by_identifier) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_CALL_V4 message_loop_call{};
  message_loop_call.struct_size = sizeof(message_loop_call);
  message_loop_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  message_loop_call.operation_id = UINT64_C(0x4224617d876bdcc5);
  LB_CEF3_RESULT_V4 message_loop_result{};
  message_loop_result.struct_size = sizeof(message_loop_result);
  assert(LB_CEF3_InvokeV4(&message_loop_call, &message_loop_result) == LB_CEF3_OK);
  assert(message_loop_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_CALL_V4 run_message_loop_call{};
  run_message_loop_call.struct_size = sizeof(run_message_loop_call);
  run_message_loop_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  run_message_loop_call.operation_id = UINT64_C(0x35c671725e9a2b92);
  LB_CEF3_RESULT_V4 run_message_loop_result{};
  run_message_loop_result.struct_size = sizeof(run_message_loop_result);
  assert(LB_CEF3_InvokeV4(&run_message_loop_call, &run_message_loop_result)
      == LB_CEF3_ERROR_NOT_SUPPORTED);
  assert(run_message_loop_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_CALL_V4 browser_by_identifier_call{};
  browser_by_identifier_call.struct_size = sizeof(browser_by_identifier_call);
  browser_by_identifier_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  browser_by_identifier_call.operation_id = UINT64_C(0x642ce304f3d2601a);
  LB_CEF3_ARGUMENT_V4 message_loop_browser_id_argument{};
  message_loop_browser_id_argument.struct_size = sizeof(message_loop_browser_id_argument);
  message_loop_browser_id_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  message_loop_browser_id_argument.integer_value = INT32_MAX;
  browser_by_identifier_call.arguments = &message_loop_browser_id_argument;
  browser_by_identifier_call.argument_count = 1;
  LB_CEF3_RESULT_V4 browser_by_identifier_result{};
  browser_by_identifier_result.struct_size = sizeof(browser_by_identifier_result);
  assert(LB_CEF3_InvokeV4(&browser_by_identifier_call, &browser_by_identifier_result)
      == LB_CEF3_OK);
  assert(browser_by_identifier_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(browser_by_identifier_result.handle_value == 0);

  const auto trace_file = root / L"cef3-native-trace.json";
  const auto trace_file_v4 = root / L"cef3-native-trace-v4.json";
  LB_CEF3_CALL_V4 begin_tracing_invalid_call{};
  begin_tracing_invalid_call.struct_size = sizeof(begin_tracing_invalid_call);
  begin_tracing_invalid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  begin_tracing_invalid_call.operation_id = UINT64_C(0x18ddd67778c7bd65);
  LB_CEF3_RESULT_V4 begin_tracing_invalid_result{};
  begin_tracing_invalid_result.struct_size = sizeof(begin_tracing_invalid_result);
  assert(LB_CEF3_InvokeV4(&begin_tracing_invalid_call, &begin_tracing_invalid_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(begin_tracing_invalid_result.status == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 begin_tracing_argument{};
  begin_tracing_argument.struct_size = sizeof(begin_tracing_argument);
  begin_tracing_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  begin_tracing_argument.text_value = L"cef,devtools.timeline";
  LB_CEF3_CALL_V4 begin_tracing_call{};
  begin_tracing_call.struct_size = sizeof(begin_tracing_call);
  begin_tracing_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  begin_tracing_call.operation_id = UINT64_C(0x18ddd67778c7bd65);
  begin_tracing_call.arguments = &begin_tracing_argument;
  begin_tracing_call.argument_count = 1;
  LB_CEF3_RESULT_V4 begin_tracing_result{};
  begin_tracing_result.struct_size = sizeof(begin_tracing_result);
  assert(LB_CEF3_InvokeV4(&begin_tracing_call, &begin_tracing_result) == LB_CEF3_OK);
  assert(begin_tracing_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto begin_tracing_task = begin_tracing_result.handle_value;
  assert(begin_tracing_task != 0);
  const int begin_tracing_status = WaitTask(begin_tracing_task, 30000);
  if (begin_tracing_status != LB_CEF3_TASK_SUCCEEDED) {
    std::fwprintf(stderr, L"CEF3 BeginTracing failed: status=%d error=%ls\n",
                  begin_tracing_status, TaskError(begin_tracing_task).c_str());
    std::fflush(stderr);
  }
  assert(begin_tracing_status == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(begin_tracing_task).find(L"\"started\":true") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(begin_tracing_task) == LB_CEF3_OK);
  const auto end_tracing_task = LB_CEF3_EndTracing(trace_file.c_str());
  assert(end_tracing_task != 0);
  const int end_tracing_status = WaitTask(end_tracing_task, 30000);
  if (end_tracing_status != LB_CEF3_TASK_SUCCEEDED) {
    std::fwprintf(stderr, L"CEF3 EndTracing failed: status=%d error=%ls\n",
                  end_tracing_status, TaskError(end_tracing_task).c_str());
    std::fflush(stderr);
  }
  assert(end_tracing_status == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(end_tracing_task).find(L"cef3-native-trace.json") != std::wstring::npos);
  assert(std::filesystem::is_regular_file(trace_file));
  assert(LB_CEF3_TaskRelease(end_tracing_task) == LB_CEF3_OK);

  const auto begin_tracing_v3_task = LB_CEF3_BeginTracing(L"cef,devtools.timeline");
  assert(begin_tracing_v3_task != 0);
  assert(WaitTask(begin_tracing_v3_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(begin_tracing_v3_task) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 end_tracing_wrong_argument{};
  end_tracing_wrong_argument.struct_size = sizeof(end_tracing_wrong_argument);
  end_tracing_wrong_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  end_tracing_wrong_argument.integer_value = 1;
  LB_CEF3_CALL_V4 end_tracing_invalid_call{};
  end_tracing_invalid_call.struct_size = sizeof(end_tracing_invalid_call);
  end_tracing_invalid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  end_tracing_invalid_call.operation_id = UINT64_C(0xa464c4b67335400f);
  end_tracing_invalid_call.arguments = &end_tracing_wrong_argument;
  end_tracing_invalid_call.argument_count = 1;
  LB_CEF3_RESULT_V4 end_tracing_invalid_result{};
  end_tracing_invalid_result.struct_size = sizeof(end_tracing_invalid_result);
  assert(LB_CEF3_InvokeV4(&end_tracing_invalid_call, &end_tracing_invalid_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(end_tracing_invalid_result.status == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 end_tracing_argument{};
  end_tracing_argument.struct_size = sizeof(end_tracing_argument);
  end_tracing_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  end_tracing_argument.text_value = trace_file_v4.c_str();
  LB_CEF3_CALL_V4 end_tracing_call{};
  end_tracing_call.struct_size = sizeof(end_tracing_call);
  end_tracing_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  end_tracing_call.operation_id = UINT64_C(0xa464c4b67335400f);
  end_tracing_call.arguments = &end_tracing_argument;
  end_tracing_call.argument_count = 1;
  LB_CEF3_RESULT_V4 end_tracing_result{};
  end_tracing_result.struct_size = sizeof(end_tracing_result);
  assert(LB_CEF3_InvokeV4(&end_tracing_call, &end_tracing_result) == LB_CEF3_OK);
  assert(end_tracing_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto end_tracing_v4_task = end_tracing_result.handle_value;
  assert(end_tracing_v4_task != 0);
  const int end_tracing_v4_status = WaitTask(end_tracing_v4_task, 30000);
  if (end_tracing_v4_status != LB_CEF3_TASK_SUCCEEDED) {
    std::fwprintf(stderr, L"CEF3 EndTracing v4 failed: status=%d error=%ls\n",
                  end_tracing_v4_status, TaskError(end_tracing_v4_task).c_str());
    std::fflush(stderr);
  }
  assert(end_tracing_v4_status == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(end_tracing_v4_task).find(L"cef3-native-trace-v4.json") != std::wstring::npos);
  assert(std::filesystem::is_regular_file(trace_file_v4));
  assert(LB_CEF3_TaskRelease(end_tracing_v4_task) == LB_CEF3_OK);

  const auto direct_global_command_line = LB_CEF3_CommandLineGetGlobal();
  assert(direct_global_command_line != 0);
  assert(LB_CEF3_CommandLineIsReadOnly(direct_global_command_line) == 1);
  assert(LB_CEF3_CommandLineRelease(direct_global_command_line) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 global_command_line_call{};
  global_command_line_call.struct_size = sizeof(global_command_line_call);
  global_command_line_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  global_command_line_call.operation_id = UINT64_C(0x46c93b1ac6d6f8b2);
  LB_CEF3_RESULT_V4 global_command_line_result{};
  global_command_line_result.struct_size = sizeof(global_command_line_result);
  assert(LB_CEF3_InvokeV4(&global_command_line_call, &global_command_line_result) == LB_CEF3_OK);
  assert(global_command_line_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(global_command_line_result.handle_value) == LB_CEF3_HANDLE_COMMAND_LINE);
  assert(LB_CEF3_CommandLineIsReadOnly(global_command_line_result.handle_value) == 1);
  std::array<wchar_t, 64> startup_switch_value{};
  size_t startup_switch_required = 0;
  assert(LB_CEF3_CommandLineGetSwitchValue(
             global_command_line_result.handle_value, L"lingbuilder-test-switch",
             startup_switch_value.data(), startup_switch_value.size(), &startup_switch_required)
         == LB_CEF3_OK);
  assert(std::wstring(startup_switch_value.data()) == L"enabled");
  startup_switch_value.fill(L'\0');
  assert(LB_CEF3_CommandLineGetSwitchValue(
             global_command_line_result.handle_value, L"lingbuilder-test-v4-switch",
             startup_switch_value.data(), startup_switch_value.size(), &startup_switch_required)
         == LB_CEF3_OK);
  assert(std::wstring(startup_switch_value.data()) == L"v4-enabled");

  LB_CEF3_CALL_V4 create_value_call{};
  create_value_call.struct_size = sizeof(create_value_call);
  create_value_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_value_call.operation_id = UINT64_C(0xb280bdc19c10f5ea);
  LB_CEF3_RESULT_V4 create_value_result{};
  create_value_result.struct_size = sizeof(create_value_result);
  assert(LB_CEF3_InvokeV4(&create_value_call, &create_value_result) == LB_CEF3_OK);
  assert(create_value_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(create_value_result.handle_value) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_ValueRelease(create_value_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 create_command_line_call{};
  create_command_line_call.struct_size = sizeof(create_command_line_call);
  create_command_line_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_command_line_call.operation_id = UINT64_C(0xb67db731c8585479);
  LB_CEF3_RESULT_V4 create_command_line_result{};
  create_command_line_result.struct_size = sizeof(create_command_line_result);
  assert(LB_CEF3_InvokeV4(&create_command_line_call, &create_command_line_result) == LB_CEF3_OK);
  assert(create_command_line_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(create_command_line_result.handle_value) == LB_CEF3_HANDLE_COMMAND_LINE);
  LB_CEF3_CALL_V4 command_line_valid_call{};
  command_line_valid_call.struct_size = sizeof(command_line_valid_call);
  command_line_valid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_valid_call.operation_id = UINT64_C(0xe8a164082ebc588c);
  command_line_valid_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_valid_result{};
  command_line_valid_result.struct_size = sizeof(command_line_valid_result);
  assert(LB_CEF3_InvokeV4(&command_line_valid_call, &command_line_valid_result) == LB_CEF3_OK);
  assert(command_line_valid_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(command_line_valid_result.integer_value == 1);
  LB_CEF3_CALL_V4 command_line_read_only_call{};
  command_line_read_only_call.struct_size = sizeof(command_line_read_only_call);
  command_line_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_read_only_call.operation_id = UINT64_C(0x05b84d2179a33d86);
  command_line_read_only_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_read_only_result{};
  command_line_read_only_result.struct_size = sizeof(command_line_read_only_result);
  assert(LB_CEF3_InvokeV4(&command_line_read_only_call, &command_line_read_only_result) == LB_CEF3_OK);
  assert(command_line_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(command_line_read_only_result.integer_value == 0);
  LB_CEF3_CALL_V4 command_line_copy_call{};
  command_line_copy_call.struct_size = sizeof(command_line_copy_call);
  command_line_copy_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_copy_call.operation_id = UINT64_C(0x52cd0734401153ef);
  command_line_copy_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_copy_result{};
  command_line_copy_result.struct_size = sizeof(command_line_copy_result);
  assert(LB_CEF3_InvokeV4(&command_line_copy_call, &command_line_copy_result) == LB_CEF3_OK);
  assert(command_line_copy_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(command_line_copy_result.handle_value != create_command_line_result.handle_value);
  assert(LB_CEF3_CommandLineIsValid(command_line_copy_result.handle_value) == 1);
  assert(LB_CEF3_CommandLineRelease(command_line_copy_result.handle_value) == LB_CEF3_OK);
  const std::vector<std::wstring> argv_values = {
    L"C:\\Program Files\\Ling Builder\\app.exe", L"--array-mode=中文", L"空 格", L"quote\"inside", L"tail\\"
  };
  const auto wrong_argv_type = LB_CEF3_ValueCreate();
  assert(LB_CEF3_CommandLineInitFromArgv(create_command_line_result.handle_value, wrong_argv_type)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ValueRelease(wrong_argv_type) == LB_CEF3_OK);
  const auto empty_argv = LB_CEF3_ListCreate();
  assert(LB_CEF3_CommandLineInitFromArgv(create_command_line_result.handle_value, empty_argv)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ListRelease(empty_argv) == LB_CEF3_OK);
  const auto argv_list = CreateTextList(argv_values);
  assert(LB_CEF3_CommandLineInitFromArgv(global_command_line_result.handle_value, argv_list)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  LB_CEF3_ARGUMENT_V4 argv_argument{};
  argv_argument.struct_size = sizeof(argv_argument);
  argv_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  argv_argument.handle_value = argv_list;
  LB_CEF3_CALL_V4 argv_call{};
  argv_call.struct_size = sizeof(argv_call);
  argv_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  argv_call.operation_id = UINT64_C(0x130df66bab134d1f);
  argv_call.target = create_command_line_result.handle_value;
  argv_call.arguments = &argv_argument;
  argv_call.argument_count = 1;
  LB_CEF3_RESULT_V4 argv_result{};
  argv_result.struct_size = sizeof(argv_result);
  assert(LB_CEF3_InvokeV4(&argv_call, &argv_result) == LB_CEF3_OK);
  const auto argv_round_trip = LB_CEF3_CommandLineGetArgv(create_command_line_result.handle_value);
  assert(LB_CEF3_ListGetSize(argv_round_trip) == static_cast<int64_t>(argv_values.size()));
  for (size_t index = 0; index < argv_values.size(); ++index)
    assert(ReadTextListItem(argv_round_trip, index) == argv_values[index]);
  assert(LB_CEF3_ListRelease(argv_round_trip) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(argv_list) == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineReset(create_command_line_result.handle_value) == LB_CEF3_OK);
  const auto command_line_probe = LB_CEF3_CommandLineCreate();
  assert(command_line_probe != 0);
  assert(LB_CEF3_CommandLineAppendArgument(
      command_line_probe, L"plain-argument") == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineAppendSwitch(
      command_line_probe, L"plain-switch") == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineAppendSwitchWithValue(
      command_line_probe, L"plain-value", L"1") == LB_CEF3_OK);
  const auto copied_command_line = LB_CEF3_CommandLineCopy(
      command_line_probe);
  assert(copied_command_line != 0);
  std::array<wchar_t, 256> command_line_program{};
  size_t command_line_program_required = 0;
  assert(LB_CEF3_CommandLineGetProgram(
      copied_command_line, command_line_program.data(), command_line_program.size(),
      &command_line_program_required) == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineSetProgram(copied_command_line, L"copied.exe") == LB_CEF3_OK);
  assert(LB_CEF3_LaunchProcess(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_CommandLineHasArguments(copied_command_line) == 1);
  assert(LB_CEF3_CommandLineHasSwitches(copied_command_line) == 1);
  assert(LB_CEF3_CommandLineHasSwitch(copied_command_line, L"plain-switch") == 1);
  assert(LB_CEF3_CommandLineRemoveSwitch(copied_command_line, L"plain-switch") == LB_CEF3_OK);
  const auto copied_arguments = LB_CEF3_CommandLineGetArguments(copied_command_line);
  const auto copied_switches = LB_CEF3_CommandLineGetSwitches(copied_command_line);
  assert(copied_arguments != 0 && copied_switches != 0);
  assert(LB_CEF3_ListRelease(copied_arguments) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(copied_switches) == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineRelease(copied_command_line) == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineRelease(command_line_probe) == LB_CEF3_OK);

  const auto wrapper_command_line = LB_CEF3_CommandLineCreate();
  assert(wrapper_command_line != 0);
  assert(LB_CEF3_CommandLineInitFromString(wrapper_command_line, L"wrapped.exe 参数") == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 wrapper_argument{};
  wrapper_argument.struct_size = sizeof(wrapper_argument);
  wrapper_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  wrapper_argument.text_value = L"debugger.exe --args";
  LB_CEF3_CALL_V4 wrapper_call{};
  wrapper_call.struct_size = sizeof(wrapper_call);
  wrapper_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  wrapper_call.operation_id = UINT64_C(0xfb2a78646be12c42);
  wrapper_call.target = wrapper_command_line;
  wrapper_call.arguments = &wrapper_argument;
  wrapper_call.argument_count = 1;
  LB_CEF3_RESULT_V4 wrapper_result{};
  wrapper_result.struct_size = sizeof(wrapper_result);
  assert(LB_CEF3_InvokeV4(&wrapper_call, &wrapper_result) == LB_CEF3_OK);
  std::array<wchar_t, 256> wrapper_text{};
  size_t wrapper_required = 0;
  assert(LB_CEF3_CommandLineGetString(
      wrapper_command_line, wrapper_text.data(), wrapper_text.size(), &wrapper_required) == LB_CEF3_OK);
  assert(std::wstring(wrapper_text.data()).rfind(L"debugger.exe --args", 0) == 0);
  assert(LB_CEF3_CommandLinePrependWrapper(wrapper_command_line, L"") == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_CommandLinePrependWrapper(global_command_line_result.handle_value, L"blocked")
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_CommandLineRelease(wrapper_command_line) == LB_CEF3_OK);
  assert(LB_CEF3_CommandLineRelease(global_command_line_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_has_switches_call{};
  command_line_has_switches_call.struct_size = sizeof(command_line_has_switches_call);
  command_line_has_switches_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_has_switches_call.operation_id = UINT64_C(0x9c8fc92f97b9b14f);
  command_line_has_switches_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_has_switches_result{};
  command_line_has_switches_result.struct_size = sizeof(command_line_has_switches_result);
  assert(LB_CEF3_InvokeV4(&command_line_has_switches_call, &command_line_has_switches_result) == LB_CEF3_OK);
  assert(command_line_has_switches_result.integer_value == 0);
  LB_CEF3_ARGUMENT_V4 command_line_switch_argument{};
  command_line_switch_argument.struct_size = sizeof(command_line_switch_argument);
  command_line_switch_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_switch_argument.text_value = L"Feature";
  LB_CEF3_CALL_V4 command_line_append_switch_call{};
  command_line_append_switch_call.struct_size = sizeof(command_line_append_switch_call);
  command_line_append_switch_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_append_switch_call.operation_id = UINT64_C(0x5f76f471f88b0bd5);
  command_line_append_switch_call.target = create_command_line_result.handle_value;
  command_line_append_switch_call.arguments = &command_line_switch_argument;
  command_line_append_switch_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_append_switch_result{};
  command_line_append_switch_result.struct_size = sizeof(command_line_append_switch_result);
  assert(LB_CEF3_InvokeV4(&command_line_append_switch_call, &command_line_append_switch_result) == LB_CEF3_OK);
  assert(LB_CEF3_InvokeV4(&command_line_has_switches_call, &command_line_has_switches_result) == LB_CEF3_OK);
  assert(command_line_has_switches_result.integer_value == 1);
  command_line_switch_argument.text_value = L"feature";
  LB_CEF3_CALL_V4 command_line_has_switch_call{};
  command_line_has_switch_call.struct_size = sizeof(command_line_has_switch_call);
  command_line_has_switch_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_has_switch_call.operation_id = UINT64_C(0x655a3182052da77a);
  command_line_has_switch_call.target = create_command_line_result.handle_value;
  command_line_has_switch_call.arguments = &command_line_switch_argument;
  command_line_has_switch_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_has_switch_result{};
  command_line_has_switch_result.struct_size = sizeof(command_line_has_switch_result);
  assert(LB_CEF3_InvokeV4(&command_line_has_switch_call, &command_line_has_switch_result) == LB_CEF3_OK);
  assert(command_line_has_switch_result.integer_value == 1);
  std::array<LB_CEF3_ARGUMENT_V4, 2> command_line_value_arguments{};
  command_line_value_arguments[0].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  command_line_value_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_value_arguments[0].text_value = L"Language";
  command_line_value_arguments[1].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  command_line_value_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_value_arguments[1].text_value = L"中文";
  LB_CEF3_CALL_V4 command_line_append_value_call{};
  command_line_append_value_call.struct_size = sizeof(command_line_append_value_call);
  command_line_append_value_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_append_value_call.operation_id = UINT64_C(0x59efac4cdc921bd3);
  command_line_append_value_call.target = create_command_line_result.handle_value;
  command_line_append_value_call.arguments = command_line_value_arguments.data();
  command_line_append_value_call.argument_count = command_line_value_arguments.size();
  LB_CEF3_RESULT_V4 command_line_append_value_result{};
  command_line_append_value_result.struct_size = sizeof(command_line_append_value_result);
  assert(LB_CEF3_InvokeV4(&command_line_append_value_call, &command_line_append_value_result) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_get_value_call{};
  command_line_get_value_call.struct_size = sizeof(command_line_get_value_call);
  command_line_get_value_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_value_call.operation_id = UINT64_C(0xb5aa0cad544cadc2);
  command_line_get_value_call.target = create_command_line_result.handle_value;
  command_line_get_value_call.arguments = command_line_value_arguments.data();
  command_line_get_value_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_get_value_result{};
  command_line_get_value_result.struct_size = sizeof(command_line_get_value_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_value_call, &command_line_get_value_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring command_line_switch_value(command_line_get_value_result.text_required, L'\0');
  command_line_get_value_result.text = command_line_switch_value.data();
  command_line_get_value_result.text_capacity = command_line_switch_value.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_value_call, &command_line_get_value_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_switch_value.c_str()) == L"中文");
  LB_CEF3_CALL_V4 command_line_remove_switch_call{};
  command_line_remove_switch_call.struct_size = sizeof(command_line_remove_switch_call);
  command_line_remove_switch_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_remove_switch_call.operation_id = UINT64_C(0x5cfe18fff305755d);
  command_line_remove_switch_call.target = create_command_line_result.handle_value;
  command_line_remove_switch_call.arguments = command_line_value_arguments.data();
  command_line_remove_switch_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_remove_switch_result{};
  command_line_remove_switch_result.struct_size = sizeof(command_line_remove_switch_result);
  assert(LB_CEF3_InvokeV4(&command_line_remove_switch_call, &command_line_remove_switch_result) == LB_CEF3_OK);
  command_line_has_switch_call.arguments = command_line_value_arguments.data();
  assert(LB_CEF3_InvokeV4(&command_line_has_switch_call, &command_line_has_switch_result) == LB_CEF3_OK);
  assert(command_line_has_switch_result.integer_value == 0);
  LB_CEF3_ARGUMENT_V4 command_line_text_argument{};
  command_line_text_argument.struct_size = sizeof(command_line_text_argument);
  command_line_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_text_argument.text_value = L"v4-program.exe --mode=中文 参数";
  LB_CEF3_CALL_V4 command_line_init_call{};
  command_line_init_call.struct_size = sizeof(command_line_init_call);
  command_line_init_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_init_call.operation_id = UINT64_C(0x0be284cce596de7a);
  command_line_init_call.target = create_command_line_result.handle_value;
  command_line_init_call.arguments = &command_line_text_argument;
  command_line_init_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_init_result{};
  command_line_init_result.struct_size = sizeof(command_line_init_result);
  assert(LB_CEF3_InvokeV4(&command_line_init_call, &command_line_init_result) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_get_string_call{};
  command_line_get_string_call.struct_size = sizeof(command_line_get_string_call);
  command_line_get_string_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_string_call.operation_id = UINT64_C(0xe07768e3f86012f2);
  command_line_get_string_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_get_string_result{};
  command_line_get_string_result.struct_size = sizeof(command_line_get_string_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_string_call, &command_line_get_string_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring command_line_v4_text(command_line_get_string_result.text_required, L'\0');
  command_line_get_string_result.text = command_line_v4_text.data();
  command_line_get_string_result.text_capacity = command_line_v4_text.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_string_call, &command_line_get_string_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_v4_text.c_str()).find(L"--mode=中文") != std::wstring::npos);
  LB_CEF3_CALL_V4 command_line_get_argv_call{};
  command_line_get_argv_call.struct_size = sizeof(command_line_get_argv_call);
  command_line_get_argv_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_argv_call.operation_id = UINT64_C(0x9c0ab6aa13dc3ccb);
  command_line_get_argv_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_get_argv_result{};
  command_line_get_argv_result.struct_size = sizeof(command_line_get_argv_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_argv_call, &command_line_get_argv_result) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(command_line_get_argv_result.handle_value) == LB_CEF3_HANDLE_LIST);
  std::array<wchar_t, 512> command_line_collection_json{};
  assert(LB_CEF3_ListToJson(command_line_get_argv_result.handle_value,
      command_line_collection_json.data(), command_line_collection_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(command_line_collection_json.data()).find(L"v4-program.exe") != std::wstring::npos);
  assert(std::wstring(command_line_collection_json.data()).find(L"--mode=中文") != std::wstring::npos);
  assert(LB_CEF3_ListRelease(command_line_get_argv_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_get_arguments_call{};
  command_line_get_arguments_call.struct_size = sizeof(command_line_get_arguments_call);
  command_line_get_arguments_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_arguments_call.operation_id = UINT64_C(0xa8e4c0909f2f1e31);
  command_line_get_arguments_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_get_arguments_result{};
  command_line_get_arguments_result.struct_size = sizeof(command_line_get_arguments_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_arguments_call, &command_line_get_arguments_result) == LB_CEF3_OK);
  command_line_collection_json.fill(L'\0');
  assert(LB_CEF3_ListToJson(command_line_get_arguments_result.handle_value,
      command_line_collection_json.data(), command_line_collection_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(command_line_collection_json.data()).find(L"参数") != std::wstring::npos);
  assert(std::wstring(command_line_collection_json.data()).find(L"--mode") == std::wstring::npos);
  assert(LB_CEF3_ListRelease(command_line_get_arguments_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_get_switches_call{};
  command_line_get_switches_call.struct_size = sizeof(command_line_get_switches_call);
  command_line_get_switches_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_switches_call.operation_id = UINT64_C(0xc1e93e42442a2042);
  command_line_get_switches_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_get_switches_result{};
  command_line_get_switches_result.struct_size = sizeof(command_line_get_switches_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_switches_call, &command_line_get_switches_result) == LB_CEF3_OK);
  command_line_collection_json.fill(L'\0');
  assert(LB_CEF3_ListToJson(command_line_get_switches_result.handle_value,
      command_line_collection_json.data(), command_line_collection_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(command_line_collection_json.data()).find(L"\"name\":\"mode\"") != std::wstring::npos);
  assert(std::wstring(command_line_collection_json.data()).find(L"\"value\":\"中文\"") != std::wstring::npos);
  assert(LB_CEF3_ListRelease(command_line_get_switches_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 command_line_get_program_call{};
  command_line_get_program_call.struct_size = sizeof(command_line_get_program_call);
  command_line_get_program_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_get_program_call.operation_id = UINT64_C(0xe5100828c9df789a);
  command_line_get_program_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_get_program_result{};
  command_line_get_program_result.struct_size = sizeof(command_line_get_program_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_program_call, &command_line_get_program_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring command_line_program_text(command_line_get_program_result.text_required, L'\0');
  command_line_get_program_result.text = command_line_program_text.data();
  command_line_get_program_result.text_capacity = command_line_program_text.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_program_call, &command_line_get_program_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_program_text.c_str()).find(L"v4-program.exe") != std::wstring::npos);
  LB_CEF3_ARGUMENT_V4 command_line_program_argument{};
  command_line_program_argument.struct_size = sizeof(command_line_program_argument);
  command_line_program_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_program_argument.text_value = L"v4-替换.exe";
  LB_CEF3_CALL_V4 command_line_set_program_call{};
  command_line_set_program_call.struct_size = sizeof(command_line_set_program_call);
  command_line_set_program_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_set_program_call.operation_id = UINT64_C(0x933094c045cb6356);
  command_line_set_program_call.target = create_command_line_result.handle_value;
  command_line_set_program_call.arguments = &command_line_program_argument;
  command_line_set_program_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_set_program_result{};
  command_line_set_program_result.struct_size = sizeof(command_line_set_program_result);
  assert(LB_CEF3_InvokeV4(&command_line_set_program_call, &command_line_set_program_result) == LB_CEF3_OK);
  command_line_program_text.assign(64, L'\0');
  command_line_get_program_result.text = command_line_program_text.data();
  command_line_get_program_result.text_capacity = command_line_program_text.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_program_call, &command_line_get_program_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_program_text.c_str()) == L"v4-替换.exe");
  LB_CEF3_CALL_V4 command_line_has_arguments_call{};
  command_line_has_arguments_call.struct_size = sizeof(command_line_has_arguments_call);
  command_line_has_arguments_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_has_arguments_call.operation_id = UINT64_C(0x3608132a710bccb0);
  command_line_has_arguments_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_has_arguments_result{};
  command_line_has_arguments_result.struct_size = sizeof(command_line_has_arguments_result);
  assert(LB_CEF3_InvokeV4(&command_line_has_arguments_call, &command_line_has_arguments_result) == LB_CEF3_OK);
  assert(command_line_has_arguments_result.integer_value == 1);
  LB_CEF3_ARGUMENT_V4 command_line_argument{};
  command_line_argument.struct_size = sizeof(command_line_argument);
  command_line_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_line_argument.text_value = L"追加参数";
  LB_CEF3_CALL_V4 command_line_append_argument_call{};
  command_line_append_argument_call.struct_size = sizeof(command_line_append_argument_call);
  command_line_append_argument_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_append_argument_call.operation_id = UINT64_C(0x31eb775ee5956883);
  command_line_append_argument_call.target = create_command_line_result.handle_value;
  command_line_append_argument_call.arguments = &command_line_argument;
  command_line_append_argument_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_line_append_argument_result{};
  command_line_append_argument_result.struct_size = sizeof(command_line_append_argument_result);
  assert(LB_CEF3_InvokeV4(&command_line_append_argument_call, &command_line_append_argument_result) == LB_CEF3_OK);
  LB_CEF3_RESULT_V4 command_line_after_append_result{};
  command_line_after_append_result.struct_size = sizeof(command_line_after_append_result);
  assert(LB_CEF3_InvokeV4(&command_line_get_string_call, &command_line_after_append_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring command_line_after_append(command_line_after_append_result.text_required, L'\0');
  command_line_after_append_result.text = command_line_after_append.data();
  command_line_after_append_result.text_capacity = command_line_after_append.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_string_call, &command_line_after_append_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_after_append.c_str()).find(L"追加参数") != std::wstring::npos);
  LB_CEF3_CALL_V4 command_line_reset_call{};
  command_line_reset_call.struct_size = sizeof(command_line_reset_call);
  command_line_reset_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_line_reset_call.operation_id = UINT64_C(0xd0a033dc17148a43);
  command_line_reset_call.target = create_command_line_result.handle_value;
  LB_CEF3_RESULT_V4 command_line_reset_result{};
  command_line_reset_result.struct_size = sizeof(command_line_reset_result);
  assert(LB_CEF3_InvokeV4(&command_line_reset_call, &command_line_reset_result) == LB_CEF3_OK);
  assert(LB_CEF3_InvokeV4(&command_line_has_arguments_call, &command_line_has_arguments_result) == LB_CEF3_OK);
  assert(command_line_has_arguments_result.integer_value == 0);
  assert(LB_CEF3_InvokeV4(&command_line_has_switches_call, &command_line_has_switches_result) == LB_CEF3_OK);
  assert(command_line_has_switches_result.integer_value == 0);
  command_line_program_text.assign(64, L'\0');
  command_line_get_program_result.text = command_line_program_text.data();
  command_line_get_program_result.text_capacity = command_line_program_text.size();
  assert(LB_CEF3_InvokeV4(&command_line_get_program_call, &command_line_get_program_result) == LB_CEF3_OK);
  assert(std::wstring(command_line_program_text.c_str()) == L"v4-替换.exe");
  assert(LB_CEF3_CommandLineRelease(create_command_line_result.handle_value) == LB_CEF3_OK);

  const auto panel_view = LB_CEF3_PanelCreate();
  assert(panel_view != 0);
  assert(LB_CEF3_HandleGetType(panel_view) == LB_CEF3_HANDLE_VIEW);
  assert(LB_CEF3_ViewIsValid(panel_view) == 1);
  LB_CEF3_HANDLE converted_view = UINT64_C(0x1234);
  assert(LB_CEF3_ViewAsBrowserView(panel_view, &converted_view) == LB_CEF3_OK);
  assert(converted_view == 0);
  assert(LB_CEF3_ViewAsButton(panel_view, &converted_view) == LB_CEF3_OK);
  assert(converted_view == 0);
  assert(LB_CEF3_ViewAsScrollView(panel_view, &converted_view) == LB_CEF3_OK);
  assert(converted_view == 0);
  assert(LB_CEF3_ViewAsTextfield(panel_view, &converted_view) == LB_CEF3_OK);
  assert(converted_view == 0);
  assert(LB_CEF3_ViewAsPanel(panel_view, &converted_view) == LB_CEF3_OK);
  assert(converted_view != 0);
  assert(LB_CEF3_HandleGetType(converted_view) == LB_CEF3_HANDLE_VIEW);
  assert(LB_CEF3_ViewIsSame(panel_view, converted_view) == 1);

  LB_CEF3_RECT_V3 view_bounds{
      sizeof(view_bounds), LB_CEF3_ABI_VERSION_V3, 10, 20, 300, 200};
  assert(LB_CEF3_ViewSetBounds(panel_view, &view_bounds) == LB_CEF3_OK);
  view_bounds = {sizeof(view_bounds), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetBounds(panel_view, &view_bounds) == LB_CEF3_OK);
  assert(view_bounds.x == 10 && view_bounds.y == 20);
  assert(view_bounds.width == 300 && view_bounds.height == 200);
  LB_CEF3_RECT_V3 view_screen_bounds{
      sizeof(view_screen_bounds), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetBoundsInScreen(panel_view, &view_screen_bounds) == LB_CEF3_OK);
  LB_CEF3_POINT_V3 view_position{
      sizeof(view_position), LB_CEF3_ABI_VERSION_V3, 30, 40};
  assert(LB_CEF3_ViewSetPosition(panel_view, &view_position) == LB_CEF3_OK);
  view_position = {sizeof(view_position), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetPosition(panel_view, &view_position) == LB_CEF3_OK);
  assert(view_position.x == 30 && view_position.y == 40);
  LB_CEF3_SIZE_V3 view_size{
      sizeof(view_size), LB_CEF3_ABI_VERSION_V3, 320, 220};
  assert(LB_CEF3_ViewSetSize(panel_view, &view_size) == LB_CEF3_OK);
  view_size = {sizeof(view_size), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetSize(panel_view, &view_size) == LB_CEF3_OK);
  assert(view_size.width == 320 && view_size.height == 220);
  LB_CEF3_INSETS_V3 view_insets{
      sizeof(view_insets), LB_CEF3_ABI_VERSION_V3, 1, 2, 3, 4};
  assert(LB_CEF3_ViewSetInsets(panel_view, &view_insets) == LB_CEF3_OK);
  view_insets = {sizeof(view_insets), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetInsets(panel_view, &view_insets) == LB_CEF3_OK);
  assert(view_insets.top == 1 && view_insets.left == 2);
  assert(view_insets.bottom == 3 && view_insets.right == 4);
  LB_CEF3_SIZE_V3 view_preferred{sizeof(view_preferred), LB_CEF3_ABI_VERSION_V3};
  LB_CEF3_SIZE_V3 view_minimum{sizeof(view_minimum), LB_CEF3_ABI_VERSION_V3};
  LB_CEF3_SIZE_V3 view_maximum{sizeof(view_maximum), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewGetPreferredSize(panel_view, &view_preferred) == LB_CEF3_OK);
  assert(LB_CEF3_ViewGetMinimumSize(panel_view, &view_minimum) == LB_CEF3_OK);
  assert(LB_CEF3_ViewGetMaximumSize(panel_view, &view_maximum) == LB_CEF3_OK);
  int32_t view_height = -1;
  assert(LB_CEF3_ViewGetHeightForWidth(panel_view, 200, &view_height) == LB_CEF3_OK);
  assert(view_height >= 0);

  uint32_t view_color = 0;
  assert(LB_CEF3_ViewSetBackgroundColor(panel_view, UINT32_C(0xff123456)) == LB_CEF3_OK);
  assert(LB_CEF3_ViewGetBackgroundColor(panel_view, &view_color) == LB_CEF3_OK);
  assert(view_color == UINT32_C(0xff123456));
  assert(LB_CEF3_ViewGetThemeColor(panel_view, 0, &view_color) == LB_CEF3_OK);
  int32_t view_id = -1;
  assert(LB_CEF3_ViewGetId(panel_view, &view_id) == LB_CEF3_OK);
  assert(view_id == 0);
  assert(LB_CEF3_ViewSetId(panel_view, 701) == LB_CEF3_OK);
  assert(LB_CEF3_ViewGetId(panel_view, &view_id) == LB_CEF3_OK);
  assert(view_id == 701);
  int32_t view_group_id = 0;
  assert(LB_CEF3_ViewGetGroupId(panel_view, &view_group_id) == LB_CEF3_OK);
  assert(view_group_id == -1);
  assert(LB_CEF3_ViewSetGroupId(panel_view, 702) == LB_CEF3_OK);
  assert(LB_CEF3_ViewGetGroupId(panel_view, &view_group_id) == LB_CEF3_OK);
  assert(view_group_id == 702);

  LB_CEF3_HANDLE nullable_view = UINT64_C(0x1234);
  assert(LB_CEF3_ViewGetDelegate(panel_view, &nullable_view) == LB_CEF3_OK);
  assert(nullable_view == 0);
  assert(LB_CEF3_ViewGetParentView(panel_view, &nullable_view) == LB_CEF3_OK);
  assert(nullable_view == 0);
  assert(LB_CEF3_ViewGetWindow(panel_view, &nullable_view) == LB_CEF3_OK);
  assert(nullable_view == 0);
  assert(LB_CEF3_ViewGetViewForId(panel_view, 999999, &nullable_view) == LB_CEF3_OK);
  assert(nullable_view == 0);
  assert(!ReadManagedText(panel_view, LB_CEF3_ViewGetTypeString).empty());
  size_t view_text_required = 0;
  assert(LB_CEF3_ViewToString(panel_view, 1, nullptr, 0, &view_text_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring view_description(view_text_required, L'\0');
  assert(LB_CEF3_ViewToString(
      panel_view, 1, view_description.data(), view_description.size(), &view_text_required)
      == LB_CEF3_OK);
  assert(!std::wstring(view_description.c_str()).empty());

  for (const auto query : {
      LB_CEF3_ViewHasFocus, LB_CEF3_ViewIsAccessibilityFocusable,
      LB_CEF3_ViewIsAttached, LB_CEF3_ViewIsDrawn, LB_CEF3_ViewIsEnabled,
      LB_CEF3_ViewIsFocusable, LB_CEF3_ViewIsVisible}) {
    const int value = query(panel_view);
    assert(value == 0 || value == 1);
  }
  assert(LB_CEF3_ViewSetEnabled(panel_view, 0) == LB_CEF3_OK);
  assert(LB_CEF3_ViewIsEnabled(panel_view) == 0);
  assert(LB_CEF3_ViewSetEnabled(panel_view, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ViewSetFocusable(panel_view, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ViewSetVisible(panel_view, 0) == LB_CEF3_OK);
  assert(LB_CEF3_ViewIsVisible(panel_view) == 0);
  assert(LB_CEF3_ViewSetVisible(panel_view, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ViewInvalidateLayout(panel_view) == LB_CEF3_OK);
  assert(LB_CEF3_ViewRequestFocus(panel_view) == LB_CEF3_OK);
  assert(LB_CEF3_ViewSizeToPreferredSize(panel_view) == LB_CEF3_OK);

  LB_CEF3_POINT_V3 converted_point{
      sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointFromScreen(panel_view, &converted_point) == 0);
  converted_point = {sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointFromWindow(panel_view, &converted_point) == 0);
  converted_point = {sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointToScreen(panel_view, &converted_point) == 0);
  converted_point = {sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointToWindow(panel_view, &converted_point) == 0);
  converted_point = {sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointFromView(panel_view, converted_view, &converted_point) == 0);
  converted_point = {sizeof(converted_point), LB_CEF3_ABI_VERSION_V3, 5, 6};
  assert(LB_CEF3_ViewConvertPointToView(panel_view, converted_view, &converted_point) == 0);

  LB_CEF3_RECT_V3 invalid_view_bounds{};
  assert(LB_CEF3_ViewSetBounds(panel_view, &invalid_view_bounds)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_view_bounds = {
      sizeof(invalid_view_bounds), LB_CEF3_ABI_VERSION_V3, 0, 0, -1, 1};
  assert(LB_CEF3_ViewSetBounds(panel_view, &invalid_view_bounds)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ViewSetEnabled(panel_view, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ViewAsPanel(panel_view, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto wrong_view_type = LB_CEF3_ValueCreate();
  assert(wrong_view_type != 0);
  assert(LB_CEF3_ViewIsValid(wrong_view_type) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ValueRelease(wrong_view_type) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 create_panel_call{};
  create_panel_call.struct_size = sizeof(create_panel_call);
  create_panel_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_panel_call.operation_id = UINT64_C(0x814cb0f4ba011289);
  LB_CEF3_RESULT_V4 create_panel_result{};
  create_panel_result.struct_size = sizeof(create_panel_result);
  assert(LB_CEF3_InvokeV4(&create_panel_call, &create_panel_result) == LB_CEF3_OK);
  assert(create_panel_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto panel_view_v4 = create_panel_result.handle_value;
  assert(panel_view_v4 != 0);
  assert(LB_CEF3_HandleGetType(panel_view_v4) == LB_CEF3_HANDLE_VIEW);

  auto make_view_call = [](uint64_t operation_id, LB_CEF3_HANDLE target,
                           const LB_CEF3_ARGUMENT_V4* arguments = nullptr,
                           size_t argument_count = 0) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = target;
    call.arguments = arguments;
    call.argument_count = argument_count;
    return call;
  };
  auto invoke_view_call = [&](LB_CEF3_CALL_V4 call) {
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    const int status = LB_CEF3_InvokeV4(&call, &result);
    if (status != LB_CEF3_OK) {
      std::fwprintf(stderr, L"CEF3 V4 invocation failed: operation=0x%016llx status=%d\n",
                    static_cast<unsigned long long>(call.operation_id), status);
    }
    assert(status == LB_CEF3_OK);
    return result;
  };

  const auto ref_counted_task = LB_CEF3_TaskCreate();
  assert(ref_counted_task != 0);
  assert(LB_CEF3_RefCountedHasOneRef(ref_counted_task) == 1);
  assert(LB_CEF3_RefCountedHasAtLeastOneRef(ref_counted_task) == 1);
  assert(LB_CEF3_RefCountedAddRef(ref_counted_task) == LB_CEF3_OK);
  assert(LB_CEF3_RefCountedHasOneRef(ref_counted_task) == 0);
  assert(LB_CEF3_RefCountedRelease(ref_counted_task) == 0);
  assert(LB_CEF3_RefCountedHasOneRef(ref_counted_task) == 1);
  assert(LB_CEF3_RefCountedRelease(ref_counted_task) == 1);
  assert(LB_CEF3_RefCountedHasAtLeastOneRef(ref_counted_task)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto ref_counted_task_v4 = LB_CEF3_TaskCreate();
  assert(ref_counted_task_v4 != 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xab03b65648eaaded), ref_counted_task_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xff666c9473d8353b), ref_counted_task_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x3732201a937ac4dc), ref_counted_task_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xab03b65648eaaded), ref_counted_task_v4)).integer_value == 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x5ae6acb76e4b5ce9), ref_counted_task_v4)).integer_value == 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x5ae6acb76e4b5ce9), ref_counted_task_v4)).integer_value == 1);
  assert(LB_CEF3_RefCountedHasOneRef(ref_counted_task_v4)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto scoped_task = LB_CEF3_TaskCreate();
  assert(scoped_task != 0);
  assert(LB_CEF3_ScopedDelete(scoped_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(scoped_task) == LB_CEF3_ERROR_RELEASED_HANDLE);
  const auto scoped_task_v4 = LB_CEF3_TaskCreate();
  assert(scoped_task_v4 != 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xce03eada5140365d), scoped_task_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_HandleGetType(scoped_task_v4) == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto invalid_ref_counted_task = LB_CEF3_TaskCreate();
  assert(invalid_ref_counted_task != 0);
  LB_CEF3_ARGUMENT_V4 invalid_ref_counted_argument{};
  invalid_ref_counted_argument.struct_size = sizeof(invalid_ref_counted_argument);
  invalid_ref_counted_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto invalid_ref_counted_call = make_view_call(
      UINT64_C(0x3732201a937ac4dc), invalid_ref_counted_task,
      &invalid_ref_counted_argument, 1);
  LB_CEF3_RESULT_V4 invalid_ref_counted_result{};
  invalid_ref_counted_result.struct_size = sizeof(invalid_ref_counted_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_ref_counted_call, &invalid_ref_counted_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_ref_counted_call.arguments = nullptr;
  invalid_ref_counted_call.argument_count = 0;
  invalid_ref_counted_call.target = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_ref_counted_call, &invalid_ref_counted_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_HandleRelease(invalid_ref_counted_task) == LB_CEF3_OK);

  for (const auto operation_id : {
      UINT64_C(0x1e33636c134315d1), UINT64_C(0x8a7d9e2e433687a9),
      UINT64_C(0xaaa5017ca7175096), UINT64_C(0x36d7bbe731ed3da0),
      UINT64_C(0x00edcc26680545ba)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    if (operation_id == UINT64_C(0xaaa5017ca7175096)) {
      assert(result.handle_value != 0);
      assert(LB_CEF3_HandleRelease(result.handle_value) == LB_CEF3_OK);
    } else {
      assert(result.handle_value == 0);
    }
  }
  for (const auto operation_id : {
      UINT64_C(0x01a3d70622dd2e59), UINT64_C(0xddfd709c692c76f3),
      UINT64_C(0x3fad19e0458b6e30)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value == 0);
  }
  LB_CEF3_ARGUMENT_V4 view_integer_argument{};
  view_integer_argument.struct_size = sizeof(view_integer_argument);
  view_integer_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  view_integer_argument.integer_value = 999999;
  auto view_for_id_result = invoke_view_call(make_view_call(
      UINT64_C(0x2d1fada3e71b6c8b), panel_view_v4, &view_integer_argument, 1));
  assert(view_for_id_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(view_for_id_result.handle_value == 0);
  assert(!ReadV4Text(make_view_call(
      UINT64_C(0xece1a8a50521a564), panel_view_v4)).empty());
  LB_CEF3_ARGUMENT_V4 view_boolean_argument{};
  view_boolean_argument.struct_size = sizeof(view_boolean_argument);
  view_boolean_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  view_boolean_argument.integer_value = 1;
  assert(!ReadV4Text(make_view_call(
      UINT64_C(0x89d86e7ee8452d23), panel_view_v4,
      &view_boolean_argument, 1)).empty());

  for (const auto operation_id : {
      UINT64_C(0xc0525a30e9550203), UINT64_C(0x2c9ad207c35d74ee),
      UINT64_C(0xc7998708c59c9f72), UINT64_C(0x968c350155a1033d),
      UINT64_C(0x6ebf50783853ee99), UINT64_C(0xecdd67688654f31f),
      UINT64_C(0x6975e5c24c77c37c), UINT64_C(0x0e68403033d02b20)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 0 || result.integer_value == 1);
  }
  LB_CEF3_ARGUMENT_V4 view_handle_argument{};
  view_handle_argument.struct_size = sizeof(view_handle_argument);
  view_handle_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  view_handle_argument.handle_value = panel_view_v4;
  auto view_same_result = invoke_view_call(make_view_call(
      UINT64_C(0x4e150e2cad9592ff), panel_view_v4, &view_handle_argument, 1));
  assert(view_same_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(view_same_result.integer_value == 1);
  for (const auto operation_id : {
      UINT64_C(0x789058d44dabfb25), UINT64_C(0x90fb62bfa2cb5121),
      UINT64_C(0x1f7a0abf85e657f5)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  for (const auto operation_id : {
      UINT64_C(0x06953e6cc40e7b3b), UINT64_C(0xfd1e0aae83321e1b),
      UINT64_C(0xf445a3d31f6fea84)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, panel_view_v4, &view_boolean_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  for (const auto [operation_id, value] : {
      std::pair{UINT64_C(0xa857ec43bd3d3513), INT64_C(801)},
      std::pair{UINT64_C(0x25eedb862c347238), INT64_C(802)}}) {
    view_integer_argument.integer_value = value;
    const auto result = invoke_view_call(make_view_call(
        operation_id, panel_view_v4, &view_integer_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  view_integer_argument.integer_value = UINT32_C(0xffabcdef);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xbe95773fea468ff8), panel_view_v4,
      &view_integer_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  for (const auto operation_id : {
      UINT64_C(0xd81357406aada1ed), UINT64_C(0x325f5c3dc260dda5),
      UINT64_C(0x09e2f01c12c0f259)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  }
  for (const auto [operation_id, value] : {
      std::pair{UINT64_C(0x74987de3ac2d0673), INT64_C(200)},
      std::pair{UINT64_C(0x7f6bed1858b25ca1), INT64_C(0)}}) {
    view_integer_argument.integer_value = value;
    const auto result = invoke_view_call(make_view_call(
        operation_id, panel_view_v4, &view_integer_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  }
  for (const auto operation_id : {
      UINT64_C(0x38b1287030ac4a57), UINT64_C(0x9801bc06d4d3d6fc),
      UINT64_C(0x70a2251bc00e5864), UINT64_C(0xfe0bcfd910890963),
      UINT64_C(0x0044366ebe688482), UINT64_C(0x84329071a0dd5f8e),
      UINT64_C(0x4bc688a13e1a98c7), UINT64_C(0x2bdc373fad58cf9b)}) {
    const auto json = ReadV4Json(make_view_call(operation_id, panel_view_v4));
    assert(!json.empty() && json.front() == L'{');
  }

  std::array<LB_CEF3_ARGUMENT_V4, 4> view_geometry_arguments{};
  for (auto& argument : view_geometry_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  }
  view_geometry_arguments[0].integer_value = 11;
  view_geometry_arguments[1].integer_value = 12;
  view_geometry_arguments[2].integer_value = 310;
  view_geometry_arguments[3].integer_value = 210;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc47e3b0a64000ff1), panel_view_v4,
      view_geometry_arguments.data(), 4)).value_kind == LB_CEF3_VALUE_V4_VOID);
  view_geometry_arguments[0].integer_value = 1;
  view_geometry_arguments[1].integer_value = 2;
  view_geometry_arguments[2].integer_value = 3;
  view_geometry_arguments[3].integer_value = 4;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x788a7e19fc583c02), panel_view_v4,
      view_geometry_arguments.data(), 4)).value_kind == LB_CEF3_VALUE_V4_VOID);
  view_geometry_arguments[0].integer_value = 21;
  view_geometry_arguments[1].integer_value = 22;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xe99b34e45bc3c4d2), panel_view_v4,
      view_geometry_arguments.data(), 2)).value_kind == LB_CEF3_VALUE_V4_VOID);
  view_geometry_arguments[0].integer_value = 330;
  view_geometry_arguments[1].integer_value = 230;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xbda7dbdbb0c66abb), panel_view_v4,
      view_geometry_arguments.data(), 2)).value_kind == LB_CEF3_VALUE_V4_VOID);

  view_geometry_arguments[0].integer_value = 5;
  view_geometry_arguments[1].integer_value = 6;
  for (const auto operation_id : {
      UINT64_C(0x0995123baf2fdab7), UINT64_C(0x729df0b64ee6803c),
      UINT64_C(0x134e8c9f6045705a), UINT64_C(0xb486b54ad39af9e2)}) {
    const auto json = ReadV4Json(make_view_call(
        operation_id, panel_view_v4, view_geometry_arguments.data(), 2));
    assert(json.find(L"\"converted\":false") != std::wstring::npos);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 3> view_conversion_arguments{};
  view_conversion_arguments[0] = view_handle_argument;
  view_conversion_arguments[1] = view_geometry_arguments[0];
  view_conversion_arguments[2] = view_geometry_arguments[1];
  for (const auto operation_id : {
      UINT64_C(0x82849fe5213d1cdd), UINT64_C(0xde42165de433341e)}) {
    const auto json = ReadV4Json(make_view_call(
        operation_id, panel_view_v4, view_conversion_arguments.data(), 3));
    assert(json.find(L"\"converted\":false") != std::wstring::npos);
  }

  LB_CEF3_RESULT_V4 invalid_view_v4_result{};
  invalid_view_v4_result.struct_size = sizeof(invalid_view_v4_result);
  auto invalid_create_panel_call = create_panel_call;
  invalid_create_panel_call.target = panel_view_v4;
  assert(LB_CEF3_InvokeV4(&invalid_create_panel_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  view_boolean_argument.integer_value = 2;
  auto invalid_view_boolean_call = make_view_call(
      UINT64_C(0x06953e6cc40e7b3b), panel_view_v4, &view_boolean_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_view_boolean_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  view_integer_argument.integer_value = std::numeric_limits<int64_t>::max();
  auto invalid_view_integer_call = make_view_call(
      UINT64_C(0x25eedb862c347238), panel_view_v4, &view_integer_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_view_integer_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  view_handle_argument.handle_value = 0;
  auto invalid_view_handle_call = make_view_call(
      UINT64_C(0x4e150e2cad9592ff), panel_view_v4, &view_handle_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_view_handle_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_view_geometry_call = make_view_call(
      UINT64_C(0xc47e3b0a64000ff1), panel_view_v4,
      view_geometry_arguments.data(), 3);
  assert(LB_CEF3_InvokeV4(&invalid_view_geometry_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_HANDLE panel_window = UINT64_C(0x1234);
  assert(LB_CEF3_PanelAsWindow(panel_view, &panel_window) == LB_CEF3_OK);
  assert(panel_window == 0);
  LB_CEF3_HANDLE fill_layout = 0;
  assert(LB_CEF3_PanelSetToFillLayout(panel_view, &fill_layout) == LB_CEF3_OK);
  assert(fill_layout != 0);
  assert(LB_CEF3_HandleGetType(fill_layout) == LB_CEF3_HANDLE_LAYOUT);
  assert(LB_CEF3_LayoutIsValid(fill_layout) == 1);
  LB_CEF3_HANDLE fill_conversion = 0;
  assert(LB_CEF3_LayoutAsFillLayout(fill_layout, &fill_conversion) == LB_CEF3_OK);
  assert(fill_conversion != 0);
  LB_CEF3_HANDLE box_conversion = UINT64_C(0x1234);
  assert(LB_CEF3_LayoutAsBoxLayout(fill_layout, &box_conversion) == LB_CEF3_OK);
  assert(box_conversion == 0);
  LB_CEF3_HANDLE current_layout = 0;
  assert(LB_CEF3_PanelGetLayout(panel_view, &current_layout) == LB_CEF3_OK);
  assert(current_layout != 0);
  assert(LB_CEF3_LayoutIsValid(current_layout) == 1);

  LB_CEF3_BOX_LAYOUT_SETTINGS_V3 box_settings{};
  box_settings.struct_size = sizeof(box_settings);
  box_settings.abi_version = LB_CEF3_ABI_VERSION_V3;
  box_settings.horizontal = 1;
  box_settings.inside_border_horizontal_spacing = 2;
  box_settings.inside_border_vertical_spacing = 3;
  box_settings.inside_border_insets = {
      sizeof(box_settings.inside_border_insets), LB_CEF3_ABI_VERSION_V3, 1, 2, 3, 4};
  box_settings.between_child_spacing = 5;
  box_settings.main_axis_alignment = 0;
  box_settings.cross_axis_alignment = 3;
  box_settings.minimum_cross_axis_size = 6;
  box_settings.default_flex = 0;
  LB_CEF3_HANDLE box_layout = 0;
  assert(LB_CEF3_PanelSetToBoxLayout(panel_view, &box_settings, &box_layout)
      == LB_CEF3_OK);
  assert(box_layout != 0);
  assert(LB_CEF3_LayoutIsValid(box_layout) == 1);
  assert(LB_CEF3_LayoutIsValid(fill_layout) == 0);
  assert(LB_CEF3_LayoutIsValid(current_layout) == 0);
  box_conversion = 0;
  assert(LB_CEF3_LayoutAsBoxLayout(box_layout, &box_conversion) == LB_CEF3_OK);
  assert(box_conversion != 0);
  LB_CEF3_HANDLE no_fill_conversion = UINT64_C(0x1234);
  assert(LB_CEF3_LayoutAsFillLayout(box_layout, &no_fill_conversion) == LB_CEF3_OK);
  assert(no_fill_conversion == 0);

  const auto panel_child_a = LB_CEF3_PanelCreate();
  const auto panel_child_b = LB_CEF3_PanelCreate();
  assert(panel_child_a != 0 && panel_child_b != 0);
  assert(LB_CEF3_PanelAddChildView(panel_view, panel_child_a) == LB_CEF3_OK);
  assert(LB_CEF3_PanelAddChildViewAt(panel_view, panel_child_b, 0) == LB_CEF3_OK);
  int64_t panel_child_count = -1;
  assert(LB_CEF3_PanelGetChildViewCount(panel_view, &panel_child_count) == LB_CEF3_OK);
  assert(panel_child_count == 2);
  assert(LB_CEF3_PanelAddChildView(panel_view, panel_child_a)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_PanelAddChildView(panel_view, panel_view)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BoxLayoutSetFlexForView(box_layout, panel_child_a, 2) == LB_CEF3_OK);
  assert(LB_CEF3_BoxLayoutClearFlexForView(box_layout, panel_child_a) == LB_CEF3_OK);
  assert(LB_CEF3_BoxLayoutSetFlexForView(box_layout, panel_child_a, -1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_PanelLayout(panel_view) == LB_CEF3_OK);
  assert(LB_CEF3_PanelReorderChildView(panel_view, panel_child_b, -1) == LB_CEF3_OK);
  assert(LB_CEF3_PanelRemoveChildView(panel_view, panel_child_b) == LB_CEF3_OK);
  assert(LB_CEF3_PanelGetChildViewCount(panel_view, &panel_child_count) == LB_CEF3_OK);
  assert(panel_child_count == 1);
  assert(LB_CEF3_PanelRemoveAllChildViews(panel_view) == LB_CEF3_OK);
  assert(LB_CEF3_PanelGetChildViewCount(panel_view, &panel_child_count) == LB_CEF3_OK);
  assert(panel_child_count == 0);
  assert(LB_CEF3_BoxLayoutClearFlexForView(box_layout, panel_child_a)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_box_settings = box_settings;
  invalid_box_settings.default_flex = -1;
  LB_CEF3_HANDLE invalid_layout = UINT64_C(0x1234);
  assert(LB_CEF3_PanelSetToBoxLayout(
      panel_view, &invalid_box_settings, &invalid_layout)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(invalid_layout == 0);

  LB_CEF3_HANDLE fill_layout_v4 = 0;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xea5000a6d9f12cd6), panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    fill_layout_v4 = result.handle_value;
    assert(fill_layout_v4 != 0);
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x2a771bfd454267a0), fill_layout_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 1);
  }
  LB_CEF3_HANDLE fill_conversion_v4 = 0;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x42c12f827ee9cb49), fill_layout_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    fill_conversion_v4 = result.handle_value;
    assert(fill_conversion_v4 != 0);
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x83ecd92041a5ac9d), fill_layout_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value == 0);
  }
  LB_CEF3_HANDLE current_layout_v4 = 0;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xabcafd558df4bc3b), panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    current_layout_v4 = result.handle_value;
    assert(current_layout_v4 != 0);
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x09bb2f66657c167d), panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value == 0);
  }

  std::array<LB_CEF3_ARGUMENT_V4, 12> box_settings_arguments{};
  for (auto& argument : box_settings_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  }
  box_settings_arguments[0].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  const std::array<int64_t, 12> box_settings_values{
      1, 2, 3, 1, 2, 3, 4, 5, 0, 3, 6, 0};
  for (size_t index = 0; index < box_settings_values.size(); ++index)
    box_settings_arguments[index].integer_value = box_settings_values[index];
  LB_CEF3_HANDLE box_layout_v4 = 0;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x541e62a6e6c82f8b), panel_view_v4,
        box_settings_arguments.data(), box_settings_arguments.size()));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    box_layout_v4 = result.handle_value;
    assert(box_layout_v4 != 0);
  }
  assert(LB_CEF3_LayoutIsValid(fill_layout_v4) == 0);
  LB_CEF3_HANDLE box_conversion_v4 = 0;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x83ecd92041a5ac9d), box_layout_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    box_conversion_v4 = result.handle_value;
    assert(box_conversion_v4 != 0);
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x42c12f827ee9cb49), box_layout_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value == 0);
  }
  const auto panel_child_v4_a = LB_CEF3_PanelCreate();
  const auto panel_child_v4_b = LB_CEF3_PanelCreate();
  assert(panel_child_v4_a != 0 && panel_child_v4_b != 0);
  LB_CEF3_ARGUMENT_V4 panel_child_arguments[2]{};
  panel_child_arguments[0].struct_size = sizeof(panel_child_arguments[0]);
  panel_child_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  panel_child_arguments[0].handle_value = panel_child_v4_a;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xf960971ad168ed5b), panel_view_v4,
      panel_child_arguments, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  panel_child_arguments[0].handle_value = panel_child_v4_b;
  panel_child_arguments[1].struct_size = sizeof(panel_child_arguments[1]);
  panel_child_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  panel_child_arguments[1].integer_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x3433fd0a5409ebaa), panel_view_v4,
      panel_child_arguments, 2)).value_kind == LB_CEF3_VALUE_V4_VOID);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x98bd51ed6ac262c3), panel_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value == 2);
  }
  panel_child_arguments[0].handle_value = panel_child_v4_a;
  panel_child_arguments[1].integer_value = 2;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x97e3f737b838dadb), box_layout_v4,
      panel_child_arguments, 2)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x0b63b8fd9ef455d3), box_layout_v4,
      panel_child_arguments, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xe5505b3c38b07796), panel_view_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  panel_child_arguments[0].handle_value = panel_child_v4_b;
  panel_child_arguments[1].integer_value = -1;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x571f949e652da3b7), panel_view_v4,
      panel_child_arguments, 2)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4e6ca68bae504106), panel_view_v4,
      panel_child_arguments, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x72a10983d4d64916), panel_view_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  box_settings_arguments[11].integer_value = -1;
  auto invalid_box_layout_call = make_view_call(
      UINT64_C(0x541e62a6e6c82f8b), panel_view_v4,
      box_settings_arguments.data(), box_settings_arguments.size());
  assert(LB_CEF3_InvokeV4(&invalid_box_layout_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  panel_child_arguments[1].integer_value = -1;
  auto invalid_box_flex_call = make_view_call(
      UINT64_C(0x97e3f737b838dadb), box_layout_v4,
      panel_child_arguments, 2);
  assert(LB_CEF3_InvokeV4(&invalid_box_flex_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_HANDLE scroll_view = 0;
  assert(LB_CEF3_ScrollViewCreate(0, &scroll_view) == LB_CEF3_OK);
  assert(scroll_view != 0);
  assert(LB_CEF3_HandleGetType(scroll_view) == LB_CEF3_HANDLE_VIEW);
  LB_CEF3_HANDLE scroll_content_result = UINT64_C(0x1234);
  assert(LB_CEF3_ScrollViewGetContentView(scroll_view, &scroll_content_result)
      == LB_CEF3_OK);
  assert(scroll_content_result == 0);
  const auto scroll_content = LB_CEF3_PanelCreate();
  assert(scroll_content != 0);
  LB_CEF3_RECT_V3 scroll_content_bounds{
      sizeof(scroll_content_bounds), LB_CEF3_ABI_VERSION_V3, 0, 0, 640, 480};
  assert(LB_CEF3_ViewSetBounds(scroll_content, &scroll_content_bounds) == LB_CEF3_OK);
  assert(LB_CEF3_ScrollViewSetContentView(scroll_view, scroll_content) == LB_CEF3_OK);
  assert(LB_CEF3_ScrollViewGetContentView(scroll_view, &scroll_content_result)
      == LB_CEF3_OK);
  assert(scroll_content_result != 0);
  assert(LB_CEF3_ViewIsSame(scroll_content, scroll_content_result) == 1);
  LB_CEF3_RECT_V3 scroll_visible{
      sizeof(scroll_visible), LB_CEF3_ABI_VERSION_V3, 0, 0, 0, 0};
  assert(LB_CEF3_ScrollViewGetVisibleContentRect(scroll_view, &scroll_visible)
      == LB_CEF3_OK);
  assert(LB_CEF3_ScrollViewHasHorizontalScrollbar(scroll_view) >= 0);
  assert(LB_CEF3_ScrollViewHasVerticalScrollbar(scroll_view) >= 0);
  int32_t scrollbar_size = -1;
  assert(LB_CEF3_ScrollViewGetHorizontalScrollbarHeight(scroll_view, &scrollbar_size)
      == LB_CEF3_OK);
  assert(scrollbar_size >= 0);
  assert(LB_CEF3_ScrollViewGetVerticalScrollbarWidth(scroll_view, &scrollbar_size)
      == LB_CEF3_OK);
  assert(scrollbar_size >= 0);
  assert(LB_CEF3_ScrollViewSetContentView(scroll_view, scroll_view)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE invalid_scroll = UINT64_C(0x1234);
  assert(LB_CEF3_ScrollViewCreate(panel_view, &invalid_scroll)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_scroll == 0);
  assert(LB_CEF3_ScrollViewGetContentView(panel_view, &invalid_scroll)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  LB_CEF3_ARGUMENT_V4 nullable_delegate_argument{};
  nullable_delegate_argument.struct_size = sizeof(nullable_delegate_argument);
  nullable_delegate_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  nullable_delegate_argument.handle_value = 0;
  const auto scroll_view_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0xb267ba9145ef4318), 0, &nullable_delegate_argument, 1));
  const auto scroll_view_v4 = scroll_view_v4_result.handle_value;
  assert(scroll_view_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(scroll_view_v4 != 0);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xf7ff62d422fa4913), scroll_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value == 0);
  }
  const auto scroll_content_v4 = LB_CEF3_PanelCreate();
  assert(scroll_content_v4 != 0);
  LB_CEF3_ARGUMENT_V4 scroll_content_argument{};
  scroll_content_argument.struct_size = sizeof(scroll_content_argument);
  scroll_content_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  scroll_content_argument.handle_value = scroll_content_v4;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xba52e47eee7d1d0d), scroll_view_v4,
      &scroll_content_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xf7ff62d422fa4913), scroll_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(result.handle_value != 0);
    assert(LB_CEF3_HandleRelease(result.handle_value) == LB_CEF3_OK);
  }
  const auto visible_json = ReadV4Json(make_view_call(
      UINT64_C(0x611c06ef4869c1c0), scroll_view_v4));
  assert(visible_json.find(L"\"width\":") != std::wstring::npos);
  for (const auto operation_id : {
      UINT64_C(0x2fcd4972f9c01655), UINT64_C(0xca459e860d28b1ae)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, scroll_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  for (const auto operation_id : {
      UINT64_C(0x56a7f8764660fca0), UINT64_C(0xbf59ae57c41e7857)}) {
    const auto result = invoke_view_call(make_view_call(operation_id, scroll_view_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value >= 0);
  }
  auto invalid_scroll_create_call = make_view_call(
      UINT64_C(0xb267ba9145ef4318), panel_view_v4,
      &nullable_delegate_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_scroll_create_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  scroll_content_argument.handle_value = 0;
  auto invalid_scroll_content_call = make_view_call(
      UINT64_C(0xba52e47eee7d1d0d), scroll_view_v4,
      &scroll_content_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_scroll_content_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_HandleRelease(scroll_content_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(scroll_view_v4) == LB_CEF3_OK);
  assert(LB_CEF3_ScrollViewHasHorizontalScrollbar(scroll_view_v4)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(scroll_content_result) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(scroll_content) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(scroll_view) == LB_CEF3_OK);

  assert(LB_CEF3_SetEventCallbackV4(0, TestEventCallbackV4, nullptr)
      == LB_CEF3_OK);
  LB_CEF3_HANDLE textfield_delegate = 0;
  assert(LB_CEF3_TextfieldDelegateCreate(&textfield_delegate) == LB_CEF3_OK);
  assert(textfield_delegate != 0);
  assert(LB_CEF3_HandleGetType(textfield_delegate)
      == LB_CEF3_HANDLE_VIEW_DELEGATE);
  assert(LB_CEF3_TextfieldDelegateSubscribeKeyEvent(
             textfield_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldDelegateSubscribeAfterUserAction(
             textfield_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldDelegateSubscribeKeyEvent(
             textfield_delegate, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TextfieldDelegateSubscribeKeyEvent(
             panel_view, 1) == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE delegated_textfield = 0;
  assert(LB_CEF3_TextfieldCreate(
             textfield_delegate, &delegated_textfield) == LB_CEF3_OK);
  assert(delegated_textfield != 0);
  assert(LB_CEF3_TextfieldSetText(
             delegated_textfield, L"委托输入框") == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 control_delegate_boolean{};
  control_delegate_boolean.struct_size = sizeof(control_delegate_boolean);
  control_delegate_boolean.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  control_delegate_boolean.integer_value = 1;
  for (const auto operation_id : {
      UINT64_C(0x7b3180a8bed0ff0f),
      UINT64_C(0xd1066034883ed59e)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, textfield_delegate,
        &control_delegate_boolean, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  control_delegate_boolean.integer_value = 2;
  auto invalid_textfield_delegate_call = make_view_call(
      UINT64_C(0x7b3180a8bed0ff0f), textfield_delegate,
      &control_delegate_boolean, 1);
  assert(LB_CEF3_InvokeV4(
             &invalid_textfield_delegate_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  control_delegate_boolean.integer_value = 1;

  LB_CEF3_HANDLE textfield = 0;
  assert(LB_CEF3_TextfieldCreate(0, &textfield) == LB_CEF3_OK);
  assert(textfield != 0);
  assert(LB_CEF3_HandleGetType(textfield) == LB_CEF3_HANDLE_VIEW);
  LB_CEF3_HANDLE textfield_conversion = 0;
  assert(LB_CEF3_ViewAsTextfield(textfield, &textfield_conversion) == LB_CEF3_OK);
  assert(textfield_conversion != 0);
  assert(LB_CEF3_ViewIsSame(textfield, textfield_conversion) == 1);
  assert(LB_CEF3_TextfieldSetPasswordInput(textfield, 1) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldIsPasswordInput(textfield) == 1);
  assert(LB_CEF3_TextfieldSetPasswordInput(textfield, 0) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldSetReadOnly(textfield, 1) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldIsReadOnly(textfield) == 1);
  assert(LB_CEF3_TextfieldSetText(textfield, L"甲乙丙") == LB_CEF3_OK);
  assert(ReadManagedText(textfield, LB_CEF3_TextfieldGetText) == L"甲乙丙");
  assert(LB_CEF3_TextfieldSetReadOnly(textfield, 0) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldAppendText(textfield, L"丁") == LB_CEF3_OK);
  assert(ReadManagedText(textfield, LB_CEF3_TextfieldGetText) == L"甲乙丙丁");
  LB_CEF3_RANGE_V3 textfield_range{
      sizeof(textfield_range), LB_CEF3_ABI_VERSION_V3, 1, 3};
  assert(LB_CEF3_TextfieldSelectRange(textfield, &textfield_range) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldHasSelection(textfield) == 1);
  assert(ReadManagedText(textfield, LB_CEF3_TextfieldGetSelectedText) == L"乙丙");
  LB_CEF3_RANGE_V3 selected_range{
      sizeof(selected_range), LB_CEF3_ABI_VERSION_V3, 0, 0};
  assert(LB_CEF3_TextfieldGetSelectedRange(textfield, &selected_range) == LB_CEF3_OK);
  assert(selected_range.from == 1 && selected_range.to == 3);
  uint64_t cursor_position = 0;
  assert(LB_CEF3_TextfieldGetCursorPosition(textfield, &cursor_position) == LB_CEF3_OK);
  assert(cursor_position <= 4);
  assert(LB_CEF3_TextfieldInsertOrReplaceText(textfield, L"替") == LB_CEF3_OK);
  assert(ReadManagedText(textfield, LB_CEF3_TextfieldGetText) == L"甲替丁");
  assert(LB_CEF3_TextfieldClearSelection(textfield) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldSelectAll(textfield, 0) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldHasSelection(textfield) == 1);
  assert(LB_CEF3_TextfieldSetFontList(textfield, L"Arial, Bold 14px") == LB_CEF3_OK);
  LB_CEF3_RANGE_V3 whole_text_range{
      sizeof(whole_text_range), LB_CEF3_ABI_VERSION_V3, 0, 0};
  assert(LB_CEF3_TextfieldApplyTextColor(
      textfield, UINT32_C(0xff123456), nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldApplyTextStyle(
      textfield, 0, 1, &whole_text_range) == LB_CEF3_OK);
  const int select_all_enabled = LB_CEF3_TextfieldIsCommandEnabled(textfield, 4);
  assert(select_all_enabled == 0 || select_all_enabled == 1);
  assert(LB_CEF3_TextfieldExecuteCommand(textfield, 4) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldClearEditHistory(textfield) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldSetText(textfield, L"") == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldSetPlaceholderText(textfield, L"请输入内容") == LB_CEF3_OK);
  assert(ReadManagedText(textfield, LB_CEF3_TextfieldGetPlaceholderText)
      == L"请输入内容");
  assert(LB_CEF3_TextfieldSetAccessibleName(textfield, L"搜索输入框") == LB_CEF3_OK);
  constexpr uint32_t kTextColor = UINT32_C(0xff123456);
  constexpr uint32_t kSelectionTextColor = UINT32_C(0xffabcdef);
  constexpr uint32_t kSelectionBackgroundColor = UINT32_C(0xff102030);
  assert(LB_CEF3_TextfieldSetTextColor(textfield, kTextColor) == LB_CEF3_OK);
  uint32_t text_color = 0;
  assert(LB_CEF3_TextfieldGetTextColor(textfield, &text_color) == LB_CEF3_OK);
  assert(text_color == kTextColor);
  assert(LB_CEF3_TextfieldSetSelectionTextColor(
             textfield, kSelectionTextColor)
      == LB_CEF3_OK);
  uint32_t selection_text_color = 0;
  assert(LB_CEF3_TextfieldGetSelectionTextColor(
             textfield, &selection_text_color)
      == LB_CEF3_OK);
  assert(selection_text_color == kSelectionTextColor);
  assert(LB_CEF3_TextfieldSetSelectionBackgroundColor(
             textfield, kSelectionBackgroundColor)
      == LB_CEF3_OK);
  uint32_t selection_background_color = 0;
  assert(LB_CEF3_TextfieldGetSelectionBackgroundColor(
             textfield, &selection_background_color)
      == LB_CEF3_OK);
  assert(selection_background_color == kSelectionBackgroundColor);
  assert(LB_CEF3_TextfieldSetPlaceholderTextColor(
             textfield, UINT32_C(0xff998877))
      == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldGetTextColor(textfield, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TextfieldSetPasswordInput(textfield, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_textfield_range = textfield_range;
  invalid_textfield_range.from = 3;
  invalid_textfield_range.to = 2;
  assert(LB_CEF3_TextfieldSelectRange(textfield, &invalid_textfield_range)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TextfieldApplyTextStyle(textfield, 99, 1, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TextfieldIsCommandEnabled(textfield, 99)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TextfieldGetText(panel_view, nullptr, 0, &view_text_required)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE invalid_textfield = UINT64_C(0x1234);
  assert(LB_CEF3_TextfieldCreate(panel_view, &invalid_textfield)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_textfield == 0);

  LB_CEF3_ARGUMENT_V4 textfield_delegate_argument{};
  textfield_delegate_argument.struct_size = sizeof(textfield_delegate_argument);
  textfield_delegate_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  textfield_delegate_argument.handle_value = 0;
  const auto textfield_v4_create_result = invoke_view_call(make_view_call(
      UINT64_C(0x80a66dae45632801), 0, &textfield_delegate_argument, 1));
  const auto textfield_v4 = textfield_v4_create_result.handle_value;
  assert(textfield_v4_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(textfield_v4 != 0);

  LB_CEF3_ARGUMENT_V4 textfield_text_argument{};
  textfield_text_argument.struct_size = sizeof(textfield_text_argument);
  textfield_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  textfield_text_argument.text_value = L"一二三";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xd18cba575070e37b), textfield_v4,
      &textfield_text_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  textfield_text_argument.text_value = L"四";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x272c0ef100dcceee), textfield_v4,
      &textfield_text_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(ReadV4Text(make_view_call(UINT64_C(0x23b23e27e0952e14), textfield_v4))
      == L"一二三四");

  std::array<LB_CEF3_ARGUMENT_V4, 4> textfield_range_arguments{};
  for (auto& argument : textfield_range_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  }
  textfield_range_arguments[0].integer_value = 1;
  textfield_range_arguments[1].integer_value = 3;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x2e87954be6afc19c), textfield_v4,
      textfield_range_arguments.data(), 2)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(ReadV4Text(make_view_call(UINT64_C(0xa2d934593ce14fe7), textfield_v4))
      == L"二三");
  assert(ReadV4Json(make_view_call(UINT64_C(0x40279664305e1e70), textfield_v4))
      .find(L"\"from\":1") != std::wstring::npos);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xe8809b64cac5f8b6), textfield_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 1);
  }
  textfield_text_argument.text_value = L"替换";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x502f83c1002351b6), textfield_v4,
      &textfield_text_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb346fbbcfd35c44a), textfield_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 textfield_boolean_argument{};
  textfield_boolean_argument.struct_size = sizeof(textfield_boolean_argument);
  textfield_boolean_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  textfield_boolean_argument.integer_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb3111d85056a40e2), textfield_v4,
      &textfield_boolean_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x25a7260f13aa86ef), textfield_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value >= 0);
  }
  for (const auto [set_operation_id, get_operation_id] : {
      std::pair{UINT64_C(0x1c36f4e192322de9), UINT64_C(0xd5ff715d073498b8)},
      std::pair{UINT64_C(0xf770116b8008f154), UINT64_C(0xe302ed40be085b95)}}) {
    textfield_boolean_argument.integer_value = 1;
    assert(invoke_view_call(make_view_call(
        set_operation_id, textfield_v4, &textfield_boolean_argument, 1)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
    const auto result = invoke_view_call(make_view_call(get_operation_id, textfield_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 1);
    textfield_boolean_argument.integer_value = 0;
    assert(invoke_view_call(make_view_call(
        set_operation_id, textfield_v4, &textfield_boolean_argument, 1)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
  }

  for (const auto [operation_id, text] : {
      std::pair{UINT64_C(0xe3fe75e05877d273), L"Arial, 14px"},
      std::pair{UINT64_C(0x8895c06ec0704d23), L"占位文本"},
      std::pair{UINT64_C(0xbdfeac99fc2596d1), L"辅助名称"}}) {
    textfield_text_argument.text_value = text;
    assert(invoke_view_call(make_view_call(
        operation_id, textfield_v4, &textfield_text_argument, 1)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
  }
  assert(ReadV4Text(make_view_call(UINT64_C(0xa47f1c8ef5d14053), textfield_v4))
      == L"占位文本");

  textfield_range_arguments[0].integer_value = UINT32_C(0xffabcdef);
  textfield_range_arguments[1].integer_value = 0;
  textfield_range_arguments[2].integer_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xd8349602124db739), textfield_v4,
      textfield_range_arguments.data(), 3)).value_kind == LB_CEF3_VALUE_V4_VOID);
  textfield_range_arguments[0].integer_value = 0;
  textfield_range_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  textfield_range_arguments[1].integer_value = 1;
  textfield_range_arguments[2].integer_value = 0;
  textfield_range_arguments[3].integer_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8c45008f32034173), textfield_v4,
      textfield_range_arguments.data(), 4)).value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_ARGUMENT_V4 textfield_command_argument{};
  textfield_command_argument.struct_size = sizeof(textfield_command_argument);
  textfield_command_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  textfield_command_argument.integer_value = 4;
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xa72621a562ee2a73), textfield_v4,
        &textfield_command_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x6ea641446c951a0e), textfield_v4,
      &textfield_command_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x71a77a953192917a), textfield_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_ARGUMENT_V4 textfield_color_argument{};
  textfield_color_argument.struct_size = sizeof(textfield_color_argument);
  textfield_color_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  for (const auto [set_operation_id, get_operation_id, color] : {
      std::tuple{UINT64_C(0x84adb0a0721848bb),
                 UINT64_C(0x6f6f3f49e22d910d), UINT32_C(0xff010203)},
      std::tuple{UINT64_C(0x187ae1ef63df672d),
                 UINT64_C(0xe09765592bcec86b), UINT32_C(0xff112233)},
      std::tuple{UINT64_C(0x32396763ad1bd09c),
                 UINT64_C(0x8f755ff10cf8bdf1), UINT32_C(0xff445566)}}) {
    textfield_color_argument.integer_value = color;
    assert(invoke_view_call(make_view_call(
        set_operation_id, textfield_v4, &textfield_color_argument, 1)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
    const auto color_result = invoke_view_call(make_view_call(
        get_operation_id, textfield_v4));
    assert(color_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(color_result.integer_value == color);
  }
  textfield_color_argument.integer_value = UINT32_C(0xff778899);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x14b606a94bcb383d), textfield_v4,
      &textfield_color_argument, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
  textfield_color_argument.integer_value = -1;
  auto invalid_textfield_color_call = make_view_call(
      UINT64_C(0x84adb0a0721848bb), textfield_v4,
      &textfield_color_argument, 1);
  assert(LB_CEF3_InvokeV4(
             &invalid_textfield_color_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  textfield_boolean_argument.integer_value = 2;
  auto invalid_textfield_boolean_call = make_view_call(
      UINT64_C(0x1c36f4e192322de9), textfield_v4,
      &textfield_boolean_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_textfield_boolean_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  textfield_range_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  textfield_range_arguments[0].integer_value = 3;
  textfield_range_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  textfield_range_arguments[1].integer_value = 2;
  auto invalid_textfield_range_call = make_view_call(
      UINT64_C(0x2e87954be6afc19c), textfield_v4,
      textfield_range_arguments.data(), 2);
  assert(LB_CEF3_InvokeV4(&invalid_textfield_range_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  textfield_text_argument.text_value = nullptr;
  auto invalid_textfield_text_call = make_view_call(
      UINT64_C(0xd18cba575070e37b), textfield_v4,
      &textfield_text_argument, 1);
  assert(LB_CEF3_InvokeV4(&invalid_textfield_text_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_HandleRelease(textfield_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldIsReadOnly(textfield_v4) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(textfield_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(textfield) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(delegated_textfield) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(textfield_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_TextfieldDelegateSubscribeKeyEvent(
             textfield_delegate, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);

  uint64_t display_count = 0;
  assert(LB_CEF3_DisplayGetCount(&display_count) == LB_CEF3_OK);
  assert(display_count >= 1);
  LB_CEF3_HANDLE primary_display = 0;
  assert(LB_CEF3_DisplayGetPrimary(&primary_display) == LB_CEF3_OK);
  assert(primary_display != 0);
  assert(LB_CEF3_HandleGetType(primary_display) == LB_CEF3_HANDLE_DISPLAY);
  int64_t primary_display_id = 0;
  assert(LB_CEF3_DisplayGetId(primary_display, &primary_display_id) == LB_CEF3_OK);
  double primary_scale = 0.0;
  assert(LB_CEF3_DisplayGetDeviceScaleFactor(primary_display, &primary_scale)
      == LB_CEF3_OK);
  assert(std::isfinite(primary_scale) && primary_scale > 0.0);
  LB_CEF3_RECT_V3 primary_bounds{
      sizeof(primary_bounds), LB_CEF3_ABI_VERSION_V3, 0, 0, 0, 0};
  LB_CEF3_RECT_V3 primary_work_area{
      sizeof(primary_work_area), LB_CEF3_ABI_VERSION_V3, 0, 0, 0, 0};
  assert(LB_CEF3_DisplayGetBounds(primary_display, &primary_bounds) == LB_CEF3_OK);
  assert(LB_CEF3_DisplayGetWorkArea(primary_display, &primary_work_area) == LB_CEF3_OK);
  assert(primary_bounds.width > 0 && primary_bounds.height > 0);
  assert(primary_work_area.width > 0 && primary_work_area.height > 0);
  int32_t primary_rotation = -1;
  assert(LB_CEF3_DisplayGetRotation(primary_display, &primary_rotation) == LB_CEF3_OK);

  LB_CEF3_POINT_V3 display_point{
      sizeof(display_point), LB_CEF3_ABI_VERSION_V3,
      primary_bounds.x + 10, primary_bounds.y + 10};
  LB_CEF3_HANDLE nearest_display = 0;
  assert(LB_CEF3_DisplayGetNearestPoint(&display_point, 0, &nearest_display)
      == LB_CEF3_OK);
  assert(nearest_display != 0);
  LB_CEF3_HANDLE matching_display = 0;
  assert(LB_CEF3_DisplayGetMatchingBounds(&primary_bounds, 0, &matching_display)
      == LB_CEF3_OK);
  assert(matching_display != 0);
  LB_CEF3_POINT_V3 converted_screen_point{
      sizeof(converted_screen_point), LB_CEF3_ABI_VERSION_V3, 0, 0};
  assert(LB_CEF3_DisplayConvertScreenPointToPixels(
      &display_point, &converted_screen_point) == LB_CEF3_OK);
  assert(LB_CEF3_DisplayConvertScreenPointFromPixels(
      &converted_screen_point, &display_point) == LB_CEF3_OK);
  LB_CEF3_RECT_V3 converted_screen_rect{
      sizeof(converted_screen_rect), LB_CEF3_ABI_VERSION_V3, 0, 0, 0, 0};
  assert(LB_CEF3_DisplayConvertScreenRectToPixels(
      &primary_bounds, &converted_screen_rect) == LB_CEF3_OK);
  assert(LB_CEF3_DisplayConvertScreenRectFromPixels(
      &converted_screen_rect, &primary_work_area) == LB_CEF3_OK);
  assert(LB_CEF3_DisplayConvertPointToPixels(primary_display, &display_point)
      == LB_CEF3_OK);
  assert(LB_CEF3_DisplayConvertPointFromPixels(primary_display, &display_point)
      == LB_CEF3_OK);

  LB_CEF3_HANDLE display_collection = 0;
  assert(LB_CEF3_DisplayGetAll(&display_collection) == LB_CEF3_OK);
  assert(display_collection != 0);
  assert(LB_CEF3_HandleGetType(display_collection)
      == LB_CEF3_HANDLE_DISPLAY_COLLECTION);
  uint64_t collection_count = 0;
  assert(LB_CEF3_DisplayCollectionGetCount(display_collection, &collection_count)
      == LB_CEF3_OK);
  assert(collection_count == display_count && collection_count >= 1);
  LB_CEF3_HANDLE first_collection_display = 0;
  assert(LB_CEF3_DisplayCollectionGetAt(
      display_collection, 0, &first_collection_display) == LB_CEF3_OK);
  assert(first_collection_display != 0);
  LB_CEF3_HANDLE invalid_collection_display = UINT64_C(0x1234);
  assert(LB_CEF3_DisplayCollectionGetAt(
      display_collection, collection_count, &invalid_collection_display)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(invalid_collection_display == 0);
  assert(LB_CEF3_DisplayGetId(panel_view, &primary_display_id)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_DisplayGetNearestPoint(&display_point, 2, &invalid_collection_display)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xdbf6e4e255d57ea7), 0));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value >= 1);
  }
  const auto primary_display_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0x6a7c832c44796781), 0));
  const auto primary_display_v4 = primary_display_v4_result.handle_value;
  assert(primary_display_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(primary_display_v4 != 0);
  const auto display_collection_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0xdb952e2042437047), 0));
  const auto display_collection_v4 = display_collection_v4_result.handle_value;
  assert(display_collection_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(display_collection_v4 != 0);
  assert(LB_CEF3_DisplayCollectionGetCount(display_collection_v4, &collection_count)
      == LB_CEF3_OK);
  assert(collection_count >= 1);

  std::array<LB_CEF3_ARGUMENT_V4, 5> display_arguments{};
  for (auto& argument : display_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  }
  display_arguments[0].integer_value = primary_bounds.x;
  display_arguments[1].integer_value = primary_bounds.y;
  for (const auto operation_id : {
      UINT64_C(0xde3f665e36c137a6), UINT64_C(0xf96d76f02ff02f98)}) {
    assert(!ReadV4Json(make_view_call(
        operation_id, 0, display_arguments.data(), 2)).empty());
  }
  display_arguments[2].integer_value = primary_bounds.width;
  display_arguments[3].integer_value = primary_bounds.height;
  for (const auto operation_id : {
      UINT64_C(0x04c48cf7a76b70ce), UINT64_C(0x75e778ca34cbd2a7)}) {
    assert(!ReadV4Json(make_view_call(
        operation_id, 0, display_arguments.data(), 4)).empty());
  }
  display_arguments[2].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  display_arguments[2].integer_value = 0;
  const auto nearest_display_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0x03ba4b45e962680b), 0, display_arguments.data(), 3));
  assert(nearest_display_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(nearest_display_v4_result.handle_value != 0);
  display_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  display_arguments[2].integer_value = primary_bounds.width;
  display_arguments[3].integer_value = primary_bounds.height;
  display_arguments[4].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  display_arguments[4].integer_value = 0;
  const auto matching_display_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0x8d38c3fa5c6d56a4), 0, display_arguments.data(), 5));
  assert(matching_display_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(matching_display_v4_result.handle_value != 0);

  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xc3035732a3aa0118), primary_display_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0xfc565862421d3b3c), primary_display_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_DOUBLE);
    assert(result.double_value > 0.0);
  }
  display_arguments[0].integer_value = 10;
  display_arguments[1].integer_value = 20;
  for (const auto operation_id : {
      UINT64_C(0x5fd52a3a95cf909e), UINT64_C(0x1ffd13af899a1128)}) {
    assert(!ReadV4Json(make_view_call(
        operation_id, primary_display_v4, display_arguments.data(), 2)).empty());
  }
  for (const auto operation_id : {
      UINT64_C(0xf156f2a342936107), UINT64_C(0x2846a3ce8a575893)}) {
    assert(!ReadV4Json(make_view_call(operation_id, primary_display_v4)).empty());
  }
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x7d03331e2fa9cf20), primary_display_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  }
  auto invalid_display_global_call = make_view_call(
      UINT64_C(0x6a7c832c44796781), primary_display_v4);
  assert(LB_CEF3_InvokeV4(&invalid_display_global_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  display_arguments[2].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  display_arguments[2].integer_value = 2;
  auto invalid_display_boolean_call = make_view_call(
      UINT64_C(0x03ba4b45e962680b), 0, display_arguments.data(), 3);
  assert(LB_CEF3_InvokeV4(&invalid_display_boolean_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_HandleRelease(matching_display_v4_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(nearest_display_v4_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(display_collection_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(primary_display_v4) == LB_CEF3_OK);
  assert(LB_CEF3_DisplayGetRotation(primary_display_v4, &primary_rotation)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(first_collection_display) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(display_collection) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(matching_display) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(nearest_display) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(primary_display) == LB_CEF3_OK);

  LB_CEF3_HANDLE drag_data = 0;
  assert(LB_CEF3_DragDataCreate(&drag_data) == LB_CEF3_OK);
  assert(drag_data != 0);
  assert(LB_CEF3_HandleGetType(drag_data) == LB_CEF3_HANDLE_DRAG_DATA);
  assert(LB_CEF3_DragDataIsReadOnly(drag_data) == 0);
  assert(LB_CEF3_DragDataIsLink(drag_data) >= 0);
  assert(LB_CEF3_DragDataIsFragment(drag_data) >= 0);
  assert(LB_CEF3_DragDataIsFile(drag_data) >= 0);
  assert(LB_CEF3_DragDataHasImage(drag_data) == 0);
  assert(LB_CEF3_DragDataSetLinkUrl(drag_data, L"https://example.test/item")
      == LB_CEF3_OK);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetLinkUrl)
      == L"https://example.test/item");
  assert(LB_CEF3_DragDataSetLinkTitle(drag_data, L"拖放标题") == LB_CEF3_OK);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetLinkTitle) == L"拖放标题");
  assert(LB_CEF3_DragDataSetLinkMetadata(drag_data, L"元数据") == LB_CEF3_OK);
  (void)ReadManagedText(drag_data, LB_CEF3_DragDataGetLinkMetadata);
  assert(LB_CEF3_DragDataSetFragmentText(drag_data, L"纯文本片段") == LB_CEF3_OK);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetFragmentText) == L"纯文本片段");
  assert(LB_CEF3_DragDataSetFragmentHtml(drag_data, L"<b>片段</b>") == LB_CEF3_OK);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetFragmentHtml) == L"<b>片段</b>");
  assert(LB_CEF3_DragDataSetFragmentBaseUrl(drag_data, L"https://example.test/base/")
      == LB_CEF3_OK);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetFragmentBaseUrl)
      == L"https://example.test/base/");
  assert(LB_CEF3_DragDataIsLink(drag_data) >= 0);
  assert(LB_CEF3_DragDataIsFragment(drag_data) >= 0);
  assert(ReadManagedText(drag_data, LB_CEF3_DragDataGetFileName).empty());

  const wchar_t* drag_file_path = L"C:\\tmp\\lingbuilder-drag.txt";
  assert(LB_CEF3_DragDataAddFile(drag_data, drag_file_path, L"拖放文件.txt")
      == LB_CEF3_OK);
  assert(LB_CEF3_DragDataIsFile(drag_data) >= 0);
  LB_CEF3_HANDLE drag_file_names = 0;
  LB_CEF3_HANDLE drag_file_paths = 0;
  assert(LB_CEF3_DragDataGetFileNames(drag_data, &drag_file_names) == LB_CEF3_OK);
  assert(LB_CEF3_DragDataGetFilePaths(drag_data, &drag_file_paths) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(drag_file_names) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_HandleGetType(drag_file_paths) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(drag_file_names) >= 1);
  assert(LB_CEF3_ListGetSize(drag_file_paths) >= 1);
  assert(!ReadTextListItem(drag_file_names, 0).empty());
  assert(ReadTextListItem(drag_file_paths, 0) == drag_file_path);
  uint64_t drag_file_size = 1;
  assert(LB_CEF3_DragDataGetFileContents(drag_data, 0, &drag_file_size)
      == LB_CEF3_OK);
  assert(drag_file_size == 0);
  assert(LB_CEF3_DragDataGetFileContents(drag_data, panel_view, &drag_file_size)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE drag_image = UINT64_C(1);
  assert(LB_CEF3_DragDataGetImage(drag_data, &drag_image) == LB_CEF3_OK);
  assert(drag_image == 0);
  LB_CEF3_POINT_V3 drag_hotspot{
      sizeof(drag_hotspot), LB_CEF3_ABI_VERSION_V3, 99, 99};
  assert(LB_CEF3_DragDataGetImageHotspot(drag_data, &drag_hotspot) == LB_CEF3_OK);
  assert(drag_hotspot.x == 0 && drag_hotspot.y == 0);

  LB_CEF3_HANDLE drag_clone = 0;
  assert(LB_CEF3_DragDataClone(drag_data, &drag_clone) == LB_CEF3_OK);
  assert(drag_clone != 0 && drag_clone != drag_data);
  assert(ReadManagedText(drag_clone, LB_CEF3_DragDataGetFragmentText)
      == ReadManagedText(drag_data, LB_CEF3_DragDataGetFragmentText));
  assert(LB_CEF3_DragDataClearFilenames(drag_clone) == LB_CEF3_OK);
  assert(LB_CEF3_DragDataIsFile(drag_clone) >= 0);
  assert(LB_CEF3_DragDataIsFile(drag_data) >= 0);
  assert(LB_CEF3_DragDataResetFileContents(drag_clone) == LB_CEF3_OK);
  assert(LB_CEF3_DragDataAddFile(drag_clone, nullptr, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_DragDataIsLink(panel_view) == LB_CEF3_ERROR_HANDLE_TYPE);

  auto drag_create_call = make_view_call(UINT64_C(0x84f8d8d0b4e56169), 0);
  const auto drag_v4_result = invoke_view_call(drag_create_call);
  const auto drag_v4 = drag_v4_result.handle_value;
  assert(drag_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(drag_v4 != 0);
  LB_CEF3_ARGUMENT_V4 drag_text_argument{};
  drag_text_argument.struct_size = sizeof(drag_text_argument);
  drag_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  for (const auto [set_operation, get_operation, value] : {
      std::tuple{UINT64_C(0x158731c761924534), UINT64_C(0x99409c349426184f), L"https://v4.example/"},
      std::tuple{UINT64_C(0x45816f77f237d9e6), UINT64_C(0xbe251cb8f4c1afe2), L"V4标题"},
      std::tuple{UINT64_C(0x2eedf9637c8b9ccf), UINT64_C(0x0f8ba0968424c793), L"V4元数据"},
      std::tuple{UINT64_C(0x23d3ab765ff8600c), UINT64_C(0xff07d8f6dcf50b50), L"V4文本"},
      std::tuple{UINT64_C(0x5765415157da953f), UINT64_C(0x21e3aed1daa66611), L"<i>V4</i>"},
      std::tuple{UINT64_C(0x8adf0ec3fa2d8ab5), UINT64_C(0x6db38215c8d10403), L"https://v4.example/base/"}}) {
    drag_text_argument.text_value = value;
    assert(invoke_view_call(make_view_call(
        set_operation, drag_v4, &drag_text_argument, 1)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
    const auto actual = ReadV4Text(make_view_call(get_operation, drag_v4));
    if (get_operation != UINT64_C(0x0f8ba0968424c793)) assert(actual == value);
  }
  for (const auto operation : {
      UINT64_C(0xfcd67027b6621dc6), UINT64_C(0x35d0fd0eb2ae1765),
      UINT64_C(0x169c373e6d711454), UINT64_C(0xfa5e38715807ff60),
      UINT64_C(0xaf17c655c56b515b)}) {
    const auto result = invoke_view_call(make_view_call(operation, drag_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 2> drag_file_arguments{};
  for (auto& argument : drag_file_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  }
  drag_file_arguments[0].text_value = drag_file_path;
  drag_file_arguments[1].text_value = L"V4拖放文件.txt";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb090956da49162d9), drag_v4,
      drag_file_arguments.data(), drag_file_arguments.size())).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  const auto drag_names_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xda4a773478ad2262), drag_v4)).handle_value;
  const auto drag_paths_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x1080e5a054c63700), drag_v4)).handle_value;
  assert(LB_CEF3_ListGetSize(drag_names_v4) >= 1);
  assert(LB_CEF3_ListGetSize(drag_paths_v4) >= 1);
  LB_CEF3_ARGUMENT_V4 drag_writer_argument{};
  drag_writer_argument.struct_size = sizeof(drag_writer_argument);
  drag_writer_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  drag_writer_argument.handle_value = 0;
  const auto drag_size_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x194724097aa659bb), drag_v4, &drag_writer_argument, 1));
  assert(drag_size_v4.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  const auto drag_image_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xf24f914fad2e8596), drag_v4));
  assert(drag_image_v4.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(drag_image_v4.handle_value == 0);
  assert(!ReadV4Json(make_view_call(
      UINT64_C(0xae082012377f4c16), drag_v4)).empty());
  const auto drag_clone_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x21d5876b88bc31a7), drag_v4)).handle_value;
  assert(drag_clone_v4 != 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x3a7fc0bb90a02de7), drag_clone_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x7670c27c06d532b1), drag_clone_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  drag_file_arguments[0].text_value = nullptr;
  auto invalid_drag_path_call = make_view_call(
      UINT64_C(0xb090956da49162d9), drag_v4,
      drag_file_arguments.data(), drag_file_arguments.size());
  assert(LB_CEF3_InvokeV4(&invalid_drag_path_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_drag_create_call = make_view_call(
      UINT64_C(0x84f8d8d0b4e56169), drag_v4);
  assert(LB_CEF3_InvokeV4(&invalid_drag_create_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_HandleRelease(drag_clone_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_paths_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_names_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_v4) == LB_CEF3_OK);
  assert(LB_CEF3_DragDataIsLink(drag_v4) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(drag_clone) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_file_paths) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_file_names) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(drag_data) == LB_CEF3_OK);
  assert(LB_CEF3_DragDataIsLink(drag_data) == LB_CEF3_ERROR_RELEASED_HANDLE);

  const char xml_source[] =
      "<root xmlns:p=\"urn:test\" xml:lang=\"zh\" a=\"1\" p:b=\"2\">"
      "<child>text</child><empty/></root>";
  const auto xml_buffer = LB_CEF3_BufferCreate(xml_source, sizeof(xml_source) - 1);
  assert(xml_buffer != 0);
  const auto xml_stream = LB_CEF3_StreamReaderCreateForBuffer(xml_buffer);
  assert(xml_stream != 0);
  LB_CEF3_HANDLE xml_reader = 0;
  assert(LB_CEF3_XmlReaderCreate(
      xml_stream, LB_CEF3_XML_ENCODING_UTF8, L"https://example.test/doc.xml",
      &xml_reader) == LB_CEF3_OK);
  assert(xml_reader != 0);
  assert(LB_CEF3_HandleGetType(xml_reader) == LB_CEF3_HANDLE_XML_READER);
  assert(LB_CEF3_XmlReaderHasError(xml_reader) == 0);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetError).empty());
  assert(LB_CEF3_XmlReaderMoveToNextNode(xml_reader) == 1);
  int32_t xml_type = -1;
  int32_t xml_depth = -1;
  int32_t xml_line = -1;
  assert(LB_CEF3_XmlReaderGetType(xml_reader, &xml_type) == LB_CEF3_OK);
  assert(xml_type == LB_CEF3_XML_NODE_ELEMENT_START);
  assert(LB_CEF3_XmlReaderGetDepth(xml_reader, &xml_depth) == LB_CEF3_OK);
  assert(xml_depth == 0);
  assert(LB_CEF3_XmlReaderGetLineNumber(xml_reader, &xml_line) == LB_CEF3_OK);
  assert(xml_line >= 1);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetLocalName) == L"root");
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetPrefix).empty());
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetQualifiedName) == L"root");
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetNamespaceUri).empty());
  assert(!ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetBaseUri).empty());
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetXmlLang) == L"zh");
  assert(LB_CEF3_XmlReaderIsEmptyElement(xml_reader) == 0);
  assert(LB_CEF3_XmlReaderHasValue(xml_reader) == 0);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetValue).empty());
  assert(LB_CEF3_XmlReaderHasAttributes(xml_reader) == 1);
  uint64_t xml_attribute_count = 0;
  assert(LB_CEF3_XmlReaderGetAttributeCount(xml_reader, &xml_attribute_count)
      == LB_CEF3_OK);
  assert(xml_attribute_count >= 2);
  auto read_xml_attribute = [&](auto read) {
    size_t xml_required = 0;
    assert(read(nullptr, 0, &xml_required) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
    std::vector<wchar_t> value(xml_required, L'\0');
    assert(read(value.data(), value.size(), &xml_required) == LB_CEF3_OK);
    return std::wstring(value.data());
  };
  assert(!read_xml_attribute([&](wchar_t* value, size_t capacity, size_t* needed) {
    return LB_CEF3_XmlReaderGetAttributeByIndex(
        xml_reader, 0, value, capacity, needed);
  }).empty());
  assert(read_xml_attribute([&](wchar_t* value, size_t capacity, size_t* needed) {
    return LB_CEF3_XmlReaderGetAttributeByQualifiedName(
        xml_reader, L"a", value, capacity, needed);
  }) == L"1");
  assert(read_xml_attribute([&](wchar_t* value, size_t capacity, size_t* needed) {
    return LB_CEF3_XmlReaderGetAttributeByLocalName(
        xml_reader, L"b", L"urn:test", value, capacity, needed);
  }) == L"2");
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetInnerXml).find(L"child")
      != std::wstring::npos);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetOuterXml).find(L"root")
      != std::wstring::npos);
  assert(LB_CEF3_XmlReaderMoveToAttributeByIndex(xml_reader, 0) == 1);
  assert(LB_CEF3_XmlReaderGetType(xml_reader, &xml_type) == LB_CEF3_OK);
  assert(xml_type == LB_CEF3_XML_NODE_ATTRIBUTE);
  assert(LB_CEF3_XmlReaderMoveToCarryingElement(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderMoveToAttributeByQualifiedName(xml_reader, L"a") == 1);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetValue) == L"1");
  assert(LB_CEF3_XmlReaderMoveToCarryingElement(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderMoveToAttributeByLocalName(
      xml_reader, L"b", L"urn:test") == 1);
  assert(ReadManagedText(xml_reader, LB_CEF3_XmlReaderGetValue) == L"2");
  assert(LB_CEF3_XmlReaderMoveToCarryingElement(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderMoveToFirstAttribute(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderMoveToNextAttribute(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderMoveToCarryingElement(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderGetAttributeByIndex(
      xml_reader, -1, nullptr, 0, &required) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_XmlReaderMoveToAttributeByQualifiedName(xml_reader, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_XmlReaderGetType(panel_view, &xml_type)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  std::atomic<int> xml_wrong_thread_call{0};
  std::atomic<int> xml_wrong_thread_release{0};
  std::thread xml_wrong_thread([&]() {
    xml_wrong_thread_call.store(LB_CEF3_XmlReaderHasError(xml_reader));
    xml_wrong_thread_release.store(LB_CEF3_HandleRelease(xml_reader));
  });
  xml_wrong_thread.join();
  assert(xml_wrong_thread_call.load() == LB_CEF3_ERROR_WRONG_THREAD);
  assert(xml_wrong_thread_release.load() == LB_CEF3_ERROR_WRONG_THREAD);
  assert(LB_CEF3_XmlReaderHasError(xml_reader) == 0);

  const auto xml_buffer_v4 = LB_CEF3_BufferCreate(xml_source, sizeof(xml_source) - 1);
  const auto xml_stream_v4 = LB_CEF3_StreamReaderCreateForBuffer(xml_buffer_v4);
  assert(xml_buffer_v4 != 0 && xml_stream_v4 != 0);
  std::array<LB_CEF3_ARGUMENT_V4, 3> xml_create_arguments{};
  xml_create_arguments[0].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  xml_create_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  xml_create_arguments[0].handle_value = xml_stream_v4;
  xml_create_arguments[1].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  xml_create_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  xml_create_arguments[1].integer_value = LB_CEF3_XML_ENCODING_UTF8;
  xml_create_arguments[2].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  xml_create_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
  xml_create_arguments[2].text_value = L"https://example.test/v4.xml";
  const auto xml_reader_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xb63b14e141c6d456), 0,
      xml_create_arguments.data(), xml_create_arguments.size())).handle_value;
  assert(xml_reader_v4 != 0);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x883ff763e2f057ae), xml_reader_v4));
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 0);
  }
  assert(ReadV4Text(make_view_call(
      UINT64_C(0x9b2fe49df2ae924a), xml_reader_v4)).empty());
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4f0344edaf1948c8), xml_reader_v4)).integer_value == 1);
  for (const auto operation : {
      UINT64_C(0x22a86514269655fa), UINT64_C(0xc6518a096c530f1d),
      UINT64_C(0x9c3cb67ec13ca91c), UINT64_C(0x2a3f0e0d22c4855f)}) {
    assert(invoke_view_call(make_view_call(operation, xml_reader_v4)).value_kind
        == LB_CEF3_VALUE_V4_INTEGER);
  }
  for (const auto operation : {
      UINT64_C(0xa864a4586d2ae0b8), UINT64_C(0xcba2e3ecb31d6cbc),
      UINT64_C(0xf9f3df052fa3ae45), UINT64_C(0xe5a09a4be7038ae2),
      UINT64_C(0x88ffe45b1bb78dc0), UINT64_C(0x21e3c128955bbd42),
      UINT64_C(0x7350d2d745c94510), UINT64_C(0x636834bc50b9322f),
      UINT64_C(0x4a0926b883eccbf6)}) {
    (void)ReadV4Text(make_view_call(operation, xml_reader_v4));
  }
  for (const auto operation : {
      UINT64_C(0xd59dbe4be98a17b6), UINT64_C(0xcca93a20153cecaf),
      UINT64_C(0xd4bb24d69013edba)}) {
    assert(invoke_view_call(make_view_call(operation, xml_reader_v4)).value_kind
        == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 2> xml_attribute_arguments{};
  xml_attribute_arguments[0].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  xml_attribute_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  xml_attribute_arguments[0].integer_value = 0;
  (void)ReadV4Text(make_view_call(
      UINT64_C(0x80ba18ef45cb47ba), xml_reader_v4,
      xml_attribute_arguments.data(), 1));
  xml_attribute_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  xml_attribute_arguments[0].text_value = L"a";
  assert(ReadV4Text(make_view_call(
      UINT64_C(0xff6a6486e7188cb5), xml_reader_v4,
      xml_attribute_arguments.data(), 1)) == L"1");
  xml_attribute_arguments[0].text_value = L"b";
  xml_attribute_arguments[1].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  xml_attribute_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  xml_attribute_arguments[1].text_value = L"urn:test";
  assert(ReadV4Text(make_view_call(
      UINT64_C(0x4b17b75fa1e75f08), xml_reader_v4,
      xml_attribute_arguments.data(), 2)) == L"2");
  xml_attribute_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  xml_attribute_arguments[0].integer_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x5218aaf43debc434), xml_reader_v4,
      xml_attribute_arguments.data(), 1)).value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8707d1c7a1d8b8ce), xml_reader_v4)).integer_value == 1);
  xml_attribute_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  xml_attribute_arguments[0].text_value = L"a";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xae8f57d9d954ab23), xml_reader_v4,
      xml_attribute_arguments.data(), 1)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8707d1c7a1d8b8ce), xml_reader_v4)).integer_value == 1);
  xml_attribute_arguments[0].text_value = L"b";
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x36fa6ffd0082bf7a), xml_reader_v4,
      xml_attribute_arguments.data(), 2)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8707d1c7a1d8b8ce), xml_reader_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x96ec9bd08132d63c), xml_reader_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x40cf838e4e400b3f), xml_reader_v4)).value_kind
      == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8707d1c7a1d8b8ce), xml_reader_v4)).integer_value == 1);
  xml_attribute_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  xml_attribute_arguments[0].integer_value = -1;
  auto invalid_xml_index_call = make_view_call(
      UINT64_C(0x5218aaf43debc434), xml_reader_v4,
      xml_attribute_arguments.data(), 1);
  assert(LB_CEF3_InvokeV4(&invalid_xml_index_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  xml_create_arguments[1].integer_value = 999;
  auto invalid_xml_create_call = make_view_call(
      UINT64_C(0xb63b14e141c6d456), 0,
      xml_create_arguments.data(), xml_create_arguments.size());
  assert(LB_CEF3_InvokeV4(&invalid_xml_create_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x0d4ce583bbdf4333), xml_reader_v4)).integer_value == 1);
  assert(LB_CEF3_XmlReaderHasError(xml_reader_v4)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_HandleRelease(xml_reader_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(xml_stream_v4) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(xml_buffer_v4) == LB_CEF3_OK);

  assert(LB_CEF3_XmlReaderClose(xml_reader) == 1);
  assert(LB_CEF3_XmlReaderHasError(xml_reader) == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_HandleRelease(xml_reader) == LB_CEF3_OK);
  assert(LB_CEF3_XmlReaderHasError(xml_reader) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(xml_stream) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(xml_buffer) == LB_CEF3_OK);

  const wchar_t* zip_reader_fixture =
      L"UEsDBBQAAAAIAGQkCF2pMMX+CQAAAAcAAAAJAAAAZW50cnkudHh0S87PK0nNKwEA"
      L"UEsBAhQAFAAAAAgAZCQIXakwxf4JAAAABwAAAAkAAAAAAAAAAAAAAAAAAAAAAGVu"
      L"dHJ5LnR4dFBLBQYAAAAAAQABADcAAAAwAAAAAAA=";
  const auto zip_fixture_buffer = LB_CEF3_Base64Decode(zip_reader_fixture);
  assert(zip_fixture_buffer != 0);
  const auto zip_stream = LB_CEF3_StreamReaderCreateForBuffer(zip_fixture_buffer);
  assert(zip_stream != 0);
  LB_CEF3_HANDLE zip_reader = 0;
  assert(LB_CEF3_ZipReaderCreate(zip_stream, &zip_reader) == LB_CEF3_OK);
  assert(zip_reader != 0);
  assert(LB_CEF3_HandleGetType(zip_reader) == LB_CEF3_HANDLE_ZIP_READER);
  assert(LB_CEF3_ZipReaderMoveToFirstFile(zip_reader) == 1);
  const auto zip_entry_name = ReadManagedText(zip_reader, LB_CEF3_ZipReaderGetFileName);
  assert(zip_entry_name.find(L"entry.txt") != std::wstring::npos);
  int64_t zip_file_size = -1;
  int64_t zip_modified = -1;
  assert(LB_CEF3_ZipReaderGetFileSize(zip_reader, &zip_file_size) == LB_CEF3_OK);
  assert(zip_file_size == 7);
  assert(LB_CEF3_ZipReaderGetFileLastModified(zip_reader, &zip_modified)
      == LB_CEF3_OK);
  assert(zip_modified >= 0);
  assert(LB_CEF3_ZipReaderMoveToFile(zip_reader, zip_entry_name.c_str(), 1) == 1);
  assert(LB_CEF3_ZipReaderOpenFile(zip_reader, nullptr) == 1);
  int64_t zip_offset = -1;
  assert(LB_CEF3_ZipReaderTell(zip_reader, &zip_offset) == LB_CEF3_OK);
  assert(zip_offset == 0);
  LB_CEF3_BUFFER_HANDLE zip_read_buffer = 0;
  int32_t zip_read_result = -99;
  assert(LB_CEF3_ZipReaderReadFile(
      zip_reader, 4, &zip_read_buffer, &zip_read_result) == LB_CEF3_OK);
  assert(zip_read_result == 4 && zip_read_buffer != 0);
  std::array<char, 4> zip_first_bytes{};
  assert(LB_CEF3_BufferCopy(
      zip_read_buffer, zip_first_bytes.data(), zip_first_bytes.size(), &required)
      == LB_CEF3_OK);
  assert(std::string(zip_first_bytes.data(), zip_first_bytes.size()) == "cont");
  assert(LB_CEF3_BufferRelease(zip_read_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_ZipReaderTell(zip_reader, &zip_offset) == LB_CEF3_OK);
  assert(zip_offset == 4);
  assert(LB_CEF3_ZipReaderEof(zip_reader) == 0);
  assert(LB_CEF3_ZipReaderReadFile(
      zip_reader, 64, &zip_read_buffer, &zip_read_result) == LB_CEF3_OK);
  assert(zip_read_result == 3 && zip_read_buffer != 0);
  assert(LB_CEF3_BufferRelease(zip_read_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_ZipReaderReadFile(
      zip_reader, 64, &zip_read_buffer, &zip_read_result) == LB_CEF3_OK);
  assert(zip_read_result == 0 && zip_read_buffer == 0);
  assert(LB_CEF3_ZipReaderEof(zip_reader) == 1);
  assert(LB_CEF3_ZipReaderCloseFile(zip_reader) == 1);
  assert(LB_CEF3_ZipReaderMoveToNextFile(zip_reader) == 0);
  assert(LB_CEF3_ZipReaderMoveToFile(zip_reader, nullptr, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ZipReaderMoveToFile(zip_reader, zip_entry_name.c_str(), 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ZipReaderGetFileSize(panel_view, &zip_file_size)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  std::atomic<int> zip_wrong_thread_call{0};
  std::atomic<int> zip_wrong_thread_release{0};
  std::thread zip_wrong_thread([&]() {
    zip_wrong_thread_call.store(LB_CEF3_ZipReaderEof(zip_reader));
    zip_wrong_thread_release.store(LB_CEF3_HandleRelease(zip_reader));
  });
  zip_wrong_thread.join();
  assert(zip_wrong_thread_call.load() == LB_CEF3_ERROR_WRONG_THREAD);
  assert(zip_wrong_thread_release.load() == LB_CEF3_ERROR_WRONG_THREAD);

  const auto zip_fixture_buffer_v4 = LB_CEF3_Base64Decode(zip_reader_fixture);
  const auto zip_stream_v4 = LB_CEF3_StreamReaderCreateForBuffer(zip_fixture_buffer_v4);
  assert(zip_fixture_buffer_v4 != 0 && zip_stream_v4 != 0);
  LB_CEF3_ARGUMENT_V4 zip_create_argument{};
  zip_create_argument.struct_size = sizeof(zip_create_argument);
  zip_create_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  zip_create_argument.handle_value = zip_stream_v4;
  const auto zip_reader_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xab656cc6ef48ac77), 0, &zip_create_argument, 1)).handle_value;
  assert(zip_reader_v4 != 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x119c1eb0ac7ea8bc), zip_reader_v4)).integer_value == 1);
  const auto zip_entry_name_v4 = ReadV4Text(make_view_call(
      UINT64_C(0x284f3ca20e416d80), zip_reader_v4));
  assert(zip_entry_name_v4.find(L"entry.txt") != std::wstring::npos);
  for (const auto operation : {
      UINT64_C(0xb95a5c755cef6ec5), UINT64_C(0x673badba88bdaf06)}) {
    assert(invoke_view_call(make_view_call(operation, zip_reader_v4)).value_kind
        == LB_CEF3_VALUE_V4_INTEGER);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 2> zip_move_arguments{};
  zip_move_arguments[0].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  zip_move_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  zip_move_arguments[0].text_value = zip_entry_name_v4.c_str();
  zip_move_arguments[1].struct_size = sizeof(LB_CEF3_ARGUMENT_V4);
  zip_move_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  zip_move_arguments[1].integer_value = 1;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xf6aff94bfacfab05), zip_reader_v4,
      zip_move_arguments.data(), 2)).integer_value == 1);
  LB_CEF3_ARGUMENT_V4 zip_password_argument{};
  zip_password_argument.struct_size = sizeof(zip_password_argument);
  zip_password_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  zip_password_argument.text_value = nullptr;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x44cd1f104f8779b1), zip_reader_v4,
      &zip_password_argument, 1)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x5768e0d648e806d6), zip_reader_v4)).integer_value == 0);
  LB_CEF3_ARGUMENT_V4 zip_read_argument{};
  zip_read_argument.struct_size = sizeof(zip_read_argument);
  zip_read_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  zip_read_argument.integer_value = 64;
  auto zip_read_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xc528ab2da5f10be4), zip_reader_v4,
      &zip_read_argument, 1));
  assert(zip_read_v4.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(zip_read_v4.integer_value == 7 && zip_read_v4.buffer_value != 0);
  assert(LB_CEF3_BufferRelease(zip_read_v4.buffer_value) == LB_CEF3_OK);
  zip_read_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xc528ab2da5f10be4), zip_reader_v4,
      &zip_read_argument, 1));
  assert(zip_read_v4.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(zip_read_v4.integer_value == 0 && zip_read_v4.buffer_value == 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x0b64d5122570c7ec), zip_reader_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x30f702a5aa58fdda), zip_reader_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x3258fbd08d789ff9), zip_reader_v4)).integer_value == 0);
  zip_move_arguments[1].integer_value = 2;
  auto invalid_zip_boolean_call = make_view_call(
      UINT64_C(0xf6aff94bfacfab05), zip_reader_v4,
      zip_move_arguments.data(), 2);
  assert(LB_CEF3_InvokeV4(&invalid_zip_boolean_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xcbcf654f52a21d17), zip_reader_v4)).integer_value == 1);
  assert(LB_CEF3_ZipReaderEof(zip_reader_v4) == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_HandleRelease(zip_reader_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(zip_stream_v4) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(zip_fixture_buffer_v4) == LB_CEF3_OK);

  assert(LB_CEF3_ZipReaderClose(zip_reader) == 1);
  assert(LB_CEF3_ZipReaderEof(zip_reader) == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_HandleRelease(zip_reader) == LB_CEF3_OK);
  assert(LB_CEF3_ZipReaderEof(zip_reader) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(zip_stream) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(zip_fixture_buffer) == LB_CEF3_OK);

  LB_CEF3_HANDLE button_delegate = 0;
  assert(LB_CEF3_ButtonDelegateCreate(&button_delegate) == LB_CEF3_OK);
  assert(button_delegate != 0);
  assert(LB_CEF3_HandleGetType(button_delegate)
      == LB_CEF3_HANDLE_VIEW_DELEGATE);
  assert(LB_CEF3_ButtonDelegateSubscribePressed(
             button_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonDelegateSubscribeStateChanged(
             button_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonDelegateSubscribePressed(
             button_delegate, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ButtonDelegateSubscribePressed(
             panel_view, 1) == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE delegated_button = 0;
  assert(LB_CEF3_LabelButtonCreateWithDelegate(
             L"受管委托按钮", button_delegate, &delegated_button)
      == LB_CEF3_OK);
  assert(delegated_button != 0);
  const int button_state_events_before = g_v4_button_state_events.load();
  assert(LB_CEF3_ButtonSetState(delegated_button, 1) == LB_CEF3_OK);
  assert(g_v4_button_state_events.load() >= button_state_events_before);

  control_delegate_boolean.integer_value = 1;
  for (const auto operation_id : {
      UINT64_C(0x4a965e1b2e8b038e),
      UINT64_C(0x622de69f8e720453)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, button_delegate,
        &control_delegate_boolean, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }

  LB_CEF3_HANDLE menu_button_delegate = 0;
  assert(LB_CEF3_MenuButtonDelegateCreate(&menu_button_delegate)
      == LB_CEF3_OK);
  assert(menu_button_delegate != 0);
  assert(LB_CEF3_MenuButtonDelegateSubscribePressed(
             menu_button_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonDelegateSubscribePressed(
             menu_button_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonDelegateSubscribeStateChanged(
             menu_button_delegate, 1) == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc9ff527eddb31aea), menu_button_delegate,
      &control_delegate_boolean, 1)).value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_HANDLE menu_button = 0;
  assert(LB_CEF3_MenuButtonCreate(
             menu_button_delegate, L"菜单按钮", &menu_button) == LB_CEF3_OK);
  assert(menu_button != 0);
  LB_CEF3_HANDLE managed_menu_button_conversion = 0;
  assert(LB_CEF3_LabelButtonAsMenuButton(
             menu_button, &managed_menu_button_conversion) == LB_CEF3_OK);
  assert(managed_menu_button_conversion != 0);
  assert(LB_CEF3_ViewIsSame(menu_button, managed_menu_button_conversion) == 1);
  LB_CEF3_HANDLE menu_button_window = 0;
  assert(LB_CEF3_WindowCreateTopLevel(0, &menu_button_window) == LB_CEF3_OK);
  assert(menu_button_window != 0);
  assert(LB_CEF3_PanelAddChildView(menu_button_window, menu_button)
      == LB_CEF3_OK);
  assert(LB_CEF3_WindowShow(menu_button_window) == LB_CEF3_OK);
  const auto menu_button_menu = LB_CEF3_MenuCreate();
  assert(menu_button_menu != 0);
  LB_CEF3_POINT_V3 menu_button_point{
      sizeof(menu_button_point), LB_CEF3_ABI_VERSION_V3, 0, 0};
  assert(LB_CEF3_MenuButtonShowMenu(
             menu_button, menu_button_menu, &menu_button_point, 0)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  g_menu_button_test_menu.store(menu_button_menu);
  g_menu_button_show_v4.store(false);
  g_menu_button_show_status.store(LB_CEF3_ERROR_NOT_FOUND);
  const int menu_pressed_before = g_v4_menu_button_pressed_events.load();
  const int menu_trigger_status = LB_CEF3_MenuButtonTriggerMenu(menu_button);
  assert(menu_trigger_status == LB_CEF3_OK);
  assert(g_v4_menu_button_pressed_events.load() > menu_pressed_before);
  assert(g_menu_button_show_status.load() == LB_CEF3_OK);
  LB_CEF3_HANDLE invalid_menu_button = UINT64_C(0x1234);
  assert(LB_CEF3_MenuButtonCreate(
             button_delegate, L"错误委托", &invalid_menu_button)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_menu_button == 0);
  assert(LB_CEF3_MenuButtonShowMenu(
             menu_button, menu_button_menu, nullptr, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MenuButtonTriggerMenu(delegated_button)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  std::array<LB_CEF3_ARGUMENT_V4, 2> menu_create_arguments{};
  menu_create_arguments[0].struct_size = sizeof(menu_create_arguments[0]);
  menu_create_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  menu_create_arguments[0].handle_value = menu_button_delegate;
  menu_create_arguments[1].struct_size = sizeof(menu_create_arguments[1]);
  menu_create_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  menu_create_arguments[1].text_value = L"V4菜单按钮";
  const auto menu_button_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0xe8daa4631879f68c), 0,
      menu_create_arguments.data(), menu_create_arguments.size()));
  assert(menu_button_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto menu_button_v4 = menu_button_v4_result.handle_value;
  assert(menu_button_v4 != 0);
  assert(LB_CEF3_PanelAddChildView(menu_button_window, menu_button_v4)
      == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 4> menu_show_arguments{};
  for (auto& argument : menu_show_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  }
  menu_show_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  menu_show_arguments[0].handle_value = menu_button_menu;
  menu_show_arguments[1].integer_value = 0;
  menu_show_arguments[2].integer_value = 0;
  menu_show_arguments[3].integer_value = 0;
  auto outside_menu_show_call = make_view_call(
      UINT64_C(0x2a10d34972afda2d), menu_button_v4,
      menu_show_arguments.data(), menu_show_arguments.size());
  assert(LB_CEF3_InvokeV4(
             &outside_menu_show_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  g_menu_button_show_v4.store(true);
  g_menu_button_show_status.store(LB_CEF3_ERROR_NOT_FOUND);
  const int menu_v4_pressed_before = g_v4_menu_button_pressed_events.load();
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xdfb8578c79a27362), menu_button_v4)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(g_v4_menu_button_pressed_events.load() > menu_v4_pressed_before);
  assert(g_menu_button_show_status.load() == LB_CEF3_OK);
  auto invalid_menu_create_call = make_view_call(
      UINT64_C(0xe8daa4631879f68c), menu_button,
      menu_create_arguments.data(), menu_create_arguments.size());
  assert(LB_CEF3_InvokeV4(&invalid_menu_create_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  control_delegate_boolean.integer_value = 2;
  auto invalid_button_delegate_call = make_view_call(
      UINT64_C(0x4a965e1b2e8b038e), button_delegate,
      &control_delegate_boolean, 1);
  assert(LB_CEF3_InvokeV4(
             &invalid_button_delegate_call, &invalid_view_v4_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  control_delegate_boolean.integer_value = 1;
  g_menu_button_test_menu.store(0);
  g_menu_button_show_v4.store(false);
  assert(LB_CEF3_WindowCancelMenu(menu_button_window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowClose(menu_button_window) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(menu_button_v4) == LB_CEF3_OK);
  assert(LB_CEF3_MenuRelease(menu_button_menu) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(managed_menu_button_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(menu_button) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(menu_button_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(delegated_button) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(button_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(menu_button_window) == LB_CEF3_OK);

  LB_CEF3_HANDLE label_button = 0;
  assert(LB_CEF3_LabelButtonCreate(L"测试按钮", &label_button) == LB_CEF3_OK);
  assert(label_button != 0 && LB_CEF3_HandleGetType(label_button) == LB_CEF3_HANDLE_VIEW);
  assert(ReadManagedText(label_button, LB_CEF3_LabelButtonGetText) == L"测试按钮");
  LB_CEF3_HANDLE label_conversion = 0;
  assert(LB_CEF3_ButtonAsLabelButton(label_button, &label_conversion) == LB_CEF3_OK);
  assert(label_conversion != 0 && LB_CEF3_ViewIsSame(label_button, label_conversion) == 1);
  LB_CEF3_HANDLE menu_button_conversion = UINT64_C(0x1234);
  assert(LB_CEF3_LabelButtonAsMenuButton(label_button, &menu_button_conversion) == LB_CEF3_OK);
  assert(menu_button_conversion == 0);
  int32_t label_button_state = -1;
  assert(LB_CEF3_ButtonGetState(label_button, &label_button_state) == LB_CEF3_OK);
  assert(label_button_state == 0);
  assert(LB_CEF3_ButtonSetState(label_button, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonGetState(label_button, &label_button_state) == LB_CEF3_OK);
  assert(label_button_state == 1);
  assert(LB_CEF3_ButtonSetInkDropEnabled(label_button, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonSetTooltipText(label_button, L"按钮提示") == LB_CEF3_OK);
  assert(LB_CEF3_ButtonSetAccessibleName(label_button, L"可访问按钮") == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetText(label_button, L"替换文本") == LB_CEF3_OK);
  assert(ReadManagedText(label_button, LB_CEF3_LabelButtonGetText) == L"替换文本");
  assert(LB_CEF3_LabelButtonSetFontList(label_button, L"Arial, 14px") == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetHorizontalAlignment(label_button, 0) == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetTextColor(
      label_button, 0, UINT32_C(0xff102030)) == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetEnabledTextColors(
      label_button, UINT32_C(0xff405060)) == LB_CEF3_OK);
  LB_CEF3_SIZE_V3 label_minimum{
      sizeof(label_minimum), LB_CEF3_ABI_VERSION_V3, 70, 28};
  LB_CEF3_SIZE_V3 label_maximum{
      sizeof(label_maximum), LB_CEF3_ABI_VERSION_V3, 240, 80};
  assert(LB_CEF3_LabelButtonSetMinimumSize(label_button, &label_minimum) == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetMaximumSize(label_button, &label_maximum) == LB_CEF3_OK);
  const auto label_button_image = LB_CEF3_ImageCreate();
  assert(label_button_image != 0);
  assert(LB_CEF3_LabelButtonSetImage(label_button, 0, label_button_image) == LB_CEF3_OK);
  LB_CEF3_HANDLE label_returned_image = 0;
  assert(LB_CEF3_LabelButtonGetImage(label_button, 0, &label_returned_image) == LB_CEF3_OK);
  if (label_returned_image != 0) assert(LB_CEF3_ImageRelease(label_returned_image) == LB_CEF3_OK);
  assert(LB_CEF3_LabelButtonSetImage(label_button, 0, 0) == LB_CEF3_OK);
  assert(LB_CEF3_ButtonSetState(label_button, 99) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ButtonSetInkDropEnabled(label_button, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_LabelButtonSetHorizontalAlignment(label_button, 99)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ButtonGetState(panel_view, &label_button_state) == LB_CEF3_ERROR_HANDLE_TYPE);

  LB_CEF3_HANDLE label_delegate = 0;
  assert(LB_CEF3_ViewGetDelegate(label_button, &label_delegate) == LB_CEF3_OK);
  assert(label_delegate != 0);
  assert(LB_CEF3_HandleGetType(label_delegate) == LB_CEF3_HANDLE_VIEW_DELEGATE);
  LB_CEF3_SIZE_V3 delegate_preferred{
      sizeof(delegate_preferred), LB_CEF3_ABI_VERSION_V3};
  LB_CEF3_SIZE_V3 delegate_minimum{
      sizeof(delegate_minimum), LB_CEF3_ABI_VERSION_V3};
  LB_CEF3_SIZE_V3 delegate_maximum{
      sizeof(delegate_maximum), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_ViewDelegateGetPreferredSize(
             label_delegate, label_button, &delegate_preferred) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateGetMinimumSize(
             label_delegate, label_button, &delegate_minimum) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateGetMaximumSize(
             label_delegate, label_button, &delegate_maximum) == LB_CEF3_OK);
  assert(delegate_preferred.width == 0 && delegate_preferred.height == 0);
  assert(delegate_minimum.width == 0 && delegate_minimum.height == 0);
  assert(delegate_maximum.width == 0 && delegate_maximum.height == 0);
  int32_t delegate_height = -1;
  assert(LB_CEF3_ViewDelegateGetHeightForWidth(
             label_delegate, label_button, 200, &delegate_height) == LB_CEF3_OK);
  assert(delegate_height == 0);
  assert(LB_CEF3_ViewDelegateGetHeightForWidth(
             label_delegate, label_button, -1, &delegate_height)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ViewDelegateOnParentViewChanged(
             label_delegate, label_button, 1, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnParentViewChanged(
             label_delegate, label_button, 0, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnChildViewChanged(
             label_delegate, label_button, 1, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnChildViewChanged(
             label_delegate, label_button, 0, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnWindowChanged(label_delegate, label_button, 1) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnWindowChanged(label_delegate, label_button, 0) == LB_CEF3_OK);
  LB_CEF3_RECT_V3 delegate_bounds{
      sizeof(delegate_bounds), LB_CEF3_ABI_VERSION_V3, 4, 5, 200, 30};
  assert(LB_CEF3_ViewDelegateOnLayoutChanged(
             label_delegate, label_button, &delegate_bounds) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnFocus(label_delegate, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnBlur(label_delegate, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnThemeChanged(label_delegate, label_button) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnWindowChanged(label_button, label_button, 1)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  LB_CEF3_ARGUMENT_V4 label_create_argument{};
  label_create_argument.struct_size = sizeof(label_create_argument);
  label_create_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  label_create_argument.text_value = L"V4按钮";
  const auto label_button_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x5841749107fabb6e), 0, &label_create_argument, 1)).handle_value;
  assert(label_button_v4 != 0);
  auto make_label_argument = [](uint32_t kind, int64_t integer_value = 0,
                                LB_CEF3_HANDLE handle_value = 0,
                                const wchar_t* text_value = nullptr) {
    LB_CEF3_ARGUMENT_V4 argument{};
    argument.struct_size = sizeof(argument);
    argument.value_kind = kind;
    argument.integer_value = integer_value;
    argument.handle_value = handle_value;
    argument.text_value = text_value;
    return argument;
  };
  auto label_delegate_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0x01a3d70622dd2e59), label_button_v4));
  assert(label_delegate_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto label_delegate_v4 = label_delegate_v4_result.handle_value;
  assert(label_delegate_v4 != 0);
  assert(LB_CEF3_HandleGetType(label_delegate_v4) == LB_CEF3_HANDLE_VIEW_DELEGATE);
  auto label_view_argument = make_label_argument(
      LB_CEF3_VALUE_V4_HANDLE, 0, label_button_v4);
  for (const auto operation : {
      UINT64_C(0xff87e383721766e8), UINT64_C(0xa3e7b1306e30f045),
      UINT64_C(0xe0e41326a602e5af)}) {
    const auto size_json = ReadV4Json(make_view_call(
        operation, label_delegate_v4, &label_view_argument, 1));
    assert(size_json.find(L"\"width\"") != std::wstring::npos);
    assert(size_json.find(L"\"height\"") != std::wstring::npos);
  }
  auto label_width_argument = make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 200);
  std::array<LB_CEF3_ARGUMENT_V4, 2> label_height_arguments{
      label_view_argument, label_width_argument};
  auto label_height_result = invoke_view_call(make_view_call(
      UINT64_C(0xcea13bc5ac1c7a8f), label_delegate_v4,
      label_height_arguments.data(), label_height_arguments.size()));
  assert(label_height_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(label_height_result.integer_value == 0);
  label_width_argument.integer_value = -1;
  label_height_arguments[1] = label_width_argument;
  auto invalid_label_height_call = make_view_call(
      UINT64_C(0xcea13bc5ac1c7a8f), label_delegate_v4,
      label_height_arguments.data(), label_height_arguments.size());
  assert(LB_CEF3_InvokeV4(
             &invalid_label_height_call, &label_height_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto label_added_argument = make_label_argument(LB_CEF3_VALUE_V4_BOOLEAN, 1);
  std::array<LB_CEF3_ARGUMENT_V4, 3> label_parent_arguments{
      label_view_argument, label_added_argument, label_view_argument};
  for (const auto operation : {
      UINT64_C(0x01911cc1d11100d7), UINT64_C(0x59f124ceef7e6716)}) {
    assert(invoke_view_call(make_view_call(
        operation, label_delegate_v4, label_parent_arguments.data(),
        label_parent_arguments.size())).status == LB_CEF3_OK);
  }
  auto label_window_arguments = std::array<LB_CEF3_ARGUMENT_V4, 2>{
      label_view_argument, label_added_argument};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4ed2472047a526d2), label_delegate_v4,
      label_window_arguments.data(), label_window_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 5> label_layout_arguments{
      label_view_argument,
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 4),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 5),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 200),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 30)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb0feb1c16a23751f), label_delegate_v4,
      label_layout_arguments.data(), label_layout_arguments.size())).status == LB_CEF3_OK);
  for (const auto operation : {
      UINT64_C(0x6b0a0ccf33ef37c6), UINT64_C(0x004597ee02fa9c22),
      UINT64_C(0xb2469c055bb2cf99)}) {
    assert(invoke_view_call(make_view_call(
        operation, label_delegate_v4, &label_view_argument, 1)).status == LB_CEF3_OK);
  }
  label_window_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  auto invalid_label_window_call = make_view_call(
      UINT64_C(0x4ed2472047a526d2), label_delegate_v4,
      label_window_arguments.data(), label_window_arguments.size());
  LB_CEF3_RESULT_V4 invalid_label_window_result{};
  invalid_label_window_result.struct_size = sizeof(invalid_label_window_result);
  assert(LB_CEF3_InvokeV4(&invalid_label_window_call, &invalid_label_window_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_HandleRelease(label_delegate_v4) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnFocus(label_delegate_v4, label_button_v4)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  auto label_text_argument = make_label_argument(
      LB_CEF3_VALUE_V4_TEXT, 0, 0, L"V4替换按钮");
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x355e107cb966db81), label_button_v4,
      &label_text_argument, 1)).status == LB_CEF3_OK);
  assert(ReadV4Text(make_view_call(
      UINT64_C(0x6addf1a49daaf6be), label_button_v4)) == L"V4替换按钮");
  auto label_handle_result = invoke_view_call(make_view_call(
      UINT64_C(0xb996161e34db7609), label_button_v4));
  assert(label_handle_result.handle_value != 0);
  assert(LB_CEF3_HandleRelease(label_handle_result.handle_value) == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x62c9bf4841c28feb), label_button_v4)).handle_value == 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x747445bca1f461ac), label_button_v4)).value_kind
      == LB_CEF3_VALUE_V4_INTEGER);
  auto label_state_argument = make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 2);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4f6baf04cd5c4bfd), label_button_v4,
      &label_state_argument, 1)).status == LB_CEF3_OK);
  auto label_bool_argument = make_label_argument(LB_CEF3_VALUE_V4_BOOLEAN, 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc71fca17f5618ee8), label_button_v4,
      &label_bool_argument, 1)).status == LB_CEF3_OK);
  for (const auto operation : {
      UINT64_C(0xe0c83306be8b7562), UINT64_C(0x539c0ead8a23c741)}) {
    assert(invoke_view_call(make_view_call(
        operation, label_button_v4, &label_text_argument, 1)).status == LB_CEF3_OK);
  }
  auto label_font_argument = make_label_argument(
      LB_CEF3_VALUE_V4_TEXT, 0, 0, L"Arial, 13px");
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x843bb334b1b09f6f), label_button_v4,
      &label_font_argument, 1)).status == LB_CEF3_OK);
  auto label_alignment_argument = make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 2);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x81f8b6352bb54a42), label_button_v4,
      &label_alignment_argument, 1)).status == LB_CEF3_OK);
  auto label_color_argument = make_label_argument(
      LB_CEF3_VALUE_V4_INTEGER, UINT32_C(0xff708090));
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xa33ff2459ee0c613), label_button_v4,
      &label_color_argument, 1)).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> label_state_color_arguments{
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 0),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, UINT32_C(0xff112233))};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc8e1312ab11c24c2), label_button_v4,
      label_state_color_arguments.data(), label_state_color_arguments.size())).status
      == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> label_image_arguments{
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 0),
      make_label_argument(LB_CEF3_VALUE_V4_HANDLE, 0, label_button_image)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x2afcb8c17d207ab2), label_button_v4,
      label_image_arguments.data(), label_image_arguments.size())).status == LB_CEF3_OK);
  label_handle_result = invoke_view_call(make_view_call(
      UINT64_C(0xd5f8a0760b03bd3b), label_button_v4,
      label_image_arguments.data(), 1));
  if (label_handle_result.handle_value != 0)
    assert(LB_CEF3_ImageRelease(label_handle_result.handle_value) == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> label_size_arguments{
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 80),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 30)};
  for (const auto operation : {
      UINT64_C(0x9918b6c91e2b4188), UINT64_C(0xc0aefbb098acefe3)}) {
    assert(invoke_view_call(make_view_call(
        operation, label_button_v4,
        label_size_arguments.data(), label_size_arguments.size())).status == LB_CEF3_OK);
  }
  assert(LB_CEF3_HandleRelease(label_button_v4) == LB_CEF3_OK);
  assert(LB_CEF3_ImageRelease(label_button_image) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(label_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_ViewDelegateOnFocus(label_delegate, label_button)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(label_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(label_button) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);

  LB_CEF3_HANDLE window = 0;
  assert(LB_CEF3_WindowCreateTopLevel(0, &window) == LB_CEF3_OK);
  assert(window != 0);
  assert(LB_CEF3_HandleGetType(window) == LB_CEF3_HANDLE_WINDOW);
  assert(LB_CEF3_ViewIsValid(window) == 1);
  LB_CEF3_HANDLE window_delegate = 0;
  assert(LB_CEF3_ViewGetDelegate(window, &window_delegate) == LB_CEF3_OK);
  assert(window_delegate != 0);
  assert(LB_CEF3_HandleGetType(window_delegate) == LB_CEF3_HANDLE_VIEW_DELEGATE);
  int32_t window_delegate_state = -1;
  assert(LB_CEF3_WindowDelegateAcceptsFirstMouse(
             window_delegate, window, &window_delegate_state) == LB_CEF3_OK);
  assert(window_delegate_state == 0);
  assert(LB_CEF3_WindowDelegateGetInitialShowState(
             window_delegate, window, &window_delegate_state) == LB_CEF3_OK);
  assert(window_delegate_state == 0);
  assert(LB_CEF3_WindowDelegateCanClose(window_delegate, window) == 1);
  assert(LB_CEF3_WindowDelegateCanMaximize(window_delegate, window) == 1);
  assert(LB_CEF3_WindowDelegateCanMinimize(window_delegate, window) == 1);
  assert(LB_CEF3_WindowDelegateCanResize(window_delegate, window) == 1);
  assert(LB_CEF3_WindowDelegateIsFrameless(window_delegate, window) == 0);
  assert(LB_CEF3_WindowDelegateIsWindowModalDialog(window_delegate, window) == 0);
  assert(LB_CEF3_WindowDelegateWithStandardWindowButtons(window_delegate, window) == 1);
  LB_CEF3_RECT_V3 initial_window_bounds{
      sizeof(initial_window_bounds), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_WindowDelegateGetInitialBounds(
             window_delegate, window, &initial_window_bounds) == LB_CEF3_OK);
  assert(initial_window_bounds.width == 0 && initial_window_bounds.height == 0);
  int32_t delegate_runtime_style = -1;
  assert(LB_CEF3_WindowDelegateGetWindowRuntimeStyle(
             window_delegate, &delegate_runtime_style) == LB_CEF3_OK);
  assert(delegate_runtime_style == 0);
  std::array<wchar_t, 512> linux_properties{};
  size_t linux_properties_required = 0;
  assert(LB_CEF3_WindowDelegateGetLinuxWindowProperties(
             window_delegate, window, nullptr, 0, &linux_properties_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(linux_properties_required > 1);
  assert(LB_CEF3_WindowDelegateGetLinuxWindowProperties(
             window_delegate, window, linux_properties.data(), linux_properties.size(),
             &linux_properties_required) == LB_CEF3_OK);
  assert(std::wstring(linux_properties.data()).find(L"\"handled\"") != std::wstring::npos);
  LB_CEF3_HANDLE parent_window = UINT64_C(0x1234);
  int is_menu = -1;
  int can_activate_menu = -1;
  assert(LB_CEF3_WindowDelegateGetParentWindow(
             window_delegate, window, &parent_window, &is_menu, &can_activate_menu)
      == LB_CEF3_OK);
  assert(parent_window == 0 && is_menu == 0 && can_activate_menu == 1);
  float titlebar_height = -1.0f;
  int titlebar_overridden = -1;
  assert(LB_CEF3_WindowDelegateGetTitlebarHeight(
             window_delegate, window, &titlebar_height, &titlebar_overridden)
      == LB_CEF3_OK);
  assert(titlebar_height == 0.0f && titlebar_overridden == 0);
  assert(LB_CEF3_WindowDelegateOnAccelerator(window_delegate, window, 901) == 0);
  LB_CEF3_KEY_EVENT_V3 delegate_key_event{
      sizeof(delegate_key_event), LB_CEF3_ABI_VERSION_V3,
      LB_CEF3_KEY_EVENT_RAW_KEY_DOWN, 0, VK_F12, VK_F12, 0, 0, 0, 0};
  assert(LB_CEF3_WindowDelegateOnKeyEvent(
             window_delegate, window, &delegate_key_event) == 0);
  assert(LB_CEF3_WindowDelegateOnThemeColorsChanged(window_delegate, window, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnWindowActivationChanged(window_delegate, window, 1)
      == LB_CEF3_OK);
  LB_CEF3_RECT_V3 delegate_window_bounds{
      sizeof(delegate_window_bounds), LB_CEF3_ABI_VERSION_V3, 1, 2, 400, 300};
  assert(LB_CEF3_WindowDelegateOnWindowBoundsChanged(
             window_delegate, window, &delegate_window_bounds) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnWindowClosing(window_delegate, window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnWindowCreated(window_delegate, window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnWindowDestroyed(window_delegate, window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnWindowFullscreenTransition(
             window_delegate, window, 1) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateOnThemeColorsChanged(window_delegate, window, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WindowDelegateOnKeyEvent(window_delegate, window, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WindowDelegateCanClose(panel_view, window)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  const auto window_delegate_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x01a3d70622dd2e59), window)).handle_value;
  assert(window_delegate_v4 != 0);
  auto window_argument = make_label_argument(
      LB_CEF3_VALUE_V4_HANDLE, 0, window);
  for (const auto operation : {
      UINT64_C(0xfc5df3e7058b8f85), UINT64_C(0x4de08d050c83d162),
      UINT64_C(0xfa2f65cb94867c26), UINT64_C(0x93654018c605f91b),
      UINT64_C(0x24fb3c3280ab0791), UINT64_C(0x5a1ff1b0ccdd4534),
      UINT64_C(0x2fd19f9205cee2d6), UINT64_C(0xa0eb12955139790a),
      UINT64_C(0x05967f57c81bc062)}) {
    const auto value = invoke_view_call(make_view_call(
        operation, window_delegate_v4, &window_argument, 1));
    assert(value.value_kind == LB_CEF3_VALUE_V4_INTEGER
        || value.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  assert(ReadV4Json(make_view_call(
      UINT64_C(0x079ed2ea8b4e6b0d), window_delegate_v4,
      &window_argument, 1)).find(L"\"width\"") != std::wstring::npos);
  assert(ReadV4Json(make_view_call(
      UINT64_C(0x3f004da3da427fed), window_delegate_v4,
      &window_argument, 1)).find(L"\"handled\"") != std::wstring::npos);
  auto window_parent_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xcb442f7f3c085a53), window_delegate_v4,
      &window_argument, 1));
  assert(window_parent_v4.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(window_parent_v4.handle_value == 0 && window_parent_v4.integer_value == 2);
  const auto window_titlebar_json = ReadV4Json(make_view_call(
      UINT64_C(0xd528e70ecc52c7b5), window_delegate_v4,
      &window_argument, 1));
  assert(window_titlebar_json.find(L"\"overridden\"") != std::wstring::npos);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xe236260154295e73), window_delegate_v4)).value_kind
      == LB_CEF3_VALUE_V4_INTEGER);
  auto wd_command_argument = make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 901);
  std::array<LB_CEF3_ARGUMENT_V4, 2> wd_accelerator_arguments{
      window_argument, wd_command_argument};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x19d26a4149715a81), window_delegate_v4,
      wd_accelerator_arguments.data(), wd_accelerator_arguments.size())).integer_value == 0);
  std::array<LB_CEF3_ARGUMENT_V4, 9> wd_key_arguments{
      window_argument,
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, LB_CEF3_KEY_EVENT_RAW_KEY_DOWN),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 0),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, VK_F12),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, VK_F12),
      make_label_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 0),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 0),
      make_label_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xe99e82d8a9afe069), window_delegate_v4,
      wd_key_arguments.data(), wd_key_arguments.size())).integer_value == 0);
  auto window_bool_argument = make_label_argument(LB_CEF3_VALUE_V4_BOOLEAN, 1);
  for (const auto operation : {
      UINT64_C(0x0c9a6540306de226), UINT64_C(0x107b64201b71de01),
      UINT64_C(0xa27da052daa488ae)}) {
    std::array<LB_CEF3_ARGUMENT_V4, 2> arguments{window_argument, window_bool_argument};
    assert(invoke_view_call(make_view_call(
        operation, window_delegate_v4, arguments.data(), arguments.size())).status
        == LB_CEF3_OK);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 5> window_bounds_arguments{
      window_argument,
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 1),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 2),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 400),
      make_label_argument(LB_CEF3_VALUE_V4_INTEGER, 300)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x69319e2c6a2c02cf), window_delegate_v4,
      window_bounds_arguments.data(), window_bounds_arguments.size())).status
      == LB_CEF3_OK);
  for (const auto operation : {
      UINT64_C(0xb989862fbd5eec7d), UINT64_C(0xae668cad86ae3e88),
      UINT64_C(0x8ccdb54f866314b8)}) {
    assert(invoke_view_call(make_view_call(
        operation, window_delegate_v4, &window_argument, 1)).status == LB_CEF3_OK);
  }
  window_bool_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  std::array<LB_CEF3_ARGUMENT_V4, 2> invalid_window_bool_arguments{
      window_argument, window_bool_argument};
  auto invalid_window_bool_call = make_view_call(
      UINT64_C(0x0c9a6540306de226), window_delegate_v4,
      invalid_window_bool_arguments.data(), invalid_window_bool_arguments.size());
  LB_CEF3_RESULT_V4 invalid_window_bool_result{};
  invalid_window_bool_result.struct_size = sizeof(invalid_window_bool_result);
  assert(LB_CEF3_InvokeV4(&invalid_window_bool_call, &invalid_window_bool_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_HandleRelease(window_delegate_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(window_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDelegateCanClose(window_delegate, window)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_WindowSetTitle(window, L"LingBuilder CEF3 Window") == LB_CEF3_OK);
  assert(ReadManagedText(window, LB_CEF3_WindowGetTitle) == L"LingBuilder CEF3 Window");
  LB_CEF3_SIZE_V3 window_size{
      sizeof(window_size), LB_CEF3_ABI_VERSION_V3, 420, 260};
  assert(LB_CEF3_WindowCenter(window, &window_size) == LB_CEF3_OK);
  LB_CEF3_RECT_V3 client_bounds{
      sizeof(client_bounds), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_WindowGetClientAreaBoundsInScreen(window, &client_bounds) == LB_CEF3_OK);
  assert(client_bounds.width >= 0 && client_bounds.height >= 0);
  LB_CEF3_HANDLE window_display = 0;
  assert(LB_CEF3_WindowGetDisplay(window, &window_display) == LB_CEF3_OK);
  if (window_display != 0) {
    assert(LB_CEF3_HandleGetType(window_display) == LB_CEF3_HANDLE_DISPLAY);
    assert(LB_CEF3_HandleRelease(window_display) == LB_CEF3_OK);
  }
  LB_CEF3_HANDLE focused_view = UINT64_C(0x1234);
  assert(LB_CEF3_WindowGetFocusedView(window, &focused_view) == LB_CEF3_OK);
  if (focused_view != 0) assert(LB_CEF3_HandleRelease(focused_view) == LB_CEF3_OK);
  int32_t window_runtime_style = -1;
  assert(LB_CEF3_WindowGetRuntimeStyle(window, &window_runtime_style) == LB_CEF3_OK);
  assert(window_runtime_style >= 0);
  LB_CEF3_HANDLE window_alias = 0;
  assert(LB_CEF3_WindowGetWindowHandle(window, &window_alias) == LB_CEF3_OK);
  assert(window_alias != 0 && LB_CEF3_HandleGetType(window_alias) == LB_CEF3_HANDLE_WINDOW);
  assert(LB_CEF3_ViewIsSame(window, window_alias) == 1);

  const auto window_image = LB_CEF3_ImageCreate();
  assert(window_image != 0);
  assert(LB_CEF3_WindowSetWindowIcon(window, window_image) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetWindowAppIcon(window, window_image) == LB_CEF3_OK);
  LB_CEF3_HANDLE returned_window_image = 0;
  assert(LB_CEF3_WindowGetWindowIcon(window, &returned_window_image) == LB_CEF3_OK);
  if (returned_window_image != 0) assert(LB_CEF3_ImageRelease(returned_window_image) == LB_CEF3_OK);
  returned_window_image = 0;
  assert(LB_CEF3_WindowGetWindowAppIcon(window, &returned_window_image) == LB_CEF3_OK);
  if (returned_window_image != 0) assert(LB_CEF3_ImageRelease(returned_window_image) == LB_CEF3_OK);

  assert(LB_CEF3_WindowSetAlwaysOnTop(window, 0) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetFullscreen(window, 0) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetThemeColor(window, 100000, UINT32_C(0xff123456)) == LB_CEF3_OK);
  assert(LB_CEF3_WindowThemeChanged(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetAccelerator(window, 901, VK_F12, 0, 1, 0, 1) == LB_CEF3_OK);
  assert(LB_CEF3_WindowRemoveAccelerator(window, 901) == LB_CEF3_OK);
  assert(LB_CEF3_WindowRemoveAllAccelerators(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSendKeyPress(window, VK_F24, 0) == LB_CEF3_OK);
  POINT current_cursor{};
  (void)GetCursorPos(&current_cursor);
  assert(LB_CEF3_WindowSendMouseMove(window, current_cursor.x, current_cursor.y) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSendMouseEvents(window, LB_CEF3_MOUSE_BUTTON_LEFT, 0, 0) == LB_CEF3_OK);
  LB_CEF3_DRAGGABLE_REGION_V3 draggable_region{
      sizeof(draggable_region), LB_CEF3_ABI_VERSION_V3,
      {sizeof(LB_CEF3_RECT_V3), LB_CEF3_ABI_VERSION_V3, 0, 0, 80, 24}, 1};
  assert(LB_CEF3_WindowSetDraggableRegions(window, &draggable_region, 1) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetDraggableRegions(window, nullptr, 0) == LB_CEF3_OK);

  const auto window_menu = LB_CEF3_MenuCreate();
  assert(window_menu != 0);
  assert(LB_CEF3_MenuAddItem(window_menu, 902, L"测试菜单") == 1);
  LB_CEF3_POINT_V3 menu_point{
      sizeof(menu_point), LB_CEF3_ABI_VERSION_V3, current_cursor.x, current_cursor.y};
  assert(LB_CEF3_WindowShowMenu(window, window_menu, &menu_point, 0) == LB_CEF3_OK);
  assert(LB_CEF3_WindowCancelMenu(window) == LB_CEF3_OK);

  const auto overlay_view = LB_CEF3_PanelCreate();
  assert(overlay_view != 0);
  LB_CEF3_HANDLE overlay = 0;
  assert(LB_CEF3_WindowAddOverlayView(window, overlay_view, 4, 0, &overlay) == LB_CEF3_OK);
  assert(overlay != 0 && LB_CEF3_HandleGetType(overlay) == LB_CEF3_HANDLE_OVERLAY);
  assert(LB_CEF3_OverlayIsValid(overlay) == 1);
  assert(LB_CEF3_OverlayIsSame(overlay, overlay) == 1);
  LB_CEF3_RECT_V3 overlay_bounds{
      sizeof(overlay_bounds), LB_CEF3_ABI_VERSION_V3, 10, 12, 160, 90};
  assert(LB_CEF3_OverlaySetBounds(overlay, &overlay_bounds) == LB_CEF3_OK);
  overlay_bounds = {sizeof(overlay_bounds), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_OverlayGetBounds(overlay, &overlay_bounds) == LB_CEF3_OK);
  assert(overlay_bounds.x == 10 && overlay_bounds.y == 12);
  assert(overlay_bounds.width == 160 && overlay_bounds.height == 90);
  assert(LB_CEF3_OverlayGetBoundsInScreen(overlay, &overlay_bounds) == LB_CEF3_OK);
  LB_CEF3_POINT_V3 overlay_position{
      sizeof(overlay_position), LB_CEF3_ABI_VERSION_V3, 14, 16};
  assert(LB_CEF3_OverlaySetPosition(overlay, &overlay_position) == LB_CEF3_OK);
  overlay_position = {sizeof(overlay_position), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_OverlayGetPosition(overlay, &overlay_position) == LB_CEF3_OK);
  assert(overlay_position.x == 14 && overlay_position.y == 16);
  LB_CEF3_SIZE_V3 overlay_size{
      sizeof(overlay_size), LB_CEF3_ABI_VERSION_V3, 180, 100};
  assert(LB_CEF3_OverlaySetSize(overlay, &overlay_size) == LB_CEF3_OK);
  overlay_size = {sizeof(overlay_size), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_OverlayGetSize(overlay, &overlay_size) == LB_CEF3_OK);
  assert(overlay_size.width == 180 && overlay_size.height == 100);
  LB_CEF3_INSETS_V3 overlay_insets{
      sizeof(overlay_insets), LB_CEF3_ABI_VERSION_V3, 1, 2, 3, 4};
  assert(LB_CEF3_OverlaySetInsets(overlay, &overlay_insets) == LB_CEF3_OK);
  overlay_insets = {sizeof(overlay_insets), LB_CEF3_ABI_VERSION_V3};
  assert(LB_CEF3_OverlayGetInsets(overlay, &overlay_insets) == LB_CEF3_OK);
  int32_t docking_mode = -1;
  assert(LB_CEF3_OverlayGetDockingMode(overlay, &docking_mode) == LB_CEF3_OK);
  assert(docking_mode == 4);
  LB_CEF3_HANDLE overlay_contents = 0;
  assert(LB_CEF3_OverlayGetContentsView(overlay, &overlay_contents) == LB_CEF3_OK);
  assert(overlay_contents != 0 && LB_CEF3_ViewIsSame(overlay_view, overlay_contents) == 1);
  LB_CEF3_HANDLE overlay_window = 0;
  assert(LB_CEF3_OverlayGetWindow(overlay, &overlay_window) == LB_CEF3_OK);
  assert(overlay_window != 0 && LB_CEF3_ViewIsSame(window, overlay_window) == 1);
  assert(LB_CEF3_OverlaySizeToPreferredSize(overlay) == LB_CEF3_OK);
  assert(LB_CEF3_OverlaySetVisible(overlay, 0) == LB_CEF3_OK);
  assert(LB_CEF3_OverlayIsVisible(overlay) == 0);
  assert(LB_CEF3_OverlayIsDrawn(overlay) == 0);
  assert(LB_CEF3_OverlaySetVisible(overlay, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_OverlayDestroy(overlay) == LB_CEF3_OK);
  assert(LB_CEF3_OverlayIsValid(overlay) == 0);
  assert(LB_CEF3_OverlayGetSize(overlay, &overlay_size) == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_HandleRelease(overlay_window) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(overlay_contents) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(overlay) == LB_CEF3_OK);
  assert(LB_CEF3_OverlayIsValid(overlay) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(overlay_view) == LB_CEF3_OK);

  for (const auto query : {
      LB_CEF3_WindowIsActive, LB_CEF3_WindowIsAlwaysOnTop,
      LB_CEF3_WindowIsFullscreen, LB_CEF3_WindowIsMaximized,
      LB_CEF3_WindowIsMinimized}) {
    const int value = query(window);
    assert(value == 0 || value == 1);
  }
  assert(LB_CEF3_WindowShow(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowActivate(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowBringToTop(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowDeactivate(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowMaximize(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowMinimize(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowRestore(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowHide(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowSetAlwaysOnTop(window, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WindowSendMouseEvents(window, 99, 0, 0) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WindowGetTitle(panel_view, nullptr, 0, &required) == LB_CEF3_ERROR_HANDLE_TYPE);

  auto make_window_argument = [](uint32_t kind, int64_t integer_value = 0,
                                 LB_CEF3_HANDLE handle_value = 0,
                                 const wchar_t* text_value = nullptr) {
    LB_CEF3_ARGUMENT_V4 argument{};
    argument.struct_size = sizeof(argument);
    argument.value_kind = kind;
    argument.integer_value = integer_value;
    argument.handle_value = handle_value;
    argument.text_value = text_value;
    return argument;
  };
  auto nullable_window_delegate_argument = make_window_argument(LB_CEF3_VALUE_V4_HANDLE);
  auto create_window_v4 = make_view_call(
      UINT64_C(0xe9e4db36f9504e33), 0, &nullable_window_delegate_argument, 1);
  const auto window_v4_result = invoke_view_call(create_window_v4);
  const auto window_v4 = window_v4_result.handle_value;
  assert(window_v4 != 0 && LB_CEF3_HandleGetType(window_v4) == LB_CEF3_HANDLE_WINDOW);

  auto title_argument = make_window_argument(
      LB_CEF3_VALUE_V4_TEXT, 0, 0, L"LingBuilder V4 Window");
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8892b027b2fc4f68), window_v4, &title_argument, 1)).status == LB_CEF3_OK);
  assert(ReadV4Text(make_view_call(
      UINT64_C(0x4c45aeb09dfcb493), window_v4)) == L"LingBuilder V4 Window");

  std::array<LB_CEF3_ARGUMENT_V4, 2> size_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 360),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 220)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4042106e952bdf82), window_v4,
      size_arguments.data(), size_arguments.size())).status == LB_CEF3_OK);
  assert(!ReadV4Json(make_view_call(
      UINT64_C(0x35f497c1de3a835c), window_v4)).empty());
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc7db650edc813253), window_v4)).value_kind == LB_CEF3_VALUE_V4_INTEGER);

  for (const auto operation : {
      UINT64_C(0x9c71f103bd391691), UINT64_C(0x3a6f5bf22d3f435d),
      UINT64_C(0xd6b1f428795da785), UINT64_C(0x2d719f3b6132267d),
      UINT64_C(0x94b07ca0817947fd), UINT64_C(0x2d2bbe418097bb5e)}) {
    assert(invoke_view_call(make_view_call(operation, window_v4)).value_kind
        == LB_CEF3_VALUE_V4_BOOLEAN);
  }

  auto image_argument = make_window_argument(
      LB_CEF3_VALUE_V4_HANDLE, 0, window_image);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xde9c3844c51517cc), window_v4, &image_argument, 1)).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc9d379d8ee6ffff2), window_v4, &image_argument, 1)).status == LB_CEF3_OK);
  for (const auto operation : {
      UINT64_C(0x28aa5f47c4f9a666), UINT64_C(0x426445536d708086),
      UINT64_C(0xe93a90042fcae4d8), UINT64_C(0xc4371bed37cef572),
      UINT64_C(0x1bdc872042f1763b)}) {
    auto handle_result = invoke_view_call(make_view_call(operation, window_v4));
    assert(handle_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    if (handle_result.handle_value != 0)
      assert(LB_CEF3_HandleRelease(handle_result.handle_value) == LB_CEF3_OK);
  }

  auto false_argument = make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x0306a0734ee94f42), window_v4, &false_argument, 1)).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb845f76e28aea962), window_v4, &false_argument, 1)).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> theme_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 100001),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, UINT32_C(0xff654321))};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x7825ab4c6dd45215), window_v4,
      theme_arguments.data(), theme_arguments.size())).status == LB_CEF3_OK);

  std::array<LB_CEF3_ARGUMENT_V4, 2> key_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, VK_F23),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 0)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x5e998aabae695bcd), window_v4,
      key_arguments.data(), key_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> window_mouse_move_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, current_cursor.x),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, current_cursor.y)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x6d8669bd0aa53ec4), window_v4,
      window_mouse_move_arguments.data(), window_mouse_move_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 3> mouse_event_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, LB_CEF3_MOUSE_BUTTON_LEFT),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x7d2d5d0f00cef9bc), window_v4,
      mouse_event_arguments.data(), mouse_event_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 6> accelerator_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 903),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, VK_F11),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 1),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 1)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x306c5635a5dd51e1), window_v4,
      accelerator_arguments.data(), accelerator_arguments.size())).status == LB_CEF3_OK);
  auto command_argument = make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 903);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x74270015653b9605), window_v4, &command_argument, 1)).status == LB_CEF3_OK);

  const auto region_list = CreateDraggableRegionList(0, 0, 70, 22, true);
  auto region_argument = make_window_argument(
      LB_CEF3_VALUE_V4_HANDLE, 0, region_list);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xa46db829cec84e18), window_v4, &region_argument, 1)).status == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(region_list) == LB_CEF3_OK);

  std::array<LB_CEF3_ARGUMENT_V4, 4> show_menu_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_HANDLE, 0, window_menu),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, current_cursor.x),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, current_cursor.y),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 0)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xd6a802ed6a02ccda), window_v4,
      show_menu_arguments.data(), show_menu_arguments.size())).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x6538310ebe17e041), window_v4)).status == LB_CEF3_OK);

  const auto overlay_view_v4 = LB_CEF3_PanelCreate();
  std::array<LB_CEF3_ARGUMENT_V4, 3> add_overlay_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_HANDLE, 0, overlay_view_v4),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 4),
      make_window_argument(LB_CEF3_VALUE_V4_BOOLEAN, 0)};
  const auto overlay_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x63fb078538a623a3), window_v4,
      add_overlay_arguments.data(), add_overlay_arguments.size())).handle_value;
  assert(overlay_v4 != 0 && LB_CEF3_HandleGetType(overlay_v4) == LB_CEF3_HANDLE_OVERLAY);
  auto overlay_self_argument = make_window_argument(
      LB_CEF3_VALUE_V4_HANDLE, 0, overlay_v4);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x13b37bfa96507e6f), overlay_v4,
      &overlay_self_argument, 1)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x0f46d90c8f6b119b), overlay_v4)).integer_value == 4);
  for (const auto operation : {
      UINT64_C(0xea75b1571942f617), UINT64_C(0xc106bd3438d12a60),
      UINT64_C(0x3f3a7cb8127bd907)}) {
    assert(invoke_view_call(make_view_call(operation, overlay_v4)).value_kind
        == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  for (const auto operation : {
      UINT64_C(0x96e6bb0fbbf1ccca), UINT64_C(0x388cfc2e336ca478),
      UINT64_C(0x722a2ccb35f8d685), UINT64_C(0xe634628540d94279),
      UINT64_C(0x97cd9f7959875b04)}) {
    assert(!ReadV4Json(make_view_call(operation, overlay_v4)).empty());
  }
  for (const auto operation : {
      UINT64_C(0x0aa993a4db523db5), UINT64_C(0x3c14b9c709b7cdb4)}) {
    const auto handle_result = invoke_view_call(make_view_call(operation, overlay_v4));
    assert(handle_result.handle_value != 0);
    assert(LB_CEF3_HandleRelease(handle_result.handle_value) == LB_CEF3_OK);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 4> overlay_rect_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 8),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 9),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 150),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 80)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xc4e147f3921af170), overlay_v4,
      overlay_rect_arguments.data(), overlay_rect_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 4> overlay_inset_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 1),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 2),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 3),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 4)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xb1ae526139a769aa), overlay_v4,
      overlay_inset_arguments.data(), overlay_inset_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> overlay_point_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 11),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 13)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x8d44a0a7ca0d4d65), overlay_v4,
      overlay_point_arguments.data(), overlay_point_arguments.size())).status == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> overlay_size_arguments{
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 170),
      make_window_argument(LB_CEF3_VALUE_V4_INTEGER, 95)};
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x4d312104e0e2e8f4), overlay_v4,
      overlay_size_arguments.data(), overlay_size_arguments.size())).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xfbc1ed768a8fdd1a), overlay_v4)).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x407535b0359f2cc6), overlay_v4,
      &false_argument, 1)).status == LB_CEF3_OK);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x18f84dfbb840ccc6), overlay_v4)).status == LB_CEF3_OK);
  assert(LB_CEF3_OverlayIsValid(overlay_v4) == 0);
  assert(LB_CEF3_HandleRelease(overlay_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(overlay_view_v4) == LB_CEF3_OK);

  for (const auto operation : {
      UINT64_C(0xceeaef3d509d2742), UINT64_C(0xde00e1ac9300e2fc),
      UINT64_C(0x41dc2b9e5a35d70b), UINT64_C(0xa2aee0b4142504b0),
      UINT64_C(0x9057f15c346e97cc), UINT64_C(0xa541116f74d0ce16),
      UINT64_C(0x6e531abc36115ee6), UINT64_C(0x4248846a1cee3d9a),
      UINT64_C(0xbcf0d0ce393ffa09), UINT64_C(0x2a8f4fef430ddac7)}) {
    assert(invoke_view_call(make_view_call(operation, window_v4)).status == LB_CEF3_OK);
  }
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x9aebed1092059061), window_v4)).status == LB_CEF3_OK);
  PumpHostMessages();
  assert(LB_CEF3_WindowIsClosed(window_v4) == 1);
  assert(LB_CEF3_HandleRelease(window_v4) == LB_CEF3_OK);

  assert(LB_CEF3_WindowClose(window) == LB_CEF3_OK);
  PumpHostMessages();
  assert(LB_CEF3_WindowIsClosed(window) == 1);
  assert(LB_CEF3_MenuRelease(window_menu) == LB_CEF3_OK);
  assert(LB_CEF3_ImageRelease(window_image) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(window_alias) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(window) == LB_CEF3_OK);
  assert(LB_CEF3_WindowIsClosed(window) == LB_CEF3_ERROR_RELEASED_HANDLE);

  assert(LB_CEF3_HandleRelease(panel_child_v4_b) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(panel_child_v4_a) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(box_conversion_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(box_layout_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(current_layout_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(fill_conversion_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(fill_layout_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(panel_child_b) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(panel_child_a) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(box_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(box_layout) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(current_layout) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(fill_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(fill_layout) == LB_CEF3_OK);

  assert(LB_CEF3_HandleRelease(panel_view_v4) == LB_CEF3_OK);
  assert(LB_CEF3_ViewIsValid(panel_view_v4) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(converted_view) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(panel_view) == LB_CEF3_OK);
  assert(LB_CEF3_ViewIsValid(panel_view) == LB_CEF3_ERROR_RELEASED_HANDLE);

  LB_CEF3_ARGUMENT_V4 mime_argument{};
  mime_argument.struct_size = sizeof(mime_argument);
  mime_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  mime_argument.text_value = L"text/html";
  LB_CEF3_CALL_V4 mime_call{};
  mime_call.struct_size = sizeof(mime_call);
  mime_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  mime_call.operation_id = UINT64_C(0x5bac61d0dfa32ca4);
  mime_call.arguments = &mime_argument;
  mime_call.argument_count = 1;
  LB_CEF3_RESULT_V4 mime_result{};
  mime_result.struct_size = sizeof(mime_result);
  assert(LB_CEF3_InvokeV4(&mime_call, &mime_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring mime_json(mime_result.text_required, L'\0');
  mime_result.text = mime_json.data();
  mime_result.text_capacity = mime_json.size();
  assert(LB_CEF3_InvokeV4(&mime_call, &mime_result) == LB_CEF3_OK);
  assert(mime_result.value_kind == LB_CEF3_VALUE_V4_JSON);
  assert(std::wstring(mime_json.c_str()).find(L"html") != std::wstring::npos);

  LB_CEF3_ARGUMENT_V4 mime_type_argument{};
  mime_type_argument.struct_size = sizeof(mime_type_argument);
  mime_type_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  mime_type_argument.text_value = L".html";
  LB_CEF3_CALL_V4 mime_type_call{};
  mime_type_call.struct_size = sizeof(mime_type_call);
  mime_type_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  mime_type_call.operation_id = UINT64_C(0xa5eb580b75b353b7);
  mime_type_call.arguments = &mime_type_argument;
  mime_type_call.argument_count = 1;
  LB_CEF3_RESULT_V4 mime_type_result{};
  mime_type_result.struct_size = sizeof(mime_type_result);
  assert(LB_CEF3_InvokeV4(&mime_type_call, &mime_type_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring mime_type_text(mime_type_result.text_required, L'\0');
  mime_type_result.text = mime_type_text.data();
  mime_type_result.text_capacity = mime_type_text.size();
  assert(LB_CEF3_InvokeV4(&mime_type_call, &mime_type_result) == LB_CEF3_OK);
  assert(std::wstring(mime_type_text.c_str()) == L"text/html");

  const auto url_parts = LB_CEF3_DictionaryCreate();
  assert(url_parts != 0);
  const auto set_url_part = [url_parts](const wchar_t* key, const wchar_t* value) {
    const auto part = LB_CEF3_ValueCreate();
    assert(part != 0);
    assert(LB_CEF3_ValueSetString(part, value) == LB_CEF3_OK);
    assert(LB_CEF3_DictionarySetValue(url_parts, key, part) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(part) == LB_CEF3_OK);
  };
  set_url_part(L"scheme", L"https");
  set_url_part(L"username", L"user");
  set_url_part(L"password", L"pass");
  set_url_part(L"host", L"example.com");
  set_url_part(L"port", L"8443");
  set_url_part(L"path", L"/path");
  set_url_part(L"query", L"q=1");
  set_url_part(L"fragment", L"frag");
  std::array<wchar_t, 256> created_url{};
  assert(LB_CEF3_CreateUrl(url_parts, created_url.data(), created_url.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(created_url.data()).find(L"https://user:pass@example.com:8443/path?q=1#frag") == 0);
  LB_CEF3_ARGUMENT_V4 create_url_argument{};
  create_url_argument.struct_size = sizeof(create_url_argument);
  create_url_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  create_url_argument.handle_value = url_parts;
  LB_CEF3_CALL_V4 create_url_call{};
  create_url_call.struct_size = sizeof(create_url_call);
  create_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_url_call.operation_id = UINT64_C(0xb350aa880c6a59d9);
  create_url_call.arguments = &create_url_argument;
  create_url_call.argument_count = 1;
  LB_CEF3_RESULT_V4 create_url_result{};
  create_url_result.struct_size = sizeof(create_url_result);
  assert(LB_CEF3_InvokeV4(&create_url_call, &create_url_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring created_url_v4(create_url_result.text_required, L'\0');
  create_url_result.text = created_url_v4.data();
  create_url_result.text_capacity = created_url_v4.size();
  assert(LB_CEF3_InvokeV4(&create_url_call, &create_url_result) == LB_CEF3_OK);
  assert(create_url_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(created_url_v4.find(L"https://user:pass@example.com:8443/path?q=1#frag") == 0);
  const auto parsed_url = LB_CEF3_ParseUrl(L"https://user:pass@example.com:8443/path?q=1#frag");
  assert(parsed_url != 0);
  assert(LB_CEF3_HandleGetType(parsed_url) == LB_CEF3_HANDLE_DICTIONARY);
  const auto parsed_host = LB_CEF3_DictionaryGetValue(parsed_url, L"host");
  assert(parsed_host != 0);
  std::array<wchar_t, 64> parsed_host_text{};
  assert(LB_CEF3_ValueGetString(parsed_host, parsed_host_text.data(), parsed_host_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(parsed_host_text.data()) == L"example.com");
  assert(LB_CEF3_ValueRelease(parsed_host) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 parse_url_argument{};
  parse_url_argument.struct_size = sizeof(parse_url_argument);
  parse_url_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  parse_url_argument.text_value = L"https://example.com/parsed";
  LB_CEF3_CALL_V4 parse_url_call{};
  parse_url_call.struct_size = sizeof(parse_url_call);
  parse_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  parse_url_call.operation_id = UINT64_C(0x388f671ae193311a);
  parse_url_call.arguments = &parse_url_argument;
  parse_url_call.argument_count = 1;
  LB_CEF3_RESULT_V4 parse_url_result{};
  parse_url_result.struct_size = sizeof(parse_url_result);
  assert(LB_CEF3_InvokeV4(&parse_url_call, &parse_url_result) == LB_CEF3_OK);
  assert(parse_url_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(parse_url_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(parse_url_result.handle_value) == LB_CEF3_HANDLE_DICTIONARY);
  assert(LB_CEF3_HandleRelease(parse_url_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(parsed_url) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(url_parts) == LB_CEF3_OK);
  std::array<wchar_t, 256> resolved_url{};
  assert(LB_CEF3_ResolveUrl(L"https://example.com/dir/page.html", L"../next?q=1#frag",
                            resolved_url.data(), resolved_url.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(resolved_url.data()) == L"https://example.com/next?q=1#frag");
  LB_CEF3_ARGUMENT_V4 resolve_url_arguments[2]{};
  resolve_url_arguments[0].struct_size = sizeof(resolve_url_arguments[0]);
  resolve_url_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resolve_url_arguments[0].text_value = L"https://example.com/dir/page.html";
  resolve_url_arguments[1].struct_size = sizeof(resolve_url_arguments[1]);
  resolve_url_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resolve_url_arguments[1].text_value = L"../next?q=1#frag";
  LB_CEF3_CALL_V4 resolve_url_call{};
  resolve_url_call.struct_size = sizeof(resolve_url_call);
  resolve_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  resolve_url_call.operation_id = UINT64_C(0x42c0a016234c99e2);
  resolve_url_call.arguments = resolve_url_arguments;
  resolve_url_call.argument_count = 2;
  LB_CEF3_RESULT_V4 resolve_url_result{};
  resolve_url_result.struct_size = sizeof(resolve_url_result);
  assert(LB_CEF3_InvokeV4(&resolve_url_call, &resolve_url_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring resolved_url_v4(resolve_url_result.text_required, L'\0');
  resolve_url_result.text = resolved_url_v4.data();
  resolve_url_result.text_capacity = resolved_url_v4.size();
  assert(LB_CEF3_InvokeV4(&resolve_url_call, &resolve_url_result) == LB_CEF3_OK);
  assert(resolve_url_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  resolved_url_v4.resize(wcslen(resolved_url_v4.c_str()));
  assert(resolved_url_v4 == L"https://example.com/next?q=1#frag");

  const unsigned char input[] = {0x00, 0x7f, 0xff};
  const auto first = LB_CEF3_BufferCreate(input, sizeof(input));
  assert(first != 0);
  assert(LB_CEF3_HandleGetType(first) == LB_CEF3_HANDLE_BUFFER);
  std::array<wchar_t, 32> base64_text{};
  assert(LB_CEF3_Base64Encode(first, sizeof(input), base64_text.data(), base64_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(base64_text.data()) == L"AH//");
  LB_CEF3_ARGUMENT_V4 base64_arguments[2]{};
  base64_arguments[0].struct_size = sizeof(base64_arguments[0]);
  base64_arguments[0].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  base64_arguments[0].buffer_value = first;
  base64_arguments[1].struct_size = sizeof(base64_arguments[1]);
  base64_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  base64_arguments[1].integer_value = sizeof(input);
  LB_CEF3_CALL_V4 base64_call{};
  base64_call.struct_size = sizeof(base64_call);
  base64_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  base64_call.operation_id = UINT64_C(0xb14c7737100600ac);
  base64_call.arguments = base64_arguments;
  base64_call.argument_count = 2;
  LB_CEF3_RESULT_V4 base64_result{};
  base64_result.struct_size = sizeof(base64_result);
  assert(LB_CEF3_InvokeV4(&base64_call, &base64_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring base64_text_v4(base64_result.text_required, L'\0');
  base64_result.text = base64_text_v4.data();
  base64_result.text_capacity = base64_text_v4.size();
  assert(LB_CEF3_InvokeV4(&base64_call, &base64_result) == LB_CEF3_OK);
  assert(base64_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  base64_text_v4.resize(wcslen(base64_text_v4.c_str()));
  assert(base64_text_v4 == L"AH//");
  const auto decoded_base64 = LB_CEF3_Base64Decode(L"AH//");
  assert(decoded_base64 != 0);
  uint64_t decoded_base64_size = 0;
  assert(LB_CEF3_BufferGetSize(decoded_base64, &decoded_base64_size) == LB_CEF3_OK);
  assert(decoded_base64_size == sizeof(input));
  std::array<unsigned char, sizeof(input)> decoded_base64_bytes{};
  assert(LB_CEF3_BufferCopy(decoded_base64, decoded_base64_bytes.data(), decoded_base64_bytes.size(), &required)
      == LB_CEF3_OK);
  assert(std::equal(std::begin(input), std::end(input), decoded_base64_bytes.begin()));
  LB_CEF3_ARGUMENT_V4 base64_decode_argument{};
  base64_decode_argument.struct_size = sizeof(base64_decode_argument);
  base64_decode_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  base64_decode_argument.text_value = L"AH//";
  LB_CEF3_CALL_V4 base64_decode_call{};
  base64_decode_call.struct_size = sizeof(base64_decode_call);
  base64_decode_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  base64_decode_call.operation_id = UINT64_C(0x27ac657a4d8b5259);
  base64_decode_call.arguments = &base64_decode_argument;
  base64_decode_call.argument_count = 1;
  LB_CEF3_RESULT_V4 base64_decode_result{};
  base64_decode_result.struct_size = sizeof(base64_decode_result);
  assert(LB_CEF3_InvokeV4(&base64_decode_call, &base64_decode_result) == LB_CEF3_OK);
  assert(base64_decode_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(base64_decode_result.buffer_value != 0);
  assert(LB_CEF3_HandleGetType(base64_decode_result.buffer_value) == LB_CEF3_HANDLE_BUFFER);
  assert(LB_CEF3_HandleRelease(base64_decode_result.buffer_value) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(decoded_base64) == LB_CEF3_OK);

  const char stream_source_text[] = "abcdef";
  assert(LB_CEF3_StreamReaderCreateForBuffer(0) == 0);
  assert(LB_CEF3_StreamReaderRead(0, 1) == 0);
  assert(LB_CEF3_StreamReaderSeek(0, 0, LB_CEF3_STREAM_SEEK_BEGIN)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_StreamReaderTell(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_StreamReaderEof(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_StreamReaderMayBlock(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  const auto stream_source = LB_CEF3_BufferCreate(stream_source_text, sizeof(stream_source_text) - 1);
  assert(stream_source != 0);
  const auto stream_reader = LB_CEF3_StreamReaderCreateForBuffer(stream_source);
  assert(stream_reader != 0);
  assert(LB_CEF3_HandleGetType(stream_reader) == LB_CEF3_HANDLE_STREAM);
  assert(LB_CEF3_BufferRelease(stream_source) == LB_CEF3_OK);
  assert(LB_CEF3_StreamReaderMayBlock(stream_reader) == 0);
  assert(LB_CEF3_StreamReaderEof(stream_reader) == 0);
  const auto first_stream_chunk = LB_CEF3_StreamReaderRead(stream_reader, 4);
  assert(first_stream_chunk != 0);
  std::array<wchar_t, 32> stream_hex{};
  assert(LB_CEF3_BufferToHex(first_stream_chunk, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"61626364");
  assert(LB_CEF3_StreamReaderTell(stream_reader) == 4);
  assert(LB_CEF3_StreamReaderSeek(stream_reader, -2, LB_CEF3_STREAM_SEEK_END) == 0);
  const auto final_stream_chunk = LB_CEF3_StreamReaderRead(stream_reader, 8);
  assert(final_stream_chunk != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(final_stream_chunk, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"6566");
  assert(LB_CEF3_StreamReaderEof(stream_reader) == 1);
  assert(LB_CEF3_StreamReaderSeek(stream_reader, 0, 7) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BufferRelease(first_stream_chunk) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(final_stream_chunk) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(stream_reader) == LB_CEF3_OK);
  assert(LB_CEF3_StreamReaderRead(stream_reader, 1) == 0);

  const auto v4_stream_source = LB_CEF3_BufferCreate(stream_source_text, sizeof(stream_source_text) - 1);
  assert(v4_stream_source != 0);
  LB_CEF3_ARGUMENT_V4 stream_create_argument{};
  stream_create_argument.struct_size = sizeof(stream_create_argument);
  stream_create_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  stream_create_argument.handle_value = v4_stream_source;
  LB_CEF3_CALL_V4 stream_create_call{};
  stream_create_call.struct_size = sizeof(stream_create_call);
  stream_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  stream_create_call.operation_id = UINT64_C(0x04c7055093da23f6);
  stream_create_call.arguments = &stream_create_argument;
  stream_create_call.argument_count = 1;
  LB_CEF3_RESULT_V4 stream_create_result{};
  stream_create_result.struct_size = sizeof(stream_create_result);
  assert(LB_CEF3_InvokeV4(&stream_create_call, &stream_create_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  stream_create_argument.value_kind = LB_CEF3_VALUE_V4_BUFFER;
  stream_create_argument.buffer_value = v4_stream_source;
  assert(LB_CEF3_InvokeV4(&stream_create_call, &stream_create_result) == LB_CEF3_OK);
  assert(stream_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v4_stream_reader = stream_create_result.handle_value;
  assert(v4_stream_reader != 0);
  assert(LB_CEF3_HandleGetType(v4_stream_reader) == LB_CEF3_HANDLE_STREAM);
  assert(LB_CEF3_BufferRelease(v4_stream_source) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 stream_no_argument_call{};
  stream_no_argument_call.struct_size = sizeof(stream_no_argument_call);
  stream_no_argument_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  stream_no_argument_call.target = v4_stream_reader;
  LB_CEF3_RESULT_V4 stream_no_argument_result{};
  stream_no_argument_result.struct_size = sizeof(stream_no_argument_result);
  stream_no_argument_call.operation_id = UINT64_C(0x80489abdd5b985dd);
  assert(LB_CEF3_InvokeV4(&stream_no_argument_call, &stream_no_argument_result) == LB_CEF3_OK);
  assert(stream_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(stream_no_argument_result.integer_value == 0);

  LB_CEF3_ARGUMENT_V4 stream_read_argument{};
  stream_read_argument.struct_size = sizeof(stream_read_argument);
  stream_read_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  stream_read_argument.integer_value = 3;
  LB_CEF3_CALL_V4 stream_read_call{};
  stream_read_call.struct_size = sizeof(stream_read_call);
  stream_read_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  stream_read_call.operation_id = UINT64_C(0xb3f1ddb52dc7c91b);
  stream_read_call.target = v4_stream_reader;
  stream_read_call.arguments = &stream_read_argument;
  stream_read_call.argument_count = 1;
  LB_CEF3_RESULT_V4 stream_read_result{};
  stream_read_result.struct_size = sizeof(stream_read_result);
  assert(LB_CEF3_InvokeV4(&stream_read_call, &stream_read_result) == LB_CEF3_OK);
  assert(stream_read_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(stream_read_result.buffer_value != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(stream_read_result.buffer_value, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"616263");
  assert(LB_CEF3_BufferRelease(stream_read_result.buffer_value) == LB_CEF3_OK);

  stream_no_argument_call.operation_id = UINT64_C(0x24d76223704010a1);
  assert(LB_CEF3_InvokeV4(&stream_no_argument_call, &stream_no_argument_result) == LB_CEF3_OK);
  assert(stream_no_argument_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(stream_no_argument_result.integer_value == 3);

  std::array<LB_CEF3_ARGUMENT_V4, 2> stream_seek_arguments{};
  stream_seek_arguments[0].struct_size = sizeof(stream_seek_arguments[0]);
  stream_seek_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  stream_seek_arguments[0].integer_value = -1;
  stream_seek_arguments[1].struct_size = sizeof(stream_seek_arguments[1]);
  stream_seek_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  stream_seek_arguments[1].integer_value = LB_CEF3_STREAM_SEEK_END;
  LB_CEF3_CALL_V4 stream_seek_call{};
  stream_seek_call.struct_size = sizeof(stream_seek_call);
  stream_seek_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  stream_seek_call.operation_id = UINT64_C(0x8160ccc2a21db16f);
  stream_seek_call.target = v4_stream_reader;
  stream_seek_call.arguments = stream_seek_arguments.data();
  stream_seek_call.argument_count = stream_seek_arguments.size();
  LB_CEF3_RESULT_V4 stream_seek_result{};
  stream_seek_result.struct_size = sizeof(stream_seek_result);
  assert(LB_CEF3_InvokeV4(&stream_seek_call, &stream_seek_result) == LB_CEF3_OK);
  assert(stream_seek_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(stream_seek_result.integer_value == 0);
  stream_read_argument.integer_value = 1;
  assert(LB_CEF3_InvokeV4(&stream_read_call, &stream_read_result) == LB_CEF3_OK);
  assert(LB_CEF3_BufferToHex(stream_read_result.buffer_value, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"66");
  assert(LB_CEF3_BufferRelease(stream_read_result.buffer_value) == LB_CEF3_OK);
  stream_no_argument_call.operation_id = UINT64_C(0x00d4e771b43bf404);
  assert(LB_CEF3_InvokeV4(&stream_no_argument_call, &stream_no_argument_result) == LB_CEF3_OK);
  assert(stream_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(stream_no_argument_result.integer_value == 1);
  assert(LB_CEF3_HandleRelease(v4_stream_reader) == LB_CEF3_OK);
  assert(LB_CEF3_InvokeV4(&stream_no_argument_call, &stream_no_argument_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto read_handler_source = LB_CEF3_BufferCreate(
      stream_source_text, sizeof(stream_source_text) - 1);
  assert(read_handler_source != 0);
  assert(LB_CEF3_ReadHandlerCreateForBuffer(0, 0) == 0);
  const auto read_handler = LB_CEF3_ReadHandlerCreateForBuffer(read_handler_source, 1);
  assert(read_handler != 0);
  assert(LB_CEF3_HandleGetType(read_handler) == LB_CEF3_HANDLE_READ_HANDLER);
  assert(LB_CEF3_BufferRelease(read_handler_source) == LB_CEF3_OK);
  assert(LB_CEF3_ReadHandlerMayBlock(read_handler) == 1);
  const auto handler_stream_reader = LB_CEF3_StreamReaderCreateForHandler(read_handler);
  assert(handler_stream_reader != 0);
  assert(LB_CEF3_HandleGetType(handler_stream_reader) == LB_CEF3_HANDLE_STREAM);
  const auto handler_stream_first = LB_CEF3_StreamReaderRead(handler_stream_reader, 2);
  assert(handler_stream_first != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(handler_stream_first, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"6162");
  assert(LB_CEF3_ReadHandlerTell(read_handler) == 2);
  const auto handler_direct_chunk = LB_CEF3_ReadHandlerRead(read_handler, 2);
  assert(handler_direct_chunk != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(handler_direct_chunk, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"6364");
  assert(LB_CEF3_ReadHandlerSeek(read_handler, -1, LB_CEF3_STREAM_SEEK_END) == 0);
  assert(LB_CEF3_ReadHandlerEof(read_handler) == 0);
  const auto handler_stream_last = LB_CEF3_StreamReaderRead(handler_stream_reader, 1);
  assert(handler_stream_last != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(handler_stream_last, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"66");
  assert(LB_CEF3_ReadHandlerEof(read_handler) == 1);
  assert(LB_CEF3_ReadHandlerSeek(read_handler, 0, 7) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ReadHandlerRead(read_handler, 64ULL * 1024ULL * 1024ULL + 1) == 0);
  assert(LB_CEF3_BufferRelease(handler_stream_first) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(handler_direct_chunk) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(handler_stream_last) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(handler_stream_reader) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(read_handler) == LB_CEF3_OK);

  const auto v4_read_handler_source = LB_CEF3_BufferCreate(
      stream_source_text, sizeof(stream_source_text) - 1);
  assert(v4_read_handler_source != 0);
  const auto v4_read_handler = LB_CEF3_ReadHandlerCreateForBuffer(v4_read_handler_source, 1);
  assert(v4_read_handler != 0);
  assert(LB_CEF3_BufferRelease(v4_read_handler_source) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 v4_read_handler_create_argument{};
  v4_read_handler_create_argument.struct_size = sizeof(v4_read_handler_create_argument);
  v4_read_handler_create_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  v4_read_handler_create_argument.handle_value = v4_read_handler;
  LB_CEF3_CALL_V4 v4_read_handler_create_call{};
  v4_read_handler_create_call.struct_size = sizeof(v4_read_handler_create_call);
  v4_read_handler_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_read_handler_create_call.operation_id = UINT64_C(0x545704d415cd0a80);
  v4_read_handler_create_call.arguments = &v4_read_handler_create_argument;
  v4_read_handler_create_call.argument_count = 1;
  LB_CEF3_RESULT_V4 v4_read_handler_create_result{};
  v4_read_handler_create_result.struct_size = sizeof(v4_read_handler_create_result);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_create_call, &v4_read_handler_create_result)
      == LB_CEF3_OK);
  assert(v4_read_handler_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v4_handler_stream_reader = v4_read_handler_create_result.handle_value;
  assert(v4_handler_stream_reader != 0);
  const auto v4_handler_stream_first = LB_CEF3_StreamReaderRead(v4_handler_stream_reader, 1);
  assert(v4_handler_stream_first != 0);
  assert(LB_CEF3_BufferRelease(v4_handler_stream_first) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 v4_read_handler_no_argument_call{};
  v4_read_handler_no_argument_call.struct_size = sizeof(v4_read_handler_no_argument_call);
  v4_read_handler_no_argument_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_read_handler_no_argument_call.target = v4_read_handler;
  LB_CEF3_RESULT_V4 v4_read_handler_no_argument_result{};
  v4_read_handler_no_argument_result.struct_size = sizeof(v4_read_handler_no_argument_result);
  v4_read_handler_no_argument_call.operation_id = UINT64_C(0x28d1cc94dc063024);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_no_argument_call,
                          &v4_read_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_read_handler_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(v4_read_handler_no_argument_result.integer_value == 1);
  v4_read_handler_no_argument_call.operation_id = UINT64_C(0xc8615f37fc6353d5);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_no_argument_call,
                          &v4_read_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_read_handler_no_argument_result.integer_value == 1);
  std::array<LB_CEF3_ARGUMENT_V4, 2> v4_read_handler_seek_arguments{};
  v4_read_handler_seek_arguments[0].struct_size = sizeof(v4_read_handler_seek_arguments[0]);
  v4_read_handler_seek_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_read_handler_seek_arguments[0].integer_value = -1;
  v4_read_handler_seek_arguments[1].struct_size = sizeof(v4_read_handler_seek_arguments[1]);
  v4_read_handler_seek_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_read_handler_seek_arguments[1].integer_value = LB_CEF3_STREAM_SEEK_END;
  LB_CEF3_CALL_V4 v4_read_handler_seek_call{};
  v4_read_handler_seek_call.struct_size = sizeof(v4_read_handler_seek_call);
  v4_read_handler_seek_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_read_handler_seek_call.operation_id = UINT64_C(0x7a939b78d135427a);
  v4_read_handler_seek_call.target = v4_read_handler;
  v4_read_handler_seek_call.arguments = v4_read_handler_seek_arguments.data();
  v4_read_handler_seek_call.argument_count = v4_read_handler_seek_arguments.size();
  LB_CEF3_RESULT_V4 v4_read_handler_seek_result{};
  v4_read_handler_seek_result.struct_size = sizeof(v4_read_handler_seek_result);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_seek_call, &v4_read_handler_seek_result)
      == LB_CEF3_OK);
  assert(v4_read_handler_seek_result.integer_value == 0);
  LB_CEF3_ARGUMENT_V4 v4_read_handler_read_argument{};
  v4_read_handler_read_argument.struct_size = sizeof(v4_read_handler_read_argument);
  v4_read_handler_read_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_read_handler_read_argument.integer_value = 1;
  LB_CEF3_CALL_V4 v4_read_handler_read_call{};
  v4_read_handler_read_call.struct_size = sizeof(v4_read_handler_read_call);
  v4_read_handler_read_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_read_handler_read_call.operation_id = UINT64_C(0x03ec695dac2c9458);
  v4_read_handler_read_call.target = v4_read_handler;
  v4_read_handler_read_call.arguments = &v4_read_handler_read_argument;
  v4_read_handler_read_call.argument_count = 1;
  LB_CEF3_RESULT_V4 v4_read_handler_read_result{};
  v4_read_handler_read_result.struct_size = sizeof(v4_read_handler_read_result);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_read_call, &v4_read_handler_read_result)
      == LB_CEF3_OK);
  assert(v4_read_handler_read_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(v4_read_handler_read_result.buffer_value,
                             stream_hex.data(), stream_hex.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"66");
  assert(LB_CEF3_BufferRelease(v4_read_handler_read_result.buffer_value) == LB_CEF3_OK);
  v4_read_handler_no_argument_call.operation_id = UINT64_C(0x6a3284feac6d7db0);
  assert(LB_CEF3_InvokeV4(&v4_read_handler_no_argument_call,
                          &v4_read_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_read_handler_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(v4_read_handler_no_argument_result.integer_value == 1);
  assert(LB_CEF3_HandleRelease(v4_handler_stream_reader) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(v4_read_handler) == LB_CEF3_OK);

  const auto write_handler_source = LB_CEF3_BufferCreate(
      stream_source_text, sizeof(stream_source_text) - 1);
  assert(write_handler_source != 0);
  const auto write_handler = LB_CEF3_WriteHandlerCreate(0);
  assert(write_handler != 0);
  assert(LB_CEF3_HandleGetType(write_handler) == LB_CEF3_HANDLE_WRITE_HANDLER);
  assert(LB_CEF3_WriteHandlerMayBlock(write_handler) == 0);
  const auto handler_stream_writer = LB_CEF3_StreamWriterCreateForHandler(write_handler);
  assert(handler_stream_writer != 0);
  assert(LB_CEF3_HandleGetType(handler_stream_writer) == LB_CEF3_HANDLE_STREAM_WRITER);
  assert(LB_CEF3_StreamWriterWrite(handler_stream_writer, write_handler_source, 0, 3) == 3);
  assert(LB_CEF3_WriteHandlerTell(write_handler) == 3);
  assert(LB_CEF3_WriteHandlerSeek(write_handler, 1, LB_CEF3_STREAM_SEEK_BEGIN) == 0);
  assert(LB_CEF3_WriteHandlerWrite(write_handler, write_handler_source, 3, 1) == 1);
  assert(LB_CEF3_WriteHandlerTell(write_handler) == 2);
  assert(LB_CEF3_WriteHandlerFlush(write_handler) == 0);
  const auto write_handler_snapshot = LB_CEF3_WriteHandlerGetBuffer(write_handler);
  assert(write_handler_snapshot != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(write_handler_snapshot, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"616463");
  assert(LB_CEF3_WriteHandlerSeek(write_handler, 0, 7) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WriteHandlerWrite(write_handler, write_handler_source,
                                   sizeof(stream_source_text), 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BufferRelease(write_handler_snapshot) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(handler_stream_writer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(write_handler) == LB_CEF3_OK);

  const auto v4_write_handler = LB_CEF3_WriteHandlerCreate(1);
  assert(v4_write_handler != 0);
  LB_CEF3_ARGUMENT_V4 v4_write_handler_create_argument{};
  v4_write_handler_create_argument.struct_size = sizeof(v4_write_handler_create_argument);
  v4_write_handler_create_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  v4_write_handler_create_argument.handle_value = v4_write_handler;
  LB_CEF3_CALL_V4 v4_write_handler_create_call{};
  v4_write_handler_create_call.struct_size = sizeof(v4_write_handler_create_call);
  v4_write_handler_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_write_handler_create_call.operation_id = UINT64_C(0xd1cce6fe7438bd2a);
  v4_write_handler_create_call.arguments = &v4_write_handler_create_argument;
  v4_write_handler_create_call.argument_count = 1;
  LB_CEF3_RESULT_V4 v4_write_handler_create_result{};
  v4_write_handler_create_result.struct_size = sizeof(v4_write_handler_create_result);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_create_call, &v4_write_handler_create_result)
      == LB_CEF3_OK);
  assert(v4_write_handler_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v4_handler_stream_writer = v4_write_handler_create_result.handle_value;
  assert(v4_handler_stream_writer != 0);
  assert(LB_CEF3_StreamWriterWrite(v4_handler_stream_writer, write_handler_source, 0, 2) == 2);
  LB_CEF3_CALL_V4 v4_write_handler_no_argument_call{};
  v4_write_handler_no_argument_call.struct_size = sizeof(v4_write_handler_no_argument_call);
  v4_write_handler_no_argument_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_write_handler_no_argument_call.target = v4_write_handler;
  LB_CEF3_RESULT_V4 v4_write_handler_no_argument_result{};
  v4_write_handler_no_argument_result.struct_size = sizeof(v4_write_handler_no_argument_result);
  v4_write_handler_no_argument_call.operation_id = UINT64_C(0x2cfe66ec4578c60d);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_no_argument_call,
                          &v4_write_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_write_handler_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(v4_write_handler_no_argument_result.integer_value == 1);
  v4_write_handler_no_argument_call.operation_id = UINT64_C(0x33e3980eaf3159d3);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_no_argument_call,
                          &v4_write_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_write_handler_no_argument_result.integer_value == 2);
  std::array<LB_CEF3_ARGUMENT_V4, 2> v4_write_handler_seek_arguments{};
  v4_write_handler_seek_arguments[0].struct_size = sizeof(v4_write_handler_seek_arguments[0]);
  v4_write_handler_seek_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_write_handler_seek_arguments[0].integer_value = -1;
  v4_write_handler_seek_arguments[1].struct_size = sizeof(v4_write_handler_seek_arguments[1]);
  v4_write_handler_seek_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_write_handler_seek_arguments[1].integer_value = LB_CEF3_STREAM_SEEK_END;
  LB_CEF3_CALL_V4 v4_write_handler_seek_call{};
  v4_write_handler_seek_call.struct_size = sizeof(v4_write_handler_seek_call);
  v4_write_handler_seek_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_write_handler_seek_call.operation_id = UINT64_C(0xde89f6b0243c7900);
  v4_write_handler_seek_call.target = v4_write_handler;
  v4_write_handler_seek_call.arguments = v4_write_handler_seek_arguments.data();
  v4_write_handler_seek_call.argument_count = v4_write_handler_seek_arguments.size();
  LB_CEF3_RESULT_V4 v4_write_handler_seek_result{};
  v4_write_handler_seek_result.struct_size = sizeof(v4_write_handler_seek_result);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_seek_call, &v4_write_handler_seek_result)
      == LB_CEF3_OK);
  assert(v4_write_handler_seek_result.integer_value == 0);
  std::array<LB_CEF3_ARGUMENT_V4, 3> v4_write_handler_write_arguments{};
  v4_write_handler_write_arguments[0].struct_size = sizeof(v4_write_handler_write_arguments[0]);
  v4_write_handler_write_arguments[0].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  v4_write_handler_write_arguments[0].buffer_value = write_handler_source;
  v4_write_handler_write_arguments[1].struct_size = sizeof(v4_write_handler_write_arguments[1]);
  v4_write_handler_write_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_write_handler_write_arguments[1].integer_value = 3;
  v4_write_handler_write_arguments[2].struct_size = sizeof(v4_write_handler_write_arguments[2]);
  v4_write_handler_write_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v4_write_handler_write_arguments[2].integer_value = 1;
  LB_CEF3_CALL_V4 v4_write_handler_write_call{};
  v4_write_handler_write_call.struct_size = sizeof(v4_write_handler_write_call);
  v4_write_handler_write_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v4_write_handler_write_call.operation_id = UINT64_C(0xb7a7f3dea956b521);
  v4_write_handler_write_call.target = v4_write_handler;
  v4_write_handler_write_call.arguments = v4_write_handler_write_arguments.data();
  v4_write_handler_write_call.argument_count = v4_write_handler_write_arguments.size();
  LB_CEF3_RESULT_V4 v4_write_handler_write_result{};
  v4_write_handler_write_result.struct_size = sizeof(v4_write_handler_write_result);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_write_call, &v4_write_handler_write_result)
      == LB_CEF3_OK);
  assert(v4_write_handler_write_result.integer_value == 1);
  v4_write_handler_no_argument_call.operation_id = UINT64_C(0x13dd3c5da841f441);
  assert(LB_CEF3_InvokeV4(&v4_write_handler_no_argument_call,
                          &v4_write_handler_no_argument_result) == LB_CEF3_OK);
  assert(v4_write_handler_no_argument_result.integer_value == 0);
  const auto v4_write_handler_snapshot = LB_CEF3_WriteHandlerGetBuffer(v4_write_handler);
  assert(v4_write_handler_snapshot != 0);
  stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(v4_write_handler_snapshot, stream_hex.data(), stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(stream_hex.data()) == L"6164");
  assert(LB_CEF3_BufferRelease(v4_write_handler_snapshot) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(v4_handler_stream_writer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(v4_write_handler) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(write_handler_source) == LB_CEF3_OK);

  std::array<wchar_t, 256> security_url{};
  assert(LB_CEF3_FormatUrlForSecurityDisplay(L"https://user:pass@example.com/path",
                                              security_url.data(), security_url.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(security_url.data()).find(L"example.com") != std::wstring::npos);
  LB_CEF3_ARGUMENT_V4 security_url_argument{};
  security_url_argument.struct_size = sizeof(security_url_argument);
  security_url_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  security_url_argument.text_value = L"https://user:pass@example.com/path";
  LB_CEF3_CALL_V4 security_url_call{};
  security_url_call.struct_size = sizeof(security_url_call);
  security_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  security_url_call.operation_id = UINT64_C(0xf92a6fa638a15d5d);
  security_url_call.arguments = &security_url_argument;
  security_url_call.argument_count = 1;
  LB_CEF3_RESULT_V4 security_url_result{};
  security_url_result.struct_size = sizeof(security_url_result);
  assert(LB_CEF3_InvokeV4(&security_url_call, &security_url_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring security_url_v4(security_url_result.text_required, L'\0');
  security_url_result.text = security_url_v4.data();
  security_url_result.text_capacity = security_url_v4.size();
  assert(LB_CEF3_InvokeV4(&security_url_call, &security_url_result) == LB_CEF3_OK);
  assert(security_url_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  security_url_v4.resize(wcslen(security_url_v4.c_str()));
  assert(security_url_v4.find(L"example.com") != std::wstring::npos);
  std::array<wchar_t, 256> uri_encoded{};
  assert(LB_CEF3_UriEncode(L"hello world+test", 1, uri_encoded.data(), uri_encoded.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(uri_encoded.data()) == L"hello+world%2Btest");
  LB_CEF3_ARGUMENT_V4 uri_encode_arguments[2]{};
  uri_encode_arguments[0].struct_size = sizeof(uri_encode_arguments[0]);
  uri_encode_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  uri_encode_arguments[0].text_value = L"hello world+test";
  uri_encode_arguments[1].struct_size = sizeof(uri_encode_arguments[1]);
  uri_encode_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  uri_encode_arguments[1].integer_value = 1;
  LB_CEF3_CALL_V4 uri_encode_call{};
  uri_encode_call.struct_size = sizeof(uri_encode_call);
  uri_encode_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  uri_encode_call.operation_id = UINT64_C(0xc1c9cd07c6ab7bd0);
  uri_encode_call.arguments = uri_encode_arguments;
  uri_encode_call.argument_count = 2;
  LB_CEF3_RESULT_V4 uri_encode_result{};
  uri_encode_result.struct_size = sizeof(uri_encode_result);
  assert(LB_CEF3_InvokeV4(&uri_encode_call, &uri_encode_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring uri_encoded_v4(uri_encode_result.text_required, L'\0');
  uri_encode_result.text = uri_encoded_v4.data();
  uri_encode_result.text_capacity = uri_encoded_v4.size();
  assert(LB_CEF3_InvokeV4(&uri_encode_call, &uri_encode_result) == LB_CEF3_OK);
  assert(uri_encode_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  uri_encoded_v4.resize(wcslen(uri_encoded_v4.c_str()));
  assert(uri_encoded_v4 == L"hello+world%2Btest");
  constexpr int uri_unescape_rules = 1 | 2 | 8 | 16;
  std::array<wchar_t, 256> uri_decoded{};
  assert(LB_CEF3_UriDecode(L"hello+world%2Btest", 0, uri_unescape_rules,
                           uri_decoded.data(), uri_decoded.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(uri_decoded.data()) == L"hello world+test");
  LB_CEF3_ARGUMENT_V4 uri_decode_arguments[3]{};
  uri_decode_arguments[0].struct_size = sizeof(uri_decode_arguments[0]);
  uri_decode_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  uri_decode_arguments[0].text_value = L"hello+world%2Btest";
  uri_decode_arguments[1].struct_size = sizeof(uri_decode_arguments[1]);
  uri_decode_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  uri_decode_arguments[1].integer_value = 0;
  uri_decode_arguments[2].struct_size = sizeof(uri_decode_arguments[2]);
  uri_decode_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  uri_decode_arguments[2].integer_value = uri_unescape_rules;
  LB_CEF3_CALL_V4 uri_decode_call{};
  uri_decode_call.struct_size = sizeof(uri_decode_call);
  uri_decode_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  uri_decode_call.operation_id = UINT64_C(0xab0ab8a7d6377da0);
  uri_decode_call.arguments = uri_decode_arguments;
  uri_decode_call.argument_count = 3;
  LB_CEF3_RESULT_V4 uri_decode_result{};
  uri_decode_result.struct_size = sizeof(uri_decode_result);
  assert(LB_CEF3_InvokeV4(&uri_decode_call, &uri_decode_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring uri_decoded_v4(uri_decode_result.text_required, L'\0');
  uri_decode_result.text = uri_decoded_v4.data();
  uri_decode_result.text_capacity = uri_decoded_v4.size();
  assert(LB_CEF3_InvokeV4(&uri_decode_call, &uri_decode_result) == LB_CEF3_OK);
  assert(uri_decode_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  uri_decoded_v4.resize(wcslen(uri_decoded_v4.c_str()));
  assert(uri_decoded_v4 == L"hello world+test");
  const auto parsed_json = LB_CEF3_ParseJson(L"{\"ok\":true,\"count\":2}", 0);
  assert(parsed_json != 0);
  assert(LB_CEF3_HandleGetType(parsed_json) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_ValueGetType(parsed_json) == LB_CEF3_VALUE_DICTIONARY);
  const auto parsed_json_dictionary = LB_CEF3_ValueGetDictionary(parsed_json);
  assert(parsed_json_dictionary != 0);
  const auto parsed_json_ok = LB_CEF3_DictionaryGetValue(parsed_json_dictionary, L"ok");
  assert(parsed_json_ok != 0);
  assert(LB_CEF3_ValueGetBool(parsed_json_ok) == 1);
  assert(LB_CEF3_ValueRelease(parsed_json_ok) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(parsed_json_dictionary) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 parse_json_arguments[2]{};
  parse_json_arguments[0].struct_size = sizeof(parse_json_arguments[0]);
  parse_json_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  parse_json_arguments[0].text_value = L"{\"name\":\"cef3\"}";
  parse_json_arguments[1].struct_size = sizeof(parse_json_arguments[1]);
  parse_json_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  parse_json_arguments[1].integer_value = 0;
  LB_CEF3_CALL_V4 parse_json_call{};
  parse_json_call.struct_size = sizeof(parse_json_call);
  parse_json_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  parse_json_call.operation_id = UINT64_C(0xb2b432bfcb39d0c2);
  parse_json_call.arguments = parse_json_arguments;
  parse_json_call.argument_count = 2;
  LB_CEF3_RESULT_V4 parse_json_result{};
  parse_json_result.struct_size = sizeof(parse_json_result);
  assert(LB_CEF3_InvokeV4(&parse_json_call, &parse_json_result) == LB_CEF3_OK);
  assert(parse_json_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(parse_json_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(parse_json_result.handle_value) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_HandleRelease(parse_json_result.handle_value) == LB_CEF3_OK);
  std::array<wchar_t, 256> written_json{};
  assert(LB_CEF3_WriteJson(parsed_json, 0, written_json.data(), written_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(written_json.data()).find(L"\"ok\":true") != std::wstring::npos);
  LB_CEF3_ARGUMENT_V4 write_json_arguments[2]{};
  write_json_arguments[0].struct_size = sizeof(write_json_arguments[0]);
  write_json_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  write_json_arguments[0].handle_value = parsed_json;
  write_json_arguments[1].struct_size = sizeof(write_json_arguments[1]);
  write_json_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  write_json_arguments[1].integer_value = 0;
  LB_CEF3_CALL_V4 write_json_call{};
  write_json_call.struct_size = sizeof(write_json_call);
  write_json_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  write_json_call.operation_id = UINT64_C(0x8eb2cf7ff75ef0fb);
  write_json_call.arguments = write_json_arguments;
  write_json_call.argument_count = 2;
  LB_CEF3_RESULT_V4 write_json_result{};
  write_json_result.struct_size = sizeof(write_json_result);
  assert(LB_CEF3_InvokeV4(&write_json_call, &write_json_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring written_json_v4(write_json_result.text_required, L'\0');
  write_json_result.text = written_json_v4.data();
  write_json_result.text_capacity = written_json_v4.size();
  assert(LB_CEF3_InvokeV4(&write_json_call, &write_json_result) == LB_CEF3_OK);
  assert(write_json_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  written_json_v4.resize(wcslen(written_json_v4.c_str()));
  assert(written_json_v4.find(L"\"ok\":true") != std::wstring::npos);
  assert(LB_CEF3_AddCrossOriginWhitelistEntry(L"https://source.example", L"https",
                                               L"target.example", 1) == 1);
  LB_CEF3_ARGUMENT_V4 whitelist_arguments[4]{};
  whitelist_arguments[0].struct_size = sizeof(whitelist_arguments[0]);
  whitelist_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  whitelist_arguments[0].text_value = L"https://source-v4.example";
  whitelist_arguments[1].struct_size = sizeof(whitelist_arguments[1]);
  whitelist_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  whitelist_arguments[1].text_value = L"https";
  whitelist_arguments[2].struct_size = sizeof(whitelist_arguments[2]);
  whitelist_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
  whitelist_arguments[2].text_value = L"target-v4.example";
  whitelist_arguments[3].struct_size = sizeof(whitelist_arguments[3]);
  whitelist_arguments[3].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  whitelist_arguments[3].integer_value = 0;
  LB_CEF3_CALL_V4 whitelist_add_call{};
  whitelist_add_call.struct_size = sizeof(whitelist_add_call);
  whitelist_add_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  whitelist_add_call.operation_id = UINT64_C(0x6a719773303f31bc);
  whitelist_add_call.arguments = whitelist_arguments;
  whitelist_add_call.argument_count = 4;
  LB_CEF3_RESULT_V4 whitelist_add_result{};
  whitelist_add_result.struct_size = sizeof(whitelist_add_result);
  assert(LB_CEF3_InvokeV4(&whitelist_add_call, &whitelist_add_result) == LB_CEF3_OK);
  assert(whitelist_add_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(whitelist_add_result.integer_value == 1);
  assert(LB_CEF3_RemoveCrossOriginWhitelistEntry(L"https://source.example", L"https",
                                                  L"target.example", 1) == 1);
  LB_CEF3_CALL_V4 whitelist_remove_call = whitelist_add_call;
  whitelist_remove_call.operation_id = UINT64_C(0xea5b6bed15491008);
  LB_CEF3_RESULT_V4 whitelist_remove_result{};
  whitelist_remove_result.struct_size = sizeof(whitelist_remove_result);
  assert(LB_CEF3_InvokeV4(&whitelist_remove_call, &whitelist_remove_result) == LB_CEF3_OK);
  assert(whitelist_remove_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(whitelist_remove_result.integer_value == 1);
  assert(LB_CEF3_ClearCrossOriginWhitelist() == 1);
  LB_CEF3_CALL_V4 whitelist_clear_call{};
  whitelist_clear_call.struct_size = sizeof(whitelist_clear_call);
  whitelist_clear_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  whitelist_clear_call.operation_id = UINT64_C(0xa933eb71d51f6d02);
  LB_CEF3_RESULT_V4 whitelist_clear_result{};
  whitelist_clear_result.struct_size = sizeof(whitelist_clear_result);
  assert(LB_CEF3_InvokeV4(&whitelist_clear_call, &whitelist_clear_result) == LB_CEF3_OK);
  assert(whitelist_clear_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(whitelist_clear_result.integer_value == 1);
  assert(LB_CEF3_ValueRelease(parsed_json) == LB_CEF3_OK);
  const char json_buffer_text[] = "{\"buffer\":true}";
  const auto json_buffer = LB_CEF3_BufferCreate(json_buffer_text, sizeof(json_buffer_text) - 1);
  assert(json_buffer != 0);
  const auto parsed_json_buffer = LB_CEF3_ParseJsonBuffer(json_buffer, sizeof(json_buffer_text) - 1, 0);
  assert(parsed_json_buffer != 0);
  assert(LB_CEF3_ValueGetType(parsed_json_buffer) == LB_CEF3_VALUE_DICTIONARY);
  assert(LB_CEF3_ValueRelease(parsed_json_buffer) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 parse_json_buffer_arguments[3]{};
  parse_json_buffer_arguments[0].struct_size = sizeof(parse_json_buffer_arguments[0]);
  parse_json_buffer_arguments[0].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  parse_json_buffer_arguments[0].buffer_value = json_buffer;
  parse_json_buffer_arguments[1].struct_size = sizeof(parse_json_buffer_arguments[1]);
  parse_json_buffer_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  parse_json_buffer_arguments[1].integer_value = sizeof(json_buffer_text) - 1;
  parse_json_buffer_arguments[2].struct_size = sizeof(parse_json_buffer_arguments[2]);
  parse_json_buffer_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  parse_json_buffer_arguments[2].integer_value = 0;
  LB_CEF3_CALL_V4 parse_json_buffer_call{};
  parse_json_buffer_call.struct_size = sizeof(parse_json_buffer_call);
  parse_json_buffer_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  parse_json_buffer_call.operation_id = UINT64_C(0x57a7b8b5bc6f0bad);
  parse_json_buffer_call.arguments = parse_json_buffer_arguments;
  parse_json_buffer_call.argument_count = 3;
  LB_CEF3_RESULT_V4 parse_json_buffer_result{};
  parse_json_buffer_result.struct_size = sizeof(parse_json_buffer_result);
  assert(LB_CEF3_InvokeV4(&parse_json_buffer_call, &parse_json_buffer_result) == LB_CEF3_OK);
  assert(parse_json_buffer_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(parse_json_buffer_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(parse_json_buffer_result.handle_value) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_HandleRelease(parse_json_buffer_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(json_buffer) == LB_CEF3_OK);
  std::array<wchar_t, 512> json_error{};
  size_t json_error_required = 0;
  assert(LB_CEF3_ParseJsonAndReturnError(L"{\"broken\":", 0,
                                         json_error.data(), json_error.size(), &json_error_required) == 0);
  assert(json_error_required > 1);
  assert(json_error[0] != L'\0');
  LB_CEF3_ARGUMENT_V4 parse_json_error_arguments[2]{};
  parse_json_error_arguments[0].struct_size = sizeof(parse_json_error_arguments[0]);
  parse_json_error_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  parse_json_error_arguments[0].text_value = L"{\"valid\":true}";
  parse_json_error_arguments[1].struct_size = sizeof(parse_json_error_arguments[1]);
  parse_json_error_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  parse_json_error_arguments[1].integer_value = 0;
  LB_CEF3_CALL_V4 parse_json_error_call{};
  parse_json_error_call.struct_size = sizeof(parse_json_error_call);
  parse_json_error_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  parse_json_error_call.operation_id = UINT64_C(0xa82adb7592678591);
  parse_json_error_call.arguments = parse_json_error_arguments;
  parse_json_error_call.argument_count = 2;
  LB_CEF3_RESULT_V4 parse_json_error_result{};
  parse_json_error_result.struct_size = sizeof(parse_json_error_result);
  assert(LB_CEF3_InvokeV4(&parse_json_error_call, &parse_json_error_result) == LB_CEF3_OK);
  assert(parse_json_error_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(parse_json_error_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(parse_json_error_result.handle_value) == LB_CEF3_HANDLE_VALUE);
  assert(LB_CEF3_HandleRelease(parse_json_error_result.handle_value) == LB_CEF3_OK);
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
  assert(LB_CEF3_StreamReaderCreateForFile(nullptr) == 0);
  assert(LB_CEF3_StreamReaderCreateForFile((root.parent_path() / L"denied.bin").c_str()) == 0);
  const auto file_stream_reader = LB_CEF3_StreamReaderCreateForFile(file.c_str());
  assert(file_stream_reader != 0);
  assert(LB_CEF3_HandleGetType(file_stream_reader) == LB_CEF3_HANDLE_STREAM);
  assert(LB_CEF3_StreamReaderMayBlock(file_stream_reader) == 1);
  const auto file_stream_chunk = LB_CEF3_StreamReaderRead(file_stream_reader, sizeof(input));
  assert(file_stream_chunk != 0);
  std::array<wchar_t, 16> file_stream_hex{};
  assert(LB_CEF3_BufferToHex(file_stream_chunk, file_stream_hex.data(), file_stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(file_stream_hex.data()) == L"007fff");
  assert(LB_CEF3_HandleRelease(file_stream_reader) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(file_stream_chunk) == LB_CEF3_OK);

  std::wstring file_stream_path = file.wstring();
  LB_CEF3_ARGUMENT_V4 file_stream_create_argument{};
  file_stream_create_argument.struct_size = sizeof(file_stream_create_argument);
  file_stream_create_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  LB_CEF3_CALL_V4 file_stream_create_call{};
  file_stream_create_call.struct_size = sizeof(file_stream_create_call);
  file_stream_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  file_stream_create_call.operation_id = UINT64_C(0xabd1384fedf4e1be);
  file_stream_create_call.arguments = &file_stream_create_argument;
  file_stream_create_call.argument_count = 1;
  LB_CEF3_RESULT_V4 file_stream_create_result{};
  file_stream_create_result.struct_size = sizeof(file_stream_create_result);
  assert(LB_CEF3_InvokeV4(&file_stream_create_call, &file_stream_create_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  file_stream_create_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  file_stream_create_argument.text_value = file_stream_path.c_str();
  assert(LB_CEF3_InvokeV4(&file_stream_create_call, &file_stream_create_result) == LB_CEF3_OK);
  assert(file_stream_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(file_stream_create_result.handle_value != 0);
  assert(LB_CEF3_StreamReaderMayBlock(file_stream_create_result.handle_value) == 1);
  assert(LB_CEF3_HandleRelease(file_stream_create_result.handle_value) == LB_CEF3_OK);

  const auto writer_file = root / L"writer.bin";
  assert(LB_CEF3_StreamWriterCreateForFile(nullptr) == 0);
  assert(LB_CEF3_StreamWriterCreateForFile((root.parent_path() / L"denied-writer.bin").c_str()) == 0);
  const auto stream_writer = LB_CEF3_StreamWriterCreateForFile(writer_file.c_str());
  assert(stream_writer != 0);
  assert(LB_CEF3_HandleGetType(stream_writer) == LB_CEF3_HANDLE_STREAM_WRITER);
  assert(LB_CEF3_StreamWriterMayBlock(stream_writer) == 1);
  assert(LB_CEF3_StreamWriterWrite(stream_writer, second, 0, sizeof(input)) == sizeof(input));
  assert(LB_CEF3_StreamWriterTell(stream_writer) == sizeof(input));
  assert(LB_CEF3_StreamWriterSeek(stream_writer, 1, LB_CEF3_STREAM_SEEK_BEGIN) == 0);
  assert(LB_CEF3_StreamWriterWrite(stream_writer, second, 1, 1) == 1);
  assert(LB_CEF3_StreamWriterTell(stream_writer) == 2);
  assert(LB_CEF3_StreamWriterSeek(stream_writer, 0, 7) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_StreamWriterWrite(stream_writer, second, sizeof(input), 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_StreamWriterFlush(stream_writer) == 0);
  assert(LB_CEF3_HandleRelease(stream_writer) == LB_CEF3_OK);
  const auto writer_reader = LB_CEF3_StreamReaderCreateForFile(writer_file.c_str());
  assert(writer_reader != 0);
  const auto writer_file_chunk = LB_CEF3_StreamReaderRead(writer_reader, sizeof(input));
  assert(writer_file_chunk != 0);
  file_stream_hex.fill(L'\0');
  assert(LB_CEF3_BufferToHex(writer_file_chunk, file_stream_hex.data(), file_stream_hex.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(file_stream_hex.data()) == L"007fff");
  assert(LB_CEF3_BufferRelease(writer_file_chunk) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(writer_reader) == LB_CEF3_OK);

  std::wstring writer_file_path = writer_file.wstring();
  LB_CEF3_ARGUMENT_V4 writer_create_argument{};
  writer_create_argument.struct_size = sizeof(writer_create_argument);
  writer_create_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  LB_CEF3_CALL_V4 writer_create_call{};
  writer_create_call.struct_size = sizeof(writer_create_call);
  writer_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  writer_create_call.operation_id = UINT64_C(0x1f86de882b4120a1);
  writer_create_call.arguments = &writer_create_argument;
  writer_create_call.argument_count = 1;
  LB_CEF3_RESULT_V4 writer_create_result{};
  writer_create_result.struct_size = sizeof(writer_create_result);
  assert(LB_CEF3_InvokeV4(&writer_create_call, &writer_create_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  writer_create_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  writer_create_argument.text_value = writer_file_path.c_str();
  assert(LB_CEF3_InvokeV4(&writer_create_call, &writer_create_result) == LB_CEF3_OK);
  assert(writer_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v4_stream_writer = writer_create_result.handle_value;
  assert(v4_stream_writer != 0);
  assert(LB_CEF3_HandleGetType(v4_stream_writer) == LB_CEF3_HANDLE_STREAM_WRITER);

  std::array<LB_CEF3_ARGUMENT_V4, 3> writer_write_arguments{};
  for (auto& argument : writer_write_arguments) argument.struct_size = sizeof(argument);
  writer_write_arguments[0].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  writer_write_arguments[0].buffer_value = second;
  writer_write_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  writer_write_arguments[1].integer_value = 0;
  writer_write_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  writer_write_arguments[2].integer_value = sizeof(input);
  LB_CEF3_CALL_V4 writer_write_call{};
  writer_write_call.struct_size = sizeof(writer_write_call);
  writer_write_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  writer_write_call.operation_id = UINT64_C(0xde8856cc215a8018);
  writer_write_call.target = v4_stream_writer;
  writer_write_call.arguments = writer_write_arguments.data();
  writer_write_call.argument_count = writer_write_arguments.size();
  LB_CEF3_RESULT_V4 writer_write_result{};
  writer_write_result.struct_size = sizeof(writer_write_result);
  assert(LB_CEF3_InvokeV4(&writer_write_call, &writer_write_result) == LB_CEF3_OK);
  assert(writer_write_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(writer_write_result.integer_value == sizeof(input));

  LB_CEF3_CALL_V4 writer_no_argument_call{};
  writer_no_argument_call.struct_size = sizeof(writer_no_argument_call);
  writer_no_argument_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  writer_no_argument_call.target = v4_stream_writer;
  LB_CEF3_RESULT_V4 writer_no_argument_result{};
  writer_no_argument_result.struct_size = sizeof(writer_no_argument_result);
  writer_no_argument_call.operation_id = UINT64_C(0x4759c616fe321daf);
  assert(LB_CEF3_InvokeV4(&writer_no_argument_call, &writer_no_argument_result) == LB_CEF3_OK);
  assert(writer_no_argument_result.integer_value == sizeof(input));
  writer_no_argument_call.operation_id = UINT64_C(0x70f149cdb3d640f0);
  assert(LB_CEF3_InvokeV4(&writer_no_argument_call, &writer_no_argument_result) == LB_CEF3_OK);
  assert(writer_no_argument_result.integer_value == 0);
  writer_no_argument_call.operation_id = UINT64_C(0xcd50d7f5e7b6e2c7);
  assert(LB_CEF3_InvokeV4(&writer_no_argument_call, &writer_no_argument_result) == LB_CEF3_OK);
  assert(writer_no_argument_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(writer_no_argument_result.integer_value == 1);

  std::array<LB_CEF3_ARGUMENT_V4, 2> writer_seek_arguments{};
  for (auto& argument : writer_seek_arguments) argument.struct_size = sizeof(argument);
  writer_seek_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  writer_seek_arguments[0].integer_value = 0;
  writer_seek_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  writer_seek_arguments[1].integer_value = LB_CEF3_STREAM_SEEK_BEGIN;
  LB_CEF3_CALL_V4 writer_seek_call{};
  writer_seek_call.struct_size = sizeof(writer_seek_call);
  writer_seek_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  writer_seek_call.operation_id = UINT64_C(0x7983dac4710fecb7);
  writer_seek_call.target = v4_stream_writer;
  writer_seek_call.arguments = writer_seek_arguments.data();
  writer_seek_call.argument_count = writer_seek_arguments.size();
  LB_CEF3_RESULT_V4 writer_seek_result{};
  writer_seek_result.struct_size = sizeof(writer_seek_result);
  assert(LB_CEF3_InvokeV4(&writer_seek_call, &writer_seek_result) == LB_CEF3_OK);
  assert(writer_seek_result.integer_value == 0);
  assert(LB_CEF3_HandleRelease(v4_stream_writer) == LB_CEF3_OK);
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
  const auto execute_task = LB_CEF3_TaskCreate();
  assert(execute_task != 0);
  assert(LB_CEF3_TaskExecute(execute_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskGetStatus(execute_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(execute_task).find(L"executed") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(execute_task) == LB_CEF3_OK);
  const auto execute_v4_task = LB_CEF3_TaskCreate();
  assert(execute_v4_task != 0);
  LB_CEF3_ARGUMENT_V4 execute_argument{};
  execute_argument.struct_size = sizeof(execute_argument);
  execute_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  execute_argument.handle_value = execute_v4_task;
  LB_CEF3_CALL_V4 execute_call{};
  execute_call.struct_size = sizeof(execute_call);
  execute_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  execute_call.operation_id = UINT64_C(0xf72f01295318d9ef);
  execute_call.arguments = &execute_argument;
  execute_call.argument_count = 1;
  LB_CEF3_RESULT_V4 execute_result{};
  execute_result.struct_size = sizeof(execute_result);
  assert(LB_CEF3_InvokeV4(&execute_call, &execute_result) == LB_CEF3_OK);
  assert(execute_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(execute_result.integer_value == LB_CEF3_OK);
  assert(LB_CEF3_TaskGetStatus(execute_v4_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(execute_v4_task) == LB_CEF3_OK);

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
  browser_config_a.flags = LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_DEVTOOLS;
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
  int expected_browser_closed_events = 2;
  const auto browser_deadline = GetTickCount64() + 30000;
  while (g_browser_created_events.load() < 2 && GetTickCount64() < browser_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_created_events.load() >= 2);
  const auto initial_load_deadline = GetTickCount64() + 15000;
  while ((g_loading_state_events.load() < 2 || g_load_start_events.load() < 2
          || g_load_end_events.load() < 2) && GetTickCount64() < initial_load_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_loading_state_events.load() >= 2);
  assert(g_load_start_events.load() >= 2);
  assert(g_load_end_events.load() >= 2);
  assert(LB_CEF3_SetEventCallbackV4(
             browser_b, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  using RenderProcessSubscription = int (LB_CEF3_CALL *)(
      LB_CEF3_HANDLE, int);
  const std::array<RenderProcessSubscription, 3> render_process_subscriptions = {
      LB_CEF3_RenderProcessHandlerSubscribeFocusedNodeChanged,
      LB_CEF3_RenderProcessHandlerSubscribeUncaughtException,
      LB_CEF3_RenderProcessHandlerSubscribeWebKitInitialized};
  const std::array<uint64_t, 3> render_process_operation_ids = {
      UINT64_C(0xf4084ca9d840b953), UINT64_C(0xde64f6cc11240149),
      UINT64_C(0xd2442ca04f10291d)};
  for (size_t index = 0; index < render_process_subscriptions.size(); ++index) {
    assert(render_process_subscriptions[index](browser_b, 1) == LB_CEF3_OK);
    assert(render_process_subscriptions[index](browser_b, 2)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
    LB_CEF3_ARGUMENT_V4 enabled{};
    enabled.struct_size = sizeof(enabled);
    enabled.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    enabled.integer_value = 1;
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = render_process_operation_ids[index];
    call.target = browser_b;
    call.arguments = &enabled;
    call.argument_count = 1;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
    enabled.value_kind = LB_CEF3_VALUE_V4_INTEGER;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }
  const int webkit_events_before =
      g_v4_render_webkit_initialized_events.load();
  const int focused_node_events_before = g_v4_render_focused_node_events.load();
  const int uncaught_exception_events_before =
      g_v4_render_uncaught_exception_events.load();
  assert(LB_CEF3_RenderProcessHandlerSubscribeWebKitInitialized(
             browser_b, 1) == LB_CEF3_OK);
  const auto render_process_callback_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_b,
      L"(()=>{const input=document.createElement('input');"
      L"input.id='bridge-render-focus';document.body.appendChild(input);"
      L"input.focus();setTimeout(()=>{throw new Error('bridge-render-uncaught');},0);"
      L"return input.id;})()");
  assert(render_process_callback_task != 0);
  assert(WaitTask(render_process_callback_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(render_process_callback_task) == LB_CEF3_OK);
  const auto render_process_callback_deadline = GetTickCount64() + 15000;
  while ((g_v4_render_webkit_initialized_events.load() <= webkit_events_before
          || g_v4_render_focused_node_events.load() <= focused_node_events_before
          || g_v4_render_uncaught_exception_events.load()
              <= uncaught_exception_events_before)
      && GetTickCount64() < render_process_callback_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_render_webkit_initialized_events.load() > webkit_events_before);
  assert(g_v4_render_focused_node_events.load() > focused_node_events_before);
  assert(g_v4_render_uncaught_exception_events.load()
      > uncaught_exception_events_before);

  const auto dom_setup_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_b,
      L"(()=>{document.title='dom-bridge-title';"
      L"document.head.insertAdjacentHTML('beforeend','<base href=\"https://dom.lingbuilder.test/base/\">');"
      L"document.body.innerHTML='<section id=\"dom-root\" data-test=\"alpha\">"
      L"<input id=\"dom-editor\" value=\"before\"><span id=\"dom-text\">"
      L"selected text</span><p id=\"dom-last\">tail</p></section>';"
      L"document.getElementById('dom-editor').focus();"
      L"const range=document.createRange();const text=document.getElementById('dom-text').firstChild;"
      L"range.selectNodeContents(text);const selection=getSelection();"
      L"selection.removeAllRanges();selection.addRange(range);return 'dom-ready';})()" );
  assert(dom_setup_task != 0);
  assert(WaitTask(dom_setup_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_setup_task).find(L"dom-ready") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(dom_setup_task) == LB_CEF3_OK);

  LB_CEF3_HANDLE dom_frame = 0;
  assert(LB_CEF3_BrowserGetFocusedFrame(browser_b, &dom_frame) == LB_CEF3_OK);
  assert(dom_frame != 0);
  assert(LB_CEF3_HandleGetType(dom_frame) == LB_CEF3_HANDLE_FRAME);

  // V8 objects are renderer leases. Exercise direct C ABI and V4 dispatch,
  // including typed handles and managed key lists.
  const auto v8_context_task = LB_CEF3_FrameGetV8Context(dom_frame);
  assert(v8_context_task != 0);
  assert(WaitTask(v8_context_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_context = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_context_task, LB_CEF3_HANDLE_V8_CONTEXT, &v8_context)
      == LB_CEF3_OK);
  assert(v8_context != 0);
  assert(LB_CEF3_HandleGetType(v8_context) == LB_CEF3_HANDLE_V8_CONTEXT);
  assert(LB_CEF3_TaskRelease(v8_context_task) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 v8_call{};
  v8_call.struct_size = sizeof(v8_call);
  v8_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v8_call.target = dom_frame;
  v8_call.operation_id = UINT64_C(0x9894f0fa2f24afaa);
  LB_CEF3_RESULT_V4 v8_result{};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  assert(v8_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v8_context_v4_task = v8_result.handle_value;
  assert(WaitTask(v8_context_v4_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_context_v4 = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_context_v4_task, LB_CEF3_HANDLE_V8_CONTEXT, &v8_context_v4)
      == LB_CEF3_OK);
  assert(v8_context_v4 != 0);
  assert(LB_CEF3_HandleRelease(v8_context_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(v8_context_v4_task) == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 v8_argument{};
  v8_argument.struct_size = sizeof(v8_argument);
  v8_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v8_argument.integer_value = 42;
  v8_call.target = v8_context;
  v8_call.arguments = &v8_argument;
  v8_call.argument_count = 1;
  v8_call.operation_id = UINT64_C(0x07d59ef6fcc22441);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_int_task = v8_result.handle_value;
  assert(WaitTask(v8_int_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_int = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_int_task, LB_CEF3_HANDLE_V8_VALUE, &v8_int) == LB_CEF3_OK);
  assert(v8_int != 0);
  assert(LB_CEF3_TaskRelease(v8_int_task) == LB_CEF3_OK);

  v8_call.target = v8_int;
  v8_call.arguments = nullptr;
  v8_call.argument_count = 0;
  v8_call.operation_id = UINT64_C(0xbcfceccd67e8118a);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_get_int_task = v8_result.handle_value;
  assert(WaitTask(v8_get_int_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(v8_get_int_task).find(L"\"value\":42") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(v8_get_int_task) == LB_CEF3_OK);

  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"answer";
  v8_call.target = v8_context;
  v8_call.arguments = &v8_argument;
  v8_call.argument_count = 1;
  v8_call.operation_id = UINT64_C(0x29b658dc1fbfdb0e);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_string_task = v8_result.handle_value;
  assert(WaitTask(v8_string_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_string = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_string_task, LB_CEF3_HANDLE_V8_VALUE, &v8_string) == LB_CEF3_OK);
  assert(v8_string != 0);
  assert(LB_CEF3_TaskRelease(v8_string_task) == LB_CEF3_OK);

  v8_call.target = v8_context;
  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"({answer: 7})";
  LB_CEF3_ARGUMENT_V4 eval_arguments[3]{};
  eval_arguments[0] = v8_argument;
  eval_arguments[1].struct_size = sizeof(eval_arguments[1]);
  eval_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  eval_arguments[1].text_value = L"lingbuilder://v8-eval";
  eval_arguments[2].struct_size = sizeof(eval_arguments[2]);
  eval_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  eval_arguments[2].integer_value = 1;
  v8_call.arguments = eval_arguments;
  v8_call.argument_count = 3;
  v8_call.operation_id = UINT64_C(0xff721f224917f962);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_eval_task = v8_result.handle_value;
  assert(WaitTask(v8_eval_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_eval_value = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_eval_task, LB_CEF3_HANDLE_V8_VALUE, &v8_eval_value) == LB_CEF3_OK);
  assert(v8_eval_value != 0);
  assert(LB_CEF3_TaskRelease(v8_eval_task) == LB_CEF3_OK);

  v8_argument.struct_size = sizeof(v8_argument);
  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"answer";
  LB_CEF3_ARGUMENT_V4 set_arguments[3]{};
  set_arguments[0] = v8_argument;
  set_arguments[1].struct_size = sizeof(set_arguments[1]);
  set_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  set_arguments[1].handle_value = v8_string;
  set_arguments[2].struct_size = sizeof(set_arguments[2]);
  set_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  set_arguments[2].integer_value = 0;
  v8_call.target = v8_eval_value;
  v8_call.arguments = set_arguments;
  v8_call.argument_count = 3;
  v8_call.operation_id = UINT64_C(0x1f91ced879e0c8ff);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_set_task = v8_result.handle_value;
  assert(WaitTask(v8_set_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(v8_set_task) == LB_CEF3_OK);

  v8_call.target = v8_eval_value;
  v8_call.arguments = nullptr;
  v8_call.argument_count = 0;
  v8_call.operation_id = UINT64_C(0xba9a2269d1c3526b);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_keys_task = v8_result.handle_value;
  assert(WaitTask(v8_keys_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_keys = 0;
  assert(LB_CEF3_TaskTakeV8ListResult(v8_keys_task, &v8_keys) == LB_CEF3_OK);
  assert(v8_keys != 0 && LB_CEF3_HandleGetType(v8_keys) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(v8_keys) >= 0);
  assert(LB_CEF3_TaskRelease(v8_keys_task) == LB_CEF3_OK);

  for (const auto handle : {v8_keys, v8_eval_value, v8_string, v8_int, v8_context}) {
    assert(LB_CEF3_HandleRelease(handle) == LB_CEF3_OK);
  }
  const auto dom_visit_task = LB_CEF3_FrameVisitDom(dom_frame);
  assert(dom_visit_task != 0);
  assert(WaitTask(dom_visit_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_visit_task).find(L"nodeCount") != std::wstring::npos);
  LB_CEF3_HANDLE dom_document = 0;
  assert(LB_CEF3_TaskTakeDomDocumentResult(dom_visit_task, &dom_document)
      == LB_CEF3_OK);
  assert(dom_document != 0);
  assert(LB_CEF3_HandleGetType(dom_document) == LB_CEF3_HANDLE_DOM_DOCUMENT);
  LB_CEF3_HANDLE duplicate_dom_document = 0;
  assert(LB_CEF3_TaskTakeDomDocumentResult(
             dom_visit_task, &duplicate_dom_document)
      == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_dom_document == 0);
  assert(LB_CEF3_TaskRelease(dom_visit_task) == LB_CEF3_OK);

  const auto dom_visitor_task = LB_CEF3_FrameVisitDom(dom_frame);
  assert(dom_visitor_task != 0);
  assert(WaitTask(dom_visitor_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE dom_visitor_document = 0;
  assert(LB_CEF3_DomVisitorVisit(dom_visitor_task, &dom_visitor_document)
      == LB_CEF3_OK);
  assert(dom_visitor_document != 0);
  assert(LB_CEF3_HandleRelease(dom_visitor_document) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(dom_visitor_task) == LB_CEF3_OK);

  int32_t dom_integer = -1;
  assert(LB_CEF3_DomDocumentGetType(dom_document, &dom_integer) == LB_CEF3_OK);
  assert(dom_integer >= 0);
  assert(ReadManagedText(dom_document, LB_CEF3_DomDocumentGetTitle)
      == L"dom-bridge-title");
  const auto dom_base_url = ReadManagedText(
      dom_document, LB_CEF3_DomDocumentGetBaseUrl);
  assert(!dom_base_url.empty());
  size_t dom_required = 0;
  assert(LB_CEF3_DomDocumentGetCompleteUrl(
             dom_document, L"child/page.html", nullptr, 0, &dom_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring dom_complete_url(dom_required, L'\0');
  assert(LB_CEF3_DomDocumentGetCompleteUrl(
             dom_document, L"child/page.html", dom_complete_url.data(),
             dom_complete_url.size(), &dom_required)
      == LB_CEF3_OK);
  dom_complete_url.resize(wcslen(dom_complete_url.c_str()));
  assert(dom_complete_url.find(L"child/page.html") != std::wstring::npos);

  LB_CEF3_HANDLE dom_document_node = 0;
  LB_CEF3_HANDLE dom_body = 0;
  LB_CEF3_HANDLE dom_head = 0;
  LB_CEF3_HANDLE dom_focused = 0;
  LB_CEF3_HANDLE dom_root = 0;
  LB_CEF3_HANDLE dom_editor = 0;
  LB_CEF3_HANDLE dom_text_element = 0;
  assert(LB_CEF3_DomDocumentGetDocument(dom_document, &dom_document_node)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetBody(dom_document, &dom_body) == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetHead(dom_document, &dom_head) == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetFocusedNode(dom_document, &dom_focused)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetElementById(
             dom_document, L"dom-root", &dom_root)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetElementById(
             dom_document, L"dom-editor", &dom_editor)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetElementById(
             dom_document, L"dom-text", &dom_text_element)
      == LB_CEF3_OK);
  assert(dom_document_node != 0 && dom_body != 0 && dom_head != 0
      && dom_focused != 0 && dom_root != 0 && dom_editor != 0
      && dom_text_element != 0);
  assert(LB_CEF3_HandleGetType(dom_root) == LB_CEF3_HANDLE_DOM_NODE);
  assert(LB_CEF3_DomDocumentHasSelection(dom_document) == 1);
  assert(ReadManagedText(dom_document, LB_CEF3_DomDocumentGetSelectionAsText)
      == L"selected text");
  assert(ReadManagedText(
             dom_document, LB_CEF3_DomDocumentGetSelectionAsMarkup)
      .find(L"selected text") != std::wstring::npos);
  int32_t selection_start = -1;
  int32_t selection_end = -1;
  assert(LB_CEF3_DomDocumentGetSelectionStartOffset(
             dom_document, &selection_start)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomDocumentGetSelectionEndOffset(
             dom_document, &selection_end)
      == LB_CEF3_OK);
  assert(selection_start >= 0 && selection_end >= selection_start);

  assert(LB_CEF3_DomNodeGetType(dom_root, &dom_integer) == LB_CEF3_OK);
  assert(dom_integer >= 0);
  assert(LB_CEF3_DomNodeIsElement(dom_root) == 1);
  assert(LB_CEF3_DomNodeIsText(dom_root) == 0);
  assert(LB_CEF3_DomNodeIsEditable(dom_root) == 0);
  assert(LB_CEF3_DomNodeIsFormControlElement(dom_root) == 0);
  assert(LB_CEF3_DomNodeIsFormControlElement(dom_editor) == 1);
  assert(LB_CEF3_DomNodeGetFormControlElementType(dom_editor, &dom_integer)
      == LB_CEF3_OK);
  assert(dom_integer >= 0);
  assert(LB_CEF3_DomNodeIsSame(dom_root, dom_root) == 1);
  assert(LB_CEF3_DomNodeIsSame(dom_root, dom_editor) == 0);
  assert(!ReadManagedText(dom_root, LB_CEF3_DomNodeGetName).empty());
  assert(ReadManagedText(dom_root, LB_CEF3_DomNodeGetAsMarkup)
      .find(L"dom-root") != std::wstring::npos);
  assert(!ReadManagedText(dom_root, LB_CEF3_DomNodeGetElementTagName).empty());
  assert(ReadManagedText(dom_root, LB_CEF3_DomNodeGetElementInnerText)
      .find(L"selected text") != std::wstring::npos);
  assert(LB_CEF3_DomNodeHasChildren(dom_root) == 1);
  assert(LB_CEF3_DomNodeHasElementAttributes(dom_root) == 1);
  assert(LB_CEF3_DomNodeHasElementAttribute(dom_root, L"data-test") == 1);
  assert(LB_CEF3_DomNodeHasElementAttribute(dom_root, L"missing") == 0);
  dom_required = 0;
  assert(LB_CEF3_DomNodeGetElementAttribute(
             dom_root, L"data-test", nullptr, 0, &dom_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring dom_attribute(dom_required, L'\0');
  assert(LB_CEF3_DomNodeGetElementAttribute(
             dom_root, L"data-test", dom_attribute.data(),
             dom_attribute.size(), &dom_required)
      == LB_CEF3_OK);
  dom_attribute.resize(wcslen(dom_attribute.c_str()));
  assert(dom_attribute == L"alpha");
  LB_CEF3_HANDLE dom_attributes = 0;
  assert(LB_CEF3_DomNodeGetElementAttributes(dom_root, &dom_attributes)
      == LB_CEF3_OK);
  assert(dom_attributes != 0);
  assert(LB_CEF3_HandleGetType(dom_attributes) == LB_CEF3_HANDLE_DICTIONARY);
  assert(ReadManagedText(dom_attributes, LB_CEF3_DictionaryToJson)
      .find(L"data-test") != std::wstring::npos);
  LB_CEF3_RECT_V3 dom_bounds{
      sizeof(LB_CEF3_RECT_V3), LB_CEF3_ABI_VERSION_V3, 0, 0, 0, 0};
  assert(LB_CEF3_DomNodeGetElementBounds(dom_root, &dom_bounds)
      == LB_CEF3_OK);

  LB_CEF3_HANDLE dom_parent = 0;
  LB_CEF3_HANDLE dom_first_child = 0;
  LB_CEF3_HANDLE dom_last_child = 0;
  LB_CEF3_HANDLE dom_previous_sibling = 0;
  LB_CEF3_HANDLE dom_next_sibling = 0;
  LB_CEF3_HANDLE dom_root_document = 0;
  assert(LB_CEF3_DomNodeGetDocument(dom_root, &dom_root_document)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomNodeGetParent(dom_root, &dom_parent) == LB_CEF3_OK);
  assert(LB_CEF3_DomNodeGetFirstChild(dom_root, &dom_first_child)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomNodeGetLastChild(dom_root, &dom_last_child)
      == LB_CEF3_OK);
  assert(dom_root_document != 0 && dom_parent != 0 && dom_first_child != 0
      && dom_last_child != 0);
  assert(LB_CEF3_DomNodeGetPreviousSibling(
             dom_last_child, &dom_previous_sibling)
      == LB_CEF3_OK);
  assert(LB_CEF3_DomNodeGetNextSibling(
             dom_first_child, &dom_next_sibling)
      == LB_CEF3_OK);
  assert(dom_previous_sibling != 0 && dom_next_sibling != 0);

  LB_CEF3_HANDLE dom_text_node = 0;
  assert(LB_CEF3_DomNodeGetFirstChild(dom_text_element, &dom_text_node)
      == LB_CEF3_OK);
  assert(dom_text_node != 0);
  assert(LB_CEF3_DomNodeIsText(dom_text_node) == 1);
  assert(ReadManagedText(dom_text_node, LB_CEF3_DomNodeGetValue)
      == L"selected text");
  const auto dom_set_value_task = LB_CEF3_DomNodeSetValue(
      dom_text_node, L"changed text");
  assert(dom_set_value_task != 0);
  assert(WaitTask(dom_set_value_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_set_value_task).find(L"true") != std::wstring::npos);
  assert(ReadManagedText(dom_text_node, LB_CEF3_DomNodeGetValue)
      == L"changed text");
  assert(LB_CEF3_TaskRelease(dom_set_value_task) == LB_CEF3_OK);
  const auto dom_set_attribute_task = LB_CEF3_DomNodeSetElementAttribute(
      dom_root, L"data-test", L"beta");
  assert(dom_set_attribute_task != 0);
  assert(WaitTask(dom_set_attribute_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_set_attribute_task).find(L"true") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(dom_set_attribute_task) == LB_CEF3_OK);
  dom_required = 0;
  assert(LB_CEF3_DomNodeGetElementAttribute(
             dom_root, L"data-test", nullptr, 0, &dom_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  dom_attribute.assign(dom_required, L'\0');
  assert(LB_CEF3_DomNodeGetElementAttribute(
             dom_root, L"data-test", dom_attribute.data(),
             dom_attribute.size(), &dom_required)
      == LB_CEF3_OK);
  dom_attribute.resize(wcslen(dom_attribute.c_str()));
  assert(dom_attribute == L"beta");
  const auto dom_verify_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_b,
      L"document.getElementById('dom-root').getAttribute('data-test')+'|'+"
      L"document.getElementById('dom-text').textContent");
  assert(dom_verify_task != 0);
  assert(WaitTask(dom_verify_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_verify_task).find(L"beta|changed text")
      != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(dom_verify_task) == LB_CEF3_OK);

  const auto dom_v4_visit = invoke_view_call(
      make_view_call(UINT64_C(0xd18739d570158414), dom_frame));
  assert(dom_v4_visit.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto dom_v4_visit_task = dom_v4_visit.handle_value;
  assert(dom_v4_visit_task != 0);
  assert(WaitTask(dom_v4_visit_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  const auto dom_v4_document_result = invoke_view_call(
      make_view_call(UINT64_C(0xde4df1cfda7bba33), dom_v4_visit_task));
  assert(dom_v4_document_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto dom_v4_document = dom_v4_document_result.handle_value;
  assert(dom_v4_document != 0);
  assert(LB_CEF3_TaskRelease(dom_v4_visit_task) == LB_CEF3_OK);

  const std::array<uint64_t, 4> dom_document_integer_operations = {
      UINT64_C(0x506deb892fa1f846), UINT64_C(0x878de133091a643d),
      UINT64_C(0x89612bd082a1294a), UINT64_C(0x7a2942207c4c1071)};
  for (const auto operation : dom_document_integer_operations) {
    const auto value = invoke_view_call(make_view_call(operation, dom_v4_document));
    assert(value.value_kind == (operation == UINT64_C(0x878de133091a643d)
        ? LB_CEF3_VALUE_V4_BOOLEAN : LB_CEF3_VALUE_V4_INTEGER));
  }
  const std::array<uint64_t, 5> dom_document_text_operations = {
      UINT64_C(0xea57bdd412bb1021), UINT64_C(0x89e9231226e95da1),
      UINT64_C(0xb0d62a83eda26c5f), UINT64_C(0xef177d5700df73a6),
      UINT64_C(0xea57bdd412bb1021)};
  for (const auto operation : dom_document_text_operations) {
    (void)ReadV4Text(make_view_call(operation, dom_v4_document));
  }
  assert(ReadV4Text(make_view_call(
             UINT64_C(0xea57bdd412bb1021), dom_v4_document))
      == L"dom-bridge-title");
  assert(!ReadV4Text(make_view_call(
              UINT64_C(0xef177d5700df73a6), dom_v4_document))
      .empty());
  LB_CEF3_ARGUMENT_V4 dom_text_argument{};
  dom_text_argument.struct_size = sizeof(dom_text_argument);
  dom_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  dom_text_argument.text_value = L"dom-root";
  const auto dom_v4_root_result = invoke_view_call(make_view_call(
      UINT64_C(0x5592cfa7f952b819), dom_v4_document,
      &dom_text_argument, 1));
  const auto dom_v4_root = dom_v4_root_result.handle_value;
  assert(dom_v4_root != 0);
  dom_text_argument.text_value = L"child/page.html";
  assert(ReadV4Text(make_view_call(
             UINT64_C(0x7cf6caebcd157885), dom_v4_document,
             &dom_text_argument, 1))
      .find(L"child/page.html") != std::wstring::npos);
  const std::array<uint64_t, 4> dom_document_node_operations = {
      UINT64_C(0xf229f7a4620a02ef), UINT64_C(0x0c5786ac94f254da),
      UINT64_C(0x81e8c07c70da9408), UINT64_C(0x3677895507d1be18)};
  for (const auto operation : dom_document_node_operations) {
    const auto node = invoke_view_call(
        make_view_call(operation, dom_v4_document)).handle_value;
    assert(node != 0);
    assert(LB_CEF3_HandleRelease(node) == LB_CEF3_OK);
  }

  const std::array<uint64_t, 7> dom_node_boolean_operations = {
      UINT64_C(0xa38916643256656e), UINT64_C(0x84845a311e1dc220),
      UINT64_C(0x4deefad2b677fa82), UINT64_C(0x40492936151c187b),
      UINT64_C(0xc4452f931c9a3f4c), UINT64_C(0xfd6ee8b355a6748a),
      UINT64_C(0x84845a311e1dc220)};
  for (const auto operation : dom_node_boolean_operations) {
    assert(invoke_view_call(make_view_call(operation, dom_v4_root)).value_kind
        == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  const std::array<uint64_t, 2> dom_node_integer_operations = {
      UINT64_C(0x99f3759fb944b8eb), UINT64_C(0x8ec81eed3f863dc0)};
  for (const auto operation : dom_node_integer_operations) {
    assert(invoke_view_call(make_view_call(operation, dom_v4_root)).value_kind
        == LB_CEF3_VALUE_V4_INTEGER);
  }
  const std::array<uint64_t, 5> dom_node_text_operations = {
      UINT64_C(0xf6f543873a7aaf44), UINT64_C(0xaeb10f6d83f0e8ee),
      UINT64_C(0xd1f4e54c37a6bb2d), UINT64_C(0xbdb4ffec93cd9c58),
      UINT64_C(0xaa0c4381b65cf921)};
  for (const auto operation : dom_node_text_operations) {
    (void)ReadV4Text(make_view_call(operation, dom_v4_root));
  }
  LB_CEF3_ARGUMENT_V4 dom_handle_argument{};
  dom_handle_argument.struct_size = sizeof(dom_handle_argument);
  dom_handle_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  dom_handle_argument.handle_value = dom_v4_root;
  assert(invoke_view_call(make_view_call(
             UINT64_C(0x0e3ea79de1c9b5ad), dom_v4_root,
             &dom_handle_argument, 1))
      .integer_value == 1);
  const auto dom_v4_root_document = invoke_view_call(
      make_view_call(UINT64_C(0xec4f18bbf6ba7d42), dom_v4_root)).handle_value;
  assert(dom_v4_root_document != 0);
  assert(LB_CEF3_HandleRelease(dom_v4_root_document) == LB_CEF3_OK);
  const std::array<uint64_t, 5> dom_node_relation_operations = {
      UINT64_C(0x24b74a82b477af09), UINT64_C(0x9f013f11f2fc27c6),
      UINT64_C(0x664eca3b600185ca), UINT64_C(0xebc145f8221aec11),
      UINT64_C(0x24502cb35b4714ea)};
  for (const auto operation : dom_node_relation_operations) {
    const auto related = invoke_view_call(
        make_view_call(operation, dom_v4_root)).handle_value;
    if (related != 0) assert(LB_CEF3_HandleRelease(related) == LB_CEF3_OK);
  }
  dom_text_argument.text_value = L"data-test";
  assert(invoke_view_call(make_view_call(
             UINT64_C(0xe70a2cc72da6e737), dom_v4_root,
             &dom_text_argument, 1))
      .value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(ReadV4Text(make_view_call(
             UINT64_C(0xa1a9b347e83cad73), dom_v4_root,
             &dom_text_argument, 1)) == L"beta");
  const auto dom_v4_attributes = invoke_view_call(
      make_view_call(UINT64_C(0x7c857357800c3b4f), dom_v4_root)).handle_value;
  assert(dom_v4_attributes != 0);
  assert(LB_CEF3_HandleRelease(dom_v4_attributes) == LB_CEF3_OK);
  const auto dom_v4_bounds = invoke_view_call(
      make_view_call(UINT64_C(0x6a7a167de4c29304), dom_v4_root)).handle_value;
  assert(dom_v4_bounds != 0);
  assert(LB_CEF3_HandleRelease(dom_v4_bounds) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 dom_attribute_arguments[2]{};
  for (auto& argument : dom_attribute_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  }
  dom_attribute_arguments[0].text_value = L"data-test";
  dom_attribute_arguments[1].text_value = L"gamma";
  const auto dom_v4_attribute_task = invoke_view_call(make_view_call(
      UINT64_C(0x2982e2288a9f82c6), dom_v4_root,
      dom_attribute_arguments, 2)).handle_value;
  assert(dom_v4_attribute_task != 0);
  assert(WaitTask(dom_v4_attribute_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dom_v4_attribute_task).find(L"true") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(dom_v4_attribute_task) == LB_CEF3_OK);
  dom_text_argument.text_value = L"root-value";
  const auto dom_v4_value_task = invoke_view_call(make_view_call(
      UINT64_C(0x5069d354fbaf7bf3), dom_v4_root,
      &dom_text_argument, 1)).handle_value;
  assert(dom_v4_value_task != 0);
  assert(WaitTask(dom_v4_value_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(dom_v4_value_task) == LB_CEF3_OK);

  auto invalid_dom_call = make_view_call(
      UINT64_C(0x5592cfa7f952b819), dom_v4_document,
      &dom_handle_argument, 1);
  LB_CEF3_RESULT_V4 invalid_dom_result{};
  invalid_dom_result.struct_size = sizeof(invalid_dom_result);
  assert(LB_CEF3_InvokeV4(&invalid_dom_call, &invalid_dom_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const std::array<LB_CEF3_HANDLE, 15> direct_dom_handles = {
      dom_document_node, dom_body, dom_head, dom_focused, dom_root, dom_editor,
      dom_text_element, dom_attributes, dom_parent, dom_first_child,
      dom_last_child, dom_previous_sibling, dom_next_sibling,
      dom_root_document, dom_text_node};
  for (const auto handle : direct_dom_handles) {
    if (handle != 0) assert(LB_CEF3_HandleRelease(handle) == LB_CEF3_OK);
  }
  assert(LB_CEF3_HandleRelease(dom_v4_root) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(dom_v4_document) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(dom_document) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(dom_frame) == LB_CEF3_OK);

  ShowWindow(host_a, SW_SHOW);
  SetForegroundWindow(host_a);
  SetFocus(host_a);
  const auto focus_deadline = GetTickCount64() + 5000;
  while (g_focus_request_events.load() + g_focus_received_events.load() < 1
      && GetTickCount64() < focus_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_focus_request_events.load() + g_focus_received_events.load() >= 1);

  const auto set_browser_view_setting = [](
      LB_CEF3_HANDLE dictionary, const wchar_t* key, bool enabled) {
    const auto value = LB_CEF3_ValueCreate();
    assert(value != 0);
    assert(LB_CEF3_ValueSetBool(value, enabled ? 1 : 0) == LB_CEF3_OK);
    assert(LB_CEF3_DictionarySetValue(dictionary, key, value) == LB_CEF3_OK);
    assert(LB_CEF3_ValueRelease(value) == LB_CEF3_OK);
  };
  const auto attach_browser_view = [](LB_CEF3_HANDLE browser_view) {
    LB_CEF3_HANDLE window = 0;
    assert(LB_CEF3_WindowCreateTopLevel(0, &window) == LB_CEF3_OK);
    assert(window != 0);
    LB_CEF3_HANDLE layout = 0;
    assert(LB_CEF3_PanelSetToFillLayout(window, &layout) == LB_CEF3_OK);
    assert(layout != 0);
    assert(LB_CEF3_PanelAddChildView(window, browser_view) == LB_CEF3_OK);
    LB_CEF3_SIZE_V3 size{
        sizeof(size), LB_CEF3_ABI_VERSION_V3, 360, 240};
    assert(LB_CEF3_WindowCenter(window, &size) == LB_CEF3_OK);
    assert(LB_CEF3_WindowShow(window) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(layout) == LB_CEF3_OK);
    return window;
  };
  const auto wait_for_browser_view_browser = [](LB_CEF3_HANDLE browser_view) {
    LB_CEF3_HANDLE browser = 0;
    const auto deadline = GetTickCount64() + 30000;
    while (browser == 0 && GetTickCount64() < deadline) {
      assert(LB_CEF3_BrowserViewGetBrowser(browser_view, &browser) == LB_CEF3_OK);
      if (browser == 0) {
        PumpHostMessages();
        Sleep(10);
      }
    }
    assert(browser != 0);
    assert(LB_CEF3_HandleGetType(browser) == LB_CEF3_HANDLE_BROWSER);
    return browser;
  };
  const auto close_browser_view_window = [](LB_CEF3_HANDLE window) {
    const int closed_before = g_browser_closed_events.load();
    assert(LB_CEF3_WindowClose(window) == LB_CEF3_OK);
    const auto deadline = GetTickCount64() + 10000;
    while (g_browser_closed_events.load() == closed_before
        && GetTickCount64() < deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(g_browser_closed_events.load() == closed_before + 1);
    PumpHostMessages();
    assert(LB_CEF3_WindowIsClosed(window) == 1);
  };

  LB_CEF3_HANDLE no_browser_view = UINT64_C(0x1234);
  assert(LB_CEF3_BrowserViewGetForBrowser(browser_a, &no_browser_view)
      == LB_CEF3_OK);
  if (no_browser_view != 0) {
    assert(LB_CEF3_HandleGetType(no_browser_view) == LB_CEF3_HANDLE_VIEW);
    assert(LB_CEF3_HandleRelease(no_browser_view) == LB_CEF3_OK);
  }
  const auto wrong_browser_handle = LB_CEF3_ValueCreate();
  assert(wrong_browser_handle != 0);
  assert(LB_CEF3_BrowserViewGetForBrowser(wrong_browser_handle, &no_browser_view)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ValueRelease(wrong_browser_handle) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewGetForBrowser(browser_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_SetEventCallbackV4(0, TestEventCallbackV4, nullptr)
      == LB_CEF3_OK);
  LB_CEF3_HANDLE browser_view_delegate = 0;
  assert(LB_CEF3_BrowserViewDelegateCreate(&browser_view_delegate)
      == LB_CEF3_OK);
  assert(browser_view_delegate != 0);
  assert(LB_CEF3_HandleGetType(browser_view_delegate)
      == LB_CEF3_HANDLE_VIEW_DELEGATE);
  assert(LB_CEF3_BrowserViewDelegateSubscribeBrowserCreated(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSubscribeBrowserDestroyed(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSubscribePopupCreated(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSubscribeGestureCommand(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetRuntimeStyle(
             browser_view_delegate, LB_CEF3_RUNTIME_STYLE_ALLOY)
      == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetChromeToolbarType(
             browser_view_delegate, 2) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetChromeToolbarType(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetUseFramelessPictureInPicture(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetAllowMovePictureInPicture(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSetAllowPictureInPictureWithoutUserActivation(
             browser_view_delegate, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewDelegateSubscribeBrowserCreated(
             browser_view_delegate, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserViewDelegateSetRuntimeStyle(browser_view_delegate, 3)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserViewDelegateSetChromeToolbarType(
             browser_view_delegate, 0) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserViewDelegateSetUseFramelessPictureInPicture(
             browser_a, 1) == LB_CEF3_ERROR_HANDLE_TYPE);

  const auto browser_view_extra_info = LB_CEF3_DictionaryCreate();
  assert(browser_view_extra_info != 0);
  LB_CEF3_BROWSER_VIEW_CONFIG_V3 browser_view_config{
      sizeof(browser_view_config), LB_CEF3_ABI_VERSION_V3, 301,
      LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_IMAGES
          | LB_CEF3_BROWSER_WEBGL,
      L"about:blank?lingbuilder-browser-view-v3", browser_view_extra_info, 0};
  LB_CEF3_HANDLE browser_view = 0;
  const int browser_view_created_before =
      g_v4_browser_view_created_events.load();
  const int browser_view_destroyed_before =
      g_v4_browser_view_destroyed_events.load();
  assert(LB_CEF3_BrowserViewCreateWithDelegate(
             &browser_view_config, browser_view_delegate, &browser_view)
      == LB_CEF3_OK);
  assert(browser_view != 0);
  assert(LB_CEF3_HandleGetType(browser_view) == LB_CEF3_HANDLE_VIEW);
  LB_CEF3_HANDLE pending_browser = UINT64_C(0x1234);
  assert(LB_CEF3_BrowserViewGetBrowser(browser_view, &pending_browser)
      == LB_CEF3_OK);
  assert(pending_browser == 0);
  int32_t browser_view_runtime_style = -1;
  assert(LB_CEF3_BrowserViewGetRuntimeStyle(
      browser_view, &browser_view_runtime_style) == LB_CEF3_OK);
  assert(browser_view_runtime_style == LB_CEF3_RUNTIME_STYLE_ALLOY);
  assert(LB_CEF3_BrowserViewSetPreferAccelerators(browser_view, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewSetPreferAccelerators(browser_view, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE browser_view_conversion = 0;
  assert(LB_CEF3_ViewAsBrowserView(browser_view, &browser_view_conversion)
      == LB_CEF3_OK);
  assert(browser_view_conversion != 0);
  assert(LB_CEF3_ViewIsSame(browser_view, browser_view_conversion) == 1);
  LB_CEF3_HANDLE chrome_toolbar = UINT64_C(0x1234);
  assert(LB_CEF3_BrowserViewGetChromeToolbar(browser_view, &chrome_toolbar)
      == LB_CEF3_OK);
  if (chrome_toolbar != 0) {
    assert(LB_CEF3_HandleGetType(chrome_toolbar) == LB_CEF3_HANDLE_VIEW);
    assert(LB_CEF3_HandleRelease(chrome_toolbar) == LB_CEF3_OK);
  }
  const auto browser_view_window = attach_browser_view(browser_view);
  const auto browser_view_browser = wait_for_browser_view_browser(browser_view);
  const auto browser_view_created_deadline = GetTickCount64() + 10000;
  while (g_v4_browser_view_created_events.load() <= browser_view_created_before
      && GetTickCount64() < browser_view_created_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_browser_view_created_events.load() > browser_view_created_before);
  LB_CEF3_HANDLE browser_view_lookup = 0;
  assert(LB_CEF3_BrowserViewGetForBrowser(
      browser_view_browser, &browser_view_lookup) == LB_CEF3_OK);
  assert(browser_view_lookup != 0);
  assert(LB_CEF3_ViewIsSame(browser_view, browser_view_lookup) == 1);
  close_browser_view_window(browser_view_window);
  const auto browser_view_destroyed_deadline = GetTickCount64() + 10000;
  while (g_v4_browser_view_destroyed_events.load()
             <= browser_view_destroyed_before
      && GetTickCount64() < browser_view_destroyed_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_browser_view_destroyed_events.load()
      > browser_view_destroyed_before);
  assert(LB_CEF3_HandleRelease(browser_view_lookup) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_conversion) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_browser) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_window) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserViewGetRuntimeStyle(
      browser_view, &browser_view_runtime_style)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_DictionaryRelease(browser_view_extra_info) == LB_CEF3_OK);

  const auto browser_view_settings = LB_CEF3_DictionaryCreate();
  const auto browser_view_v4_extra_info = LB_CEF3_DictionaryCreate();
  assert(browser_view_settings != 0 && browser_view_v4_extra_info != 0);
  set_browser_view_setting(browser_view_settings, L"javascript", true);
  set_browser_view_setting(browser_view_settings, L"images", true);
  set_browser_view_setting(browser_view_settings, L"webgl", false);
  auto make_browser_view_argument = [](
      uint32_t kind, LB_CEF3_HANDLE handle = 0,
      const wchar_t* text = nullptr, int64_t integer = 0) {
    LB_CEF3_ARGUMENT_V4 argument{};
    argument.struct_size = sizeof(argument);
    argument.value_kind = kind;
    argument.handle_value = handle;
    argument.text_value = text;
    argument.integer_value = integer;
    return argument;
  };
  LB_CEF3_HANDLE browser_view_v4_delegate = 0;
  assert(LB_CEF3_BrowserViewDelegateCreate(&browser_view_v4_delegate)
      == LB_CEF3_OK);
  auto browser_view_delegate_boolean = make_browser_view_argument(
      LB_CEF3_VALUE_V4_BOOLEAN, 0, nullptr, 1);
  for (const auto operation_id : {
      UINT64_C(0xa8da6d0c58b50567), UINT64_C(0xd18d2c164688253c),
      UINT64_C(0xf6f15a3b2b292852), UINT64_C(0xc99bbf0e9e8353f2),
      UINT64_C(0xd1eedafe7a999ab0), UINT64_C(0x059feae61f735c5f),
      UINT64_C(0xa31a10ba926841dd)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, browser_view_v4_delegate,
        &browser_view_delegate_boolean, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  auto browser_view_delegate_integer = make_browser_view_argument(
      LB_CEF3_VALUE_V4_INTEGER, 0, nullptr,
      LB_CEF3_RUNTIME_STYLE_ALLOY);
  auto browser_view_delegate_result = invoke_view_call(make_view_call(
      UINT64_C(0xf02d1c7d9d53b2d2), browser_view_v4_delegate,
      &browser_view_delegate_integer, 1));
  assert(browser_view_delegate_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  browser_view_delegate_integer.integer_value = 1;
  browser_view_delegate_result = invoke_view_call(make_view_call(
      UINT64_C(0xe10e772bd58d90e1), browser_view_v4_delegate,
      &browser_view_delegate_integer, 1));
  assert(browser_view_delegate_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_RESULT_V4 invalid_delegate_result{};
  invalid_delegate_result.struct_size = sizeof(invalid_delegate_result);
  browser_view_delegate_boolean.integer_value = 2;
  const auto invalid_delegate_call = make_view_call(
      UINT64_C(0x059feae61f735c5f), browser_view_v4_delegate,
      &browser_view_delegate_boolean, 1);
  assert(LB_CEF3_InvokeV4(&invalid_delegate_call, &invalid_delegate_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  browser_view_delegate_boolean.integer_value = 1;
  std::array<LB_CEF3_ARGUMENT_V4, 6> create_browser_view_arguments{
      make_browser_view_argument(LB_CEF3_VALUE_V4_HANDLE),
      make_browser_view_argument(
          LB_CEF3_VALUE_V4_TEXT, 0,
          L"about:blank?lingbuilder-browser-view-v4"),
      make_browser_view_argument(
          LB_CEF3_VALUE_V4_HANDLE, browser_view_settings),
      make_browser_view_argument(
          LB_CEF3_VALUE_V4_HANDLE, browser_view_v4_extra_info),
      make_browser_view_argument(LB_CEF3_VALUE_V4_HANDLE),
      make_browser_view_argument(
          LB_CEF3_VALUE_V4_HANDLE, browser_view_v4_delegate)};
  const auto browser_view_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0xd20fabddd803b311), 0,
      create_browser_view_arguments.data(),
      create_browser_view_arguments.size()));
  assert(browser_view_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto browser_view_v4 = browser_view_v4_result.handle_value;
  assert(browser_view_v4 != 0);

  auto browser_view_v4_get_browser_call = make_view_call(
      UINT64_C(0x7ce94f5b1d505a14), browser_view_v4);
  auto browser_view_v4_browser_result =
      invoke_view_call(browser_view_v4_get_browser_call);
  assert(browser_view_v4_browser_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(browser_view_v4_browser_result.handle_value == 0);
  const auto browser_view_v4_style_result = invoke_view_call(make_view_call(
      UINT64_C(0x010d2dc734b919ce), browser_view_v4));
  assert(browser_view_v4_style_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(browser_view_v4_style_result.integer_value >= 0);
  auto prefer_accelerators_argument = make_browser_view_argument(
      LB_CEF3_VALUE_V4_BOOLEAN, 0, nullptr, 1);
  const auto prefer_accelerators_result = invoke_view_call(make_view_call(
      UINT64_C(0x13d75063bf05c486), browser_view_v4,
      &prefer_accelerators_argument, 1));
  assert(prefer_accelerators_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  const auto toolbar_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0x0967f3cf51827ff7), browser_view_v4));
  assert(toolbar_v4_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  if (toolbar_v4_result.handle_value != 0)
    assert(LB_CEF3_HandleRelease(toolbar_v4_result.handle_value) == LB_CEF3_OK);

  const auto browser_view_v4_window = attach_browser_view(browser_view_v4);
  const auto browser_view_v4_browser =
      wait_for_browser_view_browser(browser_view_v4);
  browser_view_v4_browser_result =
      invoke_view_call(browser_view_v4_get_browser_call);
  assert(browser_view_v4_browser_result.handle_value == browser_view_v4_browser);
  auto lookup_browser_view_argument = make_browser_view_argument(
      LB_CEF3_VALUE_V4_HANDLE, browser_view_v4_browser);
  const auto lookup_browser_view_result = invoke_view_call(make_view_call(
      UINT64_C(0x43765ad39bfc6172), 0,
      &lookup_browser_view_argument, 1));
  assert(lookup_browser_view_result.handle_value != 0);
  assert(LB_CEF3_ViewIsSame(
      browser_view_v4, lookup_browser_view_result.handle_value) == 1);

  auto invalid_browser_view_call = make_view_call(
      UINT64_C(0x13d75063bf05c486), browser_view_v4,
      &prefer_accelerators_argument, 1);
  LB_CEF3_RESULT_V4 invalid_browser_view_result{};
  invalid_browser_view_result.struct_size = sizeof(invalid_browser_view_result);
  prefer_accelerators_argument.integer_value = 2;
  assert(LB_CEF3_InvokeV4(
      &invalid_browser_view_call, &invalid_browser_view_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_browser_view_result = {};
  invalid_browser_view_result.struct_size = sizeof(invalid_browser_view_result);
  invalid_browser_view_call = make_view_call(
      UINT64_C(0x7ce94f5b1d505a14), 0);
  assert(LB_CEF3_InvokeV4(
      &invalid_browser_view_call, &invalid_browser_view_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_browser_view_result = {};
  invalid_browser_view_result.struct_size = sizeof(invalid_browser_view_result);
  create_browser_view_arguments[0].handle_value = browser_view_settings;
  invalid_browser_view_call = make_view_call(
      UINT64_C(0xd20fabddd803b311), 0,
      create_browser_view_arguments.data(),
      create_browser_view_arguments.size());
  assert(LB_CEF3_InvokeV4(
      &invalid_browser_view_call, &invalid_browser_view_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  create_browser_view_arguments[0].handle_value = 0;
  const auto invalid_browser_view_settings = LB_CEF3_DictionaryCreate();
  assert(invalid_browser_view_settings != 0);
  set_browser_view_setting(invalid_browser_view_settings, L"unknown", true);
  create_browser_view_arguments[2].handle_value = invalid_browser_view_settings;
  invalid_browser_view_result = {};
  invalid_browser_view_result.struct_size = sizeof(invalid_browser_view_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_browser_view_call, &invalid_browser_view_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  create_browser_view_arguments[2].handle_value = browser_view_settings;

  close_browser_view_window(browser_view_v4_window);
  expected_browser_closed_events = g_browser_closed_events.load() + 2;
  assert(LB_CEF3_HandleRelease(lookup_browser_view_result.handle_value)
      == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_v4_browser_result.handle_value)
      == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_v4_browser) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_v4_window) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_view_v4_delegate) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(invalid_browser_view_settings)
      == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(browser_view_v4_extra_info)
      == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(browser_view_settings) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-view\n");
  std::fflush(stderr);
  LB_CEF3_HANDLE sync_browser_probe = 0;
  assert(LB_CEF3_BrowserHostCreateBrowserSync(
      0, 0, L"", 0, 0, 0, &sync_browser_probe)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(sync_browser_probe == 0);
  const int can_go_back = LB_CEF3_BrowserCanGoBack(browser_a);
  const int can_go_forward = LB_CEF3_BrowserCanGoForward(browser_a);
  assert(can_go_back == 0 || can_go_back == 1);
  assert(can_go_forward == 0 || can_go_forward == 1);
  assert(LB_CEF3_BrowserGoBack(browser_a) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserGoForward(browser_a) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserStopLoad(browser_a) == LB_CEF3_OK);

  assert(LB_CEF3_BrowserIsValid(browser_a) == 1);
  LB_CEF3_CALL_V4 browser_is_valid_call{};
  browser_is_valid_call.struct_size = sizeof(browser_is_valid_call);
  browser_is_valid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  browser_is_valid_call.operation_id = UINT64_C(0x34adbe325781899a);
  browser_is_valid_call.target = browser_a;
  LB_CEF3_RESULT_V4 browser_is_valid_result{};
  browser_is_valid_result.struct_size = sizeof(browser_is_valid_result);
  assert(LB_CEF3_InvokeV4(&browser_is_valid_call, &browser_is_valid_result) == LB_CEF3_OK);
  assert(browser_is_valid_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(browser_is_valid_result.integer_value == 1);
  assert(LB_CEF3_BrowserIsPopup(browser_a) == 0);
  LB_CEF3_CALL_V4 browser_is_popup_call{};
  browser_is_popup_call.struct_size = sizeof(browser_is_popup_call);
  browser_is_popup_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  browser_is_popup_call.operation_id = UINT64_C(0x38af27cafb423fb5);
  browser_is_popup_call.target = browser_a;
  LB_CEF3_RESULT_V4 browser_is_popup_result{};
  browser_is_popup_result.struct_size = sizeof(browser_is_popup_result);
  assert(LB_CEF3_InvokeV4(&browser_is_popup_call, &browser_is_popup_result) == LB_CEF3_OK);
  assert(browser_is_popup_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(browser_is_popup_result.integer_value == 0);
  assert(LB_CEF3_BrowserIsSame(browser_a, browser_a) == 1);
  assert(LB_CEF3_BrowserIsSame(browser_a, browser_b) == 0);
  LB_CEF3_ARGUMENT_V4 browser_is_same_arguments[1]{};
  browser_is_same_arguments[0].struct_size = sizeof(browser_is_same_arguments[0]);
  browser_is_same_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  browser_is_same_arguments[0].handle_value = browser_a;
  LB_CEF3_CALL_V4 browser_is_same_call{};
  browser_is_same_call.struct_size = sizeof(browser_is_same_call);
  browser_is_same_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  browser_is_same_call.operation_id = UINT64_C(0x9fecbb68562ab515);
  browser_is_same_call.target = browser_a;
  browser_is_same_call.arguments = browser_is_same_arguments;
  browser_is_same_call.argument_count = 1;
  LB_CEF3_RESULT_V4 browser_is_same_result{};
  browser_is_same_result.struct_size = sizeof(browser_is_same_result);
  assert(LB_CEF3_InvokeV4(&browser_is_same_call, &browser_is_same_result) == LB_CEF3_OK);
  assert(browser_is_same_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(browser_is_same_result.integer_value == 1);
  bool browser_has_document = false;
  const auto document_deadline = GetTickCount64() + 5000;
  while (!browser_has_document && GetTickCount64() < document_deadline) {
    PumpHostMessages();
    browser_has_document = LB_CEF3_BrowserHasDocument(browser_a) == 1;
    if (!browser_has_document) Sleep(10);
  }
  assert(browser_has_document);
  int64_t frame_count = 0;
  assert(LB_CEF3_BrowserGetFrameCount(browser_a, &frame_count) == LB_CEF3_OK);
  assert(frame_count >= 1);
  LB_CEF3_HANDLE frame_identifiers = 0;
  LB_CEF3_HANDLE frame_names = 0;
  assert(LB_CEF3_BrowserGetFrameIdentifiers(browser_a, &frame_identifiers) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserGetFrameNames(browser_a, &frame_names) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(frame_identifiers) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_HandleGetType(frame_names) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(frame_identifiers) == frame_count);
  assert(LB_CEF3_ListGetSize(frame_names) == frame_count);
  const std::wstring first_frame_identifier = ReadTextListItem(frame_identifiers, 0);
  const std::wstring first_frame_name = ReadTextListItem(frame_names, 0);
  assert(!first_frame_identifier.empty());
  LB_CEF3_HANDLE frame_handle_for_close = 0;
  assert(LB_CEF3_BrowserGetFrameByIdentifier(
      browser_a, first_frame_identifier.c_str(), &frame_handle_for_close) == LB_CEF3_OK);
  assert(frame_handle_for_close != 0);
  assert(LB_CEF3_HandleGetType(frame_handle_for_close) == LB_CEF3_HANDLE_FRAME);
  LB_CEF3_HANDLE missing_frame = UINT64_C(0x9876);
  assert(LB_CEF3_BrowserGetFrameByIdentifier(
      browser_a, L"missing-frame-identifier", &missing_frame) == LB_CEF3_OK);
  assert(missing_frame == 0);
  LB_CEF3_HANDLE named_frame = 0;
  assert(LB_CEF3_BrowserGetFrameByName(
      browser_a, first_frame_name.c_str(), &named_frame) == LB_CEF3_OK);
  if (named_frame != 0) {
    assert(LB_CEF3_HandleGetType(named_frame) == LB_CEF3_HANDLE_FRAME);
  }
  LB_CEF3_HANDLE focused_frame = 0;
  assert(LB_CEF3_BrowserGetFocusedFrame(browser_a, &focused_frame) == LB_CEF3_OK);
  assert(focused_frame != 0);
  assert(LB_CEF3_HandleGetType(focused_frame) == LB_CEF3_HANDLE_FRAME);

  LB_CEF3_ARGUMENT_V4 frame_text_argument{};
  frame_text_argument.struct_size = sizeof(frame_text_argument);
  frame_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  frame_text_argument.text_value = first_frame_identifier.c_str();
  LB_CEF3_CALL_V4 focused_frame_call{};
  focused_frame_call.struct_size = sizeof(focused_frame_call);
  focused_frame_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  focused_frame_call.operation_id = UINT64_C(0x2f0aaf904da1496a);
  focused_frame_call.target = browser_a;
  LB_CEF3_RESULT_V4 focused_frame_result{};
  focused_frame_result.struct_size = sizeof(focused_frame_result);
  assert(LB_CEF3_InvokeV4(&focused_frame_call, &focused_frame_result) == LB_CEF3_OK);
  assert(focused_frame_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(focused_frame_result.handle_value) == LB_CEF3_HANDLE_FRAME);
  const auto focused_frame_v4 = focused_frame_result.handle_value;
  focused_frame_call.arguments = &frame_text_argument;
  focused_frame_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&focused_frame_call, &focused_frame_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_CALL_V4 frame_by_identifier_call{};
  frame_by_identifier_call.struct_size = sizeof(frame_by_identifier_call);
  frame_by_identifier_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_by_identifier_call.operation_id = UINT64_C(0xe75b2e0ca124655a);
  frame_by_identifier_call.target = browser_a;
  frame_by_identifier_call.arguments = &frame_text_argument;
  frame_by_identifier_call.argument_count = 1;
  LB_CEF3_RESULT_V4 frame_by_identifier_result{};
  frame_by_identifier_result.struct_size = sizeof(frame_by_identifier_result);
  assert(LB_CEF3_InvokeV4(&frame_by_identifier_call, &frame_by_identifier_result)
      == LB_CEF3_OK);
  assert(frame_by_identifier_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(frame_by_identifier_result.handle_value)
      == LB_CEF3_HANDLE_FRAME);
  const auto frame_by_identifier_v4 = frame_by_identifier_result.handle_value;
  frame_text_argument.text_value = L"missing-frame-identifier";
  assert(LB_CEF3_InvokeV4(&frame_by_identifier_call, &frame_by_identifier_result)
      == LB_CEF3_OK);
  assert(frame_by_identifier_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(frame_by_identifier_result.handle_value == 0);
  frame_text_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&frame_by_identifier_call, &frame_by_identifier_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  frame_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  frame_text_argument.text_value = first_frame_name.c_str();
  LB_CEF3_CALL_V4 frame_by_name_call{};
  frame_by_name_call.struct_size = sizeof(frame_by_name_call);
  frame_by_name_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_by_name_call.operation_id = UINT64_C(0x9d959c3804a5444d);
  frame_by_name_call.target = browser_a;
  frame_by_name_call.arguments = &frame_text_argument;
  frame_by_name_call.argument_count = 1;
  LB_CEF3_RESULT_V4 frame_by_name_result{};
  frame_by_name_result.struct_size = sizeof(frame_by_name_result);
  assert(LB_CEF3_InvokeV4(&frame_by_name_call, &frame_by_name_result) == LB_CEF3_OK);
  assert(frame_by_name_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto frame_by_name_v4 = frame_by_name_result.handle_value;
  if (frame_by_name_v4 != 0) {
    assert(LB_CEF3_HandleGetType(frame_by_name_v4) == LB_CEF3_HANDLE_FRAME);
  }
  frame_text_argument.text_value = nullptr;
  assert(LB_CEF3_InvokeV4(&frame_by_name_call, &frame_by_name_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_CALL_V4 frame_count_call{};
  frame_count_call.struct_size = sizeof(frame_count_call);
  frame_count_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_count_call.operation_id = UINT64_C(0x75ccb775970eee0e);
  frame_count_call.target = browser_a;
  LB_CEF3_RESULT_V4 frame_count_result{};
  frame_count_result.struct_size = sizeof(frame_count_result);
  assert(LB_CEF3_InvokeV4(&frame_count_call, &frame_count_result) == LB_CEF3_OK);
  assert(frame_count_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(frame_count_result.integer_value == frame_count);
  frame_count_call.arguments = &frame_text_argument;
  frame_count_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&frame_count_call, &frame_count_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_CALL_V4 frame_identifiers_call{};
  frame_identifiers_call.struct_size = sizeof(frame_identifiers_call);
  frame_identifiers_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_identifiers_call.operation_id = UINT64_C(0xab8bbaaf2e08bd67);
  frame_identifiers_call.target = browser_a;
  LB_CEF3_RESULT_V4 frame_identifiers_result{};
  frame_identifiers_result.struct_size = sizeof(frame_identifiers_result);
  assert(LB_CEF3_InvokeV4(&frame_identifiers_call, &frame_identifiers_result)
      == LB_CEF3_OK);
  assert(frame_identifiers_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(frame_identifiers_result.handle_value) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(frame_identifiers_result.handle_value) == frame_count);
  const auto frame_identifiers_v4 = frame_identifiers_result.handle_value;
  frame_identifiers_call.arguments = &frame_text_argument;
  frame_identifiers_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&frame_identifiers_call, &frame_identifiers_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_CALL_V4 frame_names_call{};
  frame_names_call.struct_size = sizeof(frame_names_call);
  frame_names_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_names_call.operation_id = UINT64_C(0x8319af2232c61fab);
  frame_names_call.target = browser_a;
  LB_CEF3_RESULT_V4 frame_names_result{};
  frame_names_result.struct_size = sizeof(frame_names_result);
  assert(LB_CEF3_InvokeV4(&frame_names_call, &frame_names_result) == LB_CEF3_OK);
  assert(frame_names_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(frame_names_result.handle_value) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(frame_names_result.handle_value) == frame_count);
  const auto frame_names_v4 = frame_names_result.handle_value;
  frame_names_call.arguments = &frame_text_argument;
  frame_names_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&frame_names_call, &frame_names_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_FrameIsValid(frame_handle_for_close) == 1);
  assert(LB_CEF3_FrameIsMain(frame_handle_for_close) == 1);
  const int frame_is_focused = LB_CEF3_FrameIsFocused(frame_handle_for_close);
  assert(frame_is_focused == 0 || frame_is_focused == 1);
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetIdentifier)
      == first_frame_identifier);
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetName)
      == first_frame_name);
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl)
      == L"about:blank");
  LB_CEF3_HANDLE parent_frame = UINT64_C(0x5678);
  assert(LB_CEF3_FrameGetParent(frame_handle_for_close, &parent_frame) == LB_CEF3_OK);
  assert(parent_frame == 0);
  LB_CEF3_HANDLE owning_browser = 0;
  assert(LB_CEF3_FrameGetBrowser(frame_handle_for_close, &owning_browser) == LB_CEF3_OK);
  assert(owning_browser == browser_a);
  assert(LB_CEF3_HandleGetType(owning_browser) == LB_CEF3_HANDLE_BROWSER);
  assert(LB_CEF3_HandleRelease(owning_browser) == LB_CEF3_OK);

  /* V8 objects are renderer leases. Exercise direct C ABI and V4 dispatch,
  // including typed handles, copied buffers, and managed key lists.
  const auto v8_context_task = LB_CEF3_FrameGetV8Context(frame_handle_for_close);
  assert(v8_context_task != 0);
  assert(WaitTask(v8_context_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_context = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_context_task, LB_CEF3_HANDLE_V8_CONTEXT, &v8_context)
      == LB_CEF3_OK);
  assert(v8_context != 0);
  assert(LB_CEF3_HandleGetType(v8_context) == LB_CEF3_HANDLE_V8_CONTEXT);
  assert(LB_CEF3_TaskRelease(v8_context_task) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 v8_call{};
  v8_call.struct_size = sizeof(v8_call);
  v8_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  v8_call.target = frame_handle_for_close;
  v8_call.operation_id = UINT64_C(0x9894f0fa2f24afaa);
  LB_CEF3_RESULT_V4 v8_result{};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  assert(v8_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v8_context_v4_task = v8_result.handle_value;
  assert(WaitTask(v8_context_v4_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_context_v4 = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_context_v4_task, LB_CEF3_HANDLE_V8_CONTEXT, &v8_context_v4)
      == LB_CEF3_OK);
  assert(v8_context_v4 != 0);
  assert(LB_CEF3_HandleRelease(v8_context_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(v8_context_v4_task) == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 v8_argument{};
  v8_argument.struct_size = sizeof(v8_argument);
  v8_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  v8_argument.integer_value = 42;
  v8_call.target = v8_context;
  v8_call.arguments = &v8_argument;
  v8_call.argument_count = 1;
  v8_call.operation_id = UINT64_C(0x07d59ef6fcc22441);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  assert(v8_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v8_int_task = v8_result.handle_value;
  assert(WaitTask(v8_int_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_int = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_int_task, LB_CEF3_HANDLE_V8_VALUE, &v8_int) == LB_CEF3_OK);
  assert(v8_int != 0);
  assert(LB_CEF3_TaskRelease(v8_int_task) == LB_CEF3_OK);

  v8_call.target = v8_int;
  v8_call.arguments = nullptr;
  v8_call.argument_count = 0;
  v8_call.operation_id = UINT64_C(0xbcfceccd67e8118a);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  assert(v8_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v8_get_int_task = v8_result.handle_value;
  assert(WaitTask(v8_get_int_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(v8_get_int_task).find(L"\"value\":42") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(v8_get_int_task) == LB_CEF3_OK);

  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"answer";
  v8_call.target = v8_context;
  v8_call.arguments = &v8_argument;
  v8_call.argument_count = 1;
  v8_call.operation_id = UINT64_C(0x29b658dc1fbfdb0e);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_string_task = v8_result.handle_value;
  assert(WaitTask(v8_string_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_string = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_string_task, LB_CEF3_HANDLE_V8_VALUE, &v8_string) == LB_CEF3_OK);
  assert(v8_string != 0);
  assert(LB_CEF3_TaskRelease(v8_string_task) == LB_CEF3_OK);

  v8_call.target = v8_context;
  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"globalThis.__lingBuilderV8Eval = 7";
  LB_CEF3_ARGUMENT_V4 eval_arguments[3]{};
  eval_arguments[0] = v8_argument;
  eval_arguments[1].struct_size = sizeof(eval_arguments[1]);
  eval_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  eval_arguments[1].text_value = L"lingbuilder://v8-eval";
  eval_arguments[2].struct_size = sizeof(eval_arguments[2]);
  eval_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  eval_arguments[2].integer_value = 1;
  v8_call.arguments = eval_arguments;
  v8_call.argument_count = 3;
  v8_call.operation_id = UINT64_C(0xff721f224917f962);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_eval_task = v8_result.handle_value;
  assert(WaitTask(v8_eval_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_eval_value = 0;
  assert(LB_CEF3_TaskTakeV8Result(
             v8_eval_task, LB_CEF3_HANDLE_V8_VALUE, &v8_eval_value) == LB_CEF3_OK);
  assert(v8_eval_value != 0);
  assert(LB_CEF3_TaskRelease(v8_eval_task) == LB_CEF3_OK);

  v8_argument.struct_size = sizeof(v8_argument);
  v8_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  v8_argument.text_value = L"answer";
  LB_CEF3_ARGUMENT_V4 set_arguments[3]{};
  set_arguments[0] = v8_argument;
  set_arguments[1].struct_size = sizeof(set_arguments[1]);
  set_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  set_arguments[1].handle_value = v8_string;
  set_arguments[2].struct_size = sizeof(set_arguments[2]);
  set_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  set_arguments[2].integer_value = 0;
  v8_call.target = v8_eval_value;
  v8_call.arguments = set_arguments;
  v8_call.argument_count = 3;
  v8_call.operation_id = UINT64_C(0x1f91ced879e0c8ff);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_set_task = v8_result.handle_value;
  assert(WaitTask(v8_set_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(v8_set_task) == LB_CEF3_OK);

  v8_call.target = v8_eval_value;
  v8_call.arguments = nullptr;
  v8_call.argument_count = 0;
  v8_call.operation_id = UINT64_C(0xba9a2269d1c3526b);
  v8_result = {};
  v8_result.struct_size = sizeof(v8_result);
  assert(LB_CEF3_InvokeV4(&v8_call, &v8_result) == LB_CEF3_OK);
  const auto v8_keys_task = v8_result.handle_value;
  assert(WaitTask(v8_keys_task, 10000) == LB_CEF3_TASK_SUCCEEDED);
  LB_CEF3_HANDLE v8_keys = 0;
  assert(LB_CEF3_TaskTakeV8ListResult(v8_keys_task, &v8_keys) == LB_CEF3_OK);
  assert(v8_keys != 0 && LB_CEF3_HandleGetType(v8_keys) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(v8_keys) >= 1);
  assert(LB_CEF3_TaskRelease(v8_keys_task) == LB_CEF3_OK);

  for (const auto handle : {v8_keys, v8_eval_value, v8_string, v8_int, v8_context}) {
    assert(LB_CEF3_HandleRelease(handle) == LB_CEF3_OK);
  }
  */
  const auto frame_source_task = LB_CEF3_FrameGetSource(frame_handle_for_close);
  const auto frame_text_task = LB_CEF3_FrameGetText(frame_handle_for_close);
  assert(frame_source_task != 0 && frame_text_task != 0);
  assert(WaitTask(frame_source_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(frame_text_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(!TaskResult(frame_source_task).empty());
  assert(LB_CEF3_TaskRelease(frame_source_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(frame_text_task) == LB_CEF3_OK);
  for (const auto action : {
      LB_CEF3_FrameUndo, LB_CEF3_FrameRedo, LB_CEF3_FrameCut,
      LB_CEF3_FrameCopy, LB_CEF3_FramePaste, LB_CEF3_FramePasteAndMatchStyle,
      LB_CEF3_FrameDelete, LB_CEF3_FrameSelectAll}) {
    assert(action(frame_handle_for_close) == LB_CEF3_OK);
  }
  assert(LB_CEF3_FrameExecuteJavaScript(
      frame_handle_for_close,
      L"globalThis.__lingBuilderFrameApi=true;document.title='frame-api';",
      L"lingbuilder://frame-api-test", 1) == LB_CEF3_OK);

  const auto frame_load_file = std::filesystem::temp_directory_path()
      / ("lingbuilder-cef3-frame-load-" + std::to_string(GetCurrentProcessId()) + ".html");
  {
    std::ofstream output(frame_load_file, std::ios::binary | std::ios::trunc);
    assert(output.is_open());
    output << "<!doctype html><meta charset=\"utf-8\"><title>frame-load-url</title>"
              "<body>frame-load-url</body>";
    assert(output.good());
  }
  const std::wstring frame_load_url = L"file:///" + frame_load_file.generic_wstring();
  assert(LB_CEF3_FrameLoadUrl(
      frame_handle_for_close, frame_load_url.c_str()) == LB_CEF3_OK);
  const auto frame_load_deadline = GetTickCount64() + 5000;
  while (ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
          frame_load_file.filename().wstring()) == std::wstring::npos
      && GetTickCount64() < frame_load_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
      frame_load_file.filename().wstring()) != std::wstring::npos);

  LB_CEF3_ARGUMENT_V4 frame_extra_argument{};
  frame_extra_argument.struct_size = sizeof(frame_extra_argument);
  frame_extra_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  for (const auto operation_id : {
      UINT64_C(0x11dc8bf7d6e28c4b), UINT64_C(0xddd48543c74cdaba),
      UINT64_C(0xc9b2e27c72f85a51), UINT64_C(0x9e748819d29d7fae),
      UINT64_C(0xa0b88ef627a459ff), UINT64_C(0x80eb29297f27afc5),
      UINT64_C(0x6563e11c5ce8695b), UINT64_C(0xb393caba8e9a0081)}) {
    LB_CEF3_CALL_V4 action_call{};
    action_call.struct_size = sizeof(action_call);
    action_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    action_call.operation_id = operation_id;
    action_call.target = frame_handle_for_close;
    LB_CEF3_RESULT_V4 action_result{};
    action_result.struct_size = sizeof(action_result);
    assert(LB_CEF3_InvokeV4(&action_call, &action_result) == LB_CEF3_OK);
    assert(action_result.value_kind == LB_CEF3_VALUE_V4_VOID);
    action_call.arguments = &frame_extra_argument;
    action_call.argument_count = 1;
    assert(LB_CEF3_InvokeV4(&action_call, &action_result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }
  LB_CEF3_CALL_V4 view_source_call{};
  view_source_call.struct_size = sizeof(view_source_call);
  view_source_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  view_source_call.operation_id = UINT64_C(0xc3b266d4410efd2d);
  view_source_call.target = frame_handle_for_close;
  view_source_call.arguments = &frame_extra_argument;
  view_source_call.argument_count = 1;
  LB_CEF3_RESULT_V4 view_source_result{};
  view_source_result.struct_size = sizeof(view_source_result);
  assert(LB_CEF3_InvokeV4(&view_source_call, &view_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  for (const auto [operation_id, expected] : {
      std::pair{UINT64_C(0x33ca51d966ec03c0), int64_t{1}},
      std::pair{UINT64_C(0x7d04888d5e0729cd), int64_t{1}},
      std::pair{UINT64_C(0xa0dd73111668b80d), static_cast<int64_t>(frame_is_focused)}}) {
    LB_CEF3_CALL_V4 query_call{};
    query_call.struct_size = sizeof(query_call);
    query_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    query_call.operation_id = operation_id;
    query_call.target = frame_handle_for_close;
    LB_CEF3_RESULT_V4 query_result{};
    query_result.struct_size = sizeof(query_result);
    assert(LB_CEF3_InvokeV4(&query_call, &query_result) == LB_CEF3_OK);
    assert(query_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(query_result.integer_value == expected);
    query_call.arguments = &frame_extra_argument;
    query_call.argument_count = 1;
    assert(LB_CEF3_InvokeV4(&query_call, &query_result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }
  const auto current_frame_identifier =
      ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetIdentifier);
  for (const auto [operation_id, expected] : {
      std::pair{UINT64_C(0x7b30814b9ceb75bd), first_frame_name},
      std::pair{UINT64_C(0xdf37f0c24c6444c0), current_frame_identifier},
      std::pair{UINT64_C(0x13582504fe55e1f8),
                ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl)}}) {
    LB_CEF3_CALL_V4 text_call{};
    text_call.struct_size = sizeof(text_call);
    text_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    text_call.operation_id = operation_id;
    text_call.target = frame_handle_for_close;
    const auto actual = ReadV4Text(text_call);
    if (actual != expected) {
      std::fwprintf(stderr, L"CEF3 Frame V4 text mismatch: operation=%016llx expected=%ls actual=%ls\n",
                    static_cast<unsigned long long>(operation_id), expected.c_str(), actual.c_str());
      std::fflush(stderr);
    }
    assert(actual == expected);
    text_call.arguments = &frame_extra_argument;
    text_call.argument_count = 1;
    LB_CEF3_RESULT_V4 invalid_text_result{};
    invalid_text_result.struct_size = sizeof(invalid_text_result);
    assert(LB_CEF3_InvokeV4(&text_call, &invalid_text_result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }

  LB_CEF3_CALL_V4 parent_call{};
  parent_call.struct_size = sizeof(parent_call);
  parent_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  parent_call.operation_id = UINT64_C(0x589f8e5646edab63);
  parent_call.target = frame_handle_for_close;
  LB_CEF3_RESULT_V4 parent_result{};
  parent_result.struct_size = sizeof(parent_result);
  assert(LB_CEF3_InvokeV4(&parent_call, &parent_result) == LB_CEF3_OK);
  assert(parent_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(parent_result.handle_value == 0);
  parent_call.arguments = &frame_extra_argument;
  parent_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&parent_call, &parent_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_CALL_V4 frame_browser_call{};
  frame_browser_call.struct_size = sizeof(frame_browser_call);
  frame_browser_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_browser_call.operation_id = UINT64_C(0x8b612c19dbb44753);
  frame_browser_call.target = frame_handle_for_close;
  LB_CEF3_RESULT_V4 frame_browser_result{};
  frame_browser_result.struct_size = sizeof(frame_browser_result);
  assert(LB_CEF3_InvokeV4(&frame_browser_call, &frame_browser_result) == LB_CEF3_OK);
  assert(frame_browser_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(frame_browser_result.handle_value == browser_a);
  assert(LB_CEF3_HandleRelease(frame_browser_result.handle_value) == LB_CEF3_OK);
  frame_browser_call.arguments = &frame_extra_argument;
  frame_browser_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(&frame_browser_call, &frame_browser_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  for (const auto operation_id : {
      UINT64_C(0x1e820e527e929ac2), UINT64_C(0x5c45632132143c4b)}) {
    LB_CEF3_CALL_V4 string_task_call{};
    string_task_call.struct_size = sizeof(string_task_call);
    string_task_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    string_task_call.operation_id = operation_id;
    string_task_call.target = frame_handle_for_close;
    LB_CEF3_RESULT_V4 string_task_result{};
    string_task_result.struct_size = sizeof(string_task_result);
    assert(LB_CEF3_InvokeV4(&string_task_call, &string_task_result) == LB_CEF3_OK);
    assert(string_task_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(LB_CEF3_HandleGetType(string_task_result.handle_value) == LB_CEF3_HANDLE_TASK);
    assert(WaitTask(string_task_result.handle_value) == LB_CEF3_TASK_SUCCEEDED);
    if (operation_id == UINT64_C(0x1e820e527e929ac2)) {
      assert(!TaskResult(string_task_result.handle_value).empty());
    }
    assert(LB_CEF3_TaskRelease(string_task_result.handle_value) == LB_CEF3_OK);
    string_task_call.arguments = &frame_extra_argument;
    string_task_call.argument_count = 1;
    assert(LB_CEF3_InvokeV4(&string_task_call, &string_task_result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }

  const auto frame_request = LB_CEF3_RequestCreate();
  assert(frame_request != 0);
  const std::wstring frame_request_url = frame_load_url + L"?frame-request";
  assert(LB_CEF3_RequestSetUrl(frame_request, frame_request_url.c_str()) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetMethod(frame_request, L"GET") == LB_CEF3_OK);
  assert(LB_CEF3_FrameLoadRequest(frame_handle_for_close, frame_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_request) == LB_CEF3_OK);
  const auto frame_request_deadline = GetTickCount64() + 15000;
  while (ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
          L"frame-request") == std::wstring::npos
      && GetTickCount64() < frame_request_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
      L"frame-request") != std::wstring::npos);

  const auto frame_request_v4 = LB_CEF3_RequestCreate();
  assert(frame_request_v4 != 0);
  const std::wstring frame_request_url_v4 = frame_load_url + L"?frame-request-v4";
  assert(LB_CEF3_RequestSetUrl(
      frame_request_v4, frame_request_url_v4.c_str()) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 frame_request_argument{};
  frame_request_argument.struct_size = sizeof(frame_request_argument);
  frame_request_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  frame_request_argument.handle_value = frame_request_v4;
  LB_CEF3_CALL_V4 frame_request_call{};
  frame_request_call.struct_size = sizeof(frame_request_call);
  frame_request_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_request_call.operation_id = UINT64_C(0x322ffb14dd389535);
  frame_request_call.target = frame_handle_for_close;
  frame_request_call.arguments = &frame_request_argument;
  frame_request_call.argument_count = 1;
  LB_CEF3_RESULT_V4 frame_request_result{};
  frame_request_result.struct_size = sizeof(frame_request_result);
  assert(LB_CEF3_InvokeV4(&frame_request_call, &frame_request_result) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_request_v4) == LB_CEF3_OK);
  const auto frame_request_v4_deadline = GetTickCount64() + 15000;
  while (ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
          L"frame-request-v4") == std::wstring::npos
      && GetTickCount64() < frame_request_v4_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(
      L"frame-request-v4") != std::wstring::npos);
  frame_request_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  assert(LB_CEF3_InvokeV4(&frame_request_call, &frame_request_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const std::wstring frame_load_url_v4 = frame_load_url + L"#v4";
  LB_CEF3_ARGUMENT_V4 frame_url_argument{};
  frame_url_argument.struct_size = sizeof(frame_url_argument);
  frame_url_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  frame_url_argument.text_value = frame_load_url_v4.c_str();
  LB_CEF3_CALL_V4 frame_url_call{};
  frame_url_call.struct_size = sizeof(frame_url_call);
  frame_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_url_call.operation_id = UINT64_C(0xc2e0016ab9a29873);
  frame_url_call.target = frame_handle_for_close;
  frame_url_call.arguments = &frame_url_argument;
  frame_url_call.argument_count = 1;
  LB_CEF3_RESULT_V4 frame_url_result{};
  frame_url_result.struct_size = sizeof(frame_url_result);
  assert(LB_CEF3_InvokeV4(&frame_url_call, &frame_url_result) == LB_CEF3_OK);
  const auto frame_load_v4_deadline = GetTickCount64() + 15000;
  while (ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(L"#v4")
          == std::wstring::npos
      && GetTickCount64() < frame_load_v4_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl).find(L"#v4")
      != std::wstring::npos);
  frame_url_argument.text_value = L"";
  assert(LB_CEF3_InvokeV4(&frame_url_call, &frame_url_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_ARGUMENT_V4 frame_script_arguments[3]{};
  frame_script_arguments[0].struct_size = sizeof(frame_script_arguments[0]);
  frame_script_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  frame_script_arguments[0].text_value = L"globalThis.__lingBuilderFrameV4=true;";
  frame_script_arguments[1].struct_size = sizeof(frame_script_arguments[1]);
  frame_script_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  frame_script_arguments[1].text_value = nullptr;
  frame_script_arguments[2].struct_size = sizeof(frame_script_arguments[2]);
  frame_script_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  frame_script_arguments[2].integer_value = 1;
  LB_CEF3_CALL_V4 frame_script_call{};
  frame_script_call.struct_size = sizeof(frame_script_call);
  frame_script_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  frame_script_call.operation_id = UINT64_C(0x6fb041f21ee1aea4);
  frame_script_call.target = frame_handle_for_close;
  frame_script_call.arguments = frame_script_arguments;
  frame_script_call.argument_count = 3;
  LB_CEF3_RESULT_V4 frame_script_result{};
  frame_script_result.struct_size = sizeof(frame_script_result);
  assert(LB_CEF3_InvokeV4(&frame_script_call, &frame_script_result) == LB_CEF3_OK);
  frame_script_arguments[2].integer_value =
      static_cast<int64_t>(std::numeric_limits<int>::max()) + 1;
  assert(LB_CEF3_InvokeV4(&frame_script_call, &frame_script_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::error_code frame_load_remove_error;
  std::filesystem::remove(frame_load_file, frame_load_remove_error);
  assert(!frame_load_remove_error);

  assert(LB_CEF3_HandleRelease(frame_identifiers) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_names) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(focused_frame) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(focused_frame_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_by_identifier_v4) == LB_CEF3_OK);
  if (named_frame != 0) assert(LB_CEF3_HandleRelease(named_frame) == LB_CEF3_OK);
  if (frame_by_name_v4 != 0) assert(LB_CEF3_HandleRelease(frame_by_name_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_identifiers_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_names_v4) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserRunFileDialog(browser_a, -1, L"无效", L"", L"[]") == 0);
  assert(LB_CEF3_BrowserRunFileDialog(browser_a, 0, L"无效", L"", L"{}") == 0);
  assert(LB_CEF3_BrowserRunFileDialog(0, 0, L"无效", L"", L"[]") == 0);
  assert(LB_CEF3_SetEventCallbackV4(0, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeAgentAttached(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeAgentDetached(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeEvent(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeMessage(browser_a, 1) == LB_CEF3_OK);
  const auto devtools_enable_task = LB_CEF3_DevToolsExecuteMethod(
      browser_a, L"Runtime.enable", L"{}");
  assert(devtools_enable_task != 0);
  assert(WaitTask(devtools_enable_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(devtools_enable_task) == LB_CEF3_OK);
  const auto devtools_console_task = LB_CEF3_DevToolsExecuteMethod(
      browser_a, L"Runtime.evaluate",
      L"{\"expression\":\"console.log('cef3-devtools-event')\",\"returnByValue\":true}");
  assert(devtools_console_task != 0);
  assert(WaitTask(devtools_console_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(devtools_console_task) == LB_CEF3_OK);
  const auto devtools_event_deadline = GetTickCount64() + 5000;
  while ((g_v4_devtools_agent_attached_events.load() < 1
      || g_v4_devtools_event_events.load() < 1
      || g_v4_devtools_message_events.load() < 1)
      && GetTickCount64() < devtools_event_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_devtools_agent_attached_events.load() >= 1);
  assert(g_v4_devtools_event_events.load() >= 1);
  assert(g_v4_devtools_message_events.load() >= 1);
  assert(LB_CEF3_DevToolsSubscribeAgentAttached(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeEvent(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeMessage(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_DevToolsSubscribeAgentDetached(browser_a, 0) == LB_CEF3_OK);
  const auto devtools_detached_deadline = GetTickCount64() + 5000;
  while (g_v4_devtools_agent_detached_events.load() < 1
      && GetTickCount64() < devtools_detached_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_devtools_agent_detached_events.load() >= 1);
  const int has_dev_tools = LB_CEF3_BrowserHasDevTools(browser_a);
  assert(has_dev_tools == 0 || has_dev_tools == 1);
  const auto file_dialog_script = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a,
      L"(()=>{const input=document.createElement('input');input.type='file';input.accept='.txt';"
      L"input.style.cssText='position:fixed;left:10px;top:10px;width:180px;height:40px;z-index:9999';"
      L"document.body.appendChild(input);return 'file-dialog-ready';})()");
  assert(file_dialog_script != 0);
  assert(WaitTask(file_dialog_script) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(file_dialog_script) == LB_CEF3_OK);
  LB_CEF3_MOUSE_EVENT_V3 file_dialog_mouse{};
  file_dialog_mouse.struct_size = sizeof(file_dialog_mouse);
  file_dialog_mouse.abi_version = LB_CEF3_ABI_VERSION_V3;
  file_dialog_mouse.x = 30;
  file_dialog_mouse.y = 30;
  assert(LB_CEF3_BrowserSetFocus(browser_a, 1) == LB_CEF3_OK);
  const auto request_file_dialog_from_user_gesture = [&]() {
    assert(LB_CEF3_BrowserSendMouseMoveEvent(browser_a, &file_dialog_mouse, 0) == LB_CEF3_OK);
    assert(LB_CEF3_BrowserSendMouseClickEvent(
        browser_a, &file_dialog_mouse, LB_CEF3_MOUSE_BUTTON_LEFT, 0, 1) == LB_CEF3_OK);
    assert(LB_CEF3_BrowserSendMouseClickEvent(
        browser_a, &file_dialog_mouse, LB_CEF3_MOUSE_BUTTON_LEFT, 1, 1) == LB_CEF3_OK);
  };
  request_file_dialog_from_user_gesture();
  auto next_file_dialog_gesture_retry = GetTickCount64() + 500;
  const auto file_dialog_event_deadline = GetTickCount64() + 5000;
  while (g_v4_file_dialog_events.load() < 1 && GetTickCount64() < file_dialog_event_deadline) {
    PumpHostMessages();
    if (g_v4_file_dialog_events.load() >= 1) break;
    if (GetTickCount64() >= next_file_dialog_gesture_retry) {
      request_file_dialog_from_user_gesture();
      next_file_dialog_gesture_retry = GetTickCount64() + 500;
    }
    Sleep(10);
  }
  assert(g_v4_file_dialog_events.load() == 1);
  const auto file_dialog_continuation = g_v4_file_dialog_continuation.load();
  assert(file_dialog_continuation != 0);
  assert(LB_CEF3_HandleGetType(file_dialog_continuation) == LB_CEF3_HANDLE_CONTINUATION);
  assert(LB_CEF3_ContinuationCompleteV4(file_dialog_continuation, 2, L"{}") == LB_CEF3_OK);
  assert(LB_CEF3_ContinuationCompleteV4(file_dialog_continuation, 1, L"{}") == LB_CEF3_ERROR_CANCELLED);
  assert(LB_CEF3_ContinuationReleaseV4(file_dialog_continuation) == LB_CEF3_OK);
  g_v4_file_dialog_continuation.store(0);
  const auto clear_file_dialog_input = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a, L"document.querySelector('input[type=file]')?.remove(); 'file-dialog-cleared';");
  assert(clear_file_dialog_input != 0);
  assert(WaitTask(clear_file_dialog_input) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(clear_file_dialog_input) == LB_CEF3_OK);
  const auto timeout_file_dialog_script = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a,
      L"(()=>{const input=document.createElement('input');input.type='file';input.accept='.txt';"
      L"input.style.cssText='position:fixed;left:10px;top:10px;width:180px;height:40px;z-index:9999';"
      L"document.body.appendChild(input);return 'file-dialog-timeout-ready';})()");
  assert(timeout_file_dialog_script != 0);
  assert(WaitTask(timeout_file_dialog_script) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(timeout_file_dialog_script) == LB_CEF3_OK);
  request_file_dialog_from_user_gesture();
  next_file_dialog_gesture_retry = GetTickCount64() + 500;
  const auto timeout_event_deadline = GetTickCount64() + 5000;
  while (g_v4_file_dialog_events.load() < 2 && GetTickCount64() < timeout_event_deadline) {
    PumpHostMessages();
    if (g_v4_file_dialog_events.load() >= 2) break;
    if (GetTickCount64() >= next_file_dialog_gesture_retry) {
      request_file_dialog_from_user_gesture();
      next_file_dialog_gesture_retry = GetTickCount64() + 500;
    }
    Sleep(10);
  }
  assert(g_v4_file_dialog_events.load() == 2);
  const auto timeout_continuation = g_v4_file_dialog_continuation.load();
  assert(timeout_continuation != 0 && timeout_continuation != file_dialog_continuation);
  const auto continuation_timeout_deadline = GetTickCount64() + 2500;
  while (GetTickCount64() < continuation_timeout_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(LB_CEF3_ContinuationCompleteV4(timeout_continuation, 1, L"{}")
      == LB_CEF3_ERROR_CANCELLED);
  assert(LB_CEF3_ContinuationReleaseV4(timeout_continuation) == LB_CEF3_OK);
  const auto timeout_cancel_barrier = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a, L"document.querySelector('input[type=file]')?.remove(); 'file-dialog-timeout-cancelled';");
  assert(timeout_cancel_barrier != 0);
  assert(WaitTask(timeout_cancel_barrier) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(timeout_cancel_barrier) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(UINT64_MAX, TestEventCallbackV4, nullptr)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ContinuationCompleteV4(0, 1, L"{}") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ContinuationCancelV4(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ContinuationReleaseV4(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 has_document_call{};
  has_document_call.struct_size = sizeof(has_document_call);
  has_document_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  has_document_call.operation_id = UINT64_C(0x77be1f7b9053766a);
  has_document_call.target = browser_a;
  LB_CEF3_RESULT_V4 has_document_result{};
  has_document_result.struct_size = sizeof(has_document_result);
  assert(LB_CEF3_InvokeV4(&has_document_call, &has_document_result) == LB_CEF3_OK);
  assert(has_document_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(has_document_result.integer_value == 1);
  assert(LB_CEF3_BrowserIsWindowRenderingDisabled(browser_a) == 0);
  LB_CEF3_CALL_V4 window_rendering_call{};
  window_rendering_call.struct_size = sizeof(window_rendering_call);
  window_rendering_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  window_rendering_call.operation_id = UINT64_C(0xe768fb6f07f304b1);
  window_rendering_call.target = browser_a;
  LB_CEF3_RESULT_V4 window_rendering_result{};
  window_rendering_result.struct_size = sizeof(window_rendering_result);
  assert(LB_CEF3_InvokeV4(&window_rendering_call, &window_rendering_result) == LB_CEF3_OK);
  assert(window_rendering_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(window_rendering_result.integer_value == 0);
  assert(LB_CEF3_BrowserIsFullscreen(browser_a) == 0);
  LB_CEF3_CALL_V4 fullscreen_call{};
  fullscreen_call.struct_size = sizeof(fullscreen_call);
  fullscreen_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  fullscreen_call.operation_id = UINT64_C(0x8bc497e65b3a2da4);
  fullscreen_call.target = browser_a;
  LB_CEF3_RESULT_V4 fullscreen_result{};
  fullscreen_result.struct_size = sizeof(fullscreen_result);
  assert(LB_CEF3_InvokeV4(&fullscreen_call, &fullscreen_result) == LB_CEF3_OK);
  assert(fullscreen_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(fullscreen_result.integer_value == 0);
  const int has_view = LB_CEF3_BrowserHasView(browser_a);
  assert(has_view == 0 || has_view == 1);
  LB_CEF3_CALL_V4 has_view_call{};
  has_view_call.struct_size = sizeof(has_view_call);
  has_view_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  has_view_call.operation_id = UINT64_C(0xcb37c0c413d0e8bb);
  has_view_call.target = browser_a;
  LB_CEF3_RESULT_V4 has_view_result{};
  has_view_result.struct_size = sizeof(has_view_result);
  assert(LB_CEF3_InvokeV4(&has_view_call, &has_view_result) == LB_CEF3_OK);
  assert(has_view_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(has_view_result.integer_value == has_view);
  LB_CEF3_ARGUMENT_V4 invalid_has_view_argument{};
  invalid_has_view_argument.struct_size = sizeof(invalid_has_view_argument);
  invalid_has_view_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  has_view_call.argument_count = 1;
  has_view_call.arguments = &invalid_has_view_argument;
  assert(LB_CEF3_InvokeV4(&has_view_call, &has_view_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const int opener_identifier = LB_CEF3_BrowserGetOpenerIdentifier(browser_a);
  assert(opener_identifier >= 0);
  LB_CEF3_CALL_V4 opener_identifier_call{};
  opener_identifier_call.struct_size = sizeof(opener_identifier_call);
  opener_identifier_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  opener_identifier_call.operation_id = UINT64_C(0xf1868f61b89b706a);
  opener_identifier_call.target = browser_a;
  LB_CEF3_RESULT_V4 opener_identifier_result{};
  opener_identifier_result.struct_size = sizeof(opener_identifier_result);
  assert(LB_CEF3_InvokeV4(
      &opener_identifier_call, &opener_identifier_result) == LB_CEF3_OK);
  assert(opener_identifier_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(opener_identifier_result.integer_value == opener_identifier);
  LB_CEF3_ARGUMENT_V4 invalid_opener_identifier_argument{};
  invalid_opener_identifier_argument.struct_size = sizeof(invalid_opener_identifier_argument);
  invalid_opener_identifier_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  opener_identifier_call.argument_count = 1;
  opener_identifier_call.arguments = &invalid_opener_identifier_argument;
  assert(LB_CEF3_InvokeV4(&opener_identifier_call, &opener_identifier_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto invoke_browser_host_v4 = [](
      LB_CEF3_OPERATION_ID operation_id, LB_CEF3_HANDLE target,
      const LB_CEF3_ARGUMENT_V4* arguments, size_t argument_count) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = target;
    call.arguments = arguments;
    call.argument_count = argument_count;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    const int invoke_status = LB_CEF3_InvokeV4(&call, &result);
    if (invoke_status != LB_CEF3_OK) {
      std::fwprintf(stderr, L"BrowserHost V4 failed: operation=0x%016llx status=%d\n",
                    static_cast<unsigned long long>(operation_id), invoke_status);
      std::fflush(stderr);
    }
    assert(invoke_status == LB_CEF3_OK);
    return result;
  };

  LB_CEF3_HANDLE browser_alias = 0;
  assert(LB_CEF3_BrowserGetBrowser(browser_a, &browser_alias) == LB_CEF3_OK);
  assert(browser_alias == browser_a);
  assert(LB_CEF3_HandleGetType(browser_alias) == LB_CEF3_HANDLE_BROWSER);
  assert(LB_CEF3_HandleRelease(browser_alias) == LB_CEF3_OK);
  auto browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x387da7643274a438), browser_a, nullptr, 0);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(browser_host_result.handle_value == browser_a);
  assert(LB_CEF3_HandleRelease(browser_host_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_HANDLE client = 0;
  assert(LB_CEF3_BrowserGetClient(browser_a, &client) == LB_CEF3_OK);
  assert(client != 0 && LB_CEF3_HandleGetType(client) == LB_CEF3_HANDLE_CLIENT);
  assert(LB_CEF3_HandleIsValid(client, LB_CEF3_HANDLE_CLIENT) == LB_CEF3_OK);
  assert(LB_CEF3_HandleIsValid(client, LB_CEF3_HANDLE_BROWSER) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_HandleRelease(client) == LB_CEF3_OK);
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x435d8bfaa482b4c2), browser_a, nullptr, 0);
  assert(browser_host_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(browser_host_result.handle_value) == LB_CEF3_HANDLE_CLIENT);
  assert(LB_CEF3_HandleRelease(browser_host_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_HANDLE browser_window_alias = 0;
  assert(LB_CEF3_BrowserGetWindowHandle(
      browser_a, &browser_window_alias) == LB_CEF3_OK);
  assert(browser_window_alias == browser_a);
  assert(LB_CEF3_HandleRelease(browser_window_alias) == LB_CEF3_OK);
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0xab3176e7386b50f3), browser_a, nullptr, 0);
  assert(browser_host_result.handle_value == browser_a);
  assert(LB_CEF3_HandleRelease(browser_host_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_HANDLE opener_window_alias = UINT64_MAX;
  assert(LB_CEF3_BrowserGetOpenerWindowHandle(browser_a, &opener_window_alias) == LB_CEF3_OK);
  assert(opener_window_alias == 0);
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x779ccbd732f35629), browser_a, nullptr, 0);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(browser_host_result.handle_value == 0);

  const int can_execute_chrome = LB_CEF3_BrowserCanExecuteChromeCommand(browser_a, 0);
  assert(can_execute_chrome == 0 || can_execute_chrome == 1);
  LB_CEF3_ARGUMENT_V4 chrome_arguments[2]{};
  for (auto& argument : chrome_arguments) argument.struct_size = sizeof(argument);
  chrome_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  chrome_arguments[0].integer_value = 0;
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x8b11775147668f25), browser_a, chrome_arguments, 1);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(browser_host_result.integer_value == can_execute_chrome);
  constexpr int32_t kWindowOpenCurrentTab = 1;
  assert(LB_CEF3_BrowserExecuteChromeCommand(
      browser_a, 0, kWindowOpenCurrentTab) == LB_CEF3_OK);
  chrome_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  chrome_arguments[1].integer_value = kWindowOpenCurrentTab;
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x7b541caac9fdcf9d), browser_a, chrome_arguments, 2);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  chrome_arguments[1].integer_value = std::numeric_limits<int32_t>::max();
  LB_CEF3_CALL_V4 invalid_chrome_call{};
  invalid_chrome_call.struct_size = sizeof(invalid_chrome_call);
  invalid_chrome_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  invalid_chrome_call.operation_id = UINT64_C(0x7b541caac9fdcf9d);
  invalid_chrome_call.target = browser_a;
  invalid_chrome_call.arguments = chrome_arguments;
  invalid_chrome_call.argument_count = 2;
  LB_CEF3_RESULT_V4 invalid_chrome_result{};
  invalid_chrome_result.struct_size = sizeof(invalid_chrome_result);
  assert(LB_CEF3_InvokeV4(&invalid_chrome_call, &invalid_chrome_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  constexpr char kDevToolsMessage[] = "{\"id\":903,\"method\":\"Runtime.enable\"}";
  const auto devtools_message = LB_CEF3_BufferCreate(
      kDevToolsMessage, sizeof(kDevToolsMessage) - 1);
  assert(devtools_message != 0);
  const int devtools_submitted = LB_CEF3_BrowserSendDevToolsMessage(
      browser_a, devtools_message);
  assert(devtools_submitted == 0 || devtools_submitted == 1);
  LB_CEF3_ARGUMENT_V4 devtools_message_argument{};
  devtools_message_argument.struct_size = sizeof(devtools_message_argument);
  devtools_message_argument.value_kind = LB_CEF3_VALUE_V4_BUFFER;
  devtools_message_argument.buffer_value = devtools_message;
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x0abcdbbfb9732395), browser_a, &devtools_message_argument, 1);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(browser_host_result.integer_value == 0 || browser_host_result.integer_value == 1);
  assert(LB_CEF3_BufferRelease(devtools_message) == LB_CEF3_OK);

  constexpr wchar_t kDownloadImageDataUrl[] =
      L"data:image/png;base64,"
      L"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  assert(LB_CEF3_BrowserDownloadImage(browser_a, nullptr, 0, 0, 0) == 0);
  assert(LB_CEF3_BrowserDownloadImage(browser_a, kDownloadImageDataUrl, 2, 0, 0) == 0);
  const auto download_image_task = LB_CEF3_BrowserDownloadImage(
      browser_a, kDownloadImageDataUrl, 0, 0, 1);
  assert(download_image_task != 0);
  assert(LB_CEF3_HandleGetType(download_image_task) == LB_CEF3_HANDLE_TASK);
  assert(WaitTask(download_image_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  const auto download_image_json = TaskResult(download_image_task);
  assert(download_image_json.find(L"\"hasImage\":true") != std::wstring::npos);
  assert(download_image_json.find(L"imageHandle") == std::wstring::npos);
  LB_CEF3_HANDLE downloaded_image = 0;
  assert(LB_CEF3_TaskTakeImageResult(download_image_task, &downloaded_image)
      == LB_CEF3_OK);
  assert(downloaded_image != 0);
  assert(LB_CEF3_HandleGetType(downloaded_image) == LB_CEF3_HANDLE_IMAGE);
  assert(LB_CEF3_ImageIsEmpty(downloaded_image) == 0);
  assert(LB_CEF3_ImageGetWidth(downloaded_image) >= 1);
  assert(LB_CEF3_ImageGetHeight(downloaded_image) >= 1);
  LB_CEF3_HANDLE duplicate_downloaded_image = UINT64_MAX;
  assert(LB_CEF3_TaskTakeImageResult(
      download_image_task, &duplicate_downloaded_image) == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_downloaded_image == 0);
  assert(LB_CEF3_HandleRelease(downloaded_image) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(download_image_task) == LB_CEF3_OK);

  std::array<LB_CEF3_ARGUMENT_V4, 4> download_image_arguments{};
  for (auto& argument : download_image_arguments) {
    argument.struct_size = sizeof(argument);
  }
  download_image_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  download_image_arguments[0].text_value = kDownloadImageDataUrl;
  download_image_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  download_image_arguments[1].integer_value = 0;
  download_image_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  download_image_arguments[2].integer_value = 1;
  download_image_arguments[3].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  download_image_arguments[3].integer_value = 0;
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x17c6794f2d1083a9), browser_a,
      download_image_arguments.data(), download_image_arguments.size());
  const auto download_image_v4_task = browser_host_result.handle_value;
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(download_image_v4_task != 0);
  assert(WaitTask(download_image_v4_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0xf1cd57e06bf0576d), download_image_v4_task, nullptr, 0);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(browser_host_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(browser_host_result.handle_value)
      == LB_CEF3_HANDLE_IMAGE);
  assert(LB_CEF3_HandleRelease(browser_host_result.handle_value) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 invalid_download_callback_call{};
  invalid_download_callback_call.struct_size = sizeof(invalid_download_callback_call);
  invalid_download_callback_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  invalid_download_callback_call.operation_id = UINT64_C(0xf1cd57e06bf0576d);
  invalid_download_callback_call.target = download_image_v4_task;
  invalid_download_callback_call.arguments = download_image_arguments.data();
  invalid_download_callback_call.argument_count = 1;
  LB_CEF3_RESULT_V4 invalid_download_callback_result{};
  invalid_download_callback_result.struct_size = sizeof(invalid_download_callback_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_download_callback_call, &invalid_download_callback_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  download_image_arguments[1].integer_value = 2;
  LB_CEF3_CALL_V4 invalid_download_image_call{};
  invalid_download_image_call.struct_size = sizeof(invalid_download_image_call);
  invalid_download_image_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  invalid_download_image_call.operation_id = UINT64_C(0x17c6794f2d1083a9);
  invalid_download_image_call.target = browser_a;
  invalid_download_image_call.arguments = download_image_arguments.data();
  invalid_download_image_call.argument_count = download_image_arguments.size();
  LB_CEF3_RESULT_V4 invalid_download_image_result{};
  invalid_download_image_result.struct_size = sizeof(invalid_download_image_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_download_image_call, &invalid_download_image_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TaskRelease(download_image_v4_task) == LB_CEF3_OK);

  assert(LB_CEF3_SetEventCallbackV4(0, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeBeforeBrowse(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeDocumentAvailable(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeOpenUrlFromTab(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeRenderProcessTerminated(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeRenderViewReady(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeSelectClientCertificate(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeProtocolExecution(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceLoadComplete(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceRedirect(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceResponse(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeCookieAccessFilter(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_CookieAccessFilterSubscribeCanSendCookie(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_CookieAccessFilterSubscribeCanSaveCookie(browser_b, 1)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad(browser_b, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_CookieAccessFilterSubscribeCanSendCookie(browser_b, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestHandlerSubscribeBeforeBrowse(browser_b, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestHandlerSubscribeBeforeBrowse(0, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_ARGUMENT_V4 request_handler_subscription_argument{};
  request_handler_subscription_argument.struct_size =
      sizeof(request_handler_subscription_argument);
  request_handler_subscription_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  request_handler_subscription_argument.integer_value = 1;
  for (const auto operation_id : {
      UINT64_C(0x68376fb9f74e1c33), UINT64_C(0x5973027f3dcdf4a2),
      UINT64_C(0xd597e9e1ceaebbee), UINT64_C(0xb36cc01b1ecc4345),
      UINT64_C(0x032c68dddd1c844d), UINT64_C(0xf3e849b56f9a96b5)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, browser_b, &request_handler_subscription_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value == LB_CEF3_OK);
  }
  for (const auto operation_id : {
      UINT64_C(0xa3693dfc0581f9b6), UINT64_C(0xfff56fd9517bd931),
      UINT64_C(0xe0ceda2dcb349971), UINT64_C(0xc30d43360af59c98),
      UINT64_C(0x9c7ef5d6cf414ec9), UINT64_C(0x0eff952ecd77e212),
      UINT64_C(0x3ecbc994204fbd96), UINT64_C(0xc690761fd9ae0316)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, browser_b, &request_handler_subscription_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value == LB_CEF3_OK);
  }
  request_handler_subscription_argument.integer_value = 2;
  auto invalid_request_handler_subscription_call = make_view_call(
      UINT64_C(0x68376fb9f74e1c33), browser_b,
      &request_handler_subscription_argument, 1);
  LB_CEF3_RESULT_V4 invalid_request_handler_subscription_result{};
  invalid_request_handler_subscription_result.struct_size =
      sizeof(invalid_request_handler_subscription_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_request_handler_subscription_call,
      &invalid_request_handler_subscription_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  request_handler_subscription_argument.integer_value = 1;
  invalid_request_handler_subscription_call.target = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_request_handler_subscription_call,
      &invalid_request_handler_subscription_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_request_handler_subscription_call.target = browser_b;
  invalid_request_handler_subscription_call.arguments = nullptr;
  invalid_request_handler_subscription_call.argument_count = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_request_handler_subscription_call,
      &invalid_request_handler_subscription_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const int before_browse_count = g_v4_before_browse_events.load();
  const int document_available_count = g_v4_document_available_events.load();
  const int before_resource_load_count = g_v4_before_resource_load_events.load();
  const int resource_response_count = g_v4_resource_response_events.load();
  const int resource_load_complete_count =
      g_v4_resource_load_complete_events.load();
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b,
      L"data:text/html,<html><body>request-handler-test</body></html>")
      == LB_CEF3_OK);
  const auto request_handler_event_deadline = GetTickCount64() + 30000;
  while ((g_v4_before_browse_events.load() <= before_browse_count
          || g_v4_document_available_events.load()
              <= document_available_count
          || g_v4_before_resource_load_events.load()
              <= before_resource_load_count
          || g_v4_resource_response_events.load() <= resource_response_count
          || g_v4_resource_load_complete_events.load()
              <= resource_load_complete_count)
      && GetTickCount64() < request_handler_event_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_before_browse_events.load() > before_browse_count);
  assert(g_v4_document_available_events.load() > document_available_count);
  assert(g_v4_before_resource_load_events.load() > before_resource_load_count);
  assert(g_v4_resource_response_events.load() > resource_response_count);
  assert(g_v4_resource_load_complete_events.load()
      > resource_load_complete_count);
  uint64_t invalid_certificate_collection_count = UINT64_MAX;
  assert(LB_CEF3_CertificateCollectionGetCount(
      browser_b, &invalid_certificate_collection_count)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_certificate_collection_count == 0);
  LB_CEF3_HANDLE invalid_certificate_collection_item = UINT64_MAX;
  assert(LB_CEF3_CertificateCollectionGetAt(
      browser_b, 0, &invalid_certificate_collection_item)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_certificate_collection_item == 0);
  assert(LB_CEF3_CertificateCollectionGetCount(browser_b, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_SelectClientCertificateCallbackSelect(0, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_ARGUMENT_V4 select_client_certificate_argument{};
  select_client_certificate_argument.struct_size =
      sizeof(select_client_certificate_argument);
  select_client_certificate_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  select_client_certificate_argument.handle_value = 0;
  auto invalid_select_client_certificate_call = make_view_call(
      UINT64_C(0x54a4da14f2cef240), browser_b,
      &select_client_certificate_argument, 1);
  LB_CEF3_RESULT_V4 invalid_select_client_certificate_result{};
  invalid_select_client_certificate_result.struct_size =
      sizeof(invalid_select_client_certificate_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_select_client_certificate_call,
      &invalid_select_client_certificate_result) == LB_CEF3_ERROR_HANDLE_TYPE);
  invalid_select_client_certificate_call.target = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_select_client_certificate_call,
      &invalid_select_client_certificate_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_select_client_certificate_call.target = browser_b;
  select_client_certificate_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(
      &invalid_select_client_certificate_call,
      &invalid_select_client_certificate_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_DownloadSubscribeCanDownload(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeBeforeDownload(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeUpdated(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeUpdated(browser_a, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_DownloadSubscribeCanDownload(0, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_ARGUMENT_V4 download_subscription_argument{};
  download_subscription_argument.struct_size = sizeof(download_subscription_argument);
  download_subscription_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  download_subscription_argument.integer_value = 1;
  for (const auto operation_id : {
      UINT64_C(0xf5055a5a6c107622), UINT64_C(0x20b960324dca2993),
      UINT64_C(0x476494197c092f12)}) {
    const auto result = invoke_view_call(make_view_call(
        operation_id, browser_a, &download_subscription_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value == LB_CEF3_OK);
  }
  download_subscription_argument.integer_value = 2;
  auto invalid_download_subscription_call = make_view_call(
      UINT64_C(0xf5055a5a6c107622), browser_a,
      &download_subscription_argument, 1);
  LB_CEF3_RESULT_V4 invalid_download_subscription_result{};
  invalid_download_subscription_result.struct_size =
      sizeof(invalid_download_subscription_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_download_subscription_call,
      &invalid_download_subscription_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  download_subscription_argument.integer_value = 1;
  invalid_download_subscription_call.target = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_download_subscription_call,
      &invalid_download_subscription_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_download_subscription_call.target = browser_a;
  invalid_download_subscription_call.arguments = nullptr;
  invalid_download_subscription_call.argument_count = 0;
  assert(LB_CEF3_InvokeV4(
      &invalid_download_subscription_call,
      &invalid_download_subscription_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);

  constexpr wchar_t kDownloadItemDataUrl[] =
      L"data:application/octet-stream;base64,TGluZ0J1aWxkZXIgQ0VGMw==";
  LB_CEF3_HANDLE download_item = 0;
  LB_CEF3_HANDLE download_callback = 0;
  assert(LB_CEF3_BrowserGetLastDownloadItem(browser_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetLastDownloadItem(browser_a, &download_item)
      == LB_CEF3_ERROR_NOT_FOUND);
  assert(download_item == 0);
  assert(LB_CEF3_BrowserGetLastDownloadCallback(browser_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetLastDownloadCallback(
      browser_a, &download_callback) == LB_CEF3_ERROR_NOT_FOUND);
  assert(download_callback == 0);
  assert(LB_CEF3_BrowserStartDownload(browser_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserStartDownload(browser_a, kDownloadItemDataUrl)
      == LB_CEF3_OK);
  const auto before_download_continuation_deadline = GetTickCount64() + 5000;
  while (g_v4_before_download_continuation.load() == 0
      && GetTickCount64() < before_download_continuation_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  const auto before_download_continuation =
      g_v4_before_download_continuation.load();
  assert(before_download_continuation != 0);
  assert(LB_CEF3_HandleGetType(before_download_continuation)
      == LB_CEF3_HANDLE_CONTINUATION);
  assert(LB_CEF3_SelectClientCertificateCallbackSelect(
      before_download_continuation, 0) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_BeforeDownloadCallbackContinue(
      before_download_continuation,
      (root.parent_path() / L"denied-download.bin").c_str(), 0)
      == LB_CEF3_ERROR_PATH_DENIED);
  assert(LB_CEF3_BeforeDownloadCallbackContinue(
      before_download_continuation, L"", 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::array<LB_CEF3_ARGUMENT_V4, 2> before_download_arguments{};
  before_download_arguments[0].struct_size = sizeof(before_download_arguments[0]);
  before_download_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  before_download_arguments[0].text_value = L"";
  before_download_arguments[1].struct_size = sizeof(before_download_arguments[1]);
  before_download_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  before_download_arguments[1].integer_value = 0;
  before_download_arguments[1].integer_value = 2;
  auto invalid_before_download_call = make_view_call(
      UINT64_C(0x5d0b8ff8f2516fc9), before_download_continuation,
      before_download_arguments.data(), before_download_arguments.size());
  LB_CEF3_RESULT_V4 invalid_before_download_result{};
  invalid_before_download_result.struct_size = sizeof(invalid_before_download_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_before_download_call, &invalid_before_download_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  before_download_arguments[1].integer_value = 0;
  invalid_before_download_call.argument_count = 1;
  assert(LB_CEF3_InvokeV4(
      &invalid_before_download_call, &invalid_before_download_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto before_download_result = invoke_view_call(make_view_call(
      UINT64_C(0x5d0b8ff8f2516fc9), before_download_continuation,
      before_download_arguments.data(), before_download_arguments.size()));
  assert(before_download_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_BeforeDownloadCallbackContinue(
      before_download_continuation, nullptr, 0) == LB_CEF3_ERROR_CANCELLED);
  assert(LB_CEF3_ContinuationReleaseV4(before_download_continuation)
      == LB_CEF3_OK);
  g_v4_before_download_continuation.store(0);
  const auto download_item_deadline = GetTickCount64() + 30000;
  while (GetTickCount64() < download_item_deadline) {
    LB_CEF3_HANDLE current = 0;
    const int snapshot_status = LB_CEF3_BrowserGetLastDownloadItem(
        browser_a, &current);
    if (snapshot_status == LB_CEF3_OK) {
      if (download_item != 0) {
        assert(LB_CEF3_HandleRelease(download_item) == LB_CEF3_OK);
      }
      download_item = current;
      const int complete = LB_CEF3_DownloadItemIsComplete(download_item);
      const int canceled = LB_CEF3_DownloadItemIsCanceled(download_item);
      const int interrupted = LB_CEF3_DownloadItemIsInterrupted(download_item);
      assert(complete >= 0 && canceled >= 0 && interrupted >= 0);
      if (complete || canceled || interrupted) break;
    } else {
      assert(snapshot_status == LB_CEF3_ERROR_NOT_FOUND);
    }
    PumpHostMessages();
    Sleep(10);
  }
  assert(download_item != 0);
  assert(LB_CEF3_HandleGetType(download_item) == LB_CEF3_HANDLE_DOWNLOAD_ITEM);
  assert(LB_CEF3_DownloadItemIsValid(download_item) == 1);
  assert(LB_CEF3_DownloadItemIsInProgress(download_item) == 0);
  assert(LB_CEF3_DownloadItemIsComplete(download_item) == 1);
  assert(LB_CEF3_DownloadItemIsCanceled(download_item) == 0);
  assert(LB_CEF3_DownloadItemIsInterrupted(download_item) == 0);
  const int download_paused = LB_CEF3_DownloadItemIsPaused(download_item);
  assert(download_paused == 0 || download_paused == 1);
  assert(LB_CEF3_DownloadItemIsValid(browser_a) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(g_v4_download_control_phase.load() == 2);
  assert(LB_CEF3_BrowserGetLastDownloadCallback(
      browser_a, &download_callback) == LB_CEF3_OK);
  assert(download_callback != 0);
  assert(LB_CEF3_HandleGetType(download_callback)
      == LB_CEF3_HANDLE_DOWNLOAD_CALLBACK);
  assert(LB_CEF3_DownloadItemCallbackPause(download_callback) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemCallbackResume(download_callback) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemCallbackCancel(download_callback) == LB_CEF3_OK);
  {
    const auto result = invoke_view_call(make_view_call(
        UINT64_C(0x62afda49d97c1fc7), download_callback));
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  LB_CEF3_ARGUMENT_V4 invalid_download_callback_argument{};
  invalid_download_callback_argument.struct_size =
      sizeof(invalid_download_callback_argument);
  invalid_download_callback_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto invalid_download_control_call = make_view_call(
      UINT64_C(0x97bcf023fbe149da), download_callback,
      &invalid_download_callback_argument, 1);
  LB_CEF3_RESULT_V4 invalid_download_control_result{};
  invalid_download_control_result.struct_size =
      sizeof(invalid_download_control_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_download_control_call, &invalid_download_control_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_download_control_call.arguments = nullptr;
  invalid_download_control_call.argument_count = 0;
  invalid_download_control_call.target = download_item;
  assert(LB_CEF3_InvokeV4(
      &invalid_download_control_call, &invalid_download_control_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_DownloadItemCallbackPause(download_item)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE released_download_callback = 0;
  assert(LB_CEF3_BrowserGetLastDownloadCallback(
      browser_a, &released_download_callback) == LB_CEF3_OK);
  assert(released_download_callback != download_callback);
  assert(LB_CEF3_HandleRelease(released_download_callback) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemCallbackResume(released_download_callback)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  int32_t download_interrupt_reason = -1;
  int32_t download_percent = -2;
  int64_t download_speed = -1;
  int64_t download_total = -2;
  int64_t download_received = -1;
  int64_t download_start_time = 0;
  int64_t download_end_time = 0;
  uint32_t download_id = 0;
  assert(LB_CEF3_DownloadItemGetInterruptReason(
      download_item, &download_interrupt_reason) == LB_CEF3_OK);
  assert(download_interrupt_reason == 0);
  assert(LB_CEF3_DownloadItemGetCurrentSpeed(download_item, &download_speed)
      == LB_CEF3_OK);
  assert(download_speed >= 0);
  assert(LB_CEF3_DownloadItemGetPercentComplete(download_item, &download_percent)
      == LB_CEF3_OK);
  assert(download_percent == -1
      || (download_percent >= 0 && download_percent <= 100));
  assert(LB_CEF3_DownloadItemGetTotalBytes(download_item, &download_total)
      == LB_CEF3_OK);
  assert(download_total == -1 || download_total >= 0);
  assert(LB_CEF3_DownloadItemGetReceivedBytes(download_item, &download_received)
      == LB_CEF3_OK);
  assert(download_received > 0);
  assert(LB_CEF3_DownloadItemGetStartTime(download_item, &download_start_time)
      == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemGetEndTime(download_item, &download_end_time)
      == LB_CEF3_OK);
  assert(download_start_time > 0);
  assert(download_end_time >= download_start_time);
  assert(LB_CEF3_DownloadItemGetId(download_item, &download_id) == LB_CEF3_OK);
  assert(download_id != 0);
  assert(LB_CEF3_DownloadItemGetPercentComplete(download_item, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto download_full_path = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetFullPath);
  const auto download_url = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetUrl);
  const auto download_original_url = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetOriginalUrl);
  const auto download_suggested_name = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetSuggestedFileName);
  const auto download_content_disposition = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetContentDisposition);
  const auto download_mime_type = ReadManagedText(
      download_item, LB_CEF3_DownloadItemGetMimeType);
  assert(!download_full_path.empty());
  assert(std::filesystem::exists(download_full_path));
  assert(std::filesystem::weakly_canonical(download_full_path).parent_path()
      == std::filesystem::weakly_canonical(root));
  assert(download_url == kDownloadItemDataUrl);
  assert(download_original_url == kDownloadItemDataUrl);
  // Data URLs may not have a response filename. The bridge still exercises
  // the official getter through its UTF-16 two-stage ABI when it is empty.
  (void)download_suggested_name;
  (void)download_content_disposition;
  assert(!download_mime_type.empty());
  assert(g_v4_before_download_events.load() >= 1);
  assert(g_v4_download_updated_events.load() >= 1);

  const auto invoke_download_item_v4 = [&](uint64_t operation_id) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = download_item;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    return result;
  };
  for (const auto operation_id : {
      UINT64_C(0x0ade24559880881d), UINT64_C(0xd6b81a9e8536df1c),
      UINT64_C(0x7b611ef07ee974e4), UINT64_C(0xcbdf31dc3237ced7),
      UINT64_C(0xb731272f7d9c68d7), UINT64_C(0x9b46ef332f2b3b58)}) {
    const auto result = invoke_download_item_v4(operation_id);
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  }
  for (const auto operation_id : {
      UINT64_C(0x60ef80d492fa9568), UINT64_C(0x8ccd8dc42f73f378),
      UINT64_C(0x87bfd5712d66ef90), UINT64_C(0xc00f109accd0ffcb),
      UINT64_C(0xda5a8cbe9f8ea76d), UINT64_C(0xaff9b1f8b24036f0),
      UINT64_C(0xe6d97963aba04381), UINT64_C(0x1ec9f9d93e144047)}) {
    const auto result = invoke_download_item_v4(operation_id);
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  }
  for (const auto operation_id : {
      UINT64_C(0x1686d2ec791653de), UINT64_C(0x0dfb38163851bb82),
      UINT64_C(0x9c8f960815642b10), UINT64_C(0x289f6c0f771a3dad),
      UINT64_C(0xdabfc9bad56ac114), UINT64_C(0x7182a40e622dd572)}) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = download_item;
    (void)ReadV4Text(call);
  }
  LB_CEF3_ARGUMENT_V4 invalid_download_item_argument{};
  invalid_download_item_argument.struct_size = sizeof(invalid_download_item_argument);
  invalid_download_item_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  LB_CEF3_CALL_V4 invalid_download_item_call{};
  invalid_download_item_call.struct_size = sizeof(invalid_download_item_call);
  invalid_download_item_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  invalid_download_item_call.operation_id = UINT64_C(0x0ade24559880881d);
  invalid_download_item_call.target = download_item;
  invalid_download_item_call.arguments = &invalid_download_item_argument;
  invalid_download_item_call.argument_count = 1;
  LB_CEF3_RESULT_V4 invalid_download_item_result{};
  invalid_download_item_result.struct_size = sizeof(invalid_download_item_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_download_item_call, &invalid_download_item_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_download_item_call.argument_count = 0;
  invalid_download_item_call.arguments = nullptr;
  invalid_download_item_call.target = browser_a;
  assert(LB_CEF3_InvokeV4(
      &invalid_download_item_call, &invalid_download_item_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE released_download_item = 0;
  assert(LB_CEF3_BrowserGetLastDownloadItem(
      browser_a, &released_download_item) == LB_CEF3_OK);
  assert(released_download_item != download_item);
  assert(LB_CEF3_HandleRelease(released_download_item) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemIsValid(released_download_item)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  invalid_download_item_call.target = released_download_item;
  assert(LB_CEF3_InvokeV4(
      &invalid_download_item_call, &invalid_download_item_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  assert(g_before_download_events.load() >= 1);
  assert(g_download_updated_events.load() >= 1);
  assert(g_v4_before_download_events.load() >= 1);
  assert(g_v4_download_updated_events.load() >= 1);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeCanDownload(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeBeforeDownload(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeUpdated(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeBeforeBrowse(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeDocumentAvailable(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeOpenUrlFromTab(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeRenderProcessTerminated(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeRenderViewReady(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestHandlerSubscribeSelectClientCertificate(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeProtocolExecution(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceLoadComplete(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceRedirect(browser_b, 0)
      == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeResourceResponse(browser_b, 0)
      == LB_CEF3_OK);

  LB_CEF3_PDF_PRINT_SETTINGS_V3 pdf_settings{};
  pdf_settings.struct_size = sizeof(pdf_settings);
  pdf_settings.abi_version = LB_CEF3_ABI_VERSION_V3;
  pdf_settings.print_background = 1;
  pdf_settings.scale = 1.0;
  pdf_settings.paper_width = 8.5;
  pdf_settings.paper_height = 11.0;
  pdf_settings.margin_type = 0;
  const auto pdf_v3_path = root / L"browser-host" / L"print-v3.pdf";
  assert(LB_CEF3_BrowserPrintToPdf(browser_a, pdf_v3_path.c_str(), nullptr) == 0);
  assert(LB_CEF3_BrowserPrintToPdf(
      browser_a, (root.parent_path() / L"denied.pdf").c_str(), &pdf_settings) == 0);
  const auto pdf_v3_task = LB_CEF3_BrowserPrintToPdf(
      browser_a, pdf_v3_path.c_str(), &pdf_settings);
  assert(pdf_v3_task != 0);
  assert(WaitTask(pdf_v3_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(pdf_v3_task).find(L"\"ok\":true") != std::wstring::npos);
  assert(std::filesystem::is_regular_file(pdf_v3_path));
  assert(std::filesystem::file_size(pdf_v3_path) > 4);
  LB_CEF3_CALL_V4 pdf_callback_call{};
  pdf_callback_call.struct_size = sizeof(pdf_callback_call);
  pdf_callback_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  pdf_callback_call.operation_id = UINT64_C(0xc266307daa938299);
  pdf_callback_call.target = pdf_v3_task;
  assert(ReadV4Json(pdf_callback_call).find(L"\"ok\":true")
      != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(pdf_v3_task) == LB_CEF3_OK);

  const auto pdf_settings_v4 = LB_CEF3_DictionaryCreate();
  assert(pdf_settings_v4 != 0);
  const auto pdf_v4_path = root / L"browser-host" / L"print-v4.pdf";
  const auto pdf_v4_path_text = pdf_v4_path.wstring();
  std::array<LB_CEF3_ARGUMENT_V4, 2> pdf_arguments{};
  pdf_arguments[0].struct_size = sizeof(pdf_arguments[0]);
  pdf_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  pdf_arguments[0].text_value = pdf_v4_path_text.c_str();
  pdf_arguments[1].struct_size = sizeof(pdf_arguments[1]);
  pdf_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  pdf_arguments[1].handle_value = pdf_settings_v4;
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0xaa6dc18d23c88b76), browser_a,
      pdf_arguments.data(), pdf_arguments.size());
  const auto pdf_v4_task = browser_host_result.handle_value;
  assert(pdf_v4_task != 0);
  assert(WaitTask(pdf_v4_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(std::filesystem::is_regular_file(pdf_v4_path));
  assert(std::filesystem::file_size(pdf_v4_path) > 4);
  pdf_callback_call.target = pdf_v4_task;
  assert(ReadV4Json(pdf_callback_call).find(L"\"ok\":true")
      != std::wstring::npos);
  pdf_callback_call.arguments = pdf_arguments.data();
  pdf_callback_call.argument_count = 1;
  LB_CEF3_RESULT_V4 invalid_pdf_callback_result{};
  invalid_pdf_callback_result.struct_size = sizeof(invalid_pdf_callback_result);
  assert(LB_CEF3_InvokeV4(&pdf_callback_call, &invalid_pdf_callback_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TaskRelease(pdf_v4_task) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(pdf_settings_v4) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-host-callback-tasks\n");
  std::fflush(stderr);

  constexpr int32_t kAccessibilityDefault = 0;
  assert(LB_CEF3_BrowserSetAccessibilityState(
      browser_a, kAccessibilityDefault) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 accessibility_argument{};
  accessibility_argument.struct_size = sizeof(accessibility_argument);
  accessibility_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  accessibility_argument.integer_value = kAccessibilityDefault;
  (void)invoke_browser_host_v4(
      UINT64_C(0xb4fdebd2a6743f41), browser_a, &accessibility_argument, 1);
  LB_CEF3_ARGUMENT_V4 ax_collapse_argument{};
  ax_collapse_argument.struct_size = sizeof(ax_collapse_argument);
  ax_collapse_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  ax_collapse_argument.integer_value = 0;
  assert(LB_CEF3_BrowserSetAxViewportCollapse(browser_a, 0) == LB_CEF3_OK);
  (void)invoke_browser_host_v4(
      UINT64_C(0x2358d182782d8b2d), browser_a, &ax_collapse_argument, 1);

  LB_CEF3_ARGUMENT_V4 invalid_dialog_arguments[4]{};
  for (auto& argument : invalid_dialog_arguments) argument.struct_size = sizeof(argument);
  invalid_dialog_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  invalid_dialog_arguments[0].integer_value = -1;
  invalid_dialog_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  invalid_dialog_arguments[1].text_value = L"无效";
  invalid_dialog_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
  invalid_dialog_arguments[2].text_value = L"";
  invalid_dialog_arguments[3].value_kind = LB_CEF3_VALUE_V4_JSON;
  invalid_dialog_arguments[3].text_value = L"[]";
  LB_CEF3_CALL_V4 invalid_dialog_call{};
  invalid_dialog_call.struct_size = sizeof(invalid_dialog_call);
  invalid_dialog_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  invalid_dialog_call.operation_id = UINT64_C(0x3e9fc8814abeccf4);
  invalid_dialog_call.target = browser_a;
  invalid_dialog_call.arguments = invalid_dialog_arguments;
  invalid_dialog_call.argument_count = 4;
  LB_CEF3_RESULT_V4 invalid_dialog_result{};
  invalid_dialog_result.struct_size = sizeof(invalid_dialog_result);
  assert(LB_CEF3_InvokeV4(&invalid_dialog_call, &invalid_dialog_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserIsReadyToBeClosed(browser_a) == 0);
  LB_CEF3_CALL_V4 ready_to_close_call{};
  ready_to_close_call.struct_size = sizeof(ready_to_close_call);
  ready_to_close_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  ready_to_close_call.operation_id = UINT64_C(0x388a2040ddca8d55);
  ready_to_close_call.target = browser_a;
  LB_CEF3_RESULT_V4 ready_to_close_result{};
  ready_to_close_result.struct_size = sizeof(ready_to_close_result);
  assert(LB_CEF3_InvokeV4(&ready_to_close_call, &ready_to_close_result) == LB_CEF3_OK);
  assert(ready_to_close_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(ready_to_close_result.integer_value == 0);
  assert(LB_CEF3_BrowserIsRenderProcessUnresponsive(browser_a) == 0);
  LB_CEF3_CALL_V4 render_unresponsive_call{};
  render_unresponsive_call.struct_size = sizeof(render_unresponsive_call);
  render_unresponsive_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  render_unresponsive_call.operation_id = UINT64_C(0x1694807f232f08c3);
  render_unresponsive_call.target = browser_a;
  LB_CEF3_RESULT_V4 render_unresponsive_result{};
  render_unresponsive_result.struct_size = sizeof(render_unresponsive_result);
  assert(LB_CEF3_InvokeV4(&render_unresponsive_call, &render_unresponsive_result) == LB_CEF3_OK);
  assert(render_unresponsive_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(render_unresponsive_result.integer_value == 0);
  const int runtime_style = LB_CEF3_BrowserGetRuntimeStyle(browser_a);
  assert(runtime_style == LB_CEF3_RUNTIME_STYLE_CHROME
      || runtime_style == LB_CEF3_RUNTIME_STYLE_ALLOY);
  LB_CEF3_CALL_V4 runtime_style_call{};
  runtime_style_call.struct_size = sizeof(runtime_style_call);
  runtime_style_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  runtime_style_call.operation_id = UINT64_C(0xe2abbb3d95d24ce1);
  runtime_style_call.target = browser_a;
  LB_CEF3_RESULT_V4 runtime_style_result{};
  runtime_style_result.struct_size = sizeof(runtime_style_result);
  assert(LB_CEF3_InvokeV4(&runtime_style_call, &runtime_style_result) == LB_CEF3_OK);
  assert(runtime_style_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(runtime_style_result.integer_value == runtime_style);
  LB_CEF3_ARGUMENT_V4 invalid_runtime_style_argument{};
  invalid_runtime_style_argument.struct_size = sizeof(invalid_runtime_style_argument);
  invalid_runtime_style_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  runtime_style_call.argument_count = 1;
  runtime_style_call.arguments = &invalid_runtime_style_argument;
  assert(LB_CEF3_InvokeV4(&runtime_style_call, &runtime_style_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  double zoom_level = 1.0;
  assert(LB_CEF3_BrowserGetZoomLevel(browser_a, &zoom_level) == LB_CEF3_OK);
  assert(std::isfinite(zoom_level));
  LB_CEF3_CALL_V4 zoom_level_call{};
  zoom_level_call.struct_size = sizeof(zoom_level_call);
  zoom_level_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  zoom_level_call.operation_id = UINT64_C(0xe2061433189ad965);
  zoom_level_call.target = browser_a;
  LB_CEF3_RESULT_V4 zoom_level_result{};
  zoom_level_result.struct_size = sizeof(zoom_level_result);
  assert(LB_CEF3_InvokeV4(&zoom_level_call, &zoom_level_result) == LB_CEF3_OK);
  assert(zoom_level_result.value_kind == LB_CEF3_VALUE_V4_DOUBLE);
  assert(zoom_level_result.double_value == zoom_level);
  zoom_level_call.argument_count = 1;
  zoom_level_call.arguments = &invalid_runtime_style_argument;
  assert(LB_CEF3_InvokeV4(&zoom_level_call, &zoom_level_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  double default_zoom_level = 1.0;
  assert(LB_CEF3_BrowserGetDefaultZoomLevel(browser_a, &default_zoom_level) == LB_CEF3_OK);
  assert(std::isfinite(default_zoom_level));
  LB_CEF3_CALL_V4 default_zoom_level_call{};
  default_zoom_level_call.struct_size = sizeof(default_zoom_level_call);
  default_zoom_level_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  default_zoom_level_call.operation_id = UINT64_C(0x8de2d73852026ae9);
  default_zoom_level_call.target = browser_a;
  LB_CEF3_RESULT_V4 default_zoom_level_result{};
  default_zoom_level_result.struct_size = sizeof(default_zoom_level_result);
  assert(LB_CEF3_InvokeV4(&default_zoom_level_call, &default_zoom_level_result) == LB_CEF3_OK);
  assert(default_zoom_level_result.value_kind == LB_CEF3_VALUE_V4_DOUBLE);
  assert(default_zoom_level_result.double_value == default_zoom_level);
  default_zoom_level_call.argument_count = 1;
  default_zoom_level_call.arguments = &invalid_runtime_style_argument;
  assert(LB_CEF3_InvokeV4(&default_zoom_level_call, &default_zoom_level_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSetZoomLevel(browser_a, default_zoom_level) == LB_CEF3_OK);
  double updated_zoom_level = 0.0;
  const auto direct_zoom_apply_deadline = GetTickCount64() + 500;
  while (GetTickCount64() < direct_zoom_apply_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  const auto direct_zoom_deadline = GetTickCount64() + 5000;
  do {
    const int updated_zoom_status = LB_CEF3_BrowserGetZoomLevel(browser_a, &updated_zoom_level);
    assert(updated_zoom_status == LB_CEF3_OK);
    if (std::abs(updated_zoom_level - default_zoom_level) >= 0.000001) Sleep(10);
  } while (std::abs(updated_zoom_level - default_zoom_level) >= 0.000001
      && GetTickCount64() < direct_zoom_deadline);
  assert(std::abs(updated_zoom_level - default_zoom_level) < 0.000001);
  LB_CEF3_ARGUMENT_V4 set_zoom_level_argument{};
  set_zoom_level_argument.struct_size = sizeof(set_zoom_level_argument);
  set_zoom_level_argument.value_kind = LB_CEF3_VALUE_V4_DOUBLE;
  set_zoom_level_argument.double_value = default_zoom_level;
  LB_CEF3_CALL_V4 set_zoom_level_call{};
  set_zoom_level_call.struct_size = sizeof(set_zoom_level_call);
  set_zoom_level_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  set_zoom_level_call.operation_id = UINT64_C(0x01f93bacb659a1cc);
  set_zoom_level_call.target = browser_a;
  set_zoom_level_call.argument_count = 1;
  set_zoom_level_call.arguments = &set_zoom_level_argument;
  LB_CEF3_RESULT_V4 set_zoom_level_result{};
  set_zoom_level_result.struct_size = sizeof(set_zoom_level_result);
  assert(LB_CEF3_InvokeV4(&set_zoom_level_call, &set_zoom_level_result) == LB_CEF3_OK);
  assert(set_zoom_level_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  const auto v4_zoom_apply_deadline = GetTickCount64() + 500;
  while (GetTickCount64() < v4_zoom_apply_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  const auto v4_zoom_deadline = GetTickCount64() + 5000;
  do {
    assert(LB_CEF3_BrowserGetZoomLevel(browser_a, &updated_zoom_level) == LB_CEF3_OK);
    if (std::abs(updated_zoom_level - default_zoom_level) >= 0.000001) Sleep(10);
  } while (std::abs(updated_zoom_level - default_zoom_level) >= 0.000001
      && GetTickCount64() < v4_zoom_deadline);
  assert(std::abs(updated_zoom_level - default_zoom_level) < 0.000001);
  set_zoom_level_argument.double_value = std::numeric_limits<double>::infinity();
  assert(LB_CEF3_InvokeV4(&set_zoom_level_call, &set_zoom_level_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  set_zoom_level_argument.double_value = default_zoom_level;
  assert(LB_CEF3_InvokeV4(&set_zoom_level_call, &set_zoom_level_result) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 can_zoom_argument{};
  can_zoom_argument.struct_size = sizeof(can_zoom_argument);
  can_zoom_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  LB_CEF3_CALL_V4 can_zoom_call{};
  can_zoom_call.struct_size = sizeof(can_zoom_call);
  can_zoom_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  can_zoom_call.operation_id = UINT64_C(0x5ad0e45cb8e6749e);
  can_zoom_call.target = browser_a;
  can_zoom_call.argument_count = 1;
  can_zoom_call.arguments = &can_zoom_argument;
  LB_CEF3_RESULT_V4 can_zoom_result{};
  can_zoom_result.struct_size = sizeof(can_zoom_result);
  constexpr int kZoomCommandOut = 0;
  constexpr int kZoomCommandReset = 1;
  constexpr int kZoomCommandIn = 2;
  std::array<int, 3> can_zoom_by_command{};
  for (int command = 0; command <= 2; ++command) {
    const int can_zoom = LB_CEF3_BrowserCanZoom(browser_a, command);
    assert(can_zoom == 0 || can_zoom == 1);
    can_zoom_by_command[static_cast<size_t>(command)] = can_zoom;
    can_zoom_argument.integer_value = command;
    assert(LB_CEF3_InvokeV4(&can_zoom_call, &can_zoom_result) == LB_CEF3_OK);
    assert(can_zoom_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(can_zoom_result.integer_value == can_zoom);
  }
  can_zoom_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  can_zoom_argument.integer_value = 1;
  assert(LB_CEF3_InvokeV4(&can_zoom_call, &can_zoom_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  can_zoom_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  can_zoom_argument.integer_value = 3;
  assert(LB_CEF3_InvokeV4(&can_zoom_call, &can_zoom_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 zoom_argument{};
  zoom_argument.struct_size = sizeof(zoom_argument);
  zoom_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  LB_CEF3_CALL_V4 zoom_call{};
  zoom_call.struct_size = sizeof(zoom_call);
  zoom_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  zoom_call.operation_id = UINT64_C(0xf3349b11b851533b);
  zoom_call.target = browser_a;
  zoom_call.argument_count = 1;
  zoom_call.arguments = &zoom_argument;
  LB_CEF3_RESULT_V4 zoom_result{};
  zoom_result.struct_size = sizeof(zoom_result);
  if (can_zoom_by_command[kZoomCommandReset] == 0) {
    zoom_argument.integer_value = kZoomCommandReset;
    assert(LB_CEF3_BrowserZoom(browser_a, kZoomCommandReset) == LB_CEF3_ERROR_OPERATION_FAILED);
    assert(LB_CEF3_InvokeV4(&zoom_call, &zoom_result) == LB_CEF3_ERROR_OPERATION_FAILED);
  }
  zoom_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  assert(LB_CEF3_InvokeV4(&zoom_call, &zoom_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  zoom_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  zoom_argument.integer_value = 3;
  assert(LB_CEF3_InvokeV4(&zoom_call, &zoom_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSetAudioMuted(browser_a, 0) == LB_CEF3_OK);
  const auto initial_audio_unmuted_deadline = GetTickCount64() + 5000;
  while (LB_CEF3_BrowserIsAudioMuted(browser_a) != 0
      && GetTickCount64() < initial_audio_unmuted_deadline) Sleep(10);
  const auto initial_audio_state = LB_CEF3_BrowserIsAudioMuted(browser_a);
  if (initial_audio_state != 0) {
    std::array<wchar_t, 512> audio_error{};
    size_t audio_error_required = 0;
    LB_CEF3_GetLastError(audio_error.data(), audio_error.size(), &audio_error_required);
    std::fwprintf(stderr, L"CEF3 audio reset failed: state=%d error=%ls\n",
                  initial_audio_state, audio_error.data());
    std::fflush(stderr);
  }
  assert(initial_audio_state == 0);
  assert(LB_CEF3_BrowserSetAudioMuted(browser_a, 1) == LB_CEF3_OK);
  bool browser_audio_muted = false;
  const auto audio_muted_deadline = GetTickCount64() + 5000;
  while (!browser_audio_muted && GetTickCount64() < audio_muted_deadline) {
    browser_audio_muted = LB_CEF3_BrowserIsAudioMuted(browser_a) == 1;
    if (!browser_audio_muted) Sleep(10);
  }
  assert(browser_audio_muted);
  LB_CEF3_CALL_V4 audio_muted_call{};
  audio_muted_call.struct_size = sizeof(audio_muted_call);
  audio_muted_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  audio_muted_call.operation_id = UINT64_C(0x278ad398f3b915be);
  audio_muted_call.target = browser_a;
  LB_CEF3_RESULT_V4 audio_muted_result{};
  audio_muted_result.struct_size = sizeof(audio_muted_result);
  assert(LB_CEF3_InvokeV4(&audio_muted_call, &audio_muted_result) == LB_CEF3_OK);
  assert(audio_muted_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(audio_muted_result.integer_value == 1);
  assert(LB_CEF3_BrowserSetAudioMuted(browser_a, 0) == LB_CEF3_OK);
  const auto audio_unmuted_deadline = GetTickCount64() + 5000;
  while (LB_CEF3_BrowserIsAudioMuted(browser_a) != 0
      && GetTickCount64() < audio_unmuted_deadline) Sleep(10);
  assert(LB_CEF3_BrowserIsAudioMuted(browser_a) == 0);
  const auto hook = LB_CEF3_JsHookRegister(
      browser_a, L"native-hook", L"globalThis.__lingBuilderHookRuns=(globalThis.__lingBuilderHookRuns||0)+1;",
      L"*", LB_CEF3_JSHOOK_MAIN_FRAME, 1);
  assert(hook != 0);
  assert(LB_CEF3_HandleGetType(hook) == LB_CEF3_HANDLE_JSHOOK);
  std::array<wchar_t, 1024> hook_list{};
  assert(LB_CEF3_JsHookList(browser_a, hook_list.data(), hook_list.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(hook_list.data()).find(L"native-hook") != std::wstring::npos);
  bool hook_executed = false;
  const auto hook_deadline = GetTickCount64() + 5000;
  while (!hook_executed && GetTickCount64() < hook_deadline) {
    const auto hook_task = LB_CEF3_BrowserEvaluateJavaScript(browser_a, L"globalThis.__lingBuilderHookRuns||0");
    assert(hook_task != 0);
    if (WaitTask(hook_task) == LB_CEF3_TASK_SUCCEEDED) {
      const auto hook_result = TaskResult(hook_task);
      hook_executed = hook_result.find(L"\"value\":1") != std::wstring::npos;
    }
    LB_CEF3_TaskRelease(hook_task);
    if (!hook_executed) Sleep(25);
  }
  assert(hook_executed);
  const auto host_message_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a, L"LingBuilder调用宿主('native-ping',{value:1})");
  assert(host_message_task != 0);
  assert(WaitTask(host_message_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(host_message_task).find(L"pong") != std::wstring::npos);
  assert(g_jshook_messages.load() == 1);
  assert(LB_CEF3_TaskRelease(host_message_task) == LB_CEF3_OK);
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
  const auto current_frame_url =
      ReadManagedText(frame_handle_for_close, LB_CEF3_FrameGetUrl);
  assert(current_frame_url.find(L"#v4") != std::wstring::npos);
  assert(std::wstring(navigation_url.data()) == current_frame_url);
  assert(LB_CEF3_NavigationEntryGetDisplayUrl(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetOriginalUrl(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetTitle(navigation_entry, navigation_url.data(), navigation_url.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_NavigationEntryGetTransitionType(navigation_entry) >= 0);
  assert(LB_CEF3_NavigationEntryHasPostData(navigation_entry) == 0);
  assert(LB_CEF3_NavigationEntryGetCompletionTime(navigation_entry) >= 0.0);
  assert(LB_CEF3_NavigationEntryGetHttpStatusCode(navigation_entry) >= 0);
  const auto navigation_ssl_status =
      LB_CEF3_NavigationEntryGetSslStatus(navigation_entry);
  if (navigation_ssl_status != 0) {
    assert(LB_CEF3_HandleGetType(navigation_ssl_status)
           == LB_CEF3_HANDLE_SSL_STATUS);
    assert(LB_CEF3_SslStatusIsSecureConnection(navigation_ssl_status) >= 0);
    assert(LB_CEF3_SslStatusGetCertStatus(navigation_ssl_status) >= 0);
    assert(LB_CEF3_SslStatusGetSslVersion(navigation_ssl_status) >= 0);
    assert(LB_CEF3_SslStatusGetContentStatus(navigation_ssl_status) >= 0);
    const auto navigation_ssl_certificate =
        LB_CEF3_SslStatusGetX509Certificate(navigation_ssl_status);
    if (navigation_ssl_certificate != 0) {
      assert(LB_CEF3_HandleGetType(navigation_ssl_certificate)
             == LB_CEF3_HANDLE_CERTIFICATE);
      assert(LB_CEF3_CertificateRelease(navigation_ssl_certificate)
             == LB_CEF3_OK);
    }
  }
  LB_CEF3_CALL_V4 navigation_ssl_status_call{};
  navigation_ssl_status_call.struct_size = sizeof(navigation_ssl_status_call);
  navigation_ssl_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  navigation_ssl_status_call.operation_id = UINT64_C(0x7da81d0550ed16ad);
  navigation_ssl_status_call.target = navigation_entry;
  LB_CEF3_RESULT_V4 navigation_ssl_status_result{};
  navigation_ssl_status_result.struct_size = sizeof(navigation_ssl_status_result);
  assert(LB_CEF3_InvokeV4(&navigation_ssl_status_call,
                          &navigation_ssl_status_result) == LB_CEF3_OK);
  assert(navigation_ssl_status_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  if (navigation_ssl_status_result.handle_value != 0) {
    assert(LB_CEF3_HandleGetType(navigation_ssl_status_result.handle_value)
           == LB_CEF3_HANDLE_SSL_STATUS);
    assert(LB_CEF3_HandleRelease(navigation_ssl_status_result.handle_value)
           == LB_CEF3_OK);
  }
  navigation_ssl_status_call.target = browser_a;
  navigation_ssl_status_result = {};
  navigation_ssl_status_result.struct_size = sizeof(navigation_ssl_status_result);
  assert(LB_CEF3_InvokeV4(&navigation_ssl_status_call,
                          &navigation_ssl_status_result)
         == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(navigation_ssl_status_result.status == LB_CEF3_ERROR_HANDLE_TYPE);
  if (navigation_ssl_status != 0) {
    assert(LB_CEF3_HandleRelease(navigation_ssl_status) == LB_CEF3_OK);
  }
  assert(LB_CEF3_NavigationEntryRelease(navigation_entry) == LB_CEF3_OK);
  std::array<wchar_t, 8> network_certificate_flag{};
  const auto network_certificate_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_NETWORK_CERTIFICATE", network_certificate_flag.data(),
      static_cast<DWORD>(network_certificate_flag.size()));
  const bool run_network_certificate_test = network_certificate_flag_length == 1
      && network_certificate_flag[0] == L'1';
  std::fprintf(stderr, "CEF3 test checkpoint: network-certificate=%d\n",
               run_network_certificate_test ? 1 : 0);
  std::fflush(stderr);
  LB_CEF3_HANDLE certificate = 0;
  if (run_network_certificate_test) {
    assert(LB_CEF3_BrowserLoadUrl(browser_a, L"https://example.com/") == LB_CEF3_OK);
    const auto certificate_deadline = GetTickCount64() + 30000;
    while (certificate == 0 && GetTickCount64() < certificate_deadline) {
      PumpHostMessages();
      certificate = LB_CEF3_BrowserGetCurrentCertificate(browser_a);
      if (certificate == 0) Sleep(50);
    }
    assert(certificate != 0);
    assert(LB_CEF3_HandleGetType(certificate) == LB_CEF3_HANDLE_CERTIFICATE);
    assert(LB_CEF3_CertificateIsSecureConnection(certificate) == 1);
    assert(LB_CEF3_CertificateGetCertStatus(certificate) >= 0);
    assert(LB_CEF3_CertificateGetSslVersion(certificate) >= 0);
    assert(LB_CEF3_CertificateGetContentStatus(certificate) >= 0);
    const auto secure_navigation_entry =
        LB_CEF3_BrowserGetVisibleNavigationEntry(browser_a);
    assert(secure_navigation_entry != 0);
    const auto secure_ssl_status =
        LB_CEF3_NavigationEntryGetSslStatus(secure_navigation_entry);
    assert(secure_ssl_status != 0);
    assert(LB_CEF3_HandleGetType(secure_ssl_status)
           == LB_CEF3_HANDLE_SSL_STATUS);
    assert(LB_CEF3_SslStatusIsSecureConnection(secure_ssl_status) == 1);
    assert(LB_CEF3_SslStatusGetCertStatus(secure_ssl_status) >= 0);
    assert(LB_CEF3_SslStatusGetSslVersion(secure_ssl_status) >= 0);
    assert(LB_CEF3_SslStatusGetContentStatus(secure_ssl_status) >= 0);
    const auto secure_ssl_certificate =
        LB_CEF3_SslStatusGetX509Certificate(secure_ssl_status);
    assert(secure_ssl_certificate != 0);
    assert(LB_CEF3_HandleGetType(secure_ssl_certificate)
           == LB_CEF3_HANDLE_CERTIFICATE);
    assert(LB_CEF3_CertificateRelease(secure_ssl_certificate) == LB_CEF3_OK);
    for (const auto operation_id : {
        UINT64_C(0x51b41b9e5621df9f), UINT64_C(0x4eb19d5c9d2fb050),
        UINT64_C(0xe9922cbb6210ab79), UINT64_C(0x8d09bcaf1ea700f7)}) {
      LB_CEF3_CALL_V4 ssl_status_call{};
      ssl_status_call.struct_size = sizeof(ssl_status_call);
      ssl_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
      ssl_status_call.operation_id = operation_id;
      ssl_status_call.target = secure_ssl_status;
      LB_CEF3_RESULT_V4 ssl_status_result{};
      ssl_status_result.struct_size = sizeof(ssl_status_result);
      assert(LB_CEF3_InvokeV4(&ssl_status_call, &ssl_status_result)
             == LB_CEF3_OK);
      assert(ssl_status_result.value_kind
             == LB_CEF3_VALUE_V4_INTEGER
             || ssl_status_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    }
    LB_CEF3_CALL_V4 ssl_status_certificate_call{};
    ssl_status_certificate_call.struct_size = sizeof(ssl_status_certificate_call);
    ssl_status_certificate_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    ssl_status_certificate_call.operation_id = UINT64_C(0x9cd39c7abb2fef0c);
    ssl_status_certificate_call.target = secure_ssl_status;
    LB_CEF3_RESULT_V4 ssl_status_certificate_result{};
    ssl_status_certificate_result.struct_size = sizeof(ssl_status_certificate_result);
    assert(LB_CEF3_InvokeV4(&ssl_status_certificate_call,
                            &ssl_status_certificate_result) == LB_CEF3_OK);
    assert(ssl_status_certificate_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(ssl_status_certificate_result.handle_value != 0);
    assert(LB_CEF3_HandleRelease(ssl_status_certificate_result.handle_value)
           == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(secure_ssl_status) == LB_CEF3_OK);
    assert(LB_CEF3_NavigationEntryRelease(secure_navigation_entry) == LB_CEF3_OK);
    const auto ssl_info = LB_CEF3_SslInfoCreateFromCertificate(certificate);
    assert(ssl_info != 0);
    assert(LB_CEF3_HandleGetType(ssl_info) == LB_CEF3_HANDLE_SSL_INFO);
    const auto ssl_info_cert_status = LB_CEF3_SslInfoGetCertStatus(ssl_info);
    assert(ssl_info_cert_status == LB_CEF3_CertificateGetCertStatus(certificate));
    const auto ssl_info_certificate = LB_CEF3_SslInfoGetX509Certificate(ssl_info);
    assert(ssl_info_certificate != 0);
    assert(LB_CEF3_HandleGetType(ssl_info_certificate)
           == LB_CEF3_HANDLE_CERTIFICATE);
    assert(LB_CEF3_CertificateRelease(ssl_info_certificate) == LB_CEF3_OK);
    LB_CEF3_CALL_V4 ssl_info_status_call{};
    ssl_info_status_call.struct_size = sizeof(ssl_info_status_call);
    ssl_info_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    ssl_info_status_call.operation_id = UINT64_C(0x5df67372565921e4);
    ssl_info_status_call.target = ssl_info;
    LB_CEF3_RESULT_V4 ssl_info_status_result{};
    ssl_info_status_result.struct_size = sizeof(ssl_info_status_result);
    assert(LB_CEF3_InvokeV4(&ssl_info_status_call, &ssl_info_status_result)
           == LB_CEF3_OK);
    assert(ssl_info_status_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(ssl_info_status_result.integer_value == ssl_info_cert_status);
    ssl_info_status_call.operation_id = UINT64_C(0x0c814e53a3760667);
    ssl_info_status_result = {};
    ssl_info_status_result.struct_size = sizeof(ssl_info_status_result);
    assert(LB_CEF3_InvokeV4(&ssl_info_status_call, &ssl_info_status_result)
           == LB_CEF3_OK);
    assert(ssl_info_status_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(ssl_info_status_result.handle_value != 0);
    assert(LB_CEF3_HandleRelease(ssl_info_status_result.handle_value)
           == LB_CEF3_OK);
    ssl_info_status_call.target = certificate;
    ssl_info_status_call.operation_id = UINT64_C(0x5df67372565921e4);
    ssl_info_status_result = {};
    ssl_info_status_result.struct_size = sizeof(ssl_info_status_result);
    assert(LB_CEF3_InvokeV4(&ssl_info_status_call, &ssl_info_status_result)
           == LB_CEF3_ERROR_HANDLE_TYPE);
    assert(LB_CEF3_HandleRelease(ssl_info) == LB_CEF3_OK);
    assert(LB_CEF3_SslInfoGetCertStatus(ssl_info)
           == LB_CEF3_ERROR_RELEASED_HANDLE);
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
  } else {
    const auto navigation_file = root / L"native-test.html";
    {
      const std::string navigation_html =
          "<!doctype html><meta charset=\"utf-8\"><title>native-test</title>"
          "<body>lingbuilder-find-token lingbuilder-find-token</body>";
      FILE* output = nullptr;
      assert(_wfopen_s(&output, navigation_file.c_str(), L"wb") == 0 && output != nullptr);
      assert(std::fwrite(navigation_html.data(), 1, navigation_html.size(), output) == navigation_html.size());
      assert(std::fclose(output) == 0);
    }
    const std::wstring navigation_url = L"file:///" + navigation_file.generic_wstring();
    assert(LB_CEF3_BrowserLoadUrl(browser_a, navigation_url.c_str()) == LB_CEF3_OK);
  }
  const wchar_t* expected_navigation_text = run_network_certificate_test ? L"example.com" : L"native-test";
  const auto navigation_commit_deadline = GetTickCount64() + 15000;
  while (g_navigation_events.load() < 1 && GetTickCount64() < navigation_commit_deadline) {
    PumpHostMessages();
    Sleep(25);
  }
  bool navigation_committed = false;
  std::wstring last_navigation_url;
  const auto current_entry = LB_CEF3_BrowserGetVisibleNavigationEntry(browser_a);
  if (current_entry != 0) {
    std::array<wchar_t, 1024> current_url{};
    if (LB_CEF3_NavigationEntryGetUrl(current_entry, current_url.data(), current_url.size(), &required)
        == LB_CEF3_OK) {
      last_navigation_url = current_url.data();
      navigation_committed = last_navigation_url.find(expected_navigation_text) != std::wstring::npos;
    }
    LB_CEF3_NavigationEntryRelease(current_entry);
  }
  if (!navigation_committed) {
    std::array<wchar_t, 1024> bridge_url{};
    LB_CEF3_BrowserGetUrl(browser_a, bridge_url.data(), bridge_url.size(), &required);
    std::fwprintf(stderr, L"CEF3 navigation timeout: visible=%ls state=%ls expected=%ls\n",
                  last_navigation_url.c_str(), bridge_url.data(), expected_navigation_text);
    std::fflush(stderr);
  }
  assert(navigation_committed);
  const wchar_t* find_text = run_network_certificate_test ? L"Example Domain" : L"lingbuilder-find-token";
  const int positive_find_final_events_before = g_find_positive_final_events.load();
  assert(LB_CEF3_BrowserFind(browser_a, find_text, 1, 0, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 find_arguments[4]{};
  for (auto& argument : find_arguments) argument.struct_size = sizeof(argument);
  find_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  find_arguments[0].text_value = find_text;
  find_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  find_arguments[1].integer_value = 1;
  find_arguments[2].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  find_arguments[3].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  find_arguments[3].integer_value = 1;
  LB_CEF3_CALL_V4 find_call{};
  find_call.struct_size = sizeof(find_call);
  find_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  find_call.operation_id = UINT64_C(0xc3a00d87d421c6f6);
  find_call.target = browser_a;
  find_call.arguments = find_arguments;
  find_call.argument_count = 4;
  LB_CEF3_RESULT_V4 find_result{};
  find_result.struct_size = sizeof(find_result);
  assert(LB_CEF3_InvokeV4(&find_call, &find_result) == LB_CEF3_OK);
  find_call.argument_count = 3;
  assert(LB_CEF3_InvokeV4(&find_call, &find_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  find_call.argument_count = 4;
  const auto find_deadline = GetTickCount64() + 5000;
  while (g_find_positive_final_events.load() <= positive_find_final_events_before
      && GetTickCount64() < find_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_find_events.load() >= 1);
  assert(g_find_final_events.load() >= 1);
  assert(g_find_positive_final_events.load() > positive_find_final_events_before);
  assert(LB_CEF3_BrowserStopFinding(browser_a, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 stop_find_argument{};
  stop_find_argument.struct_size = sizeof(stop_find_argument);
  stop_find_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  stop_find_argument.integer_value = 1;
  LB_CEF3_CALL_V4 stop_find_call{};
  stop_find_call.struct_size = sizeof(stop_find_call);
  stop_find_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  stop_find_call.operation_id = UINT64_C(0x6ab7e66161f68816);
  stop_find_call.target = browser_a;
  stop_find_call.arguments = &stop_find_argument;
  stop_find_call.argument_count = 1;
  LB_CEF3_RESULT_V4 stop_find_result{};
  stop_find_result.struct_size = sizeof(stop_find_result);
  assert(LB_CEF3_InvokeV4(&stop_find_call, &stop_find_result) == LB_CEF3_OK);
  stop_find_call.argument_count = 0;
  assert(LB_CEF3_InvokeV4(&stop_find_call, &stop_find_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto navigation_history = LB_CEF3_BrowserGetNavigationEntries(browser_a, 0);
  assert(navigation_history != 0);
  assert(WaitTask(navigation_history) == LB_CEF3_TASK_SUCCEEDED);
  const auto navigation_history_json = TaskResult(navigation_history);
  assert(navigation_history_json.size() > 2);
  assert(navigation_history_json.find(L"\"url\"") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(navigation_history) == LB_CEF3_OK);
  const auto javascript_task = LB_CEF3_BrowserEvaluateJavaScript(browser_a, L"console.log('bridge-event-test'); 'ok'");
  assert(javascript_task != 0);
  assert(WaitTask(javascript_task) == LB_CEF3_TASK_SUCCEEDED);
  const auto console_deadline = GetTickCount64() + 5000;
  while (g_console_events.load() < 1 && GetTickCount64() < console_deadline) Sleep(10);
  assert(g_console_events.load() >= 1);
  assert(LB_CEF3_TaskRelease(javascript_task) == LB_CEF3_OK);
  const auto js_dialog_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a, L"alert('bridge-jsdialog-test'); 'dialog-continued'");
  assert(js_dialog_task != 0);
  assert(WaitTask(js_dialog_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(js_dialog_task).find(L"dialog-continued") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(js_dialog_task) == LB_CEF3_OK);
  const auto js_dialog_deadline = GetTickCount64() + 5000;
  while ((g_js_dialog_events.load() < 1 || g_dialog_closed_events.load() < 1)
      && GetTickCount64() < js_dialog_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_js_dialog_events.load() >= 1);
  assert(g_dialog_closed_events.load() >= 1);
  // JS 交互（cefQuery）回环：页面发起查询 → 桥派发「查询请求」→ 事件回调应答 →
  // onSuccess 写结果；第二个查询留给页面主动取消，验证「查询已取消」派发。
  // 生成模板对每个浏览器都注册 per-browser V4 回调（真实运行时形态），这里同构。
  assert(LB_CEF3_SetEventCallbackV4(browser_a, TestEventCallbackV4, nullptr)
      == LB_CEF3_OK);
  assert(g_js_query_events.load() == 0);
  // 注销 per-browser V4 回调，恢复既有测试的事件通道状态：
  // 否则后续 native-test 导航的「资源加载前」受管事件会挂到超时。
  assert(LB_CEF3_SetEventCallbackV4(browser_a, nullptr, nullptr) == LB_CEF3_OK);
  LB_CEF3_KEY_EVENT_V3 key_event{};
  key_event.struct_size = sizeof(key_event);
  key_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  key_event.windows_key_code = 'A';
  key_event.type = LB_CEF3_KEY_EVENT_CHAR;
  key_event.character = L'a';
  key_event.unmodified_character = L'a';
  assert(LB_CEF3_BrowserSendKeyEvent(browser_a, &key_event) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 key_event_arguments[8]{};
  for (auto& argument : key_event_arguments) argument.struct_size = sizeof(argument);
  key_event_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[0].integer_value = LB_CEF3_KEY_EVENT_CHAR;
  key_event_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[2].integer_value = 'A';
  key_event_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[4].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  key_event_arguments[5].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[5].integer_value = L'a';
  key_event_arguments[6].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  key_event_arguments[6].integer_value = L'a';
  key_event_arguments[7].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  LB_CEF3_CALL_V4 key_event_call{};
  key_event_call.struct_size = sizeof(key_event_call);
  key_event_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  key_event_call.operation_id = UINT64_C(0x2a2c91966a115133);
  key_event_call.target = browser_a;
  key_event_call.arguments = key_event_arguments;
  key_event_call.argument_count = 8;
  LB_CEF3_RESULT_V4 key_event_result{};
  key_event_result.struct_size = sizeof(key_event_result);
  assert(LB_CEF3_InvokeV4(&key_event_call, &key_event_result) == LB_CEF3_OK);
  key_event_call.argument_count = 7;
  assert(LB_CEF3_InvokeV4(&key_event_call, &key_event_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto keyboard_event_deadline = GetTickCount64() + 5000;
  while ((g_pre_key_events.load() < 1 || g_key_events.load() < 1)
      && GetTickCount64() < keyboard_event_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_pre_key_events.load() >= 1);
  // SendKeyEvent injection may be consumed by the renderer before OnKeyEvent.
  assert(LB_CEF3_BrowserSetFocus(browser_a, 1) == LB_CEF3_OK);
  LB_CEF3_MOUSE_EVENT_V3 mouse_event{};
  mouse_event.struct_size = sizeof(mouse_event);
  mouse_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  mouse_event.x = 10;
  mouse_event.y = 10;
  assert(LB_CEF3_BrowserSendMouseClickEvent(browser_a, &mouse_event,
      LB_CEF3_MOUSE_BUTTON_LEFT, 0, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserSendMouseClickEvent(browser_a, &mouse_event,
      LB_CEF3_MOUSE_BUTTON_LEFT, 1, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserSendMouseClickEvent(browser_a, &mouse_event,
      LB_CEF3_MOUSE_BUTTON_RIGHT, 0, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserSendMouseClickEvent(browser_a, &mouse_event,
      LB_CEF3_MOUSE_BUTTON_RIGHT, 1, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserSendMouseMoveEvent(browser_a, &mouse_event, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 mouse_move_arguments[4]{};
  for (auto& argument : mouse_move_arguments) argument.struct_size = sizeof(argument);
  mouse_move_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_move_arguments[0].integer_value = mouse_event.x;
  mouse_move_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_move_arguments[1].integer_value = mouse_event.y;
  mouse_move_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_move_arguments[2].integer_value = mouse_event.modifiers;
  mouse_move_arguments[3].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  mouse_move_arguments[3].integer_value = 1;
  LB_CEF3_CALL_V4 mouse_move_call{};
  mouse_move_call.struct_size = sizeof(mouse_move_call);
  mouse_move_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  mouse_move_call.operation_id = UINT64_C(0x500a4a6e8dd92e17);
  mouse_move_call.target = browser_a;
  mouse_move_call.arguments = mouse_move_arguments;
  mouse_move_call.argument_count = 4;
  LB_CEF3_RESULT_V4 mouse_move_result{};
  mouse_move_result.struct_size = sizeof(mouse_move_result);
  assert(LB_CEF3_InvokeV4(&mouse_move_call, &mouse_move_result) == LB_CEF3_OK);
  mouse_move_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&mouse_move_call, &mouse_move_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  mouse_move_arguments[3].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  mouse_move_call.argument_count = 3;
  assert(LB_CEF3_InvokeV4(&mouse_move_call, &mouse_move_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  mouse_move_call.argument_count = 4;
  const auto context_menu_deadline = GetTickCount64() + 5000;
  while ((g_context_menu_before_events.load() < 1 || g_context_menu_run_events.load() < 1
      || g_context_menu_command_events.load() < 1 || g_context_menu_dismissed_events.load() < 1)
      && GetTickCount64() < context_menu_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_context_menu_before_events.load() >= 1);
  assert(g_context_menu_run_events.load() >= 1);
  assert(g_context_menu_command_events.load() >= 1);
  assert(g_context_menu_dismissed_events.load() >= 1);
  assert(LB_CEF3_BrowserSendMouseWheelEvent(browser_a, &mouse_event, -24, 120) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 mouse_wheel_arguments[5]{};
  for (auto& argument : mouse_wheel_arguments) argument.struct_size = sizeof(argument);
  mouse_wheel_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_arguments[0].integer_value = mouse_event.x;
  mouse_wheel_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_arguments[1].integer_value = mouse_event.y;
  mouse_wheel_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_arguments[2].integer_value = mouse_event.modifiers;
  mouse_wheel_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_arguments[3].integer_value = -24;
  mouse_wheel_arguments[4].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_arguments[4].integer_value = 120;
  LB_CEF3_CALL_V4 mouse_wheel_call{};
  mouse_wheel_call.struct_size = sizeof(mouse_wheel_call);
  mouse_wheel_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  mouse_wheel_call.operation_id = UINT64_C(0x6ec12d7859e21b91);
  mouse_wheel_call.target = browser_a;
  mouse_wheel_call.arguments = mouse_wheel_arguments;
  mouse_wheel_call.argument_count = 5;
  LB_CEF3_RESULT_V4 mouse_wheel_result{};
  mouse_wheel_result.struct_size = sizeof(mouse_wheel_result);
  assert(LB_CEF3_InvokeV4(&mouse_wheel_call, &mouse_wheel_result) == LB_CEF3_OK);
  mouse_wheel_arguments[4].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  assert(LB_CEF3_InvokeV4(&mouse_wheel_call, &mouse_wheel_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  mouse_wheel_arguments[4].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_wheel_call.argument_count = 4;
  assert(LB_CEF3_InvokeV4(&mouse_wheel_call, &mouse_wheel_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  mouse_wheel_call.argument_count = 5;
  LB_CEF3_TOUCH_EVENT_V3 touch_event{};
  touch_event.struct_size = sizeof(touch_event);
  touch_event.abi_version = LB_CEF3_ABI_VERSION_V3;
  touch_event.id = 37;
  touch_event.x = 10.25f;
  touch_event.y = 20.5f;
  touch_event.radius_x = 2.0f;
  touch_event.radius_y = 3.0f;
  touch_event.rotation_angle = 0.25f;
  touch_event.pressure = 0.5f;
  touch_event.type = LB_CEF3_TOUCH_EVENT_PRESSED;
  touch_event.modifiers = 0;
  touch_event.pointer_type = LB_CEF3_POINTER_TYPE_TOUCH;
  assert(LB_CEF3_BrowserSendTouchEvent(browser_a, &touch_event) == LB_CEF3_ERROR_NOT_SUPPORTED);
  touch_event.type = LB_CEF3_TOUCH_EVENT_MOVED;
  touch_event.x = 11.25f;
  assert(LB_CEF3_BrowserSendTouchEvent(browser_a, &touch_event) == LB_CEF3_ERROR_NOT_SUPPORTED);
  touch_event.type = LB_CEF3_TOUCH_EVENT_RELEASED;
  assert(LB_CEF3_BrowserSendTouchEvent(browser_a, &touch_event) == LB_CEF3_ERROR_NOT_SUPPORTED);
  LB_CEF3_ARGUMENT_V4 touch_arguments[10]{};
  for (auto& argument : touch_arguments) argument.struct_size = sizeof(argument);
  touch_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  touch_arguments[0].integer_value = 38;
  for (int index = 1; index <= 6; ++index) touch_arguments[index].value_kind = LB_CEF3_VALUE_V4_DOUBLE;
  touch_arguments[1].double_value = 15.25;
  touch_arguments[2].double_value = 25.5;
  touch_arguments[3].double_value = 2.0;
  touch_arguments[4].double_value = 3.0;
  touch_arguments[5].double_value = 0.5;
  touch_arguments[6].double_value = 0.75;
  touch_arguments[7].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_PRESSED;
  touch_arguments[8].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  touch_arguments[9].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  touch_arguments[9].integer_value = LB_CEF3_POINTER_TYPE_TOUCH;
  LB_CEF3_CALL_V4 touch_call{};
  touch_call.struct_size = sizeof(touch_call);
  touch_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  touch_call.operation_id = UINT64_C(0x0217e344daf87eea);
  touch_call.target = browser_a;
  touch_call.arguments = touch_arguments;
  touch_call.argument_count = 10;
  LB_CEF3_RESULT_V4 touch_result{};
  touch_result.struct_size = sizeof(touch_result);
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_NOT_SUPPORTED);
  touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_MOVED;
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_NOT_SUPPORTED);
  touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_RELEASED;
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_NOT_SUPPORTED);
  touch_arguments[6].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  touch_arguments[6].value_kind = LB_CEF3_VALUE_V4_DOUBLE;
  touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_CANCELLED + 1;
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_RELEASED;
  touch_call.argument_count = 9;
  assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  touch_call.argument_count = 10;

  const auto host_osr = CreateWindowExW(0, L"STATIC", L"CEF3测试OSR", WS_OVERLAPPEDWINDOW,
                                        0, 0, 320, 240, nullptr, nullptr,
                                        GetModuleHandleW(nullptr), nullptr);
  assert(host_osr != nullptr);
  ShowWindow(host_osr, SW_SHOW);
  UpdateWindow(host_osr);
  auto browser_config_osr = browser_config_a;
  browser_config_osr.parent_window = reinterpret_cast<uint64_t>(host_osr);
  browser_config_osr.user_token = 103;
  browser_config_osr.flags = LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_WINDOWLESS;
  browser_config_osr.profile_key = L"native-test-osr";
  const int osr_created_before = g_browser_created_events.load();
  const auto browser_osr = LB_CEF3_BrowserCreate(&browser_config_osr);
  assert(browser_osr != 0);
  const auto osr_created_deadline = GetTickCount64() + 30000;
  while (g_browser_created_events.load() < osr_created_before + 1
      && GetTickCount64() < osr_created_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_created_events.load() >= osr_created_before + 1);
  assert(LB_CEF3_BrowserIsWindowRenderingDisabled(browser_osr) == 1);

  assert(LB_CEF3_SetEventCallbackV4(0, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadSubscribeCanDownload(browser_osr, 1) == LB_CEF3_OK);
  const int can_download_before = g_can_download_events.load();
  const int v4_can_download_before = g_v4_can_download_events.load();
  const auto osr_download_link_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_osr,
      L"(()=>{const a=document.createElement('a');"
      L"a.id='bridge-osr-download-link';a.download='bridge-osr-download.bin';"
      L"a.href='data:application/octet-stream;base64,T1NSIGRvd25sb2Fk';"
      L"a.textContent='download';a.style.cssText='position:fixed;left:4px;top:4px;"
      L"width:120px;height:32px;display:block;z-index:2147483647';"
      L"document.body.appendChild(a);return 'ready';})()");
  assert(osr_download_link_task != 0);
  assert(WaitTask(osr_download_link_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(osr_download_link_task) == LB_CEF3_OK);
  g_cancel_next_can_download.store(true);
  const auto osr_download_click_task = LB_CEF3_DevToolsExecuteMethod(
      browser_osr, L"Runtime.evaluate",
      L"{\"expression\":\"document.getElementById('bridge-osr-download-link').click()\","
      L"\"userGesture\":true,\"returnByValue\":true}");
  assert(osr_download_click_task != 0);
  assert(WaitTask(osr_download_click_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(osr_download_click_task) == LB_CEF3_OK);
  const auto can_download_deadline = GetTickCount64() + 15000;
  while ((g_can_download_events.load() <= can_download_before
          || g_v4_can_download_events.load() <= v4_can_download_before)
      && GetTickCount64() < can_download_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_can_download_events.load() > can_download_before);
  assert(g_v4_can_download_events.load() > v4_can_download_before);
  assert(!g_cancel_next_can_download.load());
  assert(LB_CEF3_DownloadSubscribeCanDownload(browser_osr, 0) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);

  assert(LB_CEF3_SetEventCallbackV4(
      browser_osr, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  LB_CEF3_HANDLE osr_client = 0;
  assert(LB_CEF3_BrowserGetClient(browser_osr, &osr_client) == LB_CEF3_OK);
  assert(osr_client != 0);
  assert(LB_CEF3_HandleGetType(osr_client) == LB_CEF3_HANDLE_CLIENT);
  assert(LB_CEF3_ClientGetRenderHandlerAvailable(osr_client) == 1);
  assert(LB_CEF3_ClientGetFrameHandlerAvailable(osr_client) == 1);
  assert(LB_CEF3_ClientGetDownloadHandlerAvailable(osr_client) == 1);
  assert(LB_CEF3_ClientGetPrintHandlerAvailable(osr_client) == 1);
  assert(LB_CEF3_ClientGetRenderHandlerAvailable(browser_osr)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  for (const auto operation_id : {
      UINT64_C(0xa3c9e84099411592), UINT64_C(0x1c7dbfca2170b066),
      UINT64_C(0x3c88fa719b54ed9b), UINT64_C(0x3440f9d150f71c6d)}) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = osr_client;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
    assert(result.integer_value == 1);
    LB_CEF3_ARGUMENT_V4 unexpected{};
    unexpected.struct_size = sizeof(unexpected);
    unexpected.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    call.arguments = &unexpected;
    call.argument_count = 1;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }

  assert(LB_CEF3_PrintDialogCallbackContinue(osr_client, browser_osr)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_PrintDialogCallbackCancel(osr_client)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_PrintJobCallbackContinue(osr_client)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_PrintHandlerSubscribeStart(osr_client, 1)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  for (const auto operation_id : {
      UINT64_C(0x4f531ff3f9a4f277), UINT64_C(0xaad64fcdc389e398)}) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = osr_client;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_ERROR_HANDLE_TYPE);
    call.argument_count = 1;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }
  LB_CEF3_ARGUMENT_V4 print_settings_argument{};
  print_settings_argument.struct_size = sizeof(print_settings_argument);
  print_settings_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  print_settings_argument.handle_value = browser_osr;
  LB_CEF3_CALL_V4 print_dialog_continue_call{};
  print_dialog_continue_call.struct_size = sizeof(print_dialog_continue_call);
  print_dialog_continue_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  print_dialog_continue_call.operation_id = UINT64_C(0x643dd2ca469a3198);
  print_dialog_continue_call.target = osr_client;
  print_dialog_continue_call.arguments = &print_settings_argument;
  print_dialog_continue_call.argument_count = 1;
  LB_CEF3_RESULT_V4 print_dialog_continue_result{};
  print_dialog_continue_result.struct_size = sizeof(print_dialog_continue_result);
  assert(LB_CEF3_InvokeV4(
             &print_dialog_continue_call, &print_dialog_continue_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  print_settings_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(
             &print_dialog_continue_call, &print_dialog_continue_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  using CallbackSubscription = int (LB_CEF3_CALL *)(LB_CEF3_HANDLE, int);
  const std::array<CallbackSubscription, 30> callback_subscriptions = {
      LB_CEF3_RenderHandlerSubscribeAccessibilityHandler,
      LB_CEF3_RenderHandlerSubscribeRootScreenRect,
      LB_CEF3_RenderHandlerSubscribeScreenInfo,
      LB_CEF3_RenderHandlerSubscribeScreenPoint,
      LB_CEF3_RenderHandlerSubscribeTouchHandleSize,
      LB_CEF3_RenderHandlerSubscribeViewRect,
      LB_CEF3_RenderHandlerSubscribeAcceleratedPaint,
      LB_CEF3_RenderHandlerSubscribeImeCompositionRangeChanged,
      LB_CEF3_RenderHandlerSubscribePaint,
      LB_CEF3_RenderHandlerSubscribePopupShow,
      LB_CEF3_RenderHandlerSubscribePopupSize,
      LB_CEF3_RenderHandlerSubscribeScrollOffsetChanged,
      LB_CEF3_RenderHandlerSubscribeTextSelectionChanged,
      LB_CEF3_RenderHandlerSubscribeTouchHandleStateChanged,
      LB_CEF3_RenderHandlerSubscribeVirtualKeyboardRequested,
      LB_CEF3_RenderHandlerSubscribeStartDragging,
      LB_CEF3_RenderHandlerSubscribeUpdateDragCursor,
      LB_CEF3_AccessibilityHandlerSubscribeLocationChange,
      LB_CEF3_AccessibilityHandlerSubscribeTreeChange,
      LB_CEF3_FrameHandlerSubscribeAttached,
      LB_CEF3_FrameHandlerSubscribeCreated,
      LB_CEF3_FrameHandlerSubscribeDestroyed,
      LB_CEF3_FrameHandlerSubscribeDetached,
      LB_CEF3_FrameHandlerSubscribeMainFrameChanged,
      LB_CEF3_PrintHandlerSubscribeStart,
      LB_CEF3_PrintHandlerSubscribeSettings,
      LB_CEF3_PrintHandlerSubscribeDialog,
      LB_CEF3_PrintHandlerSubscribeJob,
      LB_CEF3_PrintHandlerSubscribeReset,
      LB_CEF3_PrintHandlerSubscribePdfPaperSize};
  const std::array<uint64_t, 30> callback_operation_ids = {
      UINT64_C(0x8f37f96b1b9e742d), UINT64_C(0xefcc1be2e33a041f),
      UINT64_C(0x0641548a565da0d8), UINT64_C(0x8bec9817b092e7d4),
      UINT64_C(0x6e8869fa2d6e99af), UINT64_C(0xd2dc3712d76b84f1),
      UINT64_C(0xd550ce609b60dcef), UINT64_C(0xaa8b06d66ce580ad),
      UINT64_C(0x60172846b544426a), UINT64_C(0xfb271b2be5a1bd8b),
      UINT64_C(0xab03c44ebf78ce88), UINT64_C(0xe7846bb07b464ead),
      UINT64_C(0xaba9d94441352567), UINT64_C(0xf5d298905927b2e3),
      UINT64_C(0xc6b034c735e7d312), UINT64_C(0xaa30c31d6d87a2e5),
      UINT64_C(0x9211d38dd21ebbc3), UINT64_C(0x7a151f3a0083914b),
      UINT64_C(0x10cd272f2eded6f0), UINT64_C(0x6e5d8700c358aa3f),
      UINT64_C(0x87efec7312849601), UINT64_C(0xe328a132014f93ae),
      UINT64_C(0x6eeb2d805e1b5788), UINT64_C(0xddf039c7ecf73e9c),
      UINT64_C(0xf6d34bf8d87534da), UINT64_C(0x49e12f99d8b007a1),
      UINT64_C(0x85480cfb0cafc04c), UINT64_C(0x3178787502789731),
      UINT64_C(0x83b0d9a2ecfd9cbc), UINT64_C(0xba2a9cb935ab725d)};
  for (size_t index = 0; index < callback_subscriptions.size(); ++index) {
    assert(callback_subscriptions[index](browser_osr, 1) == LB_CEF3_OK);
    assert(callback_subscriptions[index](browser_osr, 2)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);

    LB_CEF3_ARGUMENT_V4 enabled{};
    enabled.struct_size = sizeof(enabled);
    enabled.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    enabled.integer_value = 1;
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = callback_operation_ids[index];
    call.target = browser_osr;
    call.arguments = &enabled;
    call.argument_count = 1;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == LB_CEF3_VALUE_V4_VOID);
    enabled.value_kind = LB_CEF3_VALUE_V4_INTEGER;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
    enabled.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    enabled.integer_value = 2;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
    enabled.integer_value = 1;
    call.argument_count = 0;
    assert(LB_CEF3_InvokeV4(&call, &result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }

  const int render_events_before = g_v4_render_handler_events.load();
  const int paint_events_before = g_v4_paint_events.load();
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(browser_osr) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserResize(browser_osr) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserInvalidate(browser_osr, 0) == LB_CEF3_OK);
  const auto osr_callback_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_osr,
      L"(()=>{document.body.style.height='2400px';"
      L"const p=document.createElement('p');p.id='bridge-managed-selection';"
      L"p.textContent='managed selection';"
      L"document.body.appendChild(p);const range=document.createRange();"
      L"range.selectNodeContents(p);const selection=getSelection();"
      L"selection.removeAllRanges();selection.addRange(range);scrollTo(0,200);"
      L"return true;})()"
  );
  assert(osr_callback_task != 0);
  assert(WaitTask(osr_callback_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(osr_callback_task) == LB_CEF3_OK);
  const auto callback_deadline = GetTickCount64() + 15000;
  while ((g_v4_render_handler_events.load() <= render_events_before
          || g_v4_paint_events.load() <= paint_events_before)
      && GetTickCount64() < callback_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_render_handler_events.load() > render_events_before);
  assert(g_v4_paint_events.load() > paint_events_before);

  for (const auto operation_id : callback_operation_ids) {
    LB_CEF3_ARGUMENT_V4 disabled{};
    disabled.struct_size = sizeof(disabled);
    disabled.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    disabled.integer_value = 0;
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = browser_osr;
    call.arguments = &disabled;
    call.argument_count = 1;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
  }
  assert(LB_CEF3_SetEventCallbackV4(
      browser_osr, nullptr, nullptr) == LB_CEF3_OK);
  const auto osr_callback_cleanup_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_osr,
      L"(()=>{getSelection().removeAllRanges();scrollTo(0,0);"
      L"document.getElementById('bridge-managed-selection')?.remove();"
      L"document.body.style.height='';return true;})()"
  );
  assert(osr_callback_cleanup_task != 0);
  const int osr_callback_cleanup_status = WaitTask(osr_callback_cleanup_task);
  if (osr_callback_cleanup_status != LB_CEF3_TASK_SUCCEEDED) {
    std::fwprintf(
        stderr, L"OSR callback cleanup failed: status=%d error=%ls\n",
        osr_callback_cleanup_status,
        TaskError(osr_callback_cleanup_task).c_str());
  }
  assert(osr_callback_cleanup_status == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(osr_callback_cleanup_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(osr_client) == LB_CEF3_OK);

  int32_t windowless_frame_rate = 0;
  assert(LB_CEF3_BrowserGetWindowlessFrameRate(
      browser_osr, &windowless_frame_rate) == LB_CEF3_OK);
  assert(windowless_frame_rate >= 1);
  assert(LB_CEF3_BrowserSetWindowlessFrameRate(
      browser_osr, windowless_frame_rate) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 frame_rate_argument{};
  frame_rate_argument.struct_size = sizeof(frame_rate_argument);
  frame_rate_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  frame_rate_argument.integer_value = windowless_frame_rate;
  (void)invoke_browser_host_v4(
      UINT64_C(0x045fdd88e81738c3), browser_osr, &frame_rate_argument, 1);
  browser_host_result = invoke_browser_host_v4(
      UINT64_C(0x8bfc126953286868), browser_osr, nullptr, 0);
  assert(browser_host_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(browser_host_result.integer_value == windowless_frame_rate);

  constexpr int32_t kPaintElementView = 0;
  assert(LB_CEF3_BrowserInvalidate(browser_osr, kPaintElementView) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 paint_element_argument{};
  paint_element_argument.struct_size = sizeof(paint_element_argument);
  paint_element_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  paint_element_argument.integer_value = kPaintElementView;
  (void)invoke_browser_host_v4(
      UINT64_C(0x3e374ddef4b84303), browser_osr, &paint_element_argument, 1);
  assert(LB_CEF3_BrowserSendExternalBeginFrame(browser_osr) == LB_CEF3_OK);
  (void)invoke_browser_host_v4(
      UINT64_C(0x32886407f6da703e), browser_osr, nullptr, 0);

  LB_CEF3_RANGE_V3 empty_range{
      sizeof(empty_range), LB_CEF3_ABI_VERSION_V3, 0, 0};
  assert(LB_CEF3_BrowserImeCommitText(
      browser_osr, L"", &empty_range, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 ime_commit_arguments[4]{};
  for (auto& argument : ime_commit_arguments) argument.struct_size = sizeof(argument);
  ime_commit_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  ime_commit_arguments[0].text_value = L"";
  ime_commit_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  ime_commit_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  ime_commit_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  (void)invoke_browser_host_v4(
      UINT64_C(0x755187a0c1476fcd), browser_osr, ime_commit_arguments, 4);

  LB_CEF3_RANGE_V3 composition_selection{
      sizeof(composition_selection), LB_CEF3_ABI_VERSION_V3, 0, 1};
  LB_CEF3_COMPOSITION_UNDERLINE_V3 composition_underline{
      sizeof(composition_underline), LB_CEF3_ABI_VERSION_V3,
      {sizeof(LB_CEF3_RANGE_V3), LB_CEF3_ABI_VERSION_V3, 0, 1},
      0xff000000u, 0x00000000u, 1, 0};
  assert(LB_CEF3_BrowserImeSetComposition(
      browser_osr, L"a", &composition_underline, 1,
      &empty_range, &composition_selection) == LB_CEF3_OK);
  const auto empty_underlines = LB_CEF3_ListCreate();
  assert(empty_underlines != 0);
  LB_CEF3_ARGUMENT_V4 ime_composition_arguments[6]{};
  for (auto& argument : ime_composition_arguments)
    argument.struct_size = sizeof(argument);
  ime_composition_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  ime_composition_arguments[0].text_value = L"a";
  ime_composition_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  ime_composition_arguments[1].handle_value = empty_underlines;
  for (size_t index = 2; index < 6; ++index)
    ime_composition_arguments[index].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  ime_composition_arguments[5].integer_value = 1;
  (void)invoke_browser_host_v4(
      UINT64_C(0xc22f8bcf5665bbb1), browser_osr,
      ime_composition_arguments, 6);
  assert(LB_CEF3_ListRelease(empty_underlines) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserImeCancelComposition(browser_osr) == LB_CEF3_OK);

  LB_CEF3_HANDLE osr_drag_data = 0;
  assert(LB_CEF3_DragDataCreate(&osr_drag_data) == LB_CEF3_OK);
  assert(osr_drag_data != 0);
  LB_CEF3_MOUSE_EVENT_V3 drag_event{
      sizeof(drag_event), LB_CEF3_ABI_VERSION_V3, 12, 14, 0};
  constexpr uint32_t kDragOperationCopy = 1;
  assert(LB_CEF3_BrowserDragTargetDragEnter(
      browser_osr, osr_drag_data, &drag_event, kDragOperationCopy) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserDragTargetDragOver(
      browser_osr, &drag_event, kDragOperationCopy) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserDragTargetDrop(browser_osr, &drag_event) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserDragSourceEndedAt(
      browser_osr, drag_event.x, drag_event.y, kDragOperationCopy) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 drag_enter_arguments[5]{};
  for (auto& argument : drag_enter_arguments) argument.struct_size = sizeof(argument);
  drag_enter_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  drag_enter_arguments[0].handle_value = osr_drag_data;
  for (size_t index = 1; index < 5; ++index)
    drag_enter_arguments[index].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  drag_enter_arguments[1].integer_value = drag_event.x;
  drag_enter_arguments[2].integer_value = drag_event.y;
  drag_enter_arguments[4].integer_value = kDragOperationCopy;
  (void)invoke_browser_host_v4(
      UINT64_C(0x23b7ef7365229434), browser_osr, drag_enter_arguments, 5);
  LB_CEF3_ARGUMENT_V4 drag_over_arguments[4]{};
  for (auto& argument : drag_over_arguments) argument.struct_size = sizeof(argument);
  for (auto& argument : drag_over_arguments) argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  drag_over_arguments[0].integer_value = drag_event.x;
  drag_over_arguments[1].integer_value = drag_event.y;
  drag_over_arguments[3].integer_value = kDragOperationCopy;
  (void)invoke_browser_host_v4(
      UINT64_C(0xa759a7729096f7a1), browser_osr, drag_over_arguments, 4);
  (void)invoke_browser_host_v4(
      UINT64_C(0x95ce3c4f90a1fc16), browser_osr, drag_over_arguments, 3);
  (void)invoke_browser_host_v4(
      UINT64_C(0xbfc035bf07b129b6), browser_osr, drag_over_arguments, 3);
  assert(LB_CEF3_HandleRelease(osr_drag_data) == LB_CEF3_OK);

  LB_CEF3_SIZE_V3 minimum_auto_size{
      sizeof(minimum_auto_size), LB_CEF3_ABI_VERSION_V3, 1, 1};
  LB_CEF3_SIZE_V3 maximum_auto_size{
      sizeof(maximum_auto_size), LB_CEF3_ABI_VERSION_V3, 320, 240};
  assert(LB_CEF3_BrowserSetAutoResizeEnabled(
      browser_osr, 1, &minimum_auto_size, &maximum_auto_size) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserSetAutoResizeEnabled(
      browser_osr, 0, &minimum_auto_size, &maximum_auto_size) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 auto_resize_arguments[5]{};
  for (auto& argument : auto_resize_arguments) argument.struct_size = sizeof(argument);
  auto_resize_arguments[0].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  for (size_t index = 1; index < 5; ++index)
    auto_resize_arguments[index].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  auto_resize_arguments[1].integer_value = minimum_auto_size.width;
  auto_resize_arguments[2].integer_value = minimum_auto_size.height;
  auto_resize_arguments[3].integer_value = maximum_auto_size.width;
  auto_resize_arguments[4].integer_value = maximum_auto_size.height;
  (void)invoke_browser_host_v4(
      UINT64_C(0xf2dbd5fce47481b7), browser_osr, auto_resize_arguments, 5);

  assert(LB_CEF3_BrowserSetFocus(browser_osr, 1) == LB_CEF3_OK);
  const auto osr_touch_ready_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_osr,
      L"(()=>{const emit=kind=>console.log('osr-touch-event-'+kind);"
      L"document.addEventListener('touchstart',()=>emit('start'));"
      L"document.addEventListener('touchmove',()=>emit('move'));"
      L"document.addEventListener('touchend',()=>emit('end'));"
      L"document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')emit('pointer-down')});"
      L"document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')emit('pointer-move')});"
      L"document.addEventListener('pointerup',e=>{if(e.pointerType==='touch')emit('pointer-up')});"
      L"return 'osr-touch-ready';})()");
  assert(osr_touch_ready_task != 0);
  assert(WaitTask(osr_touch_ready_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(osr_touch_ready_task) == LB_CEF3_OK);
  const auto osr_touch_events_before = g_osr_touch_events.load();
  const auto osr_touch_deadline = GetTickCount64() + 5000;
  int osr_touch_id = 71;
  while (g_osr_touch_events.load() < osr_touch_events_before + 3
      && GetTickCount64() < osr_touch_deadline) {
    // A just-created OSR surface can reject the first input sequence while
    // Chromium finishes attaching its compositor. Retry complete, distinct
    // touch lifecycles; the assertion below still requires actual renderer
    // events instead of accepting a fire-and-forget bridge call.
    touch_event.id = osr_touch_id++;
    touch_event.x = 20.0f;
    touch_event.y = 20.0f;
    touch_event.radius_x = 2.0f;
    touch_event.radius_y = 3.0f;
    touch_event.rotation_angle = 0.5f;
    touch_event.pressure = 0.75f;
    touch_event.type = LB_CEF3_TOUCH_EVENT_PRESSED;
    touch_event.modifiers = 0;
    touch_event.pointer_type = LB_CEF3_POINTER_TYPE_TOUCH;
    assert(LB_CEF3_BrowserSendTouchEvent(browser_osr, &touch_event) == LB_CEF3_OK);
    touch_event.type = LB_CEF3_TOUCH_EVENT_MOVED;
    touch_event.x = 24.0f;
    assert(LB_CEF3_BrowserSendTouchEvent(browser_osr, &touch_event) == LB_CEF3_OK);
    touch_arguments[0].integer_value = touch_event.id;
    touch_arguments[1].double_value = 24.0;
    touch_arguments[2].double_value = 20.0;
    touch_arguments[3].double_value = 2.0;
    touch_arguments[4].double_value = 3.0;
    touch_arguments[5].double_value = 0.5;
    touch_arguments[6].double_value = 0.75;
    touch_arguments[7].integer_value = LB_CEF3_TOUCH_EVENT_RELEASED;
    touch_arguments[8].integer_value = 0;
    touch_arguments[9].integer_value = LB_CEF3_POINTER_TYPE_TOUCH;
    touch_call.target = browser_osr;
    assert(LB_CEF3_InvokeV4(&touch_call, &touch_result) == LB_CEF3_OK);
    PumpHostMessages();
    Sleep(100);
  }
  assert(g_osr_touch_events.load() >= osr_touch_events_before + 3);
  const auto osr_closed_before = g_browser_closed_events.load();
  assert(LB_CEF3_BrowserClose(browser_osr, 1) == LB_CEF3_OK);
  const auto osr_close_deadline = GetTickCount64() + 10000;
  while (g_browser_closed_events.load() == osr_closed_before
      && GetTickCount64() < osr_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_closed_events.load() > osr_closed_before);
  assert(LB_CEF3_HandleRelease(browser_osr) == LB_CEF3_OK);
  assert(DestroyWindow(host_osr) != 0);
  ++expected_browser_closed_events;

  // 真无头：parent_window = 0 必须创建成功，且视口取自 V4 配置而不是塌成 1×1。
  LB_CEF3_BROWSER_CONFIG_V4 headless_config = {};
  headless_config.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V4);
  headless_config.abi_version = LB_CEF3_ABI_VERSION_V4;
  headless_config.parent_window = 0;
  headless_config.user_token = 770001;
  headless_config.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_IMAGES;
  headless_config.initial_url = L"about:blank";
  headless_config.profile_key = L"test-headless-create";
  headless_config.osr_width = 1024;
  headless_config.osr_height = 640;
  const int headless_created_before = g_browser_created_events.load();
  const auto headless = LB_CEF3_BrowserCreateWindowless(&headless_config);
  assert(headless != 0);
  const auto headless_created_deadline = GetTickCount64() + 30000;
  while (g_browser_created_events.load() < headless_created_before + 1
      && GetTickCount64() < headless_created_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_created_events.load() >= headless_created_before + 1);
  assert(LB_CEF3_BrowserIsWindowRenderingDisabled(headless) == 1);
  int32_t headless_windowless_flag = 0;
  assert(LB_CEF3_BrowserGetWindowlessFrameRate(
      headless, &headless_windowless_flag) == LB_CEF3_OK);

  // V4 视口必须真的被 GetViewRect 采用：订阅视图矩形事件后触发一次重查，
  // 断言上报尺寸 = 配置里的 osr_width/osr_height（既不是 1×1，也不是默认常量）。
  assert(LB_CEF3_SetEventCallbackV4(
      headless, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(headless, 1) == LB_CEF3_OK);
  const int headless_view_rect_events_before = g_v4_view_rect_events.load();
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(headless) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserResize(headless) == LB_CEF3_OK);
  const auto headless_view_rect_deadline = GetTickCount64() + 15000;
  while (g_v4_view_rect_events.load() <= headless_view_rect_events_before
      && GetTickCount64() < headless_view_rect_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_view_rect_events.load() > headless_view_rect_events_before);
  const std::wstring headless_view_rect_fields = g_last_osr_view_rect_fields;
  assert(headless_view_rect_fields.find(
      L"\"width\":" + std::to_wstring(headless_config.osr_width)
      + L",\"height\":" + std::to_wstring(headless_config.osr_height))
      != std::wstring::npos);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(headless, 0) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(headless, nullptr, nullptr) == LB_CEF3_OK);

  // 视口读写与出帧计数：中文命令 CEF3无头_设置视口/取视口JSON/取渲染帧数 的桥层落点。
  LB_CEF3_BROWSER_CONFIG_V4 viewport_config = headless_config;
  viewport_config.user_token = 770005;
  viewport_config.profile_key = L"test-headless-viewport";
  const int viewport_created_before = g_browser_created_events.load();
  const auto osr_for_viewport = LB_CEF3_BrowserCreateWindowless(&viewport_config);
  assert(osr_for_viewport != 0);
  const auto viewport_created_deadline = GetTickCount64() + 30000;
  while (g_browser_created_events.load() < viewport_created_before + 1
      && GetTickCount64() < viewport_created_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_created_events.load() >= viewport_created_before + 1);

  uint32_t osr_view_width = 0;
  uint32_t osr_view_height = 0;
  assert(LB_CEF3_BrowserGetOsrViewport(
      osr_for_viewport, &osr_view_width, &osr_view_height) == LB_CEF3_OK);
  assert(osr_view_width == static_cast<uint32_t>(viewport_config.osr_width));
  assert(osr_view_height == static_cast<uint32_t>(viewport_config.osr_height));

  // 订阅必须先于设置视口：断言「设置导出自己就让 CEF 重查 GetViewRect」，
  // 而不是靠外部再补一次 NotifyScreenInfoChanged 才生效。
  assert(LB_CEF3_SetEventCallbackV4(
      osr_for_viewport, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(osr_for_viewport, 1) == LB_CEF3_OK);
  // 计数器快照必须在「设置视口」之前取：读侧一律以 g_v4_view_rect_events 判断有没有新事件，
  // 循环里绝不碰 g_last_osr_view_rect_fields（该 std::wstring 由 CEF UI 线程赋值，
  // 并发读其内部缓冲区是未定义行为），只在循环结束后拷贝一次并对副本断言。
  const int resized_view_rect_events_before = g_v4_view_rect_events.load();
  assert(LB_CEF3_BrowserSetOsrViewport(osr_for_viewport, 800, 600) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserGetOsrViewport(
      osr_for_viewport, &osr_view_width, &osr_view_height) == LB_CEF3_OK);
  assert(osr_view_width == 800);
  assert(osr_view_height == 600);
  const std::wstring resized_view_rect_size = L"\"width\":800,\"height\":600";
  const auto resized_view_rect_deadline = GetTickCount64() + 15000;
  while (g_v4_view_rect_events.load() <= resized_view_rect_events_before
      && GetTickCount64() < resized_view_rect_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_view_rect_events.load() > resized_view_rect_events_before);
  const std::wstring resized_view_rect_fields = g_last_osr_view_rect_fields;
  assert(resized_view_rect_fields.find(resized_view_rect_size)
      != std::wstring::npos);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(osr_for_viewport, 0) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(osr_for_viewport, nullptr, nullptr) == LB_CEF3_OK);

  // 0 宽高会让 CEF 拿到 0×0 视图矩形，必须在入口拒掉而不是静默夹到 1。
  assert(LB_CEF3_BrowserSetOsrViewport(osr_for_viewport, 0, 600)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSetOsrViewport(osr_for_viewport, 800, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::array<wchar_t, 256> viewport_error{};
  size_t viewport_error_required = 0;
  LB_CEF3_GetLastError(
      viewport_error.data(), viewport_error.size(), &viewport_error_required);
  assert(std::wstring(viewport_error.data()) == L"无头浏览器视口宽高必须为正整数");
  assert(LB_CEF3_BrowserGetOsrViewport(osr_for_viewport, nullptr, &osr_view_height)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserGetOsrPaintCount(osr_for_viewport, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  // 不订阅 on_paint 也必须累计帧数：证明渲染在跑，只是不外发像素。
  uint64_t paint_count = 0;
  const auto paint_count_deadline = GetTickCount64() + 15000;
  while (paint_count == 0 && GetTickCount64() < paint_count_deadline) {
    PumpHostMessages();
    Sleep(10);
    assert(LB_CEF3_BrowserGetOsrPaintCount(
        osr_for_viewport, &paint_count) == LB_CEF3_OK);
  }
  assert(paint_count >= 1);

  // 出帧之后再读一次视口：OnPaint 会把存储视口覆盖为该帧的实际尺寸，因此
  // LB_CEF3_BrowserGetOsrViewport 报告的是 CEF 实际渲染尺寸，不保证仍等于刚才设定的值
  // （设定前已在途的旧尺寸帧可能后到并改写）。这里的副本断言钉住可观察到的事实：
  // 尺寸恒为正，且当前固定视口路径实测不漂移；取视口JSON 必须按「实际渲染尺寸」口径文档化。
  uint32_t painted_view_width = 0;
  uint32_t painted_view_height = 0;
  assert(LB_CEF3_BrowserGetOsrViewport(
      osr_for_viewport, &painted_view_width, &painted_view_height) == LB_CEF3_OK);
  std::fprintf(stderr,
      "CEF3 test checkpoint: osr-viewport-after-paint %ux%u paint_count=%llu\n",
      painted_view_width, painted_view_height,
      static_cast<unsigned long long>(paint_count));
  assert(painted_view_width >= 1 && painted_view_height >= 1);
  assert(painted_view_width == 800 && painted_view_height == 600);

  // 普通窗口浏览器调用 OSR 专用导出必须给中文诊断并返回 NOT_SUPPORTED。
  assert(LB_CEF3_BrowserGetOsrPaintCount(browser_a, &paint_count)
      == LB_CEF3_ERROR_NOT_SUPPORTED);
  LB_CEF3_GetLastError(
      viewport_error.data(), viewport_error.size(), &viewport_error_required);
  assert(std::wstring(viewport_error.data()) == L"该导出仅适用于无窗口OSR浏览器");
  assert(LB_CEF3_BrowserGetOsrViewport(browser_a, &osr_view_width, &osr_view_height)
      == LB_CEF3_ERROR_NOT_SUPPORTED);
  assert(LB_CEF3_BrowserSetOsrViewport(browser_a, 800, 600)
      == LB_CEF3_ERROR_NOT_SUPPORTED);

  const auto viewport_closed_before = g_browser_closed_events.load();
  assert(LB_CEF3_BrowserClose(osr_for_viewport, 1) == LB_CEF3_OK);
  const auto viewport_close_deadline = GetTickCount64() + 10000;
  while (g_browser_closed_events.load() == viewport_closed_before
      && GetTickCount64() < viewport_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_closed_events.load() > viewport_closed_before);
  assert(LB_CEF3_HandleRelease(osr_for_viewport) == LB_CEF3_OK);
  ++expected_browser_closed_events;

  // 缺 WINDOWLESS 标志必须被拒，绝不静默退化成窗口浏览器。
  LB_CEF3_BROWSER_CONFIG_V4 missing_flag = headless_config;
  missing_flag.flags = LB_CEF3_BROWSER_JAVASCRIPT;
  missing_flag.profile_key = L"test-headless-missing-flag";
  assert(LB_CEF3_BrowserCreateWindowless(&missing_flag) == 0);

  // Chrome Runtime + windowless 仍然不支持。
  LB_CEF3_BROWSER_CONFIG_V4 chrome_windowless = headless_config;
  chrome_windowless.flags |= LB_CEF3_BROWSER_CHROME_RUNTIME;
  chrome_windowless.profile_key = L"test-headless-chrome";
  assert(LB_CEF3_BrowserCreateWindowless(&chrome_windowless) == 0);

  const auto headless_closed_before = g_browser_closed_events.load();
  assert(LB_CEF3_BrowserClose(headless, 1) == LB_CEF3_OK);
  const auto headless_close_deadline = GetTickCount64() + 10000;
  while (g_browser_closed_events.load() == headless_closed_before
      && GetTickCount64() < headless_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_closed_events.load() > headless_closed_before);
  assert(LB_CEF3_HandleRelease(headless) == LB_CEF3_OK);
  ++expected_browser_closed_events;

  // V3 配置 + parent_window = 0 + WINDOWLESS 走 BrowserCreate：允许创建，视口回落到默认常量。
  LB_CEF3_BROWSER_CONFIG_V3 legacy_windowless = {};
  legacy_windowless.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V3);
  legacy_windowless.abi_version = LB_CEF3_ABI_VERSION_V3;
  legacy_windowless.parent_window = 0;
  legacy_windowless.user_token = 770002;
  legacy_windowless.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT;
  legacy_windowless.profile_key = L"test-headless-v3-default-viewport";
  const int legacy_created_before = g_browser_created_events.load();
  const auto legacy = LB_CEF3_BrowserCreate(&legacy_windowless);
  assert(legacy != 0);
  const auto legacy_created_deadline = GetTickCount64() + 30000;
  while (g_browser_created_events.load() < legacy_created_before + 1
      && GetTickCount64() < legacy_created_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_created_events.load() >= legacy_created_before + 1);
  // 配置未给出视口 + parent_window = 0：既不能塌成 1×1，也不能被创建期写死的默认值钉住，
  // 必须走 GetViewRect 的第三级回落 = LB_CEF3_DEFAULT_OSR_WIDTH/HEIGHT。
  assert(LB_CEF3_SetEventCallbackV4(
      legacy, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(legacy, 1) == LB_CEF3_OK);
  const int legacy_view_rect_events_before = g_v4_view_rect_events.load();
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(legacy) == LB_CEF3_OK);
  const auto legacy_view_rect_deadline = GetTickCount64() + 15000;
  while (g_v4_view_rect_events.load() <= legacy_view_rect_events_before
      && GetTickCount64() < legacy_view_rect_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_view_rect_events.load() > legacy_view_rect_events_before);
  const std::wstring legacy_view_rect_fields = g_last_osr_view_rect_fields;
  assert(legacy_view_rect_fields.find(
      L"\"width\":" + std::to_wstring(LB_CEF3_DEFAULT_OSR_WIDTH)
      + L",\"height\":" + std::to_wstring(LB_CEF3_DEFAULT_OSR_HEIGHT))
      != std::wstring::npos);
  // 未显式设置视口时 getter 必须走与 GetViewRect 同一条三级链，
  // 直接读裸字段会报 0×0（宿主跟随/回落型浏览器是常态形态）。
  uint32_t legacy_view_width = 0;
  uint32_t legacy_view_height = 0;
  assert(LB_CEF3_BrowserGetOsrViewport(
      legacy, &legacy_view_width, &legacy_view_height) == LB_CEF3_OK);
  assert(legacy_view_width == LB_CEF3_DEFAULT_OSR_WIDTH);
  assert(legacy_view_height == LB_CEF3_DEFAULT_OSR_HEIGHT);
  assert(LB_CEF3_RenderHandlerSubscribeViewRect(legacy, 0) == LB_CEF3_OK);
  assert(LB_CEF3_SetEventCallbackV4(legacy, nullptr, nullptr) == LB_CEF3_OK);
  const auto legacy_closed_before = g_browser_closed_events.load();
  assert(LB_CEF3_BrowserClose(legacy, 1) == LB_CEF3_OK);
  const auto legacy_close_deadline = GetTickCount64() + 10000;
  while (g_browser_closed_events.load() == legacy_closed_before
      && GetTickCount64() < legacy_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_browser_closed_events.load() > legacy_closed_before);
  assert(LB_CEF3_HandleRelease(legacy) == LB_CEF3_OK);
  ++expected_browser_closed_events;

  // 非 windowless 且无 parent：保持原阻断。
  LB_CEF3_BROWSER_CONFIG_V3 windowed_no_parent = {};
  windowed_no_parent.struct_size = sizeof(windowed_no_parent);
  windowed_no_parent.abi_version = LB_CEF3_ABI_VERSION_V3;
  windowed_no_parent.user_token = 770003;
  windowed_no_parent.flags = LB_CEF3_BROWSER_JAVASCRIPT;
  assert(LB_CEF3_BrowserCreate(&windowed_no_parent) == 0);

  // V3 调用方自己声明的结构体长度必须继续是门禁：V3→V4 加宽转发不得抹掉它。
  std::array<wchar_t, 256> headless_error{};
  size_t headless_error_required = 0;
  LB_CEF3_BROWSER_CONFIG_V3 truncated_v3 = {};
  truncated_v3.struct_size = sizeof(uint32_t) * 2;
  truncated_v3.abi_version = LB_CEF3_ABI_VERSION_V3;
  truncated_v3.user_token = 770004;
  truncated_v3.flags = LB_CEF3_BROWSER_WINDOWLESS | LB_CEF3_BROWSER_JAVASCRIPT;
  assert(LB_CEF3_BrowserCreate(&truncated_v3) == 0);
  LB_CEF3_GetLastError(
      headless_error.data(), headless_error.size(), &headless_error_required);
  assert(std::wstring(headless_error.data()) == L"浏览器配置版本无效");
  assert(LB_CEF3_BrowserCreateChrome(&truncated_v3) == 0);

  // 尾部字段守卫：空配置必须被拒，且给无头专用中文诊断。
  assert(LB_CEF3_BrowserCreateWindowless(nullptr) == 0);
  LB_CEF3_GetLastError(
      headless_error.data(), headless_error.size(), &headless_error_required);
  assert(std::wstring(headless_error.data()) == L"无头浏览器配置不能为空");

  // V4 声明但结构体长度不足以覆盖 osr_width/osr_height：必须显式拒绝，
  // 绝不能去读调用方未声明的尾部偏移。
  LB_CEF3_BROWSER_CONFIG_V4 truncated_v4 = headless_config;
  truncated_v4.struct_size = sizeof(LB_CEF3_BROWSER_CONFIG_V3);
  truncated_v4.profile_key = L"test-headless-truncated-v4";
  assert(LB_CEF3_BrowserCreateWindowless(&truncated_v4) == 0);
  LB_CEF3_GetLastError(
      headless_error.data(), headless_error.size(), &headless_error_required);
  assert(std::wstring(headless_error.data()) == L"无头浏览器配置版本无效");

  LB_CEF3_ARGUMENT_V4 focus_argument{};
  focus_argument.struct_size = sizeof(focus_argument);
  focus_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  focus_argument.integer_value = 1;
  LB_CEF3_CALL_V4 focus_call{};
  focus_call.struct_size = sizeof(focus_call);
  focus_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  focus_call.operation_id = UINT64_C(0xc471ee0654b454d2);
  focus_call.target = browser_a;
  focus_call.arguments = &focus_argument;
  focus_call.argument_count = 1;
  LB_CEF3_RESULT_V4 focus_result{};
  focus_result.struct_size = sizeof(focus_result);
  assert(LB_CEF3_InvokeV4(&focus_call, &focus_result) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 mouse_arguments[6]{};
  for (auto& argument : mouse_arguments) argument.struct_size = sizeof(argument);
  mouse_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_arguments[0].integer_value = 10;
  mouse_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_arguments[1].integer_value = 10;
  mouse_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_arguments[3].integer_value = LB_CEF3_MOUSE_BUTTON_LEFT;
  mouse_arguments[4].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  mouse_arguments[4].integer_value = 1;
  mouse_arguments[5].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  mouse_arguments[5].integer_value = 1;
  LB_CEF3_CALL_V4 mouse_call{};
  mouse_call.struct_size = sizeof(mouse_call);
  mouse_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  mouse_call.operation_id = UINT64_C(0x90d70acc8c576f28);
  mouse_call.target = browser_a;
  mouse_call.arguments = mouse_arguments;
  mouse_call.argument_count = 6;
  LB_CEF3_RESULT_V4 mouse_result{};
  mouse_result.struct_size = sizeof(mouse_result);
  assert(LB_CEF3_InvokeV4(&mouse_call, &mouse_result) == LB_CEF3_OK);
  const auto navigated_hook_task = LB_CEF3_BrowserEvaluateJavaScript(browser_a, L"globalThis.__lingBuilderHookRuns||0");
  assert(navigated_hook_task != 0);
  assert(WaitTask(navigated_hook_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(navigated_hook_task).find(L"\"value\":1") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(navigated_hook_task) == LB_CEF3_OK);
  assert(LB_CEF3_JsHookRemove(hook) == LB_CEF3_OK);
  assert(LB_CEF3_HandleIsValid(hook, LB_CEF3_HANDLE_JSHOOK) == LB_CEF3_ERROR_RELEASED_HANDLE);
  const auto before_unload_task = LB_CEF3_BrowserEvaluateJavaScript(
      browser_a,
      L"window.onbeforeunload=function(event){event.preventDefault();event.returnValue='leave';return 'leave';};'armed'");
  assert(before_unload_task != 0);
  assert(WaitTask(before_unload_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(before_unload_task) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserLoadUrl(browser_a, L"about:blank?after-before-unload") == LB_CEF3_OK);
  const auto before_unload_deadline = GetTickCount64() + 5000;
  while ((g_before_unload_events.load() < 1 || g_dialog_reset_events.load() < 1)
      && GetTickCount64() < before_unload_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_before_unload_events.load() >= 1);
  assert(g_dialog_reset_events.load() >= 1);
  const auto context_a = LB_CEF3_BrowserGetRequestContext(browser_a);
  const auto context_b = LB_CEF3_BrowserGetRequestContext(browser_b);
  assert(context_a != 0 && context_b != 0);
  assert(LB_CEF3_HandleGetType(context_a) == LB_CEF3_HANDLE_REQUEST_CONTEXT);
  assert(LB_CEF3_RequestContextResolveHost(context_a, nullptr) == 0);
  assert(LB_CEF3_RequestContextResolveHost(browser_a, L"https://localhost") == 0);
  const auto resolve_host_task = LB_CEF3_RequestContextResolveHost(
      context_a, L"https://localhost");
  assert(resolve_host_task != 0);
  assert(WaitTask(resolve_host_task) == LB_CEF3_TASK_SUCCEEDED);
  const auto resolve_host_json = TaskResult(resolve_host_task);
  assert(resolve_host_json.find(L"\"errorCode\":") != std::wstring::npos);
  assert(resolve_host_json.find(L"\"resolvedIps\":[") != std::wstring::npos);
  size_t resolve_required = 0;
  assert(LB_CEF3_ResolveCallbackGetResult(
      resolve_host_task, nullptr, 0, &resolve_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring resolve_result(resolve_required, L'\0');
  assert(LB_CEF3_ResolveCallbackGetResult(
      resolve_host_task, resolve_result.data(), resolve_result.size(),
      &resolve_required) == LB_CEF3_OK);
  resolve_result.resize(wcslen(resolve_result.c_str()));
  assert(resolve_result == resolve_host_json);

  LB_CEF3_ARGUMENT_V4 resolve_host_argument{};
  resolve_host_argument.struct_size = sizeof(resolve_host_argument);
  resolve_host_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  resolve_host_argument.text_value = L"https://localhost";
  const auto resolve_host_v4_result = invoke_view_call(make_view_call(
      UINT64_C(0xf6a4f13b19602ab5), context_a, &resolve_host_argument, 1));
  const auto resolve_host_task_v4 = resolve_host_v4_result.handle_value;
  assert(resolve_host_task_v4 != 0);
  assert(WaitTask(resolve_host_task_v4) == LB_CEF3_TASK_SUCCEEDED);
  const auto resolve_host_v4_json = ReadV4Json(make_view_call(
      UINT64_C(0x4ea20f11f78d5017), resolve_host_task_v4));
  assert(resolve_host_v4_json.find(L"\"errorCode\":") != std::wstring::npos);
  assert(resolve_host_v4_json.find(L"\"resolvedIps\":[") != std::wstring::npos);
  resolve_host_argument.text_value = L"";
  auto invalid_resolve_host_call = make_view_call(
      UINT64_C(0xf6a4f13b19602ab5), context_a, &resolve_host_argument, 1);
  LB_CEF3_RESULT_V4 invalid_resolve_host_result{};
  invalid_resolve_host_result.struct_size = sizeof(invalid_resolve_host_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_resolve_host_call, &invalid_resolve_host_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_resolve_host_call.operation_id = UINT64_C(0x4ea20f11f78d5017);
  invalid_resolve_host_call.target = resolve_host_task_v4;
  assert(LB_CEF3_InvokeV4(
      &invalid_resolve_host_call, &invalid_resolve_host_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TaskRelease(resolve_host_task_v4) == LB_CEF3_OK);
  assert(LB_CEF3_ResolveCallbackGetResult(
      resolve_host_task_v4, nullptr, 0, &resolve_required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_TaskRelease(resolve_host_task) == LB_CEF3_OK);
  LB_CEF3_HANDLE request_context_handler = 0;
  assert(LB_CEF3_RequestContextGetHandler(context_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextGetHandler(
      context_a, &request_context_handler) == LB_CEF3_OK);
  assert(request_context_handler != 0);
  assert(LB_CEF3_HandleGetType(request_context_handler)
      == LB_CEF3_HANDLE_REQUEST_CONTEXT_HANDLER);
  LB_CEF3_HANDLE initialized_context = 0;
  assert(LB_CEF3_RequestContextHandlerGetInitializedContext(
      request_context_handler, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextHandlerGetInitializedContext(
      request_context_handler, &initialized_context) == LB_CEF3_OK);
  assert(initialized_context != 0);
  assert(LB_CEF3_RequestContextIsSame(context_a, initialized_context) == 1);
  const auto request_context_handler_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x2bb07098094a591c), context_a)).handle_value;
  assert(request_context_handler_v4 != 0);
  const auto initialized_context_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x51a4d6a4b1b74ef5), request_context_handler_v4)).handle_value;
  assert(initialized_context_v4 != 0);
  assert(LB_CEF3_RequestContextIsSame(context_a, initialized_context_v4) == 1);
  LB_CEF3_ARGUMENT_V4 invalid_context_handler_argument{};
  invalid_context_handler_argument.struct_size =
      sizeof(invalid_context_handler_argument);
  invalid_context_handler_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto invalid_context_handler_call = make_view_call(
      UINT64_C(0x51a4d6a4b1b74ef5), request_context_handler_v4,
      &invalid_context_handler_argument, 1);
  LB_CEF3_RESULT_V4 invalid_context_handler_result{};
  invalid_context_handler_result.struct_size =
      sizeof(invalid_context_handler_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_context_handler_call, &invalid_context_handler_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_context_handler_call.arguments = nullptr;
  invalid_context_handler_call.argument_count = 0;
  invalid_context_handler_call.target = context_a;
  assert(LB_CEF3_InvokeV4(
      &invalid_context_handler_call, &invalid_context_handler_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_HandleRelease(initialized_context_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(request_context_handler_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(initialized_context) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(request_context_handler) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextHandlerGetInitializedContext(
      request_context_handler, &initialized_context)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_HANDLE context_media_router = 0;
  LB_CEF3_HANDLE global_media_router = 0;
  assert(LB_CEF3_RequestContextGetMediaRouter(context_a, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextGetMediaRouter(
      browser_a, &context_media_router) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_RequestContextGetMediaRouter(
      context_a, &context_media_router) == LB_CEF3_OK);
  assert(context_media_router != 0);
  assert(LB_CEF3_HandleGetType(context_media_router)
      == LB_CEF3_HANDLE_MEDIA_ROUTER);
  assert(LB_CEF3_MediaRouterGetGlobal(nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaRouterGetGlobal(&global_media_router) == LB_CEF3_OK);
  assert(global_media_router != 0);
  assert(LB_CEF3_HandleGetType(global_media_router)
      == LB_CEF3_HANDLE_MEDIA_ROUTER);
  std::array<wchar_t, 8> media_router_test_flag{};
  const auto media_router_test_flag_length = GetEnvironmentVariableW(
      L"LB_CEF3_TEST_MEDIA_ROUTER_NOTIFY", media_router_test_flag.data(),
      static_cast<DWORD>(media_router_test_flag.size()));
  const bool exercise_media_router_notifications =
      media_router_test_flag_length == 1 && media_router_test_flag[0] == L'1';
  const auto context_media_router_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x64f836e7bd941e9c), context_a)).handle_value;
  const auto global_media_router_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xbe9772fad90f18da), 0)).handle_value;
  assert(context_media_router_v4 != 0 && global_media_router_v4 != 0);
  auto invalid_global_media_router_call = make_view_call(
      UINT64_C(0xbe9772fad90f18da), context_a);
  LB_CEF3_RESULT_V4 invalid_global_media_router_result{};
  invalid_global_media_router_result.struct_size =
      sizeof(invalid_global_media_router_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_global_media_router_call, &invalid_global_media_router_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_HANDLE cast_media_source = 0;
  LB_CEF3_HANDLE dial_media_source = 0;
  assert(LB_CEF3_MediaRouterGetSource(
      global_media_router, nullptr, &cast_media_source)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaRouterGetSource(
      global_media_router, L"", &cast_media_source)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaRouterGetSource(
      global_media_router, L"cast:233637DE", nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaRouterGetSource(
      context_a, L"cast:233637DE", &cast_media_source)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaRouterGetSource(
      global_media_router, L"cast:233637DE", &cast_media_source)
      == LB_CEF3_OK);
  assert(cast_media_source != 0);
  assert(LB_CEF3_HandleGetType(cast_media_source)
      == LB_CEF3_HANDLE_MEDIA_SOURCE);
  assert(LB_CEF3_MediaRouterGetSource(
      global_media_router, L"cast-dial:YouTube", &dial_media_source)
      == LB_CEF3_OK);
  assert(dial_media_source != 0);
  assert(LB_CEF3_HandleGetType(dial_media_source)
      == LB_CEF3_HANDLE_MEDIA_SOURCE);

  size_t media_source_id_required = 0;
  assert(LB_CEF3_MediaSourceGetId(
      cast_media_source, nullptr, 0, &media_source_id_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> media_source_id(media_source_id_required, L'\0');
  assert(LB_CEF3_MediaSourceGetId(
      cast_media_source, media_source_id.data(), media_source_id.size(),
      &media_source_id_required) == LB_CEF3_OK);
  assert(std::wstring(media_source_id.data()) == L"cast:233637DE");
  assert(LB_CEF3_MediaSourceGetId(
      global_media_router, nullptr, 0, &media_source_id_required)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaSourceIsCast(cast_media_source) == 1);
  assert(LB_CEF3_MediaSourceIsDial(cast_media_source) == 0);
  assert(LB_CEF3_MediaSourceIsCast(dial_media_source) == 0);
  assert(LB_CEF3_MediaSourceIsDial(dial_media_source) == 1);
  size_t dial_media_source_id_required = 0;
  assert(LB_CEF3_MediaSourceGetId(
      dial_media_source, nullptr, 0, &dial_media_source_id_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> dial_media_source_id(
      dial_media_source_id_required, L'\0');
  assert(LB_CEF3_MediaSourceGetId(
      dial_media_source, dial_media_source_id.data(),
      dial_media_source_id.size(), &dial_media_source_id_required)
      == LB_CEF3_OK);
  assert(std::wstring(dial_media_source_id.data()) == L"cast-dial:YouTube");
  assert(LB_CEF3_MediaSourceIsCast(global_media_router)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaRouterNotifyCurrentRoutes(context_a)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_HANDLE media_observer = 0;
  assert(LB_CEF3_MediaRouterAddObserver(global_media_router, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaRouterAddObserver(context_a, &media_observer)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_TASK_HANDLE media_sinks_task = 0;
  LB_CEF3_TASK_HANDLE media_routes_task = 0;
  assert(LB_CEF3_MediaObserverNextSinks(
      global_media_router, &media_sinks_task) == LB_CEF3_ERROR_HANDLE_TYPE);

  auto take_media_collection = [](
      LB_CEF3_TASK_HANDLE task, int expected_type) {
    LB_CEF3_HANDLE collection = 0;
    assert(LB_CEF3_TaskTakeMediaCollectionResult(task, &collection)
        == LB_CEF3_OK);
    assert(collection != 0);
    assert(LB_CEF3_HandleGetType(collection) == expected_type);
    int64_t count = -1;
    assert(LB_CEF3_MediaCollectionGetCount(collection, &count) == LB_CEF3_OK);
    assert(count >= 0);
    assert(LB_CEF3_MediaCollectionGetItem(collection, -1, nullptr)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
    LB_CEF3_HANDLE item = 0;
    if (count == 0) {
      assert(LB_CEF3_MediaCollectionGetItem(collection, 0, &item)
          == LB_CEF3_ERROR_NOT_FOUND);
    } else {
      assert(LB_CEF3_MediaCollectionGetItem(collection, 0, &item)
          == LB_CEF3_OK);
      assert(item != 0);
      assert(LB_CEF3_HandleGetType(item)
          == (expected_type == LB_CEF3_HANDLE_MEDIA_SINK_COLLECTION
                  ? LB_CEF3_HANDLE_MEDIA_SINK : LB_CEF3_HANDLE_MEDIA_ROUTE));
      assert(LB_CEF3_HandleRelease(item) == LB_CEF3_OK);
    }
    return collection;
  };
  LB_CEF3_HANDLE media_sinks = 0;
  LB_CEF3_HANDLE media_routes = 0;
  LB_CEF3_HANDLE first_media_sink = 0;
  LB_CEF3_HANDLE first_media_route = 0;
  if (exercise_media_router_notifications) {
    assert(LB_CEF3_MediaRouterAddObserver(
        global_media_router, &media_observer) == LB_CEF3_OK);
    assert(media_observer != 0);
    assert(LB_CEF3_HandleGetType(media_observer)
        == LB_CEF3_HANDLE_MEDIA_OBSERVER);
    assert(LB_CEF3_MediaObserverNextSinks(media_observer, nullptr)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
    assert(LB_CEF3_MediaObserverNextSinks(
        media_observer, &media_sinks_task) == LB_CEF3_OK);
    assert(LB_CEF3_MediaObserverNextRoutes(
        media_observer, &media_routes_task) == LB_CEF3_OK);
    assert(LB_CEF3_MediaRouterNotifyCurrentRoutes(global_media_router)
        == LB_CEF3_OK);
    assert(LB_CEF3_MediaRouterNotifyCurrentSinks(global_media_router)
        == LB_CEF3_OK);
    assert(WaitTask(media_sinks_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(WaitTask(media_routes_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(TaskResult(media_sinks_task).find(L"\"kind\":\"sinks\"")
        != std::wstring::npos);
    assert(TaskResult(media_routes_task).find(L"\"kind\":\"routes\"")
        != std::wstring::npos);
    media_sinks = take_media_collection(
        media_sinks_task, LB_CEF3_HANDLE_MEDIA_SINK_COLLECTION);
    media_routes = take_media_collection(
        media_routes_task, LB_CEF3_HANDLE_MEDIA_ROUTE_COLLECTION);
    int64_t media_sink_count = 0;
    int64_t media_route_count = 0;
    assert(LB_CEF3_MediaCollectionGetCount(
        media_sinks, &media_sink_count) == LB_CEF3_OK);
    assert(LB_CEF3_MediaCollectionGetCount(
        media_routes, &media_route_count) == LB_CEF3_OK);
    if (media_sink_count > 0) {
      assert(LB_CEF3_MediaCollectionGetItem(
          media_sinks, 0, &first_media_sink) == LB_CEF3_OK);
      assert(first_media_sink != 0);
      assert(!ReadManagedText(
          first_media_sink, LB_CEF3_MediaSinkGetId).empty());
      assert(!ReadManagedText(
          first_media_sink, LB_CEF3_MediaSinkGetName).empty());
      int32_t media_sink_icon = -1;
      assert(LB_CEF3_MediaSinkGetIconType(
          first_media_sink, &media_sink_icon) == LB_CEF3_OK);
      assert(media_sink_icon >= 0 && media_sink_icon < 8);
      const int is_cast_sink = LB_CEF3_MediaSinkIsCast(first_media_sink);
      const int is_dial_sink = LB_CEF3_MediaSinkIsDial(first_media_sink);
      assert(is_cast_sink == 0 || is_cast_sink == 1);
      assert(is_dial_sink == 0 || is_dial_sink == 1);
      const int compatible = LB_CEF3_MediaSinkIsCompatibleWith(
          first_media_sink, cast_media_source);
      assert(compatible == 0 || compatible == 1);

      LB_CEF3_TASK_HANDLE device_info_task = 0;
      assert(LB_CEF3_MediaSinkGetDeviceInfo(
          first_media_sink, &device_info_task) == LB_CEF3_OK);
      assert(device_info_task != 0);
      assert(WaitTask(device_info_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
      const auto device_info_json = ReadManagedText(
          device_info_task, LB_CEF3_MediaSinkDeviceInfoGetResult);
      assert(device_info_json.find(L"\"ipAddress\"") != std::wstring::npos);
      assert(device_info_json.find(L"\"modelName\"") != std::wstring::npos);
      assert(LB_CEF3_TaskRelease(device_info_task) == LB_CEF3_OK);
    }
    if (media_route_count > 0) {
      assert(LB_CEF3_MediaCollectionGetItem(
          media_routes, 0, &first_media_route) == LB_CEF3_OK);
      assert(first_media_route != 0);
      assert(!ReadManagedText(
          first_media_route, LB_CEF3_MediaRouteGetId).empty());
      LB_CEF3_HANDLE route_source = 0;
      LB_CEF3_HANDLE route_sink = 0;
      assert(LB_CEF3_MediaRouteGetSource(
          first_media_route, &route_source) == LB_CEF3_OK);
      assert(LB_CEF3_MediaRouteGetSink(
          first_media_route, &route_sink) == LB_CEF3_OK);
      assert(route_source != 0 && route_sink != 0);
      assert(LB_CEF3_HandleGetType(route_source)
          == LB_CEF3_HANDLE_MEDIA_SOURCE);
      assert(LB_CEF3_HandleGetType(route_sink)
          == LB_CEF3_HANDLE_MEDIA_SINK);
      assert(LB_CEF3_HandleRelease(route_sink) == LB_CEF3_OK);
      assert(LB_CEF3_HandleRelease(route_source) == LB_CEF3_OK);
    }
    LB_CEF3_HANDLE duplicate_media_collection = UINT64_MAX;
    assert(LB_CEF3_TaskTakeMediaCollectionResult(
        media_sinks_task, &duplicate_media_collection)
        == LB_CEF3_ERROR_NOT_FOUND);
    assert(duplicate_media_collection == 0);

    LB_CEF3_TASK_HANDLE route_state_task = 0;
    LB_CEF3_TASK_HANDLE route_message_task = 0;
    assert(LB_CEF3_MediaObserverNextRouteState(
        media_observer, &route_state_task) == LB_CEF3_OK);
    assert(LB_CEF3_MediaObserverNextRouteMessage(
        media_observer, &route_message_task) == LB_CEF3_OK);
    assert(route_state_task != 0 && route_message_task != 0);
    assert(LB_CEF3_TaskCancel(route_state_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskCancel(route_message_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskTakeMediaRouteResult(
        route_state_task, &duplicate_media_collection)
        == LB_CEF3_ERROR_OPERATION_FAILED);
    assert(LB_CEF3_TaskTakeMediaBufferResult(
        route_message_task, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
    assert(LB_CEF3_TaskRelease(route_message_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(route_state_task) == LB_CEF3_OK);
  }

  assert(LB_CEF3_MediaSinkGetIconType(cast_media_source, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  int32_t invalid_media_icon = -1;
  assert(LB_CEF3_MediaSinkGetIconType(
      cast_media_source, &invalid_media_icon) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaSinkGetDeviceInfo(cast_media_source, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_TASK_HANDLE invalid_media_task = 0;
  assert(LB_CEF3_MediaSinkGetDeviceInfo(
      cast_media_source, &invalid_media_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaSinkIsCast(cast_media_source)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaSinkIsCompatibleWith(
      cast_media_source, cast_media_source) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaRouteGetSource(cast_media_source, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE invalid_media_object = UINT64_MAX;
  assert(LB_CEF3_MediaRouteGetSource(
      cast_media_source, &invalid_media_object) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_media_object == 0);
  const std::array<unsigned char, 3> media_message{{1, 2, 3}};
  const auto media_message_buffer = LB_CEF3_BufferCreate(
      media_message.data(), media_message.size());
  assert(media_message_buffer != 0);
  assert(LB_CEF3_MediaRouteSendMessage(
      cast_media_source, media_message_buffer) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaRouteTerminate(cast_media_source)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_BufferRelease(media_message_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_MediaRouterCreateRoute(
      global_media_router, cast_media_source, cast_media_source,
      &invalid_media_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaRouterCreateRoute(
      global_media_router, cast_media_source, first_media_sink,
      nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_MediaObserverNextRouteState(
      global_media_router, &invalid_media_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_MediaObserverNextRouteMessage(
      global_media_router, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto completed_media_callback_task = LB_CEF3_TaskCreate();
  assert(completed_media_callback_task != 0);
  assert(LB_CEF3_TaskSetRunning(completed_media_callback_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskSetResult(
      completed_media_callback_task,
      L"{\"result\":1,\"error\":\"\",\"hasRoute\":false}")
      == LB_CEF3_OK);
  assert(ReadManagedText(
      completed_media_callback_task, LB_CEF3_MediaRouteCreateGetResult)
      .find(L"\"result\":1") != std::wstring::npos);
  assert(ReadManagedText(
      completed_media_callback_task, LB_CEF3_MediaSinkDeviceInfoGetResult)
      .find(L"\"hasRoute\":false") != std::wstring::npos);
  invalid_media_object = UINT64_MAX;
  assert(LB_CEF3_TaskTakeMediaRouteResult(
      completed_media_callback_task, &invalid_media_object)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(invalid_media_object == 0);

  LB_CEF3_ARGUMENT_V4 media_source_urn_argument{};
  media_source_urn_argument.struct_size = sizeof(media_source_urn_argument);
  media_source_urn_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  media_source_urn_argument.text_value = L"cast:233637DE";
  const auto cast_media_source_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xee82607699c4f2ad), global_media_router_v4,
      &media_source_urn_argument, 1)).handle_value;
  assert(cast_media_source_v4 != 0);
  assert(LB_CEF3_HandleGetType(cast_media_source_v4)
      == LB_CEF3_HANDLE_MEDIA_SOURCE);
  assert(ReadV4Text(make_view_call(
      UINT64_C(0xdebd7fc3bed95c9f), cast_media_source_v4))
      == L"cast:233637DE");
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xd41bb997080cc9ef), cast_media_source_v4)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xde3fe4c7c5789f5c), cast_media_source_v4)).integer_value == 0);
  LB_CEF3_HANDLE media_observer_v4 = 0;
  LB_CEF3_TASK_HANDLE media_sinks_task_v4 = 0;
  LB_CEF3_TASK_HANDLE media_routes_task_v4 = 0;
  LB_CEF3_HANDLE media_sinks_v4 = 0;
  LB_CEF3_HANDLE media_routes_v4 = 0;
  if (exercise_media_router_notifications) {
    media_observer_v4 = invoke_view_call(make_view_call(
        UINT64_C(0x97037ebed3e03e6f), global_media_router_v4)).handle_value;
    assert(media_observer_v4 != 0);
    assert(LB_CEF3_HandleGetType(media_observer_v4)
        == LB_CEF3_HANDLE_MEDIA_OBSERVER);
    media_sinks_task_v4 = invoke_view_call(make_view_call(
        UINT64_C(0x8159538e06843d76), media_observer_v4)).handle_value;
    media_routes_task_v4 = invoke_view_call(make_view_call(
        UINT64_C(0x5b690fac0f85d5be), media_observer_v4)).handle_value;
    assert(media_sinks_task_v4 != 0 && media_routes_task_v4 != 0);
    assert(invoke_view_call(make_view_call(
        UINT64_C(0x9d52248512f97c2e), global_media_router_v4)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
    assert(invoke_view_call(make_view_call(
        UINT64_C(0x4a79ce1d977682b9), global_media_router_v4)).value_kind
        == LB_CEF3_VALUE_V4_VOID);
    assert(WaitTask(media_sinks_task_v4, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(WaitTask(media_routes_task_v4, 30000) == LB_CEF3_TASK_SUCCEEDED);
    media_sinks_v4 = take_media_collection(
        media_sinks_task_v4, LB_CEF3_HANDLE_MEDIA_SINK_COLLECTION);
    media_routes_v4 = take_media_collection(
        media_routes_task_v4, LB_CEF3_HANDLE_MEDIA_ROUTE_COLLECTION);

    const auto route_state_task_v4 = invoke_view_call(make_view_call(
        UINT64_C(0xaa55aff50092d2b7), media_observer_v4)).handle_value;
    const auto route_message_task_v4 = invoke_view_call(make_view_call(
        UINT64_C(0x3e94aa7543bcc036), media_observer_v4)).handle_value;
    assert(route_state_task_v4 != 0 && route_message_task_v4 != 0);
    assert(LB_CEF3_TaskCancel(route_state_task_v4) == LB_CEF3_OK);
    assert(LB_CEF3_TaskCancel(route_message_task_v4) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(route_message_task_v4) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(route_state_task_v4) == LB_CEF3_OK);

    if (first_media_sink != 0) {
      assert(!ReadV4Text(make_view_call(
          UINT64_C(0x719c1a8eecf76d7e), first_media_sink)).empty());
      assert(!ReadV4Text(make_view_call(
          UINT64_C(0x28f0f20674f037bc), first_media_sink)).empty());
      const auto icon_result = invoke_view_call(make_view_call(
          UINT64_C(0x44c3e03aa383f247), first_media_sink));
      assert(icon_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
      assert(icon_result.integer_value >= 0 && icon_result.integer_value < 8);
      for (const auto operation_id : {
          UINT64_C(0xfc0b3ceb26e9d8e6),
          UINT64_C(0x2daae67560d9a050)}) {
        const auto result = invoke_view_call(make_view_call(
            operation_id, first_media_sink));
        assert(result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
      }
      LB_CEF3_ARGUMENT_V4 compatible_source_argument{};
      compatible_source_argument.struct_size =
          sizeof(compatible_source_argument);
      compatible_source_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
      compatible_source_argument.handle_value = cast_media_source_v4;
      const auto compatible_result = invoke_view_call(make_view_call(
          UINT64_C(0xeda2d294a508f563), first_media_sink,
          &compatible_source_argument, 1));
      assert(compatible_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);

      const auto device_task_v4 = invoke_view_call(make_view_call(
          UINT64_C(0x28a15c11066507b4), first_media_sink)).handle_value;
      assert(device_task_v4 != 0);
      assert(WaitTask(device_task_v4, 30000) == LB_CEF3_TASK_SUCCEEDED);
      const auto device_json_v4 = ReadV4Json(make_view_call(
          UINT64_C(0xc77d28d4ac082891), device_task_v4));
      assert(device_json_v4.find(L"\"ipAddress\"") != std::wstring::npos);
      assert(LB_CEF3_TaskRelease(device_task_v4) == LB_CEF3_OK);
    }
    if (first_media_route != 0) {
      assert(!ReadV4Text(make_view_call(
          UINT64_C(0x12bd8f92f457c561), first_media_route)).empty());
      for (const auto operation_id : {
          UINT64_C(0x79001fe80a30d36a),
          UINT64_C(0x965e7d29ea6528d4)}) {
        const auto result = invoke_view_call(make_view_call(
            operation_id, first_media_route));
        assert(result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
        assert(result.handle_value != 0);
        assert(LB_CEF3_HandleRelease(result.handle_value) == LB_CEF3_OK);
      }
    }
  }
  media_source_urn_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto invalid_media_source_call = make_view_call(
      UINT64_C(0xee82607699c4f2ad), global_media_router_v4,
      &media_source_urn_argument, 1);
  LB_CEF3_RESULT_V4 invalid_media_source_result{};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_media_source_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_media_source_call = make_view_call(
      UINT64_C(0x9d52248512f97c2e), global_media_router_v4,
      &media_source_urn_argument, 1);
  invalid_media_source_result = {};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_media_source_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  invalid_media_source_call = make_view_call(
      UINT64_C(0xd41bb997080cc9ef), cast_media_source_v4,
      &media_source_urn_argument, 1);
  invalid_media_source_result = {};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_media_source_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(ReadV4Json(make_view_call(
      UINT64_C(0xebe01bb239dd6470), completed_media_callback_task))
      .find(L"\"result\":1") != std::wstring::npos);
  assert(ReadV4Json(make_view_call(
      UINT64_C(0xc77d28d4ac082891), completed_media_callback_task))
      .find(L"\"hasRoute\":false") != std::wstring::npos);

  for (const auto operation_id : {
      UINT64_C(0xaa55aff50092d2b7), UINT64_C(0x3e94aa7543bcc036),
      UINT64_C(0xebe01bb239dd6470), UINT64_C(0xc77d28d4ac082891),
      UINT64_C(0x719c1a8eecf76d7e), UINT64_C(0x28f0f20674f037bc),
      UINT64_C(0x44c3e03aa383f247), UINT64_C(0x28a15c11066507b4),
      UINT64_C(0xfc0b3ceb26e9d8e6), UINT64_C(0x2daae67560d9a050),
      UINT64_C(0x12bd8f92f457c561), UINT64_C(0x79001fe80a30d36a),
      UINT64_C(0x965e7d29ea6528d4), UINT64_C(0xf859cd2762f3fb51)}) {
    auto invalid_call = make_view_call(
        operation_id, cast_media_source_v4, &media_source_urn_argument, 1);
    LB_CEF3_RESULT_V4 invalid_result{};
    invalid_result.struct_size = sizeof(invalid_result);
    assert(LB_CEF3_InvokeV4(&invalid_call, &invalid_result)
        == LB_CEF3_ERROR_INVALID_ARGUMENT);
  }
  std::array<LB_CEF3_ARGUMENT_V4, 2> invalid_route_create_arguments{};
  for (auto& argument : invalid_route_create_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
    argument.integer_value = 1;
  }
  auto invalid_route_create_call = make_view_call(
      UINT64_C(0x0e6041d779217ba0), global_media_router_v4,
      invalid_route_create_arguments.data(),
      invalid_route_create_arguments.size());
  invalid_media_source_result = {};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_route_create_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_compatibility_call = make_view_call(
      UINT64_C(0xeda2d294a508f563), cast_media_source_v4,
      &media_source_urn_argument, 1);
  invalid_media_source_result = {};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_compatibility_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_route_message_call = make_view_call(
      UINT64_C(0xd362425d568644fb), cast_media_source_v4,
      &media_source_urn_argument, 1);
  invalid_media_source_result = {};
  invalid_media_source_result.struct_size = sizeof(invalid_media_source_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_route_message_call, &invalid_media_source_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  if (exercise_media_router_notifications) {
    if (first_media_route != 0)
      assert(LB_CEF3_HandleRelease(first_media_route) == LB_CEF3_OK);
    if (first_media_sink != 0)
      assert(LB_CEF3_HandleRelease(first_media_sink) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_routes_v4) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_sinks_v4) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_routes) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_sinks) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(media_routes_task_v4) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(media_sinks_task_v4) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(media_routes_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(media_sinks_task) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_observer_v4) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(media_observer) == LB_CEF3_OK);
    LB_CEF3_TASK_HANDLE released_media_observer_task = 0;
    assert(LB_CEF3_MediaObserverNextRoutes(
        media_observer, &released_media_observer_task)
        == LB_CEF3_ERROR_RELEASED_HANDLE);
  }

  assert(LB_CEF3_TaskRelease(completed_media_callback_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(cast_media_source_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(dial_media_source) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(cast_media_source) == LB_CEF3_OK);
  assert(LB_CEF3_MediaSourceIsCast(cast_media_source)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(context_media_router_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(context_media_router) == LB_CEF3_OK);
  assert(LB_CEF3_MediaRouterNotifyCurrentSinks(context_media_router)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleGetType(context_media_router)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(global_media_router_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(global_media_router) == LB_CEF3_OK);
  if (exercise_media_router_notifications) {
    std::fprintf(stderr,
                 "CEF3 test checkpoint: media-router-notifications-complete\n");
    std::fflush(stderr);
    TerminateProcess(GetCurrentProcess(), 0);
    std::abort();
  }

  const uint16_t server_port = FindAvailableLoopbackPort();
  assert(LB_CEF3_ServerCreate(nullptr, server_port, 8, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_TASK_HANDLE invalid_server_task = 0;
  assert(LB_CEF3_ServerCreate(L"0.0.0.0", server_port, 8,
                              &invalid_server_task)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ServerCreate(L"127.0.0.1", 80, 8,
                              &invalid_server_task)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  std::array<LB_CEF3_ARGUMENT_V4, 3> server_create_arguments{};
  for (auto& argument : server_create_arguments)
    argument.struct_size = sizeof(argument);
  server_create_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  server_create_arguments[0].text_value = L"127.0.0.1";
  server_create_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  server_create_arguments[1].integer_value = server_port;
  server_create_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  server_create_arguments[2].integer_value = 8;
  const auto server_create_task = invoke_view_call(make_view_call(
      UINT64_C(0x70f0651e48784950), 0, server_create_arguments.data(),
      server_create_arguments.size())).handle_value;
  assert(server_create_task != 0);
  assert(WaitTask(server_create_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  const auto server = invoke_view_call(make_view_call(
      UINT64_C(0xe0d98a466cec5733), server_create_task)).handle_value;
  assert(server != 0);
  assert(LB_CEF3_HandleGetType(server) == LB_CEF3_HANDLE_SERVER);
  LB_CEF3_HANDLE duplicate_server = UINT64_MAX;
  assert(LB_CEF3_TaskTakeServerResult(
      server_create_task, &duplicate_server) == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_server == 0);
  int32_t missing_connection_id = 0;
  assert(LB_CEF3_TaskGetServerConnectionId(
      server_create_task, &missing_connection_id)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x98c9498ae30594bd), server)).integer_value == 1);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xaa73e3b5aea7d57d), server)).integer_value == 0);
  const auto server_address = ReadV4Text(make_view_call(
      UINT64_C(0x97a22ae7a42e02e3), server));
  assert(server_address == L"127.0.0.1:" + std::to_wstring(server_port));
  size_t server_address_required = 0;
  assert(LB_CEF3_ServerGetAddress(
      server, nullptr, 0, &server_address_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> server_address_buffer(server_address_required, L'\0');
  assert(LB_CEF3_ServerGetAddress(
      server, server_address_buffer.data(), server_address_buffer.size(),
      &server_address_required) == LB_CEF3_OK);
  assert(std::wstring(server_address_buffer.data()) == server_address);
  const auto server_runner = invoke_view_call(make_view_call(
      UINT64_C(0x2cbc8ef5b64ab126), server)).handle_value;
  assert(server_runner != 0);
  assert(LB_CEF3_HandleGetType(server_runner)
      == LB_CEF3_HANDLE_TASK_RUNNER);
  assert(LB_CEF3_HandleRelease(server_runner) == LB_CEF3_OK);
  LB_CEF3_HANDLE invalid_server_runner = 0;
  assert(LB_CEF3_ServerGetTaskRunner(context_a, &invalid_server_runner)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ServerIsValidConnection(server, -1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  auto run_server_exchange = [&](
      const std::string& path,
      const std::function<void(int32_t)>& respond,
      bool inspect_request) {
    const auto connected_task = invoke_view_call(make_view_call(
        UINT64_C(0x50517dc78b9cd7d2), server)).handle_value;
    const auto request_task = invoke_view_call(make_view_call(
        UINT64_C(0xd18dec73ebba261f), server)).handle_value;
    const auto disconnected_task = invoke_view_call(make_view_call(
        UINT64_C(0x36ade245b38e848e), server)).handle_value;
    assert(connected_task != 0 && request_task != 0
        && disconnected_task != 0);
    std::string response;
    std::thread client([&]() {
      response = SendLoopbackHttpRequest(server_port, path);
    });
    assert(WaitTask(connected_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(WaitTask(request_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(TaskResult(connected_task).find(L"\"kind\":\"clientConnected\"")
        != std::wstring::npos);
    assert(TaskResult(request_task).find(L"\"kind\":\"httpRequest\"")
        != std::wstring::npos);
    int32_t connected_id = -1;
    int32_t request_id = -1;
    assert(LB_CEF3_TaskGetServerConnectionId(
        connected_task, &connected_id) == LB_CEF3_OK);
    assert(LB_CEF3_TaskGetServerConnectionId(
        request_task, &request_id) == LB_CEF3_OK);
    assert(connected_id >= 0 && connected_id == request_id);
    size_t client_address_required = 0;
    assert(LB_CEF3_TaskGetServerClientAddress(
        request_task, nullptr, 0, &client_address_required)
        == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
    std::vector<wchar_t> client_address(client_address_required, L'\0');
    assert(LB_CEF3_TaskGetServerClientAddress(
        request_task, client_address.data(), client_address.size(),
        &client_address_required) == LB_CEF3_OK);
    assert(std::wstring(client_address.data()).find(L"127.0.0.1:") == 0);
    assert(LB_CEF3_ServerHasConnection(server) == 1);
    LB_CEF3_ARGUMENT_V4 connection_argument{};
    connection_argument.struct_size = sizeof(connection_argument);
    connection_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
    connection_argument.integer_value = request_id;
    assert(invoke_view_call(make_view_call(
        UINT64_C(0xd561f173ca9b4043), server,
        &connection_argument, 1)).integer_value == 1);
    if (inspect_request) {
      LB_CEF3_HANDLE request = 0;
      assert(LB_CEF3_TaskTakeServerRequestResult(
          request_task, &request) == LB_CEF3_OK);
      assert(request != 0);
      assert(LB_CEF3_HandleGetType(request) == LB_CEF3_HANDLE_REQUEST);
      size_t text_required = 0;
      assert(LB_CEF3_RequestGetMethod(
          request, nullptr, 0, &text_required)
          == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
      std::vector<wchar_t> text(text_required, L'\0');
      assert(LB_CEF3_RequestGetMethod(
          request, text.data(), text.size(), &text_required) == LB_CEF3_OK);
      assert(std::wstring(text.data()) == L"GET");
      assert(LB_CEF3_RequestGetUrl(
          request, nullptr, 0, &text_required)
          == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
      text.assign(text_required, L'\0');
      assert(LB_CEF3_RequestGetUrl(
          request, text.data(), text.size(), &text_required) == LB_CEF3_OK);
      assert(std::wstring(text.data()).find(
          std::wstring(L"http://127.0.0.1:")
              + std::to_wstring(server_port)) == 0);
      LB_CEF3_HANDLE duplicate_request = UINT64_MAX;
      assert(LB_CEF3_TaskTakeServerRequestResult(
          request_task, &duplicate_request) == LB_CEF3_ERROR_NOT_FOUND);
      assert(duplicate_request == 0);
      assert(LB_CEF3_HandleRelease(request) == LB_CEF3_OK);
    }
    respond(request_id);
    client.join();
    assert(WaitTask(disconnected_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    int32_t disconnected_id = -1;
    assert(LB_CEF3_TaskGetServerConnectionId(
        disconnected_task, &disconnected_id) == LB_CEF3_OK);
    assert(disconnected_id == request_id);
    assert(LB_CEF3_TaskRelease(disconnected_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(request_task) == LB_CEF3_OK);
    assert(LB_CEF3_TaskRelease(connected_task) == LB_CEF3_OK);
    return response;
  };

  const auto response_200 = run_server_exchange(
      "/managed-200",
      [&](int32_t connection_id) {
        static constexpr char body[] = "LingBuilder CEF Server";
        const auto buffer = LB_CEF3_BufferCreate(body, sizeof(body) - 1);
        assert(buffer != 0);
        std::array<LB_CEF3_ARGUMENT_V4, 3> arguments{};
        for (auto& argument : arguments)
          argument.struct_size = sizeof(argument);
        arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        arguments[0].integer_value = connection_id;
        arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
        arguments[1].text_value = L"text/plain; charset=utf-8";
        arguments[2].value_kind = LB_CEF3_VALUE_V4_BUFFER;
        arguments[2].buffer_value = buffer;
        assert(invoke_view_call(make_view_call(
            UINT64_C(0xa1ce08d5ede5ff7d), server,
            arguments.data(), arguments.size())).value_kind
            == LB_CEF3_VALUE_V4_VOID);
        assert(LB_CEF3_BufferRelease(buffer) == LB_CEF3_OK);
      },
      true);
  assert(response_200.find("HTTP/1.1 200 OK") != std::string::npos);
  assert(response_200.find("LingBuilder CEF Server") != std::string::npos);

  const auto response_custom = run_server_exchange(
      "/managed-custom",
      [&](int32_t connection_id) {
        static constexpr char body[] = "custom-body";
        const auto headers = LB_CEF3_DictionaryCreate();
        const auto header_value = LB_CEF3_ValueCreate();
        assert(headers != 0 && header_value != 0);
        assert(LB_CEF3_ValueSetString(header_value, L"safe") == LB_CEF3_OK);
        assert(LB_CEF3_DictionarySetValue(
            headers, L"X-LingBuilder", header_value) == LB_CEF3_OK);
        std::array<LB_CEF3_ARGUMENT_V4, 5> response_arguments{};
        for (auto& argument : response_arguments)
          argument.struct_size = sizeof(argument);
        response_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        response_arguments[0].integer_value = connection_id;
        response_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        response_arguments[1].integer_value = 201;
        response_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
        response_arguments[2].text_value = L"text/plain";
        response_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        response_arguments[3].integer_value = sizeof(body) - 1;
        response_arguments[4].value_kind = LB_CEF3_VALUE_V4_HANDLE;
        response_arguments[4].handle_value = headers;
        assert(invoke_view_call(make_view_call(
            UINT64_C(0x04aa830b4f927c9c), server,
            response_arguments.data(), response_arguments.size())).value_kind
            == LB_CEF3_VALUE_V4_VOID);
        const auto body_buffer = LB_CEF3_BufferCreate(body, sizeof(body) - 1);
        assert(body_buffer != 0);
        std::array<LB_CEF3_ARGUMENT_V4, 2> raw_arguments{};
        for (auto& argument : raw_arguments)
          argument.struct_size = sizeof(argument);
        raw_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        raw_arguments[0].integer_value = connection_id;
        raw_arguments[1].value_kind = LB_CEF3_VALUE_V4_BUFFER;
        raw_arguments[1].buffer_value = body_buffer;
        assert(invoke_view_call(make_view_call(
            UINT64_C(0xd5b289d43c1b2f4c), server,
            raw_arguments.data(), raw_arguments.size())).value_kind
            == LB_CEF3_VALUE_V4_VOID);
        assert(invoke_view_call(make_view_call(
            UINT64_C(0x9487e7e2cd844d2c), server,
            raw_arguments.data(), 1)).value_kind == LB_CEF3_VALUE_V4_VOID);
        assert(LB_CEF3_BufferRelease(body_buffer) == LB_CEF3_OK);
        assert(LB_CEF3_ValueRelease(header_value) == LB_CEF3_OK);
        assert(LB_CEF3_DictionaryRelease(headers) == LB_CEF3_OK);
      },
      false);
  assert(response_custom.find("HTTP/1.1 201 Created") != std::string::npos);
  auto normalized_custom_response = response_custom;
  std::transform(
      normalized_custom_response.begin(), normalized_custom_response.end(),
      normalized_custom_response.begin(),
      [](unsigned char value) { return static_cast<char>(std::tolower(value)); });
  assert(normalized_custom_response.find("x-lingbuilder:safe")
      != std::string::npos);
  assert(response_custom.find("custom-body") != std::string::npos);

  const auto response_404 = run_server_exchange(
      "/missing",
      [&](int32_t connection_id) {
        LB_CEF3_ARGUMENT_V4 argument{};
        argument.struct_size = sizeof(argument);
        argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
        argument.integer_value = connection_id;
        assert(invoke_view_call(make_view_call(
            UINT64_C(0x53181fe216be1d89), server, &argument, 1)).value_kind
            == LB_CEF3_VALUE_V4_VOID);
      },
      false);
  assert(response_404.find("HTTP/1.1 404 Not Found") != std::string::npos);

  const auto response_500 = run_server_exchange(
      "/failure",
      [&](int32_t connection_id) {
        std::array<LB_CEF3_ARGUMENT_V4, 2> arguments{};
        for (auto& argument : arguments)
          argument.struct_size = sizeof(argument);
        arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
        arguments[0].integer_value = connection_id;
        arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
        arguments[1].text_value = L"managed failure";
        assert(invoke_view_call(make_view_call(
            UINT64_C(0x6040cf77544cfab7), server,
            arguments.data(), arguments.size())).value_kind
            == LB_CEF3_VALUE_V4_VOID);
      },
      false);
  assert(response_500.find("HTTP/1.1 500 Internal Server Error")
      != std::string::npos);
  assert(LB_CEF3_ServerHasConnection(server) == 0);

  const auto websocket_client_connected_task = invoke_view_call(make_view_call(
      UINT64_C(0x50517dc78b9cd7d2), server)).handle_value;
  const auto websocket_request_task = invoke_view_call(make_view_call(
      UINT64_C(0xdc55b39bd5e58581), server)).handle_value;
  const auto websocket_connected_task = invoke_view_call(make_view_call(
      UINT64_C(0xa980426c1b5d73a2), server)).handle_value;
  const auto websocket_message_task = invoke_view_call(make_view_call(
      UINT64_C(0xde9db606bcbf5b67), server)).handle_value;
  const auto websocket_disconnected_task = invoke_view_call(make_view_call(
      UINT64_C(0x36ade245b38e848e), server)).handle_value;
  assert(websocket_client_connected_task != 0 && websocket_request_task != 0
      && websocket_connected_task != 0 && websocket_message_task != 0
      && websocket_disconnected_task != 0);
  std::string websocket_headers;
  std::string websocket_reply;
  std::thread websocket_client([&]() {
    const SOCKET socket_handle = ConnectLoopbackSocket(server_port);
    const std::string request =
        "GET /managed-websocket HTTP/1.1\r\n"
        "Host: 127.0.0.1\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: SGluZ0J1aWxkZXJDZWYzIQ==\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n";
    SendSocketBytes(socket_handle, request.data(), request.size());
    websocket_headers = ReceiveHttpHeaders(socket_handle);
    SendMaskedWebSocketText(socket_handle, "ping");
    websocket_reply = ReceiveWebSocketPayload(socket_handle);
    closesocket(socket_handle);
  });
  assert(WaitTask(websocket_client_connected_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(websocket_request_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  int32_t websocket_connection_id = -1;
  assert(LB_CEF3_TaskGetServerConnectionId(
      websocket_request_task, &websocket_connection_id) == LB_CEF3_OK);
  assert(websocket_connection_id >= 0);
  LB_CEF3_HANDLE websocket_request = 0;
  assert(LB_CEF3_TaskTakeServerRequestResult(
      websocket_request_task, &websocket_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(websocket_request) == LB_CEF3_HANDLE_REQUEST);
  LB_CEF3_CONTINUATION_HANDLE websocket_continuation = 0;
  assert(LB_CEF3_TaskTakeServerContinuationResult(
      websocket_request_task, &websocket_continuation) == LB_CEF3_OK);
  assert(websocket_continuation != 0);
  LB_CEF3_CONTINUATION_HANDLE duplicate_websocket_continuation = UINT64_MAX;
  assert(LB_CEF3_TaskTakeServerContinuationResult(
      websocket_request_task, &duplicate_websocket_continuation)
      == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_websocket_continuation == 0);
  assert(LB_CEF3_ContinuationCompleteV4(
      websocket_continuation, 1, L"{}") == LB_CEF3_OK);
  assert(LB_CEF3_ContinuationReleaseV4(websocket_continuation) == LB_CEF3_OK);
  assert(WaitTask(websocket_connected_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(websocket_message_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  int32_t websocket_message_connection_id = -1;
  assert(LB_CEF3_TaskGetServerConnectionId(
      websocket_message_task, &websocket_message_connection_id)
      == LB_CEF3_OK);
  assert(websocket_message_connection_id == websocket_connection_id);
  LB_CEF3_BUFFER_HANDLE websocket_message = 0;
  assert(LB_CEF3_TaskTakeServerBufferResult(
      websocket_message_task, &websocket_message) == LB_CEF3_OK);
  assert(websocket_message != 0);
  size_t websocket_message_size = 0;
  assert(LB_CEF3_BufferCopy(
      websocket_message, nullptr, 0, &websocket_message_size)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<char> websocket_message_bytes(websocket_message_size);
  assert(LB_CEF3_BufferCopy(
      websocket_message, websocket_message_bytes.data(),
      websocket_message_bytes.size(), &websocket_message_size) == LB_CEF3_OK);
  assert(std::string(
      websocket_message_bytes.begin(), websocket_message_bytes.end())
      == "ping");
  LB_CEF3_BUFFER_HANDLE duplicate_websocket_message = UINT64_MAX;
  assert(LB_CEF3_TaskTakeServerBufferResult(
      websocket_message_task, &duplicate_websocket_message)
      == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_websocket_message == 0);
  static constexpr char websocket_response[] = "pong";
  const auto websocket_response_buffer = LB_CEF3_BufferCreate(
      websocket_response, sizeof(websocket_response) - 1);
  assert(websocket_response_buffer != 0);
  std::array<LB_CEF3_ARGUMENT_V4, 2> websocket_send_arguments{};
  for (auto& argument : websocket_send_arguments)
    argument.struct_size = sizeof(argument);
  websocket_send_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  websocket_send_arguments[0].integer_value = websocket_connection_id;
  websocket_send_arguments[1].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  websocket_send_arguments[1].buffer_value = websocket_response_buffer;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x3172d00d50aba7fe), server,
      websocket_send_arguments.data(), websocket_send_arguments.size()))
      .value_kind == LB_CEF3_VALUE_V4_VOID);
  websocket_client.join();
  std::transform(
      websocket_headers.begin(), websocket_headers.end(),
      websocket_headers.begin(),
      [](unsigned char value) { return static_cast<char>(std::tolower(value)); });
  assert(websocket_headers.find("http/1.1 101") != std::string::npos);
  assert(websocket_headers.find("sec-websocket-accept:")
      != std::string::npos);
  assert(websocket_reply == "pong");
  assert(WaitTask(websocket_disconnected_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_BufferRelease(websocket_response_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(websocket_message) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(websocket_request) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(websocket_disconnected_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(websocket_message_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(websocket_connected_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(websocket_request_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(websocket_client_connected_task) == LB_CEF3_OK);

  const auto wait_url_request_callback = [&](uint64_t operation_id,
                                             LB_CEF3_HANDLE client) {
    const auto task = invoke_view_call(make_view_call(
        operation_id, client)).handle_value;
    assert(task != 0);
    assert(LB_CEF3_HandleGetType(task) == LB_CEF3_HANDLE_TASK);
    return task;
  };
  const auto wait_server_http_request = [&]() {
    LB_CEF3_TASK_HANDLE task = 0;
    assert(LB_CEF3_ServerNextHttpRequest(server, &task) == LB_CEF3_OK);
    assert(task != 0);
    return task;
  };
  const auto take_server_connection = [&](LB_CEF3_TASK_HANDLE task) {
    assert(WaitTask(task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    int32_t connection_id = -1;
    assert(LB_CEF3_TaskGetServerConnectionId(task, &connection_id)
        == LB_CEF3_OK);
    assert(connection_id >= 0);
    return connection_id;
  };

  const auto url_client = LB_CEF3_UrlRequestClientCreate();
  assert(url_client != 0);
  assert(LB_CEF3_HandleGetType(url_client)
      == LB_CEF3_HANDLE_URL_REQUEST_CLIENT);
  LB_CEF3_TASK_HANDLE invalid_url_task = 0;
  assert(LB_CEF3_UrlRequestClientNextDownloadData(
      context_a, &invalid_url_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_UrlRequestClientNextRequestComplete(
      url_client, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE invalid_url_request = UINT64_MAX;
  assert(LB_CEF3_UrlRequestCreate(
      context_a, url_client, context_a, &invalid_url_request)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(invalid_url_request == 0);

  const auto complete_task = wait_url_request_callback(
      UINT64_C(0x7ae2bba01af47a29), url_client);
  const auto download_progress_task = wait_url_request_callback(
      UINT64_C(0x1de41864fe583f44), url_client);
  const auto download_data_task = wait_url_request_callback(
      UINT64_C(0x5af3ddef0b97b083), url_client);
  const auto url_server_request_task = wait_server_http_request();
  const auto url_request_input = LB_CEF3_RequestCreate();
  assert(url_request_input != 0);
  const std::wstring url_request_address = L"http://127.0.0.1:"
      + std::to_wstring(server_port) + L"/managed-urlrequest";
  assert(LB_CEF3_RequestSetUrl(
      url_request_input, url_request_address.c_str()) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetMethod(url_request_input, L"GET") == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 3> url_create_arguments{};
  for (auto& argument : url_create_arguments)
    argument.struct_size = sizeof(argument);
  url_create_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  url_create_arguments[0].handle_value = url_request_input;
  url_create_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  url_create_arguments[1].handle_value = url_client;
  url_create_arguments[2].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  url_create_arguments[2].handle_value = context_a;
  const auto url_request = invoke_view_call(make_view_call(
      UINT64_C(0x7d9b478859cfe56d), 0,
      url_create_arguments.data(), url_create_arguments.size())).handle_value;
  assert(url_request != 0);
  assert(LB_CEF3_HandleGetType(url_request) == LB_CEF3_HANDLE_URL_REQUEST);
  assert(LB_CEF3_RequestIsReadOnly(url_request_input) == 1);
  LB_CEF3_HANDLE direct_url_request_request = 0;
  LB_CEF3_HANDLE direct_url_request_client = 0;
  assert(LB_CEF3_UrlRequestGetRequest(
      url_request, &direct_url_request_request) == LB_CEF3_OK);
  assert(LB_CEF3_UrlRequestGetClient(
      url_request, &direct_url_request_client) == LB_CEF3_OK);
  assert(direct_url_request_request != 0);
  assert(direct_url_request_client != 0);
  assert(LB_CEF3_HandleRelease(direct_url_request_client) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(direct_url_request_request) == LB_CEF3_OK);
  const auto managed_url_request_request = invoke_view_call(make_view_call(
      UINT64_C(0x5e4f41cdd9bb8e85), url_request)).handle_value;
  const auto managed_url_request_client = invoke_view_call(make_view_call(
      UINT64_C(0x1833c5901c6a8b6f), url_request)).handle_value;
  assert(managed_url_request_request != 0);
  assert(managed_url_request_client != 0);
  assert(LB_CEF3_HandleGetType(managed_url_request_request)
      == LB_CEF3_HANDLE_REQUEST);
  assert(LB_CEF3_HandleGetType(managed_url_request_client)
      == LB_CEF3_HANDLE_URL_REQUEST_CLIENT);
  const auto url_connection_id = take_server_connection(url_server_request_task);
  static constexpr char url_body[] = "LingBuilder managed URLRequest";
  const auto url_body_buffer = LB_CEF3_BufferCreate(
      url_body, sizeof(url_body) - 1);
  assert(url_body_buffer != 0);
  assert(LB_CEF3_ServerSendHttp200Response(
      server, url_connection_id, L"text/plain; charset=utf-8",
      url_body_buffer) == LB_CEF3_OK);
  assert(WaitTask(download_progress_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(download_data_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(complete_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(download_progress_task).find(L"\"current\":")
      != std::wstring::npos);
  assert(TaskResult(download_data_task).find(
      L"\"size\":" + std::to_wstring(sizeof(url_body) - 1))
      != std::wstring::npos);
  assert(TaskResult(complete_task).find(L"\"status\":1")
      != std::wstring::npos);
  LB_CEF3_BUFFER_HANDLE downloaded_buffer = 0;
  assert(LB_CEF3_TaskTakeUrlRequestBufferResult(
      download_data_task, &downloaded_buffer) == LB_CEF3_OK);
  assert(downloaded_buffer != 0);
  size_t downloaded_size = 0;
  assert(LB_CEF3_BufferCopy(
      downloaded_buffer, nullptr, 0, &downloaded_size)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<char> downloaded(downloaded_size);
  assert(LB_CEF3_BufferCopy(
      downloaded_buffer, downloaded.data(), downloaded.size(),
      &downloaded_size) == LB_CEF3_OK);
  assert(std::string(downloaded.begin(), downloaded.end()) == url_body);
  LB_CEF3_BUFFER_HANDLE duplicate_download = UINT64_MAX;
  assert(LB_CEF3_TaskTakeUrlRequestBufferResult(
      download_data_task, &duplicate_download) == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_download == 0);

  const auto status_result = invoke_view_call(make_view_call(
      UINT64_C(0x489792ecc5f9f193), url_request));
  const auto error_result = invoke_view_call(make_view_call(
      UINT64_C(0x2571855577e52dc1), url_request));
  assert(status_result.value_kind == LB_CEF3_VALUE_V4_INTEGER
      && status_result.integer_value == 1);
  assert(error_result.value_kind == LB_CEF3_VALUE_V4_INTEGER
      && error_result.integer_value == 0);
  const auto url_response = invoke_view_call(make_view_call(
      UINT64_C(0xae11acf58cf84ef6), url_request)).handle_value;
  assert(url_response != 0);
  assert(LB_CEF3_HandleGetType(url_response) == LB_CEF3_HANDLE_RESPONSE);
  assert(LB_CEF3_ResponseIsReadOnly(url_response) == 1);
  assert(LB_CEF3_ResponseGetStatus(url_response) == 200);
  const auto cached_result = invoke_view_call(make_view_call(
      UINT64_C(0xe6c9a412a0b2dd33), url_request));
  assert(cached_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN
      && cached_result.integer_value == 0);

  const auto upload_client = LB_CEF3_UrlRequestClientCreate();
  const auto upload_complete_task = wait_url_request_callback(
      UINT64_C(0x7ae2bba01af47a29), upload_client);
  const auto upload_progress_task = wait_url_request_callback(
      UINT64_C(0x5be3c57f6435abb4), upload_client);
  const auto upload_server_request_task = wait_server_http_request();
  const auto upload_request_input = LB_CEF3_RequestCreate();
  const auto upload_post_data = LB_CEF3_PostDataCreate();
  const auto upload_element = LB_CEF3_PostDataElementCreate();
  std::vector<unsigned char> upload_bytes(256 * 1024, 0x4c);
  const auto upload_buffer = LB_CEF3_BufferCreate(
      upload_bytes.data(), upload_bytes.size());
  assert(upload_client != 0 && upload_request_input != 0
      && upload_post_data != 0 && upload_element != 0 && upload_buffer != 0);
  const std::wstring upload_address = L"http://127.0.0.1:"
      + std::to_wstring(server_port) + L"/managed-urlrequest-upload";
  assert(LB_CEF3_RequestSetUrl(
      upload_request_input, upload_address.c_str()) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetMethod(upload_request_input, L"POST") == LB_CEF3_OK);
  assert(LB_CEF3_PostDataElementSetToBytes(
      upload_element, upload_buffer, 0, upload_bytes.size()) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataAddElement(
      upload_post_data, upload_element) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetPostData(
      upload_request_input, upload_post_data) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetFlags(upload_request_input, 1 << 4) == LB_CEF3_OK);
  std::array<LB_CEF3_ARGUMENT_V4, 2> frame_url_arguments{};
  for (auto& argument : frame_url_arguments)
    argument.struct_size = sizeof(argument);
  frame_url_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  frame_url_arguments[0].handle_value = upload_request_input;
  frame_url_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  frame_url_arguments[1].handle_value = upload_client;
  const auto frame_url_request = invoke_view_call(make_view_call(
      UINT64_C(0x804efd8aa0473c11), frame_handle_for_close,
      frame_url_arguments.data(), frame_url_arguments.size())).handle_value;
  assert(frame_url_request != 0);
  const auto upload_connection_id =
      take_server_connection(upload_server_request_task);
  static constexpr char upload_reply[] = "upload-ok";
  const auto upload_reply_buffer = LB_CEF3_BufferCreate(
      upload_reply, sizeof(upload_reply) - 1);
  assert(upload_reply_buffer != 0);
  assert(LB_CEF3_ServerSendHttp200Response(
      server, upload_connection_id, L"text/plain", upload_reply_buffer)
      == LB_CEF3_OK);
  assert(WaitTask(upload_progress_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(upload_complete_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(upload_progress_task).find(L"\"total\":262144")
      != std::wstring::npos);

  const auto auth_client = LB_CEF3_UrlRequestClientCreate();
  const auto auth_complete_task = wait_url_request_callback(
      UINT64_C(0x7ae2bba01af47a29), auth_client);
  const auto auth_credentials_task = wait_url_request_callback(
      UINT64_C(0x9e4e8136734f2a0d), auth_client);
  const auto first_auth_server_task = wait_server_http_request();
  const auto auth_request_input = LB_CEF3_RequestCreate();
  const std::wstring auth_address = L"http://127.0.0.1:"
      + std::to_wstring(server_port) + L"/managed-urlrequest-auth";
  assert(LB_CEF3_RequestSetUrl(
      auth_request_input, auth_address.c_str()) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetMethod(auth_request_input, L"GET") == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetFlags(auth_request_input, 1 << 3) == LB_CEF3_OK);
  LB_CEF3_HANDLE auth_url_request = 0;
  assert(LB_CEF3_UrlRequestCreate(
      auth_request_input, auth_client, context_a, &auth_url_request)
      == LB_CEF3_OK);
  assert(auth_url_request != 0);
  const auto first_auth_connection = take_server_connection(
      first_auth_server_task);
  const auto auth_headers = LB_CEF3_DictionaryCreate();
  const auto auth_header_value = LB_CEF3_ValueCreate();
  assert(auth_headers != 0 && auth_header_value != 0);
  assert(LB_CEF3_ValueSetString(
      auth_header_value, L"Basic realm=\"LingBuilder\"") == LB_CEF3_OK);
  assert(LB_CEF3_DictionarySetValue(
      auth_headers, L"WWW-Authenticate", auth_header_value) == LB_CEF3_OK);
  assert(LB_CEF3_ServerSendHttpResponse(
      server, first_auth_connection, 401, L"text/plain", 0,
      auth_headers) == LB_CEF3_OK);
  assert(WaitTask(auth_credentials_task, 30000)
      == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(auth_credentials_task).find(
      L"\"realm\":\"LingBuilder\"") != std::wstring::npos);
  LB_CEF3_CONTINUATION_HANDLE auth_continuation = 0;
  assert(LB_CEF3_TaskTakeUrlRequestAuthContinuationResult(
      auth_credentials_task, &auth_continuation) == LB_CEF3_OK);
  assert(auth_continuation != 0);
  LB_CEF3_CONTINUATION_HANDLE duplicate_auth_continuation = UINT64_MAX;
  assert(LB_CEF3_TaskTakeUrlRequestAuthContinuationResult(
      auth_credentials_task, &duplicate_auth_continuation)
      == LB_CEF3_ERROR_NOT_FOUND);
  assert(duplicate_auth_continuation == 0);
  const auto second_auth_server_task = wait_server_http_request();
  assert(LB_CEF3_ContinuationCompleteV4(
      auth_continuation, 1,
      L"{\"username\":\"lingbuilder\",\"password\":\"cef150\"}")
      == LB_CEF3_OK);
  const auto second_auth_connection = take_server_connection(
      second_auth_server_task);
  LB_CEF3_HANDLE retried_auth_request = 0;
  assert(LB_CEF3_TaskTakeServerRequestResult(
      second_auth_server_task, &retried_auth_request) == LB_CEF3_OK);
  assert(retried_auth_request != 0);
  const auto authorization = ReadManagedText(
      retried_auth_request,
      [](LB_CEF3_HANDLE request, wchar_t* text,
         size_t capacity, size_t* required) {
        return LB_CEF3_RequestGetHeaderByName(
            request, L"Authorization", text, capacity, required);
      });
  assert(authorization.find(L"Basic ") == 0);
  static constexpr char auth_reply[] = "auth-ok";
  const auto auth_reply_buffer = LB_CEF3_BufferCreate(
      auth_reply, sizeof(auth_reply) - 1);
  assert(auth_reply_buffer != 0);
  assert(LB_CEF3_ServerSendHttp200Response(
      server, second_auth_connection, L"text/plain", auth_reply_buffer)
      == LB_CEF3_OK);
  assert(WaitTask(auth_complete_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(auth_complete_task).find(L"\"status\":1")
      != std::wstring::npos);

  const auto cancel_client = LB_CEF3_UrlRequestClientCreate();
  const auto cancel_complete_task = wait_url_request_callback(
      UINT64_C(0x7ae2bba01af47a29), cancel_client);
  const auto cancel_request_input = LB_CEF3_RequestCreate();
  assert(cancel_client != 0 && cancel_request_input != 0);
  assert(LB_CEF3_RequestSetUrl(
      cancel_request_input, L"http://127.0.0.1:1/cancel") == LB_CEF3_OK);
  LB_CEF3_HANDLE cancel_url_request = 0;
  assert(LB_CEF3_UrlRequestCreate(
      cancel_request_input, cancel_client, context_a, &cancel_url_request)
      == LB_CEF3_OK);
  const auto cancel_result = invoke_view_call(make_view_call(
      UINT64_C(0x9143adcfc799bc09), cancel_url_request));
  assert(cancel_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(WaitTask(cancel_complete_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  const auto cancelled_error = invoke_view_call(make_view_call(
      UINT64_C(0x2571855577e52dc1), cancel_url_request));
  assert(cancelled_error.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(cancelled_error.integer_value < 0);

  assert(LB_CEF3_BufferRelease(auth_reply_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(retried_auth_request) == LB_CEF3_OK);
  assert(LB_CEF3_ContinuationReleaseV4(auth_continuation) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(auth_header_value) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(auth_headers) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(cancel_url_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(cancel_request_input) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(cancel_client) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(cancel_complete_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(auth_url_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(auth_request_input) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(auth_client) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(second_auth_server_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(first_auth_server_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(auth_credentials_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(auth_complete_task) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(upload_reply_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(upload_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(upload_element) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(upload_post_data) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(frame_url_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(upload_request_input) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(upload_client) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(upload_server_request_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(upload_progress_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(upload_complete_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(url_response) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(managed_url_request_client) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(managed_url_request_request) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(downloaded_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(url_body_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(url_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(url_request_input) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(url_client) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(url_server_request_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(download_data_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(download_progress_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(complete_task) == LB_CEF3_OK);

  const std::wstring cookie_filter_url = L"http://127.0.0.1:"
      + std::to_wstring(server_port) + L"/cookie-filter";
  const auto seed_cookie_task = LB_CEF3_CookieSet(
      context_b, cookie_filter_url.c_str(), L"bridge_send", L"alpha",
      L"", L"/", 0, 0, 0);
  assert(seed_cookie_task != 0);
  assert(WaitTask(seed_cookie_task, 30000) == LB_CEF3_TASK_SUCCEEDED);

  static constexpr char response_filter_find_text[] = "bridge-original";
  static constexpr char response_filter_replacement_text[] = "bridge-filtered";
  const auto response_filter_find = LB_CEF3_BufferCreate(
      response_filter_find_text, sizeof(response_filter_find_text) - 1);
  const auto response_filter_replacement = LB_CEF3_BufferCreate(
      response_filter_replacement_text,
      sizeof(response_filter_replacement_text) - 1);
  const auto response_filter_empty = LB_CEF3_BufferCreate(nullptr, 0);
  assert(response_filter_find != 0 && response_filter_replacement != 0
      && response_filter_empty != 0);
  assert(LB_CEF3_ResponseFilterCreate(nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE direct_response_filter = 0;
  assert(LB_CEF3_ResponseFilterCreate(&direct_response_filter) == LB_CEF3_OK);
  assert(direct_response_filter != 0);
  assert(LB_CEF3_HandleGetType(direct_response_filter)
      == LB_CEF3_HANDLE_RESPONSE_FILTER);
  assert(LB_CEF3_ResourceRequestHandlerSetResponseFilter(
      browser_b, direct_response_filter) == LB_CEF3_ERROR_OPERATION_FAILED);
  assert(LB_CEF3_ResponseFilterSetReplacement(
      direct_response_filter, response_filter_empty,
      response_filter_replacement) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResponseFilterSetReplacement(
      browser_b, response_filter_find,
      response_filter_replacement) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ResponseFilterSetReplacement(
      direct_response_filter, response_filter_find,
      response_filter_replacement) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSetResponseFilter(
      browser_b, context_b) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ResourceRequestHandlerSetResponseFilter(
      browser_b, direct_response_filter) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSetResponseFilter(
      browser_b, 0) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(direct_response_filter) == LB_CEF3_OK);
  assert(LB_CEF3_ResponseFilterSetReplacement(
      direct_response_filter, response_filter_find,
      response_filter_replacement) == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto response_filter_create_result = invoke_view_call(make_view_call(
      UINT64_C(0xa86bbf85dc8790a8), 0));
  assert(response_filter_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto response_filter = response_filter_create_result.handle_value;
  assert(response_filter != 0);
  assert(LB_CEF3_HandleGetType(response_filter)
      == LB_CEF3_HANDLE_RESPONSE_FILTER);
  std::array<LB_CEF3_ARGUMENT_V4, 2> response_filter_arguments{};
  for (auto& argument : response_filter_arguments) {
    argument.struct_size = sizeof(argument);
    argument.value_kind = LB_CEF3_VALUE_V4_BUFFER;
  }
  response_filter_arguments[0].buffer_value = response_filter_find;
  response_filter_arguments[1].buffer_value = response_filter_replacement;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x06c0c2087bd6dd8a), response_filter,
      response_filter_arguments.data(), response_filter_arguments.size()))
      .value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 response_filter_attach_argument{};
  response_filter_attach_argument.struct_size =
      sizeof(response_filter_attach_argument);
  response_filter_attach_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  response_filter_attach_argument.handle_value = response_filter;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x324e71e8a4dfdbc9), browser_b,
      &response_filter_attach_argument, 1)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  auto invalid_response_filter_create = make_view_call(
      UINT64_C(0xa86bbf85dc8790a8), browser_b);
  LB_CEF3_RESULT_V4 invalid_response_filter_result{};
  invalid_response_filter_result.struct_size =
      sizeof(invalid_response_filter_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_response_filter_create, &invalid_response_filter_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  auto invalid_response_filter_attach = make_view_call(
      UINT64_C(0x324e71e8a4dfdbc9), browser_b);
  invalid_response_filter_result = {};
  invalid_response_filter_result.struct_size =
      sizeof(invalid_response_filter_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_response_filter_attach, &invalid_response_filter_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  LB_CEF3_TASK_HANDLE cookie_connected_task = 0;
  LB_CEF3_TASK_HANDLE cookie_request_task = 0;
  LB_CEF3_TASK_HANDLE cookie_disconnected_task = 0;
  assert(LB_CEF3_ServerNextClientConnected(
      server, &cookie_connected_task) == LB_CEF3_OK);
  assert(LB_CEF3_ServerNextHttpRequest(
      server, &cookie_request_task) == LB_CEF3_OK);
  assert(LB_CEF3_ServerNextClientDisconnected(
      server, &cookie_disconnected_task) == LB_CEF3_OK);
  const int cookie_filter_count = g_v4_cookie_access_filter_events.load();
  const int cookie_send_count = g_v4_cookie_send_events.load();
  const int cookie_save_count = g_v4_cookie_save_events.load();
  const int response_filter_get_count =
      g_v4_response_filter_get_events.load();
  const int response_filter_init_count =
      g_v4_response_filter_init_events.load();
  const int response_filter_chunk_count =
      g_v4_response_filter_chunk_events.load();
  const int response_filter_console_count =
      g_response_filter_console_events.load();
  assert(LB_CEF3_SetEventCallbackV4(
      0, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b, cookie_filter_url.c_str()) == LB_CEF3_OK);
  assert(WaitTask(cookie_connected_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(cookie_request_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  int32_t cookie_connection_id = -1;
  assert(LB_CEF3_TaskGetServerConnectionId(
      cookie_request_task, &cookie_connection_id) == LB_CEF3_OK);
  assert(cookie_connection_id >= 0);
  const auto cookie_headers = LB_CEF3_DictionaryCreate();
  const auto cookie_header_value = LB_CEF3_ValueCreate();
  assert(cookie_headers != 0 && cookie_header_value != 0);
  assert(LB_CEF3_ValueSetString(
      cookie_header_value, L"bridge_saved=beta; Path=/; SameSite=Lax")
      == LB_CEF3_OK);
  assert(LB_CEF3_DictionarySetValue(
      cookie_headers, L"Set-Cookie", cookie_header_value) == LB_CEF3_OK);
  static constexpr char cookie_body[] =
      "<html><body><span id=\"payload\">bridge-original</span>"
      "<script>console.log('response-filter:' + "
      "document.getElementById('payload').textContent)</script></body></html>";
  const auto cookie_body_buffer = LB_CEF3_BufferCreate(
      cookie_body, sizeof(cookie_body) - 1);
  assert(cookie_body_buffer != 0);
  assert(LB_CEF3_ServerSendHttpResponse(
      server, cookie_connection_id, 200, L"text/html; charset=utf-8",
      sizeof(cookie_body) - 1, cookie_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ServerSendRawData(
      server, cookie_connection_id, cookie_body_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_ServerCloseConnection(
      server, cookie_connection_id) == LB_CEF3_OK);
  assert(WaitTask(cookie_disconnected_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  const auto cookie_event_deadline = GetTickCount64() + 30000;
  while ((g_v4_cookie_access_filter_events.load() <= cookie_filter_count
          || g_v4_cookie_send_events.load() <= cookie_send_count
          || g_v4_cookie_save_events.load() <= cookie_save_count
          || g_v4_response_filter_get_events.load()
              <= response_filter_get_count
          || g_v4_response_filter_init_events.load()
              <= response_filter_init_count
          || g_v4_response_filter_chunk_events.load()
              <= response_filter_chunk_count
          || g_response_filter_console_events.load()
              <= response_filter_console_count)
      && GetTickCount64() < cookie_event_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_cookie_access_filter_events.load() > cookie_filter_count);
  assert(g_v4_cookie_send_events.load() > cookie_send_count);
  assert(g_v4_cookie_save_events.load() > cookie_save_count);
  assert(g_v4_response_filter_get_events.load() > response_filter_get_count);
  assert(g_v4_response_filter_init_events.load() > response_filter_init_count);
  assert(g_v4_response_filter_chunk_events.load()
      > response_filter_chunk_count);
  assert(g_response_filter_console_events.load()
      > response_filter_console_count);
  assert(LB_CEF3_ResourceRequestHandlerSubscribeCookieAccessFilter(
      browser_b, 0) == LB_CEF3_OK);
  assert(LB_CEF3_CookieAccessFilterSubscribeCanSendCookie(
      browser_b, 0) == LB_CEF3_OK);
  assert(LB_CEF3_CookieAccessFilterSubscribeCanSaveCookie(
      browser_b, 0) == LB_CEF3_OK);
  response_filter_attach_argument.handle_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x324e71e8a4dfdbc9), browser_b,
      &response_filter_attach_argument, 1)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(response_filter) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(response_filter_empty) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(response_filter_replacement) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(response_filter_find) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(cookie_body_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(cookie_header_value) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(cookie_headers) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(cookie_disconnected_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(cookie_request_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(cookie_connected_task) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(seed_cookie_task) == LB_CEF3_OK);

  static constexpr char managed_resource_body[] =
      "<html><body><script>console.log('resource-handler:' + "
      "new URL(location.href).searchParams.get('mode'))</script></body></html>";
  const auto managed_resource_buffer = LB_CEF3_BufferCreate(
      managed_resource_body, sizeof(managed_resource_body) - 1);
  assert(managed_resource_buffer != 0);
  assert(LB_CEF3_ResourceHandlerCreate(
      nullptr, managed_resource_buffer, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_HANDLE direct_resource_handler = 0;
  assert(LB_CEF3_ResourceHandlerCreate(
      L"file:///unsafe/", managed_resource_buffer,
      &direct_resource_handler) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(direct_resource_handler == 0);
  assert(LB_CEF3_ResourceHandlerCreate(
      L"https://managed-resource.lingbuilder.test/",
      managed_resource_buffer, &direct_resource_handler) == LB_CEF3_OK);
  assert(direct_resource_handler != 0);
  assert(LB_CEF3_HandleGetType(direct_resource_handler)
      == LB_CEF3_HANDLE_RESOURCE_HANDLER);
  assert(LB_CEF3_ResourceHandlerSetLegacyOpen(
      direct_resource_handler, 2) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceHandlerSetResponse(
      direct_resource_handler, 99, L"text/html", L"", 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceHandlerSetResponse(
      direct_resource_handler, 200, L"text/html; charset=utf-8", L"", 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResourceHandlerSetAsyncRead(
      browser_b, 1) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ResourceRequestHandlerSetResourceHandler(
      browser_b, context_b) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ResourceRequestHandlerSetResourceHandler(
      browser_b, direct_resource_handler) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceRequestHandlerSetResourceHandler(
      browser_b, 0) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(direct_resource_handler) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceHandlerSetAsyncRead(
      direct_resource_handler, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);

  std::array<LB_CEF3_ARGUMENT_V4, 2> resource_create_arguments{};
  for (auto& argument : resource_create_arguments)
    argument.struct_size = sizeof(argument);
  resource_create_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resource_create_arguments[0].text_value =
      L"https://managed-resource.lingbuilder.test/";
  resource_create_arguments[1].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  resource_create_arguments[1].buffer_value = managed_resource_buffer;
  const auto resource_handler = invoke_view_call(make_view_call(
      UINT64_C(0x0ce530725a088529), 0,
      resource_create_arguments.data(), resource_create_arguments.size()))
      .handle_value;
  assert(resource_handler != 0);
  assert(LB_CEF3_HandleGetType(resource_handler)
      == LB_CEF3_HANDLE_RESOURCE_HANDLER);
  auto invalid_resource_create = make_view_call(
      UINT64_C(0x0ce530725a088529), browser_b,
      resource_create_arguments.data(), resource_create_arguments.size());
  LB_CEF3_RESULT_V4 invalid_resource_result{};
  invalid_resource_result.struct_size = sizeof(invalid_resource_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_resource_create, &invalid_resource_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto resource_headers = CreateHeaderMapList({
      {L"X-LingBuilder-Resource", L"managed"},
      {L"Cache-Control", L"no-store"}});
  assert(resource_headers != 0);
  std::array<LB_CEF3_ARGUMENT_V4, 4> resource_response_arguments{};
  for (auto& argument : resource_response_arguments)
    argument.struct_size = sizeof(argument);
  resource_response_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  resource_response_arguments[0].integer_value = 200;
  resource_response_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resource_response_arguments[1].text_value = L"text/html";
  resource_response_arguments[2].value_kind = LB_CEF3_VALUE_V4_TEXT;
  resource_response_arguments[2].text_value = L"";
  resource_response_arguments[3].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  resource_response_arguments[3].handle_value = resource_headers;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0xa568e9aace100bc9), resource_handler,
      resource_response_arguments.data(), resource_response_arguments.size()))
      .value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 resource_flag_argument{};
  resource_flag_argument.struct_size = sizeof(resource_flag_argument);
  resource_flag_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto set_resource_flag = [&](uint64_t operation_id, int enabled) {
    resource_flag_argument.integer_value = enabled;
    const auto result = invoke_view_call(make_view_call(
        operation_id, resource_handler, &resource_flag_argument, 1));
    assert(result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(result.integer_value == LB_CEF3_OK);
  };
  set_resource_flag(UINT64_C(0x0a0bb2a0d4cb61a5), 0);
  set_resource_flag(UINT64_C(0xcb04475fe8b923df), 1);
  set_resource_flag(UINT64_C(0x04e855cec82ad27b), 1);
  set_resource_flag(UINT64_C(0xda6c5fde45a2c54c), 0);
  set_resource_flag(UINT64_C(0x8894e928b5819d0d), 1);
  resource_flag_argument.integer_value = 2;
  auto invalid_resource_flag_call = make_view_call(
      UINT64_C(0x04e855cec82ad27b), resource_handler,
      &resource_flag_argument, 1);
  invalid_resource_result = {};
  invalid_resource_result.struct_size = sizeof(invalid_resource_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_resource_flag_call, &invalid_resource_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 resource_attach_argument{};
  resource_attach_argument.struct_size = sizeof(resource_attach_argument);
  resource_attach_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  resource_attach_argument.handle_value = resource_handler;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x23d8b19b2d7bbc83), browser_b,
      &resource_attach_argument, 1)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_ResourceReadCallbackContinue(resource_handler, 1)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ResourceSkipCallbackContinue(resource_handler, 1)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  const int resource_get_count = g_v4_resource_handler_get_events.load();
  const int resource_open_count = g_v4_resource_handler_open_events.load();
  const int resource_headers_count =
      g_v4_resource_handler_headers_events.load();
  const int resource_read_count = g_v4_resource_handler_read_events.load();
  const int resource_async_console_count =
      g_resource_handler_async_console_events.load();
  assert(LB_CEF3_SetEventCallbackV4(
      0, TestEventCallbackV4, nullptr) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b,
      L"https://managed-resource.lingbuilder.test/page?mode=async")
      == LB_CEF3_OK);
  const auto resource_async_deadline = GetTickCount64() + 30000;
  while ((g_v4_resource_handler_get_events.load() <= resource_get_count
          || g_v4_resource_handler_open_events.load() <= resource_open_count
          || g_v4_resource_handler_headers_events.load()
              <= resource_headers_count
          || g_v4_resource_handler_read_events.load() <= resource_read_count
          || g_resource_handler_async_console_events.load()
              <= resource_async_console_count)
      && GetTickCount64() < resource_async_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_resource_handler_get_events.load() > resource_get_count);
  assert(g_v4_resource_handler_open_events.load() > resource_open_count);
  assert(g_v4_resource_handler_headers_events.load() > resource_headers_count);
  assert(g_v4_resource_handler_read_events.load() > resource_read_count);
  assert(g_resource_handler_async_console_events.load()
      > resource_async_console_count);

  set_resource_flag(UINT64_C(0x0a0bb2a0d4cb61a5), 1);
  set_resource_flag(UINT64_C(0x04e855cec82ad27b), 0);
  set_resource_flag(UINT64_C(0xda6c5fde45a2c54c), 1);
  const int resource_process_count =
      g_v4_resource_handler_process_events.load();
  const int resource_legacy_read_count =
      g_v4_resource_handler_legacy_read_events.load();
  const int resource_legacy_console_count =
      g_resource_handler_legacy_console_events.load();
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b,
      L"https://managed-resource.lingbuilder.test/page?mode=legacy")
      == LB_CEF3_OK);
  const auto resource_legacy_deadline = GetTickCount64() + 30000;
  while ((g_v4_resource_handler_process_events.load()
              <= resource_process_count
          || g_v4_resource_handler_legacy_read_events.load()
              <= resource_legacy_read_count
          || g_resource_handler_legacy_console_events.load()
              <= resource_legacy_console_count)
      && GetTickCount64() < resource_legacy_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_resource_handler_process_events.load()
      > resource_process_count);
  assert(g_v4_resource_handler_legacy_read_events.load()
      > resource_legacy_read_count);
  assert(g_resource_handler_legacy_console_events.load()
      > resource_legacy_console_count);

  set_resource_flag(UINT64_C(0x0a0bb2a0d4cb61a5), 0);
  set_resource_flag(UINT64_C(0x04e855cec82ad27b), 1);
  set_resource_flag(UINT64_C(0xda6c5fde45a2c54c), 0);
  LB_CEF3_HANDLE browser_b_frame_ids = 0;
  assert(LB_CEF3_BrowserGetFrameIdentifiers(
      browser_b, &browser_b_frame_ids) == LB_CEF3_OK);
  assert(browser_b_frame_ids != 0
      && LB_CEF3_ListGetSize(browser_b_frame_ids) > 0);
  const auto browser_b_frame_id = ReadTextListItem(browser_b_frame_ids, 0);
  LB_CEF3_HANDLE browser_b_frame = 0;
  assert(LB_CEF3_BrowserGetFrameByIdentifier(
      browser_b, browser_b_frame_id.c_str(), &browser_b_frame) == LB_CEF3_OK);
  assert(browser_b_frame != 0);
  const auto range_request = LB_CEF3_RequestCreate();
  assert(range_request != 0);
  assert(LB_CEF3_RequestSetUrl(
      range_request,
      L"https://managed-resource.lingbuilder.test/page?mode=skip")
      == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetMethod(range_request, L"GET") == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetHeaderByName(
      range_request, L"Range", L"bytes=5-", 1) == LB_CEF3_OK);
  const int resource_skip_count = g_v4_resource_handler_skip_events.load();
  assert(LB_CEF3_FrameLoadRequest(browser_b_frame, range_request)
      == LB_CEF3_OK);
  const auto resource_skip_deadline = GetTickCount64() + 30000;
  while (g_v4_resource_handler_skip_events.load() <= resource_skip_count
      && GetTickCount64() < resource_skip_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_resource_handler_skip_events.load() > resource_skip_count);
  assert(LB_CEF3_HandleRelease(range_request) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(browser_b_frame) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(browser_b_frame_ids) == LB_CEF3_OK);

  const int resource_cancel_count =
      g_v4_resource_handler_cancel_events.load();
  g_hold_resource_read.store(true);
  g_held_resource_read_continuation.store(0);
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b,
      L"https://managed-resource.lingbuilder.test/page?mode=cancel")
      == LB_CEF3_OK);
  const auto resource_hold_deadline = GetTickCount64() + 30000;
  while (g_held_resource_read_continuation.load() == 0
      && GetTickCount64() < resource_hold_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  const auto held_resource_continuation =
      g_held_resource_read_continuation.load();
  assert(held_resource_continuation != 0);
  assert(LB_CEF3_BrowserLoadUrl(
      browser_b, L"data:text/html,resource-handler-cancelled")
      == LB_CEF3_OK);
  const auto resource_cancel_deadline = GetTickCount64() + 30000;
  while (g_v4_resource_handler_cancel_events.load() <= resource_cancel_count
      && GetTickCount64() < resource_cancel_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(g_v4_resource_handler_cancel_events.load() > resource_cancel_count);
  assert(LB_CEF3_HandleRelease(held_resource_continuation) == LB_CEF3_OK);
  resource_attach_argument.handle_value = 0;
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x23d8b19b2d7bbc83), browser_b,
      &resource_attach_argument, 1)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_SetEventCallbackV4(0, nullptr, nullptr) == LB_CEF3_OK);
  set_resource_flag(UINT64_C(0x04e855cec82ad27b), 0);

  LB_CEF3_HANDLE direct_scheme_factory = 0;
  assert(LB_CEF3_SchemeHandlerFactoryCreate(
             browser_b, &direct_scheme_factory)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_SchemeHandlerFactoryCreate(
             resource_handler, &direct_scheme_factory)
      == LB_CEF3_OK);
  assert(direct_scheme_factory != 0);
  assert(LB_CEF3_HandleGetType(direct_scheme_factory)
      == LB_CEF3_HANDLE_SCHEME_HANDLER_FACTORY);

  LB_CEF3_ARGUMENT_V4 scheme_factory_argument{};
  scheme_factory_argument.struct_size = sizeof(scheme_factory_argument);
  scheme_factory_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  scheme_factory_argument.handle_value = resource_handler;
  const auto scheme_factory_result = invoke_view_call(make_view_call(
      UINT64_C(0x913b3ba72ae6c5b4), 0, &scheme_factory_argument, 1));
  const auto scheme_factory_v4 = scheme_factory_result.handle_value;
  assert(scheme_factory_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(scheme_factory_v4 != 0);
  assert(LB_CEF3_HandleGetType(scheme_factory_v4)
      == LB_CEF3_HANDLE_SCHEME_HANDLER_FACTORY);
  auto invalid_scheme_factory_call = make_view_call(
      UINT64_C(0x913b3ba72ae6c5b4), browser_b,
      &scheme_factory_argument, 1);
  LB_CEF3_RESULT_V4 invalid_scheme_factory_result{};
  invalid_scheme_factory_result.struct_size = sizeof(invalid_scheme_factory_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_scheme_factory_call, &invalid_scheme_factory_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  assert(LB_CEF3_RegisterSchemeHandlerFactory(
             L"lingbuilderdirect", L"", direct_scheme_factory)
      == 1);
  assert(LB_CEF3_RequestContextRegisterSchemeHandlerFactory(
             context_b, L"lingbuilder", L"", direct_scheme_factory)
      == 1);
  assert(LB_CEF3_RequestContextRegisterSchemeHandlerFactory(
             context_b, L"lingbuilder", L"", browser_b)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  std::array<LB_CEF3_ARGUMENT_V4, 3> scheme_registration_arguments{};
  for (auto& argument : scheme_registration_arguments)
    argument.struct_size = sizeof(argument);
  scheme_registration_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  scheme_registration_arguments[0].text_value = L"lingbuilderappv4";
  scheme_registration_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  scheme_registration_arguments[1].text_value = L"";
  scheme_registration_arguments[2].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  scheme_registration_arguments[2].handle_value = scheme_factory_v4;
  const auto global_scheme_result = invoke_view_call(make_view_call(
      UINT64_C(0xec3d2cb1270a582d), 0,
      scheme_registration_arguments.data(),
      scheme_registration_arguments.size()));
  assert(global_scheme_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(global_scheme_result.integer_value == 1);
  auto invalid_global_scheme_call = make_view_call(
      UINT64_C(0xec3d2cb1270a582d), browser_b,
      scheme_registration_arguments.data(),
      scheme_registration_arguments.size());
  LB_CEF3_RESULT_V4 invalid_global_scheme_result{};
  invalid_global_scheme_result.struct_size = sizeof(invalid_global_scheme_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_global_scheme_call, &invalid_global_scheme_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  scheme_registration_arguments[0].text_value = L"lingbuilderv4";
  const auto context_scheme_result = invoke_view_call(make_view_call(
      UINT64_C(0x723aea7d8f11b81b), context_b,
      scheme_registration_arguments.data(),
      scheme_registration_arguments.size()));
  assert(context_scheme_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(context_scheme_result.integer_value == 1);
  auto invalid_context_scheme_call = make_view_call(
      UINT64_C(0x723aea7d8f11b81b), 0,
      scheme_registration_arguments.data(),
      scheme_registration_arguments.size());
  LB_CEF3_RESULT_V4 invalid_context_scheme_result{};
  invalid_context_scheme_result.struct_size = sizeof(invalid_context_scheme_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_context_scheme_call, &invalid_context_scheme_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto verify_custom_scheme_page = [&](const wchar_t* url) {
    assert(LB_CEF3_BrowserLoadUrl(browser_b, url) == LB_CEF3_OK);
    const auto navigation_deadline = GetTickCount64() + 30000;
    while ((ReadManagedText(browser_b, LB_CEF3_BrowserGetUrl) != url
            || LB_CEF3_BrowserIsLoading(browser_b) == 1)
        && GetTickCount64() < navigation_deadline) {
      PumpHostMessages();
      Sleep(10);
    }
    assert(ReadManagedText(browser_b, LB_CEF3_BrowserGetUrl) == url);
    assert(LB_CEF3_BrowserIsLoading(browser_b) == 0);
    LB_CEF3_HANDLE identifiers = 0;
    assert(LB_CEF3_BrowserGetFrameIdentifiers(browser_b, &identifiers)
        == LB_CEF3_OK);
    LB_CEF3_HANDLE main_frame = 0;
    const size_t frame_total = LB_CEF3_ListGetSize(identifiers);
    for (size_t index = 0; index < frame_total && main_frame == 0; ++index) {
      const auto identifier = ReadTextListItem(identifiers, index);
      LB_CEF3_HANDLE candidate = 0;
      assert(LB_CEF3_BrowserGetFrameByIdentifier(
                 browser_b, identifier.c_str(), &candidate)
          == LB_CEF3_OK);
      if (candidate != 0 && LB_CEF3_FrameIsMain(candidate) == 1) {
        main_frame = candidate;
      } else if (candidate != 0) {
        assert(LB_CEF3_HandleRelease(candidate) == LB_CEF3_OK);
      }
    }
    assert(main_frame != 0);
    const auto source_task = LB_CEF3_FrameGetSource(main_frame);
    assert(source_task != 0);
    assert(WaitTask(source_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
    assert(TaskResult(source_task).find(L"resource-handler:")
        != std::wstring::npos);
    assert(LB_CEF3_TaskRelease(source_task) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(main_frame) == LB_CEF3_OK);
    assert(LB_CEF3_ListRelease(identifiers) == LB_CEF3_OK);
  };
  verify_custom_scheme_page(L"lingbuilder://managed/page?mode=direct");
  verify_custom_scheme_page(L"lingbuilderv4://managed/page?mode=v4");

  scheme_registration_arguments[2].handle_value = 0;
  const auto context_scheme_remove_result = invoke_view_call(make_view_call(
      UINT64_C(0x723aea7d8f11b81b), context_b,
      scheme_registration_arguments.data(),
      scheme_registration_arguments.size()));
  assert(context_scheme_remove_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(context_scheme_remove_result.integer_value == 1);
  assert(LB_CEF3_RequestContextRegisterSchemeHandlerFactory(
             context_b, L"lingbuilder", L"", 0)
      == 1);
  assert(LB_CEF3_RegisterSchemeHandlerFactory(
             L"lingbuilderdirect", L"", 0)
      == 1);
  assert(LB_CEF3_RegisterSchemeHandlerFactory(
             L"lingbuilderappv4", L"", 0)
      == 1);
  assert(LB_CEF3_HandleRelease(scheme_factory_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(direct_scheme_factory) == LB_CEF3_OK);
  assert(LB_CEF3_HandleGetType(direct_scheme_factory)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(resource_handler) == LB_CEF3_OK);
  assert(LB_CEF3_ResourceHandlerSetAsyncRead(resource_handler, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ListRelease(resource_headers) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(managed_resource_buffer) == LB_CEF3_OK);

  const auto server_destroyed_task = invoke_view_call(make_view_call(
      UINT64_C(0x8567ecf6d420f4d0), server)).handle_value;
  assert(server_destroyed_task != 0);
  assert(invoke_view_call(make_view_call(
      UINT64_C(0x6462bfcaf36b0573), server)).value_kind
      == LB_CEF3_VALUE_V4_VOID);
  assert(WaitTask(server_destroyed_task, 30000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(server_destroyed_task)
      == L"{\"kind\":\"serverDestroyed\"}");
  assert(LB_CEF3_TaskRelease(server_destroyed_task) == LB_CEF3_OK);
  assert(LB_CEF3_ServerIsRunning(server) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(server) == LB_CEF3_OK);
  assert(LB_CEF3_ServerHasConnection(server) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_TaskRelease(server_create_task) == LB_CEF3_OK);

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
  LB_CEF3_HANDLE preference_observer = 0;
  assert(LB_CEF3_RequestContextAddPreferenceObserver(
      context_a, L"proxy", nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextAddPreferenceObserver(
      context_a, L"proxy", &preference_observer) == LB_CEF3_OK);
  assert(preference_observer != 0);
  assert(LB_CEF3_HandleGetType(preference_observer)
      == LB_CEF3_HANDLE_OBSERVER_REGISTRATION);
  LB_CEF3_TASK_HANDLE preference_event_task = 0;
  assert(LB_CEF3_PreferenceObserverNextEvent(preference_observer, nullptr)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_PreferenceObserverNextEvent(
      preference_observer, &preference_event_task) == LB_CEF3_OK);
  assert(preference_event_task != 0);
  LB_CEF3_ARGUMENT_V4 preference_name_argument{};
  preference_name_argument.struct_size = sizeof(preference_name_argument);
  preference_name_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  preference_name_argument.text_value = L"proxy";
  const auto preference_observer_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x2311841ae910d79f), context_a,
      &preference_name_argument, 1)).handle_value;
  assert(preference_observer_v4 != 0);
  const auto preference_event_task_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x285743e61bce4ec0), preference_observer_v4)).handle_value;
  assert(preference_event_task_v4 != 0);
  LB_CEF3_TASK_HANDLE wrong_observer_task = 0;
  assert(LB_CEF3_SettingObserverNextEvent(
      preference_observer, &wrong_observer_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(wrong_observer_task == 0);
  assert(LB_CEF3_RequestContextSetPreference(context_a, L"proxy", 0) == LB_CEF3_OK);
  assert(WaitTask(preference_event_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(preference_event_task_v4) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(preference_event_task).find(L"\"name\":\"proxy\"")
      != std::wstring::npos);
  assert(TaskResult(preference_event_task_v4).find(L"\"name\":\"proxy\"")
      != std::wstring::npos);
  LB_CEF3_TASK_HANDLE released_preference_waiter = 0;
  assert(LB_CEF3_PreferenceObserverNextEvent(
      preference_observer, &released_preference_waiter) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(preference_observer) == LB_CEF3_OK);
  assert(WaitTask(released_preference_waiter) == LB_CEF3_TASK_FAILED);
  assert(LB_CEF3_PreferenceObserverNextEvent(
      preference_observer, &wrong_observer_task) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(preference_observer_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(released_preference_waiter) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(preference_event_task_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(preference_event_task) == LB_CEF3_OK);
  LB_CEF3_ValueRelease(proxy_preference);
  LB_CEF3_DictionaryRelease(all_preferences);

  LB_CEF3_HANDLE global_context = 0;
  LB_CEF3_HANDLE shared_context = 0;
  assert(LB_CEF3_RequestContextGetGlobal(nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextGetGlobal(&global_context) == LB_CEF3_OK);
  assert(global_context != 0);
  assert(LB_CEF3_RequestContextCreateShared(context_a, &shared_context) == LB_CEF3_OK);
  assert(shared_context != 0);
  assert(LB_CEF3_RequestContextIsSame(context_a, context_a) == 1);
  const int shared_context_is_same =
      LB_CEF3_RequestContextIsSame(context_a, shared_context);
  assert(shared_context_is_same == 0 || shared_context_is_same == 1);
  assert(LB_CEF3_RequestContextIsSharingWith(context_a, shared_context) == 1);
  assert(LB_CEF3_RequestContextIsGlobal(global_context) == 1);
  assert(LB_CEF3_RequestContextIsGlobal(context_a) == 0);
  LB_CEF3_HANDLE url_request_probe = 0;
  assert(LB_CEF3_FrameCreateUrlRequest(0, 0, 0, &url_request_probe)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(url_request_probe == 0);
  const auto cookie_visit_task = LB_CEF3_CookieVisitAll(context_a);
  assert(cookie_visit_task != 0);
  assert(WaitTask(cookie_visit_task, 15000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(cookie_visit_task) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextClearSchemeHandlerFactories(shared_context) >= 0);
  assert(LB_CEF3_ClearSchemeHandlerFactories() >= 0);

  constexpr int32_t kPopupContentSettingType = 3;
  constexpr int32_t kContentSettingDefault = 0;
  constexpr int32_t kContentSettingBlock = 2;
  LB_CEF3_HANDLE website_setting = 0;
  assert(LB_CEF3_RequestContextGetWebsiteSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, &website_setting) == LB_CEF3_OK);
  if (website_setting != 0) assert(LB_CEF3_ValueRelease(website_setting) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextSetWebsiteSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, 0) == LB_CEF3_OK);
  int32_t content_setting = -1;
  assert(LB_CEF3_RequestContextGetContentSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, &content_setting) == LB_CEF3_OK);
  assert(content_setting >= kContentSettingDefault);
  LB_CEF3_HANDLE setting_observer = 0;
  assert(LB_CEF3_RequestContextAddSettingObserver(
      context_a, nullptr) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextAddSettingObserver(
      context_a, &setting_observer) == LB_CEF3_OK);
  assert(setting_observer != 0);
  LB_CEF3_TASK_HANDLE setting_event_task = 0;
  assert(LB_CEF3_SettingObserverNextEvent(
      setting_observer, &setting_event_task) == LB_CEF3_OK);
  const auto setting_observer_v4 = invoke_view_call(make_view_call(
      UINT64_C(0x950470d1b56f1ace), context_a)).handle_value;
  assert(setting_observer_v4 != 0);
  const auto setting_event_task_v4 = invoke_view_call(make_view_call(
      UINT64_C(0xeadf701de6ff2897), setting_observer_v4)).handle_value;
  assert(setting_event_task_v4 != 0);
  assert(LB_CEF3_PreferenceObserverNextEvent(
      setting_observer, &wrong_observer_task) == LB_CEF3_ERROR_HANDLE_TYPE);
  LB_CEF3_ARGUMENT_V4 invalid_setting_observer_argument{};
  invalid_setting_observer_argument.struct_size =
      sizeof(invalid_setting_observer_argument);
  invalid_setting_observer_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  auto invalid_setting_observer_call = make_view_call(
      UINT64_C(0xeadf701de6ff2897), setting_observer_v4,
      &invalid_setting_observer_argument, 1);
  LB_CEF3_RESULT_V4 invalid_setting_observer_result{};
  invalid_setting_observer_result.struct_size =
      sizeof(invalid_setting_observer_result);
  assert(LB_CEF3_InvokeV4(
      &invalid_setting_observer_call, &invalid_setting_observer_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_RequestContextSetContentSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, kContentSettingBlock) == LB_CEF3_OK);
  assert(WaitTask(setting_event_task) == LB_CEF3_TASK_SUCCEEDED);
  assert(WaitTask(setting_event_task_v4) == LB_CEF3_TASK_SUCCEEDED);
  const auto setting_event_json = TaskResult(setting_event_task);
  const auto setting_event_json_v4 = TaskResult(setting_event_task_v4);
  for (const auto* event_json : {&setting_event_json, &setting_event_json_v4}) {
    assert(event_json->find(L"\"requestingUrl\":") != std::wstring::npos);
    assert(event_json->find(L"\"topLevelUrl\":") != std::wstring::npos);
    assert(event_json->find(L"\"contentType\":") != std::wstring::npos);
  }
  assert(LB_CEF3_HandleRelease(setting_observer_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(setting_observer) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(setting_event_task_v4) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRelease(setting_event_task) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetContentSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, &content_setting) == LB_CEF3_OK);
  assert(content_setting == kContentSettingBlock);
  assert(LB_CEF3_RequestContextSetContentSetting(
      context_a, L"https://lingbuilder.test/", L"https://lingbuilder.test/",
      kPopupContentSettingType, kContentSettingDefault) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetContentSetting(
      context_a, nullptr, nullptr, std::numeric_limits<int32_t>::max(),
      &content_setting) == LB_CEF3_ERROR_INVALID_ARGUMENT);

  int32_t color_scheme_mode = -1;
  int32_t color_scheme_variant = -1;
  uint32_t color_scheme_color = UINT32_MAX;
  assert(LB_CEF3_RequestContextSetChromeColorScheme(context_a, 1, 0) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetChromeColorSchemeMode(
      context_a, &color_scheme_mode) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetChromeColorSchemeColor(
      context_a, &color_scheme_color) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextGetChromeColorSchemeVariant(
      context_a, &color_scheme_variant) == LB_CEF3_OK);
  assert(color_scheme_mode >= 0 && color_scheme_variant >= 0);
  assert(LB_CEF3_RequestContextSetChromeColorScheme(context_a, 0, 0) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextSetChromeColorScheme(context_a, 99, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto invoke_request_context_v4 = [](
      LB_CEF3_OPERATION_ID operation_id, LB_CEF3_HANDLE target,
      const LB_CEF3_ARGUMENT_V4* arguments, size_t argument_count) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = target;
    call.arguments = arguments;
    call.argument_count = argument_count;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    return result;
  };
  auto context_v4_result = invoke_request_context_v4(
      UINT64_C(0x91bd3c5ed21dd197), 0, nullptr, 0);
  const auto global_context_v4 = context_v4_result.handle_value;
  assert(global_context_v4 != 0);
  LB_CEF3_ARGUMENT_V4 context_handle_argument{};
  context_handle_argument.struct_size = sizeof(context_handle_argument);
  context_handle_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  context_handle_argument.handle_value = context_a;
  context_v4_result = invoke_request_context_v4(
      UINT64_C(0xce365e7a24eb93ce), 0, &context_handle_argument, 1);
  const auto shared_context_v4 = context_v4_result.handle_value;
  assert(shared_context_v4 != 0);
  context_handle_argument.handle_value = shared_context_v4;
  const auto shared_context_v4_is_same = invoke_request_context_v4(
      UINT64_C(0xb38726a40a088375), context_a, &context_handle_argument, 1)
      .integer_value;
  assert(shared_context_v4_is_same == 0 || shared_context_v4_is_same == 1);
  assert(invoke_request_context_v4(
      UINT64_C(0xed9ee31f201c1400), context_a, &context_handle_argument, 1)
      .integer_value == 1);
  assert(invoke_request_context_v4(
      UINT64_C(0x8fc6d4b2ca8cd2e6), global_context_v4, nullptr, 0)
      .integer_value == 1);
  (void)invoke_request_context_v4(
      UINT64_C(0x2a228ac49b5e8eaa), shared_context_v4, nullptr, 0);
  (void)invoke_request_context_v4(
      UINT64_C(0x44179841478e6dca), 0, nullptr, 0);

  LB_CEF3_ARGUMENT_V4 setting_arguments[4]{};
  for (auto& argument : setting_arguments) argument.struct_size = sizeof(argument);
  setting_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  setting_arguments[0].text_value = L"https://lingbuilder.test/";
  setting_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  setting_arguments[1].text_value = L"https://lingbuilder.test/";
  setting_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  setting_arguments[2].integer_value = kPopupContentSettingType;
  context_v4_result = invoke_request_context_v4(
      UINT64_C(0x4d03c0bfc6fde4d7), context_a, setting_arguments, 3);
  if (context_v4_result.handle_value != 0)
    assert(LB_CEF3_ValueRelease(context_v4_result.handle_value) == LB_CEF3_OK);
  setting_arguments[3].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  setting_arguments[3].handle_value = 0;
  (void)invoke_request_context_v4(
      UINT64_C(0xf2cef5ebac474e1f), context_a, setting_arguments, 4);
  assert(invoke_request_context_v4(
      UINT64_C(0x4cac825a4de6f255), context_a, setting_arguments, 3)
      .value_kind == LB_CEF3_VALUE_V4_INTEGER);
  setting_arguments[3].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  setting_arguments[3].integer_value = kContentSettingDefault;
  (void)invoke_request_context_v4(
      UINT64_C(0x7d3fd3a8a8da1260), context_a, setting_arguments, 4);

  LB_CEF3_ARGUMENT_V4 color_arguments[2]{};
  for (auto& argument : color_arguments) argument.struct_size = sizeof(argument);
  color_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  color_arguments[0].integer_value = 0;
  color_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  color_arguments[1].integer_value = 0;
  (void)invoke_request_context_v4(
      UINT64_C(0xe79692ddd90d82e5), context_a, color_arguments, 2);
  assert(invoke_request_context_v4(
      UINT64_C(0x21add6b3ba13087c), context_a, nullptr, 0)
      .value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(invoke_request_context_v4(
      UINT64_C(0xdf5cbca1420e8437), context_a, nullptr, 0)
      .value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(invoke_request_context_v4(
      UINT64_C(0x67cc44c7930db7d1), context_a, nullptr, 0)
      .value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(LB_CEF3_RequestContextRelease(shared_context_v4) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextRelease(global_context_v4) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextRelease(shared_context) == LB_CEF3_OK);
  assert(LB_CEF3_RequestContextRelease(global_context) == LB_CEF3_OK);

  std::array<wchar_t, 2048> platform_json{};
  assert(LB_CEF3_GetExtensionsForMimeType(L"text/html", platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(platform_json.data()).find(L"html") != std::wstring::npos);
  assert(LB_CEF3_GetMimeType(L".html", platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(platform_json.data()) == L"text/html");
  assert(LB_CEF3_GetExitCode() >= 0);
  LB_CEF3_CALL_V4 exit_code_call{};
  exit_code_call.struct_size = sizeof(exit_code_call);
  exit_code_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  exit_code_call.operation_id = UINT64_C(0xbf6c76799a90db79);
  LB_CEF3_RESULT_V4 exit_code_result{};
  exit_code_result.struct_size = sizeof(exit_code_result);
  assert(LB_CEF3_InvokeV4(&exit_code_call, &exit_code_result) == LB_CEF3_OK);
  assert(exit_code_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(exit_code_result.integer_value >= 0);
  assert(LB_CEF3_IsRtl() == 0 || LB_CEF3_IsRtl() == 1);
  LB_CEF3_CALL_V4 rtl_call{};
  rtl_call.struct_size = sizeof(rtl_call);
  rtl_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  rtl_call.operation_id = UINT64_C(0xabe86aa1e57d29be);
  LB_CEF3_RESULT_V4 rtl_result{};
  rtl_result.struct_size = sizeof(rtl_result);
  assert(LB_CEF3_InvokeV4(&rtl_call, &rtl_result) == LB_CEF3_OK);
  assert(rtl_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(rtl_result.integer_value == 0 || rtl_result.integer_value == 1);
  assert(LB_CEF3_NowFromSystemTraceTime() > 0);
  LB_CEF3_CALL_V4 trace_time_call{};
  trace_time_call.struct_size = sizeof(trace_time_call);
  trace_time_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  trace_time_call.operation_id = UINT64_C(0x0b5cce7d1f747680);
  LB_CEF3_RESULT_V4 trace_time_result{};
  trace_time_result.struct_size = sizeof(trace_time_result);
  assert(LB_CEF3_InvokeV4(&trace_time_call, &trace_time_result) == LB_CEF3_OK);
  assert(trace_time_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(trace_time_result.integer_value > 0);
  assert(LB_CEF3_IsCertStatusError(0) == 0);
  assert(LB_CEF3_IsCertStatusError(1) == 1);
  LB_CEF3_ARGUMENT_V4 cert_status_argument{};
  cert_status_argument.struct_size = sizeof(cert_status_argument);
  cert_status_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  cert_status_argument.integer_value = 1;
  LB_CEF3_CALL_V4 cert_status_call{};
  cert_status_call.struct_size = sizeof(cert_status_call);
  cert_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  cert_status_call.operation_id = UINT64_C(0x97bacf8483cacf2c);
  cert_status_call.arguments = &cert_status_argument;
  cert_status_call.argument_count = 1;
  LB_CEF3_RESULT_V4 cert_status_result{};
  cert_status_result.struct_size = sizeof(cert_status_result);
  assert(LB_CEF3_InvokeV4(&cert_status_call, &cert_status_result) == LB_CEF3_OK);
  assert(cert_status_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(cert_status_result.integer_value == 1);
  assert(LB_CEF3_CrashReportingEnabled() == 0 || LB_CEF3_CrashReportingEnabled() == 1);
  LB_CEF3_CALL_V4 crash_reporting_call{};
  crash_reporting_call.struct_size = sizeof(crash_reporting_call);
  crash_reporting_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  crash_reporting_call.operation_id = UINT64_C(0x53b78095bc748d45);
  LB_CEF3_RESULT_V4 crash_reporting_result{};
  crash_reporting_result.struct_size = sizeof(crash_reporting_result);
  assert(LB_CEF3_InvokeV4(&crash_reporting_call, &crash_reporting_result) == LB_CEF3_OK);
  assert(crash_reporting_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(crash_reporting_result.integer_value == 0 || crash_reporting_result.integer_value == 1);
  assert(LB_CEF3_SetCrashKeyValue(L"lingbuilder_test", L"cef3") == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 crash_key_arguments[2]{};
  crash_key_arguments[0].struct_size = sizeof(crash_key_arguments[0]);
  crash_key_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  crash_key_arguments[0].text_value = L"lingbuilder_v4_test";
  crash_key_arguments[1].struct_size = sizeof(crash_key_arguments[1]);
  crash_key_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  crash_key_arguments[1].text_value = L"ok";
  LB_CEF3_CALL_V4 crash_key_call{};
  crash_key_call.struct_size = sizeof(crash_key_call);
  crash_key_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  crash_key_call.operation_id = UINT64_C(0x2f47a8c1a737489e);
  crash_key_call.arguments = crash_key_arguments;
  crash_key_call.argument_count = 2;
  LB_CEF3_RESULT_V4 crash_key_result{};
  crash_key_result.struct_size = sizeof(crash_key_result);
  assert(LB_CEF3_InvokeV4(&crash_key_call, &crash_key_result) == LB_CEF3_OK);
  assert(crash_key_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_IdForCommandIdName(L"IDC_BACK") >= -1);
  assert(LB_CEF3_IdForCommandIdName(L"LingBuilderUnknownCommand") == -1);
  assert(LB_CEF3_IdForPackResourceName(L"IDR_BROKENCANVAS") >= -1);
  assert(LB_CEF3_IdForPackResourceName(L"LingBuilderUnknownResource") == -1);
  assert(LB_CEF3_IdForPackStringName(L"IDS_PRODUCT_NAME") >= -1);
  assert(LB_CEF3_IdForPackStringName(L"LingBuilderUnknownString") == -1);
  const auto existing_directory = root / L"directory-exists";
  std::filesystem::create_directories(existing_directory);
  assert(LB_CEF3_DirectoryExists(existing_directory.c_str()) == 1);
  assert(LB_CEF3_DirectoryExists((root / L"directory-missing").c_str()) == 0);
  const auto created_directory = root / L"directory-created" / L"nested";
  assert(LB_CEF3_CreateDirectory(created_directory.c_str()) == 1);
  assert(std::filesystem::is_directory(created_directory));
  LB_CEF3_ARGUMENT_V4 command_id_argument{};
  command_id_argument.struct_size = sizeof(command_id_argument);
  command_id_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  command_id_argument.text_value = L"LingBuilderUnknownCommand";
  LB_CEF3_CALL_V4 command_id_call{};
  command_id_call.struct_size = sizeof(command_id_call);
  command_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  command_id_call.operation_id = UINT64_C(0xf0ee9fda4e748ca6);
  command_id_call.arguments = &command_id_argument;
  command_id_call.argument_count = 1;
  LB_CEF3_RESULT_V4 command_id_result{};
  command_id_result.struct_size = sizeof(command_id_result);
  assert(LB_CEF3_InvokeV4(&command_id_call, &command_id_result) == LB_CEF3_OK);
  assert(command_id_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(command_id_result.integer_value == -1);
  LB_CEF3_ARGUMENT_V4 resource_id_argument{};
  resource_id_argument.struct_size = sizeof(resource_id_argument);
  resource_id_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  resource_id_argument.text_value = L"LingBuilderUnknownResource";
  LB_CEF3_CALL_V4 resource_id_call{};
  resource_id_call.struct_size = sizeof(resource_id_call);
  resource_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  resource_id_call.operation_id = UINT64_C(0x81337a99673f13ae);
  resource_id_call.arguments = &resource_id_argument;
  resource_id_call.argument_count = 1;
  LB_CEF3_RESULT_V4 resource_id_result{};
  resource_id_result.struct_size = sizeof(resource_id_result);
  assert(LB_CEF3_InvokeV4(&resource_id_call, &resource_id_result) == LB_CEF3_OK);
  assert(resource_id_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(resource_id_result.integer_value == -1);
  LB_CEF3_ARGUMENT_V4 string_id_argument{};
  string_id_argument.struct_size = sizeof(string_id_argument);
  string_id_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  string_id_argument.text_value = L"LingBuilderUnknownString";
  LB_CEF3_CALL_V4 string_id_call{};
  string_id_call.struct_size = sizeof(string_id_call);
  string_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  string_id_call.operation_id = UINT64_C(0x33e94a15a1f26ac7);
  string_id_call.arguments = &string_id_argument;
  string_id_call.argument_count = 1;
  LB_CEF3_RESULT_V4 string_id_result{};
  string_id_result.struct_size = sizeof(string_id_result);
  assert(LB_CEF3_InvokeV4(&string_id_call, &string_id_result) == LB_CEF3_OK);
  assert(string_id_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(string_id_result.integer_value == -1);
  LB_CEF3_ARGUMENT_V4 directory_argument{};
  directory_argument.struct_size = sizeof(directory_argument);
  directory_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  directory_argument.text_value = existing_directory.c_str();
  LB_CEF3_CALL_V4 directory_call{};
  directory_call.struct_size = sizeof(directory_call);
  directory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  directory_call.operation_id = UINT64_C(0x2ec8d5647d0276d1);
  directory_call.arguments = &directory_argument;
  directory_call.argument_count = 1;
  LB_CEF3_RESULT_V4 directory_result{};
  directory_result.struct_size = sizeof(directory_result);
  assert(LB_CEF3_InvokeV4(&directory_call, &directory_result) == LB_CEF3_OK);
  assert(directory_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(directory_result.integer_value == 1);
  LB_CEF3_ARGUMENT_V4 create_directory_argument{};
  create_directory_argument.struct_size = sizeof(create_directory_argument);
  create_directory_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  const auto created_directory_v4 = root / L"directory-created-v4";
  create_directory_argument.text_value = created_directory_v4.c_str();
  LB_CEF3_CALL_V4 create_directory_call{};
  create_directory_call.struct_size = sizeof(create_directory_call);
  create_directory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_directory_call.operation_id = UINT64_C(0xd1903b305654b7d1);
  create_directory_call.arguments = &create_directory_argument;
  create_directory_call.argument_count = 1;
  LB_CEF3_RESULT_V4 create_directory_result{};
  create_directory_result.struct_size = sizeof(create_directory_result);
  assert(LB_CEF3_InvokeV4(&create_directory_call, &create_directory_result) == LB_CEF3_OK);
  assert(create_directory_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(create_directory_result.integer_value == 1);
  const auto delete_file_path = root / L"delete-file.txt";
  { std::ofstream file(delete_file_path); file << "delete"; }
  assert(LB_CEF3_DeleteFile(delete_file_path.c_str(), 0) == 1);
  assert(!std::filesystem::exists(delete_file_path));
  const auto delete_tree = root / L"delete-tree";
  std::filesystem::create_directories(delete_tree / L"nested");
  { std::ofstream file(delete_tree / L"nested" / L"value.txt"); file << "delete"; }
  assert(LB_CEF3_DeleteFile(delete_tree.c_str(), 1) == 1);
  assert(!std::filesystem::exists(delete_tree));
  assert(LB_CEF3_DeleteFile((root / L"delete-missing.txt").c_str(), 0) == 1);
  const auto v4_delete_file = root / L"v4-delete.txt";
  { std::ofstream file(v4_delete_file); file << "delete"; }
  LB_CEF3_ARGUMENT_V4 delete_file_arguments[2]{};
  delete_file_arguments[0].struct_size = sizeof(delete_file_arguments[0]);
  delete_file_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  delete_file_arguments[0].text_value = v4_delete_file.c_str();
  delete_file_arguments[1].struct_size = sizeof(delete_file_arguments[1]);
  delete_file_arguments[1].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  delete_file_arguments[1].integer_value = 0;
  LB_CEF3_CALL_V4 delete_file_call{};
  delete_file_call.struct_size = sizeof(delete_file_call);
  delete_file_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  delete_file_call.operation_id = UINT64_C(0x27694ffa27193f64);
  delete_file_call.arguments = delete_file_arguments;
  delete_file_call.argument_count = 2;
  LB_CEF3_RESULT_V4 delete_file_result{};
  delete_file_result.struct_size = sizeof(delete_file_result);
  assert(LB_CEF3_InvokeV4(&delete_file_call, &delete_file_result) == LB_CEF3_OK);
  assert(delete_file_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(delete_file_result.integer_value == 1);
  std::array<wchar_t, 32768> temp_directory{};
  size_t temp_directory_required = 0;
  assert(LB_CEF3_GetTempDirectory(temp_directory.data(), temp_directory.size(), &temp_directory_required) == LB_CEF3_OK);
  assert(temp_directory_required > 1);
  LB_CEF3_CALL_V4 get_temp_directory_call{};
  get_temp_directory_call.struct_size = sizeof(get_temp_directory_call);
  get_temp_directory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  get_temp_directory_call.operation_id = UINT64_C(0x8f1dfe3b14f80b61);
  LB_CEF3_RESULT_V4 get_temp_directory_result{};
  get_temp_directory_result.struct_size = sizeof(get_temp_directory_result);
  assert(LB_CEF3_InvokeV4(&get_temp_directory_call, &get_temp_directory_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring temp_directory_v4(get_temp_directory_result.text_required, L'\0');
  get_temp_directory_result.text = temp_directory_v4.data();
  get_temp_directory_result.text_capacity = temp_directory_v4.size();
  assert(LB_CEF3_InvokeV4(&get_temp_directory_call, &get_temp_directory_result) == LB_CEF3_OK);
  assert(get_temp_directory_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(!temp_directory_v4.empty() && temp_directory_v4.front() != L'\0');
  std::array<wchar_t, 32768> created_temp_directory{};
  size_t created_temp_directory_required = 0;
  assert(LB_CEF3_CreateNewTempDirectory(L"lingbuilder-cef3-", created_temp_directory.data(),
                                         created_temp_directory.size(), &created_temp_directory_required)
      == LB_CEF3_OK);
  assert(std::filesystem::is_directory(created_temp_directory.data()));
  LB_CEF3_ARGUMENT_V4 create_temp_directory_argument{};
  create_temp_directory_argument.struct_size = sizeof(create_temp_directory_argument);
  create_temp_directory_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  create_temp_directory_argument.text_value = L"lingbuilder-cef3-v4-";
  LB_CEF3_CALL_V4 create_temp_directory_call{};
  create_temp_directory_call.struct_size = sizeof(create_temp_directory_call);
  create_temp_directory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  create_temp_directory_call.operation_id = UINT64_C(0x0c1a16881e9ec313);
  create_temp_directory_call.arguments = &create_temp_directory_argument;
  create_temp_directory_call.argument_count = 1;
  LB_CEF3_RESULT_V4 create_temp_directory_result{};
  create_temp_directory_result.struct_size = sizeof(create_temp_directory_result);
  assert(LB_CEF3_InvokeV4(&create_temp_directory_call, &create_temp_directory_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring created_temp_directory_v4(create_temp_directory_result.text_required, L'\0');
  create_temp_directory_result.text = created_temp_directory_v4.data();
  create_temp_directory_result.text_capacity = created_temp_directory_v4.size();
  assert(LB_CEF3_InvokeV4(&create_temp_directory_call, &create_temp_directory_result) == LB_CEF3_OK);
  assert(create_temp_directory_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::filesystem::is_directory(created_temp_directory_v4));
  std::error_code temp_cleanup_error;
  std::filesystem::remove_all(created_temp_directory.data(), temp_cleanup_error);
  std::filesystem::remove_all(created_temp_directory_v4, temp_cleanup_error);
  const auto temp_parent = root / L"temp-parent";
  std::filesystem::create_directories(temp_parent);
  std::array<wchar_t, 32768> nested_temp_directory{};
  size_t nested_temp_directory_required = 0;
  assert(LB_CEF3_CreateTempDirectoryInDirectory(temp_parent.c_str(), L"nested-cef3-",
                                                 nested_temp_directory.data(), nested_temp_directory.size(),
                                                 &nested_temp_directory_required) == LB_CEF3_OK);
  assert(std::filesystem::is_directory(nested_temp_directory.data()));
  LB_CEF3_ARGUMENT_V4 nested_temp_arguments[2]{};
  nested_temp_arguments[0].struct_size = sizeof(nested_temp_arguments[0]);
  nested_temp_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  nested_temp_arguments[0].text_value = temp_parent.c_str();
  nested_temp_arguments[1].struct_size = sizeof(nested_temp_arguments[1]);
  nested_temp_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  nested_temp_arguments[1].text_value = L"nested-v4-";
  LB_CEF3_CALL_V4 nested_temp_call{};
  nested_temp_call.struct_size = sizeof(nested_temp_call);
  nested_temp_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  nested_temp_call.operation_id = UINT64_C(0x564b938cdf1e33f2);
  nested_temp_call.arguments = nested_temp_arguments;
  nested_temp_call.argument_count = 2;
  LB_CEF3_RESULT_V4 nested_temp_result{};
  nested_temp_result.struct_size = sizeof(nested_temp_result);
  assert(LB_CEF3_InvokeV4(&nested_temp_call, &nested_temp_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring nested_temp_directory_v4(nested_temp_result.text_required, L'\0');
  nested_temp_result.text = nested_temp_directory_v4.data();
  nested_temp_result.text_capacity = nested_temp_directory_v4.size();
  assert(LB_CEF3_InvokeV4(&nested_temp_call, &nested_temp_result) == LB_CEF3_OK);
  assert(nested_temp_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::filesystem::is_directory(nested_temp_directory_v4));
  std::filesystem::remove_all(nested_temp_directory.data(), temp_cleanup_error);
  std::filesystem::remove_all(nested_temp_directory_v4, temp_cleanup_error);
  const auto zip_source = root / L"zip-source";
  const auto zip_destination = root / L"zip-output.zip";
  std::filesystem::create_directories(zip_source);
  { std::ofstream file(zip_source / L"value.txt"); file << "zip-value"; }
  assert(LB_CEF3_ZipDirectory(zip_source.c_str(), zip_destination.c_str(), 0) == 1);
  assert(std::filesystem::is_regular_file(zip_destination));
  assert(std::filesystem::file_size(zip_destination) > 0);
  const auto zip_destination_v4 = root / L"zip-output-v4.zip";
  LB_CEF3_ARGUMENT_V4 zip_arguments[3]{};
  zip_arguments[0].struct_size = sizeof(zip_arguments[0]);
  zip_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  zip_arguments[0].text_value = zip_source.c_str();
  zip_arguments[1].struct_size = sizeof(zip_arguments[1]);
  zip_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  zip_arguments[1].text_value = zip_destination_v4.c_str();
  zip_arguments[2].struct_size = sizeof(zip_arguments[2]);
  zip_arguments[2].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  zip_arguments[2].integer_value = 0;
  LB_CEF3_CALL_V4 zip_call{};
  zip_call.struct_size = sizeof(zip_call);
  zip_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  zip_call.operation_id = UINT64_C(0x84e7346ac1e2839e);
  zip_call.arguments = zip_arguments;
  zip_call.argument_count = 3;
  LB_CEF3_RESULT_V4 zip_result{};
  zip_result.struct_size = sizeof(zip_result);
  assert(LB_CEF3_InvokeV4(&zip_call, &zip_result) == LB_CEF3_OK);
  assert(zip_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(zip_result.integer_value == 1);
  assert(std::filesystem::is_regular_file(zip_destination_v4));
  assert(LB_CEF3_DeleteFile(zip_destination.c_str(), 0) == 1);
  assert(LB_CEF3_DeleteFile(zip_destination_v4.c_str(), 0) == 1);
  assert(LB_CEF3_DeleteFile(zip_source.c_str(), 1) == 1);
  const auto crlsets_file = root / L"crlsets.dat";
  { std::ofstream file(crlsets_file, std::ios::binary); file << ""; }
  assert(LB_CEF3_LoadCrlsetsFile(crlsets_file.c_str()) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 crlsets_argument{};
  crlsets_argument.struct_size = sizeof(crlsets_argument);
  crlsets_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  crlsets_argument.text_value = crlsets_file.c_str();
  LB_CEF3_CALL_V4 crlsets_call{};
  crlsets_call.struct_size = sizeof(crlsets_call);
  crlsets_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  crlsets_call.operation_id = UINT64_C(0x9cda66117bb3a49f);
  crlsets_call.arguments = &crlsets_argument;
  crlsets_call.argument_count = 1;
  LB_CEF3_RESULT_V4 crlsets_result{};
  crlsets_result.struct_size = sizeof(crlsets_result);
  assert(LB_CEF3_InvokeV4(&crlsets_call, &crlsets_result) == LB_CEF3_OK);
  assert(crlsets_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  std::array<wchar_t, 32768> cef_temp_path{};
  size_t cef_temp_path_required = 0;
  assert(LB_CEF3_GetPath(3, cef_temp_path.data(), cef_temp_path.size(), &cef_temp_path_required) == LB_CEF3_OK);
  assert(cef_temp_path_required > 1);
  LB_CEF3_ARGUMENT_V4 get_path_argument{};
  get_path_argument.struct_size = sizeof(get_path_argument);
  get_path_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  get_path_argument.integer_value = 3;
  LB_CEF3_CALL_V4 get_path_call{};
  get_path_call.struct_size = sizeof(get_path_call);
  get_path_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  get_path_call.operation_id = UINT64_C(0x3672f1fa01ef57a7);
  get_path_call.arguments = &get_path_argument;
  get_path_call.argument_count = 1;
  LB_CEF3_RESULT_V4 get_path_result{};
  get_path_result.struct_size = sizeof(get_path_result);
  assert(LB_CEF3_InvokeV4(&get_path_call, &get_path_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring cef_temp_path_v4(get_path_result.text_required, L'\0');
  get_path_result.text = cef_temp_path_v4.data();
  get_path_result.text_capacity = cef_temp_path_v4.size();
  assert(LB_CEF3_InvokeV4(&get_path_call, &get_path_result) == LB_CEF3_OK);
  assert(get_path_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(!cef_temp_path_v4.empty() && cef_temp_path_v4.front() != L'\0');
  assert(LB_CEF3_CurrentlyOn(0) >= 0);
  assert(LB_CEF3_CurrentlyOn(-1) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 currently_on_argument{};
  currently_on_argument.struct_size = sizeof(currently_on_argument);
  currently_on_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  currently_on_argument.integer_value = 0;
  LB_CEF3_CALL_V4 currently_on_call{};
  currently_on_call.struct_size = sizeof(currently_on_call);
  currently_on_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  currently_on_call.operation_id = UINT64_C(0xc13a00190ec5db58);
  currently_on_call.arguments = &currently_on_argument;
  currently_on_call.argument_count = 1;
  LB_CEF3_RESULT_V4 currently_on_result{};
  currently_on_result.struct_size = sizeof(currently_on_result);
  assert(LB_CEF3_InvokeV4(&currently_on_call, &currently_on_result) == LB_CEF3_OK);
  assert(currently_on_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(currently_on_result.integer_value == 0 || currently_on_result.integer_value == 1);
  const auto task_manager = LB_CEF3_TaskManagerGet();
  assert(task_manager != 0);
  assert(LB_CEF3_HandleGetType(task_manager) == LB_CEF3_HANDLE_TASK_MANAGER);
  assert(LB_CEF3_HandleIsValid(task_manager, LB_CEF3_HANDLE_TASK_MANAGER) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(task_manager) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 task_manager_call{};
  task_manager_call.struct_size = sizeof(task_manager_call);
  task_manager_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_manager_call.operation_id = UINT64_C(0x86b2ae413d9dce73);
  LB_CEF3_RESULT_V4 task_manager_result{};
  task_manager_result.struct_size = sizeof(task_manager_result);
  assert(LB_CEF3_InvokeV4(&task_manager_call, &task_manager_result) == LB_CEF3_OK);
  assert(task_manager_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(task_manager_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(task_manager_result.handle_value) == LB_CEF3_HANDLE_TASK_MANAGER);
  assert(LB_CEF3_TaskManagerGetTasksCount(task_manager_result.handle_value) >= 0);
  LB_CEF3_CALL_V4 task_count_call{};
  task_count_call.struct_size = sizeof(task_count_call);
  task_count_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_count_call.operation_id = UINT64_C(0xed881d8d39dfbdbd);
  task_count_call.target = task_manager_result.handle_value;
  LB_CEF3_RESULT_V4 task_count_result{};
  task_count_result.struct_size = sizeof(task_count_result);
  assert(LB_CEF3_InvokeV4(&task_count_call, &task_count_result) == LB_CEF3_OK);
  assert(task_count_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(task_count_result.integer_value >= 0);
  size_t task_ids_required = 0;
  assert(LB_CEF3_TaskManagerGetTaskIdsList(
      task_manager_result.handle_value, nullptr, 0, &task_ids_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  assert(task_ids_required > 0);
  std::wstring task_ids(task_ids_required, L'\0');
  assert(LB_CEF3_TaskManagerGetTaskIdsList(
      task_manager_result.handle_value, task_ids.data(), task_ids.size(), &task_ids_required)
      == LB_CEF3_OK);
  task_ids.resize(wcslen(task_ids.c_str()));
  assert(!task_ids.empty() && task_ids.front() == L'[' && task_ids.back() == L']');
  LB_CEF3_CALL_V4 task_ids_call{};
  task_ids_call.struct_size = sizeof(task_ids_call);
  task_ids_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_ids_call.operation_id = UINT64_C(0x3d6dd230d002c50b);
  task_ids_call.target = task_manager_result.handle_value;
  LB_CEF3_RESULT_V4 task_ids_result{};
  task_ids_result.struct_size = sizeof(task_ids_result);
  assert(LB_CEF3_InvokeV4(&task_ids_call, &task_ids_result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring task_ids_v4(task_ids_result.text_required, L'\0');
  task_ids_result.text = task_ids_v4.data();
  task_ids_result.text_capacity = task_ids_v4.size();
  assert(LB_CEF3_InvokeV4(&task_ids_call, &task_ids_result) == LB_CEF3_OK);
  task_ids_v4.resize(wcslen(task_ids_v4.c_str()));
  assert(task_ids_result.value_kind == LB_CEF3_VALUE_V4_JSON);
  assert(!task_ids_v4.empty() && task_ids_v4.front() == L'[' && task_ids_v4.back() == L']');
  assert(LB_CEF3_TaskManagerGetTaskIdForBrowserId(task_manager_result.handle_value, -1) == -1);
  LB_CEF3_ARGUMENT_V4 browser_id_argument{};
  browser_id_argument.struct_size = sizeof(browser_id_argument);
  browser_id_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  browser_id_argument.integer_value = -1;
  LB_CEF3_CALL_V4 browser_task_id_call{};
  browser_task_id_call.struct_size = sizeof(browser_task_id_call);
  browser_task_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  browser_task_id_call.operation_id = UINT64_C(0xc7d4330ab977f1e7);
  browser_task_id_call.target = task_manager_result.handle_value;
  browser_task_id_call.arguments = &browser_id_argument;
  browser_task_id_call.argument_count = 1;
  LB_CEF3_RESULT_V4 browser_task_id_result{};
  browser_task_id_result.struct_size = sizeof(browser_task_id_result);
  assert(LB_CEF3_InvokeV4(&browser_task_id_call, &browser_task_id_result) == LB_CEF3_OK);
  assert(browser_task_id_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(browser_task_id_result.integer_value == -1);
  assert(LB_CEF3_TaskManagerKillTask(task_manager_result.handle_value, -1) == 0);
  LB_CEF3_ARGUMENT_V4 kill_task_argument{};
  kill_task_argument.struct_size = sizeof(kill_task_argument);
  kill_task_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  kill_task_argument.integer_value = -1;
  LB_CEF3_CALL_V4 kill_task_call{};
  kill_task_call.struct_size = sizeof(kill_task_call);
  kill_task_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  kill_task_call.operation_id = UINT64_C(0x7f91c46dd5ec851c);
  kill_task_call.target = task_manager_result.handle_value;
  kill_task_call.arguments = &kill_task_argument;
  kill_task_call.argument_count = 1;
  LB_CEF3_RESULT_V4 kill_task_result{};
  kill_task_result.struct_size = sizeof(kill_task_result);
  assert(LB_CEF3_InvokeV4(&kill_task_call, &kill_task_result) == LB_CEF3_OK);
  assert(kill_task_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(kill_task_result.integer_value == 0);
  size_t task_info_required = 0;
  assert(LB_CEF3_TaskManagerGetTaskInfo(
      task_manager_result.handle_value, -1, nullptr, 0, &task_info_required)
      == LB_CEF3_ERROR_NOT_FOUND);
  LB_CEF3_ARGUMENT_V4 task_info_id_argument{};
  task_info_id_argument.struct_size = sizeof(task_info_id_argument);
  task_info_id_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  task_info_id_argument.integer_value = -1;
  LB_CEF3_CALL_V4 task_info_call{};
  task_info_call.struct_size = sizeof(task_info_call);
  task_info_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_info_call.operation_id = UINT64_C(0xeff979042c251a2b);
  task_info_call.target = task_manager_result.handle_value;
  task_info_call.arguments = &task_info_id_argument;
  task_info_call.argument_count = 1;
  LB_CEF3_RESULT_V4 task_info_result{};
  task_info_result.struct_size = sizeof(task_info_result);
  assert(LB_CEF3_InvokeV4(&task_info_call, &task_info_result) == LB_CEF3_ERROR_NOT_FOUND);
  assert(LB_CEF3_HandleRelease(task_manager_result.handle_value) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-current-start\n");
  std::fflush(stderr);
  const auto current_task_runner = LB_CEF3_TaskRunnerGetForCurrentThread();
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-current-direct=%llu\n",
               static_cast<unsigned long long>(current_task_runner));
  std::fflush(stderr);
  if (current_task_runner != 0) {
    assert(LB_CEF3_HandleGetType(current_task_runner) == LB_CEF3_HANDLE_TASK_RUNNER);
    assert(LB_CEF3_HandleRelease(current_task_runner) == LB_CEF3_OK);
  }
  LB_CEF3_CALL_V4 current_task_runner_call{};
  current_task_runner_call.struct_size = sizeof(current_task_runner_call);
  current_task_runner_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  current_task_runner_call.operation_id = UINT64_C(0x1b315d26988a89b0);
  LB_CEF3_RESULT_V4 current_task_runner_result{};
  current_task_runner_result.struct_size = sizeof(current_task_runner_result);
  const int current_task_runner_status = LB_CEF3_InvokeV4(
      &current_task_runner_call, &current_task_runner_result);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-current-v4=%d\n",
               current_task_runner_status);
  std::fflush(stderr);
  assert(current_task_runner_status == LB_CEF3_OK
      || current_task_runner_status == LB_CEF3_ERROR_OPERATION_FAILED);
  if (current_task_runner_status == LB_CEF3_OK) {
    assert(current_task_runner_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(LB_CEF3_HandleGetType(current_task_runner_result.handle_value)
        == LB_CEF3_HANDLE_TASK_RUNNER);
    assert(LB_CEF3_HandleRelease(current_task_runner_result.handle_value) == LB_CEF3_OK);
  }
  const auto ui_task_runner = LB_CEF3_TaskRunnerGetForThread(0);
  assert(ui_task_runner != 0);
  assert(LB_CEF3_HandleGetType(ui_task_runner) == LB_CEF3_HANDLE_TASK_RUNNER);
  assert(LB_CEF3_TaskRunnerBelongsToCurrentThread(ui_task_runner) == 0);
  assert(LB_CEF3_TaskRunnerBelongsToThread(ui_task_runner, 0) == 1);
  assert(LB_CEF3_TaskRunnerBelongsToThread(ui_task_runner, -1) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  LB_CEF3_ARGUMENT_V4 task_runner_belongs_thread_argument{};
  task_runner_belongs_thread_argument.struct_size = sizeof(task_runner_belongs_thread_argument);
  task_runner_belongs_thread_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  task_runner_belongs_thread_argument.integer_value = 0;
  LB_CEF3_CALL_V4 task_runner_belongs_thread_call{};
  task_runner_belongs_thread_call.struct_size = sizeof(task_runner_belongs_thread_call);
  task_runner_belongs_thread_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_runner_belongs_thread_call.operation_id = UINT64_C(0xa911193867b2722c);
  task_runner_belongs_thread_call.target = ui_task_runner;
  task_runner_belongs_thread_call.arguments = &task_runner_belongs_thread_argument;
  task_runner_belongs_thread_call.argument_count = 1;
  LB_CEF3_RESULT_V4 task_runner_belongs_thread_result{};
  task_runner_belongs_thread_result.struct_size = sizeof(task_runner_belongs_thread_result);
  assert(LB_CEF3_InvokeV4(&task_runner_belongs_thread_call, &task_runner_belongs_thread_result)
      == LB_CEF3_OK);
  assert(task_runner_belongs_thread_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(task_runner_belongs_thread_result.integer_value == 1);
  const auto same_ui_task_runner = LB_CEF3_TaskRunnerGetForThread(0);
  assert(same_ui_task_runner != 0);
  assert(LB_CEF3_TaskRunnerIsSame(ui_task_runner, same_ui_task_runner) == 1);
  LB_CEF3_ARGUMENT_V4 task_runner_same_argument{};
  task_runner_same_argument.struct_size = sizeof(task_runner_same_argument);
  task_runner_same_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  task_runner_same_argument.handle_value = same_ui_task_runner;
  LB_CEF3_CALL_V4 task_runner_same_call{};
  task_runner_same_call.struct_size = sizeof(task_runner_same_call);
  task_runner_same_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_runner_same_call.operation_id = UINT64_C(0x6ab151d7a19a2055);
  task_runner_same_call.target = ui_task_runner;
  task_runner_same_call.arguments = &task_runner_same_argument;
  task_runner_same_call.argument_count = 1;
  LB_CEF3_RESULT_V4 task_runner_same_result{};
  task_runner_same_result.struct_size = sizeof(task_runner_same_result);
  assert(LB_CEF3_InvokeV4(&task_runner_same_call, &task_runner_same_result) == LB_CEF3_OK);
  assert(task_runner_same_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(task_runner_same_result.integer_value == 1);
  assert(LB_CEF3_HandleRelease(same_ui_task_runner) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-identity\n");
  std::fflush(stderr);
  const auto delayed_task = LB_CEF3_TaskCreate();
  assert(delayed_task != 0);
  assert(LB_CEF3_TaskRunnerPostDelayedTask(ui_task_runner, delayed_task, 25) == 1);
  assert(LB_CEF3_TaskGetStatus(delayed_task) == LB_CEF3_TASK_RUNNING);
  assert(WaitTask(delayed_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(delayed_task).find(L"scheduled") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(delayed_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-delayed\n");
  std::fflush(stderr);
  const auto posted_task = LB_CEF3_TaskCreate();
  assert(posted_task != 0);
  assert(LB_CEF3_TaskRunnerPostTask(ui_task_runner, posted_task) == 1);
  assert(LB_CEF3_TaskGetStatus(posted_task) == LB_CEF3_TASK_RUNNING);
  assert(WaitTask(posted_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(posted_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-posted\n");
  std::fflush(stderr);
  const auto posted_v4_task = LB_CEF3_TaskCreate();
  assert(posted_v4_task != 0);
  LB_CEF3_ARGUMENT_V4 posted_task_argument{};
  posted_task_argument.struct_size = sizeof(posted_task_argument);
  posted_task_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  posted_task_argument.handle_value = posted_v4_task;
  LB_CEF3_CALL_V4 posted_call{};
  posted_call.struct_size = sizeof(posted_call);
  posted_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  posted_call.operation_id = UINT64_C(0xd352efa614d7f2f7);
  posted_call.target = ui_task_runner;
  posted_call.arguments = &posted_task_argument;
  posted_call.argument_count = 1;
  LB_CEF3_RESULT_V4 posted_result{};
  posted_result.struct_size = sizeof(posted_result);
  assert(LB_CEF3_InvokeV4(&posted_call, &posted_result) == LB_CEF3_OK);
  assert(posted_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(posted_result.integer_value == 1);
  assert(WaitTask(posted_v4_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(posted_v4_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-posted-v4\n");
  std::fflush(stderr);
  const auto delayed_v4_task = LB_CEF3_TaskCreate();
  assert(delayed_v4_task != 0);
  LB_CEF3_ARGUMENT_V4 delayed_task_argument{};
  delayed_task_argument.struct_size = sizeof(delayed_task_argument);
  delayed_task_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  delayed_task_argument.handle_value = delayed_v4_task;
  LB_CEF3_ARGUMENT_V4 delayed_ms_argument{};
  delayed_ms_argument.struct_size = sizeof(delayed_ms_argument);
  delayed_ms_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  delayed_ms_argument.integer_value = 25;
  const std::array<LB_CEF3_ARGUMENT_V4, 2> delayed_arguments = {
      delayed_task_argument, delayed_ms_argument};
  LB_CEF3_CALL_V4 delayed_call{};
  delayed_call.struct_size = sizeof(delayed_call);
  delayed_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  delayed_call.operation_id = UINT64_C(0x53fe4c619bae8f4a);
  delayed_call.target = ui_task_runner;
  delayed_call.arguments = delayed_arguments.data();
  delayed_call.argument_count = delayed_arguments.size();
  LB_CEF3_RESULT_V4 delayed_result{};
  delayed_result.struct_size = sizeof(delayed_result);
  assert(LB_CEF3_InvokeV4(&delayed_call, &delayed_result) == LB_CEF3_OK);
  assert(delayed_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(delayed_result.integer_value == 1);
  assert(WaitTask(delayed_v4_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(delayed_v4_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-delayed-v4\n");
  std::fflush(stderr);
  const auto invalid_delayed_task = LB_CEF3_TaskCreate();
  assert(invalid_delayed_task != 0);
  assert(LB_CEF3_TaskRunnerPostDelayedTask(ui_task_runner, invalid_delayed_task, -1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TaskGetStatus(invalid_delayed_task) == LB_CEF3_TASK_PENDING);
  assert(LB_CEF3_TaskRelease(invalid_delayed_task) == LB_CEF3_OK);
  const auto global_delayed_task = LB_CEF3_TaskCreate();
  assert(global_delayed_task != 0);
  assert(LB_CEF3_PostDelayedTask(0, global_delayed_task, 25) == 1);
  assert(WaitTask(global_delayed_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(global_delayed_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-global-delayed\n");
  std::fflush(stderr);
  const auto global_posted_task = LB_CEF3_TaskCreate();
  assert(global_posted_task != 0);
  assert(LB_CEF3_PostTask(0, global_posted_task) == 1);
  assert(WaitTask(global_posted_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(global_posted_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-global-posted\n");
  std::fflush(stderr);
  const auto global_posted_v4_task = LB_CEF3_TaskCreate();
  assert(global_posted_v4_task != 0);
  LB_CEF3_ARGUMENT_V4 global_posted_thread_argument{};
  global_posted_thread_argument.struct_size = sizeof(global_posted_thread_argument);
  global_posted_thread_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  global_posted_thread_argument.integer_value = 0;
  LB_CEF3_ARGUMENT_V4 global_posted_task_argument{};
  global_posted_task_argument.struct_size = sizeof(global_posted_task_argument);
  global_posted_task_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  global_posted_task_argument.handle_value = global_posted_v4_task;
  const std::array<LB_CEF3_ARGUMENT_V4, 2> global_posted_arguments = {
      global_posted_thread_argument, global_posted_task_argument};
  LB_CEF3_CALL_V4 global_posted_call{};
  global_posted_call.struct_size = sizeof(global_posted_call);
  global_posted_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  global_posted_call.operation_id = UINT64_C(0xf0b826dc33e1b663);
  global_posted_call.arguments = global_posted_arguments.data();
  global_posted_call.argument_count = global_posted_arguments.size();
  LB_CEF3_RESULT_V4 global_posted_result{};
  global_posted_result.struct_size = sizeof(global_posted_result);
  assert(LB_CEF3_InvokeV4(&global_posted_call, &global_posted_result) == LB_CEF3_OK);
  assert(global_posted_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(global_posted_result.integer_value == 1);
  assert(WaitTask(global_posted_v4_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(global_posted_v4_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-global-posted-v4\n");
  std::fflush(stderr);
  const auto global_delayed_v4_task = LB_CEF3_TaskCreate();
  assert(global_delayed_v4_task != 0);
  LB_CEF3_ARGUMENT_V4 global_thread_argument{};
  global_thread_argument.struct_size = sizeof(global_thread_argument);
  global_thread_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  global_thread_argument.integer_value = 0;
  LB_CEF3_ARGUMENT_V4 global_task_argument{};
  global_task_argument.struct_size = sizeof(global_task_argument);
  global_task_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  global_task_argument.handle_value = global_delayed_v4_task;
  LB_CEF3_ARGUMENT_V4 global_delay_argument{};
  global_delay_argument.struct_size = sizeof(global_delay_argument);
  global_delay_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  global_delay_argument.integer_value = 25;
  const std::array<LB_CEF3_ARGUMENT_V4, 3> global_delayed_arguments = {
      global_thread_argument, global_task_argument, global_delay_argument};
  LB_CEF3_CALL_V4 global_delayed_call{};
  global_delayed_call.struct_size = sizeof(global_delayed_call);
  global_delayed_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  global_delayed_call.operation_id = UINT64_C(0xd3dfef9cbf4fa75d);
  global_delayed_call.arguments = global_delayed_arguments.data();
  global_delayed_call.argument_count = global_delayed_arguments.size();
  LB_CEF3_RESULT_V4 global_delayed_result{};
  global_delayed_result.struct_size = sizeof(global_delayed_result);
  assert(LB_CEF3_InvokeV4(&global_delayed_call, &global_delayed_result) == LB_CEF3_OK);
  assert(global_delayed_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(global_delayed_result.integer_value == 1);
  assert(WaitTask(global_delayed_v4_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(global_delayed_v4_task) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: task-runner-global-delayed-v4\n");
  std::fflush(stderr);
  const auto invalid_global_delayed_task = LB_CEF3_TaskCreate();
  assert(invalid_global_delayed_task != 0);
  assert(LB_CEF3_PostDelayedTask(-1, invalid_global_delayed_task, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_TaskRelease(invalid_global_delayed_task) == LB_CEF3_OK);
  std::array<wchar_t, 32> component_id{};
  size_t component_id_required = 0;
  assert(LB_CEF3_ComponentGetId(0, component_id.data(), component_id.size(),
                                &component_id_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 component_id_call{};
  component_id_call.struct_size = sizeof(component_id_call);
  component_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  component_id_call.operation_id = UINT64_C(0x41e8982807add673);
  component_id_call.target = 0;
  std::array<wchar_t, 32> component_id_v4{};
  LB_CEF3_RESULT_V4 component_id_result{};
  component_id_result.struct_size = sizeof(component_id_result);
  component_id_result.text = component_id_v4.data();
  component_id_result.text_capacity = component_id_v4.size();
  assert(LB_CEF3_InvokeV4(&component_id_call, &component_id_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  std::array<wchar_t, 32> component_name{};
  size_t component_name_required = 0;
  assert(LB_CEF3_ComponentGetName(0, component_name.data(), component_name.size(),
                                  &component_name_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 component_name_call = component_id_call;
  component_name_call.operation_id = UINT64_C(0x3421c94d4653db9e);
  LB_CEF3_RESULT_V4 component_name_result{};
  component_name_result.struct_size = sizeof(component_name_result);
  component_name_result.text = component_name.data();
  component_name_result.text_capacity = component_name.size();
  assert(LB_CEF3_InvokeV4(&component_name_call, &component_name_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ComponentGetState(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 component_state_call = component_id_call;
  component_state_call.operation_id = UINT64_C(0xb29b8ffe1e1b2b87);
  LB_CEF3_RESULT_V4 component_state_result{};
  component_state_result.struct_size = sizeof(component_state_result);
  assert(LB_CEF3_InvokeV4(&component_state_call, &component_state_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  std::array<wchar_t, 32> component_version{};
  size_t component_version_required = 0;
  assert(LB_CEF3_ComponentGetVersion(0, component_version.data(), component_version.size(),
                                     &component_version_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 component_version_call = component_id_call;
  component_version_call.operation_id = UINT64_C(0x82d14a9a2296ccbb);
  LB_CEF3_RESULT_V4 component_version_result{};
  component_version_result.struct_size = sizeof(component_version_result);
  component_version_result.text = component_version.data();
  component_version_result.text_capacity = component_version.size();
  assert(LB_CEF3_InvokeV4(&component_version_call, &component_version_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  LB_CEF3_CALL_V4 task_runner_belongs_call{};
  task_runner_belongs_call.struct_size = sizeof(task_runner_belongs_call);
  task_runner_belongs_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_runner_belongs_call.operation_id = UINT64_C(0xb8b44c13b175743d);
  task_runner_belongs_call.target = ui_task_runner;
  LB_CEF3_RESULT_V4 task_runner_belongs_result{};
  task_runner_belongs_result.struct_size = sizeof(task_runner_belongs_result);
  assert(LB_CEF3_InvokeV4(&task_runner_belongs_call, &task_runner_belongs_result) == LB_CEF3_OK);
  assert(task_runner_belongs_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(task_runner_belongs_result.integer_value == 0);
  assert(LB_CEF3_HandleRelease(ui_task_runner) == LB_CEF3_OK);
  assert(LB_CEF3_TaskRunnerGetForThread(-1) == 0);
  LB_CEF3_ARGUMENT_V4 task_runner_thread_argument{};
  task_runner_thread_argument.struct_size = sizeof(task_runner_thread_argument);
  task_runner_thread_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  task_runner_thread_argument.integer_value = 0;
  LB_CEF3_CALL_V4 task_runner_thread_call{};
  task_runner_thread_call.struct_size = sizeof(task_runner_thread_call);
  task_runner_thread_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  task_runner_thread_call.operation_id = UINT64_C(0x566eda00d478eef4);
  task_runner_thread_call.arguments = &task_runner_thread_argument;
  task_runner_thread_call.argument_count = 1;
  LB_CEF3_RESULT_V4 task_runner_thread_result{};
  task_runner_thread_result.struct_size = sizeof(task_runner_thread_result);
  assert(LB_CEF3_InvokeV4(&task_runner_thread_call, &task_runner_thread_result) == LB_CEF3_OK);
  assert(task_runner_thread_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(task_runner_thread_result.handle_value)
      == LB_CEF3_HANDLE_TASK_RUNNER);
  assert(LB_CEF3_HandleRelease(task_runner_thread_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_ThreadCreate(L"无效优先级", -1, 0, 1, 0) == 0);
  assert(LB_CEF3_ThreadCreate(L"无效优先级", 4, 0, 1, 0) == 0);
  assert(LB_CEF3_ThreadCreate(L"无效循环", 1, 3, 1, 0) == 0);
  assert(LB_CEF3_ThreadCreate(L"无效停止标志", 1, 0, 2, 0) == 0);
  assert(LB_CEF3_ThreadCreate(L"无效COM", 1, 0, 1, 3) == 0);
  assert(LB_CEF3_ThreadCreate(L"无效STA组合", 1, 0, 1, 1) == 0);
  assert(LB_CEF3_ThreadGetPlatformThreadId(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ThreadGetTaskRunner(0) == 0);
  assert(LB_CEF3_ThreadIsRunning(0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ThreadStop(0) == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto dedicated_thread = LB_CEF3_ThreadCreate(
      L"LingBuilder CEF3 direct thread", LB_CEF3_THREAD_PRIORITY_NORMAL,
      LB_CEF3_MESSAGE_LOOP_DEFAULT, 1, LB_CEF3_COM_INIT_NONE);
  assert(dedicated_thread != 0);
  assert(LB_CEF3_HandleGetType(dedicated_thread) == LB_CEF3_HANDLE_THREAD);
  assert(LB_CEF3_HandleIsValid(dedicated_thread, LB_CEF3_HANDLE_THREAD) == LB_CEF3_OK);
  const auto dedicated_running_deadline = GetTickCount64() + 2000;
  while (LB_CEF3_ThreadIsRunning(dedicated_thread) != 1
      && GetTickCount64() < dedicated_running_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  assert(LB_CEF3_ThreadIsRunning(dedicated_thread) == 1);
  int64_t dedicated_thread_id = 0;
  const auto dedicated_id_deadline = GetTickCount64() + 2000;
  while (dedicated_thread_id == 0 && GetTickCount64() < dedicated_id_deadline) {
    dedicated_thread_id = LB_CEF3_ThreadGetPlatformThreadId(dedicated_thread);
    if (dedicated_thread_id == 0) Sleep(10);
  }
  assert(dedicated_thread_id > 0);
  const auto dedicated_runner = LB_CEF3_ThreadGetTaskRunner(dedicated_thread);
  assert(dedicated_runner != 0);
  assert(LB_CEF3_HandleGetType(dedicated_runner) == LB_CEF3_HANDLE_TASK_RUNNER);
  const auto dedicated_task = LB_CEF3_TaskCreate();
  assert(dedicated_task != 0);
  assert(LB_CEF3_TaskRunnerPostTask(dedicated_runner, dedicated_task) == 1);
  assert(WaitTask(dedicated_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(TaskResult(dedicated_task).find(L"scheduled") != std::wstring::npos);
  assert(LB_CEF3_TaskRelease(dedicated_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(dedicated_runner) == LB_CEF3_OK);
  assert(LB_CEF3_ThreadStop(dedicated_thread) == LB_CEF3_OK);
  assert(LB_CEF3_ThreadStop(dedicated_thread) == LB_CEF3_OK);
  assert(LB_CEF3_ThreadIsRunning(dedicated_thread) == 0);
  assert(LB_CEF3_ThreadGetPlatformThreadId(dedicated_thread) == dedicated_thread_id);
  assert(LB_CEF3_HandleRelease(dedicated_thread) == LB_CEF3_OK);
  assert(LB_CEF3_ThreadIsRunning(dedicated_thread) == LB_CEF3_ERROR_RELEASED_HANDLE);

  LB_CEF3_ARGUMENT_V4 thread_name_argument{};
  thread_name_argument.struct_size = sizeof(thread_name_argument);
  thread_name_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  thread_name_argument.text_value = L"LingBuilder CEF3 v4 thread";
  LB_CEF3_ARGUMENT_V4 thread_priority_argument{};
  thread_priority_argument.struct_size = sizeof(thread_priority_argument);
  thread_priority_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  thread_priority_argument.integer_value = LB_CEF3_THREAD_PRIORITY_NORMAL;
  LB_CEF3_ARGUMENT_V4 thread_loop_argument{};
  thread_loop_argument.struct_size = sizeof(thread_loop_argument);
  thread_loop_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  thread_loop_argument.integer_value = LB_CEF3_MESSAGE_LOOP_DEFAULT;
  LB_CEF3_ARGUMENT_V4 thread_stoppable_argument{};
  thread_stoppable_argument.struct_size = sizeof(thread_stoppable_argument);
  thread_stoppable_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  thread_stoppable_argument.integer_value = 1;
  LB_CEF3_ARGUMENT_V4 thread_com_argument{};
  thread_com_argument.struct_size = sizeof(thread_com_argument);
  thread_com_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  thread_com_argument.integer_value = LB_CEF3_COM_INIT_NONE;
  std::array<LB_CEF3_ARGUMENT_V4, 5> thread_create_arguments = {
      thread_name_argument, thread_priority_argument, thread_loop_argument,
      thread_stoppable_argument, thread_com_argument};
  LB_CEF3_CALL_V4 thread_create_call{};
  thread_create_call.struct_size = sizeof(thread_create_call);
  thread_create_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  thread_create_call.operation_id = UINT64_C(0x3f4f6704b6f138a2);
  thread_create_call.arguments = thread_create_arguments.data();
  thread_create_call.argument_count = thread_create_arguments.size();
  LB_CEF3_RESULT_V4 thread_create_result{};
  thread_create_result.struct_size = sizeof(thread_create_result);
  assert(LB_CEF3_InvokeV4(&thread_create_call, &thread_create_result) == LB_CEF3_OK);
  assert(thread_create_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  const auto v4_thread = thread_create_result.handle_value;
  assert(v4_thread != 0);
  assert(LB_CEF3_HandleGetType(v4_thread) == LB_CEF3_HANDLE_THREAD);

  thread_create_arguments[4].integer_value = LB_CEF3_COM_INIT_STA;
  assert(LB_CEF3_InvokeV4(&thread_create_call, &thread_create_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  thread_create_arguments[4].integer_value = LB_CEF3_COM_INIT_NONE;

  LB_CEF3_CALL_V4 thread_id_call{};
  thread_id_call.struct_size = sizeof(thread_id_call);
  thread_id_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  thread_id_call.operation_id = UINT64_C(0x071443b511a892c1);
  thread_id_call.target = v4_thread;
  int64_t v4_platform_thread_id = 0;
  const auto v4_thread_id_deadline = GetTickCount64() + 2000;
  while (v4_platform_thread_id == 0 && GetTickCount64() < v4_thread_id_deadline) {
    v4_platform_thread_id = LB_CEF3_ThreadGetPlatformThreadId(v4_thread);
    if (v4_platform_thread_id == 0) Sleep(10);
  }
  assert(v4_platform_thread_id > 0);
  LB_CEF3_RESULT_V4 thread_id_result{};
  thread_id_result.struct_size = sizeof(thread_id_result);
  assert(LB_CEF3_InvokeV4(&thread_id_call, &thread_id_result) == LB_CEF3_OK);
  assert(thread_id_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(thread_id_result.integer_value > 0);

  LB_CEF3_CALL_V4 thread_runner_call = thread_id_call;
  thread_runner_call.operation_id = UINT64_C(0xeba2a7c70177d570);
  LB_CEF3_RESULT_V4 thread_runner_result{};
  thread_runner_result.struct_size = sizeof(thread_runner_result);
  assert(LB_CEF3_InvokeV4(&thread_runner_call, &thread_runner_result) == LB_CEF3_OK);
  assert(thread_runner_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(thread_runner_result.handle_value)
      == LB_CEF3_HANDLE_TASK_RUNNER);
  const auto v4_thread_task = LB_CEF3_TaskCreate();
  assert(v4_thread_task != 0);
  assert(LB_CEF3_TaskRunnerPostTask(thread_runner_result.handle_value, v4_thread_task) == 1);
  assert(WaitTask(v4_thread_task, 2000) == LB_CEF3_TASK_SUCCEEDED);
  assert(LB_CEF3_TaskRelease(v4_thread_task) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(thread_runner_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 thread_running_call = thread_id_call;
  thread_running_call.operation_id = UINT64_C(0x9ee144605454d2ec);
  LB_CEF3_RESULT_V4 thread_running_result{};
  thread_running_result.struct_size = sizeof(thread_running_result);
  assert(LB_CEF3_InvokeV4(&thread_running_call, &thread_running_result) == LB_CEF3_OK);
  assert(thread_running_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(thread_running_result.integer_value == 1);

  LB_CEF3_CALL_V4 thread_stop_call = thread_id_call;
  thread_stop_call.operation_id = UINT64_C(0xa0988a7b497478fc);
  LB_CEF3_RESULT_V4 thread_stop_result{};
  thread_stop_result.struct_size = sizeof(thread_stop_result);
  assert(LB_CEF3_InvokeV4(&thread_stop_call, &thread_stop_result) == LB_CEF3_OK);
  assert(thread_stop_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_InvokeV4(&thread_running_call, &thread_running_result) == LB_CEF3_OK);
  assert(thread_running_result.integer_value == 0);
  assert(LB_CEF3_HandleRelease(v4_thread) == LB_CEF3_OK);
  assert(LB_CEF3_InvokeV4(&thread_running_call, &thread_running_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  const auto auto_stop_thread = LB_CEF3_ThreadCreate(
      L"LingBuilder CEF3 auto-stop thread", LB_CEF3_THREAD_PRIORITY_BACKGROUND,
      LB_CEF3_MESSAGE_LOOP_DEFAULT, 1, LB_CEF3_COM_INIT_NONE);
  assert(auto_stop_thread != 0);
  assert(LB_CEF3_HandleRelease(auto_stop_thread) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: platform-dedicated-thread\n");
  std::fflush(stderr);
  const auto waitable_event = LB_CEF3_WaitableEventCreate(1, 0);
  assert(waitable_event != 0);
  assert(LB_CEF3_HandleGetType(waitable_event) == LB_CEF3_HANDLE_WAITABLE_EVENT);
  assert(LB_CEF3_HandleIsValid(waitable_event, LB_CEF3_HANDLE_WAITABLE_EVENT) == LB_CEF3_OK);
  assert(LB_CEF3_WaitableEventReset(waitable_event) == LB_CEF3_OK);
  assert(LB_CEF3_WaitableEventSignal(waitable_event) == LB_CEF3_OK);
  assert(LB_CEF3_WaitableEventIsSignaled(waitable_event) == 1);
  assert(LB_CEF3_WaitableEventTimedWait(waitable_event, 0) == 0);
  assert(LB_CEF3_WaitableEventSignal(waitable_event) == LB_CEF3_OK);
  assert(LB_CEF3_WaitableEventTimedWait(waitable_event, 100) == 1);
  assert(LB_CEF3_WaitableEventTimedWait(waitable_event, -1) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_WaitableEventSignal(waitable_event) == LB_CEF3_OK);
  assert(LB_CEF3_WaitableEventWait(waitable_event) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(waitable_event) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 waitable_auto_reset_argument{};
  waitable_auto_reset_argument.struct_size = sizeof(waitable_auto_reset_argument);
  waitable_auto_reset_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  waitable_auto_reset_argument.integer_value = 1;
  LB_CEF3_ARGUMENT_V4 waitable_initial_argument{};
  waitable_initial_argument.struct_size = sizeof(waitable_initial_argument);
  waitable_initial_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  waitable_initial_argument.integer_value = 0;
  const std::array<LB_CEF3_ARGUMENT_V4, 2> waitable_arguments = {
      waitable_auto_reset_argument, waitable_initial_argument};
  LB_CEF3_CALL_V4 waitable_event_call{};
  waitable_event_call.struct_size = sizeof(waitable_event_call);
  waitable_event_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  waitable_event_call.operation_id = UINT64_C(0x542e2a3025b2ab38);
  waitable_event_call.arguments = waitable_arguments.data();
  waitable_event_call.argument_count = waitable_arguments.size();
  LB_CEF3_RESULT_V4 waitable_event_result{};
  waitable_event_result.struct_size = sizeof(waitable_event_result);
  assert(LB_CEF3_InvokeV4(&waitable_event_call, &waitable_event_result) == LB_CEF3_OK);
  assert(waitable_event_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(waitable_event_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(waitable_event_result.handle_value)
      == LB_CEF3_HANDLE_WAITABLE_EVENT);
  assert(LB_CEF3_WaitableEventReset(waitable_event_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(waitable_event_result.handle_value) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: platform-waitable-event\n");
  std::fflush(stderr);
  const auto component_updater = LB_CEF3_ComponentUpdaterGet();
  if (component_updater != 0) {
    assert(LB_CEF3_HandleGetType(component_updater) == LB_CEF3_HANDLE_COMPONENT_UPDATER);
    assert(LB_CEF3_HandleRelease(component_updater) == LB_CEF3_OK);
  }
  LB_CEF3_CALL_V4 component_updater_call{};
  component_updater_call.struct_size = sizeof(component_updater_call);
  component_updater_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  component_updater_call.operation_id = UINT64_C(0x8417845c29d2871c);
  LB_CEF3_RESULT_V4 component_updater_result{};
  component_updater_result.struct_size = sizeof(component_updater_result);
  assert(LB_CEF3_InvokeV4(&component_updater_call, &component_updater_result) == LB_CEF3_OK);
  assert(component_updater_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  if (component_updater_result.handle_value != 0) {
    assert(LB_CEF3_HandleGetType(component_updater_result.handle_value)
        == LB_CEF3_HANDLE_COMPONENT_UPDATER);
    assert(LB_CEF3_ComponentUpdaterGetComponentCount(component_updater_result.handle_value) >= 0);
    std::array<wchar_t, 8192> component_list{};
    size_t component_list_required = 0;
    const int component_list_status = LB_CEF3_ComponentUpdaterGetComponents(
        component_updater_result.handle_value, component_list.data(), component_list.size(),
        &component_list_required);
    assert(component_list_status == LB_CEF3_OK);
    assert(component_list[0] == L'[');
    LB_CEF3_ARGUMENT_V4 component_list_argument{};
    component_list_argument.struct_size = sizeof(component_list_argument);
    component_list_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
    component_list_argument.handle_value = component_updater_result.handle_value;
    LB_CEF3_CALL_V4 component_list_call{};
    component_list_call.struct_size = sizeof(component_list_call);
    component_list_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    component_list_call.operation_id = UINT64_C(0x36a0804c1bda36cf);
    component_list_call.target = component_updater_result.handle_value;
    component_list_call.arguments = &component_list_argument;
    component_list_call.argument_count = 1;
    LB_CEF3_RESULT_V4 component_list_result{};
    component_list_result.struct_size = sizeof(component_list_result);
    component_list_result.text = component_list.data();
    component_list_result.text_capacity = component_list.size();
    assert(LB_CEF3_InvokeV4(&component_list_call, &component_list_result) == LB_CEF3_OK);
    assert(component_list_result.value_kind == LB_CEF3_VALUE_V4_JSON);
    assert(component_list[0] == L'[');
    LB_CEF3_CALL_V4 component_count_call{};
    component_count_call.struct_size = sizeof(component_count_call);
    component_count_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    component_count_call.operation_id = UINT64_C(0x7a16efc053d7fdfd);
    component_count_call.target = component_updater_result.handle_value;
    LB_CEF3_RESULT_V4 component_count_result{};
    component_count_result.struct_size = sizeof(component_count_result);
    assert(LB_CEF3_InvokeV4(&component_count_call, &component_count_result) == LB_CEF3_OK);
    assert(component_count_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
    assert(component_count_result.integer_value >= 0);
    assert(LB_CEF3_ComponentUpdaterGetComponentById(
               component_updater_result.handle_value, L"LingBuilder.MissingComponent") == 0);
    const auto component_update_task = LB_CEF3_ComponentUpdaterUpdate(
        component_updater_result.handle_value, L"LingBuilder.MissingComponent", 0);
    assert(component_update_task != 0);
    const int component_update_status = WaitTask(component_update_task);
    assert(component_update_status == LB_CEF3_TASK_SUCCEEDED
        || component_update_status == LB_CEF3_TASK_FAILED);
    const auto component_update_payload = component_update_status == LB_CEF3_TASK_SUCCEEDED
        ? TaskResult(component_update_task) : TaskError(component_update_task);
    assert(component_update_payload.find(L"\"componentId\":") != std::wstring::npos);
    assert(component_update_payload.find(L"\"error\":") != std::wstring::npos);
    assert(LB_CEF3_TaskRelease(component_update_task) == LB_CEF3_OK);
    assert(LB_CEF3_ComponentUpdaterUpdate(
               component_updater_result.handle_value, L"LingBuilder.MissingComponent", 2) == 0);
    LB_CEF3_ARGUMENT_V4 missing_component_argument{};
    missing_component_argument.struct_size = sizeof(missing_component_argument);
    missing_component_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
    missing_component_argument.text_value = L"LingBuilder.MissingComponent";
    LB_CEF3_CALL_V4 missing_component_call{};
    missing_component_call.struct_size = sizeof(missing_component_call);
    missing_component_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    missing_component_call.operation_id = UINT64_C(0x38a6e4235f82253b);
    missing_component_call.target = component_updater_result.handle_value;
    missing_component_call.arguments = &missing_component_argument;
    missing_component_call.argument_count = 1;
    LB_CEF3_RESULT_V4 missing_component_result{};
    missing_component_result.struct_size = sizeof(missing_component_result);
    assert(LB_CEF3_InvokeV4(&missing_component_call, &missing_component_result)
        == LB_CEF3_ERROR_OPERATION_FAILED);
    LB_CEF3_ARGUMENT_V4 update_component_id_argument{};
    update_component_id_argument.struct_size = sizeof(update_component_id_argument);
    update_component_id_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
    update_component_id_argument.text_value = L"LingBuilder.MissingComponent";
    LB_CEF3_ARGUMENT_V4 update_priority_argument{};
    update_priority_argument.struct_size = sizeof(update_priority_argument);
    update_priority_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
    update_priority_argument.integer_value = 0;
    const std::array<LB_CEF3_ARGUMENT_V4, 2> update_arguments = {
        update_component_id_argument, update_priority_argument};
    LB_CEF3_CALL_V4 update_call{};
    update_call.struct_size = sizeof(update_call);
    update_call.abi_version = LB_CEF3_ABI_VERSION_V4;
    update_call.operation_id = UINT64_C(0xba82e4698099465a);
    update_call.target = component_updater_result.handle_value;
    update_call.arguments = update_arguments.data();
    update_call.argument_count = update_arguments.size();
    LB_CEF3_RESULT_V4 update_result{};
    update_result.struct_size = sizeof(update_result);
    assert(LB_CEF3_InvokeV4(&update_call, &update_result) == LB_CEF3_OK);
    assert(update_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
    assert(update_result.handle_value != 0);
    assert(WaitTask(update_result.handle_value) == LB_CEF3_TASK_SUCCEEDED
        || LB_CEF3_TaskGetStatus(update_result.handle_value) == LB_CEF3_TASK_FAILED);
    assert(LB_CEF3_TaskRelease(update_result.handle_value) == LB_CEF3_OK);
    assert(LB_CEF3_HandleRelease(component_updater_result.handle_value) == LB_CEF3_OK);
  }
  std::fprintf(stderr, "CEF3 test checkpoint: platform-component-updater\n");
  std::fflush(stderr);
  const auto print_settings = LB_CEF3_PrintSettingsCreate();
  assert(print_settings != 0);
  assert(LB_CEF3_HandleGetType(print_settings) == LB_CEF3_HANDLE_PRINT_SETTINGS);
  assert(LB_CEF3_HandleIsValid(print_settings, LB_CEF3_HANDLE_PRINT_SETTINGS) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsIsValid(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsIsReadOnly(print_settings) == 0);
  assert(LB_CEF3_PrintSettingsSetOrientation(print_settings, 1) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsIsLandscape(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsSetDeviceName(print_settings, L"LingBuilder Printer") == LB_CEF3_OK);
  size_t print_device_required = 0;
  assert(LB_CEF3_PrintSettingsGetDeviceName(
             print_settings, nullptr, 0, &print_device_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring print_device(print_device_required, L'\0');
  assert(LB_CEF3_PrintSettingsGetDeviceName(
             print_settings, print_device.data(), print_device.size(), &print_device_required)
      == LB_CEF3_OK);
  assert(std::wstring(print_device.c_str()) == L"LingBuilder Printer");
  assert(LB_CEF3_PrintSettingsSetDpi(print_settings, 300) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetDpi(print_settings) == 300);
  assert(LB_CEF3_PrintSettingsSetSelectionOnly(print_settings, 1) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsIsSelectionOnly(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsSetCollate(print_settings, 1) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsWillCollate(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsSetColorModel(print_settings, 2) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetColorModel(print_settings) == 2);
  assert(LB_CEF3_PrintSettingsSetColorModel(print_settings, 21)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_PrintSettingsSetCopies(print_settings, 3) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetCopies(print_settings) == 3);
  assert(LB_CEF3_PrintSettingsSetDuplexMode(print_settings, 1) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetDuplexMode(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsSetDuplexMode(print_settings, 3)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto physical_print_size = CreateIntegerDictionary({
      {L"width", 2550}, {L"height", 3300}});
  const auto printable_area = CreateIntegerDictionary({
      {L"x", 75}, {L"y", 75}, {L"width", 2400}, {L"height", 3150}});
  assert(LB_CEF3_PrintSettingsSetPrinterPrintableArea(
             print_settings, physical_print_size, printable_area, 1) == LB_CEF3_OK);
  const auto malformed_print_size = CreateIntegerDictionary({{L"width", 2550}});
  assert(LB_CEF3_PrintSettingsSetPrinterPrintableArea(
             print_settings, malformed_print_size, printable_area, 0)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_PrintSettingsSetPrinterPrintableArea(
             print_settings, print_settings, printable_area, 0)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  const auto page_ranges = CreatePageRangeList({
      {0, 2}, {UINT32_MAX - 1, UINT32_MAX}});
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetPageRangesCount(print_settings) == 2);
  auto page_ranges_copy = LB_CEF3_PrintSettingsGetPageRanges(print_settings);
  assert(page_ranges_copy != 0);
  assert(LB_CEF3_HandleGetType(page_ranges_copy) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(page_ranges_copy) == 2);
  assert(ReadPageRangeField(page_ranges_copy, 0, L"from") == 0.0);
  assert(ReadPageRangeField(page_ranges_copy, 0, L"to") == 2.0);
  assert(ReadPageRangeField(page_ranges_copy, 1, L"from")
      == static_cast<double>(UINT32_MAX - 1));
  assert(ReadPageRangeField(page_ranges_copy, 1, L"to")
      == static_cast<double>(UINT32_MAX));
  assert(LB_CEF3_ListRelease(page_ranges_copy) == LB_CEF3_OK);
  const auto reversed_page_ranges = CreatePageRangeList({{8, 4}});
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, reversed_page_ranges)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto malformed_page_ranges = CreateTextList({L"invalid-range"});
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, malformed_page_ranges)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto empty_page_ranges = CreatePageRangeList({});
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, empty_page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsGetPageRangesCount(print_settings) == 0);
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsSetPageRanges(print_settings, print_settings)
      == LB_CEF3_ERROR_HANDLE_TYPE);

  const auto assert_print_integer_v4 = [print_settings](
      uint64_t operation_id, uint32_t kind, int64_t expected) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = print_settings;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == kind);
    assert(result.integer_value == expected);
  };
  assert_print_integer_v4(UINT64_C(0xb57c5b92f097067a), LB_CEF3_VALUE_V4_BOOLEAN, 1);
  assert_print_integer_v4(UINT64_C(0x7505620bf71f9703), LB_CEF3_VALUE_V4_BOOLEAN, 0);
  assert_print_integer_v4(UINT64_C(0x469272461bcfb45f), LB_CEF3_VALUE_V4_BOOLEAN, 1);
  assert_print_integer_v4(UINT64_C(0xb4a944ce075e8e4e), LB_CEF3_VALUE_V4_BOOLEAN, 1);
  assert_print_integer_v4(UINT64_C(0x2d369d89268cc409), LB_CEF3_VALUE_V4_BOOLEAN, 1);
  assert_print_integer_v4(UINT64_C(0x6501b84e09b094b8), LB_CEF3_VALUE_V4_INTEGER, 2);
  assert_print_integer_v4(UINT64_C(0xbc7fd9705e6b2a01), LB_CEF3_VALUE_V4_INTEGER, 3);
  assert_print_integer_v4(UINT64_C(0xd4190cc214c16e4e), LB_CEF3_VALUE_V4_INTEGER, 300);
  assert_print_integer_v4(UINT64_C(0xb052c87e254ee372), LB_CEF3_VALUE_V4_INTEGER, 1);
  assert_print_integer_v4(UINT64_C(0x6a28092be0fe5bde), LB_CEF3_VALUE_V4_INTEGER, 2);

  LB_CEF3_CALL_V4 print_device_call{};
  print_device_call.struct_size = sizeof(print_device_call);
  print_device_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  print_device_call.operation_id = UINT64_C(0x6d3edd83e23425ca);
  print_device_call.target = print_settings;
  LB_CEF3_RESULT_V4 print_device_result{};
  print_device_result.struct_size = sizeof(print_device_result);
  assert(LB_CEF3_InvokeV4(&print_device_call, &print_device_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring print_device_v4(print_device_result.text_required, L'\0');
  print_device_result.text = print_device_v4.data();
  print_device_result.text_capacity = print_device_v4.size();
  assert(LB_CEF3_InvokeV4(&print_device_call, &print_device_result) == LB_CEF3_OK);
  assert(std::wstring(print_device_v4.c_str()) == L"LingBuilder Printer");

  LB_CEF3_CALL_V4 print_ranges_call{};
  print_ranges_call.struct_size = sizeof(print_ranges_call);
  print_ranges_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  print_ranges_call.operation_id = UINT64_C(0xb40c90acbd411b0b);
  print_ranges_call.target = print_settings;
  LB_CEF3_RESULT_V4 print_ranges_result{};
  print_ranges_result.struct_size = sizeof(print_ranges_result);
  assert(LB_CEF3_InvokeV4(&print_ranges_call, &print_ranges_result) == LB_CEF3_OK);
  assert(print_ranges_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_ListGetSize(print_ranges_result.handle_value) == 2);
  assert(LB_CEF3_ListRelease(print_ranges_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 print_boolean_argument{};
  print_boolean_argument.struct_size = sizeof(print_boolean_argument);
  print_boolean_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  print_boolean_argument.integer_value = 0;
  LB_CEF3_CALL_V4 print_set_call{};
  print_set_call.struct_size = sizeof(print_set_call);
  print_set_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  print_set_call.target = print_settings;
  print_set_call.argument_count = 1;
  print_set_call.arguments = &print_boolean_argument;
  LB_CEF3_RESULT_V4 print_set_result{};
  print_set_result.struct_size = sizeof(print_set_result);
  for (const uint64_t operation_id : {
           UINT64_C(0x7357a69e63a8f360), UINT64_C(0xaceb7b38cf54c93e),
           UINT64_C(0x81a6b4cea9ceaeb1)}) {
    print_set_call.operation_id = operation_id;
    print_set_result = {};
    print_set_result.struct_size = sizeof(print_set_result);
    assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_OK);
    assert(print_set_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  }
  assert(LB_CEF3_PrintSettingsWillCollate(print_settings) == 0);
  assert(LB_CEF3_PrintSettingsIsLandscape(print_settings) == 0);
  assert(LB_CEF3_PrintSettingsIsSelectionOnly(print_settings) == 0);

  LB_CEF3_ARGUMENT_V4 print_integer_argument{};
  print_integer_argument.struct_size = sizeof(print_integer_argument);
  print_integer_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  print_set_call.arguments = &print_integer_argument;
  for (const auto& [operation_id, value] : {
           std::pair<uint64_t, int64_t>{UINT64_C(0xef2f32df223194b7), 1},
           std::pair<uint64_t, int64_t>{UINT64_C(0x93d3f35db299c6b7), 5},
           std::pair<uint64_t, int64_t>{UINT64_C(0x057257051ba0b897), 600},
           std::pair<uint64_t, int64_t>{UINT64_C(0x87dd48270218a63d), 2}}) {
    print_integer_argument.integer_value = value;
    print_set_call.operation_id = operation_id;
    print_set_result = {};
    print_set_result.struct_size = sizeof(print_set_result);
    assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_OK);
  }
  assert(LB_CEF3_PrintSettingsGetColorModel(print_settings) == 1);
  assert(LB_CEF3_PrintSettingsGetCopies(print_settings) == 5);
  assert(LB_CEF3_PrintSettingsGetDpi(print_settings) == 600);
  assert(LB_CEF3_PrintSettingsGetDuplexMode(print_settings) == 2);

  LB_CEF3_ARGUMENT_V4 print_text_argument{};
  print_text_argument.struct_size = sizeof(print_text_argument);
  print_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  print_text_argument.text_value = L"LingBuilder Printer V4";
  print_set_call.operation_id = UINT64_C(0x28f77b334d675855);
  print_set_call.arguments = &print_text_argument;
  assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 print_ranges_argument{};
  print_ranges_argument.struct_size = sizeof(print_ranges_argument);
  print_ranges_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  print_ranges_argument.handle_value = page_ranges;
  print_set_call.operation_id = UINT64_C(0x6e6414460fefdc5c);
  print_set_call.arguments = &print_ranges_argument;
  assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_OK);

  std::array<LB_CEF3_ARGUMENT_V4, 3> printable_arguments{};
  for (auto& argument : printable_arguments) argument.struct_size = sizeof(argument);
  printable_arguments[0].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  printable_arguments[0].handle_value = physical_print_size;
  printable_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  printable_arguments[1].handle_value = printable_area;
  printable_arguments[2].value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  printable_arguments[2].integer_value = 0;
  print_set_call.operation_id = UINT64_C(0x4e540b1b946ae2fe);
  print_set_call.argument_count = static_cast<uint32_t>(printable_arguments.size());
  print_set_call.arguments = printable_arguments.data();
  assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_OK);
  printable_arguments[0].handle_value = page_ranges;
  assert(LB_CEF3_InvokeV4(&print_set_call, &print_set_result) == LB_CEF3_ERROR_HANDLE_TYPE);

  assert(LB_CEF3_DictionaryRelease(malformed_print_size) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(printable_area) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(physical_print_size) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(empty_page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(malformed_page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(reversed_page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(page_ranges) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(print_settings) == LB_CEF3_OK);
  assert(LB_CEF3_PrintSettingsIsValid(print_settings) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PrintSettingsSetDpi(print_settings, 300) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PrintSettingsGetPageRanges(print_settings) == 0);
  LB_CEF3_CALL_V4 print_settings_call{};
  print_settings_call.struct_size = sizeof(print_settings_call);
  print_settings_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  print_settings_call.operation_id = UINT64_C(0x88b8e852f112ebc2);
  LB_CEF3_RESULT_V4 print_settings_result{};
  print_settings_result.struct_size = sizeof(print_settings_result);
  assert(LB_CEF3_InvokeV4(&print_settings_call, &print_settings_result) == LB_CEF3_OK);
  assert(print_settings_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(print_settings_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(print_settings_result.handle_value) == LB_CEF3_HANDLE_PRINT_SETTINGS);
  assert(LB_CEF3_HandleRelease(print_settings_result.handle_value) == LB_CEF3_OK);
  const auto process_message = LB_CEF3_ProcessMessageCreate(L"LingBuilder.TestMessage");
  assert(process_message != 0);
  assert(LB_CEF3_HandleGetType(process_message) == LB_CEF3_HANDLE_PROCESS_MESSAGE);
  assert(LB_CEF3_HandleIsValid(process_message, LB_CEF3_HANDLE_PROCESS_MESSAGE) == LB_CEF3_OK);
  assert(LB_CEF3_ProcessMessageIsValid(process_message) == 1);
  assert(LB_CEF3_ProcessMessageIsReadOnly(process_message) == 0);
  size_t process_message_name_required = 0;
  assert(LB_CEF3_ProcessMessageGetName(
             process_message, nullptr, 0, &process_message_name_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> process_message_name(process_message_name_required);
  assert(LB_CEF3_ProcessMessageGetName(
             process_message, process_message_name.data(), process_message_name.size(),
             &process_message_name_required) == LB_CEF3_OK);
  assert(std::wstring(process_message_name.data()) == L"LingBuilder.TestMessage");
  const auto process_message_arguments = LB_CEF3_ProcessMessageGetArgumentList(process_message);
  assert(process_message_arguments != 0);
  assert(LB_CEF3_HandleGetType(process_message_arguments) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListIsValid(process_message_arguments) == 1);
  assert(LB_CEF3_ListRelease(process_message_arguments) == LB_CEF3_OK);
  assert(LB_CEF3_ProcessMessageGetSharedMemoryRegion(process_message) == 0);
  const auto process_message_copy = LB_CEF3_ProcessMessageCopy(process_message);
  assert(process_message_copy != 0);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy) == 1);
  assert(LB_CEF3_ProcessMessageSend(browser_a, 99, process_message_copy)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy) == 1);
  assert(LB_CEF3_ProcessMessageSend(browser_a, 1, process_message_copy) == LB_CEF3_OK);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy) == 0);
  assert(LB_CEF3_HandleRelease(process_message_copy) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 process_message_argument{};
  process_message_argument.struct_size = sizeof(process_message_argument);
  process_message_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  process_message_argument.text_value = L"LingBuilder.TestMessage.V4";
  LB_CEF3_CALL_V4 process_message_call{};
  process_message_call.struct_size = sizeof(process_message_call);
  process_message_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_call.operation_id = UINT64_C(0xaa90c79bcf5b735f);
  process_message_call.arguments = &process_message_argument;
  process_message_call.argument_count = 1;
  LB_CEF3_RESULT_V4 process_message_result{};
  process_message_result.struct_size = sizeof(process_message_result);
  assert(LB_CEF3_InvokeV4(&process_message_call, &process_message_result) == LB_CEF3_OK);
  assert(process_message_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(process_message_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(process_message_result.handle_value)
      == LB_CEF3_HANDLE_PROCESS_MESSAGE);

  LB_CEF3_CALL_V4 process_message_valid_call{};
  process_message_valid_call.struct_size = sizeof(process_message_valid_call);
  process_message_valid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_valid_call.operation_id = UINT64_C(0x3a9b3abbc1793d61);
  process_message_valid_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_valid_result{};
  process_message_valid_result.struct_size = sizeof(process_message_valid_result);
  assert(LB_CEF3_InvokeV4(&process_message_valid_call, &process_message_valid_result)
      == LB_CEF3_OK);
  assert(process_message_valid_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(process_message_valid_result.integer_value == 1);

  LB_CEF3_CALL_V4 process_message_read_only_call{};
  process_message_read_only_call.struct_size = sizeof(process_message_read_only_call);
  process_message_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_read_only_call.operation_id = UINT64_C(0xdbfa476544dd5c09);
  process_message_read_only_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_read_only_result{};
  process_message_read_only_result.struct_size = sizeof(process_message_read_only_result);
  assert(LB_CEF3_InvokeV4(&process_message_read_only_call, &process_message_read_only_result)
      == LB_CEF3_OK);
  assert(process_message_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(process_message_read_only_result.integer_value == 0);

  std::array<wchar_t, 128> process_message_name_v4{};
  LB_CEF3_CALL_V4 process_message_name_call{};
  process_message_name_call.struct_size = sizeof(process_message_name_call);
  process_message_name_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_name_call.operation_id = UINT64_C(0x042e6f3bf5f6b4d1);
  process_message_name_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_name_result{};
  process_message_name_result.struct_size = sizeof(process_message_name_result);
  process_message_name_result.text = process_message_name_v4.data();
  process_message_name_result.text_capacity = process_message_name_v4.size();
  assert(LB_CEF3_InvokeV4(&process_message_name_call, &process_message_name_result)
      == LB_CEF3_OK);
  assert(process_message_name_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(process_message_name_v4.data()) == L"LingBuilder.TestMessage.V4");

  LB_CEF3_CALL_V4 process_message_arguments_call{};
  process_message_arguments_call.struct_size = sizeof(process_message_arguments_call);
  process_message_arguments_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_arguments_call.operation_id = UINT64_C(0xf68c7b0e69444f9a);
  process_message_arguments_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_arguments_result{};
  process_message_arguments_result.struct_size = sizeof(process_message_arguments_result);
  assert(LB_CEF3_InvokeV4(&process_message_arguments_call, &process_message_arguments_result)
      == LB_CEF3_OK);
  assert(process_message_arguments_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(process_message_arguments_result.handle_value)
      == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListRelease(process_message_arguments_result.handle_value) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 process_message_copy_call{};
  process_message_copy_call.struct_size = sizeof(process_message_copy_call);
  process_message_copy_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_copy_call.operation_id = UINT64_C(0x3ed0aaa50fb21a07);
  process_message_copy_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_copy_result{};
  process_message_copy_result.struct_size = sizeof(process_message_copy_result);
  assert(LB_CEF3_InvokeV4(&process_message_copy_call, &process_message_copy_result)
      == LB_CEF3_OK);
  assert(process_message_copy_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(process_message_copy_result.handle_value != 0);

  LB_CEF3_CALL_V4 process_message_region_call{};
  process_message_region_call.struct_size = sizeof(process_message_region_call);
  process_message_region_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_region_call.operation_id = UINT64_C(0x29e27e3b5aa552bf);
  process_message_region_call.target = process_message_result.handle_value;
  LB_CEF3_RESULT_V4 process_message_region_result{};
  process_message_region_result.struct_size = sizeof(process_message_region_result);
  assert(LB_CEF3_InvokeV4(&process_message_region_call, &process_message_region_result)
      == LB_CEF3_ERROR_OPERATION_FAILED);

  LB_CEF3_ARGUMENT_V4 process_message_send_arguments[2]{};
  process_message_send_arguments[0].struct_size = sizeof(process_message_send_arguments[0]);
  process_message_send_arguments[0].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  process_message_send_arguments[0].integer_value = 1;
  process_message_send_arguments[1].struct_size = sizeof(process_message_send_arguments[1]);
  process_message_send_arguments[1].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  process_message_send_arguments[1].handle_value = process_message_copy_result.handle_value;
  LB_CEF3_CALL_V4 process_message_send_call{};
  process_message_send_call.struct_size = sizeof(process_message_send_call);
  process_message_send_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  process_message_send_call.operation_id = UINT64_C(0x96fac0e524f04cfe);
  process_message_send_call.target = browser_a;
  process_message_send_call.arguments = process_message_send_arguments;
  process_message_send_call.argument_count = 2;
  LB_CEF3_RESULT_V4 process_message_send_result{};
  process_message_send_result.struct_size = sizeof(process_message_send_result);
  assert(LB_CEF3_InvokeV4(&process_message_send_call, &process_message_send_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy_result.handle_value) == 1);
  process_message_send_call.target = frame_handle_for_close;
  process_message_send_arguments[0].integer_value = std::numeric_limits<int64_t>::max();
  assert(LB_CEF3_InvokeV4(&process_message_send_call, &process_message_send_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy_result.handle_value) == 1);
  process_message_send_arguments[0].integer_value = 1;
  assert(LB_CEF3_InvokeV4(&process_message_send_call, &process_message_send_result)
      == LB_CEF3_OK);
  assert(process_message_send_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_ProcessMessageIsValid(process_message_copy_result.handle_value) == 0);
  assert(LB_CEF3_HandleRelease(process_message_copy_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(process_message_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(process_message) == LB_CEF3_OK);
  const auto post_data = LB_CEF3_PostDataCreate();
  assert(post_data != 0);
  assert(LB_CEF3_HandleGetType(post_data) == LB_CEF3_HANDLE_POST_DATA);
  assert(LB_CEF3_HandleIsValid(post_data, LB_CEF3_HANDLE_POST_DATA) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(post_data) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 post_data_call{};
  post_data_call.struct_size = sizeof(post_data_call);
  post_data_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_call.operation_id = UINT64_C(0x8674f6316ac1b3f9);
  LB_CEF3_RESULT_V4 post_data_result{};
  post_data_result.struct_size = sizeof(post_data_result);
  assert(LB_CEF3_InvokeV4(&post_data_call, &post_data_result) == LB_CEF3_OK);
  assert(post_data_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(post_data_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(post_data_result.handle_value) == LB_CEF3_HANDLE_POST_DATA);
  assert(LB_CEF3_HandleRelease(post_data_result.handle_value) == LB_CEF3_OK);
  const auto post_data_element = LB_CEF3_PostDataElementCreate();
  assert(post_data_element != 0);
  assert(LB_CEF3_HandleGetType(post_data_element) == LB_CEF3_HANDLE_POST_DATA_ELEMENT);
  assert(LB_CEF3_HandleIsValid(post_data_element, LB_CEF3_HANDLE_POST_DATA_ELEMENT) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataElementIsReadOnly(post_data_element) == 0);
  assert(LB_CEF3_PostDataElementGetType(post_data_element)
      == LB_CEF3_POST_DATA_ELEMENT_EMPTY);
  assert(LB_CEF3_PostDataElementGetBytesCount(post_data_element) == 0);
  const auto empty_post_data_bytes = LB_CEF3_PostDataElementGetBytes(post_data_element, 16);
  assert(empty_post_data_bytes != 0);
  uint64_t post_data_byte_size = 0;
  assert(LB_CEF3_BufferGetSize(empty_post_data_bytes, &post_data_byte_size) == LB_CEF3_OK);
  assert(post_data_byte_size == 0);
  assert(LB_CEF3_BufferRelease(empty_post_data_bytes) == LB_CEF3_OK);

  const std::array<unsigned char, 4> post_data_source_bytes = {0x10, 0x20, 0x30, 0x40};
  const auto post_data_source_buffer = LB_CEF3_BufferCreate(
      post_data_source_bytes.data(), post_data_source_bytes.size());
  assert(post_data_source_buffer != 0);
  assert(LB_CEF3_PostDataElementSetToBytes(
             post_data_element, post_data_source_buffer, 1, 2) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataElementGetType(post_data_element)
      == LB_CEF3_POST_DATA_ELEMENT_BYTES);
  assert(LB_CEF3_PostDataElementGetBytesCount(post_data_element) == 2);
  const auto post_data_bytes = LB_CEF3_PostDataElementGetBytes(post_data_element, 16);
  assert(post_data_bytes != 0);
  const std::array<unsigned char, 2> expected_post_data_bytes = {0x20, 0x30};
  const auto expected_post_data_buffer = LB_CEF3_BufferCreate(
      expected_post_data_bytes.data(), expected_post_data_bytes.size());
  assert(LB_CEF3_BufferIsEqual(post_data_bytes, expected_post_data_buffer) == 1);
  assert(LB_CEF3_PostDataElementSetToBytes(
             post_data_element, post_data_source_buffer, 3, 2)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_PostDataElementGetBytes(
             post_data_element, 64ULL * 1024ULL * 1024ULL + 1) == 0);

  const auto post_data_file = root / L"post-data-element.bin";
  {
    std::ofstream stream(post_data_file, std::ios::binary | std::ios::trunc);
    stream << "post-data-file";
    assert(stream.good());
  }
  assert(LB_CEF3_PostDataElementSetToFile(post_data_element, post_data_file.c_str()) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataElementGetType(post_data_element)
      == LB_CEF3_POST_DATA_ELEMENT_FILE);
  size_t post_data_file_required = 0;
  assert(LB_CEF3_PostDataElementGetFile(
             post_data_element, nullptr, 0, &post_data_file_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> post_data_file_text(post_data_file_required);
  assert(LB_CEF3_PostDataElementGetFile(
             post_data_element, post_data_file_text.data(), post_data_file_text.size(),
             &post_data_file_required) == LB_CEF3_OK);
  assert(std::wstring(post_data_file_text.data())
      == std::filesystem::weakly_canonical(post_data_file).wstring());
  assert(LB_CEF3_PostDataElementSetToFile(
             post_data_element, (root.parent_path() / L"post-data-outside.bin").c_str())
      == LB_CEF3_ERROR_PATH_DENIED);
  assert(LB_CEF3_PostDataElementSetToEmpty(post_data_element) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataElementGetType(post_data_element)
      == LB_CEF3_POST_DATA_ELEMENT_EMPTY);
  assert(LB_CEF3_BufferRelease(expected_post_data_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(post_data_bytes) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 post_data_element_call{};
  post_data_element_call.struct_size = sizeof(post_data_element_call);
  post_data_element_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_call.operation_id = UINT64_C(0x876ec2760a5c1d09);
  LB_CEF3_RESULT_V4 post_data_element_result{};
  post_data_element_result.struct_size = sizeof(post_data_element_result);
  assert(LB_CEF3_InvokeV4(&post_data_element_call, &post_data_element_result) == LB_CEF3_OK);
  assert(post_data_element_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(post_data_element_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(post_data_element_result.handle_value)
      == LB_CEF3_HANDLE_POST_DATA_ELEMENT);

  LB_CEF3_CALL_V4 post_data_element_read_only_call{};
  post_data_element_read_only_call.struct_size = sizeof(post_data_element_read_only_call);
  post_data_element_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_read_only_call.operation_id = UINT64_C(0xd5fdbb624c9cc949);
  post_data_element_read_only_call.target = post_data_element_result.handle_value;
  LB_CEF3_RESULT_V4 post_data_element_read_only_result{};
  post_data_element_read_only_result.struct_size = sizeof(post_data_element_read_only_result);
  assert(LB_CEF3_InvokeV4(
             &post_data_element_read_only_call, &post_data_element_read_only_result)
      == LB_CEF3_OK);
  assert(post_data_element_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(post_data_element_read_only_result.integer_value == 0);

  LB_CEF3_ARGUMENT_V4 post_data_element_set_bytes_arguments[3]{};
  post_data_element_set_bytes_arguments[0].struct_size = sizeof(post_data_element_set_bytes_arguments[0]);
  post_data_element_set_bytes_arguments[0].value_kind = LB_CEF3_VALUE_V4_BUFFER;
  post_data_element_set_bytes_arguments[0].buffer_value = post_data_source_buffer;
  post_data_element_set_bytes_arguments[1].struct_size = sizeof(post_data_element_set_bytes_arguments[1]);
  post_data_element_set_bytes_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  post_data_element_set_bytes_arguments[1].integer_value = 0;
  post_data_element_set_bytes_arguments[2].struct_size = sizeof(post_data_element_set_bytes_arguments[2]);
  post_data_element_set_bytes_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  post_data_element_set_bytes_arguments[2].integer_value = post_data_source_bytes.size();
  LB_CEF3_CALL_V4 post_data_element_set_bytes_call{};
  post_data_element_set_bytes_call.struct_size = sizeof(post_data_element_set_bytes_call);
  post_data_element_set_bytes_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_set_bytes_call.operation_id = UINT64_C(0xe71a7151817d1336);
  post_data_element_set_bytes_call.target = post_data_element_result.handle_value;
  post_data_element_set_bytes_call.arguments = post_data_element_set_bytes_arguments;
  post_data_element_set_bytes_call.argument_count = 3;
  LB_CEF3_RESULT_V4 post_data_element_set_bytes_result{};
  post_data_element_set_bytes_result.struct_size = sizeof(post_data_element_set_bytes_result);
  assert(LB_CEF3_InvokeV4(
             &post_data_element_set_bytes_call, &post_data_element_set_bytes_result)
      == LB_CEF3_OK);
  assert(post_data_element_set_bytes_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 post_data_element_type_call{};
  post_data_element_type_call.struct_size = sizeof(post_data_element_type_call);
  post_data_element_type_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_type_call.operation_id = UINT64_C(0xefe6ec628908097b);
  post_data_element_type_call.target = post_data_element_result.handle_value;
  LB_CEF3_RESULT_V4 post_data_element_type_result{};
  post_data_element_type_result.struct_size = sizeof(post_data_element_type_result);
  assert(LB_CEF3_InvokeV4(&post_data_element_type_call, &post_data_element_type_result)
      == LB_CEF3_OK);
  assert(post_data_element_type_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(post_data_element_type_result.integer_value == LB_CEF3_POST_DATA_ELEMENT_BYTES);

  LB_CEF3_CALL_V4 post_data_element_count_call{};
  post_data_element_count_call.struct_size = sizeof(post_data_element_count_call);
  post_data_element_count_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_count_call.operation_id = UINT64_C(0x618b27621c74ae5a);
  post_data_element_count_call.target = post_data_element_result.handle_value;
  LB_CEF3_RESULT_V4 post_data_element_count_result{};
  post_data_element_count_result.struct_size = sizeof(post_data_element_count_result);
  assert(LB_CEF3_InvokeV4(&post_data_element_count_call, &post_data_element_count_result)
      == LB_CEF3_OK);
  assert(post_data_element_count_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(post_data_element_count_result.integer_value == post_data_source_bytes.size());

  LB_CEF3_ARGUMENT_V4 post_data_element_get_bytes_argument{};
  post_data_element_get_bytes_argument.struct_size = sizeof(post_data_element_get_bytes_argument);
  post_data_element_get_bytes_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  post_data_element_get_bytes_argument.integer_value = 16;
  LB_CEF3_CALL_V4 post_data_element_get_bytes_call{};
  post_data_element_get_bytes_call.struct_size = sizeof(post_data_element_get_bytes_call);
  post_data_element_get_bytes_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_get_bytes_call.operation_id = UINT64_C(0x057bad00997c61a2);
  post_data_element_get_bytes_call.target = post_data_element_result.handle_value;
  post_data_element_get_bytes_call.arguments = &post_data_element_get_bytes_argument;
  post_data_element_get_bytes_call.argument_count = 1;
  LB_CEF3_RESULT_V4 post_data_element_get_bytes_result{};
  post_data_element_get_bytes_result.struct_size = sizeof(post_data_element_get_bytes_result);
  assert(LB_CEF3_InvokeV4(
             &post_data_element_get_bytes_call, &post_data_element_get_bytes_result)
      == LB_CEF3_OK);
  assert(post_data_element_get_bytes_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(LB_CEF3_BufferIsEqual(
             post_data_element_get_bytes_result.buffer_value, post_data_source_buffer) == 1);
  assert(LB_CEF3_BufferRelease(post_data_element_get_bytes_result.buffer_value) == LB_CEF3_OK);

  LB_CEF3_ARGUMENT_V4 post_data_element_file_argument{};
  post_data_element_file_argument.struct_size = sizeof(post_data_element_file_argument);
  post_data_element_file_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  post_data_element_file_argument.text_value = post_data_file.c_str();
  LB_CEF3_CALL_V4 post_data_element_set_file_call{};
  post_data_element_set_file_call.struct_size = sizeof(post_data_element_set_file_call);
  post_data_element_set_file_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_set_file_call.operation_id = UINT64_C(0x5efd92b7636aae78);
  post_data_element_set_file_call.target = post_data_element_result.handle_value;
  post_data_element_set_file_call.arguments = &post_data_element_file_argument;
  post_data_element_set_file_call.argument_count = 1;
  LB_CEF3_RESULT_V4 post_data_element_set_file_result{};
  post_data_element_set_file_result.struct_size = sizeof(post_data_element_set_file_result);
  assert(LB_CEF3_InvokeV4(
             &post_data_element_set_file_call, &post_data_element_set_file_result)
      == LB_CEF3_OK);

  std::vector<wchar_t> post_data_file_v4(post_data_file_required);
  LB_CEF3_CALL_V4 post_data_element_file_call{};
  post_data_element_file_call.struct_size = sizeof(post_data_element_file_call);
  post_data_element_file_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_file_call.operation_id = UINT64_C(0xf0b1610fd434eb4f);
  post_data_element_file_call.target = post_data_element_result.handle_value;
  LB_CEF3_RESULT_V4 post_data_element_file_result{};
  post_data_element_file_result.struct_size = sizeof(post_data_element_file_result);
  post_data_element_file_result.text = post_data_file_v4.data();
  post_data_element_file_result.text_capacity = post_data_file_v4.size();
  assert(LB_CEF3_InvokeV4(&post_data_element_file_call, &post_data_element_file_result)
      == LB_CEF3_OK);
  assert(post_data_element_file_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(post_data_file_v4.data())
      == std::filesystem::weakly_canonical(post_data_file).wstring());

  LB_CEF3_CALL_V4 post_data_element_empty_call{};
  post_data_element_empty_call.struct_size = sizeof(post_data_element_empty_call);
  post_data_element_empty_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_element_empty_call.operation_id = UINT64_C(0x3445c8d2796e57fc);
  post_data_element_empty_call.target = post_data_element_result.handle_value;
  LB_CEF3_RESULT_V4 post_data_element_empty_result{};
  post_data_element_empty_result.struct_size = sizeof(post_data_element_empty_result);
  assert(LB_CEF3_InvokeV4(&post_data_element_empty_call, &post_data_element_empty_result)
      == LB_CEF3_OK);
  assert(post_data_element_empty_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_HandleRelease(post_data_element_result.handle_value) == LB_CEF3_OK);

  const auto post_data_container = LB_CEF3_PostDataCreate();
  const auto post_data_container_element = LB_CEF3_PostDataElementCreate();
  assert(post_data_container != 0 && post_data_container_element != 0);
  assert(LB_CEF3_HandleGetType(post_data_container) == LB_CEF3_HANDLE_POST_DATA);
  assert(LB_CEF3_PostDataIsReadOnly(post_data_container) == 0);
  assert(LB_CEF3_PostDataHasExcludedElements(post_data_container) == 0);
  assert(LB_CEF3_PostDataGetElementCount(post_data_container) == 0);
  size_t post_data_elements_required = 0;
  assert(LB_CEF3_PostDataGetElementsJson(
             post_data_container, nullptr, 0, &post_data_elements_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::vector<wchar_t> post_data_elements_json(post_data_elements_required);
  assert(LB_CEF3_PostDataGetElementsJson(
             post_data_container, post_data_elements_json.data(), post_data_elements_json.size(),
             &post_data_elements_required) == LB_CEF3_OK);
  assert(std::wstring(post_data_elements_json.data()) == L"[]");
  assert(LB_CEF3_PostDataElementSetToBytes(
             post_data_container_element, post_data_source_buffer, 0, 2) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataAddElement(post_data_container, post_data_container_element) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataGetElementCount(post_data_container) == 1);
  assert(LB_CEF3_PostDataGetElementsJson(
             post_data_container, nullptr, 0, &post_data_elements_required)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  post_data_elements_json.assign(post_data_elements_required, L'\0');
  assert(LB_CEF3_PostDataGetElementsJson(
             post_data_container, post_data_elements_json.data(), post_data_elements_json.size(),
             &post_data_elements_required) == LB_CEF3_OK);
  const wchar_t* enumerated_handle_text = wcsstr(post_data_elements_json.data(), L"[\"");
  assert(enumerated_handle_text != nullptr);
  const auto enumerated_post_data_element = static_cast<LB_CEF3_HANDLE>(
      _wcstoui64(enumerated_handle_text + 2, nullptr, 10));
  assert(enumerated_post_data_element != 0);
  assert(LB_CEF3_HandleGetType(enumerated_post_data_element)
      == LB_CEF3_HANDLE_POST_DATA_ELEMENT);
  assert(LB_CEF3_PostDataRemoveElement(post_data_container, enumerated_post_data_element)
      == LB_CEF3_OK);
  assert(LB_CEF3_PostDataGetElementCount(post_data_container) == 0);
  assert(LB_CEF3_HandleRelease(enumerated_post_data_element) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataAddElement(post_data_container, post_data_container_element) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataRemoveElements(post_data_container) == LB_CEF3_OK);
  assert(LB_CEF3_PostDataGetElementCount(post_data_container) == 0);

  const auto post_data_v4 = LB_CEF3_PostDataCreate();
  assert(post_data_v4 != 0);
  LB_CEF3_CALL_V4 post_data_read_only_call{};
  post_data_read_only_call.struct_size = sizeof(post_data_read_only_call);
  post_data_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_read_only_call.operation_id = UINT64_C(0x5aa7eaa0d219ddab);
  post_data_read_only_call.target = post_data_v4;
  LB_CEF3_RESULT_V4 post_data_read_only_result{};
  post_data_read_only_result.struct_size = sizeof(post_data_read_only_result);
  assert(LB_CEF3_InvokeV4(&post_data_read_only_call, &post_data_read_only_result) == LB_CEF3_OK);
  assert(post_data_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(post_data_read_only_result.integer_value == 0);

  LB_CEF3_CALL_V4 post_data_excluded_call{};
  post_data_excluded_call.struct_size = sizeof(post_data_excluded_call);
  post_data_excluded_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_excluded_call.operation_id = UINT64_C(0xbf52609aa0972ecc);
  post_data_excluded_call.target = post_data_v4;
  LB_CEF3_RESULT_V4 post_data_excluded_result{};
  post_data_excluded_result.struct_size = sizeof(post_data_excluded_result);
  assert(LB_CEF3_InvokeV4(&post_data_excluded_call, &post_data_excluded_result) == LB_CEF3_OK);
  assert(post_data_excluded_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(post_data_excluded_result.integer_value == 0);

  LB_CEF3_ARGUMENT_V4 post_data_element_argument{};
  post_data_element_argument.struct_size = sizeof(post_data_element_argument);
  post_data_element_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  post_data_element_argument.handle_value = post_data_container_element;
  LB_CEF3_CALL_V4 post_data_add_call{};
  post_data_add_call.struct_size = sizeof(post_data_add_call);
  post_data_add_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_add_call.operation_id = UINT64_C(0x414aa45d99120bb6);
  post_data_add_call.target = post_data_v4;
  post_data_add_call.arguments = &post_data_element_argument;
  post_data_add_call.argument_count = 1;
  LB_CEF3_RESULT_V4 post_data_add_result{};
  post_data_add_result.struct_size = sizeof(post_data_add_result);
  assert(LB_CEF3_InvokeV4(&post_data_add_call, &post_data_add_result) == LB_CEF3_OK);
  assert(post_data_add_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(post_data_add_result.integer_value == 1);

  LB_CEF3_CALL_V4 post_data_count_call{};
  post_data_count_call.struct_size = sizeof(post_data_count_call);
  post_data_count_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_count_call.operation_id = UINT64_C(0x9bffc6e53829659a);
  post_data_count_call.target = post_data_v4;
  LB_CEF3_RESULT_V4 post_data_count_result{};
  post_data_count_result.struct_size = sizeof(post_data_count_result);
  assert(LB_CEF3_InvokeV4(&post_data_count_call, &post_data_count_result) == LB_CEF3_OK);
  assert(post_data_count_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(post_data_count_result.integer_value == 1);

  std::array<wchar_t, 64> post_data_v4_elements_json{};
  LB_CEF3_CALL_V4 post_data_elements_call{};
  post_data_elements_call.struct_size = sizeof(post_data_elements_call);
  post_data_elements_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_elements_call.operation_id = UINT64_C(0x998ec8042def5879);
  post_data_elements_call.target = post_data_v4;
  LB_CEF3_RESULT_V4 post_data_elements_result{};
  post_data_elements_result.struct_size = sizeof(post_data_elements_result);
  post_data_elements_result.text = post_data_v4_elements_json.data();
  post_data_elements_result.text_capacity = post_data_v4_elements_json.size();
  assert(LB_CEF3_InvokeV4(&post_data_elements_call, &post_data_elements_result) == LB_CEF3_OK);
  assert(post_data_elements_result.value_kind == LB_CEF3_VALUE_V4_JSON);
  enumerated_handle_text = wcsstr(post_data_v4_elements_json.data(), L"[\"");
  assert(enumerated_handle_text != nullptr);
  const auto enumerated_post_data_v4_element = static_cast<LB_CEF3_HANDLE>(
      _wcstoui64(enumerated_handle_text + 2, nullptr, 10));
  assert(enumerated_post_data_v4_element != 0);

  post_data_element_argument.handle_value = enumerated_post_data_v4_element;
  LB_CEF3_CALL_V4 post_data_remove_call = post_data_add_call;
  post_data_remove_call.operation_id = UINT64_C(0xf951b15f0749db0c);
  LB_CEF3_RESULT_V4 post_data_remove_result{};
  post_data_remove_result.struct_size = sizeof(post_data_remove_result);
  assert(LB_CEF3_InvokeV4(&post_data_remove_call, &post_data_remove_result) == LB_CEF3_OK);
  assert(post_data_remove_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(post_data_remove_result.integer_value == 1);
  assert(LB_CEF3_HandleRelease(enumerated_post_data_v4_element) == LB_CEF3_OK);

  post_data_element_argument.handle_value = post_data_container_element;
  post_data_add_result = {};
  post_data_add_result.struct_size = sizeof(post_data_add_result);
  assert(LB_CEF3_InvokeV4(&post_data_add_call, &post_data_add_result) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 post_data_clear_call{};
  post_data_clear_call.struct_size = sizeof(post_data_clear_call);
  post_data_clear_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  post_data_clear_call.operation_id = UINT64_C(0x9d13df48efa54490);
  post_data_clear_call.target = post_data_v4;
  LB_CEF3_RESULT_V4 post_data_clear_result{};
  post_data_clear_result.struct_size = sizeof(post_data_clear_result);
  assert(LB_CEF3_InvokeV4(&post_data_clear_call, &post_data_clear_result) == LB_CEF3_OK);
  assert(post_data_clear_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  post_data_count_result = {};
  post_data_count_result.struct_size = sizeof(post_data_count_result);
  assert(LB_CEF3_InvokeV4(&post_data_count_call, &post_data_count_result) == LB_CEF3_OK);
  assert(post_data_count_result.integer_value == 0);

  constexpr LB_CEF3_HANDLE invalid_post_data_handle = UINT64_C(0x7fffffffffffff03);
  assert(LB_CEF3_PostDataIsReadOnly(invalid_post_data_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataHasExcludedElements(invalid_post_data_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataGetElementCount(invalid_post_data_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataGetElementsJson(
             invalid_post_data_handle, post_data_elements_json.data(),
             post_data_elements_json.size(), &post_data_elements_required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataAddElement(invalid_post_data_handle, post_data_container_element)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataRemoveElement(invalid_post_data_handle, post_data_container_element)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataRemoveElements(invalid_post_data_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(post_data_v4) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(post_data_container_element) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(post_data_container) == LB_CEF3_OK);

  constexpr LB_CEF3_HANDLE invalid_post_data_element_handle = UINT64_C(0x7fffffffffffff02);
  assert(LB_CEF3_PostDataElementIsReadOnly(invalid_post_data_element_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementSetToEmpty(invalid_post_data_element_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementSetToFile(
             invalid_post_data_element_handle, post_data_file.c_str())
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementSetToBytes(
             invalid_post_data_element_handle, post_data_source_buffer, 0, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementGetType(invalid_post_data_element_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementGetFile(
             invalid_post_data_element_handle, post_data_file_text.data(), post_data_file_text.size(),
             &post_data_file_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementGetBytesCount(invalid_post_data_element_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_PostDataElementGetBytes(invalid_post_data_element_handle, 1) == 0);
  assert(LB_CEF3_BufferRelease(post_data_source_buffer) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(post_data_element) == LB_CEF3_OK);
  const auto request = LB_CEF3_RequestCreate();
  assert(request != 0);
  assert(LB_CEF3_HandleGetType(request) == LB_CEF3_HANDLE_REQUEST);
  assert(LB_CEF3_HandleIsValid(request, LB_CEF3_HANDLE_REQUEST) == LB_CEF3_OK);
  assert(LB_CEF3_RequestIsReadOnly(request) == 0);
  assert(LB_CEF3_RequestSetUrl(request, L"https://lingbuilder.test/request") == LB_CEF3_OK);
  std::array<wchar_t, 256> request_text{};
  assert(LB_CEF3_RequestGetUrl(request, request_text.data(), request_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"https://lingbuilder.test/request");
  assert(LB_CEF3_RequestSetMethod(request, L"POST") == LB_CEF3_OK);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetMethod(request, request_text.data(), request_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"POST");
  const auto request_post_data = LB_CEF3_PostDataCreate();
  const auto request_post_data_element = LB_CEF3_PostDataElementCreate();
  assert(request_post_data != 0 && request_post_data_element != 0);
  assert(LB_CEF3_PostDataAddElement(request_post_data, request_post_data_element) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetPostData(request, request_post_data) == LB_CEF3_OK);
  const auto request_post_data_copy = LB_CEF3_RequestGetPostData(request);
  assert(request_post_data_copy != 0);
  assert(LB_CEF3_HandleGetType(request_post_data_copy) == LB_CEF3_HANDLE_POST_DATA);
  assert(LB_CEF3_PostDataGetElementCount(request_post_data_copy) == 1);
  assert(LB_CEF3_HandleRelease(request_post_data_copy) == LB_CEF3_OK);

  LB_CEF3_CALL_V4 request_read_only_call{};
  request_read_only_call.struct_size = sizeof(request_read_only_call);
  request_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_read_only_call.operation_id = UINT64_C(0x79df82a8bfb14caf);
  request_read_only_call.target = request;
  LB_CEF3_RESULT_V4 request_read_only_result{};
  request_read_only_result.struct_size = sizeof(request_read_only_result);
  assert(LB_CEF3_InvokeV4(&request_read_only_call, &request_read_only_result) == LB_CEF3_OK);
  assert(request_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(request_read_only_result.integer_value == 0);

  LB_CEF3_ARGUMENT_V4 request_text_argument{};
  request_text_argument.struct_size = sizeof(request_text_argument);
  request_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_text_argument.text_value = L"https://lingbuilder.test/request-v4";
  LB_CEF3_CALL_V4 request_set_url_call{};
  request_set_url_call.struct_size = sizeof(request_set_url_call);
  request_set_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_url_call.operation_id = UINT64_C(0xb5d2e87a5a700c86);
  request_set_url_call.target = request;
  request_set_url_call.argument_count = 1;
  request_set_url_call.arguments = &request_text_argument;
  LB_CEF3_RESULT_V4 request_set_url_result{};
  request_set_url_result.struct_size = sizeof(request_set_url_result);
  assert(LB_CEF3_InvokeV4(&request_set_url_call, &request_set_url_result) == LB_CEF3_OK);
  assert(request_set_url_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 request_get_url_call{};
  request_get_url_call.struct_size = sizeof(request_get_url_call);
  request_get_url_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_url_call.operation_id = UINT64_C(0x104338fd5c2de08b);
  request_get_url_call.target = request;
  LB_CEF3_RESULT_V4 request_get_url_result{};
  request_get_url_result.struct_size = sizeof(request_get_url_result);
  assert(LB_CEF3_InvokeV4(&request_get_url_call, &request_get_url_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring request_url_v4(request_get_url_result.text_required, L'\0');
  request_get_url_result.text = request_url_v4.data();
  request_get_url_result.text_capacity = request_url_v4.size();
  assert(LB_CEF3_InvokeV4(&request_get_url_call, &request_get_url_result) == LB_CEF3_OK);
  assert(request_get_url_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(request_url_v4.c_str()) == L"https://lingbuilder.test/request-v4");

  request_text_argument.text_value = L"PATCH";
  LB_CEF3_CALL_V4 request_set_method_call{};
  request_set_method_call.struct_size = sizeof(request_set_method_call);
  request_set_method_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_method_call.operation_id = UINT64_C(0xc133613bc6d9b287);
  request_set_method_call.target = request;
  request_set_method_call.argument_count = 1;
  request_set_method_call.arguments = &request_text_argument;
  LB_CEF3_RESULT_V4 request_set_method_result{};
  request_set_method_result.struct_size = sizeof(request_set_method_result);
  assert(LB_CEF3_InvokeV4(&request_set_method_call, &request_set_method_result) == LB_CEF3_OK);
  assert(request_set_method_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 request_get_method_call{};
  request_get_method_call.struct_size = sizeof(request_get_method_call);
  request_get_method_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_method_call.operation_id = UINT64_C(0xe00e1d13c3423467);
  request_get_method_call.target = request;
  LB_CEF3_RESULT_V4 request_get_method_result{};
  request_get_method_result.struct_size = sizeof(request_get_method_result);
  assert(LB_CEF3_InvokeV4(&request_get_method_call, &request_get_method_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring request_method_v4(request_get_method_result.text_required, L'\0');
  request_get_method_result.text = request_method_v4.data();
  request_get_method_result.text_capacity = request_method_v4.size();
  assert(LB_CEF3_InvokeV4(&request_get_method_call, &request_get_method_result) == LB_CEF3_OK);
  assert(request_get_method_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(request_method_v4.c_str()) == L"PATCH");

  assert(LB_CEF3_RequestSetHeaderByName(
             request, L"X-LingBuilder-Request", L"request-cabi", 1) == LB_CEF3_OK);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetHeaderByName(
             request, L"X-LingBuilder-Request", request_text.data(), request_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"request-cabi");
  assert(LB_CEF3_RequestSetHeaderByName(request, L"", L"invalid", 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto request_headers = CreateHeaderMapList({
      {L"X-LingBuilder-Duplicate", L"first"},
      {L"X-LingBuilder-Duplicate", L"second"},
      {L"X-LingBuilder-Order", L"third"}});
  assert(LB_CEF3_RequestSetHeaderMap(request, request_headers) == LB_CEF3_OK);
  auto request_headers_copy = LB_CEF3_RequestGetHeaderMap(request);
  assert(request_headers_copy != 0);
  assert(LB_CEF3_HandleGetType(request_headers_copy) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(request_headers_copy) == 3);
  assert(ReadHeaderMapField(request_headers_copy, 0, L"name") == L"X-LingBuilder-Duplicate");
  assert(ReadHeaderMapField(request_headers_copy, 0, L"value") == L"first");
  assert(ReadHeaderMapField(request_headers_copy, 1, L"name") == L"X-LingBuilder-Duplicate");
  assert(ReadHeaderMapField(request_headers_copy, 1, L"value") == L"second");
  assert(ReadHeaderMapField(request_headers_copy, 2, L"name") == L"X-LingBuilder-Order");
  assert(ReadHeaderMapField(request_headers_copy, 2, L"value") == L"third");
  assert(LB_CEF3_ListRelease(request_headers_copy) == LB_CEF3_OK);

  const auto empty_request_headers = CreateHeaderMapList({});
  assert(LB_CEF3_RequestSetHeaderMap(request, empty_request_headers) == LB_CEF3_OK);
  request_headers_copy = LB_CEF3_RequestGetHeaderMap(request);
  assert(request_headers_copy != 0);
  assert(LB_CEF3_ListGetSize(request_headers_copy) == 0);
  assert(LB_CEF3_ListRelease(request_headers_copy) == LB_CEF3_OK);

  const auto malformed_request_headers = CreateTextList({L"not-a-header-dictionary"});
  assert(LB_CEF3_RequestSetHeaderMap(request, malformed_request_headers)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto missing_field_headers = LB_CEF3_ListCreate();
  assert(missing_field_headers != 0);
  assert(LB_CEF3_ListSetSize(missing_field_headers, 1) == LB_CEF3_OK);
  const auto missing_field_dictionary = LB_CEF3_DictionaryCreate();
  const auto missing_field_name = LB_CEF3_ValueCreate();
  const auto missing_field_item = LB_CEF3_ValueCreate();
  assert(missing_field_dictionary != 0 && missing_field_name != 0 && missing_field_item != 0);
  assert(LB_CEF3_ValueSetString(missing_field_name, L"X-Missing-Value") == LB_CEF3_OK);
  assert(LB_CEF3_DictionarySetValue(
             missing_field_dictionary, L"name", missing_field_name) == LB_CEF3_OK);
  assert(LB_CEF3_ValueSetDictionary(missing_field_item, missing_field_dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ListSetValue(missing_field_headers, 0, missing_field_item) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetHeaderMap(request, missing_field_headers)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ValueRelease(missing_field_item) == LB_CEF3_OK);
  assert(LB_CEF3_ValueRelease(missing_field_name) == LB_CEF3_OK);
  assert(LB_CEF3_DictionaryRelease(missing_field_dictionary) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(missing_field_headers) == LB_CEF3_OK);
  const auto oversized_request_headers = LB_CEF3_ListCreate();
  assert(oversized_request_headers != 0);
  assert(LB_CEF3_ListSetSize(oversized_request_headers, 65537) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetHeaderMap(request, oversized_request_headers)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ListRelease(oversized_request_headers) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetHeaderMap(request, request_post_data)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  const auto released_request_headers = CreateHeaderMapList({});
  assert(LB_CEF3_ListRelease(released_request_headers) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetHeaderMap(request, released_request_headers)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  assert(LB_CEF3_RequestSet(
             request, L"https://lingbuilder.test/request-set", L"PUT",
             request_post_data, request_headers) == LB_CEF3_OK);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetUrl(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"https://lingbuilder.test/request-set");
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetMethod(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"PUT");
  request_headers_copy = LB_CEF3_RequestGetHeaderMap(request);
  assert(request_headers_copy != 0 && LB_CEF3_ListGetSize(request_headers_copy) == 3);
  assert(LB_CEF3_ListRelease(request_headers_copy) == LB_CEF3_OK);
  assert(LB_CEF3_RequestSetFirstPartyForCookies(
             request, L"https://cookies.lingbuilder.test/") == LB_CEF3_OK);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetFirstPartyForCookies(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  // Standalone CefRequest instances normalize this property to their request origin.
  assert(std::wstring(request_text.data()) == L"https://lingbuilder.test/");
  assert(LB_CEF3_RequestSetReferrer(
             request, L"https://referrer.lingbuilder.test/path#fragment",
             4) == LB_CEF3_OK);
  assert(LB_CEF3_RequestGetReferrerPolicy(request) == 4);
  assert(LB_CEF3_RequestSetReferrer(request, L"https://invalid.test/", -1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  std::array<LB_CEF3_ARGUMENT_V4, 3> request_header_arguments{};
  for (auto& argument : request_header_arguments) argument.struct_size = sizeof(argument);
  request_header_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_header_arguments[0].text_value = L"X-LingBuilder-Request";
  request_header_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_header_arguments[1].text_value = L"request-v4";
  request_header_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  request_header_arguments[2].integer_value = 1;
  LB_CEF3_CALL_V4 request_set_header_call{};
  request_set_header_call.struct_size = sizeof(request_set_header_call);
  request_set_header_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_header_call.operation_id = UINT64_C(0x7f66f138b832b4fd);
  request_set_header_call.target = request;
  request_set_header_call.argument_count = static_cast<uint32_t>(request_header_arguments.size());
  request_set_header_call.arguments = request_header_arguments.data();
  LB_CEF3_RESULT_V4 request_set_header_result{};
  request_set_header_result.struct_size = sizeof(request_set_header_result);
  assert(LB_CEF3_InvokeV4(&request_set_header_call, &request_set_header_result) == LB_CEF3_OK);
  assert(request_set_header_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_CALL_V4 request_get_header_call{};
  request_get_header_call.struct_size = sizeof(request_get_header_call);
  request_get_header_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_header_call.operation_id = UINT64_C(0xc68a1f00e2eae224);
  request_get_header_call.target = request;
  request_get_header_call.argument_count = 1;
  request_get_header_call.arguments = request_header_arguments.data();
  LB_CEF3_RESULT_V4 request_get_header_result{};
  request_get_header_result.struct_size = sizeof(request_get_header_result);
  assert(LB_CEF3_InvokeV4(&request_get_header_call, &request_get_header_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring request_header_v4(request_get_header_result.text_required, L'\0');
  request_get_header_result.text = request_header_v4.data();
  request_get_header_result.text_capacity = request_header_v4.size();
  assert(LB_CEF3_InvokeV4(&request_get_header_call, &request_get_header_result) == LB_CEF3_OK);
  assert(request_get_header_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(request_header_v4.c_str()) == L"request-v4");

  LB_CEF3_ARGUMENT_V4 request_header_map_argument{};
  request_header_map_argument.struct_size = sizeof(request_header_map_argument);
  request_header_map_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  request_header_map_argument.handle_value = request_headers;
  LB_CEF3_CALL_V4 request_set_header_map_call{};
  request_set_header_map_call.struct_size = sizeof(request_set_header_map_call);
  request_set_header_map_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_header_map_call.operation_id = UINT64_C(0x15632503580045fa);
  request_set_header_map_call.target = request;
  request_set_header_map_call.argument_count = 1;
  request_set_header_map_call.arguments = &request_header_map_argument;
  LB_CEF3_RESULT_V4 request_set_header_map_result{};
  request_set_header_map_result.struct_size = sizeof(request_set_header_map_result);
  assert(LB_CEF3_InvokeV4(&request_set_header_map_call, &request_set_header_map_result)
      == LB_CEF3_OK);
  assert(request_set_header_map_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 request_get_header_map_call{};
  request_get_header_map_call.struct_size = sizeof(request_get_header_map_call);
  request_get_header_map_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_header_map_call.operation_id = UINT64_C(0x1012f1339520238c);
  request_get_header_map_call.target = request;
  LB_CEF3_RESULT_V4 request_get_header_map_result{};
  request_get_header_map_result.struct_size = sizeof(request_get_header_map_result);
  assert(LB_CEF3_InvokeV4(&request_get_header_map_call, &request_get_header_map_result)
      == LB_CEF3_OK);
  assert(request_get_header_map_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_ListGetSize(request_get_header_map_result.handle_value) == 3);
  assert(ReadHeaderMapField(
             request_get_header_map_result.handle_value, 1, L"value") == L"second");
  assert(LB_CEF3_ListRelease(request_get_header_map_result.handle_value) == LB_CEF3_OK);

  request_header_map_argument.handle_value = malformed_request_headers;
  request_set_header_map_result = {};
  request_set_header_map_result.struct_size = sizeof(request_set_header_map_result);
  assert(LB_CEF3_InvokeV4(&request_set_header_map_call, &request_set_header_map_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  request_header_map_argument.handle_value = request_post_data;
  assert(LB_CEF3_InvokeV4(&request_set_header_map_call, &request_set_header_map_result)
      == LB_CEF3_ERROR_HANDLE_TYPE);
  request_header_map_argument.handle_value = request_headers;

  std::array<LB_CEF3_ARGUMENT_V4, 4> request_set_arguments{};
  for (auto& argument : request_set_arguments) argument.struct_size = sizeof(argument);
  request_set_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_set_arguments[0].text_value = L"https://lingbuilder.test/request-composite-v4";
  request_set_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_set_arguments[1].text_value = L"DELETE";
  request_set_arguments[2].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  request_set_arguments[2].handle_value = 0;
  request_set_arguments[3].value_kind = LB_CEF3_VALUE_V4_HANDLE;
  request_set_arguments[3].handle_value = request_headers;
  LB_CEF3_CALL_V4 request_set_call{};
  request_set_call.struct_size = sizeof(request_set_call);
  request_set_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_call.operation_id = UINT64_C(0x233fa7b155e08177);
  request_set_call.target = request;
  request_set_call.argument_count = static_cast<uint32_t>(request_set_arguments.size());
  request_set_call.arguments = request_set_arguments.data();
  LB_CEF3_RESULT_V4 request_set_result{};
  request_set_result.struct_size = sizeof(request_set_result);
  assert(LB_CEF3_InvokeV4(&request_set_call, &request_set_result) == LB_CEF3_OK);
  assert(request_set_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetUrl(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"https://lingbuilder.test/request-composite-v4");
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetMethod(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"DELETE");

  LB_CEF3_ARGUMENT_V4 request_first_party_argument{};
  request_first_party_argument.struct_size = sizeof(request_first_party_argument);
  request_first_party_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_first_party_argument.text_value = L"https://cookies-v4.lingbuilder.test/";
  LB_CEF3_CALL_V4 request_set_first_party_call{};
  request_set_first_party_call.struct_size = sizeof(request_set_first_party_call);
  request_set_first_party_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_first_party_call.operation_id = UINT64_C(0xcbb471409b835a74);
  request_set_first_party_call.target = request;
  request_set_first_party_call.argument_count = 1;
  request_set_first_party_call.arguments = &request_first_party_argument;
  LB_CEF3_RESULT_V4 request_set_first_party_result{};
  request_set_first_party_result.struct_size = sizeof(request_set_first_party_result);
  assert(LB_CEF3_InvokeV4(&request_set_first_party_call, &request_set_first_party_result)
      == LB_CEF3_OK);

  LB_CEF3_CALL_V4 request_get_first_party_call{};
  request_get_first_party_call.struct_size = sizeof(request_get_first_party_call);
  request_get_first_party_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_first_party_call.operation_id = UINT64_C(0x33b064350bee2165);
  request_get_first_party_call.target = request;
  LB_CEF3_RESULT_V4 request_get_first_party_result{};
  request_get_first_party_result.struct_size = sizeof(request_get_first_party_result);
  assert(LB_CEF3_InvokeV4(&request_get_first_party_call, &request_get_first_party_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring request_first_party_v4(request_get_first_party_result.text_required, L'\0');
  request_get_first_party_result.text = request_first_party_v4.data();
  request_get_first_party_result.text_capacity = request_first_party_v4.size();
  assert(LB_CEF3_InvokeV4(&request_get_first_party_call, &request_get_first_party_result)
      == LB_CEF3_OK);
  assert(request_get_first_party_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(request_first_party_v4.c_str())
      == L"https://lingbuilder.test/");

  std::array<LB_CEF3_ARGUMENT_V4, 2> request_referrer_arguments{};
  for (auto& argument : request_referrer_arguments) argument.struct_size = sizeof(argument);
  request_referrer_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  request_referrer_arguments[0].text_value = L"https://referrer-v4.lingbuilder.test/source";
  request_referrer_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  request_referrer_arguments[1].integer_value = 3;
  LB_CEF3_CALL_V4 request_set_referrer_call{};
  request_set_referrer_call.struct_size = sizeof(request_set_referrer_call);
  request_set_referrer_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_referrer_call.operation_id = UINT64_C(0x71fc646b59737171);
  request_set_referrer_call.target = request;
  request_set_referrer_call.argument_count = 2;
  request_set_referrer_call.arguments = request_referrer_arguments.data();
  LB_CEF3_RESULT_V4 request_set_referrer_result{};
  request_set_referrer_result.struct_size = sizeof(request_set_referrer_result);
  assert(LB_CEF3_InvokeV4(&request_set_referrer_call, &request_set_referrer_result)
      == LB_CEF3_OK);
  request_referrer_arguments[1].integer_value = 8;
  assert(LB_CEF3_InvokeV4(&request_set_referrer_call, &request_set_referrer_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  request_referrer_arguments[1].integer_value = 3;

  LB_CEF3_ARGUMENT_V4 request_post_data_argument{};
  request_post_data_argument.struct_size = sizeof(request_post_data_argument);
  request_post_data_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  request_post_data_argument.handle_value = request_post_data;
  LB_CEF3_CALL_V4 request_set_post_data_call{};
  request_set_post_data_call.struct_size = sizeof(request_set_post_data_call);
  request_set_post_data_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_post_data_call.operation_id = UINT64_C(0xe1ab3a291a8d3dd2);
  request_set_post_data_call.target = request;
  request_set_post_data_call.argument_count = 1;
  request_set_post_data_call.arguments = &request_post_data_argument;
  LB_CEF3_RESULT_V4 request_set_post_data_result{};
  request_set_post_data_result.struct_size = sizeof(request_set_post_data_result);
  assert(LB_CEF3_InvokeV4(&request_set_post_data_call, &request_set_post_data_result)
      == LB_CEF3_OK);
  assert(request_set_post_data_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 request_get_post_data_call{};
  request_get_post_data_call.struct_size = sizeof(request_get_post_data_call);
  request_get_post_data_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_get_post_data_call.operation_id = UINT64_C(0x1a4b00c8d7e0de65);
  request_get_post_data_call.target = request;
  LB_CEF3_RESULT_V4 request_get_post_data_result{};
  request_get_post_data_result.struct_size = sizeof(request_get_post_data_result);
  assert(LB_CEF3_InvokeV4(&request_get_post_data_call, &request_get_post_data_result)
      == LB_CEF3_OK);
  assert(request_get_post_data_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(request_get_post_data_result.handle_value)
      == LB_CEF3_HANDLE_POST_DATA);
  assert(LB_CEF3_HandleRelease(request_get_post_data_result.handle_value) == LB_CEF3_OK);
  request_post_data_argument.handle_value = 0;
  assert(LB_CEF3_InvokeV4(&request_set_post_data_call, &request_set_post_data_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  const auto retained_request_post_data = LB_CEF3_RequestGetPostData(request);
  assert(retained_request_post_data != 0);
  assert(LB_CEF3_PostDataGetElementCount(retained_request_post_data) == 1);
  assert(LB_CEF3_HandleRelease(retained_request_post_data) == LB_CEF3_OK);

  assert(LB_CEF3_RequestSetFlags(request, 0x05) == LB_CEF3_OK);
  assert(LB_CEF3_RequestGetFlags(request) == 0x05);
  const int64_t request_identifier = LB_CEF3_RequestGetIdentifier(request);
  assert(request_identifier >= 0);
  request_text.fill(L'\0');
  assert(LB_CEF3_RequestGetReferrerUrl(
             request, request_text.data(), request_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(request_text.data()) == L"https://referrer-v4.lingbuilder.test/source");
  const int request_referrer_policy = LB_CEF3_RequestGetReferrerPolicy(request);
  const int request_resource_type = LB_CEF3_RequestGetResourceType(request);
  const int request_transition_type = LB_CEF3_RequestGetTransitionType(request);

  LB_CEF3_CALL_V4 request_metadata_call{};
  request_metadata_call.struct_size = sizeof(request_metadata_call);
  request_metadata_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_metadata_call.target = request;
  LB_CEF3_RESULT_V4 request_metadata_result{};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  request_metadata_call.operation_id = UINT64_C(0x6dde1a793062030b);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(request_metadata_result.integer_value == 0x05);

  LB_CEF3_ARGUMENT_V4 request_flags_argument{};
  request_flags_argument.struct_size = sizeof(request_flags_argument);
  request_flags_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  request_flags_argument.integer_value = 0x12;
  LB_CEF3_CALL_V4 request_set_flags_call{};
  request_set_flags_call.struct_size = sizeof(request_set_flags_call);
  request_set_flags_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_set_flags_call.operation_id = UINT64_C(0xbc56ca9509138f6b);
  request_set_flags_call.target = request;
  request_set_flags_call.argument_count = 1;
  request_set_flags_call.arguments = &request_flags_argument;
  LB_CEF3_RESULT_V4 request_set_flags_result{};
  request_set_flags_result.struct_size = sizeof(request_set_flags_result);
  assert(LB_CEF3_InvokeV4(&request_set_flags_call, &request_set_flags_result) == LB_CEF3_OK);
  assert(request_set_flags_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_RequestGetFlags(request) == 0x12);

  request_metadata_call.operation_id = UINT64_C(0x14a5ba6ec6fe5c65);
  request_metadata_result = {};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.integer_value == request_identifier);

  request_metadata_call.operation_id = UINT64_C(0xaf1f79540e83a06b);
  request_metadata_result = {};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring request_referrer_url_v4(request_metadata_result.text_required, L'\0');
  request_metadata_result.text = request_referrer_url_v4.data();
  request_metadata_result.text_capacity = request_referrer_url_v4.size();
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(request_referrer_url_v4.c_str())
      == L"https://referrer-v4.lingbuilder.test/source");

  request_metadata_call.operation_id = UINT64_C(0xa9de0e4db677979d);
  request_metadata_result = {};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.integer_value == request_referrer_policy);

  request_metadata_call.operation_id = UINT64_C(0x93ddf19680ef8166);
  request_metadata_result = {};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.integer_value == request_resource_type);

  request_metadata_call.operation_id = UINT64_C(0x22577cea3561ac11);
  request_metadata_result = {};
  request_metadata_result.struct_size = sizeof(request_metadata_result);
  assert(LB_CEF3_InvokeV4(&request_metadata_call, &request_metadata_result) == LB_CEF3_OK);
  assert(request_metadata_result.integer_value == request_transition_type);

  constexpr LB_CEF3_HANDLE invalid_request_handle = UINT64_C(0x7fffffffffffff04);
  assert(LB_CEF3_RequestIsReadOnly(invalid_request_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetUrl(
             invalid_request_handle, request_text.data(), request_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetUrl(invalid_request_handle, L"https://invalid.test/")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetMethod(
             invalid_request_handle, request_text.data(), request_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetMethod(invalid_request_handle, L"GET")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetFirstPartyForCookies(
             invalid_request_handle, request_text.data(), request_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetHeaderMap(invalid_request_handle) == 0);
  assert(LB_CEF3_RequestGetHeaderByName(
             invalid_request_handle, L"X-LingBuilder-Request",
             request_text.data(), request_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetHeaderByName(
             invalid_request_handle, L"X-LingBuilder-Request", L"invalid", 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSet(
             invalid_request_handle, L"https://invalid.test/", L"GET", 0,
             request_headers) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetFirstPartyForCookies(
             invalid_request_handle, L"https://invalid.test/")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetHeaderMap(invalid_request_handle, request_headers)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetReferrer(
             invalid_request_handle, L"https://invalid.test/", 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetFlags(invalid_request_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestSetFlags(invalid_request_handle, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetIdentifier(invalid_request_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetReferrerUrl(
             invalid_request_handle, request_text.data(), request_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetReferrerPolicy(invalid_request_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetResourceType(invalid_request_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetTransitionType(invalid_request_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_RequestGetPostData(invalid_request_handle) == 0);
  assert(LB_CEF3_RequestSetPostData(invalid_request_handle, request_post_data)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ListRelease(malformed_request_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(empty_request_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(request_headers) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(request_post_data_element) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(request_post_data) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(request) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 request_call{};
  request_call.struct_size = sizeof(request_call);
  request_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  request_call.operation_id = UINT64_C(0x32f2e7958e2fa3f7);
  LB_CEF3_RESULT_V4 request_result{};
  request_result.struct_size = sizeof(request_result);
  assert(LB_CEF3_InvokeV4(&request_call, &request_result) == LB_CEF3_OK);
  assert(request_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(request_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(request_result.handle_value) == LB_CEF3_HANDLE_REQUEST);
  assert(LB_CEF3_HandleRelease(request_result.handle_value) == LB_CEF3_OK);
  const auto response = LB_CEF3_ResponseCreate();
  assert(response != 0);
  assert(LB_CEF3_HandleGetType(response) == LB_CEF3_HANDLE_RESPONSE);
  assert(LB_CEF3_HandleIsValid(response, LB_CEF3_HANDLE_RESPONSE) == LB_CEF3_OK);
  assert(LB_CEF3_ResponseIsReadOnly(response) == 0);
  assert(LB_CEF3_ResponseSetError(response, -2) == LB_CEF3_OK);
  assert(LB_CEF3_ResponseGetError(response) == -2);
  assert(LB_CEF3_ResponseSetStatus(response, 201) == LB_CEF3_OK);
  assert(LB_CEF3_ResponseGetStatus(response) == 201);
  assert(LB_CEF3_ResponseSetStatusText(response, L"Created") == LB_CEF3_OK);
  std::array<wchar_t, 256> response_text{};
  assert(LB_CEF3_ResponseGetStatusText(
             response, response_text.data(), response_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"Created");

  LB_CEF3_CALL_V4 response_read_only_call{};
  response_read_only_call.struct_size = sizeof(response_read_only_call);
  response_read_only_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_read_only_call.operation_id = UINT64_C(0xbbcb873bc7cc3c3e);
  response_read_only_call.target = response;
  LB_CEF3_RESULT_V4 response_read_only_result{};
  response_read_only_result.struct_size = sizeof(response_read_only_result);
  assert(LB_CEF3_InvokeV4(&response_read_only_call, &response_read_only_result) == LB_CEF3_OK);
  assert(response_read_only_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(response_read_only_result.integer_value == 0);

  LB_CEF3_CALL_V4 response_get_error_call{};
  response_get_error_call.struct_size = sizeof(response_get_error_call);
  response_get_error_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_get_error_call.operation_id = UINT64_C(0xb36c095473d49853);
  response_get_error_call.target = response;
  LB_CEF3_RESULT_V4 response_get_error_result{};
  response_get_error_result.struct_size = sizeof(response_get_error_result);
  assert(LB_CEF3_InvokeV4(&response_get_error_call, &response_get_error_result) == LB_CEF3_OK);
  assert(response_get_error_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(response_get_error_result.integer_value == -2);

  LB_CEF3_ARGUMENT_V4 response_integer_argument{};
  response_integer_argument.struct_size = sizeof(response_integer_argument);
  response_integer_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  response_integer_argument.integer_value = -7;
  LB_CEF3_CALL_V4 response_set_error_call{};
  response_set_error_call.struct_size = sizeof(response_set_error_call);
  response_set_error_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_error_call.operation_id = UINT64_C(0xb9190d531ef65451);
  response_set_error_call.target = response;
  response_set_error_call.argument_count = 1;
  response_set_error_call.arguments = &response_integer_argument;
  LB_CEF3_RESULT_V4 response_set_error_result{};
  response_set_error_result.struct_size = sizeof(response_set_error_result);
  assert(LB_CEF3_InvokeV4(&response_set_error_call, &response_set_error_result) == LB_CEF3_OK);
  assert(response_set_error_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_ResponseGetError(response) == -7);

  LB_CEF3_CALL_V4 response_get_status_call{};
  response_get_status_call.struct_size = sizeof(response_get_status_call);
  response_get_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_get_status_call.operation_id = UINT64_C(0x0eeb24c06a3623f2);
  response_get_status_call.target = response;
  LB_CEF3_RESULT_V4 response_get_status_result{};
  response_get_status_result.struct_size = sizeof(response_get_status_result);
  assert(LB_CEF3_InvokeV4(&response_get_status_call, &response_get_status_result) == LB_CEF3_OK);
  assert(response_get_status_result.integer_value == 201);

  response_integer_argument.integer_value = 202;
  LB_CEF3_CALL_V4 response_set_status_call{};
  response_set_status_call.struct_size = sizeof(response_set_status_call);
  response_set_status_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_status_call.operation_id = UINT64_C(0xc83586225f0a942b);
  response_set_status_call.target = response;
  response_set_status_call.argument_count = 1;
  response_set_status_call.arguments = &response_integer_argument;
  LB_CEF3_RESULT_V4 response_set_status_result{};
  response_set_status_result.struct_size = sizeof(response_set_status_result);
  assert(LB_CEF3_InvokeV4(&response_set_status_call, &response_set_status_result) == LB_CEF3_OK);
  assert(response_set_status_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_ResponseGetStatus(response) == 202);

  LB_CEF3_CALL_V4 response_get_status_text_call{};
  response_get_status_text_call.struct_size = sizeof(response_get_status_text_call);
  response_get_status_text_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_get_status_text_call.operation_id = UINT64_C(0xde3d43ff146318c2);
  response_get_status_text_call.target = response;
  LB_CEF3_RESULT_V4 response_get_status_text_result{};
  response_get_status_text_result.struct_size = sizeof(response_get_status_text_result);
  assert(LB_CEF3_InvokeV4(&response_get_status_text_call, &response_get_status_text_result)
      == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
  std::wstring response_status_text_v4(response_get_status_text_result.text_required, L'\0');
  response_get_status_text_result.text = response_status_text_v4.data();
  response_get_status_text_result.text_capacity = response_status_text_v4.size();
  assert(LB_CEF3_InvokeV4(&response_get_status_text_call, &response_get_status_text_result)
      == LB_CEF3_OK);
  assert(response_get_status_text_result.value_kind == LB_CEF3_VALUE_V4_TEXT);
  assert(std::wstring(response_status_text_v4.c_str()) == L"Created");

  LB_CEF3_ARGUMENT_V4 response_text_argument{};
  response_text_argument.struct_size = sizeof(response_text_argument);
  response_text_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  response_text_argument.text_value = L"Accepted";
  LB_CEF3_CALL_V4 response_set_status_text_call{};
  response_set_status_text_call.struct_size = sizeof(response_set_status_text_call);
  response_set_status_text_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_status_text_call.operation_id = UINT64_C(0x0f7b23c64948de03);
  response_set_status_text_call.target = response;
  response_set_status_text_call.argument_count = 1;
  response_set_status_text_call.arguments = &response_text_argument;
  LB_CEF3_RESULT_V4 response_set_status_text_result{};
  response_set_status_text_result.struct_size = sizeof(response_set_status_text_result);
  assert(LB_CEF3_InvokeV4(&response_set_status_text_call, &response_set_status_text_result)
      == LB_CEF3_OK);
  assert(response_set_status_text_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetStatusText(
             response, response_text.data(), response_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"Accepted");

  assert(LB_CEF3_ResponseSetMimeType(response, L"text/plain") == LB_CEF3_OK);
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetMimeType(
             response, response_text.data(), response_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"text/plain");
  assert(LB_CEF3_ResponseSetCharset(response, L"utf-8") == LB_CEF3_OK);
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetCharset(
             response, response_text.data(), response_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"utf-8");
  assert(LB_CEF3_ResponseSetUrl(response, L"https://lingbuilder.test/response") == LB_CEF3_OK);
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetUrl(
             response, response_text.data(), response_text.size(), &required) == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"https://lingbuilder.test/response");
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetHeaderByName(
             response, L"X-LingBuilder-Unset", response_text.data(), response_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(response_text.data()).empty());
  assert(LB_CEF3_ResponseSetHeaderByName(
             response, L"X-LingBuilder-Response", L"response-cabi", 1) == LB_CEF3_OK);
  response_text.fill(L'\0');
  assert(LB_CEF3_ResponseGetHeaderByName(
             response, L"X-LingBuilder-Response", response_text.data(), response_text.size(), &required)
      == LB_CEF3_OK);
  assert(std::wstring(response_text.data()) == L"response-cabi");
  assert(LB_CEF3_ResponseSetHeaderByName(response, L"", L"invalid", 1)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);

  const auto response_headers = CreateHeaderMapList({
      {L"Set-Cookie", L"session=one"},
      {L"Set-Cookie", L"session=two"},
      {L"X-LingBuilder-Response", L"mapped"}});
  assert(LB_CEF3_ResponseSetHeaderMap(response, response_headers) == LB_CEF3_OK);
  auto response_headers_copy = LB_CEF3_ResponseGetHeaderMap(response);
  assert(response_headers_copy != 0);
  assert(LB_CEF3_HandleGetType(response_headers_copy) == LB_CEF3_HANDLE_LIST);
  assert(LB_CEF3_ListGetSize(response_headers_copy) == 3);
  assert(ReadHeaderMapField(response_headers_copy, 0, L"name") == L"Set-Cookie");
  assert(ReadHeaderMapField(response_headers_copy, 0, L"value") == L"session=one");
  assert(ReadHeaderMapField(response_headers_copy, 1, L"value") == L"session=two");
  assert(ReadHeaderMapField(response_headers_copy, 2, L"name")
      == L"X-LingBuilder-Response");
  assert(LB_CEF3_ListRelease(response_headers_copy) == LB_CEF3_OK);
  const auto empty_response_headers = CreateHeaderMapList({});
  assert(LB_CEF3_ResponseSetHeaderMap(response, empty_response_headers) == LB_CEF3_OK);
  response_headers_copy = LB_CEF3_ResponseGetHeaderMap(response);
  assert(response_headers_copy != 0 && LB_CEF3_ListGetSize(response_headers_copy) == 0);
  assert(LB_CEF3_ListRelease(response_headers_copy) == LB_CEF3_OK);
  const auto malformed_response_headers = CreateTextList({L"invalid"});
  assert(LB_CEF3_ResponseSetHeaderMap(response, malformed_response_headers)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_ResponseSetHeaderMap(response, response) == LB_CEF3_ERROR_HANDLE_TYPE);
  const auto released_response_headers = CreateHeaderMapList({});
  assert(LB_CEF3_ListRelease(released_response_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ResponseSetHeaderMap(response, released_response_headers)
      == LB_CEF3_ERROR_RELEASED_HANDLE);

  LB_CEF3_ARGUMENT_V4 response_property_argument{};
  response_property_argument.struct_size = sizeof(response_property_argument);
  response_property_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  LB_CEF3_CALL_V4 response_set_property_call{};
  response_set_property_call.struct_size = sizeof(response_set_property_call);
  response_set_property_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_property_call.target = response;
  response_set_property_call.argument_count = 1;
  response_set_property_call.arguments = &response_property_argument;
  LB_CEF3_RESULT_V4 response_set_property_result{};
  response_set_property_result.struct_size = sizeof(response_set_property_result);
  response_property_argument.text_value = L"application/json";
  response_set_property_call.operation_id = UINT64_C(0xc57f9ca1174bc661);
  assert(LB_CEF3_InvokeV4(&response_set_property_call, &response_set_property_result) == LB_CEF3_OK);
  assert(response_set_property_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  response_property_argument.text_value = L"utf-16";
  response_set_property_call.operation_id = UINT64_C(0x9626c07d2b209dda);
  response_set_property_result = {};
  response_set_property_result.struct_size = sizeof(response_set_property_result);
  assert(LB_CEF3_InvokeV4(&response_set_property_call, &response_set_property_result) == LB_CEF3_OK);
  assert(response_set_property_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  response_property_argument.text_value = L"https://lingbuilder.test/response-v4";
  response_set_property_call.operation_id = UINT64_C(0xf8f12e359bf0f18a);
  response_set_property_result = {};
  response_set_property_result.struct_size = sizeof(response_set_property_result);
  assert(LB_CEF3_InvokeV4(&response_set_property_call, &response_set_property_result) == LB_CEF3_OK);
  assert(response_set_property_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  std::array<LB_CEF3_ARGUMENT_V4, 3> response_header_arguments{};
  for (auto& argument : response_header_arguments) argument.struct_size = sizeof(argument);
  response_header_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  response_header_arguments[0].text_value = L"X-LingBuilder-Response";
  response_header_arguments[1].value_kind = LB_CEF3_VALUE_V4_TEXT;
  response_header_arguments[1].text_value = L"response-v4";
  response_header_arguments[2].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  response_header_arguments[2].integer_value = 1;
  LB_CEF3_CALL_V4 response_set_header_call{};
  response_set_header_call.struct_size = sizeof(response_set_header_call);
  response_set_header_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_header_call.operation_id = UINT64_C(0xce8a8e59d16d3735);
  response_set_header_call.target = response;
  response_set_header_call.argument_count = static_cast<uint32_t>(response_header_arguments.size());
  response_set_header_call.arguments = response_header_arguments.data();
  LB_CEF3_RESULT_V4 response_set_header_result{};
  response_set_header_result.struct_size = sizeof(response_set_header_result);
  assert(LB_CEF3_InvokeV4(&response_set_header_call, &response_set_header_result) == LB_CEF3_OK);
  assert(response_set_header_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_ARGUMENT_V4 response_header_map_argument{};
  response_header_map_argument.struct_size = sizeof(response_header_map_argument);
  response_header_map_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  response_header_map_argument.handle_value = response_headers;
  LB_CEF3_CALL_V4 response_set_header_map_call{};
  response_set_header_map_call.struct_size = sizeof(response_set_header_map_call);
  response_set_header_map_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_set_header_map_call.operation_id = UINT64_C(0x0d68021747428c95);
  response_set_header_map_call.target = response;
  response_set_header_map_call.argument_count = 1;
  response_set_header_map_call.arguments = &response_header_map_argument;
  LB_CEF3_RESULT_V4 response_set_header_map_result{};
  response_set_header_map_result.struct_size = sizeof(response_set_header_map_result);
  assert(LB_CEF3_InvokeV4(&response_set_header_map_call, &response_set_header_map_result)
      == LB_CEF3_OK);
  assert(response_set_header_map_result.value_kind == LB_CEF3_VALUE_V4_VOID);

  LB_CEF3_CALL_V4 response_get_header_map_call{};
  response_get_header_map_call.struct_size = sizeof(response_get_header_map_call);
  response_get_header_map_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_get_header_map_call.operation_id = UINT64_C(0xb3e0d5a8fcfaebb7);
  response_get_header_map_call.target = response;
  LB_CEF3_RESULT_V4 response_get_header_map_result{};
  response_get_header_map_result.struct_size = sizeof(response_get_header_map_result);
  assert(LB_CEF3_InvokeV4(&response_get_header_map_call, &response_get_header_map_result)
      == LB_CEF3_OK);
  assert(response_get_header_map_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_ListGetSize(response_get_header_map_result.handle_value) == 3);
  assert(ReadHeaderMapField(
             response_get_header_map_result.handle_value, 1, L"value") == L"session=two");
  assert(LB_CEF3_ListRelease(response_get_header_map_result.handle_value) == LB_CEF3_OK);
  response_header_map_argument.handle_value = malformed_response_headers;
  assert(LB_CEF3_InvokeV4(&response_set_header_map_call, &response_set_header_map_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  response_header_map_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  assert(LB_CEF3_InvokeV4(&response_set_header_map_call, &response_set_header_map_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  response_header_map_argument.value_kind = LB_CEF3_VALUE_V4_HANDLE;
  response_header_map_argument.handle_value = response_headers;

  const auto assert_response_text_v4 = [response](
      uint64_t operation_id, const LB_CEF3_ARGUMENT_V4* arguments,
      uint32_t argument_count, const wchar_t* expected) {
    LB_CEF3_CALL_V4 call{};
    call.struct_size = sizeof(call);
    call.abi_version = LB_CEF3_ABI_VERSION_V4;
    call.operation_id = operation_id;
    call.target = response;
    call.argument_count = argument_count;
    call.arguments = arguments;
    LB_CEF3_RESULT_V4 result{};
    result.struct_size = sizeof(result);
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_ERROR_BUFFER_TOO_SMALL);
    std::wstring value(result.text_required, L'\0');
    result.text = value.data();
    result.text_capacity = value.size();
    assert(LB_CEF3_InvokeV4(&call, &result) == LB_CEF3_OK);
    assert(result.value_kind == LB_CEF3_VALUE_V4_TEXT);
    assert(std::wstring(value.c_str()) == expected);
  };
  assert_response_text_v4(UINT64_C(0xac74167c01c78e94), nullptr, 0, L"application/json");
  assert_response_text_v4(UINT64_C(0x2aa643953601d334), nullptr, 0, L"utf-16");
  assert_response_text_v4(
      UINT64_C(0x546ae940f1d2435e), nullptr, 0, L"https://lingbuilder.test/response-v4");
  LB_CEF3_ARGUMENT_V4 response_header_name_argument{};
  response_header_name_argument.struct_size = sizeof(response_header_name_argument);
  response_header_name_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  response_header_name_argument.text_value = L"X-LingBuilder-Response";
  assert_response_text_v4(
      UINT64_C(0x7d301ce4166bb44c), &response_header_name_argument, 1, L"mapped");
  response_header_name_argument.text_value = L"X-LingBuilder-Unset";
  assert_response_text_v4(
      UINT64_C(0x7d301ce4166bb44c), &response_header_name_argument, 1, L"");

  constexpr LB_CEF3_HANDLE invalid_response_handle = UINT64_C(0x7fffffffffffff05);
  assert(LB_CEF3_ResponseIsReadOnly(invalid_response_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetError(invalid_response_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetError(invalid_response_handle, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetStatus(invalid_response_handle) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetStatus(invalid_response_handle, 200) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetStatusText(
             invalid_response_handle, response_text.data(), response_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetStatusText(invalid_response_handle, L"OK")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetMimeType(
             invalid_response_handle, response_text.data(), response_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetMimeType(invalid_response_handle, L"text/plain")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetCharset(
             invalid_response_handle, response_text.data(), response_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetCharset(invalid_response_handle, L"utf-8")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetUrl(
             invalid_response_handle, response_text.data(), response_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetUrl(invalid_response_handle, L"https://invalid.test/")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetHeaderByName(
             invalid_response_handle, L"X-LingBuilder-Unset",
             response_text.data(), response_text.size(), &required)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseGetHeaderMap(invalid_response_handle) == 0);
  assert(LB_CEF3_ResponseSetHeaderByName(
             invalid_response_handle, L"X-LingBuilder-Response", L"invalid", 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ResponseSetHeaderMap(invalid_response_handle, response_headers)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ListRelease(malformed_response_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(empty_response_headers) == LB_CEF3_OK);
  assert(LB_CEF3_ListRelease(response_headers) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(response) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 response_call{};
  response_call.struct_size = sizeof(response_call);
  response_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  response_call.operation_id = UINT64_C(0x40fb225fb62bd7cc);
  LB_CEF3_RESULT_V4 response_result{};
  response_result.struct_size = sizeof(response_result);
  assert(LB_CEF3_InvokeV4(&response_call, &response_result) == LB_CEF3_OK);
  assert(response_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(response_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(response_result.handle_value) == LB_CEF3_HANDLE_RESPONSE);
  assert(LB_CEF3_HandleRelease(response_result.handle_value) == LB_CEF3_OK);
  const auto shared_builder = LB_CEF3_SharedProcessMessageBuilderCreate(L"LingBuilder.Shared", 64);
  assert(shared_builder != 0);
  assert(LB_CEF3_HandleGetType(shared_builder) == LB_CEF3_HANDLE_SHARED_PROCESS_MESSAGE_BUILDER);
  assert(LB_CEF3_HandleIsValid(shared_builder, LB_CEF3_HANDLE_SHARED_PROCESS_MESSAGE_BUILDER) == LB_CEF3_OK);
  assert(LB_CEF3_SharedProcessMessageBuilderIsValid(shared_builder) == 1);
  assert(LB_CEF3_SharedProcessMessageBuilderSize(shared_builder) == 64);
  const auto shared_builder_memory = LB_CEF3_SharedProcessMessageBuilderMemory(shared_builder);
  assert(shared_builder_memory != 0);
  assert(LB_CEF3_HandleGetType(shared_builder_memory) == LB_CEF3_HANDLE_BUFFER);
  uint64_t shared_buffer_size = 0;
  assert(LB_CEF3_BufferGetSize(shared_builder_memory, &shared_buffer_size) == LB_CEF3_OK);
  assert(shared_buffer_size == 64);
  const auto shared_message = LB_CEF3_SharedProcessMessageBuilderBuild(shared_builder);
  assert(shared_message != 0);
  assert(LB_CEF3_SharedProcessMessageBuilderIsValid(shared_builder) == 0);
  assert(LB_CEF3_SharedProcessMessageBuilderSize(shared_builder) == 0);
  assert(LB_CEF3_SharedProcessMessageBuilderMemory(shared_builder) == 0);
  assert(LB_CEF3_SharedProcessMessageBuilderBuild(shared_builder) == 0);
  assert(LB_CEF3_ProcessMessageIsValid(shared_message) == 1);
  assert(LB_CEF3_ProcessMessageCopy(shared_message) == 0);
  assert(LB_CEF3_ProcessMessageGetArgumentList(shared_message) == 0);
  const auto shared_region = LB_CEF3_ProcessMessageGetSharedMemoryRegion(shared_message);
  assert(shared_region != 0);
  assert(LB_CEF3_HandleGetType(shared_region) == LB_CEF3_HANDLE_SHARED_MEMORY_REGION);
  assert(LB_CEF3_SharedMemoryRegionIsValid(shared_region) == 1);
  assert(LB_CEF3_SharedMemoryRegionSize(shared_region) == 64);
  const auto shared_region_memory = LB_CEF3_SharedMemoryRegionMemory(shared_region);
  assert(shared_region_memory != 0);
  assert(LB_CEF3_BufferGetSize(shared_region_memory, &shared_buffer_size) == LB_CEF3_OK);
  assert(shared_buffer_size == 64);
  assert(LB_CEF3_BufferIsEqual(shared_builder_memory, shared_region_memory) == 1);
  assert(LB_CEF3_BufferRelease(shared_region_memory) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(shared_region) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(shared_message) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(shared_builder_memory) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(shared_builder) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 shared_builder_arguments[2]{};
  shared_builder_arguments[0].struct_size = sizeof(shared_builder_arguments[0]);
  shared_builder_arguments[0].value_kind = LB_CEF3_VALUE_V4_TEXT;
  shared_builder_arguments[0].text_value = L"LingBuilder.Shared.V4";
  shared_builder_arguments[1].struct_size = sizeof(shared_builder_arguments[1]);
  shared_builder_arguments[1].value_kind = LB_CEF3_VALUE_V4_INTEGER;
  shared_builder_arguments[1].integer_value = 64;
  LB_CEF3_CALL_V4 shared_builder_call{};
  shared_builder_call.struct_size = sizeof(shared_builder_call);
  shared_builder_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_builder_call.operation_id = UINT64_C(0x24c722e5a4a04a59);
  shared_builder_call.arguments = shared_builder_arguments;
  shared_builder_call.argument_count = 2;
  LB_CEF3_RESULT_V4 shared_builder_result{};
  shared_builder_result.struct_size = sizeof(shared_builder_result);
  assert(LB_CEF3_InvokeV4(&shared_builder_call, &shared_builder_result) == LB_CEF3_OK);
  assert(shared_builder_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(shared_builder_result.handle_value != 0);
  assert(LB_CEF3_HandleGetType(shared_builder_result.handle_value)
      == LB_CEF3_HANDLE_SHARED_PROCESS_MESSAGE_BUILDER);

  LB_CEF3_CALL_V4 shared_builder_valid_call{};
  shared_builder_valid_call.struct_size = sizeof(shared_builder_valid_call);
  shared_builder_valid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_builder_valid_call.operation_id = UINT64_C(0xba63c225d196ca1b);
  shared_builder_valid_call.target = shared_builder_result.handle_value;
  LB_CEF3_RESULT_V4 shared_builder_valid_result{};
  shared_builder_valid_result.struct_size = sizeof(shared_builder_valid_result);
  assert(LB_CEF3_InvokeV4(&shared_builder_valid_call, &shared_builder_valid_result)
      == LB_CEF3_OK);
  assert(shared_builder_valid_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(shared_builder_valid_result.integer_value == 1);

  LB_CEF3_CALL_V4 shared_builder_size_call{};
  shared_builder_size_call.struct_size = sizeof(shared_builder_size_call);
  shared_builder_size_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_builder_size_call.operation_id = UINT64_C(0x19fff1dc2298f1df);
  shared_builder_size_call.target = shared_builder_result.handle_value;
  LB_CEF3_RESULT_V4 shared_builder_size_result{};
  shared_builder_size_result.struct_size = sizeof(shared_builder_size_result);
  assert(LB_CEF3_InvokeV4(&shared_builder_size_call, &shared_builder_size_result)
      == LB_CEF3_OK);
  assert(shared_builder_size_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(shared_builder_size_result.integer_value == 64);

  LB_CEF3_CALL_V4 shared_builder_memory_call{};
  shared_builder_memory_call.struct_size = sizeof(shared_builder_memory_call);
  shared_builder_memory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_builder_memory_call.operation_id = UINT64_C(0xc4073e72b68e8d7f);
  shared_builder_memory_call.target = shared_builder_result.handle_value;
  LB_CEF3_RESULT_V4 shared_builder_memory_result{};
  shared_builder_memory_result.struct_size = sizeof(shared_builder_memory_result);
  assert(LB_CEF3_InvokeV4(&shared_builder_memory_call, &shared_builder_memory_result)
      == LB_CEF3_OK);
  assert(shared_builder_memory_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(LB_CEF3_BufferGetSize(
             shared_builder_memory_result.buffer_value, &shared_buffer_size) == LB_CEF3_OK);
  assert(shared_buffer_size == 64);

  LB_CEF3_CALL_V4 shared_builder_build_call{};
  shared_builder_build_call.struct_size = sizeof(shared_builder_build_call);
  shared_builder_build_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_builder_build_call.operation_id = UINT64_C(0xc0d3a394ab22a6ad);
  shared_builder_build_call.target = shared_builder_result.handle_value;
  LB_CEF3_RESULT_V4 shared_builder_build_result{};
  shared_builder_build_result.struct_size = sizeof(shared_builder_build_result);
  assert(LB_CEF3_InvokeV4(&shared_builder_build_call, &shared_builder_build_result)
      == LB_CEF3_OK);
  assert(shared_builder_build_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(shared_builder_build_result.handle_value)
      == LB_CEF3_HANDLE_PROCESS_MESSAGE);

  process_message_region_call.target = shared_builder_build_result.handle_value;
  process_message_region_result = {};
  process_message_region_result.struct_size = sizeof(process_message_region_result);
  assert(LB_CEF3_InvokeV4(&process_message_region_call, &process_message_region_result)
      == LB_CEF3_OK);
  assert(process_message_region_result.value_kind == LB_CEF3_VALUE_V4_HANDLE);
  assert(LB_CEF3_HandleGetType(process_message_region_result.handle_value)
      == LB_CEF3_HANDLE_SHARED_MEMORY_REGION);

  LB_CEF3_CALL_V4 shared_region_valid_call{};
  shared_region_valid_call.struct_size = sizeof(shared_region_valid_call);
  shared_region_valid_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_region_valid_call.operation_id = UINT64_C(0xddc199bd66a2aab7);
  shared_region_valid_call.target = process_message_region_result.handle_value;
  LB_CEF3_RESULT_V4 shared_region_valid_result{};
  shared_region_valid_result.struct_size = sizeof(shared_region_valid_result);
  assert(LB_CEF3_InvokeV4(&shared_region_valid_call, &shared_region_valid_result)
      == LB_CEF3_OK);
  assert(shared_region_valid_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(shared_region_valid_result.integer_value == 1);

  LB_CEF3_CALL_V4 shared_region_size_call{};
  shared_region_size_call.struct_size = sizeof(shared_region_size_call);
  shared_region_size_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_region_size_call.operation_id = UINT64_C(0xb7a1d45198bb651b);
  shared_region_size_call.target = process_message_region_result.handle_value;
  LB_CEF3_RESULT_V4 shared_region_size_result{};
  shared_region_size_result.struct_size = sizeof(shared_region_size_result);
  assert(LB_CEF3_InvokeV4(&shared_region_size_call, &shared_region_size_result)
      == LB_CEF3_OK);
  assert(shared_region_size_result.value_kind == LB_CEF3_VALUE_V4_INTEGER);
  assert(shared_region_size_result.integer_value == 64);

  LB_CEF3_CALL_V4 shared_region_memory_call{};
  shared_region_memory_call.struct_size = sizeof(shared_region_memory_call);
  shared_region_memory_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  shared_region_memory_call.operation_id = UINT64_C(0x137329d9df8a9709);
  shared_region_memory_call.target = process_message_region_result.handle_value;
  LB_CEF3_RESULT_V4 shared_region_memory_result{};
  shared_region_memory_result.struct_size = sizeof(shared_region_memory_result);
  assert(LB_CEF3_InvokeV4(&shared_region_memory_call, &shared_region_memory_result)
      == LB_CEF3_OK);
  assert(shared_region_memory_result.value_kind == LB_CEF3_VALUE_V4_BUFFER);
  assert(LB_CEF3_BufferIsEqual(
             shared_builder_memory_result.buffer_value,
             shared_region_memory_result.buffer_value) == 1);
  assert(LB_CEF3_BufferRelease(shared_region_memory_result.buffer_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(process_message_region_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(shared_builder_build_result.handle_value) == LB_CEF3_OK);
  assert(LB_CEF3_BufferRelease(shared_builder_memory_result.buffer_value) == LB_CEF3_OK);
  assert(LB_CEF3_HandleRelease(shared_builder_result.handle_value) == LB_CEF3_OK);

  constexpr LB_CEF3_HANDLE invalid_message_handle = UINT64_C(0x7fffffffffffff01);
  assert(LB_CEF3_ProcessMessageIsValid(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ProcessMessageIsReadOnly(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ProcessMessageCopy(invalid_message_handle) == 0);
  assert(LB_CEF3_ProcessMessageGetName(
             invalid_message_handle, process_message_name.data(), process_message_name.size(),
             &process_message_name_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_ProcessMessageGetArgumentList(invalid_message_handle) == 0);
  assert(LB_CEF3_ProcessMessageGetSharedMemoryRegion(invalid_message_handle) == 0);
  assert(LB_CEF3_ProcessMessageSend(browser_a, 1, invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_SharedProcessMessageBuilderIsValid(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_SharedProcessMessageBuilderSize(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_SharedProcessMessageBuilderMemory(invalid_message_handle) == 0);
  assert(LB_CEF3_SharedProcessMessageBuilderBuild(invalid_message_handle) == 0);
  assert(LB_CEF3_SharedMemoryRegionIsValid(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_SharedMemoryRegionSize(invalid_message_handle)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_SharedMemoryRegionMemory(invalid_message_handle) == 0);
  assert(LB_CEF3_SetNestableTasksAllowed(1) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 nestable_tasks_argument{};
  nestable_tasks_argument.struct_size = sizeof(nestable_tasks_argument);
  nestable_tasks_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  nestable_tasks_argument.integer_value = 0;
  LB_CEF3_CALL_V4 nestable_tasks_call{};
  nestable_tasks_call.struct_size = sizeof(nestable_tasks_call);
  nestable_tasks_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  nestable_tasks_call.operation_id = UINT64_C(0x1748e597ed64e716);
  nestable_tasks_call.arguments = &nestable_tasks_argument;
  nestable_tasks_call.argument_count = 1;
  LB_CEF3_RESULT_V4 nestable_tasks_result{};
  nestable_tasks_result.struct_size = sizeof(nestable_tasks_result);
  assert(LB_CEF3_InvokeV4(&nestable_tasks_call, &nestable_tasks_result) == LB_CEF3_OK);
  assert(nestable_tasks_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  assert(LB_CEF3_GetChromeVariationsAsSwitches(platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  assert(LB_CEF3_GetChromeVariationsAsStrings(platform_json.data(), platform_json.size(), &required) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: platform-object-factories\n");
  std::fflush(stderr);

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
  std::fprintf(stderr, "CEF3 test checkpoint: request-context-tasks\n");
  std::fflush(stderr);

  const auto value = LB_CEF3_ValueCreate();
  assert(value != 0);
  assert(LB_CEF3_ValueSetNull(value) == LB_CEF3_OK);
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
  assert(LB_CEF3_ValueIsReadOnly(value) == 1);
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
  assert(LB_CEF3_ImageAddPng(image, 2.0, image_png) == LB_CEF3_OK);
  assert(LB_CEF3_ImageAddJpeg(image, 3.0, image_jpeg) == LB_CEF3_OK);
  uint64_t image_size = 0;
  assert(LB_CEF3_BufferGetSize(image_bitmap, &image_size) == LB_CEF3_OK && image_size == 4);
  assert(LB_CEF3_BufferGetSize(image_png, &image_size) == LB_CEF3_OK && image_size > 4);
  assert(LB_CEF3_BufferGetSize(image_jpeg, &image_size) == LB_CEF3_OK && image_size > 4);
  assert(LB_CEF3_ImageRemoveRepresentation(image, 1.0) == LB_CEF3_OK);
  assert(LB_CEF3_ImageHasRepresentation(image, 1.0) == 0);

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
  std::fprintf(stderr, "CEF3 test checkpoint: value-menu-image-objects\n");
  std::fflush(stderr);
  const auto shutdown_image = LB_CEF3_ImageCreate();
  assert(shutdown_image != 0);
  assert(LB_CEF3_BrowserReloadIgnoreCache(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 reload_ignore_cache_call{};
  reload_ignore_cache_call.struct_size = sizeof(reload_ignore_cache_call);
  reload_ignore_cache_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  reload_ignore_cache_call.operation_id = UINT64_C(0x63f81011aeaf1d6e);
  reload_ignore_cache_call.target = browser_a;
  LB_CEF3_RESULT_V4 reload_ignore_cache_result{};
  reload_ignore_cache_result.struct_size = sizeof(reload_ignore_cache_result);
  assert(LB_CEF3_InvokeV4(&reload_ignore_cache_call, &reload_ignore_cache_result) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserNotifyMoveOrResizeStarted(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 notify_move_or_resize_call{};
  notify_move_or_resize_call.struct_size = sizeof(notify_move_or_resize_call);
  notify_move_or_resize_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  notify_move_or_resize_call.operation_id = UINT64_C(0x57805e51cd908450);
  notify_move_or_resize_call.target = browser_a;
  LB_CEF3_RESULT_V4 notify_move_or_resize_result{};
  notify_move_or_resize_result.struct_size = sizeof(notify_move_or_resize_result);
  assert(LB_CEF3_InvokeV4(&notify_move_or_resize_call, &notify_move_or_resize_result) == LB_CEF3_OK);
  assert(notify_move_or_resize_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_notify_move_or_resize_argument{};
  invalid_notify_move_or_resize_argument.struct_size = sizeof(invalid_notify_move_or_resize_argument);
  invalid_notify_move_or_resize_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  notify_move_or_resize_call.argument_count = 1;
  notify_move_or_resize_call.arguments = &invalid_notify_move_or_resize_argument;
  assert(LB_CEF3_InvokeV4(&notify_move_or_resize_call, &notify_move_or_resize_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 notify_screen_info_call{};
  notify_screen_info_call.struct_size = sizeof(notify_screen_info_call);
  notify_screen_info_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  notify_screen_info_call.operation_id = UINT64_C(0xf8d7fadc0514e1f7);
  notify_screen_info_call.target = browser_a;
  LB_CEF3_RESULT_V4 notify_screen_info_result{};
  notify_screen_info_result.struct_size = sizeof(notify_screen_info_result);
  assert(LB_CEF3_InvokeV4(&notify_screen_info_call, &notify_screen_info_result) == LB_CEF3_OK);
  assert(notify_screen_info_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_notify_screen_info_argument{};
  invalid_notify_screen_info_argument.struct_size = sizeof(invalid_notify_screen_info_argument);
  invalid_notify_screen_info_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  notify_screen_info_call.argument_count = 1;
  notify_screen_info_call.arguments = &invalid_notify_screen_info_argument;
  assert(LB_CEF3_InvokeV4(&notify_screen_info_call, &notify_screen_info_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserSendCaptureLostEvent(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 capture_lost_call{};
  capture_lost_call.struct_size = sizeof(capture_lost_call);
  capture_lost_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  capture_lost_call.operation_id = UINT64_C(0xc6c3a239b1c6e7de);
  capture_lost_call.target = browser_a;
  LB_CEF3_RESULT_V4 capture_lost_result{};
  capture_lost_result.struct_size = sizeof(capture_lost_result);
  assert(LB_CEF3_InvokeV4(&capture_lost_call, &capture_lost_result) == LB_CEF3_OK);
  assert(capture_lost_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_capture_lost_argument{};
  invalid_capture_lost_argument.struct_size = sizeof(invalid_capture_lost_argument);
  invalid_capture_lost_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  capture_lost_call.argument_count = 1;
  capture_lost_call.arguments = &invalid_capture_lost_argument;
  assert(LB_CEF3_InvokeV4(&capture_lost_call, &capture_lost_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserImeCancelComposition(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 ime_cancel_call{};
  ime_cancel_call.struct_size = sizeof(ime_cancel_call);
  ime_cancel_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  ime_cancel_call.operation_id = UINT64_C(0x144e62d63174624c);
  ime_cancel_call.target = browser_a;
  LB_CEF3_RESULT_V4 ime_cancel_result{};
  ime_cancel_result.struct_size = sizeof(ime_cancel_result);
  assert(LB_CEF3_InvokeV4(&ime_cancel_call, &ime_cancel_result) == LB_CEF3_OK);
  assert(ime_cancel_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_ime_cancel_argument{};
  invalid_ime_cancel_argument.struct_size = sizeof(invalid_ime_cancel_argument);
  invalid_ime_cancel_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  ime_cancel_call.argument_count = 1;
  ime_cancel_call.arguments = &invalid_ime_cancel_argument;
  assert(LB_CEF3_InvokeV4(&ime_cancel_call, &ime_cancel_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserImeFinishComposingText(browser_a, 0) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserImeFinishComposingText(browser_a, 1) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 ime_finish_argument{};
  ime_finish_argument.struct_size = sizeof(ime_finish_argument);
  ime_finish_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  ime_finish_argument.integer_value = 1;
  LB_CEF3_CALL_V4 ime_finish_call{};
  ime_finish_call.struct_size = sizeof(ime_finish_call);
  ime_finish_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  ime_finish_call.operation_id = UINT64_C(0x3bc241123256042a);
  ime_finish_call.target = browser_a;
  ime_finish_call.argument_count = 1;
  ime_finish_call.arguments = &ime_finish_argument;
  LB_CEF3_RESULT_V4 ime_finish_result{};
  ime_finish_result.struct_size = sizeof(ime_finish_result);
  assert(LB_CEF3_InvokeV4(&ime_finish_call, &ime_finish_result) == LB_CEF3_OK);
  assert(ime_finish_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  ime_finish_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&ime_finish_call, &ime_finish_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserAddWordToDictionary(
      browser_a, L"lingbuildercef3nativeword") == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 add_word_argument{};
  add_word_argument.struct_size = sizeof(add_word_argument);
  add_word_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  add_word_argument.text_value = L"lingbuildercef3v4word";
  LB_CEF3_CALL_V4 add_word_call{};
  add_word_call.struct_size = sizeof(add_word_call);
  add_word_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  add_word_call.operation_id = UINT64_C(0x9396286924cf3c93);
  add_word_call.target = browser_a;
  add_word_call.argument_count = 1;
  add_word_call.arguments = &add_word_argument;
  LB_CEF3_RESULT_V4 add_word_result{};
  add_word_result.struct_size = sizeof(add_word_result);
  assert(LB_CEF3_InvokeV4(&add_word_call, &add_word_result) == LB_CEF3_OK);
  assert(add_word_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  add_word_argument.text_value = L"";
  assert(LB_CEF3_InvokeV4(&add_word_call, &add_word_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  add_word_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&add_word_call, &add_word_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserReplaceMisspelling(browser_a, L"LingBuilder") == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 replace_misspelling_argument{};
  replace_misspelling_argument.struct_size = sizeof(replace_misspelling_argument);
  replace_misspelling_argument.value_kind = LB_CEF3_VALUE_V4_TEXT;
  replace_misspelling_argument.text_value = L"LingBuilderCEF3";
  LB_CEF3_CALL_V4 replace_misspelling_call{};
  replace_misspelling_call.struct_size = sizeof(replace_misspelling_call);
  replace_misspelling_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  replace_misspelling_call.operation_id = UINT64_C(0x133ba2d2ae4d2d20);
  replace_misspelling_call.target = browser_a;
  replace_misspelling_call.argument_count = 1;
  replace_misspelling_call.arguments = &replace_misspelling_argument;
  LB_CEF3_RESULT_V4 replace_misspelling_result{};
  replace_misspelling_result.struct_size = sizeof(replace_misspelling_result);
  assert(LB_CEF3_InvokeV4(
      &replace_misspelling_call, &replace_misspelling_result) == LB_CEF3_OK);
  assert(replace_misspelling_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  replace_misspelling_argument.text_value = L"";
  assert(LB_CEF3_InvokeV4(
      &replace_misspelling_call, &replace_misspelling_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  replace_misspelling_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(
      &replace_misspelling_call, &replace_misspelling_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-dictionary\n");
  std::fflush(stderr);
  assert(LB_CEF3_BrowserDragSourceSystemDragEnded(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 drag_source_system_drag_ended_call{};
  drag_source_system_drag_ended_call.struct_size = sizeof(drag_source_system_drag_ended_call);
  drag_source_system_drag_ended_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  drag_source_system_drag_ended_call.operation_id = UINT64_C(0x59600b206dd2f18e);
  drag_source_system_drag_ended_call.target = browser_a;
  LB_CEF3_RESULT_V4 drag_source_system_drag_ended_result{};
  drag_source_system_drag_ended_result.struct_size = sizeof(drag_source_system_drag_ended_result);
  assert(LB_CEF3_InvokeV4(
      &drag_source_system_drag_ended_call, &drag_source_system_drag_ended_result) == LB_CEF3_OK);
  assert(drag_source_system_drag_ended_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_drag_source_system_drag_ended_argument{};
  invalid_drag_source_system_drag_ended_argument.struct_size =
      sizeof(invalid_drag_source_system_drag_ended_argument);
  invalid_drag_source_system_drag_ended_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  drag_source_system_drag_ended_call.argument_count = 1;
  drag_source_system_drag_ended_call.arguments = &invalid_drag_source_system_drag_ended_argument;
  assert(LB_CEF3_InvokeV4(
      &drag_source_system_drag_ended_call, &drag_source_system_drag_ended_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  assert(LB_CEF3_BrowserDragTargetDragLeave(browser_a) == LB_CEF3_OK);
  LB_CEF3_CALL_V4 drag_target_drag_leave_call{};
  drag_target_drag_leave_call.struct_size = sizeof(drag_target_drag_leave_call);
  drag_target_drag_leave_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  drag_target_drag_leave_call.operation_id = UINT64_C(0x6b472afae7ef9b00);
  drag_target_drag_leave_call.target = browser_a;
  LB_CEF3_RESULT_V4 drag_target_drag_leave_result{};
  drag_target_drag_leave_result.struct_size = sizeof(drag_target_drag_leave_result);
  assert(LB_CEF3_InvokeV4(
      &drag_target_drag_leave_call, &drag_target_drag_leave_result) == LB_CEF3_OK);
  assert(drag_target_drag_leave_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  LB_CEF3_ARGUMENT_V4 invalid_drag_target_drag_leave_argument{};
  invalid_drag_target_drag_leave_argument.struct_size =
      sizeof(invalid_drag_target_drag_leave_argument);
  invalid_drag_target_drag_leave_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  drag_target_drag_leave_call.argument_count = 1;
  drag_target_drag_leave_call.arguments = &invalid_drag_target_drag_leave_argument;
  assert(LB_CEF3_InvokeV4(&drag_target_drag_leave_call, &drag_target_drag_leave_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-drag\n");
  std::fflush(stderr);
  assert(LB_CEF3_BrowserWasHidden(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserWasHidden(browser_a, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 was_hidden_argument{};
  was_hidden_argument.struct_size = sizeof(was_hidden_argument);
  was_hidden_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  was_hidden_argument.integer_value = 1;
  LB_CEF3_CALL_V4 was_hidden_call{};
  was_hidden_call.struct_size = sizeof(was_hidden_call);
  was_hidden_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  was_hidden_call.operation_id = UINT64_C(0xdaa8430a57e0da25);
  was_hidden_call.target = browser_a;
  was_hidden_call.argument_count = 1;
  was_hidden_call.arguments = &was_hidden_argument;
  LB_CEF3_RESULT_V4 was_hidden_result{};
  was_hidden_result.struct_size = sizeof(was_hidden_result);
  assert(LB_CEF3_InvokeV4(&was_hidden_call, &was_hidden_result) == LB_CEF3_OK);
  assert(was_hidden_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  was_hidden_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(&was_hidden_call, &was_hidden_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  was_hidden_call.argument_count = 0;
  was_hidden_call.arguments = nullptr;
  assert(LB_CEF3_InvokeV4(&was_hidden_call, &was_hidden_result)
      == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-visibility\n");
  std::fflush(stderr);
  assert(LB_CEF3_BrowserExitFullscreen(browser_a, 1) == LB_CEF3_OK);
  assert(LB_CEF3_BrowserExitFullscreen(browser_a, 0) == LB_CEF3_OK);
  LB_CEF3_ARGUMENT_V4 exit_fullscreen_argument{};
  exit_fullscreen_argument.struct_size = sizeof(exit_fullscreen_argument);
  exit_fullscreen_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  exit_fullscreen_argument.integer_value = 1;
  LB_CEF3_CALL_V4 exit_fullscreen_call{};
  exit_fullscreen_call.struct_size = sizeof(exit_fullscreen_call);
  exit_fullscreen_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  exit_fullscreen_call.operation_id = UINT64_C(0x74134524777a082d);
  exit_fullscreen_call.target = browser_a;
  exit_fullscreen_call.argument_count = 1;
  exit_fullscreen_call.arguments = &exit_fullscreen_argument;
  LB_CEF3_RESULT_V4 exit_fullscreen_result{};
  exit_fullscreen_result.struct_size = sizeof(exit_fullscreen_result);
  assert(LB_CEF3_InvokeV4(
      &exit_fullscreen_call, &exit_fullscreen_result) == LB_CEF3_OK);
  assert(exit_fullscreen_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  exit_fullscreen_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  assert(LB_CEF3_InvokeV4(
      &exit_fullscreen_call, &exit_fullscreen_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  exit_fullscreen_call.argument_count = 0;
  exit_fullscreen_call.arguments = nullptr;
  assert(LB_CEF3_InvokeV4(
      &exit_fullscreen_call, &exit_fullscreen_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-host-inputs\n");
  std::fflush(stderr);
  ime_finish_call.argument_count = 0;
  ime_finish_call.arguments = nullptr;
  assert(LB_CEF3_InvokeV4(&ime_finish_call, &ime_finish_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-ime\n");
  std::fflush(stderr);
  const int final_zoom_command = LB_CEF3_BrowserCanZoom(browser_b, kZoomCommandIn) == 1
      ? kZoomCommandIn : kZoomCommandOut;
  assert(LB_CEF3_BrowserCanZoom(browser_b, final_zoom_command) == 1);
  zoom_call.target = browser_b;
  zoom_argument.value_kind = LB_CEF3_VALUE_V4_INTEGER;
  zoom_argument.integer_value = final_zoom_command;
  zoom_call.argument_count = 1;
  zoom_call.arguments = &zoom_argument;
  const int final_zoom_status = LB_CEF3_InvokeV4(&zoom_call, &zoom_result);
  if (final_zoom_status != LB_CEF3_OK) {
    std::array<wchar_t, 512> zoom_error{};
    size_t zoom_error_required = 0;
    LB_CEF3_GetLastError(zoom_error.data(), zoom_error.size(), &zoom_error_required);
    std::fwprintf(stderr, L"CEF3 final zoom failed: status=%d result=%d error=%ls\n",
                  final_zoom_status, zoom_result.status, zoom_error.data());
    std::fflush(stderr);
  }
  assert(final_zoom_status == LB_CEF3_OK);
  assert(zoom_result.value_kind == LB_CEF3_VALUE_V4_VOID);
  // Close immediately. The Bridge must wait for CEF 150's native zoom bubble
  // instead of requiring callers to add an arbitrary delay before shutdown.
  std::fprintf(stderr, "CEF3 test checkpoint: browser-zoom\n");
  std::fflush(stderr);
  const bool browser_a_closed_by_devtools = false;
  const int try_close_a = LB_CEF3_BrowserTryClose(browser_a);
  assert(try_close_a == 0 || try_close_a == 1);
  LB_CEF3_CALL_V4 try_close_call{};
  try_close_call.struct_size = sizeof(try_close_call);
  try_close_call.abi_version = LB_CEF3_ABI_VERSION_V4;
  try_close_call.operation_id = UINT64_C(0xd8ccd92bd80bfdf0);
  try_close_call.target = browser_b;
  LB_CEF3_RESULT_V4 try_close_result{};
  try_close_result.struct_size = sizeof(try_close_result);
  assert(LB_CEF3_InvokeV4(&try_close_call, &try_close_result) == LB_CEF3_OK);
  assert(try_close_result.value_kind == LB_CEF3_VALUE_V4_BOOLEAN);
  assert(try_close_result.integer_value == 0 || try_close_result.integer_value == 1);
  const int try_close_b = static_cast<int>(try_close_result.integer_value);
  LB_CEF3_ARGUMENT_V4 invalid_try_close_argument{};
  invalid_try_close_argument.struct_size = sizeof(invalid_try_close_argument);
  invalid_try_close_argument.value_kind = LB_CEF3_VALUE_V4_BOOLEAN;
  try_close_call.argument_count = 1;
  try_close_call.arguments = &invalid_try_close_argument;
  assert(LB_CEF3_InvokeV4(&try_close_call, &try_close_result) == LB_CEF3_ERROR_INVALID_ARGUMENT);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-try-close\n");
  std::fflush(stderr);
  if (!browser_a_closed_by_devtools && try_close_a == 0) {
    assert(LB_CEF3_BrowserClose(browser_a, 1) == LB_CEF3_OK);
  } else if (!browser_a_closed_by_devtools) {
    assert(DestroyWindow(host_a) != 0);
  }
  if (try_close_b == 0) {
    assert(LB_CEF3_BrowserClose(browser_b, 1) == LB_CEF3_OK);
  } else {
    assert(DestroyWindow(host_b) != 0);
  }
  const auto graceful_close_deadline = GetTickCount64() + 3000;
  while (g_browser_closed_events.load() < expected_browser_closed_events
      && GetTickCount64() < graceful_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  if (g_browser_closed_events.load() < expected_browser_closed_events) {
    if (try_close_a == 0) assert(LB_CEF3_BrowserClose(browser_a, 1) == LB_CEF3_OK);
    if (try_close_b == 0) assert(LB_CEF3_BrowserClose(browser_b, 1) == LB_CEF3_OK);
  }
  const auto browser_close_deadline = GetTickCount64() + 10000;
  while (g_browser_closed_events.load() < expected_browser_closed_events
      && GetTickCount64() < browser_close_deadline) {
    PumpHostMessages();
    Sleep(10);
  }
  std::fprintf(stderr, "CEF3 test checkpoint: browser-close-count=%d\n",
               g_browser_closed_events.load());
  std::fflush(stderr);
  assert(g_browser_closed_events.load() == expected_browser_closed_events);
  assert(LB_CEF3_DownloadSubscribeCanDownload(browser_a, 1)
      == LB_CEF3_ERROR_OPERATION_FAILED);
  // DownloadItem handles own callback-time value snapshots, so browser close
  // does not invalidate them. HandleRelease remains the sole invalidation.
  assert(LB_CEF3_DownloadItemIsValid(download_item) == 1);
  assert(LB_CEF3_DownloadItemIsComplete(download_item) == 1);
  assert(LB_CEF3_DownloadItemCallbackPause(download_callback)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(download_callback) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemCallbackResume(download_callback)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(download_item) == LB_CEF3_OK);
  assert(LB_CEF3_DownloadItemIsValid(download_item)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleIsValid(frame_handle_for_close, LB_CEF3_HANDLE_FRAME)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(frame_handle_for_close) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameIsValid(frame_handle_for_close) == LB_CEF3_ERROR_RELEASED_HANDLE);
  for (const auto action : {
      LB_CEF3_FrameUndo, LB_CEF3_FrameRedo, LB_CEF3_FrameCut,
      LB_CEF3_FrameCopy, LB_CEF3_FramePaste, LB_CEF3_FramePasteAndMatchStyle,
      LB_CEF3_FrameDelete, LB_CEF3_FrameSelectAll, LB_CEF3_FrameViewSource}) {
    assert(action(frame_handle_for_close) == LB_CEF3_ERROR_RELEASED_HANDLE);
  }
  assert(LB_CEF3_FrameGetSource(frame_handle_for_close) == 0);
  assert(LB_CEF3_FrameGetText(frame_handle_for_close) == 0);
  assert(LB_CEF3_FrameLoadRequest(frame_handle_for_close, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameLoadUrl(frame_handle_for_close, L"about:blank")
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameExecuteJavaScript(
      frame_handle_for_close, L"void 0", L"", 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameIsMain(frame_handle_for_close) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameIsFocused(frame_handle_for_close) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetName(
      frame_handle_for_close, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetIdentifier(
      frame_handle_for_close, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetParent(frame_handle_for_close, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetUrl(
      frame_handle_for_close, invalid_frame_text.data(), invalid_frame_text.size(),
      &invalid_frame_text_required) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameGetBrowser(frame_handle_for_close, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_FrameSendProcessMessage(frame_handle_for_close, 1, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(browser_a) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-a-released\n");
  std::fflush(stderr);
  assert(LB_CEF3_BrowserShowDevTools(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserCloseDevTools(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserHasDevTools(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserReloadIgnoreCache(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_DownloadSubscribeBeforeDownload(browser_a, 1)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendKeyEvent(browser_a, &key_event) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserFind(browser_a, L"released", 1, 0, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserStopFinding(browser_a, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSetFocus(browser_a, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseClickEvent(browser_a, &mouse_event,
      LB_CEF3_MOUSE_BUTTON_LEFT, 0, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseMoveEvent(browser_a, &mouse_event, 0)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendMouseWheelEvent(browser_a, &mouse_event, 0, 120)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendTouchEvent(browser_a, &touch_event)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsValid(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsPopup(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsSame(browser_a, browser_b) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserHasDocument(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFocusedFrame(browser_a, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameByIdentifier(
      browser_a, first_frame_identifier.c_str(), &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameByName(
      browser_a, first_frame_name.c_str(), &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameCount(browser_a, &invalid_frame_count)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameIdentifiers(browser_a, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetFrameNames(browser_a, &invalid_frame_result)
      == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsWindowRenderingDisabled(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsFullscreen(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserHasView(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetOpenerIdentifier(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsReadyToBeClosed(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsRenderProcessUnresponsive(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetRuntimeStyle(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetZoomLevel(browser_a, &invalid_zoom_level) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserGetDefaultZoomLevel(browser_a, &invalid_default_zoom_level) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSetZoomLevel(browser_a, 0.0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserCanZoom(browser_a, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserZoom(browser_a, 0) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserTryClose(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserNotifyMoveOrResizeStarted(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserNotifyScreenInfoChanged(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserSendCaptureLostEvent(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserImeCancelComposition(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserImeFinishComposingText(browser_a, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserAddWordToDictionary(
      browser_a, L"released") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserReplaceMisspelling(
      browser_a, L"released") == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserDragSourceSystemDragEnded(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserDragTargetDragLeave(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserWasHidden(browser_a, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserExitFullscreen(browser_a, 1) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_BrowserIsAudioMuted(browser_a) == LB_CEF3_ERROR_RELEASED_HANDLE);
  assert(LB_CEF3_HandleRelease(browser_b) == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: browser-b-released\n");
  std::fflush(stderr);
  // CEF's normal child-window teardown completes only after the application's
  // host HWNDs are gone. This mirrors the generated Win32 runtime, which
  // closes its CEF controls before it calls the process-level shutdown.
  if (IsWindow(host_a)) assert(DestroyWindow(host_a) != 0);
  if (IsWindow(host_b)) assert(DestroyWindow(host_b) != 0);
  std::fprintf(stderr, "CEF3 test checkpoint: shutdown\n");
  std::fflush(stderr);
  const int shutdown_status = LB_CEF3_Shutdown();
  std::fprintf(stderr, "CEF3 test checkpoint: shutdown-status=%d\n", shutdown_status);
  std::fflush(stderr);
  if (shutdown_status != LB_CEF3_OK) {
    std::array<wchar_t, 512> shutdown_error{};
    size_t shutdown_error_required = 0;
    LB_CEF3_GetLastError(shutdown_error.data(), shutdown_error.size(), &shutdown_error_required);
    std::fwprintf(stderr, L"CEF3 shutdown failed: status=%d error=%ls\n", shutdown_status, shutdown_error.data());
    std::fflush(stderr);
  }
  assert(shutdown_status == LB_CEF3_OK);
  std::fprintf(stderr, "CEF3 test checkpoint: shutdown-complete\n");
  std::fflush(stderr);
  assert(LB_CEF3_HandleIsValid(shutdown_image, LB_CEF3_HANDLE_IMAGE) == LB_CEF3_ERROR_RELEASED_HANDLE);
  std::fprintf(stderr, "CEF3 test checkpoint: shutdown-handle-invalidated\n");
  std::fflush(stderr);
  LB_CEF3_ShutdownRegistry();
  std::fprintf(stderr, "CEF3 test checkpoint: registry-cleared\n");
  std::fflush(stderr);
  std::error_code cleanup_error;
  std::filesystem::remove_all(root, cleanup_error);
  if (cleanup_error) {
    std::fprintf(stderr, "CEF3 test note: deferred cache cleanup error=%d\n", cleanup_error.value());
    std::fflush(stderr);
  }
  std::fprintf(stderr, "CEF3 test checkpoint: complete\n");
  std::fflush(stderr);
  return 0;
}
