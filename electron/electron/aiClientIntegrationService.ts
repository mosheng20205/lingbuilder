import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type ExternalAiClientId = 'codex' | 'claude' | 'gemini' | 'generic';

export interface ExternalAiClientStatus {
  id: ExternalAiClientId;
  label: string;
  installed: boolean;
  executable: string;
  detail: string;
}

export interface ExternalAiLaunchPlan {
  clientId: ExternalAiClientId;
  title: string;
  profile: 'powershell';
  cwd: string;
  env: Record<string, string>;
  command: string;
  detail: string;
}

export interface CreateExternalAiLaunchPlanOptions {
  clientId: ExternalAiClientId;
  clients: ExternalAiClientStatus[];
  workspaceRoot: string;
  mcpUrl: string;
  httpUrl: string;
  token: string;
}

const CLIENTS: Array<{ id: Exclude<ExternalAiClientId, 'generic'>; label: string; command: string }> = [
  { id: 'codex', label: 'Codex CLI', command: 'codex' },
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini' }
];

export async function detectExternalAiClients(): Promise<ExternalAiClientStatus[]> {
  const detected = await Promise.all(CLIENTS.map(async definition => {
    const candidates = await findExecutables(definition.command);
    for (const candidate of candidates) {
      try {
        const version = await runVersion(candidate);
        return { id: definition.id, label: definition.label, installed: true, executable: candidate, detail: version || '已安装并可启动。' };
      } catch {
        // Try the next PATH candidate. WindowsApps aliases may exist but reject direct execution.
      }
    }
    return {
      id: definition.id, label: definition.label, installed: false, executable: candidates[0] || '',
      detail: candidates.length ? '检测到命令入口，但当前进程无法执行。' : '当前用户 PATH 中未找到。'
    };
  }));
  return [
    ...detected,
    { id: 'generic', label: '通用终端', installed: true, executable: '', detail: '打开已注入 Bridge 地址和临时 Token 的 PowerShell。' }
  ];
}

