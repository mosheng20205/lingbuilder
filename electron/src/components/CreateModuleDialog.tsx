import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Package, X } from 'lucide-react';

interface CreateModuleDialogProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
}

type ModuleDialogMode = 'create' | 'open';

interface ModuleAuthoringResult {
  moduleId: string;
  sourcePath: string;
  diagnostics?: string[];
}

const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,80}$/u;

const MODULE_CATEGORIES = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'] as const;

export default function CreateModuleDialog({ open, isDarkMode, onClose }: CreateModuleDialogProps) {
  const [mode, setMode] = useState<ModuleDialogMode>('create');
  const [moduleId, setModuleId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [moduleCategory, setModuleCategory] = useState('系统');
  const [moduleDescription, setModuleDescription] = useState('');
  const [packagePath, setPackagePath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [result, setResult] = useState<ModuleAuthoringResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('create');
    setModuleId('');
    setModuleName('');
    setModuleCategory('系统');
    setModuleDescription('');
    setPackagePath('');
    setErrorText('');
    setResult(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const panelClass = isDarkMode
    ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';
  const borderClass = isDarkMode ? 'border-[#35353c]' : 'border-slate-200';
  const inputClass = `h-9 w-full rounded-md border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
    isDarkMode
      ? 'border-[#3d3d44] bg-[#17171c] text-slate-200 placeholder:text-slate-500'
      : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
  }`;
  const subtleClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const submit = async () => {
    setErrorText('');
    if (mode === 'create') {
      if (!MODULE_ID_PATTERN.test(moduleId.trim())) {
        setErrorText('模块 ID 只能使用小写字母、数字、点、下划线和中划线（3~81 位，字母或数字开头），例如 lingbuilder.demo.greeter。');
        return;
      }
      if (!moduleName.trim()) {
        setErrorText('请填写模块名称，例如「键鼠演示常量」。');
        return;
      }
    } else if (!packagePath.trim()) {
      setErrorText('请填写 .lbmod 模块包的完整路径，或把文件拖进输入框。');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        mode === 'create' ? '/api/modules/developer/create' : '/api/modules/developer/open-package',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'create'
            ? {
              id: moduleId.trim(),
              name: moduleName.trim(),
              category: moduleCategory.trim() || undefined,
              description: moduleDescription.trim() || undefined,
              template: 'cpp-source'
            }
            : { packagePath: packagePath.trim() })
        }
      );
      const payload = await response.json().catch(() => undefined) as { ok?: boolean; error?: string } & ModuleAuthoringResult;
      if (!response.ok || !payload?.ok) {
        setErrorText(payload?.error || '模块创建失败，请稍后重试。');
        return;
      }
      setResult({ moduleId: payload.moduleId, sourcePath: payload.sourcePath, diagnostics: payload.diagnostics });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '模块创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-module-dialog-title"
      onKeyDown={event => {
        if (event.key === 'Escape' && !submitting) onClose();
      }}
    >
      <div className={`flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border shadow-2xl ${panelClass}`}>
        <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${borderClass}`}>
          <div>
            <h2 id="create-module-dialog-title" className="text-base font-semibold">新建模块</h2>
            <p className={`mt-1 text-xs leading-5 ${subtleClass}`}>
              创建或打开 .lbmod 模块源码工程，登记开发源后即可编辑、校验并发布模块包。
            </p>
          </div>
          <button
            type="button"
            title="关闭"
            aria-label="关闭新建模块"
            onClick={() => { if (!submitting) onClose(); }}
            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
              isDarkMode ? 'text-slate-400 hover:bg-[#303038] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="min-h-0 overflow-auto p-5">
            <div className={`flex items-start gap-3 rounded-md border p-4 ${
              isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'
            }`}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">模块源码已就绪</div>
                <div className={`mt-2 space-y-1 text-xs leading-5 ${subtleClass}`}>
                  <div>模块 ID：<span className="font-mono">{result.moduleId}</span></div>
                  <div className="break-all">源码目录：<span className="font-mono">{result.sourcePath}</span></div>
                  <div>已自动登记为开发源：进入工作台后，模块页立即可以看到并启用该模块。</div>
                  {result.diagnostics && result.diagnostics.length > 0 && (
                    <div className="break-words text-amber-500">清单提示：{result.diagnostics.join('；')}</div>
                  )}
                </div>
                <div className={`mt-3 space-y-1 rounded border p-3 text-xs leading-5 ${borderClass} ${subtleClass}`}>
                  <div>1. 进入工作台 → 活动栏「模块」→ 找到模块卡片 → 启用到当前项目。</div>
                  <div>2. 「文件 → 打开文件」编辑清单 lingbuilder.module.json、C++ 源码、docs 与 examples。</div>
                  <div>3. 模块页「模块包导出」把源码目录发布为 .lbmod 模块包。</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 overflow-auto p-5">
            <div className={`mb-4 inline-flex rounded-md border p-0.5 ${borderClass}`} role="tablist" aria-label="模块来源">
              {(['create', 'open'] as const).map(item => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => { setMode(item); setErrorText(''); }}
                  className={`h-8 cursor-pointer rounded px-3 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                    mode === item
                      ? isDarkMode ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-800'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {item === 'create' ? '从模板新建' : '打开 .lbmod 模块包'}
                </button>
              ))}
            </div>

            {mode === 'create' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">模块 ID <span className="text-rose-400">*</span></span>
                  <input
                    type="text"
                    value={moduleId}
                    onChange={event => setModuleId(event.target.value)}
                    placeholder="例如 lingbuilder.demo.greeter"
                    aria-label="模块 ID"
                    className={inputClass}
                  />
                  <span className={`mt-1 block text-[11px] ${subtleClass}`}>小写字母或数字开头，可含点、下划线、中划线（3~81 位）。</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">模块名称 <span className="text-rose-400">*</span></span>
                  <input
                    type="text"
                    value={moduleName}
                    onChange={event => setModuleName(event.target.value)}
                    placeholder="例如 键鼠演示常量"
                    aria-label="模块名称"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">分类</span>
                  <select
                    value={moduleCategory}
                    onChange={event => setModuleCategory(event.target.value)}
                    aria-label="模块分类"
                    className={inputClass}
                  >
                    {MODULE_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">模块说明</span>
                  <textarea
                    value={moduleDescription}
                    onChange={event => setModuleDescription(event.target.value)}
                    placeholder="这个模块提供什么能力？会在模块详情里展示。"
                    aria-label="模块说明"
                    rows={3}
                    className={`${inputClass} h-auto py-2`}
                  />
                </label>
                <p className={`text-[11px] leading-5 ${subtleClass}`}>
                  骨架包含 manifest v2 清单、示例命令、示例常量、使用说明与最小示例源码，生成到工作区
                  <span className="font-mono"> .lingbuilder/module-build/&lt;模块 ID&gt; </span>
                  目录。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">.lbmod 模块包路径 <span className="text-rose-400">*</span></span>
                  <input
                    type="text"
                    value={packagePath}
                    onChange={event => setPackagePath(event.target.value)}
                    placeholder="例如 D:\\modules\\my-module.lbmod（支持本机绝对路径）"
                    aria-label="模块包路径"
                    className={inputClass}
                  />
                </label>
                <p className={`text-[11px] leading-5 ${subtleClass}`}>
                  模块包会解开到工作区 <span className="font-mono">.lingbuilder/module-build/&lt;模块 ID&gt; </span>
                  目录并登记开发源；不会直接安装，bin、lib 等二进制资源原样保留。
                </p>
              </div>
            )}

            {errorText && (
              <div className={`mt-3 break-words rounded border px-3 py-2 text-xs leading-5 ${
                isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-rose-300 bg-rose-50 text-rose-700'
              }`} role="alert">
                {errorText}
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 ${borderClass} ${isDarkMode ? 'bg-[#1b1b20]' : 'bg-slate-50'}`}>
            <span className={`text-[11px] ${subtleClass}`}>创建后自动登记开发源，无需重新打包安装即可编辑与构建。</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={`h-8 cursor-pointer rounded-md border px-3 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDarkMode
                    ? 'border-[#484850] text-slate-300 hover:bg-[#303038] hover:text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { void submit(); }}
                disabled={submitting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#007acc] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#168ad4] focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Package className="h-3.5 w-3.5" />
                {mode === 'create' ? '创建模块' : '打开模块包'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
