import { InstalledModule } from '../modules/types';
import { STANDARD_LIBRARY_MODULE_IDS } from '../modules/standardLibraryModules';
import { JSON_RUNTIME } from './jsonRuntime';
import { LB_PINYIN_TABLE_CPP, LB_LUNAR_TABLE_CPP } from './stdDataTables';

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

long long 文本_倒找(const wchar_t* text, const wchar_t* target) {
    const std::wstring value = LB_Wide(text);
    const size_t position = value.rfind(LB_Wide(target));
    return position == std::wstring::npos ? -1 : static_cast<long long>(position);
}

const wchar_t* 文本_替换子文本(const wchar_t* text, const wchar_t* search, const wchar_t* replacement, int start, int count) {
    std::wstring value = LB_Wide(text);
    const std::wstring from = LB_Wide(search);
    const std::wstring to = LB_Wide(replacement);
    if (from.empty() || start < 0 || static_cast<size_t>(start) >= value.size()) return LB_ReturnText(std::move(value));
    size_t position = static_cast<size_t>(start);
    int replaced = 0;
    while ((position = value.find(from, position)) != std::wstring::npos) {
        value.replace(position, from.size(), to);
        position += to.size();
        ++replaced;
        if (count > 0 && replaced >= count) break;
    }
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_删全部空白(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    value.erase(std::remove_if(value.begin(), value.end(), [](wchar_t ch) { return iswspace(ch) != 0; }), value.end());
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_到全角(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    for (wchar_t& ch : value) {
        if (ch == L' ') { ch = 0x3000; continue; }
        if (ch >= L'!' && ch <= L'~') ch = static_cast<wchar_t>(ch - 0x21 + 0xFF01);
    }
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_到半角(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    for (wchar_t& ch : value) {
        if (ch == 0x3000) { ch = L' '; continue; }
        if (ch >= 0xFF01 && ch <= 0xFF5E) ch = static_cast<wchar_t>(ch - 0xFF01 + 0x21);
    }
    return LB_ReturnText(std::move(value));
}

const wchar_t* 文本_重复(const wchar_t* text, int count) {
    const std::wstring value = LB_Wide(text);
    if (count <= 0 || value.empty()) return LB_ReturnText(L"");
    const long long total = static_cast<long long>(value.size()) * static_cast<long long>(count);
    if (total > 16777216) return LB_ReturnText(L"");
    std::wstring result;
    result.reserve(static_cast<size_t>(total));
    for (int index = 0; index < count; ++index) result += value;
    return LB_ReturnText(std::move(result));
}

const wchar_t* 文本_插入(const wchar_t* text, int position, const wchar_t* insertion) {
    std::wstring value = LB_Wide(text);
    if (position < 0 || static_cast<size_t>(position) > value.size()) return LB_ReturnText(std::move(value));
    value.insert(static_cast<size_t>(position), LB_Wide(insertion));
    return LB_ReturnText(std::move(value));
}

long long 文本_分割(const wchar_t* text, const wchar_t* separator, std::vector<std::wstring>& out) {
    out.clear();
    const std::wstring value = LB_Wide(text);
    const std::wstring sep = LB_Wide(separator);
    if (sep.empty()) { out.push_back(value); return 1; }
    size_t start = 0;
    for (;;) {
        const size_t position = value.find(sep, start);
        if (position == std::wstring::npos) { out.push_back(value.substr(start)); break; }
        out.push_back(value.substr(start, position - start));
        start = position + sep.size();
    }
    return static_cast<long long>(out.size());
}

const wchar_t* 文本_取左边(const wchar_t* text, int length) {
    const std::wstring value = LB_Wide(text);
    if (length <= 0) return LB_ReturnText(L"");
    return LB_ReturnText(value.substr(0, static_cast<size_t>((std::min)(static_cast<size_t>(length), value.size()))));
}

const wchar_t* 文本_取右边(const wchar_t* text, int length) {
    const std::wstring value = LB_Wide(text);
    if (length <= 0) return LB_ReturnText(L"");
    const size_t count = (std::min)(static_cast<size_t>(length), value.size());
    return LB_ReturnText(value.substr(value.size() - count));
}

const wchar_t* 文本_码点转字符(int code) {
    std::wstring result;
    if (code < 0 || code > 0x10FFFF) return LB_ReturnText(L"");
    if (code >= 0xD800 && code <= 0xDFFF) return LB_ReturnText(L"");
    if (code <= 0xFFFF) {
        result.push_back(static_cast<wchar_t>(code));
    } else {
        const uint32_t offset = static_cast<uint32_t>(code) - 0x10000;
        result.push_back(static_cast<wchar_t>(0xD800 + (offset >> 10)));
        result.push_back(static_cast<wchar_t>(0xDC00 + (offset & 0x3FF)));
    }
    return LB_ReturnText(std::move(result));
}

int 文本_取码点(const wchar_t* text, int position) {
    const std::wstring value = LB_Wide(text);
    if (position < 0 || static_cast<size_t>(position) >= value.size()) return 0;
    const wchar_t first = value[static_cast<size_t>(position)];
    if (first >= 0xD800 && first <= 0xDBFF && static_cast<size_t>(position) + 1 < value.size()) {
        const wchar_t second = value[static_cast<size_t>(position) + 1];
        if (second >= 0xDC00 && second <= 0xDFFF) {
            const uint32_t high = static_cast<uint32_t>(static_cast<uint16_t>(first)) - 0xD800;
            const uint32_t low = static_cast<uint32_t>(static_cast<uint16_t>(second)) - 0xDC00;
            return static_cast<int>(0x10000 + (high << 10) + low);
        }
    }
    return static_cast<int>(static_cast<uint16_t>(first));
}

const wchar_t* 文本_删首空白(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    size_t first = 0;
    while (first < value.size() && iswspace(value[first])) ++first;
    return LB_ReturnText(value.substr(first));
}

const wchar_t* 文本_删尾空白(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    size_t last = value.size();
    while (last > 0 && iswspace(value[last - 1])) --last;
    return LB_ReturnText(value.substr(0, last));
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

long long 字节集_寻找(const std::vector<unsigned char>& bytes, const std::vector<unsigned char>& target, int start) {
    if (target.empty() || start < 0 || target.size() > bytes.size() || static_cast<size_t>(start) > bytes.size() - target.size()) return -1;
    const auto it = std::search(bytes.begin() + static_cast<std::ptrdiff_t>(start), bytes.end(), target.begin(), target.end());
    return it == bytes.end() ? -1 : static_cast<long long>(it - bytes.begin());
}

long long 字节集_倒找(const std::vector<unsigned char>& bytes, const std::vector<unsigned char>& target, int start) {
    if (target.empty() || target.size() > bytes.size()) return -1;
    size_t windowEnd = start < 0 || static_cast<size_t>(start) >= bytes.size() ? bytes.size() : static_cast<size_t>(start) + 1;
    if (windowEnd < target.size()) return -1;
    const auto it = std::find_end(bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(windowEnd), target.begin(), target.end());
    return it == bytes.begin() + static_cast<std::ptrdiff_t>(windowEnd) ? -1 : static_cast<long long>(it - bytes.begin());
}

std::vector<unsigned char> 字节集_替换(const std::vector<unsigned char>& bytes, const std::vector<unsigned char>& target, const std::vector<unsigned char>& replacement, int count) {
    if (target.empty() || target.size() > bytes.size()) return bytes;
    std::vector<unsigned char> result;
    result.reserve(bytes.size());
    size_t position = 0;
    int replaced = 0;
    while (position < bytes.size()) {
        if ((count <= 0 || replaced < count) && position + target.size() <= bytes.size() && std::equal(target.begin(), target.end(), bytes.begin() + static_cast<std::ptrdiff_t>(position))) {
            result.insert(result.end(), replacement.begin(), replacement.end());
            position += target.size();
            ++replaced;
        } else {
            result.push_back(bytes[position]);
            ++position;
        }
    }
    return result;
}

std::vector<unsigned char> 字节集_插入(const std::vector<unsigned char>& bytes, int position, const std::vector<unsigned char>& insertion) {
    if (position < 0) return bytes;
    const size_t offset = (std::min)(static_cast<size_t>(position), bytes.size());
    std::vector<unsigned char> result;
    result.reserve(bytes.size() + insertion.size());
    result.insert(result.end(), bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(offset));
    result.insert(result.end(), insertion.begin(), insertion.end());
    result.insert(result.end(), bytes.begin() + static_cast<std::ptrdiff_t>(offset), bytes.end());
    return result;
}

std::vector<unsigned char> 字节集_删除(const std::vector<unsigned char>& bytes, int position, int length) {
    if (position < 0 || static_cast<size_t>(position) >= bytes.size()) return bytes;
    const size_t offset = static_cast<size_t>(position);
    const size_t count = length < 0 ? bytes.size() - offset : (std::min)(static_cast<size_t>(length), bytes.size() - offset);
    std::vector<unsigned char> result;
    result.reserve(bytes.size() - count);
    result.insert(result.end(), bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(offset));
    result.insert(result.end(), bytes.begin() + static_cast<std::ptrdiff_t>(offset + count), bytes.end());
    return result;
}

std::vector<unsigned char> 字节集_从文本(const wchar_t* text) {
    const std::string utf8 = LB_WideToUtf8(text);
    return std::vector<unsigned char>(utf8.begin(), utf8.end());
}

std::vector<unsigned char> 字节集_重复(int count, const std::vector<unsigned char>& bytes) {
    if (count <= 0 || bytes.empty()) return {};
    const long long total = static_cast<long long>(bytes.size()) * static_cast<long long>(count);
    if (total > 268435456LL) return {};
    std::vector<unsigned char> result;
    result.reserve(static_cast<size_t>(total));
    for (int index = 0; index < count; ++index) result.insert(result.end(), bytes.begin(), bytes.end());
    return result;
}

long long 字节集_分割(const std::vector<unsigned char>& bytes, const std::vector<unsigned char>& separator, std::vector<std::vector<unsigned char>>& out, int limit) {
    out.clear();
    if (bytes.empty()) return 0;
    std::vector<unsigned char> sep = separator;
    if (sep.empty()) sep.assign(1, 0x00);
    const size_t maxPieces = limit > 0 ? static_cast<size_t>(limit) : (std::numeric_limits<size_t>::max)();
    size_t start = 0;
    for (;;) {
        if (out.size() + 1 >= maxPieces) {
            out.emplace_back(bytes.begin() + static_cast<std::ptrdiff_t>(start), bytes.end());
            break;
        }
        const auto found = std::search(bytes.begin() + static_cast<std::ptrdiff_t>(start), bytes.end(), sep.begin(), sep.end());
        if (found == bytes.end()) {
            out.emplace_back(bytes.begin() + static_cast<std::ptrdiff_t>(start), bytes.end());
            break;
        }
        out.emplace_back(bytes.begin() + static_cast<std::ptrdiff_t>(start), found);
        start = static_cast<size_t>(found - bytes.begin()) + sep.size();
    }
    return static_cast<long long>(out.size());
}

const wchar_t* 数值_到十六进制文本(int value) {
    wchar_t buffer[16] = {};
    if (value < 0) swprintf(buffer, 16, L"%08X", static_cast<unsigned int>(value));
    else swprintf(buffer, 16, L"%X", static_cast<unsigned int>(value));
    return LB_ReturnText(buffer);
}

const wchar_t* 数值_到八进制文本(int value) {
    wchar_t buffer[16] = {};
    swprintf(buffer, 16, L"%o", static_cast<unsigned int>(value));
    return LB_ReturnText(buffer);
}

static bool LB_ParseRadixText(const wchar_t* text, int radix, int& out) {
    const std::wstring value = LB_Wide(text);
    size_t index = 0;
    size_t end = value.size();
    while (index < end && iswspace(value[index])) ++index;
    while (end > index && iswspace(value[end - 1])) --end;
    bool negative = false;
    if (index < end && (value[index] == L'+' || value[index] == L'-')) {
        negative = value[index] == L'-';
        ++index;
    }
    if (radix == 16 && index + 1 < end && value[index] == L'0' && (value[index + 1] == L'x' || value[index + 1] == L'X')) index += 2;
    unsigned long long accumulated = 0;
    bool any = false;
    for (; index < end; ++index) {
        const wchar_t ch = value[index];
        int digit = -1;
        if (ch >= L'0' && ch <= L'9') digit = ch - L'0';
        else if (radix == 16 && ch >= L'a' && ch <= L'f') digit = ch - L'a' + 10;
        else if (radix == 16 && ch >= L'A' && ch <= L'F') digit = ch - L'A' + 10;
        if (digit < 0 || digit >= radix) return false;
        accumulated = (accumulated * static_cast<unsigned long long>(radix) + static_cast<unsigned long long>(digit)) & 0xFFFFFFFFULL;
        any = true;
    }
    if (!any) return false;
    const int signedValue = static_cast<int>(static_cast<unsigned int>(accumulated));
    out = negative ? -signedValue : signedValue;
    return true;
}

int 数值_十六进制解析(const wchar_t* text) { int out = 0; LB_ParseRadixText(text, 16, out); return out; }
int 数值_八进制解析(const wchar_t* text) { int out = 0; LB_ParseRadixText(text, 8, out); return out; }
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
static std::mt19937& LB_MathRandomEngine() {
    static thread_local std::mt19937 engine(std::random_device{}());
    return engine;
}

double 数学_绝对值(double value) { return std::fabs(value); }
double 数学_最小值(double first, double second) { return (std::min)(first, second); }
double 数学_最大值(double first, double second) { return (std::max)(first, second); }
double 数学_限制范围(double value, double minimum, double maximum) { if (minimum > maximum) std::swap(minimum, maximum); return (std::max)(minimum, (std::min)(value, maximum)); }
double 数学_平方根(double value) { return value < 0 ? 0 : std::sqrt(value); }
double 数学_乘方(double base, double exponent) { return std::pow(base, exponent); }
int 数学_随机整数(int minimum, int maximum) {
    if (minimum > maximum) std::swap(minimum, maximum);
    return std::uniform_int_distribution<int>(minimum, maximum)(LB_MathRandomEngine());
}
void 数学_置随机种子(int seed) {
    if (seed < 0) {
        LB_MathRandomEngine().seed(static_cast<unsigned int>(std::chrono::steady_clock::now().time_since_epoch().count()));
    } else {
        LB_MathRandomEngine().seed(static_cast<unsigned int>(seed));
    }
}

int 数学_取整(double value) { return static_cast<int>(std::floor(value)); }
int 数学_绝对取整(double value) { return static_cast<int>(std::trunc(value)); }
double 数学_四舍五入(double value, int digits) {
    const double scale = std::pow(10.0, static_cast<double>(digits));
    if (!(scale > 0.0) || !std::isfinite(scale)) return value;
    const double scaled = value * scale;
    if (!std::isfinite(scaled)) return value;
    // 容忍二进制表示误差（例如 1056.65 实际存储为 1056.6499…），保证四舍五入口径稳定。
    const double tolerance = std::fabs(scaled) * 1e-12 + 1e-12;
    const double rounded = scaled >= 0 ? std::floor(scaled + 0.5 + tolerance) : std::ceil(scaled - 0.5 - tolerance);
    const double result = rounded / scale;
    const double snapped = std::round(result);
    return std::fabs(result - snapped) <= std::fabs(result) * 1e-9 + 1e-9 ? snapped : result;
}
int 数学_取符号(double value) { return value > 0 ? 1 : value < 0 ? -1 : 0; }
double 数学_正弦(double angle) { return std::sin(angle); }
double 数学_余弦(double angle) { return std::cos(angle); }
double 数学_正切(double angle) { return std::tan(angle); }
double 数学_反正切(double value) { return std::atan(value); }
double 数学_自然对数(double value) { return value > 0 ? std::log(value) : 0; }
double 数学_反对数(double value) {
    if (!std::isfinite(value)) return 0;
    const double result = std::exp(value);
    return std::isfinite(result) ? result : 0;
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

// 日期时间族：long long 按位打包本地年月日时分秒（year<<26 | month<<22 | day<<17 | hour<<12 | minute<<6 | second），
// 0 表示无效时间。增减与间隔基于公历日数换算，年份支持 1～9999，与易语言“自动靠拢最近有效时间”的口径一致。
const DATETIME_FIELDS_RUNTIME = String.raw`
struct LB_DateTimeFields {
    int year;
    int month;
    int day;
    int hour;
    int minute;
    int second;
};

static LB_DateTimeFields LB_MakeDateTimeFields(int year, int month, int day, int hour, int minute, int second) {
    LB_DateTimeFields fields = { year, month, day, hour, minute, second };
    return fields;
}

static int LB_DaysInMonth(int year, int month) {
    static const int days[12] = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
    if (month < 1 || month > 12) return 0;
    const bool leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    if (month == 2 && leap) return 29;
    return days[month - 1];
}

static bool LB_DateTimeFieldsValid(const LB_DateTimeFields& f) {
    return f.year >= 1 && f.year <= 9999 && f.month >= 1 && f.month <= 12 && f.day >= 1
        && f.day <= LB_DaysInMonth(f.year, f.month) && f.hour >= 0 && f.hour <= 23
        && f.minute >= 0 && f.minute <= 59 && f.second >= 0 && f.second <= 59;
}

static long long LB_PackDateTime(const LB_DateTimeFields& f) {
    if (!LB_DateTimeFieldsValid(f)) return 0;
    return (static_cast<long long>(f.year) << 26) | (static_cast<long long>(f.month) << 22)
        | (static_cast<long long>(f.day) << 17) | (static_cast<long long>(f.hour) << 12)
        | (static_cast<long long>(f.minute) << 6) | static_cast<long long>(f.second);
}

static LB_DateTimeFields LB_UnpackDateTime(long long value) {
    return LB_MakeDateTimeFields(
        static_cast<int>((static_cast<unsigned long long>(value) >> 26) & 0x3FFFFFFULL),
        static_cast<int>((static_cast<unsigned long long>(value) >> 22) & 0xFULL),
        static_cast<int>((static_cast<unsigned long long>(value) >> 17) & 0x1FULL),
        static_cast<int>((static_cast<unsigned long long>(value) >> 12) & 0x1FULL),
        static_cast<int>((static_cast<unsigned long long>(value) >> 6) & 0x3FULL),
        static_cast<int>(static_cast<unsigned long long>(value) & 0x3FULL));
}

// Howard Hinnant 的 civil_from_days / days_from_civil：公历日数换算，负年份同样正确。
static long long LB_CivilDaysFrom(int year, unsigned month, unsigned day) {
    year -= month <= 2;
    const long long era = (year >= 0 ? year : year - 399) / 400;
    const unsigned yearOfEra = static_cast<unsigned>(year - era * 400);
    const unsigned dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    const unsigned dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097 + static_cast<long long>(dayOfEra) - 719468;
}

static void LB_CivilFromDays(long long days, int& year, int& month, int& day) {
    days += 719468;
    const long long era = (days >= 0 ? days : days - 146096) / 146097;
    const unsigned dayOfEra = static_cast<unsigned>(days - era * 146097);
    const unsigned yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365;
    const long long y = static_cast<long long>(yearOfEra) + era * 400;
    const unsigned dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100);
    const unsigned mp = (5 * dayOfYear + 2) / 153;
    day = static_cast<int>(dayOfYear - (153 * mp + 2) / 5 + 1);
    month = static_cast<int>(mp + (mp < 10 ? 3 : -9));
    year = static_cast<int>(y + (month <= 2));
}

static long long LB_DateTimeTotalSeconds(const LB_DateTimeFields& f) {
    return LB_CivilDaysFrom(f.year, static_cast<unsigned>(f.month), static_cast<unsigned>(f.day)) * 86400LL
        + f.hour * 3600LL + f.minute * 60LL + f.second;
}

static long long LB_ClampDateTimeTotal(long long total) {
    const long long minimum = LB_DateTimeTotalSeconds(LB_MakeDateTimeFields(1, 1, 1, 0, 0, 0));
    const long long maximum = LB_DateTimeTotalSeconds(LB_MakeDateTimeFields(9999, 12, 31, 23, 59, 59));
    return (std::min)(maximum, (std::max)(minimum, total));
}

static long long LB_DateTimeAddSeconds(long long value, long long delta) {
    const LB_DateTimeFields base = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(base)) return 0;
    const long long total = LB_ClampDateTimeTotal(LB_DateTimeTotalSeconds(base) + delta);
    const long long days = total >= 0 ? total / 86400 : (total - 86399) / 86400;
    long long remainder = total - days * 86400;
    int year = 0, month = 0, day = 0;
    LB_CivilFromDays(days, year, month, day);
    const int hour = static_cast<int>(remainder / 3600);
    remainder %= 3600;
    return LB_PackDateTime(LB_MakeDateTimeFields(year, month, day, hour, static_cast<int>(remainder / 60), static_cast<int>(remainder % 60)));
}

// 月内序比较：同“几日几时几分几秒”的先后，用于年/季/月完整单位数的靠整修正。
static int LB_DateTimeWithinMonthCompare(const LB_DateTimeFields& a, const LB_DateTimeFields& b) {
    if (a.day != b.day) return a.day < b.day ? -1 : 1;
    if (a.hour != b.hour) return a.hour < b.hour ? -1 : 1;
    if (a.minute != b.minute) return a.minute < b.minute ? -1 : 1;
    if (a.second != b.second) return a.second < b.second ? -1 : 1;
    return 0;
}

static long long LB_DateTimeFullMonths(const LB_DateTimeFields& a, const LB_DateTimeFields& b) {
    long long months = static_cast<long long>(a.year) * 12 + (a.month - 1) - (static_cast<long long>(b.year) * 12 + (b.month - 1));
    if (months > 0 && LB_DateTimeWithinMonthCompare(a, b) < 0) --months;
    else if (months < 0 && LB_DateTimeWithinMonthCompare(a, b) > 0) ++months;
    return months;
}
`;

const DATETIME_COMMAND_RUNTIME = String.raw`
long long 时间_取现行() {
    SYSTEMTIME now = {};
    GetLocalTime(&now);
    return LB_PackDateTime(LB_MakeDateTimeFields(now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond));
}

bool 时间_置现行(long long value) {
    const LB_DateTimeFields fields = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(fields)) return false;
    SYSTEMTIME next = {};
    next.wYear = static_cast<WORD>(fields.year);
    next.wMonth = static_cast<WORD>(fields.month);
    next.wDay = static_cast<WORD>(fields.day);
    next.wHour = static_cast<WORD>(fields.hour);
    next.wMinute = static_cast<WORD>(fields.minute);
    next.wSecond = static_cast<WORD>(fields.second);
    return SetLocalTime(&next) != 0;
}

long long 时间_从文本(const wchar_t* text) {
    const std::wstring value = LB_Wide(text);
    std::vector<std::wstring> tokens;
    std::wstring current;
    for (wchar_t ch : value) {
        if (ch >= L'0' && ch <= L'9') {
            current.push_back(ch);
        } else if (!current.empty()) {
            tokens.push_back(std::move(current));
            current.clear();
        }
    }
    if (!current.empty()) tokens.push_back(std::move(current));
    LB_DateTimeFields fields = LB_MakeDateTimeFields(0, 0, 0, 0, 0, 0);
    if (tokens.size() == 1) {
        const std::wstring& token = tokens[0];
        if (token.size() == 8) {
            fields.year = _wtoi(token.substr(0, 4).c_str());
            fields.month = _wtoi(token.substr(4, 2).c_str());
            fields.day = _wtoi(token.substr(6, 2).c_str());
        } else if (token.size() == 14) {
            fields.year = _wtoi(token.substr(0, 4).c_str());
            fields.month = _wtoi(token.substr(4, 2).c_str());
            fields.day = _wtoi(token.substr(6, 2).c_str());
            fields.hour = _wtoi(token.substr(8, 2).c_str());
            fields.minute = _wtoi(token.substr(10, 2).c_str());
            fields.second = _wtoi(token.substr(12, 2).c_str());
        } else {
            return 0;
        }
    } else if (tokens.size() >= 3 && tokens.size() <= 6) {
        fields.year = _wtoi(tokens[0].c_str());
        fields.month = _wtoi(tokens[1].c_str());
        fields.day = _wtoi(tokens[2].c_str());
        if (tokens.size() >= 4) fields.hour = _wtoi(tokens[3].c_str());
        if (tokens.size() >= 5) fields.minute = _wtoi(tokens[4].c_str());
        if (tokens.size() >= 6) fields.second = _wtoi(tokens[5].c_str());
    } else {
        return 0;
    }
    return LB_PackDateTime(fields);
}

const wchar_t* 时间_到文本(long long value, int part) {
    const LB_DateTimeFields fields = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(fields)) return LB_ReturnText(L"");
    wchar_t buffer[64] = {};
    if (part == 1) swprintf(buffer, 64, L"%04d年%02d月%02d日", fields.year, fields.month, fields.day);
    else if (part == 2) swprintf(buffer, 64, L"%02d时%02d分%02d秒", fields.hour, fields.minute, fields.second);
    else swprintf(buffer, 64, L"%04d年%02d月%02d日%02d时%02d分%02d秒", fields.year, fields.month, fields.day, fields.hour, fields.minute, fields.second);
    return LB_ReturnText(buffer);
}

long long 时间_指定(int year, int month, int day, int hour, int minute, int second) {
    if (year < 1) year = 1;
    if (year > 9999) year = 9999;
    month = (std::max)(1, (std::min)(12, month));
    day = (std::max)(1, (std::min)(LB_DaysInMonth(year, month), day));
    hour = (std::max)(0, (std::min)(23, hour));
    minute = (std::max)(0, (std::min)(59, minute));
    second = (std::max)(0, (std::min)(59, second));
    return LB_PackDateTime(LB_MakeDateTimeFields(year, month, day, hour, minute, second));
}

int 时间_取年份(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.year : 0; }
int 时间_取月份(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.month : 0; }
int 时间_取日(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.day : 0; }
int 时间_取星期几(long long value) {
    const LB_DateTimeFields f = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(f)) return 0;
    // 1970-01-01 是星期四；易语言口径星期日=1，故 +4 后对 7 取余再加 1。
    const long long weekday = ((LB_CivilDaysFrom(f.year, static_cast<unsigned>(f.month), static_cast<unsigned>(f.day)) % 7) + 7 + 4) % 7;
    return static_cast<int>(weekday) + 1;
}
int 时间_取小时(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.hour : 0; }
int 时间_取分钟(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.minute : 0; }
int 时间_取秒(long long value) { const LB_DateTimeFields f = LB_UnpackDateTime(value); return LB_DateTimeFieldsValid(f) ? f.second : 0; }

long long 时间_增减(long long value, int part, int amount) {
    const LB_DateTimeFields base = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(base)) return 0;
    switch (part) {
        case 4: return LB_DateTimeAddSeconds(value, static_cast<long long>(amount) * 7 * 86400LL);
        case 5: return LB_DateTimeAddSeconds(value, static_cast<long long>(amount) * 86400LL);
        case 6: return LB_DateTimeAddSeconds(value, static_cast<long long>(amount) * 3600LL);
        case 7: return LB_DateTimeAddSeconds(value, static_cast<long long>(amount) * 60LL);
        case 8: return LB_DateTimeAddSeconds(value, static_cast<long long>(amount));
        case 1: case 2: case 3: break;
        default: return 0;
    }
    const int step = part == 1 ? 12 : part == 2 ? 3 : 1;
    long long totalMonths = static_cast<long long>(base.year) * 12 + (base.month - 1) + static_cast<long long>(amount) * step;
    totalMonths = (std::max)(0LL, (std::min)(9999LL * 12 + 11, totalMonths));
    int year = static_cast<int>(totalMonths / 12);
    int month = static_cast<int>(totalMonths % 12) + 1;
    const int day = (std::min)(base.day, LB_DaysInMonth(year, month));
    return LB_PackDateTime(LB_MakeDateTimeFields(year, month, day, base.hour, base.minute, base.second));
}

double 时间_取间隔(long long first, long long second, int unit) {
    const LB_DateTimeFields a = LB_UnpackDateTime(first);
    const LB_DateTimeFields b = LB_UnpackDateTime(second);
    if (!LB_DateTimeFieldsValid(a) || !LB_DateTimeFieldsValid(b)) return 0;
    if (unit == 8) return static_cast<double>(LB_DateTimeTotalSeconds(a) - LB_DateTimeTotalSeconds(b));
    if (unit == 7) return static_cast<double>((LB_DateTimeTotalSeconds(a) - LB_DateTimeTotalSeconds(b)) / 60);
    if (unit == 6) return static_cast<double>((LB_DateTimeTotalSeconds(a) - LB_DateTimeTotalSeconds(b)) / 3600);
    if (unit == 5) return static_cast<double>((LB_DateTimeTotalSeconds(a) - LB_DateTimeTotalSeconds(b)) / 86400);
    if (unit == 4) return static_cast<double>((LB_DateTimeTotalSeconds(a) - LB_DateTimeTotalSeconds(b)) / (7 * 86400));
    if (unit == 1) {
        long long years = a.year - b.year;
        if (years > 0 && LB_DateTimeWithinMonthCompare(a, b) < 0) --years;
        else if (years < 0 && LB_DateTimeWithinMonthCompare(a, b) > 0) ++years;
        return static_cast<double>(years);
    }
    if (unit == 2) return static_cast<double>(LB_DateTimeFullMonths(a, b) / 3);
    if (unit == 3) return static_cast<double>(LB_DateTimeFullMonths(a, b));
    return 0;
}

int 时间_取某月天数(int year, int month) { return LB_DaysInMonth(year, month); }

long long 时间_取日期(long long value) {
    const LB_DateTimeFields f = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(f)) return 0;
    return LB_PackDateTime(LB_MakeDateTimeFields(f.year, f.month, f.day, 0, 0, 0));
}

long long 时间_取时间(long long value) {
    const LB_DateTimeFields f = LB_UnpackDateTime(value);
    if (!LB_DateTimeFieldsValid(f)) return 0;
    return LB_PackDateTime(LB_MakeDateTimeFields(2000, 1, 1, f.hour, f.minute, f.second));
}
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

const wchar_t* 正则_取所有匹配(const wchar_t* text, const wchar_t* pattern, const wchar_t* separator) {
    try {
        const std::wstring value = LB_Wide(text);
        const std::wregex expression(LB_Wide(pattern));
        const std::wstring joiner = LB_Wide(separator);
        std::wstring result; bool first = true;
        for (std::wsregex_iterator it(value.begin(), value.end(), expression), end; it != end; ++it) {
            if (!first) result += joiner;
            result += it->str();
            first = false;
        }
        return LB_ReturnText(std::move(result));
    } catch (const std::regex_error&) { return LB_ReturnText(L""); }
}

const wchar_t* 正则_取第N个匹配(const wchar_t* text, const wchar_t* pattern, int index) {
    try {
        if (index < 0) return LB_ReturnText(L"");
        const std::wstring value = LB_Wide(text);
        const std::wregex expression(LB_Wide(pattern));
        int seen = 0;
        for (std::wsregex_iterator it(value.begin(), value.end(), expression), end; it != end; ++it, ++seen) {
            if (seen == index) return LB_ReturnText(it->str());
        }
        return LB_ReturnText(L"");
    } catch (const std::regex_error&) { return LB_ReturnText(L""); }
}

const wchar_t* 正则_取分组(const wchar_t* text, const wchar_t* pattern, int group) {
    try {
        if (group < 0) return LB_ReturnText(L"");
        const std::wstring value = LB_Wide(text);
        std::wsmatch match;
        if (!std::regex_search(value, match, std::wregex(LB_Wide(pattern)))) return LB_ReturnText(L"");
        if (static_cast<size_t>(group) >= match.size()) return LB_ReturnText(L"");
        return match[group].matched ? LB_ReturnText(match[group].str()) : LB_ReturnText(L"");
    } catch (const std::regex_error&) { return LB_ReturnText(L""); }
}

const wchar_t* 正则_取所有分组(const wchar_t* text, const wchar_t* pattern, int group, const wchar_t* separator) {
    try {
        if (group < 0) return LB_ReturnText(L"");
        const std::wstring value = LB_Wide(text);
        const std::wregex expression(LB_Wide(pattern));
        const std::wstring joiner = LB_Wide(separator);
        std::wstring result; bool first = true;
        for (std::wsregex_iterator it(value.begin(), value.end(), expression), end; it != end; ++it) {
            if (static_cast<size_t>(group) >= it->size() || !(*it)[group].matched) continue;
            if (!first) result += joiner;
            result += (*it)[group].str();
            first = false;
        }
        return LB_ReturnText(std::move(result));
    } catch (const std::regex_error&) { return LB_ReturnText(L""); }
}

int 正则_取匹配位置(const wchar_t* text, const wchar_t* pattern, int index) {
    try {
        if (index < 0) return -1;
        const std::wstring value = LB_Wide(text);
        const std::wregex expression(LB_Wide(pattern));
        int seen = 0;
        for (std::wsregex_iterator it(value.begin(), value.end(), expression), end; it != end; ++it, ++seen) {
            if (seen == index) return static_cast<int>(it->position());
        }
        return -1;
    } catch (const std::regex_error&) { return -1; }
}
`;

const BUFFER_RUNTIME = String.raw`
struct LingBufferBlock {
    std::mutex mutex;
    std::vector<unsigned char> data;
    size_t cursor = 0;
};

static std::mutex g_lbBufferRegistryMutex;
static std::unordered_map<long long, std::shared_ptr<LingBufferBlock>> g_lbBufferRegistry;
static long long g_lbBufferSequence = 0;
static constexpr size_t LB_BUFFER_LIMIT = 268435456;

static std::shared_ptr<LingBufferBlock> LB_FindBuffer(long long id) {
    std::lock_guard<std::mutex> lock(g_lbBufferRegistryMutex);
    auto found = g_lbBufferRegistry.find(id);
    return found == g_lbBufferRegistry.end() ? nullptr : found->second;
}

static long long LB_RegisterBuffer(std::vector<unsigned char>&& initial) {
    auto block = std::make_shared<LingBufferBlock>();
    block->data = std::move(initial);
    std::lock_guard<std::mutex> lock(g_lbBufferRegistryMutex);
    const long long id = ++g_lbBufferSequence;
    g_lbBufferRegistry[id] = std::move(block);
    return id;
}

long long 缓冲区_创建(int initialCapacity) {
    if (initialCapacity < 0) return 0;
    std::vector<unsigned char> initial;
    if (initialCapacity > 0) initial.reserve(static_cast<size_t>((std::min)(initialCapacity, static_cast<int>(LB_BUFFER_LIMIT))));
    return LB_RegisterBuffer(std::move(initial));
}

bool 缓冲区_销毁(long long id) {
    std::lock_guard<std::mutex> lock(g_lbBufferRegistryMutex);
    return g_lbBufferRegistry.erase(id) > 0;
}

long long 缓冲区_取长度(long long id) {
    auto block = LB_FindBuffer(id);
    if (!block) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    return static_cast<long long>(block->data.size());
}

bool 缓冲区_写字节集(long long id, const std::vector<unsigned char>& bytes) {
    auto block = LB_FindBuffer(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    if (bytes.size() > LB_BUFFER_LIMIT - block->data.size()) return false;
    block->data.insert(block->data.end(), bytes.begin(), bytes.end());
    return true;
}

bool 缓冲区_写文本(long long id, const wchar_t* text) {
    const std::string utf8 = LB_WideToUtf8(text);
    return 缓冲区_写字节集(id, std::vector<unsigned char>(utf8.begin(), utf8.end()));
}

bool 缓冲区_写整数(long long id, long long value, int width, bool bigEndian) {
    if (width != 1 && width != 2 && width != 4 && width != 8) return false;
    std::vector<unsigned char> bytes;
    bytes.reserve(static_cast<size_t>(width));
    const unsigned long long raw = static_cast<unsigned long long>(value);
    for (int index = 0; index < width; ++index) {
        const int shift = bigEndian ? (width - 1 - index) * 8 : index * 8;
        bytes.push_back(static_cast<unsigned char>((raw >> shift) & 0xff));
    }
    return 缓冲区_写字节集(id, bytes);
}

std::vector<unsigned char> 缓冲区_读字节集(long long id, int length) {
    auto block = LB_FindBuffer(id);
    if (!block) return {};
    std::lock_guard<std::mutex> lock(block->mutex);
    if (block->cursor > block->data.size()) block->cursor = block->data.size();
    const size_t remaining = block->data.size() - block->cursor;
    const size_t count = length < 0 ? remaining : (std::min)(static_cast<size_t>(length), remaining);
    std::vector<unsigned char> result(block->data.begin() + static_cast<std::ptrdiff_t>(block->cursor), block->data.begin() + static_cast<std::ptrdiff_t>(block->cursor + count));
    block->cursor += count;
    return result;
}

const wchar_t* 缓冲区_读文本(long long id, int length) {
    const std::vector<unsigned char> bytes = 缓冲区_读字节集(id, length);
    const std::string raw(bytes.begin(), bytes.end());
    return LB_ReturnText(LB_Utf8ToWide(raw));
}

long long 缓冲区_读整数(long long id, int width, bool bigEndian) {
    if (width != 1 && width != 2 && width != 4 && width != 8) return 0;
    const std::vector<unsigned char> bytes = 缓冲区_读字节集(id, width);
    if (bytes.size() != static_cast<size_t>(width)) return 0;
    unsigned long long raw = 0;
    if (bigEndian) {
        for (unsigned char byte : bytes) raw = (raw << 8) | byte;
    } else {
        for (size_t index = bytes.size(); index-- > 0;) raw = (raw << 8) | bytes[index];
    }
    return static_cast<long long>(raw);
}

long long 缓冲区_取剩余(long long id) {
    auto block = LB_FindBuffer(id);
    if (!block) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    if (block->cursor > block->data.size()) return 0;
    return static_cast<long long>(block->data.size() - block->cursor);
}

bool 缓冲区_重置读取(long long id) {
    auto block = LB_FindBuffer(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->cursor = 0;
    return true;
}

std::vector<unsigned char> 缓冲区_到字节集(long long id) {
    auto block = LB_FindBuffer(id);
    if (!block) return {};
    std::lock_guard<std::mutex> lock(block->mutex);
    return block->data;
}

long long 缓冲区_从字节集(const std::vector<unsigned char>& bytes) {
    if (bytes.size() > LB_BUFFER_LIMIT) return 0;
    return LB_RegisterBuffer(std::vector<unsigned char>(bytes));
}

bool 缓冲区_清空(long long id) {
    auto block = LB_FindBuffer(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->data.clear();
    block->cursor = 0;
    return true;
}

bool 缓冲区_保存文件(long long id, const wchar_t* path) {
    auto block = LB_FindBuffer(id);
    if (!block || !path || !path[0]) return false;
    std::ofstream file(path, std::ios::binary | std::ios::trunc);
    if (!file.is_open()) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    file.write(reinterpret_cast<const char*>(block->data.data()), static_cast<std::streamsize>(block->data.size()));
    const bool ok = file.good();
    file.close();
    return ok;
}

long long 缓冲区_从文件(const wchar_t* path) {
    if (!path || !path[0]) return 0;
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) return 0;
    std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    if (bytes.size() > LB_BUFFER_LIMIT) return 0;
    return LB_RegisterBuffer(std::move(bytes));
}

long long 缓冲区_寻找(long long id, const std::vector<unsigned char>& target, int start) {
    auto block = LB_FindBuffer(id);
    if (!block || target.empty() || start < 0 || target.size() > block->data.size() || static_cast<size_t>(start) > block->data.size() - target.size()) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    const auto it = std::search(block->data.begin() + static_cast<std::ptrdiff_t>(start), block->data.end(), target.begin(), target.end());
    return it == block->data.end() ? -1 : static_cast<long long>(it - block->data.begin());
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


// ---------- 哈希表与栈运行时 ----------
const MAP_RUNTIME = String.raw`// ---------- 哈希表与栈运行时 ----------
struct LbMapValue {
    int kind = 0; // 0 文本, 1 整数, 2 逻辑, 3 字节集
    std::wstring text;
    long long number = 0;
    bool flag = false;
    std::vector<unsigned char> bytes;
};

struct LingHashMapBlock {
    std::mutex mutex;
    std::unordered_map<std::wstring, LbMapValue> items;
};

struct LingStackBlock {
    std::mutex mutex;
    std::vector<LbMapValue> items;
};

static std::mutex g_lbMapRegistryMutex;
static std::unordered_map<long long, std::shared_ptr<LingHashMapBlock>> g_lbMapRegistry;
static std::unordered_map<long long, std::shared_ptr<LingStackBlock>> g_lbStackRegistry;
static long long g_lbMapSequence = 0;
static thread_local bool g_lbMapLastOpOk = false;
static thread_local bool g_lbStackLastPopOk = false;

static std::shared_ptr<LingHashMapBlock> LB_FindMap(long long id) {
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    auto found = g_lbMapRegistry.find(id);
    return found == g_lbMapRegistry.end() ? nullptr : found->second;
}

static std::shared_ptr<LingStackBlock> LB_FindStack(long long id) {
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    auto found = g_lbStackRegistry.find(id);
    return found == g_lbStackRegistry.end() ? nullptr : found->second;
}

static void LB_MapPut(long long id, const wchar_t* key, LbMapValue value) {
    auto block = LB_FindMap(id);
    if (!block) { g_lbMapLastOpOk = false; return; }
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items[LB_Wide(key)] = std::move(value);
    g_lbMapLastOpOk = true;
}

long long 哈希表_创建(int initialCapacity) {
    if (initialCapacity < 0) return 0;
    auto block = std::make_shared<LingHashMapBlock>();
    block->items.reserve(static_cast<size_t>(initialCapacity));
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    const long long id = ++g_lbMapSequence;
    g_lbMapRegistry[id] = std::move(block);
    return id;
}

bool 哈希表_销毁(long long id) {
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    return g_lbMapRegistry.erase(id) > 0;
}

int 哈希表_取数量(long long id) {
    auto block = LB_FindMap(id);
    if (!block) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    return static_cast<int>(block->items.size());
}

bool 哈希表_是否包含(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    return block->items.count(LB_Wide(key)) > 0;
}

bool 哈希表_删除(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    return block->items.erase(LB_Wide(key)) > 0;
}

bool 哈希表_清空(long long id) {
    auto block = LB_FindMap(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items.clear();
    return true;
}

bool 哈希表_置文本(long long id, const wchar_t* key, const wchar_t* value) {
    LbMapValue v; v.kind = 0; v.text = LB_Wide(value);
    LB_MapPut(id, key, std::move(v));
    return g_lbMapLastOpOk;
}

const wchar_t* 哈希表_取文本(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) { g_lbMapLastOpOk = false; return LB_ReturnText(L""); }
    std::lock_guard<std::mutex> lock(block->mutex);
    auto found = block->items.find(LB_Wide(key));
    if (found == block->items.end() || found->second.kind != 0) { g_lbMapLastOpOk = false; return LB_ReturnText(L""); }
    g_lbMapLastOpOk = true;
    return LB_ReturnText(found->second.text);
}

bool 哈希表_置整数(long long id, const wchar_t* key, long long value) {
    LbMapValue v; v.kind = 1; v.number = value;
    LB_MapPut(id, key, std::move(v));
    return g_lbMapLastOpOk;
}

long long 哈希表_取整数(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) { g_lbMapLastOpOk = false; return 0; }
    std::lock_guard<std::mutex> lock(block->mutex);
    auto found = block->items.find(LB_Wide(key));
    if (found == block->items.end() || found->second.kind != 1) { g_lbMapLastOpOk = false; return 0; }
    g_lbMapLastOpOk = true;
    return found->second.number;
}

bool 哈希表_置逻辑(long long id, const wchar_t* key, bool value) {
    LbMapValue v; v.kind = 2; v.flag = value;
    LB_MapPut(id, key, std::move(v));
    return g_lbMapLastOpOk;
}

bool 哈希表_取逻辑(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) { g_lbMapLastOpOk = false; return false; }
    std::lock_guard<std::mutex> lock(block->mutex);
    auto found = block->items.find(LB_Wide(key));
    if (found == block->items.end() || found->second.kind != 2) { g_lbMapLastOpOk = false; return false; }
    g_lbMapLastOpOk = true;
    return found->second.flag;
}

bool 哈希表_置字节集(long long id, const wchar_t* key, const std::vector<unsigned char>& value) {
    LbMapValue v; v.kind = 3; v.bytes = value;
    LB_MapPut(id, key, std::move(v));
    return g_lbMapLastOpOk;
}

std::vector<unsigned char> 哈希表_取字节集(long long id, const wchar_t* key) {
    auto block = LB_FindMap(id);
    if (!block) { g_lbMapLastOpOk = false; return {}; }
    std::lock_guard<std::mutex> lock(block->mutex);
    auto found = block->items.find(LB_Wide(key));
    if (found == block->items.end() || found->second.kind != 3) { g_lbMapLastOpOk = false; return {}; }
    g_lbMapLastOpOk = true;
    return found->second.bytes;
}

int 哈希表_取全部键(long long id, std::vector<std::wstring>& out) {
    out.clear();
    auto block = LB_FindMap(id);
    if (!block) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    for (const auto& entry : block->items) out.push_back(entry.first);
    return static_cast<int>(out.size());
}

bool 哈希表_上次操作是否成功() { return g_lbMapLastOpOk; }

long long 栈_创建(int initialCapacity) {
    if (initialCapacity < 0) return 0;
    auto block = std::make_shared<LingStackBlock>();
    block->items.reserve(static_cast<size_t>(initialCapacity));
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    const long long id = ++g_lbMapSequence;
    g_lbStackRegistry[id] = std::move(block);
    return id;
}

bool 栈_销毁(long long id) {
    std::lock_guard<std::mutex> lock(g_lbMapRegistryMutex);
    return g_lbStackRegistry.erase(id) > 0;
}

int 栈_取数量(long long id) {
    auto block = LB_FindStack(id);
    if (!block) return -1;
    std::lock_guard<std::mutex> lock(block->mutex);
    return static_cast<int>(block->items.size());
}

bool 栈_是否为空(long long id) {
    auto block = LB_FindStack(id);
    if (!block) return true;
    std::lock_guard<std::mutex> lock(block->mutex);
    return block->items.empty();
}

bool 栈_清空(long long id) {
    auto block = LB_FindStack(id);
    if (!block) return false;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items.clear();
    return true;
}

bool 栈_压入(long long id, const wchar_t* value) {
    auto block = LB_FindStack(id);
    if (!block) return false;
    LbMapValue v; v.kind = 0; v.text = LB_Wide(value);
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items.push_back(std::move(v));
    return true;
}

const wchar_t* 栈_弹出(long long id) {
    auto block = LB_FindStack(id);
    if (!block) { g_lbStackLastPopOk = false; return LB_ReturnText(L""); }
    std::lock_guard<std::mutex> lock(block->mutex);
    if (block->items.empty() || block->items.back().kind != 0) { g_lbStackLastPopOk = false; return LB_ReturnText(L""); }
    std::wstring result = std::move(block->items.back().text);
    g_lbStackLastPopOk = true;
    block->items.pop_back();
    return LB_ReturnText(std::move(result));
}

bool 栈_压入整数(long long id, long long value) {
    auto block = LB_FindStack(id);
    if (!block) return false;
    LbMapValue v; v.kind = 1; v.number = value;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items.push_back(std::move(v));
    return true;
}

long long 栈_弹出整数(long long id) {
    auto block = LB_FindStack(id);
    if (!block) { g_lbStackLastPopOk = false; return 0; }
    std::lock_guard<std::mutex> lock(block->mutex);
    if (block->items.empty() || block->items.back().kind != 1) { g_lbStackLastPopOk = false; return 0; }
    const long long result = block->items.back().number;
    g_lbStackLastPopOk = true;
    block->items.pop_back();
    return result;
}

bool 栈_压入字节集(long long id, const std::vector<unsigned char>& value) {
    auto block = LB_FindStack(id);
    if (!block) return false;
    LbMapValue v; v.kind = 3; v.bytes = value;
    std::lock_guard<std::mutex> lock(block->mutex);
    block->items.push_back(std::move(v));
    return true;
}

std::vector<unsigned char> 栈_弹出字节集(long long id) {
    auto block = LB_FindStack(id);
    if (!block) { g_lbStackLastPopOk = false; return {}; }
    std::lock_guard<std::mutex> lock(block->mutex);
    if (block->items.empty() || block->items.back().kind != 3) { g_lbStackLastPopOk = false; return {}; }
    std::vector<unsigned char> result = std::move(block->items.back().bytes);
    g_lbStackLastPopOk = true;
    block->items.pop_back();
    return result;
}

bool 栈_上次弹出是否成功() { return g_lbStackLastPopOk; }
`;

const BIGINT_RUNTIME = String.raw`
// ---------- 大数运算运行时 ----------
struct LbBigValue {
    bool neg = false;                       // 负号；零规定为非负
    std::vector<unsigned int> mag;          // 十亿进制（base 1e9）低位在前
};

static std::mutex g_lbBigRegistryMutex;
static std::unordered_map<long long, std::shared_ptr<LbBigValue>> g_lbBigRegistry;
static long long g_lbBigSequence = 0;

static std::shared_ptr<LbBigValue> LB_FindBig(long long id) {
    std::lock_guard<std::mutex> lock(g_lbBigRegistryMutex);
    auto found = g_lbBigRegistry.find(id);
    return found == g_lbBigRegistry.end() ? nullptr : found->second;
}

static long long LB_RegisterBig(LbBigValue value) {
    auto block = std::make_shared<LbBigValue>(std::move(value));
    std::lock_guard<std::mutex> lock(g_lbBigRegistryMutex);
    const long long id = ++g_lbBigSequence;
    g_lbBigRegistry[id] = std::move(block);
    return id;
}

static void LB_BigTrim(LbBigValue& v) {
    while (!v.mag.empty() && v.mag.back() == 0) v.mag.pop_back();
    if (v.mag.empty()) v.neg = false;
}

static int LB_BigCompareMag(const LbBigValue& a, const LbBigValue& b) {
    if (a.mag.size() != b.mag.size()) return a.mag.size() < b.mag.size() ? -1 : 1;
    for (size_t i = a.mag.size(); i-- > 0;) {
        if (a.mag[i] != b.mag[i]) return a.mag[i] < b.mag[i] ? -1 : 1;
    }
    return 0;
}

static LbBigValue LB_BigAddMag(const LbBigValue& a, const LbBigValue& b) {
    LbBigValue out;
    out.mag.reserve((std::max)(a.mag.size(), b.mag.size()) + 1);
    unsigned long long carry = 0;
    const size_t n = (std::max)(a.mag.size(), b.mag.size());
    for (size_t i = 0; i < n; ++i) {
        unsigned long long sum = carry;
        if (i < a.mag.size()) sum += a.mag[i];
        if (i < b.mag.size()) sum += b.mag[i];
        out.mag.push_back(static_cast<unsigned int>(sum % 1000000000ULL));
        carry = sum / 1000000000ULL;
    }
    if (carry) out.mag.push_back(static_cast<unsigned int>(carry));
    return out;
}

// 要求 |a| >= |b|
static LbBigValue LB_BigSubMag(const LbBigValue& a, const LbBigValue& b) {
    LbBigValue out;
    out.mag.reserve(a.mag.size());
    long long borrow = 0;
    for (size_t i = 0; i < a.mag.size(); ++i) {
        long long cur = static_cast<long long>(a.mag[i]) - borrow - (i < b.mag.size() ? b.mag[i] : 0);
        if (cur < 0) { cur += 1000000000LL; borrow = 1; } else borrow = 0;
        out.mag.push_back(static_cast<unsigned int>(cur));
    }
    LB_BigTrim(out);
    return out;
}

// 加减统一入口：结果符号按有符号运算规则
static LbBigValue LB_BigAddSub(const LbBigValue& a, const LbBigValue& b, bool subtract) {
    LbBigValue out;
    const bool bNeg = b.neg ^ subtract;
    if (a.neg == bNeg) {
        out = LB_BigAddMag(a, b);
        out.neg = a.neg;
    } else {
        const int cmp = LB_BigCompareMag(a, b);
        if (cmp == 0) return out;
        if (cmp > 0) { out = LB_BigSubMag(a, b); out.neg = a.neg; }
        else { out = LB_BigSubMag(b, a); out.neg = bNeg; }
    }
    LB_BigTrim(out);
    return out;
}

static LbBigValue LB_BigMul(const LbBigValue& a, const LbBigValue& b) {
    LbBigValue out;
    if (a.mag.empty() || b.mag.empty()) return out;
    out.mag.assign(a.mag.size() + b.mag.size(), 0);
    for (size_t i = 0; i < a.mag.size(); ++i) {
        unsigned long long carry = 0;
        for (size_t j = 0; j < b.mag.size() || carry; ++j) {
            unsigned long long cur = out.mag[i + j] + carry;
            if (j < b.mag.size()) cur += static_cast<unsigned long long>(a.mag[i]) * b.mag[j];
            out.mag[i + j] = static_cast<unsigned int>(cur % 1000000000ULL);
            carry = cur / 1000000000ULL;
        }
    }
    out.neg = a.neg != b.neg;
    LB_BigTrim(out);
    return out;
}

// 乘以单个 limb（标量 < 1e9）；u64 累加安全（< 1e18 + 1e9）
static LbBigValue LB_BigMulSmall(const LbBigValue& v, unsigned int scalar) {
    LbBigValue out;
    if (scalar == 0 || v.mag.empty()) return out;
    out.mag.reserve(v.mag.size() + 1);
    unsigned long long carry = 0;
    for (size_t i = 0; i < v.mag.size(); ++i) {
        const unsigned long long cur = static_cast<unsigned long long>(v.mag[i]) * scalar + carry;
        out.mag.push_back(static_cast<unsigned int>(cur % 1000000000ULL));
        carry = cur / 1000000000ULL;
    }
    while (carry) {
        out.mag.push_back(static_cast<unsigned int>(carry % 1000000000ULL));
        carry /= 1000000000ULL;
    }
    return out;
}

// 十进制逐位长除：商向零取整，余数符号随被除数；除数为 0 返回 false。
// 每一步把余数整体乘 1e9 并落下一个十进制位，再用二分试商（u64 乘法有界）。
static bool LB_BigDivMod(const LbBigValue& a, const LbBigValue& b, LbBigValue& q, LbBigValue& r) {
    q = LbBigValue(); r = LbBigValue();
    if (b.mag.empty()) return false;
    q.mag.assign(a.mag.size(), 0);
    for (size_t i = a.mag.size(); i-- > 0;) {
        if (r.mag.empty()) r.mag.push_back(0);
        r.mag.insert(r.mag.begin(), a.mag[i]);
        LB_BigTrim(r);
        unsigned int low = 0, high = 999999999u;
        while (low < high) {
            const unsigned int mid = low + (high - low + 1) / 2;
            if (LB_BigCompareMag(LB_BigMulSmall(b, mid), r) <= 0) low = mid; else high = mid - 1;
        }
        q.mag[i] = low;
        if (low) r = LB_BigSubMag(r, LB_BigMulSmall(b, low));
    }
    q.neg = a.neg != b.neg; LB_BigTrim(q);
    r.neg = a.neg; LB_BigTrim(r);
    return true;
}

const wchar_t* 大数_到文本(long long id) {
    auto v = LB_FindBig(id);
    if (!v) return LB_ReturnText(L"");
    if (v->mag.empty()) return LB_ReturnText(L"0");
    std::wstring out;
    if (v->neg) out += L'-';
    unsigned int top = v->mag.back();
    wchar_t buffer[12];
    int n = 0;
    do { buffer[n++] = static_cast<wchar_t>(L'0' + top % 10); top /= 10; } while (top);
    while (n) out += buffer[--n];
    for (size_t i = v->mag.size() - 1; i-- > 0;) {
        unsigned int limb = v->mag[i];
        wchar_t chunk[9];
        for (int d = 8; d >= 0; --d) { chunk[d] = static_cast<wchar_t>(L'0' + limb % 10); limb /= 10; }
        out.append(chunk, 9);
    }
    return LB_ReturnText(std::move(out));
}

long long 大数_创建(const wchar_t* text) {
    std::wstring value = LB_Wide(text);
    const size_t start = value.find_first_not_of(L" \t\r\n");
    if (start == std::wstring::npos) return LB_RegisterBig(LbBigValue());
    const size_t finish = value.find_last_not_of(L" \t\r\n");
    value = value.substr(start, finish - start + 1);
    LbBigValue v;
    if (value[0] == L'-' || value[0] == L'+') { v.neg = value[0] == L'-'; value.erase(0, 1); }
    if (value.empty()) return 0;
    std::vector<unsigned int> limbs;
    for (size_t pos = value.size(); pos > 0;) {
        const size_t take = (std::min)(static_cast<size_t>(9), pos);
        const std::wstring chunk = value.substr(pos - take, take);
        unsigned int limb = 0;
        for (wchar_t ch : chunk) {
            if (ch < L'0' || ch > L'9') return 0;
            limb = limb * 10 + static_cast<unsigned int>(ch - L'0');
        }
        limbs.push_back(limb);
        pos -= take;
    }
    v.mag = std::move(limbs);
    LB_BigTrim(v);
    return LB_RegisterBig(std::move(v));
}

long long 大数_从整数(long long value) {
    LbBigValue v;
    if (value < 0) v.neg = true;
    unsigned long long magnitude = value < 0
        ? static_cast<unsigned long long>(-(value + 1)) + 1
        : static_cast<unsigned long long>(value);
    while (magnitude) {
        v.mag.push_back(static_cast<unsigned int>(magnitude % 1000000000ULL));
        magnitude /= 1000000000ULL;
    }
    return LB_RegisterBig(std::move(v));
}

bool 大数_销毁(long long id) {
    std::lock_guard<std::mutex> lock(g_lbBigRegistryMutex);
    return g_lbBigRegistry.erase(id) > 0;
}

long long 大数_加(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return 0;
    return LB_RegisterBig(LB_BigAddSub(*left, *right, false));
}

long long 大数_减(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return 0;
    return LB_RegisterBig(LB_BigAddSub(*left, *right, true));
}

long long 大数_乘(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return 0;
    return LB_RegisterBig(LB_BigMul(*left, *right));
}

long long 大数_除(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return 0;
    LbBigValue q, r;
    if (!LB_BigDivMod(*left, *right, q, r)) return 0;
    return LB_RegisterBig(std::move(q));
}

long long 大数_求余(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return 0;
    LbBigValue q, r;
    if (!LB_BigDivMod(*left, *right, q, r)) return 0;
    return LB_RegisterBig(std::move(r));
}

int 大数_取符号(long long id) {
    auto v = LB_FindBig(id);
    if (!v) return -2;
    if (v->mag.empty()) return 0;
    return v->neg ? -1 : 1;
}

static int 大数_比较(long long a, long long b) {
    auto left = LB_FindBig(a), right = LB_FindBig(b);
    if (!left || !right) return -2;
    const int av = left->mag.empty() ? 0 : (left->neg ? -1 : 1);
    const int bv = right->mag.empty() ? 0 : (right->neg ? -1 : 1);
    if (av != bv) return av < bv ? -1 : 1;
    if (av == 0) return 0;
    const int cmp = LB_BigCompareMag(*left, *right);
    return left->neg ? -cmp : cmp;
}

bool 大数_是否等于(long long a, long long b) { return 大数_比较(a, b) == 0; }
bool 大数_是否大于(long long a, long long b) { return 大数_比较(a, b) > 0; }
bool 大数_是否小于(long long a, long long b) { return 大数_比较(a, b) < 0; }
bool 大数_是否大于等于(long long a, long long b) { return 大数_比较(a, b) >= 0; }
bool 大数_是否小于等于(long long a, long long b) { return 大数_比较(a, b) <= 0; }
`;

// ---------- 拼音处理运行时 ----------
const PINYIN_RUNTIME = String.raw`${LB_PINYIN_TABLE_CPP}

static const wchar_t* const LB_PinyinInitialTable[] = {
    L"zh", L"ch", L"sh", L"b", L"p", L"m", L"f", L"d", L"t", L"n",
    L"l", L"g", L"k", L"h", L"j", L"q", L"x", L"r", L"y", L"w"
};

// 取音节的声母长度：zh/ch/sh 为 2，其余单声母为 1，无声母为 0
static int LB_PinyinInitialLength(const std::wstring& syllable) {
    if (syllable.size() >= 2) {
        const wchar_t c0 = syllable[0], c1 = syllable[1];
        if ((c0 == L'z' || c0 == L'c' || c0 == L's') && c1 == L'h') return 2;
    }
    if (syllable.empty()) return 0;
    const wchar_t c0 = syllable[0];
    static const wchar_t singles[] = L"bpmfdtnlgkhjqxywr";
    for (const wchar_t* p = singles; *p; ++p) {
        if (c0 == *p) return 1;
    }
    return 0;
}

static std::vector<int> LB_PinyinReadings(wchar_t ch) {
    std::vector<int> readings;
    const int row = LB_PinyinFindChar(ch);
    if (row < 0) return readings;
    const unsigned short offset = g_lbPinyinOffsets[row];
    const unsigned short count = g_lbPinyinLists[offset];
    for (int i = 0; i < count; ++i) readings.push_back(g_lbPinyinLists[offset + 1 + i]);
    return readings;
}

static std::wstring LB_PinyinJoinReadings(const std::wstring& text, const std::wstring& separator, bool initialsOnly) {
    std::wstring out;
    bool lastWasReading = false;
    for (wchar_t ch : text) {
        const std::vector<int> readings = LB_PinyinReadings(ch);
        if (readings.empty()) {
            out += ch;
            lastWasReading = false;
            continue;
        }
        if (lastWasReading && !separator.empty()) out += separator;
        const std::wstring syllable = g_lbPinyinSyllables[readings.front()];
        if (initialsOnly) {
            out += syllable[0];
        } else {
            out += syllable;
        }
        lastWasReading = true;
    }
    return out;
}

const wchar_t* 拼音_取全拼(const wchar_t* text, const wchar_t* separator) {
    return LB_ReturnText(LB_PinyinJoinReadings(LB_Wide(text), LB_Wide(separator), false));
}

const wchar_t* 拼音_取首字母(const wchar_t* text) {
    return LB_ReturnText(LB_PinyinJoinReadings(LB_Wide(text), L"", true));
}

int 拼音_取所有发音(const wchar_t* hanzi, std::vector<std::wstring>& out) {
    out.clear();
    const std::wstring value = LB_Wide(hanzi);
    if (value.empty()) return 0;
    for (wchar_t ch : value) {
        for (int index : LB_PinyinReadings(ch)) {
            out.push_back(g_lbPinyinSyllables[index]);
        }
        if (!out.empty()) break;
    }
    return static_cast<int>(out.size());
}

int 拼音_取发音数目(const wchar_t* hanzi) {
    const std::wstring value = LB_Wide(hanzi);
    for (wchar_t ch : value) {
        const std::vector<int> readings = LB_PinyinReadings(ch);
        if (!readings.empty()) return static_cast<int>(readings.size());
    }
    return 0;
}

const wchar_t* 拼音_取声母(const wchar_t* text) {
    std::wstring out;
    for (wchar_t ch : LB_Wide(text)) {
        const std::vector<int> readings = LB_PinyinReadings(ch);
        if (readings.empty()) { out += ch; continue; }
        const std::wstring syllable = g_lbPinyinSyllables[readings.front()];
        const int length = LB_PinyinInitialLength(syllable);
        if (length > 0) out.append(syllable, 0, static_cast<size_t>(length));
    }
    return LB_ReturnText(std::move(out));
}

const wchar_t* 拼音_取韵母(const wchar_t* text) {
    std::wstring out;
    for (wchar_t ch : LB_Wide(text)) {
        const std::vector<int> readings = LB_PinyinReadings(ch);
        if (readings.empty()) { out += ch; continue; }
        const std::wstring syllable = g_lbPinyinSyllables[readings.front()];
        const int length = LB_PinyinInitialLength(syllable);
        out.append(syllable, static_cast<size_t>(length), syllable.size() - static_cast<size_t>(length));
    }
    return LB_ReturnText(std::move(out));
}

int 拼音_发音比较(const wchar_t* first, const wchar_t* second) {
    auto readFirst = [](wchar_t ch) -> std::wstring {
        const std::vector<int> readings = LB_PinyinReadings(ch);
        return readings.empty() ? std::wstring() : g_lbPinyinSyllables[readings.front()];
    };
    const std::wstring left = LB_Wide(first), right = LB_Wide(second);
    const std::wstring a = left.empty() ? std::wstring() : readFirst(left[0]);
    const std::wstring b = right.empty() ? std::wstring() : readFirst(right[0]);
    const int cmp = a.compare(b);
    return cmp < 0 ? -1 : (cmp > 0 ? 1 : 0);
}

bool 拼音_首字母匹配(const wchar_t* text, const wchar_t* sequence) {
    std::wstring initials = LB_PinyinJoinReadings(LB_Wide(text), L"", true);
    std::wstring needle = LB_Wide(sequence);
    for (wchar_t& ch : initials) if (ch >= L'A' && ch <= L'Z') ch = static_cast<wchar_t>(ch - L'A' + L'a');
    for (wchar_t& ch : needle) if (ch >= L'A' && ch <= L'Z') ch = static_cast<wchar_t>(ch - L'A' + L'a');
    if (needle.empty()) return true;
    if (initials.size() < needle.size()) return false;
    return initials.compare(0, needle.size(), needle) == 0;
}
`;

// ---------- 农历日期运行时 ----------
const LUNAR_RUNTIME = String.raw`${LB_LUNAR_TABLE_CPP}

// 与 日期时间模块 相同的 64 位打包布局：year<<26 | month<<22 | day<<17 | hour<<12 | minute<<6 | second
static long long LB_LunarPackDateTime(int year, int month, int day, int hour, int minute, int second) {
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31
        || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return 0;
    return (static_cast<long long>(year) << 26) | (static_cast<long long>(month) << 22)
        | (static_cast<long long>(day) << 17) | (static_cast<long long>(hour) << 12)
        | (static_cast<long long>(minute) << 6) | static_cast<long long>(second);
}

static void LB_LunarUnpackDateTime(long long value, int& year, int& month, int& day, int& hour, int& minute, int& second) {
    year = static_cast<int>((static_cast<unsigned long long>(value) >> 26) & 0x3FFFFFFULL);
    month = static_cast<int>((static_cast<unsigned long long>(value) >> 22) & 0xFULL);
    day = static_cast<int>((static_cast<unsigned long long>(value) >> 17) & 0x1FULL);
    hour = static_cast<int>((static_cast<unsigned long long>(value) >> 12) & 0x1FULL);
    minute = static_cast<int>((static_cast<unsigned long long>(value) >> 6) & 0x3FULL);
    second = static_cast<int>(static_cast<unsigned long long>(value) & 0x3FULL);
}

// Howard Hinnant civil date 算法：返回 Unix 时代天数（1970-01-01 为 0）
static long long LB_LunarDaysFromCivil(int y, int m, int d) {
    y -= m <= 2;
    const long long era = (y >= 0 ? y : y - 399) / 400;
    const int yoe = static_cast<int>(y - era * 400);
    const int doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
    const int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return era * 146097 + doe - 719468;
}

static void LB_LunarCivilFromDays(long long z, int& y, int& m, int& d) {
    z += 719468;
    const long long era = (z >= 0 ? z : z - 146096) / 146097;
    const int doe = static_cast<int>(z - era * 146097);
    const int yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    const long long yy = static_cast<long long>(yoe) + era * 400;
    const int doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    const int mp = (5 * doy + 2) / 153;
    d = doy - (153 * mp + 2) / 5 + 1;
    m = mp + (mp < 10 ? 3 : -9);
    y = static_cast<int>(yy + (m <= 2));
}

static bool LB_LunarInfoValid(int year) {
    return year >= g_lbLunarBaseYear && year < g_lbLunarBaseYear + g_lbLunarYearCount;
}

static int LB_LunarLeapMonth(int year) {
    if (!LB_LunarInfoValid(year)) return 0;
    return static_cast<int>(g_lbLunarInfo[year - g_lbLunarBaseYear] & 0xF);
}

static int LB_LunarMonthDays(int year, int month) {
    if (!LB_LunarInfoValid(year) || month < 1 || month > 12) return 0;
    const unsigned int info = g_lbLunarInfo[year - g_lbLunarBaseYear];
    return (info & (0x10000u >> month)) ? 30 : 29;
}

static int LB_LunarLeapDays(int year) {
    if (!LB_LunarInfoValid(year)) return 0;
    const unsigned int info = g_lbLunarInfo[year - g_lbLunarBaseYear];
    const int leap = static_cast<int>(info & 0xF);
    if (!leap) return 0;
    return (info & 0x10000u) ? 30 : 29;
}

static int LB_LunarYearDays(int year) {
    if (!LB_LunarInfoValid(year)) return 0;
    unsigned int info = g_lbLunarInfo[year - g_lbLunarBaseYear];
    int sum = 348;
    for (unsigned int bit = 0x8000u; bit > 0x8u; bit >>= 1) sum += (info & bit) ? 1 : 0;
    return sum + LB_LunarLeapDays(year);
}

struct LbLunarDate {
    int year = 0;
    int month = 0;   // 1-12
    bool leap = false;
    int day = 0;     // 1-30
};

// 经典公历→农历：以 1900-01-31（1900 年正月初一）为基准逐日回减
static bool LB_LunarFromSolar(int y, int m, int d, LbLunarDate& out) {
    long long offset = LB_LunarDaysFromCivil(y, m, d) - LB_LunarDaysFromCivil(1900, 1, 31);
    if (offset < 0) return false;
    int year = g_lbLunarBaseYear;
    for (;;) {
        if (!LB_LunarInfoValid(year)) return false;
        const int days = LB_LunarYearDays(year);
        if (offset < days) break;
        offset -= days;
        ++year;
    }
    const int leap = LB_LunarLeapMonth(year);
    bool isLeap = false;
    int month = 1;
    int temp = 0;
    for (; month <= 12 && offset > 0; ++month) {
        if (leap > 0 && month == leap + 1 && !isLeap) {
            --month;
            isLeap = true;
            temp = LB_LunarLeapDays(year);
        } else {
            temp = LB_LunarMonthDays(year, month);
        }
        if (isLeap && month == leap + 1) isLeap = false;
        offset -= temp;
    }
    if (offset == 0 && leap > 0 && month == leap + 1) {
        if (isLeap) isLeap = false;
        else { isLeap = true; --month; }
    }
    if (offset < 0) { offset += temp; --month; }
    out.year = year;
    out.month = month;
    out.leap = isLeap;
    out.day = static_cast<int>(offset) + 1;
    return out.month >= 1 && out.month <= 12 && out.day >= 1 && out.day <= 30;
}

static bool LB_LunarToSolar(int lunarYear, int lunarMonth, int lunarDay, int& y, int& m, int& d) {
    const bool leapMonth = lunarMonth < 0;
    const int month = leapMonth ? -lunarMonth : lunarMonth;
    if (!LB_LunarInfoValid(lunarYear) || month < 1 || month > 12 || lunarDay < 1 || lunarDay > 30) return false;
    const int leap = LB_LunarLeapMonth(lunarYear);
    if (leapMonth && leap != month) return false;
    if (!leapMonth && lunarDay > LB_LunarMonthDays(lunarYear, month)) return false;
    if (leapMonth && lunarDay > LB_LunarLeapDays(lunarYear)) return false;
    long long offset = 0;
    for (int yy = g_lbLunarBaseYear; yy < lunarYear; ++yy) offset += LB_LunarYearDays(yy);
    for (int mm = 1; mm < month; ++mm) {
        offset += LB_LunarMonthDays(lunarYear, mm);
        if (leap > 0 && mm == leap) offset += LB_LunarLeapDays(lunarYear);
    }
    offset += (leapMonth ? LB_LunarLeapDays(lunarYear) : 0) + lunarDay - 1;
    LB_LunarCivilFromDays(LB_LunarDaysFromCivil(1900, 1, 31) + offset, y, m, d);
    return true;
}

// 节气表查询：n 1..24（1 小寒 … 24 冬至）
static bool LB_LunarTerm(int year, int n, int& day, int& minute) {
    if (n < 1 || n > 24) return false;
    if (year < g_lbSolarTermBaseYear || year >= g_lbSolarTermBaseYear + g_lbSolarTermYearCount) return false;
    day = g_lbSolarTermDays[year - g_lbSolarTermBaseYear][n - 1];
    minute = g_lbSolarTermMinutes[year - g_lbSolarTermBaseYear][n - 1];
    return true;
}

static const wchar_t* LB_LunarTermName(int n) {
    static const wchar_t* const names[24] = {
        L"小寒", L"大寒", L"立春", L"雨水", L"惊蛰", L"春分", L"清明", L"谷雨",
        L"立夏", L"小满", L"芒种", L"夏至", L"小暑", L"大暑", L"立秋", L"处暑",
        L"白露", L"秋分", L"寒露", L"霜降", L"立冬", L"小雪", L"大雪", L"冬至"
    };
    if (n < 1 || n > 24) return L"";
    return names[n - 1];
}

static const wchar_t* LB_LunarGan(int index) {
    static const wchar_t* const gan[10] = { L"甲", L"乙", L"丙", L"丁", L"戊", L"己", L"庚", L"辛", L"壬", L"癸" };
    return gan[index % 10];
}

static const wchar_t* LB_LunarZhi(int index) {
    static const wchar_t* const zhi[12] = { L"子", L"丑", L"寅", L"卯", L"辰", L"巳", L"午", L"未", L"申", L"酉", L"戌", L"亥" };
    return zhi[index % 12];
}

static const wchar_t* LB_LunarZodiac(int branch) {
    static const wchar_t* const zodiac[12] = { L"鼠", L"牛", L"虎", L"兔", L"龙", L"蛇", L"马", L"羊", L"猴", L"鸡", L"狗", L"猪" };
    return zodiac[branch % 12];
}

static int LB_LunarGanzhi(int stem, int branch) {
    for (int i = 0; i < 60; ++i) {
        if (i % 10 == stem && i % 12 == branch) return i;
    }
    return 0;
}

static std::wstring LB_LunarGanzhiText(int ganzhi) {
    const int index = ((ganzhi % 60) + 60) % 60;
    return std::wstring(LB_LunarGan(index)) + LB_LunarZhi(index);
}

static std::wstring LB_LunarChineseMonth(int month, bool leap) {
    static const wchar_t* const names[12] = {
        L"正", L"二", L"三", L"四", L"五", L"六", L"七", L"八", L"九", L"十", L"冬", L"腊"
    };
    std::wstring out;
    if (leap) out += L"闰";
    out += names[(month - 1) % 12];
    out += L"月";
    return out;
}

static std::wstring LB_LunarChineseDay(int day) {
    static const wchar_t* const digits[10] = {
        L"〇", L"一", L"二", L"三", L"四", L"五", L"六", L"七", L"八", L"九"
    };
    std::wstring out = L"初";
    if (day <= 10) {
        out = std::wstring(L"初") + digits[day % 10];
    } else if (day < 20) {
        out = std::wstring(L"十") + (day % 10 ? digits[day % 10] : L"");
    } else if (day == 20) {
        out = L"二十";
    } else if (day < 30) {
        out = std::wstring(L"廿") + (day % 10 ? digits[day % 10] : L"");
    } else {
        out = L"三十";
    }
    return out;
}

int 农历_公历转农历年(long long value) {
    int y, mo, d, h, mi, s;
    LB_LunarUnpackDateTime(value, y, mo, d, h, mi, s);
    if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
    LbLunarDate lunar;
    return LB_LunarFromSolar(y, mo, d, lunar) ? lunar.year : 0;
}

int 农历_公历转农历月(long long value) {
    int y, mo, d, h, mi, s;
    LB_LunarUnpackDateTime(value, y, mo, d, h, mi, s);
    if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
    LbLunarDate lunar;
    if (!LB_LunarFromSolar(y, mo, d, lunar)) return 0;
    return lunar.leap ? -lunar.month : lunar.month;
}

int 农历_公历转农历日(long long value) {
    int y, mo, d, h, mi, s;
    LB_LunarUnpackDateTime(value, y, mo, d, h, mi, s);
    if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
    LbLunarDate lunar;
    return LB_LunarFromSolar(y, mo, d, lunar) ? lunar.day : 0;
}

long long 农历_农历转公历(int lunarYear, int lunarMonth, int lunarDay) {
    int y, m, d;
    if (!LB_LunarToSolar(lunarYear, lunarMonth, lunarDay, y, m, d)) return 0;
    return LB_LunarPackDateTime(y, m, d, 0, 0, 0);
}

const wchar_t* 农历_公历转农历文本(long long value, bool includeZodiac) {
    int y, mo, d, h, mi, s;
    LB_LunarUnpackDateTime(value, y, mo, d, h, mi, s);
    if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return LB_ReturnText(L"");
    LbLunarDate lunar;
    if (!LB_LunarFromSolar(y, mo, d, lunar)) return LB_ReturnText(L"");
    std::wstring out = LB_LunarGanzhiText(lunar.year - 4);
    if (includeZodiac) {
        const int branch = ((lunar.year - 4) % 60 + 60) % 60 % 12;
        out += std::wstring(L"（") + LB_LunarZodiac(branch) + L"）";
    }
    out += L"年" + LB_LunarChineseMonth(lunar.month, lunar.leap) + LB_LunarChineseDay(lunar.day);
    return LB_ReturnText(std::move(out));
}

int 农历_取闰月月份(int year) { return LB_LunarLeapMonth(year); }

int 农历_取月天数(int year, int month) {
    return month < 0 ? LB_LunarLeapDays(year) : LB_LunarMonthDays(year, month);
}

int 农历_取年天数(int year) { return LB_LunarYearDays(year); }

const wchar_t* 农历_取属相(int year) {
    const int index = ((year - 4) % 60 + 60) % 60;
    return LB_LunarZodiac(index % 12);
}

const wchar_t* 农历_取天干地支(int year) {
    const int index = ((year - 4) % 60 + 60) % 60;
    return LB_ReturnText(LB_LunarGanzhiText(index));
}

const wchar_t* 农历_取六十甲子(int year) {
    const int index = ((year - 4) % 60 + 60) % 60;
    return LB_ReturnText(L"第" + std::to_wstring(index + 1) + LB_LunarGanzhiText(index));
}

long long 农历_取节气(int year, int term) {
    int day = 0, minute = 0;
    if (!LB_LunarTerm(year, term, day, minute)) return 0;
    const int month = (term + 1) / 2;
    return LB_LunarPackDateTime(year, month, day, minute / 60, minute % 60, 0);
}

const wchar_t* 农历_取节气名称(int term) {
    return LB_ReturnText(LB_LunarTermName(term));
}

const wchar_t* 农历_取四柱(long long value) {
    int y, mo, d, h, mi, s;
    LB_LunarUnpackDateTime(value, y, mo, d, h, mi, s);
    if (y < 1901 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23) return LB_ReturnText(L"");
    // 年柱：立春分界
    int lichunDay = 0, lichunMinute = 0;
    if (!LB_LunarTerm(y, 3, lichunDay, lichunMinute)) return LB_ReturnText(L"");
    const int adjustedYear = (mo < 2 || (mo == 2 && d < lichunDay)) ? y - 1 : y;
    const int yearGZ = ((adjustedYear - 4) % 60 + 60) % 60;
    // 月柱：找当前时刻之前最近的一个「节」（奇数序号节气，含跨年大小雪/小寒）
    long long best = -1;
    int bestN = -1;
    const long long nowDays = LB_LunarDaysFromCivil(y, mo, d) * 1440LL + h * 60LL + mi;
    for (int yy = y - 1; yy <= y + 1; ++yy) {
        for (int n = 1; n <= 23; n += 2) {
            int day = 0, minute = 0;
            if (!LB_LunarTerm(yy, n, day, minute)) continue;
            const long long termStamp = LB_LunarDaysFromCivil(yy, (n + 1) / 2, day) * 1440LL + minute;
            if (termStamp <= nowDays && termStamp > best) { best = termStamp; bestN = n; }
        }
    }
    if (bestN < 0) return LB_ReturnText(L"");
    const int monthBranch = ((bestN - 1) / 2 + 1) % 12;
    const int monthSeq = (monthBranch - 2 + 12) % 12;
    const int monthStem = ((yearGZ % 10) * 2 + 2 + monthSeq) % 10;
    const int monthGZ = LB_LunarGanzhi(monthStem, monthBranch);
    // 日柱：已知 1949-10-01 为甲子日
    const long long jdn = LB_LunarDaysFromCivil(y, mo, d) + 2440588LL;
    const int dayGZ = static_cast<int>(((jdn - 11) % 60 + 60) % 60);
    // 时柱：23-1 点为子时
    const int hourBranch = ((h + 1) / 2) % 12;
    const int hourStem = ((dayGZ % 10) * 2 + hourBranch) % 10;
    const int hourGZ = LB_LunarGanzhi(hourStem, hourBranch);
    std::wstring out = LB_LunarGanzhiText(yearGZ) + L"年 "
        + LB_LunarGanzhiText(monthGZ) + L"月 "
        + LB_LunarGanzhiText(dayGZ) + L"日 "
        + LB_LunarGanzhiText(hourGZ) + L"时";
    return LB_ReturnText(std::move(out));
}
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.std.text': TEXT_RUNTIME,
  'lingbuilder.std.array': ARRAY_RUNTIME,
  'lingbuilder.std.bytes': BYTES_RUNTIME,
  'lingbuilder.std.encoding': ENCODING_RUNTIME,
  'lingbuilder.std.math': MATH_RUNTIME,
  'lingbuilder.std.datetime': [DATETIME_RUNTIME, DATETIME_FIELDS_RUNTIME, DATETIME_COMMAND_RUNTIME].join('\n'),
  'lingbuilder.std.buffer': BUFFER_RUNTIME,
  'lingbuilder.std.regex': REGEX_RUNTIME,
  'lingbuilder.data.json': JSON_RUNTIME,
  'lingbuilder.std.map': MAP_RUNTIME,
  'lingbuilder.std.bigint': BIGINT_RUNTIME,
  'lingbuilder.std.pinyin': PINYIN_RUNTIME,
  'lingbuilder.std.lunar': LUNAR_RUNTIME,
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
