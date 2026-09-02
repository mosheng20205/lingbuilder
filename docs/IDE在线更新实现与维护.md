# IDE 在线更新实现与维护

> 面向后续会话/维护者的实现文档。功能于 2026-09-01 落地并完成生产部署；本文描述完整架构、代码位置、安全门禁、测试方式、已知坑与待办。改动本功能任一环节时必须同步更新本文。

## 1. 功能概览

官网管理后台（`lingbuilder.com/admin`）发布下载版本（浏览器分片直传 Cloudflare R2，落库直链 URL + SHA-256 + 文件大小 + 更新说明）之后，Electron IDE 可在应用内完成完整更新闭环：

```
启动 5 秒静默检查（既有）或 帮助：检查更新 命令
        │
        ▼
GET /v1/site/latest-version（读后台发布的版本记录）
        │
        ▼ 有新版本
中文更新提示对话框（欢迎页和工作台都会弹）
        │ 用户点「立即更新」
        ▼
aria2c 8 连接分片下载（进度条/速度/断点续传；aria2c 缺失回退单流 fetch）
        │ 对话框可关闭，下载后台继续
        ▼
SHA-256 完整性校验（强制）
        │ 校验通过
        ▼
对话框打开时：自动启动 NSIS 安装包（正常向导，不带 /S）
后台下载完成：显示「立即安装并重启」按钮
        │
        ▼
spawn 安装包 detached → shutdownAndExit(0) 退出 IDE
```

不使用 electron-updater；安装包为 electron-builder NSIS（`oneClick:false`、`allowToChangeInstallationDirectory:true`、按用户安装）。

## 2. 组件与代码位置

| 层 | 文件 | 职责 |
|---|---|---|
| 云端接口 | `cloud/api/src/website/website-content.controller.ts`（`@Controller('v1/site')` + `@Public()`，参数 platform/architecture/channel 默认 Windows/x64/stable） | 挂载 `GET latest-version` |
| 云端实现 | `cloud/api/src/website/website-content.service.ts` → `latestVersion()` | 查询 PUBLISHED 版本 + enabled 且 HTTPS 的 direct 镜像，组装响应 |
| 共享类型 | `packages/contracts/src/index.ts` → `SiteLatestVersionResponse` | 响应类型（全部字段可空） |
| 版本检查 | `electron/electron/versionCheckService.ts` | `checkLatestVersion(origin, currentVersion)`、`compareVersions`、`VersionCheckResult` |
| 下载服务 | `electron/electron/updateDownloadService.ts` | 分片下载 + 校验 + 安装 + 取消 + 清理（主进程，自包含可注入测试） |
| IPC 编排 | `electron/electron/main.ts`（`registerIpcHandlers()` 内，`app:check-update` 附近） | 缓存检查结果、注册 4 个 `app:update:*` IPC、`app-update:progress` 广播、启动 `cleanupAbandoned()` |
| 桥接 | `electron/electron/preload.ts` `updates` 段 | `check/download/cancel/status/install/onProgress` |
| 类型声明 | `electron/src/electron-api.d.ts` | `AppUpdateProgressSnapshot` + `window.lingBuilder.updates` 签名 |
| 更新对话框 | `electron/src/components/UpdateDialog.tsx` | 全状态机 UI（发现/下载/校验/就绪/启动/失败重试） |
| 接线 | `electron/src/App.tsx` | `updateCheckState`（`UpdateDialogInfo` 类型）、启动静默检查 effect、`checkForUpdates` 命令 handler、**两处** `<UpdateDialog>` 挂载（工作台 + `showWelcomePage` 早退分支） |

### 云端响应结构（关键契约）

```jsonc
// GET /v1/site/latest-version?platform=Windows&architecture=x64&channel=stable
// 无已发布版本时：
{ "ok": true, "available": false }
// 有已发布版本时（缺数据的字段显式 null，不省略 key）：
{
  "ok": true, "available": true,
  "version": "0.7.0", "title": "...", "summary": "...", "publishedAt": "...",
  "channel": "stable",
  "fileSize": "85 MB",            // 后台存的是格式化串，不是字节数；下载总字节取自 HEAD Content-Length
  "sha256": "<64位小写hex|null>",  // 非 64 位 hex 一律返回 null
  "releaseNotes": "...",
  "downloadUrl": "<https 直链|null>" // enabled 且 provider='direct' 且 https:// 的镜像，按 sortOrder 最小取；http 直链视为无直链
}
```

**双向兼容约定**：旧版 IDE 只读 version/title，多余字段无害；新版 IDE 对旧云端响应 `?? null` 容错（downloadUrl=null → 对话框只显示「前往官网下载」）。改任何一侧都不需要先发另一侧。

