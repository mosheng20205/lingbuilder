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
    console.log(`Installed ${MODULE_ID} to ${installPath}`);
    console.log('Project module references were left unchanged.');
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
    ['NE_创建编辑框', 'NE_创建编辑框(窗口句柄, 父元素ID, 文本, X, Y, 宽度, 高度)', '创建 new_emoji 编辑框。', '整数型'],
    ['NE_创建复选框', 'NE_创建复选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)', '创建 new_emoji 复选框。', '整数型'],
    ['NE_创建单选框', 'NE_创建单选框(窗口句柄, 父元素ID, 文本, 是否选中, X, Y, 宽度, 高度)', '创建 new_emoji 单选框。', '整数型'],
    ['NE_创建列表框', 'NE_创建列表框(窗口句柄, 父元素ID, 标题, 项目文本, 默认选中项, X, Y, 宽度, 高度)', '创建 new_emoji 列表框，项目文本使用 | 分隔。', '整数型'],
    ['NE_创建图片', 'NE_创建图片(窗口句柄, 父元素ID, 图片源, 替代文本, 填充方式, X, Y, 宽度, 高度)', '创建 new_emoji 图片，填充方式 0-4 依次为 contain、cover、fill、none、scale-down。', '整数型'],
    ['NE_创建进度条', 'NE_创建进度条(窗口句柄, 父元素ID, 文本, 进度值, X, Y, 宽度, 高度)', '创建 new_emoji 进度条。', '整数型'],
    ['NE_创建上传', 'NE_创建上传(窗口句柄, 父元素ID, 标题, 提示, 初始文件, X, Y, 宽度, 高度)', '创建 new_emoji 文件上传组件。', '整数型'],
    ['NE_设置上传选项', 'NE_设置上传选项(窗口句柄, 元素ID, 允许多选, 自动上传, 样式, 显示文件列表, 显示提示, 显示操作, 允许拖拽, 文件数量上限, 单文件上限KB, 允许文件类型)', '设置上传组件的选择、显示、拖拽和文件限制。', '空'],
    ['NE_打开上传文件选择', 'NE_打开上传文件选择(窗口句柄, 元素ID)', '打开上传组件的系统文件选择对话框。', '整数型'],
    ['NE_开始上传', 'NE_开始上传(窗口句柄, 元素ID, 文件索引)', '触发上传组件指定文件的上传操作。', '整数型'],
    ['NE_清空上传文件', 'NE_清空上传文件(窗口句柄, 元素ID)', '清空上传组件文件列表。', '空'],
    ['NE_取上传文件数量', 'NE_取上传文件数量(窗口句柄, 元素ID)', '返回上传组件当前文件数量。', '整数型'],
    ['NE_取最近上传选择文件', 'NE_取最近上传选择文件()', '在上传事件中返回最近选择或拖入的文件路径，多个路径以 | 分隔。', '文本型'],
    ['NE_取最近上传动作', 'NE_取最近上传动作()', '在上传操作事件中返回动作编号。', '整数型'],
    ['NE_取最近上传文件索引', 'NE_取最近上传文件索引()', '在上传操作事件中返回文件索引。', '整数型'],
    ['NE_取最近上传进度值', 'NE_取最近上传进度值()', '在上传操作事件中返回进度或动作附加值。', '整数型'],
    ['NE_设置窗口标题', 'NE_设置窗口标题(窗口句柄, 标题)', '设置 new_emoji 窗口标题。', '空']
  ].map(([name, signature, description, returnType]) => ({
    name,
    signature,
    description,
    insertText: buildInsertTextFromSignature(name, signature),
    returnType,
    runtimeName: name
  }));
}

