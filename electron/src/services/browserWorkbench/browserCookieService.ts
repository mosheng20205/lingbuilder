import type {
  BrowserCookieDocument,
  BrowserCookiePreview,
  BrowserCookieRecord,
  BrowserCookieTime
} from './types';

export interface BrowserCookiePreviewOptions {
  existing?: readonly BrowserCookieRecord[];
  includeExpired?: boolean;
  overwriteConflicts?: boolean;
  now?: Date;
}

export class BrowserCookieService {
  parseDocument(source: string): BrowserCookieDocument {
    let value: unknown;
    try { value = JSON.parse(source); } catch { throw new Error('Cookie 文件不是合法 UTF-8 JSON。'); }
    if (!value || typeof value !== 'object') throw new Error('Cookie 文件根节点必须是对象。');
    const document = value as Partial<BrowserCookieDocument>;
    if (document.format !== 'lingbuilder.browser.cookies' || document.version !== 1 || !Array.isArray(document.cookies)) {
      throw new Error('Cookie 文件不是兼容的 LingBuilder Cookie JSON。');
    }
    return {
      format: 'lingbuilder.browser.cookies',
      version: 1,
      exportedAt: typeof document.exportedAt === 'string' ? document.exportedAt : '',
      scope: document.scope?.type === 'all'
        ? { type: 'all', url: '' }
        : { type: 'currentSite', url: typeof document.scope?.url === 'string' ? document.scope.url : '' },
      cookies: document.cookies as BrowserCookieRecord[]
    };
  }

  preview(document: BrowserCookieDocument, options: BrowserCookiePreviewOptions = {}): BrowserCookiePreview {
    const now = options.now || new Date();
    const existingKeys = new Set((options.existing || []).filter(isBrowserCookieRecord).map(browserCookieKey));
    const accepted: BrowserCookieRecord[] = [];
    const domains = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;
    let expiredCount = 0;
    let conflictCount = 0;
    for (const cookie of document.cookies) {
      if (!isBrowserCookieRecord(cookie)) { invalidCount += 1; continue; }
      validCount += 1;
      domains.add(cookie.domain);
      const expired = isBrowserCookieExpired(cookie, now);
      const conflict = existingKeys.has(browserCookieKey(cookie));
      if (expired) expiredCount += 1;
      if (conflict) conflictCount += 1;
      if (expired && !options.includeExpired) continue;
      if (conflict && !options.overwriteConflicts) continue;
      accepted.push(structuredClone(cookie));
    }
    return {
      validCount,
      invalidCount,
      expiredCount,
      conflictCount,
      domains: [...domains].sort((left, right) => left.localeCompare(right, 'zh-CN')),
      accepted
    };
  }
}

export function isBrowserCookieRecord(value: unknown): value is BrowserCookieRecord {
  if (!value || typeof value !== 'object') return false;
  const cookie = value as Partial<BrowserCookieRecord>;
  return typeof cookie.name === 'string' && cookie.name.length > 0
    && typeof cookie.value === 'string'
    && typeof cookie.domain === 'string' && cookie.domain.length > 0
    && typeof cookie.path === 'string' && cookie.path.startsWith('/')
    && typeof cookie.httpOnly === 'boolean'
    && typeof cookie.secure === 'boolean'
    && Number.isInteger(cookie.sameSite) && cookie.sameSite! >= 0 && cookie.sameSite! <= 3
    && Number.isInteger(cookie.priority) && cookie.priority! >= 0 && cookie.priority! <= 3
    && typeof cookie.session === 'boolean'
    && (cookie.expires === undefined || cookie.expires === null || isCookieTime(cookie.expires));
}

export function browserCookieKey(cookie: BrowserCookieRecord): string {
  return `${cookie.name}\u0000${cookie.domain.toLowerCase()}\u0000${cookie.path}`;
}

export function isBrowserCookieExpired(cookie: BrowserCookieRecord, now = new Date()): boolean {
  if (cookie.session || cookie.hasExpires === false || !cookie.expires) return false;
  const expires = cookie.expires;
  const timestamp = Date.UTC(
    expires.year,
    expires.month - 1,
    expires.day,
    expires.hour,
    expires.minute,
    expires.second,
    expires.millisecond
  );
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

function isCookieTime(value: unknown): value is BrowserCookieTime {
  if (!value || typeof value !== 'object') return false;
  const time = value as Partial<BrowserCookieTime>;
  return Number.isInteger(time.year) && time.year! >= 1601 && time.year! <= 9999
    && Number.isInteger(time.month) && time.month! >= 1 && time.month! <= 12
    && Number.isInteger(time.day) && time.day! >= 1 && time.day! <= 31
    && Number.isInteger(time.hour) && time.hour! >= 0 && time.hour! <= 23
    && Number.isInteger(time.minute) && time.minute! >= 0 && time.minute! <= 59
    && Number.isInteger(time.second) && time.second! >= 0 && time.second! <= 60
    && Number.isInteger(time.millisecond) && time.millisecond! >= 0 && time.millisecond! <= 999;
}
