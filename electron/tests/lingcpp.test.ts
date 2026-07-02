import test from 'node:test';
import assert from 'node:assert/strict';

import { applyWorkspaceEdit, applyWorkspaceEditToFiles, createWorkspaceEditChangeFromRewrite, proposeLingCppEdit } from '../src/services/lingCpp/aiEditService';
import { findLingCppMethod, parseLingCpp } from '../src/services/lingCpp/parser';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';

const sampleSource = `包 太空冒险
使用 Win32窗口
使用 标准控件

类 游戏主窗体 : 公开 窗体
公开:
    文本型 关联设计文件 = "MainWindow.xml"
    按钮 按钮1
    按钮 按钮2
私有:
    复选框 记住我

    构造()
        调试输出("初始化完成")

    析构()
        调试输出("资源已释放")

    事件 _游戏主窗体_创建完毕()
        调试输出("窗体创建完毕")

    事件 _按钮1_被单击()
        信息框("开始运行", 64, "提示")
        调试输出("按钮1")

    事件 _按钮2_被单击()
        如果 (信息框("确认退出？", 36, "退出确认") == 6)
            结束()
        如果结束
结束类`;

const sampleProject: LingWindowProject = {
  id: 'sample-project',
  name: '太空冒险',
  windows: [
    {
      id: 'window-1',
      fileName: 'MainWindow.xml',
      className: '游戏主窗体',
      title: '太空冒险',
      width: 960,
      height: 640,
      background: '#1E1E24',
      description: '主窗体',
      menuItems: '文件',
      menuEvents: {
        Item_0: '_游戏主窗体_文件_被选择'
      },
      controls: [
        {
          id: 'button-1',
          type: 'Button',
          name: '按钮1',
          content: '开始',
          width: 120,
          height: 36,
          x: 48,
          y: 72,
          fontSize: 14,
          background: '#2D6CDF',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: {
            Click: '_按钮1_被单击'
          }
        },
        {
          id: 'button-2',
          type: 'Button',
          name: '按钮2',
          content: '退出',
          width: 120,
          height: 36,
          x: 48,
          y: 124,
          fontSize: 14,
          background: '#D14343',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: {
            Click: '_按钮2_被单击'
          }
        }
      ]
    }
  ]
};

const advancedSource = `包 配置中心
使用 Win32窗口
使用 标准控件

类 设置窗体 : 公开 窗体
公开:
    复选框 记住密码
    单选框 自动登录
    进度条 同步进度
    下拉框 主题列表

    构造()
        调试输出("设置窗体初始化")

    事件 _设置窗体_创建完毕()
        调试输出("设置载入完成")

    事件 _记住密码_被单击()
        调试输出("切换记住密码")
        循环
        循环结束
        返回
结束类`;

const advancedProject: LingWindowProject = {
  id: 'settings-project',
  name: '配置中心',
  windows: [
    {
      id: 'window-settings',
      fileName: 'SettingsWindow.xml',
      className: '设置窗体',
      title: '配置中心',
      width: 800,
      height: 520,
      background: '#20232A',
      description: '设置窗体',
      controls: [
        {
          id: 'remember-checkbox',
          type: 'CheckBox',
          name: '记住密码',
          content: '记住密码',
          width: 140,
          height: 28,
          x: 36,
          y: 44,
          fontSize: 13,
          background: '#20232A',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: {
            Click: '_记住密码_被单击'
          }
        },
        {
          id: 'auto-radio',
          type: 'RadioButton',
          name: '自动登录',
          content: '自动登录',
          width: 140,
          height: 28,
          x: 36,
          y: 84,
          fontSize: 13,
          background: '#20232A',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'sync-progress',
          type: 'ProgressBar',
          name: '同步进度',
          content: '65',
          width: 220,
          height: 20,
          x: 36,
          y: 126,
          fontSize: 12,
          background: '#28405A',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'theme-combo',
          type: 'ComboBox',
          name: '主题列表',
          content: '深色主题',
          width: 180,
          height: 28,
          x: 36,
          y: 164,
          fontSize: 13,
          background: '#FFFFFF',
          foreground: '#111111',
          isEnabled: true,
          visibility: 'Visible'
        }
      ]
    }
  ]
};

