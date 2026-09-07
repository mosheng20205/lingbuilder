import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const root = path.join(repoRoot, 'AI 视频自主生产', 'CEF3 浏览器模块合集');
const GENERATED_AT = '2026-09-05';

const CEF3_VERSION = '3.0.0-alpha.3';
const BASIC = 'lingbuilder.win32.basic';

type Control = Record<string, any>;

const page = (title: string, body: string, accent = '#2563EB') =>
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${title}</title>`
  + `<style>body{font-family:"Microsoft YaHei UI",sans-serif;background:#f8fafc;color:#0f172a;padding:40px}`
  + `main{max-width:760px;margin:auto;background:#fff;border-left:6px solid ${accent};padding:24px 28px;border-radius:8px}`
  + `h1{margin:0 0 12px;font-size:24px}p{line-height:1.8;margin:6px 0}code{background:#e2e8f0;padding:2px 6px;border-radius:4px}</style>`
  + `<main><h1>${title}</h1>${body}</main>`;

/** 1×1 PNG，仅用于在本地测试页产生一条真实的图片资源响应。 */
const PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const label = (id: string, name: string, content: string, x: number, y: number, width: number, height = 30, extra: Control = {}): Control => ({
  id, type: 'Label', name, content, x, y, width, height,
  fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#1E293B', foreground: '#E2E8F0',
  isEnabled: true, visibility: 'Visible', properties: { staticStyle: 'text', textAlign: 'left' }, ...extra
});

const button = (id: string, name: string, content: string, x: number, y: number, width: number, height = 32): Control => ({
  id, type: 'Button', name, content, x, y, width, height,
  fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#2563EB', foreground: '#FFFFFF',
  isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 },
  events: { Click: `_${name}_被单击` }
});

const textBox = (id: string, name: string, content: string, x: number, y: number, width: number, height = 32): Control => ({
  id, type: 'TextBox', name, content, x, y, width, height,
  fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#0F172A', foreground: '#E2E8F0',
  isEnabled: true, visibility: 'Visible', properties: { multiline: false, readOnly: false, textAlign: 'left' }
});

const browser = (id: string, name: string, x: number, y: number, width: number, height: number, properties: Control = {}): Control => ({
  id, type: 'CefBrowser', name, content: '', x, y, width, height,
  fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#FFFFFF', foreground: '#000000',
  isEnabled: true, visibility: 'Visible',
  properties: {
    url: 'about:blank', cacheDir: '.cef3/cache', enableJs: true, enableDevTools: true,
    loadImages: true, enableWebGL: false, muteAudio: true, proxyMode: 'system', ...properties
  }
});

interface Episode {
  no: string;
  dir: string;
  id: string;
  name: string;
  className: string;
  title: string;
  /** 口播稿点名、并且本示例真实调用的中文命令。 */
  commands: string[];
  modules: string[];
  controls: Control[];
  code: string[];
  globals?: string[];
  assets?: Array<[relativePath: string, content: string, encoding?: 'base64']>;
  /** 录制前必须知道的运行边界；同时写进录制准备.md 和验证记录.md。 */
  boundaries: string[];
  /** 录制动作清单，对应口播分段。 */
  steps: string[];
  window?: Control;
}

