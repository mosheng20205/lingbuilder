import type { LingEmbeddedResource, LingWindowProject } from './types';

/**
 * 项目级内嵌资源（构建期 RCDATA 打进 EXE，运行期「资源_*」命令按逻辑名读取）。
 *
 * 设计要点：
 * - PE 资源是扁平的 key → 二进制块，没有目录概念；文件夹靠"每条文件一条资源 + 生成的映射表"表达。
 * - 资源号用 2301 起（101 图标 / 2101+ 内嵌站点 / 2201+ 项目 DLL 段均已占用；
 *   2001+ 曾是旧「窗口内嵌文件」段，该链路已迁移到本机制，仅保留兼容读取）。
 * - 源文件先进 rc 时会被复制成 ASCII 名 `res-0007.bin`，彻底避开 rc.exe 对中文路径与资源名的编码坑；
 *   中文只出现在生成的映射表里（编译期宽字符串，无编码风险）。
 * - 中英文字段顺序不可随意调整：applyEmbeddedResourceLimits 依赖 resourceId = 起始号 + 下标。
 */
export const EMBEDDED_RESOURCE_ID_BASE = 2301;

/** 内嵌资源模块 ID（命令、运行时、设计器面板与项目清单共用同一门禁）。 */
export const EMBEDDED_RESOURCE_MODULE_ID = 'lingbuilder.resource.embed';

/** 条目数上限：PE 数字资源号空间足够，这里只是防止误选整个 node_modules 之类。 */
export const EMBEDDED_RESOURCE_LIMIT = 4096;

/** 单文件上限：zip/素材包里放个大文件是合理需求，比内嵌站点/内嵌文件的 32MB 放宽。 */
export const EMBEDDED_RESOURCE_MAX_FILE_BYTES = 256 * 1024 * 1024;

/** 总量告警阈值（超出只提示，不阻断）。 */
export const EMBEDDED_RESOURCE_TOTAL_WARN_BYTES = 256 * 1024 * 1024;

/** 内嵌资源在构建目录内的归档目录（rc 与资源写入两侧共用）。 */
export const EMBEDDED_RESOURCE_DIRECTORY = 'resources';

export interface EmbeddedResourceSpec {
  /** 逻辑名（工作区内相对路径原样）。 */
  name: string;
  /** 源文件（工作区内相对路径）。 */
  file: string;
  /** 真时启动释放到 %TEMP%。 */
  extract: boolean;
  /** RC 资源号。 */
  resourceId: number;
  /** 进 rc 用的 ASCII 归档名（相对源码目录）。 */
  resourceFileName: string;
}

