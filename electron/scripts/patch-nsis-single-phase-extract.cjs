/**
 * electron-builder NSIS 模板「单阶段直解」补丁（打包链自动维护，勿手工改 node_modules）。
 *
 * 背景（2026-10-25 真机实锤）：app-builder-lib 26.x 的 extractUsing7za 先把 app-64.7z
 * 解压到 $PLUGINSDIR\7z-out，再用 CopyFiles 全量复制到安装目录——1.1GB 载荷要写两遍读一遍
 * （约 3.3GB I/O），且 CopyFiles 不驱动进度条，安装尾部在 ~90% 处长期冻结（用户感知为卡死）。
 *
 * 本补丁把该宏改为直接解压到 $OUTDIR（installSection 已 SetOutPath $INSTDIR）：
 * - I/O 约降 6 成，安装整体提速约一半（HDD 收益更大）；
 * - Nsis7z 全程驱动进度条，「卡在 90%」消失；
 * - 被占用文件会被 Nsis7z 静默跳过 → 由 electron/installer/installer.nsh 的
 *   期望尺寸核对（LB_EXPECTED_*，scripts/verify-cef3-after-pack.cjs 打包期生成）
 *   + 改名让位修复循环兜底，保持原有「半更新防护」语义。
 *
 * 运行时机：verify-cef3-before-pack.cjs（beforePack 钩子）每次打包前调用，npm ci 后自愈。
 * 幂等：已打过补丁（含标记注释）直接跳过；模板内容漂移（上游升级改写该宏）时 loudly 失败，
 * 阻断打包并要求人工复核，绝不静默打出与预期不符的安装器。
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PATCH_MARKER = '[LingBuilder 单阶段直解补丁]';

// 原模板宏的关键锚点：出现任一缺失即视为上游模板漂移，拒绝打补丁。
const ORIGINAL_ANCHORS = [
  'CreateDirectory "$PLUGINSDIR\\7z-out"',
  'SetOutPath "$PLUGINSDIR\\7z-out"',
  'Nsis7z::Extract "${FILE}"',
  'CopyFiles /SILENT "$PLUGINSDIR\\7z-out\\*" $OUTDIR',
];

function resolveTemplateFile() {
  return path.resolve(__dirname, '..', 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'include', 'extractAppPackage.nsh');
}

function buildPatchedMacro(eol) {
  const lines = [
    '!macro extractUsing7za FILE',
    `  ; ${PATCH_MARKER} —— 由 scripts/patch-nsis-single-phase-extract.cjs 维护，勿手改。`,
    '  ; 原模板把 7z 先解压到 $PLUGINSDIR\\7z-out、再用 CopyFiles 全量复制到安装目录：',
    '  ; 载荷要写两遍读一遍，且 CopyFiles 不驱动进度条，安装尾部长期冻结（用户感知为卡死）。',
    '  ; 这里直接解压到 $OUTDIR（即安装目录）：I/O 约降 6 成，进度条由 Nsis7z 全程驱动。',
    '  ; 被占用文件会被 Nsis7z 静默跳过，由 installer.nsh 期望尺寸核对 + 改名让位修复循环兜底。',
    '  Push $OUTDIR',
    '  Nsis7z::Extract "${FILE}"',
    '  Pop $R0',
    '  SetOutPath $R0',
    '!macroend',
  ];
  return lines.join(eol);
}

/** 确保模板已打补丁；返回 { patched: boolean, alreadyPatched: boolean, file }。失败抛中文异常。 */
function ensureNsisSinglePhaseExtractPatch() {
  const file = resolveTemplateFile();
  if (!fs.existsSync(file)) {
    throw new Error(`未找到 electron-builder NSIS 模板：${file}。请确认 app-builder-lib 已安装（npm install）。`);
  }
  const original = fs.readFileSync(file, 'utf8');
  if (original.includes(PATCH_MARKER)) {
    return { patched: false, alreadyPatched: true, file };
  }

  const start = original.indexOf('!macro extractUsing7za FILE');
  if (start < 0) {
    throw new Error('electron-builder NSIS 模板已变化：未找到 extractUsing7za 宏。请人工复核后更新 scripts/patch-nsis-single-phase-extract.cjs。');
  }
  const end = original.indexOf('!macroend', start);
  if (end < 0) {
    throw new Error('electron-builder NSIS 模板已变化：extractUsing7za 宏未正常闭合。请人工复核。');
  }
  const macroEnd = end + '!macroend'.length;
  const block = original.slice(start, macroEnd);
  for (const anchor of ORIGINAL_ANCHORS) {
    if (!block.includes(anchor)) {
      throw new Error(`electron-builder NSIS 模板已变化：extractUsing7za 宏缺少锚点「${anchor}」。上游实现可能已调整（两段式解压语义或已变更），请人工复核后更新补丁脚本。`);
    }
  }

  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const patched = original.slice(0, start) + buildPatchedMacro(eol) + original.slice(macroEnd);
  fs.writeFileSync(file, patched, 'utf8');
  return { patched: true, alreadyPatched: false, file };
}

module.exports = { ensureNsisSinglePhaseExtractPatch, PATCH_MARKER };
module.exports.default = module.exports;

if (require.main === module) {
  try {
    const result = ensureNsisSinglePhaseExtractPatch();
    if (result.alreadyPatched) {
      console.log('[NSIS 单阶段直解补丁] 已在位，跳过。');
      process.exit(0);
    }
    console.log(`[NSIS 单阶段直解补丁] 已应用：${result.file}`);
  } catch (error) {
    console.error(`[NSIS 单阶段直解补丁] 失败：${error.message}`);
    process.exit(1);
  }
}
