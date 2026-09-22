import fs from 'node:fs/promises';
import path from 'node:path';
import {
  LingBuilderModuleManifest,
  LingBuilderModuleCategory,
  ModuleTargetContribution,
  ModuleTargetArch,
  ModuleTargetPlatform,
  ModuleTargetToolchain,
  ModuleBindingValueType
} from './types';
import { normalizeControlReferenceCallSnippet, normalizeControlReferenceSnippet } from './bindingValueType';
import { validateModuleTypeContributions } from './modulePublicTypeService';
import { validateModuleConstantContributions } from './moduleConstantService';

const CATEGORIES: LingBuilderModuleCategory[] = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'];
const MODULE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const TARGET_PLATFORMS: ModuleTargetPlatform[] = ['windows', 'linux', 'macos'];
const TARGET_ARCHES: ModuleTargetArch[] = ['win32', 'x64', 'arm64', 'any'];
const TARGET_TOOLCHAINS: ModuleTargetToolchain[] = ['msvc', 'gcc', 'clang', 'cmake', 'any'];
const BINDING_VALUE_TYPES: ModuleBindingValueType[] = ['void', 'int', 'longLong', 'double', 'float', 'bool', 'wideString', 'utf8String', 'controlRef', 'handler', 'lingValue', 'handle', 'bytes', 'array', 'arrayElement', 'raw'];
const CONTROL_REFERENCE_SCOPES = ['currentWindow', 'project'];
const CONTROL_REFERENCE_KINDS = ['visual', 'nonVisual', 'resource'];
const CONTROL_RUNTIME_REPRESENTATIONS = ['wideName', 'stableId', 'nativeHandle'];
const DESIGNER_PROPERTY_TYPES = ['text', 'hotkey', 'hotKey', 'number', 'boolean', 'enum', 'color', 'file', 'stringList', 'columns', 'dataGridColumns', 'dataGridRows', 'treeNodes', 'tabs', 'date', 'controlRef', 'recordList'];
const DESIGNER_RECORD_FIELD_TYPES = ['text', 'number', 'boolean', 'enum', 'color', 'file', 'controlRef'];
const DESIGNER_LAYOUT_MODES = ['absolute', 'flow', 'stack', 'grid', 'dock', 'slots', 'single', 'custom'];

export interface ModuleValidationOptions {
  /** AI 导入路径使用：要求每条 contributes.commands 都有同名 bindings.commands 映射。 */
  requireCommandBindings?: boolean;
  /** AI 导入路径使用：要求声明的文档和示例文件非空。 */
  requireNonEmptyDocumentsAndExamples?: boolean;
}

