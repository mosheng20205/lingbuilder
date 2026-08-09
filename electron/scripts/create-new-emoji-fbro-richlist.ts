import fs from 'node:fs/promises';
import path from 'node:path';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import type { Win32ControlPropertyValue } from '../src/services/windowDesigner/win32ControlRegistry';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-richlist';
const projectName = 'new_emoji RichList 动态多浏览器';
const sourceDirectory = path.join(repositoryRoot, 'src', projectId);
const configDirectory = path.join(repositoryRoot, 'config', projectId);
const designerDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
const moduleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.std.text',
  'lingbuilder.new_emoji.ui',
  'lingbuilder.fbro.browser',
  'lingbuilder.new_emoji.fbro-shell'
] as const;

const palette = {
  window: '#101418',
  panel: '#182027',
  panelAlt: '#202A33',
  text: '#E8EEF2',
  muted: '#9FB0BA',
  primary: '#1677C8',
  border: '#3B4952'
};

const baseControl = (id: string, type: LingControl['type'], designerType: string, name: string, content: string,
  x: number, y: number, width: number, height: number): LingControl => ({
  id, type, designerType, name, content, x, y, width, height,
  fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
  background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible', properties: {}, events: {}
});

function text(id: string, name: string, content: string, x: number, y: number, width: number, height: number,
  properties: Record<string, Win32ControlPropertyValue> = {}): LingControl {
  return { ...baseControl(id, 'Label', 'lingbuilder.new_emoji.ui/Text', name, content, x, y, width, height), properties };
}

function button(id: string, name: string, content: string, x: number, y: number, width: number, height: number,
  handler: string, variant = 0): LingControl {
  return {
    ...baseControl(id, 'Button', 'lingbuilder.new_emoji.ui/Button', name, content, x, y, width, height),
    properties: { variant, plain: false, round: false, circle: false, loading: false, size: '0' },
    events: { Clicked: handler }
  };
}

function omnibox(): LingControl {
  return {
    ...baseControl('address-input', 'TextBox', 'lingbuilder.new_emoji.ui/Omnibox', '地址输入',
      'https://www.baidu.com/', 730, 80, 676, 42),
    properties: {
      value: 'https://www.baidu.com/', placeholder: '输入当前会话要访问的网址', securityState: 1,
      securityText: '独立会话', prefixIcon: '', prefixText: '', prefixBg: '#00000000', prefixFg: '#00000000',
      actionIcons: [], suggestions: [], suggestionOpen: false, suggestionSelected: 0
    },
    events: { TextChanged: '_地址输入_提交' }
  };
}

function richList(): LingControl {
  const templateJson = JSON.stringify({
    template: {
      rowHeight: 116,
      nodes: [
        { id: 'title', type: 'text', x: 12, y: 8, w: 292, h: 24, field: 'title', role: 'primary', size: 14, weight: 600, ellipsis: true },
        { id: 'status', type: 'button', x: 326, y: 6, w: 102, h: 28, field: 'status', text: '已打开', actionId: 'status', variant: 1, tooltip: '查看状态；已关闭时点击可重新打开' },
        { id: 'address', type: 'text', x: 12, y: 37, w: 416, h: 22, field: 'address', role: 'secondary', size: 11, weight: 400, ellipsis: true },
        { id: 'close', type: 'button', x: 12, y: 70, w: 78, h: 28, text: '关闭', actionId: 'close', variant: 1, tooltip: '关闭浏览器但保留表项与缓存' },
        { id: 'delete', type: 'button', x: 96, y: 70, w: 78, h: 28, text: '删除', actionId: 'delete', variant: 2, tooltip: '删除表项与运行时绑定，默认保留缓存' },
        { id: 'cookie', type: 'button', x: 180, y: 70, w: 64, h: 28, text: 'Cookie', actionId: 'cookie', variant: 0, tooltip: '仅向当前表项绑定的浏览器置入 Cookie' },
        { id: 'move-up', type: 'button', x: 250, y: 70, w: 28, h: 28, text: '↑', icon: '↑', actionId: 'move-up', variant: 1, tooltip: '上移浏览器' },
        { id: 'move-down', type: 'button', x: 282, y: 70, w: 28, h: 28, text: '↓', icon: '↓', actionId: 'move-down', variant: 1, tooltip: '下移浏览器' },
        { id: 'move-top', type: 'button', x: 314, y: 70, w: 28, h: 28, text: '⇈', icon: '⇈', actionId: 'move-top', variant: 1, tooltip: '置顶浏览器' },
        { id: 'move-bottom', type: 'button', x: 346, y: 70, w: 28, h: 28, text: '⇊', icon: '⇊', actionId: 'move-bottom', variant: 1, tooltip: '沉底浏览器' }
      ]
    }
  });
  const itemsJson = JSON.stringify({
    items: [{ key: 'rich-browser-1', data: { title: '浏览器 1', address: 'https://www.baidu.com/', status: '已打开' } }]
  });
  return {
    ...baseControl('browser-session-list', 'ListView', 'lingbuilder.new_emoji.ui/RichList', '浏览器会话列表',
      '动态浏览器会话', 18, 138, 462, 684),
    properties: {
      title: '', templateJson: [templateJson], itemsJson: [itemsJson], selectedKeys: ['["rich-browser-1"]'],
      selectionMode: '0', bordered: true, zebra: false, compact: true, keyboardNavigation: true,
      showScrollbar: true, rowHeight: 116, paddingX: 8, paddingY: 6, scrollbarWidth: 10, align: '0',
      selectedColor: '#FF155E8A', hoverColor: '#FF2B3942', scrollY: 0, virtualItemCount: 0
    },
    events: {
      SelectionChanged: '_浏览器会话列表_选择变化',
      ItemClicked: '_浏览器会话列表_项目被点击',
      ButtonClicked: '_浏览器会话列表_按钮被点击'
    }
  };
}

