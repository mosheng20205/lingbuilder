import React, { FormEvent, useEffect, useRef, useState } from 'react';

export type SolutionProjectBuildKind = 'visual-cpp' | 'windows-dll' | 'windows-console' | 'external-msbuild' | 'external-cmake';

export interface ProjectBuildKindInfo {
  /** 类型主标题，例如「动态链接库（DLL）」。 */
  title: string;
  /** 一句话说明产物与运行行为，帮助用户确认自己创建的是哪类项目。 */
  hint: string;
}

/**
 * 项目类型 → 构建属性对话框顶部的类型说明。
 * EXE/DLL 区分依据：windows-dll 与 outputType:'dll' 都是 DLL；windows-console 是控制台 EXE；
 * 其余窗口项目是 Win32 EXE；外部工程按 outputType 缺省 EXE 展示。
 */
export function resolveProjectBuildKindInfo(projectType: SolutionProjectBuildKind | string, outputType?: 'exe' | 'dll'): ProjectBuildKindInfo {
  switch (projectType) {
    case 'windows-dll':
      return { title: '动态链接库（DLL）', hint: '生成 .dll 与导入库 .lib，供其他程序调用；没有运行入口，编译请用「生成项目 / 生成解决方案」或工具栏的「生成动态库」按钮。' };
    case 'windows-console':
      return { title: '控制台程序（EXE）', hint: '以「公开 启动()」子程序为主体的命令行程序，编译为控制台可执行文件，F5 编译后自动运行。' };
    case 'external-msbuild':
      return outputType === 'dll'
        ? { title: 'MSBuild 外部工程（DLL）', hint: '调用本机 MSBuild 编译已导入的 .vcxproj/.sln 工程，产物为动态链接库。' }
        : { title: 'MSBuild 外部工程（EXE）', hint: '调用本机 MSBuild 编译已导入的 .vcxproj/.sln 工程，产物为可执行文件。' };
    case 'external-cmake':
      return outputType === 'dll'
        ? { title: 'CMake 外部工程（DLL）', hint: '调用本机 CMake 构建已导入的 CMakeLists.txt 工程，产物为动态链接库。' }
        : { title: 'CMake 外部工程（EXE）', hint: '调用本机 CMake 构建已导入的 CMakeLists.txt 工程，产物为可执行文件。' };
    default:
      return outputType === 'dll'
        ? { title: '动态链接库（DLL）', hint: '当前中文窗口项目按动态库输出：生成 .dll 与导入库 .lib 并导出「公开」子程序；没有运行入口。' }
        : { title: 'Windows 界面程序（EXE）', hint: '使用可视化窗口设计器创建的 Win32 桌面程序，编译为图形界面可执行文件，支持 F5 生成并运行。' };
  }
}

export interface ProjectBuildPropertiesDialogValue {
  configuration: 'Debug' | 'Release';
  architecture: 'Win32' | 'x64';
  additionalArgumentsText: string;
}

interface ProjectBuildPropertiesDialogProps {
  open: boolean;
  isDarkMode: boolean;
  busy?: boolean;
  error?: string;
  projectName: string;
  /** 解决方案项目类型，用于顶部类型说明。 */
  projectType: SolutionProjectBuildKind | string;
  /** 项目产物类型；缺省按 EXE 展示。 */
  outputType?: 'exe' | 'dll';
  /** 窗口项目（visual-cpp）的模式/架构由工作区构建配置决定，对话框为只读展示。 */
  editable: boolean;
  /** editable=false 时展示的工作区生效配置说明，例如「Debug · Win32」。 */
  workspaceEffectiveLabel?: string;
  /** 项目目录登记了模块开发源链接时展示的模块信息：构建属性里明示这是模块项目。 */
  linkedModule?: { id: string; name: string };
  initialValue: ProjectBuildPropertiesDialogValue;
  onConfirm: (value: ProjectBuildPropertiesDialogValue) => void | Promise<void>;
  onClose: () => void;
}

/**
 * 项目构建属性对话框（解决方案资源管理器右键「构建属性…」）：
 * 顶部固定展示项目类型（EXE / DLL / 控制台 / 外部工程），让用户先确认项目种类；
 * 窗口项目以下的项目还可在此调整构建模式、架构与附加参数（写入 buildProperties）。
 */
