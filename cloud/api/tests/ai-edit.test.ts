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
  const draft = parseEditDraft(files, [filePath], instruction, currentProject);
  const designer = draft.designerProject as typeof currentProject;
  assert.equal(designer.id, currentProject.id);
  assert.notEqual(designer.windows[0]?.background, currentProject.windows[0].background);
  assert.notEqual(designer.windows[0]?.controls[0]?.background, currentProject.windows[0].controls[0].background);
  assert.equal(designer.windows[0]?.controls[0]?.events?.Click, '_运行按钮_被单击');
  assert.equal(draft.files[0]?.updatedSource, '类 MainWindow\n结束类');
});

test('系统 AI 美化请求返回原模型时仍生成视觉回退', () => {
  const draft = parseEditDraft(JSON.stringify({ files: JSON.parse(files).files, designerProject: currentProject }), [filePath], instruction, currentProject);
  assert.notDeepEqual(draft.designerProject, currentProject);
});

test('普通布局请求不再因缺少或原样回传设计器模型被拒', () => {
  // 旧口径把「按钮/窗口/移动」命中即要求布局必须变化，纯行为需求与只改源码的草稿会被整份拒掉；
  // 现在云端只下发草稿，控件与布局的真实门禁由 IDE 本地执行。
  const sourceOnly = parseEditDraft(files, [filePath], '把运行按钮移动到窗口右下角', currentProject);
  assert.equal(sourceOnly.designerProject, undefined);
  assert.equal(sourceOnly.files.length, 1);

  const sameModel = parseEditDraft(
    JSON.stringify({ files: JSON.parse(files).files, designerProject: currentProject }),
    [filePath],
    '给运行按钮加上点击计数',
    currentProject
  );
  assert.equal(sameModel.designerProject, undefined);
  assert.equal(sameModel.files.length, 1);
});

test('系统 AI 纯布局草稿（源码不动）放行，不当成空回复', () => {
  const moved = JSON.parse(JSON.stringify(currentProject)) as typeof currentProject;
  moved.windows[0].controls[0] = { ...moved.windows[0].controls[0], background: '#DC2626' } as typeof moved.windows[0]['controls'][0];
  const draft = parseEditDraft(JSON.stringify({ files: [], designerProject: moved }), [filePath], '把运行按钮改成红色', currentProject);
  assert.deepEqual(draft.files, []);
  assert.notEqual(draft.designerProject, undefined);
});

test('无 newFiles 白名单时新文件被整体拒绝，错误信息区分两种失败', () => {
  const newFileDraft = JSON.stringify({ files: [{ filePath: 'src/utils.lcpp', updatedSource: '功能库 工具\n结束功能库' }] });
  // 模型给了文件但路径全被白名单过滤：错误必须点名被拒路径并提示声明 newFiles。
  assert.throws(
    () => parseEditDraft(newFileDraft, [filePath]),
    (error: any) => error.code === 'EDIT_DRAFT_INVALID' && /src\/utils\.lcpp.*不在本次请求允许的文件范围内.*newFiles/u.test(error.message)
  );
  // 模型根本没给文件草稿：错误不得误导成路径过滤。
  assert.throws(
    () => parseEditDraft(JSON.stringify({ files: [] }), [filePath]),
    (error: any) => error.code === 'EDIT_DRAFT_INVALID' && /未返回任何文件修改草稿/u.test(error.message)
  );
});

test('newFiles 白名单放行声明范围内的新路径', () => {
  const newFileDraft = JSON.stringify({
    files: [
      { filePath: 'src/演示项目/utils.lcpp', updatedSource: '功能库 工具\n结束功能库' },
      { filePath, updatedSource: '类 MainWindow\n结束类' }
    ]
  });
  const draft = parseEditDraft(
    newFileDraft,
    [filePath],
    '新建 utils.lcpp 功能库',
    undefined,
    { paths: ['src/演示项目/utils.lcpp'], maxCount: 5 }
  );
  assert.deepEqual(draft.files.map(file => file.filePath), ['src/演示项目/utils.lcpp', filePath]);
});

test('已有文件不占用新建额度，路径大小写差异不误拒', () => {
  const draft = parseEditDraft(
    JSON.stringify({
      files: [
        { filePath, updatedSource: '类 MainWindow\n结束类' },
        { filePath: 'src/演示项目/utils.lcpp', updatedSource: '功能库 工具\n结束功能库' }
      ]
    }),
    [filePath],
    '新建 utils.lcpp 功能库',
    undefined,
    { paths: ['src/演示项目/utils.lcpp'], maxCount: 1 }
  );
  assert.deepEqual(draft.files.map(file => file.filePath), [filePath, 'src/演示项目/utils.lcpp']);

  // 模型把文件名回成小写仍属同一工作区文件（Windows 路径大小写不敏感）。
  const cased = parseEditDraft(
    JSON.stringify({ files: [{ filePath: 'src/mainwindow.LCPP', updatedSource: '类 MainWindow\n结束类' }] }),
    [filePath],
    '修复计数逻辑'
  );
  assert.equal(cased.files.length, 1);
});

test('newFiles 目录许可按目录与扩展名放行并受数量上限约束', () => {
  const directoryDraft = JSON.stringify({
    files: [
      { filePath: 'src/演示项目/a.lcpp', updatedSource: '功能库 A\n结束功能库' },
      { filePath: 'src/演示项目/b.lcpp', updatedSource: '功能库 B\n结束功能库' },
      { filePath: 'src/演示项目/readme.md', updatedSource: '说明' }
    ]
  });
  // maxCount=1：第二个 .lcpp 超限被拒，md 不符合扩展名被拒，但已放行的文件保证不丢。
  const draft = parseEditDraft(
    directoryDraft,
    [],
    '新建两个功能库',
    undefined,
    { directories: ['src/演示项目'], extensions: ['.lcpp'], maxCount: 1 }
  );
  assert.deepEqual(draft.files.map(file => file.filePath), ['src/演示项目/a.lcpp']);
});

test('newFiles 白名单形状非法时给中文校验错误', () => {
  assert.throws(
    () => parseEditDraft(files, [filePath], '', undefined, { directories: ['../逃逸'] }),
    /不合法目录/u
  );
  assert.throws(
    () => parseEditDraft(files, [filePath], '', undefined, { paths: ['a.lcpp'], maxCount: 0 }),
    /maxCount/u
  );
});
