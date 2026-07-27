#include "web_http_bridge.h"

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <winhttp.h>

#include <algorithm>
#include <cctype>
#include <cwctype>
#include <map>
#include <mutex>
#include <sstream>

#pragma comment(lib, "winhttp.lib")

namespace {

struct 最近网页访问结果 {
    std::vector<unsigned char> body;
    std::wstring text;
    std::wstring cookies;
    std::wstring headers;
    int statusCode = 0;
    std::wstring error;
};

std::mutex g_resultMutex;
最近网页访问结果 g_lastResult;

struct HandleGuard {
    HINTERNET value = nullptr;
    ~HandleGuard() {
        if (value) WinHttpCloseHandle(value);
    }
    operator HINTERNET() const { return value; }
};

std::wstring methodName(int method) {
    switch (method) {
        case 1: return L"POST";
        case 2: return L"HEAD";
        case 3: return L"PUT";
        case 4: return L"OPTIONS";
        case 5: return L"DELETE";
        case 6: return L"TRACE";
        case 7: return L"CONNECT";
        case 8: return L"PATCH";
        default: return L"GET";
    }
}

std::string wideToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    const int bytes = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (bytes <= 1) return {};
    std::string result(static_cast<size_t>(bytes - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, result.data(), bytes, nullptr, nullptr);
    return result;
}

std::wstring utf8ToWide(const std::vector<unsigned char>& bytes) {
    if (bytes.empty()) return {};
    const char* data = reinterpret_cast<const char*>(bytes.data());
    const int chars = MultiByteToWideChar(CP_UTF8, 0, data, static_cast<int>(bytes.size()), nullptr, 0);
    if (chars <= 0) return {};
    std::wstring result(static_cast<size_t>(chars), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, data, static_cast<int>(bytes.size()), result.data(), chars);
    return result;
}

std::wstring trim(const std::wstring& value) {
    size_t start = 0;
    while (start < value.size() && std::iswspace(value[start])) start += 1;
    size_t end = value.size();
    while (end > start && std::iswspace(value[end - 1])) end -= 1;
    return value.substr(start, end - start);
}

std::wstring normalizeHeaderName(const std::wstring& name) {
    std::wstring result = trim(name);
    bool upperNext = true;
    for (wchar_t& ch : result) {
        if (ch == L'-') {
            upperNext = true;
            continue;
        }
        ch = upperNext ? static_cast<wchar_t>(std::towupper(ch)) : static_cast<wchar_t>(std::towlower(ch));
        upperNext = false;
    }
    return result;
}

std::wstring normalizeHeaderBlock(const std::wstring& headers, bool fixCase) {
    std::wstringstream input(headers);
    std::wstring line;
    std::wstring output;
    while (std::getline(input, line)) {
        if (!line.empty() && line.back() == L'\r') line.pop_back();
        line = trim(line);
        if (line.empty()) continue;
        const size_t colon = line.find(L':');
        if (fixCase && colon != std::wstring::npos) {
            line = normalizeHeaderName(line.substr(0, colon)) + L": " + trim(line.substr(colon + 1));
        }
        output += line + L"\r\n";
    }
    return output;
}

bool hasHeader(const std::wstring& headers, const std::wstring& key) {
    std::wstring lowerHeaders = headers;
    std::wstring lowerKey = key;
    std::transform(lowerHeaders.begin(), lowerHeaders.end(), lowerHeaders.begin(), ::towlower);
    std::transform(lowerKey.begin(), lowerKey.end(), lowerKey.begin(), ::towlower);
    return lowerHeaders.find(lowerKey + L":") != std::wstring::npos;
}

std::wstring collectSetCookies(const std::wstring& responseHeaders) {
    std::wstringstream input(responseHeaders);
    std::wstring line;
    std::wstring cookies;
    while (std::getline(input, line)) {
        if (!line.empty() && line.back() == L'\r') line.pop_back();
        std::wstring lower = line;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::towlower);
        if (lower.rfind(L"set-cookie:", 0) == 0) {
            std::wstring value = trim(line.substr(11));
            const size_t semicolon = value.find(L';');
            if (semicolon != std::wstring::npos) value = value.substr(0, semicolon);
            if (!value.empty()) {
                if (!cookies.empty()) cookies += L"; ";
                cookies += value;
            }
        }
    }
    return cookies;
}