数据库模型：`WebsiteDownloadRelease`（含 sha256/fileSize/releaseNotes/channel，唯一键 `[version,channel,platform,architecture]`）+ `WebsiteDownloadMirror`（provider='direct' 为 R2 直链）。**无 Prisma schema 变更、无迁移**。

## 3. 主进程下载服务（updateDownloadService.ts）

### 下载引擎选择
1. 优先 **aria2c**：路径解析 `resolveBundledUpdaterAria2cPath(isPackaged, resourcesPath)`
   - 打包：`process.resourcesPath/third_party/aria2/aria2c.exe`（`electron/package.json` `build.extraResources` 随包分发）
   - 开发：`path.resolve(process.cwd(), 'electron')/third_party/aria2/aria2c.exe`（**坑**：cwd 已是 electron 目录时会双拼成 `electron/electron/...`，stat 失败自动走 fetch 回退，不影响正确性）
   - 参数 `createUpdaterAria2cArguments`：`--split=8 --max-connection-per-server=8 --min-split-size=8M --continue=true --max-tries=5 --check-certificate=true` 等；`.aria2` 控制文件断点续传；进度为 500ms stat 轮询 `.part` 文件
2. 回退 **单流 fetch**（aria2c 缺失/spawn ENOENT）：随机 `.partial` 临时文件 + 逐块 sha256 + 2GB 上限中止

### 安全门禁（顺序执行，全部中文诊断）
1. `assertHttpsUpdaterUrl`：仅 HTTPS；`allowInsecureUrl=true` 时仅额外放行 `127.0.0.1/localhost/[::1]`（**仅 `!app.isPackaged` 时由 main 传入**，本地 e2e 用）
2. sha256 必须为 64 位 hex（`normalizeUpdaterSha256`），否则拒绝应用内下载：「云端未提供安装包校验值…请前往官网手动下载」
3. HEAD 预检（不跟随重定向）：3xx 报「下载地址发生重定向」；拿 Content-Length 作 totalBytes（拿不到则进度条不确定态）
4. `assertUpdaterSizeWithinLimit`：上限 2GiB（`MAX_UPDATE_INSTALLER_BYTES`）
5. 下载完成后强制 `verifyInstallerSha256`（流式），失败删除下载内容并报错

### 状态机（AppUpdateProgress，500ms 节流广播）

`idle → downloading → verifying → ready → launching`；任一环节失败 → `error`（error 前若已 ready，UI 主按钮为「重试安装」，否则「重试下载」）。快照含 `version/downloadedBytes/totalBytes/bytesPerSecond/engine('aria2c'|'fetch')/message/error/installerPath`。

其它行为：取消 = AbortController → kill aria2c（SIGTERM→2s→SIGKILL）→ 清理 `.part/.aria2` → idle「已取消下载」；对话框关闭下载继续；同版本重复 download 返回 `alreadyRunning`，不同版本给中文错误；`download()` 发现目标文件已存在且 sha 匹配 → 直接 ready（`alreadyDownloaded`，支持「稍后安装」）；`install()` 仅 ready 态可执行，spawn detached + 500ms 内 error 事件竞争判定，失败给「请手动运行：<路径>」；`cleanupAbandoned()` 在 `app.whenReady` 清空 `userData/updates/`。

## 4. IPC 与渲染层

| IPC | 方向 | 说明 |
|---|---|---|
| `app:check-update`（既有） | invoke | 结果缓存为 main 的 `lastVersionCheck`（**权威来源，渲染层不可传 URL**） |
| `app:update:download` | invoke | 无参数，用主进程缓存发起下载，杜绝伪造地址 |
| `app:update:cancel` | invoke | 取消当前下载 |
| `app:update:status` | invoke | 拉取快照（重开对话框恢复进度） |
| `app:update:install` | invoke | 启动安装包；`ok` 时 main 调 `shutdownAndExit(0)` |
| `app-update:progress` | 事件 | 快照广播到所有窗口（`BrowserWindow.getAllWindows()`，窗口可能重建所以广播而非 event.sender） |

渲染层状态机：`checking → latest | update → downloading → verifying → ready → launching`，失败 → `error`（检查失败独立为 `error`）。按钮矩阵与全部中文文案见 `UpdateDialog.tsx`。**自动安装规则**：对话框打开期间经历 downloading/verifying → ready 时自动 install（`sawActiveDownloadRef`）；后台下载完成则 ready 态显示「立即安装并重启」。直链或校验值缺失时「前往官网下载」为主按钮（`info.websiteUrl` 回退官网首页）。

**注意**：`App.tsx` 的欢迎页是早退分支（`if (showWelcomePage) return <WelcomePage/>`），更新对话框在**两个分支都挂载**——新增早退分支时记得同步挂载，否则静默检查查到更新不显示（本次修复过的坑）。

