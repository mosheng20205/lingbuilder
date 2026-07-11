import test from 'node:test';
import assert from 'node:assert/strict';

import { runGuardedConfigurationUpdate } from '../src/services/configuration';

test('editor experience mode configuration commits only after draft flush succeeds', async () => {
  const calls: string[] = [];
  const result = await runGuardedConfigurationUpdate({
    key: 'editor.experienceMode',
    value: 'professional',
    currentEditorExperienceMode: 'beginner',
    flushEditorDrafts: async () => { calls.push('flush'); return { ok: true }; },
    commit: async () => { calls.push('commit'); return true; }
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ['flush', 'commit']);
});

test('failed draft flush blocks editor mode persistence and reports diagnostics', async () => {
  const calls: string[] = [];
  let diagnostics: readonly string[] = [];
  const result = await runGuardedConfigurationUpdate({
    key: 'editor.experienceMode',
    value: 'native',
    currentEditorExperienceMode: 'beginner',
    flushEditorDrafts: async () => ({ ok: false, diagnostics: ['模拟草稿失败'] }),
    commit: async () => { calls.push('commit'); return true; },
    onFlushFailure: next => { diagnostics = next; }
  });
  assert.equal(result, false);
  assert.deepEqual(calls, []);
  assert.deepEqual(diagnostics, ['模拟草稿失败']);
});

test('unrelated settings and unchanged editor mode do not flush editor drafts', async () => {
  let flushes = 0;
  const createOptions = (key: 'workbench.colorTheme' | 'editor.experienceMode', value: string) => ({
    key,
    value,
    currentEditorExperienceMode: 'beginner',
    flushEditorDrafts: async () => { flushes += 1; return { ok: true }; },
    commit: async () => true
  });

  assert.equal(await runGuardedConfigurationUpdate(createOptions('workbench.colorTheme', 'light')), true);
  assert.equal(await runGuardedConfigurationUpdate(createOptions('editor.experienceMode', 'beginner')), true);
  assert.equal(flushes, 0);
});

test('resetting editor experience mode can force the same draft guard before delete', async () => {
  const calls: string[] = [];
  const result = await runGuardedConfigurationUpdate({
    key: 'editor.experienceMode',
    value: 'professional',
    currentEditorExperienceMode: 'professional',
    forceEditorDraftFlush: true,
    flushEditorDrafts: async () => { calls.push('flush'); return { ok: true }; },
    commit: async () => { calls.push('delete'); return true; }
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ['flush', 'delete']);
});
