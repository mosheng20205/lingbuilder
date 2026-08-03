import { InstalledModule } from '../modules/types';

const FILE_RUNTIME = String.raw`
bool 文件_是否存在(const wchar_t* path) { std::error_code error; return std::filesystem::is_regular_file(std::filesystem::path(LB_Wide(path)), error); }
bool 目录_是否存在(const wchar_t* path) { std::error_code error; return std::filesystem::is_directory(std::filesystem::path(LB_Wide(path)), error); }

const wchar_t* 文件_读取文本(const wchar_t* path) {
    std::ifstream stream(std::filesystem::path(LB_Wide(path)), std::ios::binary);
    if (!stream) return LB_ReturnText(L"");
    std::string bytes((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
    if (bytes.size() >= 3 && static_cast<unsigned char>(bytes[0]) == 0xef && static_cast<unsigned char>(bytes[1]) == 0xbb && static_cast<unsigned char>(bytes[2]) == 0xbf) bytes.erase(0, 3);
    return LB_ReturnText(LB_Utf8ToWide(bytes));
}

static bool LB_WriteUtf8File(const wchar_t* path, const wchar_t* content, bool append) {
    std::ofstream stream(std::filesystem::path(LB_Wide(path)), std::ios::binary | (append ? std::ios::app : std::ios::trunc));
    if (!stream) return false; const std::string bytes = LB_WideToUtf8(content); stream.write(bytes.data(), static_cast<std::streamsize>(bytes.size())); return stream.good();
}

bool 文件_写入文本(const wchar_t* path, const wchar_t* content) { return LB_WriteUtf8File(path, content, false); }
bool 文件_追加文本(const wchar_t* path, const wchar_t* content) { return LB_WriteUtf8File(path, content, true); }

bool 文件_复制(const wchar_t* source, const wchar_t* target, bool overwrite) {
    std::error_code error; const auto options = overwrite ? std::filesystem::copy_options::overwrite_existing : std::filesystem::copy_options::none;
    return std::filesystem::copy_file(std::filesystem::path(LB_Wide(source)), std::filesystem::path(LB_Wide(target)), options, error);
}

bool 文件_移动(const wchar_t* source, const wchar_t* target, bool overwrite) {
    std::error_code error; const std::filesystem::path from(LB_Wide(source)), to(LB_Wide(target));
    if (overwrite && std::filesystem::exists(to, error)) { error.clear(); if (!std::filesystem::remove(to, error)) return false; }
    error.clear(); std::filesystem::rename(from, to, error); return !error;
}

bool 文件_删除(const wchar_t* path) { std::error_code error; return std::filesystem::is_regular_file(std::filesystem::path(LB_Wide(path)), error) && std::filesystem::remove(std::filesystem::path(LB_Wide(path)), error); }
long long 文件_取大小(const wchar_t* path) { std::error_code error; const auto size = std::filesystem::file_size(std::filesystem::path(LB_Wide(path)), error); return error ? -1 : static_cast<long long>(size); }
bool 目录_创建(const wchar_t* path) { std::error_code error; const std::filesystem::path target(LB_Wide(path)); return std::filesystem::is_directory(target, error) || std::filesystem::create_directories(target, error); }
bool 目录_删除空目录(const wchar_t* path) { std::error_code error; const std::filesystem::path target(LB_Wide(path)); return std::filesystem::is_directory(target, error) && std::filesystem::remove(target, error); }
`;

const PATH_RUNTIME = String.raw`
const wchar_t* 路径_合并(const wchar_t* base, const wchar_t* child) { return LB_ReturnText((std::filesystem::path(LB_Wide(base)) / std::filesystem::path(LB_Wide(child))).lexically_normal().wstring()); }
const wchar_t* 路径_取文件名(const wchar_t* path) { return LB_ReturnText(std::filesystem::path(LB_Wide(path)).filename().wstring()); }
const wchar_t* 路径_取目录(const wchar_t* path) { return LB_ReturnText(std::filesystem::path(LB_Wide(path)).parent_path().wstring()); }
const wchar_t* 路径_取扩展名(const wchar_t* path) { return LB_ReturnText(std::filesystem::path(LB_Wide(path)).extension().wstring()); }
const wchar_t* 路径_改扩展名(const wchar_t* path, const wchar_t* extension) { std::filesystem::path value(LB_Wide(path)); value.replace_extension(LB_Wide(extension)); return LB_ReturnText(value.wstring()); }
const wchar_t* 路径_转绝对路径(const wchar_t* path) { std::error_code error; auto value = std::filesystem::absolute(std::filesystem::path(LB_Wide(path)), error); return LB_ReturnText(error ? L"" : value.lexically_normal().wstring()); }
const wchar_t* 路径_规范化(const wchar_t* path) { return LB_ReturnText(std::filesystem::path(LB_Wide(path)).lexically_normal().wstring()); }
`;

const INI_RUNTIME = String.raw`
static std::wstring LB_IniPath(const wchar_t* path) { std::error_code error; auto absolute = std::filesystem::absolute(std::filesystem::path(LB_Wide(path)), error); return error ? LB_Wide(path) : absolute.wstring(); }

const wchar_t* INI_读文本(const wchar_t* file, const wchar_t* section, const wchar_t* key, const wchar_t* fallback) {
    std::vector<wchar_t> buffer(32768); const std::wstring path = LB_IniPath(file);
    GetPrivateProfileStringW(section, key, fallback ? fallback : L"", buffer.data(), static_cast<DWORD>(buffer.size()), path.c_str()); return LB_ReturnText(buffer.data());
}

int INI_读整数(const wchar_t* file, const wchar_t* section, const wchar_t* key, int fallback) { const std::wstring path = LB_IniPath(file); return static_cast<int>(GetPrivateProfileIntW(section, key, fallback, path.c_str())); }
bool INI_写文本(const wchar_t* file, const wchar_t* section, const wchar_t* key, const wchar_t* value) { const std::wstring path = LB_IniPath(file); return WritePrivateProfileStringW(section, key, value, path.c_str()) == TRUE; }
bool INI_写整数(const wchar_t* file, const wchar_t* section, const wchar_t* key, int value) { return INI_写文本(file, section, key, std::to_wstring(value).c_str()); }
bool INI_删除键(const wchar_t* file, const wchar_t* section, const wchar_t* key) { const std::wstring path = LB_IniPath(file); return WritePrivateProfileStringW(section, key, nullptr, path.c_str()) == TRUE; }
bool INI_删除节(const wchar_t* file, const wchar_t* section) { const std::wstring path = LB_IniPath(file); return WritePrivateProfileStringW(section, nullptr, nullptr, path.c_str()) == TRUE; }
`;

const REGISTRY_RUNTIME = String.raw`
const wchar_t* 注册表_读文本(const wchar_t* subkey, const wchar_t* valueName, const wchar_t* fallback) {
    DWORD size = 0; LSTATUS status = RegGetValueW(HKEY_CURRENT_USER, subkey, valueName, RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ, nullptr, nullptr, &size);
    if (status != ERROR_SUCCESS || size < sizeof(wchar_t)) return LB_ReturnText(LB_Wide(fallback));
    std::vector<wchar_t> buffer(size / sizeof(wchar_t)); status = RegGetValueW(HKEY_CURRENT_USER, subkey, valueName, RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ, nullptr, buffer.data(), &size);
    return LB_ReturnText(status == ERROR_SUCCESS ? std::wstring(buffer.data()) : LB_Wide(fallback));
}

int 注册表_读整数(const wchar_t* subkey, const wchar_t* valueName, int fallback) { DWORD value = 0, size = sizeof(value); return RegGetValueW(HKEY_CURRENT_USER, subkey, valueName, RRF_RT_REG_DWORD, nullptr, &value, &size) == ERROR_SUCCESS ? static_cast<int>(value) : fallback; }

static bool LB_OpenUserRegistryKey(const wchar_t* subkey, REGSAM access, HKEY& key) {
    return RegCreateKeyExW(HKEY_CURRENT_USER, subkey, 0, nullptr, 0, access, nullptr, &key, nullptr) == ERROR_SUCCESS;
}

bool 注册表_写文本(const wchar_t* subkey, const wchar_t* valueName, const wchar_t* value) {
    HKEY key = nullptr; if (!LB_OpenUserRegistryKey(subkey, KEY_SET_VALUE, key)) return false; const std::wstring text = LB_Wide(value);
    const LSTATUS status = RegSetValueExW(key, valueName, 0, REG_SZ, reinterpret_cast<const BYTE*>(text.c_str()), static_cast<DWORD>((text.size() + 1) * sizeof(wchar_t))); RegCloseKey(key); return status == ERROR_SUCCESS;
}

bool 注册表_写整数(const wchar_t* subkey, const wchar_t* valueName, int value) { HKEY key = nullptr; if (!LB_OpenUserRegistryKey(subkey, KEY_SET_VALUE, key)) return false; DWORD stored = static_cast<DWORD>(value); const LSTATUS status = RegSetValueExW(key, valueName, 0, REG_DWORD, reinterpret_cast<const BYTE*>(&stored), sizeof(stored)); RegCloseKey(key); return status == ERROR_SUCCESS; }
bool 注册表_删除值(const wchar_t* subkey, const wchar_t* valueName) { HKEY key = nullptr; if (!LB_OpenUserRegistryKey(subkey, KEY_SET_VALUE, key)) return false; const LSTATUS status = RegDeleteValueW(key, valueName); RegCloseKey(key); return status == ERROR_SUCCESS; }
bool 注册表_值是否存在(const wchar_t* subkey, const wchar_t* valueName) { return RegGetValueW(HKEY_CURRENT_USER, subkey, valueName, RRF_RT_ANY, nullptr, nullptr, nullptr) == ERROR_SUCCESS; }
`;

const SYSTEM_INFO_RUNTIME = String.raw`
const wchar_t* 系统_取用户名() { wchar_t buffer[256] = {}; DWORD size = _countof(buffer); return GetUserNameW(buffer, &size) ? LB_ReturnText(buffer) : LB_ReturnText(L""); }
const wchar_t* 系统_取计算机名() { wchar_t buffer[MAX_COMPUTERNAME_LENGTH + 1] = {}; DWORD size = _countof(buffer); return GetComputerNameW(buffer, &size) ? LB_ReturnText(buffer) : LB_ReturnText(L""); }

const wchar_t* 系统_取Windows版本() {
    using RtlGetVersionFn = LONG(WINAPI*)(PRTL_OSVERSIONINFOW); HMODULE module = GetModuleHandleW(L"ntdll.dll");
    auto function = module ? reinterpret_cast<RtlGetVersionFn>(GetProcAddress(module, "RtlGetVersion")) : nullptr; RTL_OSVERSIONINFOW info = {}; info.dwOSVersionInfoSize = sizeof(info);
    if (!function || function(&info) != 0) return LB_ReturnText(L"");
    return LB_ReturnText(std::to_wstring(info.dwMajorVersion) + L"." + std::to_wstring(info.dwMinorVersion) + L"." + std::to_wstring(info.dwBuildNumber));
}

int 系统_取处理器数量() { SYSTEM_INFO info = {}; GetNativeSystemInfo(&info); return static_cast<int>(info.dwNumberOfProcessors); }
long long 系统_取内存总量MB() { MEMORYSTATUSEX info = {}; info.dwLength = sizeof(info); return GlobalMemoryStatusEx(&info) ? static_cast<long long>(info.ullTotalPhys / 1024 / 1024) : -1; }
long long 系统_取内存可用MB() { MEMORYSTATUSEX info = {}; info.dwLength = sizeof(info); return GlobalMemoryStatusEx(&info) ? static_cast<long long>(info.ullAvailPhys / 1024 / 1024) : -1; }
const wchar_t* 系统_取环境变量(const wchar_t* name) { DWORD size = GetEnvironmentVariableW(name, nullptr, 0); if (!size) return LB_ReturnText(L""); std::vector<wchar_t> buffer(size); return GetEnvironmentVariableW(name, buffer.data(), size) ? LB_ReturnText(buffer.data()) : LB_ReturnText(L""); }
`;