function buildInsertTextFromSignature(name, signature) {
  const parameters = parseBindingParameters(signature);
  return `${name}(${parameters.map((_, index) => `$${index + 1}`).join(', ')})`;
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
      designerControls: newEmojiDesignerControls(),
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

function newEmojiDesignerControls() {
  const common = (type, label, nativeAdapter, content, width, height, extra = {}) => ({
    type,
    label,
    category: 'new_emoji 原生控件',
    icon: type,
    nativeAdapter,
    defaultProps: { content, width, height, background: 'transparent', foreground: '#F8FAFC' },
    ...extra
  });
  const uploadProperties = dropEnabled => [
    { key: 'tip', label: '提示文字', type: 'text', defaultValue: dropEnabled ? '将文件拖到此处，或点击选择文件' : '支持点击选择文件' },
    { key: 'triggerText', label: '选择按钮文字', type: 'text', defaultValue: '选择文件' },
    { key: 'submitText', label: '上传按钮文字', type: 'text', defaultValue: '开始上传' },
    { key: 'initialFiles', label: '初始文件', type: 'stringList', defaultValue: [] },
    { key: 'multiple', label: '允许多选', type: 'boolean', defaultValue: true },
    { key: 'autoUpload', label: '自动上传', type: 'boolean', defaultValue: false },
    { key: 'styleMode', label: '上传样式', type: 'enum', defaultValue: dropEnabled ? '5' : '0', options: ['文件列表', '头像', '图片卡片', '自定义卡片', '图片列表', '拖拽区域', '手动上传'].map((label, value) => ({ value: String(value), label })) },
    { key: 'showFileList', label: '显示文件列表', type: 'boolean', defaultValue: true },
    { key: 'showTip', label: '显示提示', type: 'boolean', defaultValue: true },
    { key: 'showActions', label: '显示操作按钮', type: 'boolean', defaultValue: true },
    { key: 'dropEnabled', label: '允许拖拽文件', type: 'boolean', defaultValue: dropEnabled },
    { key: 'limit', label: '文件数量上限', type: 'number', defaultValue: 0, min: 0, max: 1000 },
    { key: 'maxSizeKb', label: '单文件上限 KB', type: 'number', defaultValue: 0, min: 0 },
    { key: 'accept', label: '允许文件类型', type: 'text', defaultValue: '*.*' }
  ];
  const uploadEvents = [
    { name: 'FilesSelected', label: '文件已选择', handlerPattern: '_{controlName}_文件已选择' },
    { name: 'UploadAction', label: '上传操作', handlerPattern: '_{controlName}_上传操作' }
  ];
  return [
    common('Button', 'new_emoji 按钮', 'new-emoji-button', '新按钮', 120, 36, { events: [{ name: 'Click', label: '被单击', handlerPattern: '_{controlName}_被单击' }] }),
    common('TextBox', 'new_emoji 编辑框', 'new-emoji-input', '请输入内容…', 180, 36),
    common('Label', 'new_emoji 文本', 'new-emoji-text', '新文本标签', 180, 32),
    common('CheckBox', 'new_emoji 复选框', 'new-emoji-checkbox', '复选选项', 150, 28),
    common('RadioButton', 'new_emoji 单选框', 'new-emoji-radio', '单选选项', 150, 28),
    common('ListBox', 'new_emoji 列表框', 'new-emoji-listbox', '', 200, 150),
    common('Image', 'new_emoji 图片', 'new-emoji-image', '图片', 220, 180),
    common('ProgressBar', 'new_emoji 进度条', 'new-emoji-progress', '50', 300, 22),
    common('Grid', 'new_emoji 容器', 'new-emoji-container', '', 360, 220, { isContainer: true }),
    common('Upload', 'new_emoji 上传组件', 'new-emoji-upload', '文件上传', 360, 180, { properties: uploadProperties(false), events: uploadEvents }),
    common('DragUpload', 'new_emoji 拖拽上传组件', 'new-emoji-drag-upload', '拖拽文件到此处', 400, 220, { properties: uploadProperties(true), events: uploadEvents })
  ];
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
  if (/标题|文本|表情|内容|图片源|项目|^提示$|初始文件|文件类型/u.test(name)) return 'wideString';
  if (/句柄|hwnd|HWND/u.test(name)) return 'handle';
  if (/是否|允许|自动|显示|visible/u.test(name)) return 'bool';
  if (/bytes|len|指针|callback/u.test(name)) return 'raw';
  return 'int';
}

function mapBindingReturnType(returnType) {
  if (returnType === '空') return 'void';
  if (returnType === '窗口句柄') return 'handle';
  if (returnType === '文本型') return 'wideString';
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
int NE_创建编辑框(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height);
int NE_创建复选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height);
int NE_创建单选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height);
int NE_创建列表框(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* items, int selectedIndex, int x, int y, int width, int height);
int NE_创建图片(HWND hwnd, int parentId, const wchar_t* source, const wchar_t* alt, int fit, int x, int y, int width, int height);
int NE_创建进度条(HWND hwnd, int parentId, const wchar_t* text, int percentage, int x, int y, int width, int height);
int NE_创建上传(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* tip, const wchar_t* files, int x, int y, int width, int height);
void NE_设置上传选项(HWND hwnd, int elementId, int multiple, int autoUpload, int styleMode, int showFileList, int showTip, int showActions, int dropEnabled, int limit, int maxSizeKb, const wchar_t* accept);
int NE_打开上传文件选择(HWND hwnd, int elementId);
int NE_开始上传(HWND hwnd, int elementId, int fileIndex);
void NE_清空上传文件(HWND hwnd, int elementId);
int NE_取上传文件数量(HWND hwnd, int elementId);
using NE上传选择回调 = void (__stdcall *)(int elementId, const unsigned char* utf8, int length);
using NE上传操作回调 = void (__stdcall *)(int elementId, int action, int fileIndex, int value);
void NE_设置上传事件(HWND hwnd, int elementId, NE上传选择回调 selectCallback, NE上传操作回调 actionCallback);
const wchar_t* NE_取最近上传选择文件();
int NE_取最近上传动作();
int NE_取最近上传文件索引();
int NE_取最近上传进度值();
void NE_设置元素状态(HWND hwnd, int elementId, int visible, int enabled, unsigned int background, unsigned int foreground);
void NE_设置元素字体(HWND hwnd, int elementId, const wchar_t* fontFamily, int fontSize);
void NE_设置窗口标题(HWND hwnd, const wchar_t* title);
`;
}

function bridgeSource() {
  return `#include "new_emoji_bridge.h"
