import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileArchive,
  Layers,
  LockKeyhole,
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
  ModuleHistoryEntry,
  ModuleInstallPreview
} from '../services/modules/types';
import ModulePublicInfoDialog from './ModulePublicInfoDialog';

type ModuleSectionId = 'installed' | 'packageInstall' | 'packageExport' | 'developer' | 'market' | 'history';

interface ModuleInspectorProps {
  onAddLog: (log: string) => void;
  projectId: string;
  isDarkMode?: boolean;
  selectedModuleId?: string | null;
}

export function formatModuleOperationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const chineseStart = raw.search(/[\u3400-\u9fff]/u);
  if (chineseStart >= 0) return raw.slice(chineseStart).trim();
  if (/fetch failed|failed to fetch|econnrefused|network error|cloud-modules/iu.test(raw)) {
    return '无法连接模块授权服务，请确认 LingBuilder 云端 API 已启动，然后重新登录账号再试。';
  }
  if (/timeout|timed out|abort/iu.test(raw)) return '模块服务响应超时，请检查网络后重试。';
  return '模块操作失败，请稍后重试；如果问题持续，请检查云端 API 和登录状态。';
}

export default function ModuleInspector({ projectId, onAddLog, isDarkMode = true, selectedModuleId: externalSelectedModuleId = null }: ModuleInspectorProps) {
  const [installedModules, setInstalledModules] = useState<InstalledModule[]>([]);
  const [marketModules, setMarketModules] = useState<MarketModule[]>([]);
  const [history, setHistory] = useState<ModuleHistoryEntry[]>([]);
  const [commerceProducts, setCommerceProducts] = useState<any[]>([]);
  const [showAdvancedApi, setShowAdvancedApi] = useState(() => window.localStorage.getItem('lingbuilder.modules.showAdvancedApi') === 'true');
  const [searchText, setSearchText] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(externalSelectedModuleId);
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('等待扫描模块。');
  const [packagePath, setPackagePath] = useState('');
  const [exportModuleDir, setExportModuleDir] = useState('');
  const [exportTargetPath, setExportTargetPath] = useState('');
  const [developerOutDir, setDeveloperOutDir] = useState('');
  const [developerTemplate, setDeveloperTemplate] = useState('cpp-source');
  const [developerValidatePath, setDeveloperValidatePath] = useState('');
  const [developerMigrateConfig, setDeveloperMigrateConfig] = useState('');
  const [developerMigrateOut, setDeveloperMigrateOut] = useState('');
  const [developerMarketPackages, setDeveloperMarketPackages] = useState('');
  const [developerMarketOut, setDeveloperMarketOut] = useState('');
  const [installPreview, setInstallPreview] = useState<ModuleInstallPreview | null>(null);
  const [enableAfterInstall, setEnableAfterInstall] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<ModuleSectionId, boolean>>({
    installed: true,
    packageInstall: false,
    packageExport: false,
    developer: false,
    market: false,
    history: false
  });
  const onAddLogRef = useRef(onAddLog);
  const refreshRequestIdRef = useRef(0);

  useEffect(() => {
    onAddLogRef.current = onAddLog;
  }, [onAddLog]);

  useEffect(() => {
    setSelectedModuleId(externalSelectedModuleId);
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
    const requestId = ++refreshRequestIdRef.current;
    setIsLoading(true);
    setStatusText(`正在读取项目 ${projectId} 的模块引用和市场索引...`);
    try {
      const [installedRes, marketRes, historyRes] = await Promise.all([
        fetch(`/api/modules/installed?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()),
        fetch(`/api/modules/market?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()),
        fetch(`/api/modules/history?projectId=${encodeURIComponent(projectId)}`).then(res => res.json())
      ]);
      if (requestId !== refreshRequestIdRef.current) return;
      if (!installedRes.ok) throw new Error(installedRes.error || '项目模块读取失败');
      setInstalledModules(Array.isArray(installedRes.modules) ? installedRes.modules : []);
      setMarketModules(Array.isArray(marketRes.modules) ? marketRes.modules : []);
      setHistory(Array.isArray(historyRes.history) ? historyRes.history : []);
      if (window.lingBuilder?.cloudAccount?.moduleCatalog) {
        const commerce = await window.lingBuilder.cloudAccount.moduleCatalog().catch(() => null);
        if (requestId === refreshRequestIdRef.current) setCommerceProducts(Array.isArray(commerce?.products) ? commerce.products : []);
      }
      setStatusText('模块索引已刷新。');
      onAddLogRef.current(`> [${new Date().toLocaleTimeString()}] 【模块】已刷新模块索引。`);
    } catch (error) {
      if (requestId !== refreshRequestIdRef.current) return;
      setStatusText(`模块刷新失败：${formatModuleOperationError(error)}`);
    } finally {
      if (requestId === refreshRequestIdRef.current) setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setInstalledModules([]);
    setMarketModules([]);
    setHistory([]);
    setInstallPreview(null);
    setSelectedModuleId(null);
    refresh();
  }, [projectId, refresh]);

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

  const inspectModule = useCallback((moduleId: string) => {
    setSelectedModuleId(moduleId);
  }, []);

  const toggleSection = useCallback((sectionId: ModuleSectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const previewPackage = async (pathValue: string) => {
    if (!pathValue.trim()) {
      setStatusText('请先填写或拖入 .lbmod 模块包路径。');
      return;
    }
    if (!isAllowedWorkspacePath(pathValue, '.lingbuilder/module-packages')) {
      setStatusText('模块包必须使用 .lingbuilder/module-packages 下的工作区相对路径。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/package/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, packagePath: pathValue.trim() })
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
          projectId,
          enableForProject: enableAfterInstall
        })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块安装失败');
      setInstallPreview(null);
      setPackagePath('');
      const compatibilityMessage = Array.isArray(result.messages) ? result.messages.join('；') : '';
      setStatusText(`模块 ${result.result.moduleName} 已安装。${compatibilityMessage ? ` ${compatibilityMessage}` : ''}`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】已安装 ${result.result.moduleName}。`);
      if (compatibilityMessage) onAddLog(`> [${new Date().toLocaleTimeString()}] 【构建配置】${compatibilityMessage}`);
      dispatchModulesChanged(projectId, result.result.moduleId, 'project');
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
      if (!enabled && (module.manifest.id === 'lingbuilder.new_emoji.ui' || commerceProducts.some(product => product.moduleId === module.manifest.id))) {
        const cloudModules = window.lingBuilder?.cloudAccount;
        if (!cloudModules?.authorizeModule) throw new Error('收费模块必须在 LingBuilder 桌面端登录后使用。');
        const authorization = await cloudModules.authorizeModule(module.manifest.id);
        if (!authorization?.ok) throw new Error((authorization as { error?: string })?.error || '模块授权检查失败，请稍后重试。');
        if (!authorization?.status?.allowed) throw new Error(authorization?.status?.reason || '当前账号没有该模块的有效权益。');
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleId: module.manifest.id })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '项目模块状态更新失败');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】${enabled ? '禁用' : '启用'} ${module.manifest.name}。`);
      const compatibilityMessage = Array.isArray(result.messages) ? result.messages.join('；') : '';
      if (compatibilityMessage) {
        setStatusText(compatibilityMessage);
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【构建配置】${compatibilityMessage}`);
      }
      dispatchModulesChanged(projectId, module.manifest.id, 'project');
      await refresh();
    } catch (error) {
      setStatusText(`项目模块状态更新失败：${formatModuleOperationError(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseModule = async (moduleId: string, provider: 'wechat'|'alipay') => {
    const product = commerceProducts.find(item => item.moduleId === moduleId);
    const offer = product?.offers?.[0];
    if (!offer) { setStatusText('当前模块尚未配置可购买报价。'); return; }
    const cloudModules = window.lingBuilder?.cloudAccount;
    if (!cloudModules?.createModuleOrder) { setStatusText('请在 LingBuilder 桌面端登录后购买模块。'); return; }
    setIsLoading(true);
    try {
      const result = await cloudModules.createModuleOrder({ offerId: offer.id, provider, idempotencyKey: crypto.randomUUID() });
      if (!result?.order?.paymentUrl) throw new Error('支付渠道未返回付款地址。');
      window.open(result.order.paymentUrl, '_blank', 'noopener,noreferrer');
      setStatusText(`已创建${provider === 'wechat' ? '微信支付' : '支付宝'}订单，请在新窗口完成付款后刷新模块状态。`);
    } catch (error) { setStatusText(`创建模块订单失败：${error instanceof Error ? error.message : String(error)}`); }
    finally { setIsLoading(false); }
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
        body: JSON.stringify({ projectId, moduleId: module.manifest.id })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块卸载失败');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】已卸载 ${module.manifest.name}。`);
      dispatchModulesChanged(projectId, module.manifest.id, 'workspace');
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
    if (!isAllowedWorkspacePath(exportModuleDir, '.lingbuilder/module-build') || !isAllowedWorkspacePath(exportTargetPath, '.lingbuilder/module-packages')) {
      setStatusText('模块目录和导出文件必须分别位于 .lingbuilder/module-build 与 .lingbuilder/module-packages。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/package/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleDir: exportModuleDir.trim(), targetPath: exportTargetPath.trim() })
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

  const createDeveloperTemplate = async () => {
    if (!developerOutDir.trim()) {
      setStatusText('请填写模块模板输出目录。');
      return;
    }
    if (!isAllowedWorkspacePath(developerOutDir, '.lingbuilder/module-build')) {
      setStatusText('模块模板必须输出到 .lingbuilder/module-build 下的工作区相对路径。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/developer/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, template: developerTemplate, outDir: developerOutDir.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块模板创建失败');
      setStatusText(`已创建模块模板：${result.manifest.name}`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块开发】已创建模板 ${result.manifest.id}。`);
    } catch (error) {
      setStatusText(`模块模板创建失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const validateDeveloperModule = async () => {
    if (!developerValidatePath.trim()) {
      setStatusText('请填写要校验的模块目录或 manifest 路径。');
      return;
    }
    if (!isAllowedWorkspacePath(developerValidatePath, '.lingbuilder/module-build')) {
      setStatusText('只能校验 .lingbuilder/module-build 下的模块目录。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/developer/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, modulePath: developerValidatePath.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块校验失败');
      const diagnostics = result.result?.diagnostics || [];
      setStatusText(diagnostics.length ? `模块校验未通过：${diagnostics.join('；')}` : '模块校验通过。');
    } catch (error) {
      setStatusText(`模块校验失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const migrateDeveloperCpp = async () => {
    if (!developerMigrateConfig.trim() || !developerMigrateOut.trim()) {
      setStatusText('请填写 C++ 迁移配置和输出目录。');
      return;
    }
    if (!isAllowedWorkspacePath(developerMigrateConfig) || !isAllowedWorkspacePath(developerMigrateOut, '.lingbuilder/module-build')) {
      setStatusText('迁移配置必须是工作区相对路径，输出目录必须位于 .lingbuilder/module-build。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/developer/migrate-cpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, configPath: developerMigrateConfig.trim(), outDir: developerMigrateOut.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || 'C++ 模块迁移失败');
      setStatusText(`已生成 C++ 迁移模块：${result.manifest.name}`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块开发】已迁移 C++ 模块 ${result.manifest.id}。`);
    } catch (error) {
      setStatusText(`C++ 模块迁移失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createDeveloperMarketIndex = async () => {
    const packagePaths = developerMarketPackages.split(/\r?\n/u).map(item => item.trim()).filter(Boolean);
    if (packagePaths.length === 0 || !developerMarketOut.trim()) {
      setStatusText('请填写 .lbmod 路径列表和市场索引输出路径。');
      return;
    }
    if (packagePaths.some(item => !isAllowedWorkspacePath(item, '.lingbuilder/module-packages'))
      || !isAllowedWorkspacePath(developerMarketOut, '.lingbuilder')
      || normalizeWorkspacePath(developerMarketOut).split('/').length !== 2
      || !developerMarketOut.trim().toLowerCase().endsWith('.json')) {
      setStatusText('市场包必须位于 .lingbuilder/module-packages，索引必须是 .lingbuilder 下的 JSON 文件。');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/developer/market-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, packagePaths, outPath: developerMarketOut.trim() })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '模块市场索引生成失败');
      setStatusText('模块市场索引已生成。');
    } catch (error) {
      setStatusText(`模块市场索引生成失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openDeveloperManual = async () => {
    try {
      const docsApi = window.lingBuilder?.docs;
      if (docsApi?.openModuleManual) {
        const result = await docsApi.openModuleManual();
        if (result) throw new Error(result);
        setStatusText('已打开模块开发手册。');
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块开发】已打开模块开发手册。`);
        return;
      }
      setStatusText('请在 LingBuilder 桌面版中打开模块开发手册。');
    } catch (error) {
      setStatusText(`打开模块开发手册失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onDropPackage = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] as File & { path?: string };
    const nextPath = file?.path || file?.name || '';
    if (nextPath) {
      if (!isAllowedWorkspacePath(nextPath, '.lingbuilder/module-packages')) {
        if (!file?.path || !window.lingBuilder?.modules?.importPackage) {
          setStatusText('网页版只能预览工作区 .lingbuilder/module-packages 下的模块包；桌面版可直接拖入本机 .lbmod。');
          return;
        }
        setStatusText('正在把模块包安全复制到当前工作区…');
        const imported = await window.lingBuilder.modules.importPackage(file.path);
        if (!imported.ok || !imported.relativePath) {
          setStatusText(`模块包导入失败：${imported.error || '未返回工作区路径'}`);
          return;
        }
        setPackagePath(imported.relativePath);
        await previewPackage(imported.relativePath);
        return;
      }
      setPackagePath(nextPath);
      await previewPackage(nextPath);
    }
  };

  return (
    <div
      className={`h-full min-w-0 flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e] text-slate-200' : 'bg-slate-50 text-slate-900'}`}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { void onDropPackage(event); }}
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
          <label className={`flex min-h-8 items-center gap-2 rounded border px-2 text-xs ${inputClass}`}>
            <input type="checkbox" checked={showAdvancedApi} onChange={event => {
              const value = event.target.checked;
              setShowAdvancedApi(value);
              window.localStorage.setItem('lingbuilder.modules.showAdvancedApi', String(value));
              window.dispatchEvent(new CustomEvent('lingbuilder-module-api-visibility-changed', { detail: { showAdvancedApi: value } }));
            }} />
            显示底层高级 API（NE_EU_*）
          </label>
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
        <CollapsibleSection
          className={cardClass}
          icon={<Package size={16} />}
          title="本地模块"
          desc={`${installedModules.length} 个模块已索引，勾选状态代表当前项目引用。`}
          isOpen={expandedSections.installed}
          onToggle={() => toggleSection('installed')}
        >
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
                commerce={commerceProducts.find(product => product.moduleId === module.manifest.id)}
                onPurchase={provider => purchaseModule(module.manifest.id, provider)}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<FileArchive size={16} />}
          title="安装 .lbmod"
          desc="使用 .lingbuilder/module-packages 下的工作区相对路径预览安装。"
          isOpen={expandedSections.packageInstall}
          onToggle={() => toggleSection('packageInstall')}
        >
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <input
              value={packagePath}
              onChange={event => setPackagePath(event.target.value)}
              className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`}
              placeholder=".lingbuilder/module-packages/demo.lbmod"
            />
            <button onClick={() => previewPackage(packagePath)} className={`h-9 w-full px-3 rounded bg-sky-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500 ${actionButtonClass}`}>
              <ShieldCheck size={14} />
              预览安装
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Archive size={16} />}
          title="模块包制作"
          desc="把包含 lingbuilder.module.json 的模块目录导出为标准 .lbmod 包。"
          isOpen={expandedSections.packageExport}
          onToggle={() => toggleSection('packageExport')}
        >
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <input value={exportModuleDir} onChange={event => setExportModuleDir(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            <input value={exportTargetPath} onChange={event => setExportTargetPath(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-packages/demo.lbmod" />
            <button onClick={exportModulePackage} className={`h-9 w-full px-3 rounded bg-emerald-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-emerald-500 ${actionButtonClass}`}>
              <Upload size={14} />
              导出
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Upload size={16} />}
          title="模块开发者中心"
          desc="创建 v2 模块模板、迁移 C++ 库、校验模块和生成本地市场索引。"
          isOpen={expandedSections.developer}
          onToggle={() => toggleSection('developer')}
        >
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <button onClick={openDeveloperManual} className={`h-9 w-full px-3 rounded border border-amber-500/50 text-amber-200 text-xs inline-flex items-center justify-center gap-2 hover:bg-amber-500/10 hover:text-amber-100 ${actionButtonClass}`}>
              <BookOpen size={14} />
              打开模块开发手册
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
              <select value={developerTemplate} onChange={event => setDeveloperTemplate(event.target.value)} className={`h-9 rounded border px-2 text-xs outline-none ${inputClass}`}>
                {['cpp-source', 'dll-lib', 'ui-control', 'command-only', 'empty'].map(item => <option key={item}>{item}</option>)}
              </select>
              <input value={developerOutDir} onChange={event => setDeveloperOutDir(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            </div>
            <button onClick={createDeveloperTemplate} className={`h-9 w-full px-3 rounded bg-sky-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500 ${actionButtonClass}`}>
              <Package size={14} />
              创建模块模板
            </button>
            <input value={developerValidatePath} onChange={event => setDeveloperValidatePath(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            <button onClick={validateDeveloperModule} className={`h-9 w-full px-3 rounded border border-emerald-500/40 text-emerald-300 text-xs inline-flex items-center justify-center gap-2 hover:bg-emerald-500/10 ${actionButtonClass}`}>
              <ShieldCheck size={14} />
              校验模块
            </button>
            <input value={developerMigrateConfig} onChange={event => setDeveloperMigrateConfig(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder="config/module-migration.json" />
            <input value={developerMigrateOut} onChange={event => setDeveloperMigrateOut(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            <button onClick={migrateDeveloperCpp} className={`h-9 w-full px-3 rounded bg-violet-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-violet-500 ${actionButtonClass}`}>
              <FileArchive size={14} />
              迁移 C++ 库
            </button>
            <textarea value={developerMarketPackages} onChange={event => setDeveloperMarketPackages(event.target.value)} className={`min-h-20 min-w-0 rounded border px-3 py-2 text-xs outline-none ${inputClass}`} placeholder="每行一个 .lingbuilder/module-packages/*.lbmod" />
            <input value={developerMarketOut} onChange={event => setDeveloperMarketOut(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-market.json" />
            <button onClick={createDeveloperMarketIndex} className={`h-9 w-full px-3 rounded border border-sky-500/40 text-sky-300 text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500/10 ${actionButtonClass}`}>
              <Store size={14} />
              生成市场索引
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Store size={16} />}
          title="模块市场"
          desc="从本地、官方或企业市场源读取模块索引；安装仍走同一套预览确认流程。"
          isOpen={expandedSections.market}
          onToggle={() => toggleSection('market')}
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Check size={16} />}
          title="操作历史"
          desc="记录安装、卸载、启用、禁用和导出动作。"
          isOpen={expandedSections.history}
          onToggle={() => toggleSection('history')}
        >
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
        </CollapsibleSection>
      </div>

      {selectedModule && (
        <ModulePublicInfoDialog
          module={selectedModule}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedModuleId(null)}
        />
      )}

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

function dispatchModulesChanged(projectId: string, moduleId: string, scope: 'project' | 'workspace'): void {
  window.dispatchEvent(new CustomEvent('lingbuilder-modules-changed', {
    detail: { projectId, moduleId, scope }
  }));
}

function CollapsibleSection({
  className,
  icon,
  title,
  desc,
  isOpen,
  onToggle,
  children
}: {
  className: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-md border ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full min-w-0 p-3 flex items-start gap-2 text-left transition-colors hover:bg-white/5 ${isOpen ? 'border-b border-white/10' : ''}`}
        aria-expanded={isOpen}
        title={isOpen ? `折叠${title}` : `展开${title}`}
      >
        <span className="mt-0.5 shrink-0 text-sky-400">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] leading-4 text-slate-500">{desc}</div>
        </div>
        <span className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      <div className={isOpen ? 'block' : 'hidden'}>
        {children}
      </div>
    </section>
  );
}

function ModuleRow({ module, isDarkMode, onToggle, onUninstall, onInspect, commerce, onPurchase }: {
  key?: React.Key;
  module: InstalledModule;
  isDarkMode: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  onInspect: () => void;
  commerce?: any;
  onPurchase: (provider: 'wechat'|'alipay') => void;
}) {
  const manifest = module.manifest;
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const isBasicModule = manifest.id === 'lingbuilder.win32.basic';
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
          {commerce && <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300"><LockKeyhole size={10} className="mr-1 inline" />{commerce.access?.allowed ? '账号已授权' : commerce.freeWindow ? '限时免费' : `¥${((Number(commerce.offers?.[0]?.priceMinor) || 0) / 100).toFixed(2)}`}</span>}
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
        <button
          onClick={onToggle}
          disabled={isBasicModule}
          title={isBasicModule ? 'Win32窗口基础模块是普通项目的默认基础能力，不能禁用。' : undefined}
          className="h-8 min-w-0 flex-1 px-1.5 rounded border border-sky-500/40 text-sky-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-sky-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
        >
          {isBasicModule || !module.isEnabledForProject ? <Check size={14} /> : <X size={14} />}
          {isBasicModule ? '基础' : module.isEnabledForProject ? '禁用' : '启用'}
        </button>
        <button onClick={onUninstall} disabled={module.isBuiltin} className="h-8 min-w-0 flex-1 px-1.5 rounded border border-red-500/40 text-red-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap">
          <Trash2 size={14} />
          卸载
        </button>
      </div>
      {commerce && !commerce.access?.allowed && Array.isArray(commerce.offers) && commerce.offers.length > 0 && (
        <div className="grid grid-cols-2 gap-2" aria-label="购买模块授权">
          <button type="button" onClick={() => onPurchase('wechat')} className="h-8 rounded border border-emerald-500/40 px-2 text-xs text-emerald-300 hover:bg-emerald-500/10">微信支付</button>
          <button type="button" onClick={() => onPurchase('alipay')} className="h-8 rounded border border-sky-500/40 px-2 text-xs text-sky-300 hover:bg-sky-500/10">支付宝</button>
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

function normalizeWorkspacePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/');
}

function isAllowedWorkspacePath(value: string, allowedRoot?: string): boolean {
  const normalized = normalizeWorkspacePath(value);
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//u.test(normalized)) return false;
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '..')) return false;
  if (!allowedRoot) return true;
  return normalized === allowedRoot || normalized.startsWith(`${allowedRoot}/`);
}
