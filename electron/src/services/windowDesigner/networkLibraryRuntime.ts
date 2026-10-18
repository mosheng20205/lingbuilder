import { InstalledModule } from '../modules/types';
import { MAIL_CLIENT_RUNTIME } from './mailClientRuntime';

const SOCKET_SUPPORT = String.raw`
static bool LB_EnsureSockets() {
    static std::once_flag once; static bool initialized = false;
    std::call_once(once, []() { WSADATA data = {}; initialized = WSAStartup(MAKEWORD(2, 2), &data) == 0; });
    return initialized;
}
`;

const TCP_RUNTIME = String.raw`
static SOCKET g_lbTcpSocket = INVALID_SOCKET;
static std::wstring g_lbTcpError;
void TCP_关闭() { if (g_lbTcpSocket != INVALID_SOCKET) { shutdown(g_lbTcpSocket, SD_BOTH); closesocket(g_lbTcpSocket); g_lbTcpSocket = INVALID_SOCKET; } }
bool TCP_是否已连接() { return g_lbTcpSocket != INVALID_SOCKET; }
const wchar_t* TCP_取错误() { return LB_ReturnText(g_lbTcpError); }

bool TCP_连接(const wchar_t* host, int port, int timeoutMs) {
    TCP_关闭(); g_lbTcpError.clear(); if (!LB_EnsureSockets() || port <= 0 || port > 65535) { g_lbTcpError = L"TCP 参数或 Winsock 初始化无效。"; return false; }
    ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; hints.ai_socktype = SOCK_STREAM; hints.ai_protocol = IPPROTO_TCP; ADDRINFOW* addresses = nullptr; const std::wstring service = std::to_wstring(port);
    if (GetAddrInfoW(host, service.c_str(), &hints, &addresses) != 0) { g_lbTcpError = L"TCP 主机解析失败。"; return false; }
    for (ADDRINFOW* address = addresses; address; address = address->ai_next) {
        SOCKET candidate = socket(address->ai_family, address->ai_socktype, address->ai_protocol); if (candidate == INVALID_SOCKET) continue;
        u_long nonBlocking = 1; ioctlsocket(candidate, FIONBIO, &nonBlocking); int result = connect(candidate, address->ai_addr, static_cast<int>(address->ai_addrlen));
        if (result == SOCKET_ERROR && WSAGetLastError() == WSAEWOULDBLOCK) {
            fd_set writable; FD_ZERO(&writable); FD_SET(candidate, &writable); timeval timeout = { (std::max)(0, timeoutMs) / 1000, ((std::max)(0, timeoutMs) % 1000) * 1000 };
            result = select(0, nullptr, &writable, nullptr, &timeout) > 0 ? 0 : SOCKET_ERROR; if (result == 0) { int socketError = 0; int size = sizeof(socketError); getsockopt(candidate, SOL_SOCKET, SO_ERROR, reinterpret_cast<char*>(&socketError), &size); if (socketError != 0) result = SOCKET_ERROR; }
        }
        nonBlocking = 0; ioctlsocket(candidate, FIONBIO, &nonBlocking);
        if (result == 0) { const DWORD timeout = static_cast<DWORD>((std::max)(1, timeoutMs)); setsockopt(candidate, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout)); setsockopt(candidate, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout)); g_lbTcpSocket = candidate; break; }
        closesocket(candidate);
    }
    FreeAddrInfoW(addresses); if (g_lbTcpSocket == INVALID_SOCKET) g_lbTcpError = L"TCP 连接失败或超时。"; return g_lbTcpSocket != INVALID_SOCKET;
}

int TCP_发送文本(const wchar_t* text) { if (g_lbTcpSocket == INVALID_SOCKET) return -1; const std::string bytes = LB_WideToUtf8(text); size_t sent = 0; while (sent < bytes.size()) { int count = send(g_lbTcpSocket, bytes.data() + sent, static_cast<int>(bytes.size() - sent), 0); if (count <= 0) { g_lbTcpError = L"TCP 发送失败。"; return -1; } sent += static_cast<size_t>(count); } return static_cast<int>(sent); }
const wchar_t* TCP_接收文本(int maximumBytes) { if (g_lbTcpSocket == INVALID_SOCKET) return LB_ReturnText(L""); std::vector<char> buffer(static_cast<size_t>((std::max)(1, (std::min)(maximumBytes, 16 * 1024 * 1024)))); int count = recv(g_lbTcpSocket, buffer.data(), static_cast<int>(buffer.size()), 0); if (count <= 0) { if (count < 0) g_lbTcpError = L"TCP 接收失败或超时。"; return LB_ReturnText(L""); } return LB_ReturnText(LB_Utf8ToWide(std::string(buffer.data(), static_cast<size_t>(count)))); }
`;

const UDP_RUNTIME = String.raw`
static SOCKET g_lbUdpSocket = INVALID_SOCKET; static std::wstring g_lbUdpError; static std::wstring g_lbUdpSource; static int g_lbUdpSourcePort = 0; static bool g_lbUdpReuseAddr = false; static bool g_lbUdpBroadcast = false;
void UDP_关闭() { if (g_lbUdpSocket != INVALID_SOCKET) { closesocket(g_lbUdpSocket); g_lbUdpSocket = INVALID_SOCKET; } }
const wchar_t* UDP_取错误() { return LB_ReturnText(g_lbUdpError); } const wchar_t* UDP_取来源地址() { return LB_ReturnText(g_lbUdpSource); } int UDP_取来源端口() { return g_lbUdpSourcePort; }
// 广播/端口复用开关都记在标志位上：UDP_绑定 会关闭并重建套接字，开关必须在重建后的套接字上重放，
// 这样 UDP_允许广播 在绑定前后调用效果一致（命令契约如此承诺）。
static bool LB_EnsureUdpSocket() {
    if (g_lbUdpSocket != INVALID_SOCKET) return true; if (!LB_EnsureSockets()) return false;
    g_lbUdpSocket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP); if (g_lbUdpSocket == INVALID_SOCKET) return false;
    if (g_lbUdpReuseAddr) { const BOOL reuse = TRUE; setsockopt(g_lbUdpSocket, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse)); }
    if (g_lbUdpBroadcast) { const BOOL broadcast = TRUE; setsockopt(g_lbUdpSocket, SOL_SOCKET, SO_BROADCAST, reinterpret_cast<const char*>(&broadcast), sizeof(broadcast)); }
    return true;
}
bool UDP_允许广播(bool allowed) {
    g_lbUdpBroadcast = allowed;
    if (!LB_EnsureUdpSocket()) { g_lbUdpError = L"UDP 套接字创建失败，无法开启广播。"; return false; }
    const BOOL value = allowed ? TRUE : FALSE;
    if (setsockopt(g_lbUdpSocket, SOL_SOCKET, SO_BROADCAST, reinterpret_cast<const char*>(&value), sizeof(value)) == SOCKET_ERROR) { g_lbUdpError = L"UDP 广播开关设置失败。"; return false; }
    return true;
}
bool UDP_允许端口复用(bool allowed) {
    g_lbUdpReuseAddr = allowed;
    if (g_lbUdpSocket != INVALID_SOCKET) { const BOOL value = allowed ? TRUE : FALSE; setsockopt(g_lbUdpSocket, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&value), sizeof(value)); }
    return true;
}
bool UDP_绑定(int port) { UDP_关闭(); g_lbUdpError.clear(); if (!LB_EnsureUdpSocket() || port < 0 || port > 65535) return false; sockaddr_in address = {}; address.sin_family = AF_INET; address.sin_addr.s_addr = htonl(INADDR_ANY); address.sin_port = htons(static_cast<u_short>(port)); if (bind(g_lbUdpSocket, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) { g_lbUdpError = L"UDP 端口绑定失败。"; UDP_关闭(); return false; } return true; }

int UDP_发送文本(const wchar_t* host, int port, const wchar_t* text) {
    if (!LB_EnsureUdpSocket() || port <= 0 || port > 65535) return -1; ADDRINFOW hints = {}; hints.ai_family = AF_INET; hints.ai_socktype = SOCK_DGRAM; hints.ai_protocol = IPPROTO_UDP; ADDRINFOW* address = nullptr; const std::wstring service = std::to_wstring(port);
    if (GetAddrInfoW(host, service.c_str(), &hints, &address) != 0 || !address) { g_lbUdpError = L"UDP 主机解析失败。"; return -1; } const std::string bytes = LB_WideToUtf8(text); int result = sendto(g_lbUdpSocket, bytes.data(), static_cast<int>(bytes.size()), 0, address->ai_addr, static_cast<int>(address->ai_addrlen)); FreeAddrInfoW(address); if (result < 0) g_lbUdpError = L"UDP 发送失败。"; return result;
}

const wchar_t* UDP_接收文本(int maximumBytes, int timeoutMs) {
    if (!LB_EnsureUdpSocket()) return LB_ReturnText(L""); DWORD timeout = static_cast<DWORD>((std::max)(1, timeoutMs)); setsockopt(g_lbUdpSocket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    std::vector<char> buffer(static_cast<size_t>((std::max)(1, (std::min)(maximumBytes, 65507)))); sockaddr_storage source = {}; int sourceSize = sizeof(source); int count = recvfrom(g_lbUdpSocket, buffer.data(), static_cast<int>(buffer.size()), 0, reinterpret_cast<sockaddr*>(&source), &sourceSize);
    if (count < 0) { g_lbUdpError = L"UDP 接收失败或超时。"; return LB_ReturnText(L""); } wchar_t host[NI_MAXHOST] = {}; wchar_t service[NI_MAXSERV] = {}; GetNameInfoW(reinterpret_cast<sockaddr*>(&source), sourceSize, host, _countof(host), service, _countof(service), NI_NUMERICHOST | NI_NUMERICSERV); g_lbUdpSource = host; g_lbUdpSourcePort = _wtoi(service);
    return LB_ReturnText(LB_Utf8ToWide(std::string(buffer.data(), static_cast<size_t>(count))));
}
`;

