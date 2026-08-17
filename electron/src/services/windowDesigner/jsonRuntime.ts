/**
 * Deterministic, dependency-free JSON runtime emitted into every generated
 * project that enables lingbuilder.data.json. It deliberately exposes only
 * managed numeric handles to LingCpp, never C++ object addresses.
 */
export const JSON_RUNTIME = String.raw`
namespace LingBuilderJson {
constexpr size_t kMaxInputChars = 16u * 1024u * 1024u;
constexpr size_t kMaxDepth = 256u;

enum class Kind { Null, Boolean, Number, String, Array, Object };

struct Value {
    Kind kind = Kind::Null;
    bool boolean = false;
    std::wstring number;
    std::wstring text;
    std::vector<Value> array;
    std::vector<std::pair<std::wstring, Value>> object;

    static Value MakeNull() { return {}; }
    static Value MakeBoolean(bool value) { Value result; result.kind = Kind::Boolean; result.boolean = value; return result; }
    static Value MakeNumber(std::wstring value) { Value result; result.kind = Kind::Number; result.number = std::move(value); return result; }
    static Value MakeString(std::wstring value) { Value result; result.kind = Kind::String; result.text = std::move(value); return result; }
    static Value MakeArray() { Value result; result.kind = Kind::Array; return result; }
    static Value MakeObject() { Value result; result.kind = Kind::Object; return result; }
};

static thread_local std::wstring g_lastError;
static std::mutex g_documentsMutex;
static std::unordered_map<long long, Value> g_documents;
static std::atomic<long long> g_nextDocumentId{ 1 };

static void ClearError() { g_lastError.clear(); }
static void SetError(const std::wstring& message) { g_lastError = message; }

static Value* FindObject(Value& value, const std::wstring& key) {
    if (value.kind != Kind::Object) return nullptr;
    for (auto iterator = value.object.rbegin(); iterator != value.object.rend(); ++iterator) {
        if (iterator->first == key) return &iterator->second;
    }
    return nullptr;
}

static const Value* FindObject(const Value& value, const std::wstring& key) {
    if (value.kind != Kind::Object) return nullptr;
    for (auto iterator = value.object.rbegin(); iterator != value.object.rend(); ++iterator) {
        if (iterator->first == key) return &iterator->second;
    }
    return nullptr;
}

static void SetObject(Value& value, const std::wstring& key, Value replacement) {
    if (Value* existing = FindObject(value, key)) { *existing = std::move(replacement); return; }
    value.object.emplace_back(key, std::move(replacement));
}

static bool RemoveObject(Value& value, const std::wstring& key) {
    if (value.kind != Kind::Object) return false;
    for (auto iterator = value.object.begin(); iterator != value.object.end(); ++iterator) {
        if (iterator->first == key) { value.object.erase(iterator); return true; }
    }
    return false;
}

class Parser {
public:
    explicit Parser(const std::wstring& source) : source_(source) {}

    bool Parse(Value& output) {
        if (source_.size() > kMaxInputChars) return Fail(L"JSON 文本超过 16 MiB 安全上限。");
        SkipWhitespace();
        if (!ParseValue(output, 0)) return false;
        SkipWhitespace();
        if (index_ != source_.size()) return Fail(L"JSON 根值后包含无效字符。");
        return true;
    }

    const std::wstring& Error() const { return error_; }

private:
    bool Fail(const wchar_t* message) {
        if (error_.empty()) error_ = std::wstring(message) + L"（位置 " + std::to_wstring(index_ + 1) + L"）。";
        return false;
    }

    void SkipWhitespace() {
        if (index_ == 0 && !source_.empty() && source_[0] == 0xfeff) ++index_;
        while (index_ < source_.size() && iswspace(source_[index_])) ++index_;
    }

    bool Take(wchar_t expected) {
        SkipWhitespace();
        if (index_ >= source_.size() || source_[index_] != expected) return false;
        ++index_;
        return true;
    }

    bool ParseValue(Value& output, size_t depth) {
        if (depth > kMaxDepth) return Fail(L"JSON 嵌套层级超过 256 层安全上限");
        SkipWhitespace();
        if (index_ >= source_.size()) return Fail(L"JSON 缺少值");
        switch (source_[index_]) {
            case L'{': return ParseObject(output, depth + 1);
            case L'[': return ParseArray(output, depth + 1);
            case L'"': {
                std::wstring text;
                if (!ParseString(text)) return false;
                output = Value::MakeString(std::move(text));
                return true;
            }
            case L't': return ParseLiteral(L"true", Value::MakeBoolean(true), output);
            case L'f': return ParseLiteral(L"false", Value::MakeBoolean(false), output);
            case L'n': return ParseLiteral(L"null", Value::MakeNull(), output);
            default: return ParseNumber(output);
        }
    }

    bool ParseLiteral(const wchar_t* literal, Value value, Value& output) {
        const size_t length = wcslen(literal);
        if (source_.compare(index_, length, literal) != 0) return Fail(L"JSON 字面量无效");
        index_ += length;
        output = std::move(value);
        return true;
    }

    bool ParseHexUnit(unsigned int& value) {
        if (source_.size() - index_ < 4) return Fail(L"JSON Unicode 转义不完整");
        value = 0;
        for (size_t offset = 0; offset < 4; ++offset) {
            const int digit = LB_HexDigit(source_[index_ + offset]);
            if (digit < 0) return Fail(L"JSON Unicode 转义包含非十六进制字符");
            value = (value << 4) | static_cast<unsigned int>(digit);
        }
        index_ += 4;
        return true;
    }

    bool ParseString(std::wstring& output) {
        SkipWhitespace();
        if (index_ >= source_.size() || source_[index_++] != L'"') return Fail(L"JSON 字符串缺少起始引号");
        output.clear();
        while (index_ < source_.size()) {
            wchar_t character = source_[index_++];
            if (character == L'"') return true;
            if (character < 0x20) return Fail(L"JSON 字符串包含控制字符");
            if (character != L'\\') { output.push_back(character); continue; }
            if (index_ >= source_.size()) return Fail(L"JSON 字符串转义不完整");
            switch (source_[index_++]) {
                case L'"': output.push_back(L'"'); break;
                case L'\\': output.push_back(L'\\'); break;
                case L'/': output.push_back(L'/'); break;
                case L'b': output.push_back(L'\b'); break;
                case L'f': output.push_back(L'\f'); break;
                case L'n': output.push_back(L'\n'); break;
                case L'r': output.push_back(L'\r'); break;
                case L't': output.push_back(L'\t'); break;
                case L'u': {
                    unsigned int codeUnit = 0;
                    if (!ParseHexUnit(codeUnit)) return false;
                    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
                        if (source_.size() - index_ < 6 || source_[index_] != L'\\' || source_[index_ + 1] != L'u') return Fail(L"JSON 高代理项缺少低代理项");
                        index_ += 2;
                        unsigned int low = 0;
                        if (!ParseHexUnit(low)) return false;
                        if (low < 0xdc00 || low > 0xdfff) return Fail(L"JSON 高代理项后的低代理项无效");
                        output.push_back(static_cast<wchar_t>(codeUnit));
                        output.push_back(static_cast<wchar_t>(low));
                    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
                        return Fail(L"JSON 出现未配对的低代理项");
                    } else {
                        output.push_back(static_cast<wchar_t>(codeUnit));
                    }
                    break;
                }
                default: return Fail(L"JSON 字符串使用了不支持的转义字符");
            }
        }
        return Fail(L"JSON 字符串缺少结束引号");
    }

    bool ParseNumber(Value& output) {
        const size_t start = index_;
        if (source_[index_] == L'-') ++index_;
        if (index_ >= source_.size()) return Fail(L"JSON 数字不完整");
        if (source_[index_] == L'0') {
            ++index_;
            if (index_ < source_.size() && iswdigit(source_[index_])) return Fail(L"JSON 数字不允许前导零");
        } else {
            if (source_[index_] < L'1' || source_[index_] > L'9') return Fail(L"JSON 值不是合法数字");
            while (index_ < source_.size() && iswdigit(source_[index_])) ++index_;
        }
        if (index_ < source_.size() && source_[index_] == L'.') {
            ++index_;
            const size_t fractionStart = index_;
            while (index_ < source_.size() && iswdigit(source_[index_])) ++index_;
            if (fractionStart == index_) return Fail(L"JSON 小数点后缺少数字");
        }
        if (index_ < source_.size() && (source_[index_] == L'e' || source_[index_] == L'E')) {
            ++index_;
            if (index_ < source_.size() && (source_[index_] == L'+' || source_[index_] == L'-')) ++index_;
            const size_t exponentStart = index_;
            while (index_ < source_.size() && iswdigit(source_[index_])) ++index_;
            if (exponentStart == index_) return Fail(L"JSON 指数部分缺少数字");
        }
        output = Value::MakeNumber(source_.substr(start, index_ - start));
        return true;
    }

    bool ParseObject(Value& output, size_t depth) {
        if (!Take(L'{')) return Fail(L"JSON 对象缺少起始花括号");
        output = Value::MakeObject();
        SkipWhitespace();
        if (index_ < source_.size() && source_[index_] == L'}') { ++index_; return true; }
        while (true) {
            std::wstring key;
            if (!ParseString(key)) return false;
            if (!Take(L':')) return Fail(L"JSON 对象成员缺少冒号");
            Value item;
            if (!ParseValue(item, depth)) return false;
            // Repeated keys are accepted with last-member-wins semantics, matching common JSON runtimes.
            SetObject(output, key, std::move(item));
            SkipWhitespace();
            if (index_ < source_.size() && source_[index_] == L'}') { ++index_; return true; }
            if (!Take(L',')) return Fail(L"JSON 对象成员之间缺少逗号");
            SkipWhitespace();
        }
    }

    bool ParseArray(Value& output, size_t depth) {
        if (!Take(L'[')) return Fail(L"JSON 数组缺少起始方括号");
        output = Value::MakeArray();
        SkipWhitespace();
        if (index_ < source_.size() && source_[index_] == L']') { ++index_; return true; }
        while (true) {
            Value item;
            if (!ParseValue(item, depth)) return false;
            output.array.push_back(std::move(item));
            SkipWhitespace();
            if (index_ < source_.size() && source_[index_] == L']') { ++index_; return true; }
            if (!Take(L',')) return Fail(L"JSON 数组元素之间缺少逗号");
            SkipWhitespace();
        }
    }

    const std::wstring& source_;
    size_t index_ = 0;
    std::wstring error_;
};

static bool ParseText(const std::wstring& source, Value& value) {
    Parser parser(source);
    if (parser.Parse(value)) return true;
    SetError(parser.Error().empty() ? L"JSON 解析失败。" : parser.Error());
    return false;
}

static long long Store(Value value) {
    const long long handle = g_nextDocumentId.fetch_add(1);
    if (handle <= 0) { SetError(L"JSON 句柄空间已耗尽。"); return 0; }
    std::lock_guard<std::mutex> lock(g_documentsMutex);
    g_documents.emplace(handle, std::move(value));
    return handle;
}

static bool Load(long long handle, Value& value) {
    if (handle <= 0) { SetError(L"JSON值句柄无效。"); return false; }
    std::lock_guard<std::mutex> lock(g_documentsMutex);
    const auto found = g_documents.find(handle);
    if (found == g_documents.end()) { SetError(L"JSON值已经释放或不存在。"); return false; }
    value = found->second;
    return true;
}

static bool Replace(long long handle, Value value) {
    if (handle <= 0) { SetError(L"JSON值句柄无效。"); return false; }
    std::lock_guard<std::mutex> lock(g_documentsMutex);
    const auto found = g_documents.find(handle);
    if (found == g_documents.end()) { SetError(L"JSON值已经释放或不存在。"); return false; }
    found->second = std::move(value);
    return true;
}

static bool Release(long long handle) {
    if (handle <= 0) { SetError(L"JSON值句柄无效。"); return false; }
    std::lock_guard<std::mutex> lock(g_documentsMutex);
    return g_documents.erase(handle) != 0;
}

static bool IsInteger(const Value& value) {
    return value.kind == Kind::Number && value.number.find_first_of(L".eE") == std::wstring::npos;
}

static bool AsLongLong(const Value& value, long long& output) {
    if (!IsInteger(value)) return false;
    try {
        size_t consumed = 0;
        output = std::stoll(value.number, &consumed, 10);
        return consumed == value.number.size();
    } catch (...) { return false; }
}

static bool AsDouble(const Value& value, double& output) {
    if (value.kind != Kind::Number) return false;
    try {
        size_t consumed = 0;
        output = std::stod(value.number, &consumed);
        return consumed == value.number.size() && std::isfinite(output);
    } catch (...) { return false; }
}

static void AppendHex4(std::wstring& output, unsigned int value) {
    static constexpr wchar_t digits[] = L"0123456789ABCDEF";
    output += L"\\u";
    output.push_back(digits[(value >> 12) & 0xf]);
    output.push_back(digits[(value >> 8) & 0xf]);
    output.push_back(digits[(value >> 4) & 0xf]);
    output.push_back(digits[value & 0xf]);
}

static void AppendEscaped(const std::wstring& text, std::wstring& output) {
    for (size_t index = 0; index < text.size(); ++index) {
        const wchar_t character = text[index];
        switch (character) {
            case L'"': output += L"\\\""; break;
            case L'\\': output += L"\\\\"; break;
            case L'\b': output += L"\\b"; break;
            case L'\f': output += L"\\f"; break;
            case L'\n': output += L"\\n"; break;
            case L'\r': output += L"\\r"; break;
            case L'\t': output += L"\\t"; break;
            default:
                if (character < 0x20) AppendHex4(output, static_cast<unsigned int>(character));
                else output.push_back(character);
                break;
        }
    }
}

static bool Serialize(const Value& value, int indent, size_t depth, std::wstring& output) {
    if (depth > kMaxDepth) { SetError(L"JSON 序列化嵌套层级超过安全上限。"); return false; }
    const bool pretty = indent >= 0;
    const auto newline = [&]() { if (pretty) output.push_back(L'\n'); };
    const auto padding = [&](size_t level) { if (pretty) output.append(level * static_cast<size_t>(indent), L' '); };
    switch (value.kind) {
        case Kind::Null: output += L"null"; return true;
        case Kind::Boolean: output += value.boolean ? L"true" : L"false"; return true;
        case Kind::Number: output += value.number; return true;
        case Kind::String: output.push_back(L'"'); AppendEscaped(value.text, output); output.push_back(L'"'); return true;
        case Kind::Array:
            output.push_back(L'[');
            if (!value.array.empty()) {
                newline();
                for (size_t index = 0; index < value.array.size(); ++index) {
                    padding(depth + 1);
                    if (!Serialize(value.array[index], indent, depth + 1, output)) return false;
                    if (index + 1 < value.array.size()) output.push_back(L',');
                    newline();
                }
                padding(depth);
            }
            output.push_back(L']');
            return true;
        case Kind::Object:
            output.push_back(L'{');
            if (!value.object.empty()) {
                newline();
                for (size_t index = 0; index < value.object.size(); ++index) {
                    padding(depth + 1);
                    output.push_back(L'"'); AppendEscaped(value.object[index].first, output); output += L"\":";
                    if (pretty) output.push_back(L' ');
                    if (!Serialize(value.object[index].second, indent, depth + 1, output)) return false;
                    if (index + 1 < value.object.size()) output.push_back(L',');
                    newline();
                }
                padding(depth);
            }
            output.push_back(L'}');
            return true;
    }
    return false;
}

static std::wstring SerializeText(const Value& value, int indent) {
    std::wstring output;
    if (!Serialize(value, indent, 0, output)) return {};
    return output;
}

static bool DecodePointer(const std::wstring& pointer, std::vector<std::wstring>& tokens) {
    tokens.clear();
    if (pointer.empty()) return true;
    if (pointer[0] != L'/') { SetError(L"JSON Pointer 必须为空文本或以 / 开头。"); return false; }
    size_t start = 1;
    while (true) {
        const size_t end = pointer.find(L'/', start);
        const std::wstring source = pointer.substr(start, end == std::wstring::npos ? std::wstring::npos : end - start);
        std::wstring decoded;
        for (size_t index = 0; index < source.size(); ++index) {
            if (source[index] != L'~') { decoded.push_back(source[index]); continue; }
            if (index + 1 >= source.size() || (source[index + 1] != L'0' && source[index + 1] != L'1')) { SetError(L"JSON Pointer 包含无效的 ~ 转义。"); return false; }
            decoded.push_back(source[index + 1] == L'0' ? L'~' : L'/');
            ++index;
        }
        tokens.push_back(std::move(decoded));
        if (end == std::wstring::npos) return true;
        start = end + 1;
    }
}

static bool ParseArrayIndex(const std::wstring& token, size_t size, bool allowAppend, size_t& index) {
    if (allowAppend && token == L"-") { index = size; return true; }
    if (token.empty() || (token.size() > 1 && token[0] == L'0')) return false;
    size_t value = 0;
    for (wchar_t character : token) {
        if (character < L'0' || character > L'9' || value > ((std::numeric_limits<size_t>::max)() - 9) / 10) return false;
        value = value * 10 + static_cast<size_t>(character - L'0');
    }
    if (value >= size && !(allowAppend && value == size)) return false;
    index = value;
    return true;
}

static Value* ResolvePointer(Value& root, const std::vector<std::wstring>& tokens) {
    Value* current = &root;
    for (const std::wstring& token : tokens) {
        if (current->kind == Kind::Object) current = FindObject(*current, token);
        else if (current->kind == Kind::Array) {
            size_t index = 0;
            if (!ParseArrayIndex(token, current->array.size(), false, index)) return nullptr;
            current = &current->array[index];
        } else return nullptr;
        if (!current) return nullptr;
    }
    return current;
}

static const Value* ResolvePointer(const Value& root, const std::vector<std::wstring>& tokens) {
    const Value* current = &root;
    for (const std::wstring& token : tokens) {
        if (current->kind == Kind::Object) current = FindObject(*current, token);
        else if (current->kind == Kind::Array) {
            size_t index = 0;
            if (!ParseArrayIndex(token, current->array.size(), false, index)) return nullptr;
            current = &current->array[index];
        } else return nullptr;
        if (!current) return nullptr;
    }
    return current;
}

static bool SetPointer(Value& root, const std::vector<std::wstring>& tokens, Value replacement, bool createIntermediate) {
    if (tokens.empty()) { root = std::move(replacement); return true; }
    Value* current = &root;
    for (size_t offset = 0; offset + 1 < tokens.size(); ++offset) {
        const std::wstring& token = tokens[offset];
        if (current->kind == Kind::Object) {
            Value* child = FindObject(*current, token);
            if (!child && createIntermediate) { SetObject(*current, token, Value::MakeObject()); child = FindObject(*current, token); }
            if (!child) { SetError(L"JSON Pointer 的中间对象不存在。" ); return false; }
            current = child;
        } else if (current->kind == Kind::Array) {
            size_t index = 0;
            if (!ParseArrayIndex(token, current->array.size(), false, index)) { SetError(L"JSON Pointer 的数组中间索引无效。" ); return false; }
            current = &current->array[index];
        } else { SetError(L"JSON Pointer 中间位置不是对象或数组。" ); return false; }
    }
    const std::wstring& finalToken = tokens.back();
    if (current->kind == Kind::Object) { SetObject(*current, finalToken, std::move(replacement)); return true; }
    if (current->kind == Kind::Array) {
        size_t index = 0;
        if (!ParseArrayIndex(finalToken, current->array.size(), true, index)) { SetError(L"JSON Pointer 的数组索引无效。" ); return false; }
        if (index == current->array.size()) current->array.push_back(std::move(replacement));
        else current->array[index] = std::move(replacement);
        return true;
    }
    SetError(L"JSON Pointer 父位置不是对象或数组。");
    return false;
}

static bool AddPointer(Value& root, const std::vector<std::wstring>& tokens, Value replacement) {
    if (tokens.empty()) { root = std::move(replacement); return true; }
    std::vector<std::wstring> parentTokens(tokens.begin(), tokens.end() - 1);
    Value* parent = ResolvePointer(root, parentTokens);
    if (!parent) { SetError(L"JSON Patch add 的父路径不存在。" ); return false; }
    if (parent->kind == Kind::Object) { SetObject(*parent, tokens.back(), std::move(replacement)); return true; }
    if (parent->kind == Kind::Array) {
        size_t index = 0;
        if (!ParseArrayIndex(tokens.back(), parent->array.size(), true, index)) { SetError(L"JSON Patch add 的数组索引无效。" ); return false; }
        parent->array.insert(parent->array.begin() + static_cast<std::ptrdiff_t>(index), std::move(replacement));
        return true;
    }
    SetError(L"JSON Patch add 的父路径不是对象或数组。" );
    return false;
}

static bool RemovePointer(Value& root, const std::vector<std::wstring>& tokens) {
    if (tokens.empty()) { root = Value::MakeNull(); return true; }
    std::vector<std::wstring> parentTokens(tokens.begin(), tokens.end() - 1);
    Value* parent = ResolvePointer(root, parentTokens);
    if (!parent) { SetError(L"JSON Pointer 的父路径不存在。" ); return false; }
    if (parent->kind == Kind::Object) {
        if (!RemoveObject(*parent, tokens.back())) { SetError(L"JSON Pointer 指向的对象成员不存在。" ); return false; }
        return true;
    }
    if (parent->kind == Kind::Array) {
        size_t index = 0;
        if (!ParseArrayIndex(tokens.back(), parent->array.size(), false, index)) { SetError(L"JSON Pointer 指向的数组索引无效。" ); return false; }
        parent->array.erase(parent->array.begin() + static_cast<std::ptrdiff_t>(index));
        return true;
    }
    SetError(L"JSON Pointer 的父路径不是对象或数组。" );
    return false;
}

static bool Equal(const Value& left, const Value& right) {
    if (left.kind != right.kind) return false;
    switch (left.kind) {
        case Kind::Null: return true;
        case Kind::Boolean: return left.boolean == right.boolean;
        case Kind::Number: return left.number == right.number;
        case Kind::String: return left.text == right.text;
        case Kind::Array:
            if (left.array.size() != right.array.size()) return false;
            for (size_t index = 0; index < left.array.size(); ++index) if (!Equal(left.array[index], right.array[index])) return false;
            return true;
        case Kind::Object:
            if (left.object.size() != right.object.size()) return false;
            for (const auto& item : left.object) {
                const Value* match = FindObject(right, item.first);
                if (!match || !Equal(item.second, *match)) return false;
            }
            return true;
    }
    return false;
}

static void MergePatch(Value& target, const Value& patch) {
    if (patch.kind != Kind::Object) { target = patch; return; }
    if (target.kind != Kind::Object) target = Value::MakeObject();
    for (const auto& item : patch.object) {
        if (item.second.kind == Kind::Null) { RemoveObject(target, item.first); continue; }
        Value* member = FindObject(target, item.first);
        if (!member) { SetObject(target, item.first, item.second); continue; }
        MergePatch(*member, item.second);
    }
}

static std::wstring EscapePointerToken(const std::wstring& token) {
    std::wstring result;
    for (wchar_t character : token) {
        if (character == L'~') result += L"~0";
        else if (character == L'/') result += L"~1";
        else result.push_back(character);
    }
    return result;
}

static void AddPatchOperation(std::vector<Value>& output, const std::wstring& operation, const std::wstring& path, const Value* value = nullptr) {
    Value item = Value::MakeObject();
    SetObject(item, L"op", Value::MakeString(operation));
    SetObject(item, L"path", Value::MakeString(path));
    if (value) SetObject(item, L"value", *value);
    output.push_back(std::move(item));
}

static void BuildDiff(const Value& source, const Value& target, const std::wstring& path, std::vector<Value>& output, size_t depth = 0) {
    if (depth > kMaxDepth) { AddPatchOperation(output, L"replace", path, &target); return; }
    if (source.kind == Kind::Object && target.kind == Kind::Object) {
        for (const auto& item : source.object) {
            if (!FindObject(target, item.first)) AddPatchOperation(output, L"remove", path + L"/" + EscapePointerToken(item.first));
        }
        for (const auto& item : target.object) {
            const Value* original = FindObject(source, item.first);
            const std::wstring itemPath = path + L"/" + EscapePointerToken(item.first);
            if (!original) AddPatchOperation(output, L"add", itemPath, &item.second);
            else BuildDiff(*original, item.second, itemPath, output, depth + 1);
        }
        return;
    }
    if (source.kind == Kind::Array && target.kind == Kind::Array && Equal(source, target)) return;
    if (!Equal(source, target)) AddPatchOperation(output, L"replace", path, &target);
}

static bool SchemaFailure(std::wstring& error, const std::wstring& path, const std::wstring& message) {
    error = L"JSON Schema 校验失败：" + (path.empty() ? L"/" : path) + L"：" + message;
    return false;
}

static bool MatchesType(const Value& value, const std::wstring& type) {
    if (type == L"null") return value.kind == Kind::Null;
    if (type == L"boolean") return value.kind == Kind::Boolean;
    if (type == L"object") return value.kind == Kind::Object;
    if (type == L"array") return value.kind == Kind::Array;
    if (type == L"string") return value.kind == Kind::String;
    if (type == L"number") return value.kind == Kind::Number;
    if (type == L"integer") return IsInteger(value);
    return false;
}

static bool SchemaInteger(const Value* value, long long& output) { return value && AsLongLong(*value, output); }
static bool SchemaNumber(const Value* value, double& output) { return value && AsDouble(*value, output); }

static bool ValidateSchema(const Value& value, const Value& schema, const std::wstring& path, std::wstring& error, size_t depth = 0) {
    if (depth > 64) return SchemaFailure(error, path, L"Schema 嵌套超过 64 层安全上限");
    if (schema.kind == Kind::Boolean) return schema.boolean ? true : SchemaFailure(error, path, L"Schema 显式拒绝该值");
    if (schema.kind != Kind::Object) return SchemaFailure(error, path, L"Schema 必须是对象或逻辑值");

    if (const Value* type = FindObject(schema, L"type")) {
        bool matched = false;
        if (type->kind == Kind::String) matched = MatchesType(value, type->text);
        else if (type->kind == Kind::Array) for (const Value& item : type->array) if (item.kind == Kind::String && MatchesType(value, item.text)) { matched = true; break; }
        else return SchemaFailure(error, path, L"type 必须是文本或文本数组");
        if (!matched) return SchemaFailure(error, path, L"值类型不符合 type 约束");
    }
    if (const Value* constant = FindObject(schema, L"const")) if (!Equal(value, *constant)) return SchemaFailure(error, path, L"值不符合 const 约束");
    if (const Value* values = FindObject(schema, L"enum")) {
        if (values->kind != Kind::Array) return SchemaFailure(error, path, L"enum 必须是数组");
        bool matched = false;
        for (const Value& item : values->array) if (Equal(value, item)) { matched = true; break; }
        if (!matched) return SchemaFailure(error, path, L"值不在 enum 集合中");
    }

    const auto validateCombinator = [&](const wchar_t* key, int mode) -> bool {
        const Value* group = FindObject(schema, key);
        if (!group) return true;
        if (group->kind != Kind::Array) return SchemaFailure(error, path, std::wstring(key) + L" 必须是数组");
        int matches = 0;
        for (const Value& item : group->array) { std::wstring ignored; if (ValidateSchema(value, item, path, ignored, depth + 1)) ++matches; }
        if ((mode == 0 && matches != static_cast<int>(group->array.size())) || (mode == 1 && matches == 0) || (mode == 2 && matches != 1)) {
            return SchemaFailure(error, path, std::wstring(key) + L" 组合约束不满足");
        }
        return true;
    };
    if (!validateCombinator(L"allOf", 0) || !validateCombinator(L"anyOf", 1) || !validateCombinator(L"oneOf", 2)) return false;
    if (const Value* negative = FindObject(schema, L"not")) { std::wstring ignored; if (ValidateSchema(value, *negative, path, ignored, depth + 1)) return SchemaFailure(error, path, L"not 约束不满足"); }

    if (value.kind == Kind::Object) {
        if (const Value* required = FindObject(schema, L"required")) {
            if (required->kind != Kind::Array) return SchemaFailure(error, path, L"required 必须是数组");
            for (const Value& item : required->array) {
                if (item.kind != Kind::String) return SchemaFailure(error, path, L"required 只能包含文本键");
                if (!FindObject(value, item.text)) return SchemaFailure(error, path, L"缺少必填属性 “" + item.text + L"”");
            }
        }
        const Value* properties = FindObject(schema, L"properties");
        if (properties && properties->kind != Kind::Object) return SchemaFailure(error, path, L"properties 必须是对象");
        for (const auto& property : properties ? properties->object : std::vector<std::pair<std::wstring, Value>>{}) {
            if (const Value* child = FindObject(value, property.first)) {
                if (!ValidateSchema(*child, property.second, path + L"/" + EscapePointerToken(property.first), error, depth + 1)) return false;
            }
        }
        if (const Value* additional = FindObject(schema, L"additionalProperties")) {
            for (const auto& item : value.object) {
                const bool known = properties && FindObject(*properties, item.first);
                if (known) continue;
                if (additional->kind == Kind::Boolean) {
                    if (!additional->boolean) return SchemaFailure(error, path, L"不允许附加属性 “" + item.first + L"”");
                } else if (!ValidateSchema(item.second, *additional, path + L"/" + EscapePointerToken(item.first), error, depth + 1)) return false;
            }
        }
    }

    if (value.kind == Kind::Array) {
        long long bound = 0;
        if (SchemaInteger(FindObject(schema, L"minItems"), bound) && (bound < 0 || value.array.size() < static_cast<size_t>(bound))) return SchemaFailure(error, path, L"数组长度小于 minItems");
        if (SchemaInteger(FindObject(schema, L"maxItems"), bound) && (bound < 0 || value.array.size() > static_cast<size_t>(bound))) return SchemaFailure(error, path, L"数组长度大于 maxItems");
        if (const Value* items = FindObject(schema, L"items")) for (size_t index = 0; index < value.array.size(); ++index) {
            if (!ValidateSchema(value.array[index], *items, path + L"/" + std::to_wstring(index), error, depth + 1)) return false;
        }
        if (const Value* unique = FindObject(schema, L"uniqueItems"); unique && unique->kind == Kind::Boolean && unique->boolean) {
            for (size_t first = 0; first < value.array.size(); ++first) for (size_t second = first + 1; second < value.array.size(); ++second) {
                if (Equal(value.array[first], value.array[second])) return SchemaFailure(error, path, L"数组不符合 uniqueItems");
            }
        }
    }

    if (value.kind == Kind::String) {
        long long bound = 0;
        if (SchemaInteger(FindObject(schema, L"minLength"), bound) && (bound < 0 || value.text.size() < static_cast<size_t>(bound))) return SchemaFailure(error, path, L"文本长度小于 minLength");
        if (SchemaInteger(FindObject(schema, L"maxLength"), bound) && (bound < 0 || value.text.size() > static_cast<size_t>(bound))) return SchemaFailure(error, path, L"文本长度大于 maxLength");
        if (const Value* pattern = FindObject(schema, L"pattern")) {
            if (pattern->kind != Kind::String) return SchemaFailure(error, path, L"pattern 必须是文本");
            try { if (!std::regex_search(value.text, std::wregex(pattern->text))) return SchemaFailure(error, path, L"文本不匹配 pattern"); }
            catch (...) { return SchemaFailure(error, path, L"pattern 不是有效的 ECMAScript 正则表达式"); }
        }
    }

    if (value.kind == Kind::Number) {
        double number = 0.0, bound = 0.0;
        if (!AsDouble(value, number)) return SchemaFailure(error, path, L"数字超出双精度安全范围");
        if (SchemaNumber(FindObject(schema, L"minimum"), bound) && number < bound) return SchemaFailure(error, path, L"数字小于 minimum");
        if (SchemaNumber(FindObject(schema, L"maximum"), bound) && number > bound) return SchemaFailure(error, path, L"数字大于 maximum");
        if (SchemaNumber(FindObject(schema, L"exclusiveMinimum"), bound) && number <= bound) return SchemaFailure(error, path, L"数字不大于 exclusiveMinimum");
        if (SchemaNumber(FindObject(schema, L"exclusiveMaximum"), bound) && number >= bound) return SchemaFailure(error, path, L"数字不小于 exclusiveMaximum");
        if (SchemaNumber(FindObject(schema, L"multipleOf"), bound)) {
            if (bound <= 0.0 || std::fabs(std::round(number / bound) * bound - number) > 1e-12 * (std::max)(1.0, std::fabs(number))) return SchemaFailure(error, path, L"数字不符合 multipleOf");
        }
    }
    return true;
}
}

bool JSON_是否有效(const wchar_t* json) {
    LingBuilderJson::ClearError();
    LingBuilderJson::Value value;
    return LingBuilderJson::ParseText(LB_Wide(json), value);
}

const wchar_t* JSON_转义文本(const wchar_t* text) {
    LingBuilderJson::ClearError();
    std::wstring output;
    LingBuilderJson::AppendEscaped(LB_Wide(text), output);
    return LB_ReturnText(std::move(output));
}

const wchar_t* JSON_反转义文本(const wchar_t* escaped) {
    LingBuilderJson::ClearError();
    LingBuilderJson::Value value;
    if (!LingBuilderJson::ParseText(L"\"" + LB_Wide(escaped) + L"\"", value) || value.kind != LingBuilderJson::Kind::String) return LB_ReturnText(L"");
    return LB_ReturnText(std::move(value.text));
}

long long JSON_解析(const wchar_t* json) {
    LingBuilderJson::ClearError();
    LingBuilderJson::Value value;
    return LingBuilderJson::ParseText(LB_Wide(json), value) ? LingBuilderJson::Store(std::move(value)) : 0;
}

const wchar_t* JSON_序列化(long long valueHandle) {
    LingBuilderJson::ClearError();
    LingBuilderJson::Value value;
    if (!LingBuilderJson::Load(valueHandle, value)) return LB_ReturnText(L"");
    return LB_ReturnText(LingBuilderJson::SerializeText(value, -1));
}

const wchar_t* JSON_序列化格式化(long long valueHandle, int indent) {
    LingBuilderJson::ClearError();
    if (indent < 0 || indent > 16) { LingBuilderJson::SetError(L"JSON 缩进必须在 0 到 16 之间。"); return LB_ReturnText(L""); }
    LingBuilderJson::Value value;
    if (!LingBuilderJson::Load(valueHandle, value)) return LB_ReturnText(L"");
    return LB_ReturnText(LingBuilderJson::SerializeText(value, indent));
}

const wchar_t* JSON_格式化文本(const wchar_t* json, int indent) {
    LingBuilderJson::ClearError();
    if (indent < 0 || indent > 16) { LingBuilderJson::SetError(L"JSON 缩进必须在 0 到 16 之间。"); return LB_ReturnText(L""); }
    LingBuilderJson::Value value;
    if (!LingBuilderJson::ParseText(LB_Wide(json), value)) return LB_ReturnText(L"");
    return LB_ReturnText(LingBuilderJson::SerializeText(value, indent));
}

const wchar_t* JSON_压缩文本(const wchar_t* json) {
    LingBuilderJson::ClearError();
    LingBuilderJson::Value value;
    if (!LingBuilderJson::ParseText(LB_Wide(json), value)) return LB_ReturnText(L"");
    return LB_ReturnText(LingBuilderJson::SerializeText(value, -1));
}

const wchar_t* JSON_取最后错误() { return LB_ReturnText(LingBuilderJson::g_lastError); }

long long JSON_克隆(long long valueHandle) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value value;
    return LingBuilderJson::Load(valueHandle, value) ? LingBuilderJson::Store(std::move(value)) : 0;
}

bool JSON_释放(long long valueHandle) { LingBuilderJson::ClearError(); if (LingBuilderJson::Release(valueHandle)) return true; if (LingBuilderJson::g_lastError.empty()) LingBuilderJson::SetError(L"JSON值已经释放或不存在。"); return false; }

const wchar_t* JSON_取类型(long long valueHandle) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value value;
    if (!LingBuilderJson::Load(valueHandle, value)) return LB_ReturnText(L"");
    switch (value.kind) {
        case LingBuilderJson::Kind::Null: return L"空";
        case LingBuilderJson::Kind::Boolean: return L"逻辑";
        case LingBuilderJson::Kind::Number: return LingBuilderJson::IsInteger(value) ? L"整数" : L"数字";
        case LingBuilderJson::Kind::String: return L"文本";
        case LingBuilderJson::Kind::Array: return L"数组";
        case LingBuilderJson::Kind::Object: return L"对象";
    }
    return L"";
}

bool JSON_是否对象(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Object; }
bool JSON_是否数组(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Array; }
bool JSON_是否文本(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::String; }
bool JSON_是否数字(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Number; }
bool JSON_是否逻辑(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Boolean; }
bool JSON_是否空(long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Null; }

long long JSON_创建对象() { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeObject()); }
long long JSON_创建数组() { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeArray()); }
long long JSON_创建空() { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeNull()); }
long long JSON_创建文本(const wchar_t* value) { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeString(LB_Wide(value))); }
long long JSON_创建整数(int value) { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeNumber(std::to_wstring(value))); }
long long JSON_创建长整数(long long value) { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeNumber(std::to_wstring(value))); }
long long JSON_创建小数(double value) {
    LingBuilderJson::ClearError();
    if (!std::isfinite(value)) { LingBuilderJson::SetError(L"JSON 不支持 NaN 或无穷大。"); return 0; }
    std::wostringstream output; output.imbue(std::locale::classic()); output << std::setprecision(17) << value;
    return LingBuilderJson::Store(LingBuilderJson::Value::MakeNumber(output.str()));
}
long long JSON_创建逻辑(bool value) { LingBuilderJson::ClearError(); return LingBuilderJson::Store(LingBuilderJson::Value::MakeBoolean(value)); }

const wchar_t* JSON_取文本值(long long valueHandle, const wchar_t* fallback) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value value;
    return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::String ? LB_ReturnText(value.text) : LB_ReturnText(LB_Wide(fallback));
}
int JSON_取整数值(long long valueHandle, int fallback) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value value; long long result = 0;
    return LingBuilderJson::Load(valueHandle, value) && LingBuilderJson::AsLongLong(value, result) && result >= (std::numeric_limits<int>::min)() && result <= (std::numeric_limits<int>::max)() ? static_cast<int>(result) : fallback;
}
long long JSON_取长整数值(long long valueHandle, long long fallback) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; long long result = 0; return LingBuilderJson::Load(valueHandle, value) && LingBuilderJson::AsLongLong(value, result) ? result : fallback; }
double JSON_取小数值(long long valueHandle, double fallback) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; double result = 0.0; return LingBuilderJson::Load(valueHandle, value) && LingBuilderJson::AsDouble(value, result) ? result : fallback; }
bool JSON_取逻辑值(long long valueHandle, bool fallback) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; return LingBuilderJson::Load(valueHandle, value) && value.kind == LingBuilderJson::Kind::Boolean ? value.boolean : fallback; }

int JSON_对象_数量(long long objectHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; if (!LingBuilderJson::Load(objectHandle, object) || object.kind != LingBuilderJson::Kind::Object) return -1; return object.object.size() > static_cast<size_t>((std::numeric_limits<int>::max)()) ? (std::numeric_limits<int>::max)() : static_cast<int>(object.object.size()); }
bool JSON_对象_是否包含(long long objectHandle, const wchar_t* key) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; return LingBuilderJson::Load(objectHandle, object) && LingBuilderJson::FindObject(object, LB_Wide(key)); }
long long JSON_对象_取(long long objectHandle, const wchar_t* key) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; if (!LingBuilderJson::Load(objectHandle, object)) return 0; const LingBuilderJson::Value* item = LingBuilderJson::FindObject(object, LB_Wide(key)); if (!item) { LingBuilderJson::SetError(L"JSON 对象键不存在。"); return 0; } return LingBuilderJson::Store(*item); }
bool JSON_对象_设置(long long objectHandle, const wchar_t* key, long long valueHandle) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value object, value;
    if (!LingBuilderJson::Load(objectHandle, object) || !LingBuilderJson::Load(valueHandle, value)) return false;
    if (object.kind != LingBuilderJson::Kind::Object) { LingBuilderJson::SetError(L"目标 JSON值不是对象。"); return false; }
    LingBuilderJson::SetObject(object, LB_Wide(key), std::move(value)); return LingBuilderJson::Replace(objectHandle, std::move(object));
}
bool JSON_对象_移除(long long objectHandle, const wchar_t* key) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; if (!LingBuilderJson::Load(objectHandle, object)) return false; if (!LingBuilderJson::RemoveObject(object, LB_Wide(key))) { LingBuilderJson::SetError(L"JSON 对象键不存在或目标不是对象。"); return false; } return LingBuilderJson::Replace(objectHandle, std::move(object)); }
bool JSON_对象_清空(long long objectHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; if (!LingBuilderJson::Load(objectHandle, object)) return false; if (object.kind != LingBuilderJson::Kind::Object) { LingBuilderJson::SetError(L"目标 JSON值不是对象。"); return false; } object.object.clear(); return LingBuilderJson::Replace(objectHandle, std::move(object)); }
const wchar_t* JSON_对象_键列表(long long objectHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value object; if (!LingBuilderJson::Load(objectHandle, object) || object.kind != LingBuilderJson::Kind::Object) return LB_ReturnText(L""); LingBuilderJson::Value keys = LingBuilderJson::Value::MakeArray(); for (const auto& item : object.object) keys.array.push_back(LingBuilderJson::Value::MakeString(item.first)); return LB_ReturnText(LingBuilderJson::SerializeText(keys, -1)); }

int JSON_数组_数量(long long arrayHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value array; if (!LingBuilderJson::Load(arrayHandle, array) || array.kind != LingBuilderJson::Kind::Array) return -1; return array.array.size() > static_cast<size_t>((std::numeric_limits<int>::max)()) ? (std::numeric_limits<int>::max)() : static_cast<int>(array.array.size()); }
long long JSON_数组_取(long long arrayHandle, int index) { LingBuilderJson::ClearError(); LingBuilderJson::Value array; if (!LingBuilderJson::Load(arrayHandle, array) || array.kind != LingBuilderJson::Kind::Array || index < 0 || static_cast<size_t>(index) >= array.array.size()) { LingBuilderJson::SetError(L"JSON 数组索引无效。"); return 0; } return LingBuilderJson::Store(array.array[static_cast<size_t>(index)]); }
bool JSON_数组_添加(long long arrayHandle, long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value array, value; if (!LingBuilderJson::Load(arrayHandle, array) || !LingBuilderJson::Load(valueHandle, value)) return false; if (array.kind != LingBuilderJson::Kind::Array) { LingBuilderJson::SetError(L"目标 JSON值不是数组。"); return false; } array.array.push_back(std::move(value)); return LingBuilderJson::Replace(arrayHandle, std::move(array)); }
bool JSON_数组_插入(long long arrayHandle, int index, long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value array, value; if (!LingBuilderJson::Load(arrayHandle, array) || !LingBuilderJson::Load(valueHandle, value)) return false; if (array.kind != LingBuilderJson::Kind::Array || index < 0 || static_cast<size_t>(index) > array.array.size()) { LingBuilderJson::SetError(L"JSON 数组插入索引无效。"); return false; } array.array.insert(array.array.begin() + index, std::move(value)); return LingBuilderJson::Replace(arrayHandle, std::move(array)); }
bool JSON_数组_设置(long long arrayHandle, int index, long long valueHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value array, value; if (!LingBuilderJson::Load(arrayHandle, array) || !LingBuilderJson::Load(valueHandle, value)) return false; if (array.kind != LingBuilderJson::Kind::Array || index < 0 || static_cast<size_t>(index) >= array.array.size()) { LingBuilderJson::SetError(L"JSON 数组索引无效。"); return false; } array.array[static_cast<size_t>(index)] = std::move(value); return LingBuilderJson::Replace(arrayHandle, std::move(array)); }
bool JSON_数组_移除(long long arrayHandle, int index) { LingBuilderJson::ClearError(); LingBuilderJson::Value array; if (!LingBuilderJson::Load(arrayHandle, array)) return false; if (array.kind != LingBuilderJson::Kind::Array || index < 0 || static_cast<size_t>(index) >= array.array.size()) { LingBuilderJson::SetError(L"JSON 数组索引无效。"); return false; } array.array.erase(array.array.begin() + index); return LingBuilderJson::Replace(arrayHandle, std::move(array)); }
bool JSON_数组_清空(long long arrayHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value array; if (!LingBuilderJson::Load(arrayHandle, array)) return false; if (array.kind != LingBuilderJson::Kind::Array) { LingBuilderJson::SetError(L"目标 JSON值不是数组。"); return false; } array.array.clear(); return LingBuilderJson::Replace(arrayHandle, std::move(array)); }

long long JSON_指针_取(long long valueHandle, const wchar_t* pointer) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; std::vector<std::wstring> tokens; if (!LingBuilderJson::Load(valueHandle, value) || !LingBuilderJson::DecodePointer(LB_Wide(pointer), tokens)) return 0; const LingBuilderJson::Value* item = LingBuilderJson::ResolvePointer(value, tokens); if (!item) { LingBuilderJson::SetError(L"JSON Pointer 未找到对应值。"); return 0; } return LingBuilderJson::Store(*item); }
bool JSON_指针_设置(long long valueHandle, const wchar_t* pointer, long long replacementHandle, bool createIntermediate) { LingBuilderJson::ClearError(); LingBuilderJson::Value value, replacement; std::vector<std::wstring> tokens; if (!LingBuilderJson::Load(valueHandle, value) || !LingBuilderJson::Load(replacementHandle, replacement) || !LingBuilderJson::DecodePointer(LB_Wide(pointer), tokens)) return false; return LingBuilderJson::SetPointer(value, tokens, std::move(replacement), createIntermediate) && LingBuilderJson::Replace(valueHandle, std::move(value)); }
bool JSON_指针_移除(long long valueHandle, const wchar_t* pointer) { LingBuilderJson::ClearError(); LingBuilderJson::Value value; std::vector<std::wstring> tokens; if (!LingBuilderJson::Load(valueHandle, value) || !LingBuilderJson::DecodePointer(LB_Wide(pointer), tokens)) return false; return LingBuilderJson::RemovePointer(value, tokens) && LingBuilderJson::Replace(valueHandle, std::move(value)); }

bool JSON_合并补丁(long long targetHandle, const wchar_t* patchText) { LingBuilderJson::ClearError(); LingBuilderJson::Value target, patch; if (!LingBuilderJson::Load(targetHandle, target) || !LingBuilderJson::ParseText(LB_Wide(patchText), patch)) return false; LingBuilderJson::MergePatch(target, patch); return LingBuilderJson::Replace(targetHandle, std::move(target)); }

bool JSON_应用补丁(long long targetHandle, const wchar_t* patchText) {
    LingBuilderJson::ClearError(); LingBuilderJson::Value target, patch;
    if (!LingBuilderJson::Load(targetHandle, target) || !LingBuilderJson::ParseText(LB_Wide(patchText), patch)) return false;
    if (patch.kind != LingBuilderJson::Kind::Array) { LingBuilderJson::SetError(L"JSON Patch 根值必须是数组。"); return false; }
    for (size_t index = 0; index < patch.array.size(); ++index) {
        const LingBuilderJson::Value& operation = patch.array[index];
        const LingBuilderJson::Value* op = LingBuilderJson::FindObject(operation, L"op");
        const LingBuilderJson::Value* path = LingBuilderJson::FindObject(operation, L"path");
        if (operation.kind != LingBuilderJson::Kind::Object || !op || !path || op->kind != LingBuilderJson::Kind::String || path->kind != LingBuilderJson::Kind::String) { LingBuilderJson::SetError(L"JSON Patch 第 " + std::to_wstring(index + 1) + L" 项缺少 op 或 path。"); return false; }
        std::vector<std::wstring> pathTokens;
        if (!LingBuilderJson::DecodePointer(path->text, pathTokens)) return false;
        const LingBuilderJson::Value* value = LingBuilderJson::FindObject(operation, L"value");
        bool applied = false;
        if (op->text == L"add") applied = value && LingBuilderJson::AddPointer(target, pathTokens, *value);
        else if (op->text == L"remove") applied = LingBuilderJson::RemovePointer(target, pathTokens);
        else if (op->text == L"replace") { applied = value && LingBuilderJson::ResolvePointer(target, pathTokens) && LingBuilderJson::SetPointer(target, pathTokens, *value, false); }
        else if (op->text == L"copy" || op->text == L"move") {
            const LingBuilderJson::Value* from = LingBuilderJson::FindObject(operation, L"from");
            std::vector<std::wstring> fromTokens;
            if (from && from->kind == LingBuilderJson::Kind::String && LingBuilderJson::DecodePointer(from->text, fromTokens)) {
                const LingBuilderJson::Value* source = LingBuilderJson::ResolvePointer(target, fromTokens);
                if (source) { LingBuilderJson::Value copied = *source; applied = op->text == L"move" ? LingBuilderJson::RemovePointer(target, fromTokens) && LingBuilderJson::AddPointer(target, pathTokens, std::move(copied)) : LingBuilderJson::AddPointer(target, pathTokens, std::move(copied)); }
            }
        } else if (op->text == L"test") { const LingBuilderJson::Value* actual = LingBuilderJson::ResolvePointer(target, pathTokens); applied = value && actual && LingBuilderJson::Equal(*actual, *value); }
        else { LingBuilderJson::SetError(L"JSON Patch 使用了不支持的操作：" + op->text); return false; }
        if (!applied) { if (LingBuilderJson::g_lastError.empty()) LingBuilderJson::SetError(L"JSON Patch 第 " + std::to_wstring(index + 1) + L" 项无法应用。"); return false; }
    }
    return LingBuilderJson::Replace(targetHandle, std::move(target));
}

const wchar_t* JSON_生成补丁(long long sourceHandle, long long targetHandle) { LingBuilderJson::ClearError(); LingBuilderJson::Value source, target; if (!LingBuilderJson::Load(sourceHandle, source) || !LingBuilderJson::Load(targetHandle, target)) return LB_ReturnText(L""); LingBuilderJson::Value patch = LingBuilderJson::Value::MakeArray(); LingBuilderJson::BuildDiff(source, target, L"", patch.array); return LB_ReturnText(LingBuilderJson::SerializeText(patch, -1)); }

bool JSON_Schema验证(long long valueHandle, const wchar_t* schemaText) { LingBuilderJson::ClearError(); LingBuilderJson::Value value, schema; if (!LingBuilderJson::Load(valueHandle, value) || !LingBuilderJson::ParseText(LB_Wide(schemaText), schema)) return false; std::wstring error; const bool valid = LingBuilderJson::ValidateSchema(value, schema, L"", error); if (!valid) LingBuilderJson::SetError(error); return valid; }

const wchar_t* JSON_取文本(const wchar_t* json, const wchar_t* field) { LingBuilderJson::ClearError(); LingBuilderJson::Value root; if (!LingBuilderJson::ParseText(LB_Wide(json), root)) return LB_ReturnText(L""); const LingBuilderJson::Value* value = LingBuilderJson::FindObject(root, LB_Wide(field)); return value && value->kind == LingBuilderJson::Kind::String ? LB_ReturnText(value->text) : LB_ReturnText(L""); }
int JSON_取整数(const wchar_t* json, const wchar_t* field, int fallback) { LingBuilderJson::ClearError(); LingBuilderJson::Value root; long long value = 0; if (!LingBuilderJson::ParseText(LB_Wide(json), root)) return fallback; const LingBuilderJson::Value* item = LingBuilderJson::FindObject(root, LB_Wide(field)); return item && LingBuilderJson::AsLongLong(*item, value) && value >= (std::numeric_limits<int>::min)() && value <= (std::numeric_limits<int>::max)() ? static_cast<int>(value) : fallback; }
bool JSON_取逻辑(const wchar_t* json, const wchar_t* field, bool fallback) { LingBuilderJson::ClearError(); LingBuilderJson::Value root; if (!LingBuilderJson::ParseText(LB_Wide(json), root)) return fallback; const LingBuilderJson::Value* value = LingBuilderJson::FindObject(root, LB_Wide(field)); return value && value->kind == LingBuilderJson::Kind::Boolean ? value->boolean : fallback; }
`;