const episodes: Episode[] = [
  {
    no: '01',
    dir: '01 CEF3 入门',
    id: 'cef3-ep01-intro',
    name: 'CEF3 入门示例',
    className: 'CEF3入门窗体',
    title: 'CEF3 入门 · 原生内核与 SDK 前置',
    commands: ['CEF3_导航', 'CEF3_绑定事件', 'CEF3_取地址', 'CEF3_取标题'],
    modules: ['lingbuilder.cef3.browser'],
    controls: [
      label('status', '运行状态', '等待 F5 运行……', 10, 10, 1070, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'https://example.com', cacheDir: '.cef3/ep01' })
    ],
    code: [
      '// 初始地址写在设计器控件属性「打开地址」里：CEF 浏览器是异步创建的，',
      '// 「创建完毕」触发时 bridge 句柄可能还没就绪，此时调用 CEF3_导航 会落空。',
      '// CEF3_导航 用于创建完成之后的主动跳转（见第 02 集的「转到」按钮）。',
      '事件 _CEF3入门窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "加载完成", &页面加载完成)',
      '    控件_设置文本(运行状态, "正在加载 example.com ……")',
      '结束',
      '',
      '事件 页面加载完成()',
      '    控件_设置文本(运行状态, CEF3_取地址(浏览器1))',
      '    调试输出("CEF3 页面加载完成：", CEF3_取标题(浏览器1))',
      '结束'
    ],
    assets: [['assets/intro.html', page('CEF3 本地测试页', '<p>只用于教程录制，不访问真实业务地址。</p><p>需要离线演示时，把导航地址改成本页的 <code>file:///</code> 绝对路径。</p>')]],
    boundaries: [
      '默认打开 https://example.com（写在设计器控件属性「打开地址」里）；断网或需要完全离线时改成 assets/intro.html 的 file:/// 绝对路径。',
      'CefBrowser 由运行时在「创建完毕」之前自动创建，代码里不需要再写 CEF 初始化。',
      '**初始地址必须走设计器属性，不能在「创建完毕」里调 CEF3_导航**：CEF 浏览器是异步创建的，此时 bridge 句柄常常还没就绪，导航会静默落空、页面停在 about:blank。CEF3_导航 只适用于创建完成之后的主动跳转（第 02 集「转到」按钮）。'
    ],
    steps: [
      'S2：模块面板启用「CEF3 浏览器模块」，画面停在 lingbuilder.cef3.browser。',
      'S3：SDK 下载对话框用干净缓存环境单独录制，不与本项目 F5 镜头连拍。',
      'S4：从工具箱拖入「CEF3浏览器」，属性页展示打开地址与缓存目录。',
      'S5：属性面板里把「打开地址」设为 https://example.com；「创建完毕」里只绑定加载完成事件，花字强调 浏览器1 是裸控件引用。',
      'S6：F5，确认错误列表 0、原生窗口出现网页；产物 bin/ 目录含 libcef.dll、chrome_elf.dll、resources.pak、icudtl.dat 与 locales/。'
    ]
  },
  {
    no: '02',
    dir: '02 浏览器操作小项目',
    id: 'cef3-ep02-browser-tool',
    name: 'CEF3 浏览器操作小项目',
    className: 'CEF3浏览器操作窗体',
    title: 'CEF3 浏览器操作小项目',
    commands: ['CEF3_导航', 'CEF3_后退', 'CEF3_前进', 'CEF3_刷新', 'CEF3_强制刷新', 'CEF3_停止', 'CEF3_执行缩放', 'CEF3_设置缩放级别', 'CEF3_取缩放级别', 'CEF3_执行JS', 'CEF3_取标题', 'CEF3_取地址'],
    modules: ['lingbuilder.cef3.browser'],
    controls: [
      textBox('address-bar', '地址栏', 'https://example.com', 10, 10, 300),
      button('go-button', '转到按钮', '转到', 316, 10, 60),
      button('back-button', '后退按钮', '后退', 382, 10, 60),
      button('forward-button', '前进按钮', '前进', 448, 10, 60),
      button('refresh-button', '刷新按钮', '刷新', 514, 10, 60),
      button('hard-refresh-button', '强制刷新按钮', '强制刷新', 580, 10, 80),
      button('stop-button', '停止按钮', '停止', 666, 10, 60),
      button('zoom-in-button', '放大按钮', '放大', 732, 10, 60),
      button('zoom-out-button', '缩小按钮', '缩小', 798, 10, 60),
      button('zoom-reset-button', '重置按钮', '重置', 864, 10, 60),
      label('title-label', '标题标签', 'CEF3 浏览器', 930, 10, 150, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'https://example.com', cacheDir: '.cef3/ep02' })
    ],
    code: [
      '// 初始地址由设计器控件属性「打开地址」给出（CEF 异步创建，创建完毕时导航会落空）；',
      '// 「转到」按钮发生在创建完成之后，那里的 CEF3_导航 才是有效的主动跳转。',
      '事件 _CEF3浏览器操作窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "加载完成", &页面加载完成)',
      '结束',
      '',
      '事件 页面加载完成()',
      '    控件_设置文本(标题标签, CEF3_取标题(浏览器1))',
      '    调试输出("当前地址：", CEF3_取地址(浏览器1))',
      '    调试输出("脚本标题：", CEF3_执行JS(浏览器1, "document.title"))',
      '结束',
      '',
      '事件 _转到按钮_被单击()',
      '    局部 文本型 目标地址 = 控件_取文本(地址栏)',
      '    CEF3_导航(浏览器1, 目标地址)',
      '结束',
      '',
      '事件 _后退按钮_被单击()',
      '    CEF3_后退(浏览器1)',
      '结束',
      '',
      '事件 _前进按钮_被单击()',
      '    CEF3_前进(浏览器1)',
      '结束',
      '',
      '事件 _刷新按钮_被单击()',
      '    CEF3_刷新(浏览器1)',
      '结束',
      '',
      '事件 _强制刷新按钮_被单击()',
      '    CEF3_强制刷新(浏览器1)',
      '结束',
      '',
      '事件 _停止按钮_被单击()',
      '    CEF3_停止(浏览器1)',
      '结束',
      '',
      '// 缩放命令取值固定为 0 缩小、1 重置、2 放大。',
      '事件 _放大按钮_被单击()',
      '    CEF3_执行缩放(浏览器1, 2)',
      '    调试输出("当前缩放：", CEF3_取缩放级别(浏览器1))',
      '结束',
      '',
      '事件 _缩小按钮_被单击()',
      '    CEF3_执行缩放(浏览器1, 0)',
      '    调试输出("当前缩放：", CEF3_取缩放级别(浏览器1))',
      '结束',
      '',
      '事件 _重置按钮_被单击()',
      '    CEF3_设置缩放级别(浏览器1, 0.0)',
      '    调试输出("缩放已重置：", CEF3_取缩放级别(浏览器1))',
      '结束'
    ],
    assets: [
      ['assets/home.html', page('CEF3 操作演示 · 首页', '<p>点击下面的链接，可以演示后退与前进。</p><p><a href="second.html">前往第二页</a></p>')],
      ['assets/second.html', page('CEF3 操作演示 · 第二页', '<p>这是第二页，用来验证后退、前进和刷新。</p><p><a href="home.html">返回首页</a></p>', '#059669')]
    ],
    boundaries: [
      '缩放命令的合法取值只有 0（缩小）、1（重置）、2（放大）；传其它值会被 Bridge 拒绝。',
      '重置按钮使用 CEF3_设置缩放级别(浏览器1, 0.0)，0.0 表示 100% 原始比例。',
      '离线录制时把地址栏改成 assets/home.html 的 file:/// 绝对路径，后退/前进用 home ↔ second 两页演示。'
    ],
    steps: [
      'S2～S5：依次演示地址栏 + 转到、后退/前进、刷新/强制刷新/停止、放大/缩小/重置。',
      'S5：执行 JS 读标题，标题标签与调试输出同时更新。',
      'S6：F5 后按上面顺序点一遍，每一步都要有真实页面变化，错误列表保持 0。'
    ]
  },
  {
    no: '03',
    dir: '03 事件驱动',
    id: 'cef3-ep03-events',
    name: 'CEF3 事件驱动示例',
    className: 'CEF3事件驱动窗体',
    title: 'CEF3 事件驱动 · 加载完成与事件数据',
    commands: ['CEF3_绑定事件', 'CEF3_取最近事件', 'CEF3_取事件数据', 'CEF3_取事件字段', 'CEF3_是否加载中'],
    modules: ['lingbuilder.cef3.browser'],
    controls: [
      label('status', '事件状态', '等待事件……', 10, 10, 1070, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'https://example.com', cacheDir: '.cef3/ep03' })
    ],
    code: [
      '// 初始地址由设计器控件属性「打开地址」给出：绑定事件必须早于首次加载，',
      '// 而 CEF 异步创建导致「创建完毕」里的 CEF3_导航 会落空。',
      '事件 _CEF3事件驱动窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "开始加载", &页面开始加载)',
      '    CEF3_绑定事件(浏览器1, "加载完成", &页面加载完成)',
      '    CEF3_绑定事件(浏览器1, "加载状态改变", &加载状态改变)',
      '    CEF3_绑定事件(浏览器1, "加载失败", &页面加载失败)',
      '结束',
      '',
      '事件 页面开始加载()',
      '    控件_设置文本(事件状态, "开始加载")',
      '    调试输出("事件：", CEF3_取最近事件(浏览器1), " 地址：", CEF3_取事件字段(浏览器1, "url"))',
      '结束',
      '',
      '事件 页面加载完成()',
      '    控件_设置文本(事件状态, "加载完成")',
      '    调试输出("事件：", CEF3_取最近事件(浏览器1), " 事件数据：", CEF3_取事件数据(浏览器1))',
      '    调试输出("状态码：", CEF3_取事件字段(浏览器1, "statusCode"))',
      '结束',
      '',
      '事件 加载状态改变()',
      '    调试输出("是否加载中：", CEF3_是否加载中(浏览器1))',
      '结束',
      '',
      '事件 页面加载失败()',
      '    控件_设置文本(事件状态, "加载失败")',
      '    调试输出("失败地址：", CEF3_取事件字段(浏览器1, "url"), " 错误：", CEF3_取事件字段(浏览器1, "errorText"))',
      '结束',
      '',
      '// 通知类事件异步回到窗口线程；需要同步答复的决策事件用 CEF3_设置事件结果，见第 05 集。'
    ],
    assets: [['assets/events.html', page('CEF3 事件测试页', '<p>页面加载完成后，输出面板会依次记录开始加载、加载状态改变和加载完成。</p>', '#7C3AED')]],
    boundaries: [
      '事件实名以事件目录为准：开始加载 / 加载完成 / 加载失败 / 加载状态改变；不要写成「加载开始」或「加载错误」。',
      'CEF3_取事件字段 返回的是文本快照，字段缺失时返回空文本，不会抛出异常。',
      '决策类事件的 CEF3_设置事件结果 在第 05 集演示，本集只做通知类事件。'
    ],
    steps: [
      'S2：写 CEF3_绑定事件(浏览器1, "加载完成", &页面加载完成)，花字强调 &页面加载完成。',
      'S3：处理器里读 CEF3_取最近事件 与 CEF3_取事件数据。',
      'S4：读 url / statusCode 字段，状态标签与输出面板同时更新。',
      'S6：F5 后输出面板按 开始加载 → 加载状态改变 → 加载完成 顺序滚动。'
    ]
  },
  {
    no: '04',
    dir: '04 会话隔离',
    id: 'cef3-ep04-session-isolation',
    name: 'CEF3 会话隔离示例',
    className: 'CEF3会话隔离窗体',
    title: 'CEF3 会话隔离 · 缓存目录与多实例',
    commands: ['CEF3会话_取缓存目录', 'CEF3_绑定事件', 'CEF3_执行JS'],
    modules: ['lingbuilder.cef3.browser', 'lingbuilder.cef3.session'],
    controls: [
      label('left-status', '左侧状态', '左侧会话：等待加载……', 10, 10, 520, 32),
      label('right-status', '右侧状态', '右侧会话：等待加载……', 540, 10, 400, 32),
      button('inspect-button', '读取会话按钮', '读取缓存目录', 950, 10, 130),
      browser('browser-left', '浏览器1', 10, 52, 520, 660, { url: 'https://example.com', cacheDir: '.cef3/ep04-left' }),
      browser('browser-right', '浏览器2', 540, 52, 540, 660, { url: 'https://example.com', cacheDir: '.cef3/ep04-right' })
    ],
    code: [
      '// 两个实例的初始地址与缓存目录都写在设计器控件属性里（创建前配置）。',
      '事件 _CEF3会话隔离窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "加载完成", &左侧加载完成)',
      '    CEF3_绑定事件(浏览器2, "加载完成", &右侧加载完成)',
      '结束',
      '',
      '// 脚本用方括号写法读写 LocalStorage：中文代码的语言服务会把字符串里的 “对象.方法(” 当成功能库调用。',
      '事件 左侧加载完成()',
      '    CEF3_执行JS(浏览器1, "localStorage[\'会话标记\'] = \'左侧\'")',
      '    控件_设置文本(左侧状态, CEF3_执行JS(浏览器1, "localStorage[\'会话标记\']"))',
      '结束',
      '',
      '事件 右侧加载完成()',
      '    CEF3_执行JS(浏览器2, "localStorage[\'会话标记\'] = \'右侧\'")',
      '    控件_设置文本(右侧状态, CEF3_执行JS(浏览器2, "localStorage[\'会话标记\']"))',
      '结束',
      '',
      '事件 _读取会话按钮_被单击()',
      '    调试输出("左侧缓存目录：", CEF3会话_取缓存目录(浏览器1))',
      '    调试输出("右侧缓存目录：", CEF3会话_取缓存目录(浏览器2))',
      '结束',
      '',
      '// 缓存目录是会话边界，必须在浏览器创建前确定。',
      '// 设计器控件由运行时在「创建完毕」之前自动创建，所以这里用属性面板的「缓存目录」配置。',
      '// 纯代码创建实例时才写成：先 CEF3_设置缓存目录(浏览器1, ".cef3/ep04-left")，再 CEF3_创建(浏览器1)。'
    ],
    assets: [
      ['assets/storage-left.html', page('会话隔离 · 左侧', '<p>本页把 <code>会话标记</code> 写进 LocalStorage，用来验证左右两个实例互不影响。</p>')],
      ['assets/storage-right.html', page('会话隔离 · 右侧', '<p>本页把 <code>会话标记</code> 写进 LocalStorage，用来验证左右两个实例互不影响。</p>', '#DC2626')]
    ],
    boundaries: [
      '运行时在窗口「创建完毕」之前已经创建全部 CefBrowser，因此 CEF3_设置缓存目录 只能用于纯代码创建的实例；设计器项目请用属性面板的「缓存目录」。',
      '本集用属性面板配置 .cef3/ep04-left 与 .cef3/ep04-right，两个实例使用不同 RequestContext。',
      '演示只写入自造的 LocalStorage 标记，不使用真实账号或真实 Cookie。',
      '中文代码里的 JS 字符串避免写成 `对象.方法(...)`：语言服务会把它识别成功能库调用并报「找不到功能库」，示例改用方括号写法。'
    ],
    steps: [
      'S2：设计器里展示左右两个 CEF3浏览器，名称为 浏览器1、浏览器2。',
      'S3：属性面板展示两个不同的缓存目录，花字「创建前配置」。',
      'S4：F5 后两侧分别写入并读回不同的 LocalStorage 标记。',
      'S5：点「读取缓存目录」，调试输出两条不同的实际目录。',
      'S6：交换页面刷新，两边的值始终不同即验证通过。'
    ]
  },
  {
    no: '05',
    dir: '05 代理与请求决策',
    id: 'cef3-ep05-network-decision',
    name: 'CEF3 代理与请求决策示例',
    className: 'CEF3请求决策窗体',
    title: 'CEF3 代理与请求前决策',
    commands: ['CEF3_绑定事件', 'CEF3_取事件字段', 'CEF3_设置事件结果'],
    modules: ['lingbuilder.cef3.browser', 'lingbuilder.cef3.network'],
    globals: ['全局 整数型 本次目标受限 = 0'],
    controls: [
      label('status', '决策状态', '等待请求……', 10, 10, 760, 32),
      button('open-blocked', '打开受限页按钮', '打开受限测试页', 780, 10, 150),
      button('open-allowed', '打开放行页按钮', '打开放行测试页', 936, 10, 144),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'about:blank', cacheDir: '.cef3/ep05', proxyMode: 'none' })
    ],
    code: [
      '事件 _CEF3请求决策窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "导航请求前", &导航请求前)',
      '    CEF3_绑定事件(浏览器1, "资源加载前", &资源加载前)',
      '    控件_设置文本(决策状态, "已启用请求前决策；默认直连，不使用任何真实代理。")',
      '结束',
      '',
      '事件 导航请求前()',
      '    局部 文本型 地址 = CEF3_取事件字段(浏览器1, "url")',
      '    如果 (本次目标受限 == 1)',
      '        CEF3_设置事件结果(浏览器1, 2)',
      '        控件_设置文本(决策状态, "已取消导航（命中测试拦截规则）")',
      '        调试输出("已取消：", 地址)',
      '    否则',
      '        CEF3_设置事件结果(浏览器1, 1)',
      '        调试输出("已放行：", 地址)',
      '    如果结束',
      '结束',
      '',
      '事件 资源加载前()',
      '    调试输出("资源请求：", CEF3_取事件字段(浏览器1, "url"))',
      '结束',
      '',
      '事件 _打开受限页按钮_被单击()',
      '    本次目标受限 = 1',
      '    CEF3_导航(浏览器1, "https://example.com/blocked")',
      '结束',
      '',
      '事件 _打开放行页按钮_被单击()',
      '    本次目标受限 = 0',
      '    CEF3_导航(浏览器1, "https://example.com/")',
      '结束',
      '',
      '// 结果 1 表示允许继续，结果 2 表示取消；不调用结果接口则保持默认行为。',
      '// 代理必须在创建前确定：设计器项目用「代理模式 / 自定义代理地址」属性，',
      '// 纯代码创建实例时才写成：先 CEF3_设置代理(浏览器1, "http://127.0.0.1:8888")，再 CEF3_创建(浏览器1)。'
    ],
    assets: [
      ['assets/allow.html', page('放行测试页', '<p>本页代表允许继续的请求，处理器会返回结果 1。</p>')],
      ['assets/blocked.html', page('受限测试页', '<p>地址里包含 <code>blocked</code> 时，处理器返回结果 2 取消导航，并在界面上给出中文原因。</p>', '#DC2626')]
    ],
    boundaries: [
      '示例默认直连（proxyMode=none），不配置任何真实代理；需要演示代理时改属性面板的「代理模式」为自定义并填入本地授权测试代理，凭据不得入镜。',
      'CEF3_设置代理 只能在浏览器创建前生效；设计器项目的等价配置是控件属性。',
      '拦截规则只作用于自造的 blocked 测试路径，不拦截真实业务流量。',
      '当前基础模块没有文本包含判断命令，示例用项目全局变量 `本次目标受限` 标记本次目标，再在决策事件里返回结果；换成自己的规则时只要改这一处判断。',
      '决策处理器里不做长耗时任务，避免阻塞请求线程。'
    ],
    steps: [
      'S2：展示代理模式属性；敏感字段全部打码。',
      'S4：写 CEF3_绑定事件 绑定「导航请求前」「资源加载前」。',
      'S5：点「打开受限测试页」，界面显示中文“已取消”，输出写明原因。',
      'S6：再点「打开放行测试页」，同一套处理器放行，错误列表保持 0。'
    ]
  },
  {
    no: '06',
    dir: '06 获取网页资源响应',
    id: 'cef3-ep06-resource-response',
    name: 'CEF3 资源响应元数据示例',
    className: 'CEF3资源响应窗体',
    title: 'CEF3 获取网页资源响应 · URL、状态码与 MIME',
    commands: ['CEF3_绑定事件', 'CEF3_取事件字段'],
    modules: ['lingbuilder.cef3.browser'],
    controls: [
      label('status', '响应状态', '等待资源响应……', 10, 10, 1070, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'about:blank', cacheDir: '.cef3/ep06' })
    ],
    code: [
      '事件 _CEF3资源响应窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "资源响应到达", &资源响应到达)',
      '    控件_设置文本(响应状态, "请导航到 assets/index.html，观察多条资源响应。")',
      '结束',
      '',
      '事件 资源响应到达()',
      '    局部 文本型 地址 = CEF3_取事件字段(浏览器1, "url")',
      '    局部 文本型 状态码 = CEF3_取事件字段(浏览器1, "statusCode")',
      '    局部 文本型 内容类型 = CEF3_取事件字段(浏览器1, "mimeType")',
      '    控件_设置文本(响应状态, 内容类型)',
      '    调试输出("资源：", 地址)',
      '    调试输出("    状态码：", 状态码, "    MIME：", 内容类型)',
      '结束',
      '',
      '// 边界：本集只读取公开响应元数据。响应正文、响应头映射和响应过滤器不属于当前公开 binding，',
      '// 不能把「资源响应到达」说成「已经拿到正文」。'
    ],
    assets: [
      ['assets/index.html', page('资源响应测试页', '<p>本页故意引用样式、脚本和图片，打开一次就能看到多条资源响应。</p><p><img src="pixel.png" width="120" height="8" alt="测试图片"></p>')
        .replace('</style>', '</style><link rel="stylesheet" href="style.css"><script src="script.js" defer></script>')],
      ['assets/style.css', '/* 教程用本地样式，只为产生一条 text/css 资源响应。 */\nmain { box-shadow: 0 8px 24px rgba(15, 23, 42, .08); }\n'],
      ['assets/script.js', '// 教程用本地脚本，只为产生一条 JavaScript 资源响应。\ndocument.title = document.title + " · 已加载脚本";\n'],
      ['assets/pixel.png', PIXEL_PNG_BASE64, 'base64']
    ],
    boundaries: [
      '事件实名为「资源响应到达」，录制前以事件目录为准。',
      '只读取 url、statusCode、mimeType 等公开元数据；正文读取、响应头映射、响应过滤器不在当前公开 binding 内，口播不得宣称可直接读正文。',
      'file:// 页面不会返回 HTTP 状态码，statusCode 可能为 0 或空；需要真实状态码时使用本地 HTTP 测试服务。'
    ],
    steps: [
      'S2：先展示 assets/index.html 及其 style.css、script.js、pixel.png。',
      'S3：写 CEF3_绑定事件 绑定「资源响应到达」。',
      'S4：处理器里依次读 url、statusCode、mimeType，输出按资源类型分组。',
      'S6：打能力边界卡「公开元数据 ≠ 响应正文」。'
    ]
  },
  {
    no: '07',
    dir: '07 资源加载生命周期',
    id: 'cef3-ep07-resource-lifecycle',
    name: 'CEF3 资源加载生命周期示例',
    className: 'CEF3资源生命周期窗体',
    title: 'CEF3 资源加载生命周期',
    commands: ['CEF3_绑定事件', 'CEF3_取事件字段'],
    modules: ['lingbuilder.cef3.browser'],
    controls: [
      label('status', '生命周期状态', '等待资源事件……', 10, 10, 1070, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'about:blank', cacheDir: '.cef3/ep07' })
    ],
    code: [
      '事件 _CEF3资源生命周期窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "资源加载前", &资源加载前)',
      '    CEF3_绑定事件(浏览器1, "资源响应到达", &资源响应到达)',
      '    CEF3_绑定事件(浏览器1, "资源重定向", &资源重定向)',
      '    CEF3_绑定事件(浏览器1, "资源加载完成", &资源加载完成)',
      '    控件_设置文本(生命周期状态, "已绑定资源加载前 → 响应到达 → 重定向 → 加载完成。")',
      '结束',
      '',
      '事件 资源加载前()',
      '    调试输出("[1/4] 资源加载前：", CEF3_取事件字段(浏览器1, "url"))',
      '结束',
      '',
      '事件 资源响应到达()',
      '    调试输出("[2/4] 资源响应到达：", CEF3_取事件字段(浏览器1, "url"), " 状态码：", CEF3_取事件字段(浏览器1, "statusCode"))',
      '结束',
      '',
      '事件 资源重定向()',
      '    调试输出("[3/4] 资源重定向：", CEF3_取事件字段(浏览器1, "url"), " → ", CEF3_取事件字段(浏览器1, "newUrl"))',
      '    控件_设置文本(生命周期状态, "已跟随一次重定向")',
      '结束',
      '',
      '事件 资源加载完成()',
      '    调试输出("[4/4] 资源加载完成：", CEF3_取事件字段(浏览器1, "url"), " 状态：", CEF3_取事件字段(浏览器1, "status"))',
      '结束',
      '',
      '// 边界：响应过滤器和受管资源源涉及更多对象与生命周期，本集只讲可观察、可复现的事件链。'
    ],
    assets: [
      ['assets/start.html', page('生命周期 · 起点', '<p>点击下面的链接触发一次跳转，观察四个阶段的事件顺序。</p><p><a href="redirect.html">前往重定向页</a></p>')],
      ['assets/redirect.html', page('生命周期 · 重定向', '<p>本页会自动跳转到 <code>final.html</code>。</p>', '#F59E0B')
        .replace('<main>', '<meta http-equiv="refresh" content="1;url=final.html"><main>')],
      ['assets/final.html', page('生命周期 · 终点', '<p>跳转完成。资源加载完成事件会记录成功、失败或取消。</p>', '#059669')]
    ],
    boundaries: [
      '「资源重定向」对应 HTTP 3xx。file:// 与 meta refresh 不产生 3xx，本地页链只用于讲解顺序；要拍到真实重定向事件，必须使用能返回 302 的本地 HTTP 测试服务。',
      '「资源加载完成」是高频事件，录制时页面要保持简单，避免日志刷屏。',
      '页面加载完成不等于每个资源都成功，资源级日志才能看出失败与取消。'
    ],
    steps: [
      'S2～S5：按 资源加载前 → 资源响应到达 → 资源重定向 → 资源加载完成 逐个节点讲。',
      'S4：重定向镜头如需真实 3xx，改用本地 HTTP 测试服务的 /redirect → /final。',
      'S6：打高级能力卡片，不展示未经验证的正文替换代码。'
    ]
  },
  {
    no: '08',
    dir: '08 下载打印查找',
    id: 'cef3-ep08-transfer-find',
    name: 'CEF3 下载、打印与页内查找示例',
    className: 'CEF3页面工具窗体',
    title: 'CEF3 下载、打印与页内查找',
    commands: ['CEF3传输_开始下载', 'CEF3传输_打印', 'CEF3_页内查找', 'CEF3_停止页内查找', 'CEF3_绑定事件', 'CEF3_取事件字段'],
    modules: ['lingbuilder.cef3.browser', 'lingbuilder.cef3.transfer'],
    controls: [
      textBox('keyword-box', '查找框', 'LingBuilder', 10, 10, 220),
      button('find-button', '查找按钮', '查找', 236, 10, 70),
      button('find-stop-button', '停止查找按钮', '停止查找', 312, 10, 90),
      button('download-button', '下载按钮', '下载测试文件', 408, 10, 130),
      button('print-button', '打印按钮', '打印页面', 544, 10, 100),
      label('find-status', '查找结果', '等待查找……', 650, 10, 430, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'about:blank', cacheDir: '.cef3/ep08' })
    ],
    code: [
      '事件 _CEF3页面工具窗体_创建完毕()',
      '    CEF3_绑定事件(浏览器1, "页内查找结果", &页内查找结果)',
      '    控件_设置文本(查找结果, "请先导航到 assets/find.html，再使用查找、下载和打印。")',
      '结束',
      '',
      '// 控件_取文本 返回文本对象，必须先落到局部文本变量再传给模块命令。',
      '事件 _查找按钮_被单击()',
      '    局部 文本型 关键词 = 控件_取文本(查找框)',
      '    CEF3_页内查找(浏览器1, 关键词, 真, 假, 真)',
      '结束',
      '',
      '事件 _停止查找按钮_被单击()',
      '    CEF3_停止页内查找(浏览器1, 真)',
      '    控件_设置文本(查找结果, "已停止查找并清除选区")',
      '结束',
      '',
      '事件 页内查找结果()',
      '    调试输出("匹配数：", CEF3_取事件字段(浏览器1, "count"), " 当前项：", CEF3_取事件字段(浏览器1, "activeMatchOrdinal"))',
      '    控件_设置文本(查找结果, CEF3_取事件字段(浏览器1, "count"))',
      '结束',
      '',
      '事件 _下载按钮_被单击()',
      '    CEF3传输_开始下载(浏览器1, "https://example.com/index.html")',
      '    控件_设置文本(查找结果, "已发起下载，保存路径由系统下载流程确认。")',
      '结束',
      '',
      '事件 _打印按钮_被单击()',
      '    CEF3传输_打印(浏览器1)',
      '结束',
      '',
      '// 页内查找不同步返回总数，匹配数量与当前序号只能从「页内查找结果」事件读取。'
    ],
    assets: [
      ['assets/find.html', page('下载与查找测试页', '<p>LingBuilder 让中文 C++ 也能写浏览器工具。</p><p>再出现一次 LingBuilder，便于验证匹配数量。</p><p>第三次 LingBuilder，用来演示查找下一项。</p><p><a href="download-demo.txt" download>下载测试文件</a></p>')],
      ['assets/download-demo.txt', 'LingBuilder CEF3 教程第 08 集下载测试文件。\n仅用于录制演示，不包含任何真实业务数据。\n']
    ],
    boundaries: [
      '打印会拉起系统打印对话框，录制时只展示测试内容，不确认真实打印，也不让个人文件路径入镜。',
      '下载保存路径由系统下载流程确认；示例不写死个人目录。',
      '离线录制时把下载地址改成 assets/download-demo.txt 的 file:/// 绝对路径。',
      'CEF3_页内查找 的参数依次为：文本、向前、区分大小写、查找下一个。'
    ],
    steps: [
      'S2：点「下载测试文件」，状态标签显示已发起下载。',
      'S3：点「打印页面」，只拍原生打印对话框出现，不完成打印。',
      'S4：查找框输入 LingBuilder，点查找，页面高亮多个匹配项。',
      'S5：结果标签显示匹配数与当前项；点「停止查找」清理选区。',
      'S6：F5 后按下载 → 打印 → 查找顺序走一遍，错误列表 0。'
    ]
  },
  {
    no: '09',
    dir: '09 JavaScript DevTools 异步任务',
    id: 'cef3-ep09-automation-devtools',
    name: 'CEF3 异步任务与开发者工具示例',
    className: 'CEF3自动化窗体',
    title: 'CEF3 JavaScript、DevTools 与异步任务',
    commands: ['CEF3自动化_执行JS异步', 'CEF3任务_取状态', 'CEF3任务_取结果', 'CEF3任务_取错误', 'CEF3任务_释放', 'CEF3开发工具_打开', 'CEF3开发工具_执行协议方法'],
    modules: ['lingbuilder.cef3.browser', 'lingbuilder.cef3.objects', 'lingbuilder.cef3.automation', 'lingbuilder.cef3.devtools'],
    controls: [
      button('run-script', '执行脚本按钮', '异步执行 JS', 10, 10, 130),
      button('read-result', '读取结果按钮', '读取任务结果', 146, 10, 130),
      button('open-devtools', '打开工具按钮', '打开开发者工具', 282, 10, 140),
      button('run-protocol', '协议按钮', '执行协议方法', 428, 10, 130),
      label('status', '任务状态', '等待发起异步任务……', 564, 10, 516, 32),
      browser('browser-1', '浏览器1', 10, 52, 1070, 660, { url: 'about:blank', cacheDir: '.cef3/ep09', enableDevTools: true })
    ],
    globals: ['全局 长整数型 当前任务ID = 0'],
    code: [
      '事件 _CEF3自动化窗体_创建完毕()',
      '    控件_设置文本(任务状态, "先点「异步执行 JS」，再点「读取任务结果」。")',
      '结束',
      '',
      '事件 _执行脚本按钮_被单击()',
      '    当前任务ID = CEF3自动化_执行JS异步(浏览器1, "document.title")',
      '    控件_设置文本(任务状态, "已提交异步任务，窗口不会被阻塞。")',
      '    调试输出("任务 ID：", 当前任务ID)',
      '结束',
      '',
      '事件 _读取结果按钮_被单击()',
      '    如果 (当前任务ID == 0)',
      '        控件_设置文本(任务状态, "请先发起一个异步任务。")',
      '        返回',
      '    如果结束',
      '    调试输出("任务状态：", CEF3任务_取状态(当前任务ID))',
      '    调试输出("任务结果：", CEF3任务_取结果(当前任务ID))',
      '    调试输出("任务错误：", CEF3任务_取错误(当前任务ID))',
      '    控件_设置文本(任务状态, CEF3任务_取结果(当前任务ID))',
      '    CEF3任务_释放(当前任务ID)',
      '    当前任务ID = 0',
      '结束',
      '',
      '事件 _打开工具按钮_被单击()',
      '    CEF3开发工具_打开(浏览器1)',
      '结束',
      '',
      '事件 _协议按钮_被单击()',
      '    当前任务ID = CEF3开发工具_执行协议方法(浏览器1, "Runtime.enable", "{}")',
      '    控件_设置文本(任务状态, "已发送协议方法 Runtime.enable，请点「读取任务结果」。")',
      '结束',
      '',
      '// 任务 ID 是受管句柄，不是页面对象，也不能当成原生指针使用；读完必须调用 CEF3任务_释放。'
    ],
    assets: [['assets/automation.html', page('异步任务测试页', '<p>本页只提供一个稳定的标题，供 <code>document.title</code> 异步读取。</p>', '#0891B2')]],
    boundaries: [
      'CEF3自动化_执行JS异步 立即返回任务 ID，不等待结果；示例用两次点击分离“提交”与“读取”，这也是口播里的状态 → 结果 → 错误 → 释放四步。',
      '协议方法只使用审查过的 Runtime.enable，不演示任何可绕过安全策略的脚本。',
      '开发者工具窗口里不能出现工作区绝对路径或任何敏感数据。',
      '任务句柄读完即释放，避免受管对象泄漏。'
    ],
    steps: [
      'S2：点「异步执行 JS」，花字「任务 ID · 受管句柄」。',
      'S3：点「读取任务结果」，展示状态、结果、错误、释放四步。',
      'S4：点「打开开发者工具」，只拍短镜头并隐藏路径。',
      'S5：点「执行协议方法」，再读一次任务结果。',
      'S6：全过程窗口保持可操作，错误列表 0。'
    ]
  }
];

