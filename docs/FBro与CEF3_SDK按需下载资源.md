# FBro 与 CEF3 SDK 按需下载资源

本文档记录 LingBuilder Windows x64 版本使用的 FBro、CEF3 SDK 按需下载资源。Windows 安装包不再内置这两套大型 SDK，也不包含对应 SDK 资产模块目录；用户首次使用对应模块进行构建、运行、原生预览或工程导出时，由 IDE 提示并下载。

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
- 下载器使用随 LingBuilder Windows x64 安装包分发的 `aria2c 1.37.0`，每个 SDK 请求使用 8 路连接、8M 分段、失败重试和断点续传；启动 aria2 前由服务对受控 HTTPS 直链执行不跟随重定向的预检，下载器强制校验证书，服务端仍需支持 HTTPS 与 Range。若 aria2 在写完最后一个分片后仍等待连接关闭，IDE 会先确认临时归档的精确大小和完整 SHA-256，再请求 aria2 退出；只有收到下载进程真实退出事件后才进入解压校验。超时会升级强制终止并报告失败，不能与旧下载进程竞争文件或提前重试；未通过 SHA-256 时绝不提前结束。
- 下载过程必须显示进度；取消时保留 `.part` 与 aria2 控制文件以便下次继续，成功完成后清理控制文件。
- 下载文件应先写入临时 `.part` 文件；必须同时校验精确文件大小和 SHA-256。
- 解压前必须阻止绝对路径、`..` 路径穿越、符号链接及其它逃逸目标目录的 ZIP 条目。
- 解压完成后必须校验模块清单和关键文件，再通过临时目录原子切换到受管依赖目录。
- 不得把下载 URL、版本判断、解压和安装逻辑散落在 React 组件或 C++ 生成器中，应由独立的 SDK/依赖服务统一负责。
- FBro、CEF3 项目在构建、运行、原生预览和导出时必须复用同一套依赖检测结果；缺失或校验失败时应给出明确中文诊断，不能继续生成不完整项目。
- Cloudflare 上的文件内容一旦变化，必须使用新的版本化文件名和 URL，并同步更新文件大小与 SHA-256，禁止在原 URL 下静默替换内容。

## 代理与失败诊断（2026-08-30 起）

- 下载前自动解析代理：优先环境变量 `HTTPS_PROXY`、`https_proxy`、`ALL_PROXY`、`all_proxy`，其次 Windows 系统代理（注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyEnable` 与 `ProxyServer`，支持 `host:port` 与 `http=...;https=...;<local>` 分号格式）。仅接受 HTTP/HTTPS 代理并统一规范化为 `http://host:port` 后通过 `--all-proxy` 传给 aria2c；`socks=` 条目因 aria2c 不支持 SOCKS 而被忽略。aria2c 不读 Windows 系统代理，该解析是代理用户唯一生效路径。
- 直链 HEAD 预检有 15 秒上限（合并任务取消信号）。预检遇到网络层失败（无法连接、超时）不再阻断下载，交由 aria2c 实测连通性；重定向、HTTP 非 2xx、返回非 HTTPS、`Content-Length` 与受控大小不匹配仍会直接阻断。
- 下载期间若持续收不到新数据，30 秒后进度消息追加「已 N 秒未收到数据，可能在等待重连；若持续无进展，请检查网络或代理设置」，恢复进度后自动清除；已到 100% 等待 aria2c 退出或校验期间不显示该提示。
- 失败诊断中文化：aria2c 退出码映射为中文原因（1=未知下载错误、2=下载超时、3=服务器上不存在该资源、6=网络连接失败、8=服务器不支持断点续传、9=磁盘空间不足等）；`fetch failed`、`ECONNREFUSED`、`ENOTFOUND`、连接重置、证书/TLS 失败等常见原始错误翻译为「无法连接下载服务器（原因），请检查网络连接或代理设置后重试」，并保留最多 240 字符原始信息；aria2c 无 stderr 输出时失败信息直接提示检查网络连接或代理设置。

## 手动部署（IDE 内下载失败时的离线安装）

共享缓存根目录：`%APPDATA%\LingBuilder\sdk-cache`（即 `C:\Users\<用户名>\AppData\Roaming\LingBuilder\sdk-cache`；设置了 `LINGBUILDER_SDK_CACHE_ROOT` 环境变量时以它为准）。

方式一（推荐）：投放完整 ZIP，由 IDE 校验安装

