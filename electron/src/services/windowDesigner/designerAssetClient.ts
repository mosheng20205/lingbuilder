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
