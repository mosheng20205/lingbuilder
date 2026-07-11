import crypto from 'node:crypto';

export interface CloudConfig {
  host: string; port: number; databaseUrl: string; redisUrl: string; adminOrigin: string;
  jwtSecret: string; tokenHashSecret: string; secretVaultKey: Buffer;
  smtpHost: string; smtpPort: number; smtpFrom: string; signupGiftPoints: bigint;
}

let cached: CloudConfig | undefined;
export function getConfig(): CloudConfig {
  if (cached) return cached;
  const required = (name: string, fallback?: string) => {
    const value = process.env[name]?.trim() || fallback;
    if (!value) throw new Error(`缺少环境变量 ${name}。`);
    return value;
  };
  const rawVaultKey = required('SECRET_VAULT_KEY', process.env.NODE_ENV === 'test' ? Buffer.alloc(32, 7).toString('base64') : undefined);
  const secretVaultKey = Buffer.from(rawVaultKey, 'base64');
  if (secretVaultKey.length !== 32) throw new Error('SECRET_VAULT_KEY 必须是 32 字节 Base64 密钥。');
  const tokenHashSecret = required('TOKEN_HASH_SECRET', process.env.NODE_ENV === 'test' ? 'test-token-hash-secret-at-least-32-bytes' : undefined);
  if (Buffer.byteLength(tokenHashSecret) < 32) throw new Error('TOKEN_HASH_SECRET 至少需要 32 字节。');
  cached = {
    host: process.env.CLOUD_API_HOST || '127.0.0.1', port: Number(process.env.CLOUD_API_PORT || 17900),
    databaseUrl: required('DATABASE_URL'), redisUrl: required('REDIS_URL', 'redis://127.0.0.1:6389'),
    adminOrigin: required('ADMIN_ORIGIN', 'http://127.0.0.1:17901'),
    jwtSecret: required('JWT_PRIVATE_KEY', process.env.NODE_ENV === 'test' ? crypto.randomBytes(48).toString('hex') : undefined),
    tokenHashSecret, secretVaultKey,
    smtpHost: required('SMTP_HOST', '127.0.0.1'), smtpPort: Number(process.env.SMTP_PORT || 10259),
    smtpFrom: required('SMTP_FROM', 'LingBuilder <noreply@lingbuilder.local>'),
    signupGiftPoints: BigInt(process.env.SIGNUP_GIFT_POINTS || '10000')
  };
  return cached;
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHmac('sha256', getConfig().tokenHashSecret).update(token).digest('hex');
}
export function randomToken(bytes = 32): string { return crypto.randomBytes(bytes).toString('base64url'); }
