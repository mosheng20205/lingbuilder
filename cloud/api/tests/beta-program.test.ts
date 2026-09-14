import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BetaProgramService } from '../src/beta-program/beta-program.service.js';
import { WebsiteContentService } from '../src/website/website-content.service.js';

const ADMIN = { id: 'admin-1', email: 'admin@example.com', role: 'operator', mfa: true };

function betaPrisma(overrides: Record<string, any> = {}) {
  const audits: any[] = [];
  const prisma: any = {
    betaProgramMember: { findUnique: async () => null, findMany: async () => [], upsert: async (args: any) => ({ id: 'member-1', ...args.create, ...args.update }), update: async (args: any) => ({ id: args.where.id, ...args.data }), delete: async (args: any) => ({ id: args.where.id }), ...(overrides.betaProgramMember || {}) },
    betaProgramApplication: { findUnique: async () => null, findMany: async () => [], count: async () => 0, upsert: async (args: any) => ({ id: 'application-1', ...args.create, ...args.update }), update: async (args: any) => ({ id: args.where.id, ...args.data }), ...(overrides.betaProgramApplication || {}) },
    systemFlag: { findUnique: async (args: any) => ({ key: args.where.key, value: overrides.flagValue ?? 'false' }), upsert: async (args: any) => ({ ...args.create, ...args.update }), ...(overrides.systemFlag || {}) },
    user: { findUnique: async (args: any) => overrides.user === undefined ? { id: args.where.id, email: 'user@example.com', status: 'ACTIVE' } : overrides.user, findFirst: async (args: any) => overrides.user === undefined ? { id: 'user-1', email: 'user@example.com', status: 'ACTIVE' } : overrides.user, ...(overrides.user || {}) },
    adminAuditLog: { create: async (args: any) => { audits.push(args); return args.data; } },
    $transaction: async (operations: any[]) => Promise.all(operations),
    ...overrides.prisma
  };
  return { prisma, audits };
}

function jwtMock(payload: any = { sub: 'user-1' }) {
  return { verifyAsync: async (token: string) => token === 'bad' ? Promise.reject(new Error('expired')) : payload } as any;
}

test('latest version degrades preview queries to stable without entitlement', async () => {
  const { prisma, audits } = betaPrisma();
  let captured: any;
  prisma.websiteDownloadRelease = { findMany: async (args: any) => { captured = args; return []; } };
  const website = new WebsiteContentService(prisma, new BetaProgramService(prisma, jwtMock()));
  const result: any = await website.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'preview', authorization: 'Bearer bad' });
  assert.equal(captured.where.channel, 'stable');
  assert.deepEqual(result, { ok: true, available: false });
  assert.equal(audits.length, 0);
});

test('latest version serves the preview channel for active members', async () => {
  const { prisma } = betaPrisma({
    user: { id: 'user-1', email: 'user@example.com', status: 'ACTIVE' },
    betaProgramMember: { findUnique: async () => null }
  });
  let captured: any;
  prisma.websiteDownloadRelease = { findMany: async (args: any) => { captured = args; return []; } };
  // resolvePreviewAccess 走 user.findFirst 的成员条件查询，这里直接换成命中结果。
  prisma.user.findFirst = async () => ({ id: 'user-1' });
  prisma.systemFlag = { findUnique: async () => ({ value: 'false' }) };
  const website = new WebsiteContentService(prisma, new BetaProgramService(prisma, jwtMock()));
  await website.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'preview', authorization: 'Bearer good' });
  assert.equal(captured.where.channel, 'preview');
});

test('latest version keeps the legacy cross-channel behaviour and stable channel untouched', async () => {
  const { prisma } = betaPrisma();
  let captured: any;
  prisma.websiteDownloadRelease = { findMany: async (args: any) => { captured = args; return []; } };
  const website = new WebsiteContentService(prisma);
  await website.latestVersion({ platform: 'Windows', architecture: 'x64', channel: '' });
  assert.equal(captured.where.channel, undefined);
  await website.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal(captured.where.channel, 'stable');
});

