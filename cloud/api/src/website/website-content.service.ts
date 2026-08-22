import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type WebsiteCommandReference } from '@prisma/client';
import type { AuthenticatedUser } from '../common/current-user.js';
import { readR2UploadConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class WebsiteContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** 供客户端检查更新的轻量公开接口：只返回最新发布版本的版本号等最小信息。 */
  async latestVersion(input: { platform: string; architecture: string; channel: string }) {
    const release = await this.prisma.websiteDownloadRelease.findFirst({
      where: { publicationStatus: 'PUBLISHED', channel: input.channel || 'stable', platform: input.platform || 'Windows', architecture: input.architecture || 'x64' },
      orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }],
      select: { version: true, title: true, summary: true, publishedAt: true }
    });
    if (!release) return { ok: true, available: false };
    return { ok: true, available: true, version: release.version, title: release.title, summary: release.summary, publishedAt: release.publishedAt };
  }

  async publicBootstrap() {
    const [downloads, guides, demos, groups] = await Promise.all([
      this.prisma.websiteDownloadRelease.findMany({
        where: { publicationStatus: 'PUBLISHED' },
        include: { mirrors: { where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
        orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }]
      }),
      this.prisma.websiteGuideArticle.findMany({ where: { publicationStatus: 'PUBLISHED' }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }] }),
      this.prisma.websiteDemoProject.findMany({ where: { publicationStatus: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] }),
      this.prisma.websiteCommunityGroup.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    ]);
    return { ok: true, downloads, guides, demos, groups };
  }

  async publicCommands(input: { query?: string; kind?: string; category?: string; moduleId?: string; lifecycle?: string; limit?: number }) {
    const query = clean(input.query, 120);
    const where: Prisma.WebsiteCommandReferenceWhereInput = {
      publicationStatus: 'PUBLISHED',
      ...(input.kind ? { kind: clean(input.kind, 40) } : {}),
      ...(input.category ? { category: clean(input.category, 80) } : {}),
      ...(input.moduleId ? { moduleId: clean(input.moduleId, 100) } : {}),
      ...(input.lifecycle ? { lifecycle: clean(input.lifecycle, 40) } : {}),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          { signature: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { moduleId: { contains: query, mode: 'insensitive' } },
          { moduleName: { contains: query, mode: 'insensitive' } },
          { aliases: { has: query } }
        ]
      } : {})
    };
    const take = Math.max(1, Math.min(Number(input.limit || 100), 200));
    const [commands, total, facetRows] = await Promise.all([
      this.prisma.websiteCommandReference.findMany({ where, orderBy: [{ lifecycle: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }], take }),
      this.prisma.websiteCommandReference.count({ where }),
      this.prisma.websiteCommandReference.findMany({ where: { publicationStatus: 'PUBLISHED' }, select: { category: true, kind: true, moduleId: true, moduleName: true } })
    ]);
    return {
      ok: true,
      total,
      commands,
      facets: {
        categories: unique(facetRows.map(item => item.category)),
        kinds: unique(facetRows.map(item => item.kind)),
        modules: Array.from(new Map(facetRows.filter(item => item.moduleId).map(item => [item.moduleId!, { id: item.moduleId!, name: item.moduleName || item.moduleId! }])).values())
      }
    };
  }

  async publicGuide(slug: string) {
    const guide = await this.prisma.websiteGuideArticle.findFirst({ where: { slug: clean(slug, 100), publicationStatus: 'PUBLISHED' } });
    if (!guide) throw notFound('没有找到这篇公开文档。');
    return { ok: true, guide };
  }

  async adminSnapshot() {
    const [downloads, commands, guides, demos, groups] = await Promise.all([
      this.prisma.websiteDownloadRelease.findMany({ include: { mirrors: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } }, orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }] }),
      this.prisma.websiteCommandReference.findMany({ orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }], take: 500 }),
      this.prisma.websiteGuideArticle.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.websiteDemoProject.findMany({ orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] }),
      this.prisma.websiteCommunityGroup.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    ]);
    return { ok: true, downloads, commands, guides, demos, groups };
  }

  /**
   * 管理后台直链上传入口配置：返回 R2 上传 Worker 地址与共享 Bearer 令牌。
   * 令牌只下发给 super_admin / operator，前端拿到后浏览器直传 Cloudflare，文件字节不经过本服务。
   */
  r2UploadConfig() {
    const { endpoint, token } = readR2UploadConfig();
    if (!endpoint || !token) {
      throw Object.assign(
        new Error('直链上传未配置：请在云端 API 设置 R2_UPLOAD_WORKER_URL 和 R2_UPLOAD_TOKEN（后者需与 Worker 的 R2_UPLOAD_TOKEN secret 一致）。'),
        { status: 400, code: 'R2_UPLOAD_NOT_CONFIGURED' },
      );
    }
    return { ok: true, endpoint, token };
  }

  async upsertDownload(body: JsonRecord, actor: AuthenticatedUser) {
    const version = required(body.version, '版本号', 40);
    const channel = clean(body.channel || 'stable', 40);
    const platform = clean(body.platform || 'Windows', 40);
    const architecture = clean(body.architecture || 'x64', 40);
    const data = {
      version,
      channel,
      platform,
      architecture,
      title: required(body.title, '下载标题', 160),
      summary: clean(body.summary, 1000),
      releaseNotes: clean(body.releaseNotes, 20_000),
      minimumRequirements: clean(body.minimumRequirements, 3000),
      fileSize: clean(body.fileSize, 80),
      sha256: clean(body.sha256, 128),
      publicationStatus: publication(body.publicationStatus),
      publishedAt: publication(body.publicationStatus) === 'PUBLISHED' ? parseDate(body.publishedAt) || new Date() : null,
      sortOrder: integer(body.sortOrder, 0)
    };
    const release = await this.prisma.websiteDownloadRelease.upsert({
      where: { version_channel_platform_architecture: { version, channel, platform, architecture } },
      create: data,
      update: data
    });
    await this.audit(actor, 'website.download.upsert', 'website-download', release.id, { version, channel, publicationStatus: data.publicationStatus });
    return { ok: true, release };
  }

  async upsertMirror(body: JsonRecord, actor: AuthenticatedUser) {
    const releaseId = required(body.releaseId, '下载版本', 100);
    const provider = required(body.provider, '网盘标识', 60);
    const url = externalUrl(body.url, '下载地址');
    const data = {
      releaseId,
      provider,
      label: required(body.label, '网盘名称', 80),
      url,
      accessCode: clean(body.accessCode, 80),
      enabled: body.enabled !== false,
      sortOrder: integer(body.sortOrder, 0)
    };
    const mirror = await this.prisma.websiteDownloadMirror.upsert({ where: { releaseId_provider: { releaseId, provider } }, create: data, update: data });
    await this.audit(actor, 'website.download-mirror.upsert', 'website-download-mirror', mirror.id, { releaseId, provider });
    return { ok: true, mirror };
  }

  async upsertGroup(body: JsonRecord, actor: AuthenticatedUser) {
    const qqNumber = required(body.qqNumber, 'QQ群号', 30);
    if (!/^\d{5,20}$/u.test(qqNumber)) throw validation('QQ群号格式无效。');
    const data = {
      name: required(body.name, '群名称', 120),
      qqNumber,
      groupType: clean(body.groupType || '官方交流群', 80),
      joinUrl: optionalExternalUrl(body.joinUrl, '加群链接'),
      qrCodeUrl: optionalExternalUrl(body.qrCodeUrl, '二维码地址'),
      description: clean(body.description, 1000),
      statusText: clean(body.statusText || '开放加入', 80),
      enabled: body.enabled !== false,
      sortOrder: integer(body.sortOrder, 0)
    };
    const group = await this.prisma.websiteCommunityGroup.upsert({ where: { qqNumber }, create: data, update: data });
    await this.audit(actor, 'website.community-group.upsert', 'website-community-group', group.id, { qqNumber, enabled: data.enabled });
    return { ok: true, group };
  }

  async upsertGuide(body: JsonRecord, actor: AuthenticatedUser) {
    const slug = slugValue(body.slug);
    const data = {
      slug,
      title: required(body.title, '文档标题', 160),
      summary: clean(body.summary, 1000),
      kind: required(body.kind, '文档类型', 40).toUpperCase(),
      category: clean(body.category, 80),
      bodyMarkdown: required(body.bodyMarkdown, '文档正文', 100_000),
      coverImageUrl: optionalExternalUrl(body.coverImageUrl, '封面地址'),
      tags: stringArray(body.tags, 30, 60),
      minimumVersion: clean(body.minimumVersion, 40),
      publicationStatus: publication(body.publicationStatus),
      sortOrder: integer(body.sortOrder, 0)
    };
    const guide = await this.prisma.websiteGuideArticle.upsert({ where: { slug }, create: data, update: data });
    await this.audit(actor, 'website.guide.upsert', 'website-guide', guide.id, { slug, kind: data.kind, publicationStatus: data.publicationStatus });
    return { ok: true, guide };
  }

  async upsertDemo(body: JsonRecord, actor: AuthenticatedUser) {
    const slug = slugValue(body.slug);
    const sourceLinks = linkArray(body.sourceLinks, '源码地址');
    if (!sourceLinks.length) throw validation('示例项目至少需要一个源码地址。');
    const data = {
      slug,
      title: required(body.title, '示例标题', 160),
      summary: required(body.summary, '示例说明', 2000),
      category: required(body.category, '示例分类', 80),
      difficulty: clean(body.difficulty || '入门', 40),
      lingBuilderVersion: clean(body.lingBuilderVersion, 40),
      modules: stringArray(body.modules, 100, 120),
      prerequisites: clean(body.prerequisites, 3000),
      sourceLinks: sourceLinks as Prisma.InputJsonValue,
      screenshotUrl: optionalExternalUrl(body.screenshotUrl, '截图地址'),
      videoUrl: optionalExternalUrl(body.videoUrl, '视频地址'),
      license: clean(body.license, 120),
      publicationStatus: publication(body.publicationStatus),
      sortOrder: integer(body.sortOrder, 0)
    };
    const demo = await this.prisma.websiteDemoProject.upsert({ where: { slug }, create: data, update: data });
    await this.audit(actor, 'website.demo.upsert', 'website-demo', demo.id, { slug, publicationStatus: data.publicationStatus });
    return { ok: true, demo };
  }

  async upsertCommand(body: JsonRecord, actor: AuthenticatedUser) {
    const name = required(body.name, '命令名称', 160);
    const moduleId = clean(body.moduleId, 120) || null;
    const stableKey = clean(body.stableKey, 260) || `${moduleId || 'manual'}:${name}`;
    const data = commandData(body, { stableKey, name, moduleId, source: clean(body.source || 'manual', 60) });
    const command = await this.prisma.websiteCommandReference.upsert({ where: { stableKey }, create: data, update: data });
    await this.audit(actor, 'website.command.upsert', 'website-command', command.id, { stableKey, publicationStatus: data.publicationStatus });
    return { ok: true, command };
  }

  async syncManifest(body: JsonRecord, actor: AuthenticatedUser) {
    const manifest = body.manifest as JsonRecord;
    if (!manifest || manifest.schemaVersion !== 2) throw validation('只支持 schemaVersion 2 的 LingBuilder 模块清单。');
    const moduleId = required(manifest.id, '模块 ID', 120);
    const moduleName = clean(manifest.displayName || manifest.name || moduleId, 160);
    const version = required(manifest.version, '模块版本', 60);
    const category = clean(manifest.category || '其他', 80);
    const minimumVersion = clean(manifest.minLingBuilderVersion, 40);
    const contributes = isRecord(manifest.contributes) ? manifest.contributes : {};
    const bindingsRoot = isRecord(manifest.bindings) ? manifest.bindings : {};
    const contributions = arrayOfRecords(contributes.commands);
    const bindings = arrayOfRecords(bindingsRoot.commands);
    const contributionByName = new Map<string, JsonRecord>();
    for (const item of contributions) { const name = clean(item.name, 160); if (name) contributionByName.set(name, item); }
    const bindingByName = new Map<string, JsonRecord>();
    for (const item of bindings) { const name = clean(item.command, 160); if (name) bindingByName.set(name, item); }
    const names = unique([...contributionByName.keys(), ...bindingByName.keys()]);
    if (!names.length) throw validation('模块清单中没有可同步的 contributes.commands 或 bindings.commands。');
    const targetIds = arrayOfRecords(manifest.targets).map(item => clean(item.id, 80)).filter(Boolean);
    const publish = body.publish !== false;
    const keys: string[] = [];
    const updated: WebsiteCommandReference[] = [];
    for (const name of names) {
      const contribution = contributionByName.get(name) || {};
      const binding = bindingByName.get(name) || {};
      const stableKey = `${moduleId}:${name}`;
      keys.push(stableKey);
      const parameters = arrayOfRecords(binding.parameters);
      const signature = clean(contribution.signature, 1000) || `${name}(${parameters.map(item => clean(item.name, 100)).filter(Boolean).join(', ')})`;
      const value = commandData({
        stableKey,
        name,
        summary: contribution.description || binding.description || '',
        kind: 'COMMAND',
        category,
        moduleId,
        moduleName,
        signature,
        returnType: contribution.returnType || binding.returnType || 'void',
        returnDescription: contribution.returnDescription || '',
        parameters,
        examples: [binding.example || contribution.insertText].filter(Boolean),
        supportedBackends: targetIds,
        minimumVersion,
        lifecycle: 'AVAILABLE',
        source: 'module-manifest',
        sourceVersion: version,
        publicationStatus: publish ? 'PUBLISHED' : 'DRAFT'
      }, { stableKey, name, moduleId, source: 'module-manifest' });
      updated.push(await this.prisma.websiteCommandReference.upsert({ where: { stableKey }, create: value, update: value }));
    }
    const deprecated = await this.prisma.websiteCommandReference.updateMany({
      where: { moduleId, source: 'module-manifest', stableKey: { notIn: keys } },
      data: { lifecycle: 'DEPRECATED', sourceVersion: version }
    });
    await this.audit(actor, 'website.command.sync-manifest', 'website-module-command-set', moduleId, { version, commands: updated.length, deprecated: deprecated.count, published: publish });
    return { ok: true, moduleId, version, updated: updated.length, deprecated: deprecated.count };
  }

  private async audit(actor: AuthenticatedUser, action: string, targetType: string, targetId: string, details: unknown) {
    await this.prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action, targetType, targetId, requestId: crypto.randomUUID(), details: details as Prisma.InputJsonValue } });
  }
}

