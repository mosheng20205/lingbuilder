export interface DesignerImageImportResult {
  ok: boolean;
  canceled?: boolean;
  relativePath?: string;
  error?: string;
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
