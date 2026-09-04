# CEF3 教程示例项目设计规格

**日期：** 2026-09-04  
**状态：** 待用户审阅  
**范围：** `AI 视频自主生产/CEF3 浏览器模块合集`

## 目标

根据 CEF3 浏览器模块合集 10 集口播稿，预先准备可复制、可打开、可构建和可录制的示例工程。每一集（01～09）拥有独立工程与本地测试素材；第 10 集提供可复用的选型对比资料，不制造没有实际行为的演示工程。

## 设计决策

采用“公共模板 + 独立工程”模式。工程文件从现有 `examples/cef3-browser-simple-demo` 与 `examples/cef3-browser-multi-demo` 的稳定结构派生，但每集保存完整 `.lingbuilder` 元数据、`.lcpp` 源码、构建请求和录制说明。工程使用 ASCII 项目 ID 与路径，中文仅用于窗口、控件和界面文案，保证跨机器复制和 CLI 构建稳定。

每集工程不得依赖仓库根目录的临时生成物、用户全局配置或外网资源。CEF3 SDK 作为外部前置依赖，由 README 说明安装要求，不复制到教程目录。

## 目录结构

```text
AI 视频自主生产/CEF3 浏览器模块合集/
├─ 示例项目总览.md
├─ 验证示例项目.ps1
├─ 01 CEF3 入门/
│  ├─ 口播稿-CEF3入门.md
│  ├─ 示例项目/cef3-ep01-intro/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 02 浏览器操作小项目/
│  ├─ 示例项目/cef3-ep02-browser-tool/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 03 事件驱动/
│  ├─ 示例项目/cef3-ep03-events/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 04 会话隔离/
│  ├─ 示例项目/cef3-ep04-session-isolation/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 05 代理与请求决策/
│  ├─ 示例项目/cef3-ep05-network-decision/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 06 获取网页资源响应/
│  ├─ 示例项目/cef3-ep06-resource-response/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 07 资源加载生命周期/
│  ├─ 示例项目/cef3-ep07-resource-lifecycle/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 08 下载打印查找/
│  ├─ 示例项目/cef3-ep08-transfer-find/
│  ├─ 录制准备.md
│  └─ 验证记录.md
├─ 09 JavaScript DevTools 异步任务/
│  ├─ 示例项目/cef3-ep09-automation-devtools/
│  ├─ 录制准备.md
│  └─ 验证记录.md
└─ 10 CEF3还是EdgeView/
   ├─ 对比资料/
   ├─ 录制准备.md
   └─ 验证记录.md
```

01～09 的每个工程至少包含：

- `.lingbuilder/solution.json`
- `.lingbuilder/window-designer.json`
- `.lingbuilder/project-modules.json`
- `.lingbuilder/build-configuration.json`
- `src/<中文窗体名>.lcpp`
- `config/<project-id>/config.ini`
- `build-request.json`
- `README.md`
- 该集所需的 `assets/` 本地 HTML、CSS、JavaScript、图片、重定向服务数据或下载文件

## 10 集功能矩阵

| 集数 | 工程/资料 | 核心行为 | 测试素材 | 关键边界 |
|---:|---|---|---|---|
| 01 | `cef3-ep01-intro` | 单控件创建、导航、加载完成事件、地址输出 | 稳定测试页 | SDK 下载镜头与已安装运行镜头分开 |
| 02 | `cef3-ep02-browser-tool` | 地址栏、后退、前进、刷新、停止、缩放、JS、标题/地址读取 | 本地多页测试页 | 浏览器控件参数使用裸 `controlRef` |
| 03 | `cef3-ep03-events` | 加载事件绑定、最近事件、事件数据、结构化字段 | 本地稳定页 | 回调必须使用 `&处理器名` |
| 04 | `cef3-ep04-session-isolation` | 双实例、独立缓存目录、LocalStorage 标记、目录输出 | 两个本地会话页 | 不使用真实账号、Cookie 或外网登录 |
| 05 | `cef3-ep05-network-decision` | 创建前代理配置、请求前事件、允许/取消结果 | 本地 `/allow`、`/blocked` 地址 | 默认空代理直连；授权代理仅作为可选录制配置 |
| 06 | `cef3-ep06-resource-response` | 资源响应事件、URL/statusCode/mimeType 输出 | HTML、CSS、JS、PNG 本地页 | 只演示公开元数据，不宣称正文/任意响应头读取 |
| 07 | `cef3-ep07-resource-lifecycle` | 资源加载前、响应到达、重定向、加载完成时间线 | 本地 `/redirect` → `/final` | 过滤器和正文替换只做边界说明 |
| 08 | `cef3-ep08-transfer-find` | 下载、打印、页内查找、结果事件、停止查找 | 小型下载文件、重复关键词页 | 打印只验证对话框能打开，不自动确认系统打印 |
| 09 | `cef3-ep09-automation-devtools` | 异步 JS、任务状态/结果/错误/释放、DevTools、审查协议方法 | 本地页面 | 仅使用 `Runtime.enable` 等审查过的协议调用 |
| 10 | `对比资料` | CEF3 与 EdgeView 的内核、体积、部署、会话、网络对比 | 版本/体积/依赖数据、截图清单 | 不新增无行为 C++ 工程 |

