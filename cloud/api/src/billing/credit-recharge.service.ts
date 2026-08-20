import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { PaymentProviderService, type PaymentProviderId, type VerifiedPaymentEvent } from '../modules/payment-provider.service.js';

/** 点数充值套餐：金额单位为人民币分，1 元 = 10,000 点数。 */
export const RECHARGE_PACKAGES = [
  { id: 'test-1-cent', name: '支付链路测试包', points: 100n, amountMinor: 1n },
  { id: 'starter', name: '入门包', points: 100_000n, amountMinor: 1_000n },
  { id: 'standard', name: '标准包', points: 500_000n, amountMinor: 5_000n },
  { id: 'pro', name: '专业包', points: 1_000_000n, amountMinor: 10_000n },
  { id: 'ultra', name: '旗舰包', points: 2_000_000n, amountMinor: 20_000n }
] as const;

@Injectable()
export class CreditRechargeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(PaymentProviderService) private readonly payments: PaymentProviderService) {}

  packages() { return RECHARGE_PACKAGES.map(item => ({ id: item.id, name: item.name, points: item.points.toString(), amountMinor: item.amountMinor.toString(), currency: 'CNY' })); }

  async createOrder(userId: string, packageId: string, provider: PaymentProviderId, idempotencyKey: string) {
    if (!idempotencyKey || idempotencyKey.length > 128) throw Object.assign(new Error('充值订单幂等键无效。'), { status: 400, code: 'VALIDATION_FAILED' });
    const existing = await this.prisma.creditRechargeOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (existing) return orderJson(existing);
    const pack = RECHARGE_PACKAGES.find(item => item.id === packageId);
    if (!pack) throw Object.assign(new Error('充值套餐不存在。'), { status: 404, code: 'VALIDATION_FAILED' });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const order = await this.prisma.creditRechargeOrder.create({ data: { userId, idempotencyKey, provider, amountMinor: pack.amountMinor, points: pack.points, packageName: pack.name, expiresAt } });
    try {
      const payment = await this.payments.createOrder(provider, { id: order.id, subject: `LingBuilder 点数充值 - ${pack.name}`, amountMinor: pack.amountMinor, expiresAt });
      const updated = await this.prisma.creditRechargeOrder.update({ where: { id: order.id }, data: { providerOrderId: payment.providerOrderId, paymentUrl: payment.paymentUrl, paymentForm: payment.paymentForm ?? null } });
      return orderJson(updated);
    } catch (error) {
      await this.prisma.creditRechargeOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      throw error;
    }
  }

  /** 电脑网站支付托管页：校验订单归属与有效期后渲染自动提交的支付宝表单。 */
  async paymentPageHtml(orderId: string): Promise<string> {
    const order = await this.prisma.creditRechargeOrder.findUnique({ where: { id: orderId } });
    if (!order || !order.paymentForm || order.status !== 'PENDING') throw Object.assign(new Error('充值订单不存在或已失效。'), { status: 404, code: 'VALIDATION_FAILED' });
    if (order.expiresAt <= new Date()) throw Object.assign(new Error('充值订单已过期，请在客户端重新发起充值。'), { status: 410, code: 'VALIDATION_FAILED' });
    const fields = JSON.parse(order.paymentForm) as Record<string, string>;
    const inputs = Object.entries(fields).map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}"/>`).join('');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>正在跳转到支付宝收银台 - LingBuilder</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b1020;color:#e6e9f2}</style></head><body><p>正在跳转到支付宝收银台，请稍候…</p><form id="alipaysubmit" action="https://openapi.alipay.com/gateway.do?charset=utf-8" method="POST" accept-charset="utf-8">${inputs}</form><script>document.getElementById('alipaysubmit').submit();</script></body></html>`;
  }

  async orderStatus(userId: string, orderId: string) {
    const order = await this.prisma.creditRechargeOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw Object.assign(new Error('充值订单不存在。'), { status: 404, code: 'VALIDATION_FAILED' });
    if (order.status === 'PENDING' && order.expiresAt <= new Date()) {
      const expired = await this.prisma.creditRechargeOrder.update({ where: { id: order.id }, data: { status: 'EXPIRED' } });
      return orderJson(expired);
    }
    return orderJson(order);
  }

  async listOrders(userId: string) {
    const rows = await this.prisma.creditRechargeOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map(orderJson);
  }

  async findByProviderOrder(provider: PaymentProviderId, providerOrderId: string) {
    return await this.prisma.creditRechargeOrder.findFirst({ where: { provider, providerOrderId } });
  }

  async handlePaymentEvent(provider: PaymentProviderId, event: VerifiedPaymentEvent, rawBody: string) {
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    return await this.prisma.$transaction(async tx => {
      const seen = await tx.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider, eventId: event.eventId } } });
      if (seen) return { ok: true, duplicate: true };
      const order = await tx.creditRechargeOrder.findFirst({ where: { provider, providerOrderId: event.providerOrderId } });
      if (!order) throw Object.assign(new Error('支付回调对应充值订单不存在。'), { status: 404, code: 'VALIDATION_FAILED' });
      await tx.paymentWebhookEvent.create({ data: { provider, eventId: event.eventId, orderId: order.id, eventType: event.status, payloadHash } });
      if (event.status === 'refunded') {
        if (order.status !== 'PAID') return { ok: true, refunded: true };
        const account = await tx.creditAccount.upsert({ where: { userId: order.userId }, create: { userId: order.userId }, update: {} });
        const deduction = account.available < order.points ? account.available : order.points;
        const next = await tx.creditAccount.update({ where: { userId: order.userId }, data: { available: { decrement: deduction }, version: { increment: 1 } } });
        await tx.creditLedger.create({ data: { userId: order.userId, kind: 'REFUND', availableDelta: -deduction, reservedDelta: 0n, balanceAfter: next.available, reason: `充值退款回收点数（订单 ${order.id}）` } });
        await tx.creditRechargeOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED', refundedAt: new Date() } });
        return { ok: true, refunded: true };
      }
      if (order.status === 'PAID') return { ok: true, duplicate: true };
      if (order.amountMinor.toString() !== String(event.amountMinor) || order.currency !== String(event.currency || 'CNY')) throw Object.assign(new Error('充值金额或币种与订单快照不一致。'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
      const now = new Date();
      const account = await tx.creditAccount.upsert({ where: { userId: order.userId }, create: { userId: order.userId, available: order.points, lifetimeGranted: order.points }, update: { available: { increment: order.points }, lifetimeGranted: { increment: order.points }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId: order.userId, kind: 'RECHARGE', availableDelta: order.points, reservedDelta: 0n, balanceAfter: account.available, reason: `在线充值 ${order.packageName}（订单 ${order.id}）` } });
      await tx.creditRechargeOrder.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: now } });
      return { ok: true, paid: true };
    }, { isolationLevel: 'Serializable' });
  }
}

function orderJson(order: any) {
  return JSON.parse(JSON.stringify({ id: order.id, provider: String(order.provider).toLowerCase(), status: String(order.status).toLowerCase(), amountMinor: order.amountMinor, currency: order.currency, points: order.points, packageName: order.packageName, paymentUrl: order.paymentUrl, paymentForm: order.paymentForm ?? null, paidAt: order.paidAt, expiresAt: order.expiresAt, createdAt: order.createdAt }, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}
