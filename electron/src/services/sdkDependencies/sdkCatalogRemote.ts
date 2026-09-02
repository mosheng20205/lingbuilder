import { verify } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { SDK_DEPENDENCY_RESOURCES, type SdkDependencyResource } from './sdkDependencyCatalog';
import type { SdkCatalogTrustAnchor } from './catalogTrustAnchors';

export type { SdkCatalogTrustAnchor };

export const SDK_CATALOG_SIGNATURE_PREFIX = 'lingbuilder-sdk-catalog-v1\n';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_TTL_MS = 600_000;

export interface SdkCatalogManifestEnvelope {
  payload: string;
  keyId: string;
  signature: string;
  publishedAt: string;
}

export interface SdkCatalogState {
  acceptedSequence: number;
}

export interface SdkCatalogMergeResult {
  sequence: number;
  resources: SdkDependencyResource[];
}

export function resolveSdkCatalogEndpoint(environment: NodeJS.ProcessEnv): { url: string } | null {
  const explicit = String(environment.LINGBUILDER_SDK_CATALOG_URL || '').trim();
  if (explicit) return { url: explicit };
  if (String(environment.LINGBUILDER_CLOUD_RELEASE_MODE || '').trim() !== 'online') return null;
  const origin = String(environment.LINGBUILDER_CLOUD_API_URL || '').trim().replace(/\/$/u, '') || 'https://api.lingbuilder.com';
  return { url: `${origin}/v1/site/sdk-catalog` };
}

export async function fetchRemoteCatalog(url: string, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS): Promise<SdkCatalogManifestEnvelope> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } }).catch(reason => {
    throw new Error(`拉取 SDK 清单失败：${reason instanceof Error ? reason.message : String(reason)}`);
  });
  if (!response.ok) throw new Error(`拉取 SDK 清单失败：HTTP ${response.status}。`);
  const value = await response.json().catch(() => { throw new Error('拉取 SDK 清单失败：响应不是合法 JSON。'); }) as { manifest?: unknown } | null;
  const manifest = value?.manifest as Partial<SdkCatalogManifestEnvelope> | undefined;
  if (!manifest || typeof manifest.payload !== 'string' || typeof manifest.keyId !== 'string' || typeof manifest.signature !== 'string') {
    throw new Error('拉取 SDK 清单失败：响应缺少清单信封。');
  }
  return { payload: manifest.payload, keyId: manifest.keyId, signature: manifest.signature, publishedAt: String(manifest.publishedAt ?? '') };
}

export async function readSdkCatalogState(statePath: string): Promise<SdkCatalogState | null> {
  const raw = await fs.readFile(statePath, 'utf8').catch(() => null);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { acceptedSequence?: unknown };
    const sequence = parsed.acceptedSequence;
    if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence <= 0) return null;
    return { acceptedSequence: sequence };
  } catch {
    return null;
  }
}

