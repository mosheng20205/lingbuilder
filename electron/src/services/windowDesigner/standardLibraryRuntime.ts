import { InstalledModule } from '../modules/types';
import { STANDARD_LIBRARY_MODULE_IDS } from '../modules/standardLibraryModules';

export const BUILTIN_LIBRARY_COMMON_RUNTIME = String.raw`
static thread_local std::array<std::wstring, 16> g_lbTextResults;
static thread_local size_t g_lbTextResultIndex = 0;

static const wchar_t* LB_ReturnText(std::wstring value) {
    std::wstring& slot = g_lbTextResults[g_lbTextResultIndex++ % g_lbTextResults.size()];
    slot = std::move(value);
    return slot.c_str();
}

static std::wstring LB_Wide(const wchar_t* value) {
    return value ? value : L"";
}

static std::string LB_WideToUtf8(const wchar_t* value) {
    if (!value || !value[0]) return {};
    int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, nullptr, 0, nullptr, nullptr);
    if (size <= 1) return {};
    std::string result(static_cast<size_t>(size), '\0');
    WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value, -1, result.data(), size, nullptr, nullptr);
    result.resize(static_cast<size_t>(size - 1));
    return result;
}

static std::wstring LB_Utf8ToWide(const std::string& value) {
    if (value.empty()) return {};
    int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
    if (size <= 0) return {};
    std::wstring result(static_cast<size_t>(size), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size);
    return result;
}

static int LB_HexDigit(wchar_t value) {
    if (value >= L'0' && value <= L'9') return value - L'0';
    if (value >= L'a' && value <= L'f') return value - L'a' + 10;
    if (value >= L'A' && value <= L'F') return value - L'A' + 10;
    return -1;
}

static void LB_ReplaceAll(std::wstring& value, const std::wstring& from, const std::wstring& to) {
    if (from.empty()) return;
    size_t position = 0;
    while ((position = value.find(from, position)) != std::wstring::npos) {
        value.replace(position, from.size(), to);
        position += to.size();
    }
}
`;

const TEXT_RUNTIME = String.raw`
int 文本_取长度(const wchar_t* text) { return static_cast<int>(LB_Wide(text).size()); }

int 文本_寻找(const wchar_t* text, const wchar_t* target) {
    const size_t position = LB_Wide(text).find(LB_Wide(target));
    return position == std::wstring::npos ? -1 : static_cast<int>(position);
}

bool 文本_是否包含(const wchar_t* text, const wchar_t* target) { return 文本_寻找(text, target) >= 0; }

bool 文本_开头为(const wchar_t* text, const wchar_t* prefix) {
    const std::wstring value = LB_Wide(text), expected = LB_Wide(prefix);
    return value.size() >= expected.size() && value.compare(0, expected.size(), expected) == 0;
}

bool 文本_结尾为(const wchar_t* text, const wchar_t* suffix) {
    const std::wstring value = LB_Wide(text), expected = LB_Wide(suffix);
    return value.size() >= expected.size() && value.compare(value.size() - expected.size(), expected.size(), expected) == 0;
}

const wchar_t* 文本_取中间(const wchar_t* text, int start, int length) {
    const std::wstring value = LB_Wide(text);
    if (start < 0 || length <= 0 || static_cast<size_t>(start) >= value.size()) return LB_ReturnText(L"");
    return LB_ReturnText(value.substr(static_cast<size_t>(start), static_cast<size_t>(length)));
}

const wchar_t* 文本_替换(const wchar_t* text, const wchar_t* search, const wchar_t* replacement) {
    std::wstring value = LB_Wide(text);
    LB_ReplaceAll(value, LB_Wide(search), LB_Wide(replacement));
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_删首尾空白(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    size_t first = 0;
    while (first < value.size() && iswspace(value[first])) ++first;
    size_t last = value.size();
    while (last > first && iswspace(value[last - 1])) --last;
    return LB_ReturnText(value.substr(first, last - first));
}

const wchar_t* 文本_转大写(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towupper(ch)); });
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_转小写(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); });
    return LB_ReturnText(std::move(value));
}
`;

