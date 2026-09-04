# FBroBrowser 控件与进程模式

## 设计器控件

控件类型为 `FBroBrowser`，所有在 `.lcpp` 中传入控件的参数都必须使用裸控件名，例如：

```text
FBro_导航(浏览器1, "https://example.com")
```

不要写成 `FBro_导航("浏览器1", ...)`。编辑器、诊断、补全和 C++ 生成器会把该参数识别为 `controlRef`。

主要属性：

| 属性 | 说明 |
|---|---|
| `url` | 初始地址。建议使用完整 `https://` 地址。 |
| `processMode` | `in-process`、`independent-embedded` 或 `independent-window`。 |
| `cacheDir` | 独立 Profile/缓存目录；多实例应使用不同目录。 |
| `userAgent` | 创建前使用的 User-Agent。 |
| `enableJs` | 是否启用 JavaScript。 |
| `enableDevTools` | 是否允许开发者工具。 |
| `loadImages` / `enableWebGL` | 图片与 WebGL 开关。 |
| `muteAudio` | 是否静音。 |
| `proxyMode` / `proxyServer` | 系统、直连或自定义代理。 |
| `fingerprintProfile` | 结构化指纹 JSON；需要有效 VIP 授权。 |

## 进程模式

- `in-process`：浏览器与主程序共享进程，启动简单、开销较低；不能与 CEF3 150 进程内 ABI 混用。
- `independent-embedded`：每个浏览器使用独立 FBro Host，但页面仍嵌入设计器窗口，适合多个浏览器并存。
- `independent-window`：每个浏览器使用独立顶层窗口，适合需要完全隔离窗口生命周期的场景。

独立模式为每个实例分配独立 Profile、回环 WebSocket、Token、日志目录和 CDP 端口。不要手工复用这些运行时目录或端口。

## 事件绑定

```text
FBro_绑定事件(浏览器1, "加载状态改变", &浏览器1_加载状态改变)

事件 浏览器1_加载状态改变()
    如果 (FBro_是否加载中(浏览器1) == 0)
        调试输出(FBro_取标题(浏览器1), FBro_取地址(浏览器1))
    如果结束
结束
```

处理器引用必须使用 `&处理器名`，不能加引号。多个浏览器应分别绑定自己的处理器，避免把事件状态误读为另一个实例。

## 容器与布局

`GroupBox` 是适合多浏览器示例的绝对布局容器。浏览器控件设置 `parentId` 指向分组框，坐标仍使用窗口坐标，便于原生 Win32 生成器确定性重建。每个浏览器实例应使用不同的 `cacheDir`。