const solutionOf = (item: Episode) => ({
  schemaVersion: 2,
  id: `${item.id}-solution`,
  name: item.name,
  startupProjectId: item.id,
  startupProjectIds: [item.id],
  folders: [],
  projects: [{
    type: 'visual-cpp',
    id: item.id,
    name: item.name,
    sourceRoot: 'src',
    configRoot: 'config',
    designerPath: '.lingbuilder/window-designer.json',
    isDefault: true,
    references: []
  }]
});

const modulesOf = (item: Episode) => ({
  schemaVersion: 1,
  enabledModuleIds: [BASIC, ...item.modules],
  pinnedVersions: Object.fromEntries([[BASIC, '1.0.0'], ...item.modules.map(id => [id, CEF3_VERSION])])
});

const designerOf = (item: Episode) => ({
  schemaVersion: 2,
  id: item.id,
  name: item.name,
  resources: [],
  windows: [{
    id: 'main-window',
    fileName: `${item.className}.xml`,
    className: item.className,
    title: item.title,
    width: 1100,
    height: 760,
    background: '#111827',
    description: `${item.name}（CEF3 合集第 ${item.no} 集）。`,
    designerBackend: 'win32',
    openPlacement: 'center',
    titleBarBackground: '#1E293B',
    titleBarForeground: '#E2E8F0',
    borderStyle: 'normal-resizable',
    resizable: true,
    maximizable: true,
    events: { Loaded: `_${item.className}_创建完毕` },
    controls: item.controls,
    ...item.window
  }]
});

