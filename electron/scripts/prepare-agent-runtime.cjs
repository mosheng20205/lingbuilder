#!/usr/bin/env node
/**
 * 为「面板内嵌 Agent 运行时」准备随包依赖：真实 Node 发行包 + dsh（DeepSeek Harness）。
 *
 * 为什么必须随包 Node：dsh 是 ESM 动态插件树，实测在 ELECTRON_RUN_AS_NODE 下整树
 * `failed to import`，所以宿主必须是真实 Node（^22.19 || >=24）；我们自己的单文件
 * CJS cli.cjs 才可以用 Electron 当 Node。
 *
 * 默认随包分发（打包链已接入）；设 LINGBUILDER_AGENT_RUNTIME_BUNDLE=0 可跳过下载，
 * 此时运行时解析回落到 PATH 上的 Node，解析不到面板只给中文诊断。
 * 下载/安装失败不阻断打包：整体回落到占位目录并在 manifest 记 bundleProblem，
 * 因为内嵌 Agent 是增强能力，不能把它变成整个 IDE 出包的硬依赖。
 *   resources/node/  ← nodejs.org 官方 win-x64 发行包（按 SHASUMS256 校验）
 *   resources/dsh/   ← npm 固定版本安装（无 postinstall、无原生依赖、无 os/cpu 限制）
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const NODE_VERSION = process.env.LINGBUILDER_AGENT_NODE_VERSION || '24.20.0';
const DSH_VERSION = process.env.LINGBUILDER_AGENT_DSH_VERSION || '0.1.6-alpha.2';
const NODE_ARCHIVE = `node-v${NODE_VERSION}-win-x64.zip`;
/**
 * 官方站优先，镜像回落：本机对 nodejs.org 的直连会超时（npm registry 正常），
 * 只留官方源会让打包机随机卡在这一步。SHA-256 仍按 SHASUMS256.txt 校验，
 * 实际使用的来源会记进 manifest，便于事后核对供应链。
 */
const NODE_SOURCES = [
  'https://nodejs.org/dist',
  'https://cdn.npmmirror.com/binaries/node',
  'https://registry.npmmirror.com/-/binary/node'
];
const RESOURCE_ROOT = path.join(__dirname, '..', 'agent-runtime');
const NODE_TARGET = path.join(RESOURCE_ROOT, 'node');
const DSH_TARGET = path.join(RESOURCE_ROOT, 'dsh');
const MANIFEST_PATH = path.join(RESOURCE_ROOT, 'agent-runtime.json');
const BUNDLE = process.env.LINGBUILDER_AGENT_RUNTIME_BUNDLE !== '0';
/**
 * 安装后裁剪掉的 dsh 传递依赖：`dsh-office-to-pdf → libreoffice-kit → 平台原生包`，
 * 单这一个包就占 329MB（整个 dsh 树 550MB）。`libreoffice-kit/lib/index.js` 只在真正
 * 做 Office→PDF 转换时才惰性解析该原生包，缺失只影响那条转换命令，插件导入不受影响；
 * LingBuilder 内嵌场景只做代码编辑，永远用不到它。
 */
const DSH_PRUNED_PACKAGES = ['@deepseek-ai/libreoffice-kit-win32-x64'];

function log(message) {
  process.stdout.write(`[agent-runtime] ${message}\n`);
}

function fail(message) {
  throw new Error(`[agent-runtime] ${message}`);
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
      else total += 1;
    }
  }
  return total;
}

function dirBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else total += fs.statSync(target).size;
    }
  }
  return total;
}

async function fetchOne(url) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    // 本机 Node fetch 对部分外网链路不稳（历史踩坑），同一 URL 回落到 curl.exe。
    log(`fetch ${url} 失败（${error.message}），改用 curl`);
    return execFileSync('curl.exe', ['-fsSL', '--connect-timeout', '15', '--retry', '2', '--retry-delay', '2', url], {
      maxBuffer: 1024 * 1024 * 512
    });
  }
}

