import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseAiModuleOutputText } from '../src/services/modules/aiModuleImportParser';

/**
 * 单引擎回归：「AI 生成模块」的模型通道已删除，共享流只剩手动粘贴导入的受控出口。
 * 曾经钉住「清单登记文件收敛」的 collectRegisteredRelativePaths 只服务于系统 AI 的
 * 补全阶段（模型会漏写清单登记的文件），Agent 链路自己写文件并自查校验，故随通道一并移除。
 */
test('模块生成共享流不再携带任何模型通道', () => {
  const flow = fs.readFileSync(new URL('../src/services/modules/aiModuleGenerationFlow.ts', import.meta.url), 'utf8');

  for (const gone of ['cloudAi', 'ai-generate', 'AiConnectionConfig', 'generateAiText', 'readPreferredCloudModelAlias', 'collectRegisteredRelativePaths']) {
    assert.ok(!flow.includes(gone), `AI 模块共享流不得再出现旧通道标识：${gone}`);
  }
  assert.match(flow, /\/api\/modules\/developer\/import-ai-files/u);
  assert.match(flow, /typeof imported\.moduleId !== 'string'/u);
  assert.match(flow, /typeof item === 'string'/u);
});

test('服务端不再暴露自定义 API 模块生成端点', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.ok(!server.includes('/api/modules/ai-generate'), 'BYOK 模块生成端点应随通道一并删除');
  assert.ok(!server.includes('buildModuleGenerationMessages'), '模块生成提示词组装器不应再被引用');
  // 手动导入端点仍是唯一写 module-build 的受控出口。
  assert.match(server, /app\.post\("\/api\/modules\/developer\/import-ai-files"/u);
});

test('模块文件契约解析兼容带 BOM 与反斜杠路径的 AI 输出', () => {
  const raw = [
    '### 文件：lingbuilder.module.json',
    '```json',
    '{"schemaVersion":2,"id":"demo.math2","version":"1.0.0"}',
    '```',
    '### 文件：include\\demo_math.h',
    '```cpp',
    '#pragma once',
    '```'
  ].join('\n');
  const parsed = parseAiModuleOutputText(raw);
  assert.equal(parsed.files.length, 2);
  assert.deepEqual(parsed.files.map(file => file.path), ['lingbuilder.module.json', 'include/demo_math.h']);
});