export function validateModuleManifest(value: unknown, options: ModuleValidationOptions = {}): { manifest?: LingBuilderModuleManifest; diagnostics: string[] } {
  const diagnostics: string[] = [];
  if (!value || typeof value !== 'object') {
    return { diagnostics: ['模块清单不是有效对象。'] };
  }

  const raw = value as Record<string, any>;
  if (raw.schemaVersion !== 2) diagnostics.push('schemaVersion 必须为 2；旧版 .lbmod v1 需要使用模块迁移工具重新打包。');
  if (typeof raw.id !== 'string' || !MODULE_ID_RE.test(raw.id)) diagnostics.push('模块 ID 必须是小写字母、数字、点、横线或下划线组成的稳定标识。');
  if (typeof raw.name !== 'string' || !raw.name.trim()) diagnostics.push('模块名称不能为空。');
  if (typeof raw.version !== 'string' || !raw.version.trim()) diagnostics.push('模块版本不能为空。');
  if (!CATEGORIES.includes(raw.category)) diagnostics.push('模块分类不在允许范围内。');
  if (typeof raw.description !== 'string' || !raw.description.trim()) diagnostics.push('模块说明不能为空。');

  const contributesValue = raw.contributes;
  const contributes = contributesValue && typeof contributesValue === 'object' && !Array.isArray(contributesValue)
    ? contributesValue
    : undefined;
  if (contributesValue !== undefined && (!contributesValue || typeof contributesValue !== 'object' || Array.isArray(contributesValue))) {
    diagnostics.push('contributes 必须是对象。');
  }

  if (contributes?.commands !== undefined) {
    if (!Array.isArray(contributes.commands)) diagnostics.push('contributes.commands 必须是数组。');
    else {
      const seen = new Set<string>();
      const seenAliases = new Set<string>();
      contributes.commands.forEach((command: any, index: number) => {
        if (typeof command?.name !== 'string' || !command.name.trim()) diagnostics.push(`第 ${index + 1} 个命令缺少 name。`);
        if (seen.has(command?.name) || seenAliases.has(command?.name)) diagnostics.push(`命令名称或别名重复：${command.name}`);
        seen.add(command?.name);
        if (command?.aliases !== undefined) {
          if (!Array.isArray(command.aliases) || command.aliases.some((alias: unknown) => typeof alias !== 'string' || !alias.trim())) {
            diagnostics.push(`命令 ${command?.name || index + 1} 的 aliases 必须是非空文本数组。`);
          } else {
            command.aliases.forEach((alias: string) => {
              if (alias === command.name) diagnostics.push(`命令 ${command.name} 的别名不能与主名称相同。`);
              if (seen.has(alias) || seenAliases.has(alias)) diagnostics.push(`命令名称或别名重复：${alias}`);
              seenAliases.add(alias);
            });
          }
        }
        if (typeof command?.signature !== 'string' || !command.signature.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 signature。`);
        if (typeof command?.description !== 'string' || !command.description.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 description。`);
        if (command?.insertText !== undefined && (typeof command.insertText !== 'string' || !command.insertText.trim())) diagnostics.push(`命令 ${command?.name || index + 1} 的 insertText 必须是非空文本。`);
        if (command?.visibility !== undefined && !['default', 'advanced', 'internal'].includes(command.visibility)) diagnostics.push(`命令 ${command?.name || index + 1} 的 visibility 无效。`);
        if (command?.category !== undefined && (typeof command.category !== 'string' || !command.category.trim())) {
          diagnostics.push(`命令 ${command?.name || index + 1} 的 category 必须是非空文本。`);
        }
        if (command?.capabilityKind !== undefined && !['single', 'aggregate', 'managed', 'secureReplacement'].includes(command.capabilityKind)) {
          diagnostics.push(`命令 ${command?.name || index + 1} 的 capabilityKind 无效。`);
        }
        if (command?.officialCapability !== undefined && typeof command.officialCapability !== 'boolean') {
          diagnostics.push(`命令 ${command?.name || index + 1} 的 officialCapability 必须是逻辑值。`);
        }
        if (command?.returnDescription !== undefined && (typeof command.returnDescription !== 'string' || !command.returnDescription.trim())) {
          diagnostics.push(`命令 ${command?.name || index + 1} 的 returnDescription 必须是非空文本。`);
        }
      });
    }
  }

  validateMenuContributions(contributes?.menus, contributes?.submenus, diagnostics);
  validateModuleTypeContributions(contributes?.types, diagnostics);
  validateModuleConstantContributions(contributes?.constants, diagnostics);

  if (contributes?.designerControls !== undefined) {
    if (!Array.isArray(contributes.designerControls)) diagnostics.push('contributes.designerControls 必须是数组。');
    else {
      const seenControls = new Set<string>();
      contributes.designerControls.forEach((control: any, controlIndex: number) => {
        if (typeof control?.type !== 'string' || !control.type.trim()) diagnostics.push(`designerControls[${controlIndex}] 缺少 type。`);
        if (seenControls.has(control?.type)) diagnostics.push(`设计器控件重复：${control.type}`);
        seenControls.add(control?.type);
        if (typeof control?.label !== 'string' || !control.label.trim()) diagnostics.push(`designerControls[${controlIndex}] 缺少 label。`);
        if (!control?.defaultProps || typeof control.defaultProps !== 'object' || Array.isArray(control.defaultProps)) diagnostics.push(`designerControls[${controlIndex}].defaultProps 必须是对象。`);
        if (control?.layout !== undefined) {
          if (!control.layout || typeof control.layout !== 'object' || !DESIGNER_LAYOUT_MODES.includes(control.layout.mode)) {
            diagnostics.push(`designerControls[${controlIndex}].layout.mode 不受支持。`);
          } else {
            if (control.layout.coordinateSpace !== undefined && !['window', 'parent'].includes(control.layout.coordinateSpace)) diagnostics.push(`designerControls[${controlIndex}].layout.coordinateSpace 无效。`);
            if (control.layout.orientation !== undefined && !['horizontal', 'vertical'].includes(control.layout.orientation)) diagnostics.push(`designerControls[${controlIndex}].layout.orientation 无效。`);
            if (control.layout.capacity !== undefined && (!Number.isInteger(control.layout.capacity) || control.layout.capacity < 1)) diagnostics.push(`designerControls[${controlIndex}].layout.capacity 必须是正整数。`);
            if (control.layout.slots !== undefined && (!Array.isArray(control.layout.slots) || control.layout.slots.some((slot: unknown) => typeof slot !== 'string' || !slot.trim()))) diagnostics.push(`designerControls[${controlIndex}].layout.slots 必须是非空文本数组。`);
            if (control.layout.acceptedDesignerTypes !== undefined && (!Array.isArray(control.layout.acceptedDesignerTypes) || control.layout.acceptedDesignerTypes.some((type: unknown) => typeof type !== 'string' || !type.trim()))) diagnostics.push(`designerControls[${controlIndex}].layout.acceptedDesignerTypes 必须是非空文本数组。`);
          }
        }
        const eventNames = new Set<string>();
        if (control?.events !== undefined && !Array.isArray(control.events)) diagnostics.push(`designerControls[${controlIndex}].events 必须是数组。`);
        else (control?.events || []).forEach((event: any, eventIndex: number) => {
          if (typeof event?.name !== 'string' || !event.name.trim()) diagnostics.push(`designerControls[${controlIndex}].events[${eventIndex}] 缺少 name。`);
          if (eventNames.has(event?.name)) diagnostics.push(`控件 ${control.type} 的事件重复：${event.name}`);
          eventNames.add(event?.name);
          if (event?.aliases !== undefined && (!Array.isArray(event.aliases) || event.aliases.some((alias: unknown) => typeof alias !== 'string' || !alias.trim()))) {
            diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} aliases 必须是非空文本数组。`);
          }
          if (typeof event?.handlerPattern !== 'string' || !event.handlerPattern.includes('{controlName}')) diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} 缺少 {controlName} 处理器占位符。`);
          const parameterNames = new Set<string>();
          if (event?.parameters !== undefined && !Array.isArray(event.parameters)) {
            diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} parameters 必须是数组。`);
          } else (event?.parameters || []).forEach((parameter: any, parameterIndex: number) => {
            if (typeof parameter?.name !== 'string' || !parameter.name.trim()) {
              diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} 参数 ${parameterIndex + 1} 缺少 name。`);
            } else if (parameterNames.has(parameter.name.trim())) {
              diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} 参数重复：${parameter.name}`);
            } else {
              parameterNames.add(parameter.name.trim());
            }
            if (!BINDING_VALUE_TYPES.includes(parameter?.type)) {
              diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} 参数 ${parameter?.name || parameterIndex + 1} type 不受支持。`);
            }
          });
          if (event?.starterStatements !== undefined && (!Array.isArray(event.starterStatements)
            || event.starterStatements.some((statement: unknown) => typeof statement !== 'string' || !statement.trim() || /[\r\n]/u.test(statement)))) {
            diagnostics.push(`控件 ${control.type} 的事件 ${event?.name || eventIndex} starterStatements 必须是单行非空文本数组。`);
          }
        });
        const propertyKeys = new Set<string>();
        if (control?.properties !== undefined && !Array.isArray(control.properties)) diagnostics.push(`designerControls[${controlIndex}].properties 必须是数组。`);
        else (control?.properties || []).forEach((property: any, propertyIndex: number) => {
          if (typeof property?.key !== 'string' || !property.key.trim()) diagnostics.push(`designerControls[${controlIndex}].properties[${propertyIndex}] 缺少 key。`);
          if (propertyKeys.has(property?.key)) diagnostics.push(`控件 ${control.type} 的属性重复：${property.key}`);
          propertyKeys.add(property?.key);
          if (!DESIGNER_PROPERTY_TYPES.includes(property?.type)) diagnostics.push(`控件 ${control.type} 的属性 ${property?.key || propertyIndex} 类型不受支持。`);
          if (property?.type === 'file' && typeof property?.defaultValue === 'string' && property.defaultValue && !validateModuleRelativePath(property.defaultValue)) diagnostics.push(`控件 ${control.type} 的文件属性 ${property.key} 默认值不是安全相对路径。`);
          if (property?.level !== undefined && !['basic', 'advanced'].includes(property.level)) diagnostics.push(`控件 ${control.type} 的属性 ${property.key} level 无效。`);
          validateDesignerControlReference(property, `控件 ${control.type} 的属性 ${property?.key || propertyIndex}`, diagnostics);
          if (property?.type === 'recordList') validateDesignerRecordList(property, control.type, diagnostics);
        });
        if (control?.runtime?.applyContentCommand !== undefined
          && (typeof control.runtime.applyContentCommand !== 'string' || !control.runtime.applyContentCommand.trim())) {
          diagnostics.push(`designerControls[${controlIndex}].runtime.applyContentCommand 必须是非空文本。`);
        }
        validateRuntimeControlContribution(control, controlIndex, contributes, raw.bindings, diagnostics);
      });
    }
  }

  if (raw.designer !== undefined) {
    if (!raw.designer || typeof raw.designer !== 'object' || Array.isArray(raw.designer)) diagnostics.push('designer 必须是对象。');
    else {
      if (typeof raw.designer.backend !== 'string' || !raw.designer.backend.trim()) diagnostics.push('designer.backend 不能为空。');
      if (!Number.isInteger(raw.designer.schemaVersion) || raw.designer.schemaVersion < 1) diagnostics.push('designer.schemaVersion 必须是正整数。');
      if (typeof raw.designer.path !== 'string' || !validateModuleRelativePath(raw.designer.path)) diagnostics.push('designer.path 必须是安全模块相对路径。');
      if (typeof raw.designer.sha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(raw.designer.sha256)) diagnostics.push('designer.sha256 必须是 64 位十六进制摘要。');
    }
  }

  validatePathArray(
    Array.isArray(contributes?.docs) ? contributes.docs.map((doc: any) => doc?.path) : contributes?.docs,
    'docs.path',
    diagnostics
  );
  validatePathArray(
    Array.isArray(contributes?.examples) ? contributes.examples.map((example: any) => example?.path) : contributes?.examples,
    'examples.path',
    diagnostics
  );
  validateDependencies(raw.dependencies, raw.id, diagnostics);
  const commands = Array.isArray(contributes?.commands) ? contributes.commands : [];
  const types = Array.isArray(contributes?.types) ? contributes.types : [];
  const targets = Array.isArray(raw.targets) ? raw.targets : [];
  validateBuildContribution(raw.build, targets, diagnostics);
  validateTargets(raw.targets, diagnostics);
  validateBindings(raw.bindings, commands, types, targets, diagnostics, options);
  if (contributes?.snippets !== undefined && !Array.isArray(contributes.snippets)) {
    diagnostics.push('contributes.snippets 必须是数组。');
  } else if (Array.isArray(contributes?.snippets)) {
    contributes.snippets.forEach((snippet: any, index: number) => {
      if (typeof snippet?.label !== 'string' || !snippet.label.trim()) diagnostics.push(`contributes.snippets[${index}].label 必须是非空文本。`);
      if (typeof snippet?.insertText !== 'string' || !snippet.insertText.trim()) diagnostics.push(`contributes.snippets[${index}].insertText 必须是非空文本。`);
      if (typeof snippet?.description !== 'string' || !snippet.description.trim()) diagnostics.push(`contributes.snippets[${index}].description 必须是非空文本。`);
    });
  }
  validateModuleFileContributions(contributes?.docs, 'contributes.docs', '文档', diagnostics);
  validateModuleFileContributions(contributes?.examples, 'contributes.examples', '示例', diagnostics);
  validateControlReferenceSnippets(contributes?.snippets, Array.isArray(raw.bindings?.commands) ? raw.bindings.commands : undefined, diagnostics);
  validateCompatibility(raw.compatibility, raw.id, diagnostics);
  if (options.requireCommandBindings) validateStrictAiModuleRequirements(contributes, raw, diagnostics);

  if (diagnostics.length > 0) return { diagnostics };
  return { manifest: raw as LingBuilderModuleManifest, diagnostics };
}

