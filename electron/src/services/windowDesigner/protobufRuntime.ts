import type { InstalledModule } from '../modules/types';

const PROTOBUF_MODULE_ID = 'lingbuilder.data.protobuf';

/**
 * Reflection-only Protobuf runtime. The generated LingCpp code keeps message
 * fields opaque and exchanges binary data as vector<unsigned char>; the C ABI
 * helpers below document the same pointer-plus-length ownership boundary used
 * by external bridges.
 */
const PROTOBUF_RUNTIME = String.raw`
// ==== 通用错误状态与无 schema wire 编解码（2026-09-27）====
// 不依赖 protobuf SDK：抓包逆向场景（没有 .proto）在 SDK 缺失时同样可用。
static thread_local std::wstring g_lbProtoLastError;
static void LB_ProtoSetError(const std::string& value) { g_lbProtoLastError = LB_Utf8ToWide(value); }
static void LB_ProtoSetError(const wchar_t* value) { g_lbProtoLastError = value ? value : L""; }
const wchar_t* PB_取最后错误() { return LB_ReturnText(g_lbProtoLastError); }

static const unsigned long long LB_PB_MAX_FIELD_NUMBER = 536870911ULL;

static bool LB_PBValidFieldNumber(int fieldNumber) {
    if (fieldNumber < 1 || static_cast<unsigned long long>(fieldNumber) > LB_PB_MAX_FIELD_NUMBER) {
        LB_ProtoSetError(L"字段号必须在 1 到 536870911 之间。");
        return false;
    }
    return true;
}

static void LB_PBWriteVarint(std::vector<unsigned char>& out, unsigned long long value) {
    while (value >= 0x80ULL) {
        out.push_back(static_cast<unsigned char>((value & 0x7FULL) | 0x80ULL));
        value >>= 7;
    }
    out.push_back(static_cast<unsigned char>(value));
}

static bool LB_PBReadVarint(const std::vector<unsigned char>& data, size_t& pos, unsigned long long& value) {
    value = 0;
    for (int index = 0; index < 10; ++index) {
        if (pos >= data.size()) { LB_ProtoSetError(L"varint 不完整：数据被截断。"); return false; }
        const unsigned char byte = data[pos++];
        if (index == 9) {
            if ((byte & 0x80) != 0) { LB_ProtoSetError(L"varint 超过 10 字节上限。"); return false; }
            value |= static_cast<unsigned long long>(byte & 0x01) << 63;
            return true;
        }
        value |= static_cast<unsigned long long>(byte & 0x7F) << (7 * index);
        if ((byte & 0x80) == 0) return true;
    }
    LB_ProtoSetError(L"varint 解析失败。");
    return false;
}

static std::vector<unsigned char> LB_PBFixedPayload(unsigned long long value, int wireSize) {
    std::vector<unsigned char> out;
    for (int index = 0; index < wireSize; ++index) out.push_back(static_cast<unsigned char>((value >> (8 * index)) & 0xFFu));
    return out;
}

struct LB_PBWireField {
    int fieldNumber = 0;
    int wireType = 0;
    unsigned long long varint = 0;
    std::vector<unsigned char> payload;
};

static bool LB_PBReadField(const std::vector<unsigned char>& data, size_t& pos, LB_PBWireField& field) {
    unsigned long long key = 0;
    if (!LB_PBReadVarint(data, pos, key)) return false;
    field.fieldNumber = static_cast<int>(key >> 3);
    field.wireType = static_cast<int>(key & 7ULL);
    field.varint = 0;
    field.payload.clear();
    if (!LB_PBValidFieldNumber(field.fieldNumber)) {
        LB_ProtoSetError(L"字段键超出范围：字段号必须在 1 到 536870911 之间。");
        return false;
    }
    switch (field.wireType) {
        case 0:
            return LB_PBReadVarint(data, pos, field.varint);
        case 1: {
            if (pos + 8 > data.size()) { LB_ProtoSetError(L"fixed64 字段（wire 1）被截断。"); return false; }
            unsigned long long value = 0;
            for (int index = 7; index >= 0; --index) value = (value << 8) | data[pos + static_cast<size_t>(index)];
            pos += 8;
            field.varint = value;
            return true;
        }
        case 2: {
            unsigned long long length = 0;
            if (!LB_PBReadVarint(data, pos, length)) return false;
            if (length > static_cast<unsigned long long>(data.size() - pos)) { LB_ProtoSetError(L"长度分隔字段（wire 2）被截断：声明长度超过剩余字节。"); return false; }
            field.payload.assign(data.begin() + static_cast<std::ptrdiff_t>(pos), data.begin() + static_cast<std::ptrdiff_t>(pos + length));
            pos += static_cast<size_t>(length);
            return true;
        }
        case 5: {
            if (pos + 4 > data.size()) { LB_ProtoSetError(L"fixed32 字段（wire 5）被截断。"); return false; }
            unsigned long long value = 0;
            for (int index = 3; index >= 0; --index) value = (value << 8) | data[pos + static_cast<size_t>(index)];
            pos += 4;
            field.varint = value;
            return true;
        }
        default:
            LB_ProtoSetError(L"不支持已废弃的组线型（wire 3/4）或未知线型。");
            return false;
    }
}

std::vector<unsigned char> PB_写字段_varint(const std::vector<unsigned char>& data, int fieldNumber, long long value) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return {};
    std::vector<unsigned char> out = data;
    LB_PBWriteVarint(out, (static_cast<unsigned long long>(fieldNumber) << 3) | 0ULL);
    LB_PBWriteVarint(out, static_cast<unsigned long long>(value));
    return out;
}

std::vector<unsigned char> PB_写字段_固定32(const std::vector<unsigned char>& data, int fieldNumber, int value) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return {};
    std::vector<unsigned char> out = data;
    LB_PBWriteVarint(out, (static_cast<unsigned long long>(fieldNumber) << 3) | 5ULL);
    const std::vector<unsigned char> payload = LB_PBFixedPayload(static_cast<unsigned int>(value), 4);
    out.insert(out.end(), payload.begin(), payload.end());
    return out;
}

std::vector<unsigned char> PB_写字段_固定64(const std::vector<unsigned char>& data, int fieldNumber, long long value) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return {};
    std::vector<unsigned char> out = data;
    LB_PBWriteVarint(out, (static_cast<unsigned long long>(fieldNumber) << 3) | 1ULL);
    const std::vector<unsigned char> payload = LB_PBFixedPayload(static_cast<unsigned long long>(value), 8);
    out.insert(out.end(), payload.begin(), payload.end());
    return out;
}

static std::vector<unsigned char> PB_写字段_长度分隔(const std::vector<unsigned char>& data, int fieldNumber, const std::vector<unsigned char>& payload) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return {};
    std::vector<unsigned char> out = data;
    LB_PBWriteVarint(out, (static_cast<unsigned long long>(fieldNumber) << 3) | 2ULL);
    LB_PBWriteVarint(out, payload.size());
    out.insert(out.end(), payload.begin(), payload.end());
    return out;
}

std::vector<unsigned char> PB_写字段_字节集(const std::vector<unsigned char>& data, int fieldNumber, const std::vector<unsigned char>& value) { return PB_写字段_长度分隔(data, fieldNumber, value); }
std::vector<unsigned char> PB_写字段_嵌套(const std::vector<unsigned char>& data, int fieldNumber, const std::vector<unsigned char>& childMessage) { return PB_写字段_长度分隔(data, fieldNumber, childMessage); }
std::vector<unsigned char> PB_写字段_文本(const std::vector<unsigned char>& data, int fieldNumber, const wchar_t* text) {
    const std::string utf8 = LingCppWideToUtf8(text ? text : L"");
    const std::vector<unsigned char> payload(utf8.begin(), utf8.end());
    return PB_写字段_长度分隔(data, fieldNumber, payload);
}

long long PB_取字段_varint(const std::vector<unsigned char>& data, int fieldNumber) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return 0;
    size_t pos = 0;
    while (pos < data.size()) {
        LB_PBWireField field;
        if (!LB_PBReadField(data, pos, field)) return 0;
        if (field.fieldNumber != fieldNumber) continue;
        if (field.wireType == 2) { LB_ProtoSetError(L"该字段是长度分隔类型（wire 2），请改用 PB_取字段_字节集。"); return 0; }
        return static_cast<long long>(field.varint);
    }
    LB_ProtoSetError(L"数据中不存在指定字段。");
    return 0;
}

std::vector<unsigned char> PB_取字段_字节集(const std::vector<unsigned char>& data, int fieldNumber) {
    g_lbProtoLastError.clear();
    if (!LB_PBValidFieldNumber(fieldNumber)) return {};
    size_t pos = 0;
    while (pos < data.size()) {
        LB_PBWireField field;
        if (!LB_PBReadField(data, pos, field)) return {};
        if (field.fieldNumber != fieldNumber) continue;
        if (field.wireType != 2) { LB_ProtoSetError(L"该字段是数值类型（wire 0/1/5），请改用 PB_取字段_varint。"); return {}; }
        return field.payload;
    }
    LB_ProtoSetError(L"数据中不存在指定字段。");
    return {};
}

static std::wstring LB_PBHexEncode(const std::vector<unsigned char>& bytes) {
    static const wchar_t digits[] = L"0123456789ABCDEF";
    std::wstring out;
    out.reserve(bytes.size() * 2);
    for (unsigned char byte : bytes) {
        out.push_back(digits[(byte >> 4) & 0xF]);
        out.push_back(digits[byte & 0xF]);
    }
    return out;
}

static void LB_PBAppendJsonString(std::wstring& out, const std::wstring& value) {
    static const wchar_t digits[] = L"0123456789abcdef";
    out.push_back(L'"');
    for (wchar_t ch : value) {
        if (ch == L'"') { out += L"\\\""; continue; }
        if (ch == L'\\') { out += L"\\\\"; continue; }
        if (ch == L'\n') { out += L"\\n"; continue; }
        if (ch == L'\r') { out += L"\\r"; continue; }
        if (ch == L'\t') { out += L"\\t"; continue; }
        if (ch >= 0x20) { out.push_back(ch); continue; }
        out += L"\\u00";
        out.push_back(digits[(ch >> 4) & 0xF]);
        out.push_back(digits[ch & 0xF]);
    }
    out.push_back(L'"');
}

static bool LB_PBUtf8StrictToWide(const std::string& input, std::wstring& text) {
    text.clear();
    if (input.empty()) return true;
    const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), nullptr, 0);
    if (size <= 0) return false;
    text.resize(static_cast<size_t>(size));
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), text.data(), size) != size) { text.clear(); return false; }
    return true;
}

static bool LB_PBPrintableText(const std::wstring& text) {
    for (wchar_t ch : text) {
        if (ch == L'\t' || ch == L'\r' || ch == L'\n') continue;
        if (ch < 0x20) return false;
    }
    return true;
}

const wchar_t* PB_字段信息JSON(const std::vector<unsigned char>& data) {
    g_lbProtoLastError.clear();
    std::wstring json = L"[";
    size_t pos = 0;
    bool first = true;
    while (pos < data.size()) {
        LB_PBWireField field;
        if (!LB_PBReadField(data, pos, field)) return LB_ReturnText(L"");
        if (!first) json += L",";
        first = false;
        json += L"{\"字段号\":" + std::to_wstring(field.fieldNumber);
        json += L",\"wire\":" + std::to_wstring(field.wireType);
        json += L",\"varint\":" + std::to_wstring(static_cast<long long>(field.varint));
        if (field.wireType == 2) {
            json += L",\"hex\":\"" + LB_PBHexEncode(field.payload) + L"\"";
            const std::string utf8(field.payload.begin(), field.payload.end());
            std::wstring text;
            if (LB_PBUtf8StrictToWide(utf8, text) && LB_PBPrintableText(text)) {
                json += L",\"utf8\":";
                LB_PBAppendJsonString(json, text);
            } else {
                json += L",\"utf8\":\"\"";
            }
        } else {
            std::vector<unsigned char> raw;
            if (field.wireType == 1) raw = LB_PBFixedPayload(field.varint, 8);
            else if (field.wireType == 5) raw = LB_PBFixedPayload(field.varint, 4);
            else LB_PBWriteVarint(raw, field.varint);
            json += L",\"hex\":\"" + LB_PBHexEncode(raw) + L"\",\"utf8\":\"\"";
        }
        json += L"}";
    }
    json += L"]";
    return LB_ReturnText(std::move(json));
}

static const int LB_PB_TREE_MAX_DEPTH = 32;

static bool LB_PBTryParseAllFields(const std::vector<unsigned char>& data, std::vector<LB_PBWireField>& fields) {
    fields.clear();
    if (data.empty()) return false;
    size_t pos = 0;
    while (pos < data.size()) {
        LB_PBWireField field;
        if (!LB_PBReadField(data, pos, field)) return false;
        fields.push_back(field);
    }
    return true;
}

static void LB_PBAppendTreeValue(std::wstring& out, const LB_PBWireField& field) {
    if (field.wireType == 0) {
        const long long signedValue = static_cast<long long>(field.varint);
        out += std::to_wstring(signedValue);
        if (signedValue < 0) {
            out += L"（无符号 ";
            out += std::to_wstring(field.varint);
            out += L"）";
        }
        return;
    }
    const std::vector<unsigned char> raw = LB_PBFixedPayload(field.varint, field.wireType == 1 ? 8 : 4);
    out += L"0x" + LB_PBHexEncode(raw);
}

static void LB_PBAppendTree(std::wstring& out, const std::vector<unsigned char>& data, int depth, int spaces) {
    std::vector<LB_PBWireField> fields;
    if (!LB_PBTryParseAllFields(data, fields) || depth >= LB_PB_TREE_MAX_DEPTH) {
        const std::string utf8(data.begin(), data.end());
        std::wstring text;
        if (LB_PBUtf8StrictToWide(utf8, text) && LB_PBPrintableText(text)) {
            LB_PBAppendJsonString(out, text);
        } else {
            out += LB_PBHexEncode(data);
        }
        return;
    }
    for (const LB_PBWireField& field : fields) {
        out += L"\n";
        for (int index = 0; index < depth * spaces; ++index) out.push_back(L' ');
        out += L"字段" + std::to_wstring(field.fieldNumber) + L"(wire" + std::to_wstring(field.wireType) + L"): ";
        if (field.wireType == 2) LB_PBAppendTree(out, field.payload, depth + 1, spaces);
        else LB_PBAppendTreeValue(out, field);
    }
}

const wchar_t* PB_字节集转文本树(const std::vector<unsigned char>& data, int indent) {
    g_lbProtoLastError.clear();
    if (data.empty()) return LB_ReturnText(L"（空字节集）");
    const int spaces = indent >= 1 && indent <= 8 ? indent : 2;
    std::vector<LB_PBWireField> probe;
    if (!LB_PBTryParseAllFields(data, probe)) {
        return LB_ReturnText(L"[非法] " + g_lbProtoLastError);
    }
    std::wstring out;
    LB_PBAppendTree(out, data, 0, spaces);
    return LB_ReturnText(std::move(out));
}

const wchar_t* PB_导出Proto草稿(const std::vector<unsigned char>& data) {
    g_lbProtoLastError.clear();
    if (data.empty()) { LB_ProtoSetError(L"数据为空，无法推断字段。"); return LB_ReturnText(L""); }
    struct LB_PBDraftEntry { int fieldNumber = 0; unsigned mask = 0; long long counts[8] = {}; };
    std::vector<LB_PBDraftEntry> entries;
    size_t pos = 0;
    while (pos < data.size()) {
        LB_PBWireField field;
        if (!LB_PBReadField(data, pos, field)) return LB_ReturnText(L"");
        LB_PBDraftEntry* entry = nullptr;
        for (LB_PBDraftEntry& item : entries) {
            if (item.fieldNumber == field.fieldNumber) { entry = &item; break; }
        }
        if (!entry) {
            LB_PBDraftEntry fresh;
            fresh.fieldNumber = field.fieldNumber;
            entries.push_back(fresh);
            entry = &entries.back();
        }
        if (field.wireType >= 0 && field.wireType < 8) {
            entry->mask |= (1u << field.wireType);
            entry->counts[field.wireType] += 1;
        }
    }
    std::sort(entries.begin(), entries.end(), [](const LB_PBDraftEntry& left, const LB_PBDraftEntry& right) { return left.fieldNumber < right.fieldNumber; });
    std::wstring out = L"syntax = \"proto3\";\n";
    out += L"// LingBuilder PB_导出Proto草稿：按观察到的字段号与线型推断，仅供人工判读；\n";
    out += L"// wire2 字段可能为 string 或嵌套消息（用 PB_字节集转文本树 判读），数值宽度可能与实际语义不符。\n";
    out += L"message InferredMessage {\n";
    for (const LB_PBDraftEntry& entry : entries) {
        const wchar_t* typeName = L"int64";
        const wchar_t* wireNote = L"varint";
        if (entry.mask & (1u << 0)) { typeName = L"int64"; wireNote = L"varint"; }
        else if (entry.mask & (1u << 1)) { typeName = L"fixed64"; wireNote = L"wire1"; }
        else if (entry.mask & (1u << 5)) { typeName = L"fixed32"; wireNote = L"wire5"; }
        else if (entry.mask & (1u << 2)) { typeName = L"bytes"; wireNote = L"wire2"; }
        long long total = 0;
        for (int index = 0; index < 8; ++index) total += entry.counts[index];
        out += L"  " + std::wstring(typeName) + L" f" + std::to_wstring(entry.fieldNumber) + L" = " + std::to_wstring(entry.fieldNumber) + L";";
        out += L"  // " + std::wstring(wireNote) + L"，出现 " + std::to_wstring(total) + L" 次";
        const unsigned seenKinds = (entry.mask & 1u) + ((entry.mask >> 1) & 1u) + ((entry.mask >> 2) & 1u) + ((entry.mask >> 5) & 1u);
        if (seenKinds > 1) out += L"，同一字段出现多种线型需人工确认";
        out += L"\n";
    }
    out += L"}\n";
    return LB_ReturnText(std::move(out));
}

#if LINGBUILDER_PROTOBUF_AVAILABLE
struct LB_ProtoDescriptorSet {
    google::protobuf::DescriptorPool pool;
    google::protobuf::DynamicMessageFactory factory;
    LB_ProtoDescriptorSet() : factory(&pool) {}
};

struct LB_ProtoMessageHandle {
    std::shared_ptr<LB_ProtoDescriptorSet> descriptors;
    std::unique_ptr<google::protobuf::Message> message;
};

static std::mutex g_lbProtoMutex;
static std::unordered_map<UINT_PTR, std::shared_ptr<LB_ProtoDescriptorSet>> g_lbProtoDescriptors;
static std::unordered_map<UINT_PTR, std::unique_ptr<LB_ProtoMessageHandle>> g_lbProtoMessages;
static UINT_PTR g_lbProtoNextHandle = 1;

static UINT_PTR LB_ProtoNewHandle() {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    for (;;) {
        const UINT_PTR candidate = g_lbProtoNextHandle++;
        if (candidate != 0 && !g_lbProtoDescriptors.count(candidate) && !g_lbProtoMessages.count(candidate)) return candidate;
    }
}

static std::shared_ptr<LB_ProtoDescriptorSet> LB_ProtoGetDescriptors(UINT_PTR handle) {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    const auto found = g_lbProtoDescriptors.find(handle);
    return found == g_lbProtoDescriptors.end() ? nullptr : found->second;
}

static LB_ProtoMessageHandle* LB_ProtoGetMessage(UINT_PTR handle) {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    const auto found = g_lbProtoMessages.find(handle);
    return found == g_lbProtoMessages.end() ? nullptr : found->second.get();
}

UINT_PTR PB_加载描述集(const wchar_t* filePath) {
    g_lbProtoLastError.clear();
    if (!filePath || !filePath[0]) { LB_ProtoSetError(L"描述集路径不能为空。"); return 0; }
    std::ifstream input(std::filesystem::path(filePath), std::ios::binary);
    if (!input) { LB_ProtoSetError(L"无法打开描述集文件。"); return 0; }
    std::string bytes((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    google::protobuf::FileDescriptorSet descriptorSet;
    if (!descriptorSet.ParseFromString(bytes)) { LB_ProtoSetError(L"描述集不是有效的 Protobuf FileDescriptorSet。"); return 0; }
    auto descriptors = std::make_shared<LB_ProtoDescriptorSet>();
    std::vector<bool> built(static_cast<size_t>(descriptorSet.file_size()), false);
    size_t remaining = built.size();
    while (remaining > 0) {
        bool progress = false;
        for (int index = 0; index < descriptorSet.file_size(); ++index) {
            if (built[static_cast<size_t>(index)]) continue;
            const auto* file = descriptors->pool.BuildFile(descriptorSet.file(index));
            if (!file) continue;
            built[static_cast<size_t>(index)] = true;
            --remaining;
            progress = true;
        }
        if (!progress) {
            LB_ProtoSetError(L"描述集中的 import 依赖不完整或存在循环错误。");
            return 0;
        }
    }
    const UINT_PTR handle = LB_ProtoNewHandle();
    {
        std::lock_guard<std::mutex> lock(g_lbProtoMutex);
        g_lbProtoDescriptors.emplace(handle, std::move(descriptors));
    }
    return handle;
}

UINT_PTR PB_创建消息(UINT_PTR descriptorHandle, const wchar_t* typeName) {
    g_lbProtoLastError.clear();
    const auto descriptors = LB_ProtoGetDescriptors(descriptorHandle);
    if (!descriptors || !typeName || !typeName[0]) { LB_ProtoSetError(L"描述集句柄或消息类型名无效。"); return 0; }
    const std::string utf8TypeName = LingCppWideToUtf8(typeName);
    const auto* descriptor = descriptors->pool.FindMessageTypeByName(utf8TypeName);
    if (!descriptor) { LB_ProtoSetError(L"描述集中不存在指定消息类型。"); return 0; }
    const auto* prototype = descriptors->factory.GetPrototype(descriptor);
    if (!prototype) { LB_ProtoSetError(L"无法创建指定消息类型的反射实例。"); return 0; }
    auto handle = std::make_unique<LB_ProtoMessageHandle>();
    handle->descriptors = descriptors;
    handle->message.reset(prototype->New());
    const UINT_PTR result = LB_ProtoNewHandle();
    {
        std::lock_guard<std::mutex> lock(g_lbProtoMutex);
        g_lbProtoMessages.emplace(result, std::move(handle));
    }
    return result;
}

bool PB_从字节集解析(UINT_PTR messageHandle, const std::vector<unsigned char>& bytes) {
    g_lbProtoLastError.clear();
    LB_ProtoMessageHandle* handle = LB_ProtoGetMessage(messageHandle);
    if (!handle || !handle->message) { LB_ProtoSetError(L"消息句柄无效。"); return false; }
    if (bytes.empty()) {
        handle->message->Clear();
        return true;
    }
    if (bytes.size() > static_cast<size_t>((std::numeric_limits<int>::max)())) {
        LB_ProtoSetError(L"字节集长度超过 Protobuf 单次解析上限。");
        return false;
    }
    if (!handle->message->ParseFromArray(bytes.data(), static_cast<int>(bytes.size()))) {
        LB_ProtoSetError(L"字节集不是有效的消息编码，或消息包含不匹配的字段类型。");
        return false;
    }
    return true;
}

std::vector<unsigned char> PB_序列化为字节集(UINT_PTR messageHandle) {
    g_lbProtoLastError.clear();
    LB_ProtoMessageHandle* handle = LB_ProtoGetMessage(messageHandle);
    if (!handle || !handle->message) { LB_ProtoSetError(L"消息句柄无效。"); return {}; }
    const size_t size = handle->message->ByteSizeLong();
    if (size > static_cast<size_t>((std::numeric_limits<int>::max)())) { LB_ProtoSetError(L"消息序列化结果超过单次 ABI 长度上限。"); return {}; }
    std::string encoded;
    if (!handle->message->SerializeToString(&encoded)) { LB_ProtoSetError(L"消息序列化失败。"); return {}; }
    return std::vector<unsigned char>(encoded.begin(), encoded.end());
}

bool PB_从JSON(UINT_PTR messageHandle, const wchar_t* json) {
    g_lbProtoLastError.clear();
    LB_ProtoMessageHandle* handle = LB_ProtoGetMessage(messageHandle);
    if (!handle || !handle->message) { LB_ProtoSetError(L"消息句柄无效。"); return false; }
    const auto status = google::protobuf::util::JsonStringToMessage(LingCppWideToUtf8(json ? json : L""), handle->message.get());
    if (!status.ok()) { LB_ProtoSetError(std::string(status.message())); return false; }
    return true;
}

const wchar_t* PB_到JSON(UINT_PTR messageHandle) {
    g_lbProtoLastError.clear();
    LB_ProtoMessageHandle* handle = LB_ProtoGetMessage(messageHandle);
    if (!handle || !handle->message) { LB_ProtoSetError(L"消息句柄无效。"); return LB_ReturnText(L""); }
    std::string json;
    const auto status = google::protobuf::util::MessageToJsonString(*handle->message, &json);
    if (!status.ok()) { LB_ProtoSetError(std::string(status.message())); return LB_ReturnText(L""); }
    return LB_ReturnText(LB_Utf8ToWide(json));
}

void PB_释放消息(UINT_PTR messageHandle) {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    g_lbProtoMessages.erase(messageHandle);
}

void PB_释放描述集(UINT_PTR descriptorHandle) {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    g_lbProtoDescriptors.erase(descriptorHandle);
}

extern "C" bool LingBuilderProtoParseBytes(void* message, const unsigned char* data, size_t size) {
    if (size > 0 && !data) return false;
    if (size > static_cast<size_t>((std::numeric_limits<int>::max)())) return false;
    return message ? static_cast<google::protobuf::Message*>(message)->ParseFromArray(data, static_cast<int>(size)) : false;
}

extern "C" size_t LingBuilderProtoSerializeBytes(const void* message, unsigned char* output, size_t capacity) {
    if (!message) return 0;
    const auto* value = static_cast<const google::protobuf::Message*>(message);
    const size_t size = value->ByteSizeLong();
    if (!output || capacity < size || size > static_cast<size_t>((std::numeric_limits<int>::max)())) return size;
    if (!value->SerializeToArray(output, static_cast<int>(size))) return 0;
    return size;
}
#else
// SDK 不可用时反射命令不参与链接；无 schema wire 命令与 PB_取最后错误 已在上方无条件定义。
#endif
`;

export function generateProtobufRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === PROTOBUF_MODULE_ID) ? PROTOBUF_RUNTIME : '';
}