const BYTES_RUNTIME = String.raw`
bool 字节_十六进制是否有效(const wchar_t* hex) {
    const std::wstring value = LB_Wide(hex);
    if (value.size() % 2 != 0) return false;
    return std::all_of(value.begin(), value.end(), [](wchar_t ch) { return LB_HexDigit(ch) >= 0; });
}

int 字节_UTF8长度(const wchar_t* text) { return static_cast<int>(LB_WideToUtf8(text).size()); }

const wchar_t* 字节_文本转十六进制(const wchar_t* text) {
    static constexpr wchar_t digits[] = L"0123456789ABCDEF";
    const std::string bytes = LB_WideToUtf8(text);
    std::wstring result;
    result.reserve(bytes.size() * 2);
    for (unsigned char byte : bytes) {
        result.push_back(digits[(byte >> 4) & 0x0f]);
        result.push_back(digits[byte & 0x0f]);
    }
    return LB_ReturnText(std::move(result));
}

const wchar_t* 字节_十六进制转文本(const wchar_t* hex) {
    const std::wstring value = LB_Wide(hex);
    if (!字节_十六进制是否有效(value.c_str())) return LB_ReturnText(L"");
    std::string bytes;
    bytes.reserve(value.size() / 2);
    for (size_t index = 0; index < value.size(); index += 2) {
        bytes.push_back(static_cast<char>((LB_HexDigit(value[index]) << 4) | LB_HexDigit(value[index + 1])));
    }
    return LB_ReturnText(LB_Utf8ToWide(bytes));
}
`;

const ENCODING_RUNTIME = String.raw`
static const char* LB_Base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const wchar_t* 编码_Base64编码(const wchar_t* text) {
    const std::string input = LB_WideToUtf8(text);
    std::string output;
    for (size_t offset = 0; offset < input.size(); offset += 3) {
        const unsigned int a = static_cast<unsigned char>(input[offset]);
        const unsigned int b = offset + 1 < input.size() ? static_cast<unsigned char>(input[offset + 1]) : 0;
        const unsigned int c = offset + 2 < input.size() ? static_cast<unsigned char>(input[offset + 2]) : 0;
        const unsigned int block = (a << 16) | (b << 8) | c;
        output.push_back(LB_Base64Alphabet[(block >> 18) & 63]);
        output.push_back(LB_Base64Alphabet[(block >> 12) & 63]);
        output.push_back(offset + 1 < input.size() ? LB_Base64Alphabet[(block >> 6) & 63] : '=');
        output.push_back(offset + 2 < input.size() ? LB_Base64Alphabet[block & 63] : '=');
    }
    return LB_ReturnText(LB_Utf8ToWide(output));
}

static int LB_Base64Value(char value) {
    const char* found = std::strchr(LB_Base64Alphabet, value);
    return found ? static_cast<int>(found - LB_Base64Alphabet) : -1;
}

const wchar_t* 编码_Base64解码(const wchar_t* text) {
    const std::string input = LB_WideToUtf8(text);
    if (input.size() % 4 != 0) return LB_ReturnText(L"");
    std::string output;
    for (size_t offset = 0; offset < input.size(); offset += 4) {
        int values[4] = {};
        for (int index = 0; index < 4; ++index) {
            const char ch = input[offset + static_cast<size_t>(index)];
            values[index] = ch == '=' ? -2 : LB_Base64Value(ch);
            if (values[index] == -1) return LB_ReturnText(L"");
        }
        if (values[0] < 0 || values[1] < 0 || (values[2] == -2 && values[3] != -2)) return LB_ReturnText(L"");
        const unsigned int block = (static_cast<unsigned int>(values[0]) << 18)
            | (static_cast<unsigned int>(values[1]) << 12)
            | (static_cast<unsigned int>((std::max)(0, values[2])) << 6)
            | static_cast<unsigned int>((std::max)(0, values[3]));
        output.push_back(static_cast<char>((block >> 16) & 0xff));
        if (values[2] >= 0) output.push_back(static_cast<char>((block >> 8) & 0xff));
        if (values[3] >= 0) output.push_back(static_cast<char>(block & 0xff));
    }
    return LB_ReturnText(LB_Utf8ToWide(output));
}

const wchar_t* 编码_URL编码(const wchar_t* text) {
    static constexpr char digits[] = "0123456789ABCDEF";
    const std::string input = LB_WideToUtf8(text);
    std::string output;
    for (unsigned char byte : input) {
        if ((byte >= 'a' && byte <= 'z') || (byte >= 'A' && byte <= 'Z') || (byte >= '0' && byte <= '9') || byte == '-' || byte == '_' || byte == '.' || byte == '~') {
            output.push_back(static_cast<char>(byte));
        } else {
            output.push_back('%'); output.push_back(digits[byte >> 4]); output.push_back(digits[byte & 0x0f]);
        }
    }
    return LB_ReturnText(LB_Utf8ToWide(output));
}

const wchar_t* 编码_URL解码(const wchar_t* text) {
    const std::string input = LB_WideToUtf8(text);
    std::string output;
    for (size_t index = 0; index < input.size(); ++index) {
        if (input[index] == '+' ) { output.push_back(' '); continue; }
        if (input[index] == '%' && index + 2 < input.size()) {
            int high = LB_HexDigit(static_cast<unsigned char>(input[index + 1]));
            int low = LB_HexDigit(static_cast<unsigned char>(input[index + 2]));
            if (high < 0 || low < 0) return LB_ReturnText(L"");
            output.push_back(static_cast<char>((high << 4) | low)); index += 2; continue;
        }
        output.push_back(input[index]);
    }
    return LB_ReturnText(LB_Utf8ToWide(output));
}

const wchar_t* 编码_HTML转义(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    LB_ReplaceAll(value, L"&", L"&amp;"); LB_ReplaceAll(value, L"<", L"&lt;"); LB_ReplaceAll(value, L">", L"&gt;");
    LB_ReplaceAll(value, L"\"", L"&quot;"); LB_ReplaceAll(value, L"'", L"&#39;");
    return LB_ReturnText(std::move(value));
}

const wchar_t* 编码_HTML反转义(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    LB_ReplaceAll(value, L"&lt;", L"<"); LB_ReplaceAll(value, L"&gt;", L">"); LB_ReplaceAll(value, L"&quot;", L"\"");
    LB_ReplaceAll(value, L"&#39;", L"'"); LB_ReplaceAll(value, L"&amp;", L"&");
    return LB_ReturnText(std::move(value));
}
`;