test('entitlement reports enrollment, expiry and channel suspension', async () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  const active = betaPrisma({ flagValue: 'false' });
  active.prisma.betaProgramMember.findUnique = async () => ({ status: 'ACTIVE', validUntil: future });
  const activeResult = await new BetaProgramService(active.prisma).entitlement('user-1');
  assert.equal(activeResult.enrolled, true);
  assert.equal(activeResult.previewSuspended, false);

  const expired = betaPrisma({});
  expired.prisma.betaProgramMember.findUnique = async () => ({ status: 'ACTIVE', validUntil: past });
  assert.equal((await new BetaProgramService(expired.prisma).entitlement('user-1')).enrolled, false);

  const suspendedMember = betaPrisma({});
  suspendedMember.prisma.betaProgramMember.findUnique = async () => ({ status: 'SUSPENDED', validUntil: null });
  assert.equal((await new BetaProgramService(suspendedMember.prisma).entitlement('user-1')).enrolled, false);

  const paused = betaPrisma({ flagValue: 'true' });
  paused.prisma.betaProgramMember.findUnique = async () => ({ status: 'ACTIVE', validUntil: null });
  const pausedResult = await new BetaProgramService(paused.prisma).entitlement('user-1');
  assert.equal(pausedResult.enrolled, true);
  assert.equal(pausedResult.previewSuspended, true);
});

test('resolvePreviewAccess rejects missing, invalid and membership-less tokens', async () => {
  const noToken = new BetaProgramService(betaPrisma().prisma, jwtMock());
  assert.equal(await noToken.resolvePreviewAccess(''), false);
  assert.equal(await noToken.resolvePreviewAccess('Bearer'), false);

  const badToken = new BetaProgramService(betaPrisma().prisma, jwtMock());
  assert.equal(await badToken.resolvePreviewAccess('Bearer bad'), false);

  const noMembership = betaPrisma({});
  noMembership.prisma.user.findFirst = async () => null;
  assert.equal(await new BetaProgramService(noMembership.prisma, jwtMock()).resolvePreviewAccess('Bearer good'), false);
});

test('apply rejects enrolled users and resets rejected applications to pending', async () => {
  const enrolled = betaPrisma({});
  enrolled.prisma.betaProgramMember.findUnique = async () => ({ status: 'ACTIVE', validUntil: null });
  await assert.rejects(() => new BetaProgramService(enrolled.prisma).apply('user-1', {}), /你已在体验计划中/u);

  let captured: any;
  const reapply = betaPrisma({});
  reapply.prisma.betaProgramApplication.upsert = async (args: any) => { captured = args; return { id: 'application-1', status: 'PENDING', updatedAt: new Date() }; };
  const result = await new BetaProgramService(reapply.prisma).apply('user-1', { message: '想抢先体验新功能' });
  assert.equal(result.ok, true);
  assert.equal(captured.update.status, 'PENDING');
  assert.equal(captured.update.rejectReason, '');
  assert.equal(captured.update.message, '想抢先体验新功能');
});

test('cancel application only works on pending entries', async () => {
  const none = betaPrisma({});
  await assert.rejects(() => new BetaProgramService(none.prisma).cancelApplication('user-1'), /没有待审核的报名申请/u);

  let captured: any;
  const pending = betaPrisma({});
  pending.prisma.betaProgramApplication.findUnique = async () => ({ id: 'application-1', status: 'PENDING' });
  pending.prisma.betaProgramApplication.update = async (args: any) => { captured = args; return { id: args.where.id, ...args.data }; };
  await new BetaProgramService(pending.prisma).cancelApplication('user-1');
  assert.equal(captured.data.status, 'CANCELLED');
});

