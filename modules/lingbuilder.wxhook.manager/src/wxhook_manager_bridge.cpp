#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include "wxhook_manager_bridge.h"

#include <bcrypt.h>
#include <commctrl.h>
#include <cryptuiapi.h>
#include <gdiplus.h>
#include <wincrypt.h>
#include <winhttp.h>

#include <nlohmann/json.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <memory>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "winhttp.lib")

namespace {

constexpr UINT WM_LB_WXMORE_UPDATE = WM_APP + 0x53A;
constexpr UINT_PTR WXMORE_SUBCLASS_ID = 0x4C425758;
constexpr wchar_t HOST_NAME[] = L"127.0.0.1";
constexpr INTERNET_PORT HOST_PORT = 30000;

struct HttpResult {
    bool transportOk = false;
    DWORD statusCode = 0;
    DWORD systemError = 0;
    std::string body;
    std::wstring error;
};

struct InstanceSnapshot {
    std::wstring id;
    int processId = 0;
    bool loggedIn = false;
    bool coreReady = false;
    bool extensionsReady = false;
    std::wstring state;
    std::wstring wxid;
    std::wstring nickname;
    std::wstring avatarUrl;
    std::wstring avatarPath;
    std::wstring lastError;
};

struct MonitorState {
    HWND root = nullptr;
    HWND instanceList = nullptr;
    HWND statusLabel = nullptr;
    HWND logList = nullptr;
    HIMAGELIST imageList = nullptr;
    std::thread worker;
    std::atomic<bool> stop{false};
    std::mutex wakeMutex;
    std::condition_variable wake;
    bool refreshRequested = false;
    std::mutex pendingMutex;
    std::vector<InstanceSnapshot> pending;
    std::vector<std::wstring> pendingLogs;
    std::wstring pendingStatus;
    std::wstring lastFingerprint;
    std::wstring lastPublishedError;
    bool columnsReady = false;
};

std::wstring Utf8ToWide(const std::string& value) {
    if (value.empty()) return {};
    const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                            static_cast<int>(value.size()), nullptr, 0);
    if (length <= 0) return {};
    std::wstring result(static_cast<size_t>(length), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                            static_cast<int>(value.size()), result.data(), length) <= 0) return {};
    return result;
}

std::string WideToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                                           static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (length <= 0) return {};
    std::string result(static_cast<size_t>(length), '\0');
    if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                            static_cast<int>(value.size()), result.data(), length, nullptr, nullptr) <= 0) return {};
    return result;
}

std::wstring SystemErrorText(DWORD code) {
    if (!code) return {};
    wchar_t* buffer = nullptr;
    const DWORD length = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
                                            FORMAT_MESSAGE_IGNORE_INSERTS,
                                        nullptr, code, 0, reinterpret_cast<wchar_t*>(&buffer), 0, nullptr);
    std::wstring result = length && buffer ? std::wstring(buffer, length) : (L"错误码 " + std::to_wstring(code));
    if (buffer) LocalFree(buffer);
    while (!result.empty() && (result.back() == L'\r' || result.back() == L'\n' || result.back() == L' ')) {
        result.pop_back();
    }
    return result;
}

std::wstring ExecutableDirectory() {
    std::vector<wchar_t> buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (!length || length >= buffer.size()) return {};
    return std::filesystem::path(std::wstring(buffer.data(), length)).parent_path().wstring();
}

std::wstring GetEnvironmentValue(const wchar_t* name) {
    const DWORD required = GetEnvironmentVariableW(name, nullptr, 0);
    if (!required) return {};
    std::wstring value(static_cast<size_t>(required), L'\0');
    const DWORD length = GetEnvironmentVariableW(name, value.data(), required);
    if (!length || length >= required) return {};
    value.resize(length);
    return value;
}

bool FileExists(const std::wstring& path) {
    const DWORD attributes = GetFileAttributesW(path.c_str());
    return attributes != INVALID_FILE_ATTRIBUTES && !(attributes & FILE_ATTRIBUTE_DIRECTORY);
}

std::vector<unsigned char> ReadBinaryFile(const std::wstring& path) {
    std::ifstream input(std::filesystem::path(path), std::ios::binary);
    if (!input) return {};
    input.seekg(0, std::ios::end);
    const std::streamoff length = input.tellg();
    if (length <= 0 || length > 1024 * 1024) return {};
    input.seekg(0, std::ios::beg);
    std::vector<unsigned char> bytes(static_cast<size_t>(length));
    input.read(reinterpret_cast<char*>(bytes.data()), length);
    return input ? bytes : std::vector<unsigned char>{};
}

std::wstring Base64(const unsigned char* bytes, DWORD length) {
    DWORD required = 0;
    if (!CryptBinaryToStringW(bytes, length, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &required) || !required) {
        return {};
    }
    std::wstring result(static_cast<size_t>(required), L'\0');
    if (!CryptBinaryToStringW(bytes, length, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF,
                              result.data(), &required)) return {};
    while (!result.empty() && result.back() == L'\0') result.pop_back();
    return result;
}

