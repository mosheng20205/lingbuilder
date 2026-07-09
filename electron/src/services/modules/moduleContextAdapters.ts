import { getLingCppModuleCompletionItems } from '../lingCpp/completionCatalog';
import { InstalledModule, LingCppModuleContext, ModuleCommandContribution } from './types';

export interface BeginnerModuleCodeCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: 'command' | 'snippet' | 'type';
  cursorOffset?: number;
  selectLength?: number;
}

export interface BeginnerModuleCommandHintParameter {
  name: string;
  type: string;
  note: string;
}

export interface BeginnerModuleCommandHint {
  command: string;
  signature: string;
  returnType: string;
  summary: string;
  parameters: BeginnerModuleCommandHintParameter[];
  example: string;
}

export function getBeginnerModuleCodeCompletions(moduleContext?: LingCppModuleContext): BeginnerModuleCodeCompletion[] {
  return getLingCppModuleCompletionItems(moduleContext).map(item => {
    const snippet = normalizeSnippetPlaceholders(item.insertText);
    return {
      label: item.label,
      detail: item.detail || item.documentation || '模块贡献',
      insertText: snippet.text,
      aliases: uniqueStrings([
        item.label,
        item.detail,
        item.documentation,
        ...(item.aliases || []),
        ...(item.pinyin || [])
      ]),
      kind: item.kind === 'type' ? 'type' : item.kind === 'snippet' ? 'snippet' : 'command',
      cursorOffset: snippet.cursorOffset,
      selectLength: snippet.selectLength
    };
  });
}

export function getBeginnerModuleCommandHints(moduleContext?: LingCppModuleContext): Record<string, BeginnerModuleCommandHint> {
  const hints: Record<string, BeginnerModuleCommandHint> = {};
  getEnabledCleanModules(moduleContext).forEach(module => {
    (module.manifest.contributes?.commands || []).forEach(command => {
      hints[command.name] = {
        command: command.name,
        signature: command.signature || `${command.name}()`,
        returnType: command.returnType || '无',
        summary: command.description || `${module.manifest.name} 提供的模块命令`,
        parameters: parseCommandParameters(command),
        example: normalizeSnippetPlaceholders(command.insertText || command.signature || `${command.name}()`).text
      };
    });
  });
  return hints;
}

export function describeLingCppModuleContextForAi(moduleContext?: LingCppModuleContext): string {
  const enabledModules = getEnabledCleanModules(moduleContext);
  const availableModules = moduleContext?.availableModules || [];
  const disabledModules = availableModules.filter(module =>
    !enabledModules.some(enabled => enabled.manifest.id === module.manifest.id)
  );

  if (enabledModules.length === 0 && disabledModules.length === 0) {
    return '当前项目没有可用模块上下文。';
  }

  const lines: string[] = [];
  if (enabledModules.length > 0) {
    lines.push('已启用模块：');
    enabledModules.slice(0, 8).forEach(module => {
      lines.push(formatModuleForAi(module));
    });
  } else {
    lines.push('已启用模块：无。');
  }

  if (disabledModules.length > 0) {
    lines.push('未启用但已安装/可用模块：');
    disabledModules.slice(0, 8).forEach(module => {
      lines.push(`- ${module.manifest.name} (${module.manifest.id})：${module.manifest.description}`);
    });
  }

  return lines.join('\n');
}

export function normalizeSnippetPlaceholders(insertText: string): { text: string; cursorOffset?: number; selectLength?: number } {
  let cursorOffset: number | undefined;
  let selectLength: number | undefined;
  let text = insertText.replace(/\$\{(\d+):([^}]+)\}/g, (full, index, value, offset) => {
    if (cursorOffset === undefined && index !== '0') {
      cursorOffset = offset;
      selectLength = value.length;
    }
    return value;
  });

  text = text.replace(/\$(\d+)/g, (full, index, offset) => {
    if (cursorOffset === undefined || index === '0') {
      cursorOffset = offset;
      selectLength = 0;
    }
    return '';
  });

  return { text, cursorOffset, selectLength };
}

function getEnabledCleanModules(moduleContext?: LingCppModuleContext): InstalledModule[] {
  return (moduleContext?.enabledModules || []).filter(module => module.diagnostics.length === 0);
}

function formatModuleForAi(module: InstalledModule): string {
  const manifest = module.manifest;
  const lines = [`- ${manifest.name} (${manifest.id}) v${manifest.version}：${manifest.description}`];
  const commands = (manifest.contributes?.commands || []).slice(0, 12);
  const bindings = (manifest.bindings?.commands || []).slice(0, 12);
  const targets = (manifest.targets || []).slice(0, 4);
  const types = (manifest.contributes?.types || []).slice(0, 12);
  const snippets = (manifest.contributes?.snippets || []).slice(0, 8);

  if (commands.length > 0) {
    lines.push(`  命令：${commands.map(command => `${command.name} => ${command.signature || command.name}`).join('；')}`);
  }
  if (bindings.length > 0) {
    lines.push(`  C++绑定：${bindings.map(binding => `${binding.command}->${binding.runtimeName}`).join('；')}`);
  }
  if (targets.length > 0) {
    lines.push(`  目标：${targets.map(target => `${target.id}(${target.platform}/${target.toolchain}/${target.arch})`).join('；')}`);
  }
  if (types.length > 0) {
    lines.push(`  类型：${types.map(type => `${type.name}（${type.description}）`).join('；')}`);
  }
  if (snippets.length > 0) {
    lines.push(`  片段：${snippets.map(snippet => snippet.label).join('；')}`);
  }

  return lines.join('\n');
}

function parseCommandParameters(command: ModuleCommandContribution): BeginnerModuleCommandHintParameter[] {
  const signature = command.signature || '';
  const match = signature.match(/^[^(（]+[（(](.*)[）)]/u);
  if (!match || !match[1].trim()) return [];

  return match[1]
    .split(/[，,]/u)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [name, type] = part.split(/[:：]/u).map(value => value.trim());
      return {
        name: name || part,
        type: type || '参数',
        note: command.description || ''
      };
    });
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]));
}
