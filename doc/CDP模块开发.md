# CDP 模块开发

## 模块定位

本文中的 CDP 指 **Chrome DevTools Protocol**。CDP 模块用于让 LingBuilder 生成的程序通过 WebSocket 连接 Chrome/Edge 调试端口，并调用浏览器调试、自动化和监听页面事件的能力。

CDP 模块应当是一个 `.lbmod` v2 原生模块，而不是只在 IDE 中演示的功能。整体调用链如下：

```text
.lcpp 中文命令
  -> 模块 bindings.commands
  -> 生成的 C++ 调用模块运行时
  -> WebSocket / JSON-RPC
  -> Chrome / Edge 的 CDP 调试端口
```

## 第一版能力

### 连接与页面管理

- 连接或断开 CDP 服务，例如 `http://127.0.0.1:9222`。
- 获取可调试页面列表。
- 附加到指定标签页或 Target。
- 管理浏览器连接和页面会话生命周期。

### 页面控制

- 打开网址。
- 刷新、前进和后退。
- 执行 JavaScript。
- 获取标题、URL 和 HTML。
- 截图。
- 打印 PDF。

### DOM 操作

- 查询元素。
- 点击元素。
- 输入文本。
- 滚动页面。
- 读取元素文本或属性。

### 网络与调试

- 监听请求和响应。
- 控制 Cookie。
- 读取控制台日志。
- 捕获页面异常。
- 后续可增加断点和更完整的调试能力。

### 异步事件

CDP 的异步完成处理器必须遵守 LingBuilder 的 `.lcpp` 规则，回调参数使用 `&处理器名` 引用语法：

```lcpp
CDP_执行脚本(浏览器, "document.title", &执行完成)
```

## 中文 DSL 示例

```lcpp
浏览器 ＝ CDP_连接("http://127.0.0.1:9222")
页面 ＝ CDP_附加页面(浏览器, "https://example.com")
CDP_打开网址(页面, "https://lingbuilder.example")
CDP_点击(页面, "#submit", &点击完成)
CDP_执行脚本(页面, "document.title", &取得标题完成)
```

## 运行时设计

CDP 的核心难点不是发送单个命令，而是长期维护协议会话：

- 管理递增的 CDP `id`。
- 维护 `id -> 请求回调` 的映射。
- 接收浏览器主动推送的事件。
- 处理 Target 会话切换和页面销毁。
- 将 JSON 结果稳定映射成 LingBuilder 可用的数据类型。

C++ 运行时需要 WebSocket 和 JSON 支持，并将 CDP 会话对象作为非可视组件或对象引用管理。连接、请求、事件订阅、错误和释放流程应由模块运行时统一负责，不能散落在 React 组件或 C++ 生成器中。

## 模块生态接入

模块清单应采用 `.lbmod` v2 格式，并至少包括：

- `contributes.commands`：中文命令补全、提示、文档和诊断。
- `bindings.commands`：中文命令到 C++ 运行时的确定性映射。
- 公开类型：浏览器连接、页面会话、元素引用、事件结果等。
- `contributes.docs`：真实存在、非空且随模块包分发的中文 Markdown 文档。
- `targets[]`：当前优先支持 `windows-msvc-win32`，并为后续平台适配预留边界。

CDP 相关命令、公开类型、示例和运行时行为发生变化时，必须同步更新模块文档、补全、诊断、C++ 生成和测试。

## 安全边界

- 模块只控制用户显式开放调试端口的浏览器，不绕过浏览器安全机制。
- 默认只允许连接本机 `127.0.0.1`、`localhost` 或 `::1`。
- 远程 CDP 地址必须显式配置，并显示安全提示。
- 不允许通过 CDP 模块开放任意 Shell、任意文件系统访问或公网工作区控制能力。
- 连接失败、Target 不存在、协议错误和权限错误必须返回明确的中文诊断，同时保留原始 CDP 错误信息供排查。

## 设计器与 IDE 集成

设计器中可将“CDP 浏览器”建模为非可视组件，用于配置调试地址、默认页面和连接选项；浏览器页面、DOM 元素等运行时对象不应伪装成可视控件，也不应占用 `HWND`。

IDE 内的模块详情、中文补全、悬停提示、诊断和示例应通过 `ModuleService -> LingCppModuleContext -> lingCpp/languageService -> MonacoCodeEditor` 链路提供。运行时生成器必须消费同一份模块 binding 和类型信息，确保编辑器中的命令语义与导出的 C++ 工程一致。

## 后续扩展方向

- 多 Target 和多标签页管理。
- 网络请求拦截与重放。
- 性能追踪、覆盖率和内存分析。
- 更完整的调试器适配器能力。
- 基于 CDP 的自动化测试任务和录制/回放。
- 在不改变上层模块接口的前提下适配 macOS、Qt、WebView 等后端。

如果“CDP”在具体需求中不是 Chrome DevTools Protocol，而是其他协议或业务缩写，应先明确全称和目标运行环境，再确定模块 API 与运行时实现。
