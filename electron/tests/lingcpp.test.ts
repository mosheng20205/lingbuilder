import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { applyWorkspaceEdit, applyWorkspaceEditToFiles, createWorkspaceEditChangeFromRewrite, proposeLingCppEdit } from '../src/services/lingCpp/aiEditService';
import { findLingCppMethod, LING_CPP_KEYWORDS, LING_CPP_TYPES, parseLingCpp } from '../src/services/lingCpp/parser';
import {
  buildLingCppLanguageContext,
  formatLingCpp,
  getLingCppBilingualCompletions,
  getLingCppCompletionItems,
  getLingCppCompletionContextKind,
  getLingCppCompletions,
  getLingCppDesignerBindings,
  getLingCppEventBlockHighlights,
  getLingCppFoldingRanges,
  getLingCppInlineHints,
  getLingCppHover,
  getLingCppProblems,
  getLingCppReadableBlocks,
  getLingCppSemanticDiagnostics,
  getLingCppStructuredRows,
  getLingCppStructuredReadingRows,
  getLingCppStructureView,
  getLingCppSymbols,
  getReadableEventName,
  lingCppLanguageService
} from '../src/services/lingCpp/languageService';
import { applyLingCppAstEdit } from '../src/services/lingCpp/astEditService';
import {
  applyPendingBeginnerCodeDrafts,
  createBeginnerCodeDraftKey
} from '../src/services/lingCpp/beginnerEditTransactionService';
import {
  createWorkspaceEditFromActionBlock,
  getActionBlocksForEvent,
  getBeginnerTasks,
  getBeginnerTemplates,
  getCodeExplanation
} from '../src/services/lingCpp/beginnerService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { importNativeCppToLingBuilder } from '../src/services/windowDesigner/nativeCppImportService';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { InstalledModule } from '../src/services/modules/types';

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
          properties: { cornerRadius: 18 },
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
          properties: { cornerRadius: 0 },
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

const completionModule: InstalledModule = {
  isInstalled: true,
  installPath: 'C:/modules/com.example.completion',
  diagnostics: [],
  manifest: {
    schemaVersion: 2,
    id: 'com.example.completion',
    name: '测试补全模块',
    version: '1.0.0',
    category: '系统',
    description: '用于验证 LingCpp 统一补全上下文。',
    contributes: {
      commands: [{ name: '模块提示', signature: '模块提示(文本)', description: '显示一条模块提示。', insertText: '模块提示("$1")' }]
    },
    bindings: { commands: [{ command: '模块提示', runtimeName: '模块提示', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'void' }] }
  }
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

test('parseLingCpp keeps 窗口_ commands inside the current event instead of treating them as method declarations', () => {
  const parsed = parseLingCpp([
    '类 主窗口',
    '    事件 _主窗口_关闭前()',
    '        窗口_取消关闭()',
    '    结束',
    '结束类'
  ].join('\n'));
  const event = parsed.program.classes[0]?.methods[0];
  assert.equal(parsed.program.classes[0]?.methods.length, 1);
  assert.equal(event?.name, '_主窗口_关闭前');
  assert.equal(event?.statements[0]?.text.trim(), '窗口_取消关闭()');
});

test('parseLingCpp exposes stable AST and symbol index without breaking program compatibility', () => {
  const result = parseLingCpp(sampleSource);
  const kinds = new Set(result.ast.nodes.map(node => node.kind));
  const eventNode = result.symbolIndex.events.find(node => node.name === '_按钮1_被单击');
  const memberNode = result.symbolIndex.members.find(node => node.name === '记住我');

  assert.equal(result.ast.program, result.program);
  assert.ok(kinds.has('package'));
  assert.ok(kinds.has('use'));
  assert.ok(kinds.has('class'));
  assert.ok(kinds.has('member'));
  assert.ok(kinds.has('constructor'));
  assert.ok(kinds.has('destructor'));
  assert.ok(kinds.has('event'));
  assert.ok(kinds.has('statement'));
  assert.ok(eventNode);
  assert.ok(memberNode);
  assert.ok((eventNode?.range.startLine || 0) > 0);
  assert.ok((eventNode?.range.endLine || 0) >= (eventNode?.range.startLine || 0));
  assert.equal(result.symbolIndex.byName.按钮1?.[0]?.kind, 'member');
});

test('beginner service converts designer gaps into task language', () => {
  const projectWithMissingSource: LingWindowProject = {
    ...sampleProject,
    windows: sampleProject.windows.map(win => ({
      ...win,
      controls: win.controls.map(control =>
        control.id === sampleProject.windows[0]?.controls[0]?.id
          ? { ...control, events: { ...(control.events || {}), DoubleClick: '_missing_beginner_handler' } }
          : control
      )
    }))
  };

  const tasks = getBeginnerTasks(sampleSource, projectWithMissingSource, 'src/MainWindow.lcpp');

  assert.ok(tasks.some(task => task.kind === 'missing-source'));
  assert.ok(tasks.some(task => task.actionLabel.includes('生成')));
});

test('beginner code explanation handles common Chinese concepts', () => {
  const packageExplanation = getCodeExplanation('包 Demo\n使用 Win32窗口', 1, 1);
  const eventExplanation = getCodeExplanation('事件 _按钮1_被单击()\n    信息框("完成", 64, "提示")', 1, 1);
  const messageExplanation = getCodeExplanation('事件 _按钮1_被单击()\n    信息框("完成", 64, "提示")', 2, 5);

  assert.equal(packageExplanation.title, '包');
  assert.equal(eventExplanation.title, '事件');
  assert.equal(messageExplanation.title, '信息框');
});

test('beginner action blocks parse supported event statements and create preview edits', () => {
  const handlerName = sampleProject.windows[0]?.controls[0]?.events?.Click || '';
  const blocks = getActionBlocksForEvent(sampleSource, handlerName);

  assert.ok(blocks.some(block => block.kind === 'message-box'));
  assert.ok(blocks.some(block => block.kind === 'debug-output'));

  const proposal = createWorkspaceEditFromActionBlock({
    filePath: 'src/MainWindow.lcpp',
    sourceCode: sampleSource,
    handlerName
  }, {
    id: 'new-debug',
    kind: 'debug-output',
    label: '调试输出',
    description: '写入日志',
    params: { text: '事件预览' }
  });

  assert.equal(proposal.changes.length, 1);
  assert.ok(proposal.summary.includes(handlerName));
  assert.ok(proposal.changes[0].newText.includes('事件预览'));
});

test('beginner action preview treats only explicit 结束() as exiting the program', () => {
  const source = [
    '类 测试窗口 : 公开 窗体',
    '公开:',
    '    事件 _按钮1_被单击()',
    '        如果 (真)',
    '            调试输出("判断分支")',
    '        如果结束',
    '        循环',
    '        循环结束',
    '        结束()',
    '    结束',
    '结束类'
  ].join('\n');
  const blocks = getActionBlocksForEvent(source, '_按钮1_被单击');
  const bySource = new Map(blocks.map(block => [block.sourceText, block]));

  assert.equal(bySource.get('如果结束')?.kind, 'advanced-code');
  assert.equal(bySource.get('循环结束')?.kind, 'advanced-code');
  assert.equal(blocks.filter(block => block.kind === 'exit-program').length, 1);
  assert.equal(bySource.get('结束()')?.kind, 'exit-program');
  assert.equal(getCodeExplanation('如果结束', 1).title, '结构结束');
  assert.equal(getCodeExplanation('结束()', 1).title, '结束');
});

test('beginner templates provide source and designer model together', () => {
  const templates = getBeginnerTemplates();
  const login = templates.find(template => template.id === 'login');

  assert.ok(login);
  assert.ok(login?.defaultFilePath.endsWith('.lcpp'));
  assert.ok(login?.sourceCode.includes('包 LingBuilder'));
  assert.ok(login?.project.windows[0]?.controls.length);
  assert.ok(Object.keys(login?.project.windows[0]?.controls[0]?.events || {}).length > 0);
});

test('parseLingCpp reports diagnostics but continues after invalid outer statements', () => {
  const result = parseLingCpp(`调试输出("类外语句")\n\n类 示例 : 公开 窗体\n结束类`);

  assert.equal(result.program.classes.length, 1);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('类外语句不会参与中文 C++ 生成')));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('未声明构造函数')));
});