std::map<std::wstring, std::wstring> parseCookiePairs(const std::wstring& cookies) {
    std::map<std::wstring, std::wstring> result;
    std::wstringstream input(cookies);
    std::wstring item;
    while (std::getline(input, item, L';')) {
        const size_t equal = item.find(L'=');
        if (equal == std::wstring::npos) continue;
        std::wstring key = trim(item.substr(0, equal));
        std::wstring value = trim(item.substr(equal + 1));
        if (!key.empty()) result[key] = value;
    }
    return result;
}

std::wstring joinCookiePairs(const std::map<std::wstring, std::wstring>& cookies) {
    std::wstring result;
    for (const auto& [key, value] : cookies) {
        if (!result.empty()) result += L"; ";
        result += key + L"=" + value;
    }
    return result;
}

std::wstring mergeCookies(const std::wstring& oldCookies, const std::wstring& newCookies) {
    auto merged = parseCookiePairs(oldCookies);
    auto incoming = parseCookiePairs(newCookies);
    for (const auto& [key, value] : incoming) merged[key] = value;
    return joinCookiePairs(merged);
}

std::wstring lastErrorText(const std::wstring& prefix) {
    const DWORD code = GetLastError();
    wchar_t* buffer = nullptr;
    FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        nullptr,
        code,
        0,
        reinterpret_cast<LPWSTR>(&buffer),
        0,
        nullptr);
    std::wstring message = buffer ? trim(buffer) : L"未知错误";
    if (buffer) LocalFree(buffer);
    return prefix + L"失败，错误码 " + std::to_wstring(code) + L"：" + message;
}

void saveLastResult(const 最近网页访问结果& result) {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    g_lastResult = result;
}

}  // namespace

std::vector<unsigned char> 网页_访问_对象(
    const std::wstring& 网址,
    int 访问方式,
    const std::wstring& 提交信息,
    const std::wstring& 提交Cookies,
    const std::wstring&,
    const std::wstring& 附加协议头,
    const std::wstring&,
    int,
    bool 禁止重定向,
    const std::vector<unsigned char>& 字节集提交,
    const std::wstring& 代理地址,
    int 超时,
    const std::wstring& 代理用户名,
    const std::wstring& 代理密码,
    int 代理标识,
    void* 对象继承,
    bool 是否自动合并更新Cookie,
    bool 是否补全必要协议头,
    bool 是否处理协议头大小写) {
    std::wstring mutableSubmitCookies = 提交Cookies;
    std::wstring returnedCookies;
    std::wstring returnedHeaders;
    int statusCode = 0;
    return LB_网页_访问_对象_完整(
        网址,
        访问方式,
        提交信息,
        &mutableSubmitCookies,
        &returnedCookies,
        附加协议头,
        &returnedHeaders,
        &statusCode,
        禁止重定向,
        字节集提交,
        代理地址,
        超时,
        代理用户名,
        代理密码,
        代理标识,
        对象继承,
        是否自动合并更新Cookie,
        是否补全必要协议头,
        是否处理协议头大小写);
}

