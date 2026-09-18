import type { EmbeddedResourceSpec } from './embeddedResourceService';
import { EMBEDDED_RESOURCE_MODULE_ID, buildEmbeddedResourceTableLines } from './embeddedResourceService';

// 模块 ID 的唯一来源在 embeddedResourceService（设计器面板/命令门禁不引入本运行时的模板字符串）。
export { EMBEDDED_RESOURCE_MODULE_ID };

export const EMBEDDED_RESOURCE_REQUIRED_MODULE_HINT = '请先在「项目模块」中启用「内嵌资源模块」（lingbuilder.resource.embed）。';

/**
 * 内嵌资源运行期：生成的资源映射表（项目相关）+ 资源_* 命令实现。
 * 资源数据本身由 rc 打进 EXE，这里按逻辑名找到对应资源号后用 LockResource 取映像内指针
 * （零拷贝、按需分页；只有"资源_取字节集"这类按值返回的命令才会复制一份）。
 */
export function generateEmbeddedResourceRuntime(
  enabledModules: Array<{ manifest: { id: string } }>,
  specs: EmbeddedResourceSpec[],
  projectId: string
): string {
  if (!enabledModules.some(module => module.manifest.id === EMBEDDED_RESOURCE_MODULE_ID)) return '';
  const tableLines = buildEmbeddedResourceTableLines(specs);
  const table = tableLines.length > 0 ? tableLines.join('\n') : '    { 0u, false, nullptr },';
  // 释放目录用工程 ID 隔离，与内嵌文件（释放到 %TEMP% 的那条链路）保持同一命名习惯。
  const safeProjectId = String(projectId || 'project').replace(/[\\"'\r\n]/gu, '').slice(0, 64) || 'project';
  return String.raw`
// ===== 内嵌资源运行时（lingbuilder.resource.embed）=====
// 资源在构建期以 RCDATA 资源号 2301 起打进 EXE；这里按逻辑名查表 → LockResource 取映像内指针。
#define LINGBUILDER_EMBEDDED_RESOURCE_RUNTIME 1

struct LB_EmbeddedResourceEntry {
    unsigned int resourceId;
    bool extract;
    const wchar_t* name;
};

static const LB_EmbeddedResourceEntry kLingBuilderEmbeddedResources[] = {
${table}
};

static std::wstring g_lbEmbeddedResourceError;
static std::mutex g_lbEmbeddedResourceMutex;

static void LB_EmbeddedResourceSetError(const std::wstring& text) {
    std::lock_guard<std::mutex> lock(g_lbEmbeddedResourceMutex);
    g_lbEmbeddedResourceError = text;
}

static std::wstring LB_EmbeddedResourceError() {
    std::lock_guard<std::mutex> lock(g_lbEmbeddedResourceMutex);
    return g_lbEmbeddedResourceError;
}

const wchar_t* 资源_取错误信息() { return LB_ReturnText(LB_EmbeddedResourceError()); }

// 逻辑名统一按正斜杠、忽略大小写比较（Windows 路径语义）。
static std::wstring LB_EmbeddedResourceNormalize(const wchar_t* name) {
    std::wstring value = LB_Wide(name);
    for (wchar_t& character : value) {
        if (character == L'\\') character = L'/';
        if (character >= L'A' && character <= L'Z') character = static_cast<wchar_t>(character - L'A' + L'a');
    }
    return value;
}

static const LB_EmbeddedResourceEntry* LB_EmbeddedResourceFind(const wchar_t* name) {
    const std::wstring normalized = LB_EmbeddedResourceNormalize(name);
    if (normalized.empty()) return nullptr;
    for (const LB_EmbeddedResourceEntry& entry : kLingBuilderEmbeddedResources) {
        if (!entry.name) continue;
        if (LB_EmbeddedResourceNormalize(entry.name) == normalized) return &entry;
    }
    return nullptr;
}

static const unsigned char* LB_EmbeddedResourceData(const wchar_t* name, unsigned int* outSize) {
    if (outSize) *outSize = 0;
    const LB_EmbeddedResourceEntry* entry = LB_EmbeddedResourceFind(name);
    if (!entry) {
        LB_EmbeddedResourceSetError(L"未声明的内嵌资源：" + LB_Wide(name) + L"（请在项目内嵌资源清单里添加，或核对逻辑名）。");
        return nullptr;
    }
    HMODULE module = GetModuleHandleW(nullptr);
    HRSRC resource = FindResourceW(module, MAKEINTRESOURCEW(static_cast<WORD>(entry->resourceId)), MAKEINTRESOURCEW(10));
    if (!resource) {
        LB_EmbeddedResourceSetError(L"EXE 里没有找到内嵌资源：" + LB_Wide(name) + L"（请重新构建项目）。");
        return nullptr;
    }
    HGLOBAL loaded = LoadResource(module, resource);
    const unsigned char* data = loaded ? static_cast<const unsigned char*>(LockResource(loaded)) : nullptr;
    const DWORD size = SizeofResource(module, resource);
    if (!data || size == 0) {
        LB_EmbeddedResourceSetError(L"内嵌资源读取失败：" + LB_Wide(name));
        return nullptr;
    }
    if (outSize) *outSize = static_cast<unsigned int>(size);
    LB_EmbeddedResourceSetError(L"");
    return data;
}

bool 资源_是否存在(const wchar_t* 逻辑名) {
    unsigned int size = 0;
    return LB_EmbeddedResourceData(逻辑名, &size) != nullptr;
}

int 资源_取大小(const wchar_t* 逻辑名) {
    unsigned int size = 0;
    if (!LB_EmbeddedResourceData(逻辑名, &size)) return 0;
    return static_cast<int>(size);
}

std::vector<unsigned char> 资源_取字节集(const wchar_t* 逻辑名) {
    unsigned int size = 0;
    const unsigned char* data = LB_EmbeddedResourceData(逻辑名, &size);
    if (!data || size == 0) return {};
    return std::vector<unsigned char>(data, data + size);
}

const wchar_t* 资源_取文本(const wchar_t* 逻辑名) {
    unsigned int size = 0;
    const unsigned char* data = LB_EmbeddedResourceData(逻辑名, &size);
    if (!data || size == 0) return LB_ReturnText(L"");
    const std::string bytes(reinterpret_cast<const char*>(data), size);
    return LB_ReturnText(LB_Utf8ToWide(bytes));
}

const wchar_t* 资源_列表() {
    std::wstring output;
    for (const LB_EmbeddedResourceEntry& entry : kLingBuilderEmbeddedResources) {
        if (!entry.name) continue;
        if (!output.empty()) output += L"\r\n";
        output += entry.name;
    }
    return LB_ReturnText(std::move(output));
}

// 取真实磁盘路径：先把资源写到目标文件（覆盖写），供只接受文件路径的第三方 API 使用。
const wchar_t* 资源_保存到文件(const wchar_t* 逻辑名, const wchar_t* 路径) {
    unsigned int size = 0;
    const unsigned char* data = LB_EmbeddedResourceData(逻辑名, &size);
    if (!data || size == 0) return LB_ReturnText(L"");
    const std::wstring target = LB_Wide(路径);
    if (target.empty()) {
        LB_EmbeddedResourceSetError(L"资源_保存到文件 的目标路径不能为空。");
        return LB_ReturnText(L"");
    }
    HANDLE file = CreateFileW(target.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) {
        LB_EmbeddedResourceSetError(L"写入文件失败：" + target);
        return LB_ReturnText(L"");
    }
    DWORD written = 0;
    const BOOL ok = WriteFile(file, data, size, &written, nullptr);
    CloseHandle(file);
    if (!ok || written != size) {
        LB_EmbeddedResourceSetError(L"写入文件失败：" + target);
        return LB_ReturnText(L"");
    }
    return LB_ReturnText(target);
}

// 释放到 %TEMP%\lingbuilder-embedded\<工程ID>\<逻辑名>（含子目录），返回路径；已存在且大小一致时直接复用。
const wchar_t* 资源_释放到临时目录(const wchar_t* 逻辑名) {
    unsigned int size = 0;
    const unsigned char* data = LB_EmbeddedResourceData(逻辑名, &size);
    if (!data || size == 0) return LB_ReturnText(L"");
    const std::wstring logical = LB_EmbeddedResourceNormalize(逻辑名);
    wchar_t tempRoot[MAX_PATH] = {};
    if (GetTempPathW(MAX_PATH, tempRoot) == 0) {
        LB_EmbeddedResourceSetError(L"读取临时目录失败。");
        return LB_ReturnText(L"");
    }
    std::wstring directory = std::wstring(tempRoot) + L"lingbuilder-embedded\\" + L"${safeProjectId}";
    std::wstring relative;
    for (wchar_t character : logical) relative.push_back(character == L'/' ? L'\\' : character);
    const size_t slash = relative.find_last_of(L'\\');
    if (slash != std::wstring::npos) {
        directory += L"\\" + relative.substr(0, slash);
        relative = relative.substr(slash + 1);
    }
    if (relative.empty()) {
        LB_EmbeddedResourceSetError(L"内嵌资源的逻辑名不合法：" + LB_Wide(逻辑名));
        return LB_ReturnText(L"");
    }
    std::error_code error;
    std::filesystem::create_directories(directory, error);
    if (error) {
        LB_EmbeddedResourceSetError(L"创建释放目录失败：" + directory);
        return LB_ReturnText(L"");
    }
    const std::wstring target = directory + L"\\" + relative;
    return 资源_保存到文件(逻辑名, target.c_str());
}

// 启动释放：extract = 真的条目在进程启动（wWinMain）时统一释放一次。
// 与中文代码侧「系统_取临时目录() + lingbuilder-embedded\<工程ID>」约定路径一致，
// 每次启动覆盖写，保证释放内容与 EXE 内资源一致。
void LB_EmbeddedResourceReleaseExtracted() {
    for (const LB_EmbeddedResourceEntry& entry : kLingBuilderEmbeddedResources) {
        if (!entry.extract || !entry.name) continue;
        (void)资源_释放到临时目录(entry.name);
    }
}
`;
}
