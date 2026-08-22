import { InstalledModule } from '../modules/types';
import { CDP_CLIENT_MODULE_ID } from '../modules/cdpClientModule';

export function generateCdpClientRuntime(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === CDP_CLIENT_MODULE_ID)) return '';
  return CDP_JSON_RUNTIME + '\n' + CDP_CLIENT_RUNTIME;
}

export function generateCdpClientWindowMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === CDP_CLIENT_MODULE_ID)) return '';
  return CDP_CLIENT_WINDOW_METHODS;
}

export function generateCdpClientGlobalMethods(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === CDP_CLIENT_MODULE_ID)) return '';
  return CDP_CLIENT_WINDOW_METHODS
    .replaceAll('cdpClientRuntime_', 'g_cdpClientRuntime')
    .replaceAll('cdpClientReturnText_', 'g_cdpClientReturnText')
    .replace(/^    /gmu, 'static ');
}

export function generateCdpClientGlobalMethodDeclarations(enabledModules: InstalledModule[]): string {
  if (!enabledModules.some(module => module.manifest.id === CDP_CLIENT_MODULE_ID)) return '';
  return CDP_CLIENT_WINDOW_METHODS
    .trim()
    .split(/\r?\n/u)
    .map(line => {
      const normalized = line.trim();
      const signatureEnd = normalized.indexOf(' {');
      if (signatureEnd < 0) throw new Error(`CDP 客户端包装方法缺少函数体：${normalized}`);
      return `static ${normalized.slice(0, signatureEnd)};`;
    })
    .join('\n');
}

// 内嵌 JSON 内核：CDP 模块自包含，不依赖 lingbuilder.data.json 模块的注入顺序。
const CDP_JSON_RUNTIME = String.raw`
namespace LingCdpJson {
struct Value;
using ValuePtr = std::shared_ptr<Value>;
struct Value {
    enum class Kind { Null, Bool, Number, String, Array, Object } kind = Kind::Null;
    bool boolean = false;
    double number = 0;
    std::wstring text;
    std::vector<ValuePtr> array;
    std::vector<std::pair<std::wstring, ValuePtr>> object;
    const ValuePtr Find(const std::wstring& key) const {
        for (const auto& entry : object) if (entry.first == key) return entry.second;
        return nullptr;
    }
};

inline bool WideToUtf8(const std::wstring& value, std::string& output) {
    output.clear();
    if (value.empty()) return true;
    const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (length <= 0) return false;
    output.resize(static_cast<size_t>(length));
    return WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), length, nullptr, nullptr) == length;
}

inline std::wstring Utf8ToWide(const char* data, size_t size) {
    if (!data || size == 0) return L"";
    if (size > static_cast<size_t>(INT_MAX)) return L"";
    const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, data, static_cast<int>(size), nullptr, 0);
    if (length <= 0) return L"";
    std::wstring result(static_cast<size_t>(length), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, data, static_cast<int>(size), result.data(), length);
    return result;
}

inline void AppendUtf8(unsigned int codePoint, std::string& out) {
    if (codePoint < 0x80) out.push_back(static_cast<char>(codePoint));
    else if (codePoint < 0x800) {
        out.push_back(static_cast<char>(0xC0 | (codePoint >> 6)));
        out.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
    } else if (codePoint < 0x10000) {
        out.push_back(static_cast<char>(0xE0 | (codePoint >> 12)));
        out.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
    } else {
        out.push_back(static_cast<char>(0xF0 | (codePoint >> 18)));
        out.push_back(static_cast<char>(0x80 | ((codePoint >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
    }
}

class Parser {
public:
    static ValuePtr Parse(const char* data, size_t size, std::wstring& error) {
        Parser parser(data, size);
        parser.SkipWhitespace();
        ValuePtr value = parser.ParseValue(error, 0);
        if (value) {
            parser.SkipWhitespace();
            if (parser.pos_ != parser.size_) { error = L"JSON 末尾存在多余内容。"; return nullptr; }
        }
        return value;
    }

private:
    Parser(const char* data, size_t size) : data_(data), size_(size), pos_(0) {}
    const char* data_;
    size_t size_;
    size_t pos_;

    void SkipWhitespace() {
        while (pos_ < size_ && (data_[pos_] == ' ' || data_[pos_] == '\t' || data_[pos_] == '\n' || data_[pos_] == '\r')) ++pos_;
    }
    bool Peek(char ch) const { return pos_ < size_ && data_[pos_] == ch; }
    bool Consume(char ch) { if (!Peek(ch)) return false; ++pos_; return true; }
    bool Match(const char* literal) {
        const size_t length = std::strlen(literal);
        if (pos_ + length > size_ || std::memcmp(data_ + pos_, literal, length) != 0) return false;
        pos_ += length;
        return true;
    }
    unsigned int Hex4(size_t offset) const {
        unsigned int value = 0;
        for (size_t index = 0; index < 4; ++index) {
            const char ch = data_[offset + index];
            value <<= 4;
            if (ch >= '0' && ch <= '9') value |= static_cast<unsigned int>(ch - '0');
            else if (ch >= 'a' && ch <= 'f') value |= static_cast<unsigned int>(ch - 'a' + 10);
            else if (ch >= 'A' && ch <= 'F') value |= static_cast<unsigned int>(ch - 'A' + 10);
            else return 0xFFFFFFFFu;
        }
        return value;
    }

    ValuePtr ParseValue(std::wstring& error, int depth) {
        if (depth > 128) { error = L"JSON 嵌套超过 128 层。"; return nullptr; }
        SkipWhitespace();
        if (pos_ >= size_) { error = L"JSON 意外结束。"; return nullptr; }
        const char ch = data_[pos_];
        if (ch == '{') return ParseObject(error, depth);
        if (ch == '[') return ParseArray(error, depth);
        if (ch == '"') {
            auto value = std::make_shared<Value>();
            value->kind = Value::Kind::String;
            if (!ParseString(value->text, error)) return nullptr;
            return value;
        }
        if (ch == 't') {
            if (!Match("true")) { error = L"JSON 字面量无效。"; return nullptr; }
            auto value = std::make_shared<Value>(); value->kind = Value::Kind::Bool; value->boolean = true; return value;
        }
        if (ch == 'f') {
            if (!Match("false")) { error = L"JSON 字面量无效。"; return nullptr; }
            auto value = std::make_shared<Value>(); value->kind = Value::Kind::Bool; value->boolean = false; return value;
        }
        if (ch == 'n') {
            if (!Match("null")) { error = L"JSON 字面量无效。"; return nullptr; }
            return std::make_shared<Value>();
        }
        return ParseNumber(error);
    }

    ValuePtr ParseObject(std::wstring& error, int depth) {
        if (!Consume('{')) { error = L"JSON 对象格式无效。"; return nullptr; }
        auto value = std::make_shared<Value>();
        value->kind = Value::Kind::Object;
        SkipWhitespace();
        if (Consume('}')) return value;
        while (true) {
            SkipWhitespace();
            std::wstring key;
            if (!ParseString(key, error)) return nullptr;
            SkipWhitespace();
            if (!Consume(':')) { error = L"JSON 对象缺少冒号。"; return nullptr; }
            ValuePtr child = ParseValue(error, depth + 1);
            if (!child) return nullptr;
            value->object.emplace_back(std::move(key), std::move(child));
            SkipWhitespace();
            if (Consume(',')) continue;
            if (Consume('}')) return value;
            error = L"JSON 对象缺少逗号或右花括号。";
            return nullptr;
        }
    }

    ValuePtr ParseArray(std::wstring& error, int depth) {
        if (!Consume('[')) { error = L"JSON 数组格式无效。"; return nullptr; }
        auto value = std::make_shared<Value>();
        value->kind = Value::Kind::Array;
        SkipWhitespace();
        if (Consume(']')) return value;
        while (true) {
            ValuePtr child = ParseValue(error, depth + 1);
            if (!child) return nullptr;
            value->array.push_back(std::move(child));
            SkipWhitespace();
            if (Consume(',')) continue;
            if (Consume(']')) return value;
            error = L"JSON 数组缺少逗号或右方括号。";
            return nullptr;
        }
    }

    bool ParseString(std::wstring& out, std::wstring& error) {
        if (!Consume('"')) { error = L"JSON 字符串必须以引号开始。"; return false; }
        std::string bytes;
        while (pos_ < size_) {
            const char ch = data_[pos_];
            if (ch == '"') {
                ++pos_;
                out = Utf8ToWide(bytes.data(), bytes.size());
                return true;
            }
            if (ch == '\\') {
                ++pos_;
                if (pos_ >= size_) break;
                const char escaped = data_[pos_++];
                switch (escaped) {
                    case '"': bytes.push_back('"'); break;
                    case '\\': bytes.push_back('\\'); break;
                    case '/': bytes.push_back('/'); break;
                    case 'b': bytes.push_back('\b'); break;
                    case 'f': bytes.push_back('\f'); break;
                    case 'n': bytes.push_back('\n'); break;
                    case 'r': bytes.push_back('\r'); break;
                    case 't': bytes.push_back('\t'); break;
                    case 'u': {
                        if (pos_ + 4 > size_) { error = L"JSON \\u 转义不完整。"; return false; }
                        unsigned int codePoint = Hex4(pos_);
                        if (codePoint == 0xFFFFFFFFu) { error = L"JSON \\u 转义包含非法十六进制。"; return false; }
                        pos_ += 4;
                        if (codePoint >= 0xD800 && codePoint <= 0xDBFF && pos_ + 6 <= size_ && data_[pos_] == '\\' && data_[pos_ + 1] == 'u') {
                            const unsigned int low = Hex4(pos_ + 2);
                            if (low >= 0xDC00 && low <= 0xDFFF) {
                                codePoint = 0x10000 + ((codePoint - 0xD800) << 10) + (low - 0xDC00);
                                pos_ += 6;
                            }
                        }
                        AppendUtf8(codePoint, bytes);
                        break;
                    }
                    default: error = L"JSON 字符串包含非法转义。"; return false;
                }
            } else {
                bytes.push_back(ch);
                ++pos_;
            }
        }
        error = L"JSON 字符串未闭合。";
        return false;
    }

    ValuePtr ParseNumber(std::wstring& error) {
        const size_t start = pos_;
        if (Peek('-')) ++pos_;
        while (pos_ < size_ && ((data_[pos_] >= '0' && data_[pos_] <= '9') || data_[pos_] == '.' ||
               data_[pos_] == 'e' || data_[pos_] == 'E' || data_[pos_] == '+' || data_[pos_] == '-')) ++pos_;
        if (pos_ == start) { error = L"JSON 数值格式无效。"; return nullptr; }
        const std::string literal(data_ + start, pos_ - start);
        char* end = nullptr;
        const double number = std::strtod(literal.c_str(), &end);
        if (end != literal.c_str() + literal.size()) { error = L"JSON 数值解析失败。"; return nullptr; }
        auto value = std::make_shared<Value>();
        value->kind = Value::Kind::Number;
        value->number = number;
        return value;
    }
};

inline std::wstring Escape(const std::wstring& value) {
    std::wstring out = L"\"";
    for (const wchar_t ch : value) {
        switch (ch) {
            case L'"': out += L"\\\""; break;
            case L'\\': out += L"\\\\"; break;
            case L'\b': out += L"\\b"; break;
            case L'\f': out += L"\\f"; break;
            case L'\n': out += L"\\n"; break;
            case L'\r': out += L"\\r"; break;
            case L'\t': out += L"\\t"; break;
            default:
                if (ch < 0x20) {
                    wchar_t buffer[8] = {};
                    swprintf_s(buffer, 8, L"\\u%04x", static_cast<unsigned>(ch));
                    out += buffer;
                } else out += ch;
        }
    }
    out += L'"';
    return out;
}

inline std::wstring NumberText(double value) {
    if (value == std::floor(value) && std::fabs(value) < 1e15) return std::to_wstring(static_cast<long long>(value));
    wchar_t buffer[64] = {};
    swprintf_s(buffer, 64, L"%.17g", value);
    return buffer;
}

inline std::wstring Serialize(const ValuePtr& value) {
    if (!value) return L"null";
    switch (value->kind) {
        case Value::Kind::Null: return L"null";
        case Value::Kind::Bool: return value->boolean ? L"true" : L"false";
        case Value::Kind::Number: return NumberText(value->number);
        case Value::Kind::String: return Escape(value->text);
        case Value::Kind::Array: {
            std::wstring out = L"[";
            for (size_t index = 0; index < value->array.size(); ++index) {
                if (index) out += L",";
                out += Serialize(value->array[index]);
            }
            out += L"]";
            return out;
        }
        case Value::Kind::Object: {
            std::wstring out = L"{";
            for (size_t index = 0; index < value->object.size(); ++index) {
                if (index) out += L",";
                out += Escape(value->object[index].first) + L":" + Serialize(value->object[index].second);
            }
            out += L"}";
            return out;
        }
    }
    return L"null";
}
}
`;

