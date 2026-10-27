const fs = require('node:fs');
const path = require('node:path');
const { verifyUnpacked } = require('./verify-on-demand-sdk-release.cjs');

// 把本次真实打包的 win-unpacked（appOutDir）写给 NSIS 编译期量尺。
// installer.nsh 的期望尺寸（LB_EXPECTED_*）必须在编译期从负载 app-64.7z 的同一
// 来源目录实测；写死 release\win-unpacked 时，自定义输出目录（repack-*）会让
// 量尺量到陈旧目录，核对永远失败、安装必然中止（2026-10-27 0.8.36 实锤）。
function writeAppOutDirMarker(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  const markerPath = path.join(electronProjectDir, 'build', 'lb-app-out-dir.txt');
  fs.writeFileSync(markerPath, `LB_APP_OUT_DIR=${context.appOutDir}`, 'utf8');
  console.log(`[安装器量尺锚点] 已写入 ${markerPath} -> ${context.appOutDir}`);
}

async function verifyCef3AfterPack(context) {
  const result = await verifyUnpacked(context.appOutDir);
  console.log(`[严格精简发布后校验] ${result.modules.map(item => item.moduleId).join('、')} 模块目录和 SDK 资源均未随安装包输出。`);
  writeAppOutDirMarker(context);
}

function resolveProjectRoot(context) {
  const electronProjectDir = context?.packager?.projectDir || path.resolve(__dirname, '..');
  return path.resolve(electronProjectDir, '..');
}

module.exports = verifyCef3AfterPack;
module.exports.default = verifyCef3AfterPack;
module.exports.resolveProjectRoot = resolveProjectRoot;
