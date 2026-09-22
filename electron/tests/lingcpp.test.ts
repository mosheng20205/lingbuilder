import test from 'node:test';
import './functionLibraries.test';
import './projectDataTypes.test';
import './projectDataTypesUi.test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  applyWorkspaceEdit,
  applyWorkspaceEditToFiles,
  areDesignerProjectsEquivalent,
  createDesignerBeautificationFallback,
  createWorkspaceEditChangeFromRewrite,
  describeAllowedDesignerControlTypes,
  isDesignerBeautificationInstruction,
  isDesignerEditInstruction,
  getAllowedDesignerControlTypes,
  normalizeDesignerControlTypes,
  proposeLingCppEdit,
  validateDesignerProjectEdit
} from '../src/services/lingCpp/aiEditService';
import { findLingCppMethod, LING_CPP_KEYWORDS, LING_CPP_TYPES, parseLingCpp } from '../src/services/lingCpp/parser';
import {
  buildLingCppLanguageContext,
  formatLingCpp,
  getLingCppBilingualCompletions,
  getLingCppCompletionItems,
  getLingCppCompletionContextKind,
  getLingCppCompletions,
  getLingCppDesignerControlCompletions,
  getLingCppDesignerBindings,
  getLingCppEventBlockHighlights,
  getLingCppFoldingRanges,
  getLingCppInlineHints,
  getLingCppHover,
  getLingCppProblems,
  getLingCppReadableBlocks,
  getLingCppSemanticDiagnostics,
  getLingCppSourceDefinitionAtPosition,
  getLingCppStructuredRows,
  getLingCppStructuredReadingRows,
  getLingCppStructureView,
  getLingCppSymbols,
  getReadableEventName,
  lingCppLanguageService
} from '../src/services/lingCpp/languageService';
import { applyLingCppAstEdit, getLingCppMethodBlock } from '../src/services/lingCpp/astEditService';
import { createProjectGlobalContext, getProjectGlobalDiagnostics } from '../src/services/lingCpp/projectGlobalService';
import { createProjectConstantRenameProposal, findProjectConstantReferences, getProjectConstantNameAtCursor } from '../src/services/lingCpp/projectConstantReferenceService';
import {
  getBeginnerLocalInsertShortcutKind,
  getBeginnerLocalInsertStatementIndex,
  getBeginnerMethodBodySegments,
  isBeginnerLocalInsertShortcut
} from '../src/services/lingCpp/beginnerLocalVariableLayout';
import { analyzeBeginnerAutoLocalAssignment, analyzeBeginnerAutoLocalLoopVariable, isCompleteBeginnerExpression } from '../src/services/lingCpp/beginnerAutoLocalService';
import {
  buildBeginnerTypeCompletionCatalog,
  filterBeginnerTypeCompletions,
  resolveBeginnerTypeAlias
} from '../src/services/lingCpp/beginnerTypeCompletion';
import { createBeginnerVariableCompletion } from '../src/services/lingCpp/beginnerVariableCompletion';
import { buildChineseCompletionSearchAliases, selectCompletionFilterText } from '../src/services/lingCpp/completionSearchAliases';
import {
  getBeginnerProcedureCallAtCursor,
  resolveBeginnerProcedureDefinition
} from '../src/services/lingCpp/beginnerDefinitionNavigation';
import { formatBeginnerFlowIndentation, getBeginnerCrossSegmentFlowFolds, getBeginnerIfFlowGuideRows, getBeginnerNextLineIndentation, parseBeginnerIfBlocks } from '../src/services/lingCpp/beginnerFlowGuide';
import { toggleBeginnerLineComment } from '../src/services/lingCpp/beginnerLineComment';
import { getBeginnerCompletionContext, shouldShowBeginnerCompletion } from '../src/services/lingCpp/beginnerCompletionContext';
import { createLingCppMonarchLanguage } from '../src/services/lingCpp/monacoTokens';
import { renameProjectGlobalAcrossSources } from '../src/services/lingCpp/projectGlobalService';
import { findFunctionLibraryReferences } from '../src/services/lingCpp/functionLibraryService';
import { collectLingCppCommandCalls } from '../src/services/windowDesigner/uiBackendCommandContract';
import {
  collectLingCppTextBlockLines,
  collectLingCppTextBlockOpaqueLines,
  parseLingCppTextBlockStatement,
  scanLingCppTextBlockRanges
} from '../src/services/lingCpp/textBlock';
import { getBeginnerTextOffsetAtPoint } from '../src/services/lingCpp/beginnerTextPosition';
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
import { ExternalProjectProperties, resolveExecutableNameParts, validateProperties } from '../src/services/solution/externalProjectService';
import { buildProjectDllDefLines, createProjectDllCommandContext, createProjectDllDeclarationModule, DLL_STRUCT_FIELD_TYPE_MAP, generateProjectDllDeclarationHeader, getProjectDllCommandsDiagnostics, parseDllDeclarationSnippet, resolveDllBoundaryPointerType, resolveDllBoundaryType, serializeDllCommandSnippet, serializeProjectDllCommandLibraries } from '../src/services/lingCpp/projectDllCommandService';
import { importNativeCppToLingBuilder } from '../src/services/windowDesigner/nativeCppImportService';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { getWin32RuntimeControlContracts, WIN32_CONTROL_DEFINITIONS } from '../src/services/windowDesigner/win32ControlRegistry';
import { InstalledModule } from '../src/services/modules/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { adaptProblemForBeginner } from '../src/services/lingCpp/beginnerService';
import { EPL_TOKEN_COLORS_DARK, EPL_TOKEN_COLORS_LIGHT, tokenizeEplStatement } from '../src/services/eplTokenizer';
import { EPL_STRUCTURED_EDITOR_THEME_DARK, EPL_STRUCTURED_EDITOR_THEME_LIGHT } from '../src/services/eplStructuredEditor';
import {
  getLingCppControlReferenceAtPosition,
  getLingCppControlReferenceDiagnostics,
  getLingCppControlReferenceLocations,
  getLingCppControlReferences,
  migrateQuotedControlReferences,
  renameLingCppControlReference
} from '../src/services/lingCpp/controlReferenceService';
import { classifyLingCppPresentationCode } from '../src/services/lingCpp/beginnerSyntaxPresentation';
import { getLingCppParameterElementType, isLingCppArrayParameterType, setLingCppArrayParameterType } from '../src/services/lingCpp/parameterTypeService';
import {
  buildLingCppControlReferenceSemanticTokenData,
  LINGCPP_CONSTANT_TOKEN_COLORS,
  LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN,
  LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS
} from '../src/services/lingCpp/semanticTheme';

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

const byteResponseModule: InstalledModule = {
  isInstalled: true,
  isEnabledForProject: true,
  installPath: 'C:/modules/com.example.byte-response',
  diagnostics: [],
  manifest: {
    schemaVersion: 2,
    id: 'com.example.byte-response',
    name: '测试网页访问模块',
    version: '1.0.0',
    category: '网络',
    description: '用于验证模块返回值可以写入局部字节集变量。',
    contributes: {
      commands: [{
        name: '网页_访问_对象',
        signature: '网页_访问_对象(网址, 访问方式)',
        description: '返回网页响应字节。',
        returnType: '字节集'
      }],
      types: [{
        name: '字节集',
        description: '原始字节数据。',
        cppType: 'std::vector<unsigned char>'
      }]
    },
    bindings: {
      commands: [{
        command: '网页_访问_对象',
        runtimeName: 'LB_WebRequestObject',
        parameters: [
          { name: '网址', type: 'wideString' },
          { name: '访问方式', type: 'int' }
        ],
        returnType: 'raw'
      }]
    }
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

test('LingCpp parses scoped local variables and diagnoses undeclared or incompatible assignments', () => {
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 _按钮1_被单击()',
    '        局部 文本型 url = "http://127.0.0.1:8981/api"',
    '        局部 字节集 ret',
    '        ret = 网页_访问_对象(url, 1)',
    '    结束',
    '结束类'
  ].join('\n');
  const parsed = parseLingCpp(source);
  const method = parsed.program.classes[0]?.methods[0];

  assert.deepEqual(method?.locals?.map(local => ({
    name: local.name,
    type: local.type,
    initialValue: local.initialValue
  })), [
    { name: 'url', type: '文本型', initialValue: '"http://127.0.0.1:8981/api"' },
    { name: 'ret', type: '字节集', initialValue: undefined }
  ]);
  assert.deepEqual(method?.statements.map(statement => statement.text.trim()), [
    'ret = 网页_访问_对象(url, 1)'
  ]);
  assert.equal(parsed.symbolIndex.locals.length, 2);
  const localRows = getLingCppStructuredRows(buildLingCppLanguageContext(source))
    .filter(row => row.group === 'local');
  assert.deepEqual(localRows.map(row => ({ name: row.name, methodName: row.methodName })), [
    { name: 'url', methodName: '_按钮1_被单击' },
    { name: 'ret', methodName: '_按钮1_被单击' }
  ]);

  const validDiagnostics = getLingCppSemanticDiagnostics(
    source,
    undefined,
    undefined,
    { enabledModules: [byteResponseModule], availableModules: [byteResponseModule] }
  );
  assert.equal(validDiagnostics.some(diagnostic => diagnostic.id.includes('undeclared-variable')), false);
  assert.equal(validDiagnostics.some(diagnostic => diagnostic.id.includes('assignment-type')), false);

  const invalidSource = source
    .replace('        局部 字节集 ret\n', '')
    .replace('ret = 网页_访问_对象(url, 1)', 'ret = "类型也不匹配"');
  const invalidDiagnostics = getLingCppSemanticDiagnostics(invalidSource);
  assert.ok(invalidDiagnostics.some(diagnostic => diagnostic.id.includes('undeclared-variable') && diagnostic.message.includes('ret')));

  const wrongTypeSource = source.replace('局部 字节集 ret', '局部 整数型 ret');
  const wrongTypeDiagnostics = getLingCppSemanticDiagnostics(
    wrongTypeSource,
    undefined,
    undefined,
    { enabledModules: [byteResponseModule], availableModules: [byteResponseModule] }
  );
  assert.ok(wrongTypeDiagnostics.some(diagnostic => diagnostic.id.includes('assignment-type') && diagnostic.message.includes('字节集')));

  const useBeforeDeclarationSource = source.replace(
    '        局部 字节集 ret\n        ret = 网页_访问_对象(url, 1)',
    '        ret = 网页_访问_对象(url, 1)\n        局部 字节集 ret'
  );
  const useBeforeDeclarationDiagnostics = getLingCppSemanticDiagnostics(
    useBeforeDeclarationSource,
    undefined,
    undefined,
    { enabledModules: [byteResponseModule], availableModules: [byteResponseModule] }
  );
  assert.ok(useBeforeDeclarationDiagnostics.some(diagnostic => diagnostic.id.includes('undeclared-variable') && diagnostic.message.includes('ret')));
});

test('LingCpp supports typed runtime control locals, parameters, returns and current-window completion', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const source = [
    '类 主窗口 : 公开 窗体',
    '公开:',
    '    按钮 获取按钮(按钮 参数按钮)',
    '        局部 按钮 按钮123 = 通过标记文本获取按钮("确认")',
    '        局部 编辑框 输入框 = 通过标记整数获取编辑框(1001)',
    '        局部 按钮 动态按钮 = 控件_创建按钮(当前窗口, 20, 20, 120, 36, "确定", "确认", 1002)',
    '        控件_设置启用(动态按钮, 真)',
    '        动态按钮 = 参数按钮',
    '        返回 动态按钮',
    '    结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, sampleProject, 'src/MainWindow.lcpp', moduleContext);
  assert.equal(diagnostics.some(item => item.message.includes('找不到控件“动态按钮”')), false);
  assert.equal(diagnostics.some(item => item.id.includes('initializer-type') || item.id.includes('assignment-type')), false);

  const operationLine = source.split('\n')[6];
  const variableColumn = operationLine.indexOf('动态按钮') + 2;
  const reference = getLingCppControlReferenceAtPosition(source, 7, variableColumn, sampleProject, moduleContext, 'src/MainWindow.lcpp');
  assert.equal(reference?.status, 'runtime-reference');
  assert.equal(reference?.runtimeType, '按钮');
  const definition = getLingCppSourceDefinitionAtPosition(source, 7, variableColumn);
  assert.equal(definition?.kind, 'local');
  assert.equal(definition?.range.startLine, 6);
  assert.match(getLingCppHover({ source, line: 7, column: variableColumn }, buildLingCppLanguageContext(source, sampleProject, moduleContext))?.contents || '', /类型化运行时控件引用[\s\S]*按钮/u);

  const variableCompletionSource = source.replace('控件_设置启用(动态按钮, 真)', '控件_设置启用(动');
  const variableCompletions = getLingCppCompletionItems(
    { source: variableCompletionSource, line: 7, column: variableCompletionSource.split('\n')[6].length + 1, triggerText: '动' },
    buildLingCppLanguageContext(variableCompletionSource, sampleProject, moduleContext, 'src/MainWindow.lcpp')
  );
  assert.ok(variableCompletions.some(item => item.label === '动态按钮' && item.detail.includes('局部控件变量')));

  const parentCompletionSource = source.replace('当前窗口, 20', '当');
  const parentLine = parentCompletionSource.split('\n')[5];
  const parentCompletions = getLingCppCompletionItems(
    { source: parentCompletionSource, line: 6, column: parentLine.length + 1, triggerText: '当' },
    buildLingCppLanguageContext(parentCompletionSource, sampleProject, moduleContext, 'src/MainWindow.lcpp')
  );
  assert.ok(parentCompletions.some(item => item.label === '当前窗口' && item.detail.includes('只读控件容器')));
});

test('Win32 native generation emits shared runtime control references, tags and all 32 typed factories', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!, installPath: 'builtin', isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: sampleProject.windows.map((window, index) => index === 0 ? {
      ...window,
      controls: window.controls.map((control, controlIndex) => controlIndex === 0
        ? { ...control, tagText: '  确认  ', tagInteger: 0 }
        : control)
    } : window)
  };
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '公开:',
    '    按钮 创建动态按钮()',
    '        局部 按钮 动态按钮 = 控件_创建按钮(当前窗口, 20, 20, 120, 36, "确定", "动态确认", 0)',
    '        局部 按钮 查找按钮 = 通过标记文本获取按钮("确认")',
    '        控件_设置启用(动态按钮, 真)',
    '        动态按钮.内容 = "运行时按钮"',
    '        按钮_绑定被单击(动态按钮, &动态按钮被单击)',
    '        返回 动态按钮',
    '    结束',
    '    事件 动态按钮被单击()',
    '        调试输出("动态按钮事件")',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: modules });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /struct LingControlRef/u);
  assert.match(cpp, /std::deque<DynamicControlSpec> dynamicControlSpecs_/u);
  assert.match(cpp, /LingControlRef 动态按钮 = 控件_创建按钮\(hwnd_, 20, 20, 120, 36, L"确定", L"动态确认", 0\)/u);
  assert.match(cpp, /控件_设置启用\(LingCppControlWideName\(动态按钮\), true\)/u);
  assert.match(cpp, /控件_设置文本\(LingCppControlWideName\(动态按钮\), L"运行时按钮"\)/u);
  assert.match(cpp, /按钮_绑定被单击\(LingCppControlWideName\(动态按钮\), L"动态按钮被单击"\)/u);
  assert.match(cpp, /runtimeControlEventHandlers_\[control->id\]\[eventName\] = handlerName/u);
  assert.match(cpp, /std::wstring handler = ResolveControlEventHandler\(control, eventName\)/u);
  assert.match(cpp, /if \(handler == L"动态按钮被单击"\) \{ 动态按钮被单击\(\); return; \}/u);
  assert.match(cpp, /L"确认", true, 0, L"/u);
  const contracts = [
    ...getWin32RuntimeControlContracts('lingbuilder.win32.basic'),
    ...getWin32RuntimeControlContracts('lingbuilder.win32.common-controls')
  ];
  assert.equal(contracts.length, 32);
  contracts.forEach(contract => {
    assert.ok(cpp.includes(`LingControlRef ${contract.createCommand}(`), contract.createCommand);
    assert.ok(cpp.includes(`LingControlRef ${contract.lookupByTagTextCommand}(`), contract.lookupByTagTextCommand);
    assert.ok(cpp.includes(`LingControlRef ${contract.lookupByTagIntegerCommand}(`), contract.lookupByTagIntegerCommand);
  });
});

test('LingCpp blocks runtime control constants, arrays, members, globals and incompatible assignments', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!, installPath: 'builtin', isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const source = [
    '全局 按钮 全局按钮',
    '类 主窗口 : 公开 窗体',
    '公开:',
    '    按钮 成员按钮',
    '    空 测试()',
    '        局部常量 按钮 常量按钮 = 通过标记文本获取按钮("确认")',
    '        局部 按钮 按钮数组[]',
    '        局部 按钮 动态按钮 = 通过标记文本获取按钮("确认")',
    '        动态按钮 = 通过标记文本获取编辑框("输入")',
    '        当前窗口 = 动态按钮',
    '    结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(source, sampleProject, 'src/MainWindow.lcpp', moduleContext);
  const messages = diagnostics.map(item => item.message).join('\n');
  assert.match(messages, /项目全局变量 全局按钮\s+不能使用运行时控件引用类型/u);
  assert.match(messages, /成员 成员按钮\s+不能使用运行时控件引用类型/u);
  assert.match(messages, /局部常量 常量按钮\s+不能使用运行时控件引用类型/u);
  assert.match(messages, /局部数组 按钮数组\s+不能使用运行时控件引用类型/u);
  assert.match(messages, /不能把 编辑框 赋值给 按钮 变量 动态按钮/u);
  assert.match(messages, /当前窗口是只读内置容器/u);
});

test('LingCpp parses runtime local constants in events, methods, constructors and function libraries', () => {
  const source = [
    '类 MainWindow : 公开 窗体',
    '    整数型 成员次数 = 2',
    '    构造()',
    '        局部常量 文本型 构造标签 = "ready"',
    '    结束',
    '    事件 创建完毕(整数型 参数次数)',
    '        局部 整数型 前置次数 = 参数次数',
    '        局部常量 整数型 最大次数 = 前置次数 + 成员次数',
    '        调试输出(最大次数)',
    '    结束',
    '    整数型 取固定次数()',
    '        局部常量 整数型 方法次数 = 3',
    '        返回 方法次数',
    '    结束',
    '结束类',
    '',
    '功能库 数值工具',
    '公开:',
    '    整数型 计算()',
    '        局部常量 整数型 功能次数 = 4',
    '        返回 功能次数',
    '    结束',
    '结束功能库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  const locals = [
    ...parsed.program.classes.flatMap(cls => cls.methods.flatMap(method => method.locals || [])),
    ...parsed.program.functionLibraries.flatMap(library => library.methods.flatMap(method => method.locals || []))
  ];

  assert.deepEqual(locals.filter(local => local.isConstant).map(local => local.name), [
    '构造标签', '最大次数', '方法次数', '功能次数'
  ]);
  assert.equal(parsed.symbolIndex.locals.filter(node => node.isConstant).length, 4);
  assert.equal(parsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false, JSON.stringify(parsed.diagnostics));

  const context = buildLingCppLanguageContext(source);
  const completion = getLingCppCompletionItems({ source, line: 9, column: 18, triggerText: '最大' }, context)
    .find(item => item.label === '最大次数');
  assert.match(completion?.detail || '', /局部常量（只读）/u);
  assert.doesNotMatch(
    getLingCppCompletionItems({ source, line: 13, column: 15, triggerText: '' }, context).map(item => item.label).join('\n'),
    /最大次数/u
  );
  assert.match(getLingCppHover({ source, line: 8, column: 22 }, context)?.contents || '', /局部常量[\s\S]*只读/u);
  assert.ok(getLingCppStructuredRows(context).some(row => row.group === 'local' && row.name === '最大次数' && row.isConstant));
});

test('LingCpp local constants require safe top-level initialization and remain read-only', () => {
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕(整数型 参数值)',
    '        局部常量 整数型 缺值',
    '        局部常量 整数型 数组值[] = 1',
    '        局部常量 未知类型 未知类型值 = 1',
    '        局部常量 整数型 自身值 = 自身值',
    '        局部常量 整数型 后置引用 = 后置值',
    '        局部 整数型 后置值 = 2',
    '        局部常量 文本型 类型错误 = 3',
    '        局部常量 整数型 只读值 = 参数值',
    '        只读值 = 2',
    '        只读值.字段 = 2',
    '        只读值[0] = 2',
    '        如果 (真)',
    '            局部常量 整数型 块内值 = 1',
    '        如果结束',
    '    结束',
    '结束类'
  ].join('\n');
  const messages = [
    ...parseLingCpp(source).diagnostics,
    ...getLingCppSemanticDiagnostics(source)
  ].map(diagnostic => diagnostic.message).join('\n');

  assert.match(messages, /缺值.*必须填写初始值/u);
  assert.match(messages, /数组值.*不支持数组/u);
  assert.match(messages, /未知类型值.*未知类型/u);
  assert.match(messages, /自身值.*不能在初始化表达式中引用自身/u);
  assert.match(messages, /后置引用.*后置值\s+尚未声明/u);
  assert.match(messages, /类型错误.*类型是 文本型，不能使用 整数型 初始化/u);
  assert.match(messages, /块内值.*控制块内部/u);
  assert.equal((messages.match(/只读值 是只读值，不能重新赋值/gu) || []).length, 3);
});

test('LingCpp project constants parse, validate, complete, rename and remain read-only', () => {
  const symbolPath = 'src/项目全局变量.lcpp';
  const symbolSource = [
    '常量 整数型 最大重试次数 = 3',
    '常量 长整数型 大整数 = 最大重试次数 * 1000',
    '常量 小数型 缩放 = 1.25',
    '常量 双精度小数型 精度 = 0.001',
    '常量 逻辑型 启用日志 = 真',
    '常量 文本型 软件名称 = "LingBuilder"',
    '全局 整数型 当前次数 = 最大重试次数'
  ].join('\n');
  const sourcePath = 'src/MainWindow.lcpp';
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        调试输出(软件名称)',
    '        最大重试次数 = 4',
    '    结束',
    '结束类'
  ].join('\n');
  const parsed = parseLingCpp(symbolSource);
  assert.equal(parsed.program.constants.length, 6);
  assert.equal(parsed.symbolIndex.constants.length, 6);
  assert.equal(parsed.program.constants[0]?.initialValue, '3');
  assert.deepEqual(getProjectGlobalDiagnostics(symbolSource, symbolPath), []);

  const projectGlobals = createProjectGlobalContext(symbolPath, symbolSource);
  const diagnostics = getLingCppSemanticDiagnostics(source, undefined, sourcePath, undefined, projectGlobals);
  assert.ok(diagnostics.some(diagnostic => diagnostic.message.includes('最大重试次数') && diagnostic.message.includes('不能重新赋值')));
  const completions = getLingCppCompletionItems(
    { source, line: 3, column: 15, triggerText: '软件' },
    buildLingCppLanguageContext(source, undefined, undefined, sourcePath, projectGlobals)
  );
  assert.ok(completions.some(item => item.label === '#软件名称' && item.detail.includes('项目常量')));

  // #常量 引用：解析合法、只读保护、未知报错，且不影响既有裸名引用。
  const hashSource = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        调试输出(#软件名称)',
    '        #最大重试次数 = 4',
    '        调试输出(#不存在的常量)',
    '    结束',
    '结束类'
  ].join('\n');
  const hashDiagnostics = getLingCppSemanticDiagnostics(hashSource, undefined, sourcePath, undefined, projectGlobals);
  assert.ok(hashDiagnostics.some(diagnostic => diagnostic.message.includes('常量 #最大重试次数 是只读值')));
  assert.ok(hashDiagnostics.some(diagnostic => diagnostic.message.includes('常量 #不存在的常量 不存在')));
  assert.equal(hashDiagnostics.filter(diagnostic => diagnostic.level === 'error' && diagnostic.message.includes('#软件名称')).length, 0);
  const hashTriggerSource = ['类 MainWindow : 公开 窗体', '    事件 创建完毕()', '        调试输出(#)', '    结束', '结束类'].join('\n');
  const hashItems = getLingCppCompletionItems(
    { source: hashTriggerSource, line: 3, column: '        调试输出(#)'.indexOf('#') + 2, triggerText: '' },
    buildLingCppLanguageContext(hashTriggerSource, undefined, undefined, sourcePath, projectGlobals)
  );
  assert.ok(hashItems.some(item => item.label === '#软件名称' && item.insertText === '软件名称'));
  assert.equal(hashItems.every(item => item.label.startsWith('#')), true, '常量补全列表只允许出现常量项');
  assert.equal(getProjectConstantNameAtCursor('调试输出(#软件名称)', '调试输出(#软件'.length + 1, ['软件名称']), '软件名称');
  const hashRenameFiles = [
    { filePath: symbolPath, sourceCode: symbolSource, language: 'lingcpp' as const },
    { filePath: 'src/HashRef.lcpp', sourceCode: '调试输出(#软件名称)', language: 'lingcpp' as const }
  ];
  const hashApplied = applyWorkspaceEditToFiles(hashRenameFiles, createProjectConstantRenameProposal(hashRenameFiles, symbolPath, '软件名称', '产品名称'));
  assert.ok(hashApplied.some(file => file.sourceCode.includes('调试输出(#产品名称)')), '# 前缀引用重命名后必须保留 #');

  const added = applyLingCppAstEdit(symbolSource, { kind: 'add-constant', constant: { name: '超时时间', type: '整数型', initialValue: '30' } });
  assert.equal(added.success, true);
  assert.equal(parseLingCpp(added.sourceCode).program.constants.at(-1)?.name, '超时时间');
  const updated = applyLingCppAstEdit(added.sourceCode, { kind: 'update-constant', constantName: '超时时间', initialValue: '60' });
  assert.equal(parseLingCpp(updated.sourceCode).program.constants.at(-1)?.initialValue, '60');
  const removed = applyLingCppAstEdit(updated.sourceCode, { kind: 'delete-constant', constantName: '超时时间' });
  assert.equal(parseLingCpp(removed.sourceCode).program.constants.some(item => item.name === '超时时间'), false);

  const files = [
    { filePath: symbolPath, sourceCode: symbolSource, language: 'lingcpp' },
    { filePath: sourcePath, sourceCode: source.replace('        最大重试次数 = 4\n', ''), language: 'lingcpp' }
  ];
  const references = findProjectConstantReferences(files, '软件名称');
  assert.equal(references.length, 2);
  const proposal = createProjectConstantRenameProposal(files, symbolPath, '软件名称', '产品名称');
  const applied = applyWorkspaceEditToFiles(files, proposal);
  assert.ok(applied.every(file => !file.sourceCode.includes('软件名称')));
  assert.ok(applied.some(file => file.sourceCode.includes('调试输出(产品名称)')));
  const constantCursorSource = '调试输出(软件名称)';
  assert.equal(getProjectConstantNameAtCursor(constantCursorSource, constantCursorSource.indexOf('软件名称') + 2, ['软件名称']), '软件名称');
  assert.equal(getProjectConstantNameAtCursor('调试输出("软件名称")', 8, ['软件名称']), undefined);
  assert.equal(findProjectConstantReferences([
    ...files,
    { filePath: 'src/忽略项.lcpp', sourceCode: '// 软件名称\n调试输出("软件名称")\n软件名称()', language: 'lingcpp' }
  ], '软件名称').length, 2);
  assert.throws(
    () => createProjectConstantRenameProposal([
      ...files,
      { filePath: 'src/冲突.lcpp', sourceCode: '类 冲突\n    整数型 已有成员\n结束类', language: 'lingcpp' }
    ], symbolPath, '软件名称', '已有成员'),
    /同名成员/u
  );

  assert.ok(getProjectGlobalDiagnostics('全局 整数型 数量 = 1\n常量 整数型 上限 = 2', symbolPath).some(diagnostic => diagnostic.message.includes('必须声明在全部项目全局变量之前')));
  assert.ok(getProjectGlobalDiagnostics('常量 字节集 数据 = "x"', symbolPath).some(diagnostic => diagnostic.message.includes('不支持类型')));
  assert.ok(getProjectGlobalDiagnostics('常量 文本型 空值 = ', symbolPath).some(diagnostic => diagnostic.message.includes('必须填写常量值')));
});

