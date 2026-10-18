import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createModuleAccessGate,
  type ModuleAccessBootstrap,
  type ModuleAccessGateAuthorizer
} from '../src/services/aiBridge/moduleAccessGate';
import type { LocalAuthorizationResult, LocalModuleAuthorizationResult } from '../src/services/aiBridge/localAuthorizationClient';

const PAID_MODULE = 'lingbuilder.new_emoji.ui';
const PURCHASE_ERROR = () => Object.assign(new Error('请先登录并购买该模块，或等待限时免费活动开始。'), { code: 'MODULE_PAYMENT_REQUIRED' });
const NOT_LOGGED_IN_MESSAGE = '请先注册并登录 LingBuilder 账号，再启用收费模块。';

interface GateHarness {
  granted: Map<string, boolean>;
  exchangeResult: LocalAuthorizationResult;
  exchangeCalls: number;
  authorizeResult: LocalModuleAuthorizationResult;
  authorizeCalls: string[];
  logs: string[];
}

interface GateFixture {
  harness: GateHarness;
  gate: ReturnType<typeof createModuleAccessGate>;
  setExchange(value: unknown): void;
  setAuthorizeOutcome(outcome: Partial<LocalModuleAuthorizationResult> & { state?: unknown }): void;
}

function encodeState(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/**
 * 桩授权器：sync 收到含 permit 的授权即登记为可访问；行为由 harness 控制，不牵涉 Permit 密码学。
 * exchangeResult / authorizeResult 可在 gate 创建后替换（同一对象引用，闭包内实时读取）。
 * authorizeResult 默认 reachable=false（IDE 代理不可达），换发请求等于没有发生。
 */
function createFixture(bootstrap: ModuleAccessBootstrap): GateFixture {
  const harness: GateHarness = {
    granted: new Map(),
    exchangeResult: { ok: false, value: '[]', message: '未找到正在运行的 LingBuilder 本机授权代理（LingBuilder 未启动，或已在「AI Bridge 连接中心」关闭外部 AI 授权）。请保持 LingBuilder 运行并登录账号后重试。' },
    exchangeCalls: 0,
    authorizeResult: { ok: false, value: '', message: '', reachable: false },
    authorizeCalls: [],
    logs: []
  };
  const authorizer: ModuleAccessGateAuthorizer = {
    assertAccess(moduleId: string): void {
      if (!harness.granted.get(moduleId)) throw PURCHASE_ERROR();
    },
    sync(input: unknown): unknown {
      const permit = (input as { permit?: { payload?: { moduleId?: string } } } | null)?.permit;
      const moduleId = permit?.payload?.moduleId;
      if (typeof moduleId === 'string' && moduleId) harness.granted.set(moduleId, true);
      return undefined;
    }
  };
  const gate = createModuleAccessGate({
    authorizer,
    bootstrap,
    bootstrapMessage: bootstrap === 'failed' ? harness.exchangeResult.message : undefined,
    requestExchange: async () => {
      harness.exchangeCalls += 1;
      return harness.exchangeResult;
    },
    requestAuthorize: async moduleId => {
      harness.authorizeCalls.push(moduleId);
      return harness.authorizeResult;
    },
    retryCooldownMs: 0,
    log: message => harness.logs.push(message)
  });
  return {
    harness,
    gate,
    setExchange(value: unknown) {
      harness.exchangeResult = { ok: true, value: encodeState(value), message: '' };
    },
    setAuthorizeOutcome(outcome) {
      const { state, ...rest } = outcome;
      harness.authorizeResult = {
        ok: rest.ok ?? false,
        value: state !== undefined ? encodeState(state) : rest.value ?? '',
        message: rest.message ?? '',
        reachable: rest.reachable ?? true
      };
    }
  };
}

test('门禁：宿主启动早于授权开关时，惰性重换取到凭据即热更新放行（同一次调用内生效）', async () => {
  const { harness, gate, setExchange } = createFixture('failed');
  setExchange([{ permit: { payload: { moduleId: PAID_MODULE } } }]);
  await gate.assert([PAID_MODULE]);
  assert.equal(harness.exchangeCalls, 1);
  assert.deepEqual(harness.authorizeCalls, [], '状态重换已放行时不得再触发按需换发');
  assert.match(harness.logs.join('\n'), /热更新模块授权/u);
});

test('门禁：状态重换拿不到、按需换发成功时，登录用户现场换到 Permit 即放行', async () => {
  const { harness, gate, setAuthorizeOutcome } = createFixture('failed');
  // 状态换取始终失败（代理不可达），但按需换发用 IDE 登录态换到了 Permit。
  setAuthorizeOutcome({ ok: true, state: [{ permit: { payload: { moduleId: PAID_MODULE } } }] });
  await gate.assert([PAID_MODULE]);
  assert.deepEqual(harness.authorizeCalls, [PAID_MODULE]);
  assert.match(harness.logs.join('\n'), /按需换发/u);
});

test('门禁：按需换发被 IDE 权威拒绝（未登录）时，原样透出登录指引，不伪装成未购买或时序问题', async () => {
  const { gate, setAuthorizeOutcome } = createFixture('env');
  setAuthorizeOutcome({ ok: false, message: NOT_LOGGED_IN_MESSAGE });
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /自动授权未成功/u);
      assert.match(message, /请先注册并登录/u);
      assert.equal(/重启 AI 客户端/u.test(message), false, 'IDE 已给出权威原因时不得再报时序指引');
      assert.equal((error as { code?: string }).code, 'MODULE_PAYMENT_REQUIRED');
      return true;
    }
  );
});

