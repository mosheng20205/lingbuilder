# 窗口"边框"属性（易语言 7 值枚举）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为窗口设计器新增对齐易语言的 7 值"边框"属性（无边框=无标题栏、普通可调/固定、窄标题可调/固定、镜框式可调/固定），并让设计器画布、属性面板、原生预览、F5 构建与 C++ 导出全链路行为一致。

**Architecture:** `LingWindowModel` 新增 `borderStyle`/`borderlessDraggable` 字段；新建纯函数模块 `windowBorderStyle.ts` 作为"枚举 → Win32 样式"唯一映射来源（TS 断言 + 生成 C++ 辅助函数代码）；两个 Win32 生成器（`lingCppWin32Project.ts`、`nativeWin32Project.ts`）的 C++ `WindowSpec` 增加字段并运行时消费映射；`resizable` 由枚举派生，不再是独立编辑入口。

**Tech Stack:** TypeScript (Electron 渲染层与服务层)、生成的 C++/Win32 代码、node:test 测试框架（`node --import tsx --test`）。

**设计规格:** `docs/superpowers/specs/2026-08-16-window-border-style-design.md`

**背景事实（已验证的代码位置）:**

- C++ 枚举值映射（与易语言编号一致）：`0=none, 1=normal-resizable, 2=normal-fixed, 3=thin-title-resizable, 4=thin-title-fixed, 5=frame-resizable, 6=frame-fixed`
- `lingCppWin32Project.ts`：C++ `WindowSpec` 结构体约 7222–7250 行；`Open()` 约 8471–8523 行（8473 行硬编码 `WS_OVERLAPPEDWINDOW`，8486 行 `CreateWindowExW` exStyle 硬编码 `0`）；`ApplyWindowAppearance()` 18452–18482 行；主窗口消息入口 `OnMessage` 的 switch 约 20221 行；`generateWindowSpec` 序列化约 23212–23244 行；`TITLE_BAR_HEIGHT = 28` 在 159 行。
- `nativeWin32Project.ts`：C++ `WindowSpec` 约 166–186 行；`GetWindowRectForSpec` 约 280–292 行（第三参数硬编码 `TRUE`，第四参数 exStyle 为 `0`）；`OpenGeneratedWindow` 约 964–1010 行；`GeneratedWindowProc` 约 759 行；序列化约 1150 行；`TITLE_BAR_HEIGHT = 28` 在 24 行。
- `windowDesignerService.ts`：常量区 32–46 行；`normalizeLingWindowFrame` 78–102 行；`getDesignerWindowContentOffset` 182–184 行；`createBlankWindow` 313 行起（328–329 行有 `resizable: true, maximizable: true`）；normalize 迁移块 758–787 行。
- `WpfDesigner.tsx`：画布标题栏 div 约 2680–2706 行；new_emoji 框架预设切换约 4660–4678 行；"禁止拖拽调整大小"复选框约 4701–4719 行；"禁止窗口最大化"约 4720–4728 行；外观组（窗口圆角下拉等）约 4598–4614 行。
- 测试：`electron/tests/windowDesigner.test.ts` 已存在并已导入 `normalizeWindowDesignerState`、`generateLingCppNativeWin32Project`、`generateNativeWin32Project`、`LingWindowModel` 等符号；测试命令为 `node --import tsx --test <files>`（见 package.json `test:lingcpp`）。
- `electron/src/services/windowDesigner/types.ts`：`LingWindowModel` 定义 84–126 行。

---

### Task 1: 类型定义与统一样式映射模块

**Files:**
- Modify: `electron/src/services/windowDesigner/types.ts`
- Create: `electron/src/services/windowDesigner/windowBorderStyle.ts`
- Create: `electron/tests/windowBorderStyle.test.ts`

- [ ] **Step 1: types.ts 新增类型与字段**

在 `types.ts` 中 `LingWindowFrame` 接口（29–41 行）之后、`LingControl` 之前插入：

```ts
export type LingWindowBorderStyle =
  | 'none'
  | 'normal-resizable'
  | 'normal-fixed'
  | 'thin-title-resizable'
  | 'thin-title-fixed'
  | 'frame-resizable'
  | 'frame-fixed';
```

在 `LingWindowModel` 的 `maximizable?: boolean;`（约 108 行）与 `windowFrame?: LingWindowFrame;`（约 110 行）之间插入：

```ts
  /** 窗口边框样式；缺失时由迁移规则确定（resizable=false → 普通固定边框，否则普通可调边框）。 */
  borderStyle?: LingWindowBorderStyle;
  /** 无边框窗口是否允许按住客户区拖动移动；仅 borderStyle 为 none 时生效，默认 false。 */
  borderlessDraggable?: boolean;
```

- [ ] **Step 2: 编写失败测试**

创建 `electron/tests/windowBorderStyle.test.ts`：

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LING_WINDOW_BORDER_STYLE_OPTIONS,
  deriveLingWindowBorderStyle,
  generateWindowBorderHelperCpp,
  normalizeLingWindowBorderStyle,
  resolveLingWindowBorder,
  toWindowBorderCxxValue
} from '../src/services/windowDesigner/windowBorderStyle';

test('边框枚举选项与易语言 7 值一致', () => {
  assert.deepEqual(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.label), [
    '无边框', '普通可调边框', '普通固定边框', '窄标题可调边框', '窄标题固定边框', '镜框式可调边框', '镜框式固定边框'
  ]);
  assert.deepEqual(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.value), [
    'none', 'normal-resizable', 'normal-fixed', 'thin-title-resizable', 'thin-title-fixed', 'frame-resizable', 'frame-fixed'
  ]);
});

