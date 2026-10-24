/**
 * 生成 PDF 写出器运行时（scripts/generate-pdfwriter-runtime.ts）。
 *
 * 唯一事实来源是 electron/native/pdf-writer/lb_pdfwrite.h：
 *   * 剥掉头文件保护（#ifndef/#define/#endif）后以 String.raw 模板写入
 *     src/services/windowDesigner/pdfWriterRuntime.ts；
 *   * Excel_导出PDF 等运行时实现的命令在生成代码里直接调用 lbpdf:: 接口；
 *   * 内容不得含反引号与 ${（String.raw 注入安全红线，生成时校验）。
 * `--check` 模式比对现有文件是否漂移（接入 vitest 门禁）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // electron/
const headerPath = path.join(root, 'native', 'pdf-writer', 'lb_pdfwrite.h');
const outPath = path.join(root, 'src', 'services', 'windowDesigner', 'pdfWriterRuntime.ts');

function readRuntime(): string {
  const source = fs.readFileSync(headerPath, 'utf8');
  const ifndef = source.indexOf('#ifndef LB_PDFWRITE_H');
  const define = source.indexOf('#define LB_PDFWRITE_H');
  const endif = source.lastIndexOf('#endif // LB_PDFWRITE_H');
  if (ifndef < 0 || define < 0 || endif < 0 || endif < define) {
    throw new Error('lb_pdfwrite.h 缺少头文件保护标记');
  }
  const body = (source.slice(0, ifndef) + source.slice(define + '#define LB_PDFWRITE_H'.length, endif)).trimEnd() + '\n';
  if (body.includes('`') || body.includes('${')) {
    throw new Error('PDF 写出器源码含反引号或 ${ 序列，String.raw 注入不安全');
  }
  return body;
}

function render(runtime: string): string {
  return `/**
 * PDF 写出器运行时——本文件由脚本生成，禁止手改。
 *
 * 事实来源：electron/native/pdf-writer/lb_pdfwrite.h
 * 再生命令：npm run pdfwriter:runtime（--check 模式供门禁）
 * 注入点：dataMediaRuntime.ts 在 Excel 等需要「运行时直接写 PDF」的模块启用时拼接；
 * word-bridge 等桥 DLL 场景不走本文件（DLL 直接编译头文件）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PDF_WRITER_RUNTIME = String.raw\`${runtime}\`;
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const rendered = render(readRuntime());
  if (check) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (existing !== rendered) {
      console.error('pdfWriterRuntime.ts 与 native 头文件漂移：请运行 npm run pdfwriter:runtime 重新生成');
      process.exit(1);
    }
    console.log('pdfWriterRuntime.ts 无漂移');
    return;
  }
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`已生成 ${path.relative(root, outPath)}（${rendered.length} 字符）`);
}

main();
