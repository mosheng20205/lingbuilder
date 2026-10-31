# LingBuilder 投屏伴侣（AOA 配套 APK）

> **本文档只讲 APK 工程。** 全链部署、故障排查手册、USB 群控方案（§8）都在
> **[`src/aoa-viewer/开发者使用说明.md`](../../src/aoa-viewer/开发者使用说明.md)**
> （PC 查看器工程目录，随分享包分发）——两份文档互相引用，各管一半。

安卓侧伴生应用：把手机屏幕实时推流给电脑上的 LingBuilder「AOA 可视点击器」示例工程，
配合 `lingbuilder.aoahid` 模块实现「看得见、点得准」的电脑操作手机体验。

- **产物**：`lingbuilder-companion-v1.4.7.apk`（仓库根 `companion/` 目录按版本归档）
- **系统要求**：Android 8.0（API 26）及以上；MIUI/EMUI 等 ROM 需允许后台运行
- **零第三方 SDK**：WebSocket 服务端为本仓库手写 RFC 6455 实现（`WsServer.kt`），
  无广告、无统计、无网络出站（只在本机 8788 端口等服务）
- **当前形态（v1.4.7）**：**USB 直传专用**——投屏/截图/指令/触控配套全部走 USB 数据通道，
  手机**不需要连接 Wi-Fi**；v1.4.7 起支持「USB 控制模式」（不推流，仅按需截图），
  找图群控完全不依赖投屏画面流。历史 Wi-Fi 信标/推流链路保留但已非主路径。

## 1.4.2 ~ 1.4.7：USB 直传自动接通 + 纯 USB 形态闭环（2026-10-23 ~ 10-31）

v1.3.2 把投屏定案为「全走 Wi-Fi」，与 PC 端后来的纯 USB 形态冲突（帧全涌向无客户端的
WS = 黑屏）。v1.4.2 起逐步把 USB 直传恢复为主路径并补齐全套控制指令：

| 版本 | 内容 |
| --- | --- |
| **1.4.2** | `maybeAutoOpenUsbDirect()`：投屏会话运行 + 配件在位 → **自动接通 USB 直传**（触发点 = 配件 ATTACHED 广播 + startStream 尾部；auto 失败静默留痕防 toast 风暴，手动按钮保留）。恢复被 1.3.2 停用的 USB 推帧，`tryOpenUsbChannel` 保持 no-op |
| **1.4.3** | 前台让位：主界面轻量通道在投屏运行时由 statusPoller 自动 close（只挡新开不关已开是半个修复——服务 USB 直传会被前台 fd 锁死）+ `ACTION_AUTO_USB` 触发重试；`usbDirectError` 上「USB 直传」按钮文案（失败原因可见化） |
| **1.4.4** | 清单增补 `<queries>`（MAIN+LAUNCHER）：修复 **Android 11+ 包可见性过滤**导致 `launchApp` 对第三方应用恒报「未安装或无启动入口」（设置等系统白名单应用不受影响——这是判别指纹） |
| **1.4.5** | `setClipboard` 指令：主线程 ClipboardManager 写入，中文输入两步路径的第一步（PC 注入 Ctrl+V 完成粘贴） |
| **1.4.6** | `listApps` 指令：`queryIntentActivities` 枚举有 LAUNCHER 入口的已装应用（排除自身），PC「启动App」变下拉选择 |
| **1.4.7** | **`screenshot` 按需截图指令**（`lastJpeg` 帧缓存经数据通道单发一帧）+ **USB 控制模式**（`EXTRA_ON_DEMAND`：投屏授权照走但不建 WS 不启信标不推帧，仅保持 USB 通道 + 帧缓存）——找图群控**完全不依赖投屏画面流** |

**两种工作模式（按场景选）**：

| 模式 | 入口 | PC 端磁贴画面 | 适合场景 |
| --- | --- | --- | --- |
| **推流模式** | 「开始投屏」按钮 | 实时画面 | 要在 PC 上**看着画面**手动操作、验收触控效果 |
| **控制模式** | 「USB 控制模式（不推流 · 按需截图 · 找图群控）」按钮 | **无实时画面**（显示「未推流」，这是正常状态） | 只跑**批量自动化**（找图点击、启动App、录制回放广播），省电省带宽，多台长时间挂机 |

控制模式操作步骤：

1. 伴侣主界面点「USB 控制模式（不推流 · 按需截图 · 找图群控）」。
2. 系统弹投屏授权 → 点「立即开始」。**每次点这个按钮都要授权一次**（Android 对投屏类
   授权不允许永久记忆，系统限制，无法绕过）。
3. 完成。之后触控、指令、批量找图全部照常工作——PC 端批量找图时会自动向每台手机
   取一帧当前画面（内部自动完成，无需任何手动操作），只是磁贴上没有持续滚动的画面。

一句话选择：**要看画面用「开始投屏」，只跑批量任务用「USB 控制模式」**。

**新增指令协议**（控制通道 JSON，回执统一 `{"type":"result","cmd":..,"ok":..[,"error":..]}`）：

