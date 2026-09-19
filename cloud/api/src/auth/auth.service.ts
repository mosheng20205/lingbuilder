import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import { authenticator } from 'otplib';
import { getConfig, hashOpaqueToken, randomToken } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { PromotionService } from '../promotion/promotion.service.js';
import { RedisService } from '../redis.service.js';
import { SecretVaultService } from '../security/secret-vault.service.js';

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(JwtService) private readonly jwt: JwtService, @Inject(PromotionService) private readonly promotions: PromotionService, @Inject(RedisService) private readonly redis: RedisService, @Inject(SecretVaultService) private readonly vault: SecretVaultService) {}
  private fail(message: string, code = 'AUTH_INVALID', status = 400): never { throw Object.assign(new Error(message), { code, status }); }
  private normalizeEmail(value: string) { const email = value.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) this.fail('邮箱格式无效。', 'VALIDATION_FAILED'); return email; }
  private validatePassword(value: string) { if (value.length < 10 || value.length > 128 || !/[A-Za-z]/u.test(value) || !/\d/u.test(value)) this.fail('密码需要 10 至 128 位，并同时包含字母和数字。', 'VALIDATION_FAILED'); }

  async register(emailValue: string, password: string, ip = '') {
    const email = this.normalizeEmail(emailValue); this.validatePassword(password); await this.redis.rateLimit(`auth:register:${ip || 'unknown'}`, 10, 3600);
    const existing = await this.prisma.user.findUnique({ where: { email } }); if (existing) this.fail('该邮箱已注册。', 'IDEMPOTENCY_CONFLICT', 409);
    const user = await this.prisma.user.create({ data: { email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), creditAccount: { create: {} } } });
    const token = randomToken(); await this.prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    await this.sendMail(email, '验证 LingBuilder 账号', `验证码链接：${process.env.CLOUD_API_ORIGIN || 'http://127.0.0.1:17900'}/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    return { ok: true, userId: user.id, verificationRequired: true, ...(process.env.NODE_ENV === 'development' ? { developmentVerificationToken: token } : {}) };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) this.fail('验证链接无效或已过期。');
    await this.prisma.$transaction([this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), this.prisma.user.update({ where: { id: record.userId }, data: { status: 'ACTIVE', emailVerifiedAt: new Date() } })]);
    await this.promotions.grantSignupGift(record.userId);
    return { ok: true };
  }

  async login(emailValue: string, password: string, deviceName: string, ip = '', userAgent = '', mfaCode = '') {
    const email = this.normalizeEmail(emailValue); await this.redis.rateLimit(`auth:login:${ip || 'unknown'}`, 20, 900);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { adminMembership: true } });
    if (!user || !await argon2.verify(user.passwordHash, password)) this.fail('邮箱或密码错误。', 'AUTH_INVALID', 401);
    if (!user.emailVerifiedAt) this.fail('请先验证邮箱。', 'EMAIL_NOT_VERIFIED', 403);
    if (user.status !== 'ACTIVE') this.fail('账号当前不可登录。', 'FORBIDDEN', 403);
    if (user.adminMembership?.mfaEnabledAt) {
      const encrypted = user.adminMembership.mfaSecretEncrypted;
      if (!encrypted || !mfaCode || !authenticator.check(mfaCode, this.vault.decrypt(encrypted))) this.fail('管理员账号必须提供有效的 MFA 动态验证码。', 'MFA_REQUIRED', 403);
    }
    return await this.issueSession(user.id, email, deviceName, ip, userAgent, Boolean(user.adminMembership?.mfaEnabledAt));
  }

  async setupMfa(userId: string, email: string) {
    const membership = await this.prisma.adminMembership.findUnique({ where: { userId } });
    if (!membership) this.fail('只有管理员账号可以绑定 MFA。', 'FORBIDDEN', 403);
    if (membership.mfaEnabledAt && membership.mfaSecretEncrypted) this.fail('MFA 已绑定；如需更换请先解绑，避免验证器中出现重复令牌。', 'IDEMPOTENCY_CONFLICT', 409);
    // 幂等：已生成但未启用的密钥直接复用，避免反复进入设置页时生成大量重复令牌。
    const secret = membership.mfaSecretEncrypted ? this.vault.decrypt(membership.mfaSecretEncrypted) : authenticator.generateSecret();
    if (!membership.mfaSecretEncrypted) await this.prisma.adminMembership.update({ where: { userId }, data: { mfaSecretEncrypted: this.vault.encrypt(secret) } });
    return { ok: true, otpauthUrl: authenticator.keyuri(email, 'LingBuilder Admin', secret) };
  }
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !await argon2.verify(user.passwordHash, currentPassword)) this.fail('当前密码不正确。', 'AUTH_INVALID', 401);
    this.validatePassword(newPassword);
    await this.prisma.$transaction([this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }), mustChangePassword: false } }), this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]);
    return { ok: true, reloginRequired: true };
  }
  async enableMfa(userId: string, code: string) {
    const membership = await this.prisma.adminMembership.findUnique({ where: { userId } });
    if (!membership?.mfaSecretEncrypted || !authenticator.check(code, this.vault.decrypt(membership.mfaSecretEncrypted))) this.fail('MFA 动态验证码无效。', 'MFA_REQUIRED', 403);
    await this.prisma.adminMembership.update({ where: { userId }, data: { mfaEnabledAt: new Date() } });
    await this.prisma.authSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { ok: true, reloginRequired: true };
  }
  async disableMfa(userId: string, code: string) {
    const membership = await this.prisma.adminMembership.findUnique({ where: { userId } });
    if (!membership?.mfaSecretEncrypted || !authenticator.check(code, this.vault.decrypt(membership.mfaSecretEncrypted))) this.fail('MFA 动态验证码无效。', 'MFA_REQUIRED', 403);
    await this.prisma.adminMembership.update({ where: { userId }, data: { mfaEnabledAt: null, mfaSecretEncrypted: null } });
    await this.prisma.authSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { ok: true, reloginRequired: true };
  }

  async refresh(refreshToken: string, ip = '', userAgent = '') {
    const hash = hashOpaqueToken(refreshToken); const session = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: hash }, include: { user: { include: { adminMembership: true } } } });
    if (!session || session.expiresAt <= new Date()) this.fail('刷新令牌无效或已过期。', 'AUTH_INVALID', 401);
    if (session.revokedAt || session.rotatedAt) { await this.prisma.authSession.updateMany({ where: { familyId: session.familyId }, data: { revokedAt: new Date() } }); this.fail('检测到刷新令牌重复使用，当前设备会话已全部撤销。', 'AUTH_INVALID', 401); }
    const nextToken = randomToken();
    await this.prisma.$transaction([this.prisma.authSession.update({ where: { id: session.id }, data: { rotatedAt: new Date() } }), this.prisma.authSession.create({ data: { userId: session.userId, familyId: session.familyId, refreshTokenHash: hashOpaqueToken(nextToken), deviceName: session.deviceName, ipAddress: ip, userAgent, expiresAt: new Date(Date.now() + 30 * 86400_000) } })]);
    return { accessToken: await this.signAccessToken(session.userId, session.user.email, Boolean(session.user.adminMembership?.mfaEnabledAt)), refreshToken: nextToken, expiresIn: 900 };
  }

  async logout(refreshToken: string) { await this.prisma.authSession.updateMany({ where: { refreshTokenHash: hashOpaqueToken(refreshToken) }, data: { revokedAt: new Date() } }); return { ok: true }; }
  async forgotPassword(emailValue: string, ip = '') {
    const email = this.normalizeEmail(emailValue); await this.redis.rateLimit(`auth:forgot:${ip || 'unknown'}`, 20, 900); const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) { const token = randomToken(); await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) } }); await this.sendMail(email, '重置 LingBuilder 密码', `重置令牌：${token}`); }
    return { ok: true };
  }
  async resetPassword(token: string, password: string) {
    this.validatePassword(password); const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) this.fail('重置令牌无效或已过期。');
    await this.prisma.$transaction([this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: false } }), this.prisma.authSession.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } })]);
    return { ok: true };
  }
  async createDeviceCode(deviceName: string) {
    const deviceCode = randomToken(); const userCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await this.prisma.deviceCode.create({ data: { deviceCodeHash: hashOpaqueToken(deviceCode), userCode, deviceName: deviceName.slice(0, 120), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { deviceCode, userCode, verificationUri: `${process.env.ADMIN_ORIGIN || 'http://127.0.0.1:17901'}/device`, expiresIn: 600, interval: 5 };
  }
  async approveDeviceCode(userCode: string, userId: string) { const result = await this.prisma.deviceCode.updateMany({ where: { userCode: userCode.trim().toUpperCase(), expiresAt: { gt: new Date() }, approvedAt: null }, data: { userId, approvedAt: new Date() } }); if (!result.count) this.fail('设备码无效或已过期。'); return { ok: true }; }
  async pollDeviceCode(deviceCode: string) {
    const record = await this.prisma.deviceCode.findUnique({ where: { deviceCodeHash: hashOpaqueToken(deviceCode) } });
    if (!record || record.expiresAt <= new Date() || record.consumedAt) this.fail('设备授权已过期。', 'AUTH_INVALID', 401);
    if (!record.userId || !record.approvedAt) throw Object.assign(new Error('等待用户确认设备登录。'), { status: 428, code: 'AUTH_REQUIRED' });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId }, include: { adminMembership: true } }); await this.prisma.deviceCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return await this.issueSession(user.id, user.email, record.deviceName, '', '', Boolean(user.adminMembership?.mfaEnabledAt));
  }
  private async issueSession(userId: string, email: string, deviceName: string, ip: string, userAgent: string, mfa: boolean) { const refreshToken = randomToken(); const familyId = crypto.randomUUID(); await this.prisma.authSession.create({ data: { userId, familyId, refreshTokenHash: hashOpaqueToken(refreshToken), deviceName: deviceName.slice(0, 120) || 'LingBuilder', ipAddress: ip, userAgent: userAgent.slice(0, 500), expiresAt: new Date(Date.now() + 30 * 86400_000) } }); return { accessToken: await this.signAccessToken(userId, email, mfa), refreshToken, expiresIn: 900 }; }
  private async signAccessToken(userId: string, email: string, mfa: boolean) { return await this.jwt.signAsync({ sub: userId, email, mfa }, { expiresIn: '15m' }); }
  private async sendMail(to: string, subject: string, text: string) { const config = getConfig(); const transport = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, ...(config.smtpUser ? { auth: { user: config.smtpUser, pass: config.smtpPassword } } : {}) }); await transport.sendMail({ from: config.smtpFrom, to, subject, text }); }
}