function validateDesignerRecordList(property: any, controlType: string, diagnostics: string[]): void {
  const prefix = `控件 ${controlType} 的 recordList 属性 ${property?.key || ''}`;
  if (!Array.isArray(property?.defaultValue)) diagnostics.push(`${prefix} 默认值必须是数组。`);
  if (typeof property?.recordKey !== 'string' || !property.recordKey.trim()) diagnostics.push(`${prefix} 必须声明 recordKey。`);
  if (!Array.isArray(property?.fields) || property.fields.length === 0) {
    diagnostics.push(`${prefix} 必须声明非空 fields。`);
    return;
  }
  const fieldKeys = new Set<string>();
  for (const [index, field] of property.fields.entries()) {
    const fieldPrefix = `${prefix}.fields[${index}]`;
    if (typeof field?.key !== 'string' || !field.key.trim()) diagnostics.push(`${fieldPrefix}.key 不能为空。`);
    if (fieldKeys.has(field?.key)) diagnostics.push(`${prefix} 字段重复：${field.key}`);
    fieldKeys.add(field?.key);
    if (typeof field?.label !== 'string' || !field.label.trim()) diagnostics.push(`${fieldPrefix}.label 不能为空。`);
    if (!DESIGNER_RECORD_FIELD_TYPES.includes(field?.type)) diagnostics.push(`${fieldPrefix}.type 不受支持。`);
    if (field?.required !== undefined && typeof field.required !== 'boolean') diagnostics.push(`${fieldPrefix}.required 必须是逻辑值。`);
    validateDesignerControlReference(field, fieldPrefix, diagnostics);
  }
  if (property.recordKey && !fieldKeys.has(property.recordKey)) diagnostics.push(`${prefix}.recordKey 必须引用 fields 中的稳定字段。`);
}

function validateDesignerControlReference(value: any, prefix: string, diagnostics: string[]): void {
  const metadata = ['controlTypes', 'controlKinds', 'scope', 'runtimeRepresentation'];
  if (value?.type !== 'controlRef') {
    if (metadata.some(key => value?.[key] !== undefined)) diagnostics.push(`${prefix} 只有 controlRef 可以声明控件引用约束。`);
    return;
  }
  if (!Array.isArray(value.controlKinds) || value.controlKinds.length === 0) diagnostics.push(`${prefix}.controlKinds 必须显式声明。`);
  if (!value.scope) diagnostics.push(`${prefix}.scope 必须显式声明。`);
  if (!value.runtimeRepresentation) diagnostics.push(`${prefix}.runtimeRepresentation 必须显式声明。`);
  if (value.controlTypes !== undefined && (!Array.isArray(value.controlTypes) || value.controlTypes.some((item: unknown) => typeof item !== 'string' || !item.trim()))) diagnostics.push(`${prefix}.controlTypes 必须是非空控件类型文本数组。`);
  if (value.controlKinds !== undefined && (!Array.isArray(value.controlKinds) || value.controlKinds.some((item: unknown) => !CONTROL_REFERENCE_KINDS.includes(String(item))))) diagnostics.push(`${prefix}.controlKinds 不受支持。`);
  if (value.scope !== undefined && !CONTROL_REFERENCE_SCOPES.includes(value.scope)) diagnostics.push(`${prefix}.scope 不受支持。`);
  if (value.runtimeRepresentation !== undefined && !CONTROL_RUNTIME_REPRESENTATIONS.includes(value.runtimeRepresentation)) diagnostics.push(`${prefix}.runtimeRepresentation 不受支持。`);
}