test('resolveLingWindowBorder 返回 Win32 宏表达式', () => {
  assert.equal(resolveLingWindowBorder('none', true).dwStyle, 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX');
  assert.equal(resolveLingWindowBorder('none', true).dwExStyle, '0');
  assert.equal(resolveLingWindowBorder('none', true).hasCaption, false);
  assert.equal(resolveLingWindowBorder('normal-resizable', true).dwStyle, 'WS_OVERLAPPEDWINDOW');
  assert.equal(resolveLingWindowBorder('normal-fixed', true).dwStyle, '(WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME)');
  assert.equal(resolveLingWindowBorder('thin-title-resizable', true).dwExStyle, 'WS_EX_TOOLWINDOW');
  assert.equal(resolveLingWindowBorder('thin-title-resizable', true).captionKind, 'thin');
  assert.equal(resolveLingWindowBorder('thin-title-fixed', true).dwExStyle, 'WS_EX_TOOLWINDOW');
  assert.equal(resolveLingWindowBorder('frame-resizable', true).dwExStyle, 'WS_EX_DLGMODALFRAME');
  assert.equal(resolveLingWindowBorder('frame-fixed', true).dwExStyle, 'WS_EX_DLGMODALFRAME');
  assert.equal(resolveLingWindowBorder('normal-resizable', false).dwStyle, '(WS_OVERLAPPEDWINDOW & ~WS_MAXIMIZEBOX)');
  assert.equal(resolveLingWindowBorder('none', false).dwStyle, 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX');
  assert.equal(resolveLingWindowBorder(undefined, true).dwStyle, 'WS_OVERLAPPEDWINDOW');
});

test('deriveLingWindowBorderStyle 按枚举派生 resizable', () => {
  assert.equal(deriveLingWindowBorderStyle('none'), false);
  assert.equal(deriveLingWindowBorderStyle('normal-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('normal-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle('thin-title-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('thin-title-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle('frame-resizable'), true);
  assert.equal(deriveLingWindowBorderStyle('frame-fixed'), false);
  assert.equal(deriveLingWindowBorderStyle(undefined), true);
});

test('normalizeLingWindowBorderStyle 迁移旧项目', () => {
  assert.equal(normalizeLingWindowBorderStyle(undefined, false), 'normal-fixed');
  assert.equal(normalizeLingWindowBorderStyle(undefined, true), 'normal-resizable');
  assert.equal(normalizeLingWindowBorderStyle(undefined, undefined), 'normal-resizable');
  assert.equal(normalizeLingWindowBorderStyle('none', false), 'none');
});

test('toWindowBorderCxxValue 对齐易语言编号', () => {
  assert.equal(toWindowBorderCxxValue('none'), 0);
  assert.equal(toWindowBorderCxxValue('normal-resizable'), 1);
  assert.equal(toWindowBorderCxxValue('normal-fixed'), 2);
  assert.equal(toWindowBorderCxxValue('thin-title-resizable'), 3);
  assert.equal(toWindowBorderCxxValue('thin-title-fixed'), 4);
  assert.equal(toWindowBorderCxxValue('frame-resizable'), 5);
  assert.equal(toWindowBorderCxxValue('frame-fixed'), 6);
});

test('generateWindowBorderHelperCpp 生成 C++ 辅助函数', () => {
  const code = generateWindowBorderHelperCpp();
  assert.ok(code.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(code.includes('LB_WindowBorderStyleToDwExStyle'));
  assert.ok(code.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(code.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));
  assert.ok(code.includes('WS_EX_TOOLWINDOW'));
  assert.ok(code.includes('WS_EX_DLGMODALFRAME'));
});
```

- [ ] **Step 3: 运行测试确认失败**

```
cd electron
node --import tsx --test tests/windowBorderStyle.test.ts
```

预期：FAIL，报模块 `../src/services/windowDesigner/windowBorderStyle` 不存在。

- [ ] **Step 4: 实现映射模块**

创建 `electron/src/services/windowDesigner/windowBorderStyle.ts`：

```ts
import type { LingWindowBorderStyle } from './types';

export interface LingWindowBorderOption {
  value: LingWindowBorderStyle;
  label: string;
}

export const LING_WINDOW_BORDER_STYLE_OPTIONS: LingWindowBorderOption[] = [
  { value: 'none', label: '无边框' },
  { value: 'normal-resizable', label: '普通可调边框' },
  { value: 'normal-fixed', label: '普通固定边框' },
  { value: 'thin-title-resizable', label: '窄标题可调边框' },
  { value: 'thin-title-fixed', label: '窄标题固定边框' },
  { value: 'frame-resizable', label: '镜框式可调边框' },
  { value: 'frame-fixed', label: '镜框式固定边框' }
];

const LING_WINDOW_BORDER_STYLE_VALUES = new Set<string>(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.value));

export function isLingWindowBorderStyle(value: unknown): value is LingWindowBorderStyle {
  return typeof value === 'string' && LING_WINDOW_BORDER_STYLE_VALUES.has(value);
}

/** 旧项目迁移：无 borderStyle 时按旧 resizable 布尔值确定，保持现状行为。 */
export function normalizeLingWindowBorderStyle(
  borderStyle: LingWindowBorderStyle | undefined,
  legacyResizable: boolean | undefined
): LingWindowBorderStyle {
  if (isLingWindowBorderStyle(borderStyle)) return borderStyle;
  return legacyResizable === false ? 'normal-fixed' : 'normal-resizable';
}

/** resizable 布尔值由边框枚举派生：固定类与无边框不可拖拽调整大小。 */
export function deriveLingWindowBorderStyle(borderStyle: LingWindowBorderStyle | undefined): boolean {
  if (!borderStyle || borderStyle === 'normal-resizable' || borderStyle === 'thin-title-resizable' || borderStyle === 'frame-resizable') return true;
  return false;
}

/** C++ 端枚举编号，与易语言边框编号 0–6 一致。 */
export function toWindowBorderCxxValue(borderStyle: LingWindowBorderStyle | undefined): number {
  const index = LING_WINDOW_BORDER_STYLE_OPTIONS.findIndex(option => option.value === borderStyle);
  return index >= 0 ? index : 1;
}

export interface ResolvedLingWindowBorder {
  /** 可直接嵌入生成 C++ 的样式宏表达式。 */
  dwStyle: string;
  dwExStyle: string;
  hasCaption: boolean;
  hasSizingBorder: boolean;
  captionKind: 'normal' | 'thin' | 'none';
}

/** 枚举 → Win32 样式的唯一确定性映射；生成器、画布、测试全部消费本函数。 */
export function resolveLingWindowBorder(
  borderStyle: LingWindowBorderStyle | undefined,
  maximizable: boolean
): ResolvedLingWindowBorder {
  const style = borderStyle || 'normal-resizable';
  const resizable = style === 'normal-resizable' || style === 'thin-title-resizable' || style === 'frame-resizable';
  let dwStyle = resizable ? 'WS_OVERLAPPEDWINDOW' : '(WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME)';
  let dwExStyle = '0';
  let captionKind: ResolvedLingWindowBorder['captionKind'] = 'normal';
  if (style === 'none') {
    dwStyle = 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX';
    captionKind = 'none';
  } else if (style === 'thin-title-resizable' || style === 'thin-title-fixed') {
    dwExStyle = 'WS_EX_TOOLWINDOW';
    captionKind = 'thin';
  } else if (style === 'frame-resizable' || style === 'frame-fixed') {
    dwExStyle = 'WS_EX_DLGMODALFRAME';
  }
  if (maximizable === false && style !== 'none') {
    dwStyle = dwStyle === 'WS_OVERLAPPEDWINDOW' ? '(WS_OVERLAPPEDWINDOW & ~WS_MAXIMIZEBOX)' : `(${dwStyle} & ~WS_MAXIMIZEBOX)`;
  }
  return {
    dwStyle,
    dwExStyle,
    hasCaption: captionKind !== 'none',
    hasSizingBorder: resizable,
    captionKind
  };
}

/** 生成 C++ 运行时辅助函数：WindowSpec 存枚举编号，运行时按编号计算样式位。 */
export function generateWindowBorderHelperCpp(): string {
  return `static DWORD LB_WindowBorderStyleToDwStyle(int borderStyle, bool maximizable) {
    DWORD style = WS_OVERLAPPEDWINDOW;
    switch (borderStyle) {
    case 0: style = WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX; break;
    case 2: case 4: case 6: style = WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME; break;
    default: style = WS_OVERLAPPEDWINDOW; break;
    }
    if (borderStyle != 0 && !maximizable) style &= ~WS_MAXIMIZEBOX;
    return style;
}

static DWORD LB_WindowBorderStyleToDwExStyle(int borderStyle) {
    if (borderStyle == 3 || borderStyle == 4) return WS_EX_TOOLWINDOW;
    if (borderStyle == 5 || borderStyle == 6) return WS_EX_DLGMODALFRAME;
    return 0;
}`;
}
```

- [ ] **Step 5: 运行测试确认通过**

```
node --import tsx --test tests/windowBorderStyle.test.ts
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```
git add electron/src/services/windowDesigner/types.ts electron/src/services/windowDesigner/windowBorderStyle.ts electron/tests/windowBorderStyle.test.ts
git commit -m "feat(designer): 新增窗口边框样式类型与统一样式映射模块"
```

---

### Task 2: 旧项目迁移与派生逻辑接入服务层

**Files:**
- Modify: `electron/src/services/windowDesigner/windowDesignerService.ts`
- Modify: `electron/tests/windowDesigner.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `electron/tests/windowDesigner.test.ts` 中追加（放在文件末尾的既有 test 块之后；`normalizeWindowDesignerState`、`createBlankWindow`、`getDesignerWindowContentOffset` 已在文件头部 import，需补充 `createBlankWindow`、`getDesignerWindowContentOffset` 到现有 import 列表）：

```ts
test('窗口边框样式：旧项目按 resizable 迁移并可派生', () => {
  const legacyFixedWindow: LingWindowModel = {
    ...createBlankWindow(0),
    resizable: false
  };
  const legacyResizableWindow: LingWindowModel = {
    ...createBlankWindow(1),
    resizable: true
  };
  const migratedFixed = normalizeWindowDesignerState({ project: { id: 'p1', name: 'P1', windows: [legacyFixedWindow] }, activeWindowId: legacyFixedWindow.id, selectedControlId: null });
  const migratedResizable = normalizeWindowDesignerState({ project: { id: 'p2', name: 'P2', windows: [legacyResizableWindow] }, activeWindowId: legacyResizableWindow.id, selectedControlId: null });
  assert.equal(migratedFixed.project.windows[0].borderStyle, 'normal-fixed');
  assert.equal(migratedFixed.project.windows[0].resizable, false);
  assert.equal(migratedResizable.project.windows[0].borderStyle, 'normal-resizable');
  assert.equal(migratedResizable.project.windows[0].resizable, true);

  const migratedNone = normalizeWindowDesignerState({ project: { id: 'p3', name: 'P3', windows: [{ ...createBlankWindow(0), borderStyle: 'none', borderlessDraggable: true }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(migratedNone.project.windows[0].borderStyle, 'none');
  assert.equal(migratedNone.project.windows[0].borderlessDraggable, true);
  assert.equal(migratedNone.project.windows[0].resizable, false);

  const migratedThinFixed = normalizeWindowDesignerState({ project: { id: 'p4', name: 'P4', windows: [{ ...createBlankWindow(0), borderStyle: 'thin-title-fixed', resizable: true }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(migratedThinFixed.project.windows[0].resizable, false);
});

test('窗口边框样式：新建窗口默认普通可调边框，无边框时画布内容偏移不含标题栏', () => {
  const blank = createBlankWindow(0);
  assert.equal(blank.borderStyle, 'normal-resizable');
  assert.equal(blank.borderlessDraggable, false);
  assert.ok(getDesignerWindowContentOffset({ ...blank, menuItems: '' }) >= 28);
  assert.equal(getDesignerWindowContentOffset({ ...blank, borderStyle: 'none', menuItems: '' }), 0);
  assert.ok(getDesignerWindowContentOffset({ ...blank, borderStyle: 'none', menuItems: '文件, 编辑' }) > 0);
});
```

注意：若 `normalizeWindowDesignerState` 对 `activeWindowId` 为空串或窗口 id 匹配有其他约束，按现有测试的构造方式调整（可参考同文件中已有的 `normalizeWindowDesignerState` 用例）。

- [ ] **Step 2: 运行测试确认失败**

```
cd electron
node --import tsx --test tests/windowDesigner.test.ts
```

预期：新增两个测试 FAIL（`borderStyle` 为 undefined、`getDesignerWindowContentOffset` 忽略 borderStyle）。

- [ ] **Step 3: 实现服务层改动**

`windowDesignerService.ts`：

3a. 文件头部 import 区（`./types` 的 import 中）补充：

```ts
import {
  deriveLingWindowBorderStyle,
  normalizeLingWindowBorderStyle
} from './windowBorderStyle';
```

3b. `getDesignerWindowContentOffset`（182–184 行）替换为：

```ts
export function getDesignerWindowContentOffset(window: Pick<LingWindowModel, 'menuItems' | 'borderStyle'>): number {
  const titleBarHeight = window.borderStyle === 'none' ? 0 : DESIGNER_TITLE_BAR_HEIGHT;
  return titleBarHeight + (hasDesignerWindowMenu(window) ? DESIGNER_MENU_BAR_HEIGHT : 0);
}
```

3c. `createBlankWindow`（313 行起）在 `resizable: true,` 与 `maximizable: true,` 附近补加：

```ts
  borderStyle: 'normal-resizable',
  borderlessDraggable: false,
```

3d. normalize 迁移块（758–787 行）：

将 760 行

```ts
    const normalizedWindowFrame = normalizeLingWindowFrame(window.windowFrame, window.resizable !== false, window.cornerStyle);
```

替换为

```ts
    const normalizedBorderStyle = normalizeLingWindowBorderStyle(window.borderStyle, window.resizable);
    const derivedResizable = deriveLingWindowBorderStyle(normalizedBorderStyle);
    const normalizedWindowFrame = normalizeLingWindowFrame(window.windowFrame, derivedResizable, window.cornerStyle);
```

在 761–766 行 `appearanceChanged` 条件中追加两项：

```ts
      || window.borderStyle !== normalizedBorderStyle
      || (window.borderlessDraggable === true) !== (normalizedBorderStyle === 'none' && window.borderlessDraggable === true)
```

在 783–784 行回填对象中，把 `resizable: window.resizable !== false,` 替换并补加两个字段：

```ts
      borderStyle: normalizedBorderStyle,
      borderlessDraggable: normalizedBorderStyle === 'none' && window.borderlessDraggable === true,
      resizable: derivedResizable,
      maximizable: window.maximizable !== false,
```

- [ ] **Step 4: 运行测试确认通过**

```
node --import tsx --test tests/windowDesigner.test.ts
```

预期：全部 PASS（既有断言默认 `borderStyle='normal-resizable'` 派生 `resizable=true`，与旧行为一致）。

- [ ] **Step 5: 提交**

```
git add electron/src/services/windowDesigner/windowDesignerService.ts electron/tests/windowDesigner.test.ts
git commit -m "feat(designer): 窗口边框样式旧项目迁移与 resizable 派生"
```

---

### Task 3: lingCppWin32Project.ts 生成器接入边框样式

**Files:**
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`
- Modify: `electron/tests/windowDesigner.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `electron/tests/windowDesigner.test.ts` 追加（`generateLingCppNativeWin32Project` 已在头部 import；窗口/项目构造参考同文件既有用例，最小项目即可）：

```ts
test('lingCpp 生成器：边框样式进入 WindowSpec 与 C++ 样式辅助函数', () => {
  const baseWindow: LingWindowModel = {
    ...createBlankWindow(0),
    controls: []
  };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'bp', name: '边框项目', windows: [window] });
  const result = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'none', borderlessDraggable: true }));
  const mainCpp = result.files.find(file => file.relativePath.endsWith('.cpp'))!;
  assert.ok(mainCpp.content.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(mainCpp.content.includes('LB_WindowBorderStyleToDwExStyle'));
  assert.ok(mainCpp.content.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(mainCpp.content.includes('WM_NCLBUTTONDOWN, HTCAPTION'));
  assert.ok(!mainCpp.content.includes('setAttribute(hwnd_, captionColor'));

  const fixedResult = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'normal-fixed' }));
  const fixedCpp = fixedResult.files.find(file => file.relativePath.endsWith('.cpp'))!;
  assert.ok(fixedCpp.content.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));

  const thinResult = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'thin-title-fixed' }));
  const thinCpp = thinResult.files.find(file => file.relativePath.endsWith('.cpp'))!;
  assert.ok(thinCpp.content.includes('WS_EX_TOOLWINDOW'));

  const defaultResult = generateLingCppNativeWin32Project(projectOf({ ...baseWindow }));
  const defaultSpec = defaultResult.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  assert.ok(defaultSpec.includes('static WindowSpec g_windows'));
});
```

注：`setAttribute(hwnd_, captionColor` 的否定断言仅针对无边框窗口——若生成代码中该调用恒定存在（模板静态代码），则改为断言存在 `if (spec_.borderStyle != 0)` 守卫包裹 `captionColor` 调用。执行时按实际生成结构调整断言到"无边框守卫存在"。

- [ ] **Step 2: 运行测试确认失败**

```
cd electron
node --import tsx --test tests/windowDesigner.test.ts
```

预期：新测试 FAIL（生成的 C++ 不含 `LB_WindowBorderStyleToDwStyle` 等）。

- [ ] **Step 3: 实现生成器改动**

`lingCppWin32Project.ts`：

3a. 文件头部 import（`./types` import 之后任意合适位置）：

```ts
import { generateWindowBorderHelperCpp, resolveLingWindowBorder, toWindowBorderCxxValue } from './windowBorderStyle';
```

3b. C++ `WindowSpec` 结构体（约 7237–7238 行）：

```cpp
    bool resizable;
    bool maximizable;
```

替换为：

```cpp
    bool resizable;
    bool maximizable;
    int borderStyle;
    bool borderlessDraggable;
```

3c. 在 `WindowSpec` 结构体定义结束（`const wchar_t* events;` 与 `};` 之后、`WM_LINGBUILDER_VIDEO_EVENT` 常量之前）注入辅助函数。找到生成 C++ 骨架中该结构体的模板字符串位置，插入：

```ts
${generateWindowBorderHelperCpp()}
```

（即在模板中 `};` 之后独立成行。）

3d. `Open()`（约 8473–8475 行）：

```cpp
        DWORD windowStyle = WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
        if (!spec_.resizable) windowStyle &= ~WS_THICKFRAME;
        if (!spec_.maximizable) windowStyle &= ~WS_MAXIMIZEBOX;
```

替换为：

```cpp
        DWORD windowStyle = LB_WindowBorderStyleToDwStyle(spec_.borderStyle, spec_.maximizable) | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
        DWORD windowExStyle = LB_WindowBorderStyleToDwExStyle(spec_.borderStyle);
```

8485–8489 行 `CreateWindowExW(` 第一个参数 `0,` 替换为 `windowExStyle,`。

3e. `ApplyWindowAppearance()`（18452 行函数体开头 `if (!hwnd_) return;` 之后）加守卫。将

```cpp
            setAttribute(hwnd_, useImmersiveDarkMode, &dark, sizeof(dark));
            setAttribute(hwnd_, captionColor, &spec_.titleBarBackground, sizeof(spec_.titleBarBackground));
            setAttribute(hwnd_, textColor, &spec_.titleBarForeground, sizeof(spec_.titleBarForeground));
```

替换为：

```cpp
            setAttribute(hwnd_, useImmersiveDarkMode, &dark, sizeof(dark));
            if (spec_.borderStyle != 0) {
                setAttribute(hwnd_, captionColor, &spec_.titleBarBackground, sizeof(spec_.titleBarBackground));
                setAttribute(hwnd_, textColor, &spec_.titleBarForeground, sizeof(spec_.titleBarForeground));
            }
```

3f. `OnMessage` 的 switch（约 20221 行 `switch (message) {` 之后、首个 `${aria2Runtime ...}` case 之前）注入拖动分支：

```cpp
        case WM_LBUTTONDOWN: {
            if (spec_.borderStyle == 0 && spec_.borderlessDraggable) {
                POINT cursor = { static_cast<int>(static_cast<short>(LOWORD(lParam))), static_cast<int>(static_cast<short>(HIWORD(lParam))) };
                HWND child = ChildWindowFromPoint(hwnd_, cursor);
                if (child == nullptr || child == hwnd_) {
                    ReleaseCapture();
                    SendMessageW(hwnd_, WM_NCLBUTTONDOWN, HTCAPTION, 0);
                    return 0;
                }
            }
            break;
        }
```

注：这是窗口级 `OnMessage`；子控件消息走各自的子类化过程，不会进入此分支，因此控件 `MouseDown` 事件不受影响。`ChildWindowFromPoint` 命中子控件时 `break` 走默认处理。

3g. `generateWindowSpec` 序列化（约 23212–23244 行）。在函数体 `const iconStyle = ...` 附近加：

```ts
  const borderStyleCxx = toWindowBorderCxxValue(window.borderStyle);
  const hasCaption = resolveLingWindowBorder(window.borderStyle, window.maximizable !== false).hasCaption;
```

23243 行返回模板中，把 `${window.resizable !== false}, ${window.maximizable !== false},` 替换为：

```
${window.resizable !== false}, ${window.maximizable !== false}, ${borderStyleCxx}, ${window.borderlessDraggable === true}, 
```

并把该行中的 `${Math.max(220, int(window.height - TITLE_BAR_HEIGHT))}` 替换为：

```
${Math.max(220, int(window.height - (hasCaption ? TITLE_BAR_HEIGHT : 0)))}
```

- [ ] **Step 4: 运行测试确认通过**

```
node --import tsx --test tests/windowDesigner.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```
git add electron/src/services/windowDesigner/lingCppWin32Project.ts electron/tests/windowDesigner.test.ts
git commit -m "feat(win32): lingCpp 生成器支持 7 值窗口边框样式与无边框拖动"
```

---

### Task 4: nativeWin32Project.ts 生成器接入边框样式

**Files:**
- Modify: `electron/src/services/windowDesigner/nativeWin32Project.ts`
- Modify: `electron/tests/windowDesigner.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `electron/tests/windowDesigner.test.ts` 追加（`generateNativeWin32Project` 已在头部 import；参数签名参考同文件既有用例）：

```ts
test('native 生成器：边框样式映射到窗口样式与拖动', () => {
  const baseWindow: LingWindowModel = { ...createBlankWindow(0), controls: [] };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'np', name: '边框项目', windows: [window] });
  const result = generateNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'none', borderlessDraggable: true }));
  const cpp = result.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  assert.ok(cpp.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(cpp.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(cpp.includes('WM_NCLBUTTONDOWN, HTCAPTION'));

  const fixed = generateNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'normal-fixed' }));
  assert.ok(fixed.files.find(file => file.relativePath.endsWith('.cpp'))!.content.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));
});
```

注：`generateNativeWin32Project` 的具体参数与返回结构（`files` 字段名）以同文件既有用例为准，如返回结构不同（例如直接返回 `{ mainCpp }`），按实际结构调整断言。

- [ ] **Step 2: 运行测试确认失败**

```
cd electron
node --import tsx --test tests/windowDesigner.test.ts
```

预期：新测试 FAIL。

- [ ] **Step 3: 实现生成器改动**

`nativeWin32Project.ts`：

3a. 头部 import：

```ts
import { generateWindowBorderHelperCpp, resolveLingWindowBorder, toWindowBorderCxxValue } from './windowBorderStyle';
```

3b. C++ `WindowSpec`（约 184–185 行）：

```cpp
    bool resizable;
    bool maximizable;
