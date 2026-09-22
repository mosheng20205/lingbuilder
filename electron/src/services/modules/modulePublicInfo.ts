import { normalizeModulePublicInfoSearchText } from './modulePublicInfoSearch';
import { formatModulePublicType, formatModulePublicTypeSource, getModulePublicTypeKind } from './modulePublicTypeService';
import type { InstalledModule, ModuleTargetContribution } from './types';

/**
 * 模块公开信息数据层：把 manifest v2 的 contributes/targets 拍平成统一的展示条目。
 * ModuleDetailPage（主区详情页签 / 独立信息窗口共用）消费同一份收集结果，
 * 保证详情展示只有一种口径；搜索归一化与类型格式化复用既有 service。
 */

export type PublicGroupId = 'types' | 'constants' | 'commands' | 'controls' | 'snippets' | 'dependencies' | 'docs' | 'examples';
export type PublicItemKind = '类型/类' | '常量' | '命令接口' | '设计器控件' | '代码片段' | 'C++ 依赖' | '文档' | '示例';

export interface PublicInfoItem {
  id: string;
  sourceModuleId: string;
  groupId: PublicGroupId;
  kind: PublicItemKind;
  name: string;
  declaration: string;
  description: string;
  searchText: string;
  copyText?: string;
  fields?: Array<{ label: string; value: string }>;
  commandCategory?: string;
  capabilityKind?: 'single' | 'aggregate' | 'managed' | 'secureReplacement';
  officialCapability?: boolean;
}

export function collectPublicInfoItems(module: InstalledModule): PublicInfoItem[] {
  const manifest = module.manifest;
  const contributes = manifest.contributes || {};
  const bindings = manifest.bindings?.commands || [];
  const items: PublicInfoItem[] = [];

  for (const type of contributes.types || []) {
    const typeKind = getModulePublicTypeKind(type);
    const typeFields = typeKind === 'record'
      ? (type.fields || []).map(field => ({
        label: `字段 · ${field.name}`,
        value: `${field.type}${field.isArray ? '[]' : ''}${field.initialValue?.trim() ? ` = ${field.initialValue.trim()}` : ''}${field.description ? ` · ${field.description}` : ''}`
      }))
      : typeKind === 'array' && type.elementType
        ? [{ label: '元素类型', value: type.elementType }]
        : type.cppType ? [{ label: 'C++ 类型', value: type.cppType }] : [];
    items.push(createItem({
      id: `${manifest.id}:type:${type.name}`,
      sourceModuleId: manifest.id,
      groupId: 'types',
      kind: '类型/类',
      name: type.name,
      declaration: formatModulePublicType(type),
      description: type.description,
      copyText: formatModulePublicTypeSource(type),
      fields: [
        { label: '类型种类', value: typeKind === 'record' ? '公开记录' : typeKind === 'array' ? '公开数组' : '不透明类型' },
        ...typeFields
      ]
    }));
  }
  for (const constant of contributes.constants || []) {
    const valueText = typeof constant.value === 'string'
      ? `"${constant.value}"`
      : typeof constant.value === 'boolean'
        ? (constant.value ? '真' : '假')
        : String(constant.value);
    items.push(createItem({
      id: `${manifest.id}:constant:${constant.name}`,
      sourceModuleId: manifest.id,
      groupId: 'constants',
      kind: '常量',
      name: constant.name,
      declaration: `#${constant.name} = ${valueText}`,
      description: constant.description,
      copyText: `#${constant.name}`,
      fields: [
        { label: '类型', value: constant.type },
        { label: '值', value: valueText },
        { label: '源码引用', value: `#${constant.name}` },
        ...(constant.level === 'advanced' ? [{ label: '级别', value: '高级（需在设置开启显示高级 API 才进补全）' }] : [])
      ]
    }));
  }
  for (const command of contributes.commands || []) {
    const binding = bindings.find(candidate => candidate.command === command.name);
    items.push(createItem({
      id: `${manifest.id}:command:${command.name}:${command.signature}`,
      sourceModuleId: manifest.id,
      groupId: 'commands',
      kind: '命令接口',
      name: command.name,
      declaration: command.signature,
      description: command.description,
      copyText: command.insertText || command.signature,
      commandCategory: command.category,
      capabilityKind: command.capabilityKind,
      officialCapability: command.officialCapability,
      fields: [
        ...(command.category ? [{ label: '功能分类', value: command.category }] : []),
        ...(command.aliases?.length ? [{ label: '官方接口', value: command.aliases.join('、') }] : []),
        ...(command.returnType ? [{ label: '返回值', value: command.returnType }] : []),
        ...(command.returnDescription ? [{ label: '返回值说明', value: command.returnDescription }] : []),
        ...(binding ? [
          { label: 'C++ 运行时', value: binding.runtimeName },
          ...(binding.encoding ? [{ label: '编码', value: binding.encoding }] : []),
          ...(binding.parameters || []).map(parameter => ({
            label: `参数 · ${parameter.name}`,
            value: [parameter.type, parameter.description].filter(Boolean).join(' · ')
          }))
        ] : [])
      ]
    }));
  }
  for (const control of contributes.designerControls || []) {
    items.push(createItem({
      id: `${manifest.id}:control:${control.type}`,
      sourceModuleId: manifest.id,
      groupId: 'controls',
      kind: '设计器控件',
      name: control.label,
      declaration: control.type,
      description: (control.events || []).map(event => `${event.label}：${event.handlerPattern}`).join('；') || '该控件未声明事件。',
      copyText: control.type,
      fields: [
        ...(control.category ? [{ label: '工具箱分类', value: control.category }] : []),
        ...(control.nativeAdapter ? [{ label: '原生适配器', value: control.nativeAdapter }] : []),
        ...(control.events || []).map(event => ({ label: `事件 · ${event.label}`, value: event.handlerPattern }))
      ]
    }));
  }
  for (const snippet of contributes.snippets || []) {
    items.push(createItem({
      id: `${manifest.id}:snippet:${snippet.label}`,
      sourceModuleId: manifest.id,
      groupId: 'snippets',
      kind: '代码片段',
      name: snippet.label,
      declaration: snippet.insertText,
      description: snippet.description,
      copyText: snippet.insertText
    }));
  }
  for (const dependency of collectTargetDependencies(manifest.targets || [])) {
    items.push(createItem({
      id: `${manifest.id}:${dependency.id}`,
      sourceModuleId: manifest.id,
      groupId: 'dependencies',
      kind: 'C++ 依赖',
      name: dependency.label,
      declaration: dependency.value,
      description: dependency.description,
      copyText: dependency.value
    }));
  }
  for (const doc of contributes.docs || []) {
    items.push(createItem({
      id: `${manifest.id}:doc:${doc.path}`,
      sourceModuleId: manifest.id,
      groupId: 'docs',
      kind: '文档',
      name: doc.title,
      declaration: doc.path,
      description: '模块随包公开文档。',
      copyText: doc.path
    }));
  }
  for (const example of contributes.examples || []) {
    items.push(createItem({
      id: `${manifest.id}:example:${example.path}`,
      sourceModuleId: manifest.id,
      groupId: 'examples',
      kind: '示例',
      name: example.title,
      declaration: example.path,
      description: example.description || '模块随包示例源码，可直接查看引用写法。',
      copyText: example.path
    }));
  }
  return items;
}