function validateRuntimeControlContribution(control: any, controlIndex: number, contributes: any, bindings: any, diagnostics: string[]): void {
  const contract = control?.runtimeControl;
  if (contract === undefined) return;
  const prefix = `designerControls[${controlIndex}].runtimeControl`;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    diagnostics.push(`${prefix} 必须是对象。`);
    return;
  }
  if (control?.isVisual === false) diagnostics.push(`${prefix} 只能用于可视控件。`);
  if (typeof contract.lingCppType !== 'string' || !contract.lingCppType.trim()) diagnostics.push(`${prefix}.lingCppType 不能为空。`);
  if (contract.cppType !== 'LingControlRef') diagnostics.push(`${prefix}.cppType 必须为 LingControlRef。`);
  if (contract.tagScope !== 'currentWindowAndConcreteType') diagnostics.push(`${prefix}.tagScope 必须为 currentWindowAndConcreteType。`);
  if (!Array.isArray(contract.parentKinds) || contract.parentKinds.length === 0
    || contract.parentKinds.some((kind: unknown) => !['window', 'container', 'tabPage'].includes(String(kind)))) {
    diagnostics.push(`${prefix}.parentKinds 必须声明 window、container 或 tabPage。`);
  }
  const commandFields = ['createCommand', 'lookupByTagTextCommand', 'lookupByTagIntegerCommand', 'validCommand'] as const;
  commandFields.forEach(field => {
    if (typeof contract[field] !== 'string' || !contract[field].trim()) diagnostics.push(`${prefix}.${field} 不能为空。`);
  });
  if (contract.validCommand !== '控件_是否有效') diagnostics.push(`${prefix}.validCommand 必须为 控件_是否有效。`);

  const publicTypes = new Map((Array.isArray(contributes?.types) ? contributes.types : []).map((type: any) => [type?.name, type]));
  const publicType = publicTypes.get(contract.lingCppType) as any;
  if (!publicType) diagnostics.push(`${prefix}.lingCppType 未在 contributes.types 中公开。`);
  else if (publicType.cppType !== 'LingControlRef') diagnostics.push(`类型 ${contract.lingCppType} 的 cppType 必须为 LingControlRef。`);

  const commandNames = new Set((Array.isArray(contributes?.commands) ? contributes.commands : []).map((command: any) => command?.name));
  const bindingByCommand = new Map((Array.isArray(bindings?.commands) ? bindings.commands : []).map((binding: any) => [binding?.command, binding]));
  for (const field of ['createCommand', 'lookupByTagTextCommand', 'lookupByTagIntegerCommand'] as const) {
    const commandName = contract[field];
    if (typeof commandName !== 'string') continue;
    if (!commandNames.has(commandName)) diagnostics.push(`${prefix}.${field} 引用了未贡献的命令：${commandName}`);
    if (!bindingByCommand.has(commandName)) diagnostics.push(`${prefix}.${field} 缺少 bindings.commands 映射：${commandName}`);
  }
  const createBinding = bindingByCommand.get(contract.createCommand) as any;
  if (createBinding && createBinding.returnType !== contract.lingCppType) diagnostics.push(`命令 ${contract.createCommand} 必须返回 ${contract.lingCppType}。`);

  if (!Array.isArray(contract.createParameters)) {
    diagnostics.push(`${prefix}.createParameters 必须是数组。`);
    return;
  }
  const roles = contract.createParameters.map((parameter: any) => parameter?.role);
  for (const requiredRole of ['parent', 'x', 'y', 'width', 'height']) {
    if (roles.filter((role: unknown) => role === requiredRole).length !== 1) diagnostics.push(`${prefix}.createParameters 必须且只能包含一个 ${requiredRole} 参数。`);
  }
  if (roles.at(-2) !== 'tagText' || roles.at(-1) !== 'tagInteger') diagnostics.push(`${prefix}.createParameters 末尾必须依次为 tagText、tagInteger。`);
  contract.createParameters.forEach((parameter: any, parameterIndex: number) => {
    if (typeof parameter?.name !== 'string' || !parameter.name.trim()) diagnostics.push(`${prefix}.createParameters[${parameterIndex}] 缺少 name。`);
    if (!['parent', 'x', 'y', 'width', 'height', 'content', 'property', 'tagText', 'tagInteger'].includes(parameter?.role)) diagnostics.push(`${prefix}.createParameters[${parameterIndex}].role 无效。`);
    if (parameter?.role === 'property' && (typeof parameter?.propertyKey !== 'string' || !parameter.propertyKey.trim())) diagnostics.push(`${prefix}.createParameters[${parameterIndex}] 的 property 角色必须声明 propertyKey。`);
    if ((parameter?.role === 'tagText' || parameter?.role === 'tagInteger') && parameter?.optional !== true) diagnostics.push(`${prefix}.${parameter.role} 必须声明 optional: true。`);
  });
}

function validateControlReferenceSnippets(snippets: unknown, bindings: unknown, diagnostics: string[]): void {
  if (!Array.isArray(snippets) || !Array.isArray(bindings)) return;
  snippets.forEach((snippet: any, snippetIndex: number) => {
    if (typeof snippet?.insertText !== 'string') return;
    if (normalizeControlReferenceSnippet(snippet.insertText, bindings) !== snippet.insertText) {
      diagnostics.push(`contributes.snippets[${snippetIndex}] 不得给 controlRef 参数添加双引号，包括嵌套命令。`);
    }
  });
}

function validateDependencies(dependencies: unknown, moduleId: string, diagnostics: string[]): void {
  if (dependencies === undefined) return;
  if (!Array.isArray(dependencies)) {
    diagnostics.push('dependencies 必须是数组。');
    return;
  }
  const seen = new Set<string>();
  dependencies.forEach((dependency: any, index: number) => {
    if (typeof dependency?.moduleId !== 'string' || !MODULE_ID_RE.test(dependency.moduleId)) {
      diagnostics.push(`dependencies[${index}].moduleId 不是有效模块 ID。`);
      return;
    }
    if (dependency.moduleId === moduleId) diagnostics.push(`模块不能依赖自身：${moduleId}`);
    if (seen.has(dependency.moduleId)) diagnostics.push(`重复的模块依赖：${dependency.moduleId}`);
    seen.add(dependency.moduleId);
    if (typeof dependency?.minimumVersion !== 'string' || !/^\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?$/u.test(dependency.minimumVersion)) {
      diagnostics.push(`dependencies[${index}].minimumVersion 必须是可比较的版本号。`);
    }
  });
}

function validateCompatibility(compatibility: unknown, moduleId: string, diagnostics: string[]): void {
  if (compatibility === undefined) return;
  if (!compatibility || typeof compatibility !== 'object' || Array.isArray(compatibility)) {
    diagnostics.push('compatibility 必须是对象。');
    return;
  }
  const conflicts = (compatibility as any).conflicts;
  if (conflicts === undefined) return;
  if (!Array.isArray(conflicts)) {
    diagnostics.push('compatibility.conflicts 必须是数组。');
    return;
  }
  const seen = new Set<string>();
  conflicts.forEach((conflict: any, index: number) => {
    if (typeof conflict?.moduleId !== 'string' || !MODULE_ID_RE.test(conflict.moduleId)) {
      diagnostics.push(`compatibility.conflicts[${index}].moduleId 不是有效模块 ID。`);
      return;
    }
    if (conflict.moduleId === moduleId) diagnostics.push(`模块不能与自身冲突：${moduleId}`);
    if (seen.has(conflict.moduleId)) diagnostics.push(`重复的模块冲突声明：${conflict.moduleId}`);
    seen.add(conflict.moduleId);
    if (typeof conflict?.reason !== 'string' || !conflict.reason.trim()) {
      diagnostics.push(`compatibility.conflicts[${index}].reason 必须是非空中文说明。`);
    }
  });
}

function validateMenuContributions(menus: unknown, submenus: unknown, diagnostics: string[]): void {
  const submenuIds = new Set<string>();
  if (submenus !== undefined) {
    if (!Array.isArray(submenus)) diagnostics.push('contributes.submenus 必须是数组。');
    else submenus.forEach((submenu: any, index: number) => {
      if (typeof submenu?.id !== 'string' || !submenu.id.trim()) diagnostics.push(`submenus[${index}] 缺少 id。`);
      if (typeof submenu?.title !== 'string' || !submenu.title.trim()) diagnostics.push(`submenus[${index}] 缺少 title。`);
      if (submenuIds.has(submenu?.id)) diagnostics.push(`子菜单重复：${submenu.id}`);
      submenuIds.add(submenu?.id);
    });
  }
  if (menus === undefined) return;
  if (!Array.isArray(menus)) { diagnostics.push('contributes.menus 必须是数组。'); return; }
  menus.forEach((menu: any, index: number) => {
    if (typeof menu?.menu !== 'string' || !menu.menu.trim()) diagnostics.push(`menus[${index}] 缺少 menu。`);
    const hasCommand = typeof menu?.command === 'string' && Boolean(menu.command.trim());
    const hasSubmenu = typeof menu?.submenu === 'string' && Boolean(menu.submenu.trim());
    if (hasCommand === hasSubmenu) diagnostics.push(`menus[${index}] 必须且只能声明 command 或 submenu。`);
    if (hasSubmenu && !submenuIds.has(menu.submenu)) diagnostics.push(`menus[${index}] 引用了未声明子菜单：${menu.submenu}`);
    if (menu?.order !== undefined && typeof menu.order !== 'number') diagnostics.push(`menus[${index}].order 必须是数字。`);
    if (menu?.arguments !== undefined) {
      if (!Array.isArray(menu.arguments)) diagnostics.push(`menus[${index}].arguments 必须是数组。`);
      else {
        try { if (JSON.stringify(menu.arguments).length > 32 * 1024) diagnostics.push(`menus[${index}].arguments 超过 32KB。`); }
        catch { diagnostics.push(`menus[${index}].arguments 必须可 JSON 序列化。`); }
      }
    }
  });
}