/*
test('LingCpp language service emits outline symbols and folding ranges', () => {
  const symbols = getLingCppSymbols(sampleSource);
  const classSymbol = symbols.find(symbol => symbol.kind === 'class');

  assert.equal(classSymbol?.name, '娓告垙涓荤獥浣?);
  assert.ok(classSymbol?.children?.some(child => child.kind === 'event' && child.name === '_鎸夐挳1_琚崟鍑?));
  assert.ok(classSymbol?.children?.some(child => child.kind === 'constructor'));

  const foldingRanges = getLingCppFoldingRanges(sampleSource);
  assert.ok(foldingRanges.some(range => range.startLine === classSymbol?.line && range.endLine > range.startLine));
  assert.ok(foldingRanges.some(range => range.endLine > range.startLine && range.startLine > (classSymbol?.line || 0)));
});

test('LingCpp language service reports block diagnostics and keeps formatting idempotent', () => {
  const brokenSource = sampleSource.replace(LING_CPP_KEYWORDS[13], '');
  const diagnostics = getLingCppSemanticDiagnostics(brokenSource);

  assert.ok(diagnostics.some(diagnostic => diagnostic.message.includes('条件语句缺少结束语句')));

  const formatted = formatLingCpp(sampleSource);
  assert.equal(formatLingCpp(formatted), formatted);
});

test('LingCpp completions include snippets for events and control flow', () => {
  const completions = getLingCppCompletions({ source: sampleSource, line: 1, column: 1 });

  assert.ok(completions.some(item => item.kind === 'event' && item.isSnippet));
  assert.ok(completions.some(item => item.label === LING_CPP_KEYWORDS[11] && item.isSnippet));
  assert.ok(completions.some(item => item.label === LING_CPP_KEYWORDS[14] && item.isSnippet));
});

test('LingCpp bilingual completions support Chinese, English aliases and pinyin triggers', () => {
  const messageByEnglish = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'msg' }, sampleProject);
  const messageByPinyin = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'xxk' }, sampleProject);
  const debugByEnglish = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'DebugOutput' }, sampleProject);
  const contextKind = getLingCppCompletionContextKind(sampleSource, 22, 9);

  assert.equal(contextKind, 'event-body');
  assert.ok(messageByEnglish.some(item => item.aliases?.includes('MessageBox') && item.category === 'command'));
  assert.ok(messageByPinyin.some(item => item.pinyin?.includes('xxk') && item.category === 'command'));
  assert.ok(debugByEnglish.some(item => item.aliases?.includes('DebugOutput') && item.category === 'command'));
  assert.ok(messageByEnglish.some(item => item.example && item.audienceText));
});

test('LingCpp bilingual completions include designer event snippets in class context', () => {
  const completions = getLingCppBilingualCompletions({ source: sampleSource, line: 8, column: 5, triggerText: 'Click' }, sampleProject);

  assert.ok(completions.some(item => item.category === 'designer' && item.isSnippet && item.insertText.includes('事件')));
  assert.ok(completions.some(item => item.category === 'event' && item.isSnippet));
});

test('LingCpp designer bindings produce bound and missing-source hints', () => {
  const boundHints = getLingCppDesignerBindings(sampleSource, sampleProject, 'src/MainWindow.lcpp');

  assert.ok(boundHints.some(hint => hint.status === 'bound' && hint.handlerName === '_鎸夐挳1_琚崟鍑?));

  const projectWithMissingSource: LingWindowProject = {
    ...sampleProject,
    windows: sampleProject.windows.map(win => ({
      ...win,
      controls: win.controls.map(control =>
        control.name === '鎸夐挳1'
          ? { ...control, events: { ...(control.events || {}), DoubleClick: '_鎸夐挳1_琚弻鍑? } }
          : control
      )
    }))
  };

  const diagnostics = getLingCppSemanticDiagnostics(sampleSource, projectWithMissingSource, 'src/MainWindow.lcpp');
  assert.ok(diagnostics.some(diagnostic => diagnostic.message.includes('源码中缺少对应事件')));
});

*/

test('LingCpp 设计器控件名称支持拼音补全和内容属性表达式', () => {
  const designerProject: LingWindowProject = {
    schemaVersion: 2,
    id: 'designer-control-completion',
    name: '控件补全',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'header-input', type: 'TextBox', name: '编辑框_表头', content: '0', width: 160, height: 32,
        x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }, {
        id: 'main-tabs', type: 'TabControl', name: '选项卡1', content: '', width: 320, height: 220,
        x: 20, y: 80, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { tabs: [{ id: 'page1', title: '第一页' }] }
      }]
    }]
  };
  const source = '类 MainWindow : 公开 窗体\n    事件 _按钮1_被单击()\n    结束\n结束类';
  const byInitials = getLingCppBilingualCompletions({ source, line: 2, column: 5, triggerText: 'bjk' }, designerProject);
  const byProperty = getLingCppBilingualCompletions({ source, line: 2, column: 5, triggerText: '编辑框_表头.内' }, designerProject);
  const tabMethod = getLingCppBilingualCompletions({ source, line: 2, column: 5, triggerText: '选项卡1.设置' }, designerProject);

  assert.ok(byInitials.some(item => item.label === '编辑框_表头' && item.category === 'designer'));
  assert.ok(byInitials.some(item => item.label === '编辑框_表头.内容'));
  assert.ok(byProperty.some(item => item.insertText === '编辑框_表头.内容'));
  assert.ok(tabMethod.some(item => item.insertText === '选项卡1.设置选择项($1)'));
});

test('LingCpp language context powers unified completions with symbols, designer and modules', () => {
  const context = buildLingCppLanguageContext(
    sampleSource,
    sampleProject,
    { enabledModules: [completionModule], availableModules: [completionModule] },
    'src/MainWindow.lcpp'
  );
  const completions = getLingCppCompletionItems({ source: sampleSource, line: 8, column: 5, triggerText: '模块' }, context);
  const allCompletions = getLingCppCompletionItems({ source: sampleSource, line: 8, column: 5 }, context);
  const designerIndex = allCompletions.findIndex(item => item.category === 'designer');
  const moduleIndex = allCompletions.findIndex(item => item.category === 'module');

  assert.equal(context.ast.program.packageName, '太空冒险');
  assert.ok(context.designerBindings.some(binding => binding.status === 'bound'));
  assert.ok(context.moduleContributions.some(item => item.label === '模块提示'));
  assert.ok(completions.some(item => item.label === '模块提示' && item.category === 'module'));
  assert.ok(allCompletions.some(item => item.label === '游戏主窗体' && item.category === 'symbol'));
  assert.ok(designerIndex >= 0);
  assert.ok(moduleIndex >= 0);
  assert.ok(designerIndex < moduleIndex);
});

test('LingCpp structured rows expose Volcano-style declaration class member method event groups', () => {
  const context = buildLingCppLanguageContext(sampleSource, sampleProject, undefined, 'src/MainWindow.lcpp');
  const rows = getLingCppStructuredRows(context);

  assert.ok(rows.some(row => row.group === 'declaration' && row.type === '包'));
  assert.ok(rows.some(row => row.group === 'declaration' && row.value === 'MainWindow.xml'));
  assert.ok(rows.some(row => row.group === 'class' && row.name === '游戏主窗体'));
  assert.ok(rows.some(row => row.group === 'member' && row.name === '按钮1'));
  assert.ok(rows.some(row => row.group === 'method' && row.name === '构造()'));
  assert.ok(rows.some(row => row.group === 'event' && row.status === 'bound'));
  assert.ok(rows.some(row => row.editKind === 'package' && row.editable));
  assert.ok(rows.some(row => row.editKind === 'class' && row.className === '游戏主窗体'));
  assert.ok(rows.some(row => row.editKind === 'member' && row.targetName === '按钮1' && row.className === '游戏主窗体'));
  assert.ok(rows.some(row => row.editKind === 'event' && row.targetName === '_按钮1_被单击'));
  assert.ok(rows.some(row => row.editKind === 'missing-event' && row.status === 'missing-source' && row.editable));
  assert.ok(rows.every(row => row.line > 0));
});

