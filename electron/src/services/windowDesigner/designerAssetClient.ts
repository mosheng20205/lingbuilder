import { EMBEDDED_RESOURCE_MODULE_ID } from './embeddedResourceService';

export interface DesignerImageImportResult {
  ok: boolean;
  canceled?: boolean;
  relativePath?: string;
  error?: string;
}

export interface DesignerImageResource {
  relativePath: string;
  fileName: string;
  size: number;
}

export interface EmbeddedResourceImportEntry {
  /** 写回项目模型的逻辑名（相对源码根，如 resources/logo.png）。 */
  name: string;
  /** 工作区内相对源路径。 */
  file: string;
  size: number;
}

export interface EmbeddedResourceImportResult {
  ok: boolean;
  canceled?: boolean;
  entries?: EmbeddedResourceImportEntry[];
  skipped?: Array<{ path: string; reason: string }>;
  notes?: string[];
  totalBytes?: number;
  error?: string;
}

export async function listDesignerImageResources(projectId: string): Promise<DesignerImageResource[]> {
  const query = new URLSearchParams({ projectId });
  const response = await fetch(`/api/window-designer/assets?${query.toString()}`);
  const result = await response.json() as { ok?: boolean; resources?: DesignerImageResource[]; error?: string };
  if (!response.ok || !result.ok || !Array.isArray(result.resources)) {
    throw new Error(result.error || '项目图片资源读取失败。');
  }
  return result.resources;
}

/** 内嵌站点「扫描目录」：递归列出工作区内一个目录的全部文件（工作区相对路径）。 */
export async function scanEmbeddedSiteDirectory(directory: string): Promise<string[]> {
  const query = new URLSearchParams({ dir: directory });
  const response = await fetch(`/api/window-designer/embedded-site/scan?${query.toString()}`);
  const result = await response.json() as { ok?: boolean; files?: string[]; error?: string };
  if (!response.ok || !result.ok || !Array.isArray(result.files)) {
    throw new Error(result.error || '内嵌站点目录扫描失败。');
  }
  return result.files;
}

export function getDesignerImagePreviewSource(projectId: string, imageSource: string): string {
  const source = imageSource.trim();
  if (!source || /^(?:https?:|data:|blob:)/iu.test(source)) return source;
  const query = new URLSearchParams({ projectId, path: source });
  return `/api/window-designer/assets/content?${query.toString()}`;
}

export async function fetchDesignerImagePreviewBlob(
  projectId: string,
  imageSource: string,
  signal?: AbortSignal
): Promise<Blob> {
  const source = getDesignerImagePreviewSource(projectId, imageSource);
  if (!source) throw new Error('图片资源路径为空。');
  const response = await fetch(source, { signal });
  if (!response.ok) {
    const detail = await readPreviewError(response);
    throw new Error(detail || `图片资源读取失败（HTTP ${response.status}）。`);
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`图片资源返回了错误的内容类型：${contentType || '未声明'}。`);
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('图片资源内容为空。');
  return blob;
}

async function readPreviewError(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim();
  if (!text) return '';
  try {
    const value = JSON.parse(text) as { error?: unknown };
    if (typeof value.error === 'string' && value.error.trim()) return value.error.trim();
  } catch {
    // Plain-text API diagnostics are returned as-is below.
  }
  return text.slice(0, 300);
}

export async function selectAndImportDesignerImage(projectId: string): Promise<DesignerImageImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectImage();
  if (!selection) return { ok: false, error: '本地图片选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };

  const response = await fetch('/api/window-designer/assets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourcePath: selection.filePath })
  });
  const result = await response.json() as DesignerImageImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || '图片复制到项目失败。' };
  return result;
}

export async function selectAndImportDesignerAnimation(projectId: string): Promise<DesignerImageImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectAnimation();
  if (!selection) return { ok: false, error: '本地 AVI 选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };

  const response = await fetch('/api/window-designer/assets/import-animation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourcePath: selection.filePath })
  });
  const result = await response.json() as DesignerImageImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || 'AVI 动画复制到项目失败。' };
  return result;
}

export async function selectAndImportDesignerGif(projectId: string): Promise<DesignerImageImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectGif();
  if (!selection) return { ok: false, error: '本地 GIF 选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };

  const response = await fetch('/api/window-designer/assets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourcePath: selection.filePath })
  });
  const result = await response.json() as DesignerImageImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || 'GIF 复制到项目失败。' };
  if (!result.relativePath?.toLowerCase().endsWith('.gif')) return { ok: false, error: '动态图像控件仅支持 GIF 文件。' };
  return result;
}

