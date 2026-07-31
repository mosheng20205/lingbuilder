import crypto from 'node:crypto';

export interface ModuleSigningKeyPair {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  keyId: string;
  persistent: boolean;
}

let cached: ModuleSigningKeyPair | undefined;

export function moduleSigningKeyPair(): ModuleSigningKeyPair {
  if (cached) return cached;
  const privatePem = process.env.MODULE_PERMIT_PRIVATE_KEY_PEM?.replace(/\\n/gu, '\n').trim();
  const publicPem = process.env.MODULE_PERMIT_PUBLIC_KEY_PEM?.replace(/\\n/gu, '\n').trim();
  if (Boolean(privatePem) !== Boolean(publicPem)) throw new Error('MODULE_PERMIT_PRIVATE_KEY_PEM 与 MODULE_PERMIT_PUBLIC_KEY_PEM 必须成对配置。');
  if (process.env.NODE_ENV === 'production' && (!privatePem || !publicPem)) throw new Error('生产环境必须配置稳定的 MODULE_PERMIT_PRIVATE_KEY_PEM 和 MODULE_PERMIT_PUBLIC_KEY_PEM。');
  const pair = privatePem && publicPem
    ? { privateKey: crypto.createPrivateKey(privatePem), publicKey: crypto.createPublicKey(publicPem), persistent: true }
    : { ...crypto.generateKeyPairSync('ed25519'), persistent: false };
  if (pair.privateKey.asymmetricKeyType !== 'ed25519' || pair.publicKey.asymmetricKeyType !== 'ed25519') throw new Error('模块 Permit 密钥必须是 Ed25519。');
  const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  cached = { ...pair, keyId: crypto.createHash('sha256').update(publicDer).digest('hex').slice(0, 16) };
  return cached;
}

export function moduleSigningPublicKey() {
  const pair = moduleSigningKeyPair();
  return { keyId: pair.keyId, algorithm: 'Ed25519' as const, persistent: pair.persistent, publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}

export function artifactSignaturePayload(value: { id: string; moduleId: string; version: string; arch: string; sha256: string; sizeBytes: string }): Buffer {
  return Buffer.from(['lingbuilder-module-artifact-v1', value.id, value.moduleId, value.version, value.arch, value.sha256, value.sizeBytes].join('\n'), 'utf8');
}
