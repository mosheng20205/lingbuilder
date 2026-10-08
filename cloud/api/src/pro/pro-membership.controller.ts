import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthenticatedUser } from '../common/current-user.js';
import { ProMembershipService } from './pro-membership.service.js';

// 公开下发：启用中的 Pro 专享命令远程规则（标记本身是公开信息；授权判定仍在 IDE 构建链）。
@Controller('v1/site/pro-commands')
export class ProCommandsPublicController {
  constructor(@Inject(ProMembershipService) private readonly pro: ProMembershipService) {}

  @Public() @Get() snapshot() { return this.pro.publicProCommands(); }
}

// 管理端：四角色可读；入会与撤销限 super_admin / operator / support，补差升级涉及金额只限 super_admin / operator。
@Controller('v1/admin/pro')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class ProMembershipAdminController {
  constructor(@Inject(ProMembershipService) private readonly pro: ProMembershipService) {}

  @Get() snapshot() { return this.pro.adminSnapshot(); }

  @Post('memberships') @Roles('super_admin', 'operator', 'support') create(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.create(body, actor); }

  @Post('memberships/:id/upgrade') @Roles('super_admin', 'operator') upgrade(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.upgrade(id, body, actor); }

  @Post('memberships/:id/revoke') @Roles('super_admin', 'operator', 'support') revoke(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.revoke(id, body, actor); }

  @Post('command-rules') @Roles('super_admin', 'operator') createCommandRule(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.createCommandRule(body, actor); }

  @Patch('command-rules/:id') @Roles('super_admin', 'operator') updateCommandRule(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.pro.updateCommandRule(id, body, actor); }

  @Delete('command-rules/:id') @Roles('super_admin', 'operator') deleteCommandRule(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) { return this.pro.deleteCommandRule(id, actor); }
}
