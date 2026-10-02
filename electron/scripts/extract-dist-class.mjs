import fs from 'node:fs';

// 从 dist/cli.cjs 提取 B2b 完整态的 windowBaseParts 类文本（权威参照）
const dist = fs.readFileSync('dist/cli.cjs', 'utf8');
const anchor = dist.indexOf('class LingWindowBase {');
console.log('dist 中 class LingWindowBase @', anchor);
// dist 的数组：向前找数组开头（family:"core" 等），向后找数组结尾
// esbuild 可能改写引号：探测 family: 形态
const probeVariants = ['family:"core"', "family:'core'", 'family: "core"'];
let entryRe = null;
for (const v of probeVariants) {
  const re = new RegExp('\\{\\s*' + v.replace(/:/, ':\\s*') + ',\\s*text:\\s*`', 'u');
  if (re.test(dist.slice(Math.max(0, anchor - 3000), anchor + 100))) { entryRe = v; break; }
}
console.log('dist 条目形态:', entryRe);
// 直接从 anchor 向后扫到 "];" 或数组模式结束：找 class 文本的终点 =
// 下一个明确的段边界（工厂段之后的 wWinMain 结尾 `;}）。
// 更稳：从 anchor 向前找最近的 `family:` 前缀的 text 反引号，向后用栈扫描模板闭合链。
