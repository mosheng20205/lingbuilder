import fs from 'node:fs/promises';
import path from 'node:path';
import { createPortableBrowserWorkspaceConfig } from '../src/services/browserWorkbench/browserInstanceService';
import { createNativeBrowserInstanceMenuResource } from '../src/services/browserWorkbench/browserWorkbenchCommands';
import { createSolutionService } from '../src/services/solution/solutionService';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'win32-fbro-multi-browser-manager';
const projectName = '独立浏览器管理器';
const moduleIds = [
  'lingbuilder.win32.basic',
  'lingbuilder.win32.common-controls',
  'lingbuilder.fbro.browser',
  'lingbuilder.browser.doubao-downloader'
] as const;

const colors = {
  window: '#16181D',
  surface: '#202329',
  surfaceAlt: '#292D34',
  text: '#F3F4F6',
  muted: '#A7ADB7',
  border: '#414650',
  primary: '#1473E6',
  danger: '#B83A3A'
};

function control(type: LingControl['type'], id: string, name: string, content: string,
  x: number, y: number, width: number, height: number,
  properties: LingControl['properties'] = {}, events: LingControl['events'] = {}): LingControl {
  return {
    id, type, name, content, x, y, width, height,
    fontSize: 13, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false,
    background: type === 'Button' ? colors.surfaceAlt : type === 'Label' ? 'transparent' : colors.surface,
    foreground: colors.text, isEnabled: true, visibility: 'Visible', properties, events
  };
}

function button(id: string, name: string, text: string, x: number, y: number, width: number,
  eventHandler: string, danger = false): LingControl {
  const result = control('Button', id, name, text, x, y, width, 32, { buttonStyle: 'push', cornerRadius: 3 }, { Click: eventHandler });
  result.background = danger ? colors.danger : colors.surfaceAlt;
  return result;
}

function createProject(): LingWindowProject {
  const controls: LingControl[] = [
    { ...control('Label', 'browser-title', '浏览器列表标题', '浏览器实例', 14, 14, 150, 28), fontSize: 16, fontBold: true },
    button('add-browser', '添加浏览器', '添加', 178, 12, 72, '_添加浏览器_被单击'),
    control('ListBox', 'browser-list', '浏览器实例列表', '', 12, 50, 244, 236, {
      items: [], selectedIndex: -1, sorted: false, multiple: false, itemHeight: 34, itemSpacing: 2,
      contentPadding: 5, showBorder: true, borderColor: colors.border, borderWidth: 1,
      selectionStartColor: '#164E86', selectionEndColor: '#1769AA', selectionBorderColor: '#3B82F6'
    }, { SelectionChanged: '_浏览器实例列表_选择变化', DoubleClick: '_浏览器实例列表_双击' }),
    control('Label', 'name-label', '名称标签', '实例名称', 14, 298, 100, 22),
    control('TextBox', 'name-input', '实例名称输入', '浏览器 2', 12, 322, 160, 32, { multiline: false }),
    button('rename-browser', '重命名浏览器', '重命名', 180, 322, 76, '_重命名_被单击'),
    control('Label', 'cookie-label', 'Cookie文件标签', 'Cookie JSON 文件', 14, 366, 160, 22),
    control('TextBox', 'cookie-input', 'Cookie文件输入', 'cookies.lingbuilder.json', 12, 390, 244, 32, { multiline: false }),
    button('cookie-import', '导入Cookie', '导入覆盖', 12, 430, 76, '_导入Cookie_被单击'),
    button('cookie-export-site', '导出当前Cookie', '导出当前', 92, 430, 76, '_导出当前Cookie_被单击'),
    button('cookie-export-all', '导出全部Cookie', '导出全部', 172, 430, 84, '_导出全部Cookie_被单击'),
    button('open-cache', '打开缓存目录', '打开缓存', 12, 472, 76, '_打开缓存_被单击'),
    button('clear-cache', '清理缓存', '清理缓存', 92, 472, 76, '_清理缓存_被单击'),
    button('delete-retain', '删除保留数据', '移除实例', 12, 514, 116, '_删除保留数据_被单击'),
    button('delete-clear', '删除并清理数据', '删除并清数据', 136, 514, 120, '_删除并清数据_被单击', true),
    { ...control('TextBox', 'instance-detail', '实例详情', '等待浏览器管理器初始化', 12, 560, 244, 114, {
      multiline: true, readOnly: true, scrollBars: 'none', align: 'left', verticalAlign: 'top'
    }), fontSize: 12 },
    control('ProgressBar', 'download-progress', '下载进度', '0', 12, 678, 154, 26, {
      minimum: 0, maximum: 100, value: 0, marquee: false
    }),
    { ...button('open-download', '打开下载目录', '打开目录', 174, 678, 82, '_打开下载目录_被单击'), height: 26 },

    button('back', '后退', '←', 280, 14, 40, '_后退_被单击'),
    button('forward', '前进', '→', 326, 14, 40, '_前进_被单击'),
    button('reload', '刷新', '刷新', 372, 14, 54, '_刷新_被单击'),
    control('TextBox', 'address-input', '地址输入', 'https://www.doubao.com/', 434, 14, 684, 32, { multiline: false }),
    button('navigate', '打开地址', '打开', 1126, 14, 58, '_打开地址_被单击'),
    button('more', '更多操作', '更多', 1192, 14, 70, '_更多_被单击'),
    control('TabControl', 'browser-pages', '浏览器页面', '', 278, 54, 986, 640, {
      tabs: [{ id: 'bootstrap', title: '', image: -1 }], selectedIndex: 0, hideHeader: true, imageListId: ''
    }),
    control('Label', 'current-status', '当前状态', '当前实例：未初始化', 280, 704, 600, 28),
    control('Label', 'plugin-status', '插件状态', '插件：等待加载', 890, 704, 372, 28)
  ];

  return {
    schemaVersion: 2,
    id: projectId,
    name: projectName,
    resources: [createNativeBrowserInstanceMenuResource('main-window', 'browser-list')],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: projectName,
      width: 1280, height: 760, background: colors.window,
      titleBarBackground: colors.window, titleBarForeground: colors.text,
      description: '普通 Win32 控件构成的多实例独立 FBro 浏览器管理器。',
      designerBackend: 'win32', openPlacement: 'center', resizable: true, maximizable: true,
      cornerStyle: 'system', iconStyle: 'lingbuilder',
      events: { Loaded: '_MainWindow_创建完毕', SizeChanged: '_MainWindow_大小被改变', DpiChanged: '_MainWindow_DPI被改变' },
      controls
    }]
  };
}