test('LingCpp in-process language service facade exposes future LSP adapter shape', () => {
  const context = buildLingCppLanguageContext(sampleSource, sampleProject, undefined, 'src/MainWindow.lcpp');
  const hover = getLingCppHover({ source: sampleSource, line: 5, column: 3 }, context);

  assert.ok(hover?.contents.includes('类'));
  assert.ok(lingCppLanguageService.getDocumentSymbols(sampleSource).some(symbol => symbol.kind === 'class'));
  assert.ok(lingCppLanguageService.getFoldingRanges(sampleSource).length > 0);
  assert.equal(lingCppLanguageService.formatDocument(sampleSource), formatLingCpp(sampleSource));
});

test('LingCpp language service emits outline symbols and folding ranges', () => {
  const parsed = parseLingCpp(sampleSource);
  const symbols = getLingCppSymbols(sampleSource);
  const classSymbol = symbols.find(symbol => symbol.kind === 'class');
  const eventMethod = parsed.program.classes[0]?.methods.find(method => method.kind === 'event');

  assert.equal(classSymbol?.name, parsed.program.classes[0]?.name);
  assert.ok(classSymbol?.children?.some(child => child.kind === 'event' && child.name === eventMethod?.name));
  assert.ok(classSymbol?.children?.some(child => child.kind === 'constructor'));

  const foldingRanges = getLingCppFoldingRanges(sampleSource);
  assert.ok(foldingRanges.some(range => range.startLine === classSymbol?.line && range.endLine > range.startLine));
  assert.ok(foldingRanges.some(range => range.endLine > range.startLine && range.startLine > (classSymbol?.line || 0)));
});

test('LingCpp language service reports block diagnostics and keeps formatting idempotent', () => {
  const brokenSource = sampleSource.replace(LING_CPP_KEYWORDS[13], '');
  const diagnostics = getLingCppSemanticDiagnostics(brokenSource);

  assert.ok(diagnostics.some(diagnostic => diagnostic.id.includes('lingcpp-language-error')));

  const formatted = formatLingCpp(sampleSource);
  assert.equal(formatLingCpp(formatted), formatted);
});

test('LingCpp completions include snippets for events and control flow', () => {
  const completions = getLingCppCompletions({ source: sampleSource, line: 1, column: 1 });

  assert.ok(completions.some(item => item.kind === 'event' && item.isSnippet));
  assert.ok(completions.some(item => item.label === LING_CPP_KEYWORDS[11] && item.isSnippet));
  assert.ok(completions.some(item => item.label === LING_CPP_KEYWORDS[14] && item.isSnippet));
});

test('LingCpp bilingual completions support Chinese, English aliases and pinyin triggers', () => {
  const messageByEnglish = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'msg' }, sampleProject);
  const messageByPinyin = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'xxk' }, sampleProject);
  const debugByEnglish = getLingCppBilingualCompletions({ source: sampleSource, line: 22, column: 9, triggerText: 'DebugOutput' }, sampleProject);
  const contextKind = getLingCppCompletionContextKind(sampleSource, 22, 9);

  assert.equal(contextKind, 'event-body');
  assert.ok(messageByEnglish.some(item => item.aliases?.includes('MessageBox') && item.category === 'command'));
  assert.ok(messageByPinyin.some(item => item.pinyin?.includes('xxk') && item.category === 'command'));
  assert.ok(debugByEnglish.some(item => item.aliases?.includes('DebugOutput') && item.category === 'command'));
  assert.ok(messageByEnglish.some(item => item.example && item.audienceText));
});

test('LingCpp bilingual completions include designer event snippets in class context', () => {
  const completions = getLingCppBilingualCompletions({ source: sampleSource, line: 8, column: 5, triggerText: 'Click' }, sampleProject);

  assert.ok(completions.some(item => item.category === 'designer' && item.isSnippet && item.insertText.includes('事件')));
  assert.ok(completions.some(item => item.category === 'event' && item.isSnippet));
});

test('LingCpp bilingual completions suggest designer windows inside open-window arguments', () => {
  const source = `包 太空冒险
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    事件 _按钮1_被单击()
        打开窗口("太")
结束类`;
  const completions = getLingCppBilingualCompletions({
    source,
    line: 7,
    column: '        打开窗口("太'.length + 1,
    triggerText: '太'
  }, sampleProject);

  assert.ok(completions.some(item => item.label === '太空冒险' && item.insertText === '太空冒险'));
  assert.equal(completions.some(item => item.label === '信息框'), false);
});

test('LingCpp designer bindings produce bound and missing-source hints', () => {
  const boundHints = getLingCppDesignerBindings(sampleSource, sampleProject, 'src/MainWindow.lcpp');
  const firstBoundHandler = sampleProject.windows[0]?.controls[0]?.events?.Click;

  assert.ok(boundHints.some(hint => hint.status === 'bound' && hint.handlerName === firstBoundHandler));
  assert.ok(boundHints.some(hint => hint.status === 'bound' && hint.displayText?.includes('已绑定')));

  const projectWithMissingSource: LingWindowProject = {
    ...sampleProject,
    windows: sampleProject.windows.map(win => ({
      ...win,
      controls: win.controls.map(control =>
        control.id === sampleProject.windows[0]?.controls[0]?.id
          ? { ...control, events: { ...(control.events || {}), DoubleClick: '_missing_handler' } }
          : control
      )
    }))
  };

  const missingHints = getLingCppDesignerBindings(sampleSource, projectWithMissingSource, 'src/MainWindow.lcpp');
  const diagnostics = getLingCppSemanticDiagnostics(sampleSource, projectWithMissingSource, 'src/MainWindow.lcpp');
  const problems = getLingCppProblems(sampleSource, projectWithMissingSource, 'src/MainWindow.lcpp');
  assert.ok(missingHints.some(hint => hint.status === 'missing-source' && hint.handlerName === '_missing_handler'));
  assert.equal(diagnostics.some(diagnostic => diagnostic.id.includes('missing-source')), false);
  assert.ok(problems.some(problem => problem.id.includes('missing-source') && problem.actionLabel === '生成事件函数'));
  assert.equal(missingHints.find(hint => hint.status === 'missing-source' && hint.handlerName === '_missing_handler')?.line, parseLingCpp(sampleSource).program.classes[0]?.endLine);
  assert.equal(problems.find(problem => problem.actionKind === 'generate-event')?.locationKind, 'insertion');
  assert.equal(new Set(problems.map(problem => problem.id)).size, problems.length);
  assert.equal(problems.filter(problem => problem.codeSnippet === '_missing_handler').length, 1);
});