const MATH_RUNTIME = String.raw`
double 数学_绝对值(double value) { return std::fabs(value); }
double 数学_最小值(double first, double second) { return (std::min)(first, second); }
double 数学_最大值(double first, double second) { return (std::max)(first, second); }
double 数学_限制范围(double value, double minimum, double maximum) { if (minimum > maximum) std::swap(minimum, maximum); return (std::max)(minimum, (std::min)(value, maximum)); }
double 数学_平方根(double value) { return value < 0 ? 0 : std::sqrt(value); }
double 数学_乘方(double base, double exponent) { return std::pow(base, exponent); }
int 数学_随机整数(int minimum, int maximum) {
    if (minimum > maximum) std::swap(minimum, maximum);
    static thread_local std::mt19937 engine(std::random_device{}());
    return std::uniform_int_distribution<int>(minimum, maximum)(engine);
}
`;

const DATETIME_RUNTIME = String.raw`
long long 时间_当前时间戳() {
    return static_cast<long long>(std::chrono::system_clock::to_time_t(std::chrono::system_clock::now()));
}

long long 时间_当前毫秒() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
}

long long 时间_单调毫秒() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

const wchar_t* 时间_格式化时间戳(long long timestamp, const wchar_t* format) {
    const time_t value = static_cast<time_t>(timestamp);
    std::tm local = {};
    if (localtime_s(&local, &value) != 0) return LB_ReturnText(L"");
    wchar_t buffer[256] = {};
    if (wcsftime(buffer, _countof(buffer), format && format[0] ? format : L"%Y-%m-%d %H:%M:%S", &local) == 0) return LB_ReturnText(L"");
    return LB_ReturnText(buffer);
}

const wchar_t* 时间_格式化当前(const wchar_t* format) { return 时间_格式化时间戳(时间_当前时间戳(), format); }
`;

