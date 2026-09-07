# LingBuilder 质量门禁总表

更新时间：2026-09-06

本文汇总 LingBuilder 当前生效的质量门禁、各自的判定含义、运行方式，以及一次覆盖面门禁
基线写回的完整归因过程。目的只有一个：**让"变绿"必须来自真实修复或如实补账，而不是放宽阈值。**

各门禁的领域规范细节仍以对应文档为准（`MODULE_ECOSYSTEM_IMPLEMENTATION.md`、
`MODULE_ENCAPSULATION_CHECKLIST.md`、`AGENTS.md`），本文只做索引与状态记录。

## 运行位置

除特别说明外，均在 `electron/` 目录下执行：

```bash
cd electron
npm run <脚本名>
```

## 门禁清单

| 门禁 | 命令 | 判定什么 | 红了意味着 |
|---|---|---|---|
| 类型与静态检查 | `npm run lint` | `tsc --noEmit` 双工程 | 类型/服务契约被破坏，禁止合入 |
| controlRef 审计 | `npm run module:control-ref-audit` | 内置方法控件参数是否统一 `controlRef` + 裸引用，并核对**基线计数与摘要** | 有命令/参数未登记，或引用语义回归 |
| controlRef 源码审计 | `npm run module:control-ref-source-audit` | 各 `.lcpp` 源码、示例、片段是否保持裸引用 | 出现带引号控件名等旧写法 |
| controlRef 迁移检查 | `npm run module:control-ref-migration-check` | 历史源码中可安全迁移的旧写法 | 有待迁移项（见"已知红项"） |
| 模块封装清单 | `tests/modules.test.ts` 内 | 清单声明的模块/命令数与 `BUILTIN_MODULES` 实算一致 | 台账与实际注册表脱节 |
| EdgeView API 文档 | `npm run module:edgeview-api-docs:check` | `API.md` 与清单同步（生成用 `:docs` 不带 `:check`） | 文档过期 |
| EdgeView 覆盖度 | `npm run module:edgeview-coverage:check` | 对 WebView2 原生接口的封装覆盖率 | 覆盖声明与头文件不符（见"已知红项"） |
| EdgeView 文档 | `npm run module:edgeview-docs:check` | 模块随包中文文档有效 | 文档缺失或不可读 |
| 教程示例项目 | `npm run tutorial:edgeview:verify` | 12 集示例项目的清单/模型/源码一致性 | 示例项目损坏或与生成器不一致 |
| 悬空处理器审计 | `python check_handlers.py` | `.lcpp` 里 `&处理器` 引用是否都有 `事件 处理器()` 定义 | **F5 会被中文诊断阻断**，而 IDE 错误列表仍显示 (0) |
| 教程生成安全 | `bash regen_tutorials.sh` | 重跑生成器前先断言无 IDE 占用，并串起上面两项 | 直接跑生成器会串写损坏源码 |

`check_handlers.py` 与 `regen_tutorials.sh` 位于
`AI 视频自主生产/EdgeView 浏览器模块合集/`，是教程流水线专用门禁；其中
`regen_tutorials.sh` 已把 `check_handlers.py` 串进生成流程，因为这类缺陷**只靠 IDE 的
`错误列表` 计数发现不了**。

## 2026-09-06：两道覆盖面门禁变红的归因与写回

### 现象

`tests/modules.test.ts` 中两项同时失败：

- 全部内置方法的控件参数统一使用 controlRef、裸补全和明确运行时元数据
- 模块封装清单覆盖实际内置模块注册表

审计期望 `commands 3012 / parameters 5164`，实测 `3013 / 5165`；
`controlReferences 1263` 与 `modules 85` 未变。

### 归因过程（先查，再动）

1. `git diff HEAD` 列出 HEAD 之后新增的内置命令，共两条：

   | 命令 | 参数 | controlRef 数 | 是否已入账 |
   |---|---|---|---|
   | `EdgeView_等待事件控件` | 控件名 / 事件名 / 超时毫秒（3） | 1 | ✅ 已入账（3011→3012、1262→1263） |
   | `CEF3_取资源地址` | 相对路径（1） | 0 | ❌ **从未登记** |

2. 三项数值自洽：漏记那条正好贡献 +1 命令 / +1 参数；它不含 controlRef，故
   `controlReferences` 不变。