test('新手项目变量与常量编辑器提供双页签、引用入口和窄屏滚动容器', () => {
  const editorSource = readFileSync(resolve(import.meta.dirname, '../src/components/ProjectGlobalVariableEditor.tsx'), 'utf8');
  assert.match(editorSource, /项目变量与常量/u);
  assert.match(editorSource, /项目变量<\/button>/u);
  assert.match(editorSource, /项目常量<\/button>/u);
  assert.match(editorSource, /showReferences/u);
  assert.match(editorSource, /overflow-auto/u);
  assert.match(editorSource, /readOnly/u);
});

test('LingCpp completion only exposes locals from the current method', () => {
  const source = [
    '类 MainWindow : 公开 窗体',
    '    事件 第一个事件()',
    '        局部 文本型 仅第一个可见',
    '        调试输出(仅第一个可见)',
    '    结束',
    '    事件 第二个事件()',
    '        局部 文本型 仅第二个可见',
    '        调试输出(仅第二个可见)',
    '    结束',
    '结束类'
  ].join('\n');
  const languageContext = buildLingCppLanguageContext(source);
  const firstLabels = getLingCppCompletionItems({ source, line: 4, column: 18, triggerText: '' }, languageContext)
    .map(item => item.label);
  const secondLabels = getLingCppCompletionItems({ source, line: 8, column: 18, triggerText: '' }, languageContext)
    .map(item => item.label);

  assert.ok(firstLabels.includes('仅第一个可见'));
  assert.equal(firstLabels.includes('仅第二个可见'), false);
  assert.ok(secondLabels.includes('仅第二个可见'));
  assert.equal(secondLabels.includes('仅第一个可见'), false);
});

test('LingCpp source variables support full pinyin and initials in scoped completions', () => {
  const source = [
    '类 MainWindow : 公开 窗体',
    '    文本型 本机地址',
    '    事件 第一个事件()',
    '        局部 文本型 本机',
    '        调试输出(本机)',
    '    结束',
    '    事件 第二个事件()',
    '        调试输出(本机地址)',
    '    结束',
    '结束类'
  ].join('\n');
  const languageContext = buildLingCppLanguageContext(source);
  const firstItems = getLingCppCompletionItems(
    { source, line: 5, column: 18, triggerText: 'bj' },
    languageContext
  );
  const secondItems = getLingCppCompletionItems(
    { source, line: 8, column: 18, triggerText: 'bj' },
    languageContext
  );

  assert.ok(firstItems.some(item => item.label === '本机' && item.pinyin?.includes('bj')));
  assert.ok(firstItems.some(item => item.label === '本机地址' && item.pinyin?.includes('bjdz')));
  assert.ok(secondItems.some(item => item.label === '本机地址'));
  assert.equal(secondItems.some(item => item.label === '本机'), false);
  assert.equal(selectCompletionFilterText('本机', ['benji', 'bj'], 'bj'), 'bj');
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

test('已有创建完毕事件的类不再提示未声明构造函数', () => {
  const withLoadedEvent = parseLingCpp([
    '类 主窗口 : 公开 窗体',
    '    事件 创建完毕()',
    '        调试输出("初始化")',
    '    结束',
    '结束类'
  ].join('\n'));
  assert.equal(
    withLoadedEvent.diagnostics.some(diagnostic => diagnostic.message.includes('未声明构造函数')),
    false
  );

  const withWindowLoadedEvent = parseLingCpp([
    '类 主窗口 : 公开 窗体',
    '    事件 _主窗口_创建完毕()',
    '    结束',
    '结束类'
  ].join('\n'));
  assert.equal(
    withWindowLoadedEvent.diagnostics.some(diagnostic => diagnostic.message.includes('未声明构造函数')),
    false
  );

  const withConstructor = parseLingCpp([
    '类 主窗口 : 公开 窗体',
    '    构造()',
    '    结束',
    '结束类'
  ].join('\n'));
  assert.equal(
    withConstructor.diagnostics.some(diagnostic => diagnostic.message.includes('未声明构造函数')),
    false
  );
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

test('LingCpp 图片框提供设置图片方法补全', () => {
  const designerProject: LingWindowProject = {
    schemaVersion: 2,
    id: 'image-control-completion',
    name: '图片框补全',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'preview-image', type: 'Image', name: '图片框1', content: '', width: 180, height: 140,
        x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { imageSource: '', stretch: 'uniform' }
      }]
    }]
  };
  const source = '类 MainWindow : 公开 窗体\n    事件 _主窗口_创建完毕()\n    结束\n结束类';
  const completions = getLingCppBilingualCompletions({ source, line: 2, column: 5, triggerText: '图片框1.设置' }, designerProject);

  assert.ok(completions.some(item => item.insertText === '图片框1.设置图片("$1")'));
});

test('LingCpp 图片框设置图片方法不会被功能库诊断误判', () => {
  const designerProject: LingWindowProject = {
    schemaVersion: 2,
    id: 'image-control-method-diagnostics',
    name: '图片框方法诊断',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'preview-image', type: 'Image', name: '图片框1', content: '', width: 180, height: 140,
        x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { imageSource: '', stretch: 'uniform' }
      }]
    }]
  };
  const source = '类 MainWindow : 公开 窗体\n    事件 _主窗口_创建完毕()\n        图片框1.设置图片("assets/示例.png")\n    结束\n结束类';
  const diagnostics = getLingCppSemanticDiagnostics(source, designerProject, 'src/MainWindow.lcpp');
  assert.doesNotMatch(diagnostics.map(item => item.message).join('\n'), /找不到功能库/u);
});

test('LingCpp 新手控件补全覆盖注册表中的全部控件事件和可用命令', () => {
  const controls = WIN32_CONTROL_DEFINITIONS.map((definition, index) => ({
    id: `control-${index}`,
    type: definition.type,
    name: `${definition.label}${index + 1}`,
    content: '', width: 120, height: 32, x: 0, y: index * 36, fontSize: 12,
    background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible' as const
  }));
  const designerProject = {
    schemaVersion: 2 as const,
    id: 'all-control-completions',
    name: '全部控件补全',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 800, height: 600, background: '#ffffff', description: '', controls
    }]
  } as LingWindowProject;
  const source = '类 MainWindow : 公开 窗体\n    事件 _主窗口_创建完毕()\n    结束\n结束类';
  const completions = getLingCppDesignerControlCompletions(source, designerProject);
  const labels = new Set(completions.map(item => item.label));

  WIN32_CONTROL_DEFINITIONS.forEach((definition, index) => {
    const controlName = `${definition.label}${index + 1}`;
    assert.ok(labels.has(`${controlName}.设置启用`), `${definition.type} 应提供通用命令补全`);
    assert.ok(labels.has(`${controlName}.设置可见`), `${definition.type} 应提供可见性命令补全`);
    definition.events.forEach(event => {
      assert.ok(labels.has(`${controlName}.${event.label}事件`), `${definition.type}.${event.name} 事件应进入新手补全`);
    });
  });

  const tabName = `${WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'TabControl')?.label}${WIN32_CONTROL_DEFINITIONS.findIndex(definition => definition.type === 'TabControl') + 1}`;
  assert.ok(labels.has(`${tabName}.标签页被改变事件`));
  assert.ok(labels.has(`${tabName}.设置选择项`));
  assert.ok(labels.has(`${tabName}.取选择项`));
  assert.ok(labels.has(`${tabName}.添加页`));
  assert.ok(labels.has(`${tabName}.清空项目`));
  assert.ok(labels.has(`${tabName}.设置隐藏表头`));
  assert.ok(labels.has(`${tabName}.隐藏表头`));
  assert.ok(labels.has(`${tabName}.显示表头`));
  assert.ok(labels.has(`${tabName}.取隐藏表头`));
  const colorPickerName = `${WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ColorPicker')?.label}${WIN32_CONTROL_DEFINITIONS.findIndex(definition => definition.type === 'ColorPicker') + 1}`;
  assert.ok(labels.has(`${colorPickerName}.打开选择窗口`));
  assert.ok(labels.has(`${colorPickerName}.设置颜色`));
  assert.ok(labels.has(`${colorPickerName}.取颜色`));
});

test('新手编辑器为设计器组件名生成全拼和首字母补全别名', () => {
  const designerProject = {
    schemaVersion: 2 as const,
    id: 'designer-pinyin-completion',
    name: '设计器拼音补全',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 800, height: 600, background: '#ffffff', description: '', controls: [{
        id: 'confirm-button', type: 'Button', name: '确认按钮', content: '确定',
        width: 120, height: 32, x: 20, y: 20, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible' as const
      }]
    }]
  } as LingWindowProject;
  const source = '类 MainWindow : 公开 窗体\n    事件 _主窗口_创建完毕()\n    结束\n结束类';
  const completions = getLingCppDesignerControlCompletions(source, designerProject);
  const control = completions.find(item => item.label === '确认按钮');
  const command = completions.find(item => item.label === '确认按钮.设置内容');

  assert.ok(control?.pinyin?.includes('querenanniu'));
  assert.ok(control?.pinyin?.includes('qran'));
  assert.ok(command?.pinyin?.includes('qran.sznr'));
});

test('未启用模块的同名命令不应产生模块未引用误报', () => {
  const enabledModule: InstalledModule = {
    isInstalled: true,
    isEnabledForProject: true,
    installPath: 'builtin',
    isBuiltin: true,
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'demo.enabled',
      name: '已启用模块',
      version: '1.0.0',
      description: '测试模块',
      contributes: {
        commands: [{ name: '控件_取数值', signature: '控件_取数值(控件名)', description: '取数值', insertText: '控件_取数值($1)', returnType: '整数型' }]
      }
    } as InstalledModule['manifest']
  };
  const disabledModule: InstalledModule = {
    ...enabledModule,
    isEnabledForProject: false,
    manifest: { ...enabledModule.manifest, id: 'demo.disabled', name: '未启用模块' }
  };
  const source = '类 MainWindow : 公开 窗体\n    事件 _按钮1_被单击()\n        控件_取数值(进度条1)\n    结束\n结束类';

  const moduleWarnings = (enabled: InstalledModule[], available: InstalledModule[]) =>
    getLingCppProblems(source, undefined, 'src/MainWindow.lcpp', { enabledModules: enabled, availableModules: available })
      .filter(problem => problem.id.startsWith('lingcpp-module-disabled'));

  assert.equal(moduleWarnings([enabledModule], [enabledModule, disabledModule]).length, 0);
  assert.equal(moduleWarnings([], [disabledModule]).length, 1);
  assert.match(moduleWarnings([], [disabledModule])[0]?.message || '', /尚未引用该模块/u);
});

test('新手模式问题文案保留真实诊断消息', () => {
  const problem = {
    id: 'lingcpp-module-disabled-demo-控件_取数值-3',
    filePath: 'src/MainWindow.lcpp',
    line: 3,
    level: 'warning' as const,
    source: 'parser' as const,
    message: '命令 控件_取数值 来自 new_emoji 原生界面库，当前项目尚未引用该模块。',
    codeSnippet: '控件_取数值(进度条1)',
    suggestion: '请在模块页启用 new_emoji 原生界面库，或移除该命令调用。',
    actionKind: 'none' as const
  };

  const adapted = adaptProblemForBeginner(problem);
  assert.match(adapted.audienceText, /控件_取数值/u);
  assert.match(adapted.audienceText, /尚未引用该模块/u);
});

test('模块设计器事件补全和诊断复用强类型参数契约', () => {
  const tableModule: InstalledModule = {
    isInstalled: true,
    isEnabledForProject: true,
    installPath: 'C:/modules/com.example.table',
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.table',
      name: '表格事件测试模块',
      version: '1.0.0',
      category: '界面',
      description: '验证模块设计器事件参数契约。',
      contributes: {
        designerControls: [{
          type: 'Table',
          namespacedType: 'com.example.table/Table',
          previewType: 'Grid',
          label: '表格',
          defaultProps: {},
          events: [{
            name: 'CellEdit',
            label: '单元格编辑',
            handlerPattern: '_{controlName}_单元格编辑',
            parameters: [
              { name: '行号', type: 'int' },
              { name: '列号', type: 'int' },
              { name: '动作', type: 'int' },
              { name: '文本', type: 'utf8String' }
            ]
          }, {
            name: 'VirtualRow',
            label: '虚拟行数据源',
            handlerPattern: '_{controlName}_虚拟行数据源',
            parameters: [{ name: '行号', type: 'int' }],
            starterStatements: ['NE_设置表格虚拟行数据("")']
          }]
        }]
      }
    }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'module-table-events',
    name: '模块表格事件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'table', type: 'Grid', designerType: 'com.example.table/Table', name: '表格1', content: '',
        width: 480, height: 260, x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000',
        isEnabled: true, visibility: 'Visible',
        events: { CellEdit: '_表格1_单元格编辑', VirtualRow: '_表格1_虚拟行数据源' }
      }]
    }]
  };
  const moduleContext = { enabledModules: [tableModule], availableModules: [tableModule] };
  const source = '类 MainWindow : 公开 窗体\n公开:\n结束类';
  const completions = getLingCppBilingualCompletions(
    { source, line: 2, column: 5, triggerText: 'CellEdit' },
    project,
    moduleContext
  );
  const cellEdit = completions.find(item => item.label === '表格1 单元格编辑事件');
  assert.equal(
    cellEdit?.insertText,
    '事件 _表格1_单元格编辑(整数型 行号，整数型 列号，整数型 动作，文本型 文本)\n    $0'
  );
  const virtualRow = getLingCppBilingualCompletions(
    { source, line: 2, column: 5, triggerText: 'VirtualRow' },
    project,
    moduleContext
  ).find(item => item.label === '表格1 虚拟行数据源事件');
  assert.equal(
    virtualRow?.insertText,
    '事件 _表格1_虚拟行数据源(整数型 行号)\n    NE_设置表格虚拟行数据("")\n    $0'
  );
  const beginnerCompletion = getLingCppDesignerControlCompletions(source, project, moduleContext)
    .find(item => item.label === '表格1.单元格编辑事件');
  assert.equal(beginnerCompletion?.insertText, '_表格1_单元格编辑($1, $2, $3, $4)');

  const validSource = [
    '类 MainWindow : 公开 窗体',
    '  事件 _表格1_单元格编辑(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)',
    '  结束',
    '结束类'
  ].join('\n');
  const legacySource = validSource.replace('(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)', '()');
  const invalidSource = validSource.replace('(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)', '(整数型 行号, 文本型 列号)');
  const moduleEventDiagnostics = (value: string) => getLingCppSemanticDiagnostics(
    value,
    project,
    'src/MainWindow.lcpp',
    moduleContext
  ).filter(item => item.id.includes('module-designer-event-parameters'));
  assert.deepEqual(moduleEventDiagnostics(validSource), []);
  assert.deepEqual(moduleEventDiagnostics(legacySource), []);
  assert.equal(moduleEventDiagnostics(invalidSource).length, 1);
  assert.match(moduleEventDiagnostics(invalidSource)[0]?.message || '', /单元格编辑事件参数/u);
});

test('ListBox 模块事件补全为所有专属回调生成参数签名', () => {
  const listBoxEvents = [
    { name: 'SelectionChanged', label: '选择变化', handlerPattern: '_{controlName}_选择变化', parameters: [{ name: '选中键列表', type: 'wideString' }] },
    { name: 'ItemClicked', label: '项目点击', handlerPattern: '_{controlName}_项目点击', parameters: [{ name: '项目索引', type: 'int' }, { name: '起始位置', type: 'int' }, { name: '结束位置', type: 'int' }] },
    { name: 'ItemDoubleClicked', label: '项目双击', handlerPattern: '_{controlName}_项目双击', parameters: [{ name: '项目索引', type: 'int' }, { name: '触发方式', type: 'int' }, { name: '附加值', type: 'int' }] },
    { name: 'Edit', label: '项目编辑', handlerPattern: '_{controlName}_项目编辑', parameters: [{ name: '项目索引', type: 'int' }, { name: '编辑字段', type: 'int' }, { name: '动作', type: 'int' }, { name: '文本', type: 'wideString' }] },
    { name: 'Reorder', label: '项目重排', handlerPattern: '_{controlName}_项目重排', parameters: [{ name: '原索引', type: 'int' }, { name: '新索引', type: 'int' }, { name: '数量', type: 'int' }] },
    { name: 'ContextMenu', label: '项目右键菜单', handlerPattern: '_{controlName}_项目右键菜单', parameters: [{ name: '项目索引', type: 'int' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }] },
    { name: 'MouseEnter', label: '鼠标进入', handlerPattern: '_{controlName}_鼠标进入', parameters: [] },
    { name: 'MouseLeave', label: '鼠标离开', handlerPattern: '_{controlName}_鼠标离开', parameters: [] },
    { name: 'MouseDown', label: '鼠标按下', handlerPattern: '_{controlName}_鼠标按下', parameters: [{ name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '鼠标按钮', type: 'int' }] },
    { name: 'MouseUp', label: '鼠标抬起', handlerPattern: '_{controlName}_鼠标抬起', parameters: [{ name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '鼠标按钮', type: 'int' }] },
    { name: 'MouseDoubleClick', label: '鼠标双击', handlerPattern: '_{controlName}_鼠标双击', parameters: [{ name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '鼠标按钮', type: 'int' }] },
    { name: 'MouseMove', label: '鼠标移动', handlerPattern: '_{controlName}_鼠标移动', parameters: [{ name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }] },
    { name: 'MouseWheel', label: '鼠标滚轮', handlerPattern: '_{controlName}_鼠标滚轮', parameters: [{ name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '滚轮增量', type: 'int' }] },
    { name: 'GotFocus', label: '获得焦点', handlerPattern: '_{controlName}_获得焦点', parameters: [] },
    { name: 'LostFocus', label: '失去焦点', handlerPattern: '_{controlName}_失去焦点', parameters: [] }
  ] as any[];
  const listBoxModule: InstalledModule = {
    isInstalled: true,
    isEnabledForProject: true,
    installPath: 'C:/modules/com.example.listbox',
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.listbox',
      name: '列表框事件测试模块',
      version: '1.0.0',
      category: '界面',
      description: '验证列表框所有事件参数。',
      contributes: {
        designerControls: [{
          type: 'ListBox',
          namespacedType: 'com.example.listbox/ListBox',
          previewType: 'ListBox',
          label: '列表框',
          defaultProps: {},
          events: listBoxEvents
        }]
      }
    }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'module-listbox-events',
    name: '模块列表框事件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'listbox', type: 'ListBox', designerType: 'com.example.listbox/ListBox', name: '列表框1', content: '',
        width: 320, height: 240, x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000',
        isEnabled: true, visibility: 'Visible', events: Object.fromEntries(listBoxEvents.map(event => [event.name, event.handlerPattern.replace('{controlName}', '列表框1')]))
      }]
    }]
  };
  const source = '类 MainWindow : 公开 窗体\n公开:\n结束类';
  const moduleContext = { enabledModules: [listBoxModule], availableModules: [listBoxModule] };
  for (const event of listBoxEvents) {
    const handler = event.handlerPattern.replace('{controlName}', '列表框1');
    const completion = getLingCppBilingualCompletions(
      { source, line: 2, column: 5, triggerText: event.name },
      project,
      moduleContext
    ).find(item => item.label === `列表框1 ${event.label}事件`);
    const parameterText = event.parameters.map(parameter => `${parameter.type === 'wideString' ? '文本型' : '整数型'} ${parameter.name}`).join('，');
    assert.equal(completion?.insertText, `事件 ${handler}(${parameterText})\n    $0`);
    const beginner = getLingCppDesignerControlCompletions(source, project, moduleContext)
      .find(item => item.label === `列表框1.${event.label}事件`);
    assert.equal(beginner?.insertText, `${handler}(${event.parameters.map((_parameter, index) => `$${index + 1}`).join(', ')})`);
  }
  const invalidSource = [
    '类 MainWindow : 公开 窗体',
    '  事件 _列表框1_选择变化(整数型 选中键列表)',
    '  结束',
    '结束类'
  ].join('\n');
  const diagnostics = getLingCppSemanticDiagnostics(invalidSource, project, 'src/MainWindow.lcpp', moduleContext)
    .filter(item => item.id.includes('module-designer-event-parameters'));
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0]?.message || '', /选择变化事件参数/u);
});

test('NewEmoji Tabs 选择变化事件自动补齐索引、数量和动作参数', () => {
  const tabsEvent = {
    name: 'SelectionChanged',
    label: '选择变化',
    handlerPattern: '_{controlName}_选择变化',
    parameters: [
      { name: '选中索引', type: 'int' },
      { name: '项目数量', type: 'int' },
      { name: '动作', type: 'int' }
    ]
  } as any;
  const tabsModule: InstalledModule = {
    isInstalled: true,
    isEnabledForProject: true,
    installPath: 'C:/modules/com.example.tabs',
    diagnostics: [],
    manifest: {
      schemaVersion: 2,
      id: 'com.example.tabs',
      name: '标签页事件测试模块',
      version: '1.0.0',
      category: '界面',
      description: '验证标签页事件参数。',
      contributes: {
        designerControls: [{
          type: 'Tabs',
          namespacedType: 'com.example.tabs/Tabs',
          previewType: 'TabControl',
          label: '标签页',
          defaultProps: {},
          events: [tabsEvent]
        }]
      }
    }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'module-tabs-events',
    name: '标签页事件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'tabs', type: 'TabControl', designerType: 'com.example.tabs/Tabs', name: '标签页1', content: '',
        width: 480, height: 260, x: 20, y: 20, fontSize: 12, background: '#ffffff', foreground: '#000000',
        isEnabled: true, visibility: 'Visible', events: { SelectionChanged: '_标签页1_选择变化' }
      }]
    }]
  };
  const source = '类 MainWindow : 公开 窗体\n公开:\n结束类';
  const moduleContext = { enabledModules: [tabsModule], availableModules: [tabsModule] };
  const completion = getLingCppBilingualCompletions(
    { source, line: 2, column: 5, triggerText: 'SelectionChanged' },
    project,
    moduleContext
  ).find(item => item.label === '标签页1 选择变化事件');
  assert.equal(
    completion?.insertText,
    '事件 _标签页1_选择变化(整数型 选中索引，整数型 项目数量，整数型 动作)\n    $0'
  );
  const beginner = getLingCppDesignerControlCompletions(source, project, moduleContext)
    .find(item => item.label === '标签页1.选择变化事件');
  assert.equal(beginner?.insertText, '_标签页1_选择变化($1, $2, $3)');

  const validSource = [
    '类 MainWindow : 公开 窗体',
    '  事件 _标签页1_选择变化(整数型 选中索引, 整数型 项目数量, 整数型 动作)',
    '  结束',
    '结束类'
  ].join('\n');
  const invalidSource = validSource.replace(
    '(整数型 选中索引, 整数型 项目数量, 整数型 动作)',
    '(整数型 选中索引, 整数型 项目数量)'
  );
  const eventDiagnostics = (value: string) => getLingCppSemanticDiagnostics(
    value,
    project,
    'src/MainWindow.lcpp',
    moduleContext
  ).filter(item => item.id.includes('module-designer-event-parameters'));
  assert.deepEqual(eventDiagnostics(validSource), []);
  assert.equal(eventDiagnostics(invalidSource).length, 1);
  assert.match(eventDiagnostics(invalidSource)[0]?.message || '', /选择变化事件参数/u);
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

