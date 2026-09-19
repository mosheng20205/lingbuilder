import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import CloudAccountTitleBarEntry from '../src/components/CloudAccountTitleBarEntry';
import {
  applyCloudAccountBalance,
  applyCloudAccountSignedIn,
  applyCloudAccountSignedOut,
  getCloudAccountSessionState,
  refreshCloudAccountSession,
  subscribeCloudAccountSession
} from '../src/services/workbench/cloudAccountSessionStore';
import {
  getActiveCloudAccountRechargeDialog,
  requestCloudAccountRecharge,
  settleCloudAccountRechargeDialog,
  subscribeCloudAccountRechargeDialog
} from '../src/services/workbench/cloudAccountRechargeService';

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

test('充值对话框服务只保留一个挂起请求，旧请求按取消结算', async () => {
  const received: Array<number | null> = [];
  const unsubscribe = subscribeCloudAccountRechargeDialog(request => received.push(request?.id ?? null));

  const first = requestCloudAccountRecharge();
  assert.equal(received.at(-1), getActiveCloudAccountRechargeDialog()?.id);
  const second = requestCloudAccountRecharge();
  assert.equal((await first).cancelled, true, '新请求必须把旧请求按取消结算');
  assert.notEqual(received[0], received.at(-1));

  settleCloudAccountRechargeDialog({ paid: true });
  assert.equal((await second).paid, true);
  assert.equal(getActiveCloudAccountRechargeDialog(), null);
  unsubscribe();
});

test('无挂起请求时结算充值对话框不产生副作用', () => {
  settleCloudAccountRechargeDialog({ paid: true });
  assert.equal(getActiveCloudAccountRechargeDialog(), null);
});

test('登录与注册入口常驻标题栏、欢迎页、帮助菜单与设置页', () => {
  const app = readSource('App.tsx');
  assert.match(app, /<CloudAccountTitleBarEntry isDarkMode=\{isDarkMode\} \/>/u, '标题栏必须常驻账号入口');
  for (const commandId of ['login', 'register', 'resetPassword', 'recharge', 'logout']) {
    assert.ok(app.includes(`workbench.action.account.${commandId}`), `命令面板必须注册 workbench.action.account.${commandId}`);
  }
  assert.match(app, /executeWorkbenchCommand\('workbench\.action\.account\.login'\)/u, '帮助菜单必须有登录入口');
  assert.match(app, /executeWorkbenchCommand\('workbench\.action\.account\.register'\)/u, '帮助菜单必须有注册入口');
  // 账号对话框在欢迎页与工作台区都挂载，否则首屏入口点了没反应。
  assert.match(app, /\{cloudAccountDialogs\}\s*<UpdateDialog/u);

  const welcome = readSource('components/WelcomePage.tsx');
  assert.match(welcome, /登录账号/u);
  assert.match(welcome, /注册账号/u);

  const settings = readSource('components/SettingsDialog.tsx');
  assert.match(settings, /'工作台', '账号', '更新'/u, '设置页必须有账号分类');
  assert.match(settings, /<AccountSettings /u);
});

test('登录表单与充值实现各只有一份，界面入口一律复用共享服务', () => {
  const aiAssistant = readSource('components/AiAssistant.tsx');
  assert.doesNotMatch(aiAssistant, /system-ai-email/u, 'AI 面板不得再自带一份登录表单');
  assert.doesNotMatch(aiAssistant, /createRechargeOrder/u, '充值下单只能有一份实现');
  assert.doesNotMatch(aiAssistant, /rechargePackages/u, '充值套餐加载不得在面板内重复实现');

  const loginDialog = readSource('components/CloudAccountLoginDialog.tsx');
  assert.match(loginDialog, /cloudAccount\.register/u, '注册必须由共享对话框实现');
  assert.match(loginDialog, /注册新账号/u);

  const rechargeDialog = readSource('components/CloudAccountRechargeDialog.tsx');
  assert.match(rechargeDialog, /createRechargeOrder/u);
  assert.match(rechargeDialog, /applyCloudAccountBalance/u, '到账后必须写回共享会话');
});

test('标题栏账号徽标按会话状态显示登录入口或点数', () => {
  // 组件只在 Electron 渲染进程挂载，node 下需要临时提供 window.lingBuilder.cloudAccount 桩。
  const globalScope = globalThis as { window?: unknown };
  globalScope.window = { lingBuilder: { cloudAccount: {} } };
  try {
    applyCloudAccountSignedOut();
    const signedOut = renderToStaticMarkup(<CloudAccountTitleBarEntry isDarkMode />);
    assert.match(signedOut, /登录 LingBuilder 账号/u);
    assert.match(signedOut, />登录</u);

    applyCloudAccountSignedIn('demo@lingbuilder.com', { available: '1250', reserved: '0' });
    const signedIn = renderToStaticMarkup(<CloudAccountTitleBarEntry isDarkMode />);
    assert.match(signedIn, /已登录 demo@lingbuilder\.com/u);
    assert.match(signedIn, /1,250/u, '点数必须千分位显示');
    assert.doesNotMatch(signedIn, /demo@lingbuilder\.com<\/span>/u, '徽标本体不显示邮箱，邮箱只在展开菜单里');
  } finally {
    delete globalScope.window;
    applyCloudAccountSignedOut();
  }
});