std::wstring LoadDpapiToken() {
    const std::wstring localAppData = GetEnvironmentValue(L"LOCALAPPDATA");
    if (localAppData.empty()) return {};
    const std::wstring path = localAppData + L"\\WxHook.Manager\\secrets\\local-token.dpapi";
    const std::vector<unsigned char> protectedBytes = ReadBinaryFile(path);
    if (protectedBytes.empty()) return {};

    static const unsigned char entropyBytes[] = "WxHook.Manager.Host/v2";
    DATA_BLOB input{};
    input.cbData = static_cast<DWORD>(protectedBytes.size());
    input.pbData = const_cast<BYTE*>(protectedBytes.data());
    DATA_BLOB entropy{};
    entropy.cbData = static_cast<DWORD>(sizeof(entropyBytes) - 1);
    entropy.pbData = const_cast<BYTE*>(entropyBytes);
    DATA_BLOB output{};
    if (!CryptUnprotectData(&input, nullptr, &entropy, nullptr, nullptr, 0, &output)) return {};
    std::wstring token;
    if (output.cbData == 32) token = Base64(output.pbData, output.cbData);
    if (output.pbData) LocalFree(output.pbData);
    return token;
}

HttpResult LocalRequest(const wchar_t* method, const wchar_t* path, const std::wstring& token,
                        const std::string& body = {}) {
    HttpResult result;
    HINTERNET session = WinHttpOpen(L"LingBuilder-wxmore-tool/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY,
                                    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!session) {
        result.systemError = GetLastError();
        result.error = L"创建本机 HTTP 会话失败：" + SystemErrorText(result.systemError);
        return result;
    }
    WinHttpSetTimeouts(session, 800, 800, 2000, 2000);
    HINTERNET connection = WinHttpConnect(session, HOST_NAME, HOST_PORT, 0);
    if (!connection) {
        result.systemError = GetLastError();
        result.error = L"连接 WxHook Manager Host 失败：" + SystemErrorText(result.systemError);
        WinHttpCloseHandle(session);
        return result;
    }
    HINTERNET request = WinHttpOpenRequest(connection, method, path, nullptr, WINHTTP_NO_REFERER,
                                           WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
    if (!request) {
        result.systemError = GetLastError();
        result.error = L"创建 WxHook Manager 请求失败：" + SystemErrorText(result.systemError);
        WinHttpCloseHandle(connection);
        WinHttpCloseHandle(session);
        return result;
    }

    std::wstring headers;
    if (!token.empty()) headers += L"X-WxHook-Token: " + token + L"\r\n";
    if (!body.empty()) headers += L"Content-Type: application/json; charset=utf-8\r\n";
    const BOOL sent = WinHttpSendRequest(
        request,
        headers.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headers.c_str(),
        headers.empty() ? 0 : static_cast<DWORD>(-1L),
        body.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<char*>(body.data()),
        static_cast<DWORD>(body.size()), static_cast<DWORD>(body.size()), 0);
    if (!sent || !WinHttpReceiveResponse(request, nullptr)) {
        result.systemError = GetLastError();
        result.error = L"WxHook Manager 请求失败：" + SystemErrorText(result.systemError);
        WinHttpCloseHandle(request);
        WinHttpCloseHandle(connection);
        WinHttpCloseHandle(session);
        return result;
    }

    DWORD status = 0;
    DWORD statusSize = sizeof(status);
    WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                        WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
    result.statusCode = status;

    constexpr size_t MAX_RESPONSE = 4 * 1024 * 1024;
    while (result.body.size() < MAX_RESPONSE) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available)) {
            result.systemError = GetLastError();
            result.error = L"读取 WxHook Manager 响应失败：" + SystemErrorText(result.systemError);
            break;
        }
        if (!available) break;
        const DWORD wanted = static_cast<DWORD>(std::min<size_t>(available, MAX_RESPONSE - result.body.size()));
        const size_t offset = result.body.size();
        result.body.resize(offset + wanted);
        DWORD read = 0;
        if (!WinHttpReadData(request, result.body.data() + offset, wanted, &read)) {
            result.systemError = GetLastError();
            result.error = L"读取 WxHook Manager 响应正文失败：" + SystemErrorText(result.systemError);
            result.body.resize(offset);
            break;
        }
        result.body.resize(offset + read);
        if (!read) break;
    }

    result.transportOk = result.error.empty();
    WinHttpCloseHandle(request);
    WinHttpCloseHandle(connection);
    WinHttpCloseHandle(session);
    return result;
}

std::wstring ApiErrorMessage(const HttpResult& response) {
    if (!response.error.empty()) return response.error;
    try {
        const auto json = nlohmann::json::parse(response.body);
        if (json.is_object() && json.contains("message") && json["message"].is_string()) {
            return Utf8ToWide(json["message"].get<std::string>());
        }
    } catch (...) {
    }
    return L"WxHook Manager 返回 HTTP " + std::to_wstring(response.statusCode) + L"。";
}

std::wstring JsonText(const nlohmann::json& object, const char* key) {
    const auto found = object.find(key);
    if (found == object.end() || !found->is_string()) return {};
    return Utf8ToWide(found->get<std::string>());
}