test('LingCpp hover displays module command signature documentation and return type', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.common-controls');
  assert.ok(manifest);
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.win32.common-controls',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const source = '选项卡_设置隐藏表头("选项卡1", 真)';
  const context = buildLingCppLanguageContext(
    source,
    undefined,
    { enabledModules: [module], availableModules: [module] }
  );
  const hover = getLingCppHover({ source, line: 1, column: 8 }, context);

  assert.ok(hover);
  assert.match(hover.contents, /选项卡_设置隐藏表头\(控件名, 隐藏\)/u);
  assert.match(hover.contents, /运行时隐藏或显示 TabControl 的标签表头/u);
  assert.match(hover.contents, /返回值：逻辑型/u);
  assert.deepEqual(hover.range, { startLine: 1, startColumn: 1, endLine: 1, endColumn: 11 });
});

test('controlRef uses bare designer symbols for diagnostics, completion, hover, references and migration', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [
        ...sampleProject.windows[0].controls,
        { id: 'result-label', type: 'Label', name: '操作结果', content: '', x: 10, y: 10, width: 160, height: 28, fontSize: 13, background: '#202020', foreground: '#ffffff', isEnabled: true, visibility: 'Visible', events: {} },
        { id: 'list-view', type: 'ListView', name: '数据列表', content: '', x: 10, y: 50, width: 240, height: 160, fontSize: 13, background: '#202020', foreground: '#ffffff', isEnabled: true, visibility: 'Visible', events: {} }
      ]
    }],
    resources: [{ id: 'images-main', type: 'ImageList', name: '主图像列表', imageWidth: 16, imageHeight: 16, images: [] }]
  };
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const source = '类 游戏主窗体 : 公开 窗体\n事件 测试()\n    控件_设置文本(操作结果, "完成")\n    控件_取文本(操作结果)\n结束\n结束类';
  assert.deepEqual(getLingCppControlReferenceDiagnostics(source, project, moduleContext, 'src/MainWindow.lcpp'), []);

  const languageContext = buildLingCppLanguageContext(source, project, moduleContext, 'src/MainWindow.lcpp');
  const hover = getLingCppHover({ source, line: 3, column: 14 }, languageContext);
  assert.match(hover?.contents || '', /设计器控件 · Label/u);
  assert.match(hover?.contents || '', /所属窗口：太空冒险/u);

  const incomplete = '类 游戏主窗体 : 公开 窗体\n事件 测试()\n    控件_设置文本(操';
  const completions = getLingCppCompletionItems(
    { source: incomplete, line: 3, column: 14, triggerText: '操' },
    buildLingCppLanguageContext(incomplete, project, moduleContext, 'src/MainWindow.lcpp')
  );
  assert.ok(completions.some(item => item.label === '操作结果' && item.insertText === '操作结果'));
  assert.ok(completions.every(item => !item.insertText.startsWith('"')));

  const resourceSource = '类 游戏主窗体 : 公开 窗体\n事件 测试()\n    列表视图_设置图像列表(数据列表, 主';
  const resourceCompletions = getLingCppCompletionItems(
    { source: resourceSource, line: 3, column: 23, triggerText: '主' },
    buildLingCppLanguageContext(resourceSource, project, moduleContext, 'src/MainWindow.lcpp')
  );
  assert.deepEqual(resourceCompletions.map(item => item.label), ['主图像列表']);

  const reference = getLingCppControlReferenceAtPosition(source, 3, 14, project, moduleContext, 'src/MainWindow.lcpp');
  assert.equal(reference?.symbol?.controlId, 'result-label');
  assert.equal(getLingCppControlReferenceLocations([{ filePath: 'src/MainWindow.lcpp', sourceCode: source }], reference!.symbol!, project, moduleContext).length, 2);

  const quoted = source.replaceAll('操作结果', '"操作结果"');
  const quotedDiagnostics = getLingCppControlReferenceDiagnostics(quoted, project, moduleContext, 'src/MainWindow.lcpp');
  assert.equal(quotedDiagnostics.length, 2);
  assert.ok(quotedDiagnostics.every(item => item.level === 'error' && item.range?.startColumn));
  const migrated = migrateQuotedControlReferences(quoted, project, moduleContext, 'src/MainWindow.lcpp');
  assert.equal(migrated.changeCount, 2);
  assert.equal(migrated.source, source);

  const renamed = renameLingCppControlReference(
    [{ filePath: 'src/MainWindow.lcpp', sourceCode: source }],
    project,
    moduleContext,
    reference!.symbol!,
    '结果提示'
  );
  assert.equal(renamed.changeCount, 2);
  assert.match(renamed.sources[0].sourceCode, /控件_设置文本\(结果提示, "完成"\)/u);
  assert.equal(renamed.project.windows[0].controls.find(control => control.id === 'result-label')?.name, '结果提示');

  const nativeCpp = `${source}\n@ 控件_设置文本(L"操作结果", L"原生 C++");`;
  assert.equal(getLingCppControlReferences(nativeCpp, project, moduleContext, 'src/MainWindow.lcpp').length, 2);
});

test('beginner presentation assigns a dedicated control-reference token color kind', () => {
  const tokens = classifyLingCppPresentationCode('控件_设置文本(操作结果, "完成")', {
    isNativeCpp: false,
    moduleCommands: new Set(['控件_设置文本']),
    knownMembers: new Set(),
    knownProcedures: new Set(),
    controlReferences: new Set(['操作结果'])
  });
  assert.equal(tokens.find(token => token.text === '操作结果')?.kind, 'control-reference');
});

test('beginner presentation colors local variables independently from members and strings', () => {
  const tokens = classifyLingCppPresentationCode('如果 (localVar = "localVar")', {
    isNativeCpp: false,
    moduleCommands: new Set(),
    knownMembers: new Set(['成员变量']),
    knownLocals: new Set(['localVar']),
    knownProcedures: new Set()
  });
  assert.equal(tokens.find(token => token.text === 'localVar')?.kind, 'local');
  assert.equal(tokens.find(token => token.kind === 'string')?.kind, 'string');
  const chineseLocal = '\u5c40\u90e8\u53d8\u91cf';
  const chineseTokens = classifyLingCppPresentationCode(`\u5982\u679c (${chineseLocal}=\"123\")`, {
    isNativeCpp: false,
    moduleCommands: new Set(),
    knownMembers: new Set(),
    knownLocals: new Set([chineseLocal]),
    knownProcedures: new Set()
  });
  assert.equal(chineseTokens.find(token => token.text === chineseLocal)?.kind, 'local');
});

test('Monaco control references use an independent semantic token and stable theme colors', () => {
  assert.equal(LINGCPP_CONTROL_REFERENCE_SEMANTIC_TOKEN, 'controlReference');
  assert.notEqual(LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.dark.toLocaleLowerCase(), '#ce9178');
  assert.notEqual(LINGCPP_CONTROL_REFERENCE_TOKEN_COLORS.light.toLocaleLowerCase(), '#a31515');
  assert.deepEqual([...buildLingCppControlReferenceSemanticTokenData([
    { startLine: 2, startColumn: 5, endLine: 2, endColumn: 9 },
    { startLine: 4, startColumn: 3, endLine: 4, endColumn: 8 }
  ])], [1, 4, 4, 0, 0, 2, 2, 5, 0, 0]);
});

test('controlRef reports scope, kind, type, ambiguity and unsafe quoted references independently', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const project: LingWindowProject = {
    id: 'control-ref-errors',
    name: '控件引用诊断',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 480, background: '#111111', description: '', controls: [
        { id: 'label-main', type: 'Label', name: '操作结果', content: '', x: 10, y: 10, width: 120, height: 28, fontSize: 12, background: '#222222', foreground: '#fff', isEnabled: true, visibility: 'Visible', events: {} },
        { id: 'list-main', type: 'ListView', name: '数据列表', content: '', x: 10, y: 50, width: 200, height: 120, fontSize: 12, background: '#222222', foreground: '#fff', isEnabled: true, visibility: 'Visible', events: {} },
        { id: 'duplicate-a', type: 'Label', name: '重复名称', content: '', x: 10, y: 180, width: 100, height: 28, fontSize: 12, background: '#222222', foreground: '#fff', isEnabled: true, visibility: 'Visible', events: {} },
        { id: 'duplicate-b', type: 'Button', name: '重复名称', content: '', x: 120, y: 180, width: 100, height: 28, fontSize: 12, background: '#222222', foreground: '#fff', isEnabled: true, visibility: 'Visible', events: {} }
      ]
    }, {
      id: 'other-window', fileName: 'OtherWindow.xml', className: 'OtherWindow', title: '其他窗口',
      width: 640, height: 480, background: '#111111', description: '', controls: [
        { id: 'other-label', type: 'Label', name: '跨窗标签', content: '', x: 10, y: 10, width: 120, height: 28, fontSize: 12, background: '#222222', foreground: '#fff', isEnabled: true, visibility: 'Visible', events: {} }
      ]
    }],
    resources: [{ id: 'images-main', type: 'ImageList', name: '主图像列表', imageWidth: 16, imageHeight: 16, images: [] }]
  };
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const source = [
    '类 MainWindow : 公开 窗体',
    '事件 测试()',
    '    控件_设置文本(跨窗标签, "x")',
    '    控件_设置文本(主图像列表, "x")',
    '    列表视图_添加行(操作结果, "x")',
    '    控件_设置文本(重复名称, "x")',
    '    控件_设置文本("不存在", "x")',
    '    列表视图_设置图像列表(数据列表, 主图像列表, "small")',
    '结束',
    '结束类'
  ].join('\n');
  const references = getLingCppControlReferences(source, project, moduleContext, 'src/MainWindow.lcpp');
  assert.deepEqual(references.map(reference => reference.status), [
    'scope-mismatch', 'incompatible-kind', 'incompatible-type', 'ambiguous', 'missing', 'resolved', 'resolved'
  ]);
  const diagnostics = getLingCppControlReferenceDiagnostics(source, project, moduleContext, 'src/MainWindow.lcpp');
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-scope-')));
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-kind-')));
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-type-')));
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-ambiguous-')));
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-quoted-')));
  assert.ok(diagnostics.some(item => item.id.startsWith('lingcpp-control-reference-missing-')));
  assert.equal(migrateQuotedControlReferences(source, project, moduleContext, 'src/MainWindow.lcpp').changeCount, 0);
});

test('controlRef recognizes third-party non-visual designer components from module contributions', () => {
  const manifest = {
    schemaVersion: 2 as const,
    id: 'third.party.timer-component',
    name: '计时组件',
    version: '1.0.0',
    category: '界面' as const,
    description: '提供非可视计时组件。',
    contributes: {
      designerControls: [{
        type: 'TimerComponent',
        namespacedType: 'third.party.timer-component/TimerComponent',
        label: '计时组件',
        category: '非可视组件',
        isVisual: false,
        defaultProps: {}
      }],
      commands: [{ name: '计时器_启动', signature: '计时器_启动(组件)', description: '启动计时器', insertText: '计时器_启动($1)' }]
    },
    bindings: { commands: [{
      command: '计时器_启动',
      runtimeName: '计时器_启动',
      parameters: [{
        name: '组件',
        type: 'controlRef' as const,
        controlTypes: ['TimerComponent'],
        controlKinds: ['nonVisual' as const],
        scope: 'currentWindow' as const,
        runtimeRepresentation: 'stableId' as const
      }],
      returnType: 'bool' as const
    }] }
  };
  const module: InstalledModule = {
    manifest,
    installPath: 'test://third-party-timer',
    isBuiltin: false,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [{
        id: 'timer-1',
        type: 'TimerComponent' as LingWindowProject['windows'][number]['controls'][number]['type'],
        designerType: 'third.party.timer-component/TimerComponent',
        name: '刷新计时器',
        content: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        fontSize: 12,
        background: 'transparent',
        foreground: '#ffffff',
        isEnabled: true,
        visibility: 'Visible'
      }]
    }]
  };
  const moduleContext = { enabledModules: [module], availableModules: [module] };
  const source = '类 游戏主窗体 : 公开 窗体\n事件 测试()\n    计时器_启动(刷新计时器)\n结束\n结束类';
  const reference = getLingCppControlReferences(source, project, moduleContext, 'src/MainWindow.lcpp')[0];
  assert.equal(reference?.status, 'resolved');
  assert.equal(reference?.symbol?.kind, 'nonVisual');
  assert.equal(reference?.symbol?.designerType, 'third.party.timer-component/TimerComponent');
});

test('controlRef deterministically emits a wide control name for native C++', () => {
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic')!;
  const module: InstalledModule = {
    manifest,
    installPath: 'builtin://lingbuilder.win32.basic',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [
        ...sampleProject.windows[0].controls,
        { id: 'result-label', type: 'Label', name: '操作结果', content: '', x: 10, y: 10, width: 160, height: 28, fontSize: 13, background: '#202020', foreground: '#ffffff', isEnabled: true, visibility: 'Visible', events: {} }
      ]
    }]
  };
  const source = '类 游戏主窗体 : 公开 窗体\n事件 _游戏主窗体_创建完毕()\n    控件_设置文本(操作结果, "完成")\n结束\n结束类';
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] })
    .files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /控件_设置文本\(L"操作结果", L"完成"\);/u);
});

test('controlRef runtime representations are adapted by the registered UI backend contract', () => {
  const manifest = {
    schemaVersion: 2 as const,
    id: 'third.party.control-representations',
    name: '控件表示测试',
    version: '1.0.0',
    category: '界面' as const,
    description: '验证 stableId 与 nativeHandle。',
    contributes: { commands: [
      { name: '探测稳定ID', signature: '探测稳定ID(控件)', description: '测试', insertText: '探测稳定ID($1)' },
      { name: '探测原生句柄', signature: '探测原生句柄(控件)', description: '测试', insertText: '探测原生句柄($1)' }
    ] },
    bindings: { commands: [
      { command: '探测稳定ID', runtimeName: '调试输出', parameters: [{ name: '控件', type: 'controlRef' as const, controlKinds: ['visual' as const], scope: 'currentWindow' as const, runtimeRepresentation: 'stableId' as const }], returnType: 'void' as const },
      { command: '探测原生句柄', runtimeName: '调试输出', parameters: [{ name: '控件', type: 'controlRef' as const, controlKinds: ['visual' as const], scope: 'currentWindow' as const, runtimeRepresentation: 'nativeHandle' as const }], returnType: 'void' as const }
    ] }
  };
  const module: InstalledModule = { manifest, installPath: 'test://control-representations', isBuiltin: false, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      designerBackend: 'win32',
      controls: [...sampleProject.windows[0].controls, { id: 'result-label', type: 'Label', name: '操作结果', content: '', x: 10, y: 10, width: 160, height: 28, fontSize: 13, background: '#202020', foreground: '#ffffff', isEnabled: true, visibility: 'Visible', events: {} }]
    }]
  };
  const source = '类 游戏主窗体 : 公开 窗体\n事件 _游戏主窗体_创建完毕()\n    探测稳定ID(操作结果)\n    探测原生句柄(操作结果)\n结束\n结束类';
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: [module] });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /调试输出\(LingCppControlStableId\(L"操作结果"\)\);/u);
  assert.match(cpp, /调试输出\(LingCppControlNativeHandle\(L"操作结果"\)\);/u);
  assert.match(cpp, /int LingCppControlStableId[\s\S]+HWND LingCppControlNativeHandle[\s\S]+private:\s+HTREEITEM FindTreeItemByText/u);

  const newEmojiProject = { ...project, windows: [{ ...project.windows[0], designerBackend: 'new-emoji' }] };
  const blocked = generateLingCppNativeWin32Project(newEmojiProject, { lingCppSourceCode: source, enabledModules: [module] });
  assert.ok(blocked.blockingDiagnostics.some(item => item.includes('nativeHandle') && item.includes('new_emoji')));
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

  assert.ok(diagnostics.some(diagnostic => diagnostic.level === 'error' && diagnostic.message.includes('缺少结束语句')));

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
            { name: '回调处理器名称', type: 'handler' }
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
    '        自定义模块_订阅("状态,更新", &数据通道_收到消息)',
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
      controls: [],
      events: { Loaded: '_MainWindow_创建完毕' }
    }]
  };

  const hints = getLingCppDesignerBindings(source, project, 'src/MainWindow.lcpp');
  const diagnostics = getLingCppSemanticDiagnostics(source, project, 'src/MainWindow.lcpp');

  assert.ok(hints.some(hint => hint.status === 'bound' && hint.eventName === 'Window'));
  assert.equal(hints.some(hint => hint.status === 'missing-control'), false);
  assert.equal(hints.some(hint => hint.status === 'missing-source' && hint.handlerName === '_MainWindow_创建完毕'), false);
  assert.equal(diagnostics.some(diagnostic => diagnostic.message.includes('控件不存在')), false);
});

test('LingCpp designer bindings recognize non-visual file dialog resource events', () => {
  const source = `类 MainWindow
    事件 _文件对话框1_文件已选择()
        调试输出("已选择")
    结束
结束类`;
  const project: LingWindowProject = {
    id: 'file-dialog-binding-project',
    name: '文件对话框绑定',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 480, background: '#111111', description: '', controls: []
    }],
    resources: [{
      id: 'file-dialog-1', type: 'FileDialog', name: '文件对话框1', ownerWindowId: 'main-window',
      triggerControlId: '', dropTargetId: '', title: '选择文件', filter: '所有文件|*.*',
      multiple: false, allowDrop: false, filesSelectedHandler: '_文件对话框1_文件已选择'
    }]
  };

  const hints = getLingCppDesignerBindings(source, project, 'src/MainWindow.lcpp');
  assert.ok(hints.some(hint => hint.status === 'bound' && hint.controlId === 'file-dialog-1' && hint.eventName === 'FilesSelected'));
  assert.equal(hints.some(hint => hint.status === 'missing-control'), false);
});

test('LingCpp designer bindings recognize non-visual menu item events by stable item id', () => {
  const source = `类 MainWindow
    事件 _上下文菜单1_打开被选择()
        调试输出("打开")
    结束
结束类`;
  const project: LingWindowProject = {
    id: 'menu-binding-project',
    name: '菜单绑定',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 480, background: '#111111', description: '', controls: []
    }],
    resources: [{
      id: 'context-menu-1', type: 'ContextMenu', name: '上下文菜单1', ownerWindowId: 'main-window', targetControlId: 'main-window',
      items: [{ id: 'open', label: '打开', enabled: true, selectedHandler: '_上下文菜单1_打开被选择' }]
    }]
  };

  const hints = getLingCppDesignerBindings(source, project, 'src/MainWindow.lcpp');
  assert.ok(hints.some(hint => hint.status === 'bound' && hint.controlId === 'context-menu-1:open' && hint.eventName === 'ItemSelected'));
  assert.equal(hints.some(hint => hint.status === 'missing-control'), false);
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

test('ordinary XML-looking module strings do not override the current designer window', () => {
  const source = [
    `${LING_CPP_KEYWORDS[0]} Demo`,
    `${LING_CPP_KEYWORDS[2]} MainWindow : ${LING_CPP_KEYWORDS[3]} ${LING_CPP_TYPES[0]}`,
    `${LING_CPP_KEYWORDS[3]}:`,
    '    构造()',
    '        调试输出("lingbuilder.data.xml")',
    `    ${LING_CPP_KEYWORDS[16]}`,
    `${LING_CPP_KEYWORDS[16]}`
  ].join('\n');
  const project: LingWindowProject = {
    id: 'xml-string-project',
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
      controls: [{
        id: 'result-label',
        type: 'Label',
        name: '操作结果',
        content: '',
        width: 120,
        height: 28,
        x: 10,
        y: 10,
        fontSize: 12,
        background: '#222222',
        foreground: '#ffffff',
        isEnabled: true,
        visibility: 'Visible',
        events: {}
      }]
    }]
  };

  const completions = getLingCppDesignerControlCompletions(source, project);
  assert.ok(completions.some(item => item.label === '操作结果'));
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

const methodLayoutSource = `包 方法布局
使用 Win32窗口

类 方法窗体
公开:
    空 公开一()
        调试输出("一")

    空 公开二()
        调试输出("二")

私有:
    空 私有一()
        调试输出("三")

    事件 _按钮_被单击()
        调试输出("点击")
结束类`;

test('LingCpp AST edit service inserts methods after an anchor while keeping access sections intact', () => {
  // 锚点插入：新子程序出现在锚点方法之后，而不是类末尾
  const anchored = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'add-method',
    className: '方法窗体',
    insertAfterMethodName: '公开一',
    method: {
      name: '紧跟新增',
      returnType: '空',
      bodyLines: ['调试输出("紧跟")'],
      note: '新手模式在当前子程序下方新增'
    }
  });
  assert.equal(anchored.success, true);
  const anchoredLines = anchored.sourceCode.split(/\r?\n/);
  const lineOf = (name: string) => anchoredLines.findIndex(line => line.includes(` ${name}(`));
  const anchorLine = lineOf('公开一');
  assert.equal(lineOf('紧跟新增'), anchorLine + 4);
  assert.ok(anchoredLines[anchorLine + 3].includes('// 新手模式在当前子程序下方新增'));
  assert.ok(lineOf('公开二') > lineOf('紧跟新增'), '锚点之后的原有方法应保持在新方法后面');
  const anchoredParsed = parseLingCpp(anchored.sourceCode);
  assert.equal(anchoredParsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false);
  assert.equal(anchoredParsed.program.classes[0].methods.find(method => method.name === '紧跟新增')?.access, '公开', '无显式访问时继承锚点所在访问段');

  // 跨访问段锚点插入：插入私有子程序后，后续公开方法的访问段必须被恢复
  const crossSection = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'add-method',
    className: '方法窗体',
    insertAfterMethodName: '公开二',
    method: {
      name: '内部辅助',
      returnType: '空',
      access: '私有',
      bodyLines: ['调试输出("内部")']
    }
  });
  assert.equal(crossSection.success, true);
  const crossParsed = parseLingCpp(crossSection.sourceCode);
  assert.equal(crossParsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false);
  const crossMethods = crossParsed.program.classes[0].methods;
  assert.equal(crossMethods.find(method => method.name === '公开二')?.access, '公开');
  assert.equal(crossMethods.find(method => method.name === '内部辅助')?.access, '私有');
  assert.equal(crossMethods.find(method => method.name === '私有一')?.access, '私有');
  assert.equal(crossMethods.find(method => method.name === '_按钮_被单击')?.access, '私有');

  // 未提供锚点时保持原行为：追加到类末尾
  const appended = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'add-method',
    className: '方法窗体',
    method: { name: '末尾新增', returnType: '空', bodyLines: ['调试输出("末尾")'] }
  });
  assert.equal(appended.success, true);
  const appendedLines = appended.sourceCode.split(/\r?\n/);
  assert.ok(appendedLines.findIndex(line => line.includes(' 末尾新增(')) > appendedLines.findIndex(line => line.includes('结束类') || line.includes('_按钮_被单击(')));
});

