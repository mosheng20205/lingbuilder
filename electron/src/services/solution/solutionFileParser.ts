/**
 * Visual Studio 解决方案（.sln）文本解析器。
 *
 * 只做确定性文本解析，不依赖 MSBuild：提取项目条目（名称 / GUID / 相对路径）、
 * ProjectSection(ProjectDependencies) 依赖、以及 ProjectConfigurationPlatforms 中
 * 每个项目的可用“配置|平台”。供“导入现有工程”把 .sln 展开为多个解决方案项目。
 */

export interface SolutionFileProjectEntry {
  /** 项目显示名（sln 中 Project 行的第二段）。 */
  name: string;
  /** 项目 GUID（大写、含花括号）。 */
  guid: string;
  /** 工程文件相对 .sln 所在目录的路径（保留原始分隔符，通常为反斜杠）。 */
  relativePath: string;
  /** 依赖的项目 GUID 列表（大写、含花括号），来自 ProjectDependencies。 */
  dependencies: string[];
  /** 该项目在 ProjectConfigurationPlatforms 中出现过的“配置|平台”列表。 */
  configPlatforms: string[];
}

export interface ParsedSolutionFile {
  /** 仅保留工程文件为 .vcxproj 的项目（过滤解决方案文件夹与其他语言项目）。 */
  projects: SolutionFileProjectEntry[];
  /** 解决方案级“配置|平台”列表（GlobalSection(SolutionConfigurationPlatforms)）。 */
  solutionConfigurations: string[];
  /** 解析过程中的中文告警（跳过的项目、无法识别的行等），不会阻断导入。 */
  warnings: string[];
}

const PROJECT_LINE = /^Project\("([^"]+)"\)\s*=\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]+)"\s*$/;
const DEPENDENCY_LINE = /^\s*(\{[0-9A-Fa-f-]+\})\s*=\s*(?:\{[0-9A-Fa-f-]+\})\s*$/;
const SOLUTION_CONFIG_LINE = /^\s*([^\s=][^=]*?)\s*=\s*\S+\s*$/;
const ACTIVE_CFG_LINE = /^\s*(\{[0-9A-Fa-f-]+\})\.(.+?)\.ActiveCfg\s*=\s*(.+?)\s*$/;

function normalizeGuid(value: string): string {
  return value.trim().toUpperCase();
}

function normalizePlatform(configPlatform: string): string {
  return configPlatform.trim().replace(/\s+/gu, '');
}

export function parseSolutionFile(content: string): ParsedSolutionFile {
  const normalized = content.replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n');
  const lines = normalized.split('\n');
  const projects: SolutionFileProjectEntry[] = [];
  const solutionConfigurations: string[] = [];
  const warnings: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    const projectMatch = PROJECT_LINE.exec(line);
    if (!projectMatch) {
      index += 1;
      continue;
    }
    const [, , name, relativePath, guid] = projectMatch;
    const dependencies: string[] = [];
    index += 1;
    // 读取 Project 块内部，直到 EndProject；仅关心 ProjectSection(ProjectDependencies)。
    let inDependencies = false;
    while (index < lines.length) {
      const inner = lines[index]!;
      if (/^\s*EndProject\s*$/u.test(inner)) {
        index += 1;
        break;
      }
      if (/ProjectSection\(ProjectDependencies\)/u.test(inner)) {
        inDependencies = true;
        index += 1;
        continue;
      }
      if (inDependencies && /^\s*EndProjectSection\s*$/u.test(inner)) {
        inDependencies = false;
        index += 1;
        continue;
      }
      if (inDependencies) {
        const dependencyMatch = DEPENDENCY_LINE.exec(inner);
        if (dependencyMatch?.[1]) dependencies.push(normalizeGuid(dependencyMatch[1]));
        else if (inner.trim()) warnings.push(`无法识别的依赖行（项目 ${name}）：“${inner.trim()}”。`);
      }
      index += 1;
    }
    projects.push({
      name: (name || '').trim(),
      guid: normalizeGuid(guid || ''),
      relativePath: (relativePath || '').trim(),
      dependencies,
      configPlatforms: []
    });
  }

  // GlobalSection(SolutionConfigurationPlatforms) 与 ProjectConfigurationPlatforms：
  // 独立从头扫描，项目块消费行不影响这里的解析。
  let inSolutionConfigs = false;
  let inProjectConfigs = false;
  const platformByGuid = new Map<string, Set<string>>();
  for (let globalIndex = 0; globalIndex < lines.length; globalIndex += 1) {
    const line = lines[globalIndex]!;
    if (/GlobalSection\(SolutionConfigurationPlatforms\)/u.test(line)) {
      inSolutionConfigs = true;
      continue;
    }
    if (/GlobalSection\(ProjectConfigurationPlatforms\)/u.test(line)) {
      inProjectConfigs = true;
      continue;
    }
    if (/^\s*EndGlobalSection\s*$/u.test(line)) {
      inSolutionConfigs = false;
      inProjectConfigs = false;
      continue;
    }
    if (inSolutionConfigs) {
      const configMatch = SOLUTION_CONFIG_LINE.exec(line);
      if (configMatch?.[1]) solutionConfigurations.push(normalizePlatform(configMatch[1]));
    }
    if (inProjectConfigs) {
      const activeMatch = ACTIVE_CFG_LINE.exec(line);
      if (activeMatch?.[1] && activeMatch[2] && activeMatch[3]) {
        const guid = normalizeGuid(activeMatch[1]);
        const platform = normalizePlatform(activeMatch[3]);
        let bucket = platformByGuid.get(guid);
        if (!bucket) {
          bucket = new Set<string>();
          platformByGuid.set(guid, bucket);
        }
        bucket.add(platform);
      }
    }
  }

  const kept: SolutionFileProjectEntry[] = [];
  for (const project of projects) {
    const lowerPath = project.relativePath.toLowerCase();
    if (!lowerPath.endsWith('.vcxproj')) {
      warnings.push(`已跳过非 Visual C++ 项目：${project.name || project.relativePath}。`);
      continue;
    }
    project.configPlatforms = [...(platformByGuid.get(project.guid) || [])].sort((left, right) => left.localeCompare(right));
    kept.push(project);
  }

  return { projects: kept, solutionConfigurations, warnings };
}

/** 从“配置|平台”列表中提取平台集合（如 Win32 / x64）。 */
export function extractPlatforms(configPlatforms: readonly string[]): string[] {
  const platforms = new Set<string>();
  for (const entry of configPlatforms) {
    const separator = entry.lastIndexOf('|');
    if (separator > 0) platforms.add(entry.slice(separator + 1).trim());
  }
  return [...platforms].sort((left, right) => left.localeCompare(right));
}