std::wstring JsonState(const nlohmann::json& object, const char* key) {
    const auto found = object.find(key);
    if (found == object.end()) return {};
    if (found->is_string()) return Utf8ToWide(found->get<std::string>());
    if (found->is_number_integer()) return L"状态 " + std::to_wstring(found->get<int>());
    return Utf8ToWide(found->dump());
}

bool IsStoppedState(const std::wstring& state) {
    const size_t first = state.find_first_not_of(L" \t\r\n");
    if (first == std::wstring::npos) return false;
    const size_t last = state.find_last_not_of(L" \t\r\n") + 1;
    constexpr wchar_t stopped[] = L"stopped";
    return last - first == std::size(stopped) - 1 &&
           CompareStringOrdinal(state.data() + first, static_cast<int>(last - first),
                                stopped, static_cast<int>(std::size(stopped) - 1), TRUE) == CSTR_EQUAL;
}

std::wstring SnapshotFingerprint(const std::vector<InstanceSnapshot>& instances) {
    std::wstring result;
    for (const auto& item : instances) {
        result += item.id + L"|" + std::to_wstring(item.processId) + L"|" +
                  (item.loggedIn ? L"1" : L"0") + L"|" + item.state + L"|" + item.wxid + L"|" +
                  item.nickname + L"|" + item.avatarUrl + L"|" + item.avatarPath + L"|" + item.lastError + L"\n";
    }
    return result;
}

std::wstring CurrentTimeText() {
    SYSTEMTIME time{};
    GetLocalTime(&time);
    wchar_t buffer[32]{};
    swprintf_s(buffer, L"%02u:%02u:%02u", time.wHour, time.wMinute, time.wSecond);
    return buffer;
}

std::wstring AvatarCacheDirectory() {
    std::wstring local = GetEnvironmentValue(L"LOCALAPPDATA");
    if (local.empty()) local = ExecutableDirectory();
    std::filesystem::path directory = std::filesystem::path(local) / L"LingBuilder" / L"wxmore-tool" / L"avatars";
    std::error_code error;
    std::filesystem::create_directories(directory, error);
    return directory.wstring();
}

uint64_t Fnv1a(const std::wstring& value) {
    uint64_t hash = 1469598103934665603ULL;
    for (wchar_t ch : value) {
        hash ^= static_cast<uint16_t>(ch);
        hash *= 1099511628211ULL;
    }
    return hash;
}

std::wstring AvatarCachePath(const std::wstring& url) {
    std::wostringstream name;
    name << std::hex << std::setw(16) << std::setfill(L'0') << Fnv1a(url) << L".avatar";
    return (std::filesystem::path(AvatarCacheDirectory()) / name.str()).wstring();
}

bool DownloadAvatar(const std::wstring& url, const std::wstring& outputPath) {
    if (!(url.rfind(L"https://", 0) == 0 || url.rfind(L"http://", 0) == 0)) return false;

    URL_COMPONENTSW parts{};
    parts.dwStructSize = sizeof(parts);
    parts.dwSchemeLength = static_cast<DWORD>(-1);
    parts.dwHostNameLength = static_cast<DWORD>(-1);
    parts.dwUrlPathLength = static_cast<DWORD>(-1);
    parts.dwExtraInfoLength = static_cast<DWORD>(-1);
    if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) return false;
    const bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
    if (!secure && parts.nScheme != INTERNET_SCHEME_HTTP) return false;
    const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
    std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/";
    if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);

    HINTERNET session = WinHttpOpen(L"LingBuilder-wxmore-avatar/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!session) return false;
    WinHttpSetTimeouts(session, 1500, 1500, 3000, 3000);
    HINTERNET connection = WinHttpConnect(session, host.c_str(), parts.nPort, 0);
    HINTERNET request = connection ? WinHttpOpenRequest(connection, L"GET", path.c_str(), nullptr,
                                                        WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
                                                        secure ? WINHTTP_FLAG_SECURE : 0)
                                   : nullptr;
    bool ok = false;
    std::vector<unsigned char> bytes;
    if (request && WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
        WinHttpReceiveResponse(request, nullptr)) {
        DWORD status = 0;
        DWORD size = sizeof(status);
        WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &status, &size, WINHTTP_NO_HEADER_INDEX);
        if (status >= 200 && status < 300) {
            constexpr size_t MAX_AVATAR = 5 * 1024 * 1024;
            while (bytes.size() < MAX_AVATAR) {
                DWORD available = 0;
                if (!WinHttpQueryDataAvailable(request, &available) || !available) break;
                const DWORD wanted = static_cast<DWORD>(std::min<size_t>(available, MAX_AVATAR - bytes.size()));
                const size_t offset = bytes.size();
                bytes.resize(offset + wanted);
                DWORD read = 0;
                if (!WinHttpReadData(request, bytes.data() + offset, wanted, &read)) {
                    bytes.clear();
                    break;
                }
                bytes.resize(offset + read);
                if (!read) break;
            }
            ok = !bytes.empty() && bytes.size() < MAX_AVATAR;
        }
    }
    if (request) WinHttpCloseHandle(request);
    if (connection) WinHttpCloseHandle(connection);
    WinHttpCloseHandle(session);
    if (!ok) return false;

    const std::wstring temporary = outputPath + L".tmp";
    {
        std::ofstream output(std::filesystem::path(temporary), std::ios::binary | std::ios::trunc);
        if (!output) return false;
        output.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
        if (!output) return false;
    }
    if (!MoveFileExW(temporary.c_str(), outputPath.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        DeleteFileW(temporary.c_str());
        return false;
    }
    return true;
}

