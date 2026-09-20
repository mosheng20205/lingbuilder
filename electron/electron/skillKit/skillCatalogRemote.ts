import { createHash, verify } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { SkillCatalogTrustAnchor } from './skillCatalogTrustAnchors';

/**
 * 灵码 Skill 清单的远端消费：验签、防回滚、锚定字段比对与文件下载。
 *
 * 铁律：任何一步失败都必须整条拒绝并回退安装包内置快照，禁止部分采纳；
 * 锚定字段（id / entrypoint）与包内快照不一致时，说明线上发的已经不是一个包。
 */
export const SKILL_CATALOG_SIGNATURE_PREFIX = 'lingbuilder-skill-catalog-v1\n';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export interface SkillCatalogManifestEnvelope {
  payload: string;
  keyId: string;
  signature: string;
  publishedAt: string;
}

export interface SkillCatalogFile {
  path: string;
  bytes: number;
  sha256: string;
  downloadUrl: string;
}

export interface SkillCatalogRelease {
  id: string;
  version: string;
  entrypoint: string;
  minIdeVersion: string;
  installPromptTemplate: string;
  files: SkillCatalogFile[];
}

/** 安装包内置快照的 manifest.json（离线兜底，也是锚定比对的基准）。 */
export interface SkillKitBundledManifest {
  schemaVersion: number;
  id: string;
  version: string;
  sequence: number;
  entrypoint: string;
  installPromptTemplate: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
}

export interface SkillCatalogVerifyInput {
  manifest: SkillCatalogManifestEnvelope;
  bundled: SkillKitBundledManifest;
  anchors: readonly SkillCatalogTrustAnchor[];
  acceptedSequence: number;
  ideVersion: string;
}

export interface SkillCatalogFetch {
  (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }): Promise<Response>;
}

function fail(message: string): never { throw new Error(message); }

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function resolveSkillCatalogEndpoint(environment: NodeJS.ProcessEnv = process.env): { url: string } | null {
  const explicit = String(environment.LINGBUILDER_SKILL_CATALOG_URL || '').trim();
  if (explicit) return { url: explicit };
  if (String(environment.LINGBUILDER_CLOUD_RELEASE_MODE || '').trim() !== 'online') return null;
  const origin = String(environment.LINGBUILDER_CLOUD_API_URL || '').trim().replace(/\/$/u, '') || 'https://api.lingbuilder.com';
  return { url: `${origin}/v1/site/skill-catalog` };
}

export function compareSemver(left: string, right: string): number {
  const parse = (value: string) => value.split('.').map(part => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) < (b[index] ?? 0) ? -1 : 1;
  }
  return 0;
}

export async function fetchRemoteSkillCatalog(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, fetcher: SkillCatalogFetch = fetch): Promise<SkillCatalogManifestEnvelope> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } }).catch(reason => {
    fail(`拉取灵码 Skill 清单失败：${reason instanceof Error ? reason.message : String(reason)}`);
  });
  if (!response.ok) fail(`拉取灵码 Skill 清单失败：HTTP ${response.status}。`);
  const value = await response.json().catch(() => { fail('拉取灵码 Skill 清单失败：响应不是合法 JSON。'); }) as { manifest?: unknown } | null;
  const manifest = value?.manifest as Partial<SkillCatalogManifestEnvelope> | undefined;
  if (!manifest || typeof manifest.payload !== 'string' || typeof manifest.keyId !== 'string' || typeof manifest.signature !== 'string') {
    fail('拉取灵码 Skill 清单失败：响应缺少清单信封。');
  }
  return { payload: manifest.payload, keyId: manifest.keyId, signature: manifest.signature, publishedAt: String(manifest.publishedAt ?? '') };
}

export async function readSkillCatalogState(statePath: string): Promise<number> {
  const raw = await fs.readFile(statePath, 'utf8').catch(() => null);
  if (raw === null) return 0;
  try {
    const parsed = JSON.parse(raw) as { acceptedSequence?: unknown };
    return isPositiveInteger(parsed.acceptedSequence) ? parsed.acceptedSequence : 0;
  } catch {
    return 0;
  }
}

