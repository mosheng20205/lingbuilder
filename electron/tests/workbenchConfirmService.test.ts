import test from 'node:test';
import assert from 'node:assert/strict';

import {
  requestWorkbenchConfirm,
  requestWorkbenchAlert,
  requestWorkbenchPrompt,
  subscribeWorkbenchDialog,
  settleWorkbenchDialog,
  cancelWorkbenchDialog,
  type WorkbenchDialogRequest
} from '../src/services/workbench/workbenchConfirmService';

type Listener = (request: WorkbenchDialogRequest | null) => void;

function createRecorder() {
  const received: Array<WorkbenchDialogRequest | null> = [];
  const listener: Listener = request => received.push(request);
  return { received, listener };
}

test('confirm request publishes to subscribers and settles true', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const pending = requestWorkbenchConfirm({ title: '确认操作', description: '描述', confirmLabel: '继续', cancelLabel: '停止' });
  const request = recorder.received.at(-1);
  assert.equal(request?.kind, 'confirm');
  assert.equal(request?.title, '确认操作');
  assert.equal(request?.confirmLabel, '继续');
  assert.equal(request?.cancelLabel, '停止');

  settleWorkbenchDialog(true);
  assert.equal(await pending, true);
  assert.equal(recorder.received.at(-1), null);
  unsubscribe();
});

test('confirm settle false resolves false', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const pending = requestWorkbenchConfirm({ title: '取消场景' });
  settleWorkbenchDialog(false);
  assert.equal(await pending, false);
  unsubscribe();
});

test('alert request exposes kind alert and resolves without value', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const pending = requestWorkbenchAlert({ title: '提示', description: '内容', confirmLabel: '知道了' });
  const request = recorder.received.at(-1);
  assert.equal(request?.kind, 'alert');
  assert.equal(request?.confirmLabel, '知道了');

  settleWorkbenchDialog(true);
  assert.equal(await pending, undefined);
  unsubscribe();
});

test('prompt request carries input options and resolves entered text or null', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const pendingText = requestWorkbenchPrompt({ title: '输入名称', inputValue: '默认值', inputPlaceholder: '请输入' });
  const request = recorder.received.at(-1);
  assert.equal(request?.kind, 'prompt');
  assert.equal(request?.inputValue, '默认值');
  assert.equal(request?.inputPlaceholder, '请输入');
  settleWorkbenchDialog('新名称');
  assert.equal(await pendingText, '新名称');

  const pendingCancel = requestWorkbenchPrompt({ title: '再次输入' });
  settleWorkbenchDialog(null);
  assert.equal(await pendingCancel, null);
  unsubscribe();
});

test('a newer request displaces the pending one as cancelled', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const first = requestWorkbenchConfirm({ title: '第一个' });
  const second = requestWorkbenchPrompt({ title: '第二个' });

  assert.equal(await first, false, '被顶掉的 confirm 应按取消结算');
  assert.equal(recorder.received.at(-1)?.title, '第二个');

  settleWorkbenchDialog(null);
  assert.equal(await second, null);
  unsubscribe();
});

test('cancelWorkbenchDialog settles the pending request as cancelled and notifies null', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  const pendingConfirm = requestWorkbenchConfirm({ title: '待取消' });
  cancelWorkbenchDialog();
  assert.equal(await pendingConfirm, false);
  assert.equal(recorder.received.at(-1), null);

  const pendingPrompt = requestWorkbenchPrompt({ title: '待取消输入' });
  cancelWorkbenchDialog();
  assert.equal(await pendingPrompt, null);

  const pendingAlert = requestWorkbenchAlert({ title: '待取消提示' });
  cancelWorkbenchDialog();
  await pendingAlert;
  assert.equal(recorder.received.at(-1), null);
  unsubscribe();
});

test('cancel without a pending request is a no-op and unsubscribe stops notifications', async () => {
  cancelWorkbenchDialog();

  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);
  unsubscribe();

  const pending = requestWorkbenchConfirm({ title: '无订阅者' });
  assert.equal(recorder.received.length, 0);
  settleWorkbenchDialog(true);
  assert.equal(await pending, true);
});

test('each request gets a unique increasing id', async () => {
  const recorder = createRecorder();
  const unsubscribe = subscribeWorkbenchDialog(recorder.listener);

  requestWorkbenchConfirm({ title: 'A' });
  const firstId = recorder.received.at(-1)?.id;
  requestWorkbenchConfirm({ title: 'B' });
  const secondId = recorder.received.at(-1)?.id;
  assert.notEqual(firstId, secondId);
  assert.equal(typeof firstId, 'number');

  cancelWorkbenchDialog();
  unsubscribe();
});
