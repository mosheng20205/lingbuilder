/**
 * 生成 docs/modules/内嵌C++替代对照表.md（批⑤，2026-09-27）。
 * 内容唯一来源是 src/services/lingCpp/inlineCppKnowledge.ts 的替代知识表；
 * 用法：npx tsx scripts/generate-inline-cpp-api-map.ts [--check]
 * --check 模式不写盘，只校验文档与知识表一致（退出码 1 表示需要重新生成）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildInlineCppApiMapMarkdown, INLINE_CPP_API_MAP_DOC_PATH } from '../src/services/lingCpp/inlineCppKnowledge';

const appRoot = path.resolve(import.meta.dirname ?? process.cwd(), '..');
const docPath = path.join(appRoot, INLINE_CPP_API_MAP_DOC_PATH);
const content = buildInlineCppApiMapMarkdown();

if (process.argv.includes('--check')) {
  const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  if (existing === content) {
    console.log(`[OK] ${INLINE_CPP_API_MAP_DOC_PATH} 与替代知识表一致（${INLINE_CPP_API_MAP_DOC_PATH}）。`);
  } else {
    console.error(`[需要重新生成] ${INLINE_CPP_API_MAP_DOC_PATH} 与替代知识表不一致：请运行 npx tsx scripts/generate-inline-cpp-api-map.ts`);
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, content, 'utf8');
  console.log(`[已生成] ${docPath}（${content.split('\n').length} 行）`);
}
