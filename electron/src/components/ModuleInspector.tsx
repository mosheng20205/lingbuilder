import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import QRCode from 'qrcode';
import {
  Archive,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  History,
  Inbox,
  Info,
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
import {
  countModuleCommands,
  getModuleFamilyDefinition,
  getModuleFamilyModules,
  getModuleFamilySearchText,
  getModuleFamilyStandardModuleIds,
  isAnyModuleFamilyFeatureEnabled,
  isModuleHiddenByFamily,
  isModuleFamilyStandardEnabled,
  MODULE_FAMILIES,
  type ModuleFamilyDefinition
} from '../services/modules/moduleFamilies';
import { AI_MODULE_MANIFEST_FILE, parseAiModuleOutputText } from '../services/modules/aiModuleImportParser';
import ModulePublicInfoDialog from './ModulePublicInfoDialog';

type ModuleSectionId = 'installed' | 'aiGenerate' | 'packageInstall' | 'packageExport' | 'developer' | 'market' | 'history';

interface ModuleInspectorProps {
  onAddLog: (log: string) => void;
  projectId: string;
  isDarkMode?: boolean;
  selectedModuleId?: string | null;
}

interface ModuleFamilyState {
  definition: ModuleFamilyDefinition;
  modules: InstalledModule[];
  standardEnabled: boolean;
  anyFeatureEnabled: boolean;
  searchText: string;
  categories: Set<string>;
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
  const [paymentQr, setPaymentQr] = useState<{ provider: 'wechat'|'alipay'; url: string; dataUrl: string; expiresAt?: string } | null>(null);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isDragOverPackage, setIsDragOverPackage] = useState(false);
  const [aiGuideCopyState, setAiGuideCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const aiGuideCopyTimerRef = useRef<number | null>(null);
  const [aiModulePasteText, setAiModulePasteText] = useState('');
  const [aiImportResult, setAiImportResult] = useState<{ ok: boolean; message: string; moduleDir?: string; diagnostics: string[] } | null>(null);
  const [enableAfterInstall, setEnableAfterInstall] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<ModuleSectionId, boolean>>({
    installed: true,
    aiGenerate: false,
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
  const divideClass = isDarkMode ? 'divide-white/10' : 'divide-slate-200';
  const borderSubtleClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const iconHoverClass = isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900';
  const fieldIdPrefix = useId();

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

  const moduleFamilyStates = useMemo<ModuleFamilyState[]>(() => MODULE_FAMILIES.map(definition => {
    const modules = getModuleFamilyModules(installedModules, definition);
    return {
      definition,
      modules,
      standardEnabled: isModuleFamilyStandardEnabled(definition, modules),
      anyFeatureEnabled: isAnyModuleFamilyFeatureEnabled(modules),
      searchText: getModuleFamilySearchText(definition, modules),
      categories: new Set(modules.map(module => module.manifest.category))
    };
  }), [installedModules]);
  const moduleFamilyStateByRootId = useMemo(
    () => new Map(moduleFamilyStates.map(state => [state.definition.rootModuleId, state])),
    [moduleFamilyStates]
  );
  const visibleInstalledModules = useMemo(
    () => installedModules.filter(module => !isModuleHiddenByFamily(module.manifest.id)),
    [installedModules]
  );

  const filteredInstalledModules = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return visibleInstalledModules.filter(module => {
      const manifest = module.manifest;
      const familyState = moduleFamilyStateByRootId.get(manifest.id);
      const text = familyState
        ? familyState.searchText
        : [manifest.id, manifest.name, manifest.description, ...(manifest.tags || [])].join(' ').toLowerCase();
      const matchesSearch = !search || text.includes(search);
      const matchesCategory = categoryFilter === '全部'
        || manifest.category === categoryFilter
        || Boolean(familyState?.categories.has(categoryFilter));
      return matchesSearch && matchesCategory;
    });
  }, [visibleInstalledModules, moduleFamilyStateByRootId, searchText, categoryFilter]);

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
    const family = getModuleFamilyDefinition(selectedModuleId);
    if (family) return installedModules.find(module => module.manifest.id === family.rootModuleId) || null;
    return installedModules.find(module => module.manifest.id === selectedModuleId) || null;
  }, [installedModules, selectedModuleId]);
  const selectedModuleFamilyState = selectedModule
    ? moduleFamilyStateByRootId.get(selectedModule.manifest.id)
    : undefined;

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
      const planResponse = await fetch('/api/modules/project/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleId: module.manifest.id, action: enabled ? 'disable' : 'enable' })
      });
      const planResult = await planResponse.json();
      if (!planResult.ok) throw new Error(planResult.error || '模块依赖计划生成失败');
      const dependencyModuleIds: string[] = planResult.plan?.dependencyModuleIds || [];
      const dependentModuleIds: string[] = planResult.plan?.dependentModuleIds || [];
      if (!enabled && dependencyModuleIds.length > 0 && !await requestWorkbenchConfirm({
        title: '将启用依赖模块',
        description: `启用“${module.manifest.name}”还会原子启用以下依赖：\n${dependencyModuleIds.join('\n')}\n\n是否继续？`,
        confirmLabel: '继续',
        cancelLabel: '取消'
      })) return;
      const cascade = enabled && dependentModuleIds.length > 0;
      if (cascade && !await requestWorkbenchConfirm({
        title: '级联禁用确认',
        description: `以下模块依赖“${module.manifest.name}”，必须一并禁用：\n${dependentModuleIds.join('\n')}\n\n是否级联禁用？`,
        confirmLabel: '级联禁用',
        cancelLabel: '取消'
      })) return;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleId: module.manifest.id, cascade })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '项目模块状态更新失败');
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块】${enabled ? '禁用' : '启用'} ${module.manifest.name}。`);
      if (!enabled && dependencyModuleIds.length > 0) {
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块依赖】已自动启用 ${dependencyModuleIds.join('、')}。`);
      }
      if (cascade) {
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块依赖】已级联禁用 ${dependentModuleIds.join('、')}。`);
      }
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

  const toggleModuleFamily = async (familyState: ModuleFamilyState) => {
    const { definition, modules, standardEnabled } = familyState;
    const coreModule = modules.find(module => module.manifest.id === definition.rootModuleId);
    if (!coreModule) {
      setStatusText(`${definition.displayName} 核心模块未安装，无法更新功能状态。`);
      return;
    }
    if (standardEnabled) {
      await toggleProjectModule(coreModule);
      return;
    }

    const standardModuleIds = getModuleFamilyStandardModuleIds(definition);
    setIsLoading(true);
    try {
      const planResponse = await fetch('/api/modules/project/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleIds: standardModuleIds, action: 'enable' })
      });
      const planResult = await planResponse.json();
      if (!planResult.ok) throw new Error(planResult.error || `${definition.displayName} 标准功能启用计划生成失败`);
      const response = await fetch('/api/modules/project/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, moduleIds: standardModuleIds })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || `${definition.displayName} 标准功能启用失败`);
      const addedModuleIds: string[] = result.plan?.addedModuleIds || [];
      setStatusText(`${definition.displayName} 标准功能已启用；高级功能可在“接口”详情中按需开启。`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【${definition.displayName}】已原子启用标准功能：${addedModuleIds.join('、') || '无需新增引用'}。`);
      const compatibilityMessage = Array.isArray(result.messages) ? result.messages.join('；') : '';
      if (compatibilityMessage) onAddLog(`> [${new Date().toLocaleTimeString()}] 【构建配置】${compatibilityMessage}`);
      dispatchModulesChanged(projectId, definition.rootModuleId, 'project');
      await refresh();
    } catch (error) {
      setStatusText(`${definition.displayName} 标准功能更新失败：${formatModuleOperationError(error)}`);
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
      const dataUrl = await QRCode.toDataURL(result.order.paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
      setPaymentQr({ provider, url: result.order.paymentUrl, dataUrl, expiresAt: result.order.expiresAt });
      setStatusText(`已创建${provider === 'wechat' ? '微信支付' : '支付宝'}订单，请扫码付款后刷新模块状态。`);
    } catch (error) { setStatusText(`创建模块订单失败：${error instanceof Error ? error.message : String(error)}`); }
    finally { setIsLoading(false); }
  };

  const downloadModule = async (moduleId: string) => {
    const cloudModules = window.lingBuilder?.cloudAccount;
    if (!cloudModules?.downloadModule) { setStatusText('请在 LingBuilder 桌面端登录后下载收费模块。'); return; }
    setIsLoading(true);
    try {
      const result = await cloudModules.downloadModule({ moduleId, arch: 'any' });
      if (!result?.ok || !result.relativePath) throw new Error('云端未返回有效模块包路径。');
      setPackagePath(result.relativePath);
      setStatusText(`模块 ${moduleId}@${result.artifact.version} 已完成权益校验、签名校验和下载，正在生成安装预览。`);
      await previewPackage(result.relativePath);
    } catch (error) {
      setStatusText(`收费模块下载失败：${formatModuleOperationError(error)}`);
    } finally { setIsLoading(false); }
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
      const message = '请填写要校验的模块目录或 manifest 路径。';
      setStatusText(message);
      setValidateResult({ ok: false, message });
      return;
    }
    if (!isAllowedWorkspacePath(developerValidatePath, '.lingbuilder/module-build')) {
      const message = '只能校验 .lingbuilder/module-build 下的模块目录。';
      setStatusText(message);
      setValidateResult({ ok: false, message });
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
      const ok = diagnostics.length === 0;
      const message = ok
        ? '模块校验通过：manifest v2、命令绑定、文档与平台 target 均符合规范，可以导出 .lbmod。'
        : diagnostics.join('\n');
      setValidateResult({ ok, message });
      setStatusText(ok ? '模块校验通过。' : `模块校验未通过：${diagnostics.join('；')}`);
    } catch (error) {
      const message = `模块校验失败：${error instanceof Error ? error.message : String(error)}`;
      setStatusText(message);
      setValidateResult({ ok: false, message });
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

  useEffect(() => () => {
    if (aiGuideCopyTimerRef.current !== null) window.clearTimeout(aiGuideCopyTimerRef.current);
  }, []);

  const copyAiModuleGuide = async () => {
    const docsApi = window.lingBuilder?.docs;
    if (!docsApi?.readAiModuleGuide) {
      setAiGuideCopyState('failed');
      setStatusText('网页版暂不支持一键复制，请安装 LingBuilder 桌面版或直接打开规范文档手动复制。');
      return;
    }
    setAiGuideCopyState('copying');
    try {
      const guideText = await docsApi.readAiModuleGuide();
      if (!guideText) throw new Error('未读取到 AI 模块开发规范内容。');
      await navigator.clipboard.writeText(guideText);
      setAiGuideCopyState('copied');
      setStatusText('已复制 AI 模块开发规范；粘贴给任意 AI，并用中文描述你想要的模块即可。');
      onAddLogRef.current(`> [${new Date().toLocaleTimeString()}] 【模块开发】已复制 AI 模块开发规范到剪贴板。`);
      if (aiGuideCopyTimerRef.current !== null) window.clearTimeout(aiGuideCopyTimerRef.current);
      aiGuideCopyTimerRef.current = window.setTimeout(() => setAiGuideCopyState('idle'), 2500);
    } catch (error) {
      setAiGuideCopyState('failed');
      setStatusText(`复制 AI 模块开发规范失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openAiModuleGuide = async () => {
    try {
      const docsApi = window.lingBuilder?.docs;
      if (docsApi?.openAiModuleGuide) {
        const result = await docsApi.openAiModuleGuide();
        if (result) throw new Error(result);
        setStatusText('已打开 AI 模块开发规范文档。');
        onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块开发】已打开 AI 模块开发规范文档。`);
        return;
      }
      setStatusText('请在 LingBuilder 桌面版中打开 AI 模块开发规范文档。');
    } catch (error) {
      setStatusText(`打开 AI 模块开发规范失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const parsedAiFiles = useMemo(
    () => parseAiModuleOutputText(aiModulePasteText),
    [aiModulePasteText]
  );
  const canImportAiFiles = parsedAiFiles.files.length > 0
    && parsedAiFiles.files.some(file => file.path === AI_MODULE_MANIFEST_FILE);

  const importAiFilesFromPaste = async () => {
    if (!canImportAiFiles) {
      setAiImportResult({
        ok: false,
        diagnostics: parsedAiFiles.diagnostics.length ? parsedAiFiles.diagnostics : ['未识别到可导入的模块文件。'],
        message: '解析未通过，请确认粘贴了 AI 回复的完整内容。'
      });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/modules/developer/import-ai-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: parsedAiFiles.files })
      });
      const result = await response.json().catch(() => null);
      if (!result || typeof result.ok !== 'boolean') {
        throw new Error(response.status === 404
          ? '当前开发服务未包含导入接口，请重启 LingBuilder 开发服务或使用最新安装包后重试。'
          : `服务返回了无效响应（HTTP ${response.status}）。`);
      }
      if (!result.ok) throw new Error(result.error || 'AI 模块导入失败');
      const moduleDir: string = result.result.outDir;
      const diagnostics: string[] = Array.isArray(result.result.diagnostics) ? result.result.diagnostics : [];
      setAiImportResult({
        ok: diagnostics.length === 0,
        moduleDir,
        diagnostics,
        message: `已导入 ${result.result.moduleName}（${result.result.moduleId}）到 ${moduleDir}，共 ${result.result.fileCount} 个文件。${diagnostics.length === 0 ? '导入后校验通过。' : '导入后校验未通过，请查看诊断。'}`
      });
      setDeveloperValidatePath(moduleDir);
      setExportModuleDir(moduleDir);
      setStatusText(`AI 模块已导入到 ${moduleDir}；“模块包制作”和“校验模块”路径已自动填好。`);
      onAddLog(`> [${new Date().toLocaleTimeString()}] 【模块开发】已从 AI 输出导入 ${result.result.moduleId} 到 ${moduleDir}（${result.result.fileCount} 个文件）。`);
    } catch (error) {
      const message = `AI 模块导入失败：${error instanceof Error ? error.message : String(error)}`;
      setAiImportResult({ ok: false, diagnostics: [], message });
      setStatusText(message);
    } finally {
      setIsLoading(false);
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
              <div className={`text-xs leading-4 line-clamp-3 break-words ${subtleClass}`}>{statusText}</div>
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
          desc={`${visibleInstalledModules.length} 个用户模块入口，内部依赖和只读 SDK 已自动收起。`}
          isOpen={expandedSections.installed}
          onToggle={() => toggleSection('installed')}
          isDarkMode={isDarkMode}
        >
          {commerceProducts.length > 0 && <div className={`border-b bg-sky-500/5 p-3 space-y-2 ${borderSubtleClass}`} aria-label="账号收费模块">
            <div className="text-[11px] font-semibold text-sky-300">账号收费模块</div>
            {commerceProducts.map(product => {
              const installed = installedModules.find(item => item.manifest.id === product.moduleId);
              const offer = product.offers?.[0];
              return <div key={product.moduleId} className={`rounded border p-2.5 text-xs ${borderSubtleClass}`}>
                <div className="flex flex-wrap items-center gap-2"><strong>{product.name}</strong><span className="text-[10px] text-slate-400">{product.moduleId}</span>{product.access?.allowed && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">账号已授权</span>}</div>
                <div className="mt-1 text-[11px] leading-4 text-slate-400">{product.description}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {product.access?.allowed ? <button disabled={isLoading} onClick={() => downloadModule(product.moduleId)} className={`col-span-2 h-8 rounded bg-sky-600 text-white inline-flex items-center justify-center gap-1.5 hover:bg-sky-500 ${actionButtonClass}`}><Download size={14}/>{installed ? '下载更新并预览安装' : '下载并预览安装'}</button> : <>
                    <button disabled={!offer || isLoading} onClick={() => purchaseModule(product.moduleId, 'wechat')} className={`h-8 rounded border text-xs inline-flex items-center justify-center gap-1 ${isDarkMode ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10'} ${actionButtonClass}`}>微信支付{offer ? ` ¥${(Number(offer.priceMinor) / 100).toFixed(2)}` : ''}</button>
                    <button disabled={!offer || isLoading} onClick={() => purchaseModule(product.moduleId, 'alipay')} className={`h-8 rounded border text-xs inline-flex items-center justify-center gap-1 ${isDarkMode ? 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10' : 'border-sky-500/50 text-sky-700 hover:bg-sky-500/10'} ${actionButtonClass}`}>支付宝{offer ? ` ¥${(Number(offer.priceMinor) / 100).toFixed(2)}` : ''}</button>
                  </>}
                </div>
              </div>;
            })}
          </div>}
          <div className={`divide-y ${divideClass}`}>
            {filteredInstalledModules.length === 0 ? (
              <Empty text="没有匹配的本地模块。" />
            ) : filteredInstalledModules.map(module => {
              const familyState = moduleFamilyStateByRootId.get(module.manifest.id);
              return (
                <ModuleRow
                  key={module.manifest.id}
                  module={module}
                  isDarkMode={isDarkMode}
                  enabledOverride={familyState?.standardEnabled}
                  statusLabel={familyState
                    ? familyState.standardEnabled ? '标准功能已启用' : familyState.anyFeatureEnabled ? '部分功能已启用' : undefined
                    : undefined}
                  capabilityText={familyState
                    ? `${countModuleCommands(familyState.modules)} 条命令 · ${familyState.definition.features.length} 个功能域`
                    : undefined}
                  descriptionOverride={familyState?.definition.managerDescription}
                  toggleLabel={familyState && !familyState.standardEnabled && familyState.anyFeatureEnabled ? '补全启用' : undefined}
                  onToggle={() => familyState ? toggleModuleFamily(familyState) : toggleProjectModule(module)}
                  onUninstall={() => uninstallModule(module)}
                  onInspect={() => inspectModule(module.manifest.id)}
                  commerce={commerceProducts.find(product => product.moduleId === module.manifest.id)}
                  onPurchase={provider => purchaseModule(module.manifest.id, provider)}
                />
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Bot size={16} />}
          title="AI 生成模块"
          desc="把开发规范和需求交给任意 AI，生成模块文件后导入 IDE 使用。"
          isOpen={expandedSections.aiGenerate}
          onToggle={() => toggleSection('aiGenerate')}
          isDarkMode={isDarkMode}
        >
          <div className="p-3 grid gap-2.5">
            <div
              role="group"
              aria-label="AI 生成模块入口"
              className={`rounded border p-2.5 ${isDarkMode ? 'border-sky-500/25 bg-sky-500/5' : 'border-sky-500/30 bg-sky-500/5'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Bot size={14} className="shrink-0 text-sky-400" aria-hidden="true" />
                <span className="text-xs font-semibold">让 AI 帮你写模块（不需要会 C++）</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-500/10 text-sky-700'}`}>任意 AI 均可</span>
              </div>
              <p className={`mt-1 text-[10px] leading-4 ${subtleClass}`}>
                复制规范粘贴给 ChatGPT、Claude、Cursor 等任意 AI，再用中文描述需求，AI 会输出完整模块文件。
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <button
                  onClick={copyAiModuleGuide}
                  disabled={aiGuideCopyState === 'copying'}
                  className={`h-9 w-full px-3 rounded text-xs inline-flex items-center justify-center gap-2 ${
                    aiGuideCopyState === 'copied'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-sky-600 text-white hover:bg-sky-500'
                  } ${actionButtonClass}`}
                >
                  {aiGuideCopyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                  {aiGuideCopyState === 'copying' ? '正在复制…' : aiGuideCopyState === 'copied' ? '已复制，粘贴给 AI 即可' : aiGuideCopyState === 'failed' ? '复制失败，可打开文档手动复制' : '复制 AI 开发规范'}
                </button>
                <button onClick={openAiModuleGuide} className={`h-9 w-full px-3 rounded border text-xs inline-flex items-center justify-center gap-2 ${isDarkMode ? 'border-sky-500/40 text-sky-300' : 'border-sky-500/50 text-sky-700'} hover:bg-sky-500/10 ${actionButtonClass}`}>
                  <BookOpen size={14} />
                  打开规范文档
                </button>
              </div>
            </div>
            <div className={`rounded border p-2.5 ${isDarkMode ? 'border-white/15' : 'border-slate-300'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Download size={14} className="shrink-0 text-sky-400" aria-hidden="true" />
                <span className="text-xs font-semibold">导入 AI 生成的文件</span>
                {aiModulePasteText.trim() && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${canImportAiFiles
                    ? isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-500/10 text-emerald-700'
                    : isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-500/10 text-amber-700'}`}>
                    已识别 {parsedAiFiles.files.length} 个文件
                  </span>
                )}
              </div>
              <Field id={`${fieldIdPrefix}-ai-paste`} label="粘贴 AI 回复内容" hint="把 AI 输出的完整回复粘到这里（包含“### 文件：相对路径”标题和代码块），导入后会自动校验。" isDarkMode={isDarkMode}>
                <textarea
                  id={`${fieldIdPrefix}-ai-paste`}
                  value={aiModulePasteText}
                  onChange={event => { setAiModulePasteText(event.target.value); setAiImportResult(null); }}
                  className={`min-h-28 min-w-0 rounded border px-3 py-2 text-xs outline-none ${inputClass}`}
                  placeholder={`### 文件：lingbuilder.module.json\n\`\`\`json\n…\n\`\`\`\n\n### 文件：include/xxx_bridge.h\n\`\`\`cpp\n…\n\`\`\`}`}
                  aria-label="粘贴 AI 回复内容"
                />
              </Field>
              {aiModulePasteText.trim() && parsedAiFiles.files.length > 0 && (
                <div className={`mt-1 break-all text-[10px] leading-4 ${subtleClass}`}>
                  {parsedAiFiles.files.slice(0, 6).map(file => file.path).join('、')}
                  {parsedAiFiles.files.length > 6 ? ` 等 ${parsedAiFiles.files.length} 个文件` : ''}
                </div>
              )}
              {aiModulePasteText.trim() && parsedAiFiles.diagnostics.length > 0 && (
                <div className={`mt-1 text-[10px] leading-4 whitespace-pre-wrap ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                  {parsedAiFiles.diagnostics.join('\n')}
                </div>
              )}
              <button
                onClick={importAiFilesFromPaste}
                disabled={!canImportAiFiles || isLoading}
                className={`mt-2 h-9 w-full px-3 rounded bg-sky-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500 ${actionButtonClass}`}
              >
                <Upload size={14} />
                导入到 module-build
              </button>
              {aiImportResult && (
                <div
                  role="status"
                  className={`mt-2 rounded border p-2 text-[11px] leading-4 whitespace-pre-wrap ${
                    aiImportResult.ok
                      ? isDarkMode ? 'border-emerald-500/40 text-emerald-300' : 'border-emerald-500/50 text-emerald-700'
                      : isDarkMode ? 'border-red-500/40 text-red-300' : 'border-red-400 text-red-600'
                  }`}
                >
                  {aiImportResult.message}
                  {aiImportResult.diagnostics.length > 0 && `\n${aiImportResult.diagnostics.join('\n')}`}
                  {aiImportResult.ok && aiImportResult.moduleDir && '\n下一步：在上方“模块包制作”点击导出 .lbmod，然后安装启用。'}
                </div>
              )}
            </div>
            <div className="grid gap-1">
              <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>使用步骤</span>
              <ol className={`grid gap-1 text-[10px] leading-4 ${subtleClass}`}>
                <li>1. 点击“复制 AI 开发规范”，粘贴给任意 AI，并用中文描述你想要的模块。</li>
                <li>2. 把 AI 回复完整粘贴到上方“导入 AI 生成的文件”，点击导入；也可以手动保存到 .lingbuilder/module-build/&lt;模块ID&gt;/。</li>
                <li>3. 校验通过后在“模块包制作”导出并安装（导入成功后路径会自动填好）。</li>
              </ol>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<FileArchive size={16} />}
          title="安装 .lbmod"
          desc="拖入 .lbmod 文件，或填写工作区相对路径预览安装。"
          isOpen={expandedSections.packageInstall}
          onToggle={() => toggleSection('packageInstall')}
          isDarkMode={isDarkMode}
        >
          <div
            onDragOver={event => { event.preventDefault(); setIsDragOverPackage(true); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragOverPackage(false); }}
            onDrop={() => setIsDragOverPackage(false)}
            aria-label="模块包拖放安装区"
            className={`m-3 grid min-w-0 grid-cols-1 gap-2 rounded border border-dashed p-3 transition-colors ${
              isDragOverPackage
                ? 'border-sky-400 bg-sky-500/10'
                : isDarkMode ? 'border-white/15' : 'border-slate-300'
            }`}
          >
            <div className={`flex items-start gap-1.5 text-[10px] leading-4 ${subtleClass}`}>
              <Download size={12} className="mt-0.5 shrink-0 text-sky-400" aria-hidden="true" />
              <span>把 .lbmod 文件拖到这里，桌面版会自动复制进工作区；也可以直接填写下方路径。</span>
            </div>
            <Field id={`${fieldIdPrefix}-package-path`} label="模块包路径" hint="必须是 .lingbuilder/module-packages 下的工作区相对路径。" isDarkMode={isDarkMode}>
              <input
                id={`${fieldIdPrefix}-package-path`}
                value={packagePath}
                onChange={event => setPackagePath(event.target.value)}
                className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`}
                placeholder=".lingbuilder/module-packages/demo.lbmod"
              />
            </Field>
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
          desc="把校验通过的模块目录打包为可分发的 .lbmod。"
          isOpen={expandedSections.packageExport}
          onToggle={() => toggleSection('packageExport')}
          isDarkMode={isDarkMode}
        >
          <div className="p-3 grid min-w-0 grid-cols-1 gap-2">
            <Field id={`${fieldIdPrefix}-export-module-dir`} label="模块目录" hint="包含 lingbuilder.module.json 的目录，位于 .lingbuilder/module-build 下。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-export-module-dir`} value={exportModuleDir} onChange={event => setExportModuleDir(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            </Field>
            <Field id={`${fieldIdPrefix}-export-target-path`} label="导出路径" hint="导出的 .lbmod 文件路径，位于 .lingbuilder/module-packages 下。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-export-target-path`} value={exportTargetPath} onChange={event => setExportTargetPath(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-packages/demo.lbmod" />
            </Field>
            <button onClick={exportModulePackage} className={`h-9 w-full px-3 rounded bg-emerald-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-emerald-500 ${actionButtonClass}`}>
              <Upload size={14} />
              导出 .lbmod
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Upload size={16} />}
          title="模块开发者中心"
          desc="面向会 C++ 的模块作者：模板、校验、迁移和本地市场索引。"
          isOpen={expandedSections.developer}
          onToggle={() => toggleSection('developer')}
          isDarkMode={isDarkMode}
        >
          <div className={`border-b bg-sky-500/5 px-3 py-2.5 ${borderSubtleClass}`}>
            <div className={`flex items-start gap-1.5 text-[10px] leading-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              <Info size={12} className="mt-0.5 shrink-0 text-sky-400" aria-hidden="true" />
              <span className="min-w-0 break-words">开发流程：① 创建模板 → ② 编写 C++ 与清单 → ③ 校验 → ④ 在上方“模块包制作”导出 .lbmod → ⑤ 生成市场索引分发。</span>
            </div>
          </div>
          <DeveloperStep step={1} title="创建模块模板" desc="生成含 lingbuilder.module.json 的 v2 模块骨架。" isDarkMode={isDarkMode}>
            <Field id={`${fieldIdPrefix}-developer-template`} label="模板类型" hint="cpp-source：C++ 源码模块；ui-control：设计器控件；dll-lib：DLL 封装；command-only：纯命令；empty：空模块。" isDarkMode={isDarkMode}>
              <select id={`${fieldIdPrefix}-developer-template`} value={developerTemplate} onChange={event => setDeveloperTemplate(event.target.value)} className={`h-9 rounded border px-2 text-xs outline-none ${inputClass}`}>
                {['cpp-source', 'dll-lib', 'ui-control', 'command-only', 'empty'].map(item => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field id={`${fieldIdPrefix}-developer-out-dir`} label="输出目录" hint="位于 .lingbuilder/module-build 下的工作区相对路径。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-developer-out-dir`} value={developerOutDir} onChange={event => setDeveloperOutDir(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            </Field>
            <button onClick={createDeveloperTemplate} className={`h-9 w-full px-3 rounded bg-sky-600 text-white text-xs inline-flex items-center justify-center gap-2 hover:bg-sky-500 ${actionButtonClass}`}>
              <Package size={14} />
              创建模板
            </button>
          </DeveloperStep>
          <DeveloperStep step={2} title="编写 C++ 与清单" desc="在生成的目录里实现 C++ 逻辑、bindings.commands 命令映射和 contributes 中文补全，并按手册登记中文文档。" isDarkMode={isDarkMode}>
            <button onClick={openDeveloperManual} className={`h-9 w-full px-3 rounded border border-amber-500/50 text-amber-200 text-xs inline-flex items-center justify-center gap-2 hover:bg-amber-500/10 hover:text-amber-100 ${actionButtonClass}`}>
              <BookOpen size={14} />
              打开模块开发手册
            </button>
          </DeveloperStep>
          <DeveloperStep step={3} title="校验模块" desc="导出前检查 manifest v2、命令绑定、文档与平台 target。" isDarkMode={isDarkMode}>
            <Field id={`${fieldIdPrefix}-developer-validate`} label="模块目录" hint="支持 lingbuilder.module.json 所在目录，位于 .lingbuilder/module-build 下。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-developer-validate`} value={developerValidatePath} onChange={event => setDeveloperValidatePath(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            </Field>
            <button onClick={validateDeveloperModule} className={`h-9 w-full px-3 rounded border text-xs inline-flex items-center justify-center gap-2 ${isDarkMode ? 'border-emerald-500/40 text-emerald-300' : 'border-emerald-500/50 text-emerald-700'} hover:bg-emerald-500/10 ${actionButtonClass}`}>
              <ShieldCheck size={14} />
              校验模块
            </button>
            {validateResult && (
              <div
                role="status"
                className={`rounded border p-2 text-[11px] leading-4 whitespace-pre-wrap ${
                  validateResult.ok
                    ? isDarkMode ? 'border-emerald-500/40 text-emerald-300' : 'border-emerald-500/50 text-emerald-700'
                    : isDarkMode ? 'border-red-500/40 text-red-300' : 'border-red-400 text-red-600'
                }`}
              >
                {validateResult.message}
              </div>
            )}
          </DeveloperStep>
          <DeveloperStep step={4} title="导出 .lbmod" desc="校验通过后，在上方“模块包制作”区块填写模块目录和导出路径生成 .lbmod 包。" isDarkMode={isDarkMode}>
            <div className={`rounded border border-dashed p-2.5 text-[11px] leading-4 ${isDarkMode ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
              导出后会写入 .lingbuilder/module-packages，可直接在“安装 .lbmod”或“模块市场”中分发安装。
            </div>
          </DeveloperStep>
          <DeveloperStep step={5} title="迁移已有 C++ 库" desc="把现有 C++ 库按迁移配置生成为 v2 模块目录。" isDarkMode={isDarkMode}>
            <Field id={`${fieldIdPrefix}-developer-migrate-config`} label="迁移配置" hint="描述头文件、源码与命令映射的 JSON 配置，工作区相对路径。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-developer-migrate-config`} value={developerMigrateConfig} onChange={event => setDeveloperMigrateConfig(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder="config/module-migration.json" />
            </Field>
            <Field id={`${fieldIdPrefix}-developer-migrate-out`} label="输出目录" hint="迁移结果目录，位于 .lingbuilder/module-build 下。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-developer-migrate-out`} value={developerMigrateOut} onChange={event => setDeveloperMigrateOut(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-build/demo" />
            </Field>
            <button onClick={migrateDeveloperCpp} className={`h-9 w-full px-3 rounded border text-xs inline-flex items-center justify-center gap-2 ${isDarkMode ? 'border-sky-500/40 text-sky-300' : 'border-sky-500/50 text-sky-700'} hover:bg-sky-500/10 ${actionButtonClass}`}>
              <FileArchive size={14} />
              迁移 C++ 库
            </button>
          </DeveloperStep>
          <DeveloperStep step={6} title="生成市场索引" desc="把多个 .lbmod 登记为本地市场索引，供“模块市场”读取。" isDarkMode={isDarkMode}>
            <Field id={`${fieldIdPrefix}-developer-market-packages`} label=".lbmod 路径列表" hint="每行一个路径，必须位于 .lingbuilder/module-packages 下。" isDarkMode={isDarkMode}>
              <textarea id={`${fieldIdPrefix}-developer-market-packages`} value={developerMarketPackages} onChange={event => setDeveloperMarketPackages(event.target.value)} className={`min-h-20 min-w-0 rounded border px-3 py-2 text-xs outline-none ${inputClass}`} placeholder="每行一个 .lingbuilder/module-packages/*.lbmod" />
            </Field>
            <Field id={`${fieldIdPrefix}-developer-market-out`} label="索引输出路径" hint=".lingbuilder 下的 JSON 文件，例如 .lingbuilder/module-market.json。" isDarkMode={isDarkMode}>
              <input id={`${fieldIdPrefix}-developer-market-out`} value={developerMarketOut} onChange={event => setDeveloperMarketOut(event.target.value)} className={`h-9 min-w-0 rounded border px-3 text-xs outline-none ${inputClass}`} placeholder=".lingbuilder/module-market.json" />
            </Field>
            <button onClick={createDeveloperMarketIndex} className={`h-9 w-full px-3 rounded border text-xs inline-flex items-center justify-center gap-2 ${isDarkMode ? 'border-sky-500/40 text-sky-300' : 'border-sky-500/50 text-sky-700'} hover:bg-sky-500/10 ${actionButtonClass}`}>
              <Store size={14} />
              生成市场索引
            </button>
          </DeveloperStep>
        </CollapsibleSection>

        <CollapsibleSection
          className={cardClass}
          icon={<Store size={16} />}
          title="模块市场"
          desc="从本地、官方或企业市场源读取模块索引；安装仍走同一套预览确认流程。"
          isOpen={expandedSections.market}
          onToggle={() => toggleSection('market')}
          isDarkMode={isDarkMode}
        >
          <div className={`divide-y ${divideClass}`}>
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
                  className={`h-8 w-full px-3 rounded border text-xs inline-flex items-center justify-center gap-2 ${isDarkMode ? 'border-emerald-500/40 text-emerald-300 hover:text-emerald-100' : 'border-emerald-500/50 text-emerald-700'} hover:bg-emerald-500/10 ${actionButtonClass}`}
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
          icon={<History size={16} />}
          title="操作历史"
          desc="记录安装、卸载、启用、禁用和导出动作。"
          isOpen={expandedSections.history}
          onToggle={() => toggleSection('history')}
          isDarkMode={isDarkMode}
        >
          <div className={`divide-y ${divideClass}`}>
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
          familyDefinition={selectedModuleFamilyState?.definition}
          familyModules={selectedModuleFamilyState?.modules}
          familyFeatures={selectedModuleFamilyState?.definition.features}
          isDarkMode={isDarkMode}
          isChangingFeature={isLoading}
          onToggleFeature={toggleProjectModule}
          onClose={() => setSelectedModuleId(null)}
        />
      )}

      {installPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-md border shadow-xl ${cardClass}`}>
            <div className={`p-4 border-b flex items-center justify-between ${borderSubtleClass}`}>
              <div>
                <div className="text-sm font-semibold">模块安装预览</div>
                <div className={`text-xs ${subtleClass}`}>{installPreview.packagePath}</div>
              </div>
              <button onClick={() => setInstallPreview(null)} aria-label="关闭安装预览" className={`p-1 rounded ${iconHoverClass} ${actionButtonClass}`}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <PreviewLine label="模块" value={installPreview.manifest ? `${installPreview.manifest.name} (${installPreview.manifest.id})` : '未识别'} />
              <PreviewLine label="版本" value={installPreview.manifest?.version || '-'} />
              <PreviewLine label="文件" value={`${installPreview.fileCount} 个文件，${formatBytes(installPreview.totalBytes)}`} />
              <PreviewLine label="SHA256" value={installPreview.sha256} />
              <PreviewLine label="升级" value={installPreview.willUpgrade ? `将替换现有版本 ${installPreview.existingVersion}` : '否'} />
              <div>
                <div className="font-semibold mb-1">安全检查</div>
                <div className={`rounded border p-2 whitespace-pre-wrap ${
                  installPreview.canInstall
                    ? isDarkMode ? 'border-emerald-500/40 text-emerald-300' : 'border-emerald-500/50 text-emerald-700'
                    : isDarkMode ? 'border-red-500/40 text-red-300' : 'border-red-400 text-red-600'
                }`}>
                  {installPreview.diagnostics.length ? installPreview.diagnostics.join('\n') : '检查通过，可以安装。'}
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={enableAfterInstall} onChange={event => setEnableAfterInstall(event.target.checked)} />
                安装完成后加入当前项目
              </label>
            </div>
            <div className={`p-4 border-t flex justify-end gap-2 ${borderSubtleClass}`}>
              <button onClick={() => setInstallPreview(null)} className={`h-8 px-3 rounded border text-xs ${isDarkMode ? 'border-white/15 hover:bg-white/10 hover:text-white' : 'border-slate-300 hover:bg-slate-100 hover:text-slate-900'} ${actionButtonClass}`}>取消</button>
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
      {paymentQr && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="模块支付二维码">
          <div className={`w-full max-w-sm rounded-md border p-5 text-center shadow-xl ${cardClass}`}>
            <div className="flex items-center justify-between"><div className="text-sm font-semibold">{paymentQr.provider === 'wechat' ? '微信支付' : '支付宝'}扫码付款</div><button aria-label="关闭支付二维码" onClick={() => setPaymentQr(null)} className={`rounded p-1 ${iconHoverClass} cursor-pointer transition-colors`}><X size={17}/></button></div>
            <img src={paymentQr.dataUrl} alt={`${paymentQr.provider === 'wechat' ? '微信支付' : '支付宝'}付款二维码`} className="mx-auto mt-4 w-72 max-w-full rounded bg-white p-2"/>
            <p className={`mt-3 text-xs leading-5 ${subtleClass}`}>请使用{paymentQr.provider === 'wechat' ? '微信' : '支付宝'}扫描二维码。付款完成后关闭此窗口并点击“刷新”。{paymentQr.expiresAt ? ` 订单有效至 ${new Date(paymentQr.expiresAt).toLocaleTimeString()}。` : ''}</p>
            <button onClick={() => window.open(paymentQr.url, '_blank', 'noopener,noreferrer')} className={`mt-3 h-9 w-full rounded border text-xs ${isDarkMode ? 'border-sky-500/40 text-sky-300' : 'border-sky-500/50 text-sky-700'} hover:bg-sky-500/10 cursor-pointer transition-colors`}>在本机支付应用中打开</button>
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
  isDarkMode = true,
  children
}: {
  className: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode?: boolean;
  children: React.ReactNode;
}) {
  const dividerClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const hoverClass = isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-500/5';
  return (
    <section className={`min-w-0 rounded-md border ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full min-w-0 p-3 flex items-start gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-inset ${hoverClass} ${isOpen ? `border-b ${dividerClass}` : ''}`}
        aria-expanded={isOpen}
        title={isOpen ? `折叠${title}` : `展开${title}`}
      >
        <span className="mt-0.5 shrink-0 text-sky-400">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] leading-4 text-slate-500">{desc}</div>
        </div>
        <span className={`mt-0.5 shrink-0 rounded p-0.5 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`}>
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none ${
          isOpen ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'
        }`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}

function Field({ id, label, hint, isDarkMode, children }: {
  id: string;
  label: string;
  hint?: string;
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{label}</label>
      {children}
      {hint && <span className="text-[10px] leading-4 text-slate-500">{hint}</span>}
    </div>
  );
}

function DeveloperStep({ step, title, desc, isDarkMode, children }: {
  step: number;
  title: string;
  desc?: string;
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`第 ${step} 步：${title}`}
      className={`grid gap-2 border-t px-3 py-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-500/10 text-sky-700'}`}>{step}</span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      {desc && <p className={`text-[10px] leading-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>}
      {children}
    </div>
  );
}

function ModuleRow({ module, isDarkMode, enabledOverride, statusLabel, capabilityText, descriptionOverride, toggleLabel, onToggle, onUninstall, onInspect, commerce, onPurchase }: {
  key?: React.Key;
  module: InstalledModule;
  isDarkMode: boolean;
  enabledOverride?: boolean;
  statusLabel?: string;
  capabilityText?: string;
  descriptionOverride?: string;
  toggleLabel?: string;
  onToggle: () => void;
  onUninstall: () => void;
  onInspect: () => void;
  commerce?: any;
  onPurchase: (provider: 'wechat'|'alipay') => void;
}) {
  const manifest = module.manifest;
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const categoryBadgeClass = isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-500/10 text-sky-700';
  const builtinBadgeClass = isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-500/10 text-emerald-700';
  const statusBadgeClass = isDarkMode ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-500/10 text-violet-700';
  const commerceBadgeClass = isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-500/10 text-rose-700';
  const diagnosticsClass = isDarkMode ? 'text-red-300' : 'text-red-600';
  const rowHoverTextClass = isDarkMode ? 'hover:text-white' : 'hover:text-slate-900';
  const isBasicModule = manifest.id === 'lingbuilder.win32.basic';
  const isEnabled = enabledOverride ?? Boolean(module.isEnabledForProject);
  const capabilityCount = (manifest.contributes?.commands?.length || 0)
    + (manifest.contributes?.types?.length || 0)
    + (manifest.contributes?.designerControls?.length || 0);

  return (
    <div className="min-w-0 p-3 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-semibold leading-5">{manifest.name}</span>
          <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${categoryBadgeClass}`}>{manifest.category}</span>
          {module.isBuiltin && <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${builtinBadgeClass}`}>内置</span>}
          {(statusLabel || isEnabled) && <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${statusBadgeClass}`}>{statusLabel || '项目已引用'}</span>}
          {commerce && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${commerceBadgeClass}`}><LockKeyhole size={10} className="mr-1 inline" aria-hidden="true" />{commerce.access?.allowed ? '账号已授权' : commerce.freeWindow ? '限时免费' : `¥${((Number(commerce.offers?.[0]?.priceMinor) || 0) / 100).toFixed(2)}`}</span>}
        </div>
        <div className={`mt-1 break-all text-[11px] leading-4 ${subtleClass}`}>{manifest.id} · {manifest.version} · {capabilityText || `能力 ${capabilityCount} 项`}</div>
        <div className={`mt-1 break-words text-xs leading-5 ${subtleClass}`}>{descriptionOverride || manifest.description}</div>
        {module.diagnostics.length > 0 && (
          <div className={`mt-2 text-[11px] whitespace-pre-wrap ${diagnosticsClass}`}>{module.diagnostics.join('\n')}</div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onInspect} className={`h-8 min-w-0 flex-1 px-1.5 rounded border border-violet-500/40 text-violet-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-violet-500/10 ${rowHoverTextClass} whitespace-nowrap`}>
          <Search size={14} />
          接口
        </button>
        <button
          onClick={onToggle}
          disabled={isBasicModule}
          title={isBasicModule ? 'Win32窗口基础模块是普通项目的默认基础能力，不能禁用。' : undefined}
          className={`h-8 min-w-0 flex-1 px-1.5 rounded border border-sky-500/40 text-sky-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-sky-500/10 ${rowHoverTextClass} disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap`}
        >
          {isBasicModule || !isEnabled ? <Check size={14} /> : <X size={14} />}
          {isBasicModule ? '基础' : toggleLabel || (isEnabled ? '禁用' : '启用')}
        </button>
        <button onClick={onUninstall} disabled={module.isBuiltin} className={`h-8 min-w-0 flex-1 px-1.5 rounded border border-red-500/40 text-red-300 text-xs inline-flex items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-red-500/10 ${isDarkMode ? 'hover:text-red-100' : 'hover:text-red-700'} disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap`}>
          <Trash2 size={14} />
          卸载
        </button>
      </div>
      {commerce && !commerce.access?.allowed && Array.isArray(commerce.offers) && commerce.offers.length > 0 && (
        <div className="grid grid-cols-2 gap-2" aria-label="购买模块授权">
          <button type="button" onClick={() => onPurchase('wechat')} className={`h-8 rounded border px-2 text-xs ${isDarkMode ? 'border-emerald-500/40 text-emerald-300' : 'border-emerald-500/50 text-emerald-700'} hover:bg-emerald-500/10 cursor-pointer transition-colors`}>微信支付</button>
          <button type="button" onClick={() => onPurchase('alipay')} className={`h-8 rounded border px-2 text-xs ${isDarkMode ? 'border-sky-500/40 text-sky-300' : 'border-sky-500/50 text-sky-700'} hover:bg-sky-500/10 cursor-pointer transition-colors`}>支付宝</button>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-6 text-center text-xs text-slate-500">
      <Inbox size={18} className="opacity-50" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
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
