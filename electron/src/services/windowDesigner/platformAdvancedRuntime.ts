import { InstalledModule } from '../modules/types';
import { COM_RUNTIME, generateComWindowMethods, generateComWndProcCase } from './comRuntime';

export { generateComWindowMethods, generateComWndProcCase };

const ARCHIVE_RUNTIME = String.raw`
static std::wstring g_lbArchiveError;
const wchar_t* 压缩_取错误() { return LB_ReturnText(g_lbArchiveError); }
static bool LB_SafeProcessArgument(const std::wstring& value) { return !value.empty() && value.find(L'\"') == std::wstring::npos && value.find(L'\r') == std::wstring::npos && value.find(L'\n') == std::wstring::npos; }
static bool LB_RunTar(const std::wstring& arguments, std::wstring& output) { SECURITY_ATTRIBUTES security = { sizeof(security), nullptr, TRUE }; HANDLE readPipe = nullptr, writePipe = nullptr; if (!CreatePipe(&readPipe, &writePipe, &security, 0)) return false; SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0); STARTUPINFOW startup = {}; startup.cb = sizeof(startup); startup.dwFlags = STARTF_USESTDHANDLES; startup.hStdOutput = writePipe; startup.hStdError = writePipe; startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE); PROCESS_INFORMATION process = {}; std::wstring command = L"tar.exe " + arguments; std::vector<wchar_t> mutableCommand(command.begin(), command.end()); mutableCommand.push_back(0); bool started = CreateProcessW(nullptr, mutableCommand.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process) == TRUE; CloseHandle(writePipe); if (!started) { CloseHandle(readPipe); g_lbArchiveError = L"无法启动 Windows tar.exe。"; return false; } std::string bytes; std::array<char, 4096> buffer = {}; DWORD read = 0; while (ReadFile(readPipe, buffer.data(), static_cast<DWORD>(buffer.size()), &read, nullptr) && read) bytes.append(buffer.data(), read); CloseHandle(readPipe); WaitForSingleObject(process.hProcess, INFINITE); DWORD code = 1; GetExitCodeProcess(process.hProcess, &code); CloseHandle(process.hThread); CloseHandle(process.hProcess); output = LB_Utf8ToWide(bytes); if (code != 0) g_lbArchiveError = output.empty() ? L"tar.exe 执行失败。" : output; else g_lbArchiveError.clear(); return code == 0; }
bool 压缩_ZIP创建(const wchar_t* source, const wchar_t* archive) { std::filesystem::path input(LB_Wide(source)), target(LB_Wide(archive)); std::wstring parent = input.has_parent_path() ? input.parent_path().wstring() : L"."; std::wstring name = input.filename().wstring(); if (!LB_SafeProcessArgument(parent) || !LB_SafeProcessArgument(name) || !LB_SafeProcessArgument(target.wstring())) return false; std::wstring output; return LB_RunTar(L"-a -cf \"" + target.wstring() + L"\" -C \"" + parent + L"\" \"" + name + L"\"", output); }
bool 压缩_ZIP解压(const wchar_t* archive, const wchar_t* target) { std::wstring input = LB_Wide(archive), destination = LB_Wide(target); if (!LB_SafeProcessArgument(input) || !LB_SafeProcessArgument(destination)) return false; std::error_code error; std::filesystem::create_directories(destination, error); std::wstring output; return !error && LB_RunTar(L"-xf \"" + input + L"\" -C \"" + destination + L"\"", output); }
const wchar_t* 压缩_ZIP列出(const wchar_t* archive) { std::wstring input = LB_Wide(archive), output; if (!LB_SafeProcessArgument(input) || !LB_RunTar(L"-tf \"" + input + L"\"", output)) return LB_ReturnText(L""); return LB_ReturnText(std::move(output)); }
`;

