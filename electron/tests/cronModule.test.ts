import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRON_COMMAND_SPECS, CRON_MODULE, CRON_MODULE_ID } from '../src/services/modules/cronModule';
import { CRON_RUNTIME_MODULE_ID, generateCronRuntime } from '../src/services/windowDesigner/cronRuntime';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { InstalledModule } from '../src/services/modules/types';
import { LingWindowProject } from '../src/services/windowDesigner/types';

test('定时任务模块清单、命令与处理器签名契约完整', () => {
  assert.equal(CRON_MODULE_ID, CRON_RUNTIME_MODULE_ID);
  assert.equal(CRON_MODULE.version, '1.0.0');
  assert.equal(CRON_MODULE.category, '系统');
  assert.equal(CRON_COMMAND_SPECS.length, 29);
  assert.equal(CRON_MODULE.contributes.commands.length, CRON_COMMAND_SPECS.length);
  assert.equal(CRON_MODULE.bindings.commands.length, CRON_COMMAND_SPECS.length);
  assert.deepEqual(
    CRON_MODULE.contributes.commands.map(item => item.name),
    CRON_MODULE.bindings.commands.map(item => item.command)
  );
  const names = CRON_COMMAND_SPECS.map(spec => spec.name);
  for (const name of names) assert.ok(name.startsWith('cron_定时_'), `${name} 必须使用 cron_定时_ 前缀`);
  // 处理器签名契约：到点/完成处理器收定时任务，工作处理器无参数。
  const bindingOf = (name: string) => CRON_MODULE.bindings.commands.find(item => item.command === name)!;
  assert.deepEqual(bindingOf('cron_定时_启动').parameters[1].handlerSignature, { parameterTypes: ['定时任务'], returnType: '空' });
  assert.deepEqual(bindingOf('cron_定时_提交线程').parameters[1].handlerSignature, { parameterTypes: [], returnType: '空' });
  assert.deepEqual(bindingOf('cron_定时_提交线程').parameters[2].handlerSignature, { parameterTypes: ['定时任务'], returnType: '空' });
  // 类型贡献与文档登记：returnLabel 定时任务 必须是清单声明类型。
  assert.ok(CRON_MODULE.contributes.types.some(type => type.name === '定时任务' && type.cppType === 'long long'));
  assert.ok(CRON_MODULE.contributes.docs.some(doc => doc.path === 'docs/modules/cron/README.md'));
  // 关键命令在位：调度/表/守护/邮件四族齐全。
  for (const name of [
    'cron_定时_启动', 'cron_定时_提交线程', 'cron_定时_停止全部', 'cron_定时_暂停', 'cron_定时_恢复',
    'cron_定时_取状态', 'cron_定时_下次触发时间', 'cron_定时_立即触发', 'cron_定时_校验表达式', 'cron_定时_表达式说明',
    'cron_定时_表读取', 'cron_定时_表保存', 'cron_定时_表添加', 'cron_定时_表删除', 'cron_定时_表清空', 'cron_定时_表载入运行',
    'cron_定时_守护启动', 'cron_定时_守护停止', 'cron_定时_开机自启', 'cron_定时_邮件配置', 'cron_定时_邮件测试'
  ]) assert.ok(names.includes(name), `缺少命令 ${name}`);
});