test('LingCpp AST edit service moves subprograms up and down without changing their access', () => {
  // 同访问段内上移：块整体与上一个方法换位
  const movedUp = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'move-method',
    className: '方法窗体',
    methodName: '公开二',
    direction: 'up'
  });
  assert.equal(movedUp.success, true);
  const movedUpParsed = parseLingCpp(movedUp.sourceCode);
  assert.equal(movedUpParsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false);
  const movedUpMethods = movedUpParsed.program.classes[0].methods.filter(method => method.kind === 'method');
  assert.deepEqual(movedUpMethods.map(method => method.name), ['公开二', '公开一', '私有一']);
  assert.equal(movedUpMethods.find(method => method.name === '公开二')?.access, '公开');

  // 跨访问段上移：私有一移入公开段后，必须带访问段行并恢复后续方法的段归属
  const crossMoved = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'move-method',
    className: '方法窗体',
    methodName: '私有一',
    direction: 'up'
  });
  assert.equal(crossMoved.success, true);
  const crossMovedParsed = parseLingCpp(crossMoved.sourceCode);
  assert.equal(crossMovedParsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false);
  const crossMovedMethods = crossMovedParsed.program.classes[0].methods;
  assert.deepEqual(crossMovedMethods.filter(method => method.kind === 'method').map(method => method.name), ['公开一', '私有一', '公开二']);
  assert.equal(crossMovedMethods.find(method => method.name === '私有一')?.access, '私有');
  assert.equal(crossMovedMethods.find(method => method.name === '公开二')?.access, '公开');
  assert.equal(crossMovedMethods.find(method => method.name === '_按钮_被单击')?.access, '私有');

  // 下移 + 事件处理器不允许移动
  const movedDown = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'move-method',
    className: '方法窗体',
    methodName: '公开一',
    direction: 'down'
  });
  assert.equal(movedDown.success, true);
  assert.deepEqual(
    parseLingCpp(movedDown.sourceCode).program.classes[0].methods.filter(method => method.kind === 'method').map(method => method.name),
    ['公开二', '公开一', '私有一']
  );

  const eventMove = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'move-method',
    className: '方法窗体',
    methodName: '_按钮_被单击',
    direction: 'up'
  });
  assert.equal(eventMove.success, false);
  assert.ok((eventMove.error || '').includes('事件处理器不支持移动'));

  // 已在边缘时保持原样
  const edgeMove = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'move-method',
    className: '方法窗体',
    methodName: '公开一',
    direction: 'up'
  });
  assert.equal(edgeMove.success, true);
  assert.equal(edgeMove.sourceCode, methodLayoutSource);
});

test('LingCpp AST edit service cuts and pastes subprogram blocks with notes preserved', () => {
  const noteSource = methodLayoutSource.replace(
    '    空 私有一()',
    '    // 内部辅助说明\n    // 参数备注 次数：重复次数\n    空 私有一(整数型 次数)'
  );
  const block = getLingCppMethodBlock(noteSource, '方法窗体', '私有一');
  assert.ok(block);
  assert.equal(block!.access, '私有');
  assert.equal(block!.blockLines.length, 4);
  assert.equal(block!.blockLines[0], '    // 内部辅助说明');
  assert.equal(block!.blockLines[1], '    // 参数备注 次数：重复次数');
  assert.equal(block!.blockLines[3].trim(), '调试输出("三")');

  // 粘贴到锚点之后：备注行随块移动，访问段保持
  const pasted = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'insert-method-block',
    className: '方法窗体',
    blockLines: block!.blockLines,
    access: block!.access,
    insertAfterMethodName: '公开一'
  });
  assert.equal(pasted.success, true);
  const pastedParsed = parseLingCpp(pasted.sourceCode);
  assert.equal(pastedParsed.diagnostics.some(diagnostic => diagnostic.level === 'error'), false);
  const pastedMethod = pastedParsed.program.classes[0].methods.find(method => method.name === '私有一');
  assert.ok(pastedMethod);
  assert.equal(pastedMethod?.access, '私有', '粘贴保留子程序自身访问属性（补访问段行）');
  assert.equal(pastedParsed.program.classes[0].methods.find(method => method.name === '公开一')?.access, '公开');
  assert.equal(pastedParsed.program.classes[0].methods.find(method => method.name === '公开二')?.access, '公开', '粘贴后恢复后续方法的访问段');
  assert.equal(pastedMethod?.parameters[0]?.name, '次数');
  const pastedLines = pasted.sourceCode.split(/\r?\n/);
  const pastedDeclIndex = pastedLines.findIndex(line => line.includes(' 私有一('));
  assert.ok(pastedLines[pastedDeclIndex - 1].includes('// 参数备注 次数：重复次数'));
  assert.ok(pastedLines[pastedDeclIndex - 2].includes('// 内部辅助说明'));

  // 粘贴与现有方法重名时由调用方拦截，这里验证纯文本粘贴被拒绝
  const rejected = applyLingCppAstEdit(methodLayoutSource, {
    kind: 'insert-method-block',
    className: '方法窗体',
    blockLines: ['调试输出("不是子程序")'],
    access: '私有'
  });
  assert.equal(rejected.success, false);
  assert.equal(rejected.sourceCode, methodLayoutSource);

  // 删除方法时应连同声明备注一起删除
  const notedSource = methodLayoutSource.replace('    空 公开一()', '    // 公开一备注\n    空 公开一()');
  const removedWithNote = applyLingCppAstEdit(notedSource, {
    kind: 'delete-method',
    className: '方法窗体',
    methodName: '公开一'
  });
  assert.equal(removedWithNote.success, true);
  assert.equal(removedWithNote.sourceCode.includes('公开一'), false);
  assert.equal(removedWithNote.sourceCode.includes('// 公开一备注'), false);
});

test('LingCpp AST edit service adds, updates and deletes method-scoped local variables', () => {
  const added = applyLingCppAstEdit(sampleSource, {
    kind: 'add-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    local: {
      name: 'url',
      type: '文本型',
      initialValue: '"http://127.0.0.1:8981/api"'
    }
  });
  assert.equal(added.success, true);
  assert.ok(added.sourceCode.includes('        局部 文本型 url = "http://127.0.0.1:8981/api"'));
  assert.equal(findLingCppMethod(parseLingCpp(added.sourceCode).program, '_按钮1_被单击')?.locals?.[0]?.name, 'url');

  const updated = applyLingCppAstEdit(added.sourceCode, {
    kind: 'update-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    localName: 'url',
    newName: '请求地址',
    type: '文本型',
    initialValue: '"https://example.com"',
    isArray: false
  });
  assert.equal(updated.success, true);
  assert.ok(updated.sourceCode.includes('局部 文本型 请求地址 = "https://example.com"'));

  const preserved = applyLingCppAstEdit(updated.sourceCode, {
    kind: 'update-method-body',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    bodyLines: ['调试输出(请求地址)']
  });
  assert.equal(preserved.success, true);
  assert.ok(preserved.sourceCode.includes('局部 文本型 请求地址 = "https://example.com"'));
  assert.ok(preserved.sourceCode.includes('        调试输出(请求地址)'));

  const removed = applyLingCppAstEdit(preserved.sourceCode, {
    kind: 'delete-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    localName: '请求地址'
  });
  assert.equal(removed.success, true);
  assert.equal(removed.sourceCode.includes('局部 文本型 请求地址'), false);
});

test('LingCpp AST edit service preserves local constant kind and source order through conversion', () => {
  const inserted = applyLingCppAstEdit(sampleSource, {
    kind: 'add-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    insertBeforeLine: findLingCppMethod(parseLingCpp(sampleSource).program, '_按钮1_被单击')?.statements[1]?.line,
    local: {
      name: '只读标题',
      type: '文本型',
      initialValue: '"运行时标题"',
      isConstant: true
    }
  });
  assert.equal(inserted.success, true);
  assert.match(inserted.sourceCode, /信息框[^\n]+\n\s+局部常量 文本型 只读标题 = "运行时标题"\n\s+调试输出/u);
  assert.equal(findLingCppMethod(parseLingCpp(inserted.sourceCode).program, '_按钮1_被单击')
    ?.locals.find(local => local.name === '只读标题')?.isConstant, true);

  const convertedToVariable = applyLingCppAstEdit(inserted.sourceCode, {
    kind: 'update-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    localName: '只读标题',
    isConstant: false
  });
  assert.match(convertedToVariable.sourceCode, /局部 文本型 只读标题 = "运行时标题"/u);

  const convertedBack = applyLingCppAstEdit(convertedToVariable.sourceCode, {
    kind: 'update-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    localName: '只读标题',
    isConstant: true
  });
  assert.match(convertedBack.sourceCode, /局部常量 文本型 只读标题 = "运行时标题"/u);

  const removed = applyLingCppAstEdit(convertedBack.sourceCode, {
    kind: 'delete-local',
    className: '游戏主窗体',
    methodName: '_按钮1_被单击',
    localName: '只读标题'
  });
  assert.equal(removed.sourceCode.includes('只读标题'), false);
});

test('LingCpp AST edit service inserts a copied local declaration immediately after its table row', () => {
  const source = [
    '类 测试窗口 : 公开 窗体',
    '公开:',
    '    空 运行()',
    '        局部 整数型 次数 = 1',
    '        局部常量 文本型 标题 = "默认标题"',
    '        调试输出(标题)',
    '    结束',
    '结束类'
  ].join('\n');
  const method = findLingCppMethod(parseLingCpp(source).program, '运行');
  assert.ok(method);
  const count = method.locals.find(local => local.name === '次数');
  const title = method.locals.find(local => local.name === '标题');
  assert.ok(count);
  assert.ok(title);

  const addedVariable = applyLingCppAstEdit(source, {
    kind: 'add-local',
    className: '测试窗口',
    methodName: '运行',
    insertBeforeLine: count.line + 1,
    local: { name: '局部变量', type: count.type, isArray: Boolean(count.isArray) }
  });
  assert.equal(addedVariable.success, true);
  assert.match(addedVariable.sourceCode, /局部 整数型 次数 = 1\n\s*局部 整数型 局部变量\n\s*局部常量/u);

  const reparsed = findLingCppMethod(parseLingCpp(addedVariable.sourceCode).program, '运行');
  const reparsedTitle = reparsed?.locals.find(local => local.name === '标题');
  assert.ok(reparsedTitle);
  const addedConstant = applyLingCppAstEdit(addedVariable.sourceCode, {
    kind: 'add-local',
    className: '测试窗口',
    methodName: '运行',
    insertBeforeLine: reparsedTitle.line + 1,
    local: { name: '局部常量', type: reparsedTitle.type, initialValue: '"默认标题"', isConstant: true }
  });
  assert.equal(addedConstant.success, true);
  assert.match(addedConstant.sourceCode, /局部常量 文本型 标题 = "默认标题"\n\s*局部常量 文本型 局部常量 = "默认标题"\n\s*调试输出/u);
});

test('LingCpp local declaration notes parse, update, clear and delete with their declarations', () => {
  const source = [
    '类 测试窗口 : 公开 窗体',
    '    空 运行()',
    '        // 旧变量备注',
    '        局部 文本型 名称 = ""',
    '        // 常量备注',
    '        局部常量 整数型 最大次数 = 10',
    '结束类'
  ].join('\n');

  const initialLocals = findLingCppMethod(parseLingCpp(source).program, '运行')?.locals || [];
  assert.equal(initialLocals.find(local => local.name === '名称')?.note, '旧变量备注');
  assert.equal(initialLocals.find(local => local.name === '最大次数')?.note, '常量备注');

  const updated = applyLingCppAstEdit(source, {
    kind: 'update-local',
    className: '测试窗口',
    methodName: '运行',
    localName: '名称',
    note: '新变量备注'
  });
  assert.equal(updated.success, true);
  assert.match(updated.sourceCode, /\/\/ 新变量备注\n\s*局部 文本型 名称/u);
  assert.equal(findLingCppMethod(parseLingCpp(updated.sourceCode).program, '运行')?.locals?.find(local => local.name === '名称')?.note, '新变量备注');

  const cleared = applyLingCppAstEdit(updated.sourceCode, {
    kind: 'update-local',
    className: '测试窗口',
    methodName: '运行',
    localName: '名称',
    note: ''
  });
  assert.equal(cleared.success, true);
  assert.equal(cleared.sourceCode.includes('新变量备注'), false);

  const removed = applyLingCppAstEdit(cleared.sourceCode, {
    kind: 'delete-local',
    className: '测试窗口',
    methodName: '运行',
    localName: '最大次数'
  });
  assert.equal(removed.success, true);
  assert.equal(removed.sourceCode.includes('常量备注'), false);
  assert.equal(removed.sourceCode.includes('最大次数'), false);
});

test('LingCpp parameter notes parse and round-trip through method signature edits', () => {
  const source = [
    '类 测试窗口 : 公开 窗体',
    '    // 子程序备注',
    '    // 参数备注 输入：输入文本',
    '    // 参数备注 次数：最多重试次数',
    '    空 运行(文本型 输入, 整数型 次数)',
    '        调试输出(输入)',
    '结束类'
  ].join('\n');
  const method = findLingCppMethod(parseLingCpp(source).program, '运行');
  assert.equal(method?.note, '子程序备注');
  assert.equal(method?.parameters[0]?.note, '输入文本');
  assert.equal(method?.parameters[1]?.note, '最多重试次数');

  const updated = applyLingCppAstEdit(source, {
    kind: 'update-method-signature',
    className: '测试窗口',
    methodName: '运行',
    parameters: [
      { type: '文本型', name: '输入', note: '新的输入说明' },
      { type: '整数型', name: '次数' }
    ]
  });
  assert.equal(updated.success, true);
  assert.match(updated.sourceCode, /\/\/ 子程序备注\n\s*\/\/ 参数备注 输入：新的输入说明\n\s*空 运行/u);
  assert.equal(parseLingCpp(updated.sourceCode).program.classes[0]?.methods[0]?.parameters[1]?.note, undefined);

  const cleared = applyLingCppAstEdit(updated.sourceCode, {
    kind: 'update-method-signature',
    className: '测试窗口',
    methodName: '运行',
    parameters: [
      { type: '文本型', name: '输入' },
      { type: '整数型', name: '次数' }
    ]
  });
  assert.equal(cleared.success, true);
  assert.equal(cleared.sourceCode.includes('参数备注'), false);
});

test('beginner definition navigation resolves project procedure calls at the cursor', () => {
  const source = `类 网页窗口 : 公开 窗体
公开:
    空 _GET按钮_被单击()
        演示_GET与全部结果读取()
        调试输出("演示_GET与全部结果读取()")
        // 演示_GET与全部结果读取()
    结束

    空 演示_GET与全部结果读取()
        调试输出("已读取")
    结束
结束类`;
  const parsed = parseLingCpp(source);
  const body = `演示_GET与全部结果读取()
调试输出("演示_GET与全部结果读取()")
// 演示_GET与全部结果读取()`;
  const procedureNames = parsed.program.classes[0].methods.map(method => method.name);
  const callOffset = body.indexOf('GET') + 1;
  const call = getBeginnerProcedureCallAtCursor(body, callOffset, procedureNames);

  assert.equal(call?.name, '演示_GET与全部结果读取');
  assert.equal(
    getBeginnerProcedureCallAtCursor(
      body,
      body.indexOf('演示_GET与全部结果读取', body.indexOf('\n')) + 2,
      procedureNames
    ),
    null
  );
  assert.equal(
    getBeginnerProcedureCallAtCursor(
      body,
      body.lastIndexOf('演示_GET与全部结果读取') + 2,
      procedureNames
    ),
    null
  );

  const definition = resolveBeginnerProcedureDefinition(
    parsed.program,
    '网页窗口',
    call?.name || ''
  );
  assert.equal(definition?.className, '网页窗口');
  assert.equal(definition?.method.name, '演示_GET与全部结果读取');
  assert.equal(definition?.method.line, 9);
});

test('beginner definition navigation resolves &handler references and ignores quoted handlers', () => {
  const body = '请求编号 = 网页_异步访问("https://example.com", 0, &获取IP完成)';
  const handlerOffset = body.indexOf('获取IP完成') + 2;
  assert.equal(
    getBeginnerProcedureCallAtCursor(body, handlerOffset, ['获取IP完成'])?.name,
    '获取IP完成'
  );

  const quoted = '调试输出("&获取IP完成")';
  assert.equal(
    getBeginnerProcedureCallAtCursor(quoted, quoted.indexOf('获取IP完成') + 2, ['获取IP完成']),
    null
  );
});

test('beginner flow guides stay on 如果 branches instead of preceding assignments', () => {
  const firstBody = [
    '调试输出("按钮1被单击")',
    '编辑框1.内容 = "正在获取本机IP……"',
    'IP请求编号 = 网页_异步访问("https://ipinfo.io/json", 0, &获取IP完成)',
    '如果 (IP请求编号 == 0)',
    '编辑框1.内容 = "无法启动后台请求"',
    '如果结束'
  ];
  assert.deepEqual(getBeginnerIfFlowGuideRows(firstBody).map(row => row.mark), [
    '', '', '', '┌', '│', '└'
  ]);

  const completionBody = [
    'IP请求编号 = 网页_异步取当前请求编号()',
    '错误信息 = 网页_异步取错误信息(IP请求编号)',
    '如果 (错误信息 != "")',
    '编辑框1.内容 = "获取失败：" + 错误信息',
    '否则',
    '编辑框1.内容 = 网页_异步取返回文本(IP请求编号)',
    '如果结束'
  ];
  assert.deepEqual(getBeginnerIfFlowGuideRows(completionBody).map(row => row.mark), [
    '', '', '┌', '│', '├', '│', '└'
  ]);
});

test('beginner pointer position resolves the clicked async handler instead of the old caret', () => {
  const body = [
    '调试输出("按钮1被单击")',
    'IP请求编号 = 网页_异步访问("https://ipinfo.io/json", 0, &获取IP完成)'
  ].join('\n');
  const secondLine = body.split('\n')[1];
  const handlerColumn = secondLine.indexOf('获取IP完成') + 2;
  const offset = getBeginnerTextOffsetAtPoint(body, {
    clientX: handlerColumn * 10,
    clientY: 30,
    left: 0,
    top: 0,
    paddingLeft: 0,
    paddingTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
    lineHeight: 24,
    measureText: text => text.length * 10
  });

  assert.equal(
    getBeginnerProcedureCallAtCursor(body, offset, ['获取IP完成'])?.name,
    '获取IP完成'
  );
});

test('beginner definition navigation prefers the caller class and rejects ambiguous cross-class methods', () => {
  const parsed = parseLingCpp(`类 甲 : 公开 窗体
公开:
    空 同名功能()
    结束
结束类

类 乙 : 公开 窗体
公开:
    空 同名功能()
    结束
结束类`);

  assert.equal(resolveBeginnerProcedureDefinition(parsed.program, '乙', '同名功能')?.className, '乙');
  assert.equal(resolveBeginnerProcedureDefinition(parsed.program, '不存在的类', '同名功能'), undefined);
});

test('local variables can be inserted between statements and survive beginner body rewrites', () => {
  const source = `类 测试窗口 : 公开 窗体
公开:
    空 运行()
        调试输出("前")
        调试输出("后")
    结束
结束类`;
  const inserted = applyLingCppAstEdit(source, {
    kind: 'add-local',
    className: '测试窗口',
    methodName: '运行',
    insertBeforeLine: 5,
    local: { name: '中间值', type: '文本型', initialValue: '"内容"' }
  });
  assert.equal(inserted.success, true);
  assert.match(inserted.sourceCode, /调试输出\("前"\)\n\s+局部 文本型 中间值 = "内容"\n\s+调试输出\("后"\)/u);

  const parsedMethod = findLingCppMethod(parseLingCpp(inserted.sourceCode).program, '运行');
  assert.ok(parsedMethod);
  const segments = getBeginnerMethodBodySegments(parsedMethod);
  assert.deepEqual(segments.map(segment => segment.kind), ['code', 'locals', 'code']);

  const rewritten = applyLingCppAstEdit(inserted.sourceCode, {
    kind: 'update-method-body',
    className: '测试窗口',
    methodName: '运行',
    bodyLines: ['调试输出("新的前段")', '调试输出("新的后段")']
  });
  assert.equal(rewritten.success, true);
  assert.match(rewritten.sourceCode, /调试输出\("新的前段"\)\n\s+局部 文本型 中间值 = "内容"\n\s+调试输出\("新的后段"\)/u);

  const expandedFirstSegment = applyLingCppAstEdit(inserted.sourceCode, {
    kind: 'update-method-body',
    className: '测试窗口',
    methodName: '运行',
    bodyLines: ['调试输出("前")', '调试输出("前段新增")', '调试输出("后")'],
    localStatementAnchors: { 中间值: 2 }
  });
  assert.equal(expandedFirstSegment.success, true);
  assert.match(expandedFirstSegment.sourceCode, /调试输出\("前"\)\n\s+调试输出\("前段新增"\)\n\s+局部 文本型 中间值 = "内容"\n\s+调试输出\("后"\)/u);
});

test('multiple local-variable groups remain freely insertable across one method body', () => {
  let source = `类 测试窗口 : 公开 窗体
公开:
    空 运行()
        调试输出("甲")
        调试输出("乙")
        调试输出("丙")
    结束
结束类`;
  const insertBeforeStatement = (name: string, statementText?: string) => {
    const method = findLingCppMethod(parseLingCpp(source).program, '运行');
    assert.ok(method);
    const insertBeforeLine = statementText
      ? method.statements.find(statement => statement.text.includes(statementText))?.line
      : method.endLine;
    const result = applyLingCppAstEdit(source, {
      kind: 'add-local',
      className: '测试窗口',
      methodName: '运行',
      insertBeforeLine,
      local: { name, type: '整数型' }
    });
    assert.equal(result.success, true);
    source = result.sourceCode;
  };

  insertBeforeStatement('前置变量', '甲');
  insertBeforeStatement('中间变量', '乙');
  insertBeforeStatement('尾部变量');

  assert.match(source, /局部 整数型 前置变量\s+调试输出\("甲"\)\s+局部 整数型 中间变量\s+调试输出\("乙"\)\s+调试输出\("丙"\)\s+局部 整数型 尾部变量/u);
  const method = findLingCppMethod(parseLingCpp(source).program, '运行');
  assert.ok(method);
  assert.deepEqual(
    getBeginnerMethodBodySegments(method).map(segment => segment.kind),
    ['locals', 'code', 'locals', 'code', 'locals', 'code']
  );
});

test('beginner editor keeps a writable trailing code segment after final local declarations', () => {
  const source = `类 测试窗口 : 公开 窗体
公开:
    事件 _按钮2_被单击()
        调试输出("事件开始")
        局部 文本型 局部变量 = "111"
    结束
结束类`;
  const method = findLingCppMethod(parseLingCpp(source).program, '_按钮2_被单击');
  assert.ok(method);

  const segments = getBeginnerMethodBodySegments(method);
  assert.deepEqual(segments.map(segment => segment.kind), ['code', 'locals', 'code']);
  const trailing = segments.at(-1);
  assert.equal(trailing?.kind, 'code');
  assert.deepEqual(trailing?.statements, []);
  assert.equal(trailing?.statementStartIndex, 1);
});

test('beginner Ctrl+L and Ctrl+B resolve the caret row and shortcut kind precisely', () => {
  const body = [
    '返回字节 = 网页_访问_对象(网址, 1, 表单数据)',
    '调试输出("POST 状态码：", 网页_取返回状态代码())',
    '调试输出("POST 返回文本：", 网页_取返回文本())',
    '调试输出("POST 错误信息：", 网页_取错误信息())'
  ].join('\n');
  const fourthLineStart = body.lastIndexOf('调试输出');

  assert.equal(getBeginnerLocalInsertStatementIndex(body, fourthLineStart), 3);
  assert.equal(getBeginnerLocalInsertStatementIndex(body, fourthLineStart + 8), 3);
  assert.equal(getBeginnerLocalInsertStatementIndex(`${body}\n`, body.length + 1), 4);
  assert.equal(getBeginnerLocalInsertStatementIndex(`\n${body}`, 0), 0);
  assert.equal(getBeginnerLocalInsertStatementIndex(body, fourthLineStart, 5), 8);
  assert.equal(getBeginnerLocalInsertStatementIndex('第一行\n\n第三行', 4), 1);
  assert.equal(isBeginnerLocalInsertShortcut({
    key: 'Process', code: 'KeyL', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false
  }), true);
  assert.equal(isBeginnerLocalInsertShortcut({
    key: 'l', code: 'KeyL', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false
  }), false);
  assert.equal(getBeginnerLocalInsertShortcutKind({
    key: 'Process', code: 'KeyB', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false
  }), 'constant');
  assert.equal(getBeginnerLocalInsertShortcutKind({
    key: 'b', code: 'KeyB', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false
  }), 'constant');
  assert.equal(getBeginnerLocalInsertShortcutKind({
    key: 'b', code: 'KeyB', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true
  }), null);

  const source = `类 测试窗口 : 公开 窗体
公开:
    空 运行()
        ${body.split('\n').join('\n        ')}
    结束
结束类`;
  const method = findLingCppMethod(parseLingCpp(source).program, '运行');
  assert.ok(method);
  const statementIndex = getBeginnerLocalInsertStatementIndex(body, fourthLineStart);
  const inserted = applyLingCppAstEdit(source, {
    kind: 'add-local',
    className: '测试窗口',
    methodName: '运行',
    insertBeforeLine: method.statements[statementIndex]?.line,
    local: { name: '局部常量', type: '文本型', initialValue: '""', isConstant: true }
  });
  assert.equal(inserted.success, true);
  assert.match(
    inserted.sourceCode,
    /调试输出\("POST 返回文本：", 网页_取返回文本\(\)\)\n\s+局部常量 文本型 局部常量 = ""\n\s+调试输出\("POST 错误信息：", 网页_取错误信息\(\)\)/u
  );
});

