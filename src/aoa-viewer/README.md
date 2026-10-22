# AOA 多机投屏群控 MirrorDesk（LingBuilder 示例工程 v3）

PC 端同时投屏多台安卓手机并群控：4 个槽位各自显示一台手机的实时画面，
在画面上**单击=真实点击、按住拖动=真实滑动**（经 `lingbuilder.aoahid` 注入
硬件级触摸），工具条提供主页/返回/唤醒/下拉通知栏/截图。

v3 架构（2026-10-21）：**MirrorDesk WebUI**——主界面由 EdgeView（WebView2）承载
`mirrordesk.html` 设备墙，帧管线不变（USB 直传优先 / Wi-Fi WS 降级）。页面按 `file://`
直载（exe 同目录优先、源码根兜底；帧图用 exe 目录绝对基址，原生经消息桥推送 frameBase），
状态经 WebView2 消息桥推送（泵常驻，约 0.5 秒一拍），输入经网页消息桥回到 `.lcpp`。
v3 早期的 http.server 页面服务已整体移除（动态路由与 WebView 轮询在 UI 线程互堵）。
原 Win32 控件保留但隐藏（备用形态，`window-designer.json` 里 `visibility: Hidden`）。

## 投屏自动发现（2026-10-22，零手抄地址）

手机伴侣 **v1.3.0+** 点「开始投屏」后每 3 秒向局域网广播连接串（UDP 51750 信标），
本查看器自动发现并接入空闲槽位；点「停止投屏」或 app 被杀（10 秒心跳超时）槽位自动退回。
**首次使用放行一次防火墙**（管理员 PowerShell）：

```powershell
netsh advfirewall firewall add rule name="LingBuilder MirrorDesk Beacon" dir=in action=allow protocol=UDP localport=51750
```

- 信标监听为 @-inline 非阻塞 recvfrom（泵常驻顺带消化，不自建线程不阻塞 UI）。
- 同一手机不会重复占槽（手动连接也登记）；「全部断开」会挂起自动接入，点任一「接收」恢复。
- 画面防闪烁：磁贴 DOM 持久化 + 双 `<img>` 叠加换帧 + 帧文件按原生双缓冲翻转位读取（flip），
  不再读「正在被覆写」的半张 JPEG；帧图用 exe 目录绝对基址（bin 会被构建清空，页面常驻源码根）。
- **投屏通道定案（2026-10-22）**：视频全部走 Wi-Fi；USB 只用于点击/控制（AOA HID）。
  伴侣 v1.3.2 起投屏会话不再接管 USB 数据通道；「自动分配接收」按钮保留为 USB 视频后备入口。
  PC 端对反复连不上的信标地址做指数退避（20s 起步封顶 5 分钟），收到该设备数据或下线信标即清零。

## 前置

1. 手机安装 **LingBuilder 投屏伴侣 v1.3.0+**（`companion/lingbuilder-companion-v1.3.0.apk`）。
   v1.2.6 起投屏会话运行中由前台服务**优先接管 USB 配件通道**（视频走 LBAC 通道 1、
   指令回执走通道 2），不再被主界面轻量通道抢占。
2. 手机 USB 保持配件模式（首次由 AOA_打开设备 自动切换；WinUSB 驱动一次性安装，
   见 `electron/native/aoahid/driver/`）。
3. 顶部「连接串输入」填任一手机的 Wi-Fi 推流串（`ws://手机IP:8788/stream?token=配对码`），
   仅作 USB 不可用时的降级显示通道；「序列号输入」留空即自动分配（也可手填强制指定槽 1）。

## 使用（MirrorDesk WebUI）

1. 启动后自动：`http.server` 监听 `127.0.0.1:8899`（页面 `/`、状态 `/api/status`、
   帧图片 `/frame/1~4`，全部 no-store），EdgeView 自动导航加载。
