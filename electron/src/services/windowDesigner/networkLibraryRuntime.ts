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
static SOCKET g_lbUdpSocket = INVALID_SOCKET; static std::wstring g_lbUdpError; static std::wstring g_lbUdpSource; static int g_lbUdpSourcePort = 0;
void UDP_关闭() { if (g_lbUdpSocket != INVALID_SOCKET) { closesocket(g_lbUdpSocket); g_lbUdpSocket = INVALID_SOCKET; } }
const wchar_t* UDP_取错误() { return LB_ReturnText(g_lbUdpError); } const wchar_t* UDP_取来源地址() { return LB_ReturnText(g_lbUdpSource); } int UDP_取来源端口() { return g_lbUdpSourcePort; }
static bool LB_EnsureUdpSocket() { if (g_lbUdpSocket != INVALID_SOCKET) return true; if (!LB_EnsureSockets()) return false; g_lbUdpSocket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP); return g_lbUdpSocket != INVALID_SOCKET; }
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

const RUNTIMES: Record<string, string> = {
  'lingbuilder.net.tcp': TCP_RUNTIME,
  'lingbuilder.net.udp': UDP_RUNTIME,
  'lingbuilder.net.dns': DNS_RUNTIME,
  'lingbuilder.net.pop3': MAIL_CLIENT_RUNTIME,
  'lingbuilder.net.imap': MAIL_CLIENT_RUNTIME,
  'lingbuilder.net.url': URL_RUNTIME,
  'lingbuilder.net.cookie': COOKIE_RUNTIME,
  'lingbuilder.net.ftp': FTP_RUNTIME
};

export function generateNetworkLibraryRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  const fragments = Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime);
  const needsSockets = ['lingbuilder.net.tcp', 'lingbuilder.net.udp', 'lingbuilder.net.dns', 'lingbuilder.net.mail'].some(moduleId => enabledIds.has(moduleId));
  return [needsSockets ? SOCKET_SUPPORT : '', ...fragments].filter(Boolean).join('\n');
}
