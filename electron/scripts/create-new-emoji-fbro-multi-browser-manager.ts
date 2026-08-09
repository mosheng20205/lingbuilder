import fs from 'node:fs/promises';
import path from 'node:path';
import { createPortableBrowserWorkspaceConfig } from '../src/services/browserWorkbench/browserInstanceService';
import { createNativeBrowserInstanceMenuResource } from '../src/services/browserWorkbench/browserWorkbenchCommands';
import { createSolutionService } from '../src/services/solution/solutionService';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import type { Win32ControlPropertyValue } from '../src/services/windowDesigner/win32ControlRegistry';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-multi-browser-manager';
const projectName = 'new_emoji FBro 多浏览器管理器';
const moduleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.win32.common-controls',
  'lingbuilder.std.text',
  'lingbuilder.new_emoji.ui',
  'lingbuilder.fbro.browser',
  'lingbuilder.new_emoji.fbro-shell',
  'lingbuilder.browser.doubao-downloader'
] as const;

const palette = {
  window: '#111827',
  panel: '#182235',
  panelAlt: '#0F172A',
  text: '#E5EDF8',
  muted: '#94A3B8',
  primary: '#2563EB',
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  border: '#334155'
};

// Instance Tabs remain the logical page manager, but their native header is
// hidden. Let the active independent FBro host use the full browser workspace.
const browserBounds = { x: 324, y: 130, width: 1252, height: 760 } as const;

function text(id: string, name: string, content: string, x: number, y: number, width: number, height: number, options: Record<string, Win32ControlPropertyValue> = {}): LingControl {
  return {
    id, type: 'Label', designerType: 'lingbuilder.new_emoji.ui/Text', name, content, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible', properties: options, events: {}
  };
}

function button(id: string, name: string, content: string, x: number, y: number, width: number, height: number, eventName: string, variant = 0): LingControl {
  return {
    id, type: 'Button', designerType: 'lingbuilder.new_emoji.ui/Button', name, content, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible',
    properties: { variant, plain: false, round: false, circle: false, loading: false, size: '0' },
    events: { Clicked: eventName }
  };
}

function input(id: string, name: string, content: string, placeholder: string, x: number, y: number, width: number, height: number, multiline = false): LingControl {
  return {
    id, type: 'TextBox', designerType: 'lingbuilder.new_emoji.ui/Input', name, content, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible',
    properties: { placeholder, prefix: '', suffix: '', readonly: false, password: false, multiline, clearable: true, maxLength: 0, validateState: '0' }, events: {}
  };
}

function omnibox(id: string, name: string, value: string, placeholder: string, x: number, y: number, width: number, height: number, submitEvent: string): LingControl {
  return {
    id, type: 'TextBox', designerType: 'lingbuilder.new_emoji.ui/Omnibox', name, content: value, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible',
    properties: {
      value, placeholder, securityState: 1, securityText: '安全', prefixIcon: '', prefixText: '', prefixBg: '#00000000', prefixFg: '#00000000',
      actionIcons: [], suggestions: [], suggestionOpen: false, suggestionSelected: 0
    },
    // Omnibox TextChanged is the native submit callback, fired by Enter or a suggestion commit.
    events: { TextChanged: submitEvent }
  };
}

function container(id: string, name: string, x: number, y: number, width: number, height: number, backgroundColor: string, visibility: LingControl['visibility'] = 'Visible'): LingControl {
  return {
    id, type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Container', name, content: name, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility,
    properties: { orientation: '0', gap: 0, backgroundColor, borderColor: '#FF475569', flowEnabled: false }, events: {}
  };
}

function child(control: LingControl, parentId: string): LingControl {
  return { ...control, parentId };
}

function tabChild(control: LingControl, parentId: string, containerSlot: string): LingControl {
  return { ...control, parentId, containerSlot };
}

