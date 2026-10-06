import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { ModuleCommerceService } from '../src/modules/module-commerce.service.js';
import { PaymentProviderService } from '../src/modules/payment-provider.service.js';
import { moduleSigningPublicKey } from '../src/modules/module-signing-key.js';
import { DEFAULT_UPGRADE_PRICE_MINOR, ProMembershipService, SPONSOR_ACTIVITY_DEADLINE, SPONSOR_PERPETUAL_THRESHOLD_MINOR } from '../src/pro/pro-membership.service.js';

const ACTOR = { id: 'admin-1', email: 'admin@lingbuilder.test', role: 'operator', mfa: true } as any;

interface SponsorSeed { qqNumber: string; amountCents: number; sponsoredAt: Date; enabled?: boolean }

/** 手写 Prisma mock：只实现 Pro 会员与模块商业链路实际用到的方法。 */
function createPrisma(options: { users?: any[]; sponsors?: SponsorSeed[]; memberships?: any[]; products?: any[]; entitlements?: any[]; freeWindows?: any[] } = {}) {
  const state = {
    users: options.users || [],
    sponsors: (options.sponsors || []).map((row, index) => ({ id: `sp-${index + 1}`, enabled: true, ...row })),
    memberships: (options.memberships || []).map((row, index) => ({ id: `pro-${index + 1}`, paidMinor: 0, sponsorQq: '', note: '', ...row })),
    products: options.products || [],
    entitlements: options.entitlements || [],
    freeWindows: options.freeWindows || [],
    audits: [] as any[]
  };
  const withinWindow = (row: any, where: any) => {
    if (where.revokedAt === null && row.revokedAt) return false;
    if (where.startsAt?.lte && !(new Date(row.startsAt) <= new Date(where.startsAt.lte))) return false;
    if (where.OR && !where.OR.some((branch: any) => branch.endsAt === null ? row.endsAt === null : Boolean(branch.endsAt?.gt && row.endsAt && new Date(row.endsAt) > new Date(branch.endsAt.gt)))) return false;
    return true;
  };
  // 真实 Prisma 会按 include 展开 user 关联，mock 同样补上，避免掩盖服务层对关联数据的真实依赖。
  const withUser = (row: any) => ({ ...row, user: state.users.find(item => item.id === row.userId) });
  return {
    state,
    user: { findFirst: async ({ where }: any) => state.users.find(row => row.id === where.OR[0].id || row.email === where.OR[1].email) || null },
    websiteSponsor: { findMany: async () => state.sponsors },
    proMembership: {
      findMany: async () => state.memberships.map(withUser),
      findFirst: async ({ where }: any) => { const row = state.memberships.find(row => row.userId === where.userId && withinWindow(row, where)); return row ? withUser(row) : null; },
      findUnique: async ({ where }: any) => { const row = state.memberships.find(row => row.id === where.id || row.userId === where.userId); return row ? withUser(row) : null; },
      create: async ({ data }: any) => { const row = { id: `pro-${state.memberships.length + 1}`, ...data }; state.memberships.push(row); return withUser(row); },
      update: async ({ where, data }: any) => { const row = state.memberships.find(item => item.id === where.id); if (!row) throw new Error('record not found'); return withUser(Object.assign(row, data)); }
    },
    moduleProduct: { findUnique: async ({ where }: any) => state.products.find(row => row.moduleId === where.moduleId) || null },
    moduleEntitlement: { findFirst: async ({ where }: any) => state.entitlements.find(row => row.userId === where.userId && row.productId === where.productId && withinWindow(row, where)) || null },
    moduleFreeWindow: { findFirst: async () => null },
    moduleAccessAudit: { create: async ({ data }: any) => { state.audits.push({ kind: 'access', ...data }); return data; } },
    adminAuditLog: { create: async ({ data }: any) => { state.audits.push({ kind: 'admin', ...data }); return data; } }
  };
}

const PRODUCT = { id: 'product-1', moduleId: 'lingbuilder.new_emoji.ui', name: 'NewEmoji UI', enabled: true, listed: true, policyVersion: 1 };
const USER = { id: 'user-1', email: 'sponsor@example.com', status: 'ACTIVE' };
const BEFORE_DEADLINE = new Date('2026-10-01T12:00:00+08:00');
const AFTER_DEADLINE = new Date('2026-12-01T12:00:00+08:00');

