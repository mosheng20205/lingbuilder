import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_PATH_MACROS,
  DEFAULT_BUILD_DIRECTORY_TEMPLATE,
  DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE,
  getEffectiveBuildPathTemplates,
  resolveBuildPathTemplate,
  validateBuildPathTemplate
} from '../services/tasks/buildPathTemplate';

export interface ProjectBuildPathsDialogValue {
  /** 项目覆盖：构建目录模板；空字符串表示跟随工作区默认。 */
  projectBuildDirectory: string;
  /** 项目覆盖：生成源码目录模板；空字符串表示跟随工作区默认。 */
  projectGeneratedSourceDirectory: string;
  /** 工作区默认：构建目录模板；空字符串表示使用内置缺省。 */
  workspaceBuildDirectory: string;
  /** 工作区默认：生成源码目录模板；空字符串表示使用内置缺省。 */
  workspaceGeneratedSourceDirectory: string;
}

interface ProjectBuildPathsDialogProps {
  open: boolean;
  isDarkMode: boolean;
  busy?: boolean;
  error?: string;
  projectName: string;
  initialValue: ProjectBuildPathsDialogValue;
  /** 当前构建配置，用于解析预览。 */
  platform: string;
  configuration: string;
  onConfirm: (value: ProjectBuildPathsDialogValue) => void | Promise<void>;
  onClose: () => void;
}

/**
 * 项目构建目录设置对话框（对齐 Visual Studio 的输出目录自定义）：
 * 项目覆盖值保存到解决方案项目 buildProperties，工作区默认保存到构建配置；
 * 输入时按与服务端一致的模板规则实时解析预览。
 */
