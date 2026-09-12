import type { InstalledModule } from '../modules/types';

const PROTOBUF_MODULE_ID = 'lingbuilder.data.protobuf';

/**
 * Reflection-only Protobuf runtime. The generated LingCpp code keeps message
 * fields opaque and exchanges binary data as vector<unsigned char>; the C ABI
 * helpers below document the same pointer-plus-length ownership boundary used
 * by external bridges.
 */
const PROTOBUF_RUNTIME = String.raw`
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
static thread_local std::wstring g_lbProtoLastError;

static UINT_PTR LB_ProtoNewHandle() {
    std::lock_guard<std::mutex> lock(g_lbProtoMutex);
    for (;;) {
        const UINT_PTR candidate = g_lbProtoNextHandle++;
        if (candidate != 0 && !g_lbProtoDescriptors.count(candidate) && !g_lbProtoMessages.count(candidate)) return candidate;
    }
}

static void LB_ProtoSetError(const std::string& value) { g_lbProtoLastError = LB_Utf8ToWide(value); }
static void LB_ProtoSetError(const wchar_t* value) { g_lbProtoLastError = value ? value : L""; }

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

const wchar_t* PB_取最后错误() { return LB_ReturnText(g_lbProtoLastError); }

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
static const wchar_t* PB_取最后错误() { return L"Protobuf SDK 不可用。"; }
#endif
`;

export function generateProtobufRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === PROTOBUF_MODULE_ID) ? PROTOBUF_RUNTIME : '';
}