test('LingCpp designer diagnostics ignore handlers registered through enabled module callback bindings', () => {
  const callbackModule: InstalledModule = {
    isInstalled: true,
    isEnabledForProject: true,
    installPath: 'C:/modules/com.example.callbacks',
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.callbacks',
      name: '测试回调模块',
      version: '1.0.0',
      category: '系统',
      description: '验证模块回调处理器不会被误判为设计器控件事件。',
      contributes: {
        commands: [{
          name: '自定义模块_订阅',
          signature: '自定义模块_订阅(频道, 回调处理器名称)',
          description: '订阅频道并把事件交给指定处理器。'
        }]
      },
      bindings: {
        commands: [{
          command: '自定义模块_订阅',
          runtimeName: 'CustomModuleSubscribe',
          parameters: [
            { name: '频道', type: 'wideString' },
            { name: '回调处理器名称', type: 'wideString' }
          ],
          returnType: 'void'
        }]
      }
    }
  };
  const source = [
    '包 模块回调测试',
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    文本型 关联设计文件 = "MainWindow.xml"',
    '    构造()',
    '        自定义模块_订阅("状态,更新", "数据通道_收到消息")',
    '    结束',
    '    事件 数据通道_收到消息()',
    '        调试输出("已收到")',
    '    结束',
    '结束类'
  ].join('\n');
  const moduleContext = { enabledModules: [callbackModule], availableModules: [callbackModule] };

  const withoutModule = getLingCppDesignerBindings(source, sampleProject, 'src/MainWindow.lcpp');
  const withModule = getLingCppDesignerBindings(source, sampleProject, 'src/MainWindow.lcpp', moduleContext);
  const diagnostics = getLingCppSemanticDiagnostics(source, sampleProject, 'src/MainWindow.lcpp', moduleContext);
  const problems = getLingCppProblems(source, sampleProject, 'src/MainWindow.lcpp', moduleContext);
  const languageContext = buildLingCppLanguageContext(
    source,
    sampleProject,
    moduleContext,
    'src/MainWindow.lcpp'
  );
  const structuredRows = getLingCppStructuredRows(languageContext);
  const readableBlocks = getLingCppReadableBlocks(
    source,
    sampleProject,
    'src/MainWindow.lcpp',
    moduleContext
  );
  const structure = getLingCppStructureView(
    source,
    sampleProject,
    'src/MainWindow.lcpp',
    moduleContext
  );

  assert.ok(withoutModule.some(hint => hint.handlerName === '数据通道_收到消息' && hint.status === 'missing-control'));
  assert.equal(withModule.some(hint => hint.handlerName === '数据通道_收到消息'), false);
  assert.equal(diagnostics.some(item => item.codeSnippet === '数据通道_收到消息'), false);
  assert.equal(problems.some(item => item.codeSnippet === '数据通道_收到消息'), false);
  assert.equal(
    structuredRows.find(row => row.targetName === '数据通道_收到消息')?.status,
    undefined
  );
  assert.equal(
    readableBlocks.find(block => block.handlerName === '数据通道_收到消息')?.bindingStatus,
    undefined
  );
  assert.equal(
    structure.flatMap(node => node.children || []).find(node => node.name === '数据通道_收到消息')?.status,
    undefined
  );
});

test('LingCpp readable names and blocks summarize events for reading mode', () => {
  const readableName = getReadableEventName('_确认关闭按钮_被单击', sampleProject);
  assert.equal(readableName.subject, '确认关闭按钮');
  assert.equal(readableName.eventLabel, '单击事件');
  assert.equal(readableName.displayName, '确认关闭按钮 · 单击事件');

  const blocks = getLingCppReadableBlocks(sampleSource, sampleProject, 'src/MainWindow.lcpp');
  assert.ok(blocks.some(block => block.kind === 'class' && block.title.includes('窗口类')));
  assert.ok(blocks.some(block => block.kind === 'constructor'));
  assert.ok(blocks.some(block => block.kind === 'window-event'));
  assert.ok(blocks.some(block => block.kind === 'control-event' && block.actionCount > 0));
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'message-box')));
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'debug-output')));
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'exit-program')));
});

test('LingCpp reading mode produces inline hints and block highlights', () => {
  const hints = getLingCppInlineHints(sampleSource, sampleProject, 'src/MainWindow.lcpp', 'beginner');
  const highlights = getLingCppEventBlockHighlights(sampleSource, sampleProject, 'src/MainWindow.lcpp');

  assert.ok(hints.some(hint => hint.kind === 'class' && hint.text === '窗口类'));
  assert.ok(hints.some(hint => hint.kind === 'constructor'));
  assert.ok(hints.some(hint => hint.kind === 'event' && hint.text.includes('事件')));
  assert.ok(hints.some(hint => hint.kind === 'action' && hint.text === '提示框'));
  assert.ok(highlights.some(highlight => highlight.kind === 'window-event'));
  assert.ok(highlights.some(highlight => highlight.kind === 'control-event' && highlight.actionKinds.includes('message-box')));
});

test('LingCpp reading mode handles the real multi-event main window sample', () => {
  const realSource = readFileSync(resolve(process.cwd(), '..', 'src', '游戏主窗体.lcpp'), 'utf8');
  const realProject: LingWindowProject = {
    id: 'real-main-window-project',
    name: 'real-main-window-project',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: parseLingCpp(realSource).program.classes[0]?.name || 'MainWindow',
      title: parseLingCpp(realSource).program.classes[0]?.name || 'MainWindow',
      width: 960,
      height: 640,
      background: '#1E1E24',
      description: 'real main window',
      controls: [
        {
          id: 'button-exit',
          type: 'Button',
          name: '鎸夐挳2',
          content: 'exit',
          width: 120,
          height: 36,
          x: 0,
          y: 0,
          fontSize: 14,
          background: '#333333',
          foreground: '#ffffff',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: '_鎸夐挳2_琚崟鍑?' }
        },
        {
          id: 'button-start',
          type: 'Button',
          name: '鎸夐挳_杩涘叆澶┖鍐掗櫓',
          content: 'start',
          width: 120,
          height: 36,
          x: 0,
          y: 44,
          fontSize: 14,
          background: '#333333',
          foreground: '#ffffff',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: '_鎸夐挳_杩涘叆澶┖鍐掗櫓_琚崟鍑?' }
        }
      ]
    }]
  };

  const blocks = getLingCppReadableBlocks(realSource, realProject, 'src/游戏主窗体.lcpp');
  const eventBlocks = blocks.filter(block => block.kind === 'window-event' || block.kind === 'control-event');
  const highlights = getLingCppEventBlockHighlights(realSource, realProject, 'src/游戏主窗体.lcpp');
  const hints = getLingCppInlineHints(realSource, realProject, 'src/游戏主窗体.lcpp', 'beginner');
  const rows = getLingCppStructuredReadingRows(realSource, realProject, 'src/游戏主窗体.lcpp');

  assert.ok(eventBlocks.length >= 3);
  assert.ok(eventBlocks.some(block => block.kind === 'window-event'));
  assert.ok(eventBlocks.filter(block => block.kind === 'control-event').length >= 2);
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'message-box')));
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'debug-output')));
  assert.ok(blocks.some(block => block.actions.some(action => action.kind === 'exit-program')));
  assert.ok(highlights.length >= 4);
  assert.ok(hints.filter(hint => hint.kind === 'event').length >= 3);
  assert.ok(rows.some(row => row.group === 'package'));
  assert.ok(rows.some(row => row.group === 'class'));
  assert.ok(rows.some(row => row.group === 'member'));
  assert.ok(rows.filter(row => row.group === 'event').length >= 3);
  assert.ok(rows.some(row => row.note && row.line > 0));
});

test('LingCpp designer bindings treat class-prefixed events as window events', () => {
  const source = [
    `${LING_CPP_KEYWORDS[0]} Demo`,
    `${LING_CPP_KEYWORDS[2]} MainWindow : ${LING_CPP_KEYWORDS[3]} ${LING_CPP_TYPES[0]}`,
    `${LING_CPP_KEYWORDS[3]}:`,
    `    ${LING_CPP_TYPES[0]} DesignerFile = "MainWindow.xml"`,
    `    ${LING_CPP_KEYWORDS[8]} MainWindow_Created()`,
    `${LING_CPP_KEYWORDS[16]}`
  ].join('\n');
  const project: LingWindowProject = {
    id: 'window-event-project',
    name: 'Demo',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#111111',
      description: 'MainWindow',
      controls: []
    }]
  };

  const hints = getLingCppDesignerBindings(source, project, 'src/MainWindow.lcpp');

  assert.ok(hints.some(hint => hint.status === 'bound' && hint.eventName === 'Window'));
  assert.equal(hints.some(hint => hint.status === 'missing-control'), false);
});

