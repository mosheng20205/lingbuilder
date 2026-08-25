# 窗口"边框"属性设计（对齐易语言 7 值枚举）

- 日期：2026-08-16
- 状态：已确认（用户已批准以下全部决策）
- 范围：窗口设计器窗口级"边框"属性；覆盖设计器画布、属性面板、原生预览、F5 构建运行、C++/Visual Studio 工程导出全链路

## 背景与问题

当前窗口边框能力不完整：

- `LingWindowModel` 仅有 `resizable`、`maximizable` 两个布尔开关，属性面板只暴露"禁止拖拽调整大小""禁止窗口最大化"两个反向勾选框。
- 生成器（`lingCppWin32Project.ts` `Open()`、`nativeWin32Project.ts` 两处）基础样式硬编码 `WS_OVERLAPPEDWINDOW`，仅做减法（`&= ~WS_THICKFRAME`、`&= ~WS_MAXIMIZEBOX`）。
- 从未支持"无边框 = 无标题栏"（`WS_POPUP` 形态）、窄标题栏（`WS_EX_TOOLWINDOW`）、镜框式双边框（`WS_EX_DLGMODALFRAME`）。
- 用户需要对齐易语言的 7 值"边框"枚举。

## 已确认的用户决策

1. **枚举范围**：7 值完整对齐易语言（无边框、普通可调边框、普通固定边框、窄标题可调边框、窄标题固定边框、镜框式可调边框、镜框式固定边框）。
2. **无边框交互**：新增可选属性"无边框拖动移动"，默认关闭；开启后鼠标按住客户区即可拖动窗口（`WM_NCLBUTTONDOWN`/`HTCAPTION`）。
3. **旧开关处理**：枚举主导 + 保留"禁止最大化"开关；"禁止拖拽调整大小"复选框从属性面板移除（`resizable` 由枚举派生）；旧项目自动迁移。
4. **实现方案**：方案 A——独立 `borderStyle` 枚举字段 + 统一样式映射纯函数模块，所有链路消费同一映射。

## 1. 数据模型（`electron/src/services/windowDesigner/types.ts`）

```ts
export type LingWindowBorderStyle =
  | 'none'                  // 无边框（无标题栏）
  | 'normal-resizable'      // 普通可调边框（现状默认）
  | 'normal-fixed'          // 普通固定边框
  | 'thin-title-resizable'  // 窄标题可调边框
  | 'thin-title-fixed'      // 窄标题固定边框
  | 'frame-resizable'       // 镜框式可调边框
  | 'frame-fixed';          // 镜框式固定边框
```

`LingWindowModel` 新增字段：

- `borderStyle?: LingWindowBorderStyle`
- `borderlessDraggable?: boolean` —— 仅 `borderStyle === 'none'` 时生效，缺失默认 `false`

`resizable` 字段保留（生成器 spec 已消费），但值由枚举派生，不再是独立编辑入口：

- `'none'` / `'normal-fixed'` / `'thin-title-fixed'` / `'frame-fixed'` → `false`
- `'normal-resizable'` / `'thin-title-resizable'` / `'frame-resizable'` → `true`

## 2. 旧项目迁移（`windowDesignerService.ts` normalize 逻辑，约 740–787 行）

沿用现有 `appearanceChanged` 检测 + 字段回填模式：

| 旧数据 | 迁移结果 |
|---|---|
| 无 `borderStyle` 且 `resizable === false` | `'normal-fixed'` |
| 无 `borderStyle` 且其余情况（含 `resizable` 缺失） | `'normal-resizable'` |
| `borderlessDraggable` 缺失 | `false` |

迁移后 `resizable` 按第 1 节规则派生覆写；`maximizable` 迁移行为不变。

## 3. 统一样式映射模块（新文件 `electron/src/services/windowDesigner/windowBorderStyle.ts`，纯函数、无 React 依赖）

导出：

- `LING_WINDOW_BORDER_STYLE_OPTIONS: Array<{ value: LingWindowBorderStyle; label: string }>` —— UI 下拉与画布共用，label 为 7 个中文名。
- `resolveLingWindowBorder(borderStyle: LingWindowBorderStyle | undefined, maximizable: boolean)` → `{ dwStyle: string; dwExStyle: string; hasCaption: boolean; hasSizingBorder: boolean; captionKind: 'normal' | 'thin' | 'none' }`
  - `dwStyle`/`dwExStyle` 返回**宏表达式字符串**（保证生成 C++ 可读、可迁移），不是数字。

映射表：

