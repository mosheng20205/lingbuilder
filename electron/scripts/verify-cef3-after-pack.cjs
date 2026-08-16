const path = require('node:path');
const { verifyUnpacked } = require('./verify-on-demand-sdk-release.cjs');

async function verifyCef3AfterPack(context) {
  const result = await verifyUnpacked(context.appOutDir);
  console.log(`[严格精简发布后校验] ${result.modules.map(item => item.moduleId).join('、')} 模块目录和 SDK 资源均未随安装包输出。`);
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3AfterPack;
module.exports.default = verifyCef3AfterPack;
module.exports.resolveProjectRoot = resolveProjectRoot;
