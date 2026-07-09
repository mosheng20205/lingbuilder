# LingBuilder Electron

这个目录是独立的 Electron 桌面端项目，包含当前 Vite + React + TypeScript 原型的完整渲染端副本，以及 Electron 主进程壳。

## 目录结构

```text
electron/
  electron/
    main.ts
    preload.ts
    tsconfig.json
  scripts/
    rename-electron-output.cjs
  src/
  index.html
  server.ts
  vite.config.ts
  tsconfig.json
  package.json
```

## 开发启动

第一次进入本目录安装依赖：

```bash
npm install
```

启动 Electron 桌面端：

```bash
npm run dev
```

开发模式会先启动当前 Vite/React/TypeScript 原型服务，再打开 Electron 窗口加载：

```text
http://127.0.0.1:3001/
```

## 设计约定

- `src/` 保留现有 Web IDE 原型代码，作为 Electron 的渲染端。
- `server.ts` 继续提供本地 API 和 Vite middleware。
- `electron/main.ts` 负责窗口、生命周期和桌面宿主能力。
- `electron/preload.ts` 负责向渲染端暴露安全的桌面 API。
- 后续文件系统、终端、进程、菜单、工作区等 VS Code 式原生能力都应优先进入 Electron 主进程或 preload 桥接层。

## AI Bridge CLI

开发期可以从 `electron/` 目录启动本地 AI Bridge：

```bash
npm run ai-server -- --workspace .. --port 17860
```

默认行为：

- HTTP 地址：`http://127.0.0.1:17860/api/ai-bridge`
- 默认权限：`preview`
- token 未传入时会自动生成并打印到终端。
- 默认禁止监听公网地址；如确需远程连接，必须同时传入 `--host 0.0.0.0 --allow-remote`。

常用参数：

```bash
npm run ai-server -- --workspace .. --permission readonly
npm run ai-server -- --workspace .. --permission preview --token local-token
npm run ai-server -- --workspace .. --permission yolo --mcp
```

HTTP 请求示例：

```bash
curl -H "Authorization: Bearer local-token" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

MCP 模式使用 stdio JSON-RPC，暴露工具包括：

- `lingbuilder.workspace.list`
- `lingbuilder.file.read`
- `lingbuilder.file.search`
- `lingbuilder.lingcpp.diagnostics`
- `lingbuilder.edit.propose`
- `lingbuilder.edit.apply`
- `lingbuilder.build.run`
- `lingbuilder.modules.list`
- `lingbuilder.native.preview`
- `lingbuilder.native.export`

原生导出与 `lingbuilder.build.run` 会生成可复制 C++ 源码和 Visual Studio Win32 工程文件：`<projectId>.sln`、`<projectId>.vcxproj`、`<projectId>.vcxproj.filters`。启用外部 C++ 模块时，工程文件会写入模块源码、include 路径、`.lib` 依赖和运行时 DLL 的 post-build 复制命令。

new_emoji YOLO 示例约束：

- 生成 `lingbuilder.new_emoji.ui` 演示时，不要在窗口“创建完毕”事件末尾写 `结束` / `结束()`，否则 exe 会创建后立即退出。
- 纯 new_emoji 示例应创建窗口和控件后进入 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。
- 返回 exe 路径前，必须确认 `new_emoji.dll` 位于 exe 同目录，并启动 exe 等待至少 3 秒确认仍在运行。

安全约束：

- `readonly` 禁止写入和执行。
- `preview` 写文件、导出和构建运行必须传入 `approved=true`。
- `yolo` 允许带 token 的客户端自动执行受控 LingBuilder 命令，但仍不开放任意 shell。
- 敏感操作记录在 `.lingbuilder/ai-bridge-log.jsonl`。

## 模块 SDK CLI

LingBuilder 模块标准为 `schemaVersion: 2`。旧 `.lbmod` v1 不再兼容，C++ 依赖写入 `targets[]`，中文命令到 C++ 的确定性映射写入 `bindings.commands[]`。根目录 `模块开发手册.md` 是面向外部模块作者的正式说明。

常用命令：

```bash
node dist/cli.cjs module init --template cpp-source --out ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module validate ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module pack ../.lingbuilder/module-build/com.example.native --out ../.lingbuilder/module-packages/native.lbmod
node dist/cli.cjs module inspect ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module migrate-cpp --config ../migrate.json --out ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module market index --packages ../.lingbuilder/module-packages --out ../.lingbuilder/module-market.json
```

开发期可用 `tsx src/cli.ts module ...` 直接调试。模块页中的“模块开发者中心”复用同一套服务能力。

`new_emoji` v2 模块仍使用：

```bash
npm run module:new-emoji -- --install
```

生成结果必须包含 Win32/x64 targets、`NE_` 中文桥接命令 bindings、桥接源码、文档和示例。验证可运行 exe 时仍需确认 exe 同目录存在 `new_emoji.dll`，并等待至少 3 秒确认进程仍在运行。