export async function selectAndImportDesignerVideo(projectId: string): Promise<DesignerImageImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectVideo();
  if (!selection) return { ok: false, error: '本地视频选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };

  const response = await fetch('/api/window-designer/assets/import-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourcePath: selection.filePath })
  });
  const result = await response.json() as DesignerImageImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || '视频复制到项目失败。' };
  return result;
}

/**
 * 「选择文件…」：本机多选后复制进 <项目源码根>/resources/。
 * 桌面版经 designer-assets 受控 IPC 取路径，复制与校验统一由工作区本地服务完成（renderer 不碰 fs）。
 */
export async function selectAndImportEmbeddedResourceFiles(projectId: string): Promise<EmbeddedResourceImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectEmbeddedFiles();
  if (!selection) return { ok: false, error: '本机文件选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.error) return { ok: false, error: selection.error };
  if (selection.canceled || !selection.filePaths?.length) return { ok: false, canceled: true };
  return importEmbeddedResources(projectId, { sourcePaths: selection.filePaths });
}

/** 「选择文件夹…」：本机选目录后按目录结构复制进 <项目源码根>/resources/<文件夹名>/。 */
export async function selectAndImportEmbeddedResourceFolder(projectId: string): Promise<EmbeddedResourceImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectEmbeddedFolder();
  if (!selection) return { ok: false, error: '本机文件夹选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.error) return { ok: false, error: selection.error };
  if (selection.canceled || !selection.directoryPath) return { ok: false, canceled: true };
  return importEmbeddedResources(projectId, { directory: selection.directoryPath });
}

async function importEmbeddedResources(
  projectId: string,
  payload: { sourcePaths?: string[]; directory?: string }
): Promise<EmbeddedResourceImportResult> {
  const response = await fetch('/api/window-designer/embedded-resources/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...payload })
  });
  const result = await response.json() as EmbeddedResourceImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || '内嵌资源复制到项目失败。' };
  return result;
}

/** 「扫描目录…」：读取工作区内已有目录，不复制；逻辑名直接取工作区相对路径。 */
export async function scanEmbeddedResourceDirectory(directory: string): Promise<{ files: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const query = new URLSearchParams({ dir: directory });
  const response = await fetch(`/api/window-designer/embedded-resources/scan?${query.toString()}`, { cache: 'no-store' });
  const result = await response.json() as { ok?: boolean; files?: string[]; skipped?: Array<{ path: string; reason: string }>; error?: string };
  if (!response.ok || !result.ok || !Array.isArray(result.files)) {
    throw new Error(result.error || '内嵌资源目录扫描失败。');
  }
  return { files: result.files, skipped: Array.isArray(result.skipped) ? result.skipped : [] };
}

/** 「启用内嵌资源模块」：走项目模块启用链路，成功后设计器需要刷新模块状态。 */
export async function enableEmbeddedResourceModule(projectId: string): Promise<{ ok: boolean; error?: string; messages?: string[] }> {
  const response = await fetch('/api/modules/project/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, moduleId: EMBEDDED_RESOURCE_MODULE_ID })
  });
  const result = await response.json() as { ok?: boolean; error?: string; messages?: string[] };
  if (!response.ok || !result.ok) return { ok: false, error: result.error || '内嵌资源模块启用失败。' };
  return { ok: true, messages: Array.isArray(result.messages) ? result.messages : [] };
}

export async function selectAndImportDesignerIcon(projectId: string): Promise<DesignerImageImportResult> {
  const selection = await window.lingBuilder?.designerAssets?.selectIcon();
  if (!selection) return { ok: false, error: '本地窗口图标选择仅在 LingBuilder 桌面版中可用。' };
  if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };

  const response = await fetch('/api/window-designer/assets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourcePath: selection.filePath })
  });
  const result = await response.json() as DesignerImageImportResult;
  if (!response.ok || !result.ok) return { ok: false, error: result.error || '窗口图标复制到项目失败。' };
  if (!result.relativePath?.toLowerCase().endsWith('.ico')) return { ok: false, error: '自定义窗口图标必须是 ICO 文件。' };
  return result;
}
