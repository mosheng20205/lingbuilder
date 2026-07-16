import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  EnvironmentRepairBusyError,
  EnvironmentRepairService,
  type EnvironmentRepairSnapshot
} from '../src/services/tasks/environmentRepairService';

test('environment repair runs only the fixed C++ workload plan and reports completion', async () => {
  const calls: Array<{ executablePath: string; args: readonly string[] }> = [];
  let downloadedUrl = '';
  const service = new EnvironmentRepairService({
    platform: 'win32',
    temporaryRoot: 'C:\\Temp',
    now: sequenceClock(),
    download: async (url, _destination, onProgress) => {
      downloadedUrl = url;
      onProgress(70);
    },
    verify: async () => undefined,
    install: async (executablePath, args) => {
      calls.push({ executablePath, args });
      return { exitCode: 0 };
    }
  });

  const started = service.start('cppBuildTools');
  assert.equal(started.state, 'downloading');
  assert.throws(() => service.start('webView2'), EnvironmentRepairBusyError);
  const completed = await waitForCompletion(service);

  assert.equal(downloadedUrl, 'https://aka.ms/vs/17/release/vs_BuildTools.exe');
  assert.equal(path.win32.basename(calls[0].executablePath), 'vs_BuildTools.exe');
  assert.deepEqual(calls[0].args, [
    '--add',
    'Microsoft.VisualStudio.Workload.VCTools',
    '--includeRecommended',
    '--passive',
    '--wait',
    '--norestart'
  ]);
  assert.equal(completed.state, 'succeeded');
  assert.equal(completed.active, false);
});

test('environment repair reports WebView2 restart exit codes and installer failures', async () => {
  const service = new EnvironmentRepairService({
    platform: 'win32',
    download: async (_url, _destination, onProgress) => onProgress(null),
    verify: async () => undefined,
    install: async () => ({ exitCode: 3010 })
  });
  service.start('webView2');
  const completed = await waitForCompletion(service);
  assert.equal(completed.state, 'succeeded');
  assert.equal(completed.requiresRestart, true);
  assert.equal(completed.exitCode, 3010);

  const failing = new EnvironmentRepairService({
    platform: 'win32',
    download: async () => { throw new Error('网络不可用'); },
    verify: async () => undefined,
    install: async () => ({ exitCode: 0 })
  });
  failing.start('webView2');
  const failed = await waitForCompletion(failing);
  assert.equal(failed.state, 'failed');
  assert.match(failed.message, /网络不可用/u);
});

test('environment repair rejects unsupported platforms before creating a job', () => {
  const service = new EnvironmentRepairService({ platform: 'linux' });
  assert.throws(() => service.start('cppBuildTools'), /仅支持 Windows/u);
  assert.equal(service.status().state, 'idle');
});

async function waitForCompletion(service: EnvironmentRepairService): Promise<EnvironmentRepairSnapshot> {
  for (let index = 0; index < 100; index += 1) {
    const snapshot = service.status();
    if (!snapshot.active) return snapshot;
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error('等待环境修复测试任务完成超时。');
}

function sequenceClock(): () => Date {
  let index = 0;
  return () => new Date(Date.UTC(2026, 6, 16, 12, 0, index++));
}
