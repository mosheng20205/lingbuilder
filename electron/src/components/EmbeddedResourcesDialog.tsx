import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  selectAndImportEmbeddedResourceFiles,
  selectAndImportEmbeddedResourceFolder,
  scanEmbeddedResourceDirectory,
  enableEmbeddedResourceModule
} from '../services/windowDesigner/designerAssetClient';
import {
  appendEmbeddedResources,
  describeEmbeddedResourceImport,
  describeEmbeddedResourceScan
} from '../services/windowDesigner/embeddedResourceActions';
import type { LingEmbeddedResource } from '../services/windowDesigner/types';
import EmbeddedResourceEditor from './EmbeddedResourceEditor';

/**
 * 「配置项目内嵌资源」对话框：在解决方案资源管理器里点开就能编辑清单，
 * 不需要切到窗口设计器（与「项目构建目录」等配置类入口一致）。
 * 清单仍写在项目设计器模型顶层 `embeddedResources`，确认后由调用方持久化。
 */
export interface EmbeddedResourcesDialogProps {
  open: boolean;
  isDarkMode: boolean;
  /** 当前项目是否启用了 lingbuilder.resource.embed（未启用时面板给一键启用入口）。 */
  moduleEnabled: boolean;
  projectId: string;
  projectName: string;
  resources: LingEmbeddedResource[];
  onConfirm: (resources: LingEmbeddedResource[]) => void | Promise<void>;
  onClose: () => void;
}

export default function EmbeddedResourcesDialog({
  open,
  isDarkMode,
  moduleEnabled,
  projectId,
  projectName,
  resources,
  onConfirm,
  onClose
}: EmbeddedResourcesDialogProps) {
  const [draft, setDraft] = useState<LingEmbeddedResource[]>(resources);
  const [moduleEnabledState, setModuleEnabledState] = useState(moduleEnabled);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // 打开时以当前项目模型为草稿；关闭后不保留本地状态。
  useEffect(() => {
    if (!open) return;
    setDraft(resources);
    setModuleEnabledState(moduleEnabled);
    setStatus('');
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  if (!open) return null;

  const appendEntries = (entries: LingEmbeddedResource[]) => {
    const appended = appendEmbeddedResources(draft, entries);
    setDraft(appended.resources);
    return appended;
  };
  const runAction = async (label: string, action: () => Promise<string>): Promise<string> => {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      const message = await action();
      setStatus(message);
      return message;
    } catch (error) {
      const message = `失败：${error instanceof Error ? error.message : String(error)}`;
      setStatus(message);
      return message;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="embedded-resources-dialog-title"
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
    >
      <div className={`flex max-h-[82vh] w-full max-w-3xl flex-col rounded-lg border shadow-2xl ${
        isDarkMode ? 'border-[#3a3a44] bg-[#1e1e24] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
      }`}>
        <div className={`flex shrink-0 items-center justify-between border-b px-4 py-2.5 ${
          isDarkMode ? 'border-[#30303a] bg-[#23232a]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="min-w-0">
            <div id="embedded-resources-dialog-title" className="text-[13px] font-semibold">配置项目内嵌资源</div>
            <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {projectName} · 构建期以 RCDATA 打进 EXE，运行期用 资源_* 命令按逻辑名读取（跨窗口共享）
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭内嵌资源配置"
            className={`rounded p-1 transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-[#2f2f38]' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmbeddedResourceEditor
            resources={draft}
            isDarkMode={isDarkMode}
            moduleEnabled={moduleEnabledState}
            onChange={setDraft}
            onSelectFiles={() => runAction('正在选择文件', async () => {
              const result = await selectAndImportEmbeddedResourceFiles(projectId);
              if (result.canceled) return '已取消选择。';
              if (!result.ok) throw new Error(result.error || '内嵌资源导入失败。');
              return describeEmbeddedResourceImport(result, appendEntries(result.entries || []));
            })}
            onSelectFolder={() => runAction('正在选择文件夹', async () => {
              const result = await selectAndImportEmbeddedResourceFolder(projectId);
              if (result.canceled) return '已取消选择。';
              if (!result.ok) throw new Error(result.error || '内嵌资源文件夹导入失败。');
              return describeEmbeddedResourceImport(result, appendEntries(result.entries || []));
            })}
            onScanDirectory={directory => runAction('正在扫描目录', async () => {
              const result = await scanEmbeddedResourceDirectory(directory);
              const appended = appendEntries(result.files.map(file => ({ name: file, file })));
              return describeEmbeddedResourceScan(directory, appended, result.skipped);
            })}
            onEnableModule={() => runAction('正在启用内嵌资源模块', async () => {
              const result = await enableEmbeddedResourceModule(projectId);
              if (!result.ok) throw new Error(result.error || '内嵌资源模块启用失败。');
              setModuleEnabledState(true);
              return ['已启用「内嵌资源模块」', ...(result.messages || [])].join('；') + '。';
            })}
            busy={busy}
          />
        </div>

        <div className={`flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5 ${
          isDarkMode ? 'border-[#30303a] bg-[#23232a]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className={`min-w-0 truncate text-[10px] ${status.startsWith('失败') ? 'text-red-400' : isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {status || `共 ${draft.length} 条内嵌资源；确认后写入项目模型（保存项目即落盘）。`}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded border px-3 py-1.5 text-[11px] transition-colors ${
                isDarkMode ? 'border-[#3c3c44] text-slate-300 hover:bg-[#2f2f38]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => { void onConfirm(draft); onClose(); }}
              className="rounded border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
            >
              应用到项目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
