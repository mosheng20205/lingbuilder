/**
 * 常用模块（收藏）服务：用户把常用模块或自己封装的模块置顶到模块面板「常用模块」分组。
 * 收藏是本机用户级偏好（跨工作区），只保存模块 ID，存 localStorage（与「显示底层高级 API」同一通道），
 * 不进项目文件、不进云端；模块卸载后收藏 ID 保留、条目自动隐藏，重装后恢复显示。
 * 列表顺序为「新收藏在前」，新加入的模块立刻可见。
 */

export const MODULE_FAVORITES_CHANGED_EVENT = 'lingbuilder-module-favorites-changed';

const FAVORITES_STORAGE_KEY = 'lingbuilder.modules.favoriteIds';
/** 收藏上限：超出后从最旧的一端淘汰，防止无界增长。 */
export const MAX_FAVORITE_MODULES = 100;

interface MinimalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** 测试专用：显式替换存储通道；传 null 恢复默认探测（window.localStorage → globalThis.localStorage → 内存）。 */
let storageOverride: MinimalStorage | null | undefined;

const memoryFallbackIds: string[] = [];

function resolveStorage(): MinimalStorage | null {
  if (storageOverride !== undefined) return storageOverride;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const globalStore = (globalThis as { localStorage?: MinimalStorage }).localStorage;
  if (globalStore) return globalStore;
  return null;
}

function sanitizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_FAVORITE_MODULES) break;
  }
  return ids;
}

function readFavoriteIds(): string[] {
  const storage = resolveStorage();
  if (!storage) return [...memoryFallbackIds];
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]): void {
  const storage = resolveStorage();
  const limited = ids.slice(0, MAX_FAVORITE_MODULES);
  if (!storage) {
    memoryFallbackIds.splice(0, memoryFallbackIds.length, ...limited);
    notifyFavoritesChanged();
    return;
  }
  try {
    if (limited.length === 0) {
      if (storage.removeItem) storage.removeItem(FAVORITES_STORAGE_KEY);
      else storage.setItem(FAVORITES_STORAGE_KEY, '');
    } else {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(limited));
    }
  } catch {
    // 存储不可用（隐私模式/配额）：静默降级为不持久化，本次会话内仍生效于调用方 state。
  }
  notifyFavoritesChanged();
}

function notifyFavoritesChanged(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(MODULE_FAVORITES_CHANGED_EVENT));
}

/** 读取全部常用模块 ID（新收藏在前）；返回副本，调用方修改不影响内部状态。 */
export function getModuleFavoriteIds(): string[] {
  return readFavoriteIds();
}

export function isModuleFavorite(moduleId: string): boolean {
  const id = moduleId.trim();
  if (!id) return false;
  return readFavoriteIds().includes(id);
}

/** 设置收藏状态；返回列表是否发生变化。 */
export function setModuleFavorite(moduleId: string, favorite: boolean): boolean {
  const id = moduleId.trim();
  if (!id) return false;
  const previous = readFavoriteIds();
  const has = previous.includes(id);
  if (favorite === has) return false;
  const next = favorite ? [id, ...previous].slice(0, MAX_FAVORITE_MODULES) : previous.filter(item => item !== id);
  writeFavoriteIds(next);
  return true;
}

/** 切换收藏状态；返回切换后的收藏状态。 */
export function toggleModuleFavorite(moduleId: string): boolean {
  const id = moduleId.trim();
  if (!id) return false;
  const favorite = !readFavoriteIds().includes(id);
  setModuleFavorite(id, favorite);
  return favorite;
}

/** 订阅收藏变化（同窗口事件 + 跨窗口 storage 事件）；返回取消订阅函数。 */
export function subscribeModuleFavorites(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => undefined;
  const onCustomEvent = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(MODULE_FAVORITES_CHANGED_EVENT, onCustomEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MODULE_FAVORITES_CHANGED_EVENT, onCustomEvent);
    window.removeEventListener('storage', onStorage);
  };
}

/** 测试专用：重置内存回退列表。 */
export function resetModuleFavoritesForTests(): void {
  memoryFallbackIds.splice(0, memoryFallbackIds.length);
}

/** 测试专用：固定存储通道（null=强制内存回退，undefined=恢复自动探测）。 */
export function setModuleFavoriteStorageForTests(storage: MinimalStorage | null | undefined): void {
  storageOverride = storage;
}
