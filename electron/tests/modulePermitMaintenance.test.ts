import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ModulePermitMaintenanceService,
  MODULE_PERMIT_BACKOFF_INITIAL_MS,
  MODULE_PERMIT_BACKOFF_MAX_MS,
  MODULE_PERMIT_RENEW_THRESHOLD_MS,
  MODULE_PERMIT_SWEEP_INTERVAL_MS
} from '../electron/modulePermitMaintenanceService';
import type { CachedModuleAuthorization } from '../electron/modulePermitRestoreService';

const HOUR_MS = 60 * 60_000;

function permit(moduleId: string, expiresAtMsFromNow: number, source = 'free_window'): CachedModuleAuthorization {
  return { permit: { payload: { moduleId, source, expiresAt: new Date(Date.now() + expiresAtMsFromNow).toISOString() } } };
}

interface MaintenanceOverrides {
  readCache?: () => Promise<CachedModuleAuthorization[]>;
  writeCache?: (values: CachedModuleAuthorization[]) => Promise<void>;
  requestRendererApi?: (apiPath: string, init: RequestInit) => Promise<unknown>;
  isAuthenticated?: () => boolean | Promise<boolean>;
  refreshAuthorization?: (moduleId: string) => Promise<CachedModuleAuthorization>;
  onSweep?: (result: unknown) => void;
  log?: (level: 'info' | 'warn', message: string) => void;
  intervalMs?: number;
  renewThresholdMs?: number;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
}

function service(overrides: MaintenanceOverrides = {}): ModulePermitMaintenanceService {
  return new ModulePermitMaintenanceService({
    readCache: overrides.readCache ?? (async () => []),
    writeCache: overrides.writeCache ?? (async () => undefined),
    requestRendererApi: overrides.requestRendererApi ?? (async () => ({ ok: true })),
    isAuthenticated: overrides.isAuthenticated ?? (async () => true),
    refreshAuthorization: overrides.refreshAuthorization ?? (async moduleId => permit(moduleId, 72 * HOUR_MS)),
    onSweep: overrides.onSweep,
    log: overrides.log,
    intervalMs: overrides.intervalMs,
    renewThresholdMs: overrides.renewThresholdMs,
    backoffInitialMs: overrides.backoffInitialMs,
    backoffMaxMs: overrides.backoffMaxMs
  });
}

test('默认参数满足验收口径：30 分钟巡检、12 小时临期阈值、退避 1 分钟起步上限 2 小时', () => {
  assert.equal(MODULE_PERMIT_SWEEP_INTERVAL_MS, 30 * 60_000);
  assert.equal(MODULE_PERMIT_RENEW_THRESHOLD_MS, 12 * HOUR_MS);
  assert.equal(MODULE_PERMIT_BACKOFF_INITIAL_MS, 60_000);
  assert.equal(MODULE_PERMIT_BACKOFF_MAX_MS, 2 * HOUR_MS);
});