function commandData(body: JsonRecord, fixed: { stableKey: string; name: string; moduleId: string | null; source: string }) {
  return {
    stableKey: fixed.stableKey,
    name: fixed.name,
    aliases: stringArray(body.aliases, 30, 160),
    summary: clean(body.summary, 3000),
    kind: clean(body.kind || 'COMMAND', 40).toUpperCase(),
    category: clean(body.category || '其他', 80),
    moduleId: fixed.moduleId,
    moduleName: clean(body.moduleName, 160) || null,
    signature: required(body.signature, '命令签名', 2000),
    returnType: clean(body.returnType || 'void', 100),
    returnDescription: clean(body.returnDescription, 1000),
    parameters: arrayOfRecords(body.parameters) as Prisma.InputJsonValue,
    examples: stringArray(body.examples, 30, 5000) as Prisma.InputJsonValue,
    supportedBackends: stringArray(body.supportedBackends, 30, 100),
    minimumVersion: clean(body.minimumVersion, 40),
    lifecycle: clean(body.lifecycle || 'AVAILABLE', 40).toUpperCase(),
    source: fixed.source,
    sourceVersion: clean(body.sourceVersion, 60),
    publicationStatus: publication(body.publicationStatus),
    sortOrder: integer(body.sortOrder, 0)
  };
}

