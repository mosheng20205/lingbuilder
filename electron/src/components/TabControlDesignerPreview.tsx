import React from 'react';
import type { LingControl } from '../services/windowDesigner/types';
import { getSelectedTabPage, getTabControlPages, isNewEmojiTabsControl, isTabControlHeaderHidden } from '../services/windowDesigner/tabControlModel';
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

/** 近似 Win32 SysTabControl32 的默认主题外观，避免把选项卡误画成普通深色容器。 */
export default function TabControlDesignerPreview({ control, onSelectPage }: TabControlDesignerPreviewProps) {
  const tabs = getTabControlPages(control);
  const selectedPage = getSelectedTabPage(control) || tabs[0];
  const newEmojiTabs = isNewEmojiTabsControl(control);
  const fontSize = Math.max(9, control.fontSize);
  const background = control.background === 'transparent'
    ? newEmojiTabs ? '#242941' : '#ffffff'
    : control.background;
  const foreground = control.foreground;
  const headerBackground = mixHexColor(background, '#000000', 8);
  const selectedBackground = mixHexColor(background, '#ffffff', 7);
  const inactiveForeground = mixHexColor(foreground, background, 30);
  const borderColor = mixHexColor(background, foreground, 18);
  const headerHeight = newEmojiTabs
    ? Math.max(38, Math.min(52, control.height * 0.28))
    : Math.max(28, fontSize + 14);
  const hideHeader = isTabControlHeaderHidden(control);
  const fontStyle = getControlFontCssStyle(control);

  return (
    <div
      data-tab-control-preview={newEmojiTabs ? 'new-emoji' : 'win32'}
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        color: foreground,
        backgroundColor: background,
        ...fontStyle,
        fontSize: `${fontSize}px`,
        opacity: control.isEnabled ? 1 : 0.55
      }}
    >
      {!hideHeader && (
        <div
          role="tablist"
          className="relative z-10 flex shrink-0 items-stretch overflow-hidden"
          style={{ height: `${headerHeight}px`, backgroundColor: headerBackground }}
        >
          {tabs.map((tab, index) => {
            const selected = tab.id === selectedPage.id;
            return (
              <button
                type="button"
                key={tab.id}
                role="tab"
                aria-selected={selected}
                className="pointer-events-auto relative flex min-w-0 max-w-[220px] shrink-0 items-center justify-center truncate border-0 px-3"
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  onSelectPage?.(tab.id);
                }}
                style={{
                  height: `${headerHeight}px`,
                  color: selected ? foreground : inactiveForeground,
                  backgroundColor: selected ? selectedBackground : headerBackground,
                  boxShadow: selected ? 'inset 0 -2px #f59e0b' : index > 0 ? `inset 1px 0 ${borderColor}` : undefined
                }}
              >
                <span className="truncate">{tab.title}</span>
              </button>
            );
          })}
        </div>
      )}
      <div
        role="tabpanel"
        aria-label={selectedPage.title}
        data-tab-content-container="true"
        data-tab-header-hidden={hideHeader ? 'true' : 'false'}
        className={hideHeader ? 'min-h-0 flex-1' : 'min-h-0 flex-1 border border-t-0'}
        style={{ color: foreground, backgroundColor: background, borderColor }}
      />
    </div>
  );
}
