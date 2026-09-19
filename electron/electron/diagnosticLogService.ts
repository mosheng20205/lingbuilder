import fs from 'node:fs';
import path from 'node:path';

export type DiagnosticLogLevel = 'info' | 'warn' | 'error';

const LOG_FILE_PREFIX = 'diagnostic-';
const LOG_FILE_SUFFIX = '.log';
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const RETENTION_DAYS = 7;
const MAX_MESSAGE_CHARS = 1000;

const timestamp = (value: Date) => {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
};

const dateKey = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

/**
 * 黑屏取证用本地诊断日志：按日滚动写入 userData/logs，只记录生命周期事件与错误，
 * 不保存用户代码内容。用户机器上复现不了的黑屏靠这份日志回传分析。
 */
export class DiagnosticLogService {
  private readonly logsDir: string;
  private sizeLimitReachedLogged = false;

  constructor(logsDir: string) {
    this.logsDir = logsDir;
    fs.mkdirSync(this.logsDir, { recursive: true });
    this.cleanupExpiredLogs();
  }

  getLogDirectory(): string {
    return this.logsDir;
  }

  private currentLogFile(): string {
    return path.join(this.logsDir, `${LOG_FILE_PREFIX}${dateKey(new Date())}${LOG_FILE_SUFFIX}`);
  }

  append(level: DiagnosticLogLevel, category: string, message: string): void {
    try {
      const file = this.currentLogFile();
      let size = 0;
      try {
        size = fs.statSync(file).size;
      } catch {
        size = 0;
      }
      if (size >= MAX_LOG_FILE_BYTES) {
        if (!this.sizeLimitReachedLogged) {
          this.sizeLimitReachedLogged = true;
          fs.appendFileSync(file, `${timestamp(new Date())} [warn ] [diagnostic-log] 当日日志已达 5MB 上限，后续条目暂停写入；可通过「帮助 → 删除本地日志」清理。\n`, 'utf-8');
        }
        return;
      }
      this.sizeLimitReachedLogged = false;
      const safeMessage = String(message || '').replace(/\r?\n/g, ' ⏎ ').slice(0, MAX_MESSAGE_CHARS);
      fs.appendFileSync(file, `${timestamp(new Date())} [${level.padEnd(5)}] [${category}] ${safeMessage}\n`, 'utf-8');
    } catch {
      // 诊断日志本身不得把主进程带崩。
    }
  }

  info(category: string, message: string): void { this.append('info', category, message); }
  warn(category: string, message: string): void { this.append('warn', category, message); }
  error(category: string, message: string): void { this.append('error', category, message); }

  listLogFiles(): string[] {
    try {
      return fs.readdirSync(this.logsDir)
        .filter(name => name.startsWith(LOG_FILE_PREFIX) && name.endsWith(LOG_FILE_SUFFIX))
        .sort()
        .map(name => path.join(this.logsDir, name));
    } catch {
      return [];
    }
  }

  /** 把近 7 天日志合并导出为单个文件，方便用户发给开发者。targetPath 由调用方经保存对话框确定。 */
  exportBundle(targetPath: string): void {
    const chunks: string[] = [];
    for (const file of this.listLogFiles()) {
      try {
        chunks.push(`===== ${path.basename(file)} =====\n${fs.readFileSync(file, 'utf-8')}`);
      } catch {
        chunks.push(`===== ${path.basename(file)} =====\n（读取失败）\n`);
      }
    }
    if (chunks.length === 0) chunks.push('（暂无诊断日志）\n');
    fs.writeFileSync(targetPath, chunks.join('\n'), 'utf-8');
  }

  deleteAllLogs(): number {
    let deleted = 0;
    for (const file of this.listLogFiles()) {
      try {
        fs.rmSync(file, { force: true });
        deleted += 1;
      } catch {
        // 文件被占用时跳过即可，不阻断交互。
      }
    }
    return deleted;
  }

  private cleanupExpiredLogs(): void {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.logsDir).filter(name => name.startsWith(LOG_FILE_PREFIX) && name.endsWith(LOG_FILE_SUFFIX));
    } catch {
      return;
    }
    for (const name of files) {
      const matched = /^diagnostic-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
      if (!matched) continue;
      const fileDay = new Date(`${matched[1]}T23:59:59`).getTime();
      if (Number.isNaN(fileDay) || fileDay >= cutoff) continue;
      try {
        fs.rmSync(path.join(this.logsDir, name), { force: true });
      } catch {
        // 忽略清理失败。
      }
    }
  }
}
