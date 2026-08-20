import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEditDraft } from '../src/ai/ai.service.js';

const currentProject = {
  id: 'web-access-demo',
  name: '网页访问使用demo',
  windows: [{
    id: 'main-window',
    title: '主窗口',
    background: '#1f2937',
    titleBarBackground: '#2D2D30',
    titleBarForeground: '#CBD5E1',
    controls: [{
      id: 'run-button',
      type: 'Button',
      name: '运行按钮',
      content: '运行',
      background: '#0369A1',
      foreground: '#FFFFFF',
      fontBold: false,
      properties: { cornerRadius: 6 },
      events: { Click: '_运行按钮_被单击' }
    }, {
      id: 'title-label',
      type: 'Label',
      name: '标题',
      content: '示例',
      visibility: 'Visible',
      foreground: '#F8FAFC',
      fontSize: 14,
      fontBold: false
    }]
  }],
  resources: []
};

const instruction = '当前的界面太乱了，帮我美化一下';
const filePath = 'src/MainWindow.lcpp';
const files = JSON.stringify({ files: [{ filePath, updatedSource: '类 MainWindow\n结束类' }] });

test('系统 AI 美化请求缺少 designerProject 时生成本地视觉回退', () => {
  const draft = parseEditDraft(files, [filePath], true, instruction, currentProject);
  const designer = draft.designerProject as typeof currentProject;
  assert.equal(designer.id, currentProject.id);
  assert.notEqual(designer.windows[0]?.background, currentProject.windows[0].background);
  assert.notEqual(designer.windows[0]?.controls[0]?.background, currentProject.windows[0].controls[0].background);
  assert.equal(designer.windows[0]?.controls[0]?.events?.Click, '_运行按钮_被单击');
  assert.equal(draft.files[0]?.updatedSource, '类 MainWindow\n结束类');
});

test('系统 AI 美化请求返回原模型时仍生成视觉回退', () => {
  const draft = parseEditDraft(JSON.stringify({ files: JSON.parse(files).files, designerProject: currentProject }), [filePath], true, instruction, currentProject);
  assert.notDeepEqual(draft.designerProject, currentProject);
});

test('普通布局请求缺少 designerProject 仍然阻断', () => {
  assert.throws(
    () => parseEditDraft(files, [filePath], true, '把运行按钮移动到窗口右下角', currentProject),
    /未返回完整设计器模型/u
  );
});