const DISK_RUNTIME = String.raw`
#include <winioctl.h>

static thread_local DWORD g_lbDiskLastError = ERROR_SUCCESS;
static thread_local std::wstring g_lbDiskLastErrorText;

static void LB_DiskClearError() {
    g_lbDiskLastError = ERROR_SUCCESS;
    g_lbDiskLastErrorText.clear();
}

static void LB_DiskSetError(const wchar_t* context, DWORD error) {
    g_lbDiskLastError = error ? error : ERROR_GEN_FAILURE;
    wchar_t* systemText = nullptr;
    const DWORD length = FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        nullptr, g_lbDiskLastError, 0, reinterpret_cast<wchar_t*>(&systemText), 0, nullptr);
    std::wstring message = context ? context : L"磁盘查询失败";
    message += L"（错误 " + std::to_wstring(g_lbDiskLastError) + L"）";
    if (length && systemText) {
        std::wstring detail(systemText, length);
        while (!detail.empty() && (detail.back() == L'\r' || detail.back() == L'\n' || detail.back() == L' ')) detail.pop_back();
        if (!detail.empty()) message += L"：" + detail;
    }
    if (systemText) LocalFree(systemText);
    g_lbDiskLastErrorText = std::move(message);
}

static long long LB_DiskUnsignedToLongLong(ULONGLONG value) {
    return value > static_cast<ULONGLONG>(LLONG_MAX) ? LLONG_MAX : static_cast<long long>(value);
}

static std::wstring LB_DiskTrim(std::wstring value) {
    while (!value.empty() && iswspace(value.front())) value.erase(value.begin());
    while (!value.empty() && iswspace(value.back())) value.pop_back();
    return value;
}

static std::wstring LB_DiskLower(std::wstring value) {
    std::transform(value.begin(), value.end(), value.begin(), [](wchar_t character) { return static_cast<wchar_t>(towlower(character)); });
    return value;
}

static std::wstring LB_DiskDriveTypeName(UINT type) {
    switch (type) {
        case DRIVE_NO_ROOT_DIR: return L"无效根路径";
        case DRIVE_REMOVABLE: return L"可移动磁盘";
        case DRIVE_FIXED: return L"固定磁盘";
        case DRIVE_REMOTE: return L"网络驱动器";
        case DRIVE_CDROM: return L"光盘驱动器";
        case DRIVE_RAMDISK: return L"内存盘";
        default: return L"未知";
    }
}

static std::wstring LB_DiskPartitionStyleName(PARTITION_STYLE style) {
    if (style == PARTITION_STYLE_MBR) return L"MBR";
    if (style == PARTITION_STYLE_GPT) return L"GPT";
    return L"RAW";
}

static std::wstring LB_DiskBusTypeName(int type) {
    switch (type) {
        case 1: return L"SCSI"; case 2: return L"ATAPI"; case 3: return L"ATA";
        case 4: return L"IEEE 1394"; case 5: return L"SSA"; case 6: return L"光纤通道";
        case 7: return L"USB"; case 8: return L"RAID"; case 9: return L"iSCSI";
        case 10: return L"SAS"; case 11: return L"SATA"; case 12: return L"SD";
        case 13: return L"MMC"; case 14: return L"虚拟磁盘"; case 15: return L"文件后备虚拟磁盘";
        case 16: return L"存储空间"; case 17: return L"NVMe"; case 18: return L"存储级内存";
        case 19: return L"UFS"; default: return L"未知";
    }
}

static bool LB_DiskIsVolumeGuidPath(const std::wstring& value) {
    return value.size() > 12 && _wcsnicmp(value.c_str(), L"\\\\?\\Volume{", 11) == 0;
}

static bool LB_DiskResolveVolumeRoot(const wchar_t* path, std::wstring& root, DWORD& error) {
    std::wstring source = path && *path ? path : L".";
    if (LB_DiskIsVolumeGuidPath(source)) {
        if (source.back() != L'\\') source.push_back(L'\\');
        root = source;
        return true;
    }
    const DWORD required = GetFullPathNameW(source.c_str(), 0, nullptr, nullptr);
    if (!required) { error = GetLastError(); return false; }
    std::vector<wchar_t> full(static_cast<size_t>(required) + 1, L'\0');
    if (!GetFullPathNameW(source.c_str(), static_cast<DWORD>(full.size()), full.data(), nullptr)) { error = GetLastError(); return false; }
    std::vector<wchar_t> volumeRoot(MAX_PATH + 2, L'\0');
    if (!GetVolumePathNameW(full.data(), volumeRoot.data(), static_cast<DWORD>(volumeRoot.size()))) { error = GetLastError(); return false; }
    root = volumeRoot.data();
    return true;
}

static bool LB_DiskVolumeGuidForRoot(const std::wstring& root, std::wstring& volumeGuid, DWORD& error) {
    if (LB_DiskIsVolumeGuidPath(root)) { volumeGuid = root; return true; }
    std::vector<wchar_t> buffer(128, L'\0');
    if (!GetVolumeNameForVolumeMountPointW(root.c_str(), buffer.data(), static_cast<DWORD>(buffer.size()))) { error = GetLastError(); return false; }
    volumeGuid = buffer.data();
    return true;
}

static bool LB_DiskMountPointsForVolume(const std::wstring& volumeGuid, std::vector<std::wstring>& paths, DWORD& error) {
    DWORD required = 0;
    GetVolumePathNamesForVolumeNameW(volumeGuid.c_str(), nullptr, 0, &required);
    if (!required) { error = GetLastError(); return false; }
    std::vector<wchar_t> buffer(static_cast<size_t>(required) + 1, L'\0');
    if (!GetVolumePathNamesForVolumeNameW(volumeGuid.c_str(), buffer.data(), static_cast<DWORD>(buffer.size()), &required)) { error = GetLastError(); return false; }
    for (const wchar_t* item = buffer.data(); *item; item += wcslen(item) + 1) paths.emplace_back(item);
    return true;
}

static 磁盘容量信息 LB_DiskBuildCapacity(const wchar_t* path) {
    磁盘容量信息 result{};
    ULARGE_INTEGER available = {}, total = {}, free = {};
    if (!GetDiskFreeSpaceExW(path && *path ? path : L".", &available, &total, &free)) {
        result.错误代码 = static_cast<int>(GetLastError());
        return result;
    }
    result.查询成功 = true;
    result.总容量字节 = LB_DiskUnsignedToLongLong(total.QuadPart);
    result.用户可用字节 = LB_DiskUnsignedToLongLong(available.QuadPart);
    result.总空闲字节 = LB_DiskUnsignedToLongLong(free.QuadPart);
    result.已用容量字节 = result.总容量字节 >= result.总空闲字节 ? result.总容量字节 - result.总空闲字节 : 0;
    result.使用率 = result.总容量字节 > 0 ? static_cast<double>(result.已用容量字节) * 100.0 / static_cast<double>(result.总容量字节) : 0.0;
    return result;
}

static bool LB_DiskReadVolumeFields(const std::wstring& root, 磁盘卷信息& result, DWORD& error) {
    wchar_t label[MAX_PATH + 1] = {}, filesystem[MAX_PATH + 1] = {};
    DWORD serial = 0, maximum = 0, flags = 0;
    if (!GetVolumeInformationW(root.c_str(), label, _countof(label), &serial, &maximum, &flags, filesystem, _countof(filesystem))) {
        error = GetLastError();
        return false;
    }
    result.卷标 = label;
    result.文件系统 = filesystem;
    result.卷序列号 = static_cast<long long>(serial);
    result.最大文件名长度 = static_cast<int>(maximum);
    result.文件系统标志 = static_cast<long long>(flags);
    return true;
}

static 磁盘卷信息 LB_DiskBuildVolumeInfo(const wchar_t* path) {
    磁盘卷信息 result{};
    DWORD error = ERROR_SUCCESS;
    if (!LB_DiskResolveVolumeRoot(path, result.根路径, error)) {
        result.错误代码 = static_cast<int>(error);
        return result;
    }
    result.驱动器类型 = static_cast<int>(GetDriveTypeW(result.根路径.c_str()));
    result.驱动器类型名称 = LB_DiskDriveTypeName(static_cast<UINT>(result.驱动器类型));
    DWORD volumeError = ERROR_SUCCESS;
    const bool volumeOk = LB_DiskReadVolumeFields(result.根路径, result, volumeError);
    result.容量 = LB_DiskBuildCapacity(result.根路径.c_str());
    DWORD guidError = ERROR_SUCCESS;
    if (LB_DiskVolumeGuidForRoot(result.根路径, result.卷GUID路径, guidError)) {
        DWORD mountError = ERROR_SUCCESS;
        LB_DiskMountPointsForVolume(result.卷GUID路径, result.挂载点, mountError);
        if (LB_DiskIsVolumeGuidPath(result.根路径) && !result.挂载点.empty()) result.根路径 = result.挂载点.front();
    }
    result.是否就绪 = volumeOk && result.容量.查询成功;
    result.查询成功 = result.是否就绪;
    result.错误代码 = volumeOk ? result.容量.错误代码 : static_cast<int>(volumeError);
    return result;
}

static DWORD LB_DiskFeatureFlag(const wchar_t* featureName, bool& recognized) {
    const std::wstring name = LB_DiskLower(LB_DiskTrim(featureName ? featureName : L""));
    recognized = true;
    if (name == L"区分大小写" || name == L"case-sensitive" || name == L"file_case_sensitive_search") return FILE_CASE_SENSITIVE_SEARCH;
    if (name == L"保留大小写" || name == L"case-preserved" || name == L"file_case_preserved_names") return FILE_CASE_PRESERVED_NAMES;
    if (name == L"unicode" || name == L"file_unicode_on_disk") return FILE_UNICODE_ON_DISK;
    if (name == L"acl" || name == L"持久acl" || name == L"file_persistent_acls") return FILE_PERSISTENT_ACLS;
    if (name == L"文件压缩" || name == L"compression" || name == L"file_file_compression") return FILE_FILE_COMPRESSION;
    if (name == L"磁盘配额" || name == L"quota" || name == L"file_volume_quotas") return FILE_VOLUME_QUOTAS;
    if (name == L"稀疏文件" || name == L"sparse" || name == L"file_supports_sparse_files") return FILE_SUPPORTS_SPARSE_FILES;
    if (name == L"重解析点" || name == L"reparse" || name == L"file_supports_reparse_points") return FILE_SUPPORTS_REPARSE_POINTS;
    if (name == L"对象id" || name == L"object-id" || name == L"file_supports_object_ids") return FILE_SUPPORTS_OBJECT_IDS;
    if (name == L"加密" || name == L"encryption" || name == L"file_supports_encryption") return FILE_SUPPORTS_ENCRYPTION;
    if (name == L"命名流" || name == L"named-streams" || name == L"file_named_streams") return FILE_NAMED_STREAMS;
    if (name == L"只读卷" || name == L"read-only" || name == L"file_read_only_volume") return FILE_READ_ONLY_VOLUME;
    if (name == L"事务" || name == L"transactions" || name == L"file_supports_transactions") return FILE_SUPPORTS_TRANSACTIONS;
    if (name == L"硬链接" || name == L"hard-links" || name == L"file_supports_hard_links") return FILE_SUPPORTS_HARD_LINKS;
    if (name == L"扩展属性" || name == L"extended-attributes" || name == L"file_supports_extended_attributes") return FILE_SUPPORTS_EXTENDED_ATTRIBUTES;
    if (name == L"按文件id打开" || name == L"open-by-id" || name == L"file_supports_open_by_file_id") return FILE_SUPPORTS_OPEN_BY_FILE_ID;
    if (name == L"usn" || name == L"usn日志" || name == L"file_supports_usn_journal") return FILE_SUPPORTS_USN_JOURNAL;
    if (name == L"完整性流" || name == L"integrity-streams" || name == L"file_supports_integrity_streams") return FILE_SUPPORTS_INTEGRITY_STREAMS;
    if (name == L"dax" || name == L"file_dax_volume") return FILE_DAX_VOLUME;
    recognized = false;
    return 0;
}

static HANDLE LB_DiskOpenPhysical(int diskNumber, std::wstring& path, DWORD& error) {
    if (diskNumber < 0 || diskNumber > 65535) { error = ERROR_INVALID_PARAMETER; return INVALID_HANDLE_VALUE; }
    path = L"\\\\.\\PhysicalDrive" + std::to_wstring(diskNumber);
    HANDLE handle = CreateFileW(path.c_str(), 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr);
    if (handle == INVALID_HANDLE_VALUE) error = GetLastError();
    return handle;
}

static std::wstring LB_DiskAnsiDescriptorField(const std::vector<unsigned char>& buffer, DWORD offset) {
    if (!offset || offset >= buffer.size()) return {};
    const char* source = reinterpret_cast<const char*>(buffer.data() + offset);
    size_t length = 0, maximum = buffer.size() - offset;
    while (length < maximum && source[length]) ++length;
    if (!length) return {};
    const int required = MultiByteToWideChar(CP_ACP, 0, source, static_cast<int>(length), nullptr, 0);
    if (required <= 0) return {};
    std::wstring result(static_cast<size_t>(required), L'\0');
    MultiByteToWideChar(CP_ACP, 0, source, static_cast<int>(length), result.data(), required);
    return LB_DiskTrim(std::move(result));
}

static bool LB_DiskQueryDeviceDescriptor(HANDLE handle, std::vector<unsigned char>& buffer, DWORD& error) {
    STORAGE_PROPERTY_QUERY query{};
    query.PropertyId = StorageDeviceProperty;
    query.QueryType = PropertyStandardQuery;
    STORAGE_DESCRIPTOR_HEADER header{};
    DWORD returned = 0;
    if (!DeviceIoControl(handle, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), &header, sizeof(header), &returned, nullptr)) { error = GetLastError(); return false; }
    if (header.Size < sizeof(STORAGE_DEVICE_DESCRIPTOR) || header.Size > 1024 * 1024) { error = ERROR_INVALID_DATA; return false; }
    buffer.assign(header.Size, 0);
    if (!DeviceIoControl(handle, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), buffer.data(), static_cast<DWORD>(buffer.size()), &returned, nullptr)) { error = GetLastError(); return false; }
    return returned >= sizeof(STORAGE_DEVICE_DESCRIPTOR);
}

template <typename Descriptor>
static bool LB_DiskQueryProperty(HANDLE handle, STORAGE_PROPERTY_ID propertyId, Descriptor& descriptor) {
    STORAGE_PROPERTY_QUERY query{};
    query.PropertyId = propertyId;
    query.QueryType = PropertyStandardQuery;
    DWORD returned = 0;
    return DeviceIoControl(handle, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), &descriptor, sizeof(descriptor), &returned, nullptr) == TRUE
        && returned >= sizeof(descriptor);
}

static bool LB_DiskReadLayout(HANDLE handle, std::vector<unsigned char>& buffer, DWORD& error) {
    DWORD size = 64 * 1024;
    for (int attempt = 0; attempt < 7; ++attempt) {
        buffer.assign(size, 0);
        DWORD returned = 0;
        if (DeviceIoControl(handle, IOCTL_DISK_GET_DRIVE_LAYOUT_EX, nullptr, 0, buffer.data(), size, &returned, nullptr)) return returned >= sizeof(DRIVE_LAYOUT_INFORMATION_EX);
        error = GetLastError();
        if (error != ERROR_INSUFFICIENT_BUFFER && error != ERROR_MORE_DATA) return false;
        size *= 2;
    }
    error = ERROR_INSUFFICIENT_BUFFER;
    return false;
}

static 物理磁盘信息 LB_DiskBuildPhysicalInfo(int diskNumber) {
    物理磁盘信息 result{};
    result.磁盘编号 = diskNumber;
    DWORD error = ERROR_SUCCESS;
    HANDLE handle = LB_DiskOpenPhysical(diskNumber, result.设备路径, error);
    if (handle == INVALID_HANDLE_VALUE) { result.错误代码 = static_cast<int>(error); return result; }

    std::vector<unsigned char> descriptorBuffer;
    DWORD descriptorError = ERROR_SUCCESS;
    if (LB_DiskQueryDeviceDescriptor(handle, descriptorBuffer, descriptorError)) {
        const auto* descriptor = reinterpret_cast<const STORAGE_DEVICE_DESCRIPTOR*>(descriptorBuffer.data());
        result.厂商 = LB_DiskAnsiDescriptorField(descriptorBuffer, descriptor->VendorIdOffset);
        result.产品 = LB_DiskAnsiDescriptorField(descriptorBuffer, descriptor->ProductIdOffset);
        result.修订版本 = LB_DiskAnsiDescriptorField(descriptorBuffer, descriptor->ProductRevisionOffset);
        result.序列号 = LB_DiskAnsiDescriptorField(descriptorBuffer, descriptor->SerialNumberOffset);
        result.设备类型 = static_cast<int>(descriptor->DeviceType);
        result.总线类型 = static_cast<int>(descriptor->BusType);
        result.总线类型名称 = LB_DiskBusTypeName(result.总线类型);
        result.可移动介质 = descriptor->RemovableMedia != FALSE;
        result.支持命令队列 = descriptor->CommandQueueing != FALSE;
    }

    GET_LENGTH_INFORMATION length{};
    DWORD returned = 0;
    if (DeviceIoControl(handle, IOCTL_DISK_GET_LENGTH_INFO, nullptr, 0, &length, sizeof(length), &returned, nullptr)) result.容量字节 = length.Length.QuadPart;

    DISK_GEOMETRY_EX geometry{};
    if (DeviceIoControl(handle, IOCTL_DISK_GET_DRIVE_GEOMETRY_EX, nullptr, 0, &geometry, sizeof(geometry), &returned, nullptr)) {
        result.逻辑扇区字节 = static_cast<int>(geometry.Geometry.BytesPerSector);
        if (result.容量字节 <= 0) result.容量字节 = geometry.DiskSize.QuadPart;
    }

    STORAGE_ACCESS_ALIGNMENT_DESCRIPTOR alignment{};
    alignment.Version = sizeof(alignment); alignment.Size = sizeof(alignment);
    if (LB_DiskQueryProperty(handle, StorageAccessAlignmentProperty, alignment)) {
        if (alignment.BytesPerLogicalSector) result.逻辑扇区字节 = static_cast<int>(alignment.BytesPerLogicalSector);
        result.物理扇区字节 = static_cast<int>(alignment.BytesPerPhysicalSector);
    }

    DEVICE_SEEK_PENALTY_DESCRIPTOR seek{};
    seek.Version = sizeof(seek); seek.Size = sizeof(seek);
    if (LB_DiskQueryProperty(handle, StorageDeviceSeekPenaltyProperty, seek)) {
        result.固态判断有效 = true;
        result.是否固态 = seek.IncursSeekPenalty == FALSE;
    }

    DEVICE_TRIM_DESCRIPTOR trim{};
    trim.Version = sizeof(trim); trim.Size = sizeof(trim);
    if (LB_DiskQueryProperty(handle, StorageDeviceTrimProperty, trim)) {
        result.TRIM判断有效 = true;
        result.是否支持TRIM = trim.TrimEnabled != FALSE;
    }

    std::vector<unsigned char> layoutBuffer;
    DWORD layoutError = ERROR_SUCCESS;
    if (LB_DiskReadLayout(handle, layoutBuffer, layoutError)) {
        const auto* layout = reinterpret_cast<const DRIVE_LAYOUT_INFORMATION_EX*>(layoutBuffer.data());
        result.分区样式 = static_cast<int>(layout->PartitionStyle);
        result.分区样式名称 = LB_DiskPartitionStyleName(static_cast<PARTITION_STYLE>(layout->PartitionStyle));
        result.分区数量 = static_cast<int>(layout->PartitionCount);
    }
    CloseHandle(handle);
    result.查询成功 = !descriptorBuffer.empty() || result.容量字节 > 0 || !layoutBuffer.empty();
    result.错误代码 = result.查询成功 ? 0 : static_cast<int>(descriptorError ? descriptorError : ERROR_GEN_FAILURE);
    return result;
}

static std::vector<int> LB_DiskEnumeratePhysicalNumbers(DWORD& error) {
    DWORD size = 32768;
    std::vector<wchar_t> buffer(size, L'\0');
    for (;;) {
        const DWORD result = QueryDosDeviceW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
        if (result) break;
        error = GetLastError();
        if (error != ERROR_INSUFFICIENT_BUFFER || size >= 1024 * 1024) return {};
        size *= 2;
        buffer.assign(size, L'\0');
    }
    std::vector<int> numbers;
    for (const wchar_t* item = buffer.data(); *item; item += wcslen(item) + 1) {
        if (_wcsnicmp(item, L"PhysicalDrive", 13) != 0 || !iswdigit(item[13])) continue;
        wchar_t* end = nullptr;
        const long number = wcstol(item + 13, &end, 10);
        if (end && *end == L'\0' && number >= 0 && number <= 65535) numbers.push_back(static_cast<int>(number));
    }
    std::sort(numbers.begin(), numbers.end());
    numbers.erase(std::unique(numbers.begin(), numbers.end()), numbers.end());
    return numbers;
}

static std::wstring LB_DiskGuidText(const GUID& value) {
    wchar_t buffer[64] = {};
    return StringFromGUID2(value, buffer, _countof(buffer)) > 0 ? std::wstring(buffer) : std::wstring();
}

磁盘容量信息 磁盘_取容量信息(const wchar_t* path) {
    磁盘容量信息 result = LB_DiskBuildCapacity(path);
    if (result.查询成功) LB_DiskClearError(); else LB_DiskSetError(L"读取磁盘容量失败", static_cast<DWORD>(result.错误代码));
    return result;
}

long long 磁盘_取总容量字节(const wchar_t* path) { const auto result = 磁盘_取容量信息(path); return result.查询成功 ? result.总容量字节 : -1; }
long long 磁盘_取用户可用字节(const wchar_t* path) { const auto result = 磁盘_取容量信息(path); return result.查询成功 ? result.用户可用字节 : -1; }
long long 磁盘_取总空闲字节(const wchar_t* path) { const auto result = 磁盘_取容量信息(path); return result.查询成功 ? result.总空闲字节 : -1; }
long long 磁盘_取已用容量字节(const wchar_t* path) { const auto result = 磁盘_取容量信息(path); return result.查询成功 ? result.已用容量字节 : -1; }
double 磁盘_取使用率(const wchar_t* path) { const auto result = 磁盘_取容量信息(path); return result.查询成功 ? result.使用率 : -1.0; }
long long 磁盘_总容量MB(const wchar_t* path) { const long long bytes = 磁盘_取总容量字节(path); return bytes < 0 ? -1 : bytes / 1024 / 1024; }
long long 磁盘_可用容量MB(const wchar_t* path) { const long long bytes = 磁盘_取用户可用字节(path); return bytes < 0 ? -1 : bytes / 1024 / 1024; }

磁盘卷信息 磁盘_取卷信息(const wchar_t* path) {
    磁盘卷信息 result = LB_DiskBuildVolumeInfo(path);
    if (result.查询成功) LB_DiskClearError(); else LB_DiskSetError(L"读取卷信息失败", static_cast<DWORD>(result.错误代码));
    return result;
}

const wchar_t* 磁盘_取卷标(const wchar_t* root) { return LB_ReturnText(磁盘_取卷信息(root).卷标); }
const wchar_t* 磁盘_取文件系统(const wchar_t* root) { return LB_ReturnText(磁盘_取卷信息(root).文件系统); }
int 磁盘_取驱动器类型(const wchar_t* root) {
    std::wstring volumeRoot; DWORD error = ERROR_SUCCESS;
    if (!LB_DiskResolveVolumeRoot(root, volumeRoot, error)) { LB_DiskSetError(L"解析驱动器根路径失败", error); return DRIVE_UNKNOWN; }
    LB_DiskClearError();
    return static_cast<int>(GetDriveTypeW(volumeRoot.c_str()));
}
const wchar_t* 磁盘_取驱动器类型名称(const wchar_t* root) { return LB_ReturnText(LB_DiskDriveTypeName(static_cast<UINT>(磁盘_取驱动器类型(root)))); }

std::vector<磁盘卷信息> 磁盘_枚举逻辑驱动器() {
    const DWORD required = GetLogicalDriveStringsW(0, nullptr);
    if (!required) { LB_DiskSetError(L"枚举逻辑驱动器失败", GetLastError()); return {}; }
    std::vector<wchar_t> buffer(static_cast<size_t>(required) + 1, L'\0');
    if (!GetLogicalDriveStringsW(static_cast<DWORD>(buffer.size()), buffer.data())) { LB_DiskSetError(L"枚举逻辑驱动器失败", GetLastError()); return {}; }
    std::vector<磁盘卷信息> result;
    for (const wchar_t* item = buffer.data(); *item; item += wcslen(item) + 1) result.push_back(LB_DiskBuildVolumeInfo(item));
    LB_DiskClearError();
    return result;
}

std::vector<磁盘卷信息> 磁盘_枚举全部卷() {
    std::vector<wchar_t> buffer(1024, L'\0');
    HANDLE search = FindFirstVolumeW(buffer.data(), static_cast<DWORD>(buffer.size()));
    if (search == INVALID_HANDLE_VALUE) { LB_DiskSetError(L"枚举 Windows 卷失败", GetLastError()); return {}; }
    std::vector<磁盘卷信息> result;
    for (;;) {
        result.push_back(LB_DiskBuildVolumeInfo(buffer.data()));
        if (FindNextVolumeW(search, buffer.data(), static_cast<DWORD>(buffer.size()))) continue;
        const DWORD error = GetLastError();
        FindVolumeClose(search);
        if (error != ERROR_NO_MORE_FILES) { LB_DiskSetError(L"枚举 Windows 卷失败", error); return {}; }
        break;
    }
    LB_DiskClearError();
    return result;
}

std::vector<std::wstring> 磁盘_取挂载点列表(const wchar_t* volumeGuidPath) {
    std::wstring volumeGuid = volumeGuidPath ? volumeGuidPath : L"";
    DWORD error = ERROR_SUCCESS;
    if (!LB_DiskIsVolumeGuidPath(volumeGuid)) {
        std::wstring root;
        if (!LB_DiskResolveVolumeRoot(volumeGuid.c_str(), root, error) || !LB_DiskVolumeGuidForRoot(root, volumeGuid, error)) {
            LB_DiskSetError(L"解析卷 GUID 失败", error); return {};
        }
    }
    std::vector<std::wstring> result;
    if (!LB_DiskMountPointsForVolume(volumeGuid, result, error)) { LB_DiskSetError(L"读取卷挂载点失败", error); return {}; }
    LB_DiskClearError();
    return result;
}

const wchar_t* 磁盘_取路径卷根(const wchar_t* path) {
    std::wstring root; DWORD error = ERROR_SUCCESS;
    if (!LB_DiskResolveVolumeRoot(path, root, error)) { LB_DiskSetError(L"解析路径卷根失败", error); return LB_ReturnText(L""); }
    LB_DiskClearError(); return LB_ReturnText(std::move(root));
}

const wchar_t* 磁盘_取卷GUID路径(const wchar_t* path) {
    std::wstring root, volumeGuid; DWORD error = ERROR_SUCCESS;
    if (!LB_DiskResolveVolumeRoot(path, root, error) || !LB_DiskVolumeGuidForRoot(root, volumeGuid, error)) { LB_DiskSetError(L"读取卷 GUID 路径失败", error); return LB_ReturnText(L""); }
    LB_DiskClearError(); return LB_ReturnText(std::move(volumeGuid));
}

long long 磁盘_取卷序列号(const wchar_t* root) { const auto result = 磁盘_取卷信息(root); return result.查询成功 ? result.卷序列号 : -1; }
long long 磁盘_取文件系统标志(const wchar_t* root) { const auto result = 磁盘_取卷信息(root); return result.查询成功 ? result.文件系统标志 : -1; }
int 磁盘_取最大文件名长度(const wchar_t* root) { const auto result = 磁盘_取卷信息(root); return result.查询成功 ? result.最大文件名长度 : -1; }
bool 磁盘_卷是否就绪(const wchar_t* root) { return 磁盘_取卷信息(root).是否就绪; }

bool 磁盘_文件系统是否支持(const wchar_t* root, const wchar_t* featureName) {
    bool recognized = false;
    const DWORD requested = LB_DiskFeatureFlag(featureName, recognized);
    if (!recognized) { LB_DiskSetError(L"未知的文件系统能力名称", ERROR_INVALID_PARAMETER); return false; }
    const auto result = 磁盘_取卷信息(root);
    return result.查询成功 && (static_cast<DWORD>(result.文件系统标志) & requested) != 0;
}

物理磁盘信息 磁盘_取物理磁盘信息(int diskNumber) {
    物理磁盘信息 result = LB_DiskBuildPhysicalInfo(diskNumber);
    if (result.查询成功) LB_DiskClearError(); else LB_DiskSetError(L"读取物理磁盘信息失败", static_cast<DWORD>(result.错误代码));
    return result;
}

std::vector<物理磁盘信息> 磁盘_枚举物理磁盘() {
    DWORD error = ERROR_SUCCESS;
    const std::vector<int> numbers = LB_DiskEnumeratePhysicalNumbers(error);
    if (numbers.empty() && error != ERROR_SUCCESS) { LB_DiskSetError(L"枚举物理磁盘失败", error); return {}; }
    std::vector<物理磁盘信息> result;
    result.reserve(numbers.size());
    for (int number : numbers) result.push_back(LB_DiskBuildPhysicalInfo(number));
    LB_DiskClearError();
    return result;
}

std::vector<磁盘分区信息> 磁盘_取分区列表(int diskNumber) {
    std::wstring path; DWORD error = ERROR_SUCCESS;
    HANDLE handle = LB_DiskOpenPhysical(diskNumber, path, error);
    if (handle == INVALID_HANDLE_VALUE) { LB_DiskSetError(L"打开物理磁盘失败", error); return {}; }
    std::vector<unsigned char> buffer;
    if (!LB_DiskReadLayout(handle, buffer, error)) { CloseHandle(handle); LB_DiskSetError(L"读取磁盘分区布局失败", error); return {}; }
    CloseHandle(handle);
    const auto* layout = reinterpret_cast<const DRIVE_LAYOUT_INFORMATION_EX*>(buffer.data());
    std::vector<磁盘分区信息> result;
    result.reserve(layout->PartitionCount);
    for (DWORD index = 0; index < layout->PartitionCount; ++index) {
        const PARTITION_INFORMATION_EX& entry = layout->PartitionEntry[index];
        if (entry.PartitionLength.QuadPart <= 0) continue;
        磁盘分区信息 item{};
        item.磁盘编号 = diskNumber;
        item.分区编号 = static_cast<int>(entry.PartitionNumber);
        item.分区样式 = static_cast<int>(entry.PartitionStyle);
        item.分区样式名称 = LB_DiskPartitionStyleName(static_cast<PARTITION_STYLE>(entry.PartitionStyle));
        item.起始偏移字节 = entry.StartingOffset.QuadPart;
        item.长度字节 = entry.PartitionLength.QuadPart;
        if (entry.PartitionStyle == PARTITION_STYLE_GPT) {
            item.类型标识 = LB_DiskGuidText(entry.Gpt.PartitionType);
            item.名称.assign(entry.Gpt.Name, wcsnlen_s(entry.Gpt.Name, _countof(entry.Gpt.Name)));
            item.属性 = static_cast<long long>(entry.Gpt.Attributes);
            item.是否可识别 = true;
        } else if (entry.PartitionStyle == PARTITION_STYLE_MBR) {
            wchar_t typeText[16] = {};
            swprintf_s(typeText, L"0x%02X", static_cast<unsigned int>(entry.Mbr.PartitionType));
            item.类型标识 = typeText;
            item.是否活动分区 = entry.Mbr.BootIndicator != FALSE;
            item.是否可识别 = entry.Mbr.RecognizedPartition != FALSE;
            item.属性 = entry.Mbr.HiddenSectors;
        }
        result.push_back(std::move(item));
    }
    LB_DiskClearError();
    return result;
}

int 磁盘_取最近错误码() { return static_cast<int>(g_lbDiskLastError); }
const wchar_t* 磁盘_取最近错误() { return LB_ReturnText(g_lbDiskLastErrorText); }
`;

