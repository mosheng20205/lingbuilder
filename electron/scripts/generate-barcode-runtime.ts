/**
 * 生成一维条码模块的生成器注入运行时（scripts/generate-barcode-runtime.ts）。
 *
 * 唯一事实来源是 electron/native/barcode/lb_barcode_core.cpp + lb_barcode_win.cpp：
 *   * 两文件拼接后剥掉 [LBBAR-STANDALONE-BEGIN/END] 独立编译垫片；
 *   * 以 String.raw 模板写入 src/services/windowDesigner/barcodeRuntime.ts；
 *   * 内容不得含反引号与 ${（String.raw 注入安全红线，生成时校验）。
 * `--check` 模式比对现有文件是否漂移（接入 vitest 门禁）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // electron/
const corePath = path.join(root, 'native', 'barcode', 'lb_barcode_core.cpp');
const winPath = path.join(root, 'native', 'barcode', 'lb_barcode_win.cpp');
const outPath = path.join(root, 'src', 'services', 'windowDesigner', 'barcodeRuntime.ts');

function readRuntime(): string {
  const core = fs.readFileSync(corePath, 'utf8');
  const win = fs.readFileSync(winPath, 'utf8');
  const standaloneStart = core.indexOf('// [LBBAR-STANDALONE-BEGIN]');
  const standaloneEnd = core.indexOf('// [LBBAR-STANDALONE-END]');
  if (standaloneStart < 0 || standaloneEnd < 0 || standaloneEnd < standaloneStart) {
    throw new Error('lb_barcode_core.cpp 缺少 [LBBAR-STANDALONE-BEGIN/END] 标记');
  }
  const stripped = core.slice(0, standaloneStart) + core.slice(standaloneEnd + '// [LBBAR-STANDALONE-END]'.length);
  const merged = stripped.trimEnd() + '\n\n' + win.trimEnd() + '\n';
  if (merged.includes('`') || merged.includes('${')) {
    throw new Error('一维条码运行时源码含反引号或 ${ 序列，String.raw 注入不安全');
  }
  return merged;
}

function render(runtime: string): string {
  return `/**
 * 一维条码模块（lingbuilder.barcode）生成器注入运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/barcode/lb_barcode_core.cpp + lb_barcode_win.cpp
 * 再生命令：npm run barcode:runtime（--check 模式供门禁）
 * 注入点：lingCppWin32Project.ts 中 generateBarcodeRuntime(enabledModules)，
 * 模块启用时拼进生成的 C++ 工程（x64/win32 通用）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const BARCODE_MODULE_ID = 'lingbuilder.barcode';

export const BARCODE_RUNTIME = String.raw\`${runtime}\`;

/** 模块启用时返回运行时源码，未启用返回空串。 */
export function generateBarcodeRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === BARCODE_MODULE_ID) ? BARCODE_RUNTIME : '';
}
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const rendered = render(readRuntime());
  if (check) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (existing !== rendered) {
      console.error('barcodeRuntime.ts 与 native 源码漂移：请运行 npm run barcode:runtime 重新生成');
      process.exit(1);
    }
    console.log('barcodeRuntime.ts 无漂移');
    return;
  }
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`已生成 ${path.relative(root, outPath)}（${rendered.length} 字符）`);
}

main();
