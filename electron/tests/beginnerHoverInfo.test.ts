import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getBeginnerHoverInfoAtOffset,
  getBeginnerTypeHoverInfo,
  isSameBeginnerHoverInfo,
  type BeginnerHoverInfoContext
} from '../src/services/lingCpp/beginnerHoverInfo';
import type { LingCppProgram } from '../src/services/lingCpp/types';

const program: LingCppProgram = {
  packageName: '演示',
  uses: [],
  constants: [],
  globals: [],
  dataTypes: [],
  functionLibraries: [],
  dllLibraries: [],
  classes: [
    {
      name: '窗口一',
      line: 1,
      members: [],
      methods: [
        {
          name: '无头就绪',
          returnType: '空',
          access: '私有',
          kind: 'method',
          line: 9,
          parameters: [],
          statements: []
        },
        {
          name: '连接远程',
          returnType: '整数型',
          access: '公开',
          kind: 'method',
          line: 20,
          isStatic: true,
          note: '连接说明',
          parameters: [
            { name: '地址', type: '文本型' },
            { name: '超时', type: '整数型', defaultValue: '5000' }
          ],
          statements: []
        }
      ]
    }
  ],
  diagnostics: [],
  source: ''
};

const targetMethod = {
  name: '_连接远程_被单击',
  returnType: '空',
  access: '私有' as const,
  kind: 'event' as const,
  line: 5,
  parameters: [{ name: '操作参数一', type: '文本型', note: '操作说明' }],
  locals: [
    { name: '新连接', type: 'CDP连接', line: 6, note: '当前连接句柄' },
    { name: '重试上限', type: '整数型', line: 7, initialValue: '3', isConstant: true }
  ],
  statements: []
};

const libraries = [
  {
    name: '参数准备库',
    filePath: 'src/参数准备库.lcpp',
    line: 1,
    methods: [
      {
        name: '准备连接地址',
        returnType: '逻辑型',
        access: '公开' as const,
        kind: 'method' as const,
        line: 2,
        note: '按是否强制重新准备连接地址',
        parameters: [{ name: '是否强制', type: '逻辑型', defaultValue: '假' }],
        statements: []
      }
    ]
  }
];

function buildContext(overrides?: Partial<BeginnerHoverInfoContext>): BeginnerHoverInfoContext {
  return {
    className: '窗口一',
    method: targetMethod,
    program,
    libraries,
    procedureNames: ['无头就绪', '连接远程'],
    localDeclarations: [
      { name: '操作参数一', line: 5, kind: 'parameter' },
      { name: '新连接', line: 6, kind: 'local' },
      { name: '重试上限', line: 7, kind: 'constant' }
    ],
    globals: [
      { name: '全局开关', type: '逻辑型', line: 2, initialValue: '假', note: '总开关' },
      { name: '缓冲区', type: '字节集', line: 3, isArray: true }
    ],
    constants: [{ name: '最大重试次数', type: '整数型', value: '99', origin: '项目常量' as const }],
    commandNames: new Set(['CDP_连接']),
    resolveCommandHint: name => name === 'CDP_连接'
      ? {
        signature: 'CDP连接 CDP_连接(文本型 连接地址, 逻辑型 无头模式)',
        returnType: 'CDP连接',
        summary: '建立 CDP 连接，返回连接句柄；句柄判有效只用 != 0。'
      }
      : undefined,
    ...overrides
  };
}

test('以截图语句为例：局部变量/模块命令/参数/&处理器四类悬停全部命中', () => {
  const source = '新连接 = CDP_连接(操作参数一, &无头就绪)';

  const local = getBeginnerHoverInfoAtOffset(source, source.indexOf('新连接') + 1, buildContext());
  assert.equal(local?.kind, 'local');
  assert.equal(local?.name, '新连接');
  assert.equal(local?.type, 'CDP连接');
  assert.equal(local?.detail, '当前连接句柄');
  assert.equal(local?.origin, '局部变量 · 仅当前子程序内有效');
  assert.equal(local?.jumpLabel, 'Ctrl+单击 转到声明');

  const command = getBeginnerHoverInfoAtOffset(source, source.indexOf('CDP_连接') + 4, buildContext());
  assert.equal(command?.kind, 'command');
  assert.equal(command?.name, 'CDP_连接');
  assert.equal(command?.detail, 'CDP连接 CDP_连接(文本型 连接地址, 逻辑型 无头模式)');
  assert.equal(command?.summary, '建立 CDP 连接，返回连接句柄；句柄判有效只用 != 0。');
  assert.equal(command?.origin, '模块命令 · 单击放入光标查看完整说明');

  const parameter = getBeginnerHoverInfoAtOffset(source, source.indexOf('操作参数一') + 2, buildContext());
  assert.equal(parameter?.kind, 'parameter');
  assert.equal(parameter?.name, '操作参数一');
  assert.equal(parameter?.type, '文本型');
  assert.equal(parameter?.detail, '操作说明');
  assert.equal(parameter?.origin, '子程序参数 · 仅当前子程序内有效');

  const handler = getBeginnerHoverInfoAtOffset(source, source.indexOf('无头就绪') + 1, buildContext());
  assert.equal(handler?.kind, 'handler');
  assert.equal(handler?.name, '&无头就绪');
  assert.equal(handler?.type, '空');
  assert.equal(handler?.detail, '参数：无');
  assert.equal(handler?.jumpLabel, 'Ctrl+单击 转到处理器定义');
});

