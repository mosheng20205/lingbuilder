import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManagedAiBridgeLifecycle, ManagedAiBridgePermission } from './aiBridgeManagerService';

export interface AiBridgeStartSettings {
  port: number;
  permission: ManagedAiBridgePermission;
  lifecycle: ManagedAiBridgeLifecycle;
  /** 自定义 Token；空串表示未设置（每次启动生成临时 Token）。 */
  token: string;
  /** 是否允许本机外部 AI 客户端的 stdio 宿主向 IDE 换取模块授权与浏览器凭据；默认关闭。 */
  externalModuleAccess: boolean;
}

export interface AiBridgeSafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

interface StoredStartSettings {
  version: 1;
  port: number;
  permission: ManagedAiBridgePermission;
  lifecycle: ManagedAiBridgeLifecycle;
  externalModuleAccess?: boolean;
  token?: { encoding: 'safeStorage' | 'plain'; value: string };
}

const PERMISSIONS: readonly ManagedAiBridgePermission[] = ['readonly', 'preview', 'yolo'];
const LIFECYCLE_VALUES: readonly ManagedAiBridgeLifecycle[] = ['workspace', 'ide'];

export function resolveAiBridgeStartSettingsPath(userDataDir: string): string {
  return path.join(userDataDir, 'credentials', 'ai-bridge-start-settings.json');
}

export function normalizeAiBridgeStartSettings(input: unknown): AiBridgeStartSettings | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Record<string, unknown>;
  const port = Number(value.port);
  const permission = String(value.permission || '') as ManagedAiBridgePermission;
  const lifecycle = String(value.lifecycle || '') as ManagedAiBridgeLifecycle;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return undefined;
  if (!PERMISSIONS.includes(permission)) return undefined;
  if (!LIFECYCLE_VALUES.includes(lifecycle)) return undefined;
  const token = typeof value.token === 'string' ? value.token : '';
  if (/[^\x21-\x7e]/u.test(token) || token.length > 256 || (token.length > 0 && token.length < 24)) return undefined;
  return { port, permission, lifecycle, token, externalModuleAccess: value.externalModuleAccess === true };
}

export async function readAiBridgeStartSettings(
  filePath: string,
  safeStorage: AiBridgeSafeStorageLike
): Promise<AiBridgeStartSettings | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredStartSettings;
    if (parsed?.version !== 1) return undefined;
    let token = '';
    if (parsed.token?.value) {
      token = parsed.token.encoding === 'safeStorage' && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(parsed.token.value, 'base64'))
        : parsed.token.encoding === 'plain'
          ? parsed.token.value
          : '';
    }
    return normalizeAiBridgeStartSettings({
      port: parsed.port,
      permission: parsed.permission,
      lifecycle: parsed.lifecycle,
      externalModuleAccess: parsed.externalModuleAccess === true,
      token
    });
  } catch {
    return undefined;
  }
}

export async function writeAiBridgeStartSettings(
  filePath: string,
  settings: AiBridgeStartSettings,
  safeStorage: AiBridgeSafeStorageLike
): Promise<void> {
  const normalized = normalizeAiBridgeStartSettings(settings);
  if (!normalized) throw new Error('AI Bridge 启动设置无效：端口 1-65535、权限与生命周期取内置枚举、Token 需 24-256 个不含空白的 ASCII 字符。');
  let storedToken: StoredStartSettings['token'];
  if (normalized.token) {
    storedToken = safeStorage.isEncryptionAvailable()
      ? { encoding: 'safeStorage', value: safeStorage.encryptString(normalized.token).toString('base64') }
      : { encoding: 'plain', value: normalized.token };
  }
  const stored: StoredStartSettings = {
    version: 1,
    port: normalized.port,
    permission: normalized.permission,
    lifecycle: normalized.lifecycle,
    externalModuleAccess: normalized.externalModuleAccess,
    ...(storedToken ? { token: storedToken } : {})
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(stored, null, 2), 'utf8');
  await fs.rename(temporary, filePath);
}
