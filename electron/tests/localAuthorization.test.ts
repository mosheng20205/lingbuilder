import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  LocalAuthorizationService,
  encodeModuleAccessState,
  resolveLocalAuthorizationDiscoveryPath
} from '../electron/localAuthorizationService';
import {
  readLocalAuthorizationDiscovery,
  requestLocalAuthorization,
  resolveLocalAuthorizationCandidates
} from '../src/services/aiBridge/localAuthorizationClient';

const AUTHORIFICATIONS = [{ permit: { payload: { moduleId: 'lingbuilder.database.sqlite', serverTime: new Date().toISOString() } } }];

async function createService(enabled: boolean) {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-local-auth-'));
  const service = new LocalAuthorizationService({
    userDataDir,
    enabled,
    readModulePermitCache: async () => AUTHORIFICATIONS,
    resolveFbroVipKey: async () => 'fbro-vip-key-for-test'
  });
  return { userDataDir, service };
}

test('本机授权代理关闭时不监听、并清掉陈旧发现文件', async t => {
  const { userDataDir, service } = await createService(false);
  t.after(() => fs.rm(userDataDir, { recursive: true, force: true }));
  const discoveryPath = resolveLocalAuthorizationDiscoveryPath(userDataDir);
  await fs.writeFile(discoveryPath, JSON.stringify({ version: 1, port: 1, token: 'x', pid: 1, startedAt: '' }), 'utf8');

  const snapshot = await service.start();
  assert.equal(snapshot.running, false);
  await assert.rejects(() => fs.access(discoveryPath));
  await service.stop();
});

test('本机授权代理换取模块授权与浏览器凭据，停止后端口与文件一并撤销', async t => {
  const { userDataDir, service } = await createService(true);
  t.after(async () => {
    await service.stop();
    await fs.rm(userDataDir, { recursive: true, force: true });
  });
  const previous = process.env.LINGBUILDER_LOCAL_AUTH_FILE;
  process.env.LINGBUILDER_LOCAL_AUTH_FILE = resolveLocalAuthorizationDiscoveryPath(userDataDir);
  t.after(() => {
    if (previous === undefined) delete process.env.LINGBUILDER_LOCAL_AUTH_FILE;
    else process.env.LINGBUILDER_LOCAL_AUTH_FILE = previous;
  });

  const snapshot = await service.start();
  assert.equal(snapshot.running, true);
  assert.ok(snapshot.port >= 1024);
  const discovery = await fs.readFile(snapshot.discoveryPath, 'utf8').then(raw => JSON.parse(raw) as { port: number; token: string; pid: number });
  assert.equal(discovery.port, snapshot.port);
  assert.equal(discovery.pid, process.pid);
  assert.ok(discovery.token.length >= 32);

  const moduleAccess = await requestLocalAuthorization('module-access');
  assert.equal(moduleAccess.ok, true, moduleAccess.message);
  assert.deepEqual(JSON.parse(Buffer.from(moduleAccess.value, 'base64url').toString('utf8')), AUTHORIFICATIONS);

  const fbroKey = await requestLocalAuthorization('fbro-vip');
  assert.equal(fbroKey.ok, true, fbroKey.message);
  assert.equal(fbroKey.value, 'fbro-vip-key-for-test');

  assert.equal((await service.snapshot()).exchanges, 2);
  await service.stop();
  const afterStop = await requestLocalAuthorization('module-access');
  assert.equal(afterStop.ok, false);
  await assert.rejects(() => fs.access(snapshot.discoveryPath));
});

test('换取令牌不匹配、未知端点与陈旧发现文件都必须失败', async t => {
  const { userDataDir, service } = await createService(true);
  t.after(async () => {
    await service.stop();
    await fs.rm(userDataDir, { recursive: true, force: true });
  });
  const snapshot = await service.start();

  const call = (body: unknown, token: string, method = 'POST', endpoint = '/local-authority/exchange') => new Promise<{ status: number; text: string }>(resolve => {
    const request = http.request({
      host: '127.0.0.1', port: snapshot.port, path: endpoint, method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, (response: { statusCode?: number; on(event: string, listener: (chunk: unknown) => void): void }) => {
      let text = '';
      response.on('data', chunk => { text += String(chunk); });
      response.on('end', () => resolve({ status: response.statusCode || 0, text }));
    });
    request.on('error', error => resolve({ status: 0, text: String(error) }));
    request.end(JSON.stringify(body));
  });

  const wrongToken = await call({ kind: 'module-access' }, 'wrong-token-0000000000000000000000000000');
  assert.equal(wrongToken.status, 401);
  const unknownPath = await call({ kind: 'module-access' }, 'anything', 'POST', '/local-authority/nope');
  assert.equal(unknownPath.status, 404);
  const wrongMethod = await call({}, 'anything', 'GET');
  assert.equal(wrongMethod.status, 404);
  // 服务对外仍可用：以上失败不得把它带崩。
  assert.equal((await service.snapshot()).running, true);

  const staleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-local-auth-stale-'));
  t.after(() => fs.rm(staleDir, { recursive: true, force: true }));
  const staleFile = path.join(staleDir, 'ai-bridge-local-auth.json');
  await fs.writeFile(staleFile, JSON.stringify({
    version: 1, port: snapshot.port, token: 'a'.repeat(43), pid: 2_147_483_646, startedAt: new Date().toISOString()
  }), 'utf8');
  assert.equal(readLocalAuthorizationDiscovery([staleFile]), null, 'PID 已不存在的发现文件必须忽略');
  assert.equal(resolveLocalAuthorizationCandidates({ LINGBUILDER_LOCAL_AUTH_FILE: staleFile })[0], staleFile);
});

test('模块授权编码与 IDE 注入子进程的环境变量口径一致', () => {
  assert.equal(encodeModuleAccessState([]), Buffer.from('[]', 'utf8').toString('base64url'));
  assert.deepEqual(JSON.parse(Buffer.from(encodeModuleAccessState(AUTHORIFICATIONS), 'base64url').toString('utf8')), AUTHORIFICATIONS);
});
