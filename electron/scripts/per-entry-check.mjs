import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const src = fs.readFileSync('src/services/windowDesigner/lingCppWin32Project.ts', 'utf8');
const arrStart = src.indexOf('const windowBaseParts');
const declEnd = src.indexOf('[\n', arrStart) + 2;
const arrEnd = src.indexOf('\n  ];', arrStart);
const entriesText = src.slice(declEnd, arrEnd + 1);
const re = /^    \{ family: '/gmu;
const starts = [];
let m;
while ((m = re.exec(entriesText)) !== null) starts.push(m.index);
const entryTexts = starts.map((s, i) => entriesText.slice(s, i + 1 < starts.length ? starts[i + 1] : entriesText.length));

const bad = [];
for (let i = 0; i < entryTexts.length; i++) {
  const tmp = path.resolve('.probe-one.ts');
  fs.writeFileSync(tmp, 'const a: Array<{ family: string; text: string }> = [\n' + entryTexts[i] + '];\n', 'utf8');
  try {
    execFileSync(process.execPath, [path.resolve('node_modules', 'esbuild', 'bin', 'esbuild'), tmp, '--loader:.ts=ts', '--outfile=/dev/null'], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    bad.push(i + 1);
    console.log(`❌ 条目 ${i + 1} 单独编译失败，开头: ${JSON.stringify(entryTexts[i].slice(0, 110))}`);
  }
}
fs.rmSync(path.resolve('.probe-one.ts'), { force: true });
console.log(bad.length ? `损坏条目: ${bad.join(', ')}` : '全部条目单独编译通过');