test('LingCpp designer bindings treat bare registered event names as window events', () => {
  const source = [
    `${LING_CPP_KEYWORDS[2]} MainWindow`,
    `    ${LING_CPP_KEYWORDS[8]} 创建完毕()`,
    '    结束',
    `${LING_CPP_KEYWORDS[16]}`
  ].join('\n');
  const project: LingWindowProject = {
    id: 'bare-window-event-project',
    name: 'Demo',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#111111',
      description: 'MainWindow',
      controls: []
    }]
  };

  const hints = getLingCppDesignerBindings(source, project, 'src/MainWindow.lcpp');
  const diagnostics = getLingCppSemanticDiagnostics(source, project, 'src/MainWindow.lcpp');

  assert.ok(hints.some(hint => hint.status === 'bound' && hint.eventName === 'Window'));
  assert.equal(hints.some(hint => hint.status === 'missing-control'), false);
  assert.equal(diagnostics.some(diagnostic => diagnostic.message.includes('控件不存在')), false);
});

test('LingCpp designer bindings use associated designer file to isolate other windows', () => {
  const source = [
    `${LING_CPP_KEYWORDS[0]} Demo`,
    `${LING_CPP_KEYWORDS[2]} MainWindow : ${LING_CPP_KEYWORDS[3]} ${LING_CPP_TYPES[0]}`,
    `${LING_CPP_KEYWORDS[3]}:`,
    `    ${LING_CPP_TYPES[0]} DesignerFile = "MainWindow.xml"`,
    `${LING_CPP_KEYWORDS[16]}`
  ].join('\n');
  const project: LingWindowProject = {
    id: 'multi-window-project',
    name: 'Demo',
    windows: [
      {
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: 'MainWindow',
        width: 640,
        height: 480,
        background: '#111111',
        description: 'MainWindow',
        controls: []
      },
      {
        id: 'other-window',
        fileName: 'OtherWindow.xml',
        className: 'OtherWindow',
        title: 'OtherWindow',
        width: 640,
        height: 480,
        background: '#111111',
        description: 'OtherWindow',
        controls: [{
          id: 'other-button',
          type: 'Button',
          name: 'OtherButton',
          content: 'Other',
          width: 80,
          height: 28,
          x: 10,
          y: 10,
          fontSize: 12,
          background: '#222222',
          foreground: '#ffffff',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: '_missing_other_window_handler' }
        }]
      }
    ]
  };

  const diagnostics = getLingCppSemanticDiagnostics(source, project, 'src/MainWindow.lcpp');

  assert.equal(diagnostics.some(diagnostic => diagnostic.id.includes('_missing_other_window_handler')), false);
});

test('LingCpp structure view lists package, classes, designer file, members and events', () => {
  const structure = getLingCppStructureView(sampleSource, sampleProject, 'src/MainWindow.lcpp');
  const classNode = structure.find(node => node.kind === 'class');

  assert.ok(structure.some(node => node.kind === 'package'));
  assert.ok(classNode);
  assert.ok(classNode?.children?.some(node => node.kind === 'designer'));
  assert.ok(classNode?.children?.some(node => node.kind === 'member'));
  assert.ok(classNode?.children?.some(node => node.kind === 'event' && node.status === 'bound'));
});

test('LingCpp AST edit service rewrites structural intents minimally and preserves source on failure', () => {
  const renamedClass = applyLingCppAstEdit(sampleSource, {
    kind: 'update-class',
    className: '游戏主窗体',
    newName: '主窗体',
    baseClass: '窗体'
  });
  assert.equal(renamedClass.success, true);
  assert.ok(renamedClass.sourceCode.includes('类 主窗体 : 公开 窗体'));
  assert.ok(renamedClass.change);
  assert.notEqual(renamedClass.sourceCode, sampleSource);

  const renamedMember = applyLingCppAstEdit(sampleSource, {
    kind: 'update-member',
    className: '游戏主窗体',
    memberName: '记住我',
    newName: '是否记住'
  });
  assert.equal(renamedMember.success, true);
  assert.ok(renamedMember.sourceCode.includes('复选框 是否记住'));
  assert.ok(renamedMember.change?.newText.includes('是否记住'));

  const updatedMemberFlags = applyLingCppAstEdit(renamedMember.sourceCode, {
    kind: 'update-member',
    className: '游戏主窗体',
    memberName: '是否记住',
    isStatic: true,
    isArray: true,
    note: '保存多个记住状态'
  });
  assert.equal(updatedMemberFlags.success, true);
  assert.ok(updatedMemberFlags.sourceCode.includes('// 保存多个记住状态'));
  assert.ok(updatedMemberFlags.sourceCode.includes('静态 复选框 是否记住[]'));
  const parsedUpdatedMember = parseLingCpp(updatedMemberFlags.sourceCode)
    .program.classes[0]
    .members.find(member => member.name === '是否记住');
  assert.equal(parsedUpdatedMember?.isStatic, true);
  assert.equal(parsedUpdatedMember?.isArray, true);

  const renamedEvent = applyLingCppAstEdit(sampleSource, {
    kind: 'update-event',
    className: '游戏主窗体',
    handlerName: '_按钮1_被单击',
    newHandlerName: '_开始按钮_被单击'
  });
  assert.equal(renamedEvent.success, true);
  assert.ok(renamedEvent.sourceCode.includes('事件 _开始按钮_被单击()'));
  assert.equal(parseLingCpp(renamedEvent.sourceCode).diagnostics.some(diagnostic => diagnostic.level === 'error'), false);

  const updatedBody = applyLingCppAstEdit(sampleSource, {
    kind: 'update-method-body',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    bodyLines: [
      '调试输出("新手模式直接写代码")',
      '信息框("已经写回源码", 64, "提示")'
    ]
  });
  assert.equal(updatedBody.success, true);
  assert.ok(updatedBody.sourceCode.includes('事件 _按钮1_被单击()'));
  assert.ok(updatedBody.sourceCode.includes('        调试输出("新手模式直接写代码")'));
  assert.ok(updatedBody.sourceCode.includes('        信息框("已经写回源码", 64, "提示")'));
  assert.equal(updatedBody.sourceCode.includes('按钮被点击'), false);
  assert.equal(parseLingCpp(updatedBody.sourceCode).diagnostics.some(diagnostic => diagnostic.level === 'error'), false);

  const addedFunction = applyLingCppAstEdit(sampleSource, {
    kind: 'add-method',
    className: '游戏主窗体',
    method: {
      name: '显示状态',
      returnType: '空',
      parameters: [
        { type: '文本型', name: '标题' },
        { type: '整数型', name: '次数' }
      ],
      bodyLines: ['调试输出("显示状态")'],
      note: '新手模式新增的功能代码'
    }
  });
  assert.equal(addedFunction.success, true);
  assert.ok(addedFunction.sourceCode.includes('空 显示状态(文本型 标题, 整数型 次数)'));
  assert.ok(addedFunction.sourceCode.includes('        调试输出("显示状态")'));

  const updatedFunctionSignature = applyLingCppAstEdit(addedFunction.sourceCode, {
    kind: 'update-method-signature',
    className: '游戏主窗体',
    methodName: '显示状态',
    returnType: '整数型',
    access: '公开',
    isStatic: true,
    note: '可被类直接调用的状态功能'
  });
  assert.equal(updatedFunctionSignature.success, true);
  assert.ok(updatedFunctionSignature.sourceCode.includes('公开:'));
  assert.ok(updatedFunctionSignature.sourceCode.includes('// 可被类直接调用的状态功能'));
  assert.ok(updatedFunctionSignature.sourceCode.includes('静态 整数型 显示状态(文本型 标题, 整数型 次数)'));
  const parsedUpdatedFunction = parseLingCpp(updatedFunctionSignature.sourceCode)
    .program.classes[0]
    .methods.find(method => method.name === '显示状态');
  assert.equal(parsedUpdatedFunction?.access, '公开');
  assert.equal(parsedUpdatedFunction?.isStatic, true);
  assert.equal(parsedUpdatedFunction?.returnType, '整数型');

  const clearedFunctionNote = applyLingCppAstEdit(updatedFunctionSignature.sourceCode, {
    kind: 'update-method-signature',
    className: '游戏主窗体',
    methodName: '显示状态',
    note: ''
  });
  assert.equal(clearedFunctionNote.success, true);
  assert.equal(clearedFunctionNote.sourceCode.includes('// 可被类直接调用的状态功能'), false);

  const eventCallsFunction = applyLingCppAstEdit(addedFunction.sourceCode, {
    kind: 'update-method-body',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    bodyLines: ['显示状态("启动", 3)']
  });
  assert.equal(eventCallsFunction.success, true);
  assert.ok(eventCallsFunction.sourceCode.includes('        显示状态("启动", 3)'));
  assert.equal(parseLingCpp(eventCallsFunction.sourceCode).diagnostics.some(diagnostic => diagnostic.level === 'error'), false);

  const addedFunctionWithDefaults = applyLingCppAstEdit(sampleSource, {
    kind: 'add-method',
    className: '游戏主窗体',
    method: {
      name: '提示玩家',
      returnType: '空',
      parameters: [
        { type: '文本型', name: '标题', defaultValue: '"提示"' },
        { type: '整数型', name: '次数', defaultValue: '1' }
      ],
      bodyLines: ['调试输出(标题)']
    }
  });
  assert.equal(addedFunctionWithDefaults.success, true);
  assert.ok(addedFunctionWithDefaults.sourceCode.includes('空 提示玩家(文本型 标题 = "提示", 整数型 次数 = 1)'));
  const parsedFunctionWithDefaults = parseLingCpp(addedFunctionWithDefaults.sourceCode)
    .program.classes[0]
    .methods.find(method => method.name === '提示玩家');
  assert.equal(parsedFunctionWithDefaults?.parameters[0]?.defaultValue, '"提示"');
  assert.equal(parsedFunctionWithDefaults?.parameters[1]?.defaultValue, '1');
  const structuredFunctionWithDefaults = getLingCppStructuredRows(buildLingCppLanguageContext(addedFunctionWithDefaults.sourceCode))
    .find(row => row.targetName === '提示玩家');
  assert.ok(structuredFunctionWithDefaults?.value?.includes('文本型 标题 = "提示"'));

  const failed = applyLingCppAstEdit(sampleSource, {
    kind: 'delete-member',
    className: '游戏主窗体',
    memberName: '不存在成员'
  });
  assert.equal(failed.success, false);
  assert.equal(failed.sourceCode, sampleSource);
});

