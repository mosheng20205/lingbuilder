// 邮件接收运行时：POP3 + IMAP（Winsock / Schannel TLS / MIME 解析）
// 导出 MAIL_CLIENT_RUNTIME：同时注册给 lingbuilder.net.pop3 与 lingbuilder.net.imap，
// C++ 侧用 #ifndef 防止两个模块同时启用时重复定义。
export const MAIL_CLIENT_RUNTIME = String.raw`
#ifndef LB_MAIL_CLIENT_RUNTIME_DEFINED
#define LB_MAIL_CLIENT_RUNTIME_DEFINED
#define SECURITY_WIN32
#include <security.h>
#include <schannel.h>
#include <security.h>
#pragma comment(lib, "secur32.lib")

// ===== 传输与会话 =====
struct LbTlsChannel {
    SOCKET socket = INVALID_SOCKET;
    CtxtHandle context = {};
    bool hasContext = false;
    SecPkgContext_StreamSizes sizes = {};
    std::string ciphertext;
    std::string plaintext;
};

struct LbMailSession {
    bool ssl = false;
    SOCKET socket = INVALID_SOCKET;
    LbTlsChannel tls;
    std::string rbuf;
    std::wstring error;
    bool connected = false;
};

static bool LB_MailEnsureSockets() {
    static std::once_flag once;
    static bool initialized = false;
    std::call_once(once, []() { WSADATA data = {}; initialized = WSAStartup(MAKEWORD(2, 2), &data) == 0; });
    return initialized;
}

static bool LB_MailRawRecv(LbMailSession& s, char* buffer, int size, int* got) {
    if (s.ssl) {
        while (s.tls.plaintext.empty()) {
            char chunk[16384];
            const int received = recv(s.tls.socket, chunk, sizeof(chunk), 0);
            if (received <= 0) return false;
            s.tls.ciphertext.append(chunk, received);
            SecBuffer decryptBuffers[4] = {};
            decryptBuffers[0].BufferType = SECBUFFER_DATA; decryptBuffers[0].cbBuffer = static_cast<unsigned long>(s.tls.ciphertext.size()); decryptBuffers[0].pvBuffer = s.tls.ciphertext.data();
            decryptBuffers[1].BufferType = SECBUFFER_EMPTY; decryptBuffers[2].BufferType = SECBUFFER_EMPTY; decryptBuffers[3].BufferType = SECBUFFER_EMPTY;
            SecBufferDesc decryptDesc = { SECBUFFER_VERSION, 4, decryptBuffers };
            unsigned long ignored = 0;
            const SECURITY_STATUS status = DecryptMessage(&s.tls.context, &decryptDesc, 0, &ignored);
            if (status == SEC_E_INCOMPLETE_MESSAGE) { s.tls.ciphertext.resize(decryptBuffers[0].cbBuffer); continue; }
            if (FAILED(status)) return false;
            std::string leftover;
            for (int i = 0; i < 4; ++i) {
                if (decryptBuffers[i].BufferType == SECBUFFER_DATA) s.tls.plaintext.append(static_cast<char*>(decryptBuffers[i].pvBuffer), decryptBuffers[i].cbBuffer);
                if (decryptBuffers[i].BufferType == SECBUFFER_EXTRA) leftover.append(static_cast<char*>(decryptBuffers[i].pvBuffer), decryptBuffers[i].cbBuffer);
            }
            s.tls.ciphertext = leftover;
        }
        const int take = (std::min)(size, static_cast<int>(s.tls.plaintext.size()));
        memcpy(buffer, s.tls.plaintext.data(), take);
        s.tls.plaintext.erase(0, take);
        *got = take;
        return true;
    }
    const int received = recv(s.socket, buffer, size, 0);
    if (received <= 0) return false;
    *got = received;
    return true;
}

static bool LB_MailSendAll(LbMailSession& s, const std::string& data) {
    size_t sent = 0;
    while (sent < data.size()) {
        if (!s.ssl) {
            const int count = send(s.socket, data.data() + sent, static_cast<int>(data.size() - sent), 0);
            if (count <= 0) return false;
            sent += count;
        } else {
            SecBuffer payloads[4] = {};
            payloads[0].BufferType = SECBUFFER_STREAM_HEADER; payloads[0].cbBuffer = s.tls.sizes.cbHeader; payloads[0].pvBuffer = malloc(s.tls.sizes.cbHeader ? s.tls.sizes.cbHeader : 1);
            const size_t chunk = (std::min)(data.size() - sent, static_cast<size_t>(s.tls.sizes.cbMaximumMessage));
            payloads[1].BufferType = SECBUFFER_DATA; payloads[1].cbBuffer = static_cast<unsigned long>(chunk); payloads[1].pvBuffer = malloc(chunk ? chunk : 1);
            payloads[2].BufferType = SECBUFFER_STREAM_TRAILER; payloads[2].cbBuffer = s.tls.sizes.cbTrailer; payloads[2].pvBuffer = malloc(s.tls.sizes.cbTrailer ? s.tls.sizes.cbTrailer : 1);
            payloads[3].BufferType = SECBUFFER_EMPTY;
            if (chunk) memcpy(payloads[1].pvBuffer, data.data() + sent, chunk);
            SecBufferDesc encryptDesc = { SECBUFFER_VERSION, 4, payloads };
            const bool encrypted = EncryptMessage(&s.tls.context, 0, &encryptDesc, 0) == SEC_E_OK;
            std::string wire;
            if (encrypted) {
                wire.append(static_cast<char*>(payloads[0].pvBuffer), payloads[0].cbBuffer);
                wire.append(static_cast<char*>(payloads[1].pvBuffer), payloads[1].cbBuffer);
                wire.append(static_cast<char*>(payloads[2].pvBuffer), payloads[2].cbBuffer);
            }
            free(payloads[0].pvBuffer); free(payloads[1].pvBuffer); free(payloads[2].pvBuffer);
            if (!encrypted) return false;
            size_t offset = 0;
            while (offset < wire.size()) {
                const int count = send(s.tls.socket, wire.data() + offset, static_cast<int>(wire.size() - offset), 0);
                if (count <= 0) return false;
                offset += count;
            }
            sent += chunk;
        }
    }
    return true;
}

static bool LB_MailReadByte(LbMailSession& s, char& out) {
    if (s.rbuf.empty()) {
        char buffer[8192];
        int got = 0;
        if (!LB_MailRawRecv(s, buffer, sizeof(buffer), &got)) return false;
        s.rbuf.assign(buffer, got);
    }
    out = s.rbuf.front();
    s.rbuf.erase(s.rbuf.begin());
    return true;
}

static bool LB_MailReadLine(LbMailSession& s, std::string& line) {
    line.clear();
    char ch = 0;
    while (LB_MailReadByte(s, ch)) {
        if (ch == '\n') { if (!line.empty() && line.back() == '\r') line.pop_back(); return true; }
        line += ch;
    }
    return !line.empty();
}

// ===== Schannel TLS 握手 =====
static bool LB_MailTlsHandshake(LbMailSession& s, const wchar_t* host) {
    s.tls.socket = s.socket;
    SCHANNEL_CRED credentialData = {}; credentialData.dwVersion = SCHANNEL_CRED_VERSION;
    credentialData.dwFlags = SCH_CRED_MANUAL_CRED_VALIDATION | SCH_CRED_NO_DEFAULT_CREDS;
    CredHandle credential = {};
    TimeStamp expiry = {};
    if (AcquireCredentialsHandleW(nullptr, UNISP_NAME_W, SECPKG_CRED_OUTBOUND, nullptr, &credentialData, nullptr, nullptr, &credential, &expiry) != SEC_E_OK) return false;
    bool hasPartialContext = false, handshakeDone = false, ok = false;
    std::string pending;
    for (int iteration = 0; iteration < 24 && !handshakeDone; ++iteration) {
        SecBuffer inputBuffers[2] = {};
        inputBuffers[0].BufferType = SECBUFFER_TOKEN;
        inputBuffers[0].cbBuffer = static_cast<unsigned long>(pending.size());
        inputBuffers[0].pvBuffer = pending.empty() ? nullptr : pending.data();
        inputBuffers[1].BufferType = SECBUFFER_EMPTY;
        SecBufferDesc inputDesc = { SECBUFFER_VERSION, 2, inputBuffers };
        SecBuffer outputBuffers[1] = {};
        outputBuffers[0].BufferType = SECBUFFER_TOKEN;
        SecBufferDesc outputDesc = { SECBUFFER_VERSION, 1, outputBuffers };
        unsigned long contextAttributes = 0;
        const SECURITY_STATUS status = InitializeSecurityContextW(&credential, hasPartialContext ? &s.tls.context : nullptr,
            const_cast<wchar_t*>(host), ISC_REQ_REPLAY_DETECT | ISC_REQ_CONFIDENTIALITY | ISC_REQ_ALLOCATE_MEMORY | ISC_REQ_EXTENDED_ERROR,
            0, SECURITY_NATIVE_DREP, hasPartialContext ? &inputDesc : nullptr, 0, &s.tls.context, &outputDesc, &contextAttributes, &expiry);
        hasPartialContext = true;
        if (outputBuffers[0].cbBuffer > 0 && outputBuffers[0].pvBuffer) {
            size_t sent = 0;
            const char* data = static_cast<const char*>(outputBuffers[0].pvBuffer);
            while (sent < outputBuffers[0].cbBuffer) {
                const int count = send(s.socket, data + sent, static_cast<int>(outputBuffers[0].cbBuffer - sent), 0);
                if (count <= 0) break;
                sent += count;
            }
            FreeContextBuffer(outputBuffers[0].pvBuffer);
        }
        if (status == SEC_E_OK) { ok = true; QueryContextAttributesW(&s.tls.context, SECPKG_ATTR_STREAM_SIZES, &s.tls.sizes); break; }
        if (status != SEC_I_CONTINUE_NEEDED && status != SEC_E_INCOMPLETE_MESSAGE) break;
        if (status == SEC_I_CONTINUE_NEEDED && inputBuffers[1].BufferType == SECBUFFER_EXTRA && inputBuffers[1].cbBuffer > 0) {
            pending = pending.substr(pending.size() - inputBuffers[1].cbBuffer);
        } else {
            pending.clear();
        }
        char chunk[16384];
        const int received = recv(s.socket, chunk, sizeof(chunk), 0);
        if (received <= 0) break;
        pending.append(chunk, received);
    }
    FreeCredentialsHandle(&credential);
    return ok;
}

// ===== MIME 解析 =====
static std::vector<unsigned char> LB_MailBase64Decode(const std::string& input) {
    std::vector<unsigned char> out;
    int bits = 0, accumulator = 0;
    for (char ch : input) {
        if (ch == '=' || ch == '\r' || ch == '\n' || ch == ' ' || ch == '\t') continue;
        int value = -1;
        if (ch >= 'A' && ch <= 'Z') value = ch - 'A';
        else if (ch >= 'a' && ch <= 'z') value = ch - 'a' + 26;
        else if (ch >= '0' && ch <= '9') value = ch - '0' + 52;
        else if (ch == '+') value = 62;
        else if (ch == '/') value = 63;
        if (value < 0) continue;
        accumulator = (accumulator << 6) | value;
        bits += 6;
        if (bits >= 8) { bits -= 8; out.push_back(static_cast<unsigned char>((accumulator >> bits) & 0xFF)); }
    }
    return out;
}

static std::string LB_MailQuotedPrintableDecode(const std::string& input) {
    std::string out;
    for (size_t i = 0; i < input.size(); ++i) {
        if (input[i] == '=' && i + 2 < input.size() && ((input[i+1] >= '0' && input[i+1] <= '9') || (input[i+1] >= 'A' && input[i+1] <= 'F') || (input[i+1] >= 'a' && input[i+1] <= 'f'))) {
            auto hexValue = [](char c) { return c <= '9' ? c - '0' : (c | 0x20) - 'a' + 10; };
            out.push_back(static_cast<char>(hexValue(input[i+1]) * 16 + hexValue(input[i+2])));
            i += 2;
        } else if (input[i] == '=' && i + 1 < input.size() && input[i+1] == '\n') {
            ++i;
        } else if (input[i] == '=' && i + 2 < input.size() && input[i+1] == '\r' && input[i+2] == '\n') {
            i += 2;
        } else {
            out.push_back(input[i]);
        }
    }
    return out;
}

static std::wstring LB_MailBytesToWide(const std::string& bytes, const std::string& charset) {
    std::string lower = charset;
    for (char& ch : lower) { ch = static_cast<char>(tolower(static_cast<unsigned char>(ch))); }
    unsigned int codePage = CP_ACP;
    if (lower.find("utf-8") != std::wstring::npos || lower.find("utf8") != std::wstring::npos) codePage = CP_UTF8;
    else if (lower.find("gb2312") != std::wstring::npos || lower.find("gbk") != std::wstring::npos || lower.find("gb18030") != std::wstring::npos) codePage = 936;
    else if (lower.find("iso-8859-1") != std::wstring::npos || lower.find("latin1") != std::wstring::npos) codePage = 28591;
    int size = MultiByteToWideChar(codePage, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
    if (size <= 0) codePage = CP_ACP, size = MultiByteToWideChar(CP_ACP, 0, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
    if (size <= 0) return L"";
    std::wstring out(size, L'\0');
    MultiByteToWideChar(codePage, 0, bytes.data(), static_cast<int>(bytes.size()), out.data(), size);
    return out;
}

// 解码邮件头中的编码字（=?charset?B/Q?数据?=），其余 ASCII 原样保留
static std::wstring LB_MailDecodeHeader(const std::string& value) {
    std::wstring out;
    size_t position = 0;
    while (position < value.size()) {
        const size_t start = value.find("=?", position);
        if (start == std::string::npos) {
            std::string rest = value.substr(position);
            std::string cleaned;
            for (char ch : rest) if (ch != '\r' && ch != '\n') cleaned += ch;
            out += LB_MailBytesToWide(cleaned, "utf-8");
            break;
        }
        if (start > position) {
            std::string plain = value.substr(position, start - position);
            std::string cleaned;
            for (char ch : plain) if (ch != '\r' && ch != '\n') cleaned += ch;
            out += LB_MailBytesToWide(cleaned, "utf-8");
        }
        const size_t mid = value.find("?", start + 2);
        const size_t mid2 = mid == std::string::npos ? std::string::npos : value.find("?", mid + 1);
        const size_t finish = mid2 == std::string::npos ? std::string::npos : value.find("?=", mid2 + 1);
        if (mid == std::string::npos || mid2 == std::string::npos || finish == std::string::npos) {
            out += L"?";
            position = start + 2;
            continue;
        }
        const std::string charset = value.substr(start + 2, mid - start - 2);
        const char encoding = static_cast<char>(toupper(static_cast<unsigned char>(value[mid + 1])));
        std::string payload = value.substr(mid2 + 1, finish - mid2 - 1);
        std::string decodedBytes;
        if (encoding == 'B' || encoding == 'b') {
            const std::vector<unsigned char> decoded = LB_MailBase64Decode(payload);
            decodedBytes.assign(decoded.begin(), decoded.end());
        }
        else if (encoding == 'Q' || encoding == 'q') {
            for (size_t i = 0; i < payload.size(); ++i) {
                if (payload[i] == '_') decodedBytes += ' ';
                else if (payload[i] == '=' && i + 2 < payload.size()) {
                    auto hexValue = [](char c) { return c <= '9' ? c - '0' : (c | 0x20) - 'a' + 10; };
                    decodedBytes.push_back(static_cast<char>(hexValue(payload[i+1]) * 16 + hexValue(payload[i+2])));
                    i += 2;
                } else decodedBytes += payload[i];
            }
        }
        out += LB_MailBytesToWide(decodedBytes, charset);
        position = finish + 2;
    }
    const size_t begin = out.find_first_not_of(L" 	");
    if (begin == std::wstring::npos) return L"";
    const size_t end = out.find_last_not_of(L" 	");
    return out.substr(begin, end - begin + 1);
}

struct LbMailPart {
    std::string headers;
    std::string body;
};

struct LbMailAttachment {
    std::wstring name;
    std::vector<unsigned char> data;
};

struct LbMailMessage {
    std::wstring subject, from, date, textBody, htmlBody;
    std::vector<LbMailAttachment> attachments;
    bool hasMessage = false;
};

static std::string LB_MailHeaderValue(const std::string& headers, const char* name) {
    std::string key = name;
    for (char& ch : key) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    size_t position = 0;
    while (position < headers.size()) {
        const size_t lineEnd = headers.find("\r\n", position);
        const std::string line = headers.substr(position, lineEnd == std::string::npos ? std::string::npos : lineEnd - position);
        const size_t colon = line.find(':');
        if (colon != std::string::npos) {
            std::string keyPart = line.substr(0, colon);
            for (char& ch : keyPart) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
            if (keyPart == key) return line.substr(colon + 1);
        }
        if (lineEnd == std::string::npos) break;
        position = lineEnd + 2;
    }
    return "";
}

static std::string LB_MailHeaderValueFull(const std::string& headers, const char* name) {
    // 折行头：把以空格/制表符开头的续行折叠回值内
    std::string key = name;
    for (char& ch : key) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    std::string value;
    size_t position = 0;
    while (position < headers.size()) {
        const size_t lineEnd = headers.find("\r\n", position);
        const std::string line = headers.substr(position, lineEnd == std::string::npos ? std::string::npos : lineEnd - position);
        if (!line.empty() && (line[0] == ' ' || line[0] == '\t') && !value.empty()) {
            value += line;
        } else {
            const size_t colon = line.find(':');
            if (colon != std::string::npos) {
                std::string keyPart = line.substr(0, colon);
                for (char& ch : keyPart) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
                if (keyPart == key) value = line.substr(colon + 1);
            }
        }
        if (lineEnd == std::string::npos) break;
        position = lineEnd + 2;
    }
    std::string cleaned;
    for (char ch : value) if (ch != '\r' && ch != '\n') cleaned += ch;
    return cleaned;
}

static std::string LB_MailExtractParameter(const std::string& contentType, const char* name) {
    std::string key = name;
    for (char& ch : key) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    size_t position = 0;
    while (position < contentType.size()) {
        const size_t found = contentType.find(key, position);
        if (found == std::string::npos) return "";
        if (found > 0 && (contentType[found - 1] == ';' || contentType[found - 1] == ' ')) {
            const size_t equals = contentType.find('=', found + key.size());
            if (equals != std::string::npos && equals < found + key.size() + 4) {
                size_t valueStart = equals + 1;
                while (valueStart < contentType.size() && contentType[valueStart] == ' ') ++valueStart;
                if (valueStart < contentType.size() && contentType[valueStart] == '"') {
                    const size_t valueEnd = contentType.find('"', valueStart + 1);
                    if (valueEnd == std::string::npos) return "";
                    return contentType.substr(valueStart + 1, valueEnd - valueStart - 1);
                }
                const size_t valueEnd = contentType.find(';', valueStart);
                return contentType.substr(valueStart, (valueEnd == std::string::npos ? contentType.size() : valueEnd) - valueStart);
            }
        }
        position = found + key.size();
    }
    return "";
}

static void LB_MailWalkPart(const std::string& headers, const std::string& body, int depth, LbMailMessage& message) {
    if (depth > 6) return;
    std::string contentTypeValue = LB_MailHeaderValueFull(headers, "Content-Type");
    while (!contentTypeValue.empty() && (contentTypeValue[0] == ' ' || contentTypeValue[0] == '	')) contentTypeValue.erase(0, 1);
    std::string lowerType = contentTypeValue;
    for (char& ch : lowerType) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    const size_t semicolon = lowerType.find(';');
    const std::string mainType = (semicolon == std::string::npos ? lowerType : lowerType.substr(0, semicolon));
    if (mainType.find("multipart/") == 0) {
        std::string boundary;
        size_t search = 0;
        while (search < contentTypeValue.size()) {
            const size_t found = contentTypeValue.find("boundary", search);
            if (found == std::string::npos) break;
            const size_t equals = contentTypeValue.find('=', found + 8);
            if (equals != std::string::npos) {
                size_t valueStart = equals + 1;
                while (valueStart < contentTypeValue.size() && contentTypeValue[valueStart] == ' ') ++valueStart;
                if (valueStart < contentTypeValue.size() && contentTypeValue[valueStart] == '"') {
                    const size_t valueEnd = contentTypeValue.find('"', valueStart + 1);
                    if (valueEnd == std::string::npos) break;
                    boundary = contentTypeValue.substr(valueStart + 1, valueEnd - valueStart - 1);
                } else {
                    const size_t valueEnd = contentTypeValue.find(';', valueStart);
                    boundary = contentTypeValue.substr(valueStart, (valueEnd == std::string::npos ? contentTypeValue.size() : valueEnd) - valueStart);
                }
                if (!boundary.empty()) break;
            }
            search = found + 8;
        }
        if (boundary.empty()) return;
        const std::string dash = "--" + boundary;
        size_t position = body.find(dash);
        while (position != std::string::npos) {
            size_t partStart = position + dash.size();
            if (body.compare(partStart, 2, "--") == 0) break;
            while (partStart < body.size() && (body[partStart] == '\r' || body[partStart] == '\n')) ++partStart;
            size_t partFinish = body.find(dash, partStart);
            if (partFinish == std::string::npos) partFinish = body.size();
            std::string part = body.substr(partStart, partFinish - partStart);
            while (!part.empty() && (part.back() == '\r' || part.back() == '\n')) part.pop_back();
            const size_t headerEnd = part.find("\r\n\r\n");
            if (headerEnd != std::string::npos) {
                LB_MailWalkPart(part.substr(0, headerEnd + 2), part.substr(headerEnd + 4), depth + 1, message);
            }
            position = body.find(dash, partFinish);
        }
        return;
    }
    std::string transfer = LB_MailHeaderValueFull(headers, "Content-Transfer-Encoding");
    for (char& ch : transfer) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    std::string contentId = LB_MailHeaderValueFull(headers, "Content-ID");
    std::string disposition = LB_MailHeaderValueFull(headers, "Content-Disposition");
    std::string lowerDisposition = disposition;
    for (char& ch : lowerDisposition) ch = static_cast<char>(tolower(static_cast<unsigned char>(ch)));
    std::string nameSource = contentTypeValue;
    std::string fileName = LB_MailExtractParameter(contentTypeValue, "name");
    if (fileName.empty()) fileName = LB_MailExtractParameter(disposition, "filename");
    const bool isAttachment = lowerDisposition.find("attachment") != std::string::npos || !fileName.empty();
    if (mainType.find("text/") == 0 && !isAttachment) {
        std::string bytes = body;
        if (transfer.find("base64") != std::string::npos) {
            std::vector<unsigned char> decoded = LB_MailBase64Decode(body);
            bytes.assign(decoded.begin(), decoded.end());
        } else if (transfer.find("quoted-printable") != std::string::npos) {
            bytes = LB_MailQuotedPrintableDecode(body);
        }
        const std::string charset = LB_MailExtractParameter(contentTypeValue, "charset");
        const std::wstring text = LB_MailBytesToWide(bytes, charset.empty() ? "utf-8" : charset);
        if (mainType.find("text/html") != std::string::npos) { if (message.htmlBody.empty()) message.htmlBody = text; }
        else { if (message.textBody.empty()) message.textBody = text; }
        return;
    }
    if (isAttachment && !fileName.empty()) {
        LbMailAttachment attachment;
        std::string decodedName = fileName;
        if (decodedName.find("=?") != std::string::npos) attachment.name = LB_MailDecodeHeader(decodedName);
        else attachment.name = LB_MailBytesToWide(decodedName, "utf-8");
        std::string bytes = body;
        if (transfer.find("base64") != std::string::npos) {
            attachment.data = LB_MailBase64Decode(body);
        } else if (transfer.find("quoted-printable") != std::string::npos) {
            std::string decoded = LB_MailQuotedPrintableDecode(body);
            attachment.data.assign(decoded.begin(), decoded.end());
        } else {
            attachment.data.assign(body.begin(), body.end());
        }
        message.attachments.push_back(std::move(attachment));
    }
}

static void LB_MailParseMessage(const std::string& raw, LbMailMessage& message) {
    message = LbMailMessage();
    message.hasMessage = true;
    const size_t headerEnd = raw.find("\r\n\r\n");
    const std::string headers = headerEnd == std::string::npos ? raw : raw.substr(0, headerEnd + 2);
    const std::string body = headerEnd == std::string::npos ? "" : raw.substr(headerEnd + 4);
    message.subject = LB_MailDecodeHeader(LB_MailHeaderValueFull(headers, "Subject"));
    message.from = LB_MailDecodeHeader(LB_MailHeaderValueFull(headers, "From"));
    message.date = LB_MailDecodeHeader(LB_MailHeaderValueFull(headers, "Date"));
    LB_MailWalkPart(headers, body, 0, message);
    if (message.textBody.empty() && !message.htmlBody.empty()) message.textBody = message.htmlBody;
}

// ===== POP3 会话 =====
struct LbPop3Session : LbMailSession {
    LbMailMessage message;
    bool haveMessage = false;
};

static LbPop3Session g_lbPop3Session;

static bool LB_Pop3ReadLine(LbPop3Session& s, std::string& line) { return LB_MailReadLine(s, line); }

static bool LB_Pop3Command(LbPop3Session& s, const std::string& command, const std::string& argument, std::string& response) {
    const std::string wire = argument.empty() ? command + "\r\n" : command + " " + argument + "\r\n";
    if (!LB_MailSendAll(s, wire)) { s.error = L"发送失败：连接已中断。"; return false; }
    if (!LB_Pop3ReadLine(s, response)) { s.error = L"连接中断：服务端无响应。"; return false; }
    if (response.size() < 3 || response.compare(0, 3, "+OK") != 0) {
        s.error = L"POP3 服务端拒绝：" + LB_MailBytesToWide(response, "gbk");
        return false;
    }
    return true;
}

// ===== IMAP 会话 =====
struct LbImapSession : LbMailSession {
    int existsCount = -1;
    LbMailMessage message;
    bool haveMessage = false;
    bool folderSelected = false;
    int tagSequence = 0;
};

static LbImapSession g_lbImapSession;

static bool LB_ImapReadLine(LbImapSession& s, std::string& line) { return LB_MailReadLine(s, line); }

static bool LB_ImapCommand(LbImapSession& s, const std::string& command, std::string& response) {
    ++s.tagSequence;
    const std::string tag = "A" + std::to_string(s.tagSequence);
    if (!LB_MailSendAll(s, tag + " " + command + "\r\n")) { s.error = L"发送失败：连接已中断。"; return false; }
    response.clear();
    std::string line;
    for (;;) {
        if (!LB_ImapReadLine(s, line)) { s.error = L"连接中断：服务端无响应。"; return false; }
        // 行尾字面量标记 {N}：紧随 N 个原始字节
        const size_t open = line.rfind('{');
        if (!line.empty() && line.back() == '}' && open != std::string::npos) {
            unsigned long literalSize = 0;
            bool digits = open + 1 < line.size();
            for (size_t i = open + 1; digits && i + 1 < line.size(); ++i) {
                if (line[i] >= '0' && line[i] <= '9') literalSize = literalSize * 10 + (line[i] - '0');
                else digits = false;
            }
            response += line + "\r\n";
            if (digits && literalSize > 0) {
                unsigned long remaining = literalSize;
                char buffer[8192];
                while (remaining > 0) {
                    char ch = 0;
                    unsigned long take = (std::min)(remaining, static_cast<unsigned long>(sizeof(buffer)));
                    unsigned long index = 0;
                    while (index < take && LB_MailReadByte(s, ch)) { buffer[index++] = ch; }
                    if (index == 0) { s.error = L"连接中断：字面量读取不完整。"; return false; }
                    response.append(buffer, index);
                    remaining -= index;
                }
            }
            continue;
        }
        if (line[0] == '*' && line.find(" EXISTS") != std::string::npos) {
            const size_t space = line.rfind(' ', line.find(" EXISTS"));
            const size_t numBegin = space == std::string::npos ? 0 : line.rfind(' ', space - 1) + 1;
            if (space != std::string::npos) s.existsCount = atoi(line.c_str() + numBegin);
        }
        if (line.size() > tag.size() && line.compare(0, tag.size(), tag) == 0) {
            if (line.find(" OK", tag.size()) == tag.size()) return true;
            s.error = L"IMAP 服务端拒绝：" + LB_MailBytesToWide(line, "utf-8");
            return false;
        }
        response += line + "\r\n";
    }
}

// ===== POP3 命令 =====
bool POP3_连接(const wchar_t* host, int port, const wchar_t* username, const wchar_t* password, bool useSSL) {
    g_lbPop3Session.error.clear();
    g_lbPop3Session.connected = false;
    if (!LB_MailEnsureSockets()) { g_lbPop3Session.error = L"Winsock 初始化失败。"; return false; }
    ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; hints.ai_socktype = SOCK_STREAM; hints.ai_protocol = IPPROTO_TCP;
    ADDRINFOW* addresses = nullptr;
    const std::wstring service = std::to_wstring(port);
    if (GetAddrInfoW(host, service.c_str(), &hints, &addresses) != 0) { g_lbPop3Session.error = L"主机解析失败。"; return false; }
    SOCKET socketHandle = INVALID_SOCKET;
    for (auto address = addresses; address; address = address->ai_next) {
        socketHandle = socket(address->ai_family, address->ai_socktype, address->ai_protocol);
        if (socketHandle != INVALID_SOCKET && connect(socketHandle, address->ai_addr, static_cast<int>(address->ai_addrlen)) == 0) break;
        if (socketHandle != INVALID_SOCKET) closesocket(socketHandle);
        socketHandle = INVALID_SOCKET;
    }
    FreeAddrInfoW(addresses);
    if (socketHandle == INVALID_SOCKET) { g_lbPop3Session.error = L"连接 POP3 服务器失败。"; return false; }
    DWORD timeout = 30000;
    setsockopt(socketHandle, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    g_lbPop3Session.socket = socketHandle;
    g_lbPop3Session.ssl = useSSL;
    if (useSSL) {
        if (!LB_MailTlsHandshake(g_lbPop3Session, host)) { g_lbPop3Session.error = L"TLS 握手失败。"; closesocket(socketHandle); return false; }
    }
    std::string response;
    if (!LB_Pop3ReadLine(g_lbPop3Session, response)) { g_lbPop3Session.error = L"连接后未收到服务端问候。"; closesocket(socketHandle); return false; }
    if (response.compare(0, 3, "+OK") != 0) { g_lbPop3Session.error = L"POP3 服务端拒绝连接。"; closesocket(socketHandle); return false; }
    std::string user = LB_WideToUtf8(username), pass = LB_WideToUtf8(password);
    if (!LB_Pop3Command(g_lbPop3Session, "USER", user, response)) return false;
    if (!LB_Pop3Command(g_lbPop3Session, "PASS", pass, response)) return false;
    g_lbPop3Session.connected = true;
    return true;
}

void POP3_断开() {
    if (!g_lbPop3Session.connected) return;
    std::string response;
    LB_Pop3Command(g_lbPop3Session, "QUIT", "", response);
    g_lbPop3Session.connected = false;
    if (g_lbPop3Session.socket != INVALID_SOCKET) { closesocket(g_lbPop3Session.socket); g_lbPop3Session.socket = INVALID_SOCKET; }
}

bool POP3_是否已连接() { return g_lbPop3Session.connected; }

bool POP3_命令并读响应(const std::string& command, const std::string& argument, std::string& response) {
    return LB_Pop3Command(g_lbPop3Session, command, argument, response);
}

int POP3_取邮件数量() {
    std::string response;
    if (!LB_Pop3Command(g_lbPop3Session, "STAT", "", response)) return -1;
    // +OK n size
    const size_t space = response.find(' ', 4);
    if (space == std::string::npos) return -1;
    return atoi(response.c_str() + 4);
}

int POP3_取邮箱总大小() {
    std::string response;
    if (!LB_Pop3Command(g_lbPop3Session, "STAT", "", response)) return -1;
    const size_t space = response.find(' ', 4);
    if (space == std::string::npos) return -1;
    return atoi(response.c_str() + space + 1);
}

int POP3_取邮件大小(int index) {
    std::string response;
    if (!LB_Pop3Command(g_lbPop3Session, "LIST", std::to_string(index), response)) return -1;
    // +OK index size
    const size_t first = response.find(' ');
    const size_t second = first == std::string::npos ? std::string::npos : response.find(' ', first + 1);
    if (second == std::string::npos) return -1;
    return atoi(response.c_str() + second + 1);
}

bool POP3_接收邮件(int index) {
    std::string response;
    if (!LB_Pop3Command(g_lbPop3Session, "RETR", std::to_string(index), response)) return false;
    std::string raw = response + "\r\n";
    std::string line;
    while (LB_Pop3ReadLine(g_lbPop3Session, line)) {
        if (line == ".") break;
        if (line.size() >= 1 && line[0] == '.') line.erase(0, 1);
        raw += line + "\r\n";
    }
    g_lbPop3Session.message = LbMailMessage();
    g_lbPop3Session.haveMessage = true;
    LB_MailParseMessage(raw, g_lbPop3Session.message);
    return true;
}

bool POP3_删除邮件(int index) {
    std::string response;
    return LB_Pop3Command(g_lbPop3Session, "DELE", std::to_string(index), response);
}

bool POP3_复位删除() {
    std::string response;
    return LB_Pop3Command(g_lbPop3Session, "RSET", "", response);
}

const wchar_t* POP3_取主题() { return LB_ReturnText(g_lbPop3Session.message.subject); }
const wchar_t* POP3_取发件人() { return LB_ReturnText(g_lbPop3Session.message.from); }
const wchar_t* POP3_取日期() { return LB_ReturnText(g_lbPop3Session.message.date); }
const wchar_t* POP3_取正文文本() { return LB_ReturnText(g_lbPop3Session.message.textBody); }
const wchar_t* POP3_取网页正文() { return LB_ReturnText(g_lbPop3Session.message.htmlBody); }
int POP3_取附件个数() { return static_cast<int>(g_lbPop3Session.message.attachments.size()); }

const wchar_t* POP3_取附件名称(int index) {
    if (index < 0 || index >= static_cast<int>(g_lbPop3Session.message.attachments.size())) return LB_ReturnText(L"");
    return LB_ReturnText(g_lbPop3Session.message.attachments[index].name);
}

bool POP3_保存附件(int attachmentIndex, const wchar_t* path) {
    if (!g_lbPop3Session.message.hasMessage) return false;
    if (attachmentIndex < 0 || attachmentIndex >= static_cast<int>(g_lbPop3Session.message.attachments.size())) return false;
    HANDLE file = CreateFileW(path, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;
    unsigned long written = 0;
    const auto& data = g_lbPop3Session.message.attachments[attachmentIndex].data;
    WriteFile(file, data.data(), static_cast<unsigned long>(data.size()), &written, nullptr);
    CloseHandle(file);
    return true;
}

const wchar_t* POP3_取错误() { return LB_ReturnText(g_lbPop3Session.error); }

// ===== IMAP 命令 =====
bool IMAP_连接(const wchar_t* host, int port, const wchar_t* username, const wchar_t* password, bool useSSL) {
    g_lbImapSession.error.clear();
    g_lbImapSession.connected = false;
    g_lbImapSession.folderSelected = false;
    if (!LB_MailEnsureSockets()) { g_lbImapSession.error = L"Winsock 初始化失败。"; return false; }
    ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; hints.ai_socktype = SOCK_STREAM; hints.ai_protocol = IPPROTO_TCP;
    ADDRINFOW* addresses = nullptr;
    const std::wstring service = std::to_wstring(port);
    if (GetAddrInfoW(host, service.c_str(), &hints, &addresses) != 0) { g_lbImapSession.error = L"主机解析失败。"; return false; }
    SOCKET socketHandle = INVALID_SOCKET;
    for (auto address = addresses; address; address = address->ai_next) {
        socketHandle = socket(address->ai_family, address->ai_socktype, address->ai_protocol);
        if (socketHandle != INVALID_SOCKET && connect(socketHandle, address->ai_addr, static_cast<int>(address->ai_addrlen)) == 0) break;
        if (socketHandle != INVALID_SOCKET) closesocket(socketHandle);
        socketHandle = INVALID_SOCKET;
    }
    FreeAddrInfoW(addresses);
    if (socketHandle == INVALID_SOCKET) { g_lbImapSession.error = L"连接 IMAP 服务器失败。"; return false; }
    DWORD timeout = 30000;
    setsockopt(socketHandle, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    g_lbImapSession.socket = socketHandle;
    g_lbImapSession.ssl = useSSL;
    if (useSSL) {
        if (!LB_MailTlsHandshake(g_lbImapSession, host)) { g_lbImapSession.error = L"TLS 握手失败。"; closesocket(socketHandle); return false; }
    }
    std::string greeting;
    if (!LB_ImapReadLine(g_lbImapSession, greeting) || greeting.find("* OK") == std::string::npos) { g_lbImapSession.error = L"连接后未收到服务端问候。"; closesocket(socketHandle); return false; }
    std::string user = LB_WideToUtf8(username), pass = LB_WideToUtf8(password);
    std::string response;
    std::string quotedUser = "\"" + user + "\"";
    std::string quotedPass = "\"" + pass + "\"";
    std::string loginCommand = "LOGIN " + quotedUser + " " + quotedPass;
    if (!LB_ImapCommand(g_lbImapSession, loginCommand, response)) return false;
    g_lbImapSession.connected = true;
    return true;
}

void IMAP_断开() {
    if (!g_lbImapSession.connected) return;
    std::string response;
    LB_ImapCommand(g_lbImapSession, "LOGOUT", response);
    g_lbImapSession.connected = false;
    if (g_lbImapSession.socket != INVALID_SOCKET) { closesocket(g_lbImapSession.socket); g_lbImapSession.socket = INVALID_SOCKET; }
}

bool IMAP_是否已连接() { return g_lbImapSession.connected; }

bool IMAP_选择文件夹(const wchar_t* name) {
    if (!g_lbImapSession.connected) { g_lbImapSession.error = L"尚未连接 IMAP 服务器。"; return false; }
    std::string response;
    const std::wstring folder = LB_Wide(name);
    if (!LB_ImapCommand(g_lbImapSession, "SELECT \"" + std::string(folder.begin(), folder.end()) + "\"", response)) return false;
    g_lbImapSession.folderSelected = true;
    return true;
}

int IMAP_取邮件数量() {
    if (!g_lbImapSession.folderSelected) return -1;
    return g_lbImapSession.existsCount;
}

bool IMAP_接收邮件(int index) {
    if (!g_lbImapSession.folderSelected) { g_lbImapSession.error = L"请先选择文件夹。"; return false; }
    std::string response;
    if (!LB_ImapCommand(g_lbImapSession, "FETCH " + std::to_string(index) + " (BODY.PEEK[])", response)) return false;
    // 提取最大字面量（BODY[] 内容）
    size_t bestStart = std::string::npos, bestSize = 0;
    for (size_t position = 0; position < response.size();) {
        const size_t open = response.find('{', position);
        if (open == std::string::npos) break;
        const size_t close = response.find('}', open);
        if (close == std::string::npos) break;
        bool digits = close > open + 1;
        unsigned long size = 0;
        for (size_t i = open + 1; digits && i < close; ++i) {
            if (response[i] >= '0' && response[i] <= '9') size = size * 10 + (response[i] - '0');
            else digits = false;
        }
        if (digits && size > bestSize) { bestSize = size; bestStart = close + 1; }
        position = close + 1;
    }
    if (bestStart == std::string::npos || bestSize == 0) { g_lbImapSession.error = L"响应中未找到邮件内容。"; return false; }
    if (bestStart + bestSize > response.size()) { g_lbImapSession.error = L"响应中邮件内容不完整。"; return false; }
    g_lbImapSession.message = LbMailMessage();
    g_lbImapSession.haveMessage = true;
    LB_MailParseMessage(response.substr(bestStart, bestSize), g_lbImapSession.message);
    return true;
}

const wchar_t* IMAP_取主题() { return LB_ReturnText(g_lbImapSession.message.subject); }
const wchar_t* IMAP_取发件人() { return LB_ReturnText(g_lbImapSession.message.from); }
const wchar_t* IMAP_取日期() { return LB_ReturnText(g_lbImapSession.message.date); }
const wchar_t* IMAP_取正文文本() { return LB_ReturnText(g_lbImapSession.message.textBody); }
const wchar_t* IMAP_取网页正文() { return LB_ReturnText(g_lbImapSession.message.htmlBody); }
int IMAP_取附件个数() { return static_cast<int>(g_lbImapSession.message.attachments.size()); }

const wchar_t* IMAP_取附件名称(int index) {
    if (index < 0 || index >= static_cast<int>(g_lbImapSession.message.attachments.size())) return LB_ReturnText(L"");
    return LB_ReturnText(g_lbImapSession.message.attachments[index].name);
}

bool IMAP_保存附件(int index, int attachmentIndex, const wchar_t* path) {
    if (!g_lbImapSession.message.hasMessage) return false;
    if (attachmentIndex < 0 || attachmentIndex >= static_cast<int>(g_lbImapSession.message.attachments.size())) return false;
    HANDLE file = CreateFileW(path, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;
    unsigned long written = 0;
    const auto& data = g_lbImapSession.message.attachments[attachmentIndex].data;
    WriteFile(file, data.data(), static_cast<unsigned long>(data.size()), &written, nullptr);
    CloseHandle(file);
    return true;
}

const wchar_t* IMAP_取错误() { return LB_ReturnText(g_lbImapSession.error); }
#endif
`;
