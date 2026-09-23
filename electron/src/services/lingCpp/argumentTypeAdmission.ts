import type { LingCppModuleContext } from '../modules/types';
import type { ControlReferenceAdmissionSource } from './controlReferenceAdmission';
import { createProjectFunctionContext } from './functionLibraryService';
import { getLingCppSemanticDiagnostics } from './languageService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from './projectDataTypeService';
import { isProjectDllCommandsFilePath } from './projectDllCommandService';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from './projectGlobalService';

export const ARGUMENT_TYPE_DIAGNOSTIC_ID_PREFIX = 'lingcpp-argument-type-';

/**
 * 模块命令实参类型门禁的唯一实现：.lcpp 源码把字节集/数值/逻辑值等已知类型
 * 传给文本型等不相容形参（lingcpp-argument-type-* error 诊断）时返回中文问题清单。
 * build.run、native.preview（native.export 经 preview 内部继承）必须共用它，
 * 与控件引用门禁同层拦截，禁止 MSVC 层的 C2665/C2660 错误恢复级联外泄给用户。
 * 本门禁不依赖设计器模型：控制台/DLL 项目同样生效。
 */
export function collectArgumentTypeAdmissionProblems(request: {
  sources: ControlReferenceAdmissionSource[];
  moduleContext?: LingCppModuleContext;
}): string[] {
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
      request.moduleContext, projectGlobals, projectTypes, projectFunctions
    );
    for (const diagnostic of diagnostics) {
      if (diagnostic.level !== 'error' || !diagnostic.id.startsWith(ARGUMENT_TYPE_DIAGNOSTIC_ID_PREFIX)) continue;
      const column = diagnostic.range?.startColumn;
      problems.push(`${source.filePath} 第 ${diagnostic.line} 行${column ? ` 第 ${column} 列` : ''}：${diagnostic.message} ${diagnostic.suggestion}`);
    }
  }
  return [...new Set(problems)];
}

/** 门禁阻断时对外统一的中文修复指引（build/preview/export 同一口径）。 */
export function formatArgumentTypeAdmissionBlock(actionLabel: string, problems: string[]): string {
  return `${actionLabel} 被阻止：模块命令实参类型与形参声明不符：\n${problems.slice(0, 12).join('\n')}\n修复方式：按诊断提示把实参转换为形参要求的类型（例如 字节集 先经 编码_字节集转文本(…, "ANSI") 转为文本，或改用 字节集_到十六进制文本(...) 直接得到十六进制文本），再重新提案或构建。`;
}
