import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_GRID_API } from '../src/services/modules/dataGridApiCatalog';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const modelPath = path.join(repoRoot, '.lingbuilder', 'projects', 'datagrid-api-demo', 'window-designer.json');
const sourcePath = path.join(repoRoot, 'src', 'datagrid-api-demo', 'MainWindow.lcpp');

const eventOnlyCommands = new Set([
  '表格_拒绝本次编辑',
  '表格_取事件行键',
  '表格_取事件列ID',
  '表格_取事件按钮ID',
  '表格_取事件旧值',
  '表格_取事件新值'
]);

const groups = [
  { id: 'columns', title: '1 列管理', start: 0, end: 11, note: '建议从左到右按编号体验。删除演示列前，请先点击“添加列”。' },
  { id: 'special', title: '2 特殊列', start: 11, end: 20, note: '配置组合框、选择框、Switch、图片、进度和多按钮列。' },
  { id: 'rows-import', title: '3 行与导入', start: 20, end: 34, note: '包含行操作、批量更新、TSV、CSV 和 Excel。破坏性操作后可重新按 F5。' },
  { id: 'typed-cells', title: '4 基础单元格', start: 34, end: 44, note: '每个按钮只读写一个强类型单元格接口，固定演示行键为 order-1001。' },
  { id: 'rich-cells', title: '5 特殊单元格', start: 44, end: 58, note: '分别体验图片、进度、组合框和多按钮单元格覆盖。' },
  { id: 'editing', title: '6 编辑选择', start: 58, end: 70, note: '开始、提交、取消编辑以及当前单元格、行选择、撤销和重做均为独立按钮。' },
  { id: 'query', title: '7 排序筛选', start: 70, end: 77, note: '排序、筛选和搜索会立即反映在左侧静态表格中。' },
  { id: 'validation-virtual', title: '8 校验虚拟', start: 77, end: 86, note: '校验拒绝只能在“正在验证”事件中调用；虚拟请求由下方表格滚动触发。' },
  { id: 'events', title: '9 事件上下文', start: 86, end: 92, note: '事件上下文接口只能在表格事件处理器中读取；请按页面提示操作左侧表格。' }
];

function createControlBase(id: string, type: string, name: string, content: string, x: number, y: number, width: number, height: number) {
  return {
    id, type, name, content, x, y, width, height,
    fontSize: 12,
    fontFamily: 'Microsoft YaHei UI',
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,
    background: '#1E293B',
    foreground: '#F8FAFC',
    isEnabled: true,
    visibility: 'Visible'
  };
}

function handlerName(index: number, command: string): string {
  return `_接口${String(index + 1).padStart(2, '0')}_${command.slice(3)}_被单击`;
}

function demoColumn(command: string): string {
  if (/图片/u.test(command)) return 'image';
  if (/进度/u.test(command)) return 'progress';
  if (/组合框|选项/u.test(command)) return 'status';
  if (/按钮/u.test(command)) return 'actions';
  if (/选择框/u.test(command)) return 'select';
  if (/开关|逻辑/u.test(command)) return 'enabled';
  if (/日期/u.test(command)) return 'date';
  if (/整数/u.test(command)) return 'quantity';
  if (/小数|数值范围/u.test(command)) return 'amount';
  if (/格式|排序/u.test(command)) return 'amount';
  if (/筛选/u.test(command)) return 'status';
  return 'order_no';
}

function quote(value: string): string {
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/\n/gu, '\\n').replace(/\t/gu, '\\t')}"`;
}

