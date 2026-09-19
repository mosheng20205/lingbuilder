# 界面配方语料（ui-recipes）

这里存放**按场景组织**的可复制 `.lcpp` 界面配方。`lingbuilder.ai-bridge` 的 MCP 工具 `lingbuilder.module.info`
会把本目录的配方作为 `uiExamples` 索引返回，外部 AI 传 `example`（标题、路径或序号）即可直接取回正文。

与 `examples/module-demos/` 的分工：

- `examples/module-demos/`：脚本按模块清单穷举生成的**全量逐命令演示**（一个模块一个项目，命令以假参数逐条调用），
  用于查参数顺序与命令是否存在，不作为写法范本。
- `examples/ui-recipes/`：人工从**已实机编译验收过**的示例源码里提炼的**惯用写法**，单窗口、不超过 90 行，可直接当新项目主源码。

与组件卡的分工：配方讲「怎么组合成一个能跑的窗口」；单个控件的完整契约（属性表、枚举取值、事件与处理器命名、代码创建参数）看 `lingbuilder.module.info` 传 `control` 返回的组件卡，new_emoji 的卡片由 `cd electron && npm run module:new-emoji-cards` 从清单生成，人工只维护红线段。

## 目录约定

```text
examples/ui-recipes/<模块 ID>/
  recipes.json          配方索引（module.info 的 uiExamples 来源）
  NN-<中文标题>.lcpp     单条配方正文
```

`recipes.json` 字段：

| 字段 | 说明 |
|---|---|
| `id` | 稳定英文标识，用于 diff 与引用 |
| `title` | 中文标题，外部 AI 用 `example` 命中的主要依据 |
| `file` | 同目录下的 `.lcpp` 文件名 |
| `scenario` | 适用场景，一句中文说清「什么时候用这条」 |
| `controls` | 涉及的设计器控件类型（英文 `type`） |
| `commands` | 涉及的中文命令；测试会断言每条都真实出现在正文里 |
| `notes` | 写代码时最容易踩的要点与红线，逐条中文 |

## 维护要求

1. 配方必须来自仓库内已验证可编译运行的源码（示例工程、烟测脚本或已通过验收的演示项目），不得凭想象新造命令签名。
2. 新增或修改命令时，同步该模块清单与 `lingbuilder.module.info`：命令名、参数顺序、处理器签名必须一致。
3. 每条配方保持单窗口、可整文件复制；`cd electron && npm run test:lingcpp` 会跑 `tests/uiRecipes.test.ts`，
   校验行数上限、红线模式（显式 `结束()`、手写消息循环、控件引用带引号）以及 `.lcpp` 语义诊断无 error。
4. 文件用 UTF-8 + CRLF，与其余 `.lcpp` 语料一致。
5. 本目录随源码仓库分发，不在 IDE 安装包内；打包版工作区要取到配方，需要把语料改走模块包的 `contributes.examples`（见 `docs/FUTURE_OPTIMIZATIONS.md`）。
