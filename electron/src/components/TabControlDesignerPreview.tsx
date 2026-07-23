import React from 'react';
import type { LingControl } from '../services/windowDesigner/types';
import { getSelectedTabPage, getTabControlPages } from '../services/windowDesigner/tabControlModel';

export interface TabControlDesignerPreviewProps {
  control: LingControl;
  onSelectPage?: (pageId: string) => void;
}

/** 近似 Win32 SysTabControl32 的默认主题外观，避免把选项卡误画成普通深色容器。 */
export default function TabControlDesignerPreview({ control, onSelectPage }: TabControlDesignerPreviewProps) {
  const tabs = getTabControlPages(control);
  const selectedPage = getSelectedTabPage(control) || tabs[0];
  const fontSize = Math.max(9, control.fontSize);

  return (
    <div
      data-tab-control-preview="win32"
      className="relative flex h-full w-full flex-col overflow-hidden text-[#202020]"
      style={{ fontFamily: '"Segoe UI", "Microsoft YaHei UI", sans-serif', fontSize: `${fontSize}px`, opacity: control.isEnabled ? 1 : 0.55 }}
    >
      <div role="tablist" className="relative z-10 flex h-[25px] shrink-0 items-end pl-0.5">
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedPage.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={selected}
              className="pointer-events-auto flex max-w-[160px] items-center justify-center truncate border border-[#a9a9a9] px-2.5"
              onMouseDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                onSelectPage?.(tab.id);
              }}
              style={{
                height: selected ? '25px' : '23px',
                marginBottom: selected ? '-1px' : '0',
                marginLeft: index === 0 ? 0 : '-1px',
                borderBottomColor: selected ? '#ffffff' : '#a9a9a9',
                backgroundColor: selected ? '#ffffff' : '#f0f0f0'
              }}
            >
              <span className="truncate">{tab.title}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        aria-label={selectedPage.title}
        className="min-h-0 flex-1 border border-[#a9a9a9] bg-white"
      />
    </div>
  );
}
