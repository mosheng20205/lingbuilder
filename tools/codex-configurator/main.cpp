#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif

// The configurator is a New_Emoji application by default. The build scripts
// provide the bridge headers and x64 import library for the bundled runtime.
#ifndef LINGBUILDER_USE_NEW_EMOJI
#define LINGBUILDER_USE_NEW_EMOJI 1
#endif

#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shobjidl.h>

#ifdef LINGBUILDER_USE_NEW_EMOJI
#include "new_emoji_bridge.h"
#include "exports.h"
#endif

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "user32.lib")

namespace fs = std::filesystem;

namespace {

constexpr wchar_t kWindowClass[] = L"LingBuilderCodexConfiguratorWindow";
constexpr wchar_t kManagedStart[] = L"# >>> LingBuilder ChatGPT/Codex desktop MCP (managed)";
constexpr wchar_t kManagedEnd[] = L"# <<< LingBuilder ChatGPT/Codex desktop MCP (managed)";
constexpr wchar_t kServerHeader[] = L"[mcp_servers.lingbuilder_desktop]";

enum ControlId : int {
  kWorkspaceEdit = 1001,
  kChooseWorkspace = 1002,
  kReadonly = 1010,
  kPreview = 1011,
  kYolo = 1012,
  kLaunchCodex = 1020,
  kConfigure = 1030,
  kRemove = 1031,
  kStatus = 1040,
  kRuntime = 1041,
};

struct RuntimePaths {
  fs::path runtime;
  fs::path cli;
};

struct ConfigureResult {
  bool ok = false;
  bool needsConfirmation = false;
  std::wstring message;
};

HWND g_workspaceEdit = nullptr;
HWND g_runtimeLabel = nullptr;
HWND g_statusEdit = nullptr;
HWND g_titleLabel = nullptr;
HWND g_subtitleLabel = nullptr;
HWND g_workspaceLabel = nullptr;
HWND g_workspaceHint = nullptr;
HWND g_permissionLabel = nullptr;
HWND g_permissionHint = nullptr;
HWND g_statusLabel = nullptr;
HFONT g_font = nullptr;
HFONT g_titleFont = nullptr;
HFONT g_subtitleFont = nullptr;
HFONT g_sectionFont = nullptr;
HFONT g_buttonFont = nullptr;
HFONT g_smallFont = nullptr;
HBRUSH g_backgroundBrush = nullptr;
HBRUSH g_headerBrush = nullptr;
HBRUSH g_surfaceBrush = nullptr;
HBRUSH g_editBrush = nullptr;
HBRUSH g_statusBrush = nullptr;
RuntimePaths g_runtime;
int g_selectedPermission = kPreview;
bool g_launchCodexChecked = true;

#ifdef LINGBUILDER_USE_NEW_EMOJI
HWND g_newEmojiWindow = nullptr;
int g_neWorkspaceEdit = 0;
int g_neChooseWorkspace = 0;
int g_neReadonly = 0;
int g_nePreview = 0;
int g_neYolo = 0;
int g_neReadonlyHighlight = 0;
int g_nePreviewHighlight = 0;
int g_neYoloHighlight = 0;
int g_neLaunchCodex = 0;
int g_neConfigure = 0;
int g_neRemove = 0;
int g_neRuntimeText = 0;
int g_neStatusText = 0;
std::wstring g_neWorkspaceValue;
UINT g_neDpi = 96;
#endif

constexpr COLORREF kBackgroundColor = RGB(245, 247, 251);
constexpr COLORREF kHeaderColor = RGB(31, 62, 99);
constexpr COLORREF kHeaderAccentColor = RGB(45, 163, 172);
constexpr COLORREF kSurfaceColor = RGB(255, 255, 255);
constexpr COLORREF kStatusColor = RGB(248, 250, 252);
constexpr COLORREF kBorderColor = RGB(226, 232, 240);
constexpr COLORREF kTextColor = RGB(31, 41, 55);
constexpr COLORREF kMutedColor = RGB(100, 116, 139);
constexpr COLORREF kAccentColor = RGB(37, 99, 235);
constexpr COLORREF kAccentHoverColor = RGB(29, 78, 216);
constexpr COLORREF kAccentLightColor = RGB(239, 246, 255);
constexpr COLORREF kWarningColor = RGB(180, 83, 9);
constexpr COLORREF kWarningLightColor = RGB(255, 247, 237);
constexpr COLORREF kDangerColor = RGB(185, 28, 28);

std::wstring Trim(const std::wstring& value) {
  const auto begin = value.find_first_not_of(L" \t\r\n");
  if (begin == std::wstring::npos) return {};
  const auto end = value.find_last_not_of(L" \t\r\n");
  return value.substr(begin, end - begin + 1);
}

std::string TrimAscii(const std::string& value) {
  const auto begin = value.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos) return {};
  const auto end = value.find_last_not_of(" \t\r\n");
  return value.substr(begin, end - begin + 1);
}

std::wstring Utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) throw std::runtime_error("配置文件不是有效的 UTF-8 文本。");
  std::wstring result(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), length);
  return result;
}

std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (length <= 0) throw std::runtime_error("无法把配置文本转换为 UTF-8。");
  std::string result(static_cast<size_t>(length), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr);
  return result;
}

std::wstring LastErrorText(const std::wstring& action) {
  const DWORD error = GetLastError();
  wchar_t buffer[512] = {};
  FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS, nullptr, error, 0, buffer, static_cast<DWORD>(std::size(buffer)), nullptr);
  std::wstring message = action + L"失败";
  if (buffer[0] != L'\0') {
    message += L"：";
    message += Trim(buffer);
  }
  return message;
}

std::wstring ModuleDirectory() {
  std::vector<wchar_t> buffer(MAX_PATH);
  for (;;) {
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0) throw std::runtime_error("无法确定配置工具所在目录。");
    if (length < buffer.size() - 1) return fs::path(std::wstring(buffer.data(), length)).parent_path().wstring();
    buffer.resize(buffer.size() * 2);
  }
}

bool IsRegularFile(const fs::path& path) {
  std::error_code error;
  return fs::is_regular_file(path, error);
}

RuntimePaths FindRuntimePaths() {
  RuntimePaths result;
  std::vector<fs::path> roots;
  fs::path root = ModuleDirectory();
  for (int index = 0; index < 10 && !root.empty(); ++index) {
    roots.push_back(root);
    if (root == root.root_path()) break;
    root = root.parent_path();
  }

  for (const fs::path& candidateRoot : roots) {
    const fs::path developmentRuntime = candidateRoot / L"electron" / L"node_modules" / L"electron" / L"dist" / L"electron.exe";
    const fs::path developmentCli = candidateRoot / L"electron" / L"dist" / L"cli.cjs";
    if (IsRegularFile(developmentRuntime) && IsRegularFile(developmentCli)) {
      result.runtime = fs::weakly_canonical(developmentRuntime);
      result.cli = fs::weakly_canonical(developmentCli);
      return result;
    }

    const fs::path packagedRuntime = candidateRoot / L"LingBuilder.exe";
    const fs::path packagedCli = candidateRoot / L"resources" / L"app.asar" / L"dist" / L"cli.cjs";
    const fs::path packagedArchive = candidateRoot / L"resources" / L"app.asar";
    if (IsRegularFile(packagedRuntime) && (IsRegularFile(packagedCli) || IsRegularFile(packagedArchive))) {
      result.runtime = fs::weakly_canonical(packagedRuntime);
      // Electron resolves the dist/cli.cjs path inside app.asar at process startup.
      result.cli = packagedCli;
      return result;
    }
  }
  return result;
}

fs::path NormalizeWorkspace(const std::wstring& raw) {
  const std::wstring value = Trim(raw);
  if (value.empty()) throw std::runtime_error("请先选择工作区目录。");
  std::error_code error;
  const fs::path absolute = fs::absolute(fs::path(value), error);
  if (error || !fs::is_directory(absolute, error)) throw std::runtime_error("选择的工作区目录不存在或不是目录。");
  return fs::weakly_canonical(absolute, error);
}

fs::path DefaultWorkspace() {
  fs::path root = ModuleDirectory();
  for (int index = 0; index < 10 && !root.empty(); ++index) {
    if (fs::is_directory(root / L".lingbuilder") || fs::is_directory(root / L"electron")) return root;
    if (root == root.root_path()) break;
    root = root.parent_path();
  }
  std::vector<wchar_t> buffer(MAX_PATH);
  const DWORD length = GetCurrentDirectoryW(static_cast<DWORD>(buffer.size()), buffer.data());
  if (length > 0 && length < buffer.size()) return fs::path(std::wstring(buffer.data(), length));
  return ModuleDirectory();
}