function browserList(): LingControl {
  const templateJson = JSON.stringify({
    template: {
      rowHeight: 76,
      nodes: [
        { id: 'title', type: 'text', x: 12, y: 9, w: 126, h: 24, field: 'title', role: 'primary', size: 14, weight: 600, ellipsis: true },
        { id: 'status', type: 'text', x: 156, y: 9, w: 104, h: 24, field: 'status', role: 'secondary', size: 12, weight: 500, ellipsis: true },
        { id: 'meta', type: 'text', x: 12, y: 39, w: 248, h: 22, field: 'meta', role: 'secondary', size: 12, weight: 400, ellipsis: true }
      ]
    }
  });
  const itemsJson = JSON.stringify({
    items: [{ key: 'browser-1', data: { title: '实例 1', status: '启动中', meta: 'Profile browser-1 | PID 0' } }]
  });
  return {
    id: 'browser-instance-list', type: 'ListView', designerType: 'lingbuilder.new_emoji.ui/RichList', name: '浏览器实例列表', content: '浏览器实例',
    x: 16, y: 116, width: 286, height: 586, fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: 'transparent', foreground: palette.text, isEnabled: true, visibility: 'Visible',
    properties: {
      title: '', templateJson: [templateJson], itemsJson: [itemsJson], selectedKeys: ['["browser-1"]'], selectionMode: '0',
      bordered: true, zebra: false, compact: true, keyboardNavigation: true, showScrollbar: true,
      rowHeight: 76, paddingX: 8, paddingY: 6, scrollbarWidth: 10, align: '0', selectedColor: '#FF1D4ED8', hoverColor: '#FF334155', scrollY: 0, virtualItemCount: 0
    },
    events: {
      SelectionChanged: '_浏览器实例列表_选择变化',
      ContextMenu: '_浏览器实例列表_右键菜单'
    }
  };
}