ULONG_PTR EnsureGdiPlus() {
    static std::once_flag once;
    static ULONG_PTR token = 0;
    std::call_once(once, [] {
        Gdiplus::GdiplusStartupInput input;
        Gdiplus::GdiplusStartup(&token, &input, nullptr);
    });
    return token;
}

HBITMAP CreateAvatarBitmap(const InstanceSnapshot& instance, int size) {
    EnsureGdiPlus();
    Gdiplus::Bitmap bitmap(size, size, PixelFormat32bppARGB);
    Gdiplus::Graphics graphics(&bitmap);
    graphics.SetSmoothingMode(Gdiplus::SmoothingModeHighQuality);
    graphics.Clear(Gdiplus::Color(255, 31, 41, 55));

    bool renderedImage = false;
    if (!instance.avatarPath.empty() && FileExists(instance.avatarPath)) {
        Gdiplus::Image source(instance.avatarPath.c_str());
        if (source.GetLastStatus() == Gdiplus::Ok && source.GetWidth() && source.GetHeight()) {
            const double sourceRatio = static_cast<double>(source.GetWidth()) / source.GetHeight();
            int sourceX = 0;
            int sourceY = 0;
            int sourceWidth = static_cast<int>(source.GetWidth());
            int sourceHeight = static_cast<int>(source.GetHeight());
            if (sourceRatio > 1.0) {
                sourceWidth = sourceHeight;
                sourceX = (static_cast<int>(source.GetWidth()) - sourceWidth) / 2;
            } else if (sourceRatio < 1.0) {
                sourceHeight = sourceWidth;
                sourceY = (static_cast<int>(source.GetHeight()) - sourceHeight) / 2;
            }
            graphics.DrawImage(&source, Gdiplus::Rect(0, 0, size, size), sourceX, sourceY, sourceWidth, sourceHeight,
                               Gdiplus::UnitPixel);
            renderedImage = true;
        }
    }

    if (!renderedImage) {
        const uint64_t hash = Fnv1a(instance.wxid.empty() ? std::to_wstring(instance.processId) : instance.wxid);
        const BYTE red = static_cast<BYTE>(55 + (hash & 0x5f));
        const BYTE green = static_cast<BYTE>(80 + ((hash >> 8) & 0x5f));
        const BYTE blue = static_cast<BYTE>(100 + ((hash >> 16) & 0x5f));
        Gdiplus::SolidBrush background(Gdiplus::Color(255, red, green, blue));
        graphics.FillRectangle(&background, 0, 0, size, size);
        std::wstring initial = !instance.nickname.empty() ? instance.nickname.substr(0, 1)
                                                          : (!instance.wxid.empty() ? instance.wxid.substr(0, 1) : L"微");
        Gdiplus::FontFamily family(L"Microsoft YaHei UI");
        Gdiplus::Font font(&family, static_cast<Gdiplus::REAL>(size * 0.44), Gdiplus::FontStyleBold,
                           Gdiplus::UnitPixel);
        Gdiplus::SolidBrush foreground(Gdiplus::Color(255, 255, 255, 255));
        Gdiplus::StringFormat format;
        format.SetAlignment(Gdiplus::StringAlignmentCenter);
        format.SetLineAlignment(Gdiplus::StringAlignmentCenter);
        graphics.DrawString(initial.c_str(), static_cast<INT>(initial.size()), &font,
                            Gdiplus::RectF(0, 0, static_cast<Gdiplus::REAL>(size), static_cast<Gdiplus::REAL>(size)),
                            &format, &foreground);
    }

    HBITMAP handle = nullptr;
    bitmap.GetHBITMAP(Gdiplus::Color(0, 0, 0, 0), &handle);
    return handle;
}

void EnsureListColumns(MonitorState& monitor) {
    if (monitor.columnsReady || !IsWindow(monitor.instanceList)) return;
    while (ListView_DeleteColumn(monitor.instanceList, 0)) {
    }
    struct Column {
        const wchar_t* title;
        int width;
    };
    const Column columns[] = {
        {L"头像", 56}, {L"PID", 76}, {L"登录状态", 94}, {L"wxid", 176},
        {L"微信昵称", 150}, {L"头像地址", 330}};
    for (int index = 0; index < static_cast<int>(std::size(columns)); ++index) {
        LVCOLUMNW column{};
        column.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
        column.pszText = const_cast<wchar_t*>(columns[index].title);
        column.cx = columns[index].width;
        column.iSubItem = index;
        ListView_InsertColumn(monitor.instanceList, index, &column);
    }
    ListView_SetExtendedListViewStyleEx(monitor.instanceList,
                                        LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER | LVS_EX_LABELTIP,
                                        LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER | LVS_EX_LABELTIP);
    monitor.columnsReady = true;
}

