const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packagedRoot = process.env.LINGBUILDER_PACKAGED_ROOT
  ? path.resolve(process.env.LINGBUILDER_PACKAGED_ROOT)
  : path.join(projectRoot, 'release', 'win-unpacked');
const executablePath = path.join(packagedRoot, 'LingBuilder.exe');
const cliLauncherPath = path.join(packagedRoot, 'lingbuilder.cmd');
const execFileAsync = promisify(execFile);
const expectedCliVersion = `LingBuilder CLI ${require('../package.json').version}`;

async function main() {
  await fs.access(executablePath).catch(() => {
    throw new Error(`未找到 ${executablePath}，请先运行 npm run package:dir。`);
  });

  if (process.argv.includes('--cli-only')) {
    console.log(JSON.stringify({ ok: true, cliVersion: await assertPackagedCli() }, null, 2));
    return;
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-packaged-smoke-'));
  const documentsRoot = path.join(tempRoot, 'Documents');
  const userDataRoot = path.join(tempRoot, 'user-data');

  try {
    const cliVersion = await assertPackagedCli();
    const first = await launchSmoke('first', documentsRoot, userDataRoot);
    const expectedWorkspace = path.join(documentsRoot, 'LingBuilder', '起始工作区');
    assertSmokeResult(first, expectedWorkspace);

    const preservedFile = path.join(expectedWorkspace, 'config', 'config.ini');
    const preservedContent = '; packaged smoke user edit\nvalue=不覆盖\n';
    await fs.writeFile(preservedFile, preservedContent, 'utf8');

    const second = await launchSmoke('second', documentsRoot, userDataRoot);
    assertSmokeResult(second, expectedWorkspace);
    if (await fs.readFile(preservedFile, 'utf8') !== preservedContent) {
      throw new Error('第二次启动覆盖了用户修改的起始工作区文件。');
    }

    await assertNoPackagedProcesses();
    console.log(JSON.stringify({
      ok: true,
      firstRun: first,
      secondRun: second,
      cliVersion,
      preservedUserEdit: true,
      noResidualProcesses: true
    }, null, 2));
  } finally {
    const expectedPrefix = path.join(os.tmpdir(), 'lingbuilder-packaged-smoke-');
    if (!tempRoot.startsWith(expectedPrefix)) throw new Error(`拒绝清理非临时目录：${tempRoot}`);
    await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function assertPackagedCli() {
  await fs.access(cliLauncherPath).catch(() => {
    throw new Error('安装版未包含 lingbuilder.cmd CLI 启动器。');
  });
  const { stdout, stderr } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '& $env:LINGBUILDER_CLI_LAUNCHER --version'],
    {
      cwd: projectRoot,
      windowsHide: true,
      timeout: 15_000,
      env: { ...process.env, LINGBUILDER_CLI_LAUNCHER: cliLauncherPath }
    }
  );
  const version = stdout.trim();
  if (version !== expectedCliVersion) {
    throw new Error(`安装版 CLI 冒烟失败：${version || stderr.trim() || '无输出'}`);
  }
  return version;
}

async function launchSmoke(name, documentsRoot, userDataRoot) {
  const resultPath = path.join(path.dirname(documentsRoot), `smoke-result-${name}.json`);
  const desktopEnvironment = { ...process.env };
  delete desktopEnvironment.ELECTRON_RUN_AS_NODE;
  const child = spawn(executablePath, [
    `--user-data-dir=${userDataRoot}`,
    `--smoke-documents-dir=${documentsRoot}`,
    '--smoke-test',
    `--smoke-result=${resultPath}`
  ], {
    cwd: projectRoot,
    env: desktopEnvironment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  let result;
  // The managed Bridge may need to probe several ports on slower disks. Keep the harness
  // alive long enough for the renderer's own bounded checks to report a
  // useful result instead of terminating the application mid-probe.
  const deadline = Date.now() + 240_000;
  try {
    while (Date.now() < deadline && !result) {
      try {
        result = JSON.parse(await fs.readFile(resultPath, 'utf8'));
      } catch (error) {
        if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
      if (!result && child.exitCode !== null) break;
      if (!result) await delay(100);
    }
    if (!result) {
      const progress = await fs.readFile(`${resultPath}.progress`, 'utf8').catch(() => '未写入阶段进度');
      throw new Error(`安装版冒烟未产生结果。exit=${child.exitCode}\n阶段：${progress}\n${stderr || stdout}`);
    }

    while (child.exitCode === null && Date.now() < deadline) await delay(50);
    if (child.exitCode === null) throw new Error('安装版写入结果后未能在超时内自行退出。');
    if (child.exitCode !== 0) throw new Error(`安装版退出码异常：${child.exitCode}\n结果：${JSON.stringify(result)}\n${stderr || stdout}`);

    await assertServiceStopped(result);
    return result;
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
  }
}

function assertSmokeResult(result, expectedWorkspace) {
  if (!result.ok || !result.hasRoot || result.healthStatus !== 200 || result.modulesStatus !== 200 || result.aiStatus !== 200 || result.bridgeStatus !== 404
    || result.managedBridgeStatus !== 200 || result.managedMcpStatus !== 200 || !result.managedBridgeStopped || !result.managedClientLaunched
    || result.terminalStatus !== 201 || result.terminalResizeStatus !== 200 || result.terminalCloseStatus !== 200 || !result.terminalPtyOutput) {
    throw new Error(`安装版接口冒烟失败：${JSON.stringify(result)}`);
  }
  if (path.resolve(result.workspacePath) !== path.resolve(expectedWorkspace)) {
    throw new Error(`工作区路径不符合预期：${result.workspacePath}`);
  }
}

async function assertServiceStopped(result) {
  if (!result.serviceStopped || !result.serviceOrigin || !Number.isInteger(result.servicePid)) {
    throw new Error(`本地服务未报告完整退出信息：${JSON.stringify(result)}`);
  }
  if (isProcessAlive(result.servicePid)) throw new Error(`本地服务进程仍残留：${result.servicePid}`);
  try {
    const response = await fetch(`${result.serviceOrigin}/api/health`, { signal: AbortSignal.timeout(1000) });
    throw new Error(`本地服务端口仍可访问：HTTP ${response.status}`);
  } catch (error) {
    if (String(error?.message || '').startsWith('本地服务端口仍可访问')) throw error;
  }
}

async function assertNoPackagedProcesses() {
  if (process.platform !== 'win32') return;
  const escapedPath = executablePath.replace(/'/g, "''");
  const command = `@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${escapedPath}' }).Count`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], {
    windowsHide: true,
    timeout: 10_000
  });
  if (Number.parseInt(stdout.trim(), 10) !== 0) {
    throw new Error(`检测到残留 LingBuilder 安装版进程：${stdout.trim()}`);
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
