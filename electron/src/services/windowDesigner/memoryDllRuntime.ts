/**
 * 内存加载 DLL 运行时（模块 lingbuilder.advanced.memorydll）。
 *
 * 手工 PE 映射：校验头 → VirtualAlloc 映射节区 → 基址重定位 → 填充导入表 → TLS 回调
 * → x64 异常表注册 → 调用 DllMain → 返回模块基址；导出函数按名/序号解析。
 * 全过程不产生磁盘文件，被加载 DLL 依赖的系统 DLL 仍由 Windows 加载器从系统目录加载。
 *
 * 已知边界（与易语言内存加载行为一致，必须写进文档）：
 * - 模块不在 OS 模块链表中，GetModuleHandleW/EnumProcessModules 看不到它。
 * - 只支持与当前程序位数一致的、未加壳的 Windows PE；.NET 程序集与加壳 DLL 不支持。
 * - TLS 只调用回调，不注册线程局部存储槽位。
 */

/** 内存加载 DLL 模块 ID（命令、运行时与项目 DLL 命令声明共用同一门禁）。 */
export const MEMORY_DLL_MODULE_ID = 'lingbuilder.advanced.memorydll';

/** 项目 DLL 命令声明使用内存加载时要求启用的模块，缺失时为阻断诊断。 */
export const MEMORY_DLL_REQUIRED_MODULE_HINT = '请先在「项目模块」中启用「内存加载DLL模块」（lingbuilder.advanced.memorydll）。';

