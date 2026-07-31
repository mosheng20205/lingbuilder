# LingBuilder 模块封装清单

更新时间：2026-07-31

本清单以 `electron/src/services/modules/builtinModules.ts` 的实际注册结果为准。当前共注册 **79 个内置模块、1405 条中文命令**；其中参考精易模块分类新增 **51 个模块、287 条命令**。所有新增模块均满足：

- `schemaVersion: 2`。
- `contributes.commands` 与 `bindings.commands` 一一对应。
- 按真实原生资产声明精确 target；CEF3 150 与 FBro 当前只声明已验证的 `windows-msvc-x64`。
- 只有项目明确启用模块后才进入 Monaco 补全、诊断和 C++ 生成上下文。
- C++ 运行时按启用模块注入，不依赖 React 临时逻辑。

## 标准基础库

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.std.text` | 文本处理模块 | 10 |
| 已封装 | `lingbuilder.std.bytes` | 字节与十六进制模块 | 4 |
| 已封装 | `lingbuilder.std.encoding` | 编码转换模块 | 30 |
| 已封装 | `lingbuilder.std.math` | 数学与随机模块 | 7 |
| 已封装 | `lingbuilder.std.datetime` | 日期时间模块 | 5 |
| 已封装 | `lingbuilder.std.regex` | 正则表达式模块 | 5 |
| 已封装 | `lingbuilder.data.json` | JSON 数据模块 | 5 |
| 已封装 | `lingbuilder.data.xml` | XML 文本模块 | 5 |

编码转换模块覆盖 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030 的双向转换，以及通用转换、BOM 操作和保守检测。原始字节统一以大写十六进制文本传递，避免任意二进制被误当作 Unicode 文本。

## 文件、配置与系统

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.fs.core` | 文件目录模块 | 11 |
| 已封装 | `lingbuilder.fs.path` | 路径处理模块 | 7 |
| 已封装 | `lingbuilder.config.ini` | INI 配置模块 | 6 |
| 已封装 | `lingbuilder.config.registry` | 用户注册表模块 | 6 |
| 已封装 | `lingbuilder.system.info` | 系统信息模块 | 7 |
| 已封装 | `lingbuilder.system.disk` | 磁盘信息模块 | 5 |
| 已封装 | `lingbuilder.system.clipboard` | 剪贴板模块 | 4 |
| 已封装 | `lingbuilder.system.shell` | 系统外壳模块 | 5 |
| 已封装 | `lingbuilder.process` | 进程管理模块 | 5 |
| 已封装 | `lingbuilder.ipc` | 进程通信模块 | 8 |
| 已封装 | `lingbuilder.archive` | ZIP 压缩模块 | 4 |

## 输入、窗口与桌面

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.input.keyboard` | 键盘输入模块 | 5 |
| 已封装 | `lingbuilder.input.mouse` | 鼠标输入模块 | 6 |
| 已封装 | `lingbuilder.win32.window-utils` | Win32 窗口操作模块 | 7 |
| 已封装 | `lingbuilder.win32.monitor` | 显示器与 DPI 模块 | 6 |
| 已封装 | `lingbuilder.win32.menu` | Win32 菜单模块 | 8 |
| 已封装 | `lingbuilder.win32.tray` | 托盘图标模块 | 5 |
| 已封装 | `lingbuilder.win32.accessibility` | 辅助功能模块 | 4 |

## 网络

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.net.http-client` | HTTP 客户端模块 | 7 |
| 已封装 | `lingbuilder.net.tcp` | TCP 通信模块 | 6 |
| 已封装 | `lingbuilder.net.udp` | UDP 通信模块 | 7 |
| 已封装 | `lingbuilder.net.dns` | DNS 与 IP 模块 | 5 |
| 已封装 | `lingbuilder.net.url` | URL 解析模块 | 6 |
| 已封装 | `lingbuilder.net.cookie` | Cookie 文本模块 | 5 |
| 已封装 | `lingbuilder.net.ftp` | FTP 客户端模块 | 7 |
| 已封装（普通 SMTP） | `lingbuilder.net.mail` | SMTP 邮件模块 | 2 |