const REGEX_RUNTIME = String.raw`
bool 正则_完全匹配(const wchar_t* text, const wchar_t* pattern) {
    try { return std::regex_match(LB_Wide(text), std::wregex(LB_Wide(pattern))); } catch (const std::regex_error&) { return false; }
}

bool 正则_是否包含(const wchar_t* text, const wchar_t* pattern) {
    try { return std::regex_search(LB_Wide(text), std::wregex(LB_Wide(pattern))); } catch (const std::regex_error&) { return false; }
}

const wchar_t* 正则_取首个(const wchar_t* text, const wchar_t* pattern) {
    try { std::wsmatch match; const std::wstring value = LB_Wide(text); return std::regex_search(value, match, std::wregex(LB_Wide(pattern))) ? LB_ReturnText(match.str()) : LB_ReturnText(L""); }
    catch (const std::regex_error&) { return LB_ReturnText(L""); }
}

const wchar_t* 正则_替换(const wchar_t* text, const wchar_t* pattern, const wchar_t* replacement) {
    try { return LB_ReturnText(std::regex_replace(LB_Wide(text), std::wregex(LB_Wide(pattern)), LB_Wide(replacement))); }
    catch (const std::regex_error&) { return LB_ReturnText(LB_Wide(text)); }
}

int 正则_匹配数量(const wchar_t* text, const wchar_t* pattern) {
    try {
        const std::wstring value = LB_Wide(text); const std::wregex expression(LB_Wide(pattern));
        return static_cast<int>(std::distance(std::wsregex_iterator(value.begin(), value.end(), expression), std::wsregex_iterator()));
    } catch (const std::regex_error&) { return 0; }
}
`;