test('LingCpp AST edit service adds and deletes members and events for structure table editing', () => {
  const addedMember = applyLingCppAstEdit(sampleSource, {
    kind: 'add-member',
    className: '游戏主窗体',
    member: {
      name: '当前玩家',
      type: '文本型',
      initialValue: '"访客"',
      note: '结构表格新增的成员'
    }
  });
  assert.equal(addedMember.success, true);
  assert.ok(addedMember.sourceCode.includes('// 结构表格新增的成员'));
  assert.ok(addedMember.sourceCode.includes('文本型 当前玩家 = "访客"'));

  const removedMember = applyLingCppAstEdit(addedMember.sourceCode, {
    kind: 'delete-member',
    className: '游戏主窗体',
    memberName: '当前玩家'
  });
  assert.equal(removedMember.success, true);
  assert.equal(removedMember.sourceCode.includes('当前玩家'), false);

  const addedEvent = applyLingCppAstEdit(sampleSource, {
    kind: 'add-event',
    className: '游戏主窗体',
    event: {
      handlerName: '_按钮3_被单击',
      parameters: [{ type: '文本型', name: '来源' }],
      note: '结构表格新增的事件'
    }
  });
  assert.equal(addedEvent.success, true);
  assert.ok(addedEvent.sourceCode.includes('// 结构表格新增的事件'));
  assert.ok(addedEvent.sourceCode.includes('事件 _按钮3_被单击(文本型 来源)'));
  assert.equal(parseLingCpp(addedEvent.sourceCode).diagnostics.some(diagnostic => diagnostic.level === 'error'), false);

  const removedEvent = applyLingCppAstEdit(addedEvent.sourceCode, {
    kind: 'delete-event',
    className: '游戏主窗体',
    handlerName: '_按钮3_被单击'
  });
  assert.equal(removedEvent.success, true);
  assert.equal(removedEvent.sourceCode.includes('_按钮3_被单击'), false);

  const addedMethod = applyLingCppAstEdit(sampleSource, {
    kind: 'add-method',
    className: '游戏主窗体',
    method: {
      name: '临时子程序',
      returnType: '空',
      bodyLines: ['调试输出("临时子程序")']
    }
  });
  assert.equal(addedMethod.success, true);
  assert.ok(addedMethod.sourceCode.includes('空 临时子程序()'));

  const removedMethod = applyLingCppAstEdit(addedMethod.sourceCode, {
    kind: 'delete-method',
    className: '游戏主窗体',
    methodName: '临时子程序'
  });
  assert.equal(removedMethod.success, true);
  assert.equal(removedMethod.sourceCode.includes('临时子程序'), false);
});