test('beginner Enter auto-declaration infers literals and module command return types safely', () => {
  const source = `类 测试窗口 : 公开 窗体
公开:
    空 _按钮1_被单击()
        url="http://127.0.0.1:8981/api"
        ret = 网页_访问_对象(url, 1)
    结束
结束类`;
  const parsed = parseLingCpp(source);
  const ownerClass = parsed.program.classes[0];
  const method = ownerClass.methods[0];
  const webModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.web.http.test',
      name: '网页访问',
      version: '1.0.0',
      category: '网络',
      description: '测试网页访问返回类型',
      contributes: {
        commands: [{
          name: '网页_访问_对象',
          signature: '网页_访问_对象(网址, 访问方式)',
          description: '访问网页',
          returnType: '字节集'
        }]
      },
      bindings: {
        commands: [{ command: '网页_访问_对象', runtimeName: '网页_访问_对象', returnType: 'raw' }]
      },
      targets: []
    },
    installPath: 'test/web',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };

  const url = analyzeBeginnerAutoLocalAssignment({
    lineText: 'url="http://127.0.0.1:8981/api"',
    method,
    ownerClass
  });
  assert.deepEqual(url, {
    kind: 'declare',
    name: 'url',
    expression: '"http://127.0.0.1:8981/api"',
    inferredType: '文本型'
  });

  const ret = analyzeBeginnerAutoLocalAssignment({
    lineText: 'ret = 网页_访问_对象(url, 1)',
    method,
    ownerClass,
    moduleContext: { enabledModules: [webModule], availableModules: [webModule] }
  });
  assert.equal(ret.kind, 'declare');
  assert.equal(ret.kind === 'declare' ? ret.inferredType : undefined, '字节集');

  const unknown = analyzeBeginnerAutoLocalAssignment({
    lineText: '未知结果 = 自定义调用()',
    method,
    ownerClass
  });
  assert.equal(unknown.kind, 'declare');
  assert.equal(unknown.kind === 'declare' ? unknown.inferredType : 'unexpected', undefined);
  assert.equal(analyzeBeginnerAutoLocalAssignment({ lineText: '// url="x"', method, ownerClass }).kind, 'none');
  assert.equal(analyzeBeginnerAutoLocalAssignment({ lineText: '按钮1.标题 = "x"', method, ownerClass }).kind, 'none');
  assert.equal(isCompleteBeginnerExpression('网页_访问_对象(url, 1'), false);
  assert.equal(isCompleteBeginnerExpression('网页_访问_对象(url, 1)'), true);
});

test('beginner Enter auto-declaration prompts loop variables for count/range/foreach loops', () => {
  const source = `类 测试窗口 : 公开 窗体
公开:
    空 _按钮1_被单击()
        文本型 名称列表[]
        整数型 已有计数
        字节集 数据
        计次循环首 (10, 计次变量)
            已有计数 = 已有计数 + 1
        计次循环尾 ()
    结束
结束类`;
  const parsed = parseLingCpp(source);
  const ownerClass = parsed.program.classes[0];
  const method = ownerClass.methods[0];
  const loopOptions = { lineText: '', method, ownerClass };

  const count = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首 (10, 计次变量)' });
  assert.deepEqual(count, { kind: 'declare', name: '计次变量', inferredType: '整数型', statement: '计次循环首 (10, 计次变量)' });

  const fullWidth = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首（10，计次变量）' });
  assert.equal(fullWidth.kind, 'declare');
  assert.equal(fullWidth.kind === 'declare' ? fullWidth.inferredType : 'unexpected', '整数型');

  const indented = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '    计次循环首 (10, 计次变量)' });
  assert.equal(indented.kind, 'declare');

  const range = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '变量循环首 (1, 10, 2, 索引)' });
  assert.equal(range.kind, 'declare');
  assert.equal(range.kind === 'declare' ? range.inferredType : 'unexpected', '整数型');

  const foreach = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '枚举循环首 (名称列表, 当前项)' });
  assert.equal(foreach.kind, 'declare');
  assert.equal(foreach.kind === 'declare' ? foreach.inferredType : 'unexpected', '文本型');

  const foreachBytes = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '枚举循环首 (数据, 字节)' });
  assert.equal(foreachBytes.kind, 'declare');
  assert.equal(foreachBytes.kind === 'declare' ? foreachBytes.inferredType : 'unexpected', '字节型');

  const foreachUnknown = analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '枚举循环首 (未知集合, 当前项)' });
  assert.equal(foreachUnknown.kind, 'declare');
  assert.equal(foreachUnknown.kind === 'declare' ? foreachUnknown.inferredType : 'unexpected', undefined);

  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首 (10)' }).kind, 'none');
  assert.equal(
    (analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首 (10, 已有计数)' }) as { reason?: string }).reason,
    'already-declared'
  );
  assert.equal(
    (analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首 (10, "次数")' }) as { reason?: string }).reason,
    'not-identifier'
  );
  assert.equal(
    (analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环首 (10, 按钮1.标题)' }) as { reason?: string }).reason,
    'not-identifier'
  );
  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '变量循环首 (1, 10, 2)' }).kind, 'none');
  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '判断循环首 (条件)' }).kind, 'none');
  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '计次循环尾 ()' }).kind, 'none');
  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '信息框 ("提示", 0, "标题")' }).kind, 'none');
  assert.equal(analyzeBeginnerAutoLocalLoopVariable({ ...loopOptions, lineText: '// 计次循环首 (10, 计次变量)' }).kind, 'none');
});

test('beginner local variable type completion resolves Chinese pinyin abbreviations', () => {
  const catalog = buildBeginnerTypeCompletionCatalog([
    '文本型', '整数型', '逻辑型', '小数型', '按钮'
  ]);
  assert.equal(filterBeginnerTypeCompletions(catalog, 'wb')[0]?.label, '文本型');
  assert.equal(filterBeginnerTypeCompletions(catalog, 'zs')[0]?.label, '整数型');
  assert.equal(filterBeginnerTypeCompletions(catalog, 'string')[0]?.label, '文本型');
  assert.equal(filterBeginnerTypeCompletions(catalog, 'int')[0]?.label, '整数型');
  assert.equal(resolveBeginnerTypeAlias(catalog, 'wb'), '文本型');
  assert.equal(resolveBeginnerTypeAlias(catalog, 'zs'), '整数型');
  assert.equal(resolveBeginnerTypeAlias(catalog, '自定义类型'), '自定义类型');
});

test('LingCpp parameter array type helpers keep the canonical type suffix', () => {
  assert.equal(isLingCppArrayParameterType('整数型[]'), true);
  assert.equal(isLingCppArrayParameterType('文本型［］'), true);
  assert.equal(isLingCppArrayParameterType('整数型'), false);
  assert.equal(getLingCppParameterElementType('整数型[]'), '整数型');
  assert.equal(setLingCppArrayParameterType('整数型', true), '整数型[]');
  assert.equal(setLingCppArrayParameterType('整数型［］', false), '整数型');
});

test('LingCpp AST edits and native generation preserve array parameters end to end', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '    空 批量处理()',
    '    结束',
    '结束类'
  ].join('\n');
  const edited = applyLingCppAstEdit(source, {
    kind: 'update-method-signature',
    className: '游戏主窗体',
    methodName: '批量处理',
    parameters: [{ type: setLingCppArrayParameterType('整数型', true), name: '编号集合' }]
  });

  assert.equal(edited.success, true);
  assert.match(edited.sourceCode, /空 批量处理\(整数型\[\] 编号集合\)/u);
  assert.equal(parseLingCpp(edited.sourceCode).program.classes[0]?.methods[0]?.parameters[0]?.type, '整数型[]');

  const mainCpp = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: edited.sourceCode
  }).files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(mainCpp, /void 批量处理\(std::vector<int> 编号集合\)/u);
});

test('beginner local and assembly variables expose pinyin completion aliases', () => {
  const local = createBeginnerVariableCompletion({
    name: '本机IP',
    type: '文本型',
    scope: '局部变量',
    ownerName: '按钮1_被单击'
  });
  const assembly = createBeginnerVariableCompletion({
    name: '本机地址',
    type: '文本型',
    scope: '程序集变量'
  });

  assert.ok(local.aliases.includes('benjiip'));
  assert.ok(local.aliases.includes('bjip'));
  assert.ok(local.aliases.some(alias => alias.startsWith('bj')));
  assert.ok(assembly.aliases.includes('benjidizhi'));
  assert.ok(assembly.aliases.includes('bjdz'));
  assert.match(local.detail, /局部变量/u);
  assert.match(assembly.detail, /程序集变量/u);
});

test('beginner subroutine completions expose pinyin initial aliases', () => {
  assert.ok(buildChineseCompletionSearchAliases('新子程序').includes('xzcx'));
  assert.ok(buildChineseCompletionSearchAliases('新子程序').includes('xinzichengxu'));

  const source = readFileSync(resolve(process.cwd(), 'src', 'components', 'DiffViewer.tsx'), 'utf8');
  assert.match(source, /buildChineseCompletionSearchAliases\(functionCallName\(target\)\)/u);
  assert.match(source, /buildChineseCompletionSearchAliases\(target\.method\.name\)/u);
});

test('beginner editor exposes method-scoped local declarations with variable and constant categories', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'components', 'DiffViewer.tsx'), 'utf8');
  assert.match(source, /局部声明 · .*变量与只读常量仅在当前子程序内有效/u);
  assert.match(source, /kind: 'add-local'/u);
  assert.match(source, /kind: 'update-local'/u);
  assert.match(source, /kind: 'delete-local'/u);
  assert.match(source, /<option value="variable">变量<\/option>/u);
  assert.match(source, /<option value="constant">常量<\/option>/u);
  assert.match(source, /ADD_BEGINNER_LOCAL_CONSTANT_COMMAND/u);
  assert.match(source, /Ctrl\+L 变量 · Ctrl\+B 常量/u);
  assert.match(source, /getBeginnerCodeCompletionItems\(target\)/u);
  assert.match(source, /createBeginnerVariableCompletion\(/u);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === 'Tab'/u);
  assert.match(source, /onMouseDown=\{event =>/u);
  assert.match(source, /const segmentId = segmentContext\?\.segment\.id \|\| 'all'/u);
  // 补全状态必须经镜像 ref 读取（textarea 位于按 revision 记忆化的块内，闭包 state 可能过期）。
  assert.match(source, /beginnerCompletionStateRef\.current/u);
  assert.match(source, /liveCompletionState\.segmentId === segmentId/u);
  assert.match(source, /getBeginnerLocalInsertShortcutKind\(event\)/u);
  assert.match(source, /localInsertShortcutKind === 'constant'/u);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/u);
  assert.match(source, /data-beginner-local-target-key/u);
  assert.match(source, /getBeginnerLocalInsertStatementIndex\(/u);
  assert.match(source, /折叠局部声明组/u);
  assert.match(source, /tryBeginnerAutoLocalOnEnter/u);
  assert.match(source, /为 .* 选择类型/u);
  assert.match(source, /handleBeginnerCodeClick/u);
  assert.match(source, /转到定义：/u);
  assert.match(source, /&处理器名可转到定义/u);
  assert.match(source, /getBeginnerTextareaOffsetAtPoint\(event\.currentTarget, event\.clientX, event\.clientY\)/u);
  assert.match(source, /style=\{\{ height: `\$\{lineHeight\}px`, lineHeight: `\$\{lineHeight\}px` \}\}/u);
  assert.match(source, /flowGuideColumn instanceof HTMLElement\) flowGuideColumn\.scrollTop = 0/u);
  assert.match(source, /data-beginner-process-key/u);
  assert.match(source, /if \(locals\.length === 0\) return null/u);
  assert.doesNotMatch(source, /locals:empty/u);
  assert.doesNotMatch(source, /data-beginner-new-local-type/u);
  assert.match(source, /data-beginner-local-type/u);
  assert.match(source, /支持中文、英文和拼音简写/u);
});

test('beginner editor keeps a parameter entry row for zero-parameter subroutines', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'components', 'DiffViewer.tsx'), 'utf8');
  assert.match(source, /const renderParameterCanvas = \(target: BeginnerCodeTarget, visualLine: number\)/u);
  assert.match(source, /填写名称和类型后新增/u);
  assert.match(source, /新增参数并写回子程序签名/u);
  assert.match(source, /\{ label: '操 作', width: 104 \}/u);
  assert.match(source, /gap-1 whitespace-nowrap rounded border px-1 text-\[10px\]/u);
  assert.match(source, /target\.method\.parameters\.length \+ 1/u);
  assert.match(source, /data-beginner-parameter-type/u);
  assert.match(source, /data-beginner-new-parameter-type/u);
  assert.match(source, /renderParameterArraySwitch/u);
  assert.match(source, /renderNewParameterArraySwitch/u);
  assert.match(source, /setLingCppArrayParameterType/u);
  assert.match(source, /updateBeginnerTypeCompletion\(inputKey, event\.currentTarget\)/u);
  assert.match(source, /renderBeginnerTypeCompletionPopup\(inputKey, applyTypeCompletion\)/u);
  assert.doesNotMatch(source, /renderEventFunctionCallBar/u);
  assert.doesNotMatch(source, /调用功能/u);
  assert.doesNotMatch(source, /无参数，点击“插入调用”会直接写入当前子程序/u);
});

test('beginner editor defers pointer state synchronization until after the caret paint', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'components', 'DiffViewer.tsx'), 'utf8');
  const appSource = readFileSync(resolve(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assert.match(appSource, /if \(activeEditorGroupRef\.current === group\) return/u);
  assert.match(source, /const scheduleBeginnerPointerSync/u);
  assert.match(source, /frames\.first = window\.requestAnimationFrame/u);
  assert.match(source, /frames\.second = window\.requestAnimationFrame/u);
  assert.match(source, /onFocus=\{event => scheduleBeginnerPointerSync/u);
  assert.match(source, /onSelect=\{event => scheduleBeginnerPointerSync/u);
  assert.match(source, /const stateChanged = !previous/u);
});

test('beginner editor tables support dragging and resetting column widths', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'components', 'DiffViewer.tsx'), 'utf8');
  const serviceSource = readFileSync(
    resolve(process.cwd(), 'src', 'services', 'editor', 'beginnerTableColumnWidths.ts'),
    'utf8'
  );
  // 五类表格统一经 renderInlineTable 以表型 key 接入列宽状态。
  for (const tableKey of ['declaration', 'process', 'member', 'parameters', 'locals']) {
    assert.match(source, new RegExp(`renderInlineTable\\(\\s*'${tableKey}',`));
  }
  assert.match(source, /const beginBeginnerColumnResize/u);
  assert.match(source, /role="separator"/u);
  assert.match(source, /title="拖动调整列宽，双击恢复默认"/u);
  assert.match(source, /const resetBeginnerColumnWidth/u);
  assert.match(source, /resolveBeginnerColumnWidths\('process',/u);
  // 列宽覆盖持久化走独立偏好 service，最小列宽有下限。
  assert.match(serviceSource, /readBeginnerTableColumnWidthOverrides/u);
  assert.match(serviceSource, /writeBeginnerTableColumnWidths/u);
  assert.match(serviceSource, /BEGINNER_TABLE_MIN_COLUMN_WIDTH = 48/u);
  // 项目变量与项目常量表共用同一列宽偏好 service。
  const globalsSource = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'ProjectGlobalVariableEditor.tsx'),
    'utf8'
  );
  for (const tableKey of ['project-globals', 'project-constants']) {
    assert.match(globalsSource, new RegExp(`'${tableKey}'`));
  }
  assert.match(globalsSource, /const beginTableColumnResize/u);
  assert.match(globalsSource, /title="拖动调整列宽，双击恢复默认"/u);
  assert.match(globalsSource, /table-fixed/u);
  assert.doesNotMatch(globalsSource, /min-w-\[96px\]/u);
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
  assert.match(mainCpp, /L"Button", L"按钮1", L"开始", 48, 72, 120, 36, 14, L"Microsoft YaHei UI", false, false, false, 18,/);
  assert.match(mainCpp, /L"Button", L"按钮2", L"退出", 48, 124, 120, 36, 14, L"Microsoft YaHei UI", false, false, false, 0,/);
  assert.ok(mainCpp.includes('static COLORREF BlendColor'));
  assert.ok(mainCpp.includes('bool IsButtonControl(const ControlSpec& control) const'));
  assert.ok(mainCpp.includes('IsWindowEnabled(item->hwndItem) != FALSE'));
  assert.ok(mainCpp.includes('bool hovered = enabled && !pressed && runtime->mouseInside'));
  assert.ok(mainCpp.includes('bool toggle = IsType(*control, L"Button") && (control->flags & CF_BUTTON_TOGGLE)'));
  assert.ok(mainCpp.includes('bool checked = toggle && SendMessageW(item->hwndItem, BM_GETCHECK, 0, 0) == BST_CHECKED'));
  assert.ok(mainCpp.includes('ownerDrawSelection = IsType(*control, L"CheckBox") || IsType(*control, L"RadioButton")'));
  assert.ok(mainCpp.includes('IsType(*control, L"Button") && (control->flags & CF_BUTTON_TOGGLE)'));
  assert.ok(mainCpp.includes('Button") && (control->flags & CF_BUTTON_TOGGLE) && notification == BN_CLICKED'));
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
  const ownerButtonPainter = mainCpp.slice(
    mainCpp.indexOf('bool PaintOwnerButton(const DRAWITEMSTRUCT* item)'),
    mainCpp.indexOf('bool PaintOwnerListBox(', mainCpp.indexOf('bool PaintOwnerButton(const DRAWITEMSTRUCT* item)'))
  );
  assert.equal(ownerButtonPainter.includes('DrawFocusRect(item->hDC'), false);
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

test('LCPP 整行注释中的信息框和调试输出不会进入 F5 生成结果', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '    事件 _按钮1_被单击()',
    '        // 信息框("注释弹窗", 64, "事件触发")',
    '        注释 调试输出("注释日志")',
    '        // 如果 (信息框("注释确认", 36, "退出确认") == 6)',
    '        如果 (真)',
    '            // 信息框("分支注释弹窗", 64, "提示")',
    '            调试输出("保留输出")',
    '        如果结束',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.doesNotMatch(mainCpp, /L"(?:注释弹窗|注释日志|注释确认|分支注释弹窗)"/u);
  assert.match(mainCpp, /if \(true\) \{/u);
  assert.match(mainCpp, /调试输出\(L"保留输出"\);/u);
});

test('generateLingCppNativeWin32Project emits members, locals and module return assignments as C++', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '私有:',
    '    文本型 apiBase = "http://127.0.0.1:8981"',
    '    事件 _按钮1_被单击()',
    '        局部 文本型 url = "http://127.0.0.1:8981/api"',
    '        局部 字节集 ret',
    '        ret = 网页_访问_对象(url, 1)',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source,
    enabledModules: [byteResponseModule]
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.ok(mainCpp.includes('std::wstring apiBase = L"http://127.0.0.1:8981";'));
  assert.ok(mainCpp.includes('std::wstring url = L"http://127.0.0.1:8981/api";'));
  assert.ok(mainCpp.includes('std::vector<unsigned char> ret{};'));
  assert.ok(mainCpp.includes('ret = LB_WebRequestObject(LingCppWideArg(url), 1);'));
  assert.equal(mainCpp.includes('暂不支持的中文 C++ 语句：ret ='), false);
});

test('Win32 generator converts single-equals Chinese text conditions to wide-string equality', () => {
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '    事件 _按钮2_被单击()',
    '        局部 文本型 局部变量 = "12234"',
    '        如果 (局部变量 = "12234")',
    '            调试输出("匹配")',
    '        否则',
    '            调试输出("不匹配")',
    '        如果结束',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /std::wstring 局部变量 = L"12234";/u);
  assert.ok(cpp.includes('if (std::wstring(LingCppWideArg(局部变量))==LingCppWideArg(L"12234")) {'));
  assert.equal(cpp.includes('局部变量 = "12234"'), false);
});

test('新手编辑器局部变量引用使用局部变量声明的绿色语义颜色', () => {
  const variableName = '\u5c40\u90e8\u53d8\u91cf';
  const tokens = tokenizeEplStatement(`\u5982\u679c (${variableName}=\"123\")`, new Set([variableName]));
  assert.equal(tokens.find(token => token.text === variableName)?.kind, 'variable');
  assert.equal(EPL_TOKEN_COLORS_DARK.variable, '#9df59c');
  assert.equal(EPL_TOKEN_COLORS_LIGHT.variable, '#047857');
  assert.equal(EPL_STRUCTURED_EDITOR_THEME_DARK.variable, EPL_TOKEN_COLORS_DARK.variable);
  assert.equal(EPL_STRUCTURED_EDITOR_THEME_LIGHT.variable, EPL_TOKEN_COLORS_LIGHT.variable);
});

test('generateLingCppNativeWin32Project emits runtime local constants in source order with local source maps', () => {
  const sourcePath = 'src/MainWindow.lcpp';
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '    整数型 取最大次数()',
    '        返回 3',
    '    结束',
    '    事件 _按钮1_被单击()',
    '        调试输出("before")',
    '        局部常量 整数型 最大次数 = 取最大次数()',
    '        局部常量 文本型 标题 = "ready"',
    '        调试输出(最大次数)',
    '    结束',
    '结束类',
    '',
    '功能库 数值工具',
    '公开:',
    '    整数型 计算()',
    '        局部常量 整数型 功能值 = 4',
    '        返回 功能值',
    '    结束',
    '结束功能库'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source,
    lingCppSourceFilePath: sourcePath
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /int const 最大次数 = 取最大次数\(\);/u);
  assert.match(cpp, /std::wstring const 标题 = L"ready";/u);
  assert.match(cpp, /int const 功能值 = 4;/u);
  assert.doesNotMatch(cpp, /constexpr[^\n]+最大次数/u);
  assert.ok(cpp.indexOf('调试输出(L"before")') < cpp.indexOf('int const 最大次数'));
  assert.ok(cpp.indexOf('int const 最大次数') < cpp.indexOf('调试输出(最大次数)'));
  assert.ok(generated.sourceMap.some(entry => (
    entry.kind === 'local'
    && entry.symbolName === '最大次数'
    && entry.sourceFile === sourcePath
    && entry.sourceStartLine === 7
  )));
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'local' && entry.symbolName === '功能值'));

  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '局部常量生成测试',
      targets: [{
        id: 'windows-msvc-win32',
        platform: 'windows',
        arch: 'win32',
        toolchain: 'msvc',
        includeDirs: ['include'],
        libs: ['lib/Win32/new_emoji.lib']
      }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const newEmojiProject: LingWindowProject = {
    ...sampleProject,
    id: 'local-constant-new-emoji',
    windows: sampleProject.windows.map(window => ({ ...window, designerBackend: 'new-emoji' }))
  };
  const newEmojiCpp = generateLingCppNativeWin32Project(newEmojiProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source.replace('事件 _按钮1_被单击()', '事件 创建完毕()'),
    enabledModules: [newEmojiModule]
  }).files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(newEmojiCpp, /int const 最大次数 = 取最大次数\(\);/u);
  assert.match(newEmojiCpp, /int const 功能值 = 4;/u);
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
  assert.ok(mainCpp.includes('L"center", CW_USEDEFAULT, CW_USEDEFAULT, true, true, 1, false, g_controls_1'));
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

test('generateLingCppNativeWin32Project keeps wide string arguments inside arithmetic expressions', () => {
  const source = `类 游戏主窗体 : 公开 窗体
公开:
    事件 _按钮1_被单击()
        控件_设置数值("进度条1", 控件_取数值("进度条1")+10)
        控件_设置数值("进度条1", 控件_取数值("进度条1")-10)
    结束
结束类`;
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.ok(mainCpp.includes('控件_设置数值(L"进度条1", 控件_取数值(L"进度条1")+10);'));
  assert.ok(mainCpp.includes('控件_设置数值(L"进度条1", 控件_取数值(L"进度条1")-10);'));
  assert.equal(mainCpp.includes('控件_取数值("进度条1")'), false);
});

