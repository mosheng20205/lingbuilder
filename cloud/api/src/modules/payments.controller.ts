import { Controller, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/current-user.js';
import { PaymentProviderService, type PaymentProviderId } from './payment-provider.service.js';
import { ModuleCommerceService } from './module-commerce.service.js';
import { CreditRechargeService } from '../billing/credit-recharge.service.js';
import { PrismaService } from '../prisma.service.js';

/** 统一支付回调入口：同一渠道的模块订单与点数充值订单共用一个 notify 地址，按订单归属分发。 */
@Controller('v1/payments')
export class PaymentsController {
  constructor(@Inject(PaymentProviderService) private readonly payments: PaymentProviderService, @Inject(ModuleCommerceService) private readonly commerce: ModuleCommerceService, @Inject(CreditRechargeService) private readonly recharge: CreditRechargeService, @Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Public() @Post(':provider/webhook') async webhook(@Param('provider') rawProvider: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const provider = rawProvider.toUpperCase();
    if (!['WECHAT', 'ALIPAY'].includes(provider)) throw Object.assign(new Error('未知支付渠道。'), { status: 404, code: 'VALIDATION_FAILED' });
    const rawBody = Buffer.isBuffer((request as any).rawBody) ? (request as any).rawBody.toString('utf8') : typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
    const event = this.payments.verifyWebhook(provider as PaymentProviderId, rawBody, request.headers);
    const moduleOrder = await this.prisma.moduleOrder.findFirst({ where: { provider: provider as any, providerOrderId: event.providerOrderId }, select: { id: true } });
    if (moduleOrder) await this.commerce.paymentWebhook(provider as PaymentProviderId, rawBody, request.headers);
    else await this.recharge.handlePaymentEvent(provider as PaymentProviderId, event, rawBody);
    if (provider === 'ALIPAY') { response.type('text/plain'); return 'success'; }
    return { code: 'SUCCESS', message: '成功' };
  }
}
