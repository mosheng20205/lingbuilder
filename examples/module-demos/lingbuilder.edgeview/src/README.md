# EdgeView 浏览器模块完整演示

- 模块 ID：`lingbuilder.edgeview`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：36
- 设计器控件数：1
- 分组数：2

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

基于 Microsoft Edge WebView2，把浏览器嵌入任意 Win32 窗口组件句柄，并提供导航、网页消息、浏览器事件和 JavaScript 返回值。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `EdgeView_创建` | `EdgeView_创建(父组件句柄, 地址)` | int | 在指定 HWND 组件客户区内创建 EdgeView；传 0 时嵌入当前窗口。成功返回 1。 |
| 2 | `EdgeView_创建实例` | `EdgeView_创建实例(实例编号, 父组件句柄, 地址, 独立缓存目录)` | int | 创建具名 EdgeView 实例；不同缓存目录拥有独立 Cookie、存储和会话。 |
| 3 | `EdgeView_创建实例代理` | `EdgeView_创建实例代理(实例编号, 父组件句柄, 地址, 独立缓存目录, 代理地址)` | int | 创建使用独立代理的 EdgeView 实例；该代理覆盖全局代理。 |
| 4 | `EdgeView_创建区域` | `EdgeView_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录)` | int | 在当前窗口指定区域创建独立承载 HWND 和 EdgeView 实例。 |
| 5 | `EdgeView_创建区域代理` | `EdgeView_创建区域代理(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)` | int | 在指定区域创建使用独立代理的 EdgeView 实例。 |
| 6 | `EdgeView_设置全局代理` | `EdgeView_设置全局代理(代理地址)` | int | 设置后续新建 EdgeView 实例默认使用的 HTTP/HTTPS/SOCKS5 代理；现有实例不变。 |
| 7 | `EdgeView_清除全局代理` | `EdgeView_清除全局代理()` | void | 清除后续新建实例的全局代理，现有实例不变。 |
| 8 | `EdgeView_取全局代理` | `EdgeView_取全局代理()` | wideString | 返回当前 EdgeView 全局代理设置。 |
| 9 | `EdgeView_取实例代理` | `EdgeView_取实例代理(实例编号)` | wideString | 返回指定实例创建时实际采用的代理地址。 |
| 10 | `EdgeView_绑定事件` | `EdgeView_绑定事件(实例编号, 事件名, 处理器名)` | int | 绑定 WebView2 完整事件目录中的中文事件；当前目录共 62 项。 |
| 11 | `EdgeView_监听开发者工具事件` | `EdgeView_监听开发者工具事件(实例编号, 协议事件名)` | int | 监听指定 Chromium DevTools Protocol 事件，触发“开发者工具协议事件”。 |
| 12 | `EdgeView_等待事件` | `EdgeView_等待事件(实例编号, 事件名, 超时毫秒)` | int | 泵送窗口消息并等待指定浏览器事件，成功返回 1，超时返回 0。 |
| 13 | `EdgeView_导航` | `EdgeView_导航(地址)` | int | 导航到 HTTP/HTTPS 地址或本地文件地址。 |
| 14 | `EdgeView_导航实例` | `EdgeView_导航实例(实例编号, 地址)` | int | 让指定 EdgeView 实例导航。 |
| 15 | `EdgeView_执行JS` | `EdgeView_执行JS(脚本)` | wideString | 执行 JavaScript 并等待异步回调，返回 WebView2 的 JSON 编码结果；失败返回空文本。 |
| 16 | `EdgeView_执行JS实例` | `EdgeView_执行JS实例(实例编号, 脚本)` | wideString | 在指定实例执行 JavaScript，并返回 WebView2 JSON 编码结果。 |
| 17 | `EdgeView_取最近事件` | `EdgeView_取最近事件()` | wideString | 返回最近触发的 WebView2 中文事件名。 |
| 18 | `EdgeView_取事件数据` | `EdgeView_取事件数据()` | wideString | 返回最近事件携带的 UTF-16 JSON 对象文本。 |
| 19 | `EdgeView_取最近事件实例` | `EdgeView_取最近事件实例(实例编号)` | wideString | 返回指定浏览器实例最近事件名。 |
| 20 | `EdgeView_取事件数据实例` | `EdgeView_取事件数据实例(实例编号)` | wideString | 返回指定浏览器实例最近事件携带的数据。 |
| 21 | `EdgeView_后退` | `EdgeView_后退()` | int | 浏览器可以后退时返回上一页。 |
| 22 | `EdgeView_前进` | `EdgeView_前进()` | int | 浏览器可以前进时进入下一页。 |
| 23 | `EdgeView_刷新` | `EdgeView_刷新()` | void | 刷新当前网页。 |
| 24 | `EdgeView_关闭` | `EdgeView_关闭()` | void | 关闭浏览器控制器并释放 WebView2 资源。 |
| 25 | `EdgeView_关闭实例` | `EdgeView_关闭实例(实例编号)` | void | 关闭指定 EdgeView 实例并释放其承载窗口。 |
| 26 | `EdgeView_创建控件` | `EdgeView_创建控件(控件名)` | int | 使用设计器属性重新创建指定 Edge 浏览器控件；空文本创建当前窗口全部 Edge 浏览器控件。 |
| 27 | `EdgeView_导航控件` | `EdgeView_导航控件(控件名, 地址)` | int | 让指定设计器 Edge 浏览器控件导航到新地址。 |
| 28 | `EdgeView_执行JS控件` | `EdgeView_执行JS控件(控件名, 脚本)` | wideString | 在指定设计器 Edge 浏览器控件中执行 JavaScript 并返回 JSON 编码结果。 |
| 29 | `EdgeView_取最近事件控件` | `EdgeView_取最近事件控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近触发的事件名。 |
| 30 | `EdgeView_取事件数据控件` | `EdgeView_取事件数据控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近事件的数据。 |
| 31 | `EdgeView_后退控件` | `EdgeView_后退控件(控件名)` | int | 让指定设计器 Edge 浏览器控件后退。 |
| 32 | `EdgeView_前进控件` | `EdgeView_前进控件(控件名)` | int | 让指定设计器 Edge 浏览器控件前进。 |
| 33 | `EdgeView_刷新控件` | `EdgeView_刷新控件(控件名)` | void | 刷新指定设计器 Edge 浏览器控件。 |
| 34 | `EdgeView_关闭控件` | `EdgeView_关闭控件(控件名)` | void | 关闭指定设计器 Edge 浏览器控件并保留设计器宿主占位。 |
| 35 | `EdgeView_绑定控件事件` | `EdgeView_绑定控件事件(控件名, 事件名, 处理器名)` | int | 按控件名绑定 WebView2 完整事件目录中的中文事件；当前目录共 62 项。 |
| 36 | `EdgeView_监听开发者工具事件控件` | `EdgeView_监听开发者工具事件控件(控件名, 协议事件名)` | int | 按设计器控件名监听 Chromium DevTools Protocol 事件。 |
