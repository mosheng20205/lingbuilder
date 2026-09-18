import { AlertTriangle, FolderOpen, FolderTree, Plus, ScanSearch, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  EMBEDDED_RESOURCE_LIMIT,
  EMBEDDED_RESOURCE_MAX_FILE_BYTES,
  validateEmbeddedResources
} from '../services/windowDesigner/embeddedResourceService';
import type { LingEmbeddedResource } from '../services/windowDesigner/types';

/**
 * 项目级内嵌资源清单编辑器（窗口设计器「窗口属性」区域）。
 *
 * 只负责渲染、局部状态与命令分发：清单增删改走 onChange（纯模型编辑），
 * 需要访问工作区/本机文件系统的动作（选择文件、选择文件夹、扫描目录、启用模块）
 * 一律经 CommandService 命令执行，组件不直接调用 fs 或工作区服务。
 */
export interface EmbeddedResourceEditorProps {
  resources: LingEmbeddedResource[];
  isDarkMode: boolean;
  /** 项目是否已启用 lingbuilder.resource.embed；未启用时构建会被阻断。 */
  moduleEnabled: boolean;
  onChange: (resources: LingEmbeddedResource[]) => void;
  /**
   * 四个需要访问工作区/本机能力的动作，返回中文结果说明。
   * 设计器宿主把它们分发到 designer.embeddedResources.* 命令，配置对话框宿主直接调用本地服务。
   */
  onSelectFiles: () => Promise<string>;
  onSelectFolder: () => Promise<string>;
  onScanDirectory: (directory: string) => Promise<string>;
  onEnableModule: () => Promise<string>;
  /** 由宿主控制的忙碌标记（宿主执行动作期间为真）。 */
  busy?: boolean;
}

const createEmptyResource = (): LingEmbeddedResource => ({ name: '', file: '', extract: false });

function describeCommandResult(result: unknown): string {
  if (typeof result === 'string' && result.trim()) return result;
  if (result === undefined || result === null) return '已完成。';
  return String(result);
}

