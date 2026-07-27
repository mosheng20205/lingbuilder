import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { ModuleCommerceService } from '../src/modules/module-commerce.service.js';
import { PaymentProviderService } from '../src/modules/payment-provider.service.js';

test('支付回调必须使用服务端配置密钥验证签名', () => {
  const previous = process.env.WECHAT_PAYMENT_WEBHOOK_SECRET;
  process.env.WECHAT_PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  try {
    const service = new PaymentProviderService();
    const raw = JSON.stringify({ eventId: 'evt-1', providerOrderId: 'wx-1', status: 'paid', amountMinor: '9900', currency: 'CNY' });
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(raw).digest('hex');
    assert.equal(service.verifyWebhook('WECHAT', raw, signature).eventId, 'evt-1');
    assert.throws(() => service.verifyWebhook('WECHAT', raw, 'forged'), /./u);
  } finally {
    if (previous === undefined) delete process.env.WECHAT_PAYMENT_WEBHOOK_SECRET;
    else process.env.WECHAT_PAYMENT_WEBHOOK_SECRET = previous;
  }
});

test('商户网关未配置时不允许模拟支付成功', async () => {
  const previousUrl = process.env.ALIPAY_PAYMENT_GATEWAY_URL;
  const previousSecret = process.env.ALIPAY_PAYMENT_GATEWAY_SECRET;
  delete process.env.ALIPAY_PAYMENT_GATEWAY_URL;
  delete process.env.ALIPAY_PAYMENT_GATEWAY_SECRET;
  try {
    const service = new PaymentProviderService();
    await assert.rejects(service.createOrder('ALIPAY', { id: 'order-1', subject: 'module', amountMinor: 100n, expiresAt: new Date(Date.now() + 60_000) }), /./u);
  } finally {
    if (previousUrl !== undefined) process.env.ALIPAY_PAYMENT_GATEWAY_URL = previousUrl;
    if (previousSecret !== undefined) process.env.ALIPAY_PAYMENT_GATEWAY_SECRET = previousSecret;
  }
});

test('未知商品不能通过非计费回退获得签名 Permit', async () => {
  const prisma = {
    moduleProduct: { findUnique: async () => null }
  };
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  await assert.rejects(
    commerce.issuePermit('user-1', 'lingbuilder.unknown.paid-module'),
    (error: any) => error?.code === 'MODULE_PAYMENT_REQUIRED'
  );
});