export async function writeSkillCatalogState(statePath: string, acceptedSequence: number): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify({ schemaVersion: 1, acceptedSequence, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

export function verifySkillCatalogManifest(input: SkillCatalogVerifyInput): { sequence: number; release: SkillCatalogRelease } {
  const { manifest, bundled, anchors, acceptedSequence, ideVersion } = input;
  if (!anchors.length) fail('未配置灵码 Skill 清单信任锚，拒绝使用远端清单。');
  const anchor = anchors.find(item => item.keyId === manifest.keyId);
  if (!anchor) fail(`灵码 Skill 清单 keyId ${manifest.keyId} 不在内置信任锚内，拒绝使用远端清单（云端可能已轮换密钥，请升级 IDE）。`);
  let signatureValid = false;
  try {
    signatureValid = verify(null, Buffer.from(`${SKILL_CATALOG_SIGNATURE_PREFIX}${manifest.payload}`, 'utf8'), anchor.publicKeyPem, Buffer.from(manifest.signature, 'base64'));
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) fail('灵码 Skill 清单签名验证失败，拒绝使用远端清单。');

  let payload: { schemaVersion?: unknown; sequence?: unknown; release?: unknown };
  try {
    payload = JSON.parse(manifest.payload) as typeof payload;
  } catch {
    fail('灵码 Skill 清单 payload 不是合法 JSON。');
  }
  if (payload.schemaVersion !== 1) fail(`灵码 Skill 清单 schemaVersion 不支持：${String(payload.schemaVersion)}。`);
  if (!isPositiveInteger(payload.sequence)) fail('灵码 Skill 清单 sequence 必须是正整数。');
  if (payload.sequence < acceptedSequence) fail(`灵码 Skill 清单 sequence ${payload.sequence} 低于已接受的 ${acceptedSequence}，疑似回滚，已整条拒绝。`);
  if (payload.sequence < bundled.sequence) fail(`灵码 Skill 清单 sequence ${payload.sequence} 低于安装包内置快照的 ${bundled.sequence}，拒绝降级到旧正文。`);

  const release = payload.release as Partial<SkillCatalogRelease> | undefined;
  if (!release || typeof release !== 'object') fail('灵码 Skill 清单缺少 release 对象。');
  if (release.id !== bundled.id) fail(`灵码 Skill 清单锚定漂移：包 ID ${String(release.id)} != 内置 ${bundled.id}，线上发的不是同一个包。`);
  if (release.entrypoint !== bundled.entrypoint) fail(`灵码 Skill 清单锚定漂移：入口文件 ${String(release.entrypoint)} != 内置 ${bundled.entrypoint}。`);
  const version = typeof release.version === 'string' ? release.version.trim() : '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('灵码 Skill 清单 version 必须是 x.y.z 语义版本。');
  const minIdeVersion = typeof release.minIdeVersion === 'string' ? release.minIdeVersion.trim() : '';
  if (minIdeVersion && !/^\d+\.\d+\.\d+$/.test(minIdeVersion)) fail('灵码 Skill 清单 minIdeVersion 必须是 x.y.z 语义版本或留空。');
  if (minIdeVersion && ideVersion && compareSemver(ideVersion, minIdeVersion) < 0) {
    fail(`灵码 Skill 清单要求 IDE 不低于 ${minIdeVersion}，当前 ${ideVersion}，已整条拒绝并回退内置快照。`);
  }
  const template = typeof release.installPromptTemplate === 'string' ? release.installPromptTemplate : '';
  if (!template.includes('{skillPath}')) fail('灵码 Skill 清单的复制指令模板缺少 {skillPath} 占位符。');
  if (!Array.isArray(release.files) || !release.files.length) fail('灵码 Skill 清单 files 必须是非空数组。');
  if (release.files.length > 20) fail('灵码 Skill 清单 files 条目超限（最多 20 项）。');

  const bundledPaths = new Set(bundled.files.map(file => file.path));
  const seen = new Set<string>();
  let total = 0;
  const files = (release.files as SkillCatalogFile[]).map((file, index) => {
    const filePath = typeof file?.path === 'string' ? file.path.trim() : '';
    if (!filePath || filePath.startsWith('/') || filePath.includes('\\') || /^[a-z]:/iu.test(filePath)
      || filePath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
      fail(`灵码 Skill 清单第 ${index + 1} 个文件路径必须是相对路径（如 SKILL.md）。`);
    }
    if (seen.has(filePath)) fail(`灵码 Skill 清单文件路径重复：${filePath}。`);
    seen.add(filePath);
    if (!bundledPaths.has(filePath)) fail(`灵码 Skill 清单包含内置快照不存在的文件 ${filePath}，已整条拒绝。`);
    if (!isPositiveInteger(file?.bytes) || file.bytes > MAX_FILE_BYTES) fail(`文件 ${filePath} 的字节数必须是 1 至 ${MAX_FILE_BYTES} 的整数。`);
    if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(file.sha256)) fail(`文件 ${filePath} 的 SHA-256 必须是 64 位小写十六进制字符串。`);
    if (typeof file.downloadUrl !== 'string' || !/^https:\/\//iu.test(file.downloadUrl)) fail(`文件 ${filePath} 的下载地址必须是 HTTPS 地址。`);
    total += file.bytes;
    return { path: filePath, bytes: file.bytes, sha256: file.sha256, downloadUrl: file.downloadUrl };
  });
  if (total > MAX_TOTAL_BYTES) fail(`灵码 Skill 清单文件合计字节数超过上限 ${MAX_TOTAL_BYTES}。`);
  if (!files.some(file => file.path === bundled.entrypoint)) fail(`灵码 Skill 清单缺少入口文件 ${bundled.entrypoint}。`);

  return { sequence: payload.sequence, release: { id: bundled.id, version, entrypoint: bundled.entrypoint, minIdeVersion, installPromptTemplate: template, files } };
}

/** 下载并逐文件校验 SHA-256 与字节数；全部成功后才落盘，避免半套正文进缓存。 */
export async function downloadSkillKitFiles(release: SkillCatalogRelease, targetDir: string, fetcher: SkillCatalogFetch = fetch, timeoutMs = 30_000): Promise<string[]> {
  const buffers: Array<{ file: SkillCatalogFile; data: Buffer }> = [];
  for (const file of release.files) {
    const response = await fetcher(file.downloadUrl, { signal: AbortSignal.timeout(timeoutMs) }).catch(reason => {
      fail(`下载 Skill 文件 ${file.path} 失败：${reason instanceof Error ? reason.message : String(reason)}`);
    });
    if (!response.ok) fail(`下载 Skill 文件 ${file.path} 失败：HTTP ${response.status}。`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== file.bytes) fail(`Skill 文件 ${file.path} 字节数不符：实际 ${data.length}，清单 ${file.bytes}。`);
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== file.sha256) fail(`Skill 文件 ${file.path} SHA-256 与清单不一致（实际 ${digest}）。`);
    buffers.push({ file, data });
  }
  const written: string[] = [];
  for (const { file, data } of buffers) {
    const destination = path.join(targetDir, ...file.path.split('/'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, destination);
    written.push(destination);
  }
  return written;
}
