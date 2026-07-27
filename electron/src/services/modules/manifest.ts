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

const CATEGORIES: LingBuilderModuleCategory[] = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'];
const MODULE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const TARGET_PLATFORMS: ModuleTargetPlatform[] = ['windows', 'linux', 'macos'];
const TARGET_ARCHES: ModuleTargetArch[] = ['win32', 'x64', 'arm64', 'any'];
const TARGET_TOOLCHAINS: ModuleTargetToolchain[] = ['msvc', 'gcc', 'clang', 'cmake', 'any'];
const BINDING_VALUE_TYPES: ModuleBindingValueType[] = ['void', 'int', 'longLong', 'double', 'bool', 'wideString', 'utf8String', 'handler', 'handle', 'raw'];
const DESIGNER_PROPERTY_TYPES = ['text', 'number', 'boolean', 'enum', 'color', 'file', 'stringList', 'columns', 'treeNodes', 'tabs', 'date', 'controlRef'];
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
      contributes.commands.forEach((command: any, index: number) => {
        if (typeof command?.name !== 'string' || !command.name.trim()) diagnostics.push(`第 ${index + 1} 个命令缺少 name。`);
        if (seen.has(command?.name)) diagnostics.push(`命令重复：${command.name}`);
        seen.add(command?.name);
        if (typeof command?.signature !== 'string' || !command.signature.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 signature。`);
        if (typeof command?.description !== 'string' || !command.description.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 description。`);
        if (command?.visibility !== undefined && !['default', 'advanced', 'internal'].includes(command.visibility)) diagnostics.push(`命令 ${command?.name || index + 1} 的 visibility 无效。`);
        if (command?.returnDescription !== undefined && (typeof command.returnDescription !== 'string' || !command.returnDescription.trim())) {
          diagnostics.push(`命令 ${command?.name || index + 1} 的 returnDescription 必须是非空文本。`);
        }
      });
    }
  }

  validateMenuContributions(contributes?.menus, contributes?.submenus, diagnostics);

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
  validateTargets(raw.targets, diagnostics);
  validateBindings(raw.bindings, contributes?.commands || [], raw.targets || [], diagnostics);

  if (diagnostics.length > 0) return { diagnostics };
  return { manifest: raw as LingBuilderModuleManifest, diagnostics };
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

function validateBindings(bindings: any, commands: any[], targets: any[], diagnostics: string[]): void {
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
  const targetIds = new Set(targets.map(target => target?.id).filter(Boolean));
  bindings.commands.forEach((binding: any, index: number) => {
    if (typeof binding?.command !== 'string' || !binding.command.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 command。`);
    if (binding?.command && commandNames.size > 0 && !commandNames.has(binding.command)) diagnostics.push(`binding 引用了未贡献的命令：${binding.command}`);
    if (typeof binding?.runtimeName !== 'string' || !binding.runtimeName.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 runtimeName。`);
    if (binding?.returnType && !BINDING_VALUE_TYPES.includes(binding.returnType)) diagnostics.push(`bindings.commands[${index}].returnType 不受支持。`);
    if (binding?.parameters !== undefined) {
      if (!Array.isArray(binding.parameters)) diagnostics.push(`bindings.commands[${index}].parameters 必须是数组。`);
      else binding.parameters.forEach((parameter: any, parameterIndex: number) => {
        if (typeof parameter?.name !== 'string' || !parameter.name.trim()) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 缺少 name。`);
        if (!BINDING_VALUE_TYPES.includes(parameter?.type)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].type 不受支持。`);
      });
    }
    if (binding?.targetIds !== undefined) {
      if (!Array.isArray(binding.targetIds)) diagnostics.push(`bindings.commands[${index}].targetIds 必须是数组。`);
      else binding.targetIds.forEach((targetId: unknown) => {
        if (typeof targetId !== 'string' || (targetIds.size > 0 && !targetIds.has(targetId))) diagnostics.push(`binding 引用了不存在的 target：${String(targetId)}`);
      });
    }
  });
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
