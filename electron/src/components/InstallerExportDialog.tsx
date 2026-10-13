import React, { FormEvent, useEffect, useRef, useState } from 'react';

export type InstallerInstallModeOption = 'auto' | 'perMachine' | 'perUser';

export interface InstallerExportDialogValue {
  version: string;
  useProjectIcon: boolean;
  bundleVcRedist: boolean;
  installMode: InstallerInstallModeOption;
}

/** GET /api/installer/preflight 的响应负载（导出对话框的上下文信息）。 */
export interface InstallerExportPreflight {
  projectName: string;
  outputFileName: string;
  lastVersion: string;
  architecture: 'x64' | 'x86';
  buildMode: 'Debug' | 'Release';
  requireAdministrator: boolean;
  requiresDynamicCrt: boolean;
  hasProjectIcon: boolean;
  builtAt: string;
}

const INSTALL_MODE_LABELS: Record<InstallerInstallModeOption, string> = {
  auto: '跟随构建属性（推荐）',
  perMachine: '安装到所有用户（Program Files，需管理员）',
  perUser: '仅当前用户（免管理员）'
};

interface InstallerExportDialogProps {
  open: boolean;
  isDarkMode: boolean;
  busy?: boolean;
  error?: string;
  preflight: InstallerExportPreflight;
  initialValue: InstallerExportDialogValue;
  onConfirm: (value: InstallerExportDialogValue) => void | Promise<void>;
  onClose: () => void;
}

/**
 * 导出安装包选项对话框（解决方案树右键「导出安装包…」）：
 * 版本号、安装器图标、是否捆绑 VC++ 运行库、安装目录策略。
 * 上下文（架构/是否管理员/动态 CRT/有无图标）来自最近一次成功构建的清单预检。
 */
export default function InstallerExportDialog({
  open,
  isDarkMode,
  busy = false,
  error,
  preflight,
  initialValue,
  onConfirm,
  onClose
}: InstallerExportDialogProps) {
  const [value, setValue] = useState<InstallerExportDialogValue>(initialValue);
  const [localError, setError] = useState<string>('');
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const initialValueKey = JSON.stringify(initialValue);

  useEffect(() => {
    if (!open) return;
    setValue(JSON.parse(initialValueKey) as InstallerExportDialogValue);
    setError('');
    const frame = window.requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialValueKey]);

  if (!open) return null;

  const inputClassName = `w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
    isDarkMode ? 'border-[#414149] bg-[#25252c] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const hintClassName = `mt-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const sectionClassName = `rounded border px-3 py-3 ${isDarkMode ? 'border-[#35353c] bg-[#232329]' : 'border-slate-200 bg-slate-50'}`;
  const labelClassName = 'mb-1 block text-[11px]';
  const checkboxClassName = 'mr-2 h-3.5 w-3.5 align-middle';

  const update = (patch: Partial<InstallerExportDialogValue>) => {
    setValue(previous => ({ ...previous, ...patch }));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!value.version.trim()) {
      setError('版本号不能为空；留空请输入 1.0.0。');
      return;
    }
    void onConfirm({ ...value, version: value.version.trim() });
  };

  const builtAtLabel = preflight.builtAt ? new Date(preflight.builtAt).toLocaleString() : '';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="installer-export-dialog-title"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className={`w-full max-w-lg rounded-lg border shadow-2xl ${
          isDarkMode ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 id="installer-export-dialog-title" className="text-sm font-semibold">导出安装包</h2>
          <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            把 {preflight.projectName}（{preflight.architecture === 'x64' ? '64 位' : '32 位'} · {preflight.buildMode} · {preflight.outputFileName}
            {builtAtLabel ? ` · 构建于 ${builtAtLabel}` : ''}）打包为 NSIS 安装程序。
          </p>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
          <div className={sectionClassName}>
            <label className={labelClassName} htmlFor="installer-export-version">版本号</label>
            <input
              id="installer-export-version"
              ref={firstFieldRef}
              className={inputClassName}
              value={value.version}
              onChange={event => update({ version: event.target.value })}
              placeholder="1.0.0"
              disabled={busy}
            />
            <p className={hintClassName}>安装包文件名与卸载注册表项会带版本号（自动规范为四段数字，如 1.0 → 1.0.0.0）。</p>
          </div>

          <div className={sectionClassName}>
            <div className="mb-2 text-xs font-medium">安装器选项</div>
            <label className="flex items-start text-xs" htmlFor="installer-export-icon">
              <input
                id="installer-export-icon"
                type="checkbox"
                className={`${checkboxClassName} mt-0.5`}
                checked={value.useProjectIcon}
                disabled={busy || !preflight.hasProjectIcon}
                onChange={event => update({ useProjectIcon: event.target.checked })}
              />
              <span>
                使用项目图标作为安装器图标
                {!preflight.hasProjectIcon && (
                  <span className={hintClassName}>（本次构建未物化窗口图标，将使用默认图标）</span>
                )}
              </span>
            </label>
            <label className="mt-2 flex items-start text-xs" htmlFor="installer-export-redist">
              <input
                id="installer-export-redist"
                type="checkbox"
                className={`${checkboxClassName} mt-0.5`}
                checked={value.bundleVcRedist}
                disabled={busy}
                onChange={event => update({ bundleVcRedist: event.target.checked })}
              />
              <span>
                捆绑 VC++ 运行库（安装时自动检测、未装则静默安装）
                {preflight.requiresDynamicCrt
                  ? <span className={hintClassName}>（/MD 构建的目标机器需要运行库，推荐勾选；首次会从微软官网下载约 25MB）</span>
                  : <span className={hintClassName}>（/MT 构建无需运行库；勾选属冗余，会增大安装包体积）</span>}
              </span>
            </label>
          </div>

          <div className={sectionClassName}>
            <label className={labelClassName} htmlFor="installer-export-install-mode">安装目录策略</label>
            <select
              id="installer-export-install-mode"
              className={inputClassName}
              value={value.installMode}
              disabled={busy}
              onChange={event => update({ installMode: event.target.value as InstallerInstallModeOption })}
            >
              {(Object.keys(INSTALL_MODE_LABELS) as InstallerInstallModeOption[]).map(mode => (
                <option key={mode} value={mode}>{INSTALL_MODE_LABELS[mode]}</option>
              ))}
            </select>
            <p className={hintClassName}>
              {value.installMode === 'perMachine' && '安装到 Program Files，安装时请求管理员权限（UAC）。'}
              {value.installMode === 'perUser' && '安装到当前用户目录（%LOCALAPPDATA%\\Programs），安装全程免管理员。'}
              {value.installMode === 'auto' && (preflight.requireAdministrator
                ? '当前项目构建属性要求管理员：将安装到 Program Files 并请求管理员权限。'
                : '当前项目无需管理员：将安装到当前用户目录，全程免管理员。')}
              {' '}程序自身的 UAC 行为由 exe 决定，不受安装器影响。
            </p>
          </div>

          {(localError || error) && (
            <div data-role="installer-export-error" className={`rounded border px-3 py-2 text-xs ${
              isDarkMode ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-red-300 bg-red-50 text-red-700'
            }`}>
              {localError || error}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs ${isDarkMode ? 'text-slate-300 hover:bg-[#2a2a31]' : 'text-slate-600 hover:bg-slate-100'}`}
            onClick={() => { if (!busy) onClose(); }}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? '正在打包…' : '导出安装包'}
          </button>
        </div>
      </form>
    </div>
  );
}