const sourceOf = (item: Episode) => [
  `包 CEF3教程第${item.no}集`,
  '使用 Win32窗口基础模块',
  '使用 CEF3浏览器模块',
  '',
  `类 ${item.className} : 窗口`,
  '公开',
  '  构造()',
  '  结束',
  '',
  ...item.code.map(line => (line ? `  ${line}` : '')),
  '结束类',
  '',
  `// 本集口播命令：${item.commands.join('、')}`,
  ''
].join('\n');

const buildRequestOf = (item: Episode) => ({
  project: {
    schemaVersion: 2,
    id: item.id,
    name: item.name,
    resources: [],
    windows: designerOf(item).windows
  },
  activeWindowId: 'main-window',
  // 不写 lingCppSourceFilePath：CLI 一旦收到它就只会把这一个文件当作权威源码集合，
  // 项目全局变量.lcpp 会被排除在聚合之外。留空则由服务扫描 sourceRoot 下的全部 .lcpp。
  run: false,
  approved: true
});

const projectRelativePath = (item: Episode) => `AI 视频自主生产/CEF3 浏览器模块合集/${item.dir}/示例项目/${item.id}`;

const readmeOf = (item: Episode) => [
  `# ${item.name}`,
  '',
  `对应 CEF3 浏览器模块合集第 ${item.no} 集《${item.title}》。`,
  '',
  '## 打开与运行',
  '',
  '1. 把 `示例项目/` 下的整个项目文件夹复制到一个纯 ASCII 路径的工作区（例如 `D:\\lb-demo\\`）。',
  '2. 在 LingBuilder 中打开 `.lingbuilder/solution.json`。',
  '3. 确认模块面板已启用：' + [BASIC, ...item.modules].map(id => `\`${id}\``).join('、') + '。',
  '4. 按 F5 构建运行，确认错误列表为 0。',
  '',
  '## 本集命令',
  '',
  ...item.commands.map(command => `- \`${command}\``),
  '',
  '## 运行边界',
  '',
  ...item.boundaries.map(text => `- ${text}`),
  '',
  '## 前置条件',
  '',
  '- Windows x64 + Visual Studio / MSVC 工具链。',
  '- 已安装并通过 SHA-256 校验的 `lingbuilder.cef3.sdk`。',
  '- 构建产物 `bin/` 目录需包含 `libcef.dll`、`chrome_elf.dll`、`LingBuilderCefBridge.dll`、`resources.pak`、`icudtl.dat` 与 `locales/` 等 CEF 运行时资源。',
  '',
  '## 命令行构建',
  '',
  '每个示例项目本身就是一个工作区，需要能找到已安装的 CEF3 SDK（`.lingbuilder/modules`）。',
  '仓库提供的构建脚本会把项目复制到 `.tmp-cef3-verify/` 再构建，顺带用目录联接共享 SDK，',
  '并且把体积很大的构建产物挡在示例目录之外：',
  '',
  '```powershell',
  'cd electron',
  'npm run build:cli',
  'npm run tutorial:cef3:build',
  '```',
  '',
  '也可以原地构建（路径含中文没有影响，实测通过），只要先把 SDK 联接进本项目工作区：',
  '',
  '```powershell',
  `cd "<本项目目录>/.lingbuilder"`,
  'cmd /c mklink /J modules T:\electron\lingbuilder\.lingbuilder\modules',
  'cd T:\electron\lingbuilder\electron',
  `node dist/cli.cjs project build --request "<本项目目录>/build-request.json" --workspace "<本项目目录>" --yes --json`,
  '```',
  '',
  '> mklink 的目标路径不要加引号，加了会生成一个坏联接。',
  '',
  '> `build-request.json` 刻意不写 `lingCppSourceFilePath`：一旦写了，CLI 只会把那一个文件当作权威源码，`src/项目全局变量.lcpp` 不会参与聚合。',
  ''
].join('\n');

