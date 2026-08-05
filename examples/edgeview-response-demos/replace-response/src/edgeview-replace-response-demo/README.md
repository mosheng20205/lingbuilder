# EdgeView 替换响应 Demo

本项目演示在 `Web资源请求` 同步事件中调用 `EdgeView资源_设置事件响应文本`，把固定演示地址替换为本地 UTF-8 HTML。

运行后会自动请求 `https://demo.lingbuilder.local/replace`。该地址不会访问公网，响应状态、响应头和正文均由 LingBuilder 代码提供。点击“重新发起请求”可重复验证。

关键约束：

- 必须先用 `EdgeView_绑定控件事件(演示浏览器, "Web资源请求", &收到资源请求)` 绑定处理器。
- 处理器参数使用 `&处理器名`，Edge 浏览器控件使用不带引号的 `controlRef`。
- `EdgeView资源_设置事件响应文本` 只能在同步请求事件处理期间调用。
- 正文会按 UTF-8 编码，单次正文上限为 4 MB。

运行环境需要 Microsoft Edge WebView2 Runtime。
