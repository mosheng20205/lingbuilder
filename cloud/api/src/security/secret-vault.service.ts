import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { getConfig } from '../config.js';

@Injectable()
export class SecretVaultService {
  encrypt(value: string): string {
    const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', getConfig().secretVaultKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }
  decrypt(payload: string): string {
    const [version, iv, tag, value] = payload.split('.');
    if (version !== 'v1' || !iv || !tag || !value) throw new Error('供应商密钥格式无效。');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getConfig().secretVaultKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(value, 'base64url')), decipher.final()]).toString('utf8');
  }
}
