// 生成 Monaco 专业模式内置界面的简体中文 NLS 数据文件。
//
// monaco-editor 的 ESM 构建在编译后以 `localize(数字索引, "英文兜底")` 形式调用文案，
// 运行时通过 globalThis._VSCODE_NLS_MESSAGES（与索引一一对应的扁平字符串表）提供翻译，
// 缺省回退英文。monaco-editor 0.50+ 的 npm 包在 dev/vs/nls.messages.zh-cn.js.js 中
// 随包分发了与当前版本索引完全一致的官方简体中文扁平表，本脚本将其转换为 TS 数据文件。
//
// 用法：
//   npm run monaco:nls-zh-cn                                    重新生成数据文件
//   node --import tsx scripts/generate-monaco-zh-cn-nls.ts --check   校验数据与安装的 monaco-editor 版本一致（构建门禁调用）
//
// 升级 monaco-editor 后必须重新运行生成脚本，否则 NLS 索引会与数据表错位。

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(scriptDir, '..');
const monacoRoot = path.join(electronRoot, 'node_modules', 'monaco-editor');
const monacoPackageJsonPath = path.join(monacoRoot, 'package.json');
const esmVsRoot = path.join(monacoRoot, 'esm', 'vs');
const zhCnTablePath = path.join(monacoRoot, 'dev', 'vs', 'nls.messages.zh-cn.js.js');
const outputPath = path.join(electronRoot, 'src', 'services', 'monacoNls', 'monacoNlsZhCnMessages.ts');

interface MonacoNlsSnapshot {
  version: string;
  vscodeRef: string;
  messages: Array<string | null>;
  usedIndexCount: number;
  translatedCount: number;
  maxUsedIndex: number;
  anchorChecks: Array<{ english: string; indices: number[]; allChinese: boolean }>;
}

// 抽查锚点：专业模式右键菜单等高频内置文案，生成与校验时都会验证存在中文翻译。
const ANCHOR_ENGLISH_LABELS = [
  'Cut',
  'Copy',
  'Paste',
  'Go to Definition',
  'Go to References',
  'Go to Symbol...',
  'Peek',
  'Rename Symbol',
  'Change All Occurrences',
  'Format Document',
  'Command Palette'
];

const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff]/u;

const LOCALIZE_CALL_PATTERN = /\blocalize2?\(\s*(\d+)\s*,\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/gu;

function collectEsmMessageIndices(): Map<number, string> {
  const indexToEnglish = new Map<number, string>();
  const jsFiles = listJsFilesRecursive(esmVsRoot);
  for (const filePath of jsFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(LOCALIZE_CALL_PATTERN)) {
      const index = Number(match[1]);
      const english = match[2] ?? match[3];
      const existing = indexToEnglish.get(index);
      if (existing !== undefined && existing !== english) {
        throw new Error(`Monaco NLS 索引冲突：索引 ${index} 在 ${path.relative(esmVsRoot, filePath)} 中对应不同的英文文案。`);
      }
      indexToEnglish.set(index, english);
    }
  }
  if (indexToEnglish.size === 0) {
    throw new Error(`Monaco NLS 提取失败：在 ${esmVsRoot} 下未找到任何 localize 调用点。`);
  }
  return indexToEnglish;
}

export { collectEsmMessageIndices, loadZhCnTable, ANCHOR_ENGLISH_LABELS };

function listJsFilesRecursive(rootDir: string): string[] {
  const result: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        result.push(fullPath);
      }
    }
  };
  walk(rootDir);
  return result;
}

function loadZhCnTable(): Array<string | null> {
  if (!fs.existsSync(zhCnTablePath)) {
    throw new Error(`Monaco 中文 NLS 表不存在：${zhCnTablePath}。请确认 node_modules/monaco-editor 已完整安装（需要 dev/vs/nls.messages.zh-cn.js.js）。`);
  }
  const source = fs.readFileSync(zhCnTablePath, 'utf8');
  const sandbox: Record<string, unknown> = {
    // 文件外层是 AMD define 包装，工厂被惰性传入，这里立即调用它触发 globalThis 赋值。
    define: (_moduleName: string, factory: unknown) => {
      if (typeof factory === 'function') (factory as () => void)();
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'nls.messages.zh-cn.js' });
  const captured = sandbox._VSCODE_NLS_MESSAGES;
  if (!Array.isArray(captured)) {
    throw new Error('Monaco 中文 NLS 表解析失败：脚本未设置 globalThis._VSCODE_NLS_MESSAGES。');
  }
  // null 表示官方语言包未翻译该词条，运行时会自动回退英文兜底文案，必须原样保留，
  // 不能转成空字符串（空字符串会被当作有效文案渲染成空白）。
  return captured.map(entry => (typeof entry === 'string' && entry.length > 0 ? entry : null));
}