test('generateLingCppNativeWin32Project emits OOP Win32 class code and event wiring', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: sampleSource
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('class 游戏主窗体 : public LingWindowBase'));
  assert.ok(mainCpp.includes('void DispatchWindowEvent(const wchar_t* eventName) override'));
  assert.ok(mainCpp.includes('if (handler == L"_游戏主窗体_创建完毕") { 游戏主窗体_创建完毕(); return; }'));
  assert.ok(mainCpp.includes('void 按钮1_被单击()'));
  assert.ok(mainCpp.includes('信息框(L"开始运行", MB_OK | MB_ICONINFORMATION, L"提示");'));
  assert.ok(mainCpp.includes('if (信息框(L"确认退出？", MB_YESNO | MB_ICONQUESTION, L"退出确认") == IDYES) { 结束(); return; }'));
  assert.ok(mainCpp.includes('void 游戏主窗体_文件_被选择()'));
  assert.ok(mainCpp.includes('find_first_not_of(L" \\t\\r\\n,")'));
  assert.equal(/find_first_not_of\(L"[^"\r\n]*[\r\n]/u.test(mainCpp), false);
  assert.ok(mainCpp.includes('RoundRect(item->hDC'));
  assert.ok(mainCpp.includes('int cornerRadius;'));
  assert.ok(mainCpp.includes('ScaleForDpi(control->cornerRadius, dpi_)'));
  assert.ok(mainCpp.includes('#include <gdiplus.h>'));
  assert.ok(mainCpp.includes('#pragma comment(lib, "gdiplus.lib")'));
  assert.ok(mainCpp.includes('DrawAntiAliasedRoundedRectangle'));
  assert.ok(mainCpp.includes('Gdiplus::SmoothingModeAntiAlias'));
  assert.ok(mainCpp.includes('Gdiplus::PixelOffsetModeHalf'));
  assert.ok(mainCpp.includes('Gdiplus::GdiplusStartup'));
  assert.ok(mainCpp.includes('Gdiplus::GdiplusShutdown'));
  assert.ok(mainCpp.includes('if (radius == 0)'));
  assert.match(mainCpp, /L"Button", L"按钮1", L"开始", 48, 72, 120, 36, 14, 18,/);
  assert.match(mainCpp, /L"Button", L"按钮2", L"退出", 48, 124, 120, 36, 14, 0,/);
  assert.ok(mainCpp.includes('static COLORREF BlendColor'));
  assert.ok(mainCpp.includes('bool IsButtonControl(const ControlSpec& control) const'));
  assert.ok(mainCpp.includes('IsWindowEnabled(item->hwndItem) != FALSE'));
  assert.ok(mainCpp.includes('bool hovered = enabled && !pressed && runtime->mouseInside'));
  assert.ok(mainCpp.includes('&& (item->itemState & ODS_FOCUS)'));
  assert.ok(mainCpp.includes('&& !(item->itemState & ODS_NOFOCUSRECT)'));
  assert.ok(mainCpp.includes('COLORREF rowBackground = control->backgroundTransparent ? surrounding : control->background'));
  assert.ok(mainCpp.includes('HBRUSH backgroundBrush = CreateSolidBrush(rowBackground)'));
  assert.ok(mainCpp.includes('(hovered || focused) ? RGB(125, 211, 252)'));
  assert.ok(mainCpp.includes('focused && !IsType(*control, L"CheckBox") && !IsType(*control, L"RadioButton")'));
  assert.ok(mainCpp.includes('HGDIOBJ previousMarkPen = SelectObject(item->hDC, markPen)'));
  assert.ok(mainCpp.includes('SelectObject(item->hDC, previousDotBrush)'));
  assert.ok(mainCpp.includes('int checkState;'));
  assert.ok(mainCpp.includes('ownerDrawSelection && message == BM_GETCHECK'));
  assert.ok(mainCpp.includes('ownerDrawSelection && message == BM_SETCHECK'));
  assert.ok(mainCpp.includes('runtime->checkState = nextState'));
  assert.ok(mainCpp.includes('NotifyWinEvent(EVENT_OBJECT_STATECHANGE'));
  assert.ok(mainCpp.includes('checkState == BST_INDETERMINATE'));
  assert.ok(mainCpp.includes('if (control->flags & CF_THREE_STATE)'));
  assert.ok(mainCpp.includes('currentState == BST_CHECKED ? BST_INDETERMINATE'));
  assert.ok(mainCpp.includes('background = BlendColor(control->background, RGB(255, 255, 255), 10)'));
  assert.ok(mainCpp.includes('background = BlendColor(control->background, RGB(0, 0, 0), 16)'));
  assert.ok(mainCpp.includes('RGB(125, 211, 252)'));
  assert.equal(mainCpp.includes('DrawFocusRect(item->hDC'), false);
  assert.ok(mainCpp.includes('message == WM_PAINT && IsType(*control, L"ProgressBar")'));
  assert.ok(mainCpp.includes('swprintf_s(label, L"%d%%", percent)'));
  assert.ok(mainCpp.includes('SetTextColor(hdc, RGB(255, 255, 255))'));
  assert.ok(mainCpp.includes('CreateRoundRectRgn'));
  assert.ok(mainCpp.includes('EM_SETMARGINS'));
  assert.ok(mainCpp.includes('className = L"EDIT";'));
  assert.ok(mainCpp.includes('SendMessageW(child, EM_SETMARGINS'));
  assert.ok(mainCpp.includes('HWND frameHwnd;'));
  assert.ok(mainCpp.includes('TextBoxFrameSubclassProc'));
  assert.ok(mainCpp.includes('LayoutTextBoxControl'));
  assert.ok(mainCpp.includes('GetTextMetricsW(hdc, &metrics)'));
  assert.ok(mainCpp.includes('FillRgn(hdc, outerRegion, borderBrush)'));
  assert.ok(mainCpp.includes('GetFocus() == runtime->hwnd'));
  assert.ok(mainCpp.includes('RGB(14, 165, 233)'));
  assert.ok(mainCpp.includes('RGB(51, 65, 85)'));
  assert.ok(mainCpp.includes('int borderWidth = 1;'));
  assert.ok(mainCpp.includes('cornerDiameter = std::max(ScaleForDpi(8, self->dpi_), 4)'));
  assert.ok(mainCpp.includes('rect.left + borderWidth, rect.top + borderWidth'));
  assert.ok(mainCpp.includes('rect.right - borderWidth, rect.bottom - borderWidth'));
  assert.ok(mainCpp.includes('SetFocus(runtime->hwnd)'));
  assert.ok(mainCpp.includes('InvalidateRect(runtime->frameHwnd, nullptr, FALSE)'));
  assert.ok(mainCpp.includes('if (ownerDraw) InvalidateRect(hwnd, nullptr, FALSE)'));
  assert.ok(mainCpp.includes('message == WM_MOUSELEAVE'));
  assert.ok(mainCpp.includes('message == WM_ENABLE'));
  assert.ok(mainCpp.includes('message == BM_SETSTATE'));
  assert.ok(mainCpp.includes('wParam == VK_SPACE'));
  assert.ok(mainCpp.includes('UpdateWindow(hwnd)'));
  assert.ok(mainCpp.includes('if (buttonControl)'));
  assert.ok(mainCpp.includes('if (!IsWindow(hwnd)) return result;'));
  assert.ok(mainCpp.includes('if (!liveRuntime || liveRuntime->hwnd != hwnd) return result;'));
  assert.ok(mainCpp.includes('style |= WS_TABSTOP;'));
  assert.ok(mainCpp.includes('style |= WS_TABSTOP | BS_OWNERDRAW;'));
  assert.ok(mainCpp.includes('HWND startWindow = OpenGeneratedWindow'));
  assert.ok(mainCpp.includes('IsDialogMessageW(navigationRoot, &message)'));
  assert.ok(mainCpp.includes('SendMessageW(self->hwnd_, WM_COMMAND, wParam, lParam)'));
  assert.equal(mainCpp.includes('WM_NCCALCSIZE'), false);
  assert.equal(mainCpp.includes('GetWindowDC(hwnd)'), false);
  assert.equal(mainCpp.includes('RDW_FRAME'), false);
  assert.equal(mainCpp.includes('SetWindowRgn(child'), false);
  assert.ok(mainCpp.includes('TextEquals(control.data2, L"bottom")'));
  assert.ok(mainCpp.includes('TextEquals(control.data2, L"top")'));
  const textBoxBranchStart = mainCpp.indexOf('} else if (IsType(control, L"TextBox")) {');
  const textBoxBranchEnd = mainCpp.indexOf('} else if (IsType(control, L"Label")) {', textBoxBranchStart);
  assert.ok(textBoxBranchStart >= 0 && textBoxBranchEnd > textBoxBranchStart);
  const textBoxBranch = mainCpp.slice(textBoxBranchStart, textBoxBranchEnd);
  assert.equal(textBoxBranch.includes('WM_NCPAINT'), false);
  assert.doesNotMatch(textBoxBranch, /WS_BORDER|WS_EX_CLIENTEDGE/);

  const stateTransitionsStart = mainCpp.indexOf('static LRESULT CALLBACK ControlSubclassProc');
  const stateTransitionsEnd = mainCpp.indexOf('bool CreateGeneratedControl', stateTransitionsStart);
  assert.ok(stateTransitionsStart >= 0 && stateTransitionsEnd > stateTransitionsStart);
  const stateTransitions = mainCpp.slice(stateTransitionsStart, stateTransitionsEnd);
  assert.doesNotMatch(
    stateTransitions,
    /\b(?:MoveWindow|SetWindowPos|SetWindowRgn|DeferWindowPos|AdjustWindowRectEx)\s*\(/
  );

  const layoutJson = generated.files.find(file => file.relativePath === 'layout.json')?.content || '';
  assert.equal(JSON.parse(layoutJson).id, 'sample-project');
});

test('generateLingCppNativeWin32Project paints Grid with the designer background brush', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: sampleSource
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const gridBranchStart = mainCpp.indexOf('} else if (IsType(control, L"Grid")) {');
  const gridBranchEnd = mainCpp.indexOf('} else if (IsType(control, L"ListView")) {', gridBranchStart);

  assert.ok(gridBranchStart >= 0 && gridBranchEnd > gridBranchStart);
  const gridBranch = mainCpp.slice(gridBranchStart, gridBranchEnd);
  assert.ok(gridBranch.includes('style |= SS_NOTIFY;'));
  assert.equal(gridBranch.includes('style |= SS_WHITERECT;'), false);
  assert.ok(mainCpp.includes('case WM_CTLCOLORSTATIC:'));
  assert.ok(mainCpp.includes('if (runtime && runtime->brush) return reinterpret_cast<LRESULT>(runtime->brush);'));
});

