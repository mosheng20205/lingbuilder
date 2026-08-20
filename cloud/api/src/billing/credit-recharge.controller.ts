import { Body, Controller, Get, Headers, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public, type AuthenticatedUser } from '../common/current-user.js';
import { CreditRechargeService } from './credit-recharge.service.js';

@Controller('v1/credits')
export class CreditRechargeController {
  constructor(@Inject(CreditRechargeService) private readonly recharge: CreditRechargeService) {}
  @Get('packages') packages() { return { ok: true, packages: this.recharge.packages() }; }
  @Post('recharge') async create(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') idempotencyKey = '', @Body() body: any) {
    const provider = String(body.provider || '').toUpperCase();
    if (!['WECHAT', 'ALIPAY'].includes(provider)) throw Object.assign(new Error('充值渠道必须是微信支付或支付宝。'), { status: 400, code: 'VALIDATION_FAILED' });
    return { ok: true, order: await this.recharge.createOrder(user.id, String(body.packageId || ''), provider as 'WECHAT' | 'ALIPAY', idempotencyKey) };
  }
  @Get('recharge/:orderId') async status(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) { return { ok: true, order: await this.recharge.orderStatus(user.id, orderId) }; }
  @Get('recharges') async orders(@CurrentUser() user: AuthenticatedUser) { return { ok: true, orders: await this.recharge.listOrders(user.id) }; }
  @Public() @Get('recharge/:orderId/pay-page') async payPage(@Param('orderId') orderId: string, @Res({ passthrough: true }) response: Response) {
    response.type('text/html');
    response.setHeader('cache-control', 'no-store');
    return await this.recharge.paymentPageHtml(orderId);
  }
}