const DNS_RUNTIME = String.raw`
#pragma comment(lib, "iphlpapi.lib")
#include <iphlpapi.h>

const wchar_t* DNS_解析首个地址(const wchar_t* host) { if (!LB_EnsureSockets()) return LB_ReturnText(L""); ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; ADDRINFOW* addresses = nullptr; if (GetAddrInfoW(host, nullptr, &hints, &addresses) != 0 || !addresses) return LB_ReturnText(L""); wchar_t buffer[INET6_ADDRSTRLEN] = {}; void* raw = addresses->ai_family == AF_INET ? static_cast<void*>(&reinterpret_cast<sockaddr_in*>(addresses->ai_addr)->sin_addr) : static_cast<void*>(&reinterpret_cast<sockaddr_in6*>(addresses->ai_addr)->sin6_addr); InetNtopW(addresses->ai_family, raw, buffer, _countof(buffer)); FreeAddrInfoW(addresses); return LB_ReturnText(buffer); }

const wchar_t* DNS_反向查询(const wchar_t* ip) { if (!LB_EnsureSockets()) return LB_ReturnText(L""); sockaddr_storage address = {}; int size = 0; sockaddr_in* ipv4 = reinterpret_cast<sockaddr_in*>(&address); sockaddr_in6* ipv6 = reinterpret_cast<sockaddr_in6*>(&address); if (InetPtonW(AF_INET, ip, &ipv4->sin_addr) == 1) { ipv4->sin_family = AF_INET; size = sizeof(*ipv4); } else if (InetPtonW(AF_INET6, ip, &ipv6->sin6_addr) == 1) { ipv6->sin6_family = AF_INET6; size = sizeof(*ipv6); } else return LB_ReturnText(L""); wchar_t host[NI_MAXHOST] = {}; return GetNameInfoW(reinterpret_cast<sockaddr*>(&address), size, host, _countof(host), nullptr, 0, NI_NAMEREQD) == 0 ? LB_ReturnText(host) : LB_ReturnText(L""); }

const wchar_t* 网络_取本机名() { if (!LB_EnsureSockets()) return LB_ReturnText(L""); char host[256] = {}; return gethostname(host, sizeof(host)) == 0 ? LB_ReturnText(LB_Utf8ToWide(host)) : LB_ReturnText(L""); }
bool 网络_是否IPv4(const wchar_t* value) { IN_ADDR address = {}; return InetPtonW(AF_INET, value, &address) == 1; }
bool 网络_是否IPv6(const wchar_t* value) { IN6_ADDR address = {}; return InetPtonW(AF_INET6, value, &address) == 1; }

static std::vector<unsigned char> LB_NetworkAdapterBuffer() {
    unsigned long size = 16 * 1024;
    std::vector<unsigned char> buffer(size);
    auto* addresses = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
    unsigned long result = GetAdaptersAddresses(AF_UNSPEC, 0, nullptr, addresses, &size);
    if (result == ERROR_BUFFER_OVERFLOW) { buffer.resize(size); addresses = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data()); result = GetAdaptersAddresses(AF_UNSPEC, 0, nullptr, addresses, &size); }
    if (result != NO_ERROR) buffer.clear();
    return buffer;
}

const wchar_t* 网络_取MAC地址() {
    const std::vector<unsigned char> buffer = LB_NetworkAdapterBuffer();
    if (buffer.empty()) return LB_ReturnText(L"");
    auto* addresses = reinterpret_cast<const IP_ADAPTER_ADDRESSES*>(buffer.data());
    for (auto* adapter = addresses; adapter; adapter = adapter->Next) {
        if (adapter->IfType == IF_TYPE_SOFTWARE_LOOPBACK || adapter->PhysicalAddressLength == 0) continue;
        std::wstring mac;
        wchar_t byteText[4];
        for (unsigned long i = 0; i < adapter->PhysicalAddressLength; ++i) {
            if (i) mac += L'-';
            _snwprintf_s(byteText, _countof(byteText), _TRUNCATE, L"%02X", adapter->PhysicalAddress[i]);
            mac += byteText;
        }
        return LB_ReturnText(std::move(mac));
    }
    return LB_ReturnText(L"");
}

int 网络_取网卡名称列表(std::vector<std::wstring>& out) {
    out.clear();
    const std::vector<unsigned char> buffer = LB_NetworkAdapterBuffer();
    if (buffer.empty()) return -1;
    auto* addresses = reinterpret_cast<const IP_ADAPTER_ADDRESSES*>(buffer.data());
    for (auto* adapter = addresses; adapter; adapter = adapter->Next) {
        if (adapter->FriendlyName) out.push_back(adapter->FriendlyName);
    }
    return static_cast<int>(out.size());
}

int 网络_取IP地址列表(std::vector<std::wstring>& out) {
    out.clear();
    if (!LB_EnsureSockets()) return -1;
    const std::vector<unsigned char> buffer = LB_NetworkAdapterBuffer();
    if (buffer.empty()) return -1;
    auto* addresses = reinterpret_cast<const IP_ADAPTER_ADDRESSES*>(buffer.data());
    for (auto* adapter = addresses; adapter; adapter = adapter->Next) {
        for (auto* unicast = adapter->FirstUnicastAddress; unicast; unicast = unicast->Next) {
            wchar_t text[INET6_ADDRSTRLEN] = {};
            const int family = unicast->Address.lpSockaddr->sa_family;
            void* raw = family == AF_INET ? static_cast<void*>(&reinterpret_cast<sockaddr_in*>(unicast->Address.lpSockaddr)->sin_addr)
                : family == AF_INET6 ? static_cast<void*>(&reinterpret_cast<sockaddr_in6*>(unicast->Address.lpSockaddr)->sin6_addr) : nullptr;
            if (raw && InetNtopW(family, raw, text, _countof(text))) out.push_back(text);
        }
    }
    return static_cast<int>(out.size());
}

const wchar_t* 网络_取DNS后缀() {
    const std::vector<unsigned char> buffer = LB_NetworkAdapterBuffer();
    if (buffer.empty()) return LB_ReturnText(L"");
    auto* addresses = reinterpret_cast<const IP_ADAPTER_ADDRESSES*>(buffer.data());
    for (auto* adapter = addresses; adapter; adapter = adapter->Next) {
        if (adapter->DnsSuffix && adapter->DnsSuffix[0]) return LB_ReturnText(adapter->DnsSuffix);
    }
    return LB_ReturnText(L"");
}
`;

const URL_RUNTIME = String.raw`
struct LB_UrlParts { bool valid = false; INTERNET_SCHEME scheme = static_cast<INTERNET_SCHEME>(0); INTERNET_PORT port = 0; std::wstring schemeText, host, path; };
static LB_UrlParts LB_ParseUrl(const wchar_t* url) { LB_UrlParts result; const std::wstring address = LB_Wide(url); URL_COMPONENTSW parts = {}; parts.dwStructSize = sizeof(parts); parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwHostNameLength = static_cast<DWORD>(-1); parts.dwUrlPathLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1); if (!WinHttpCrackUrl(address.c_str(), 0, 0, &parts)) return result; result.valid = true; result.scheme = parts.nScheme; result.port = parts.nPort; if (parts.dwSchemeLength) result.schemeText.assign(parts.lpszScheme, parts.dwSchemeLength); if (parts.dwHostNameLength) result.host.assign(parts.lpszHostName, parts.dwHostNameLength); if (parts.dwUrlPathLength) result.path.assign(parts.lpszUrlPath, parts.dwUrlPathLength); if (parts.dwExtraInfoLength) result.path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength); return result; }
bool URL_是否有效(const wchar_t* url) { return LB_ParseUrl(url).valid; } const wchar_t* URL_取协议(const wchar_t* url) { return LB_ReturnText(LB_ParseUrl(url).schemeText); } const wchar_t* URL_取主机(const wchar_t* url) { return LB_ReturnText(LB_ParseUrl(url).host); } int URL_取端口(const wchar_t* url) { return static_cast<int>(LB_ParseUrl(url).port); } const wchar_t* URL_取路径(const wchar_t* url) { return LB_ReturnText(LB_ParseUrl(url).path); } bool URL_是否HTTPS(const wchar_t* url) { return LB_ParseUrl(url).scheme == INTERNET_SCHEME_HTTPS; }
`;