function demoArgument(command: string, parameter: { name: string; type: string }): string {
  const virtual = /虚拟|请求/u.test(command);
  const values: Record<string, string> = {
    控件名: quote(virtual ? '虚拟表格' : '静态表格'),
    行键: quote('order-1001'),
    列ID: quote(demoColumn(command)),
    标题: quote('演示标题'),
    类型: quote('text'),
    对齐方式: quote('center'),
    格式: quote('0.00'),
    值: quote(/筛选/u.test(command) ? 'processing' : 'demo'),
    显示文字: quote('演示选项'),
    选项TSV: quote('processing\t处理中\ndone\t已完成'),
    开启文字: quote('启用'),
    关闭文字: quote('停用'),
    显示方式: quote('contain'),
    按钮ID: quote('view'),
    文字: quote('演示文字'),
    样式: quote('primary'),
    单元格TSV: quote('0\t2001\t5\t88.80\t2026-08-10\t1\t\t45\tnew\t'),
    TSV文本: quote('选择\t订单号\t数量\t金额\t日期\t启用\t图片\t进度\t状态\t操作\n1\t3001\t2\t66.60\t2026-08-12\t1\t\t50\tnew\t'),
    CSV文本: quote('选择,订单号,数量,金额,日期,启用,图片,进度,状态,操作\n1,3002,3,99.90,2026-08-13,1,,75,processing,'),
    文件路径: quote('DataGrid导出示例.xlsx'),
    文本: quote('1001-A'),
    日期: quote('2026-08-08'),
    项目路径: quote('assets/datagrid-api-demo/datagrid-demo.png'),
    图像列表ID: 'DataGrid示例图像列表',
    状态: quote('success'),
    规则: quote('equals'),
    搜索文字: quote('1002'),
    正则表达式: quote('^[0-9]{4,8}$'),
    原因: quote('新手示例拒绝了本次编辑。')
  };
  if (values[parameter.name]) return values[parameter.name];
  if (parameter.type === 'bool') return '真';
  if (parameter.type === 'double') return parameter.name === '最大值' ? '100.0' : parameter.name === '进度' ? '42.5' : '0.0';
  if (parameter.type === 'int' || parameter.type === 'longLong' || parameter.type === 'handle') {
    if (parameter.name === '宽度') return '120';
    if (parameter.name === '行数') return '1000000';
    if (parameter.name === '图片索引') return '0';
    if (parameter.name === '数量') return '3';
    return '0';
  }
  return quote('演示值');
}