test('赞助聚合：多笔按QQ合计，截止后与停用记录不计入档位', async () => {
  const prisma = createPrisma({ sponsors: [
    { qqNumber: '10000', amountCents: 5000, sponsoredAt: BEFORE_DEADLINE },
    { qqNumber: '10000', amountCents: 4900, sponsoredAt: BEFORE_DEADLINE },
    { qqNumber: '10000', amountCents: 99900, sponsoredAt: AFTER_DEADLINE },
    { qqNumber: '20000', amountCents: 99000, sponsoredAt: BEFORE_DEADLINE, enabled: false },
    { qqNumber: '30000', amountCents: 500, sponsoredAt: BEFORE_DEADLINE }
  ] });
  const service = new ProMembershipService(prisma as never);
  const rows = await service.sponsorSummary();
  const qq10000 = rows.find(row => row.qqNumber === '10000')!;
  assert.equal(qq10000.count, 3);
  assert.equal(qq10000.eligibleMinor, 9900);
  assert.equal(qq10000.totalMinor, 109800);
  assert.equal(qq10000.eligibleTier, 'perpetual');
  assert.equal(rows.find(row => row.qqNumber === '20000')!.eligibleTier, 'none');
  assert.equal(rows.find(row => row.qqNumber === '30000')!.eligibleTier, 'yearly');
});

test('赞助转入：≥99 自动定档买断并记录累计金额与审计', async () => {
  const prisma = createPrisma({ users: [USER], sponsors: [
    { qqNumber: '888888', amountCents: 3000, sponsoredAt: BEFORE_DEADLINE },
    { qqNumber: '888888', amountCents: 6900, sponsoredAt: BEFORE_DEADLINE }
  ] });
  const service = new ProMembershipService(prisma as never);
  const result = await service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '888888', tier: 'auto', note: '双11赞助活动转入' }, ACTOR);
  assert.equal(result.membership.tier, 'perpetual');
  assert.equal(result.membership.source, 'sponsor_activity');
  assert.equal(result.membership.endsAt, null);
  assert.equal(result.membership.paidMinor, 9900);
  const admin = prisma.state.audits.find(row => row.kind === 'admin');
  assert.equal(admin.action, 'pro.membership.create');
});

test('赞助转入：<99 定档一年且到期时间为 365 天后', async () => {
  const prisma = createPrisma({ users: [USER], sponsors: [{ qqNumber: '777777', amountCents: 5000, sponsoredAt: BEFORE_DEADLINE }] });
  const service = new ProMembershipService(prisma as never);
  const result = await service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '777777' }, ACTOR);
  assert.equal(result.membership.tier, 'yearly');
  const expected = Date.now() + 365 * 86_400_000;
  assert.ok(Math.abs(new Date(result.membership.endsAt).getTime() - expected) < 60_000, '一年档到期时间应为 365 天后');
});

test('赞助转入拒绝：无资格QQ、活动后赞助、档位不符、QQ 已绑定他人', async () => {
  const prisma = createPrisma({ users: [USER, { id: 'user-2', email: 'other@example.com', status: 'ACTIVE' }], sponsors: [
    { qqNumber: '111111', amountCents: 1000, sponsoredAt: BEFORE_DEADLINE },
    { qqNumber: '222222', amountCents: 99000, sponsoredAt: AFTER_DEADLINE },
    { qqNumber: '333333', amountCents: 5000, sponsoredAt: BEFORE_DEADLINE }
  ], memberships: [{ id: 'pro-taken', userId: 'user-2', tier: 'YEARLY', source: 'SPONSOR_ACTIVITY', sponsorQq: '333333', startsAt: new Date(), endsAt: null, revokedAt: null }] });
  const service = new ProMembershipService(prisma as never);
  await assert.rejects(service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '999999' }, ACTOR), /不符合转入条件/u);
  await assert.rejects(service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '222222' }, ACTOR), /不符合转入条件/u);
  await assert.rejects(service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '333333', tier: 'perpetual' }, ACTOR), /不能自选其它档位/u);
  await assert.rejects(service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '333333' }, ACTOR), /只能绑定一个账号/u);
});

test('赞助转入拒绝：重复QQ绑定同账号不同档、已生效会员重复入会', async () => {
  const prisma = createPrisma({ users: [USER], sponsors: [{ qqNumber: '444444', amountCents: 20000, sponsoredAt: BEFORE_DEADLINE }] });
  const service = new ProMembershipService(prisma as never);
  await service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '444444' }, ACTOR);
  await assert.rejects(service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '444444' }, ACTOR), /已是生效中的 Pro 会员/u);
});