function buildSource(): string {
  return String.raw`类 MainWindow : 公开 窗口
    整数型 下一个实例编号 = 2

    事件 _MainWindow_创建完毕()
        局部 整数型 已恢复数量 = 0
        已恢复数量 = 浏览器管理器_初始化(浏览器页面, 浏览器实例列表, "win32-fbro-multi-browser-manager")
        浏览器管理器_绑定地址栏(地址输入)
        浏览器管理器_绑定下载视图(实例详情, 下载进度)
        调整布局()
        如果 (已恢复数量 <= 0)
            控件_设置文本(当前状态, "浏览器管理器初始化失败：" + 浏览器管理器_取当前错误())
        否则
            下一个实例编号 = 已恢复数量 + 1
            刷新详情()
        如果结束
        如果 (浏览器管理器_取持久化诊断() != "")
            信息框(浏览器管理器_取持久化诊断(), 64, "独立浏览器管理器")
        如果结束
    结束

    空 刷新详情()
        控件_设置文本(地址输入, 浏览器管理器_取当前地址())
        控件_设置文本(实例名称输入, 浏览器管理器_取当前名称())
        控件_设置文本(当前状态, "当前实例：" + 浏览器管理器_取当前稳定ID() + " | " + 浏览器管理器_取当前进程状态())
        控件_设置文本(插件状态, "插件：" + 浏览器管理器_取当前插件状态())
        浏览器管理器_绑定下载视图(实例详情, 下载进度)
    结束

    空 调整布局()
        局部 整数型 窗口宽度 = 窗口_取事件宽度()
        局部 整数型 窗口高度 = 窗口_取事件高度()
        局部 整数型 当前DPI = 窗口_取事件DPI()
        如果 (当前DPI <= 0)
            当前DPI = 96
        如果结束
        如果 (窗口宽度 <= 0)
            窗口宽度 = 1280 * 当前DPI / 96
        如果结束
        如果 (窗口高度 <= 0)
            窗口高度 = 732 * 当前DPI / 96
        如果结束
        如果 (窗口宽度 < 900 * 当前DPI / 96)
            窗口宽度 = 900 * 当前DPI / 96
        如果结束
        如果 (窗口高度 < 640 * 当前DPI / 96)
            窗口高度 = 640 * 当前DPI / 96
        如果结束

        控件_设置位置大小(后退, 280 * 当前DPI / 96, 14 * 当前DPI / 96, 40 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(前进, 326 * 当前DPI / 96, 14 * 当前DPI / 96, 40 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(刷新, 372 * 当前DPI / 96, 14 * 当前DPI / 96, 54 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(地址输入, 434 * 当前DPI / 96, 14 * 当前DPI / 96, 窗口宽度 - 596 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(打开地址, 窗口宽度 - 154 * 当前DPI / 96, 14 * 当前DPI / 96, 58 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(更多操作, 窗口宽度 - 88 * 当前DPI / 96, 14 * 当前DPI / 96, 70 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(浏览器实例列表, 12 * 当前DPI / 96, 50 * 当前DPI / 96, 244 * 当前DPI / 96, 窗口高度 - 496 * 当前DPI / 96)
        控件_设置位置大小(名称标签, 14 * 当前DPI / 96, 窗口高度 - 434 * 当前DPI / 96, 100 * 当前DPI / 96, 22 * 当前DPI / 96)
        控件_设置位置大小(实例名称输入, 12 * 当前DPI / 96, 窗口高度 - 410 * 当前DPI / 96, 160 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(重命名浏览器, 180 * 当前DPI / 96, 窗口高度 - 410 * 当前DPI / 96, 76 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(Cookie文件标签, 14 * 当前DPI / 96, 窗口高度 - 366 * 当前DPI / 96, 160 * 当前DPI / 96, 22 * 当前DPI / 96)
        控件_设置位置大小(Cookie文件输入, 12 * 当前DPI / 96, 窗口高度 - 342 * 当前DPI / 96, 244 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(导入Cookie, 12 * 当前DPI / 96, 窗口高度 - 302 * 当前DPI / 96, 76 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(导出当前Cookie, 92 * 当前DPI / 96, 窗口高度 - 302 * 当前DPI / 96, 76 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(导出全部Cookie, 172 * 当前DPI / 96, 窗口高度 - 302 * 当前DPI / 96, 84 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(打开缓存目录, 12 * 当前DPI / 96, 窗口高度 - 260 * 当前DPI / 96, 76 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(清理缓存, 92 * 当前DPI / 96, 窗口高度 - 260 * 当前DPI / 96, 76 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(删除保留数据, 12 * 当前DPI / 96, 窗口高度 - 218 * 当前DPI / 96, 116 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(删除并清理数据, 136 * 当前DPI / 96, 窗口高度 - 218 * 当前DPI / 96, 120 * 当前DPI / 96, 32 * 当前DPI / 96)
        控件_设置位置大小(实例详情, 12 * 当前DPI / 96, 窗口高度 - 172 * 当前DPI / 96, 244 * 当前DPI / 96, 114 * 当前DPI / 96)
        控件_设置位置大小(下载进度, 12 * 当前DPI / 96, 窗口高度 - 54 * 当前DPI / 96, 154 * 当前DPI / 96, 26 * 当前DPI / 96)
        控件_设置位置大小(打开下载目录, 174 * 当前DPI / 96, 窗口高度 - 54 * 当前DPI / 96, 82 * 当前DPI / 96, 26 * 当前DPI / 96)
        控件_设置位置大小(浏览器页面, 278 * 当前DPI / 96, 54 * 当前DPI / 96, 窗口宽度 - 294 * 当前DPI / 96, 窗口高度 - 92 * 当前DPI / 96)
        控件_设置位置大小(当前状态, 280 * 当前DPI / 96, 窗口高度 - 28 * 当前DPI / 96, 窗口宽度 - 680 * 当前DPI / 96, 28 * 当前DPI / 96)
        控件_设置位置大小(插件状态, 窗口宽度 - 390 * 当前DPI / 96, 窗口高度 - 28 * 当前DPI / 96, 372 * 当前DPI / 96, 28 * 当前DPI / 96)
    结束

    事件 _浏览器实例列表_选择变化()
        如果 (浏览器管理器_切换索引(控件_取选择项(浏览器实例列表)))
            刷新详情()
        如果结束
    结束

    事件 _浏览器实例列表_双击()
        浏览器管理器_切换索引(控件_取选择项(浏览器实例列表))
        刷新详情()
    结束

    事件 _添加浏览器_被单击()
        如果 (浏览器管理器_新增实例("浏览器 " + 到文本(下一个实例编号), "https://www.doubao.com/"))
            下一个实例编号 = 下一个实例编号 + 1
            刷新详情()
        否则
            信息框("新增实例失败：" + 浏览器管理器_取当前错误(), 16, "独立浏览器管理器")
        如果结束
    结束

    事件 _重命名_被单击()
        如果 (浏览器管理器_重命名当前(控件_取文本(实例名称输入)))
            刷新详情()
        否则
            信息框("实例名称不能为空且不能超过 80 个字符。", 48, "独立浏览器管理器")
        如果结束
    结束

    事件 _打开地址_被单击()
        如果 (浏览器管理器_导航(控件_取文本(地址输入)) == 假)
            信息框("地址不能为空，或当前浏览器暂时无法导航。", 48, "独立浏览器管理器")
        如果结束
        刷新详情()
    结束

    事件 _后退_被单击()
        浏览器管理器_后退()
    结束
    事件 _前进_被单击()
        浏览器管理器_前进()
    结束
    事件 _刷新_被单击()
        浏览器管理器_刷新()
    结束
    事件 _更多_被单击()
        信息框("当前实例：" + 浏览器管理器_取当前名称() + "\r\n稳定 ID：" + 浏览器管理器_取当前稳定ID() + "\r\nProfile：" + 浏览器管理器_取当前缓存目录(), 64, "独立浏览器管理器")
    结束

    事件 _导入Cookie_被单击()
        信息框(浏览器管理器_导入Cookie(控件_取文本(Cookie文件输入), 真), 64, "Cookie 导入")
        刷新详情()
    结束
    事件 _导出当前Cookie_被单击()
        信息框(浏览器管理器_导出Cookie(控件_取文本(Cookie文件输入), 假), 64, "Cookie 导出")
    结束
    事件 _导出全部Cookie_被单击()
        信息框(浏览器管理器_导出Cookie(控件_取文本(Cookie文件输入), 真), 64, "Cookie 导出")
    结束
    事件 _打开缓存_被单击()
        如果 (浏览器管理器_打开当前缓存目录() == 假)
            信息框("缓存目录未通过受管路径校验，未打开。", 16, "独立浏览器管理器")
        如果结束
    结束
    事件 _打开下载目录_被单击()
        如果 (浏览器管理器_打开当前下载目录() == 假)
            信息框("当前实例还没有可打开的下载目录。", 48, "独立浏览器管理器")
        如果结束
    结束
    事件 _清理缓存_被单击()
        如果 (浏览器管理器_清理当前缓存(假))
            信息框("当前实例缓存和站点存储已清理，Cookie 已保留。", 64, "独立浏览器管理器")
        如果结束
    结束
    事件 _删除保留数据_被单击()
        信息框(浏览器管理器_删除当前(假), 64, "独立浏览器管理器")
        刷新详情()
    结束
    事件 _删除并清数据_被单击()
        信息框(浏览器管理器_删除当前(真), 64, "独立浏览器管理器")
        刷新详情()
    结束

    事件 _浏览器菜单_打开()
        浏览器管理器_切换索引(控件_取选择项(浏览器实例列表))
        刷新详情()
    结束
    事件 _浏览器菜单_重命名()
        信息框("请在左侧实例名称框中输入新名称，然后点击“重命名”。", 64, "独立浏览器管理器")
    结束
    事件 _浏览器菜单_导入Cookie()
        信息框(浏览器管理器_导入Cookie(控件_取文本(Cookie文件输入), 真), 64, "Cookie 导入")
    结束
    事件 _浏览器菜单_导出当前网站Cookie()
        信息框(浏览器管理器_导出Cookie(控件_取文本(Cookie文件输入), 假), 64, "Cookie 导出")
    结束
    事件 _浏览器菜单_导出全部Cookie()
        信息框(浏览器管理器_导出Cookie(控件_取文本(Cookie文件输入), 真), 64, "Cookie 导出")
    结束
    事件 _浏览器菜单_打开缓存目录()
        浏览器管理器_打开当前缓存目录()
    结束
    事件 _浏览器菜单_清理缓存()
        浏览器管理器_清理当前缓存(假)
    结束
    事件 _浏览器菜单_删除保留缓存()
        信息框(浏览器管理器_删除当前(假), 64, "独立浏览器管理器")
        刷新详情()
    结束
    事件 _浏览器菜单_删除并清数据()
        信息框(浏览器管理器_删除当前(真), 64, "独立浏览器管理器")
        刷新详情()
    结束

    事件 _MainWindow_大小被改变()
        调整布局()
        刷新详情()
    结束
    事件 _MainWindow_DPI被改变(整数型 新DPI)
        调整布局()
        刷新详情()
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
    await createSolutionService(repositoryRoot).createProject({
      name: projectName, projectId, templateId: 'blank-window', windowTitle: projectName
    });
  } else {
    await Promise.all([
      fs.mkdir(sourceDirectory, { recursive: true }),
      fs.mkdir(designerDirectory, { recursive: true }),
      fs.mkdir(configDirectory, { recursive: true })
    ]);
  }

  const project = createProject();
  await fs.writeFile(path.join(designerDirectory, 'window-designer.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(designerDirectory, 'project-modules.json'), `${JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: moduleIds,
    pinnedVersions: {
      'lingbuilder.win32.basic': '1.0.0',
      'lingbuilder.win32.common-controls': '1.0.0',
      'lingbuilder.fbro.browser': '2.4.0',
      'lingbuilder.browser.doubao-downloader': '2.0.4'
    }
  }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(repositoryRoot, '.lingbuilder', 'build-configuration.json'), `${JSON.stringify({
    schemaVersion: 1, mode: 'Release', architecture: 'x64'
  }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'MainWindow.lcpp'), buildSource(), 'utf8');
  await fs.writeFile(path.join(configDirectory, 'browser-instances.json'), `${JSON.stringify(createPortableBrowserWorkspaceConfig({
    id: 'browser-default', name: '浏览器 1', lastUrl: 'https://www.doubao.com/', createdAt: '2026-08-08T00:00:00.000Z'
  }), null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'README.md'), `# 独立浏览器管理器

本项目的可视界面仅使用 \`lingbuilder.win32.basic\` 与 \`lingbuilder.win32.common-controls\`。左侧 Win32 ListBox 是唯一实例导航；右侧 Win32 TabControl 隐藏表头，每个实例拥有独立页面 HWND、独立 FBro Host 进程和独立 Profile。

运行时元数据保存在 \`%LocalAppData%/LingBuilder/browser-workspaces/${projectId}/browser-instances.json\`，采用 UTF-8 JSON、临时文件、备份和原子替换。项目内的 \`config/${projectId}/browser-instances.json\` 仅是可迁移默认结构，不含 Cookie、登录状态或本机路径。

每个 Host 仅启用 Chrome Runtime；在已启用 FBro VIP 高级扩展能力后，先创建独立 RequestContext，立即调用其 VIP \`LoadExtension\` 正式加载 EXE 同级 \`doubao-downloader\`，最后才创建浏览器。该顺序与 FBro C# 独立浏览器示例一致。插件需要有效的 FBro VIP 授权；授权或加载失败时普通浏览器仍可运行。部署路径和扩展 ID 仅说明注册结果，当前页面还会执行受控 DOM 检查：只有检测到扩展注入的 \`doubao-downloader\` 元素才显示“插件已生效”；不匹配的页面会明确显示“当前页面不适用”或“未在当前页面生效”。Cookie 导入导出直接使用当前 Host 的 FBro CookieManager；普通日志和运行快照不会记录 Cookie 值。

网页请求打开新窗口时，Bridge 会让当前 Frame 加载目标地址并取消 popup，因此不会额外创建浏览器窗口、Host 或 Profile。

FBro 下载开始和进度更新事件会按稳定实例 ID 回传。左侧只读详情框实时显示最近下载状态、文件名和完整目录；详情区固定为可完整显示四行信息的高度、不常驻滚动条，长内容自动换行。窗口高度变化时由上方实例列表伸缩，详情和操作区整体贴近底部。“打开下载目录”只会打开 FBro 已报告且当前真实存在的目录。下载监听保持 Chromium 默认下载路径，不会因为管理器观察事件而暂停或取消下载。

地址栏不会限制为 HTTP(S)。\`about:blank\`、\`file:///...\`、\`view-source:\` 等地址会原样交给当前 FBro/Chromium 实例；仅空地址和包含换行控制字符的输入会在进入 Host 前被拒绝。独立嵌入的 FBro Alloy 模式没有 Chromium 的原生扩展管理页，因此输入 \`chrome://extensions/\` 会在当前实例中打开受管诊断页，同时地址栏仍显示该逻辑地址。诊断页显示扩展清单、VIP 注册、扩展 ID、部署路径和当前页面 DOM 验证结果，不能把“已注册”误认为“已生效”。

FBro CEF 135 运行时当前仅提供 MSVC x64 资产，因此原生应用使用 Win32 API 界面后端并以 x64 架构编译。
`, 'utf8');
  console.log(JSON.stringify({ ok: true, projectId, sourceDirectory, designerDirectory, controls: project.windows[0]?.controls.length }, null, 2));
}

void main();