export function validateModuleRelativePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('\0')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\')) return false;
  const normalized = value.replace(/\\/g, '/').split('/');
  return !normalized.some(part => part === '..' || part === '');
}

function validateModuleFileContributions(value: unknown, label: string, kind: '文档' | '示例', diagnostics: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    diagnostics.push(`${label} 必须是数组。`);
    return;
  }
  value.forEach((entry: any, index: number) => {
    if (typeof entry?.title !== 'string' || !entry.title.trim()) diagnostics.push(`${label}[${index}].title 必须是非空${kind}标题。`);
    if (typeof entry?.path !== 'string' || !entry.path.trim()) diagnostics.push(`${label}[${index}].path 必须是非空模块相对路径。`);
  });
}

export async function validateModuleManifestContents(
  moduleRoot: string,
  manifest: LingBuilderModuleManifest,
  options: Pick<ModuleValidationOptions, 'requireNonEmptyDocumentsAndExamples'> = {}
): Promise<string[]> {
  const diagnostics: string[] = [];
  const fileReferences = uniqueReferences([
    ...(manifest.contributes?.docs || []).map(item => ({ path: item.path, label: '文档' })),
    ...(manifest.contributes?.examples || []).map(item => ({ path: item.path, label: '示例' })),
    ...(manifest.designer ? [{ path: manifest.designer.path, label: '设计器目录' }] : []),
    ...(manifest.targets || []).flatMap(target => [
      ...(target.headers || []).map(item => ({ path: item, label: `目标 ${target.id} 的头文件` })),
      ...(target.sources || []).map(item => ({ path: item, label: `目标 ${target.id} 的源码` })),
      ...(target.libs || []).map(item => ({ path: item, label: `目标 ${target.id} 的库文件` })),
      ...(target.runtimeFiles || []).map(item => ({ path: item, label: `目标 ${target.id} 的运行时文件` }))
    ])
  ]);
  const directoryReferences = uniqueReferences(
    (manifest.targets || []).flatMap(target => (target.includeDirs || []).map(item => ({
      path: item,
      label: `目标 ${target.id} 的包含目录`
    })))
  );

  for (const reference of fileReferences) {
    await validateReferencedEntry(
      moduleRoot,
      reference,
      'file',
      diagnostics,
      options.requireNonEmptyDocumentsAndExamples === true && (reference.label === '文档' || reference.label === '示例')
    );
  }
  for (const reference of directoryReferences) {
    await validateReferencedEntry(moduleRoot, reference, 'directory', diagnostics);
  }
  return diagnostics;
}

async function validateReferencedEntry(
  moduleRoot: string,
  reference: { path: string; label: string },
  expectedType: 'file' | 'directory',
  diagnostics: string[],
  requireNonEmpty = false
): Promise<void> {
  if (!validateModuleRelativePath(reference.path)) return;
  const targetPath = path.join(moduleRoot, reference.path);
  try {
    const stat = await fs.lstat(targetPath);
    if (stat.isSymbolicLink()) {
      diagnostics.push(`${reference.label}不能是符号链接：${reference.path}`);
      return;
    }
    if (expectedType === 'file' ? !stat.isFile() : !stat.isDirectory()) {
      diagnostics.push(`${reference.label}类型不正确：${reference.path}`);
    } else if (requireNonEmpty && stat.size === 0) {
      diagnostics.push(`${reference.label}不能为空：${reference.path}`);
    }
  } catch {
    diagnostics.push(`${reference.label}不存在：${reference.path}`);
  }
}

