import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeAiBridgeStartSettings,
  readAiBridgeStartSettings,
  resolveAiBridgeStartSettingsPath,
  writeAiBridgeStartSettings
} from '../electron/aiBridgeStartSettings';

function createFakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plainText: string) => Buffer.from(`enc:${plainText}`, 'utf8'),
    decryptString: (encrypted: Buffer) => Buffer.from(encrypted).toString('utf8').slice('enc:'.length)
  };
}

test('AI Bridge start settings persist across reloads with safeStorage-encrypted token', async t => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-bridge-start-settings-'));
  t.after(() => fs.rm(userDataDir, { recursive: true, force: true }));
  const filePath = resolveAiBridgeStartSettingsPath(userDataDir);
  const safeStorage = createFakeSafeStorage();

  await writeAiBridgeStartSettings(filePath, {
    port: 17860, permission: 'yolo', lifecycle: 'workspace', token: 'my-custom-token-0123456789abcdef', externalModuleAccess: true
  }, safeStorage);

  // 落盘内容里绝不出现明文 Token。
  const raw = await fs.readFile(filePath, 'utf8');
  assert.ok(!raw.includes('my-custom-token-0123456789abcdef'), 'Token 不能明文落盘');
  assert.match(JSON.parse(raw).token.encoding, /safeStorage/u);

  const loaded = await readAiBridgeStartSettings(filePath, safeStorage);
  assert.deepEqual(loaded, {
    port: 17860, permission: 'yolo', lifecycle: 'workspace', token: 'my-custom-token-0123456789abcdef', externalModuleAccess: true
  });

  // 老版本设置文件没有该字段：必须按关闭处理，而不是 undefined 或抛错。
  const legacy = JSON.parse(raw) as Record<string, unknown>;
  delete legacy.externalModuleAccess;
  await fs.writeFile(filePath, JSON.stringify(legacy), 'utf8');
  assert.equal((await readAiBridgeStartSettings(filePath, safeStorage))?.externalModuleAccess, false);
});

test('AI Bridge start settings fall back to plain storage and reject invalid values', async t => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-bridge-start-settings-plain-'));
  t.after(() => fs.rm(userDataDir, { recursive: true, force: true }));
  const filePath = resolveAiBridgeStartSettingsPath(userDataDir);
  const safeStorage = createFakeSafeStorage(false);

  await writeAiBridgeStartSettings(filePath, {
    port: 17861, permission: 'preview', lifecycle: 'workspace', token: 'plain-fallback-token-0123456789', externalModuleAccess: false
  }, safeStorage);
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.equal(raw.token.encoding, 'plain');
  const loaded = await readAiBridgeStartSettings(filePath, createFakeSafeStorage(false));
  assert.equal(loaded?.token, 'plain-fallback-token-0123456789');

  // 加密标记但本机加密不可用：解不出即视为未设置，而不是抛错。
  await writeAiBridgeStartSettings(filePath, {
    port: 17861, permission: 'readonly', lifecycle: 'workspace', token: 'encrypted-token-0123456789abcd', externalModuleAccess: false
  }, createFakeSafeStorage(true));
  const unavailable = await readAiBridgeStartSettings(filePath, createFakeSafeStorage(false));
  assert.equal(unavailable?.token, '');

  assert.equal(normalizeAiBridgeStartSettings({ port: 70000, permission: 'preview', lifecycle: 'workspace', token: '' }), undefined);
  assert.equal(normalizeAiBridgeStartSettings({ port: 80, permission: 'preview', lifecycle: 'workspace', token: '' }), undefined);
  assert.equal(normalizeAiBridgeStartSettings({ port: 17860, permission: 'guest', lifecycle: 'workspace', token: '' }), undefined);
  assert.equal(normalizeAiBridgeStartSettings({ port: 17860, permission: 'preview', lifecycle: 'workspace', token: 'short' }), undefined);
  assert.equal(await readAiBridgeStartSettings(path.join(userDataDir, 'missing.json'), safeStorage), undefined);
});