function clean(value: unknown, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function required(value: unknown, label: string, max: number) { const result = clean(value, max); if (!result) throw validation(`${label}不能为空。`); return result; }
function integer(value: unknown, fallback: number) { const result = Number(value); return Number.isInteger(result) ? Math.max(-100_000, Math.min(result, 100_000)) : fallback; }
function parseDate(value: unknown) { if (!value) return null; const result = new Date(String(value)); return Number.isFinite(result.getTime()) ? result : null; }
function publication(value: unknown) { const result = clean(value || 'DRAFT', 20).toUpperCase(); if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(result)) throw validation('发布状态无效。'); return result; }
function slugValue(value: unknown) { const result = clean(value, 100).toLowerCase(); if (!/^[a-z0-9][a-z0-9-]{1,99}$/u.test(result)) throw validation('Slug 只能使用小写字母、数字和连字符。'); return result; }
function isRecord(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function arrayOfRecords(value: unknown) { return Array.isArray(value) ? value.filter(isRecord) : []; }
function stringArray(value: unknown, maxItems: number, maxLength: number) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，\n]/u) : [];
  return unique(source.map(item => clean(item, maxLength)).filter(Boolean)).slice(0, maxItems);
}
function unique<T>(values: T[]) { return Array.from(new Set(values)); }
function externalUrl(value: unknown, label: string) { const result = clean(value, 2000); try { const parsed = new URL(result); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(); return parsed.toString(); } catch { throw validation(`${label}必须是有效的 HTTP 或 HTTPS 地址。`); } }
function optionalExternalUrl(value: unknown, label: string) { const result = clean(value, 2000); return result ? externalUrl(result, label) : ''; }
function linkArray(value: unknown, label: string) {
  const links = arrayOfRecords(value).slice(0, 20);
  return links.map(item => {
    const url = clean(item.url, 2000);
    if (!(url.startsWith('/') || /^https?:\/\//iu.test(url))) throw validation(`${label}必须是站内路径或 HTTP/HTTPS 地址。`);
    return { label: required(item.label || '源码下载', label, 100), url };
  });
}
function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function notFound(message: string) { return Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' }); }
