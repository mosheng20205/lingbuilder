import { Body, Controller, Get, Headers, Inject, Ip, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public, type AuthenticatedUser } from '../common/current-user.js';

function verificationPage(title: string, message: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} - LingBuilder</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b1020;color:#e6e9f2}.card{max-width:26rem;padding:2.5rem;border-radius:12px;background:#131a2e;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35)}h1{font-size:1.3rem;margin:0 0 .8rem}p{margin:0;line-height:1.7;color:#aab3cc}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Public() @Post('register') register(@Body() body: any, @Ip() ip: string) { return this.auth.register(String(body.email || ''), String(body.password || ''), ip); }
  @Public() @Post('verify-email') verify(@Body() body: any) { return this.auth.verifyEmail(String(body.token || '')); }
  @Public() @Get('verify-email') async verifyGet(@Query('token') token: string, @Res() res: Response) {
    res.type('text/html'); res.charset = 'utf-8';
    try { await this.auth.verifyEmail(String(token || '')); return res.status(200).send(verificationPage('邮箱验证成功', '您的 LingBuilder 账号已完成邮箱验证，现在可以关闭此页面，回到客户端登录使用。')); }
    catch (error: any) { return res.status(400).send(verificationPage('验证失败', String(error?.message || '验证链接无效或已过期。请重新发起验证，或联系管理员。'))); }
  }
  @Public() @Post('login') login(@Body() body: any, @Ip() ip: string, @Headers('user-agent') userAgent = '') { return this.auth.login(String(body.email || ''), String(body.password || ''), String(body.deviceName || 'LingBuilder IDE'), ip, userAgent, String(body.mfaCode || '')); }
  @Public() @Post('refresh') refresh(@Body() body: any, @Ip() ip: string, @Headers('user-agent') userAgent = '') { return this.auth.refresh(String(body.refreshToken || ''), ip, userAgent); }
  @Public() @Post('logout') logout(@Body() body: any) { return this.auth.logout(String(body.refreshToken || '')); }
  @Public() @Post('password/forgot') forgot(@Body() body: any) { return this.auth.forgotPassword(String(body.email || '')); }
  @Public() @Post('password/reset') reset(@Body() body: any) { return this.auth.resetPassword(String(body.token || ''), String(body.password || '')); }
  @Post('password/change') change(@CurrentUser() user: AuthenticatedUser, @Body() body: any) { return this.auth.changePassword(user.id, String(body.currentPassword || ''), String(body.newPassword || '')); }
  @Public() @Post('token/refresh') tokenRefresh(@Body() body: any) { return this.auth.refresh(String(body.refreshToken || ''), '', '') };
  @Public() @Post('device/code') deviceCode(@Body() body: any) { return this.auth.createDeviceCode(String(body.deviceName || 'LingBuilder CLI')); }
  @Public() @Post('device/token') deviceToken(@Body() body: any) { return this.auth.pollDeviceCode(String(body.deviceCode || '')); }
  @Post('device/approve') approve(@Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.auth.approveDeviceCode(String(body.userCode || ''), user.id); }
  @Post('mfa/setup') setupMfa(@CurrentUser() user: AuthenticatedUser) { return this.auth.setupMfa(user.id, user.email); }
  @Post('mfa/enable') enableMfa(@Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.auth.enableMfa(user.id, String(body.code || '')); }
  @Post('mfa/disable') disableMfa(@Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.auth.disableMfa(user.id, String(body.code || '')); }
}

@Controller('v1')
export class MeController { @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return { ok: true, user }; } }