3. 排除本轮 EdgeView 改动的嫌疑：`edgeViewApiCatalog.ts` 的 `api()` 条数 **167 与 HEAD 相同**；
   改写描述文案后 `commandDigest` **完全不变** —— 证明摘要只按命令/参数身份计算，不含描述文本。

结论：增量来自并行的 CEF3 合集工作，与 EdgeView 教程改动无关。

### 写回内容

- `electron/tests/modules.test.ts` 审计基线：
  `commands 3013 / parameters 5165 / controlReferences 1263`，
  `commandDigest 52121769 → 653f9624`，`parameterDigest 1a9f941d → f9518491`；
  并在期望值上方写明增量归属，以及"再增删内置命令或其参数必须同步这两个摘要，
  否则覆盖面会无声缩小"。
- `docs/MODULE_ENCAPSULATION_CHECKLIST.md`：`85 个内置模块、3012 条中文命令` → `3013`。
  该数由 `BUILTIN_MODULES` **实算**得到（85 / 3013），不是照抄测试报错。

### 写回后的门禁状态

```
✔ 全部内置方法的控件参数统一使用 controlRef、裸补全和明确运行时元数据
✔ 模块封装清单覆盖实际内置模块注册表
tests/modules.test.ts：118 项，pass 110 / fail 8
```

剩余 8 项失败经核对与本次无关：controlRef 源文件数基线 50≠47、需本机未安装的 new_emoji
模块、FBro 四项（SDK 覆盖 / UI 工程 / HWND 承载 / 下载观察）、CEF3 事件目录、new_emoji 桥参数计数。

## 写回基线的规则

覆盖面门禁的基线是"账本"，不是"容忍度"。写回必须满足：

1. **先归因**：用 `git diff` 找到具体是哪条命令/参数造成增量，能逐项对上数字。
2. **实算再写**：计数由代码实际算出（如遍历 `BUILTIN_MODULES`），不得照抄断言报错里的数字。
3. **留注释**：在基线旁写明增量归属，让下一次变红可追溯。
4. **不降强度**：`violations` 仍须为空数组，摘要仍须逐字相等。
   本次写回是**补上漏记的账**，任何未登记的命令/参数增减今后仍会立刻让门禁变红。

## 新增内置命令时的正确流程

1. 在 `builtinModules.ts` / 对应 catalog 加 `contributes.commands` 与 `bindings.commands`。
2. `npm run module:control-ref-audit` → 若变红，按报错把新命令与参数计入基线，并写归属注释。
3. 重算并更新 `docs/MODULE_ENCAPSULATION_CHECKLIST.md` 的模块/命令计数行。
4. 涉及模块文档的命令族，跑对应 `module:*-docs:check` 与 `module:*-coverage:check`。
5. 若命令带控件参数，必须声明 `controlRef` 并保证补全插入裸名称（AGENTS.md 硬约束）。

## 已知红项（2026-09-06 实测，均为环境或既有问题）

| 门禁 | 现象 | 原因 | 处理建议 |
|---|---|---|---|
| `module:control-ref-migration-check` | 退出 1，列出 `src/wxmore-tool/MainWindow.lcpp` 多处 `控件名 -> missing` | 原型 `src/` 下的旧示例仍用带引号控件名；本次未触碰该文件 | 属历史源码迁移待办，需按 `module:control-ref-migration-check` 报告逐条迁移 |
| `module:edgeview-coverage:check` | `ENOENT … microsoft.web.webview2\1.0.3537.50\…\WebView2.h` | 脚本**硬编码** NuGet 版本 `1.0.3537.50`，本机只装了 `1.0.4078.44` | 让脚本从 `packages.config`/props 解析实际版本，或允许环境变量覆盖，避免因 SDK 小版本升级而门禁常红 |

这两项都不是靠调基线能解决的：前者是真实待迁移代码，后者是门禁自身对环境的假设过强。

## 相关记录

- 逐条缺陷与模块行为发现：`docs/FUTURE_OPTIMIZATIONS.md` §4–§6
- 本轮改动明细：`更新记录/2026-09-06.md`
- 教程成片与验收数据：`AI 视频自主生产/EdgeView 浏览器模块合集/成片交付总表.md`
