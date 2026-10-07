import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FolderPlus, ImagePlus, PenLine, Plus, Trash2, X } from 'lucide-react';
import type { LingImageListResource } from '../services/windowDesigner/types';
import { normalizeImageListResourcePaths } from '../services/windowDesigner/imageListResourceModel';
import {
  getDesignerImagePreviewSource,
  listDesignerImageResources,
  selectAndImportDesignerImage,
  type DesignerImageResource
} from '../services/windowDesigner/designerAssetClient';
import { PropertyGroup } from './PropertyGroup';

interface ImageListResourceEditorProps {
  projectId: string;
  resources: LingImageListResource[];
  isDarkMode: boolean;
  onChange: (resources: LingImageListResource[]) => void;
  revealResourceId?: string | null;
  registerNavigationTarget: (kind: 'control' | 'resource', id: string) => (element: HTMLElement | null) => void;
  /** 仅测试/导航场景：初始即展开资源编辑器（真实面板默认收起）。 */
  initiallyOpen?: boolean;
}

/**
 * 项目 / 图像列表资源编辑器。
 *
 * 主交互免手输：按列表顺序维护图片（顺序即图片编号，从 0 起），支持「从项目图库添加」（点击即追加，
 * 已添加的置灰）与「导入本机图片…」（复制进项目 assets 后自动加入）；「手动输入路径」是折叠的高级
 * 兜底，blur 时才整体归一化提交——编辑中不重置文本框，回车换行始终生效（历史上受控过滤把行尾空行
 * 立即吃掉，回车无法换行，2026-10-07 修复）。
 */
