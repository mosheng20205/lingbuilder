import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/current-user.js';
import { BetaProgramService } from './beta-program.service.js';

// 客户端接口：全局 AuthGuard 生效（未标记 @Public），未登录请求直接 401。
@Controller('v1/beta-program')
export class BetaProgramController {
  constructor(@Inject(BetaProgramService) private readonly beta: BetaProgramService) {}

  @Get('entitlement') entitlement(@CurrentUser() user: AuthenticatedUser) { return this.beta.entitlement(user.id); }

  @Post('applications') apply(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) { return this.beta.apply(user.id, body); }

  @Delete('applications/active') cancel(@CurrentUser() user: AuthenticatedUser) { return this.beta.cancelApplication(user.id); }
}

// 管理端接口：四角色可读，写操作仅 super_admin / operator（AuthGuard 按 @Roles 强制 MFA）。
@Controller('v1/admin/beta-program')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class BetaProgramAdminController {
  constructor(@Inject(BetaProgramService) private readonly beta: BetaProgramService) {}

  @Get() snapshot() { return this.beta.adminSnapshot(); }

  @Get('applications') applications(@Query('status') status = '') { return this.beta.adminApplications(status); }

  @Post('members') @Roles('super_admin', 'operator') addMember(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.beta.addMember(body, actor); }

  @Post('members/batch') @Roles('super_admin', 'operator') addMembers(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.beta.addMembersBatch(body, actor); }

  @Patch('members/:id') @Roles('super_admin', 'operator') updateMember(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.beta.updateMember(id, body, actor); }

  @Delete('members/:id') @Roles('super_admin', 'operator') removeMember(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) { return this.beta.removeMember(id, actor); }

  @Post('applications/:id/approve') @Roles('super_admin', 'operator') approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) { return this.beta.approveApplication(id, actor); }

  @Post('applications/:id/reject') @Roles('super_admin', 'operator') reject(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.beta.rejectApplication(id, body, actor); }

  @Get('settings') settings() { return this.beta.adminSettings(); }

  @Put('settings') @Roles('super_admin', 'operator') updateSettings(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.beta.updateSettings(body, actor); }
}