const CDP_CLIENT_RUNTIME = String.raw`
class LingCdpRuntime {
public:
    using NotifyEvent = std::function<bool(long long)>;
    using DispatchHandler = std::function<void(const wchar_t*)>;

    explicit LingCdpRuntime(NotifyEvent notify) : notify_(std::move(notify)) {
        try {
            watchdog_ = std::thread([this]() { WatchdogLoop(); });
        } catch (...) {
            // 看门狗线程创建失败时退化为无独立超时（仍保留断线兜底）。
        }
    }
    ~LingCdpRuntime() { Shutdown(); }

    // ===== 连接管理（多开核心：每个连接独立 WebSocket、独立 CDP id 与回调表） =====
    long long Connect(const wchar_t* httpAddress, const wchar_t* readyHandler, bool allowRemote) {
        const std::wstring address = httpAddress ? httpAddress : L"";
        if (address.rfind(L"http://", 0) != 0 && address.rfind(L"https://", 0) != 0)
            return Fail(L"CDP 调试地址必须使用 http:// 或 https://，例如 http://127.0.0.1:9222。");
        std::wstring host;
        if (!CrackHost(address, host)) return Fail(L"CDP 无法解析调试地址。");
        if (!allowRemote && !IsLoopbackHost(host))
            return Fail(L"CDP 默认只允许连接本机 127.0.0.1、localhost 或 ::1；连接远程地址请使用 CDP_连接远程 并确认目标与链路安全。");
        auto connection = std::make_shared<Connection>();
        connection->id = nextConnectionId_.fetch_add(1);
        connection->httpBase = TrimTrailingSlash(address);
        connection->connectHandler = readyHandler ? readyHandler : L"";
        connection->allowRemote = allowRemote;
        { std::lock_guard<std::mutex> lock(connection->mutex); connection->state = L"连接中"; }
        { std::lock_guard<std::mutex> lock(connectionsMutex_); connections_[connection->id] = connection; }
        connection->workerRunning.store(true);
        try {
            connection->worker = std::thread([this, connection]() { ConnectWorker(connection); });
        } catch (...) {
            connection->workerRunning.store(false);
            { std::lock_guard<std::mutex> lock(connectionsMutex_); connections_.erase(connection->id); }
            return Fail(L"CDP 无法创建后台连接线程。");
        }
        return connection->id;
    }

    bool Disconnect(long long connectionId) {
        std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        CloseConnection(connection, true);
        ReleaseConnectionPages(connectionId, false);
        { std::lock_guard<std::mutex> lock(connectionsMutex_); connections_.erase(connectionId); }
        return true;
    }

    int ConnectionCount() {
        std::lock_guard<std::mutex> lock(connectionsMutex_);
        return static_cast<int>(connections_.size());
    }

    bool IsConnected(long long connectionId) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        return connection && connection->connected.load();
    }

    std::wstring ConnectionState(long long connectionId) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return L"无效连接";
        std::lock_guard<std::mutex> lock(connection->mutex);
        return connection->state;
    }

    std::wstring BrowserVersion(long long connectionId) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return L"";
        std::lock_guard<std::mutex> lock(connection->mutex);
        return connection->browserVersion;
    }

    bool BindConnectionHandler(long long connectionId, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 连接事件处理器不能为空。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->eventHandler = value;
        return true;
    }

    // ===== 页面会话 =====
    long long AttachPage(long long connectionId, const wchar_t* url, const wchar_t* readyHandler) {
        std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) { Fail(L"CDP 连接 ID 无效。"); return 0; }
        if (!connection->connected.load()) { Fail(L"CDP 连接尚未就绪，无法附加页面。"); return 0; }
        const std::wstring address = url ? url : L"";
        if (address.empty()) { Fail(L"CDP 附加页面网址不能为空。"); return 0; }
        const std::wstring handler = readyHandler ? readyHandler : L"";
        const std::shared_ptr<PageSession> page = CreatePage(connectionId, address, handler);
        std::thread([this, connection, page, address]() { AttachWorker(connection, page, address); }).detach();
        return page->id;
    }

    long long NewPage(long long connectionId, const wchar_t* url, const wchar_t* readyHandler) {
        std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) { Fail(L"CDP 连接 ID 无效。"); return 0; }
        if (!connection->connected.load()) { Fail(L"CDP 连接尚未就绪，无法新建页面。"); return 0; }
        const std::wstring address = url ? url : L"";
        if (address.empty()) { Fail(L"CDP 新建页面网址不能为空。"); return 0; }
        const std::shared_ptr<PageSession> page = CreatePage(connectionId, address, readyHandler ? readyHandler : L"");
        // 先创建 about:blank，附加会话并启用域之后再导航到目标网址并等待加载完成，避免 createTarget(url) 的中间导航阶段被误判为就绪。
        if (!SendCommand(connection, L"Target.createTarget", L"{\"url\":\"about:blank\"}", PendingKind::CreateTarget, page->readyHandler, std::to_wstring(page->id), L"")) {
            ReleasePage(page->id, false);
            return 0;
        }
        return page->id;
    }

    bool ClosePage(long long pageId) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (connection && connection->connected.load() && !page->targetId.empty())
            SendCommand(connection, L"Target.closeTarget", L"{\"targetId\":" + LingCdpJson::Escape(page->targetId) + L"}", PendingKind::Internal, L"", L"", L"");
        ReleasePage(pageId, false);
        return true;
    }

    bool ActivatePage(long long pageId) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Target.activateTarget", L"{\"targetId\":" + LingCdpJson::Escape(page->targetId) + L"}", PendingKind::Internal, L"", L"", L"");
    }

    int PageCount(long long connectionId) {
        std::lock_guard<std::mutex> lock(pagesMutex_);
        int count = 0;
        for (const auto& pair : pages_) if (pair.second->connectionId == connectionId) ++count;
        return count;
    }

    std::wstring PageUrl(long long pageId) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return L"";
        std::lock_guard<std::mutex> lock(page->mutex);
        return page->url;
    }

    bool BindPageHandler(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 页面事件处理器不能为空。");
        std::lock_guard<std::mutex> lock(page->mutex);
        page->eventHandler = value;
        return true;
    }

    // ===== 导航 =====
    bool Navigate(long long pageId, const wchar_t* url, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring address = url ? url : L"";
        if (address.empty()) return Fail(L"CDP 打开网址不能为空。");
        { std::lock_guard<std::mutex> lock(page->mutex); page->url = address; }
        const std::wstring params = L"{\"url\":" + LingCdpJson::Escape(address) + L"}";
        return SendCommand(connection, L"Page.navigate", params, PendingKind::NavigateWait, handler ? handler : L"", std::to_wstring(page->id), page->sessionId);
    }

    bool Reload(long long pageId, const wchar_t* handler) {
        return SimpleNavigation(pageId, L"Page.reload", handler);
    }
    bool GoBack(long long pageId, const wchar_t* handler) {
        return HistoryNavigation(pageId, -1, handler);
    }
    bool GoForward(long long pageId, const wchar_t* handler) {
        return HistoryNavigation(pageId, 1, handler);
    }
    bool StopLoad(long long pageId) {
        return SimpleNavigation(pageId, L"Page.stopLoading", L"");
    }

    // ===== 脚本执行 =====
    bool Evaluate(long long pageId, const wchar_t* expression, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring code = expression ? expression : L"";
        if (code.empty()) return Fail(L"CDP 脚本代码不能为空。");
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(code) + L",\"awaitPromise\":true,\"returnByValue\":true}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::TextResult, handler ? handler : L"", std::to_wstring(page->id), page->sessionId);
    }

    bool GetTitle(long long pageId, const wchar_t* handler) {
        return Evaluate(pageId, L"document.title", handler);
    }
    bool GetHtml(long long pageId, const wchar_t* handler) {
        return Evaluate(pageId, L"document.documentElement.outerHTML", handler);
    }

    // ===== 元素操作 =====
    long long QueryElement(long long pageId, const wchar_t* selector) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) { Fail(L"CDP 页面 ID 无效。"); return 0; }
        const std::wstring value = selector ? selector : L"";
        if (value.empty()) { Fail(L"CDP 元素选择器不能为空。"); return 0; }
        const long long elementId = nextElementId_.fetch_add(1);
        std::lock_guard<std::mutex> lock(elementsMutex_);
        elements_[elementId] = { pageId, value };
        return elementId;
    }

    bool ClickElement(long long elementId, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::shared_ptr<PageSession> page = FindPage(element.first);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second) +
            L");if(!e)return null;e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return JSON.stringify([r.left+r.width/2,r.top+r.height/2]);})()";
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(script) + L",\"returnByValue\":true}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::ElementClick, handler ? handler : L"",
                           std::to_wstring(page->id), page->sessionId);
    }

    bool InputTextElement(long long elementId, const wchar_t* text, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second) + L");if(!e)return null;e.focus();return 'ok';})()";
        const std::shared_ptr<PageSession> page = FindPage(element.first);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(script) + L",\"returnByValue\":true}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::FocusThenType, handler ? handler : L"",
                           std::to_wstring(page->id) + L"\t" + (text ? text : L""), page->sessionId);
    }

    bool GetElementText(long long elementId, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second) + L");return e?e.innerText:null;})()";
        return Evaluate(element.first, script.c_str(), handler);
    }

    bool GetElementAttribute(long long elementId, const wchar_t* name, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second) +
            L");return e?e.getAttribute(" + LingCdpJson::Escape(name ? name : L"") + L"):null;})()";
        return Evaluate(element.first, script.c_str(), handler);
    }

    bool CountElements(long long pageId, const wchar_t* selector, const wchar_t* handler) {
        const std::wstring script = L"document.querySelectorAll(" + LingCdpJson::Escape(selector ? selector : L"") + L").length";
        return Evaluate(pageId, script.c_str(), handler);
    }

    // ===== 坐标级输入 =====
    bool MouseMove(long long pageId, int x, int y) {
        return SendMouseEvent(pageId, L"mouseMoved", x, y, L"none", 0);
    }
    bool MouseClick(long long pageId, int x, int y, int button, int count) {
        if (button < 0 || button > 2) return Fail(L"CDP 鼠标按钮必须为 0（左键）、1（中键）或 2（右键）。");
        if (count < 1 || count > 3) return Fail(L"CDP 鼠标点击次数必须在 1 到 3 之间。");
        return SendMouseEvent(pageId, L"mousePressed", x, y, ButtonName(button), count) &&
               SendMouseEvent(pageId, L"mouseReleased", x, y, ButtonName(button), count);
    }
    bool MouseDown(long long pageId, int x, int y, int button) {
        if (button < 0 || button > 2) return Fail(L"CDP 鼠标按钮必须为 0（左键）、1（中键）或 2（右键）。");
        return SendMouseEvent(pageId, L"mousePressed", x, y, ButtonName(button), 1);
    }
    bool MouseUp(long long pageId, int x, int y, int button) {
        if (button < 0 || button > 2) return Fail(L"CDP 鼠标按钮必须为 0（左键）、1（中键）或 2（右键）。");
        return SendMouseEvent(pageId, L"mouseReleased", x, y, ButtonName(button), 1);
    }
    bool MouseWheel(long long pageId, int x, int y, int deltaX, int deltaY) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring params = L"{\"type\":\"mouseWheel\",\"x\":" + std::to_wstring(x) + L",\"y\":" + std::to_wstring(y) +
            L",\"deltaX\":" + std::to_wstring(deltaX) + L",\"deltaY\":" + std::to_wstring(deltaY) + L"}";
        return SendCommand(connection, L"Input.dispatchMouseEvent", params, PendingKind::Internal, L"", L"", page->sessionId);
    }

    bool PressKey(long long pageId, const wchar_t* key) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring name = key ? key : L"";
        if (name.empty()) return Fail(L"CDP 按键名称不能为空。");
        bool ok = SendKeyEvent(connection, page->sessionId, L"keyDown", name, 0);
        if (ok && name.size() == 1) ok = SendKeyEvent(connection, page->sessionId, L"char", name, 0);
        if (ok) ok = SendKeyEvent(connection, page->sessionId, L"keyUp", name, 0);
        return ok;
    }

    bool ComboKey(long long pageId, const wchar_t* modifiers, const wchar_t* key) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring mainKey = key ? key : L"";
        if (mainKey.empty()) return Fail(L"CDP 组合键主键不能为空。");
        std::vector<std::wstring> modifierList = SplitModifiers(modifiers ? modifiers : L"");
        if (modifierList.empty()) return Fail(L"CDP 组合键修饰键必须包含 Ctrl、Shift、Alt 或 Meta。");
        int mask = 0;
        for (const std::wstring& modifier : modifierList) mask |= ModifierMask(modifier);
        bool ok = true;
        for (const std::wstring& modifier : modifierList)
            ok = ok && SendKeyEvent(connection, page->sessionId, L"keyDown", modifier, 0);
        ok = ok && SendKeyEvent(connection, page->sessionId, L"keyDown", mainKey, mask);
        if (ok && mainKey.size() == 1) ok = SendKeyEvent(connection, page->sessionId, L"char", mainKey, mask);
        ok = ok && SendKeyEvent(connection, page->sessionId, L"keyUp", mainKey, mask);
        for (size_t index = modifierList.size(); index > 0; --index)
            ok = ok && SendKeyEvent(connection, page->sessionId, L"keyUp", modifierList[index - 1], 0);
        return ok;
    }

    bool InsertText(long long pageId, const wchar_t* text) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Input.insertText", L"{\"text\":" + LingCdpJson::Escape(text ? text : L"") + L"}",
                           PendingKind::Internal, L"", L"", page->sessionId);
    }

    // 逐字符发送 char 键事件；比 insertTextInput 更接近真实键盘，且在 headless 环境可靠更新输入框的值。
    bool TypeTextIntoPage(long long pageId, const std::wstring& text) {
        if (text.size() > 4096) return Fail(L"CDP 单次元素文本输入不能超过 4096 个字符。");
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        for (const wchar_t character : text) {
            const std::wstring single(1, character);
            if (!SendKeyEvent(connection, page->sessionId, L"char", single, 0)) return false;
        }
        return true;
    }

    // ===== 网络与 Cookie =====
    bool BindNetworkHandler(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 网络事件处理器不能为空。");
        std::lock_guard<std::mutex> lock(page->mutex);
        page->networkHandler = value;
        return true;
    }

    bool GetResponseBody(long long pageId, const wchar_t* requestId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring value = requestId ? requestId : L"";
        if (value.empty()) return Fail(L"CDP 请求编号不能为空。");
        return SendCommand(connection, L"Network.getResponseBody", L"{\"requestId\":" + LingCdpJson::Escape(value) + L"}",
                           PendingKind::TextResult, handler ? handler : L"", std::to_wstring(page->id), page->sessionId);
    }

    bool GetCookies(long long connectionId, const wchar_t* url, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (!connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Network.getCookies", L"{\"urls\":[" + LingCdpJson::Escape(url ? url : L"") + L"]}",
                           PendingKind::TextResult, handler ? handler : L"", L"", L"");
    }

    bool SetCookie(long long connectionId, const wchar_t* name, const wchar_t* value, const wchar_t* url, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (!connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring cookieName = name ? name : L"";
        if (cookieName.empty()) return Fail(L"CDP Cookie 名称不能为空。");
        const std::wstring params = L"{\"name\":" + LingCdpJson::Escape(cookieName) + L",\"value\":" +
            LingCdpJson::Escape(value ? value : L"") + L",\"url\":" + LingCdpJson::Escape(url ? url : L"") + L"}";
        return SendCommand(connection, L"Network.setCookie", params, PendingKind::SuccessOnly, handler ? handler : L"", L"", L"");
    }

    bool DeleteCookies(long long connectionId, const wchar_t* name, const wchar_t* url, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (!connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring cookieName = name ? name : L"";
        if (cookieName.empty()) return Fail(L"CDP Cookie 名称不能为空。");
        const std::wstring params = L"{\"name\":" + LingCdpJson::Escape(cookieName) + L",\"url\":" + LingCdpJson::Escape(url ? url : L"") + L"}";
        return SendCommand(connection, L"Network.deleteCookies", params, PendingKind::SuccessOnly, handler ? handler : L"", L"", L"");
    }

    bool ClearCache(long long connectionId, const wchar_t* handler) {
        return BrowserNetworkCommand(connectionId, L"Network.clearBrowserCache", handler);
    }
    bool ClearCookies(long long connectionId, const wchar_t* handler) {
        return BrowserNetworkCommand(connectionId, L"Network.clearBrowserCookies", handler);
    }

    // ===== 控制台与异常 =====
    bool BindConsoleHandler(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 控制台事件处理器不能为空。");
        std::lock_guard<std::mutex> lock(page->mutex);
        page->consoleHandler = value;
        return true;
    }

    bool BindExceptionHandler(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 页面异常处理器不能为空。");
        std::lock_guard<std::mutex> lock(page->mutex);
        page->exceptionHandler = value;
        return true;
    }

    // ===== 截图与 PDF =====
    bool Screenshot(long long pageId, const wchar_t* path, bool fullPage, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring filePath = path ? path : L"";
        if (filePath.empty()) return Fail(L"CDP 截图文件路径不能为空。");
        std::wstring params = L"{\"format\":\"png\"";
        if (fullPage) params += L",\"captureBeyondViewport\":true";
        params += L"}";
        return SendCommand(connection, L"Page.captureScreenshot", params, PendingKind::WriteBase64File, handler ? handler : L"", filePath, page->sessionId);
    }

    bool PrintPdf(long long pageId, const wchar_t* path, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring filePath = path ? path : L"";
        if (filePath.empty()) return Fail(L"CDP PDF 文件路径不能为空。");
        return SendCommand(connection, L"Page.printToPDF", L"{\"printBackground\":true}", PendingKind::WriteBase64File, handler ? handler : L"", filePath, page->sessionId);
    }

    // ===== 阶段 2：命令超时 =====
    bool SetCommandTimeout(long long connectionId, int timeoutMs) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (timeoutMs < 1000 || timeoutMs > 600000) return Fail(L"CDP 命令超时必须在 1000 到 600000 毫秒之间。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->commandTimeoutMs = timeoutMs;
        return true;
    }

    // ===== 阶段 2：Fetch 域拦截 =====
    bool InterceptStart(long long pageId, const wchar_t* urlPattern, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring pattern = urlPattern && urlPattern[0] ? urlPattern : L"*";
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 拦截处理器不能为空；拦截期间浏览器网络会挂起，处理器内必须尽快放行、终止或模拟响应。");
        {
            std::lock_guard<std::mutex> lock(page->mutex);
            page->interceptHandler = value;
        }
        return SendCommand(connection, L"Fetch.enable", L"{\"patterns\":[{\"urlPattern\":" + LingCdpJson::Escape(pattern) + L"}],\"handleAuthRequests\":true}",
                           PendingKind::Internal, L"", L"", page->sessionId);
    }

    bool InterceptStop(long long pageId) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        {
            std::lock_guard<std::mutex> lock(page->mutex);
            page->interceptHandler.clear();
        }
        return SendCommand(connection, L"Fetch.disable", L"{}", PendingKind::Internal, L"", L"", page->sessionId);
    }

    bool InterceptContinue(long long interceptId) {
        std::shared_ptr<InterceptRef> reference = TakeIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效或已被处理。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Fetch.continueRequest", L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L"}",
                           PendingKind::Internal, L"", L"", L"");
    }

    bool InterceptModify(long long interceptId, const wchar_t* url, const wchar_t* headersJson) {
        std::shared_ptr<InterceptRef> reference = TakeIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效或已被处理。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring targetUrl = url ? url : L"";
        const std::wstring headers = headersJson ? headersJson : L"";
        if (!targetUrl.empty() && (targetUrl.rfind(L"http://", 0) != 0 && targetUrl.rfind(L"https://", 0) != 0))
            return Fail(L"CDP 拦截改写网址必须使用 http:// 或 https://。");
        std::wstring parsedHeaders;
        if (!headers.empty() && !ParseHeaderArray(headers, parsedHeaders))
            return Fail(L"CDP 拦截改写头必须是 JSON 数组，例如 [{\"name\":\"X-Test\",\"value\":\"1\"}]。");
        std::wstring params = L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId);
        if (!targetUrl.empty()) params += L",\"url\":" + LingCdpJson::Escape(targetUrl);
        if (!parsedHeaders.empty()) params += L",\"headers\":" + parsedHeaders;
        params += L"}";
        return SendCommand(connection, L"Fetch.continueRequest", params, PendingKind::Internal, L"", L"", L"");
    }

    bool InterceptFulfill(long long interceptId, int status, const wchar_t* headersJson, const wchar_t* body) {
        std::shared_ptr<InterceptRef> reference = TakeIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效或已被处理。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        if (status < 100 || status > 599) return Fail(L"CDP 模拟响应状态码必须在 100 到 599 之间。");
        const std::wstring headers = headersJson ? headersJson : L"";
        std::wstring parsedHeaders;
        if (!headers.empty() && !ParseHeaderArray(headers, parsedHeaders))
            return Fail(L"CDP 模拟响应头必须是 JSON 数组，例如 [{\"name\":\"Content-Type\",\"value\":\"text/html; charset=utf-8\"}]。");
        std::string bodyUtf8;
        if (body && !LingCdpJson::WideToUtf8(body, bodyUtf8)) return Fail(L"CDP 模拟响应体包含无效字符，无法转换为 UTF-8。");
        if (bodyUtf8.size() > 8 * 1024 * 1024) return Fail(L"CDP 模拟响应体不能超过 8MB。");
        std::wstring bodyBase64;
        if (!bodyUtf8.empty() && !Base64Encode(bodyUtf8, bodyBase64)) return Fail(L"CDP 模拟响应体 base64 编码失败。");
        std::wstring params = L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId)
            + L",\"responseCode\":" + std::to_wstring(status);
        if (!parsedHeaders.empty()) params += L",\"responseHeaders\":" + parsedHeaders;
        if (!bodyBase64.empty()) params += L",\"body\":" + LingCdpJson::Escape(bodyBase64);
        params += L"}";
        return SendCommand(connection, L"Fetch.fulfillRequest", params, PendingKind::Internal, L"", L"", L"");
    }

    bool InterceptFail(long long interceptId, const wchar_t* reason) {
        std::shared_ptr<InterceptRef> reference = TakeIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效或已被处理。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring value = reason && reason[0] ? reason : L"Failed";
        static const wchar_t* allowed[] = { L"Failed", L"Aborted", L"TimedOut", L"AccessDenied", L"ConnectionClosed",
            L"ConnectionReset", L"ConnectionRefused", L"NameNotResolved", L"InternetDisconnected", L"AddressUnreachable",
            L"BlockedByClient", L"BlockedByResponse" };
        bool valid = false;
        for (const wchar_t* candidate : allowed) if (value == candidate) valid = true;
        if (!valid) return Fail(L"CDP 拦截终止原因必须是 Failed、Aborted、TimedOut、AccessDenied、ConnectionClosed、ConnectionReset、ConnectionRefused、NameNotResolved、InternetDisconnected、AddressUnreachable、BlockedByClient 或 BlockedByResponse。");
        return SendCommand(connection, L"Fetch.failRequest", L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId)
            + L",\"errorReason\":" + LingCdpJson::Escape(value) + L"}", PendingKind::Internal, L"", L"", L"");
    }

    bool InterceptAuth(long long interceptId, const wchar_t* user, const wchar_t* password) {
        std::shared_ptr<InterceptRef> reference = TakeIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效或已被处理。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring name = user ? user : L"";
        std::wstring params;
        if (name.empty()) params = L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L",\"response\":\"CancelAuth\"}";
        else params = L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId)
            + L",\"response\":\"ProvideCredentials\",\"username\":" + LingCdpJson::Escape(name)
            + L",\"password\":" + LingCdpJson::Escape(password ? password : L"") + L"}";
        return SendCommand(connection, L"Fetch.continueWithAuth", params, PendingKind::Internal, L"", L"", L"");
    }

    bool InterceptGetPostData(long long interceptId, const wchar_t* handler) {
        std::shared_ptr<InterceptRef> reference = FindIntercept(interceptId);
        if (!reference) return Fail(L"CDP 拦截 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(reference->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Fetch.getRequestPostData", L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L"}",
                           PendingKind::TextResult, handler ? handler : L"", L"", L"");
    }

    // ===== 阶段 2：对话框 =====
    bool BindDialogHandler(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 对话框事件处理器不能为空；对话框打开时页面脚本阻塞，处理器内必须尽快应答。");
        std::lock_guard<std::mutex> lock(page->mutex);
        page->dialogHandler = value;
        return true;
    }

    bool AnswerDialog(long long pageId, bool accept, const wchar_t* promptText) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring prompt = promptText ? promptText : L"";
        std::wstring params = L"{\"accept\":" + std::wstring(accept ? L"true" : L"false");
        if (!prompt.empty()) params += L",\"promptText\":" + LingCdpJson::Escape(prompt);
        params += L"}";
        return SendCommand(connection, L"Page.handleJavaScriptDialog", params, PendingKind::Internal, L"", L"", page->sessionId);
    }

    // ===== 阶段 2：下载 =====
    bool SetDownloadBehavior(long long connectionId, const wchar_t* directory, bool allow) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (!connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring directoryPath = directory ? directory : L"";
        if (allow && directoryPath.empty()) return Fail(L"CDP 下载目录不能为空。");
        if (allow) {
            const DWORD attributes = GetFileAttributesW(directoryPath.c_str());
            if (attributes == INVALID_FILE_ATTRIBUTES || !(attributes & FILE_ATTRIBUTE_DIRECTORY))
                return Fail(L"CDP 下载目录不存在：" + directoryPath);
        }
        std::wstring params = allow
            ? L"{\"behavior\":\"AllowAndName\",\"downloadPath\":" + LingCdpJson::Escape(directoryPath) + L"}"
            : L"{\"behavior\":\"Deny\"}";
        return SendCommand(connection, L"Browser.setDownloadBehavior", params, PendingKind::Internal, L"", L"", L"");
    }

    bool BindDownloadHandler(long long connectionId, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 下载事件处理器不能为空。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->downloadHandler = value;
        return true;
    }

    // ===== 阶段 2：文件上传 =====
    bool SetElementFiles(long long elementId, const wchar_t* filePath, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::shared_ptr<PageSession> page = FindPage(element.first);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring path = filePath ? filePath : L"";
        if (path.empty()) return Fail(L"CDP 上传文件路径不能为空。");
        const DWORD attributes = GetFileAttributesW(path.c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES || (attributes & FILE_ATTRIBUTE_DIRECTORY))
            return Fail(L"CDP 上传文件不存在：" + path);
        const std::wstring script = L"(function(){return document.querySelector(" + LingCdpJson::Escape(element.second) + L");})()";
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(script) + L",\"returnByValue\":false}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::SetFiles, handler ? handler : L"",
                           std::to_wstring(page->id) + L"\t" + path, page->sessionId);
    }

    // ===== 阶段 2：导航生命周期等待 =====
    bool WaitForLifecycle(long long pageId, int kind, int timeoutSeconds, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        if (kind < 0 || kind > 3) return Fail(L"CDP 等待类型必须为 0（load）、1（DOMContentLoaded）、2（networkIdle）或 3（networkAlmostIdle）。");
        if (timeoutSeconds < 1 || timeoutSeconds > 600) return Fail(L"CDP 等待超时必须在 1 到 600 秒之间。");
        const wchar_t* names[] = { L"load", L"domContentLoaded", L"networkIdle", L"networkAlmostIdle" };
        if (!SendCommand(connection, L"Page.setLifecycleEventsEnabled", L"{\"enabled\":true}", PendingKind::Internal, L"", L"", page->sessionId))
            return false;
        std::lock_guard<std::mutex> lock(page->mutex);
        page->pendingLifecycleHandler = handler ? handler : L"";
        page->pendingLifecycleName = names[kind];
        page->lifecyclePending = true;
        page->lifecycleDeadline = std::chrono::steady_clock::now() + std::chrono::seconds(timeoutSeconds);
        return true;
    }

    // ===== 阶段 2：设备与网络仿真 =====
    bool SetViewport(long long pageId, int width, int height) {
        if (width < 1 || width > 10000 || height < 1 || height > 10000) return Fail(L"CDP 视口宽高必须在 1 到 10000 之间。");
        return PageCommand(pageId, L"Emulation.setDeviceMetricsOverride",
            L"{\"width\":" + std::to_wstring(width) + L",\"height\":" + std::to_wstring(height) + L",\"deviceScaleFactor\":1,\"mobile\":false}");
    }
    bool SetUserAgent(long long pageId, const wchar_t* userAgent) {
        const std::wstring value = userAgent ? userAgent : L"";
        if (value.empty()) return Fail(L"CDP UserAgent 不能为空。");
        return PageCommand(pageId, L"Emulation.setUserAgentOverride", L"{\"userAgent\":" + LingCdpJson::Escape(value) + L"}");
    }
    bool SetTouchEmulation(long long pageId, bool enabled) {
        return PageCommand(pageId, L"Emulation.setTouchEmulationEnabled", L"{\"enabled\":" + std::wstring(enabled ? L"true" : L"false") + L"}");
    }
    bool SetGeolocation(long long pageId, double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return Fail(L"CDP 地理位置纬度必须在 -90 到 90、经度在 -180 到 180 之间。");
        return PageCommand(pageId, L"Emulation.setGeolocationOverride",
            L"{\"latitude\":" + LingCdpJson::NumberText(latitude) + L",\"longitude\":" + LingCdpJson::NumberText(longitude) + L",\"accuracy\":100}");
    }
    bool SetTimezone(long long pageId, const wchar_t* timezone) {
        const std::wstring value = timezone ? timezone : L"";
        if (value.empty()) return Fail(L"CDP 时区标识不能为空，例如 Asia/Shanghai；空串可调用 CDP_重置仿真 恢复。");
        return PageCommand(pageId, L"Emulation.setTimezoneOverride", L"{\"timezoneId\":" + LingCdpJson::Escape(value) + L"}");
    }
    bool SetLocale(long long pageId, const wchar_t* locale) {
        const std::wstring value = locale ? locale : L"";
        if (value.empty()) return Fail(L"CDP 语言标识不能为空，例如 zh-CN。");
        return PageCommand(pageId, L"Emulation.setLocaleOverride", L"{\"locale\":" + LingCdpJson::Escape(value) + L"}");
    }
    bool SetDarkMode(long long pageId, bool enabled) {
        return PageCommand(pageId, L"Emulation.setEmulatedMedia",
            L"{\"features\":[{\"name\":\"prefers-color-scheme\",\"value\":" + std::wstring(enabled ? L"\"dark\"" : L"\"light\"") + L"}]}");
    }
    bool SetCpuThrottle(long long pageId, int rate) {
        if (rate < 1 || rate > 100) return Fail(L"CDP CPU 节流倍率必须在 1 到 100 之间。");
        return PageCommand(pageId, L"Emulation.setCPUThrottlingRate", L"{\"rate\":" + std::to_wstring(rate) + L"}");
    }
    bool ResetEmulation(long long pageId) {
        return PageCommand(pageId, L"Emulation.clearDeviceMetricsOverride", L"{}")
            && PageCommand(pageId, L"Emulation.clearUserAgentOverride", L"{}")
            && PageCommand(pageId, L"Emulation.clearGeolocationOverride", L"{}")
            && PageCommand(pageId, L"Emulation.setTouchEmulationEnabled", L"{\"enabled\":false}")
            && PageCommand(pageId, L"Emulation.setEmulatedMedia", L"{\"features\":[]}");
    }
    bool SetOffline(long long pageId, bool offline) {
        return PageCommand(pageId, L"Network.emulateNetworkConditions",
            L"{\"offline\":" + std::wstring(offline ? L"true" : L"false") + L",\"latency\":0,\"downloadThroughput\":-1,\"uploadThroughput\":-1}");
    }
    bool SetNetworkThrottle(long long pageId, int latencyMs, long long downloadBps, long long uploadBps) {
        if (latencyMs < 0 || latencyMs > 60000) return Fail(L"CDP 限速延迟必须在 0 到 60000 毫秒之间。");
        if (downloadBps < -1 || uploadBps < -1) return Fail(L"CDP 限速速率不能小于 -1（-1 表示不限）。");
        return PageCommand(pageId, L"Network.emulateNetworkConditions",
            L"{\"offline\":false,\"latency\":" + std::to_wstring(latencyMs) + L",\"downloadThroughput\":" + std::to_wstring(downloadBps)
            + L",\"uploadThroughput\":" + std::to_wstring(uploadBps) + L"}");
    }
    bool SetCacheDisabled(long long pageId, bool disabled) {
        return PageCommand(pageId, L"Network.setCacheDisabled", L"{\"cacheDisabled\":" + std::wstring(disabled ? L"true" : L"false") + L"}");
    }

    // ===== 阶段 2：元素截图、窗口边界、弹窗与拖拽 =====
    bool ScreenshotElement(long long elementId, const wchar_t* path, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::shared_ptr<PageSession> page = FindPage(element.first);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring filePath = path ? path : L"";
        if (filePath.empty()) return Fail(L"CDP 截图文件路径不能为空。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second) +
            L");if(!e)return null;e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return JSON.stringify([r.left,r.top,r.width,r.height]);})()";
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(script) + L",\"returnByValue\":true}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::ElementShotRect, handler ? handler : L"",
                           std::to_wstring(page->id) + L"\t" + filePath, page->sessionId);
    }

    bool GetWindowBounds(long long pageId, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        std::wstring targetId;
        { std::lock_guard<std::mutex> lock(page->mutex); targetId = page->targetId; }
        if (targetId.empty()) return Fail(L"CDP 页面尚未完成附加。");
        return SendCommand(connection, L"Browser.getWindowForTarget", L"{\"targetId\":" + LingCdpJson::Escape(targetId) + L"}",
                           PendingKind::TextResult, handler ? handler : L"", std::to_wstring(page->id), L"");
    }

    bool SetWindowBounds(long long pageId, int left, int top, int width, int height) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        if (width < 100 || width > 10000 || height < 100 || height > 10000) return Fail(L"CDP 窗口宽高必须在 100 到 10000 之间。");
        std::wstring targetId;
        { std::lock_guard<std::mutex> lock(page->mutex); targetId = page->targetId; }
        if (targetId.empty()) return Fail(L"CDP 页面尚未完成附加。");
        return SendCommand(connection, L"Browser.getWindowForTarget", L"{\"targetId\":" + LingCdpJson::Escape(targetId) + L"}",
                           PendingKind::GetWindowId, L"",
                           std::to_wstring(page->id) + L"\t" + std::to_wstring(left) + L"\t" + std::to_wstring(top)
                               + L"\t" + std::to_wstring(width) + L"\t" + std::to_wstring(height), L"");
    }

    bool BindNewPageHandler(long long connectionId, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        const std::wstring value = handler ? handler : L"";
        if (value.empty()) return Fail(L"CDP 新页面事件处理器不能为空。");
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->newPageHandler = value;
        }
        return connection->connected.load()
            && SendCommand(connection, L"Target.setDiscoverTargets", L"{\"discover\":true}", PendingKind::Internal, L"", L"", L"");
    }

    bool MouseDrag(long long pageId, int fromX, int fromY, int toX, int toY, int steps) {
        if (steps < 1 || steps > 100) return Fail(L"CDP 拖拽步数必须在 1 到 100 之间。");
        if (!SendMouseEvent(pageId, L"mousePressed", fromX, fromY, L"left", 1)) return false;
        for (int index = 1; index <= steps; ++index) {
            const int x = fromX + (toX - fromX) * index / steps;
            const int y = fromY + (toY - fromY) * index / steps;
            if (!SendMouseEvent(pageId, L"mouseMoved", x, y, L"left", 0)) return false;
        }
        return SendMouseEvent(pageId, L"mouseReleased", toX, toY, L"left", 1);
    }

    bool CallFunction(long long elementId, const wchar_t* functionCode, const wchar_t* handler) {
        std::pair<long long, std::wstring> element;
        if (!FindElement(elementId, element)) return Fail(L"CDP 元素 ID 无效。");
        const std::shared_ptr<PageSession> page = FindPage(element.first);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const std::wstring code = functionCode ? functionCode : L"";
        if (code.empty()) return Fail(L"CDP 函数代码不能为空，例如 function(x){return x.value}。");
        const std::wstring script = L"(function(){var e=document.querySelector(" + LingCdpJson::Escape(element.second)
            + L");return e?(" + code + L")(e):null;})()";
        const std::wstring params = L"{\"expression\":" + LingCdpJson::Escape(script) + L",\"awaitPromise\":true,\"returnByValue\":true}";
        return SendCommand(connection, L"Runtime.evaluate", params, PendingKind::TextResult, handler ? handler : L"",
                           std::to_wstring(page->id), page->sessionId);
    }

    // ===== 阶段 3：Target / Session / Frame =====
    bool SetAutoAttach(long long connectionId, bool enabled, bool waitForDebugger, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->targetHandler = handler ? handler : L"";
            connection->autoAttachEnabled = enabled;
        }
        SendCommand(connection, L"Target.setDiscoverTargets", L"{\"discover\":" + std::wstring(enabled ? L"true" : L"false") + L"}",
                    PendingKind::Internal, L"", L"", L"");
        return SendCommand(connection, L"Target.setAutoAttach",
            L"{\"autoAttach\":" + std::wstring(enabled ? L"true" : L"false") + L",\"waitForDebuggerOnStart\":"
                + std::wstring(waitForDebugger ? L"true" : L"false") + L",\"flatten\":true}",
            PendingKind::SuccessOnly, handler ? handler : L"", L"", L"");
    }

    bool BindTargetHandler(long long connectionId, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        std::lock_guard<std::mutex> lock(connection->mutex);
        connection->targetHandler = handler ? handler : L"";
        return !connection->targetHandler.empty();
    }

    std::wstring ListTargetsJson(long long connectionId, const std::wstring& typeFilter) {
        auto root = std::make_shared<LingCdpJson::Value>(); root->kind = LingCdpJson::Value::Kind::Array;
        std::lock_guard<std::mutex> lock(stage3Mutex_);
        for (const auto& pair : targets_) {
            const auto& target = pair.second;
            if (target->connectionId != connectionId || target->destroyed || (!typeFilter.empty() && target->type != typeFilter)) continue;
            auto item = std::make_shared<LingCdpJson::Value>(); item->kind = LingCdpJson::Value::Kind::Object;
            item->object.push_back({L"handle", JsonNumber(target->id)});
            item->object.push_back({L"targetId", JsonString(target->targetId)});
            item->object.push_back({L"type", JsonString(target->type)});
            item->object.push_back({L"title", JsonString(target->title)});
            item->object.push_back({L"url", JsonString(target->url)});
            item->object.push_back({L"session", JsonNumber(target->sessionHandle)});
            item->object.push_back({L"attached", JsonBool(target->attached)});
            root->array.push_back(item);
        }
        return LingCdpJson::Serialize(root);
    }

    long long AttachGenericTarget(long long targetHandle, const wchar_t* handler) {
        const std::shared_ptr<TargetState> target = FindTarget(targetHandle);
        if (!target || target->destroyed) { Fail(L"CDP 目标句柄无效或目标已销毁。"); return 0; }
        const std::shared_ptr<Connection> connection = FindConnection(target->connectionId);
        if (!connection || !connection->connected.load()) { Fail(L"CDP 连接尚未就绪。"); return 0; }
        if (target->sessionHandle) return target->sessionHandle;
        const long long sessionHandle = nextSessionHandle_.fetch_add(1);
        auto session = std::make_shared<SessionState>();
        session->id = sessionHandle; session->connectionId = target->connectionId; session->targetHandle = targetHandle;
        session->ownerPageId = target->ownerPageId; session->targetType = target->type;
        {
            std::lock_guard<std::mutex> lock(stage3Mutex_);
            sessions_[sessionHandle] = session;
            target->sessionHandle = sessionHandle;
        }
        if (!SendCommand(connection, L"Target.attachToTarget", L"{\"targetId\":" + LingCdpJson::Escape(target->targetId) + L",\"flatten\":true}",
                         PendingKind::AttachGenericTarget, handler ? handler : L"", std::to_wstring(sessionHandle), L"")) {
            std::lock_guard<std::mutex> lock(stage3Mutex_); sessions_.erase(sessionHandle); target->sessionHandle = 0; return 0;
        }
        return sessionHandle;
    }

    bool DetachSession(long long sessionHandle) {
        const std::shared_ptr<SessionState> session = FindSession(sessionHandle);
        if (!session || !session->attached) return Fail(L"CDP 会话句柄无效或已经分离。");
        const std::shared_ptr<Connection> connection = FindConnection(session->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Target.detachFromTarget", L"{\"sessionId\":" + LingCdpJson::Escape(session->sessionId) + L"}",
                           PendingKind::Internal, L"", L"", L"");
    }

    bool EvaluateSession(long long sessionHandle, const wchar_t* expression, const wchar_t* handler) {
        const std::shared_ptr<SessionState> session = FindSession(sessionHandle);
        if (!session || !session->attached) return Fail(L"CDP 会话句柄无效或已经分离。");
        const std::shared_ptr<Connection> connection = FindConnection(session->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Runtime.evaluate", L"{\"expression\":" + LingCdpJson::Escape(expression ? expression : L"")
            + L",\"awaitPromise\":true,\"returnByValue\":true}", PendingKind::TextResult, handler ? handler : L"", L"", session->sessionId);
    }

    std::wstring TargetSnapshot(long long targetHandle) { return TargetToJson(FindTarget(targetHandle)); }
    std::wstring SessionSnapshot(long long sessionHandle) { return SessionToJson(FindSession(sessionHandle)); }
    std::wstring FramesJson(long long pageId) {
        auto root = std::make_shared<LingCdpJson::Value>(); root->kind = LingCdpJson::Value::Kind::Array;
        std::lock_guard<std::mutex> lock(stage3Mutex_);
        for (const auto& pair : frames_) if (pair.second->ownerPageId == pageId) {
            auto item = std::make_shared<LingCdpJson::Value>(); item->kind = LingCdpJson::Value::Kind::Object;
            item->object.push_back({L"handle", JsonNumber(pair.second->id)}); item->object.push_back({L"frameId", JsonString(pair.second->frameId)});
            item->object.push_back({L"url", JsonString(pair.second->url)}); item->object.push_back({L"session", JsonNumber(pair.second->sessionHandle)});
            root->array.push_back(item);
        }
        return LingCdpJson::Serialize(root);
    }

    // ===== 阶段 3：Runtime binding / Overlay / Touch =====
    long long AddBinding(long long pageId, const wchar_t* name, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId); if (!page) { Fail(L"CDP 页面 ID 无效。"); return 0; }
        const std::wstring bindingName = name ? name : L""; if (!IsSafeBindingName(bindingName)) { Fail(L"CDP binding 名称只能包含字母、数字和下划线，且长度为 1 到 64。"); return 0; }
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId); if (!connection || !connection->connected.load()) return 0;
        auto binding = std::make_shared<BindingState>(); binding->id = nextBindingId_.fetch_add(1); binding->connectionId = page->connectionId;
        binding->ownerPageId = pageId; binding->name = bindingName; binding->handler = handler ? handler : L"";
        { std::lock_guard<std::mutex> lock(stage3Mutex_); bindings_[binding->id] = binding; }
        SendCommand(connection, L"Runtime.addBinding", L"{\"name\":" + LingCdpJson::Escape(bindingName) + L"}", PendingKind::AddBinding,
                    binding->handler, std::to_wstring(binding->id), page->sessionId);
        ReplayBindingsForConnection(page->connectionId);
        return binding->id;
    }

    bool RemoveBinding(long long bindingId) {
        std::shared_ptr<BindingState> binding;
        { std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=bindings_.find(bindingId); if(found==bindings_.end()) return false; binding=found->second; bindings_.erase(found); }
        const std::shared_ptr<PageSession> page=FindPage(binding->ownerPageId); const std::shared_ptr<Connection> connection=FindConnection(binding->connectionId);
        if(connection&&connection->connected.load()&&page) SendCommand(connection,L"Runtime.removeBinding",L"{\"name\":"+LingCdpJson::Escape(binding->name)+L"}",PendingKind::Internal,L"",L"",page->sessionId);
        return true;
    }

    bool HighlightElement(long long elementId, const wchar_t* fillColor) {
        std::pair<long long,std::wstring> element; if(!FindElement(elementId,element)) return Fail(L"CDP 元素 ID 无效。");
        const auto page=FindPage(element.first); if(!page) return false; const auto connection=FindConnection(page->connectionId); if(!connection) return false;
        const std::wstring color=fillColor&&fillColor[0]?fillColor:L"rgba(111,168,220,0.35)";
        SendCommand(connection,L"DOM.enable",L"{}",PendingKind::Internal,L"",L"",page->sessionId);
        SendCommand(connection,L"Overlay.enable",L"{}",PendingKind::Internal,L"",L"",page->sessionId);
        const std::wstring script=L"(function(){var e=document.querySelector("+LingCdpJson::Escape(element.second)+L");if(!e)return null;var r=e.getBoundingClientRect();return JSON.stringify([r.left,r.top,r.width,r.height]);})()";
        // 使用 Overlay.highlightRect，避免持有跨导航 nodeId。
        return SendCommand(connection,L"Runtime.evaluate",L"{\"expression\":"+LingCdpJson::Escape(script)+L",\"returnByValue\":true}",PendingKind::OverlayRect,L"",L"overlay\t"+color,page->sessionId);
    }

    bool HideHighlight(long long pageId) { return PageCommand(pageId,L"Overlay.hideHighlight",L"{}"); }

    bool DispatchTouch(long long pageId, const wchar_t* type, const wchar_t* pointsJson) {
        const auto page=FindPage(pageId); if(!page) return Fail(L"CDP 页面 ID 无效。"); const auto connection=FindConnection(page->connectionId); if(!connection) return false;
        const std::wstring eventType=type?type:L""; if(eventType!=L"touchStart"&&eventType!=L"touchMove"&&eventType!=L"touchEnd"&&eventType!=L"touchCancel") return Fail(L"CDP 触摸类型无效。");
        std::wstring points=pointsJson?pointsJson:L"[]"; std::string utf8; std::wstring error; LingCdpJson::WideToUtf8(points,utf8); auto parsed=LingCdpJson::Parser::Parse(utf8.data(),utf8.size(),error);
        if(!parsed||parsed->kind!=LingCdpJson::Value::Kind::Array||parsed->array.size()>16) return Fail(L"CDP 触点必须是最多 16 项的 JSON 数组。");
        return SendCommand(connection,L"Input.dispatchTouchEvent",L"{\"type\":"+LingCdpJson::Escape(eventType)+L",\"touchPoints\":"+LingCdpJson::Serialize(parsed)+L"}",PendingKind::Internal,L"",L"",page->sessionId);
    }

    // ===== 阶段 3：Debugger =====
    bool EnableDebugger(long long pageId,const wchar_t* handler){return DebuggerCommand(pageId,L"Debugger.enable",L"{}",handler);}
    bool DisableDebugger(long long pageId,const wchar_t* handler){return DebuggerCommand(pageId,L"Debugger.disable",L"{}",handler);}
    bool BindDebugger(long long pageId,const wchar_t* handler){auto session=MainSessionForPage(pageId);if(!session)return Fail(L"CDP 页面尚未附加会话。");std::lock_guard<std::mutex> lock(stage3Mutex_);session->debugger.handler=handler?handler:L"";return !session->debugger.handler.empty();}
    long long SetBreakpoint(long long pageId,const wchar_t* url,int line,int column,const wchar_t* condition,const wchar_t* handler){
        auto session=MainSessionForPage(pageId);if(!session)return 0;auto connection=FindConnection(session->connectionId);if(!connection)return 0;
        auto bp=std::make_shared<BreakpointState>();bp->id=nextBreakpointId_.fetch_add(1);bp->connectionId=session->connectionId;bp->sessionHandle=session->id;bp->sessionGeneration=session->generation;bp->url=url?url:L"";bp->condition=condition?condition:L"";
        {std::lock_guard<std::mutex> lock(stage3Mutex_);breakpoints_[bp->id]=bp;}
        std::wstring params=L"{\"url\":"+LingCdpJson::Escape(bp->url)+L",\"lineNumber\":"+std::to_wstring(std::max(0,line-1))+L",\"columnNumber\":"+std::to_wstring(std::max(0,column-1))+L",\"condition\":"+LingCdpJson::Escape(bp->condition)+L"}";
        SendCommand(connection,L"Debugger.setBreakpointByUrl",params,PendingKind::SetBreakpoint,handler?handler:L"",std::to_wstring(bp->id),session->sessionId);return bp->id;
    }
    bool RemoveBreakpoint(long long breakpointId,const wchar_t* handler){auto bp=FindBreakpoint(breakpointId);if(!bp||bp->cdpId.empty())return Fail(L"CDP 断点无效或尚未解析。");auto session=FindSession(bp->sessionHandle);auto connection=FindConnection(bp->connectionId);if(!session||!connection)return false;return SendCommand(connection,L"Debugger.removeBreakpoint",L"{\"breakpointId\":"+LingCdpJson::Escape(bp->cdpId)+L"}",PendingKind::SuccessOnly,handler?handler:L"",std::to_wstring(bp->id),session->sessionId);}
    bool DebugPause(long long pageId,const wchar_t* handler){return DebuggerCommand(pageId,L"Debugger.pause",L"{}",handler);}
    bool DebugResume(long long pageId,const wchar_t* handler){return DebuggerCommand(pageId,L"Debugger.resume",L"{}",handler);}
    bool DebugStep(long long pageId,int kind,const wchar_t* handler){const wchar_t* names[]={L"Debugger.stepOver",L"Debugger.stepInto",L"Debugger.stepOut"};if(kind<0||kind>2)return false;return DebuggerCommand(pageId,names[kind],L"{}",handler);}
    int CurrentFrameCount(){auto event=CurrentEvent();if(!event)return 0;auto session=FindSession(event->sessionHandle);return session?static_cast<int>(session->debugger.currentFrameHandles.size()):0;}
    long long CurrentFrameAt(int index){auto event=CurrentEvent();if(!event)return 0;auto session=FindSession(event->sessionHandle);if(!session||index<0||index>=static_cast<int>(session->debugger.currentFrameHandles.size()))return 0;return session->debugger.currentFrameHandles[index];}
    std::wstring CallFrameSnapshot(long long frameId){auto frame=FindCallFrame(frameId);return frame?frame->snapshotJson:L"";}
    bool EvaluateFrame(long long frameId,const wchar_t* expression,const wchar_t* handler){auto frame=FindCallFrame(frameId);auto session=frame?FindSession(frame->sessionHandle):nullptr;if(!frame||!session||frame->pauseGeneration!=session->debugger.pauseGeneration)return Fail(L"CDP 调用帧已失效。");auto connection=FindConnection(frame->connectionId);return SendCommand(connection,L"Debugger.evaluateOnCallFrame",L"{\"callFrameId\":"+LingCdpJson::Escape(frame->callFrameId)+L",\"expression\":"+LingCdpJson::Escape(expression?expression:L"")+L",\"returnByValue\":true,\"awaitPromise\":true}",PendingKind::DebugEvaluate,handler?handler:L"",L"",session->sessionId);}
    bool GetScopeVariables(long long frameId,int scopeIndex,int maximum,const wchar_t* handler){auto frame=FindCallFrame(frameId);auto session=frame?FindSession(frame->sessionHandle):nullptr;if(!frame||!session||scopeIndex<0||scopeIndex>=static_cast<int>(frame->scopeObjectIds.size()))return Fail(L"CDP 调用帧或作用域索引无效。");auto connection=FindConnection(frame->connectionId);return SendCommand(connection,L"Runtime.getProperties",L"{\"objectId\":"+LingCdpJson::Escape(frame->scopeObjectIds[scopeIndex])+L",\"ownProperties\":true}",PendingKind::DebugProperties,handler?handler:L"",std::to_wstring(std::max(1,std::min(maximum,5000))),session->sessionId);}

    // ===== 阶段 3：Performance / Storage =====
    bool GetPerformanceMetrics(long long pageId,const wchar_t* handler){const auto page=FindPage(pageId);if(!page)return false;const auto connection=FindConnection(page->connectionId);SendCommand(connection,L"Performance.enable",L"{}",PendingKind::Internal,L"",L"",page->sessionId);return SendCommand(connection,L"Performance.getMetrics",L"{}",PendingKind::PerformanceMetrics,handler?handler:L"",std::to_wstring(pageId),page->sessionId);}
    bool GetStorageUsage(long long connectionId,const wchar_t* origin,const wchar_t* handler){auto connection=FindConnection(connectionId);std::wstring normalized;if(!connection||!NormalizeOrigin(origin?origin:L"",normalized))return Fail(L"CDP 来源必须是 exact http/https origin。");return SendCommand(connection,L"Storage.getUsageAndQuota",L"{\"origin\":"+LingCdpJson::Escape(normalized)+L"}",PendingKind::StorageUsage,handler?handler:L"",L"",L"");}
    bool ClearStorage(long long connectionId,const wchar_t* origin,const wchar_t* types,bool confirmed,const wchar_t* handler){if(!confirmed)return Fail(L"CDP 清理来源数据必须显式确认破坏性操作。");auto connection=FindConnection(connectionId);std::wstring normalized,storage;if(!connection||!NormalizeOrigin(origin?origin:L"",normalized)||!NormalizeStorageTypes(types?types:L"",storage))return Fail(L"CDP 来源或存储类型无效。");return SendCommand(connection,L"Storage.clearDataForOrigin",L"{\"origin\":"+LingCdpJson::Escape(normalized)+L",\"storageTypes\":"+LingCdpJson::Escape(storage)+L"}",PendingKind::SuccessOnly,handler?handler:L"",L"",L"");}

    // ===== 阶段 3：录制/回放最小确定性模型 =====
    long long StartRecording(long long pageId,const wchar_t* path,const wchar_t* handler){auto page=FindPage(pageId);if(!page)return 0;auto rec=std::make_shared<RecordingState>();rec->id=nextRecordingId_.fetch_add(1);rec->connectionId=page->connectionId;rec->pageId=pageId;rec->path=path?path:L"";rec->handler=handler?handler:L"";rec->state=L"录制中";rec->active=true;{std::lock_guard<std::mutex> lock(recordingsMutex_);recordings_[rec->id]=rec;}return rec->id;}
    bool RecordStep(long long recordingId,const wchar_t* type,const wchar_t* json){auto rec=FindRecording(recordingId);if(!rec||!rec->active)return false;std::wstring step=RedactRecordingStep(type?type:L"",json?json:L"{}");rec->stepsJson.push_back(step);return true;}
    bool StopRecording(long long recordingId){auto rec=FindRecording(recordingId);if(!rec)return false;rec->active=false;rec->state=L"已完成";return WriteRecording(rec);}
    long long LoadReplay(long long connectionId,const wchar_t* path){auto connection=FindConnection(connectionId);if(!connection)return 0;auto replay=std::make_shared<ReplayState>();replay->id=nextReplayId_.fetch_add(1);replay->connectionId=connectionId;replay->path=path?path:L"";replay->state=L"已加载";{std::lock_guard<std::mutex> lock(recordingsMutex_);replays_[replay->id]=replay;}return replay->id;}
    std::wstring RecordingStateText(long long id){auto rec=FindRecording(id);return rec?rec->state:L"无效录制";}
    std::wstring ReplayStateText(long long id){std::lock_guard<std::mutex> lock(recordingsMutex_);auto found=replays_.find(id);return found==replays_.end()?L"无效回放":found->second->state;}


    // ===== 事件分发与快照 =====
    void DispatchEvent(long long eventId, const DispatchHandler& dispatch) {
        std::shared_ptr<Event> event;
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            const auto found = events_.find(eventId);
            if (found == events_.end()) return;
            event = found->second;
            events_.erase(found);
            currentEventStack_.push_back(event);
        }
        if (dispatch && !event->handler.empty()) dispatch(event->handler.c_str());
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            if (!currentEventStack_.empty() && currentEventStack_.back() == event) currentEventStack_.pop_back();
            else {
                const auto found = std::find(currentEventStack_.begin(), currentEventStack_.end(), event);
                if (found != currentEventStack_.end()) currentEventStack_.erase(found);
            }
        }
    }

    std::wstring CurrentType() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->type : L""; }
    std::wstring CurrentText() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->text : L""; }
    std::wstring CurrentDetail() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->detail : L""; }
    std::wstring CurrentError() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->error : L""; }
    std::wstring CurrentNetUrl() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->netUrl : L""; }
    std::wstring CurrentNetMethod() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->netMethod : L""; }
    std::wstring CurrentNetRequestId() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->netRequestId : L""; }
    int CurrentNetStatus() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->netStatus : 0; }
    long long CurrentConnection() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->connectionId : 0; }
    long long CurrentPage() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->pageId : 0; }
    std::wstring CurrentDialogMessage() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->text : L""; }
    std::wstring CurrentDialogType() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->detail : L""; }
    std::wstring CurrentDialogDefaultText() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->auxText : L""; }
    std::wstring CurrentDownloadFile() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->text : L""; }
    int CurrentDownloadProgress() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->auxValue : 0; }
    long long CurrentIntercept() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->interceptId : 0; }
    long long CurrentTarget() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->targetHandle : 0; }
    long long CurrentSession() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->sessionHandle : 0; }
    long long CurrentFrame() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->frameHandle : 0; }
    long long CurrentBinding() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->bindingHandle : 0; }
    long long CurrentTask() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->taskId : 0; }
    long long CurrentBreakpoint() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->breakpointId : 0; }
    long long CurrentCertificateError() const { const std::shared_ptr<Event> event = CurrentEvent(); return event ? event->certificateErrorId : 0; }

    void Shutdown() {
        watchdogStop_.store(true);
        {
            std::lock_guard<std::mutex> lock(watchdogMutex_);
            watchdogChanged_.notify_all();
        }
        if (watchdog_.joinable()) watchdog_.join();
        std::vector<std::shared_ptr<Connection>> values;
        {
            std::lock_guard<std::mutex> lock(connectionsMutex_);
            for (const auto& pair : connections_) values.push_back(pair.second);
            connections_.clear();
        }
        for (const auto& connection : values) CloseConnection(connection, false);
        { std::lock_guard<std::mutex> lock(pagesMutex_); pages_.clear(); }
        { std::lock_guard<std::mutex> lock(elementsMutex_); elements_.clear(); }
        { std::lock_guard<std::mutex> lock(interceptsMutex_); intercepts_.clear(); }
        ReleaseAllStage3State();
        { std::lock_guard<std::mutex> lock(eventsMutex_); events_.clear(); currentEventStack_.clear(); }
    }

private:
    enum PendingKind {
        Internal = 0,          // 响应到达后忽略（Input/enable/close 等可靠命令）
        TextResult = 1,        // 提取结果文本（evaluate/getResponseBody/getCookies）
        WriteBase64File = 2,   // result.data base64 解码写入 aux 路径（截图/PDF）
        AttachTarget = 4,      // result.sessionId -> 启用域并立即通知页面就绪（附加已有页面）
        CreateTarget = 5,      // result.targetId -> 继续 attach（aux=pageId）
        NavigateWait = 6,      // 导航已提交，等待 loadEventFired 再通知（aux=pageId）
        SuccessOnly = 8,       // 检查 result.success，命令完成
        ElementClick = 9,      // evaluate 得 [x,y] -> 发送鼠标按下/释放
        FocusThenType = 10,    // evaluate 聚焦成功 -> insertTextInput（aux=页面ID\t待输入文本）
        AttachWaitLoad = 11,   // 新建页面：启用域后等待 loadEventFired 再通知就绪
        CheckReady = 12,       // 读取 document.readyState（阶段 1 遗留，新建页面已改走导航等待链）
        SetFiles = 13,         // evaluate 得 objectId -> DOM.setFileInputFiles（aux=页面ID\t文件路径）
        GetWindowId = 14,      // 取 windowId 后继续设置窗口边界（aux=页面ID\t左\t上\t宽\t高）
        ElementShotRect = 15,  // evaluate 得 [x,y,w,h] -> captureScreenshot clip -> 写盘（aux=页面ID\t文件路径）
        AttachGenericTarget = 16,
        AddBinding = 17,
        SetBreakpoint = 18,
        DebugEvaluate = 19,
        DebugProperties = 20,
        PerformanceMetrics = 21,
        WriteJsonFile = 22,
        CreateTaskFromResponse = 23,
        StorageUsage = 24,
        OverlayRect = 25,
        IoRead = 26
    };

    struct Event {
        long long id = 0;
        long long connectionId = 0;
        long long pageId = 0;
        std::wstring handler;
        std::wstring type;
        std::wstring text;
        std::wstring detail;
        std::wstring error;
        std::wstring netUrl;
        std::wstring netMethod;
        std::wstring netRequestId;
        int netStatus = 0;
        std::wstring auxText;
        int auxValue = 0;
        long long interceptId = 0;
        long long targetHandle = 0;
        long long sessionHandle = 0;
        long long frameHandle = 0;
        long long bindingHandle = 0;
        long long taskId = 0;
        long long breakpointId = 0;
        long long certificateErrorId = 0;
    };

    struct Pending {
        std::wstring handler;
        int kind = Internal;
        std::wstring aux;
        std::wstring method;
        long long pageId = 0;
        long long sessionHandle = 0;
        long long taskId = 0;
        unsigned long long generation = 0;
        std::wstring outputPath;
        std::wstring expectedSessionId;
        bool notifyOnFailure = false;
        std::chrono::steady_clock::time_point submittedAt{};
    };

    struct InterceptRef {
        long long id = 0;
        long long connectionId = 0;
        long long pageId = 0;
        std::wstring requestId;
        std::wstring url;
        std::wstring method;
        std::wstring headersJson;
        bool hasPostData = false;
        bool needsAuth = false;
    };

    struct TargetState {
        long long id = 0;
        long long connectionId = 0;
        long long ownerPageId = 0;
        long long parentTargetId = 0;
        long long sessionHandle = 0;
        std::wstring targetId;
        std::wstring type;
        std::wstring title;
        std::wstring url;
        std::wstring openerTargetId;
        std::wstring browserContextId;
        bool attached = false;
        bool destroyed = false;
        bool waitingForDebugger = false;
        unsigned long long generation = 1;
    };

    struct DebuggerState {
        bool enabled = false;
        bool paused = false;
        bool pauseRequested = false;
        bool resumeRequested = false;
        unsigned long long pauseGeneration = 0;
        std::wstring handler;
        std::wstring pausedJson;
        std::vector<long long> currentFrameHandles;
    };

    struct SessionState {
        long long id = 0;
        long long connectionId = 0;
        long long targetHandle = 0;
        long long parentSessionHandle = 0;
        long long ownerPageId = 0;
        std::wstring sessionId;
        std::wstring targetType;
        bool attached = false;
        unsigned long long generation = 1;
        DebuggerState debugger;
    };

    struct FrameState {
        long long id = 0;
        long long connectionId = 0;
        long long ownerPageId = 0;
        long long sessionHandle = 0;
        long long parentFrameHandle = 0;
        std::wstring frameId;
        std::wstring parentFrameId;
        std::wstring loaderId;
        std::wstring name;
        std::wstring url;
        unsigned long long generation = 1;
    };

    struct ExecutionContextState {
        long long id = 0;
        long long connectionId = 0;
        long long sessionHandle = 0;
        long long frameHandle = 0;
        long long contextId = 0;
        std::wstring uniqueId;
        std::wstring origin;
        std::wstring name;
        bool isDefault = false;
        unsigned long long generation = 1;
    };

    struct BindingState {
        long long id = 0;
        long long connectionId = 0;
        long long ownerPageId = 0;
        std::wstring name;
        std::wstring handler;
        bool active = true;
        unsigned long long generation = 1;
    };

    struct BreakpointState {
        long long id = 0;
        long long connectionId = 0;
        long long sessionHandle = 0;
        unsigned long long sessionGeneration = 0;
        std::wstring cdpId;
        std::wstring url;
        std::wstring condition;
        std::wstring snapshotJson;
        bool active = false;
    };

    struct CallFrameState {
        long long id = 0;
        long long connectionId = 0;
        long long sessionHandle = 0;
        unsigned long long sessionGeneration = 0;
        unsigned long long pauseGeneration = 0;
        std::wstring callFrameId;
        std::wstring snapshotJson;
        std::vector<std::wstring> scopeObjectIds;
    };

    struct TaskState {
        long long id = 0;
        long long connectionId = 0;
        long long sessionHandle = 0;
        std::wstring kind;
        std::wstring state = L"已创建";
        std::wstring handler;
        std::wstring finalPath;
        std::wstring temporaryPath;
        std::wstring error;
        std::wstring ioHandle;
        long long writtenBytes = 0;
        long long maximumBytes = 0;
        int progress = 0;
        bool cancelRequested = false;
        bool terminal = false;
        HANDLE file = INVALID_HANDLE_VALUE;
        std::chrono::steady_clock::time_point lastProgressAt{};
    };

    struct CertificateErrorState {
        long long id = 0;
        long long connectionId = 0;
        int eventId = 0;
        std::wstring url;
        std::wstring origin;
        std::wstring errorType;
        std::chrono::steady_clock::time_point deadline{};
        bool decided = false;
    };

    struct RecordingState {
        long long id = 0;
        long long connectionId = 0;
        long long pageId = 0;
        std::wstring path;
        std::wstring handler;
        std::wstring state = L"已创建";
        std::vector<std::wstring> stepsJson;
        bool active = false;
    };

    struct ReplayState {
        long long id = 0;
        long long connectionId = 0;
        long long pageId = 0;
        std::wstring path;
        std::wstring handler;
        std::wstring state = L"已创建";
        std::wstring diagnostics;
        size_t currentStep = 0;
        bool active = false;
    };

    static LingCdpJson::ValuePtr JsonString(const std::wstring& value) { auto item=std::make_shared<LingCdpJson::Value>(); item->kind=LingCdpJson::Value::Kind::String; item->text=value; return item; }
    static LingCdpJson::ValuePtr JsonNumber(double value) { auto item=std::make_shared<LingCdpJson::Value>(); item->kind=LingCdpJson::Value::Kind::Number; item->number=value; return item; }
    static LingCdpJson::ValuePtr JsonBool(bool value) { auto item=std::make_shared<LingCdpJson::Value>(); item->kind=LingCdpJson::Value::Kind::Bool; item->boolean=value; return item; }

    std::shared_ptr<TargetState> FindTarget(long long id) const { std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=targets_.find(id); return found==targets_.end()?nullptr:found->second; }
    std::shared_ptr<SessionState> FindSession(long long id) const { std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=sessions_.find(id); return found==sessions_.end()?nullptr:found->second; }
    std::shared_ptr<BreakpointState> FindBreakpoint(long long id) const { std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=breakpoints_.find(id); return found==breakpoints_.end()?nullptr:found->second; }
    std::shared_ptr<CallFrameState> FindCallFrame(long long id) const { std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=callFrames_.find(id); return found==callFrames_.end()?nullptr:found->second; }
    std::shared_ptr<RecordingState> FindRecording(long long id) const { std::lock_guard<std::mutex> lock(recordingsMutex_); auto found=recordings_.find(id); return found==recordings_.end()?nullptr:found->second; }

    std::shared_ptr<SessionState> MainSessionForPage(long long pageId) const {
        const auto page=FindPage(pageId); if(!page)return nullptr;
        std::lock_guard<std::mutex> lock(stage3Mutex_); auto found=sessionByProtocolId_.find(page->sessionId); return found==sessionByProtocolId_.end()?nullptr:sessions_.at(found->second);
    }

    static std::wstring TargetToJson(const std::shared_ptr<TargetState>& target) {
        if(!target)return L""; auto root=std::make_shared<LingCdpJson::Value>();root->kind=LingCdpJson::Value::Kind::Object;
        root->object.push_back({L"handle",JsonNumber(target->id)});root->object.push_back({L"targetId",JsonString(target->targetId)});root->object.push_back({L"type",JsonString(target->type)});root->object.push_back({L"title",JsonString(target->title)});root->object.push_back({L"url",JsonString(target->url)});root->object.push_back({L"session",JsonNumber(target->sessionHandle)});return LingCdpJson::Serialize(root);
    }
    static std::wstring SessionToJson(const std::shared_ptr<SessionState>& session) { if(!session)return L"";auto root=std::make_shared<LingCdpJson::Value>();root->kind=LingCdpJson::Value::Kind::Object;root->object.push_back({L"handle",JsonNumber(session->id)});root->object.push_back({L"target",JsonNumber(session->targetHandle)});root->object.push_back({L"type",JsonString(session->targetType)});root->object.push_back({L"page",JsonNumber(session->ownerPageId)});root->object.push_back({L"attached",JsonBool(session->attached)});return LingCdpJson::Serialize(root); }

    static bool IsSafeBindingName(const std::wstring& value) { if(value.empty()||value.size()>64)return false;for(wchar_t ch:value)if(!((ch>=L'a'&&ch<=L'z')||(ch>=L'A'&&ch<=L'Z')||(ch>=L'0'&&ch<=L'9')||ch==L'_'))return false;return true; }

    bool DebuggerCommand(long long pageId,const std::wstring& method,const std::wstring& params,const wchar_t* handler){auto session=MainSessionForPage(pageId);if(!session)return Fail(L"CDP 页面尚未建立目标会话。");auto connection=FindConnection(session->connectionId);if(!connection)return false;return SendCommand(connection,method,params,PendingKind::SuccessOnly,handler?handler:L"",std::to_wstring(pageId),session->sessionId);}

    static bool NormalizeOrigin(const std::wstring& input,std::wstring& output){URL_COMPONENTSW parts={};parts.dwStructSize=sizeof(parts);parts.dwSchemeLength=static_cast<DWORD>(-1);parts.dwHostNameLength=static_cast<DWORD>(-1);parts.dwUrlPathLength=static_cast<DWORD>(-1);if(!WinHttpCrackUrl(input.c_str(),0,0,&parts)||parts.dwHostNameLength==0)return false;std::wstring scheme(parts.lpszScheme,parts.dwSchemeLength);if(scheme!=L"http"&&scheme!=L"https")return false;output=scheme+L"://"+std::wstring(parts.lpszHostName,parts.dwHostNameLength);const INTERNET_PORT defaultPort=scheme==L"https"?443:80;if(parts.nPort&&parts.nPort!=defaultPort)output+=L":"+std::to_wstring(parts.nPort);return true;}
    static bool NormalizeStorageTypes(const std::wstring& input,std::wstring& output){static const std::set<std::wstring> allowed={L"all",L"cookies",L"file_systems",L"indexeddb",L"local_storage",L"shader_cache",L"websql",L"service_workers",L"cache_storage",L"interest_groups",L"shared_storage"};output.clear();size_t start=0;while(start<=input.size()){size_t end=input.find(L',',start);if(end==std::wstring::npos)end=input.size();std::wstring item=input.substr(start,end-start);while(!item.empty()&&iswspace(item.front()))item.erase(item.begin());while(!item.empty()&&iswspace(item.back()))item.pop_back();if(!allowed.count(item))return false;if(!output.empty())output+=L",";output+=item;if(end==input.size())break;start=end+1;}return !output.empty();}

    static std::wstring RedactRecordingStep(const std::wstring& type,const std::wstring& json){std::wstring lower=json;std::transform(lower.begin(),lower.end(),lower.begin(),::towlower);const bool sensitive=lower.find(L"password")!=std::wstring::npos||lower.find(L"token")!=std::wstring::npos||lower.find(L"secret")!=std::wstring::npos||lower.find(L"authorization")!=std::wstring::npos;return L"{\"type\":"+LingCdpJson::Escape(type)+L",\"data\":"+(sensitive?L"{\"value\":\"${SECRET:REDACTED}\",\"sensitive\":true}":json)+L"}";}
    bool WriteRecording(const std::shared_ptr<RecordingState>& rec){std::wstring body=L"{\"schema\":\"lingbuilder.cdp.recording\",\"schemaVersion\":1,\"steps\":[";for(size_t i=0;i<rec->stepsJson.size();++i){if(i)body+=L",";body+=rec->stepsJson[i];}body+=L"]}";std::string utf8;if(!LingCdpJson::WideToUtf8(body,utf8))return false;std::vector<unsigned char> bytes(utf8.begin(),utf8.end());return WriteFileBytesAtomic(rec->path,bytes);}

    void ReplayBindingsForConnection(long long connectionId){std::vector<std::shared_ptr<BindingState>> bindings;std::vector<std::shared_ptr<SessionState>> sessions;{std::lock_guard<std::mutex> lock(stage3Mutex_);for(auto&p:bindings_)if(p.second->connectionId==connectionId&&p.second->active)bindings.push_back(p.second);for(auto&p:sessions_)if(p.second->connectionId==connectionId&&p.second->attached)sessions.push_back(p.second);}auto connection=FindConnection(connectionId);if(!connection)return;for(auto&s:sessions)for(auto&b:bindings)SendCommand(connection,L"Runtime.addBinding",L"{\"name\":"+LingCdpJson::Escape(b->name)+L"}",PendingKind::Internal,L"",L"",s->sessionId);}

    void ReleaseConnectionStage3State(long long connectionId) { std::lock_guard<std::mutex> lock(stage3Mutex_); for(auto it=targets_.begin();it!=targets_.end();)if(it->second->connectionId==connectionId){targetByProtocolId_.erase(it->second->targetId);it=targets_.erase(it);}else++it;for(auto it=sessions_.begin();it!=sessions_.end();)if(it->second->connectionId==connectionId){sessionByProtocolId_.erase(it->second->sessionId);it=sessions_.erase(it);}else++it;for(auto it=frames_.begin();it!=frames_.end();)if(it->second->connectionId==connectionId){frameByProtocolId_.erase(it->second->frameId);it=frames_.erase(it);}else++it; }
    void ReleaseAllStage3State(){std::lock_guard<std::mutex> lock(stage3Mutex_);targets_.clear();sessions_.clear();frames_.clear();contexts_.clear();bindings_.clear();breakpoints_.clear();callFrames_.clear();certificateErrors_.clear();targetByProtocolId_.clear();sessionByProtocolId_.clear();frameByProtocolId_.clear();std::lock_guard<std::mutex> taskLock(tasksMutex_);for(auto&p:tasks_)CloseTaskFile(p.second,false);tasks_.clear();}


    struct PageSession {
        long long id = 0;
        long long connectionId = 0;
        mutable std::mutex mutex;
        std::wstring targetId;
        std::wstring sessionId;
        std::wstring url;
        std::wstring readyHandler;
        std::wstring eventHandler;
        std::wstring networkHandler;
        std::wstring consoleHandler;
        std::wstring exceptionHandler;
        std::wstring interceptHandler;
        std::wstring dialogHandler;
        std::wstring pendingLoadHandler;
        bool loadPending = false;
        bool readyPending = false;
        bool loadDeadlineValid = false;
        bool readyDeadlineValid = false;
        std::chrono::steady_clock::time_point loadDeadline{};
        std::chrono::steady_clock::time_point readyDeadline{};
        std::wstring pendingLifecycleHandler;
        std::wstring pendingLifecycleName;
        bool lifecyclePending = false;
        std::chrono::steady_clock::time_point lifecycleDeadline{};
    };

    struct Connection {
        long long id = 0;
        mutable std::mutex mutex;
        mutable std::mutex handlesMutex;
        std::mutex sendMutex;
        std::mutex pendingMutex;
        std::condition_variable stateChanged;
        std::thread worker;
        std::atomic<bool> workerRunning{false};
        std::atomic<bool> stopRequested{false};
        std::atomic<bool> manualClose{false};
        std::atomic<bool> connected{false};
        std::atomic<bool> attachFailed{false};
        std::wstring httpBase;
        std::wstring browserVersion;
        std::wstring connectHandler;
        std::wstring eventHandler;
        std::wstring downloadHandler;
        std::wstring newPageHandler;
        std::wstring targetHandler;
        std::wstring securityHandler;
        std::wstring certificateHandler;
        int commandTimeoutMs = 30000;
        bool autoAttachEnabled = false;
        bool certificateOverrideEnabled = false;
        std::set<std::wstring> certificateOrigins;
        std::chrono::steady_clock::time_point certificateOverrideDeadline{};
        bool allowRemote = false;
        std::wstring state = L"未配置";
        std::wstring lastError;
        HINTERNET session = nullptr;
        HINTERNET connect = nullptr;
        HINTERNET wsSocket = nullptr;
        std::atomic<long long> nextMsgId{1};
        std::unordered_map<long long, Pending> pending;
        mutable std::mutex downloadNamesMutex;
        std::unordered_map<std::wstring, std::wstring> downloadNames;
    };

    std::shared_ptr<Connection> FindConnection(long long id) const {
        std::lock_guard<std::mutex> lock(connectionsMutex_);
        const auto found = connections_.find(id);
        return found == connections_.end() ? nullptr : found->second;
    }

    std::shared_ptr<PageSession> FindPage(long long id) const {
        std::lock_guard<std::mutex> lock(pagesMutex_);
        const auto found = pages_.find(id);
        return found == pages_.end() ? nullptr : found->second;
    }

    bool FindElement(long long id, std::pair<long long, std::wstring>& out) const {
        std::lock_guard<std::mutex> lock(elementsMutex_);
        const auto found = elements_.find(id);
        if (found == elements_.end()) return false;
        out = found->second;
        return true;
    }

    std::shared_ptr<PageSession> FindPageBySession(long long connectionId, const std::wstring& sessionId) const {
        std::lock_guard<std::mutex> lock(pagesMutex_);
        for (const auto& pair : pages_) {
            if (pair.second->connectionId != connectionId) continue;
            std::lock_guard<std::mutex> pageLock(pair.second->mutex);
            if (pair.second->sessionId == sessionId) return pair.second;
        }
        return nullptr;
    }

    std::shared_ptr<PageSession> FindPageByTarget(long long connectionId, const std::wstring& targetId) const {
        std::lock_guard<std::mutex> lock(pagesMutex_);
        for (const auto& pair : pages_) {
            if (pair.second->connectionId != connectionId) continue;
            std::lock_guard<std::mutex> pageLock(pair.second->mutex);
            if (pair.second->targetId == targetId) return pair.second;
        }
        return nullptr;
    }

    std::shared_ptr<PageSession> CreatePage(long long connectionId, const std::wstring& url, const std::wstring& readyHandler) {
        auto page = std::make_shared<PageSession>();
        page->id = nextPageId_.fetch_add(1);
        page->connectionId = connectionId;
        page->url = url;
        page->readyHandler = readyHandler;
        std::lock_guard<std::mutex> lock(pagesMutex_);
        pages_[page->id] = page;
        return page;
    }

    std::shared_ptr<InterceptRef> FindIntercept(long long id) const {
        std::lock_guard<std::mutex> lock(interceptsMutex_);
        const auto found = intercepts_.find(id);
        return found == intercepts_.end() ? nullptr : found->second;
    }

    // 取出并移除拦截引用：每个拦截只能被 continue/fail/fulfill/auth 处理一次。
    std::shared_ptr<InterceptRef> TakeIntercept(long long id) {
        std::lock_guard<std::mutex> lock(interceptsMutex_);
        const auto found = intercepts_.find(id);
        if (found == intercepts_.end()) return nullptr;
        auto reference = found->second;
        intercepts_.erase(found);
        return reference;
    }

    bool PageCommand(long long pageId, const std::wstring& method, const std::wstring& params) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, method, params, PendingKind::Internal, L"", L"", page->sessionId);
    }

    // 校验并规范化头 JSON 数组：[{"name":"X","value":"Y"}] -> 返回规范 JSON 文本；空输入返回空。
    static bool ParseHeaderArray(const std::wstring& input, std::wstring& out) {
        if (input.empty()) { out.clear(); return true; }
        std::string utf8;
        if (!LingCdpJson::WideToUtf8(input, utf8)) return false;
        std::wstring error;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(utf8.data(), utf8.size(), error);
        if (!root || root->kind != LingCdpJson::Value::Kind::Array || root->array.empty()) return false;
        for (const auto& entry : root->array) {
            if (!entry || entry->kind != LingCdpJson::Value::Kind::Object) return false;
            const auto name = entry->Find(L"name");
            const auto value = entry->Find(L"value");
            if (!name || name->kind != LingCdpJson::Value::Kind::String || name->text.empty()) return false;
            if (!value || value->kind != LingCdpJson::Value::Kind::String) return false;
        }
        out = LingCdpJson::Serialize(root);
        return true;
    }

    static bool Base64Encode(const std::string& input, std::wstring& out) {
        if (input.empty()) { out.clear(); return true; }
        DWORD size = 0;
        if (!CryptBinaryToStringW(reinterpret_cast<const BYTE*>(input.data()), static_cast<DWORD>(input.size()),
            CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &size)) return false;
        std::vector<wchar_t> buffer(size + 1, L'\0');
        if (!CryptBinaryToStringW(reinterpret_cast<const BYTE*>(input.data()), static_cast<DWORD>(input.size()),
            CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, buffer.data(), &size)) return false;
        out.assign(buffer.data());
        return true;
    }

    // 解析 JSON 数字数组（坐标/矩形），元素个数必须等于 expected。
    static bool ParseNumbers(const std::wstring& text, size_t expected, std::vector<double>& out) {
        if (text.empty() || text == L"null") return false;
        std::string utf8;
        if (!LingCdpJson::WideToUtf8(text, utf8)) return false;
        std::wstring error;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(utf8.data(), utf8.size(), error);
        if (!root || root->kind != LingCdpJson::Value::Kind::Array || root->array.size() != expected) return false;
        out.clear();
        for (const auto& item : root->array) {
            if (!item || item->kind != LingCdpJson::Value::Kind::Number) return false;
            out.push_back(item->number);
        }
        return true;
    }

    // ===== 看门狗：命令响应、导航/就绪等待与生命周期等待的超时 =====
    void WatchdogLoop() {
        while (!watchdogStop_.load()) {
            std::unique_lock<std::mutex> lock(watchdogMutex_);
            watchdogChanged_.wait_for(lock, std::chrono::milliseconds(500), [this]() { return watchdogStop_.load(); });
            if (watchdogStop_.load()) break;
            CheckTimeouts();
        }
    }

    void CheckTimeouts() {
        const auto now = std::chrono::steady_clock::now();
        std::vector<std::shared_ptr<Connection>> connections;
        {
            std::lock_guard<std::mutex> lock(connectionsMutex_);
            for (const auto& pair : connections_) connections.push_back(pair.second);
        }
        for (const auto& connection : connections) {
            if (!connection->connected.load()) continue;
            int timeoutMs = 30000;
            { std::lock_guard<std::mutex> lock(connection->mutex); timeoutMs = connection->commandTimeoutMs; }
            std::vector<Pending> expired;
            {
                std::lock_guard<std::mutex> lock(connection->pendingMutex);
                for (auto it = connection->pending.begin(); it != connection->pending.end();) {
                    if (it->second.submittedAt != std::chrono::steady_clock::time_point{}
                        && now - it->second.submittedAt > std::chrono::milliseconds(timeoutMs)) {
                        expired.push_back(it->second);
                        it = connection->pending.erase(it);
                    } else ++it;
                }
            }
            for (const Pending& pending : expired) {
                if (pending.kind != PendingKind::Internal || !pending.handler.empty()) {
                    EmitCommand(connection, pending, false,
                        L"CDP 命令超时（" + std::to_wstring(timeoutMs) + L" 毫秒）：" + pending.method, 0);
                } else {
                    std::lock_guard<std::mutex> lock(connection->mutex);
                    connection->lastError = L"CDP 内部命令超时（" + std::to_wstring(timeoutMs) + L" 毫秒）：" + pending.method;
                }
            }
        }
        std::vector<std::shared_ptr<PageSession>> pages;
        {
            std::lock_guard<std::mutex> lock(pagesMutex_);
            for (const auto& pair : pages_) pages.push_back(pair.second);
        }
        for (const auto& page : pages) {
            std::wstring handler;
            std::wstring type;
            std::wstring text;
            std::wstring detail;
            std::wstring url;
            {
                std::lock_guard<std::mutex> lock(page->mutex);
                url = page->url;
                if (page->readyDeadlineValid && now > page->readyDeadline) {
                    page->readyDeadlineValid = false;
                    page->readyPending = false;
                    handler = page->readyHandler;
                    page->readyHandler.clear();
                    page->loadPending = false;
                    page->pendingLoadHandler.clear();
                    type = L"页面失败";
                    detail = L"页面加载超时，可用 CDP_设置命令超时 调整上限。";
                } else if (page->loadDeadlineValid && now > page->loadDeadline) {
                    page->loadDeadlineValid = false;
                    page->loadPending = false;
                    handler = page->pendingLoadHandler;
                    page->pendingLoadHandler.clear();
                    type = L"命令失败";
                    detail = L"页面导航加载超时。";
                } else if (page->lifecyclePending && now > page->lifecycleDeadline) {
                    page->lifecyclePending = false;
                    handler = page->pendingLifecycleHandler;
                    page->pendingLifecycleHandler.clear();
                    type = L"命令失败";
                    detail = L"等待页面事件超时：" + page->pendingLifecycleName;
                    page->pendingLifecycleName.clear();
                } else continue;
            }
            const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
            EmitEvent(connection, page, handler, type, text.empty() ? url : text, detail);
        }
    }

    void ReleasePage(long long pageId, bool emitDestroyed) {
        std::shared_ptr<PageSession> page;
        {
            std::lock_guard<std::mutex> lock(pagesMutex_);
            const auto found = pages_.find(pageId);
            if (found == pages_.end()) return;
            page = found->second;
            pages_.erase(found);
        }
        {
            std::lock_guard<std::mutex> lock(elementsMutex_);
            for (auto it = elements_.begin(); it != elements_.end();) {
                if (it->second.first == pageId) it = elements_.erase(it);
                else ++it;
            }
        }
        // 释放该页面尚未裁决的拦截：直接终止请求，避免浏览器网络永久挂起。
        std::vector<std::shared_ptr<InterceptRef>> pending;
        {
            std::lock_guard<std::mutex> lock(interceptsMutex_);
            for (auto it = intercepts_.begin(); it != intercepts_.end();) {
                if (it->second->pageId == pageId) {
                    pending.push_back(it->second);
                    it = intercepts_.erase(it);
                } else ++it;
            }
        }
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (connection && connection->connected.load()) {
            for (const auto& reference : pending) {
                SendCommand(connection, L"Fetch.failRequest",
                    L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L",\"errorReason\":\"Aborted\"}",
                    PendingKind::Internal, L"", L"", L"");
            }
        }
        if (emitDestroyed) {
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->eventHandler; }
            EmitEvent(connection, page, handler, L"页面销毁", page->url, L"");
        }
    }

    void ReleaseConnectionPages(long long connectionId, bool emitDestroyed) {
        std::vector<long long> pageIds;
        {
            std::lock_guard<std::mutex> lock(pagesMutex_);
            for (const auto& pair : pages_) if (pair.second->connectionId == connectionId) pageIds.push_back(pair.first);
        }
        for (long long pageId : pageIds) ReleasePage(pageId, emitDestroyed);
    }

    // ===== 连接工作线程 =====
    void ConnectWorker(const std::shared_ptr<Connection>& connection) {
        std::string body;
        std::wstring error;
        if (!HttpGetText(connection->httpBase + L"/json/version", 10000, body, error)) {
            ConnectionFail(connection, L"CDP 无法访问调试端点 /json/version：" + error, true);
            return;
        }
        std::wstring parseError;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(body.data(), body.size(), parseError);
        if (!root) {
            ConnectionFail(connection, L"CDP 调试端点返回了无法解析的版本信息：" + parseError, true);
            return;
        }
        std::wstring webSocketUrl;
        std::wstring browserVersion;
        const auto wsField = root->Find(L"webSocketDebuggerUrl");
        if (wsField && wsField->kind == LingCdpJson::Value::Kind::String) webSocketUrl = wsField->text;
        const auto browserField = root->Find(L"Browser");
        if (browserField && browserField->kind == LingCdpJson::Value::Kind::String) browserVersion = browserField->text;
        if (webSocketUrl.empty()) {
            ConnectionFail(connection, L"CDP 调试端点没有返回 webSocketDebuggerUrl，请确认浏览器已使用 --remote-debugging-port 启动。", true);
            return;
        }
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->browserVersion = browserVersion;
        }
        if (!UpgradeWebSocket(connection, webSocketUrl)) return;
        connection->connected.store(true);
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->state = L"已连接";
            connection->lastError.clear();
        }
        connection->stateChanged.notify_all();
        EmitConnection(connection, L"已就绪", browserVersion, L"", true);
        ReceiveLoop(connection);
        connection->connected.store(false);
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->state = connection->manualClose.load() ? L"已断开" : L"错误";
        }
        connection->stateChanged.notify_all();
        if (!connection->manualClose.load() && !connection->stopRequested.load())
            EmitConnection(connection, L"已断开", L"", L"连接已中断", false);
        CloseHandles(connection);
        FailPendingAll(connection, L"CDP 连接已断开。");
        ReleaseConnectionPages(connection->id, true);
        ReleaseConnectionStage3State(connection->id);
        connection->workerRunning.store(false);
    }

    void AttachWorker(const std::shared_ptr<Connection>& connection, const std::shared_ptr<PageSession>& page, const std::wstring& url) {
        std::string body;
        std::wstring error;
        if (!HttpGetText(connection->httpBase + L"/json/list", 10000, body, error)) {
            EmitEvent(connection, page, page->readyHandler, L"页面失败", url, L"CDP 无法访问调试端点 /json/list：" + error);
            ReleasePage(page->id, false);
            return;
        }
        std::wstring parseError;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(body.data(), body.size(), parseError);
        if (!root || root->kind != LingCdpJson::Value::Kind::Array) {
            EmitEvent(connection, page, page->readyHandler, L"页面失败", url, L"CDP 页面列表解析失败：" + parseError);
            ReleasePage(page->id, false);
            return;
        }
        std::wstring targetId;
        for (const auto& entry : root->array) {
            const auto typeField = entry->Find(L"type");
            const auto urlField = entry->Find(L"url");
            const auto idField = entry->Find(L"id");
            if (!typeField || typeField->text != L"page" || !urlField || !idField) continue;
            if (urlField->text == url) { targetId = idField->text; break; }
            if (targetId.empty() && urlField->text.rfind(url, 0) == 0) targetId = idField->text;
        }
        if (targetId.empty()) {
            EmitEvent(connection, page, page->readyHandler, L"页面失败", url, L"CDP 未找到匹配该网址的可调试页面；可改用 CDP_新建页面。");
            ReleasePage(page->id, false);
            return;
        }
        {
            std::lock_guard<std::mutex> lock(page->mutex);
            page->targetId = targetId;
        }
        if (!connection->connected.load()) {
            EmitEvent(connection, page, page->readyHandler, L"页面失败", url, L"CDP 连接已断开。");
            ReleasePage(page->id, false);
            return;
        }
        SendCommand(connection, L"Target.attachToTarget", L"{\"targetId\":" + LingCdpJson::Escape(targetId) + L",\"flatten\":true}",
                    PendingKind::AttachTarget, page->readyHandler, std::to_wstring(page->id), L"");
    }

    bool UpgradeWebSocket(const std::shared_ptr<Connection>& connection, const std::wstring& webSocketUrl) {
        std::wstring normalized = webSocketUrl;
        if (normalized.rfind(L"ws://", 0) == 0) normalized.replace(0, 5, L"http://");
        else if (normalized.rfind(L"wss://", 0) == 0) normalized.replace(0, 6, L"https://");
        URL_COMPONENTSW parts = {};
        parts.dwStructSize = sizeof(parts);
        parts.dwSchemeLength = static_cast<DWORD>(-1);
        parts.dwHostNameLength = static_cast<DWORD>(-1);
        parts.dwUrlPathLength = static_cast<DWORD>(-1);
        parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(normalized.c_str(), 0, 0, &parts))
            return ConnectionFail(connection, L"CDP 无法解析 WebSocket 调试地址。", true), false;
        const bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
        std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/";
        if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
        HINTERNET session = WinHttpOpen(L"LingBuilder CDP Client/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        if (!session) return ConnectionFail(connection, L"CDP 无法创建 WinHTTP 会话。", true), false;
        PublishHandle(connection, 1, session);
        WinHttpSetTimeouts(session, 10000, 10000, 10000, 60000);
        HINTERNET connect = WinHttpConnect(session, host.c_str(), parts.nPort, 0);
        if (!connect) return ConnectionFail(connection, L"CDP 无法连接调试端口主机。", true), false;
        PublishHandle(connection, 2, connect);
        HINTERNET request = WinHttpOpenRequest(connect, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, secure ? WINHTTP_FLAG_SECURE : 0);
        if (!request) return ConnectionFail(connection, L"CDP 无法创建 WebSocket 握手请求。", true), false;
        PublishHandle(connection, 3, request);
        if (!WinHttpSetOption(request, WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0))
            return ConnectionFail(connection, L"CDP 无法启用 WebSocket 协议升级。", true), false;
        if (!WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
            return ConnectionFail(connection, L"CDP WebSocket 握手请求发送失败。", true), false;
        if (!WinHttpReceiveResponse(request, nullptr))
            return ConnectionFail(connection, L"CDP WebSocket 握手响应接收失败。", true), false;
        HINTERNET socket = WinHttpWebSocketCompleteUpgrade(request, 0);
        if (!socket) return ConnectionFail(connection, L"CDP WebSocket 协议升级失败。", true), false;
        {
            std::lock_guard<std::mutex> lock(connection->handlesMutex);
            if (connection->wsSocket) WinHttpCloseHandle(connection->wsSocket);
            connection->wsSocket = socket;
            connection->session = session;
            connection->connect = connect;
        }
        return true;
    }

    void ReceiveLoop(const std::shared_ptr<Connection>& connection) {
        std::string payload;
        while (!connection->stopRequested.load() && connection->connected.load()) {
            unsigned char buffer[16384] = {};
            DWORD read = 0;
            WINHTTP_WEB_SOCKET_BUFFER_TYPE type = WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE;
            HINTERNET socket = nullptr;
            { std::lock_guard<std::mutex> lock(connection->handlesMutex); socket = connection->wsSocket; }
            if (!socket) break;
            const DWORD result = WinHttpWebSocketReceive(socket, buffer, sizeof(buffer), &read, &type);
            if (result != ERROR_SUCCESS) {
                if (result == ERROR_WINHTTP_TIMEOUT && !connection->stopRequested.load()) continue;
                break;
            }
            if (type == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) break;
            const bool fragment = type == WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE || type == WINHTTP_WEB_SOCKET_BINARY_FRAGMENT_BUFFER_TYPE;
            if (type != WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE && type != WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE) {
                payload.clear();
                continue;
            }
            payload.append(reinterpret_cast<const char*>(buffer), read);
            if (payload.size() > 64 * 1024 * 1024) {
                ConnectionFail(connection, L"CDP 接收消息超过 64MB 上限。", false);
                break;
            }
            if (fragment) continue;
            HandleTextMessage(connection, payload);
            payload.clear();
        }
    }

    void HandleTextMessage(const std::shared_ptr<Connection>& connection, const std::string& utf8) {
        std::wstring parseError;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(utf8.data(), utf8.size(), parseError);
        if (!root) {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->lastError = L"CDP 收到无法解析的消息：" + parseError;
            return;
        }
        const auto idField = root->Find(L"id");
        if (idField && idField->kind == LingCdpJson::Value::Kind::Number) {
            const long long messageId = static_cast<long long>(idField->number);
            Pending pending;
            bool found = false;
            {
                std::lock_guard<std::mutex> lock(connection->pendingMutex);
                const auto entry = connection->pending.find(messageId);
                if (entry != connection->pending.end()) {
                    pending = entry->second;
                    connection->pending.erase(entry);
                    found = true;
                }
            }
            if (!found) return;
            if (pending.kind == PendingKind::Internal) {
                const auto errorField = root->Find(L"error");
                if (errorField && errorField->kind == LingCdpJson::Value::Kind::Object) {
                    std::wstring message = L"CDP 内部命令失败：" + pending.method;
                    const auto codeField = errorField->Find(L"code");
                    const auto messageField = errorField->Find(L"message");
                    if (messageField && messageField->kind == LingCdpJson::Value::Kind::String) message += L"：" + messageField->text;
                    if (codeField && codeField->kind == LingCdpJson::Value::Kind::Number) message += L"（错误码 " + LingCdpJson::NumberText(codeField->number) + L"）";
                    std::lock_guard<std::mutex> lock(connection->mutex);
                    connection->lastError = message;
                }
                return;
            }
            HandleResponse(connection, pending, root);
            return;
        }
        const auto methodField = root->Find(L"method");
        if (!methodField || methodField->kind != LingCdpJson::Value::Kind::String) return;
        const auto paramsField = root->Find(L"params");
        const auto sessionField = root->Find(L"sessionId");
        std::wstring sessionId;
        if (sessionField && sessionField->kind == LingCdpJson::Value::Kind::String) sessionId = sessionField->text;
        HandleEvent(connection, methodField->text, paramsField, sessionId);
    }

    void HandleResponse(const std::shared_ptr<Connection>& connection, const Pending& pending, const LingCdpJson::ValuePtr& root) {
        const auto errorField = root->Find(L"error");
        if (errorField && errorField->kind == LingCdpJson::Value::Kind::Object) {
            std::wstring message = L"CDP 协议错误";
            long long code = 0;
            const auto codeField = errorField->Find(L"code");
            const auto messageField = errorField->Find(L"message");
            if (codeField && codeField->kind == LingCdpJson::Value::Kind::Number) code = static_cast<long long>(codeField->number);
            if (messageField && messageField->kind == LingCdpJson::Value::Kind::String) message = messageField->text;
            EmitCommand(connection, pending, false, message, code);
            return;
        }
        const auto result = root->Find(L"result");
        if (!result) {
            EmitCommand(connection, pending, true, L"", 0);
            return;
        }
        switch (pending.kind) {
            case PendingKind::TextResult: {
                std::wstring text;
                std::wstring failure;
                if (!ExtractResultText(result, text, failure)) {
                    EmitCommand(connection, pending, false, failure, 0);
                    return;
                }
                EmitCommand(connection, pending, true, text, 0);
                return;
            }
            case PendingKind::WriteBase64File: {
                const auto dataField = result->Find(L"data");
                if (!dataField || dataField->kind != LingCdpJson::Value::Kind::String || dataField->text.empty()) {
                    EmitCommand(connection, pending, false, L"CDP 未返回截图或 PDF 数据。", 0);
                    return;
                }
                std::vector<unsigned char> bytes;
                if (!Base64Decode(dataField->text, bytes) || bytes.empty()) {
                    EmitCommand(connection, pending, false, L"CDP 截图或 PDF 数据 base64 解码失败。", 0);
                    return;
                }
                if (!WriteFileBytes(pending.aux, bytes)) {
                    EmitCommand(connection, pending, false, L"CDP 无法写入文件：" + pending.aux, 0);
                    return;
                }
                EmitCommand(connection, pending, true, pending.aux, 0);
                return;
            }
            case PendingKind::CreateTarget: {
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                const auto targetField = result->Find(L"targetId");
                if (!page || !targetField || targetField->kind != LingCdpJson::Value::Kind::String) {
                    if (page) {
                        EmitEvent(connection, page, pending.handler, L"页面失败", page->url, L"CDP 新建标签页失败。");
                        ReleasePage(pageId, false);
                    }
                    return;
                }
                {
                    std::lock_guard<std::mutex> lock(page->mutex);
                    page->targetId = targetField->text;
                }
                SendCommand(connection, L"Target.attachToTarget", L"{\"targetId\":" + LingCdpJson::Escape(targetField->text) + L",\"flatten\":true}",
                            PendingKind::AttachWaitLoad, pending.handler, std::to_wstring(page->id), L"");
                return;
            }
            case PendingKind::AttachTarget: {
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                const auto sessionField = result->Find(L"sessionId");
                if (!page || !sessionField || sessionField->kind != LingCdpJson::Value::Kind::String) {
                    if (page) {
                        EmitEvent(connection, page, pending.handler, L"页面失败", page->url, L"CDP 附加标签页会话失败。");
                        ReleasePage(pageId, false);
                    }
                    return;
                }
                {
                    std::lock_guard<std::mutex> lock(page->mutex);
                    page->sessionId = sessionField->text;
                }
                SendCommand(connection, L"Page.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Runtime.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Network.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Log.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                EmitEvent(connection, page, pending.handler, L"页面就绪", page->url, L"");
                return;
            }
            case PendingKind::AttachWaitLoad: {
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                const auto sessionField = result->Find(L"sessionId");
                if (!page || !sessionField || sessionField->kind != LingCdpJson::Value::Kind::String) {
                    if (page) {
                        EmitEvent(connection, page, pending.handler, L"页面失败", page->url, L"CDP 附加标签页会话失败。");
                        ReleasePage(pageId, false);
                    }
                    return;
                }
                int timeoutMs = 30000;
                { std::lock_guard<std::mutex> connLock(connection->mutex); timeoutMs = connection->commandTimeoutMs; }
                std::wstring targetUrl;
                {
                    std::lock_guard<std::mutex> lock(page->mutex);
                    page->sessionId = sessionField->text;
                    page->readyPending = true;
                    page->readyHandler = pending.handler;
                    page->readyDeadlineValid = true;
                    page->readyDeadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs * 2);
                    targetUrl = page->url;
                }
                SendCommand(connection, L"Page.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Runtime.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Network.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Log.enable", L"{}", PendingKind::Internal, L"", L"", sessionField->text);
                SendCommand(connection, L"Page.navigate", L"{\"url\":" + LingCdpJson::Escape(targetUrl) + L"}",
                            PendingKind::NavigateWait, pending.handler, std::to_wstring(page->id), sessionField->text);
                return;
            }
            case PendingKind::CheckReady: {
                std::wstring text;
                std::wstring failure;
                if (!ExtractResultText(result, text, failure)) return;
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                if (!page || text != L"complete") return;
                std::wstring handler;
                {
                    std::lock_guard<std::mutex> lock(page->mutex);
                    if (!page->readyPending) return;
                    page->readyPending = false;
                    handler = page->readyHandler;
                    page->readyHandler.clear();
                }
                EmitEvent(connection, page, handler, L"页面就绪", page->url, L"");
                return;
            }
            case PendingKind::NavigateWait: {
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                if (!page) {
                    EmitCommand(connection, pending, false, L"CDP 页面已释放，导航结果无法投递。", 0);
                    return;
                }
                int timeoutMs = 30000;
                { std::lock_guard<std::mutex> lock(connection->mutex); timeoutMs = connection->commandTimeoutMs; }
                {
                    std::lock_guard<std::mutex> lock(page->mutex);
                    page->loadPending = true;
                    page->pendingLoadHandler = pending.handler;
                    page->loadDeadlineValid = true;
                    page->loadDeadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs * 2);
                }
                return;
            }
            case PendingKind::SetFiles: {
                const auto inner = result->Find(L"result");
                const auto objectId = inner && inner->kind == LingCdpJson::Value::Kind::Object ? inner->Find(L"objectId") : nullptr;
                const size_t separator = pending.aux.find(L'\t');
                const long long pageId = _wtoi64(pending.aux.substr(0, separator).c_str());
                const std::wstring filePath = separator == std::wstring::npos ? L"" : pending.aux.substr(separator + 1);
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                if (!objectId || objectId->kind != LingCdpJson::Value::Kind::String || !page) {
                    EmitCommand(connection, pending, false, L"CDP 未找到匹配元素，无法设置上传文件。", 0);
                    return;
                }
                const std::wstring params = L"{\"files\":[" + LingCdpJson::Escape(filePath) + L"],\"objectId\":"
                    + LingCdpJson::Escape(objectId->text) + L"}";
                if (!SendCommand(connection, L"DOM.setFileInputFiles", params, PendingKind::Internal, L"", L"", page->sessionId)) {
                    EmitCommand(connection, pending, false, L"CDP 设置上传文件失败。", 0);
                    return;
                }
                EmitCommand(connection, pending, true, filePath, 0);
                return;
            }
            case PendingKind::GetWindowId: {
                const auto windowIdField = result->Find(L"windowId");
                const size_t separator = pending.aux.find(L'\t');
                const long long pageId = _wtoi64(pending.aux.substr(0, separator).c_str());
                const std::wstring rest = separator == std::wstring::npos ? L"" : pending.aux.substr(separator + 1);
                if (!windowIdField || windowIdField->kind != LingCdpJson::Value::Kind::Number) {
                    EmitCommand(connection, pending, false, L"CDP 无法取得浏览器窗口编号。", 0);
                    return;
                }
                std::vector<std::wstring> parts;
                size_t start = 0;
                while (start <= rest.size()) {
                    size_t end = rest.find(L'\t', start);
                    if (end == std::wstring::npos) end = rest.size();
                    parts.push_back(rest.substr(start, end - start));
                    if (end == rest.size()) break;
                    start = end + 1;
                }
                if (parts.size() != 4) {
                    EmitCommand(connection, pending, false, L"CDP 窗口边界参数无效。", 0);
                    return;
                }
                const std::wstring params = L"{\"windowId\":" + LingCdpJson::NumberText(windowIdField->number)
                    + L",\"bounds\":{\"left\":" + parts[0] + L",\"top\":" + parts[1] + L",\"width\":" + parts[2] + L",\"height\":" + parts[3] + L"}}";
                if (!SendCommand(connection, L"Browser.setWindowBounds", params, PendingKind::Internal, L"", L"", L"")) {
                    EmitCommand(connection, pending, false, L"CDP 设置窗口边界失败。", 0);
                    return;
                }
                EmitCommand(connection, pending, true, L"", 0);
                return;
            }
            case PendingKind::OverlayRect: {
                std::wstring text,failure;std::vector<double> rect;if(!ExtractResultText(result,text,failure)||!ParseNumbers(text,4,rect))return;
                std::wstring color=pending.aux.rfind(L"overlay\t",0)==0?pending.aux.substr(8):L"rgba(111,168,220,0.35)";
                // CDP RGBA 对象无法直接消费 CSS 字符串，当前固定使用可靠的蓝色半透明高亮。
                SendCommand(connection,L"Overlay.highlightRect",L"{\"x\":"+LingCdpJson::NumberText(rect[0])+L",\"y\":"+LingCdpJson::NumberText(rect[1])+L",\"width\":"+LingCdpJson::NumberText(rect[2])+L",\"height\":"+LingCdpJson::NumberText(rect[3])+L",\"color\":{\"r\":111,\"g\":168,\"b\":220,\"a\":0.35}}",PendingKind::Internal,L"",color,pending.expectedSessionId);return;
            }
            case PendingKind::AttachGenericTarget: {
                const long long sessionHandle=_wtoi64(pending.aux.c_str());auto session=FindSession(sessionHandle);auto sid=result->Find(L"sessionId");if(!session||!sid||sid->kind!=LingCdpJson::Value::Kind::String){EmitCommand(connection,pending,false,L"CDP 附加目标失败。",0);return;}{std::lock_guard<std::mutex> lock(stage3Mutex_);session->sessionId=sid->text;session->attached=true;sessionByProtocolId_[sid->text]=session->id;auto target=targets_.find(session->targetHandle);if(target!=targets_.end()){target->second->sessionHandle=session->id;target->second->attached=true;}}SendCommand(connection,L"Runtime.enable",L"{}",PendingKind::Internal,L"",L"",sid->text);EmitCommand(connection,pending,true,std::to_wstring(sessionHandle),0);return;
            }
            case PendingKind::AddBinding: EmitCommand(connection,pending,true,pending.aux,0); return;
            case PendingKind::SetBreakpoint: {
                const long long id=_wtoi64(pending.aux.c_str());auto bp=FindBreakpoint(id);auto protocol=result->Find(L"breakpointId");if(!bp||!protocol||protocol->kind!=LingCdpJson::Value::Kind::String){EmitCommand(connection,pending,false,L"CDP 设置断点失败。",0);return;}bp->cdpId=protocol->text;bp->active=true;bp->snapshotJson=LingCdpJson::Serialize(result);EmitCommand(connection,pending,true,bp->snapshotJson,0);return;
            }
            case PendingKind::DebugEvaluate:
            case PendingKind::DebugProperties:
            case PendingKind::PerformanceMetrics:
            case PendingKind::StorageUsage: EmitCommand(connection,pending,true,LingCdpJson::Serialize(result),0); return;
            case PendingKind::WriteJsonFile:
            case PendingKind::CreateTaskFromResponse: {
                std::string utf8;const std::wstring json=LingCdpJson::Serialize(result);if(!LingCdpJson::WideToUtf8(json,utf8)||!WriteFileBytesAtomic(pending.outputPath.empty()?pending.aux:pending.outputPath,std::vector<unsigned char>(utf8.begin(),utf8.end()))){EmitCommand(connection,pending,false,L"CDP 无法原子写入任务输出。",0);return;}EmitCommand(connection,pending,true,pending.outputPath.empty()?pending.aux:pending.outputPath,0);return;
            }
            case PendingKind::IoRead: {
                auto task=FindTask(pending.taskId);if(!task)return;auto data=result->Find(L"data");auto eof=result->Find(L"eof");if(data&&data->kind==LingCdpJson::Value::Kind::String)WriteTaskChunk(task,data->text);if(eof&&eof->kind==LingCdpJson::Value::Kind::Bool&&eof->boolean){CloseTaskFile(task,true);task->terminal=true;task->state=L"已完成";SendCommand(connection,L"IO.close",L"{\"handle\":"+LingCdpJson::Escape(task->ioHandle)+L"}",PendingKind::Internal,L"",L"",L"");}else ReadIoStream(connection,task);return;
            }
            case PendingKind::ElementShotRect: {
                std::wstring text;
                std::wstring failure;
                if (!ExtractResultText(result, text, failure)) {
                    EmitCommand(connection, pending, false, failure, 0);
                    return;
                }
                std::vector<double> rect;
                if (!ParseNumbers(text, 4, rect)) {
                    EmitCommand(connection, pending, false, L"CDP 未找到匹配元素，无法截图。", 0);
                    return;
                }
                const size_t separator = pending.aux.find(L'\t');
                const long long pageId = _wtoi64(pending.aux.substr(0, separator).c_str());
                const std::wstring filePath = separator == std::wstring::npos ? L"" : pending.aux.substr(separator + 1);
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                if (!page) {
                    EmitCommand(connection, pending, false, L"CDP 页面已释放，截图无法完成。", 0);
                    return;
                }
                std::wstring params = L"{\"format\":\"png\",\"clip\":{\"x\":" + LingCdpJson::NumberText(rect[0])
                    + L",\"y\":" + LingCdpJson::NumberText(rect[1]) + L",\"width\":" + LingCdpJson::NumberText(rect[2])
                    + L",\"height\":" + LingCdpJson::NumberText(rect[3]) + L",\"scale\":1}}";
                if (!SendCommand(connection, L"Page.captureScreenshot", params, PendingKind::WriteBase64File,
                                 pending.handler, filePath, page->sessionId)) {
                    EmitCommand(connection, pending, false, L"CDP 元素截图请求失败。", 0);
                    return;
                }
                return;
            }
            case PendingKind::SuccessOnly: {
                const auto successField = result->Find(L"success");
                if (successField && successField->kind == LingCdpJson::Value::Kind::Bool && !successField->boolean) {
                    EmitCommand(connection, pending, false, L"浏览器拒绝了该操作（success=false）。", 0);
                    return;
                }
                EmitCommand(connection, pending, true, L"", 0);
                return;
            }
            case PendingKind::ElementClick: {
                std::wstring text;
                std::wstring failure;
                if (!ExtractResultText(result, text, failure)) {
                    EmitCommand(connection, pending, false, failure, 0);
                    return;
                }
                LingCdpJson::ValuePtr point;
                if (!ParsePoint(text, point)) {
                    EmitCommand(connection, pending, false, L"CDP 未找到匹配元素，无法点击。", 0);
                    return;
                }
                const double x = point->array[0]->number;
                const double y = point->array[1]->number;
                const long long pageId = _wtoi64(pending.aux.c_str());
                const std::shared_ptr<PageSession> page = FindPage(pageId);
                if (!page || !MouseClick(pageId, static_cast<int>(x), static_cast<int>(y), 0, 1)) {
                    EmitCommand(connection, pending, false, L"CDP 元素点击失败。", 0);
                    return;
                }
                EmitCommand(connection, pending, true, L"", 0);
                return;
            }
            case PendingKind::FocusThenType: {
                std::wstring text;
                std::wstring failure;
                if (!ExtractResultText(result, text, failure)) {
                    EmitCommand(connection, pending, false, failure, 0);
                    return;
                }
                if (text.empty() || text == L"null") {
                    EmitCommand(connection, pending, false, L"CDP 未找到匹配元素，无法输入文本。", 0);
                    return;
                }
                const size_t separator = pending.aux.find(L'\t');
                const long long targetPage = _wtoi64(pending.aux.substr(0, separator).c_str());
                const std::wstring inputText = separator == std::wstring::npos ? L"" : pending.aux.substr(separator + 1);
                if (!TypeTextIntoPage(targetPage, inputText)) {
                    EmitCommand(connection, pending, false, L"CDP 文本输入失败。", 0);
                    return;
                }
                EmitCommand(connection, pending, true, L"", 0);
                return;
            }
            default:
                return;
        }
    }

    bool ExtractResultText(const LingCdpJson::ValuePtr& result, std::wstring& text, std::wstring& failure) {
        const auto exception = result->Find(L"exceptionDetails");
        if (exception && exception->kind == LingCdpJson::Value::Kind::Object) {
            failure = L"页面脚本执行异常";
            const auto textField = exception->Find(L"text");
            if (textField && textField->kind == LingCdpJson::Value::Kind::String) failure = textField->text;
            const auto detail = exception->Find(L"exception");
            if (detail && detail->kind == LingCdpJson::Value::Kind::Object) {
                const auto description = detail->Find(L"description");
                if (description && description->kind == LingCdpJson::Value::Kind::String) failure += L"：" + description->text;
            }
            return false;
        }
        const auto inner = result->Find(L"result");
        if (inner && inner->kind == LingCdpJson::Value::Kind::Object) {
            const auto type = inner->Find(L"type");
            const auto value = inner->Find(L"value");
            if (type && type->kind == LingCdpJson::Value::Kind::String && type->text == L"undefined") {
                text = L"undefined";
                return true;
            }
            if (value) {
                if (value->kind == LingCdpJson::Value::Kind::String) { text = value->text; return true; }
                if (value->kind == LingCdpJson::Value::Kind::Number) { text = LingCdpJson::NumberText(value->number); return true; }
                if (value->kind == LingCdpJson::Value::Kind::Bool) { text = value->boolean ? L"真" : L"假"; return true; }
                text = LingCdpJson::Serialize(value);
                return true;
            }
            text = L"null";
            return true;
        }
        const auto body = result->Find(L"body");
        if (body && body->kind == LingCdpJson::Value::Kind::String) {
            const auto encoded = result->Find(L"base64Encoded");
            if (encoded && encoded->kind == LingCdpJson::Value::Kind::Bool && encoded->boolean) {
                std::vector<unsigned char> bytes;
                if (Base64Decode(body->text, bytes)) {
                    text = LingCdpJson::Utf8ToWide(reinterpret_cast<const char*>(bytes.data()), bytes.size());
                    return true;
                }
                failure = L"CDP 响应体 base64 解码失败。";
                return false;
            }
            text = body->text;
            return true;
        }
        text = LingCdpJson::Serialize(result);
        return true;
    }

    void HandleEvent(const std::shared_ptr<Connection>& connection, const std::wstring& method,
                     const LingCdpJson::ValuePtr& params, const std::wstring& sessionId) {
        if (method == L"Target.attachedToTarget") { HandleAttachedTarget(connection,params,sessionId); return; }
        if (method == L"Target.detachedFromTarget") { HandleDetachedTarget(connection,params); return; }
        if (method == L"Page.frameAttached" || method == L"Page.frameDetached") { HandleFrameLifecycle(connection,method,params,sessionId); return; }
        if (method == L"Runtime.executionContextCreated" || method == L"Runtime.executionContextDestroyed" || method == L"Runtime.executionContextsCleared") { HandleExecutionContext(connection,method,params,sessionId); return; }
        if (method == L"Runtime.bindingCalled") { HandleBindingCalled(connection,params,sessionId); return; }
        if (method == L"Debugger.paused" || method == L"Debugger.resumed" || method == L"Debugger.breakpointResolved") { HandleDebuggerEvent(connection,method,params,sessionId); return; }
        if (method == L"Security.certificateError") { HandleCertificateError(connection,params); return; }
        if (method == L"Security.securityStateChanged") { EmitConnection(connection,L"安全状态",params?LingCdpJson::Serialize(params):L"",L"",false); return; }
        if (method == L"HeapProfiler.addHeapSnapshotChunk" || method == L"HeapProfiler.reportHeapSnapshotProgress" || method == L"Tracing.tracingComplete") { HandleTaskEvent(connection,method,params,sessionId); return; }
        if (method == L"Page.loadEventFired") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            std::wstring type;
            std::wstring url;
            {
                std::lock_guard<std::mutex> lock(page->mutex);
                url = page->url;
                if (page->readyPending) {
                    page->readyPending = false;
                    page->readyDeadlineValid = false;
                    handler = page->readyHandler;
                    page->readyHandler.clear();
                    page->loadPending = false;
                    page->pendingLoadHandler.clear();
                    type = L"页面就绪";
                } else if (page->loadPending) {
                    page->loadPending = false;
                    page->loadDeadlineValid = false;
                    handler = page->pendingLoadHandler;
                    page->pendingLoadHandler.clear();
                    type = L"加载完成";
                } else return;
            }
            EmitEvent(connection, page, handler, type, url, L"");
            return;
        }
        if (method == L"Page.lifecycleEvent") {
            if (!params) return;
            const auto nameField = params->Find(L"name");
            if (!nameField || nameField->kind != LingCdpJson::Value::Kind::String) return;
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            {
                std::lock_guard<std::mutex> lock(page->mutex);
                if (!page->lifecyclePending || page->pendingLifecycleName != nameField->text) return;
                page->lifecyclePending = false;
                handler = page->pendingLifecycleHandler;
                page->pendingLifecycleHandler.clear();
                page->pendingLifecycleName.clear();
            }
            EmitEvent(connection, page, handler, L"命令完成", nameField->text, L"");
            return;
        }
        if (method == L"Page.javascriptDialogOpening") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->dialogHandler; }
            if (handler.empty()) {
                // 未绑定处理器时自动拒绝，避免页面脚本永久阻塞。
                SendCommand(connection, L"Page.handleJavaScriptDialog", L"{\"accept\":false}", PendingKind::Internal, L"", L"", sessionId);
                return;
            }
            std::wstring message;
            std::wstring dialogType;
            std::wstring defaultPrompt;
            if (params) {
                const auto messageField = params->Find(L"message");
                const auto typeField = params->Find(L"type");
                const auto promptField = params->Find(L"defaultPrompt");
                if (messageField && messageField->kind == LingCdpJson::Value::Kind::String) message = messageField->text;
                if (typeField && typeField->kind == LingCdpJson::Value::Kind::String) dialogType = typeField->text;
                if (promptField && promptField->kind == LingCdpJson::Value::Kind::String) defaultPrompt = promptField->text;
            }
            auto event = std::make_shared<Event>();
            event->id = nextEventId_.fetch_add(1);
            event->connectionId = connection->id;
            event->pageId = page->id;
            event->handler = handler;
            event->type = L"对话框出现";
            event->text = message;
            event->detail = dialogType;
            event->auxText = defaultPrompt;
            PublishEvent(event);
            return;
        }
        if (method == L"Fetch.requestPaused" || method == L"Fetch.authRequired") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            const bool needsAuth = method == L"Fetch.authRequired";
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->interceptHandler; }
            if (!params) return;
            const auto requestIdField = params->Find(L"requestId");
            if (!requestIdField || requestIdField->kind != LingCdpJson::Value::Kind::String) return;
            const auto request = params->Find(L"request");
            std::wstring requestUrl;
            std::wstring requestMethod;
            std::wstring headersJson = L"{}";
            bool hasPostData = false;
            if (request && request->kind == LingCdpJson::Value::Kind::Object) {
                const auto urlField = request->Find(L"url");
                const auto methodField = request->Find(L"method");
                const auto headersField = request->Find(L"headers");
                const auto postField = request->Find(L"hasPostData");
                if (urlField && urlField->kind == LingCdpJson::Value::Kind::String) requestUrl = urlField->text;
                if (methodField && methodField->kind == LingCdpJson::Value::Kind::String) requestMethod = methodField->text;
                if (headersField) headersJson = LingCdpJson::Serialize(headersField);
                if (postField && postField->kind == LingCdpJson::Value::Kind::Bool) hasPostData = postField->boolean;
            }
            auto reference = std::make_shared<InterceptRef>();
            reference->id = nextInterceptId_.fetch_add(1);
            reference->connectionId = connection->id;
            reference->pageId = page->id;
            reference->requestId = requestIdField->text;
            reference->url = requestUrl;
            reference->method = requestMethod;
            reference->headersJson = headersJson;
            reference->hasPostData = hasPostData;
            reference->needsAuth = needsAuth;
            {
                std::lock_guard<std::mutex> lock(interceptsMutex_);
                if (intercepts_.size() >= 4096) intercepts_.clear();
                intercepts_[reference->id] = reference;
            }
            if (handler.empty()) {
                // 未绑定处理器（例如停止拦截竞态期）时自动放行，避免浏览器网络挂起。
                const std::wstring params = needsAuth
                    ? L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L",\"response\":\"CancelAuth\"}"
                    : L"{\"requestId\":" + LingCdpJson::Escape(reference->requestId) + L"}";
                SendCommand(connection, needsAuth ? L"Fetch.continueWithAuth" : L"Fetch.continueRequest",
                    params, PendingKind::Internal, L"", L"", L"");
                return;
            }
            auto event = std::make_shared<Event>();
            event->id = nextEventId_.fetch_add(1);
            event->connectionId = connection->id;
            event->pageId = page->id;
            event->handler = handler;
            event->type = needsAuth ? L"需要认证" : L"请求被拦截";
            event->text = headersJson;
            event->detail = needsAuth ? L"认证挑战" : L"请求阶段";
            event->netUrl = requestUrl;
            event->netMethod = requestMethod;
            event->netRequestId = reference->requestId;
            event->interceptId = reference->id;
            const auto responseStatus = params->Find(L"responseStatusCode");
            if (responseStatus && responseStatus->kind == LingCdpJson::Value::Kind::Number) {
                event->detail = L"响应阶段";
                event->netStatus = static_cast<int>(responseStatus->number);
            }
            PublishEvent(event);
            return;
        }
        if (method == L"Browser.downloadWillBegin" || method == L"Browser.downloadProgress") {
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(connection->mutex); handler = connection->downloadHandler; }
            if (handler.empty() || !params) return;
            const auto guidField = params->Find(L"guid");
            if (!guidField || guidField->kind != LingCdpJson::Value::Kind::String) return;
            const std::wstring guid = guidField->text;
            if (method == L"Browser.downloadWillBegin") {
                const auto nameField = params->Find(L"suggestedFilename");
                std::wstring filename = nameField && nameField->kind == LingCdpJson::Value::Kind::String ? nameField->text : guid;
                { std::lock_guard<std::mutex> lock(connection->downloadNamesMutex); connection->downloadNames[guid] = filename; }
                auto event = std::make_shared<Event>();
                event->id = nextEventId_.fetch_add(1);
                event->connectionId = connection->id;
                event->handler = handler;
                event->type = L"下载开始";
                event->text = filename;
                event->detail = guid;
                PublishEvent(event);
                return;
            }
            const auto stateField = params->Find(L"state");
            const auto totalField = params->Find(L"totalBytes");
            const auto receivedField = params->Find(L"receivedBytes");
            long long total = totalField && totalField->kind == LingCdpJson::Value::Kind::Number ? static_cast<long long>(totalField->number) : 0;
            long long received = receivedField && receivedField->kind == LingCdpJson::Value::Kind::Number ? static_cast<long long>(receivedField->number) : 0;
            std::wstring state = stateField && stateField->kind == LingCdpJson::Value::Kind::String ? stateField->text : L"InProgress";
            std::wstring filename;
            { std::lock_guard<std::mutex> lock(connection->downloadNamesMutex);
              const auto found = connection->downloadNames.find(guid);
              if (found != connection->downloadNames.end()) filename = found->second; }
            std::wstring type = L"下载进度";
            int percent = total > 0 ? static_cast<int>(received * 100 / total) : 0;
            if (state == L"Completed" || state == L"Done") { type = L"下载完成"; percent = 100; }
            else if (state == L"Canceled") type = L"下载取消";
            auto event = std::make_shared<Event>();
            event->id = nextEventId_.fetch_add(1);
            event->connectionId = connection->id;
            event->handler = handler;
            event->type = type;
            event->text = filename.empty() ? guid : filename;
            event->detail = guid;
            event->auxValue = percent;
            PublishEvent(event);
            return;
        }
        if (method == L"Target.targetCreated" || method == L"Target.targetInfoChanged") {
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(connection->mutex); handler = connection->newPageHandler; }
            if (handler.empty() || !params) return;
            const auto targetInfo = params->Find(L"targetInfo");
            if (!targetInfo || targetInfo->kind != LingCdpJson::Value::Kind::Object) return;
            const auto typeField = targetInfo->Find(L"type");
            if (!typeField || typeField->kind != LingCdpJson::Value::Kind::String || typeField->text != L"page") return;
            const auto targetIdField = targetInfo->Find(L"targetId");
            const auto urlField = targetInfo->Find(L"url");
            if (!targetIdField || targetIdField->kind != LingCdpJson::Value::Kind::String) return;
            if (method == L"Target.targetCreated") {
                auto event = std::make_shared<Event>();
                event->id = nextEventId_.fetch_add(1);
                event->connectionId = connection->id;
                event->handler = handler;
                event->type = L"新页面出现";
                event->text = urlField && urlField->kind == LingCdpJson::Value::Kind::String ? urlField->text : L"";
                event->detail = targetIdField->text;
                PublishEvent(event);
            }
            return;
        }
        if (method == L"Page.frameNavigated") {
            if (!params) return;
            const auto frame = params->Find(L"frame");
            if (!frame) return;
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            const auto urlField = frame->Find(L"url");
            if (urlField && urlField->kind == LingCdpJson::Value::Kind::String && !urlField->text.empty()) {
                std::lock_guard<std::mutex> lock(page->mutex);
                page->url = urlField->text;
            }
            return;
        }
        if (method == L"Runtime.consoleAPICalled") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            std::wstring text;
            std::wstring level;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->consoleHandler; }
            if (handler.empty()) return;
            if (params) {
                const auto typeField = params->Find(L"type");
                if (typeField && typeField->kind == LingCdpJson::Value::Kind::String) level = typeField->text;
                const auto args = params->Find(L"args");
                if (args && args->kind == LingCdpJson::Value::Kind::Array) {
                    for (size_t index = 0; index < args->array.size(); ++index) {
                        if (index) text += L" ";
                        const auto value = args->array[index]->Find(L"value");
                        if (value) text += LingCdpJson::Serialize(value);
                        else text += LingCdpJson::Serialize(args->array[index]);
                    }
                }
            }
            EmitEvent(connection, page, handler, L"控制台", text, level);
            return;
        }
        if (method == L"Runtime.exceptionThrown") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->exceptionHandler; }
            if (handler.empty()) return;
            std::wstring text;
            if (params) {
                const auto details = params->Find(L"exceptionDetails");
                if (details && details->kind == LingCdpJson::Value::Kind::Object) {
                    const auto textField = details->Find(L"text");
                    if (textField && textField->kind == LingCdpJson::Value::Kind::String) text = textField->text;
                    const auto exception = details->Find(L"exception");
                    if (exception && exception->kind == LingCdpJson::Value::Kind::Object) {
                        const auto description = exception->Find(L"description");
                        if (description && description->kind == LingCdpJson::Value::Kind::String) text += L"：" + description->text;
                    }
                }
            }
            EmitEvent(connection, page, handler, L"页面异常", text, L"");
            return;
        }
        if (method == L"Network.requestWillBeSent" || method == L"Network.responseReceived" ||
            method == L"Network.loadingFinished" || method == L"Network.loadingFailed") {
            const std::shared_ptr<PageSession> page = FindPageBySession(connection->id, sessionId);
            if (!page) return;
            std::wstring handler;
            { std::lock_guard<std::mutex> lock(page->mutex); handler = page->networkHandler; }
            if (handler.empty()) return;
            std::wstring type;
            std::wstring netUrl;
            std::wstring netMethod;
            std::wstring requestId;
            std::wstring errorText;
            int status = 0;
            if (method == L"Network.requestWillBeSent") {
                type = L"网络请求";
                if (params) {
                    const auto request = params->Find(L"request");
                    const auto idField = params->Find(L"requestId");
                    if (idField && idField->kind == LingCdpJson::Value::Kind::String) requestId = idField->text;
                    if (request && request->kind == LingCdpJson::Value::Kind::Object) {
                        const auto urlField = request->Find(L"url");
                        const auto methodField = request->Find(L"method");
                        if (urlField && urlField->kind == LingCdpJson::Value::Kind::String) netUrl = urlField->text;
                        if (methodField && methodField->kind == LingCdpJson::Value::Kind::String) netMethod = methodField->text;
                    }
                }
            } else if (method == L"Network.responseReceived") {
                type = L"网络响应";
                if (params) {
                    const auto idField = params->Find(L"requestId");
                    if (idField && idField->kind == LingCdpJson::Value::Kind::String) requestId = idField->text;
                    const auto response = params->Find(L"response");
                    if (response && response->kind == LingCdpJson::Value::Kind::Object) {
                        const auto urlField = response->Find(L"url");
                        const auto statusField = response->Find(L"status");
                        if (urlField && urlField->kind == LingCdpJson::Value::Kind::String) netUrl = urlField->text;
                        if (statusField && statusField->kind == LingCdpJson::Value::Kind::Number) status = static_cast<int>(statusField->number);
                    }
                }
            } else if (method == L"Network.loadingFinished") {
                type = L"网络完成";
                if (params) {
                    const auto idField = params->Find(L"requestId");
                    if (idField && idField->kind == LingCdpJson::Value::Kind::String) requestId = idField->text;
                }
            } else {
                type = L"网络失败";
                if (params) {
                    const auto idField = params->Find(L"requestId");
                    const auto errorField = params->Find(L"errorText");
                    if (idField && idField->kind == LingCdpJson::Value::Kind::String) requestId = idField->text;
                    if (errorField && errorField->kind == LingCdpJson::Value::Kind::String) errorText = errorField->text;
                }
            }
            EmitNetwork(connection, page, handler, type, netUrl, netMethod, requestId, status, errorText);
            return;
        }
        if (method == L"Target.targetDestroyed") {
            if (!params) return;
            const auto targetField = params->Find(L"targetId");
            if (!targetField || targetField->kind != LingCdpJson::Value::Kind::String) return;
            const std::shared_ptr<PageSession> page = FindPageByTarget(connection->id, targetField->text);
            if (page) ReleasePage(page->id, true);
            return;
        }
    }

    // ===== 命令发送 =====
    bool SendCommand(const std::shared_ptr<Connection>& connection, const std::wstring& method, const std::wstring& paramsJson,
                     int kind, const std::wstring& handler, const std::wstring& aux, const std::wstring& sessionId) {
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        const long long messageId = connection->nextMsgId.fetch_add(1);
        {
            std::lock_guard<std::mutex> lock(connection->pendingMutex);
            Pending pending;
            pending.handler = handler;
            pending.kind = kind;
            pending.aux = aux;
            pending.method = method;
            pending.submittedAt = std::chrono::steady_clock::now();
            connection->pending[messageId] = std::move(pending);
        }
        std::wstring message = L"{\"id\":" + std::to_wstring(messageId) + L",\"method\":" + LingCdpJson::Escape(method);
        if (!sessionId.empty()) message += L",\"sessionId\":" + LingCdpJson::Escape(sessionId);
        message += L",\"params\":" + (paramsJson.empty() ? L"{}" : paramsJson) + L"}";
        std::string utf8;
        if (!LingCdpJson::WideToUtf8(message, utf8)) {
            std::lock_guard<std::mutex> lock(connection->pendingMutex);
            connection->pending.erase(messageId);
            return Fail(L"CDP 命令包含无效字符，无法转换为 UTF-8。");
        }
        std::lock_guard<std::mutex> sendLock(connection->sendMutex);
        HINTERNET socket = nullptr;
        { std::lock_guard<std::mutex> lock(connection->handlesMutex); socket = connection->wsSocket; }
        if (!socket) {
            std::lock_guard<std::mutex> lock(connection->pendingMutex);
            connection->pending.erase(messageId);
            return Fail(L"CDP 底层连接已关闭。");
        }
        const DWORD result = WinHttpWebSocketSend(socket, WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,
            reinterpret_cast<unsigned char*>(utf8.data()), static_cast<DWORD>(utf8.size()));
        if (result != ERROR_SUCCESS) {
            std::lock_guard<std::mutex> lock(connection->pendingMutex);
            connection->pending.erase(messageId);
            return Fail(L"CDP 命令发送失败，错误码：" + std::to_wstring(result));
        }
        return true;
    }

    bool SendMouseEvent(long long pageId, const std::wstring& type, int x, int y, const std::wstring& button, int clickCount) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        std::wstring params = L"{\"type\":" + LingCdpJson::Escape(type) + L",\"x\":" + std::to_wstring(x) + L",\"y\":" + std::to_wstring(y) +
            L",\"button\":" + LingCdpJson::Escape(button);
        if (clickCount > 0) params += L",\"clickCount\":" + std::to_wstring(clickCount);
        params += L"}";
        return SendCommand(connection, L"Input.dispatchMouseEvent", params, PendingKind::Internal, L"", L"", page->sessionId);
    }

    bool SendKeyEvent(const std::shared_ptr<Connection>& connection, const std::wstring& sessionId,
                      const std::wstring& type, const std::wstring& key, int modifiers) {
        std::wstring params = L"{\"type\":" + LingCdpJson::Escape(type) + L",\"key\":" + LingCdpJson::Escape(key) +
            L",\"code\":" + LingCdpJson::Escape(CodeForKey(key)) + L",\"windowsVirtualKeyCode\":" + std::to_wstring(KeyToVk(key));
        if (key.size() == 1) params += L",\"text\":" + LingCdpJson::Escape(key);
        if (modifiers != 0) params += L",\"modifiers\":" + std::to_wstring(modifiers);
        params += L",\"nativeVirtualKeyCode\":" + std::to_wstring(KeyToVk(key)) + L"}";
        return SendCommand(connection, L"Input.dispatchKeyEvent", params, PendingKind::Internal, L"", L"", sessionId);
    }

    bool SimpleNavigation(long long pageId, const std::wstring& method, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, method, L"{}", PendingKind::NavigateWait, handler ? handler : L"", std::to_wstring(page->id), page->sessionId);
    }

    bool HistoryNavigation(long long pageId, int delta, const wchar_t* handler) {
        const std::shared_ptr<PageSession> page = FindPage(pageId);
        if (!page) return Fail(L"CDP 页面 ID 无效。");
        const std::shared_ptr<Connection> connection = FindConnection(page->connectionId);
        if (!connection || !connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, L"Page.navigateToHistoryEntry", L"{\"entryId\":" + std::to_wstring(delta) + L"}",
                           PendingKind::Internal, L"", L"", page->sessionId) &&
               SendCommand(connection, L"Page.reload", L"{}", PendingKind::NavigateWait, handler ? handler : L"", std::to_wstring(page->id), page->sessionId);
    }

    bool BrowserNetworkCommand(long long connectionId, const std::wstring& method, const wchar_t* handler) {
        const std::shared_ptr<Connection> connection = FindConnection(connectionId);
        if (!connection) return Fail(L"CDP 连接 ID 无效。");
        if (!connection->connected.load()) return Fail(L"CDP 连接尚未就绪。");
        return SendCommand(connection, method, L"{}", PendingKind::SuccessOnly, handler ? handler : L"", L"", L"");
    }

    void HandleAttachedTarget(const std::shared_ptr<Connection>& connection,const LingCdpJson::ValuePtr& params,const std::wstring& parentProtocolSession){if(!params)return;auto sid=params->Find(L"sessionId");auto info=params->Find(L"targetInfo");if(!sid||sid->kind!=LingCdpJson::Value::Kind::String||!info)return;auto targetId=info->Find(L"targetId");auto type=info->Find(L"type");if(!targetId||targetId->kind!=LingCdpJson::Value::Kind::String)return;std::shared_ptr<TargetState> target;std::shared_ptr<SessionState> session;{std::lock_guard<std::mutex> lock(stage3Mutex_);long long targetHandle=0;auto indexed=targetByProtocolId_.find(targetId->text);if(indexed!=targetByProtocolId_.end())targetHandle=indexed->second;else{targetHandle=nextTargetHandle_.fetch_add(1);target=std::make_shared<TargetState>();target->id=targetHandle;target->connectionId=connection->id;target->targetId=targetId->text;targets_[targetHandle]=target;targetByProtocolId_[targetId->text]=targetHandle;}if(!target)target=targets_[targetHandle];target->type=type&&type->kind==LingCdpJson::Value::Kind::String?type->text:L"unknown";auto url=info->Find(L"url");auto title=info->Find(L"title");if(url&&url->kind==LingCdpJson::Value::Kind::String)target->url=url->text;if(title&&title->kind==LingCdpJson::Value::Kind::String)target->title=title->text;target->attached=true;long long sessionHandle=target->sessionHandle?target->sessionHandle:nextSessionHandle_.fetch_add(1);session=target->sessionHandle?sessions_[sessionHandle]:std::make_shared<SessionState>();session->id=sessionHandle;session->connectionId=connection->id;session->targetHandle=target->id;session->sessionId=sid->text;session->targetType=target->type;session->attached=true;auto parent=sessionByProtocolId_.find(parentProtocolSession);session->parentSessionHandle=parent==sessionByProtocolId_.end()?0:parent->second;sessions_[sessionHandle]=session;sessionByProtocolId_[sid->text]=sessionHandle;target->sessionHandle=sessionHandle;}SendCommand(connection,L"Runtime.enable",L"{}",PendingKind::Internal,L"",L"",sid->text);if(target->type==L"page"||target->type==L"iframe")SendCommand(connection,L"Page.enable",L"{}",PendingKind::Internal,L"",L"",sid->text);ReplayBindingsForConnection(connection->id);auto waiting=params->Find(L"waitingForDebugger");if(waiting&&waiting->kind==LingCdpJson::Value::Kind::Bool&&waiting->boolean)SendCommand(connection,L"Runtime.runIfWaitingForDebugger",L"{}",PendingKind::Internal,L"",L"",sid->text);std::wstring handler;{std::lock_guard<std::mutex> lock(connection->mutex);handler=connection->targetHandler;}auto event=std::make_shared<Event>();event->id=nextEventId_.fetch_add(1);event->connectionId=connection->id;event->handler=handler;event->type=L"目标已附加";event->targetHandle=target->id;event->sessionHandle=session->id;event->text=target->url;event->detail=target->type;PublishEvent(event);}

    void HandleDetachedTarget(const std::shared_ptr<Connection>& connection,const LingCdpJson::ValuePtr& params){if(!params)return;auto sid=params->Find(L"sessionId");if(!sid||sid->kind!=LingCdpJson::Value::Kind::String)return;std::shared_ptr<SessionState> session;{std::lock_guard<std::mutex> lock(stage3Mutex_);auto indexed=sessionByProtocolId_.find(sid->text);if(indexed==sessionByProtocolId_.end())return;session=sessions_[indexed->second];session->attached=false;++session->generation;sessionByProtocolId_.erase(indexed);for(long long frame:session->debugger.currentFrameHandles)callFrames_.erase(frame);session->debugger.currentFrameHandles.clear();session->debugger.paused=false;}FailPendingForSession(connection,sid->text,L"CDP 目标会话已分离。");std::wstring handler;{std::lock_guard<std::mutex> lock(connection->mutex);handler=connection->targetHandler;}auto event=std::make_shared<Event>();event->id=nextEventId_.fetch_add(1);event->connectionId=connection->id;event->handler=handler;event->type=L"目标已分离";event->sessionHandle=session->id;event->targetHandle=session->targetHandle;PublishEvent(event);}

    void HandleFrameLifecycle(const std::shared_ptr<Connection>& connection,const std::wstring& method,const LingCdpJson::ValuePtr& params,const std::wstring& sid){if(!params)return;auto id=params->Find(L"frameId");if(!id||id->kind!=LingCdpJson::Value::Kind::String)return;std::lock_guard<std::mutex> lock(stage3Mutex_);if(method==L"Page.frameDetached"){auto found=frameByProtocolId_.find(id->text);if(found!=frameByProtocolId_.end()){frames_.erase(found->second);frameByProtocolId_.erase(found);}return;}auto frame=std::make_shared<FrameState>();frame->id=nextFrameHandle_.fetch_add(1);frame->connectionId=connection->id;frame->frameId=id->text;auto session=sessionByProtocolId_.find(sid);frame->sessionHandle=session==sessionByProtocolId_.end()?0:session->second;frames_[frame->id]=frame;frameByProtocolId_[frame->frameId]=frame->id;}
    void HandleExecutionContext(const std::shared_ptr<Connection>& connection,const std::wstring& method,const LingCdpJson::ValuePtr& params,const std::wstring& sid){std::lock_guard<std::mutex> lock(stage3Mutex_);if(method==L"Runtime.executionContextsCleared"){for(auto it=contexts_.begin();it!=contexts_.end();)if(it->second->connectionId==connection->id)it=contexts_.erase(it);else++it;return;}if(!params)return;auto context=method==L"Runtime.executionContextCreated"?params->Find(L"context"):nullptr;auto id=context?context->Find(L"id"):params->Find(L"executionContextId");if(!id||id->kind!=LingCdpJson::Value::Kind::Number)return;if(method==L"Runtime.executionContextDestroyed"){for(auto it=contexts_.begin();it!=contexts_.end();)if(it->second->connectionId==connection->id&&it->second->contextId==static_cast<long long>(id->number))it=contexts_.erase(it);else++it;return;}auto state=std::make_shared<ExecutionContextState>();state->id=nextContextHandle_.fetch_add(1);state->connectionId=connection->id;state->contextId=static_cast<long long>(id->number);auto session=sessionByProtocolId_.find(sid);state->sessionHandle=session==sessionByProtocolId_.end()?0:session->second;auto origin=context->Find(L"origin");auto name=context->Find(L"name");if(origin&&origin->kind==LingCdpJson::Value::Kind::String)state->origin=origin->text;if(name&&name->kind==LingCdpJson::Value::Kind::String)state->name=name->text;contexts_[state->id]=state;}

    void HandleBindingCalled(const std::shared_ptr<Connection>& connection,const LingCdpJson::ValuePtr& params,const std::wstring& sid){if(!params)return;auto name=params->Find(L"name");auto payload=params->Find(L"payload");if(!name||!payload||name->kind!=LingCdpJson::Value::Kind::String||payload->kind!=LingCdpJson::Value::Kind::String||payload->text.size()>8*1024*1024)return;std::shared_ptr<BindingState> binding;{std::lock_guard<std::mutex> lock(stage3Mutex_);for(auto&p:bindings_)if(p.second->connectionId==connection->id&&p.second->name==name->text&&p.second->active){binding=p.second;break;}}if(!binding)return;auto event=std::make_shared<Event>();event->id=nextEventId_.fetch_add(1);event->connectionId=connection->id;event->pageId=binding->ownerPageId;event->handler=binding->handler;event->type=L"页面绑定调用";event->bindingHandle=binding->id;event->text=payload->text;auto session=FindSessionByProtocol(sid);event->sessionHandle=session?session->id:0;PublishEvent(event);}

    void HandleDebuggerEvent(const std::shared_ptr<Connection>& connection,const std::wstring& method,const LingCdpJson::ValuePtr& params,const std::wstring& sid){auto session=FindSessionByProtocol(sid);if(!session)return;if(method==L"Debugger.resumed"){std::lock_guard<std::mutex> lock(stage3Mutex_);session->debugger.paused=false;for(long long id:session->debugger.currentFrameHandles)callFrames_.erase(id);session->debugger.currentFrameHandles.clear();}else if(method==L"Debugger.paused"&&params){std::lock_guard<std::mutex> lock(stage3Mutex_);session->debugger.paused=true;++session->debugger.pauseGeneration;session->debugger.pausedJson=LingCdpJson::Serialize(params);auto frames=params->Find(L"callFrames");if(frames&&frames->kind==LingCdpJson::Value::Kind::Array)for(auto&item:frames->array){auto id=item->Find(L"callFrameId");if(!id||id->kind!=LingCdpJson::Value::Kind::String)continue;auto frame=std::make_shared<CallFrameState>();frame->id=nextCallFrameId_.fetch_add(1);frame->connectionId=connection->id;frame->sessionHandle=session->id;frame->sessionGeneration=session->generation;frame->pauseGeneration=session->debugger.pauseGeneration;frame->callFrameId=id->text;frame->snapshotJson=LingCdpJson::Serialize(item);auto scopes=item->Find(L"scopeChain");if(scopes&&scopes->kind==LingCdpJson::Value::Kind::Array)for(auto&s:scopes->array){auto object=s->Find(L"object");auto oid=object?object->Find(L"objectId"):nullptr;if(oid&&oid->kind==LingCdpJson::Value::Kind::String)frame->scopeObjectIds.push_back(oid->text);}callFrames_[frame->id]=frame;session->debugger.currentFrameHandles.push_back(frame->id);}}auto event=std::make_shared<Event>();event->id=nextEventId_.fetch_add(1);event->connectionId=connection->id;event->pageId=session->ownerPageId;event->handler=session->debugger.handler;event->type=method==L"Debugger.paused"?L"调试已暂停":method==L"Debugger.resumed"?L"调试已恢复":L"断点已解析";event->sessionHandle=session->id;event->text=params?LingCdpJson::Serialize(params):L"";PublishEvent(event);}

    void HandleCertificateError(const std::shared_ptr<Connection>& connection,const LingCdpJson::ValuePtr& params){if(!params)return;auto eventId=params->Find(L"eventId");auto url=params->Find(L"requestURL");auto error=params->Find(L"errorType");if(!eventId||eventId->kind!=LingCdpJson::Value::Kind::Number)return;std::wstring origin;NormalizeOrigin(url&&url->kind==LingCdpJson::Value::Kind::String?url->text:L"",origin);std::wstring handler;bool allowed=false;{std::lock_guard<std::mutex> lock(connection->mutex);handler=connection->certificateHandler;allowed=connection->certificateOverrideEnabled&&connection->certificateOrigins.count(origin)&&std::chrono::steady_clock::now()<connection->certificateOverrideDeadline;}if(!allowed||handler.empty()){SendCommand(connection,L"Security.handleCertificateError",L"{\"eventId\":"+LingCdpJson::NumberText(eventId->number)+L",\"action\":\"cancel\"}",PendingKind::Internal,L"",L"",L"");return;}auto state=std::make_shared<CertificateErrorState>();state->id=nextCertificateErrorId_.fetch_add(1);state->connectionId=connection->id;state->eventId=static_cast<int>(eventId->number);state->url=url&&url->kind==LingCdpJson::Value::Kind::String?url->text:L"";state->origin=origin;state->errorType=error&&error->kind==LingCdpJson::Value::Kind::String?error->text:L"";state->deadline=std::chrono::steady_clock::now()+std::chrono::seconds(30);{std::lock_guard<std::mutex> lock(stage3Mutex_);certificateErrors_[state->id]=state;}auto event=std::make_shared<Event>();event->id=nextEventId_.fetch_add(1);event->connectionId=connection->id;event->handler=handler;event->type=L"证书错误";event->certificateErrorId=state->id;event->text=state->url;event->detail=state->errorType;PublishEvent(event);}

    void HandleTaskEvent(const std::shared_ptr<Connection>& connection,const std::wstring& method,const LingCdpJson::ValuePtr& params,const std::wstring& sid){(void)sid;std::shared_ptr<TaskState> task;{std::lock_guard<std::mutex> lock(tasksMutex_);for(auto&p:tasks_)if(p.second->connectionId==connection->id&&!p.second->terminal&&(method==L"Tracing.tracingComplete"?p.second->kind==L"trace":p.second->kind==L"heap")){task=p.second;break;}}if(!task||!params)return;if(method==L"HeapProfiler.addHeapSnapshotChunk"){auto chunk=params->Find(L"chunk");if(chunk&&chunk->kind==LingCdpJson::Value::Kind::String)WriteTaskChunk(task,chunk->text);}else if(method==L"HeapProfiler.reportHeapSnapshotProgress"){auto done=params->Find(L"done");auto total=params->Find(L"total");if(done&&total&&total->number>0)task->progress=static_cast<int>(done->number*100/total->number);}else{auto stream=params->Find(L"stream");if(stream&&stream->kind==LingCdpJson::Value::Kind::String){task->ioHandle=stream->text;ReadIoStream(connection,task);}}}

    std::shared_ptr<SessionState> FindSessionByProtocol(const std::wstring& sid) const { std::lock_guard<std::mutex> lock(stage3Mutex_);auto found=sessionByProtocolId_.find(sid);return found==sessionByProtocolId_.end()?nullptr:sessions_.at(found->second); }
    std::shared_ptr<TaskState> FindTask(long long id) const { std::lock_guard<std::mutex> lock(tasksMutex_);auto found=tasks_.find(id);return found==tasks_.end()?nullptr:found->second; }
    void FailPendingForSession(const std::shared_ptr<Connection>& connection,const std::wstring& sid,const std::wstring& reason){std::vector<Pending> values;{std::lock_guard<std::mutex> lock(connection->pendingMutex);for(auto it=connection->pending.begin();it!=connection->pending.end();)if(it->second.expectedSessionId==sid){values.push_back(it->second);it=connection->pending.erase(it);}else++it;}for(auto&p:values)EmitCommand(connection,p,false,reason,0);}
    void WriteTaskChunk(const std::shared_ptr<TaskState>& task,const std::wstring& text){if(!task||task->file==INVALID_HANDLE_VALUE)return;std::string utf8;if(!LingCdpJson::WideToUtf8(text,utf8))return;if(task->maximumBytes>0&&task->writtenBytes+static_cast<long long>(utf8.size())>task->maximumBytes){task->state=L"失败";task->error=L"输出超过文件上限";CloseTaskFile(task,false);task->terminal=true;return;}DWORD written=0;if(WriteFile(task->file,utf8.data(),static_cast<DWORD>(utf8.size()),&written,nullptr)&&written==utf8.size())task->writtenBytes+=written;}
    void ReadIoStream(const std::shared_ptr<Connection>& connection,const std::shared_ptr<TaskState>& task){if(!task||task->ioHandle.empty()||task->terminal)return;SendCommand(connection,L"IO.read",L"{\"handle\":"+LingCdpJson::Escape(task->ioHandle)+L",\"size\":262144}",PendingKind::IoRead,task->handler,std::to_wstring(task->id),L"");}
    bool WriteFileBytesAtomic(const std::wstring& path,const std::vector<unsigned char>& bytes){return WriteFileBytes(path,bytes);}
    bool WriteTaskOutput(const std::shared_ptr<TaskState>& task){if(!task)return false;std::vector<unsigned char> bytes;return WriteFileBytesAtomic(task->finalPath,bytes);}
    void HandleTargetInfo(const std::shared_ptr<Connection>& connection,const LingCdpJson::ValuePtr& info){if(!info)return;auto id=info->Find(L"targetId");if(!id||id->kind!=LingCdpJson::Value::Kind::String)return;std::lock_guard<std::mutex> lock(stage3Mutex_);long long handle=targetByProtocolId_.count(id->text)?targetByProtocolId_[id->text]:nextTargetHandle_.fetch_add(1);auto target=targets_.count(handle)?targets_[handle]:std::make_shared<TargetState>();target->id=handle;target->connectionId=connection->id;target->targetId=id->text;auto type=info->Find(L"type");auto url=info->Find(L"url");if(type&&type->kind==LingCdpJson::Value::Kind::String)target->type=type->text;if(url&&url->kind==LingCdpJson::Value::Kind::String)target->url=url->text;targets_[handle]=target;targetByProtocolId_[id->text]=handle;}

    void EmitEvent(const std::shared_ptr<Connection>& connection, const std::shared_ptr<PageSession>& page,
                   const std::wstring& handler, const std::wstring& type, const std::wstring& text, const std::wstring& detail) {
        if (handler.empty()) return;
        auto event = std::make_shared<Event>();
        event->id = nextEventId_.fetch_add(1);
        event->connectionId = connection ? connection->id : 0;
        event->pageId = page ? page->id : 0;
        event->handler = handler;
        event->type = type;
        event->text = text;
        event->detail = detail;
        PublishEvent(event);
    }

    void EmitNetwork(const std::shared_ptr<Connection>& connection, const std::shared_ptr<PageSession>& page,
                     const std::wstring& handler, const std::wstring& type, const std::wstring& netUrl, const std::wstring& netMethod,
                     const std::wstring& requestId, int status, const std::wstring& errorText) {
        if (handler.empty()) return;
        auto event = std::make_shared<Event>();
        event->id = nextEventId_.fetch_add(1);
        event->connectionId = connection ? connection->id : 0;
        event->pageId = page ? page->id : 0;
        event->handler = handler;
        event->type = type;
        event->netUrl = netUrl;
        event->netMethod = netMethod;
        event->netRequestId = requestId;
        event->netStatus = status;
        event->error = errorText;
        PublishEvent(event);
    }

    void EmitConnection(const std::shared_ptr<Connection>& connection, const std::wstring& type,
                        const std::wstring& text, const std::wstring& error, bool preferConnectHandler) {
        std::wstring handler;
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            handler = preferConnectHandler && !connection->connectHandler.empty() ? connection->connectHandler : connection->eventHandler;
        }
        if (handler.empty()) return;
        EmitEvent(connection, nullptr, handler, type, text, error);
    }

    void EmitCommand(const std::shared_ptr<Connection>& connection, const Pending& pending, bool success,
                     const std::wstring& text, long long code) {
        if (pending.handler.empty()) return;
        const std::shared_ptr<PageSession> page = FindPage(_wtoi64(pending.aux.c_str()));
        auto event = std::make_shared<Event>();
        event->id = nextEventId_.fetch_add(1);
        event->connectionId = connection ? connection->id : 0;
        event->pageId = page ? page->id : 0;
        event->handler = pending.handler;
        event->type = success ? L"命令完成" : L"命令失败";
        event->text = text;
        if (!success) {
            event->error = text;
            event->detail = code ? L"错误码 " + std::to_wstring(code) : L"";
        }
        PublishEvent(event);
    }

    void PublishEvent(const std::shared_ptr<Event>& event) {
        {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            if (events_.size() >= 65536) events_.erase(events_.begin());
            events_[event->id] = event;
        }
        if (!notify_ || !notify_(event->id)) {
            std::lock_guard<std::mutex> lock(eventsMutex_);
            events_.erase(event->id);
        }
    }

    void FailPendingAll(const std::shared_ptr<Connection>& connection, const std::wstring& message) {
        std::vector<Pending> values;
        {
            std::lock_guard<std::mutex> lock(connection->pendingMutex);
            values.reserve(connection->pending.size());
            for (const auto& pair : connection->pending) values.push_back(pair.second);
            connection->pending.clear();
        }
        for (const Pending& pending : values) {
            if (pending.kind == PendingKind::Internal && pending.handler.empty()) continue;
            EmitCommand(connection, pending, false, message, 0);
        }
    }

    void CloseConnection(const std::shared_ptr<Connection>& connection, bool manual) {
        connection->manualClose.store(manual);
        connection->stopRequested.store(true);
        CloseHandles(connection);
        connection->stateChanged.notify_all();
        if (connection->worker.joinable() && connection->worker.get_id() != std::this_thread::get_id()) connection->worker.join();
        connection->connected.store(false);
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            if (manual) connection->state = L"已断开";
        }
        if (manual) EmitConnection(connection, L"已断开", L"", L"客户端主动断开", false);
        FailPendingAll(connection, L"CDP 连接已断开。");
    }

    bool ConnectionFail(const std::shared_ptr<Connection>& connection, const std::wstring& message, bool emitEvent) {
        {
            std::lock_guard<std::mutex> lock(connection->mutex);
            connection->lastError = message;
            connection->state = L"错误";
        }
        connection->workerRunning.store(false);
        connection->stateChanged.notify_all();
        if (emitEvent) EmitConnection(connection, L"连接失败", L"", message, true);
        CloseHandles(connection);
        return false;
    }

    bool Fail(const std::wstring& message) {
        std::lock_guard<std::mutex> lock(errorMutex_);
        lastError_ = message;
        return false;
    }

    std::shared_ptr<Event> CurrentEvent() const {
        std::lock_guard<std::mutex> lock(eventsMutex_);
        return currentEventStack_.empty() ? nullptr : currentEventStack_.back();
    }

    static void PublishHandle(const std::shared_ptr<Connection>& connection, int kind, HINTERNET handle) {
        std::lock_guard<std::mutex> lock(connection->handlesMutex);
        if (kind == 1) connection->session = handle;
        else if (kind == 2) connection->connect = handle;
        else connection->wsSocket = handle;
    }

    static void CloseHandles(const std::shared_ptr<Connection>& connection) {
        std::lock_guard<std::mutex> lock(connection->handlesMutex);
        if (connection->wsSocket) { WinHttpCloseHandle(connection->wsSocket); connection->wsSocket = nullptr; }
        if (connection->connect) { WinHttpCloseHandle(connection->connect); connection->connect = nullptr; }
        if (connection->session) { WinHttpCloseHandle(connection->session); connection->session = nullptr; }
    }

    static bool HttpGetText(const std::wstring& url, int timeoutMs, std::string& outBody, std::wstring& error) {
        URL_COMPONENTSW parts = {};
        parts.dwStructSize = sizeof(parts);
        parts.dwSchemeLength = static_cast<DWORD>(-1);
        parts.dwHostNameLength = static_cast<DWORD>(-1);
        parts.dwUrlPathLength = static_cast<DWORD>(-1);
        parts.dwExtraInfoLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) { error = L"无法解析地址。"; return false; }
        const bool secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
        std::wstring path = parts.dwUrlPathLength ? std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) : L"/";
        if (parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
        HINTERNET session = WinHttpOpen(L"LingBuilder CDP Client/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        if (!session) { error = L"无法创建 WinHTTP 会话，错误码 " + std::to_wstring(GetLastError()); return false; }
        WinHttpSetTimeouts(session, timeoutMs, timeoutMs, timeoutMs, timeoutMs);
        HINTERNET connect = WinHttpConnect(session, host.c_str(), parts.nPort, 0);
        if (!connect) { WinHttpCloseHandle(session); error = L"无法连接主机。"; return false; }
        HINTERNET request = WinHttpOpenRequest(connect, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, secure ? WINHTTP_FLAG_SECURE : 0);
        if (!request) { WinHttpCloseHandle(connect); WinHttpCloseHandle(session); error = L"无法创建请求。"; return false; }
        BOOL ok = WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0);
        ok = ok && WinHttpReceiveResponse(request, nullptr);
        if (!ok) {
            const DWORD code = GetLastError();
            WinHttpCloseHandle(request); WinHttpCloseHandle(connect); WinHttpCloseHandle(session);
            error = L"HTTP 请求失败，错误码 " + std::to_wstring(code);
            return false;
        }
        DWORD status = 0;
        DWORD statusSize = sizeof(status);
        WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
        if (status != 200) {
            WinHttpCloseHandle(request); WinHttpCloseHandle(connect); WinHttpCloseHandle(session);
            error = L"HTTP 状态码 " + std::to_wstring(status);
            return false;
        }
        outBody.clear();
        for (;;) {
            DWORD available = 0;
            if (!WinHttpQueryDataAvailable(request, &available)) break;
            if (available == 0) break;
            std::vector<char> chunk(available);
            DWORD read = 0;
            if (!WinHttpReadData(request, chunk.data(), available, &read) || read == 0) break;
            outBody.append(chunk.data(), read);
            if (outBody.size() > 8 * 1024 * 1024) {
                WinHttpCloseHandle(request); WinHttpCloseHandle(connect); WinHttpCloseHandle(session);
                error = L"响应超过 8MB 上限。";
                return false;
            }
        }
        WinHttpCloseHandle(request);
        WinHttpCloseHandle(connect);
        WinHttpCloseHandle(session);
        return true;
    }

    static bool Base64Decode(const std::wstring& base64, std::vector<unsigned char>& out) {
        DWORD size = 0;
        if (!CryptStringToBinaryW(base64.c_str(), 0, CRYPT_STRING_BASE64, nullptr, &size, nullptr, nullptr)) return false;
        out.resize(size);
        if (!CryptStringToBinaryW(base64.c_str(), 0, CRYPT_STRING_BASE64, out.data(), &size, nullptr, nullptr)) return false;
        out.resize(size);
        return true;
    }

    static bool WriteFileBytes(const std::wstring& path, const std::vector<unsigned char>& data) { return WriteFileBytesAtomic(path,data); }
    static bool WriteFileBytesAtomic(const std::wstring& path, const std::vector<unsigned char>& data) {
        if(path.empty()||data.size()>static_cast<size_t>(2ULL*1024*1024*1024))return false;
        const std::wstring temporary=path+L".lingbuilder-cdp-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(GetTickCount64())+L".tmp";
        HANDLE file=CreateFileW(temporary.c_str(),GENERIC_WRITE,0,nullptr,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,nullptr);if(file==INVALID_HANDLE_VALUE)return false;
        bool ok=true;size_t offset=0;while(ok&&offset<data.size()){DWORD chunk=static_cast<DWORD>(std::min<size_t>(data.size()-offset,1u<<20));DWORD written=0;ok=WriteFile(file,data.data()+offset,chunk,&written,nullptr)!=FALSE&&written==chunk;offset+=written;if(written==0&&chunk)ok=false;}
        if(ok)ok=FlushFileBuffers(file)!=FALSE;CloseHandle(file);if(ok)ok=MoveFileExW(temporary.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)!=FALSE;if(!ok)DeleteFileW(temporary.c_str());return ok;
    }
    static void CloseTaskFile(const std::shared_ptr<TaskState>& task,bool commit){if(!task)return;if(task->file!=INVALID_HANDLE_VALUE){if(commit)FlushFileBuffers(task->file);CloseHandle(task->file);task->file=INVALID_HANDLE_VALUE;}if(commit)MoveFileExW(task->temporaryPath.c_str(),task->finalPath.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH);else if(!task->temporaryPath.empty())DeleteFileW(task->temporaryPath.c_str());}

    static bool ParsePoint(const std::wstring& text, LingCdpJson::ValuePtr& out) {
        if (text.empty() || text == L"null") return false;
        std::string utf8;
        if (!LingCdpJson::WideToUtf8(text, utf8)) return false;
        std::wstring error;
        const LingCdpJson::ValuePtr root = LingCdpJson::Parser::Parse(utf8.data(), utf8.size(), error);
        if (!root || root->kind != LingCdpJson::Value::Kind::Array || root->array.size() != 2) return false;
        if (root->array[0]->kind != LingCdpJson::Value::Kind::Number || root->array[1]->kind != LingCdpJson::Value::Kind::Number) return false;
        out = root;
        return true;
    }

    static bool CrackHost(const std::wstring& url, std::wstring& host) {
        URL_COMPONENTSW parts = {};
        parts.dwStructSize = sizeof(parts);
        parts.dwHostNameLength = static_cast<DWORD>(-1);
        if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) return false;
        host.assign(parts.lpszHostName, parts.dwHostNameLength);
        return true;
    }

    static bool IsLoopbackHost(const std::wstring& host) {
        return host == L"127.0.0.1" || host == L"localhost" || host == L"::1" || host == L"[::1]";
    }

    static std::wstring TrimTrailingSlash(std::wstring value) {
        while (value.size() > 1 && (value.back() == L'/' || value.back() == L'\\')) value.pop_back();
        return value;
    }

    static const wchar_t* ButtonName(int button) { return button == 1 ? L"middle" : button == 2 ? L"right" : L"left"; }

    static std::vector<std::wstring> SplitModifiers(const std::wstring& value) {
        std::vector<std::wstring> result;
        size_t start = 0;
        while (start <= value.size()) {
            size_t end = value.find(L',', start);
            if (end == std::wstring::npos) end = value.size();
            std::wstring item = value.substr(start, end - start);
            while (!item.empty() && (item.back() == L' ' || item.back() == L'\t')) item.pop_back();
            while (!item.empty() && (item.front() == L' ' || item.front() == L'\t')) item.erase(item.begin());
            if (item == L"Ctrl" || item == L"Shift" || item == L"Alt" || item == L"Meta") result.push_back(item);
            if (end == value.size()) break;
            start = end + 1;
        }
        return result;
    }

    static int ModifierMask(const std::wstring& modifier) {
        if (modifier == L"Alt") return 1;
        if (modifier == L"Ctrl") return 2;
        if (modifier == L"Meta") return 4;
        if (modifier == L"Shift") return 8;
        return 0;
    }

    static unsigned KeyToVk(const std::wstring& key) {
        if (key.empty()) return 0;
        if (key == L"Enter") return 0x0D;
        if (key == L"Tab") return 0x09;
        if (key == L"Backspace") return 0x08;
        if (key == L"Escape") return 0x1B;
        if (key == L"Delete") return 0x2E;
        if (key == L"Insert") return 0x2D;
        if (key == L"Home") return 0x24;
        if (key == L"End") return 0x23;
        if (key == L"PageUp") return 0x21;
        if (key == L"PageDown") return 0x22;
        if (key == L"ArrowLeft") return 0x25;
        if (key == L"ArrowUp") return 0x26;
        if (key == L"ArrowRight") return 0x27;
        if (key == L"ArrowDown") return 0x28;
        if (key == L" ") return 0x20;
        if (key.size() == 2 && key[0] == L'F' && key[1] >= L'1' && key[1] <= L'9') return 0x70 + static_cast<unsigned>(key[1] - L'1');
        if (key.size() == 3 && key[0] == L'F' && key[1] == L'1' && key[2] >= L'0' && key[2] <= L'2') return 0x7A + static_cast<unsigned>(key[2] - L'0');
        if (key.size() == 1) {
            const wchar_t ch = key[0];
            if (ch >= L'a' && ch <= L'z') return static_cast<unsigned>(ch - L'a' + L'A');
            if (ch >= L'A' && ch <= L'Z') return static_cast<unsigned>(ch);
            if (ch >= L'0' && ch <= L'9') return static_cast<unsigned>(ch);
        }
        return 0;
    }

    static std::wstring CodeForKey(const std::wstring& key) {
        if (key == L"Enter") return L"Enter";
        if (key == L"Tab") return L"Tab";
        if (key == L"Backspace") return L"Backspace";
        if (key == L"Escape") return L"Escape";
        if (key == L"Delete") return L"Delete";
        if (key == L"Insert") return L"Insert";
        if (key == L"Home") return L"Home";
        if (key == L"End") return L"End";
        if (key == L"PageUp") return L"PageUp";
        if (key == L"PageDown") return L"PageDown";
        if (key == L"ArrowLeft") return L"ArrowLeft";
        if (key == L"ArrowUp") return L"ArrowUp";
        if (key == L"ArrowRight") return L"ArrowRight";
        if (key == L"ArrowDown") return L"ArrowDown";
        if (key == L" ") return L"Space";
        if (key.size() == 1) {
            const wchar_t ch = key[0];
            if (ch >= L'a' && ch <= L'z') return std::wstring(1, ch - L'a' + L'A');
            if ((ch >= L'A' && ch <= L'Z') || (ch >= L'0' && ch <= L'9')) return key;
        }
        return key;
    }

    NotifyEvent notify_;
    mutable std::mutex connectionsMutex_;
    mutable std::mutex pagesMutex_;
    mutable std::mutex elementsMutex_;
    mutable std::mutex interceptsMutex_;
    mutable std::mutex stage3Mutex_;
    mutable std::mutex tasksMutex_;
    mutable std::mutex recordingsMutex_;
    mutable std::mutex eventsMutex_;
    mutable std::mutex errorMutex_;
    std::unordered_map<long long, std::shared_ptr<Connection>> connections_;
    std::unordered_map<long long, std::shared_ptr<PageSession>> pages_;
    std::unordered_map<long long, std::pair<long long, std::wstring>> elements_;
    std::unordered_map<long long, std::shared_ptr<InterceptRef>> intercepts_;
    std::unordered_map<long long, std::shared_ptr<TargetState>> targets_;
    std::unordered_map<long long, std::shared_ptr<SessionState>> sessions_;
    std::unordered_map<long long, std::shared_ptr<FrameState>> frames_;
    std::unordered_map<long long, std::shared_ptr<ExecutionContextState>> contexts_;
    std::unordered_map<long long, std::shared_ptr<BindingState>> bindings_;
    std::unordered_map<long long, std::shared_ptr<BreakpointState>> breakpoints_;
    std::unordered_map<long long, std::shared_ptr<CallFrameState>> callFrames_;
    std::unordered_map<long long, std::shared_ptr<CertificateErrorState>> certificateErrors_;
    std::unordered_map<long long, std::shared_ptr<TaskState>> tasks_;
    std::unordered_map<long long, std::shared_ptr<RecordingState>> recordings_;
    std::unordered_map<long long, std::shared_ptr<ReplayState>> replays_;
    std::unordered_map<std::wstring, long long> targetByProtocolId_;
    std::unordered_map<std::wstring, long long> sessionByProtocolId_;
    std::unordered_map<std::wstring, long long> frameByProtocolId_;
    std::map<long long, std::shared_ptr<Event>> events_;
    std::vector<std::shared_ptr<Event>> currentEventStack_;
    std::wstring lastError_;
    std::atomic<long long> nextConnectionId_{1};
    std::atomic<long long> nextPageId_{1};
    std::atomic<long long> nextElementId_{1};
    std::atomic<long long> nextInterceptId_{1};
    std::atomic<long long> nextTargetHandle_{1};
    std::atomic<long long> nextSessionHandle_{1};
    std::atomic<long long> nextFrameHandle_{1};
    std::atomic<long long> nextContextHandle_{1};
    std::atomic<long long> nextBindingId_{1};
    std::atomic<long long> nextBreakpointId_{1};
    std::atomic<long long> nextCallFrameId_{1};
    std::atomic<long long> nextTaskId_{1};
    std::atomic<long long> nextCertificateErrorId_{1};
    std::atomic<long long> nextRecordingId_{1};
    std::atomic<long long> nextReplayId_{1};
    std::atomic<long long> nextEventId_{1};
    std::thread watchdog_;
    std::mutex watchdogMutex_;
    std::condition_variable watchdogChanged_;
    std::atomic<bool> watchdogStop_{false};
};
`;

