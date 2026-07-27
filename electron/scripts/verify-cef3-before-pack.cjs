const path = require('node:path');
const { verifySourceSdk } = require('./verify-cef3-release-sdk.cjs');

async function verifyCef3BeforePack(context) {
  const projectRoot = resolveProjectRoot(context);
  const result = await verifySourceSdk(projectRoot);
  console.log(`[CEF3 发布前置校验] ${result.manifest.version} / ${result.inventory.size} 个文件 / ${result.totalBytes} bytes`);
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3BeforePack;
module.exports.default = verifyCef3BeforePack;
module.exports.resolveProjectRoot = resolveProjectRoot;
