import type { InstalledModule } from './types';
import { formatModulePublicType } from './modulePublicTypeService';

export type ModuleFamilyFeatureTier = 'standard' | 'advanced';

export interface ModuleFamilyFeatureDefinition {
  moduleId: string;
  label: string;
  description: string;
  tier: ModuleFamilyFeatureTier;
}

export interface ModuleFamilyDefinition {
  id: string;
  displayName: string;
  rootModuleId: string;
  assetModuleIds: readonly string[];
  managerDescription: string;
  featurePanelDescription: string;
  features: readonly ModuleFamilyFeatureDefinition[];
}

export const FBRO_MODULE_FAMILY: ModuleFamilyDefinition = {
  id: 'lingbuilder.fbro',
  displayName: 'FBro',
  rootModuleId: 'lingbuilder.fbro.browser',
  assetModuleIds: ['lingbuilder.fbro.sdk'],
  managerDescription: '统一管理 FBro 浏览器、事件、会话、传输、受管对象及可选高级能力；SDK 资产由构建链自动管理。',
  featurePanelDescription: '标准功能随主模块一键启用；自动化、高级网络和 VIP 指纹需要单独确认。',
  features: [
    {
      moduleId: 'lingbuilder.fbro.browser',
      label: '基础',
      description: '浏览器创建、导航、缩放、页面查找、基础指纹配置和设计器控件。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.fbro.events',
      label: '事件',
      description: 'UTF-16 JSON 事件包、同步决策和动态处理器绑定。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.fbro.session',
      label: '会话',
      description: '隔离 Profile、Cookie、缓存与会话管理。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.fbro.transfer',
      label: '下载与传输',
      description: '下载、打印、PDF、文件对话框和截图任务。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.fbro.objects',
      label: '对象',
      description: '任务、缓冲、Value、Dictionary、List、Image、Certificate 等受管对象。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.fbro.automation',
      label: '自动化',
      description: '异步 JavaScript 任务和类型化 Frame 自动化操作。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.fbro.network',
      label: '高级网络',
      description: '需要显式启用的代理和认证高级接口。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.fbro.vip',
      label: 'VIP 指纹',
      description: '需要有效授权的结构化 VIP 指纹能力。',
      tier: 'advanced'
    }
  ]
};

export const CEF3_MODULE_FAMILY: ModuleFamilyDefinition = {
  id: 'lingbuilder.cef3',
  displayName: 'CEF3',
  rootModuleId: 'lingbuilder.cef3.browser',
  assetModuleIds: ['lingbuilder.cef3.sdk'],
  managerDescription: '统一管理 CEF3 浏览器、事件、会话、传输、受管对象及可选高级能力；CEF SDK 资产由构建链自动管理。',
  featurePanelDescription: '基础、事件、会话、下载与传输和对象随主模块一键启用；自动化、网络、开发者工具、视图和平台能力需要单独确认。',
  features: [
    {
      moduleId: 'lingbuilder.cef3.browser',
      label: '基础',
      description: '浏览器创建、导航、页面控制、JavaScript 调用、事件绑定和设计器控件。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.cef3.events',
      label: '事件',
      description: '浏览器事件数据、同步决策和处理器引用绑定。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.cef3.session',
      label: '会话',
      description: '独立 RequestContext、Preference、Cookie、缓存、证书和连接管理。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.cef3.transfer',
      label: '下载与传输',
      description: '下载、打印及相关受控传输能力。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.cef3.objects',
      label: '对象',
      description: '任务、缓冲、Value、Dictionary、List、Image、NavigationEntry 和证书等受管对象。',
      tier: 'standard'
    },
    {
      moduleId: 'lingbuilder.cef3.automation',
      label: '自动化',
      description: '异步 JavaScript 任务及后续 DOM、V8 自动化能力。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.cef3.network',
      label: '网络',
      description: '实例级代理及后续请求、响应扩展能力。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.cef3.devtools',
      label: '开发者工具',
      description: '受设计器策略控制的 DevTools 与调试入口。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.cef3.views',
      label: '视图',
      description: 'Chrome Runtime 独立窗口与后续 Views 能力。',
      tier: 'advanced'
    },
    {
      moduleId: 'lingbuilder.cef3.platform',
      label: '平台',
      description: 'CEF 版本、Chrome 实验信息和平台工具能力。',
      tier: 'advanced'
    }
  ]
};

export const OPENCV_MODULE_FAMILY: ModuleFamilyDefinition = {
  id: 'lingbuilder.opencv.family',
  displayName: 'OpenCV',
  rootModuleId: 'lingbuilder.opencv',
  assetModuleIds: ['lingbuilder.opencv.sdk'],
  managerDescription: '统一提供 OpenCV 图像处理和缺口候选分析；x64 SDK 资产由构建链自动校验和管理。',
  featurePanelDescription: '首版固定使用 OpenCV 4.14.0、Windows MSVC x64 和 CPU 运行时。',
  features: [{
    moduleId: 'lingbuilder.opencv',
    label: '图像处理与缺口分析',
    description: '图像句柄、预处理、模板匹配、轮廓分析和单/双缺口候选。',
    tier: 'standard'
  }]
};

