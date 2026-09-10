# LingBuilder 模块封装清单

更新时间：2026-09-08

本清单以 `electron/src/services/modules/builtinModules.ts` 的实际注册结果为准。（门禁总表与基线写回规则见 `docs/QUALITY_GATES.md`；本清单计数行由 `tests/modules.test.ts` 的「模块封装清单覆盖实际内置模块注册表」用例按 `BUILTIN_MODULES` 实算校验。）当前共注册 **85 个内置模块、3143 条中文命令**；其中参考精易模块分类新增 **51 个模块、336 条命令**。所有新增模块均满足：

- `schemaVersion: 2`。
- `contributes.commands` 与 `bindings.commands` 一一对应。
- 按真实原生资产声明精确 target；CEF3 150 与 FBro 当前只声明已验证的 `windows-msvc-x64`。
- 只有项目明确启用模块后才进入 Monaco 补全、诊断和 C++ 生成上下文。
- C++ 运行时按启用模块注入，不依赖 React 临时逻辑。

## 标准基础库

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.std.text` | 文本处理模块 | 10 |
| 已封装 | `lingbuilder.std.array` | 数组操作模块 | 13 |
| 已封装 | `lingbuilder.std.bytes` | 字节与十六进制模块 | 13 |
| 已封装 | `lingbuilder.std.encoding` | 编码转换模块 | 30 |
| 已封装 | `lingbuilder.std.math` | 数学与随机模块 | 7 |
| 已封装 | `lingbuilder.std.datetime` | 日期时间模块 | 5 |
| 已封装 | `lingbuilder.std.regex` | 正则表达式模块 | 5 |
| 已完整封装 | `lingbuilder.data.json` | JSON 数据模块 2.0 | 55 |
| 已封装 | `lingbuilder.data.xml` | XML 文本模块 | 5 |

编码转换模块覆盖 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030 的双向转换，以及通用转换、BOM 操作和保守检测。原始字节统一以大写十六进制文本传递，避免任意二进制被误当作 Unicode 文本。

JSON 数据模块 2.0 提供受管 `JSON值`、严格 RFC 8259 解析与创建、对象/数组/标量操作、RFC 6901 Pointer、RFC 6902 Patch、RFC 7396 Merge Patch、核心 JSON Schema 校验与确定性 C++ 导出。模块不把 JSON5、JSONC、BSON、MessagePack 或 CBOR 伪装为 JSON；完整调用说明位于 `electron/docs/modules/json/README.md`。

## 文件、配置与系统

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.fs.core` | 文件目录模块 | 11 |
| 已封装 | `lingbuilder.fs.path` | 路径处理模块 | 7 |
| 已封装 | `lingbuilder.config.ini` | INI 配置模块 | 6 |
| 已封装 | `lingbuilder.config.registry` | 用户注册表模块 | 6 |
| 已封装 | `lingbuilder.system.info` | 系统信息模块 | 7 |
| 已完整封装（只读信息） | `lingbuilder.system.disk` | 磁盘信息模块 | 28 |
| 已完整封装 | `lingbuilder.system.clipboard` | 剪贴板模块 | 10 |
| 已封装 | `lingbuilder.system.shell` | 系统外壳模块 | 5 |
| 已封装 | `lingbuilder.process` | 进程管理模块 | 5 |
| 已封装 | `lingbuilder.ipc` | 进程通信模块 | 8 |
| 已封装 | `lingbuilder.archive` | ZIP 压缩模块 | 4 |

磁盘信息模块 `1.1.0` 保留原 5 条容量/卷标兼容命令，并扩展为 28 条命令和 8 个公开 `record/array` 类型。覆盖精确字节容量、用户可用/总空闲/已用容量、使用率、逻辑驱动器、全部卷、卷 GUID、挂载点、文件系统能力标志、物理磁盘描述、总线、SSD、TRIM、逻辑/物理扇区及 MBR/GPT/RAW 分区布局。模块只执行只读 Windows 查询，不提供格式化、分区修改或写盘能力。

剪贴板模块 `1.1.0` 在保留 Unicode 文本读写的基础上，新增图片字节集读写、图片格式查询和 GIF 原始字节读写，共 10 条命令。静态图片支持 DIB/DIBV5 与 BMP 文件字节；GIF 以注册的 `GIF`、标准 MIME `image/gif` 和 `HTML Format` 写入，读取时优先返回原始 GIF，确保动画帧、帧延时和循环信息不被转换丢失。单个图片或 GIF 字节集上限为 256 MB，文档位于 `electron/docs/modules/clipboard/README.md`。

