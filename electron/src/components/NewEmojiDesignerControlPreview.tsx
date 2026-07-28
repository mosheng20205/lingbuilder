import React from 'react';
import type { NewEmojiThemePreview } from '../services/windowDesigner/newEmojiDesignerAdapter';
import type { LingControl } from '../services/windowDesigner/types';

const MODULE_PREFIX = 'lingbuilder.new_emoji.ui/';

type PreviewProps = {
  control: LingControl;
  isEnabled: boolean;
  theme: NewEmojiThemePreview;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listValue(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const result = value.map(item => typeof item === 'string' ? item : String((item as Record<string, unknown>)?.label ?? (item as Record<string, unknown>)?.title ?? (item as Record<string, unknown>)?.text ?? '')).filter(Boolean);
  return result.length ? result : fallback;
}

function Shell({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`h-full w-full overflow-hidden rounded-md border ${className}`} style={{ backgroundColor: 'var(--ne-panel)', borderColor: 'var(--ne-border)', color: 'var(--ne-text)', ...style }}>{children}</div>;
}

function MiniButton({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return <span className="inline-flex items-center justify-center rounded border px-2 py-1 text-[9px]" style={{ backgroundColor: primary ? 'var(--ne-focus)' : 'var(--ne-button)', borderColor: primary ? 'var(--ne-focus)' : 'var(--ne-border)', color: primary ? '#FFFFFF' : 'var(--ne-text)' }}>{children}</span>;
}

function Chevron() {
  return <svg viewBox="0 0 12 8" className="h-2 w-3 shrink-0" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M7 3v4m10-4v4M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

function InputShell({ children }: { children: React.ReactNode }) {
  return <Shell className="flex items-center justify-between gap-2 px-3 text-[11px]" style={{ backgroundColor: 'var(--ne-edit)' }}>{children}</Shell>;
}

export function getNewEmojiPreviewKind(control: LingControl) {
  return control.designerType?.startsWith(MODULE_PREFIX) ? control.designerType.slice(MODULE_PREFIX.length) : undefined;
}

export default function NewEmojiDesignerControlPreview({ control, isEnabled, theme }: PreviewProps) {
  const kind = getNewEmojiPreviewKind(control);
  if (!kind) return null;
  const p = control.properties ?? {};
  const content = textValue(control.content, kind);
  const items = listValue(p.items, ['选项一', '选项二', '选项三']);
  const tabItems = listValue(p.tabs, items);
  const activeTabIndex = Math.max(0, Math.min(tabItems.length - 1, Math.trunc(numberValue(p.activeIndex, numberValue(p.selectedIndex, 0)))));
  const title = textValue(p.title, content);
  const body = textValue(p.body, textValue(p.description, '这里是组件内容'));
  const value = Math.max(0, Math.min(100, numberValue(p.value, numberValue(control.content, 62))));
  const accent = textValue(p.color, textValue(p.activeColor, '#8B5CF6'));
  const configuredForeground = control.foreground?.toUpperCase();
  const rootStyle = {
    opacity: isEnabled ? 1 : 0.5,
    color: !configuredForeground || configuredForeground === 'TRANSPARENT' || configuredForeground === '#F8FAFC' ? theme.textPrimary : control.foreground,
    fontSize: `${Math.max(10, control.fontSize)}px`,
    '--ne-panel': theme.panelBackground,
    '--ne-title': theme.titleBarBackground,
    '--ne-button': theme.buttonBackground,
    '--ne-edit': theme.editBackground,
    '--ne-border': theme.border,
    '--ne-text': theme.textPrimary,
    '--ne-muted': theme.textMuted,
    '--ne-focus': theme.focusBorder
  } as React.CSSProperties;
  let preview: React.ReactNode;

  switch (kind) {
    case 'Panel':
      preview = <Shell className="border-dashed p-2"><div className="flex h-full items-start justify-between"><span className="text-[10px] text-slate-300">{content}</span><span className="rounded bg-violet-500/15 px-1 text-[8px] text-violet-300">Panel</span></div></Shell>;
      break;
    case 'Text':
      preview = <div className="flex h-full w-full items-center overflow-hidden" style={{ justifyContent: p.align === '1' ? 'center' : p.align === '2' ? 'flex-end' : 'flex-start' }}><span className="truncate">{content}</span></div>;
      break;
    case 'Button':
      preview = <Shell className="flex items-center justify-center font-medium" style={{ backgroundColor: 'var(--ne-button)' }}>{content}</Shell>;
      break;
    case 'Input':
      preview = <InputShell><span className="truncate text-slate-400">{textValue(p.placeholder, content || '请输入内容')}</span><span className="text-slate-500">⌨</span></InputShell>;
      break;
    case 'EditBox':
      preview = <Shell className="px-3 py-2 text-left text-[11px] text-slate-300"><span>{textValue(p.placeholder, content)}</span><span className="ml-0.5 animate-pulse text-violet-300">│</span></Shell>;
      break;
    case 'Table':
      preview = <Shell className="grid grid-rows-[auto_1fr] text-[9px]"><div className="grid grid-cols-3 border-b border-slate-600 bg-slate-800 font-semibold"><span className="p-1.5">名称</span><span className="border-l border-slate-600 p-1.5">状态</span><span className="border-l border-slate-600 p-1.5">操作</span></div><div className="grid grid-cols-3 text-slate-400"><span className="p-1.5">示例项目</span><span className="border-l border-slate-700 p-1.5 text-emerald-400">正常</span><span className="border-l border-slate-700 p-1.5 text-violet-300">查看</span></div></Shell>;
      break;
    case 'ListBox':
      preview = <Shell className="p-1 text-[10px]">{items.slice(0, 4).map((item, index) => <div key={item} className={`rounded px-2 py-1 ${index === 0 ? 'bg-violet-500/30 text-violet-100' : 'text-slate-400'}`}>{item}</div>)}</Shell>;
      break;
    case 'Card':
      preview = <Shell className="flex flex-col border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-3"><div className="flex items-center justify-between font-semibold"><span>{title}</span><span className="text-violet-300">•••</span></div><div className="mt-2 line-clamp-2 text-[10px] text-slate-400">{body}</div><div className="mt-auto h-1 w-16 rounded bg-violet-500/60" /></Shell>;
      break;
    case 'Menu':
      preview = <Shell className="p-1 text-[10px]">{items.slice(0, 4).map((item, index) => <div key={item} className={`flex items-center gap-2 rounded px-2 py-1 ${index === 0 ? 'bg-violet-500/25 text-white' : 'text-slate-400'}`}><span className="text-violet-300">◆</span><span className="truncate">{item}</span>{index === 1 && <span className="ml-auto">›</span>}</div>)}</Shell>;
      break;
    case 'Tabs':
      preview = <Shell className="flex flex-col"><div className="flex h-8 shrink-0 items-end overflow-hidden border-b border-slate-700 px-2">{tabItems.map((item, index) => <span key={`${item}-${index}`} className={`shrink-0 px-2 py-1 text-[10px] ${index === activeTabIndex ? 'border-b-2 border-violet-400 text-violet-200' : 'text-slate-500'}`}>{item}</span>)}</div><div className="flex flex-1 items-center justify-center text-[10px] text-slate-500">{tabItems[activeTabIndex]} 内容区</div></Shell>;
      break;
    case 'Dialog':
      preview = <div className="flex h-full w-full items-center justify-center rounded bg-black/50 p-2"><div className="w-[88%] rounded-lg border border-slate-600 bg-slate-800 shadow-xl"><div className="flex items-center justify-between border-b border-slate-700 px-3 py-2 font-semibold"><span>{title}</span><span className="text-slate-400">×</span></div><div className="px-3 py-2 text-[10px] text-slate-400">{body}</div><div className="flex justify-end gap-1 px-3 pb-2"><MiniButton>取消</MiniButton><MiniButton primary>确定</MiniButton></div></div></div>;
      break;
    case 'Drawer':
      preview = <div className="relative h-full w-full overflow-hidden rounded bg-black/35"><div className="absolute inset-y-0 right-0 w-[72%] border-l border-slate-600 bg-slate-800 p-3 shadow-xl"><div className="flex justify-between font-semibold"><span>{title}</span><span className="text-slate-400">×</span></div><div className="mt-3 text-[10px] text-slate-400">{body}</div><div className="absolute bottom-3 left-3 right-3 h-1 rounded bg-violet-500/40" /></div></div>;
      break;
    case 'Notification':
      preview = <Shell className="flex gap-2 border-l-4 border-l-emerald-400 p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span><span className="min-w-0"><b className="block truncate text-[11px]">{title}</b><span className="block truncate text-[9px] text-slate-400">{body}</span></span><span className="ml-auto text-slate-500">×</span></Shell>;
      break;
    case 'Message':
      preview = <div className="flex h-full w-full items-center justify-center"><span className="flex max-w-full items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-[10px] shadow-lg"><i className="h-2 w-2 rounded-full bg-sky-400" />{content}</span></div>;
      break;
    case 'MessageBox':
      preview = <Shell className="flex flex-col"><div className="flex items-center justify-between border-b border-slate-700 px-3 py-2 font-semibold"><span>{title}</span><span>×</span></div><div className="flex flex-1 items-center gap-3 px-3 text-[10px]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">!</span><span className="text-slate-300">{body}</span></div><div className="flex justify-end px-3 pb-2"><MiniButton primary>确定</MiniButton></div></Shell>;
      break;
    case 'InfoBox':
      preview = <Shell className="flex items-start gap-3 border-sky-500/50 bg-sky-950/25 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/25 font-serif text-sky-300">i</span><span><b className="block">{title}</b><span className="text-[9px] text-sky-200/70">{body}</span></span></Shell>;
      break;
    case 'Link':
      preview = <div className="flex h-full items-center gap-1 overflow-hidden text-sky-400 underline underline-offset-2"><span className="truncate">{content}</span><span>↗</span></div>;
      break;
    case 'Icon':
      preview = <div className="flex h-full w-full items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-2xl text-violet-300">{textValue(p.icon, '✦')}</div>;
      break;
    case 'Space':
      preview = <div className="flex h-full w-full items-center justify-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400"/><span className="h-px flex-1 border-t border-dashed border-violet-400/60"/><span className="text-[8px] text-violet-300">{numberValue(p.size, 16)}px</span><span className="h-px flex-1 border-t border-dashed border-violet-400/60"/><span className="h-2 w-2 rounded-full bg-violet-400"/></div>;
      break;
    case 'Container':
      preview = <Shell className="grid grid-cols-2 gap-2 border-dashed p-2"><div className="rounded border border-violet-500/25 bg-violet-500/10"/><div className="rounded border border-cyan-500/25 bg-cyan-500/10"/><span className="col-span-2 self-end text-[8px] text-slate-500">Container · 内容承载区</span></Shell>;
      break;
    case 'Header':
      preview = <Shell className="flex items-center justify-between border-b-violet-500/50 bg-slate-800 px-3"><span className="font-semibold">◈ {content}</span><span className="flex gap-3 text-[9px] text-slate-400"><i>首页</i><i>文档</i><i>关于</i></span></Shell>;
      break;
    case 'Aside':
      preview = <Shell className="flex"><div className="w-10 bg-violet-500/15 p-2 text-violet-300">◈</div><div className="flex-1 space-y-2 p-2 text-[9px] text-slate-400"><div className="rounded bg-violet-500/25 p-1 text-violet-200">导航一</div><div className="p-1">导航二</div><div className="p-1">导航三</div></div></Shell>;
      break;
    case 'Main':
      preview = <Shell className="grid grid-cols-3 gap-2 p-3"><div className="col-span-2 rounded bg-slate-800"/><div className="rounded bg-violet-500/15"/><div className="col-span-3 h-2 self-end rounded bg-slate-700"/></Shell>;
      break;
    case 'Footer':
      preview = <Shell className="flex items-center justify-between border-t-violet-500/50 px-3 text-[9px] text-slate-400"><span>© LingBuilder</span><span>帮助 · 隐私 · 关于</span></Shell>;
      break;
    case 'Layout':
      preview = <Shell className="grid grid-cols-[28%_1fr] grid-rows-[25%_1fr_20%] gap-1 p-1"><div className="col-span-2 rounded bg-violet-500/25"/><div className="rounded bg-slate-700"/><div className="rounded bg-slate-800"/><div className="col-span-2 rounded bg-cyan-500/15"/></Shell>;
      break;
    case 'Border':
      preview = <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-violet-400/80 bg-violet-500/5 p-2"><span className="text-[9px] text-violet-200">{content}</span></div>;
      break;
    case 'Divider':
      preview = <div className="flex h-full w-full items-center gap-2 text-[9px] text-slate-400"><span className="h-px flex-1 bg-slate-600"/><span>{content}</span><span className="h-px flex-1 bg-slate-600"/></div>;
      break;
    case 'Checkbox':
      preview = <div className="flex h-full items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded border border-violet-400 bg-violet-500 text-[10px] text-white">✓</span><span>{content}</span></div>;
      break;
    case 'Radio':
      preview = <div className="flex h-full items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-violet-400"><i className="h-2 w-2 rounded-full bg-violet-400"/></span><span>{content}</span></div>;
      break;
    case 'Switch':
      preview = <div className="flex h-full items-center gap-2"><span className="relative h-5 w-9 rounded-full bg-violet-500"><i className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow"/></span><span className="text-[10px]">{content}</span></div>;
      break;
    case 'Slider':
      preview = <div className="relative flex h-full w-full items-center px-2"><div className="h-1 w-full rounded bg-slate-700"><div className="relative h-full rounded bg-violet-500" style={{ width: `${value}%` }}><span className="absolute -right-2 -top-1.5 h-4 w-4 rounded-full border-2 border-violet-400 bg-white shadow"/></div></div><span className="absolute right-1 top-0 text-[8px] text-violet-300">{value}</span></div>;
      break;
    case 'Select':
      preview = <InputShell><span className="truncate">{items[0]}</span><Chevron /></InputShell>;
      break;
    case 'SelectV2':
      preview = <Shell className="flex flex-col text-[9px]"><div className="flex h-7 items-center justify-between border-b border-slate-600 px-2"><span>{items[0]}</span><Chevron /></div><div className="flex flex-1 items-center justify-center text-slate-500">虚拟列表 · {numberValue(p.itemCount, 1000)} 项</div></Shell>;
      break;
    case 'InputNumber':
      preview = <Shell className="flex items-center"><span className="flex-1 px-3 font-mono">{numberValue(p.value, 8)}</span><span className="grid h-full w-7 grid-rows-2 border-l border-slate-600 text-center text-[8px]"><i className="border-b border-slate-600">▲</i><i>▼</i></span></Shell>;
      break;
    case 'InputTag':
      preview = <Shell className="flex items-center gap-1 px-2"><span className="rounded bg-violet-500/25 px-2 py-1 text-[9px] text-violet-200">React ×</span><span className="rounded bg-cyan-500/20 px-2 py-1 text-[9px] text-cyan-200">C++ ×</span><span className="text-[9px] text-slate-500">添加…</span></Shell>;
      break;
    case 'InputGroup':
      preview = <Shell className="flex items-stretch text-[10px]"><span className="flex items-center border-r border-slate-600 bg-slate-800 px-2">https://</span><span className="flex flex-1 items-center px-2 text-slate-400">example.com</span><span className="flex items-center border-l border-slate-600 bg-violet-500 px-2 text-white">访问</span></Shell>;
      break;
    case 'Rate':
      preview = <div className="flex h-full items-center gap-1 text-lg tracking-wide text-amber-400">★★★★<span className="text-slate-600">★</span><span className="ml-1 text-[9px] text-slate-400">4.0</span></div>;
      break;
    case 'ColorPicker':
      preview = <Shell className="flex items-center gap-2 px-2"><span className="h-7 w-9 rounded border border-white/20 shadow-inner" style={{ background: accent }}/><span className="font-mono text-[10px]">{accent}</span><span className="ml-auto"><Chevron /></span></Shell>;
      break;
    case 'Tag':
      preview = <div className="flex h-full items-center"><span className="rounded-full border border-violet-400/50 bg-violet-500/15 px-3 py-1 text-[10px] text-violet-200">{content} ×</span></div>;
      break;
    case 'Badge':
      preview = <div className="flex h-full items-center justify-center"><span className="relative rounded bg-slate-800 px-4 py-2 text-[10px]">消息<span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[8px] text-white">{numberValue(p.value, 8)}</span></span></div>;
      break;
    case 'Progress':
      preview = <div className="flex h-full items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${value}%` }}/></div><span className="text-[9px] text-slate-400">{value}%</span></div>;
      break;
    case 'Avatar':
      preview = <div className="flex h-full items-center gap-2"><span className="flex aspect-square h-[80%] max-h-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-lg font-bold text-white">NE</span><span className="text-[10px] text-slate-400">{content}</span></div>;
      break;
    case 'Empty':
      preview = <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500"><span className="text-3xl opacity-70">⌑</span><span className="text-[9px]">暂无数据</span></div>;
      break;
    case 'Alert':
      preview = <Shell className="flex items-start gap-2 border-amber-500/40 bg-amber-950/25 p-2"><span className="text-amber-300">⚠</span><span><b className="block text-[10px] text-amber-100">{title}</b><span className="text-[8px] text-amber-200/60">{body}</span></span><span className="ml-auto text-amber-300/60">×</span></Shell>;
      break;
    case 'Result':
      preview = <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-lg text-emerald-300">✓</span><b className="text-[10px]">操作成功</b><span className="text-[8px] text-slate-500">{body}</span></div>;
      break;
    case 'Breadcrumb':
      preview = <div className="flex h-full items-center gap-2 overflow-hidden text-[10px]"><span className="text-slate-500">首页</span><span>›</span><span className="text-slate-500">组件</span><span>›</span><span className="truncate text-violet-300">{content}</span></div>;
      break;
    case 'Pagination':
      preview = <div className="flex h-full items-center gap-1 text-[9px]"><span className="rounded border border-slate-600 px-2 py-1">‹</span>{[1, 2, 3].map(n => <span key={n} className={`rounded border px-2 py-1 ${n === 1 ? 'border-violet-400 bg-violet-500 text-white' : 'border-slate-600'}`}>{n}</span>)}<span className="text-slate-500">…</span><span className="rounded border border-slate-600 px-2 py-1">›</span></div>;
      break;
    case 'Steps':
      preview = <div className="flex h-full w-full items-center px-2 text-[8px]">{['开始', '处理中', '完成'].map((item, i) => <React.Fragment key={item}><span className="flex flex-col items-center gap-1"><i className={`flex h-5 w-5 items-center justify-center rounded-full ${i < 2 ? 'bg-violet-500 text-white' : 'border border-slate-600 text-slate-500'}`}>{i + 1}</i><b className={i === 1 ? 'text-violet-300' : 'text-slate-500'}>{item}</b></span>{i < 2 && <span className={`mb-4 h-px flex-1 ${i === 0 ? 'bg-violet-500' : 'bg-slate-700'}`}/>}</React.Fragment>)}</div>;
      break;
    case 'Skeleton':
      preview = <div className="flex h-full w-full gap-3 rounded border border-slate-700 p-3"><span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-700"/><span className="flex flex-1 flex-col gap-2"><i className="h-2 w-2/3 animate-pulse rounded bg-slate-700"/><i className="h-2 w-full animate-pulse rounded bg-slate-700"/><i className="h-2 w-4/5 animate-pulse rounded bg-slate-700"/></span></div>;
      break;
    case 'Descriptions':
      preview = <Shell className="grid grid-cols-[35%_1fr] text-[9px]">{['名称','New Emoji','版本','1.0.0','状态','已启用'].map((item, i) => <span key={`${item}-${i}`} className={`border-b border-slate-700 p-1.5 ${i % 2 === 0 ? 'bg-slate-800 text-slate-400' : i === 5 ? 'text-emerald-400' : ''}`}>{item}</span>)}</Shell>;
      break;
    case 'Collapse':
      preview = <Shell className="text-[9px]"><div className="flex items-center gap-2 border-b border-slate-700 px-2 py-2"><span className="rotate-90"><Chevron /></span><b>展开的面板</b></div><div className="px-5 py-2 text-slate-400">{body}</div><div className="flex items-center gap-2 border-t border-slate-700 px-2 py-2"><Chevron /><span>折叠的面板</span></div></Shell>;
      break;
    case 'Timeline':
      preview = <div className="relative h-full w-full py-2 pl-5 text-[9px] before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-px before:bg-slate-600">{['创建项目','配置模块','构建成功'].map((item, i) => <div key={item} className="relative mb-2"><i className={`absolute -left-[15px] top-1 h-2 w-2 rounded-full ${i === 2 ? 'bg-emerald-400' : 'bg-violet-400'}`}/><b>{item}</b><span className="ml-2 text-slate-500">{10 + i}:00</span></div>)}</div>;
      break;
    case 'Statistic':
      preview = <Shell className="flex flex-col justify-center p-3"><span className="text-[9px] text-slate-400">{title}</span><span className="mt-1 text-2xl font-semibold text-white">{numberValue(p.value, 1280).toLocaleString()}</span><span className="text-[8px] text-emerald-400">↑ 12.5%</span></Shell>;
      break;
    case 'KpiCard':
      preview = <Shell className="flex flex-col justify-between border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-cyan-500/5 p-3"><div className="flex justify-between"><span className="text-[9px] text-slate-400">{title}</span><span className="text-violet-300">◈</span></div><b className="text-xl">¥ {numberValue(p.value, 26800).toLocaleString()}</b><div className="flex justify-between text-[8px]"><span className="text-emerald-400">+18.2%</span><span className="text-slate-500">较上月</span></div></Shell>;
      break;
    case 'Trend':
      preview = <Shell className="flex items-center gap-2 px-3"><span className="text-[10px] text-slate-400">{content}</span><svg viewBox="0 0 90 28" className="h-8 flex-1" aria-hidden="true"><polyline points="2,24 18,17 32,20 48,9 62,13 76,5 88,8" fill="none" stroke="#34D399" strokeWidth="2"/><polyline points="2,24 18,17 32,20 48,9 62,13 76,5 88,8 88,28 2,28" fill="rgba(52,211,153,.12)" stroke="none"/></svg><span className="text-[9px] text-emerald-400">+8.6%</span></Shell>;
      break;
    case 'StatusDot':
      preview = <div className="flex h-full items-center gap-2"><span className="relative h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.8)]"><i className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"/></span><span className="text-[10px]">运行正常</span></div>;
      break;
    case 'Gauge':
      preview = <div className="relative flex h-full w-full items-end justify-center overflow-hidden"><svg viewBox="0 0 120 70" className="h-full max-w-full" aria-hidden="true"><path d="M15 60a45 45 0 0 1 90 0" fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round"/><path d="M15 60a45 45 0 0 1 68-39" fill="none" stroke="url(#g)" strokeWidth="12" strokeLinecap="round"/><defs><linearGradient id="g"><stop stopColor="#22D3EE"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs><line x1="60" y1="60" x2="82" y2="31" stroke="#F8FAFC" strokeWidth="2"/><circle cx="60" cy="60" r="4" fill="#F8FAFC"/></svg><b className="absolute bottom-1 text-[10px]">{value}</b></div>;
      break;
    case 'RingProgress':
      preview = <div className="relative flex h-full w-full items-center justify-center"><svg viewBox="0 0 42 42" className="h-[88%]" aria-hidden="true"><circle cx="21" cy="21" r="16" fill="none" stroke="#334155" strokeWidth="5"/><circle cx="21" cy="21" r="16" fill="none" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${value} ${100-value}`} pathLength="100" transform="rotate(-90 21 21)"/></svg><b className="absolute text-[10px]">{value}%</b></div>;
      break;
    case 'BulletProgress':
      preview = <div className="flex h-full w-full flex-col justify-center gap-1"><div className="relative h-4 overflow-hidden rounded-sm bg-slate-700"><div className="h-full bg-cyan-500" style={{ width: `${value}%` }}/><i className="absolute inset-y-0 left-[80%] w-0.5 bg-amber-300"/></div><div className="flex justify-between text-[8px] text-slate-500"><span>0</span><span>目标 80</span><span>100</span></div></div>;
      break;
    case 'LineChart':
      preview = <Shell className="p-2"><svg viewBox="0 0 180 80" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true"><path d="M5 67H175M5 45H175M5 23H175" stroke="#334155" strokeWidth="1"/><polyline points="6,61 35,48 63,54 90,25 120,37 148,16 174,26" fill="none" stroke="#22D3EE" strokeWidth="3"/><polyline points="6,68 35,58 63,40 90,47 120,25 148,35 174,12" fill="none" stroke="#A78BFA" strokeWidth="2"/></svg></Shell>;
      break;
    case 'BarChart':
      preview = <Shell className="flex items-end justify-around gap-2 p-3"><span className="h-[38%] flex-1 rounded-t bg-violet-500/70"/><span className="h-[72%] flex-1 rounded-t bg-cyan-500/70"/><span className="h-[55%] flex-1 rounded-t bg-violet-400/70"/><span className="h-[88%] flex-1 rounded-t bg-emerald-500/70"/><span className="h-[64%] flex-1 rounded-t bg-cyan-400/70"/></Shell>;
      break;
    case 'DonutChart':
      preview = <Shell className="flex items-center justify-center gap-4 p-2"><div className="relative h-[82%] aspect-square rounded-full" style={{ background: 'conic-gradient(#8B5CF6 0 46%, #22D3EE 46% 76%, #34D399 76% 100%)' }}><i className="absolute inset-[25%] rounded-full bg-[#171923]"/></div><div className="space-y-1 text-[8px] text-slate-400"><div><i className="mr-1 inline-block h-2 w-2 bg-violet-500"/>桌面端 46%</div><div><i className="mr-1 inline-block h-2 w-2 bg-cyan-400"/>移动端 30%</div><div><i className="mr-1 inline-block h-2 w-2 bg-emerald-400"/>其他 24%</div></div></Shell>;
      break;
    case 'Calendar':
      preview = <Shell className="grid grid-rows-[auto_auto_1fr] p-2 text-[8px]"><div className="flex justify-between pb-1 font-semibold"><span>‹</span><span>2026 年 7 月</span><span>›</span></div><div className="grid grid-cols-7 text-center text-slate-500">{'一二三四五六日'.split('').map(d => <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7 place-items-center">{Array.from({length: 21},(_,i)=><span key={i} className={i===14?'flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white':''}>{i+1}</span>)}</div></Shell>;
      break;
    case 'Tree':
      preview = <Shell className="p-2 text-[9px]"><div>⌄ 📁 项目</div><div className="pl-4 text-violet-200">⌄ 📁 源代码</div><div className="rounded bg-violet-500/20 py-0.5 pl-8">📄 main.lcpp</div><div className="pl-4 text-slate-400">› 📁 资源</div></Shell>;
      break;
    case 'TreeSelect':
      preview = <Shell className="flex flex-col text-[9px]"><div className="flex h-7 items-center justify-between border-b border-slate-600 px-2"><span>项目 / 源代码</span><Chevron/></div><div className="p-1"><div>⌄ 📁 项目</div><div className="rounded bg-violet-500/25 py-1 pl-4">✓ 源代码</div></div></Shell>;
      break;
    case 'Transfer':
      preview = <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-[8px]"><Shell className="p-1"><b>待选 3</b><div className="mt-1 rounded bg-violet-500/20 p-1">☑ 模块 A</div><div className="p-1">☐ 模块 B</div></Shell><div className="flex flex-col gap-1"><MiniButton primary>›</MiniButton><MiniButton>‹</MiniButton></div><Shell className="p-1"><b>已选 1</b><div className="mt-1 rounded bg-cyan-500/20 p-1">☑ 模块 C</div></Shell></div>;
      break;
    case 'Autocomplete':
      preview = <Shell className="flex flex-col text-[9px]"><div className="flex h-7 items-center border-b border-violet-400 px-2">new_<span className="text-violet-300">emoji</span><i className="animate-pulse">│</i></div><div className="p-1"><div className="rounded bg-violet-500/25 px-2 py-1">new_emoji.ui</div><div className="px-2 py-1 text-slate-500">new_project</div></div></Shell>;
      break;
    case 'Mentions':
      preview = <Shell className="flex flex-col p-2 text-[9px]"><span>分配给 <b className="rounded bg-violet-500/20 px-1 text-violet-300">@开发者</b></span><div className="mt-2 rounded border border-slate-600 bg-slate-800 p-1 shadow"><div className="rounded bg-violet-500/25 px-2 py-1">@开发者</div><div className="px-2 py-1 text-slate-500">@测试人员</div></div></Shell>;
      break;
    case 'Cascader':
      preview = <Shell className="grid grid-cols-3 text-[8px]"><div className="border-r border-slate-700 p-1"><b>界面 ›</b><div>数据 ›</div></div><div className="border-r border-slate-700 p-1"><b className="text-violet-300">控件 ›</b><div>布局 ›</div></div><div className="p-1"><b className="text-violet-300">按钮 ✓</b><div>文本</div></div></Shell>;
      break;
    case 'DatePicker':
      preview = <InputShell><span>{textValue(p.value, '2026-07-28')}</span><CalendarIcon/></InputShell>;
      break;
    case 'TimePicker':
      preview = <InputShell><span>{textValue(p.value, '14:30:00')}</span><ClockIcon/></InputShell>;
      break;
    case 'DateTimePicker':
      preview = <InputShell><span>{textValue(p.value, '2026-07-28 14:30')}</span><span className="flex gap-1"><CalendarIcon/><ClockIcon/></span></InputShell>;
      break;
    case 'TimeSelect':
      preview = <Shell className="flex flex-col text-[9px]"><div className="flex h-7 items-center justify-between border-b border-slate-600 px-2"><span>14:30</span><ClockIcon/></div><div className="grid grid-cols-3 divide-x divide-slate-700 text-center"><span>14<br/><b className="text-violet-300">15</b><br/>16</span><span>29<br/><b className="text-violet-300">30</b><br/>31</span><span>00<br/>30<br/>45</span></div></Shell>;
      break;
    case 'Dropdown':
      preview = <Shell className="flex flex-col text-[9px]"><div className="flex h-7 items-center justify-between border-b border-slate-600 px-2"><span>{content}</span><Chevron/></div><div className="p-1">{items.slice(0,3).map((item,i)=><div key={item} className={`rounded px-2 py-1 ${i===0?'bg-violet-500/25':''}`}>{item}</div>)}</div></Shell>;
      break;
    case 'Anchor':
      preview = <div className="relative h-full w-full border-l border-slate-700 pl-3 text-[9px]"><i className="absolute -left-px top-1 h-5 w-0.5 bg-violet-400"/><div className="mb-2 text-violet-300">基础用法</div><div className="mb-2 text-slate-500">组件属性</div><div className="text-slate-500">事件说明</div></div>;
      break;
    case 'Backtop':
      preview = <div className="flex h-full w-full items-center justify-center"><span className="flex h-10 w-10 flex-col items-center justify-center rounded-full border border-violet-400/50 bg-violet-500/20 text-violet-200 shadow-lg"><b>↑</b><i className="text-[7px]">顶部</i></span></div>;
      break;
    case 'Segmented':
      preview = <div className="flex h-full w-full items-center rounded-lg bg-slate-800 p-1 text-[9px]"><span className="flex-1 rounded-md bg-violet-500 py-1.5 text-center text-white shadow">日</span><span className="flex-1 text-center text-slate-400">周</span><span className="flex-1 text-center text-slate-400">月</span></div>;
      break;
    case 'PageHeader':
      preview = <Shell className="flex items-center gap-3 px-3"><span className="text-lg">‹</span><span><b className="block">{title}</b><i className="text-[8px] text-slate-500">{body}</i></span><span className="ml-auto"><MiniButton primary>操作</MiniButton></span></Shell>;
      break;
    case 'Affix':
      preview = <div className="relative h-full w-full rounded border border-dashed border-slate-600"><span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-violet-500 px-3 py-1 text-[9px] text-white shadow">📌 固定内容</span><span className="absolute bottom-1 left-2 text-[8px] text-slate-600">滚动容器</span></div>;
      break;
    case 'Watermark':
      preview = <Shell className="relative grid grid-cols-2 place-items-center bg-slate-900"><span className="-rotate-12 text-[10px] text-slate-600">new_emoji</span><span className="-rotate-12 text-[10px] text-slate-600">new_emoji</span><span className="-rotate-12 text-[10px] text-slate-600">new_emoji</span><span className="-rotate-12 text-[10px] text-slate-600">new_emoji</span><b className="absolute text-[10px] text-slate-300">{content}</b></Shell>;
      break;
    case 'Tour':
      preview = <div className="relative h-full w-full overflow-hidden rounded"><div className="absolute left-3 top-3 h-8 w-16 rounded border-2 border-violet-400 bg-violet-500/10 shadow-[0_0_0_999px_rgba(0,0,0,.3)]"/><div className="absolute bottom-2 right-2 w-[62%] rounded border border-slate-600 bg-slate-800 p-2 text-[8px] shadow-xl"><b className="block text-violet-200">功能引导 1/3</b><span className="text-slate-400">点击这里开始操作</span><div className="mt-1 text-right"><MiniButton primary>下一步</MiniButton></div></div></div>;
      break;
    case 'Image':
      preview = <Shell className="relative flex items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-cyan-950"><svg viewBox="0 0 100 70" className="h-[75%] w-[75%] text-violet-300" aria-hidden="true"><circle cx="70" cy="18" r="7" fill="#FBBF24"/><path d="M8 62 35 30l17 19 11-12 29 25Z" fill="currentColor" opacity=".65"/><path d="M8 62 35 30l17 19" fill="none" stroke="#22D3EE" strokeWidth="2"/></svg><span className="absolute bottom-1 right-2 text-[8px] text-slate-500">图片</span></Shell>;
      break;
    case 'Carousel':
      preview = <Shell className="relative flex items-center justify-center bg-gradient-to-r from-violet-900/60 to-cyan-900/60"><span className="absolute left-2 text-xl text-white/60">‹</span><div className="text-center"><b className="block text-lg">{content}</b><span className="text-[8px] text-slate-400">轮播内容 1</span></div><span className="absolute right-2 text-xl text-white/60">›</span><div className="absolute bottom-2 flex gap-1"><i className="h-1.5 w-4 rounded bg-white"/><i className="h-1.5 w-1.5 rounded bg-white/40"/><i className="h-1.5 w-1.5 rounded bg-white/40"/></div></Shell>;
      break;
    case 'Upload':
      preview = <Shell className="flex flex-col items-center justify-center gap-1 border-dashed border-violet-400/60 bg-violet-500/5"><span className="text-xl text-violet-300">⇧</span><b className="text-[10px]">点击或拖拽上传</b><span className="text-[8px] text-slate-500">支持单个或批量文件</span></Shell>;
      break;
    case 'InfiniteScroll':
      preview = <Shell className="relative space-y-1 p-2 text-[8px]">{[1,2,3].map(n=><div key={n} className="rounded bg-slate-800 px-2 py-1.5">列表项目 {n}</div>)}<div className="flex items-center justify-center gap-1 text-violet-300"><i className="h-2 w-2 animate-spin rounded-full border border-violet-300 border-t-transparent"/>加载更多…</div></Shell>;
      break;
    case 'Loading':
      preview = <div className="relative flex h-full w-full items-center justify-center rounded bg-black/35"><span className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500/25 border-t-violet-400"/><span className="absolute mt-12 text-[8px] text-slate-400">加载中…</span></div>;
      break;
    case 'Tooltip':
      preview = <div className="relative flex h-full w-full items-end justify-center pb-1"><span className="absolute top-0 rounded bg-slate-700 px-2 py-1 text-[8px] shadow-lg after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-700">{textValue(p.content, '文字提示')}</span><span className="rounded border border-violet-400 px-3 py-1 text-[9px] text-violet-300">悬停目标</span></div>;
      break;
    case 'Popover':
      preview = <div className="relative h-full w-full"><span className="absolute bottom-1 left-2 rounded border border-violet-400 px-2 py-1 text-[8px]">点击目标</span><Shell className="absolute right-1 top-1 h-[72%] w-[65%] p-2 text-[8px]"><b className="block">{title}</b><span className="text-slate-400">{body}</span><i className="absolute -bottom-1 left-5 h-2 w-2 rotate-45 border-b border-r border-slate-600 bg-[#171923]"/></Shell></div>;
      break;
    case 'Popconfirm':
      preview = <Shell className="flex flex-col justify-between p-2 text-[9px]"><div className="flex gap-2"><span className="text-amber-300">?</span><span>{textValue(p.title, '确定要删除吗？')}</span></div><div className="flex justify-end gap-1"><MiniButton>取消</MiniButton><MiniButton primary>确定</MiniButton></div></Shell>;
      break;
    case 'IconButton':
      preview = <div className="flex h-full w-full items-center justify-center"><span className="flex h-[80%] aspect-square items-center justify-center rounded-lg border border-violet-400/60 bg-violet-500/20 text-xl text-violet-200 shadow">{textValue(p.icon, '✦')}</span></div>;
      break;
    case 'Omnibox':
      preview = <Shell className="flex items-center gap-2 rounded-full px-3"><span className="text-slate-500">⌕</span><span className="min-w-0 flex-1 truncate text-[9px] text-slate-300">https://lingbuilder.local/new_emoji</span><span className="text-slate-500">☆ ⋮</span></Shell>;
      break;
    case 'BrowserViewport':
      preview = <Shell className="flex flex-col bg-white"><div className="flex h-7 shrink-0 items-center gap-1 border-b border-slate-300 bg-slate-100 px-2"><i className="h-2 w-2 rounded-full bg-rose-400"/><i className="h-2 w-2 rounded-full bg-amber-400"/><i className="h-2 w-2 rounded-full bg-emerald-400"/><span className="ml-2 flex-1 rounded bg-white px-2 py-0.5 text-[8px] text-slate-500">https://example.com</span></div><div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-white to-violet-50 text-slate-700"><span className="text-xl text-violet-500">◈</span><b className="text-[10px]">Browser Viewport</b><span className="text-[8px] text-slate-400">网页内容预览</span></div></Shell>;
      break;
    default:
      preview = <Shell className="flex items-center justify-center border-dashed text-[10px] text-violet-300">{content}</Shell>;
  }

  return <div data-new-emoji-preview={kind} aria-label={`${kind} 专属预览`} className="h-full w-full select-none" style={rootStyle}>{preview}</div>;
}
