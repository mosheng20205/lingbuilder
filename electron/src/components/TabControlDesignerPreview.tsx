import React from 'react';
import type { LingControl } from '../services/windowDesigner/types';
import {
  getSelectedTabPage,
  getTabControlPages,
  isNewEmojiTabsControl,
  isTabControlHeaderHidden
} from '../services/windowDesigner/tabControlModel';
import { getControlFontCssStyle } from '../services/windowDesigner/controlFont';

export interface TabControlDesignerPreviewProps {
  control: LingControl;
  onSelectPage?: (pageId: string) => void;
}

function mixHexColor(source: string, target: string, targetPercent: number): string {
  const normalize = (value: string) => /^#[0-9a-f]{6}$/iu.test(value) ? value.slice(1) : 'ffffff';
  const from = normalize(source);
  const to = normalize(target);
  const ratio = Math.max(0, Math.min(100, targetPercent)) / 100;
  const channel = (offset: number) => Math.round(
    Number.parseInt(from.slice(offset, offset + 2), 16) * (1 - ratio)
      + Number.parseInt(to.slice(offset, offset + 2), 16) * ratio
  ).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

const CHROME_HEADER_BACKGROUND = '#202124';
const CHROME_ACTIVE_BACKGROUND = '#292A2D';
const CHROME_ACTIVE_TEXT = '#E8EAED';
const CHROME_INACTIVE_TEXT = '#9AA0A6';

/**
 * new_emoji Tabs / Win32 TabControl 的设计器画布预览。
 * new_emoji 分支需要与原生库视觉对齐：标签样式（线条/卡片/边框卡片）、表头四向、
 * 表头对齐、逐项禁用/固定/加载中/静音/提醒徽标、关闭 ×、新增 + 与浏览器（Chrome）模式；
 * 这些样式不渲染会让设计器画布与 F5 运行结果明显不一致。
 */
export default function TabControlDesignerPreview({ control, onSelectPage }: TabControlDesignerPreviewProps) {
  const tabs = getTabControlPages(control);
  const selectedPage = getSelectedTabPage(control) || tabs[0];
  const newEmojiTabs = isNewEmojiTabsControl(control);
  const properties = control.properties || {};
  const fontSize = Math.max(9, control.fontSize);
  const background = control.background === 'transparent'
    ? newEmojiTabs ? '#242941' : '#ffffff'
    : control.background;
  const foreground = control.foreground;
  const headerBackground = mixHexColor(background, '#000000', 8);
  const selectedBackground = mixHexColor(background, '#ffffff', 7);
  const inactiveForeground = mixHexColor(foreground, background, 30);
  const borderColor = mixHexColor(background, foreground, 18);
  const headerAlign = String(properties.headerAlign ?? '0');
  const stripJustify = headerAlign === '1' ? 'center' : headerAlign === '2' ? 'flex-end' : 'flex-start';
  const fontStyle = getControlFontCssStyle(control);
  const hideHeader = isTabControlHeaderHidden(control);

  // 表头位置与子内容偏移公式必须与 getControlTabContentOffset 保持一致（0 上/1 右/2 下/3 左）。
  const position = newEmojiTabs ? Math.max(0, Math.min(3, Number(properties.position ?? 0) || 0)) : 0;
  const verticalHeader = position === 1 || position === 3;
  const headerFirst = position === 0 || position === 3;
  const tabType = Math.max(0, Math.min(2, Number(properties.tabType ?? 0) || 0));
  const chromeMode = newEmojiTabs && properties.chromeMode === true;
  const addable = newEmojiTabs && properties.addable === true;
  const chromeMetrics = {
    minWidth: Math.max(24, Number(properties.chromeMinWidth ?? 96) || 0),
    maxWidth: Math.max(48, Number(properties.chromeMaxWidth ?? 220) || 0),
    pinnedWidth: Math.max(24, Number(properties.chromePinnedWidth ?? 46) || 0),
    tabHeight: Math.max(20, Number(properties.chromeTabHeight ?? 32) || 0),
    newButton: properties.newButtonVisible !== false
  };
  const horizontalHeaderHeight = chromeMode
    ? chromeMetrics.tabHeight
    : Math.max(38, Math.min(52, control.height * 0.28));
  const verticalHeaderWidth = Math.max(120, Math.min(190, control.width * 0.32));
  const headerSize = verticalHeader
    ? { width: `${verticalHeaderWidth}px` }
    : { height: `${horizontalHeaderHeight}px` };
  // 激活指示线/卡片接缝都朝向内容区一侧。
  const accentSide = position === 1 ? 'inset 2px 0' : position === 2 ? 'inset 0 2px' : position === 3 ? 'inset -2px 0' : 'inset 0 -2px';
  const contentBorderSides = {
    borderTopWidth: position === 0 ? 0 : 1,
    borderRightWidth: position === 1 ? 0 : 1,
    borderBottomWidth: position === 2 ? 0 : 1,
    borderLeftWidth: position === 3 ? 0 : 1
  };

  const chromeTextColor = (selected: boolean) => selected ? CHROME_ACTIVE_TEXT : CHROME_INACTIVE_TEXT;

  const renderTabButton = (tab: (typeof tabs)[number], index: number) => {
    const selected = tab.id === selectedPage.id;
    const disabled = tab.disabled === true;
    const states: string[] = [];
    if (tab.pinned) states.push('📌');
    if (tab.loading) states.push('⟳');
    if (tab.muted) states.push('🔇');

    if (chromeMode) {
      const width = tab.pinned
        ? chromeMetrics.pinnedWidth
        : Math.max(chromeMetrics.minWidth, Math.min(chromeMetrics.maxWidth, control.width / Math.max(1, tabs.length)));
      return (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={selected}
          aria-disabled={disabled || undefined}
          className={`pointer-events-auto flex h-[calc(100%-2px)] min-w-0 items-center gap-1.5 self-end rounded-t-lg px-2 text-[10px] ${disabled ? 'opacity-45' : ''}`}
          style={{
            width: `${width}px`,
            flex: '0 0 auto',
            backgroundColor: selected ? CHROME_ACTIVE_BACKGROUND : 'transparent',
            color: chromeTextColor(selected)
          }}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            if (!disabled) onSelectPage?.(tab.id);
          }}
        >
          <span className="shrink-0">{tab.icon ? <span className="mr-0.5">{tab.icon}</span> : '🌐'}</span>
          {states.map(mark => <span key={mark} className="shrink-0 text-[9px]">{mark}</span>)}
          <span className="min-w-0 flex-1 truncate">{tab.title}</span>
          {tab.alerting ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" /> : null}
          {tab.closable !== false ? <span className="shrink-0 opacity-75">×</span> : null}
        </button>
      );
    }

    const extent = newEmojiTabs && tabs.length > 0
      ? Math.max(72, Math.min(152, control.width / tabs.length))
      : undefined;
    const cardStyle = newEmojiTabs && tabType === 1
      ? {
          border: `1px solid ${borderColor}`,
          borderBottom: selected ? `1px solid ${background}` : `1px solid ${borderColor}`,
          borderRadius: '6px 6px 0 0',
          backgroundColor: selected ? selectedBackground : 'transparent',
          marginRight: undefined,
          marginBottom: '-1px'
        }
      : newEmojiTabs && tabType === 2
        ? {
            border: `1px solid ${selected ? borderColor : 'transparent'}`,
            borderBottom: undefined,
            borderRadius: 6,
            backgroundColor: selected ? selectedBackground : 'transparent',
            marginRight: 2,
            marginBottom: undefined
          }
        : {
            border: undefined,
            borderBottom: undefined,
            borderRadius: undefined,
            backgroundColor: selected ? selectedBackground : headerBackground,
            marginRight: undefined,
            marginBottom: undefined
          };
    return (
      <button
        type="button"
        key={tab.id}
        role="tab"
        aria-selected={selected}
        aria-disabled={disabled || undefined}
        className={`pointer-events-auto relative flex min-w-0 max-w-[220px] shrink-0 items-center truncate border-0 px-3 ${disabled ? 'opacity-45' : ''}`}
        style={{
          height: verticalHeader ? 'auto' : `${horizontalHeaderHeight}px`,
          minHeight: verticalHeader ? `${Math.max(36, horizontalHeaderHeight * 0.8)}px` : undefined,
          width: verticalHeader ? `${verticalHeaderWidth - 8}px` : extent === undefined ? undefined : `${extent}px`,
          justifyContent: 'center',
          color: selected ? foreground : inactiveForeground,
          backgroundColor: cardStyle.backgroundColor,
          boxShadow: tabType === 0 && selected ? `${accentSide} #f59e0b` : undefined,
          border: cardStyle.border,
          borderBottom: cardStyle.borderBottom,
          borderRadius: cardStyle.borderRadius,
          marginBottom: cardStyle.marginBottom,
          marginRight: cardStyle.marginRight
        }}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          if (!disabled) onSelectPage?.(tab.id);
        }}
      >
        {newEmojiTabs && tab.icon ? <span className="mr-1 shrink-0">{tab.icon}</span> : null}
        {newEmojiTabs && states.map(mark => <span key={mark} className="mr-1 shrink-0 text-[9px]">{mark}</span>)}
        <span className="truncate">{tab.title}</span>
        {newEmojiTabs && tab.alerting ? <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" /> : null}
        {newEmojiTabs && tab.closable !== false ? <span className="ml-1.5 shrink-0 opacity-60">×</span> : null}
      </button>
    );
  };

  const addButton = (addable || (chromeMode && chromeMetrics.newButton)) && (
    <span
      aria-hidden="true"
      className={`shrink-0 select-none px-2 text-sm leading-none opacity-70 ${verticalHeader ? 'py-1 text-center' : 'self-center'}`}
    >
      +
    </span>
  );

  const header = !hideHeader ? (
    <div
      role="tablist"
      data-tab-header-align={newEmojiTabs ? headerAlign : undefined}
      className={`relative z-10 flex shrink-0 overflow-hidden ${verticalHeader ? 'flex-col' : 'flex-row items-stretch'}`}
      style={{
        ...headerSize,
        backgroundColor: chromeMode ? CHROME_HEADER_BACKGROUND : headerBackground,
        justifyContent: !chromeMode ? stripJustify : undefined,
        ...(verticalHeader ? { alignItems: 'stretch' } : chromeMode ? { alignItems: 'flex-end' } : {})
      }}
    >
      {tabs.map(renderTabButton)}
      {addButton}
    </div>
  ) : null;

  const content = (
    <div
      role="tabpanel"
      aria-label={selectedPage.title}
      data-tab-content-container="true"
      data-tab-header-hidden={hideHeader ? 'true' : 'false'}
      className={newEmojiTabs
        ? 'min-h-0 min-w-0 flex-1'
        : hideHeader ? 'min-h-0 flex-1' : 'min-h-0 flex-1 border border-t-0'}
      style={{
        color: foreground,
        backgroundColor: chromeMode ? '#171717' : background,
        borderColor,
        ...(newEmojiTabs
          ? {
              borderStyle: 'solid' as const,
              borderTopWidth: contentBorderSides.borderTopWidth,
              borderRightWidth: contentBorderSides.borderRightWidth,
              borderBottomWidth: contentBorderSides.borderBottomWidth,
              borderLeftWidth: contentBorderSides.borderLeftWidth
            }
          : {})
      }}
    />
  );

  return (
    <div
      data-tab-control-preview={newEmojiTabs ? 'new-emoji' : 'win32'}
      className={`relative flex h-full w-full overflow-hidden ${verticalHeader ? (headerFirst ? 'flex-row' : 'flex-row-reverse') : (headerFirst ? 'flex-col' : 'flex-col-reverse')}`}
      style={{
        color: foreground,
        backgroundColor: background,
        ...fontStyle,
        fontSize: `${fontSize}px`,
        opacity: control.isEnabled ? 1 : 0.55
      }}
    >
      {header}
      {content}
    </div>
  );
}