test('子程序调用悬停显示签名/参数表/备注，处理器引用与普通调用区分', () => {
  const source = '计次 = 连接远程("地址", 5000)';
  const info = getBeginnerHoverInfoAtOffset(source, source.indexOf('连接远程') + 1, buildContext());
  assert.equal(info?.kind, 'procedure');
  assert.equal(info?.name, '连接远程');
  assert.equal(info?.type, '整数型');
  assert.equal(info?.detail, '参数：文本型 地址, 整数型 超时');
  assert.equal(info?.origin, '公开 · 静态 · 连接说明');
  assert.equal(info?.jumpLabel, 'Ctrl+单击 转到定义');
});

test('#常量悬停维持原口径；裸同名标识符不显示常量', () => {
  const hash = '计数 = #最大重试次数 + 1';
  const constant = getBeginnerHoverInfoAtOffset(hash, hash.indexOf('最大重试次数') + 1, buildContext());
  assert.equal(constant?.kind, 'constant');
  assert.equal(constant?.name, '#最大重试次数');
  assert.equal(constant?.detail, '值 99');
  assert.equal(constant?.jumpLabel, 'Ctrl+单击 转到声明');

  const bare = '计数 = 最大重试次数';
  assert.equal(getBeginnerHoverInfoAtOffset(bare, bare.indexOf('最大重试次数') + 1, buildContext()), null);
});

test('局部常量、项目全局变量（含数组标记与初始值/备注）悬停', () => {
  const localConstant = getBeginnerHoverInfoAtOffset('总计 = 重试上限 + 1', '总计 = 重试上限'.indexOf('重试上限') + 1, buildContext());
  assert.equal(localConstant?.kind, 'localConstant');
  assert.equal(localConstant?.type, '整数型');
  assert.equal(localConstant?.detail, '初始值 3');
  assert.equal(localConstant?.origin, '局部常量 · 运行时初始化一次后只读');

  const global = getBeginnerHoverInfoAtOffset('全局开关 = 真', '全局开关 = 真'.indexOf('全局开关') + 1, buildContext());
  assert.equal(global?.kind, 'global');
  assert.equal(global?.type, '逻辑型');
  assert.equal(global?.detail, '初始值 假 · 总开关');
  assert.equal(global?.origin, '项目全局变量 · 项目全局变量.lcpp · 全项目读写');

  const arrayGlobal = getBeginnerHoverInfoAtOffset('读出数据(缓冲区)', '读出数据(缓冲区)'.indexOf('缓冲区') + 1, buildContext());
  assert.equal(arrayGlobal?.kind, 'global');
  assert.equal(arrayGlobal?.type, '字节集 · 数组');
});

test('功能库限定调用：库名与功能名段都命中，显示签名与库路径', () => {
  const source = '如果 (参数准备库.准备连接地址(真) == 假)';
  for (const offset of [source.indexOf('参数准备库') + 1, source.indexOf('准备连接地址') + 2]) {
    const info = getBeginnerHoverInfoAtOffset(source, offset, buildContext());
    assert.ok(info, `offset ${offset} 应命中功能库调用`);
    assert.equal(info?.kind, 'library');
    assert.equal(info?.name, '参数准备库.准备连接地址');
    assert.equal(info?.type, '逻辑型');
    assert.equal(info?.detail, '参数：逻辑型 是否强制');
    assert.match(info?.origin || '', /功能库「参数准备库」公开功能/);
    assert.match(info?.origin || '', /src\/参数准备库\.lcpp$/);
    assert.equal(info?.summary, '对项目公开 · 按是否强制重新准备连接地址');
    assert.equal(info?.jumpLabel, 'Ctrl+单击 转到定义');
  }
});

