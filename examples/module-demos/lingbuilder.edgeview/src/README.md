# EdgeView 浏览器模块完整演示

- 模块 ID：`lingbuilder.edgeview`
- 版本：`1.6.0`
- 类型：LingBuilder 内置模块
- 命令数：324
- 设计器控件数：2
- 分组数：12

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

基于 Microsoft Edge WebView2，把浏览器嵌入任意 Win32 窗口组件句柄，并提供导航、网页消息、浏览器事件和 JavaScript 返回值。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `EdgeView任务_取当前任务ID` | `EdgeView任务_取当前任务ID()` | longLong | 取得当前 EdgeView 完成处理器正在消费的任务 ID。 |
| 2 | `EdgeView任务_取状态` | `EdgeView任务_取状态(任务ID)` | int | 取得任务状态：0等待、1成功、2失败、3已取消、4已超时。 |
| 3 | `EdgeView任务_取结果` | `EdgeView任务_取结果(任务ID)` | wideString | 取得任务 UTF-16 文本或 JSON 结果。 |
| 4 | `EdgeView任务_取错误` | `EdgeView任务_取错误(任务ID)` | wideString | 取得任务的中文错误信息和 HRESULT。 |
| 5 | `EdgeView任务_取消` | `EdgeView任务_取消(任务ID)` | int | 取消尚未完成的任务；迟到回调将被代际检查拒绝。 |
| 6 | `EdgeView任务_释放` | `EdgeView任务_释放(任务ID)` | int | 释放任务及结果；运行中的任务会先取消。 |
| 7 | `EdgeView导航_HTML` | `EdgeView导航_HTML(控件名, HTML)` | int | 让指定控件导航到内存 HTML。 |
| 8 | `EdgeView导航_请求` | `EdgeView导航_请求(控件名, 地址, 方法, 请求头, 正文)` | int | 使用文本请求头和 UTF-8 正文导航，不暴露 IStream。 |
| 9 | `EdgeView导航_停止` | `EdgeView导航_停止(控件名)` | int | 停止指定控件当前导航。 |
| 10 | `EdgeView导航_取地址` | `EdgeView导航_取地址(控件名)` | wideString | 取得当前页面地址。 |
| 11 | `EdgeView导航_取标题` | `EdgeView导航_取标题(控件名)` | wideString | 取得当前文档标题。 |
| 12 | `EdgeView导航_取状态JSON` | `EdgeView导航_取状态JSON(控件名)` | wideString | 取得后退、前进、挂起、主 Frame、进程、用户数据和故障报告目录状态 JSON。 |
| 13 | `EdgeView导航_取进程信息异步` | `EdgeView导航_取进程信息异步(控件名, 完成处理器)` | longLong | 异步取得进程 ID、类型和关联 Frame 数量 JSON；旧 Runtime 使用基础进程集合。 |
| 14 | `EdgeView导航_挂起异步` | `EdgeView导航_挂起异步(控件名, 完成处理器)` | longLong | 异步挂起 WebView，返回任务 ID。 |
| 15 | `EdgeView导航_恢复` | `EdgeView导航_恢复(控件名)` | int | 恢复已挂起的 WebView。 |
| 16 | `EdgeView导航_设置虚拟主机` | `EdgeView导航_设置虚拟主机(控件名, 主机名, 目录, 访问模式)` | int | 把虚拟主机映射到明确目录。 |
| 17 | `EdgeView导航_清除虚拟主机` | `EdgeView导航_清除虚拟主机(控件名, 主机名)` | int | 清除指定虚拟主机映射。 |
| 18 | `EdgeView脚本_文档预注入异步` | `EdgeView脚本_文档预注入异步(控件名, 脚本, 完成处理器)` | longLong | 注册文档创建前执行脚本，任务结果为脚本 ID。 |
| 19 | `EdgeView脚本_移除文档预注入` | `EdgeView脚本_移除文档预注入(控件名, 脚本ID)` | int | 移除文档预注入脚本。 |
| 20 | `EdgeView脚本_执行异步` | `EdgeView脚本_执行异步(控件名, 脚本, 完成处理器)` | longLong | 异步执行 JavaScript，任务结果为 JSON。 |
| 21 | `EdgeView脚本_执行详情异步` | `EdgeView脚本_执行详情异步(控件名, 脚本, 完成处理器)` | longLong | 异步执行 JavaScript，返回成功、JSON、字符串结果和异常详情。 |
| 22 | `EdgeView脚本_发送字符串消息` | `EdgeView脚本_发送字符串消息(控件名, 消息)` | int | 向网页发送字符串消息。 |
| 23 | `EdgeView脚本_发送JSON消息` | `EdgeView脚本_发送JSON消息(控件名, JSON)` | int | 向网页发送 JSON 消息。 |
| 24 | `EdgeView设置_置脚本执行` | `EdgeView设置_置脚本执行(控件名, 启用)` | int | 设置 脚本执行。 |
| 25 | `EdgeView设置_取脚本执行` | `EdgeView设置_取脚本执行(控件名)` | int | 取得 脚本执行 状态。 |
| 26 | `EdgeView设置_置网页消息` | `EdgeView设置_置网页消息(控件名, 启用)` | int | 设置 网页消息。 |
| 27 | `EdgeView设置_取网页消息` | `EdgeView设置_取网页消息(控件名)` | int | 取得 网页消息 状态。 |
| 28 | `EdgeView设置_置脚本对话框` | `EdgeView设置_置脚本对话框(控件名, 启用)` | int | 设置 脚本对话框。 |
| 29 | `EdgeView设置_取脚本对话框` | `EdgeView设置_取脚本对话框(控件名)` | int | 取得 脚本对话框 状态。 |
| 30 | `EdgeView设置_置状态栏` | `EdgeView设置_置状态栏(控件名, 启用)` | int | 设置 状态栏。 |
| 31 | `EdgeView设置_取状态栏` | `EdgeView设置_取状态栏(控件名)` | int | 取得 状态栏 状态。 |
| 32 | `EdgeView设置_置开发者工具` | `EdgeView设置_置开发者工具(控件名, 启用)` | int | 设置 开发者工具。 |
| 33 | `EdgeView设置_取开发者工具` | `EdgeView设置_取开发者工具(控件名)` | int | 取得 开发者工具 状态。 |
| 34 | `EdgeView设置_置右键菜单` | `EdgeView设置_置右键菜单(控件名, 启用)` | int | 设置 右键菜单。 |
| 35 | `EdgeView设置_取右键菜单` | `EdgeView设置_取右键菜单(控件名)` | int | 取得 右键菜单 状态。 |
| 36 | `EdgeView设置_置缩放控制` | `EdgeView设置_置缩放控制(控件名, 启用)` | int | 设置 缩放控制。 |
| 37 | `EdgeView设置_取缩放控制` | `EdgeView设置_取缩放控制(控件名)` | int | 取得 缩放控制 状态。 |
| 38 | `EdgeView设置_置内置错误页` | `EdgeView设置_置内置错误页(控件名, 启用)` | int | 设置 内置错误页。 |
| 39 | `EdgeView设置_取内置错误页` | `EdgeView设置_取内置错误页(控件名)` | int | 取得 内置错误页 状态。 |
| 40 | `EdgeView设置_置快捷键` | `EdgeView设置_置快捷键(控件名, 启用)` | int | 设置 快捷键。 |
| 41 | `EdgeView设置_取快捷键` | `EdgeView设置_取快捷键(控件名)` | int | 取得 快捷键 状态。 |
| 42 | `EdgeView设置_置密码自动保存` | `EdgeView设置_置密码自动保存(控件名, 启用)` | int | 设置 密码自动保存。 |
| 43 | `EdgeView设置_取密码自动保存` | `EdgeView设置_取密码自动保存(控件名)` | int | 取得 密码自动保存 状态。 |
| 44 | `EdgeView设置_置通用自动填充` | `EdgeView设置_置通用自动填充(控件名, 启用)` | int | 设置 通用自动填充。 |
| 45 | `EdgeView设置_取通用自动填充` | `EdgeView设置_取通用自动填充(控件名)` | int | 取得 通用自动填充 状态。 |
| 46 | `EdgeView设置_置捏合缩放` | `EdgeView设置_置捏合缩放(控件名, 启用)` | int | 设置 捏合缩放。 |
| 47 | `EdgeView设置_取捏合缩放` | `EdgeView设置_取捏合缩放(控件名)` | int | 取得 捏合缩放 状态。 |
| 48 | `EdgeView设置_置滑动导航` | `EdgeView设置_置滑动导航(控件名, 启用)` | int | 设置 滑动导航。 |
| 49 | `EdgeView设置_取滑动导航` | `EdgeView设置_取滑动导航(控件名)` | int | 取得 滑动导航 状态。 |
| 50 | `EdgeView设置_置用户代理` | `EdgeView设置_置用户代理(控件名, 用户代理)` | int | 设置控件 User-Agent。 |
| 51 | `EdgeView设置_取用户代理` | `EdgeView设置_取用户代理(控件名)` | wideString | 取得控件 User-Agent。 |
| 52 | `EdgeView设置_置缩放` | `EdgeView设置_置缩放(控件名, 缩放倍数)` | int | 设置控制器缩放倍数。 |
| 53 | `EdgeView设置_取缩放` | `EdgeView设置_取缩放(控件名)` | double | 取得控制器缩放倍数。 |
| 54 | `EdgeView设置_置静音` | `EdgeView设置_置静音(控件名, 静音)` | int | 设置网页静音状态。 |
| 55 | `EdgeView设置_取静音` | `EdgeView设置_取静音(控件名)` | int | 取得网页静音状态。 |
| 56 | `EdgeView设置_置背景色` | `EdgeView设置_置背景色(控件名, ARGB)` | int | 设置控制器默认背景色。 |
| 57 | `EdgeView设置_置可见` | `EdgeView设置_置可见(控件名, 可见)` | int | 设置控制器可见性。 |
| 58 | `EdgeView设置_取可见` | `EdgeView设置_取可见(控件名)` | int | 取得控制器可见性。 |
| 59 | `EdgeView设置_置边界` | `EdgeView设置_置边界(控件名, 左, 顶, 宽, 高)` | int | 设置控制器边界。 |
| 60 | `EdgeView设置_取边界JSON` | `EdgeView设置_取边界JSON(控件名)` | wideString | 取得控制器边界 JSON。 |
| 61 | `EdgeView设置_移动焦点` | `EdgeView设置_移动焦点(控件名, 原因)` | int | 按 WebView2 原因枚举移动焦点。 |
| 62 | `EdgeView设置_置光栅化缩放` | `EdgeView设置_置光栅化缩放(控件名, 缩放)` | int | 设置控制器光栅化缩放。 |
| 63 | `EdgeView设置_取光栅化缩放` | `EdgeView设置_取光栅化缩放(控件名)` | double | 取得控制器光栅化缩放。 |
| 64 | `EdgeView设置_置自动检测显示器缩放` | `EdgeView设置_置自动检测显示器缩放(控件名, 启用)` | int | 设置是否自动检测显示器缩放。 |
| 65 | `EdgeView设置_取自动检测显示器缩放` | `EdgeView设置_取自动检测显示器缩放(控件名)` | int | 取得自动检测显示器缩放状态。 |
| 66 | `EdgeView设置_置边界模式` | `EdgeView设置_置边界模式(控件名, 模式)` | int | 设置控制器边界模式。 |
| 67 | `EdgeView设置_取边界模式` | `EdgeView设置_取边界模式(控件名)` | int | 取得控制器边界模式。 |
| 68 | `EdgeView设置_置允许外部拖放` | `EdgeView设置_置允许外部拖放(控件名, 启用)` | int | 设置是否允许外部拖放。 |
| 69 | `EdgeView设置_取允许外部拖放` | `EdgeView设置_取允许外部拖放(控件名)` | int | 取得是否允许外部拖放。 |
| 70 | `EdgeView设置_置PDF工具栏隐藏项` | `EdgeView设置_置PDF工具栏隐藏项(控件名, 掩码)` | int | 设置 PDF 工具栏隐藏项掩码。 |
| 71 | `EdgeView设置_取PDF工具栏隐藏项` | `EdgeView设置_取PDF工具栏隐藏项(控件名)` | int | 取得 PDF 工具栏隐藏项掩码。 |
| 72 | `EdgeView设置_置信誉检查` | `EdgeView设置_置信誉检查(控件名, 启用)` | int | 设置是否要求 SmartScreen 信誉检查。 |
| 73 | `EdgeView设置_取信誉检查` | `EdgeView设置_取信誉检查(控件名)` | int | 取得信誉检查状态。 |
| 74 | `EdgeView设置_置内存目标级别` | `EdgeView设置_置内存目标级别(控件名, 级别)` | int | 设置 WebView 内存使用目标级别。 |
| 75 | `EdgeView设置_取内存目标级别` | `EdgeView设置_取内存目标级别(控件名)` | int | 取得 WebView 内存使用目标级别。 |
| 76 | `EdgeView创建选项_置独占用户目录` | `EdgeView创建选项_置独占用户目录(控件名, 启用)` | int | 设置创建期独占 UDF；修改后必须重建控件。 |
| 77 | `EdgeView创建选项_取独占用户目录` | `EdgeView创建选项_取独占用户目录(控件名)` | int | 取得创建期独占 UDF 设置。 |
| 78 | `EdgeView创建选项_置附加参数` | `EdgeView创建选项_置附加参数(控件名, 附加浏览器启动参数)` | int | 设置创建期浏览器启动参数，多个用空格分隔；修改后需要重建控件。 |
| 79 | `EdgeView创建选项_取附加参数` | `EdgeView创建选项_取附加参数(控件名)` | wideString | 取本控件创建期附加浏览器启动参数。 |
| 80 | `EdgeView创建选项_置跨域限制关闭` | `EdgeView创建选项_置跨域限制关闭(控件名, 是否关闭跨域)` | int | 设置是否关闭跨域安全策略；真则追加 --disable-web-security 与关闭站点隔离，仅用于受控内网页抓取，修改后需要重建控件。 |
| 81 | `EdgeView创建选项_取跨域限制关闭` | `EdgeView创建选项_取跨域限制关闭(控件名)` | int | 取本控件是否关闭跨域安全策略。 |
| 82 | `EdgeView创建选项_置自定义崩溃报告` | `EdgeView创建选项_置自定义崩溃报告(控件名, 启用)` | int | 设置创建期自定义崩溃报告开关。 |
| 83 | `EdgeView创建选项_取自定义崩溃报告` | `EdgeView创建选项_取自定义崩溃报告(控件名)` | int | 取得创建期自定义崩溃报告开关。 |
| 84 | `EdgeView创建选项_置跟踪保护` | `EdgeView创建选项_置跟踪保护(控件名, 启用)` | int | 设置创建期跟踪保护开关。 |
| 85 | `EdgeView创建选项_取跟踪保护` | `EdgeView创建选项_取跟踪保护(控件名)` | int | 取得创建期跟踪保护开关。 |
| 86 | `EdgeView创建选项_置浏览器扩展` | `EdgeView创建选项_置浏览器扩展(控件名, 启用)` | int | 设置创建期浏览器扩展开关。 |
| 87 | `EdgeView创建选项_取浏览器扩展` | `EdgeView创建选项_取浏览器扩展(控件名)` | int | 取得创建期浏览器扩展开关。 |
| 88 | `EdgeView创建选项_置通道搜索方式` | `EdgeView创建选项_置通道搜索方式(控件名, 方式)` | int | 设置创建期 Runtime 通道搜索方式。 |
| 89 | `EdgeView创建选项_取通道搜索方式` | `EdgeView创建选项_取通道搜索方式(控件名)` | int | 取得创建期 Runtime 通道搜索方式。 |
| 90 | `EdgeView创建选项_置发布通道` | `EdgeView创建选项_置发布通道(控件名, 通道掩码)` | int | 设置创建期允许的 Runtime 发布通道掩码。 |
| 91 | `EdgeView创建选项_取发布通道` | `EdgeView创建选项_取发布通道(控件名)` | int | 取得创建期 Runtime 发布通道掩码。 |
| 92 | `EdgeView创建选项_置滚动条样式` | `EdgeView创建选项_置滚动条样式(控件名, 样式)` | int | 设置创建期滚动条样式。 |
| 93 | `EdgeView创建选项_取滚动条样式` | `EdgeView创建选项_取滚动条样式(控件名)` | int | 取得创建期滚动条样式。 |
| 94 | `EdgeView创建选项_置脚本区域` | `EdgeView创建选项_置脚本区域(控件名, 区域)` | int | 设置创建期脚本区域；修改后必须重建。 |
| 95 | `EdgeView创建选项_取脚本区域` | `EdgeView创建选项_取脚本区域(控件名)` | wideString | 取得创建期脚本区域。 |
| 96 | `EdgeView创建选项_置默认背景色` | `EdgeView创建选项_置默认背景色(控件名, ARGB)` | int | 设置控制器创建期默认背景色。 |
| 97 | `EdgeView创建选项_取默认背景色` | `EdgeView创建选项_取默认背景色(控件名)` | int | 取得控制器创建期默认背景色。 |
| 98 | `EdgeView创建选项_置宿主输入处理` | `EdgeView创建选项_置宿主输入处理(控件名, 启用)` | int | 设置控制器创建期宿主输入处理开关。 |
| 99 | `EdgeView创建选项_取宿主输入处理` | `EdgeView创建选项_取宿主输入处理(控件名)` | int | 取得控制器创建期宿主输入处理开关。 |
| 100 | `EdgeView创建选项_添加自定义协议` | `EdgeView创建选项_添加自定义协议(控件名, 协议名, 含权限部分, 视为安全, 允许来源)` | int | 添加安全的自定义协议注册；允许来源以分号分隔，修改后必须重建。 |
| 101 | `EdgeView创建选项_清除自定义协议` | `EdgeView创建选项_清除自定义协议(控件名)` | int | 清除当前控件的创建期自定义协议注册。 |
| 102 | `EdgeView创建选项_重建控件` | `EdgeView创建选项_重建控件(控件名)` | int | 应用创建期选项并显式重建指定 Edge 控件。 |
| 103 | `EdgeView会话_取ProfileJSON` | `EdgeView会话_取ProfileJSON(控件名)` | wideString | 取得 Profile 名称、路径、隐私模式和下载目录 JSON。 |
| 104 | `EdgeView会话_取Cookie异步` | `EdgeView会话_取Cookie异步(控件名, 地址, 完成处理器)` | longLong | 异步取得 Cookie 列表 JSON。 |
| 105 | `EdgeView会话_置Cookie` | `EdgeView会话_置Cookie(控件名, 名称, 值, 域, 路径)` | int | 创建或更新 Cookie。 |
| 106 | `EdgeView会话_删除Cookie` | `EdgeView会话_删除Cookie(控件名, 名称, 域, 路径)` | int | 按名称、域和路径删除 Cookie。 |
| 107 | `EdgeView会话_删除全部Cookie` | `EdgeView会话_删除全部Cookie(控件名)` | int | 删除当前 Profile 全部 Cookie。 |
| 108 | `EdgeView会话_置Cookie带属性` | `EdgeView会话_置Cookie带属性(控件名, 名称, 值, 域, 路径, 过期时间, 安全, 仅HTTP, 同源策略)` | int | 创建或更新 Cookie，并设置过期时间、Secure、HttpOnly 和 SameSite；成功返回 1。 |
| 109 | `EdgeView会话_批量置Cookie` | `EdgeView会话_批量置Cookie(控件名, Cookie列表JSON)` | int | 按 Cookie JSON 数组批量注入 Cookie（支持 expires/secure/httpOnly/sameSite 元数据），返回成功注入条数；格式与 EdgeView会话_取Cookie异步 输出兼容。 |
| 110 | `EdgeView会话_清理浏览数据异步` | `EdgeView会话_清理浏览数据异步(控件名, 数据类型掩码, 完成处理器)` | longLong | 按 WebView2 数据类型掩码清理浏览数据。 |
| 111 | `EdgeView会话_清理全部浏览数据异步` | `EdgeView会话_清理全部浏览数据异步(控件名, 完成处理器)` | longLong | 清理当前 Profile 全部浏览数据。 |
| 112 | `EdgeView会话_按时间清理浏览数据异步` | `EdgeView会话_按时间清理浏览数据异步(控件名, 数据类型掩码, 开始时间, 结束时间, 完成处理器)` | longLong | 按 Unix 秒时间范围清理浏览数据。 |
| 113 | `EdgeView会话_置下载目录` | `EdgeView会话_置下载目录(控件名, 目录)` | int | 设置 Profile 默认下载目录。 |
| 114 | `EdgeView会话_取下载目录` | `EdgeView会话_取下载目录(控件名)` | wideString | 取得 Profile 默认下载目录。 |
| 115 | `EdgeView会话_置配色方案` | `EdgeView会话_置配色方案(控件名, 方案)` | int | 设置 Profile 首选配色方案。 |
| 116 | `EdgeView会话_取配色方案` | `EdgeView会话_取配色方案(控件名)` | int | 取得 Profile 首选配色方案。 |
| 117 | `EdgeView会话_置跟踪保护` | `EdgeView会话_置跟踪保护(控件名, 级别)` | int | 设置 Profile 跟踪保护级别。 |
| 118 | `EdgeView会话_取跟踪保护` | `EdgeView会话_取跟踪保护(控件名)` | int | 取得 Profile 跟踪保护级别。 |
| 119 | `EdgeView会话_置密码保存` | `EdgeView会话_置密码保存(控件名, 启用)` | int | 设置 Profile 密码自动保存。 |
| 120 | `EdgeView会话_取密码保存` | `EdgeView会话_取密码保存(控件名)` | int | 取得 Profile 密码自动保存状态。 |
| 121 | `EdgeView会话_置自动填充` | `EdgeView会话_置自动填充(控件名, 启用)` | int | 设置 Profile 通用自动填充。 |
| 122 | `EdgeView会话_取自动填充` | `EdgeView会话_取自动填充(控件名)` | int | 取得 Profile 通用自动填充状态。 |
| 123 | `EdgeView会话_删除Profile` | `EdgeView会话_删除Profile(控件名)` | int | 删除当前 Profile；删除完成通过事件清单中的对应完成事件通知。 |
| 124 | `EdgeView下载_取状态JSON` | `EdgeView下载_取状态JSON(控件名, 下载ID)` | wideString | 取得受管下载状态、地址、MIME、进度、可恢复性、中断原因、本次请求的 pendingResultFilePath 与 put_ResultFilePath 的 resultFilePathError JSON。在「下载开始」处理器内读到的 path 是决策前的默认落点快照，要确认改路径是否生效必须在事件结束后再读。 |
| 125 | `EdgeView下载_暂停` | `EdgeView下载_暂停(控件名, 下载ID)` | int | 暂停受管下载。 |
| 126 | `EdgeView下载_恢复` | `EdgeView下载_恢复(控件名, 下载ID)` | int | 恢复受管下载。 |
| 127 | `EdgeView下载_取消` | `EdgeView下载_取消(控件名, 下载ID)` | int | 取消受管下载。 |
| 128 | `EdgeView下载_显示默认窗口` | `EdgeView下载_显示默认窗口(控件名)` | int | 打开默认下载窗口。 |
| 129 | `EdgeView下载_关闭默认窗口` | `EdgeView下载_关闭默认窗口(控件名)` | int | 关闭默认下载窗口。 |
| 130 | `EdgeView下载_置窗口角对齐` | `EdgeView下载_置窗口角对齐(控件名, 对齐)` | int | 设置默认下载窗口角对齐。 |
| 131 | `EdgeView下载_取窗口角对齐` | `EdgeView下载_取窗口角对齐(控件名)` | int | 取得默认下载窗口角对齐。 |
| 132 | `EdgeView下载_置窗口边距` | `EdgeView下载_置窗口边距(控件名, 横向, 纵向)` | int | 设置默认下载窗口边距。 |
| 133 | `EdgeView下载_取窗口边距JSON` | `EdgeView下载_取窗口边距JSON(控件名)` | wideString | 取得默认下载窗口边距 JSON。 |
| 134 | `EdgeView查找_开始异步` | `EdgeView查找_开始异步(控件名, 文本, 选项JSON, 完成处理器)` | longLong | 开始页内查找，结果为匹配状态 JSON。 |
| 135 | `EdgeView查找_下一项` | `EdgeView查找_下一项(控件名)` | int | 移动到下一匹配项。 |
| 136 | `EdgeView查找_上一项` | `EdgeView查找_上一项(控件名)` | int | 移动到上一匹配项。 |
| 137 | `EdgeView查找_停止` | `EdgeView查找_停止(控件名)` | int | 停止页内查找并清除高亮。 |
| 138 | `EdgeView查找_取状态JSON` | `EdgeView查找_取状态JSON(控件名)` | wideString | 取得匹配数量和当前索引 JSON。 |
| 139 | `EdgeView打印_置方向` | `EdgeView打印_置方向(控件名, 值)` | int | 设置打印方向。 |
| 140 | `EdgeView打印_取方向` | `EdgeView打印_取方向(控件名)` | int | 取得打印方向。 |
| 141 | `EdgeView打印_置每面页数` | `EdgeView打印_置每面页数(控件名, 值)` | int | 设置打印每面页数。 |
| 142 | `EdgeView打印_取每面页数` | `EdgeView打印_取每面页数(控件名)` | int | 取得打印每面页数。 |
| 143 | `EdgeView打印_置份数` | `EdgeView打印_置份数(控件名, 值)` | int | 设置打印份数。 |
| 144 | `EdgeView打印_取份数` | `EdgeView打印_取份数(控件名)` | int | 取得打印份数。 |
| 145 | `EdgeView打印_置逐份打印` | `EdgeView打印_置逐份打印(控件名, 值)` | int | 设置打印逐份打印。 |
| 146 | `EdgeView打印_取逐份打印` | `EdgeView打印_取逐份打印(控件名)` | int | 取得打印逐份打印。 |
| 147 | `EdgeView打印_置颜色模式` | `EdgeView打印_置颜色模式(控件名, 值)` | int | 设置打印颜色模式。 |
| 148 | `EdgeView打印_取颜色模式` | `EdgeView打印_取颜色模式(控件名)` | int | 取得打印颜色模式。 |
| 149 | `EdgeView打印_置双面模式` | `EdgeView打印_置双面模式(控件名, 值)` | int | 设置打印双面模式。 |
| 150 | `EdgeView打印_取双面模式` | `EdgeView打印_取双面模式(控件名)` | int | 取得打印双面模式。 |
| 151 | `EdgeView打印_置纸张类型` | `EdgeView打印_置纸张类型(控件名, 值)` | int | 设置打印纸张类型。 |
| 152 | `EdgeView打印_取纸张类型` | `EdgeView打印_取纸张类型(控件名)` | int | 取得打印纸张类型。 |
| 153 | `EdgeView打印_置缩放倍数` | `EdgeView打印_置缩放倍数(控件名, 值)` | int | 设置打印缩放倍数。 |
| 154 | `EdgeView打印_取缩放倍数` | `EdgeView打印_取缩放倍数(控件名)` | double | 取得打印缩放倍数。 |
| 155 | `EdgeView打印_置纸张宽度` | `EdgeView打印_置纸张宽度(控件名, 值)` | int | 设置打印纸张宽度。 |
| 156 | `EdgeView打印_取纸张宽度` | `EdgeView打印_取纸张宽度(控件名)` | double | 取得打印纸张宽度。 |
| 157 | `EdgeView打印_置纸张高度` | `EdgeView打印_置纸张高度(控件名, 值)` | int | 设置打印纸张高度。 |
| 158 | `EdgeView打印_取纸张高度` | `EdgeView打印_取纸张高度(控件名)` | double | 取得打印纸张高度。 |
| 159 | `EdgeView打印_置上边距` | `EdgeView打印_置上边距(控件名, 值)` | int | 设置打印上边距。 |
| 160 | `EdgeView打印_取上边距` | `EdgeView打印_取上边距(控件名)` | double | 取得打印上边距。 |
| 161 | `EdgeView打印_置下边距` | `EdgeView打印_置下边距(控件名, 值)` | int | 设置打印下边距。 |
| 162 | `EdgeView打印_取下边距` | `EdgeView打印_取下边距(控件名)` | double | 取得打印下边距。 |
| 163 | `EdgeView打印_置左边距` | `EdgeView打印_置左边距(控件名, 值)` | int | 设置打印左边距。 |
| 164 | `EdgeView打印_取左边距` | `EdgeView打印_取左边距(控件名)` | double | 取得打印左边距。 |
| 165 | `EdgeView打印_置右边距` | `EdgeView打印_置右边距(控件名, 值)` | int | 设置打印右边距。 |
| 166 | `EdgeView打印_取右边距` | `EdgeView打印_取右边距(控件名)` | double | 取得打印右边距。 |
| 167 | `EdgeView打印_置打印背景` | `EdgeView打印_置打印背景(控件名, 启用)` | int | 设置是否打印背景。 |
| 168 | `EdgeView打印_取打印背景` | `EdgeView打印_取打印背景(控件名)` | int | 取得是否打印背景。 |
| 169 | `EdgeView打印_置仅打印选区` | `EdgeView打印_置仅打印选区(控件名, 启用)` | int | 设置是否仅打印选区。 |
| 170 | `EdgeView打印_取仅打印选区` | `EdgeView打印_取仅打印选区(控件名)` | int | 取得是否仅打印选区。 |
| 171 | `EdgeView打印_置打印页眉页脚` | `EdgeView打印_置打印页眉页脚(控件名, 启用)` | int | 设置是否打印页眉页脚。 |
| 172 | `EdgeView打印_取打印页眉页脚` | `EdgeView打印_取打印页眉页脚(控件名)` | int | 取得是否打印页眉页脚。 |
| 173 | `EdgeView打印_置页眉标题` | `EdgeView打印_置页眉标题(控件名, 文本)` | int | 设置打印页眉标题。 |
| 174 | `EdgeView打印_取页眉标题` | `EdgeView打印_取页眉标题(控件名)` | wideString | 取得打印页眉标题。 |
| 175 | `EdgeView打印_置页脚地址` | `EdgeView打印_置页脚地址(控件名, 文本)` | int | 设置打印页脚地址。 |
| 176 | `EdgeView打印_取页脚地址` | `EdgeView打印_取页脚地址(控件名)` | wideString | 取得打印页脚地址。 |
| 177 | `EdgeView打印_置页面范围` | `EdgeView打印_置页面范围(控件名, 文本)` | int | 设置打印页面范围。 |
| 178 | `EdgeView打印_取页面范围` | `EdgeView打印_取页面范围(控件名)` | wideString | 取得打印页面范围。 |
| 179 | `EdgeView打印_置打印机名称` | `EdgeView打印_置打印机名称(控件名, 文本)` | int | 设置打印打印机名称。 |
| 180 | `EdgeView打印_取打印机名称` | `EdgeView打印_取打印机名称(控件名)` | wideString | 取得打印打印机名称。 |
| 181 | `EdgeView打印_显示界面` | `EdgeView打印_显示界面(控件名, 界面类型)` | int | 显示系统或浏览器打印界面。 |
| 182 | `EdgeView打印_PDF异步` | `EdgeView打印_PDF异步(控件名, 文件路径, 设置JSON, 完成处理器)` | longLong | 把当前页面导出为 PDF 文件；相对路径先按当前工作目录解析成绝对路径再交给 WebView2，设置JSON 用 WebView2 驼峰键名覆盖本控件的打印设置，空对象表示不改设置。 |
| 183 | `EdgeView打印_PDF流到文件异步` | `EdgeView打印_PDF流到文件异步(控件名, 文件路径, 完成处理器)` | longLong | 使用 PrintToPdfStream 后把二进制结果写入明确文件路径。 |
| 184 | `EdgeView打印_打印异步` | `EdgeView打印_打印异步(控件名, 设置JSON, 完成处理器)` | longLong | 异步打印当前页面；设置JSON 用 WebView2 驼峰键名覆盖本控件的打印设置，空对象表示不改设置。 |
| 185 | `EdgeView媒体_截图异步` | `EdgeView媒体_截图异步(控件名, 文件路径, 格式, 完成处理器)` | longLong | 把页面截图写入文件路径（相对路径按当前工作目录解析），任务结果返回落盘后的绝对路径，不暴露 IStream。 |
| 186 | `EdgeView媒体_取Favicon异步` | `EdgeView媒体_取Favicon异步(控件名, 文件路径, 完成处理器)` | longLong | 把页面 Favicon 写入文件路径（相对路径按当前工作目录解析），任务结果返回落盘后的绝对路径。 |
| 187 | `EdgeView媒体_取全屏状态` | `EdgeView媒体_取全屏状态(控件名)` | int | 取得页面是否含全屏元素。 |
| 188 | `EdgeView媒体_取音频状态` | `EdgeView媒体_取音频状态(控件名)` | int | 取得页面是否正在播放音频。 |
| 189 | `EdgeView开发者工具_打开` | `EdgeView开发者工具_打开(控件名)` | int | 打开开发者工具窗口。 |
| 190 | `EdgeView开发者工具_打开任务管理器` | `EdgeView开发者工具_打开任务管理器(控件名)` | int | 打开 WebView2 任务管理器。 |
| 191 | `EdgeView开发者工具_调用异步` | `EdgeView开发者工具_调用异步(控件名, 方法, 参数JSON, 完成处理器)` | longLong | 调用 DevTools Protocol 方法，结果为 JSON。 |
| 192 | `EdgeView开发者工具_调用会话异步` | `EdgeView开发者工具_调用会话异步(控件名, 会话ID, 方法, 参数JSON, 完成处理器)` | longLong | 在指定 DevTools 会话调用协议方法。 |
| 193 | `EdgeView资源_添加过滤器` | `EdgeView资源_添加过滤器(控件名, URI模式, 上下文, 来源类型)` | int | 添加带请求来源类型的资源过滤器。 |
| 194 | `EdgeView资源_移除过滤器` | `EdgeView资源_移除过滤器(控件名, URI模式, 上下文)` | int | 移除资源过滤器。 |
| 195 | `EdgeView资源_移除来源过滤器` | `EdgeView资源_移除来源过滤器(控件名, URI模式, 上下文, 来源类型)` | int | 移除带请求来源类型的资源过滤器。 |
| 196 | `EdgeView资源_设置事件响应文本` | `EdgeView资源_设置事件响应文本(控件名, 状态码, 原因, 响应头, 正文)` | int | 在 Web资源请求同步事件中以限长 UTF-8 正文替换响应。 |
| 197 | `EdgeView资源_读响应正文异步` | `EdgeView资源_读响应正文异步(控件名, 响应句柄, 最大字节数, 完成处理器)` | longLong | 把响应流限长读取为十六进制 JSON，不暴露 IStream；必须在 Web资源响应收到 处理器执行期间交给本命令，处理器返回后 WebView2 会释放该响应的正文，稍后读取一律失败。 |
| 198 | `EdgeView事件_取字段` | `EdgeView事件_取字段(控件名, 字段名)` | wideString | 取得当前同步事件字段；右键菜单目标等复合参数会预先转换为字段。 |
| 199 | `EdgeView事件_设置动作` | `EdgeView事件_设置动作(控件名, 动作)` | int | 设置当前同步事件动作；未设置时保持 WebView2 默认行为。 |
| 200 | `EdgeView事件_设置返回文本` | `EdgeView事件_设置返回文本(控件名, 文本)` | int | 设置脚本对话框、认证或下载等事件返回文本。 |
| 201 | `EdgeView事件_设置认证` | `EdgeView事件_设置认证(控件名, 用户名, 密码)` | int | 设置当前基本身份验证请求凭据。 |
| 202 | `EdgeView事件_设置下载路径` | `EdgeView事件_设置下载路径(控件名, 文件路径)` | int | 设置当前下载开始事件的目标文件路径。只能在「下载开始」同步处理器执行期间调用；相对路径会按当前工作目录补全成绝对路径并自动创建父目录；实际落点必须在事件结束后用下载状态查询接口再读一次确认。 |
| 203 | `EdgeView事件_取菜单项JSON` | `EdgeView事件_取菜单项JSON(控件名, 菜单项句柄)` | wideString | 取得受管 WebView2 菜单项名称、标签、命令 ID、类型、状态、快捷键、图标存在性和子项句柄。 |
| 204 | `EdgeView事件_置菜单项勾选` | `EdgeView事件_置菜单项勾选(控件名, 菜单项句柄, 勾选)` | int | 设置受管菜单项勾选状态。 |
| 205 | `EdgeView事件_置菜单项启用` | `EdgeView事件_置菜单项启用(控件名, 菜单项句柄, 启用)` | int | 设置受管菜单项启用状态。 |
| 206 | `EdgeView对象_取状态JSON` | `EdgeView对象_取状态JSON(对象句柄)` | wideString | 取得受管对象类型、所属控件、generation、线程和生命周期状态。 |
| 207 | `EdgeView对象_释放` | `EdgeView对象_释放(对象句柄)` | int | 显式释放受管对象；句柄不会被复用。 |
| 208 | `EdgeView框架_枚举JSON` | `EdgeView框架_枚举JSON(控件名)` | wideString | 枚举当前控件已发现的 Frame 受管句柄和层级信息。 |
| 209 | `EdgeView框架_取信息JSON` | `EdgeView框架_取信息JSON(控件名, 框架句柄)` | wideString | 取得 Frame ID、名称、来源和生命周期信息。 |
| 210 | `EdgeView框架_执行脚本异步` | `EdgeView框架_执行脚本异步(控件名, 框架句柄, 脚本, 完成处理器)` | longLong | 在受管 Frame 中异步执行 JavaScript。 |
| 211 | `EdgeView框架_发送字符串消息` | `EdgeView框架_发送字符串消息(控件名, 框架句柄, 消息)` | int | 向受管 Frame 发送字符串消息。 |
| 212 | `EdgeView框架_发送JSON消息` | `EdgeView框架_发送JSON消息(控件名, 框架句柄, JSON)` | int | 向受管 Frame 发送 JSON 消息。 |
| 213 | `EdgeView框架_发送共享缓冲` | `EdgeView框架_发送共享缓冲(控件名, 框架句柄, 缓冲句柄, 访问模式, 附加JSON)` | int | 把受管共享缓冲发送到指定 Frame。 |
| 214 | `EdgeView填表_点击元素` | `EdgeView填表_点击元素(控件名, 框架句柄, 选择器, 序号)` | longLong | 按 CSS 选择器点击第序号个匹配元素（序号从 0 起，传 -1 取首个）；优先调用元素自身 click，失败时回退为合成 click 事件。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 215 | `EdgeView填表_滚动到元素` | `EdgeView填表_滚动到元素(控件名, 框架句柄, 选择器, 序号, 滚到顶部)` | longLong | 把匹配元素滚动到可视区域；滚到顶部为真时贴顶对齐，否则尽量贴底。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 216 | `EdgeView填表_聚焦元素` | `EdgeView填表_聚焦元素(控件名, 框架句柄, 选择器, 序号, 是否聚焦)` | longLong | 设置或移除匹配元素的输入焦点。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 217 | `EdgeView填表_赋值` | `EdgeView填表_赋值(控件名, 框架句柄, 选择器, 序号, 值)` | longLong | 给匹配元素写入表单值：具备 value 的控件写 value，其它元素写 textContent，并补发 input 与 change 事件。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 218 | `EdgeView填表_置选择框` | `EdgeView填表_置选择框(控件名, 框架句柄, 选择器, 序号, 是否选中)` | longLong | 设置复选框/单选框的勾选状态，并补发 change 事件。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 219 | `EdgeView填表_置选择项` | `EdgeView填表_置选择项(控件名, 框架句柄, 选择器, 序号, 选项序号)` | longLong | 把匹配下拉框选中第选项序号个 option（从 0 起），并补发 change 事件。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 220 | `EdgeView填表_置内文本` | `EdgeView填表_置内文本(控件名, 框架句柄, 选择器, 序号, 文本)` | longLong | 设置匹配元素的 innerText；不支持时降级为 textContent。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 221 | `EdgeView填表_置外文本` | `EdgeView填表_置外文本(控件名, 框架句柄, 选择器, 序号, 文本)` | longLong | 设置匹配元素的 outerText；不支持时降级为 textContent。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 222 | `EdgeView填表_置内代码` | `EdgeView填表_置内代码(控件名, 框架句柄, 选择器, 序号, 代码文本)` | longLong | 设置匹配元素的 innerHTML，可写入标签结构。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 223 | `EdgeView填表_置外代码` | `EdgeView填表_置外代码(控件名, 框架句柄, 选择器, 序号, 代码文本)` | longLong | 设置匹配元素的 outerHTML（含元素自身标签），会替换原元素。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 224 | `EdgeView填表_置属性` | `EdgeView填表_置属性(控件名, 框架句柄, 选择器, 序号, 属性名, 值)` | longLong | 给匹配元素设置指定 HTML 属性。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 225 | `EdgeView填表_触发事件` | `EdgeView填表_触发事件(控件名, 框架句柄, 选择器, 序号, 事件名, 按键代码)` | longLong | 在匹配元素上合成 DOM 事件；事件名如 click、dblclick、keydown、change、input，键盘类事件的按键代码回车传 13。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 226 | `EdgeView填表_取值` | `EdgeView填表_取值(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的值（无 value 时读 textContent），结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 227 | `EdgeView填表_取选择框` | `EdgeView填表_取选择框(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配复选框/单选框的勾选状态，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 228 | `EdgeView填表_取选择项` | `EdgeView填表_取选择项(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配下拉框当前选中项序号，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 229 | `EdgeView填表_取内文本` | `EdgeView填表_取内文本(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的 innerText，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 230 | `EdgeView填表_取外文本` | `EdgeView填表_取外文本(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的 outerText，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 231 | `EdgeView填表_取内代码` | `EdgeView填表_取内代码(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的 innerHTML，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 232 | `EdgeView填表_取外代码` | `EdgeView填表_取外代码(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的 outerHTML，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 233 | `EdgeView填表_取属性` | `EdgeView填表_取属性(控件名, 框架句柄, 选择器, 序号, 属性名, 完成处理器)` | longLong | 异步读取匹配元素指定 HTML 属性的值，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 234 | `EdgeView填表_元素是否存在` | `EdgeView填表_元素是否存在(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步判断选择器是否匹配到元素，结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 235 | `EdgeView填表_取坐标` | `EdgeView填表_取坐标(控件名, 框架句柄, 选择器, 序号, 完成处理器)` | longLong | 异步读取匹配元素的页面矩形（x/y/width/height），结果经完成处理器回传 JSON。 本命令返回受管任务 ID，结果在完成处理器里用 EdgeView任务_取结果读取。 |
| 236 | `EdgeView工作线程_枚举异步` | `EdgeView工作线程_枚举异步(控件名, 类型, 完成处理器)` | longLong | 枚举 Shared Worker 或 Service Worker；结果为受管句柄 JSON。 |
| 237 | `EdgeView工作线程_取信息JSON` | `EdgeView工作线程_取信息JSON(控件名, 工作线程句柄)` | wideString | 取得 Dedicated、Shared 或 Service Worker 类型及 URI 信息。 |
| 238 | `EdgeView工作线程_发送字符串消息` | `EdgeView工作线程_发送字符串消息(控件名, 工作线程句柄, 消息)` | int | 向支持消息的 Dedicated 或 Service Worker 发送字符串消息。 |
| 239 | `EdgeView工作线程_发送JSON消息` | `EdgeView工作线程_发送JSON消息(控件名, 工作线程句柄, JSON)` | int | 向支持消息的 Dedicated 或 Service Worker 发送 JSON 消息。 |
| 240 | `EdgeView工作线程_置ServiceWorker脚本API` | `EdgeView工作线程_置ServiceWorker脚本API(控件名, 启用)` | int | 设置 Service Worker 是否允许 WebView 脚本 API。 |
| 241 | `EdgeView工作线程_取ServiceWorker脚本API` | `EdgeView工作线程_取ServiceWorker脚本API(控件名)` | int | 取得 Service Worker 的 WebView 脚本 API 开关。 |
| 242 | `EdgeView扩展_安装异步` | `EdgeView扩展_安装异步(控件名, 扩展目录, 完成处理器)` | longLong | 从显式目录安装浏览器扩展，结果为受管扩展句柄。 |
| 243 | `EdgeView扩展_枚举异步` | `EdgeView扩展_枚举异步(控件名, 完成处理器)` | longLong | 枚举当前 Profile 的浏览器扩展。 |
| 244 | `EdgeView扩展_置启用异步` | `EdgeView扩展_置启用异步(控件名, 扩展句柄, 启用, 完成处理器)` | longLong | 异步启用或禁用受管浏览器扩展。 |
| 245 | `EdgeView扩展_删除异步` | `EdgeView扩展_删除异步(控件名, 扩展句柄, 完成处理器)` | longLong | 异步删除受管浏览器扩展。 |
| 246 | `EdgeView权限_枚举异步` | `EdgeView权限_枚举异步(控件名, 完成处理器)` | longLong | 枚举当前 Profile 的非默认权限设置。 |
| 247 | `EdgeView权限_设置异步` | `EdgeView权限_设置异步(控件名, 权限类型, 来源, 状态, 完成处理器)` | longLong | 异步设置指定来源的权限状态。 |
| 248 | `EdgeView通知_取信息JSON` | `EdgeView通知_取信息JSON(控件名, 通知句柄)` | wideString | 取得受管通知的标题、正文、语言和状态；来源由“通知收到”事件提供。 |
| 249 | `EdgeView通知_报告已显示` | `EdgeView通知_报告已显示(控件名, 通知句柄)` | int | 向 WebView2 报告自定义通知已显示。 |
| 250 | `EdgeView通知_报告单击` | `EdgeView通知_报告单击(控件名, 通知句柄)` | int | 向 WebView2 报告通知被单击。 |
| 251 | `EdgeView通知_报告关闭` | `EdgeView通知_报告关闭(控件名, 通知句柄)` | int | 向 WebView2 报告通知已关闭。 |
| 252 | `EdgeView缓冲_创建` | `EdgeView缓冲_创建(控件名, 字节数)` | handle | 创建不超过 16 MiB 的受管共享缓冲。 |
| 253 | `EdgeView缓冲_取大小` | `EdgeView缓冲_取大小(控件名, 缓冲句柄)` | longLong | 取得受管共享缓冲大小。 |
| 254 | `EdgeView缓冲_写十六进制` | `EdgeView缓冲_写十六进制(控件名, 缓冲句柄, 十六进制)` | int | 把限长十六进制数据写入受管共享缓冲。 |
| 255 | `EdgeView缓冲_读十六进制` | `EdgeView缓冲_读十六进制(控件名, 缓冲句柄, 最大字节数)` | wideString | 从受管共享缓冲读取限长十六进制。 |
| 256 | `EdgeView缓冲_发送到网页` | `EdgeView缓冲_发送到网页(控件名, 缓冲句柄, 访问模式, 附加JSON)` | int | 把共享缓冲以只读或读写模式发送到网页。 |
| 257 | `EdgeView安全_取证书JSON` | `EdgeView安全_取证书JSON(控件名, 证书句柄)` | wideString | 取得受管客户端或服务器证书的主题、签发者、有效期、序列号、显示名和 PEM。 |
| 258 | `EdgeView安全_选择客户端证书` | `EdgeView安全_选择客户端证书(控件名, 证书句柄)` | int | 在客户端证书同步决策事件中选择受管证书。 |
| 259 | `EdgeView安全_清除证书错误决策异步` | `EdgeView安全_清除证书错误决策异步(控件名, 完成处理器)` | longLong | 清除当前 WebView 的服务器证书错误持久决策。 |
| 260 | `EdgeView安全_显示另存为界面异步` | `EdgeView安全_显示另存为界面异步(控件名, 完成处理器)` | longLong | 显示 WebView2 另存为界面并返回状态。 |
| 261 | `EdgeView对象_取文件路径` | `EdgeView对象_取文件路径(控件名, 对象句柄)` | wideString | 从受管 File 对象取得安全文件路径。 |
| 262 | `EdgeView对象_创建文件系统句柄` | `EdgeView对象_创建文件系统句柄(控件名, 路径, 目录, 权限)` | handle | 从绝对路径创建受管文件或目录句柄；拒绝相对路径和不存在路径。 |
| 263 | `EdgeView脚本_发送附加对象JSON` | `EdgeView脚本_发送附加对象JSON(控件名, JSON, 对象句柄)` | int | 向网页发送 JSON 与一个受管文件系统附加对象。 |
| 264 | `EdgeView_创建` | `EdgeView_创建(父组件句柄, 地址)` | int | 在指定 HWND 组件客户区内创建 EdgeView；传 0 时嵌入当前窗口。成功返回 1。 |
| 265 | `EdgeView_创建实例` | `EdgeView_创建实例(实例编号, 父组件句柄, 地址, 独立缓存目录)` | int | 创建具名 EdgeView 实例；不同缓存目录拥有独立 Cookie、存储和会话。 |
| 266 | `EdgeView_创建实例代理` | `EdgeView_创建实例代理(实例编号, 父组件句柄, 地址, 独立缓存目录, 代理地址)` | int | 创建使用独立代理的 EdgeView 实例；该代理覆盖全局代理。 |
| 267 | `EdgeView_创建区域` | `EdgeView_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录)` | int | 在当前窗口指定区域创建独立承载 HWND 和 EdgeView 实例。 |
| 268 | `EdgeView_创建区域代理` | `EdgeView_创建区域代理(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)` | int | 在指定区域创建使用独立代理的 EdgeView 实例。 |
| 269 | `EdgeView_创建区域代理UA` | `EdgeView_创建区域代理UA(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址, 用户代理)` | int | 带独立代理与独立 User-Agent 的区域实例：UA 在首次导航前应用（可让出站请求头完全脱离 WebView2 默认 UA，例如屏蔽 Edg/ 标记的场景），代理语义与 EdgeView_创建区域代理 相同。运行期再改 UA 请用 EdgeView设置_置用户代理实例。 |
| 270 | `EdgeView_设置全局代理` | `EdgeView_设置全局代理(代理地址)` | int | 设置后续新建 EdgeView 实例默认使用的 HTTP/HTTPS/SOCKS5 代理；现有实例不变。 |
| 271 | `EdgeView_清除全局代理` | `EdgeView_清除全局代理()` | void | 清除后续新建实例的全局代理，现有实例不变。 |
| 272 | `EdgeView_取全局代理` | `EdgeView_取全局代理()` | wideString | 返回当前 EdgeView 全局代理设置。 |
| 273 | `EdgeView_取实例代理` | `EdgeView_取实例代理(实例编号)` | wideString | 返回指定实例创建时实际采用的代理地址。 |
| 274 | `EdgeView_绑定事件` | `EdgeView_绑定事件(实例编号, 事件名, &处理器名)` | int | 绑定 WebView2 完整事件清单中的中文事件；当前清单共 71 项。旧字符串处理器仍兼容，但会产生迁移警告。 |
| 275 | `EdgeView_监听开发者工具事件` | `EdgeView_监听开发者工具事件(实例编号, 协议事件名)` | int | 监听指定 Chromium DevTools Protocol 事件，触发“开发者工具协议事件”。 |
| 276 | `EdgeView_等待事件` | `EdgeView_等待事件(实例编号, 事件名, 超时毫秒)` | int | 泵送窗口消息并等待指定浏览器事件，成功返回 1，超时返回 0。 |
| 277 | `EdgeView_等待事件控件` | `EdgeView_等待事件控件(控件名, 事件名, 超时毫秒)` | int | 在设计器 Edge 浏览器控件上泵送消息并等待指定中文事件，成功返回 1，超时或控件不存在返回 0。用于在“创建完毕”里等页面就绪后再调用同步命令；不能在其它浏览器事件处理器内调用，否则同样会等满超时。 |
| 278 | `EdgeView_导航` | `EdgeView_导航(地址)` | int | 导航到 HTTP/HTTPS 地址或本地文件地址。 |
| 279 | `EdgeView_导航实例` | `EdgeView_导航实例(实例编号, 地址)` | int | 让指定 EdgeView 实例导航。 |
| 280 | `EdgeView_执行JS` | `EdgeView_执行JS(脚本)` | wideString | 执行 JavaScript 并等待异步回调，返回 WebView2 的 JSON 编码结果；失败返回空文本。 |
| 281 | `EdgeView_执行JS实例` | `EdgeView_执行JS实例(实例编号, 脚本)` | wideString | 在指定实例执行 JavaScript，并返回 WebView2 JSON 编码结果。 |
| 282 | `EdgeView_取最近事件` | `EdgeView_取最近事件()` | wideString | 返回最近触发的 WebView2 中文事件名。 |
| 283 | `EdgeView_取事件数据` | `EdgeView_取事件数据()` | wideString | 返回最近事件携带的 UTF-16 JSON 对象文本。 |
| 284 | `EdgeView_取最近事件实例` | `EdgeView_取最近事件实例(实例编号)` | wideString | 返回指定浏览器实例最近事件名。 |
| 285 | `EdgeView_取事件数据实例` | `EdgeView_取事件数据实例(实例编号)` | wideString | 返回指定浏览器实例最近事件携带的数据。 |
| 286 | `EdgeView_后退` | `EdgeView_后退()` | int | 浏览器可以后退时返回上一页。 |
| 287 | `EdgeView_前进` | `EdgeView_前进()` | int | 浏览器可以前进时进入下一页。 |
| 288 | `EdgeView_刷新` | `EdgeView_刷新()` | void | 刷新当前网页。 |
| 289 | `EdgeView_关闭` | `EdgeView_关闭()` | void | 关闭浏览器控制器并释放 WebView2 资源。 |
| 290 | `EdgeView_关闭实例` | `EdgeView_关闭实例(实例编号)` | void | 关闭指定 EdgeView 实例并释放其承载窗口。 |
| 291 | `EdgeView_创建控件` | `EdgeView_创建控件(控件名)` | int | 使用设计器属性重新创建指定 Edge 浏览器控件；空文本创建当前窗口全部 Edge 浏览器控件。 |
| 292 | `EdgeView_导航控件` | `EdgeView_导航控件(控件名, 地址)` | int | 让指定设计器 Edge 浏览器控件导航到新地址。 |
| 293 | `EdgeView_执行JS控件` | `EdgeView_执行JS控件(控件名, 脚本)` | wideString | 在指定设计器 Edge 浏览器控件中执行 JavaScript 并返回 JSON 编码结果。 |
| 294 | `EdgeView_取最近事件控件` | `EdgeView_取最近事件控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近触发的事件名。 |
| 295 | `EdgeView_取事件数据控件` | `EdgeView_取事件数据控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近事件的数据。 |
| 296 | `EdgeView_后退控件` | `EdgeView_后退控件(控件名)` | int | 让指定设计器 Edge 浏览器控件后退。 |
| 297 | `EdgeView_前进控件` | `EdgeView_前进控件(控件名)` | int | 让指定设计器 Edge 浏览器控件前进。 |
| 298 | `EdgeView_刷新控件` | `EdgeView_刷新控件(控件名)` | void | 刷新指定设计器 Edge 浏览器控件。 |
| 299 | `EdgeView_关闭控件` | `EdgeView_关闭控件(控件名)` | void | 关闭指定设计器 Edge 浏览器控件并保留设计器宿主占位。 |
| 300 | `EdgeView_绑定控件事件` | `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)` | int | 按控件名绑定 WebView2 完整事件清单中的中文事件；当前清单共 71 项。旧字符串处理器仍兼容，但会产生迁移警告。 |
| 301 | `EdgeView_监听开发者工具事件控件` | `EdgeView_监听开发者工具事件控件(控件名, 协议事件名)` | int | 按设计器控件名监听 Chromium DevTools Protocol 事件。 |
| 302 | `EdgeView_创建弹窗浏览器` | `EdgeView_创建弹窗浏览器(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)` | int | 创建独立顶层浏览器弹窗（任务栏可见、可独立拖动缩放、页面随窗口自适应），用指定独立缓存目录实现店铺间 Cookie/存储隔离，并在首次导航前应用 User-Agent。实例编号供 导航实例/关闭实例/绑定事件/等待事件/执行JS实例/会话命令 复用；关闭主窗口会连带关闭全部弹窗。代理沿用 EdgeView_设置全局代理；要每个弹窗各走独立代理 IP 请用 EdgeView_创建弹窗浏览器代理。成功返回 1。 |
| 303 | `EdgeView_创建弹窗浏览器代理` | `EdgeView_创建弹窗浏览器代理(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理, 代理地址)` | int | 创建带独立代理的顶层浏览器弹窗：代理地址非空时该弹窗用专属 HTTP/HTTPS/SOCKS5 代理（配合不同独立缓存目录=独立浏览器进程，实现每店铺独立出口 IP）；代理地址为空时回落到 EdgeView_设置全局代理，与创建实例/创建实例代理同一语义。 |
| 304 | `EdgeView_创建弹窗浏览器初始隐藏` | `EdgeView_创建弹窗浏览器初始隐藏(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)` | int | 与 EdgeView_创建弹窗浏览器 相同，但宿主窗口创建时不显示（消除首帧闪窗），需要人工可见时用 EdgeView_置实例可见(实例编号, 真) 唤出；适合先建后按需展示的多开场景。 |
| 305 | `EdgeView_创建弹窗浏览器初始隐藏代理` | `EdgeView_创建弹窗浏览器初始隐藏代理(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理, 代理地址)` | int | 带独立代理的初始隐藏弹窗：代理语义与 EdgeView_创建弹窗浏览器代理 相同（空值回落全局代理），窗口创建时不显示，置实例可见 可唤出。 |
| 306 | `EdgeView_创建无头实例` | `EdgeView_创建无头实例(实例编号, 地址, 独立缓存目录)` | int | 创建无界面 EdgeView 浏览器：内部挂一个从不调用 ShowWindow 的离屏隐藏宿主（WebView2 官方无头 API 不存在，控制器必须挂窗口，这是平台允许的最接近无头形态），任务栏与界面完全不可见。导航实例/执行JS实例/等待事件/绑定事件/会话 Cookie 族/UA/独立代理等全部实例编号命令照常可用；控制台项目可用（创建与等待自带消息泵）。rAF/IntersectionObserver 等可见性相关行为按隐藏页节流；截图类命令在无头实例上不可用，需要页面图像请改用 CDP_启动浏览器（真无头独立进程）。返回 1 成功。 |
| 307 | `EdgeView_创建无头实例代理` | `EdgeView_创建无头实例代理(实例编号, 地址, 独立缓存目录, 用户代理, 代理地址)` | int | 创建带独立用户代理与独立代理的无头 EdgeView 实例：代理地址非空走专属代理（空值回落 EdgeView_设置全局代理）；用户代理需传非空且等效真实 UA。适合后台多账号抓取/自动化，界面零显示。 |
| 308 | `EdgeView_泵消息` | `EdgeView_泵消息(等待毫秒)` | int | 泵送当前线程消息队列指定毫秒（0=只清队列不等待），返回处理掉的消息数；用于控制台/无头场景驱动 WebView2 回调、线程完成处理器与 CDP/HTTP/WS 派发消息（等待事件、创建无头实例内部已自带泵，通常只需在等待多个异步结果时循环调用）。遇 WM_QUIT 立即返回。 |
| 309 | `EdgeView_关闭全部实例` | `EdgeView_关闭全部实例()` | int | 关闭当前全部 EdgeView 实例（弹窗、区域、控件实例一并释放）并返回关闭数量。 |
| 310 | `EdgeView_枚举实例JSON` | `EdgeView_枚举实例JSON()` | wideString | 返回当前全部 EdgeView 实例的 JSON 数组，每项含 实例编号/窗口标题/地址/缓存目录/代理/是否弹窗/是否无头/是否有效，供调用方自省与列表展示。 |
| 311 | `EdgeView_置实例可见` | `EdgeView_置实例可见(实例编号, 可见)` | int | 按实例编号显示或隐藏：弹窗实例连带顶层窗口显隐，区域/控件实例调整控制器可见性。 |
| 312 | `EdgeView_置实例大小` | `EdgeView_置实例大小(实例编号, 宽, 高)` | int | 按实例编号设置浏览器尺寸；弹窗实例调整顶层窗口客户区并自适应，区域/控件实例设置控制器边界。 |
| 313 | `EdgeView_置区域位置` | `EdgeView_置区域位置(实例编号, 左, 顶, 宽, 高)` | int | 按实例编号移动并缩放 EdgeView_创建区域 的承载区域（窗口内逻辑坐标，按 DPI 自动缩放），并把网页内容对齐到新矩形。顶部留导航条/边距的区域浏览器必须在窗口「大小被改变」事件里调用本命令同步区域，窗口缩放才跟手且不会白屏；创建时铺满整个窗口的区域会自动跟随窗口缩放，无需调用。弹窗实例请用 EdgeView_置实例大小。成功返回 1。 |
| 314 | `EdgeView_取实例大小JSON` | `EdgeView_取实例大小JSON(实例编号)` | wideString | 按实例编号返回当前客户区尺寸 JSON：{"宽":..,"高":..}。数值为物理像素（创建时按窗口 DPI 缩放，150% 缩放下 800 逻辑宽返回 1200）；无头实例同样可用。 |
| 315 | `EdgeView_置实例标题` | `EdgeView_置实例标题(实例编号, 标题)` | int | 按实例编号设置弹窗顶层窗口标题，便于人工识别店铺。 |
| 316 | `EdgeView设置_置用户代理实例` | `EdgeView设置_置用户代理实例(实例编号, 用户代理)` | int | 按实例编号设置 User-Agent；建议用 EdgeView_创建弹窗浏览器 的 用户代理 参数在首次导航前设定，运行时再改首个请求已带旧 UA。 |
| 317 | `EdgeView脚本_文档预注入实例异步` | `EdgeView脚本_文档预注入实例异步(实例编号, 脚本, &完成处理器)` | longLong | 按实例编号注册「每个新文档创建前自动执行」的脚本（document-start 语义，先于页面脚本），任务结果为脚本 ID。区域/弹窗/无头实例均可用；设计器 EdgeBrowser 控件请用 EdgeView脚本_文档预注入异步。 |
| 318 | `EdgeView脚本_移除文档预注入实例` | `EdgeView脚本_移除文档预注入实例(实例编号, 脚本ID)` | int | 按实例编号移除文档预注入脚本；脚本 ID 来自注册任务的结果。 |
| 319 | `EdgeView设置_取用户代理实例` | `EdgeView设置_取用户代理实例(实例编号)` | wideString | 按实例编号读取当前 User-Agent。 |
| 320 | `EdgeView会话_批量置Cookie实例` | `EdgeView会话_批量置Cookie实例(实例编号, Cookie列表JSON)` | int | 按实例编号批量注入 Cookie，返回成功条数。Cookie列表JSON 为含 name/value/domain/path 的数组，可带 expires（UTC 秒，会话 Cookie 用 -1 或省略）、secure、httpOnly、sameSite（0 None/1 Lax/2 Strict，None 必须同时 secure）。这是注入 HttpOnly Cookie 的正确方式，禁止用 JavaScript document.cookie。 |
| 321 | `EdgeView会话_置Cookie带属性实例` | `EdgeView会话_置Cookie带属性实例(实例编号, 名称, 值, 域, 路径, 过期时间, 安全, 仅HTTP, 同源策略)` | int | 按实例编号创建或更新带完整属性的 Cookie；过期时间为 UTC 秒（会话 Cookie 传 -1），安全/仅HTTP 传 1/0，同源策略 0 None/1 Lax/2 Strict。 |
| 322 | `EdgeView会话_删除全部Cookie实例` | `EdgeView会话_删除全部Cookie实例(实例编号)` | int | 按实例编号删除该实例 Profile 的全部 Cookie。 |
| 323 | `EdgeView会话_取Cookie实例异步` | `EdgeView会话_取Cookie实例异步(实例编号, 地址, &完成处理器)` | longLong | 按实例编号异步读取指定地址的 Cookie 列表 JSON，完成后在 完成处理器 里用 EdgeView任务_取结果 取值，可校验 httpOnly 标志是否回读成功。 |
| 324 | `EdgeView会话_清理全部浏览数据实例异步` | `EdgeView会话_清理全部浏览数据实例异步(实例编号, &完成处理器)` | longLong | 按实例编号异步清理该实例 Profile 的全部浏览数据。 |