const JSON_RUNTIME = String.raw`
class LB_JsonReader {
public:
    explicit LB_JsonReader(const std::wstring& source) : begin_(source.data()), current_(source.data()), end_(source.data() + source.size()) {}
    void SkipWhitespace() { while (current_ < end_ && iswspace(*current_)) ++current_; }
    bool AtEnd() { SkipWhitespace(); return current_ == end_; }
    const wchar_t* Position() const { return current_; }
    bool Consume(wchar_t expected) { SkipWhitespace(); if (current_ >= end_ || *current_ != expected) return false; ++current_; return true; }

    bool ParseString(std::wstring* decoded = nullptr) {
        SkipWhitespace(); if (current_ >= end_ || *current_++ != L'\"') return false;
        std::wstring output;
        while (current_ < end_) {
            wchar_t ch = *current_++;
            if (ch == L'\"') { if (decoded) *decoded = std::move(output); return true; }
            if (ch < 0x20) return false;
            if (ch != L'\\') { output.push_back(ch); continue; }
            if (current_ >= end_) return false;
            wchar_t escaped = *current_++;
            switch (escaped) {
                case L'\"': output.push_back(L'\"'); break; case L'\\': output.push_back(L'\\'); break; case L'/': output.push_back(L'/'); break;
                case L'b': output.push_back(L'\b'); break; case L'f': output.push_back(L'\f'); break; case L'n': output.push_back(L'\n'); break;
                case L'r': output.push_back(L'\r'); break; case L't': output.push_back(L'\t'); break;
                case L'u': {
                    if (end_ - current_ < 4) return false; unsigned int code = 0;
                    for (int index = 0; index < 4; ++index) { int digit = LB_HexDigit(current_[index]); if (digit < 0) return false; code = (code << 4) | static_cast<unsigned int>(digit); }
                    current_ += 4; output.push_back(static_cast<wchar_t>(code)); break;
                }
                default: return false;
            }
        }
        return false;
    }

    bool ParseValue() {
        SkipWhitespace(); if (current_ >= end_) return false;
        if (*current_ == L'\"') return ParseString();
        if (*current_ == L'{') return ParseObject();
        if (*current_ == L'[') return ParseArray();
        if (*current_ == L't') return ParseLiteral(L"true");
        if (*current_ == L'f') return ParseLiteral(L"false");
        if (*current_ == L'n') return ParseLiteral(L"null");
        return ParseNumber();
    }

private:
    bool ParseLiteral(const wchar_t* literal) { const size_t length = wcslen(literal); if (static_cast<size_t>(end_ - current_) < length || wcsncmp(current_, literal, length) != 0) return false; current_ += length; return true; }
    bool ParseNumber() {
        const wchar_t* start = current_; if (current_ < end_ && *current_ == L'-') ++current_;
        if (current_ >= end_) return false;
        if (*current_ == L'0') ++current_; else { if (!iswdigit(*current_)) return false; while (current_ < end_ && iswdigit(*current_)) ++current_; }
        if (current_ < end_ && *current_ == L'.') { ++current_; if (current_ >= end_ || !iswdigit(*current_)) return false; while (current_ < end_ && iswdigit(*current_)) ++current_; }
        if (current_ < end_ && (*current_ == L'e' || *current_ == L'E')) { ++current_; if (current_ < end_ && (*current_ == L'+' || *current_ == L'-')) ++current_; if (current_ >= end_ || !iswdigit(*current_)) return false; while (current_ < end_ && iswdigit(*current_)) ++current_; }
        return current_ > start;
    }
    bool ParseObject() {
        if (!Consume(L'{')) return false; SkipWhitespace(); if (Consume(L'}')) return true;
        while (true) { if (!ParseString() || !Consume(L':') || !ParseValue()) return false; SkipWhitespace(); if (Consume(L'}')) return true; if (!Consume(L',')) return false; }
    }
    bool ParseArray() {
        if (!Consume(L'[')) return false; SkipWhitespace(); if (Consume(L']')) return true;
        while (true) { if (!ParseValue()) return false; SkipWhitespace(); if (Consume(L']')) return true; if (!Consume(L',')) return false; }
    }
    const wchar_t* begin_; const wchar_t* current_; const wchar_t* end_;
};

bool JSON_是否有效(const wchar_t* json) { const std::wstring source = LB_Wide(json); LB_JsonReader reader(source); return reader.ParseValue() && reader.AtEnd(); }

static bool LB_JsonTopField(const wchar_t* json, const wchar_t* field, std::wstring& raw) {
    const std::wstring source = LB_Wide(json), expected = LB_Wide(field); LB_JsonReader reader(source);
    if (!reader.Consume(L'{')) return false; if (reader.Consume(L'}')) return false;
    while (true) {
        std::wstring key; if (!reader.ParseString(&key) || !reader.Consume(L':')) return false;
        const wchar_t* start = reader.Position(); if (!reader.ParseValue()) return false; const wchar_t* finish = reader.Position();
        if (key == expected) { raw.assign(start, finish); return true; }
        if (reader.Consume(L'}')) return false; if (!reader.Consume(L',')) return false;
    }
}

const wchar_t* JSON_转义文本(const wchar_t* text) {
    std::wstring output; for (wchar_t ch : LB_Wide(text)) {
        switch (ch) { case L'\"': output += L"\\\""; break; case L'\\': output += L"\\\\"; break; case L'\b': output += L"\\b"; break; case L'\f': output += L"\\f"; break; case L'\n': output += L"\\n"; break; case L'\r': output += L"\\r"; break; case L'\t': output += L"\\t"; break; default: output.push_back(ch); }
    } return LB_ReturnText(std::move(output));
}

const wchar_t* JSON_取文本(const wchar_t* json, const wchar_t* field) {
    std::wstring raw, decoded; if (!LB_JsonTopField(json, field, raw)) return LB_ReturnText(L""); LB_JsonReader reader(raw);
    return reader.ParseString(&decoded) && reader.AtEnd() ? LB_ReturnText(std::move(decoded)) : LB_ReturnText(L"");
}

int JSON_取整数(const wchar_t* json, const wchar_t* field, int fallback) {
    std::wstring raw; if (!LB_JsonTopField(json, field, raw)) return fallback; wchar_t* end = nullptr; long value = wcstol(raw.c_str(), &end, 10);
    while (end && *end && iswspace(*end)) ++end; return end && *end == 0 ? static_cast<int>(value) : fallback;
}

bool JSON_取逻辑(const wchar_t* json, const wchar_t* field, bool fallback) {
    std::wstring raw; if (!LB_JsonTopField(json, field, raw)) return fallback;
    raw.erase(raw.begin(), std::find_if(raw.begin(), raw.end(), [](wchar_t ch) { return !iswspace(ch); }));
    while (!raw.empty() && iswspace(raw.back())) raw.pop_back();
    if (raw == L"true") return true; if (raw == L"false") return false; return fallback;
}
`;

