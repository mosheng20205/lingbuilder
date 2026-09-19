import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLingCppAstEdit } from '../src/services/lingCpp/astEditService';
import { buildLingCppLanguageContext, getLingCppCompletionItems, getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import {
  createProjectTypeContext,
  getProjectDataTypeDiagnostics,
  renameProjectDataFieldAcrossSources,
  renameProjectDataTypeAcrossSources,
  sortProjectDataTypes
} from '../src/services/lingCpp/projectDataTypeService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { InstalledModule } from '../src/services/modules/types';

const typePath = 'src/demo/项目数据类型.lcpp';
const typeSource = [
  '数据类型 地址信息',
  '    文本型 城市 = ""',
  '结束数据类型',
  '',
  '数据类型 用户信息',
  '    文本型 姓名 = ""',
  '    整数型 年龄 = 0',
  '    逻辑型 已登录 = 假',
  '    地址信息 地址',
  '    文本型 标签[]',
  '结束数据类型'
].join('\n');

test('解析记录型数据类型、字段默认值、嵌套和数组', () => {
  const program = parseLingCpp(typeSource).program;
  assert.equal(program.dataTypes.length, 2);
  assert.deepEqual(program.dataTypes[1].fields.map(field => [field.name, field.type, field.isArray]), [
    ['姓名', '文本型', false], ['年龄', '整数型', false], ['已登录', '逻辑型', false],
    ['地址', '地址信息', false], ['标签', '文本型', true]
  ]);
  assert.equal(getProjectDataTypeDiagnostics(typeSource, typePath).length, 0);
  assert.deepEqual(sortProjectDataTypes(program.dataTypes).map(item => item.name), ['地址信息', '用户信息']);
  const arrayMethod = parseLingCpp('类 服务\n  用户信息[] 查询(用户信息[] 条件)\n  结束\n结束类').program.classes[0].methods[0];
  assert.equal(arrayMethod.returnType, '用户信息[]');
  assert.equal(arrayMethod.parameters[0].type, '用户信息[]');
});

test('拒绝重名、非法字段类型、对象默认值和直接或间接循环嵌套', () => {
  const source = [
    '数据类型 A', '    B 子项', '结束数据类型',
    '数据类型 B', '    A 父项[]', '    按钮 控件', '结束数据类型'
  ].join('\n');
  const messages = getProjectDataTypeDiagnostics(source, typePath).map(item => item.message).join('\n');
  assert.match(messages, /循环嵌套/u);
  assert.match(messages, /不允许的类型/u);
});

test('文件头注释不作为首个数据类型说明，说明往返与删除均保留头注释', () => {
  const headerLine = '// 项目自定义数据类型：文件级说明';
  const headerSource = [headerLine, '数据类型 订单', '结束数据类型'].join('\n');
  assert.equal(createProjectTypeContext(typePath, headerSource).dataTypes[0]?.note, undefined);
  const added = applyLingCppAstEdit(headerSource, { kind: 'update-data-type', dataTypeName: '订单', note: '采购订单记录' });
  assert.equal(added.success, true);
  assert.equal(added.sourceCode.split('\n')[0], headerLine);
  assert.equal(createProjectTypeContext(typePath, added.sourceCode).dataTypes[0]?.note, '采购订单记录');
  const cleared = applyLingCppAstEdit(added.sourceCode, { kind: 'update-data-type', dataTypeName: '订单', note: '' });
  assert.equal(cleared.success, true);
  assert.equal(cleared.sourceCode.split('\n')[0], headerLine);
  assert.equal(createProjectTypeContext(typePath, cleared.sourceCode).dataTypes[0]?.note, undefined);
  const removed = applyLingCppAstEdit(added.sourceCode, { kind: 'delete-data-type', dataTypeName: '订单' });
  assert.equal(removed.success, true);
  assert.ok(removed.sourceCode.includes(headerLine));
});

test('AST 编辑支持新增、更新、排序和删除类型字段', () => {
  const added = applyLingCppAstEdit('', { kind: 'add-data-type', dataType: { name: '订单' } });
  assert.equal(added.success, true);
  const field = applyLingCppAstEdit(added.sourceCode, { kind: 'add-data-field', dataTypeName: '订单', field: { name: '编号', type: '文本型', initialValue: '""' } });
  assert.equal(field.success, true);
  const renamed = applyLingCppAstEdit(field.sourceCode, { kind: 'update-data-field', dataTypeName: '订单', fieldName: '编号', newName: '订单号' });
  assert.match(renamed.sourceCode, /文本型 订单号 = ""/u);
  assert.equal(parseLingCpp(renamed.sourceCode).program.dataTypes[0].fields[0].name, '订单号');
});

test('安全重命名跳过字符串和注释，并按变量实际类型隔离同名字段', () => {
  const context = createProjectTypeContext(typePath, typeSource);
  const files = [
    { filePath: typePath, sourceCode: typeSource },
    { filePath: 'src/demo/主窗口.lcpp', sourceCode: '类 主窗口\n  事件 创建完毕()\n    局部 用户信息 当前用户\n    当前用户.姓名 = "姓名" // 姓名\n  结束\n结束类\n' }
  ];
  const renamedType = renameProjectDataTypeAcrossSources(files, context, '用户信息', '账户信息');
  assert.match(renamedType[1].sourceCode, /局部 账户信息 当前用户/u);
  const renamedField = renameProjectDataFieldAcrossSources(files, context, '用户信息', '姓名', '显示名');
  assert.match(renamedField[1].sourceCode, /当前用户\.显示名 = "姓名" \/\/ 姓名/u);
});

test('语言服务提供项目类型和多级字段补全，并检查字段赋值类型', () => {
  const projectTypes = createProjectTypeContext(typePath, typeSource);
  const source = '类 主窗口\n  事件 创建完毕()\n    局部 用户信息 当前用户\n    当前用户.地址.\n    当前用户.年龄 = "错误"\n  结束\n结束类\n';
  const context = buildLingCppLanguageContext(source, undefined, undefined, 'src/demo/主窗口.lcpp', undefined, projectTypes);
  const typeItems = getLingCppCompletionItems({ source, line: 3, column: 8, triggerText: '用户' }, context);
  assert.ok(typeItems.some(item => item.label === '用户信息'));
  const fieldItems = getLingCppCompletionItems({ source, line: 4, column: '    当前用户.地址.'.length + 1, triggerText: '' }, context);
  assert.ok(fieldItems.some(item => item.label === '城市' && item.detail.includes('地址信息')));
  const messages = getLingCppSemanticDiagnostics(source, undefined, 'src/demo/主窗口.lcpp', undefined, undefined, projectTypes).map(item => item.message).join('\n');
  assert.match(messages, /不能把 文本型 赋值给 整数型/u);
});

test('普通 Win32 生成依赖排序的 struct、值语义变量和数据类型 source map', () => {
  const project: LingWindowProject = { id: 'demo', name: '类型演示', windows: [
    { id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '', width: 640, height: 480, background: '#fff', controls: [] },
    { id: 'child', fileName: '子窗口.xml', className: '子窗口', title: '子窗口', description: '', width: 480, height: 320, background: '#fff', controls: [] }
  ] };
  const generated = generateLingCppNativeWin32Project(project, { lingCppSources: [
    { filePath: typePath, sourceCode: typeSource },
    { filePath: 'src/demo/项目全局变量.lcpp', sourceCode: '全局 用户信息 登录用户\n' },
    { filePath: 'src/demo/主窗口.lcpp', sourceCode: '类 主窗口\n  用户信息 备份用户\n  事件 创建完毕()\n    局部 用户信息 当前用户\n    当前用户.姓名 = "小明"\n    当前用户.地址.城市 = "上海"\n    备份用户 = 当前用户\n  结束\n结束类\n' },
    { filePath: 'src/demo/子窗口.lcpp', sourceCode: '类 子窗口\n  用户信息 当前用户\n  用户信息 读取用户()\n    局部 用户信息 结果\n    返回 结果\n  结束\n结束类\n' }
  ] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(cpp.indexOf('struct 地址信息') < cpp.indexOf('struct 用户信息'));
  assert.match(cpp, /std::vector<std::wstring> 标签\{\};/u);
  assert.match(cpp, /用户信息 登录用户\{\};/u);
  assert.match(cpp, /当前用户\.地址\.城市 = L"上海";/u);
  assert.match(cpp, /用户信息 读取用户\(\)/u);
  assert.match(cpp, /用户信息 读取用户\(\)[\s\S]*?return 结果;[\s\S]*?return \{\};/u);
  assert.ok(generated.sourceMap.some(entry => entry.kind === 'data-type' && entry.sourceFile === typePath));
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
});

test('new_emoji 生成链同样聚合项目数据类型', () => {
  const project: LingWindowProject = { id: 'emoji', name: '类型演示', windows: [{ id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '', width: 640, height: 480, background: '#fff', controls: [] }] };
  const newEmojiModule: InstalledModule = {
    manifest: { schemaVersion: 2, id: 'lingbuilder.new_emoji.ui', name: 'new_emoji', version: '1.0.0', category: '界面', description: '测试', targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['include'] }] },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui', isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(project, { enabledModules: [newEmojiModule], lingCppSources: [
    { filePath: typePath, sourceCode: typeSource },
    { filePath: 'src/demo/主窗口.lcpp', sourceCode: '类 主窗口\n  事件 创建完毕()\n    局部 用户信息 当前用户\n    当前用户.姓名 = "小明"\n  结束\n结束类\n' }
  ] });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /#include "new_emoji_bridge\.h"[\s\S]*struct 地址信息[\s\S]*struct 用户信息/u);
  assert.match(cpp, /用户信息 当前用户\{\};[\s\S]*当前用户\.姓名 = L"小明";/u);
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
});