2. 顶栏「**自动分配接收**」= 按槽位序号给 1~4 槽发起 USB 优先接收
   （`AOA_取设备列表` 解析第 N 台「配件模式+可打开」手机；序列号与产品名双空的
   配件机——如鸿蒙配件会话——走模块「唯一空序列号兜底」，直接传空串打开）。
3. 磁贴工具条：接收（USB 优先）/ 接通触控 / 唤醒 / 主页 / 返回 / 下拉通知栏 /
   截图（存 exe 同目录 `截图_槽N_序号.jpg`）；旋转/音量/录制/键盘为下一版占位。
4. **磁贴画面手势**：单击=点击（按下+抬起即一次 tap），按住拖动=滑动翻页；
   坐标按磁贴显示区归一化为 0~32767 逻辑坐标后走原生手势三段
   （`AOA_手指按下/移动/抬起`，移动按曼哈顿距离 ≥500 节流）。
5. 顶栏连接串输入框填 Wi-Fi 推流串回车 = 对第一个未连接槽位发起 WS 降级连接。
6. 原 Win32 按钮（N 接收/N 触控/全部断开等）保留为隐藏控件，事件处理器仍在，
   可在设计器里把 `visibility` 改回 `Visible` 切换备用形态。

## 关键实现（WebUI 链）

- 帧管线不变：15ms 泵双缓冲落盘 `aoa_sN_0/1.jpg`，HTTP `/frame/N` 动态路由读
  「最新完整帧」文件发送（选择逻辑与显示一致：`用甲帧N`）。
- **EdgeView 网页消息是信封格式**：`{"source":…,"message":"<转义JSON>","additionalObjectHandles":…}`，
  消息体需两层解析（`JSON_取文本(消息,"message")` 后再取字段）——实锤于 2026-10-21。
- 输入桥动作集：`down/move/up/home/wake/back/notif/shot/receive/touch/connectUrl/disconnectAll`；
  `receive/touch` 由窗口事件分发到 `_开始接收N主体/_连接设备N主体`（窗口类内互调，
  不能放功能库——库无法引用窗口事件处理器）。
- 页面文件双探测：exe 运行目录 `mirrordesk.html` 优先，缺失回落源码根绝对路径
  （`群控库.取页面路径`）；分发时把 HTML 与 exe 放同一目录。

## 关键实现（触控与槽位）

- 带参方法全部在 `功能/群控库.lcpp`（窗口事件不支持参数，生成器会丢参）。
- **生成器提升陷阱红线**：带初始化的局部变量声明会被生成器整体提升到函数最前——
  初始化式依赖后续 if 链赋值的变量必须「声明=字面量初值、赋值按执行序」，
  否则恒除零（本次 cdb 实锤：按帧重排槽画面 +0x9092f、处理槽点击两处）。
- **拖动手势三段（2026-10-21）**：生成器运行时模板已给全部子类化控件补
  MouseMove/MouseUp 派发（公共子类分支 + DateTimePicker/TabControl/ListBox 特化分支），
  绑定了鼠标事件的非 BUTTON 控件按下时 `SetCapture`，拖出控件仍持续收到消息；
  Win32 画面（备用形态）绑定 `MouseDown/MouseMove/MouseUp` 三段（处理器内取鼠标位置换算），
  手势期间到达的 `Click`（STN_CLICKED 在 MouseUp 派发前到）一律吞掉，防止双击。
- 轮询泵在界面线程 15ms 一拍；`AOA_数据通道收帧` 超时**不能传 0**（libusb 0=永久等待），
  用 1ms；帧判别按首字节：255=JPEG 视频（>1KB 才收），否则=控制 JSON（env 心跳/
  指令回执，UTF-8 经 std.buffer 解码）。
- 环境帧（width/height/rotation）到达即 `按帧重排槽画面`：控件等比缩放居中，
  并回写全局矩形（点击换算的唯一矩形来源；窗口无边框，`窗口_取边界JSON`=客户区物理像素）。
- USB 通道建立后手机侧 fd 翻新（轻量↔服务交替、App 重建）由模块的 clear_halt 自愈兜底。

## 红线 / 已知行为