#include <memory>
#include <string>
#include <unordered_map>
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
__declspec(dllimport) int __stdcall EU_CreateEditBox(HWND hwnd, int parent_id, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateCheckbox(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int checked, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateRadio(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int checked, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateListBox(HWND hwnd, int parent_id, const unsigned char* title_bytes, int title_len, const unsigned char* items_bytes, int items_len, int x, int y, int w, int h);
__declspec(dllimport) void __stdcall EU_SetListBoxSelectedIndex(HWND hwnd, int element_id, int index);
__declspec(dllimport) int __stdcall EU_CreateImage(HWND hwnd, int parent_id, const unsigned char* src_bytes, int src_len, const unsigned char* alt_bytes, int alt_len, int fit, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateProgress(HWND hwnd, int parent_id, const unsigned char* text_bytes, int text_len, int percentage, int status, int x, int y, int w, int h);
__declspec(dllimport) int __stdcall EU_CreateUpload(HWND hwnd, int parent_id, const unsigned char* title_bytes, int title_len, const unsigned char* tip_bytes, int tip_len, const unsigned char* files_bytes, int files_len, int x, int y, int w, int h);
__declspec(dllimport) void __stdcall EU_SetUploadOptions(HWND hwnd, int element_id, int multiple, int auto_upload);
__declspec(dllimport) void __stdcall EU_SetUploadStyle(HWND hwnd, int element_id, int style_mode, int show_file_list, int show_tip, int show_actions, int drop_enabled);
__declspec(dllimport) void __stdcall EU_SetUploadConstraints(HWND hwnd, int element_id, int limit, int max_size_kb, const unsigned char* accept_bytes, int accept_len);
__declspec(dllimport) int __stdcall EU_OpenUploadFileDialog(HWND hwnd, int element_id);
__declspec(dllimport) int __stdcall EU_StartUpload(HWND hwnd, int element_id, int file_index);
__declspec(dllimport) void __stdcall EU_ClearUploadFiles(HWND hwnd, int element_id);
__declspec(dllimport) int __stdcall EU_GetUploadFileCount(HWND hwnd, int element_id);
using NEElementTextCallback = void (__stdcall *)(int, const unsigned char*, int);
using NEElementValueCallback = void (__stdcall *)(int, int, int, int);
__declspec(dllimport) void __stdcall EU_SetUploadSelectCallback(HWND hwnd, int element_id, NEElementTextCallback cb);
__declspec(dllimport) void __stdcall EU_SetUploadActionCallback(HWND hwnd, int element_id, NEElementValueCallback cb);
__declspec(dllimport) void __stdcall EU_SetElementText(HWND hwnd, int element_id, const unsigned char* bytes, int len);
__declspec(dllimport) void __stdcall EU_SetElementVisible(HWND hwnd, int element_id, int visible);
__declspec(dllimport) void __stdcall EU_SetElementEnabled(HWND hwnd, int element_id, int enabled);
__declspec(dllimport) void __stdcall EU_SetElementColor(HWND hwnd, int element_id, NEColor background, NEColor foreground);
__declspec(dllimport) void __stdcall EU_SetElementFont(HWND hwnd, int element_id, const unsigned char* font_bytes, int font_len, int size);
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

struct NEUploadCallbacks { NE上传选择回调 select = nullptr; NE上传操作回调 action = nullptr; };
static std::unordered_map<int, NEUploadCallbacks> g_neUploadCallbacks;
static std::wstring g_neLastUploadFiles;
static int g_neLastUploadAction = 0;
static int g_neLastUploadIndex = -1;
static int g_neLastUploadValue = 0;

static std::wstring NE_FromUtf8(const unsigned char* bytes, int length) {
    if (!bytes || length <= 0) return {};
    int needed = MultiByteToWideChar(CP_UTF8, 0, reinterpret_cast<const char*>(bytes), length, nullptr, 0);
    if (needed <= 0) return {};
    std::wstring result(static_cast<size_t>(needed), L'\\0');
    MultiByteToWideChar(CP_UTF8, 0, reinterpret_cast<const char*>(bytes), length, result.data(), needed);
    return result;
}

static void __stdcall NE_UploadSelectDispatch(int elementId, const unsigned char* utf8, int length) {
    g_neLastUploadFiles = NE_FromUtf8(utf8, length);
    auto found = g_neUploadCallbacks.find(elementId);
    if (found != g_neUploadCallbacks.end() && found->second.select) found->second.select(elementId, utf8, length);
}

static void __stdcall NE_UploadActionDispatch(int elementId, int action, int fileIndex, int value) {
    g_neLastUploadAction = action;
    g_neLastUploadIndex = fileIndex;
    g_neLastUploadValue = value;
    auto found = g_neUploadCallbacks.find(elementId);
    if (found != g_neUploadCallbacks.end() && found->second.action) found->second.action(elementId, action, fileIndex, value);
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

int NE_创建编辑框(HWND hwnd, int parentId, const wchar_t* text, int x, int y, int width, int height) {
    int elementId = EU_CreateEditBox(hwnd, parentId, x, y, width, height);
    const std::string& textBytes = NE_KeepUtf8(text);
    if (elementId > 0 && !textBytes.empty()) EU_SetElementText(hwnd, elementId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()));
    return elementId;
}

int NE_创建复选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateCheckbox(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), checked, x, y, width, height);
}

int NE_创建单选框(HWND hwnd, int parentId, const wchar_t* text, int checked, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateRadio(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), checked, x, y, width, height);
}

int NE_创建列表框(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* items, int selectedIndex, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    const std::string& itemBytes = NE_KeepUtf8(items);
    int elementId = EU_CreateListBox(hwnd, parentId, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), reinterpret_cast<const unsigned char*>(itemBytes.c_str()), static_cast<int>(itemBytes.size()), x, y, width, height);
    if (elementId > 0 && selectedIndex >= 0) EU_SetListBoxSelectedIndex(hwnd, elementId, selectedIndex);
    return elementId;
}

