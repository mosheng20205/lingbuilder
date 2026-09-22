import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileCode,
  FileText,
  Hash,
  History,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  Monitor,
  Package,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X
} from 'lucide-react';
import type {
  ModuleFamilyDefinition,
  ModuleFamilyFeatureDefinition
} from '../services/modules/moduleFamilies';
import {
  getModuleFamilyDefinition,
  getModuleFamilyModules
} from '../services/modules/moduleFamilies';
import {
  collectPublicInfoItems,
  getPublicInfoGroups,
  type PublicGroupId,
  type PublicInfoItem
} from '../services/modules/modulePublicInfo';
import { normalizeModulePublicInfoSearchText } from '../services/modules/modulePublicInfoSearch';
import { requestModuleDetailAction } from '../services/modules/moduleDetailView';
import type { InstalledModule, ModuleHistoryEntry } from '../services/modules/types';

/**
 * 模块详情页（VS Code Extensions 式）：主区页签与独立信息窗口共用同一个实现。
 * - 嵌入模式（主区页签，传 projectId）：自带数据加载与刷新，动作经
 *   requestModuleDetailAction 交给 ModuleInspector 执行（启停/购买/修复单一出口）。
 * - 独立模式（standalone，传 standaloneModule）：只读浏览，Esc 关闭窗口。
 * 公开信息条目收集来自 modulePublicInfo 服务，保证与语言服务/补全同一份 manifest 口径。
 */

interface ModuleDetailPageProps {
  moduleId: string;
  projectId?: string;
  standaloneModule?: InstalledModule | null;
  isDarkMode?: boolean;
  onClose?: () => void;
}

type DetailTabId = 'overview' | 'interface' | 'docs' | 'examples' | 'history';

const DETAIL_TABS: Array<{ id: DetailTabId; label: string; embeddedOnly?: boolean }> = [
  { id: 'overview', label: '详情' },
  { id: 'interface', label: '接口' },
  { id: 'docs', label: '文档' },
  { id: 'examples', label: '示例' },
  { id: 'history', label: '历史', embeddedOnly: true }
];

const TREE_ITEM_LIMIT = 200;
const ModuleDocumentPreview = React.lazy(() => import('./ModuleDocumentPreview'));

