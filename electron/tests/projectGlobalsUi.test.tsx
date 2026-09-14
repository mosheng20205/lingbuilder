import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectGlobalVariableEditor from '../src/components/ProjectGlobalVariableEditor';
import { createSolutionService } from '../src/services/solution/solutionService';
import { resolveProjectTableRenderWidths } from '../src/services/editor/beginnerTableColumnWidths';

test('新手项目全局变量表格提供完整中文列、空状态和窄屏横向滚动', () => {
  const markup = renderToStaticMarkup(<ProjectGlobalVariableEditor
    sourceCode={'全局 文本型 当前用户 = "访客"\n'}
    filePath="src/demo/项目全局变量.lcpp"
    isDarkMode
    onChange={() => undefined}
  />);
  for (const label of ['全局变量名', '类型', '初始值', '数组', '备注', '操作', '新增']) assert.match(markup, new RegExp(label, 'u'));
  assert.match(markup, /overflow-auto/u);
  assert.match(markup, /min-width:850px/u);
  assert.match(markup, /table-fixed/u);
  assert.match(markup, /拖动调整列宽，双击恢复默认/u);
  assert.match(markup, /调整「初始值」列宽/u);
  assert.match(markup, /调整「备注」列宽/u);
  // 「数组」「操作」列内容固定（勾选框/按钮）：不提供拖拽手柄。
  assert.doesNotMatch(markup, /调整「数组」列宽/u);
  assert.doesNotMatch(markup, /调整「操作」列宽/u);
  assert.doesNotMatch(markup, />公开</u);

  // 项目常量页签：常量名/类型/常量值/备注 可拖拽，「操作」固定。
  const constantMarkup = renderToStaticMarkup(<ProjectGlobalVariableEditor
    sourceCode={'常量 文本型 应用名称 = "演示"\n'}
    filePath="src/demo/项目全局变量.lcpp"
    isDarkMode
    focusConstantName="应用名称"
    onChange={() => undefined}
  />);
  for (const label of ['常量名', '类型', '常量值', '备注', '操作', '新增']) assert.match(constantMarkup, new RegExp(label, 'u'));
  assert.match(constantMarkup, /调整「常量值」列宽/u);
  assert.match(constantMarkup, /调整「备注」列宽/u);
  assert.doesNotMatch(constantMarkup, /调整「操作」列宽/u);

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

test('渲染列宽：固定列不参与拉伸，弹性列按权重分摊容器宽度', () => {
  const defaults = [150, 130, 190, 56, 250, 74];
  const fixed = new Set([3, 5]);
  const flex = new Set([0, 1, 2, 4]);

  // 容器未知（服务端渲染）：退回默认布局。
  assert.deepEqual(resolveProjectTableRenderWidths(defaults, fixed, flex, undefined, 0), [150, 130, 190, 56, 250, 74]);

  // 宽容器（1987 内容宽）：数组恒 56、操作恒 74，多余宽度只给弹性列，总宽正好填满。
  const wide = resolveProjectTableRenderWidths(defaults, fixed, flex, undefined, 1987);
  assert.equal(wide[3], 56);
  assert.equal(wide[5], 74);
  assert.equal(wide.reduce((sum, width) => sum + width, 0), 1987);
  assert.ok(wide[4]! > 250, '备注列应分到剩余宽度');

  // 拖拽语义：拖过的列精确钉住（1:1 跟手），未拖拽的弹性列按默认权重让位，固定列不动。
  const before = resolveProjectTableRenderWidths(defaults, fixed, flex, undefined, 1200);
  const remarkDragged = before[4]! + 140;
  const after = resolveProjectTableRenderWidths(defaults, fixed, flex, [0, 0, 0, 0, remarkDragged, 0], 1200);
  assert.equal(after[3], 56);
  assert.equal(after[5], 74);
  assert.equal(after[4], remarkDragged);
  assert.equal(after.reduce((sum, width) => sum + width, 0), 1200);
  assert.ok(after[0]! < before[0]! && after[1]! < before[1]! && after[2]! < before[2]!, '其余弹性列应按比例让位');

  // 再拖名称 -80：名称精确钉住，备注保持已拖宽度，类型/初始值继续让位。
  const nameAfterRemark = after[0]!;
  const second = resolveProjectTableRenderWidths(defaults, fixed, flex, [nameAfterRemark - 80, 0, 0, 0, remarkDragged, 0], 1200);
  assert.equal(second[0], nameAfterRemark - 80);
  assert.equal(second[4], remarkDragged);
  assert.equal(second.reduce((sum, width) => sum + width, 0), 1200);

  // 窄容器：不低于默认总宽（触发横向滚动），弹性列不会被压扁。
  const narrow = resolveProjectTableRenderWidths(defaults, fixed, flex, undefined, 400);
  assert.deepEqual(narrow, [150, 130, 190, 56, 250, 74]);

  // 持久化权重只作用于弹性列：数组列即使有旧的拖拽残留也回到固定 56。
  const stale = resolveProjectTableRenderWidths(defaults, fixed, flex, [150, 130, 190, 400, 250, 74], 0);
  assert.equal(stale[3], 56);
});
