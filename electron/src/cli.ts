#!/usr/bin/env node
import crypto from 'crypto';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'http';
import os from 'node:os';
import path from 'path';
import { AiBridgeService } from './services/aiBridge/aiBridgeService';
import { createAiBridgeRouter } from './services/aiBridge/httpRoutes';
import { startAiBridgeMcpServer } from './services/aiBridge/mcpServer';
import { AiBridgePermissionMode, AiBridgeServerOptions } from './services/aiBridge/types';
import { CloudCliClient } from './services/cloud/cloudCliClient';
import { createModuleService } from './services/modules/moduleService';
import {
  createMarketIndex,
  createModuleTemplate,
  migrateCppModule,
  validateModuleDirectory
} from './services/modules/moduleSdkService';

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (command === '--version' || command === 'version') { console.log('LingBuilder CLI 0.2.0'); return; }
  if (command === '--help' || command === 'help' || !command) { printUsage(); return; }
  if (command === 'doctor') { await runDoctor(rest); return; }
  if (command === 'auth') { await runAuthCommand(subcommand, rest); return; }
  if (command === 'ai') { await runAiCommand(subcommand, rest); return; }
  if (command === 'workspace' && subcommand === 'inspect') { await runWorkspaceInspect(rest); return; }
  if (command === 'project') { await runProjectCommand(subcommand, rest); return; }
  if (command === 'module') {
    await runModuleCommand(subcommand, rest);
    return;
  }
  if (command !== 'ai-server' && subcommand !== 'ai-server') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(command === 'ai-server' ? [subcommand, ...rest] : rest);
  const workspaceRoot = path.resolve(getStringArg(args.workspace) || process.cwd());
  const host = getStringArg(args.host) || '127.0.0.1';
  const port = Number.parseInt(getStringArg(args.port) || '17860', 10);
  const permission = parsePermission(getStringArg(args.permission) || 'preview');
  const allowRemote = false;
  const enableMcp = args.mcp === 'true' || args.mcp === true;

  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error('AI Bridge 只允许监听 127.0.0.1、localhost 或 ::1；远程 AI 请使用 LingBuilder 云端 API。');
  }

  const token = getStringArg(args.token) || crypto.randomBytes(24).toString('hex');
  const options: AiBridgeServerOptions = {
    workspaceRoot,
    host,
    port,
    token,
    permission,
    allowRemote,
    enableMcp
  };

  const service = new AiBridgeService(options);
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api/ai-bridge', createAiBridgeRouter(service, token));
  const server = http.createServer(app);

  await new Promise<void>(resolve => {
    server.listen(port, host, resolve);
  });

  const log = enableMcp ? console.error : console.log;
  installAiBridgeShutdownHandlers(server, service, log);
  log(`LingBuilder AI Bridge listening on http://${host}:${port}/api/ai-bridge`);
  log(`Workspace: ${workspaceRoot}`);
  log(`Permission: ${permission}`);
  log(`Token: ${token}`);

  if (enableMcp) {
    startAiBridgeMcpServer(service);
  }
}

async function runAuthCommand(subcommand: string | undefined, rest: string[]) {
  const client = new CloudCliClient(getStringArg(parseArgs(rest).server));
  if (subcommand === 'login') { const result = await client.login(console.log); console.log(result.message); return; }
  if (subcommand === 'logout') { await client.logout(); console.log('已退出 LingBuilder 系统 AI。'); return; }
  if (subcommand === 'status') { printValue(await client.status(), parseArgs(rest).json === true); return; }
  throw new Error('auth 子命令仅支持 login、logout、status。');
}

async function runAiCommand(subcommand: string | undefined, rest: string[]) {
  const args = parseArgs(rest); const client = new CloudCliClient(getStringArg(args.server)); const asJson = args.json === true;
  if (subcommand === 'models') { printValue(await client.models(), asJson); return; }
  if (subcommand === 'balance') { printValue(await client.balance(), asJson); return; }
  if (subcommand === 'chat') {
    const model = getStringArg(args.model); const prompt = getStringArg(args.prompt) || rest.filter(item => !item.startsWith('--') && item !== model).join(' ');
    if (!model || !prompt) throw new Error('ai chat 需要 --model <别名> 和 --prompt <问题>。');
    for await (const event of client.chat(model, prompt)) { if (asJson) console.log(JSON.stringify(event)); else if (event.type === 'delta') process.stdout.write(event.text); else if (event.type === 'usage') console.log(`\n用量：输入 ${event.receipt.inputTokens}，输出 ${event.receipt.outputTokens}，扣除 ${event.receipt.chargedPoints} 点`); else if (event.type === 'error') throw new Error(event.message); }
    return;
  }
  throw new Error('ai 子命令仅支持 models、balance、chat。');
}

