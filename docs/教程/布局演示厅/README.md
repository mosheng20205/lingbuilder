# 布局演示厅（layout-showcase）

LingBuilder 窗口布局系统四期能力的官方示例项目：**控件锚定、窗口级等比缩放、流式布局面板（FlowPanel）、表格布局面板（TablePanel）** 全部集成在一个可运行、可交互的双窗口项目里。

## 打开方式

1. 用 LingBuilder IDE 打开包含本仓库的工作区（解决方案树里找「布局演示厅」）。
2. 或把随附的 `布局演示厅.lcpppkg` 拖进 IDE / 在欢迎页「导入源码包」导入。
3. 选中项目按 F5 构建运行。

## 窗口一：布局演示厅（主窗口）

- **流式布局面板（FlowPanel）**：左侧面板内 6 个按钮按树内顺序横向排列、放满自动换行（方向/间距/内边距可调）。
- **表格布局面板（TablePanel）**：右侧表单按「列 100 | * | 90」三列布局，`*` 星号列随面板宽度拉伸，`auto` 行按内容自适应。
- **控件锚定**：
  - 日志框与锚定说明 = `left,top,right`（随窗口变宽）；
  - 右下「打开等比缩放窗口」按钮 = `right,bottom`（贴角跟随，拉伸后仍可点中）；
  - 面板本体无锚定（固定不动，面板内子控件由面板布局接管）。
- **交互**：点击面板内按钮会向日志框追加一条记录（验证面板子控件的事件链与自绘渲染）。

## 窗口二：等比缩放仪表盘

窗口属性 `scaleContentWithWindow = 真`：拖拽窗口边缘，全部控件（含文字、卡片、进度条）按 `min(宽比, 高比)` 整体等比缩放；该窗口内控件锚定被忽略（两套布局互斥）。「关闭本窗口」演示 `窗口_关闭自身` 命令。

## 验收

`electron/scripts/verify-layout-showcase.ts` 是本示例的长期验收脚本（MSVC x64+Win32 双编译 + 程序化拉伸探针：流式换行/星号列/锚定增量像素级断言、BM_CLICK 打开等比窗口、等比因子逐控件比值断言）：

```bash
cd electron && npx tsx scripts/verify-layout-showcase.ts
```

## 源码结构

- `src/layout-showcase/MainWindow.lcpp` / `ScaleDashboard.lcpp` —— 窗口事件代码（绑定源码 = 窗口类名）。
- `.lingbuilder/projects/layout-showcase/window-designer.json` —— 设计器模型（双窗口、锚定属性、面板参数、表格格位）。
