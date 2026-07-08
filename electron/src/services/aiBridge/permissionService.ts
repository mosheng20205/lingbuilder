import fs from 'fs/promises';
import path from 'path';
import { AiBridgePermissionMode } from './types';

export type AiBridgeOperation = 'read' | 'write' | 'execute';

export class AiBridgePermissionService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly mode: AiBridgePermissionMode
  ) {}

  getMode(): AiBridgePermissionMode {
    return this.mode;
  }

  canRead(): boolean {
    return true;
  }

  canWrite(approved?: boolean): boolean {
    if (this.mode === 'readonly') return false;
    if (this.mode === 'yolo') return true;
    return approved === true;
  }

  canExecute(approved?: boolean): boolean {
    if (this.mode === 'readonly') return false;
    if (this.mode === 'yolo') return true;
    return approved === true;
  }

  requireWrite(approved?: boolean): void {
    if (!this.canWrite(approved)) {
      throw new Error(this.mode === 'readonly'
        ? '当前 AI Bridge 为只读模式，禁止写入文件。'
        : '当前 AI Bridge 为预览确认模式，写入前必须传入 approved=true。');
    }
  }

  requireExecute(approved?: boolean): void {
    if (!this.canExecute(approved)) {
      throw new Error(this.mode === 'readonly'
        ? '当前 AI Bridge 为只读模式，禁止执行构建或运行。'
        : '当前 AI Bridge 为预览确认模式，执行前必须传入 approved=true。');
    }
  }

  async audit(event: {
    operation: AiBridgeOperation;
    action: string;
    ok: boolean;
    target?: string;
    details?: unknown;
  }): Promise<void> {
    const logDir = path.join(this.workspaceRoot, '.lingbuilder');
    const logPath = path.join(logDir, 'ai-bridge-log.jsonl');
    const payload = {
      at: new Date().toISOString(),
      permission: this.mode,
      ...event
    };
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
  }
}