std::string NormalizeNewlines(std::string value, bool& crlf) {
  crlf = value.find("\r\n") != std::string::npos;
  std::string result;
  result.reserve(value.size());
  for (size_t index = 0; index < value.size(); ++index) {
    if (value[index] == '\r') {
      if (index + 1 < value.size() && value[index + 1] == '\n') ++index;
      result.push_back('\n');
    } else {
      result.push_back(value[index]);
    }
  }
  return result;
}

std::string RestoreNewlines(std::string value, bool crlf) {
  if (!crlf) return value;
  std::string result;
  result.reserve(value.size() + value.size() / 20);
  for (const char character : value) {
    if (character == '\n') result += "\r\n";
    else result.push_back(character);
  }
  return result;
}

std::string TrimEndWhitespace(std::string value) {
  while (!value.empty() && (value.back() == ' ' || value.back() == '\t' || value.back() == '\n' || value.back() == '\r')) value.pop_back();
  return value;
}

std::string ReadConfig(const fs::path& path, bool& hadBom, bool& existed) {
  existed = false;
  hadBom = false;
  std::ifstream input(path, std::ios::binary);
  if (!input) {
    std::error_code error;
    if (fs::exists(path, error)) throw std::runtime_error("无法读取现有 .codex/config.toml。");
    return {};
  }
  existed = true;
  std::string value((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
  if (value.size() >= 3 && static_cast<unsigned char>(value[0]) == 0xEF && static_cast<unsigned char>(value[1]) == 0xBB && static_cast<unsigned char>(value[2]) == 0xBF) {
    hadBom = true;
    value.erase(0, 3);
  }
  Utf8ToWide(value);
  return value;
}

void WriteConfigAtomic(const fs::path& path, const std::string& value, bool hadBom) {
  std::error_code error;
  fs::create_directories(path.parent_path(), error);
  if (error) throw std::runtime_error("无法创建 .codex 配置目录。");
  const fs::path temporary = path.parent_path() / (path.filename().wstring() + L"." + std::to_wstring(GetCurrentProcessId()) + L".tmp");
  std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
  if (!output) throw std::runtime_error("无法写入临时配置文件。");
  if (hadBom) output.write("\xEF\xBB\xBF", 3);
  output.write(value.data(), static_cast<std::streamsize>(value.size()));
  output.close();
  if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    fs::remove(temporary, error);
    throw std::runtime_error("无法原子替换 .codex/config.toml。");
  }
}

bool IsTargetHeader(const std::string& line) {
  const std::string trimmed = TrimAscii(line);
  if (trimmed.size() < 2 || trimmed.front() != '[') return false;
  const size_t close = trimmed.find(']');
  if (close == std::string::npos) return false;
  const std::string header = trimmed.substr(1, close - 1);
  return header == "mcp_servers.lingbuilder_desktop" || header.rfind("mcp_servers.lingbuilder_desktop.", 0) == 0;
}

bool HasTargetTable(const std::string& value) {
  std::istringstream lines(value);
  std::string line;
  while (std::getline(lines, line)) {
    if (IsTargetHeader(line)) return true;
  }
  return false;
}

std::string RemoveTargetTables(const std::string& value) {
  std::istringstream lines(value);
  std::ostringstream output;
  std::string line;
  bool skipping = false;
  bool first = true;
  while (std::getline(lines, line)) {
    const std::string trimmed = TrimAscii(line);
    if (!trimmed.empty() && trimmed.front() == '[') {
      const size_t close = trimmed.find(']');
      if (close != std::string::npos) {
        const std::string header = trimmed.substr(1, close - 1);
        skipping = header == "mcp_servers.lingbuilder_desktop" || header.rfind("mcp_servers.lingbuilder_desktop.", 0) == 0;
      }
    }
    if (!skipping) {
      if (!first) output << '\n';
      output << line;
      first = false;
    }
  }
  return output.str();
}

std::string RemoveManagedBlock(const std::string& value, bool& found) {
  found = false;
  const std::string start = WideToUtf8(kManagedStart);
  const std::string end = WideToUtf8(kManagedEnd);
  const size_t startPosition = value.find(start);
  if (startPosition == std::string::npos) return value;
  const size_t endPosition = value.find(end, startPosition + start.size());
  if (endPosition == std::string::npos) throw std::runtime_error("检测到不完整的 LingBuilder 托管配置块，已停止写入以保护原文件。");
  found = true;
  std::string result = value;
  result.erase(startPosition, endPosition + end.size() - startPosition);
  while (result.find("\n\n\n") != std::string::npos) result.replace(result.find("\n\n\n"), 3, "\n\n");
  return result;
}

std::wstring TomlQuote(const std::wstring& value) {
  std::wstring result = L"\"";
  for (const wchar_t character : value) {
    if (character == L'\\') result += L"\\\\";
    else if (character == L'\"') result += L"\\\"";
    else if (character == L'\r') result += L"\\r";
    else if (character == L'\n') result += L"\\n";
    else if (character == L'\t') result += L"\\t";
    else result.push_back(character);
  }
  result.push_back(L'\"');
  return result;
}

std::string CreateManagedBlock(const RuntimePaths& runtime, const std::wstring& permission) {
  std::wstring block;
  block += kManagedStart;
  block += L"\n";
  block += kServerHeader;
  block += L"\ncommand = ";
  block += TomlQuote(runtime.runtime.wstring());
  block += L"\nargs = [";
  block += TomlQuote(runtime.cli.wstring());
  block += L", \"ai-server\", \"--workspace\", \".\", \"--permission\", ";
  block += TomlQuote(permission);
  block += L", \"--mcp\", \"--stdio-only\"]\n";
  block += L"env = { ELECTRON_RUN_AS_NODE = \"1\" }\n";
  block += L"enabled = true\nrequired = false\n";
  block += L"default_tools_approval_mode = \"writes\"\n";
  block += kManagedEnd;
  return WideToUtf8(block);
}

ConfigureResult ConfigureWorkspace(const fs::path& workspace, const std::wstring& permission, const RuntimePaths& runtime, bool replaceExisting) {
  try {
    if (runtime.runtime.empty() || runtime.cli.empty() || !IsRegularFile(runtime.runtime) || !IsRegularFile(runtime.cli)) {
      throw std::runtime_error("没有找到 LingBuilder 运行时。请从项目根目录或安装目录运行此工具。");
    }
    const fs::path configPath = workspace / L".codex" / L"config.toml";
    bool hadBom = false;
    bool existed = false;
    const std::string original = ReadConfig(configPath, hadBom, existed);
    bool crlf = false;
    const std::string normalized = NormalizeNewlines(original, crlf);
    bool managedFound = false;
    const std::string withoutManaged = RemoveManagedBlock(normalized, managedFound);
    const bool conflict = !managedFound && HasTargetTable(normalized);
    if (conflict && !replaceExisting) {
      return {false, true, L"当前 .codex/config.toml 已有同名 MCP 配置。确认替换后再继续。"};
    }
    const std::string withoutConflict = conflict ? RemoveTargetTables(withoutManaged) : withoutManaged;
    std::string next = TrimEndWhitespace(withoutConflict);
    if (!next.empty()) next += "\n\n";
    next += CreateManagedBlock(runtime, permission);
    next += "\n";
    WriteConfigAtomic(configPath, RestoreNewlines(next, crlf), hadBom);
    std::wstring message = L"已完成配置。\n\n工作区：" + workspace.wstring() + L"\n权限：" + permission + L"\n配置文件：" + configPath.wstring();
    if (existed) message += L"\n\n原有 TOML 配置已保留。";
    return {true, false, message};
  } catch (const std::exception& error) {
    return {false, false, Utf8ToWide(error.what())};
  }
}

ConfigureResult RemoveWorkspaceConfiguration(const fs::path& workspace) {
  try {
    const fs::path configPath = workspace / L".codex" / L"config.toml";
    bool hadBom = false;
    bool existed = false;
    const std::string original = ReadConfig(configPath, hadBom, existed);
    if (!existed) return {true, false, L"当前工作区还没有 .codex/config.toml，无需移除。"};
    bool managedFound = false;
    bool crlf = false;
    const std::string normalized = NormalizeNewlines(original, crlf);
    const std::string withoutManaged = RemoveManagedBlock(normalized, managedFound);
    if (!managedFound) return {true, false, L"当前工作区没有 LingBuilder 托管配置，无需移除。"};
    WriteConfigAtomic(configPath, RestoreNewlines(TrimEndWhitespace(withoutManaged) + "\n", crlf), hadBom);
    return {true, false, L"已移除 LingBuilder 的 Codex MCP 配置，其他 TOML 内容未修改。"};
  } catch (const std::exception& error) {
    return {false, false, Utf8ToWide(error.what())};
  }
}

std::wstring GetControlText(HWND control) {
  const int length = GetWindowTextLengthW(control);
  std::wstring value(static_cast<size_t>(length), L'\0');
  if (length > 0) GetWindowTextW(control, value.data(), length + 1);
  return value;
}

void SetStatus(const std::wstring& message) {
  if (g_statusEdit) SetWindowTextW(g_statusEdit, message.c_str());
}

std::wstring SelectedPermission(HWND window) {
  UNREFERENCED_PARAMETER(window);
  if (g_selectedPermission == kReadonly) return L"readonly";
  if (g_selectedPermission == kYolo) return L"yolo";
  return L"preview";
}

bool ChooseWorkspace(HWND owner) {
  IFileDialog* dialog = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
  if (FAILED(created)) return false;
  DWORD options = 0;
  dialog->GetOptions(&options);
  dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
  dialog->SetTitle(L"选择要配置的 LingBuilder 工作区");
  const HRESULT shown = dialog->Show(owner);
  if (SUCCEEDED(shown)) {
    IShellItem* item = nullptr;
    if (SUCCEEDED(dialog->GetResult(&item))) {
      PWSTR path = nullptr;
      if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path))) {
        SetWindowTextW(g_workspaceEdit, path);
        CoTaskMemFree(path);
      }
      item->Release();
    }
  }
  dialog->Release();
  return SUCCEEDED(shown);
}

