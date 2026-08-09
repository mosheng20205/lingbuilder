<!-- 此文件由 electron/scripts/generate-cef3-fbro-event-docs.ts 生成，禁止手工维护第二份接口清单。 -->
# CEF3 开发者工具官方接口参考

模块 ID：`lingbuilder.cef3.devtools`；CEF 基线：`150.0.14+g7c1aa68+chromium-150.0.7871.129`；共 5 项官方签名。

状态统计：implemented=5，mapped=0，planned=0，internal=0，notApplicable=0。

> `implemented` 才表示已有真实 Bridge 实现与测试定位。`planned` 是已分类的安全封装目标，不是当前可调用接口。

| # | 操作 ID | 中文映射 | 官方名/签名 | 编解码 | 线程/执行 | 所有权 | 状态 | 实现与测试 |
|---:|---|---|---|---|---|---|---|---|
| 1 | `0x2fc9ade96396f4c1` | CEF3开发工具_订阅代理附加 | `on_dev_tools_agent_attached`<br>`void (CEF_CALLBACK* on_dev_tools_agent_attached)( struct _cef_dev_tools_message_observer_t* self, struct _cef_browser_t* browser)` | `typedHandle`, `boolean` → `integer` | `cef-ui-or-caller` / `sync` | `typedHandle` | `implemented` | `LB_CEF3_DevToolsSubscribeAgentAttached`<br>`electron/native/cef3-bridge/LingBuilderCefBridge.cpp#LB_CEF3_DevToolsSubscribeAgentAttached`<br>`electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp` |
| 2 | `0x47caecc1556f81c3` | CEF3开发工具_订阅代理分离 | `on_dev_tools_agent_detached`<br>`void (CEF_CALLBACK* on_dev_tools_agent_detached)( struct _cef_dev_tools_message_observer_t* self, struct _cef_browser_t* browser)` | `typedHandle`, `boolean` → `integer` | `cef-ui-or-caller` / `sync` | `typedHandle` | `implemented` | `LB_CEF3_DevToolsSubscribeAgentDetached`<br>`electron/native/cef3-bridge/LingBuilderCefBridge.cpp#LB_CEF3_DevToolsSubscribeAgentDetached`<br>`electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp` |
| 3 | `0x70344b215ac1c436` | CEF3开发工具_订阅协议事件 | `on_dev_tools_event`<br>`void (CEF_CALLBACK* on_dev_tools_event)( struct _cef_dev_tools_message_observer_t* self, struct _cef_browser_t* browser, const cef_string_t* method, const void* params, size_t params_size)` | `typedHandle`, `boolean` → `integer` | `cef-ui-or-caller` / `sync` | `typedHandle` | `implemented` | `LB_CEF3_DevToolsSubscribeEvent`<br>`electron/native/cef3-bridge/LingBuilderCefBridge.cpp#LB_CEF3_DevToolsSubscribeEvent`<br>`electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp` |
| 4 | `0x91093626818f3520` | CEF3开发工具_订阅协议消息 | `on_dev_tools_message`<br>`int (CEF_CALLBACK* on_dev_tools_message)( struct _cef_dev_tools_message_observer_t* self, struct _cef_browser_t* browser, const void* message, size_t message_size)` | `typedHandle`, `boolean` → `integer` | `cef-ui-or-caller` / `sync` | `typedHandle` | `implemented` | `LB_CEF3_DevToolsSubscribeMessage`<br>`electron/native/cef3-bridge/LingBuilderCefBridge.cpp#LB_CEF3_DevToolsSubscribeMessage`<br>`electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp` |
| 5 | `0xfb78d7cd9746ebca` | CEF3开发工具_执行协议方法 | `on_dev_tools_method_result`<br>`void (CEF_CALLBACK* on_dev_tools_method_result)( struct _cef_dev_tools_message_observer_t* self, struct _cef_browser_t* browser, int message_id, int success, const void* result, size_t result_size)` | `typedHandle`, `utf16`, `json` → `typedHandle` | `cef-ui-or-caller` / `asyncTask` | `managedTaskHandle` | `implemented` | `LB_CEF3_DevToolsExecuteMethod`<br>`electron/native/cef3-bridge/LingBuilderCefBridge.cpp#LB_CEF3_DevToolsExecuteMethod`<br>`electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp` |

返回统一入口：`README.md`。

