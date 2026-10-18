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
  requestModuleAuthorizationExchange,
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

test('按需换发：authorizeModuleIds 逐个换发，成功者随最新状态回传、失败者带权威中文原因', async t => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-local-auth-authorize-'));
  t.after(() => fs.rm(userDataDir, { recursive: true, force: true }));
  const cache: unknown[] = [];
  const authorized: string[] = [];
  const service = new LocalAuthorizationService({
    userDataDir,
    enabled: true,
    readModulePermitCache: async () => cache,
    resolveFbroVipKey: async () => '',
    authorizeModule: async moduleId => {
      if (moduleId === 'lingbuilder.paid.ok') {
        authorized.push(moduleId);
        cache.push({ permit: { payload: { moduleId } } });
        return { ok: true };
      }
      return { ok: false, message: '请先注册并登录 LingBuilder 账号，再启用收费模块。' };
    }
  });
  const snapshot = await service.start();
  const previous = process.env.LINGBUILDER_LOCAL_AUTH_FILE;
  process.env.LINGBUILDER_LOCAL_AUTH_FILE = resolveLocalAuthorizationDiscoveryPath(userDataDir);
  t.after(() => {
    void service.stop();
    if (previous === undefined) delete process.env.LINGBUILDER_LOCAL_AUTH_FILE;
    else process.env.LINGBUILDER_LOCAL_AUTH_FILE = previous;
  });

  const outcome = await requestModuleAuthorizationExchange('lingbuilder.paid.ok');
  assert.equal(outcome.ok, true, outcome.message);
  assert.equal(outcome.reachable, true);
  const state = JSON.parse(Buffer.from(outcome.value, 'base64url').toString('utf8')) as { permit?: { payload?: { moduleId?: string } } }[];
  assert.equal(state[0]?.permit?.payload?.moduleId, 'lingbuilder.paid.ok');

  const denied = await requestModuleAuthorizationExchange('lingbuilder.paid.denied');
  assert.equal(denied.ok, false);
  assert.equal(denied.reachable, true);
  assert.match(denied.message, /请先注册并登录/u);
  assert.deepEqual(authorized, ['lingbuilder.paid.ok']);
  await service.stop();
});

test('按需换发：代理不可达时 reachable=false，调用方据此走时序/环境指引', async t => {
  const previous = process.env.LINGBUILDER_LOCAL_AUTH_FILE;
  // 指向一个不存在的路径（而不是删掉环境变量）：避免扫到本机真实运行中 IDE 的发现文件，保证用例确定性。
  process.env.LINGBUILDER_LOCAL_AUTH_FILE = path.join(os.tmpdir(), 'lingbuilder-local-auth-missing.json');
  t.after(() => {
    if (previous === undefined) delete process.env.LINGBUILDER_LOCAL_AUTH_FILE;
    else process.env.LINGBUILDER_LOCAL_AUTH_FILE = previous;
  });
  const outcome = await requestModuleAuthorizationExchange('lingbuilder.any');
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reachable, false, '找不到发现文件时必须标记为不可达');
  assert.match(outcome.message, /保持 LingBuilder 运行并登录账号/u);
});
