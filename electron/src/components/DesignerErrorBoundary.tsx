import React from 'react';

interface DesignerErrorBoundaryProps {
  /** 变化时自动清除错误状态并重新挂载子树，例如项目切换。 */
  resetKey: string;
  isDarkMode?: boolean;
  children: React.ReactNode;
}

interface DesignerErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

/**
 * 设计器渲染崩溃的最后防线。React 渲染期异常没有本地捕获点，一旦发生会把
 * 整棵组件树卸载——在深色工作台里表现为整窗黑屏。此边界把崩溃降级为可读的
 * 中文错误卡片：保留错误文本与组件栈供反馈定位，并提供恢复入口。
 */
export default class DesignerErrorBoundary extends React.Component<DesignerErrorBoundaryProps, DesignerErrorBoundaryState> {
  state: DesignerErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<DesignerErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' });
    const digest = (info.componentStack || '').split('\n').filter(line => line.trim()).slice(0, 6).join('\n');
    window.dispatchEvent(new CustomEvent('add-app-log', {
      detail: { message: `> 【界面设计器】渲染崩溃：${error.message}\n${digest}` }
    }));
  }

  componentDidUpdate(previousProps: DesignerErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: '' });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null, componentStack: '' });
  };

  render() {
    const { error, componentStack } = this.state;
    const { isDarkMode, children } = this.props;
    if (!error) return children;
    const panel = isDarkMode
      ? 'bg-[#1b1b20] border-[#5b2333] text-slate-200'
      : 'bg-white border-red-300 text-slate-800';
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#101014]">
        <div className={`max-w-xl w-full rounded-lg border p-5 space-y-3 shadow-xl ${panel}`} role="alert">
          <h2 className="text-base font-semibold text-red-400">界面设计器遇到渲染错误，已停止显示以保护项目数据</h2>
          <p className="text-xs leading-5 opacity-80">
            设计器画布已临时关闭；你的项目文件与代码不受影响。可切回「查看代码」继续编辑，或点击下方按钮重新载入设计器。
            请把以下错误信息截图反馈，便于定位修复。
          </p>
          <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2.5 text-[11px] leading-4 whitespace-pre-wrap break-all text-red-300">{error.message}{error.stack ? `\n${error.stack.split('\n').slice(1, 5).join('\n')}` : ''}</pre>
          {componentStack ? (
            <details className="text-[11px] opacity-70">
              <summary className="cursor-pointer select-none">组件栈（展开查看）</summary>
              <pre className="max-h-32 overflow-auto mt-1 whitespace-pre-wrap break-all">{componentStack}</pre>
            </details>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
            >
              重新载入设计器
            </button>
          </div>
        </div>
      </div>
    );
  }
}
