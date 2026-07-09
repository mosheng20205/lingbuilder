const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const MODULE_ID = 'lingbuilder.new_emoji.ui';
const MODULE_NAME = 'new_emoji 原生界面库';
const DEFAULT_SOURCE = 'T:\\github\\new_emoji';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = __dirname;
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.NEW_EMOJI_ROOT || DEFAULT_SOURCE);
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'new_emoji.lbmod');

  await assertNewEmojiSource(sourceRoot);
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });

  const exports = await parseExports(path.join(sourceRoot, 'src', 'new_emoji.def'));
  const prototypes = await parsePrototypes(path.join(sourceRoot, 'src', 'exports.h'));
  const apiManifest = await readJson(path.join(sourceRoot, 'docs', 'ai', 'api_manifest.full.json'), []);
  const commands = buildCommands(exports, prototypes, apiManifest);

  await writeText(path.join(workRoot, 'lingbuilder.module.json'), JSON.stringify(buildManifest(commands), null, 2) + '\n');
  await writeText(path.join(workRoot, 'include', 'new_emoji_bridge.h'), bridgeHeader());
  await writeText(path.join(workRoot, 'src', 'new_emoji_bridge.cpp'), bridgeSource());
  await writeText(path.join(workRoot, 'docs', 'new_emoji-api.json'), JSON.stringify({
    source: sourceRoot,
    generatedAt: new Date().toISOString(),
    exportCount: exports.length,
    commands
  }, null, 2) + '\n');
  await writeText(path.join(workRoot, 'README.md'), moduleReadme(exports.length));

  await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.dll'), path.join(workRoot, 'bin', 'Win32', 'new_emoji.dll'));
  await copyFile(path.join(sourceRoot, 'bin', 'Win32', 'Release', 'new_emoji.lib'), path.join(workRoot, 'lib', 'Win32', 'new_emoji.lib'));
  await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.dll'), path.join(workRoot, 'bin', 'x64', 'new_emoji.dll'));
  await copyFile(path.join(sourceRoot, 'bin', 'x64', 'Release', 'new_emoji.lib'), path.join(workRoot, 'lib', 'x64', 'new_emoji.lib'));
  await copyFile(path.join(sourceRoot, 'LICENSE'), path.join(workRoot, 'LICENSE'));

  await fs.mkdir(packageDir, { recursive: true });
  await fs.rm(packagePath, { force: true });
  await compressArchive(workRoot, packagePath);

  if (args.install) {
    const installPath = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
    await fs.rm(installPath, { recursive: true, force: true });
    await copyDirectory(workRoot, installPath);
    await enableModule(repoRoot);
    console.log(`Installed ${MODULE_ID} to ${installPath}`);
  }

  console.log(`Generated ${MODULE_NAME}`);
  console.log(`Module directory: ${workRoot}`);
  console.log(`Package: ${packagePath}`);
  console.log(`Command count: ${commands.length}`);
}

function parseArgs(args) {
  const result = { install: false, source: '' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--install') result.install = true;
    if (arg === '--source') result.source = args[index + 1] || '';
  }
  return result;
}

async function assertNewEmojiSource(sourceRoot) {
  const required = [
    'src/new_emoji.def',
    'src/exports.h',
    'docs/ai/api_manifest.full.json',
    'bin/Win32/Release/new_emoji.dll',
    'bin/Win32/Release/new_emoji.lib',
    'bin/x64/Release/new_emoji.dll',
    'bin/x64/Release/new_emoji.lib'
  ];
  for (const relativePath of required) {
    try {
      await fs.stat(path.join(sourceRoot, relativePath));
    } catch {
      throw new Error(`new_emoji source is missing ${relativePath}: ${sourceRoot}`);
    }
  }
}

async function parseExports(defPath) {
  const exports = [];
  let inExports = false;
  for (const rawLine of (await fs.readFile(defPath, 'utf8')).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.toUpperCase() === 'EXPORTS') {
      inExports = true;
      continue;
    }
    if (inExports) exports.push(line.split(/\s+/u)[0]);
  }
  return exports;
}

async function parsePrototypes(exportsHeaderPath) {
  const text = await fs.readFile(exportsHeaderPath, 'utf8');
  const pattern = /([\w\s\*]+?)\s+__stdcall\s+(EU_\w+)\s*\((.*?)\);/gsu;
  const prototypes = new Map();
  let match;
  while ((match = pattern.exec(text))) {
    const returnType = normalizeSpace(match[1]);
    const name = match[2];
    const params = splitParams(match[3]).map(parseParam);
    prototypes.set(name, { returnType, params });
  }
  return prototypes;
}