```json
{"cmd":"setClipboard","text":"任意中文"}      // 写系统剪贴板
{"cmd":"listApps"}                           // → {"type":"appList","apps":[{"pkg":"..","label":".."}..]}
{"cmd":"screenshot"}                         // 经数据通道单发一帧 JPEG（lastJpeg）
```



## 1.4.0 新增：queryScreen 坐标回映射协议

为「识图/找色得到帧内坐标 → AOA HID 点击要手机真实坐标」补上换算约定。纯读协议，
只走已握手连接（WS `/stream` 或 USB 数据通道均可发，回执双路广播），不动鉴权、不触发虚拟屏重建。

**请求**（JSON 文本，`id` 可选、建议携带以便认领异步回包）：

```json
{"cmd":"queryScreen","id":"任意回显标识"}
```

**应答**（文本消息，回执经 replyControl 广播给全部已握手客户端，一机一查看器场景按 `id`/来源连接认领）：

```json
{"type":"screenInfo","id":"原样回显","realWidth":1080,"realHeight":2340,
 "frameWidth":540,"frameHeight":1170,"scale":0.5,"orientation":0,"quality":70}
```

| 字段 | 含义 |
| --- | --- |
| `realWidth` / `realHeight` | **当前方向**真实显示分辨率（`getRealMetrics` 已按旋转互换宽高，与推流帧同方向） |
| `frameWidth` / `frameHeight` | 当前推流帧尺寸（源尺寸 × scale 档位） |
| `scale` | 当前缩放档位（0.25~1.0） |
| `orientation` | 旋转角 0/90/180/270（与 env 心跳 `rotation` 同口径） |
| `quality` | 当前 JPEG 编码质量（40~90） |

**变更事件**：手机旋转或 `setScale` 改档位导致虚拟屏重建后，向所有客户端广播
`{"type":"screenChanged",...字段同 screenInfo 但无 id}`，客户端据此就地刷新缓存；
请求不带 `id` 时应答也省略该字段。旧客户端（v1.3.x）收到 `screenInfo`/`screenChanged`
按未知文本忽略即可（它们只解析 env 心跳的 `width/height/rotation` 键，两消息无这些键，天然无害）。

**坐标换算公式**（推流按档位等比缩放，两轴同比例）：

```
手机横坐标 = 帧横坐标 × realWidth  / frameWidth
手机纵坐标 = 帧纵坐标 × realHeight / frameHeight
AOA HID 逻辑坐标（0~32767） = 手机坐标 × 32767 / realWidth|realHeight
```

PC 侧参考实现：`src/aoa-viewer/功能/坐标映射.lcpp`（缓存 + 换算 + 未校准返回 -1）；
协议探针：`.zcode/tmp/queryscreen-probe.js`（听信标 → 连 WS → 发 queryScreen → 断言应答）。
红线：本批不做 `setScale` 远程改档位之外的任何重建触发；「锁定 scale=1.0 拍坐标」留待二期评估。

## 1.3.2 定案：投屏全部走 Wi-Fi，USB 只留点击/控制

- 投屏会话**不再自动接管 USB 数据通道**（v1.2.6 引入的「USB 优先」停用）：WS 服务全程保持，
  视频与控制指令稳定走 Wi-Fi；USB 硬件只服务于 PC 侧 AOA HID 点击/控制（不经 app 代码）。
- 广播循环自 1.3.1 起从 Handler.postDelayed 自链改为单工作线程 while+sleep
  （个别 ROM 上 Handler 链会静默断链，信标停发而会话仍活着）。
- 遗留说明：1.2.6~1.3.1 装机会出现「信标广播死地址」（USB 接管停了 WS），PC 端以指数退避兜底；
  升到 1.3.2 后该现象消失。

## 1.3.0 新增：投屏自动发现信标（免手抄地址）

- 点「开始投屏」后，投屏会话运行期间每 3 秒向局域网广播本机连接串
  （UDP **51750**，受限广播 255.255.255.255 + 本机 /24 定向广播双发防 AP 隔离），
  PC 端 MirrorDesk 查看器自动发现设备并分配空闲槽位连接，**不再需要人工抄写
  `ws://IP:端口/stream?token=配对码`**。
- 点「停止投屏」先发 `{"offline":1}` 下线信标再停服务，PC 端立即退回槽位；
  进程被系统杀死时无下线包，由 PC 端 10 秒心跳超时兜底。
- 信标明文含配对码（与主界面 openly 展示配对码同一威胁模型），仅限可信局域网使用。
- 端口仍由设置项决定（信标里带完整 ws 地址），PC 端不假设端口。
- 实现见 `BeaconBroadcaster.kt`（单 HandlerThread 派发，UDP 发送不占主线程）。

## 1.1.0 新增：USB 数据通道（免 Wi-Fi）

- 注册 `usb.accessory` 伴生应用（识别串 `LingBuilder` / `AOACompanion` / `1.0`，
  与 `lingbuilder.aoahid` 1.1.0 模块发送的 AOAv2 识别串一字不差），配件插入自动拉起。
