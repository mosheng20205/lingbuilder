import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { ModuleCommerceService } from '../src/modules/module-commerce.service.js';
import { PaymentProviderService } from '../src/modules/payment-provider.service.js';

/** 手写 Prisma mock：覆盖 Pro 会籍商品的建单校验与支付回调分支。 */
function createCommercePrisma(options: { product?: any; offer?: any; membership?: any; order?: any } = {}) {
  const state = {
    product: options.product,
    offer: options.offer,
    membership: options.membership || null,
    order: options.order || null,
    memberships: [] as any[],
    webhooks: [] as any[]
  };
  const tx = {
    moduleProduct: { findUnique: async () => state.product },
    proMembership: {
      findUnique: async ({ where }: any) => state.memberships.find(row => row.userId === where.userId) || (state.membership?.userId === where.userId ? state.membership : null),
      create: async ({ data }: any) => { state.memberships.push(data); return data; },
      update: async ({ where, data }: any) => { const row = state.memberships.find(item => item.userId === where.userId) || state.membership; return Object.assign(row, data); }
    },
    paymentWebhookEvent: {
      findUnique: async () => state.webhooks.find(row => row.eventId === 'notify-1') || null,
      create: async ({ data }: any) => { state.webhooks.push(data); return data; }
    },
    moduleOrder: {
      findFirst: async () => state.order,
      update: async ({ where, data }: any) => Object.assign(state.order, data)
    },
    moduleEntitlement: { create: async ({ data }: any) => ({ data }) }
  };
  return {
    state,
    proMembership: {
      findFirst: async () => state.membership,
      findUnique: async () => state.membership
    },
    moduleOffer: { findUnique: async () => state.offer },
    moduleOrder: {
      findUnique: async () => state.order,
      create: async ({ data }: any) => { state.order = { id: 'order-1', status: 'PENDING', ...data, product: state.product }; return state.order; },
      update: async ({ where, data }: any) => Object.assign(state.order, data)
    },
    $transaction: async (fn: any) => fn(tx)
  };
}

const MEMBERSHIP_PRODUCT = { id: 'product-pro', moduleId: 'lingbuilder.pro', name: 'Pro 会员', enabled: true, listed: true, kind: 'MEMBERSHIP' };
const PERPETUAL_OFFER = { id: 'offer-pro-perp', productId: 'product-pro', name: '永久买断', kind: 'PERPETUAL', priceMinor: 29900n, currency: 'CNY', durationDays: null, enabled: true, product: MEMBERSHIP_PRODUCT };

function snapshotEnv(names: string[]): Record<string, string | undefined> {
  const previous: Record<string, string | undefined> = {};
  for (const name of names) previous[name] = process.env[name];
  return previous;
}
function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

function validRsaPrivateKeyPem(): string {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

/** 生成支付宝已签名回调 + 环境包裹器（在 withEnv 内运行断言，密钥/回调地址按需配置）。 */
function alipaySignedCallback(orderId: string, amount: string): { raw: string; withEnv: (fn: () => void) => void } {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const values: Record<string, string> = { app_id: 'app-pro', notify_id: 'notify-pro', out_trade_no: orderId, trade_status: 'TRADE_SUCCESS', total_amount: amount };
  const canonical = Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('&');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(canonical), pair.privateKey).toString('base64');
  const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const raw = new URLSearchParams({ ...values, sign_type: 'RSA2', sign: signature }).toString();
  return {
    raw,
    withEnv: async (fn: () => void | Promise<void>) => {
      const previous = snapshotEnv(['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY_PEM', 'ALIPAY_PUBLIC_KEY_PEM', 'ALIPAY_NOTIFY_URL', 'CLOUD_API_ORIGIN']);
      Object.assign(process.env, { CLOUD_API_ORIGIN: 'https://api.lingbuilder.com', ALIPAY_APP_ID: 'app-pro', ALIPAY_PRIVATE_KEY_PEM: privateKeyPem, ALIPAY_PUBLIC_KEY_PEM: publicKeyPem, ALIPAY_NOTIFY_URL: 'https://api.example.test/v1/module-payments/alipay/webhook' });
      try { await fn(); } finally { restoreEnv(previous); }
    }
  };
}

