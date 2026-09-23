import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { agentProviderEnvironment, buildAgentProviderPatchLines, type AgentProviderSettings } from './agentProviderSettings';

/** dsh 要求 Node ^22.19.0 || >=24.0.0；低于此版本整棵插件树会加载失败。 */
export const MIN_NODE_MAJOR = 22;
export const MIN_NODE_MINOR = 19;

/**
 * 内嵌 Agent 运行时必须摘掉的本地工具行。dsh 是 everything-is-a-plugin，
 * 工具行可以整行 disabled；不摘掉的话模型会绕过 AiBridgeService 直接读写盘、
 * 起 shell（实测外部 harness 就这么干过），提案/确认/撤销事务形同虚设。
 */
export const MASKED_DSH_TOOL_ROWS: readonly string[] = [
  'tool-fs',
  'tool-fs-search',
  'tool-bash',
  'tool-pwsh',
  'tool-web',
  'tool-jobs',
  'tool-skill',
  'tool-todo',
  'tool-goal',
  'tool-ralph',
  'tool-workflow',
  'tool-subagent',
  'tool-subagent-fork',
  'tool-subagent-control',
  'tool-subagent-list-agents'
];

export interface DshRuntimeResolution {
  ok: boolean;
  nodePath?: string;
  nodeVersion?: string;
  dshBinPath?: string;
  /** 解析失败时的中文诊断，直接面向用户展示，不得只给错误码。 */
  problem?: string;
  /** 排查用的候选路径清单（不含任何凭据）。 */
  candidates?: string[];
}

export interface AgentLaunchPlan {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  patchPath: string;
}

export interface AgentRuntimeProfileOptions {
  /** 覆盖 Node 宿主（打包机/开发机调试用）。 */
  nodeOverride?: string;
  /** 覆盖 dsh CLI 入口。 */
  dshBinOverride?: string;
  /** 独立 Harness home；缺省沿用用户本机 dsh 配置（复用其 provider 与凭据）。 */
  dshHome?: string;
  environment?: NodeJS.ProcessEnv;
  resourcesPath?: string;
  homeDirectory?: string;
  globalNodeModules?: string;
  platform?: NodeJS.Platform;
}

function nodeExecutableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'node.exe' : 'node';
}

/** 依次给出：环境变量覆盖 → 随包 Node → PATH 上的 node。 */
export function nodeHostCandidates(options: AgentRuntimeProfileOptions = {}): string[] {
  const platform = options.platform || process.platform;
  const environment = options.environment || process.env;
  const candidates: string[] = [];
  const override = String(environment.LINGBUILDER_DSH_NODE || options.nodeOverride || '').trim();
  if (override) candidates.push(override);
  const resources = String(options.resourcesPath || process.resourcesPath || '').trim();
  if (resources) candidates.push(path.join(resources, 'node', nodeExecutableName(platform)));
  const systemNode = String(environment.PATH || environment.Path || '')
    .split(path.delimiter)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => path.join(entry, nodeExecutableName(platform)));
  for (const candidate of systemNode) if (!candidates.includes(candidate)) candidates.push(candidate);
  return candidates;
}