test('add member resolves accounts by email, blocks inactive users and writes audit', async () => {
  const missing = betaPrisma({ user: null });
  await assert.rejects(() => new BetaProgramService(missing.prisma).addMember({ email: 'ghost@example.com' }, ADMIN), /没有找到该邮箱/u);

  const inactive = betaPrisma({ user: { id: 'user-1', email: 'user@example.com', status: 'PENDING' } });
  await assert.rejects(() => new BetaProgramService(inactive.prisma).addMember({ email: 'user@example.com' }, ADMIN), /尚未激活/u);

  let captured: any;
  const ok = betaPrisma({ user: { id: 'user-1', email: 'User@Example.com', status: 'ACTIVE' } });
  ok.prisma.betaProgramMember.upsert = async (args: any) => { captured = args; return { id: 'member-1', ...args.create, validUntil: null, addedByAdminId: ADMIN.id }; };
  const result = await new BetaProgramService(ok.prisma).addMember({ email: 'user@example.com', groupTag: '内测组', validUntil: '2026-12-31T00:00:00.000Z' }, ADMIN);
  assert.equal(result.ok, true);
  assert.equal(captured.create.userId, 'user-1');
  assert.equal(captured.create.status, 'ACTIVE');
  assert.equal(captured.create.groupTag, '内测组');
  assert.ok(ok.audits[0].data.action === 'beta-program.member.add');
  assert.equal(ok.audits[0].data.details.email, 'User@Example.com');
});

test('batch import deduplicates, reports per-email failures and writes per-member plus summary audits', async () => {
  const { prisma, audits } = betaPrisma({ user: null });
  prisma.user.findFirst = async (args: any) => args.where.email.equals === 'a@example.com' ? { id: 'user-a', email: 'a@example.com', status: 'ACTIVE' } : null;
  const result = await new BetaProgramService(prisma).addMembersBatch({ emails: ['a@example.com', 'a@example.com', 'b@example.com'] }, ADMIN);
  assert.deepEqual(result.added, ['a@example.com']);
  assert.equal(result.failed.length, 2);
  assert.equal(result.failed[0].reason, '列表内重复。');
  assert.deepEqual(audits.map((item: any) => item.data.action), ['beta-program.member.add', 'beta-program.member.batch-add']);
});

test('update member validates status, clears expiry with empty value and audits changes', async () => {
  const bad = betaPrisma({});
  bad.prisma.betaProgramMember.findUnique = async () => ({ id: 'member-1', user: { email: 'user@example.com', status: 'ACTIVE' } });
  await assert.rejects(() => new BetaProgramService(bad.prisma).updateMember('member-1', { status: 'DELETED' }, ADMIN), /只支持 ACTIVE 或 SUSPENDED/u);
  await assert.rejects(() => new BetaProgramService(bad.prisma).updateMember('member-1', {}, ADMIN), /没有需要更新的字段/u);

  let captured: any;
  const ok = betaPrisma({});
  ok.prisma.betaProgramMember.findUnique = async () => ({ id: 'member-1', user: { email: 'user@example.com', status: 'ACTIVE' } });
  ok.prisma.betaProgramMember.update = async (args: any) => { captured = args; return { id: args.where.id, ...args.data }; };
  await new BetaProgramService(ok.prisma).updateMember('member-1', { status: 'SUSPENDED', validUntil: '', note: '暂停观察' }, ADMIN);
  assert.equal(captured.data.status, 'SUSPENDED');
  assert.equal(captured.data.validUntil, null);
  assert.equal(captured.data.note, '暂停观察');
  assert.deepEqual(ok.audits[0].data.details.changes.sort(), ['note', 'status', 'validUntil']);
});

test('approve application creates membership and marks the application in one transaction', async () => {
  let memberArgs: any;
  let applicationArgs: any;
  const { prisma, audits } = betaPrisma({});
  prisma.betaProgramApplication.findUnique = async () => ({ id: 'application-1', userId: 'user-1', status: 'PENDING' });
  prisma.betaProgramMember.upsert = async (args: any) => { memberArgs = args; return { id: 'member-9', ...args.create }; };
  prisma.betaProgramApplication.update = async (args: any) => { applicationArgs = args; return { id: args.where.id, ...args.data }; };
  await new BetaProgramService(prisma).approveApplication('application-1', ADMIN);
  assert.equal(memberArgs.create.userId, 'user-1');
  assert.equal(memberArgs.update.status, 'ACTIVE');
  assert.equal(applicationArgs.data.status, 'APPROVED');
  assert.equal(audits[0].data.action, 'beta-program.application.approve');

  const processed = betaPrisma({});
  processed.prisma.betaProgramApplication.findUnique = async () => ({ id: 'application-1', userId: 'user-1', status: 'REJECTED' });
  await assert.rejects(() => new BetaProgramService(processed.prisma).approveApplication('application-1', ADMIN), /已被处理/u);
});