test('generateLingCppNativeWin32Project accepts std::wstring results for 控件_添加项目', () => {
  const source = `类 游戏主窗体 : 公开 窗体
    事件 _按钮1_被单击()
        控件_添加项目(主题列表, 到文本(123))
    结束
结束类`;
  const project: LingWindowProject = {
    ...sampleProject,
    windows: [{
      ...sampleProject.windows[0],
      controls: [...sampleProject.windows[0].controls, {
        id: 'theme-combo', type: 'ComboBox', name: '主题列表', content: '',
        width: 180, height: 28, x: 48, y: 180, fontSize: 13,
        background: '#FFFFFF', foreground: '#111111', isEnabled: true,
        visibility: 'Visible'
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, { activeWindowId: 'window-1', lingCppSourceCode: source });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.ok(mainCpp.includes('int 控件_添加项目(const wchar_t* controlName, const std::wstring& text)'));
  assert.ok(mainCpp.includes('控件_添加项目('));
  assert.ok(mainCpp.includes('到文本(123)'));
});

test('generateLingCppNativeWin32Project translates ordinary conditions and rounds window dimensions', () => {
  const source = `类 游戏主窗体 : 公开 窗体
    事件 _按钮1_被单击()
        如果 (文件对话框_取文件(文件对话框1, 0)!="")
            控件_设置文本(按钮1, "已选择")
        否则
            控件_设置文本(按钮1, "未选择")
        如果结束
    结束
结束类`;
  const decimalProject: LingWindowProject = {
    ...sampleProject,
    resources: [{
      id: 'file-dialog-1', type: 'FileDialog', name: '文件对话框1', ownerWindowId: 'window-1',
      triggerControlId: 'button-1', dropTargetId: '', title: '选择文件', filter: '所有文件|*.*',
      multiple: false, allowDrop: false, filesSelectedHandler: '', filesDroppedHandler: '', cancelledHandler: ''
    }],
    windows: [{ ...sampleProject.windows[0], width: 640.6, height: 480.6 }]
  };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const generated = generateLingCppNativeWin32Project(decimalProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source,
    enabledModules
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.ok(mainCpp.includes('if (std::wstring(LingCppWideArg(文件对话框_取文件(L"文件对话框1", 0)))!=LingCppWideArg(L"")) {'));
  assert.ok(mainCpp.includes('} else {'));
  assert.equal(mainCpp.includes('暂不支持的中文 C++ 语句：如果'), false);
  assert.match(mainCpp, /L"太空冒险", 641, 453,/u);
  assert.match(mainCpp, /static BOOL AdjustWindowRectForDpiValue\(/u);
  assert.match(mainCpp, /const UINT actualDpi = GetDpiForWindow\(hwnd_\);/u);
  assert.match(mainCpp, /SetWindowPos\(hwnd_, nullptr, actualX, actualY, actualWidth, actualHeight, resizeFlags\);/u);
  assert.ok(mainCpp.indexOf('const UINT actualDpi = GetDpiForWindow(hwnd_);') < mainCpp.indexOf('ShowWindow(hwnd_, showCommand);'));
  assert.match(mainCpp, /case WM_DPICHANGED:[\s\S]+AdjustWindowRectForDpiValue\(&desired[\s\S]+desired\.right - desired\.left/u);
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
  assert.ok(mainCpp.includes('while (true) {'));
  assert.equal(mainCpp.includes('// 暂不支持的中文 C++ 语句：循环'), false);
  assert.equal(mainCpp.includes('// 暂不支持的中文 C++ 语句：循环结束'), false);
  assert.equal(mainCpp.includes('// 暂不支持的中文 C++ 语句：返回'), false);
  assert.ok(mainCpp.includes('return;'));
});

test('LingCpp complete control flow generates deterministic C++ and beginner flow guides', () => {
  const source = `包 控制流测试
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    事件 _游戏主窗体_创建完毕()
        局部 整数型 次数 = 0
        局部 整数型 索引 = 0
        局部 整数型 当前项 = 0
        局部 整数型 项目[]
        如果真 (真 并且 非假)
            次数 = 1
        否则如果 (次数 == 2 或者 假)
            次数 = 2
        否则
            次数 = 3
        如果真结束
        选择 (次数)
            分支 (1, 2)
                次数 = 4
            默认
                次数 = 5
        选择结束
        循环
            跳出循环
        循环结束
        判断循环首 (次数 < 8)
            次数 = 次数 + 1
        判断循环尾 ()
        循环判断首 ()
            继续循环
        循环判断尾 (假)
        计次循环首 (3, 索引)
            调试输出("计次")
        计次循环尾 ()
        变量循环首 (1, 3, 1, 索引)
            调试输出("变量")
        变量循环尾 ()
        枚举循环首 (项目, 当前项)
            调试输出("枚举")
        枚举循环尾 ()
        尝试
            抛出("测试异常")
        捕获 (错误信息)
            调试输出("已捕获")
        最终
            选择 (次数)
                分支 (4)
                    调试输出("最终分支")
                默认
                    调试输出("最终默认")
            选择结束
            调试输出("始终执行")
        尝试结束
    结束
结束类`;
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(mainCpp, /if \(true&&!\(false\)\) \{/u);
  assert.match(mainCpp, /\} else if \(次数==2\|\|false\) \{/u);
  assert.match(mainCpp, /switch \(次数\) \{/u);
  assert.match(mainCpp, /case 1: case 2: \{/u);
  assert.match(mainCpp, /default: \{/u);
  assert.match(mainCpp, /while \(true\) \{/u);
  assert.match(mainCpp, /while \(次数<8\) \{/u);
  assert.match(mainCpp, /do \{/u);
  assert.match(mainCpp, /\} while \(false\);/u);
  assert.match(mainCpp, /for \(int __ling_\d+_index = 1/u);
  assert.match(mainCpp, /for \(索引 = 1;/u);
  assert.match(mainCpp, /for \(const auto& __ling_\d+_item : 项目\)/u);
  assert.match(mainCpp, /break;/u);
  assert.match(mainCpp, /continue;/u);
  assert.match(mainCpp, /LingFinallyGuard __ling_\d+_finally/u);
  assert.match(mainCpp, /throw std::runtime_error\(LingCppWideToUtf8\(L"测试异常"\)\);/u);
  assert.match(mainCpp, /catch \(const std::exception& __ling_\d+_exception\)/u);
  assert.equal(mainCpp.match(/switch \(次数\) \{/gu)?.length, 2);
  assert.equal(mainCpp.includes('暂不支持的中文 C++ 语句'), false);

  const body = source.split('\n').slice(10, -2);
  const guide = getBeginnerIfFlowGuideRows(body);
  assert.ok(guide.some(row => row.kind === 'select' && row.mark === '┌'));
  assert.ok(guide.some(row => row.kind === 'case' && row.mark === '├'));
  assert.ok(guide.some(row => row.kind === 'loop' && row.mark === '┌'));
  assert.ok(guide.some(row => row.kind === 'try' && row.mark === '┌'));
  assert.ok(guide.some(row => row.kind === 'catch' && row.mark === '├'));
  assert.ok(guide.some(row => row.kind === 'finally' && row.mark === '├'));
  assert.ok(guide.some(row => row.kind === 'break' && row.mark === '↳'));
  assert.ok(guide.some(row => row.kind === 'continue' && row.mark === '↳'));

  const completions = getLingCppCompletions({ source, line: 8, column: 9 });
  const completionLabels = new Set(completions.map(item => item.label));
  ['如果', '否则如果', '选择', '循环', '判断循环', '循环判断', '计次循环', '变量循环', '枚举循环', '跳出循环', '继续循环', '尝试', '抛出']
    .forEach(label => assert.ok(completionLabels.has(label), `缺少控制流补全：${label}`));

  const formatted = formatLingCpp(source);
  assert.equal(formatLingCpp(formatted), formatted);
  assert.match(formatted, /        选择 \(次数\)\n            分支 \(1, 2\)\n                次数 = 4/u);
  assert.match(formatted, /        尝试\n            抛出\("测试异常"\)\n        捕获/u);
  const foldingRanges = getLingCppFoldingRanges(source);
  const sourceLines = source.split('\n');
  ['选择 (次数)', '计次循环首 (3, 索引)', '尝试'].forEach(startText => {
    const startLine = sourceLines.findIndex(line => line.trim() === startText) + 1;
    assert.ok(foldingRanges.some(range => range.startLine === startLine && range.endLine > startLine), `缺少折叠范围：${startText}`);
  });
});

test('LingCpp control flow diagnostics reject misplaced and incomplete commands', () => {
  const source = `类 错误流程 : 公开 窗体
公开:
    构造()
        跳出循环
        继续循环
        否则如果 (真)
        选择 (1)
            默认
            默认
        选择结束
        尝试
        尝试结束
        判断循环首 ()
    结束
结束类`;
  const messages = parseLingCpp(source).diagnostics.map(diagnostic => diagnostic.message);
  assert.ok(messages.some(message => message.includes('跳出循环 只能在循环内部使用')));
  assert.ok(messages.some(message => message.includes('继续循环 只能在循环内部使用')));
  assert.ok(messages.some(message => message.includes('否则如果 没有对应的如果结构')));
  assert.ok(messages.some(message => message.includes('只能有一个默认分支')));
  assert.ok(messages.some(message => message.includes('至少需要一个捕获或最终分支')));
  assert.ok(messages.some(message => message.includes('判断循环首 缺少条件表达式')));
  assert.ok(messages.some(message => message.includes('判断循环首 结构缺少结束语句')));
});

test('beginner flow formatting indents nested loops below conditions', () => {
  const formatted = formatBeginnerFlowIndentation([
    '如果真 (条件)',
    '计次循环首 (次数, 计次变量)',
    '',
    '计次循环尾 ()',
    '如果真结束'
  ]);

  assert.deepEqual(formatted, [
    '如果真 (条件)',
    '    计次循环首 (次数, 计次变量)',
    '        ',
    '    计次循环尾 ()',
    '如果真结束'
  ]);
});

test('beginner Enter indentation follows the current nested control-flow depth', () => {
  const nestedStart = [
    '如果真 (条件)',
    '    计次循环首 (次数, 计次变量)'
  ].join('\n');
  assert.equal(getBeginnerNextLineIndentation(nestedStart, nestedStart.length), '        ');

  const nestedEnd = `${nestedStart}\n        调试输出(计次变量)\n    计次循环尾 ()`;
  assert.equal(getBeginnerNextLineIndentation(nestedEnd, nestedEnd.length), '    ');

  const outerEnd = `${nestedEnd}\n如果真结束`;
  assert.equal(getBeginnerNextLineIndentation(outerEnd, outerEnd.length), '');
});

test('beginner flow guides keep outer rails while indenting nested rails', () => {
  const guide = getBeginnerIfFlowGuideRows([
    '如果真 (条件)',
    '    计次循环首 (次数, 计次变量)',
    '        调试输出(计次变量)',
    '    计次循环尾 ()',
    '如果真结束'
  ]);

  assert.deepEqual(guide.map(row => row.tracks), [
    [{ depth: 0, mark: '┌' }],
    [{ depth: 0, mark: '│' }, { depth: 1, mark: '┌' }],
    [{ depth: 0, mark: '│' }, { depth: 1, mark: '│' }],
    [{ depth: 0, mark: '│' }, { depth: 1, mark: '└' }],
    [{ depth: 0, mark: '└' }]
  ]);
});

test('beginner flow parser marks 如果真 and 计次循环首 as independently foldable blocks', () => {
  const blocks = parseBeginnerIfBlocks([
    '如果真 (条件)',
    '    计次循环首 (3, 次数)',
    '        调试输出(次数)',
    '    计次循环尾 ()',
    '如果真结束'
  ]);

  assert.deepEqual(blocks.map(block => [block.family, block.startLine, block.endLine]), [
    ['if', 1, 5],
    ['loop', 2, 4]
  ]);
  assert.equal(blocks[1]?.parent, blocks[0]);
});

test('cross-segment flow folds resolve collapsed blocks split by local tables', () => {
  // 模拟第 70 行场景：如果首行所在的代码段被局部声明表隔断，
  // 段内解析只能得到 endLine === startLine 的未闭合块。
  const segmentA = { segmentId: 'code:70', lines: ['如果 (页面目录 == "")'], statementStart: 8 };
  const segmentB = {
    segmentId: 'code:72',
    lines: [
      '    内嵌目录 = 系统_取临时目录()',
      '    如果 (内嵌目录 != "")',
      '        内嵌目录 = 内嵌目录 + "x"',
      '        如果 (目录_是否存在(内嵌目录))',
      '            页面目录 = 内嵌目录',
      '        如果结束',
      '    如果结束',
      '    如果结束'
    ],
    statementStart: 9
  };
  const statements = [
    ...Array.from({ length: 8 }, (_, index) => ({ line: index + 61, text: '调试输出("前置")' })),
    { line: 70, text: '如果 (页面目录 == "")' },
    { line: 72, text: '内嵌目录 = 系统_取临时目录()' },
    { line: 73, text: '如果 (内嵌目录 != "")' },
    { line: 74, text: '内嵌目录 = 内嵌目录 + "x"' },
    { line: 75, text: '如果 (目录_是否存在(内嵌目录))' },
    { line: 76, text: '页面目录 = 内嵌目录' },
    { line: 77, text: '如果结束' },
    { line: 78, text: '如果结束' },
    { line: 79, text: '如果结束' },
    { line: 80, text: '如果 (页面目录 == "")' },
    { line: 81, text: '调试输出("之后")' }
  ];
  const locals = [{ line: 71 }];

  const folds = getBeginnerCrossSegmentFlowFolds(
    [segmentA, segmentB],
    statements,
    locals,
    ['窗体:事件:演示:code:70:if:1'],
    '窗体:事件:演示'
  );

  assert.equal(folds.length, 1);
  assert.equal(folds[0]?.anchorSegmentId, 'code:70');
  assert.equal(folds[0]?.sourceFrom, 70);
  assert.equal(folds[0]?.sourceTo, 79);
  assert.equal(folds[0]?.statementFrom, 9);
  assert.equal(folds[0]?.statementTo, 16);
  // 隐藏 8 条语句 + 1 行局部声明表 = 9 行。
  assert.equal(folds[0]?.hiddenRows, 9);

  // 段内已闭合的块不产出跨段折叠，避免与段内折叠渲染重复处理。
  const balanced = getBeginnerCrossSegmentFlowFolds(
    [segmentB],
    statements,
    locals,
    ['窗体:事件:演示:code:72:if:2'],
    '窗体:事件:演示'
  );
  assert.equal(balanced.length, 0);

  // 未折叠的同名块不产出折叠范围。
  const inactive = getBeginnerCrossSegmentFlowFolds(
    [segmentA, segmentB],
    statements,
    locals,
    [],
    '窗体:事件:演示'
  );
  assert.equal(inactive.length, 0);
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

test('AI 布局请求统一识别“美化界面”并要求完整设计器模型', () => {
  assert.equal(isDesignerEditInstruction('美化界面'), true);
  assert.equal(isDesignerBeautificationInstruction('当前的界面太乱了，帮我美化一下'), true);
  assert.equal(isDesignerEditInstruction('优化错误处理'), false);

  const designerProject: LingWindowProject = {
    id: 'ai-designer-required', name: '布局契约测试', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };

  const missingDesignerProposal = proposeLingCppEdit(
    { filePath: 'src/MainWindow.lcpp', sourceCode: '旧源码', instruction: '美化界面', designerProject },
    { updatedSource: '新源码' }
  );
  assert.notEqual(missingDesignerProposal.designerProject, undefined);
  assert.equal(areDesignerProjectsEquivalent(missingDesignerProposal.designerProject, designerProject), false);

  const sourceOnlyProposal = proposeLingCppEdit(
    { filePath: 'src/MainWindow.lcpp', sourceCode: '旧源码', instruction: '优化错误处理', designerProject },
    { updatedSource: '新源码' }
  );
  assert.equal(sourceOnlyProposal.designerProject, undefined);
});

test('AI 纯行为需求不再被设计器关键词误拒（等价模型与缺模型两种形态）', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const designerProject: LingWindowProject = {
    id: 'click-count', name: '点击计数', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: [{
        id: 'btn-1', type: 'Button', name: '按钮1', content: '点我一下',
        width: 120, height: 36, x: 24, y: 24, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        events: { Click: '_按钮1_被单击' }
      }]
    }]
  };
  // 只引用模型里真实存在的控件：这类需求本就不需要布局变化。
  const behaviorSource = [
    '类 MainWindow',
    '    事件 _按钮1_被单击()',
    '        控件_设置文本(按钮1, "已点击")',
    '    结束',
    '结束类'
  ].join('\n');
  const context = {
    projectId: designerProject.id,
    filePath: 'src/MainWindow.lcpp',
    sourceCode: '旧源码',
    instruction: '给按钮1加上点击计数：加一个整数型变量记录点击次数，每次点击加一，并把窗口标题改成已点击 N 次。',
    designerProject,
    moduleContext
  };

  // AI 原样回传设计器模型：过去在这里抛「模型与当前完全相同」，现在按纯源码提案受理。
  const sameModelProposal = proposeLingCppEdit(context, {
    updatedSource: behaviorSource,
    designerProject: JSON.parse(JSON.stringify(designerProject))
  });
  assert.equal(sameModelProposal.designerProject, undefined);
  assert.equal(sameModelProposal.changes.length, 1);

  // AI 完全没带设计器模型：过去抛「未返回完整设计器模型」，现在同样受理源码改动。
  const noModelProposal = proposeLingCppEdit(context, { updatedSource: behaviorSource });
  assert.equal(noModelProposal.designerProject, undefined);
  assert.equal(noModelProposal.changes.length, 1);
});

test('AI 提案源码引用设计器模型不存在的控件时仍按同一门禁中文阻断', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const designerProject: LingWindowProject = {
    id: 'ghost-control', name: '幽灵控件', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };

  assert.throws(
    () => proposeLingCppEdit(
      {
        projectId: designerProject.id,
        filePath: 'src/MainWindow.lcpp',
        sourceCode: '旧源码',
        instruction: '在窗口里给按钮1加上点击计数',
        designerProject,
        moduleContext
      },
      {
        updatedSource: [
          '类 MainWindow',
          '    事件 _按钮1_被单击()',
          '        控件_设置文本(按钮1, "已点击")',
          '    结束',
          '结束类'
        ].join('\n')
      }
    ),
    /源码引用了窗口设计器模型中不存在的控件/u
  );
});

test('AI 纯布局提案只提交设计器改动，不再往源码注入占位注释', () => {
  const original: LingWindowProject = {
    id: 'layout-only', name: '纯布局提案', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: [{
        id: 'btn-1', type: 'Button', name: '按钮1', content: '点我一下',
        width: 120, height: 36, x: 24, y: 24, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }]
    }]
  };
  const moved: LingWindowProject = {
    ...original,
    windows: [{ ...original.windows[0], controls: [{ ...original.windows[0].controls[0], x: 496, y: 360 }] }]
  };

  const proposal = proposeLingCppEdit(
    {
      projectId: original.id,
      filePath: 'src/MainWindow.lcpp',
      sourceCode: '类 MainWindow\n结束类',
      instruction: '把按钮1移动到窗口右下角',
      designerProject: original
    },
    { files: [], designerProject: moved, summary: '移动按钮1' }
  );

  assert.equal(proposal.changes.length, 0);
  assert.ok(proposal.designerProject);
  assert.equal(proposal.designerUnchanged, undefined);
  assert.equal(JSON.stringify(proposal).includes('AI 编辑建议'), false);
});

test('AI 草稿没有任何真实改动时明确拒绝，不给出可应用的空提案', () => {
  assert.throws(
    () => proposeLingCppEdit(
      {
        filePath: 'src/MainWindow.lcpp',
        sourceCode: '类 MainWindow\n结束类',
        instruction: '把按钮1移动到窗口右下角'
      },
      {
        files: [{ filePath: 'src/MainWindow.lcpp', updatedSource: '类 MainWindow\n结束类' }],
        summary: '移动按钮1'
      }
    ),
    /未产生任何实际改动/u
  );
});

test('AI 为布局需求回传等价设计器模型时按纯源码受理并明示界面未变', () => {
  const original: LingWindowProject = {
    id: 'layout-unchanged', name: '等价模型', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: [{
        id: 'btn-1', type: 'Button', name: '按钮1', content: '点我一下',
        width: 120, height: 36, x: 24, y: 24, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }]
    }]
  };

  const proposal = proposeLingCppEdit(
    {
      projectId: original.id,
      filePath: 'src/MainWindow.lcpp',
      sourceCode: '类 MainWindow\n结束类',
      instruction: '把按钮1移动到窗口右下角',
      designerProject: original
    },
    {
      files: [{ filePath: 'src/MainWindow.lcpp', updatedSource: '类 MainWindow\n    事件 _按钮1_被单击()\n    结束\n结束类' }],
      designerProject: JSON.parse(JSON.stringify(original))
    }
  );

  assert.equal(proposal.designerProject, undefined);
  assert.equal(proposal.designerUnchanged, true);
  assert.equal(proposal.changes.length, 1);
});

test('AI 美化界面原样返回时的本地视觉方案保留布局身份与事件', () => {
  const original: LingWindowProject = {
    id: 'ai-designer-beautification', name: '视觉美化回退', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#1F2937', description: '', controls: [
        {
          id: 'title-label', type: 'Label', name: '标题', content: '原始标题',
          width: 300, height: 36, x: 24, y: 24, fontSize: 16,
          background: 'transparent', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
          events: { Click: '标题_被单击' }
        },
        {
          id: 'save-button', type: 'Button', name: '保存按钮', content: '保存',
          width: 120, height: 36, x: 24, y: 86, fontSize: 12,
          background: '#0369A1', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible',
          events: { Click: '保存按钮_被单击' }, properties: { cornerRadius: 2 }
        }
      ]
    }]
  };

  const beautified = createDesignerBeautificationFallback(original);
  assert.equal(areDesignerProjectsEquivalent(original, beautified), false);
  assert.equal(beautified.id, original.id);
  assert.equal(beautified.windows[0].id, original.windows[0].id);
  assert.equal(beautified.windows[0].controls.length, original.windows[0].controls.length);
  assert.deepEqual(
    beautified.windows[0].controls.map(control => ({ id: control.id, name: control.name, content: control.content, x: control.x, y: control.y, width: control.width, height: control.height, events: control.events })),
    original.windows[0].controls.map(control => ({ id: control.id, name: control.name, content: control.content, x: control.x, y: control.y, width: control.width, height: control.height, events: control.events }))
  );
  assert.equal(beautified.windows[0].background, '#172033');
  assert.equal(beautified.windows[0].controls[0].fontBold, true);
  assert.equal(beautified.windows[0].controls[1].fontBold, true);
  assert.equal(beautified.windows[0].controls[1].properties?.cornerRadius, 8);
});

test('AI 设计器提案保留旧 Upload 控件并允许新增进度条', () => {
  const original: LingWindowProject = {
    schemaVersion: 2,
    id: 'ai-designer-upload-compat',
    name: 'AI 设计器兼容测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '',
      controls: [{
        id: 'upload-1', type: 'Upload', name: '普通上传', content: '选择文件',
        width: 180, height: 36, x: 24, y: 24, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }]
    }]
  };
  const candidate: LingWindowProject = {
    ...original,
    windows: [{
      ...original.windows[0],
      controls: [
        { ...original.windows[0].controls[0], x: 40 },
        {
          id: 'progress-1', type: 'ProgressBar', name: '下载进度', content: '50',
          width: 280, height: 20, x: 40, y: 82, fontSize: 12,
          background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
          properties: { minimum: 0, maximum: 100, value: 50 }
        }
      ]
    }]
  };

  const proposal = proposeLingCppEdit(
    { filePath: 'src/MainWindow.lcpp', sourceCode: '旧源码', instruction: '在窗口中增加进度条', designerProject: original },
    { updatedSource: '新源码', designerProject: candidate, summary: '增加下载进度条' }
  );

  assert.equal(proposal.designerProject?.windows[0].controls[0].type, 'Upload');
  assert.equal(proposal.designerProject?.windows[0].controls[1].type, 'ProgressBar');
  assert.equal(proposal.designerProject?.windows[0].controls[1].properties?.value, 50);
});

test('AI 宽泛美化提案在模型未产生变化时使用本地视觉方案', () => {
  const designerProject: LingWindowProject = {
    id: 'ai-designer-unchanged', name: '未变化模型', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };

  const proposal = proposeLingCppEdit(
    {
      projectId: designerProject.id,
      filePath: 'src/MainWindow.lcpp', sourceCode: '旧源码', instruction: '美化界面', designerProject
    },
    { updatedSource: '新源码', designerProject: JSON.parse(JSON.stringify(designerProject)) }
  );
  assert.notEqual(proposal.designerProject, undefined);
  assert.equal(areDesignerProjectsEquivalent(proposal.designerProject, designerProject), false);
});

test('AI 设计器提案拒绝当前项目与模型 ID 不一致', () => {
  const designerProject: LingWindowProject = {
    id: 'designer-project', name: '错配模型', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };
  const candidate: LingWindowProject = {
    ...designerProject,
    windows: [{ ...designerProject.windows[0], width: 700 }]
  };

  assert.throws(
    () => proposeLingCppEdit(
      {
        projectId: 'current-project',
        filePath: 'src/MainWindow.lcpp', sourceCode: '旧源码', instruction: '调整窗口宽度', designerProject
      },
      { updatedSource: '新源码', designerProject: candidate }
    ),
    /项目与模型不匹配/u
  );
});

test('AI 设计器提案仍拒绝新注入的未知控件类型', () => {
  const original: LingWindowProject = {
    id: 'ai-designer-unknown-type', name: '未知类型校验',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };
  const candidate = {
    ...original,
    windows: [{
      ...original.windows[0],
      controls: [{
        id: 'unknown-1', type: 'UnknownInjectedControl', name: '非法控件', content: '',
        width: 100, height: 30, x: 0, y: 0, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }]
    }]
  } as unknown as LingWindowProject;

  assert.throws(
    () => validateDesignerProjectEdit(original, candidate),
    /不受支持的类型/u
  );
});

test('AI 设计器提案把常见控件类型别名归一化为注册表标识', () => {
  // 复刻「帮我写一个会员登录系统」场景：模型把编辑框写成 Edit 导致提案被整份拒绝。
  const original: LingWindowProject = {
    id: 'ai-designer-alias', name: '别名归一化', windows: [{
      id: 'login-window', fileName: 'LoginWindow.xml', className: 'LoginWindow', title: '登录窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };
  const candidate = {
    ...original,
    windows: [{
      ...original.windows[0],
      controls: [
        {
          id: 'account-input', type: 'Edit', name: '账号输入', content: '',
          width: 160, height: 34, x: 24, y: 24, fontSize: 12,
          background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
        },
        {
          id: 'password-input', type: '编辑框', name: '密码输入', content: '',
          width: 160, height: 34, x: 24, y: 70, fontSize: 12,
          background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
        },
        {
          id: 'login-button', type: 'button', name: '登录按钮', content: '登录',
          width: 120, height: 35, x: 24, y: 116, fontSize: 12,
          background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible'
        }
      ]
    }]
  } as unknown as LingWindowProject;

  const proposal = proposeLingCppEdit(
    {
      filePath: 'src/LoginWindow.lcpp', sourceCode: '旧源码',
      instruction: '帮我写一个会员登录系统，要有登录窗口和会员窗口', designerProject: original
    },
    { updatedSource: '新源码', designerProject: candidate }
  );

  assert.deepEqual(
    proposal.designerProject?.windows[0].controls.map(control => control.type),
    ['TextBox', 'TextBox', 'Button']
  );
  // 提案携带生成时的允许类型快照，apply 侧复用同一集合校验。
  assert.ok(proposal.designerAllowedControlTypes?.includes('TextBox'));
});

test('控件类型归一化不触碰允许集合内与无法识别的类型', () => {
  const allowed = new Set(['TextBox', 'Button', 'FBroBrowser']);
  const project = {
    windows: [{
      controls: [
        { name: '甲', type: 'textbox' },
        { name: '乙', type: 'FBroBrowser' },
        { name: '丙', type: 'UnknownInjectedControl' }
      ]
    }]
  } as unknown as LingWindowProject;

  assert.equal(normalizeDesignerControlTypes(project, allowed), 1);
  const controls = (project.windows[0] as unknown as { controls: Array<{ name: string; type: string }> }).controls;
  assert.equal(controls[0].type, 'TextBox');
  assert.equal(controls[1].type, 'FBroBrowser');
  assert.equal(controls[2].type, 'UnknownInjectedControl');
});

const gaugeModuleFixture: InstalledModule = {
  isInstalled: true,
  isEnabledForProject: true,
  installPath: 'C:/modules/test.mod',
  diagnostics: [],
  manifest: {
    schemaVersion: 2,
    id: 'test.mod',
    name: '测试模块',
    version: '1.0.0',
    contributes: {
      designerControls: [{ type: 'TestGauge', label: '仪表盘', defaultProps: {} }]
    }
  }
} as unknown as InstalledModule;

test('合法控件类型清单描述包含规范标识、中文标签与模块贡献类型', () => {
  const description = describeAllowedDesignerControlTypes();
  assert.match(description, /TextBox（编辑框）/u);
  assert.match(description, /Button（按钮）/u);
  assert.match(description, /FileDialog（文件对话框）/u);

  const moduleContext = { availableModules: [gaugeModuleFixture], enabledModules: [gaugeModuleFixture] };
  assert.match(
    describeAllowedDesignerControlTypes({ moduleContext }),
    /TestGauge（测试模块 仪表盘）/u
  );

  const allowed = getAllowedDesignerControlTypes({ moduleContext });
  assert.equal(allowed.has('TestGauge'), true);
  assert.equal(allowed.has('TextBox'), true);
});

test('应用侧复用提案允许类型集合时模块贡献控件不被误拒', () => {
  const moduleContext = { availableModules: [gaugeModuleFixture], enabledModules: [gaugeModuleFixture] };
  const allowedTypes = getAllowedDesignerControlTypes({ moduleContext });
  const original: LingWindowProject = {
    id: 'apply-module-types', name: '应用侧类型集合', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 420, background: '#ffffff', description: '', controls: []
    }]
  };
  const candidate = {
    ...original,
    windows: [{
      ...original.windows[0],
      controls: [{
        id: 'gauge-1', type: 'TestGauge', name: '仪表盘', content: '',
        width: 120, height: 30, x: 0, y: 0, fontSize: 12,
        background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible'
      }]
    }]
  } as unknown as LingWindowProject;

  // 默认集合拒绝模块贡献控件（apply 侧旧缺陷的复现）。
  assert.throws(
    () => validateDesignerProjectEdit(original, candidate),
    /不受支持的类型/u
  );
  // 提案快照集合通过（apply 侧修复后的行为）。
  const validated = validateDesignerProjectEdit(original, candidate, { allowedControlTypes: allowedTypes });
  assert.equal(validated.windows[0].controls[0].type, 'TestGauge');
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

test('generateLingCppNativeWin32Project emits project constants before mutable globals with source maps', () => {
  const globalsPath = 'src/项目全局变量.lcpp';
  const sourcePath = 'src/MainWindow.lcpp';
  const globals = [
    '常量 整数型 最大次数 = 3',
    '常量 文本型 产品名称 = "LingBuilder"',
    '常量 逻辑型 启用日志 = 真',
    '常量 双精度小数型 精度 = 0.01',
    '全局 整数型 当前次数 = 最大次数'
  ].join('\n');
  const source = '类 MainWindow : 公开 窗体\n    事件 创建完毕()\n        调试输出(产品名称)\n    结束\n结束类';
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: source,
    lingCppSourceFilePath: sourcePath,
    lingCppSources: [
      { filePath: globalsPath, sourceCode: globals },
      { filePath: sourcePath, sourceCode: source }
    ]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /inline constexpr int 最大次数 = 3;/u);
  assert.match(cpp, /inline const std::wstring 产品名称 = L"LingBuilder";/u);
  assert.match(cpp, /inline constexpr bool 启用日志 = true;/u);
  assert.match(cpp, /inline constexpr double 精度 = 0\.01;/u);
  assert.ok(cpp.indexOf('inline constexpr int 最大次数') < cpp.indexOf('int 当前次数'));
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'constant' && entry.symbolName === '产品名称' && entry.sourceFile === globalsPath));
});

test('数组下标和数组命令参与类型推断，并对非数组实参给出中文诊断', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.std.array'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  const moduleContext = { enabledModules: modules, availableModules: modules };
  const validSource = [
    '类 MainWindow : 公开 窗体',
    '    事件 创建完毕()',
    '        局部 文本型 名单[]',
    '        局部 文本型 首位',
    '        局部 整数型 人数',
    '        数组_加入成员(名单, "张三")',
    '        首位 = 名单[0]',
    '        首位 = 数组_取成员(名单, 0)',
    '        人数 = 数组_取成员数(名单)',
    '        数组_排序(名单, 真)',
    '    结束',
    '结束类'
  ].join('\n');
  const validDiagnostics = getLingCppSemanticDiagnostics(validSource, undefined, undefined, moduleContext);
  assert.deepEqual(validDiagnostics.filter(diagnostic => diagnostic.level === 'error'), []);

  // 数组成员型返回值必须回到实参上求解，不能退化成固定标签。
  const wrongMemberTarget = getLingCppSemanticDiagnostics(
    validSource.replace('首位 = 数组_取成员(名单, 0)', '人数 = 数组_取成员(名单, 0)'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(wrongMemberTarget.some(diagnostic => (
    diagnostic.id.includes('assignment-type') && diagnostic.message.includes('文本型') && diagnostic.message.includes('整数型')
  )));

  // 下标结果是元素类型，不是数组本身。
  const wrongIndexTarget = getLingCppSemanticDiagnostics(
    validSource.replace('首位 = 名单[0]', '人数 = 名单[0]'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(wrongIndexTarget.some(diagnostic => diagnostic.id.includes('assignment-type') && diagnostic.message.includes('文本型')));

  const scalarArgument = getLingCppSemanticDiagnostics(
    validSource.replace('数组_加入成员(名单, "张三")', '数组_加入成员(首位, "张三")'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(scalarArgument.some(diagnostic => diagnostic.message.includes('不是数组')));

  const elementTypeMismatch = getLingCppSemanticDiagnostics(
    validSource.replace('数组_加入成员(名单, "张三")', '数组_加入成员(名单, 42)'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(elementTypeMismatch.some(diagnostic => diagnostic.message.includes('成员类型是 文本型')));

  const expressionArgument = getLingCppSemanticDiagnostics(
    validSource.replace('数组_加入成员(名单, "张三")', '数组_加入成员(名单[0], "张三")'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(expressionArgument.some(diagnostic => diagnostic.message.includes('必须是数组变量本身')));

  const wrongArity = getLingCppSemanticDiagnostics(
    validSource.replace('数组_加入成员(名单, "张三")', '数组_加入成员(名单)'),
    undefined,
    undefined,
    moduleContext
  );
  assert.ok(wrongArity.some(diagnostic => diagnostic.message.includes('需要 2 个参数')));

  // 未启用数组模块时不产生数组命令诊断，避免对旧项目造成噪音。
  assert.deepEqual(
    getLingCppSemanticDiagnostics(validSource.replace('数组_加入成员(名单, "张三")', '数组_加入成员(首位, "张三")'))
      .filter(diagnostic => diagnostic.message.includes('不是数组')),
    []
  );
});

// ── 多行文本块（三引号）语法 ──────────────────────────────────────────────

const TEXT_BLOCK_SOURCE = `包 文本块演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    文本型 关联设计文件 = "MainWindow.xml"

    空 准备主页HTML()
        局部 文本型 主页HTML
        主页HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head><title>结束 如果 测试</title></head>
<body>
<p>信息框("误伤")</p>
</body>
</html>
"""
        调试输出("完成")
结束类`;

test('parseLingCpp converges triple-quoted text blocks into one opaque statement', () => {
  const parsed = parseLingCpp(TEXT_BLOCK_SOURCE);
  assert.deepEqual(parsed.diagnostics.filter(item => item.level === 'error').map(item => item.message), []);
  const method = parsed.program.classes[0]?.methods.find(item => item.name === '准备主页HTML');
  const blocks = (method?.statements || []).filter(statement => statement.text.startsWith('主页HTML = """'));
  assert.equal(blocks.length, 1);
  const block = blocks[0];
  assert.ok(block);
  assert.equal(block?.endLine, (block?.line ?? 0) + 8); // 7 行内容 + 结束标记
  // 块内的 结束/如果/信息框 行不得提前关闭子程序：后续调试输出仍是同一方法的语句
  assert.ok(method?.statements.some(statement => statement.text === '调试输出("完成")'));
  assert.equal(method?.statements.some(statement => statement.text === '结束'), false);
  assert.equal(method?.locals?.map(local => local.name).join(','), '主页HTML');
});

test('text block misuse produces Chinese diagnostics', () => {
  const unclosed = parseLingCpp(`包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        文本 = """
        内容
结束类`);
  assert.ok(unclosed.diagnostics.some(item => item.message.includes('多行文本块缺少结束标记')));

  const stray = parseLingCpp(`包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        调试输出("x")
"""
结束类`);
  assert.ok(stray.diagnostics.some(item => item.message.includes('多余的文本块结束标记')));

  const afterClose = parseLingCpp(`包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        文本 = """
内容
""" 多余
结束类`);
  assert.ok(afterClose.diagnostics.some(item => item.message.includes('结束标记后不得再有内容')));

  const typedInit = parseLingCpp(`包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        局部 文本型 初值 = """
        返回
结束类`);
  assert.ok(typedInit.diagnostics.some(item => item.message.includes('不能作为「初值」的声明初值')));
});

test('generateLingCppNativeWin32Project emits text block as one escaped wide literal', () => {
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    activeWindowId: 'window-1',
    lingCppSourceCode: TEXT_BLOCK_SOURCE
  });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('主页HTML = L"<!DOCTYPE html>\\n<html lang=\\"zh-CN\\">'), '块生成必须折叠为单行宽字面量');
  assert.ok(mainCpp.includes('\\n</html>";'), '结束标记前不得遗漏最后一行内容');
  // 块内 信息框( 不得被翻译成功能库/内置命令调用
  assert.equal(mainCpp.includes('信息框(L"误伤"'), false);
  assert.equal(mainCpp.includes('// 暂不支持的中文 C++ 语句：主页HTML'), false);
  assert.ok(mainCpp.includes('调试输出(L"完成");'));
});

test('beginner flow indentation and fold parsing keep text block lines opaque', () => {
  const lines = [
    '主页HTML = """',
    '结束',
    '如果 (x)',
    '"""',
    '调试输出("完成")'
  ];
  const formatted = formatBeginnerFlowIndentation(lines);
  assert.deepEqual(formatted.slice(1, 4), ['结束', '如果 (x)', '"""']);
  assert.equal(formatted[4], '调试输出("完成")');
  assert.equal(parseBeginnerIfBlocks(lines).length, 0);
  assert.equal(getBeginnerIfFlowGuideRows(lines).some(row => row.kind === 'end' || row.kind === 'if'), false);
});

test('beginner line comment toggle and completion stay out of text blocks', () => {
  const value = '甲 = 1\n乙 = """\n结束\n"""\n丙 = 2';
  const result = toggleBeginnerLineComment(value, 0, value.length);
  assert.equal(result.value, '// 甲 = 1\n乙 = """\n结束\n"""\n// 丙 = 2');

  const inside = '乙 = """\n信息框(';
  const context = getBeginnerCompletionContext(inside, inside.length);
  assert.equal(context.isInsideString, true);
  assert.equal(shouldShowBeginnerCompletion(context, true), false);
});

test('backend contract and function library scans ignore text block content', () => {
  const parsed = parseLingCpp(TEXT_BLOCK_SOURCE);
  assert.deepEqual(collectLingCppCommandCalls(parsed.program, ['信息框']), []);

  const librarySource = TEXT_BLOCK_SOURCE.replace('        调试输出("完成")', '        工具库.取时间()');
  const withBlock = `包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        文本 = """
工具库.取时间()
"""
结束类`;
  const files = [{ filePath: 'block.lcpp', sourceCode: withBlock, language: 'lingcpp' as const }];
  assert.equal(findFunctionLibraryReferences(files, '工具库').length, 0);
  assert.ok(librarySource.includes('工具库.取时间()'));
});

test('update-method-body rewrite keeps text block content byte-identical', () => {
  const bodyLines = ['主页HTML = """', '<!DOCTYPE html>', '<p>结束 如果</p>', '"""', '调试输出("完成")'];
  const result = applyLingCppAstEdit(TEXT_BLOCK_SOURCE, {
    kind: 'update-method-body',
    className: '游戏主窗体',
    methodName: '准备主页HTML',
    bodyLines
  });
  assert.equal(result.success, true);
  assert.ok(result.sourceCode.includes('<!DOCTYPE html>\n<p>结束 如果</p>\n"""'));
  const reparsed = parseLingCpp(result.sourceCode);
  assert.deepEqual(reparsed.diagnostics.filter(item => item.level === 'error').map(item => item.message), []);
});

test('global rename does not rewrite text block content', () => {
  const source = `包 演示
使用 Win32窗口

全局 文本型 计数

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        文本 = """
计数 计数
"""
        计数 = "更新"
结束类`;
  const context = createProjectGlobalContext('globals.lcpp', source);
  const [renamed] = renameProjectGlobalAcrossSources([{ filePath: 'globals.lcpp', sourceCode: source }], context, '计数', '总数');
  assert.ok(renamed.sourceCode.includes('\n计数 计数\n'), '块内容必须原样保留');
  assert.ok(renamed.sourceCode.includes('总数 = "更新"'));
});

test('formatLingCpp keeps text block lines raw including blank lines', () => {
  const source = `包 演示
使用 Win32窗口

类 游戏主窗体 : 公开 窗体
公开:
    空 方法甲()
        文本 = """


内容  
"""
结束类`;
  const formatted = formatLingCpp(source);
  assert.ok(formatted.includes('\n\n\n内容  \n"""'), '块内空行与行尾空格必须原样保留');
});

test('text block lexical helpers match parser and generator contract', () => {
  const lines = TEXT_BLOCK_SOURCE.split('\n');
  const scan = scanLingCppTextBlockRanges(lines);
  assert.equal(scan.ranges.length, 1);
  assert.equal(scan.unclosedOpenLine, undefined);
  assert.deepEqual(scan.strayCloseLines, []);
  const consumed = collectLingCppTextBlockLines(scan, lines.length);
  const opaque = collectLingCppTextBlockOpaqueLines(scan, lines.length);
  assert.equal(consumed.size, opaque.size + 1); // 开始行可参与缩进，不透明行少一行

  const block = parseLingCppTextBlockStatement('甲 = """\n<!DOCTYPE html>\n<p>x</p>\n"""');
  assert.equal(block?.target, '甲');
  assert.equal(block?.content, '<!DOCTYPE html>\n<p>x</p>');
  assert.equal(parseLingCppTextBlockStatement('甲 = """\n内容'), undefined);
  assert.equal(parseLingCppTextBlockStatement('甲 = """\n内容\n""" 多余'), undefined);
});

test('Monarch tokenizer defines a text block state for triple quotes', () => {
  const monarch = createLingCppMonarchLanguage();
  assert.ok(Array.isArray(monarch.tokenizer.textBlock));
  assert.ok(monarch.tokenizer.root.some(rule => Array.isArray(rule) && String(rule[0]).includes('"""')));
});

test('LingCpp dynamic-library output exports 公开 methods via DllMain entry and singleton forwarders', () => {
  const source = [
    '类 游戏主窗体 : 窗口',
    '公开',
    '  事件 _游戏主窗体_创建完毕()',
    '    局部 整数型 自测 = 0',
    '    自测 = 加法计算(1, 2)',
    '  结束',
    '  整数型 加法计算(整数型 被加数, 整数型 加数)',
    '    局部 整数型 合计 = 0',
    '    合计 = 被加数 + 加数',
    '    返回 合计',
    '  结束',
    '  文本型 问候生成(文本型 姓名)',
    '    返回 姓名',
    '  结束',
    '私有',
    '  整数型 内部翻倍(整数型 输入值)',
    '    返回 输入值 * 2',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, outputKind: 'dynamic-library' });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(!cpp.includes('int WINAPI wWinMain'), '动态库模式不应生成 wWinMain 入口');
  assert.match(cpp, /BOOL WINAPI DllMain\(HINSTANCE instance, DWORD reason, LPVOID reserved\)/u);
  assert.match(cpp, /LingBuilder_EnsureRuntimeInitialized\(\)/u);
  assert.match(cpp, /extern "C" __declspec\(dllexport\) int 加法计算\(int 被加数, int 加数\)/u);
  // 文本参数必须以 const& 跨界、文本返回经 thread_local 缓冲以 const wchar_t* 交出（按值跨界会跨 CRT 堆损坏）。
  assert.match(cpp, /extern "C" __declspec\(dllexport\) const wchar_t\* 问候生成\(const wchar_t\* 姓名\)/u);
  assert.match(cpp, /LingBuilder_Dll文本返回缓冲 = LingBuilder_应用单例_游戏主窗体\(\)\.问候生成\(姓名\);/u);
  assert.match(cpp, /LingBuilder_应用单例_游戏主窗体\(\)\.加法计算\(被加数, 加数\)/u);
  assert.ok(!cpp.includes('dllexport) 整数型 内部翻倍'), '私有子程序不应出现在导出包装中');
});

test('LingCpp dynamic-library output blocks non-POD export signatures', () => {
  const source = [
    '类 游戏主窗体 : 窗口',
    '公开',
    '  整数型 异常计算(按钮 目标按钮)',
    '    返回 0',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, outputKind: 'dynamic-library' });
  assert.ok(generated.blockingDiagnostics.some(message => message.includes('不能跨 DLL 边界的类型')), generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(!cpp.includes('__declspec(dllexport)'), '存在阻断诊断时不应生成导出包装');
});

test('LingCpp application output keeps wWinMain and generates no export wrappers', () => {
  const source = [
    '类 游戏主窗体 : 窗口',
    '公开',
    '  整数型 加法计算(整数型 被加数, 整数型 加数)',
    '    局部 整数型 合计 = 0',
    '    合计 = 被加数 + 加数',
    '    返回 合计',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /int WINAPI wWinMain\(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand\)/u);
  assert.ok(!cpp.includes('__declspec(dllexport)'), 'EXE 模式不应生成导出包装');
});

test('External project properties accept outputType and resolve dll file names', () => {
  assert.deepEqual(resolveExecutableNameParts('MathLib', 'dll'), { baseName: 'MathLib', fileName: 'MathLib.dll' });
  assert.deepEqual(resolveExecutableNameParts('MathLib.dll'), { baseName: 'MathLib', fileName: 'MathLib.exe' });
  assert.deepEqual(resolveExecutableNameParts(undefined, 'dll'), { baseName: 'LingBuilderPreview', fileName: 'LingBuilderPreview.dll' });
  const properties: ExternalProjectProperties = {
    configuration: 'Debug', architecture: 'Win32', additionalArguments: [], outputType: 'dll'
  };
  validateProperties(properties);
  assert.throws(() => validateProperties({ ...properties, outputType: 'lib' as never }), /输出类型/u);
});

test('LingCpp parses project DLL command declarations and guards boundary types', () => {
  const source = [
    '包 项目DLL命令',
    '',
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '',
    '  整数型 加法计算(整数型 被加数, 整数型 加数)',
    '  文本型 问候生成(文本型 姓名) stdcall',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  assert.equal(parsed.program.diagnostics.filter(item => item.level === 'error').length, 0, parsed.program.diagnostics.map(item => item.message).join('\n'));
  const library = parsed.program.dllLibraries[0];
  assert.equal(library?.name, 'AdvancedMathDll');
  assert.deepEqual(library?.archFiles.map(file => [file.arch, file.relativePath]), [['Win32', 'dll/Win32/AdvancedMathDll.dll'], ['x64', 'dll/x64/AdvancedMathDll.dll']]);
  assert.equal(library?.commands[0]?.name, '加法计算');
  assert.equal(library?.commands[0]?.returnType, '整数型');
  assert.equal(library?.commands[1]?.callingConvention, 'stdcall');
  const diagnostics = getProjectDllCommandsDiagnostics(source, 'src/项目DLL命令.lcpp');
  assert.equal(diagnostics.filter(item => item.level === 'error').length, 0, diagnostics.map(item => item.message).join('\n'));
});

test('LingCpp project DLL declarations reject boundary-unsafe types and paths', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "C:/绝对路径/AdvancedMathDll.dll"',
    '  整数型 异常计算(按钮 目标按钮)',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  const messages = parsed.program.diagnostics.map(item => item.message).join('\n');
  assert.match(messages, /DLL 路径必须是项目内相对的 \.dll 文件/u);
  const serviceMessages = getProjectDllCommandsDiagnostics(source, 'src/项目DLL命令.lcpp').map(item => item.message).join('\n');
  assert.match(serviceMessages, /不能跨 DLL 边界/u);
});

test('Project DLL declarations support aliases, system DLLs, byRef parameters and remarks', () => {
  const source = [
    'DLL命令库 user32',
    '  系统 = 真',
    '  整数型 查找子窗口(整数型 父窗口句柄, 文本型 类名, 文本型 标题) = FindWindowExA',
    '  备注: 查找子窗口，返回窗口句柄。',
    '  整数型 取前台窗口句柄() = GetForegroundWindow',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  assert.equal(parsed.program.diagnostics.filter(item => item.level === 'error').length, 0, parsed.program.diagnostics.map(item => item.message).join('\n'));
  const library = parsed.program.dllLibraries[0];
  assert.equal(library?.isSystem, true);
  const command = library?.commands[0];
  assert.equal(command?.name, '查找子窗口');
  assert.equal(command?.exportName, 'FindWindowExA');
  assert.equal(command?.remark, '查找子窗口，返回窗口句柄。');
  // 系统 DLL 链接系统导入库，不需要架构文件映射，不应误报缺架构诊断。
  const systemDiagnostics = getProjectDllCommandsDiagnostics(source, 'src/项目DLL命令.lcpp');
  assert.equal(systemDiagnostics.filter(item => item.level === 'error').length, 0, systemDiagnostics.map(item => item.message).join('\n'));
  const module = createProjectDllDeclarationModule(parsed.program.dllLibraries, 'some-project');
  assert.ok(module);
  assert.equal(module.manifest.bindings?.commands?.[0]?.runtimeName, 'FindWindowExA');
  assert.equal(module.manifest.contributes?.commands?.[0]?.name, '查找子窗口');
  assert.equal(module.manifest.contributes?.commands?.[0]?.description, '查找子窗口，返回窗口句柄。');
  // 无备注命令的补全描述回退为「调用 DLL 导出函数」并携带实际导出名。
  assert.match(module.manifest.contributes?.commands?.[1]?.description || '', /GetForegroundWindow/);
});

test('Project DLL declarations round-trip byRef parameters through serialization', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  整数型 加法计算(整数型 被加数, 整数型 加数)',
    '  空 填充值(整数型 输出值 传址)',
    '结束DLL命令库'
  ].join('\n');
  const context = createProjectDllCommandContext('src/项目DLL命令.lcpp', source);
  const serialized = serializeProjectDllCommandLibraries('项目DLL命令', context.dllLibraries);
  const reparsed = parseLingCpp(serialized);
  assert.equal(reparsed.program.diagnostics.filter(item => item.level === 'error').length, 0, reparsed.program.diagnostics.map(item => item.message).join('\n'));
  const parameters = reparsed.program.dllLibraries[0]?.commands[1]?.parameters || [];
  assert.equal(parameters.length, 1);
  assert.equal(parameters[0].byRef, true);
  assert.equal(parameters[0].type, '整数型');
});

test('单精度小数型登记为基础类型、float 别名指向单精度、项目 DLL 边界放行 float', () => {
  // 语言层：单精度小数型是合法基础类型，不再报未知类型。
  assert.ok(LING_CPP_TYPES.includes('单精度小数型'));
  const classSource = [
    '类 MainWindow : 公开 窗体',
    '    单精度小数型 成员比例 = 1.5',
    '    事件 创建完毕()',
    '        局部 单精度小数型 局部值 = 2.5',
    '        调试输出(局部值 + 成员比例)',
    '    结束',
    '结束类'
  ].join('\n');
  const classDiagnostics = getLingCppSemanticDiagnostics(classSource, undefined, 'src/MainWindow.lcpp');
  assert.equal(classDiagnostics.filter(item => item.level === 'error').length, 0, classDiagnostics.map(item => item.message).join('\n'));

  // 项目 DLL 命令声明：参数、返回值、传址、结构体字段都放行单精度。
  const dllSource = [
    'DLL命令库 FloatMathDll',
    '  Win32 = "dll/Win32/FloatMathDll.dll"',
    '  x64 = "dll/x64/FloatMathDll.dll"',
    '  单精度小数型 取比例(单精度小数型 输入值, 单精度小数型 输出值 传址)',
    '  单精度小数型 半值(单精度小数型 输入值) = HalfF',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(dllSource);
  assert.equal(parsed.program.diagnostics.filter(item => item.level === 'error').length, 0, parsed.program.diagnostics.map(item => item.message).join('\n'));
  const command = parsed.program.dllLibraries[0]?.commands[0];
  assert.equal(command?.returnType, '单精度小数型');
  assert.equal(command?.parameters[0]?.type, '单精度小数型');
  assert.equal(command?.parameters[1]?.byRef, true);
  const dllDiagnostics = getProjectDllCommandsDiagnostics(dllSource, 'src/项目DLL命令.lcpp');
  assert.equal(dllDiagnostics.filter(item => item.level === 'error').length, 0, dllDiagnostics.map(item => item.message).join('\n'));
  assert.equal(resolveDllBoundaryType('单精度小数型')?.abi, 'float');
  assert.equal(resolveDllBoundaryType('单精度小数型')?.cpp, 'float');
  assert.equal(resolveDllBoundaryPointerType('单精度小数型'), 'float*');
  assert.equal(DLL_STRUCT_FIELD_TYPE_MAP['单精度小数型'], 'float');
  // 合成虚拟模块走同一 ABI 契约：binding 类型为 float，清单校验接受。
  const virtualModule = createProjectDllDeclarationModule(parsed.program.dllLibraries || [], 'some-project');
  assert.ok(virtualModule);
  assert.equal(virtualModule.manifest.bindings?.commands?.[0]?.returnType, 'float');
  assert.equal(virtualModule.manifest.bindings?.commands?.[0]?.parameters?.[0]?.type, 'float');

  // 头文件声明与调用点一致：无别名声明中文名；带别名声明真实导出名 HalfF（否则英文别名命令 C3861）。
  const header = generateProjectDllDeclarationHeader(parsed.program.dllLibraries || []);
  assert.match(header, /__declspec\(dllimport\) float __cdecl 取比例\(float 输入值, float\* 输出值\);/u);
  assert.match(header, /__declspec\(dllimport\) float __cdecl HalfF\(float 输入值\);/u);
  assert.doesNotMatch(header, /__declspec\(dllimport\) float __cdecl 半值\(/u);
  // def 物化一律输出真实导出名；「中文名 = 导出名」重命名符号会让别名命令 LNK2019。
  const defLines = buildProjectDllDefLines('MathF', 'mathf.dll', ['HalfF'], [{ commandName: '半值', exportName: 'HalfF' }]);
  assert.deepEqual(defLines, ['LIBRARY mathf', 'EXPORTS', '    HalfF']);

  // 新手补全：float 别名改指单精度小数型，double 保持双精度，小数型不再是 float。
  const catalog = buildBeginnerTypeCompletionCatalog(LING_CPP_TYPES);
  assert.equal(resolveBeginnerTypeAlias(catalog, 'float'), '单精度小数型');
  assert.equal(resolveBeginnerTypeAlias(catalog, 'double'), '双精度小数型');
  assert.equal(resolveBeginnerTypeAlias(catalog, '小数型'), '小数型');
});

test('Project DLL command declarations parse parameter notes and public markers', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  整数型 加法计算(整数型 被加数 // 第一个加数, 整数型 加数 // 第二个加数)',
    '  备注: 调用 DLL 计算两个整数之和。',
    '  空 内部填充(整数型 输出值 传址 // 回填计算结果)',
    '  公开 = 假',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  assert.equal(parsed.program.diagnostics.filter(item => item.level === 'error').length, 0, parsed.program.diagnostics.map(item => item.message).join('\n'));
  const commands = parsed.program.dllLibraries[0]?.commands || [];
  assert.equal(commands.length, 2);
  assert.equal(commands[0].remark, '调用 DLL 计算两个整数之和。');
  assert.equal(commands[0].parameters[0].note, '第一个加数');
  assert.equal(commands[0].parameters[1].note, '第二个加数');
  assert.equal(commands[0].isPublic, undefined);
  assert.equal(commands[1].parameters[0].byRef, true);
  assert.equal(commands[1].parameters[0].note, '回填计算结果');
  assert.equal(commands[1].isPublic, false);
  const diagnostics = getProjectDllCommandsDiagnostics(source, 'src/项目DLL命令.lcpp');
  assert.equal(diagnostics.filter(item => item.level === 'error').length, 0, diagnostics.map(item => item.message).join('\n'));
});

test('项目 DLL 命令声明编辑器的库文件名逐行独立，不随同库其它命令联动', () => {
  const editorPath = resolve(process.cwd(), 'src/components/ProjectDllCommandsEditor.tsx');
  const editorSource = readFileSync(editorPath, 'utf8');
  // 草稿必须按「行」区分：按「库」区分时同库多条命令共用一个键，改一行的库文件名会让整库的行一起显示该名字。
  assert.match(editorSource, /const draftKey = `\$\{libraryIndex\}::\$\{commandIndex\}::\$\{command\.name\}`/u);
  assert.doesNotMatch(editorSource, /const draftKey = `\$\{libraryIndex\}::\$\{library\.name\}`/u);
  // 提交后统一清空草稿：移动命令会让行下标位移，残留草稿会落到别的命令上。
  assert.match(editorSource, /setLibraryDrafts\(\{\}\);/u);
  // 新建库的架构占位路径按库名生成，不再一律写「示例.dll」。
  assert.match(editorSource, /archFiles: archFilesForLibrary\(trimmed\)/u);
  assert.match(editorSource, /function archFilesForLibrary\(name: string\)/u);
  // 顶部库名必须说明它作用于整个库（本库全部命令的库文件名一起更新）。
  assert.match(editorSource, /改名后本库全部命令下方的「库文件名」一起更新/u);
});

test('项目 DLL 命令声明编辑器的右键菜单动作带上下文执行', () => {
  const editorSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'ProjectDllCommandsEditor.tsx'), 'utf8');
  // 三个视图命令以 when: 'workspace.open' 注册；菜单解析与执行必须用同一份上下文，
  // 否则菜单显示可用、点击却按「当前上下文中不可用」抛错（历史缺陷：右键三项点了没反应）。
  assert.match(editorSource, /const DLL_COMMANDS_EDITOR_MENU_CONTEXT: CommandContext = \{ 'workspace\.open': true \};/u);
  assert.match(editorSource, /executeCommand\(item\.command\.id, DLL_COMMANDS_EDITOR_MENU_CONTEXT\)/u);
  assert.doesNotMatch(editorSource, /executeCommand\(item\.command\.id\)/u);
  assert.match(editorSource, /resolveMenu\(\s*LINGCPP_DLL_COMMANDS_CONTEXT_MENU,\s*DLL_COMMANDS_EDITOR_MENU_CONTEXT,/u);
  // 命令执行失败必须回显到编辑器提示区，不能再被 void 静默吞掉。
  assert.match(editorSource, /\.catch\(error => setFeedback\(/u);
});

test('项目 DLL 命令声明序列化保留别名与调用约定顺序', () => {
  const source = [
    '包 项目DLL命令',
    'DLL命令库 user32',
    '  系统 = 真',
    '  整数型 提示音(整数型 类型) = MessageBeep',
    '  整数型 取系统度量(整数型 索引) = GetSystemMetrics',
    '  整数型 IsDebuggerPresent()',
    '结束DLL命令库',
    'DLL命令库 AdvancedMathDll',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '  整数型 加法(整数型 甲) = real_add stdcall',
    '结束DLL命令库',
    ''
  ].join('\n');
  const once = serializeProjectDllCommandLibraries('项目DLL命令', parseLingCpp(source).program.dllLibraries);
  // 历史缺陷：序列化漏写 `= 导出名`，结构化编辑器任意一次编辑都会静默删除别名，
  // 让「系统 = 真」的中文命令退化成找不到标识符（C3861）。
  assert.match(once, /整数型 提示音\(整数型 类型\) = MessageBeep/u);
  assert.match(once, /整数型 取系统度量\(整数型 索引\) = GetSystemMetrics/u);
  assert.match(once, /整数型 IsDebuggerPresent\(\)/u);
  // 别名必须写在调用约定之前，否则解析器认不出（语法：命令名(参数) = 导出名 [cdecl|stdcall]）。
  assert.match(once, /整数型 加法\(整数型 甲\) = real_add stdcall/u);
  assert.equal(serializeProjectDllCommandLibraries('项目DLL命令', parseLingCpp(once).program.dllLibraries), once, '序列化必须幂等');
});

test('系统 DLL 的中文命令缺少真实导出名时给出阻断诊断', () => {
  const broken = [
    '包 项目DLL命令',
    'DLL命令库 user32',
    '  系统 = 真',
    '  整数型 提示音(整数型 类型)',
    '  整数型 IsDebuggerPresent()',
    '结束DLL命令库',
    ''
  ].join('\n');
  const diagnostics = getProjectDllCommandsDiagnostics(broken, 'src/项目DLL命令.lcpp');
  assert.ok(
    diagnostics.some(item => item.level === 'error' && item.message.includes('系统 DLL 命令「提示音」缺少真实导出名')),
    '中文系统 DLL 命令缺别名必须报错：' + diagnostics.map(item => item.message).join(' / ')
  );
  assert.ok(
    !diagnostics.some(item => item.message.includes('IsDebuggerPresent')),
    '纯 ASCII 命令名按 Windows SDK 既有声明使用，不应报错'
  );

  const fixed = broken.replace('整数型 提示音(整数型 类型)', '整数型 提示音(整数型 类型) = MessageBeep');
  assert.deepEqual(
    getProjectDllCommandsDiagnostics(fixed, 'src/项目DLL命令.lcpp').filter(item => item.level === 'error'),
    []
  );

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'system-alias-test',
    name: '系统 DLL 别名测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '系统 DLL 别名测试',
      width: 480, height: 240, background: '#202028', description: '测试窗口', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSources: [
      { filePath: 'src/项目DLL命令.lcpp', sourceCode: broken },
      {
        filePath: 'src/MainWindow.lcpp',
        sourceCode: ['类 MainWindow : 窗口', '公开', '  事件 _MainWindow_创建完毕()', '    调试输出(提示音(48))', '  结束', '结束类', ''].join('\n')
      }
    ],
    enabledModules: [{
      manifest: BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic')!,
      installPath: 'builtin://lingbuilder.win32.basic',
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }]
  });
  assert.ok(
    generated.blockingDiagnostics.some(item => item.includes('缺少真实导出名')),
    '生成阶段必须阻断而不是交给编译器报 C3861：' + generated.blockingDiagnostics.join(' / ')
  );
});

test('Project DLL command declarations round-trip notes and visibility through serialization', () => {
  const source = [
    '包 项目DLL命令',
    '',
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '',
    '  整数型 加法计算(整数型 被加数 // 第一个加数, 整数型 加数)',
    '  备注: 调用 DLL 计算两个整数之和。',
    '  空 内部填充(整数型 输出值 传址)',
    '  公开 = 假',
    '结束DLL命令库',
    ''
  ].join('\n');
  const context = createProjectDllCommandContext('src/项目DLL命令.lcpp', source);
  const serialized = serializeProjectDllCommandLibraries('项目DLL命令', context.dllLibraries);
  assert.match(serialized, /整数型 被加数 \/\/ 第一个加数/u);
  assert.match(serialized, /备注: 调用 DLL 计算两个整数之和。/u);
  assert.match(serialized, /公开 = 假/u);
  const reparsed = parseLingCpp(serialized);
  assert.equal(reparsed.program.diagnostics.filter(item => item.level === 'error').length, 0, reparsed.program.diagnostics.map(item => item.message).join('\n'));
  const library = reparsed.program.dllLibraries[0];
  assert.equal(library?.name, 'AdvancedMathDll');
  const commands = library?.commands || [];
  assert.equal(commands.length, 2);
  assert.equal(commands[0].remark, '调用 DLL 计算两个整数之和。');
  assert.equal(commands[0].parameters[0].note, '第一个加数');
  assert.equal(commands[0].parameters[0].byRef, false);
  assert.equal(commands[1].isPublic, false);
  assert.equal(commands[1].parameters[0].byRef, true);
  assert.equal(commands[1].parameters[0].note, undefined);
  assert.equal(commands[1].returnType, '空');
  // 再次序列化保持文本一致（幂等）。
  const secondPass = serializeProjectDllCommandLibraries('项目DLL命令', reparsed.program.dllLibraries);
  assert.equal(secondPass, serialized);
});

test('Project DLL commands copy as bare declaration lines and paste back into a library', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '  整数型 加法计算(整数型 被加数 // 第一个加数, 整数型 加数)',
    '  备注: 调用 DLL 计算两个整数之和。',
    '结束DLL命令库'
  ].join('\n');
  const parsed = parseLingCpp(source);
  const library = parsed.program.dllLibraries[0];
  assert.ok(library);
  const snippet = serializeDllCommandSnippet(library.commands[0]);
  // 「复制此命令」只给命令自身：不带库头/架构路径/包行，整库导出由「复制全部声明」负责。
  assert.equal(snippet, '整数型 加法计算(整数型 被加数 // 第一个加数, 整数型 加数)\n备注: 调用 DLL 计算两个整数之和。\n');
  assert.doesNotMatch(snippet, /DLL命令库/u);
  assert.doesNotMatch(snippet, /^包 /mu);
  const fromBare = parseDllDeclarationSnippet(snippet);
  assert.equal(fromBare.bare, true, '裸声明行必须按「并入当前库」处理');
  assert.equal(fromBare.libraries.length, 1);
  assert.equal(fromBare.libraries[0].commands.length, 1);
  assert.equal(fromBare.libraries[0].commands[0].name, '加法计算');
  assert.equal(fromBare.libraries[0].commands[0].remark, '调用 DLL 计算两个整数之和。');
  assert.equal(fromBare.libraries[0].commands[0].parameters[0].note, '第一个加数');
  const fromWhole = parseDllDeclarationSnippet(source);
  assert.equal(fromWhole.bare, false, '整库片段不得被当成裸声明片段');
  assert.equal(fromWhole.libraries[0].name, 'AdvancedMathDll');
  assert.equal(parseDllDeclarationSnippet('这是一段普通中文说明，没有声明。').libraries.length, 0);
});

test('Project DLL serialization never writes nameless commands back as unparseable lines', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  Win32 = "dll/Win32/AdvancedMathDll.dll"',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '  整数型 加法计算(整数型 甲)',
    '结束DLL命令库'
  ].join('\n');
  const library = parseLingCpp(source).program.dllLibraries[0];
  assert.ok(library);
  const nameless = { ...library.commands[0], name: '', parameters: [] };
  const serialized = serializeProjectDllCommandLibraries('项目DLL命令', [{ ...library, commands: [...library.commands, nameless] }]);
  assert.ok(!/^\s*整数型\s*\(/mu.test(serialized), `不得写出空名死行：\n${serialized}`);
  // 写回的源码再解析必须与模型里的有名命令一致，不能出现「表格有、文件没有」的两套真相。
  const reparsed = parseLingCpp(serialized).program.dllLibraries[0];
  assert.deepEqual(reparsed?.commands.map(command => command.name), ['加法计算']);
});

test('Project DLL virtual module registers English export names as completion aliases', () => {
  const source = [
    'DLL命令库 MathF',
    '  单精度小数型 半值(单精度小数型 输入值) = HalfF',
    '  单精度小数型 加倍(单精度小数型 输入值) = HalfF',
    '  整数型 计数()',
    '  整数型 Shared()',
    '  整数型 撞名(整数型 甲) = Shared',
    '结束DLL命令库'
  ].join('\n');
  const installed = createProjectDllDeclarationModule(parseLingCpp(source).program.dllLibraries, 'alias-demo');
  const commands = installed?.manifest.contributes?.commands || [];
  const aliasesOf = (name: string) => commands.find(item => item.name === name)?.aliases;
  assert.deepEqual(aliasesOf('半值'), ['HalfF'], '英文导出名登记为别名，敲 HalfF 能筛出「半值」');
  assert.equal(aliasesOf('加倍'), undefined, '与其它命令别名冲突时不登记');
  assert.equal(aliasesOf('计数'), undefined, '没有导出别名时不登记');
  assert.equal(aliasesOf('撞名'), undefined, '别名与模块内其它命令名冲突时不登记');
});

test('Project DLL declarations synthesize a virtual module consumed by generation', () => {
  const source = [
    'DLL命令库 AdvancedMathDll',
    '  x64 = "dll/x64/AdvancedMathDll.dll"',
    '  整数型 加法计算(整数型 被加数, 整数型 加数)',
    '  文本型 问候生成(文本型 姓名)',
    '结束DLL命令库'
  ].join('\n');
  const context = createProjectDllCommandContext('src/项目DLL命令.lcpp', source);
  const module = createProjectDllDeclarationModule(context.dllLibraries, 'dll-lib-demo');
  assert.ok(module, '应合成虚拟模块');
  assert.equal(module.manifest.id, 'lingbuilder.project.dll');
  assert.equal(module.manifest.bindings?.commands?.length, 2);
  assert.equal(module.manifest.contributes?.commands?.length, 2);
  assert.equal(module.manifest.bindings?.commands?.[0]?.runtimeName, '加法计算');
  const generated = generateLingCppNativeWin32Project(sampleProject, {
    lingCppSourceCode: '类 游戏主窗体 : 窗口\n公开\n  事件 _游戏主窗体_创建完毕()\n    局部 整数型 结果 = 0\n    结果 = 加法计算(1, 2)\n  结束\n结束类',
    enabledModules: [module]
  });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /#include "modules\/lingbuilder\.project\.dll\/include\/ProjectDllCommands\.h"/u);
  assert.match(cpp, /加法计算\(1, 2\)/u);
});

test('模块命令中文别名提供独立补全条目，按别名上屏且规范名并存', () => {
  const shellManifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.system.shell');
  assert.ok(shellManifest, '缺少系统外壳模块内置清单');
  const shellModule: InstalledModule = {
    isInstalled: true,
    installPath: 'builtin://lingbuilder.system.shell',
    isBuiltin: true,
    isEnabledForProject: true,
    diagnostics: [],
    manifest: shellManifest!
  };
  const moduleContext = { enabledModules: [shellModule], availableModules: [shellModule] };

  const byChineseQuery = getLingCppCompletions({ source: '取运', line: 1, column: 3 }, moduleContext);
  const aliasItem = byChineseQuery.find(item => item.label === '取运行目录');
  assert.ok(aliasItem, '中文别名应有独立补全条目');
  assert.equal(aliasItem!.insertText, '取运行目录()');
  assert.ok(aliasItem!.detail?.includes('系统_取运行目录 的别名'), '别名条目应注明规范名');
  assert.ok(byChineseQuery.some(item => item.label === '系统_取运行目录'), '规范名补全条目应并存');
  const aliasIndex = byChineseQuery.findIndex(item => item.label === '取运行目录');
  const canonicalIndex = byChineseQuery.findIndex(item => item.label === '系统_取运行目录');
  assert.ok(aliasIndex >= 0 && aliasIndex < canonicalIndex, '别名检索时别名条目应排在规范名之前');

  const byPinyinQuery = getLingCppCompletions({ source: 'qyx', line: 1, column: 4 }, moduleContext);
  assert.ok(byPinyinQuery.some(item => item.label === '取运行目录'), '拼音检索应命中别名条目');
  assert.ok(byPinyinQuery.some(item => item.label === '系统_取运行目录'), '拼音检索应命中规范名条目');
});

test('新手模式 # 触发常量补全上下文与常量令牌着色', () => {
  const empty = '        调试输出(#';
  const emptyContext = getBeginnerCompletionContext(empty, empty.length);
  assert.equal(emptyContext.isConstantReference, true);
  assert.equal(shouldShowBeginnerCompletion(emptyContext, false), true, '刚敲 # 时 token 为空也必须弹出常量清单');
  const typed = '        调试输出(#键盘';
  const typedContext = getBeginnerCompletionContext(typed, typed.length);
  assert.equal(typedContext.isConstantReference, true);
  assert.equal(typedContext.token, '键盘');
  const inString = '        调试输出("版本 #';
  assert.equal(getBeginnerCompletionContext(inString, inString.length).isConstantReference, false, '字符串内的 # 不触发常量补全');
  const nativeLine = '@#include <windows.h>';
  assert.equal(getBeginnerCompletionContext(nativeLine, nativeLine.length).isConstantReference, false, '@ 内嵌 C++ 行的 # 不触发常量补全');

  const statementTokens = tokenizeEplStatement('调试输出("x:" + #模块名)');
  assert.equal(statementTokens.find(token => token.kind === 'constant')?.text, '#模块名');
  assert.equal(EPL_TOKEN_COLORS_DARK.constant, LINGCPP_CONSTANT_TOKEN_COLORS.dark, '新手正文与 Monaco 必须共用同一常量令牌色');

  const presentationTokens = classifyLingCppPresentationCode('调试输出(#模块名)', {
    isNativeCpp: false,
    moduleCommands: new Set(),
    knownMembers: new Set(),
    knownProcedures: new Set()
  });
  assert.equal(presentationTokens.find(token => token.text === '#模块名')?.kind, 'constant');
});

test('wideString 形参实参与指针文本拼接统一经 LingCppWideArg 归一', () => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.net.http-client', 'lingbuilder.std.array'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!, installPath: `builtin://${id}`, isBuiltin: true,
    isInstalled: true, isEnabledForProject: true, diagnostics: []
  }));
  const source = [
    '类 游戏主窗体 : 公开 窗体',
    '    事件 创建完毕()',
    '        局部 文本型 名单[]',
    '        局部 文本型 显示',
    '        局部 HTTP客户端 客户端',
    '        局部 HTTP客户端请求 请求',
    '        客户端 = HTTP客户端_创建客户端()',
    '        请求 = HTTP客户端_创建请求(客户端, "GET", "https://example.com")',
    '        数组_加入成员(名单, "甲")',
    '        数组_加入成员(名单, "乙")',
    '        显示 = 数组_取成员(名单, 0) + "（" + 数组_取成员(名单, 1) + "）"',
    '        HTTP客户端_设置文本正文(请求, 数组_取成员(名单, 1), "text/plain; charset=utf-8")',
    '        HTTP客户端_设置文本正文(请求, 显示, "text/plain; charset=utf-8")',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(sampleProject, { lingCppSourceCode: source, enabledModules: modules });
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // D-2：const wchar_t* + const wchar_t* 不再吐成指针加法（C2110）。
  assert.ok(cpp.includes('(std::wstring(LingCppWideArg(数组_取成员(名单, 0))) + LingCppWideArg(L"（"))'), '数组成员与字面量拼接必须先经 LingCppWideArg 归一');
  assert.equal(cpp.includes('数组_取成员(名单, 0)+L"（"'), false);
  // D-1：调用形态实参（此前只有裸标识符会被包装）与裸变量一样统一包装。
  assert.ok(cpp.includes('HTTP客户端_设置文本正文(请求, LingCppWideArg(数组_取成员(名单, 1)), L"text/plain; charset=utf-8")'), 'wideString 形参的调用实参必须包装');
  assert.ok(cpp.includes('HTTP客户端_设置文本正文(请求, LingCppWideArg(显示), L"text/plain; charset=utf-8")'), '裸变量包装行为保持不变');
});
