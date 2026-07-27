import type { LingCppProgram } from '../lingCpp/types';
import { DATA_MEDIA_MODULES } from '../modules/dataMediaModules';
import { NETWORK_LIBRARY_MODULES } from '../modules/networkLibraryModules';
import { PLATFORM_ADVANCED_MODULES } from '../modules/platformAdvancedModules';
import { STANDARD_LIBRARY_MODULES } from '../modules/standardLibraryModules';
import { SYSTEM_LIBRARY_MODULES } from '../modules/systemLibraryModules';
import type { InstalledModule } from '../modules/types';
import { NEW_EMOJI_MODULE_ID } from './newEmojiDesignerAdapter';

export const WIN32_UI_BACKEND_ID = 'win32';
export const NEW_EMOJI_UI_BACKEND_ID = 'new-emoji';
const WIN32_BASIC_MODULE_ID = 'lingbuilder.win32.basic';

const BACKEND_NEUTRAL_BUILTIN_MODULE_IDS = new Set([
  ...STANDARD_LIBRARY_MODULES,
  ...SYSTEM_LIBRARY_MODULES,
  ...NETWORK_LIBRARY_MODULES,
  ...DATA_MEDIA_MODULES,
  ...PLATFORM_ADVANCED_MODULES
].map(module => module.id));

export interface NativeUiBackendCommandCall {
  name: string;
  line: number;
}

export interface NativeUiBackendCommandContext {
  module: InstalledModule;
  commandName: string;
}

/**
 * UI 后端必须通过该契约公开命令能力。以后接入其它 UI 库时注册新实现，
 * 不允许在解析器、React 组件或构建路由中散落后端特判。
 */
export interface NativeUiBackendCommandContract {
  backendId: string;
  displayName: string;
  supportsCommand(context: NativeUiBackendCommandContext): boolean;
  formatUnsupportedDiagnostic(call: NativeUiBackendCommandCall, context: NativeUiBackendCommandContext): string;
}

/**
 * 这些 Win32 基础命令在 new_emoji 主程序模板中有真实实现。
 * 修改模板实现时必须同步更新此契约与回归测试，禁止只补命令名。
 */
export const NEW_EMOJI_WIN32_BASIC_COMMANDS = new Set([
  '信息框',
  '调试输出',
  '结束',
  '到整数',
  '取鼠标水平位置',
  '取鼠标垂直位置',
  '控件_设置文本',
  '控件_设置图片',
  '控件_取文本',
  '控件_设置启用',
  '控件_设置可见',
  '控件_设置勾选',
  '控件_取勾选',
  '控件_设置数值',
  '控件_取数值',
  '控件_设置选择项',
  '控件_取选择项',
  '控件_添加项目',
  '控件_清空项目',
  '窗口_取是否激活',
  '窗口_取是否可见',
  '窗口_取当前状态'
]);

export const WIN32_UI_BACKEND_COMMAND_CONTRACT: NativeUiBackendCommandContract = {
  backendId: WIN32_UI_BACKEND_ID,
  displayName: '普通 Win32',
  supportsCommand: () => true,
  formatUnsupportedDiagnostic: (call, context) => `普通 Win32 后端不支持命令“${context.commandName}”（源码第 ${call.line} 行）。`
};

export const NEW_EMOJI_UI_BACKEND_COMMAND_CONTRACT: NativeUiBackendCommandContract = {
  backendId: NEW_EMOJI_UI_BACKEND_ID,
  displayName: 'new_emoji',
  supportsCommand: ({ module, commandName }) => {
    if (module.manifest.id === NEW_EMOJI_MODULE_ID) return true;
    if (module.manifest.id === WIN32_BASIC_MODULE_ID) return NEW_EMOJI_WIN32_BASIC_COMMANDS.has(commandName);
    if (module.isBuiltin) return BACKEND_NEUTRAL_BUILTIN_MODULE_IDS.has(module.manifest.id);
    // 第三方 v2 模块由 targets.headers/sources/libs 提供独立运行时；模块清单校验负责约束 binding。
    return true;
  },
  formatUnsupportedDiagnostic: (call, { module, commandName }) => (
    `new_emoji 后端不支持命令“${commandName}”（${module.manifest.name}，源码第 ${call.line} 行）；`
    + '该命令依赖普通 Win32 窗口运行时，已在生成 C++ 前阻止构建。请改用 new_emoji 模块对应命令，或把当前窗口切换为 Win32 后端。'
  )
};