| 枚举 | dwStyle | dwExStyle | captionKind | hasSizingBorder |
|---|---|---|---|---|
| `none` | `WS_POPUP \| WS_SYSMENU \| WS_MINIMIZEBOX` | `0` | `none` | `false` |
| `normal-resizable` | `WS_OVERLAPPEDWINDOW` | `0` | `normal` | `true` |
| `normal-fixed` | `WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME` | `0` | `normal` | `false` |
| `thin-title-resizable` | `WS_OVERLAPPEDWINDOW` | `WS_EX_TOOLWINDOW` | `thin` | `true` |
| `thin-title-fixed` | `WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME` | `WS_EX_TOOLWINDOW` | `thin` | `false` |
| `frame-resizable` | `WS_OVERLAPPEDWINDOW` | `WS_EX_DLGMODALFRAME` | `normal` | `true` |
| `frame-fixed` | `WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME` | `WS_EX_DLGMODALFRAME` | `normal` | `false` |

规则：

- `maximizable === false` → 从 `dwStyle` 去掉 `WS_MAXIMIZEBOX`（生成 `& ~WS_MAXIMIZEBOX`）。
- `borderStyle === 'none'` 时 `maximizable` 无意义：UI 禁用该开关，映射结果忽略它。
- `borderStyle` 缺失（未迁移的调用方）按 `'normal-resizable'` 处理，保持现状行为。
- 另导出 `deriveResizable(borderStyle)` 供 normalize 与生成器消费，保证三处派生规则永远一致。

## 4. 无边框拖动（仅 `borderlessDraggable === true` 且 `borderStyle === 'none'`）

生成的窗口 `WndProc` 注入：

```cpp
case WM_LBUTTONDOWN:
    SendMessageW(hwnd_, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    return 0;
```

- 生成的 WndProc 现有代码已存在多处 `WM_LBUTTONDOWN` 分支（控件 `MouseDown` 事件分发，见 `lingCppWin32Project.ts` 约 7619 行等），注入时必须与现有分支合并，不破坏控件 MouseDown 事件。
- 分发顺序统一为：命中控件 → 先走控件 `MouseDown` 事件；未命中任何子控件（鼠标在窗口空白客户区）→ 执行 `HTCAPTION` 拖动转发。实现上可在窗口 `WM_LBUTTONDOWN` 分支里先判断 `ChildWindowFromPoint` 结果是否为窗口自身。
- `new_emoji` 后端同理支持（其自绘框架按 `captionKind === 'none'` 隐藏标题栏并按该开关处理拖动）。

## 5. 属性面板 UI（`electron/src/components/WpfDesigner.tsx`）

- "当前窗口 / 外观"组新增 **"边框"** 下拉：7 个中文选项，默认"普通可调边框"，数据来自 `LING_WINDOW_BORDER_STYLE_OPTIONS`。
- 选中"无边框"时追加显示 **"允许拖动移动窗口"** 复选框（`borderlessDraggable`）。
- "当前窗口 / 状态"组：
  - **移除**"禁止拖拽调整大小"复选框（`resizable` 由枚举派生）。
  - 保留"禁止窗口最大化"（`borderStyle === 'none'` 时置灰禁用）。
- 切换边框时联动 `windowFrame`：固定类/无边框把 `resizeBorder` 归零（与现有 4707–4714 行逻辑一致），可调类恢复。

## 6. 设计器画布预览

画布标题栏渲染跟随映射结果（`captionKind`）：

- `none`：不渲染标题栏，客户区整体上移（`windowDesignerService.ts` 的 `DESIGNER_TITLE_BAR_HEIGHT` 偏移按 `hasCaption` 归零；菜单栏偏移保留）。
- `thin`：渲染矮标题栏（约为常规高度的 3/4）。
- `frame` 类（镜框式）：标题栏外加双边框描边示意。
- 窄标题/镜框式仅在画布做视觉示意；真实外观以原生预览/F5 结果为准。

## 7. 生成链路（全链路一致）

### 7.1 `lingCppWin32Project.ts`