const SMTP_RUNTIME = String.raw`
static std::wstring g_lbSmtpError;
const wchar_t* SMTP_取错误() { return LB_ReturnText(g_lbSmtpError); }
static std::string LB_SmtpBase64(const std::string& input) { static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; std::string output; for (size_t offset = 0; offset < input.size(); offset += 3) { unsigned int block = static_cast<unsigned char>(input[offset]) << 16; if (offset + 1 < input.size()) block |= static_cast<unsigned char>(input[offset + 1]) << 8; if (offset + 2 < input.size()) block |= static_cast<unsigned char>(input[offset + 2]); output.push_back(alphabet[(block >> 18) & 63]); output.push_back(alphabet[(block >> 12) & 63]); output.push_back(offset + 1 < input.size() ? alphabet[(block >> 6) & 63] : '='); output.push_back(offset + 2 < input.size() ? alphabet[block & 63] : '='); } return output; }
static bool LB_SmtpRead(SOCKET socket, int expectedClass) { std::array<char, 4096> buffer = {}; int count = recv(socket, buffer.data(), static_cast<int>(buffer.size() - 1), 0); if (count <= 0) { g_lbSmtpError = L"SMTP 服务端未返回响应。"; return false; } std::string response(buffer.data(), count); if (response.size() < 3 || response[0] - '0' != expectedClass) { g_lbSmtpError = LB_Utf8ToWide(response); return false; } return true; }
static bool LB_SmtpSend(SOCKET socket, const std::string& command, int expectedClass) { size_t sent = 0; while (sent < command.size()) { int count = send(socket, command.data() + sent, static_cast<int>(command.size() - sent), 0); if (count <= 0) return false; sent += count; } return LB_SmtpRead(socket, expectedClass); }
bool SMTP_发送普通邮件(const wchar_t* host, int port, const wchar_t* username, const wchar_t* password, const wchar_t* from, const wchar_t* to, const wchar_t* subject, const wchar_t* body) { g_lbSmtpError.clear(); if (!LB_EnsureSockets() || port <= 0 || port > 65535) return false; ADDRINFOW hints = {}; hints.ai_family = AF_UNSPEC; hints.ai_socktype = SOCK_STREAM; hints.ai_protocol = IPPROTO_TCP; ADDRINFOW* addresses = nullptr; std::wstring service = std::to_wstring(port); if (GetAddrInfoW(host, service.c_str(), &hints, &addresses) != 0) return false; SOCKET socketHandle = INVALID_SOCKET; for (auto address = addresses; address; address = address->ai_next) { socketHandle = socket(address->ai_family, address->ai_socktype, address->ai_protocol); if (socketHandle != INVALID_SOCKET && connect(socketHandle, address->ai_addr, static_cast<int>(address->ai_addrlen)) == 0) break; if (socketHandle != INVALID_SOCKET) closesocket(socketHandle); socketHandle = INVALID_SOCKET; } FreeAddrInfoW(addresses); if (socketHandle == INVALID_SOCKET) { g_lbSmtpError = L"SMTP 连接失败。"; return false; } DWORD timeout = 30000; setsockopt(socketHandle, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout)); bool ok = LB_SmtpRead(socketHandle, 2) && LB_SmtpSend(socketHandle, "EHLO LingBuilder\r\n", 2); std::string user = LB_WideToUtf8(username), pass = LB_WideToUtf8(password); if (ok && !user.empty()) ok = LB_SmtpSend(socketHandle, "AUTH LOGIN\r\n", 3) && LB_SmtpSend(socketHandle, LB_SmtpBase64(user) + "\r\n", 3) && LB_SmtpSend(socketHandle, LB_SmtpBase64(pass) + "\r\n", 2); std::string fromText = LB_WideToUtf8(from), toText = LB_WideToUtf8(to); if (ok) ok = LB_SmtpSend(socketHandle, "MAIL FROM:<" + fromText + ">\r\n", 2) && LB_SmtpSend(socketHandle, "RCPT TO:<" + toText + ">\r\n", 2) && LB_SmtpSend(socketHandle, "DATA\r\n", 3); if (ok) { std::string message = "From: <" + fromText + ">\r\nTo: <" + toText + ">\r\nSubject: =?UTF-8?B?" + LB_SmtpBase64(LB_WideToUtf8(subject)) + "?=\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + LB_WideToUtf8(body) + "\r\n.\r\n"; ok = LB_SmtpSend(socketHandle, message, 2); } if (ok) LB_SmtpSend(socketHandle, "QUIT\r\n", 2); closesocket(socketHandle); return ok; }
`;

