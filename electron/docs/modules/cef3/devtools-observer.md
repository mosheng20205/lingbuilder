# CEF3 DevTools Observer 用户指南

适用于 `lingbuilder.cef3.devtools`，基线为 CEF `150.0.14+g7c1aa68`、Windows MSVC x64。该专题封装 `CefDevToolsMessageObserver` 的四个回调，并保留 CEF 的 UI 线程约束和 UTF-8 数据生命周期。

## 快速使用

先订阅需要的回调，再绑定同名浏览器事件。订阅是浏览器实例级别的，第二个参数为 `真` 启用、`假` 禁用：

```text
CEF3开发工具_订阅代理附加(浏览器1, 真)
CEF3开发工具_订阅代理分离(浏览器1, 真)
CEF3开发工具_订阅协议事件(浏览器1, 真)
CEF3开发工具_订阅协议消息(浏览器1, 真)
CEF3_绑定事件(浏览器1, "开发工具代理已附加", &开发工具代理已附加)
CEF3_绑定事件(浏览器1, "开发工具代理已分离", &开发工具代理已分离)
CEF3_绑定事件(浏览器1, "开发工具协议事件", &开发工具协议事件)
CEF3_绑定事件(浏览器1, "开发工具协议消息", &开发工具协议消息)
结束

事件 开发工具协议事件()
    调试输出(CEF3_取事件字段(浏览器1, "method"))
    调试输出(CEF3_取事件字段(浏览器1, "paramsJson"))
结束
```

发送协议方法使用动态 JSON。动态 JSON 只用于 DevTools Protocol，不用于普通 CEF 对象参数：

```text
任务ID = CEF3开发工具_执行协议方法(浏览器1, "Runtime.enable", "{}")
状态 = CEF3任务_取状态(任务ID)
结果 = CEF3任务_取结果(任务ID)
CEF3任务_释放(任务ID)
```

## 事件字段

| 事件 | 字段 | 说明 |
|---|---|---|
| `开发工具代理已附加` | `browserId` | CEF 浏览器标识。 |
| `开发工具代理已分离` | `browserId` | CEF 浏览器标识。代理分离后，未完成协议结果不会再投递。 |
| `开发工具协议事件` | `browserId`、`method`、`paramsJson`、`byteCount`、`truncated`、`utf8Valid` | `method` 是协议事件名；`paramsJson` 是复制后的 UTF-8 参数 JSON。 |
| `开发工具协议消息` | `browserId`、`message`、`byteCount`、`truncated`、`utf8Valid` | `message` 是复制后的完整协议消息或前 1 MiB；观察器返回“未处理”，不会拦截其他观察器。 |

所有事件都在 CEF UI 线程产生，Bridge 会先复制数据，再通过现有事件队列投递到窗口处理器。协议数据单条最多复制 1 MiB；超过上限时 `truncated=true`。无效 UTF-8 不会暴露原始地址，并以 `utf8Valid=false` 标记。

## 生命周期和安全边界

- 订阅开关只保存于目标浏览器句柄；关闭浏览器或 Bridge 注销观察器时，会在 CEF UI 线程自动解除 `CefRegistration`。`开发工具代理已分离` 优先来自 CEF 的 `OnDevToolsAgentDetached`；如果 CEF 150 只通知观察器注销，Bridge 会在同一生命周期点补发一次去重通知，保证用户不会遗漏分离状态。
- 重复启用或禁用是幂等操作；四项全部禁用后立即解除观察器注册。
- 方法调用返回受管任务句柄，必须使用 `CEF3任务_取状态`、`CEF3任务_取结果`、`CEF3任务_取错误` 和 `CEF3任务_释放` 管理。
- `CefBrowser`、`CefRefPtr`、STL 容器、原始回调地址和原始消息指针不会出现在 `.lcpp` ABI 中。
- 当前仅支持 CEF 150 Windows MSVC x64；不支持的平台应由模块诊断拒绝，而不是静默降级。

完整官方签名、操作 ID、线程和实现定位见 [CEF3 开发者工具官方接口参考](devtools.md)。
