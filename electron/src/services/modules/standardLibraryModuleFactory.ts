import {
  LingBuilderModuleCategory,
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBindingParameter,
  ModuleDocContribution,
  ModuleSnippetContribution,
  ModuleTypeContribution
} from './types';
import {
  isWideStringAbiBindingType,
  MODULE_BINDING_TYPE_LABELS,
  normalizeControlReferenceCallSnippet,
  normalizeControlReferenceParameter,
  normalizeHandlerParameter
} from './bindingValueType';

/** 参数说明必填的绑定参数类型；漏写说明会在编译期报错。 */
export type StandardCommandParameter = ModuleCommandBindingParameter & { description: string };

export interface StandardCommandSpec {
  name: string;
  signature: string;
  description: string;
  insertText: string;
  /** 逐参数中文说明是硬性契约：新手模式命令提示面板直接读取该字段。 */
  parameters?: StandardCommandParameter[];
  returnType: string;
  returnDescription?: string;
  category?: string;
  visibility?: 'default' | 'advanced' | 'internal';
  example?: string;
}

export interface StandardModuleSpec {
  id: string;
  name: string;
  category: LingBuilderModuleCategory;
  description: string;
  tags: string[];
  version?: string;
  types?: ModuleTypeContribution[];
  docs?: ModuleDocContribution[];
  snippets?: ModuleSnippetContribution[];
  commands: StandardCommandSpec[];
}

const RETURN_TYPE_LABELS: Record<ModuleBindingValueType, string> = {
  ...MODULE_BINDING_TYPE_LABELS,
  double: '双精度小数型',
  utf8String: '文本型',
  handle: '长整数型',
  raw: '原生类型'
};

/** Creates a manifest whose commands, bindings and snippets stay in one source of truth. */
export function createStandardModule(spec: StandardModuleSpec): LingBuilderModuleManifest {
  const commands = spec.commands.map(command => {
    const parameters = (command.parameters || [])
      .map(parameter => normalizeHandlerParameter(normalizeControlReferenceParameter(parameter)));
    return {
      ...command,
      parameters,
      insertText: normalizeControlReferenceCallSnippet(command.insertText, parameters) || command.insertText,
      example: normalizeControlReferenceCallSnippet(command.example, parameters)
    };
  });
  return {
    schemaVersion: 2,
    id: spec.id,
    name: spec.name,
    version: spec.version || '1.0.0',
    category: spec.category,
    description: spec.description,
    author: 'LingBuilder',
    license: 'MIT',
    tags: ['内置', '标准库', ...spec.tags],
    contributes: {
      commands: commands.map(command => ({
        name: command.name,
        signature: command.signature,
        description: command.description,
        insertText: command.insertText,
        returnType: RETURN_TYPE_LABELS[command.returnType as ModuleBindingValueType] || command.returnType,
        returnDescription: command.returnDescription,
        category: command.category,
        visibility: command.visibility
      })),
      types: spec.types,
      snippets: spec.snippets || [{
        label: `${spec.name}快速示例`,
        insertText: commands.slice(0, 2).map(command => command.example || command.insertText.replace(/\$\d+/g, '')).join('\n'),
        description: `插入${spec.name}的基础调用示例。`
      }],
      docs: spec.docs
    },
    targets: [
      { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc' },
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }
    ],
    bindings: {
      commands: commands.map(command => ({
        command: command.name,
        runtimeName: command.name,
        parameters: command.parameters || [],
        returnType: command.returnType,
        encoding: command.parameters?.some(parameter => isWideStringAbiBindingType(parameter.type)) || command.returnType === 'wideString'
          ? 'wide'
          : undefined,
        example: command.example
      }))
    }
  };
}