test('Pro 会籍下单：永久会员重复购买被 409 拒绝，非会员可下单', async () => {
  const previous = snapshotEnv(['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY_PEM', 'ALIPAY_PUBLIC_KEY_PEM', 'ALIPAY_NOTIFY_URL', 'ALIPAY_RETURN_URL', 'CLOUD_API_ORIGIN']);
  Object.assign(process.env, {
    CLOUD_API_ORIGIN: 'https://api.lingbuilder.com',
    ALIPAY_APP_ID: 'app-pro',
    ALIPAY_PRIVATE_KEY_PEM: validRsaPrivateKeyPem(),
    ALIPAY_PUBLIC_KEY_PEM: validRsaPrivateKeyPem(),
    ALIPAY_NOTIFY_URL: 'https://api.example.test/v1/module-payments/alipay/webhook',
    ALIPAY_RETURN_URL: 'https://lingbuilder.com/alipay/return'
  });
  try {
    const perpetual = new ModuleCommerceService(createCommercePrisma({ product: MEMBERSHIP_PRODUCT, offer: PERPETUAL_OFFER, membership: { userId: 'u1', tier: 'PERPETUAL' } }) as never, new PaymentProviderService());
    await assert.rejects(perpetual.createOrder('u1', 'offer-pro-perp', 'ALIPAY', 'key-1'), (error: any) => error?.status === 409 && /永久会员/u.test(error.message));

    const fresh = createCommercePrisma({ product: MEMBERSHIP_PRODUCT, offer: PERPETUAL_OFFER });
    const service = new ModuleCommerceService(fresh as never, new PaymentProviderService());
    const order = await service.createOrder('u2', 'offer-pro-perp', 'ALIPAY', 'key-2');
    assert.equal(order.status, 'pending');
    assert.equal(order.moduleId, 'lingbuilder.pro');
  } finally { restoreEnv(previous); }
});

test('Pro 会籍回调：永久档支付成功创建买断会籍，幂等重复回调不再处理', async () => {
  const signed = alipaySignedCallback('order-pro-1', '299.00');
  await signed.withEnv(async () => {
    const order = { id: 'order-pro-1', userId: 'u1', productId: 'product-pro', offerKind: 'PERPETUAL', amountMinor: 29900n, currency: 'CNY', durationDays: null, status: 'PENDING', provider: 'ALIPAY', providerOrderId: 'order-pro-1' };
    const prisma = createCommercePrisma({ product: MEMBERSHIP_PRODUCT, offer: PERPETUAL_OFFER, order });
    const service = new ModuleCommerceService(prisma as never, new PaymentProviderService());
    const result = await service.paymentWebhook('ALIPAY', signed.raw, {}) as { paid?: boolean; duplicate?: boolean };
    assert.equal(result.paid, true);
    assert.equal(prisma.state.memberships.length, 1);
    assert.equal(prisma.state.memberships[0].tier, 'PERPETUAL');
    assert.equal(prisma.state.memberships[0].endsAt, null);
    assert.equal(prisma.state.memberships[0].source, 'PURCHASE');
    const duplicate = await service.paymentWebhook('ALIPAY', signed.raw, {}) as { duplicate?: boolean };
    assert.equal(duplicate.duplicate, true);
    assert.equal(prisma.state.memberships.length, 1, '幂等回调不得重复建会籍');
  });
});

test('Pro 会籍回调：年费档在现有到期日上顺延', async () => {
  const signed = alipaySignedCallback('order-pro-2', '99.00');
  await signed.withEnv(async () => {
    const now = new Date();
    const yearlyEnd = new Date(now.getTime() + 100 * 86_400_000);
    const order = { id: 'order-pro-2', userId: 'u1', productId: 'product-pro', offerKind: 'FIXED_TERM', amountMinor: 9900n, currency: 'CNY', durationDays: 365, status: 'PENDING', provider: 'ALIPAY', providerOrderId: 'order-pro-2' };
    const membership = { userId: 'u1', tier: 'YEARLY', source: 'PURCHASE', paidMinor: 9900, startsAt: now, endsAt: yearlyEnd, revokedAt: null, note: '' };
    const prisma = createCommercePrisma({ product: MEMBERSHIP_PRODUCT, offer: PERPETUAL_OFFER, order, membership });
    const service = new ModuleCommerceService(prisma as never, new PaymentProviderService());
    const result = await service.paymentWebhook('ALIPAY', signed.raw, {}) as { paid?: boolean };
    assert.equal(result.paid, true);
    const extended = Math.round((new Date((prisma.state.memberships[0] || prisma.state.membership).endsAt).getTime() - yearlyEnd.getTime()) / 86_400_000);
    assert.equal(extended, 365, '年费续费必须在现有到期日上顺延 365 天');
  });
});