WebSocket 服务端模块 `2.0.0` 已从 6 条同步单连接原型升级为 50 条受管命令。运行时使用后台非阻塞 `WSAPoll` reactor，支持多客户端、文本/二进制、分片、UTF-8 校验、Ping/Pong、关闭握手、Origin/路径/子协议、资源限制、有界发送队列、客户端状态和统计；事件通过窗口消息回到普通 Win32 或 New_Emoji UI 线程。Win32/x64 原生工程均可生成，New_Emoji x64 复用同一协议运行时；6 条旧阻塞命令仅作为 advanced 迁移入口。正式文档位于 `electron/docs/modules/websocket-server/README.md`，`smoke:websocket-server-native` 会真实编译并验证两种 UI 后端。

## 输入、窗口与桌面

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.input.keyboard` | 键盘输入模块 | 31 |
| 已封装 | `lingbuilder.input.mouse` | 鼠标输入模块 | 29 |
| 已封装 | `lingbuilder.win32.window-utils` | Win32 窗口操作模块 | 7 |
| 已封装 | `lingbuilder.win32.monitor` | 显示器与 DPI 模块 | 6 |
| 已封装 | `lingbuilder.win32.menu` | Win32 菜单模块 | 8 |
| 已封装 | `lingbuilder.win32.tray` | 托盘图标模块 | 5 |
| 已封装 | `lingbuilder.win32.accessibility` | 辅助功能模块 | 4 |

## 网络

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已完整封装 | `lingbuilder.net.http-client` | HTTP 客户端模块 2.0（受管 WinHTTP、异步回调与双 UI 后端） | 74 |
| 阶段 3 实施中 | `lingbuilder.cdp.client` | CDP 客户端模块 3.0（多连接、Target/Session、binding、Debugger、Storage 与严格证书裁决地基） | 144 |
| 已封装 | `lingbuilder.net.tcp` | TCP 通信模块 | 6 |
| 已封装 | `lingbuilder.net.udp` | UDP 通信模块 | 7 |
| 已封装 | `lingbuilder.net.dns` | DNS 与 IP 模块 | 5 |
| 已封装 | `lingbuilder.net.url` | URL 解析模块 | 6 |
| 已封装 | `lingbuilder.net.cookie` | Cookie 文本模块 | 5 |
| 已封装 | `lingbuilder.net.ftp` | FTP 客户端模块 | 7 |
| 已封装（普通 SMTP） | `lingbuilder.net.mail` | SMTP 邮件模块 | 2 |
| 已完整封装（Windows x64） | `lingbuilder.net.aria2` | Aria2 异步下载模块 | 12 |

SMTP 模块当前只支持普通 SMTP/局域网调试服务，不支持 STARTTLS。服务端要求 TLS 时会明确失败，不能用于传输真实生产凭据。

## 数据、数据库与安全

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.data.csv` | CSV 数据模块 | 5 |
| 已封装 | `lingbuilder.data.protobuf` | Protocol Buffers 模块 | 9 |
| 已封装 | `lingbuilder.crypto.hash` | 哈希摘要模块 | 15 |
| 已封装 | `lingbuilder.crypto.password` | 密码哈希与派生模块 | 9 |
| 已封装 | `lingbuilder.crypto.symmetric` | 对称加密模块 | 26 |
| 已封装 | `lingbuilder.crypto.asymmetric` | 非对称加密模块 | 27 |
| 已封装 | `lingbuilder.crypto.windows` | Windows 数据保护模块 | 4 |
| 已封装 | `lingbuilder.database.odbc` | ODBC 数据库模块 | 8 |
| 已完整封装（动态运行库） | `lingbuilder.database.sqlite` | SQLite 数据库模块 2.0 | 67 |

SQLite 模块 2.0 保留原 7 条默认连接兼容入口，并扩展为 67 条生产接口和 `SQLite连接` / `SQLite语句` 两个受管类型。能力覆盖多连接、FULLMUTEX、外键/忙等待、预编译与命名参数、NULL/整数/长整数/小数/UTF-8/BLOB、逐行读取、事务/保存点、WAL/检查点、Online Backup、完整性检查、中断、64 位状态和主/扩展/系统错误码。项目仍需提供与目标架构一致且来源、版本和 SHA-256 可审计的 `sqlite3.dll`；缺失或导出不完整时会返回中文阻断错误，不会静默假装数据库可用。正式说明位于 `electron/docs/modules/sqlite/README.md`，原生验收命令为 `npm run smoke:sqlite-native`。