const CLIPBOARD_RUNTIME = String.raw`
static constexpr size_t LB_CLIPBOARD_MAX_IMAGE_BYTES = 256ULL * 1024ULL * 1024ULL;
static constexpr size_t LB_CLIPBOARD_MAX_HTML_BYTES = ((LB_CLIPBOARD_MAX_IMAGE_BYTES + 2ULL) / 3ULL) * 4ULL + 4096ULL;

static bool LB_ClipboardNormalizeDib(const std::vector<unsigned char>& input, std::vector<unsigned char>& dib) {
    dib.clear();
    if (input.empty() || input.size() > LB_CLIPBOARD_MAX_IMAGE_BYTES) return false;
    const auto isDib = [](const unsigned char* data, size_t size) {
        if (size < sizeof(DWORD)) return false;
        DWORD headerSize = 0;
        std::memcpy(&headerSize, data, sizeof(headerSize));
        if (headerSize < sizeof(BITMAPINFOHEADER) || headerSize > sizeof(BITMAPV5HEADER) || headerSize > size) return false;
        BITMAPINFOHEADER header = {};
        std::memcpy(&header, data, sizeof(header));
        if (header.biPlanes != 1 || header.biWidth <= 0 || header.biHeight == 0) return false;
        if (header.biBitCount == 0 || header.biBitCount > 32) return false;
        if (header.biSizeImage > 0 && static_cast<size_t>(header.biSizeImage) > size - headerSize) return false;
        return true;
    };
    if (isDib(input.data(), input.size())) {
        dib = input;
        return true;
    }
    if (input.size() < sizeof(BITMAPFILEHEADER)) return false;
    BITMAPFILEHEADER file = {};
    std::memcpy(&file, input.data(), sizeof(file));
    if (file.bfType != 0x4D42 || file.bfOffBits < sizeof(BITMAPFILEHEADER) || file.bfOffBits >= input.size()) return false;
    const size_t dibSize = input.size() - sizeof(BITMAPFILEHEADER);
    if (!isDib(input.data() + sizeof(BITMAPFILEHEADER), dibSize)) return false;
    dib.assign(input.begin() + static_cast<std::ptrdiff_t>(sizeof(BITMAPFILEHEADER)), input.end());
    return true;
}

static bool LB_ClipboardIsGif(const std::vector<unsigned char>& bytes) {
    if (bytes.size() < 13 || bytes.size() > LB_CLIPBOARD_MAX_IMAGE_BYTES) return false;
    const bool signature = std::memcmp(bytes.data(), "GIF87a", 6) == 0 || std::memcmp(bytes.data(), "GIF89a", 6) == 0;
    const unsigned int width = static_cast<unsigned int>(bytes[6]) | (static_cast<unsigned int>(bytes[7]) << 8);
    const unsigned int height = static_cast<unsigned int>(bytes[8]) | (static_cast<unsigned int>(bytes[9]) << 8);
    return signature && width > 0 && height > 0;
}

static UINT LB_ClipboardGifFormat() {
    static const UINT format = RegisterClipboardFormatW(L"GIF");
    return format;
}

static UINT LB_ClipboardGifMimeFormat() {
    static const UINT format = RegisterClipboardFormatW(L"image/gif");
    return format;
}

static UINT LB_ClipboardHtmlFormat() {
    static const UINT format = RegisterClipboardFormatW(L"HTML Format");
    return format;
}

static HGLOBAL LB_ClipboardGlobalBytes(const void* data, size_t size) {
    if (!data || size == 0 || size > LB_CLIPBOARD_MAX_HTML_BYTES) return nullptr;
    HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, size);
    if (!memory) return nullptr;
    void* target = GlobalLock(memory);
    if (!target) { GlobalFree(memory); return nullptr; }
    std::memcpy(target, data, size); GlobalUnlock(memory);
    return memory;
}

static std::string LB_ClipboardBase64(const std::vector<unsigned char>& bytes) {
    static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    result.reserve(((bytes.size() + 2) / 3) * 4);
    for (size_t offset = 0; offset < bytes.size(); offset += 3) {
        const unsigned int a = bytes[offset];
        const unsigned int b = offset + 1 < bytes.size() ? bytes[offset + 1] : 0;
        const unsigned int c = offset + 2 < bytes.size() ? bytes[offset + 2] : 0;
        const unsigned int block = (a << 16) | (b << 8) | c;
        result.push_back(alphabet[(block >> 18) & 63]);
        result.push_back(alphabet[(block >> 12) & 63]);
        result.push_back(offset + 1 < bytes.size() ? alphabet[(block >> 6) & 63] : '=');
        result.push_back(offset + 2 < bytes.size() ? alphabet[block & 63] : '=');
    }
    return result;
}

static std::string LB_ClipboardGifHtml(const std::vector<unsigned char>& bytes) {
    const std::string image = "<img src=\"data:image/gif;base64," + LB_ClipboardBase64(bytes) + "\">";
    const std::string body = "<html><body><!--StartFragment-->" + image + "<!--EndFragment--></body></html>";
    std::string header = "Version:1.0\r\nStartHTML:0000000000\r\nEndHTML:0000000000\r\nStartFragment:0000000000\r\nEndFragment:0000000000\r\n";
    const size_t startHtml = header.size();
    const size_t startFragment = startHtml + body.find(image);
    const size_t endFragment = startFragment + image.size();
    const size_t endHtml = startHtml + body.size();
    const auto offsetText = [](size_t value) {
        std::string text = std::to_string(value);
        return text.size() < 10 ? std::string(10 - text.size(), '0') + text : text;
    };
    const auto replaceOffset = [&header, &offsetText](const char* label, size_t value) {
        const size_t labelPosition = header.find(label);
        if (labelPosition == std::string::npos) return;
        const size_t valuePosition = labelPosition + std::strlen(label);
        header.replace(valuePosition, 10, offsetText(value));
    };
    replaceOffset("StartHTML:", startHtml);
    replaceOffset("EndHTML:", endHtml);
    replaceOffset("StartFragment:", startFragment);
    replaceOffset("EndFragment:", endFragment);
    return header + body;
}

static bool LB_ClipboardSetGif(const std::vector<unsigned char>& bytes) {
    const UINT gifFormat = LB_ClipboardGifFormat();
    const UINT gifMimeFormat = LB_ClipboardGifMimeFormat();
    const UINT htmlFormat = LB_ClipboardHtmlFormat();
    if (!gifFormat) return false;
    HGLOBAL gifMemory = LB_ClipboardGlobalBytes(bytes.data(), bytes.size());
    if (!gifMemory) return false;
    HGLOBAL gifMimeMemory = nullptr;
    if (gifMimeFormat && gifMimeFormat != gifFormat) {
        gifMimeMemory = LB_ClipboardGlobalBytes(bytes.data(), bytes.size());
    }
    HGLOBAL htmlMemory = nullptr;
    try {
        const std::string html = LB_ClipboardGifHtml(bytes);
        if (htmlFormat) htmlMemory = LB_ClipboardGlobalBytes(html.c_str(), html.size() + 1);
    } catch (...) {
        // GIF 注册格式仍可独立承载动图；HTML 只是兼容网页粘贴的可选载荷。
    }
    if (!OpenClipboard(nullptr)) { GlobalFree(htmlMemory); GlobalFree(gifMimeMemory); GlobalFree(gifMemory); return false; }
    if (!EmptyClipboard()) { CloseClipboard(); if (htmlMemory) GlobalFree(htmlMemory); if (gifMimeMemory) GlobalFree(gifMimeMemory); GlobalFree(gifMemory); return false; }
    if (!SetClipboardData(gifFormat, gifMemory)) {
        if (htmlMemory) GlobalFree(htmlMemory); if (gifMimeMemory) GlobalFree(gifMimeMemory); GlobalFree(gifMemory); CloseClipboard(); return false;
    }
    if (gifMimeMemory && !SetClipboardData(gifMimeFormat, gifMimeMemory)) {
        GlobalFree(gifMimeMemory);
    }
    if (htmlMemory && !SetClipboardData(htmlFormat, htmlMemory)) {
        GlobalFree(htmlMemory);
    }
    CloseClipboard(); return true;
}

static std::vector<unsigned char> LB_ClipboardReadGlobalBytes(UINT format);

static std::vector<unsigned char> LB_ClipboardReadGifBytes() {
    std::vector<unsigned char> result = LB_ClipboardReadGlobalBytes(LB_ClipboardGifFormat());
    if (!LB_ClipboardIsGif(result)) result.clear();
    if (result.empty()) {
        result = LB_ClipboardReadGlobalBytes(LB_ClipboardGifMimeFormat());
        if (!LB_ClipboardIsGif(result)) result.clear();
    }
    return result;
}

static std::vector<unsigned char> LB_ClipboardReadGlobalBytes(UINT format) {
    std::vector<unsigned char> result;
    if (!format) return result;
    HANDLE data = GetClipboardData(format);
    if (!data) return result;
    const SIZE_T size = GlobalSize(data);
    if (size == 0 || size > LB_CLIPBOARD_MAX_IMAGE_BYTES) return result;
    const void* source = GlobalLock(data);
    if (!source) return result;
    result.assign(static_cast<const unsigned char*>(source), static_cast<const unsigned char*>(source) + size);
    GlobalUnlock(data);
    return result;
}

static UINT LB_ClipboardDibFormat(const std::vector<unsigned char>& dib) {
    DWORD headerSize = 0;
    if (dib.size() >= sizeof(headerSize)) std::memcpy(&headerSize, dib.data(), sizeof(headerSize));
    if (headerSize >= sizeof(BITMAPV5HEADER)) return CF_DIBV5;
    return CF_DIB;
}

static bool LB_ClipboardBitmapToDib(HBITMAP bitmap, std::vector<unsigned char>& dib) {
    dib.clear();
    if (!bitmap) return false;
    BITMAP source = {};
    if (!GetObjectW(bitmap, sizeof(source), &source) || source.bmWidth <= 0 || source.bmHeight <= 0 || source.bmWidth > 32768 || source.bmHeight > 32768) return false;
    const ULONGLONG pixelBytes64 = static_cast<ULONGLONG>(source.bmWidth) * static_cast<ULONGLONG>(source.bmHeight) * 4ULL;
    if (pixelBytes64 > LB_CLIPBOARD_MAX_IMAGE_BYTES - sizeof(BITMAPINFOHEADER)) return false;
    const size_t pixelBytes = static_cast<size_t>(pixelBytes64);
    dib.resize(sizeof(BITMAPINFOHEADER) + pixelBytes);
    auto* header = reinterpret_cast<BITMAPINFOHEADER*>(dib.data());
    header->biSize = sizeof(BITMAPINFOHEADER); header->biWidth = source.bmWidth; header->biHeight = source.bmHeight;
    header->biPlanes = 1; header->biBitCount = 32; header->biCompression = BI_RGB; header->biSizeImage = static_cast<DWORD>(pixelBytes);
    HDC screen = GetDC(nullptr);
    const int rows = screen ? GetDIBits(screen, bitmap, 0, static_cast<UINT>(source.bmHeight), dib.data() + sizeof(BITMAPINFOHEADER), reinterpret_cast<BITMAPINFO*>(header), DIB_RGB_COLORS) : 0;
    if (screen) ReleaseDC(nullptr, screen);
    if (rows != source.bmHeight) { dib.clear(); return false; }
    return true;
}

bool 剪贴板_置文本(const wchar_t* text) {
    const std::wstring value = LB_Wide(text);
    if (value.size() > (std::numeric_limits<SIZE_T>::max() / sizeof(wchar_t)) - 1) return false;
    const SIZE_T bytes = (value.size() + 1) * sizeof(wchar_t);
    HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, bytes);
    if (!memory) return false;
    void* target = GlobalLock(memory);
    if (!target) { GlobalFree(memory); return false; }
    std::memcpy(target, value.c_str(), bytes); GlobalUnlock(memory);
    if (!OpenClipboard(nullptr)) { GlobalFree(memory); return false; }
    if (!EmptyClipboard()) { CloseClipboard(); GlobalFree(memory); return false; }
    if (!SetClipboardData(CF_UNICODETEXT, memory)) { GlobalFree(memory); CloseClipboard(); return false; }
    CloseClipboard(); return true;
}

const wchar_t* 剪贴板_取文本() {
    if (!OpenClipboard(nullptr)) return LB_ReturnText(L"");
    HANDLE data = GetClipboardData(CF_UNICODETEXT);
    const SIZE_T byteSize = data ? GlobalSize(data) : 0;
    const wchar_t* text = data && byteSize >= sizeof(wchar_t) ? static_cast<const wchar_t*>(GlobalLock(data)) : nullptr;
    std::wstring result;
    if (text) {
        const size_t maxCharacters = static_cast<size_t>(byteSize / sizeof(wchar_t));
        size_t length = 0;
        while (length < maxCharacters && text[length] != L'\0') ++length;
        result.assign(text, length);
        GlobalUnlock(data);
    }
    CloseClipboard(); return LB_ReturnText(std::move(result));
}
bool 剪贴板_是否有文本() { return IsClipboardFormatAvailable(CF_UNICODETEXT) == TRUE; }
bool 剪贴板_置图片字节集(const std::vector<unsigned char>& imageBytes) {
    if (LB_ClipboardIsGif(imageBytes)) return LB_ClipboardSetGif(imageBytes);
    std::vector<unsigned char> dib;
    if (!LB_ClipboardNormalizeDib(imageBytes, dib)) return false;
    HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, dib.size());
    if (!memory) return false;
    void* target = GlobalLock(memory);
    if (!target) { GlobalFree(memory); return false; }
    std::memcpy(target, dib.data(), dib.size()); GlobalUnlock(memory);
    if (!OpenClipboard(nullptr)) { GlobalFree(memory); return false; }
    if (!EmptyClipboard()) { CloseClipboard(); GlobalFree(memory); return false; }
    if (!SetClipboardData(LB_ClipboardDibFormat(dib), memory)) { GlobalFree(memory); CloseClipboard(); return false; }
    CloseClipboard(); return true;
}

std::vector<unsigned char> 剪贴板_取图片字节集() {
    if (!OpenClipboard(nullptr)) return {};
    std::vector<unsigned char> result = LB_ClipboardReadGifBytes();
    if (result.empty()) result = LB_ClipboardReadGlobalBytes(IsClipboardFormatAvailable(CF_DIBV5) ? CF_DIBV5 : (IsClipboardFormatAvailable(CF_DIB) ? CF_DIB : 0));
    if (result.empty() && IsClipboardFormatAvailable(CF_BITMAP)) LB_ClipboardBitmapToDib(static_cast<HBITMAP>(GetClipboardData(CF_BITMAP)), result);
    CloseClipboard(); return result;
}

bool 剪贴板_置GIF字节集(const std::vector<unsigned char>& imageBytes) { return LB_ClipboardIsGif(imageBytes) && LB_ClipboardSetGif(imageBytes); }
std::vector<unsigned char> 剪贴板_取GIF字节集() {
    if (!OpenClipboard(nullptr)) return {};
    std::vector<unsigned char> result = LB_ClipboardReadGifBytes();
    CloseClipboard();
    return result;
}
bool 剪贴板_是否有图片() { return IsClipboardFormatAvailable(LB_ClipboardGifFormat()) == TRUE || IsClipboardFormatAvailable(LB_ClipboardGifMimeFormat()) == TRUE || IsClipboardFormatAvailable(CF_DIBV5) == TRUE || IsClipboardFormatAvailable(CF_DIB) == TRUE || IsClipboardFormatAvailable(CF_BITMAP) == TRUE; }
const wchar_t* 剪贴板_取图片格式() {
    if (IsClipboardFormatAvailable(LB_ClipboardGifFormat()) || IsClipboardFormatAvailable(LB_ClipboardGifMimeFormat())) return LB_ReturnText(L"GIF");
    if (IsClipboardFormatAvailable(CF_DIBV5)) return LB_ReturnText(L"CF_DIBV5");
    if (IsClipboardFormatAvailable(CF_DIB)) return LB_ReturnText(L"CF_DIB");
    if (IsClipboardFormatAvailable(CF_BITMAP)) return LB_ReturnText(L"CF_BITMAP");
    return LB_ReturnText(L"");
}
bool 剪贴板_清空() { if (!OpenClipboard(nullptr)) return false; const bool success = EmptyClipboard() == TRUE; CloseClipboard(); return success; }
`;

