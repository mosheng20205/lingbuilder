const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Monaco 中文 NLS 数据门禁：确保随包语言表与当前安装的 monaco-editor 版本索引一致。
// 升级 monaco-editor 后若未重跑 npm run monaco:nls-zh-cn，在这里阻断构建。
try {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', path.join(__dirname, 'generate-monaco-zh-cn-nls.ts'), '--check'],
    { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
  );
} catch {
  throw new Error('Monaco 本地构建校验失败：中文 NLS 数据与 monaco-editor 版本不一致，请运行 npm run monaco:nls-zh-cn 重新生成。');
}

const distRoot = path.resolve(__dirname, '..', 'dist');
const assetsRoot = path.join(distRoot, 'assets');

if (!fs.existsSync(assetsRoot)) {
  throw new Error('Monaco 本地构建校验失败：dist/assets 不存在。');
}

const assets = fs.readdirSync(assetsRoot);
const requiredAssets = [
  { label: '核心编辑器 Worker', pattern: /^editor\.worker-.*\.js$/u },
  { label: 'C/C++ 基础语言包', pattern: /^cpp-.*\.js$/u },
  { label: 'INI/资源文件基础语言包', pattern: /^ini-.*\.js$/u }
];

for (const required of requiredAssets) {
  if (!assets.some(fileName => required.pattern.test(fileName))) {
    throw new Error(`Monaco 本地构建校验失败：缺少${required.label}。`);
  }
}

const indexHtml = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
if (/<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//iu.test(indexHtml)) {
  throw new Error('Monaco 本地构建校验失败：入口 HTML 仍引用外部脚本或样式。');
}

process.stdout.write(`Monaco 本地构建校验通过：${requiredAssets.length} 类资源均已随安装包输出。\n`);
