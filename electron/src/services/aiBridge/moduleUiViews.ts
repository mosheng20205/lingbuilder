import fs from 'fs/promises';
import path from 'path';
import type {
  InstalledModule,
  LingBuilderModuleManifest,
  ModuleDesignerControlContribution
} from '../modules/types';

/** 控件概览条数上限；new_emoji 当前 93 个，其他后端远小于该值。 */
export const DESIGNER_CONTROL_SUMMARY_MAX = 120;
/** 单次请求返回的控件详情条数上限，避免整包属性/事件表撑爆外部 AI 上下文。 */
export const DESIGNER_CONTROL_DETAIL_MAX = 6;
/** 示例正文返回上限（字符）；超出即截断并提示改用 file.read。 */
export const UI_EXAMPLE_MAX_CHARS = 24000;
/** 附带真实调用示例的命令数上限；整模块全量查询时不附带，避免响应膨胀。 */
export const DEMO_EXAMPLE_MAX_COMMANDS = 400;

const DEMO_INDEX_RELATIVE_PATH = path.join('examples', 'module-demos', 'module-demo-index.json');
const DEMO_CATALOG_FILE_NAME = '模块命令清单.json';
const DEMO_CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const DEMO_EXAMPLE_MAX_CHARS = 320;
const UI_RECIPE_ROOT = 'examples/ui-recipes';

export interface DesignerControlSummary {
  type: string;
  namespacedType: string;
  label: string;
  category?: string;
  backend?: string;
  isContainer: boolean;
  isVisual: boolean;
  lingCppType?: string;
  createCommand?: string;
  parentKinds?: string[];
  propertyCount: number;
  eventCount: number;
  contentProperty?: string;
}

export interface DesignerControlDetail {
  type: string;
  namespacedType: string;
  label: string;
  backend?: string;
  isContainer: boolean;
  isVisual: boolean;
  layout?: ModuleDesignerControlContribution['layout'];
  defaultProps: Record<string, unknown>;
  properties: Array<{
    key: string;
    label: string;
    type: string;
    defaultValue?: unknown;
    options?: Array<{ value: string; label: string }>;
    description?: string;
    group?: string;
    level?: string;
  }>;
  events: Array<{
    name: string;
    label: string;
    handlerPattern: string;
    parameters: Array<{ name: string; type: string; description?: string }>;
  }>;
  codeCreation?: {
    lingCppType: string;
    createCommand: string;
    createParameters: Array<{ name: string; type: string; role?: string; optional?: boolean }>;
    lookupByTagTextCommand?: string;
    lookupByTagIntegerCommand?: string;
    validCommand?: string;
    parentKinds?: string[];
  };
}

export interface UiExampleDescriptor {
  title: string;
  path: string;
  source: 'module' | 'ui-recipes';
  description?: string;
  scenario?: string;
  commands?: string[];
  controls?: string[];
  notes?: string[];
}

export interface DemoCorpus {
  projectId: string;
  moduleName: string;
  commandCount: number;
  controlCount: number;
  groupCount: number;
  sourceRoot: string;
  packageName: string;
  /** 语料生成时间；与当前模块清单命令数不一致时说明语料已过期。 */
  generatedAt: string;
  /** 按命令名索引的真实调用（参数顺序正确，非占位符）。 */
  invocations: Map<string, string>;
}

interface DemoIndexEntry {
  moduleId?: string;
  moduleName?: string;
  projectId?: string;
  commandCount?: number;
  controlCount?: number;
  groupCount?: number;
  sourceRoot?: string;
  packageName?: string;
}

let demoCorpusCache: { key: string; corpus: DemoCorpus | null } | null = null;

function normalizeFilter(value: string): string {
  return value.trim().toLowerCase();
}

function controlNames(control: ModuleDesignerControlContribution): string[] {
  return [control.type, control.namespacedType || '', control.label, control.runtimeControl?.lingCppType || '']
    .map(item => item.toLowerCase());
}

export function buildDesignerControlSummaries(manifest: LingBuilderModuleManifest): DesignerControlSummary[] {
  return (manifest.contributes?.designerControls || []).map(control => ({
    type: control.type,
    namespacedType: control.namespacedType || `${manifest.id}/${control.type}`,
    label: control.label,
    category: control.category,
    backend: control.backend,
    isContainer: control.isContainer === true,
    isVisual: control.isVisual !== false,
    lingCppType: control.runtimeControl?.lingCppType,
    createCommand: control.runtimeControl?.createCommand,
    parentKinds: control.runtimeControl?.parentKinds,
    propertyCount: (control.properties || []).length,
    eventCount: (control.events || []).length,
    contentProperty: pickContentProperty(control)
  }));
}

