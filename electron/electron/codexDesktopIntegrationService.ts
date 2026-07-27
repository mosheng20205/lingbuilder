import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type CodexDesktopIntegrationState =
  | 'not-installed'
  | 'not-configured'
  | 'configured'
  | 'restart-required'
  | 'repair-required'
  | 'conflict'
  | 'error';

export interface CodexDesktopInstallation {
  installed: boolean;
  running: boolean;
  label: string;
  packageFullName: string;
  appUserModelId: string;
  executable: string;
  startedAt: string | null;
  detail: string;
}

export interface CodexDesktopIntegrationStatus extends CodexDesktopInstallation {
  state: CodexDesktopIntegrationState;
  configured: boolean;
  configPath: string;
  workspaceRoot: string;
  permission: 'readonly' | 'preview' | 'yolo';
  restartRequired: boolean;
  managed: boolean;
}

export interface ConfigureCodexDesktopRequest {
  permission?: 'readonly' | 'preview' | 'yolo';
  replaceExisting?: boolean;
  openApp?: boolean;
}

export interface CodexDesktopIntegrationOptions {
  workspaceRoot: string;
  runtimeExecutable: string;
  cliEntryPath: string;
  detectInstallation?: () => Promise<CodexDesktopInstallation>;
  launchApp?: (appUserModelId: string) => Promise<void>;
}

const BLOCK_START = '# >>> LingBuilder ChatGPT/Codex desktop MCP (managed)';
const BLOCK_END = '# <<< LingBuilder ChatGPT/Codex desktop MCP (managed)';
const SERVER_HEADER = '[mcp_servers.lingbuilder_desktop]';

export class CodexDesktopIntegrationService {
  constructor(private readonly options: CodexDesktopIntegrationOptions) {}

  async inspect(permission: 'readonly' | 'preview' | 'yolo' = 'preview'): Promise<CodexDesktopIntegrationStatus> {
    const workspaceRoot = await validateWorkspace(this.options.workspaceRoot);
    const configPath = path.join(workspaceRoot, '.codex', 'config.toml');
    const installation = await (this.options.detectInstallation || detectCodexDesktopInstallation)();
    const source = await fs.readFile(configPath, 'utf8').catch(error => {
      if (isMissingFile(error)) return '';
      throw error;
    });
    const managedBlock = extractManagedBlock(source);
    const unmanagedConflict = !managedBlock && hasServerTable(source);
    const expectedBlock = createManagedBlock({
      runtimeExecutable: this.options.runtimeExecutable,
      cliEntryPath: this.options.cliEntryPath,
      permission
    });
    const configured = Boolean(managedBlock) && normalizeToml(managedBlock!) === normalizeToml(expectedBlock);
    const managed = Boolean(managedBlock);
    let restartRequired = false;
    if (configured && installation.running && installation.startedAt) {
      const modifiedAt = await fs.stat(configPath).then(stat => stat.mtimeMs).catch(() => 0);
      restartRequired = modifiedAt > Date.parse(installation.startedAt) + 1_000;
    }

    let state: CodexDesktopIntegrationState;
    let detail: string;
    if (!installation.installed) {
      state = 'not-installed';
      detail = installation.detail || '未检测到 ChatGPT/Codex Windows 桌面客户端。';
    } else if (unmanagedConflict) {
      state = 'conflict';
      detail = '项目中已有同名 lingbuilder_desktop MCP 配置；确认后可以由 LingBuilder 接管。';
    } else if (!managed) {
      state = 'not-configured';
      detail = '桌面客户端已安装，尚未为当前工作区启用 LingBuilder MCP。';
    } else if (!configured) {
      state = 'repair-required';
      detail = 'LingBuilder MCP 配置与当前安装路径或权限不一致，需要更新。';
    } else if (restartRequired) {
      state = 'restart-required';
      detail = '配置已写入；请完全退出并重新打开 ChatGPT/Codex 桌面客户端。';
    } else {
      state = 'configured';
      detail = installation.running
        ? '当前工作区已配置；在桌面客户端的新任务中可直接使用 LingBuilder 工具。'
        : '当前工作区已配置，打开桌面客户端后即可使用 LingBuilder 工具。';
    }
    return {
      ...installation,
      state,
      configured,
      configPath,
      workspaceRoot,
      permission,
      restartRequired,
      managed,
      detail
    };
  }