export default function ModuleDetailPage({
  moduleId,
  projectId,
  standaloneModule = null,
  isDarkMode = true,
  onClose
}: ModuleDetailPageProps) {
  const standalone = !projectId;
  const [installedModules, setInstalledModules] = useState<InstalledModule[]>(standaloneModule ? [standaloneModule] : []);
  const [history, setHistory] = useState<ModuleHistoryEntry[]>([]);
  const [commerceProducts, setCommerceProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const [isLoading, setIsLoading] = useState(!standaloneModule);

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const [installedRes, historyRes] = await Promise.all([
        fetch(`/api/modules/installed?projectId=${encodeURIComponent(projectId)}`).then(res => res.json()),
        fetch(`/api/modules/history?projectId=${encodeURIComponent(projectId)}`).then(res => res.json())
      ]);
      if (installedRes.ok) setInstalledModules(Array.isArray(installedRes.modules) ? installedRes.modules : []);
      if (historyRes.ok) setHistory(Array.isArray(historyRes.history) ? historyRes.history : []);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    void reload();
    void window.lingBuilder?.cloudAccount?.moduleCatalog?.()
      .then(catalog => setCommerceProducts(Array.isArray(catalog?.products) ? catalog.products : []))
      .catch(() => undefined);
    const onChanged = () => { void reload(); };
    window.addEventListener('lingbuilder-modules-changed', onChanged);
    return () => window.removeEventListener('lingbuilder-modules-changed', onChanged);
  }, [projectId, reload]);

  // 独立窗口：Esc 关闭（与旧模块信息窗口行为一致）。
  useEffect(() => {
    if (!standalone || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [standalone, onClose]);

  const module = useMemo(
    () => installedModules.find(item => item.manifest.id === moduleId) || null,
    [installedModules, moduleId]
  );
  const familyDefinition = useMemo(
    () => (module ? getModuleFamilyDefinition(module.manifest.id) : undefined),
    [module]
  );
  const familyModules = useMemo(
    () => (module && familyDefinition ? getModuleFamilyModules(installedModules, familyDefinition) : []),
    [module, familyDefinition, installedModules]
  );
  const familyFeatures = familyDefinition?.features;
  const infoModules = useMemo(
    () => (familyModules.length ? familyModules : module ? [module] : []),
    [familyModules, module]
  );
  const familyModuleById = useMemo(
    () => new Map(infoModules.map(item => [item.manifest.id, item])),
    [infoModules]
  );
  const allItems = useMemo(
    () => infoModules.flatMap(item => collectPublicInfoItems(item)),
    [infoModules]
  );
  const isFamilyView = Boolean(familyFeatures?.length && projectId);
  const familyDisplayName = familyDefinition?.displayName || module?.manifest.name || moduleId;
  const commandCount = allItems.filter(item => item.groupId === 'commands').length;
  const supportingCount = allItems.length - commandCount;
  const commerceProduct = commerceProducts.find(product => product.moduleId === moduleId);
  const moduleHistory = useMemo(
    () => history.filter(entry => entry.moduleId === moduleId || entry.moduleName === module?.manifest.name),
    [history, moduleId, module]
  );

  if (isLoading && !module) {
    return (
      <div className={`flex h-full items-center justify-center gap-2 text-sm ${isDarkMode ? 'bg-[#1e1e1e] text-slate-400' : 'bg-white text-slate-500'}`} role="status">
        <Loader2 size={16} className="animate-spin" />
        正在读取模块信息...
      </div>
    );
  }
  if (!module) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-2 text-sm ${isDarkMode ? 'bg-[#1e1e1e] text-slate-400' : 'bg-white text-slate-500'}`}>
        <Package size={28} className="opacity-40" aria-hidden="true" />
        <span>模块未安装或已被卸载：{moduleId}</span>
        <span className="text-xs opacity-70">可点击侧栏「刷新」重新扫描模块索引。</span>
      </div>
    );
  }

  const manifest = module.manifest;
  const isEnabled = Boolean(module.isEnabledForProject);
  const isBasicModule = manifest.id === 'lingbuilder.win32.basic';
  const hasDiagnostics = module.diagnostics.length > 0;
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const actionButtonClass = 'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  const runAction = (type: 'toggle' | 'uninstall' | 'unlink' | 'repair' | 'download' | 'purchase', provider?: 'wechat' | 'alipay') => {
    requestModuleDetailAction({ type, moduleId, provider });
  };

  return (
    <div className={`flex h-full min-w-0 flex-col overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e] text-slate-200' : 'bg-white text-slate-900'}`}>
      <header className={`shrink-0 border-b px-4 pt-3 ${borderClass}`}>
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${isDarkMode ? 'border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-transparent to-sky-500/10' : 'border-violet-200 bg-violet-50'}`}>
            <Package size={24} className="text-violet-400" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold" title={manifest.name}>{manifest.name}</h2>
              <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-500/10 text-sky-700'}`}>{manifest.category}</span>
              {module.isBuiltin && <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-500/10 text-emerald-700'}`}>内置</span>}
              {module.isDevLink && <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-500/10 text-amber-700'}`}>开发源</span>}
              {isFamilyView && <span className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-500/10 text-violet-700'}`}>{familyFeatures?.length || 0} 个功能域</span>}
              {commerceProduct && <span className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-500/10 text-rose-700'}`}><LockKeyhole size={10} className="mr-1 inline" aria-hidden="true" />{commerceProduct.access?.allowed ? '已授权' : commerceProduct.freeWindow ? '限时免费' : `¥${((Number(commerceProduct.offers?.[0]?.priceMinor) || 0) / 100).toFixed(2)}`}</span>}
            </div>
            <div className={`mt-0.5 truncate text-xs ${subtleClass}`}>
              {manifest.id} · v{manifest.version}{manifest.author ? ` · ${manifest.author}` : ''} · {commandCount} 条命令
            </div>
            {manifest.description && (
              <p className={`mt-1 line-clamp-2 break-words text-xs leading-5 ${subtleClass}`} title={manifest.description}>{manifest.description}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`shrink-0 rounded p-1.5 transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'} ${actionButtonClass}`}
              title={standalone ? '关闭模块详情（Esc）' : '关闭模块详情页签'}
              aria-label="关闭模块详情"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {!standalone && (
          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2 pb-2.5" role="toolbar" aria-label="模块操作">
            <button
              type="button"
              disabled={isBasicModule}
              onClick={() => runAction('toggle')}
              title={isBasicModule ? 'Win32窗口基础模块是普通项目的默认基础能力，不能禁用。' : isEnabled ? '禁用当前项目的该模块' : '启用到当前项目'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium ${isEnabled && !isBasicModule
                ? 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                : 'bg-sky-600 text-white hover:bg-sky-500'} ${actionButtonClass}`}
            >
              {isBasicModule || !isEnabled ? <Check size={14} /> : <X size={14} />}
              {isBasicModule ? '基础能力（始终启用）' : isEnabled ? '禁用' : '启用'}
            </button>
            {module.isDevLink ? (
              <button
                type="button"
                onClick={() => runAction('unlink')}
                className={`inline-flex h-8 items-center gap-1.5 rounded border border-amber-500/40 px-3 text-xs text-amber-300 hover:bg-amber-500/10 ${actionButtonClass}`}
                title="取消链接开发源（只移除链接，不删除源目录文件）"
              >
                <Link2 size={14} />
                取消链接
              </button>
            ) : (
              <button
                type="button"
                disabled={module.isBuiltin}
                onClick={() => runAction('uninstall')}
                className={`inline-flex h-8 items-center gap-1.5 rounded border border-red-500/40 px-3 text-xs text-red-300 hover:bg-red-500/10 ${actionButtonClass}`}
                title={module.isBuiltin ? '内置模块不能卸载。' : '从工作区卸载该模块'}
              >
                <Trash2 size={14} />
                卸载
              </button>
            )}
            {hasDiagnostics && module.bundledRepairable && (
              <button
                type="button"
                onClick={() => runAction('repair')}
                className={`inline-flex h-8 items-center gap-1.5 rounded border border-amber-500/40 px-3 text-xs text-amber-300 hover:bg-amber-500/10 ${actionButtonClass}`}
                title="用安装包随包副本整体重建本模块目录"
              >
                <ShieldCheck size={14} />
                修复重装
              </button>
            )}
            {commerceProduct?.access?.allowed && (
              <button
                type="button"
                onClick={() => runAction('download')}
                className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs ${isDarkMode ? 'border-slate-500/40 text-slate-300 hover:bg-slate-500/10' : 'border-slate-300 text-slate-700 hover:bg-slate-500/10'} ${actionButtonClass}`}
                title="重新下载安装；如需覆盖重装可重新下载"
              >
                <Download size={14} />
                下载并预览安装
              </button>
            )}
            {commerceProduct && !commerceProduct.access?.allowed && Array.isArray(commerceProduct.offers) && commerceProduct.offers.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => runAction('purchase', 'wechat')}
                  className={`inline-flex h-8 items-center gap-1.5 rounded border border-emerald-500/40 px-3 text-xs text-emerald-300 hover:bg-emerald-500/10 ${actionButtonClass}`}
                >
                  微信支付{commerceProduct.offers?.[0] ? ` ¥${(Number(commerceProduct.offers[0].priceMinor) / 100).toFixed(2)}` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('purchase', 'alipay')}
                  className={`inline-flex h-8 items-center gap-1.5 rounded border border-sky-500/40 px-3 text-xs text-sky-300 hover:bg-sky-500/10 ${actionButtonClass}`}
                >
                  支付宝{commerceProduct.offers?.[0] ? ` ¥${(Number(commerceProduct.offers[0].priceMinor) / 100).toFixed(2)}` : ''}
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex min-w-0 gap-1" role="tablist" aria-label="模块详情分区">
          {DETAIL_TABS.filter(tab => !tab.embeddedOnly || !standalone).map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs transition-colors ${activeTab === tab.id
                ? `${borderClass} border-sky-500 font-semibold text-sky-300`
                : `border-transparent ${subtleClass} hover:text-white`}`}
            >
              {tab.id === 'overview' && <Info size={13} aria-hidden="true" />}
              {tab.id === 'interface' && <Wrench size={13} aria-hidden="true" />}
              {tab.id === 'docs' && <FileText size={13} aria-hidden="true" />}
              {tab.id === 'examples' && <Code2 size={13} aria-hidden="true" />}
              {tab.id === 'history' && <History size={13} aria-hidden="true" />}
              {tab.label}
              {tab.id === 'history' && moduleHistory.length > 0 && <span className="text-[10px] opacity-70">{moduleHistory.length}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <ModuleOverviewTab
            module={module}
            familyDefinition={familyDefinition}
            familyFeatures={isFamilyView ? familyFeatures : undefined}
            familyModuleById={familyModuleById}
            isDarkMode={isDarkMode}
            onToggleFeature={featureModule => requestModuleDetailAction({ type: 'toggle', moduleId: featureModule.manifest.id })}
          />
        )}
        {activeTab === 'interface' && (
          <ModuleInterfaceTab
            module={module}
            allItems={allItems}
            isFamilyView={isFamilyView}
            familyDisplayName={familyDisplayName}
            familyDefinition={familyDefinition}
            familyFeatures={isFamilyView ? familyFeatures : undefined}
            familyModuleById={familyModuleById}
            isDarkMode={isDarkMode}
            onToggleFeature={featureModule => requestModuleDetailAction({ type: 'toggle', moduleId: featureModule.manifest.id })}
          />
        )}
        {(activeTab === 'docs' || activeTab === 'examples') && (
          <ModuleDocumentTab
            items={allItems.filter(item => item.groupId === (activeTab === 'docs' ? 'docs' : 'examples'))}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'history' && !standalone && (
          <div className={`h-full overflow-auto p-4 ${isDarkMode ? 'bg-[#1a1a1e]' : 'bg-slate-50'}`}>
            {moduleHistory.length === 0 ? (
              <div className={`text-xs ${subtleClass}`}>该模块暂无操作历史。</div>
            ) : (
              <div className={`divide-y rounded border ${borderClass} ${isDarkMode ? 'divide-white/5 bg-[#222226]' : 'divide-slate-200 bg-white'}`}>
                {moduleHistory.map(item => (
                  <div key={item.id} className="p-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="break-words text-xs font-semibold">{item.summary}</span>
                      <span className={`text-[10px] ${subtleClass}`}>{new Date(item.time).toLocaleString()}</span>
                    </div>
                    <div className={`mt-1 whitespace-pre-wrap break-words text-[11px] ${subtleClass}`}>{item.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className={`flex shrink-0 items-center justify-between gap-4 border-t px-4 py-1.5 text-[11px] ${borderClass} ${subtleClass}`}>
        <span className="truncate">
          {hasDiagnostics && <AlertTriangle size={11} className="mr-1 inline text-amber-400" aria-hidden="true" />}
          {isFamilyView
            ? `共 ${commandCount} 条接口命令，另有 ${supportingCount} 项类型、控件或构建信息`
            : `共 ${allItems.length} 项公开能力`}
        </span>
        {!standalone && <span className="shrink-0">{isEnabled ? '当前项目已引用' : '当前项目未引用'}</span>}
      </footer>
    </div>
  );
}

function ModuleOverviewTab({
  module,
  familyDefinition,
  familyFeatures,
  familyModuleById,
  isDarkMode,
  onToggleFeature
}: {
  module: InstalledModule;
  familyDefinition?: ModuleFamilyDefinition;
  familyFeatures?: readonly ModuleFamilyFeatureDefinition[];
  familyModuleById: ReadonlyMap<string, InstalledModule>;
  isDarkMode: boolean;
  onToggleFeature: (module: InstalledModule) => void;
}) {
  const manifest = module.manifest;
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const surfaceClass = isDarkMode ? 'bg-[#222226]' : 'bg-white';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const targets = manifest.targets || [];
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0 space-y-6">
            {module.diagnostics.length > 0 && (
              <div className={`rounded-lg border p-3.5 text-xs leading-5 whitespace-pre-wrap ${isDarkMode ? 'border-amber-500/30 bg-amber-500/5 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={13} aria-hidden="true" />模块诊断</div>
                {module.diagnostics.join('\n')}
              </div>
            )}
            {familyFeatures && familyFeatures.length > 0 && (
              <ModuleFamilyFeaturePanel
                family={familyDefinition}
                features={familyFeatures}
                moduleById={familyModuleById}
                isDarkMode={isDarkMode}
                onToggleFeature={onToggleFeature}
              />
            )}
            <OverviewSection title="模块说明">
              <p className={`break-words text-[13px] leading-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{manifest.description || '该模块没有填写说明。'}</p>
              {(manifest.tags?.length || manifest.license) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(manifest.tags || []).map(tag => (
                    <span key={tag} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{tag}</span>
                  ))}
                  {manifest.license && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{manifest.license} 许可</span>
                  )}
                </div>
              )}
            </OverviewSection>
            {targets.length > 0 && (
              <OverviewSection title={`构建目标 · ${targets.length}`}>
                <div className="grid gap-3">
                  {targets.map(target => {
                    const stats: Array<{ label: string; value: number }> = [
                      { label: '头文件', value: (target.headers || []).length },
                      { label: '源码', value: (target.sources || []).length },
                      { label: '库文件', value: (target.libs || []).length },
                      { label: '运行时', value: (target.runtimeFiles || []).length },
                      { label: '包含目录', value: (target.includeDirs || []).length }
                    ];
                    const hasFiles = stats.some(stat => stat.value > 0);
                    const defines = target.defines || [];
                    return (
                      <div key={target.id} className={`overflow-hidden rounded-lg border ${borderClass} ${surfaceClass}`}>
                        <div className={`flex flex-wrap items-center gap-2 px-3.5 py-2.5 ${hasFiles || defines.length > 0 ? 'border-b' : ''} ${borderClass}`}>
                          <span className="font-mono text-xs font-semibold text-sky-300">{target.id}</span>
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{target.platform} · {target.arch}</span>
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{target.toolchain}</span>
                          {!hasFiles && (
                            <span className={`ml-auto text-[10px] ${subtleClass}`}>纯命令注册，无随包原生文件</span>
                          )}
                        </div>
                        {hasFiles && (
                          <div className={`grid grid-cols-2 gap-px sm:grid-cols-5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                            {stats.map(stat => (
                              <div key={stat.label} className={`px-3.5 py-2.5 ${surfaceClass}`}>
                                <div className={`text-[10px] uppercase tracking-wide ${subtleClass}`}>{stat.label}</div>
                                <div className="mt-0.5 text-sm font-semibold tabular-nums">{stat.value}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {defines.length > 0 && (
                          <div className={`flex flex-wrap gap-1.5 border-t px-3.5 py-2.5 ${borderClass}`}>
                            {defines.map(define => (
                              <code key={define} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${isDarkMode ? 'bg-black/25 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>{define}</code>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </OverviewSection>
            )}
          </main>
          <aside className="min-w-0">
            <div className="lg:sticky lg:top-5">
              <section className={`overflow-hidden rounded-lg border ${borderClass} ${surfaceClass}`}>
                <h3 className={`border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider ${borderClass} ${subtleClass}`}>安装信息</h3>
                <dl>
                  {[
                    {
                      label: '标识符',
                      value: <IdentifierValue value={manifest.id} isDarkMode={isDarkMode} />
                    },
                    { label: '版本', value: <span className="tabular-nums">v{manifest.version}</span> },
                    { label: '分类', value: manifest.category },
                    ...(manifest.author ? [{ label: '作者', value: manifest.author }] : []),
                    ...(manifest.minLingBuilderVersion ? [{ label: '最低 IDE 版本', value: `v${manifest.minLingBuilderVersion}` }] : []),
                    { label: '安装路径', value: <span className="font-mono text-[11px] [overflow-wrap:anywhere]">{module.installPath}</span> },
                    ...(module.sha256 ? [{ label: 'SHA-256', value: <span className="font-mono text-[11px] [overflow-wrap:anywhere]">{module.sha256}</span> }] : []),
                    { label: '依赖目标', value: <span className="tabular-nums">{targets.length} 个平台目标</span> }
                  ].map(row => (
                    <div key={row.label} className={`border-b px-3.5 py-2 last:border-b-0 ${borderClass}`}>
                      <dt className={`text-[10px] uppercase tracking-wide ${subtleClass}`}>{row.label}</dt>
                      <dd className={`mt-0.5 text-xs break-words [overflow-wrap:anywhere] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function IdentifierValue({ value, isDarkMode }: { value: string; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-1.5">
      <span className="min-w-0 font-mono text-[11px] [overflow-wrap:anywhere]">{value}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }).catch(() => undefined);
        }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'} cursor-pointer transition-colors`}
        title="复制模块标识符"
        aria-label="复制模块标识符"
      >
        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      </button>
    </span>
  );
}

function OverviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <span className="h-3.5 w-0.5 rounded-full bg-sky-400" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function ModuleInterfaceTab({
  module,
  allItems,
  isFamilyView,
  familyDisplayName,
  familyDefinition,
  familyFeatures,
  familyModuleById,
  isDarkMode,
  onToggleFeature
}: {
  module: InstalledModule;
  allItems: PublicInfoItem[];
  isFamilyView: boolean;
  familyDisplayName: string;
  familyDefinition?: ModuleFamilyDefinition;
  familyFeatures?: readonly ModuleFamilyFeatureDefinition[];
  familyModuleById: ReadonlyMap<string, InstalledModule>;
  isDarkMode: boolean;
  onToggleFeature: (module: InstalledModule) => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<PublicGroupId, boolean>>({
    types: true,
    constants: true,
    commands: true,
    controls: true,
    snippets: false,
    dependencies: false,
    docs: false,
    examples: false
  });
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>(() => Object.fromEntries(
    (familyFeatures || []).map((feature, index) => [feature.moduleId, index === 0])
  ));
  const normalizedSearch = normalizeModulePublicInfoSearchText(searchText);
  const searchedItems = useMemo(
    () => normalizedSearch
      ? allItems.filter(item => item.searchText.includes(normalizedSearch))
      : allItems,
    [allItems, normalizedSearch]
  );
  const visibleItems = useMemo(
    () => selectedFeatureId
      ? searchedItems.filter(item => item.sourceModuleId === selectedFeatureId)
      : searchedItems,
    [searchedItems, selectedFeatureId]
  );
  const selectedItem = allItems.find(item => item.id === selectedItemId) || null;
  const groups = getPublicInfoGroups(visibleItems);
  const manifest = module.manifest;
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const familyCommandCount = allItems.filter(item => item.groupId === 'commands').length;
  const familySupportingItemCount = allItems.length - familyCommandCount;

  useEffect(() => {
    if (!normalizedSearch) return;
    setExpandedGroups({
      types: true,
      constants: true,
      commands: true,
      controls: true,
      snippets: true,
      dependencies: true,
      docs: true,
      examples: true
    });
    setExpandedFeatures(Object.fromEntries((familyFeatures || []).map(feature => [feature.moduleId, true])));
  }, [familyFeatures, normalizedSearch]);

  return (
    <div className="flex h-full min-h-0 max-md:flex-col">
      <aside className={`flex min-h-0 w-[320px] shrink-0 flex-col border-r max-md:h-[45%] max-md:w-full max-md:border-b max-md:border-r-0 ${borderClass}`}>
        <div className={`border-b p-2.5 ${borderClass}`}>
          <label className={`flex h-8 min-w-0 items-center gap-2 rounded border px-2 ${borderClass} ${isDarkMode ? 'bg-[#181818]' : 'bg-slate-50'}`}>
            <Search size={13} className="shrink-0 text-slate-400" />
            <input
              value={searchText}
              onChange={event => {
                setSearchText(event.target.value);
                setSelectedItemId(null);
              }}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              placeholder="搜索命令、类型、声明或备注..."
              aria-label="搜索模块公开信息"
            />
            {searchText && (
              <button type="button" onClick={() => setSearchText('')} className="rounded p-0.5 text-slate-400 hover:text-white" title="清空搜索">
                <X size={12} />
              </button>
            )}
          </label>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="模块公开信息分类">
          <button
            type="button"
            onClick={() => {
              setSelectedItemId(null);
              setSelectedFeatureId(null);
            }}
            className={`mb-1 flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
              selectedItemId === null && selectedFeatureId === null
                ? isDarkMode ? 'bg-sky-500/20 text-sky-100' : 'bg-sky-100 text-sky-900'
                : isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'
            }`}
          >
            <Package size={14} className="shrink-0 text-violet-400" />
            <span className="min-w-0 flex-1 truncate font-semibold">{manifest.name}</span>
            <span className={subtleClass}>{isFamilyView ? familyCommandCount : visibleItems.length}</span>
          </button>

          {isFamilyView && (
            <div className="mb-2 min-w-0" aria-label={`${familyDisplayName} 功能分类`}>
              <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${subtleClass}`}>功能分类</div>
              {(familyFeatures || []).map(feature => {
                const featureModule = familyModuleById.get(feature.moduleId);
                if (!featureModule) return null;
                return (
                  <ModuleFamilyFeatureTreeGroup
                    key={feature.moduleId}
                    feature={feature}
                    module={featureModule}
                    items={searchedItems.filter(item => item.sourceModuleId === feature.moduleId)}
                    isOpen={Boolean(expandedFeatures[feature.moduleId])}
                    isDarkMode={isDarkMode}
                    selectedFeatureId={selectedFeatureId}
                    selectedItemId={selectedItemId}
                    onToggle={() => {
                      setSelectedItemId(null);
                      setSelectedFeatureId(feature.moduleId);
                      setExpandedFeatures(previous => ({
                        ...previous,
                        [feature.moduleId]: !previous[feature.moduleId]
                      }));
                    }}
                    onSelectItem={item => {
                      setSelectedFeatureId(feature.moduleId);
                      setSelectedItemId(item.id);
                    }}
                  />
                );
              })}
            </div>
          )}

          {!isFamilyView && groups.map(group => (
            <PublicInfoTreeGroup
              key={group.id}
              group={group}
              isOpen={expandedGroups[group.id]}
              isDarkMode={isDarkMode}
              selectedItemId={selectedItemId}
              onToggle={() => setExpandedGroups(previous => ({ ...previous, [group.id]: !previous[group.id] }))}
              onSelect={setSelectedItemId}
            />
          ))}
        </nav>
        <div className={`border-t p-3 text-[11px] leading-5 ${borderClass}`}>
          <div className="font-semibold">模块说明</div>
          <div className={`mt-1 break-words ${subtleClass}`}>{manifest.description}</div>
          {module.diagnostics.length > 0 && (
            <div className="mt-2 break-words text-amber-300">{module.diagnostics.join('；')}</div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4">
        {selectedItem ? (
          <PublicInfoDetail
            item={selectedItem}
            documentItems={allItems.filter(item => item.groupId === 'docs' || item.groupId === 'examples')}
            isDarkMode={isDarkMode}
            onOpenDocument={(sourceModuleId, documentPath) => {
              const target = allItems.find(item => (
                (item.groupId === 'docs' || item.groupId === 'examples')
                && item.sourceModuleId === sourceModuleId
                && item.declaration === documentPath
              ));
              if (!target) return;
              setSelectedItemId(target.id);
              if (isFamilyView) setSelectedFeatureId(sourceModuleId);
            }}
          />
        ) : (
          <div className="space-y-4">
            {isFamilyView && (
              <ModuleFamilyFeaturePanel
                family={familyDefinition}
                features={familyFeatures || []}
                moduleById={familyModuleById}
                isDarkMode={isDarkMode}
                onToggleFeature={onToggleFeature}
              />
            )}
            {!isFamilyView && <PublicInfoTable
              headers={['名称', '声明/内容', '备注']}
              rows={visibleItems
                .filter(item => item.groupId !== 'dependencies')
                .slice(0, 400)
                .map(item => [item.name, item.declaration, item.description])}
              isDarkMode={isDarkMode}
            />}
            {!isFamilyView && visibleItems.filter(item => item.groupId !== 'dependencies').length > 400 && (
              <div className={`text-xs ${subtleClass}`}>仅显示前 400 项，请使用搜索缩小范围，或切换上方分区浏览文档与示例。</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ModuleDocumentTab({
  items,
  isDarkMode
}: {
  items: PublicInfoItem[];
  isDarkMode: boolean;
}) {
  const [selected, setSelected] = useState<PublicInfoItem | null>(null);
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  useEffect(() => {
    setSelected(current => (current && items.some(item => item.id === current.id) ? current : null));
  }, [items]);
  if (items.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center text-xs ${subtleClass}`}>该模块没有登记此类内容。</div>
    );
  }
  if (selected) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 ${borderClass}`}>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`rounded border px-2 py-1 text-[11px] ${isDarkMode ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
          >
            返回列表
          </button>
          <span className="truncate text-xs font-semibold">{selected.name}</span>
          <span className={`truncate text-[10px] ${subtleClass}`}>{selected.declaration}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <React.Suspense fallback={(
            <div className={`flex min-h-56 items-center justify-center text-sm ${subtleClass}`} role="status">
              正在加载文档阅读器...
            </div>
          )}>
            <ModuleDocumentPreview
              moduleId={selected.sourceModuleId}
              title={selected.name}
              documentPath={selected.declaration}
              declaredDocuments={items
                .filter(candidate => candidate.sourceModuleId === selected.sourceModuleId)
                .map(candidate => ({ title: candidate.name, path: candidate.declaration }))}
              isDarkMode={isDarkMode}
              onOpenDocument={documentPath => {
                const target = items.find(item => item.sourceModuleId === selected.sourceModuleId && item.declaration === documentPath);
                if (target) setSelected(target);
              }}
            />
          </React.Suspense>
        </div>
      </div>
    );
  }
  return (
    <div className={`h-full overflow-auto p-4 ${isDarkMode ? 'bg-[#1a1a1e]' : 'bg-slate-50'}`}>
      <div className="mx-auto grid max-w-4xl gap-2">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className={`group rounded border p-3 text-left transition-colors hover:border-sky-500/40 hover:bg-sky-500/5 ${borderClass} ${isDarkMode ? 'bg-[#222226]' : 'bg-white'}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {item.groupId === 'docs' ? <FileText size={14} className="shrink-0 text-sky-400" /> : <Code2 size={14} className="shrink-0 text-lime-300" />}
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.name}</span>
              <ArrowUpRight size={13} className="shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </div>
            <div className={`mt-1 truncate font-mono text-[10px] ${subtleClass}`}>{item.declaration}</div>
            <div className={`mt-1 line-clamp-2 break-words text-[11px] leading-4 ${subtleClass}`}>{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModuleFamilyFeatureTreeGroup({
  feature,
  module,
  items,
  isOpen,
  isDarkMode,
  selectedFeatureId,
  selectedItemId,
  onToggle,
  onSelectItem
}: {
  feature: ModuleFamilyFeatureDefinition;
  module: InstalledModule;
  items: PublicInfoItem[];
  isOpen: boolean;
  isDarkMode: boolean;
  selectedFeatureId: string | null;
  selectedItemId: string | null;
  onToggle: () => void;
  onSelectItem: (item: PublicInfoItem) => void;
}) {
  const commandItems = items.filter(item => item.groupId === 'commands');
  const supportingItems = items.filter(item => item.groupId !== 'commands');
  const commandCategories = Array.from(commandItems.reduce((groups, item) => {
    const category = item.commandCategory || '其他接口';
    const current = groups.get(category) || [];
    current.push(item);
    groups.set(category, current);
    return groups;
  }, new Map<string, PublicInfoItem[]>()));
  const officialCount = commandItems.filter(item => item.officialCapability).length;
  const aggregateCount = commandItems.filter(item => item.capabilityKind === 'aggregate').length;
  const isSelected = selectedFeatureId === feature.moduleId && selectedItemId === null;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-xs transition-colors ${
          isSelected
            ? isDarkMode ? 'bg-sky-500/20 text-sky-100' : 'bg-sky-100 text-sky-900'
            : isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'
        }`}
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
        <span className={`h-2 w-2 shrink-0 rounded-full ${module.isEnabledForProject ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden="true" />
        <span className="sr-only">{module.isEnabledForProject ? '已启用' : '未启用'}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{feature.label}</span>
        {feature.tier === 'advanced' && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-300">高级</span>}
        <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{officialCount || commandItems.length}</span>
        {aggregateCount > 0 && <span className="text-[9px] text-slate-500">+{aggregateCount}批量</span>}
      </button>
      {isOpen && (
        <div className="ml-4 border-l border-slate-500/25 pl-1">
          {commandCategories.length > 1 || commandCategories.some(([category]) => category !== '其他接口')
            ? commandCategories.map(([category, categoryItems]) => (
              <ModuleFeatureCommandCategory
                key={category}
                category={category}
                items={categoryItems}
                isDarkMode={isDarkMode}
                selectedItemId={selectedItemId}
                onSelectItem={onSelectItem}
              />
            ))
            : commandItems.slice(0, TREE_ITEM_LIMIT).map(item => (
              <PublicInfoTreeItem
                key={item.id}
                item={item}
                isDarkMode={isDarkMode}
                isSelected={selectedItemId === item.id}
                onSelect={() => onSelectItem(item)}
              />
            ))}
          {commandItems.length === 0 && supportingItems.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-slate-500">暂无匹配的接口命令</div>
          )}
          {commandItems.length > TREE_ITEM_LIMIT && (
            <div className="px-2 py-1 text-[10px] text-slate-500">仅显示前 {TREE_ITEM_LIMIT} 条命令，请使用搜索缩小范围。</div>
          )}
          {supportingItems.length > 0 && (
            <div className="mt-1 border-t border-slate-500/20 pt-1">
              <div className="px-2 py-1 text-[9px] font-semibold text-slate-500">其他公开信息</div>
              {supportingItems.slice(0, 24).map(item => (
                <PublicInfoTreeItem
                  key={item.id}
                  item={item}
                  isDarkMode={isDarkMode}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => onSelectItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleFeatureCommandCategory({
  category,
  items,
  isDarkMode,
  selectedItemId,
  onSelectItem
}: {
  category: string;
  items: PublicInfoItem[];
  isDarkMode: boolean;
  selectedItemId: string | null;
  onSelectItem: (item: PublicInfoItem) => void;
}) {
  const officialCount = items.filter(item => item.officialCapability).length;
  const managedCount = items.filter(item => item.capabilityKind === 'managed').length;
  const replacementCount = items.filter(item => item.capabilityKind === 'secureReplacement').length;
  return (
    <details className="group/category min-w-0" open={Boolean(selectedItemId && items.some(item => item.id === selectedItemId)) || undefined}>
      <summary className={`flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold marker:content-none ${isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'}`}>
        <ChevronRight size={12} className="shrink-0 text-slate-500 transition-transform group-open/category:rotate-90" />
        <span className="min-w-0 flex-1 truncate">{category}</span>
        {managedCount > 0 && <span className="rounded bg-slate-500/15 px-1 py-0.5 text-[9px] text-slate-400">托管 {managedCount}</span>}
        {replacementCount > 0 && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-300">替代 {replacementCount}</span>}
        <span className="text-[10px] text-slate-500">{officialCount || items.length}</span>
      </summary>
      <div className="ml-3 border-l border-slate-500/20 pl-1">
        {items.slice(0, TREE_ITEM_LIMIT).map(item => (
          <PublicInfoTreeItem
            key={item.id}
            item={item}
            isDarkMode={isDarkMode}
            isSelected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item)}
          />
        ))}
      </div>
    </details>
  );
}

function ModuleFamilyFeaturePanel({
  family,
  features,
  moduleById,
  isDarkMode,
  onToggleFeature
}: {
  family?: ModuleFamilyDefinition;
  features: readonly ModuleFamilyFeatureDefinition[];
  moduleById: ReadonlyMap<string, InstalledModule>;
  isDarkMode: boolean;
  onToggleFeature?: (module: InstalledModule) => void;
}) {
  const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  return (
    <section className={`overflow-hidden rounded-md border ${borderClass}`} aria-labelledby="module-family-features-title">
      <div className={`border-b px-3 py-2 ${borderClass}`}>
        <h3 id="module-family-features-title" className="text-sm font-semibold">{family?.displayName || '模块'} 功能范围</h3>
        <p className={`mt-0.5 text-xs leading-5 ${subtleClass}`}>
          {family?.featurePanelDescription || '标准功能随主模块一键启用；高级功能需要单独确认。'}
        </p>
      </div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {features.map(feature => {
          const featureModule = moduleById.get(feature.moduleId);
          if (!featureModule) return null;
          const enabled = Boolean(featureModule.isEnabledForProject);
          const commands = featureModule.manifest.contributes?.commands || [];
          const officialCount = commands.filter(command => command.officialCapability).length;
          const singleCount = commands.filter(command => command.capabilityKind === 'single').length;
          const managedCount = commands.filter(command => command.capabilityKind === 'managed').length;
          const replacementCount = commands.filter(command => command.capabilityKind === 'secureReplacement').length;
          const aggregateCount = commands.filter(command => command.capabilityKind === 'aggregate').length;
          const commandCount = commands.length;
          return (
            <div key={feature.moduleId} className={`min-w-0 p-3 ${isDarkMode ? 'bg-[#242424]' : 'bg-white'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} aria-hidden="true" />
                <strong className="min-w-0 flex-1 truncate text-xs">{feature.label}</strong>
                <span className={`text-[10px] ${subtleClass}`}>{officialCount ? `${officialCount} 官方能力` : `${commandCount} 命令`}</span>
              </div>
              <p className={`mt-1 min-h-10 text-[11px] leading-5 ${subtleClass}`}>{feature.description}</p>
              {officialCount > 0 && (
                <p className={`mt-1 text-[10px] leading-4 ${subtleClass}`}>
                  {singleCount} 个单项命令 · {managedCount} 个自动管理 · {replacementCount} 个安全替代 · {aggregateCount} 个批量入口
                </p>
              )}
              {feature.tier === 'advanced' ? (
                <button
                  type="button"
                  onClick={() => onToggleFeature?.(featureModule)}
                  className={`mt-2 min-h-9 w-full rounded border px-2 text-xs transition-colors ${
                    enabled
                      ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                      : 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10'
                  }`}
                  aria-pressed={enabled}
                >
                  {enabled ? `禁用${feature.label}` : `启用${feature.label}`}
                </button>
              ) : (
                <div className={`mt-2 flex min-h-9 items-center justify-center rounded border px-2 text-[11px] ${enabled ? 'border-emerald-500/30 text-emerald-300' : `${borderClass} ${subtleClass}`}`}>
                  {enabled ? '已随标准功能启用' : '等待启用标准功能'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PublicInfoTreeGroup({
  group,
  isOpen,
  isDarkMode,
  selectedItemId,
  onToggle,
  onSelect
}: {
  group: ReturnType<typeof getPublicInfoGroups>[number];
  isOpen: boolean;
  isDarkMode: boolean;
  selectedItemId: string | null;
  onToggle: () => void;
  onSelect: (itemId: string) => void;
}) {
  const items = group.items.slice(0, TREE_ITEM_LIMIT);
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-xs ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
        {getGroupIcon(group.id)}
        <span className="min-w-0 flex-1 truncate font-semibold">{group.label}</span>
        <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{group.items.length}</span>
      </button>
      {isOpen && (
        <div className="ml-4 border-l border-slate-500/25 pl-1">
          {items.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-slate-500">暂无公开项</div>
          ) : items.map(item => (
            <PublicInfoTreeItem
              key={item.id}
              item={item}
              isDarkMode={isDarkMode}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelect(item.id)}
            />
          ))}
          {group.items.length > TREE_ITEM_LIMIT && (
            <div className="px-2 py-1 text-[10px] text-slate-500">
              仅显示前 {TREE_ITEM_LIMIT} 项，请使用搜索缩小范围。
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PublicInfoTreeItem({
  item,
  isDarkMode,
  isSelected,
  onSelect
}: {
  item: PublicInfoItem;
  isDarkMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-w-0 items-start gap-1.5 rounded px-2 py-1 text-left ${
        isSelected
          ? isDarkMode ? 'bg-sky-500/25 text-sky-100' : 'bg-sky-100 text-sky-900'
          : isDarkMode ? 'text-slate-300 hover:bg-sky-500/15 hover:text-sky-200' : 'text-slate-700 hover:bg-sky-50 hover:text-sky-800'
      }`}
      title={`${item.name}\n${item.declaration}`}
    >
      {item.groupId === 'commands'
        ? <FileCode className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
        : getGroupIcon(item.groupId)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px]">{item.name}</span>
        {item.capabilityKind === 'managed' && <span className="mr-1 inline rounded bg-slate-500/15 px-1 text-[8px] text-slate-400">Bridge 自动管理</span>}
        {item.capabilityKind === 'secureReplacement' && <span className="mr-1 inline rounded bg-amber-500/15 px-1 text-[8px] text-amber-300">安全替代</span>}
        {item.capabilityKind === 'aggregate' && <span className="mr-1 inline rounded bg-violet-500/15 px-1 text-[8px] text-violet-300">批量入口</span>}
        <span className="block truncate text-[9px] text-slate-500">{item.declaration}</span>
      </span>
    </button>
  );
}

function PublicInfoDetail({
  item,
  documentItems,
  isDarkMode,
  onOpenDocument
}: {
  item: PublicInfoItem;
  documentItems: PublicInfoItem[];
  isDarkMode: boolean;
  onOpenDocument: (moduleId: string, documentPath: string) => void;
}) {
  if (item.groupId === 'docs' || item.groupId === 'examples') {
    return (
      <React.Suspense fallback={(
        <div className={`flex min-h-56 items-center justify-center rounded border text-sm ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`} role="status">
          正在加载文档阅读器...
        </div>
      )}>
        <ModuleDocumentPreview
          moduleId={item.sourceModuleId}
          title={item.name}
          documentPath={item.declaration}
          declaredDocuments={documentItems
            .filter(candidate => candidate.sourceModuleId === item.sourceModuleId)
            .map(candidate => ({ title: candidate.name, path: candidate.declaration }))}
          isDarkMode={isDarkMode}
          onOpenDocument={documentPath => onOpenDocument(item.sourceModuleId, documentPath)}
        />
      </React.Suspense>
    );
  }
  return <PublicInfoDeclarationDetail item={item} isDarkMode={isDarkMode} />;
}

function PublicInfoDeclarationDetail({ item, isDarkMode }: { item: PublicInfoItem; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(item.copyText || item.declaration);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <section className={`rounded border p-4 ${isDarkMode ? 'border-sky-500/30 bg-sky-500/5' : 'border-sky-200 bg-sky-50'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className={`rounded px-2 py-1 text-[11px] ${isDarkMode ? 'bg-sky-500/15 text-sky-200' : 'bg-sky-100 text-sky-800'}`}>
            {item.kind}
          </span>
          <h3 className="mt-3 break-words text-lg font-semibold text-cyan-300">{item.name}</h3>
          <pre className={`mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded border px-3 py-2 text-xs ${isDarkMode ? 'border-white/10 bg-black/20 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}>
            {item.declaration}
          </pre>
          <p className={`mt-3 break-words text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {item.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs ${isDarkMode ? 'border-white/10 text-slate-200 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制声明代码'}
        </button>
      </div>
      {item.fields && item.fields.length > 0 && (
        <dl className={`mt-5 overflow-hidden rounded border text-xs ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          {item.fields.map(field => (
            <div key={`${field.label}:${field.value}`} className={`grid grid-cols-[120px_minmax(0,1fr)] border-b last:border-b-0 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <dt className={`px-3 py-2 font-semibold ${isDarkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>{field.label}</dt>
              <dd className="break-all px-3 py-2 font-mono">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function PublicInfoTable({ headers, rows, isDarkMode }: { headers: string[]; rows: string[][]; isDarkMode: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded border border-dashed border-slate-500/30 p-4 text-sm text-slate-500">该模块没有匹配的公开信息。</div>;
  }
  return (
    <div className={`overflow-x-auto rounded-lg border ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
      <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-[13px]">
        <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-[#2a2a30] text-slate-200' : 'bg-emerald-50 text-slate-800'}`}>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`border-b px-3.5 py-2 font-semibold ${isDarkMode ? 'border-white/10' : 'border-slate-200'} ${index === 0 ? 'w-[22%]' : index === 1 ? 'w-[36%]' : ''}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join(':')}:${rowIndex}`} className={`transition-colors hover:bg-sky-500/5 ${isDarkMode ? 'odd:bg-[#1f1f1f] even:bg-[#242424]' : 'odd:bg-white even:bg-slate-50'}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}:${cellIndex}`}
                  className={`border-b px-3.5 py-2 align-top leading-5 ${isDarkMode ? 'border-white/5' : 'border-slate-200'} ${
                    cellIndex === 0 ? 'text-blue-300' : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  title={cell}
                >
                  <div className="break-words [overflow-wrap:anywhere]">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getGroupIcon(groupId: PublicGroupId) {
  switch (groupId) {
    case 'types': return <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
    case 'constants': return <Hash className="h-3.5 w-3.5 shrink-0 text-purple-400" />;
    case 'commands': return <Wrench className="h-3.5 w-3.5 shrink-0 text-cyan-400" />;
    case 'controls': return <Monitor className="h-3.5 w-3.5 shrink-0 text-violet-300" />;
    case 'snippets': return <Code2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    case 'dependencies': return <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
    case 'docs': return <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />;
    case 'examples': return <Code2 className="h-3.5 w-3.5 shrink-0 text-lime-300" />;
    default: return <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
  }
}
