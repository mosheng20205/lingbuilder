#!/usr/bin/env node
/**
 * 内嵌 Agent 运行时随包内容门禁。
 *
 * source   （打包前）：electron/agent-runtime/ 必须存在且带 manifest，
 *                      否则 electron-builder 的 extraResources 会因源目录缺失整链失败。
 * unpacked （打包后）：按 manifest 的 bundled 标记核对解包内容 ——
 *                      bundled=true 时必须真实落包 node.exe 与 dsh 入口并版本一致，
 *                      并用随包 node.exe 真跑一次 dsh --version（manifest 记录的裁剪包必须不在包里）；
 *                      bundled=false 时只核对占位说明存在（安装包不携带运行时是允许形态）。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mode = process.argv[2] || 'source';
const electronRoot = path.join(__dirname, '..');
const sourceRoot = path.join(electronRoot, 'agent-runtime');
const unpackedRoot = path.join(electronRoot, 'release', 'win-unpacked', 'resources');

function fail(message) {
  process.stderr.write(`[agent-runtime:verify] ${message}\n`);
  process.exitCode = 1;
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'agent-runtime.json'), 'utf8'));
  } catch (error) {
    fail(`读取 manifest 失败：${path.join(dir, 'agent-runtime.json')}（${error.message}）`);
    return null;
  }
}

/**
 * 真跑一次随包副本：dsh 是 ESM 动态插件树，只有真实 Node 起得来（Electron 当 Node 会整树
 * failed to import），所以「文件在不在」不足以证明可用，必须用随包 node.exe 跑通入口。
 */
function probeRuntime(root, manifest, label) {
  const nodeExe = path.join(root, 'node', manifest.node?.executable || 'node.exe');
  const entry = path.join(root, 'dsh', manifest.dsh?.entry || '');
  const result = spawnSync(nodeExe, [entry, '--version'], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    fail(`${label}：随包 Node 跑不起 dsh 入口（退出码 ${result.status}）：${output.split('\n').pop() || '无输出'}`);
    return;
  }
  if (manifest.dsh?.version && !output.includes(manifest.dsh.version)) {
    fail(`${label}：dsh --version 输出「${output}」与 manifest 版本 ${manifest.dsh.version} 不一致`);
    return;
  }
  const prunedNote = manifest.dsh?.pruned?.length ? `，已裁剪 ${manifest.dsh.pruned.length} 个体积包` : '';
  process.stdout.write(`[agent-runtime:verify] ${label}：随包 Node ${manifest.node?.version} 跑通 dsh ${output}（含 manifest 裁剪核对${prunedNote}）\n`);
}

function checkSource() {
  if (!fs.existsSync(sourceRoot)) {
    fail(`缺少 ${sourceRoot}；打包前必须先执行 npm run prepare:agent-runtime`);
    return;
  }
  const manifest = readManifest(sourceRoot);
  if (!manifest) return;
  for (const dir of ['node', 'dsh']) {
    if (!fs.existsSync(path.join(sourceRoot, dir))) fail(`随包目录缺失：agent-runtime/${dir}`);
  }
  if (manifest.bundled) {
    if (!fs.existsSync(path.join(sourceRoot, 'node', 'node.exe'))) fail('manifest 标记已随包，但 node.exe 不存在');
    const entry = path.join(sourceRoot, 'dsh', manifest.dsh?.entry || 'node_modules');
    if (!fs.existsSync(entry)) fail(`manifest 标记已随包，但 dsh 入口不存在：${entry}`);
    for (const prunedPackage of manifest.dsh?.pruned ?? []) {
      if (fs.existsSync(path.join(sourceRoot, 'dsh', 'node_modules', ...String(prunedPackage).split('/')))) {
        fail(`manifest 记录已裁剪 ${prunedPackage}，但目录仍在（会把安装包体积打回去）`);
      }
    }
    probeRuntime(sourceRoot, manifest, 'source');
  }
  process.stdout.write(`[agent-runtime:verify] source OK（bundled=${manifest.bundled === true ? 'true' : 'false'}）\n`);
}

function checkUnpacked() {
  if (!fs.existsSync(unpackedRoot)) {
    fail(`未找到解包目录：${unpackedRoot}`);
    return;
  }
  const manifest = readManifest(unpackedRoot);
  if (!manifest) return;
  if (manifest.bundled) {
    const nodeExe = path.join(unpackedRoot, 'node', 'node.exe');
    const dshEntry = path.join(unpackedRoot, 'dsh', manifest.dsh?.entry || '');
    if (!fs.existsSync(nodeExe)) fail('安装包未携带 node.exe（manifest 标记为已随包）');
    if (!fs.existsSync(dshEntry)) fail(`安装包未携带 dsh 入口（${dshEntry}）`);
    if (manifest.node?.version !== process.env.LINGBUILDER_AGENT_NODE_VERSION || manifest.dsh?.version !== process.env.LINGBUILDER_AGENT_DSH_VERSION) {
      process.stdout.write('[agent-runtime:verify] 提示：未设版本环境变量，跳过 pin 版本比对\n');
    }
    probeRuntime(unpackedRoot, manifest, 'unpacked');
    process.stdout.write(`[agent-runtime:verify] unpacked OK（Node ${manifest.node?.version} / dsh ${manifest.dsh?.version}，随包已启用）\n`);
    return;
  }
  if (!fs.existsSync(path.join(unpackedRoot, 'agent-runtime.json'))) fail('安装包缺少 agent-runtime.json');
  process.stdout.write('[agent-runtime:verify] unpacked OK（安装包未携带内嵌 Agent 运行时，属允许形态）\n');
}

if (mode === 'source') checkSource();
else if (mode === 'unpacked') checkUnpacked();
else fail(`未知模式 ${mode}，可用：source | unpacked`);