function uniqueReferences(values: Array<{ path: string; label: string }>): Array<{ path: string; label: string }> {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = `${value.label}\0${value.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateBuildContribution(build: any, targets: any[], diagnostics: string[]): void {
  if (build === undefined) return;
  if (!build || typeof build !== 'object' || Array.isArray(build)) {
    diagnostics.push('build 必须是对象。');
    return;
  }
  if (build.buildSteps !== undefined) diagnostics.push('模块暂不允许公开 buildSteps；请使用受控 build.codeGenerators。');
  if (build.codeGenerators === undefined) return;
  if (!Array.isArray(build.codeGenerators)) {
    diagnostics.push('build.codeGenerators 必须是数组。');
    return;
  }
  const targetIds = new Set(targets.map(target => target?.id).filter(Boolean));
  const seen = new Set<string>();
  const allOutputPaths = new Set<string>();
  build.codeGenerators.forEach((generator: any, index: number) => {
    const prefix = `build.codeGenerators[${index}]`;
    if (typeof generator?.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(generator.id)) diagnostics.push(`${prefix}.id 无效。`);
    if (seen.has(generator?.id)) diagnostics.push(`代码生成器 ID 重复：${generator.id}`);
    seen.add(generator?.id);
    if (typeof generator?.provider !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(generator.provider)) diagnostics.push(`${prefix}.provider 无效。`);
    if (generator?.version !== undefined && (typeof generator.version !== 'string' || !generator.version.trim())) diagnostics.push(`${prefix}.version 必须是非空版本文本。`);
    if (!generator?.inputs || typeof generator.inputs !== 'object' || !Array.isArray(generator.inputs.include) || generator.inputs.include.length === 0) {
      diagnostics.push(`${prefix}.inputs.include 至少需要一个输入 glob。`);
    } else {
      [...generator.inputs.include, ...(generator.inputs.exclude || [])].forEach((pattern: unknown) => {
        if (typeof pattern !== 'string' || !pattern.trim() || path.isAbsolute(pattern) || pattern.split(/[\\/]/u).includes('..')) diagnostics.push(`${prefix}.inputs 含有不安全路径。`);
      });
      if (generator.inputs.exclude !== undefined && (!Array.isArray(generator.inputs.exclude) || generator.inputs.exclude.some((item: unknown) => typeof item !== 'string'))) diagnostics.push(`${prefix}.inputs.exclude 必须是文本数组。`);
      if (generator.inputs.root !== undefined && (typeof generator.inputs.root !== 'string' || path.isAbsolute(generator.inputs.root) || generator.inputs.root.split(/[\\/]/u).includes('..'))) diagnostics.push(`${prefix}.inputs.root 必须是安全的相对路径。`);
    }
    if (!Array.isArray(generator?.outputs) || generator.outputs.length === 0) diagnostics.push(`${prefix}.outputs 不能为空。`);
    else {
      const outputPaths = new Set<string>();
      generator.outputs.forEach((output: any, outputIndex: number) => {
        if (typeof output?.path !== 'string' || !output.path.trim() || path.isAbsolute(output.path) || output.path.split(/[\\/]/u).includes('..')) diagnostics.push(`${prefix}.outputs[${outputIndex}].path 不安全。`);
        if (!['source', 'header', 'content', 'descriptor', 'runtime'].includes(output?.kind)) diagnostics.push(`${prefix}.outputs[${outputIndex}].kind 不受支持。`);
        const normalizedPath = typeof output?.path === 'string' ? output.path.replace(/\\/gu, '/').toLowerCase() : '';
        if (normalizedPath && outputPaths.has(normalizedPath)) diagnostics.push(`${prefix}.outputs 存在重复路径：${output.path}`);
        if (normalizedPath) outputPaths.add(normalizedPath);
        if (normalizedPath && allOutputPaths.has(normalizedPath)) diagnostics.push(`代码生成器输出路径重复：${output.path}`);
        if (normalizedPath) allOutputPaths.add(normalizedPath);
      });
    }
    if (generator?.targetIds !== undefined) {
      if (!Array.isArray(generator.targetIds) || generator.targetIds.some((targetId: unknown) => typeof targetId !== 'string' || (targetIds.size === 0 || !targetIds.has(targetId)))) diagnostics.push(`${prefix}.targetIds 引用了不存在的 target。`);
    }
    if (generator?.options !== undefined && (!generator.options || typeof generator.options !== 'object' || Array.isArray(generator.options))) diagnostics.push(`${prefix}.options 必须是对象。`);
    else if (generator?.options !== undefined) validateCodeGeneratorOptions(generator.options, prefix, diagnostics);
  });
}

function validateCodeGeneratorOptions(options: unknown, prefix: string, diagnostics: string[], trail = ''): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return;
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (['command', 'commands', 'executable', 'exe', 'shell', 'powershell', 'script', 'javascript', 'cwd', 'workingdirectory'].includes(normalized)) {
      diagnostics.push(`${prefix}.options${trail ? `.${trail}` : ''}.${key} 不允许注入命令或脚本。`);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) validateCodeGeneratorOptions(value, prefix, diagnostics, trail ? `${trail}.${key}` : key);
  }
}

function validateTargets(targets: unknown, diagnostics: string[]): void {
  if (targets === undefined) return;
  if (!Array.isArray(targets)) {
    diagnostics.push('targets 必须是数组。');
    return;
  }
  const seen = new Set<string>();
  targets.forEach((target: ModuleTargetContribution, index: number) => {
    if (typeof target?.id !== 'string' || !target.id.trim()) diagnostics.push(`targets[${index}] 缺少 id。`);
    if (seen.has(target?.id)) diagnostics.push(`target 重复：${target.id}`);
    seen.add(target?.id);
    if (!TARGET_PLATFORMS.includes(target?.platform)) diagnostics.push(`targets[${index}].platform 不受支持。`);
    if (!TARGET_ARCHES.includes(target?.arch)) diagnostics.push(`targets[${index}].arch 不受支持。`);
    if (!TARGET_TOOLCHAINS.includes(target?.toolchain)) diagnostics.push(`targets[${index}].toolchain 不受支持。`);
    validatePathArray(target?.includeDirs, `targets[${index}].includeDirs`, diagnostics);
    validatePathArray(target?.sources, `targets[${index}].sources`, diagnostics);
    validatePathArray(target?.headers, `targets[${index}].headers`, diagnostics);
    validatePathArray(target?.libs, `targets[${index}].libs`, diagnostics);
    validatePathArray(target?.runtimeFiles, `targets[${index}].runtimeFiles`, diagnostics);
  });
}

function bindingHasArrayParameter(binding: any): boolean {
  return Array.isArray(binding?.parameters) && binding.parameters.some((parameter: any) => parameter?.type === 'array');
}

function reportMissingCommandBindings(commands: any[], boundCommandNames: Set<string>, diagnostics: string[]): void {
  commands.forEach((command: any) => {
    const name = typeof command?.name === 'string' ? command.name.trim() : '';
    if (name && !boundCommandNames.has(name)) {
      diagnostics.push(`命令 ${name} 缺少 bindings.commands 映射：编辑器能补全，但无法生成 C++ 调用；请让 AI 补上同名 binding。`);
    }
  });
}

function validateStrictAiModuleRequirements(contributes: any, raw: Record<string, any>, diagnostics: string[]): void {
  const docs = Array.isArray(contributes?.docs) ? contributes.docs : [];
  const examples = Array.isArray(contributes?.examples) ? contributes.examples : [];
  const commands = Array.isArray(contributes?.commands) ? contributes.commands : [];
  const types = Array.isArray(contributes?.types) ? contributes.types : [];
  const designerControls = Array.isArray(contributes?.designerControls) ? contributes.designerControls : [];
  const constants = Array.isArray(contributes?.constants) ? contributes.constants : [];
  const codeGenerators = Array.isArray(raw.build?.codeGenerators) ? raw.build.codeGenerators : [];

  if (docs.length === 0) diagnostics.push('AI 模块至少声明一份文档，并在导入内容中提供非空文件。');
  if (examples.length === 0) diagnostics.push('AI 模块至少声明一个示例，并在导入内容中提供非空 .lcpp 文件。');
  if (commands.length + types.length + designerControls.length + constants.length + codeGenerators.length === 0) {
    diagnostics.push('AI 模块至少需要一个可用贡献：contributes.commands、types、designerControls、constants 或 build.codeGenerators。');
  }
}

function validateBindings(bindings: any, commands: any[], types: any[], targets: any[], diagnostics: string[], options: ModuleValidationOptions = {}): void {
  const requireCommandBindings = options.requireCommandBindings === true;
  if (bindings === undefined) {
    if (requireCommandBindings) reportMissingCommandBindings(commands, new Set<string>(), diagnostics);
    return;
  }
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    diagnostics.push('bindings 必须是对象。');
    return;
  }
  if (bindings.commands === undefined) {
    if (requireCommandBindings) reportMissingCommandBindings(commands, new Set<string>(), diagnostics);
    return;
  }
  if (!Array.isArray(bindings.commands)) {
    diagnostics.push('bindings.commands 必须是数组。');
    return;
  }
  const commandNames = new Set(commands.map(command => command?.name).filter(Boolean));
  const boundCommandNames = new Set<string>(bindings.commands
    .map((binding: any): string => typeof binding?.command === 'string' ? binding.command.trim() : '')
    .filter(Boolean));
  if (requireCommandBindings) reportMissingCommandBindings(commands, boundCommandNames, diagnostics);
  const publicTypeNames = new Set(types.map(type => type?.name).filter((name): name is string => typeof name === 'string' && Boolean(name.trim())));
  const structuredTypeNames = new Set(types
    .filter(type => type?.kind === 'record' || type?.kind === 'array')
    .map(type => type.name)
    .filter((name): name is string => typeof name === 'string' && Boolean(name.trim())));
  const targetIds = new Set(targets.map(target => target?.id).filter(Boolean));
  const hasNativeDllTarget = targets.some(target => Array.isArray(target?.runtimeFiles)
    && target.runtimeFiles.some((file: unknown) => typeof file === 'string' && file.toLowerCase().endsWith('.dll')));
  const isSupportedBindingType = (value: unknown) => typeof value === 'string'
    && (BINDING_VALUE_TYPES.includes(value as ModuleBindingValueType) || publicTypeNames.has(value));
  const seenBindingCommands = new Set<string>();
  bindings.commands.forEach((binding: any, index: number) => {
    const bindingCommand = typeof binding?.command === 'string' ? binding.command.trim() : '';
    if (bindingCommand && seenBindingCommands.has(bindingCommand)) diagnostics.push(`binding 命令重复：${bindingCommand}。`);
    if (bindingCommand) seenBindingCommands.add(bindingCommand);
    if (typeof binding?.command !== 'string' || !binding.command.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 command。`);
    if (bindingCommand && (requireCommandBindings || commandNames.size > 0) && !commandNames.has(bindingCommand)) diagnostics.push(`binding 引用了未贡献的命令：${bindingCommand}`);
    if (typeof binding?.runtimeName !== 'string' || !binding.runtimeName.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 runtimeName。`);
    if (binding?.returnType && !isSupportedBindingType(binding.returnType)) diagnostics.push(`bindings.commands[${index}].returnType 不受支持；只能使用基础类型或本模块公开类型。`);
    if (hasNativeDllTarget && structuredTypeNames.has(binding?.returnType)) {
      diagnostics.push(`命令 ${binding?.command || index + 1} 不能通过原生 DLL ABI 直接返回结构化类型 ${binding.returnType}；请改用 POD 缓冲区或受管句柄。`);
    }
    // array 是泛型数组左值，没有可解析的固定返回类型；arrayElement 必须由同一命令的 array 参数定型。
    if (binding?.returnType === 'array') {
      diagnostics.push(`命令 ${binding?.command || index + 1} 不能把 array 作为 returnType；泛型数组只能作为参数原样传递。`);
    }
    if (binding?.returnType === 'arrayElement' && !bindingHasArrayParameter(binding)) {
      diagnostics.push(`命令 ${binding?.command || index + 1} 的 returnType 是 arrayElement，必须同时声明一个 array 参数来确定元素类型。`);
    }
    const bindingParameters = Array.isArray(binding?.parameters) ? binding.parameters : [];
    if (binding?.parameters !== undefined) {
      if (!Array.isArray(binding.parameters)) diagnostics.push(`bindings.commands[${index}].parameters 必须是数组。`);
      else bindingParameters.forEach((parameter: any, parameterIndex: number) => {
        if (typeof parameter?.name !== 'string' || !parameter.name.trim()) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 缺少 name。`);
        if (!isSupportedBindingType(parameter?.type)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].type 不受支持；只能使用基础类型或本模块公开类型。`);
        if (hasNativeDllTarget && structuredTypeNames.has(parameter?.type)) {
          diagnostics.push(`命令 ${binding?.command || index + 1} 不能通过原生 DLL ABI 直接传递结构化参数 ${parameter.type}；请改用 POD 缓冲区或受管句柄。`);
        }
        if (hasNativeDllTarget && (parameter?.type === 'array' || parameter?.type === 'arrayElement')) {
          diagnostics.push(`命令 ${binding?.command || index + 1} 不能通过原生 DLL ABI 直接传递泛型数组参数 ${parameter.name || parameterIndex + 1}；泛型数组只服务于同工程值语义运行时。`);
        }
        if (parameter?.type === 'arrayElement' && !bindingHasArrayParameter(binding)) {
          diagnostics.push(`命令 ${binding?.command || index + 1} 的参数 ${parameter.name || parameterIndex + 1} 是 arrayElement，必须同时声明一个 array 参数来确定元素类型。`);
        }
        if (parameter?.type === 'controlRef') {
          if (!Array.isArray(parameter.controlKinds) || parameter.controlKinds.length === 0) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].controlKinds 必须显式声明 visual、nonVisual 或 resource。`);
          if (!parameter.scope) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].scope 必须显式声明 currentWindow 或 project。`);
          if (!parameter.runtimeRepresentation) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].runtimeRepresentation 必须显式声明 wideName、stableId 或 nativeHandle。`);
          if (parameter.controlTypes !== undefined && (!Array.isArray(parameter.controlTypes) || parameter.controlTypes.some((item: unknown) => typeof item !== 'string' || !item.trim()))) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].controlTypes 必须是非空控件类型文本数组。`);
          if (parameter.controlKinds !== undefined && (!Array.isArray(parameter.controlKinds) || parameter.controlKinds.some((item: unknown) => !CONTROL_REFERENCE_KINDS.includes(String(item))))) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].controlKinds 不受支持。`);
          if (parameter.scope !== undefined && !CONTROL_REFERENCE_SCOPES.includes(parameter.scope)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].scope 不受支持。`);
          if (parameter.runtimeRepresentation !== undefined && !CONTROL_RUNTIME_REPRESENTATIONS.includes(parameter.runtimeRepresentation)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].runtimeRepresentation 不受支持。`);
          const contribution = commands.find(command => command?.name === binding.command);
          if (typeof contribution?.insertText === 'string'
            && normalizeControlReferenceCallSnippet(contribution.insertText, binding.parameters) !== contribution.insertText) {
            diagnostics.push(`命令 ${binding.command} 的 insertText 不得给 controlRef 参数添加双引号。`);
          }
          if (typeof binding.example === 'string'
            && normalizeControlReferenceCallSnippet(binding.example, binding.parameters) !== binding.example) {
            diagnostics.push(`命令 ${binding.command} 的 example 不得给 controlRef 参数添加双引号。`);
          }
        } else if (parameter?.controlTypes !== undefined || parameter?.controlKinds !== undefined || parameter?.scope !== undefined || parameter?.runtimeRepresentation !== undefined) {
          diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 只有 controlRef 参数可以声明控件引用约束。`);
        } else if ((parameter?.type === 'wideString' || parameter?.type === 'utf8String') && looksLikeControlReferenceParameterName(parameter?.name)) {
          diagnostics.push(`命令 ${binding.command} 的参数“${parameter.name}”具有控件引用语义，必须声明为 controlRef，不能声明为文本。`);
        }
        if (parameter?.type === 'raw' && looksLikeByteSequence(parameter?.name, binding?.command, parameter?.description, binding?.encoding)) {
          diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 使用 raw 表示字节序列；请迁移为 bytes（用户可见类型“字节集”）。raw 仅保留给不透明原生类型。`);
        }
        if (parameter?.variadic !== undefined && typeof parameter.variadic !== 'boolean') {
          diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].variadic 必须是逻辑值。`);
        }
        if (parameter?.variadic === true && parameter?.type !== 'lingValue') {
          diagnostics.push(`命令 ${binding.command} 的可变参数必须声明为 lingValue。`);
        }
        if (parameter?.type === 'lingValue' && parameter?.variadic !== true) {
          diagnostics.push(`命令 ${binding.command} 的 lingValue 参数必须声明 variadic: true。`);
        }
        if (parameter?.handlerSignature !== undefined) {
          if (parameter?.type !== 'handler') {
            diagnostics.push(`命令 ${binding.command} 只有 handler 参数可以声明 handlerSignature。`);
          } else if (!parameter.handlerSignature || typeof parameter.handlerSignature !== 'object') {
            diagnostics.push(`命令 ${binding.command} 的 handlerSignature 必须是对象。`);
          } else {
            if (!Array.isArray(parameter.handlerSignature.parameterTypes)
              || parameter.handlerSignature.parameterTypes.some((item: unknown) => typeof item !== 'string' || !item.trim())) {
              diagnostics.push(`命令 ${binding.command} 的 handlerSignature.parameterTypes 必须是类型文本数组。`);
            }
            if (typeof parameter.handlerSignature.returnType !== 'string' || !parameter.handlerSignature.returnType.trim()) {
              diagnostics.push(`命令 ${binding.command} 的 handlerSignature.returnType 必须是非空类型文本。`);
            }
          }
        }
        if (looksLikeNativeCallbackParameterName(parameter?.name) && parameter?.type !== 'handler') {
          diagnostics.push(`命令 ${binding.command} 的原生回调参数“${parameter.name}”必须声明为 handler，并使用 &处理器名。`);
        }
        if (parameter?.optional !== undefined && typeof parameter.optional !== 'boolean') {
          diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].optional 必须是逻辑值。`);
        }
        if (parameter?.defaultValue !== undefined && parameter?.optional !== true) {
          diagnostics.push(`命令 ${binding.command} 只有可选参数可以声明 defaultValue。`);
        }
        if (parameter?.defaultValue !== undefined && parameter.defaultValue !== null
          && !['string', 'number', 'boolean'].includes(typeof parameter.defaultValue)) {
          diagnostics.push(`命令 ${binding.command} 的 defaultValue 只能是文本、数字、逻辑值或 null。`);
        }
      });
    }
    let optionalSeen = false;
    bindingParameters.forEach((parameter: any) => {
      if (parameter?.optional === true) optionalSeen = true;
      else if (optionalSeen && parameter?.variadic !== true) diagnostics.push(`命令 ${binding.command} 的必填参数不能位于可选参数之后。`);
    });
    const variadicIndexes = bindingParameters
      .map((parameter: any, parameterIndex: number) => parameter?.variadic === true ? parameterIndex : -1)
      .filter((parameterIndex: number) => parameterIndex >= 0);
    if (variadicIndexes.length > 1) diagnostics.push(`命令 ${binding.command} 只能声明一个可变参数。`);
    if (variadicIndexes.length === 1 && variadicIndexes[0] !== bindingParameters.length - 1) {
      diagnostics.push(`命令 ${binding.command} 的可变参数必须位于参数列表末尾。`);
    }
    validateManagedInvocation(binding, index, diagnostics);
    if (binding?.targetIds !== undefined) {
      if (!Array.isArray(binding.targetIds)) diagnostics.push(`bindings.commands[${index}].targetIds 必须是数组。`);
      else binding.targetIds.forEach((targetId: unknown) => {
        if (typeof targetId !== 'string' || (targetIds.size > 0 && !targetIds.has(targetId))) diagnostics.push(`binding 引用了不存在的 target：${String(targetId)}`);
      });
    }
  });
}