/** 逻辑名允许的字符集（正斜杠分隔的相对路径）；导入侧与校验侧必须共用同一份定义。 */
export const EMBEDDED_RESOURCE_NAME_RE = /^[\p{L}\p{N}_$./@()\[\] {}#+,-]+$/u;

/** 单个逻辑名是否合法（非空、路径安全、字符集允许）。 */
export function isEmbeddedResourceLogicalName(value: string): boolean {
  const name = String(value || '').trim().replace(/\\/gu, '/');
  if (!name || /^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(name) || name.split('/').includes('..')) return false;
  if (/["\u0000-\u001f]/u.test(name)) return false;
  return EMBEDDED_RESOURCE_NAME_RE.test(name);
}

/** 源文件是否可内嵌：必须有扩展名（rc 归档名与逻辑名都依赖扩展名）。 */
export function isEmbeddableResourceSourceFile(value: string): boolean {
  const file = String(value || '').trim().replace(/\\/gu, '/');
  return Boolean(file) && !file.endsWith('/') && /\.\w+$/u.test(file);
}

/** 纯模型校验：路径安全、名称可用、条目数。返回中文诊断（空数组表示通过）。 */
export function validateEmbeddedResources(project: LingWindowProject): string[] {
  const resources = project.embeddedResources || [];
  const diagnostics: string[] = [];
  if (resources.length > EMBEDDED_RESOURCE_LIMIT) {
    diagnostics.push(`内嵌资源条目超过上限（最多 ${EMBEDDED_RESOURCE_LIMIT} 条，当前 ${resources.length} 条）。`);
  }
  const seen = new Set<string>();
  const pushUnsafe = (value: string, label: string) => {
    const normalized = String(value || '').trim().replace(/\\/gu, '/');
    if (!normalized) {
      diagnostics.push(`内嵌资源的${label}不能为空。`);
      return true;
    }
    if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(normalized) || normalized.split('/').includes('..') || /["\u0000-\u001f]/u.test(normalized)) {
      diagnostics.push(`内嵌资源的${label}必须位于工作区内的相对路径，且不能包含引号或控制字符：${value}`);
      return true;
    }
    return false;
  };
  resources.forEach((resource, index) => {
    const unsafeFile = pushUnsafe(resource.file, `源文件路径（第 ${index + 1} 条）`);
    if (!unsafeFile && !/\.\w+$/u.test(String(resource.file))) {
      diagnostics.push(`内嵌资源的源文件需要带扩展名（第 ${index + 1} 条）：${resource.file}`);
    }
    const name = String(resource.name || '').trim().replace(/\\/gu, '/');
    if (pushUnsafe(resource.name, `逻辑名（第 ${index + 1} 条）`)) return;
    if (!EMBEDDED_RESOURCE_NAME_RE.test(name)) {
      diagnostics.push(`内嵌资源的逻辑名包含不支持的字符（第 ${index + 1} 条）：${resource.name}`);
    }
    if (seen.has(name)) diagnostics.push(`内嵌资源的逻辑名重复：${name}`);
    seen.add(name);
  });
  return diagnostics;
}

/** 解析为构建期规格（资源号按声明顺序分配）；模型非法时抛错，由调用方转成诊断。 */
export function getEmbeddedResourceSpecs(project: LingWindowProject): EmbeddedResourceSpec[] {
  const diagnostics = validateEmbeddedResources(project);
  if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));
  return (project.embeddedResources || []).map((resource: LingEmbeddedResource, index) => {
    const file = String(resource.file || '').trim().replace(/\\/gu, '/');
    const name = String(resource.name || '').trim().replace(/\\/gu, '/');
    const extension = (file.split('/').pop() || '').split('.').pop() || 'bin';
    return {
      name,
      file,
      extract: resource.extract === true,
      resourceId: EMBEDDED_RESOURCE_ID_BASE + index,
      resourceFileName: `${EMBEDDED_RESOURCE_DIRECTORY}/res-${String(index + 1).padStart(4, '0')}.${extension.replace(/[^A-Za-z0-9]/gu, '') || 'bin'}`
    };
  });
}

/** 生成运行期映射表用：模型非法时返回空数组（诊断已由生成阶段的守卫统一给出）。 */
export function getEmbeddedResourceSpecsOrEmpty(project: LingWindowProject): EmbeddedResourceSpec[] {
  try {
    return getEmbeddedResourceSpecs(project);
  } catch {
    return [];
  }
}

/** rc 行：先 #define 再引用（数字资源号），路径按 rc 所在目录解析且反斜杠双写。 */
export function buildEmbeddedResourceRcLines(specs: EmbeddedResourceSpec[]): string[] {
  return specs.flatMap(spec => {
    const symbol = `ID_RCDATA_LINGBUILDER_RESOURCE_${spec.resourceId}`;
    const relative = spec.resourceFileName.replace(/\//gu, '\\\\');
    return [`#define ${symbol} ${spec.resourceId}`, `${symbol} RCDATA "${relative}"`];
  });
}

/** C++ 映射表行（逻辑名 + 资源号 + 是否释放），生成代码按逻辑名查找。 */
export function buildEmbeddedResourceTableLines(specs: EmbeddedResourceSpec[]): string[] {
  return specs.map(spec =>
    `    { ${spec.resourceId}u, ${spec.extract ? 'true' : 'false'}, L"${spec.name.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}" },`);
}