function splitParams(params) {
  const result = [];
  let current = '';
  let depth = 0;
  for (const char of params) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      const item = normalizeSpace(current);
      if (item && item !== 'void') result.push(item);
      current = '';
      continue;
    }
    current += char;
  }
  const tail = normalizeSpace(current);
  if (tail && tail !== 'void') result.push(tail);
  return result;
}

function parseParam(param) {
  const fnPtr = param.match(/(.+?)\(\*\s*(\w+)\s*\)\s*\((.*)\)$/u);
  if (fnPtr) return { type: 'callback', name: fnPtr[2] };
  const match = param.match(/(.+?)\s*([A-Za-z_]\w*)$/u);
  if (!match) return { type: normalizeSpace(param), name: 'value' };
  return { type: normalizeSpace(match[1]), name: match[2] };
}

function buildCommands(exports, prototypes, apiManifest) {
  const commandNamesByExport = new Map();
  for (const item of apiManifest) {
    const entry = item?.bindings?.e_language?.entry || item?.create_export;
    const commandName = item?.bindings?.e_language?.command_name;
    if (entry && commandName && !commandNamesByExport.has(entry)) {
      commandNamesByExport.set(entry, commandName);
    }
  }

  const commands = [];
  const seen = new Set();
  for (const command of bridgeCommands()) {
    commands.push(command);
    seen.add(command.name);
  }

  for (const exportName of exports) {
    const prototype = prototypes.get(exportName) || { returnType: 'int', params: [] };
    let name = commandNamesByExport.get(exportName) || `NE_${exportName}`;
    if (seen.has(name)) name = `NE_${exportName}`;
    seen.add(name);
    commands.push({
      name,
      signature: `${name}(${prototype.params.map(param => param.name).join(', ')})`,
      description: `${MODULE_NAME} 底层导出 ${exportName}。文本参数使用 UTF-8 字节指针和长度，高级调用前请确认参数类型。`,
      insertText: `${name}(${prototype.params.map((_, index) => `$${index + 1}`).join(', ')})`,
      returnType: mapReturnType(prototype.returnType),
      runtimeName: exportName
    });
  }

  return commands;
}

function bridgeCommands() {
  return [
    ['NE_创建窗口', 'NE_创建窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 原生窗口。', '窗口句柄'],
    ['NE_创建深色窗口', 'NE_创建深色窗口(标题, X, Y, 宽度, 高度)', '创建 new_emoji 深色原生窗口。', '窗口句柄'],
    ['NE_显示窗口', 'NE_显示窗口(窗口句柄, 是否显示)', '显示或隐藏 new_emoji 窗口。', '空'],
    ['NE_运行消息循环', 'NE_运行消息循环()', '运行 new_emoji Win32 消息循环。', '整数型'],
    ['NE_销毁窗口', 'NE_销毁窗口(窗口句柄)', '销毁 new_emoji 窗口。', '空'],
    ['NE_创建容器', 'NE_创建容器(窗口句柄, 父元素ID, X, Y, 宽度, 高度)', '创建 new_emoji 容器。', '整数型'],
    ['NE_创建文本', 'NE_创建文本(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 文本元素。', '整数型'],
    ['NE_创建按钮', 'NE_创建按钮(窗口句柄, 父元素ID, 表情, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 按钮。', '整数型'],
    ['NE_设置窗口标题', 'NE_设置窗口标题(窗口句柄, 标题)', '设置 new_emoji 窗口标题。', '空']
  ].map(([name, signature, description, returnType]) => ({
    name,
    signature,
    description,
    insertText: `${name}($1)`,
    returnType,
    runtimeName: name
  }));
}

