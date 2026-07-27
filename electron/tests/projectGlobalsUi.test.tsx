import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectGlobalVariableEditor from '../src/components/ProjectGlobalVariableEditor';
import { createSolutionService } from '../src/services/solution/solutionService';

test('新手项目全局变量表格提供完整中文列、空状态和窄屏横向滚动', () => {
  const markup = renderToStaticMarkup(<ProjectGlobalVariableEditor
    sourceCode={'全局 文本型 当前用户 = "访客"\n'}
    filePath="src/demo/项目全局变量.lcpp"
    isDarkMode
    onChange={() => undefined}
  />);
  for (const label of ['全局变量名', '类型', '初始值', '数组', '备注', '操作', '新增']) assert.match(markup, new RegExp(label, 'u'));
  assert.match(markup, /overflow-auto/u);
  assert.match(markup, /min-w-\[850px\]/u);
  assert.doesNotMatch(markup, />公开</u);

  const emptyMarkup = renderToStaticMarkup(<ProjectGlobalVariableEditor
    sourceCode="// 空项目全局变量文件\n"
    filePath="src/demo/项目全局变量.lcpp"
    isDarkMode={false}
    onChange={() => undefined}
  />);
  assert.match(emptyMarkup, /暂无(?:全局|项目)变量/u);
});

test('新建 Visual C++ 项目直接物化固定全局变量文件', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-project-global-ui-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const service = createSolutionService(workspaceRoot);
  const solution = await service.getSolution();
  const defaultProject = service.getProject(solution, solution.startupProjectId);
  assert.ok(await exists(path.join(workspaceRoot, defaultProject.sourceRoot, '项目全局变量.lcpp')));

  const created = await service.createProject({ name: '第二项目' });
  assert.ok(await exists(path.join(workspaceRoot, created.project.sourceRoot, '项目全局变量.lcpp')));
});

async function exists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}
