import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string) {
    const account = await this.prisma.creditAccount.upsert({ where: { userId }, create: { userId }, update: {} });
    return { available: account.available.toString(), reserved: account.reserved.toString(), lifetimeGranted: account.lifetimeGranted.toString(), lifetimeSpent: account.lifetimeSpent.toString() };
  }

  async grant(userId: string, points: bigint, reason: string, promotionId?: string, actorUserId?: string) {
    if (points <= 0n) throw Object.assign(new Error('赠送点数必须大于零。'), { status: 400, code: 'VALIDATION_FAILED' });
    return await this.prisma.$transaction(async tx => {
      if (promotionId) {
        const existing = await tx.promotionGrant.findUnique({ where: { promotionId_userId: { promotionId, userId } } });
        if (existing) return existing;
        await tx.promotionGrant.create({ data: { promotionId, userId, points } });
      }
      const account = await tx.creditAccount.upsert({ where: { userId }, create: { userId, available: points, lifetimeGranted: points }, update: { available: { increment: points }, lifetimeGranted: { increment: points }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId, kind: promotionId ? 'SIGNUP_GIFT' : 'ADMIN_ADJUSTMENT', availableDelta: points, reservedDelta: 0n, balanceAfter: account.available, promotionId, actorUserId, reason } });
      return account;
    }, { isolationLevel: 'Serializable' });
  }

  async adjust(userId: string, delta: bigint, reason: string, actorUserId: string) {
    if (!delta || reason.trim().length < 3) throw Object.assign(new Error('调账必须包含非零点数和明确原因。'), { status: 400, code: 'VALIDATION_FAILED' });
    return await this.prisma.$transaction(async tx => {
      const current = await tx.creditAccount.upsert({ where: { userId }, create: { userId }, update: {} });
      if (current.available + delta < 0n) throw Object.assign(new Error('调账后余额不能小于零。'), { status: 409, code: 'INSUFFICIENT_CREDITS' });
      const account = await tx.creditAccount.update({ where: { userId }, data: { available: { increment: delta }, ...(delta > 0n ? { lifetimeGranted: { increment: delta } } : { lifetimeSpent: { increment: -delta } }), version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId, kind: 'ADMIN_ADJUSTMENT', availableDelta: delta, reservedDelta: 0n, balanceAfter: account.available, actorUserId, reason } });
      return account;
    }, { isolationLevel: 'Serializable' });
  }

  async reserve(userId: string, requestId: string, points: bigint) {
    if (points < 0n) throw new Error('冻结点数不能小于零。');
    return await this.prisma.$transaction(async tx => {
      const account = await tx.creditAccount.upsert({ where: { userId }, create: { userId }, update: {} });
      if (account.available < points) throw Object.assign(new Error('AI 点数余额不足。'), { status: 402, code: 'INSUFFICIENT_CREDITS' });
      const next = await tx.creditAccount.update({ where: { userId }, data: { available: { decrement: points }, reserved: { increment: points }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId, kind: 'RESERVE', availableDelta: -points, reservedDelta: points, balanceAfter: next.available, requestId, reason: 'AI 请求预冻结' } });
      return next;
    }, { isolationLevel: 'Serializable' });
  }

  async settle(userId: string, requestId: string, reserved: bigint, charge: bigint) {
    const effectiveCharge = charge < 0n ? 0n : charge;
    return await this.prisma.$transaction(async tx => {
      const alreadyCharged = await tx.creditLedger.findUnique({ where: { requestId_kind: { requestId, kind: 'CHARGE' } } });
      if (alreadyCharged) return await tx.creditAccount.findUniqueOrThrow({ where: { userId } });
      const account = await tx.creditAccount.findUniqueOrThrow({ where: { userId } });
      const refund = reserved > effectiveCharge ? reserved - effectiveCharge : 0n; const extra = effectiveCharge > reserved ? effectiveCharge - reserved : 0n;
      if (account.available < extra) throw Object.assign(new Error('最终结算点数不足。'), { status: 402, code: 'INSUFFICIENT_CREDITS' });
      const next = await tx.creditAccount.update({ where: { userId }, data: { reserved: { decrement: reserved }, available: { increment: refund - extra }, lifetimeSpent: { increment: effectiveCharge }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId, kind: 'CHARGE', availableDelta: refund - extra, reservedDelta: -reserved, balanceAfter: next.available, requestId, reason: 'AI 请求实际用量结算' } });
      return next;
    }, { isolationLevel: 'Serializable' });
  }

  async release(userId: string, requestId: string, reserved: bigint, reason: string) {
    return await this.prisma.$transaction(async tx => {
      const existing = await tx.creditLedger.findUnique({ where: { requestId_kind: { requestId, kind: 'RELEASE' } } });
      if (existing) return await tx.creditAccount.findUniqueOrThrow({ where: { userId } });
      const next = await tx.creditAccount.update({ where: { userId }, data: { reserved: { decrement: reserved }, available: { increment: reserved }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId, kind: 'RELEASE', availableDelta: reserved, reservedDelta: -reserved, balanceAfter: next.available, requestId, reason } });
      return next;
    }, { isolationLevel: 'Serializable' });
  }

  calculatePoints(input: number, cached: number, output: number, prices: { input: bigint; cached: bigint; output: bigint }): bigint {
    const total = BigInt(input) * prices.input + BigInt(cached) * prices.cached + BigInt(output) * prices.output;
    return (total + 999_999n) / 1_000_000n;
  }
}
