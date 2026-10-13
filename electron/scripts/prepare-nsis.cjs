#!/usr/bin/env node
/**
 * 打包前准备 NSIS（makensis）：把本机已有的 NSIS 发行版整理到 third_party/nsis/，
 * 供 electron-builder extraResources 随包分发（运行时解析链首选 resources/nsis）。
 *
 * 来源优先级：LINGBUILDER_NSIS_PATH 环境变量 → %LOCALAPPDATA%/tauri/NSIS →
 * %LOCALAPPDATA%/electron-builder/Cache/nsis/nsis-*。都没有时报中文错误并退出 1。
 *
 * 用法：node scripts/prepare-nsis.cjs [--force]（默认目标已存在时跳过，幂等）。
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const targetDir = path.join(__dirname, '..', 'third_party', 'nsis');
const force = process.argv.includes('--force');

function collectCandidates() {
  const candidates = [];
  if (process.env.LINGBUILDER_NSIS_PATH) {
    candidates.push(process.env.LINGBUILDER_NSIS_PATH);
  }
  const localAppData = process.env.LOCALAPPDATA || '';
  if (localAppData) {
    candidates.push(path.join(localAppData, 'tauri', 'NSIS'));
    const electronBuilderCache = path.join(localAppData, 'electron-builder', 'Cache', 'nsis');
    try {
      const versions = fs.readdirSync(electronBuilderCache, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith('nsis-'))
        .map(entry => entry.name)
        .sort()
        .reverse();
      for (const version of versions) {
        candidates.push(path.join(electronBuilderCache, version));
      }
    } catch {
      // 缓存目录不存在，跳过。
    }
  }
  return candidates.filter(Boolean);
}

async function main() {
  const targetMakensis = path.join(targetDir, 'makensis.exe');
  if (!force && fs.existsSync(targetMakensis)) {
    console.log(`[prepare-nsis] 已存在 ${targetMakensis}，跳过（--force 可强制刷新）。`);
    return;
  }
  for (const candidate of collectCandidates()) {
    const sourceMakensis = path.join(candidate, 'makensis.exe');
    if (!fs.existsSync(sourceMakensis)) continue;
    await fsp.mkdir(path.dirname(targetDir), { recursive: true });
    await fsp.rm(targetDir, { recursive: true, force: true });
    await fsp.cp(candidate, targetDir, { recursive: true });
    if (!fs.existsSync(targetMakensis)) {
      console.error(`[prepare-nsis] 来源 ${candidate} 没有 makensis.exe，已跳过。`);
      continue;
    }
    const licenseSrc = path.join(candidate, 'COPYING');
    if (fs.existsSync(licenseSrc)) {
      await fsp.copyFile(licenseSrc, path.join(targetDir, 'COPYING'));
    }
    console.log(`[prepare-nsis] 已从 ${candidate} 复制 NSIS 到 ${targetDir}`);
    return;
  }
  console.error(
    '[prepare-nsis] 未找到可用的 NSIS 发行版（makensis.exe）。修法任选其一：\n' +
    '  ① 设置环境变量 LINGBUILDER_NSIS_PATH 指向包含 makensis.exe 的目录；\n' +
    '  ② 安装 NSIS 3（https://nsis.sourceforge.io）后重跑；\n' +
    '  ③ 用 electron-builder/Tauri 打包过任意应用后重跑（复用其 NSIS 缓存）。'
  );
  process.exit(1);
}

main().catch(error => {
  console.error(`[prepare-nsis] 失败：${error && error.message ? error.message : error}`);
  process.exit(1);
});
