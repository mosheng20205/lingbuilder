import { createWorkspaceEditChangeFromRewrite } from './aiEditService';
import { getLingCppDesignerBindings, getLingCppProblems } from './languageService';
import { findLingCppMethod, parseLingCpp } from './parser';
import {
  LingCppDesignerBindingHint,
  LingCppProblem,
  WorkspaceEditProposal
} from './types';
import { LingControl, LingWindowProject } from '../windowDesigner/types';

export type EditorExperienceMode = 'beginner' | 'professional' | 'native';

export type BeginnerTaskKind =
  | 'create-window'
  | 'add-control'
  | 'set-control-text'
  | 'missing-source'
  | 'unbound-source'
  | 'missing-control'
  | 'run-program'
  | 'learning';

export interface BeginnerTask {
  id: string;
  kind: BeginnerTaskKind;
  filePath: string;
  line: number;
  title: string;
  description: string;
  status: 'todo' | 'ready' | 'done' | 'ignored';
  severity: 'must-fix' | 'suggestion' | 'learning';
  actionLabel: string;
  handlerName?: string;
  controlName?: string;
  controlId?: string;
  windowId?: string;
  canIgnore: boolean;
}

export interface CodeExplanation {
  title: string;
  body: string;
  example?: string;
  commonMistake?: string;
  line: number;
}

export interface LearningPathStep {
  id: string;
  title: string;
  description: string;
  target: 'designer' | 'tasks' | 'editor' | 'run' | 'export';
  completed: boolean;
  actionLabel: string;
}

export interface LearningPathState {
  workspaceId: string;
  completedStepIds: string[];
  dismissed: boolean;
  steps: LearningPathStep[];
}

export type LingCppActionBlockKind =
  | 'message-box'
  | 'debug-output'
  | 'exit-program'
  | 'set-control-text'
  | 'open-window'
  | 'advanced-code';

export interface LingCppActionBlock {
  id: string;
  kind: LingCppActionBlockKind;
  label: string;
  description: string;
  line?: number;
  params: Record<string, string>;
  readonly?: boolean;
  sourceText?: string;
}

export interface ActionBlockEditContext {
  filePath: string;
  sourceCode: string;
  handlerName: string;
}

export interface BeginnerTemplate {
  id: string;
  name: string;
  description: string;
  defaultFilePath: string;
  sourceCode: string;
  project: LingWindowProject;
}

export function getBeginnerTasks(
  source: string,
  designerProject?: LingWindowProject,
  filePath = 'src/未命名.lcpp',
  ignoredTaskIds: string[] = []
): BeginnerTask[] {
  const ignored = new Set(ignoredTaskIds);
  const tasks: BeginnerTask[] = [];
  const parsed = parseLingCpp(source);
  const windows = designerProject?.windows || [];
  const controls = windows.flatMap(window => window.controls.map(control => ({ window, control })));

  if (windows.length === 0) {
    tasks.push(createProjectTask('create-window', filePath, '先创建一个窗口', '窗口是程序显示出来的主界面。', '打开设计器'));
  }

  if (windows.length > 0 && controls.length === 0) {
    tasks.push(createProjectTask('add-control', filePath, '添加第一个按钮', '按钮、文本框、标签都是用户能看到和操作的控件。', '添加控件'));
  }

  controls
    .filter(({ control }) => !control.content?.trim())
    .forEach(({ window, control }) => {
      tasks.push({
        id: `beginner-empty-text-${filePath}-${control.id}`,
        kind: 'set-control-text',
        filePath,
        line: 1,
        title: `${control.name} 还没有显示文字`,
        description: '给控件设置文字后，新手更容易知道它在窗口里做什么。',
        status: 'todo',
        severity: 'learning',
        actionLabel: '定位控件',
        controlName: control.name,
        controlId: control.id,
        windowId: window.id,
        canIgnore: true
      });
    });

  if (designerProject) {
    getLingCppProblems(source, designerProject, filePath)
      .filter(problem => problem.source === 'designer')
      .forEach(problem => tasks.push(taskFromProblem(problem, ignored)));
  }

  if (parsed.program.classes.length > 0 && controls.length > 0) {
    tasks.push({
      id: `beginner-run-${filePath}`,
      kind: 'run-program',
      filePath,
      line: parsed.program.classes[0]?.line || 1,
      title: '运行窗口看效果',
      description: '写完一个按钮动作后，按 F5 运行，确认窗口和事件真的能工作。',
      status: 'ready',
      severity: 'learning',
      actionLabel: '运行窗口',
      canIgnore: true
    });
  }

  return tasks.map(task => ignored.has(task.id) ? { ...task, status: 'ignored' } : task);
}

