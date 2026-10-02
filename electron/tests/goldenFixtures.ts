/**
 * 黄金基线夹具：覆盖 generateLingCppNativeWin32Project 的主要分支
 * （application / console / dll、模块开关、控件组合、功能库与项目数据）。
 * 供 goldenSplit.test.ts 在生成器结构性重构前后做逐字节对比。
 */
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import type { GenerateLingCppNativeWin32ProjectOptions } from '../src/services/windowDesigner/lingCppWin32Project';

export interface GoldenFixture {
  name: string;
  project: LingWindowProject;
  options: GenerateLingCppNativeWin32ProjectOptions;
}

function makeWindow(controls: LingControl[]): LingWindowProject['windows'][number] {
  return {
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: 'MainWindow',
    title: '黄金基线主窗口',
    width: 640,
    height: 480,
    background: '#202028',
    description: '',
    controls
  };
}

function makeProject(id: string, name: string, controls: LingControl[]): LingWindowProject {
  return {
    schemaVersion: 2,
    id,
    name,
    windows: [makeWindow(controls)]
  };
}

function makeControl(id: string, type: LingControl['type'], events: Record<string, string> = {}, content = id): LingControl {
  return {
    id,
    type,
    name: id,
    content,
    width: 120,
    height: 30,
    x: 20,
    y: 20,
    fontSize: 12,
    background: 'transparent',
    foreground: 'auto',
    isEnabled: true,
    visibility: 'Visible',
    events
  } as LingControl;
}