void SetListSubItem(HWND list, int row, int column, const std::wstring& text) {
    LVITEMW item{};
    item.iSubItem = column;
    item.pszText = const_cast<wchar_t*>(text.c_str());
    SendMessageW(list, LVM_SETITEMTEXTW, static_cast<WPARAM>(row), reinterpret_cast<LPARAM>(&item));
}

void RenderInstances(MonitorState& monitor, const std::vector<InstanceSnapshot>& instances) {
    if (!IsWindow(monitor.instanceList)) return;
    EnsureListColumns(monitor);
    SendMessageW(monitor.instanceList, WM_SETREDRAW, FALSE, 0);
    ListView_DeleteAllItems(monitor.instanceList);

    HIMAGELIST images = ImageList_Create(44, 44, ILC_COLOR32, std::max<int>(1, static_cast<int>(instances.size())), 4);
    for (size_t index = 0; index < instances.size(); ++index) {
        const InstanceSnapshot& instance = instances[index];
        HBITMAP avatar = CreateAvatarBitmap(instance, 44);
        const int imageIndex = avatar ? ImageList_Add(images, avatar, nullptr) : -1;
        if (avatar) DeleteObject(avatar);

        std::wstring firstCell;
        LVITEMW item{};
        item.mask = LVIF_TEXT | LVIF_IMAGE;
        item.iItem = static_cast<int>(index);
        item.iSubItem = 0;
        item.pszText = firstCell.data();
        item.iImage = imageIndex;
        ListView_InsertItem(monitor.instanceList, &item);
        SetListSubItem(monitor.instanceList, static_cast<int>(index), 1, std::to_wstring(instance.processId));
        const std::wstring loginState = instance.loggedIn
                                            ? (instance.extensionsReady ? L"已登录" : L"资料补全中")
                                            : (instance.state.empty() ? L"等待登录" : instance.state);
        SetListSubItem(monitor.instanceList, static_cast<int>(index), 2, loginState);
        SetListSubItem(monitor.instanceList, static_cast<int>(index), 3,
                       instance.wxid.empty() ? L"等待获取" : instance.wxid);
        SetListSubItem(monitor.instanceList, static_cast<int>(index), 4,
                       instance.nickname.empty() ? L"等待获取" : instance.nickname);
        SetListSubItem(monitor.instanceList, static_cast<int>(index), 5,
                       instance.avatarUrl.empty() ? L"等待获取" : instance.avatarUrl);
    }

    HIMAGELIST previous = ListView_SetImageList(monitor.instanceList, images, LVSIL_SMALL);
    if (previous && previous != images) ImageList_Destroy(previous);
    monitor.imageList = images;
    SendMessageW(monitor.instanceList, WM_SETREDRAW, TRUE, 0);
    InvalidateRect(monitor.instanceList, nullptr, TRUE);
}

void AppendLogs(MonitorState& monitor, const std::vector<std::wstring>& logs) {
    if (!IsWindow(monitor.logList)) return;
    for (const auto& line : logs) {
        SendMessageW(monitor.logList, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(line.c_str()));
    }
    while (SendMessageW(monitor.logList, LB_GETCOUNT, 0, 0) > 300) {
        SendMessageW(monitor.logList, LB_DELETESTRING, 0, 0);
    }
    const LRESULT count = SendMessageW(monitor.logList, LB_GETCOUNT, 0, 0);
    if (count > 0) SendMessageW(monitor.logList, LB_SETTOPINDEX, static_cast<WPARAM>(count - 1), 0);
}

class WxMoreRuntime {
public:
    static WxMoreRuntime& Instance() {
        static WxMoreRuntime runtime;
        return runtime;
    }

    bool BindMonitor(HWND instanceList, HWND statusLabel, HWND logList) {
        if (!IsWindow(instanceList) || !IsWindow(statusLabel) || !IsWindow(logList)) {
            SetError(L"绑定监控失败：实例列表、状态栏或日志列表控件无效。");
            return false;
        }
        const HWND root = GetAncestor(instanceList, GA_ROOT);
        if (!root || !IsWindow(root)) {
            SetError(L"绑定监控失败：无法取得当前窗口句柄。");
            return false;
        }

        StopMonitor();
        auto monitor = std::make_unique<MonitorState>();
        monitor->root = root;
        monitor->instanceList = instanceList;
        monitor->statusLabel = statusLabel;
        monitor->logList = logList;
        if (!SetWindowSubclass(root, RootSubclassProc, WXMORE_SUBCLASS_ID, 0)) {
            SetError(L"绑定监控失败：无法注册窗口消息处理器。");
            return false;
        }
        MonitorState* raw = monitor.get();
        try {
            monitor->worker = std::thread([this, raw] { MonitorLoop(*raw); });
        } catch (...) {
            RemoveWindowSubclass(root, RootSubclassProc, WXMORE_SUBCLASS_ID);
            SetError(L"绑定监控失败：无法创建后台监控线程。");
            return false;
        }
        {
            std::lock_guard<std::mutex> lock(monitorGuard_);
            monitor_ = std::move(monitor);
        }
        SetWindowTextW(statusLabel, L"正在连接本地 WxHook Manager Host...");
        AppendLogs(*raw, {L"[" + CurrentTimeText() + L"] 已启动后台登录监控。"});
        return true;
    }

