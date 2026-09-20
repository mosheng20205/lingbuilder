# CEF3 无头抓取示例（官方 OSR，不产生任何窗口）

演示 LingBuilder 的第四种无头形态：**CEF3 官方无窗口渲染（OSR）浏览器**。
它不是「建了真窗口再藏起来」，而是整个进程里根本不创建浏览器窗口 ——
运行期用 `EnumWindows` 探针扫过，该 PID 的可见顶层窗口数量恒等于设计器窗口数。

- 项目 ID：`cef3-headless-demo`
- 模块：`lingbuilder.win32.basic`、`lingbuilder.cef3.browser`（无头命令）、`lingbuilder.cef3.osr`（OSR 官方接口，可选）
- 组件：一个可见 `抓取按钮` + 一个 `结果标签`，外加非可视组件 `无头抓取1`（`CEF3无头浏览器`）

## 目录

```text
build-request.json          构建请求（含完整设计器模型，AI Bridge CLI 可直接吃）
src/无头抓取示例.lcpp        事件代码（新手模式与 Monaco 均可直接复制）
```

## 怎么用

1. 在 IDE 里新建窗口项目，工具箱「非可视」分类拖入 **CEF3无头浏览器**。
2. 属性面板填：实例编号 `1`、打开地址（本示例用 `https://www.example.com`，离线可改成本地
   `file:///…/page.html`）、独立缓存目录 `.cef3/headless-demo`、视口 `1024 × 640`，
   并勾选 **启动时自动创建**。
3. 把 `src/无头抓取示例.lcpp` 的内容贴进窗口主 `.lcpp`（类名必须与设计器窗口的类名一致）。
4. F5 构建运行；点「抓取」按钮重新抓取一次。

也可用 CLI 闭环验证（工作区根为本目录）：

```bash
cd electron
node dist/cli.cjs project create --workspace .. --template blank-window --project-id cef3-headless-demo
node dist/cli.cjs build --workspace .. --request examples/cef3-headless-demo/build-request.json
```

## 三条必守的调用红线

1. **先等再取**：`CEF3无头_等待加载完成(编号, 超时毫秒)` 是读标题、执行 JS、取正文前的必用前置。
   桥把浏览器创建投递到 CEF UI 线程，「还没建好」和「导航还没起步」时 `是否加载中` 都返回 0，
   只轮询加载状态会把两种「还没开始」都误判成「已加载完」，于是全文皆空。
2. **出帧要单独等**：`加载完成 ≠ 已出帧`。真机实测首帧比加载完成晚约半秒，
   所以判「页面真的渲染出来了」用 `CEF3无头_等待出帧(编号, 超时毫秒)`，
   不要读一次 `CEF3无头_取渲染帧数` 就下结论。该命令等待期间会周期性请求视图重绘。
3. **按编号寻址，不是控件名**：无头实例没有控件，`CEF3无头_取标题(1)` 里的 `1` 是运行期实例编号，
   写裸数字、不加引号；把编号当控件名传给 `CEF3_取标题` 这类 controlRef 命令会被门禁拦下。

另外两条口径：

- `CEF3无头_执行JS` 返回的是 DevTools **结果信封 JSON**（`{"result":{"type":"number","value":42,…}}`），
  不是裸值；要拿业务数据必须自己解 JSON。
- **一期没有截图能力**：像素帧只在桥内计数，不外发内容（`CEF3离屏_订阅像素帧` 只点亮订阅位）。
  用户要截图时如实说明，并引导改用可见窗口浏览器（`CEF3浏览器` 控件）或等后续版本。

## 控制台项目怎么用同一套能力

控制台（`windows-console`）项目不需要设计器组件，直接 `CEF3_创建无头浏览器(1, 地址, 缓存目录, 代理, 宽, 高)`
建实例，其余命令完全相同；控制台派发不了事件处理器，所以进度只能靠
`CEF3无头_等待加载完成` 与 `CEF3无头_取事件JSON` 轮询。
真机回归见 `electron/scripts/smoke-cef3-headless-native.ts`（`npm run smoke:cef3-headless-native`，
两个用例：控制台 + 本示例的窗口源码）。
