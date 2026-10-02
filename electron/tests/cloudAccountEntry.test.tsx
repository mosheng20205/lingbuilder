import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  applyCloudAccountBalance,
  applyCloudAccountSignedIn,
  applyCloudAccountSignedOut,
  getCloudAccountSessionState,
  refreshCloudAccountSession,
  subscribeCloudAccountSession
} from '../src/services/workbench/cloudAccountSessionStore';

function readSource(relativePath: string): string {
  return fs.readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

test('账号会话状态源把登录、点数与退出变化广播给订阅者', () => {
  const seen: string[] = [];
  const unsubscribe = subscribeCloudAccountSession(() => {
    const state = getCloudAccountSessionState();
    seen.push(`${state.authenticated ? 'in' : 'out'}:${state.balance?.available ?? '-'}`);
  });

  applyCloudAccountSignedIn('demo@lingbuilder.com', { available: '120', reserved: '0' });
  applyCloudAccountBalance({ available: '90', reserved: '0' });
  applyCloudAccountSignedOut();
  unsubscribe();

  // 首次订阅会自动拉取一次会话（node 下无 IPC 直接落回未登录），因此首条是 out。
  assert.deepEqual(seen, ['out:-', 'in:120', 'in:90', 'out:-']);
  assert.equal(getCloudAccountSessionState().authenticated, false);
});

test('无桌面 IPC 时会话刷新落回未登录并给出中文提示', async () => {
  applyCloudAccountSignedIn('demo@lingbuilder.com', { available: '10', reserved: '0' });
  const state = await refreshCloudAccountSession();
  assert.equal(state.authenticated, false, '无 IPC 时不得保留伪登录态');
  assert.match(state.error || '', /LingBuilder 桌面版/u);
});

test('登录与注册入口常驻欢迎页、帮助菜单与设置页，AI 点数入口已全部退场', () => {
  const app = readSource('App.tsx');
  for (const commandId of ['login', 'register', 'resetPassword', 'logout']) {
    assert.ok(app.includes(`workbench.action.account.${commandId}`), `命令面板必须注册 workbench.action.account.${commandId}`);
  }
  assert.doesNotMatch(app, /workbench\.action\.account\.recharge/u, 'AI 编程助手已不需要点数，充值命令必须退场');
  assert.doesNotMatch(app, /充值/u, '工作台不得再出现充值入口');
  assert.match(app, /executeWorkbenchCommand\('workbench\.action\.account\.login'\)/u, '帮助菜单必须有登录入口');
  assert.match(app, /executeWorkbenchCommand\('workbench\.action\.account\.register'\)/u, '帮助菜单必须有注册入口');
  assert.match(app, /executeWorkbenchCommand\('workbench\.action\.account\.logout'\)/u, '帮助菜单必须有退出账号入口');
  // 账号对话框在欢迎页与工作台区都挂载，否则首屏入口点了没反应。
  assert.match(app, /\{cloudAccountDialogs\}\s*<UpdateDialog/u);

  const welcome = readSource('components/WelcomePage.tsx');
  assert.match(welcome, /登录账号/u);
  assert.match(welcome, /注册账号/u);
  assert.doesNotMatch(welcome, /充值|点数/u, '欢迎页不得再展示点数与充值');

  const settings = readSource('components/SettingsDialog.tsx');
  assert.match(settings, /'工作台', '账号', '更新'/u, '设置页必须有账号分类');
  assert.match(settings, /<AccountSettings /u);
  assert.doesNotMatch(settings, /充值|可用点数/u, '设置页不得再展示点数与充值');
});

test('充值链路已整体下线，登录实现只有一份且界面入口一律复用共享服务', () => {
  const workspaceRoot = new URL('../src/', import.meta.url);
  assert.equal(fs.existsSync(new URL('components/CloudAccountRechargeDialog.tsx', workspaceRoot)), false, '充值弹窗组件必须删除');
  assert.equal(fs.existsSync(new URL('components/CloudAccountTitleBarEntry.tsx', workspaceRoot)), false, '标题栏点数徽标组件必须删除');
  assert.equal(fs.existsSync(new URL('services/workbench/cloudAccountRechargeService.ts', workspaceRoot)), false, '充值对话框服务必须删除');
  assert.equal(fs.existsSync(new URL('components/AiAssistant.tsx', workspaceRoot)), false, 'AI 助手面板必须已删除（2026-10-02 退场），不得再自带登录表单');

  const loginDialog = readSource('components/CloudAccountLoginDialog.tsx');
  assert.match(loginDialog, /cloudAccount\.register/u, '注册必须由共享对话框实现');
  assert.match(loginDialog, /注册新账号/u);

  // 渲染层与主进程都不得再引用点数充值通道（云端 /v1/credits 接口保留不动）。
  for (const relativePath of ['App.tsx', 'electron-api.d.ts']) {
    assert.doesNotMatch(readSource(relativePath), /recharge|cloud-credits/iu, `${relativePath} 不得再引用充值通道`);
  }
  const preload = fs.readFileSync(new URL('../electron/preload.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(preload, /recharge|cloud-credits/iu, 'preload 不得再暴露充值 IPC');
  const main = fs.readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /cloud-credits/iu, '主进程不得再注册充值 IPC');
});
