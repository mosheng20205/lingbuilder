import type { LingCppModuleContext } from '../modules/types';
import type { LingWindowProject } from '../windowDesigner/types';
import { createProjectFunctionContext } from './functionLibraryService';
import { getLingCppSemanticDiagnostics } from './languageService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from './projectDataTypeService';
import { isProjectDllCommandsFilePath } from './projectDllCommandService';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from './projectGlobalService';

export interface ControlReferenceAdmissionSource {
  filePath: string;
  sourceCode: string;
}

/**
 * 控件引用门禁的唯一实现：窗口项目的 .lcpp 源码引用了设计器模型里不存在的控件
 * （controlRef 缺失/歧义/越界/带引号等 error 级诊断）时返回中文问题清单。
 * propose、apply、build 三个入口必须共用它，禁止再各自复制一套判定。
 */
export function collectControlReferenceAdmissionProblems(request: {
  designerProject: LingWindowProject | undefined;
  sources: ControlReferenceAdmissionSource[];
  moduleContext?: LingCppModuleContext;
}): string[] {
  if (!request.designerProject) return [];
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
      source.sourceCode, request.designerProject, source.filePath,
      request.moduleContext, projectGlobals, projectTypes, projectFunctions,
      { suppressDesignerControlDiagnostics: false }
    );
    for (const diagnostic of diagnostics) {
      if (diagnostic.level === 'error' && diagnostic.id.startsWith('lingcpp-control-reference-')) {
        problems.push(`${source.filePath}:${diagnostic.line} ${diagnostic.message}`);
      }
    }
  }
  return [...new Set(problems)];
}

/** 门禁阻断时对外统一的中文修复指引（propose/apply/build 三处同一口径）。 */
export function formatControlReferenceAdmissionBlock(actionLabel: string, problems: string[]): string {
  return `${actionLabel} 被阻止：源码引用了窗口设计器模型中不存在的控件：\n${problems.slice(0, 12).join('\n')}\n修复方式：在 edit.propose 提案中携带 updatedDesignerProject（包含这些控件的完整设计器模型），经 edit.apply 同步布局到磁盘后再重试；若这些引用本就不该存在，请删除相关代码后重新提案。`;
}
