import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileCode,
  FileText,
  Info,
  Monitor,
  Package,
  Search,
  Wrench,
  X
} from 'lucide-react';
import type { ModuleFamilyDefinition, ModuleFamilyFeatureDefinition } from '../services/modules/moduleFamilies';
import { normalizeModulePublicInfoSearchText } from '../services/modules/modulePublicInfoSearch';
import type { InstalledModule, ModuleTargetContribution } from '../services/modules/types';

type PublicGroupId = 'types' | 'commands' | 'controls' | 'snippets' | 'dependencies' | 'docs';
type PublicItemKind = '类型/类' | '命令接口' | '设计器控件' | '代码片段' | 'C++ 依赖' | '文档';

interface PublicInfoItem {
  id: string;
  sourceModuleId: string;
  groupId: PublicGroupId;
  kind: PublicItemKind;
  name: string;
  declaration: string;
  description: string;
  searchText: string;
  copyText?: string;
  fields?: Array<{ label: string; value: string }>;
  commandCategory?: string;
  capabilityKind?: 'single' | 'aggregate' | 'managed' | 'secureReplacement';
  officialCapability?: boolean;
}

interface ModulePublicInfoDialogProps {
  module: InstalledModule;
  familyDefinition?: ModuleFamilyDefinition;
  familyModules?: InstalledModule[];
  familyFeatures?: readonly ModuleFamilyFeatureDefinition[];
  isDarkMode: boolean;
  isChangingFeature?: boolean;
  onToggleFeature?: (module: InstalledModule) => void;
  onClose: () => void;
}

const TREE_ITEM_LIMIT = 200;
const OVERVIEW_ROW_LIMIT = 400;