function createProject(): LingWindowProject {
  const controls: LingControl[] = [
    text('subtitle', '架构说明', '动态独立 Host · 独立 Profile · WebSocket 主控', 20, 18, 700, 22, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    text('instance-heading', '实例列表标题', '浏览器实例', 18, 62, 180, 26, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    text('instance-hint', '实例列表提示', '选择标签页即可切换真实网页', 18, 88, 280, 22, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    browserList(),
    text('current-heading', '当前实例标题', '当前实例', 18, 716, 120, 24, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    text('detail-status', '详情状态', '实例 01 | 等待初始化\r\nPID 0 | CDP 0', 18, 742, 280, 54, { align: '0', valign: '0', wrap: true, ellipsis: true }),
    button('add-instance', '添加实例', '添加实例', 16, 808, 136, 40, '_添加实例_被点击', 0),
    button('global-settings', '全局设置', '全局设置', 160, 808, 140, 40, '_全局设置_被点击', 1),
    text('left-footer', '左侧底部说明', '实例数量不设固定软件上限', 18, 862, 280, 22, { align: '0', valign: '1', wrap: false, ellipsis: true }),
    button('back', '后退', '后退', 318, 84, 58, 40, '_后退_被点击', 1),
    button('forward', '前进', '前进', 384, 84, 58, 40, '_前进_被点击', 1),
    button('reload', '刷新页面', '刷新', 450, 84, 58, 40, '_刷新_被点击', 1),
    button('stop', '停止加载', '停止', 516, 84, 58, 40, '_停止_被点击', 1),
    omnibox('address-input', '地址输入', 'https://www.baidu.com', '搜索或输入网址', 582, 84, 624, 40, '_地址输入_提交'),
    button('navigate', '导航', '打开', 1214, 84, 70, 40, '_导航_被点击', 0),
    button('settings', '实例设置', '实例设置', 1292, 84, 112, 40, '_实例设置_被点击', 1),
    button('more-tools', '更多工具', '更多工具', 1412, 84, 112, 40, '_更多工具_被点击', 1)
  ];

  controls.push({
    id: 'workspace-pages', type: 'TabControl', designerType: 'lingbuilder.new_emoji.ui/Tabs', name: '右侧工作区', content: '右侧工作区',
    x: 316, y: 130, width: 1268, height: 760, fontSize: 12, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: '#FFFFFF', foreground: '#111827', isEnabled: true, visibility: 'Visible',
    properties: {
      items: [
        { id: 'browser-workspace', title: '浏览器', icon: '', closable: false, disabled: false, pinned: false, loading: false, muted: false, alerting: false },
        { id: 'configuration-workspace', title: '全局设置与工具', icon: '', closable: false, disabled: false, pinned: false, loading: false, muted: false, alerting: false }
      ],
      activeIndex: 0, tabType: '0', position: '0', headerAlign: '0', headerVisible: false, closable: false, addable: false, editable: false, contentVisible: true, chromeMode: false, reorderEnabled: false, detachEnabled: false
    }, events: {}
  });
  controls.push(tabChild({
    id: 'browser-host-pages', type: 'TabControl', designerType: 'lingbuilder.new_emoji.ui/Tabs', name: '浏览器Host页面', content: '浏览器Host页面',
    x: 316, y: 130, width: 1268, height: 760, fontSize: 12, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: palette.panelAlt, foreground: palette.text, isEnabled: true, visibility: 'Visible',
    properties: {
      items: [], activeIndex: 0, tabType: '0', position: '0', headerAlign: '0', headerVisible: false,
      closable: false, addable: false, editable: false, contentVisible: false, chromeMode: false, reorderEnabled: false, detachEnabled: false
    }, events: {}
  }, 'workspace-pages', 'browser-workspace'));
  controls.push(tabChild({
    id: 'browser-viewport', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/BrowserViewport', name: '浏览器页面占位', content: '浏览器页面宿主',
    x: browserBounds.x, y: browserBounds.y, width: browserBounds.width, height: browserBounds.height,
    fontSize: 12, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: '#FFFFFFFF', foreground: '#FF111827', isEnabled: true, visibility: 'Visible',
    properties: { state: 4, loading: false, progress: 0, placeholderTitle: '正在创建浏览器实例', placeholderDesc: '每个实例使用独立 FBro Host 进程与 Profile。', placeholderIcon: '', screenshot: '' }, events: {}
  }, 'workspace-pages', 'browser-workspace'));

  controls.push(tabChild(container('configuration-workspace', '全局设置与工具页面', 316, 130, 1268, 760, '#FF111827'), 'workspace-pages', 'configuration-workspace'));
  controls.push(child(container('settings-panel', '实例设置面板', 340, 154, 592, 700, '#FF182235'), 'configuration-workspace'));
  controls.push(child(text('settings-title', '设置标题', '全局设置与当前实例', 374, 182, 360, 32, { align: '0', valign: '1', wrap: false, ellipsis: true }), 'settings-panel'));
  controls.push(child(text('settings-instance', '设置实例提示', '当前：实例 01', 374, 216, 300, 24, { align: '0', valign: '1', wrap: false, ellipsis: true }), 'settings-panel'));
  controls.push(child(text('default-home-label', '默认首页标签', '新实例默认首页', 374, 254, 180, 22), 'settings-panel'));
  controls.push(child(input('default-home-input', '默认首页输入', 'https://www.baidu.com', '添加实例时载入的网址', 374, 280, 524, 40), 'settings-panel'));
  controls.push(child(text('proxy-label', '代理标签', '代理地址', 374, 334, 160, 22), 'settings-panel'));
  controls.push(child(input('proxy-input', '代理输入', '', '留空表示直连，例如 http://127.0.0.1:7890', 374, 360, 524, 40), 'settings-panel'));
  controls.push(child(text('ua-label', 'UserAgent标签', 'User-Agent', 374, 414, 160, 22), 'settings-panel'));
  controls.push(child(input('ua-input', 'UserAgent输入', '', '留空使用 FBro 默认浏览器标识', 374, 440, 524, 40), 'settings-panel'));
  controls.push(child(text('fingerprint-label', '指纹标签', '指纹配置 JSON', 374, 494, 180, 22), 'settings-panel'));
  controls.push(child(input('fingerprint-input', '指纹配置输入', '', '可选：FBro VIP 结构化指纹配置', 374, 520, 524, 76, true), 'settings-panel'));
  controls.push(child(text('size-label', '尺寸标签', '浏览器视口尺寸', 374, 616, 180, 22), 'settings-panel'));
  controls.push(child(input('width-input', '宽度输入', String(browserBounds.width), '宽度', 374, 642, 120, 40), 'settings-panel'));
  controls.push(child(text('size-times', '尺寸乘号', '×', 504, 650, 24, 24, { align: '1', valign: '1', wrap: false, ellipsis: false }), 'settings-panel'));
  controls.push(child(input('height-input', '高度输入', String(browserBounds.height), '高度', 538, 642, 120, 40), 'settings-panel'));
  controls.push(child(text('size-hint', '尺寸提示', `范围：320-${browserBounds.width} × 240-${browserBounds.height}`, 668, 650, 230, 24, { align: '0', valign: '1', wrap: false, ellipsis: true }), 'settings-panel'));
  controls.push(child(button('settings-cancel', '返回浏览器', '返回浏览器', 686, 740, 96, 42, '_设置取消_被点击', 1), 'settings-panel'));
  controls.push(child(button('settings-save', '保存设置', '保存并重建', 790, 740, 108, 42, '_设置保存_被点击', 0), 'settings-panel'));

  controls.push(child(container('tools-panel', '更多工具面板', 956, 154, 604, 700, '#FF182235'), 'configuration-workspace'));
  controls.push(child(text('tools-title', '工具标题', '当前浏览器实例', 988, 180, 260, 32, { align: '0', valign: '1', wrap: false, ellipsis: true }), 'tools-panel'));
  controls.push(child(input('rename-input', '实例名称输入', '', '新的实例名称', 988, 228, 366, 40), 'tools-panel'));
  controls.push(child(button('rename-instance', '重命名实例', '重命名', 1364, 228, 82, 40, '_重命名实例_被点击', 0), 'tools-panel'));
  controls.push(child(button('open-cache', '打开缓存目录', '打开缓存目录', 988, 282, 132, 40, '_打开缓存目录_被点击', 1), 'tools-panel'));
  controls.push(child(button('clear-cache', '清理缓存', '清理缓存', 1130, 282, 112, 40, '_清理缓存_被点击', 1), 'tools-panel'));
  controls.push(child(button('force-reload', '强制刷新', '强制刷新', 1252, 282, 112, 40, '_强制刷新_被点击', 1), 'tools-panel'));
  controls.push(child(button('hide-browser', '隐藏浏览器', '隐藏浏览器', 1374, 282, 112, 40, '_隐藏浏览器_被点击', 1), 'tools-panel'));
  controls.push(child(text('cookie-file-label', 'Cookie文件标签', 'LingBuilder Cookie JSON', 988, 342, 240, 22), 'tools-panel'));
  controls.push(child(input('cookie-file-input', 'Cookie文件输入', '当前实例-cookies.json', '私密文件默认保存在应用数据目录', 988, 368, 498, 40), 'tools-panel'));
  controls.push(child(button('cookie-import-overwrite', '导入Cookie覆盖', '导入并覆盖', 988, 420, 118, 40, '_导入Cookie覆盖_被点击', 0), 'tools-panel'));
  controls.push(child(button('cookie-import-skip', '导入Cookie跳过', '导入并跳过冲突', 1116, 420, 142, 40, '_导入Cookie跳过_被点击', 1), 'tools-panel'));
  controls.push(child(button('cookie-export-site', '导出当前网站Cookie', '导出当前网站', 1268, 420, 118, 40, '_导出当前网站Cookie_被点击', 1), 'tools-panel'));
  controls.push(child(button('cookie-export-all', '导出全部Cookie', '导出全部网站', 1396, 420, 118, 40, '_导出全部Cookie_被点击', 1), 'tools-panel'));
  controls.push(child(button('delete-keep-cache', '删除保留缓存', '删除，保留缓存', 988, 478, 142, 40, '_删除保留缓存_被点击', 1), 'tools-panel'));
  controls.push(child(button('delete-clear-data', '删除并清数据', '删除并清除数据', 1140, 478, 142, 40, '_删除并清数据_被点击', 2), 'tools-panel'));
  controls.push(child(text('plugin-status', '插件状态', '插件状态：加载中', 988, 530, 526, 24, { align: '0', valign: '1', wrap: false, ellipsis: true }), 'tools-panel'));
  controls.push(child(text('log-title', '日志标题', '操作结果', 988, 570, 160, 22), 'tools-panel'));
  controls.push(child(input('log-output', '运行日志', '等待主控初始化。', '运行日志', 988, 596, 526, 100, true), 'tools-panel'));
  controls.push(child(button('tools-close', '关闭工具', '返回浏览器', 1404, 718, 110, 42, '_工具关闭_被点击', 1), 'tools-panel'));

  return {
    schemaVersion: 2,
    id: projectId,
    name: projectName,
    resources: [createNativeBrowserInstanceMenuResource('main-window', 'browser-instance-list')],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 多浏览器管理器',
      width: 1600, height: 920, background: palette.window, titleBarBackground: palette.panelAlt, titleBarForeground: palette.text,
      description: '左侧 RichList 与动态实例 Tabs 一一映射任意数量的独立 FBro Host；设置和工具使用独立工作区页，避免原生浏览器遮挡配置界面。', designerBackend: 'new-emoji', openPlacement: 'center', resizable: false, maximizable: false,
      cornerStyle: 'rounded', iconStyle: 'lingbuilder', events: { Loaded: '_MainWindow_创建完毕', SizeChanged: '_MainWindow_大小被改变', DpiChanged: '_MainWindow_DPI被改变' }, controls
    }]
  };
}

function buildSource(): string {
  return String.raw`类 MainWindow : 公开 窗口
    整数型 下一个实例编号 = 1
    文本型 默认首页 = "https://www.baidu.com"
    逻辑型 配置页打开 = 假

    构造()
        调试输出("FBro 多浏览器管理器正在初始化。")
    结束

    事件 _MainWindow_创建完毕()
        局部 整数型 已恢复数量 = 0
        浏览器外壳_创建(浏览器Host页面, 浏览器页面占位, &浏览器状态改变)
        浏览器外壳_绑定实例列表(浏览器实例列表)
        已恢复数量 = 浏览器外壳_启用实例持久化("new-emoji-fbro-multi-browser-manager")
        如果 (已恢复数量 <= 0)
            添加实例()
        如果结束
        如果 (浏览器外壳_取持久化诊断() != "")
            记录日志(浏览器外壳_取持久化诊断())
        如果结束
        记录日志("主控已就绪：实例使用独立 Host、独立 Profile、原子 JSON 恢复和 exe 同级插件。")
    结束

    空 记录日志(文本型 内容)
        控件_设置文本(运行日志, 格式化文本("{}\r\n{}", 控件_取文本(运行日志), 内容))
        调试输出(内容)
    结束

    空 刷新当前详情()
        控件_设置文本(详情状态, 格式化文本("{} | {}\r\nPID {} | {}", 浏览器外壳_取当前稳定ID(), 浏览器外壳_取当前进程状态(), 浏览器外壳_取当前进程ID(), 浏览器外壳_取当前插件状态()))
        控件_设置文本(插件状态, "插件状态：" + 浏览器外壳_取当前插件状态())
    结束

    空 同步当前地址栏()
        局部 文本型 实例地址 = 浏览器外壳_取地址()
        如果 (实例地址 != "")
            控件_设置文本(地址输入, 实例地址)
        如果结束
    结束

    空 收起当前浏览器工作区()
        浏览器外壳_隐藏当前()
    结束

    空 加载当前设置()
        控件_设置文本(默认首页输入, 默认首页)
        控件_设置文本(设置实例提示, "当前：" + 浏览器外壳_取当前稳定ID())
        控件_设置文本(代理输入, 浏览器外壳_取当前代理())
        控件_设置文本(UserAgent输入, 浏览器外壳_取当前UserAgent())
        控件_设置文本(指纹配置输入, 浏览器外壳_取当前指纹配置())
        控件_设置文本(宽度输入, 格式化文本("{}", 浏览器外壳_取当前视口宽度()))
        控件_设置文本(高度输入, 格式化文本("{}", 浏览器外壳_取当前视口高度()))
        控件_设置文本(实例名称输入, 浏览器外壳_取标题())
        控件_设置文本(插件状态, "插件状态：" + 浏览器外壳_取当前插件状态())
    结束

    空 保存当前设置()
        局部 整数型 浏览器宽度 = 0
        局部 整数型 浏览器高度 = 0
        浏览器宽度 = 到整数(控件_取文本(宽度输入))
        浏览器高度 = 到整数(控件_取文本(高度输入))
        默认首页 = 控件_取文本(默认首页输入)
        如果 (默认首页 == "")
            默认首页 = "https://www.baidu.com"
        如果结束
        如果 (浏览器宽度 < 320)
            浏览器宽度 = 320
        如果结束
        如果 (浏览器宽度 > ${browserBounds.width})
            浏览器宽度 = ${browserBounds.width}
        如果结束
        如果 (浏览器高度 < 240)
            浏览器高度 = 240
        如果结束
        如果 (浏览器高度 > ${browserBounds.height})
            浏览器高度 = ${browserBounds.height}
        如果结束
        如果 (浏览器外壳_按配置重建当前(控件_取文本(代理输入), 控件_取文本(UserAgent输入), 控件_取文本(指纹配置输入), 浏览器宽度, 浏览器高度))
            记录日志("当前实例已按独立 Profile、代理、User-Agent、指纹和视口尺寸重建。")
        否则
            记录日志("当前实例重建失败：" + 浏览器外壳_取当前错误())
        如果结束
    结束

    空 打开实例设置()
        加载当前设置()
        配置页打开 = 真
        收起当前浏览器工作区()
        控件_设置选择项(右侧工作区, 1)
        记录日志("已切换到全局设置与工具页。")
    结束

    空 打开更多工具()
        打开实例设置()
    结束

    空 添加实例()
        局部 文本型 稳定ID = 浏览器外壳_生成稳定实例ID()
        局部 文本型 实例标题 = 格式化文本("实例 {}", 下一个实例编号)
        如果 (浏览器外壳_新建独立实例(稳定ID, 默认首页, 实例标题, "profiles/" + 稳定ID))
            下一个实例编号 = 下一个实例编号 + 1
            控件_设置选择项(右侧工作区, 0)
            控件_设置文本(地址输入, 默认首页)
            记录日志("已创建 " + 稳定ID + "，使用独立 Host、WebSocket 和 Profile。")
        否则
            记录日志("创建实例失败：请检查 FBro 运行时或当前系统内存、句柄和进程资源。")
        如果结束
    结束

    空 返回浏览器工作区()
        配置页打开 = 假
        控件_设置选择项(右侧工作区, 0)
        浏览器外壳_显示当前()
        同步当前地址栏()
        刷新当前详情()
    结束

    空 导航当前()
        浏览器外壳_导航(控件_取文本(地址输入))
        刷新当前详情()
    结束

    事件 _浏览器实例列表_选择变化(文本型 选中键列表)
        如果 (配置页打开 == 假)
            浏览器外壳_选择列表键(选中键列表)
            同步当前地址栏()
            刷新当前详情()
        如果结束
    结束

    事件 _浏览器实例列表_右键菜单(文本型 事件数据)
        记录日志(浏览器外壳_处理实例列表动作(事件数据))
        弹出菜单_显示(浏览器实例右键菜单)
    结束

    事件 浏览器状态改变(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)
        控件_设置文本(地址输入, 地址)
        刷新当前详情()
    结束

    事件 _地址输入_提交(文本型 地址)
        如果 (地址 != "")
            控件_设置文本(地址输入, 地址)
            导航当前()
        如果结束
    结束

    事件 _导航_被点击()
        导航当前()
    结束
    事件 _刷新_被点击()
        浏览器外壳_刷新()
    结束
    事件 _强制刷新_被点击()
        浏览器外壳_强制刷新()
    结束
    事件 _后退_被点击()
        浏览器外壳_后退()
    结束
    事件 _前进_被点击()
        浏览器外壳_前进()
    结束
    事件 _停止_被点击()
        浏览器外壳_停止()
    结束
    事件 _添加实例_被点击()
        添加实例()
    结束
    事件 _全局设置_被点击()
        打开实例设置()
    结束
    事件 _实例设置_被点击()
        打开实例设置()
    结束
    事件 _更多工具_被点击()
        打开更多工具()
    结束
    事件 _设置取消_被点击()
        返回浏览器工作区()
    结束
    事件 _设置保存_被点击()
        保存当前设置()
        返回浏览器工作区()
    结束
    事件 _工具关闭_被点击()
        返回浏览器工作区()
    结束
    事件 _重命名实例_被点击()
        如果 (浏览器外壳_重命名实例(浏览器外壳_取当前稳定ID(), 控件_取文本(实例名称输入)))
            记录日志("实例已重命名；稳定 ID 和缓存目录保持不变。")
        否则
            记录日志("重命名失败：名称不能为空且不能超过 80 个字符。")
        如果结束
    结束
    事件 _打开缓存目录_被点击()
        如果 (浏览器外壳_打开实例缓存目录(浏览器外壳_取当前稳定ID()) == 假)
            记录日志("缓存目录未通过受管路径校验，未打开。")
        如果结束
    结束
    事件 _清理缓存_被点击()
        如果 (浏览器外壳_清理实例缓存(浏览器外壳_取当前稳定ID(), 假))
            记录日志("当前实例缓存和站点存储已清理，Cookie 已保留。")
        否则
            记录日志("缓存清理已取消或失败：" + 浏览器外壳_取当前错误())
        如果结束
    结束
    事件 _导入Cookie覆盖_被点击()
        记录日志(浏览器外壳_导入实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 真, 假))
    结束
    事件 _导入Cookie跳过_被点击()
        记录日志(浏览器外壳_导入实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 假, 假))
    结束
    事件 _导出当前网站Cookie_被点击()
        记录日志(浏览器外壳_导出实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 假))
    结束
    事件 _导出全部Cookie_被点击()
        记录日志(浏览器外壳_导出实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 真))
    结束
    事件 _删除保留缓存_被点击()
        记录日志(浏览器外壳_确认删除实例(浏览器外壳_取当前稳定ID(), 假))
        返回浏览器工作区()
    结束
    事件 _删除并清数据_被点击()
        记录日志(浏览器外壳_确认删除实例(浏览器外壳_取当前稳定ID(), 真))
        返回浏览器工作区()
    结束
    事件 _隐藏浏览器_被点击()
        浏览器外壳_隐藏当前()
        配置页打开 = 假
        控件_设置选择项(右侧工作区, 0)
        记录日志("当前浏览器已隐藏，可在左侧实例列表重新选择该实例恢复。")
    结束

    事件 _浏览器菜单_打开()
        返回浏览器工作区()
    结束
    事件 _浏览器菜单_重命名()
        打开更多工具()
        记录日志("请在实例名称输入框修改名称后点击“重命名”。")
    结束
    事件 _浏览器菜单_导入Cookie()
        记录日志(浏览器外壳_导入实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 真, 假))
    结束
    事件 _浏览器菜单_导出当前网站Cookie()
        记录日志(浏览器外壳_导出实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 假))
    结束
    事件 _浏览器菜单_导出全部Cookie()
        记录日志(浏览器外壳_导出实例Cookie(浏览器外壳_取当前稳定ID(), 控件_取文本(Cookie文件输入), 真))
    结束
    事件 _浏览器菜单_打开缓存目录()
        如果 (浏览器外壳_打开实例缓存目录(浏览器外壳_取当前稳定ID()) == 假)
            记录日志("缓存目录未通过受管路径校验，未打开。")
        如果结束
    结束
    事件 _浏览器菜单_清理缓存()
        如果 (浏览器外壳_清理实例缓存(浏览器外壳_取当前稳定ID(), 假))
            记录日志("当前实例缓存和站点存储已清理，Cookie 已保留。")
        否则
            记录日志("缓存清理已取消或失败：" + 浏览器外壳_取当前错误())
        如果结束
    结束
    事件 _浏览器菜单_删除保留缓存()
        记录日志(浏览器外壳_确认删除实例(浏览器外壳_取当前稳定ID(), 假))
        返回浏览器工作区()
    结束
    事件 _浏览器菜单_删除并清数据()
        记录日志(浏览器外壳_确认删除实例(浏览器外壳_取当前稳定ID(), 真))
        返回浏览器工作区()
    结束

    事件 _MainWindow_大小被改变()
        刷新当前详情()
    结束
    事件 _MainWindow_DPI被改变(整数型 新DPI)
        刷新当前详情()
    结束
结束类
`;
}

async function main(): Promise<void> {
  const sourceDirectory = path.join(repositoryRoot, 'src', projectId);
  const designerDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const configDirectory = path.join(repositoryRoot, 'config', projectId);
  const updateExisting = process.argv.includes('--update');
  if (!updateExisting) {
    for (const target of [sourceDirectory, designerDirectory]) {
      try {
        await fs.access(target);
        throw new Error(`项目目录已存在，拒绝覆盖：${target}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const solutionService = createSolutionService(repositoryRoot);
    await solutionService.createProject({ name: projectName, projectId, templateId: 'blank-window', windowTitle: 'FBro 多浏览器管理器' });
  } else {
    await Promise.all([
      fs.mkdir(sourceDirectory, { recursive: true }),
      fs.mkdir(designerDirectory, { recursive: true }),
      fs.mkdir(configDirectory, { recursive: true })
    ]);
  }

  const designerProject = createProject();
  await fs.writeFile(path.join(designerDirectory, 'window-designer.json'), JSON.stringify(designerProject, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(designerDirectory, 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: moduleIds,
    pinnedVersions: {
      'lingbuilder.win32.basic': '1.0.0',
      'lingbuilder.std.text': '1.0.0',
      'lingbuilder.new_emoji.ui': '2.0.0',
      'lingbuilder.fbro.browser': '2.2.0',
      'lingbuilder.new_emoji.fbro-shell': '1.1.0',
      'lingbuilder.browser.doubao-downloader': '2.0.4'
    }
  }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(repositoryRoot, '.lingbuilder', 'build-configuration.json'), JSON.stringify({ schemaVersion: 1, mode: 'Debug', architecture: 'x64' }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'MainWindow.lcpp'), buildSource(), 'utf8');
  await fs.writeFile(path.join(configDirectory, 'browser-instances.json'), JSON.stringify(createPortableBrowserWorkspaceConfig({
    id: 'browser-default',
    name: '浏览器 1',
    lastUrl: 'https://www.baidu.com',
    createdAt: '2026-08-08T00:00:00.000Z'
  }), null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'README.md'), `# new_emoji FBro 多浏览器管理器

这是一个可运行的 new_emoji 原生工作台。主程序通过 FBro 2.2 独立 Host 模式，以随机回环 WebSocket 和一次性 Token 动态调度浏览器进程，不设置固定实例数量上限。

## 实例、HWND 与切换

每次点击“添加实例”，运行时都会生成不会因重命名改变的随机稳定 ID，并创建独立 Host 进程、独立 Profile、独立伴随宿主 HWND 和独立 Chromium 浏览器 HWND。左侧 RichList 是唯一可见的实例导航；右侧 Tabs 表头完全隐藏且不占布局空间。切换时先显示、定位并聚焦目标 HWND，再隐藏其它 HWND；未关闭实例保持运行。

RichList 右键菜单由统一 BrowserWorkbench 命令/菜单契约生成，包含打开、重命名、Cookie 导入导出、打开/清理缓存，以及“保留数据”与“清除数据”两种删除策略。删除最后一个实例会被阻止；清除数据需要两次确认并校验目标位于当前工作台受管 profiles 根目录。

## 持久化与插件

实例正式状态保存在 %LocalAppData%/LingBuilder/browser-workspaces/new-emoji-fbro-multi-browser-manager/browser-instances.json。写入使用临时文件、备份和原子替换；主配置损坏时先尝试 .bak，并保留损坏文件。项目内 config/new-emoji-fbro-multi-browser-manager/browser-instances.json 只保存可迁移结构和 profiles/<稳定ID> 相对路径，不包含本机浏览器数据。

每个 RequestContext 都在创建浏览器前加载 exe 同级 doubao-downloader 目录。路径由 GetModuleFileNameW 得到真实 exe 位置，不依赖工作目录或开发机绝对路径。插件缺失、清单损坏、版本不支持或 FBro 拒绝加载只会更新中文状态，不会导致整个工作台退出。

## Cookie 与分享包

Cookie 导入导出操作当前选中 Host 的真实 CookieManager。LingBuilder Cookie JSON 保留 name、value、domain、path、expires、httpOnly、secure、sameSite、priority 和 session；导入前显示有效、无效、过期、冲突和域名统计，默认跳过无效及过期记录，并可覆盖或跳过冲突。普通日志只记录数量和结果，不写 Cookie 明文。

在 LingBuilder 中使用“项目 -> 一键导出当前项目源码包”或命令“浏览器工作台：一键导出多浏览器工作台分享包”生成 .lcpppkg。分享包携带源码、设计器、相对实例结构、模块文档、FBro SDK 支持资产和 doubao-downloader 运行资源；Cookie、Profile、缓存、localStorage、IndexedDB、凭据、构建缓存和本机绝对路径会被排除。导入到新目录后，本机首次运行重新创建独立 LocalAppData Profile。

## 平台限制

当前构建目标是 Windows MSVC x64，并依赖合法的 FBro CEF 135/VIP 运行时。实例数量最终受系统内存、句柄、进程和 FBro/CEF 资源约束；资源不足时返回中文失败状态，不会共享其它实例的 Profile 或 HWND。
`, 'utf8');
  console.log(JSON.stringify({ ok: true, updateExisting, projectId, sourceDirectory, designerDirectory, controls: designerProject.windows[0]!.controls.length }, null, 2));
}

void main();
