import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  Download,
  FileArchive,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import {
  InstalledModule,
  MarketModule,
  ModuleCppContribution,
  ModuleHistoryEntry,
  ModuleInstallPreview
} from '../services/modules/types';

interface ModuleInspectorProps {
  onAddLog: (log: string) => void;
  isDarkMode?: boolean;
  selectedModuleId?: string | null;
}

const PROJECT_ID = 'lingbuilder-ui-project';

export default function ModuleInspector({ onAddLog, isDarkMode = true, selectedModuleId: externalSelectedModuleId = null }: ModuleInspectorProps) {
  const [installedModules, setInstalledModules] = useState<InstalledModule[]>([]);
  const [marketModules, setMarketModules] = useState<MarketModule[]>([]);
  const [history, setHistory] = useState<ModuleHistoryEntry[]>([]);
  const [searchText, setSearchText] = useState('');
  const [moduleApiSearchText, setModuleApiSearchText] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(externalSelectedModuleId);
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('等待扫描模块。');
  const [packagePath, setPackagePath] = useState('');
  const [exportModuleDir, setExportModuleDir] = useState('');
  const [exportTargetPath, setExportTargetPath] = useState('');
  const [installPreview, setInstallPreview] = useState<ModuleInstallPreview | null>(null);
  const [enableAfterInstall, setEnableAfterInstall] = useState(true);
  const onAddLogRef = useRef(onAddLog);
  const refreshInFlightRef = useRef(false);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onAddLogRef.current = onAddLog;
  }, [onAddLog]);

  useEffect(() => {
    if (externalSelectedModuleId) setSelectedModuleId(externalSelectedModuleId);
  }, [externalSelectedModuleId]);

  const cardClass = isDarkMode
    ? 'bg-[#252526] border-white/10 text-slate-200'
    : 'bg-white border-slate-200 text-slate-800';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputClass = isDarkMode
    ? 'bg-[#1e1e1e] border-white/10 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';
  const actionButtonClass = 'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setIsLoading(true);
    setStatusText('正在读取本地模块、项目引用和市场索引...');
    try {
      const [installedRes, marketRes, historyRes] = await Promise.all([
        fetch(`/api/modules/installed?projectId=${encodeURIComponent(PROJECT_ID)}`).then(res => res.json()),
        fetch('/api/modules/market').then(res => res.json()),
        fetch('/api/modules/history').then(res => res.json())
      ]);
      setInstalledModules(Array.isArray(installedRes.modules) ? installedRes.modules : []);
      setMarketModules(Array.isArray(marketRes.modules) ? marketRes.modules : []);
      setHistory(Array.isArray(historyRes.history) ? historyRes.history : []);
      setStatusText('模块索引已刷新。');
      onAddLogRef.current(`> [${new Date().toLocaleTimeString()}] 【模块】已刷新模块索引。`);
    } catch (error) {
      setStatusText(`模块刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredInstalledModules = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return installedModules.filter(module => {
      const manifest = module.manifest;
      const text = [manifest.id, manifest.name, manifest.description, ...(manifest.tags || [])].join(' ').toLowerCase();
      const matchesSearch = !search || text.includes(search);
      const matchesCategory = categoryFilter === '全部' || manifest.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [installedModules, searchText, categoryFilter]);

  const filteredMarketModules = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return marketModules.filter(module => {
      const text = [module.id, module.name, module.description, ...(module.tags || [])].join(' ').toLowerCase();
      const matchesSearch = !search || text.includes(search);
      const matchesCategory = categoryFilter === '全部' || module.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [marketModules, searchText, categoryFilter]);

  const selectedModule = useMemo(() => {
    if (!selectedModuleId) return null;
    return installedModules.find(module => module.manifest.id === selectedModuleId) || null;
  }, [installedModules, selectedModuleId]);

  useEffect(() => {
    if (!selectedModule) return;
    window.setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [selectedModule]);

  const inspectModule = useCallback((moduleId: string) => {
    setSelectedModuleId(moduleId);
    setModuleApiSearchText('');
  }, []);

  const previewPackage = async (pathValue: string) => {
    if (!pathValue.trim()) {
      setStatusText('请先填写或拖入 .lbmod 模块包路径。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/package/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packagePath: pathValue.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块包预览失败');
      setInstallPreview(result.preview);
      setStatusText(result.preview.canInstall ? '模块包预览通过，等待确认安装。' : '模块包预览未通过，请查看诊断。');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块包】已完成安装预览：${pathValue}`);
    } catch (error) {
      setStatusText(`模块包预览失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const installPreviewPackage = async () => {
    if (!installPreview) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/package/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId: installPreview.previewId,
          projectId: PROJECT_ID,
          enableForProject: enableAfterInstall
        })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块安装失败');
      setInstallPreview(null);
      setPackagePath('');
      setStatusText(`模块 ${result.result.moduleName} 已安装。`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】已安装 ${result.result.moduleName}。`);
      window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed'));
      await refresh();
    } catch (error) {
      setStatusText(`模块安装失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProjectModule = async (module: InstalledModule) => {
    const enabled = Boolean(module.isEnabledForProject);
    const endpoint = enabled ? '/api/modules/project/disable' : '/api/modules/project/enable';
    setIsLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: PROJECT_ID, moduleId: module.manifest.id })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '项目模块状态更新失败');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】${enabled ? '禁用' : '启用'} ${module.manifest.name}。`);
      window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed'));
      await refresh();
    } catch (error) {
      setStatusText(`项目模块状态更新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const uninstallModule = async (module: InstalledModule) => {
    if (module.isBuiltin) {
      setStatusText('内置模块不能卸载。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: module.manifest.id })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块卸载失败');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】已卸载 ${module.manifest.name}。`);
      window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed'));
      await refresh();
    } catch (error) {
      setStatusText(`模块卸载失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportModulePackage = async () => {
    if (!exportModuleDir.trim() || !exportTargetPath.trim()) {
      setStatusText('请填写模块目录和 .lbmod 导出路径。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/package/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleDir: exportModuleDir.trim(), targetPath: exportTargetPath.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块包导出失败');
      setStatusText('模块包已导出。');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块包】已导出 ${exportTargetPath.trim()}。`);
      await refresh();
    } catch (error) {
      setStatusText(`模块包导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onDropPackage = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] as File & { path?: string };
    const nextPath = file?.path || file?.name || '';
    if (nextPath) {
      setPackagePath(nextPath);
      previewPackage(nextPath);
    }
  };

  return (
    <div
      className={`h-full min-w-0 flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e] text-slate-200' : 'bg-slate-50 text-slate-900'}`}
      onDragOver={event => event.preventDefault()}
      onDrop={onDropPackage}
    >
      <div className={`min-w-0 border-b px-3 py-3 ${isDarkMode ? 'border-white/10 bg-[#252526]' : 'border-slate-200 bg-white'}`}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={18} className="text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">模块生态</div>
              <div className={`text-xs truncate ${subtleClass}`}>{statusText}</div>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className={`h-8 shrink-0 whitespace-nowrap px-2.5 inline-flex items-center gap-1.5 rounded border border-sky-500/40 text-sky-300 hover:bg-sky-500/10 hover:text-white ${actionButtonClass}`}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-1 gap-2">
          <div className={`h-8 min-w-0 px-2 flex items-center gap-2 rounded border ${inputClass}`}>
            <Search size={14} />
            <input
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none text-xs"
              placeholder="搜索模块、说明、标签..."
            />
          </div>
          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className={`h-8 rounded border px-2 text-xs outline-none ${inputClass}`}
          >
            {['全部', '界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'].map(category => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto p-3 space-y-3">
        <section className={`min-w-0 rounded-md border ${cardClass}`}>
          <Header icon={<Package size={16} />} title="本地模块" desc={`${installedModules.length} 个模块已索引，勾选状态代表当前项目引用。`} />
          <div className="divide-y divide-white/10">
            {filteredInstalledModules.length === 0 ? (
              <Empty text="没有匹配的本地模块。" />
            ) : filteredInstalledModules.map(module => (
              <ModuleRow
                key={module.manifest.id}
                module={module}
                isDarkMode={isDarkMode}
                onToggle={() => toggleProjectModule(module)}
                onUninstall={() => uninstallModule(module)}
                onInspect={() => inspectModule(module.manifest.id)}
              />
            ))}
          </div>
        </section>

        {selectedModule && (
          <ModuleDetailPanel
            ref={detailPanelRef}
            module={selectedModule}
            isDarkMode={isDarkMode}
            searchText={moduleApiSearchText}
            onSearchTextChange={setModuleApiSearchText}
            onClose={() => setSelectedModuleId(null)}
          />
        )}

        <section className={`min-w-0 rounded-md border ${cardClass}`}>
          <Header icon={<FileArchive size={16} />} title="拖入安装 .lbmod" desc="支持拖入模块包，或手动填写本机路径后预览安装。" />
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <input
              value={packagePath}
              onChange={event => setPackagePath(event.target.value)}
              className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`}
              placeholder="C:\\path\\module.lbmod"
            />
            <button onClick={() => previewPackage(packagePath)} className={`h-9 w-full px-3 rounded bg-sky-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500 ${actionButtonClass}`}>
              <ShieldCheck size={14} />
              预览安装
            </button>
          </div>
        </section>

        <section className={`min-w-0 rounded-md border ${cardClass}`}>
          <Header icon={<Archive size={16} />} title="模块包制作" desc="把包含 lingbuilder.module.json 的模块目录导出为标准 .lbmod 包。" />
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <input value={exportModuleDir} onChange={event => setExportModuleDir(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder="模块目录" />
            <input value={exportTargetPath} onChange={event => setExportTargetPath(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder="导出路径，例如 D:\\demo.lbmod" />
            <button onClick={exportModulePackage} className={`h-9 w-full px-3 rounded bg-emerald-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-emerald-500 ${actionButtonClass}`}>
              <Upload size={14} />
              导出
            </button>
          </div>
        </section>

        <section className={`min-w-0 rounded-md border ${cardClass}`}>
          <Header icon={<Store size={16} />} title="模块市场" desc="从本地、官方或企业市场源读取模块索引；安装仍走同一套预览确认流程。" />
          <div className="divide-y divide-white/10">
            {filteredMarketModules.length === 0 ? (
              <Empty text="未发现市场模块。可在 .lingbuilder/module-market.json 中添加本地索引。" />
            ) : filteredMarketModules.map(module => (
              <div key={`${module.sourceId}-${module.id}`} className="min-w-0 p-3 flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold leading-5">{module.name}</div>
                  <div className={`break-all text-[11px] leading-4 ${subtleClass}`}>{module.id} · {module.version} · {module.category}</div>
                  <div className={`mt-1 break-words text-xs leading-5 ${subtleClass}`}>{module.description}</div>
                </div>
                <button
                  disabled={!module.packagePath}
                  onClick={() => module.packagePath && previewPackage(module.packagePath)}
                  className={`h-8 w-full px-3 rounded border border-emerald-500/40 text-emerald-300 text-xs inline-flex items-center justify-center gap-2 hover:bg-emerald-500/10 hover:text-emerald-100 ${actionButtonClass}`}
                >
                  <Download size={14} />
                  {module.installedVersion ? '重新安装' : '安装'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className={`min-w-0 rounded-md border ${cardClass}`}>
          <Header icon={<Check size={16} />} title="操作历史" desc="记录安装、卸载、启用、禁用和导出动作。" />
          <div className="divide-y divide-white/10">
            {history.length === 0 ? (
              <Empty text="暂无模块操作历史。" />
            ) : history.slice(0, 12).map(item => (
              <div key={item.id} className="p-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="break-words text-xs font-semibold">{item.summary}</span>
                  <span className={`text-[10px] ${subtleClass}`}>{new Date(item.time).toLocaleString()}</span>
                </div>
                <div className={`mt-1 text-[11px] whitespace-pre-wrap ${subtleClass}`}>{item.details}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {installPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-md border shadow-xl ${cardClass}`}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">模块安装预览</div>
                <div className={`text-xs ${subtleClass}`}>{installPreview.packagePath}</div>
              </div>
              <button onClick={() => setInstallPreview(null)} className={`p-1 rounded hover:bg-white/10 hover:text-white ${actionButtonClass}`}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <PreviewLine label="模块" value={installPreview.manifest ? `${installPreview.manifest.name} (${installPreview.manifest.id})` : '未识别'} />
              <PreviewLine label="版本" value={installPreview.manifest?.version || '-'} />
              <PreviewLine label="文件" value={`${installPreview.fileCount} 个文件，${formatBytes(installPreview.totalBytes)}`} />
              <PreviewLine label="SHA256" value={installPreview.sha256} />
              <PreviewLine label="升级" value={installPreview.willUpgrade ? `将替换现有版本 ${installPreview.existingVersion}` : '否'} />
              <div>
                <div className="font-semibold mb-1">安全检查</div>
                <div className={`rounded border p-2 whitespace-pre-wrap ${installPreview.canInstall ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}>
                  {installPreview.diagnostics.length ? installPreview.diagnostics.join('\n') : '检查通过，可以安装。'}
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={enableAfterInstall} onChange={event => setEnableAfterInstall(event.target.checked)} />
                安装完成后加入当前项目
              </label>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setInstallPreview(null)} className={`h-8 px-3 rounded border border-white/15 text-xs hover:bg-white/10 hover:text-white ${actionButtonClass}`}>取消</button>
              <button
                disabled={!installPreview.canInstall || isLoading}
                onClick={installPreviewPackage}
                className={`h-8 px-3 rounded bg-sky-600 text-white text-xs hover:bg-sky-500 ${actionButtonClass}`}
              >
                确认安装
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="min-w-0 p-3 border-b border-white/10 flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-sky-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] leading-4 text-slate-500">{desc}</div>
      </div>
    </div>
  );
}

function ModuleRow({ module, isDarkMode, onToggle, onUninstall, onInspect }: {
  key?: React.Key;
  module: InstalledModule;
  isDarkMode: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  onInspect: () => void;
}) {
  const manifest = module.manifest;
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const capabilityCount = (manifest.contributes?.commands?.length || 0)
    + (manifest.contributes?.types?.length || 0)
    + (manifest.contributes?.designerControls?.length || 0);

  return (
    <div className="min-w-0 p-3 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-semibold leading-5">{manifest.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">{manifest.category}</span>
          {module.isBuiltin && <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">内置</span>}
          {module.isEnabledForProject && <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">项目已引用</span>}
        </div>
        <div className={`mt-1 break-all text-[11px] leading-4 ${subtleClass}`}>{manifest.id} · {manifest.version} · 能力 {capabilityCount} 项</div>
        <div className={`mt-1 break-words text-xs leading-5 ${subtleClass}`}>{manifest.description}</div>
        {module.diagnostics.length > 0 && (
          <div className="mt-2 text-[11px] text-red-300 whitespace-pre-wrap">{module.diagnostics.join('\n')}</div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onInspect} className="h-8 min-w-0 flex-1 px-1.5 rounded border border-violet-500/40 text-violet-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-violet-500/10 hover:text-white whitespace-nowrap">
          <Search size={14} />
          接口
        </button>
        <button onClick={onToggle} className="h-8 min-w-0 flex-1 px-1.5 rounded border border-sky-500/40 text-sky-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-sky-500/10 hover:text-white whitespace-nowrap">
          {module.isEnabledForProject ? <X size={14} /> : <Check size={14} />}
          {module.isEnabledForProject ? '禁用' : '启用'}
        </button>
        <button onClick={onUninstall} disabled={module.isBuiltin} className="h-8 min-w-0 flex-1 px-1.5 rounded border border-red-500/40 text-red-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap">
          <Trash2 size={14} />
          卸载
        </button>
      </div>
    </div>
  );
}

const ModuleDetailPanel = React.forwardRef<HTMLElement, {
  module: InstalledModule;
  isDarkMode: boolean;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onClose: () => void;
}>(function ModuleDetailPanel({
  module,
  isDarkMode,
  searchText,
  onSearchTextChange,
  onClose
}, ref) {
  const manifest = module.manifest;
  const contributes = manifest.contributes || {};
  const commands = contributes.commands || [];
  const types = contributes.types || [];
  const snippets = contributes.snippets || [];
  const designerControls = contributes.designerControls || [];
  const docs = contributes.docs || [];
  const cpp = contributes.cpp;
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const panelClass = isDarkMode
    ? 'bg-[#252526] border-white/10 text-slate-200'
    : 'bg-white border-slate-200 text-slate-800';
  const inputClass = isDarkMode
    ? 'bg-[#1e1e1e] border-white/10 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredCommands = commands.filter(command => {
    if (!normalizedSearch) return true;
    return [
      command.name,
      command.signature,
      command.description,
      command.returnType,
      command.cppRuntimeName
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
  });
  const visibleCommands = filteredCommands.slice(0, 80);

  return (
    <section ref={ref} className={`min-w-0 rounded-md border ${panelClass}`}>
      <div className="min-w-0 p-3 border-b border-white/10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-words text-sm font-semibold">{manifest.name} 接口能力</span>
            <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">{manifest.category}</span>
            {module.isEnabledForProject && <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">项目已引用</span>}
          </div>
          <div className={`mt-1 break-all text-[11px] leading-4 ${subtleClass}`}>{manifest.id} · {manifest.version}</div>
          <div className={`mt-1 break-words text-xs leading-5 ${subtleClass}`}>{manifest.description}</div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" title="关闭接口详情">
          <X size={16} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <CapabilityStat label="命令接口" value={commands.length} />
          <CapabilityStat label="类型" value={types.length} />
          <CapabilityStat label="设计器控件" value={designerControls.length} />
          <CapabilityStat label="代码片段" value={snippets.length} />
        </div>

        <div className={`h-8 min-w-0 px-2 flex items-center gap-2 rounded border ${inputClass}`}>
          <Search size={14} />
          <input
            value={searchText}
            onChange={event => onSearchTextChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none text-xs"
            placeholder="搜索接口名、签名、返回值、C++ 运行时名..."
          />
        </div>

        <CapabilityBlock
          title={`命令接口 ${filteredCommands.length}/${commands.length}`}
          emptyText="该模块未贡献命令接口。"
          footer={filteredCommands.length > visibleCommands.length ? `仅显示前 ${visibleCommands.length} 项，请用搜索缩小范围。` : ''}
        >
          {visibleCommands.map((command, index) => (
            <div key={`${command.name}:${command.signature}:${index}`} className={`rounded border p-2 ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="break-all text-xs font-semibold text-cyan-300">{command.name}</span>
                {command.returnType && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">{command.returnType}</span>}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-slate-300">{command.signature}</div>
              <div className={`mt-1 break-words text-[11px] leading-4 ${subtleClass}`}>{command.description}</div>
              {command.cppRuntimeName && <div className={`mt-1 break-all text-[10px] ${subtleClass}`}>C++：{command.cppRuntimeName}</div>}
            </div>
          ))}
        </CapabilityBlock>

        <CapabilityBlock title={`类型 ${types.length}`} emptyText="该模块未贡献类型。">
          {types.map(type => (
            <div key={type.name} className={`rounded border p-2 ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-xs font-semibold text-amber-300">{type.name}</div>
              <div className={`mt-1 text-[11px] ${subtleClass}`}>{type.description}</div>
              {type.cppType && <div className={`mt-1 break-all font-mono text-[10px] ${subtleClass}`}>{type.cppType}</div>}
            </div>
          ))}
        </CapabilityBlock>

        <CapabilityBlock title={`设计器控件 ${designerControls.length}`} emptyText="该模块未贡献设计器控件。">
          {designerControls.map(control => (
            <div key={control.type} className={`rounded border p-2 ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-xs font-semibold text-violet-300">{control.label}</div>
              <div className={`mt-1 break-all font-mono text-[10px] ${subtleClass}`}>{control.type}</div>
              {control.events?.length ? (
                <div className={`mt-1 text-[10px] ${subtleClass}`}>事件：{control.events.map(event => `${event.label}(${event.handlerPattern})`).join('、')}</div>
              ) : null}
            </div>
          ))}
        </CapabilityBlock>

        <CppContributionBlock cpp={cpp} docs={docs} isDarkMode={isDarkMode} />
      </div>
    </section>
  );
});

function CapabilityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-white/10 bg-black/10 px-2 py-1.5">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function CapabilityBlock({
  title,
  emptyText,
  footer,
  children
}: {
  title: string;
  emptyText: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-200">{title}</div>
      {hasChildren ? <div className="space-y-2">{children}</div> : <div className="rounded border border-white/10 p-3 text-xs text-slate-500">{emptyText}</div>}
      {footer && <div className="mt-2 text-[10px] text-slate-500">{footer}</div>}
    </div>
  );
}

function CppContributionBlock({ cpp, docs, isDarkMode }: { cpp?: ModuleCppContribution; docs: Array<{ title: string; path: string }>; isDarkMode: boolean }) {
  const rows = [
    ['头文件', cpp?.headers || []],
    ['源码', cpp?.sources || []],
    ['库文件', cpp?.libs || []],
    ['运行时 DLL', cpp?.runtimeFiles || []],
    ['包含目录', cpp?.includeDirs || []],
    ['宏定义', cpp?.defines || []],
    ['文档', docs.map(doc => `${doc.title}：${doc.path}`)]
  ] as Array<[string, string[]]>;
  const hasAny = rows.some(([, values]) => values.length > 0);
  const rowClass = isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-slate-50';
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-200">C++ 构建与文档</div>
      {!hasAny ? (
        <div className="rounded border border-white/10 p-3 text-xs text-slate-500">该模块未声明 C++ 依赖或文档。</div>
      ) : (
        <div className="space-y-2">
          {rows.filter(([, values]) => values.length > 0).map(([label, values]) => (
            <div key={label} className={`rounded border p-2 ${rowClass}`}>
              <div className="mb-1 text-[11px] font-semibold text-slate-300">{label}</div>
              {values.map(value => <div key={value} className="break-all font-mono text-[10px] text-slate-400">{value}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-6 text-center text-xs text-slate-500">{text}</div>;
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
