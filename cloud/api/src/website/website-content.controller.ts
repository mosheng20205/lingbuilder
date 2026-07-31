import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
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
}

@Controller('v1/admin/site')
@Roles('super_admin', 'operator', 'support', 'auditor')
export class WebsiteContentAdminController {
  constructor(@Inject(WebsiteContentService) private readonly website: WebsiteContentService) {}

  @Get() snapshot() { return this.website.adminSnapshot(); }
  @Post('downloads') @Roles('super_admin', 'operator') download(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertDownload(body, actor); }
  @Post('download-mirrors') @Roles('super_admin', 'operator') mirror(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertMirror(body, actor); }
  @Post('community-groups') @Roles('super_admin', 'operator') group(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertGroup(body, actor); }
  @Post('guides') @Roles('super_admin', 'operator') guide(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertGuide(body, actor); }
  @Post('demos') @Roles('super_admin', 'operator') demo(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertDemo(body, actor); }
  @Post('commands') @Roles('super_admin', 'operator') command(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.upsertCommand(body, actor); }
  @Post('commands/sync-manifest') @Roles('super_admin', 'operator') syncManifest(@Body() body: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser) { return this.website.syncManifest(body, actor); }
}