const recordingOf = (item: Episode) => [
  `# 第 ${item.no} 集录制准备：${item.title}`,
  '',
  '## 项目入口',
  '',
  `- 示例项目：\`示例项目/${item.id}/\``,
  `- 解决方案：\`示例项目/${item.id}/.lingbuilder/solution.json\``,
  `- 项目 ID：\`${item.id}\``,
  `- 窗体类：\`${item.className}\`，源码 \`src/${item.className}.lcpp\``,
  '',
  '## 录制前置',
  '',
  '- Windows x64、Visual Studio / MSVC 工具链已就绪。',
  '- `lingbuilder.cef3.sdk` 已安装并校验通过；SDK 下载对话框镜头单独在干净缓存环境录制后复用。',
  `- 已启用模块：${[BASIC, ...item.modules].map(id => `\`${id}\``).join('、')}。`,
  '- 该项目工作区能找到 CEF3 SDK（`.lingbuilder/modules/lingbuilder.cef3.sdk`，可用目录联接共享）；路径含中文不影响构建。',
  '- 代码镜头使用新手「结构化中文编辑」模式，采集画幅至少 `1920×1080 DIP`。',
  '- F5 前确认错误列表为 0；原生窗口置前后至少保持 3 秒再切镜头。',
  '',
  '## 关键控件',
  '',
  ...item.controls.map(control => `- \`${control.name}\`（${control.type}）`),
  '',
  '## 本集命令',
  '',
  ...item.commands.map(command => `- \`${command}\``),
  '',
  '## 分镜动作',
  '',
  ...item.steps.map(text => `- ${text}`),
  '',
  '## 运行边界与红线',
  '',
  ...item.boundaries.map(text => `- ${text}`),
  '- 全程只使用本地测试页与自造测试数据；禁止真实账号、Cookie 值、代理凭据、私钥和个人文件路径入镜。',
  '- 不使用「绕过检测」「规避风控」一类表述。',
  ''
].join('\n');

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function writeEpisode(item: Episode): Promise<void> {
  const projectDir = path.join(root, item.dir, '示例项目', item.id);
  await fs.rm(path.join(root, item.dir, '示例项目'), { recursive: true, force: true });

  await writeJson(path.join(projectDir, '.lingbuilder', 'solution.json'), solutionOf(item));
  await writeJson(path.join(projectDir, '.lingbuilder', 'window-designer.json'), designerOf(item));
  await writeJson(path.join(projectDir, '.lingbuilder', 'build-configuration.json'), { schemaVersion: 1, mode: 'Debug', architecture: 'x64' });
  // 根清单是工作区回退，projects/<id> 清单是项目权威清单；两份都写，保证任意打开方式都能启用模块。
  await writeJson(path.join(projectDir, '.lingbuilder', 'project-modules.json'), modulesOf(item));
  await writeJson(path.join(projectDir, '.lingbuilder', 'projects', item.id, 'project-modules.json'), modulesOf(item));
  await writeJson(path.join(projectDir, 'build-request.json'), buildRequestOf(item));

  await writeText(path.join(projectDir, 'src', `${item.className}.lcpp`), sourceOf(item));
  if (item.globals) {
    await writeText(path.join(projectDir, 'src', '项目全局变量.lcpp'), [
      '// 项目全局变量：作用域为当前项目，生命周期为整个进程。',
      ...item.globals,
      ''
    ].join('\n'));
  }
  await writeText(path.join(projectDir, 'config', item.id, 'config.ini'),
    `[project]\nname=${item.id}\ntoolchain=msvc\narchitecture=x64\n`);
  for (const [relativePath, content, encoding] of item.assets ?? []) {
    const target = path.join(projectDir, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, encoding === 'base64' ? Buffer.from(content, 'base64') : content, encoding === 'base64' ? undefined : 'utf8');
  }
  await writeText(path.join(projectDir, 'README.md'), readmeOf(item));
  await writeText(path.join(root, item.dir, '录制准备.md'), recordingOf(item));
}