const COOKIE_RUNTIME = String.raw`
static std::wstring LB_TrimCopy(std::wstring value) { size_t first = 0; while (first < value.size() && iswspace(value[first])) ++first; size_t last = value.size(); while (last > first && iswspace(value[last - 1])) --last; return value.substr(first, last - first); }
static std::vector<std::pair<std::wstring, std::wstring>> LB_ParseCookies(const wchar_t* cookies) { std::vector<std::pair<std::wstring, std::wstring>> result; std::wstringstream stream(LB_Wide(cookies)); std::wstring item; while (std::getline(stream, item, L';')) { const size_t equal = item.find(L'='); if (equal == std::wstring::npos) continue; result.emplace_back(LB_TrimCopy(item.substr(0, equal)), LB_TrimCopy(item.substr(equal + 1))); } return result; }
static std::wstring LB_SerializeCookies(const std::vector<std::pair<std::wstring, std::wstring>>& items) { std::wstring result; for (const auto& item : items) { if (!result.empty()) result += L"; "; result += item.first + L"=" + item.second; } return result; }
const wchar_t* Cookie_取值(const wchar_t* cookies, const wchar_t* name) { const std::wstring expected = LB_Wide(name); for (const auto& item : LB_ParseCookies(cookies)) if (item.first == expected) return LB_ReturnText(item.second); return LB_ReturnText(L""); }
bool Cookie_是否存在(const wchar_t* cookies, const wchar_t* name) { const std::wstring expected = LB_Wide(name); for (const auto& item : LB_ParseCookies(cookies)) if (item.first == expected) return true; return false; }
const wchar_t* Cookie_设置(const wchar_t* cookies, const wchar_t* name, const wchar_t* value) { auto items = LB_ParseCookies(cookies); const std::wstring expected = LB_Wide(name); bool found = false; for (auto& item : items) if (item.first == expected) { item.second = LB_Wide(value); found = true; } if (!found) items.emplace_back(expected, LB_Wide(value)); return LB_ReturnText(LB_SerializeCookies(items)); }
const wchar_t* Cookie_删除(const wchar_t* cookies, const wchar_t* name) { auto items = LB_ParseCookies(cookies); const std::wstring expected = LB_Wide(name); items.erase(std::remove_if(items.begin(), items.end(), [&](const auto& item) { return item.first == expected; }), items.end()); return LB_ReturnText(LB_SerializeCookies(items)); }
const wchar_t* Cookie_生成响应项(const wchar_t* name, const wchar_t* value, const wchar_t* path, int maxAge) { std::wstring result = LB_Wide(name) + L"=" + LB_Wide(value); if (path && path[0]) result += L"; Path=" + LB_Wide(path); if (maxAge >= 0) result += L"; Max-Age=" + std::to_wstring(maxAge); result += L"; HttpOnly; SameSite=Lax"; return LB_ReturnText(std::move(result)); }

// —— Cookie 记录集导出 ——
// 这里只放一个认扁平对象的严格 JSON 读取器：Cookie 模块本身零依赖、零额外链接库，
// 不为此引入 data.json 运行时。值只接受字符串/数字/逻辑/null，嵌套对象与数组一律判为格式错误。
struct LB_CookieField { std::wstring kind; std::wstring text; };
struct LB_CookieRow { std::vector<std::pair<std::wstring, LB_CookieField>> members; };
static std::wstring g_lbCookieError;
const wchar_t* Cookie_取错误() { return LB_ReturnText(g_lbCookieError); }
static bool LB_CookieFail(const wchar_t* message) { g_lbCookieError = message; return false; }

static void LB_CookieSkipWs(const std::wstring& text, size_t& at) { while (at < text.size() && (text[at] == L' ' || text[at] == L'\t' || text[at] == L'\n' || text[at] == L'\r')) ++at; }
static bool LB_CookieHexValue(wchar_t value, int& output) { if (value >= L'0' && value <= L'9') output = value - L'0'; else if (value >= L'a' && value <= L'f') output = value - L'a' + 10; else if (value >= L'A' && value <= L'F') output = value - L'A' + 10; else return false; return true; }
static bool LB_CookieReadStringBody(const std::wstring& text, size_t& at, std::wstring& output) {
    if (at >= text.size() || text[at] != L'"') { LB_CookieFail(L"Cookie 数组 JSON 语法错误：期望双引号字符串。"); return false; }
    ++at;
    while (at < text.size()) {
        const wchar_t ch = text[at++];
        if (ch == L'"') return true;
        if (ch != L'\\') { output.push_back(ch); continue; }
        if (at >= text.size()) break;
        const wchar_t escape = text[at++];
        if (escape == L'u') {
            unsigned int codeUnit = 0;
            for (int index = 0; index < 4; ++index) { int digit = 0; if (at >= text.size() || !LB_CookieHexValue(text[at++], digit)) { LB_CookieFail(L"Cookie 数组 JSON 语法错误：\\u 转义不完整。"); return false; } codeUnit = (codeUnit << 4) | static_cast<unsigned int>(digit); }
            if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF && at + 1 < text.size() && text[at] == L'\\' && text[at + 1] == L'u') {
                size_t probe = at + 2; unsigned int low = 0; bool paired = true;
                for (int index = 0; index < 4; ++index) { int digit = 0; if (probe >= text.size() || !LB_CookieHexValue(text[probe++], digit)) { paired = false; break; } low = (low << 4) | static_cast<unsigned int>(digit); }
                if (paired && low >= 0xDC00 && low <= 0xDFFF) { at = probe; output.push_back(static_cast<wchar_t>(codeUnit)); output.push_back(static_cast<wchar_t>(low)); continue; }
            }
            output.push_back(static_cast<wchar_t>(codeUnit)); continue;
        }
        switch (escape) { case L'n': output.push_back(L'\n'); break; case L't': output.push_back(L'\t'); break; case L'r': output.push_back(L'\r'); break; case L'b': output.push_back(L'\b'); break; case L'f': output.push_back(L'\f'); break; default: output.push_back(escape); }
    }
    LB_CookieFail(L"Cookie 数组 JSON 语法错误：字符串没有结束双引号。"); return false;
}
static bool LB_CookieReadValue(const std::wstring& text, size_t& at, LB_CookieField& field) {
    LB_CookieSkipWs(text, at);
    if (at >= text.size()) { LB_CookieFail(L"Cookie 数组 JSON 语法错误：字段值缺失。"); return false; }
    const wchar_t head = text[at];
    if (head == L'"') { std::wstring value; if (!LB_CookieReadStringBody(text, at, value)) return false; field = { L"string", std::move(value) }; return true; }
    if (head == L'{' || head == L'[') { LB_CookieFail(L"Cookie 记录只支持扁平字段，值不能是对象或数组。"); return false; }
    const size_t start = at;
    while (at < text.size() && text[at] != L',' && text[at] != L'}' && text[at] != L']' && !iswspace(text[at])) ++at;
    const std::wstring literal = text.substr(start, at - start);
    if (literal == L"true" || literal == L"false" || literal == L"null") { field = { literal, L"" }; return true; }
    bool numeric = !literal.empty();
    for (size_t index = 0; index < literal.size() && numeric; ++index) { const wchar_t ch = literal[index]; numeric = (ch >= L'0' && ch <= L'9') || ch == L'-' || ch == L'+' || ch == L'.' || ch == L'e' || ch == L'E'; }
    if (!numeric) { LB_CookieFail(L"Cookie 数组 JSON 语法错误：字段值既不是字符串、数字、逻辑值也不是 null。"); return false; }
    field = { L"number", literal }; return true;
}
static bool LB_CookieReadRow(const std::wstring& text, size_t& at, LB_CookieRow& row) {
    LB_CookieSkipWs(text, at);
    if (at >= text.size() || text[at] != L'{') { LB_CookieFail(L"Cookie 数组 JSON 语法错误：每个记录必须是对象。"); return false; }
    ++at; LB_CookieSkipWs(text, at);
    if (at < text.size() && text[at] == L'}') { ++at; return true; }
    while (true) {
        LB_CookieSkipWs(text, at);
        std::wstring key; if (!LB_CookieReadStringBody(text, at, key)) return false;
        LB_CookieSkipWs(text, at);
        if (at >= text.size() || text[at] != L':') { LB_CookieFail(L"Cookie 数组 JSON 语法错误：键后缺少冒号。"); return false; }
        ++at;
        LB_CookieField field; if (!LB_CookieReadValue(text, at, field)) return false;
        row.members.emplace_back(std::move(key), std::move(field));
        LB_CookieSkipWs(text, at);
        if (at < text.size() && text[at] == L',') { ++at; continue; }
        if (at < text.size() && text[at] == L'}') { ++at; return true; }
        LB_CookieFail(L"Cookie 数组 JSON 语法错误：对象成员后必须是逗号或右花括号。"); return false;
    }
}
static bool LB_CookieReadRows(const std::wstring& text, std::vector<LB_CookieRow>& rows) {
    size_t at = 0; LB_CookieSkipWs(text, at);
    if (at >= text.size()) { LB_CookieFail(L"Cookie 数组 JSON 为空文本。"); return false; }
    if (text[at] == L'{') return LB_CookieReadRow(text, at, rows.emplace_back());
    if (text[at] != L'[') { LB_CookieFail(L"Cookie 数组 JSON 必须以左方括号开头，或直接给单个对象。"); return false; }
    ++at; LB_CookieSkipWs(text, at);
    if (at < text.size() && text[at] == L']') return true;
    while (true) {
        LB_CookieRow row; if (!LB_CookieReadRow(text, at, row)) return false;
        rows.push_back(std::move(row));
        LB_CookieSkipWs(text, at);
        if (at < text.size() && text[at] == L',') { ++at; continue; }
        if (at < text.size() && text[at] == L']') return true;
        LB_CookieFail(L"Cookie 数组 JSON 语法错误：数组元素后必须是逗号或右方括号。"); return false;
    }
}
static const LB_CookieField* LB_CookieFind(const LB_CookieRow& row, std::initializer_list<const wchar_t*> names) {
    for (const wchar_t* name : names) for (const auto& member : row.members) if (member.first == name) return &member.second;
    return nullptr;
}
static std::wstring LB_CookieText(const LB_CookieRow& row, std::initializer_list<const wchar_t*> names, const std::wstring& fallback) {
    const auto* field = LB_CookieFind(row, names);
    if (!field || field->kind == L"null") return fallback;
    return field->kind == L"string" ? field->text : (field->kind == L"number" ? field->text : fallback);
}
static bool LB_CookieFlag(const LB_CookieRow& row, std::initializer_list<const wchar_t*> names, bool fallback) {
    const auto* field = LB_CookieFind(row, names);
    if (!field || field->kind == L"null") return fallback;
    if (field->kind == L"true") return true;
    if (field->kind == L"false") return false;
    if (field->kind == L"number") return field->text.find_first_of(L"123456789") != std::wstring::npos;
    return field->text == L"1" || field->text == L"true" || field->text == L"TRUE";
}
static bool LB_CookieFlagPresent(const LB_CookieRow& row, std::initializer_list<const wchar_t*> names) { const auto* field = LB_CookieFind(row, names); return field && field->kind != L"null"; }
static std::wstring LB_CookieJsonString(const std::wstring& value) {
    std::wstring result = L"\"";
    for (size_t index = 0; index < value.size(); ++index) {
        const wchar_t ch = value[index];
        switch (ch) { case L'"': result += L"\\\""; break; case L'\\': result += L"\\\\"; break; case L'\n': result += L"\\n"; break; case L'\r': result += L"\\r"; break; case L'\t': result += L"\\t"; break; default:
            if (ch < 0x20) { result += L"\\u"; static const wchar_t digits[] = L"0123456789abcdef"; const unsigned int code = static_cast<unsigned int>(ch); result += digits[(code >> 12) & 15]; result += digits[(code >> 8) & 15]; result += digits[(code >> 4) & 15]; result += digits[code & 15]; } else result.push_back(ch);
        }
    }
    return result + L"\"";
}
// 只解析「可选负号 + 十进制整数」，遇到小数点或指数即停止；没有数字或溢出返回回退值。
static long long LB_CookieInteger(const std::wstring& text, long long fallback) {
    size_t index = 0; bool negative = false;
    if (index < text.size() && (text[index] == L'-' || text[index] == L'+')) { negative = text[index] == L'-'; ++index; }
    long long value = 0; bool digits = false;
    for (; index < text.size(); ++index) {
        const wchar_t ch = text[index];
        if (ch < L'0' || ch > L'9') break;
        digits = true;
        if (value > (std::numeric_limits<long long>::max)() / 10 - 1) return fallback;
        value = value * 10 + (ch - L'0');
    }
    if (!digits) return fallback;
    return negative ? -value : value;
}
// Chromium 的 expires_utc 是自 1601-01-01 起的微秒；用整数换算避免双精度丢掉小数秒。
static bool LB_CookieExpiry(const LB_CookieRow& row, bool& session, std::wstring& secondsText) {
    session = false; secondsText = L"0";
    if (LB_CookieFlag(row, { L"session" }, false)) { session = true; return true; }
    const auto* legacy = LB_CookieFind(row, { L"expirationDate" });
    if (legacy && legacy->kind == L"number" && legacy->text.find_first_of(L"123456789") != std::wstring::npos) { secondsText = legacy->text; return true; }
    const auto* chromium = LB_CookieFind(row, { L"expires_utc" });
    if (chromium && chromium->kind == L"number") {
        static const long long epochDelta = 11644473600000000LL;
        const long long micros = LB_CookieInteger(chromium->text, 0);
        if (micros > epochDelta) {
            const long long total = micros - epochDelta;
            const long long whole = total / 1000000LL, fraction = total % 1000000LL;
            secondsText = std::to_wstring(whole);
            if (fraction) { std::wstring digits = std::to_wstring(fraction); digits.insert(0, 6 - digits.size(), L'0'); while (!digits.empty() && digits.back() == L'0') digits.pop_back(); secondsText += L"." + digits; }
            return true;
        }
    }
    session = true; return true;
}
static std::wstring LB_CookieSameSite(const LB_CookieRow& row) {
    const auto* field = LB_CookieFind(row, { L"sameSite", L"samesite" });
    if (!field || field->kind == L"null") return L"null";
    if (field->kind == L"string") return field->text.empty() ? L"null" : LB_CookieJsonString(field->text);
    if (field->kind != L"number") return L"null";
    switch (LB_CookieInteger(field->text, -1)) { case 0: return L"\"no_restriction\""; case 1: return L"\"lax\""; case 2: return L"\"strict\""; default: return L"null"; }
}
static bool LB_CookieRowFields(const LB_CookieRow& row, std::wstring& domain, std::wstring& name, std::wstring& value, std::wstring& path) {
    domain = LB_CookieText(row, { L"domain", L"host_key", L"host" }, L"");
    name = LB_CookieText(row, { L"name", L"key" }, L"");
    if (domain.empty()) return LB_CookieFail(L"Cookie 记录缺少域名字段（domain / host_key / host）。");
    if (name.empty()) return LB_CookieFail(L"Cookie 记录缺少名称字段（name）。");
    value = LB_CookieText(row, { L"value" }, L"");
    path = LB_CookieText(row, { L"path" }, L"/");
    return true;
}
const wchar_t* Cookie_导出Netscape(const wchar_t* jsonArray) {
    g_lbCookieError.clear();
    std::vector<LB_CookieRow> rows; if (!LB_CookieReadRows(LB_Wide(jsonArray), rows)) return LB_ReturnText(L"");
    std::wstring result = L"# Netscape HTTP Cookie File\n# https://curl.se/docs/http-cookies.html\n# This file was generated by LingBuilder! Edit at your own risk.\n\n";
    for (const auto& row : rows) {
        std::wstring domain, name, value, path; if (!LB_CookieRowFields(row, domain, name, value, path)) return LB_ReturnText(L"");
        bool session = false; std::wstring seconds; if (!LB_CookieExpiry(row, session, seconds)) return LB_ReturnText(L"");
        const size_t dot = seconds.find(L'.'); std::wstring whole = dot == std::wstring::npos ? seconds : seconds.substr(0, dot);
        if (whole.empty() || whole == L"-") whole = L"0";
        const bool secure = LB_CookieFlag(row, { L"secure", L"is_secure" }, false);
        const bool httpOnly = LB_CookieFlag(row, { L"httpOnly", L"is_httponly" }, false);
        // includeSubDomains 列由域名前导点决定；会话 Cookie 的过期列固定写 0，与 curl / MozillaCookieJar 一致。
        result += (httpOnly ? L"#HttpOnly_" : L"") + domain + L"\t" + (domain.front() == L'.' ? L"TRUE" : L"FALSE") + L"\t" + path + L"\t" + (secure ? L"TRUE" : L"FALSE") + L"\t" + (session ? L"0" : whole) + L"\t" + name + L"\t" + value + L"\n";
    }
    return LB_ReturnText(std::move(result));
}
const wchar_t* Cookie_导出EditThisCookieJSON(const wchar_t* jsonArray) {
    g_lbCookieError.clear();
    std::vector<LB_CookieRow> rows; if (!LB_CookieReadRows(LB_Wide(jsonArray), rows)) return LB_ReturnText(L"");
    std::wstring result = L"[\n";
    for (size_t index = 0; index < rows.size(); ++index) {
        const auto& row = rows[index];
        std::wstring domain, name, value, path; if (!LB_CookieRowFields(row, domain, name, value, path)) return LB_ReturnText(L"");
        bool session = false; std::wstring seconds; if (!LB_CookieExpiry(row, session, seconds)) return LB_ReturnText(L"");
        const bool secure = LB_CookieFlag(row, { L"secure", L"is_secure" }, false);
        const bool httpOnly = LB_CookieFlag(row, { L"httpOnly", L"is_httponly" }, false);
        const bool hostOnly = LB_CookieFlagPresent(row, { L"hostOnly" }) ? LB_CookieFlag(row, { L"hostOnly" }, false) : domain.front() != L'.';
        // 键序固定为 EditThisCookie 的字母序；会话 Cookie 省略 expirationDate，storeId 是 Firefox 专有字段恒为 null。
        std::wstring item = L"  {\n";
        item += L"    \"domain\": " + LB_CookieJsonString(domain) + L",\n";
        if (!session) item += L"    \"expirationDate\": " + seconds + L",\n";
        item += L"    \"hostOnly\": " + std::wstring(hostOnly ? L"true" : L"false") + L",\n";
        item += L"    \"httpOnly\": " + std::wstring(httpOnly ? L"true" : L"false") + L",\n";
        item += L"    \"name\": " + LB_CookieJsonString(name) + L",\n";
        item += L"    \"path\": " + LB_CookieJsonString(path) + L",\n";
        item += L"    \"sameSite\": " + LB_CookieSameSite(row) + L",\n";
        item += L"    \"secure\": " + std::wstring(secure ? L"true" : L"false") + L",\n";
        item += L"    \"session\": " + std::wstring(session ? L"true" : L"false") + L",\n";
        item += L"    \"storeId\": null,\n";
        item += L"    \"value\": " + LB_CookieJsonString(value) + L"\n  }";
        result += item + (index + 1 < rows.size() ? L",\n" : L"\n");
    }
    return LB_ReturnText(result + L"]");
}
`;