async function main() {
  const project = JSON.parse(await fs.readFile(modelPath, 'utf8')) as any;
  const oldWindow = project.windows[0];
  const oldStaticGrid = oldWindow.controls.find((control: any) => control.name === '静态表格');
  const oldVirtualGrid = oldWindow.controls.find((control: any) => control.name === '虚拟表格');
  if (!oldStaticGrid || !oldVirtualGrid) throw new Error('缺少静态表格或虚拟表格。');

  const invocationOverrides: Record<string, string> = {
    表格_添加列: '表格_添加列(静态表格, "demo-column", "演示列", "text", 110)',
    表格_插入列: '表格_插入列(静态表格, 1, "demo-insert-column", "插入演示列", "text", 120)',
    表格_删除列: '表格_删除列(静态表格, "demo-column")',
    表格_设置列标题: '表格_设置列标题(静态表格, "order_no", "订单编号")',
    表格_设置列宽度: '表格_设置列宽度(静态表格, "order_no", 150)',
    表格_设置列对齐: '表格_设置列对齐(静态表格, "order_no", "left")',
    表格_设置列只读: '表格_设置列只读(静态表格, "order_no", 真)',
    表格_设置列显示: '表格_设置列显示(静态表格, "date", 假)',
    表格_添加列选项: '表格_添加列选项(静态表格, "status", "waiting", "待处理")',
    表格_添加列按钮: '表格_添加列按钮(静态表格, "actions", "print", "打印", "normal")',
    表格_添加行: '表格_添加行(静态表格, "demo-row", "0\\t2001\\t5\\t88.80\\t2026-08-10\\t1\\tassets/datagrid-api-demo/datagrid-demo.png\\t45\\tnew\\t")',
    表格_插入行: '表格_插入行(静态表格, 1, "demo-insert-row", "0\\t2002\\t1\\t19.90\\t2026-08-11\\t1\\t\\t20\\tprocessing\\t")',
    表格_删除行: '表格_删除行(静态表格, "demo-row")',
    表格_加载TSV: '表格_加载TSV(静态表格, "选择\\t订单号\\t数量\\t金额\\t日期\\t启用\\t图片\\t进度\\t状态\\t操作\\n1\\t3001\\t2\\t66.60\\t2026-08-12\\t1\\t\\t50\\tnew\\t", 真)',
    表格_导入CSV: '表格_导入CSV(静态表格, "选择,订单号,数量,金额,日期,启用,图片,进度,状态,操作\\n1,3002,3,99.90,2026-08-13,1,,75,processing,", 真)',
    表格_提交虚拟行: '表格_提交虚拟行(虚拟表格, 0, "virtual-demo-0", "1\\t手动提交的虚拟行\\t50\\tprocessing")'
  };
  const invocations = new Map(DATA_GRID_API.map(api => [
    api.name,
    invocationOverrides[api.name] || `${api.name}(${api.parameters.map(parameter => demoArgument(api.name, parameter)).join(', ')})`
  ]));

  const controls: any[] = [];
  controls.push({
    ...createControlBase('beginner-title', 'Label', '新手标题', 'DataGrid 新手逐项实验室：一个按钮只演示一个接口', 20, 18, 860, 32),
    fontSize: 18, fontBold: true, background: 'transparent', foreground: '#E0F2FE'
  });
  controls.push({
    ...createControlBase('beginner-guide', 'Label', '新手说明', '先观察表格初始数据，再在右侧选项卡逐个点击。若执行了删除、清空或导入，请按 F5 重新开始。', 20, 50, 860, 22),
    background: 'transparent', foreground: '#94A3B8'
  });
  controls.push({ ...oldStaticGrid, x: 20, y: 80, width: 860, height: 430 });
  controls.push({
    ...createControlBase('virtual-title', 'Label', '虚拟表格标题', '虚拟数据表格：滚动时触发“请求虚拟数据”事件', 20, 520, 860, 24),
    fontSize: 14, fontBold: true, background: 'transparent', foreground: '#67E8F9'
  });
  controls.push({ ...oldVirtualGrid, x: 20, y: 550, width: 860, height: 190 });
  controls.push({
    ...createControlBase('operation-result', 'Label', '操作结果', '操作结果：尚未点击接口按钮。返回值同时写入底部“输出”面板。', 20, 755, 860, 24),
    background: '#172033', foreground: '#A7F3D0'
  });
  controls.push({
    ...createControlBase('event-result', 'Label', '事件日志', '事件日志：单击、双击、编辑、组合框、Switch、图片或按钮后会显示上下文。', 20, 785, 860, 24),
    background: '#172033', foreground: '#7DD3FC'
  });

  const tabX = 900;
  const tabY = 20;
  const tabs = groups.map((group, index) => ({ id: `api-page-${index + 1}`, title: group.title, image: -1 }));
  controls.push({
    ...createControlBase('api-tabs', 'TabControl', '接口分类选项卡', '', tabX, tabY, 620, 790),
    background: '#111827', foreground: '#F8FAFC',
    properties: { tabs, items: tabs.map(tab => tab.title), selectedIndex: 0, hideHeader: false },
    events: {}
  });

  groups.forEach((group, groupIndex) => {
    const pageId = `api-page-${groupIndex + 1}`;
    controls.push({
      ...createControlBase(`page-note-${group.id}`, 'Label', `${group.title}说明`, group.note, tabX + 18, tabY + 56, 580, 38),
      parentId: 'api-tabs', containerSlot: pageId, background: 'transparent', foreground: '#BAE6FD', fontSize: 11
    });
    const pageApis = DATA_GRID_API.slice(group.start, group.end);
    const directApis = pageApis.filter(api => !eventOnlyCommands.has(api.name));
    directApis.forEach((api, pageIndex) => {
      const apiIndex = DATA_GRID_API.indexOf(api);
      const column = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);
      const destructive = /删除|清空|导入|加载/u.test(api.name);
      controls.push({
        ...createControlBase(
          `api-button-${String(apiIndex + 1).padStart(3, '0')}`,
          'Button',
          `接口${String(apiIndex + 1).padStart(2, '0')}_${api.name.slice(3)}`,
          `${String(apiIndex + 1).padStart(2, '0')}  ${api.name}`,
          tabX + 18 + column * 292,
          tabY + 105 + row * 46,
          276,
          34
        ),
        parentId: 'api-tabs', containerSlot: pageId,
        background: destructive ? '#B45309' : column === 0 ? '#2563EB' : '#0E7490',
        properties: { buttonStyle: 'push', cornerRadius: 6, toolTip: `${api.signature}\n${api.description}`, toolTipDelay: 250 },
        events: { Click: handlerName(apiIndex, api.name) }
      });
    });
    if (group.id === 'events') {
      const eventCards = [
        '86 取事件行键：单击表格行或改变当前单元格时读取。',
        '87 取事件列ID：单击、排序或筛选列时读取。',
        '88 取事件按钮ID：点击“操作”列中的按钮时读取。',
        '89 取事件旧值：开始编辑或提交编辑时读取。',
        '90 取事件新值：提交、Switch、组合框改变时读取。',
        '80 拒绝本次编辑：把订单号改成“禁止”即可触发。'
      ];
      eventCards.forEach((content, index) => controls.push({
        ...createControlBase(`event-card-${index + 1}`, 'Label', `事件说明${index + 1}`, content, tabX + 24, tabY + 165 + index * 52, 560, 38),
        parentId: 'api-tabs', containerSlot: pageId, background: '#1E293B', foreground: '#E2E8F0'
      }));
    }
  });

  const staticEvents = {
    CurrentCellChanged: '_静态表格_当前单元格被改变',
    SelectionRangeChanged: '_静态表格_选择区域被改变',
    CellClick: '_静态表格_单元格被单击',
    CellDoubleClick: '_静态表格_单元格被双击',
    EditStarting: '_静态表格_开始编辑',
    Validating: '_静态表格_正在验证',
    EditCommitted: '_静态表格_编辑已提交',
    EditCancelled: '_静态表格_编辑已取消',
    CheckBoxChanged: '_静态表格_选择框被改变',
    SwitchChanged: '_静态表格_开关被改变',
    ComboChanged: '_静态表格_组合框被改变',
    CellButtonClick: '_静态表格_单元格按钮被单击',
    CellImageClick: '_静态表格_单元格图片被单击',
    SortChanged: '_静态表格_排序被改变',
    FilterChanged: '_静态表格_筛选被改变'
  };
  controls.find(control => control.name === '静态表格').events = staticEvents;
  controls.find(control => control.name === '虚拟表格').events = { VirtualDataRequested: '_虚拟表格_请求虚拟数据' };

  project.windows = [{
    ...oldWindow,
    title: 'Win32 DataGrid 新手逐项实验室（92 条接口）',
    width: 1550,
    height: 860,
    description: '使用 9 个选项卡逐项演示 DataGrid；每个普通接口按钮只调用一条表格命令。',
    controls
  }];

  const directHandlers = DATA_GRID_API
    .map((api, index) => ({ api, index }))
    .filter(({ api }) => !eventOnlyCommands.has(api.name))
    .map(({ api, index }) => [
      `    // ${String(index + 1).padStart(2, '0')}. ${api.signature}`,
      `    // ${api.description}`,
      `    事件 ${handlerName(index, api.name)}()`,
      `        调试输出("${api.name} 返回值：", ${invocations.get(api.name)}, 真)`,
      `        控件_设置文本(操作结果, "已单独执行 ${String(index + 1).padStart(2, '0')}：${api.name}；返回值见输出面板。")`,
      '    结束'
    ].join('\n'));

  const source = [
    '包 DataGrid新手逐项示例',
    '使用 Win32窗口基础模块',
    '使用 Win32高级控件模块',
    '',
    '类 MainWindow : 公开 窗体',
    '    // 初始列和三行示例数据来自设计器模型，因此启动时不需要批量调用表格接口。',
    '    事件 _MainWindow_创建完毕()',
    '        控件_设置文本(操作结果, "操作结果：请选择右侧选项卡，每个按钮只执行一条 DataGrid 接口。")',
    '        控件_设置文本(事件日志, "事件日志：请直接单击、双击或编辑左侧表格。")',
    '    结束',
    '',
    ...directHandlers.flatMap(handler => [handler, '']),
    '    // 以下是事件专用接口示例。事件上下文必须在对应事件处理器中读取。',
    '    事件 _静态表格_当前单元格被改变()',
    '        控件_设置文本(事件日志, 表格_取事件行键(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_选择区域被改变()',
    '        控件_设置文本(事件日志, 表格_取事件行键(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_单元格被单击()',
    '        控件_设置文本(事件日志, 表格_取事件列ID(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_单元格被双击()',
    '        调试输出("双击行键：", 表格_取事件行键(静态表格), 真)',
    '    结束',
    '',
    '    事件 _静态表格_开始编辑()',
    '        控件_设置文本(事件日志, 表格_取事件旧值(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_正在验证()',
    '        如果 (表格_取事件新值(静态表格) == "禁止")',
    '            表格_拒绝本次编辑(静态表格, "新手示例：订单号不允许填写“禁止”。")',
    '        如果结束',
    '    结束',
    '',
    '    事件 _静态表格_编辑已提交()',
    '        控件_设置文本(事件日志, 表格_取事件新值(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_编辑已取消()',
    '        调试输出("取消编辑行键：", 表格_取事件行键(静态表格), 真)',
    '    结束',
    '',
    '    事件 _静态表格_选择框被改变()',
    '        调试输出("选择框所在行：", 表格_取事件行键(静态表格), 真)',
    '    结束',
    '',
    '    事件 _静态表格_开关被改变()',
    '        控件_设置文本(事件日志, 表格_取事件新值(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_组合框被改变()',
    '        控件_设置文本(事件日志, 表格_取事件新值(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_单元格按钮被单击()',
    '        控件_设置文本(事件日志, 表格_取事件按钮ID(静态表格))',
    '    结束',
    '',
    '    事件 _静态表格_单元格图片被单击()',
    '        调试输出("图片所在行：", 表格_取事件行键(静态表格), 真)',
    '    结束',
    '',
    '    事件 _静态表格_排序被改变()',
    '        调试输出("排序列：", 表格_取事件列ID(静态表格), 真)',
    '    结束',
    '',
    '    事件 _静态表格_筛选被改变()',
    '        调试输出("筛选列：", 表格_取事件列ID(静态表格), 真)',
    '    结束',
    '',
    '    // 虚拟数据回调是一个完整生命周期：先读取请求范围，再逐行提交可见数据。',
    '    事件 _虚拟表格_请求虚拟数据()',
    '        局部 整数型 起始行 = 0',
    '        局部 整数型 请求数量 = 0',
    '        局部 整数型 i = 0',
    '        局部 整数型 数据索引 = 0',
    '        局部 文本型 虚拟行键 = ""',
    '        局部 文本型 虚拟行内容 = ""',
    '        局部 文本型 索引文本 = ""',
    '        局部 文本型 进度文本 = ""',
    '        起始行 = 表格_取请求起始行(虚拟表格)',
    '        请求数量 = 表格_取请求数量(虚拟表格)',
    '        计次循环首 (请求数量, i)',
    '            数据索引 = 起始行 + i - 1',
    '            索引文本 = 到文本(数据索引)',
    '            进度文本 = 到文本(数据索引 % 101)',
    '            虚拟行键 = "virtual-"',
    '            虚拟行键 = 虚拟行键 + 索引文本',
    '            虚拟行内容 = 到文本(数据索引 + 1)',
    '            虚拟行内容 = 虚拟行内容 + "\\t虚拟数据 "',
    '            虚拟行内容 = 虚拟行内容 + 索引文本 + "\\t" + 进度文本 + "\\tprocessing"',
    '            表格_提交虚拟行(虚拟表格, 数据索引, 虚拟行键, 虚拟行内容)',
    '        计次循环尾 ()',
    '    结束',
    '结束类',
    ''
  ].join('\n');

  await fs.writeFile(modelPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  await fs.writeFile(sourcePath, source, 'utf8');
  console.log(JSON.stringify({ apiCount: DATA_GRID_API.length, directButtonCount: controls.filter(control => control.type === 'Button').length, tabCount: tabs.length, controlCount: controls.length }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
