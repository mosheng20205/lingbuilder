// 校验演示输出：scan-report.txt / scan-hits.json / scan-regions.json / scan-pids.json。
// 用法：node verify.mjs <构建输出 bin 目录>；全部断言通过输出 ALL-PASS。
import fs from 'node:fs';
import path from 'node:path';

const binDir = process.argv[2];
if (!binDir) {
  console.error('用法：node verify.mjs <bin 目录>');
  process.exit(2);
}
const read = name => fs.readFileSync(path.join(binDir, name), 'utf8');
const failures = [];
function check(cond, label) {
  if (!cond) failures.push(label);
}

const report = read('scan-report.txt');
const fields = new Map(report.trim().split(/\s+(?=[^\s]+=[^\s])/u).map(piece => {
  const eq = piece.indexOf('=');
  return [piece.slice(0, eq), piece.slice(eq + 1)];
}));
// 兼容格式化文本输出：直接按空格拆 key=value
const values = new Map();
for (const piece of report.trim().split(/\s+/u)) {
  const eq = piece.indexOf('=');
  if (eq > 0) values.set(piece.slice(0, eq), piece.slice(eq + 1));
}
function expect(key, expected) {
  const actual = values.get(key);
  if (actual === undefined) failures.push(`缺少字段 ${key}`);
  else if (actual !== expected) failures.push(`${key}: 期望 [${expected}] 实际 [${actual}]`);
}
expect('不存在命中', '0');
expect('csrss打开成功', '假');
expect('受保护读取字节', '0');
const hits = Number(values.get('自身命中'));
if (!(hits >= 1)) failures.push(`自身命中: 期望 >=1 实际 [${values.get('自身命中')}]`);
const explorer = Number(values.get('explorer数量'));
if (!(explorer >= 1)) failures.push(`explorer数量: 期望 >=1 实际 [${values.get('explorer数量')}]`);

const hitsJson = JSON.parse(read('scan-hits.json'));
check(Array.isArray(hitsJson) && hitsJson.length === hits, `scan-hits.json 数量 ${hitsJson.length} != ${hits}`);
check(hitsJson.every((v, i, a) => i === 0 || a[i - 1] < v), 'scan-hits.json 必须升序去重');
const pids = JSON.parse(read('scan-pids.json'));
check(Array.isArray(pids) && pids.length === explorer, `scan-pids.json 数量 ${pids.length} != ${explorer}`);
const regions = JSON.parse(read('scan-regions.json'));
check(Array.isArray(regions) && regions.length >= 1, 'scan-regions.json 至少一个区域');
check(regions.every(r => r.baseAddress >= 0 && r.regionSize > 0 && r.state === 4096), 'scan-regions.json 区域字段非法');

if (failures.length) {
  console.error('FAIL ' + failures.length + ' 项：');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`ALL-PASS process-memory-scan（枚举 ${explorer} 进程 / 区域 ${regions.length} / 命中 ${hits}，反例与去重断言全过）`);
