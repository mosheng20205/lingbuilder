import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ModuleInfoWindow from './components/ModuleInfoWindow';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';
import '@xterm/xterm/css/xterm.css';

// 渲染层未捕获错误统一转发到主进程诊断日志（userData/logs），
// 保证用户机器上「没点任何东西就黑屏」这类现场有日志可回传分析。
const reportRendererError = (category: string, message: string) => {
  try {
    window.lingBuilder?.logs?.report({ level: 'error', category, message: message.slice(0, 900) });
  } catch {
    // 诊断转发失败不得影响页面本身。
  }
};
window.addEventListener('error', event => {
  const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '未知位置';
  reportRendererError('renderer-error', event.error?.stack || `${event.message}（位置 ${where}）`);
});
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  reportRendererError('renderer-rejection', reason instanceof Error ? (reason.stack || reason.message) : String(reason));
});

const moduleInfoWindow = new URLSearchParams(window.location.search).has('module-info-window');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {moduleInfoWindow ? <ModuleInfoWindow /> : <App />}
    </AppErrorBoundary>
  </StrictMode>,
);
