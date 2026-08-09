# new_emoji FBro 浏览器外壳

`lingbuilder.new_emoji.fbro-shell@1.2.0` 在 new_emoji 自绘浏览器框架窗口中管理真实 FBro/CEF 135 x64 页面。普通标签页继续使用独立 FBro 句柄；动态独立实例使用一实例一 `LingBuilderFbroHost.exe`、一条鉴权 WebSocket 会话、一个 Profile 目录和一个非分层伴随宿主 `HWND`。切换标签页时仅显示当前页面。

`BrowserViewport` 永远是设计器占位区，只提供布局边界以及加载、空白和错误提示。网页像素由 FBro 伴随宿主直接渲染，LingBuilder 不在 React 预览或 IDE 运行层模拟网页。伴随宿主使用 `WS_EX_TOOLWINDOW + WS_POPUP`，不进入任务栏或 Alt+Tab，并按占位区屏幕坐标同步主窗口移动、缩放、DPI、最小化、隐藏、恢复和销毁。

独立嵌入模式由主进程拥有的伴随父 `HWND` 控制最终显隐，Host 内部的浏览器子窗口保持可见。`show`、`hide`、`resize` 只能作为不等待响应的 WebSocket 通知发送，主窗口 UI 线程不得同步等待 Host 调整跨进程子窗口；否则 Host 的 `SetWindowPos` 可能反向等待父窗口处理消息，形成首次启动死锁。独立顶层窗口仍可接收显隐通知，但同样不得阻塞主窗口消息循环。

浏览器根 `Container` 必须设置 `flowEnabled: false`，否则流式布局会覆盖设计器中的绝对坐标。Menu、Popover 或 Dropdown 打开时，运行时暂时隐藏当前网页宿主，让 new_emoji 弹层保持可见；弹层关闭后恢复网页。

## 依赖和平台

- LingBuilder `0.3.0` 或更高版本。
- `lingbuilder.new_emoji.ui@>=2.0.0`。
- `lingbuilder.fbro.browser@>=2.2.0` 和 `lingbuilder.fbro.sdk@>=2.2.0`。
- Windows、MSVC、x64；当前不支持 Win32、ARM64、macOS 或其它浏览器后端。
- FBro 基础浏览不需要 VIP Key。指纹、截图等 VIP 功能仍按 FBro 模块自己的授权规则执行。

生成前会检查 MSVC x64、new_emoji DLL/导入库、LingBuilder FBro Bridge、CEF 135 运行时和 `FBroSubprocess.exe`。缺少或哈希不匹配时会产生中文阻断诊断，不会生成一个只在 IDE 内可运行的替代实现。

## 推荐入口

新建项目时选择模板 `new-emoji-fbro-browser-shell`。模板固定使用 1180 x 760、`new-emoji` 后端、`browserShell` 窗口框架预设和 x64 构建，并自动启用全部依赖模块。

模板完整复刻 `chrome_shell_demo.py` 的浏览器结构：Chrome 风格 Tabs、独立新建标签按钮、后退/前进/刷新、Omnibox、下载/扩展/更多菜单、三个右键菜单、下载/扩展弹层、自绘窗口按钮和响应式页面宿主。Tabs 控件宽度按实际标签总宽度计算，“+”始终紧跟最后一个标签，右侧空白标题区用于拖动窗口；标签变化后会异步刷新拖拽命中区。`SizeChanged` 与 `DpiChanged` 使用同一套 `控件_设置位置大小` 规则重新布局 new_emoji 元素和 FBro 页面宿主。

## 处理器和控件引用

控件参数必须使用设计器中的裸控件名，不能加引号。状态处理器必须使用 `&处理器名`，签名固定为：

```text
事件 浏览器状态改变(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)
    控件_设置文本(地址栏, 地址)
结束
```

创建外壳：

```text
浏览器外壳_创建(浏览器标签页, 浏览器页面占位, &浏览器状态改变)
浏览器外壳_新建标签页("home", "https://www.baidu.com", "新标签页")
```

标签页稳定 ID 是运行时映射主键。关闭、选择和重排都应传稳定 ID，不要把当前数组索引持久化为标签身份。

