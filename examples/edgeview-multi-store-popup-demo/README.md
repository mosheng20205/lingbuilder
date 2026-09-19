# EdgeView 多店铺独立弹窗演示

演示 `lingbuilder.edgeview` **1.4.0** 的多店铺登录态验证范式：浏览器**全部以独立顶层弹窗**打开（不内嵌宿主窗口），每个店铺一个 `实例编号` + 独立 `缓存目录`（Cookie/存储隔离），在首次导航前设置统一 `User-Agent`，并用 CookieManager 注入 `HttpOnly` Cookie（禁止 `document.cookie`），随后异步回读校验。

## 能力对照

| 需求 | 用到的命令 |
|---|---|
| 独立顶层弹窗（任务栏可见、可单独拖动缩放、页面随窗口自适应） | `EdgeView_创建弹窗浏览器(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)` |
| 店铺间 Cookie/缓存隔离 | 每个弹窗传不同 `独立缓存目录`（`.edgeview/store-a` / `.edgeview/store-b`） |
| 统一 UA 且首次导航前生效 | `创建弹窗浏览器` 的 `用户代理` 参数（生成运行时在建环境回调内、`Navigate` 之前 `put_UserAgent`） |
| 注入 HttpOnly 登录 Cookie | `EdgeView会话_批量置Cookie实例(实例编号, Cookie列表JSON)`（`secure/httpOnly/sameSite`） |
| 注入后再导航 | `EdgeView_导航实例(实例编号, 地址)` |
| 回读校验登录态 | `EdgeView会话_取Cookie实例异步(实例编号, 地址, &完成处理器)` → 处理器内 `EdgeView任务_取结果(EdgeView任务_取当前任务ID())` |
| 自省当前打开了哪些实例 | `EdgeView_枚举实例JSON()` |
| 关闭全部（主窗口关闭也会连带关闭全部弹窗） | `EdgeView_关闭全部实例()`（本示例主窗口关闭时由运行时 `EdgeView_关闭()` 自动连带关闭） |

## 运行

1. 复制到独立工作区，打开 `EdgeView多店铺弹窗演示.lbsln`（或 `示例项目/.lingbuilder/solution.json`），F5 构建运行；
2. 也可用 AI Bridge CLI 无头构建：`node dist/cli.cjs project build --request examples/edgeview-multi-store-popup-demo/build-request.json --yes`；
3. 启动后应弹出**两个各自独立的 Edge 窗口**（店铺 A / 店铺 B），分别指向不同 `.edgeview` 缓存目录，页面为 example.com；宿主窗口「输出/调试」面板打印打开数、实例清单与两店 Cookie 回读（回读 JSON 里该 Cookie 的 `httpOnly` 应为 `true`）。

## 数据红线

- 本示例只用占位 Cookie 值（`store-*-placeholder`）与 `example.com`，**不含任何真实账号、Cookie 值、代理密码或敏感域名**。
- 真实多店铺验证请在本机把导出的合法 Cookie 喂给 `批量置Cookie实例`，切勿把凭据写进 `.lcpp` 源码、日志、示例或分享包。
- 过期时间必须是未来时刻（UTC 秒），会话 Cookie 用 `-1` 或省略 `expires`；`sameSite=None(0)` 必须同时 `secure=true`。

## 前置

- Windows 10/11 + 系统 WebView2 Runtime（自带 Edge 即满足）；构建需 Visual Studio Build Tools（MSVC）。
- 依赖模块：`lingbuilder.win32.basic`（宿主窗口 + 标签）、`lingbuilder.edgeview@1.4.0`（浏览器命令）。