/** dsh CLI 入口候选：环境变量 → 随包 resources/dsh → 全局 npm 安装 → 本机 Harness home。 */
export function dshBinCandidates(options: AgentRuntimeProfileOptions = {}): string[] {
  const environment = options.environment || process.env;
  const candidates: string[] = [];
  const override = String(environment.LINGBUILDER_DSH_BIN || options.dshBinOverride || '').trim();
  if (override) candidates.push(override);
  const resources = String(options.resourcesPath || process.resourcesPath || '').trim();
  if (resources) {
    candidates.push(path.join(resources, 'dsh', 'bin.js'));
    candidates.push(path.join(resources, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
  }
  const globalRoot = String(options.globalNodeModules || '').trim();
  if (globalRoot) candidates.push(path.join(globalRoot, '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
  const home = String(options.homeDirectory || (environment as any).USERPROFILE || (environment as any).HOME || '').trim();
  if (home) candidates.push(path.join(home, '.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
  return candidates;
}

export function parseNodeVersion(output: string): { major: number; minor: number; text: string } | undefined {
  const match = /v?(\d+)\.(\d+)\.(\d+)/u.exec(String(output || ''));
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), text: match[0].startsWith('v') ? match[0] : `v${match[0]}` };
}

export function satisfiesNodeRequirement(version: { major: number; minor: number } | undefined): boolean {
  if (!version) return false;
  if (version.major > MIN_NODE_MAJOR) return true;
  return version.major === MIN_NODE_MAJOR && version.minor >= MIN_NODE_MINOR;
}

export interface NodeVersionProbe {
  /** 读取 `node --version` 输出；不可用时返回空串。 */
  (executable: string): Promise<string>;
}

/**
 * 解析内嵌 Agent 运行时需要的 Node 宿主与 dsh 入口。任何一步失败都必须回中文
 * 诊断并给出可执行修法，禁止只报「未找到」。
 */
export async function resolveDshRuntime(
  options: AgentRuntimeProfileOptions = {},
  probeNodeVersion: NodeVersionProbe = async () => ''
): Promise<DshRuntimeResolution> {
  const nodeCandidates = nodeHostCandidates(options);
  const dshCandidates = dshBinCandidates(options);
  const failures: string[] = [];

  let chosenNode = '';
  let nodeVersion = '';
  for (const candidate of nodeCandidates) {
    if (!await fileExists(candidate)) {
      failures.push(`Node 候选不存在：${candidate}`);
      continue;
    }
    const output = await probeNodeVersion(candidate).catch(() => '');
    const parsed = parseNodeVersion(output);
    if (!satisfiesNodeRequirement(parsed)) {
      failures.push(`Node 版本不满足 dsh 要求（^${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} || >=24）：${candidate}${parsed ? ` 实测 ${parsed.text}` : ' 无法读取版本'}`);
      continue;
    }
    chosenNode = candidate;
    nodeVersion = parsed!.text;
    break;
  }
  if (!chosenNode) {
    return {
      ok: false,
      candidates: nodeCandidates,
      problem: `未找到可用的 Node 运行时（需要 ^${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} 或 >=24）。修法任选其一：升级 LingBuilder 安装包以携带随包 Node；或设置环境变量 LINGBUILDER_DSH_NODE 指向本机 node 可执行文件；或安装 Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+ 后重试。诊断明细：${failures.slice(-3).join('；') || '无候选路径'}`
    };
  }

  let chosenDsh = '';
  for (const candidate of dshCandidates) {
    if (await fileExists(candidate)) { chosenDsh = candidate; break; }
    failures.push(`dsh 入口不存在：${candidate}`);
  }
  if (!chosenDsh) {
    return {
      ok: false,
      nodePath: chosenNode,
      nodeVersion,
      candidates: dshCandidates,
      problem: `已找到 Node（${nodeVersion}），但未找到 DeepSeek Harness（dsh）运行库。修法：在 IDE 安装目录的 resources/dsh 放置 dsh 发行包，或设置环境变量 LINGBUILDER_DSH_BIN 指向 @deepseek-ai/dsh 的 lib/bin.js，或执行 npm install -g @deepseek-ai/dsh 后重试。诊断明细：${failures.slice(-3).join('；')}`
    };
  }

  return { ok: true, nodePath: chosenNode, nodeVersion, dshBinPath: chosenDsh };
}

/**
 * 生成内嵌 Agent 的 dsh profile overlay：只挂 LingBuilder MCP（stdio + agent 工具集），
 * 并把所有本地文件/命令行工具整行禁用。内容是确定性的（不含时间戳），便于回归比对。
 */
export function buildAgentProfilePatchYaml(request: {
  workspaceRoot: string;
  bridgeCommand: string;
  bridgeArgs: string[];
  bridgeCwd: string;
  bridgeEnv?: Record<string, string>;
  providerSettings?: AgentProviderSettings;
}): string {
  const providerLines = buildAgentProviderPatchLines(request.providerSettings);
  const lines: string[] = [
    '# LingBuilder 面板内嵌 Agent 运行时 profile overlay（由 IDE 自动生成，请勿手工编辑）。',
    '# 只暴露 lingbuilder MCP（agent 工具集：写盘与构建由 IDE 代执行），并禁用全部本地工具。',
    '- insert:',
    '    - id: mcp-lingbuilder-agent',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: lingbuilder',
    '        transport: stdio',
    `        command: ${yamlSingleQuote(request.bridgeCommand)}`,
    '        args:',
    ...request.bridgeArgs.map(argument => `          - ${yamlSingleQuote(argument)}`),
    `        cwd: ${yamlSingleQuote(request.bridgeCwd)}`,
    '        env:',
    ...Object.entries(request.bridgeEnv || {}).map(([key, value]) => `          ${key}: ${yamlSingleQuote(value)}`),
    '        toolCallTimeoutMs: 900000',
    '        failOnStartupError: true',
    ''
  ];
  if (providerLines.length) {
    lines.push(
      '# 模型通道：端点与模型名写在这里，API Key 只经子进程环境变量注入（本文件不得出现密钥）。',
      ...providerLines,
      ''
    );
  }
  lines.push('# 本地工具全部整行禁用：任何写入都必须经 AiBridgeService 的提案事务。');
  for (const row of MASKED_DSH_TOOL_ROWS) {
    lines.push(`- id: ${row}`, '  disabled: true');
  }
  return `${lines.join('\n')}\n`;
}

function yamlSingleQuote(value: string): string {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

export async function writeAgentProfilePatch(profileDirectory: string, patchYaml: string): Promise<string> {
  await fs.mkdir(profileDirectory, { recursive: true });
  // 文件名带内容指纹：同一份配置复用同一路径，配置变化自然生成新文件，
  // 避免运行中的 dsh 进程读到被改写的 overlay。
  const digest = crypto.createHash('sha256').update(patchYaml).digest('hex').slice(0, 12);
  const patchPath = path.join(profileDirectory, `lingbuilder-agent-${digest}.cordis.yml`);
  await fs.writeFile(patchPath, patchYaml.replace(/\n/gu, '\r\n'), 'utf8');
  // 旧指纹的 overlay 只被「当时启动的那个 dsh 进程」在启动期读一次，留着就是永久垃圾；
  // 全部清掉，只保留刚写入的这份。
  const entries = await fs.readdir(profileDirectory).catch(() => [] as string[]);
  await Promise.all(entries
    .filter(name => name !== path.basename(patchPath) && /^lingbuilder-agent-[0-9a-f]{12}\.cordis\.yml$/iu.test(name))
    .map(name => fs.rm(path.join(profileDirectory, name), { force: true }).catch(() => undefined)));
  return patchPath;
}

/** 组装 dsh 子进程启动计划；解析失败时返回中文诊断而不是抛裸异常。 */
export async function createAgentLaunchPlan(request: {
  workspaceRoot: string;
  cliEntryPath: string;
  bridgeCommand: string;
  bridgeEnv?: Record<string, string>;
  resolution: DshRuntimeResolution;
  profileDirectory: string;
  dshHome?: string;
  environment?: NodeJS.ProcessEnv;
  providerSettings?: AgentProviderSettings;
}): Promise<{ ok: boolean; plan?: AgentLaunchPlan; problem?: string }> {
  if (!request.resolution.ok || !request.resolution.nodePath || !request.resolution.dshBinPath) {
    return { ok: false, problem: request.resolution.problem || '内嵌 Agent 运行时依赖未就绪。' };
  }
  const patchYaml = buildAgentProfilePatchYaml({
    workspaceRoot: request.workspaceRoot,
    bridgeCommand: request.bridgeCommand,
    bridgeArgs: [
      request.cliEntryPath,
      'ai-server',
      '--workspace',
      request.workspaceRoot,
      '--mcp',
      '--stdio-only',
      '--mcp-toolset',
      'agent'
    ],
    bridgeCwd: path.dirname(path.dirname(request.cliEntryPath)),
    bridgeEnv: request.bridgeEnv,
    providerSettings: request.providerSettings
  });
  const patchPath = await writeAgentProfilePatch(request.profileDirectory, patchYaml);
  const environment = { ...(request.environment || process.env), ...agentProviderEnvironment(request.providerSettings) };
  if (request.dshHome) environment.DSH_HOME = request.dshHome;
  return {
    ok: true,
    plan: {
      command: request.resolution.nodePath,
      args: [request.resolution.dshBinPath, '--profile', 'sdk', '--patch', patchPath],
      env: environment,
      cwd: request.workspaceRoot,
      patchPath
    }
  };
}

async function fileExists(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return stat.isFile();
  } catch {
    return false;
  }
}