export default function ProjectBuildPropertiesDialog({
  open,
  isDarkMode,
  busy = false,
  error,
  projectName,
  projectType,
  outputType,
  editable,
  workspaceEffectiveLabel,
  linkedModule,
  initialValue,
  onConfirm,
  onClose
}: ProjectBuildPropertiesDialogProps) {
  const [value, setValue] = useState<ProjectBuildPropertiesDialogValue>(initialValue);
  const [localError, setError] = useState<string>('');
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const initialValueKey = JSON.stringify(initialValue);

  useEffect(() => {
    if (!open) return;
    setValue(JSON.parse(initialValueKey));
    setError('');
    if (editable) {
      const frame = window.requestAnimationFrame(() => firstFieldRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [open, initialValueKey, editable]);

  const kindInfo = resolveProjectBuildKindInfo(projectType, outputType);

  if (!open) return null;

  const inputClassName = `w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
    isDarkMode ? 'border-[#414149] bg-[#25252c] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const hintClassName = `mt-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const sectionClassName = `rounded border px-3 py-3 ${isDarkMode ? 'border-[#35353c] bg-[#232329]' : 'border-slate-200 bg-slate-50'}`;
  const labelClassName = 'mb-1 block text-[11px]';

  const update = (patch: Partial<ProjectBuildPropertiesDialogValue>) => {
    setValue(previous => ({ ...previous, ...patch }));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    void onConfirm(value);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-build-properties-dialog-title"
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
          <h2 id="project-build-properties-dialog-title" className="text-sm font-semibold">项目构建属性</h2>
          <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            查看 {projectName} 的项目类型与构建配置。
          </p>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
          <div className={sectionClassName} data-role="project-kind">
            <div className="mb-1 text-xs font-medium">项目类型</div>
            <div className={`text-sm font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>{kindInfo.title}</div>
            <p className={hintClassName}>{kindInfo.hint}</p>
            {linkedModule && (
              <div
                data-role="linked-module"
                className={`mt-2 rounded border px-2 py-1.5 text-[11px] ${isDarkMode ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-violet-300 bg-violet-50 text-violet-700'}`}
              >
                模块项目：该目录已登记为模块「{linkedModule.name}」（{linkedModule.id}）的开发源，改动即时生效；打包发布请在模块面板使用「包制作」。
              </div>
            )}
          </div>

          {editable ? (
            <div className={sectionClassName}>
              <div className="mb-2 text-xs font-medium">构建配置（仅 {projectName}）</div>
              <label htmlFor="project-build-configuration" className={labelClassName}>构建模式</label>
              <select
                ref={firstFieldRef}
                id="project-build-configuration"
                aria-label="构建模式"
                value={value.configuration}
                disabled={busy}
                onChange={event => update({ configuration: event.target.value === 'Release' ? 'Release' : 'Debug' })}
                className={inputClassName}
              >
                <option value="Debug">Debug（调试）</option>
                <option value="Release">Release（发布）</option>
              </select>
              <label htmlFor="project-build-architecture" className="mb-1 mt-3 block text-[11px]">构建架构</label>
              <select
                id="project-build-architecture"
                aria-label="构建架构"
                value={value.architecture}
                disabled={busy}
                onChange={event => update({ architecture: event.target.value === 'x64' ? 'x64' : 'Win32' })}
                className={inputClassName}
              >
                <option value="Win32">Win32（32 位）</option>
                <option value="x64">x64（64 位）</option>
              </select>
              <label htmlFor="project-build-extra-args" className="mb-1 mt-3 block text-[11px]">附加参数（传给 MSBuild / CMake，用空格分隔，可留空）</label>
              <input
                id="project-build-extra-args"
                aria-label="附加参数"
                value={value.additionalArgumentsText}
                disabled={busy}
                onChange={event => update({ additionalArgumentsText: event.target.value })}
                className={inputClassName}
              />
              <p className={hintClassName}>修改保存到解决方案项目；产物文件名与输出目录在「构建目录…」对话框设置。</p>
            </div>
          ) : (
            <div className={sectionClassName}>
              <div className="mb-2 text-xs font-medium">构建配置</div>
              <p className="text-xs">{workspaceEffectiveLabel || '跟随工作区构建配置。'}</p>
              <p className={hintClassName}>
                窗口项目的构建模式与架构由工作区构建配置统一决定，可用菜单「生成 → 配置」切换；产物文件名与输出目录在「构建目录…」对话框设置。
              </p>
            </div>
          )}

          {(localError || error) && (
            <div role="alert" className="text-xs text-rose-500">{localError || error}</div>
          )}
        </div>

        <div className={`flex justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`rounded px-3 py-1.5 text-xs ${isDarkMode ? 'bg-[#2d2d33] hover:bg-[#38383f]' : 'bg-slate-100 hover:bg-slate-200'}`}
          >{editable ? '取消' : '关闭'}</button>
          {editable && (
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
            >{busy ? '正在保存…' : '保存'}</button>
          )}
        </div>
      </form>
    </div>
  );
}