test('cron 运行时按启用注入，含解析器、守护、表与邮件实现', () => {
  assert.equal(generateCronRuntime([]), '');
  const cronModule: InstalledModule = {
    manifest: CRON_MODULE,
    installPath: 'builtin://lingbuilder.cron',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const runtime = generateCronRuntime([cronModule]);
  for (const marker of [
    'class LingCronRuntime',
    'ParseExpression',
    'NextFireTime',
    '@reboot',
    'StartHandlerJob',
    'StartWorkerJob',
    'cron_定时_表载入运行',
    'cron_定时_守护启动',
    'cron_定时_开机自启',
    'LingCronSendMail',
    'cmd.exe /c',
    '--lingbuilder-cron-daemon'
  ]) {
    assert.ok(runtime.includes(marker), `cron 运行时缺少标记 ${marker}`);
  }
});

const cronModule: InstalledModule = {
  manifest: CRON_MODULE,
  installPath: 'builtin://lingbuilder.cron',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

const project: LingWindowProject = {
  id: 'cron-runtime-test',
  name: '定时任务生成测试',
  windows: [{
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: 'MainWindow',
    title: '定时任务测试',
    width: 640,
    height: 480,
    background: '#202020',
    description: '定时任务模块生成测试。',
    controls: []
  }]
};

const source = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        局部 定时任务 任务A = cron_定时_启动("*/5 * * * *", &检查更新)',
  '        局部 定时任务 任务B = cron_定时_提交线程("0 2 * * *", &夜间备份, &备份完成)',
  '        cron_定时_邮件配置("smtp.qq.com", 465, "账号@qq.com", "授权码", "我@qq.com")',
  '        cron_定时_守护启动()',
  '    结束',
  '',
  '    空 检查更新(定时任务 任务)',
  '        调试输出("到点：" + 到文本(任务))',
  '    结束',
  '',
  '    空 夜间备份()',
  '        调试输出("备份中")',
  '    结束',
  '',
  '    空 备份完成(定时任务 任务)',
  '        调试输出("备份完成")',
  '    结束',
  '结束类'
].join('\n');

test('窗口项目生成 cron 命令调用、处理器派发与守护入口', () => {
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    enabledModules: [cronModule]
  }).files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // handler-as-name ABI：字符串实参传处理器名。
  assert.ok(generated.includes('cron_定时_启动(L"*/5 * * * *", L"检查更新")'), '启动调用必须翻译为宽字符串处理器名');
  assert.ok(generated.includes('cron_定时_提交线程(L"0 2 * * *", L"夜间备份", L"备份完成")'), '提交线程调用必须翻译为三个宽字符串实参');
  assert.ok(generated.includes('cron_定时_邮件配置(L"smtp.qq.com", 465, L"账号@qq.com", L"授权码", L"我@qq.com")'));
  // 处理器派发：到点/完成处理器带任务 ID，工作处理器无参。
  assert.ok(/void DispatchCronEvent\(const wchar_t\* handler, long long taskId\) override \{[\s\S]*?检查更新\(lbCronTask\)/u.test(generated));
  assert.ok(/void DispatchCronWorkerEvent\(const wchar_t\* handler\) override \{[\s\S]*?夜间备份\(\)/u.test(generated));
  assert.ok(/DispatchCronWorkerEvent[\s\S]*?备份完成\(\)/u.test(generated) === false, '完成处理器不应出现在工作派发表');
  // 消息泵、定时器与守护入口接线。
  assert.ok(generated.includes('case WM_LINGBUILDER_CRON_UI_UPDATE:'));
  assert.ok(generated.includes('SetTimer(hwnd_, LINGBUILDER_CRON_TIMER_ID, 1000, nullptr);'));
  assert.ok(generated.includes('g_lingbuilderCronDaemonMode = LingCronCommandLineWantsDaemon();'));
  assert.ok(generated.includes('if (g_lingbuilderCronDaemonMode && startWindow) cron_定时_守护启动();'));
  assert.ok(generated.includes('LingCronRuntime::Instance().ShutdownOwner(cronOwnerToken_);'));
  // 运行时块整体注入。
  assert.ok(generated.includes('class LingCronRuntime'));
});

test('未启用 cron 模块时不注入运行时（接线由预处理守卫剔除）', () => {
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    enabledModules: []
  }).files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // 运行时块（解析器/调度器/表/守护/邮件）只在模块启用时注入。
  assert.ok(!generated.includes('class LingCronRuntime'));
  assert.ok(!generated.includes('cron_定时_表载入运行'), '未启用时不得注入表命令实现');
  // 消息泵/定时器接线是模板常驻文本，必须由 LINGBUILDER_CRON_MODULE 预处理守卫保证未启用时编译期剔除。
  assert.ok(generated.includes('#ifdef LINGBUILDER_CRON_MODULE'));
});