- window spec 序列化（约 23243 行）增加 `borderStyle` 与 `borderlessDraggable` 序列化字段；生成的 C++ `WindowSpec` 结构体（约 7237 行 `bool resizable; bool maximizable;` 附近）增加对应枚举/布尔成员。
- `Open()`（约 8471–8523 行）：
  - `windowStyle` 计算改为消费 `resolveLingWindowBorder` 的 `dwStyle` 宏表达式，替换硬编码 `WS_OVERLAPPEDWINDOW` 与两个减法。
  - `CreateWindowExW` 第一个参数 `exStyle` 当前硬编码 `0`（8486 行），改为映射的 `dwExStyle`。
  - **尺寸换算无需大改**：`Open()` 已使用 `AdjustWindowRectForDpiValue(&rect, windowStyle, hasMenu, 0, dpi_)` 按实际样式精确换算客户区↔外框，`WS_POPUP` 无边框时自然返回零非客户区。
  - spec 高度序列化的 `window.height - TITLE_BAR_HEIGHT`（约 23243 行）改为按 `hasCaption` 决定扣减：`none` 扣 0，其余扣 `TITLE_BAR_HEIGHT`（窄标题/镜框式与普通一致，运行时由 `AdjustWindowRectForDpiValue` 精确计算，序列化侧只是近似扣减，保持两处链路口径一致即可）。
  - `ApplyWindowAppearance()`（8501 行）：`captionKind === 'none'` 时跳过标题栏颜色 DWM 设置（避免无效调用）。
- `WM_LBUTTONDOWN` 拖动注入见第 4 节。
- 窗口内嵌对话框/其他宿主（`AttachPropertyPage` 等）不受边框属性影响。

### 7.2 `nativeWin32Project.ts`

- 两处 `DWORD windowStyle = WS_OVERLAPPEDWINDOW;`（287、972 行附近）与 `if (!spec.resizable)...` 减法替换为同一映射；`CreateWindowExW` 的 `exStyle`（986 行附近）接入 `dwExStyle`。
- C++ 端 `WindowSpec`（约 184–185 行）与序列化（1150 行）同步增加字段，spec 高度扣减规则与 7.1 一致。

### 7.3 `visualStudioProjectExporter.ts`

已验证：该导出器只生成工程文件（vcxproj 等），不生成窗口创建代码，复用 `lingCppWin32Project.ts` 产物，**无需改动**。

### 7.4 new_emoji 后端

- `windowFrame` 契约增加边框语义：`captionKind === 'none'` 时自绘框架不渲染标题栏，`hasSizingBorder` 决定缩放边框宽度是否为 0。
- 后端专属"框架预设"（browserShell 等）与"边框"枚举并存时，`browserShell` 预设自动把 `borderStyle` 视为 `'normal-resizable'`（该预设语义即完整可调框架），UI 上切换预设时同步边框下拉值。

## 8. 文档同步（按 AGENTS.md）

- `更新记录/2026-08-16.md`：记录更新内容、影响范围、验证结果。
- `docs/FUTURE_OPTIMIZATIONS.md`：登记设计器持久化模型新增字段与迁移规则；如序列化侧近似扣减（`TITLE_BAR_HEIGHT`）将来要精确化，记为后续优化项。
- `LingBuilder AI 规则手册.md`：补充 AI 生成设计器项目时 `borderStyle`/`borderlessDraggable` 字段说明与合法枚举值（该手册由 `electron/server.ts` 注入 AI system prompt，需保持一致）。

## 9. 测试与验证

- `windowBorderStyle.ts` 单测：7 枚举 × `maximizable` 真/假的 `dwStyle`/`dwExStyle`/`captionKind`/`hasSizingBorder` 断言；缺失 `borderStyle` 回退断言。
- 迁移单测：无 `borderStyle` + `resizable=false` → `'normal-fixed'`；无 `borderStyle` 其他 → `'normal-resizable'`；`borderlessDraggable` 默认 `false`。
- 生成产物断言：无边框窗口生成的 C++ 含 `WS_POPUP`、不含 `WS_CAPTION` 路径；`borderlessDraggable=true` 含 `WM_NCLBUTTONDOWN` 注入；固定边框含 `& ~WS_THICKFRAME`。
- 命令验证：`cd electron && npm run lint`、`npm run test:lingcpp`、`npm run build`。
- 冒烟：构建一个无边框窗口项目 exe，运行确认无标题栏、拖动开关行为正确；一个普通固定边框项目确认不可调大小。

## 10. 明确不做（YAGNI）

- `.lcpp` 运行时命令（如 `窗口_设置边框`）：设计期属性先行，运行时 API 后续按需扩展（届时须同步 `LingBuilder AI 规则手册.md` 与模块 binding）。
- 最小化按钮独立控制：沿用现状（随 `WS_MINIMIZEBOX` 常开）。
- `resizable`/`maximizable` 从模型中删除：保留字段避免大规模序列化破坏，仅取消独立编辑入口。