std::wstring RunPowerShellCapture(const std::wstring& script) {
  SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
  HANDLE readPipe = nullptr;
  HANDLE writePipe = nullptr;
  if (!CreatePipe(&readPipe, &writePipe, &security, 0)) return {};
  SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0);
  std::wstring command = L"powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"[Console]::OutputEncoding = [Text.Encoding]::UTF8; " + script + L"\"";
  std::vector<wchar_t> commandLine(command.begin(), command.end());
  commandLine.push_back(L'\0');
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;
  startup.hStdOutput = writePipe;
  startup.hStdError = writePipe;
  PROCESS_INFORMATION process{};
  const BOOL started = CreateProcessW(nullptr, commandLine.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process);
  CloseHandle(writePipe);
  if (!started) {
    CloseHandle(readPipe);
    return {};
  }
  std::string output;
  char buffer[512];
  DWORD read = 0;
  while (ReadFile(readPipe, buffer, sizeof(buffer), &read, nullptr) && read > 0) output.append(buffer, buffer + read);
  CloseHandle(readPipe);
  WaitForSingleObject(process.hProcess, 8'000);
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  try { return Trim(Utf8ToWide(TrimAscii(output))); } catch (...) { return {}; }
}

std::wstring FindCodexAppId() {
  return RunPowerShellCapture(L"$a=Get-StartApps | Where-Object { $_.AppID -like 'OpenAI.Codex_*!App' } | Select-Object -First 1 -ExpandProperty AppID; if($a){$a}else{$p=Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1; if($p){$p.PackageFamilyName+'!App'}}");
}

bool LaunchCodex() {
  const std::wstring appId = FindCodexAppId();
  if (appId.empty()) return false;
  const std::wstring target = L"shell:AppsFolder\\" + appId;
  return reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", L"explorer.exe", target.c_str(), nullptr, SW_SHOWNORMAL)) > 32;
}

HFONT CreateUiFont(int pixelHeight, int weight = FW_NORMAL) {
  return CreateFontW(-pixelHeight, 0, 0, 0, weight, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                     OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                     DEFAULT_PITCH | FF_DONTCARE, L"Microsoft YaHei UI");
}

void CreateUiResources() {
  g_font = CreateUiFont(14);
  g_titleFont = CreateUiFont(24, FW_SEMIBOLD);
  g_subtitleFont = CreateUiFont(14);
  g_sectionFont = CreateUiFont(15, FW_SEMIBOLD);
  g_buttonFont = CreateUiFont(14, FW_SEMIBOLD);
  g_smallFont = CreateUiFont(12);
  g_backgroundBrush = CreateSolidBrush(kBackgroundColor);
  g_headerBrush = CreateSolidBrush(kHeaderColor);
  g_surfaceBrush = CreateSolidBrush(kSurfaceColor);
  g_editBrush = CreateSolidBrush(kSurfaceColor);
  g_statusBrush = CreateSolidBrush(kStatusColor);
}

void DestroyUiResources() {
  HBRUSH* brushes[] = {&g_backgroundBrush, &g_headerBrush, &g_surfaceBrush, &g_editBrush, &g_statusBrush};
  for (HBRUSH* brush : brushes) {
    if (*brush) {
      DeleteObject(*brush);
      *brush = nullptr;
    }
  }
  HFONT* fonts[] = {&g_font, &g_titleFont, &g_subtitleFont, &g_sectionFont, &g_buttonFont, &g_smallFont};
  for (HFONT* font : fonts) {
    if (*font) {
      DeleteObject(*font);
      *font = nullptr;
    }
  }
}

void ApplyFont(HWND control, HFONT font = nullptr) {
  if (control && (font || g_font)) SendMessageW(control, WM_SETFONT, reinterpret_cast<WPARAM>(font ? font : g_font), TRUE);
}

void DrawPanel(HDC hdc, const RECT& rect, COLORREF fill = kSurfaceColor) {
  HBRUSH brush = CreateSolidBrush(fill);
  HPEN pen = CreatePen(PS_SOLID, 1, kBorderColor);
  HGDIOBJ oldBrush = SelectObject(hdc, brush);
  HGDIOBJ oldPen = SelectObject(hdc, pen);
  RoundRect(hdc, rect.left, rect.top, rect.right, rect.bottom, 12, 12);
  SelectObject(hdc, oldPen);
  SelectObject(hdc, oldBrush);
  DeleteObject(pen);
  DeleteObject(brush);
}

void PaintWindowBackground(HWND window, HDC hdc) {
  RECT client{};
  GetClientRect(window, &client);
  const int width = client.right - client.left;
  const int height = client.bottom - client.top;
  FillRect(hdc, &client, g_backgroundBrush);

  RECT header{0, 0, width, 96};
  FillRect(hdc, &header, g_headerBrush);
  RECT accent{0, 94, width, 98};
  HBRUSH accentBrush = CreateSolidBrush(kHeaderAccentColor);
  FillRect(hdc, &accent, accentBrush);
  DeleteObject(accentBrush);

  const int margin = 28;
  DrawPanel(hdc, RECT{margin, 112, width - margin, 208});
  DrawPanel(hdc, RECT{margin, 224, width - margin, 354});
  DrawPanel(hdc, RECT{margin, 370, width - margin, 468});
  DrawPanel(hdc, RECT{margin, 492, width - margin, std::max(636, height - 20)}, kSurfaceColor);
}

void LayoutControls(HWND window) {
  RECT client{};
  GetClientRect(window, &client);
  const int width = client.right - client.left;
  const int height = client.bottom - client.top;
  const int margin = 28;
  const int contentWidth = std::max(520, width - margin * 2);
  const int pickerWidth = 136;
  const int halfWidth = (contentWidth - 12) / 2;

  MoveWindow(g_titleLabel, margin, 18, contentWidth - 16, 32, TRUE);
  MoveWindow(g_subtitleLabel, margin, 55, contentWidth - 16, 22, TRUE);

  MoveWindow(g_workspaceLabel, margin + 16, 122, 180, 24, TRUE);
  MoveWindow(g_workspaceHint, width - margin - 230, 123, 214, 20, TRUE);
  MoveWindow(g_workspaceEdit, margin + 16, 149, contentWidth - 32 - pickerWidth - 12, 34, TRUE);
  MoveWindow(GetDlgItem(window, kChooseWorkspace), width - margin - 16 - pickerWidth, 149, pickerWidth, 34, TRUE);

  MoveWindow(g_permissionLabel, margin + 16, 235, 130, 24, TRUE);
  MoveWindow(g_permissionHint, margin + 152, 236, contentWidth - 184, 22, TRUE);
  MoveWindow(GetDlgItem(window, kReadonly), margin + 16, 269, halfWidth, 38, TRUE);
  MoveWindow(GetDlgItem(window, kPreview), margin + 16 + halfWidth + 12, 269, halfWidth, 38, TRUE);
  MoveWindow(GetDlgItem(window, kYolo), margin + 16, 313, halfWidth, 38, TRUE);

  MoveWindow(GetDlgItem(window, kLaunchCodex), margin + 16, 382, contentWidth - 32, 32, TRUE);
  MoveWindow(GetDlgItem(window, kConfigure), margin + 16, 424, 190, 38, TRUE);
  MoveWindow(GetDlgItem(window, kRemove), margin + 218, 424, 190, 38, TRUE);

  MoveWindow(g_runtimeLabel, margin + 16, 476, contentWidth - 32, 20, TRUE);
  MoveWindow(g_statusLabel, margin + 16, 502, contentWidth - 32, 22, TRUE);
  MoveWindow(g_statusEdit, margin + 16, 530, contentWidth - 32, std::max(96, height - 566), TRUE);
  SendMessageW(g_statusEdit, EM_SETMARGINS, EC_LEFTMARGIN | EC_RIGHTMARGIN, MAKELONG(12, 12));
  InvalidateRect(window, nullptr, TRUE);
}

