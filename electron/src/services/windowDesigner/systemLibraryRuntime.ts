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
long long 磁盘_总容量MB(const wchar_t* path) { ULARGE_INTEGER available = {}, total = {}, free = {}; return GetDiskFreeSpaceExW(path, &available, &total, &free) ? static_cast<long long>(total.QuadPart / 1024 / 1024) : -1; }
long long 磁盘_可用容量MB(const wchar_t* path) { ULARGE_INTEGER available = {}, total = {}, free = {}; return GetDiskFreeSpaceExW(path, &available, &total, &free) ? static_cast<long long>(available.QuadPart / 1024 / 1024) : -1; }

static bool LB_GetVolumeInfo(const wchar_t* root, std::wstring& label, std::wstring& filesystem) {
    wchar_t labelBuffer[MAX_PATH + 1] = {}, fsBuffer[MAX_PATH + 1] = {}; DWORD serial = 0, maximum = 0, flags = 0;
    if (!GetVolumeInformationW(root, labelBuffer, _countof(labelBuffer), &serial, &maximum, &flags, fsBuffer, _countof(fsBuffer))) return false;
    label = labelBuffer; filesystem = fsBuffer; return true;
}

const wchar_t* 磁盘_取卷标(const wchar_t* root) { std::wstring label, filesystem; return LB_ReturnText(LB_GetVolumeInfo(root, label, filesystem) ? label : L""); }
const wchar_t* 磁盘_取文件系统(const wchar_t* root) { std::wstring label, filesystem; return LB_ReturnText(LB_GetVolumeInfo(root, label, filesystem) ? filesystem : L""); }
int 磁盘_取驱动器类型(const wchar_t* root) { return static_cast<int>(GetDriveTypeW(root)); }
`;

const CLIPBOARD_RUNTIME = String.raw`
bool 剪贴板_置文本(const wchar_t* text) {
    if (!OpenClipboard(nullptr)) return false; EmptyClipboard(); const std::wstring value = LB_Wide(text); const SIZE_T bytes = (value.size() + 1) * sizeof(wchar_t);
    HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, bytes); if (!memory) { CloseClipboard(); return false; } void* target = GlobalLock(memory);
    if (!target) { GlobalFree(memory); CloseClipboard(); return false; } std::memcpy(target, value.c_str(), bytes); GlobalUnlock(memory);
    if (!SetClipboardData(CF_UNICODETEXT, memory)) { GlobalFree(memory); CloseClipboard(); return false; } CloseClipboard(); return true;
}

const wchar_t* 剪贴板_取文本() { if (!OpenClipboard(nullptr)) return LB_ReturnText(L""); HANDLE data = GetClipboardData(CF_UNICODETEXT); const wchar_t* text = data ? static_cast<const wchar_t*>(GlobalLock(data)) : nullptr; std::wstring result = text ? text : L""; if (text) GlobalUnlock(data); CloseClipboard(); return LB_ReturnText(std::move(result)); }
bool 剪贴板_是否有文本() { return IsClipboardFormatAvailable(CF_UNICODETEXT) == TRUE; }
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
bool 键盘_键是否按下(int keyCode) { return (GetAsyncKeyState(keyCode) & 0x8000) != 0; }
bool 键盘_大小写锁定状态() { return (GetKeyState(VK_CAPITAL) & 1) != 0; }
bool 键盘_数字锁定状态() { return (GetKeyState(VK_NUMLOCK) & 1) != 0; }

static bool LB_SendKey(int keyCode, bool down) { INPUT input = {}; input.type = INPUT_KEYBOARD; input.ki.wVk = static_cast<WORD>(keyCode); input.ki.dwFlags = down ? 0 : KEYEVENTF_KEYUP; return SendInput(1, &input, sizeof(input)) == 1; }
bool 键盘_单击(int keyCode) { return LB_SendKey(keyCode, true) && LB_SendKey(keyCode, false); }
bool 键盘_组合按键(int modifier, int keyCode) { const bool down = LB_SendKey(modifier, true) && LB_SendKey(keyCode, true); const bool up = LB_SendKey(keyCode, false) && LB_SendKey(modifier, false); return down && up; }
`;

const MOUSE_RUNTIME = String.raw`
int 鼠标_取横坐标() { POINT point = {}; return GetCursorPos(&point) ? point.x : 0; }
int 鼠标_取纵坐标() { POINT point = {}; return GetCursorPos(&point) ? point.y : 0; }
bool 鼠标_移动(int x, int y) { return SetCursorPos(x, y) == TRUE; }
static bool LB_SendMouse(DWORD flags, DWORD data = 0) { INPUT input = {}; input.type = INPUT_MOUSE; input.mi.dwFlags = flags; input.mi.mouseData = data; return SendInput(1, &input, sizeof(input)) == 1; }
bool 鼠标_左键单击() { return LB_SendMouse(MOUSEEVENTF_LEFTDOWN) && LB_SendMouse(MOUSEEVENTF_LEFTUP); }
bool 鼠标_右键单击() { return LB_SendMouse(MOUSEEVENTF_RIGHTDOWN) && LB_SendMouse(MOUSEEVENTF_RIGHTUP); }
bool 鼠标_滚轮(int amount) { return LB_SendMouse(MOUSEEVENTF_WHEEL, static_cast<DWORD>(amount)); }
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