const SHELL_RUNTIME = String.raw`
bool 系统_打开(const wchar_t* target) { return reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", target, nullptr, nullptr, SW_SHOWNORMAL)) > 32; }
bool 系统_定位文件(const wchar_t* path) { std::wstring arguments = L"/select,\"" + LB_Wide(path) + L"\""; return reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", L"explorer.exe", arguments.c_str(), nullptr, SW_SHOWNORMAL)) > 32; }
const wchar_t* 系统_取临时目录() { DWORD size = GetTempPathW(0, nullptr); if (!size) return LB_ReturnText(L""); std::vector<wchar_t> buffer(size + 1); return GetTempPathW(static_cast<DWORD>(buffer.size()), buffer.data()) ? LB_ReturnText(buffer.data()) : LB_ReturnText(L""); }

static const wchar_t* LB_KnownFolder(REFKNOWNFOLDERID id) { PWSTR path = nullptr; if (FAILED(SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, nullptr, &path))) return LB_ReturnText(L""); std::wstring value = path; CoTaskMemFree(path); return LB_ReturnText(std::move(value)); }
const wchar_t* 系统_取桌面目录() { return LB_KnownFolder(FOLDERID_Desktop); }
const wchar_t* 系统_取文档目录() { return LB_KnownFolder(FOLDERID_Documents); }
`;

