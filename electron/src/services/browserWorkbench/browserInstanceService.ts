import {
  BROWSER_EXTENSION_DIRECTORY,
  BROWSER_WORKSPACE_SCHEMA_VERSION,
  BROWSER_WORKSPACE_TYPE,
  type BrowserInstanceModel,
  type BrowserWorkspaceDocument
} from './types';

const INSTANCE_ID_PATTERN = /^browser-[a-z0-9]{6,48}$/u;
const HTTP_URL_PATTERN = /^https?:\/\//iu;

export interface CreateBrowserInstanceOptions {
  id?: string;
  name?: string;
  lastUrl?: string;
  createdAt?: string;
  restoreOpen?: boolean;
}

export interface BrowserInstanceServiceOptions {
  idFactory?: () => string;
  now?: () => Date;
  createDefault?: boolean;
}

export class BrowserInstanceService {
  private instances: BrowserInstanceModel[] = [];
  private selectedInstanceId = '';
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(document?: BrowserWorkspaceDocument, options: BrowserInstanceServiceOptions = {}) {
    this.idFactory = options.idFactory || generateStableBrowserInstanceId;
    this.now = options.now || (() => new Date());
    if (document) this.restore(document);
    else if (options.createDefault !== false) this.create({ name: '浏览器 1' });
  }

  list(): readonly BrowserInstanceModel[] {
    return this.instances.map(instance => ({ ...instance }));
  }

  selected(): BrowserInstanceModel {
    const selected = this.instances.find(instance => instance.id === this.selectedInstanceId);
    if (!selected) throw new Error('当前没有可用的浏览器实例。');
    return { ...selected };
  }

  create(options: CreateBrowserInstanceOptions = {}): BrowserInstanceModel {
    const id = options.id || this.nextStableId();
    validateBrowserInstanceId(id);
    if (this.instances.some(instance => instance.id === id)) throw new Error(`浏览器实例 ID“${id}”已存在。`);
    const name = normalizeInstanceName(options.name || `浏览器 ${this.instances.length + 1}`);
    const lastUrl = normalizeBrowserUrl(options.lastUrl || 'https://www.baidu.com');
    const createdAt = normalizeTimestamp(options.createdAt || this.now().toISOString());
    const instance: BrowserInstanceModel = {
      id,
      name,
      order: this.instances.length,
      cacheDirectory: portableBrowserProfilePath(id),
      lastUrl,
      createdAt,
      restoreOpen: options.restoreOpen !== false,
      pluginStatus: '待启动'
    };
    this.instances.push(instance);
    this.selectedInstanceId = id;
    return { ...instance };
  }

  switch(instanceId: string): BrowserInstanceModel {
    const instance = this.require(instanceId);
    this.selectedInstanceId = instance.id;
    return { ...instance };
  }

  rename(instanceId: string, newName: string): BrowserInstanceModel {
    const instance = this.require(instanceId);
    instance.name = normalizeInstanceName(newName);
    return { ...instance };
  }

  updateUrl(instanceId: string, lastUrl: string): BrowserInstanceModel {
    const instance = this.require(instanceId);
    instance.lastUrl = normalizeBrowserUrl(lastUrl);
    return { ...instance };
  }

  reorder(instanceId: string, requestedIndex: number): void {
    const currentIndex = this.instances.findIndex(instance => instance.id === instanceId);
    if (currentIndex < 0) throw new Error(`找不到浏览器实例“${instanceId}”。`);
    const targetIndex = Math.max(0, Math.min(this.instances.length - 1, Math.trunc(requestedIndex)));
    const [instance] = this.instances.splice(currentIndex, 1);
    this.instances.splice(targetIndex, 0, instance!);
    this.instances.forEach((item, order) => { item.order = order; });
  }

  delete(instanceId: string): BrowserInstanceModel {
    if (this.instances.length <= 1) throw new Error('至少必须保留一个可用浏览器实例。');
    const index = this.instances.findIndex(instance => instance.id === instanceId);
    if (index < 0) throw new Error(`找不到浏览器实例“${instanceId}”。`);
    const [removed] = this.instances.splice(index, 1);
    this.instances.forEach((item, order) => { item.order = order; });
    if (this.selectedInstanceId === instanceId) {
      this.selectedInstanceId = this.instances[Math.min(index, this.instances.length - 1)]!.id;
    }
    return { ...removed! };
  }

  toDocument(): BrowserWorkspaceDocument {
    return {
      schemaVersion: BROWSER_WORKSPACE_SCHEMA_VERSION,
      workspaceType: BROWSER_WORKSPACE_TYPE,
      selectedInstanceId: this.selectedInstanceId,
      pluginDirectory: BROWSER_EXTENSION_DIRECTORY,
      instances: this.instances.map((instance, order) => ({
        ...instance,
        order,
        cacheDirectory: portableBrowserProfilePath(instance.id)
      }))
    };
  }

  private restore(document: BrowserWorkspaceDocument): void {
    const normalized = normalizeBrowserWorkspaceDocument(document);
    this.instances = normalized.instances;
    this.selectedInstanceId = normalized.selectedInstanceId;
  }

  private require(instanceId: string): BrowserInstanceModel {
    const instance = this.instances.find(item => item.id === instanceId);
    if (!instance) throw new Error(`找不到浏览器实例“${instanceId}”。`);
    return instance;
  }