export function EmbeddedResourceEditor({
  resources,
  isDarkMode,
  moduleEnabled,
  onChange,
  onSelectFiles,
  onSelectFolder,
  onScanDirectory,
  onEnableModule,
  busy = false
}: EmbeddedResourceEditorProps) {
  const [status, setStatus] = useState('');
  const [scanDirectory, setScanDirectory] = useState('');
  const busyAction = busy ? 'busy' : '';

  const inputClass = `w-full rounded border px-1.5 py-0.5 font-mono text-[11px] focus:outline-none focus:border-amber-500 ${
    isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
  }`;
  const buttonClass = `flex h-6 shrink-0 items-center gap-1 rounded border px-1.5 text-[10px] transition-colors disabled:cursor-wait disabled:opacity-50 ${
    isDarkMode ? 'border-[#3c3c44] bg-[#24242b] text-amber-400 hover:bg-[#303038]' : 'border-slate-300 bg-white text-amber-700 hover:bg-slate-100'
  }`;

  // 与服务端/生成器共用同一份校验，避免面板与构建期诊断出现两套口径。
  const problems = validateEmbeddedResources({ schemaVersion: 2, id: 'embedded-resource-panel', name: '', windows: [], embeddedResources: resources });
  const totalBytes = resources.reduce((total, resource) => total + Number((resource as { size?: number }).size || 0), 0);

  const updateResource = (index: number, fields: Partial<LingEmbeddedResource>) => {
    onChange(resources.map((resource, current) => (current === index ? { ...resource, ...fields } : resource)));
  };
  // 宿主可能自己回显状态（对话框底部有统一状态行）：这里只在宿主没给结果时兜底。
  const runHostAction = async (action: () => Promise<string>) => {
    setStatus('处理中…');
    try {
      const result = describeCommandResult(await action());
      setStatus(result.startsWith('已') || result.includes('。') ? result : result);
    } catch (error) {
      setStatus(`失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="space-y-1.5 px-2 py-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void runHostAction(onSelectFiles)}
          disabled={busyAction !== ''}
          title="选择本机文件（可多选），自动复制进项目源码根 resources 目录并回填逻辑名"
          aria-label="选择内嵌资源文件"
          className={buttonClass}
        >
          <FolderOpen className="h-3 w-3" />
          选择文件…
        </button>
        <button
          type="button"
          onClick={() => void runHostAction(onSelectFolder)}
          disabled={busyAction !== ''}
          title="选择本机文件夹，递归展开成多条并保留文件夹内的相对路径"
          aria-label="选择内嵌资源文件夹"
          className={buttonClass}
        >
          <FolderTree className="h-3 w-3" />
          选择文件夹…
        </button>
        <button
          type="button"
          onClick={() => onChange([...resources, createEmptyResource()])}
          disabled={resources.length >= EMBEDDED_RESOURCE_LIMIT}
          title="手工添加一条（源文件填工作区内相对路径，不复制文件）"
          aria-label="添加空内嵌资源条目"
          className={buttonClass}
        >
          <Plus className="h-3 w-3" />
          添加条目
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={scanDirectory}
          onChange={event => setScanDirectory(event.target.value)}
          placeholder="工作区内已有目录，如 assets"
          aria-label="内嵌资源扫描目录"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void runHostAction(() => onScanDirectory(scanDirectory.trim()))}
          disabled={busyAction !== '' || !scanDirectory.trim()}
          title="递归列出工作区内一个目录里可直接内嵌的文件（不复制文件）"
          aria-label="扫描内嵌资源目录"
          className={buttonClass}
        >
          <ScanSearch className="h-3 w-3" />
          扫描目录
        </button>
      </div>

      {!moduleEnabled && (
        <div className={`flex items-start gap-1.5 rounded border px-1.5 py-1 text-[10px] leading-4 ${
          isDarkMode ? 'border-amber-500/40 bg-amber-500/5 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'
        }`}>
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0">
            当前项目未启用「内嵌资源模块」，构建会因为缺少 资源_* 命令而阻断。
            <button
              type="button"
              onClick={() => void runHostAction(onEnableModule)}
              disabled={busyAction !== ''}
              aria-label="启用内嵌资源模块"
              className="ml-1 underline decoration-dotted underline-offset-2 disabled:opacity-50"
            >
              一键启用内嵌资源模块
            </button>
          </span>
        </div>
      )}

      {resources.length === 0 ? (
        <div className={`rounded border border-dashed px-2 py-2 text-[10px] leading-4 ${
          isDarkMode ? 'border-[#3c3c44] text-slate-500' : 'border-slate-300 text-slate-500'
        }`}>
          还没有内嵌资源。资源会在构建时以 RCDATA 打进 EXE，运行期用「资源_取字节集 / 资源_取文本」按逻辑名读取，全程不落盘。
        </div>
      ) : (
        <div className="space-y-1">
          <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_56px_24px] gap-1 px-0.5 text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            <span>逻辑名</span>
            <span>源文件（工作区内相对路径）</span>
            <span className="text-center">启动释放</span>
            <span />
          </div>
          {resources.map((resource, index) => (
            <div key={`${resource.name}\u0000${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_56px_24px] items-center gap-1">
              <input
                type="text"
                value={resource.name}
                onChange={event => updateResource(index, { name: event.target.value })}
                placeholder="assets/logo.png"
                spellCheck={false}
                aria-label={`内嵌资源逻辑名 ${index + 1}`}
                className={inputClass}
              />
              <input
                type="text"
                value={resource.file}
                onChange={event => updateResource(index, { file: event.target.value })}
                placeholder="src/resources/logo.png"
                spellCheck={false}
                aria-label={`内嵌资源源文件 ${index + 1}`}
                className={inputClass}
              />
              <label className="flex items-center justify-center" title="构建后启动时释放到 %TEMP%\lingbuilder-embedded\<工程ID>\ 下">
                <input
                  type="checkbox"
                  checked={resource.extract === true}
                  onChange={event => updateResource(index, { extract: event.target.checked })}
                  aria-label={`内嵌资源启动释放 ${index + 1}`}
                  className="h-3.5 w-3.5 accent-amber-500"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange(resources.filter((_, current) => current !== index))}
                title="删除这条内嵌资源"
                aria-label={`删除内嵌资源 ${index + 1}`}
                className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                  isDarkMode ? 'border-[#3c3c44] text-slate-400 hover:bg-[#303038] hover:text-red-400' : 'border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-red-500'
                }`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`text-[9px] leading-3 ${problems.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
        {problems.length > 0
          ? problems.join('；')
          : `共 ${resources.length} 条（上限 ${EMBEDDED_RESOURCE_LIMIT} 条），单个文件上限 ${Math.floor(EMBEDDED_RESOURCE_MAX_FILE_BYTES / 1024 / 1024)}MB${totalBytes > 0 ? `，本条清单已记录 ${(totalBytes / 1024 / 1024).toFixed(1)}MB` : ''}。`}
      </div>
      {status && (
        <div className={`text-[9px] leading-3 ${status.startsWith('失败') ? 'text-red-400' : 'text-slate-500'}`}>{status}</div>
      )}
    </div>
  );
}

export default EmbeddedResourceEditor;
