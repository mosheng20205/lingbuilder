import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { PaymentProviderService, type PaymentProviderId } from './payment-provider.service.js';
import { moduleSigningKeyPair, moduleSigningPublicKey } from './module-signing-key.js';

const OFFLINE_PERMIT_MS = 72 * 60 * 60 * 1000;
export interface ModuleAccessDecision { allowed: boolean; source?: string; expiresAt?: Date; productId: string; policyVersion: number; reason?: string }

@Injectable()
export class ModuleCommerceService {
  private readonly permitKeyPair = moduleSigningKeyPair();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(PaymentProviderService) private readonly payments: PaymentProviderService) {}

  async catalog(userId?: string) {
    const now = new Date();
    const products = await this.prisma.moduleProduct.findMany({ where: { listed: true, enabled: true }, include: { offers: { where: { enabled: true }, orderBy: { priceMinor: 'asc' } }, freeWindows: { where: { enabled: true, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' } } }, orderBy: { name: 'asc' } });
    return await Promise.all(products.map(async product => {
      const access = userId ? await this.resolveAccess(userId, product.moduleId, false) : undefined;
      const freeWindow = product.freeWindows.find(window => window.startsAt <= now && window.endsAt > now) || product.freeWindows[0];
      return json({ moduleId: product.moduleId, productId: product.id, name: product.name, description: product.description, listed: product.listed, enabled: product.enabled, policyVersion: product.policyVersion, offers: product.offers.map(offer => ({ id: offer.id, productId: offer.productId, name: offer.name, kind: offer.kind.toLowerCase(), priceMinor: offer.priceMinor, currency: offer.currency, durationDays: offer.durationDays })), freeWindow, access });
    }));
  }

  async resolveAccess(userId: string, moduleId: string, writeAudit = true): Promise<ModuleAccessDecision> {
    const now = new Date();
    const product = await this.prisma.moduleProduct.findUnique({ where: { moduleId } });
    if (!product || !product.enabled) return { allowed: true, source: 'unmetered', productId: '', policyVersion: 0 };
    const entitlement = await this.prisma.moduleEntitlement.findFirst({ where: { userId, productId: product.id, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: [{ endsAt: 'desc' }, { createdAt: 'desc' }] });
    let result: ModuleAccessDecision;
    if (entitlement) result = { allowed: true, source: entitlement.source.toLowerCase(), expiresAt: entitlement.endsAt || undefined, productId: product.id, policyVersion: product.policyVersion };
    else {
      const freeWindow = await this.prisma.moduleFreeWindow.findFirst({ where: { productId: product.id, enabled: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: 'desc' } });
      result = freeWindow
        ? { allowed: true, source: 'free_window', expiresAt: freeWindow.endsAt, productId: product.id, policyVersion: product.policyVersion }
        : { allowed: false, productId: product.id, policyVersion: product.policyVersion, reason: '该模块需要购买，且当前不在限时免费时段。' };
    }
    if (writeAudit) await this.prisma.moduleAccessAudit.create({ data: { userId, productId: product.id, moduleId, action: 'access.check', allowed: result.allowed, source: result.source, reason: result.reason } });
    return result;
  }

  async issuePermit(userId: string, moduleId: string) {
    const access = await this.resolveAccess(userId, moduleId);
    if (!access.allowed || !access.source || access.source === 'unmetered' || !access.productId) {
      throw Object.assign(new Error(access.reason || '该模块没有可签发的收费商品权益。'), { status: 402, code: 'MODULE_PAYMENT_REQUIRED' });
    }
    const now = new Date();
    const offlineLimit = new Date(now.getTime() + OFFLINE_PERMIT_MS);
    const expiresAt = access.expiresAt && access.expiresAt < offlineLimit ? access.expiresAt : offlineLimit;
    const payload = { version: 1, keyId: this.permitKeyPair.keyId, userId, moduleId, source: access.source, policyVersion: access.policyVersion, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), serverTime: now.toISOString() };
    const serialized = Buffer.from(JSON.stringify(payload));
    return { payload, signature: crypto.sign(null, serialized, this.permitKeyPair.privateKey).toString('base64url') };
  }

  permitPublicKey() { return moduleSigningPublicKey(); }

  async listEntitlements(userId: string) {
    const rows = await this.prisma.moduleEntitlement.findMany({ where: { userId }, include: { product: true }, orderBy: { createdAt: 'desc' } });
    return json(rows.map(row => ({ id: row.id, moduleId: row.product.moduleId, source: row.source.toLowerCase(), startsAt: row.startsAt, endsAt: row.endsAt, revokedAt: row.revokedAt })));
  }

  async listOrders(userId: string) {
    const rows = await this.prisma.moduleOrder.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return rows.map(orderJson);
  }

  async createOrder(userId: string, offerId: string, provider: PaymentProviderId, idempotencyKey: string) {
    if (!idempotencyKey || idempotencyKey.length > 128) throw Object.assign(new Error('订单幂等键无效。'), { status: 400, code: 'VALIDATION_FAILED' });
    const existing = await this.prisma.moduleOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: { product: true } });
    if (existing) return orderJson(existing);
    const offer = await this.prisma.moduleOffer.findUnique({ where: { id: offerId }, include: { product: true } });
    if (!offer || !offer.enabled || !offer.product.enabled || !offer.product.listed) throw Object.assign(new Error('模块报价不存在或已下架。'), { status: 404, code: 'VALIDATION_FAILED' });
    if (offer.priceMinor <= 0n) throw Object.assign(new Error('零价模块无需创建支付订单。'), { status: 400, code: 'VALIDATION_FAILED' });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const order = await this.prisma.moduleOrder.create({ data: { userId, productId: offer.productId, offerId: offer.id, idempotencyKey, provider, amountMinor: offer.priceMinor, currency: offer.currency, offerKind: offer.kind, durationDays: offer.durationDays, expiresAt }, include: { product: true } });
    try {
      const payment = await this.payments.createOrder(provider, { id: order.id, subject: `${offer.product.name} - ${offer.name}`, amountMinor: offer.priceMinor, expiresAt });
      const updated = await this.prisma.moduleOrder.update({ where: { id: order.id }, data: payment, include: { product: true } });
      return orderJson(updated);
    } catch (error) {
      await this.prisma.moduleOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      throw error;
    }
  }

  async paymentWebhook(provider: PaymentProviderId, rawBody: string, headers: Record<string, string | string[] | undefined>) {
    const event = this.payments.verifyWebhook(provider, rawBody, headers);
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    return await this.prisma.$transaction(async tx => {
      const seen = await tx.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider, eventId: event.eventId } } });
      if (seen) return { ok: true, duplicate: true };
      const order = await tx.moduleOrder.findFirst({ where: { provider, providerOrderId: event.providerOrderId } });
      if (!order) throw Object.assign(new Error('支付回调对应订单不存在。'), { status: 404, code: 'VALIDATION_FAILED' });
      await tx.paymentWebhookEvent.create({ data: { provider, eventId: event.eventId, orderId: order.id, eventType: event.status, payloadHash } });
      if (event.status === 'refunded') {
        await tx.moduleOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED', refundedAt: new Date() } });
        await tx.moduleEntitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: new Date(), reason: '支付退款' } });
        return { ok: true, refunded: true };
      }
      if (order.status === 'PAID') return { ok: true, duplicate: true };
      if (order.amountMinor.toString() !== String(event.amountMinor) || order.currency !== String(event.currency || 'CNY')) throw Object.assign(new Error('支付金额或币种与订单快照不一致。'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
      const now = new Date();
      const endsAt = order.offerKind === 'FIXED_TERM' ? new Date(now.getTime() + (order.durationDays || 0) * 86_400_000) : null;
      await tx.moduleOrder.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: now } });
      await tx.moduleEntitlement.create({ data: { userId: order.userId, productId: order.productId, orderId: order.id, source: 'PURCHASE', startsAt: now, endsAt, reason: '模块订单支付成功' } });
      return { ok: true, paid: true };
    }, { isolationLevel: 'Serializable' });
  }
}

function json<T>(value: T): T { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)); }
function orderJson(order: any) { return json({ id: order.id, moduleId: order.product?.moduleId, offerId: order.offerId, provider: String(order.provider).toLowerCase(), status: String(order.status).toLowerCase(), amountMinor: order.amountMinor, currency: order.currency, paymentUrl: order.paymentUrl, paidAt: order.paidAt, expiresAt: order.expiresAt, createdAt: order.createdAt }); }
