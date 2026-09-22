import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('terminal panel exposes accessible host, session actions, websocket channel, paste and context menu contracts', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/TerminalPanel.tsx'), 'utf8');
  assert.match(source, /aria-label="集成终端"/u);
  assert.match(source, /aria-label="新建终端"/u);
  // 单条 WebSocket 双向通道替代 SSE + 逐键 POST
  assert.match(source, /new WebSocket\(/u);
  assert.match(source, /\/api\/terminal\/ws\?ticket=/u);
  assert.match(source, /\/api\/terminal\/ws-ticket/u);
  assert.doesNotMatch(source, /new EventSource/u);
  assert.match(source, /terminal\.onData/u);
  assert.match(source, /ResizeObserver/u);
  // 断线重连后以服务端快照回放自愈
  assert.match(source, /terminal\.reset\(\)/u);
  assert.match(source, /snapshot\.buffer/u);
  // 粘贴入口：快捷键接管 + 剪贴板读取
  assert.match(source, /attachCustomKeyEventHandler/u);
  assert.match(source, /navigator\.clipboard\.readText/u);
  assert.match(source, /terminal\.paste\(/u);
  assert.match(source, /hasSelection\(\)/u);
  // 右键菜单走 MenuService + CommandService
  assert.match(source, /TERMINAL_CONTEXT_MENU/u);
  assert.match(source, /getMenuService\(commandService\)\.registerMenuItems/u);
  assert.match(source, /WorkbenchContextMenu/u);
});
