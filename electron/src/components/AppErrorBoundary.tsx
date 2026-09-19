import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

/**
 * 整窗黑屏的最后防线：React 渲染期异常没有边界时会卸载整棵树，深色背景下就是黑屏。
 * 此边界把崩溃降级为中文错误卡片，并把错误写入主进程诊断日志（userData/logs）。
 */
export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const stack = `${error.stack || error.message}\n组件栈：${(info.componentStack || '').split('\n').filter(line => line.trim()).slice(0, 6).join(' | ')}`;
    try {
      window.lingBuilder?.logs?.report({ level: 'error', category: 'renderer-boundary', message: `界面渲染崩溃：${stack}` });
    } catch {
      // 网页预览环境没有桌面 API，忽略。
    }
    this.setState({ componentStack: info.componentStack || '' });
  }

  private handleExportLogs = () => {
    void window.lingBuilder?.logs?.export();
  };

  private handleRevealLogs = () => {
    void window.lingBuilder?.logs?.reveal();
  };

  private handleDeleteLogs = () => {
    void window.lingBuilder?.logs?.delete();
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6 bg-[#1e1e1e] text-slate-200">
        <div className="max-w-2xl w-full rounded-lg border border-[#5b2333] bg-[#1b1b20] p-6 space-y-4 shadow-2xl" role="alert">
          <h1 className="text-base font-semibold text-red-400">界面遇到意外错误，已停止渲染以保护你的项目数据</h1>
          <p className="text-xs leading-5 opacity-80">
            你的项目文件与代码不受影响。点击下方按钮重新载入界面；如果反复出现此画面或黑屏，
            请「导出本地日志」发送给开发者定位（日志不含你的代码内容）。
          </p>
          <pre className="max-h-40 overflow-auto rounded bg-black/40 p-3 text-[11px] leading-4 whitespace-pre-wrap break-all text-red-300">{error.message}{error.stack ? `\n${error.stack.split('\n').slice(1, 6).join('\n')}` : ''}</pre>
          {componentStack ? (
            <details className="text-[11px] opacity-70">
              <summary className="cursor-pointer select-none">组件栈（展开查看）</summary>
              <pre className="max-h-40 overflow-auto mt-1 whitespace-pre-wrap break-all">{componentStack}</pre>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => window.location.reload()} className="rounded bg-[#007acc] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#0e8fd8]">
              重新载入界面
            </button>
            <button type="button" onClick={this.handleExportLogs} className="rounded bg-slate-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-600">
              导出本地日志…
            </button>
            <button type="button" onClick={this.handleRevealLogs} className="rounded bg-slate-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-600">
              打开日志目录
            </button>
            <button type="button" onClick={this.handleDeleteLogs} className="rounded bg-slate-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-600">
              删除本地日志
            </button>
          </div>
        </div>
      </div>
    );
  }
}
