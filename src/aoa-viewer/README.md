# AOA USB 多机投屏群控 MirrorDesk（LingBuilder 示例工程 v4 · USB 直传专用版）

PC 端通过 **USB 数据线**同时投屏多台安卓手机并群控，全程**不依赖 Wi-Fi**（手机走移动数据互不干扰）。
设备池模型：不设固定槽位上限（架构支持几百台），插线自动入池排队接通，拔线自动标离线、重插自动重接。
磁贴画面**单击=真实点击、按住拖动=真实滑动**（经 `lingbuilder.aoahid` 注入硬件级触摸），
工具条提供 接通/唤醒/主页/返回/下拉通知栏/截图/找图点击，底部提供 同步操控（群控广播）/全部唤醒/批量截图。

## v4 架构（2026-10-23 · USB 直传专用版）

- **纯 USB**：视频帧与控制指令全部走 USB 数据通道（LBAC bulk），Wi-Fi 推流、UDP 51750 信标自动发现整体移除。
- **设备池**：`项目全局变量.lcpp` 的并行数组（池设备/池序列号/池通道/池已开/池可见/池错误…）。
  槽号=本会话内首次见到该手机的顺序，拔线只标「USB 已拔出」不清条目，重插复用同一条目。
- **自动接入**：泵每约 2 秒巡检 `AOA_取设备列表`，「配件模式+可打开」与「普通模式（有序列号）」
  自动入池排队；**打开队列一次一台串行**（`AOA_打开设备` 普通模式切配件最长阻塞 45 秒，禁止并发）。
- **重试自愈**：会话判死或设备从列表消失 → 置「待重试」标志，巡检见到设备回来即自动重接；
  重试发起时消费标志，失败不会陷入重试风暴。
- **轮询预算巡游**：每拍最多排空 16 个通道、泵游标轮转。红线：手机侧发送端在 PC 停止收帧时会阻塞，
  所有已开通道必须被持续排水；`AOA_数据通道收帧` 超时禁传 0。
- **可视区节流**：页面经 IntersectionObserver 上报可视磁贴名单（`{action:'visible', list:"1,3,7"}`）；
  可视槽全帧率落盘，不可视槽 2 秒一帧（几百台规模下磁盘与轮询的降载关键）。
- **WebUI**：`mirrordesk.html` 经 `file://` 直载（EdgeView 承载，状态经 WebView2 消息桥推送约 0.5 秒一拍）；
  磁贴增量创建、仅视口内轮询帧图、双 `<img>` 叠加换帧防闪烁。
- 帧图 `aoa_d<槽号>_0/1.jpg` 按 `帧基址`（exe 目录）**绝对路径**落盘（CWD 随启动方漂移也不写散）。

## 手机侧要求

- 「LingBuilder 投屏伴侣」**v1.4.3+**：USB 直传自动接通（投屏运行+配件在位即自动切 USB bulk，
  前台轻量通道自动让位）。**旧版（≤1.4.1）没有 USB 推帧代码，画面永远走 Wi-Fi——纯 USB 形态必须 1.4.3+**。
- 免 USB 调试、免 root；数据线插上即用。多台并发建议带独立供电的 USB Hub。
- 已知机型限制：小米 8 的 MIUI 免调试拒绝 AOA 配件切换（打开报「等待配件设备重枚举超时」），
  属机型级限制，与本工程无关。

## 使用

1. IDE 打开本包，F5 构建运行（需要 MSVC；`lingbuilder.aoahid` 模块已随包捆绑，含 WinUSB 驱动引导）。
2. 手机安装投屏伴侣 v1.4.3+ → 打开 → 「开始投屏」→「立即开始」（每台一次）。
3. 数据线插上电脑：磁贴自动出现并排队接通（普通模式机型切配件需数秒），画面自动上墙。
4. 磁贴手势即真实触控；开「同步操控」后任一画面的手势广播到全部已接通手机（群控）。

## 关键实现备忘

- 带参方法全部在 `功能/群控库.lcpp`（窗口类「事件」不支持参数，生成器会丢参）；
  功能库内部互调必须带库名限定（群控库.xxx）；函数签名必须单行。
- **生成器提升陷阱红线**：带初始化的局部声明在函数入口按声明序求值——只有循环内才有值的量
  必须「先声明、循环内赋值」，否则拿到入口时的旧值。
- **EdgeView 网页消息是信封格式**：`{"source":…,"message":"<转义JSON>",…}`，消息体需
  `JSON_取文本(消息,"message")` 两层解析。
- 帧判别按首字节：255=JPEG 视频（>1KB 才收），否则=控制 JSON（env 心跳/指令回执/screenInfo，
  UTF-8 经 std.buffer 解码）；screenInfo/screenChanged 由 `功能/坐标映射.lcpp` 认领。
- 池状态一律经 `数组_取成员/数组_置成员` 访问；池查找/已尝试序列号必须大小写不敏感
  （`_wcsicmp`，MIUI/驱动层回报的序列号大小写不稳定）。

## 红线 / 已知行为

- MIUI 会拦截外接 USB 输入：通知栏出现「已拦截 USB 输入设备」需点允许
  （磁贴「通知栏」按钮可远程拉下通知栏）。MIUI 会杀后台应用——投屏伴侣被杀后投屏即断，
  需在手机上重新「开始投屏」（建议后台白名单并锁定任务卡片）。
- 免 ADB/免 root：全链路（投屏/点击/指令）不依赖 adb。
- 找图点击演示（需伴侣 v1.4.0+ 的 queryScreen）：磁贴「🔍」按钮 → queryScreen → 校准后从
  最新帧裁模板 → `识图_模板匹配字节集` → 坐标映射两步换算 → 真实点击；实战把裁模板换成
  事先截好的目标小图字节集即可复用全链。

## 目录

- `MainWindow.lcpp`：窗口事件薄壳（创建/泵/网页消息桥/找图点击演示/退出）。
- `功能/群控库.lcpp`：设备池核心（入池/打开队列/自动接入巡检/轮询巡游/存帧/手势/广播/状态 JSON）。
- `功能/坐标映射.lcpp`：queryScreen 坐标回映射（帧坐标→手机真实坐标→HID 逻辑坐标）。
- `mirrordesk.html`：MirrorDesk 设备墙（可视区虚拟化刷新、`?mock=N` 压测钩子）。

## 模块依赖

`lingbuilder.win32.basic`、`lingbuilder.aoahid`（随包捆绑）、`lingbuilder.edgeview`、
`lingbuilder.fs.core`、`lingbuilder.fs.path`、`lingbuilder.win32.window-utils`、
`lingbuilder.win32.monitor`、`lingbuilder.data.json`、`lingbuilder.image.core`、
`lingbuilder.image.recognition`、`lingbuilder.std.buffer`、`lingbuilder.std.text`、
`lingbuilder.std.array`、`lingbuilder.std.bytes`、`lingbuilder.advanced.process-memory`、
`lingbuilder.websocket.client`、`lingbuilder.http.server`