const COMPARE_ROWS: Array<[dimension: string, cef3: string, edgeview: string]> = [
  ['内核来源', '自带 Chromium 运行时，随 CEF3 SDK 分发', '系统 WebView2 Runtime，Windows 10/11 通常已具备'],
  ['版本可控性', '固定在 SDK 打包的 Chromium 版本，行为可复现', '跟随目标机 Runtime 更新，版本由系统决定'],
  ['SDK 体积', 'SDK 压缩包约 177 MiB，需下载并做 SHA-256 校验', '不需要下载大型 SDK'],
  ['分发文件', '需随程序分发 libcef.dll、chrome_elf.dll、resources.pak、icudtl.dat 与 locales/ 等运行时资源', '仅依赖目标机已安装的 WebView2 Runtime'],
  ['离线部署', '可完整离线分发，适合内网与固定环境', '目标机缺少 Runtime 时需先安装引导程序'],
  ['会话隔离', '每个实例独立 RequestContext，缓存目录即会话边界', '按实例与用户数据目录隔离，贴近 WebView2 模型'],
  ['代理配置', '创建前按实例配置，围绕原生 RequestContext', '支持全局与实例级代理，接口风格贴近 WebView2'],
  ['事件模型', '原生 CEF 回调目录，覆盖资源、下载、打印、DevTools 等 96 项事件', 'WebView2 事件模型，覆盖导航、消息、下载与权限等常用事件'],
  ['首次构建成本', '首次构建/预览/导出会触发 SDK 下载与校验', '直接构建，无 SDK 下载步骤'],
  ['典型取舍', '需要固定内核、完整离线分发或更深 CEF 回调时选它', '只要快速嵌入网页、执行脚本、处理常见事件时更省部署成本']
];