export function buildDesignerControlDetails(
  manifest: LingBuilderModuleManifest,
  filter: string
): { details: DesignerControlDetail[]; matched: number } {
  const needle = normalizeFilter(filter);
  const controls = (manifest.contributes?.designerControls || []).filter(control => !needle
    || controlNames(control).some(name => name.includes(needle)));
  return {
    matched: controls.length,
    details: controls.slice(0, DESIGNER_CONTROL_DETAIL_MAX).map(control => ({
      type: control.type,
      namespacedType: control.namespacedType || `${manifest.id}/${control.type}`,
      label: control.label,
      backend: control.backend,
      isContainer: control.isContainer === true,
      isVisual: control.isVisual !== false,
      layout: control.layout,
      defaultProps: control.defaultProps || {},
      properties: (control.properties || []).map(property => ({
        key: property.key,
        label: property.label,
        type: property.type,
        defaultValue: property.defaultValue,
        options: property.options,
        description: property.description,
        group: property.group,
        level: property.level
      })),
      events: (control.events || []).map(event => ({
        name: event.name,
        label: event.label,
        handlerPattern: event.handlerPattern,
        parameters: (event.parameters || []).map(parameter => ({
          name: parameter.name,
          type: parameter.type,
          description: parameter.description
        }))
      })),
      codeCreation: control.runtimeControl ? {
        lingCppType: control.runtimeControl.lingCppType,
        createCommand: control.runtimeControl.createCommand,
        createParameters: (control.runtimeControl.createParameters || []).map(parameter => ({
          name: parameter.name,
          type: parameter.type,
          role: parameter.role,
          optional: parameter.optional === true
        })),
        lookupByTagTextCommand: control.runtimeControl.lookupByTagTextCommand,
        lookupByTagIntegerCommand: control.runtimeControl.lookupByTagIntegerCommand,
        validCommand: control.runtimeControl.validCommand,
        parentKinds: control.runtimeControl.parentKinds
      } : undefined
    }))
  };
}

/** 模块清单声明的示例 + 工作区 ui-recipes 语料合并；两条来源各自的 path 口径不同。 */
export async function collectUiExamples(
  module: InstalledModule,
  workspaceRoot: string
): Promise<UiExampleDescriptor[]> {
  const declared: UiExampleDescriptor[] = (module.manifest.contributes?.examples || []).map(example => ({
    title: example.title,
    path: example.path,
    source: 'module' as const,
    description: example.description
  }));
  const recipes = await readRecipeIndex(workspaceRoot, module.manifest.id);
  return [...declared, ...recipes];
}

export async function readUiExampleContent(
  module: InstalledModule,
  workspaceRoot: string,
  example: UiExampleDescriptor
): Promise<{ content: string; truncated: boolean; absolutePath: string }> {
  const root = example.source === 'module'
    ? path.resolve(module.installPath)
    : path.resolve(workspaceRoot, UI_RECIPE_ROOT, module.manifest.id);
  const resolved = await resolveInsideRoot(root, example.path);
  if (!resolved) throw new Error(`示例文件不存在或无法从模块目录读取：${example.path}`);
  const bytes = await fs.readFile(resolved);
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`示例文件不是合法 UTF-8 文本：${example.path}`);
  }
  const truncated = content.length > UI_EXAMPLE_MAX_CHARS;
  return {
    content: truncated ? content.slice(0, UI_EXAMPLE_MAX_CHARS) : content,
    truncated,
    absolutePath: resolved
  };
}

export function matchUiExample(examples: UiExampleDescriptor[], filter: string): UiExampleDescriptor | undefined {
  const needle = normalizeFilter(filter);
  if (!needle) return undefined;
  const index = Number(needle);
  if (Number.isInteger(index) && index >= 1 && index <= examples.length) return examples[index - 1];
  return examples.find(example => normalizeFilter(example.title).includes(needle)
    || normalizeFilter(example.path).includes(needle)
    || normalizeFilter(example.scenario || '').includes(needle)
    || (example.commands || []).some(command => normalizeFilter(command).includes(needle)));
}

/**
 * 逐命令真实调用来自 `npm run module:demos` 生成的模块演示语料；
 * 该语料只在工作区存在 examples/module-demos 时可用（源码仓库/开发工作区），缺失时调用方按无示例处理。
 */
