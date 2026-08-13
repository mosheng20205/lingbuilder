# FBro 与 CEF3 SDK 按需下载资源

本文档记录 LingBuilder Windows x64 版本使用的 FBro、CEF3 SDK 按需下载资源。Windows 安装包不再内置这两套大型 SDK，只保留对应资产模块的轻量清单和 README；用户首次使用对应模块进行构建、运行、原生预览或工程导出时，由 IDE 提示并下载。

## 资源清单

### CEF3 SDK

- 模块 ID：`lingbuilder.cef3.sdk`
- 模块版本：`150.0.14+g7c1aa68+chromium-150.0.7871.129`
- 平台：`Windows x64`
- 压缩包：`lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip`
- 下载地址：<https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip>
- 文件大小：`186457476` 字节（约 `177.82 MiB`）
- SHA-256：`b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55`
- ZIP 顶层目录：`lingbuilder.cef3.sdk/`

### FBro SDK

- 模块 ID：`lingbuilder.fbro.sdk`
- 模块版本：`135.0.21.2.2.0`
- FBro SDK 版本：`135.0.21`
- 平台：`Windows x64`
- 压缩包：`lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip`
- 下载地址：<https://msimgimg.xyz/uploads/lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip>
- 文件大小：`245575922` 字节（约 `234.20 MiB`）
- SHA-256：`99ed17b2d649a91acf7552a5fce9427541a9fef287cbd8ef5a5855ebd449361f`
- ZIP 顶层目录：`lingbuilder.fbro.sdk/`

## 直链验证结果

验证日期：`2026-08-13`

- 两个地址均通过 HTTPS 直接返回 `200 OK`，不需要登录、Cookie 或页面跳转。
- `Content-Type` 均为 `application/x-zip-compressed`。
- 两个响应的 `Content-Length` 均与对应本地上传源文件的精确字节数一致。
- 服务端返回 `Accept-Ranges: bytes`；实际 Range 请求返回 `206 Partial Content` 和正确的 `Content-Range`，可用于断点续传。
- 两个远端文件的首部和尾部各 `1 MiB` 均已与本地上传源逐字节哈希比对一致。
- 当前验证线路进行整包下载时吞吐较低并触发 15 分钟测试超时，因此 IDE 下载器仍必须在下载完成后执行本文记录的完整 SHA-256 校验，校验通过前不得解压或安装。

## 下载与安装约束

- 下载前必须向用户显示 SDK 名称、版本、下载体积和用途，并允许取消。
- 下载过程必须显示进度，并支持失败重试和基于 Range 的断点续传。
- 下载文件应先写入临时 `.part` 文件；必须同时校验精确文件大小和 SHA-256。
- 解压前必须阻止绝对路径、`..` 路径穿越、符号链接及其它逃逸目标目录的 ZIP 条目。
- 解压完成后必须校验模块清单和关键文件，再通过临时目录原子切换到受管依赖目录。
- 不得把下载 URL、版本判断、解压和安装逻辑散落在 React 组件或 C++ 生成器中，应由独立的 SDK/依赖服务统一负责。
- FBro、CEF3 项目在构建、运行、原生预览和导出时必须复用同一套依赖检测结果；缺失或校验失败时应给出明确中文诊断，不能继续生成不完整项目。
- Cloudflare 上的文件内容一旦变化，必须使用新的版本化文件名和 URL，并同步更新文件大小与 SHA-256，禁止在原 URL 下静默替换内容。

## LingBuilder 实现位置

- 资源清单：`electron/src/services/sdkDependencies/sdkDependencyCatalog.ts`
- 下载、校验、解压和原子安装：`electron/src/services/sdkDependencies/sdkDependencyService.ts`
- 工作台请求重试与安装协调：`electron/src/services/sdkDependencies/sdkDependencyClient.ts`
- 中文安装对话框：`electron/src/components/SdkDependencyInstallerDialog.tsx`
- 用户共享缓存：`%APPDATA%/LingBuilder/sdk-cache/modules/<moduleId>/sdk`；桌面主进程以 `app.getPath('userData')/sdk-cache` 为准，并通过 `LINGBUILDER_SDK_CACHE_ROOT` 传给本地服务和受管 AI Bridge。
- API：`GET /api/sdk-dependencies/status`、`POST /api/sdk-dependencies/install`、`POST /api/sdk-dependencies/cancel`。
- 缺失错误码：`SDK_DEPENDENCY_REQUIRED`。桌面请求包装器只在安装成功后自动重放一次；AI Bridge/CLI 只返回诊断，不静默下载。
- 发布门禁：`electron/scripts/verify-on-demand-sdk-release.cjs` 要求 `win-unpacked` 和 NSIS 安装包保留两项轻量元数据，同时拒绝任何 `sdk/` 文件，以及藏在默认工作区或文档示例中的 `libcef.dll`、FBro/CEF3 Bridge 等 SDK 二进制副本。
