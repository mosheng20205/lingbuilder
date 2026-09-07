import fs from 'node:fs';
import path from 'node:path';
import {
  MODULE_NAMES, label, button, textbox, listbox, progress, tabs, fbro,
  PAGE_FILES, FORM_FILES, pagePrepMethod
} from './episodes.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const ROOT = path.join(repoRoot, 'AI 视频自主生产', 'FBro 指纹浏览器合集');

function uses(ids) {
  return ids.map(id => `使用 ${MODULE_NAMES[id][0]}`).join('\n');
}

// ============================================================ 01
const ep01 = {
  dir: '01 FBro 入门',
  id: 'fbro-ep01-embed',
  name: 'FBro 入门示例',
  className: 'FBro入门窗体',
  pkg: 'FBro教程第01集',
  title: 'FBro 入门示例',
  size: [960, 680],
  desc: '拖入一个 FBro 指纹浏览器控件，用一行 FBro_导航 完成进程内嵌入。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events'],
  controls: [
    label('status-label', '状态标签', '准备中…', 16, 12, 916),
    fbro('browser-1', '浏览器1', 16, 44, 916, 596, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep01' })
  ],
  code: (m) => `包 FBro教程第01集
${uses(m)}

类 FBro入门窗体 : 窗口
公开
  构造()
  结束

  事件 _FBro入门窗体_创建完毕()
      FBro_绑定事件(浏览器1, "加载状态改变", &浏览器1_加载状态改变)
      FBro_绑定事件(浏览器1, "标题被改变", &浏览器1_标题被改变)
      控件_设置文本(状态标签, "正在加载演示页面…")
      FBro_导航(浏览器1, "https://www.baidu.com")
      调试输出("FBro 入门示例：已发出导航请求")
  结束

  事件 浏览器1_加载状态改变()
      如果 (FBro_是否加载中(浏览器1) == 0)
          控件_设置文本(状态标签, "加载完成：" + FBro_取地址(浏览器1))
          调试输出("加载完成，标题：" + FBro_取标题(浏览器1))
      如果结束
  结束

  事件 浏览器1_标题被改变()
      调试输出("标题事件：" + FBro_取事件字段(浏览器1, "title"))
  结束

  // 控件随窗口自动创建，无需调用 FBro_创建；控件参数是裸 controlRef，处理器必须写成 &处理器名。
结束类

// 本集口播命令：FBro_绑定事件、FBro_导航、FBro_是否加载中、FBro_取地址、FBro_取标题、FBro_取事件字段
`
};

// ============================================================ 02
const ep02 = {
  dir: '02 浏览器管理器',
  id: 'fbro-ep02-manager',
  name: 'FBro 浏览器管理器示例',
  className: 'FBro管理器窗体',
  pkg: 'FBro教程第02集',
  title: 'FBro 浏览器管理器示例',
  size: [1180, 760],
  desc: '用浏览器管理器把多个 FBro 实例收进同一套界面：实例列表、页面选项卡、地址栏和下载视图。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fbro.transfer', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    label('lb-list', '列表说明', '实例列表', 16, 12, 220),
    listbox('instance-list', '实例列表', 16, 36, 220, 560),
    button('btn-add', '新增按钮', '新增实例', 16, 606, 105),
    button('btn-switch', '切换按钮', '切换到第一个', 131, 606, 105),
    button('btn-delete', '删除按钮', '删除当前实例', 16, 642, 105),
    button('btn-download', '下载按钮', '下载测试文件', 131, 642, 105),
    label('lb-address', '地址说明', '当前地址', 252, 12, 120),
    textbox('address-box', '地址栏', '', 252, 36, 700, 26),
    button('btn-go', '转到按钮', '转到', 962, 34, 90, 28),
    tabs('page-tabs', '页面选项卡', 252, 72, 900, 524),
    label('download-detail', '下载详情', '下载详情：暂无', 252, 606, 900),
    progress('download-progress', '下载进度', 252, 634, 900),
    label('status-label', '状态标签', '等待初始化…', 252, 664, 900)
  ],
  code: (m) => `包 FBro教程第02集
${uses(m)}

类 FBro管理器窗体 : 窗口
私有
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro管理器窗体_创建完毕()
      浏览器管理器_初始化(页面选项卡, 实例列表, "fbro-ep02-demo")
      浏览器管理器_绑定地址栏(地址栏)
      浏览器管理器_绑定下载视图(下载详情, 下载进度)
      // 管理器初始化会自动补一个默认实例，其内置默认地址不是本教程用的页面；
      // 这里显式导航到本地测试页，示例离线可复现，也不引入无关站点。
      准备本地测试页()
      浏览器管理器_导航(本地测试页)
      控件_设置文本(状态标签, "管理器已初始化，当前实例数：" + 到文本(浏览器管理器_取实例数量()))
      调试输出("实例顺序：" + 浏览器管理器_取实例顺序JSON())
  结束

  事件 _新增按钮_被单击()
      浏览器管理器_新增实例("工作区 " + 到文本(浏览器管理器_取实例数量() + 1), 本地测试页)
      局部 文本型 实例数 = 到文本(浏览器管理器_取实例数量())
      控件_设置文本(状态标签, "已新增实例，共 " + 实例数 + " 个")
  结束

  事件 _切换按钮_被单击()
      浏览器管理器_切换索引(0)
      控件_设置文本(状态标签, "当前实例：" + 浏览器管理器_取当前名称() + "  地址：" + 浏览器管理器_取当前地址())
  结束

  事件 _转到按钮_被单击()
      浏览器管理器_导航(控件_取文本(地址栏))
      控件_设置文本(状态标签, "已请求导航：" + 控件_取文本(地址栏))
  结束

  事件 _下载按钮_被单击()
      浏览器管理器_导航(本地测试页)
      控件_设置文本(状态标签, "下载状态：" + 浏览器管理器_取当前下载状态())
  结束

  事件 _删除按钮_被单击()
      // 传 假 表示只删除列表项并保留受管 Profile；传 真 才会清理该实例的数据目录。
      浏览器管理器_删除当前(假)
      局部 文本型 剩余数 = 到文本(浏览器管理器_取实例数量())
      控件_设置文本(状态标签, "已删除当前实例，剩余 " + 剩余数 + " 个")
  结束

${pagePrepMethod('准备本地测试页', '演示页面', PAGE_FILES, '', { urlVar: '本地测试页', navigate: false })}

  // 管理器绑定的是普通 Win32 控件（选项卡、列表框、编辑框、标签、进度条），不是 FBro 浏览器控件。
结束类

// 本集口播命令：浏览器管理器_初始化、浏览器管理器_绑定地址栏、浏览器管理器_绑定下载视图、
// 浏览器管理器_新增实例、浏览器管理器_切换索引、浏览器管理器_导航、浏览器管理器_删除当前、
// 浏览器管理器_取实例数量、浏览器管理器_取当前名称、浏览器管理器_取当前地址、浏览器管理器_取当前下载状态
`
};