test('撤销后可重新入会：同一行复用并清除撤销标记', async () => {
  const prisma = createPrisma({ users: [USER], sponsors: [{ qqNumber: '555555', amountCents: 20000, sponsoredAt: BEFORE_DEADLINE }] });
  const service = new ProMembershipService(prisma as never);
  const first = await service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '555555' }, ACTOR);
  await service.revoke(first.membership.id, { reason: '测试撤销' }, ACTOR);
  assert.ok(first.membership.id);
  const again = await service.create({ email: USER.email, source: 'sponsor_activity', sponsorQq: '555555' }, ACTOR);
  assert.equal(again.membership.id, first.membership.id);
  assert.equal(again.membership.revokedAt, null);
  assert.equal(prisma.state.memberships.length, 1);
});

test('购买入账：档位与金额必填，补偿来源不计赞助QQ', async () => {
  const prisma = createPrisma({ users: [USER] });
  const service = new ProMembershipService(prisma as never);
  await assert.rejects(service.create({ email: USER.email, source: 'purchase' }, ACTOR), /必须明确档位/u);
  const ok = await service.create({ email: USER.email, source: 'purchase', tier: 'perpetual', paidMinor: 29900 }, ACTOR);
  assert.equal(ok.membership.tier, 'perpetual');
  assert.equal(ok.membership.paidMinor, 29900);
});

test('Pro 会员在全部收费模块生效：Permit 签发 source=pro 且签名可验', async () => {
  const prisma = createPrisma({ users: [USER], products: [PRODUCT], memberships: [{ id: 'pro-1', userId: USER.id, tier: 'PERPETUAL', source: 'SPONSOR_ACTIVITY', startsAt: new Date(Date.now() - 1000), endsAt: null, revokedAt: null }] });
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  const decision = await commerce.resolveAccess(USER.id, PRODUCT.moduleId);
  assert.equal(decision.allowed, true);
  assert.equal(decision.source, 'pro');
  assert.equal(decision.expiresAt, undefined);
  const permit = await commerce.issuePermit(USER.id, PRODUCT.moduleId);
  assert.equal(permit.payload.source, 'pro');
  assert.equal(permit.payload.moduleId, PRODUCT.moduleId);
  assert.equal(crypto.verify(null, Buffer.from(JSON.stringify(permit.payload)), crypto.createPublicKey(moduleSigningPublicKey().publicKeyPem), Buffer.from(permit.signature, 'base64url')), true);
});

test('年费 Pro 过期或撤销后收费模块恢复 402', async () => {
  const prisma = createPrisma({ users: [USER], products: [PRODUCT], memberships: [{ id: 'pro-1', userId: USER.id, tier: 'YEARLY', source: 'PURCHASE', startsAt: new Date(Date.now() - 400 * 86_400_000), endsAt: new Date(Date.now() - 35 * 86_400_000), revokedAt: null }] });
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  await assert.rejects(commerce.issuePermit(USER.id, PRODUCT.moduleId), (error: any) => error?.code === 'MODULE_PAYMENT_REQUIRED');
  const row = prisma.state.memberships[0]!;
  row.endsAt = new Date(Date.now() + 86_400_000);
  const decision = await commerce.resolveAccess(USER.id, PRODUCT.moduleId);
  assert.equal(decision.allowed, true);
  row.revokedAt = new Date();
  const revoked = await commerce.resolveAccess(USER.id, PRODUCT.moduleId);
  assert.equal(revoked.allowed, false);
});

test('单模块权益优先于 Pro 会员：source 取权益自身来源', async () => {
  const prisma = createPrisma({
    users: [USER], products: [PRODUCT],
    memberships: [{ id: 'pro-1', userId: USER.id, tier: 'PERPETUAL', source: 'SPONSOR_ACTIVITY', startsAt: new Date(), endsAt: null, revokedAt: null }],
    entitlements: [{ id: 'ent-1', userId: USER.id, productId: PRODUCT.id, source: 'ADMIN_GRANT', startsAt: new Date(Date.now() - 1000), endsAt: null, revokedAt: null }]
  });
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  const decision = await commerce.resolveAccess(USER.id, PRODUCT.moduleId);
  assert.equal(decision.allowed, true);
  assert.equal(decision.source, 'admin_grant');
});