export const MODULE_FAMILIES: readonly ModuleFamilyDefinition[] = [
  CEF3_MODULE_FAMILY,
  FBRO_MODULE_FAMILY,
  OPENCV_MODULE_FAMILY
];

export const FBRO_STANDARD_MODULE_IDS = FBRO_MODULE_FAMILY.features
  .filter(feature => feature.tier === 'standard')
  .map(feature => feature.moduleId);

export const FBRO_ADVANCED_MODULE_IDS = FBRO_MODULE_FAMILY.features
  .filter(feature => feature.tier === 'advanced')
  .map(feature => feature.moduleId);

export const CEF3_STANDARD_MODULE_IDS = getModuleFamilyStandardModuleIds(CEF3_MODULE_FAMILY);
export const CEF3_ADVANCED_MODULE_IDS = getModuleFamilyAdvancedModuleIds(CEF3_MODULE_FAMILY);

const HIDDEN_FAMILY_MODULE_IDS = new Set(MODULE_FAMILIES.flatMap(family => [
  ...family.features
    .map(feature => feature.moduleId)
    .filter(moduleId => moduleId !== family.rootModuleId),
  ...family.assetModuleIds
]));

export function isModuleHiddenByFamily(moduleId: string): boolean {
  return HIDDEN_FAMILY_MODULE_IDS.has(moduleId);
}

export function getModuleFamilyDefinition(moduleId: string): ModuleFamilyDefinition | undefined {
  return MODULE_FAMILIES.find(family => (
    family.rootModuleId === moduleId
    || family.assetModuleIds.includes(moduleId)
    || family.features.some(feature => feature.moduleId === moduleId)
  ));
}

export function getModuleFamilyModules(
  modules: readonly InstalledModule[],
  family: ModuleFamilyDefinition
): InstalledModule[] {
  const byId = new Map(modules.map(module => [module.manifest.id, module]));
  return family.features
    .map(feature => byId.get(feature.moduleId))
    .filter((module): module is InstalledModule => Boolean(module));
}

export function getModuleFamilyFeatureDefinition(
  family: ModuleFamilyDefinition,
  moduleId: string
): ModuleFamilyFeatureDefinition | undefined {
  return family.features.find(feature => feature.moduleId === moduleId);
}

export function getModuleFamilyStandardModuleIds(family: ModuleFamilyDefinition): string[] {
  return family.features
    .filter(feature => feature.tier === 'standard')
    .map(feature => feature.moduleId);
}

export function getModuleFamilyAdvancedModuleIds(family: ModuleFamilyDefinition): string[] {
  return family.features
    .filter(feature => feature.tier === 'advanced')
    .map(feature => feature.moduleId);
}

export function isModuleFamilyStandardEnabled(
  family: ModuleFamilyDefinition,
  modules: readonly InstalledModule[]
): boolean {
  const enabledIds = new Set(modules.filter(module => module.isEnabledForProject).map(module => module.manifest.id));
  return getModuleFamilyStandardModuleIds(family).every(moduleId => enabledIds.has(moduleId));
}

export function isAnyModuleFamilyFeatureEnabled(modules: readonly InstalledModule[]): boolean {
  return modules.some(module => module.isEnabledForProject);
}

export function getModuleFamilySearchText(
  family: ModuleFamilyDefinition,
  modules: readonly InstalledModule[]
): string {
  return modules.flatMap(module => {
    const contributes = module.manifest.contributes;
    return [
      module.manifest.id,
      module.manifest.name,
      module.manifest.description,
      ...(module.manifest.tags || []),
      getModuleFamilyFeatureDefinition(family, module.manifest.id)?.label || '',
      ...(contributes?.commands || []).flatMap(command => [
        command.name,
        command.signature,
        command.description,
        command.returnType,
        ...(command.aliases || [])
      ]),
      ...(contributes?.types || []).flatMap(type => [
        type.name,
        type.description,
        type.cppType,
        type.elementType,
        formatModulePublicType(type),
        ...(type.fields || []).flatMap(field => [field.name, field.type, field.description])
      ]),
      ...(contributes?.designerControls || []).flatMap(control => [control.label, control.type, control.category])
    ];
  }).join(' ').toLocaleLowerCase('zh-CN');
}

export function getFbroFamilyModules(modules: readonly InstalledModule[]): InstalledModule[] {
  return getModuleFamilyModules(modules, FBRO_MODULE_FAMILY);
}

export function getFbroFeatureDefinition(moduleId: string): ModuleFamilyFeatureDefinition | undefined {
  return getModuleFamilyFeatureDefinition(FBRO_MODULE_FAMILY, moduleId);
}

export function isFbroStandardFamilyEnabled(modules: readonly InstalledModule[]): boolean {
  return isModuleFamilyStandardEnabled(FBRO_MODULE_FAMILY, modules);
}

export function isAnyFbroFamilyFeatureEnabled(modules: readonly InstalledModule[]): boolean {
  return isAnyModuleFamilyFeatureEnabled(modules);
}

export function countModuleCommands(modules: readonly InstalledModule[]): number {
  return modules.reduce((total, module) => total + (module.manifest.contributes?.commands?.length || 0), 0);
}

export function getFbroFamilySearchText(modules: readonly InstalledModule[]): string {
  return getModuleFamilySearchText(FBRO_MODULE_FAMILY, modules);
}
