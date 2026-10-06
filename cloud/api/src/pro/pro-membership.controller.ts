import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/current-user.js';
import { ProMembershipService } from './pro-membership.service.js';

// 管理端：四角色可读；入会与撤销限 super_admin / operator / support，补差升级涉及金额只限 super_admin / operator。
@Controller('v1/admin/pro')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class ProMembershipAdminController {
  constructor(@Inject(ProMembershipService) private readonly pro: ProMembershipService) {}

  @Get() snapshot() { return this.pro.adminSnapshot(); }

  @Post('memberships') @Roles('super_admin', 'operator', 'support') create(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.create(body, actor); }

  @Post('memberships/:id/upgrade') @Roles('super_admin', 'operator') upgrade(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.upgrade(id, body, actor); }

  @Post('memberships/:id/revoke') @Roles('super_admin', 'operator', 'support') revoke(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.revoke(id, body, actor); }
}
