import { Inject, Injectable, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/current-user.js';
import { PrismaService } from '../prisma.service.js';

type JsonRecord = Record<string, unknown>;

/** SystemFlag 中控制预览渠道是否暂停推送的键：暂停后 preview 查询一律按 stable 处理。 */
export const PREVIEW_CHANNEL_SUSPENDED_FLAG = 'beta_program.preview_channel_suspended';

@Injectable()
export class BetaProgramService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Optional() @Inject(JwtService) private readonly jwt?: JwtService) {}

  /** 客户端资格查询：设置页展示与报名入口共用。 */
  async entitlement(userId: string) {
    const [member, application] = await Promise.all([
      this.prisma.betaProgramMember.findUnique({ where: { userId } }),
      this.prisma.betaProgramApplication.findUnique({ where: { userId } })
    ]);
    const expired = isExpired(member?.validUntil);
    return {
      ok: true,
      enrolled: Boolean(member && member.status === 'ACTIVE' && !expired),
      status: member?.status ?? null,
      validUntil: member?.validUntil ?? null,
      previewSuspended: await this.isPreviewSuspended(),
      application: application ? { status: application.status, rejectReason: application.rejectReason, updatedAt: application.updatedAt } : null
    };
  }

  /**
   * latest-version 预览渠道门禁：解析可选 Bearer token，只有「账号激活 + 名单生效 + 未过期 + 渠道未暂停」才允许读 preview。
   * 任何一步不满足都返回 false，由调用方静默降级为 stable，绝不能把更新检查变成报错。
   */
  async resolvePreviewAccess(authorizationHeader: unknown) {
    const token = /^Bearer\s+(.+)$/iu.exec(String(authorizationHeader || ''))?.[1];
    if (!token || !this.jwt) return false;
    try {
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findFirst({
        where: {
          id: String(payload.sub || ''),
          status: 'ACTIVE',
          betaProgramMember: { status: 'ACTIVE', OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] }
        },
        select: { id: true }
      });
      if (!user) return false;
      return !(await this.isPreviewSuspended());
    } catch {
      return false;
    }
  }

  async isPreviewSuspended() {
    const flag = await this.prisma.systemFlag.findUnique({ where: { key: PREVIEW_CHANNEL_SUSPENDED_FLAG } });
    return flag?.value === 'true';
  }

  /** 自助报名：已在计划内的账号拒绝重复申请；被拒/撤回过的申请重置回 PENDING 重新排队。 */
  async apply(userId: string, body: JsonRecord) {
    const member = await this.prisma.betaProgramMember.findUnique({ where: { userId } });
    if (member && member.status === 'ACTIVE' && !isExpired(member.validUntil)) throw validation('你已在体验计划中，无需再次申请。');
    const application = await this.prisma.betaProgramApplication.upsert({
      where: { userId },
      create: { userId, message: clean(body.message, 500), status: 'PENDING' },
      update: { message: clean(body.message, 500), status: 'PENDING', reviewedByAdminId: null, reviewedAt: null, rejectReason: '' }
    });
    return { ok: true, application: { status: application.status, updatedAt: application.updatedAt } };
  }

  async cancelApplication(userId: string) {
    const existing = await this.prisma.betaProgramApplication.findUnique({ where: { userId } });
    if (!existing || existing.status !== 'PENDING') throw notFound('没有待审核的报名申请。');
    await this.prisma.betaProgramApplication.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    return { ok: true };
  }

  async adminSnapshot() {
    const [members, pendingApplicationCount, previewChannelSuspended, applications] = await Promise.all([
      this.prisma.betaProgramMember.findMany({ orderBy: [{ updatedAt: 'desc' }], include: { user: { select: { email: true, status: true } } } }),
      this.prisma.betaProgramApplication.count({ where: { status: 'PENDING' } }),
      this.isPreviewSuspended(),
      this.adminApplications('PENDING').then(value => value.applications)
    ]);
    return { ok: true, members: members.map(serializeMember), applications, pendingApplicationCount, previewChannelSuspended };
  }

  async addMember(body: JsonRecord, actor: AuthenticatedUser) {
    const user = await resolveUser(this.prisma, body);
    if (user.status !== 'ACTIVE') throw validation('该账号尚未激活（邮箱未验证或已被停用），不能加入体验计划。');
    const data = {
      status: 'ACTIVE',
      groupTag: clean(body.groupTag, 40),
      validUntil: body.validUntil == null || body.validUntil === '' ? null : requireDate(body.validUntil, '资格有效期'),
      note: clean(body.note, 500),
      addedByAdminId: actor.id
    };
    const member = await this.prisma.betaProgramMember.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    await this.audit(actor, 'beta-program.member.add', 'beta-program-member', member.id, { email: user.email, groupTag: data.groupTag, validUntil: data.validUntil });
    return { ok: true, member: serializeMember({ ...member, user: { email: user.email, status: user.status } }) };
  }

  async addMembersBatch(body: JsonRecord, actor: AuthenticatedUser) {
    const emails = (Array.isArray(body.emails) ? body.emails : String(body.emails ?? '').split(/[\n,，;；\s]+/u))
      .map(item => clean(item, 200))
      .filter(Boolean)
      .slice(0, 200);
    if (!emails.length) throw validation('批量导入列表不能为空。');
    const shared = { groupTag: clean(body.groupTag, 40), validUntil: body.validUntil == null || body.validUntil === '' ? null : requireDate(body.validUntil, '资格有效期'), note: clean(body.note, 500) };
    const added: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];
    const seen = new Set<string>();
    for (const email of emails) {
      const key = email.toLowerCase();
      if (seen.has(key)) { failed.push({ email, reason: '列表内重复。' }); continue; }
      seen.add(key);
      try {
        await this.addMember({ email, ...shared }, actor);
        added.push(email);
      } catch (error: any) {
        failed.push({ email, reason: String(error?.message || '添加失败。') });
      }
    }
    await this.audit(actor, 'beta-program.member.batch-add', 'beta-program-member-set', 'batch', { added: added.length, failed: failed.length, groupTag: shared.groupTag });
    return { ok: true, added, failed };
  }

  async updateMember(id: string, body: JsonRecord, actor: AuthenticatedUser) {
    const existing = await this.prisma.betaProgramMember.findUnique({ where: { id }, include: { user: { select: { email: true, status: true } } } });
    if (!existing) throw notFound('没有找到这条体验名单记录。');
    const data: JsonRecord = {};
    if ('status' in body) {
      const status = clean(body.status, 20).toUpperCase();
      if (!['ACTIVE', 'SUSPENDED'].includes(status)) throw validation('名单状态只支持 ACTIVE 或 SUSPENDED。');
      data.status = status;
    }
    if ('groupTag' in body) data.groupTag = clean(body.groupTag, 40);
    if ('validUntil' in body) data.validUntil = body.validUntil == null || body.validUntil === '' ? null : requireDate(body.validUntil, '资格有效期');
    if ('note' in body) data.note = clean(body.note, 500);
    if (!Object.keys(data).length) throw validation('没有需要更新的字段。');
    const member = await this.prisma.betaProgramMember.update({ where: { id }, data });
    await this.audit(actor, 'beta-program.member.update', 'beta-program-member', id, { email: existing.user.email, changes: Object.keys(data) });
    return { ok: true, member: serializeMember({ ...member, user: existing.user }) };
  }

  async removeMember(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.betaProgramMember.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
    if (!existing) throw notFound('没有找到这条体验名单记录。');
    await this.prisma.betaProgramMember.delete({ where: { id } });
    await this.audit(actor, 'beta-program.member.remove', 'beta-program-member', id, { email: existing.user.email });
    return { ok: true };
  }

  async adminApplications(status: string) {
    const normalized = clean(status, 20).toUpperCase();
    const where = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(normalized) ? { status: normalized } : {};
    const applications = await this.prisma.betaProgramApplication.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
      include: { user: { select: { email: true, status: true } } }
    });
    return { ok: true, applications: applications.map(item => ({ id: item.id, userId: item.userId, email: item.user.email, userStatus: item.user.status, message: item.message, status: item.status, rejectReason: item.rejectReason, reviewedAt: item.reviewedAt, createdAt: item.createdAt, updatedAt: item.updatedAt })) };
  }

  async approveApplication(id: string, actor: AuthenticatedUser) {
    const application = await this.prisma.betaProgramApplication.findUnique({ where: { id } });
    if (!application) throw notFound('没有找到这条报名申请。');
    if (application.status !== 'PENDING') throw validation('该申请已被处理，不能重复审核。');
    const user = await this.prisma.user.findUnique({ where: { id: application.userId }, select: { id: true, email: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw validation('该账号尚未激活，不能加入体验计划。');
    const [member] = await this.prisma.$transaction([
      this.prisma.betaProgramMember.upsert({ where: { userId: user.id }, create: { userId: user.id, status: 'ACTIVE', addedByAdminId: actor.id }, update: { status: 'ACTIVE' } }),
      this.prisma.betaProgramApplication.update({ where: { id }, data: { status: 'APPROVED', reviewedByAdminId: actor.id, reviewedAt: new Date() } })
    ]);
    await this.audit(actor, 'beta-program.application.approve', 'beta-program-application', id, { email: user.email, memberId: member.id });
    return { ok: true };
  }

  async rejectApplication(id: string, body: JsonRecord, actor: AuthenticatedUser) {
    const application = await this.prisma.betaProgramApplication.findUnique({ where: { id } });
    if (!application) throw notFound('没有找到这条报名申请。');
    if (application.status !== 'PENDING') throw validation('该申请已被处理，不能重复审核。');
    await this.prisma.betaProgramApplication.update({ where: { id }, data: { status: 'REJECTED', rejectReason: clean(body.reason, 300), reviewedByAdminId: actor.id, reviewedAt: new Date() } });
    await this.audit(actor, 'beta-program.application.reject', 'beta-program-application', id, { reason: clean(body.reason, 300) });
    return { ok: true };
  }

  async adminSettings() {
    return { ok: true, previewChannelSuspended: await this.isPreviewSuspended() };
  }

  async updateSettings(body: JsonRecord, actor: AuthenticatedUser) {
    if (typeof body.previewChannelSuspended !== 'boolean') throw validation('previewChannelSuspended 必须是布尔值。');
    const value = String(body.previewChannelSuspended);
    await this.prisma.systemFlag.upsert({
      where: { key: PREVIEW_CHANNEL_SUSPENDED_FLAG },
      create: { key: PREVIEW_CHANNEL_SUSPENDED_FLAG, value, updatedByAdminId: actor.id },
      update: { value, updatedByAdminId: actor.id }
    });
    await this.audit(actor, 'beta-program.settings.update', 'system-flag', PREVIEW_CHANNEL_SUSPENDED_FLAG, { previewChannelSuspended: body.previewChannelSuspended });
    return { ok: true, previewChannelSuspended: body.previewChannelSuspended };
  }

  private async audit(actor: AuthenticatedUser, action: string, targetType: string, targetId: string, details: unknown) {
    await this.prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action, targetType, targetId, requestId: crypto.randomUUID(), details: details as Prisma.InputJsonValue } });
  }
}

async function resolveUser(prisma: PrismaService, body: JsonRecord) {
  const email = clean(body.email, 200);
  const userId = clean(body.userId, 100);
  if (userId) {
    const byId = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, status: true } });
    if (byId) return byId;
  }
  if (email) {
    const byEmail = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true, status: true } });
    if (byEmail) return byEmail;
  }
  throw validation('没有找到该邮箱对应的注册账号，请先在「用户账号」中确认邮箱。');
}

function serializeMember(member: { id: string; userId: string; status: string; groupTag: string; validUntil: Date | null; note: string; addedByAdminId: string | null; createdAt: Date; updatedAt: Date; user: { email: string; status: string } }) {
  return { ...member, email: member.user.email, userStatus: member.user.status, active: member.status === 'ACTIVE' && !isExpired(member.validUntil) };
}

function isExpired(validUntil: Date | null | undefined) {
  return Boolean(validUntil && validUntil.getTime() <= Date.now());
}

function clean(value: unknown, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function requireDate(value: unknown, label: string) {
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw validation(`${label}格式无效。`);
  return result;
}
function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function notFound(message: string) { return Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' }); }
