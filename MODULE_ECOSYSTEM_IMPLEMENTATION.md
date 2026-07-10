# LingBuilder 模块生态实现说明

本文记录当前仓库已经落地的模块系统实现，供后续开发者和 Agent 继续扩展时参考。模块系统的目标不是做展示页，而是让“项目引用模块 -> Monaco 中文代码能力 -> 设计器控件 -> C++ 生成/构建”形成同一套数据闭环。

## 2026-07 v2 模块 SDK 重构状态

- 模块清单已升级为 `schemaVersion: 2`；旧 `.lbmod` v1 不再作为兼容目标，安装预览会提示使用模块迁移工具重新打包。
- C++ 依赖从旧 `contributes.cpp` 迁移到顶层 `targets[]`，当前默认构建目标为 `windows-msvc-win32`，并预留 `windows-msvc-x64`、CMake、Linux、macOS 等后续目标。
- 中文命令到 C++ 的确定性映射从旧 `cppRuntimeName` 迁移到 `bindings.commands[]`。`contributes.commands` 只负责补全、诊断和文档；生成 C++ 必须优先使用 binding。
- 新增模块 SDK 能力：`lingbuilder module init`、`module validate`、`module pack`、`module inspect`、`module migrate-cpp`、`module market index`。
- `module validate` / `module inspect` 可直接检查模块目录、manifest 或 `.lbmod`；包检查使用临时工作区预览并在结束后清理，不改变项目启用状态。
- 模块页新增“模块开发者中心”，支持创建模板、校验模块、C++ 迁移和本地市场索引生成；这些入口复用服务层，不把模块逻辑写入 React 组件。
- 根目录 `模块开发手册.md` 是对外模块作者手册；修改 v2 manifest、binding、target、迁移流程或发布流程时必须同步更新。
- `new_emoji` 模块需要用 `electron/scripts/generate-new-emoji-module.cjs` 重新生成 v2 包，输出仍为 `.lingbuilder/module-packages/new_emoji.lbmod`，安装目录仍为 `.lingbuilder/modules/lingbuilder.new_emoji.ui`。
- 新建普通 Win32 项目默认只引用 `lingbuilder.win32.basic`。`new_emoji`、网页访问、HTTP 服务端、WebSocket 客户端/服务端等模块即使已安装或属于内置网络模块，也必须由模板、用户或明确的一键启用动作加入项目引用。
- 模块管理 UI 的 `projectId` 为必填，始终跟随解决方案中的活动项目；切换项目会清空旧请求状态并重新读取，安装后启用、启用/禁用、刷新和变更事件均携带项目 ID，服务端拒绝不存在的项目。
- HTTP 模块开发入口只接受工作区相对路径：模板/迁移输出位于 `.lingbuilder/module-build`，包位于 `.lingbuilder/module-packages`，市场索引位于 `.lingbuilder`；CLI 仍可显式使用本机路径。
- 当前 F5 目标只接受精确 `windows-msvc-win32`。缺少该 target 时跳过原生依赖并返回中文诊断，不会回退到 `targets[0]`。
- manifest 预览、目录校验、安装与打包会确认 `docs`、`examples`、`headers`、`sources`、`libs`、`runtimeFiles` 和 include 目录实际存在。
- 命令 `insertText` 必须由签名参数生成并与 binding 参数数量一致；零参数命令生成 `命令()`，多参数按顺序生成 `$1` 到 `$N`。

## 当前实现范围

- 模块核心类型、内置模块、清单校验和 Node 端服务位于 `electron/src/services/modules/`。
- 模块管理 UI 位于 `electron/src/components/ModuleInspector.tsx`，通过 `/api/modules/*` 访问服务，不再使用组件内硬编码模拟安装状态。
- 解决方案资源管理器已经在项目节点 `GameClient (Visual C++)` 下显示“模块”组，并提供“配置项目所使用模块”入口。
- Monaco 中文代码编辑器通过 `LingCppModuleContext` 消费模块贡献，支持模块命令/类型/片段补全，以及“使用了未启用模块命令”的中文诊断。
- Win32 C++ 生成器支持读取启用模块，输出 `module-dependencies.txt`，并在 `main.cpp` 中写入外部模块依赖注释、`#pragma comment(lib, ...)` 和 define。
- Win32 F5 构建链路支持把外部模块的 `headers`、`sources`、`libs` 和 `runtimeFiles` 复制到临时构建目录与 `generated/cpp/` 导出目录，并把运行时 DLL 复制到 exe 同目录；同步生成的 Visual Studio 工程会引用模块源码、include 路径、`.lib` 和 DLL post-build 复制命令。
- `.lbmod` 模块包采用“zip 包 + 根目录 `lingbuilder.module.json`”格式；安装前必须预览确认。
- 模块市场第一阶段支持本地/远程索引读取，安装仍走同一套 preview/install 流程。