function looksLikeNativeCallbackParameterName(value: unknown): boolean {
  return typeof value === 'string' && /^(?:cb|callback|callback_fn|回调|回调函数|回调函数指针)$/iu.test(value.trim());
}

function looksLikeByteSequence(...values: unknown[]): boolean {
  const [nameValue, commandValue, descriptionValue, encodingValue] = values;
  const name = typeof nameValue === 'string' ? nameValue : undefined;
  const command = typeof commandValue === 'string' ? commandValue : undefined;
  const description = typeof descriptionValue === 'string' ? descriptionValue : undefined;
  const encoding = typeof encodingValue === 'string' ? encodingValue : undefined;
  const explicitChinese = /(?:字节集|字节序列|字节数组|二进制数据)/iu;
  const explicitAscii = /^(?:bytes|byteArray)$/iu;
  // Pointer-plus-length parameters in native bindings are commonly named
  // `title_bytes`, `data_bytes`, etc. Those are opaque ABI values, not a
  // public byte-sequence type, so only exact parameter names are considered.
  if (name && explicitChinese.test(name)) return true;
  if (name && explicitAscii.test(name.trim())) return encoding !== 'raw';
  return [command, description].some(value => Boolean(value && (explicitChinese.test(value) || /\bbyteArray\b/iu.test(value))));
}