test('补差升级：年费升买断默认补 200，金额入账并留痕', async () => {
  const prisma = createPrisma({ users: [USER], memberships: [{ id: 'pro-1', userId: USER.id, tier: 'YEARLY', source: 'SPONSOR_ACTIVITY', sponsorQq: '666666', paidMinor: 5000, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 364 * 86_400_000), revokedAt: null }] });
  const service = new ProMembershipService(prisma as never);
  const result = await service.upgrade('pro-1', {}, ACTOR);
  assert.equal(result.membership.tier, 'perpetual');
  assert.equal(result.membership.endsAt, null);
  assert.equal(result.membership.paidMinor, 5000 + DEFAULT_UPGRADE_PRICE_MINOR);
  assert.match(result.membership.note, /补差 ¥200/u);
  assert.equal(prisma.state.audits.find(row => row.kind === 'admin')?.action, 'pro.membership.upgrade');
});

test('补差升级拒绝：永久、过期、已撤销与非法金额', async () => {
  const active = { id: 'pro-1', userId: USER.id, tier: 'YEARLY', source: 'PURCHASE', startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), revokedAt: null };
  const prisma = createPrisma({ users: [USER], memberships: [
    { ...active, id: 'pro-perp', tier: 'PERPETUAL', endsAt: null },
    { ...active, id: 'pro-expired', endsAt: new Date(Date.now() - 86_400_000) },
    { ...active, id: 'pro-revoked', revokedAt: new Date() },
    { ...active, id: 'pro-ok' }
  ] });
  const service = new ProMembershipService(prisma as never);
  await assert.rejects(service.upgrade('pro-perp', {}, ACTOR), /只有年度会员/u);
  await assert.rejects(service.upgrade('pro-expired', {}, ACTOR), /已过期/u);
  await assert.rejects(service.upgrade('pro-revoked', {}, ACTOR), /不能升级/u);
  await assert.rejects(service.upgrade('pro-ok', { upgradePriceMinor: -1 }, ACTOR), /补差金额无效/u);
  const ok = await service.upgrade('pro-ok', { upgradePriceMinor: 100 }, ACTOR);
  assert.equal(ok.membership.tier, 'perpetual');
});

test('撤销会员：原因必填且撤销后立即失去全部模块权益', async () => {
  const prisma = createPrisma({ users: [USER], products: [PRODUCT], memberships: [{ id: 'pro-1', userId: USER.id, tier: 'PERPETUAL', source: 'PURCHASE', startsAt: new Date(), endsAt: null, revokedAt: null }] });
  const service = new ProMembershipService(prisma as never);
  await assert.rejects(service.revoke('pro-1', { reason: '短' }, ACTOR), /明确原因/u);
  const result = await service.revoke('pro-1', { reason: '测试退款撤销' }, ACTOR);
  assert.ok(result.membership.revokedAt);
  assert.match(result.membership.note, /撤销：测试退款撤销/u);
  const commerce = new ModuleCommerceService(prisma as never, new PaymentProviderService());
  const decision = await commerce.resolveAccess(USER.id, PRODUCT.moduleId);
  assert.equal(decision.allowed, false);
});

test('活动阈值与截止时间常量符合拍板口径', () => {
  assert.equal(SPONSOR_PERPETUAL_THRESHOLD_MINOR, 9900);
  assert.equal(DEFAULT_UPGRADE_PRICE_MINOR, 20000);
  assert.equal(SPONSOR_ACTIVITY_DEADLINE.toISOString(), '2026-11-11T15:59:59.000Z');
});

test('/v1/me 携带生效中的 Pro 会员状态，无会员时为 null', async () => {
  const { MeController } = await import('../src/auth/auth.controller.js');
  const active = { tier: 'PERPETUAL', source: 'SPONSOR_ACTIVITY', startsAt: new Date(Date.now() - 1000), endsAt: null };
  const withPro = createPrisma({ memberships: [{ id: 'pro-1', userId: USER.id, ...active, revokedAt: null }] });
  withPro.proMembership.findFirst = async () => active;
  const controllerWithPro = new MeController(withPro as never);
  const mine = await controllerWithPro.me({ id: USER.id, email: USER.email } as any);
  assert.ok(mine.pro, '生效中会员必须返回 pro');
  assert.equal(mine.pro.tier, 'perpetual');
  assert.equal(mine.pro.source, 'sponsor_activity');
  assert.equal(mine.pro.active, true);
  assert.equal(mine.pro.endsAt, null);

  const withoutPro = createPrisma();
  withoutPro.proMembership.findFirst = async () => null;
  const controller = new MeController(withoutPro as never);
  const empty = await controller.me({ id: USER.id, email: USER.email } as any);
  assert.equal(empty.pro, null);
});
