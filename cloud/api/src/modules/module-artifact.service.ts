import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { artifactSignaturePayload, moduleSigningKeyPair, moduleSigningPublicKey } from './module-signing-key.js';
import { ModuleCommerceService } from './module-commerce.service.js';

const MAX_ARTIFACT_BYTES = 1024 * 1024 * 1024;
const MAX_CENTRAL_DIRECTORY_BYTES = 32 * 1024 * 1024;
const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,80}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;

@Injectable()
export class ModuleArtifactService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ModuleCommerceService) private readonly commerce: ModuleCommerceService
  ) {}

  async onModuleInit() {
    moduleSigningKeyPair();
    if (process.env.NODE_ENV === 'production') {
      const origin = String(process.env.CLOUD_API_ORIGIN || '').trim();
      if (!origin.startsWith('https://')) throw new Error('生产环境 CLOUD_API_ORIGIN 必须是公网 HTTPS 地址。');
      if (!process.env.MODULE_ARTIFACT_STORAGE_DIR?.trim()) throw new Error('生产环境必须配置持久化 MODULE_ARTIFACT_STORAGE_DIR。');
    }
    await fs.mkdir(this.storageRoot(), { recursive: true });
  }

  readiness() {
    const key = moduleSigningPublicKey();
    const storageConfigured = Boolean(process.env.MODULE_ARTIFACT_STORAGE_DIR?.trim()) || process.env.NODE_ENV !== 'production';
    return { ready: key.persistent && storageConfigured, signingKeyPersistent: key.persistent, keyId: key.keyId, storageConfigured };
  }

  async listArtifacts() {
    const rows = await this.prisma.moduleArtifact.findMany({ include: { product: true }, orderBy: [{ product: { name: 'asc' } }, { createdAt: 'desc' }] });
    return json(rows.map(row => this.metadata(row)));
  }

  async upload(request: AsyncIterable<Uint8Array>, input: { moduleId: string; version: string; arch: string; fileName: string; minimumIdeVersion?: string }, actorUserId: string) {
    const moduleId = input.moduleId.trim();
    const version = input.version.trim();
    const arch = input.arch.trim().toLowerCase() || 'any';
    const fileName = input.fileName.trim();
    if (!MODULE_ID_PATTERN.test(moduleId)) throw validation('模块 ID 格式无效。');
    if (!VERSION_PATTERN.test(version)) throw validation('模块版本必须是有效的语义化版本。');
    if (!['any', 'win32', 'x64'].includes(arch)) throw validation('模块制品架构只能是 any、win32 或 x64。');
    if (!/^[^\\/]{1,160}\.lbmod$/iu.test(fileName)) throw validation('模块制品文件名必须是安全的 .lbmod 文件名。');
    const product = await this.prisma.moduleProduct.findUnique({ where: { moduleId } });
    if (!product) throw validation('请先创建对应的收费模块商品。');

    const current = await this.prisma.moduleArtifact.findUnique({ where: { productId_version_arch: { productId: product.id, version, arch } } });
    const artifactId = current?.id || crypto.randomUUID();
    const storageKey = `${moduleId}/${version}/${arch}/${artifactId}.lbmod`;
    const absolutePath = this.resolveStorageKey(storageKey);
    const temporaryPath = `${absolutePath}.${crypto.randomBytes(6).toString('hex')}.partial`;
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    const handle = await fs.open(temporaryPath, 'wx');
    const hash = crypto.createHash('sha256');
    let sizeBytes = 0;
    try {
      for await (const rawChunk of request) {
        const chunk = Buffer.from(rawChunk);
        sizeBytes += chunk.length;
        if (sizeBytes > MAX_ARTIFACT_BYTES) throw validation('模块制品超过 1GB 限制。');
        hash.update(chunk);
        await handle.write(chunk);
      }
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
    await handle.close();
    if (sizeBytes === 0) { await fs.rm(temporaryPath, { force: true }); throw validation('模块制品不能为空。'); }

    try {
      const manifest = await inspectLbmod(temporaryPath);
      if (manifest.schemaVersion !== 2 || manifest.id !== moduleId || manifest.version !== version) throw validation('模块包 manifest 的 schemaVersion、模块 ID 或版本与上传信息不一致。');
      const sha256 = hash.digest('hex');
      const key = moduleSigningKeyPair();
      const signature = crypto.sign(null, artifactSignaturePayload({ id: artifactId, moduleId, version, arch, sha256, sizeBytes: String(sizeBytes) }), key.privateKey).toString('base64url');
      await fs.rm(absolutePath, { force: true });
      await fs.rename(temporaryPath, absolutePath);
      const artifact = await this.prisma.moduleArtifact.upsert({
        where: { productId_version_arch: { productId: product.id, version, arch } },
        create: { id: artifactId, productId: product.id, version, arch, fileName, storageKey, sha256, sizeBytes: BigInt(sizeBytes), signature, keyId: key.keyId, minimumIdeVersion: input.minimumIdeVersion?.trim() || null, enabled: true },
        update: { fileName, storageKey, sha256, sizeBytes: BigInt(sizeBytes), signature, keyId: key.keyId, minimumIdeVersion: input.minimumIdeVersion?.trim() || null, enabled: true }
      });
      if (current?.storageKey && current.storageKey !== storageKey) await fs.rm(this.resolveStorageKey(current.storageKey), { force: true });
      await this.prisma.adminAuditLog.create({ data: { actorUserId, action: 'module.artifact.publish', targetType: 'module-artifact', targetId: artifact.id, requestId: crypto.randomUUID(), details: { moduleId, version, arch, sha256, sizeBytes } } });
      return this.metadata({ ...artifact, product });
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async setEnabled(artifactId: string, enabled: boolean, actorUserId: string) {
    const artifact = await this.prisma.moduleArtifact.update({ where: { id: artifactId }, data: { enabled }, include: { product: true } });
    await this.prisma.adminAuditLog.create({ data: { actorUserId, action: enabled ? 'module.artifact.enable' : 'module.artifact.disable', targetType: 'module-artifact', targetId: artifact.id, requestId: crypto.randomUUID(), details: { moduleId: artifact.product.moduleId, version: artifact.version } } });
    return this.metadata(artifact);
  }

  async latestForUser(userId: string, moduleId: string, arch: string) {
    const access = await this.commerce.resolveAccess(userId, moduleId);
    if (!access.allowed || !access.productId) throw Object.assign(new Error(access.reason || '当前账号没有该收费模块的有效权益。'), { status: 402, code: 'MODULE_PAYMENT_REQUIRED' });
    const normalizedArch = ['win32', 'x64'].includes(arch) ? arch : 'any';
    const artifact = await this.prisma.moduleArtifact.findFirst({
      where: { productId: access.productId, enabled: true, arch: { in: normalizedArch === 'any' ? ['any'] : [normalizedArch, 'any'] } },
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });
    if (!artifact) throw Object.assign(new Error('该模块尚未发布可下载的安装制品。'), { status: 404, code: 'VALIDATION_FAILED' });
    return this.metadata(artifact);
  }

  async openDownload(userId: string, artifactId: string) {
    const artifact = await this.prisma.moduleArtifact.findUnique({ where: { id: artifactId }, include: { product: true } });
    if (!artifact || !artifact.enabled) throw Object.assign(new Error('模块制品不存在或已停用。'), { status: 404, code: 'VALIDATION_FAILED' });
    const access = await this.commerce.resolveAccess(userId, artifact.product.moduleId);
    if (!access.allowed) throw Object.assign(new Error(access.reason || '当前账号没有该收费模块的有效权益。'), { status: 402, code: 'MODULE_PAYMENT_REQUIRED' });
    const absolutePath = this.resolveStorageKey(artifact.storageKey);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile() || BigInt(stat.size) !== artifact.sizeBytes) throw Object.assign(new Error('模块制品存储校验失败，请联系管理员重新发布。'), { status: 503, code: 'MODULE_ACCESS_UNAVAILABLE' });
    await this.prisma.moduleAccessAudit.create({ data: { userId, productId: artifact.productId, moduleId: artifact.product.moduleId, action: 'artifact.download', allowed: true, source: access.source } });
    return { stream: createReadStream(absolutePath), fileName: artifact.fileName, sizeBytes: stat.size, sha256: artifact.sha256 };
  }

  private metadata(artifact: any) {
    const key = moduleSigningPublicKey();
    return json({ id: artifact.id, moduleId: artifact.product.moduleId, productId: artifact.productId, version: artifact.version, arch: artifact.arch, fileName: artifact.fileName, sha256: artifact.sha256, sizeBytes: artifact.sizeBytes, signature: artifact.signature, keyId: artifact.keyId, algorithm: key.algorithm, publicKeyPem: key.publicKeyPem, minimumIdeVersion: artifact.minimumIdeVersion, enabled: artifact.enabled, createdAt: artifact.createdAt, downloadPath: `/v1/modules/artifacts/${artifact.id}/download` });
  }

  private storageRoot() { return path.resolve(process.env.MODULE_ARTIFACT_STORAGE_DIR?.trim() || path.join(process.cwd(), '.lingbuilder', 'cloud-artifacts')); }
  private resolveStorageKey(storageKey: string) {
    const root = this.storageRoot();
    const resolved = path.resolve(root, storageKey);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('模块制品存储路径越界。');
    return resolved;
  }
}

async function inspectLbmod(filePath: string): Promise<{ schemaVersion?: number; id?: string; version?: string }> {
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const tailLength = Math.min(stat.size, 65_557);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tail.length, stat.size - tail.length);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) if (tail.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
    if (eocd < 0) throw validation('模块制品不是有效的 ZIP/.lbmod 文件。');
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (centralSize <= 0 || centralSize > MAX_CENTRAL_DIRECTORY_BYTES || centralOffset + centralSize > stat.size) throw validation('模块制品中央目录无效或过大。');
    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, central.length, centralOffset);
    let offset = 0;
    let manifestEntry: { method: number; compressedSize: number; uncompressedSize: number; localOffset: number } | undefined;
    while (offset + 46 <= central.length) {
      if (central.readUInt32LE(offset) !== 0x02014b50) throw validation('模块制品中央目录已损坏。');
      const method = central.readUInt16LE(offset + 10);
      const compressedSize = central.readUInt32LE(offset + 20);
      const uncompressedSize = central.readUInt32LE(offset + 24);
      const nameLength = central.readUInt16LE(offset + 28);
      const extraLength = central.readUInt16LE(offset + 30);
      const commentLength = central.readUInt16LE(offset + 32);
      const localOffset = central.readUInt32LE(offset + 42);
      const name = central.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replaceAll('\\', '/');
      const pathParts = name.replace(/\/$/u, '').split('/');
      if (name.startsWith('/') || /^[A-Za-z]:/u.test(name) || pathParts.some(part => part === '..' || part === '')) throw validation('模块制品包含不安全路径。');
      if (name === 'lingbuilder.module.json') manifestEntry = { method, compressedSize, uncompressedSize, localOffset };
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (!manifestEntry || manifestEntry.uncompressedSize > 2 * 1024 * 1024) throw validation('模块制品缺少有效的 lingbuilder.module.json。');
    const localHeader = Buffer.alloc(30);
    await handle.read(localHeader, 0, localHeader.length, manifestEntry.localOffset);
    if (localHeader.readUInt32LE(0) !== 0x04034b50) throw validation('模块制品 manifest 条目已损坏。');
    const nameLength = localHeader.readUInt16LE(26);
    const extraLength = localHeader.readUInt16LE(28);
    const compressed = Buffer.alloc(manifestEntry.compressedSize);
    await handle.read(compressed, 0, compressed.length, manifestEntry.localOffset + 30 + nameLength + extraLength);
    const content = manifestEntry.method === 0 ? compressed : manifestEntry.method === 8 ? zlib.inflateRawSync(compressed) : undefined;
    if (!content || content.length !== manifestEntry.uncompressedSize) throw validation('模块制品 manifest 使用了不支持的压缩方式或内容已损坏。');
    return JSON.parse(content.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw validation('模块制品 manifest 不是有效 JSON。');
    throw error;
  } finally { await handle.close(); }
}

function validation(message: string) { return Object.assign(new Error(message), { status: 400, code: 'VALIDATION_FAILED' }); }
function json<T>(value: T): T { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)); }