const uiBackendContracts = new Map<string, NativeUiBackendCommandContract>();

export function registerNativeUiBackendCommandContract(contract: NativeUiBackendCommandContract): void {
  const backendId = contract.backendId.trim();
  if (!backendId) throw new Error('UI 后端命令契约缺少 backendId。');
  if (uiBackendContracts.has(backendId)) throw new Error(`UI 后端命令契约已注册：${backendId}`);
  uiBackendContracts.set(backendId, contract);
}

export function getNativeUiBackendCommandContract(backendId: string): NativeUiBackendCommandContract | undefined {
  return uiBackendContracts.get(backendId);
}

export function listNativeUiBackendCommandContracts(): NativeUiBackendCommandContract[] {
  return [...uiBackendContracts.values()];
}

export function collectLingCppCommandCalls(program: LingCppProgram, commandNames: Iterable<string>): NativeUiBackendCommandCall[] {
  const known = new Set(commandNames);
  if (known.size === 0 || !program.source.trim()) return [];
  const calls: NativeUiBackendCommandCall[] = [];
  const callPattern = /([\p{L}_][\p{L}\p{N}_]*)\s*[（(]/gu;

  program.source.split(/\r?\n/u).forEach((lineText, index) => {
    const code = stripLingCppStringsAndComment(lineText);
    for (const match of code.matchAll(callPattern)) {
      const name = match[1];
      if (name && known.has(name)) calls.push({ name, line: index + 1 });
    }
  });

  return calls;
}

export function getUiBackendCommandDiagnostics(
  backendId: string,
  program: LingCppProgram,
  enabledModules: InstalledModule[]
): string[] {
  const contract = getNativeUiBackendCommandContract(backendId);
  if (!contract) return [`未注册 UI 后端“${backendId}”的命令契约，已阻止生成可能含未定义符号的 C++。`];
  const bindingOwners = new Map<string, InstalledModule>();
  enabledModules.forEach(module => {
    (module.manifest.bindings?.commands || []).forEach(binding => bindingOwners.set(binding.command, module));
  });
  const calls = collectLingCppCommandCalls(program, bindingOwners.keys());
  const diagnostics = new Map<string, string>();

  calls.forEach(call => {
    const module = bindingOwners.get(call.name);
    if (!module) return;
    const context = { module, commandName: call.name };
    if (contract.supportsCommand(context)) return;
    const key = `${module.manifest.id}:${call.name}`;
    if (!diagnostics.has(key)) diagnostics.set(key, contract.formatUnsupportedDiagnostic(call, context));
  });

  return [...diagnostics.values()];
}

function stripLingCppStringsAndComment(lineText: string): string {
  const trimmed = lineText.trimStart();
  if (trimmed.startsWith('//') || /^注释(?:\s|$)/u.test(trimmed) || trimmed.startsWith('@')) return '';
  let result = '';
  let quote: '"' | '“' | null = null;

  for (let index = 0; index < lineText.length; index += 1) {
    const char = lineText[index]!;
    const next = lineText[index + 1];
    if (!quote && char === '/' && next === '/') break;
    if (!quote && (char === '"' || char === '“')) {
      quote = char;
      result += ' ';
      continue;
    }
    if (quote) {
      const closes = (quote === '"' && char === '"') || (quote === '“' && char === '”');
      if (closes) quote = null;
      result += ' ';
      continue;
    }
    result += char;
  }

  return result;
}

registerNativeUiBackendCommandContract(WIN32_UI_BACKEND_COMMAND_CONTRACT);
registerNativeUiBackendCommandContract(NEW_EMOJI_UI_BACKEND_COMMAND_CONTRACT);
