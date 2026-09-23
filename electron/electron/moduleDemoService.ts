/**
 * 模块例程（随 IDE 分发的 module-demos 演示工作区）打开链路。
 *
 * 职责：
 * - 枚举随包例程（packaged: resources/module-demos；开发态: 仓库 examples/module-demos）。
 * - 把例程复制到用户可写目录后在新 IDE 进程中打开：例程安装目录可能只读，且
 *   构建要往工作区写 .lingbuilder-build，绝不能直接以 resources 里的目录当工作区。
 * - 例程目录已存在时复用（保留用户改动）：copyMissingFiles 只补缺失文件、绝不覆盖，
 *   半份拷贝（上次复制中断）也能自愈，与 DesktopWorkspaceService 铺设语义一致。
 * - 新 IDE 进程通过 LINGBUILDER_REC_USER_DATA 使用独立 userData（main.ts 同名机制）：
 *   不参与单实例锁竞争、不共享设置，才是真正的「新开一个 IDE」而不是把现有实例
 *   切换工作区。例程实例的最近工作区/设置不污染用户主实例。
 *
 * 本文件必须保持纯 Node（tests/moduleDemoService.test.ts 直接 import），
 * Electron 侧依赖（app.getPath、process.resourcesPath）由 main.ts 注入。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MODULE_DEMO_ROOT_DIR_NAME = 'LingBuilder 例程';

/** 例程 ID 即模块 ID（lingbuilder.xxx），同时是目录名：收紧格式，杜绝路径穿越。 */
const MODULE_DEMO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;

export interface ModuleDemoServiceOptions {
  /** 随包例程根目录（不存在时枚举返回空、打开报中文错误）。 */
  demoSourceRoot: string;
  /** 用户文档目录（例程工作区的落点根）。 */
  documentsPath: string;
  /** 例程实例独立 userData 的父目录（主实例 userData 下）。 */
  demoUserDataRoot: string;
}

export function isValidModuleDemoId(moduleId: string): boolean {
  return typeof moduleId === 'string' && !moduleId.includes('..') && MODULE_DEMO_ID_PATTERN.test(moduleId);
}

/** 枚举随包例程的模块 ID（目录名），只认结构像工作区的目录（src/MainWindow.lcpp）。 */
export async function listModuleDemoIds(options: ModuleDemoServiceOptions): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(options.demoSourceRoot);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (!isValidModuleDemoId(entry)) continue;
    const mainWindowPath = path.join(options.demoSourceRoot, entry, 'src', 'MainWindow.lcpp');
    try {
      const stat = await fs.stat(mainWindowPath);
      if (stat.isFile()) ids.push(entry);
    } catch {
      // 非工作区目录（例如语料或临时目录）不作为例程暴露。
    }
  }
  ids.sort((left, right) => left.localeCompare(right));
  return ids;
}

function demoWorkspacePath(options: ModuleDemoServiceOptions, moduleId: string): string {
  return path.join(options.documentsPath, MODULE_DEMO_ROOT_DIR_NAME, moduleId);
}

/**
 * 把随包例程落到用户可写目录。已存在时只补缺失文件、绝不覆盖用户已有内容
 * （复用口径：保留用户改动），半份拷贝会被补齐成完整例程。
 */
export async function prepareModuleDemoWorkspace(
  options: ModuleDemoServiceOptions,
  moduleId: string
): Promise<{ ok: boolean; workspacePath?: string; error?: string }> {
  if (!isValidModuleDemoId(moduleId)) return { ok: false, error: `例程标识不合法：${String(moduleId)}` };
  const sourceRoot = path.join(options.demoSourceRoot, moduleId);
  try {
    const stat = await fs.stat(path.join(sourceRoot, 'src', 'MainWindow.lcpp'));
    if (!stat.isFile()) throw new Error('例程缺少 src/MainWindow.lcpp');
  } catch {
    return { ok: false, error: `IDE 安装目录中没有模块 ${moduleId} 的例程文件。` };
  }
  const targetRoot = demoWorkspacePath(options, moduleId);
  try {
    await copyMissingFiles(sourceRoot, targetRoot);
    return { ok: true, workspacePath: targetRoot };
  } catch (error) {
    return { ok: false, error: `复制例程工作区失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

export interface ModuleDemoSpawnPlan {
  command: string;
  args: string[];
  /** 传给子进程的完整环境（父环境 + LINGBUILDER_REC_USER_DATA 覆盖）。 */
  env: NodeJS.ProcessEnv;
}

/**
 * 组装「新 IDE 进程打开例程工作区」的启动计划。开发态 Electron 需要显式 app 路径参数，
 * 打包版可执行文件自带默认应用；两个形态都不经过单实例锁（独立 userData）。
 */
export function buildModuleDemoSpawnPlan(input: {
  isPackaged: boolean;
  execPath: string;
  appPath: string;
  workspacePath: string;
  demoUserDataDir: string;
  parentEnv?: NodeJS.ProcessEnv;
}): ModuleDemoSpawnPlan {
  return {
    command: input.execPath,
    args: [
      ...(input.isPackaged ? [] : [input.appPath]),
      '--workspace',
      input.workspacePath
    ],
    env: { ...(input.parentEnv || process.env), LINGBUILDER_REC_USER_DATA: input.demoUserDataDir }
  };
}

/**
 * 打开例程：准备用户工作区副本，再以独立 userData 拉起新 IDE 进程（detached，
 * 主实例退出不影响例程实例）。返回用户工作区路径供 UI 展示。
 */
export async function openModuleDemoInNewInstance(
  options: ModuleDemoServiceOptions,
  moduleId: string,
  spawnPlanInput: { isPackaged: boolean; execPath: string; appPath: string }
): Promise<{ ok: boolean; workspacePath?: string; error?: string }> {
  const prepared = await prepareModuleDemoWorkspace(options, moduleId);
  if (!prepared.ok || !prepared.workspacePath) return prepared;
  const workspacePath = prepared.workspacePath;
  const plan = buildModuleDemoSpawnPlan({
    isPackaged: spawnPlanInput.isPackaged,
    execPath: spawnPlanInput.execPath,
    appPath: spawnPlanInput.appPath,
    workspacePath,
    demoUserDataDir: path.join(options.demoUserDataRoot, moduleId),
    parentEnv: process.env
  });
  try {
    await fs.mkdir(options.demoUserDataRoot, { recursive: true });
    const child = spawn(plan.command, plan.args, {
      env: plan.env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.on('error', error => {
      // detached + unref 后主实例不再等待子进程；失败只能进父实例诊断日志。
      console.warn(`打开例程 ${moduleId} 失败：${error instanceof Error ? error.message : String(error)}`);
    });
    child.unref();
    return { ok: true, workspacePath };
  } catch (error) {
    return { ok: false, error: `启动例程 IDE 失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 只补缺失文件、绝不覆盖目标已有文件（保留用户改动），目录递归。 */
async function copyMissingFiles(sourceRoot: string, targetRoot: string): Promise<void> {
  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      await copyMissingFiles(sourcePath, targetPath);
    } else if (entry.isFile()) {
      try {
        await fs.access(targetPath);
      } catch {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }
}