int NE_创建图片(HWND hwnd, int parentId, const wchar_t* source, const wchar_t* alt, int fit, int x, int y, int width, int height) {
    const std::string& sourceBytes = NE_KeepUtf8(source);
    const std::string& altBytes = NE_KeepUtf8(alt);
    return EU_CreateImage(hwnd, parentId, reinterpret_cast<const unsigned char*>(sourceBytes.c_str()), static_cast<int>(sourceBytes.size()), reinterpret_cast<const unsigned char*>(altBytes.c_str()), static_cast<int>(altBytes.size()), fit, x, y, width, height);
}

int NE_创建进度条(HWND hwnd, int parentId, const wchar_t* text, int percentage, int x, int y, int width, int height) {
    const std::string& textBytes = NE_KeepUtf8(text);
    return EU_CreateProgress(hwnd, parentId, reinterpret_cast<const unsigned char*>(textBytes.c_str()), static_cast<int>(textBytes.size()), percentage, 0, x, y, width, height);
}

int NE_创建上传(HWND hwnd, int parentId, const wchar_t* title, const wchar_t* tip, const wchar_t* files, int x, int y, int width, int height) {
    const std::string& titleBytes = NE_KeepUtf8(title);
    const std::string& tipBytes = NE_KeepUtf8(tip);
    const std::string& fileBytes = NE_KeepUtf8(files);
    return EU_CreateUpload(hwnd, parentId, reinterpret_cast<const unsigned char*>(titleBytes.c_str()), static_cast<int>(titleBytes.size()), reinterpret_cast<const unsigned char*>(tipBytes.c_str()), static_cast<int>(tipBytes.size()), reinterpret_cast<const unsigned char*>(fileBytes.c_str()), static_cast<int>(fileBytes.size()), x, y, width, height);
}

