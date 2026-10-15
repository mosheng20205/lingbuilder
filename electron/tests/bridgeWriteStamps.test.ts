import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  BRIDGE_WRITE_STAMP_MAX_ENTRIES,
  BRIDGE_WRITE_STAMP_RELATIVE_PATH,
  BRIDGE_WRITE_STAMP_TTL_MS,
  collectBridgeWriteOrigins,
  parseBridgeWriteStampEntries,
  readBridgeWriteStampEntries,
  recordBridgeWriteStamps
} from '../src/services/files/bridgeWriteStampService';

function versionOf(content: string): string {
  const buffer = Buffer.from(content, 'utf8');
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}:${buffer.byteLength}`;
}

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-bridge-stamps-'));
}

test('Bridge 写入印章：记录后按版本哈希命中 bridgeOrigins', async () => {
  const workspaceRoot = await createTempWorkspace();
  const designerVersion = versionOf('{"written":"by-bridge"}\n');
  const sourceVersion = versionOf('类 Main\n结束类\n');
  assert.equal(await recordBridgeWriteStamps(workspaceRoot, [
    { path: '.lingbuilder/projects/demo/window-designer.json', version: designerVersion },
    { path: 'src/demo/Main.lcpp', version: sourceVersion }
  ], 'edit.apply'), true);

  const origins = await collectBridgeWriteOrigins(workspaceRoot, {
    '.lingbuilder/projects/demo/window-designer.json': designerVersion,
    'src/demo/Main.lcpp': sourceVersion
  });
  assert.equal(origins['.lingbuilder/projects/demo/window-designer.json'] !== undefined, true);
  assert.equal(origins['src/demo/Main.lcpp'] !== undefined, true);

  // 用户在 AI 写完后又手动改过（哈希不匹配）→ 不豁免。
  const afterManualEdit = await collectBridgeWriteOrigins(workspaceRoot, {
    '.lingbuilder/projects/demo/window-designer.json': versionOf('手动改过')
  });
  assert.deepEqual(afterManualEdit, {});
});

test('Bridge 写入印章：TTL 过期不命中，重写同路径替换旧条目并剪掉过期记录', async () => {
  const workspaceRoot = await createTempWorkspace();
  const now = 1_700_000_000_000;
  await recordBridgeWriteStamps(workspaceRoot, [
    { path: 'a.json', version: 'sha256:old:1' },
    { path: 'b.lcpp', version: 'sha256:old:2' }
  ], 'edit.apply', now - BRIDGE_WRITE_STAMP_TTL_MS - 1);
  // 全部过期 → 命中为空。
  assert.deepEqual(await collectBridgeWriteOrigins(workspaceRoot, { 'a.json': 'sha256:old:1' }, now), {});
  // 新写入同路径时旧条目被替换，过期且不同路径的旧条目被剪掉。
  await recordBridgeWriteStamps(workspaceRoot, [{ path: 'a.json', version: 'sha256:new:1' }], 'edit.apply', now);
  const stored = await readBridgeWriteStampEntries(workspaceRoot);
  assert.deepEqual(stored.map(entry => entry.path), ['a.json']);
  assert.equal(stored[0].version, 'sha256:new:1');
});

test('Bridge 写入印章：条目数封顶，损坏印章文件按空处理，空记录不落盘', async () => {
  const workspaceRoot = await createTempWorkspace();
  const now = 1_700_000_000_000;
  const bulk = Array.from({ length: BRIDGE_WRITE_STAMP_MAX_ENTRIES + 20 }, (_, index) => ({
    path: `file-${index}.lcpp`,
    version: `sha256:v${index}:1`
  }));
  await recordBridgeWriteStamps(workspaceRoot, bulk, 'edit.apply', now);
  const stored = await readBridgeWriteStampEntries(workspaceRoot);
  assert.equal(stored.length, BRIDGE_WRITE_STAMP_MAX_ENTRIES);

  await fs.writeFile(path.join(workspaceRoot, BRIDGE_WRITE_STAMP_RELATIVE_PATH), '{{{not-json', 'utf8');
  assert.deepEqual(await readBridgeWriteStampEntries(workspaceRoot), []);
  assert.deepEqual(parseBridgeWriteStampEntries({ schemaVersion: 3, writes: [] }), []);

  const emptyWorkspace = await createTempWorkspace();
  assert.equal(await recordBridgeWriteStamps(emptyWorkspace, [], 'edit.apply'), true);
  await assert.rejects(() => fs.access(path.join(emptyWorkspace, BRIDGE_WRITE_STAMP_RELATIVE_PATH)), /ENOENT/u);
});
