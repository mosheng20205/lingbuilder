import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openPathWithExplorerFallback, selectShellWorkspaceRoot } from '../electron/shellPathService';

test('renderer/active workspace takes precedence; configured env 只作冷启动兜底', () => {
  // 回归（2026-09-23）：工作区切换后 env 仍是旧值，若 configured 优先于 activeWorkspace，
  // 内嵌 Agent 运行时会拿旧 --workspace 启动，提案落进错误工作区（真机踩实）。
  assert.equal(selectShellWorkspaceRoot({
    rendererWorkspaceRoot: '',
    configuredWorkspaceRoot: 'C:\\stale-environment',
    activeWorkspace: 'C:\\workspace\\electron'
  }), 'C:\\workspace\\electron');

  assert.equal(selectShellWorkspaceRoot({
    rendererWorkspaceRoot: 'C:\\packaged-workspace',
    configuredWorkspaceRoot: 'C:\\stale-environment',
    activeWorkspace: 'C:\\stale-desktop-state'
  }), 'C:\\packaged-workspace');

  // 冷启动：renderer 与 activeWorkspace 都为空时才用 env。
  assert.equal(selectShellWorkspaceRoot({
    rendererWorkspaceRoot: '',
    configuredWorkspaceRoot: 'C:\\cold-start',
    activeWorkspace: ''
  }), 'C:\\cold-start');
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
