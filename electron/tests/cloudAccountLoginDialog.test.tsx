import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import CloudAccountLoginDialog from '../src/components/CloudAccountLoginDialog';
import {
  cancelCloudAccountLoginDialog,
  getActiveCloudAccountLoginDialog,
  requestCloudAccountLogin,
  settleCloudAccountLoginDialog,
  subscribeCloudAccountLoginDialog,
  type CloudAccountLoginRequest
} from '../src/services/workbench/cloudAccountLoginService';

type Listener = (request: CloudAccountLoginRequest | null) => void;

function createRecorder() {
  const received: Array<CloudAccountLoginRequest | null> = [];
  const listener: Listener = request => received.push(request);
  return { received, listener };
}

test('cloud account login request publishes to subscribers and settles with session', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeCloudAccountLoginDialog(recorder.listener);

  const pending = requestCloudAccountLogin({ description: '启用「new_emoji 界面库」需要先登录 LingBuilder 账号。' });
  const request = recorder.received.at(-1);
  assert.match(request?.description || '', /启用「new_emoji 界面库」需要先登录/u);
  assert.equal(request?.title, undefined);

  settleCloudAccountLoginDialog({ authenticated: true, email: 'demo@lingbuilder.com' });
  const result = await pending;
  assert.equal(result.authenticated, true);
  assert.equal(result.email, 'demo@lingbuilder.com');
  assert.equal(recorder.received.at(-1), null);
  unsubscribe();
});

test('cancelling the login dialog resolves as cancelled without authentication', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeCloudAccountLoginDialog(recorder.listener);

  const pending = requestCloudAccountLogin();
  cancelCloudAccountLoginDialog();
  const result = await pending;
  assert.equal(result.authenticated, false);
  assert.equal(result.cancelled, true);
  assert.equal(getActiveCloudAccountLoginDialog(), null);
  unsubscribe();
});

test('a newer login request displaces the pending one as cancelled', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeCloudAccountLoginDialog(recorder.listener);

  const first = requestCloudAccountLogin({ description: '第一个模块' });
  const second = requestCloudAccountLogin({ description: '第二个模块' });
  const displaced = await first;
  assert.equal(displaced.authenticated, false);
  assert.equal(displaced.cancelled, true);
  assert.match(recorder.received.at(-1)?.description || '', /第二个模块/u);

  settleCloudAccountLoginDialog({ authenticated: true, email: 'demo@lingbuilder.com' });
  assert.equal((await second).authenticated, true);
  unsubscribe();
});

test('cancel and settle without a pending request are no-ops', async () => {
  cancelCloudAccountLoginDialog();
  settleCloudAccountLoginDialog({ authenticated: true, email: 'ghost@lingbuilder.com' });
  assert.equal(getActiveCloudAccountLoginDialog(), null);
});

test('login dialog renders accessible email/password form with both buttons', () => {
  const markup = renderToStaticMarkup(
    <CloudAccountLoginDialog
      open
      description="启用「new_emoji 界面库」需要先登录 LingBuilder 账号。"
      isDarkMode
      onResult={() => undefined}
    />
  );

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /登录 LingBuilder 账号/u);
  assert.match(markup, /启用「new_emoji 界面库」需要先登录/u);
  assert.match(markup, /type="email"/u);
  assert.match(markup, /type="password"/u);
  assert.match(markup, /账号邮箱/u);
  assert.match(markup, /注册新账号/u);
  assert.match(markup, /忘记密码？/u);
  assert.equal((markup.match(/<button/gu) || []).length, 4, '登录框应有注册新账号/忘记密码/取消/登录四个按钮');
});

test('register mode renders the same dialog and keeps the email when switching back to login', () => {
  const markup = renderToStaticMarkup(
    <CloudAccountLoginDialog open initialMode="register" isDarkMode onResult={() => undefined} />
  );
  assert.match(markup, /注册 LingBuilder 账号/u);
  assert.match(markup, /type="email"/u);
  assert.match(markup, /type="password"/u);
  assert.match(markup, /10 至 128 位/u);
  assert.match(markup, /返回登录/u);
  assert.doesNotMatch(markup, /忘记密码？/u, '注册形态不渲染忘记密码入口');
  assert.ok(!/可在 AI 助手面板/.test(markup), '注册入口已收进本对话框，不得再把用户推回 AI 面板');
});

test('account dialog service passes the register initial mode through', async () => {
  const recorder: Array<{ initialMode?: 'login' | 'register' | 'reset' } | null> = [];
  const unsubscribe = subscribeCloudAccountLoginDialog(request => recorder.push(request ? { initialMode: request.initialMode } : null));
  const pending = requestCloudAccountLogin({ initialMode: 'register' });
  assert.equal(recorder.at(-1)?.initialMode, 'register', '服务必须透传 register 形态');
  settleCloudAccountLoginDialog({ authenticated: false, cancelled: true });
  await pending;
  unsubscribe();
});

test('forgot password opens two-step reset flow inside the same dialog', async () => {
  const recorder: Array<{ initialMode?: 'login' | 'register' | 'reset' } | null> = [];
  const unsubscribe = subscribeCloudAccountLoginDialog(request => recorder.push(request ? { initialMode: request.initialMode } : null));
  const pending = requestCloudAccountLogin({ initialMode: 'reset' });
  assert.equal(recorder.at(-1)?.initialMode, 'reset', '服务必须透传 initialMode');
  settleCloudAccountLoginDialog({ authenticated: false, cancelled: true });
  await pending;
  unsubscribe();

  const stepOne = renderToStaticMarkup(
    <CloudAccountLoginDialog open initialMode="reset" isDarkMode onResult={() => undefined} />
  );
  assert.match(stepOne, /重置 LingBuilder 密码/u);
  assert.match(stepOne, /第 1 步 \/ 共 2 步/u);
  assert.match(stepOne, /发送重置邮件/u);
  assert.match(stepOne, /返回登录/u);
  assert.match(stepOne, /type="email"/u);
  assert.doesNotMatch(stepOne, /type="password"/u, '第 1 步只收集邮箱，不渲染密码输入');
});

test('closed login dialog does not leave a hidden interactive surface', () => {
  const markup = renderToStaticMarkup(
    <CloudAccountLoginDialog open={false} isDarkMode onResult={() => undefined} />
  );
  assert.equal(markup, '');
});