async function runDoctor(rest: string[]) {
  const args = parseArgs(rest); const checks = [
    { id: 'node', ok: Number(process.versions.node.split('.')[0]) >= 20, detail: `Node ${process.versions.node}` },
    { id: 'platform', ok: process.platform === 'win32', detail: `${process.platform}/${process.arch}` },
    { id: 'workspace', ok: await pathExists(path.resolve(getStringArg(args.workspace) || process.cwd())), detail: path.resolve(getStringArg(args.workspace) || process.cwd()) }
  ];
  printValue({ ok: checks.every(item => item.ok), checks }, args.json === true);
}

async function runWorkspaceInspect(rest: string[]) {
  const args = parseArgs(rest); const workspaceRoot = path.resolve(getStringArg(args.workspace) || process.cwd());
  const service = new AiBridgeService({ workspaceRoot, host: '127.0.0.1', port: 0, token: 'local-cli-inspect', permission: 'readonly', allowRemote: false, enableMcp: false });
  printValue({ ok: true, workspaceRoot, tree: await service.listWorkspaceTree() }, args.json === true);
}

async function runProjectCommand(subcommand: string | undefined, rest: string[]) {
  const args = parseArgs(rest); const workspaceRoot = path.resolve(getStringArg(args.workspace) || process.cwd()); const requestFile = getStringArg(args.request);
  if (!requestFile) throw new Error('project 命令需要 --request <受控项目请求.json>。');
  const request = JSON.parse(await fs.readFile(path.resolve(requestFile), 'utf8')); const approved = args.yes === true;
  const service = new AiBridgeService({ workspaceRoot, host: '127.0.0.1', port: 0, token: 'local-project-cli', permission: approved ? 'yolo' : 'preview', allowRemote: false, enableMcp: false });
  try {
    if (subcommand === 'diagnose') { printValue(await service.getLingCppDiagnostics(request), args.json === true); return; }
    if (subcommand === 'export') { if (!approved) { printValue(await service.nativePreview(request), args.json === true); return; } printValue(await service.nativeExport({ ...request, approved: true }), args.json === true); return; }
    if (subcommand === 'build' || subcommand === 'run') { if (!approved) throw new Error('构建和运行必须显式传入 --yes；可先使用 project export 预览。'); printValue(await service.buildRun({ ...request, run: subcommand === 'run', approved: true }), args.json === true); return; }
    if (subcommand === 'stop') { printValue(await service.stopRuns(), args.json === true); return; }
    throw new Error('project 子命令仅支持 diagnose、export、build、run、stop。');
  } finally { await service.shutdown(); }
}

function printValue(value: unknown, json: boolean) { if (json) console.log(JSON.stringify(value, bigintReplacer, 2)); else console.log(formatHuman(value)); }
function bigintReplacer(_key: string, value: unknown) { return typeof value === 'bigint' ? value.toString() : value; }
function formatHuman(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value, bigintReplacer, 2); }