    bool StartWeixin(const std::wstring& executablePath) {
        if (!EnsureHost()) return false;
        nlohmann::json payload;
        if (executablePath.empty()) payload["executablePath"] = nullptr;
        else payload["executablePath"] = WideToUtf8(executablePath);
        const HttpResult response = LocalRequest(L"POST", L"/api/v1/instances/start", Token(), payload.dump());
        if (!response.transportOk || response.statusCode < 200 || response.statusCode >= 300) {
            SetError(ApiErrorMessage(response));
            QueueLog(L"启动微信失败：" + LastError());
            return false;
        }
        QueueLog(L"已启动一个微信 4.1.10.27 实例，正在等待登录与资料事件。");
        RefreshNow();
        return true;
    }

    bool RefreshNow() {
        std::lock_guard<std::mutex> guard(monitorGuard_);
        if (!monitor_) {
            SetError(L"尚未绑定微信多开监控界面。");
            return false;
        }
        {
            std::lock_guard<std::mutex> lock(monitor_->wakeMutex);
            monitor_->refreshRequested = true;
        }
        monitor_->wake.notify_one();
        return true;
    }

    void StopMonitor() {
        std::unique_ptr<MonitorState> monitor;
        {
            std::lock_guard<std::mutex> guard(monitorGuard_);
            if (!monitor_) return;
            monitor = std::move(monitor_);
        }
        monitor->stop.store(true);
        monitor->wake.notify_all();
        if (monitor->worker.joinable() && monitor->worker.get_id() != std::this_thread::get_id()) {
            monitor->worker.join();
        }
        if (monitor->root && IsWindow(monitor->root)) {
            RemoveWindowSubclass(monitor->root, RootSubclassProc, WXMORE_SUBCLASS_ID);
        }
        if (monitor->imageList) {
            if (IsWindow(monitor->instanceList)) ListView_SetImageList(monitor->instanceList, nullptr, LVSIL_SMALL);
            ImageList_Destroy(monitor->imageList);
            monitor->imageList = nullptr;
        }
    }

    int InstanceCount() const { return instanceCount_.load(); }
    int LoggedInCount() const { return loggedInCount_.load(); }

    std::wstring LastError() const {
        std::lock_guard<std::mutex> lock(errorMutex_);
        return lastError_;
    }

    void DispatchUi(HWND root) {
        MonitorState* monitor = nullptr;
        {
            std::lock_guard<std::mutex> guard(monitorGuard_);
            if (!monitor_ || monitor_->root != root) return;
            monitor = monitor_.get();
        }
        std::vector<InstanceSnapshot> instances;
        std::vector<std::wstring> logs;
        std::wstring status;
        {
            std::lock_guard<std::mutex> lock(monitor->pendingMutex);
            instances = monitor->pending;
            logs.swap(monitor->pendingLogs);
            status = monitor->pendingStatus;
        }
        RenderInstances(*monitor, instances);
        if (IsWindow(monitor->statusLabel) && !status.empty()) SetWindowTextW(monitor->statusLabel, status.c_str());
        AppendLogs(*monitor, logs);
    }

private:
    WxMoreRuntime() = default;
    ~WxMoreRuntime() { StopMonitor(); }
    WxMoreRuntime(const WxMoreRuntime&) = delete;
    WxMoreRuntime& operator=(const WxMoreRuntime&) = delete;

