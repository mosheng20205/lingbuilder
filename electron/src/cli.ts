#!/usr/bin/env node
import crypto from 'crypto';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'http';
import os from 'node:os';
import path from 'path';
import { AiBridgeService } from './services/aiBridge/aiBridgeService';
import { createAiBridgeRouter } from './services/aiBridge/httpRoutes';
import { requestLocalAuthorization } from './services/aiBridge/localAuthorizationClient';
import { createAiBridgeMcpHttpGateway, startAiBridgeMcpServer } from './services/aiBridge/mcpServer';
import { AiBridgePermissionMode, AiBridgeServerOptions } from './services/aiBridge/types';
import { CloudCliClient } from './services/cloud/cloudCliClient';
import { createModuleService } from './services/modules/moduleService';
import { ModuleAccessService } from './services/modules/moduleAccessService';
import { LINGBUILDER_VERSION } from './services/product/productInfo';
import {
  createMarketIndex,
  createModuleTemplate,
  migrateCppModule,
  validateModuleDirectory
} from './services/modules/moduleSdkService';

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (command === '--version' || command === 'version') { console.log(`LingBuilder CLI ${LINGBUILDER_VERSION}`); return; }
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
  const enableMcpStdio = args.mcp === 'true' || args.mcp === true;
  const stdioOnly = args['stdio-only'] === 'true' || args['stdio-only'] === true;
  const mcpToolset = parseMcpToolset(getStringArg(args['mcp-toolset']) || 'full');
  const enableMcpHttp = !stdioOnly && args['no-mcp-http'] !== true && args['no-mcp-http'] !== 'true';

  if (mcpToolset !== 'full' && !enableMcpStdio) {
    throw new Error('--mcp-toolset 只对 stdio MCP 生效，必须与 --mcp 一起使用。');
  }

  if (stdioOnly && !enableMcpStdio) {
    throw new Error('--stdio-only 必须与 --mcp 一起使用。');
  }

  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error('AI Bridge 只允许监听 127.0.0.1、localhost 或 ::1；远程 AI 请使用 LingBuilder 云端 API。');
  }

  const token = stdioOnly
    ? 'stdio-transport-does-not-use-http-token'
    : getStringArg(args.token) || process.env.LINGBUILDER_AI_BRIDGE_TOKEN || crypto.randomBytes(24).toString('hex');
  const options: AiBridgeServerOptions = {
    workspaceRoot,
    host,
    port,
    token,
    permission,
    allowRemote,
    enableMcp: enableMcpStdio || enableMcpHttp,
    // agent 工具集 = 面板内嵌 Agent 宿主：提案必须经工作区交接目录交给面板代执行。
    agentProposalHandoff: mcpToolset === 'agent'
  };

  // 外部 AI 客户端自动拉起的 stdio 宿主没有 IDE 注入的授权环境，向正在运行的 IDE 主进程换取；
  // 换不到一律保持 fail-closed（收费模块继续被权益门禁拒绝），不得静默放行。
  // 启动结果保留下来交给门禁分类：「宿主先于授权开关启动」不等于「用户没购买」（P1，2026-09-21）。
  let moduleAccessBootstrap: ModuleAccessBootstrap = 'failed';
  let moduleAccessBootstrapMessage = '';
  if (permission !== 'readonly') {
    if (process.env.LINGBUILDER_MODULE_ACCESS_STATE) {
      moduleAccessBootstrap = 'env';
    } else {
      const exchange = await requestLocalAuthorization('module-access');
      if (exchange.ok) {
        moduleAccessBootstrap = 'exchanged';
        process.env.LINGBUILDER_MODULE_ACCESS_STATE = exchange.value;
      } else {
        moduleAccessBootstrapMessage = exchange.message;
        console.error(`AI Bridge 未取到本机模块授权：${exchange.message}`);
      }
    }
    if (!process.env.LINGBUILDER_FBRO_VIP_KEY) {
      const exchange = await requestLocalAuthorization('fbro-vip');
      // AiBridgeService 构造时读取该环境变量并立即从进程中清除。
      if (exchange.ok) process.env.LINGBUILDER_FBRO_VIP_KEY = exchange.value;
    }
  }

  const moduleAccess = new ModuleAccessService();
  const encodedModuleAccess = process.env.LINGBUILDER_MODULE_ACCESS_STATE;
  if (encodedModuleAccess) {
    const authorizations = JSON.parse(Buffer.from(encodedModuleAccess, 'base64url').toString('utf8'));
    if (Array.isArray(authorizations)) authorizations.forEach(authorization => moduleAccess.sync(authorization));
  }
  const moduleAccessGate = createModuleAccessGate({
    authorizer: moduleAccess,
    bootstrap: moduleAccessBootstrap,
    bootstrapMessage: moduleAccessBootstrapMessage,
    log: message => console.error(message)
  });
  const service = new AiBridgeService(options, {
    assertModuleAccess: moduleIds => moduleAccessGate.assert(moduleIds)
  });
  if (stdioOnly) {
    installAiBridgeStdioShutdownHandlers(service);
    console.error(`LINGBUILDER_AI_BRIDGE_READY ${JSON.stringify({ host: 'stdio', port: 0, origin: 'stdio', workspaceRoot, permission, mcpHttp: false, mcpStdio: true, mcpToolset })}`);
    console.error(`LingBuilder AI Bridge MCP stdio 已启动；工作区：${workspaceRoot}；权限：${permission}；工具集：${mcpToolset}`);
    startAiBridgeMcpServer(service, mcpToolset);
    return;
  }
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  const mcpHttpGateway = enableMcpHttp ? createAiBridgeMcpHttpGateway(service, token) : undefined;
  if (mcpHttpGateway) app.use('/api/ai-bridge/mcp', mcpHttpGateway.router);
  app.use('/api/ai-bridge', createAiBridgeRouter(service, token));
  const server = http.createServer(app);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(); });
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    console.error(code === 'EADDRINUSE'
      ? `AI Bridge 监听失败：端口 ${port} 已被占用，请更换监听端口，或关闭占用该端口的程序（包括上次残留的 AI Bridge 进程）。`
      : `AI Bridge 监听失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const origin = `http://${host}:${actualPort}`;
  const log = enableMcpStdio ? console.error : console.log;
  installAiBridgeShutdownHandlers(server, service, log, () => mcpHttpGateway?.close());
  log(`LINGBUILDER_AI_BRIDGE_READY ${JSON.stringify({ host, port: actualPort, origin, workspaceRoot, permission, mcpHttp: enableMcpHttp, mcpStdio: enableMcpStdio })}`);
  log(`LingBuilder AI Bridge listening on ${origin}/api/ai-bridge`);
  log(`Workspace: ${workspaceRoot}`);
  log(`Permission: ${permission}`);
  log(`Token: ${token}`);
  if (enableMcpHttp) log(`MCP Streamable HTTP: ${origin}/api/ai-bridge/mcp`);

  if (enableMcpStdio) {
    startAiBridgeMcpServer(service, mcpToolset);
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
  const approved = args.yes === true;
  // --arch 用于 32 位 OCX/DLL 示例：进程内组件位数必须与 exe 一致。
  const requestedArch = getStringArg(args.arch);
  const arch = requestedArch === 'win32' || requestedArch === 'x64' ? requestedArch : undefined;
  if (requestedArch && !arch) throw new Error('--arch 只支持 win32 或 x64。');
  const service = new AiBridgeService({ workspaceRoot, host: '127.0.0.1', port: 0, token: 'local-project-cli', permission: approved ? 'yolo' : 'preview', allowRemote: false, enableMcp: false, arch });
  try {
    if (subcommand === 'templates') { printValue(await service.listProjectTemplates(), args.json === true); return; }
    if (!requestFile) throw new Error('project 命令需要 --request <受控项目请求.json>。');
    const request = JSON.parse(await fs.readFile(path.resolve(requestFile), 'utf8'));
    // 受控项目请求通常只携带工作区相对的源码路径。CLI 需要像桌面端一样
    // 读取该文件并传入生成器，否则事件实现会被当作缺失而生成占位函数。
    if (request && typeof request === 'object' && !request.lingCppSourceCode && typeof request.lingCppSourceFilePath === 'string') {
      const sourcePath = path.resolve(workspaceRoot, request.lingCppSourceFilePath);
      if (await pathExists(sourcePath)) {
        request.lingCppSourceCode = await fs.readFile(sourcePath, 'utf8');
        // 显式源码必须覆盖项目磁盘中可能存在的旧/重复副本（例如 src/src/）。
        // 传入源码集合后，生成器会以该集合为权威输入。
        const sourceRoot = typeof request.project?.sourceRoot === 'string' && request.project.sourceRoot.trim()
          ? request.project.sourceRoot.replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '')
          : 'src';
        request.lingCppSources = [{
          filePath: `${sourceRoot}/${path.basename(request.lingCppSourceFilePath)}`,
          sourceCode: request.lingCppSourceCode
        }];
      }
    }
    if (subcommand === 'create') {
      printValue(await service.createProject({ ...request, approved }), args.json === true);
      return;
    }
    if (subcommand === 'undo-create') {
      const receiptId = typeof request.receiptId === 'string' ? request.receiptId : '';
      if (!receiptId) throw new Error('undo-create 请求需要 receiptId。');
      if (!approved) throw new Error('撤销项目创建必须显式传入 --yes。');
      printValue(await service.undoProjectCreate(receiptId, true), args.json === true);
      return;
    }
    if (subcommand === 'diagnose') { printValue(await service.getLingCppDiagnostics(request), args.json === true); return; }
    if (subcommand === 'export') { if (!approved) { printValue(await service.nativePreview(request), args.json === true); return; } printValue(await service.nativeExport({ ...request, approved: true }), args.json === true); return; }
    if (subcommand === 'build') {
      if (!approved) throw new Error('构建和运行必须显式传入 --yes；可先使用 project export 预览。');
      printValue(await service.buildRun({ ...request, run: false, approved: true }), args.json === true);
      return;
    }
    if (subcommand === 'run') {
      if (!approved) throw new Error('构建和运行必须显式传入 --yes；可先使用 project export 预览。');
      const result = await service.buildRun({ ...request, run: true, approved: true });
      if (!result.ok) {
        printValue(result, args.json === true);
        return;
      }
      const runCompletion = await waitForProjectRun(service, request.project?.id || 'window-preview');
      printValue({ ...result, runCompletion }, args.json === true);
      return;
    }
    if (subcommand === 'stop') { printValue(await service.stopRuns(), args.json === true); return; }
    throw new Error('project 子命令仅支持 diagnose、export、build、run、stop。');
  } finally { await service.shutdown(); }
}