function createItem(item: Omit<PublicInfoItem, 'searchText'>): PublicInfoItem {
  return {
    ...item,
    searchText: [
      item.kind,
      item.name,
      item.declaration,
      item.description,
      ...(item.fields || []).flatMap(field => [field.label, field.value])
    ].map(normalizeModulePublicInfoSearchText).join(' ')
  };
}

export function collectTargetDependencies(targets: ModuleTargetContribution[]) {
  return targets.flatMap(target => {
    const rows: Array<{ label: string; values: string[] }> = [
      { label: '目标', values: [`${target.id} · ${target.platform}/${target.toolchain}/${target.arch}`] },
      { label: '头文件', values: target.headers || [] },
      { label: '源码', values: target.sources || [] },
      { label: '库文件', values: target.libs || [] },
      { label: '运行时文件', values: target.runtimeFiles || [] },
      { label: '包含目录', values: target.includeDirs || [] },
      { label: '宏定义', values: target.defines || [] },
      { label: '编译选项', values: target.compileOptions || [] },
      { label: '链接选项', values: target.linkOptions || [] }
    ];
    return rows.flatMap((row, rowIndex) => row.values.map((value, valueIndex) => ({
      id: `dependency:${target.id}:${rowIndex}:${valueIndex}`,
      label: row.label,
      value,
      description: `目标 ${target.id}`
    })));
  });
}

export function getPublicInfoGroups(items: PublicInfoItem[]) {
  const definitions: Array<{ id: PublicGroupId; label: string }> = [
    { id: 'types', label: '类型/类' },
    { id: 'constants', label: '常量' },
    { id: 'commands', label: '命令接口' },
    { id: 'controls', label: '设计器控件' },
    { id: 'snippets', label: '代码片段' },
    { id: 'dependencies', label: 'C++ 依赖' },
    { id: 'docs', label: '文档' },
    { id: 'examples', label: '示例' }
  ];
  return definitions.map(group => ({
    ...group,
    items: items.filter(item => item.groupId === group.id)
  }));
}