export async function writeSdkCatalogState(statePath: string, acceptedSequence: number): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify({ schemaVersion: 1, acceptedSequence, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function compareCatalogAnchoredFields(builtin: readonly SdkDependencyResource[], remote: readonly Record<string, unknown>[]): string[] {
  const issues: string[] = [];
  const remoteIds = remote.map(item => item?.id);
  for (const resource of builtin) {
    if (!remoteIds.includes(resource.id)) {
      issues.push(`资源 ${resource.id}：线上清单缺少该内置资源（锚定字段必须逐字回显）。`);
      continue;
    }
    const item = remote.find(entry => entry?.id === resource.id)!;
    if (item.moduleId !== resource.moduleId) {
      issues.push(`资源 ${resource.id} 锚定漂移：模块 ID ${String(item.moduleId)} != 内置 ${resource.moduleId}。`);
    }
    if (item.name !== resource.name) {
      issues.push(`资源 ${resource.id} 锚定漂移：名称 ${String(item.name)} != 内置 ${resource.name}。`);
    }
    if (item.platform !== resource.platform) {
      issues.push(`资源 ${resource.id} 锚定漂移：平台 ${String(item.platform)} != 内置 ${resource.platform}。`);
    }
    if (JSON.stringify(item.requiredModuleIds) !== JSON.stringify(resource.requiredModuleIds)) {
      issues.push(`资源 ${resource.id} 锚定漂移：依赖模块 ${JSON.stringify(item.requiredModuleIds)} != 内置 ${JSON.stringify(resource.requiredModuleIds)}。`);
    }
    if (JSON.stringify(item.criticalFiles) !== JSON.stringify(resource.criticalFiles.map(file => file.relativePath))) {
      issues.push(`资源 ${resource.id} 锚定漂移：关键文件清单 ${JSON.stringify(item.criticalFiles)} 与内置不一致。`);
    }
  }
  for (const id of remoteIds) {
    if (!builtin.some(builtinItem => builtinItem.id === id)) {
      issues.push(`资源 ${String(id)}：线上清单包含 IDE 内置清单不存在的多余资源（锚定字段必须逐字回显）。`);
    }
  }
  return issues;
}

export function verifyAndMergeCatalog(
  builtin: readonly SdkDependencyResource[],
  manifest: SdkCatalogManifestEnvelope,
  anchors: readonly SdkCatalogTrustAnchor[],
  state: SdkCatalogState
): SdkCatalogMergeResult {
  if (!anchors.length) throw new Error('未配置 SDK 清单信任锚，拒绝使用远端清单。');
  const anchor = anchors.find(item => item.keyId === manifest.keyId);
  if (!anchor) throw new Error(`SDK 清单 keyId ${manifest.keyId} 与内置信任锚不匹配，拒绝使用远端清单。`);
  const signatureInput = Buffer.from(`${SDK_CATALOG_SIGNATURE_PREFIX}${manifest.payload}`, 'utf8');
  const signature = Buffer.from(manifest.signature, 'base64');
  let signatureValid = false;
  try {
    signatureValid = verify(null, signatureInput, anchor.publicKeyPem, signature);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) throw new Error('SDK 清单签名验证失败，拒绝使用远端清单。');

  let payload: { schemaVersion?: unknown; sequence?: unknown; resources?: unknown };
  try {
    payload = JSON.parse(manifest.payload);
  } catch {
    throw new Error('SDK 清单 payload 不是合法 JSON。');
  }
  if (payload.schemaVersion !== 1) throw new Error(`SDK 清单 schemaVersion 不支持：${String(payload.schemaVersion)}。`);
  if (!isPositiveInteger(payload.sequence)) throw new Error('SDK 清单 sequence 必须是正整数。');
  if (payload.sequence < state.acceptedSequence) {
    throw new Error(`SDK 清单 sequence ${payload.sequence} 低于已接受的 ${state.acceptedSequence}，疑似回滚，已整条拒绝。`);
  }
  if (!Array.isArray(payload.resources)) throw new Error('SDK 清单 resources 必须是数组。');
  const resourceList = payload.resources as Record<string, unknown>[];

  const builtinIds = builtin.map(item => item.id);
  const remoteIds = resourceList.map(item => item?.id);
  for (const id of builtinIds) {
    if (!remoteIds.includes(id)) throw new Error(`SDK 清单资源 ID 集合与内置清单不一致：缺少 ${id}，整条拒绝。`);
  }
  for (const id of remoteIds) {
    if (!builtinIds.includes(id as SdkDependencyResource['id'])) {
      throw new Error(`SDK 清单资源 ID 集合与内置清单不一致：包含未知资源 ${String(id)}，整条拒绝。`);
    }
  }

  const merged = builtin.map(resource => {
    const remote = resourceList.find(item => item?.id === resource.id);
    if (!remote) throw new Error(`SDK 清单资源 ID 集合与内置清单不一致：缺少 ${resource.id}，整条拒绝。`);
    const anchoredFields: Array<[string, string]> = [
      ['模块 ID', String(remote.moduleId) === resource.moduleId ? '' : `${String(remote.moduleId)} != ${resource.moduleId}`],
      ['名称', remote.name === resource.name ? '' : `${String(remote.name)} != ${resource.name}`],
      ['平台', remote.platform === resource.platform ? '' : `${String(remote.platform)} != ${resource.platform}`],
      ['依赖模块', JSON.stringify(remote.requiredModuleIds) === JSON.stringify(resource.requiredModuleIds) ? '' : `${JSON.stringify(remote.requiredModuleIds)} != ${JSON.stringify(resource.requiredModuleIds)}`],
      ['关键文件', JSON.stringify(remote.criticalFiles) === JSON.stringify(resource.criticalFiles.map(file => file.relativePath)) ? '' : `${JSON.stringify(remote.criticalFiles)} != 内置关键文件清单`]
    ];
    const drifted = anchoredFields.filter(([, difference]) => difference).map(([label, difference]) => `${label}（${difference}）`);
    if (drifted.length) {
      throw new Error(`SDK 清单资源 ${resource.id} 的锚定字段与内置清单不一致：${drifted.join('；')}。远端清单只能更新版本与下载信息。`);
    }
    if (typeof remote.version !== 'string' || !remote.version.trim()) throw new Error(`SDK 清单资源 ${resource.id} 的 version 必须是非空字符串。`);
    if (typeof remote.sdkVersion !== 'string' || !remote.sdkVersion.trim()) throw new Error(`SDK 清单资源 ${resource.id} 的 sdkVersion 必须是非空字符串。`);
    if (typeof remote.archiveName !== 'string' || !remote.archiveName.trim()) throw new Error(`SDK 清单资源 ${resource.id} 的 archiveName 必须是非空字符串。`);
    if (typeof remote.downloadUrl !== 'string' || !/^https:\/\//iu.test(remote.downloadUrl)) {
      throw new Error(`SDK 清单资源 ${resource.id} 的下载地址必须是 HTTPS 地址。`);
    }
    if (typeof remote.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(remote.sha256)) {
      throw new Error(`SDK 清单资源 ${resource.id} 的 SHA-256 必须是 64 位小写十六进制字符串。`);
    }
    for (const field of ['archiveBytes', 'fileCount', 'expandedBytes'] as const) {
      const value = remote[field];
      if (!isPositiveInteger(value)) {
        throw new Error(`SDK 清单资源 ${resource.id} 的 ${field} 必须是正整数。`);
      }
      remote[field] = value;
    }
    return {
      ...resource,
      version: remote.version as string,
      sdkVersion: remote.sdkVersion as string,
      archiveName: remote.archiveName as string,
      downloadUrl: remote.downloadUrl as string,
      archiveBytes: remote.archiveBytes as number,
      sha256: remote.sha256 as string,
      fileCount: remote.fileCount as number,
      expandedBytes: remote.expandedBytes as number
    } satisfies SdkDependencyResource;
  });

  return { sequence: payload.sequence, resources: merged };
}