const PROCESS_RUNTIME = String.raw`
static bool LB_StartProcess(const wchar_t* commandLine, const wchar_t* workingDirectory, PROCESS_INFORMATION& process) {
    std::wstring command = LB_Wide(commandLine); if (command.empty()) return false; std::vector<wchar_t> mutableCommand(command.begin(), command.end()); mutableCommand.push_back(L'\0');
    STARTUPINFOW startup = {}; startup.cb = sizeof(startup); process = {}; return CreateProcessW(nullptr, mutableCommand.data(), nullptr, nullptr, FALSE, 0, nullptr, workingDirectory && workingDirectory[0] ? workingDirectory : nullptr, &startup, &process) == TRUE;
}

int 程序_启动(const wchar_t* commandLine, const wchar_t* workingDirectory) { PROCESS_INFORMATION process = {}; if (!LB_StartProcess(commandLine, workingDirectory, process)) return 0; const int id = static_cast<int>(process.dwProcessId); CloseHandle(process.hThread); CloseHandle(process.hProcess); return id; }

int 程序_启动并等待(const wchar_t* commandLine, const wchar_t* workingDirectory, int timeoutMs) {
    PROCESS_INFORMATION process = {}; if (!LB_StartProcess(commandLine, workingDirectory, process)) return -1; CloseHandle(process.hThread);
    const DWORD wait = WaitForSingleObject(process.hProcess, timeoutMs < 0 ? INFINITE : static_cast<DWORD>(timeoutMs)); DWORD exitCode = 0; const bool success = wait == WAIT_OBJECT_0 && GetExitCodeProcess(process.hProcess, &exitCode); CloseHandle(process.hProcess); return success ? static_cast<int>(exitCode) : -1;
}

int 进程_取当前ID() { return static_cast<int>(GetCurrentProcessId()); }
bool 进程_是否运行(int processId) { if (processId <= 0) return false; HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, static_cast<DWORD>(processId)); if (!process) return false; const bool running = WaitForSingleObject(process, 0) == WAIT_TIMEOUT; CloseHandle(process); return running; }
bool 进程_终止(int processId, int exitCode) { if (processId <= 0 || static_cast<DWORD>(processId) == GetCurrentProcessId()) return false; HANDLE process = OpenProcess(PROCESS_TERMINATE, FALSE, static_cast<DWORD>(processId)); if (!process) return false; const bool success = TerminateProcess(process, static_cast<UINT>(exitCode)) == TRUE; CloseHandle(process); return success; }
`;

