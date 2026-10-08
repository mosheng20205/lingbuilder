import { Inject, Injectable, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import crypto from 'node:crypto';
import type { AuthenticatedUser } from '../common/current-user.js';
import { PREVIEW_CHANNEL_SUSPENDED_FLAG } from '../beta-program/beta-program.service.js';
import { PrismaService } from '../prisma.service.js';

type JsonRecord = Record<string, unknown>;

// 赞助转 Pro 活动规则（2026-10-05 拍板）：活动截止 2026-11-11（北京时间）；
// 截止前累计赞助 ≥ ¥99 → 永久买断；< ¥99 → 赠送一年（参照 99/年 档）。
export const SPONSOR_ACTIVITY_DEADLINE = new Date('2026-11-11T23:59:59+08:00');
export const SPONSOR_PERPETUAL_THRESHOLD_MINOR = 9900;
export const YEARLY_DURATION_DAYS = 365;
// 年费会员升级买断的默认补差价：299（买断）− 99（年费）= 200 元，管理员可改。
export const DEFAULT_UPGRADE_PRICE_MINOR = 20000;

export interface SponsorSummaryRow {
  qqNumber: string;
  count: number;
  totalMinor: number;
  eligibleMinor: number;
  lastSponsoredAt: string;
  eligibleTier: 'perpetual' | 'yearly' | 'none';
  convertedEmail: string;
}

@Injectable()
export class ProMembershipService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Optional() @Inject(JwtService) private readonly jwt?: JwtService) {}

  /**
   * latest-version 预览渠道门禁（2026-10-07 起）：解析可选 Bearer token，只有「账号激活 + Pro 会员生效中 + 渠道未暂停」才允许读 preview。
   * 体验计划名单不再参与该判定（名单/报名保留为独立功能）；任何一步不满足都返回 false，由调用方静默降级为 stable，绝不能把更新检查变成报错。
   */
  async resolvePreviewAccess(authorizationHeader: unknown) {
    const token = /^Bearer\s+(.+)$/iu.exec(String(authorizationHeader || ''))?.[1];
    if (!token || !this.jwt) return false;
    try {
      const payload = await this.jwt.verifyAsync(token);
      const now = new Date();
      const user = await this.prisma.user.findFirst({
        where: {
          id: String(payload.sub || ''),
          status: 'ACTIVE',
          proMembership: { revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
        },
        select: { id: true }
      });
      if (!user) return false;
      const flag = await this.prisma.systemFlag.findUnique({ where: { key: PREVIEW_CHANNEL_SUSPENDED_FLAG } });
      return flag?.value !== 'true';
    } catch {
      return false;
    }
  }

  async adminSnapshot() {
    const [memberships, sponsors, commandRules] = await Promise.all([
      this.prisma.proMembership.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: 'desc' } }),
      this.sponsorSummary(),
      this.listCommandRules()
    ]);
    const now = new Date();
    return {
      ok: true,
      config: { thresholdMinor: SPONSOR_PERPETUAL_THRESHOLD_MINOR, deadline: SPONSOR_ACTIVITY_DEADLINE.toISOString(), upgradePriceMinor: DEFAULT_UPGRADE_PRICE_MINOR, yearlyDurationDays: YEARLY_DURATION_DAYS },
      memberships: memberships.map(row => membershipJson(row, now)),
      sponsors,
      commandRules
    };
  }

  /** Pro 专享命令远程开关规则列表（管理端）。 */
  async listCommandRules() {
    const rows = await this.prisma.proCommandRule.findMany({ orderBy: [{ moduleId: 'asc' }, { commandName: 'asc' }] });
    return rows.map(row => ({
      id: row.id,
      moduleId: row.moduleId,
      commandName: row.commandName,
      enabled: row.enabled === true,
      note: row.note || '',
      createdBy: row.createdBy || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  /** 新增远程 Pro 命令规则：同一模块+命令唯一，重复时提示已存在。 */
  async createCommandRule(body: JsonRecord, actor: AuthenticatedUser) {
    const moduleId = String(body.moduleId || '').trim();
    const commandName = String(body.commandName || '').trim();
    const note = String(body.note || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(moduleId)) throw validation('模块 ID 格式无效（小写字母/数字开头，可含点、下划线、中划线）。');
    if (!commandName || commandName.length > 128) throw validation('命令名不能为空且不超过 128 字。');
    if (note.length > 200) throw validation('备注不能超过 200 字。');
    const existing = await this.prisma.proCommandRule.findUnique({ where: { moduleId_commandName: { moduleId, commandName } } });
    if (existing) throw validation(`该命令已有远程规则（${existing.enabled ? '生效中' : '已停用'}），可直接启停或删除后重建。`);
    const rule = await this.prisma.proCommandRule.create({ data: { moduleId, commandName, enabled: body.enabled !== false, note, createdBy: actor.email || actor.id } });
    await this.audit(actor, 'pro.command_rule.create', 'pro-command-rule', rule.id, { moduleId, commandName, enabled: rule.enabled, note });
    return { ok: true, rule };
  }

  async updateCommandRule(id: string, body: JsonRecord, actor: AuthenticatedUser) {
    const rule = await this.prisma.proCommandRule.findUnique({ where: { id } });
    if (!rule) throw validation('远程 Pro 命令规则不存在。');
    const data: { enabled?: boolean; note?: string } = {};
    if (body.enabled !== undefined) data.enabled = body.enabled === true;
    if (body.note !== undefined) {
      const note = String(body.note || '').trim();
      if (note.length > 200) throw validation('备注不能超过 200 字。');
      data.note = note;
    }
    if (!Object.keys(data).length) throw validation('没有需要更新的字段。');
    const updated = await this.prisma.proCommandRule.update({ where: { id }, data });
    await this.audit(actor, 'pro.command_rule.update', 'pro-command-rule', id, { moduleId: rule.moduleId, commandName: rule.commandName, ...data });
    return { ok: true, rule: updated };
  }

  async deleteCommandRule(id: string, actor: AuthenticatedUser) {
    const rule = await this.prisma.proCommandRule.findUnique({ where: { id } });
    if (!rule) throw validation('远程 Pro 命令规则不存在。');
    await this.prisma.proCommandRule.delete({ where: { id } });
    await this.audit(actor, 'pro.command_rule.delete', 'pro-command-rule', id, { moduleId: rule.moduleId, commandName: rule.commandName });
    return { ok: true };
  }

  /** 公开下发（无需登录）：启用中的规则按模块分组；IDE 构建链合并进清单标记。 */
  async publicProCommands() {
    const rules = await this.prisma.proCommandRule.findMany({ where: { enabled: true }, orderBy: { updatedAt: 'asc' } });
    const grouped: Record<string, string[]> = {};
    for (const rule of rules) {
      (grouped[rule.moduleId] ||= []).push(rule.commandName);
    }
    const updatedAt = rules.reduce<string>((latest, rule) => (new Date(rule.updatedAt).toISOString() > latest ? new Date(rule.updatedAt).toISOString() : latest), '');
    return { ok: true, rules: grouped, updatedAt };
  }

  /** 按QQ聚合全部赞助记录：活动截止前的启用金额决定可转入档位；已转入的标注会员邮箱。 */
  async sponsorSummary(): Promise<SponsorSummaryRow[]> {
    const [rows, memberships] = await Promise.all([
      this.prisma.websiteSponsor.findMany({ orderBy: { sponsoredAt: 'asc' } }),
      this.prisma.proMembership.findMany({ include: { user: { select: { email: true } } } })
    ]);
    const converted = new Map<string, string>();
    for (const membership of memberships) {
      const qq = String(membership.sponsorQq || '').trim();
      if (qq && !membership.revokedAt) converted.set(qq, membership.user?.email || '');
    }
    const aggregated = new Map<string, SponsorSummaryRow>();
    for (const row of rows) {
      const qq = String(row.qqNumber || '').trim();
      if (!qq) continue;
      const entry = aggregated.get(qq) || { qqNumber: qq, count: 0, totalMinor: 0, eligibleMinor: 0, lastSponsoredAt: '', eligibleTier: 'none' as const, convertedEmail: '' };
      entry.count += 1;
      const amount = Number(row.amountCents) || 0;
      entry.totalMinor += amount;
      if (row.enabled !== false && new Date(row.sponsoredAt).getTime() <= SPONSOR_ACTIVITY_DEADLINE.getTime()) entry.eligibleMinor += amount;
      const sponsoredAt = new Date(row.sponsoredAt).toISOString();
      if (sponsoredAt > entry.lastSponsoredAt) entry.lastSponsoredAt = sponsoredAt;
      aggregated.set(qq, entry);
    }
    const list = [...aggregated.values()].sort((a, b) => b.eligibleMinor - a.eligibleMinor || b.totalMinor - a.totalMinor);
    for (const entry of list) {
      entry.eligibleTier = entry.eligibleMinor >= SPONSOR_PERPETUAL_THRESHOLD_MINOR ? 'perpetual' : entry.eligibleMinor > 0 ? 'yearly' : 'none';
      entry.convertedEmail = converted.get(entry.qqNumber) || '';
    }
    return list;
  }

  /** 管理员创建 Pro 会员：赞助转入（按活动规则自动定档并校验资格）或录入购买/补偿。 */
  async create(body: JsonRecord, actor: AuthenticatedUser) {
    const userInput = String(body.userId || body.email || '').trim().toLowerCase();
    if (!userInput) throw validation('请填写用户 ID 或注册邮箱。');
    const user = await this.prisma.user.findFirst({ where: { OR: [{ id: userInput }, { email: userInput }] } });
    if (!user) throw validation('授权用户不存在，请填写用户 ID 或注册邮箱。');
    const source = String(body.source || '').trim().toLowerCase();
    if (!['sponsor_activity', 'purchase', 'compensation'].includes(source)) throw validation('会员来源只支持 sponsor_activity、purchase 或 compensation。');
    const sponsorQq = String(body.sponsorQq || '').trim();
    let tier = String(body.tier || 'auto').trim().toLowerCase();
    let paidMinor = Number.parseInt(String(body.paidMinor ?? ''), 10);

    if (source === 'sponsor_activity') {
      if (!/^\d{5,12}$/u.test(sponsorQq)) throw validation('赞助转入必须填写有效的赞助 QQ 号（5 至 12 位数字）。');
      const summary = await this.sponsorSummary();
      const entry = summary.find(item => item.qqNumber === sponsorQq);
      if (!entry || entry.eligibleTier === 'none') throw validation(`该 QQ 在活动截止（${formatDate(SPONSOR_ACTIVITY_DEADLINE)}）前没有启用的赞助记录，不符合转入条件。`);
      const computed = entry.eligibleTier;
      if (tier !== 'auto' && tier !== computed) throw validation(`按活动规则该 QQ 累计 ${formatYuan(entry.eligibleMinor)}，只能转入${computed === 'perpetual' ? '永久买断' : '一年'}档，不能自选其它档位。`);
      tier = computed;
      paidMinor = entry.eligibleMinor;
      if (entry.convertedEmail && entry.convertedEmail !== user.email) throw validation(`该 QQ 已转入到账号 ${entry.convertedEmail}，一个赞助 QQ 只能绑定一个账号。`);
    } else {
      if (!['perpetual', 'yearly'].includes(tier)) throw validation('购买或补偿入账必须明确档位：perpetual 或 yearly。');
      if (!Number.isSafeInteger(paidMinor) || paidMinor! < 0) throw validation('入账金额无效（分），购买入账必须不小于 0。');
    }

    const now = new Date();
    const endsAt = tier === 'perpetual' ? null : new Date(now.getTime() + YEARLY_DURATION_DAYS * 86_400_000);
    const existing = await this.prisma.proMembership.findUnique({ where: { userId: user.id } });
    if (existing && !existing.revokedAt && (!existing.endsAt || existing.endsAt > now)) throw validation(`该账号已是生效中的 Pro 会员（${existing.tier === 'PERPETUAL' ? '永久' : `${formatDate(existing.endsAt)} 到期`}），如需调整请先撤销或使用升级操作。`);
    const note = String(body.note || '').trim();
    const tierValue = tier === 'perpetual' ? 'PERPETUAL' as const : 'YEARLY' as const;
    const sourceValue = source === 'sponsor_activity' ? 'SPONSOR_ACTIVITY' as const : source === 'purchase' ? 'PURCHASE' as const : 'COMPENSATION' as const;
    const data = { userId: user.id, tier: tierValue, source: sourceValue, sponsorQq, paidMinor: paidMinor || 0, startsAt: now, endsAt, revokedAt: null, note };
    const membership = existing
      ? await this.prisma.proMembership.update({ where: { id: existing.id }, data })
      : await this.prisma.proMembership.create({ data });
    await this.audit(actor, 'pro.membership.create', 'pro-membership', membership.id, { email: user.email, tier, source, sponsorQq, paidMinor: paidMinor || 0, endsAt, note });
    return { ok: true, membership: membershipJson(membership, now) };
  }

  /** 年费会员补差升级为买断：默认补 ¥200（299 − 99），金额可由管理员按实际情况调整。 */
  async upgrade(id: string, body: JsonRecord, actor: AuthenticatedUser) {
    const membership = await this.prisma.proMembership.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
    if (!membership) throw validation('Pro 会员记录不存在。');
    const now = new Date();
    if (membership.revokedAt) throw validation('已撤销的会员记录不能升级，请重新入会后购买。');
    if (membership.tier !== 'YEARLY') throw validation('只有年度会员可以补差升级为买断。');
    if (membership.endsAt && membership.endsAt <= now) throw validation('该年度会员已过期，请先续费再升级。');
    const priceMinor = body.upgradePriceMinor === undefined ? DEFAULT_UPGRADE_PRICE_MINOR : Number.parseInt(String(body.upgradePriceMinor), 10);
    if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) throw validation('补差金额无效（分），必须不小于 0。');
    const updated = await this.prisma.proMembership.update({ where: { id }, data: { tier: 'PERPETUAL', endsAt: null, paidMinor: membership.paidMinor + priceMinor, note: `${membership.note ? `${membership.note}｜` : ''}补差 ${formatYuan(priceMinor)} 升级买断（${formatDate(now)}）` } });
    await this.audit(actor, 'pro.membership.upgrade', 'pro-membership', id, { email: membership.user?.email, upgradePriceMinor: priceMinor });
    return { ok: true, membership: membershipJson(updated, now) };
  }

  async revoke(id: string, body: JsonRecord, actor: AuthenticatedUser) {
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) throw validation('撤销会员必须填写明确原因。');
    const membership = await this.prisma.proMembership.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
    if (!membership) throw validation('Pro 会员记录不存在。');
    if (membership.revokedAt) throw validation('该会员记录已撤销，无需重复操作。');
    const updated = await this.prisma.proMembership.update({ where: { id }, data: { revokedAt: new Date(), note: `${membership.note ? `${membership.note}｜` : ''}撤销：${reason}` } });
    await this.audit(actor, 'pro.membership.revoke', 'pro-membership', id, { email: membership.user?.email, reason });
    return { ok: true, membership: membershipJson(updated, new Date()) };
  }

  private async audit(actor: AuthenticatedUser, action: string, targetType: string, targetId: string, details: unknown) {
    await this.prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action, targetType, targetId, requestId: crypto.randomUUID(), details: details as any } });
  }
}

function membershipJson(row: any, now: Date) {
  const active = !row.revokedAt && new Date(row.startsAt).getTime() <= now.getTime() && (!row.endsAt || new Date(row.endsAt).getTime() > now.getTime());
  return {
    id: row.id,
    email: row.user?.email || '',
    userId: row.userId,
    tier: String(row.tier || '').toLowerCase(),
    source: String(row.source || '').toLowerCase(),
    sponsorQq: row.sponsorQq || '',
    paidMinor: row.paidMinor ?? 0,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    revokedAt: row.revokedAt || null,
    active,
    note: row.note || '',
    createdAt: row.createdAt
  };
}

function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function formatDate(value: Date | string | null | undefined) { if (!value) return '长期'; const date = value instanceof Date ? value : new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—'; }
function formatYuan(minor: number) { return `¥${(Number(minor) / 100).toLocaleString('zh-CN', { minimumFractionDigits: Number(minor) % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`; }