function buildManifest(commands) {
  const commandContributions = commands.map(({ runtimeName, ...command }) => command);
  const bindings = commands.map(command => ({
    command: command.name,
    runtimeName: command.runtimeName || command.name,
    parameters: parseBindingParameters(command.signature),
    returnType: mapBindingReturnType(command.returnType),
    encoding: command.name.startsWith('NE_EU_') ? 'raw' : 'wide',
    example: command.insertText || command.signature
  }));
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: MODULE_NAME,
    version: '1.0.0',
    category: '界面',
    description: '集成 new_emoji Windows 原生 Direct2D/DirectWrite UI DLL，提供中文/emoji 友好的原生控件能力。',
    author: 'new_emoji contributors / LingBuilder',
    license: 'MIT',
    tags: ['界面', 'Direct2D', 'DirectWrite', 'emoji', 'Windows', '原生控件'],
    contributes: {
      commands: commandContributions,
      types: [
        { name: 'NE窗口句柄', description: 'new_emoji 原生窗口句柄。', cppType: 'HWND' },
        { name: 'NE元素ID', description: 'new_emoji Element 元素编号。', cppType: 'int' }
      ],
      snippets: [
        {
          label: 'new_emoji 最小窗口',
          insertText: [
            'NE_创建窗口("new_emoji 示例", 120, 120, 860, 560)',
            'NE_运行消息循环()'
          ].join('\n'),
          description: '插入 new_emoji 最小窗口调用。'
        }
      ],
      docs: [
        { title: 'new_emoji API 索引', path: 'docs/new_emoji-api.json' },
        { title: 'new_emoji 模块说明', path: 'README.md' }
      ]
    },
    targets: [
      {
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/new_emoji_bridge.h'],
        sources: ['src/new_emoji_bridge.cpp'],
        libs: ['lib/Win32/new_emoji.lib'],
        runtimeFiles: ['bin/Win32/new_emoji.dll'],
        defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
      },
      {
        id: 'windows-msvc-x64',
        platform: 'windows',
        arch: 'x64',
        toolchain: 'msvc',
        includeDirs: ['include'],
        headers: ['include/new_emoji_bridge.h'],
        sources: ['src/new_emoji_bridge.cpp'],
        libs: ['lib/x64/new_emoji.lib'],
        runtimeFiles: ['bin/x64/new_emoji.dll'],
        defines: ['LINGBUILDER_NEW_EMOJI_MODULE']
      }
    ],
    bindings: { commands: bindings },
    publish: {
      repository: 'T:/github/new_emoji'
    }
  };
}

