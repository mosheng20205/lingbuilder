import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPaidModuleAccessErrorCode,
  PAID_MODULE_ACCESS_ERROR_CODES,
  recoverPaidModuleAccess
} from '../src/services/modules/paidModuleAccessRecovery';
import { fetchWithSdkDependencies } from '../src/services/sdkDependencies/sdkDependencyClient';
import {
  settleCloudAccountLoginDialog,
  subscribeCloudAccountLoginDialog
} from '../src/services/workbench/cloudAccountLoginService';

type CloudAccountStub = {
  session: () => Promise<{ authenticated: boolean; email?: string } | null>;
  authorizeModule: (moduleId: string) => Promise<{ ok: boolean; error?: string; status?: { allowed: boolean; reason?: string } }>;
};

function setCloudAccountBridge(stub: CloudAccountStub | undefined): void {
  (globalThis as { window?: unknown }).window = stub ? { lingBuilder: { cloudAccount: stub } } : undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('权益失败码全集包含四类模块授权错误', () => {
  for (const code of ['MODULE_PAYMENT_REQUIRED', 'MODULE_FREE_WINDOW_ENDED', 'MODULE_ENTITLEMENT_EXPIRED', 'MODULE_PERMIT_ANCHOR_UNKNOWN']) {
    assert.equal(isPaidModuleAccessErrorCode(code), true);
    assert.equal(PAID_MODULE_ACCESS_ERROR_CODES.includes(code), true);
  }
  assert.equal(isPaidModuleAccessErrorCode('SDK_DEPENDENCY_REQUIRED'), false);
  assert.equal(isPaidModuleAccessErrorCode(undefined), false);
});

test('恢复流：未登录时弹登录框，取消登录返回 cancelled 且不换发', async () => {
  let authorizeCalls = 0;
  setCloudAccountBridge({
    session: async () => ({ authenticated: false }),
    authorizeModule: async () => { authorizeCalls += 1; return { ok: true, status: { allowed: true } }; }
  });
  const unsubscribe = subscribeCloudAccountLoginDialog(request => {
    assert.match(request.description || '', /需要先登录 LingBuilder 账号/u);
    settleCloudAccountLoginDialog({ authenticated: false, cancelled: true });
  });
  try {
    const outcome = await recoverPaidModuleAccess('lingbuilder.new_emoji.ui');
    assert.equal(outcome.recovered, false);
    assert.equal(outcome.cancelled, true);
    assert.equal(authorizeCalls, 0);
  } finally {
    unsubscribe();
    setCloudAccountBridge(undefined);
  }
});

test('恢复流：已登录且 authorize 放行时返回 recovered=true', async () => {
  const requested: string[] = [];
  setCloudAccountBridge({
    session: async () => ({ authenticated: true, email: 'user@example.com' }),
    authorizeModule: async moduleId => {
      requested.push(moduleId);
      return { ok: true, status: { moduleId, allowed: true } };
    }
  });
  try {
    const outcome = await recoverPaidModuleAccess('lingbuilder.new_emoji.ui');
    assert.equal(outcome.recovered, true);
    assert.deepEqual(requested, ['lingbuilder.new_emoji.ui']);
  } finally {
    setCloudAccountBridge(undefined);
  }
});

test('恢复流：authorize 明确拒绝时返回带指引的原因，不视为恢复', async () => {
  setCloudAccountBridge({
    session: async () => ({ authenticated: true }),
    authorizeModule: async () => ({ ok: true, status: { allowed: false, reason: '模块限时免费活动已经结束：请购买。' } })
  });
  try {
    const outcome = await recoverPaidModuleAccess('lingbuilder.new_emoji.ui');
    assert.equal(outcome.recovered, false);
    assert.match(outcome.message || '', /限时免费/u);
  } finally {
    setCloudAccountBridge(undefined);
  }
});

test('恢复流：未登录时在登录框完成登录后继续换发并恢复', async () => {
  let authorizeCalls = 0;
  setCloudAccountBridge({
    session: async () => ({ authenticated: false }),
    authorizeModule: async moduleId => {
      authorizeCalls += 1;
      return { ok: true, status: { moduleId, allowed: true } };
    }
  });
  const unsubscribe = subscribeCloudAccountLoginDialog(request => {
    settleCloudAccountLoginDialog({ authenticated: true, email: 'user@example.com' });
  });
  try {
    const outcome = await recoverPaidModuleAccess('lingbuilder.new_emoji.ui');
    assert.equal(outcome.recovered, true);
    assert.equal(authorizeCalls, 1);
  } finally {
    unsubscribe();
    setCloudAccountBridge(undefined);
  }
});

test('fetchWithSdkDependencies：模块权益 402 恢复成功后自动重试一次', async () => {
  setCloudAccountBridge({
    session: async () => ({ authenticated: true }),
    authorizeModule: async () => ({ ok: true, status: { allowed: true } })
  });
  try {
    let calls = 0;
    const response = await fetchWithSdkDependencies(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ ok: false, code: 'MODULE_FREE_WINDOW_ENDED', moduleId: 'lingbuilder.new_emoji.ui', error: '模块限时免费活动已经结束' }, 402);
      return jsonResponse({ ok: true, logs: ['编译成功'] });
    });
    assert.equal(calls, 2);
    const payload = await response.json() as { ok?: boolean };
    assert.equal(payload.ok, true);
  } finally {
    setCloudAccountBridge(undefined);
  }
});

test('fetchWithSdkDependencies：恢复失败（取消登录）时不重试，原样返回 402 响应', async () => {
  setCloudAccountBridge({
    session: async () => ({ authenticated: false }),
    authorizeModule: async () => { assert.fail('取消登录后不应换发'); }
  });
  const unsubscribe = subscribeCloudAccountLoginDialog(request => {
    settleCloudAccountLoginDialog({ authenticated: false, cancelled: true });
  });
  try {
    let calls = 0;
    const response = await fetchWithSdkDependencies(async () => {
      calls += 1;
      return jsonResponse({ ok: false, code: 'MODULE_PAYMENT_REQUIRED', moduleId: 'lingbuilder.new_emoji.ui', error: '请先登录' }, 402);
    });
    assert.equal(calls, 1);
    assert.equal(response.status, 402);
  } finally {
    unsubscribe();
    setCloudAccountBridge(undefined);
  }
});

test('fetchWithSdkDependencies：无 moduleId 的权益错误不触发恢复（原样返回）', async () => {
  let calls = 0;
  const response = await fetchWithSdkDependencies(async () => {
    calls += 1;
    return jsonResponse({ ok: false, code: 'MODULE_FREE_WINDOW_ENDED', error: '缺失模块上下文' }, 402);
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 402);
});