async function waitForProjectRun(service: AiBridgeService, projectId: string) {
  let resolveSignal: (signal: 'SIGINT' | 'SIGTERM') => void = () => undefined;
  const signalPromise = new Promise<'SIGINT' | 'SIGTERM'>(resolve => {
    resolveSignal = resolve;
  });
  const onSigint = () => resolveSignal('SIGINT');
  const onSigterm = () => resolveSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  const completionPromise = service.waitForRun(projectId);
  try {
    const outcome = await Promise.race([
      completionPromise.then(completion => ({ kind: 'completed' as const, completion })),
      signalPromise.then(signal => ({ kind: 'signal' as const, signal }))
    ]);
    if (outcome.kind === 'completed') return outcome.completion;

    console.error(`收到 ${outcome.signal}，正在停止项目运行进程…`);
    const stopResult = await service.stopRuns();
    const completion = await completionPromise;
    process.exitCode = outcome.signal === 'SIGINT' ? 130 : 143;
    return { ...completion, interruptedBy: outcome.signal, stopResult };
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
  }
}

function printValue(value: unknown, json: boolean) { if (json) console.log(JSON.stringify(value, bigintReplacer, 2)); else console.log(formatHuman(value)); }
function bigintReplacer(_key: string, value: unknown) { return typeof value === 'bigint' ? value.toString() : value; }
function formatHuman(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value, bigintReplacer, 2); }

