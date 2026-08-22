import crypto from 'node:crypto';

export interface CloudConfig {
  host: string; port: number; databaseUrl: string; redisUrl: string; adminOrigin: string;
  corsOrigins: string[];
  jwtSecret: string; tokenHashSecret: string; secretVaultKey: Buffer;
  smtpHost: string; smtpPort: number; smtpFrom: string; smtpUser: string; smtpPassword: string; smtpSecure: boolean; signupGiftPoints: bigint;
}

let cached: CloudConfig | undefined;
export function getConfig(): CloudConfig {
  if (cached) return cached;
  const required = (name: string, fallback?: string) => {
    const value = process.env[name]?.trim() || fallback;
    if (!value) throw new Error(`缺少环境变量 ${name}。`);
    return value;
  };
  const production = process.env.NODE_ENV === 'production';
  const isPlaceholder = (value: string) => /(?:CHANGE_ME|GENERATE_|REPLACE_|replace-with|placeholder|development|example\.com|localhost|127\.0\.0\.1)/iu.test(value);
  const rawVaultKey = required('SECRET_VAULT_KEY', process.env.NODE_ENV === 'test' ? Buffer.alloc(32, 7).toString('base64') : undefined);
  const secretVaultKey = Buffer.from(rawVaultKey, 'base64');
  if (secretVaultKey.length !== 32) throw new Error('SECRET_VAULT_KEY 必须是 32 字节 Base64 密钥。');
  const tokenHashSecret = required('TOKEN_HASH_SECRET', process.env.NODE_ENV === 'test' ? 'test-token-hash-secret-at-least-32-bytes' : undefined);
  if (Buffer.byteLength(tokenHashSecret) < 32) throw new Error('TOKEN_HASH_SECRET 至少需要 32 字节。');
  const adminOrigin = required('ADMIN_ORIGIN', production ? undefined : 'http://127.0.0.1:17901');
  const corsOrigins = Array.from(new Set((process.env.CORS_ORIGINS || adminOrigin).split(',').map(value => value.trim()).filter(Boolean)));
  if (production && corsOrigins.some(origin => !origin.startsWith('https://'))) throw new Error('生产环境 CORS_ORIGINS 和 ADMIN_ORIGIN 必须使用 HTTPS。');
  const smtpHost = required('SMTP_HOST', production ? undefined : '127.0.0.1');
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPassword = process.env.SMTP_PASSWORD || '';
  const smtpSecure = String(process.env.SMTP_SECURE || (production ? 'true' : 'false')).toLowerCase() === 'true';
  if (production && (!smtpUser || !smtpPassword || isPlaceholder(smtpHost) || isPlaceholder(smtpUser) || isPlaceholder(smtpPassword))) throw new Error('生产环境必须配置真实 SMTP_HOST、SMTP_USER 和 SMTP_PASSWORD。');
  const jwtSecret = required('JWT_PRIVATE_KEY', process.env.NODE_ENV === 'test' ? crypto.randomBytes(48).toString('hex') : undefined);
  if (production && isPlaceholder(jwtSecret)) throw new Error('生产环境禁止使用占位 JWT_PRIVATE_KEY。');
  if (production && isPlaceholder(tokenHashSecret)) throw new Error('生产环境禁止使用占位 TOKEN_HASH_SECRET。');
  cached = {
    host: process.env.CLOUD_API_HOST || '127.0.0.1', port: Number(process.env.CLOUD_API_PORT || 17900),
    databaseUrl: required('DATABASE_URL'), redisUrl: required('REDIS_URL', 'redis://127.0.0.1:6389'),
    adminOrigin, corsOrigins,
    jwtSecret,
    tokenHashSecret, secretVaultKey,
    smtpHost, smtpPort: Number(process.env.SMTP_PORT || (production ? 587 : 10259)), smtpUser, smtpPassword, smtpSecure,
    smtpFrom: required('SMTP_FROM', 'LingBuilder <noreply@lingbuilder.local>'),
    signupGiftPoints: BigInt(process.env.SIGNUP_GIFT_POINTS || '10000')
  };
  return cached;
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHmac('sha256', getConfig().tokenHashSecret).update(token).digest('hex');
}
export function randomToken(bytes = 32): string { return crypto.randomBytes(bytes).toString('base64url'); }

/**
 * 管理后台直链上传集成配置（R2 上传 Worker）。
 * 可选集成，不接入 getConfig() 缓存：两个变量都配置后功能才开启，便于测试与运行时行为一致。
 * R2_UPLOAD_TOKEN 必须与 Worker 侧 `wrangler secret put R2_UPLOAD_TOKEN` 的值保持一致。
 */
export function readR2UploadConfig(): { endpoint: string; token: string } {
  return {
    endpoint: (process.env.R2_UPLOAD_WORKER_URL || '').trim().replace(/\/+$/, ''),
    token: (process.env.R2_UPLOAD_TOKEN || '').trim(),
  };
}
