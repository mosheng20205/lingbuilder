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
import { createModuleService } from './services/modules/moduleService';
import {
  createMarketIndex,
  createModuleTemplate,
  migrateCppModule,
  validateModuleDirectory
} from './services/modules/moduleSdkService';

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
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
  const allowRemote = args['allow-remote'] === 'true' || args['allow-remote'] === true;
  const enableMcp = args.mcp === 'true' || args.mcp === true;

  if (host !== '127.0.0.1' && host !== 'localhost' && !allowRemote) {
    throw new Error('AI Bridge 默认禁止监听公网地址；如确需远程连接，请显式传入 --allow-remote。');
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