const IPC_RUNTIME = String.raw`
static HANDLE g_lbPipe = INVALID_HANDLE_VALUE, g_lbInstanceMutex = nullptr; static std::wstring g_lbIpcError;
static std::wstring LB_PipeName(const wchar_t* name) { return L"\\\\.\\pipe\\LingBuilder." + LB_Wide(name); }
const wchar_t* IPC_取错误() { return LB_ReturnText(g_lbIpcError); }
void IPC_关闭() { if (g_lbPipe != INVALID_HANDLE_VALUE) { FlushFileBuffers(g_lbPipe); DisconnectNamedPipe(g_lbPipe); CloseHandle(g_lbPipe); g_lbPipe = INVALID_HANDLE_VALUE; } if (g_lbInstanceMutex) { CloseHandle(g_lbInstanceMutex); g_lbInstanceMutex = nullptr; } }
bool IPC_创建管道服务端(const wchar_t* name) { if (g_lbPipe != INVALID_HANDLE_VALUE) CloseHandle(g_lbPipe); g_lbPipe = CreateNamedPipeW(LB_PipeName(name).c_str(), PIPE_ACCESS_DUPLEX, PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT, 1, 1024 * 1024, 1024 * 1024, 0, nullptr); if (g_lbPipe == INVALID_HANDLE_VALUE) g_lbIpcError = L"命名管道创建失败。"; return g_lbPipe != INVALID_HANDLE_VALUE; }
bool IPC_等待管道客户端() { if (g_lbPipe == INVALID_HANDLE_VALUE) return false; bool connected = ConnectNamedPipe(g_lbPipe, nullptr) == TRUE || GetLastError() == ERROR_PIPE_CONNECTED; if (!connected) g_lbIpcError = L"等待管道客户端失败。"; return connected; }
bool IPC_连接管道(const wchar_t* name, int timeoutMs) { if (g_lbPipe != INVALID_HANDLE_VALUE) CloseHandle(g_lbPipe); std::wstring path = LB_PipeName(name); if (!WaitNamedPipeW(path.c_str(), static_cast<DWORD>((std::max)(0, timeoutMs)))) return false; g_lbPipe = CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr); return g_lbPipe != INVALID_HANDLE_VALUE; }
bool IPC_发送文本(const wchar_t* text) { if (g_lbPipe == INVALID_HANDLE_VALUE) return false; std::string bytes = LB_WideToUtf8(text); DWORD length = static_cast<DWORD>(bytes.size()), written = 0; return WriteFile(g_lbPipe, &length, sizeof(length), &written, nullptr) && written == sizeof(length) && WriteFile(g_lbPipe, bytes.data(), length, &written, nullptr) && written == length; }
const wchar_t* IPC_接收文本() { if (g_lbPipe == INVALID_HANDLE_VALUE) return LB_ReturnText(L""); DWORD length = 0, read = 0; if (!ReadFile(g_lbPipe, &length, sizeof(length), &read, nullptr) || read != sizeof(length) || length > 16 * 1024 * 1024) return LB_ReturnText(L""); std::string bytes(length, '\0'); size_t offset = 0; while (offset < length) { DWORD chunk = 0; if (!ReadFile(g_lbPipe, bytes.data() + offset, length - static_cast<DWORD>(offset), &chunk, nullptr) || !chunk) return LB_ReturnText(L""); offset += chunk; } return LB_ReturnText(LB_Utf8ToWide(bytes)); }
bool IPC_创建单实例锁(const wchar_t* name) { if (g_lbInstanceMutex) CloseHandle(g_lbInstanceMutex); std::wstring full = L"Local\\LingBuilder." + LB_Wide(name); g_lbInstanceMutex = CreateMutexW(nullptr, FALSE, full.c_str()); return g_lbInstanceMutex && GetLastError() != ERROR_ALREADY_EXISTS; }
`;

const MENU_RUNTIME = String.raw`
long long 菜单_创建() { return reinterpret_cast<long long>(CreateMenu()); } long long 菜单_创建弹出菜单() { return reinterpret_cast<long long>(CreatePopupMenu()); }
bool 菜单_添加项目(long long menu, int commandId, const wchar_t* title) { return AppendMenuW(reinterpret_cast<HMENU>(menu), MF_STRING, static_cast<UINT_PTR>(commandId), title) == TRUE; }
bool 菜单_添加子菜单(long long menu, long long submenu, const wchar_t* title) { return AppendMenuW(reinterpret_cast<HMENU>(menu), MF_POPUP, reinterpret_cast<UINT_PTR>(reinterpret_cast<HMENU>(submenu)), title) == TRUE; }
bool 菜单_添加分隔线(long long menu) { return AppendMenuW(reinterpret_cast<HMENU>(menu), MF_SEPARATOR, 0, nullptr) == TRUE; }
bool 菜单_设置到窗口(long long window, long long menu) { HWND hwnd = reinterpret_cast<HWND>(window); return SetMenu(hwnd, reinterpret_cast<HMENU>(menu)) == TRUE && DrawMenuBar(hwnd) == TRUE; }
int 菜单_弹出并取命令(long long menu, long long window, int x, int y) { return static_cast<int>(TrackPopupMenu(reinterpret_cast<HMENU>(menu), TPM_RETURNCMD | TPM_RIGHTBUTTON, x, y, 0, reinterpret_cast<HWND>(window), nullptr)); }
bool 菜单_销毁(long long menu) { return DestroyMenu(reinterpret_cast<HMENU>(menu)) == TRUE; }
`;

