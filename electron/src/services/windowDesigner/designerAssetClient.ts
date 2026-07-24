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
