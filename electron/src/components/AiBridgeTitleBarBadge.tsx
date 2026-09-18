import { useEffect, useState } from 'react';
import { Cable } from 'lucide-react';

interface BridgeStatusSnapshot {
  state: string;
  port: number;
  activeClients: number;
}

/**
 * 标题栏 AI Bridge 运行徽标：连接中心关闭后仍可见 Bridge 是否在监听、端口与客户端数，
 * 点击直接打开连接中心。非桌面版（无 aiBridge IPC）或未运行时不渲染。
 */
export default function AiBridgeTitleBarBadge({ onOpen, isDarkMode }: { onOpen: () => void; isDarkMode: boolean }) {
  const [snapshot, setSnapshot] = useState<BridgeStatusSnapshot | null>(null);
  const api = window.lingBuilder?.aiBridge;

  useEffect(() => {
    if (!api) return undefined;
    let disposed = false;
    const unsubscribe = api.onStatusChanged(next => {
      if (!disposed) setSnapshot(next as unknown as BridgeStatusSnapshot);
    });
    void api.status().then(next => {
      if (!disposed) setSnapshot(next as unknown as BridgeStatusSnapshot);
    }).catch(() => undefined);
    return () => { disposed = true; unsubscribe(); };
  }, [api]);

  if (!api || !snapshot || (snapshot.state !== 'running' && snapshot.state !== 'starting')) return null;
  const running = snapshot.state === 'running';
  return (
    <button
      type="button"
      onClick={event => { event.stopPropagation(); onOpen(); }}
      onDoubleClick={event => event.stopPropagation()}
      aria-label={running ? `AI Bridge 运行中，端口 ${snapshot.port}，${snapshot.activeClients} 个客户端，点击打开连接中心` : 'AI Bridge 正在启动，点击打开连接中心'}
      title={running ? `AI Bridge 运行中 · 端口 ${snapshot.port} · ${snapshot.activeClients} 个已连接客户端` : 'AI Bridge 正在启动…'}
      className={`window-no-drag flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ring-1 transition-colors ${
        running
          ? 'bg-cyan-500/15 text-cyan-500 ring-cyan-500/40 hover:bg-cyan-500/30'
          : isDarkMode ? 'bg-amber-500/15 text-amber-400 ring-amber-500/40' : 'bg-amber-500/15 text-amber-600 ring-amber-500/40'
      }`}
    >
      <Cable className="h-3 w-3" aria-hidden="true" />
      {running ? `Bridge :${snapshot.port}${snapshot.activeClients > 0 ? ` · ${snapshot.activeClients}` : ''}` : 'Bridge 启动中'}
    </button>
  );
}
