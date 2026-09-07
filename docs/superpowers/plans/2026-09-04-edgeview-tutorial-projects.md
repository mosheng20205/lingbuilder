# EdgeView 教程示例项目 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 EdgeView 合集 01～12 生成可直接录制的独立 LingBuilder 项目、测试素材和验证文档。

**Architecture:** 用一个确定性 TypeScript 生成器输出 12 个同构项目目录；每集源码只保留该口播的主线命令，测试页和测试文件作为项目 assets 随项目复制。统一验证器读取这些项目，通过现有 Win32 生成器做静态阻断诊断和构建存活检查。

**Tech Stack:** TypeScript/tsx、LingBuilder `.lcpp`、Win32 window-designer JSON、WebView2 EdgeView 1.2.0、Node 内置 `fs`/`child_process`。

**Spec:** `docs/superpowers/specs/2026-09-04-edgeview-tutorial-projects-design.md`

## Global Constraints

- 每集项目必须位于 `AI 视频自主生产/EdgeView 浏览器模块合集/NN/示例项目/`，且可独立复制。
- 控件参数使用裸 `controlRef`；处理器参数使用 `&处理器名`。
- 只使用 `lingbuilder.win32.basic`、`lingbuilder.win32.common-controls`、`lingbuilder.edgeview` 及文档中登记的命令。
- 测试数据必须是本地、虚构、可脱敏的；不得写入真实账号、Cookie、代理密码或私钥。
- 完成后更新 `更新记录/2026-09-04.md`，并记录构建/运行验证结果。

### Task 1: 生成器与项目模板

**Files:**
- Create: `electron/scripts/generate-edgeview-tutorial-projects.ts`
- Create: `AI 视频自主生产/EdgeView 浏览器模块合集/NN/示例项目/**`（12 集生成输出）

- [ ] 写入 12 集的 solution、project-modules、window-designer、config、MainWindow.lcpp、README 和本地测试资源。
- [ ] 对每个项目使用真实 API 签名和 `controlRef`/`&处理器` 语义。
- [ ] 复用第 8 集现有响应 Demo 的同步响应和受管句柄生命周期模式。
- [ ] 运行生成器并检查所有输出路径均位于对应 `示例项目` 目录。

### Task 2: 统一验证脚本

**Files:**
- Create: `electron/scripts/verify-edgeview-tutorial-projects.ts`

- [ ] 逐集解析 JSON、检查模块版本、窗口控件和关键命令。
- [ ] 调用 `generateLingCppNativeWin32Project`，失败时打印项目 ID 和阻断诊断。
- [ ] 在 Windows 工具链可用时导出并构建至少一个代表项目；对全部项目执行源码/模型静态门禁。

### Task 3: 录制文档与更新记录

**Files:**
- Create: `AI 视频自主生产/EdgeView 浏览器模块合集/NN/录制准备.md`
- Create: `AI 视频自主生产/EdgeView 浏览器模块合集/NN/验证记录.md`
- Modify: `更新记录/2026-09-04.md`

- [ ] 每集记录入口路径、建议视口、镜头对应控件/代码、重置步骤、安全边界和失败回退。
- [ ] 记录静态验证、构建、运行存活时间、未执行的外部环境项。
- [ ] 在更新记录中汇总 12 集产物和验证命令。

### Task 4: 回归检查

- [ ] Run: `npm run lint -w lingbuilder-electron`
- [ ] Run: `npm run build:server -w lingbuilder-electron`
- [ ] Run: `npx tsx electron/scripts/verify-edgeview-tutorial-projects.ts`
- [ ] Run: `git diff --check`

