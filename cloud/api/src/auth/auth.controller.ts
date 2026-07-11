import { Body, Controller, Get, Headers, Ip, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public, type AuthenticatedUser } from '../common/current-user.js';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') register(@Body() body: any, @Ip() ip: string) { return this.auth.register(String(body.email || ''), String(body.password || ''), ip); }
  @Public() @Post('verify-email') verify(@Body() body: any) { return this.auth.verifyEmail(String(body.token || '')); }
  @Public() @Post('login') login(@Body() body: any, @Ip() ip: string, @Headers('user-agent') userAgent = '') { return this.auth.login(String(body.email || ''), String(body.password || ''), String(body.deviceName || 'LingBuilder IDE'), ip, userAgent, String(body.mfaCode || '')); }
  @Public() @Post('refresh') refresh(@Body() body: any, @Ip() ip: string, @Headers('user-agent') userAgent = '') { return this.auth.refresh(String(body.refreshToken || ''), ip, userAgent); }
  @Public() @Post('logout') logout(@Body() body: any) { return this.auth.logout(String(body.refreshToken || '')); }
  @Public() @Post('password/forgot') forgot(@Body() body: any) { return this.auth.forgotPassword(String(body.email || '')); }
  @Public() @Post('password/reset') reset(@Body() body: any) { return this.auth.resetPassword(String(body.token || ''), String(body.password || '')); }
  @Public() @Post('device/code') deviceCode(@Body() body: any) { return this.auth.createDeviceCode(String(body.deviceName || 'LingBuilder CLI')); }
  @Public() @Post('device/token') deviceToken(@Body() body: any) { return this.auth.pollDeviceCode(String(body.deviceCode || '')); }
  @Post('device/approve') approve(@Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.auth.approveDeviceCode(String(body.userCode || ''), user.id); }
  @Post('mfa/setup') setupMfa(@CurrentUser() user: AuthenticatedUser) { return this.auth.setupMfa(user.id, user.email); }
  @Post('mfa/enable') enableMfa(@Body() body: any, @CurrentUser() user: AuthenticatedUser) { return this.auth.enableMfa(user.id, String(body.code || '')); }
}

@Controller('v1')
export class MeController { @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return { ok: true, user }; } }
