const path = require('node:path');
const { verifyPackagedDirectory } = require('./verify-cef3-release-sdk.cjs');

async function verifyCef3AfterPack(context) {
  const projectRoot = resolveProjectRoot(context);
  const result = await verifyPackagedDirectory(context.appOutDir, projectRoot);
  console.log(`[CEF3 发布后校验] ${result.manifest.version} / ${result.inventory.size} 个文件 / CRC32 全部一致`);
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3AfterPack;
module.exports.default = verifyCef3AfterPack;
module.exports.resolveProjectRoot = resolveProjectRoot;