- 电脑侧 `AOA_打开数据通道` 后，视频帧改走 **USB bulk**（LBAC 帧，通道 1），
  电脑控制指令（setScale/setQuality/stop/ping）从 bulk 读入（通道 2），**不依赖 Wi-Fi**。
- 优先级：USB 数据通道活跃时自动停用 WebSocket 推流；拔出配件自动切回 Wi-Fi 推流。
- HID 触摸注入走控制传输，与 USB 数据通道**天然并行**，互不干扰。
- 电脑侧需给配件接口装 WinUSB 驱动（装过 ADB 驱动的机器多数开箱即用，详见模块红线文档）。

## 安装

1. 把 `lingbuilder-companion-v1.4.7.apk` 复制到手机安装（需允许「安装未知来源应用」；同签名覆盖升级）。
2. USB 数据线连接电脑即可——**不需要 Wi-Fi**（历史 WS 推流链路保留作备用，纯 USB 形态用不到）。

## 使用流程

1. 打开 App，主屏显示 **6 位配对码**（点击可刷新，刷新后旧码立即失效）与完整连接串
   `ws://<手机IP>:8788/stream?token=<配对码>`（可一键复制）。
2. 点「开始投屏」，系统弹窗选择「立即开始」（Android 14+ 弹窗明确标注录屏内容，
   每次会话都要确认一次，这是系统限制）。
3. 在电脑 LingBuilder「AOA 可视点击器」工程里填入连接串连接；
   1 秒内应看到手机画面。
4. 不带正确配对码的连接会被直接拒绝（HTTP 403）。

**USB 主路径（推荐，v1.4.2+）**：插上数据线后无需上述任何抄码动作——
PC 端自动打开设备（普通模式自动切配件）→ 伴侣收到配件附着事件自动接通 USB 直传 →
画面走 USB bulk。手机不连 Wi-Fi、移动数据独立照常使用。找图群控可改点
「USB 控制模式（不推流）」。

## 设置项

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| 端口 | 8788 | WebSocket 监听端口（1024~65535） |
| 缩放 | 0.5 | 推流分辨率 = 屏幕 × 缩放（0.25~1.0），越小越省流量 |
| JPEG 质量 | 70 | 40~90 |

PC 侧也可以在会话中动态下发：`{"cmd":"setScale","value":0.5}`、
`{"cmd":"setQuality","value":70}`、`{"cmd":"stop"}`。

## 协议（ws 文本帧 JSON 双向 + 二进制帧 JPEG）

手机 → PC（每秒 1 条环境心跳）：

```json
{"type":"env","rotation":0,"width":540,"height":1123,"fps":12,"foreground":"com.tencent.mm"}
```

- `rotation`：0/90/180/270，手机屏幕当前旋转角。
- `width/height`：当前推流帧尺寸（已含缩放与旋转换向），PC 端按它设置画面宽高比。
- `foreground`：前台应用包名；未授予「使用情况访问权限」时为 `null`（不影响投屏）。
- 二进制帧 = JPEG 压缩画面。

## 厂商 ROM 后台保活提示

- **MIUI**：设置 → 应用设置 → 本应用 → 省电策略 → 无限制；最近任务下拉锁定卡片。
- **EMUI/HarmonyOS**：设置 → 电池 → 启动管理 → 手动管理，允许后台运行。
- 推流依赖前台服务（通知栏有常驻通知），熄屏后系统可能暂停采集，建议保持亮屏。

## 构建与目录

- Gradle 工程：`companion/aoa-companion/`，AGP 8.5.2 / Kotlin 2.0.20 / compileSdk 34。
- 本机构建命令（JDK 17 + Android SDK）：

  ```bash
  cd companion/aoa-companion
  JAVA_HOME=T:/android-build/jdk-17.0.2 /t/android-build/gradle-8.10.2/bin/gradle assembleRelease
  # release 包已用 debug 密钥签名，可直接覆盖安装
  ```

- 版本推进点：`app/build.gradle` 的 versionCode/versionName；USB 直传行为集中在
  `StreamService.kt`（`maybeAutoOpenUsbDirect` / `openUsbDirect(auto)` / `ACTION_AUTO_USB` /
  `screenshot` / `setClipboard` / `listApps` / `EXTRA_ON_DEMAND`）。改完必须同步
  PC 端 `src/aoa-viewer/开发者使用说明.md`、`mirrordesk.html` 帮助面板与
  `src/aoa-viewer/README.md` 的版本要求（六处全链同步，缺一处就是下一次版本漂移）。

- 源码结构：
  - `WsServer.kt` — 手写 RFC 6455 服务端（握手/帧收发/掩码/心跳/关闭）+ 有界发送队列
  - `ScreenStream.kt` — MediaProjection 采集、缩放渲染、旋转重建、RGBA→JPEG、自适应 10~15fps
  - `EnvMonitor.kt` — 旋转实时监听 + UsageStats 前台应用探测 + 心跳 JSON 组装
  - `StreamService.kt` — 前台服务（mediaProjection 类型）、控制指令、状态上报
  - `MainActivity.kt` — 配对码/连接串/开始停止/设置界面
