import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/current-user.js';
import { PrismaService } from '../prisma.service.js';
import { ModuleArtifactService } from './module-artifact.service.js';
import { PaymentProviderService } from './payment-provider.service.js';

@Controller('v1/admin/modules')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class ModuleAdminController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(PaymentProviderService) private readonly payments: PaymentProviderService, @Inject(ModuleArtifactService) private readonly artifacts: ModuleArtifactService) {}

  @Get() async overview() {
    const [products, orders, entitlements, artifacts] = await Promise.all([
      this.prisma.moduleProduct.findMany({ include: { offers: true, freeWindows: { orderBy: { startsAt: 'desc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.moduleOrder.findMany({ include: { product: true, offer: true, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.prisma.moduleEntitlement.findMany({ include: { product: true, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.artifacts.listArtifacts()
    ]);
    return json({ ok: true, products, orders, entitlements, artifacts, payment: this.payments.configurationStatus(), artifactReadiness: this.artifacts.readiness() });
  }

  @Post('products') @Roles('super_admin', 'operator') async upsertProduct(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const moduleId = String(body.moduleId || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(moduleId)) throw validation('模块 ID 格式无效。');
    const product = await this.prisma.moduleProduct.upsert({ where: { moduleId }, create: { moduleId, name: String(body.name || moduleId), description: String(body.description || ''), listed: body.listed === true, enabled: body.enabled !== false }, update: { name: String(body.name || moduleId), description: String(body.description || ''), listed: body.listed === true, enabled: body.enabled !== false, policyVersion: { increment: 1 } } });
    await this.audit(actor, 'module.product.upsert', 'module-product', product.id, { moduleId });
    return { ok: true, product };
  }

  @Post('products/:productId/offers') @Roles('super_admin', 'operator') async createOffer(@Param('productId') productId: string, @Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const kind = body.kind === 'fixed_term' ? 'FIXED_TERM' : body.kind === 'perpetual' ? 'PERPETUAL' : '';
    const priceMinor = BigInt(String(body.priceMinor || '0'));
    const durationDays = kind === 'FIXED_TERM' ? Number(body.durationDays || 0) : null;
    if (!kind || priceMinor <= 0n || (kind === 'FIXED_TERM' && (!Number.isInteger(durationDays) || durationDays! < 1))) throw validation('报价类型、金额或授权天数无效。');
    const offer = await this.prisma.moduleOffer.create({ data: { productId, name: String(body.name || ''), kind, priceMinor, currency: 'CNY', durationDays, enabled: body.enabled !== false } });
    await this.prisma.moduleProduct.update({ where: { id: productId }, data: { policyVersion: { increment: 1 } } });
    await this.audit(actor, 'module.offer.create', 'module-offer', offer.id, { productId, kind, priceMinor: priceMinor.toString() });
    return json({ ok: true, offer });
  }

  @Post('products/:productId/free-windows') @Roles('super_admin', 'operator') async createFreeWindow(@Param('productId') productId: string, @Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const startsAt = new Date(body.startsAt); const endsAt = body.endsAt ? new Date(body.endsAt) : new Date(startsAt.getTime() + 86_400_000);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw validation('限免开始或结束时间无效。');
    const window = await this.prisma.moduleFreeWindow.create({ data: { productId, name: String(body.name || '模块限时免费'), startsAt, endsAt, timezone: String(body.timezone || 'Asia/Shanghai'), enabled: body.enabled !== false } });
    await this.prisma.moduleProduct.update({ where: { id: productId }, data: { policyVersion: { increment: 1 } } });
    await this.audit(actor, 'module.free-window.create', 'module-free-window', window.id, { productId, startsAt, endsAt });
    return { ok: true, freeWindow: window };
  }

  @Patch('free-windows/:windowId') @Roles('super_admin', 'operator') async updateFreeWindow(@Param('windowId') windowId: string, @Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const current = await this.prisma.moduleFreeWindow.findUniqueOrThrow({ where: { id: windowId } });
    const startsAt = body.startsAt ? new Date(body.startsAt) : current.startsAt; const endsAt = body.endsAt ? new Date(body.endsAt) : current.endsAt;
    if (endsAt <= startsAt) throw validation('限免结束时间必须晚于开始时间。');
    const window = await this.prisma.moduleFreeWindow.update({ where: { id: windowId }, data: { name: body.name === undefined ? undefined : String(body.name), startsAt, endsAt, timezone: body.timezone === undefined ? undefined : String(body.timezone), enabled: body.enabled === undefined ? undefined : body.enabled === true } });
    await this.prisma.moduleProduct.update({ where: { id: current.productId }, data: { policyVersion: { increment: 1 } } });
    await this.audit(actor, 'module.free-window.update', 'module-free-window', windowId, { startsAt, endsAt, enabled: window.enabled });
    return { ok: true, freeWindow: window };
  }

  @Post('entitlements/grant') @Roles('super_admin', 'operator', 'support') async grant(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const product = await this.prisma.moduleProduct.findUnique({ where: { moduleId: String(body.moduleId || '') } });
    if (!product) throw validation('模块商品不存在。');
    const userInput = String(body.userId || body.email || '').trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ id: userInput }, { email: userInput }] } });
    if (!user) throw validation('授权用户不存在，请填写用户 ID 或注册邮箱。');
    const startsAt = new Date(); const endsAt = body.durationDays ? new Date(startsAt.getTime() + Number(body.durationDays) * 86_400_000) : null;
    const reason = String(body.reason || '').trim(); if (reason.length < 3) throw validation('管理员授权必须填写明确原因。');
    const entitlement = await this.prisma.moduleEntitlement.create({ data: { userId: user.id, productId: product.id, source: 'ADMIN_GRANT', startsAt, endsAt, reason } });
    await this.audit(actor, 'module.entitlement.grant', 'module-entitlement', entitlement.id, { userId: user.id, email: user.email, moduleId: product.moduleId, endsAt, reason });
    return { ok: true, entitlement };
  }

  @Post('entitlements/:entitlementId/revoke') @Roles('super_admin', 'operator', 'support') async revoke(@Param('entitlementId') entitlementId: string, @Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    const reason = String(body.reason || '').trim(); if (reason.length < 3) throw validation('撤销权益必须填写明确原因。');
    const entitlement = await this.prisma.moduleEntitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date(), reason } });
    await this.audit(actor, 'module.entitlement.revoke', 'module-entitlement', entitlementId, { reason });
    return { ok: true, entitlement };
  }

  @Get('orders') async orders() { return json({ ok: true, orders: await this.prisma.moduleOrder.findMany({ include: { product: true, offer: true, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }) }); }

  @Get('entitlements') async entitlements() { return json({ ok: true, entitlements: await this.prisma.moduleEntitlement.findMany({ include: { product: true, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }) }); }

  @Put('artifacts/:moduleId/:version') @Roles('super_admin', 'operator') async publishArtifact(
    @Param('moduleId') moduleId: string,
    @Param('version') version: string,
    @Headers('x-module-arch') arch = 'any',
    @Headers('x-module-file-name') encodedFileName = 'module.lbmod',
    @Headers('x-minimum-ide-version') minimumIdeVersion = '',
    @Req() request: Request,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    let fileName = encodedFileName;
    try { fileName = decodeURIComponent(encodedFileName); } catch { throw validation('模块制品文件名编码无效。'); }
    const artifact = await this.artifacts.upload(request, { moduleId, version, arch, fileName, minimumIdeVersion }, actor.id);
    return { ok: true, artifact };
  }

  @Patch('artifacts/:artifactId') @Roles('super_admin', 'operator') async updateArtifact(@Param('artifactId') artifactId: string, @Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return { ok: true, artifact: await this.artifacts.setEnabled(artifactId, body.enabled === true, actor.id) };
  }

  private async audit(actor: AuthenticatedUser, action: string, targetType: string, targetId: string, details: unknown) { await this.prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action, targetType, targetId, requestId: crypto.randomUUID(), details: details as any } }); }
}

function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function json<T>(value: T): T { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)); }