test('模块公开记录与数组进入语言服务、项目嵌套和 C++ 生成链', () => {
  const publicTypeModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'com.example.public-types',
      name: '公开类型模块',
      version: '1.0.0',
      category: '其他',
      description: '公开值语义数据模型。',
      contributes: {
        types: [
          {
            name: '模块地址',
            kind: 'record',
            description: '模块公开地址。',
            fields: [{ name: '城市', type: '文本型', initialValue: '""' }]
          },
          {
            name: '模块用户',
            kind: 'record',
            description: '模块公开用户。',
            fields: [
              { name: '姓名', type: '文本型', initialValue: '""' },
              { name: '地址', type: '模块地址' },
              { name: '标签', type: '文本型', isArray: true }
            ]
          },
          { name: '模块用户列表', kind: 'array', elementType: '模块用户', description: '模块用户数组。' }
        ]
      }
    },
    installPath: 'builtin://com.example.public-types',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const moduleContext = { availableModules: [publicTypeModule], enabledModules: [publicTypeModule] };
  const source = [
    '类 主窗口',
    '  事件 创建完毕()',
    '    局部 模块用户 当前用户',
    '    当前用户.',
    '    当前用户.地址.城市 = "杭州"',
    '    局部 模块用户列表 用户列表',
    '  结束',
    '结束类'
  ].join('\n');
  const languageContext = buildLingCppLanguageContext(source, undefined, moduleContext, 'src/demo/主窗口.lcpp');
  const completion = getLingCppCompletionItems({
    source,
    line: 4,
    column: '    当前用户.'.length + 1,
    triggerText: ''
  }, languageContext);
  assert.ok(completion.some(item => item.label === '姓名' && item.detail.includes('模块用户 字段')));
  assert.ok(completion.some(item => item.label === '地址'));
  assert.equal(languageContext.diagnostics.filter(item => item.level === 'error').length, 0, languageContext.diagnostics.map(item => item.message).join('\n'));

  const projectTypeDiagnostics = getProjectDataTypeDiagnostics(
    '数据类型 项目会话\n  模块用户 用户\n  模块用户列表 历史\n结束数据类型\n',
    typePath,
    moduleContext
  );
  assert.equal(projectTypeDiagnostics.length, 0, projectTypeDiagnostics.map(item => item.message).join('\n'));

  const project: LingWindowProject = {
    id: 'module-public-types',
    name: '模块公开类型',
    windows: [{ id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '', width: 640, height: 480, background: '#fff', controls: [] }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [publicTypeModule],
    lingCppSources: [{ filePath: 'src/demo/主窗口.lcpp', sourceCode: source.replace('    当前用户.\n', '') }]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /struct 模块地址[\s\S]*struct 模块用户/u);
  assert.match(cpp, /std::vector<std::wstring> 标签\{\};/u);
  assert.match(cpp, /模块用户 当前用户\{\};/u);
  assert.match(cpp, /std::vector<模块用户> 用户列表\{\};/u);
  assert.match(cpp, /当前用户\.地址\.城市 = L"杭州";/u);
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));
  assert.equal(generated.sourceMap.some(entry => entry.symbolName === '模块用户'), false, '模块公开类型不能伪装成项目数据类型源码映射');
});