/** 依次尝试多个来源；全部失败才报错，并回报每个来源的失败原因。 */
async function fetchFirstSource(urls) {
  const failures = [];
  for (const url of urls) {
    try {
      const buffer = await fetchOne(url);
      return { buffer, source: new URL(url).host };
    } catch (error) {
      failures.push(`${new URL(url).host}: ${error.message.split('\n')[0]}`);
    }
  }
  fail(`所有来源都取不到（${urls[0].split('/').pop()}）：${failures.join('；')}`);
  return null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeStub(dir, description) {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'README.txt'), `${description}\n`, 'utf8');
}

/**
 * 必须用绝对路径取系统 bsdtar：Git Bash 的 GNU tar 会抢在 PATH 前面，
 * 而 GNU tar 把 `C:\...` 当成「远程主机:路径」，报 Cannot connect to C。
 */
function systemTar() {
  const root = process.env.SystemRoot || 'C:\\Windows';
  const candidate = path.join(root, 'System32', 'tar.exe');
  return fs.existsSync(candidate) ? candidate : 'tar.exe';
}

async function installNode() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingbuilder-node-'));
  try {
    const archive = path.join(workDir, NODE_ARCHIVE);
    log(`下载 Node v${NODE_VERSION} win-x64（官方站优先，镜像回落）`);
    const downloaded = await fetchFirstSource(NODE_SOURCES.map(base => `${base}/v${NODE_VERSION}/${NODE_ARCHIVE}`));
    fs.writeFileSync(archive, downloaded.buffer);
    const sums = (await fetchFirstSource(NODE_SOURCES.map(base => `${base}/v${NODE_VERSION}/SHASUMS256.txt`))).buffer.toString('utf8');
    const expected = new RegExp(`^([0-9a-f]{64})\\s+${NODE_ARCHIVE.replace(/\./g, '\\.')}$`, 'mu').exec(sums)?.[1];
    if (!expected) fail(`SHASUMS256.txt 里没有 ${NODE_ARCHIVE}，拒绝使用未校验的发行包`);
    const actual = sha256File(archive);
    if (actual !== expected) fail(`Node 发行包 SHA-256 不匹配：期望 ${expected}，实际 ${actual}`);
    log(`SHA-256 校验通过 ${actual.slice(0, 16)}…（来源 ${downloaded.source}）`);
    const extractDir = path.join(workDir, 'extract');
    ensureDir(extractDir);
    // Windows 10+ 自带 bsdtar，可直接解 zip；避免引入额外解压依赖。
    execFileSync(systemTar(), ['-xf', archive, '-C', extractDir], { stdio: 'inherit' });
    const unpacked = path.join(extractDir, `node-v${NODE_VERSION}-win-x64`);
    if (!fs.existsSync(path.join(unpacked, 'node.exe'))) fail(`解压后未找到 node.exe：${unpacked}`);
    fs.rmSync(NODE_TARGET, { recursive: true, force: true });
    fs.cpSync(unpacked, NODE_TARGET, { recursive: true });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  return {
    version: NODE_VERSION,
    executable: 'node.exe',
    source: NODE_SOURCES.join(','),
    sha256: sha256File(path.join(NODE_TARGET, 'node.exe')),
    fileCount: countFiles(NODE_TARGET),
    bytes: dirBytes(NODE_TARGET)
  };
}

/** 删除随包 dsh 树里与内嵌场景无关的体积包，返回实际删除的相对路径。 */
function pruneDshPackages() {
  const removed = [];
  for (const packageName of DSH_PRUNED_PACKAGES) {
    const target = path.join(DSH_TARGET, 'node_modules', ...packageName.split('/'));
    if (!fs.existsSync(target)) continue;
    const bytes = dirBytes(target);
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(packageName);
    log(`裁剪 ${packageName}（释放 ${(bytes / 1048576).toFixed(1)}MB）`);
  }
  return removed;
}