async function writeComparisonEpisode(): Promise<void> {
  const dir = path.join(root, '10 CEF3还是EdgeView');
  const materialDir = path.join(dir, '对比资料');
  await fs.rm(materialDir, { recursive: true, force: true });

  await writeText(path.join(materialDir, '对比矩阵.md'), [
    '# CEF3 与 EdgeView 对比矩阵',
    '',
    `- 生成时间：${GENERATED_AT}`,
    '- 用途：第 10 集图版与花字的唯一数据来源；改数据请先改本文件，再重做图版。',
    '- 口径来源：`electron/docs/modules/cef3/README.md`、`guide/user/modules/edgeview`、`guide/user/advanced/sdk-download.md` 与本合集 01～09 集实测。',
    '',
    '| 维度 | CEF3 | EdgeView |',
    '| --- | --- | --- |',
    ...COMPARE_ROWS.map(([dimension, cef3, edgeview]) => `| ${dimension} | ${cef3} | ${edgeview} |`),
    '',
    '## 一句话结论',
    '',
    '> 想快速把网页嵌进软件，优先 EdgeView；需要原生 CEF 能力、固定内核和离线资源控制，就选 CEF3。',
    '',
    '无论选哪一个，导出的 exe 都要按目标机器重新验收。',
    ''
  ].join('\n'));

  await writeText(path.join(materialDir, '截图采集清单.md'), [
    '# 第 10 集截图采集清单',
    '',
    '本集不新建 C++ 工程，全部画面复用 01～09 集已验证的示例项目与既有素材。',
    '',
    '| 编号 | 画面 | 来源 | 采集方式 | 注意 |',
    '| --- | --- | --- | --- | --- |',
    '| c1 | 标题卡 | 合集模板 | 图版 | 标注 B 合集 10/10 |',
    '| c2 | 内核与运行方式对比 | `对比矩阵.md` 前两行 | 图版 | 左右两列，不放版本号以外的细节 |',
    '| c3 | SDK 大小与运行时文件 | 第 01 集 SDK 对话框静帧 + 构建产物目录 | 复用 + PrintWindow | 文件名只做花字，不展示工作区绝对路径 |',
    '| c4 | 能力矩阵 | `对比矩阵.md` 全表 | 图版 | 突出「离线完整分发」与「快速嵌入」 |',
    '| c5 | 会话/代理/事件三行对比 | `对比矩阵.md` 对应行 | 图版 | 不展示真实账号与代理凭据 |',
    '| c6 | 结论卡 | 一句话结论 | 图版 | 「快速内嵌 → EdgeView / 原生 CEF → CEF3」 |',
    '| c7 | 运行时资源抓拍 | 第 01 集构建产物 `bin` 目录 | PrintWindow | 只框选 libcef.dll、chrome_elf.dll、resources.pak、locales |',
    '| c8 | 合集收官与 FBro 导流卡 | 合集模板 | 图版 | 引出 FBro 合集第 1 集 |',
    ''
  ].join('\n'));

  await writeText(path.join(materialDir, '引用来源.md'), [
    '# 第 10 集数据引用来源',
    '',
    '录制前必须逐条复核，数值以复核当天的实际文档与产物为准。',
    '',
    '- CEF3 接口与事件规模：`electron/docs/modules/cef3/README.md`',
    '- CEF3 SDK 体积与校验流程：`guide/user/advanced/sdk-download.md`、第 01 集 SDK 对话框静帧',
    '- CEF3 运行时分发文件：第 01 集构建产物 `bin` 目录（`libcef.dll`、`chrome_elf.dll`、`LingBuilderCefBridge.dll`、`resources.pak`、`icudtl.dat`、`locales/`）',
    '- EdgeView 能力与 Runtime 依赖：`guide/user/modules/edgeview`、EdgeView 合集 01～12 集示例项目',
    '- 会话与代理差异：本合集第 04、05 集示例项目实测',
    '',
    '> 口播中出现的任何数字（体积、接口数量、事件数量）都必须能在上面的来源里查到；查不到就改口播，不改数据。',
    ''
  ].join('\n'));

  await writeText(path.join(dir, '录制准备.md'), [
    '# 第 10 集录制准备：CEF3 还是 EdgeView · 部署与选型',
    '',
    '## 本集定位',
    '',
    '- 收官集，不新建 C++ 工程；画面由图版 + 01～09 集已验证素材构成。',
    '- 数据只来自 `对比资料/对比矩阵.md`，来源登记在 `对比资料/引用来源.md`。',
    '',
    '## 素材清单',
    '',
    '- `对比资料/对比矩阵.md`：图版与花字的唯一数据源。',
    '- `对比资料/截图采集清单.md`：c1～c8 逐镜头采集方式。',
    '- `对比资料/引用来源.md`：每个数字的出处，录制前逐条复核。',
    '',
    '## 录制注意',
    '',
    '- 体积、接口数量、事件数量等数字必须当天复核；对不上就改口播，不改数据。',
    '- 运行时资源抓拍只框选 `libcef.dll`、`chrome_elf.dll`、`resources.pak` 与 `locales/`，不展示工作区绝对路径。',
    '- 不展示真实账号、Cookie、代理凭据。',
    '- 片尾导流 FBro 合集第 1 集。',
    ''
  ].join('\n'));
}