void NE_设置上传选项(HWND hwnd, int elementId, int multiple, int autoUpload, int styleMode, int showFileList, int showTip, int showActions, int dropEnabled, int limit, int maxSizeKb, const wchar_t* accept) {
    if (elementId <= 0) return;
    const std::string& acceptBytes = NE_KeepUtf8(accept);
    EU_SetUploadOptions(hwnd, elementId, multiple, autoUpload);
    EU_SetUploadStyle(hwnd, elementId, styleMode, showFileList, showTip, showActions, dropEnabled);
    EU_SetUploadConstraints(hwnd, elementId, limit, maxSizeKb, reinterpret_cast<const unsigned char*>(acceptBytes.c_str()), static_cast<int>(acceptBytes.size()));
}

int NE_打开上传文件选择(HWND hwnd, int elementId) { return EU_OpenUploadFileDialog(hwnd, elementId); }
int NE_开始上传(HWND hwnd, int elementId, int fileIndex) { return EU_StartUpload(hwnd, elementId, fileIndex); }
void NE_清空上传文件(HWND hwnd, int elementId) { EU_ClearUploadFiles(hwnd, elementId); }
int NE_取上传文件数量(HWND hwnd, int elementId) { return EU_GetUploadFileCount(hwnd, elementId); }

void NE_设置上传事件(HWND hwnd, int elementId, NE上传选择回调 selectCallback, NE上传操作回调 actionCallback) {
    if (elementId <= 0) return;
    g_neUploadCallbacks[elementId] = { selectCallback, actionCallback };
    EU_SetUploadSelectCallback(hwnd, elementId, NE_UploadSelectDispatch);
    EU_SetUploadActionCallback(hwnd, elementId, NE_UploadActionDispatch);
}

const wchar_t* NE_取最近上传选择文件() { return g_neLastUploadFiles.c_str(); }
int NE_取最近上传动作() { return g_neLastUploadAction; }
int NE_取最近上传文件索引() { return g_neLastUploadIndex; }
int NE_取最近上传进度值() { return g_neLastUploadValue; }

void NE_设置元素状态(HWND hwnd, int elementId, int visible, int enabled, unsigned int background, unsigned int foreground) {
    if (elementId <= 0) return;
    EU_SetElementVisible(hwnd, elementId, visible);
    EU_SetElementEnabled(hwnd, elementId, enabled);
    EU_SetElementColor(hwnd, elementId, background, foreground);
}

void NE_设置元素字体(HWND hwnd, int elementId, const wchar_t* fontFamily, int fontSize) {
    if (!hwnd || elementId <= 0) return;
    const std::string& fontBytes = NE_KeepUtf8(fontFamily && fontFamily[0] ? fontFamily : L"Microsoft YaHei UI");
    EU_SetElementFont(hwnd, elementId, reinterpret_cast<const unsigned char*>(fontBytes.c_str()), static_cast<int>(fontBytes.size()), fontSize > 0 ? fontSize : 12);
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

function quotePs(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