  async configure(request: ConfigureCodexDesktopRequest = {}): Promise<CodexDesktopIntegrationStatus> {
    const permission = validatePermission(request.permission || 'preview');
    const before = await this.inspect(permission);
    if (!before.installed) throw new Error('未检测到 ChatGPT/Codex Windows 桌面客户端。');
    const source = await fs.readFile(before.configPath, 'utf8').catch(error => {
      if (isMissingFile(error)) return '';
      throw error;
    });
    if (!extractManagedBlock(source) && hasServerTable(source) && request.replaceExisting !== true) {
      throw new Error('项目中已有同名 MCP 配置；请确认替换后重试。');
    }
    await fs.access(this.options.cliEntryPath);
    await fs.access(this.options.runtimeExecutable);
    const withoutManaged = removeManagedBlock(source);
    const withoutConflictingTable = removeServerTable(withoutManaged);
    const block = createManagedBlock({
      runtimeExecutable: this.options.runtimeExecutable,
      cliEntryPath: this.options.cliEntryPath,
      permission
    });
    const next = `${withoutConflictingTable.trimEnd()}${withoutConflictingTable.trim() ? '\n\n' : ''}${block}\n`;
    await fs.mkdir(path.dirname(before.configPath), { recursive: true });
    await atomicWrite(before.configPath, next);
    if (request.openApp !== false) await (this.options.launchApp || launchCodexDesktop)(before.appUserModelId);
    return await this.inspect(permission);
  }

  async remove(): Promise<CodexDesktopIntegrationStatus> {
    const before = await this.inspect();
    if (!before.managed) return before;
    const source = await fs.readFile(before.configPath, 'utf8');
    await atomicWrite(before.configPath, `${removeManagedBlock(source).trimEnd()}${removeManagedBlock(source).trim() ? '\n' : ''}`);
    return await this.inspect();
  }

  async open(): Promise<CodexDesktopIntegrationStatus> {
    const status = await this.inspect();
    if (!status.installed) throw new Error('未检测到 ChatGPT/Codex Windows 桌面客户端。');
    await (this.options.launchApp || launchCodexDesktop)(status.appUserModelId);
    return await this.inspect(status.permission);
  }
}