async function writeOverview(): Promise<void> {
  await writeText(path.join(root, '示例项目总览.md'), [
    '# CEF3 浏览器模块合集 · 示例项目总览',
    '',
    `- 生成时间：${GENERATED_AT}`,
    '- 生成脚本：`electron/scripts/generate-cef3-tutorial-projects.ts`（`npm run tutorial:cef3:generate`）',
    '- 构建脚本：`electron/scripts/build-cef3-tutorial-projects.ts`（`npm run tutorial:cef3:build`），暂存到 ASCII 路径后跑真实 MSVC + CEF3 构建',
    '- 验证脚本：`electron/scripts/verify-cef3-tutorial-projects.ts`（`npm run tutorial:cef3:verify`），并把构建结果写进各集验证记录',
    '- 每集验证结论见各集 `验证记录.md`。',
    '',
    '## 项目清单',
    '',
    '| 集 | 示例项目 | 窗体类 | 启用模块（除基础模块） | 本集命令 |',
    '| --- | --- | --- | --- | --- |',
    ...episodes.map(item => `| ${item.no} | \`${item.dir}/示例项目/${item.id}\` | \`${item.className}\` | ${item.modules.map(id => `\`${id}\``).join('、')} | ${item.commands.map(command => `\`${command}\``).join('、')} |`),
    '| 10 | `10 CEF3还是EdgeView/对比资料`（无 C++ 工程） | — | — | — |',
    '',
    '## 统一运行方式',
    '',
    '1. 把目标项目文件夹复制到任意工作区目录（路径含中文没有影响）。',
    '2. 打开 `.lingbuilder/solution.json`。',
    '3. 确认模块面板已启用该集所需模块。',
    '4. F5 构建运行，确认错误列表为 0。',
    '',
    '批量验证（生成 → 构建 → 刷新验证记录）：',
    '',
    '```powershell',
    'cd electron',
    'npm run build:cli',
    'npm run tutorial:cef3:generate',
    'npm run tutorial:cef3:build',
    'npm run tutorial:cef3:verify',
    '```',
    '',
    '## 统一前置',
    '',
    '- Windows x64 + Visual Studio / MSVC 工具链。',
    '- 已安装并通过 SHA-256 校验的 `lingbuilder.cef3.sdk`。',
    '- 构建产物 `bin/` 目录包含 `libcef.dll`、`chrome_elf.dll`、`LingBuilderCefBridge.dll`、`resources.pak`、`icudtl.dat` 与 `locales/` 等 CEF 运行时资源；口播里说的「Resources」在实际产物中是这组 `.pak` / `.dat` 文件与 `locales/` 目录，不是同名文件夹。',
    '',
    '## 已知边界（录制前必读）',
    '',
    '- 运行时在窗口「创建完毕」之前已经创建全部 `CefBrowser`，因此 `CEF3_设置缓存目录` 与 `CEF3_设置代理` 只对纯代码创建的实例生效；设计器项目的等价配置是控件属性「缓存目录」「代理模式 / 自定义代理地址」（第 04、05 集）。',
    '- `file://` 页面不返回 HTTP 状态码，`statusCode` 可能为 0 或空；需要真实状态码与 3xx 重定向事件时，改用本地 HTTP 测试服务（第 06、07 集）。',
    '- 资源响应只提供 URL、状态码、MIME 等公开元数据；响应正文、响应头映射与响应过滤器不在当前公开 binding 内（第 06、07 集）。',
    '- **浏览器初始地址必须写在设计器控件属性「打开地址」里，不能在「创建完毕」事件里调 `CEF3_导航`**：CEF 浏览器异步创建，窗口 Loaded 时 bridge 句柄常常尚未就绪，导航会静默落空、页面停在 `about:blank`。`CEF3_导航` 只用于创建完成后的主动跳转（第 01～04 集）。',
    '- 缩放命令取值固定为 0 缩小、1 重置、2 放大（第 02 集）。',
    '- 事件实名以事件目录为准：`开始加载`、`加载完成`、`加载失败`、`加载状态改变`（第 03 集）。',
    '- 构建的真实前置是「工作区能找到 CEF3 SDK」，即该项目的 `.lingbuilder/modules` 下有 `lingbuilder.cef3.sdk`；**路径含中文不影响构建**（已在本合集中文原地路径实测通过）。`npm run tutorial:cef3:build` 复制到 `.tmp-cef3-verify/` 构建，是为了共享 SDK 联接并把大体积产物挡在示例目录外，不是为了绕开中文路径。',
    '- `控件_取文本` 等返回文本对象的命令，不能直接作为模块命令的文本参数；必须先落到 `局部 文本型` 变量（第 02、08 集）。',
    '- 中文代码里的 JS 字符串避免写成 `对象.方法(...)`，语言服务会把它识别成功能库调用（第 04 集）。',
    '- `build-request.json` 不写 `lingCppSourceFilePath`，否则 `src/项目全局变量.lcpp` 不会参与聚合（第 05、09 集）。',
    '',
    '## 安全红线',
    '',
    '- 只使用本地测试页与自造测试数据。',
    '- 禁止真实账号、Cookie 值、代理凭据、私钥与个人文件路径入镜。',
    '- 不使用「绕过检测」「规避风控」一类表述。',
    ''
  ].join('\n'));
}

for (const item of episodes) await writeEpisode(item);
await writeComparisonEpisode();
await writeOverview();
console.log(JSON.stringify({ ok: true, episodes: episodes.length + 1, root }, null, 2));
