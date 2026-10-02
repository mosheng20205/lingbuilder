/**
 * 黄金基线：生成器结构性重构（运行时模板分段/分文件/裁剪）前后的逐字节对比门。
 *
 *   GOLDEN_MODE=write  生成器改动前运行，落快照到 electron/.golden/
 *   GOLDEN_MODE=check  改动后运行，逐字节比对（缺省）
 *
 * 快照目录已进 .gitignore，属本机回归设施；manifest 中的 generatedAt 时间戳
 * 在比对前做归一化。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { buildGoldenFixtures } from './goldenFixtures';

const MODE = process.env.GOLDEN_MODE === 'write' ? 'write' : 'check';
const GOLDEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.golden');

function normalize(content: string): string {
  // generatedAt 是真实时间戳；源码路径按规范化比较避免盘符差异。
  return content
    .replace(/"generatedAt":"[^"]*"/g, '"generatedAt":"<normalized>"')
    .replace(/"generatedAt": "[^"]*"/g, '"generatedAt": "<normalized>"');
}

for (const fixture of buildGoldenFixtures()) {
  test(`黄金基线: ${fixture.name}`, () => {
    const generated = generateLingCppNativeWin32Project(fixture.project, fixture.options);
    const snapshotDir = path.join(GOLDEN_DIR, fixture.name);
    const actual = generated.files.map(file => ({
      relativePath: file.relativePath,
      content: normalize(file.content)
    }));

    if (MODE === 'write') {
      fs.rmSync(snapshotDir, { recursive: true, force: true });
      fs.mkdirSync(snapshotDir, { recursive: true });
      for (const file of actual) {
        const target = path.join(snapshotDir, file.relativePath.replace(/\//gu, '__'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content, 'utf8');
      }
      fs.writeFileSync(
        path.join(snapshotDir, '__files__.json'),
        JSON.stringify(actual.map(file => file.relativePath), null, 2),
        'utf8'
      );
      return;
    }

    assert.ok(fs.existsSync(snapshotDir), `缺少黄金快照目录：${snapshotDir}（先以 GOLDEN_MODE=write 生成基线）`);
    const expectedNames = JSON.parse(fs.readFileSync(path.join(snapshotDir, '__files__.json'), 'utf8')) as string[];
    assert.deepEqual(
      actual.map(file => file.relativePath),
      expectedNames,
      '生成文件清单与黄金基线不一致'
    );
    for (const file of actual) {
      const target = path.join(snapshotDir, file.relativePath.replace(/\//gu, '__'));
      assert.ok(fs.existsSync(target), `缺少快照文件：${file.relativePath}`);
      const expected = fs.readFileSync(target, 'utf8');
      assert.equal(file.content, expected, `文件与黄金基线不一致：${file.relativePath}`);
    }
  });
}
