# EdgeView 读取响应 Demo

本项目绑定 `Web资源响应收到`，从事件中读取：

- `requestHandle`
- `responseHandle`
- `uri`
- `statusCode`
- `reason`

取得 `responseHandle` 后，项目调用 `EdgeView资源_读响应正文异步`。完成处理器通过 `EdgeView任务_取当前任务ID` 和 `EdgeView任务_取结果` 获得 `{ "byteCount": "...", "hex": "..." }`。两个值都是 JSON 字符串：字节数用 `JSON_取文本` 后交给 `到整数`，正文用 `JSON_取文本` 后交给 `字节_十六进制转文本` 解码 UTF-8。

为了离线、稳定复现，`Web资源请求` 处理器会为固定地址返回一段本地 JSON。`Web资源响应收到` 仍由 WebView2 正常触发，元数据和正文均从响应对象读取。读取完成后会释放任务、请求句柄和响应句柄。

关键约束：

- 处理器参数必须使用 `&处理器名`。
- Edge 浏览器参数是裸 `controlRef`，不能给控件名加引号。
- 单次正文最多读取 4 MB；本示例限制为 1 MB。
- `EdgeView资源_读响应正文异步` 需要 EdgeView 安全 API v2，对应 WebView2 Runtime 150 或更高版本。
- 当前接口展示状态码、原因和正文；本示例不宣称支持读取响应头。

点击“重新读取响应”可重复验证。
