/**
 * 构建输出路径模板的纯函数部分：无 Node 依赖，服务端与渲染层（项目构建目录对话框）
 * 共用同一份宏替换与校验规则，保证预览结果与服务端解析一致。
 */

export interface BuildPathTemplates {
  /** 构建产物根目录模板（工作区相对）。缺省 `.lingbuilder-build/$(ProjectId)/$(Platform)/$(Configuration)`。 */
  buildDirectory?: string;
  /** 可复制生成源码目录模板（工作区相对）。缺省 `generated/cpp/$(ProjectId)`。 */
  generatedSourceDirectory?: string;
}

export interface EffectiveBuildPathTemplates {
  buildDirectory: string;
  generatedSourceDirectory: string;
}

export const DEFAULT_BUILD_DIRECTORY_TEMPLATE = '.lingbuilder-build/$(ProjectId)/$(Platform)/$(Configuration)';
export const DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE = 'generated/cpp/$(ProjectId)';

export const BUILD_PATH_MACROS = ['ProjectId', 'ProjectName', 'Platform', 'Configuration'] as const;

const MACRO_PATTERN = /\$\(([^()]+)\)/gu;
/** Windows 文件名非法字符；模板按 `/` 或 `\` 分段后逐段校验。 */
const ILLEGAL_SEGMENT_CHARS = /[<>:"|?*\u0000-\u001F]/u;
/** 这些目录承担工作区元数据或版本库职责，不允许被重定向为构建输出。 */
const RESERVED_SEGMENTS = new Set(['.lingbuilder', '.git', 'node_modules']);

export interface BuildPathTemplateVariables {
  /** 已经按项目目录名规则净化（sanitizeFilename/safeId）的项目目录名。 */
  projectDirName: string;
  projectName?: string;
  platform: string;
  configuration: string;
}

/**
 * 校验并规范化一个路径模板。空值返回缺省模板；非法输入抛出中文诊断。
 * 返回值使用 `/` 分隔，便于持久化与跨平台比较。
 */
export function validateBuildPathTemplate(rawValue: string | undefined | null, fieldLabel: string, fallbackTemplate: string): string {
  const value = (rawValue ?? '').trim().replace(/[\\/]+/gu, '/');
  if (!value) return fallbackTemplate;
  if (/^[a-z]:/iu.test(value) || value.startsWith('/')) {
    throw new Error(`${fieldLabel}只支持工作区相对路径，不接受绝对路径：${rawValue}`);
  }
  const segments = value.split('/').filter(segment => segment.length > 0);
  if (segments.length === 0) return fallbackTemplate;
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error(`${fieldLabel}不允许包含“${segment}”路径段：${rawValue}`);
    }
    if (ILLEGAL_SEGMENT_CHARS.test(segment)) {
      throw new Error(`${fieldLabel}包含文件系统非法字符：${rawValue}`);
    }
    if (/[. ]$/u.test(segment)) {
      throw new Error(`${fieldLabel}的路径段不能以点或空格结尾：${rawValue}`);
    }
    if (RESERVED_SEGMENTS.has(segment.toLowerCase())) {
      throw new Error(`${fieldLabel}不允许使用保留目录名“${segment}”。`);
    }
  }
  for (const match of value.matchAll(MACRO_PATTERN)) {
    const name = match[1];
    if (!BUILD_PATH_MACROS.some(macro => macro.toLowerCase() === name.toLowerCase())) {
      throw new Error(`${fieldLabel}包含未知宏“$(${name})”。可用宏：${BUILD_PATH_MACROS.map(macro => `$(${macro})`).join('、')}。`);
    }
  }
  return segments.join('/');
}

/** 宏大小写不敏感地替换为实际值。模板必须先经过 validateBuildPathTemplate 校验。 */
export function resolveBuildPathTemplate(template: string, variables: BuildPathTemplateVariables): string {
  return template.replace(MACRO_PATTERN, (raw, name: string) => {
    switch (name.toLowerCase()) {
      case 'projectid': return variables.projectDirName;
      case 'projectname': return sanitizePathSegmentValue(variables.projectName || variables.projectDirName);
      case 'platform': return variables.platform;
      case 'configuration': return variables.configuration;
      default: return raw;
    }
  });
}

/** 合并项目覆盖与工作区配置：空字符串/未设置视为回退到下一层。 */
export function getEffectiveBuildPathTemplates(overrides?: BuildPathTemplates | null): EffectiveBuildPathTemplates {
  const projectBuildDirectory = overrides?.buildDirectory?.trim();
  const projectGeneratedSourceDirectory = overrides?.generatedSourceDirectory?.trim();
  return {
    buildDirectory: projectBuildDirectory || DEFAULT_BUILD_DIRECTORY_TEMPLATE,
    generatedSourceDirectory: projectGeneratedSourceDirectory || DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE
  };
}

/** 判断工作区相对路径是否落在给定的相对目录（或其子目录）内。目录名按 `/` 比较、大小写不敏感。 */
export function isRelativePathInsideDir(relativePath: string, relativeDir: string): boolean {
  const normalizedPath = relativePath.replace(/[\\/]+/gu, '/').replace(/\/+$/u, '').toLowerCase();
  const normalizedDir = relativeDir.replace(/[\\/]+/gu, '/').replace(/\/+$/u, '').toLowerCase();
  if (!normalizedDir) return false;
  return normalizedPath === normalizedDir || normalizedPath.startsWith(`${normalizedDir}/`);
}

const activeExcludeDirs = new Set<string>();

/**
 * 当前工作区全部构建输出目录（工作区相对路径）。由服务端在工作区绑定、
 * 构建配置或项目属性变化时刷新；搜索与 AI 索引等按目录名跳过的遍历器
 * 必须同时跳过这里登记的自定义目录，避免把生成的 C++ 收进搜索结果和 AI 上下文。
 */
export function setActiveWorkspaceBuildExcludeDirs(relativeDirs: readonly string[]): void {
  activeExcludeDirs.clear();
  for (const dir of relativeDirs) {
    const normalized = dir?.trim().replace(/[\\/]+/gu, '/').replace(/\/+$/u, '');
    if (normalized) activeExcludeDirs.add(normalized);
  }
}

export function getActiveWorkspaceBuildExcludeDirs(): readonly string[] {
  return [...activeExcludeDirs];
}

export function isPathExcludedAsBuildOutput(relativePath: string): boolean {
  for (const dir of activeExcludeDirs) {
    if (isRelativePathInsideDir(relativePath, dir)) return true;
  }
  return false;
}

export function sanitizePathSegmentValue(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/gu, '_').replace(/[. ]+$/u, '').trim() || '_';
}
