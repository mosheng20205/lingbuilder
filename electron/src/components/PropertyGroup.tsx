import React from 'react';

/** 属性面板折叠分组外壳：供 WpfDesigner 属性面板与独立资源编辑器共用。 */
export function PropertyGroup({
  title,
  isDarkMode,
  defaultOpen = true,
  children
}: {
  title: string;
  isDarkMode: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={`overflow-hidden rounded border ${
        isDarkMode ? 'border-[#30303a] bg-[#18181e]' : 'border-slate-200 bg-white'
      }`}
    >
      <summary className={`flex h-7 cursor-pointer select-none items-center px-2 text-[10px] font-bold uppercase tracking-wide ${
        isDarkMode ? 'bg-[#22222a] text-slate-300 hover:bg-[#292934]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}>
        {title}
      </summary>
      <div className={`divide-y ${isDarkMode ? 'divide-[#2b2b34]' : 'divide-slate-200'}`}>
        {children}
      </div>
    </details>
  );
}