## 关键文件

- `electron/src/services/modules/types.ts`
  - 定义 `LingBuilderModuleManifest`、模块贡献类型、安装预览、市场模块、历史记录等公共结构。
- `electron/src/services/modules/builtinModules.ts`
  - 定义内置基础模块 `lingbuilder.win32.basic`，包含 `信息框`、`调试输出`、`结束`、基础类型和基础设计器控件贡献。
- `electron/src/services/modules/manifest.ts`
  - 校验模块清单、模块 ID、贡献项和 C++ 相对路径安全。
- `electron/src/services/modules/moduleService.ts`
  - 负责扫描、项目启用/禁用、`.lbmod` 预览、安装、卸载、市场索引、导出模块包和操作历史。
- `electron/src/services/modules/nativeDependencyService.ts`
  - 负责把已启用模块的 C++ 头文件、源码、库文件和运行时 DLL 安全复制到构建/导出目录，并向编译器提供 include/source/lib 路径。
- `electron/server.ts`
  - 暴露 `/api/modules/*` 路由，并在窗口设计器构建时把启用模块传给 C++ 生成器。
- `electron/src/services/lingCpp/languageService.ts`
  - 将启用模块贡献合并进补全和诊断。
- `electron/src/components/MonacoCodeEditor.tsx`
  - 拉取项目模块上下文，并传给 LingCpp 语言服务。
- `electron/src/components/Sidebar.tsx`
  - 在项目树中显示当前项目启用模块；模块 API 暂不可用时 fallback 显示内置基础模块，避免开发服务未重启时出现 JSON 解析错误。
- `electron/src/services/windowDesigner/lingCppWin32Project.ts`
  - 生成模块依赖报告和 C++ 模块依赖前导内容。
- `electron/tests/modules.test.ts`
  - 覆盖 manifest 校验、模块补全/诊断、生成器模块依赖输出。

## 模块清单格式

模块目录或 `.lbmod` 包根目录必须包含 `lingbuilder.module.json`：

```json
{
  "schemaVersion": 1,
  "id": "com.example.sqlite",
  "name": "SQLite数据库模块",
  "version": "1.0.0",
  "category": "数据库",
  "description": "提供 SQLite 数据库访问能力。",
  "author": "Example",
  "tags": ["数据库", "SQLite"],
  "contributes": {
    "commands": [
      {
        "name": "执行SQL",
        "signature": "执行SQL(语句)",
        "description": "执行一条 SQL 语句。",
        "insertText": "执行SQL(\"$1\")",
        "returnType": "整数型",
        "cppRuntimeName": "ExecuteSql"
      }
    ],
    "types": [
      {
        "name": "数据库连接",
        "description": "数据库连接句柄。",
        "cppType": "SqliteConnection"
      }
    ],
    "snippets": [
      {
        "label": "打开数据库模板",
        "insertText": "打开数据库(\"$1\")",
        "description": "插入打开数据库的中文代码模板。"
      }
    ],
    "designerControls": [
      {
        "type": "SqlTableView",
        "label": "数据表视图",
        "defaultProps": {
          "content": "数据表",
          "width": 320,
          "height": 180
        },
        "events": [
          {
            "name": "Select",
            "label": "被选择",
            "handlerPattern": "_{controlName}_被选择"
          }
        ]
      }
    ],
    "cpp": {
      "includeDirs": ["include"],
      "headers": ["include/sqlite_bridge.h"],
      "sources": ["src/sqlite_bridge.cpp"],
      "libs": ["lib/sqlite3.lib"],
      "defines": ["LINGBUILDER_SQLITE_MODULE"],
      "runtimeFiles": ["bin/sqlite3.dll"]
    }
  }
}
```