test('剩余有效期低于 12 小时即触发换发（临期预续期，静默不提示）', async () => {
  const cached = [permit('lingbuilder.new_emoji.ui', 11 * HOUR_MS)];
  let refreshCalls = 0;
  const written: CachedModuleAuthorization[] = [];
  const instance = service({
    readCache: async () => cached,
    writeCache: async values => { written.push(...values); },
    refreshAuthorization: async moduleId => { refreshCalls += 1; return permit(moduleId, 72 * HOUR_MS); }
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.ran, true);
  assert.equal(result.checkedCount, 1);
  assert.equal(refreshCalls, 1);
  assert.equal(result.renewed.length, 1);
  assert.equal(result.renewed[0]?.restored, false);
  assert.equal(result.renewed[0]?.proactive, true);
  assert.equal(result.renewed[0]?.message, '');
  assert.equal(written.length, 1);
});

test('剩余有效期仍高于阈值时不换发', async () => {
  let refreshCalls = 0;
  const instance = service({
    readCache: async () => [permit('lingbuilder.new_emoji.ui', 13 * HOUR_MS)],
    refreshAuthorization: async moduleId => { refreshCalls += 1; return permit(moduleId, 72 * HOUR_MS); }
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.ran, true);
  assert.equal(result.checkedCount, 0);
  assert.equal(refreshCalls, 0);
  assert.equal(result.renewed.length, 0);
});

test('过期 Permit 自动换发：翻转 restored、写缓存、同步渲染层并产出中文提示', async () => {
  const cached = [permit('lingbuilder.new_emoji.ui', -30 * 60_000)];
  const syncBodies: string[] = [];
  const written: CachedModuleAuthorization[] = [];
  const sweeps: unknown[] = [];
  const instance = service({
    readCache: async () => cached,
    writeCache: async values => { written.push(...values); },
    requestRendererApi: async (apiPath, init) => {
      if (apiPath === '/api/module-access/sync') syncBodies.push(String(init.body));
      return { ok: true };
    },
    refreshAuthorization: async moduleId => permit(moduleId, 72 * HOUR_MS),
    onSweep: result => sweeps.push(result)
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.renewed.length, 1);
  const outcome = result.renewed[0]!;
  assert.equal(outcome.restored, true);
  assert.equal(outcome.proactive, false);
  assert.match(outcome.message, /已自动续期/u);
  assert.match(outcome.message, /有效期至/u);
  assert.match(outcome.message, /限时免费授权/u);
  assert.equal(syncBodies.length, 1);
  assert.match(syncBodies[0] || '', /lingbuilder\.new_emoji\.ui/u);
  assert.equal(written.length, 1);
  assert.match(String((written[0] as { permit?: { payload?: { expiresAt?: string } } })?.permit?.payload?.expiresAt || ''), /^\d{4}-/u);
  assert.equal(sweeps.length, 1);
});

test('未登录时跳过巡检且不调用换发', async () => {
  let refreshCalls = 0;
  let readCalls = 0;
  const instance = service({
    isAuthenticated: async () => false,
    readCache: async () => { readCalls += 1; return [permit('lingbuilder.new_emoji.ui', -HOUR_MS)]; },
    refreshAuthorization: async moduleId => { refreshCalls += 1; return permit(moduleId, 72 * HOUR_MS); }
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.ran, false);
  assert.match(result.skippedReason || '', /未登录/u);
  assert.equal(readCalls, 0);
  assert.equal(refreshCalls, 0);
});

test('本地无缓存授权时跳过巡检', async () => {
  const instance = service({});
  const result = await instance.triggerSweep('测试');
  assert.equal(result.ran, false);
  assert.match(result.skippedReason || '', /没有缓存的模块授权/u);
});

test('换发失败静默退避：指数翻倍、封顶 2 小时（可注入缩短），成功后复位', async () => {
  let fail = true;
  const logs: string[] = [];
  const instance = service({
    readCache: async () => [permit('lingbuilder.new_emoji.ui', -HOUR_MS)],
    refreshAuthorization: async moduleId => {
      if (fail) throw new Error('网络不可用');
      return permit(moduleId, 72 * HOUR_MS);
    },
    backoffInitialMs: 1_000,
    backoffMaxMs: 8_000,
    log: (level, message) => logs.push(`${level}:${message}`)
  });
  await instance.triggerSweep('第一次失败');
  assert.equal(instance.nextRetryDelayMs(), 1_000);
  await instance.triggerSweep('第二次失败');
  assert.equal(instance.nextRetryDelayMs(), 2_000);
  await instance.triggerSweep('第三次失败');
  await instance.triggerSweep('第四次失败');
  assert.equal(instance.nextRetryDelayMs(), 8_000);
  await instance.triggerSweep('继续失败');
  assert.equal(instance.nextRetryDelayMs(), 8_000, '退避必须封顶，不得无限翻倍');
  assert.ok(logs.some(message => message.includes('授权自动续期失败')));
  fail = false;
  await instance.triggerSweep('恢复成功');
  assert.equal(instance.nextRetryDelayMs(), undefined, '换发成功后应清除退避定时器');
  fail = true;
  await instance.triggerSweep('再次失败');
  assert.equal(instance.nextRetryDelayMs(), 1_000, '成功后退避计数应复位');
});

test('退避定时器到点自动静默重试，成功后回到常规巡检', async () => {
  let calls = 0;
  const instance = service({
    readCache: async () => [permit('lingbuilder.new_emoji.ui', -HOUR_MS)],
    refreshAuthorization: async moduleId => {
      calls += 1;
      if (calls < 3) throw new Error('云端 5xx');
      return permit(moduleId, 72 * HOUR_MS);
    },
    backoffInitialMs: 20,
    backoffMaxMs: 200
  });
  await instance.triggerSweep('首轮');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.ok(calls >= 3, `退避重试应自动发生，实际换发调用 ${calls} 次`);
  assert.equal(instance.nextRetryDelayMs(), undefined);
  instance.stop();
});

test('start 启动周期巡检，stop（登出）后不再触发', async () => {
  let sweepCount = 0;
  const instance = service({
    readCache: async () => { sweepCount += 1; return [permit('lingbuilder.new_emoji.ui', -HOUR_MS)]; },
    refreshAuthorization: async moduleId => permit(moduleId, 72 * HOUR_MS),
    intervalMs: 10
  });
  instance.start();
  await new Promise(resolve => setTimeout(resolve, 80));
  const countAtStop = sweepCount;
  assert.ok(countAtStop >= 1, '周期巡检应在启动后触发');
  instance.stop();
  assert.equal(instance.isRunning(), false);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(sweepCount, countAtStop, '登出停止定时器后不得继续巡检');
});

test('同一时刻只有一轮巡检在执行（在途保护）', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let refreshCalls = 0;
  const instance = service({
    readCache: async () => [permit('lingbuilder.new_emoji.ui', -HOUR_MS)],
    refreshAuthorization: async moduleId => {
      refreshCalls += 1;
      await gate;
      return permit(moduleId, 72 * HOUR_MS);
    }
  });
  const first = instance.triggerSweep('首轮');
  const second = await instance.triggerSweep('并发');
  assert.equal(second.ran, false);
  assert.match(second.skippedReason || '', /在执行/u);
  release?.();
  const firstResult = await first;
  assert.equal(firstResult.ran, true);
  assert.equal(refreshCalls, 1);
});

test('readCache 等基础设施异常时安全降级为日志，绝不抛错', async () => {
  const logs: string[] = [];
  const instance = service({
    readCache: async () => { throw new Error('缓存读取失败'); },
    log: (level, message) => logs.push(`${level}:${message}`)
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.ran, false);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0] || '', /巡检失败/u);
  assert.ok(logs.some(message => message.includes('缓存读取失败')));
});

test('新授权同步到本地服务失败不阻断续期：缓存仍更新，轮次仍算成功', async () => {
  const written: CachedModuleAuthorization[] = [];
  const logs: string[] = [];
  const instance = service({
    readCache: async () => [permit('lingbuilder.new_emoji.ui', -HOUR_MS)],
    writeCache: async values => { written.push(...values); },
    requestRendererApi: async () => { throw new Error('渲染层未就绪'); },
    refreshAuthorization: async moduleId => permit(moduleId, 72 * HOUR_MS),
    log: (level, message) => logs.push(`${level}:${message}`)
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.renewed.length, 1);
  assert.equal(result.failures.length, 0);
  assert.equal(written.length, 1);
  assert.ok(logs.some(message => message.includes('同步到本地服务失败')));
});

test('同批过期与临期 Permit：只有过期那张标记 restored（主进程仅对翻转重启 Bridge）', async () => {
  const cached = [
    permit('lingbuilder.new_emoji.ui', -HOUR_MS),
    permit('lingbuilder.fbro.browser', 5 * HOUR_MS, 'purchase')
  ];
  const instance = service({
    readCache: async () => cached,
    refreshAuthorization: async moduleId => permit(moduleId, 72 * HOUR_MS, 'purchase')
  });
  const result = await instance.triggerSweep('测试');
  assert.equal(result.renewed.length, 2);
  assert.equal(result.renewed.filter(item => item.restored).length, 1);
  assert.equal(result.renewed.find(item => item.restored)?.moduleId, 'lingbuilder.new_emoji.ui');
  assert.equal(result.renewed.find(item => item.proactive)?.moduleId, 'lingbuilder.fbro.browser');
});