// ============================================================ 03
const ep03 = {
  dir: '03 会话隔离',
  id: 'fbro-ep03-isolation',
  name: 'FBro 会话隔离示例',
  className: 'FBro会话隔离窗体',
  pkg: 'FBro教程第03集',
  title: 'FBro 会话隔离示例',
  size: [1240, 740],
  desc: '两个独立缓存目录和独立 UserAgent 的 FBro 实例，演示会话隔离与受控清理。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fbro.session', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    label('lb-a', '工作区A说明', '工作区 A · 独立缓存目录 .fbro/ep03-workspace-a', 16, 12, 600),
    label('lb-b', '工作区B说明', '工作区 B · 独立缓存目录 .fbro/ep03-workspace-b', 624, 12, 600),
    fbro('browser-a', '工作区A', 16, 36, 596, 560, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep03-workspace-a', userAgent: 'LingBuilder-FBro-Demo/WorkspaceA' }),
    fbro('browser-b', '工作区B', 624, 36, 596, 560, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep03-workspace-b', userAgent: 'LingBuilder-FBro-Demo/WorkspaceB' }),
    button('btn-open', '打开测试页按钮', '两个工作区打开测试页', 16, 606, 190),
    button('btn-cookie', '读取Cookie按钮', '读取站点数据', 206, 606, 150),
    button('btn-clear-site', '清理站点按钮', '清理指定站点数据', 366, 606, 170),
    button('btn-clear-cache', '清理缓存按钮', '清理工作区A缓存', 546, 606, 170),
    label('status-label', '状态标签', '两个工作区使用不同的缓存目录和用户代理。', 16, 646, 1204, 60)
  ],
  code: (m) => `包 FBro教程第03集
${uses(m)}

类 FBro会话隔离窗体 : 窗口
私有
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro会话隔离窗体_创建完毕()
      // 缓存目录与用户代理都属于创建期配置，已在设计器属性里按工作区分别填好。
      FBro_绑定事件(工作区A, "加载状态改变", &工作区A_加载状态改变)
      FBro_绑定事件(工作区B, "加载状态改变", &工作区B_加载状态改变)
      // 只在创建完毕里写出测试页并记下地址；真正的导航放到按钮里，
      // 避免在窗口创建流程内同步等待浏览器首次导航。
      准备测试页()
      控件_设置文本(状态标签, "测试页已就绪，点「两个工作区打开测试页」开始演示。")
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(工作区A, 本地测试页)
      FBro_导航(工作区B, 本地测试页)
      控件_设置文本(状态标签, "两个工作区已分别导航到本地测试页，缓存目录互不共用。")
  结束

  事件 工作区A_加载状态改变()
      如果 (FBro_是否加载中(工作区A) == 0)
          调试输出("工作区 A 加载完成：" + FBro_取地址(工作区A))
      如果结束
  结束

  事件 工作区B_加载状态改变()
      如果 (FBro_是否加载中(工作区B) == 0)
          调试输出("工作区 B 加载完成：" + FBro_取地址(工作区B))
      如果结束
  结束

  事件 _读取Cookie按钮_被单击()
      // 只统计长度，避免把站点数据明文写进日志或录制画面。
      局部 文本型 站点数据A = FBro会话_取Cookie(工作区A, 本地测试页)
      局部 文本型 站点数据B = FBro会话_取Cookie(工作区B, 本地测试页)
      局部 文本型 长度A = 到文本(文本_取长度(站点数据A))
      局部 文本型 长度B = 到文本(文本_取长度(站点数据B))
      控件_设置文本(状态标签, "工作区 A 站点数据长度 " + 长度A + "，工作区 B 站点数据长度 " + 长度B)
  结束

  事件 _清理站点按钮_被单击()
      局部 整数型 结果 = FBro会话_清空Cookie(工作区A, 本地测试页)
      局部 文本型 返回码 = 到文本(结果)
      控件_设置文本(状态标签, "已按地址清理工作区 A 的站点数据，返回码 " + 返回码)
  结束

  事件 _清理缓存按钮_被单击()
      局部 长整数型 任务 = FBro会话_异步清理缓存(工作区A, 本地测试页, 0, 0)
      局部 文本型 任务文本 = 到文本(任务)
      控件_设置文本(状态标签, "已提交工作区 A 缓存清理任务，任务 ID " + 任务文本)
      调试输出("清理任务 ID：" + 任务文本)
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '工作区A', { urlVar: '本地测试页', navigate: false })}

  // 隔离的是 Profile 与会话，不是进程；进程怎么分请看第 05 集。
结束类

// 本集口播命令：FBro_绑定事件、FBro_导航、FBro会话_取Cookie、FBro会话_清空Cookie、FBro会话_异步清理缓存
`,
};

// ============================================================ 04
const VIP_FIXTURE = '{"device":"demo","platform":"Win32","language":"zh-CN","timezone":"Asia/Shanghai","note":"tutorial-fixture-only"}';
const ep04 = {
  dir: '04 指纹配置',
  id: 'fbro-ep04-fingerprint',
  name: 'FBro 指纹配置安全示例',
  className: 'FBro指纹配置窗体',
  pkg: 'FBro教程第04集',
  title: 'FBro 指纹配置安全示例',
  size: [1080, 720],
  desc: '在授权测试环境中演示结构化指纹配置入口、脱敏授权状态与失败诊断；无授权时安全失败。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fbro.vip', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    button('btn-open', '打开测试页按钮', '打开测试页', 16, 12, 130),
    button('btn-auth', '授权状态按钮', '读取授权状态', 156, 12, 150),
    button('btn-apply', '应用配置按钮', '应用脱敏配置', 316, 12, 150),
    button('btn-read', '读取配置按钮', '读取已应用配置', 476, 12, 150),
    button('btn-bad', '无效配置按钮', '故意用无效配置', 636, 12, 150),
    label('status-label', '状态标签', '只使用脱敏测试夹具；授权码、Permit 与 Key 不进入源码、日志或画面。', 16, 50, 1040, 44),
    fbro('browser-1', '浏览器1', 16, 100, 1040, 560, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep04' })
  ],
  code: (m) => `包 FBro教程第04集
${uses(m)}

类 FBro指纹配置窗体 : 窗口
私有
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro指纹配置窗体_创建完毕()
      准备测试页()
      控件_设置文本(状态标签, "已就绪。指纹配置只使用脱敏测试夹具，不展示任何授权凭据。")
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(浏览器1, 本地测试页)
  结束

  事件 _授权状态按钮_被单击()
      // 实测：未授权环境下调用 FBroVIP_取授权信息JSON() 会让进程直接退出，
      // 所以示例只读取不会崩溃的脱敏字段来判断当前环境是否可用，且只输出长度、不输出内容。
      局部 文本型 调用次数 = FBro指纹_取调用次数(浏览器1)
      局部 文本型 已应用 = FBroVIP_取已应用配置JSON(浏览器1)
      局部 文本型 次数长度 = 到文本(文本_取长度(调用次数))
      局部 文本型 配置长度 = 到文本(文本_取长度(已应用))
      控件_设置文本(状态标签, "脱敏状态：调用次数字段长度 " + 次数长度 + "，已应用配置长度 " + 配置长度 + "（内容一律不展示）")
  结束

  事件 _应用配置按钮_被单击()
      局部 整数型 结果 = FBro指纹_应用配置(浏览器1, "${VIP_FIXTURE.replace(/"/g, '\\"')}")
      局部 文本型 返回码 = 到文本(结果)
      // 实测：FBro指纹_应用配置 非 0 表示成功，0 表示未生效；不要按「0 即成功」理解。
      如果 (结果 != 0)
          控件_设置文本(状态标签, "脱敏配置已应用，返回码 " + 返回码)
      否则
          控件_设置文本(状态标签, "未生效，返回码 0；诊断：" + FBro_取最近错误(浏览器1))
      如果结束
      调试输出("指纹配置返回码：" + 返回码)
  结束

  事件 _读取配置按钮_被单击()
      局部 文本型 已应用 = FBroVIP_取已应用配置JSON(浏览器1)
      局部 文本型 配置长度 = 到文本(文本_取长度(已应用))
      局部 文本型 调用次数 = FBro指纹_取调用次数(浏览器1)
      控件_设置文本(状态标签, "已应用配置长度 " + 配置长度 + "，调用次数摘要 " + 调用次数)
  结束

  事件 _无效配置按钮_被单击()
      // 故意提交不完整 JSON，演示可审查的中文失败诊断；不会伪造成功。
      局部 整数型 结果 = FBro指纹_应用配置(浏览器1, "{\\"device\\":")
      局部 文本型 返回码 = 到文本(结果)
      // 实测：残缺 JSON 会返回 0（未生效），但当前版本不一定给出中文诊断文本；
      // 报告与口播只说「未生效」，不能宣称一定拿得到诊断信息。
      控件_设置文本(状态标签, "无效配置返回码 " + 返回码 + "；最近错误：" + FBro_取最近错误(浏览器1))
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { urlVar: '本地测试页', navigate: false })}

  // 边界：没有有效授权时，本示例只展示失败返回码与中文诊断，绝不宣称「配置已生效」。
结束类

// 本集口播命令：FBroVIP_取授权信息JSON、FBro指纹_应用配置、FBroVIP_取已应用配置JSON、FBro指纹_取调用次数、FBro_取最近错误
`,
};

// ============================================================ 05
const ep05 = {
  dir: '05 三种宿主模式',
  id: 'fbro-ep05-hostmode',
  name: 'FBro 三种宿主模式示例',
  className: 'FBro宿主模式窗体',
  pkg: 'FBro教程第05集',
  title: 'FBro 三种宿主模式示例',
  size: [1280, 780],
  desc: '同一窗口内并列进程内嵌入、独立进程嵌入与独立顶层窗口三种 FBro 宿主模式。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    label('lb1', '模式一说明', '① 进程内嵌入 in-process', 16, 12, 400),
    label('lb2', '模式二说明', '② 独立进程嵌入 independent-embedded', 432, 12, 400),
    label('lb3', '模式三说明', '③ 独立顶层窗口 independent-window', 848, 12, 400),
    fbro('browser-inproc', '进程内浏览器', 16, 36, 400, 420, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep05-inproc', processMode: 'in-process' }),
    fbro('browser-embedded', '独立进程浏览器', 432, 36, 400, 420, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep05-embedded', processMode: 'independent-embedded' }),
    fbro('browser-window', '独立窗口浏览器', 848, 36, 400, 420, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep05-window', processMode: 'independent-window' }),
    button('btn-open', '打开测试页按钮', '三个模式打开测试页', 16, 470, 190),
    button('btn-status', '状态按钮', '刷新进程状态', 216, 470, 150),
    button('btn-chrome', '原生UI按钮', '打开谷歌原生 UI', 376, 470, 170),
    listbox('status-list', '状态列表', 16, 510, 1232, 240)
  ],
  code: (m) => `包 FBro教程第05集
${uses(m)}

类 FBro宿主模式窗体 : 窗口
私有
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro宿主模式窗体_创建完毕()
      控件_添加项目(状态列表, "三个控件分别使用进程内、独立进程嵌入和独立顶层窗口。")
      控件_添加项目(状态列表, "点「刷新进程状态」查看各自的进程状态、进程 ID 与调试端口。")
      准备测试页()
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(进程内浏览器, 本地测试页)
      FBro_导航(独立进程浏览器, 本地测试页)
      FBro_导航(独立窗口浏览器, 本地测试页)
      控件_添加项目(状态列表, "三个宿主模式已分别导航到本地测试页。")
  结束

  事件 _状态按钮_被单击()
      控件_清空项目(状态列表)
      // 一个表达式里只放一次「到文本」，多个数值先各自转成文本型再拼接。
      局部 文本型 状态1 = 到文本(FBro_取进程状态(进程内浏览器))
      局部 文本型 进程1 = 到文本(FBro_取进程ID(进程内浏览器))
      局部 文本型 端口1 = 到文本(FBro_取调试端口(进程内浏览器))
      控件_添加项目(状态列表, "① 进程内　　　状态=" + 状态1 + " 进程ID=" + 进程1 + " 调试端口=" + 端口1)
      局部 文本型 状态2 = 到文本(FBro_取进程状态(独立进程浏览器))
      局部 文本型 进程2 = 到文本(FBro_取进程ID(独立进程浏览器))
      局部 文本型 端口2 = 到文本(FBro_取调试端口(独立进程浏览器))
      控件_添加项目(状态列表, "② 独立进程嵌入 状态=" + 状态2 + " 进程ID=" + 进程2 + " 调试端口=" + 端口2)
      局部 文本型 状态3 = 到文本(FBro_取进程状态(独立窗口浏览器))
      局部 文本型 进程3 = 到文本(FBro_取进程ID(独立窗口浏览器))
      局部 文本型 端口3 = 到文本(FBro_取调试端口(独立窗口浏览器))
      控件_添加项目(状态列表, "③ 独立顶层窗口 状态=" + 状态3 + " 进程ID=" + 进程3 + " 调试端口=" + 端口3)
      控件_添加项目(状态列表, "进程内模式没有独立调试端口，返回 0 属于预期。")
  结束

  事件 _原生UI按钮_被单击()
      // 这是基于现有实例会话的 Chrome Runtime 独立窗口，不等于第三种 processMode。
      FBro_打开谷歌原生UI浏览器(进程内浏览器, 本地测试页)
      控件_添加项目(状态列表, "已打开谷歌原生 UI 浏览器窗口（Chrome Runtime，非第三种宿主模式）。")
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '进程内浏览器', { urlVar: '本地测试页', navigate: false })}

  // FBro 使用 CEF 135，CEF3 模块使用 CEF 150，两者的进程内 ABI 不能混用。
结束类

// 本集口播命令：FBro_取进程状态、FBro_取进程ID、FBro_取调试端口、FBro_打开谷歌原生UI浏览器
`
};

// ============================================================ 06
const ep06 = {
  dir: '06 事件驱动',
  id: 'fbro-ep06-events',
  name: 'FBro 事件驱动示例',
  className: 'FBro事件驱动窗体',
  pkg: 'FBro教程第06集',
  title: 'FBro 事件驱动示例',
  size: [1180, 760],
  desc: '绑定导航、弹窗与加载事件，读取事件数据字段，演示同步决策与采样率。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    button('btn-open', '打开测试页按钮', '打开测试页', 16, 12, 150),
    button('btn-sample', '采样率按钮', '暂停高频事件', 176, 12, 150),
    button('btn-clear', '清空日志按钮', '清空事件日志', 336, 12, 150),
    label('status-label', '状态标签', '事件处理器统一使用 &处理器名，同步决策必须尽快返回。', 502, 16, 660),
    fbro('browser-1', '浏览器1', 16, 50, 1148, 430, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep06' }),
    listbox('event-log', '事件日志', 16, 490, 1148, 240)
  ],
  code: (m) => `包 FBro教程第06集
${uses(m)}

类 FBro事件驱动窗体 : 窗口
私有
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro事件驱动窗体_创建完毕()
      FBro_绑定事件(浏览器1, "导航请求前", &处理导航请求前)
      FBro_绑定事件(浏览器1, "标签页打开地址请求", &处理标签页打开)
      FBro_绑定事件(浏览器1, "新窗口打开前", &处理新窗口)
      FBro_绑定事件(浏览器1, "加载完成", &处理加载完成)
      准备测试页()
      控件_添加项目(事件日志, "已绑定：导航请求前 / 标签页打开地址请求 / 新窗口打开前 / 加载完成")
  结束

  事件 处理导航请求前()
      // 同步决策：1 = 继续，2 = 取消。字段来自 Bridge 实际投递的事件包。
      局部 文本型 框架地址 = FBro_取事件字段(浏览器1, "frame")
      局部 文本型 用户手势 = FBro_取事件字段(浏览器1, "user_gesture")
      控件_添加项目(事件日志, "导航请求前　框架=" + 框架地址 + " 用户手势=" + 用户手势)
      FBro_设置事件结果(浏览器1, 1)
  结束

  事件 处理标签页打开()
      // 这个事件带 target_url，可以按目标地址做同步放行或拦截。
      局部 文本型 目标地址 = FBro_取事件字段(浏览器1, "target_url")
      控件_添加项目(事件日志, "标签页打开地址请求　目标=" + 目标地址)
      FBro_设置事件结果(浏览器1, 1)
  结束

  事件 处理新窗口()
      局部 文本型 弹窗地址 = FBro_取事件字段(浏览器1, "url")
      控件_添加项目(事件日志, "新窗口打开前　地址=" + 弹窗地址 + "（已按测试策略取消）")
      FBro_设置事件结果(浏览器1, 2)
  结束

  事件 处理加载完成()
      控件_添加项目(事件日志, "加载完成　事件包=" + FBro_取事件数据(浏览器1))
      控件_设置文本(状态标签, "当前地址：" + FBro_取地址(浏览器1))
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(浏览器1, 本地测试页)
  结束

  事件 _采样率按钮_被单击()
      // 0 表示暂停投递；高频事件必须显式订阅并设置采样率才会送达。
      FBro_设置事件采样率(浏览器1, "加载进度改变", 0)
      控件_添加项目(事件日志, "已把「加载进度改变」采样率设为 0（暂停投递）。")
  结束

  事件 _清空日志按钮_被单击()
      控件_清空项目(事件日志)
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { urlVar: '本地测试页', navigate: false })}

  // 需要等待的权限/文件对话框属于延迟决策：先 FBro_取事件延续，再 FBro事件_完成延续 或 FBro事件_取消延续，只能完成一次。
结束类

// 本集口播命令：FBro_绑定事件、FBro_取事件字段、FBro_取事件数据、FBro_设置事件结果、FBro_设置事件采样率
`
};

// ============================================================ 07
const ep07 = {
  dir: '07 获取资源响应',
  id: 'fbro-ep07-resource',
  name: 'FBro 资源响应元数据示例',
  className: 'FBro资源响应窗体',
  pkg: 'FBro教程第07集',
  title: 'FBro 资源响应元数据示例',
  size: [1180, 780],
  desc: '加载本地测试页，绑定资源响应到达与资源加载完成，输出 FBro Bridge 实际提供的公开字段。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    button('btn-reload', '重新加载按钮', '重新加载测试页', 16, 12, 170),
    button('btn-clear', '清空按钮', '清空资源日志', 196, 12, 150),
    label('status-label', '状态标签', '本集只输出当前公开事件字段，不承诺响应正文与响应头对象。', 362, 16, 800),
    fbro('browser-1', '浏览器1', 16, 50, 1148, 400, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep07' }),
    listbox('resource-log', '资源日志', 16, 460, 1148, 290)
  ],
  code: (m) => `包 FBro教程第07集
${uses(m)}

类 FBro资源响应窗体 : 窗口
私有
  文本型 页面地址 = ""

公开
  构造()
  结束

  事件 _FBro资源响应窗体_创建完毕()
      FBro_绑定事件(浏览器1, "资源响应到达", &处理资源响应)
      FBro_绑定事件(浏览器1, "资源加载完成", &处理资源完成)
      准备测试页()
      控件_添加项目(资源日志, "测试页已就绪，点「重新加载测试页」开始观察资源事件。")
  结束

  事件 处理资源响应()
      // FBro Bridge 为该事件实际投递的字段是 browser / frame / request / response。
      // 与 CEF3 模块不同，这里没有 url、statusCode、mimeType；不要编造字段。
      局部 文本型 框架地址 = FBro_取事件字段(浏览器1, "frame")
      控件_添加项目(资源日志, "资源响应到达　框架=" + 框架地址 + "　事件包=" + FBro_取事件数据(浏览器1))
      FBro_设置事件结果(浏览器1, 1)
  结束

  事件 处理资源完成()
      // 资源加载完成额外带 status 与 received_content_length 两个数值字段。
      局部 文本型 状态 = FBro_取事件字段(浏览器1, "status")
      局部 文本型 字节数 = FBro_取事件字段(浏览器1, "received_content_length")
      控件_添加项目(资源日志, "资源加载完成　status=" + 状态 + "　接收字节=" + 字节数)
  结束

  事件 _重新加载按钮_被单击()
      控件_清空项目(资源日志)
      FBro_导航(浏览器1, 页面地址)
  结束

  事件 _清空按钮_被单击()
      控件_清空项目(资源日志)
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { navigate: false })}

  // 能力边界：当前公开用户接口不暴露 CefResponse 的正文和响应头对象，
  // 也不提供该事件的 url / statusCode / mimeType 字段；需要这些信息时以后续公开 binding 为准。
结束类

// 本集口播命令：FBro_绑定事件、FBro_取事件字段、FBro_取事件数据、FBro_设置事件结果
`
};

// ============================================================ 08
const ep08 = {
  dir: '08 CDP 自动化',
  id: 'fbro-ep08-cdp',
  name: 'FBro CDP 自动化示例',
  className: 'FBroCDP自动化窗体',
  pkg: 'FBro教程第08集',
  title: 'FBro CDP 自动化示例',
  size: [1180, 780],
  desc: '独立进程嵌入 + 开发者工具，取本机调试端口后用 CDP 完成取标题、查询元素与点击。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.cdp.client', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    button('btn-open', '打开测试页按钮', '打开测试页', 16, 12, 130),
    button('btn-port', '取端口按钮', '读取调试端口', 156, 12, 150),
    button('btn-connect', '连接按钮', '连接 CDP', 316, 12, 130),
    button('btn-title', '取标题按钮', '读取页面标题', 456, 12, 150),
    button('btn-click', '点击按钮', '查询并点击按钮', 616, 12, 170),
    button('btn-close', '断开按钮', '断开并清理', 796, 12, 150),
    label('status-label', '状态标签', '调试端口只在本机回环使用，不要暴露到公网。', 16, 50, 1148, 24),
    fbro('browser-1', '浏览器1', 16, 80, 1148, 400, { url: 'about:blank', cacheDir: '.fbro/ep08', processMode: 'independent-embedded', enableDevTools: true }),
    listbox('cdp-log', 'CDP日志', 16, 490, 1148, 260)
  ],
  code: (m) => `包 FBro教程第08集
${uses(m)}

类 FBroCDP自动化窗体 : 窗口
私有
  // 受管句柄保存在窗体成员里；CDP连接 / CDP页面 / CDP元素 都是模块提供的受管类型。
  CDP连接 连接句柄 = 0
  CDP页面 页面句柄 = 0
  逻辑型 已连接 = 假
  逻辑型 已附加页面 = 假
  文本型 测试页地址 = ""

公开
  构造()
  结束

  事件 _FBroCDP自动化窗体_创建完毕()
      控件_添加项目(CDP日志, "控件已设为独立进程嵌入并开启开发者工具，进程内模式没有可连接的端口。")
      // 独立进程嵌入的 Host 需要先启动完毕，导航放到「打开测试页」按钮里，避免在 Host 就绪前被丢弃。
      准备测试页()
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(浏览器1, 测试页地址)
      控件_添加项目(CDP日志, "已导航到本地测试页：" + 测试页地址)
  结束

  事件 _取端口按钮_被单击()
      局部 整数型 端口 = FBro_取调试端口(浏览器1)
      如果 (端口 == 0)
          控件_设置文本(状态标签, "尚未取得调试端口：请确认独立进程 Host 已启动且已启用开发者工具。")
      否则
          控件_设置文本(状态标签, "调试端口：http://127.0.0.1:" + 到文本(端口))
      如果结束
      控件_添加项目(CDP日志, "FBro_取调试端口 = " + 到文本(端口))
  结束

  事件 _连接按钮_被单击()
      局部 整数型 端口 = FBro_取调试端口(浏览器1)
      如果 (端口 == 0)
          控件_添加项目(CDP日志, "调试端口为 0，无法连接；先确认 Host 已启动。")
          返回
      如果结束
      连接句柄 = CDP_连接("http://127.0.0.1:" + 到文本(端口), &连接就绪)
      控件_添加项目(CDP日志, "已发起 CDP 连接，连接句柄 " + 到文本(连接句柄))
  结束

  空 连接就绪()
      如果 (CDP_取当前事件类型() == "已就绪")
          已连接 = 真
          控件_添加项目(CDP日志, 到文本("连接就绪，浏览器版本：") + CDP_取浏览器版本(连接句柄))
          // 附加 Host 里已存在的空白页，再用 CDP 自己导航到本地测试页，
          // 这样不依赖 FBro 侧的导航时机，链路更确定。
          页面句柄 = CDP_附加页面(连接句柄, "about:blank", &页面就绪)
      否则
          控件_添加项目(CDP日志, 到文本("连接失败：") + CDP_取当前错误())
      如果结束
  结束

  空 页面就绪()
      如果 (CDP_取当前事件类型() == "页面就绪")
          已附加页面 = 真
          控件_添加项目(CDP日志, 到文本("页面已附加：") + CDP_取页面网址(页面句柄))
          CDP_打开网址(页面句柄, 测试页地址, &页面加载完成)
      否则
          控件_添加项目(CDP日志, 到文本("页面附加失败：") + CDP_取当前错误())
      如果结束
  结束

  空 页面加载完成()
      如果 (CDP_取当前事件类型() == "加载完成")
          控件_添加项目(CDP日志, 到文本("测试页已加载：") + CDP_取页面网址(页面句柄))
      否则
          控件_添加项目(CDP日志, 到文本("测试页加载失败：") + CDP_取当前错误())
      如果结束
  结束

  事件 _取标题按钮_被单击()
      如果 (已附加页面 == 假)
          控件_添加项目(CDP日志, "请先连接 CDP 并附加页面。")
          返回
      如果结束
      CDP_取页面标题(页面句柄, &标题读取完成)
  结束

  空 标题读取完成()
      如果 (CDP_取当前事件类型() == "命令完成")
          控件_添加项目(CDP日志, 到文本("页面标题：") + CDP_取当前事件文本())
      否则
          控件_添加项目(CDP日志, 到文本("读取标题失败：") + CDP_取当前错误())
      如果结束
  结束

  事件 _点击按钮_被单击()
      如果 (已附加页面 == 假)
          控件_添加项目(CDP日志, "请先连接 CDP 并附加页面。")
          返回
      如果结束
      局部 CDP元素 目标元素 = CDP_查询元素(页面句柄, "#demo-button")
      如果 (目标元素 == 0)
          控件_添加项目(CDP日志, "未查询到 #demo-button。")
          返回
      如果结束
      CDP_点击元素(目标元素, &点击完成)
  结束

  空 点击完成()
      如果 (CDP_取当前事件类型() == "命令完成")
          CDP_执行脚本(页面句柄, "document['getElementById']('click-result')['textContent']", &结果读取完成)
      否则
          控件_添加项目(CDP日志, 到文本("点击失败：") + CDP_取当前错误())
      如果结束
  结束

  空 结果读取完成()
      控件_添加项目(CDP日志, 到文本("测试页状态：") + CDP_取当前事件文本())
  结束

  事件 _断开按钮_被单击()
      如果 (已附加页面)
          CDP_关闭页面(页面句柄)
          已附加页面 = 假
      如果结束
      如果 (已连接)
          CDP_断开连接(连接句柄)
          已连接 = 假
      如果结束
      控件_添加项目(CDP日志, "已断开 CDP 连接并释放受管句柄。")
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { urlVar: '测试页地址', navigate: false })}

  // 边界：CDP 是协议级自动化，只用于自己有权控制的页面；不用于绕过网站规则或风控。
结束类

// 本集口播命令：FBro_取调试端口、CDP_连接、CDP_附加页面、CDP_取页面标题、CDP_查询元素、CDP_点击元素、CDP_执行脚本、CDP_断开连接
`
};

// ============================================================ 09
const ep09 = {
  dir: '09 网页填表',
  id: 'fbro-ep09-form',
  name: 'FBro 网页填表示例',
  className: 'FBro网页填表窗体',
  pkg: 'FBro教程第09集',
  title: 'FBro 网页填表示例',
  size: [1180, 780],
  desc: '用 CDP 在自有测试表单上完成文本输入、下拉选择、复选、单选与提交结果校验。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.cdp.client', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: FORM_FILES,
  controls: [
    button('btn-open', '打开表单按钮', '打开测试表单', 16, 12, 150),
    button('btn-connect', '连接按钮', '连接 CDP', 176, 12, 130),
    button('btn-fill', '填写按钮', '填写姓名', 316, 12, 130),
    button('btn-choose', '选择按钮', '选择城市与联系方式', 456, 12, 190),
    button('btn-submit', '提交按钮', '勾选并提交', 656, 12, 150),
    button('btn-verify', '校验按钮', '读取提交结果', 816, 12, 150),
    label('status-label', '状态标签', '只操作本地测试表单，不涉及真实账号、验证码或支付。', 16, 50, 1148, 24),
    fbro('browser-1', '浏览器1', 16, 80, 1148, 400, { url: 'about:blank', cacheDir: '.fbro/ep09', processMode: 'independent-embedded', enableDevTools: true }),
    listbox('form-log', '填表日志', 16, 490, 1148, 260)
  ],
  code: (m) => `包 FBro教程第09集
${uses(m)}

类 FBro网页填表窗体 : 窗口
私有
  CDP连接 连接句柄 = 0
  CDP页面 页面句柄 = 0
  文本型 表单页地址 = ""

公开
  构造()
  结束

  事件 _FBro网页填表窗体_创建完毕()
      控件_添加项目(填表日志, "测试表单选择器：#name、#city、#interest-email、#contact-phone、#submit、#result")
      准备测试表单()
  结束

  事件 _打开表单按钮_被单击()
      FBro_导航(浏览器1, 表单页地址)
      控件_添加项目(填表日志, "已导航到本地测试表单：" + 表单页地址)
  结束

  事件 _连接按钮_被单击()
      局部 整数型 端口 = FBro_取调试端口(浏览器1)
      如果 (端口 == 0)
          控件_添加项目(填表日志, "调试端口为 0：请确认独立进程 Host 已启动且已启用开发者工具。")
          返回
      如果结束
      连接句柄 = CDP_连接("http://127.0.0.1:" + 到文本(端口), &连接就绪)
      控件_设置文本(状态标签, "已发起 CDP 连接。")
  结束

  空 连接就绪()
      如果 (CDP_取当前事件类型() == "已就绪")
          页面句柄 = CDP_附加页面(连接句柄, "about:blank", &页面就绪)
      否则
          控件_添加项目(填表日志, 到文本("连接失败：") + CDP_取当前错误())
      如果结束
  结束

  空 页面就绪()
      如果 (CDP_取当前事件类型() == "页面就绪")
          控件_添加项目(填表日志, 到文本("表单页已附加：") + CDP_取页面网址(页面句柄))
          CDP_打开网址(页面句柄, 表单页地址, &表单加载完成)
      否则
          控件_添加项目(填表日志, 到文本("表单页附加失败：") + CDP_取当前错误())
      如果结束
  结束

  空 表单加载完成()
      如果 (CDP_取当前事件类型() == "加载完成")
          控件_添加项目(填表日志, 到文本("测试表单已加载：") + CDP_取页面网址(页面句柄))
      否则
          控件_添加项目(填表日志, 到文本("测试表单加载失败：") + CDP_取当前错误())
      如果结束
  结束

  事件 _填写按钮_被单击()
      如果 (页面句柄 == 0)
          控件_添加项目(填表日志, "请先连接 CDP。")
          返回
      如果结束
      // CDP_输入文本 会先聚焦再逐字符输入，中文也能稳定写入。
      局部 CDP元素 姓名框 = CDP_查询元素(页面句柄, "#name")
      CDP_输入文本(姓名框, "测试用户", &输入完成)
  结束

  空 输入完成()
      控件_添加项目(填表日志, 到文本("姓名输入完成，事件类型：") + CDP_取当前事件类型())
  结束

  事件 _选择按钮_被单击()
      如果 (页面句柄 == 0)
          控件_添加项目(填表日志, "请先连接 CDP。")
          返回
      如果结束
      // 下拉框用执行脚本设置值并主动派发 change 事件。
      CDP_执行脚本(页面句柄, "var s=document['getElementById']('city');s['value']='beijing';s['dispatchEvent'](new Event('change'));s['value']", &选择完成)
      局部 CDP元素 单选框 = CDP_查询元素(页面句柄, "#contact-phone")
      CDP_点击元素(单选框, &单选完成)
  结束

  空 选择完成()
      控件_添加项目(填表日志, 到文本("城市已选择：") + CDP_取当前事件文本())
  结束

  空 单选完成()
      控件_添加项目(填表日志, 到文本("联系方式单选完成，事件类型：") + CDP_取当前事件类型())
  结束

  事件 _提交按钮_被单击()
      如果 (页面句柄 == 0)
          控件_添加项目(填表日志, "请先连接 CDP。")
          返回
      如果结束
      局部 CDP元素 复选框 = CDP_查询元素(页面句柄, "#interest-email")
      CDP_点击元素(复选框, &复选完成)
  结束

  空 复选完成()
      局部 CDP元素 提交按钮元素 = CDP_查询元素(页面句柄, "#submit")
      CDP_点击元素(提交按钮元素, &提交完成)
  结束

  空 提交完成()
      如果 (CDP_取当前事件类型() == "命令完成")
          控件_添加项目(填表日志, "已提交，准备读取结果区域。")
      否则
          控件_添加项目(填表日志, 到文本("提交失败：") + CDP_取当前错误())
      如果结束
  结束

  事件 _校验按钮_被单击()
      如果 (页面句柄 == 0)
          控件_添加项目(填表日志, "请先连接 CDP。")
          返回
      如果结束
      局部 CDP元素 结果区 = CDP_查询元素(页面句柄, "#result")
      CDP_取元素文本(结果区, &结果读取完成)
  结束

  空 结果读取完成()
      如果 (CDP_取当前事件类型() == "命令完成")
          控件_添加项目(填表日志, 到文本("提交结果：") + CDP_取当前事件文本())
          控件_设置文本(状态标签, 到文本("提交结果：") + CDP_取当前事件文本())
      否则
          控件_添加项目(填表日志, 到文本("读取结果失败：") + CDP_取当前错误())
      如果结束
  结束

${pagePrepMethod('准备测试表单', '演示表单', FORM_FILES, '浏览器1', { urlVar: '表单页地址', navigate: false })}

  // 边界：只填自有测试表单，不涉及真实账号、密码、验证码、支付，也不绕过任何网站限制。
结束类

// 本集口播命令：CDP_连接、CDP_附加页面、CDP_查询元素、CDP_输入文本、CDP_执行脚本、CDP_点击元素、CDP_取元素文本
`
};

// ============================================================ 10
const ep10 = {
  dir: '10 下载截图打印',
  id: 'fbro-ep10-transfer',
  name: 'FBro 下载截图打印示例',
  className: 'FBro落盘工具窗体',
  pkg: 'FBro教程第10集',
  title: 'FBro 下载截图打印示例',
  size: [1180, 780],
  desc: '演示 FBro 传输模块的下载、截图、PDF、打印与受管文件对话框，并在结束后清理临时产物。',
  modules: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', 'lingbuilder.fbro.events', 'lingbuilder.fbro.transfer', 'lingbuilder.fbro.objects', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'],
  assets: PAGE_FILES,
  controls: [
    button('btn-open', '打开测试页按钮', '打开测试页', 16, 12, 130),
    button('btn-download', '下载按钮', '下载测试文件', 156, 12, 150),
    button('btn-shot', '截图按钮', '截图到文件', 316, 12, 130),
    button('btn-pdf', 'PDF按钮', '生成 PDF', 456, 12, 130),
    button('btn-print', '打印按钮', '打开打印流程', 596, 12, 150),
    button('btn-dialog', '对话框按钮', '受管文件对话框', 756, 12, 170),
    button('btn-clean', '清理按钮', '清理演示产物', 936, 12, 150),
    label('status-label', '状态标签', '所有产物写入项目相对目录 演示输出/，演示结束请点「清理演示产物」。', 16, 50, 1148, 24),
    fbro('browser-1', '浏览器1', 16, 80, 1148, 400, { url: 'https://www.baidu.com', cacheDir: '.fbro/ep10' }),
    listbox('transfer-log', '传输日志', 16, 490, 1148, 260)
  ],
  code: (m) => `包 FBro教程第10集
${uses(m)}

类 FBro落盘工具窗体 : 窗口
私有
  长整数型 PDF任务ID = 0
  文本型 本地测试页 = ""

公开
  构造()
  结束

  事件 _FBro落盘工具窗体_创建完毕()
      目录_创建("演示输出")
      FBro_绑定事件(浏览器1, "下载开始", &处理下载开始)
      FBro_绑定事件(浏览器1, "下载进度更新", &处理下载进度)
      准备测试页()
      控件_添加项目(传输日志, "输出目录：演示输出/（相对 exe 所在目录）")
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(浏览器1, 本地测试页)
  结束

  事件 处理下载开始()
      控件_添加项目(传输日志, "下载开始　事件包=" + FBro_取事件数据(浏览器1))
  结束

  事件 处理下载进度()
      控件_添加项目(传输日志, "下载进度　接收字节=" + FBro_取事件字段(浏览器1, "receivedBytes"))
  结束

  事件 _下载按钮_被单击()
      局部 整数型 结果 = FBro传输_开始下载(浏览器1, "https://www.baidu.com")
      控件_设置文本(状态标签, "已请求下载，返回码 " + 到文本(结果))
  结束

  事件 _截图按钮_被单击()
      // 格式支持 png / jpeg，质量对 jpeg 生效。
      局部 整数型 结果 = FBro_截图到文件(浏览器1, "演示输出/页面截图.png", "png", 90)
      如果 (文件_是否存在("演示输出/页面截图.png"))
          局部 文本型 文件大小 = 到文本(文件_取大小("演示输出/页面截图.png"))
          控件_设置文本(状态标签, "截图已生成，大小 " + 文件大小 + " 字节")
      否则
          局部 文本型 返回码 = 到文本(结果)
          控件_设置文本(状态标签, "截图未生成，返回码 " + 返回码 + "；诊断：" + FBro_取最近错误(浏览器1))
      如果结束
  结束

  事件 _PDF按钮_被单击()
      PDF任务ID = FBro传输_异步生成PDF(浏览器1, "演示输出/页面导出.pdf", "{}")
      控件_添加项目(传输日志, "PDF 任务已提交，任务 ID " + 到文本(PDF任务ID))
      如果 (PDF任务ID != 0)
          FBro任务_等待(PDF任务ID, 15000)
          局部 文本型 任务状态 = 到文本(FBro任务_取状态(PDF任务ID))
          局部 文本型 任务结果 = FBro任务_取结果(PDF任务ID)
          局部 文本型 任务错误 = FBro任务_取错误(PDF任务ID)
          控件_添加项目(传输日志, "PDF 任务状态=" + 任务状态 + " 结果=" + 任务结果 + " 错误=" + 任务错误)
          FBro任务_释放(PDF任务ID)
          PDF任务ID = 0
      如果结束
  结束

  事件 _打印按钮_被单击()
      // 打开系统原生打印流程；录制时不要把个人打印机名称和文件名入镜。
      局部 整数型 结果 = FBro传输_打印(浏览器1)
      控件_设置文本(状态标签, "已请求打印，返回码 " + 到文本(结果))
  结束

  事件 _对话框按钮_被单击()
      // 模式 0 打开、1 多选、2 文件夹、3 保存。
      局部 长整数型 任务 = FBro传输_异步打开文件对话框(浏览器1, 3, "保存演示产物", "演示输出/", "[]")
      控件_添加项目(传输日志, "文件对话框任务 ID " + 到文本(任务))
  结束

  事件 _清理按钮_被单击()
      文件_删除("演示输出/页面截图.png")
      文件_删除("演示输出/页面导出.pdf")
      目录_删除空目录("演示输出")
      控件_设置文本(状态标签, "已清理本集演示产物。")
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { urlVar: '本地测试页', navigate: false })}

  // 边界：只下载公开测试文件，不导出站点数据、不保存含个人信息的页面。
结束类

// 本集口播命令：FBro传输_开始下载、FBro_截图到文件、FBro传输_异步生成PDF、FBro传输_打印、FBro传输_异步打开文件对话框、FBro任务_等待、FBro任务_取结果、FBro任务_释放
`
};

// ============================================================ 11
const ep11 = {
  dir: '11 综合项目',
  id: 'fbro-ep11-workbench',
  name: 'FBro 多工作区浏览器工具',
  className: 'FBro综合工作台窗体',
  pkg: 'FBro教程第11集',
  title: 'FBro 多工作区浏览器工具',
  size: [1360, 860],
  desc: '收官项目：串起实例管理、会话隔离、事件日志、资源响应摘要、CDP 自动化与下载反馈。',
  modules: [
    'lingbuilder.win32.basic', 'lingbuilder.win32.common-controls', 'lingbuilder.fbro.browser',
    'lingbuilder.fbro.events', 'lingbuilder.fbro.session', 'lingbuilder.fbro.transfer',
    'lingbuilder.cdp.client', 'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.std.text'
  ],
  assets: PAGE_FILES,
  controls: [
    label('lb-list', '列表说明', '工作区实例', 16, 12, 200),
    listbox('instance-list', '实例列表', 16, 36, 200, 400),
    button('btn-add', '新增按钮', '新增工作区', 16, 444, 200),
    button('btn-switch', '切换按钮', '切换到第一个', 16, 480, 200),
    button('btn-clean', '清理按钮', '清理当前缓存', 16, 516, 200),
    label('lb-addr', '地址说明', '当前地址', 232, 12, 100),
    textbox('address-box', '地址栏', '', 232, 36, 800, 26),
    button('btn-go', '转到按钮', '转到', 1042, 34, 80, 28),
    tabs('page-tabs', '页面选项卡', 232, 72, 500, 364),
    fbro('browser-1', '浏览器1', 744, 72, 596, 364, { url: 'about:blank', cacheDir: '.fbro/ep11-auto', processMode: 'independent-embedded', enableDevTools: true }),
    button('btn-open', '打开测试页按钮', '打开测试页', 1132, 34, 100, 28),
    button('btn-cdp', 'CDP按钮', '连接 CDP 并取标题', 1132, 444, 200),
    button('btn-click', '点击按钮', 'CDP 点击测试按钮', 232, 444, 200),
    button('btn-download', '下载按钮', '下载测试文件', 442, 444, 200),
    button('btn-clearlog', '清空日志按钮', '清空日志', 652, 444, 150),
    label('download-detail', '下载详情', '下载详情：暂无', 232, 484, 1100),
    progress('download-progress', '下载进度', 232, 510, 1100),
    listbox('work-log', '工作日志', 16, 552, 1324, 250),
    label('status-label', '状态标签', '日志只记录事件名、地址摘要与处理结果，不记录站点数据或凭据。', 16, 810, 1324, 24)
  ],
  code: (m) => `包 FBro教程第11集
${uses(m)}

类 FBro综合工作台窗体 : 窗口
私有
  CDP连接 连接句柄 = 0
  CDP页面 页面句柄 = 0
  整数型 资源计数 = 0
  文本型 测试页地址 = ""

公开
  构造()
  结束

  事件 _FBro综合工作台窗体_创建完毕()
      浏览器管理器_初始化(页面选项卡, 实例列表, "fbro-ep11-workbench")
      浏览器管理器_绑定地址栏(地址栏)
      浏览器管理器_绑定下载视图(下载详情, 下载进度)
      准备测试页()
      浏览器管理器_导航(测试页地址)
      FBro_绑定事件(浏览器1, "导航请求前", &处理导航请求前)
      FBro_绑定事件(浏览器1, "新窗口打开前", &处理新窗口)
      FBro_绑定事件(浏览器1, "资源响应到达", &处理资源响应)
      FBro_绑定事件(浏览器1, "加载完成", &处理加载完成)
      局部 文本型 实例总数 = 到文本(浏览器管理器_取实例数量())
      控件_添加项目(工作日志, "管理器已初始化，实例数：" + 实例总数)
  结束

  事件 _打开测试页按钮_被单击()
      FBro_导航(浏览器1, 测试页地址)
      控件_添加项目(工作日志, "已导航到本地测试页：" + 测试页地址)
  结束

  事件 _新增按钮_被单击()
      浏览器管理器_新增实例("工作区 " + 到文本(浏览器管理器_取实例数量() + 1), 测试页地址)
      局部 文本型 实例数 = 到文本(浏览器管理器_取实例数量())
      控件_添加项目(工作日志, "已新增工作区，共 " + 实例数 + " 个（各自独立 Profile）")
  结束

  事件 _切换按钮_被单击()
      浏览器管理器_切换索引(0)
      控件_添加项目(工作日志, "当前工作区：" + 浏览器管理器_取当前名称())
  结束

  事件 _转到按钮_被单击()
      浏览器管理器_导航(控件_取文本(地址栏))
      控件_添加项目(工作日志, "已请求导航：" + 控件_取文本(地址栏))
  结束

  事件 _清理按钮_被单击()
      浏览器管理器_清理当前缓存(假)
      控件_添加项目(工作日志, "已清理当前工作区缓存（不含站点数据）。")
  结束

  事件 处理导航请求前()
      控件_添加项目(工作日志, "事件 导航请求前　框架=" + FBro_取事件字段(浏览器1, "frame"))
      FBro_设置事件结果(浏览器1, 1)
  结束

  事件 处理新窗口()
      控件_添加项目(工作日志, "事件 新窗口打开前　地址=" + FBro_取事件字段(浏览器1, "url") + "（已取消）")
      FBro_设置事件结果(浏览器1, 2)
  结束

  事件 处理资源响应()
      资源计数 = 资源计数 + 1
      局部 文本型 计数文本 = 到文本(资源计数)
      控件_设置文本(状态标签, "资源响应累计 " + 计数文本 + " 条；当前公开字段只有 browser/frame/request/response。")
      FBro_设置事件结果(浏览器1, 1)
  结束

  事件 处理加载完成()
      控件_添加项目(工作日志, "事件 加载完成　地址=" + FBro_取地址(浏览器1))
  结束

  事件 _CDP按钮_被单击()
      局部 整数型 端口 = FBro_取调试端口(浏览器1)
      如果 (端口 == 0)
          控件_添加项目(工作日志, "调试端口为 0：确认浏览器1 为独立进程嵌入且已启用开发者工具。")
          返回
      如果结束
      连接句柄 = CDP_连接("http://127.0.0.1:" + 到文本(端口), &连接就绪)
      控件_添加项目(工作日志, "已发起 CDP 连接（本机回环）。")
  结束

  空 连接就绪()
      如果 (CDP_取当前事件类型() == "已就绪")
          页面句柄 = CDP_附加页面(连接句柄, "about:blank", &页面就绪)
      否则
          控件_添加项目(工作日志, 到文本("CDP 连接失败：") + CDP_取当前错误())
      如果结束
  结束

  空 页面就绪()
      如果 (CDP_取当前事件类型() == "页面就绪")
          CDP_打开网址(页面句柄, 测试页地址, &测试页加载完成)
      否则
          控件_添加项目(工作日志, 到文本("CDP 页面附加失败：") + CDP_取当前错误())
      如果结束
  结束

  空 测试页加载完成()
      如果 (CDP_取当前事件类型() == "加载完成")
          控件_添加项目(工作日志, 到文本("CDP 已加载测试页：") + CDP_取页面网址(页面句柄))
          CDP_取页面标题(页面句柄, &标题完成)
      否则
          控件_添加项目(工作日志, 到文本("CDP 加载测试页失败：") + CDP_取当前错误())
      如果结束
  结束

  空 标题完成()
      控件_添加项目(工作日志, 到文本("CDP 页面标题：") + CDP_取当前事件文本())
  结束

  事件 _点击按钮_被单击()
      如果 (页面句柄 == 0)
          控件_添加项目(工作日志, "请先点「连接 CDP 并取标题」。")
          返回
      如果结束
      局部 CDP元素 目标元素 = CDP_查询元素(页面句柄, "#demo-button")
      CDP_点击元素(目标元素, &点击完成)
  结束

  空 点击完成()
      控件_添加项目(工作日志, 到文本("CDP 点击完成，事件类型：") + CDP_取当前事件类型())
  结束

  事件 _下载按钮_被单击()
      局部 整数型 结果 = FBro传输_开始下载(浏览器1, "https://www.baidu.com")
      局部 文本型 返回码 = 到文本(结果)
      控件_添加项目(工作日志, "已请求下载，返回码 " + 返回码 + "；下载视图会显示当前实例进度。")
  结束

  事件 _清空日志按钮_被单击()
      控件_清空项目(工作日志)
  结束

${pagePrepMethod('准备测试页', '演示页面', PAGE_FILES, '浏览器1', { urlVar: '测试页地址', navigate: false })}

  // 收官边界：日志、画面与产物一律不含 Permit、Key、真实账号、站点数据或代理密码。
结束类

// 本集口播命令：浏览器管理器_初始化/绑定地址栏/绑定下载视图/新增实例/切换索引/导航/清理当前缓存、
// FBro_绑定事件、FBro_取事件字段、FBro_设置事件结果、FBro_取调试端口、CDP_连接、CDP_附加页面、
// CDP_取页面标题、CDP_查询元素、CDP_点击元素、FBro传输_开始下载
`
};

export const EPISODES = [ep01, ep02, ep03, ep04, ep05, ep06, ep07, ep08, ep09, ep10, ep11];

// ============================================================ 写盘

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

export function emit(ep) {
  const base = path.join(ROOT, ep.dir, '示例项目', ep.id);
  const modules = ep.modules.concat(ep.extraModules || []);
  const pinned = {};
  for (const id of modules) pinned[id] = MODULE_NAMES[id][1];

  const window = {
    id: 'main-window',
    fileName: `${ep.className}.xml`,
    className: ep.className,
    title: ep.title,
    width: ep.size[0],
    height: ep.size[1],
    background: '#111827',
    description: ep.desc,
    events: { Loaded: `_${ep.className}_创建完毕` },
    controls: ep.controls
  };

  writeJson(path.join(base, '.lingbuilder/solution.json'), {
    schemaVersion: 2,
    id: `${ep.id}-solution`,
    name: ep.name,
    startupProjectId: ep.id,
    startupProjectIds: [ep.id],
    folders: [],
    projects: [{
      type: 'visual-cpp', id: ep.id, name: ep.name,
      sourceRoot: 'src', configRoot: 'config',
      designerPath: '.lingbuilder/window-designer.json',
      isDefault: true, references: []
    }]
  });
  writeJson(path.join(base, '.lingbuilder/build-configuration.json'), { schemaVersion: 1, mode: 'Release', architecture: 'x64' });
  const moduleManifest = { schemaVersion: 1, enabledModuleIds: modules, pinnedVersions: pinned };
  writeJson(path.join(base, '.lingbuilder/project-modules.json'), moduleManifest);
  writeJson(path.join(base, `.lingbuilder/projects/${ep.id}/project-modules.json`), moduleManifest);
  writeJson(path.join(base, '.lingbuilder/window-designer.json'), {
    schemaVersion: 2, id: ep.id, name: ep.name, resources: [],
    windows: [Object.assign({ designerBackend: 'win32' }, window)]
  });
  writeText(path.join(base, `config/${ep.id}/config.ini`), `[${ep.id}]\nname=${ep.name}\n`);
  writeText(path.join(base, `src/${ep.className}.lcpp`), ep.code(modules));
  if (ep.globals) writeText(path.join(base, 'src/项目全局变量.lcpp'), ep.globals.join('\n') + '\n');
  for (const [name, content] of ep.assets || []) writeText(path.join(base, 'assets', name), content);
  writeJson(path.join(base, 'build-request.json'), {
    project: { schemaVersion: 2, id: ep.id, name: ep.name, windows: [window] },
    lingCppSourceFilePath: `src/${ep.className}.lcpp`,
    run: false,
    approved: true
  });
  return base;
}

