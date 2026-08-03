import { InstalledModule } from '../modules/types';

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
const wchar_t* DNS_解析首个地址(const wchar_t* host) { if (!LB_EnsureSockets()) return LB_ReturnText(L""); ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; ADDRINFOW* addresses = nullptr; if (GetAddrInfoW(host, nullptr, &hints, &addresses) != 0 || !addresses) return LB_ReturnText(L""); wchar_t buffer[INET6_ADDRSTRLEN] = {}; void* raw = addresses->ai_family == AF_INET ? static_cast<void*>(&reinterpret_cast<sockaddr_in*>(addresses->ai_addr)->sin_addr) : static_cast<void*>(&reinterpret_cast<sockaddr_in6*>(addresses->ai_addr)->sin6_addr); InetNtopW(addresses->ai_family, raw, buffer, _countof(buffer)); FreeAddrInfoW(addresses); return LB_ReturnText(buffer); }

const wchar_t* DNS_反向查询(const wchar_t* ip) { if (!LB_EnsureSockets()) return LB_ReturnText(L""); sockaddr_storage address = {}; int size = 0; sockaddr_in* ipv4 = reinterpret_cast<sockaddr_in*>(&address); sockaddr_in6* ipv6 = reinterpret_cast<sockaddr_in6*>(&address); if (InetPtonW(AF_INET, ip, &ipv4->sin_addr) == 1) { ipv4->sin_family = AF_INET; size = sizeof(*ipv4); } else if (InetPtonW(AF_INET6, ip, &ipv6->sin6_addr) == 1) { ipv6->sin6_family = AF_INET6; size = sizeof(*ipv6); } else return LB_ReturnText(L""); wchar_t host[NI_MAXHOST] = {}; return GetNameInfoW(reinterpret_cast<sockaddr*>(&address), size, host, _countof(host), nullptr, 0, NI_NAMEREQD) == 0 ? LB_ReturnText(host) : LB_ReturnText(L""); }

const wchar_t* 网络_取本机名() { if (!LB_EnsureSockets()) return LB_ReturnText(L""); char host[256] = {}; return gethostname(host, sizeof(host)) == 0 ? LB_ReturnText(LB_Utf8ToWide(host)) : LB_ReturnText(L""); }
bool 网络_是否IPv4(const wchar_t* value) { IN_ADDR address = {}; return InetPtonW(AF_INET, value, &address) == 1; }
bool 网络_是否IPv6(const wchar_t* value) { IN6_ADDR address = {}; return InetPtonW(AF_INET6, value, &address) == 1; }
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