const KEYBOARD_RUNTIME = String.raw`
static bool LB_KeyboardValidVirtualKey(int keyCode) { return keyCode > 0 && keyCode <= 0xff; }

static bool LB_KeyboardIsExtendedVirtualKey(int keyCode) {
    switch (keyCode) {
        case VK_RMENU: case VK_RCONTROL: case VK_INSERT: case VK_DELETE: case VK_HOME: case VK_END:
        case VK_PRIOR: case VK_NEXT: case VK_LEFT: case VK_UP: case VK_RIGHT: case VK_DOWN:
        case VK_NUMLOCK: case VK_CANCEL: case VK_SNAPSHOT: case VK_DIVIDE:
        case VK_LWIN: case VK_RWIN: case VK_APPS: return true;
        default: return false;
    }
}

static INPUT LB_KeyboardVirtualKeyInput(int keyCode, bool down) {
    INPUT input = {}; input.type = INPUT_KEYBOARD; input.ki.wVk = static_cast<WORD>(keyCode);
    input.ki.wScan = static_cast<WORD>(MapVirtualKeyW(static_cast<UINT>(keyCode), MAPVK_VK_TO_VSC));
    input.ki.dwFlags = (LB_KeyboardIsExtendedVirtualKey(keyCode) ? KEYEVENTF_EXTENDEDKEY : 0) | (down ? 0 : KEYEVENTF_KEYUP);
    return input;
}

static INPUT LB_KeyboardScanCodeInput(int scanCode, bool extended, bool down) {
    INPUT input = {}; input.type = INPUT_KEYBOARD; input.ki.wVk = 0; input.ki.wScan = static_cast<WORD>(scanCode & 0xff);
    input.ki.dwFlags = KEYEVENTF_SCANCODE | ((extended || (scanCode & 0xff00) != 0) ? KEYEVENTF_EXTENDEDKEY : 0) | (down ? 0 : KEYEVENTF_KEYUP);
    return input;
}

static bool LB_KeyboardSendInputs(std::vector<INPUT>& inputs) {
    if (inputs.empty() || inputs.size() > static_cast<size_t>((std::numeric_limits<UINT>::max)())) return false;
    return SendInput(static_cast<UINT>(inputs.size()), inputs.data(), sizeof(INPUT)) == inputs.size();
}

static bool LB_KeyboardSendVirtualKey(int keyCode, bool down) {
    if (!LB_KeyboardValidVirtualKey(keyCode)) return false;
    std::vector<INPUT> inputs = { LB_KeyboardVirtualKeyInput(keyCode, down) };
    return LB_KeyboardSendInputs(inputs);
}

static bool LB_KeyboardSendVirtualKeyClick(int keyCode) {
    if (!LB_KeyboardValidVirtualKey(keyCode)) return false;
    std::vector<INPUT> inputs = { LB_KeyboardVirtualKeyInput(keyCode, true), LB_KeyboardVirtualKeyInput(keyCode, false) };
    return LB_KeyboardSendInputs(inputs);
}

static bool LB_KeyboardSendCombination(int mainKey, int modifier1, int modifier2, int modifier3) {
    if (!LB_KeyboardValidVirtualKey(mainKey)) return false;
    std::vector<int> keys;
    for (int key : { modifier1, modifier2, modifier3 }) {
        if (key == 0) continue;
        if (!LB_KeyboardValidVirtualKey(key)) return false;
        keys.push_back(key);
    }
    keys.push_back(mainKey);
    std::vector<INPUT> inputs;
    inputs.reserve(keys.size() * 2);
    for (int key : keys) inputs.push_back(LB_KeyboardVirtualKeyInput(key, true));
    for (auto iterator = keys.rbegin(); iterator != keys.rend(); ++iterator) inputs.push_back(LB_KeyboardVirtualKeyInput(*iterator, false));
    if (LB_KeyboardSendInputs(inputs)) return true;
    std::vector<INPUT> cleanup;
    cleanup.reserve(keys.size());
    for (auto iterator = keys.rbegin(); iterator != keys.rend(); ++iterator) cleanup.push_back(LB_KeyboardVirtualKeyInput(*iterator, false));
    LB_KeyboardSendInputs(cleanup);
    return false;
}

static HWND LB_KeyboardFocusedControl(HWND rootWindow) {
    if (!IsWindow(rootWindow)) return nullptr;
    const DWORD threadId = GetWindowThreadProcessId(rootWindow, nullptr);
    GUITHREADINFO info = {}; info.cbSize = sizeof(info);
    if (!threadId || !GetGUIThreadInfo(threadId, &info) || !IsWindow(info.hwndFocus)) return nullptr;
    const HWND requestedRoot = GetAncestor(rootWindow, GA_ROOT);
    const HWND focusRoot = GetAncestor(info.hwndFocus, GA_ROOT);
    return requestedRoot && requestedRoot == focusRoot ? info.hwndFocus : nullptr;
}

bool 键盘_全局_键是否按下(int keyCode) { return LB_KeyboardValidVirtualKey(keyCode) && (GetAsyncKeyState(keyCode) & 0x8000) != 0; }
bool 键盘_全局_切换状态(int keyCode) { return LB_KeyboardValidVirtualKey(keyCode) && (GetKeyState(keyCode) & 1) != 0; }
bool 键盘_全局_大小写锁定状态() { return 键盘_全局_切换状态(VK_CAPITAL); }
bool 键盘_全局_数字锁定状态() { return 键盘_全局_切换状态(VK_NUMLOCK); }
bool 键盘_全局_滚动锁定状态() { return 键盘_全局_切换状态(VK_SCROLL); }
long long 键盘_全局_取前台窗口() { return reinterpret_cast<long long>(GetForegroundWindow()); }
long long 键盘_全局_取前台焦点控件() { HWND foreground = GetForegroundWindow(); return reinterpret_cast<long long>(foreground ? LB_KeyboardFocusedControl(foreground) : nullptr); }

static std::wstring LB_KeyboardNormalizeKeyName(const wchar_t* keyName) {
    std::wstring name = LB_Wide(keyName);
    while (!name.empty() && iswspace(name.front())) name.erase(name.begin());
    while (!name.empty() && iswspace(name.back())) name.pop_back();
    if (!name.empty()) CharUpperBuffW(name.data(), static_cast<DWORD>(name.size()));
    if (!name.empty() && name.back() == L'键') name.pop_back();
    return name;
}

int 键盘_键名取键代码(const wchar_t* keyName) {
    const std::wstring name = LB_KeyboardNormalizeKeyName(keyName);
    if (name.empty()) return 0;
    if (name.size() == 1) {
        const SHORT mapped = VkKeyScanExW(name[0], GetKeyboardLayout(0));
        return mapped == -1 ? 0 : LOBYTE(mapped);
    }
    struct KeyNameEntry { const wchar_t* name; int keyCode; };
    static const KeyNameEntry entries[] = {
        { L"CTRL", VK_CONTROL }, { L"CONTROL", VK_CONTROL }, { L"控制", VK_CONTROL },
        { L"SHIFT", VK_SHIFT }, { L"上档", VK_SHIFT }, { L"ALT", VK_MENU },
        { L"WIN", VK_LWIN }, { L"WINDOWS", VK_LWIN }, { L"左WIN", VK_LWIN }, { L"右WIN", VK_RWIN },
        { L"回车", VK_RETURN }, { L"ENTER", VK_RETURN }, { L"退格", VK_BACK }, { L"BACKSPACE", VK_BACK },
        { L"空格", VK_SPACE }, { L"SPACE", VK_SPACE }, { L"TAB", VK_TAB }, { L"制表", VK_TAB },
        { L"ESC", VK_ESCAPE }, { L"ESCAPE", VK_ESCAPE }, { L"退出", VK_ESCAPE },
        { L"删除", VK_DELETE }, { L"DELETE", VK_DELETE }, { L"DEL", VK_DELETE },
        { L"插入", VK_INSERT }, { L"INSERT", VK_INSERT }, { L"INS", VK_INSERT },
        { L"首页", VK_HOME }, { L"HOME", VK_HOME }, { L"尾页", VK_END }, { L"END", VK_END },
        { L"上翻页", VK_PRIOR }, { L"PAGEUP", VK_PRIOR }, { L"PGUP", VK_PRIOR },
        { L"下翻页", VK_NEXT }, { L"PAGEDOWN", VK_NEXT }, { L"PGDN", VK_NEXT },
        { L"左方向", VK_LEFT }, { L"LEFT", VK_LEFT }, { L"上方向", VK_UP }, { L"UP", VK_UP },
        { L"右方向", VK_RIGHT }, { L"RIGHT", VK_RIGHT }, { L"下方向", VK_DOWN }, { L"DOWN", VK_DOWN },
        { L"大小写锁定", VK_CAPITAL }, { L"CAPSLOCK", VK_CAPITAL },
        { L"数字锁定", VK_NUMLOCK }, { L"NUMLOCK", VK_NUMLOCK },
        { L"滚动锁定", VK_SCROLL }, { L"SCROLLLOCK", VK_SCROLL },
        { L"左CTRL", VK_LCONTROL }, { L"右CTRL", VK_RCONTROL }, { L"左SHIFT", VK_LSHIFT }, { L"右SHIFT", VK_RSHIFT },
        { L"左ALT", VK_LMENU }, { L"右ALT", VK_RMENU }, { L"打印屏幕", VK_SNAPSHOT }, { L"PRINTSCREEN", VK_SNAPSHOT },
        { L"暂停", VK_PAUSE }, { L"PAUSE", VK_PAUSE }, { L"应用", VK_APPS }, { L"APPS", VK_APPS }
    };
    for (const auto& entry : entries) if (name == entry.name) return entry.keyCode;
    if (name.size() >= 2 && name[0] == L'F') {
        wchar_t* end = nullptr; const long number = wcstol(name.c_str() + 1, &end, 10);
        if (end && *end == L'\0' && number >= 1 && number <= 24) return VK_F1 + static_cast<int>(number) - 1;
    }
    return 0;
}

const wchar_t* 键盘_键代码取键名(int keyCode) {
    if (!LB_KeyboardValidVirtualKey(keyCode)) return LB_ReturnText(L"");
    const UINT scan = MapVirtualKeyW(static_cast<UINT>(keyCode), MAPVK_VK_TO_VSC_EX);
    if (!scan) return LB_ReturnText(L"");
    LONG message = static_cast<LONG>((scan & 0xff) << 16);
    if ((scan & 0xff00) != 0 || LB_KeyboardIsExtendedVirtualKey(keyCode)) message |= 1 << 24;
    wchar_t buffer[128] = {};
    return GetKeyNameTextW(message, buffer, static_cast<int>(std::size(buffer))) > 0 ? LB_ReturnText(buffer) : LB_ReturnText(L"");
}

int 键盘_键代码取扫描码(int keyCode) { return LB_KeyboardValidVirtualKey(keyCode) ? static_cast<int>(MapVirtualKeyW(static_cast<UINT>(keyCode), MAPVK_VK_TO_VSC_EX)) : 0; }
int 键盘_扫描码取键代码(int scanCode) { return scanCode > 0 ? static_cast<int>(MapVirtualKeyW(static_cast<UINT>(scanCode), MAPVK_VSC_TO_VK_EX)) : 0; }
bool 键盘_键代码是否扩展键(int keyCode) { return LB_KeyboardValidVirtualKey(keyCode) && LB_KeyboardIsExtendedVirtualKey(keyCode); }

bool 键盘_前台_按下(int keyCode) { return LB_KeyboardSendVirtualKey(keyCode, true); }
bool 键盘_前台_放开(int keyCode) { return LB_KeyboardSendVirtualKey(keyCode, false); }
bool 键盘_前台_单击(int keyCode) { return LB_KeyboardSendVirtualKeyClick(keyCode); }
bool 键盘_前台_组合按键(int mainKey, int modifier1, int modifier2, int modifier3) { return LB_KeyboardSendCombination(mainKey, modifier1, modifier2, modifier3); }

bool 键盘_前台_输入文本(const wchar_t* text) {
    const std::wstring value = LB_Wide(text);
    if (value.empty()) return true;
    if (value.size() > 32768) return false;
    std::vector<INPUT> inputs; inputs.reserve(value.size() * 2);
    for (wchar_t codeUnit : value) {
        INPUT down = {}; down.type = INPUT_KEYBOARD; down.ki.wScan = codeUnit; down.ki.dwFlags = KEYEVENTF_UNICODE;
        INPUT up = down; up.ki.dwFlags |= KEYEVENTF_KEYUP; inputs.push_back(down); inputs.push_back(up);
    }
    return LB_KeyboardSendInputs(inputs);
}

static bool LB_KeyboardSendScanCode(int scanCode, bool extended, bool down) {
    if (scanCode <= 0 || scanCode > 0xffff) return false;
    std::vector<INPUT> inputs = { LB_KeyboardScanCodeInput(scanCode, extended, down) };
    return LB_KeyboardSendInputs(inputs);
}

bool 键盘_前台_扫描码按下(int scanCode, bool extended) { return LB_KeyboardSendScanCode(scanCode, extended, true); }
bool 键盘_前台_扫描码放开(int scanCode, bool extended) { return LB_KeyboardSendScanCode(scanCode, extended, false); }
bool 键盘_前台_扫描码单击(int scanCode, bool extended) {
    if (scanCode <= 0 || scanCode > 0xffff) return false;
    std::vector<INPUT> inputs = { LB_KeyboardScanCodeInput(scanCode, extended, true), LB_KeyboardScanCodeInput(scanCode, extended, false) };
    return LB_KeyboardSendInputs(inputs);
}

long long 键盘_窗口_取焦点控件(long long windowHandle) { return reinterpret_cast<long long>(LB_KeyboardFocusedControl(reinterpret_cast<HWND>(windowHandle))); }

static LPARAM LB_KeyboardMessageParameter(int keyCode, bool down, bool systemKey) {
    const UINT scan = MapVirtualKeyW(static_cast<UINT>(keyCode), MAPVK_VK_TO_VSC);
    LPARAM parameter = 1 | (static_cast<LPARAM>(scan & 0xff) << 16);
    if (LB_KeyboardIsExtendedVirtualKey(keyCode)) parameter |= static_cast<LPARAM>(1) << 24;
    if (systemKey) parameter |= static_cast<LPARAM>(1) << 29;
    if (!down) parameter |= (static_cast<LPARAM>(1) << 30) | (static_cast<LPARAM>(1) << 31);
    return parameter;
}

static bool LB_KeyboardPostVirtualKey(HWND window, int keyCode, bool systemKey, bool down) {
    if (!IsWindow(window) || !LB_KeyboardValidVirtualKey(keyCode)) return false;
    const UINT message = systemKey ? (down ? WM_SYSKEYDOWN : WM_SYSKEYUP) : (down ? WM_KEYDOWN : WM_KEYUP);
    return PostMessageW(window, message, static_cast<WPARAM>(keyCode), LB_KeyboardMessageParameter(keyCode, down, systemKey)) == TRUE;
}

bool 键盘_窗口_按下(long long windowHandle, int keyCode, bool systemKey) { return LB_KeyboardPostVirtualKey(reinterpret_cast<HWND>(windowHandle), keyCode, systemKey, true); }
bool 键盘_窗口_放开(long long windowHandle, int keyCode, bool systemKey) { return LB_KeyboardPostVirtualKey(reinterpret_cast<HWND>(windowHandle), keyCode, systemKey, false); }
bool 键盘_窗口_单击(long long windowHandle, int keyCode, bool systemKey) {
    HWND window = reinterpret_cast<HWND>(windowHandle); bool success = true;
    if (!LB_KeyboardPostVirtualKey(window, keyCode, systemKey, true)) success = false;
    if (!LB_KeyboardPostVirtualKey(window, keyCode, systemKey, false)) success = false;
    return success;
}

bool 键盘_窗口_组合按键(long long windowHandle, int mainKey, int modifier1, int modifier2, int modifier3, bool systemKey) {
    HWND window = reinterpret_cast<HWND>(windowHandle);
    if (!IsWindow(window) || !LB_KeyboardValidVirtualKey(mainKey)) return false;
    std::vector<int> keys;
    for (int key : { modifier1, modifier2, modifier3 }) {
        if (key == 0) continue;
        if (!LB_KeyboardValidVirtualKey(key)) return false;
        keys.push_back(key);
    }
    keys.push_back(mainKey); bool success = true;
    for (int key : keys) if (!LB_KeyboardPostVirtualKey(window, key, systemKey, true)) success = false;
    for (auto iterator = keys.rbegin(); iterator != keys.rend(); ++iterator) if (!LB_KeyboardPostVirtualKey(window, *iterator, systemKey, false)) success = false;
    return success;
}

bool 键盘_窗口_输入文本(long long windowHandle, const wchar_t* text) {
    HWND window = reinterpret_cast<HWND>(windowHandle); const std::wstring value = LB_Wide(text);
    if (!IsWindow(window) || value.size() > 32768) return false;
    bool success = true;
    for (wchar_t codeUnit : value) if (!PostMessageW(window, WM_CHAR, static_cast<WPARAM>(codeUnit), 1)) success = false;
    return success;
}

bool 键盘_键是否按下(int keyCode) { return 键盘_全局_键是否按下(keyCode); }
bool 键盘_大小写锁定状态() { return 键盘_全局_大小写锁定状态(); }
bool 键盘_数字锁定状态() { return 键盘_全局_数字锁定状态(); }
bool 键盘_单击(int keyCode) { return 键盘_前台_单击(keyCode); }
bool 键盘_组合按键(int modifier, int keyCode) { return 键盘_前台_组合按键(keyCode, modifier, 0, 0); }
`;