所有命令必须以当前 `builtinModules.ts`、CEF3 模块清单和事件目录为准。若口播使用的简称与公开 binding 不一致，工程采用实际可调用名称，录制文档注明口播花字映射，不在生成器中添加临时别名。

## 运行与验证

合集根目录的 `验证示例项目.ps1` 提供可重复的只读检查：

- 默认扫描 01～09；`-Episode 01` 只验证指定集；`-SkipBuild` 仅检查结构与 JSON。
- 检查项目 ID、解决方案入口、设计器文件、模块清单、源码入口、本地资源和 ASCII 工作区路径。
- 对每个项目调用：

  ```powershell
  node electron/dist/cli.cjs project build --request <项目>/build-request.json --workspace <项目> --yes --json
  ```

- 把 CLI JSON 输出、退出码、诊断数量、生成 exe 路径和 CEF 运行时文件清单写入该集 `验证记录.md`，并在根目录输出汇总表。
- 01、02、03、05、06、07、09 额外执行语言诊断，错误数必须为 0；检查裸 `controlRef` 与 `&处理器名` 语法。
- 04、08、09 在 SDK 可用时启动生成 exe 做原生冒烟：窗口出现、关键状态/调试输出可见；打印对话框只做打开检查。
- 任何构建或运行门禁失败都标记为“不可录制”，不能仅凭文件存在标记成功。

## 录制文档

每集 `录制准备.md` 固定包含：

1. 对应口播段落与操作顺序。
2. SDK、Windows x64/MSVC、工作区和 DPI/DIP 要求。
3. 控件实名、代码入口、命令及事件处理器名。
4. CDP 录制与原生窗口输入的分工。
5. 预期画面、可见输出和错误列表门禁。
6. 安全边界、禁止入镜内容和脱敏要求。
7. 运行、重录和清理命令。

`验证记录.md` 记录最后验证时间、环境、命令、结果、产物、截图/日志位置和已知限制；不得伪造运行成功。

## 数据流与错误处理

示例工程 → LingBuilder CLI 解析/诊断 → 生成 C++/Win32 工程 → MSVC + CEF3 SDK 构建 → 生成 exe 与运行时资源 → 录制按文档执行。

本地资源缺失、SDK 未安装、模块未启用、命令未绑定、控件引用错误和构建失败都必须在验证记录中给出中文原因与修复提示。网络不可用时，01～09 仍应依靠本地资源完成主要演示；只有 01 的口播允许把 `example.com` 作为可替换地址。

## 维护与同步

- 示例只消费现有中文规则，不新增 `.lcpp` 语法、binding 或 C++ 生成分支，因此不修改 `LingBuilder AI 规则手册.md`。
- 若后续修改控件引用、事件处理器或命令语义，必须同步检查本规格中的项目源码、录制文档、模块文档与测试。
- 完成后在根目录 `更新记录/2026-09-04.md` 记录新增项目、验证结果和未完成门禁。
- 在 `docs/FUTURE_OPTIMIZATIONS.md` 增加“教程示例资产维护”事项：后续应考虑把重复工程模板抽成受控脚手架，但不能牺牲每集独立可复制性。

## 自审结果

- 覆盖 10 集口播稿：01～09 有可运行工程，10 有对比资料。
- 所有代码入口、模块依赖、本地资源和验证门禁均有明确位置。
- 未引入未验证的响应正文、代理凭据、真实账号或任意 DevTools 协议调用。
- 目录路径、项目 ID 和脚本参数已固定，无 `TBD`、`TODO` 或待填占位符。