通用加密模块由内置命令清单、确定性 C++ 运行时和只读 `lingbuilder.crypto.sdk` 原生资产共同组成。SDK 固定使用 Botan 3.12.0 与 BLAKE3 1.8.5，提供 Win32/x64 导入库和运行时 DLL；启用任一通用加密模块时，F5 与 Visual Studio 导出都会自动校验文件摘要、复制头文件与运行时，并要求 MSVC 和 C++20。旧式 RC2、RC4、DES、3DES、Blowfish 与 ElGamal 命令标记为高级兼容用途，新项目应优先采用 AEAD、Argon2id、RSA-OAEP/PSS、ECDSA/ECDH、SM2 或 X25519。

## 图像与媒体

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.image.core` | 图像基础模块 | 7 |
| 已封装 | `lingbuilder.image.capture` | 屏幕截图模块 | 3 |
| 已封装 | `lingbuilder.image.bitmap` | 位图像素模块 | 5 |
| 已封装 | `lingbuilder.image.icon` | 图标处理模块 | 3 |
| 已封装 | `lingbuilder.image.recognition` | 基础识图模块 | 5 |
| 已封装（OpenCV 4.14.0 x64） | `lingbuilder.opencv` | OpenCV 图像处理与单/双缺口候选模块 | 33 |
| 已封装 | `lingbuilder.media.audio` | 基础音频模块 | 5 |

基础识图使用确定性像素遍历，适合找色和小模板。它不是 OCR 或机器学习识别模块。

OpenCV 模块保留基础 GDI+ 图像模块并作为新增高级能力。公开模块只暴露受管图像/结果句柄；隐藏 `lingbuilder.opencv.sdk@4.14.0+bridge.1` 携带 x64 `/MD` Bridge、三个 OpenCV DLL、许可证和 SHA-256 清单。缺口能力仅分析用户提供或已获授权的图像并返回候选，不提供浏览器自动化、拖动或验证提交。

## 高级和高风险模块

| 状态 | 模块 ID | 名称 | 命令数 | 边界 |
|---|---|---|---:|---|
| 已封装 | `lingbuilder.advanced.memory` | 受控内存模块 | 6 | 只能访问模块登记的本进程内存块 |
| 已封装 | `lingbuilder.advanced.hook` | 键盘 Hook 模块 | 4 | 只读取低级键盘状态，不注入代码 |
| 已封装 | `lingbuilder.advanced.process-memory` | 进程内存模块 | 4 | 显式启用、显式 PID 和句柄 |
| 已封装（2.0.0 句柄制） | `lingbuilder.advanced.com` | COM 自动化模块 | 27 | 注册/免注册创建 IDispatch、OCX 窗口宿主、事件挂接映射、类型化属性与带参方法、接口信息；纯 C++ 双架构 |
| 已封装 | `lingbuilder.advanced.assembly` | CPU 指令能力模块 | 5 | 只提供 CPUID 和受控位运算，不执行机器码 |
| 已封装 | `lingbuilder.advanced.driver` | 设备驱动通信模块 | 4 | 不安装驱动、不提权，只打开显式设备路径 |

这些模块不得加入普通项目默认引用，也不得由 AI 在未说明风险时自动启用。

## 已有模块（保留并补齐双架构 target）

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已有 | `lingbuilder.win32.basic` | Win32 窗口基础模块 | 206 |
| 已有 | `lingbuilder.win32.common-controls` | Win32 高级控件模块 | 546 |
| 已有 | `lingbuilder.edgeview` | EdgeView 浏览器模块 | 271 |
| 3.0预览 | `lingbuilder.cef3.browser` | CEF3核心浏览器模块（CEF 150 x64） | 64 |
| 3.0预览 | `lingbuilder.cef3.events` | CEF3事件绑定模块 | 6 |
| 3.0预览 | `lingbuilder.cef3.objects` | CEF3受管对象、Menu、证书与导航历史模块 | 183 |
| 3.0预览 | `lingbuilder.cef3.session` | CEF3独立RequestContext、Preference与Cookie会话模块 | 19 |
| 3.0预览 | `lingbuilder.cef3.network` | CEF3实例网络配置模块 | 1 |
| 3.0预览 | `lingbuilder.cef3.transfer` | CEF3下载与打印模块 | 34 |
| 3.0预览 | `lingbuilder.cef3.automation` | CEF3异步JavaScript自动化模块 | 6 |
| 3.0预览 | `lingbuilder.cef3.devtools` | CEF3开发者工具模块 | 3 |
| 3.0预览 | `lingbuilder.cef3.views` | CEF3 Chrome Runtime视图模块 | 1 |
| 3.0预览 | `lingbuilder.cef3.platform` | CEF3版本、MIME、命令行与Chrome Variations工具模块 | 72 |
| 已封装 | `lingbuilder.fbro.browser` | FBro核心浏览器模块（CEF 135 x64/C ABI v3，兼容 v1/v2） | 50 |
| 已封装 | `lingbuilder.fbro.events` | FBro 174 槽位事件目录、同步/延迟决策与受管事件对象模块 | 12 |
| 已封装 | `lingbuilder.fbro.session` | FBro会话、Cookie 与代理认证模块 | 10 |
| 已封装 | `lingbuilder.fbro.transfer` | FBro下载、打印、PDF、文件对话框与截图模块 | 5 |
| 已封装 | `lingbuilder.fbro.automation` | FBro受管异步及 Frame 自动化模块 | 25 |
| 已封装 | `lingbuilder.fbro.objects` | FBro任务、缓冲及 Value/Dictionary/List/Stream/Image/Certificate/DragData 受管对象模块 | 132 |
| 已封装 | `lingbuilder.fbro.network` | FBro高级网络模块 | 2 |
| 已封装 | `lingbuilder.fbro.vip` | FBro VIP 指纹模块（188 项官方能力逐项公开，另保留 10 个批量入口） | 198 |
| 已封装 | `lingbuilder.new_emoji.fbro-shell` | new_emoji FBro x64 多标签浏览器外壳模块 | 50 |
| 已有 | `lingbuilder.threading` | 多线程模块 | 54 |
| 已完整封装 | `lingbuilder.websocket.client` | WebSocket 客户端模块 2.0（WinHTTP 受管多连接、wss/TLS 与自动重连） | 51 |
| 已完整封装 | `lingbuilder.http.server` | HTTP 服务端模块 2.0（受管多连接 HTTP/1.1、路由与完整请求/响应） | 48 |
| 已完整封装 | `lingbuilder.websocket.server` | WebSocket 服务端模块 2.0（RFC 6455 受管多客户端） | 50 |

除 EdgeView 原本已有 x64 target 外，其余仅声明 Win32 的内置系统模块现在会从同一份内置 manifest 自动生成等价 x64 target。外部 `.lbmod` 不使用此自动补齐规则，仍必须自行提供精确架构产物。

## 代码位置

- 模块清单：`electron/src/services/modules/standardLibraryModules.ts`、`systemLibraryModules.ts`、`networkLibraryModules.ts`、`dataMediaModules.ts`、`opencvModules.ts`、`platformAdvancedModules.ts`。
- C++ 运行时：`electron/src/services/windowDesigner/standardLibraryRuntime.ts`、`systemLibraryRuntime.ts`、`networkLibraryRuntime.ts`、`dataMediaRuntime.ts`、`opencvRuntime.ts`、`cryptoRuntime.ts`、`platformAdvancedRuntime.ts`。
- 聚合入口：`electron/src/services/modules/builtinModules.ts`。
- 生成接入：`electron/src/services/windowDesigner/lingCppWin32Project.ts`。
- 自动测试：`electron/tests/modules.test.ts`。

## 验证记录

- `cd electron && npm run lint`
- `cd electron && node --import tsx --test tests/modules.test.ts`
- 生成同时启用 57 个模块（排除需要 WebView2 SDK 发现的 EdgeView）的 Visual Studio 工程。
- Visual Studio 2022 `Release|x64` 编译通过。
- Visual Studio 2022 `Release|Win32` 编译通过。

编译验证目录为 `.lingbuilder-build/standard-library-smoke-20260723/`，属于可重新生成的构建产物。

## controlRef 封装门禁

- [ ] 每个设计器对象参数都声明为 `controlRef`，并包含 `controlKinds`、`scope`、`runtimeRepresentation`；需要限定控件类型时包含 `controlTypes`。
- [ ] `insertText`、命令示例、README、演示工程与 smoke 源码使用裸控件名，不把 controlRef 写成字符串。
- [ ] C++ Bridge 接收宽名称、稳定 ID 或原生句柄的差异由 binding/后端契约适配，不反向污染 `.lcpp` 语法。
- [ ] 模块清单通过第三方门禁，SDK 迁移配置不会把“控件名/组件名/资源名”声明为文本型。
- [ ] 运行 `npm run module:control-ref-audit`，确认全部方法和参数进入摘要；运行 `npm run module:control-ref-migrate` 后再以只读方式复核 0 个可安全迁移引用。