```

替换为：

```cpp
    bool resizable;
    bool maximizable;
    int borderStyle;
    bool borderlessDraggable;
```

3c. 在 `WindowSpec` 定义 `};` 之后（`struct RuntimeControl` 之前）的模板中注入一行：

```ts
${generateWindowBorderHelperCpp()}
```

3d. `GetWindowRectForSpec`（约 280–292 行）整体替换为：

```cpp
static RECT GetWindowRectForSpec(const WindowSpec& spec, UINT dpi) {
    RECT rect = {
        0,
        0,
        ScaleForDpi(spec.width, dpi),
        ScaleForDpi(spec.height, dpi)
    };
    DWORD windowStyle = LB_WindowBorderStyleToDwStyle(spec.borderStyle, spec.maximizable);
    AdjustWindowRectEx(&rect, windowStyle, TRUE, LB_WindowBorderStyleToDwExStyle(spec.borderStyle));
    return rect;
}
```

3e. `OpenGeneratedWindow`（约 972–999 行）：

```cpp
    DWORD windowStyle = WS_OVERLAPPEDWINDOW;
    if (!spec.resizable) windowStyle &= ~WS_THICKFRAME;
    if (!spec.maximizable) windowStyle &= ~WS_MAXIMIZEBOX;
```

替换为：

```cpp
    DWORD windowStyle = LB_WindowBorderStyleToDwStyle(spec.borderStyle, spec.maximizable);
    DWORD windowExStyle = LB_WindowBorderStyleToDwExStyle(spec.borderStyle);