模块 ID 必须稳定、全小写，并只使用字母、数字、点、横线或下划线。所有 C++ 文件路径必须是模块包内的安全相对路径，不允许绝对路径、空段或 `..`。

## 文件与持久化约定

- 已安装模块：`.lingbuilder/modules/<moduleId>/`
- 默认项目启用模块：`.lingbuilder/project-modules.json`
- 非默认项目启用模块：`.lingbuilder/projects/<projectId>/project-modules.json`
- 模块市场源：`.lingbuilder/module-sources.json`
- 模块操作历史：`.lingbuilder/module-history.json`
- 卸载/升级快照：`.lingbuilder/module-snapshots/`
- 安装预览临时目录：系统临时目录 `lingbuilder-module-previews`
- 生成输出：`generated/cpp/<projectId>/module-dependencies.txt`、`generated/cpp/<projectId>/<projectId>.sln`、`generated/cpp/<projectId>/<projectId>.vcxproj`

所有模块 JSON 必须使用 UTF-8 读写。遇到旧文件乱码时，只报告诊断，不要凭终端乱码重写中文文案。

## API 路由

前端统一通过 Express API 访问模块能力：

- `GET /api/modules/installed?projectId=...`
- `GET /api/modules/project?projectId=...`
- `POST /api/modules/project/enable`
- `POST /api/modules/project/disable`
- `POST /api/modules/package/preview`
- `POST /api/modules/package/install`
- `POST /api/modules/package/export`
- `POST /api/modules/uninstall`
- `GET /api/modules/market`
- `GET /api/modules/history`

注意：开发期如果前端热更新了但 Express server 没重启，新增 API 可能暂时返回 Vite HTML。资源管理器已有 fallback，但模块管理页和后端真实安装能力仍需要重启 `npm run dev` 或对应 server。

## UI 入口

- 左侧活动栏“模块”页：进入完整模块管理器。
- 解决方案资源管理器项目节点下“模块”组：显示当前项目启用模块，并提供“配置项目所使用模块”按钮。
- `.lbmod` 可拖入模块页，也可手动填写本机路径后点击“预览安装”。
- 安装预览必须显示模块名、版本、SHA256、文件数量、升级状态和安全检查结果；用户确认后才安装。

## 与 Monaco 和生成器的关系

模块不直接操作 Monaco。正确链路是：

```text
lingbuilder.module.json
  -> ModuleService
  -> LingCppModuleContext
  -> lingCpp/languageService
  -> MonacoCodeEditor
```

生成器也必须消费同一份启用模块上下文。不要在 Monaco 里支持一个模块命令，却让 C++ 生成器完全不知道它；也不要在生成器里硬编码新中文命令而不让语言服务知道。

## new_emoji 原生界面库模块

- `electron/scripts/generate-new-emoji-module.cjs` 可从 `T:\github\new_emoji` 或 `NEW_EMOJI_ROOT` 指向的源码目录生成 `lingbuilder.new_emoji.ui` 模块。
- 生成命令：`cd electron && npm run module:new-emoji -- --install`。该命令会生成 `.lingbuilder/module-packages/new_emoji.lbmod`，并安装到 `.lingbuilder/modules/lingbuilder.new_emoji.ui`。
- 模块包复制 Win32/x64 的 `new_emoji.dll` 和 `new_emoji.lib`，但当前 F5 预览默认使用 Win32 产物。
- `new_emoji.lib` 是 MSVC 导入库；如果只检测到 g++/clang++，F5 会返回“new_emoji 模块需要 MSVC/Visual Studio Build Tools”的中文诊断。
- `.lcpp` 用户优先使用 `NE_创建窗口`、`NE_创建按钮`、`NE_创建文本` 等桥接命令；自动生成的 `NE_EU_*` 命令属于底层高级入口，参数仍按 new_emoji 的 UTF-8 字节指针和长度规则处理。
- `NE_` 桥接层把 `wchar_t*` 转 UTF-8 时必须为 `WideCharToMultiByte` 的结尾 `\0` 预留空间，再传递不含结尾 `\0` 的字节长度；传给 new_emoji 控件的 UTF-8 字符串还必须存入桥接层持久池，不能把函数内临时缓冲区指针交给 DLL，否则 VS Debug CRT 可能读到 `0xDDDDDDDD` 已释放内存并触发访问冲突。
- new_emoji 独立演示或 AI 自动生成示例不能在窗口创建完毕事件中调用 `结束` / `结束()`；该命令会销毁 LingBuilder 默认窗口，消息循环收到退出后表现为 exe 闪退。
- 纯 new_emoji 示例应由 new_emoji 自己负责生命周期：创建窗口和控件后调用 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。如果继续复用 LingBuilder 默认 Win32 生成窗口，必须保证默认窗口不会立即销毁，也不能让空设计器窗口关闭后触发 `PostQuitMessage(0)`。
- 报告 new_emoji exe 可运行前，必须确认 `new_emoji.dll` 已复制到 exe 同目录，并实际启动验证至少 3 秒仍在运行。

