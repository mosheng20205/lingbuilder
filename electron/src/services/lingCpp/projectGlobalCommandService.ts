import { applyLingCppAstEdit } from './astEditService';
import { LingCppAstEdit, LingCppAstEditResult } from './types';

export type ProjectGlobalVariableCommandId =
  | 'lingcpp.global.add'
  | 'lingcpp.global.update'
  | 'lingcpp.global.delete'
  | 'lingcpp.constant.add'
  | 'lingcpp.constant.update'
  | 'lingcpp.constant.delete';

const expectedEditKind: Record<ProjectGlobalVariableCommandId, LingCppAstEdit['kind']> = {
  'lingcpp.global.add': 'add-global',
  'lingcpp.global.update': 'update-global',
  'lingcpp.global.delete': 'delete-global',
  'lingcpp.constant.add': 'add-constant',
  'lingcpp.constant.update': 'update-constant',
  'lingcpp.constant.delete': 'delete-constant'
};

export function executeProjectGlobalVariableCommand(
  commandId: ProjectGlobalVariableCommandId,
  sourceCode: string,
  edit: LingCppAstEdit
): LingCppAstEditResult {
  if (edit.kind !== expectedEditKind[commandId]) {
    return {
      success: false,
      sourceCode,
      diagnostics: [],
      error: `内部命令 ${commandId} 收到了不匹配的编辑操作 ${edit.kind}。`
    };
  }
  return applyLingCppAstEdit(sourceCode, edit);
}