export default function ProjectBuildPathsDialog({
  open,
  isDarkMode,
  busy = false,
  error,
  projectName,
  initialValue,
  platform,
  configuration,
  onConfirm,
  onClose
}: ProjectBuildPathsDialogProps) {
  const [value, setValue] = useState<ProjectBuildPathsDialogValue>(initialValue);
  const [localError, setError] = useState<string>('');
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // 父组件每次渲染都会新建 initialValue 对象字面量；按内容比较避免重渲染清掉用户输入。
  const initialValueKey = JSON.stringify(initialValue);

  useEffect(() => {
    if (!open) return;
    setValue(JSON.parse(initialValueKey));
    setError('');
    const frame = window.requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialValueKey]);

  const previews = useMemo(() => {
    const previewVariables = {
      projectDirName: '当前项目',
      projectName,
      platform,
      configuration
    };
    const resolve = (template: string): string => {
      try {
        return resolveBuildPathTemplate(template, previewVariables);
      } catch {
        return template;
      }
    };
    const projectEffective = getEffectiveBuildPathTemplates({
      buildDirectory: value.projectBuildDirectory,
      generatedSourceDirectory: value.projectGeneratedSourceDirectory
    });
    const workspaceEffective = getEffectiveBuildPathTemplates({
      buildDirectory: value.workspaceBuildDirectory,
      generatedSourceDirectory: value.workspaceGeneratedSourceDirectory
    });
    return {
      projectBuild: resolve(projectEffective.buildDirectory),
      projectExport: resolve(projectEffective.generatedSourceDirectory),
      workspaceBuild: resolve(workspaceEffective.buildDirectory),
      workspaceExport: resolve(workspaceEffective.generatedSourceDirectory)
    };
  }, [value, projectName, platform, configuration]);

  if (!open) return null;

  const inputClassName = `w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
    isDarkMode
      ? 'border-[#414149] bg-[#25252c] text-slate-100'
      : 'border-slate-300 bg-white text-slate-900'
  }`;
  const hintClassName = `mt-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const sectionClassName = `rounded border px-3 py-3 ${isDarkMode ? 'border-[#35353c] bg-[#232329]' : 'border-slate-200 bg-slate-50'}`;
  const previewClassName = `text-[11px] ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`;

  const update = (patch: Partial<ProjectBuildPathsDialogValue>) => {
    setValue(previous => ({ ...previous, ...patch }));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    try {
      validateBuildPathTemplate(value.workspaceBuildDirectory, '工作区构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE);
      validateBuildPathTemplate(value.workspaceGeneratedSourceDirectory, '工作区生成源码目录', DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE);
      if (value.projectBuildDirectory.trim()) {
        validateBuildPathTemplate(value.projectBuildDirectory, '项目构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE);
      }
      if (value.projectGeneratedSourceDirectory.trim()) {
        validateBuildPathTemplate(value.projectGeneratedSourceDirectory, '项目生成源码目录', DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE);
      }
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : '构建目录设置无效。');
      return;
    }
    void onConfirm(value);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-build-paths-dialog-title"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className={`w-full max-w-lg rounded-lg border shadow-2xl ${
          isDarkMode
            ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 id="project-build-paths-dialog-title" className="text-sm font-semibold">项目构建目录</h2>
          <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            自定义 {projectName} 的 C++ 源码输出目录与构建输出目录；留空表示跟随工作区默认。可用宏：
            {BUILD_PATH_MACROS.map(macro => `$(${macro})`).join('、')}。
          </p>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
          <div className={sectionClassName}>
            <div className="mb-2 text-xs font-medium">本项目覆盖（仅 {projectName}）</div>
            <label htmlFor="project-build-dir" className="mb-1 block text-[11px]">构建目录（含 src、bin、Visual Studio 工程）</label>
            <input
              ref={firstFieldRef}
              id="project-build-dir"
              aria-label="项目构建目录"
              value={value.projectBuildDirectory}
              placeholder={previews.workspaceBuild}
              disabled={busy}
              onChange={event => update({ projectBuildDirectory: event.target.value })}
              className={inputClassName}
            />
            <p className={previewClassName}>解析：{previews.projectBuild}</p>
            <label htmlFor="project-export-dir" className="mb-1 mt-3 block text-[11px]">生成源码目录（可复制的 Visual Studio 工程）</label>
            <input
              id="project-export-dir"
              aria-label="项目生成源码目录"
              value={value.projectGeneratedSourceDirectory}
              placeholder={previews.workspaceExport}
              disabled={busy}
              onChange={event => update({ projectGeneratedSourceDirectory: event.target.value })}
              className={inputClassName}
            />
            <p className={previewClassName}>解析：{previews.projectExport}</p>
          </div>

          <div className={sectionClassName}>
            <div className="mb-2 text-xs font-medium">工作区默认（全部项目，可在项目里覆盖）</div>
            <label htmlFor="workspace-build-dir" className="mb-1 block text-[11px]">默认构建目录</label>
            <input
              id="workspace-build-dir"
              aria-label="工作区默认构建目录"
              value={value.workspaceBuildDirectory}
              placeholder={DEFAULT_BUILD_DIRECTORY_TEMPLATE}
              disabled={busy}
              onChange={event => update({ workspaceBuildDirectory: event.target.value })}
              className={inputClassName}
            />
            <p className={previewClassName}>解析：{previews.workspaceBuild}</p>
            <label htmlFor="workspace-export-dir" className="mb-1 mt-3 block text-[11px]">默认生成源码目录</label>
            <input
              id="workspace-export-dir"
              aria-label="工作区默认生成源码目录"
              value={value.workspaceGeneratedSourceDirectory}
              placeholder={DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE}
              disabled={busy}
              onChange={event => update({ workspaceGeneratedSourceDirectory: event.target.value })}
              className={inputClassName}
            />
            <p className={previewClassName}>解析：{previews.workspaceExport}</p>
            <p className={hintClassName}>
              只支持工作区相对路径；当前配置 {configuration}|{platform}。修改后下次构建生效，旧目录可用「清理」命令删除。
            </p>
          </div>

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
          >取消</button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
          >{busy ? '正在保存…' : '保存'}</button>
        </div>
      </form>
    </div>
  );
}
