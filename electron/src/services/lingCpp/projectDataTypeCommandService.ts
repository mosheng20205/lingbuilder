import { applyLingCppAstEdit } from './astEditService';
import { LingCppAstEdit, LingCppAstEditResult } from './types';

export type ProjectDataTypeCommandId =
  | 'lingcpp.dataType.add'
  | 'lingcpp.dataType.update'
  | 'lingcpp.dataType.delete'
  | 'lingcpp.dataType.move'
  | 'lingcpp.dataField.add'
  | 'lingcpp.dataField.update'
  | 'lingcpp.dataField.delete'
  | 'lingcpp.dataField.move';

const expectedKinds: Record<ProjectDataTypeCommandId, LingCppAstEdit['kind'][]> = {
  'lingcpp.dataType.add': ['add-data-type'],
  'lingcpp.dataType.update': ['update-data-type'],
  'lingcpp.dataType.delete': ['delete-data-type'],
  'lingcpp.dataType.move': ['move-data-type'],
  'lingcpp.dataField.add': ['add-data-field'],
  'lingcpp.dataField.update': ['update-data-field'],
  'lingcpp.dataField.delete': ['delete-data-field'],
  'lingcpp.dataField.move': ['move-data-field']
};

export function executeProjectDataTypeCommand(
  commandId: ProjectDataTypeCommandId,
  sourceCode: string,
  edit: LingCppAstEdit
): LingCppAstEditResult {
  if (!expectedKinds[commandId].includes(edit.kind)) {
    return { success: false, sourceCode, diagnostics: [], error: `命令 ${commandId} 不接受 ${edit.kind} 编辑。` };
  }
  return applyLingCppAstEdit(sourceCode, edit);
}