SMTP 模块当前只支持普通 SMTP/局域网调试服务，不支持 STARTTLS。服务端要求 TLS 时会明确失败，不能用于传输真实生产凭据。

## 数据、数据库与安全

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.data.csv` | CSV 数据模块 | 5 |
| 已封装 | `lingbuilder.crypto.hash` | 哈希摘要模块 | 15 |
| 已封装 | `lingbuilder.crypto.password` | 密码哈希与派生模块 | 9 |
| 已封装 | `lingbuilder.crypto.symmetric` | 对称加密模块 | 26 |
| 已封装 | `lingbuilder.crypto.asymmetric` | 非对称加密模块 | 27 |
| 已封装 | `lingbuilder.crypto.windows` | Windows 数据保护模块 | 4 |
| 已封装 | `lingbuilder.database.odbc` | ODBC 数据库模块 | 8 |
| 已封装（动态运行库） | `lingbuilder.database.sqlite` | SQLite 数据库桥接模块 | 7 |

SQLite 模块不会静默假装数据库可用：项目需要提供 `sqlite3.dll`，通过 `SQLite_加载运行库` 检查导出函数；缺失时返回中文错误。后续可把官方 SQLite 运行库做成独立 `.lbmod` 包。

通用加密模块由内置命令清单、确定性 C++ 运行时和只读 `lingbuilder.crypto.sdk` 原生资产共同组成。SDK 固定使用 Botan 3.12.0 与 BLAKE3 1.8.5，提供 Win32/x64 导入库和运行时 DLL；启用任一通用加密模块时，F5 与 Visual Studio 导出都会自动校验文件摘要、复制头文件与运行时，并要求 MSVC 和 C++20。旧式 RC2、RC4、DES、3DES、Blowfish 与 ElGamal 命令标记为高级兼容用途，新项目应优先采用 AEAD、Argon2id、RSA-OAEP/PSS、ECDSA/ECDH、SM2 或 X25519。

## 图像与媒体

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已封装 | `lingbuilder.image.core` | 图像基础模块 | 7 |
| 已封装 | `lingbuilder.image.capture` | 屏幕截图模块 | 3 |
| 已封装 | `lingbuilder.image.bitmap` | 位图像素模块 | 5 |
| 已封装 | `lingbuilder.image.icon` | 图标处理模块 | 3 |
| 已封装 | `lingbuilder.image.recognition` | 基础识图模块 | 5 |
| 已封装 | `lingbuilder.media.audio` | 基础音频模块 | 5 |

基础识图使用确定性像素遍历，适合找色和小模板。它不是 OCR 或机器学习识别模块。

## 高级和高风险模块

| 状态 | 模块 ID | 名称 | 命令数 | 边界 |
|---|---|---|---:|---|
| 已封装 | `lingbuilder.advanced.memory` | 受控内存模块 | 6 | 只能访问模块登记的本进程内存块 |
| 已封装 | `lingbuilder.advanced.hook` | 键盘 Hook 模块 | 4 | 只读取低级键盘状态，不注入代码 |
| 已封装 | `lingbuilder.advanced.process-memory` | 进程内存模块 | 4 | 显式启用、显式 PID 和句柄 |
| 已封装 | `lingbuilder.advanced.com` | COM 自动化模块 | 6 | 单 IDispatch 对象、文本属性、无参方法 |
| 已封装 | `lingbuilder.advanced.assembly` | CPU 指令能力模块 | 5 | 只提供 CPUID 和受控位运算，不执行机器码 |
| 已封装 | `lingbuilder.advanced.driver` | 设备驱动通信模块 | 4 | 不安装驱动、不提权，只打开显式设备路径 |

这些模块不得加入普通项目默认引用，也不得由 AI 在未说明风险时自动启用。

## 已有模块（保留并补齐双架构 target）

| 状态 | 模块 ID | 名称 | 命令数 |
|---|---|---|---:|
| 已有 | `lingbuilder.win32.basic` | Win32 窗口基础模块 | 39 |
| 已有 | `lingbuilder.win32.common-controls` | Win32 高级控件模块 | 112 |
| 已有 | `lingbuilder.edgeview` | EdgeView 浏览器模块 | 271 |
| 3.0预览 | `lingbuilder.cef3.browser` | CEF3核心浏览器模块（CEF 150 x64） | 22 |
| 3.0预览 | `lingbuilder.cef3.events` | CEF3事件绑定模块 | 6 |
| 3.0预览 | `lingbuilder.cef3.objects` | CEF3受管对象、Menu、证书与导航历史模块 | 183 |
| 3.0预览 | `lingbuilder.cef3.session` | CEF3独立RequestContext、Preference与Cookie会话模块 | 19 |
| 3.0预览 | `lingbuilder.cef3.network` | CEF3实例网络配置模块 | 1 |
| 3.0预览 | `lingbuilder.cef3.transfer` | CEF3下载与打印模块 | 2 |
| 3.0预览 | `lingbuilder.cef3.automation` | CEF3异步JavaScript自动化模块 | 1 |
| 3.0预览 | `lingbuilder.cef3.devtools` | CEF3开发者工具模块 | 3 |
| 3.0预览 | `lingbuilder.cef3.views` | CEF3 Chrome Runtime视图模块 | 1 |
| 3.0预览 | `lingbuilder.cef3.platform` | CEF3版本、MIME与Chrome Variations工具模块 | 4 |
| 已封装 | `lingbuilder.fbro.browser` | FBro核心浏览器模块（CEF 135 x64/C ABI v2，兼容 v1） | 42 |
| 已封装 | `lingbuilder.fbro.events` | FBro结构化事件、同步决策与受管事件对象模块 | 6 |
| 已封装 | `lingbuilder.fbro.session` | FBro会话、Cookie 与代理认证模块 | 10 |
| 已封装 | `lingbuilder.fbro.transfer` | FBro下载、打印、PDF、文件对话框与截图模块 | 5 |
| 已封装 | `lingbuilder.fbro.automation` | FBro受管异步及 Frame 自动化模块 | 25 |
| 已封装 | `lingbuilder.fbro.objects` | FBro任务、缓冲及 Value/Dictionary/List/Stream/Image/Certificate/DragData 受管对象模块 | 132 |
| 已封装 | `lingbuilder.fbro.network` | FBro高级网络模块 | 2 |
| 已封装 | `lingbuilder.fbro.vip` | FBro VIP 指纹模块 | 3 |
| 已有 | `lingbuilder.threading` | 多线程模块 | 5 |
| 已有 | `lingbuilder.websocket.client` | WebSocket 客户端模块 | 5 |
| 已有 | `lingbuilder.http.server` | HTTP 服务端模块 | 5 |
| 已有 | `lingbuilder.websocket.server` | WebSocket 服务端模块 | 6 |

除 EdgeView 原本已有 x64 target 外，其余仅声明 Win32 的内置系统模块现在会从同一份内置 manifest 自动生成等价 x64 target。外部 `.lbmod` 不使用此自动补齐规则，仍必须自行提供精确架构产物。

## 代码位置

- 模块清单：`electron/src/services/modules/standardLibraryModules.ts`、`systemLibraryModules.ts`、`networkLibraryModules.ts`、`dataMediaModules.ts`、`platformAdvancedModules.ts`。
- C++ 运行时：`electron/src/services/windowDesigner/standardLibraryRuntime.ts`、`systemLibraryRuntime.ts`、`networkLibraryRuntime.ts`、`dataMediaRuntime.ts`、`cryptoRuntime.ts`、`platformAdvancedRuntime.ts`。
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