const TRAY_RUNTIME = String.raw`
static NOTIFYICONDATAW LB_TrayData(long long window, int id) { NOTIFYICONDATAW data = {}; data.cbSize = sizeof(data); data.hWnd = reinterpret_cast<HWND>(window); data.uID = static_cast<UINT>(id); return data; }
bool 托盘_添加(long long window, int id, const wchar_t* tip) { auto data = LB_TrayData(window, id); data.uFlags = NIF_ICON | NIF_TIP | NIF_MESSAGE; data.hIcon = static_cast<HICON>(LoadImageW(nullptr, IDI_APPLICATION, IMAGE_ICON, 0, 0, LR_SHARED)); data.uCallbackMessage = WM_APP + 77; wcsncpy_s(data.szTip, tip ? tip : L"LingBuilder", _TRUNCATE); return Shell_NotifyIconW(NIM_ADD, &data) == TRUE; }
bool 托盘_修改提示(long long window, int id, const wchar_t* tip) { auto data = LB_TrayData(window, id); data.uFlags = NIF_TIP; wcsncpy_s(data.szTip, tip ? tip : L"", _TRUNCATE); return Shell_NotifyIconW(NIM_MODIFY, &data) == TRUE; }
bool 托盘_显示通知(long long window, int id, const wchar_t* title, const wchar_t* content) { auto data = LB_TrayData(window, id); data.uFlags = NIF_INFO; data.dwInfoFlags = NIIF_INFO; wcsncpy_s(data.szInfoTitle, title ? title : L"LingBuilder", _TRUNCATE); wcsncpy_s(data.szInfo, content ? content : L"", _TRUNCATE); return Shell_NotifyIconW(NIM_MODIFY, &data) == TRUE; }
bool 托盘_删除(long long window, int id) { auto data = LB_TrayData(window, id); return Shell_NotifyIconW(NIM_DELETE, &data) == TRUE; }
int 托盘_取回调消息号() { return WM_APP + 77; }
`;

const ACCESSIBILITY_RUNTIME = String.raw`
static IAccessible* LB_Accessible(long long handle) { IAccessible* object = nullptr; return SUCCEEDED(AccessibleObjectFromWindow(reinterpret_cast<HWND>(handle), OBJID_WINDOW, IID_IAccessible, reinterpret_cast<void**>(&object))) ? object : nullptr; }
static const wchar_t* LB_AccessibleText(long long handle, bool value) { IAccessible* object = LB_Accessible(handle); if (!object) return LB_ReturnText(L""); VARIANT child; VariantInit(&child); child.vt = VT_I4; child.lVal = CHILDID_SELF; BSTR text = nullptr; HRESULT result = value ? object->get_accValue(child, &text) : object->get_accName(child, &text); std::wstring output = SUCCEEDED(result) && text ? text : L""; if (text) SysFreeString(text); object->Release(); return LB_ReturnText(std::move(output)); }
const wchar_t* 辅助_取名称(long long handle) { return LB_AccessibleText(handle, false); } const wchar_t* 辅助_取值(long long handle) { return LB_AccessibleText(handle, true); }
const wchar_t* 辅助_取角色(long long handle) { IAccessible* object = LB_Accessible(handle); if (!object) return LB_ReturnText(L""); VARIANT child, role; VariantInit(&child); VariantInit(&role); child.vt = VT_I4; child.lVal = CHILDID_SELF; std::wstring output; if (SUCCEEDED(object->get_accRole(child, &role)) && role.vt == VT_I4) { wchar_t buffer[256] = {}; GetRoleTextW(role.lVal, buffer, _countof(buffer)); output = buffer; } VariantClear(&role); object->Release(); return LB_ReturnText(std::move(output)); }
long long 辅助_取状态值(long long handle) { IAccessible* object = LB_Accessible(handle); if (!object) return 0; VARIANT child, state; VariantInit(&child); VariantInit(&state); child.vt = VT_I4; child.lVal = CHILDID_SELF; long long result = SUCCEEDED(object->get_accState(child, &state)) && state.vt == VT_I4 ? state.lVal : 0; VariantClear(&state); object->Release(); return result; }
`;