export async function detectCodexDesktopInstallation(): Promise<CodexDesktopInstallation> {
  if (process.platform !== 'win32') {
    return emptyInstallation('当前只支持检测 Windows 版 ChatGPT/Codex 桌面客户端。');
  }
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$pkg=Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1",
    "$start=Get-StartApps | Where-Object { $_.AppID -like 'OpenAI.Codex_*!App' } | Select-Object -First 1",
    "$processes=Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue | Sort-Object StartTime",
    "$process=$processes | Select-Object -First 1",
    "$exe=if($process){$process.Path}else{''}",
    "$started=if($process){$process.StartTime.ToUniversalTime().ToString('o')}else{$null}",
    "$value=[ordered]@{installed=[bool]$pkg;running=[bool]$process;label='ChatGPT / Codex 桌面版';packageFullName=if($pkg){$pkg.PackageFullName}else{''};appUserModelId=if($start){$start.AppID}elseif($pkg){$pkg.PackageFamilyName+'!App'}else{''};executable=$exe;startedAt=$started}",
    '$value | ConvertTo-Json -Compress'
  ].join(';');
  try {
    const output = await runProcess('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], 8_000);
    const parsed = JSON.parse(output) as Partial<CodexDesktopInstallation>;
    const installed = parsed.installed === true;
    return {
      installed,
      running: parsed.running === true,
      label: 'ChatGPT / Codex 桌面版',
      packageFullName: typeof parsed.packageFullName === 'string' ? parsed.packageFullName : '',
      appUserModelId: typeof parsed.appUserModelId === 'string' ? parsed.appUserModelId : '',
      executable: typeof parsed.executable === 'string' ? parsed.executable : '',
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
      detail: installed ? '已检测到 OpenAI.Codex Windows 桌面应用。' : '未检测到 OpenAI.Codex Windows 桌面应用。'
    };
  } catch (error) {
    return emptyInstallation(`桌面客户端检测失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function createManagedBlock(options: {
  runtimeExecutable: string;
  cliEntryPath: string;
  permission: 'readonly' | 'preview' | 'yolo';
}): string {
  return [
    BLOCK_START,
    SERVER_HEADER,
    `command = ${tomlString(path.resolve(options.runtimeExecutable))}`,
    `args = [${[
      path.resolve(options.cliEntryPath),
      'ai-server',
      '--workspace',
      '.',
      '--permission',
      options.permission,
      '--mcp',
      '--stdio-only'
    ].map(tomlString).join(', ')}]`,
    'env = { ELECTRON_RUN_AS_NODE = "1" }',
    'enabled = true',
    'required = false',
    'default_tools_approval_mode = "writes"',
    BLOCK_END
  ].join('\n');
}

function extractManagedBlock(source: string): string | null {
  const start = source.indexOf(BLOCK_START);
  if (start < 0) return null;
  const end = source.indexOf(BLOCK_END, start);
  return end < 0 ? null : source.slice(start, end + BLOCK_END.length);
}

function removeManagedBlock(source: string): string {
  const block = extractManagedBlock(source);
  if (!block) return source;
  return source.replace(block, '').replace(/\n{3,}/gu, '\n\n');
}

function hasServerTable(source: string): boolean {
  return /^\s*\[mcp_servers\.lingbuilder_desktop(?:\.|\])/mu.test(source);
}

function removeServerTable(source: string): string {
  const lines = source.split(/\r?\n/u);
  const result: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/u)?.[1] || '';
    if (header) skipping = header === 'mcp_servers.lingbuilder_desktop' || header.startsWith('mcp_servers.lingbuilder_desktop.');
    if (!skipping) result.push(line);
  }
  return result.join('\n').replace(/\n{3,}/gu, '\n\n');
}

function normalizeToml(value: string): string {
  return value.replace(/\r\n/gu, '\n').trim();
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

async function validateWorkspace(value: string): Promise<string> {
  if (!value || !path.isAbsolute(value)) throw new Error('Codex 桌面集成需要绝对工作区路径。');
  const real = await fs.realpath(path.resolve(value));
  if (!(await fs.stat(real)).isDirectory()) throw new Error('当前工作区目录无效。');
  return real;
}

function validatePermission(value: string): 'readonly' | 'preview' | 'yolo' {
  if (value === 'readonly' || value === 'preview' || value === 'yolo') return value;
  throw new Error('不支持的 AI Bridge 权限模式。');
}

async function atomicWrite(filePath: string, value: string): Promise<void> {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, value, 'utf8');
  await fs.rename(temporary, filePath);
}

async function launchCodexDesktop(appUserModelId: string): Promise<void> {
  if (process.platform !== 'win32' || !/^OpenAI\.Codex_[A-Za-z0-9]+!App$/u.test(appUserModelId)) {
    throw new Error('ChatGPT/Codex 桌面客户端启动入口无效。');
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('explorer.exe', [`shell:AppsFolder\\${appUserModelId}`], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

async function runProcess(executable: string, args: string[], timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (action: () => void) => { if (settled) return; settled = true; clearTimeout(timer); action(); };
    const timer = setTimeout(() => { child.kill(); finish(() => reject(new Error('检测超时。'))); }, timeoutMs);
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
    child.once('error', error => finish(() => reject(error)));
    child.once('exit', code => finish(() => {
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
      if (code === 0 && output) resolve(output);
      else reject(new Error(errorOutput || output || `退出码 ${code}`));
    }));
  });
}

function emptyInstallation(detail: string): CodexDesktopInstallation {
  return {
    installed: false,
    running: false,
    label: 'ChatGPT / Codex 桌面版',
    packageFullName: '',
    appUserModelId: '',
    executable: '',
    startedAt: null,
    detail
  };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
