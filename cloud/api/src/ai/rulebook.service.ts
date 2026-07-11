import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RulebookService {
  private cache?: { content: string; version: string };
  async get() {
    if (this.cache) return this.cache;
    const filePath = path.resolve(process.env.LINGBUILDER_RULEBOOK_PATH || path.join(process.cwd(), '..', '..', 'LingBuilder AI 规则手册.md'));
    const content = (await fs.readFile(filePath, 'utf8')).trim();
    if (!content) throw new Error('LingBuilder AI 规则手册为空。');
    this.cache = { content, version: crypto.createHash('sha256').update(content).digest('hex') };
    return this.cache;
  }
}