export async function createExternalAiLaunchPlan(options: CreateExternalAiLaunchPlanOptions): Promise<ExternalAiLaunchPlan> {
  const workspaceRoot = await validateWorkspace(options.workspaceRoot);
  if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/ai-bridge\/mcp$/u.test(options.mcpUrl)) throw new Error('MCP 地址不是受支持的本机 LingBuilder 端点。');
  if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/ai-bridge$/u.test(options.httpUrl)) throw new Error('HTTP Bridge 地址不是受支持的本机端点。');
  if (!options.token || options.token.length < 24 || /[\s\0]/u.test(options.token)) throw new Error('AI Bridge Token 无效。');
  const client = options.clients.find(item => item.id === options.clientId);
  if (!client) throw new Error('不支持的外部 AI 客户端。');
  if (options.clientId !== 'generic' && (!client.installed || !client.executable)) throw new Error(`${client.label} 未安装或无法启动。`);

  const env = {
    LINGBUILDER_AI_BRIDGE_TOKEN: options.token,
    LINGBUILDER_AI_BRIDGE_MCP_URL: options.mcpUrl,
    LINGBUILDER_AI_BRIDGE_HTTP_URL: options.httpUrl
  };
  if (options.clientId === 'generic') {
    return {
      clientId: 'generic', title: 'LingBuilder Bridge 终端', profile: 'powershell', cwd: workspaceRoot, env,
      command: "Write-Host 'LingBuilder AI Bridge 已注入当前终端。' -ForegroundColor Cyan; Write-Host ('MCP:  ' + $env:LINGBUILDER_AI_BRIDGE_MCP_URL); Write-Host ('HTTP: ' + $env:LINGBUILDER_AI_BRIDGE_HTTP_URL); Write-Host 'Token 已安全注入环境变量 LINGBUILDER_AI_BRIDGE_TOKEN。' -ForegroundColor DarkGray",
      detail: '已打开通用 PowerShell；Token 仅存在于该终端进程环境。'
    };
  }

  const executable = psQuote(client.executable);
  if (options.clientId === 'codex') {
    const urlOverride = `mcp_servers.lingbuilder.url=${JSON.stringify(options.mcpUrl)}`;
    const tokenOverride = 'mcp_servers.lingbuilder.bearer_token_env_var="LINGBUILDER_AI_BRIDGE_TOKEN"';
    return {
      clientId: 'codex', title: 'Codex CLI + LingBuilder', profile: 'powershell', cwd: workspaceRoot, env,
      command: `& ${executable} -C ${psQuote(workspaceRoot)} -c ${psQuote(urlOverride)} -c ${psQuote(tokenOverride)}`,
      detail: '通过本次会话配置连接共享 MCP，不修改用户的 Codex 全局配置。'
    };
  }

  const configDirectory = path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-clients');
  await fs.mkdir(configDirectory, { recursive: true });
  if (options.clientId === 'claude') {
    const configPath = path.join(configDirectory, 'claude.mcp.json');
    await atomicWriteJson(configPath, {
      mcpServers: {
        lingbuilder: {
          type: 'http', url: '${LINGBUILDER_AI_BRIDGE_MCP_URL}',
          headers: { Authorization: 'Bearer ${LINGBUILDER_AI_BRIDGE_TOKEN}' }
        }
      }
    });
    return {
      clientId: 'claude', title: 'Claude Code + LingBuilder', profile: 'powershell', cwd: workspaceRoot, env,
      command: `& ${executable} --mcp-config ${psQuote(configPath)} --strict-mcp-config`,
      detail: '使用 LingBuilder 管理的临时 MCP 配置启动，不修改 Claude Code 用户配置。'
    };
  }

  const configPath = path.join(configDirectory, 'gemini.settings.json');
  await atomicWriteJson(configPath, {
    mcpServers: {
      lingbuilder: {
        httpUrl: '$LINGBUILDER_AI_BRIDGE_MCP_URL',
        headers: { Authorization: 'Bearer $LINGBUILDER_AI_BRIDGE_TOKEN' },
        timeout: 600000,
        trust: false
      }
    }
  });
  return {
    clientId: 'gemini', title: 'Gemini CLI + LingBuilder', profile: 'powershell', cwd: workspaceRoot,
    env: { ...env, GEMINI_CLI_SYSTEM_SETTINGS_PATH: configPath },
    command: `& ${executable}`,
    detail: '使用本次终端专属的系统设置覆盖连接 Bridge，不改写用户或项目的 Gemini 配置。'
  };
}

async function findExecutables(command: string): Promise<string[]> {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  const output = await runProcess(finder, [command], 3_000).catch(() => '');
  return [...new Set(output.split(/\r?\n/u).map(item => item.trim()).filter(Boolean))];
}

async function runVersion(executable: string): Promise<string> {
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/iu.test(executable)) {
    return await runProcess(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${executable}" --version`], 5_000);
  }
  return await runProcess(executable, ['--version'], 5_000);
}

async function runProcess(executable: string, args: string[], timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (action: () => void) => { if (settled) return; settled = true; clearTimeout(timer); action(); };
    const timer = setTimeout(() => { child.kill(); finish(() => reject(new Error('命令检测超时。'))); }, timeoutMs);
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
    child.once('error', error => finish(() => reject(error)));
    child.once('exit', code => finish(() => {
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
      if (code === 0) resolve(output.split(/\r?\n/u)[0]?.slice(0, 256) || '已安装并可启动。');
      else reject(new Error(errorOutput || output || `退出码 ${code}`));
    }));
  });
}

async function validateWorkspace(value: string): Promise<string> {
  if (!value || !path.isAbsolute(value)) throw new Error('外部 AI 客户端必须连接绝对工作区路径。');
  const workspace = await fs.realpath(path.resolve(value));
  if (!(await fs.stat(workspace)).isDirectory()) throw new Error('当前工作区目录无效。');
  return workspace;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, filePath);
}

function psQuote(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}
