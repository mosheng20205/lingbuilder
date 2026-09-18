import type { LingEmbeddedResource, LingWindowModel, LingWindowProject } from './types';
import {
  getEmbeddedResourceSpecsOrEmpty,
  isEmbeddedResourceLogicalName,
  isEmbeddableResourceSourceFile,
  type EmbeddedResourceSpec
} from './embeddedResourceService';

/**
 * 旧「窗口内嵌文件」（LingWindowModel.embeddedFiles，启动释放到 %TEMP%）→ 项目级内嵌资源迁移。
 *
 * 迁移口径：
 * - 每条旧内嵌文件变成 `{ name: 释放名, file, extract: true }`，释放目录仍是
 *   `%TEMP%\lingbuilder-embedded\<工程ID>\`，因此已有中文代码里拼的路径继续有效。
 * - 释放名缺省取源文件基名；释放名与已有内嵌资源逻辑名冲突时保留已有条目并给出中文诊断，
 *   不静默覆盖用户后加的清单。
 * - 迁移是幂等的：迁移后窗口上不再保留 embeddedFiles 字段，重复调用不产生新条目。
 *
 * 为什么必须迁移：旧链路把内嵌文件的生成挂在「窗口图标显示」开关上
 * （iconStyle 为 none/system 时整批内嵌文件被静默丢弃），迁移到项目级内嵌资源后
 * 资源的 rc 行与图标完全解耦。
 */
export interface EmbeddedFileMigrationEntry {
  windowTitle: string;
  name: string;
}

export interface EmbeddedFileMigrationResult {
  project: LingWindowProject;
  /** 本次新增的内嵌资源条目。 */
  migrated: EmbeddedFileMigrationEntry[];
  /** 已存在同逻辑名且指向同一文件，直接复用（不重复添加）。 */
  reused: string[];
  /** 名称冲突等无法自动迁移的条目。 */
  diagnostics: string[];
  /** 需要提醒用户的弃用说明（有旧字段才产生）。 */
  deprecation: string[];
}

const LEGACY_EXTRACT_NAME_RE = /^[A-Za-z0-9._-]{1,128}$/u;

/**
 * 构建管线取内嵌资源规格的唯一入口：先迁移旧字段再解析。
 * 生成器与物化必须消费同一份（迁移后的）规格，否则 rc 里引用的是 2301 段归档名，
 * 而物化只按旧 2001 段写文件，rc.exe 会因为找不到 `resources/res-0001.*` 直接失败。
 */
export function getEmbeddedResourceSpecsForBuild(project: LingWindowProject): EmbeddedResourceSpec[] {
  return getEmbeddedResourceSpecsOrEmpty(migrateLegacyEmbeddedFiles(project).project);
}

export function hasLegacyEmbeddedFiles(project: LingWindowProject | undefined | null): boolean {
  return Boolean(project?.windows?.some(window => (window.embeddedFiles || []).length > 0));
}

export function migrateLegacyEmbeddedFiles(project: LingWindowProject): EmbeddedFileMigrationResult {
  const windows = project?.windows || [];
  if (!hasLegacyEmbeddedFiles(project)) {
    return { project, migrated: [], reused: [], diagnostics: [], deprecation: [] };
  }
  const existing: LingEmbeddedResource[] = [...(project.embeddedResources || [])];
  const byName = new Map(existing.map(resource => [normalizeName(resource.name), resource]));
  const migrated: EmbeddedFileMigrationEntry[] = [];
  const reused: string[] = [];
  const diagnostics: string[] = [];
  let migratedCount = 0;
  const legacyWindows = new Set<string>();

  const nextWindows: LingWindowModel[] = windows.map(window => {
    const specs = window.embeddedFiles || [];
    if (specs.length === 0) return window;
    legacyWindows.add(window.title);
    for (const spec of specs) {
      const file = String(spec.file || '').trim().replace(/\\/gu, '/');
      if (!file) {
        diagnostics.push(`窗口“${window.title}”有内嵌文件缺少源文件路径，已跳过。`);
        continue;
      }
      if (!isEmbeddableResourceSourceFile(file)) {
        diagnostics.push(`窗口“${window.title}”的内嵌文件 ${file} 没有扩展名，无法迁移到内嵌资源，请手工处理。`);
        continue;
      }
      const baseName = file.split('/').pop() || file;
      const requested = String(spec.extractName || baseName).trim() || baseName;
      // 旧释放名限制更严；不满足时退回基名，避免把非法字符带进逻辑名。
      const name = LEGACY_EXTRACT_NAME_RE.test(requested) && !requested.startsWith('.') ? requested : baseName;
      if (!isEmbeddedResourceLogicalName(name)) {
        diagnostics.push(`窗口“${window.title}”的内嵌文件 ${file} 无法生成合法逻辑名（${name}），请在设计器「内嵌资源」面板中手工添加。`);
        continue;
      }
      const previous = byName.get(normalizeName(name));
      if (previous) {
        if (String(previous.file || '').trim().replace(/\\/gu, '/') === file) {
          reused.push(name);
          continue;
        }
        diagnostics.push(`内嵌文件 ${file} 的释放名 ${name} 与已有内嵌资源冲突（已存在 ${previous.file}）；请在设计器「内嵌资源」面板中改名后重新构建。`);
        continue;
      }
      const entry: LingEmbeddedResource = { name, file, extract: true };
      existing.push(entry);
      byName.set(normalizeName(name), entry);
      migrated.push({ windowTitle: window.title, name });
      migratedCount += 1;
    }
    // 旧字段整体移除：迁移后模型里只保留项目级 embeddedResources。
    const migrated_Window = { ...window };
    delete migrated_Window.embeddedFiles;
    return migrated_Window;
  });

  const deprecation = legacyWindows.size > 0
    ? [...legacyWindows].map(title => `窗口“${title}”仍使用已弃用的「内嵌文件」清单（embeddedFiles）；已迁移为项目内嵌资源并按原路径启动释放${migratedCount > 0 ? `（本次新增 ${migratedCount} 条）` : ''}，请保存项目以写回新的清单格式。`)
    : [];
  return {
    project: { ...project, windows: nextWindows, embeddedResources: existing },
    migrated,
    reused,
    diagnostics,
    deprecation
  };
}

function normalizeName(value: string): string {
  return String(value || '').trim().replace(/\\/gu, '/').toLowerCase();
}
