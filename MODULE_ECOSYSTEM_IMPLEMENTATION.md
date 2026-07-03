# LingBuilder 模块生态实现说明

本文记录当前仓库已经落地的模块系统实现，供后续开发者和 Agent 继续扩展时参考。模块系统的目标不是做展示页，而是让“项目引用模块 -> Monaco 中文代码能力 -> 设计器控件 -> C++ 生成/构建”形成同一套数据闭环。

## 当前实现范围

- 模块核心类型、内置模块、清单校验和 Node 端服务位于 `electron/src/services/modules/`。
- 模块管理 UI 位于 `electron/src/components/ModuleInspector.tsx`，通过 `/api/modules/*` 访问服务，不再使用组件内硬编码模拟安装状态。
- 解决方案资源管理器已经在项目节点 `GameClient (Visual C++)` 下显示“模块”组，并提供“配置项目所使用模块”入口。
- Monaco 中文代码编辑器通过 `LingCppModuleContext` 消费模块贡献，支持模块命令/类型/片段补全，以及“使用了未启用模块命令”的中文诊断。
- Win32 C++ 生成器支持读取启用模块，输出 `module-dependencies.txt`，并在 `main.cpp` 中写入外部模块依赖注释、`#pragma comment(lib, ...)` 和 define。
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
- 项目启用模块：`.lingbuilder/project-modules.json`
- 模块市场源：`.lingbuilder/module-sources.json`
- 模块操作历史：`.lingbuilder/module-history.json`
- 卸载/升级快照：`.lingbuilder/module-snapshots/`
- 安装预览临时目录：系统临时目录 `lingbuilder-module-previews`
- 生成输出：`generated/cpp/<projectId>/module-dependencies.txt`

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