```

`CreateWindowExW(` 的第一个参数 `0,` 替换为 `windowExStyle,`。

3f. `GeneratedWindowProc`（约 759 行）的消息 switch 中加入拖动分支（放在 `switch (message)` 内、`WM_DESTROY` 等既有 case 之前；注意该函数通过 `GetState(hwnd)` 取 `spec`）：

```cpp
    case WM_LBUTTONDOWN: {
        WindowState* state = GetState(hwnd);
        if (state && state->spec && state->spec->borderStyle == 0 && state->spec->borderlessDraggable) {
            POINT cursor = { static_cast<int>(static_cast<short>(LOWORD(lParam))), static_cast<int>(static_cast<short>(HIWORD(lParam))) };
            HWND child = ChildWindowFromPoint(hwnd, cursor);
            if (child == nullptr || child == hwnd) {
                ReleaseCapture();
                SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
                return 0;
            }
        }
        break;
    }
```

（若该 switch 结构与预期不同——例如已存在 `WM_LBUTTONDOWN` case——则合并进现有 case，语义不变：命中子控件则不拦截。）

3g. 序列化（约 1150 行）：函数体内加

```ts
  const borderStyleCxx = toWindowBorderCxxValue(window.borderStyle);
  const hasCaption = resolveLingWindowBorder(window.borderStyle, window.maximizable !== false).hasCaption;
```

返回模板中 `${window.resizable !== false}, ${window.maximizable !== false} }` 替换为 `${window.resizable !== false}, ${window.maximizable !== false}, ${borderStyleCxx}, ${window.borderlessDraggable === true} }`；`${Math.max(220, window.height - TITLE_BAR_HEIGHT)}` 替换为 `${Math.max(220, window.height - (hasCaption ? TITLE_BAR_HEIGHT : 0))}`。

- [ ] **Step 4: 运行测试确认通过**

```
node --import tsx --test tests/windowDesigner.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```
git add electron/src/services/windowDesigner/nativeWin32Project.ts electron/tests/windowDesigner.test.ts
git commit -m "feat(win32): native 生成器支持 7 值窗口边框样式与无边框拖动"
```

