import { InstalledModule } from '../modules/types';
import { STANDARD_LIBRARY_MODULE_IDS } from '../modules/standardLibraryModules';
import { JSON_RUNTIME } from './jsonRuntime';

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

const ARRAY_RUNTIME = String.raw`
template <typename T, typename = void> struct LB_ArrayEquatable : std::false_type {};
template <typename T> struct LB_ArrayEquatable<T, std::void_t<decltype(std::declval<const T&>() == std::declval<const T&>())>> : std::true_type {};

template <typename T, typename = void> struct LB_ArrayOrderable : std::false_type {};
template <typename T> struct LB_ArrayOrderable<T, std::void_t<decltype(std::declval<const T&>() < std::declval<const T&>())>> : std::true_type {};

// 文本成员沿用标准库统一的 const wchar_t* 返回约定，其余元素类型按值返回。
template <typename T> struct LB_ArrayMemberResult { using type = T; };
template <> struct LB_ArrayMemberResult<std::wstring> { using type = const wchar_t*; };

static bool LB_ArrayIndexValid(size_t count, int index) {
    return index >= 0 && static_cast<size_t>(index) < count;
}

template <typename T> int 数组_取成员数(const std::vector<T>& items) { return static_cast<int>(items.size()); }

template <typename T> bool 数组_是否为空(const std::vector<T>& items) { return items.empty(); }

template <typename T> typename LB_ArrayMemberResult<T>::type 数组_取成员(const std::vector<T>& items, int index) {
    const bool valid = LB_ArrayIndexValid(items.size(), index);
    if constexpr (std::is_same_v<T, std::wstring>) {
        return LB_ReturnText(valid ? items[static_cast<size_t>(index)] : std::wstring());
    } else {
        return valid ? items[static_cast<size_t>(index)] : T{};
    }
}

template <typename T, typename V> bool 数组_置成员(std::vector<T>& items, int index, V&& value) {
    if (!LB_ArrayIndexValid(items.size(), index)) return false;
    items[static_cast<size_t>(index)] = T(std::forward<V>(value));
    return true;
}

template <typename T, typename V> int 数组_加入成员(std::vector<T>& items, V&& value) {
    items.push_back(T(std::forward<V>(value)));
    return static_cast<int>(items.size());
}

template <typename T, typename V> bool 数组_插入成员(std::vector<T>& items, int index, V&& value) {
    if (index < 0 || static_cast<size_t>(index) > items.size()) return false;
    items.insert(items.begin() + static_cast<typename std::vector<T>::difference_type>(index), T(std::forward<V>(value)));
    return true;
}

template <typename T> bool 数组_删除成员(std::vector<T>& items, int index) {
    if (!LB_ArrayIndexValid(items.size(), index)) return false;
    items.erase(items.begin() + static_cast<typename std::vector<T>::difference_type>(index));
    return true;
}

template <typename T> bool 数组_清空(std::vector<T>& items) { items.clear(); return true; }

template <typename T, typename V> int 数组_查找(const std::vector<T>& items, V&& value) {
    if constexpr (LB_ArrayEquatable<T>::value) {
        const T target(std::forward<V>(value));
        for (size_t index = 0; index < items.size(); ++index) {
            if (items[index] == target) return static_cast<int>(index);
        }
        return -1;
    } else {
        return -1;
    }
}

template <typename T, typename V> bool 数组_是否包含(const std::vector<T>& items, V&& value) {
    return 数组_查找(items, std::forward<V>(value)) >= 0;
}

template <typename T> bool 数组_排序(std::vector<T>& items, bool ascending) {
    if constexpr (LB_ArrayOrderable<T>::value) {
        std::stable_sort(items.begin(), items.end(), [ascending](const T& left, const T& right) {
            return ascending ? left < right : right < left;
        });
        return true;
    } else {
        return false;
    }
}

template <typename T> bool 数组_倒序(std::vector<T>& items) {
    std::reverse(items.begin(), items.end());
    return true;
}

template <typename T> bool 数组_重定义(std::vector<T>& items, int count) {
    if (count < 0) return false;
    items.resize(static_cast<size_t>(count));
    return true;
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

int 字节集_长度(const std::vector<unsigned char>& bytes) {
    return bytes.size() > static_cast<size_t>((std::numeric_limits<int>::max)())
        ? (std::numeric_limits<int>::max)()
        : static_cast<int>(bytes.size());
}

std::vector<unsigned char> 字节集_截取(const std::vector<unsigned char>& bytes, int start, int length) {
    if (start < 0 || length <= 0 || static_cast<size_t>(start) >= bytes.size()) return {};
    const size_t offset = static_cast<size_t>(start);
    const size_t count = (std::min)(static_cast<size_t>(length), bytes.size() - offset);
    return std::vector<unsigned char>(bytes.begin() + static_cast<std::ptrdiff_t>(offset), bytes.begin() + static_cast<std::ptrdiff_t>(offset + count));
}

std::vector<unsigned char> 字节集_拼接(const std::vector<unsigned char>& first, const std::vector<unsigned char>& second) {
    if (second.size() > (std::numeric_limits<size_t>::max)() - first.size()) return {};
    std::vector<unsigned char> result; result.reserve(first.size() + second.size());
    result.insert(result.end(), first.begin(), first.end()); result.insert(result.end(), second.begin(), second.end());
    return result;
}

int 字节集_取字节(const std::vector<unsigned char>& bytes, int index) {
    return index >= 0 && static_cast<size_t>(index) < bytes.size() ? bytes[static_cast<size_t>(index)] : -1;
}

bool 字节集_置字节(std::vector<unsigned char>& bytes, int index, int value) {
    if (index < 0 || static_cast<size_t>(index) >= bytes.size() || value < 0 || value > 255) return false;
    bytes[static_cast<size_t>(index)] = static_cast<unsigned char>(value); return true;
}

static std::wstring LB_BytesBase64Encode(const std::vector<unsigned char>& bytes) {
    static constexpr wchar_t alphabet[] = L"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::wstring result;
    result.reserve(((bytes.size() + 2) / 3) * 4);
    for (size_t offset = 0; offset < bytes.size(); offset += 3) {
        const unsigned int a = bytes[offset];
        const unsigned int b = offset + 1 < bytes.size() ? bytes[offset + 1] : 0;
        const unsigned int c = offset + 2 < bytes.size() ? bytes[offset + 2] : 0;
        const unsigned int block = (a << 16) | (b << 8) | c;
        result.push_back(alphabet[(block >> 18) & 63]); result.push_back(alphabet[(block >> 12) & 63]);
        result.push_back(offset + 1 < bytes.size() ? alphabet[(block >> 6) & 63] : L'=');
        result.push_back(offset + 2 < bytes.size() ? alphabet[block & 63] : L'=');
    }
    return result;
}

std::wstring 字节集_Base64编码(const std::vector<unsigned char>& bytes) { return LB_BytesBase64Encode(bytes); }

static int LB_BytesBase64Value(wchar_t value) {
    static constexpr wchar_t alphabet[] = L"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const wchar_t* found = std::wcschr(alphabet, value); return found ? static_cast<int>(found - alphabet) : -1;
}

std::vector<unsigned char> 字节集_Base64解码(const wchar_t* text) {
    const std::wstring input = LB_Wide(text); if (input.empty()) return {};
    if (input.size() % 4 != 0) return {};
    std::vector<unsigned char> result;
    result.reserve((input.size() / 4) * 3);
    for (size_t offset = 0; offset < input.size(); offset += 4) {
        int values[4] = {};
        for (int index = 0; index < 4; ++index) values[index] = input[offset + static_cast<size_t>(index)] == L'=' ? -2 : LB_BytesBase64Value(input[offset + static_cast<size_t>(index)]);
        if (values[0] < 0 || values[1] < 0 || values[2] == -1 || values[3] == -1 || (values[2] == -2 && values[3] != -2)) return {};
        const unsigned int block = (static_cast<unsigned int>(values[0]) << 18) | (static_cast<unsigned int>(values[1]) << 12)
            | (static_cast<unsigned int>((std::max)(0, values[2])) << 6) | static_cast<unsigned int>((std::max)(0, values[3]));
        result.push_back(static_cast<unsigned char>((block >> 16) & 0xff));
        if (values[2] >= 0) result.push_back(static_cast<unsigned char>((block >> 8) & 0xff));
        if (values[3] >= 0) result.push_back(static_cast<unsigned char>(block & 0xff));
    }
    return result;
}

std::vector<unsigned char> 字节集_十六进制编码(const std::vector<unsigned char>& bytes) {
    std::vector<unsigned char> result; result.reserve(bytes.size() * 2);
    static constexpr unsigned char digits[] = "0123456789ABCDEF";
    for (unsigned char byte : bytes) { result.push_back(digits[(byte >> 4) & 0x0f]); result.push_back(digits[byte & 0x0f]); }
    return result;
}

std::vector<unsigned char> 字节集_十六进制解码(const wchar_t* hex) {
    const std::wstring value = LB_Wide(hex); if (value.size() % 2 != 0) return {};
    std::vector<unsigned char> result; result.reserve(value.size() / 2);
    for (size_t index = 0; index < value.size(); index += 2) {
        const int high = LB_HexDigit(value[index]), low = LB_HexDigit(value[index + 1]);
        if (high < 0 || low < 0) return {};
        result.push_back(static_cast<unsigned char>((high << 4) | low));
    }
    return result;
}
`;

