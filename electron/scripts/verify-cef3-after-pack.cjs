const path = require('node:path');
const { verifyUnpacked } = require('./verify-on-demand-sdk-release.cjs');

async function verifyCef3AfterPack(context) {
  const result = await verifyUnpacked(context.appOutDir);
  console.log(`[SDK 按需下载发布后校验] ${result.modules.map(item => item.moduleId).join('、')} 仅保留轻量元数据，未夹带 sdk/。`);
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3AfterPack;
module.exports.default = verifyCef3AfterPack;
module.exports.resolveProjectRoot = resolveProjectRoot;
