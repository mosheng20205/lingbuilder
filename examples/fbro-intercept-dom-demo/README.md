# FBro 拦截与 DOM 遍历示例

演示 2026-09-09 四火山工程缺口封装后的能力（bridge 2.7.0 / SDK `135.0.21.2.7.0`）：

- **WebSocket 拦截闭环**：`FBroVIP_浏览器指纹_设置启用WebSocket客户端钩子` 启用拦截；`FBro_绑定事件` 绑定「初始化WebSocket客户端创建/消息/发送」等事件读取受管 wssClient 句柄与数据缓冲；`FBro页面_发送文本` 按通道名把数据回传页面。
- **内嵌 HTTP/WebSocket 服务器**：`FBro服务器_创建` 创建 `127.0.0.1:8899`，`本地服务器WebSocket消息到达`、`本地服务器客户端已连接` 事件实时打印连接与消息。
- **DOM 遍历快照**：`FBro框架_遍历DOM` 把当前页序列化为受管快照，`FBro遍历_取标题/取节点数/取节点名称/取焦点节点路径` 读取；`FBro遍历_按路径设属性/按路径赋值` 按路径写回。
- **运行时独立 RequestContext**：`FBro会话_创建上下文` 创建隔离上下文，`FBro会话_使用上下文重建` 让浏览器原地换上下文重启（指纹多 profile 场景）。

## 已知边界

- `ExecuteJavaScriptToHasReturn` 结果投递在复杂页面有约 60 秒量级延迟且偶发超时（FBro SDK 通道行为），`FBro框架_遍历DOM` 等待上限 150 秒。
- 新命令仅进程内模式（`processMode: in-process`）可用。
- 拦截事件与服务器事件中的 wssClient/server/request 句柄为持久受管句柄，用 `FBro对象_释放` 释放；数据缓冲用 `FBro缓冲_释放` 释放。
- 启用 WebSocket 拦截需要 FBro VIP 授权（环境变量 `LINGBUILDER_FBRO_VIP_KEY`）。

## 构建验证

```bash
cd electron
node dist/cli.cjs project build --request ../examples/fbro-intercept-dom-demo/build-request.json --workspace ../examples/fbro-intercept-dom-demo --yes --json
```

需要环境变量 `FBRO_SDK_ROOT` 指向已安装 SDK（默认仓库根 `.lingbuilder/modules/lingbuilder.fbro.sdk/sdk` 之外的 Workspace 时必须显式提供）。