export function adaptProblemForBeginner(problem: LingCppProblem): {
  audienceText: string;
  beginnerActionLabel: string;
  severityForBeginner: 'must-fix' | 'suggestion' | 'learning';
  canIgnore: boolean;
} {
  if (problem.actionKind === 'generate-event') {
    return {
      audienceText: '这个控件已经绑定了事件，但还没有写“发生后要做什么”。',
      beginnerActionLabel: '生成事件动作',
      severityForBeginner: 'suggestion',
      canIgnore: true
    };
  }
  if (problem.actionKind === 'bind-designer-event') {
    return {
      audienceText: '源码里有事件函数，但设计器还没有把控件动作连到它。',
      beginnerActionLabel: '绑定到控件',
      severityForBeginner: 'suggestion',
      canIgnore: true
    };
  }
  if (problem.actionKind === 'rename-handler') {
    return {
      audienceText: '事件名字里的控件，在当前窗口设计器里找不到。',
      beginnerActionLabel: '检查控件名称',
      severityForBeginner: 'must-fix',
      canIgnore: false
    };
  }
  return {
    audienceText: problem.level === 'error' ? '这里的代码结构不完整，运行前需要修好。' : '这里有一条建议，可以稍后处理。',
    beginnerActionLabel: problem.actionLabel || '查看位置',
    severityForBeginner: problem.level === 'error' ? 'must-fix' : 'learning',
    canIgnore: problem.level !== 'error'
  };
}