## WebSocket 客户端内置网络模块

- `lingbuilder.websocket.client` 是内置 v2 网络模块，项目启用后提供 `WS_连接`、`WS_发送文本`、`WS_接收到调试输出`、`WS_接收文本` 和 `WS_关闭`。
- 该模块的补全、诊断和生成器 binding 均来自 `electron/src/services/modules/builtinModules.ts`，不要在 Monaco 或 React 组件里另写一份命令清单。
- Win32 C++ 生成器在 `LingWindowBase` 内置基于 WinHTTP 的单连接 WebSocket 运行时，并链接 `winhttp.lib`；当前稳定目标仍是 Windows/MSVC。
- AI 或示例代码使用该模块时，应先确认项目已启用模块；地址使用 `ws://` 或 `wss://`，运行时会规范化为 WinHTTP 握手使用的 HTTP/HTTPS URL。

## HTTP / WebSocket 服务端内置网络模块

- `lingbuilder.http.server` 和 `lingbuilder.websocket.server` 是内置 v2 网络服务端模块，项目启用后分别提供本地 HTTP 服务端和 WebSocket 服务端能力。
- HTTP 服务端命令包括 `HTTP_启动服务`、`HTTP_等待请求`、`HTTP_等待请求到调试输出`、`HTTP_回复文本` 和 `HTTP_关闭服务`。
- WebSocket 服务端命令包括 `WSS_启动服务`、`WSS_等待连接`、`WSS_接收文本`、`WSS_接收到调试输出`、`WSS_发送文本` 和 `WSS_关闭服务`。
- 两个服务端模块当前都是 Windows/MSVC 原型闭环，Win32 C++ 生成器在 `LingWindowBase` 内置基于 Winsock 的单连接同步服务端运行时；HTTP 链接 `ws2_32.lib`，WebSocket 服务端链接 `ws2_32.lib` 和 `advapi32.lib`。
- 服务端监听默认绑定 `127.0.0.1`，适合作为本地调试、AI 示例和模块能力验证入口；后续如开放局域网监听、路由、多客户端或异步事件循环，必须先抽象受控服务层和清晰的权限提示。

## 后续扩展规则

- 新增模块能力时，先扩展 `electron/src/services/modules/types.ts` 和校验器，再接 UI。
- React 组件只负责展示、触发和局部状态；安装、扫描、启用、禁用、导出、市场读取必须在 `ModuleService` 或 API 层完成。
- 内置基础能力也按模块模型表达，不要另写一套“特殊基础命令列表”。
- 模块控件后续接入设计器时，应由 `designerControls` 贡献生成工具箱项，并在项目禁用模块时显示“依赖模块未启用”，不要静默删除已有控件。
- 外部模块的 C++ 依赖第一阶段只生成报告和明确注释；真正复制 include/src/lib/runtime 文件到构建目录时，必须补测试并保证路径安全。
- 模块市场远程下载、签名校验和回滚可以继续增强，但必须复用 preview/install 流程。

## 验证命令

模块相关改动至少运行：

```bash
cd electron
npm run lint
npm run test:lingcpp
npm run build
```

涉及 UI 时还应打开 `http://127.0.0.1:3000/` 或当前开发端口，确认项目树下“模块”组和模块管理页不重叠、不报错。
