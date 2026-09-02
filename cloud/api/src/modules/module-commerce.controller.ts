import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, type AuthenticatedUser } from '../common/current-user.js';
import { ModuleCommerceService } from './module-commerce.service.js';
import { ModuleArtifactService } from './module-artifact.service.js';
import { moduleSigningAcceptedKeyIds } from './module-signing-key.js';

@Controller('v1')
export class ModuleCommerceController {
  constructor(@Inject(ModuleCommerceService) private readonly commerce: ModuleCommerceService, @Inject(ModuleArtifactService) private readonly artifacts: ModuleArtifactService) {}
  @Get('modules/catalog') async userCatalog(@CurrentUser() user: AuthenticatedUser) { return { ok: true, products: await this.commerce.catalog(user.id) }; }
  @Get('modules/access') async access(@CurrentUser() user: AuthenticatedUser, @Query('moduleId') moduleId = '') { return { ok: true, access: await this.commerce.resolveAccess(user.id, moduleId) }; }
  @Get('modules/entitlements') async entitlements(@CurrentUser() user: AuthenticatedUser) { return { ok: true, entitlements: await this.commerce.listEntitlements(user.id) }; }
  @Get('module-orders') async orders(@CurrentUser() user: AuthenticatedUser) { return { ok: true, orders: await this.commerce.listOrders(user.id) }; }
  @Get('modules/permit-key') permitKey() { return { ok: true, ...this.commerce.permitPublicKey(), acceptedKeyIds: moduleSigningAcceptedKeyIds() }; }
  @Post('modules/permit') async permit(@CurrentUser() user: AuthenticatedUser, @Body() body: any) { return { ok: true, permit: await this.commerce.issuePermit(user.id, String(body.moduleId || '')) }; }
  @Post('module-orders') async order(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') idempotencyKey = '', @Body() body: any) {
    const provider = String(body.provider || '').toUpperCase();
    if (!['WECHAT', 'ALIPAY'].includes(provider)) throw Object.assign(new Error('支付渠道必须是微信支付或支付宝。'), { status: 400, code: 'VALIDATION_FAILED' });
    return { ok: true, order: await this.commerce.createOrder(user.id, String(body.offerId || ''), provider as 'WECHAT'|'ALIPAY', idempotencyKey) };
  }
  @Get('modules/artifacts/latest') async latestArtifact(@CurrentUser() user: AuthenticatedUser, @Query('moduleId') moduleId = '', @Query('arch') arch = 'any') { return { ok: true, artifact: await this.artifacts.latestForUser(user.id, moduleId, arch) }; }
  @Get('modules/artifacts/:artifactId/download') async downloadArtifact(@CurrentUser() user: AuthenticatedUser, @Param('artifactId') artifactId: string, @Res({ passthrough: true }) response: Response) {
    const value = await this.artifacts.openDownload(user.id, artifactId);
    response.setHeader('content-type', 'application/octet-stream');
    response.setHeader('content-length', String(value.sizeBytes));
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(value.fileName)}`);
    response.setHeader('x-content-sha256', value.sha256);
    return new StreamableFile(value.stream);
  }
  @Public() @Post('module-payments/:provider/webhook') async webhook(@Param('provider') rawProvider: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const provider = rawProvider.toUpperCase();
    if (!['WECHAT', 'ALIPAY'].includes(provider)) throw Object.assign(new Error('未知支付渠道。'), { status: 404, code: 'VALIDATION_FAILED' });
    const rawBody = Buffer.isBuffer((request as any).rawBody) ? (request as any).rawBody.toString('utf8') : typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
    await this.commerce.paymentWebhook(provider as 'WECHAT'|'ALIPAY', rawBody, request.headers);
    if (provider === 'ALIPAY') { response.type('text/plain'); return 'success'; }
    return { code: 'SUCCESS', message: '成功' };
  }
}