test('parseLingCpp extracts classes, members and event handlers', () => {
  const result = parseLingCpp(sampleSource);

  assert.equal(result.program.packageName, '太空冒险');
  assert.deepEqual(result.program.uses, ['Win32窗口', '标准控件']);
  assert.equal(result.program.classes.length, 1);

  const mainClass = result.program.classes[0];
  assert.equal(mainClass.name, '游戏主窗体');
  assert.equal(mainClass.baseClass, '窗体');
  assert.equal(mainClass.members.length, 4);
  assert.equal(mainClass.members[3]?.name, '记住我');
  assert.equal(mainClass.members[3]?.type, '复选框');

  const methods = mainClass.methods.map(method => method.name);
  assert.deepEqual(methods, ['游戏主窗体', '销毁_游戏主窗体', '_游戏主窗体_创建完毕', '_按钮1_被单击', '_按钮2_被单击']);

  assert.equal(findLingCppMethod(result.program, '_按钮1_被单击')?.kind, 'event');
  assert.equal(findLingCppMethod(result.program, '按钮2_被单击')?.name, '_按钮2_被单击');
  assert.equal(findLingCppMethod(result.program, '_游戏主窗体_创建完毕')?.statements[0]?.text.trim(), '调试输出("窗体创建完毕")');
});

test('parseLingCpp reports diagnostics but continues after invalid outer statements', () => {
  const result = parseLingCpp(`调试输出("类外语句")\n\n类 示例 : 公开 窗体\n结束类`);

  assert.equal(result.program.classes.length, 1);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('类外语句不会参与中文 C++ 生成')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('未声明构造函数')));
});

test('generateLingCppNativeWin32Project emits OOP Win32 class code and event wiring', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: sampleSource
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('class 游戏主窗体 : public LingWindowBase'));
  assert.ok(mainCpp.includes('void OnWindowCreated() override'));
  assert.ok(mainCpp.includes('游戏主窗体_创建完毕();'));
  assert.ok(mainCpp.includes('void 按钮1_被单击()'));
  assert.ok(mainCpp.includes('信息框(L"开始运行", MB_OK | MB_ICONINFORMATION, L"提示");'));
  assert.ok(mainCpp.includes('if (信息框(L"确认退出？", MB_YESNO | MB_ICONQUESTION, L"退出确认") == IDYES) { 结束(); return; }'));
  assert.ok(mainCpp.includes('void 游戏主窗体_文件_被选择()'));

  const layoutJson = generated.files.find(file => file.relativePath === 'layout.json')?.content || '';
  assert.equal(JSON.parse(layoutJson).id, 'sample-project');
});