test('generateLingCppNativeWin32Project translates beginner open-window commands', () => {
  const projectWithAboutWindow: LingWindowProject = {
    ...sampleProject,
    windows: [
      {
        ...sampleProject.windows[0],
        menuItems: '关于太空冒险客户端',
        menuEvents: {
          Item_0: '_关于菜单_被选择'
        }
      },
      {
        id: 'about-window',
        fileName: 'AboutWindow.xml',
        className: '关于窗体',
        title: '关于太空冒险客户端',
        width: 520,
        height: 360,
        background: '#1E1E24',
        description: '关于窗口',
        openPlacement: 'center',
        controls: []
      }
    ]
  };
  const source = `包 太空冒险
使用 Win32窗口
使用 标准控件

类 游戏主窗体 : 公开 窗体
公开:
    事件 _关于菜单_被选择()
        打开窗口("关于太空冒险客户端")
        打开窗口("关于太空冒险客户端", "居中")
        打开窗口("关于太空冒险客户端", 100, 200)
        载入窗口(L"关于窗体", "右下角")
结束类

类 关于窗体 : 公开 窗体
公开:
    事件 _关于窗体_创建完毕()
        调试输出("关于窗口载入")
结束类`;

  const generated = generateLingCppNativeWin32Project(projectWithAboutWindow, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('HWND 窗口_打开(const wchar_t* windowName, const wchar_t* placement = nullptr'));
  assert.ok(mainCpp.includes('static HWND OpenGeneratedWindowByName(const wchar_t* windowName, int showCommand, const wchar_t* placement = nullptr'));
  assert.ok(mainCpp.includes('窗口_打开(L"关于太空冒险客户端");'));
  assert.ok(mainCpp.includes('窗口_打开(L"关于太空冒险客户端", L"center");'));
  assert.ok(mainCpp.includes('窗口_打开(L"关于太空冒险客户端", L"custom", 100, 200, true);'));
  assert.ok(mainCpp.includes('窗口_打开(L"关于窗体", L"bottom-right");'));
  assert.ok(mainCpp.includes('ResolveWindowPlacement(spec_, windowWidth, windowHeight, placement, x, y, hasCustomPosition, windowX, windowY)'));
  assert.ok(mainCpp.includes('L"center", CW_USEDEFAULT, CW_USEDEFAULT, g_controls_1'));
  assert.ok(mainCpp.includes('WindowSpecMatchesName(g_windows[index], windowName)'));
  assert.ok(mainCpp.includes('void 关于菜单_被选择()'));
  assert.ok(mainCpp.includes('class 关于窗体 : public LingWindowBase'));
});

test('generateLingCppNativeWin32Project emits function methods, calls, return values and inline native C++', () => {
  const source = `包 太空冒险
使用 Win32窗口
使用 标准控件

类 游戏主窗体 : 公开 窗体
公开:
    文本型 关联设计文件 = "MainWindow.xml"
    按钮 按钮1

    事件 _按钮1_被单击()
        显示状态("启动", 3)

    静态 整数型 显示状态(文本型 标题, 整数型 次数)
        @ int pageIndex = 次数;
        @ if (pageIndex < 0)
        @     return -1;
        调试输出("准备返回页码")
        返回 (pageIndex)
结束类`;
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });

  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(parseLingCpp(source).program.classes[0].methods.find(method => method.name === '显示状态')?.isStatic, true);
  assert.ok(mainCpp.includes('static int 显示状态(std::wstring 标题, int 次数)'));
  assert.ok(mainCpp.includes('显示状态(L"启动", 3);'));
  assert.ok(mainCpp.includes('int pageIndex = 次数;'));
  assert.ok(mainCpp.includes('if (pageIndex < 0)'));
  assert.ok(mainCpp.includes('return -1;'));
  assert.ok(mainCpp.includes('调试输出(L"准备返回页码");'));
  assert.ok(mainCpp.includes('return pageIndex;'));
  assert.equal(mainCpp.includes('// 暂不支持的中文 C++ 语句：@'), false);
});

test('generateLingCppNativeWin32Project does not translate block end into exit command', () => {
  const source = `包 示例
类 游戏主窗体 : 窗口
公开
  事件 _游戏主窗体_创建完毕()
    调试输出("只初始化，不退出")
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('调试输出(L"只初始化，不退出");'));
  assert.equal(mainCpp.includes('        结束();'), false);
});

test('generateLingCppNativeWin32Project closes windows asynchronously to avoid creation-time double free', () => {
  const source = `包 示例
类 游戏主窗体 : 窗口
公开
  事件 _游戏主窗体_创建完毕()
    结束()
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('void 结束() {\n        if (hwnd_) PostMessageW(hwnd_, WM_CLOSE, 0, 0);\n    }'));
  assert.equal(mainCpp.includes('void 结束() {\n        if (hwnd_) DestroyWindow(hwnd_);\n    }'), false);
  assert.ok(mainCpp.includes('Avoid double-free when user code closes the window during creation.'));
  assert.equal(mainCpp.includes('if (!hwnd) {\n        delete window;'), false);
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

test('generateLingCppNativeWin32Project emits source map and native manifest', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: sampleSource,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules: [completionModule]
  });

  const manifest = generated.files.find(file => file.relativePath === 'lingbuilder-native-manifest.json');
  assert.ok(manifest);
  assert.ok(generated.sourceMap.some(entry => entry.symbolName.includes('\u6309\u94ae1')));
  assert.ok(manifest?.content.includes('"sourceFilePath": "src/MainWindow.lcpp"'));
});

test('importNativeCppToLingBuilder converts generated native cpp back to lcpp structures', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: sampleSource
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const manifest = generated.files.find(file => file.relativePath === 'lingbuilder-native-manifest.json')?.content || '';

  const imported = importNativeCppToLingBuilder(mainCpp, {
    project: sampleProject,
    activeWindowId: 'window-1',
    manifestText: manifest
  });

  assert.ok(imported.lcppSource.includes('类'));
  assert.ok(imported.lcppSource.includes('事件'));
  assert.ok(imported.report.some(item => item.includes('识别控件')));
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

test('新手编辑事务会一次性提交多个未失焦正文草稿', () => {
  const result = applyPendingBeginnerCodeDrafts(sampleSource, {
    [createBeginnerCodeDraftKey('游戏主窗体', 'event', '_按钮1_被单击')]: [
      '调试输出("按钮1草稿已提交")',
      '信息框("最新正文", 64, "保存")'
    ].join('\n'),
    [createBeginnerCodeDraftKey('游戏主窗体', 'event', '_按钮2_被单击')]: '调试输出("按钮2草稿已提交")'
  });

  assert.equal(result.success, true);
  assert.equal(result.changed, true);
  assert.equal(result.appliedDraftCount, 2);
  assert.ok(result.sourceCode.includes('调试输出("按钮1草稿已提交")'));
  assert.ok(result.sourceCode.includes('信息框("最新正文", 64, "保存")'));
  assert.ok(result.sourceCode.includes('调试输出("按钮2草稿已提交")'));
});

test('新手编辑事务失败时保持原源码且不返回部分提交结果', () => {
  const result = applyPendingBeginnerCodeDrafts(sampleSource, {
    [createBeginnerCodeDraftKey('游戏主窗体', 'event', '_按钮1_被单击')]: '调试输出("这段不能部分保存")',
    [createBeginnerCodeDraftKey('游戏主窗体', 'event', '_不存在的事件')]: '调试输出("无效目标")'
  });

  assert.equal(result.success, false);
  assert.equal(result.sourceCode, sampleSource);
  assert.equal(result.changed, false);
  assert.equal(result.appliedDraftCount, 0);
  assert.match(result.diagnostics[0] || '', /找不到待提交的代码块/u);
});