  private nextStableId(): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = this.idFactory();
      validateBrowserInstanceId(candidate);
      if (!this.instances.some(instance => instance.id === candidate)) return candidate;
    }
    throw new Error('无法生成唯一的浏览器实例 ID。');
  }
}

export function generateStableBrowserInstanceId(random = globalThis.crypto): string {
  if (!random?.getRandomValues) throw new Error('当前环境不支持安全随机数，无法创建浏览器实例。');
  const bytes = random.getRandomValues(new Uint8Array(8));
  return `browser-${[...bytes].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function portableBrowserProfilePath(instanceId: string): string {
  validateBrowserInstanceId(instanceId);
  return `profiles/${instanceId}`;
}

export function validatePortableBrowserProfilePath(instanceId: string, value: string): string {
  const expected = portableBrowserProfilePath(instanceId);
  if (value !== expected || value.includes('\\') || value.includes(':') || value.startsWith('/') || value.split('/').includes('..')) {
    throw new Error(`实例“${instanceId}”的缓存目录必须是可迁移相对路径“${expected}”。`);
  }
  return value;
}

export function normalizeBrowserWorkspaceDocument(value: unknown): BrowserWorkspaceDocument {
  if (!value || typeof value !== 'object') throw new Error('浏览器实例配置必须是 JSON 对象。');
  const document = value as Partial<BrowserWorkspaceDocument>;
  if (document.schemaVersion !== BROWSER_WORKSPACE_SCHEMA_VERSION || document.workspaceType !== BROWSER_WORKSPACE_TYPE) {
    throw new Error('浏览器实例配置版本或工作台类型不受支持。');
  }
  if (document.pluginDirectory !== BROWSER_EXTENSION_DIRECTORY) {
    throw new Error(`浏览器插件目录必须是相对目录“${BROWSER_EXTENSION_DIRECTORY}”。`);
  }
  if (!Array.isArray(document.instances) || document.instances.length === 0) {
    throw new Error('浏览器实例配置至少需要一个实例。');
  }
  const ids = new Set<string>();
  const instances = document.instances.map((source, index) => {
    validateBrowserInstanceId(source.id);
    if (ids.has(source.id)) throw new Error(`浏览器实例 ID“${source.id}”重复。`);
    ids.add(source.id);
    return {
      id: source.id,
      name: normalizeInstanceName(source.name),
      order: Number.isInteger(source.order) ? source.order : index,
      cacheDirectory: validatePortableBrowserProfilePath(source.id, source.cacheDirectory),
      lastUrl: normalizeBrowserUrl(source.lastUrl),
      createdAt: normalizeTimestamp(source.createdAt),
      restoreOpen: source.restoreOpen !== false,
      pluginStatus: normalizePluginStatus(source.pluginStatus)
    } satisfies BrowserInstanceModel;
  }).sort((left, right) => left.order - right.order);
  instances.forEach((instance, order) => { instance.order = order; });
  const selectedInstanceId = typeof document.selectedInstanceId === 'string' && ids.has(document.selectedInstanceId)
    ? document.selectedInstanceId
    : instances[0]!.id;
  return {
    schemaVersion: BROWSER_WORKSPACE_SCHEMA_VERSION,
    workspaceType: BROWSER_WORKSPACE_TYPE,
    selectedInstanceId,
    pluginDirectory: BROWSER_EXTENSION_DIRECTORY,
    instances
  };
}

export function createPortableBrowserWorkspaceConfig(options: CreateBrowserInstanceOptions = {}): BrowserWorkspaceDocument {
  const service = new BrowserInstanceService(undefined, {
    idFactory: () => options.id || 'browser-default',
    now: () => new Date(options.createdAt || '2026-08-08T00:00:00.000Z'),
    createDefault: false
  });
  service.create({
    id: options.id || 'browser-default',
    name: options.name || '浏览器 1',
    lastUrl: options.lastUrl || 'https://www.baidu.com',
    createdAt: options.createdAt || '2026-08-08T00:00:00.000Z',
    restoreOpen: options.restoreOpen
  });
  return service.toDocument();
}

function validateBrowserInstanceId(value: string): void {
  if (!INSTANCE_ID_PATTERN.test(value)) throw new Error(`浏览器实例 ID“${value}”格式无效。`);
}

function normalizeInstanceName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('浏览器实例名称不能为空。');
  const normalized = value.trim();
  if (normalized.length > 80) throw new Error('浏览器实例名称不能超过 80 个字符。');
  return normalized;
}

function normalizeBrowserUrl(value: unknown): string {
  if (typeof value !== 'string' || !HTTP_URL_PATTERN.test(value.trim())) throw new Error('浏览器地址必须使用 http:// 或 https://。');
  return value.trim();
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('浏览器实例时间戳无效。');
  return new Date(value).toISOString();
}

function normalizePluginStatus(value: unknown): BrowserInstanceModel['pluginStatus'] {
  const allowed: BrowserInstanceModel['pluginStatus'][] = [
    '未配置', '插件加载中', '插件已加载', '插件已移除', '插件缺失', '插件加载失败', '待启动'
  ];
  return allowed.includes(value as BrowserInstanceModel['pluginStatus'])
    ? value as BrowserInstanceModel['pluginStatus']
    : '待启动';
}
