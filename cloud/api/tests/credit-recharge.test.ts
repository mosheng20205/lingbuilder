import assert from 'node:assert/strict';
import test from 'node:test';
import { CreditRechargeService, RECHARGE_PACKAGES } from '../src/billing/credit-recharge.service.js';
import { PaymentProviderService } from '../src/modules/payment-provider.service.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6389';

test('recharge packages keep the 1 元 = 10,000 点数 ratio', () => {
  const standard = RECHARGE_PACKAGES.filter(pack => pack.id !== 'test-1-cent');
  for (const pack of standard) {
    assert.equal(pack.points, pack.amountMinor * 100n);
    assert.ok(pack.points > 0n && pack.amountMinor > 0n);
  }
  assert.ok(RECHARGE_PACKAGES.some(pack => pack.id === 'test-1-cent'));
});

test('packages() serializes bigint values to strings', () => {
  const service = new CreditRechargeService({} as never, {} as never);
  const list = service.packages();
  assert.equal(list.length, RECHARGE_PACKAGES.length);
  for (const item of list) {
    assert.equal(typeof item.points, 'string');
    assert.equal(typeof item.amountMinor, 'string');
    assert.equal(item.currency, 'CNY');
  }
});

test('payment configuration is ready when only alipay is configured', () => {
  const previous = { ...process.env };
  try {
    process.env.ALIPAY_APP_ID = '2021000000000000';
    process.env.ALIPAY_PRIVATE_KEY_PEM = 'private';
    process.env.ALIPAY_PUBLIC_KEY_PEM = 'public';
    process.env.ALIPAY_NOTIFY_URL = 'https://api.example.com/v1/payments/alipay/webhook';
    delete process.env.WECHAT_PAY_MCH_ID;
    const status = new PaymentProviderService().configurationStatus();
    assert.equal(status.ready, true);
    const wechat = status.providers.find(item => item.id === 'wechat');
    const alipay = status.providers.find(item => item.id === 'alipay');
    assert.equal(wechat?.ready, false);
    assert.equal(alipay?.ready, true);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
