export interface SkillCatalogFile {
  path: string;
  bytes: number;
  sha256: string;
  downloadUrl: string;
}

export interface SkillCatalogRelease {
  id: string;
  version: string;
  entrypoint: string;
  minIdeVersion: string;
  installPromptTemplate: string;
  files: SkillCatalogFile[];
}

/** 锚定字段改了等于换了一个包，客户端会整条拒绝并回退包内快照。 */
export const SKILL_ANCHORED_FIELDS = ['id', 'entrypoint'] as const;
/** 可更新字段是日常维护面：版本、正文文件与复制指令文案。 */
export const SKILL_UPDATABLE_FIELDS = ['version', 'minIdeVersion', 'installPromptTemplate', 'files'] as const;

export interface SkillFieldChange { field: string; from: string; to: string }
export interface SkillReleaseDiff { kind: 'same-package' | 'new-package'; changes: SkillFieldChange[]; anchoredChanged: string[] }

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function invalid(message: string): never { throw new Error(message); }

function relativePath(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) invalid(`${label}不能为空。`);
  if (text.startsWith('/') || text.includes('\\') || /^[a-z]:/iu.test(text)) invalid(`${label}必须是相对路径（如 SKILL.md），不能包含盘符、反斜杠或以 / 开头。`);
  if (text.split('/').some(segment => !segment || segment === '.' || segment === '..')) invalid(`${label}不能包含空的或 . / .. 路径段。`);
  return text;
}

/** 后台编辑用的宽松解析：接受裸对象或 {release} 包装，错误一律中文。 */
export function parseSkillReleaseJson(text: string): SkillCatalogRelease {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { invalid('内容不是合法 JSON。'); }
  const record = ((parsed as { release?: unknown } | null)?.release ?? parsed) as Record<string, unknown> | null;
  if (!record || typeof record !== 'object' || Array.isArray(record)) invalid('需要 Skill 清单对象，或包含 release 字段的对象。');

  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(id)) invalid('Skill 包 ID 必须小写字母或数字开头，长度 3-81，可含点、下划线、中划线。');
  const version = typeof record.version === 'string' ? record.version.trim() : '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) invalid('Skill 包版本必须是 x.y.z 语义版本。');
  const minIdeVersion = typeof record.minIdeVersion === 'string' ? record.minIdeVersion.trim() : '';
  if (minIdeVersion && !/^\d+\.\d+\.\d+$/.test(minIdeVersion)) invalid('最低 IDE 版本必须是 x.y.z 语义版本或留空。');
  const entrypoint = relativePath(record.entrypoint, '入口文件');
  const installPromptTemplate = typeof record.installPromptTemplate === 'string' ? record.installPromptTemplate.trim() : '';
  if (!installPromptTemplate) invalid('一键复制指令模板不能为空。');
  if (!installPromptTemplate.includes('{skillPath}')) invalid('一键复制指令模板必须包含 {skillPath} 占位符。');
  if (!Array.isArray(record.files) || !record.files.length) invalid('文件清单不能为空。');
  if (record.files.length > 20) invalid('文件清单数量超限（最多 20 项）。');

  const seen = new Set<string>();
  let total = 0;
  const files = record.files.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid(`第 ${index + 1} 个文件条目必须是对象。`);
    const entry = item as Record<string, unknown>;
    const path = relativePath(entry.path, `第 ${index + 1} 个文件的路径`);
    if (seen.has(path)) invalid(`文件路径重复：${path}。`);
    seen.add(path);
    const bytes = entry.bytes;
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_FILE_BYTES) {
      invalid(`文件 ${path} 的字节数必须是 1 至 ${MAX_FILE_BYTES} 的整数。`);
    }
    const sha256 = typeof entry.sha256 === 'string' ? entry.sha256.trim() : '';
    if (!/^[0-9a-f]{64}$/u.test(sha256)) invalid(`文件 ${path} 的 SHA-256 必须是 64 位小写十六进制字符串。`);
    const downloadUrl = typeof entry.downloadUrl === 'string' ? entry.downloadUrl.trim() : '';
    let url: URL | undefined;
    try { url = new URL(downloadUrl); } catch { url = undefined; }
    if (!url || url.protocol !== 'https:') invalid(`文件 ${path} 的下载地址必须是 HTTPS 地址。`);
    total += bytes;
    return { path, bytes, sha256, downloadUrl: url.toString() };
  });
  if (total > MAX_TOTAL_BYTES) invalid(`文件清单合计字节数超过上限 ${MAX_TOTAL_BYTES}。`);
  if (!files.some(file => file.path === entrypoint)) invalid(`入口文件 ${entrypoint} 必须出现在文件清单里。`);

  return { id, version, entrypoint, minIdeVersion, installPromptTemplate, files };
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '（缺失）';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function buildSkillReleaseDiff(previous: SkillCatalogRelease | null, next: SkillCatalogRelease): SkillReleaseDiff {
  if (!previous) return { kind: 'new-package', changes: [], anchoredChanged: [] };
  const changes = SKILL_UPDATABLE_FIELDS
    .filter(field => display(previous[field]) !== display(next[field]))
    .map(field => ({ field, from: display(previous[field]), to: display(next[field]) }));
  const anchoredChanged = SKILL_ANCHORED_FIELDS.filter(field => display(previous[field]) !== display(next[field]));
  return { kind: 'same-package', changes, anchoredChanged };
}