## 5. 测试与验证

| 测试 | 命令 | 覆盖 |
|---|---|---|
| `cloud/api/tests/website-content.test.ts` | `cd cloud/api && npm test` | latest-version 6 用例：https 直链选取、忽略禁用/非直链/http 镜像、旧数据置 null、旧字段兼容、多直链取最小 sortOrder、sha256 规范化 |
| `electron/tests/versionCheck.test.ts` | `npm run test:version-check` | 直链/校验值透传、旧云端容错 |
| `electron/tests/updateDownload.test.ts` | `node --import tsx --test --test-force-exit tests/updateDownload.test.ts` | 14 用例：aria2c 参数/路径解析/门禁/2GiB/sha256 失配删除/非零退出码中文诊断/取消清理/fetch 回退/install spawn 成败/防重/清理 |
| `electron/tests/updateUi.test.tsx` | 已加入 `pretest:lingcpp` | 读源码断言：对话框状态机按钮矩阵、4 IPC + 广播、preload 5 方法、App 命令描述 |

**`--test-force-exit` 必须加**：测试桩留有良性句柄导致进程不退出（仅测试环境问题，应用生命周期由 app.quit 控制）。

### 本地端到端套路（不碰生产）
1. temp 目录写假云端脚本（参考 `%TEMP%\lingbuilder-update-e2e\fake-cloud.cjs`）：`GET /v1/site/latest-version` 返回 version=9.9.9 + 真实 sha256 + `http://127.0.0.1:17900/...` 直链（**开发态 `allowInsecureUrl` 只放行本机回环 http**）；exe 响应用分块延迟（如 512KB/250ms）以便截到下载进度；payload 用真实可执行文件（如 aria2c.exe 副本）使 install 的 spawn 真实成功
2. 假云端监听 **17900**（dev 模式 `cloudApiOrigin()` 默认值），起 `npm run dev:renderer`（PORT=3001 + 临时 `LINGBUILDER_WORKSPACE_ROOT`），再 `./node_modules/electron/dist/electron.exe . --remote-debugging-port=9222`
3. CDP 驱动（Node 内置 WebSocket）：等「发现新版本」→ 校验按钮文案 → 点击「立即更新」→ 轮询下载/校验文本 + 截图 → 等进程退出（= shutdownAndExit 触发）
4. **坑**：启动静默检查是 load 后 5s 定时器；改 App.tsx 后 vite HMR 对该文件不生效，必须 CDP `Page.reload`；验证产物在 `%APPDATA%\lingbuilder-electron\updates\LingBuilder-<version>-x64.exe`

## 6. 发布与部署

- **生产已部署**（2026-09-01）：`/opt/lingbuilder/app` 上传 `website-content.service.ts` + `contracts/src/index.ts`（原文件备份 `.bak-20260901`，md5 核对一致）→ `docker compose --env-file .env.production -f compose.production.yaml build api && up -d api` → curl 验证。部署前基准：`latest-version` 返回 `{"ok":true,"available":false}`（当前云端无已发布 stable/Windows/x64 记录，属正常）。
- **后台发布版本时的要求**（否则自动回退官网下载）：直链镜像 provider=`direct` 且 URL 必须 HTTPS；SHA-256 由后台上传流程自动回填，必须保存；fileSize 会展示在对话框。
- **0.6.2 发布记录（2026-09-02）**：使用 `electron/npm run package:win` 构建 Windows x64 stable 安装包；发布后台“官网内容/下载版本列表”中的 `0.6.2` 后，通过 `/v1/site/latest-version?platform=Windows&architecture=x64&channel=stable` 验证客户端更新元数据。
- 本机到服务器 SSH 22 偶发超时（443 正常），重试即可；辅助脚本 `.deploy/ssh_run.py`、`ssh_put.py`（密码走 `LB_DEPLOY_PW`，`/opt/...` 路径参数必须 `MSYS_NO_PATHCONV=1`）。

## 7. 待办

- [ ] 下次正式打包发版后，用真实 NSIS 安装包人工走一遍「自动打开安装向导 → 覆盖安装 → 重启」确认（本次端到端验证到 spawn 成功为止，未做真机覆盖安装）。
- [ ] 可选增强：渠道跟随（IDE 目前固定查 stable）；下载失败后的自动重试次数策略。

## 8. 相关文档

- `更新记录/2026-09-01.md` — 本次落地的当日记录（含部署步骤与验证数据）
- `docs/SDK按需下载直链云端配置设计.md` — 同类「云端清单 + 客户端下载」模式的 SDK 版参考
- `LingBuilder AI 规则手册.md` — AI 对话注入的固定规则（本功能不涉及 .lcpp/模块规范，未强制同步）
