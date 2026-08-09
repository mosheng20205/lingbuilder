import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreModulePermits, type CachedModuleAuthorization } from '../electron/modulePermitRestoreService';

function authorization(moduleId: string, generation: number): CachedModuleAuthorization {
  return { permit: { payload: { moduleId } }, generation };
}

test('Permit 恢复会等待本地服务并重试缓存同步', async () => {
  const cached = [authorization('lingbuilder.new_emoji.ui', 1)];
  const requests: string[] = [];
  const logs: string[] = [];
  let healthAttempts = 0;
  const result = await restoreModulePermits({
    readCache: async () => cached,
    writeCache: async () => assert.fail('离线恢复不应改写缓存'),
    requestRendererApi: async (apiPath) => {
      requests.push(apiPath);
      if (apiPath === '/api/health' && ++healthAttempts < 3) throw new Error('ECONNREFUSED');
      return { ok: true };
    },
    retryAttempts: 4,
    retryDelayMs: 0,
    sleep: async () => undefined,
    log: (_level, message) => logs.push(message)
  });
  assert.equal(result.rendererReady, true);
  assert.equal(result.synchronizedCount, 1);
  assert.equal(healthAttempts, 3);
  assert.deepEqual(requests, ['/api/health', '/api/health', '/api/health', '/api/module-access/sync']);
  assert.ok(logs.some(message => message.includes('安全缓存恢复模块授权')));
});

test('已登录时通过云端刷新 Permit 并原子更新安全缓存', async () => {
  const cached = [authorization('lingbuilder.new_emoji.ui', 1)];
  const synchronizedGenerations: number[] = [];
  let written: CachedModuleAuthorization[] | undefined;
  const result = await restoreModulePermits({
    readCache: async () => cached,
    writeCache: async values => { written = values; },
    requestRendererApi: async (apiPath, init) => {
      if (apiPath === '/api/module-access/sync') {
        synchronizedGenerations.push(Number((JSON.parse(String(init.body)) as { generation?: unknown }).generation));
      }
      return { ok: true };
    },
    refreshAuthorization: async moduleId => authorization(moduleId, 2),
    retryDelayMs: 0,
    sleep: async () => undefined
  });
  assert.equal(result.synchronizedCount, 1);
  assert.equal(result.refreshedCount, 1);
  assert.deepEqual(synchronizedGenerations, [1, 2]);
  assert.equal((written?.[0] as { generation?: unknown })?.generation, 2);
});

test('本地服务持续不可用时给出中文失败并且不丢缓存', async () => {
  const cached = [authorization('lingbuilder.new_emoji.ui', 1)];
  let writeCalled = false;
  const result = await restoreModulePermits({
    readCache: async () => cached,
    writeCache: async () => { writeCalled = true; },
    requestRendererApi: async () => { throw new Error('ECONNREFUSED'); },
    retryAttempts: 2,
    retryDelayMs: 0,
    sleep: async () => undefined
  });
  assert.equal(result.rendererReady, false);
  assert.equal(result.synchronizedCount, 0);
  assert.equal(writeCalled, false);
  assert.match(result.failures[0] || '', /尚未同步/u);
});
