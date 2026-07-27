import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';

export type PaymentProviderId = 'WECHAT' | 'ALIPAY';

interface PaymentGatewayResponse { providerOrderId: string; paymentUrl: string }

@Injectable()
export class PaymentProviderService {
  async createOrder(provider: PaymentProviderId, order: { id: string; subject: string; amountMinor: bigint; expiresAt: Date }): Promise<PaymentGatewayResponse> {
    const prefix = provider === 'WECHAT' ? 'WECHAT' : 'ALIPAY';
    const endpoint = process.env[`${prefix}_PAYMENT_GATEWAY_URL`]?.trim();
    const secret = process.env[`${prefix}_PAYMENT_GATEWAY_SECRET`]?.trim();
    if (!endpoint || !secret) throw Object.assign(new Error(`${provider === 'WECHAT' ? '微信支付' : '支付宝'}商户网关尚未配置，当前只能由管理员手工授权。`), { status: 503, code: 'MODULE_ACCESS_UNAVAILABLE' });
    const body = JSON.stringify({ orderId: order.id, subject: order.subject, amountMinor: order.amountMinor.toString(), currency: 'CNY', expiresAt: order.expiresAt.toISOString() });
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lingbuilder-signature': signature }, body });
    const value: any = await response.json().catch(() => ({}));
    if (!response.ok || typeof value.providerOrderId !== 'string' || typeof value.paymentUrl !== 'string') throw Object.assign(new Error(value.message || '支付网关创建订单失败。'), { status: 502, code: 'MODULE_ACCESS_UNAVAILABLE' });
    return { providerOrderId: value.providerOrderId, paymentUrl: value.paymentUrl };
  }

  verifyWebhook(provider: PaymentProviderId, rawBody: string, signature: string): any {
    const prefix = provider === 'WECHAT' ? 'WECHAT' : 'ALIPAY';
    const secret = process.env[`${prefix}_PAYMENT_WEBHOOK_SECRET`]?.trim();
    if (!secret) throw Object.assign(new Error('支付回调密钥尚未配置。'), { status: 503, code: 'MODULE_ACCESS_UNAVAILABLE' });
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const left = Buffer.from(expected, 'utf8'); const right = Buffer.from(signature || '', 'utf8');
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw Object.assign(new Error('支付回调签名无效。'), { status: 401, code: 'AUTH_INVALID' });
    const value = JSON.parse(rawBody);
    if (typeof value.eventId !== 'string' || typeof value.providerOrderId !== 'string' || !['paid', 'refunded'].includes(value.status)) throw Object.assign(new Error('支付回调内容无效。'), { status: 400, code: 'VALIDATION_FAILED' });
    return value;
  }
}