const MOUSE_RUNTIME = String.raw`
#include <UIAutomation.h>
#include <wrl.h>
#pragma comment(lib, "uiautomationcore.lib")

int 鼠标_取横坐标() { POINT point = {}; return GetCursorPos(&point) ? point.x : 0; }
int 鼠标_取纵坐标() { POINT point = {}; return GetCursorPos(&point) ? point.y : 0; }
static bool LB_SendMouse(DWORD flags, DWORD data = 0, LONG dx = 0, LONG dy = 0) {
    INPUT input = {}; input.type = INPUT_MOUSE; input.mi.dwFlags = flags; input.mi.mouseData = data; input.mi.dx = dx; input.mi.dy = dy;
    return SendInput(1, &input, sizeof(input)) == 1;
}
static bool LB_SendMouseButton(DWORD downFlag, DWORD upFlag) { return LB_SendMouse(downFlag) && LB_SendMouse(upFlag); }
bool 鼠标_移动(int x, int y) { return SetCursorPos(x, y) == TRUE; }
bool 鼠标_相对移动(int dx, int dy) { return LB_SendMouse(MOUSEEVENTF_MOVE, 0, dx, dy); }
bool 鼠标_左键按下() { return LB_SendMouse(MOUSEEVENTF_LEFTDOWN); }
bool 鼠标_左键放开() { return LB_SendMouse(MOUSEEVENTF_LEFTUP); }
bool 鼠标_左键单击() { return LB_SendMouseButton(MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP); }
bool 鼠标_右键按下() { return LB_SendMouse(MOUSEEVENTF_RIGHTDOWN); }
bool 鼠标_右键放开() { return LB_SendMouse(MOUSEEVENTF_RIGHTUP); }
bool 鼠标_右键单击() { return LB_SendMouseButton(MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP); }
bool 鼠标_中键按下() { return LB_SendMouse(MOUSEEVENTF_MIDDLEDOWN); }
bool 鼠标_中键放开() { return LB_SendMouse(MOUSEEVENTF_MIDDLEUP); }
bool 鼠标_中键单击() { return LB_SendMouseButton(MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP); }
bool 鼠标_滚轮(int amount) { return LB_SendMouse(MOUSEEVENTF_WHEEL, static_cast<DWORD>(amount)); }
bool 鼠标_水平滚轮(int amount) { return LB_SendMouse(MOUSEEVENTF_HWHEEL, static_cast<DWORD>(amount)); }

static LPARAM LB_MousePoint(int x, int y) {
    return static_cast<LPARAM>(static_cast<WORD>(x)) | (static_cast<LPARAM>(static_cast<WORD>(y)) << 16);
}
static WPARAM LB_MouseWheelState(int amount) {
    return static_cast<WPARAM>(static_cast<WORD>(static_cast<short>(amount)) << 16);
}
static bool LB_PostMouse(HWND window, UINT message, WPARAM state, LPARAM point) {
    return IsWindow(window) && PostMessageW(window, message, state, point) == TRUE;
}
bool 鼠标_窗口消息移动(long long windowHandle, int x, int y) {
    return LB_PostMouse(reinterpret_cast<HWND>(windowHandle), WM_MOUSEMOVE, 0, LB_MousePoint(x, y));
}
bool 鼠标_窗口消息左键单击(long long windowHandle, int x, int y) {
    HWND window = reinterpret_cast<HWND>(windowHandle); LPARAM point = LB_MousePoint(x, y);
    return LB_PostMouse(window, WM_MOUSEMOVE, 0, point)
        && LB_PostMouse(window, WM_LBUTTONDOWN, MK_LBUTTON, point)
        && LB_PostMouse(window, WM_LBUTTONUP, 0, point);
}
bool 鼠标_窗口消息右键单击(long long windowHandle, int x, int y) {
    HWND window = reinterpret_cast<HWND>(windowHandle); LPARAM point = LB_MousePoint(x, y);
    return LB_PostMouse(window, WM_MOUSEMOVE, 0, point)
        && LB_PostMouse(window, WM_RBUTTONDOWN, MK_RBUTTON, point)
        && LB_PostMouse(window, WM_RBUTTONUP, 0, point);
}
bool 鼠标_窗口消息中键单击(long long windowHandle, int x, int y) {
    HWND window = reinterpret_cast<HWND>(windowHandle); LPARAM point = LB_MousePoint(x, y);
    return LB_PostMouse(window, WM_MOUSEMOVE, 0, point)
        && LB_PostMouse(window, WM_MBUTTONDOWN, MK_MBUTTON, point)
        && LB_PostMouse(window, WM_MBUTTONUP, 0, point);
}
bool 鼠标_窗口消息滚轮(long long windowHandle, int amount, int x, int y) {
    return LB_PostMouse(reinterpret_cast<HWND>(windowHandle), WM_MOUSEWHEEL, LB_MouseWheelState(amount), LB_MousePoint(x, y));
}
bool 鼠标_窗口消息水平滚轮(long long windowHandle, int amount, int x, int y) {
    return LB_PostMouse(reinterpret_cast<HWND>(windowHandle), WM_MOUSEHWHEEL, LB_MouseWheelState(amount), LB_MousePoint(x, y));
}

using LB_UiaElement = Microsoft::WRL::ComPtr<IUIAutomationElement>;
static std::mutex g_lbUiaMutex;
static std::unordered_map<long long, LB_UiaElement> g_lbUiaElements;
static long long g_lbNextUiaHandle = 1;

static Microsoft::WRL::ComPtr<IUIAutomation> LB_UiaAutomation() {
    Microsoft::WRL::ComPtr<IUIAutomation> automation;
    if (FAILED(CoCreateInstance(CLSID_CUIAutomation, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&automation)))) return nullptr;
    return automation;
}
static long long LB_UiaStore(const LB_UiaElement& element) {
    if (!element) return 0;
    std::lock_guard<std::mutex> lock(g_lbUiaMutex);
    long long handle = g_lbNextUiaHandle++;
    if (handle <= 0) { g_lbUiaElements.clear(); g_lbNextUiaHandle = 1; handle = g_lbNextUiaHandle++; }
    g_lbUiaElements.emplace(handle, element);
    return handle;
}
static LB_UiaElement LB_UiaGet(long long handle) {
    std::lock_guard<std::mutex> lock(g_lbUiaMutex);
    const auto found = g_lbUiaElements.find(handle);
    return found == g_lbUiaElements.end() ? nullptr : found->second;
}
static long long LB_UiaFind(HWND window, PROPERTYID property, const wchar_t* value) {
    if (!IsWindow(window) || !value) return 0;
    auto automation = LB_UiaAutomation(); if (!automation) return 0;
    Microsoft::WRL::ComPtr<IUIAutomationElement> root, found;
    Microsoft::WRL::ComPtr<IUIAutomationCondition> condition;
    if (FAILED(automation->ElementFromHandle(window, &root)) || !root) return 0;
    VARIANT variant; VariantInit(&variant); variant.vt = VT_BSTR; variant.bstrVal = SysAllocString(value);
    if (!variant.bstrVal) { VariantClear(&variant); return 0; }
    HRESULT conditionResult = automation->CreatePropertyCondition(property, variant, &condition);
    VariantClear(&variant);
    if (FAILED(conditionResult) || !condition) return 0;
    if (FAILED(root->FindFirst(TreeScope_Subtree, condition.Get(), &found)) || !found) return 0;
    return LB_UiaStore(found);
}
long long 鼠标_UIA_按名称查找(long long windowHandle, const wchar_t* name) { return LB_UiaFind(reinterpret_cast<HWND>(windowHandle), UIA_NamePropertyId, name); }
long long 鼠标_UIA_按自动化ID查找(long long windowHandle, const wchar_t* automationId) { return LB_UiaFind(reinterpret_cast<HWND>(windowHandle), UIA_AutomationIdPropertyId, automationId); }
bool 鼠标_UIA_调用(long long elementHandle) {
    auto element = LB_UiaGet(elementHandle); if (!element) return false;
    Microsoft::WRL::ComPtr<IUnknown> unknown; Microsoft::WRL::ComPtr<IUIAutomationInvokePattern> pattern;
    return SUCCEEDED(element->GetCurrentPattern(UIA_InvokePatternId, &unknown)) && unknown && SUCCEEDED(unknown.As(&pattern)) && SUCCEEDED(pattern->Invoke());
}
bool 鼠标_UIA_设置文本(long long elementHandle, const wchar_t* text) {
    auto element = LB_UiaGet(elementHandle); if (!element) return false;
    Microsoft::WRL::ComPtr<IUnknown> unknown; Microsoft::WRL::ComPtr<IUIAutomationValuePattern> pattern;
    if (FAILED(element->GetCurrentPattern(UIA_ValuePatternId, &unknown)) || !unknown || FAILED(unknown.As(&pattern))) return false;
    BSTR value = SysAllocString(text ? text : L"");
    if (!value) return false;
    HRESULT result = pattern->SetValue(value);
    SysFreeString(value);
    return SUCCEEDED(result);
}
const wchar_t* 鼠标_UIA_取文本(long long elementHandle) {
    auto element = LB_UiaGet(elementHandle); if (!element) return LB_ReturnText(L"");
    BSTR value = nullptr;
    Microsoft::WRL::ComPtr<IUnknown> unknown; Microsoft::WRL::ComPtr<IUIAutomationValuePattern> pattern;
    if (SUCCEEDED(element->GetCurrentPattern(UIA_ValuePatternId, &unknown)) && unknown && SUCCEEDED(unknown.As(&pattern)) && SUCCEEDED(pattern->get_CurrentValue(&value)) && value) {
        std::wstring result(value, SysStringLen(value)); SysFreeString(value); return LB_ReturnText(std::move(result));
    }
    if (SUCCEEDED(element->get_CurrentName(&value)) && value) { std::wstring result(value, SysStringLen(value)); SysFreeString(value); return LB_ReturnText(std::move(result)); }
    return LB_ReturnText(L"");
}
bool 鼠标_UIA_设置勾选(long long elementHandle, bool checked) {
    auto element = LB_UiaGet(elementHandle); if (!element) return false;
    Microsoft::WRL::ComPtr<IUnknown> unknown; Microsoft::WRL::ComPtr<IUIAutomationTogglePattern> pattern;
    if (FAILED(element->GetCurrentPattern(UIA_TogglePatternId, &unknown)) || !unknown || FAILED(unknown.As(&pattern))) return false;
    for (int attempt = 0; attempt < 3; ++attempt) { ToggleState state = ToggleState_Indeterminate; if (FAILED(pattern->get_CurrentToggleState(&state))) return false; if ((checked && state == ToggleState_On) || (!checked && state == ToggleState_Off)) return true; if (FAILED(pattern->Toggle())) return false; }
    return false;
}
bool 鼠标_UIA_设置焦点(long long elementHandle) { auto element = LB_UiaGet(elementHandle); return element && SUCCEEDED(element->SetFocus()); }
bool 鼠标_UIA_释放(long long elementHandle) { std::lock_guard<std::mutex> lock(g_lbUiaMutex); return g_lbUiaElements.erase(elementHandle) > 0; }
static void LB_UiaClear() { std::lock_guard<std::mutex> lock(g_lbUiaMutex); g_lbUiaElements.clear(); g_lbNextUiaHandle = 1; }
`;

