/**
 * 生成微信OCR模块的生成器注入运行时（scripts/generate-wxocr-runtime.ts）。
 *
 * 唯一事实来源是 electron/native/wxocr/lb_wxocr_core.cpp：
 *   * 原样以 String.raw 模板写入 src/services/windowDesigner/wxOcrRuntime.ts；
 *   * 内容不得含反引号与美元符号花括号序列（String.raw 注入安全红线，生成时校验）。
 * `--check` 模式比对现有文件是否漂移（接入测试门禁）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // electron/
const corePath = path.join(root, 'native', 'wxocr', 'lb_wxocr_core.cpp');
const outPath = path.join(root, 'src', 'services', 'windowDesigner', 'wxOcrRuntime.ts');

function readRuntime(): string {
  const core = fs.readFileSync(corePath, 'utf8').trimEnd() + '\n';
  if (core.includes('`') || core.includes('${')) {
    throw new Error('微信OCR运行时源码含反引号或美元符号花括号序列，String.raw 注入不安全');
  }
  return core;
}

function render(runtime: string): string {
  return `/**
 * 微信OCR模块（lingbuilder.ocr）生成器注入运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/wxocr/lb_wxocr_core.cpp
 * 再生命令：npm run wxocr:runtime（--check 模式供门禁）
 * 注入点：lingCppWin32Project.ts 中 generateWxOcrRuntime(enabledModules)，
 * 模块启用时拼进生成的 C++ 工程（仅 x64 生效，32 位下命令降级为中文错误）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstalledModule } from '../modules/types';

export const WXOCR_MODULE_ID = 'lingbuilder.ocr';

export const WXOCR_RUNTIME = String.raw\`${runtime}\`;

/** 模块启用时返回运行时源码，未启用返回空串。 */
export function generateWxOcrRuntime(enabledModules: InstalledModule[]): string {
  return enabledModules.some(module => module.manifest.id === WXOCR_MODULE_ID) ? WXOCR_RUNTIME : '';
}
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const rendered = render(readRuntime());
  if (check) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (existing !== rendered) {
      console.error('wxOcrRuntime.ts 与 native 源码漂移：请运行 npm run wxocr:runtime 重新生成');
      process.exit(1);
    }
    console.log('wxOcrRuntime.ts 无漂移');
    return;
  }
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`已生成 ${path.relative(root, outPath)}（${rendered.length} 字符）`);
}

main();