const FTP_RUNTIME = String.raw`
static HINTERNET g_lbFtpSession = nullptr, g_lbFtpConnection = nullptr; static std::wstring g_lbFtpError;
void FTP_关闭() { if (g_lbFtpConnection) InternetCloseHandle(g_lbFtpConnection); if (g_lbFtpSession) InternetCloseHandle(g_lbFtpSession); g_lbFtpConnection = nullptr; g_lbFtpSession = nullptr; }
const wchar_t* FTP_取错误() { return LB_ReturnText(g_lbFtpError); }
static bool LB_FtpResult(bool success, const wchar_t* message) { if (!success) { g_lbFtpError = message; g_lbFtpError += L"（错误码 "; g_lbFtpError += std::to_wstring(GetLastError()); g_lbFtpError += L"）"; } else g_lbFtpError.clear(); return success; }
bool FTP_连接(const wchar_t* host, int port, const wchar_t* username, const wchar_t* password, bool secure) { FTP_关闭(); g_lbFtpSession = InternetOpenW(L"LingBuilder FTP/1.0", INTERNET_OPEN_TYPE_PRECONFIG, nullptr, nullptr, 0); if (!g_lbFtpSession) return LB_FtpResult(false, L"FTP 会话创建失败。"); g_lbFtpConnection = InternetConnectW(g_lbFtpSession, host, static_cast<INTERNET_PORT>(port > 0 ? port : INTERNET_DEFAULT_FTP_PORT), username && username[0] ? username : nullptr, password && password[0] ? password : nullptr, INTERNET_SERVICE_FTP, secure ? INTERNET_FLAG_SECURE : 0, 0); return LB_FtpResult(g_lbFtpConnection != nullptr, L"FTP 连接失败。"); }
bool FTP_上传文件(const wchar_t* localFile, const wchar_t* remoteFile) { return g_lbFtpConnection && LB_FtpResult(FtpPutFileW(g_lbFtpConnection, localFile, remoteFile, FTP_TRANSFER_TYPE_BINARY, 0) == TRUE, L"FTP 上传失败。"); }
bool FTP_下载文件(const wchar_t* remoteFile, const wchar_t* localFile, bool overwrite) { return g_lbFtpConnection && LB_FtpResult(FtpGetFileW(g_lbFtpConnection, remoteFile, localFile, overwrite ? FALSE : TRUE, FILE_ATTRIBUTE_NORMAL, FTP_TRANSFER_TYPE_BINARY, 0) == TRUE, L"FTP 下载失败。"); }
bool FTP_删除文件(const wchar_t* remoteFile) { return g_lbFtpConnection && LB_FtpResult(FtpDeleteFileW(g_lbFtpConnection, remoteFile) == TRUE, L"FTP 删除失败。"); }
bool FTP_重命名(const wchar_t* oldName, const wchar_t* newName) { return g_lbFtpConnection && LB_FtpResult(FtpRenameFileW(g_lbFtpConnection, oldName, newName) == TRUE, L"FTP 重命名失败。"); }
`;