const CDP_CLIENT_WINDOW_METHODS = String.raw`
    long long CDP_连接(const wchar_t* address, const wchar_t* handler) { return cdpClientRuntime_.Connect(address, handler, false); }
    long long CDP_连接远程(const wchar_t* address, const wchar_t* handler) { return cdpClientRuntime_.Connect(address, handler, true); }
    bool CDP_断开连接(long long connection) { return cdpClientRuntime_.Disconnect(connection); }
    int CDP_取连接数量() { return cdpClientRuntime_.ConnectionCount(); }
    bool CDP_是否已连接(long long connection) { return cdpClientRuntime_.IsConnected(connection); }
    const wchar_t* CDP_取连接状态(long long connection) { cdpClientReturnText_ = cdpClientRuntime_.ConnectionState(connection); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取浏览器版本(long long connection) { cdpClientReturnText_ = cdpClientRuntime_.BrowserVersion(connection); return cdpClientReturnText_.c_str(); }
    long long CDP_附加页面(long long connection, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.AttachPage(connection, url, handler); }
    long long CDP_新建页面(long long connection, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.NewPage(connection, url, handler); }
    bool CDP_关闭页面(long long page) { return cdpClientRuntime_.ClosePage(page); }
    bool CDP_激活页面(long long page) { return cdpClientRuntime_.ActivatePage(page); }
    int CDP_取页面数量(long long connection) { return cdpClientRuntime_.PageCount(connection); }
    const wchar_t* CDP_取页面网址(long long page) { cdpClientReturnText_ = cdpClientRuntime_.PageUrl(page); return cdpClientReturnText_.c_str(); }
    bool CDP_取页面标题(long long page, const wchar_t* handler) { return cdpClientRuntime_.GetTitle(page, handler); }
    bool CDP_取页面HTML(long long page, const wchar_t* handler) { return cdpClientRuntime_.GetHtml(page, handler); }
    bool CDP_打开网址(long long page, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.Navigate(page, url, handler); }
    bool CDP_刷新页面(long long page, const wchar_t* handler) { return cdpClientRuntime_.Reload(page, handler); }
    bool CDP_后退页面(long long page, const wchar_t* handler) { return cdpClientRuntime_.GoBack(page, handler); }
    bool CDP_前进页面(long long page, const wchar_t* handler) { return cdpClientRuntime_.GoForward(page, handler); }
    bool CDP_停止加载(long long page) { return cdpClientRuntime_.StopLoad(page); }
    bool CDP_执行脚本(long long page, const wchar_t* code, const wchar_t* handler) { return cdpClientRuntime_.Evaluate(page, code, handler); }
    long long CDP_查询元素(long long page, const wchar_t* selector) { return cdpClientRuntime_.QueryElement(page, selector); }
    bool CDP_点击元素(long long element, const wchar_t* handler) { return cdpClientRuntime_.ClickElement(element, handler); }
    bool CDP_输入文本(long long element, const wchar_t* text, const wchar_t* handler) { return cdpClientRuntime_.InputTextElement(element, text, handler); }
    bool CDP_取元素文本(long long element, const wchar_t* handler) { return cdpClientRuntime_.GetElementText(element, handler); }
    bool CDP_取元素属性(long long element, const wchar_t* name, const wchar_t* handler) { return cdpClientRuntime_.GetElementAttribute(element, name, handler); }
    bool CDP_取元素数量(long long page, const wchar_t* selector, const wchar_t* handler) { return cdpClientRuntime_.CountElements(page, selector, handler); }
    bool CDP_鼠标移动(long long page, int x, int y) { return cdpClientRuntime_.MouseMove(page, x, y); }
    bool CDP_鼠标单击(long long page, int x, int y, int button, int count) { return cdpClientRuntime_.MouseClick(page, x, y, button, count); }
    bool CDP_鼠标按下(long long page, int x, int y, int button) { return cdpClientRuntime_.MouseDown(page, x, y, button); }
    bool CDP_鼠标释放(long long page, int x, int y, int button) { return cdpClientRuntime_.MouseUp(page, x, y, button); }
    bool CDP_鼠标滚轮(long long page, int x, int y, int deltaX, int deltaY) { return cdpClientRuntime_.MouseWheel(page, x, y, deltaX, deltaY); }
    bool CDP_按键(long long page, const wchar_t* key) { return cdpClientRuntime_.PressKey(page, key); }
    bool CDP_组合键(long long page, const wchar_t* modifiers, const wchar_t* key) { return cdpClientRuntime_.ComboKey(page, modifiers, key); }
    bool CDP_插入文本(long long page, const wchar_t* text) { return cdpClientRuntime_.InsertText(page, text); }
    bool CDP_绑定网络事件(long long page, const wchar_t* handler) { return cdpClientRuntime_.BindNetworkHandler(page, handler); }
    bool CDP_取网络响应体(long long page, const wchar_t* requestId, const wchar_t* handler) { return cdpClientRuntime_.GetResponseBody(page, requestId, handler); }
    bool CDP_取Cookie(long long connection, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.GetCookies(connection, url, handler); }
    bool CDP_置Cookie(long long connection, const wchar_t* name, const wchar_t* value, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.SetCookie(connection, name, value, url, handler); }
    bool CDP_删除Cookie(long long connection, const wchar_t* name, const wchar_t* url, const wchar_t* handler) { return cdpClientRuntime_.DeleteCookies(connection, name, url, handler); }
    bool CDP_清空缓存(long long connection, const wchar_t* handler) { return cdpClientRuntime_.ClearCache(connection, handler); }
    bool CDP_清空Cookie(long long connection, const wchar_t* handler) { return cdpClientRuntime_.ClearCookies(connection, handler); }
    bool CDP_绑定控制台事件(long long page, const wchar_t* handler) { return cdpClientRuntime_.BindConsoleHandler(page, handler); }
    bool CDP_绑定页面异常(long long page, const wchar_t* handler) { return cdpClientRuntime_.BindExceptionHandler(page, handler); }
    bool CDP_截图(long long page, const wchar_t* path, bool fullPage, const wchar_t* handler) { return cdpClientRuntime_.Screenshot(page, path, fullPage, handler); }
    bool CDP_打印PDF(long long page, const wchar_t* path, const wchar_t* handler) { return cdpClientRuntime_.PrintPdf(page, path, handler); }
    bool CDP_绑定连接事件(long long connection, const wchar_t* handler) { return cdpClientRuntime_.BindConnectionHandler(connection, handler); }
    bool CDP_绑定页面事件(long long page, const wchar_t* handler) { return cdpClientRuntime_.BindPageHandler(page, handler); }
    const wchar_t* CDP_取当前事件类型() { cdpClientReturnText_ = cdpClientRuntime_.CurrentType(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前事件文本() { cdpClientReturnText_ = cdpClientRuntime_.CurrentText(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前事件详情() { cdpClientReturnText_ = cdpClientRuntime_.CurrentDetail(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前错误() { cdpClientReturnText_ = cdpClientRuntime_.CurrentError(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前网络网址() { cdpClientReturnText_ = cdpClientRuntime_.CurrentNetUrl(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前网络方法() { cdpClientReturnText_ = cdpClientRuntime_.CurrentNetMethod(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前网络编号() { cdpClientReturnText_ = cdpClientRuntime_.CurrentNetRequestId(); return cdpClientReturnText_.c_str(); }
    int CDP_取当前网络状态() { return cdpClientRuntime_.CurrentNetStatus(); }
    long long CDP_取当前连接() { return cdpClientRuntime_.CurrentConnection(); }
    long long CDP_取当前页面() { return cdpClientRuntime_.CurrentPage(); }
    bool CDP_设置命令超时(long long connection, int timeoutMs) { return cdpClientRuntime_.SetCommandTimeout(connection, timeoutMs); }
    bool CDP_拦截开始(long long page, const wchar_t* urlPattern, const wchar_t* handler) { return cdpClientRuntime_.InterceptStart(page, urlPattern, handler); }
    bool CDP_拦截继续(long long intercept) { return cdpClientRuntime_.InterceptContinue(intercept); }
    bool CDP_拦截改写(long long intercept, const wchar_t* url, const wchar_t* headersJson) { return cdpClientRuntime_.InterceptModify(intercept, url, headersJson); }
    bool CDP_拦截模拟响应(long long intercept, int status, const wchar_t* headersJson, const wchar_t* body) { return cdpClientRuntime_.InterceptFulfill(intercept, status, headersJson, body); }
    bool CDP_拦截终止(long long intercept, const wchar_t* reason) { return cdpClientRuntime_.InterceptFail(intercept, reason); }
    bool CDP_拦截应答认证(long long intercept, const wchar_t* user, const wchar_t* password) { return cdpClientRuntime_.InterceptAuth(intercept, user, password); }
    bool CDP_取拦截请求体(long long intercept, const wchar_t* handler) { return cdpClientRuntime_.InterceptGetPostData(intercept, handler); }
    bool CDP_拦截停止(long long page) { return cdpClientRuntime_.InterceptStop(page); }
    bool CDP_绑定对话框事件(long long page, const wchar_t* handler) { return cdpClientRuntime_.BindDialogHandler(page, handler); }
    bool CDP_应答对话框(long long page, bool accept, const wchar_t* promptText) { return cdpClientRuntime_.AnswerDialog(page, accept, promptText); }
    const wchar_t* CDP_取当前对话框消息() { cdpClientReturnText_ = cdpClientRuntime_.CurrentDialogMessage(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前对话框类型() { cdpClientReturnText_ = cdpClientRuntime_.CurrentDialogType(); return cdpClientReturnText_.c_str(); }
    const wchar_t* CDP_取当前对话框默认文本() { cdpClientReturnText_ = cdpClientRuntime_.CurrentDialogDefaultText(); return cdpClientReturnText_.c_str(); }
    bool CDP_设置下载目录(long long connection, const wchar_t* directory, bool allow) { return cdpClientRuntime_.SetDownloadBehavior(connection, directory, allow); }
    bool CDP_绑定下载事件(long long connection, const wchar_t* handler) { return cdpClientRuntime_.BindDownloadHandler(connection, handler); }
    const wchar_t* CDP_取当前下载文件名() { cdpClientReturnText_ = cdpClientRuntime_.CurrentDownloadFile(); return cdpClientReturnText_.c_str(); }
    int CDP_取当前下载进度() { return cdpClientRuntime_.CurrentDownloadProgress(); }
    long long CDP_取当前拦截() { return cdpClientRuntime_.CurrentIntercept(); }
    bool CDP_设置元素文件(long long element, const wchar_t* filePath, const wchar_t* handler) { return cdpClientRuntime_.SetElementFiles(element, filePath, handler); }
    bool CDP_等待加载(long long page, int kind, int timeoutSeconds, const wchar_t* handler) { return cdpClientRuntime_.WaitForLifecycle(page, kind, timeoutSeconds, handler); }
    bool CDP_设置视口(long long page, int width, int height) { return cdpClientRuntime_.SetViewport(page, width, height); }
    bool CDP_设置UserAgent(long long page, const wchar_t* userAgent) { return cdpClientRuntime_.SetUserAgent(page, userAgent); }
    bool CDP_设置触摸(long long page, bool enabled) { return cdpClientRuntime_.SetTouchEmulation(page, enabled); }
    bool CDP_设置地理位置(long long page, double latitude, double longitude) { return cdpClientRuntime_.SetGeolocation(page, latitude, longitude); }
    bool CDP_设置时区(long long page, const wchar_t* timezone) { return cdpClientRuntime_.SetTimezone(page, timezone); }
    bool CDP_设置语言(long long page, const wchar_t* locale) { return cdpClientRuntime_.SetLocale(page, locale); }
    bool CDP_设置暗色模式(long long page, bool enabled) { return cdpClientRuntime_.SetDarkMode(page, enabled); }
    bool CDP_设置CPU节流(long long page, int rate) { return cdpClientRuntime_.SetCpuThrottle(page, rate); }
    bool CDP_重置仿真(long long page) { return cdpClientRuntime_.ResetEmulation(page); }
    bool CDP_设置离线(long long page, bool offline) { return cdpClientRuntime_.SetOffline(page, offline); }
    bool CDP_设置限速(long long page, int latencyMs, long long downloadBps, long long uploadBps) { return cdpClientRuntime_.SetNetworkThrottle(page, latencyMs, downloadBps, uploadBps); }
    bool CDP_禁用缓存(long long page, bool disabled) { return cdpClientRuntime_.SetCacheDisabled(page, disabled); }
    bool CDP_截图元素(long long element, const wchar_t* path, const wchar_t* handler) { return cdpClientRuntime_.ScreenshotElement(element, path, handler); }
    bool CDP_取窗口边界(long long page, const wchar_t* handler) { return cdpClientRuntime_.GetWindowBounds(page, handler); }
    bool CDP_设置窗口边界(long long page, int left, int top, int width, int height) { return cdpClientRuntime_.SetWindowBounds(page, left, top, width, height); }
    bool CDP_绑定新页面事件(long long connection, const wchar_t* handler) { return cdpClientRuntime_.BindNewPageHandler(connection, handler); }
    bool CDP_鼠标拖拽(long long page, int fromX, int fromY, int toX, int toY, int steps) { return cdpClientRuntime_.MouseDrag(page, fromX, fromY, toX, toY, steps); }
    bool CDP_调用函数(long long element, const wchar_t* functionCode, const wchar_t* handler) { return cdpClientRuntime_.CallFunction(element, functionCode, handler); }
`;
