import { Inject, Injectable } from '@nestjs/common';
import { getConfig } from '../config.js';
import { BillingService } from '../billing/billing.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PromotionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(BillingService) private readonly billing: BillingService) {}
  async grantSignupGift(userId: string) {
    const now = new Date();
    let policy = await this.prisma.promotionPolicy.findFirst({ where: { kind: 'SIGNUP_GIFT', enabled: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { createdAt: 'desc' } });
    if (!policy && getConfig().signupGiftPoints > 0n) policy = await this.prisma.promotionPolicy.upsert({ where: { id: 'default-signup-gift' }, create: { id: 'default-signup-gift', name: '默认新用户赠送', kind: 'SIGNUP_GIFT', startsAt: new Date('2020-01-01T00:00:00Z'), endsAt: new Date('2100-01-01T00:00:00Z'), timezone: 'Asia/Shanghai', giftPoints: getConfig().signupGiftPoints, modelAliases: [] }, update: {} });
    if (policy?.giftPoints) await this.billing.grant(userId, policy.giftPoints, policy.name, policy.id);
  }
  async activeFreeWindow(userId: string, modelAlias: string, listPricePoints: bigint) {
    const now = new Date();
    const policies = await this.prisma.promotionPolicy.findMany({ where: { kind: 'FREE_WINDOW', enabled: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: 'desc' } });
    for (const policy of policies) {
      if (policy.modelAliases.length && !policy.modelAliases.includes(modelAlias)) continue;
      const usageDate = new Intl.DateTimeFormat('en-CA', { timeZone: policy.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const usage = await this.prisma.freeUsage.upsert({ where: { promotionId_userId_usageDate: { promotionId: policy.id, userId, usageDate } }, create: { promotionId: policy.id, userId, usageDate }, update: {} });
      if (policy.perUserRequestCap !== null && policy.perUserRequestCap !== undefined && usage.requestCount >= policy.perUserRequestCap) continue;
      if (policy.perUserListPriceCap !== null && policy.perUserListPriceCap !== undefined && usage.listPricePoints + listPricePoints > policy.perUserListPriceCap) continue;
      return { policy, usageDate };
    }
    return undefined;
  }
  async consumeFreeWindow(promotionId: string, userId: string, usageDate: string, listPricePoints: bigint) {
    await this.prisma.freeUsage.update({ where: { promotionId_userId_usageDate: { promotionId, userId, usageDate } }, data: { requestCount: { increment: 1 }, listPricePoints: { increment: listPricePoints } } });
  }
}