function buildSnapshot(): MonacoNlsSnapshot {
  if (!fs.existsSync(monacoPackageJsonPath)) {
    throw new Error(`未找到 monaco-editor 安装目录：${monacoRoot}。`);
  }
  const packageJson = JSON.parse(fs.readFileSync(monacoPackageJsonPath, 'utf8')) as { version?: string; vscodeRef?: string };
  if (typeof packageJson.version !== 'string') {
    throw new Error('无法读取 monaco-editor 的版本号（package.json 缺少 version 字段）。');
  }

  const messages = loadZhCnTable();
  const indexToEnglish = collectEsmMessageIndices();

  const missingIndices: number[] = [];
  for (const [index] of indexToEnglish) {
    // 超出表长（undefined）才视为错位；null 是官方未翻译词条，运行时会回退英文。
    if (index >= messages.length || typeof messages[index] === 'undefined') {
      missingIndices.push(index);
    }
  }
  if (missingIndices.length > 0) {
    const preview = missingIndices.slice(0, 10).join(', ');
    throw new Error(`Monaco 中文 NLS 表缺少 ${missingIndices.length} 个已使用索引（如 ${preview}），数据表与 ESM 构建可能不一致，拒绝生成。`);
  }

  const anchorChecks = ANCHOR_ENGLISH_LABELS.map(english => {
    const indices: number[] = [];
    for (const [index, label] of indexToEnglish) {
      if (label === english) indices.push(index);
    }
    return {
      english,
      indices,
      // 锚点是右键菜单等核心文案，官方表必须给出中文翻译（不允许 null 回退英文）。
      allChinese: indices.length > 0 && indices.every(index => typeof messages[index] === 'string' && CJK_PATTERN.test(messages[index] as string))
    };
  });
  const failedAnchors = anchorChecks.filter(check => !check.allChinese).map(check => check.english);
  if (failedAnchors.length > 0) {
    throw new Error(`Monaco 中文 NLS 抽查失败：以下锚点文案缺少中文翻译或索引缺失：${failedAnchors.join('、')}。`);
  }

  return {
    version: packageJson.version,
    vscodeRef: typeof packageJson.vscodeRef === 'string' ? packageJson.vscodeRef : '',
    messages,
    usedIndexCount: indexToEnglish.size,
    translatedCount: indexToEnglish.size === 0 ? 0 : [...indexToEnglish.keys()].filter(index => typeof messages[index] === 'string').length,
    maxUsedIndex: Math.max(...indexToEnglish.keys()),
    anchorChecks
  };
}

function renderSnapshot(snapshot: MonacoNlsSnapshot): string {
  const lines: string[] = [];
  lines.push('// 该文件由 scripts/generate-monaco-zh-cn-nls.ts 自动生成，请勿手工编辑。');
  lines.push(`// 数据来源：node_modules/monaco-editor@${snapshot.version}/dev/vs/nls.messages.zh-cn.js.js（官方简体中文扁平 NLS 表）。`);
  lines.push('// 升级 monaco-editor 后必须重新运行 npm run monaco:nls-zh-cn，否则索引会与数据表错位（构建门禁会拦截）。');
  lines.push('');
  lines.push(`export const MONACO_NLS_SOURCE_VERSION = ${JSON.stringify(snapshot.version)};`);
  lines.push(`export const MONACO_NLS_SOURCE_VSCODE_REF = ${JSON.stringify(snapshot.vscodeRef)};`);
  lines.push('');
  lines.push('export const MONACO_ZH_CN_MESSAGES: readonly (string | null)[] = [');
  for (const message of snapshot.messages) {
    lines.push(`  ${JSON.stringify(message ?? null)},`);
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

export async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const snapshot = buildSnapshot();
  const rendered = renderSnapshot(snapshot);

  if (checkOnly) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (existing !== rendered) {
      throw new Error(
        `Monaco 中文 NLS 数据与安装的 monaco-editor@${snapshot.version} 不一致：请运行 npm run monaco:nls-zh-cn 重新生成（升级 monaco-editor 后索引会变化）。`
      );
    }
    process.stdout.write(
      `Monaco 中文 NLS 校验通过：monaco-editor@${snapshot.version}（vscode ${snapshot.vscodeRef.slice(0, 12)}），数据表 ${snapshot.messages.length} 条，覆盖 ${snapshot.usedIndexCount} 个已使用索引。`
    );
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, 'utf8');
  process.stdout.write(
    `Monaco 中文 NLS 数据已生成：${path.relative(electronRoot, outputPath)}\n` +
    `monaco-editor@${snapshot.version}（vscode ${snapshot.vscodeRef.slice(0, 12)}）：数据表 ${snapshot.messages.length} 条（已使用索引 ${snapshot.usedIndexCount} 个，其中 ${snapshot.translatedCount} 条有中文翻译，其余为官方未翻译回退英文），锚点抽查 ${snapshot.anchorChecks.length} 项全部通过。`
  );
}

// 仅在直接执行时运行主流程；被测试导入时只提供导出函数，不产生副作用。
const invokedDirectly = process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}