function installAiBridgeShutdownHandlers(
  server: http.Server,
  service: AiBridgeService,
  log: (...values: unknown[]) => void
): void {
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (signal: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigterm);
      log(`收到 ${signal}，正在停止 AI Bridge 及其受控运行进程…`);
      try {
        await closeHttpServer(server);
      } catch (error) {
        console.error(`AI Bridge HTTP 服务关闭失败：${error instanceof Error ? error.message : String(error)}`);
      }
      try {
        const result = await service.shutdown();
        log(result.message);
      } catch (error) {
        console.error(`AI Bridge 受控进程清理失败：${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return shutdownPromise;
  };

  const requestShutdown = (signal: 'SIGINT' | 'SIGTERM', exitCode: number) => {
    void shutdown(signal).finally(() => process.exit(exitCode));
  };
  const handleSigint = () => requestShutdown('SIGINT', 130);
  const handleSigterm = () => requestShutdown('SIGTERM', 143);

  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
}

async function closeHttpServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function runModuleCommand(subcommand: string | undefined, rest: string[]): Promise<void> {
  const args = parseArgs(rest);
  if (subcommand === 'init') {
    const outDir = path.resolve(getStringArg(args.out) || process.cwd());
    const manifest = await createModuleTemplate({
      template: getStringArg(args.template) || 'cpp-source',
      outDir,
      id: getStringArg(args.id),
      name: getStringArg(args.name)
    });
    console.log(`已创建模块模板：${manifest.name} (${manifest.id})`);
    console.log(outDir);
    return;
  }

  if (subcommand === 'validate') {
    const target = path.resolve(getStringArg(args.path) || rest.find(item => !item.startsWith('--')) || process.cwd());
    if (isModulePackagePath(target)) {
      const preview = await previewPackageForCli(target);
      console.log(preview.diagnostics.length ? preview.diagnostics.join('\n') : '模块包校验通过。');
      if (!preview.canInstall) process.exitCode = 1;
      return;
    }
    const result = await validateModuleDirectory(target);
    console.log(result.diagnostics.length ? result.diagnostics.join('\n') : '模块校验通过。');
    if (result.diagnostics.length > 0) process.exitCode = 1;
    return;
  }

  if (subcommand === 'inspect') {
    const target = path.resolve(getStringArg(args.path) || rest.find(item => !item.startsWith('--')) || process.cwd());
    if (isModulePackagePath(target)) {
      const preview = await previewPackageForCli(target);
      if (!preview.manifest || !preview.canInstall) {
        throw new Error(preview.diagnostics.join('\n') || '模块包检查未通过。');
      }
      console.log(JSON.stringify({
        id: preview.manifest.id,
        name: preview.manifest.name,
        version: preview.manifest.version,
        fileCount: preview.fileCount,
        totalBytes: preview.totalBytes,
        sha256: preview.sha256,
        targets: preview.manifest.targets || [],
        bindings: preview.manifest.bindings || { commands: [] }
      }, null, 2));
      return;
    }
    const result = await validateModuleDirectory(target);
    if (!result.manifest) throw new Error(result.diagnostics.join('\n'));
    console.log(JSON.stringify({
      id: result.manifest.id,
      name: result.manifest.name,
      version: result.manifest.version,
      targets: result.manifest.targets || [],
      bindings: result.manifest.bindings || { commands: [] }
    }, null, 2));
    return;
  }

  if (subcommand === 'pack') {
    const moduleDir = path.resolve(getStringArg(args.path) || rest.find(item => !item.startsWith('--')) || process.cwd());
    const out = path.resolve(getStringArg(args.out) || `${moduleDir}.lbmod`);
    await createModuleService(process.cwd()).exportModulePackage(moduleDir, out);
    console.log(`已导出模块包：${out}`);
    return;
  }

  if (subcommand === 'migrate-cpp') {
    const config = getStringArg(args.config);
    const outDir = getStringArg(args.out);
    if (!config || !outDir) throw new Error('migrate-cpp 需要 --config <file> 和 --out <dir>。');
    const manifest = await migrateCppModule(path.resolve(config), path.resolve(outDir));
    console.log(`已生成 C++ 迁移模块：${manifest.name} (${manifest.id})`);
    return;
  }

  if (subcommand === 'market' && rest[0] === 'index') {
    const packageDir = path.resolve(getStringArg(args.packages) || process.cwd());
    const out = path.resolve(getStringArg(args.out) || 'module-market.json');
    const fs = await import('node:fs/promises');
    const entries = await fs.readdir(packageDir);
    await createMarketIndex(entries.filter(item => item.toLowerCase().endsWith('.lbmod')).map(item => path.join(packageDir, item)), out);
    console.log(`已生成模块市场索引：${out}`);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

function isModulePackagePath(target: string): boolean {
  return target.toLowerCase().endsWith('.lbmod');
}

async function pathExists(target: string): Promise<boolean> {
  try { await fs.stat(target); return true; } catch { return false; }
}

async function previewPackageForCli(packagePath: string) {
  const tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-cli-'));
  try {
    return await createModuleService(tempWorkspace).previewPackageInstall(packagePath);
  } finally {
    await fs.rm(tempWorkspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function getStringArg(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parsePermission(value: string): AiBridgePermissionMode {
  if (value === 'readonly' || value === 'preview' || value === 'yolo') return value;
  throw new Error('无效权限模式，请使用 readonly、preview 或 yolo。');
}

function printUsage(): void {
  console.log(`Usage:
  lingbuilder --help | --version
  lingbuilder doctor [--workspace <path>] [--json]
  lingbuilder auth login|logout|status [--server <url>] [--json]
  lingbuilder ai models|balance [--json]
  lingbuilder ai chat --model <alias> --prompt <text> [--json]
  lingbuilder workspace inspect [--workspace <path>] [--json]
  lingbuilder project diagnose|export|build|run|stop --request <file.json> [--workspace <path>] [--yes] [--json]
  lingbuilder ai-server --workspace <path> [--host 127.0.0.1] [--port 17860] [--permission preview] [--token <token>] [--mcp]
  lingbuilder module init --template cpp-source --out <dir> [--id <id>] [--name <name>]
  lingbuilder module validate <dir|file.lbmod>
  lingbuilder module pack <dir> --out <file.lbmod>
  lingbuilder module inspect <dir|file.lbmod>
  lingbuilder module migrate-cpp --config <file> --out <dir>
  lingbuilder module market index --packages <dir> --out module-market.json

Permissions:
  readonly  只允许读取、搜索、诊断和生成预览
  preview   默认模式，写入和执行需要 approved=true
  yolo      带 token 的客户端可自动写入和执行受控 LingBuilder 命令`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