test('generateLingCppNativeWin32Project keeps richer control types and unsupported syntax deterministic', () => {
  const parsed = parseLingCpp(advancedSource);
  assert.equal(parsed.program.classes[0]?.members.length, 4);
  assert.deepEqual(parsed.program.classes[0]?.members.map(member => member.type), ['复选框', '单选框', '进度条', '下拉框']);

  const generated = generateLingCppNativeWin32Project(advancedProject, {
    activeWindowId: 'window-settings',
    lingCppSourceCode: advancedSource
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('class 设置窗体 : public LingWindowBase'));
  assert.ok(mainCpp.includes('void 设置窗体_创建完毕()'));
  assert.ok(mainCpp.includes('void 记住密码_被单击()'));
  assert.ok(mainCpp.includes('L"CheckBox"'));
  assert.ok(mainCpp.includes('L"RadioButton"'));
  assert.ok(mainCpp.includes('L"ProgressBar"'));
  assert.ok(mainCpp.includes('L"ComboBox"'));
  assert.ok(mainCpp.includes('调试输出(L"切换记住密码");'));
  assert.ok(mainCpp.includes('// 暂不支持的中文 C++ 语句：循环'));
  assert.ok(mainCpp.includes('// 暂不支持的中文 C++ 语句：循环结束'));
  assert.ok(mainCpp.includes('return;'));
});

test('proposeLingCppEdit creates a minimal replace range from rewritten source', () => {
  const originalSource = `包 示例\n类 示例窗体 : 公开 窗体\n公开:\n    事件 _按钮1_被单击()\n        调试输出("旧文本")\n结束类`;
  const updatedSource = `包 示例\n类 示例窗体 : 公开 窗体\n公开:\n    事件 _按钮1_被单击()\n        调试输出("新文本")\n        信息框("完成", 64, "提示")\n结束类`;

  const proposal = proposeLingCppEdit(
    {
      filePath: 'src/示例窗体.lcpp',
      sourceCode: originalSource,
      instruction: '为按钮点击增加提示框'
    },
    {
      summary: '补充按钮点击提示',
      explanation: '在按钮事件中保留调试输出，并补充提示框。',
      updatedSource
    }
  );

  assert.equal(proposal.summary, '补充按钮点击提示');
  assert.equal(proposal.changes.length, 1);
  assert.match(proposal.changes[0].originalText, /旧文本/);
  assert.match(proposal.changes[0].newText, /新文本/);
  assert.match(proposal.changes[0].newText, /信息框\("完成"/);
  assert.equal(applyWorkspaceEdit(originalSource, proposal), updatedSource);
});

test('proposeLingCppEdit supports multi-file workspace proposals and batched apply', () => {
  const mainOriginalSource = `包 示例\n类 示例窗体 : 公开 窗体\n公开:\n    事件 _按钮1_被单击()\n        调试输出("旧文本")\n结束类`;
  const mainUpdatedSource = `包 示例\n类 示例窗体 : 公开 窗体\n公开:\n    事件 _按钮1_被单击()\n        调试输出("新文本")\n结束类`;
  const configOriginalSource = `[UI]\nTitle=旧标题\nTheme=dark`;
  const configUpdatedSource = `[UI]\nTitle=新标题\nTheme=dark`;

  const proposal = proposeLingCppEdit(
    {
      filePath: 'src/示例窗体.lcpp',
      sourceCode: mainOriginalSource,
      instruction: '同步更新按钮提示和配置标题',
      workspaceFiles: [
        { filePath: 'src/示例窗体.lcpp', sourceCode: mainOriginalSource, language: 'lingcpp' },
        { filePath: 'config/config.ini', sourceCode: configOriginalSource, language: 'ini' }
      ]
    },
    {
      summary: '同步更新源码与配置',
      explanation: '按钮事件日志和 UI 标题需要保持一致。',
      files: [
        { filePath: 'src/示例窗体.lcpp', updatedSource: mainUpdatedSource },
        { filePath: 'config/config.ini', updatedSource: configUpdatedSource }
      ]
    }
  );

  assert.equal(proposal.changes.length, 2);
  assert.deepEqual(proposal.changes.map(change => change.filePath), ['src/示例窗体.lcpp', 'config/config.ini']);

  const appliedFiles = applyWorkspaceEditToFiles([
    { filePath: 'src/示例窗体.lcpp', sourceCode: mainOriginalSource, language: 'lingcpp' },
    { filePath: 'config/config.ini', sourceCode: configOriginalSource, language: 'ini' }
  ], proposal);

  assert.equal(appliedFiles.length, 2);
  assert.equal(appliedFiles.find(file => file.filePath === 'src/示例窗体.lcpp')?.sourceCode, mainUpdatedSource);
  assert.equal(appliedFiles.find(file => file.filePath === 'config/config.ini')?.sourceCode, configUpdatedSource);
});

test('createWorkspaceEditChangeFromRewrite keeps range tightly scoped', () => {
  const originalSource = '第一行\n第二行旧内容\n第三行';
  const updatedSource = '第一行\n第二行新内容\n第三行';
  const change = createWorkspaceEditChangeFromRewrite('src/demo.lcpp', originalSource, updatedSource);

  assert.equal(change.range.startLine, 2);
  assert.equal(change.range.endLine, 2);
  assert.equal(change.originalText, '旧');
  assert.equal(change.newText, '新');
});