const XML_RUNTIME = String.raw`
static bool LB_XmlNameValid(const std::wstring& name) {
    if (name.empty() || !(iswalpha(name[0]) || name[0] == L'_' || name[0] == L':')) return false;
    return std::all_of(name.begin() + 1, name.end(), [](wchar_t ch) { return iswalnum(ch) || ch == L'_' || ch == L':' || ch == L'-' || ch == L'.'; });
}

const wchar_t* XML_转义文本(const wchar_t* text) {
    std::wstring value = LB_Wide(text); LB_ReplaceAll(value, L"&", L"&amp;"); LB_ReplaceAll(value, L"<", L"&lt;"); LB_ReplaceAll(value, L">", L"&gt;");
    LB_ReplaceAll(value, L"\"", L"&quot;"); LB_ReplaceAll(value, L"'", L"&apos;"); return LB_ReturnText(std::move(value));
}

const wchar_t* XML_反转义文本(const wchar_t* text) {
    std::wstring value = LB_Wide(text); LB_ReplaceAll(value, L"&lt;", L"<"); LB_ReplaceAll(value, L"&gt;", L">"); LB_ReplaceAll(value, L"&quot;", L"\"");
    LB_ReplaceAll(value, L"&apos;", L"'"); LB_ReplaceAll(value, L"&amp;", L"&"); return LB_ReturnText(std::move(value));
}

const wchar_t* XML_生成节点(const wchar_t* name, const wchar_t* content) {
    const std::wstring node = LB_Wide(name); if (!LB_XmlNameValid(node)) return LB_ReturnText(L"");
    const std::wstring escaped = XML_转义文本(content); return LB_ReturnText(L"<" + node + L">" + escaped + L"</" + node + L">");
}

bool XML_是否包含节点(const wchar_t* xml, const wchar_t* name) {
    const std::wstring source = LB_Wide(xml), node = LB_Wide(name); if (!LB_XmlNameValid(node)) return false;
    return source.find(L"<" + node + L">") != std::wstring::npos;
}

const wchar_t* XML_取节点文本(const wchar_t* xml, const wchar_t* name) {
    const std::wstring source = LB_Wide(xml), node = LB_Wide(name); if (!LB_XmlNameValid(node)) return LB_ReturnText(L"");
    const std::wstring open = L"<" + node + L">", close = L"</" + node + L">"; const size_t start = source.find(open);
    if (start == std::wstring::npos) return LB_ReturnText(L""); const size_t contentStart = start + open.size(); const size_t finish = source.find(close, contentStart);
    if (finish == std::wstring::npos) return LB_ReturnText(L""); return XML_反转义文本(source.substr(contentStart, finish - contentStart).c_str());
}
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.std.text': TEXT_RUNTIME,
  'lingbuilder.std.bytes': BYTES_RUNTIME,
  'lingbuilder.std.encoding': ENCODING_RUNTIME,
  'lingbuilder.std.math': MATH_RUNTIME,
  'lingbuilder.std.datetime': DATETIME_RUNTIME,
  'lingbuilder.std.regex': REGEX_RUNTIME,
  'lingbuilder.data.json': JSON_RUNTIME,
  'lingbuilder.data.xml': XML_RUNTIME
};

export function generateStandardLibraryRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  const fragments = Object.entries(RUNTIMES)
    .filter(([moduleId]) => enabledIds.has(moduleId))
    .map(([, runtime]) => runtime);
  return fragments.join('\n');
}

export function isStandardLibraryModule(moduleId: string): boolean {
  return STANDARD_LIBRARY_MODULE_IDS.has(moduleId);
}
