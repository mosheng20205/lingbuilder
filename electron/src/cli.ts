#!/usr/bin/env node
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { AiBridgeService } from './services/aiBridge/aiBridgeService';
import { createAiBridgeRouter } from './services/aiBridge/httpRoutes';
import { startAiBridgeMcpServer } from './services/aiBridge/mcpServer';
import { AiBridgePermissionMode, AiBridgeServerOptions } from './services/aiBridge/types';

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
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
  log(`LingBuilder AI Bridge listening on http://${host}:${port}/api/ai-bridge`);
  log(`Workspace: ${workspaceRoot}`);
  log(`Permission: ${permission}`);
  log(`Token: ${token}`);

  if (enableMcp) {
    startAiBridgeMcpServer(service);
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

Permissions:
  readonly  只允许读取、搜索、诊断和生成预览
  preview   默认模式，写入和执行需要 approved=true
  yolo      带 token 的客户端可自动写入和执行受控 LingBuilder 命令`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
