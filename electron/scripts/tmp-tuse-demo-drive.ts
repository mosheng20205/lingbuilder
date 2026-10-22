/**
 * 图色识别演示工程（tuse-demo）驱动脚本：经仓库最新 dist/cli.cjs stdio 会话
 * 完成 建项目 → 应用设计器布局与源码 → 诊断 → 构建 四个阶段。
 *
 * 用法：npx tsx scripts/tmp-tuse-demo-drive.ts <create|apply|build>
 * 背景：已安装版应用内桥是旧 bundle（识图 1.0.0/7 条），必须用仓库新 bundle 驱动 1.1.0 命令。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = 'T:\\electron\\lingbuilder';
const CLI_BUNDLE = path.join(WORKSPACE_ROOT, 'electron', 'dist', 'cli.cjs');
const PROJECT_ID = 'tuse-demo';
const SOURCE_REL = 'src/tuse-demo/MainWindow.lcpp';
const DESIGNER_REL = '.lingbuilder/projects/tuse-demo/window-designer.json';

type JsonRecord = Record<string, unknown>;

interface PendingCall {
  resolve: (value: JsonRecord) => void;
  reject: (reason: Error) => void;
}

const CONTROLS: JsonRecord[] = [];

function control(overrides: JsonRecord): JsonRecord {
  return {
    content: '',
    events: {},
    fontBold: false,
    fontFamily: 'Microsoft YaHei UI',
    fontItalic: false,
    fontSize: 12,
    fontUnderline: false,
    height: 28,
    id: '',
    isEnabled: true,
    name: '',
    properties: {},
    type: 'Label',
    visibility: 'Visible',
    width: 100,
    x: 0,
    y: 0,
    ...overrides
  };
}

function buildControls(): JsonRecord[] {
  return [
    control({ type: 'Label', id: 'target-label', name: '目标标签', content: '目标图片：', foreground: '#DCDCDC', x: 16, y: 18, width: 76, height: 24 }),
    control({
      type: 'Button', id: 'pick-target-btn', name: '选目标按钮', content: '选择目标图片…',
      x: 96, y: 12, width: 124, height: 32, background: '#007ACC', foreground: '#FFFFFF',
      events: { Click: '_选目标按钮_被单击' }
    }),
    control({ type: 'TextBox', id: 'target-path-edit', name: '目标路径框', x: 16, y: 52, width: 334, height: 26, foreground: '#DCDCDC', properties: { readOnly: true } }),
    control({ type: 'Image', id: 'target-preview', name: '目标预览', x: 16, y: 86, width: 334, height: 148, properties: { imageSource: '', stretch: 'uniform' } }),

    control({ type: 'Label', id: 'template-label', name: '模板标签', content: '模板图片：', foreground: '#DCDCDC', x: 370, y: 18, width: 76, height: 24 }),
    control({
      type: 'Button', id: 'pick-template-btn', name: '选模板按钮', content: '选择模板图片…',
      x: 450, y: 12, width: 124, height: 32, background: '#007ACC', foreground: '#FFFFFF',
      events: { Click: '_选模板按钮_被单击' }
    }),
    control({ type: 'TextBox', id: 'template-path-edit', name: '模板路径框', x: 370, y: 52, width: 334, height: 26, foreground: '#DCDCDC', properties: { readOnly: true } }),
    control({ type: 'Image', id: 'template-preview', name: '模板预览', x: 370, y: 86, width: 334, height: 148, properties: { imageSource: '', stretch: 'uniform' } }),

    control({ type: 'Label', id: 'tolerance-label', name: '容差标签', content: '匹配容差：', foreground: '#DCDCDC', x: 16, y: 248, width: 76, height: 24 }),
    control({ type: 'TextBox', id: 'tolerance-edit', name: '容差框', content: '30', x: 96, y: 244, width: 56, height: 28, foreground: '#DCDCDC', properties: { numeric: true } }),
    control({ type: 'Label', id: 'color-label', name: '找色标签', content: '找色 R/G/B：', foreground: '#DCDCDC', x: 176, y: 248, width: 110, height: 24 }),
    control({ type: 'TextBox', id: 'red-edit', name: '红色框', content: '255', x: 290, y: 244, width: 46, height: 28, foreground: '#DCDCDC', properties: { numeric: true } }),
    control({ type: 'TextBox', id: 'green-edit', name: '绿色框', content: '0', x: 342, y: 244, width: 46, height: 28, foreground: '#DCDCDC', properties: { numeric: true } }),
    control({ type: 'TextBox', id: 'blue-edit', name: '蓝色框', content: '0', x: 394, y: 244, width: 46, height: 28, foreground: '#DCDCDC', properties: { numeric: true } }),
    control({
      type: 'Button', id: 'find-one-btn', name: '找图按钮', content: '找图',
      x: 476, y: 242, width: 70, height: 32, background: '#0E7A4D', foreground: '#FFFFFF',
      events: { Click: '_找图按钮_被单击' }
    }),
    control({
      type: 'Button', id: 'find-all-btn', name: '找全部按钮', content: '找全部',
      x: 552, y: 242, width: 74, height: 32, background: '#0E7A4D', foreground: '#FFFFFF',
      events: { Click: '_找全部按钮_被单击' }
    }),
    control({
      type: 'Button', id: 'find-color-btn', name: '找色按钮', content: '找色',
      x: 632, y: 242, width: 72, height: 32, background: '#0E7A4D', foreground: '#FFFFFF',
      events: { Click: '_找色按钮_被单击' }
    }),

    control({ type: 'Label', id: 'result-label', name: '结果标签', content: '识别结果（含耗时）：', foreground: '#DCDCDC', x: 16, y: 288, width: 190, height: 24 }),
    control({
      type: 'Button', id: 'clear-btn', name: '清空按钮', content: '清空结果',
      x: 628, y: 284, width: 76, height: 30, background: '#5A5A5A', foreground: '#FFFFFF',
      events: { Click: '_清空按钮_被单击' }
    }),
    control({
      type: 'TextBox', id: 'result-edit', name: '结果区', x: 16, y: 316, width: 688, height: 160,
      background: '#1E1E1E', foreground: '#DCDCDC',
      properties: { multiline: true, readOnly: true, scrollBars: 'vertical' }
    })
  ];
}

function fileDialog(dialogId: string, name: string, title: string, ownerWindowId: string, selectedHandler: string, cancelledHandler: string): JsonRecord {
  return {
    id: dialogId,
    type: 'FileDialog',
    name,
    ownerWindowId,
    title,
    filter: '图片文件|*.png;*.jpg;*.jpeg;*.bmp|所有文件|*.*',
    multiple: false,
    allowDrop: false,
    triggerControlId: '',
    dropTargetId: '',
    filesSelectedHandler: selectedHandler,
    cancelledHandler
  };
}

const LCPP_SOURCE = [
  '类 MainWindow',
  '    // 图色识别演示：选一张目标大图 + 一张小模板图，实时显示找图/找色耗时（毫秒）与命中坐标。',
  '    // 识图命令同步执行，正常图片毫秒级返回；计时用 @ 行直调 Win32 GetTickCount64。',
  '    文本型 目标图片路径 = ""',
  '    文本型 模板图片路径 = ""',
  '',
  '    事件 _MainWindow_创建完毕()',
  '        控件_设置文本(结果区, "就绪：请先分别选择目标图片与模板图片，再点「找图 / 找全部 / 找色」。每次识别都会显示耗时（毫秒）与命中坐标。")',
  '    结束',
  '',
  '    事件 _选目标按钮_被单击()',
  '        文件对话框_打开(文件对话框1)',
  '    结束',
  '',
  '    事件 _选模板按钮_被单击()',
  '        文件对话框_打开(文件对话框2)',
  '    结束',
  '',
  '    事件 _文件对话框1_文件已选择()',
  '        如果 (文件对话框_取文件数量(文件对话框1) > 0)',
  '            目标图片路径 = 文件对话框_取文件(文件对话框1, 0)',
  '            控件_设置文本(目标路径框, 目标图片路径)',
  '            控件_设置图片(目标预览, 目标图片路径)',
  '            追加结果("目标图片已选择：" + 目标图片路径)',
  '        如果结束',
  '    结束',
  '',
  '    事件 _文件对话框1_已取消()',
  '        追加结果("已取消选择目标图片。")',
  '    结束',
  '',
  '    事件 _文件对话框2_文件已选择()',
  '        如果 (文件对话框_取文件数量(文件对话框2) > 0)',
  '            模板图片路径 = 文件对话框_取文件(文件对话框2, 0)',
  '            控件_设置文本(模板路径框, 模板图片路径)',
  '            控件_设置图片(模板预览, 模板图片路径)',
  '            追加结果("模板图片已选择：" + 模板图片路径)',
  '        如果结束',
  '    结束',
  '',
  '    事件 _文件对话框2_已取消()',
  '        追加结果("已取消选择模板图片。")',
  '    结束',
  '',
  '    事件 _找图按钮_被单击()',
  '        局部 文本型 目标路径',
  '        局部 文本型 模板路径',
  '        局部 整数型 容差',
  '        局部 长整数型 开始',
  '        局部 长整数型 耗时',
  '        局部 逻辑型 命中',
  '        局部 整数型 命中横',
  '        局部 整数型 命中纵',
  '        局部 整数型 模板宽',
  '        局部 整数型 模板高',
  '        目标路径 = 目标图片路径',
  '        模板路径 = 模板图片路径',
  '        如果 (目标路径 = "")',
  '            追加结果("找图：请先选择目标图片。")',
  '            返回()',
  '        如果结束',
  '        如果 (模板路径 = "")',
  '            追加结果("找图：请先选择模板图片。")',
  '            返回()',
  '        如果结束',
  '        容差 = 读容差()',
  '        @ 开始 = (long long)GetTickCount64();',
  '        命中 = 识图_模板匹配(目标路径, 模板路径, 容差)',
  '        @ 耗时 = (long long)GetTickCount64() - 开始;',
  '        模板宽 = 图像_取宽度(模板路径)',
  '        模板高 = 图像_取高度(模板路径)',
  '        如果 (命中)',
  '            命中横 = 识图_取结果横坐标()',
  '            命中纵 = 识图_取结果纵坐标()',
  '            追加结果("找图命中：耗时 " + 到文本(耗时) + " 毫秒，左上角 (" + 到文本(命中横) + ", " + 到文本(命中纵) + ")，模板中心 (" + 到文本(命中横 + 模板宽 / 2) + ", " + 到文本(命中纵 + 模板高 / 2) + ")——模拟点击请用中心坐标")',
  '        否则',
  '            追加结果("找图未命中：耗时 " + 到文本(耗时) + " 毫秒，容差 " + 到文本(容差))',
  '        如果结束',
  '    结束',
  '',
  '    事件 _找全部按钮_被单击()',
  '        局部 文本型 目标路径',
  '        局部 文本型 模板路径',
  '        局部 整数型 容差',
  '        局部 长整数型 开始',
  '        局部 长整数型 耗时',
  '        局部 整数型 命中数量',
  '        目标路径 = 目标图片路径',
  '        模板路径 = 模板图片路径',
  '        如果 (目标路径 = "")',
  '            追加结果("找全部：请先选择目标图片。")',
  '            返回()',
  '        如果结束',
  '        如果 (模板路径 = "")',
  '            追加结果("找全部：请先选择模板图片。")',
  '            返回()',
  '        如果结束',
  '        容差 = 读容差()',
  '        @ 开始 = (long long)GetTickCount64();',
  '        命中数量 = 识图_模板匹配全部(目标路径, 模板路径, 容差, 0, 0, 0, 0, 0, 32)',
  '        @ 耗时 = (long long)GetTickCount64() - 开始;',
  '        如果 (命中数量 > 0)',
  '            追加结果("找全部：命中 " + 到文本(命中数量) + " 处，耗时 " + 到文本(耗时) + " 毫秒")',
  '            列出全部命中(命中数量)',
  '        否则',
  '            追加结果("找全部：命中 0 处，耗时 " + 到文本(耗时) + " 毫秒")',
  '        如果结束',
  '    结束',
  '',
  '    事件 _找色按钮_被单击()',
  '        局部 文本型 目标路径',
  '        局部 整数型 容差',
  '        局部 整数型 红色分量',
  '        局部 整数型 绿色分量',
  '        局部 整数型 蓝色分量',
  '        局部 长整数型 透明倍数',
  '        局部 长整数型 颜色值',
  '        局部 长整数型 开始',
  '        局部 长整数型 耗时',
  '        局部 逻辑型 命中',
  '        目标路径 = 目标图片路径',
  '        如果 (目标路径 = "")',
  '            追加结果("找色：请先选择目标图片。")',
  '            返回()',
  '        如果结束',
  '        红色分量 = 到整数(控件_取文本(红色框))',
  '        绿色分量 = 到整数(控件_取文本(绿色框))',
  '        蓝色分量 = 到整数(控件_取文本(蓝色框))',
  '        透明倍数 = 16777216',
  '        颜色值 = 透明倍数 * 255 + 红色分量 * 65536 + 绿色分量 * 256 + 蓝色分量',
  '        容差 = 读容差()',
  '        @ 开始 = (long long)GetTickCount64();',
  '        命中 = 识图_查找颜色(目标路径, 颜色值, 容差)',
  '        @ 耗时 = (long long)GetTickCount64() - 开始;',
  '        如果 (命中)',
  '            追加结果("找色命中：ARGB " + 到文本(颜色值) + "（R=" + 到文本(红色分量) + " G=" + 到文本(绿色分量) + " B=" + 到文本(蓝色分量) + "），耗时 " + 到文本(耗时) + " 毫秒，坐标 (" + 到文本(识图_取结果横坐标()) + ", " + 到文本(识图_取结果纵坐标()) + ")")',
  '        否则',
  '            追加结果("找色未命中：ARGB " + 到文本(颜色值) + "，耗时 " + 到文本(耗时) + " 毫秒")',
  '        如果结束',
  '    结束',
  '',
  '    事件 _清空按钮_被单击()',
  '        控件_设置文本(结果区, "")',
  '    结束',
  '',
  '    整数型 读容差()',
  '        局部 整数型 数值',
  '        数值 = 到整数(控件_取文本(容差框))',
  '        如果 (数值 < 0)',
  '            数值 = 0',
  '        如果结束',
  '        如果 (数值 > 255)',
  '            数值 = 255',
  '        如果结束',
  '        返回(数值)',
  '    结束',
  '',
  '    空 列出全部命中(整数型 命中数量)',
  '        局部 整数型 序号',
  '        计次循环首 (命中数量, 序号)',
  '            追加结果("    第 " + 到文本(序号) + " 处左上角 (" + 到文本(识图_取第N横坐标(序号)) + ", " + 到文本(识图_取第N纵坐标(序号)) + ")")',
  '        计次循环尾',
  '    结束',
  '',
  '    空 追加结果(文本型 新行)',
  '        局部 文本型 当前文本',
  '        当前文本 = 控件_取文本(结果区)',
  '        控件_设置文本(结果区, 当前文本 + 新行 + "\\n")',
  '    结束',
  '结束类',
  ''
].join('\n');

async function withServer(handler: (call: (name: string, args: JsonRecord) => Promise<JsonRecord>) => Promise<void>): Promise<void> {
  const child = spawn(process.execPath, [
    CLI_BUNDLE, 'ai-server', '--mcp', '--stdio-only',
    '--workspace', WORKSPACE_ROOT, '--permission', 'yolo', '--port', '0'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  const pending = new Map<number, PendingCall>();
  let lineBuffer = '';
  let nextId = 1;
  let failure: Error | undefined;

  child.stdout.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString('utf8');
    let index: number;
    while ((index = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, index).trim();
      lineBuffer = lineBuffer.slice(index + 1);
      if (!line) continue;
      let message: JsonRecord;
      try { message = JSON.parse(line) as JsonRecord; } catch { continue; }
      const id = message.id as number | undefined;
      if (typeof id === 'number' && pending.has(id)) {
        const entry = pending.get(id) as PendingCall;
        pending.delete(id);
        if (message.error) {
          entry.reject(new Error(JSON.stringify(message.error)));
        } else {
          entry.resolve((message.result ?? {}) as JsonRecord);
        }
      }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  child.on('exit', (code) => {
    failure = new Error(`桥接进程提前退出，退出码 ${code}`);
    for (const entry of pending.values()) entry.reject(failure);
  });

  const send = (message: JsonRecord) => { child.stdin.write(`${JSON.stringify(message)}\n`); };
  const waitForId = (id: number, timeoutMs: number): Promise<JsonRecord> => new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (pending.has(id)) {
        if (Date.now() > deadline) { pending.delete(id); reject(new Error(`等待 MCP 响应超时（id=${id}）`)); return; }
        setTimeout(poll, 150);
        return;
      }
      if (failure) { reject(failure); return; }
      resolve();
    };
    pending.set(id, { resolve, reject });
    setTimeout(poll, 100);
  });

  const call = async (name: string, args: JsonRecord): Promise<JsonRecord> => {
    const id = nextId;
    nextId += 1;
    send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
    const result = await waitForId(id, name === 'lingbuilder.build.run' ? 600_000 : 120_000);
    const content = result.content as Array<{ type?: string; text?: string }> | undefined;
    const text = Array.isArray(content) && content[0] && typeof content[0].text === 'string' ? content[0].text : '';
    if (result.isError === true) throw new Error(`${name} 失败：${text}`);
    let parsed: JsonRecord = {};
    try { parsed = JSON.parse(text) as JsonRecord; } catch { parsed = { raw: text }; }
    return parsed;
  };

  send({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tuse-demo-driver', version: '0' } } });
  await waitForId(0, 30_000);
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  try {
    await handler(call);
  } finally {
    child.kill();
  }
}

function assertDiskLayout(): { sourcePath: string; designerPath: string } {
  const sourcePath = path.join(WORKSPACE_ROOT, SOURCE_REL);
  const designerPath = path.join(WORKSPACE_ROOT, DESIGNER_REL);
  if (!fs.existsSync(sourcePath)) throw new Error(`主源码不存在：${SOURCE_REL}`);
  if (!fs.existsSync(designerPath)) throw new Error(`设计器模型不存在：${DESIGNER_REL}`);
  return { sourcePath, designerPath };
}

async function phaseCreate(): Promise<void> {
  await withServer(async call => {
    try {
      const created = await call('lingbuilder.project.create', {
        projectId: PROJECT_ID,
        name: '图色识别演示',
        templateId: 'blank-window',
        windowTitle: '图色识别演示',
        enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.image.recognition', 'lingbuilder.image.core'],
        openInWorkbench: false,
        approved: true
      });
      console.log('project.create OK:', JSON.stringify(created).slice(0, 600));
    } catch (error) {
      console.log('project.create 返回（若为已存在可忽略）：', (error as Error).message.slice(0, 400));
    }
  });
  const { designerPath } = assertDiskLayout();
  const modulesPath = path.join(WORKSPACE_ROOT, '.lingbuilder/projects/tuse-demo/project-modules.json');
  console.log('设计器模型：', designerPath);
  console.log('模块启用：', fs.existsSync(modulesPath) ? fs.readFileSync(modulesPath, 'utf8').replace(/\s+/g, ' ').slice(0, 300) : '(缺省继承)');
}

async function phaseApply(): Promise<void> {
  const { designerPath } = assertDiskLayout();
  const designer = JSON.parse(fs.readFileSync(designerPath, 'utf8')) as JsonRecord;
  const updated = JSON.parse(JSON.stringify(designer)) as JsonRecord & {
    resources: JsonRecord[];
    windows: Array<JsonRecord & { id: string; controls: JsonRecord[]; events: JsonRecord; title: string; width: number; height: number }>;
  };
  const win = updated.windows[0];
  win.title = '图色识别演示';
  win.width = 720;
  win.height = 520;
  win.events = { Loaded: '_MainWindow_创建完毕' };
  win.controls = buildControls();
  updated.resources = [
    fileDialog('filedialog-target', '文件对话框1', '选择目标图片', win.id, '_文件对话框1_文件已选择', '_文件对话框1_已取消'),
    fileDialog('filedialog-template', '文件对话框2', '选择模板图片', win.id, '_文件对话框2_文件已选择', '_文件对话框2_已取消')
  ];

  await withServer(async call => {
    const proposal = await call('lingbuilder.edit.propose', {
      projectId: PROJECT_ID,
      filePath: SOURCE_REL,
      instruction: '图色识别演示：目标图/模板图选择与预览（文件对话框+图片框）、容差与找色 RGB 参数、找图/找全部/找色三按钮（GetTickCount64 毫秒计时）、底部多行只读结果区。',
      designerProject: designer,
      updatedDesignerProject: updated,
      files: [{ filePath: SOURCE_REL, updatedSource: LCPP_SOURCE }]
    });
    const nested = proposal.proposal as { id?: string } | undefined;
    const proposalId = String(proposal.proposalId ?? nested?.id ?? '');
    if (!proposalId) throw new Error(`edit.propose 未返回提案 ID：${JSON.stringify(proposal).slice(0, 500)}`);
    console.log('提案已创建：', proposalId);
    const applied = await call('lingbuilder.edit.apply', { proposalId, approved: true });
    console.log('应用结果：', JSON.stringify(applied).slice(0, 400));
  });

  await withServer(async call => {
    const diagnostics = await call('lingbuilder.lingcpp.diagnostics', { projectId: PROJECT_ID, filePath: SOURCE_REL });
    const items = (diagnostics.diagnostics as Array<{ severity?: string; code?: string; message?: string; line?: number }> | undefined) ?? [];
    const errors = items.filter(item => item.severity === 'error');
    const warnings = items.filter(item => item.severity === 'warning');
    console.log(`诊断：错误 ${errors.length}，警告 ${warnings.length}，共 ${items.length}`);
    for (const item of items.slice(0, 20)) console.log(`  [${item.severity}] L${item.line ?? '?'} ${item.code ?? ''} ${item.message ?? ''}`);
    if (errors.length > 0) process.exitCode = 2;
  });
}

async function phaseDiag(): Promise<void> {
  await withServer(async call => {
    const diagnostics = await call('lingbuilder.lingcpp.diagnostics', { projectId: PROJECT_ID, filePath: SOURCE_REL });
    const items = (diagnostics.diagnostics as Array<{ severity?: string; code?: string; message?: string; line?: number }> | undefined) ?? [];
    const errors = items.filter(item => item.severity === 'error');
    const warnings = items.filter(item => item.severity === 'warning');
    console.log(`诊断：错误 ${errors.length}，警告 ${warnings.length}，共 ${items.length}`);
    for (const item of items.slice(0, 30)) console.log(`  [${item.severity}] L${item.line ?? '?'} ${item.code ?? ''} ${item.message ?? ''}`);
    if (errors.length > 0) process.exitCode = 2;
  });
}

async function phaseBuild(): Promise<void> {
  await withServer(async call => {
    const built = await call('lingbuilder.build.run', { projectId: PROJECT_ID, run: false, approved: true });
    console.log('build.run：', JSON.stringify(built).slice(0, 1200));
  });
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? '';
  if (phase === 'create') await phaseCreate();
  else if (phase === 'apply') await phaseApply();
  else if (phase === 'build') await phaseBuild();
  else if (phase === 'diag') await phaseDiag();
  else throw new Error('用法：npx tsx scripts/tmp-tuse-demo-drive.ts <create|apply|build|diag>');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