const ENCODING_RUNTIME = String.raw`
static const char* LB_Base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

enum class LB_EncodingKind { Unknown, Utf8, Utf16Le, Utf16Be, Utf32Le, Utf32Be, Ansi, Gbk, Gb2312, Gb18030 };

static bool LB_EncodingHexToBytes(const wchar_t* hex, std::vector<unsigned char>& bytes) {
    const std::wstring value = LB_Wide(hex);
    if (value.size() % 2 != 0) return false;
    bytes.clear();
    bytes.reserve(value.size() / 2);
    for (size_t index = 0; index < value.size(); index += 2) {
        const int high = LB_HexDigit(value[index]);
        const int low = LB_HexDigit(value[index + 1]);
        if (high < 0 || low < 0) { bytes.clear(); return false; }
        bytes.push_back(static_cast<unsigned char>((high << 4) | low));
    }
    return true;
}

static std::wstring LB_EncodingBytesToHex(const std::vector<unsigned char>& bytes) {
    static constexpr wchar_t digits[] = L"0123456789ABCDEF";
    std::wstring result;
    result.reserve(bytes.size() * 2);
    for (unsigned char byte : bytes) {
        result.push_back(digits[(byte >> 4) & 0x0f]);
        result.push_back(digits[byte & 0x0f]);
    }
    return result;
}

static std::wstring LB_NormalizeEncodingName(const wchar_t* name) {
    std::wstring result;
    for (wchar_t ch : LB_Wide(name)) {
        if (ch == L'-' || ch == L'_' || iswspace(ch)) continue;
        result.push_back(static_cast<wchar_t>(towupper(ch)));
    }
    return result;
}

static LB_EncodingKind LB_ParseEncodingKind(const wchar_t* name) {
    const std::wstring value = LB_NormalizeEncodingName(name);
    if (value == L"UTF8") return LB_EncodingKind::Utf8;
    if (value == L"UTF16LE" || value == L"UNICODE") return LB_EncodingKind::Utf16Le;
    if (value == L"UTF16BE") return LB_EncodingKind::Utf16Be;
    if (value == L"UTF32LE") return LB_EncodingKind::Utf32Le;
    if (value == L"UTF32BE") return LB_EncodingKind::Utf32Be;
    if (value == L"ANSI" || value == L"ACP" || value == L"SYSTEM") return LB_EncodingKind::Ansi;
    if (value == L"GBK" || value == L"CP936") return LB_EncodingKind::Gbk;
    if (value == L"GB2312") return LB_EncodingKind::Gb2312;
    if (value == L"GB18030" || value == L"CP54936") return LB_EncodingKind::Gb18030;
    return LB_EncodingKind::Unknown;
}

static const wchar_t* LB_EncodingKindName(LB_EncodingKind kind) {
    switch (kind) {
        case LB_EncodingKind::Utf8: return L"UTF-8";
        case LB_EncodingKind::Utf16Le: return L"UTF-16LE";
        case LB_EncodingKind::Utf16Be: return L"UTF-16BE";
        case LB_EncodingKind::Utf32Le: return L"UTF-32LE";
        case LB_EncodingKind::Utf32Be: return L"UTF-32BE";
        case LB_EncodingKind::Ansi: return L"ANSI";
        case LB_EncodingKind::Gbk: return L"GBK";
        case LB_EncodingKind::Gb2312: return L"GB2312";
        case LB_EncodingKind::Gb18030: return L"GB18030";
        default: return L"";
    }
}

static LB_EncodingKind LB_DetectBomKind(const std::vector<unsigned char>& bytes, size_t* bomSize = nullptr) {
    LB_EncodingKind kind = LB_EncodingKind::Unknown;
    size_t size = 0;
    if (bytes.size() >= 4 && bytes[0] == 0xff && bytes[1] == 0xfe && bytes[2] == 0x00 && bytes[3] == 0x00) { kind = LB_EncodingKind::Utf32Le; size = 4; }
    else if (bytes.size() >= 4 && bytes[0] == 0x00 && bytes[1] == 0x00 && bytes[2] == 0xfe && bytes[3] == 0xff) { kind = LB_EncodingKind::Utf32Be; size = 4; }
    else if (bytes.size() >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf) { kind = LB_EncodingKind::Utf8; size = 3; }
    else if (bytes.size() >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) { kind = LB_EncodingKind::Utf16Le; size = 2; }
    else if (bytes.size() >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff) { kind = LB_EncodingKind::Utf16Be; size = 2; }
    if (bomSize) *bomSize = size;
    return kind;
}

static std::vector<unsigned char> LB_BomBytes(LB_EncodingKind kind) {
    switch (kind) {
        case LB_EncodingKind::Utf8: return { 0xef, 0xbb, 0xbf };
        case LB_EncodingKind::Utf16Le: return { 0xff, 0xfe };
        case LB_EncodingKind::Utf16Be: return { 0xfe, 0xff };
        case LB_EncodingKind::Utf32Le: return { 0xff, 0xfe, 0x00, 0x00 };
        case LB_EncodingKind::Utf32Be: return { 0x00, 0x00, 0xfe, 0xff };
        default: return {};
    }
}

static bool LB_WideToCodePoints(const wchar_t* text, std::vector<uint32_t>& points) {
    const std::wstring value = LB_Wide(text);
    points.clear();
    points.reserve(value.size());
    for (size_t index = 0; index < value.size(); ++index) {
        const uint32_t first = static_cast<uint16_t>(value[index]);
        if (first >= 0xd800 && first <= 0xdbff) {
            if (index + 1 >= value.size()) return false;
            const uint32_t second = static_cast<uint16_t>(value[++index]);
            if (second < 0xdc00 || second > 0xdfff) return false;
            points.push_back(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
        } else {
            if (first >= 0xdc00 && first <= 0xdfff) return false;
            points.push_back(first);
        }
    }
    return true;
}

static bool LB_CodePointsToWide(const std::vector<uint32_t>& points, std::wstring& text) {
    text.clear();
    for (uint32_t point : points) {
        if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) { text.clear(); return false; }
        if (point <= 0xffff) text.push_back(static_cast<wchar_t>(point));
        else {
            point -= 0x10000;
            text.push_back(static_cast<wchar_t>(0xd800 + (point >> 10)));
            text.push_back(static_cast<wchar_t>(0xdc00 + (point & 0x3ff)));
        }
    }
    return true;
}

static bool LB_IsGb2312Bytes(const std::vector<unsigned char>& bytes) {
    for (size_t index = 0; index < bytes.size();) {
        if (bytes[index] <= 0x7f) { ++index; continue; }
        if (index + 1 >= bytes.size() || bytes[index] < 0xa1 || bytes[index] > 0xf7 || bytes[index + 1] < 0xa1 || bytes[index + 1] > 0xfe) return false;
        index += 2;
    }
    return true;
}

static bool LB_WideToCodePage(const wchar_t* text, UINT requestedCodePage, std::vector<unsigned char>& bytes) {
    const std::wstring value = LB_Wide(text);
    bytes.clear();
    if (value.empty()) return true;
    const UINT codePage = requestedCodePage == CP_ACP ? GetACP() : requestedCodePage;
    const bool strictUnicodeCodePage = codePage == CP_UTF8 || codePage == 54936;
    const DWORD flags = strictUnicodeCodePage ? WC_ERR_INVALID_CHARS : WC_NO_BEST_FIT_CHARS;
    BOOL usedDefault = FALSE;
    BOOL* usedDefaultPointer = strictUnicodeCodePage ? nullptr : &usedDefault;
    const int size = WideCharToMultiByte(codePage, flags, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, usedDefaultPointer);
    if (size <= 0 || usedDefault) return false;
    bytes.resize(static_cast<size_t>(size));
    if (WideCharToMultiByte(codePage, flags, value.data(), static_cast<int>(value.size()), reinterpret_cast<char*>(bytes.data()), size, nullptr, usedDefaultPointer) != size || usedDefault) {
        bytes.clear(); return false;
    }
    return true;
}

static bool LB_CodePageToWide(const std::vector<unsigned char>& bytes, UINT requestedCodePage, std::wstring& text) {
    text.clear();
    if (bytes.empty()) return true;
    const UINT codePage = requestedCodePage == CP_ACP ? GetACP() : requestedCodePage;
    const DWORD flags = codePage == CP_UTF8 || codePage == 54936 ? MB_ERR_INVALID_CHARS : 0;
    const int size = MultiByteToWideChar(codePage, flags, reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()), nullptr, 0);
    if (size <= 0) return false;
    text.resize(static_cast<size_t>(size));
    if (MultiByteToWideChar(codePage, flags, reinterpret_cast<const char*>(bytes.data()), static_cast<int>(bytes.size()), text.data(), size) != size) {
        text.clear(); return false;
    }
    return true;
}

static bool LB_EncodeTextBytes(const wchar_t* text, LB_EncodingKind kind, std::vector<unsigned char>& bytes) {
    bytes.clear();
    if (kind == LB_EncodingKind::Utf8) return LB_WideToCodePage(text, CP_UTF8, bytes);
    if (kind == LB_EncodingKind::Ansi) return LB_WideToCodePage(text, CP_ACP, bytes);
    if (kind == LB_EncodingKind::Gbk || kind == LB_EncodingKind::Gb2312) {
        if (!LB_WideToCodePage(text, 936, bytes)) return false;
        if (kind == LB_EncodingKind::Gb2312 && !LB_IsGb2312Bytes(bytes)) { bytes.clear(); return false; }
        return true;
    }
    if (kind == LB_EncodingKind::Gb18030) return LB_WideToCodePage(text, 54936, bytes);

    std::vector<uint32_t> points;
    if (!LB_WideToCodePoints(text, points)) return false;
    if (kind == LB_EncodingKind::Utf16Le || kind == LB_EncodingKind::Utf16Be) {
        const bool little = kind == LB_EncodingKind::Utf16Le;
        const std::wstring value = LB_Wide(text);
        bytes.reserve(value.size() * 2);
        for (wchar_t character : value) {
            const uint16_t unit = static_cast<uint16_t>(character);
            const unsigned char low = static_cast<unsigned char>(unit & 0xff);
            const unsigned char high = static_cast<unsigned char>((unit >> 8) & 0xff);
            bytes.push_back(little ? low : high); bytes.push_back(little ? high : low);
        }
        return true;
    }
    if (kind == LB_EncodingKind::Utf32Le || kind == LB_EncodingKind::Utf32Be) {
        const bool little = kind == LB_EncodingKind::Utf32Le;
        bytes.reserve(points.size() * 4);
        for (uint32_t point : points) {
            const unsigned char a = static_cast<unsigned char>(point & 0xff);
            const unsigned char b = static_cast<unsigned char>((point >> 8) & 0xff);
            const unsigned char c = static_cast<unsigned char>((point >> 16) & 0xff);
            const unsigned char d = static_cast<unsigned char>((point >> 24) & 0xff);
            if (little) bytes.insert(bytes.end(), { a, b, c, d });
            else bytes.insert(bytes.end(), { d, c, b, a });
        }
        return true;
    }
    return false;
}

static bool LB_DecodeTextBytes(std::vector<unsigned char> bytes, LB_EncodingKind kind, std::wstring& text) {
    text.clear();
    size_t bomSize = 0;
    if (LB_DetectBomKind(bytes, &bomSize) == kind && bomSize > 0) bytes.erase(bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(bomSize));
    if (kind == LB_EncodingKind::Utf8) return LB_CodePageToWide(bytes, CP_UTF8, text);
    if (kind == LB_EncodingKind::Ansi) return LB_CodePageToWide(bytes, CP_ACP, text);
    if (kind == LB_EncodingKind::Gbk || kind == LB_EncodingKind::Gb2312) {
        if (kind == LB_EncodingKind::Gb2312 && !LB_IsGb2312Bytes(bytes)) return false;
        return LB_CodePageToWide(bytes, 936, text);
    }
    if (kind == LB_EncodingKind::Gb18030) return LB_CodePageToWide(bytes, 54936, text);
    if (kind == LB_EncodingKind::Utf16Le || kind == LB_EncodingKind::Utf16Be) {
        if (bytes.size() % 2 != 0) return false;
        const bool little = kind == LB_EncodingKind::Utf16Le;
        std::vector<uint32_t> points;
        for (size_t index = 0; index < bytes.size(); index += 2) {
            const uint16_t unit = little
                ? static_cast<uint16_t>(bytes[index] | (static_cast<uint16_t>(bytes[index + 1]) << 8))
                : static_cast<uint16_t>((static_cast<uint16_t>(bytes[index]) << 8) | bytes[index + 1]);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                if (index + 3 >= bytes.size()) return false;
                index += 2;
                const uint16_t second = little
                    ? static_cast<uint16_t>(bytes[index] | (static_cast<uint16_t>(bytes[index + 1]) << 8))
                    : static_cast<uint16_t>((static_cast<uint16_t>(bytes[index]) << 8) | bytes[index + 1]);
                if (second < 0xdc00 || second > 0xdfff) return false;
                points.push_back(0x10000 + ((unit - 0xd800) << 10) + (second - 0xdc00));
            } else {
                if (unit >= 0xdc00 && unit <= 0xdfff) return false;
                points.push_back(unit);
            }
        }
        return LB_CodePointsToWide(points, text);
    }
    if (kind == LB_EncodingKind::Utf32Le || kind == LB_EncodingKind::Utf32Be) {
        if (bytes.size() % 4 != 0) return false;
        const bool little = kind == LB_EncodingKind::Utf32Le;
        std::vector<uint32_t> points;
        points.reserve(bytes.size() / 4);
        for (size_t index = 0; index < bytes.size(); index += 4) {
            const uint32_t point = little
                ? static_cast<uint32_t>(bytes[index]) | (static_cast<uint32_t>(bytes[index + 1]) << 8) | (static_cast<uint32_t>(bytes[index + 2]) << 16) | (static_cast<uint32_t>(bytes[index + 3]) << 24)
                : (static_cast<uint32_t>(bytes[index]) << 24) | (static_cast<uint32_t>(bytes[index + 1]) << 16) | (static_cast<uint32_t>(bytes[index + 2]) << 8) | static_cast<uint32_t>(bytes[index + 3]);
            points.push_back(point);
        }
        return LB_CodePointsToWide(points, text);
    }
    return false;
}

static const wchar_t* LB_EncodingTextToHex(const wchar_t* text, LB_EncodingKind kind) {
    std::vector<unsigned char> bytes;
    return LB_EncodeTextBytes(text, kind, bytes) ? LB_ReturnText(LB_EncodingBytesToHex(bytes)) : LB_ReturnText(L"");
}

static const wchar_t* LB_EncodingHexToText(const wchar_t* hex, LB_EncodingKind kind) {
    std::vector<unsigned char> bytes; std::wstring text;
    return LB_EncodingHexToBytes(hex, bytes) && LB_DecodeTextBytes(std::move(bytes), kind, text) ? LB_ReturnText(std::move(text)) : LB_ReturnText(L"");
}

const wchar_t* 编码_文本转UTF8(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Utf8); }
const wchar_t* 编码_UTF8转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Utf8); }
const wchar_t* 编码_文本转UTF16LE(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Utf16Le); }
const wchar_t* 编码_UTF16LE转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Utf16Le); }
const wchar_t* 编码_文本转UTF16BE(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Utf16Be); }
const wchar_t* 编码_UTF16BE转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Utf16Be); }
const wchar_t* 编码_文本转UTF32LE(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Utf32Le); }
const wchar_t* 编码_UTF32LE转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Utf32Le); }
const wchar_t* 编码_文本转UTF32BE(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Utf32Be); }
const wchar_t* 编码_UTF32BE转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Utf32Be); }
const wchar_t* 编码_文本转ANSI(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Ansi); }
const wchar_t* 编码_ANSI转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Ansi); }
const wchar_t* 编码_文本转GBK(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Gbk); }
const wchar_t* 编码_GBK转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Gbk); }
const wchar_t* 编码_文本转GB2312(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Gb2312); }
const wchar_t* 编码_GB2312转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Gb2312); }
const wchar_t* 编码_文本转GB18030(const wchar_t* text) { return LB_EncodingTextToHex(text, LB_EncodingKind::Gb18030); }
const wchar_t* 编码_GB18030转文本(const wchar_t* hex) { return LB_EncodingHexToText(hex, LB_EncodingKind::Gb18030); }

const wchar_t* 编码_转换(const wchar_t* hex, const wchar_t* sourceEncoding, const wchar_t* targetEncoding) {
    const LB_EncodingKind source = LB_ParseEncodingKind(sourceEncoding), target = LB_ParseEncodingKind(targetEncoding);
    std::vector<unsigned char> sourceBytes, targetBytes; std::wstring text;
    if (source == LB_EncodingKind::Unknown || target == LB_EncodingKind::Unknown || !LB_EncodingHexToBytes(hex, sourceBytes)
        || !LB_DecodeTextBytes(std::move(sourceBytes), source, text) || !LB_EncodeTextBytes(text.c_str(), target, targetBytes)) return LB_ReturnText(L"");
    return LB_ReturnText(LB_EncodingBytesToHex(targetBytes));
}

const wchar_t* 编码_添加BOM(const wchar_t* hex, const wchar_t* encodingName) {
    std::vector<unsigned char> bytes;
    if (!LB_EncodingHexToBytes(hex, bytes)) return LB_ReturnText(L"");
    const LB_EncodingKind kind = LB_ParseEncodingKind(encodingName);
    const std::vector<unsigned char> bom = LB_BomBytes(kind);
    if (bom.empty()) return LB_ReturnText(L"");
    size_t existingSize = 0;
    const LB_EncodingKind existing = LB_DetectBomKind(bytes, &existingSize);
    if (existing == kind) return LB_ReturnText(LB_EncodingBytesToHex(bytes));
    if (existing != LB_EncodingKind::Unknown) return LB_ReturnText(L"");
    bytes.insert(bytes.begin(), bom.begin(), bom.end());
    return LB_ReturnText(LB_EncodingBytesToHex(bytes));
}

const wchar_t* 编码_删除BOM(const wchar_t* hex) {
    std::vector<unsigned char> bytes;
    if (!LB_EncodingHexToBytes(hex, bytes)) return LB_ReturnText(L"");
    size_t bomSize = 0;
    LB_DetectBomKind(bytes, &bomSize);
    if (bomSize > 0) bytes.erase(bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(bomSize));
    return LB_ReturnText(LB_EncodingBytesToHex(bytes));
}

bool 编码_是否有BOM(const wchar_t* hex) {
    std::vector<unsigned char> bytes;
    return LB_EncodingHexToBytes(hex, bytes) && LB_DetectBomKind(bytes) != LB_EncodingKind::Unknown;
}

const wchar_t* 编码_检测BOM(const wchar_t* hex) {
    std::vector<unsigned char> bytes;
    if (!LB_EncodingHexToBytes(hex, bytes)) return LB_ReturnText(L"");
    return LB_ReturnText(LB_EncodingKindName(LB_DetectBomKind(bytes)));
}

const wchar_t* 编码_检测(const wchar_t* hex) {
    std::vector<unsigned char> bytes; std::wstring text;
    if (!LB_EncodingHexToBytes(hex, bytes)) return LB_ReturnText(L"未知");
    const LB_EncodingKind bom = LB_DetectBomKind(bytes);
    if (bom != LB_EncodingKind::Unknown) return LB_ReturnText(LB_EncodingKindName(bom));
    return LB_CodePageToWide(bytes, CP_UTF8, text) ? LB_ReturnText(L"UTF-8") : LB_ReturnText(L"未知");
}

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
  'lingbuilder.std.array': ARRAY_RUNTIME,
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