export function getCodeExplanation(source: string, line: number, _column = 1): CodeExplanation {
  const lines = source.split(/\r?\n/);
  const current = (lines[Math.max(0, line - 1)] || '').trim();
  const parsed = parseLingCpp(source);
  const method = parsed.program.classes
    .flatMap(cls => cls.methods)
    .find(item => line >= item.line && line <= (item.endLine || item.statements.at(-1)?.line || item.line));

  if (startsAny(current, ['包', '鍖'])) {
    return explain(line, '包', '包像项目的姓氏，用来说明这份代码属于哪个项目或模块。', '包 我的窗口程序');
  }
  if (startsAny(current, ['使用', '浣跨敤'])) {
    return explain(line, '使用', '使用表示这份代码需要哪些能力，例如窗口、标准控件或系统命令。', '使用 Win32窗口');
  }
  if (startsAny(current, ['类', '绫'])) {
    return explain(line, '类', '类是一张“窗口图纸”。一个窗口类会把控件、事件和运行逻辑放在一起。', '类 游戏主窗体 : 公开 窗体');
  }
  if (startsAny(current, ['公开', '私有', '保护', '鍏紑', '绉佹湁', '淇濇姢'])) {
    return explain(line, '访问区域', '这里决定哪些成员更像公开按钮，哪些成员只在窗口内部使用。新手通常先放在公开区域即可。');
  }
  if (startsAny(current, ['构造', '鏋勯'])) {
    return explain(line, '构造', '窗口创建时会先执行这里，适合放初始化文字、默认状态和启动日志。', '构造()\n    调试输出("窗口初始化完成")');
  }
  if (startsAny(current, ['事件', '浜嬩欢']) || method?.kind === 'event') {
    const handlerName = method?.name || current.replace(/^事件\s*/u, '').replace(/\(.*/u, '');
    return explain(line, '事件', `用户做了某个动作后会执行这里。当前事件处理器是：${handlerName || '未命名事件'}。`, '事件 _按钮1_被单击()\n    信息框("你点击了按钮", 64, "提示")');
  }
  if (startsAny(current, ['如果', '濡傛灉'])) {
    return explain(line, '如果', '如果用来做判断：条件成立就执行上方分支，否则执行“否则”分支。', '如果 (分数 > 60)\n    调试输出("通过")\n否则\n    调试输出("未通过")\n如果结束', '常见错误：写了“如果”后忘记补“如果结束”，或把“否则”放到“如果结束”后面。');
  }
  if (/信息框|淇℃伅妗?/u.test(current)) {
    return explain(line, '信息框', '信息框会弹出一个提示窗口，适合告诉用户操作结果。', '信息框("保存成功", 64, "提示")');
  }
  if (/调试输出|璋冭瘯杈撳嚭/u.test(current)) {
    return explain(line, '调试输出', '调试输出会把文字写到运行日志里，适合检查事件有没有执行。', '调试输出("按钮被点击")');
  }
  if (/结束|缁撴潫/u.test(current)) {
    return explain(line, '结束', '结束会关闭当前程序。新手建议只在“退出”按钮事件里使用。');
  }
  return explain(line, '普通代码', current ? '这是一行普通代码。可以结合上下文理解它属于哪个事件或方法。' : '空行用于分隔代码块，让结构更清楚。');
}

export function getActionBlocksForEvent(source: string, handlerName: string): LingCppActionBlock[] {
  const method = findLingCppMethod(parseLingCpp(source).program, handlerName);
  if (!method) return [];

  return method.statements
    .filter(statement => statement.text.trim())
    .map(statement => parseActionStatement(statement.text.trim(), statement.line));
}

export function createWorkspaceEditFromActionBlock(
  context: ActionBlockEditContext,
  action: LingCppActionBlock
): WorkspaceEditProposal {
  const originalSource = normalizeLineEndings(context.sourceCode);
  const updatedSource = insertActionIntoEvent(originalSource, context.handlerName, actionToSource(action));
  const change = createWorkspaceEditChangeFromRewrite(context.filePath, originalSource, updatedSource);
  return {
    id: `beginner-action-${Date.now()}`,
    title: '新手动作预览',
    summary: `向 ${context.handlerName} 添加动作：${action.label}`,
    createdAt: new Date().toISOString(),
    explanation: '这是本地规则生成的可预览 WorkspaceEdit。确认后才会写入 .lcpp。',
    changes: [change]
  };
}

export function getLearningPathState(
  workspaceId: string,
  source: string,
  designerProject?: LingWindowProject,
  completedStepIds: string[] = [],
  dismissed = false
): LearningPathState {
  const completed = new Set(completedStepIds);
  const hasWindow = Boolean(designerProject?.windows.length);
  const hasControl = Boolean(designerProject?.windows.some(win => win.controls.length > 0));
  const hasEvent = parseLingCpp(source).program.classes.some(cls => cls.methods.some(method => method.kind === 'event'));

  const steps: LearningPathStep[] = [
    { id: 'create-window', title: '创建窗口', description: '先有一个能显示的窗口。', target: 'designer', completed: hasWindow || completed.has('create-window'), actionLabel: '打开设计器' },
    { id: 'add-button', title: '添加按钮', description: '按钮是最容易理解的第一个交互控件。', target: 'designer', completed: hasControl || completed.has('add-button'), actionLabel: '添加按钮' },
    { id: 'write-event', title: '写点击动作', description: '让按钮点击后弹提示或输出日志。', target: 'tasks', completed: hasEvent || completed.has('write-event'), actionLabel: '生成提示框事件' },
    { id: 'run-program', title: '运行程序', description: '按 F5 看窗口是否按预期工作。', target: 'run', completed: completed.has('run-program'), actionLabel: '运行窗口' },
    { id: 'export-cpp', title: '导出 C++', description: '查看生成的真实 C++ 工程，理解最终产物。', target: 'export', completed: completed.has('export-cpp'), actionLabel: '查看生成代码' }
  ];

  return { workspaceId, completedStepIds: [...completed], dismissed, steps };
}

export function getBeginnerTemplates(): BeginnerTemplate[] {
  return [
    createTemplate('login', '登录窗口', '账号、密码、登录按钮和提示框事件。', '登录窗口', [
      button('login-button', '按钮1', '登录', 260, 170),
      textBox('account-box', '账号输入框', '请输入账号', 160, 86),
      textBox('password-box', '密码输入框', '请输入密码', 160, 126)
    ], '_按钮1_被单击'),
    createTemplate('settings', '设置窗口', '复选框、下拉框和保存按钮。', '设置窗口', [
      button('save-button', '按钮1', '保存设置', 260, 190),
      label('theme-label', '标签1', '主题设置', 70, 70),
      { ...textBox('theme-box', '主题输入框', '深色', 160, 104), width: 180 }
    ], '_按钮1_被单击'),
    createTemplate('toolbox', '工具箱窗口', '多按钮工具入口，适合小工具集合。', '工具箱窗口', [
      button('tool-a', '按钮1', '工具一', 80, 88),
      button('tool-b', '按钮2', '工具二', 210, 88)
    ], '_按钮1_被单击'),
    createTemplate('table-manager', '表格管理窗口', '搜索框、添加按钮和列表占位。', '表格管理窗口', [
      textBox('search-box', '搜索框', '输入关键字', 70, 64),
      button('add-button', '按钮1', '添加记录', 270, 64),
      label('table-label', '标签1', '表格区域', 70, 120)
    ], '_按钮1_被单击'),
    createTemplate('game-launcher', '游戏启动器窗口', '开始按钮、退出按钮和运行日志。', '游戏启动器窗口', [
      button('start-button', '按钮1', '开始游戏', 90, 110),
      button('exit-button', '按钮2', '退出', 230, 110)
    ], '_按钮1_被单击'),
    createTemplate('about', '关于窗口', '产品说明、版本文字和关闭按钮。', '关于窗口', [
      label('about-label', '标签1', 'LingBuilder 示例程序', 80, 82),
      button('ok-button', '按钮1', '知道了', 230, 150)
    ], '_按钮1_被单击')
  ];
}

export function summarizeEventPreview(blocks: LingCppActionBlock[]): string[] {
  if (blocks.length === 0) return ['这个事件目前还没有可预览的动作。'];
  return blocks.map(block => {
    if (block.kind === 'message-box') return `会弹出提示框：${block.params.text || '提示内容'}`;
    if (block.kind === 'debug-output') return `会在调试日志输出：${block.params.text || '调试信息'}`;
    if (block.kind === 'exit-program') return '会结束当前程序。';
    if (block.kind === 'set-control-text') return `会修改控件文字：${block.params.control || '控件'} = ${block.params.text || '新文字'}`;
    if (block.kind === 'open-window') return `会打开窗口：${block.params.window || '目标窗口'}`;
    return `保留高级代码：${block.sourceText || ''}`;
  });
}

function taskFromProblem(problem: LingCppProblem, ignored: Set<string>): BeginnerTask {
  const adapted = adaptProblemForBeginner(problem);
  const title = problem.actionKind === 'generate-event'
    ? '控件还没有点击后的动作'
    : problem.actionKind === 'bind-designer-event'
      ? '事件还没有绑定到控件'
      : problem.actionKind === 'rename-handler'
        ? '控件名字对不上'
        : '代码需要处理';

  return {
    id: problem.id,
    kind: problem.actionKind === 'generate-event' ? 'missing-source'
      : problem.actionKind === 'bind-designer-event' ? 'unbound-source'
        : problem.actionKind === 'rename-handler' ? 'missing-control'
          : 'learning',
    filePath: problem.filePath,
    line: problem.line,
    title,
    description: adapted.audienceText,
    status: ignored.has(problem.id) ? 'ignored' : 'todo',
    severity: adapted.severityForBeginner,
    actionLabel: adapted.beginnerActionLabel,
    handlerName: problem.codeSnippet,
    canIgnore: adapted.canIgnore
  };
}

function createProjectTask(kind: BeginnerTaskKind, filePath: string, title: string, description: string, actionLabel: string): BeginnerTask {
  return {
    id: `beginner-${kind}-${filePath}`,
    kind,
    filePath,
    line: 1,
    title,
    description,
    status: 'todo',
    severity: 'learning',
    actionLabel,
    canIgnore: false
  };
}

function explain(line: number, title: string, body: string, example?: string, commonMistake?: string): CodeExplanation {
  return { line, title, body, example, commonMistake };
}

function startsAny(value: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => value.startsWith(prefix));
}

