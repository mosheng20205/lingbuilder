import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  inspectCliIntegration,
  pathContainsDirectory
} from '../electron/cliIntegrationService';

test('CLI PATH detection uses exact case-insensitive entries', () => {
  assert.equal(pathContainsDirectory('C:\\Tools;C:\\Program Files\\LingBuilder', 'c:\\program files\\lingbuilder\\'), true);
  assert.equal(pathContainsDirectory('C:\\Program Files\\LingBuilder-old', 'C:\\Program Files\\LingBuilder'), false);
});

test('packaged CLI reports ready only when launcher, version, and PATH are valid', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cli-status-'));
  const launcherPath = path.join(root, 'lingbuilder.cmd');
  try {
    await fs.writeFile(launcherPath, '@echo off\r\n', 'utf8');
    const status = await inspectCliIntegration({
      packaged: true,
      installDirectory: root,
      launcherPath,
      userPath: `C:\\Tools;${root}`,
      runVersion: async () => 'LingBuilder CLI 0.2.0'
    });
    assert.equal(status.state, 'ready');
    assert.equal(status.commandAvailable, true);
    assert.equal(status.version, 'LingBuilder CLI 0.2.0');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('packaged CLI distinguishes missing PATH and failed runtime checks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cli-status-'));
  const launcherPath = path.join(root, 'lingbuilder.cmd');
  try {
    await fs.writeFile(launcherPath, '@echo off\r\n', 'utf8');
    const missingPath = await inspectCliIntegration({
      packaged: true,
      installDirectory: root,
      launcherPath,
      userPath: 'C:\\Tools',
      runVersion: async () => 'LingBuilder CLI 0.2.0'
    });
    assert.equal(missingPath.state, 'path-missing');
    assert.equal(missingPath.commandAvailable, false);

    const failed = await inspectCliIntegration({
      packaged: true,
      installDirectory: root,
      launcherPath,
      userPath: root,
      runVersion: async () => { throw new Error('进程启动失败'); }
    });
    assert.equal(failed.state, 'check-failed');
    assert.match(failed.detail, /进程启动失败/u);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

