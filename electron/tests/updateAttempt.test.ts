import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearUpdateAttemptMarker,
  evaluateUpdateAttempt,
  formatUpdateAttemptFailureMessage,
  planUpdateAttemptStartup,
  readUpdateAttemptMarker,
  updateAttemptMarkerPath,
  writeUpdateAttemptMarker,
  type UpdateAttemptMarker
} from '../electron/updateAttemptService';
import { UpdateDownloadService } from '../electron/updateDownloadService';

const sampleMarker = (overrides: Partial<UpdateAttemptMarker> = {}): UpdateAttemptMarker => ({
  version: '0.8.21',
  installerPath: 'C:\\Users\\a\\AppData\\Roaming\\lingbuilder-electron\\updates\\LingBuilder-0.8.21-x64.exe',
  sha256: 'a'.repeat(64),
  at: '2026-10-13T09:25:24.000Z',
  ...overrides
});

test('updateAttemptMarkerPath 落在 userData 根目录且文件名固定', () => {
  const joined = updateAttemptMarkerPath('C:\\Users\\a\\AppData\\Roaming\\lingbuilder-electron');
  assert.equal(joined, path.join('C:\\Users\\a\\AppData\\Roaming\\lingbuilder-electron', 'update-install-attempt.json'));
});

test('标记读写回环：合法内容原样读回，损坏/缺失/缺版本返回 null', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-update-attempt-'));
  try {
    const marker = sampleMarker();
    await writeUpdateAttemptMarker(root, marker);
    assert.deepEqual(await readUpdateAttemptMarker(root), marker);

    await fs.writeFile(updateAttemptMarkerPath(root), '{oops', 'utf-8');
    assert.equal(await readUpdateAttemptMarker(root), null);

    await fs.writeFile(updateAttemptMarkerPath(root), JSON.stringify({ installerPath: 'x' }), 'utf-8');
    assert.equal(await readUpdateAttemptMarker(root), null);

    await clearUpdateAttemptMarker(root);
    assert.equal(await readUpdateAttemptMarker(root), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('evaluateUpdateAttempt：无标记不 pending；版本一致才算生效', () => {
  assert.deepEqual(evaluateUpdateAttempt('0.8.21', null), { pending: false });
  const applied = evaluateUpdateAttempt('0.8.21', sampleMarker());
  assert.equal(applied.pending, true);
  assert.equal(applied.tookEffect, true);
  const failed = evaluateUpdateAttempt('0.8.20', sampleMarker());
  assert.equal(failed.pending, true);
  assert.equal(failed.tookEffect, false);
  assert.equal(failed.version, '0.8.21');
});

test('planUpdateAttemptStartup：无标记正常清理；已生效清标记；未生效进入保留验证分支', () => {
  assert.equal(planUpdateAttemptStartup('0.8.20', null), 'cleanup-only');
  assert.equal(planUpdateAttemptStartup('0.8.21', sampleMarker()), 'clear-marker-and-cleanup');
  assert.equal(planUpdateAttemptStartup('0.8.20', sampleMarker()), 'verify-retained');
});

test('formatUpdateAttemptFailureMessage：含版本号、占用根因与处置指引；无保留包时不再承诺一键重试', () => {
  const withRetained = formatUpdateAttemptFailureMessage(sampleMarker());
  assert.match(withRetained, /v0\.8\.21/);
  assert.match(withRetained, /MCP 宿主/);
  assert.match(withRetained, /LingBuilder-0\.8\.21-x64\.exe/);
  assert.match(withRetained, /退出所有 AI 客户端/);
  const withoutRetained = formatUpdateAttemptFailureMessage(sampleMarker({ installerPath: '' }), '');
  assert.match(withoutRetained, /重新下载安装包/);
  assert.doesNotMatch(withoutRetained, /可直接点击安装按钮重试/);
});

test('UpdateDownloadService.adoptRetainedInstaller：恢复 ready 状态供界面一键重装', async () => {
  const progressEvents: unknown[] = [];
  const service = new UpdateDownloadService({
    updatesDir: path.join(os.tmpdir(), 'lingbuilder-update-attempt-adopt'),
    isPackaged: false,
    onProgress: progress => progressEvents.push(progress)
  });
  service.adoptRetainedInstaller('D:\\kept\\LingBuilder-0.8.21-x64.exe', '0.8.21');
  assert.ok(progressEvents.length >= 1, '收养时必须经 onProgress 广播，界面才能感知 ready 恢复');
  const status = service.status();
  assert.equal(status.state, 'ready');
  assert.equal(status.version, '0.8.21');
  assert.equal(status.installerPath, 'D:\\kept\\LingBuilder-0.8.21-x64.exe');
  // ready 状态必须可再次进入 install（install() 只认 state==='ready' 的 installerPath）。
  const installResult = await service.install();
  assert.equal(installResult.ok, false, '演示环境没有真实安装包文件，install 应因找不到文件失败而不是状态不对');
  assert.match(installResult.error || '', /找不到已下载的更新包/);
});
