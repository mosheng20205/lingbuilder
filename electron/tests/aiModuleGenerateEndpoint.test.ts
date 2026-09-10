import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveServerRuntimeConfig, SERVER_READY_PREFIX } from '../src/services/server/serverRuntime';

interface ReadyInfo { origin: string; host: string; port: number }

async function startTestServer(options: { specPath?: string; apiKey?: string; workspaceRoot: string }): Promise<{ origin: string; stop: () => Promise<void> }> {
  const staticRoot = path.join(options.workspaceRoot, 'static');
  const rulebookPath = path.join(options.workspaceRoot, 'rulebook.md');
  await fs.mkdir(staticRoot, { recursive: true });
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>LingBuilder Test</title>', 'utf8');
  await fs.writeFile(rulebookPath, '# test rulebook\n', 'utf8');
  const child = spawn(process.execPath, ['--import', 'tsx', path.resolve(process.cwd(), 'server.ts')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      LINGBUILDER_WORKSPACE_ROOT: options.workspaceRoot,
      STATIC_ROOT: staticRoot,
      RULEBOOK_PATH: rulebookPath,
      ...(options.specPath ? { LINGBUILDER_AI_MODULE_SPEC_PATH: options.specPath } : {}),
      LINGBUILDER_USER_SETTINGS_PATH: path.join(options.workspaceRoot, 'profile', 'settings.json'),
      SESSION_TOKEN: 'ai-module-generate-test',
      // 测试进程内清除 BYOK 凭据，保证“未配置 Key”的错误分支可稳定复现。
      GEMINI_API_KEY: options.apiKey || '',
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false'
    } as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr?.on('data', chunk => { stderr += String(chunk); });
  const ready = await new Promise<ReadyInfo>((resolve, reject) => {
    const offAll = () => {
      clearTimeout(timeout);
      child.stdout?.off('data', onData);
      child.off('exit', onExit);
    };
    const timeout = setTimeout(() => {
      offAll();
      reject(new Error(`等待服务就绪超时：\n${stderr}`));
    }, 30_000);
    const onData = (chunk: Buffer) => {
      for (const line of String(chunk).split(/\r?\n/u)) {
        if (!line.startsWith(SERVER_READY_PREFIX)) continue;
        try {
          const value = JSON.parse(line.slice(SERVER_READY_PREFIX.length)) as ReadyInfo;
          offAll();
          resolve(value);
          return;
        } catch { /* 忽略无法解析的行 */ }
      }
    };
    const onExit = (code: number | null) => {
      offAll();
      reject(new Error(`服务在就绪前退出（${code}）：\n${stderr}`));
    };
    child.stdout?.on('data', onData);
    child.once('exit', onExit);
  });
  return {
    origin: ready.origin,
    stop: async () => {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
  };
}

test('AI 模块生成端点拒绝缺失需求并要求配置 API Key', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-generate-'));
  const server = await startTestServer({ workspaceRoot });
  try {
    const headers = { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-module-generate-test' };
    const missing = await fetch(`${server.origin}/api/modules/ai-generate`, { method: 'POST', headers, body: JSON.stringify({ requirement: '   ' }) });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /需求/u);
    const noKey = await fetch(`${server.origin}/api/modules/ai-generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requirement: '做一个字符串工具模块' })
    });
    assert.equal(noKey.status, 400);
    assert.match((await noKey.json()).error, /API Key/u);
  } finally {
    await server.stop();
  }
});

test('AI 模块生成端点支持通过环境变量指定规范文档路径', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-generate-spec-'));
  const server = await startTestServer({ workspaceRoot, specPath: path.join(workspaceRoot, 'missing-spec.md'), apiKey: 'spec-path-test-key' });
  try {
    const headers = { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-module-generate-test' };
    const response = await fetch(`${server.origin}/api/modules/ai-generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requirement: '做一个字符串工具模块' })
    });
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /模块开发规范/u);
  } finally {
    await server.stop();
  }
});

test('服务运行时配置在规范路径缺省时从规则手册目录推导', () => {
  const config = resolveServerRuntimeConfig({
    NODE_ENV: 'development',
    LINGBUILDER_WORKSPACE_ROOT: process.cwd(),
    LINGBUILDER_RULEBOOK_PATH: path.join(process.cwd(), 'rulebook.md'),
    LINGBUILDER_DEV_NO_AUTH: 'true'
  } as NodeJS.ProcessEnv);
  assert.equal(config.aiModuleSpecPath, path.join(process.cwd(), 'docs', 'AI模块开发规范.md'));
});
