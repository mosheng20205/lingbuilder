import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AiBridgeService } from '../src/services/aiBridge/aiBridgeService';

const execFileAsync = promisify(execFile);

/**
 * 「导出安装包」真机验收：临时工作区 → CLI 同链路 project.create（windows-console）→
 * installer.export（内部 buildRun 只构建不运行 + 真 makensis）→ 静默安装到用户目录 →
 * 运行安装后的 exe → 静默卸载 → 断言清理干净。
 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-installer-accept-'));
  const service = new AiBridgeService({
    workspaceRoot,
    host: '127.0.0.1',
    port: 0,
    token: 'accept-token',
    permission: 'yolo',
    allowRemote: false,
    enableMcp: false
  });
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  try {
    const created = await service.createProject({
      name: '安装包演示',
      templateId: 'windows-console',
      enabledModuleIds: [],
      approved: true
    });
    const createdShape = created as { result?: { project?: { id?: string } }; project?: { id?: string }; receiptId?: string };
    const projectId = createdShape.result?.project?.id || createdShape.project?.id || '';
    console.log('create keys:', Object.keys(created as object), 'receipt:', createdShape.receiptId || '(none)');
    check('project.create windows-console', Boolean(projectId), projectId);

    const exported = await service.installerExport({ projectId, approved: true, version: '1.0' });
    const exportedShape = exported as { ok?: boolean; installerPath?: string; installerFileName?: string; outputFileName?: string; architecture?: 'x64' | 'x86'; installerSizeBytes?: number; version?: string; fileCount?: number; logs?: string[] };
    check('installer.export ok', exportedShape.ok === true, JSON.stringify({ version: exportedShape.version, fileCount: exportedShape.fileCount, size: exportedShape.installerSizeBytes }));
    if (exportedShape.ok !== true) {
      console.log('ERROR:', (exported as { error?: string }).error);
      console.log((exportedShape.logs || []).join('\n'));
      throw new Error('导出失败，终止后续安装验证');
    }
    const installerPath = exportedShape.installerPath!;
    const installerStat = await fs.stat(installerPath);
    check('安装包文件存在', installerStat.isFile() && installerStat.size > 1024, `${installerStat.size} bytes`);
    check('产物在构建目录 installer/ 下', installerPath.includes(`${path.sep}installer${path.sep}`), installerPath);

    // 安装包版本信息一致性：响应版本与文件名一致（1.0 → 1.0.0.0）
    check('版本进文件名', path.basename(installerPath).includes('1.0.0.0'), path.basename(installerPath));

    // 静默安装（NSIS /S，per-user → %LOCALAPPDATA%\Programs\安装包演示）
    await execFileAsync(installerPath, ['/S'], { timeout: 90_000 });
    const installDir = path.join(process.env.LOCALAPPDATA || '', 'Programs', '安装包演示');
    const installedExe = path.join(installDir, exportedShape.outputFileName || 'LingBuilderPreview.exe');
    await pollFor(() => fs.access(installedExe).then(() => true).catch(() => false), 30_000);
    const exeStat = await fs.stat(installedExe);
    check('静默安装出主程序', exeStat.isFile(), installedExe);
    const uninstaller = path.join(installDir, 'Uninstall.exe');
    check('静默安装出卸载器', (await fs.stat(uninstaller)).isFile());

    // 运行安装后的 exe：控制台模板即打即退，输出中文问候
    const run = await execFileAsync(installedExe, [], { timeout: 30_000, encoding: 'buffer' });
    const stdout = run.stdout.toString('utf8');
    check('安装后的 exe 可运行', stdout.includes('LingBuilder') || stdout.includes('控制台'), stdout.trim().slice(0, 80));

    // 静默卸载
    await execFileAsync(uninstaller, ['/S'], { timeout: 90_000 });
    await pollFor(async () => {
      try {
        await fs.access(installDir);
        return false;
      } catch {
        return true;
      }
    }, 30_000);
    let uninstalled = false;
    try {
      await fs.access(installDir);
    } catch {
      uninstalled = true;
    }
    check('静默卸载清空安装目录', uninstalled);

    // 二期选项：perMachine + 捆绑 VC++ 运行库（真下载/真缓存）→ 断言脚本形态与产物（不真装：需要 UAC 提权）
    const exported2 = await service.installerExport({
      projectId,
      approved: true,
      version: '2.0',
      installMode: 'perMachine',
      bundleVcRedist: true
    });
    const shape2 = exported2 as { ok?: boolean; error?: string; installerPath?: string; requiresVcRedist?: boolean; logs?: string[] };
    check('installer.export 二期选项 ok', shape2.ok === true, shape2.error || shape2.installerPath || '');
    if (shape2.ok === true) {
      const script = await fs.readFile(path.join(path.dirname(shape2.installerPath!), 'installer.nsi'), 'utf8');
      check('perMachine 策略写入 admin 权限', script.includes('RequestExecutionLevel admin'));
      check('捆绑运行库写入检测与链装', script.includes('ReadRegDWORD $0 HKLM') && script.includes('/install /quiet /norestart'));
      check('版本 2.0 进文件名', path.basename(shape2.installerPath!).includes('2.0.0.0'), path.basename(shape2.installerPath!));
      check('捆绑后目标机器无需预装运行库标记', shape2.requiresVcRedist === false);
      const setup2 = await fs.stat(shape2.installerPath!);
      const console2 = await fs.stat(path.join(path.dirname(shape2.installerPath!), 'vc_redist.x64.exe')).catch(() => null);
      check('vc_redist 已打进工作目录', Boolean(console2) || setup2.size > 1024 * 1024, `setup=${setup2.size} bytes`);
      const redistArch = (exportedShape.architecture || 'x86') === 'x64' ? 'x64' : 'x86';
      check('vc_redist 缓存已落盘', Boolean(await fs.stat(path.join(process.env.LOCALAPPDATA || '', 'LingBuilder', 'vc-redist', `vc_redist.${redistArch}.exe`)).catch(() => null)), redistArch);
    }
  } finally {
    await service.stopRuns().catch(() => undefined);
    if (process.env.LB_KEEP_WORKSPACE) {
      console.log('保留工作区：', workspaceRoot);
    } else {
    await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  if (failures.length > 0) {
    console.error(`验收失败 ${failures.length} 项：${failures.join('、')}`);
    process.exit(1);
  }
  console.log('ALL PASS');
}

async function pollFor(predicate: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`等待超时（${timeoutMs}ms）`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
