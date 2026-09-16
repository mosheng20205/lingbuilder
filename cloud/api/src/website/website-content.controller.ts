import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthenticatedUser } from '../common/current-user.js';
import { WebsiteContentService } from './website-content.service.js';

@Controller('v1/site')
@Public()
export class WebsiteContentController {
  constructor(@Inject(WebsiteContentService) private readonly website: WebsiteContentService) {}

  @Get('bootstrap') bootstrap() { return this.website.publicBootstrap(); }

  @Get('commands') commands(
    @Query('q') query = '',
    @Query('kind') kind = '',
    @Query('category') category = '',
    @Query('moduleId') moduleId = '',
    @Query('lifecycle') lifecycle = '',
    @Query('limit') limit = '100'
  ) { return this.website.publicCommands({ query, kind, category, moduleId, lifecycle, limit: Number(limit) }); }

  @Get('guides/:slug') guide(@Param('slug') slug: string) { return this.website.publicGuide(slug); }

  @Get('updates') updates() { return this.website.publicUpdates(); }

  // channel 缺省为空：客户端未指定渠道时跨渠道取最高版本，显式传入时才按渠道过滤。
  // preview 渠道需要体验计划资格：把 Authorization 头透传给服务层做可选鉴权，无资格时服务层静默降级 stable。
  @Get('latest-version') latestVersion(@Req() request: { headers: Record<string, unknown> }, @Query('platform') platform = 'Windows', @Query('architecture') architecture = 'x64', @Query('channel') channel = '') {
    return this.website.latestVersion({ platform, architecture, channel, authorization: request.headers.authorization });
  }
}

@Controller('v1/admin/site')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class WebsiteContentAdminController {
  constructor(@Inject(WebsiteContentService) private readonly website: WebsiteContentService) {}

  @Get() snapshot() { return this.website.adminSnapshot(); }
  @Get('r2-upload/config') @Roles('super_admin', 'operator') r2UploadConfig() { return this.website.r2UploadConfig(); }
  @Post('downloads') @Roles('super_admin', 'operator') download(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertDownload(body, actor); }
  @Post('download-mirrors') @Roles('super_admin', 'operator') mirror(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertMirror(body, actor); }
  @Post('community-groups') @Roles('super_admin', 'operator') group(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertGroup(body, actor); }
  @Post('sponsors') @Roles('super_admin', 'operator') sponsor(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertSponsor(body, actor); }
  @Delete('sponsors/:id') @Roles('super_admin', 'operator') removeSponsor(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) { return this.website.deleteSponsor(id, actor); }
  @Post('guides') @Roles('super_admin', 'operator') guide(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertGuide(body, actor); }
  @Post('demos') @Roles('super_admin', 'operator') demo(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertDemo(body, actor); }
  @Post('commands') @Roles('super_admin', 'operator') command(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertCommand(body, actor); }
  @Post('commands/sync-manifest') @Roles('super_admin', 'operator') syncManifest(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.syncManifest(body, actor); }
  @Get('updates') updatesSnapshot() { return this.website.adminUpdatesSnapshot(); }
  @Post('updates/sync') @Roles('super_admin', 'operator') syncUpdates(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.syncUpdates(body, actor); }
}
