import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createModuleAccessGate,
  type ModuleAccessBootstrap,
  type ModuleAccessGateAuthorizer
} from '../src/services/aiBridge/moduleAccessGate';
import type { LocalAuthorizationResult } from '../src/services/aiBridge/localAuthorizationClient';

const PAID_MODULE = 'lingbuilder.new_emoji.ui';
const PURCHASE_ERROR = () => Object.assign(new Error('请先登录并购买该模块，或等待限时免费活动开始。'), { code: 'MODULE_PAYMENT_REQUIRED' });

interface GateHarness {
  granted: Map<string, boolean>;
  exchangeResult: LocalAuthorizationResult;
  exchangeCalls: number;
  logs: string[];
}

interface GateFixture {
  harness: GateHarness;
  gate: ReturnType<typeof createModuleAccessGate>;
  setExchange(value: unknown): void;
}

/**
 * 桩授权器：sync 收到含 permit 的授权即登记为可访问；行为由 harness 控制，不牵涉 Permit 密码学。
 * exchangeResult 可在 gate 创建后替换（同一对象引用，闭包内实时读取）。
 */
function createFixture(bootstrap: ModuleAccessBootstrap): GateFixture {
  const harness: GateHarness = {
    granted: new Map(),
    exchangeResult: { ok: false, value: '[]', message: '未找到正在运行的 LingBuilder 本机授权代理（IDE 未启动，或未在「AI Bridge 连接中心」开启外部 AI 授权）。' },
    exchangeCalls: 0,
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
    retryCooldownMs: 0,
    log: message => harness.logs.push(message)
  });
  return {
    harness,
    gate,
    setExchange(value: unknown) {
      harness.exchangeResult = { ok: true, value: Buffer.from(JSON.stringify(value), 'utf8').toString('base64url'), message: '' };
    }
  };
}

test('门禁：宿主启动早于授权开关时，惰性重换取到凭据即热更新放行（同一次调用内生效）', async () => {
  const { harness, gate, setExchange } = createFixture('failed');
  setExchange([{ permit: { payload: { moduleId: PAID_MODULE } } }]);
  await gate.assert([PAID_MODULE]);
  assert.equal(harness.exchangeCalls, 1);
  assert.match(harness.logs.join('\n'), /热更新模块授权/u);
});

test('门禁：启动早于开关且重换仍不可用时，报错指向重启客户端/重连 MCP，不出现「请先登录并购买」', async () => {
  const { gate } = createFixture('failed');
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /重启 AI 客户端或重连 MCP/u);
      assert.match(message, /允许外部 AI 客户端使用本机授权/u);
      assert.equal(/请先登录并购买/u.test(message), false, '启动时序类失败不得误报为未购买');
      return true;
    }
  );
});

test('门禁：重换取到最新授权状态但模块确实无凭据时，维持「请先登录并购买」（fail-closed）', async () => {
  const { harness, gate, setExchange } = createFixture('failed');
  // 代理在线、换取成功，但最新状态里没有该模块的 Permit。
  setExchange([]);
  await assert.rejects(
    () => gate.assert([PAID_MODULE]),
    (error: unknown) => {
      assert.match(error instanceof Error ? error.message : String(error), /请先登录并购买/u);
      return true;
    }
  );
  assert.equal(harness.exchangeCalls, 1);
});

test('门禁：启动时已拿到授权状态（env）但模块缺凭据时，直接按未购买拒绝', async () => {
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
  const expired = Object.assign(new Error('模块限时免费活动已经结束。'), { code: 'MODULE_FREE_WINDOW_ENDED' });
  const gate = createModuleAccessGate({
    authorizer: { assertAccess: () => { throw expired; }, sync: () => undefined },
    bootstrap: 'env',
    requestExchange: async () => ({ ok: false, value: '', message: 'x' }),
    retryCooldownMs: 0
  });
  await assert.rejects(() => gate.assert([PAID_MODULE]), /限时免费活动已经结束/u);
});

test('门禁：换取结果非法（非 JSON 数组）时不得放行，按启动时序给出指引', async () => {
  const harness: GateHarness = { granted: new Map(), exchangeResult: { ok: true, value: Buffer.from('garbage-not-json', 'utf8').toString('base64url'), message: '' }, exchangeCalls: 0, logs: [] };
  const gate = createModuleAccessGate({
    authorizer: { assertAccess: () => { throw PURCHASE_ERROR(); }, sync: () => undefined },
    bootstrap: 'failed',
    requestExchange: async () => {
      harness.exchangeCalls += 1;
      return harness.exchangeResult;
    },
    retryCooldownMs: 0
  });
  await assert.rejects(() => gate.assert([PAID_MODULE]), /需要本机授权|请先登录并购买/u);
  assert.equal(harness.granted.get(PAID_MODULE), undefined, '非法换取结果绝不产生任何授权');
});