function createProject(): LingWindowProject {
  const controls: LingControl[] = [
    text('title', '标题', 'RichList 动态多浏览器', 18, 18, 440, 32, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    text('architecture-note', '架构说明', '稳定 ID · 独立 Host HWND · 独立 Profile', 18, 52, 440, 22, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    button('new-browser', '新建浏览器', '新建浏览器', 18, 84, 150, 42, '_新建浏览器_被点击', 0),
    text('list-note', '列表提示', '点击表项切换；行内按钮管理当前稳定会话', 180, 91, 300, 28, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    richList(),
    text('cache-policy', '缓存策略', '删除表项默认保留缓存与登录数据', 18, 834, 462, 24, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    button('back', '后退', '←', 500, 80, 48, 42, '_后退_被点击', 1),
    button('forward', '前进', '→', 556, 80, 48, 42, '_前进_被点击', 1),
    button('reload', '刷新', '↻', 612, 80, 48, 42, '_刷新_被点击', 1),
    button('stop', '停止', '■', 668, 80, 48, 42, '_停止_被点击', 1),
    omnibox(),
    button('navigate', '打开网址', '打开', 1416, 80, 72, 42, '_打开网址_被点击', 0),
    text('operation-status', '操作状态', '正在初始化第一个独立浏览器会话……', 500, 846, 988, 28,
      { align: '0', valign: '1', wrap: false, ellipsis: true })
  ];
  controls.push({
    ...baseControl('browser-host-tabs', 'TabControl', 'lingbuilder.new_emoji.ui/Tabs', '浏览器Host页面',
      '浏览器Host页面', 500, 138, 988, 684),
    properties: {
      items: [], activeIndex: 0, tabType: '0', position: '0', headerAlign: '0', headerVisible: false,
      closable: false, addable: false, editable: false, contentVisible: false, chromeMode: false,
      reorderEnabled: false, detachEnabled: false
    }
  });
  controls.push({
    ...baseControl('browser-viewport', 'Grid', 'lingbuilder.new_emoji.ui/BrowserViewport', '浏览器页面占位',
      '浏览器页面宿主', 500, 138, 988, 684),
    background: '#FFFFFFFF', foreground: '#FF111827',
    properties: {
      state: 4, loading: false, progress: 0, placeholderTitle: '正在创建独立浏览器',
      placeholderDesc: '每个 RichList 表项绑定独立 FBro Host、HWND 和 Profile。', placeholderIcon: '', screenshot: ''
    }
  });
  return {
    schemaVersion: 2,
    id: projectId,
    name: projectName,
    resources: [],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: projectName,
      width: 1510, height: 900, background: palette.window, titleBarBackground: palette.panel,
      titleBarForeground: palette.text,
      description: 'RichList 仅展示稳定会话模型；fbro-shell 动态创建并管理每个独立 FBro Host 和原生 HWND。',
      designerBackend: 'new-emoji', openPlacement: 'center', resizable: false, maximizable: false,
      cornerStyle: 'rounded', iconStyle: 'lingbuilder',
      events: { Loaded: '_MainWindow_创建完毕', SizeChanged: '_MainWindow_大小被改变', DpiChanged: '_MainWindow_DPI被改变' },
      controls
    }]
  };
}

function buildSource(): string {
  return String.raw`类 MainWindow : 公开 窗口
    整数型 下一个会话编号 = 1
    文本型 默认网址 = "https://www.baidu.com/"

    构造()
        调试输出("RichList 动态多浏览器 Demo 正在初始化。")
    结束

    事件 _MainWindow_创建完毕()
        如果 (浏览器外壳_创建(浏览器Host页面, 浏览器页面占位, &浏览器状态改变) == 假)
            控件_设置文本(操作状态, "初始化失败：无法绑定 FBro 浏览器外壳。")
            返回
        如果结束
        如果 (浏览器外壳_绑定实例列表(浏览器会话列表) == 假)
            控件_设置文本(操作状态, "初始化失败：RichList 绑定未成功。")
            返回
        如果结束
        新建独立浏览器()
    结束

    空 更新操作状态(文本型 内容)
        控件_设置文本(操作状态, 内容)
        调试输出(内容)
    结束

    空 同步当前地址()
        局部 文本型 当前地址 = 浏览器外壳_取地址()
        如果 (当前地址 != "")
            控件_设置文本(地址输入, 当前地址)
        如果结束
    结束

    空 新建独立浏览器()
        局部 文本型 稳定ID = 格式化文本("rich-browser-{}", 下一个会话编号)
        局部 文本型 标题 = 格式化文本("浏览器 {}", 下一个会话编号)
        局部 文本型 缓存目录 = 格式化文本(".fbro-profiles/richlist-session-{}", 下一个会话编号)
        如果 (浏览器外壳_新建独立实例(稳定ID, 默认网址, 标题, 缓存目录))
            下一个会话编号 = 下一个会话编号 + 1
            控件_设置文本(地址输入, 默认网址)
            更新操作状态("已创建 " + 稳定ID + "：独立 Host、HWND、Cookie 和缓存目录均已绑定。")
        否则
            更新操作状态("新建浏览器失败：" + 浏览器外壳_取当前错误())
        如果结束
    结束

    空 导航当前浏览器()
        局部 文本型 地址 = ""
        地址 = 控件_取文本(地址输入)
        如果 (地址 == "")
            更新操作状态("请输入要打开的网址。")
            返回
        如果结束
        如果 (浏览器外壳_导航(地址))
            更新操作状态("当前会话正在打开：" + 地址)
        否则
            更新操作状态("导航失败：浏览器可能已经关闭。")
        如果结束
    结束

    事件 _浏览器会话列表_选择变化(文本型 选中键列表)
        如果 (浏览器外壳_选择列表键(选中键列表))
            同步当前地址()
            更新操作状态("已切换到稳定会话 " + 浏览器外壳_取当前稳定ID() + "，其他已打开浏览器保持运行并隐藏。")
        否则
            更新操作状态("切换浏览器失败：RichList 选择数据无效。")
        如果结束
    结束

    事件 _浏览器会话列表_项目被点击(文本型 事件数据)
        局部 文本型 操作结果 = 浏览器外壳_处理实例列表动作(事件数据)
        更新操作状态(操作结果)
        同步当前地址()
    结束

    事件 _浏览器会话列表_按钮被点击(文本型 事件数据)
        局部 文本型 操作结果 = 浏览器外壳_处理实例列表动作(事件数据)
        更新操作状态(操作结果)
        同步当前地址()
    结束

    事件 浏览器状态改变(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)
        如果 (地址 != "")
            控件_设置文本(地址输入, 地址)
        如果结束
    结束

    事件 _新建浏览器_被点击()
        新建独立浏览器()
    结束
    事件 _地址输入_提交(文本型 地址)
        如果 (地址 != "")
            控件_设置文本(地址输入, 地址)
            导航当前浏览器()
        如果结束
    结束
    事件 _打开网址_被点击()
        导航当前浏览器()
    结束
    事件 _后退_被点击()
        浏览器外壳_后退()
    结束
    事件 _前进_被点击()
        浏览器外壳_前进()
    结束
    事件 _刷新_被点击()
        浏览器外壳_刷新()
    结束
    事件 _停止_被点击()
        浏览器外壳_停止()
    结束
    事件 _MainWindow_大小被改变()
        同步当前地址()
    结束
    事件 _MainWindow_DPI被改变(整数型 新DPI)
        同步当前地址()
    结束
结束类
`;
}

const readme = `# new_emoji RichList 动态多浏览器

本项目是独立于 \`new-emoji-fbro-listbox\` 的 RichList 动态会话 Demo。设计器不预放任何 \`FBroBrowser\` 控件；\`lingbuilder.new_emoji.fbro-shell@1.2.0\` 在运行时为每个表项创建一个 \`LingBuilderFbroHost.exe\`、一个伴随宿主 \`HWND\` 和一个独立 Profile。

## 稳定 ID 绑定

RichList 行号和数组索引只表示当前显示顺序。每个会话使用 \`rich-browser-N\` 稳定 ID，RichList 的 \`itemKey\`、fbro-shell 模型、Host 进程、伴随 HWND 和缓存目录都以该 ID 关联。上移、下移、置顶和沉底只修改稳定 ID 顺序，不会交换浏览器实例或 Profile。

## 关闭与删除

- “关闭”释放该会话的 Host 进程和伴随 HWND，但保留 RichList 表项、稳定 ID、网址、配置和缓存目录；点击“已关闭”会用原稳定 ID 与 Profile 重新打开。
- “删除”会先安全关闭，再删除 RichList 表项和运行时绑定，并切换到相邻可用会话。
- Demo **默认保留缓存目录**，不会自动删除 Cookie 或登录数据，避免把“删除表项”误解为清除隐私数据。需要清理时应由用户确认后在独立缓存管理功能中完成。

## Cookie 隔离

“置入 Cookie”打开中文模态输入对话框，要求目标 http/https 地址和 \`名称=值\` Cookie 文本。fbro-shell 只向该表项稳定 ID 对应的 Host 发送 \`setCookie\` 请求，Host 使用官方 \`LB_FBro_CookieSetAsync\`，不执行网页脚本，也不会在日志中输出 Cookie 明文。关闭的会话会返回中文错误，必须先重新打开。

## 模块与平台

项目启用 \`lingbuilder.win32.basic\`、\`lingbuilder.std.text\`、\`lingbuilder.new_emoji.ui@2.0.0\`、\`lingbuilder.fbro.browser@2.2.0\` 和 \`lingbuilder.new_emoji.fbro-shell@1.2.0\`。构建目标为 Windows MSVC x64 Release。
`;

async function ensureSolutionEntry(): Promise<void> {
  const solutionPath = path.join(repositoryRoot, '.lingbuilder', 'solution.json');
  const solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as {
    projects?: Array<Record<string, unknown>>;
  };
  solution.projects ??= [];
  if (!solution.projects.some(project => project.id === projectId)) {
    solution.projects.push({
      type: 'visual-cpp', id: projectId, name: projectName,
      sourceRoot: `src/${projectId}`, configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`,
      isDefault: false, references: [], solutionFolderId: 'newemoji'
    });
    await fs.writeFile(solutionPath, `${JSON.stringify(solution, null, 2)}\n`, 'utf8');
  }
}

async function main(): Promise<void> {
  const updateExisting = process.argv.includes('--update');
  if (!updateExisting) {
    for (const target of [sourceDirectory, configDirectory, designerDirectory]) {
      try {
        await fs.access(target);
        throw new Error(`项目目录已存在，拒绝覆盖：${target}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
  await Promise.all([
    fs.mkdir(sourceDirectory, { recursive: true }),
    fs.mkdir(configDirectory, { recursive: true }),
    fs.mkdir(designerDirectory, { recursive: true })
  ]);
  const designerProject = createProject();
  await Promise.all([
    fs.writeFile(path.join(sourceDirectory, 'MainWindow.lcpp'), buildSource(), 'utf8'),
    fs.writeFile(path.join(sourceDirectory, 'README.md'), readme, 'utf8'),
    fs.writeFile(path.join(sourceDirectory, '项目全局变量.lcpp'), '// 本 Demo 的稳定会话模型由 fbro-shell 服务维护，不使用 RichList 索引作为全局身份。\n', 'utf8'),
    fs.writeFile(path.join(sourceDirectory, '项目数据类型.lcpp'), '// 浏览器会话类型由 lingbuilder.new_emoji.fbro-shell 的稳定 ID 模型统一提供。\n', 'utf8'),
    fs.writeFile(path.join(configDirectory, 'config.ini'), `[project]\nname=${projectName}\nid=${projectId}\n`, 'utf8'),
    fs.writeFile(path.join(designerDirectory, 'window-designer.json'), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(designerDirectory, 'project-modules.json'), `${JSON.stringify({
      schemaVersion: 1,
      enabledModuleIds: moduleIds,
      pinnedVersions: {
        'lingbuilder.win32.basic': '1.0.0',
        'lingbuilder.std.text': '1.0.0',
        'lingbuilder.new_emoji.ui': '2.0.0',
        'lingbuilder.fbro.browser': '2.2.0',
        'lingbuilder.new_emoji.fbro-shell': '1.2.0'
      }
    }, null, 2)}\n`, 'utf8')
  ]);
  await ensureSolutionEntry();
  console.log(JSON.stringify({ ok: true, projectId, sourceDirectory, configDirectory, designerDirectory }, null, 2));
}

void main();