---

### Task 5: 属性面板 UI 与画布预览

**Files:**
- Modify: `electron/src/components/WpfDesigner.tsx`

- [ ] **Step 1: 引入映射模块**

在 `WpfDesigner.tsx` 头部从 `../services/windowDesigner/windowDesignerService` 的 import 附近新增：

```ts
import { LING_WINDOW_BORDER_STYLE_OPTIONS, deriveLingWindowBorderStyle, resolveLingWindowBorder } from '../services/windowDesigner/windowBorderStyle';
import type { LingWindowBorderStyle } from '../services/windowDesigner/types';
```

（`types` 若已 import 则并入。）

- [ ] **Step 2: 外观组新增"边框"下拉**

在"窗口圆角" `PropertyRow`（约 4598 行）之前插入：

```tsx
        <PropertyRow label="边框" isDarkMode={isDarkMode}>
          <select
            value={window.borderStyle || 'normal-resizable'}
            onChange={event => {
              const borderStyle = event.target.value as LingWindowBorderStyle;
              const hasSizingBorder = deriveLingWindowBorderStyle(borderStyle);
              onChange({
                borderStyle,
                borderlessDraggable: false,
                resizable: hasSizingBorder,
                maximizable: borderStyle === 'none' ? true : window.maximizable !== false,
                windowFrame: {
                  ...windowFrame,
                  ...(windowFrame.preset === 'custom' ? { flags: hasSizingBorder ? windowFrame.flags | 0x08 : windowFrame.flags & ~0x08 } : {}),
                  resizeBorder: hasSizingBorder ? windowFrame.resizeBorder : { left: 0, top: 0, right: 0, bottom: 0 }
                }
              });
            }}
            className={`w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            aria-label="窗口边框"
          >
            {LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </PropertyRow>
        {(window.borderStyle || 'normal-resizable') === 'none' && (
          <PropertyRow label="允许拖动移动窗口" isDarkMode={isDarkMode}>
            <input
              type="checkbox"
              checked={window.borderlessDraggable === true}
              onChange={event => onChange({ borderlessDraggable: event.target.checked })}
              aria-label="无边框窗口拖动移动"
              className="h-4 w-4 accent-amber-500"
            />
          </PropertyRow>
        )}
```

- [ ] **Step 3: 状态组移除 resizable 复选框并禁用无边框时的最大化开关**

删除"禁止拖拽调整大小"整个 `PropertyRow`（约 4701–4719 行）。

"禁止窗口最大化"（约 4720–4728 行）替换为：

```tsx
        <PropertyRow label="禁止窗口最大化" isDarkMode={isDarkMode}>
          <input
            type="checkbox"
            checked={window.maximizable === false}
            disabled={(window.borderStyle || 'normal-resizable') === 'none'}
            onChange={event => onChange({ maximizable: !event.target.checked })}
            aria-label="禁止窗口最大化"
            className="h-4 w-4 accent-amber-500 disabled:opacity-40"
          />
        </PropertyRow>
```

- [ ] **Step 4: 画布标题栏按边框渲染**

在画布组件渲染函数内（约 2680 行标题栏 div 处之前）计算：

```tsx
            const canvasBorder = resolveLingWindowBorder(activeWindow.borderStyle, activeWindow.maximizable !== false);
            const isFrameBorderStyle = activeWindow.borderStyle === 'frame-resizable' || activeWindow.borderStyle === 'frame-fixed';
```

标题栏 div（2680–2706 行）改为条件渲染并支持窄标题：

```tsx
            {canvasBorder.hasCaption && (
            <div
              className={`${canvasBorder.captionKind === 'thin' ? 'h-5' : 'h-7'} flex items-center justify-between px-3 border-b border-black/25 select-none canvas-title-bar`}
              style={{ ... 原有 style 不变 ... }}
            >
              ... 原有内容不变 ...
            </div>
            )}
```

镜框式描边：找到画布窗口外层容器（设置 `borderRadius` 的 div，约 2650–2661 行），在其 `style` 对象末尾追加：

```tsx
              ...(isFrameBorderStyle ? { outline: '3px double #9ca3af', outlineOffset: '-1px' } : {})
```

- [ ] **Step 5: new_emoji 框架预设切换同步 borderStyle**

"框架预设"下拉 onChange（约 4663–4669 行）中：

```tsx
                ...(preset === 'browserShell' ? { resizable: true, cornerStyle: 'rounded' as const } : {})
```

替换为：

```tsx
                ...(preset === 'browserShell' ? { resizable: true, cornerStyle: 'rounded' as const, borderStyle: 'normal-resizable' as const } : {})
```

- [ ] **Step 6: 类型检查与手动验证**

```
cd electron
npm run lint
```

预期：无错误。启动 `npm run dev`（或桌面端）在设计器中：切换 7 种边框观察画布标题栏变化（无边框无标题栏、窄标题变矮、镜框式出现双边框）；选"无边框"出现拖动开关与置灰的最大化开关；旧项目打开后边框自动迁移。

- [ ] **Step 7: 提交**

```
git add electron/src/components/WpfDesigner.tsx
git commit -m "feat(designer): 属性面板与画布支持窗口边框样式"
```

---

### Task 6: windowFrame / new_emoji 联动收尾

**Files:**
- Modify: `electron/src/services/windowDesigner/lingCppWin32Project.ts`
- Modify: `electron/src/components/WpfDesigner.tsx`

- [ ] **Step 1: 生成端 resizable 参数改用派生值**

`lingCppWin32Project.ts` 两处 `normalizeLingWindowFrame(window.windowFrame, window.resizable !== false, window.cornerStyle)`（约 1134 行与 2369 行）替换为：

```ts
normalizeLingWindowFrame(window.windowFrame, deriveLingWindowBorderStyle(window.borderStyle), window.cornerStyle)
```

（`windowBorderStyle` import 中补入 `deriveLingWindowBorderStyle`；注意 2369 行 browserShell 预设自身仍强制可调，语义不变。）

`WpfDesigner.tsx` 约 4495 行的 `normalizeLingWindowFrame(window.windowFrame, window.resizable !== false, window.cornerStyle)` 同样替换（import 已在 Task 5 加入，补入 `deriveLingWindowBorderStyle`）：

```ts
const windowFrame = normalizeLingWindowFrame(window.windowFrame, deriveLingWindowBorderStyle(window.borderStyle), window.cornerStyle);
```

- [ ] **Step 2: 验证**

```
cd electron
npm run lint
node --import tsx --test tests/windowDesigner.test.ts
```

预期：通过（browserShell 相关既有断言不受影响——browserShell flags 固定，resizable 仍为 true）。

- [ ] **Step 3: 提交**

```
git add electron/src/services/windowDesigner/lingCppWin32Project.ts electron/src/components/WpfDesigner.tsx
git commit -m "feat(designer): 窗口框架契约统一消费边框派生的 resizable"
```

---

### Task 7: 测试注册与全量验证

**Files:**
- Modify: `electron/package.json`

- [ ] **Step 1: 注册新测试文件**

`package.json` 的 `test:lingcpp` 脚本文件列表末尾追加 ` tests/windowBorderStyle.test.ts`。

- [ ] **Step 2: 全量验证**

```
cd electron
npm run lint
npm run test:lingcpp
npm run build
```

预期：lint 无错误；测试全部 PASS；build 成功。

- [ ] **Step 3: 提交**

```
git add electron/package.json
git commit -m "test: 注册窗口边框样式单元测试"
```

---

### Task 8: 文档同步（按 AGENTS.md）

**Files:**
- Create: `更新记录/2026-08-16.md`（仓库根目录）
- Modify: `FUTURE_OPTIMIZATIONS.md`（仓库根目录）
- Modify: `LingBuilder AI 规则手册.md`（仓库根目录）

- [ ] **Step 1: 更新记录**

创建 `更新记录/2026-08-16.md`（UTF-8）：日期、更新内容（窗口设计器新增 7 值"边框"属性与无边框拖动、全链路生成支持、旧项目迁移规则）、影响范围（`windowBorderStyle.ts`、`windowDesignerService.ts`、`lingCppWin32Project.ts`、`nativeWin32Project.ts`、`WpfDesigner.tsx`）、验证结果（lint/test:lingcpp/build 通过与冒烟结论）。

- [ ] **Step 2: FUTURE_OPTIMIZATIONS.md**

追加一节：设计器窗口模型新增 `borderStyle`/`borderlessDraggable` 字段与迁移规则；记录"spec 序列化侧 `TITLE_BAR_HEIGHT` 为近似扣减，运行时由 `AdjustWindowRect` 精确计算；如后续需要画布与原生完全像素一致，可精确化扣减"为后续优化项。

- [ ] **Step 3: LingBuilder AI 规则手册.md**

补充：AI 生成设计器项目 JSON 时窗口支持 `borderStyle`（7 个合法值：`none`/`normal-resizable`/`normal-fixed`/`thin-title-resizable`/`thin-title-fixed`/`frame-resizable`/`frame-fixed`，默认 `normal-resizable`）与 `borderlessDraggable`（仅 `none` 时有效，默认 `false`）；`resizable` 由 `borderStyle` 派生，不要独立设置矛盾值。

- [ ] **Step 4: 提交**

```
git add 更新记录/2026-08-16.md FUTURE_OPTIMIZATIONS.md "LingBuilder AI 规则手册.md"
git commit -m "docs: 同步窗口边框属性文档与更新记录"
```

---

### 冒烟验证（可选但推荐，Task 8 之后）

构建一个 `borderStyle: 'none'` + `borderlessDraggable: true` 的单窗口项目 exe（F5 或 AI Bridge `build.run`），确认：无标题栏无边框、按住客户区可拖动、任务栏图标仍在；再构建一个 `normal-fixed` 项目确认不可拖拽调整大小。