## 动态独立实例

动态管理器不预创建 `FBroBrowser` 控件，也没有固定实例数量常量。`浏览器外壳_新建独立实例` 每调用一次都会创建新的 Host 进程；实际数量只受 Windows 内存、句柄、进程和 FBro/CEF 资源约束，资源不足时返回失败。稳定 ID 和缓存目录必须唯一，禁止多个实例共享 Profile。

```text
浏览器外壳_创建(浏览器标签页, 浏览器页面占位, &浏览器状态改变)
浏览器外壳_绑定实例列表(浏览器实例列表)
浏览器外壳_新建独立实例("browser-1", "https://www.baidu.com", "实例 1", ".fbro-profiles/manager-1")

事件 _浏览器实例列表_选择变化(文本型 选中键列表)
    浏览器外壳_选择列表键(选中键列表)
结束
```

`浏览器外壳_绑定实例列表` 会把稳定 ID、标题、进程状态、Profile 标识和 PID 同步到 new_emoji `RichList`。隐藏 Tabs 表头不会丢失 Tabs 的动态标签集合和选择映射。

### RichList 会话模型

`new-emoji-fbro-richlist` 是与固定 `new-emoji-fbro-listbox` 示例相互独立的参考项目。它的 RichList 只负责显示和发出 `itemKey`/`actionId`，不能把行号或数组索引作为会话身份。运行时维护“稳定 ID -> 会话配置 -> Host PID / 伴随 HWND / Profile”的映射；上移、下移、置顶和沉底只重排稳定 ID，不交换浏览器实例、缓存目录或 Cookie。

- 新建必须调用 `浏览器外壳_新建独立实例`，并给稳定 ID 分配唯一 Profile 目录。
- 选择另一项时，外壳隐藏当前伴随宿主并显示目标宿主；未关闭会话不销毁，页面、历史和登录状态继续保留。
- `浏览器外壳_关闭实例` 只释放该实例的 Host 和 HWND，保留 RichList 项、稳定 ID、地址和 Profile；`浏览器外壳_重新打开实例` 用这些原始配置重新创建实例。
- `浏览器外壳_删除实例` 会先安全关闭，再删除表项和运行时绑定，并选择相邻会话。默认保留 Profile 目录，避免把删除列表项误认为删除登录数据。

### Cookie 隔离

Cookie 必须通过 `浏览器外壳_打开Cookie对话框` 或 `浏览器外壳_设置实例Cookie` 写入指定稳定 ID，不得通过网页脚本拼接。Host 使用该实例的 FBro RequestContext 调用 `LB_FBro_CookieSetAsync`，等待 `SetCookie` 完成回调和 `FlushStore` 完成回调后，再按名称和值读回确认；写入前后还会检查其它打开会话的 Cookie 快照。Cookie 文本、读回值和日志均不得输出明文。目标会话关闭、地址或 Cookie 格式无效、异步写入失败或跨会话状态异常时都必须返回中文失败状态。

## 命令

