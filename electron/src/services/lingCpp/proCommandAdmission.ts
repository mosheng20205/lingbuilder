import type { LingCppModuleContext } from '../modules/types';
import { formatProCommandHint, PRO_COMMAND_DIAGNOSTIC_ID_PREFIX } from './proCommandAccess';
import type { ControlReferenceAdmissionSource } from './controlReferenceAdmission';
import { createProjectFunctionContext } from './functionLibraryService';
import { getLingCppSemanticDiagnostics } from './languageService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from './projectDataTypeService';
import { isProjectDllCommandsFilePath } from './projectDllCommandService';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from './projectGlobalService';
import { readProAccessStateFile } from '../modules/proAccessStateFile';

/**
 * Pro 专享命令门禁的唯一实现（与控件引用、实参类型门禁同层同口径）：
 * .lcpp 源码调用 access:'pro' 命令而当前无生效 Pro 授权时，返回中文问题清单。
 * build.run、native.preview（native.export 经 preview 内部继承）必须共用它；
 * IDE 本地 F5 构建走生成器 blockingDiagnostics 的同一诊断族（lingcpp-pro-command-*）。
 * 授权状态在构建时从主进程落盘的 pro-access-state.json 读取（登录/退出/巡检实时刷新）。
 * edit.propose / edit.apply 保持宽松不调用本门禁（写码不拦、构建才拦）。
 */
export function collectProCommandAdmissionProblems(request: {
  sources: ControlReferenceAdmissionSource[];
  moduleContext?: LingCppModuleContext;
  /** 缺省时从落盘文件读取（与 IDE 主进程同机）；测试可直接注入。 */
  proAuthorization?: { active: boolean; endsAt?: string | null; offlineUntil?: string | null } | null;
}): string[] {
  const proAuthorization = request.proAuthorization !== undefined ? request.proAuthorization : readProAccessStateFile();
  if (proAuthorization?.active) return [];
  const normalized = request.sources.map(source => ({
    filePath: source.filePath.replace(/\\/g, '/').trim(),
    sourceCode: source.sourceCode
  }));
  const globalSource = normalized.find(source => isProjectGlobalsFilePath(source.filePath));
  const typeSource = normalized.find(source => isProjectDataTypesFilePath(source.filePath));
  const projectGlobals = globalSource ? createProjectGlobalContext(globalSource.filePath, globalSource.sourceCode) : undefined;
  const projectTypes = typeSource ? createProjectTypeContext(typeSource.filePath, typeSource.sourceCode) : undefined;
  const projectFunctions = createProjectFunctionContext(normalized.map(source => ({ ...source, language: 'lingcpp' as const })));
  const problems: string[] = [];
  for (const source of normalized) {
    if (!source.filePath.toLocaleLowerCase().endsWith('.lcpp')) continue;
    if (isProjectGlobalsFilePath(source.filePath) || isProjectDataTypesFilePath(source.filePath) || isProjectDllCommandsFilePath(source.filePath)) continue;
    const diagnostics = getLingCppSemanticDiagnostics(
      source.sourceCode, undefined, source.filePath,
      request.moduleContext, projectGlobals, projectTypes, projectFunctions,
      { proCommandAuthorization: proAuthorization, proCommandEnforce: true }
    );
    for (const diagnostic of diagnostics) {
      if (!diagnostic.id.startsWith(PRO_COMMAND_DIAGNOSTIC_ID_PREFIX)) continue;
      const column = diagnostic.range?.startColumn;
      problems.push(`${source.filePath} 第 ${diagnostic.line} 行${column ? ` 第 ${column} 列` : ''}：${diagnostic.message} ${diagnostic.suggestion}`);
    }
  }
  return [...new Set(problems)];
}

/** 门禁阻断时对外统一的中文修复指引（build/preview/export 同一口径）。 */
export function formatProCommandAdmissionBlock(actionLabel: string, problems: string[]): string {
  return `${actionLabel} 被阻止：源码使用了 Pro 专享命令而当前账号未开通 Pro：\n${problems.slice(0, 12).join('\n')}\n${formatProCommandHint()}\n修复方式：开通 Pro 后重新构建；或把这些命令调用替换为免费命令。`;
}
