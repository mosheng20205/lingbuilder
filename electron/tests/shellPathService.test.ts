import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openPathWithExplorerFallback, selectShellWorkspaceRoot } from '../electron/shellPathService';

test('renderer/configured workspace takes precedence over a stale desktop workspace', () => {
  assert.equal(selectShellWorkspaceRoot({
    rendererWorkspaceRoot: '',
    configuredWorkspaceRoot: 'C:\\workspace',
    activeWorkspace: 'C:\\workspace\\electron'
  }), 'C:\\workspace');

  assert.equal(selectShellWorkspaceRoot({
    rendererWorkspaceRoot: 'C:\\packaged-workspace',
    configuredWorkspaceRoot: 'C:\\stale-environment',
    activeWorkspace: 'C:\\stale-desktop-state'
  }), 'C:\\packaged-workspace');
});

test('directory open falls back to Explorer reveal when Electron returns an error', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-shell-path-'));
  const revealed: string[] = [];

  try {
    const result = await openPathWithExplorerFallback(directory, {
      openPath: async () => 'Failed to open path',
      showItemInFolder: targetPath => revealed.push(targetPath)
    });

    assert.equal(result, '');
    assert.deepEqual(revealed, [directory]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('successful directory open does not invoke the fallback', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-shell-path-'));
  let revealCount = 0;

  try {
    const result = await openPathWithExplorerFallback(directory, {
      openPath: async () => '',
      showItemInFolder: () => { revealCount += 1; }
    });

    assert.equal(result, '');
    assert.equal(revealCount, 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('missing paths return a Chinese diagnostic', async () => {
  const result = await openPathWithExplorerFallback(path.join(os.tmpdir(), `missing-${Date.now()}`), {
    openPath: async () => '',
    showItemInFolder: () => undefined
  });

  assert.match(result, /^路径不存在或无法打开：/u);
});