std::vector<unsigned char> LB_网页_访问_对象_完整(
    const std::wstring& 网址,
    int 访问方式,
    const std::wstring& 提交信息,
    std::wstring* 提交Cookies,
    std::wstring* 返回Cookies,
    const std::wstring& 附加协议头,
    std::wstring* 返回协议头,
    int* 返回状态代码,
    bool 禁止重定向,
    const std::vector<unsigned char>& 字节集提交,
    const std::wstring& 代理地址,
    int 超时,
    const std::wstring& 代理用户名,
    const std::wstring& 代理密码,
    int 代理标识,
    void*,
    bool 是否自动合并更新Cookie,
    bool 是否补全必要协议头,
    bool 是否处理协议头大小写) {
    最近网页访问结果 result;
    if (返回状态代码) *返回状态代码 = 0;
    if (返回Cookies) 返回Cookies->clear();
    if (返回协议头) 返回协议头->clear();

    URL_COMPONENTS parts{};
    wchar_t host[512]{};
    wchar_t path[4096]{};
    parts.dwStructSize = sizeof(parts);
    parts.lpszHostName = host;
    parts.dwHostNameLength = static_cast<DWORD>(sizeof(host) / sizeof(host[0]));
    parts.lpszUrlPath = path;
    parts.dwUrlPathLength = static_cast<DWORD>(sizeof(path) / sizeof(path[0]));
    parts.dwSchemeLength = static_cast<DWORD>(-1);
    parts.dwExtraInfoLength = static_cast<DWORD>(-1);

    if (!WinHttpCrackUrl(网址.c_str(), 0, 0, &parts) || !parts.lpszHostName || !parts.lpszUrlPath) {
        result.error = L"网址解析失败：必须是完整的 http:// 或 https:// 地址。";
        saveLastResult(result);
        return {};
    }

    const bool isHttps = parts.nScheme == INTERNET_SCHEME_HTTPS;
    if (!isHttps && parts.nScheme != INTERNET_SCHEME_HTTP) {
        result.error = L"仅支持 http:// 和 https:// 地址。";
        saveLastResult(result);
        return {};
    }

    std::wstring pathAndQuery(parts.lpszUrlPath, parts.dwUrlPathLength);
    if (parts.lpszExtraInfo && parts.dwExtraInfoLength > 0) {
        pathAndQuery.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
    }

    const DWORD accessType = 代理地址.empty() || 代理标识 == 0
        ? WINHTTP_ACCESS_TYPE_DEFAULT_PROXY
        : WINHTTP_ACCESS_TYPE_NAMED_PROXY;
    HandleGuard session{
        WinHttpOpen(
            L"LingBuilder-WebHttp/1.0",
            accessType,
            代理地址.empty() || 代理标识 == 0 ? WINHTTP_NO_PROXY_NAME : 代理地址.c_str(),
            WINHTTP_NO_PROXY_BYPASS,
            0)
    };
    if (!session) {
        result.error = lastErrorText(L"创建 WinHTTP 会话");
        saveLastResult(result);
        return {};
    }

    if (超时 < 0) {
        WinHttpSetTimeouts(session, INFINITE, INFINITE, INFINITE, INFINITE);
    } else {
        const int milliseconds = (std::max)(1, 超时) * 1000;
        WinHttpSetTimeouts(session, milliseconds, milliseconds, milliseconds, milliseconds);
    }

    HandleGuard connect{WinHttpConnect(session, std::wstring(parts.lpszHostName, parts.dwHostNameLength).c_str(), parts.nPort, 0)};
    if (!connect) {
        result.error = lastErrorText(L"连接服务器");
        saveLastResult(result);
        return {};
    }

    const std::wstring method = methodName(访问方式);
    HandleGuard request{
        WinHttpOpenRequest(
            connect,
            method.c_str(),
            pathAndQuery.c_str(),
            nullptr,
            WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            isHttps ? WINHTTP_FLAG_SECURE : 0)
    };
    if (!request) {
        result.error = lastErrorText(L"创建请求");
        saveLastResult(result);
        return {};
    }

    if (禁止重定向) {
        DWORD disable = WINHTTP_DISABLE_REDIRECTS;
        WinHttpSetOption(request, WINHTTP_OPTION_DISABLE_FEATURE, &disable, sizeof(disable));
    }

    if (!代理用户名.empty() || !代理密码.empty()) {
        WinHttpSetCredentials(
            request,
            WINHTTP_AUTH_TARGET_PROXY,
            WINHTTP_AUTH_SCHEME_BASIC,
            代理用户名.empty() ? nullptr : 代理用户名.c_str(),
            代理密码.empty() ? nullptr : 代理密码.c_str(),
            nullptr);
    }

    std::wstring headers = normalizeHeaderBlock(附加协议头, 是否处理协议头大小写);
    if (提交Cookies && !提交Cookies->empty()) {
        headers += L"Cookie: " + *提交Cookies + L"\r\n";
    }
    if (是否补全必要协议头 && !hasHeader(headers, L"User-Agent")) {
        headers += L"User-Agent: LingBuilder-WebHttp/1.0\r\n";
    }

    std::vector<unsigned char> body = 字节集提交;
    std::string postText;
    if (body.empty() && !提交信息.empty()) {
        postText = wideToUtf8(提交信息);
        body.assign(postText.begin(), postText.end());
        if (!hasHeader(headers, L"Content-Type")) {
            headers += L"Content-Type: application/x-www-form-urlencoded; charset=utf-8\r\n";
        }
    }

    if (!headers.empty()) {
        WinHttpAddRequestHeaders(request, headers.c_str(), static_cast<DWORD>(headers.size()), WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE);
    }

    const BOOL sent = WinHttpSendRequest(
        request,
        WINHTTP_NO_ADDITIONAL_HEADERS,
        0,
        body.empty() ? WINHTTP_NO_REQUEST_DATA : body.data(),
        static_cast<DWORD>(body.size()),
        static_cast<DWORD>(body.size()),
        0);
    if (!sent || !WinHttpReceiveResponse(request, nullptr)) {
        result.error = lastErrorText(L"发送或接收请求");
        saveLastResult(result);
        return {};
    }

    DWORD statusCode = 0;
    DWORD statusCodeSize = sizeof(statusCode);
    if (WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &statusCode, &statusCodeSize, nullptr)) {
        result.statusCode = static_cast<int>(statusCode);
        if (返回状态代码) *返回状态代码 = result.statusCode;
    }

    DWORD headerSize = 0;
    WinHttpQueryHeaders(request, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &headerSize, WINHTTP_NO_HEADER_INDEX);
    if (GetLastError() == ERROR_INSUFFICIENT_BUFFER && headerSize > 0) {
        std::wstring rawHeaders(headerSize / sizeof(wchar_t), L'\0');
        if (WinHttpQueryHeaders(request, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, rawHeaders.data(), &headerSize, WINHTTP_NO_HEADER_INDEX)) {
            rawHeaders.resize(wcsnlen_s(rawHeaders.c_str(), rawHeaders.size()));
            result.headers = rawHeaders;
            if (返回协议头) *返回协议头 = result.headers;
        }
    }

    result.cookies = collectSetCookies(result.headers);
    if (是否自动合并更新Cookie && 提交Cookies) {
        *提交Cookies = mergeCookies(*提交Cookies, result.cookies);
    }
    if (返回Cookies) *返回Cookies = result.cookies;

    for (;;) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available)) {
            result.error = lastErrorText(L"查询响应数据");
            break;
        }
        if (available == 0) break;
        const size_t oldSize = result.body.size();
        result.body.resize(oldSize + available);
        DWORD read = 0;
        if (!WinHttpReadData(request, result.body.data() + oldSize, available, &read)) {
            result.error = lastErrorText(L"读取响应数据");
            result.body.resize(oldSize);
            break;
        }
        result.body.resize(oldSize + read);
    }

    result.text = utf8ToWide(result.body);
    saveLastResult(result);
    return result.body;
}

std::wstring 网页_取返回文本() {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    return g_lastResult.text;
}

std::wstring 网页_取返回Cookies() {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    return g_lastResult.cookies;
}

std::wstring 网页_取返回协议头() {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    return g_lastResult.headers;
}

int 网页_取返回状态代码() {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    return g_lastResult.statusCode;
}

std::wstring 网页_取错误信息() {
    std::lock_guard<std::mutex> lock(g_resultMutex);
    return g_lastResult.error;
}