| 命令 | 说明 |
|---|---|
| `浏览器外壳_创建` | 绑定 Tabs、BrowserViewport 和状态处理器。 |
| `浏览器外壳_销毁` | 关闭所有页面并释放 FBro 句柄和伴随宿主。 |
| `浏览器外壳_新建标签页` | 按稳定 ID、地址和标题创建独立页面。 |
| `浏览器外壳_新建空白标签页` | 创建、选择一个运行时稳定 ID 标签页，并打开模板默认首页 `https://www.baidu.com`。命令名为兼容既有源码保留。 |
| `浏览器外壳_关闭标签页` | 关闭指定稳定 ID 标签页。 |
| `浏览器外壳_关闭当前标签页` | 关闭当前页；最后一页关闭后保持外壳可继续新建。 |
| `浏览器外壳_关闭其他标签页` | 保留当前页并关闭其余标签页及宿主。 |
| `浏览器外壳_取标签页数量` | 读取当前受管标签页数量，用于响应式 Tabs 布局。 |
| `浏览器外壳_选择标签页` | 选择页面并只显示对应 FBro 伴随宿主。 |
| `浏览器外壳_重排标签页` | 更新稳定 ID 到标签顺序的映射。 |
| `浏览器外壳_导航` | 导航当前标签页。 |
| `浏览器外壳_后退` / `浏览器外壳_前进` | 操作当前页历史。 |
| `浏览器外壳_刷新` / `浏览器外壳_停止` | 控制当前页加载。 |
| `浏览器外壳_取地址` / `浏览器外壳_取标题` | 读取当前页状态快照。 |
| `浏览器外壳_聚焦地址栏` | 将键盘焦点切换到指定 Omnibox。 |
| `浏览器外壳_绑定实例列表` / `浏览器外壳_选择列表键` | 同步 RichList 并按动态稳定 ID 切换实例。 |
| `浏览器外壳_新建独立实例` | 创建无固定软件数量上限的独立 Host、WebSocket、Profile 和 HWND。 |
| `浏览器外壳_关闭实例` / `浏览器外壳_重新打开实例` / `浏览器外壳_删除实例` | 按稳定 ID 管理独立会话的关闭、恢复和删除；删除默认保留 Profile。 |
| `浏览器外壳_处理实例列表动作` | 处理 RichList 的状态、关闭、删除、Cookie 与排序 actionId，并保持稳定 ID 绑定。 |
| `浏览器外壳_设置实例Cookie` / `浏览器外壳_打开Cookie对话框` / `浏览器外壳_取实例Cookie` | 对指定稳定会话写入、输入和读取 Cookie；写入使用 FBro Cookie API 并保持会话隔离。 |
| `浏览器外壳_取实例状态` / `浏览器外壳_取实例缓存目录` / `浏览器外壳_取实例进程ID` / `浏览器外壳_取实例宿主句柄` / `浏览器外壳_取实例顺序JSON` | 读取稳定 ID 绑定的状态、Profile、PID、HWND 和当前显示顺序。 |
| `浏览器外壳_取当前稳定ID` / `浏览器外壳_取当前进程状态` / `浏览器外壳_取当前进程ID` / `浏览器外壳_取当前调试端口` / `浏览器外壳_取当前错误` | 读取当前动态实例身份和进程状态。 |
| `浏览器外壳_强制刷新` / `浏览器外壳_执行JS` / `浏览器外壳_取Cookie` / `浏览器外壳_截图到文件` | 通过受控 WebSocket 操作当前独立 Host。 |
| `浏览器外壳_隐藏当前` / `浏览器外壳_显示当前` | 只改变当前实例显隐，不销毁页面状态。 |
| `浏览器外壳_取当前代理` / `浏览器外壳_取当前UserAgent` / `浏览器外壳_取当前指纹配置` / `浏览器外壳_取当前视口宽度` / `浏览器外壳_取当前视口高度` | 读取当前实例配置。 |
| `浏览器外壳_按配置重建当前` | 保留稳定 ID 和 Profile，按代理、UA、指纹和视口尺寸重启当前 Host。 |

完整源码见 [examples/MainWindow.lcpp](examples/MainWindow.lcpp)。

## 导出和部署

F5、原生预览和 Visual Studio 导出复用同一 C++ 生成器及模块依赖物化服务。导出工程构建后的 exe 同目录至少应包含 `new_emoji.dll`、`LingBuilderFbroBridge.dll`、`libcef.dll`、`chrome_elf.dll`、`FBroSubprocess.exe`、CEF resources 和 `locales`。不要只复制 exe，也不要手工替换某一份 DLL。

关闭主窗口时外壳会按 FBro 协议关闭全部浏览器并回收伴随宿主。若部署后存在残留进程，应先检查 Bridge、CEF 资产版本和哈希是否与导出工程一致。

## 一键分享源码包

在仓库的 `electron` 目录执行以下命令，可生成并回读验证可直接导入的完整源码包：

```bash
npm run demo:new-emoji-fbro-shell:export
```

输出为仓库根目录 `exports/new_emoji-FBro浏览器外壳完整复刻.lcpppkg`。包内包含 `.lcpp` 源码、设计器模型、x64 构建配置，以及 `new_emoji` 和 FBro SDK 的离线模块资产；内置外壳模块仍由 LingBuilder `0.3.0` 或更高版本提供。