test('功能库备注兜底：前置注释缺失时与编辑器表格同口径（可复用功能代码）', () => {
  const source = '工作台状态库.记录连接(浏览器)';
  const noNoteLibraries = [{
    name: '工作台状态库',
    filePath: 'src/功能库/工作台状态库.lcpp',
    line: 1,
    methods: [
      {
        name: '记录连接',
        returnType: '空',
        access: '公开' as const,
        kind: 'method' as const,
        line: 2,
        parameters: [{ name: '浏览器', type: '整数型' }],
        statements: []
      }
    ]
  }];
  const info = getBeginnerHoverInfoAtOffset(source, source.indexOf('记录连接') + 1, buildContext({ libraries: noNoteLibraries }));
  assert.equal(info?.kind, 'library');
  assert.equal(info?.summary, '对项目公开 · 可复用功能代码');
  const privateInfo = getBeginnerHoverInfoAtOffset(source, source.indexOf('记录连接') + 1, buildContext({
    libraries: [{ ...noNoteLibraries[0], methods: [{ ...noNoteLibraries[0].methods[0], access: '私有' as const }] }]
  }));
  assert.equal(privateInfo?.summary, '仅功能库内部 · 可复用功能代码');
});

test('命令识别边界：字符串/注释/@行/文本块/#前缀/成员访问后不命中', () => {
  const context = buildContext();
  const inString = '调试输出("CDP_连接")';
  assert.equal(getBeginnerHoverInfoAtOffset(inString, inString.indexOf('CDP_连接') + 2, context), null);
  const inComment = '// CDP_连接 说明';
  assert.equal(getBeginnerHoverInfoAtOffset(inComment, inComment.indexOf('CDP_连接') + 2, context), null);
  const atLine = '@ CDP_连接(1)';
  assert.equal(getBeginnerHoverInfoAtOffset(atLine, atLine.indexOf('CDP_连接') + 2, context), null);
  const textBlock = ['提示 = """', 'CDP_连接', '"""'].join('\n');
  assert.equal(getBeginnerHoverInfoAtOffset(textBlock, textBlock.indexOf('CDP_连接') + 2, context), null);
  const hashPrefixed = '键码 = #CDP_连接';
  assert.equal(getBeginnerHoverInfoAtOffset(hashPrefixed, hashPrefixed.indexOf('CDP_连接') + 2, context), null);
  const afterDot = '参数准备库.CDP_连接(1)';
  assert.equal(getBeginnerHoverInfoAtOffset(afterDot, afterDot.indexOf('CDP_连接') + 2, context), null);
});

test('控件引用链尾兜底：其余类别都不命中时显示控件信息', () => {
  const source = '控件_设置文本(状态标签, "完成")';
  const info = getBeginnerHoverInfoAtOffset(source, source.indexOf('状态标签') + 1, buildContext({
    resolveControl: identifier => identifier.name === '状态标签'
      ? { name: '状态标签', controlType: 'Edit', windowName: '窗口一', kind: 'visual' }
      : undefined
  }));
  assert.equal(info?.kind, 'control');
  assert.equal(info?.name, '状态标签');
  assert.equal(info?.type, 'Edit');
  assert.equal(info?.origin, '窗口「窗口一」控件');
  assert.equal(info?.jumpLabel, 'Ctrl+单击 打开设计器并定位');
});

test('同名遮蔽：局部变量优先于同名的全局变量与模块命令', () => {
  const shadowedContext = buildContext({
    method: {
      ...targetMethod,
      locals: [...targetMethod.locals, { name: '缓冲区', type: '文本型', line: 8 }]
    },
    localDeclarations: [...buildContext().localDeclarations, { name: '缓冲区', line: 8, kind: 'local' }]
  });
  const info = getBeginnerHoverInfoAtOffset('读出数据(缓冲区)', '读出数据(缓冲区)'.indexOf('缓冲区') + 1, shadowedContext);
  assert.equal(info?.kind, 'local');
  assert.equal(info?.type, '文本型');
});

test('命令摘要超长按 120 字符截断加省略号', () => {
  const source = 'CDP_连接("地址", 假)';
  const info = getBeginnerHoverInfoAtOffset(source, source.indexOf('CDP_连接') + 2, buildContext({
    resolveCommandHint: () => ({ summary: '长'.repeat(200) })
  }));
  assert.equal(info?.summary?.length, 121);
  assert.ok(info?.summary?.endsWith('…'));
});