1. 用浏览器或下载工具从本文「资源清单」中的直链下载对应 ZIP。
2. 用 `certutil -hashfile "<zip 路径>" SHA256` 核对哈希与本文记录的 SHA-256 一致。
3. 打开（不存在则逐级新建）`%APPDATA%\LingBuilder\sdk-cache\downloads`，把 ZIP 放入，文件名保持原样，不要解压、不要改名。
4. 回到 IDE 重新触发刚才被拦截的操作（F5 构建、运行、原生预览或工程导出），在安装对话框点「下载并安装」或「重试安装」；IDE 检测到完整 ZIP 后跳过下载，直接校验、解压并原子安装，成功后自动删除 ZIP。
5. 注意：ZIP 必须与官方包字节一致；大小或 SHA-256 不匹配时 IDE 会删除该文件并转为联网下载。

方式二：直接解压到共享模块目录（完全离线）

1. 解压 ZIP，得到顶层文件夹 `lingbuilder.cef3.sdk/` 或 `lingbuilder.fbro.sdk/`。
2. 将该文件夹整个放到 `%APPDATA%\LingBuilder\sdk-cache\modules\` 下。
3. 在该文件夹内新建文本文件 `.lingbuilder-sdk-install.json`（UTF-8），内容对应填写：

   CEF3：

   ```json
   {
     "schemaVersion": 1,
     "dependencyId": "cef3",
     "moduleId": "lingbuilder.cef3.sdk",
     "version": "150.0.14+g7c1aa68+chromium-150.0.7871.129",
     "archiveSha256": "b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55",
     "installedAt": "2026-08-30T00:00:00.000Z"
   }
   ```

   FBro：

   ```json
   {
     "schemaVersion": 1,
     "dependencyId": "fbro",
     "moduleId": "lingbuilder.fbro.sdk",
     "version": "135.0.21.2.2.0",
     "archiveSha256": "99ed17b2d649a91acf7552a5fce9427541a9fef287cbd8ef5a5855ebd449361f",
     "installedAt": "2026-08-30T00:00:00.000Z"
   }
   ```

4. 重新触发构建/运行即可识别，无需重启 IDE。该标记缺少或字段不匹配时，受管缓存目录不生效。

方式三：工作区级安装（只对当前工作区生效）

- 解压 ZIP，把里面的 `lingbuilder.cef3.sdk/`（或 `lingbuilder.fbro.sdk/`）整个文件夹放到 `<工作区>\.lingbuilder\modules\` 下。此方式不需要 `.lingbuilder-sdk-install.json` 标记，但每个工作区需要各自安装。

高级用户也可以通过环境变量 `CEF3_SDK_ROOT` / `FBRO_SDK_ROOT` 直接指向已解压的 `sdk` 目录（例如 `...\lingbuilder.cef3.sdk\sdk`）。

验证是否安装成功：重新执行被拦截的操作能通过 SDK 门禁；或查看 `%APPDATA%\LingBuilder\sdk-cache\modules\<模块 ID>\sdk` 下关键文件是否完整（清单见本文「资源清单」）。

## aria2 再分发说明

- 版本：`aria2 1.37.0 Windows x64`，来源为官方 GitHub release：<https://github.com/aria2/aria2/releases/tag/release-1.37.0>。
- 上游压缩包 SHA-256：`67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288`。
- 安装包随 `aria2c.exe` 一并提供 `electron/third_party/aria2/COPYING`（GNU GPLv2）；本项目只调用其命令行下载能力，不修改 aria2 二进制。
- 发布目录中的 `resources/third_party/aria2/aria2c.exe` 和许可文件由 `verify-on-demand-sdk-release.cjs` 强制检查。

## LingBuilder 实现位置

- 资源清单：`electron/src/services/sdkDependencies/sdkDependencyCatalog.ts`
- 下载、校验、解压和原子安装：`electron/src/services/sdkDependencies/sdkDependencyService.ts`
- 工作台请求重试与安装协调：`electron/src/services/sdkDependencies/sdkDependencyClient.ts`
- 中文安装对话框：`electron/src/components/SdkDependencyInstallerDialog.tsx`
- 用户共享缓存：`%APPDATA%/LingBuilder/sdk-cache/modules/<moduleId>/sdk`；桌面主进程以 `app.getPath('userData')/sdk-cache` 为准，并通过 `LINGBUILDER_SDK_CACHE_ROOT` 传给本地服务和受管 AI Bridge。
- API：`GET /api/sdk-dependencies/status`、`POST /api/sdk-dependencies/install`、`POST /api/sdk-dependencies/cancel`。
- 缺失错误码：`SDK_DEPENDENCY_REQUIRED`。桌面请求包装器只在安装成功后自动重放一次；AI Bridge/CLI 只返回诊断，不静默下载。
- 发布门禁：`electron/scripts/verify-on-demand-sdk-release.cjs` 要求 `win-unpacked` 和 NSIS 安装包完全排除两项 SDK 模块目录，并拒绝任何藏在默认工作区或文档示例中的 `libcef.dll`、FBro/CEF3 Bridge 等 SDK 二进制副本；同时校验安装包保留 `aria2c.exe` 及其许可文件。