test('模块常量 contributes.constants 进入语言服务并以 #常量 物化为编译期常量', () => {
  const makeModule = (id: string, name: string, constants: unknown[]): InstalledModule => ({
    manifest: {
      schemaVersion: 2,
      id,
      name,
      version: '1.0.0',
      category: '其他',
      description: '公开常量。',
      contributes: { constants } as InstalledModule['manifest']['contributes']
    },
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  });
  const constantsModule = makeModule('com.example.constants', '常量模块', [
    { name: '键盘1', type: '整数型', value: 49, description: '数字键 1 的虚拟键码。' },
    { name: '模块标题', type: '文本型', value: '常量模块', description: '模块标题。' },
    { name: '启用日志', type: '逻辑型', value: true, description: '默认启用日志。' },
    { name: '隐藏常量', type: '整数型', value: 7, description: '高级常量。', level: 'advanced' }
  ]);
  const moduleContext = { availableModules: [constantsModule], enabledModules: [constantsModule] };
  const source = [
    '类 主窗口',
    '  事件 创建完毕()',
    '    局部 整数型 键码',
    '    键码 = #键盘1 + 1',
    '    调试输出(#模块标题)',
    '    调试输出(#不存在常量)',
    '  结束',
    '结束类'
  ].join('\n');
  const languageContext = buildLingCppLanguageContext(source, undefined, moduleContext, 'src/demo/主窗口.lcpp');
  assert.equal(
    languageContext.diagnostics.filter(item => item.level === 'error' && !item.message.includes('#不存在常量')).length,
    0,
    languageContext.diagnostics.filter(item => item.level === 'error').map(item => item.message).join('\n')
  );
  assert.ok(languageContext.diagnostics.some(item => item.message.includes('常量 #不存在常量 不存在')));
  const completion = getLingCppCompletionItems(
    { source, line: 4, column: '    键码 = #'.length + 1, triggerText: '模块' },
    languageContext
  );
  assert.ok(completion.some(item => item.label === '#键盘1' && item.insertText === '键盘1' && item.detail.includes('模块常量')));
  assert.ok(completion.some(item => item.label === '#模块标题'));
  assert.equal(completion.some(item => item.label === '#隐藏常量'), false, 'advanced 常量默认不进补全');
  assert.equal(completion.every(item => item.label.startsWith('#')), true);

  const project: LingWindowProject = {
    id: 'module-constants',
    name: '模块常量',
    windows: [{ id: 'main', fileName: '主窗口.xml', className: '主窗口', title: '主窗口', description: '', width: 640, height: 480, background: '#fff', controls: [] }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [constantsModule],
    lingCppSources: [{ filePath: 'src/demo/主窗口.lcpp', sourceCode: source.replace('    调试输出(#不存在常量)\n', '') }]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /inline constexpr int 键盘1 = 49;/u);
  assert.match(cpp, /inline const std::wstring 模块标题 = L"常量模块";/u);
  assert.match(cpp, /inline constexpr bool 启用日志 = true;/u);
  assert.match(cpp, /键码 = 键盘1\+1;/u);
  assert.match(cpp, /调试输出\(模块标题\);/u);
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join('\n'));

  // 工程常量同名遮蔽：只物化项目常量一份。
  const shadowed = generateLingCppNativeWin32Project(project, {
    enabledModules: [constantsModule],
    lingCppSources: [
      { filePath: 'src/demo/项目全局变量.lcpp', sourceCode: '常量 整数型 键盘1 = 99\n' },
      { filePath: 'src/demo/主窗口.lcpp', sourceCode: source.replace('    调试输出(#不存在常量)\n', '') }
    ]
  });
  const shadowedCpp = shadowed.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(shadowedCpp, /inline constexpr int 键盘1 = 99;/u);
  assert.equal(/inline constexpr int 键盘1 = 49;/u.test(shadowedCpp), false, '遮蔽时不得同时物化两份同名常量');

  // 跨模块同名常量：构建前中文阻断。
  const conflicting = generateLingCppNativeWin32Project(project, {
    enabledModules: [constantsModule, makeModule('com.example.constants-b', '常量模块B', [
      { name: '键盘1', type: '整数型', value: 49, description: '与 A 模块冲突。' }
    ])]
    , lingCppSources: [{ filePath: 'src/demo/主窗口.lcpp', sourceCode: source.replace('    调试输出(#不存在常量)\n', '') }]
  });
  assert.ok(conflicting.blockingDiagnostics.some(message => message.includes('重复公开常量 键盘1')), conflicting.blockingDiagnostics.join('\n'));
});