function validateManagedInvocation(binding: any, bindingIndex: number, diagnostics: string[]): void {
  const invocation = binding?.invocation;
  if (invocation === undefined) return;
  if (!invocation || typeof invocation !== 'object') {
    diagnostics.push(`bindings.commands[${bindingIndex}].invocation 必须是对象。`);
    return;
  }
  if (invocation.kind === 'delayedCall') {
    const parameters = Array.isArray(binding.parameters) ? binding.parameters : [];
    [['delayParameterIndex', 'int'], ['handlerParameterIndex', 'handler']].forEach(([key, expectedType]) => {
      const value = invocation[key];
      if (!Number.isInteger(value) || value < 0 || value >= parameters.length) {
        diagnostics.push(`命令 ${binding.command} 的 ${key} 不是有效参数索引。`);
        return;
      }
      if (parameters[value]?.type !== expectedType) {
        diagnostics.push(`命令 ${binding.command} 的 ${key} 必须指向 ${expectedType} 参数。`);
      }
    });
    return;
  }
  if (invocation.kind !== 'managedTask') {
    diagnostics.push(`bindings.commands[${bindingIndex}].invocation.kind 必须为 managedTask 或 delayedCall。`);
    return;
  }
  if (!['submit', 'synchronized'].includes(invocation.operation)) {
    diagnostics.push(`命令 ${binding.command} 的 managedTask.operation 不受支持。`);
  }
  const parameters = Array.isArray(binding.parameters) ? binding.parameters : [];
  const indexes = [
    ['workerParameterIndex', 'handler'],
    ['progressParameterIndex', 'handler'],
    ['completionParameterIndex', 'handler'],
    ['poolParameterIndex', undefined],
    ['timeoutParameterIndex', undefined],
    ['variadicParameterIndex', 'lingValue']
  ] as const;
  indexes.forEach(([key, expectedType]) => {
    const value = invocation[key];
    if (value === undefined && !['workerParameterIndex', 'variadicParameterIndex'].includes(key)) return;
    if (!Number.isInteger(value) || value < 0 || value >= parameters.length) {
      diagnostics.push(`命令 ${binding.command} 的 ${key} 不是有效参数索引。`);
      return;
    }
    if (expectedType && parameters[value]?.type !== expectedType) {
      diagnostics.push(`命令 ${binding.command} 的 ${key} 必须指向 ${expectedType} 参数。`);
    }
  });
  if (invocation.variadicParameterIndex !== undefined && parameters[invocation.variadicParameterIndex]?.variadic !== true) {
    diagnostics.push(`命令 ${binding.command} 的 variadicParameterIndex 必须指向 variadic lingValue 参数。`);
  }
}

function looksLikeControlReferenceParameterName(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^(?:控件|控件名|组件|组件名|目标控件|父控件|浏览器|浏览器控件|表格控件|列表视图控件|图像列表|图像列表ID|属性页|菜单组件)$/u.test(value.trim());
}

function validatePathArray(values: unknown, label: string, diagnostics: string[]): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    diagnostics.push(`${label} 必须是数组。`);
    return;
  }
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !validateModuleRelativePath(value)) {
      diagnostics.push(`${label}[${index}] 不是安全的模块相对路径。`);
    }
  });
}