function installDsh() {
  fs.rmSync(DSH_TARGET, { recursive: true, force: true });
  ensureDir(DSH_TARGET);
  fs.writeFileSync(path.join(DSH_TARGET, 'package.json'), JSON.stringify({
    name: 'lingbuilder-agent-runtime-dsh',
    version: '1.0.0',
    private: true,
    description: 'LingBuilder 随包 DeepSeek Harness 运行时（由 scripts/prepare-agent-runtime.cjs 生成）'
  }, null, 2) + '\n', 'utf8');
  log(`npm 安装 @deepseek-ai/dsh@${DSH_VERSION}`);
  // Node 24 的 spawnSync 不能直接执行 .cmd（EINVAL），npm 在 Windows 上就是 npm.cmd，
  // 因此必须走 shell；参数全是脚本内常量，不拼接任何外部输入。
  const install = require('node:child_process').spawnSync(
    `npm.cmd install --no-audit --no-fund --ignore-scripts @deepseek-ai/dsh@${DSH_VERSION}`,
    { cwd: DSH_TARGET, stdio: 'inherit', shell: true, windowsHide: true }
  );
  if (install.status !== 0) fail(`npm 安装 dsh 失败（退出码 ${install.status}）：${install.error?.message || install.stderr || '见上方 npm 输出'}`);
  const binPath = path.join(DSH_TARGET, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  if (!fs.existsSync(binPath)) fail(`安装后未找到 dsh 入口：${binPath}`);
  const pruned = pruneDshPackages();
  return {
    version: DSH_VERSION,
    entry: path.join('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js').replace(/\\/g, '/'),
    pruned,
    fileCount: countFiles(DSH_TARGET),
    bytes: dirBytes(DSH_TARGET)
  };
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  ensureDir(RESOURCE_ROOT);
  const existing = readManifest();
  const alreadyBundled = existing?.bundled === true
    && existing?.node?.version === NODE_VERSION
    && existing?.dsh?.version === DSH_VERSION
    && fs.existsSync(path.join(NODE_TARGET, 'node.exe'))
    && fs.existsSync(path.join(DSH_TARGET, 'node_modules'));
  if (BUNDLE && alreadyBundled) {
    // 已随包但裁剪步骤是后加的（或裁剪清单变化）：补裁剪并刷新 manifest，不重跑下载。
    if (DSH_PRUNED_PACKAGES.some(pkg => !existing.dsh.pruned?.includes(pkg))) {
      pruneDshPackages();
      existing.dsh.pruned = DSH_PRUNED_PACKAGES.filter(pkg => !fs.existsSync(path.join(DSH_TARGET, 'node_modules', ...pkg.split('/'))));
      existing.dsh.fileCount = countFiles(DSH_TARGET);
      existing.dsh.bytes = dirBytes(DSH_TARGET);
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    }
    log(`已随包（Node ${NODE_VERSION} / dsh ${DSH_VERSION}），跳过重复下载`);
    return;
  }
  if (!BUNDLE) {
    writeStubManifest('显式关闭随包（LINGBUILDER_AGENT_RUNTIME_BUNDLE=0）');
    return;
  }
  let manifest;
  try {
    manifest = { bundled: true, generatedAt: new Date().toISOString(), node: await installNode(), dsh: installDsh() };
  } catch (error) {
    // 内嵌 Agent 是增强能力：取不到运行时只降级为占位目录 + 中文告警，不得让打包整链失败。
    const problem = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[agent-runtime] 警告：随包运行时准备失败，安装包将不携带内嵌 Agent 运行时（面板会提示「未找到可用的 Node 运行时」）：${problem}\n`);
    writeStubManifest(problem);
    return;
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  log(`完成：Node ${manifest.node.fileCount} 个文件 ${(manifest.node.bytes / 1048576).toFixed(1)}MB，dsh ${manifest.dsh.fileCount} 个文件 ${(manifest.dsh.bytes / 1048576).toFixed(1)}MB`);
}

/** 写占位目录与 bundled=false 的 manifest（清理真实运行时，避免体积与 manifest 不一致）。 */
function writeStubManifest(problem) {
  for (const dir of [NODE_TARGET, DSH_TARGET]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  writeStub(NODE_TARGET, 'LingBuilder 内嵌 Agent 运行时的随包 Node 目录（当前未随包）。');
  writeStub(DSH_TARGET, 'LingBuilder 内嵌 Agent 运行时的随包 dsh 目录（当前未随包）。');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
    bundled: false,
    generatedAt: new Date().toISOString(),
    note: '安装包未携带 Node 与 dsh：运行时解析回落 PATH 上的 Node，取不到则面板给中文诊断。',
    problem,
    pinned: { nodeVersion: NODE_VERSION, dshVersion: DSH_VERSION }
  }, null, 2) + '\n', 'utf8');
  log(`已写入占位目录与 manifest（未随包：${problem}）`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