bool IsOptionButton(int id) {
  return id == kReadonly || id == kPreview || id == kYolo;
}

bool IsActionButton(int id) {
  return id == kChooseWorkspace || id == kConfigure || id == kRemove;
}

void FillRoundedRect(HDC hdc, const RECT& rect, COLORREF fill, COLORREF border, int radius = 8) {
  HBRUSH brush = CreateSolidBrush(fill);
  HPEN pen = CreatePen(PS_SOLID, 1, border);
  HGDIOBJ oldBrush = SelectObject(hdc, brush);
  HGDIOBJ oldPen = SelectObject(hdc, pen);
  RoundRect(hdc, rect.left, rect.top, rect.right, rect.bottom, radius, radius);
  SelectObject(hdc, oldPen);
  SelectObject(hdc, oldBrush);
  DeleteObject(pen);
  DeleteObject(brush);
}

void DrawModernButton(const DRAWITEMSTRUCT& item) {
  const int id = static_cast<int>(item.CtlID);
  const bool pressed = (item.itemState & ODS_SELECTED) != 0;
  const bool focused = (item.itemState & ODS_FOCUS) != 0;
  const bool disabled = (item.itemState & ODS_DISABLED) != 0;
  const bool checked = IsOptionButton(id) ? id == g_selectedPermission :
                       id == kLaunchCodex ? g_launchCodexChecked : false;

  COLORREF fill = kSurfaceColor;
  COLORREF border = kBorderColor;
  COLORREF textColor = kTextColor;
  RECT rect = item.rcItem;
  InflateRect(&rect, -1, -1);

  if (id == kConfigure) {
    fill = pressed ? kAccentHoverColor : kAccentColor;
    border = fill;
    textColor = RGB(255, 255, 255);
  } else if (id == kChooseWorkspace) {
    fill = pressed ? kAccentLightColor : kSurfaceColor;
    border = kAccentColor;
    textColor = kAccentColor;
  } else if (id == kRemove) {
    fill = pressed ? RGB(254, 242, 242) : kSurfaceColor;
    border = RGB(252, 165, 165);
    textColor = kDangerColor;
  } else if (IsOptionButton(id)) {
    if (id == kYolo) textColor = kWarningColor;
    if (checked) {
      fill = id == kYolo ? kWarningLightColor : kAccentLightColor;
      border = id == kYolo ? RGB(245, 158, 11) : kAccentColor;
      textColor = id == kYolo ? kWarningColor : kAccentColor;
    }
  } else if (id == kLaunchCodex) {
    fill = checked ? kAccentLightColor : kSurfaceColor;
    border = checked ? RGB(147, 197, 253) : kBorderColor;
    textColor = kTextColor;
  }
  if (disabled) {
    fill = RGB(241, 245, 249);
    border = RGB(203, 213, 225);
    textColor = kMutedColor;
  }
  FillRoundedRect(item.hDC, rect, fill, border, id == kConfigure || id == kRemove || id == kChooseWorkspace ? 8 : 7);

  SetBkMode(item.hDC, TRANSPARENT);
  SetTextColor(item.hDC, textColor);
  HFONT oldFont = static_cast<HFONT>(SelectObject(item.hDC, g_buttonFont));
  wchar_t text[512] = {};
  GetWindowTextW(item.hwndItem, text, static_cast<int>(std::size(text)));
  RECT textRect = rect;

  if (IsOptionButton(id)) {
    const int centerX = rect.left + 20;
    const int centerY = (rect.top + rect.bottom) / 2;
    HPEN radioPen = CreatePen(PS_SOLID, 1, checked ? border : RGB(148, 163, 184));
    HBRUSH radioBrush = CreateSolidBrush(fill);
    HGDIOBJ oldRadioPen = SelectObject(item.hDC, radioPen);
    HGDIOBJ oldRadioBrush = SelectObject(item.hDC, radioBrush);
    Ellipse(item.hDC, centerX - 8, centerY - 8, centerX + 8, centerY + 8);
    SelectObject(item.hDC, oldRadioBrush);
    SelectObject(item.hDC, oldRadioPen);
    DeleteObject(radioBrush);
    DeleteObject(radioPen);
    if (checked) {
      HBRUSH dotBrush = CreateSolidBrush(border);
      HGDIOBJ oldDotBrush = SelectObject(item.hDC, dotBrush);
      Ellipse(item.hDC, centerX - 4, centerY - 4, centerX + 4, centerY + 4);
      SelectObject(item.hDC, oldDotBrush);
      DeleteObject(dotBrush);
    }
    textRect.left += 38;
    textRect.right -= 8;
    DrawTextW(item.hDC, text, -1, &textRect, DT_SINGLELINE | DT_VCENTER | DT_LEFT | DT_END_ELLIPSIS);
  } else if (id == kLaunchCodex) {
    RECT checkRect{rect.left + 14, rect.top + 9, rect.left + 30, rect.top + 25};
    FillRoundedRect(item.hDC, checkRect, checked ? kAccentColor : kSurfaceColor, checked ? kAccentColor : RGB(148, 163, 184), 3);
    if (checked) {
      HPEN checkPen = CreatePen(PS_SOLID, 2, RGB(255, 255, 255));
      HGDIOBJ oldPen = SelectObject(item.hDC, checkPen);
      MoveToEx(item.hDC, checkRect.left + 4, checkRect.top + 8, nullptr);
      LineTo(item.hDC, checkRect.left + 7, checkRect.bottom - 4);
      LineTo(item.hDC, checkRect.right - 3, checkRect.top + 4);
      SelectObject(item.hDC, oldPen);
      DeleteObject(checkPen);
    }
    textRect.left += 42;
    textRect.right -= 8;
    DrawTextW(item.hDC, text, -1, &textRect, DT_SINGLELINE | DT_VCENTER | DT_LEFT | DT_END_ELLIPSIS);
  } else {
    DrawTextW(item.hDC, text, -1, &textRect, DT_SINGLELINE | DT_VCENTER | DT_CENTER | DT_END_ELLIPSIS);
  }
  SelectObject(item.hDC, oldFont);
  if (focused) {
    RECT focusRect = item.rcItem;
    InflateRect(&focusRect, -5, -5);
    DrawFocusRect(item.hDC, &focusRect);
  }
}

void CreateControls(HWND window) {
  CreateUiResources();
  g_titleLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"LingBuilder Codex 一键配置",
                                 WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_subtitleLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC",
                                    L"为当前项目配置 Codex 的 LingBuilder MCP，不启动 LingBuilder IDE。",
                                    WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_workspaceLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"工作区目录",
                                     WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_workspaceHint = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"只修改当前项目的配置",
                                    WS_CHILD | WS_VISIBLE | SS_RIGHT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_workspaceEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", DefaultWorkspace().c_str(),
                                    WS_CHILD | WS_VISIBLE | WS_TABSTOP | ES_AUTOHSCROLL, 0, 0, 0, 0,
                                    window, reinterpret_cast<HMENU>(kWorkspaceEdit), nullptr, nullptr);
  CreateWindowW(L"BUTTON", L"选择工作区…", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kChooseWorkspace), nullptr, nullptr);

  g_permissionLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"权限模式",
                                      WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_permissionHint = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC",
                                     L"决定 AI 是否可以写文件和触发构建，始终只允许 LingBuilder 受控操作。",
                                     WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  CreateWindowW(L"BUTTON", L"只读  不写文件，不构建",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTORADIOBUTTON | BS_OWNERDRAW | WS_GROUP,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kReadonly), nullptr, nullptr);
  CreateWindowW(L"BUTTON", L"预览  写入和构建需确认（推荐）",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTORADIOBUTTON | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kPreview), nullptr, nullptr);
  CreateWindowW(L"BUTTON", L"YOLO  自动执行受控操作（谨慎）",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTORADIOBUTTON | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kYolo), nullptr, nullptr);
  g_selectedPermission = kPreview;
  CheckDlgButton(window, kPreview, BST_CHECKED);

  CreateWindowW(L"BUTTON", L"配置完成后自动打开 Codex 桌面端",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kLaunchCodex), nullptr, nullptr);
  g_launchCodexChecked = true;
  CheckDlgButton(window, kLaunchCodex, BST_CHECKED);
  CreateWindowW(L"BUTTON", L"一键配置", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kConfigure), nullptr, nullptr);
  CreateWindowW(L"BUTTON", L"移除 LingBuilder 配置", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_OWNERDRAW,
                0, 0, 0, 0, window, reinterpret_cast<HMENU>(kRemove), nullptr, nullptr);

  g_runtimeLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"",
                                   WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window,
                                   reinterpret_cast<HMENU>(kRuntime), nullptr, nullptr);
  g_statusLabel = CreateWindowExW(WS_EX_TRANSPARENT, L"STATIC", L"执行状态",
                                  WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, window, nullptr, nullptr, nullptr);
  g_statusEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                                 WS_CHILD | WS_VISIBLE | WS_TABSTOP | ES_MULTILINE | ES_READONLY |
                                     ES_AUTOVSCROLL | WS_VSCROLL,
                                 0, 0, 0, 0, window, reinterpret_cast<HMENU>(kStatus), nullptr, nullptr);

  ApplyFont(g_titleLabel, g_titleFont);
  ApplyFont(g_subtitleLabel, g_subtitleFont);
  ApplyFont(g_workspaceLabel, g_sectionFont);
  ApplyFont(g_permissionLabel, g_sectionFont);
  ApplyFont(g_statusLabel, g_sectionFont);
  ApplyFont(g_workspaceHint, g_smallFont);
  ApplyFont(g_permissionHint, g_smallFont);
  ApplyFont(g_workspaceEdit, g_font);
  ApplyFont(GetDlgItem(window, kChooseWorkspace), g_buttonFont);
  ApplyFont(GetDlgItem(window, kReadonly), g_buttonFont);
  ApplyFont(GetDlgItem(window, kPreview), g_buttonFont);
  ApplyFont(GetDlgItem(window, kYolo), g_buttonFont);
  ApplyFont(GetDlgItem(window, kLaunchCodex), g_buttonFont);
  ApplyFont(GetDlgItem(window, kConfigure), g_buttonFont);
  ApplyFont(GetDlgItem(window, kRemove), g_buttonFont);
  ApplyFont(g_runtimeLabel, g_smallFont);
  ApplyFont(g_statusEdit, g_font);
  SetWindowTextW(g_runtimeLabel, g_runtime.runtime.empty()
                                  ? L"运行时：未自动找到，请把工具放在 LingBuilder 项目或安装目录附近。"
                                  : (L"运行时：已找到 " + g_runtime.runtime.wstring()).c_str());
  SetStatus(L"请选择工作区后点击“一键配置”。\r\n\r\n工具会保留原有 .codex/config.toml 内容，只管理带 LingBuilder 标记的配置段。\r\n推荐使用“预览”权限；YOLO 只允许 LingBuilder 受控 MCP 工具，不开放任意 Shell。");
  LayoutControls(window);
}