// ===== 消息推送模块（lingbuilder.notify）：企业微信/钉钉/飞书群机器人 webhook 出站推送 =====
// winhttp.lib / bcrypt.lib 已在主 pragma 区无条件链接，无需本块自带 pragma。
// 设计红线：内容参数收原文文本，JSON 信封与转义在本运行时内完成；钉钉（毫秒时间戳拼地址）与
// 飞书（秒时间戳写进请求体）的 HMAC-SHA256 加签都在这里算（BCrypt），不暴露通用哈希命令。
const NOTIFY_RUNTIME = String.raw`
static std::wstring g_lbNotifyError;
static std::wstring g_lbNotifyResponse;
static const int LB_NOTIFY_DEFAULT_TIMEOUT_MS = 10000;

static void LB_NotifyFail(std::wstring message) { g_lbNotifyError = std::move(message); }
static void LB_NotifyClearState() { g_lbNotifyError.clear(); g_lbNotifyResponse.clear(); }

static std::wstring LB_NotifyTrim(const std::wstring& value) {
    size_t first = 0, last = value.size();
    while (first < last && iswspace(value[first])) ++first;
    while (last > first && iswspace(value[last - 1])) --last;
    return value.substr(first, last - first);
}

static std::vector<std::wstring> LB_NotifySplitList(const std::wstring& text) {
    std::vector<std::wstring> items; std::wstring current;
    auto flush = [&]() {
        const std::wstring trimmed = LB_NotifyTrim(current);
        if (!trimmed.empty()) items.push_back(trimmed);
        current.clear();
    };
    for (wchar_t ch : text) {
        if (ch == L'\n' || ch == L',' || ch == L'\uFF0C' || ch == L';' || ch == L'\uFF1B') flush();
        else current.push_back(ch);
    }
    flush();
    return items;
}

static std::vector<std::wstring> LB_NotifySplitLines(const std::wstring& text) {
    std::vector<std::wstring> lines; std::wstring current;
    for (wchar_t ch : text) {
        if (ch == L'\n') { if (!current.empty() && current.back() == L'\r') current.pop_back(); lines.push_back(current); current.clear(); }
        else current.push_back(ch);
    }
    if (!current.empty() && current.back() == L'\r') current.pop_back();
    if (!current.empty()) lines.push_back(current);
    return lines;
}

// 按竖线拆字段（全角｜同样支持），最后一个字段吞掉剩余全部竖线，字段各自去首尾空白。
static std::vector<std::wstring> LB_NotifySplitFields(const std::wstring& line, size_t maxFields) {
    std::vector<std::wstring> fields; std::wstring current;
    for (wchar_t ch : line) {
        if ((ch == L'|' || ch == L'\uff5c') && fields.size() + 1 < maxFields) { fields.push_back(LB_NotifyTrim(current)); current.clear(); }
        else current.push_back(ch);
    }
    fields.push_back(LB_NotifyTrim(current));
    return fields;
}

static std::wstring LB_NotifyJsonEscape(const std::wstring& value) {
    std::wstring result; result.reserve(value.size() + 8);
    for (wchar_t ch : value) {
        switch (ch) {
            case L'"': result += L"\\\""; break;
            case L'\\': result += L"\\\\"; break;
            case L'\n': result += L"\\n"; break;
            case L'\r': result += L"\\r"; break;
            case L'\t': result += L"\\t"; break;
            case L'\b': result += L"\\b"; break;
            case L'\f': result += L"\\f"; break;
            default:
                if (ch < 0x20) { wchar_t buffer[8]; _snwprintf_s(buffer, _countof(buffer), _TRUNCATE, L"\\u%04x", static_cast<unsigned int>(ch)); result += buffer; }
                else result.push_back(ch);
        }
    }
    return result;
}

static std::wstring LB_NotifyJsonQuote(const std::wstring& value) { return L"\"" + LB_NotifyJsonEscape(value) + L"\""; }

static std::string LB_NotifyBase64(const unsigned char* data, size_t size) {
    static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result; result.reserve((size + 2) / 3 * 4);
    for (size_t i = 0; i < size; i += 3) {
        const unsigned int b0 = data[i];
        const unsigned int b1 = i + 1 < size ? data[i + 1] : 0;
        const unsigned int b2 = i + 2 < size ? data[i + 2] : 0;
        const unsigned int triple = (b0 << 16) | (b1 << 8) | b2;
        result += table[(triple >> 18) & 63];
        result += table[(triple >> 12) & 63];
        result += i + 1 < size ? table[(triple >> 6) & 63] : '=';
        result += i + 2 < size ? table[triple & 63] : '=';
    }
    return result;
}

static std::string LB_NotifyHmacSha256(const std::string& key, const std::string& message) {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, BCRYPT_ALG_HANDLE_HMAC_FLAG) != 0) return {};
    BCRYPT_HASH_HANDLE hash = nullptr;
    NTSTATUS status = BCryptCreateHash(algorithm, &hash, nullptr, 0, reinterpret_cast<PUCHAR>(const_cast<char*>(key.data())), static_cast<ULONG>(key.size()), 0);
    std::string digest(32, '\0');
    if (status == 0) status = BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char*>(message.data())), static_cast<ULONG>(message.size()), 0);
    if (status == 0) status = BCryptFinishHash(hash, reinterpret_cast<PUCHAR>(&digest[0]), static_cast<ULONG>(digest.size()), 0);
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    return status == 0 ? digest : std::string();
}

static std::string LB_NotifyMd5Hex(const unsigned char* data, size_t size) {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_MD5_ALGORITHM, nullptr, 0) != 0) return {};
    BCRYPT_HASH_HANDLE hash = nullptr;
    NTSTATUS status = BCryptCreateHash(algorithm, &hash, nullptr, 0, nullptr, 0, 0);
    std::string digest(16, '\0');
    if (status == 0) status = BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<unsigned char*>(data)), static_cast<ULONG>(size), 0);
    if (status == 0) status = BCryptFinishHash(hash, reinterpret_cast<PUCHAR>(&digest[0]), static_cast<ULONG>(digest.size()), 0);
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (status != 0) return {};
    static const char digits[] = "0123456789abcdef";
    std::string hex; hex.reserve(32);
    for (unsigned char byte : digest) { hex += digits[byte >> 4]; hex += digits[byte & 15]; }
    return hex;
}

static long long LB_NotifyNowMilliseconds() {
    FILETIME fileTime{}; GetSystemTimeAsFileTime(&fileTime);
    ULARGE_INTEGER value{}; value.LowPart = fileTime.dwLowDateTime; value.HighPart = fileTime.dwHighDateTime;
    return static_cast<long long>((value.QuadPart - 116444736000000000LL) / 10000);
}

// 三平台同一签名算法：HMAC-SHA256（密钥=SEC，内容=时间戳+"\n"+SEC）→ Base64；
// 钉钉时间戳毫秒且结果要 URL 编码，飞书时间戳秒且结果原样进请求体。
static std::string LB_NotifySignBase64(const std::wstring& secret, long long timestamp) {
    const std::string key = LB_WideToUtf8(secret.c_str());
    const std::string mac = LB_NotifyHmacSha256(key, std::to_string(timestamp) + "\n" + key);
    return mac.empty() ? std::string() : LB_NotifyBase64(reinterpret_cast<const unsigned char*>(mac.data()), mac.size());
}

static std::wstring LB_NotifyUrlEncode(const std::string& value) {
    static const char digits[] = "0123456789ABCDEF";
    std::wstring result;
    for (unsigned char byte : value) {
        if ((byte >= 'A' && byte <= 'Z') || (byte >= 'a' && byte <= 'z') || (byte >= '0' && byte <= '9') || byte == '-' || byte == '_' || byte == '.' || byte == '~') result.push_back(static_cast<wchar_t>(byte));
        else { result += L'%'; result += digits[byte >> 4]; result += digits[byte & 15]; }
    }
    return result;
}

static bool LB_NotifyApplyDingTalkSign(std::wstring& url, const std::wstring& secret) {
    if (secret.empty()) return true;
    const long long timestamp = LB_NotifyNowMilliseconds();
    const std::string sign = LB_NotifySignBase64(secret, timestamp);
    if (sign.empty()) { LB_NotifyFail(L"钉钉加签失败：本机 BCrypt 计算 HMAC-SHA256 失败。"); return false; }
    url += url.find(L'?') == std::wstring::npos ? L'?' : L'&';
    url += L"timestamp=" + std::to_wstring(timestamp) + L"&sign=" + LB_NotifyUrlEncode(sign);
    return true;
}

// 飞书加签字段（秒时间戳 + Base64 签名原样写进请求体）；未开启签名校验返回空串。
static std::wstring LB_NotifyFeishuSignFields(const std::wstring& secret) {
    if (secret.empty()) return L"";
    const long long seconds = LB_NotifyNowMilliseconds() / 1000;
    const std::string sign = LB_NotifySignBase64(secret, seconds);
    if (sign.empty()) { LB_NotifyFail(L"飞书加签失败：本机 BCrypt 计算 HMAC-SHA256 失败。"); return L""; }
    return L"\"timestamp\":\"" + std::to_wstring(seconds) + L"\",\"sign\":\"" + std::wstring(sign.begin(), sign.end()) + L"\"";
}

static bool LB_NotifyReadFile(const std::wstring& path, std::vector<unsigned char>& out) {
    HANDLE handle = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(handle, &size) || size.QuadPart < 0 || size.QuadPart > 32 * 1024 * 1024) { CloseHandle(handle); return false; }
    out.resize(static_cast<size_t>(size.QuadPart));
    DWORD read = 0;
    const bool ok = size.QuadPart == 0 || (ReadFile(handle, out.data(), static_cast<DWORD>(out.size()), &read, nullptr) && read == out.size());
    CloseHandle(handle);
    if (!ok) out.clear();
    return ok;
}

static std::wstring LB_NotifyFileExtension(const std::wstring& path) {
    const size_t dot = path.find_last_of(L'.');
    if (dot == std::wstring::npos) return L"";
    std::wstring extension = path.substr(dot);
    for (wchar_t& ch : extension) ch = static_cast<wchar_t>(towlower(ch));
    return extension;
}

static std::wstring LB_NotifyFileName(const std::wstring& path) {
    size_t start = path.find_last_of(L"\\/");
    start = start == std::wstring::npos ? 0 : start + 1;
    std::wstring name;
    for (size_t i = start; i < path.size(); ++i) {
        const wchar_t ch = path[i];
        if (ch == L'"' || ch == L'\r' || ch == L'\n' || static_cast<unsigned int>(ch) < 0x20) continue;
        name.push_back(ch);
    }
    return name;
}

static std::string LB_NotifyUtf8Ascii(const std::wstring& value) {
    std::string result; result.reserve(value.size());
    for (wchar_t ch : value) result.push_back(ch >= 0 && ch <= 0x7f ? static_cast<char>(ch) : '_');
    return result;
}

struct LB_NotifyHttpResult { bool ok = false; std::string body; };

static LB_NotifyHttpResult LB_NotifyHttpPost(const std::wstring& url, const std::string& body, const wchar_t* contentType, int timeoutMs) {
    LB_NotifyHttpResult result;
    URL_COMPONENTSW parts = {};
    wchar_t host[512] = {}; wchar_t path[4096] = {};
    parts.dwStructSize = sizeof(parts);
    parts.lpszHostName = host; parts.dwHostNameLength = static_cast<DWORD>(_countof(host));
    parts.lpszUrlPath = path; parts.dwUrlPathLength = static_cast<DWORD>(_countof(path));
    parts.dwSchemeLength = static_cast<DWORD>(-1); parts.dwExtraInfoLength = static_cast<DWORD>(-1);
    if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) { LB_NotifyFail(L"地址解析失败：必须是完整的 http:// 或 https:// webhook 地址。"); return result; }
    if (parts.nScheme != INTERNET_SCHEME_HTTPS && parts.nScheme != INTERNET_SCHEME_HTTP) { LB_NotifyFail(L"仅支持 http:// 和 https:// 地址。"); return result; }
    std::wstring pathAndQuery(parts.lpszUrlPath, parts.dwUrlPathLength);
    if (parts.lpszExtraInfo && parts.dwExtraInfoLength > 0) pathAndQuery.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
    struct Handle { HINTERNET value = nullptr; ~Handle() { if (value) WinHttpCloseHandle(value); } operator HINTERNET() const { return value; } };
    Handle session{ WinHttpOpen(L"LingBuilder-Notify/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0) };
    if (!session) { LB_NotifyFail(L"创建 WinHTTP 会话失败。"); return result; }
    const int milliseconds = (std::max)(1, timeoutMs) * 1000;
    WinHttpSetTimeouts(session, milliseconds, milliseconds, milliseconds, milliseconds);
    Handle connection{ WinHttpConnect(session, std::wstring(parts.lpszHostName, parts.dwHostNameLength).c_str(), parts.nPort, 0) };
    if (!connection) { LB_NotifyFail(L"连接服务器失败（网络不通、被防火墙拦截或超时）。"); return result; }
    Handle request{ WinHttpOpenRequest(connection, L"POST", pathAndQuery.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, parts.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0) };
    if (!request) { LB_NotifyFail(L"创建请求失败。"); return result; }
    const std::wstring headers = std::wstring(L"Content-Type: ") + contentType + L"\r\n";
    if (!WinHttpAddRequestHeaders(request, headers.c_str(), static_cast<DWORD>(headers.size()), WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE)) { LB_NotifyFail(L"写入请求头失败。"); return result; }
    if (!WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, body.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<char*>(body.data()), static_cast<DWORD>(body.size()), static_cast<DWORD>(body.size()), 0)
        || !WinHttpReceiveResponse(request, nullptr)) {
        LB_NotifyFail(L"发送 webhook 请求失败，错误码 " + std::to_wstring(GetLastError()) + L"（网络不通、被防火墙拦截或超时）。");
        return result;
    }
    DWORD statusCode = 0, statusSize = sizeof(statusCode);
    WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &statusCode, &statusSize, nullptr);
    for (;;) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available) || available == 0) break;
        const size_t old = result.body.size();
        result.body.resize(old + available);
        DWORD read = 0;
        if (!WinHttpReadData(request, result.body.data() + old, available, &read) || read == 0) { result.body.resize(old); break; }
        result.body.resize(old + read);
    }
    result.ok = statusCode == 200;
    if (!result.ok) LB_NotifyFail(L"webhook 返回 HTTP " + std::to_wstring(statusCode) + L"（预期 200），响应原文见 推送_取响应文本()。");
    g_lbNotifyResponse = LB_Utf8ToWide(result.body);
    return result;
}

// 在响应 JSON 里定位 "key":<值> 的值起点；找不到返回假。
static bool LB_NotifyFindJsonKey(const std::string& json, const char* key, size_t& valueAt) {
    const std::string needle = std::string("\"") + key + "\"";
    size_t at = json.find(needle);
    while (at != std::string::npos) {
        size_t cursor = at + needle.size();
        while (cursor < json.size() && (json[cursor] == ' ' || json[cursor] == '\t' || json[cursor] == '\r' || json[cursor] == '\n')) ++cursor;
        if (cursor < json.size() && json[cursor] == ':') {
            ++cursor;
            while (cursor < json.size() && (json[cursor] == ' ' || json[cursor] == '\t' || json[cursor] == '\r' || json[cursor] == '\n')) ++cursor;
            valueAt = cursor;
            return true;
        }
        at = json.find(needle, at + 1);
    }
    return false;
}

static bool LB_NotifyJsonNumberField(const std::string& json, const char* key, long long& output) {
    size_t at = 0;
    if (!LB_NotifyFindJsonKey(json, key, at) || at >= json.size()) return false;
    bool negative = false;
    if (json[at] == '-') { negative = true; ++at; }
    long long value = 0; bool digits = false;
    while (at < json.size() && json[at] >= '0' && json[at] <= '9') { digits = true; value = value * 10 + (json[at] - '0'); ++at; }
    if (!digits) return false;
    output = negative ? -value : value;
    return true;
}

static std::wstring LB_NotifyJsonStringField(const std::string& json, const char* key) {
    size_t at = 0;
    if (!LB_NotifyFindJsonKey(json, key, at) || at >= json.size() || json[at] != '"') return L"";
    ++at;
    std::string value;
    while (at < json.size() && json[at] != '"') {
        if (json[at] == '\\' && at + 1 < json.size()) { ++at; value.push_back(json[at]); ++at; continue; }
        value.push_back(json[at++]);
    }
    return LB_Utf8ToWide(value);
}

// 企微/钉钉送达判定：HTTP 200 且 errcode == 0（钉钉错误签名 310000、关键词不匹配等都在 errcode 里）。
static bool LB_NotifyWecomDingtalkSuccess(const LB_NotifyHttpResult& response, const wchar_t* label) {
    long long code = 0;
    if (!LB_NotifyJsonNumberField(response.body, "errcode", code)) { LB_NotifyFail(std::wstring(label) + L"响应缺少 errcode 字段，无法确认送达，响应原文见 推送_取响应文本()。"); return false; }
    if (code != 0) { LB_NotifyFail(std::wstring(label) + L"返回 errcode=" + std::to_wstring(code) + L"，原因见 推送_取响应文本()。"); return false; }
    return true;
}

// 飞书送达判定：HTTP 200 且（旧格式 StatusCode:0 或 新格式 code:0）。
static bool LB_NotifyFeishuSuccess(const LB_NotifyHttpResult& response) {
    long long code = 0;
    if (LB_NotifyJsonNumberField(response.body, "StatusCode", code) || LB_NotifyJsonNumberField(response.body, "code", code)) {
        if (code != 0) { LB_NotifyFail(L"飞书返回 code=" + std::to_wstring(code) + L"，原因见 推送_取响应文本()。"); return false; }
        return true;
    }
    LB_NotifyFail(L"飞书响应缺少 StatusCode/code 字段，无法确认送达，响应原文见 推送_取响应文本()。");
    return false;
}

static bool LB_NotifySendJson(const std::wstring& url, const std::wstring& json, int timeoutMs) {
    const LB_NotifyHttpResult response = LB_NotifyHttpPost(url, LB_WideToUtf8(json.c_str()), L"application/json", timeoutMs);
    return response.ok;
}

static bool LB_NotifySendWecomDingtalk(const std::wstring& url, const std::wstring& json, const wchar_t* label) {
    const LB_NotifyHttpResult response = LB_NotifyHttpPost(url, LB_WideToUtf8(json.c_str()), L"application/json", LB_NOTIFY_DEFAULT_TIMEOUT_MS);
    if (!response.ok) return false;
    return LB_NotifyWecomDingtalkSuccess(response, label);
}

static bool LB_NotifySendFeishu(const std::wstring& url, const std::wstring& signFields, const std::wstring& payload, const wchar_t* label) {
    std::wstring json = L"{";
    if (!signFields.empty()) json += signFields + L",";
    json += payload + L"}";
    const LB_NotifyHttpResult response = LB_NotifyHttpPost(url, LB_WideToUtf8(json.c_str()), L"application/json", LB_NOTIFY_DEFAULT_TIMEOUT_MS);
    if (!response.ok) return false;
    return LB_NotifyFeishuSuccess(response);
}

static bool LB_NotifyCheckUrl(const std::wstring& url) {
    if (url.empty()) { LB_NotifyFail(L"地址不能为空。"); return false; }
    return true;
}

bool 推送_发JSON(const wchar_t* 地址, const wchar_t* JSON文本, int 超时毫秒 = LB_NOTIFY_DEFAULT_TIMEOUT_MS) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring json = LB_Wide(JSON文本);
    if (!LB_NotifyCheckUrl(url) || json.empty()) { if (json.empty()) LB_NotifyFail(L"JSON文本不能为空。"); return false; }
    return LB_NotifySendJson(url, json, 超时毫秒);
}

const wchar_t* 推送_取错误() { return LB_ReturnText(g_lbNotifyError); }
const wchar_t* 推送_取响应文本() { return LB_ReturnText(g_lbNotifyResponse); }

bool 推送_发企业微信文本(const wchar_t* 地址, const wchar_t* 内容, const wchar_t* 手机号列表, bool 是否所有人) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring content = LB_Wide(内容);
    if (!LB_NotifyCheckUrl(url) || content.empty()) { if (content.empty()) LB_NotifyFail(L"内容不能为空。"); return false; }
    const std::string contentBytes = LB_WideToUtf8(content.c_str());
    if (contentBytes.size() > 2048) { LB_NotifyFail(L"内容超出 2048 字节（UTF-8），当前 " + std::to_wstring(contentBytes.size()) + L" 字节。"); return false; }
    std::wstring json = L"{\"msgtype\":\"text\",\"text\":{\"content\":" + LB_NotifyJsonQuote(content);
    if (是否所有人) json += L",\"mentioned_list\":[\"@all\"]";
    const std::vector<std::wstring> mobiles = LB_NotifySplitList(LB_Wide(手机号列表));
    if (!mobiles.empty()) {
        json += L",\"mentioned_mobile_list\":[";
        for (size_t i = 0; i < mobiles.size(); ++i) { if (i) json += L","; json += LB_NotifyJsonQuote(mobiles[i]); }
        json += L"]";
    }
    json += L"}}";
    return LB_NotifySendWecomDingtalk(url, json, L"企业微信");
}

bool 推送_发企业微信Markdown(const wchar_t* 地址, const wchar_t* 内容) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring content = LB_Wide(内容);
    if (!LB_NotifyCheckUrl(url) || content.empty()) { if (content.empty()) LB_NotifyFail(L"内容不能为空。"); return false; }
    const std::string contentBytes = LB_WideToUtf8(content.c_str());
    if (contentBytes.size() > 4096) { LB_NotifyFail(L"内容超出 4096 字节（UTF-8），当前 " + std::to_wstring(contentBytes.size()) + L" 字节。"); return false; }
    const std::wstring json = L"{\"msgtype\":\"markdown\",\"markdown\":{\"content\":" + LB_NotifyJsonQuote(content) + L"}}";
    return LB_NotifySendWecomDingtalk(url, json, L"企业微信");
}

bool 推送_发企业微信图片(const wchar_t* 地址, const wchar_t* 图片路径) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring filePath = LB_Wide(图片路径);
    if (!LB_NotifyCheckUrl(url) || filePath.empty()) { if (filePath.empty()) LB_NotifyFail(L"图片路径不能为空。"); return false; }
    const std::wstring extension = LB_NotifyFileExtension(filePath);
    if (extension != L".jpg" && extension != L".jpeg" && extension != L".png") { LB_NotifyFail(L"企业微信机器人图片仅支持 jpg/png 格式，当前扩展名：" + (extension.empty() ? L"（无）" : extension) + L"。"); return false; }
    std::vector<unsigned char> bytes;
    if (!LB_NotifyReadFile(filePath, bytes)) { LB_NotifyFail(L"读取图片文件失败：" + filePath); return false; }
    if (bytes.size() < 3) { LB_NotifyFail(L"图片文件为空或过小。"); return false; }
    const bool looksJpeg = bytes[0] == 0xFF && bytes[1] == 0xD8;
    const bool looksPng = bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E;
    if (!looksJpeg && !looksPng) { LB_NotifyFail(L"文件内容不是 jpg/png 图片（魔数校验失败）。"); return false; }
    if (bytes.size() > 2 * 1024 * 1024) { LB_NotifyFail(L"图片超过 2MB 上限，当前 " + std::to_wstring(bytes.size()) + L" 字节。"); return false; }
    const std::string md5 = LB_NotifyMd5Hex(bytes.data(), bytes.size());
    const std::string base64 = LB_NotifyBase64(bytes.data(), bytes.size());
    if (md5.empty() || base64.empty()) { LB_NotifyFail(L"计算图片 Base64/MD5 失败。"); return false; }
    const std::wstring json = L"{\"msgtype\":\"image\",\"image\":{\"base64\":\"" + std::wstring(base64.begin(), base64.end()) + L"\",\"md5\":\"" + std::wstring(md5.begin(), md5.end()) + L"\"}}";
    return LB_NotifySendWecomDingtalk(url, json, L"企业微信");
}

bool 推送_发企业微信图文(const wchar_t* 地址, const wchar_t* 图文条目文本) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring itemsText = LB_Wide(图文条目文本);
    if (!LB_NotifyCheckUrl(url) || itemsText.empty()) { if (itemsText.empty()) LB_NotifyFail(L"图文条目文本不能为空。"); return false; }
    std::vector<std::wstring> lines = LB_NotifySplitLines(itemsText);
    std::vector<std::wstring> items;
    for (const std::wstring& line : lines) { const std::wstring trimmed = LB_NotifyTrim(line); if (!trimmed.empty()) items.push_back(trimmed); }
    if (items.empty() || items.size() > 8) { LB_NotifyFail(L"图文需要 1~8 条条目（每行一条），当前 " + std::to_wstring(items.size()) + L" 条。"); return false; }
    std::wstring articles;
    for (size_t i = 0; i < items.size(); ++i) {
        const std::vector<std::wstring> fields = LB_NotifySplitFields(items[i], 4);
        const std::wstring& title = fields[0];
        if (title.empty()) { LB_NotifyFail(L"第 " + std::to_wstring(i + 1) + L" 条图文缺少标题（格式：标题|描述|跳转链接|图片URL）。"); return false; }
        if (fields.size() < 3 || fields[2].empty()) { LB_NotifyFail(L"第 " + std::to_wstring(i + 1) + L" 条图文缺少跳转链接：企业微信要求 url 必填（格式：标题|描述|跳转链接|图片URL）。"); return false; }
        std::wstring article = L"{\"title\":" + LB_NotifyJsonQuote(title);
        if (fields.size() > 1 && !fields[1].empty()) article += L",\"description\":" + LB_NotifyJsonQuote(fields[1]);
        article += L",\"url\":" + LB_NotifyJsonQuote(fields[2]);
        if (fields.size() > 3 && !fields[3].empty()) article += L",\"picurl\":" + LB_NotifyJsonQuote(fields[3]);
        article += L"}";
        if (i) articles += L",";
        articles += article;
    }
    const std::wstring json = L"{\"msgtype\":\"news\",\"news\":{\"articles\":[" + articles + L"]}}";
    return LB_NotifySendWecomDingtalk(url, json, L"企业微信");
}

static std::wstring LB_NotifyExtractUrlParam(const std::wstring& url, const wchar_t* name) {
    std::wstring needle = std::wstring(name) + L"=";
    size_t at = url.find(needle);
    while (at != std::wstring::npos) {
        if (at == 0 || url[at - 1] == L'?' || url[at - 1] == L'&') {
            at += needle.size();
            size_t end = at;
            while (end < url.size() && url[end] != L'&' && url[end] != L'#') ++end;
            return url.substr(at, end - at);
        }
        at = url.find(needle, at + 1);
    }
    return L"";
}

std::wstring 推送_上传企业微信文件(const wchar_t* 地址, const wchar_t* 文件路径) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring filePath = LB_Wide(文件路径);
    if (!LB_NotifyCheckUrl(url) || filePath.empty()) { if (filePath.empty()) LB_NotifyFail(L"文件路径不能为空。"); return LB_ReturnText(L""); }
    const std::wstring key = LB_NotifyExtractUrlParam(url, L"key");
    if (key.empty()) { LB_NotifyFail(L"地址中未找到 key 参数：请传企业微信群机器人 webhook 完整地址。"); return LB_ReturnText(L""); }
    std::vector<unsigned char> bytes;
    if (!LB_NotifyReadFile(filePath, bytes)) { LB_NotifyFail(L"读取文件失败：" + filePath); return LB_ReturnText(L""); }
    if (bytes.empty() || bytes.size() > 20 * 1024 * 1024) { LB_NotifyFail(L"文件大小必须在 1 字节到 20MB 之间，当前 " + std::to_wstring(bytes.size()) + L" 字节。"); return LB_ReturnText(L""); }
    std::wstring fileName = LB_NotifyFileName(filePath);
    if (fileName.empty()) fileName = L"file.bin";
    const std::wstring extension = LB_NotifyFileExtension(filePath);
    const wchar_t* mime = extension == L".png" ? L"image/png" : (extension == L".jpg" || extension == L".jpeg" ? L"image/jpeg" : L"application/octet-stream");
    const std::string boundary = "LingBuilderNotifyBoundary9a3f5c7d1e2b4f6a";
    std::string body = "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"media\"; filename=\"" + LB_WideToUtf8(fileName.c_str()) + "\"\r\n";
    body += "Content-Type: " + LB_NotifyUtf8Ascii(std::wstring(mime)) + "\r\n\r\n";
    body.append(reinterpret_cast<const char*>(bytes.data()), bytes.size());
    body += "\r\n--" + boundary + "--\r\n";
    const std::wstring uploadUrl = L"https://qyapi.weixin.qq.com/cgi-bin/webhook/upload_media?key=" + key + L"&type=file";
    const std::wstring uploadType = std::wstring(L"multipart/form-data; boundary=") + std::wstring(boundary.begin(), boundary.end());
    const LB_NotifyHttpResult response = LB_NotifyHttpPost(uploadUrl, body, uploadType.c_str(), LB_NOTIFY_DEFAULT_TIMEOUT_MS * 3);
    if (!response.ok) return LB_ReturnText(L"");
    if (!LB_NotifyWecomDingtalkSuccess(response, L"企业微信")) return LB_ReturnText(L"");
    const std::wstring mediaId = LB_NotifyJsonStringField(response.body, "media_id");
    if (mediaId.empty()) { LB_NotifyFail(L"上传成功但响应中未找到 media_id，响应原文见 推送_取响应文本()。"); return LB_ReturnText(L""); }
    return LB_ReturnText(mediaId);
}

bool 推送_发企业微信文件(const wchar_t* 地址, const wchar_t* media_id) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring mediaId = LB_Wide(media_id);
    if (!LB_NotifyCheckUrl(url) || mediaId.empty()) { if (mediaId.empty()) LB_NotifyFail(L"media_id 不能为空，请先用 推送_上传企业微信文件 上传。"); return false; }
    const std::wstring json = L"{\"msgtype\":\"file\",\"file\":{\"media_id\":" + LB_NotifyJsonQuote(mediaId) + L"}}";
    return LB_NotifySendWecomDingtalk(url, json, L"企业微信");
}

bool 推送_发钉钉文本(const wchar_t* 地址, const wchar_t* 内容, const wchar_t* 手机号列表, bool 是否所有人, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    const std::wstring content = LB_Wide(内容);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || content.empty()) { if (content.empty()) LB_NotifyFail(L"内容不能为空。"); return false; }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    std::wstring json = L"{\"msgtype\":\"text\",\"text\":{\"content\":" + LB_NotifyJsonQuote(content) + L"}";
    const std::vector<std::wstring> mobiles = LB_NotifySplitList(LB_Wide(手机号列表));
    if (是否所有人 || !mobiles.empty()) {
        json += L",\"at\":{";
        if (!mobiles.empty()) {
            json += L"\"atMobiles\":[";
            for (size_t i = 0; i < mobiles.size(); ++i) { if (i) json += L","; json += LB_NotifyJsonQuote(mobiles[i]); }
            json += L"]";
        }
        if (是否所有人) { if (!mobiles.empty()) json += L","; json += L"\"isAtAll\":true"; }
        json += L"}";
    }
    json += L"}";
    return LB_NotifySendWecomDingtalk(url, json, L"钉钉");
}

bool 推送_发钉钉Markdown(const wchar_t* 地址, const wchar_t* 内容, const wchar_t* 手机号列表, bool 是否所有人, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    std::wstring content = LB_Wide(内容);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || content.empty()) { if (content.empty()) LB_NotifyFail(L"内容不能为空。"); return false; }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    // 钉钉要求正文里出现 @手机号 文本才显示 @；列表里有而正文缺失的由运行时补在末尾。
    std::vector<std::wstring> mobiles = LB_NotifySplitList(LB_Wide(手机号列表));
    for (const std::wstring& mobile : mobiles) {
        if (content.find(L"@" + mobile) == std::wstring::npos) content += L" @" + mobile;
    }
    // 钉钉要求 Markdown 带 title（会话列表预览）：取正文首个非空行，去掉行首井号与空格，截 20 字。
    std::wstring title;
    for (const std::wstring& line : LB_NotifySplitLines(content)) {
        const std::wstring trimmed = LB_NotifyTrim(line);
        if (trimmed.empty()) continue;
        title = trimmed;
        size_t start = 0;
        while (start < title.size() && title[start] == L'#') ++start;
        while (start < title.size() && (title[start] == L' ' || title[start] == L'\u3000')) ++start;
        title = title.substr(start);
        break;
    }
    if (title.size() > 20) title = title.substr(0, 20);
    std::wstring json = L"{\"msgtype\":\"markdown\",\"markdown\":{\"title\":" + LB_NotifyJsonQuote(title) + L",\"text\":" + LB_NotifyJsonQuote(content) + L"}";
    if (是否所有人 || !mobiles.empty()) {
        json += L",\"at\":{";
        if (!mobiles.empty()) {
            json += L"\"atMobiles\":[";
            for (size_t i = 0; i < mobiles.size(); ++i) { if (i) json += L","; json += LB_NotifyJsonQuote(mobiles[i]); }
            json += L"]";
        }
        if (是否所有人) { if (!mobiles.empty()) json += L","; json += L"\"isAtAll\":true"; }
        json += L"}";
    }
    json += L"}";
    return LB_NotifySendWecomDingtalk(url, json, L"钉钉");
}

bool 推送_发钉钉链接(const wchar_t* 地址, const wchar_t* 标题, const wchar_t* 内容, const wchar_t* 跳转链接, const wchar_t* 图片链接, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    const std::wstring title = LB_Wide(标题);
    const std::wstring content = LB_Wide(内容);
    const std::wstring messageUrl = LB_Wide(跳转链接);
    const std::wstring picUrl = LB_Wide(图片链接);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || title.empty() || messageUrl.empty()) {
        if (title.empty()) LB_NotifyFail(L"标题不能为空。");
        if (messageUrl.empty()) LB_NotifyFail(L"跳转链接不能为空。");
        return false;
    }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    std::wstring payload = L"{\"msgtype\":\"link\",\"link\":{\"title\":" + LB_NotifyJsonQuote(title) + L",\"text\":" + LB_NotifyJsonQuote(content) + L",\"messageUrl\":" + LB_NotifyJsonQuote(messageUrl);
    if (!picUrl.empty()) payload += L",\"picUrl\":" + LB_NotifyJsonQuote(picUrl);
    payload += L"}}";
    return LB_NotifySendWecomDingtalk(url, payload, L"钉钉");
}

bool 推送_发钉钉卡片单按钮(const wchar_t* 地址, const wchar_t* 标题, const wchar_t* 内容, const wchar_t* 按钮标题, const wchar_t* 跳转链接, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    const std::wstring title = LB_Wide(标题);
    const std::wstring content = LB_Wide(内容);
    const std::wstring buttonTitle = LB_Wide(按钮标题);
    const std::wstring buttonUrl = LB_Wide(跳转链接);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || buttonTitle.empty() || buttonUrl.empty()) {
        if (buttonTitle.empty()) LB_NotifyFail(L"按钮标题不能为空。");
        if (buttonUrl.empty()) LB_NotifyFail(L"跳转链接不能为空。");
        return false;
    }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    const std::wstring payload = L"{\"msgtype\":\"actionCard\",\"actionCard\":{\"title\":" + LB_NotifyJsonQuote(title)
        + L",\"text\":" + LB_NotifyJsonQuote(content)
        + L",\"singleTitle\":" + LB_NotifyJsonQuote(buttonTitle)
        + L",\"singleURL\":" + LB_NotifyJsonQuote(buttonUrl) + L"}}";
    return LB_NotifySendWecomDingtalk(url, payload, L"钉钉");
}

bool 推送_发钉钉卡片多按钮(const wchar_t* 地址, const wchar_t* 标题, const wchar_t* 内容, const wchar_t* 按钮列表文本, bool 是否横排, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    const std::wstring title = LB_Wide(标题);
    const std::wstring content = LB_Wide(内容);
    const std::wstring buttonsText = LB_Wide(按钮列表文本);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || buttonsText.empty()) { if (buttonsText.empty()) LB_NotifyFail(L"按钮列表文本不能为空（每行：按钮标题|跳转链接）。"); return false; }
    std::wstring buttons;
    size_t count = 0;
    for (const std::wstring& line : LB_NotifySplitLines(buttonsText)) {
        const std::wstring trimmed = LB_NotifyTrim(line);
        if (trimmed.empty()) continue;
        const std::vector<std::wstring> fields = LB_NotifySplitFields(trimmed, 2);
        if (fields[0].empty() || fields.size() < 2 || fields[1].empty()) { LB_NotifyFail(L"按钮「" + fields[0] + L"」格式错误：每行必须是 按钮标题|跳转链接。"); return false; }
        if (count) buttons += L",";
        buttons += L"{\"title\":" + LB_NotifyJsonQuote(fields[0]) + L",\"actionURL\":" + LB_NotifyJsonQuote(fields[1]) + L"}";
        ++count;
    }
    if (count == 0) { LB_NotifyFail(L"按钮列表为空：每行一条 按钮标题|跳转链接。"); return false; }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    const std::wstring payload = L"{\"msgtype\":\"actionCard\",\"actionCard\":{\"title\":" + LB_NotifyJsonQuote(title)
        + L",\"text\":" + LB_NotifyJsonQuote(content)
        + L",\"btnOrientation\":\"" + std::wstring(是否横排 ? L"1" : L"0") + L"\""
        + L",\"btns\":[" + buttons + L"]}}";
    return LB_NotifySendWecomDingtalk(url, payload, L"钉钉");
}

bool 推送_发钉钉图文(const wchar_t* 地址, const wchar_t* 图文条目文本, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    std::wstring url = LB_Wide(地址);
    const std::wstring itemsText = LB_Wide(图文条目文本);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || itemsText.empty()) { if (itemsText.empty()) LB_NotifyFail(L"图文条目文本不能为空。"); return false; }
    std::wstring links;
    size_t count = 0;
    for (const std::wstring& line : LB_NotifySplitLines(itemsText)) {
        const std::wstring trimmed = LB_NotifyTrim(line);
        if (trimmed.empty()) continue;
        const std::vector<std::wstring> fields = LB_NotifySplitFields(trimmed, 3);
        if (fields[0].empty() || fields.size() < 2 || fields[1].empty()) { LB_NotifyFail(L"条目「" + fields[0] + L"」格式错误：每行必须是 标题|跳转链接|图片URL。"); return false; }
        if (count) links += L",";
        links += L"{\"title\":" + LB_NotifyJsonQuote(fields[0]) + L",\"messageURL\":" + LB_NotifyJsonQuote(fields[1]);
        if (fields.size() > 2 && !fields[2].empty()) links += L",\"picURL\":" + LB_NotifyJsonQuote(fields[2]);
        links += L"}";
        ++count;
    }
    if (count == 0) { LB_NotifyFail(L"图文条目为空：每行一条 标题|跳转链接|图片URL。"); return false; }
    if (!LB_NotifyApplyDingTalkSign(url, secret)) return false;
    const std::wstring payload = L"{\"msgtype\":\"feedCard\",\"feedCard\":{\"links\":[" + links + L"]}}";
    return LB_NotifySendWecomDingtalk(url, payload, L"钉钉");
}

bool 推送_发飞书文本(const wchar_t* 地址, const wchar_t* 内容, const wchar_t* 用户ID列表, bool 是否所有人, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    std::wstring content = LB_Wide(内容);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || content.empty()) { if (content.empty()) LB_NotifyFail(L"内容不能为空。"); return false; }
    const std::wstring signFields = LB_NotifyFeishuSignFields(secret);
    if (!secret.empty() && signFields.empty()) return false;
    // 飞书 @ 人靠 open_id 内联标签（不是手机号）；@ 所有人是 <at user_id="all">所有人</at>。
    if (是否所有人) content += L"<at user_id=\"all\">所有人</at>";
    for (const std::wstring& id : LB_NotifySplitList(LB_Wide(用户ID列表))) {
        if (id.find(L'"') != std::wstring::npos || id.find(L'<') != std::wstring::npos || id.find(L'>') != std::wstring::npos) { LB_NotifyFail(L"用户 ID 含非法字符（引号或尖括号）：" + id); return false; }
        content += L"<at user_id=\"" + id + L"\"></at>";
    }
    const std::wstring payload = L"\"msg_type\":\"text\",\"content\":{\"text\":" + LB_NotifyJsonQuote(content) + L"}";
    return LB_NotifySendFeishu(url, signFields, payload, L"飞书");
}

bool 推送_发飞书富文本(const wchar_t* 地址, const wchar_t* 多行文本, const wchar_t* 加签密钥) {
    LB_NotifyClearState();
    const std::wstring url = LB_Wide(地址);
    const std::wstring text = LB_Wide(多行文本);
    const std::wstring secret = LB_Wide(加签密钥);
    if (!LB_NotifyCheckUrl(url) || text.empty()) { if (text.empty()) LB_NotifyFail(L"多行文本不能为空。"); return false; }
    const std::wstring signFields = LB_NotifyFeishuSignFields(secret);
    if (!secret.empty() && signFields.empty()) return false;
    // 每行一个段落（一行 → 一个 text 元素），空行忽略；链接/图片/@ 嵌套元素走 推送_发JSON。
    std::wstring paragraphs;
    for (const std::wstring& line : LB_NotifySplitLines(text)) {
        const std::wstring trimmed = LB_NotifyTrim(line);
        if (trimmed.empty()) continue;
        if (!paragraphs.empty()) paragraphs += L",";
        paragraphs += L"[{\"tag\":\"text\",\"text\":" + LB_NotifyJsonQuote(trimmed) + L"}]";
    }
    if (paragraphs.empty()) { LB_NotifyFail(L"多行文本没有有效段落（空行已忽略）。"); return false; }
    const std::wstring payload = L"\"msg_type\":\"post\",\"content\":{\"post\":{\"zh_cn\":{\"title\":\"\",\"content\":[" + paragraphs + L"]}}}";
    return LB_NotifySendFeishu(url, signFields, payload, L"飞书");
}
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.net.tcp': TCP_RUNTIME,
  'lingbuilder.net.udp': UDP_RUNTIME,
  'lingbuilder.net.dns': DNS_RUNTIME,
  'lingbuilder.net.pop3': MAIL_CLIENT_RUNTIME,
  'lingbuilder.net.imap': MAIL_CLIENT_RUNTIME,
  'lingbuilder.net.url': URL_RUNTIME,
  'lingbuilder.net.cookie': COOKIE_RUNTIME,
  'lingbuilder.net.ftp': FTP_RUNTIME,
  'lingbuilder.notify': NOTIFY_RUNTIME
};

export function generateNetworkLibraryRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  const fragments = Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime);
  const needsSockets = ['lingbuilder.net.tcp', 'lingbuilder.net.udp', 'lingbuilder.net.dns', 'lingbuilder.net.mail'].some(moduleId => enabledIds.has(moduleId));
  return [needsSockets ? SOCKET_SUPPORT : '', ...fragments].filter(Boolean).join('\n');
}