export default function ModulePublicInfoDialog({
  module,
  familyDefinition,
  familyModules,
  familyFeatures,
  isDarkMode,
  isChangingFeature = false,
  onToggleFeature,
  onClose
}: ModulePublicInfoDialogProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<PublicGroupId, boolean>>({
    types: true,
    commands: true,
    controls: true,
    snippets: false,
    dependencies: false,
    docs: false
  });
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>(() => Object.fromEntries(
    (familyFeatures || []).map((feature, index) => [feature.moduleId, index === 0])
  ));
  const manifest = module.manifest;
  const infoModules = useMemo(
    () => familyModules?.length ? familyModules : [module],
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
  const overviewItems = visibleItems.filter(item => (
    item.groupId === 'types'
    || item.groupId === 'commands'
    || item.groupId === 'controls'
    || item.groupId === 'snippets'
  ));
  const panelClass = isDarkMode
    ? 'border-[#3c3c3c] bg-[#1f1f1f] text-slate-100'
    : 'border-slate-300 bg-white text-slate-900';
  const borderClass = isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200';
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const isFamilyView = Boolean(familyFeatures?.length);
  const standardFamilyModules = isFamilyView
    ? (familyFeatures || [])
      .filter(feature => feature.tier === 'standard')
      .map(feature => familyModuleById.get(feature.moduleId))
      .filter((item): item is InstalledModule => Boolean(item))
    : [module];
  const standardFamilyEnabled = standardFamilyModules.length > 0
    && standardFamilyModules.every(item => item.isEnabledForProject);
  const familyCommandCount = allItems.filter(item => item.groupId === 'commands').length;
  const familySupportingItemCount = allItems.length - familyCommandCount;
  const familyDisplayName = familyDefinition?.displayName || manifest.name;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!normalizedSearch) return;
    setExpandedGroups({
      types: true,
      commands: true,
      controls: true,
      snippets: true,
      dependencies: true,
      docs: true
    });
    setExpandedFeatures(Object.fromEntries((familyFeatures || []).map(feature => [feature.moduleId, true])));
  }, [familyFeatures, normalizedSearch]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`flex h-[min(900px,calc(100vh-32px))] w-[min(1680px,calc(100vw-32px))] min-w-0 flex-col overflow-hidden rounded-md border shadow-2xl ${panelClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-public-info-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className={`flex min-w-0 items-center gap-3 border-b px-4 py-3 ${borderClass}`}>
          <Package className="h-5 w-5 shrink-0 text-violet-400" />
          <div className="min-w-0 flex-1">
            <h2 id="module-public-info-title" className="truncate text-base font-semibold">
              模块公开信息 - {manifest.name}
            </h2>
            <div className={`truncate text-xs ${subtleClass}`}>
              {isFamilyView ? `${manifest.id} · v${manifest.version} · ${familyFeatures?.length || 0} 个功能域` : `${manifest.id} · v${manifest.version} · ${manifest.category}`}
              {manifest.author ? ` · ${manifest.author}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded p-1.5 transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            title="关闭模块公开信息（Esc）"
            aria-label="关闭模块公开信息"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 max-md:flex-col">
          <aside className={`flex min-h-0 w-[330px] shrink-0 flex-col border-r max-md:h-[38%] max-md:w-full max-md:border-b max-md:border-r-0 ${borderClass}`}>
            <div className={`border-b p-3 ${borderClass}`}>
              <label className={`flex h-9 min-w-0 items-center gap-2 rounded border px-2.5 ${borderClass} ${isDarkMode ? 'bg-[#181818]' : 'bg-slate-50'}`}>
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={searchText}
                  onChange={event => {
                    setSearchText(event.target.value);
                    setSelectedItemId(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  placeholder="搜索命令、类型、声明或备注..."
                  autoFocus
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    className="rounded p-0.5 text-slate-400 hover:text-white"
                    title="清空搜索"
                  >
                    <X className="h-3.5 w-3.5" />
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
                <Package className="h-4 w-4 shrink-0 text-violet-400" />
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
              {(manifest.tags?.length || manifest.license) && (
                <div className={`mt-2 break-words ${subtleClass}`}>
                  {manifest.tags?.length ? `标签：${manifest.tags.join('、')}` : ''}
                  {manifest.tags?.length && manifest.license ? ' · ' : ''}
                  {manifest.license ? `许可：${manifest.license}` : ''}
                </div>
              )}
              {module.diagnostics.length > 0 && (
                <div className="mt-2 break-words text-amber-300">{module.diagnostics.join('；')}</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {selectedItem ? (
              <PublicInfoDetail item={selectedItem} isDarkMode={isDarkMode} />
            ) : (
              <div className="space-y-4">
                {isFamilyView && (
                  <ModuleFamilyFeaturePanel
                    family={familyDefinition}
                    features={familyFeatures || []}
                    moduleById={familyModuleById}
                    isDarkMode={isDarkMode}
                    isChanging={isChangingFeature}
                    onToggleFeature={onToggleFeature}
                  />
                )}
                <ModulePublicOverview
                  items={overviewItems}
                  dependencyItems={visibleItems.filter(item => item.groupId === 'dependencies')}
                  docItems={visibleItems.filter(item => item.groupId === 'docs')}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}
          </main>
        </div>

        <footer className={`flex items-center justify-between gap-4 border-t px-4 py-2 text-xs ${borderClass} ${subtleClass}`}>
          <span className="truncate">
            状态：{normalizedSearch
              ? `已筛选 ${visibleItems.length} 项`
              : isFamilyView
                ? `共 ${familyCommandCount} 条接口命令，另有 ${familySupportingItemCount} 项类型、控件或构建信息`
                : `共 ${allItems.length} 项公开能力`}
          </span>
          <span className="shrink-0">{standardFamilyEnabled ? '标准功能已启用' : isFamilyView ? '标准功能未完整启用' : module.isEnabledForProject ? '当前项目已引用' : '当前项目未引用'}</span>
        </footer>
      </section>
    </div>,
    document.body
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
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
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
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-500 transition-transform group-open/category:rotate-90" />
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
  isChanging,
  onToggleFeature
}: {
  family?: ModuleFamilyDefinition;
  features: readonly ModuleFamilyFeatureDefinition[];
  moduleById: ReadonlyMap<string, InstalledModule>;
  isDarkMode: boolean;
  isChanging: boolean;
  onToggleFeature?: (module: InstalledModule) => void;
}) {
  const borderClass = isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200';
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
                  disabled={isChanging}
                  onClick={() => onToggleFeature?.(featureModule)}
                  className={`mt-2 min-h-9 w-full rounded border px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    enabled
                      ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                      : 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10'
                  }`}
                  aria-pressed={enabled}
                >
                  {enabled ? '禁用高级功能' : '启用高级功能'}
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
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
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

function ModulePublicOverview({
  items,
  dependencyItems,
  docItems,
  isDarkMode
}: {
  items: PublicInfoItem[];
  dependencyItems: PublicInfoItem[];
  docItems: PublicInfoItem[];
  isDarkMode: boolean;
}) {
  const visibleOverviewItems = items.slice(0, OVERVIEW_ROW_LIMIT);
  return (
    <>
      <InfoSection title="插入到 LingBuilder" isDarkMode={isDarkMode}>
        <PublicInfoTable
          headers={['名称', '声明/内容', '公开', '备注']}
          rows={visibleOverviewItems.map(item => [item.name, item.declaration, '✓', item.description])}
          isDarkMode={isDarkMode}
        />
        {items.length > visibleOverviewItems.length && (
          <div className="mt-2 text-xs text-slate-500">
            当前显示前 {visibleOverviewItems.length} 项，共 {items.length} 项；可使用左侧搜索快速定位。
          </div>
        )}
      </InfoSection>

      {(dependencyItems.length > 0 || docItems.length > 0) && (
        <InfoSection title="C++ 依赖与文档" isDarkMode={isDarkMode}>
          <PublicInfoTable
            headers={['分类', '路径/内容', '公开', '备注']}
            rows={[...dependencyItems, ...docItems].map(item => [item.kind, item.declaration, '✓', item.description])}
            isDarkMode={isDarkMode}
          />
        </InfoSection>
      )}
    </>
  );
}

function PublicInfoDetail({ item, isDarkMode }: { item: PublicInfoItem; isDarkMode: boolean }) {
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

function InfoSection({ title, isDarkMode, children }: { title: string; isDarkMode: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className={`mb-2 text-base font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>{title}</h3>
      {children}
    </section>
  );
}

function PublicInfoTable({ headers, rows, isDarkMode }: { headers: string[]; rows: string[][]; isDarkMode: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded border border-dashed border-slate-500/30 p-4 text-sm text-slate-500">该模块没有匹配的公开信息。</div>;
  }
  return (
    <div className={`overflow-x-auto rounded border ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
        <thead className={isDarkMode ? 'bg-[#2d332d] text-slate-200' : 'bg-emerald-50 text-slate-800'}>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`border-b px-3 py-2 font-semibold ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'} ${index === 0 ? 'w-[22%]' : index === 1 ? 'w-[26%]' : index === 2 ? 'w-[9%]' : ''}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join(':')}:${rowIndex}`} className={isDarkMode ? 'odd:bg-[#1f1f1f] even:bg-[#242424]' : 'odd:bg-white even:bg-slate-50'}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}:${cellIndex}`}
                  className={`border-b px-3 py-2 align-top leading-5 ${isDarkMode ? 'border-[#333]' : 'border-slate-200'} ${
                    cellIndex === 0 ? 'text-blue-300' : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  title={cell}
                >
                  <div className="break-words">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function collectPublicInfoItems(module: InstalledModule): PublicInfoItem[] {
  const manifest = module.manifest;
  const contributes = manifest.contributes || {};
  const bindings = manifest.bindings?.commands || [];
  const items: PublicInfoItem[] = [];

  for (const type of contributes.types || []) {
    items.push(createItem({
      id: `${manifest.id}:type:${type.name}`,
      sourceModuleId: manifest.id,
      groupId: 'types',
      kind: '类型/类',
      name: type.name,
      declaration: type.cppType || '类型贡献',
      description: type.description,
      copyText: type.name,
      fields: type.cppType ? [{ label: 'C++ 类型', value: type.cppType }] : undefined
    }));
  }
  for (const command of contributes.commands || []) {
    const binding = bindings.find(candidate => candidate.command === command.name);
    items.push(createItem({
      id: `${manifest.id}:command:${command.name}:${command.signature}`,
      sourceModuleId: manifest.id,
      groupId: 'commands',
      kind: '命令接口',
      name: command.name,
      declaration: command.signature,
      description: command.description,
      copyText: command.insertText || command.signature,
      commandCategory: command.category,
      capabilityKind: command.capabilityKind,
      officialCapability: command.officialCapability,
      fields: [
        ...(command.category ? [{ label: '功能分类', value: command.category }] : []),
        ...(command.aliases?.length ? [{ label: '官方接口', value: command.aliases.join('、') }] : []),
        ...(command.returnType ? [{ label: '返回值', value: command.returnType }] : []),
        ...(command.returnDescription ? [{ label: '返回值说明', value: command.returnDescription }] : []),
        ...(binding ? [
          { label: 'C++ 运行时', value: binding.runtimeName },
          ...(binding.encoding ? [{ label: '编码', value: binding.encoding }] : []),
          ...(binding.parameters || []).map(parameter => ({
            label: `参数 · ${parameter.name}`,
            value: [parameter.type, parameter.description].filter(Boolean).join(' · ')
          }))
        ] : [])
      ]
    }));
  }
  for (const control of contributes.designerControls || []) {
    items.push(createItem({
      id: `${manifest.id}:control:${control.type}`,
      sourceModuleId: manifest.id,
      groupId: 'controls',
      kind: '设计器控件',
      name: control.label,
      declaration: control.type,
      description: (control.events || []).map(event => `${event.label}：${event.handlerPattern}`).join('；') || '该控件未声明事件。',
      copyText: control.type,
      fields: [
        ...(control.category ? [{ label: '工具箱分类', value: control.category }] : []),
        ...(control.nativeAdapter ? [{ label: '原生适配器', value: control.nativeAdapter }] : []),
        ...(control.events || []).map(event => ({ label: `事件 · ${event.label}`, value: event.handlerPattern }))
      ]
    }));
  }
  for (const snippet of contributes.snippets || []) {
    items.push(createItem({
      id: `${manifest.id}:snippet:${snippet.label}`,
      sourceModuleId: manifest.id,
      groupId: 'snippets',
      kind: '代码片段',
      name: snippet.label,
      declaration: snippet.insertText,
      description: snippet.description,
      copyText: snippet.insertText
    }));
  }
  for (const dependency of collectTargetDependencies(manifest.targets || [])) {
    items.push(createItem({
      id: `${manifest.id}:${dependency.id}`,
      sourceModuleId: manifest.id,
      groupId: 'dependencies',
      kind: 'C++ 依赖',
      name: dependency.label,
      declaration: dependency.value,
      description: dependency.description,
      copyText: dependency.value
    }));
  }
  for (const doc of contributes.docs || []) {
    items.push(createItem({
      id: `${manifest.id}:doc:${doc.path}`,
      sourceModuleId: manifest.id,
      groupId: 'docs',
      kind: '文档',
      name: doc.title,
      declaration: doc.path,
      description: '模块随包公开文档。',
      copyText: doc.path
    }));
  }
  return items;
}

function createItem(item: Omit<PublicInfoItem, 'searchText'>): PublicInfoItem {
  return {
    ...item,
    searchText: [
      item.kind,
      item.name,
      item.declaration,
      item.description,
      ...(item.fields || []).flatMap(field => [field.label, field.value])
    ].map(normalizeModulePublicInfoSearchText).join(' ')
  };
}

function collectTargetDependencies(targets: ModuleTargetContribution[]) {
  return targets.flatMap(target => {
    const rows: Array<{ label: string; values: string[] }> = [
      { label: '目标', values: [`${target.id} · ${target.platform}/${target.toolchain}/${target.arch}`] },
      { label: '头文件', values: target.headers || [] },
      { label: '源码', values: target.sources || [] },
      { label: '库文件', values: target.libs || [] },
      { label: '运行时文件', values: target.runtimeFiles || [] },
      { label: '包含目录', values: target.includeDirs || [] },
      { label: '宏定义', values: target.defines || [] },
      { label: '编译选项', values: target.compileOptions || [] },
      { label: '链接选项', values: target.linkOptions || [] }
    ];
    return rows.flatMap((row, rowIndex) => row.values.map((value, valueIndex) => ({
      id: `dependency:${target.id}:${rowIndex}:${valueIndex}`,
      label: row.label,
      value,
      description: `目标 ${target.id}`
    })));
  });
}

function getPublicInfoGroups(items: PublicInfoItem[]) {
  const definitions: Array<{ id: PublicGroupId; label: string }> = [
    { id: 'types', label: '类型/类' },
    { id: 'commands', label: '命令接口' },
    { id: 'controls', label: '设计器控件' },
    { id: 'snippets', label: '代码片段' },
    { id: 'dependencies', label: 'C++ 依赖' },
    { id: 'docs', label: '文档' }
  ];
  return definitions.map(group => ({
    ...group,
    items: items.filter(item => item.groupId === group.id)
  }));
}

function getGroupIcon(groupId: PublicGroupId) {
  switch (groupId) {
    case 'types': return <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
    case 'commands': return <Wrench className="h-3.5 w-3.5 shrink-0 text-cyan-400" />;
    case 'controls': return <Monitor className="h-3.5 w-3.5 shrink-0 text-violet-300" />;
    case 'snippets': return <Code2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    case 'dependencies': return <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
    case 'docs': return <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />;
    default: return <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
  }
}