export async function loadDemoCorpus(workspaceRoot: string, moduleId: string): Promise<DemoCorpus | null> {
  const indexPath = path.resolve(workspaceRoot, DEMO_INDEX_RELATIVE_PATH);
  let indexStat;
  try {
    indexStat = await fs.stat(indexPath);
  } catch {
    return null;
  }
  const cacheKey = `${moduleId}|${indexPath}|${indexStat.mtimeMs}|${indexStat.size}`;
  if (demoCorpusCache?.key === cacheKey) return demoCorpusCache.corpus;
  const corpus = await readDemoCorpus(workspaceRoot, indexPath, moduleId);
  demoCorpusCache = { key: cacheKey, corpus };
  return corpus;
}

async function readDemoCorpus(workspaceRoot: string, indexPath: string, moduleId: string): Promise<DemoCorpus | null> {
  let index: { modules?: DemoIndexEntry[] };
  try {
    index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as { modules?: DemoIndexEntry[] };
  } catch {
    return null;
  }
  const entry = (index.modules || []).find(item => item.moduleId === moduleId);
  if (!entry?.sourceRoot) return null;
  const catalogPath = path.resolve(workspaceRoot, entry.sourceRoot, DEMO_CATALOG_FILE_NAME);
  let stat;
  try {
    stat = await fs.stat(catalogPath);
  } catch {
    stat = null;
  }
  const invocations = new Map<string, string>();
  let generatedAt = '';
  if (stat && stat.isFile() && stat.size <= DEMO_CATALOG_MAX_BYTES) {
    try {
      const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8')) as {
        generatedAt?: string;
        commands?: Array<{ name?: string; demoInvocation?: string }>;
      };
      generatedAt = typeof catalog.generatedAt === 'string' ? catalog.generatedAt.slice(0, 10) : '';
      for (const command of catalog.commands || []) {
        if (!command.name || !command.demoInvocation) continue;
        invocations.set(command.name, command.demoInvocation.slice(0, DEMO_EXAMPLE_MAX_CHARS));
      }
    } catch {
      // 清单损坏时只保留演示项目元信息，不让 module.info 整体失败。
    }
  }
  return {
    projectId: entry.projectId || '',
    moduleName: entry.moduleName || '',
    commandCount: entry.commandCount || 0,
    controlCount: entry.controlCount || 0,
    groupCount: entry.groupCount || 0,
    sourceRoot: entry.sourceRoot,
    packageName: entry.packageName || '',
    generatedAt,
    invocations
  };
}

async function readRecipeIndex(workspaceRoot: string, moduleId: string): Promise<UiExampleDescriptor[]> {
  const dir = path.resolve(workspaceRoot, UI_RECIPE_ROOT, moduleId);
  const indexPath = path.join(dir, 'recipes.json');
  let raw: { recipes?: Array<Record<string, unknown>> };
  try {
    raw = JSON.parse(await fs.readFile(indexPath, 'utf8')) as { recipes?: Array<Record<string, unknown>> };
  } catch {
    return [];
  }
  return (raw.recipes || [])
    .map(recipe => {
      const file = typeof recipe.file === 'string' ? recipe.file : '';
      if (!file) return null;
      const descriptor: UiExampleDescriptor = {
        title: typeof recipe.title === 'string' ? recipe.title : file,
        path: file,
        source: 'ui-recipes',
        description: typeof recipe.scenario === 'string' ? recipe.scenario : undefined,
        scenario: typeof recipe.scenario === 'string' ? recipe.scenario : undefined,
        commands: toStringArray(recipe.commands),
        controls: toStringArray(recipe.controls),
        notes: toStringArray(recipe.notes)
      };
      return descriptor;
    })
    .filter((item): item is UiExampleDescriptor => Boolean(item));
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(item => typeof item === 'string' && item.trim()) as string[];
  return items.length ? items : undefined;
}

function pickContentProperty(control: ModuleDesignerControlContribution): string | undefined {
  const keys = Object.keys(control.defaultProps || {});
  return keys.find(key => key === 'content') || keys.find(key => key === 'text') || keys.find(key => key === 'items');
}

async function resolveInsideRoot(root: string, relativePath: string): Promise<string | null> {
  const segments = relativePath.replace(/\\/gu, '/').split('/').filter(segment => segment && segment !== '.');
  if (segments.includes('..')) return null;
  const candidate = path.resolve(root, ...segments);
  try {
    const realRoot = await fs.realpath(root);
    const realCandidate = await fs.realpath(candidate);
    const relative = path.relative(realRoot, realCandidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const stat = await fs.stat(realCandidate);
    return stat.isFile() ? realCandidate : null;
  } catch {
    return null;
  }
}
