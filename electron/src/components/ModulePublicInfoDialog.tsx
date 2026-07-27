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
import type { InstalledModule, ModuleTargetContribution } from '../services/modules/types';

type PublicGroupId = 'types' | 'commands' | 'controls' | 'snippets' | 'dependencies' | 'docs';
type PublicItemKind = '类型/类' | '命令接口' | '设计器控件' | '代码片段' | 'C++ 依赖' | '文档';

interface PublicInfoItem {
  id: string;
  groupId: PublicGroupId;
  kind: PublicItemKind;
  name: string;
  declaration: string;
  description: string;
  searchText: string;
  copyText?: string;
  fields?: Array<{ label: string; value: string }>;
}

interface ModulePublicInfoDialogProps {
  module: InstalledModule;
  isDarkMode: boolean;
  onClose: () => void;
}

const TREE_ITEM_LIMIT = 200;
const OVERVIEW_ROW_LIMIT = 400;

export default function ModulePublicInfoDialog({
  module,
  isDarkMode,
  onClose
}: ModulePublicInfoDialogProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<PublicGroupId, boolean>>({
    types: true,
    commands: true,
    controls: true,
    snippets: false,
    dependencies: false,
    docs: false
  });
  const manifest = module.manifest;
  const allItems = useMemo(() => collectPublicInfoItems(module), [module]);
  const normalizedSearch = searchText.trim().toLocaleLowerCase('zh-CN');
  const visibleItems = useMemo(
    () => normalizedSearch
      ? allItems.filter(item => item.searchText.includes(normalizedSearch))
      : allItems,
    [allItems, normalizedSearch]
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
  }, [normalizedSearch]);

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
              {manifest.id} · v{manifest.version} · {manifest.category}
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
                onClick={() => setSelectedItemId(null)}
                className={`mb-1 flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  selectedItemId === null
                    ? isDarkMode ? 'bg-sky-500/20 text-sky-100' : 'bg-sky-100 text-sky-900'
                    : isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                }`}
              >
                <Package className="h-4 w-4 shrink-0 text-violet-400" />
                <span className="min-w-0 flex-1 truncate font-semibold">{manifest.name}</span>
                <span className={subtleClass}>{visibleItems.length}</span>
              </button>

              {groups.map(group => (
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
              <ModulePublicOverview
                items={overviewItems}
                dependencyItems={visibleItems.filter(item => item.groupId === 'dependencies')}
                docItems={visibleItems.filter(item => item.groupId === 'docs')}
                isDarkMode={isDarkMode}
              />
            )}
          </main>
        </div>

        <footer className={`flex items-center justify-between gap-4 border-t px-4 py-2 text-xs ${borderClass} ${subtleClass}`}>
          <span className="truncate">
            状态：{normalizedSearch ? `已筛选 ${visibleItems.length} 项` : `共 ${allItems.length} 项公开能力`}
          </span>
          <span className="shrink-0">{module.isEnabledForProject ? '当前项目已引用' : '当前项目未引用'}</span>
        </footer>
      </section>
    </div>,
    document.body
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
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex w-full min-w-0 items-start gap-1.5 rounded px-2 py-1 text-left ${
                selectedItemId === item.id
                  ? isDarkMode ? 'bg-sky-500/25 text-sky-100' : 'bg-sky-100 text-sky-900'
                  : isDarkMode ? 'text-slate-300 hover:bg-sky-500/15 hover:text-sky-200' : 'text-slate-700 hover:bg-sky-50 hover:text-sky-800'
              }`}
              title={`${item.name}\n${item.declaration}`}
            >
              <FileCode className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px]">{item.name}</span>
                <span className="block truncate text-[9px] text-slate-500">{item.declaration}</span>
              </span>
            </button>
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
      id: `type:${type.name}`,
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
      id: `command:${command.name}:${command.signature}`,
      groupId: 'commands',
      kind: '命令接口',
      name: command.name,
      declaration: command.signature,
      description: command.description,
      copyText: command.insertText || command.signature,
      fields: [
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
      id: `control:${control.type}`,
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
      id: `snippet:${snippet.label}`,
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
      id: dependency.id,
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
      id: `doc:${doc.path}`,
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
    ].join(' ').toLocaleLowerCase('zh-CN')
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