function installAiBridgeShutdownHandlers(
  server: http.Server,
  service: AiBridgeService,
  log: (...values: unknown[]) => void,
  closeMcpHttp: () => Promise<void> | undefined = () => undefined
): void {
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (signal: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigterm);
      log(`收到 ${signal}，正在停止 AI Bridge 及其受控运行进程…`);
      try {
        await closeMcpHttp();
      } catch (error) {
        console.error(`AI Bridge MCP HTTP 会话关闭失败：${error instanceof Error ? error.message : String(error)}`);
      }
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

function installAiBridgeStdioShutdownHandlers(service: AiBridgeService): void {
  let shuttingDown = false;
  const shutdown = (exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    void service.shutdown()
      .catch(error => console.error(`AI Bridge stdio 清理失败：${error instanceof Error ? error.message : String(error)}`))
      .finally(() => process.exit(exitCode));
  };
  process.once('SIGINT', () => shutdown(130));
  process.once('SIGTERM', () => shutdown(143));
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

function parseMcpToolset(value: string): AiBridgeMcpToolset {
  if (value === 'full' || value === 'agent') return value;
  throw new Error('无效 MCP 工具集，请使用 full 或 agent。');
}

function printUsage(): void {
  console.log(`Usage:
  lingbuilder --help | --version
  lingbuilder doctor [--workspace <path>] [--json]
  lingbuilder auth login|logout|status [--server <url>] [--json]
  lingbuilder ai models|balance [--json]
  lingbuilder ai chat --model <alias> --prompt <text> [--json]
  lingbuilder workspace inspect [--workspace <path>] [--json]
  lingbuilder project templates [--workspace <path>] [--json]
  lingbuilder project create|diagnose|export|build|run|stop --request <file.json> [--workspace <path>] [--arch win32|x64] [--yes] [--json]
  lingbuilder project undo-create --request <receipt.json> --workspace <path> --yes [--json]
  lingbuilder ai-server --workspace <path> [--host 127.0.0.1] [--port 17860] [--permission preview] [--token <token>] [--mcp] [--no-mcp-http] [--stdio-only] [--mcp-toolset full|agent]
  lingbuilder module init --template cpp-source --out <dir> [--id <id>] [--name <name>]
  lingbuilder module validate <dir|file.lbmod>
  lingbuilder module pack <dir> --out <file.lbmod>
  lingbuilder module inspect <dir|file.lbmod>
  lingbuilder module migrate-cpp --config <file> --out <dir>
  lingbuilder module market index --packages <dir> --out module-market.json

Permissions:
  readonly  只允许读取、搜索、诊断和生成预览
  preview   默认模式，写入和执行需要 approved=true
  yolo      带 token 的客户端可自动写入和执行受控 LingBuilder 命令

MCP:
  默认启用带 Bearer Token 的 Streamable HTTP 端点 /api/ai-bridge/mcp
  --mcp 额外启用兼容旧客户端的 stdio MCP；--no-mcp-http 可关闭共享 HTTP MCP
  --mcp --stdio-only 只启动 stdio MCP，供 ChatGPT/Codex 桌面客户端直接拉起，不监听端口也不需要 Token
  --mcp-toolset agent 把写盘与执行类工具（edit.apply / build.run / native.* / project.create* / module.writeFiles|pack|install）
    从 stdio MCP 的 tools/list 与调用面上摘掉，供 LingBuilder 面板内嵌 Agent 运行时使用：
    模型只生成 edit.propose 提案，落盘与构建由 IDE 在用户点「应用提案」后代执行`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
