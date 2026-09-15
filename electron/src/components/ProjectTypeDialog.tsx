import { useEffect, useRef } from 'react';
import {
  AppWindow,
  ArrowRight,
  Box,
  Monitor,
  PackageOpen,
  SquareTerminal,
  X
} from 'lucide-react';

interface ProjectTypeDialogProps {
  open: boolean;
  isDarkMode: boolean;
  onSelectWindowsUi: () => void;
  onSelectWindowsDll: () => void;
  onSelectWindowsConsole: () => void;
  onClose: () => void;
}

const projectTypes = [
  {
    id: 'windows-ui',
    title: 'Windows 界面设计',
    description: '使用可视化窗口设计器创建 Win32 桌面应用。',
    status: '当前可用',
    enabled: true,
    icon: AppWindow
  },
  {
    id: 'windows-dll',
    title: 'Windows 平台 DLL 开发',
    description: '封装可复用的 Windows 原生动态链接库。',
    status: '当前可用',
    enabled: true,
    icon: Box
  },
  {
    id: 'windows-console',
    title: 'Windows 控制台程序',
    description: '以“公开 启动()”子程序为主体创建命令行程序。',
    status: '当前可用',
    enabled: true,
    icon: SquareTerminal
  },
  {
    id: 'mac-ui',
    title: 'Mac 界面设计',
    description: '使用可视化设计器创建 macOS 桌面应用。',
    status: '规划中',
    enabled: false,
    icon: Monitor
  },
  {
    id: 'mac-library',
    title: 'Mac 平台动态库开发',
    description: '构建供 macOS 应用调用的原生动态库。',
    status: '规划中',
    enabled: false,
    icon: PackageOpen
  },
  {
    id: 'mac-console',
    title: 'Mac 控制台程序',
    description: '复用同一控制台入口形态，构建 macOS 命令行程序。',
    status: '规划中',
    enabled: false,
    icon: SquareTerminal
  }
] as const;

export default function ProjectTypeDialog({
  open,
  isDarkMode,
  onSelectWindowsUi,
  onSelectWindowsDll,
  onSelectWindowsConsole,
  onClose
}: ProjectTypeDialogProps) {
  const availableProjectRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => availableProjectRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-type-dialog-title"
      aria-describedby="project-type-dialog-description"
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        className={`flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border shadow-2xl ${
          isDarkMode
            ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <div>
            <h2 id="project-type-dialog-title" className="text-base font-semibold">选择项目类型</h2>
            <p id="project-type-dialog-description" className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              选择要创建的项目。尚未开放的类型会保留在这里展示开发计划。
            </p>
          </div>
          <button
            type="button"
            title="关闭"
            aria-label="关闭项目类型选择"
            onClick={onClose}
            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
              isDarkMode ? 'text-slate-400 hover:bg-[#303038] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectTypes.map(projectType => {
              const Icon = projectType.icon;
              const enabledClasses = isDarkMode
                ? 'border-blue-400/70 bg-blue-500/10 hover:border-blue-300 hover:bg-blue-500/15'
                : 'border-blue-400 bg-blue-50 hover:border-blue-500 hover:bg-blue-100/70';
              const disabledClasses = isDarkMode
                ? 'cursor-not-allowed border-[#37373f] bg-[#232329] text-slate-500'
                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400';
              const firstEnabledId = projectTypes.find(item => item.enabled)?.id;

              return (
                <button
                  ref={projectType.id === firstEnabledId ? availableProjectRef : undefined}
                  key={projectType.id}
                  type="button"
                  data-project-type={projectType.id}
                  disabled={!projectType.enabled}
                  onClick={projectType.enabled
                    ? projectType.id === 'windows-dll' ? onSelectWindowsDll
                      : projectType.id === 'windows-console' ? onSelectWindowsConsole
                        : onSelectWindowsUi
                    : undefined}
                  className={`group flex min-h-36 w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                    projectType.enabled ? `cursor-pointer ${enabledClasses}` : disabledClasses
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                    projectType.enabled
                      ? isDarkMode
                        ? 'border-blue-400/40 bg-blue-500/15 text-blue-300'
                        : 'border-blue-200 bg-white text-blue-600'
                      : isDarkMode
                        ? 'border-[#414149] bg-[#292930] text-slate-500'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col self-stretch">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${projectType.enabled ? (isDarkMode ? 'text-slate-100' : 'text-slate-900') : ''}`}>
                        {projectType.title}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        projectType.enabled
                          ? isDarkMode
                            ? 'bg-blue-400/15 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                          : isDarkMode
                            ? 'bg-[#303038] text-slate-500'
                            : 'bg-slate-200/70 text-slate-500'
                      }`}>
                        {projectType.status}
                      </span>
                    </span>
                    <span className={`mt-2 text-xs leading-5 ${
                      projectType.enabled
                        ? isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        : isDarkMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {projectType.description}
                    </span>
                    {projectType.enabled && (
                      <span className={`mt-auto flex items-center gap-1 pt-3 text-xs font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        选择此类型
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 ${isDarkMode ? 'border-[#35353c] bg-[#1b1b20]' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            当前开放 Windows 界面设计、Windows 平台 DLL 开发和 Windows 控制台程序。
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`h-8 cursor-pointer rounded-md border px-3 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
              isDarkMode
                ? 'border-[#484850] text-slate-300 hover:bg-[#303038] hover:text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