const MEMORY_RUNTIME = String.raw`
static std::mutex g_lbMemoryMutex; static std::unordered_map<long long, std::vector<unsigned char>> g_lbMemoryBlocks; static std::atomic<long long> g_lbMemoryNext{1};
long long 内存_申请(int byteCount) { if (byteCount <= 0 || byteCount > 256 * 1024 * 1024) return 0; long long id = g_lbMemoryNext.fetch_add(1); std::lock_guard<std::mutex> lock(g_lbMemoryMutex); g_lbMemoryBlocks.emplace(id, std::vector<unsigned char>(static_cast<size_t>(byteCount), 0)); return id; }
bool 内存_写整数(long long id, int offset, int value) { std::lock_guard<std::mutex> lock(g_lbMemoryMutex); auto found = g_lbMemoryBlocks.find(id); if (found == g_lbMemoryBlocks.end() || offset < 0 || static_cast<size_t>(offset) + sizeof(value) > found->second.size()) return false; std::memcpy(found->second.data() + offset, &value, sizeof(value)); return true; }
int 内存_读整数(long long id, int offset) { int value = 0; std::lock_guard<std::mutex> lock(g_lbMemoryMutex); auto found = g_lbMemoryBlocks.find(id); if (found == g_lbMemoryBlocks.end() || offset < 0 || static_cast<size_t>(offset) + sizeof(value) > found->second.size()) return 0; std::memcpy(&value, found->second.data() + offset, sizeof(value)); return value; }
bool 内存_写UTF8文本(long long id, int offset, const wchar_t* text) { std::string bytes = LB_WideToUtf8(text); std::lock_guard<std::mutex> lock(g_lbMemoryMutex); auto found = g_lbMemoryBlocks.find(id); if (found == g_lbMemoryBlocks.end() || offset < 0 || static_cast<size_t>(offset) + bytes.size() + 1 > found->second.size()) return false; std::memcpy(found->second.data() + offset, bytes.data(), bytes.size()); found->second[static_cast<size_t>(offset) + bytes.size()] = 0; return true; }
const wchar_t* 内存_读UTF8文本(long long id, int offset, int maximumBytes) { std::lock_guard<std::mutex> lock(g_lbMemoryMutex); auto found = g_lbMemoryBlocks.find(id); if (found == g_lbMemoryBlocks.end() || offset < 0 || static_cast<size_t>(offset) >= found->second.size()) return LB_ReturnText(L""); size_t limit = (std::min)(found->second.size() - static_cast<size_t>(offset), static_cast<size_t>((std::max)(0, maximumBytes))); const char* start = reinterpret_cast<const char*>(found->second.data() + offset); size_t length = 0; while (length < limit && start[length]) ++length; return LB_ReturnText(LB_Utf8ToWide(std::string(start, length))); }
bool 内存_释放(long long id) { std::lock_guard<std::mutex> lock(g_lbMemoryMutex); return g_lbMemoryBlocks.erase(id) > 0; }
`;

const HOOK_RUNTIME = String.raw`
static HHOOK g_lbKeyboardHook = nullptr; static std::atomic<int> g_lbLastKey{0}; static std::atomic<long long> g_lbHookCount{0};
static LRESULT CALLBACK LB_KeyboardHookProc(int code, WPARAM wParam, LPARAM lParam) { if (code >= 0 && lParam) { auto data = reinterpret_cast<KBDLLHOOKSTRUCT*>(lParam); g_lbLastKey.store(static_cast<int>(data->vkCode)); g_lbHookCount.fetch_add(1); } return CallNextHookEx(g_lbKeyboardHook, code, wParam, lParam); }
bool 键盘钩子_启动() { if (g_lbKeyboardHook) return true; g_lbKeyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, LB_KeyboardHookProc, GetModuleHandleW(nullptr), 0); return g_lbKeyboardHook != nullptr; }
int 键盘钩子_取最后键码() { return g_lbLastKey.load(); } long long 键盘钩子_取消息数量() { return g_lbHookCount.load(); } void 键盘钩子_停止() { if (g_lbKeyboardHook) UnhookWindowsHookEx(g_lbKeyboardHook); g_lbKeyboardHook = nullptr; }
`;