function builtinModules(ids: string[]): InstalledModule[] {
  return ids
    .map(id => BUILTIN_MODULES.find(item => item.id === id))
    .filter((item): item is (typeof BUILTIN_MODULES)[number] => Boolean(item))
    .map(module => ({
      manifest: module,
      installPath: `builtin://${module.id}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }));
}

const BUTTON_ONLY_SOURCE = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        调试输出("窗口创建完毕")',
  '    结束',
  '',
  '    事件 _按钮1_被单击()',
  '        信息框("新按钮", 64, "事件触发")',
  '        调试输出("按钮1被单击")',
  '    结束',
  '结束类'
].join('\n');

export function buildGoldenFixtures(): GoldenFixture[] {
  const fixtures: GoldenFixture[] = [];

  // ① 一个窗口一个按钮（对齐真实用户项目 lingbuilder-3）
  fixtures.push({
    name: 'button-only',
    project: makeProject('golden-button-only', '黄金基线-单按钮', [
      makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '点我')
    ]),
    options: { lingCppSourceCode: BUTTON_ONLY_SOURCE }
  });

  // ② 空窗口
  fixtures.push({
    name: 'empty-window',
    project: makeProject('golden-empty-window', '黄金基线-空窗口', []),
    options: {
      lingCppSourceCode: [
        '类 MainWindow',
        '    事件 _MainWindow_创建完毕()',
        '        调试输出("空窗口")',
        '    结束',
        '结束类'
      ].join('\n')
    }
  });

  // ③ 多控件组合
  fixtures.push({
    name: 'rich-controls',
    project: makeProject('golden-rich-controls', '黄金基线-多控件', [
      makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '提交'),
      makeControl('编辑框1', 'TextBox', { Change: '_编辑框1_内容被改变' }, ''),
      makeControl('列表框1', 'ListBox', { Select: '_列表框1_选择项被改变' }, ''),
      makeControl('复选框1', 'CheckBox', { Change: '_复选框1_被改变' }, '启用'),
      makeControl('富编辑框1', 'RichEdit', {}),
      makeControl('列表视图1', 'ListView', {}),
      makeControl('进度条1', 'ProgressBar', {}),
      makeControl('视频1', 'VideoPlayer', {})
    ]),
    options: {
      lingCppSourceCode: [
        '类 MainWindow',
        '    事件 _MainWindow_创建完毕()',
        '        调试输出("多控件窗口")',
        '    结束',
        '    事件 _按钮1_被单击()',
        '        信息框("提交", 0, "按钮")',
        '    结束',
        '    事件 _编辑框1_内容被改变()',
        '        调试输出("编辑框内容变化")',
        '    结束',
        '    事件 _列表框1_选择项被改变()',
        '        调试输出("列表框选择变化")',
        '    结束',
        '    事件 _复选框1_被改变()',
        '        调试输出("复选框变化")',
        '    结束',
        '结束类'
      ].join('\n')
    }
  });

  // ④ 宽模块启用面
  fixtures.push({
    name: 'modules-broad',
    project: makeProject('golden-modules-broad', '黄金基线-宽模块', [
      makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '测试')
    ]),
    options: {
      enabledModules: builtinModules([
        'lingbuilder.win32.basic',
        'lingbuilder.win32.common-controls',
        'lingbuilder.std.array',
        'lingbuilder.std.buffer',
        'lingbuilder.std.text',
        'lingbuilder.std.regex',
        'lingbuilder.database.sqlite',
        'lingbuilder.http-client',
        'lingbuilder.http-server',
        'lingbuilder.cron',
        'lingbuilder.crypto',
        'lingbuilder.threading',
        'lingbuilder.advanced.process-memory'
      ]),
      lingCppSourceCode: BUTTON_ONLY_SOURCE
    }
  });

  // ④b 浏览器控件 + FBro 模块：钉住浏览器族片段「启用时保留」的裁剪方向
  const fbroModule = builtinModules(['lingbuilder.fbro.browser']);
  if (fbroModule.length > 0) {
    fixtures.push({
      name: 'browser-fbro',
      project: makeProject('golden-browser-fbro', '黄金基线-FBro浏览器', [
        makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '测试'),
        makeControl('浏览器1', 'FBroBrowser', {})
      ]),
      options: {
        enabledModules: fbroModule,
        lingCppSourceCode: BUTTON_ONLY_SOURCE
      }
    });
  }

  // ⑤ 功能库 + 项目全局变量 + 项目数据类型（多 .lcpp 源）
  fixtures.push({
    name: 'function-libraries',
    project: makeProject('golden-function-libraries', '黄金基线-功能库', [
      makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '调用库')
    ]),
    options: {
      lingCppSources: [
        {
          filePath: 'MainWindow.lcpp',
          sourceCode: [
            '类 MainWindow',
            '    事件 _按钮1_被单击()',
            '        调试输出(文本工具.合并("前缀", "内容"))',
            '        调试输出(全局问候语)',
            '    结束',
            '结束类'
          ].join('\n')
        },
        {
          filePath: '文本工具.lcpp',
          sourceCode: [
            '功能库 文本工具',
            '公开:',
            '  文本型 合并(文本型 前缀, 文本型 内容)',
            '    返回(前缀 + 内容)',
            '  结束',
            '结束功能库'
          ].join('\n')
        },
        {
          filePath: '项目全局变量.lcpp',
          sourceCode: '全局 文本型 全局问候语 = "你好"'
        },
        {
          filePath: '项目数据类型.lcpp',
          sourceCode: [
            '数据类型 人员信息',
            '    文本型 姓名',
            '    整数型 年龄',
            '结束数据类型'
          ].join('\n')
        }
      ]
    }
  });

  // ⑥ 控制台程序
  fixtures.push({
    name: 'console-app',
    project: makeProject('golden-console-app', '黄金基线-控制台', []),
    options: {
      outputKind: 'console-application',
      lingCppSourceCode: [
        '类 程序',
        '    公开 整数型 启动()',
        '        调试输出("控制台启动")',
        '        返回(0)',
        '    结束',
        '结束类'
      ].join('\n')
    }
  });

  // ⑦ 动态库输出
  fixtures.push({
    name: 'dll-output',
    project: makeProject('golden-dll-output', '黄金基线-DLL', []),
    options: {
      outputKind: 'dynamic-library',
      lingCppSourceCode: [
        '类 数学库',
        '    公开 整数型 加法(整数型 a, 整数型 b)',
        '        返回(a + b)',
        '    结束',
        '结束类'
      ].join('\n')
    }
  });

  // ⑧ UAC 管理员清单
  fixtures.push({
    name: 'uac-admin',
    project: makeProject('golden-uac-admin', '黄金基线-UAC', [
      makeControl('按钮1', 'Button', { Click: '_按钮1_被单击' }, '管理')
    ]),
    options: { requireAdministrator: true, lingCppSourceCode: BUTTON_ONLY_SOURCE }
  });

  return fixtures;
}
