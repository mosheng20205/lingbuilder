/**
 * 从 vendored miniz 官方 amalgamated 源码生成 ARCHIVE_MINIZ_INLINE_C 常量。
 *
 * - 真源：electron/native/archive-zlib/{miniz.h,miniz.c,LICENSE}（richgel999/miniz 3.0.2 官方发布包）。
 * - 输出：electron/src/services/windowDesigner/archiveMinizInline.generated.ts
 *   （platformAdvancedRuntime.ts 的 ARCHIVE_RUNTIME blob 在 lingbuilder.archive 启用时内联该 C 源）。
 * - 内联裁剪 define：MINIZ_NO_STDIO / MINIZ_NO_TIME / MINIZ_NO_ZLIB_COMPATIBLE_NAMES
 *   （防止 #define deflate/inflate/crc32 污染生成工程其余 TU）/ MINIZ_NO_ARCHIVE_APIS /
 *   MINIZ_NO_ARCHIVE_WRITING_APIS（ZIP 归档 API 不参与编译，zip 走 tar.exe 既有实现）。
 * - --check 模式：重新生成并与磁盘现有文件逐字比对，不一致即非零退出（构建门禁）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const scriptDir = path.dirname(import.meta.dirname ? import.meta.filename! : '');
const electronRoot = path.resolve(scriptDir, '..');
const vendorDir = path.join(electronRoot, 'native', 'archive-zlib');
const outputFile = path.join(electronRoot, 'src', 'services', 'windowDesigner', 'archiveMinizInline.generated.ts');

const TRIM_DEFINES = [
  '#define MINIZ_NO_STDIO',
  '#define MINIZ_NO_TIME',
  '#define MINIZ_NO_ZLIB_COMPATIBLE_NAMES',
  '#define MINIZ_NO_ARCHIVE_APIS',
  '#define MINIZ_NO_ARCHIVE_WRITING_APIS'
].join('\n');

async function composeInline(): Promise<string> {
  const header = await fs.readFile(path.join(vendorDir, 'miniz.h'), 'utf8');
  let body = await fs.readFile(path.join(vendorDir, 'miniz.c'), 'utf8');
  if (body.includes('\r')) throw new Error('miniz.c 含 CRLF，请先规范化为 LF 再生成。');
  const includeLine = body.split('\n').findIndex(line => line.trim() === '#include "miniz.h"');
  if (includeLine < 0) throw new Error('miniz.c 未找到 #include "miniz.h" 行，发布包形态可能已变化。');
  const bodyLines = body.split('\n').filter((_, index) => index !== includeLine);
  // C→C++：miniz.c 对 s_tdefl_num_probes 用「static 前置声明 + 后置定义」（C tentative 合法，
  // C++ 报 C2086 重定义）。生成期把真定义抬升到前置声明处并删除后置定义。
  const forwardIndex = bodyLines.findIndex(line => line.trim() === 'static const mz_uint s_tdefl_num_probes[11];');
  const definitionIndex = bodyLines.findIndex(line => line.trim().startsWith('static const mz_uint s_tdefl_num_probes[11] ='));
  if (forwardIndex < 0 || definitionIndex < 0 || definitionIndex <= forwardIndex) throw new Error('s_tdefl_num_probes 前置声明/定义形态与预期不符，请人工核查。');
  const definition = bodyLines[definitionIndex];
  body = bodyLines
    .map((line, index) => (index === forwardIndex ? definition : line))
    .filter((_, index) => index !== definitionIndex)
    .join('\n');
  for (const [label, text] of [['miniz.h', header], ['miniz.c', body]] as const) {
    if (!/^[\x00-\x7f]*$/u.test(text)) throw new Error(`${label} 内联源码出现非 ASCII 字符，请人工核查。`);
  }
  const composed = [
    '// ===== LingBuilder vendored miniz 3.0.2（公共域/Unlicense，随包 LICENSE，勿手改；npm run archive:miniz 重新生成）=====',
    TRIM_DEFINES,
    header.trimEnd(),
    body.trimEnd(),
    '// ===== end miniz ====='
  ].join('\n');
  if (composed.includes('`') || composed.includes('${')) throw new Error('miniz 内联源码含模板字面量敏感序列。');
  return composed;
}

function renderModule(composed: string): string {
  return [
    '// 本文件由 scripts/generate-archive-zlib-miniz.ts 自动生成，请勿手改。',
    '// 真源：electron/native/archive-zlib/{miniz.h,miniz.c,LICENSE}（richgel999/miniz 3.0.2 官方 amalgamated 发布包）。',
    '// 消费方：src/services/windowDesigner/platformAdvancedRuntime.ts 的 ARCHIVE_RUNTIME blob（lingbuilder.archive 启用时内联）。',
    '// 重新生成：cd electron && npm run archive:miniz；构建门禁：npm run build 内的 archive:miniz:check。',
    `export const ARCHIVE_MINIZ_INLINE_C = ${JSON.stringify(composed)};`,
    ''
  ].join('\n');
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const rendered = renderModule(await composeInline());
  const existing = await fs.readFile(outputFile, 'utf8').catch(() => null);
  if (existing === rendered) {
    console.log('[archive:miniz] 生成产物与 vendored miniz 源一致。');
    return;
  }
  if (checkOnly) {
    console.error('[archive:miniz] 生成产物与 vendored miniz 源不一致：请运行 npm run archive:miniz 重新生成。');
    process.exitCode = 1;
    return;
  }
  await fs.writeFile(outputFile, rendered, 'utf8');
  console.log(`[archive:miniz] 已生成 ${path.relative(electronRoot, outputFile)}（${(rendered.length / 1024).toFixed(1)} KB）。`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
