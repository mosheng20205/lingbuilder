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

const CATEGORIES: LingBuilderModuleCategory[] = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'];
const MODULE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const TARGET_PLATFORMS: ModuleTargetPlatform[] = ['windows', 'linux', 'macos'];
const TARGET_ARCHES: ModuleTargetArch[] = ['win32', 'x64', 'arm64', 'any'];
const TARGET_TOOLCHAINS: ModuleTargetToolchain[] = ['msvc', 'gcc', 'clang', 'cmake', 'any'];
const BINDING_VALUE_TYPES: ModuleBindingValueType[] = ['void', 'int', 'longLong', 'double', 'bool', 'wideString', 'utf8String', 'controlRef', 'handler', 'lingValue', 'handle', 'bytes', 'raw'];
const CONTROL_REFERENCE_SCOPES = ['currentWindow', 'project'];
const CONTROL_REFERENCE_KINDS = ['visual', 'nonVisual', 'resource'];
const CONTROL_RUNTIME_REPRESENTATIONS = ['wideName', 'stableId', 'nativeHandle'];
const DESIGNER_PROPERTY_TYPES = ['text', 'hotkey', 'hotKey', 'number', 'boolean', 'enum', 'color', 'file', 'stringList', 'columns', 'dataGridColumns', 'dataGridRows', 'treeNodes', 'tabs', 'date', 'controlRef'];
const DESIGNER_LAYOUT_MODES = ['absolute', 'flow', 'stack', 'grid', 'dock', 'slots', 'single', 'custom'];

export function validateModuleManifest(value: unknown): { manifest?: LingBuilderModuleManifest; diagnostics: string[] } {
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

  const contributes = raw.contributes;
  if (contributes !== undefined && (!contributes || typeof contributes !== 'object')) {
    diagnostics.push('contributes 必须是对象。');
  }

  if (contributes?.commands) {
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

  if (contributes?.designerControls) {
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
        });
      });
    }
  }

  if (raw.designer !== undefined) {
    if (!raw.designer || typeof raw.designer !== 'object') diagnostics.push('designer 必须是对象。');
    else {
      if (typeof raw.designer.backend !== 'string' || !raw.designer.backend.trim()) diagnostics.push('designer.backend 不能为空。');
      if (!Number.isInteger(raw.designer.schemaVersion) || raw.designer.schemaVersion < 1) diagnostics.push('designer.schemaVersion 必须是正整数。');
      if (typeof raw.designer.path !== 'string' || !validateModuleRelativePath(raw.designer.path)) diagnostics.push('designer.path 必须是安全模块相对路径。');
      if (typeof raw.designer.sha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(raw.designer.sha256)) diagnostics.push('designer.sha256 必须是 64 位十六进制摘要。');
    }
  }

  validatePathArray(contributes?.docs?.map((doc: any) => doc?.path), 'docs.path', diagnostics);
  validatePathArray(contributes?.examples?.map((example: any) => example?.path), 'examples.path', diagnostics);
  validateDependencies(raw.dependencies, raw.id, diagnostics);
  validateBuildContribution(raw.build, raw.targets || [], diagnostics);
  validateTargets(raw.targets, diagnostics);
  validateBindings(raw.bindings, contributes?.commands || [], contributes?.types || [], raw.targets || [], diagnostics);
  validateControlReferenceSnippets(contributes?.snippets, raw.bindings?.commands, diagnostics);
  validateCompatibility(raw.compatibility, raw.id, diagnostics);

  if (diagnostics.length > 0) return { diagnostics };
  return { manifest: raw as LingBuilderModuleManifest, diagnostics };
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
  if (!compatibility || typeof compatibility !== 'object') {
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

export async function validateModuleManifestContents(
  moduleRoot: string,
  manifest: LingBuilderModuleManifest
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
    await validateReferencedEntry(moduleRoot, reference, 'file', diagnostics);
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
  diagnostics: string[]
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

function validateBindings(bindings: any, commands: any[], types: any[], targets: any[], diagnostics: string[]): void {
  if (bindings === undefined) return;
  if (!bindings || typeof bindings !== 'object') {
    diagnostics.push('bindings 必须是对象。');
    return;
  }
  if (bindings.commands === undefined) return;
  if (!Array.isArray(bindings.commands)) {
    diagnostics.push('bindings.commands 必须是数组。');
    return;
  }
  const commandNames = new Set(commands.map(command => command?.name).filter(Boolean));
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
  bindings.commands.forEach((binding: any, index: number) => {
    if (typeof binding?.command !== 'string' || !binding.command.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 command。`);
    if (binding?.command && commandNames.size > 0 && !commandNames.has(binding.command)) diagnostics.push(`binding 引用了未贡献的命令：${binding.command}`);
    if (typeof binding?.runtimeName !== 'string' || !binding.runtimeName.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 runtimeName。`);
    if (binding?.returnType && !isSupportedBindingType(binding.returnType)) diagnostics.push(`bindings.commands[${index}].returnType 不受支持；只能使用基础类型或本模块公开类型。`);
    if (hasNativeDllTarget && structuredTypeNames.has(binding?.returnType)) {
      diagnostics.push(`命令 ${binding?.command || index + 1} 不能通过原生 DLL ABI 直接返回结构化类型 ${binding.returnType}；请改用 POD 缓冲区或受管句柄。`);
    }
    if (binding?.parameters !== undefined) {
      if (!Array.isArray(binding.parameters)) diagnostics.push(`bindings.commands[${index}].parameters 必须是数组。`);
      else binding.parameters.forEach((parameter: any, parameterIndex: number) => {
        if (typeof parameter?.name !== 'string' || !parameter.name.trim()) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 缺少 name。`);
        if (!isSupportedBindingType(parameter?.type)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].type 不受支持；只能使用基础类型或本模块公开类型。`);
        if (hasNativeDllTarget && structuredTypeNames.has(parameter?.type)) {
          diagnostics.push(`命令 ${binding?.command || index + 1} 不能通过原生 DLL ABI 直接传递结构化参数 ${parameter.type}；请改用 POD 缓冲区或受管句柄。`);
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
      });
    }
    const variadicIndexes = (binding.parameters || [])
      .map((parameter: any, parameterIndex: number) => parameter?.variadic === true ? parameterIndex : -1)
      .filter((parameterIndex: number) => parameterIndex >= 0);
    if (variadicIndexes.length > 1) diagnostics.push(`命令 ${binding.command} 只能声明一个可变参数。`);
    if (variadicIndexes.length === 1 && variadicIndexes[0] !== (binding.parameters || []).length - 1) {
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
  if (!invocation || typeof invocation !== 'object' || invocation.kind !== 'managedTask') {
    diagnostics.push(`bindings.commands[${bindingIndex}].invocation.kind 必须为 managedTask。`);
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
