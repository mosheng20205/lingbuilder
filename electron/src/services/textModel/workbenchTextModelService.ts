import { disposeMonacoTextModel, MonacoTextModelLike } from './monacoTextModelAdapter';
import { TextModelService } from './textModelService';
import { TextEditHistory } from './textEditHistory';
import { normalizeTextModelFilePath, TextModelIdentity } from './types';

export type WorkbenchTextModel = MonacoTextModelLike & {
  uri?: { toString?: () => string };
  getFullModelRange?: () => unknown;
  getOffsetAt?: (position: { lineNumber: number; column: number }) => number;
  pushStackElement?: () => void;
  setValue?: (value: string) => void;
};

/**
 * Renderer-session model registry shared by the workbench and every Monaco
 * surface. Models survive tab and experience-mode switches, but explicit file
 * deletion/workspace teardown releases them through the service lifecycle.
 */
export const workbenchTextModelService = new TextModelService<WorkbenchTextModel, TextEditHistory>({
  disposeModel: model => {
    disposeMonacoTextModel(model);
  },
  disposeHistory: history => history.dispose()
});

export function getOrCreateWorkbenchTextHistory(
  identity: TextModelIdentity,
  initialValue: string
): TextEditHistory {
  const record = workbenchTextModelService.ensure(identity);
  if (record.history) return record.history;
  const history = new TextEditHistory(initialValue);
  const attached = workbenchTextModelService.attachHistoryIfCurrent({
    modelId: record.modelId,
    generation: record.generation
  }, history);
  if (!attached) throw new Error('文本模型已切换，无法创建撤销历史。');
  return history;
}

export function disposeWorkbenchTextModelsForSource(identity: TextModelIdentity): number {
  const sourcePath = normalizeTextModelFilePath(identity.filePath);
  const nativePrefix = nativePreviewPrefix(sourcePath);
  const records = workbenchTextModelService.list().filter(record => (
    record.identity.workspaceId === identity.workspaceId
    && record.identity.projectId === identity.projectId
    && (record.identity.filePath === sourcePath || record.identity.filePath.startsWith(nativePrefix))
  ));
  records.forEach(record => workbenchTextModelService.dispose(record.identity));
  return records.length;
}

export function renameWorkbenchTextModelsForSource(
  source: TextModelIdentity,
  target: TextModelIdentity
): number {
  const sourcePath = normalizeTextModelFilePath(source.filePath);
  const targetPath = normalizeTextModelFilePath(target.filePath);
  const sourceNativePrefix = nativePreviewPrefix(sourcePath);
  const targetNativePrefix = nativePreviewPrefix(targetPath);
  const records = workbenchTextModelService.list().filter(record => (
    record.identity.workspaceId === source.workspaceId
    && record.identity.projectId === source.projectId
    && (record.identity.filePath === sourcePath || record.identity.filePath.startsWith(sourceNativePrefix))
  ));
  records.forEach(record => {
    const nextFilePath = record.identity.filePath === sourcePath
      ? targetPath
      : `${targetNativePrefix}${record.identity.filePath.slice(sourceNativePrefix.length)}`;
    const targetIdentity = { ...record.identity, filePath: nextFilePath };
    const conflict = workbenchTextModelService.get(targetIdentity);
    if (conflict && conflict.modelId !== record.modelId) workbenchTextModelService.dispose(targetIdentity);
    workbenchTextModelService.rename(record.identity, targetIdentity);
  });
  return records.length;
}

function nativePreviewPrefix(sourcePath: string): string {
  return `__native_preview__/${sourcePath}/`;
}
