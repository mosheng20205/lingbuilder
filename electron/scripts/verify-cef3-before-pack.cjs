const path = require('node:path');
const { verifySourceSdk } = require('./verify-cef3-release-sdk.cjs');
const { ensureNsisSinglePhaseExtractPatch } = require('./patch-nsis-single-phase-extract.cjs');

async function verifyCef3BeforePack(context) {
  const projectRoot = resolveProjectRoot(context);
  const result = await verifySourceSdk(projectRoot);
  console.log(`[CEF3 发布前置校验] ${result.manifest.version} / ${result.inventory.size} 个文件 / ${result.totalBytes} bytes`);
  // npm ci / 升级 electron-builder 后 node_modules 模板会被还原，打包前自愈补丁
  // （单阶段直解：消除「解压到临时目录→CopyFiles 全量复制」的双倍 I/O 与尾部假死）。
  const patchResult = ensureNsisSinglePhaseExtractPatch();
  if (patchResult.patched) {
    console.log('[NSIS 单阶段直解补丁] 已应用（模板此前未打补丁）。');
  }
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3BeforePack;
module.exports.default = verifyCef3BeforePack;
module.exports.resolveProjectRoot = resolveProjectRoot;