void HandleConfigure(HWND window) {
  try {
    const fs::path workspace = NormalizeWorkspace(GetControlText(g_workspaceEdit));
    const ConfigureResult first = ConfigureWorkspace(workspace, SelectedPermission(window), g_runtime, false);
    ConfigureResult result = first;
    if (first.needsConfirmation) {
      const int answer = MessageBoxW(window, L"当前工作区已经存在同名的 lingbuilder_desktop MCP 配置。\n\n是否由 LingBuilder 接管并替换它？其他 TOML 配置会保留。", L"需要确认配置冲突", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2);
      if (answer != IDYES) {
        SetStatus(L"已取消，原有配置未修改。");
        return;
      }
      result = ConfigureWorkspace(workspace, SelectedPermission(window), g_runtime, true);
    }
    SetStatus(result.message);
    if (!result.ok) {
      MessageBoxW(window, result.message.c_str(), L"配置失败", MB_OK | MB_ICONERROR);
      return;
    }
    const bool launch = g_launchCodexChecked;
    if (launch) {
      if (LaunchCodex()) {
        SetStatus(result.message + L"\n\nCodex 桌面端已启动。请在 Codex 中新建任务并粘贴项目提示词。\n如果 Codex 已经运行，请完全退出后重新打开以加载新配置。");
      } else {
        SetStatus(result.message + L"\n\n未检测到可启动的 Codex 桌面端。配置已经完成，请手动打开 Codex。");
      }
    }
    MessageBoxW(window, L"配置完成。现在可以打开 Codex 桌面端，并使用 LingBuilder MCP 创建项目。", L"LingBuilder 配置完成", MB_OK | MB_ICONINFORMATION);
  } catch (const std::exception& error) {
    const std::wstring message = Utf8ToWide(error.what());
    SetStatus(message);
    MessageBoxW(window, message.c_str(), L"无法配置", MB_OK | MB_ICONERROR);
  }
}

void HandleRemove(HWND window) {
  try {
    const fs::path workspace = NormalizeWorkspace(GetControlText(g_workspaceEdit));
    const int answer = MessageBoxW(window, L"确定移除当前工作区中的 LingBuilder Codex MCP 配置吗？其他 TOML 内容不会删除。", L"确认移除", MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2);
    if (answer != IDYES) return;
    const ConfigureResult result = RemoveWorkspaceConfiguration(workspace);
    SetStatus(result.message);
    if (!result.ok) MessageBoxW(window, result.message.c_str(), L"移除失败", MB_OK | MB_ICONERROR);
  } catch (const std::exception& error) {
    const std::wstring message = Utf8ToWide(error.what());
    SetStatus(message);
    MessageBoxW(window, message.c_str(), L"无法移除", MB_OK | MB_ICONERROR);
  }
}

#ifdef LINGBUILDER_USE_NEW_EMOJI

constexpr Color kNeBackground = 0xFFF5F7FBu;
constexpr Color kNeHeader = 0xFF1F3E63u;
constexpr Color kNeHeaderAccent = 0xFF2DA3ACu;
constexpr Color kNeSurface = 0xFFFFFFFFu;
constexpr Color kNeBorder = 0xFFE2E8F0u;
constexpr Color kNeText = 0xFF1F2937u;
constexpr Color kNeMuted = 0xFF64748Bu;
constexpr Color kNeAccent = 0xFF2563EBu;
constexpr Color kNeDanger = 0xFFB91C1Cu;
constexpr int kNeTitleBarHeight = 36;
constexpr int kNeContentOffsetY = 24;
constexpr int kNeUiScalePercent = 50;
constexpr int kNeFontScalePercent = kNeUiScalePercent * 2;

int NeScale(int value) {
  const int uiValue = std::max(1, MulDiv(value, kNeUiScalePercent, 100));
  return MulDiv(uiValue, static_cast<int>(std::max<UINT>(96, g_neDpi)), 96);
}

int NeContentY(int value) {
  return NeScale(value + kNeContentOffsetY);
}

