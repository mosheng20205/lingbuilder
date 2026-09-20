import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma, type WebsiteCommandReference } from '@prisma/client';
import type { AuthenticatedUser } from '../common/current-user.js';
import { readR2UploadConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { BetaProgramService } from '../beta-program/beta-program.service.js';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class WebsiteContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Optional() @Inject(BetaProgramService) private readonly beta?: BetaProgramService) {}

  /** 供客户端检查更新的公开接口：返回最新发布版本与安装包直链/校验信息；缺数据的字段显式置 null，便于客户端统一判空。 */
  async latestVersion(input: { platform: string; architecture: string; channel: string; authorization?: unknown }) {
    // channel 为空表示客户端未指定渠道（现有 IDE 客户端不带该参数）：跨 stable/preview 渠道取最高版本，
    // 避免发布记录登记到非默认渠道后全部存量客户端收不到更新通知。
    let channel = String(input.channel || '').trim().toLowerCase();
    // preview 渠道走体验计划门禁：无有效资格或渠道被暂停时静默降级为 stable，更新检查永不因此报错。
    if (channel === 'preview') {
      const allowed = this.beta ? await this.beta.resolvePreviewAccess(input.authorization) : false;
      if (!allowed) channel = 'stable';
    }
    const releases = await this.prisma.websiteDownloadRelease.findMany({
      where: { publicationStatus: 'PUBLISHED', ...(channel ? { channel } : {}), platform: input.platform || 'Windows', architecture: input.architecture || 'x64' },
      orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }],
      select: {
        version: true, title: true, summary: true, publishedAt: true, channel: true, fileSize: true, sha256: true, releaseNotes: true,
        mirrors: { where: { enabled: true, provider: 'direct' }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
      }
    });
    const release = pickHighestVersionRelease(releases);
    if (!release) return { ok: true, available: false };
    return {
      ok: true,
      available: true,
      version: release.version,
      title: release.title,
      summary: release.summary,
      publishedAt: release.publishedAt,
      channel: release.channel || null,
      fileSize: release.fileSize || null,
      sha256: normalizeSha256(release.sha256),
      releaseNotes: release.releaseNotes || null,
      downloadUrl: pickHttpsDirectMirrorUrl(release.mirrors)
    };
  }

  async publicBootstrap() {
    const [downloads, guides, demos, groups, sponsors] = await Promise.all([
      this.prisma.websiteDownloadRelease.findMany({
        where: { publicationStatus: 'PUBLISHED' },
        include: { mirrors: { where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
        orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }]
      }),
      this.prisma.websiteGuideArticle.findMany({ where: { publicationStatus: 'PUBLISHED' }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }] }),
      this.prisma.websiteDemoProject.findMany({ where: { publicationStatus: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] }),
      this.prisma.websiteCommunityGroup.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.websiteSponsor.findMany({ where: { enabled: true }, orderBy: [{ sponsoredAt: 'asc' }, { createdAt: 'asc' }] })
    ]);
    return { ok: true, downloads, guides, demos, groups, sponsors };
  }

  async publicCommands(input: { query?: string; kind?: string; category?: string; moduleId?: string; lifecycle?: string; limit?: number }) {
    const query = clean(input.query, 120);
    const where: Prisma.WebsiteCommandReferenceWhereInput = {
      publicationStatus: 'PUBLISHED',
      ...(input.kind ? { kind: clean(input.kind, 40) } : {}),
      ...(input.category ? { category: clean(input.category, 80) } : {}),
      ...(input.moduleId ? { moduleId: clean(input.moduleId, 100) } : {}),
      ...(input.lifecycle ? { lifecycle: clean(input.lifecycle, 40) } : {})
    };
    const take = Math.max(1, Math.min(Number(input.limit || 100), 200));
    // 命令表在数千条量级：带关键词时取全量命中在内存里做范围判定与相关度排序，
    // 以便覆盖参数说明与别名子串这类 Prisma where 难以表达（或大小写语义与其它字段不一致）的搜索范围。
    if (query) {
      const [matches, facetRows] = await Promise.all([
        this.prisma.websiteCommandReference.findMany({ where, orderBy: commandListOrder }),
        this.facetRows()
      ]);
      const ranked = rankCommandMatches(matches, query.toLowerCase());
      return { ok: true, total: ranked.length, commands: ranked.slice(0, take), facets: commandFacets(facetRows) };
    }
    const [commands, total, facetRows] = await Promise.all([
      this.prisma.websiteCommandReference.findMany({ where, orderBy: commandListOrder, take }),
      this.prisma.websiteCommandReference.count({ where }),
      this.facetRows()
    ]);
    return { ok: true, total, commands, facets: commandFacets(facetRows) };
  }

  private facetRows() {
    return this.prisma.websiteCommandReference.findMany({ where: { publicationStatus: 'PUBLISHED' }, select: { category: true, kind: true, moduleId: true, moduleName: true } });
  }

  async publicGuide(slug: string) {
    const guide = await this.prisma.websiteGuideArticle.findFirst({ where: { slug: clean(slug, 100), publicationStatus: 'PUBLISHED' } });
    if (!guide) throw notFound('没有找到这篇公开文档。');
    return { ok: true, guide };
  }

  /** 公开「更新记录」：全部日期按倒序返回，itemsJson 解析为结构化条目后再下发。 */
  async publicUpdates() {
    const entries = await this.prisma.websiteUpdateEntry.findMany({ orderBy: [{ date: 'desc' }] });
    return { ok: true, updates: entries.map(entry => ({ date: entry.date, items: parseUpdateItems(entry.itemsJson) })) };
  }

  /** 管理端只读快照：供同步脚本对比本地发布文件与云端的日期差异、展示增量计划。 */
  async adminUpdatesSnapshot() {
    const entries = await this.prisma.websiteUpdateEntry.findMany({ orderBy: [{ date: 'asc' }], select: { date: true, itemsJson: true, updatedAt: true } });
    return { ok: true, updates: entries.map(entry => ({ date: entry.date, items: parseUpdateItems(entry.itemsJson), updatedAt: entry.updatedAt })) };
  }

  /**
   * 更新记录整量同步：payload 即「应当公开的全部日期」，逐日期 upsert，
   * 并删除云端有而 payload 没有的日期——同步后云端始终是本地发布文件的镜像，重复执行结果一致。
   */
  async syncUpdates(body: JsonRecord, actor: AuthenticatedUser) {
    const rows = arrayOfRecords(body.updates);
    if (!rows.length) throw validation('同步内容为空：updates 至少需要一个日期条目。');
    if (rows.length > 400) throw validation('单次同步最多支持 400 个日期。');
    const merged = new Map<string, string>();
    for (const row of rows) {
      const date = clean(row.date, 10);
      if (!isValidUpdateDate(date)) throw validation(`日期格式无效：${date || '（空）'}，应为真实存在的 YYYY-MM-DD 日期。`);
      if (merged.has(date)) throw validation(`日期重复：${date}。`);
      const items = arrayOfRecords(row.items)
        .slice(0, 40)
        .map(item => {
          const normalized: WebsiteUpdateItem = { category: clean(item.category, 20), text: clean(item.text, 600) };
          if (isRecord(item.image)) {
            const url = clean(item.image.url, 300);
            if (!UPDATE_IMAGE_URL_PATTERN.test(url)) throw validation(`${date} 的图片地址无效：${url || '（空）'}，仅允许 /update-assets/ 目录下的 .png/.jpg/.jpeg/.webp 静态文件。`);
            normalized.image = { url, caption: clean(item.image.caption, 120) || '查看图片' };
          }
          return normalized;
        })
        .filter(item => item.text);
      if (!items.length) throw validation(`${date} 至少需要一条更新内容。`);
      for (const item of items) {
        if (!(UPDATE_CATEGORIES as readonly string[]).includes(item.category)) throw validation(`${date} 存在无效分类「${item.category || '（空）'}」，只允许：${UPDATE_CATEGORIES.join('、')}。`);
      }
      merged.set(date, JSON.stringify(items));
    }
    const existing = await this.prisma.websiteUpdateEntry.findMany({ select: { date: true } });
    const existingDates = new Set(existing.map(entry => entry.date));
    let created = 0;
    let updated = 0;
    for (const [date, itemsJson] of merged) {
      await this.prisma.websiteUpdateEntry.upsert({ where: { date }, create: { date, itemsJson }, update: { itemsJson } });
      if (existingDates.has(date)) updated += 1; else created += 1;
    }
    const removed = await this.prisma.websiteUpdateEntry.deleteMany({ where: { date: { notIn: [...merged.keys()] } } });
    await this.audit(actor, 'website.update.sync', 'website-update-set', 'all', { synced: merged.size, created, updated, removed: removed.count });
    return { ok: true, synced: merged.size, created, updated, removed: removed.count };
  }

  async adminSnapshot() {
    const [downloads, commands, guides, demos, groups, sponsors] = await Promise.all([
      this.prisma.websiteDownloadRelease.findMany({ include: { mirrors: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } }, orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }] }),
      this.prisma.websiteCommandReference.findMany({ orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }], take: 500 }),
      this.prisma.websiteGuideArticle.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.websiteDemoProject.findMany({ orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] }),
      this.prisma.websiteCommunityGroup.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.websiteSponsor.findMany({ orderBy: [{ sponsoredAt: 'asc' }, { createdAt: 'asc' }] })
    ]);
    return { ok: true, downloads, commands, guides, demos, groups, sponsors };
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

  /** 登记或更新一笔赞助：金额按元录入、以分存储；带 id 时更新原记录，否则新建。同一 QQ 可有多笔赞助，不做唯一约束。 */
  async upsertSponsor(body: JsonRecord, actor: AuthenticatedUser) {
    const qqNumber = required(body.qqNumber, 'QQ号', 20);
    if (!/^\d{4,20}$/u.test(qqNumber)) throw validation('QQ号格式无效，应为 4-20 位数字。');
    const data = {
      qqNumber,
      amountCents: amountToCents(body.amountYuan),
      sponsoredAt: parseDate(body.sponsoredAt) || new Date(),
      enabled: body.enabled !== false
    };
    const id = clean(body.id, 100);
    const sponsor = id
      ? await this.prisma.websiteSponsor.update({ where: { id }, data })
      : await this.prisma.websiteSponsor.create({ data });
    await this.audit(actor, 'website.sponsor.upsert', 'website-sponsor', sponsor.id, { qqNumber, amountCents: data.amountCents, enabled: data.enabled });
    return { ok: true, sponsor };
  }

  async deleteSponsor(id: string, actor: AuthenticatedUser) {
    const target = clean(id, 100);
    if (!target) throw validation('缺少要删除的赞助记录 ID。');
    const sponsor = await this.prisma.websiteSponsor.delete({ where: { id: target } });
    await this.audit(actor, 'website.sponsor.delete', 'website-sponsor', sponsor.id, { qqNumber: sponsor.qqNumber, amountCents: sponsor.amountCents });
    return { ok: true };
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

const commandListOrder: Prisma.WebsiteCommandReferenceOrderByWithRelationInput[] = [{ lifecycle: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }];

function commandFacets(facetRows: Array<{ category: string; kind: string; moduleId: string | null; moduleName: string | null }>) {
  return {
    categories: unique(facetRows.map(item => item.category)),
    kinds: unique(facetRows.map(item => item.kind)),
    modules: Array.from(new Map(facetRows.filter(item => item.moduleId).map(item => [item.moduleId!, { id: item.moduleId!, name: item.moduleName || item.moduleId! }])).values())
  };
}

/** 命令搜索相关度分层：0 名称/别名命中，1 摘要/签名/参数说明命中，2 仅分类或模块字段连带命中；同层保持数据库给定顺序。 */
function rankCommandMatches<T extends WebsiteCommandReference>(rows: T[], query: string): T[] {
  return rows
    .map(row => ({ row, rank: commandMatchRank(row, query) }))
    .filter((item): item is { row: T; rank: number } => item.rank !== null)
    .sort((left, right) =>
      left.rank - right.rank ||
      compareText(left.row.lifecycle, right.row.lifecycle) ||
      left.row.sortOrder - right.row.sortOrder ||
      compareText(left.row.name, right.row.name))
    .map(item => item.row);
}

function commandMatchRank(row: WebsiteCommandReference, query: string): number | null {
  if (textHits([row.name, ...row.aliases], query)) return 0;
  if (textHits([row.summary, row.signature], query)) return 1;
  if (textHits(arrayOfRecords(row.parameters).map(item => item.description), query)) return 1;
  if (textHits([row.category, row.moduleId || '', row.moduleName || ''], query)) return 2;
  return null;
}

function textHits(values: unknown[], query: string) { return values.some(value => typeof value === 'string' && value.toLowerCase().includes(query)); }
function compareText(left: string, right: string) { return left < right ? -1 : left > right ? 1 : 0; }
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
function normalizeSha256(value: unknown) {
  const result = clean(value, 64).toLowerCase();
  return /^[a-f0-9]{64}$/u.test(result) ? result : null;
}

/** 赞助金额以「元」录入、以「分」存储：避免浮点直接入库，两位小数以外四舍五入，上限 100 万元。 */
function amountToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw validation('赞助金额必须是大于 0 的数字。');
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents > 100_000_000) throw validation('赞助金额超出可录入范围。');
  return cents;
}

