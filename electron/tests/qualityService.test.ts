import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseIstanbul, parseLcov, parseSanitizer, parseSarif, QualityService } from '../src/services/quality/qualityService';
import { TSX_IMPORT } from '../src/services/testing/testExplorerService';

test('quality service parses LCOV, Istanbul, SARIF, ASan and UBSan into one bounded model', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-quality-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const source = path.join(root, 'src', 'main.cpp'); await fs.mkdir(path.dirname(source)); await fs.writeFile(source, 'int main() {}\n');
  const lcov = parseLcov(`TN:\nSF:${source}\nDA:1,3\nDA:2,0\nend_of_record\n`, root); assert.deepEqual([lcov[0].covered, lcov[0].total, lcov[0].percentage], [1, 2, 50]);
  const istanbul = parseIstanbul(JSON.stringify({ [path.join(root, 'src', 'main.ts')]: { statementMap: { 0: { start: { line: 1 }, end: { line: 2 } }, 1: { start: { line: 3 }, end: { line: 3 } } }, s: { 0: 2, 1: 0 } } }), root); assert.equal(istanbul[0].percentage, 66.67);
  const sarif = parseSarif(JSON.stringify({ runs: [{ results: [{ ruleId: 'C26495', level: 'warning', message: { text: '成员未初始化' }, locations: [{ physicalLocation: { artifactLocation: { uri: pathToUri(source) }, region: { startLine: 1, startColumn: 5 } } }] }] }] }), root); assert.equal(sarif[0].filePath, 'src/main.cpp'); assert.equal(sarif[0].code, 'C26495');
  const sanitizer = parseSanitizer(`==1==ERROR: AddressSanitizer: heap-use-after-free\n    #0 0x1 in main ${source}:1:4\n${source}:1:7: runtime error: signed integer overflow`, root); assert.deepEqual(sanitizer.map(item => item.source), ['asan', 'ubsan']); assert.equal(sanitizer[0].filePath, 'src/main.cpp');
});

test('quality service runs real Node V8 coverage and imports workspace reports', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-quality-run-')); t.after(() => fs.rm(root, { recursive: true, force: true })); await fs.mkdir(path.join(root, 'tests')); await fs.writeFile(path.join(root, 'tests', 'math.test.ts'), `import test from 'node:test'; import assert from 'node:assert/strict'; function add(a:number,b:number){ return a+b; } test('adds',()=>assert.equal(add(1,2),3));\n`);
  const service = new QualityService(root, TSX_IMPORT); const report = await service.runNodeCoverage('tests/math.test.ts'); assert.ok(report.coverage.some(file => file.filePath === 'tests/math.test.ts')); assert.ok(report.summary.totalLines > 0); assert.ok(report.summary.coveragePercentage > 0);
  await fs.writeFile(path.join(root, 'coverage.info'), 'TN:\nSF:tests/math.test.ts\nDA:1,1\nDA:2,0\nend_of_record\n'); await fs.writeFile(path.join(root, 'analysis.sarif'), JSON.stringify({ runs: [{ results: [{ level: 'error', message: { text: '错误' } }] }] })); await fs.writeFile(path.join(root, 'sanitizer.log'), 'tests/math.test.ts:1:1: runtime error: demo');
  const imported = await service.importReports({ coveragePath: 'coverage.info', sarifPath: 'analysis.sarif', sanitizerPath: 'sanitizer.log' }); assert.equal(imported.summary.coveragePercentage, 50); assert.equal(imported.summary.errors, 2);
  await assert.rejects(service.importReports({ coveragePath: '../outside.info' }), /工作区|ENOENT/u);
});

function pathToUri(value: string) { return `file:///${value.replace(/\\/gu, '/')}`; }