test('门禁：按需换发成功但最新状态里仍无该模块凭据时，维持「请先登录并购买」（fail-closed）', async () => {
  const { harness, gate, setExchange, setAuthorizeOutcome } = createFixture('env');
  setExchange([]);
  setAuthorizeOutcome({ ok: true, state: [] });
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      assert.match(error instanceof Error ? error.message : String(error), /请先登录并购买/u);
      return true;
    }
  );
  assert.deepEqual(harness.authorizeCalls, [PAID_MODULE]);
  assert.equal(harness.granted.get(PAID_MODULE), undefined);
});

test('门禁：启动早于开关且重换与换发都不可用时，报错指向保持 LingBuilder 运行/重连 MCP，不出现「请先登录并购买」', async () => {
  const { gate } = createFixture('failed');
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /重启 AI 客户端或重连 MCP/u);
      assert.match(message, /允许外部 AI 客户端使用本机授权/u);
      assert.match(message, /保持 LingBuilder 运行并登录账号/u);
      assert.equal(/请先登录并购买/u.test(message), false, '启动时序类失败不得误报为未购买');
      return true;
    }
  );
});

test('门禁：启动时已拿到授权状态（env）但模块缺凭据、按需换发不可达时，直接按未购买拒绝', async () => {
  const { harness, gate } = createFixture('env');
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /请先登录并购买/u);
      assert.equal(/重启 AI 客户端/u.test(message), false);
      return true;
    }
  );
  // 失败路径仍会惰性重换一次（启动后用户可能刚购买），但换取结果为空不会改变拒绝语义。
  assert.equal(harness.exchangeCalls, 1);
});

test('门禁：过期/签名无效等既有精确诊断原样透出，不伪装成未购买或时序问题', async () => {
  // 夹具文案与 ModuleAccessService 的如实口径保持一致（过期的是本地离线授权，不代表活动已结束）。
  const expired = Object.assign(new Error('本地限时免费授权已于 2026-09-29 10:00:00 过期（限免活动可能仍在进行）。登录 LingBuilder 账号后 IDE 会自动换发授权。'), { code: 'MODULE_FREE_WINDOW_ENDED' });
  const gate = createModuleAccessGate({
    authorizer: { assertAccess: () => { throw expired; }, sync: () => undefined },
    bootstrap: 'env',
    requestExchange: async () => ({ ok: false, value: '', message: 'x' }),
    requestAuthorize: async () => ({ ok: false, value: '', message: '', reachable: false }),
    retryCooldownMs: 0
  });
  await assert.rejects(() => gate.assert([PAID_MODULE]), /本地限时免费授权已于/u);
});

test('门禁：换取结果非法（非 JSON 数组）时不得放行，按启动时序给出指引', async () => {
  const harness: GateHarness = { granted: new Map(), exchangeResult: { ok: true, value: Buffer.from('garbage-not-json', 'utf8').toString('base64url'), message: '' }, exchangeCalls: 0, authorizeResult: { ok: false, value: '', message: '', reachable: false }, authorizeCalls: [], logs: [] };
  const gate = createModuleAccessGate({
    authorizer: { assertAccess: () => { throw PURCHASE_ERROR(); }, sync: () => undefined },
    bootstrap: 'failed',
    requestExchange: async () => {
      harness.exchangeCalls += 1;
      return harness.exchangeResult;
    },
    requestAuthorize: async moduleId => {
      harness.authorizeCalls.push(moduleId);
      return harness.authorizeResult;
    },
    retryCooldownMs: 0
  });
  await assert.rejects(() => gate.assert([PAID_MODULE]), /需要本机授权|请先登录并购买/u);
  assert.equal(harness.granted.get(PAID_MODULE), undefined, '非法换取结果绝不产生任何授权');
});

test('门禁：冷却窗口内不重复按需换发，避免对 IDE 代理打爆请求', async () => {
  const harness: GateHarness = { granted: new Map(), exchangeResult: { ok: false, value: '[]', message: 'x' }, exchangeCalls: 0, authorizeResult: { ok: true, value: encodeState([]), message: '', reachable: true }, authorizeCalls: [], logs: [] };
  const gate = createModuleAccessGate({
    authorizer: {
      assertAccess: moduleId => { if (!harness.granted.get(moduleId)) throw PURCHASE_ERROR(); },
      sync: input => {
        const moduleId = (input as { permit?: { payload?: { moduleId?: string } } } | null)?.permit?.payload?.moduleId;
        if (typeof moduleId === 'string') harness.granted.set(moduleId, true);
        return undefined;
      }
    },
    bootstrap: 'failed',
    requestExchange: async () => ({ ok: false, value: '', message: 'x' }),
    requestAuthorize: async moduleId => {
      harness.authorizeCalls.push(moduleId);
      return harness.authorizeResult;
    },
    retryCooldownMs: 60_000
  });
  await assert.rejects(() => gate.assert([PAID_MODULE]), /请先登录并购买/u);
  // 第二次断言全部恢复路径都在冷却中：换发不再发生，按启动时序指引拒绝。
  await assert.rejects(() => gate.assert([PAID_MODULE]), /宿主启动时未取得授权/u);
  assert.equal(harness.authorizeCalls.length, 1, '冷却窗口内第二次断言不得再次换发');
});