export const MEMORY_DLL_RUNTIME = String.raw`
// ===== 内存加载 DLL 运行时（lingbuilder.advanced.memorydll）=====
// 手工 PE 映射，不向磁盘释放 DLL；Ctrl+F 搜「内存DLL_加载」可查看命令实现。
#define LINGBUILDER_MEMORY_DLL_RUNTIME 1

static std::mutex g_lbMemDllMutex;
static std::wstring g_lbMemDllError;

struct LB_MemDllModule {
    long long address = 0;
    unsigned int imageSize = 0;
    std::wstring virtualName;
    std::wstring virtualDirectory;
    // 由项目 DLL 命令声明的内嵌资源加载而来；这类模块的生命周期由生成代码托管，禁止手工卸载。
    bool fromResource = false;
};

static std::unordered_map<long long, LB_MemDllModule> g_lbMemDllModules;

static void LB_MemDllSetError(const std::wstring& text) {
    std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
    g_lbMemDllError = text;
}

static std::wstring LB_MemDllReadError() {
    std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
    return g_lbMemDllError;
}

const wchar_t* 内存DLL_取错误信息() { return LB_ReturnText(LB_MemDllReadError()); }

static bool LB_MemDllMachineMatches(unsigned short machine) {
#ifdef _WIN64
    return machine == IMAGE_FILE_MACHINE_AMD64;
#else
    return machine == IMAGE_FILE_MACHINE_I386;
#endif
}

static std::wstring LB_MemDllDescribeArchitecture(unsigned short machine) {
    switch (machine) {
    case IMAGE_FILE_MACHINE_AMD64: return L"64 位（x64）";
    case IMAGE_FILE_MACHINE_I386: return L"32 位（x86）";
    case IMAGE_FILE_MACHINE_ARM64: return L"ARM64";
    default: return L"未知架构";
    }
}

// 过文件校验：确认节区数据完整、导出表可解析，并识别常见加壳段名。
static bool LB_MemDllVerifyImage(const unsigned char* data, size_t totalSize, const IMAGE_NT_HEADERS* nt, std::wstring& error) {
    static const wchar_t* kPackedSections[] = {
        L"UPX0", L"UPX1", L"UPX2", L"UPX!", L".aspack", L".adata", L".ASPack", L".ASProtect",
        L".themida", L".winlice", L".vmp0", L".vmp1", L".enigma", L".petite", L".pklstb",
        L"MPRESS1", L"MPRESS2", L"PELOCK", L"FSG!", L".nsp0", L".nsp1", L".neolite", L".yP"
    };
    if (nt->OptionalHeader.SizeOfHeaders > totalSize) {
        error = L"DLL 头区长度越界（文件可能被截断）。";
        return false;
    }
    const IMAGE_SECTION_HEADER* firstSection = IMAGE_FIRST_SECTION(nt);
    for (unsigned short index = 0; index < nt->FileHeader.NumberOfSections; ++index) {
        const IMAGE_SECTION_HEADER& section = firstSection[index];
        char rawName[9] = {};
        std::memcpy(rawName, section.Name, 8);
        const std::wstring sectionName = LB_Utf8ToWide(std::string(rawName));
        for (const wchar_t* packed : kPackedSections) {
            if (_wcsicmp(sectionName.c_str(), packed) == 0) {
                error = L"DLL 疑似被加壳（段名 " + sectionName + L"）；内存加载不支持加壳 DLL，请先脱壳。";
                return false;
            }
        }
        if (section.SizeOfRawData == 0 || section.PointerToRawData == 0) continue;
        const size_t rawEnd = static_cast<size_t>(section.PointerToRawData) + static_cast<size_t>(section.SizeOfRawData);
        if (rawEnd > totalSize) {
            error = L"DLL 节区数据越界（文件可能被截断或已加壳）。";
            return false;
        }
    }
    const IMAGE_DATA_DIRECTORY& exports = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    if (exports.VirtualAddress != 0 && (exports.Size == 0 || exports.VirtualAddress >= nt->OptionalHeader.SizeOfImage)) {
        error = L"DLL 导出表结构异常。";
        return false;
    }
    return true;
}

static bool LB_MemDllApplyRelocations(unsigned char* base, const IMAGE_NT_HEADERS* nt, unsigned long long delta, std::wstring& error) {
    const IMAGE_DATA_DIRECTORY& directory = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_BASERELOC];
    if (directory.VirtualAddress == 0 || directory.Size == 0) {
        if ((nt->FileHeader.Characteristics & IMAGE_FILE_RELOCS_STRIPPED) != 0) {
            error = L"DLL 已剥离重定位表且无法映射到首选基址，不能内存加载。";
            return false;
        }
        return true;
    }
    unsigned char* cursor = base + directory.VirtualAddress;
    unsigned long remaining = directory.Size;
    while (remaining >= sizeof(IMAGE_BASE_RELOCATION)) {
        IMAGE_BASE_RELOCATION* block = reinterpret_cast<IMAGE_BASE_RELOCATION*>(cursor);
        if (block->SizeOfBlock < sizeof(IMAGE_BASE_RELOCATION)) break;
        const unsigned long count = (block->SizeOfBlock - sizeof(IMAGE_BASE_RELOCATION)) / sizeof(unsigned short);
        unsigned short* entries = reinterpret_cast<unsigned short*>(cursor + sizeof(IMAGE_BASE_RELOCATION));
        for (unsigned long index = 0; index < count; ++index) {
            const unsigned short type = static_cast<unsigned short>(entries[index] >> 12);
            const unsigned short offset = static_cast<unsigned short>(entries[index] & 0x0FFF);
            unsigned char* target = base + block->VirtualAddress + offset;
            if (type == IMAGE_REL_BASED_ABSOLUTE) continue;
#ifdef _WIN64
            if (type == IMAGE_REL_BASED_DIR64) { *reinterpret_cast<unsigned long long*>(target) += delta; continue; }
#else
            if (type == IMAGE_REL_BASED_HIGHLOW) { *reinterpret_cast<unsigned long*>(target) += static_cast<unsigned long>(delta); continue; }
#endif
            error = L"遇到不支持的重定位类型，不能内存加载。";
            return false;
        }
        cursor += block->SizeOfBlock;
        if (block->SizeOfBlock > remaining) break;
        remaining -= block->SizeOfBlock;
    }
    return true;
}

static bool LB_MemDllResolveImports(unsigned char* base, const IMAGE_NT_HEADERS* nt, std::wstring& error) {
    const IMAGE_DATA_DIRECTORY& directory = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];
    if (directory.VirtualAddress == 0) return true;
    IMAGE_IMPORT_DESCRIPTOR* descriptor = reinterpret_cast<IMAGE_IMPORT_DESCRIPTOR*>(base + directory.VirtualAddress);
    for (; descriptor->Name != 0; ++descriptor) {
        const char* moduleName = reinterpret_cast<const char*>(base + descriptor->Name);
        HMODULE dependency = LoadLibraryA(moduleName);
        if (!dependency) {
            error = L"依赖 DLL 加载失败：" + LB_Utf8ToWide(moduleName);
            return false;
        }
        IMAGE_THUNK_DATA* lookup = reinterpret_cast<IMAGE_THUNK_DATA*>(base + (descriptor->OriginalFirstThunk != 0 ? descriptor->OriginalFirstThunk : descriptor->FirstThunk));
        IMAGE_THUNK_DATA* target = reinterpret_cast<IMAGE_THUNK_DATA*>(base + descriptor->FirstThunk);
        for (; lookup->u1.AddressOfData != 0; ++lookup, ++target) {
            FARPROC resolved = nullptr;
            if (IMAGE_SNAP_BY_ORDINAL(lookup->u1.Ordinal)) {
                resolved = GetProcAddress(dependency, MAKEINTRESOURCEA(static_cast<WORD>(IMAGE_ORDINAL(lookup->u1.Ordinal))));
            } else {
                IMAGE_IMPORT_BY_NAME* import = reinterpret_cast<IMAGE_IMPORT_BY_NAME*>(base + lookup->u1.AddressOfData);
                resolved = GetProcAddress(dependency, reinterpret_cast<const char*>(import->Name));
            }
            if (!resolved) {
                error = L"依赖函数无法解析：" + LB_Utf8ToWide(moduleName);
                return false;
            }
            target->u1.Function = reinterpret_cast<ULONG_PTR>(resolved);
        }
    }
    return true;
}

static void LB_MemDllRunTlsCallbacks(unsigned char* base, const IMAGE_NT_HEADERS* nt) {
    const IMAGE_DATA_DIRECTORY& directory = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_TLS];
    if (directory.VirtualAddress == 0) return;
    IMAGE_TLS_DIRECTORY* tls = reinterpret_cast<IMAGE_TLS_DIRECTORY*>(base + directory.VirtualAddress);
    if (tls->AddressOfCallBacks == 0) return;
    PIMAGE_TLS_CALLBACK* callback = reinterpret_cast<PIMAGE_TLS_CALLBACK*>(tls->AddressOfCallBacks);
    for (; callback && *callback; ++callback) {
        (*callback)(reinterpret_cast<PVOID>(base), DLL_PROCESS_ATTACH, nullptr);
    }
}

// 已为内存模块分配的 TLS 槽位：进程生命周期内不回收（卸载后线程可能仍持有块指针）。
static std::vector<DWORD> g_lbMemDllTlsIndexes;

/**
 * 注册 PE 的 TLS 目录。
 * 手工映射的模块不会被 Windows 加载器分配 TLS 槽位，而静态 CRT 的线程局部数据（__declspec(thread)）
 * 依赖 TLS 目录里的索引：索引为空时 DllMain 里访问线程局部数据会直接崩溃。
 * 这里自行 TlsAlloc、把索引写回 TLS 目录、并按模板块初始化当前线程。
 * 边界：之后新创建的线程没有该块（需要时由业务代码自行 TlsSetValue）。
 */
static bool LB_MemDllSetupTls(unsigned char* base, const IMAGE_NT_HEADERS* nt, std::wstring& error) {
    const IMAGE_DATA_DIRECTORY& directory = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_TLS];
    if (directory.VirtualAddress == 0) return true;
    IMAGE_TLS_DIRECTORY* tls = reinterpret_cast<IMAGE_TLS_DIRECTORY*>(base + directory.VirtualAddress);
    const DWORD index = TlsAlloc();
    if (index == TLS_OUT_OF_INDEXES) {
        error = L"TLS 槽位分配失败（进程 TLS 槽位已用尽），不能内存加载。";
        return false;
    }
    g_lbMemDllTlsIndexes.push_back(index);
    if (tls->AddressOfIndex != 0) *reinterpret_cast<DWORD*>(static_cast<ULONG_PTR>(tls->AddressOfIndex)) = index;
    // IMAGE_TLS_DIRECTORY 用 [StartAddressOfRawData, EndAddressOfRawData) 描述模板字节，
    // 没有 AddressOfRawData/SizeOfRawData 字段（那是节表里的）。
    const size_t rawSize = tls->EndAddressOfRawData > tls->StartAddressOfRawData
        ? static_cast<size_t>(tls->EndAddressOfRawData - tls->StartAddressOfRawData)
        : 0;
    const size_t blockSize = rawSize + static_cast<size_t>(tls->SizeOfZeroFill);
    if (blockSize > 0) {
        // 用 VirtualAlloc 取块：已清零，且不依赖 <cstdlib>（生成的 main.cpp 未包含它）。
        void* block = VirtualAlloc(nullptr, blockSize, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
        if (!block) {
            error = L"线程局部存储块分配失败，不能内存加载。";
            return false;
        }
        if (rawSize > 0 && tls->StartAddressOfRawData != 0) {
            std::memcpy(block, reinterpret_cast<const void*>(static_cast<ULONG_PTR>(tls->StartAddressOfRawData)), rawSize);
        }
        TlsSetValue(index, block);
    }
    return true;
}

static void LB_MemDllProtectSections(unsigned char* base, const IMAGE_NT_HEADERS* nt) {
    const IMAGE_SECTION_HEADER* firstSection = IMAGE_FIRST_SECTION(nt);
    for (unsigned short index = 0; index < nt->FileHeader.NumberOfSections; ++index) {
        const IMAGE_SECTION_HEADER& section = firstSection[index];
        if (section.SizeOfRawData == 0) continue;
        DWORD protection = PAGE_READONLY;
        const DWORD characteristics = section.Characteristics;
        if ((characteristics & IMAGE_SCN_MEM_EXECUTE) != 0) protection = (characteristics & IMAGE_SCN_MEM_WRITE) != 0 ? PAGE_EXECUTE_READWRITE : PAGE_EXECUTE_READ;
        else if ((characteristics & IMAGE_SCN_MEM_WRITE) != 0) protection = PAGE_READWRITE;
        DWORD previous = 0;
        VirtualProtect(base + section.VirtualAddress, section.SizeOfRawData, protection, &previous);
    }
}

// 手工映射核心：返回模块基址（0 表示失败，失败原因写入 error）。
static long long LB_MemDllMapImage(const unsigned char* data, size_t totalSize, const std::wstring& virtualName, const std::wstring& virtualDirectory, bool verifyFile, bool skipEntry, bool fromResource, std::wstring& error) {
    if (!data || totalSize < sizeof(IMAGE_DOS_HEADER)) {
        error = L"DLL 数据为空或长度不足。";
        return 0;
    }
    const IMAGE_DOS_HEADER* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(data);
    if (dos->e_magic != IMAGE_DOS_SIGNATURE) {
        error = L"不是有效的 PE 文件（缺少 MZ 头）。";
        return 0;
    }
    const size_t ntOffset = static_cast<size_t>(dos->e_lfanew);
    if (dos->e_lfanew <= 0 || ntOffset + sizeof(IMAGE_FILE_HEADER) + 4 > totalSize) {
        error = L"PE 头偏移越界。";
        return 0;
    }
    const IMAGE_NT_HEADERS* nt = reinterpret_cast<const IMAGE_NT_HEADERS*>(data + ntOffset);
    if (nt->Signature != IMAGE_NT_SIGNATURE) {
        error = L"不是有效的 PE 文件（缺少 PE 签名）。";
        return 0;
    }
    const unsigned short machine = nt->FileHeader.Machine;
    if (!LB_MemDllMachineMatches(machine)) {
        error = L"DLL 架构与当前程序不一致：DLL 是 " + LB_MemDllDescribeArchitecture(machine) + L"，当前程序是 "
#ifdef _WIN64
            + L"64 位（x64）"
#else
            + L"32 位（x86）"
#endif
            + L"；请改用与程序位数一致的 DLL。";
        return 0;
    }
    if (ntOffset + sizeof(IMAGE_NT_HEADERS) > totalSize) {
        error = L"PE 可选头越界（文件可能被截断）。";
        return 0;
    }
    const DWORD sizeOfImage = nt->OptionalHeader.SizeOfImage;
    if (sizeOfImage == 0 || sizeOfImage > 512u * 1024u * 1024u) {
        error = L"DLL 映像大小异常，不能内存加载。";
        return 0;
    }
    if (verifyFile && !LB_MemDllVerifyImage(data, totalSize, nt, error)) return 0;

    const unsigned long long preferredBase = static_cast<unsigned long long>(nt->OptionalHeader.ImageBase);
    unsigned char* base = static_cast<unsigned char*>(VirtualAlloc(reinterpret_cast<void*>(static_cast<ULONG_PTR>(nt->OptionalHeader.ImageBase)), sizeOfImage, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE));
    if (!base) base = static_cast<unsigned char*>(VirtualAlloc(nullptr, sizeOfImage, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE));
    if (!base) {
        error = L"映射内存分配失败。";
        return 0;
    }
    const size_t headerCopy = nt->OptionalHeader.SizeOfHeaders > totalSize ? totalSize : static_cast<size_t>(nt->OptionalHeader.SizeOfHeaders);
    std::memcpy(base, data, headerCopy);
    const IMAGE_SECTION_HEADER* sourceSections = IMAGE_FIRST_SECTION(nt);
    for (unsigned short index = 0; index < nt->FileHeader.NumberOfSections; ++index) {
        const IMAGE_SECTION_HEADER& section = sourceSections[index];
        const size_t copySize = (std::min)(static_cast<size_t>(section.SizeOfRawData), static_cast<size_t>(section.Misc.VirtualSize));
        if (copySize == 0) continue;
        const size_t rawEnd = static_cast<size_t>(section.PointerToRawData) + copySize;
        if (section.PointerToRawData == 0 || rawEnd > totalSize) {
            error = L"DLL 节区数据越界，不能内存加载。";
            VirtualFree(base, 0, MEM_RELEASE);
            return 0;
        }
        std::memcpy(base + section.VirtualAddress, data + section.PointerToRawData, copySize);
    }

    IMAGE_NT_HEADERS* mapped = reinterpret_cast<IMAGE_NT_HEADERS*>(base + ntOffset);
    const unsigned long long delta = reinterpret_cast<unsigned long long>(base) - preferredBase;
    if (delta != 0 && !LB_MemDllApplyRelocations(base, mapped, delta, error)) {
        VirtualFree(base, 0, MEM_RELEASE);
        return 0;
    }
    if (!LB_MemDllResolveImports(base, mapped, error)) {
        VirtualFree(base, 0, MEM_RELEASE);
        return 0;
    }
    if (!LB_MemDllSetupTls(base, mapped, error)) {
        VirtualFree(base, 0, MEM_RELEASE);
        return 0;
    }
    // 必须在执行映射内的代码（TLS 回调、入口函数）之前按 PE 节属性落权限：
    // 否则 .text 仍是 VirtualAlloc 给的读写页，执行时会直接访问冲突。
    LB_MemDllProtectSections(base, mapped);
    LB_MemDllRunTlsCallbacks(base, mapped);
#ifdef _WIN64
    const IMAGE_DATA_DIRECTORY& exceptions = mapped->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION];
    if (exceptions.VirtualAddress != 0 && exceptions.Size >= sizeof(RUNTIME_FUNCTION)) {
        RtlAddFunctionTable(
            reinterpret_cast<PRUNTIME_FUNCTION>(base + exceptions.VirtualAddress),
            exceptions.Size / sizeof(RUNTIME_FUNCTION),
            reinterpret_cast<DWORD64>(base));
    }
#endif
    if (mapped->OptionalHeader.AddressOfEntryPoint != 0 && !skipEntry) {
        using LB_MemDllEntryPoint = BOOL(WINAPI*)(HINSTANCE, DWORD, LPVOID);
        LB_MemDllEntryPoint entry = reinterpret_cast<LB_MemDllEntryPoint>(base + mapped->OptionalHeader.AddressOfEntryPoint);
        if (entry(reinterpret_cast<HINSTANCE>(base), DLL_PROCESS_ATTACH, nullptr) == FALSE) {
            error = L"DLL 入口函数（DllMain）返回失败。";
            VirtualFree(base, 0, MEM_RELEASE);
            return 0;
        }
    }

    const long long handle = reinterpret_cast<long long>(base);
    {
        std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
        LB_MemDllModule record;
        record.address = handle;
        record.imageSize = sizeOfImage;
        record.virtualName = virtualName;
        record.virtualDirectory = virtualDirectory;
        record.fromResource = fromResource;
        g_lbMemDllModules[handle] = record;
    }
    return handle;
}

long long 内存DLL_加载(const std::vector<unsigned char>& data, const wchar_t* virtualName, const wchar_t* virtualDirectory = L"", bool verifyFile = false, bool skipEntry = false) {
    const std::wstring name = LB_Wide(virtualName);
    const std::wstring directory = LB_Wide(virtualDirectory);
    if (name.empty()) {
        LB_MemDllSetError(L"虚拟模块名不能为空。");
        return 0;
    }
    {
        std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
        for (const auto& entry : g_lbMemDllModules) {
            if (_wcsicmp(entry.second.virtualName.c_str(), name.c_str()) == 0) return entry.second.address;
        }
    }
    if (data.empty()) {
        LB_MemDllSetError(L"DLL 数据为空。");
        return 0;
    }
    if (data.size() > 256u * 1024u * 1024u) {
        LB_MemDllSetError(L"DLL 数据超过 256MB 上限。");
        return 0;
    }
    std::wstring error;
    const long long handle = LB_MemDllMapImage(data.data(), data.size(), name, directory, verifyFile, skipEntry, false, error);
    LB_MemDllSetError(error);
    return handle;
}

static unsigned char* LB_MemDllImageBase(long long moduleAddress) {
    std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
    const auto found = g_lbMemDllModules.find(moduleAddress);
    return found == g_lbMemDllModules.end() ? nullptr : reinterpret_cast<unsigned char*>(static_cast<ULONG_PTR>(moduleAddress));
}

static FARPROC LB_MemDllExportLookup(unsigned char* base, const char* name, unsigned short ordinal, bool byOrdinal) {
    const IMAGE_DOS_HEADER* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(base);
    const IMAGE_NT_HEADERS* nt = reinterpret_cast<const IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
    const IMAGE_DATA_DIRECTORY& directory = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    if (directory.VirtualAddress == 0 || directory.Size == 0) return nullptr;
    IMAGE_EXPORT_DIRECTORY* exports = reinterpret_cast<IMAGE_EXPORT_DIRECTORY*>(base + directory.VirtualAddress);
    const unsigned long* functions = reinterpret_cast<const unsigned long*>(base + exports->AddressOfFunctions);
    const auto resolve = [&](unsigned long rva) -> FARPROC {
        if (rva == 0) return nullptr;
        if (rva >= directory.VirtualAddress && rva < directory.VirtualAddress + directory.Size) {
            // 转发导出：条目文本为「目标DLL.函数名」或「目标DLL.#序号」。
            std::string targetText(reinterpret_cast<const char*>(base + rva));
            const size_t dot = targetText.rfind('.');
            if (dot == std::string::npos || dot + 1 >= targetText.size()) return nullptr;
            std::string libraryName = targetText.substr(0, dot);
            if (libraryName.size() < 4 || _stricmp(libraryName.c_str() + libraryName.size() - 4, ".dll") != 0) libraryName += ".dll";
            HMODULE dependency = LoadLibraryA(libraryName.c_str());
            if (!dependency) return nullptr;
            const std::string symbol = targetText.substr(dot + 1);
            if (!symbol.empty() && symbol[0] == '#') return GetProcAddress(dependency, MAKEINTRESOURCEA(static_cast<WORD>(std::atoi(symbol.c_str() + 1))));
            return GetProcAddress(dependency, symbol.c_str());
        }
        return reinterpret_cast<FARPROC>(base + rva);
    };
    if (byOrdinal) {
        if (ordinal < exports->Base) return nullptr;
        const unsigned long index = static_cast<unsigned long>(ordinal - exports->Base);
        if (index >= exports->NumberOfFunctions) return nullptr;
        return resolve(functions[index]);
    }
    const unsigned long* names = reinterpret_cast<const unsigned long*>(base + exports->AddressOfNames);
    const unsigned short* ordinals = reinterpret_cast<const unsigned short*>(base + exports->AddressOfNameOrdinals);
    for (unsigned long index = 0; index < exports->NumberOfNames; ++index) {
        const char* candidate = reinterpret_cast<const char*>(base + names[index]);
        if (std::strcmp(candidate, name) == 0) {
            const unsigned short functionIndex = ordinals[index];
            if (functionIndex >= exports->NumberOfFunctions) return nullptr;
            return resolve(functions[functionIndex]);
        }
    }
    return nullptr;
}

// 生成代码使用的解析入口：地址为 0 或模块已被卸载时返回空，并保留已有错误文本。
void* LB_MemDllResolveSymbol(long long moduleAddress, const char* exportName) {
    if (!exportName || !*exportName) return nullptr;
    unsigned char* base = LB_MemDllImageBase(moduleAddress);
    if (!base) return nullptr;
    FARPROC resolved = LB_MemDllExportLookup(base, exportName, 0, false);
    if (!resolved) LB_MemDllSetError(L"内存加载的 DLL 未导出函数：" + LB_Utf8ToWide(std::string(exportName)));
    return reinterpret_cast<void*>(resolved);
}

void* LB_MemDllResolveOrdinal(long long moduleAddress, unsigned int ordinal) {
    if (ordinal == 0 || ordinal > 0xFFFFu) return nullptr;
    unsigned char* base = LB_MemDllImageBase(moduleAddress);
    if (!base) return nullptr;
    FARPROC resolved = LB_MemDllExportLookup(base, nullptr, static_cast<unsigned short>(ordinal), true);
    if (!resolved) LB_MemDllSetError(L"内存加载的 DLL 未导出序号：" + std::to_wstring(ordinal));
    return reinterpret_cast<void*>(resolved);
}

// 生成代码解析失败时调用：已有更具体的原因（架构不符、资源缺失、加载失败）时保留原文。
// 运行时区块在 调试输出 定义之前发射，因此这里用 OutputDebugStringW 输出（VS/调试查看器可见），
// 中文原因始终写入错误文本，可由 内存DLL_取错误信息() 读取。
void LB_MemDllReportMissingExport(const wchar_t* libraryName, const char* exportName) {
    const std::wstring library = LB_Wide(libraryName);
    const std::wstring symbol = LB_Utf8ToWide(std::string(exportName ? exportName : ""));
    if (LB_MemDllReadError().empty()) {
        LB_MemDllSetError(L"内存加载的 DLL「" + library + L"」缺少导出函数：" + symbol);
    }
    const std::wstring message = L"[LingBuilder] 内存加载 DLL「" + library + L"」的导出函数 " + symbol + L" 解析失败：" + LB_MemDllReadError();
    OutputDebugStringW(message.c_str());
}

long long 内存DLL_取函数地址(long long moduleAddress, const wchar_t* functionName) {
    const std::string name = LB_WideToUtf8(functionName);
    if (name.empty()) {
        LB_MemDllSetError(L"函数名不能为空。");
        return 0;
    }
    return reinterpret_cast<long long>(LB_MemDllResolveSymbol(moduleAddress, name.c_str()));
}

long long 内存DLL_取函数序号地址(long long moduleAddress, int ordinal) {
    return reinterpret_cast<long long>(LB_MemDllResolveOrdinal(moduleAddress, static_cast<unsigned int>(ordinal)));
}

int 内存DLL_取模块大小(long long moduleAddress) {
    std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
    const auto found = g_lbMemDllModules.find(moduleAddress);
    return found == g_lbMemDllModules.end() ? 0 : static_cast<int>(found->second.imageSize);
}

bool 内存DLL_已加载(long long moduleAddress) {
    std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
    return g_lbMemDllModules.find(moduleAddress) != g_lbMemDllModules.end();
}

bool 内存DLL_卸载(long long moduleAddress) {
    LB_MemDllModule record;
    {
        std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
        const auto found = g_lbMemDllModules.find(moduleAddress);
        if (found == g_lbMemDllModules.end()) {
            g_lbMemDllError = L"模块地址无效或已经卸载。";
            return false;
        }
        if (found->second.fromResource) {
            g_lbMemDllError = L"模块「" + found->second.virtualName + L"」由项目 DLL 命令声明的内嵌资源加载，不能手工卸载。";
            return false;
        }
        record = found->second;
        g_lbMemDllModules.erase(found);
        g_lbMemDllError.clear();
    }
    // 只注销、不释放映像：静态 CRT 的线程局部数据会向系统登记 FLS/TLS 回调，
    // 释放已映射代码会让进程退出时的回调落到被回收的内存上（实测访问冲突）。
    // 注销后 内存DLL_取函数地址 / 内存DLL_已加载 都失败，同一虚拟名可以重新加载。
    // 同时不调用 DllMain(DLL_PROCESS_DETACH)：手工映射模块的分离调用在部分 DLL 上会破坏进程状态。
#ifdef _WIN64
    unsigned char* base = reinterpret_cast<unsigned char*>(static_cast<ULONG_PTR>(record.address));
    const IMAGE_DOS_HEADER* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(base);
    const IMAGE_NT_HEADERS* nt = reinterpret_cast<const IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
    const IMAGE_DATA_DIRECTORY& exceptions = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION];
    if (exceptions.VirtualAddress != 0 && exceptions.Size >= sizeof(RUNTIME_FUNCTION)) {
        RtlDeleteFunctionTable(reinterpret_cast<PRUNTIME_FUNCTION>(base + exceptions.VirtualAddress));
    }
#endif
    return true;
}

// 项目 DLL 命令声明的内嵌资源加载入口：从 EXE 的 RCDATA 取字节后手工映射，全程不落盘。
long long LB_MemDllLoadFromResource(unsigned int resourceId, const wchar_t* virtualName) {
    HMODULE module = GetModuleHandleW(nullptr);
    HRSRC resource = FindResourceW(module, MAKEINTRESOURCEW(static_cast<WORD>(resourceId)), MAKEINTRESOURCEW(10));
    if (!resource) {
        LB_MemDllSetError(L"EXE 中缺少内嵌 DLL 资源（资源号 " + std::to_wstring(resourceId) + L"）；请重新构建项目。");
        return 0;
    }
    HGLOBAL loaded = LoadResource(module, resource);
    const unsigned char* data = loaded ? static_cast<const unsigned char*>(LockResource(loaded)) : nullptr;
    const DWORD size = SizeofResource(module, resource);
    if (!data || size == 0) {
        LB_MemDllSetError(L"内嵌 DLL 资源读取失败（资源号 " + std::to_wstring(resourceId) + L"）。");
        return 0;
    }
    const std::wstring name = LB_Wide(virtualName);
    {
        std::lock_guard<std::mutex> lock(g_lbMemDllMutex);
        for (const auto& entry : g_lbMemDllModules) {
            if (_wcsicmp(entry.second.virtualName.c_str(), name.c_str()) == 0) return entry.second.address;
        }
    }
    std::wstring error;
    const long long handle = LB_MemDllMapImage(data, size, name, L"", false, false, true, error);
    LB_MemDllSetError(error);
    return handle;
}
`;

/** 按启用模块发射内存加载 DLL 运行时；未启用该模块时返回空串。 */
export function generateMemoryDllRuntime(enabledModules: Array<{ manifest: { id: string } }>): string {
  return enabledModules.some(module => module.manifest.id === MEMORY_DLL_MODULE_ID) ? MEMORY_DLL_RUNTIME : '';
}