test('reject application stores reason and reviewer', async () => {
  let captured: any;
  const { prisma, audits } = betaPrisma({});
  prisma.betaProgramApplication.findUnique = async () => ({ id: 'application-1', userId: 'user-1', status: 'PENDING' });
  prisma.betaProgramApplication.update = async (args: any) => { captured = args; return { id: args.where.id, ...args.data }; };
  await new BetaProgramService(prisma).rejectApplication('application-1', { reason: '名额已满' }, ADMIN);
  assert.equal(captured.data.status, 'REJECTED');
  assert.equal(captured.data.rejectReason, '名额已满');
  assert.equal(audits[0].data.action, 'beta-program.application.reject');
});

test('settings switch validates boolean input and persists the system flag', async () => {
  const service = new BetaProgramService(betaPrisma().prisma);
  await assert.rejects(() => service.updateSettings({ previewChannelSuspended: 'yes' }, ADMIN), /布尔值/u);

  let captured: any;
  const { prisma, audits } = betaPrisma({});
  prisma.systemFlag.upsert = async (args: any) => { captured = args; return { ...args.create, ...args.update }; };
  const result = await new BetaProgramService(prisma).updateSettings({ previewChannelSuspended: true }, ADMIN);
  assert.equal(result.previewChannelSuspended, true);
  assert.equal(captured.update.value, 'true');
  assert.equal(audits[0].data.action, 'beta-program.settings.update');
});

test('beta program controller exposes read routes to all roles and gates writes to super_admin/operator', () => {
  const source = fs.readFileSync(new URL('../src/beta-program/beta-program.controller.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("@Controller('v1/beta-program')"));
  assert.ok(source.includes("@Controller('v1/admin/beta-program')"));
  assert.ok(source.includes("@Roles('super_admin', 'operator', 'support', 'auditor')"));
  for (const route of [
    "@Post('members') @Roles('super_admin', 'operator')",
    "@Post('members/batch') @Roles('super_admin', 'operator')",
    "@Patch('members/:id') @Roles('super_admin', 'operator')",
    "@Delete('members/:id') @Roles('super_admin', 'operator')",
    "@Post('applications/:id/approve') @Roles('super_admin', 'operator')",
    "@Post('applications/:id/reject') @Roles('super_admin', 'operator')",
    "@Put('settings') @Roles('super_admin', 'operator')"
  ]) {
    assert.ok(source.includes(route), `缺少写权限门禁：${route}`);
  }
  assert.ok(source.includes("@Get('settings') settings()"));
});

test('admin snapshot includes members, pending applications and suspension flag', async () => {
  const { prisma } = betaPrisma({ flagValue: 'true' });
  prisma.betaProgramMember.findMany = async () => [{ id: 'member-1', userId: 'user-1', status: 'ACTIVE', groupTag: '', validUntil: null, note: '', addedByAdminId: null, createdAt: new Date(), updatedAt: new Date(), user: { email: 'user@example.com', status: 'ACTIVE' } }];
  prisma.betaProgramApplication.count = async () => 3;
  prisma.betaProgramApplication.findMany = async () => [{ id: 'application-1', userId: 'user-1', status: 'PENDING', user: { email: 'user@example.com', status: 'ACTIVE' } }];
  const snapshot = await new BetaProgramService(prisma).adminSnapshot();
  assert.equal(snapshot.members.length, 1);
  assert.equal(snapshot.members[0].email, 'user@example.com');
  assert.equal(snapshot.members[0].active, true);
  assert.equal(snapshot.applications.length, 1);
  assert.equal(snapshot.applications[0].email, 'user@example.com');
  assert.equal(snapshot.pendingApplicationCount, 3);
  assert.equal(snapshot.previewChannelSuspended, true);
});

function requireSource(relativePath: string) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