test('悬停点不在标识符上、或标识符不属于任何类别时返回 null', () => {
  const source = '新连接 = CDP_连接(操作参数一)';
  assert.equal(getBeginnerHoverInfoAtOffset(source, source.indexOf('='), buildContext()), null);
  assert.equal(getBeginnerHoverInfoAtOffset('调试输出(未知名字)', '调试输出(未知名字)'.indexOf('未知名字') + 1, buildContext()), null);
});

test('isSameBeginnerHoverInfo：同符号同内容为真，任一变化为假', () => {
  const context = buildContext();
  const source = '新连接 = CDP_连接(操作参数一)';
  const first = getBeginnerHoverInfoAtOffset(source, source.indexOf('新连接') + 1, context);
  const second = getBeginnerHoverInfoAtOffset(source, source.indexOf('新连接') + 2, context);
  assert.ok(first && second);
  assert.equal(isSameBeginnerHoverInfo(first, second), true);
  const command = getBeginnerHoverInfoAtOffset(source, source.indexOf('CDP_连接') + 2, context);
  assert.ok(command);
  assert.equal(isSameBeginnerHoverInfo(first, command), false);
});

const typeHoverContext = {
  projectTypes: [
    {
      name: '页面快照',
      line: 3,
      note: '一次事件快照的可读结构',
      fields: [
        { name: '页码', type: '整数型', line: 4 },
        { name: '标题', type: '文本型', line: 5 },
        { name: '地址列表', type: '文本型', line: 6, isArray: true }
      ]
    }
  ],
  moduleTypes: [
    {
      name: 'CDP页面',
      description: '从属于某个 CDP 连接的受管页面会话 ID，对应一个 flatten 模式 sessionId。',
      moduleName: 'CDP 客户端',
      kind: 'opaque' as const
    },
    {
      name: '模块记录',
      moduleName: '演示模块',
      kind: 'record' as const,
      fields: [{ name: '字段一', type: '文本型' }],
      elementType: undefined
    }
  ]
};

test('类型悬停：模块公开类型显示描述与来源，项目数据类型显示字段表', () => {
  const moduleType = getBeginnerTypeHoverInfo('CDP页面', typeHoverContext);
  assert.equal(moduleType?.kind, 'moduleType');
  assert.equal(moduleType?.name, 'CDP页面');
  assert.match(moduleType?.detail || '', /受管页面会话 ID/);
  assert.equal(moduleType?.origin, '模块「CDP 客户端」公开类型 · 句柄类型');

  const recordType = getBeginnerTypeHoverInfo('模块记录', typeHoverContext);
  assert.equal(recordType?.origin, '模块「演示模块」公开类型 · 记录类型（值语义）');

  const projectType = getBeginnerTypeHoverInfo('页面快照', typeHoverContext);
  assert.equal(projectType?.kind, 'dataType');
  assert.equal(projectType?.detail, '字段：页码 整数型 · 标题 文本型 · 地址列表 文本型[]');
  assert.equal(projectType?.origin, '项目数据类型 · 项目数据类型.lcpp · 一次事件快照的可读结构');
});

test('类型悬停：基础类型带说明、数组后缀剥除、未知引导、空不出泡', () => {
  const basic = getBeginnerTypeHoverInfo('整数型', typeHoverContext);
  assert.equal(basic?.kind, 'basicType');
  assert.match(basic?.detail || '', /32 位有符号整数/);
  assert.equal(getBeginnerTypeHoverInfo('空', typeHoverContext)?.kind, 'basicType');

  const arraySuffix = getBeginnerTypeHoverInfo('文本型[]', typeHoverContext);
  assert.equal(arraySuffix?.kind, 'basicType');
  assert.equal(arraySuffix?.name, '文本型');

  const unknown = getBeginnerTypeHoverInfo('CDP面', typeHoverContext);
  assert.equal(unknown?.kind, 'unknownType');
  assert.match(unknown?.detail || '', /支持中文、英文和拼音简写/);

  assert.equal(getBeginnerTypeHoverInfo('   ', typeHoverContext), null);
});

test('代码链类型兜底：命中已识别类型、未识别标识符不误报', () => {
  const context = buildContext({ types: typeHoverContext });
  const source = '局部 CDP页面 新页面 = 0';
  const info = getBeginnerHoverInfoAtOffset(source, source.indexOf('CDP页面') + 2, context);
  assert.equal(info?.kind, 'moduleType');
  assert.equal(info?.name, 'CDP页面');

  const unknownInCode = getBeginnerHoverInfoAtOffset('调试输出(某个未识别名字)', '调试输出(某个未识别名字)'.indexOf('某个未识别名字') + 2, context);
  assert.notEqual(unknownInCode?.kind, 'unknownType');
});