const WINDOW_RUNTIME = String.raw`
long long 窗口_按标题查找(const wchar_t* title) { return reinterpret_cast<long long>(FindWindowW(nullptr, title)); }
bool 窗口_句柄是否有效(long long handle) { return IsWindow(reinterpret_cast<HWND>(handle)) == TRUE; }
const wchar_t* 窗口_取标题(long long handle) { HWND window = reinterpret_cast<HWND>(handle); const int size = GetWindowTextLengthW(window); if (size <= 0) return LB_ReturnText(L""); std::vector<wchar_t> buffer(static_cast<size_t>(size) + 1); return GetWindowTextW(window, buffer.data(), static_cast<int>(buffer.size())) ? LB_ReturnText(buffer.data()) : LB_ReturnText(L""); }
bool 窗口_设置标题(long long handle, const wchar_t* title) { return SetWindowTextW(reinterpret_cast<HWND>(handle), title) == TRUE; }
bool 窗口_显示(long long handle, int command) { HWND window = reinterpret_cast<HWND>(handle); if (!IsWindow(window)) return false; ShowWindow(window, command); return true; }
bool 窗口_移动(long long handle, int x, int y, int width, int height) { return MoveWindow(reinterpret_cast<HWND>(handle), x, y, (std::max)(1, width), (std::max)(1, height), TRUE) == TRUE; }
bool 窗口_置前台(long long handle) { return SetForegroundWindow(reinterpret_cast<HWND>(handle)) == TRUE; }
`;

const MONITOR_RUNTIME = String.raw`
int 显示器_数量() { return GetSystemMetrics(SM_CMONITORS); }
int 显示器_主屏宽度() { return GetSystemMetrics(SM_CXSCREEN); }
int 显示器_主屏高度() { return GetSystemMetrics(SM_CYSCREEN); }
int 显示器_工作区宽度() { RECT area = {}; return SystemParametersInfoW(SPI_GETWORKAREA, 0, &area, 0) ? area.right - area.left : 0; }
int 显示器_工作区高度() { RECT area = {}; return SystemParametersInfoW(SPI_GETWORKAREA, 0, &area, 0) ? area.bottom - area.top : 0; }
int 显示器_系统DPI() { using GetDpiForSystemFn = UINT(WINAPI*)(); HMODULE user = GetModuleHandleW(L"user32.dll"); auto function = user ? reinterpret_cast<GetDpiForSystemFn>(GetProcAddress(user, "GetDpiForSystem")) : nullptr; return function ? static_cast<int>(function()) : 96; }
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.fs.core': FILE_RUNTIME,
  'lingbuilder.fs.path': PATH_RUNTIME,
  'lingbuilder.config.ini': INI_RUNTIME,
  'lingbuilder.config.registry': REGISTRY_RUNTIME,
  'lingbuilder.system.info': SYSTEM_INFO_RUNTIME,
  'lingbuilder.system.disk': DISK_RUNTIME,
  'lingbuilder.system.clipboard': CLIPBOARD_RUNTIME,
  'lingbuilder.system.shell': SHELL_RUNTIME,
  'lingbuilder.process': PROCESS_RUNTIME,
  'lingbuilder.input.keyboard': KEYBOARD_RUNTIME,
  'lingbuilder.input.mouse': MOUSE_RUNTIME,
  'lingbuilder.win32.window-utils': WINDOW_RUNTIME,
  'lingbuilder.win32.monitor': MONITOR_RUNTIME
};

export function generateSystemLibraryRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  return Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime).join('\n');
}