const PROCESS_MEMORY_RUNTIME = String.raw`
long long 进程内存_打开(int processId, bool writable) { DWORD access = PROCESS_QUERY_INFORMATION | PROCESS_VM_READ | (writable ? PROCESS_VM_WRITE | PROCESS_VM_OPERATION : 0); return reinterpret_cast<long long>(OpenProcess(access, FALSE, static_cast<DWORD>(processId))); }
int 进程内存_读整数(long long process, long long address, int fallback) { int value = fallback; SIZE_T read = 0; return ReadProcessMemory(reinterpret_cast<HANDLE>(process), reinterpret_cast<const void*>(address), &value, sizeof(value), &read) && read == sizeof(value) ? value : fallback; }
bool 进程内存_写整数(long long process, long long address, int value) { SIZE_T written = 0; return WriteProcessMemory(reinterpret_cast<HANDLE>(process), reinterpret_cast<void*>(address), &value, sizeof(value), &written) && written == sizeof(value); }
bool 进程内存_关闭(long long process) { return process && CloseHandle(reinterpret_cast<HANDLE>(process)) == TRUE; }
`;

const ASSEMBLY_RUNTIME = String.raw`
const wchar_t* CPU_取厂商() { int registers[4] = {}; __cpuid(registers, 0); char vendor[13] = {}; std::memcpy(vendor, &registers[1], 4); std::memcpy(vendor + 4, &registers[3], 4); std::memcpy(vendor + 8, &registers[2], 4); return LB_ReturnText(LB_Utf8ToWide(vendor)); }
bool CPU_是否支持SSE2() { int registers[4] = {}; __cpuid(registers, 1); return (registers[3] & (1 << 26)) != 0; }
bool CPU_是否支持AVX() { int registers[4] = {}; __cpuid(registers, 1); bool cpu = (registers[2] & (1 << 28)) && (registers[2] & (1 << 27)); return cpu && ((_xgetbv(0) & 6) == 6); }
int 位运算_统计一位数量(long long value) { unsigned long long bits = static_cast<unsigned long long>(value); int count = 0; while (bits) { bits &= bits - 1; ++count; } return count; }
long long 位运算_循环左移(long long value, int bits) { unsigned int shift = static_cast<unsigned int>(bits) & 63; unsigned long long raw = static_cast<unsigned long long>(value); return static_cast<long long>((raw << shift) | (raw >> ((64 - shift) & 63))); }
`;

const DRIVER_RUNTIME = String.raw`
static thread_local DWORD g_lbDeviceError = 0;
long long 设备_打开(const wchar_t* path, bool writable) { HANDLE handle = CreateFileW(path, GENERIC_READ | (writable ? GENERIC_WRITE : 0), FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (handle == INVALID_HANDLE_VALUE) { g_lbDeviceError = GetLastError(); return 0; } g_lbDeviceError = 0; return reinterpret_cast<long long>(handle); }
bool 设备_无参数控制(long long handle, int controlCode) { DWORD returned = 0; bool success = DeviceIoControl(reinterpret_cast<HANDLE>(handle), static_cast<DWORD>(controlCode), nullptr, 0, nullptr, 0, &returned, nullptr) == TRUE; g_lbDeviceError = success ? 0 : GetLastError(); return success; }
bool 设备_关闭(long long handle) { bool success = handle && CloseHandle(reinterpret_cast<HANDLE>(handle)) == TRUE; g_lbDeviceError = success ? 0 : GetLastError(); return success; }
int 设备_取错误码() { return static_cast<int>(g_lbDeviceError); }
`;

const RUNTIMES: Record<string, string> = {
  'lingbuilder.archive': ARCHIVE_RUNTIME, 'lingbuilder.net.mail': SMTP_RUNTIME, 'lingbuilder.ipc': IPC_RUNTIME,
  'lingbuilder.win32.menu': MENU_RUNTIME, 'lingbuilder.win32.tray': TRAY_RUNTIME, 'lingbuilder.win32.accessibility': ACCESSIBILITY_RUNTIME,
  'lingbuilder.advanced.memory': MEMORY_RUNTIME, 'lingbuilder.advanced.hook': HOOK_RUNTIME,
  'lingbuilder.advanced.process-memory': PROCESS_MEMORY_RUNTIME, 'lingbuilder.advanced.com': COM_RUNTIME,
  'lingbuilder.advanced.assembly': ASSEMBLY_RUNTIME, 'lingbuilder.advanced.driver': DRIVER_RUNTIME
};

export function generatePlatformAdvancedRuntime(enabledModules: InstalledModule[]): string {
  const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
  return Object.entries(RUNTIMES).filter(([moduleId]) => enabledIds.has(moduleId)).map(([, runtime]) => runtime).join('\n');
}