function parseActionStatement(text: string, line: number): LingCppActionBlock {
  const quoted = text.match(/["“”]([^"“”]*)["“”]/u)?.[1] || '';
  if (/信息框|淇℃伅妗?/u.test(text)) {
    return { id: `action-${line}`, kind: 'message-box', label: '提示框', description: '弹出提示窗口', line, params: { text: quoted || '提示内容', title: '提示' }, sourceText: text };
  }
  if (/调试输出|璋冭瘯杈撳嚭/u.test(text)) {
    return { id: `action-${line}`, kind: 'debug-output', label: '调试输出', description: '写入运行日志', line, params: { text: quoted || '调试信息' }, sourceText: text };
  }
  if (/结束|缁撴潫/u.test(text)) {
    return { id: `action-${line}`, kind: 'exit-program', label: '结束程序', description: '关闭当前程序', line, params: {}, sourceText: text };
  }
  if (/置文字|设置文字|文本/u.test(text)) {
    return { id: `action-${line}`, kind: 'set-control-text', label: '修改控件文字', description: '把控件显示文字改成新内容', line, params: { text: quoted }, sourceText: text };
  }
  if (/打开窗口|绐楀彛_鎵撳紑/u.test(text)) {
    return { id: `action-${line}`, kind: 'open-window', label: '打开窗口', description: '打开另一个窗口', line, params: { window: quoted }, sourceText: text };
  }
  return { id: `action-${line}`, kind: 'advanced-code', label: '高级代码块', description: '暂不能用动作表单编辑，但会原样保留', line, params: {}, readonly: true, sourceText: text };
}

function actionToSource(action: LingCppActionBlock): string {
  const text = action.params.text || '提示内容';
  if (action.kind === 'message-box') return `        信息框("${text}", 64, "${action.params.title || '提示'}")`;
  if (action.kind === 'debug-output') return `        调试输出("${text}")`;
  if (action.kind === 'exit-program') return '        结束()';
  if (action.kind === 'set-control-text') return `        ${action.params.control || '按钮1'}.文字 = "${text}"`;
  if (action.kind === 'open-window') return `        窗口_打开("${action.params.window || '新窗口'}")`;
  return action.sourceText || '        调试输出("高级代码")';
}

function insertActionIntoEvent(source: string, handlerName: string, actionSource: string): string {
  const lines = source.split('\n');
  const startIndex = lines.findIndex(line => line.includes(handlerName) && (/事件|浜嬩欢/u.test(line)));
  if (startIndex < 0) return `${source.trimEnd()}\n${actionSource}\n`;

  let insertIndex = startIndex + 1;
  while (insertIndex < lines.length) {
    const trimmed = lines[insertIndex]?.trim() || '';
    if (/^(事件|构造|析构|公开|私有|保护|结束类|浜嬩欢|鏋勯|鏋愭瀯|鍏紑|绉佹湁|淇濇姢|缁撴潫绫?)/u.test(trimmed)) break;
    insertIndex += 1;
  }
  lines.splice(insertIndex, 0, actionSource);
  return lines.join('\n');
}

function createTemplate(id: string, name: string, description: string, className: string, controls: LingControl[], primaryHandler: string): BeginnerTemplate {
  const fileName = `${className}.xml`;
  const project: LingWindowProject = {
    id: `${id}-project`,
    name,
    windows: [{
      id: `${id}-window`,
      fileName,
      className,
      title: name,
      width: 720,
      height: 420,
      background: '#20242b',
      description,
      controls: controls.map(control => control.id === controls[0]?.id
        ? { ...control, events: { ...(control.events || {}), Click: primaryHandler } }
        : control)
    }]
  };

  return {
    id,
    name,
    description,
    defaultFilePath: `src/${className}.lcpp`,
    project,
    sourceCode: [
      '包 LingBuilder',
      '使用 Win32窗口',
      '使用 标准控件',
      '',
      `类 ${className} : 公开 窗体`,
      '公开:',
      `    文本型 关联设计文件 = "${fileName}"`,
      '',
      '    构造()',
      `        调试输出("${name} 初始化完成")`,
      '',
      `    事件 ${primaryHandler}()`,
      `        信息框("${name} 已经准备好了", 64, "提示")`,
      `        调试输出("${primaryHandler} 已触发")`,
      '结束类'
    ].join('\n')
  };
}

function button(id: string, name: string, content: string, x: number, y: number): LingControl {
  return baseControl(id, 'Button', name, content, x, y, 112, 34);
}

function textBox(id: string, name: string, content: string, x: number, y: number): LingControl {
  return baseControl(id, 'TextBox', name, content, x, y, 180, 30);
}

function label(id: string, name: string, content: string, x: number, y: number): LingControl {
  return baseControl(id, 'Label', name, content, x, y, 180, 28);
}

function baseControl(
  id: string,
  type: LingControl['type'],
  name: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number
): LingControl {
  return {
    id,
    type,
    name,
    content,
    width,
    height,
    x,
    y,
    fontSize: 14,
    background: type === 'Button' ? '#2563eb' : '#ffffff',
    foreground: type === 'Button' ? '#ffffff' : '#111827',
    isEnabled: true,
    visibility: 'Visible'
  };
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