    static LRESULT CALLBACK RootSubclassProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam,
                                             UINT_PTR, DWORD_PTR) {
        if (message == WM_LB_WXMORE_UPDATE) {
            Instance().DispatchUi(window);
            return 0;
        }
        if (message == WM_NCDESTROY) {
            const LRESULT result = DefSubclassProc(window, message, wParam, lParam);
            Instance().StopMonitor();
            return result;
        }
        return DefSubclassProc(window, message, wParam, lParam);
    }

    void SetError(const std::wstring& message) {
        std::lock_guard<std::mutex> lock(errorMutex_);
        lastError_ = message;
    }

    std::wstring Token() const {
        std::lock_guard<std::mutex> lock(tokenMutex_);
        return token_;
    }

    bool EnsureHost() {
        std::lock_guard<std::mutex> hostLock(hostMutex_);
        const HttpResult health = LocalRequest(L"GET", L"/health", L"");
        if (!health.transportOk || health.statusCode != 200) {
            const std::wstring hostPath = (std::filesystem::path(ExecutableDirectory()) /
                                           L"WxHook.Manager.Host.exe").wstring();
            if (!FileExists(hostPath)) {
                SetError(L"未找到 WxHook.Manager.Host.exe；请确认模块运行时文件与程序位于同一目录。");
                return false;
            }
            std::wstring command = L"\"" + hostPath + L"\"";
            STARTUPINFOW startup{};
            startup.cb = sizeof(startup);
            PROCESS_INFORMATION process{};
            const std::wstring workingDirectory = std::filesystem::path(hostPath).parent_path().wstring();
            if (!CreateProcessW(hostPath.c_str(), command.data(), nullptr, nullptr, FALSE,
                                CREATE_NO_WINDOW, nullptr, workingDirectory.c_str(), &startup, &process)) {
                const DWORD error = GetLastError();
                SetError(L"启动 WxHook Manager Host 失败：" + SystemErrorText(error));
                return false;
            }
            CloseHandle(process.hThread);
            CloseHandle(process.hProcess);
            bool ready = false;
            for (int attempt = 0; attempt < 40; ++attempt) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                const HttpResult probe = LocalRequest(L"GET", L"/health", L"");
                if (probe.transportOk && probe.statusCode == 200) {
                    ready = true;
                    break;
                }
            }
            if (!ready) {
                SetError(L"WxHook Manager Host 启动后未在 4 秒内就绪，请检查 .NET 8 运行时和 Host 日志。");
                return false;
            }
        }

        {
            std::lock_guard<std::mutex> tokenLock(tokenMutex_);
            if (token_.empty()) token_ = LoadDpapiToken();
            if (token_.empty()) {
                SetError(L"Host 已运行，但无法读取当前用户 DPAPI 访问令牌；请关闭旧 Host 后由本程序重新启动。");
                return false;
            }
        }
        SetError(L"");
        return true;
    }

    std::optional<std::vector<InstanceSnapshot>> FetchInstances() {
        if (!EnsureHost()) return std::nullopt;
        HttpResult response = LocalRequest(L"GET", L"/api/v1/instances", Token());
        if (response.statusCode == 401) {
            {
                std::lock_guard<std::mutex> tokenLock(tokenMutex_);
                token_.clear();
            }
            if (EnsureHost()) response = LocalRequest(L"GET", L"/api/v1/instances", Token());
        }
        if (!response.transportOk || response.statusCode < 200 || response.statusCode >= 300) {
            SetError(ApiErrorMessage(response));
            return std::nullopt;
        }
        try {
            const nlohmann::json root = nlohmann::json::parse(response.body);
            const nlohmann::json& data = root.is_object() && root.contains("data") ? root.at("data") : root;
            if (!data.is_array()) throw std::runtime_error("instances data is not an array");
            std::vector<InstanceSnapshot> instances;
            instances.reserve(data.size());
            for (const auto& item : data) {
                if (!item.is_object()) continue;
                InstanceSnapshot instance;
                instance.id = JsonText(item, "id");
                instance.processId = item.value("processId", 0);
                instance.state = JsonState(item, "state");
                if (IsStoppedState(instance.state)) continue;
                instance.lastError = JsonText(item, "lastError");
                if (item.contains("login") && item["login"].is_object()) {
                    instance.loggedIn = item["login"].value("isLogin", false);
                }
                if (item.contains("profile") && item["profile"].is_object()) {
                    const auto& profile = item["profile"];
                    instance.wxid = JsonText(profile, "internalWxid");
                    if (instance.wxid.empty()) instance.wxid = JsonText(profile, "accountIdCandidate");
                    instance.nickname = JsonText(profile, "nickname");
                    instance.avatarUrl = JsonText(profile, "smallAvatarUrl");
                    if (instance.avatarUrl.empty()) instance.avatarUrl = JsonText(profile, "avatarUrl");
                    instance.coreReady = profile.value("coreReadOk", false);
                    instance.extensionsReady = profile.value("extensionsReady", false);
                }
                if (!instance.avatarUrl.empty()) {
                    const std::wstring cache = AvatarCachePath(instance.avatarUrl);
                    if (FileExists(cache)) instance.avatarPath = cache;
                }
                instances.push_back(std::move(instance));
            }
            std::sort(instances.begin(), instances.end(), [](const auto& left, const auto& right) {
                return left.processId < right.processId;
            });
            SetError(L"");
            return instances;
        } catch (const std::exception& exception) {
            SetError(L"解析 WxHook Manager 实例响应失败：" + Utf8ToWide(exception.what()));
            return std::nullopt;
        }
    }

    void Publish(MonitorState& monitor, const std::vector<InstanceSnapshot>& instances,
                 std::vector<std::wstring> logs = {}) {
        const int logged = static_cast<int>(std::count_if(instances.begin(), instances.end(),
                                                          [](const auto& item) { return item.loggedIn; }));
        instanceCount_.store(static_cast<int>(instances.size()));
        loggedInCount_.store(logged);
        std::wstring status = L"Host 已连接 · 微信实例 " + std::to_wstring(instances.size()) +
                              L" · 已登录 " + std::to_wstring(logged);
        {
            std::lock_guard<std::mutex> lock(monitor.pendingMutex);
            monitor.pending = instances;
            monitor.pendingStatus = std::move(status);
            for (auto& line : logs) monitor.pendingLogs.push_back(L"[" + CurrentTimeText() + L"] " + line);
        }
        PostMessageW(monitor.root, WM_LB_WXMORE_UPDATE, 0, 0);
    }

    void PublishFailure(MonitorState& monitor, const std::wstring& error) {
        std::vector<std::wstring> logs;
        if (!error.empty() && error != monitor.lastPublishedError) {
            monitor.lastPublishedError = error;
            logs.push_back(L"[" + CurrentTimeText() + L"] " + error);
        }
        {
            std::lock_guard<std::mutex> lock(monitor.pendingMutex);
            monitor.pendingStatus = error.empty() ? L"等待 WxHook Manager Host..." : error;
            monitor.pendingLogs.insert(monitor.pendingLogs.end(), logs.begin(), logs.end());
        }
        PostMessageW(monitor.root, WM_LB_WXMORE_UPDATE, 0, 0);
    }

    void QueueLog(const std::wstring& message) {
        std::lock_guard<std::mutex> guard(monitorGuard_);
        if (!monitor_) return;
        {
            std::lock_guard<std::mutex> lock(monitor_->pendingMutex);
            monitor_->pendingLogs.push_back(L"[" + CurrentTimeText() + L"] " + message);
        }
        PostMessageW(monitor_->root, WM_LB_WXMORE_UPDATE, 0, 0);
    }

    void MonitorLoop(MonitorState& monitor) {
        bool announcedConnection = false;
        while (!monitor.stop.load()) {
            auto fetched = FetchInstances();
            if (!fetched) {
                PublishFailure(monitor, LastError());
            } else {
                std::vector<InstanceSnapshot> instances = std::move(*fetched);
                std::vector<std::wstring> logs;
                if (!announcedConnection) {
                    announcedConnection = true;
                    monitor.lastPublishedError.clear();
                    logs.push_back(L"已连接 WxHook Manager Host，登录资料将在到达后立即显示。");
                }
                const std::wstring fingerprint = SnapshotFingerprint(instances);
                if (fingerprint != monitor.lastFingerprint) {
                    if (!monitor.lastFingerprint.empty()) {
                        const int logged = static_cast<int>(std::count_if(instances.begin(), instances.end(),
                                                                          [](const auto& item) { return item.loggedIn; }));
                        logs.push_back(L"实例状态已更新：共 " + std::to_wstring(instances.size()) +
                                       L" 个，已登录 " + std::to_wstring(logged) + L" 个。");
                    }
                    monitor.lastFingerprint = fingerprint;
                    Publish(monitor, instances, std::move(logs));
                }

                bool downloaded = false;
                const auto now = std::chrono::steady_clock::now();
                for (auto& instance : instances) {
                    if (monitor.stop.load()) break;
                    if (instance.avatarUrl.empty() || !instance.avatarPath.empty()) continue;
                    const auto found = avatarAttempts_.find(instance.avatarUrl);
                    if (found != avatarAttempts_.end() && now - found->second < std::chrono::seconds(30)) continue;
                    avatarAttempts_[instance.avatarUrl] = now;
                    const std::wstring path = AvatarCachePath(instance.avatarUrl);
                    if (DownloadAvatar(instance.avatarUrl, path)) {
                        instance.avatarPath = path;
                        downloaded = true;
                        Publish(monitor, instances, {L"已更新 PID " + std::to_wstring(instance.processId) + L" 的头像。"});
                    }
                }
                if (downloaded) monitor.lastFingerprint = SnapshotFingerprint(instances);
            }

            std::unique_lock<std::mutex> lock(monitor.wakeMutex);
            monitor.wake.wait_for(lock, std::chrono::milliseconds(500), [&monitor] {
                return monitor.stop.load() || monitor.refreshRequested;
            });
            monitor.refreshRequested = false;
        }
    }

    mutable std::mutex errorMutex_;
    std::wstring lastError_;
    mutable std::mutex tokenMutex_;
    std::wstring token_;
    std::mutex hostMutex_;
    std::mutex monitorGuard_;
    std::unique_ptr<MonitorState> monitor_;
    std::atomic<int> instanceCount_{0};
    std::atomic<int> loggedInCount_{0};
    std::unordered_map<std::wstring, std::chrono::steady_clock::time_point> avatarAttempts_;
};

} // namespace

bool LB_WxMore_BindMonitor(HWND instanceList, HWND statusLabel, HWND logList) {
    return WxMoreRuntime::Instance().BindMonitor(instanceList, statusLabel, logList);
}

bool LB_WxMore_StartWeixin(const std::wstring& executablePath) {
    return WxMoreRuntime::Instance().StartWeixin(executablePath);
}

bool LB_WxMore_RefreshNow() {
    return WxMoreRuntime::Instance().RefreshNow();
}

void LB_WxMore_StopMonitor() {
    WxMoreRuntime::Instance().StopMonitor();
}

int LB_WxMore_InstanceCount() {
    return WxMoreRuntime::Instance().InstanceCount();
}

int LB_WxMore_LoggedInCount() {
    return WxMoreRuntime::Instance().LoggedInCount();
}

const wchar_t* LB_WxMore_LastError() {
    thread_local std::wstring snapshot;
    snapshot = WxMoreRuntime::Instance().LastError();
    return snapshot.c_str();
}