- MIUI 会拦截外接 USB 输入：通知栏出现「已拦截 USB 输入设备」需点允许
  （可用「点状态N」手势拉下通知栏）。MIUI 还会杀后台应用——投屏伴侣被杀后投屏即断，
  需在手机上重新打开并「开始投屏」（建议加入后台白名单并锁定任务卡片）。
- 免 ADB/免 root：全链路（投屏/点击/指令）不依赖 adb。
- 首次点击可能被 Android 输入设备挂载竞态吃掉，连点两次即可。
- 手机亮屏但长时间无操作时 MIUI 冻结后台服务属系统行为；投屏中尽量让伴侣留在前台，
  或后台白名单。

## 模块依赖

`lingbuilder.win32.basic`、`lingbuilder.aoahid`、`lingbuilder.websocket.client`、
`lingbuilder.fs.core`、`lingbuilder.win32.window-utils`、`lingbuilder.win32.monitor`、
`lingbuilder.data.json`、`lingbuilder.image.core`、`lingbuilder.std.buffer`、
`lingbuilder.std.text`、`lingbuilder.std.array`、`lingbuilder.std.bytes`、
`lingbuilder.edgeview`（EdgeBrowser 控件 + 导航 + 网页消息）、
`lingbuilder.http.server`（本机帧服务）

## 坐标回映射与找图点击演示（2026-10-22，需伴侣 v1.4.0+）

识图/找色得到的是 **JPEG 帧内坐标**，AOA HID 点击要 **手机真实坐标**，中间换算由伴侣
v1.4.0 的 `queryScreen` 协议 + 本工程 `功能/坐标映射.lcpp` 承担（协议字段与换算公式全文见
`companion/aoa-companion/README.md`「1.4.0 新增」节）。公式：

```
手机坐标 = 帧坐标 × realWidth/frameWidth        （伴侣 screenInfo 提供两组尺寸）
AOA HID 逻辑坐标（0~32767） = 手机坐标 × 32767 / realWidth|realHeight
```

- `坐标映射.屏幕_请求信息(槽)` 发 `{"cmd":"queryScreen"}`；应答 `screenInfo` 与旋转/档位
  变更广播 `screenChanged` 由 WS 文本处理器（`收到消息1..4`）和 USB 控制通道
  （`群控库.处理槽控制JSON`）双路认领刷新缓存；未校准时换算一律返回 -1。
- **找图点击演示**（最小闭环，非自动化框架）：磁贴工具条「🔍」按钮（`data-act=findClick`）
  或原生备用按钮「找图点击」（槽1）→ 发 queryScreen → 泵等校准（2 秒超时取消，
  伴侣 <v1.4.0 不回包）→ 从最新帧裁中上部小块当模板（演示自截自配；实战换事先截好的
  目标小图字节集）→ `识图_模板匹配字节集` 命中 → 坐标映射两步换算 → `群控库.注入槽点击`
  真实点击。帧坐标/手机坐标三元组写入 `viewer.log`（`找图演示` 行）。
- 识图命令来自 `lingbuilder.image.recognition`（已在项目模块清单启用）；模板/帧字节集
  读取用 `群控库.读文件字节集`（fs.core 句柄式读入）。

## 本工程直连构建（安装版 MCP 桥模块快照过期的绕行）

安装版 LingBuilder（0.8.30）内置模块注册表不认识 websocket.client 2.1.0 的
`WS_发送文本到连接异步`，MCP `build_run` 会在命令解析层阻断。绕行配方（工作区源码直连生成
+ msbuild 增量，产物布局与 build_run 一致）：

```bash
cd electron && npx tsx scripts/direct-build-aoa-viewer.ts
# 产物：.lingbuilder-build/aoa-viewer/x64/Debug/bin/aoa-viewer.exe（exe 旁 mirrordesk.html 已同步）
```

注意：bin 里的旧 `LingBuilderPreview.exe` 是历史构建残留（同名劫持坑，见记忆），
新版可执行文件名是 `aoa-viewer.exe`。
