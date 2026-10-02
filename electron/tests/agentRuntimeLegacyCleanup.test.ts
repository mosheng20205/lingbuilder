import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeLegacyAgentRuntimeArtifacts } from '../electron/agentRuntimeLegacyCleanup';

async function createTempRoot(prefix: string): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), `agent-runtime-cleanup-${prefix}-`));
}

test('清理随包归档、旧散文件树、已释放运行时与加密模型配置', async () => {
  const resources = await createTempRoot('res');
  const userData = await createTempRoot('user');
  try {
    await writeFile(path.join(resources, 'agent-runtime.tar'), 'tar');
    await writeFile(path.join(resources, 'agent-runtime.json'), '{}');
    await mkdir(path.join(resources, 'dsh'), { recursive: true });
    await mkdir(path.join(resources, 'node'), { recursive: true });
    await writeFile(path.join(resources, 'keep.txt'), 'keep');
    await mkdir(path.join(userData, 'agent-runtime', 'profiles'), { recursive: true });
    await mkdir(path.join(userData, 'agent-runtime-bundle'), { recursive: true });
    await mkdir(path.join(userData, 'credentials'), { recursive: true });
    await writeFile(path.join(userData, 'credentials', 'agent-provider-settings.json'), '{}');
    await writeFile(path.join(userData, 'credentials', 'cloud-refresh-token.bin'), 'token');

    const result = await removeLegacyAgentRuntimeArtifacts({ resourcesPath: resources, userDataPath: userData, delayMs: 0 });

    assert.equal(result.problems.length, 0);
    assert.equal(result.removed.length, 7);
    for (const missing of [
      path.join(resources, 'agent-runtime.tar'),
      path.join(resources, 'agent-runtime.json'),
      path.join(resources, 'dsh'),
      path.join(resources, 'node'),
      path.join(userData, 'agent-runtime'),
      path.join(userData, 'agent-runtime-bundle'),
      path.join(userData, 'credentials', 'agent-provider-settings.json')
    ]) {
      assert.equal(await fs.stat(missing).catch(() => null), null, `${missing} 必须被清理`);
    }
    // 非 Agent 资产绝不误删。
    assert.ok(await fs.stat(path.join(resources, 'keep.txt')).then(() => true).catch(() => false), 'resources 其他文件不得误删');
    assert.ok(
      await fs.stat(path.join(userData, 'credentials', 'cloud-refresh-token.bin')).then(() => true).catch(() => false),
      'credentials 里云端凭据不得误删'
    );
  } finally {
    await rm(resources, { recursive: true, force: true });
    await rm(userData, { recursive: true, force: true });
  }
});

test('目标不存在时静默无事发生，不报错不产出假清单', async () => {
  const resources = await createTempRoot('empty-res');
  const userData = await createTempRoot('empty-user');
  try {
    const result = await removeLegacyAgentRuntimeArtifacts({ resourcesPath: resources, userDataPath: userData, delayMs: 0 });
    assert.deepEqual(result, { removed: [], problems: [] });
  } finally {
    await rm(resources, { recursive: true, force: true });
    await rm(userData, { recursive: true, force: true });
  }
});

test('resourcesPath/userDataPath 留空时跳过对应清理面（开发态语义）', async () => {
  const result = await removeLegacyAgentRuntimeArtifacts({ delayMs: 0 });
  assert.deepEqual(result, { removed: [], problems: [] });
});