int NeCreatePanel(int x, int y, int width, int height) {
  return EU_CreatePanel(g_newEmojiWindow, 0, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

int NeCreateText(const wchar_t* text, int x, int y, int width, int height) {
  return NE_创建文本(g_newEmojiWindow, 0, text, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

int NeCreateButton(const wchar_t* text, int x, int y, int width, int height) {
  return NE_创建按钮(g_newEmojiWindow, 0, L"", text, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

int NeCreateEdit(const wchar_t* text, int x, int y, int width, int height) {
  return NE_创建编辑框(g_newEmojiWindow, 0, text, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

int NeCreateRadio(const wchar_t* text, int checked, int x, int y, int width, int height) {
  return NE_创建单选框(g_newEmojiWindow, 0, text, checked, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

int NeCreateCheckbox(const wchar_t* text, int checked, int x, int y, int width, int height) {
  return NE_创建复选框(g_newEmojiWindow, 0, text, checked, NeScale(x), NeContentY(y), NeScale(width), NeScale(height));
}

void NewEmojiSetText(int elementId, const std::wstring& value) {
  if (!g_newEmojiWindow || elementId <= 0) return;
  try {
    const std::string bytes = WideToUtf8(value);
    EU_SetElementText(g_newEmojiWindow, elementId,
                      reinterpret_cast<const unsigned char*>(bytes.data()), static_cast<int>(bytes.size()));
  } catch (...) {
    // Callbacks must not let conversion errors cross the DLL boundary.
  }
}

void NewEmojiSetEditText(const std::wstring& value) {
  if (!g_newEmojiWindow || g_neWorkspaceEdit <= 0) return;
  try {
    const std::string bytes = WideToUtf8(value);
    EU_SetEditBoxText(g_newEmojiWindow, g_neWorkspaceEdit,
                      reinterpret_cast<const unsigned char*>(bytes.data()), static_cast<int>(bytes.size()));
  } catch (...) {
  }
}

void NewEmojiSetStatus(const std::wstring& message) {
  NewEmojiSetText(g_neStatusText, message);
}

void NewEmojiSetFont(int elementId, int size, Color foreground = kNeText) {
  if (!g_newEmojiWindow || elementId <= 0) return;
  const int scaledSize = std::max(1, MulDiv(size, kNeFontScalePercent, 100));
  NE_设置元素字体(g_newEmojiWindow, elementId, L"Microsoft YaHei UI", scaledSize);
  EU_SetElementColor(g_newEmojiWindow, elementId, 0, foreground);
}

void NewEmojiStylePanel(int elementId, Color background = kNeSurface, Color border = kNeBorder,
                        float radius = 12.0f, float borderWidth = 1.0f) {
  if (!g_newEmojiWindow || elementId <= 0) return;
  EU_SetPanelStyle(g_newEmojiWindow, elementId, background, border, borderWidth,
                   radius * static_cast<float>(kNeUiScalePercent) / 100.0f,
                   std::max(4, MulDiv(20, kNeUiScalePercent, 100)));
}

void NewEmojiSetSingleLine(int elementId, int align = 0) {
  if (!g_newEmojiWindow || elementId <= 0) return;
  EU_SetTextOptions(g_newEmojiWindow, elementId, align, 1, 0, 1);
}

void NewEmojiSetPermissionHighlight(int selected) {
  if (!g_newEmojiWindow) return;
  EU_SetElementVisible(g_newEmojiWindow, g_neReadonlyHighlight, selected == kReadonly ? 1 : 0);
  EU_SetElementVisible(g_newEmojiWindow, g_nePreviewHighlight, selected == kPreview ? 1 : 0);
  EU_SetElementVisible(g_newEmojiWindow, g_neYoloHighlight, selected == kYolo ? 1 : 0);
}

void NewEmojiStyleButton(int elementId, int variant, Color foreground = kNeText) {
  if (!g_newEmojiWindow || elementId <= 0) return;
  EU_SetButtonOptions(g_newEmojiWindow, elementId, variant, 0, 1, 0, 0, 1);
  EU_SetButtonStateColors(g_newEmojiWindow, elementId,
                          kNeAccent, kNeAccent, 0xFFFFFFFFu,
                          0xFF1D4ED8u, 0xFF1D4ED8u, 0xFFFFFFFFu);
  NewEmojiSetFont(elementId, 14, foreground);
}

bool NewEmojiChooseWorkspace() {
  IFileDialog* dialog = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
  if (FAILED(created)) return false;
  DWORD options = 0;
  dialog->GetOptions(&options);
  dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
  dialog->SetTitle(L"选择要配置的 LingBuilder 工作区");
  const HRESULT shown = dialog->Show(g_newEmojiWindow);
  if (SUCCEEDED(shown)) {
    IShellItem* item = nullptr;
    if (SUCCEEDED(dialog->GetResult(&item))) {
      PWSTR path = nullptr;
      if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path))) {
        g_neWorkspaceValue = path;
        NewEmojiSetEditText(g_neWorkspaceValue);
        CoTaskMemFree(path);
      }
      item->Release();
    }
  }
  dialog->Release();
  return SUCCEEDED(shown);
}

std::wstring NewEmojiPermission() {
  if (g_selectedPermission == kReadonly) return L"readonly";
  if (g_selectedPermission == kYolo) return L"yolo";
  return L"preview";
}

void NewEmojiSelectPermission(int selected) {
  if (selected == g_neReadonly) selected = kReadonly;
  else if (selected == g_nePreview) selected = kPreview;
  else if (selected == g_neYolo) selected = kYolo;
  g_selectedPermission = selected;
  if (!g_newEmojiWindow) return;
  EU_SetRadioChecked(g_newEmojiWindow, g_neReadonly, selected == kReadonly ? 1 : 0);
  EU_SetRadioChecked(g_newEmojiWindow, g_nePreview, selected == kPreview ? 1 : 0);
  EU_SetRadioChecked(g_newEmojiWindow, g_neYolo, selected == kYolo ? 1 : 0);
  NewEmojiSetFont(g_neReadonly, 14, kNeText);
  NewEmojiSetFont(g_nePreview, 14, kNeAccent);
  NewEmojiSetFont(g_neYolo, 14, 0xFFB45309u);
  NewEmojiSetPermissionHighlight(selected);
}

void HandleConfigureNewEmoji() {
  try {
    const fs::path workspace = NormalizeWorkspace(g_neWorkspaceValue);
    ConfigureResult result = ConfigureWorkspace(workspace, NewEmojiPermission(), g_runtime, false);
    if (result.needsConfirmation) {
      const int answer = MessageBoxW(g_newEmojiWindow,
                                     L"当前工作区已经存在同名的 lingbuilder_desktop MCP 配置。\n\n是否由 LingBuilder 接管并替换它？其他 TOML 配置会保留。",
                                     L"需要确认配置冲突", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2);
      if (answer != IDYES) {
        NewEmojiSetStatus(L"已取消，原有配置未修改。");
        return;
      }
      result = ConfigureWorkspace(workspace, NewEmojiPermission(), g_runtime, true);
    }
    NewEmojiSetStatus(result.message);
    if (!result.ok) {
      MessageBoxW(g_newEmojiWindow, result.message.c_str(), L"配置失败", MB_OK | MB_ICONERROR);
      return;
    }
    if (g_launchCodexChecked) {
      if (LaunchCodex()) {
        NewEmojiSetStatus(result.message + L"\n\nCodex 桌面端已启动。请在 Codex 中新建任务并粘贴项目提示词。\n如果 Codex 已经运行，请完全退出后重新打开以加载新配置。");
      } else {
        NewEmojiSetStatus(result.message + L"\n\n未检测到可启动的 Codex 桌面端。配置已经完成，请手动打开 Codex。");
      }
    }
  } catch (const std::exception& error) {
    const std::wstring message = Utf8ToWide(error.what());
    NewEmojiSetStatus(message);
    MessageBoxW(g_newEmojiWindow, message.c_str(), L"无法配置", MB_OK | MB_ICONERROR);
  }
}

void HandleRemoveNewEmoji() {
  try {
    const fs::path workspace = NormalizeWorkspace(g_neWorkspaceValue);
    const int answer = MessageBoxW(g_newEmojiWindow,
                                   L"确定移除当前工作区中的 LingBuilder Codex MCP 配置吗？其他 TOML 内容不会删除。",
                                   L"确认移除", MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2);
    if (answer != IDYES) return;
    const ConfigureResult result = RemoveWorkspaceConfiguration(workspace);
    NewEmojiSetStatus(result.message);
    if (!result.ok) MessageBoxW(g_newEmojiWindow, result.message.c_str(), L"移除失败", MB_OK | MB_ICONERROR);
  } catch (const std::exception& error) {
    const std::wstring message = Utf8ToWide(error.what());
    NewEmojiSetStatus(message);
    MessageBoxW(g_newEmojiWindow, message.c_str(), L"无法移除", MB_OK | MB_ICONERROR);
  }
}

void __stdcall NewEmojiClickCallback(int elementId) {
  try {
    if (elementId == g_neChooseWorkspace) {
      NewEmojiChooseWorkspace();
    } else if (elementId == g_neConfigure) {
      HandleConfigureNewEmoji();
    } else if (elementId == g_neRemove) {
      HandleRemoveNewEmoji();
    } else if (elementId == g_neReadonly || elementId == g_nePreview || elementId == g_neYolo) {
      NewEmojiSelectPermission(elementId);
    } else if (elementId == g_neLaunchCodex) {
      g_launchCodexChecked = EU_GetCheckboxChecked(g_newEmojiWindow, g_neLaunchCodex) != 0;
    }
  } catch (...) {
    NewEmojiSetStatus(L"原生界面回调发生异常，操作已停止。");
  }
}

void __stdcall NewEmojiEditCallback(int elementId, const unsigned char* utf8, int length) {
  if (elementId != g_neWorkspaceEdit) return;
  try {
    g_neWorkspaceValue = Utf8ToWide(std::string(reinterpret_cast<const char*>(utf8 ? utf8 : reinterpret_cast<const unsigned char*>("")),
                                                 static_cast<size_t>(std::max(0, length))));
  } catch (...) {
  }
}

void EnablePerMonitorDpiAwareness() {
  HMODULE user32 = GetModuleHandleW(L"user32.dll");
  using SetProcessDpiAwarenessContextFn = BOOL(WINAPI*)(HANDLE);
  using SetProcessDpiAwareFn = BOOL(WINAPI*)();
  if (user32) {
    const auto setContext = reinterpret_cast<SetProcessDpiAwarenessContextFn>(
        GetProcAddress(user32, "SetProcessDpiAwarenessContext"));
    if (setContext && setContext(reinterpret_cast<HANDLE>(static_cast<INT_PTR>(-4)))) return;
    const auto setLegacy = reinterpret_cast<SetProcessDpiAwareFn>(GetProcAddress(user32, "SetProcessDPIAware"));
    if (setLegacy) setLegacy();
  }
  // Older New_Emoji builds still consult the legacy process flag when scaling
  // element coordinates, so keep the documented fallback explicit.
  SetProcessDPIAware();
}

int RunNewEmojiGui() {
  g_neWorkspaceValue = DefaultWorkspace().wstring();
  g_selectedPermission = kPreview;
  g_launchCodexChecked = true;
  HDC screenDc = GetDC(nullptr);
  g_neDpi = screenDc ? static_cast<UINT>(GetDeviceCaps(screenDc, LOGPIXELSX)) : 96;
  if (screenDc) ReleaseDC(nullptr, screenDc);
  const int width = 900;
  const int height = 844;
  const int logicalWidth = NeScale(width);
  const int logicalHeight = NeScale(height);
  const int screenWidth = GetSystemMetrics(SM_CXSCREEN);
  const int screenHeight = GetSystemMetrics(SM_CYSCREEN);
  const int x = std::max(0, (screenWidth - logicalWidth) / 2);
  const int y = std::max(0, (screenHeight - logicalHeight) / 2);
  g_newEmojiWindow = NE_创建窗口(L"LingBuilder Codex 一键配置", x, y, logicalWidth, logicalHeight);
  if (!g_newEmojiWindow) {
    MessageBoxW(nullptr, L"new_emoji 原生窗口创建失败，请确认 new_emoji.dll 与配置器位于同一目录。",
                L"LingBuilder 配置器", MB_OK | MB_ICONERROR);
    return 2;
  }
  EU_ShowWindow(g_newEmojiWindow, 0);
  EU_SetWindowRoundedCorners(g_newEmojiWindow, 1, NeScale(12));
  const int titleBarHeight = NeScale(kNeTitleBarHeight);
  const int captionButtonWidth = NeScale(44);
  const int captionButtonsWidth = captionButtonWidth * 3;
  EU_SetTitleBarVisible(g_newEmojiWindow, 1);
  EU_SetTitleBarHeight(g_newEmojiWindow, titleBarHeight);
  EU_SetWindowCaptionButtonsVisible(g_newEmojiWindow, 1, 1, 1);
  EU_SetTitleBarButtonStyle(g_newEmojiWindow, captionButtonWidth, titleBarHeight,
                            0xFFE2E8F0u, 0xFF334155u, 0xFFDC2626u);
  EU_SetWindowCaptionButtonBounds(g_newEmojiWindow, std::max(0, logicalWidth - captionButtonsWidth),
                                  0, captionButtonsWidth, titleBarHeight);
  EU_SetWindowDragRegion(g_newEmojiWindow, 0, 0,
                         std::max(0, logicalWidth - captionButtonsWidth), titleBarHeight, 1);
  EU_SetWindowNoDragRegion(g_newEmojiWindow, std::max(0, logicalWidth - captionButtonsWidth),
                           0, captionButtonsWidth, titleBarHeight, 1);

  const int header = NeCreatePanel(20, 20, 860, 112);
  const int workspacePanel = NeCreatePanel(20, 150, 860, 122);
  const int permissionPanel = NeCreatePanel(20, 292, 860, 180);
  const int actionPanel = NeCreatePanel(20, 492, 860, 112);
  const int statusPanel = NeCreatePanel(20, 640, 860, 148);
  NewEmojiStylePanel(header, kNeHeader, kNeHeader, 12);
  NewEmojiStylePanel(workspacePanel);
  NewEmojiStylePanel(permissionPanel);
  NewEmojiStylePanel(actionPanel);
  NewEmojiStylePanel(statusPanel, 0xFFF8FAFCu, kNeBorder, 12);
  if (header > 0) {
    const int accent = NeCreatePanel(20, 126, 860, 6);
    NewEmojiStylePanel(accent, kNeHeaderAccent, kNeHeaderAccent, 2);
  }

  const int title = NeCreateText(L"LingBuilder Codex 一键配置", 44, 36, 760, 32);
  const int subtitle = NeCreateText(L"为当前项目配置 Codex 的 LingBuilder MCP，不启动 LingBuilder IDE。", 44, 78, 800, 22);
  const int workspaceLabel = NeCreateText(L"工作区目录", 44, 174, 180, 24);
  const int workspaceHint = NeCreateText(L"仅修改当前项目", 700, 174, 160, 24);
  g_neWorkspaceEdit = NeCreateEdit(g_neWorkspaceValue.c_str(), 44, 212, 648, 38);
  g_neChooseWorkspace = NeCreateButton(L"选择工作区…", 708, 212, 152, 38);
  g_neReadonlyHighlight = NeCreatePanel(38, 360, 402, 50);
  g_nePreviewHighlight = NeCreatePanel(448, 360, 418, 50);
  g_neYoloHighlight = NeCreatePanel(38, 408, 402, 50);
  for (const int id : {g_neReadonlyHighlight, g_nePreviewHighlight, g_neYoloHighlight}) {
    NewEmojiStylePanel(id, kNeSurface, kNeAccent, 10, 2.0f);
    EU_SetElementVisible(g_newEmojiWindow, id, 0);
  }
  g_neReadonly = NeCreateRadio(L"只读  不写文件，不构建", 0, 44, 366, 390, 38);
  g_nePreview = NeCreateRadio(L"预览  写入和构建需确认（推荐）", 1, 454, 366, 406, 38);
  g_neYolo = NeCreateRadio(L"YOLO  自动执行受控操作（谨慎）", 0, 44, 414, 390, 38);
  const int permissionLabel = NeCreateText(L"权限模式", 44, 322, 130, 24);
  const int permissionHint = NeCreateText(L"控制 AI 是否可写入和构建，仅允许 LingBuilder 受控操作。", 184, 322, 666, 24);
  g_neLaunchCodex = NeCreateCheckbox(L"完成后打开 Codex 桌面端", 1, 44, 512, 812, 34);
  g_neConfigure = NeCreateButton(L"一键配置", 44, 558, 190, 40);
  g_neRemove = NeCreateButton(L"移除 LingBuilder 配置", 260, 558, 230, 40);
  const std::wstring runtimeMessage = g_runtime.runtime.empty()
      ? L"运行时：未自动找到，请把工具放在 LingBuilder 项目或安装目录附近。"
      : L"运行时：已找到 " + g_runtime.runtime.wstring();
  g_neRuntimeText = NeCreateText(runtimeMessage.c_str(), 44, 614, 812, 20);
  const int statusLabel = NeCreateText(L"执行状态", 44, 658, 200, 24);
  g_neStatusText = NeCreateText(L"", 44, 686, 812, 86);

  NewEmojiSetFont(title, 24, 0xFFFFFFFFu);
  NewEmojiSetFont(subtitle, 14, 0xFFE2E8F0u);
  NewEmojiSetFont(workspaceLabel, 15, kNeText);
  NewEmojiSetFont(workspaceHint, 12, kNeMuted);
  NewEmojiSetFont(permissionLabel, 15, kNeText);
  NewEmojiSetFont(permissionHint, 12, kNeMuted);
  NewEmojiSetFont(statusLabel, 15, kNeText);
  NewEmojiSetFont(g_neRuntimeText, 12, kNeMuted);
  NewEmojiSetFont(g_neStatusText, 13, kNeText);
  for (const int id : {title, subtitle, workspaceLabel, permissionLabel, permissionHint, statusLabel}) {
    NewEmojiSetSingleLine(id);
  }
  NewEmojiSetSingleLine(workspaceHint, 2);
  NewEmojiSetSingleLine(g_neRuntimeText);
  if (g_neStatusText > 0) EU_SetTextOptions(g_newEmojiWindow, g_neStatusText, 0, 0, 1, 0);
  if (g_neWorkspaceEdit > 0) {
    const std::string placeholder = WideToUtf8(L"请选择项目工作区");
    EU_SetEditBoxOptions(g_newEmojiWindow, g_neWorkspaceEdit, 0, 0, 0, kNeAccent,
                         reinterpret_cast<const unsigned char*>(placeholder.data()), static_cast<int>(placeholder.size()));
    NewEmojiSetFont(g_neWorkspaceEdit, 14, kNeText);
    EU_SetElementColor(g_newEmojiWindow, g_neWorkspaceEdit, kNeSurface, kNeText);
    EU_SetEditBoxTextCallback(g_newEmojiWindow, g_neWorkspaceEdit, NewEmojiEditCallback);
  }
  if (g_neChooseWorkspace > 0) NewEmojiStyleButton(g_neChooseWorkspace, 1, kNeAccent);
  if (g_neConfigure > 0) NewEmojiStyleButton(g_neConfigure, 1, 0xFFFFFFFFu);
  if (g_neRemove > 0) {
    NewEmojiStyleButton(g_neRemove, 3, kNeDanger);
    EU_SetButtonStateColors(g_newEmojiWindow, g_neRemove,
                            0xFFFEE2E2u, 0xFFFCA5A5u, kNeDanger,
                            0xFFFECACAu, 0xFFF87171u, kNeDanger);
    NewEmojiSetFont(g_neRemove, 13, kNeDanger);
  }
  NewEmojiSetFont(g_neReadonly, 14, kNeText);
  NewEmojiSetFont(g_nePreview, 14, kNeAccent);
  NewEmojiSetFont(g_neYolo, 14, 0xFFB45309u);
  NewEmojiSetFont(g_neLaunchCodex, 14, kNeText);
  NewEmojiSelectPermission(kPreview);
  NewEmojiSetStatus(L"请选择工作区后点击“一键配置”。\n\n工具会保留原有 .codex/config.toml 内容，只管理带 LingBuilder 标记的配置段。\n推荐使用“预览”权限；YOLO 只允许 LingBuilder 受控 MCP 工具，不开放任意 Shell。");

  for (const int id : {g_neChooseWorkspace, g_neConfigure, g_neRemove, g_neReadonly, g_nePreview, g_neYolo, g_neLaunchCodex}) {
    if (id > 0) EU_SetElementClickCallback(g_newEmojiWindow, id, NewEmojiClickCallback);
  }
  NE_显示并激活窗口(g_newEmojiWindow);
  const int exitCode = NE_运行消息循环();
  if (g_newEmojiWindow && IsWindow(g_newEmojiWindow)) NE_销毁窗口(g_newEmojiWindow);
  g_newEmojiWindow = nullptr;
  return exitCode;
}

#endif

LRESULT CALLBACK WindowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  switch (message) {
    case WM_CREATE:
      CreateControls(window);
      return 0;
    case WM_SIZE:
      LayoutControls(window);
      return 0;
    case WM_GETMINMAXINFO: {
      auto* limits = reinterpret_cast<MINMAXINFO*>(lParam);
      limits->ptMinTrackSize.x = 760;
      limits->ptMinTrackSize.y = 680;
      return 0;
    }
    case WM_ERASEBKGND:
      return 1;
    case WM_PAINT: {
      PAINTSTRUCT paint{};
      HDC hdc = BeginPaint(window, &paint);
      PaintWindowBackground(window, hdc);
      EndPaint(window, &paint);
      return 0;
    }
    case WM_CTLCOLORSTATIC: {
      HDC hdc = reinterpret_cast<HDC>(wParam);
      HWND control = reinterpret_cast<HWND>(lParam);
      SetBkMode(hdc, TRANSPARENT);
      if (control == g_titleLabel || control == g_subtitleLabel) {
        SetTextColor(hdc, RGB(255, 255, 255));
        return reinterpret_cast<LRESULT>(g_headerBrush);
      }
      if (control == g_workspaceHint || control == g_permissionHint || control == g_runtimeLabel) {
        SetTextColor(hdc, kMutedColor);
        return reinterpret_cast<LRESULT>(control == g_runtimeLabel ? g_backgroundBrush : g_surfaceBrush);
      }
      SetTextColor(hdc, kTextColor);
      return reinterpret_cast<LRESULT>(g_surfaceBrush);
    }
    case WM_CTLCOLOREDIT: {
      HDC hdc = reinterpret_cast<HDC>(wParam);
      HWND control = reinterpret_cast<HWND>(lParam);
      SetTextColor(hdc, kTextColor);
      SetBkColor(hdc, control == g_statusEdit ? kStatusColor : kSurfaceColor);
      return reinterpret_cast<LRESULT>(control == g_statusEdit ? g_statusBrush : g_editBrush);
    }
    case WM_DRAWITEM: {
      auto* item = reinterpret_cast<DRAWITEMSTRUCT*>(lParam);
      if (item && item->CtlType == ODT_BUTTON) {
        DrawModernButton(*item);
        return TRUE;
      }
      break;
    }
    case WM_COMMAND:
      switch (LOWORD(wParam)) {
        case kReadonly:
        case kPreview:
        case kYolo:
          if (HIWORD(wParam) == BN_CLICKED) {
            const int selected = LOWORD(wParam);
            g_selectedPermission = selected;
            CheckDlgButton(window, kReadonly, selected == kReadonly ? BST_CHECKED : BST_UNCHECKED);
            CheckDlgButton(window, kPreview, selected == kPreview ? BST_CHECKED : BST_UNCHECKED);
            CheckDlgButton(window, kYolo, selected == kYolo ? BST_CHECKED : BST_UNCHECKED);
            InvalidateRect(window, nullptr, TRUE);
          }
          return 0;
        case kLaunchCodex:
          if (HIWORD(wParam) == BN_CLICKED) {
            g_launchCodexChecked = !g_launchCodexChecked;
            CheckDlgButton(window, kLaunchCodex, g_launchCodexChecked ? BST_CHECKED : BST_UNCHECKED);
            InvalidateRect(window, nullptr, TRUE);
          }
          return 0;
        case kChooseWorkspace:
          ChooseWorkspace(window);
          return 0;
        case kConfigure:
          HandleConfigure(window);
          return 0;
        case kRemove:
          HandleRemove(window);
          return 0;
        default:
          break;
      }
      break;
    case WM_DESTROY:
      DestroyUiResources();
      PostQuitMessage(0);
      return 0;
    default:
      break;
  }
  return DefWindowProcW(window, message, wParam, lParam);
}

int RunHeadless(const std::vector<std::wstring>& arguments) {
  auto valueAfter = [&arguments](const std::wstring& option) -> std::wstring {
    for (size_t index = 0; index + 1 < arguments.size(); ++index) {
      if (arguments[index] == option) return arguments[index + 1];
    }
    return {};
  };
  const std::wstring workspaceValue = valueAfter(L"--workspace");
  const std::wstring permission = valueAfter(L"--permission").empty() ? L"preview" : valueAfter(L"--permission");
  if (workspaceValue.empty()) return 2;
  if (permission != L"readonly" && permission != L"preview" && permission != L"yolo") return 3;
  try {
    const fs::path workspace = NormalizeWorkspace(workspaceValue);
    if (std::find(arguments.begin(), arguments.end(), L"--remove") != arguments.end()) {
      const ConfigureResult result = RemoveWorkspaceConfiguration(workspace);
      return result.ok ? 0 : 4;
    }
    const bool replace = std::find(arguments.begin(), arguments.end(), L"--force") != arguments.end();
    ConfigureResult result = ConfigureWorkspace(workspace, permission, FindRuntimePaths(), replace);
    if (result.needsConfirmation) return 5;
    return result.ok ? 0 : 4;
  } catch (...) {
    return 4;
  }
}

} // namespace

int APIENTRY wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  int argumentCount = 0;
  LPWSTR* rawArguments = CommandLineToArgvW(GetCommandLineW(), &argumentCount);
  std::vector<std::wstring> arguments;
  if (rawArguments) {
    for (int index = 0; index < argumentCount; ++index) arguments.emplace_back(rawArguments[index]);
    LocalFree(rawArguments);
  }
  if (std::find(arguments.begin(), arguments.end(), L"--headless") != arguments.end()) return RunHeadless(arguments);

#ifdef LINGBUILDER_USE_NEW_EMOJI
  UNREFERENCED_PARAMETER(instance);
  UNREFERENCED_PARAMETER(showCommand);
  EnablePerMonitorDpiAwareness();
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  g_runtime = FindRuntimePaths();
  const int result = RunNewEmojiGui();
  CoUninitialize();
  return result;
#else
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  g_runtime = FindRuntimePaths();
  INITCOMMONCONTROLSEX commonControls{sizeof(INITCOMMONCONTROLSEX), ICC_STANDARD_CLASSES};
  InitCommonControlsEx(&commonControls);

  WNDCLASSEXW windowClass{sizeof(WNDCLASSEXW)};
  windowClass.hInstance = instance;
  windowClass.lpfnWndProc = WindowProcedure;
  windowClass.lpszClassName = kWindowClass;
  windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  windowClass.hbrBackground = nullptr;
  windowClass.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  RegisterClassExW(&windowClass);

  HWND window = CreateWindowExW(WS_EX_APPWINDOW, kWindowClass, L"LingBuilder Codex 一键配置",
                                WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX |
                                    WS_THICKFRAME | WS_MAXIMIZEBOX,
                                CW_USEDEFAULT, CW_USEDEFAULT, 860, 680, nullptr, nullptr, instance, nullptr);
  if (!window) {
    CoUninitialize();
    return 1;
  }
  RECT workArea{};
  SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
  RECT windowRect{};
  GetWindowRect(window, &windowRect);
  const int windowWidth = windowRect.right - windowRect.left;
  const int windowHeight = windowRect.bottom - windowRect.top;
  const int centeredX = static_cast<int>(workArea.left) +
                        std::max(0, static_cast<int>((workArea.right - workArea.left - windowWidth) / 2));
  const int centeredY = static_cast<int>(workArea.top) +
                        std::max(0, static_cast<int>((workArea.bottom - workArea.top - windowHeight) / 2));
  SetWindowPos(window, nullptr, centeredX, centeredY, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
  ShowWindow(window, showCommand == 0 ? SW_SHOWNORMAL : showCommand);
  UpdateWindow(window);
  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
  CoUninitialize();
  return static_cast<int>(message.wParam);
#endif
}
