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

/**
 * 配置变更串行化队列。PATCH 响应携带服务器全量快照并由 applyConfigurationSnapshot 整体回放，
 * 两个变更并发在途时服务器端读改写交错，后返回的旧快照会覆盖先落盘的新状态
 * （2026-10-18 实锤：拖宽保存与显隐切换并发，刚折叠的侧栏被旧快照复活）。同类变更必须排队。
 */
export function createConfigurationMutationQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return task => {
    const run = tail.catch(() => undefined).then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}