function parseBindingParameters(signature) {
  const match = signature.match(/^[^(（]+[（(](.*)[）)]/u);
  if (!match || !match[1].trim()) return [];
  return match[1].split(/[，,]/u).map(part => part.trim()).filter(Boolean).map(name => ({
    name,
    type: inferBindingParameterType(name)
  }));
}

function inferBindingParameterType(name) {
  if (/标题|文本|表情|内容/u.test(name)) return 'wideString';
  if (/句柄|hwnd|HWND/u.test(name)) return 'handle';
  if (/是否|visible/u.test(name)) return 'bool';
  if (/bytes|len|指针|callback/u.test(name)) return 'raw';
  return 'int';
}

function mapBindingReturnType(returnType) {
  if (returnType === '空') return 'void';
  if (returnType === '窗口句柄') return 'handle';
  if (returnType === '逻辑型') return 'bool';
  if (returnType === '小数型') return 'double';
  return 'int';
}

function bridgeHeader() {
  return `#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

HWND NE_创建窗口(const wchar_t* title, int x, int y, int width, int height);
HWND NE_创建深色窗口(const wchar_t* title, int x, int y, int width, int height);
void NE_显示窗口(HWND hwnd, int visible);
int NE_运行消息循环();
void NE_销毁窗口(HWND hwnd);
int NE_创建容器(HWND hwnd, int parentId, int x, int y, int width, int height);
int NE_创建文本(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height);
int NE_创建按钮(HWND hwnd, int parentId, const wchar_t* emoji, const wchar_t* text, int x, int y, int width, int height);
void NE_设置窗口标题(HWND hwnd, const wchar_t* title);
`;
}

function bridgeSource() {
  return `#include "new_emoji_bridge.h"
#include <memory>
#include <string>
#include <vector>

using NEColor = unsigned int;

__declspec(dllimport) HWND __stdcall EU_CreateWindow(const unsigned char* title_bytes, int title_len, int x, int y, int w, int h, NEColor titlebar_color);
__declspec(dllimport) HWND __stdcall EU_CreateWindowDark(const unsigned char* title_bytes, int title_len, int x, int y, int w, int h, NEColor titlebar_color);
__declspec(dllimport) void __stdcall EU_ShowWindow(HWND hwnd, int visible);
__declspec(dllimport) int __stdcall EU_RunMessageLoop();
__declspec(dllimport) void __stdcall EU_DestroyWindow(HWND hwnd);
__declspec(dllimport) int __stdcall EU_CreateContainer(HWND hwnd, int parent_id, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateText(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateButton(HWND hwnd, int parent_id, const unsigned char* emoji_bytes, int emoji_len, const unsigned char* text_bytes, int text_len, int x, int y, int w, int h);
__declspec(dllimport) void __stdcall EU_SetWindowTitle(HWND hwnd, const unsigned char* bytes, int len);

static std::vector<std::unique_ptr<std::string>>& NE_Utf8Pool() {
    static auto* pool = new std::vector<std::unique_ptr<std::string>>();
    return *pool;
}

static const std::string& NE_KeepUtf8(const wchar_t* text) {
    auto& pool = NE_Utf8Pool();
    if (!text) {
        pool.push_back(std::make_unique<std::string>());
        return *pool.back();
    }
    int needed = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
    if (needed <= 1) {
        pool.push_back(std::make_unique<std::string>());
        return *pool.back();
    }
    std::string bytes(static_cast<size_t>(needed), '\\0');
    WideCharToMultiByte(CP_UTF8, 0, text, -1, bytes.data(), needed, nullptr, nullptr);
    bytes.pop_back();
    pool.push_back(std::make_unique<std::string>(std::move(bytes)));
    return *pool.back();
}

HWND NE_创建窗口(const wchar_t* title, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    HWND hwnd = EU_CreateWindow(reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), x, y, width, height, 0xFF202020);
    if (hwnd) EU_ShowWindow(hwnd, 1);
    return hwnd;
}

HWND NE_创建深色窗口(const wchar_t* title, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    HWND hwnd = EU_CreateWindowDark(reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), x, y, width, height, 0xFF202020);
    if (hwnd) EU_ShowWindow(hwnd, 1);
    return hwnd;
}

void NE_显示窗口(HWND hwnd, int visible) {
    EU_ShowWindow(hwnd, visible);
}

int NE_运行消息循环() {
    return EU_RunMessageLoop();
}

void NE_销毁窗口(HWND hwnd) {
    EU_DestroyWindow(hwnd);
}

int NE_创建容器(HWND hwnd, int parentId, int x, int y, int width, int height) {
    return EU_CreateContainer(hwnd, parentId, x, y, width, height);
}

int NE_创建文本(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateText(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), x, y, width, height);
}

int NE_创建按钮(HWND hwnd, int parentId, const wchar_t* emoji, const wchar_t* text, int x, int y, int width, int height) {
    const std::string& emojiBytes = NE_KeepUtf8(emoji);
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateButton(hwnd, parentId, reinterpret_cast<const unsigned char*>(emojiBytes.c_str()), static_cast<int>(emojiBytes.size()), reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), x, y, width, height);
}

void NE_设置窗口标题(HWND hwnd, const wchar_t* title) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    EU_SetWindowTitle(hwnd, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()));
}
`;
}

function moduleReadme(exportCount) {
  return `# new_emoji 原生界面库模块

该模块由 LingBuilder 脚本从 new_emoji 工程生成，打包 Win32/x64 DLL 与导入库。

- 模块 ID：${MODULE_ID}
- 导出 API 数：${exportCount}
- 默认 F5 预览平台：Win32
- 当前 .lib 导入库需要 MSVC/Visual Studio Build Tools 链接

推荐在 .lcpp 中优先使用 NE_ 前缀的中文桥接命令；NE_EU_* 命令是底层高级入口，参数仍遵循 new_emoji DLL 的 UTF-8 字节指针和长度规则。
`;
}

function mapReturnType(cType) {
  if (cType === 'void') return '空';
  if (cType === 'HWND') return '窗口句柄';
  if (cType === 'int') return '整数型';
  if (cType === 'Color' || cType === 'unsigned int') return '整数型';
  if (cType === 'float') return '小数型';
  return '整数型';
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) await copyFile(sourcePath, targetPath);
  }
}

async function compressArchive(sourceDir, targetPath) {
  const tempZipPath = `${targetPath}.zip`;
  await fs.rm(tempZipPath, { force: true });
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path ${quotePs(path.join(sourceDir, '*'))} -DestinationPath ${quotePs(tempZipPath)} -Force`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await fs.rename(tempZipPath, targetPath);
}

async function enableModule(repoRoot) {
  const projectModulesPath = path.join(repoRoot, '.lingbuilder', 'project-modules.json');
  const fallback = {
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic'],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0' }
  };
  const refs = await readJson(projectModulesPath, fallback);
  if (!refs.enabledModuleIds.includes('lingbuilder.win32.basic')) refs.enabledModuleIds.unshift('lingbuilder.win32.basic');
  if (!refs.enabledModuleIds.includes(MODULE_ID)) refs.enabledModuleIds.push(MODULE_ID);
  refs.pinnedVersions['lingbuilder.win32.basic'] ||= '1.0.0';
  refs.pinnedVersions[MODULE_ID] = '1.0.0';
  await writeText(projectModulesPath, JSON.stringify(refs, null, 2) + '\n');
}

function quotePs(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