/** 语义化版本号比较：left > right 返回正数。容忍 v 前缀与预发布后缀，与客户端 compareVersions 保持一致。 */
function compareReleaseVersions(left: unknown, right: unknown) {
  const parse = (value: unknown) => String(value ?? '').trim().replace(/^v/iu, '').split('-')[0].split('.').map(part => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * 客户端更新只认版本号高低：sortOrder/publishedAt 只作为同版本号的次级顺序，
 * 避免后台给旧版本设了更大的 sortOrder 之后把新版本压住、导致所有用户收不到更新。
 */
function pickHighestVersionRelease<T extends { version: unknown }>(releases: T[]): T | null {
  let best: T | null = null;
  for (const release of Array.isArray(releases) ? releases : []) {
    if (!release) continue;
    if (!best || compareReleaseVersions(release.version, best.version) > 0) best = release;
  }
  return best;
}

/** 直链镜像只在 HTTPS 时下发给客户端：HTTP 直链视为不可用，客户端侧还有独立的 https 门禁兜底。 */
function pickHttpsDirectMirrorUrl(mirrors: Array<{ provider: string; enabled: boolean; url: string }>) {
  for (const mirror of Array.isArray(mirrors) ? mirrors : []) {
    if (mirror?.provider !== 'direct' || mirror.enabled === false) continue;
    if (typeof mirror.url === 'string' && mirror.url.startsWith('https://')) return mirror.url;
  }
  return null;
}

function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function notFound(message: string) { return Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' }); }

/** 更新记录条目允许的分类；官网前端按同一份清单渲染标识与配色。 */
const UPDATE_CATEGORIES = ['新功能', '问题修复', '新模块', '体验优化', '教程与示例', '版本发布'] as const;

/** 严格校验真实存在的日历日期：Date.parse 会把 2026-02-30 滚动成 3 月初，不能依赖。 */
function isValidUpdateDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseUpdateItems(itemsJson: string): WebsiteUpdateItem[] {
  try {
    const value: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord)
      .map(item => {
        const entry: WebsiteUpdateItem = { category: clean(item.category, 20), text: clean(item.text, 600) };
        if (isRecord(item.image)) {
          const url = clean(item.image.url, 300);
          if (UPDATE_IMAGE_URL_PATTERN.test(url)) entry.image = { url, caption: clean(item.image.caption, 120) || '查看图片' };
        }
        return entry;
      })
      .filter(item => item.text);
  } catch {
    return [];
  }
}

export interface WebsiteUpdateItem { category: string; text: string; image?: { url: string; caption: string } }

// 更新记录配图只允许同源 /update-assets/ 静态前缀（admin 容器 nginx html/update-assets 目录），杜绝外链注入。
// 前缀不能叫 /updates：SPA 路由 /updates 会被 nginx try_files 命中该目录返回 403。
const UPDATE_IMAGE_URL_PATTERN = /^\/update-assets\/[A-Za-z0-9._~-]+\.(?:png|jpe?g|webp)$/u;
