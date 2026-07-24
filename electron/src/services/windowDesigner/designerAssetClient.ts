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

export function getDesignerImagePreviewSource(projectId: string, imageSource: string): string {
  const source = imageSource.trim();
  if (!source || /^(?:https?:|data:|blob:)/iu.test(source)) return source;
  const query = new URLSearchParams({ projectId, path: source });
  return `/api/window-designer/assets/content?${query.toString()}`;
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
