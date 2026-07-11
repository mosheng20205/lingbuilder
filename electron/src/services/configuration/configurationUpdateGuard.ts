import type { ConfigurationValue } from './types';
import type { WorkbenchConfigurationKey } from './workbenchConfiguration';

export interface ConfigurationEditorFlushResult {
  ok: boolean;
  diagnostics?: readonly string[];
}

export interface GuardedConfigurationUpdateOptions {
  key: WorkbenchConfigurationKey;
  value: ConfigurationValue;
  currentEditorExperienceMode: string;
  forceEditorDraftFlush?: boolean;
  flushEditorDrafts: () => Promise<ConfigurationEditorFlushResult>;
  commit: () => Promise<boolean>;
  onFlushFailure?: (diagnostics: readonly string[]) => void;
}

/** 在会卸载当前编辑器形态的设置变更前，先提交所有未失焦的新手正文草稿。 */
export async function runGuardedConfigurationUpdate(
  options: GuardedConfigurationUpdateOptions
): Promise<boolean> {
  const changesEditorMode = options.key === 'editor.experienceMode'
    && (
      options.forceEditorDraftFlush
      || (typeof options.value === 'string' && options.value !== options.currentEditorExperienceMode)
    );

  if (changesEditorMode) {
    const flushResult = await options.flushEditorDrafts();
    if (!flushResult.ok) {
      options.onFlushFailure?.(flushResult.diagnostics || ['新手代码提交失败，未切换编辑器体验模式。']);
      return false;
    }
  }

  return options.commit();
}