export default function ImageListResourceEditor({
  projectId,
  resources,
  isDarkMode,
  onChange,
  revealResourceId,
  registerNavigationTarget,
  initiallyOpen = false
}: ImageListResourceEditorProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [status, setStatus] = useState('');
  const [galleryForId, setGalleryForId] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<DesignerImageResource[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [manualEditId, setManualEditId] = useState<string | null>(null);
  const galleryLoadedRef = useRef(false);

  useEffect(() => {
    if (revealResourceId && resources.some(resource => resource.id === revealResourceId)) setOpen(true);
  }, [resources, revealResourceId]);

  const inputClass = `w-full rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`;
  const iconButtonClass = `inline-flex h-5 w-5 items-center justify-center rounded text-[10px] outline-none disabled:cursor-not-allowed disabled:opacity-25 ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'}`;
  const actionButtonClass = `inline-flex flex-1 items-center justify-center gap-1 rounded border px-1.5 py-1 text-[9px] ${isDarkMode ? 'border-[#3d3d46] text-cyan-400 hover:bg-white/5' : 'border-slate-300 text-cyan-700 hover:bg-slate-100'}`;

  const update = (id: string, fields: Partial<LingImageListResource>) =>
    onChange(resources.map(resource => resource.id === id ? { ...resource, ...fields } : resource));

  const appendImages = (id: string, paths: readonly string[]) => {
    const resource = resources.find(item => item.id === id);
    if (!resource) return;
    const existing = new Set(resource.images.map(image => image.toLowerCase()));
    const added: string[] = [];
    const skipped: string[] = [];
    for (const path of normalizeImageListResourcePaths(paths)) {
      if (existing.has(path.toLowerCase())) { skipped.push(path); continue; }
      existing.add(path.toLowerCase());
      added.push(path);
    }
    if (added.length > 0) {
      update(id, { images: [...resource.images, ...added] });
      setStatus(added.length === 1 ? `已添加：${added[0]}（图片编号 ${resource.images.length}）` : `已添加 ${added.length} 张图片。`);
    } else {
      setStatus(skipped.length > 0 ? '所选图片已在列表中。' : '没有可添加的图片。');
    }
    if (skipped.length > 0 && added.length > 0) setStatus(`已添加 ${added.length} 张；${skipped.length} 张已在列表中被跳过。`);
  };

  const moveImage = (id: string, index: number, target: number) => {
    const resource = resources.find(item => item.id === id);
    if (!resource || target < 0 || target >= resource.images.length) return;
    const images = [...resource.images];
    const [moved] = images.splice(index, 1);
    images.splice(target, 0, moved);
    update(id, { images });
  };

  const removeImage = (id: string, index: number) => {
    const resource = resources.find(item => item.id === id);
    if (!resource) return;
    update(id, { images: resource.images.filter((_, imageIndex) => imageIndex !== index) });
  };

  const openGallery = async (id: string) => {
    setManualEditId(null);
    if (galleryForId === id) { setGalleryForId(null); return; }
    setGalleryForId(id);
    if (galleryLoadedRef.current) return;
    setGalleryLoading(true);
    try {
      setGalleryImages(await listDesignerImageResources(projectId));
      galleryLoadedRef.current = true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '项目图库读取失败。');
    } finally {
      setGalleryLoading(false);
    }
  };

  const importLocalImage = async (id: string) => {
    setStatus('');
    const result = await selectAndImportDesignerImage(projectId);
    if (result.canceled) return;
    if (!result.ok || !result.relativePath) { setStatus(result.error || '图片导入失败。'); return; }
    appendImages(id, [result.relativePath]);
  };

  const add = () => {
    let suffix = resources.length + 1;
    while (resources.some(resource => resource.id === `images-${suffix}`)) suffix += 1;
    onChange([...resources, { id: `images-${suffix}`, type: 'ImageList', name: `图像列表 ${suffix}`, imageWidth: 16, imageHeight: 16, images: [] }]);
    setOpen(true);
  };

  const commitManualImages = (id: string, text: string) => {
    update(id, { images: normalizeImageListResourcePaths(text.split(/\r?\n/)) });
    setManualEditId(null);
  };

  const hideBrokenPreview = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.visibility = 'hidden';
  };

  return (
    <PropertyGroup title={`项目 / 图像列表资源（${resources.length}）`} isDarkMode={isDarkMode} defaultOpen={false}>
      <div className="p-2">
        <button type="button" onClick={() => setOpen(value => !value)} className="w-full rounded border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-500">{open ? '收起资源编辑器' : '管理 ImageList'}</button>
        {open && (
          <div className="mt-2 space-y-2">
          {resources.length === 0 && <div className="text-[10px] text-slate-500">尚未创建图像列表资源。</div>}
          {resources.map(resource => {
            const galleryOpen = galleryForId === resource.id;
            const manualOpen = manualEditId === resource.id;
            return (
              <div key={resource.id} ref={registerNavigationTarget('resource', resource.id)} tabIndex={-1} data-designer-resource-id={resource.id} className={`space-y-1.5 rounded border p-2 ${isDarkMode ? 'border-[#34343d] bg-black/10' : 'border-slate-200 bg-white'}`}>
                <div className="flex gap-1">
                  <input aria-label="图像列表名称" value={resource.name} onChange={event => update(resource.id, { name: event.target.value })} className={`min-w-0 flex-1 rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44]' : 'bg-white border-slate-300'}`} />
                  <button type="button" aria-label={`删除图像列表 ${resource.name}`} title="删除图像列表" onClick={() => { if (manualEditId === resource.id) setManualEditId(null); if (galleryForId === resource.id) setGalleryForId(null); onChange(resources.filter(item => item.id !== resource.id)); }} className="rounded px-1 text-red-400"><Trash2 className="h-3 w-3" /></button>
                </div>
                <div className="text-[9px] text-slate-500">资源 ID：{resource.id}</div>
                <div className="flex gap-1">
                  <input aria-label="图像宽度" type="number" min={1} value={resource.imageWidth} onChange={event => update(resource.id, { imageWidth: Math.max(1, Number(event.target.value) || 1) })} className={inputClass} />
                  <input aria-label="图像高度" type="number" min={1} value={resource.imageHeight} onChange={event => update(resource.id, { imageHeight: Math.max(1, Number(event.target.value) || 1) })} className={inputClass} />
                </div>
                {resource.images.length === 0 ? (
                  <div className={`rounded border border-dashed px-2 py-1.5 text-[9px] text-slate-500 ${isDarkMode ? 'border-[#3c3c44]' : 'border-slate-300'}`}>
                    还没有图片。点下方按钮从项目图库添加或导入本机图片；列表顺序就是图片编号（从 0 起）。
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {resource.images.map((image, index) => (
                      <li key={`${index}-${image}`} className={`flex items-center gap-1.5 rounded border px-1 py-0.5 ${isDarkMode ? 'border-[#2b2b34] bg-[#16161b]' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="w-5 shrink-0 text-right font-mono text-[9px] text-slate-500" title={`图片编号 ${index}`}>{index}</span>
                        <img src={getDesignerImagePreviewSource(projectId, image)} alt="" aria-hidden="true" draggable={false} className="h-6 w-6 shrink-0 rounded border border-slate-500/30 object-contain" onError={hideBrokenPreview} />
                        <span className="min-w-0 flex-1 truncate text-[9px]" title={image}>{image}</span>
                        <button type="button" aria-label={`上移图片 ${image}`} title="上移（图片编号 -1）" disabled={index === 0} onClick={() => moveImage(resource.id, index, index - 1)} className={iconButtonClass}><ArrowUp className="h-3 w-3" /></button>
                        <button type="button" aria-label={`下移图片 ${image}`} title="下移（图片编号 +1）" disabled={index === resource.images.length - 1} onClick={() => moveImage(resource.id, index, index + 1)} className={iconButtonClass}><ArrowDown className="h-3 w-3" /></button>
                        <button type="button" aria-label={`移除图片 ${image}`} title="从列表移除（不删除文件）" onClick={() => removeImage(resource.id, index)} className={`${iconButtonClass} text-rose-400`}><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => void openGallery(resource.id)} className={actionButtonClass}><FolderPlus className="h-3 w-3" />从项目图库添加</button>
                  <button type="button" onClick={() => void importLocalImage(resource.id)} className={actionButtonClass}><ImagePlus className="h-3 w-3" />导入本机图片…</button>
                  <button type="button" onClick={() => { if (!manualOpen) setGalleryForId(null); setManualEditId(manualOpen ? null : resource.id); }} className={actionButtonClass}><PenLine className="h-3 w-3" />手动输入路径</button>
                </div>
                {galleryOpen && (
                  <div className={`rounded border p-1.5 ${isDarkMode ? 'border-[#3c3c44] bg-[#141419]' : 'border-slate-300 bg-white'}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold text-slate-400">项目图库（点击图片加入列表，可连续点选）</span>
                      <button type="button" aria-label="关闭图库" onClick={() => setGalleryForId(null)} className={iconButtonClass}><X className="h-3 w-3" /></button>
                    </div>
                    {galleryLoading ? (
                      <div className="py-2 text-center text-[9px] text-slate-500">正在读取项目图库…</div>
                    ) : galleryImages.length === 0 ? (
                      <div className="py-2 text-center text-[9px] text-slate-500">项目图库还没有图片，可先用「导入本机图片…」。</div>
                    ) : (
                      <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto">
                        {galleryImages.map(item => {
                          const added = resource.images.some(image => image.toLowerCase() === item.relativePath.toLowerCase());
                          return (
                            <button key={item.relativePath} type="button" disabled={added} title={added ? '已在列表中' : item.relativePath} onClick={() => appendImages(resource.id, [item.relativePath])} className={`flex items-center gap-1 rounded border px-1 py-0.5 text-left ${added ? 'cursor-default opacity-40' : isDarkMode ? 'border-[#3c3c44] hover:bg-white/10' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <img src={getDesignerImagePreviewSource(projectId, item.relativePath)} alt="" aria-hidden="true" draggable={false} className="h-6 w-6 shrink-0 rounded object-contain" onError={hideBrokenPreview} />
                              <span className="min-w-0 flex-1 truncate text-[9px]">{item.fileName}</span>
                              {added && <span className="shrink-0 text-[8px] text-slate-500">已添加</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {manualOpen && (
                  <textarea
                    aria-label="图像文件列表"
                    defaultValue={resource.images.join('\n')}
                    rows={3}
                    placeholder={'每行一个工作区内图片路径，如 assets/icon.png（不要以 \\ 或 / 开头）'}
                    className={`w-full resize-y rounded border px-1 py-0.5 text-[10px] ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                    onBlur={event => commitManualImages(resource.id, event.target.value)}
                  />
                )}
              </div>
            );
          })}
          {status && <div role="status" className="text-[9px] text-amber-500">{status}</div>}
          <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-500"><Plus className="h-3 w-3" />新建图像列表</button>
          </div>
        )}
      </div>
    </PropertyGroup>
  );
}
