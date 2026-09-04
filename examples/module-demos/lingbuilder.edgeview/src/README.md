# EdgeView 浏览器模块完整演示

> 本文件的 271 条命令签名与说明用于可复制示例；权威 API 参考为模块文档 [API.md](../../../../electron/docs/modules/edgeview/API.md)，修改模块目录后请运行 \`npm run module:edgeview-api-docs\` 同步。

- 模块 ID：`lingbuilder.edgeview`
- 版本：`1.2.0`
- 类型：LingBuilder 内置模块
- 命令数：271
- 设计器控件数：1
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
| 78 | `EdgeView创建选项_置自定义崩溃报告` | `EdgeView创建选项_置自定义崩溃报告(控件名, 启用)` | int | 设置创建期自定义崩溃报告开关。 |
| 79 | `EdgeView创建选项_取自定义崩溃报告` | `EdgeView创建选项_取自定义崩溃报告(控件名)` | int | 取得创建期自定义崩溃报告开关。 |
| 80 | `EdgeView创建选项_置跟踪保护` | `EdgeView创建选项_置跟踪保护(控件名, 启用)` | int | 设置创建期跟踪保护开关。 |
| 81 | `EdgeView创建选项_取跟踪保护` | `EdgeView创建选项_取跟踪保护(控件名)` | int | 取得创建期跟踪保护开关。 |
| 82 | `EdgeView创建选项_置浏览器扩展` | `EdgeView创建选项_置浏览器扩展(控件名, 启用)` | int | 设置创建期浏览器扩展开关。 |
| 83 | `EdgeView创建选项_取浏览器扩展` | `EdgeView创建选项_取浏览器扩展(控件名)` | int | 取得创建期浏览器扩展开关。 |
| 84 | `EdgeView创建选项_置通道搜索方式` | `EdgeView创建选项_置通道搜索方式(控件名, 方式)` | int | 设置创建期 Runtime 通道搜索方式。 |
| 85 | `EdgeView创建选项_取通道搜索方式` | `EdgeView创建选项_取通道搜索方式(控件名)` | int | 取得创建期 Runtime 通道搜索方式。 |
| 86 | `EdgeView创建选项_置发布通道` | `EdgeView创建选项_置发布通道(控件名, 通道掩码)` | int | 设置创建期允许的 Runtime 发布通道掩码。 |
| 87 | `EdgeView创建选项_取发布通道` | `EdgeView创建选项_取发布通道(控件名)` | int | 取得创建期 Runtime 发布通道掩码。 |
| 88 | `EdgeView创建选项_置滚动条样式` | `EdgeView创建选项_置滚动条样式(控件名, 样式)` | int | 设置创建期滚动条样式。 |
| 89 | `EdgeView创建选项_取滚动条样式` | `EdgeView创建选项_取滚动条样式(控件名)` | int | 取得创建期滚动条样式。 |
| 90 | `EdgeView创建选项_置脚本区域` | `EdgeView创建选项_置脚本区域(控件名, 区域)` | int | 设置创建期脚本区域；修改后必须重建。 |
| 91 | `EdgeView创建选项_取脚本区域` | `EdgeView创建选项_取脚本区域(控件名)` | wideString | 取得创建期脚本区域。 |
| 92 | `EdgeView创建选项_置默认背景色` | `EdgeView创建选项_置默认背景色(控件名, ARGB)` | int | 设置控制器创建期默认背景色。 |
| 93 | `EdgeView创建选项_取默认背景色` | `EdgeView创建选项_取默认背景色(控件名)` | int | 取得控制器创建期默认背景色。 |
| 94 | `EdgeView创建选项_置宿主输入处理` | `EdgeView创建选项_置宿主输入处理(控件名, 启用)` | int | 设置控制器创建期宿主输入处理开关。 |
| 95 | `EdgeView创建选项_取宿主输入处理` | `EdgeView创建选项_取宿主输入处理(控件名)` | int | 取得控制器创建期宿主输入处理开关。 |
| 96 | `EdgeView创建选项_添加自定义协议` | `EdgeView创建选项_添加自定义协议(控件名, 协议名, 含权限部分, 视为安全, 允许来源)` | int | 添加安全的自定义协议注册；允许来源以分号分隔，修改后必须重建。 |
| 97 | `EdgeView创建选项_清除自定义协议` | `EdgeView创建选项_清除自定义协议(控件名)` | int | 清除当前控件的创建期自定义协议注册。 |
| 98 | `EdgeView创建选项_重建控件` | `EdgeView创建选项_重建控件(控件名)` | int | 应用创建期选项并显式重建指定 Edge 控件。 |
| 99 | `EdgeView会话_取ProfileJSON` | `EdgeView会话_取ProfileJSON(控件名)` | wideString | 取得 Profile 名称、路径、隐私模式和下载目录 JSON。 |
| 100 | `EdgeView会话_取Cookie异步` | `EdgeView会话_取Cookie异步(控件名, 地址, 完成处理器)` | longLong | 异步取得 Cookie 列表 JSON。 |
| 101 | `EdgeView会话_置Cookie` | `EdgeView会话_置Cookie(控件名, 名称, 值, 域, 路径)` | int | 创建或更新 Cookie。 |
| 102 | `EdgeView会话_删除Cookie` | `EdgeView会话_删除Cookie(控件名, 名称, 域, 路径)` | int | 按名称、域和路径删除 Cookie。 |
| 103 | `EdgeView会话_删除全部Cookie` | `EdgeView会话_删除全部Cookie(控件名)` | int | 删除当前 Profile 全部 Cookie。 |
| 104 | `EdgeView会话_清理浏览数据异步` | `EdgeView会话_清理浏览数据异步(控件名, 数据类型掩码, 完成处理器)` | longLong | 按 WebView2 数据类型掩码清理浏览数据。 |
| 105 | `EdgeView会话_清理全部浏览数据异步` | `EdgeView会话_清理全部浏览数据异步(控件名, 完成处理器)` | longLong | 清理当前 Profile 全部浏览数据。 |
| 106 | `EdgeView会话_按时间清理浏览数据异步` | `EdgeView会话_按时间清理浏览数据异步(控件名, 数据类型掩码, 开始时间, 结束时间, 完成处理器)` | longLong | 按 Unix 秒时间范围清理浏览数据。 |
| 107 | `EdgeView会话_置下载目录` | `EdgeView会话_置下载目录(控件名, 目录)` | int | 设置 Profile 默认下载目录。 |
| 108 | `EdgeView会话_取下载目录` | `EdgeView会话_取下载目录(控件名)` | wideString | 取得 Profile 默认下载目录。 |
| 109 | `EdgeView会话_置配色方案` | `EdgeView会话_置配色方案(控件名, 方案)` | int | 设置 Profile 首选配色方案。 |
| 110 | `EdgeView会话_取配色方案` | `EdgeView会话_取配色方案(控件名)` | int | 取得 Profile 首选配色方案。 |
| 111 | `EdgeView会话_置跟踪保护` | `EdgeView会话_置跟踪保护(控件名, 级别)` | int | 设置 Profile 跟踪保护级别。 |
| 112 | `EdgeView会话_取跟踪保护` | `EdgeView会话_取跟踪保护(控件名)` | int | 取得 Profile 跟踪保护级别。 |
| 113 | `EdgeView会话_置密码保存` | `EdgeView会话_置密码保存(控件名, 启用)` | int | 设置 Profile 密码自动保存。 |
| 114 | `EdgeView会话_取密码保存` | `EdgeView会话_取密码保存(控件名)` | int | 取得 Profile 密码自动保存状态。 |
| 115 | `EdgeView会话_置自动填充` | `EdgeView会话_置自动填充(控件名, 启用)` | int | 设置 Profile 通用自动填充。 |
| 116 | `EdgeView会话_取自动填充` | `EdgeView会话_取自动填充(控件名)` | int | 取得 Profile 通用自动填充状态。 |
| 117 | `EdgeView会话_删除Profile` | `EdgeView会话_删除Profile(控件名)` | int | 删除当前 Profile；删除完成事件通过事件目录通知。 |
| 118 | `EdgeView下载_取状态JSON` | `EdgeView下载_取状态JSON(控件名, 下载ID)` | wideString | 取得受管下载状态、地址、MIME、进度、可恢复性和中断原因 JSON。 |
| 119 | `EdgeView下载_暂停` | `EdgeView下载_暂停(控件名, 下载ID)` | int | 暂停受管下载。 |
| 120 | `EdgeView下载_恢复` | `EdgeView下载_恢复(控件名, 下载ID)` | int | 恢复受管下载。 |
| 121 | `EdgeView下载_取消` | `EdgeView下载_取消(控件名, 下载ID)` | int | 取消受管下载。 |
| 122 | `EdgeView下载_显示默认窗口` | `EdgeView下载_显示默认窗口(控件名)` | int | 打开默认下载窗口。 |
| 123 | `EdgeView下载_关闭默认窗口` | `EdgeView下载_关闭默认窗口(控件名)` | int | 关闭默认下载窗口。 |
| 124 | `EdgeView下载_置窗口角对齐` | `EdgeView下载_置窗口角对齐(控件名, 对齐)` | int | 设置默认下载窗口角对齐。 |
| 125 | `EdgeView下载_取窗口角对齐` | `EdgeView下载_取窗口角对齐(控件名)` | int | 取得默认下载窗口角对齐。 |
| 126 | `EdgeView下载_置窗口边距` | `EdgeView下载_置窗口边距(控件名, 横向, 纵向)` | int | 设置默认下载窗口边距。 |
| 127 | `EdgeView下载_取窗口边距JSON` | `EdgeView下载_取窗口边距JSON(控件名)` | wideString | 取得默认下载窗口边距 JSON。 |
| 128 | `EdgeView查找_开始异步` | `EdgeView查找_开始异步(控件名, 文本, 选项JSON, 完成处理器)` | longLong | 开始页内查找，结果为匹配状态 JSON。 |
| 129 | `EdgeView查找_下一项` | `EdgeView查找_下一项(控件名)` | int | 移动到下一匹配项。 |
| 130 | `EdgeView查找_上一项` | `EdgeView查找_上一项(控件名)` | int | 移动到上一匹配项。 |
| 131 | `EdgeView查找_停止` | `EdgeView查找_停止(控件名)` | int | 停止页内查找并清除高亮。 |
| 132 | `EdgeView查找_取状态JSON` | `EdgeView查找_取状态JSON(控件名)` | wideString | 取得匹配数量和当前索引 JSON。 |
| 133 | `EdgeView打印_置方向` | `EdgeView打印_置方向(控件名, 值)` | int | 设置打印方向。 |
| 134 | `EdgeView打印_取方向` | `EdgeView打印_取方向(控件名)` | int | 取得打印方向。 |
| 135 | `EdgeView打印_置每面页数` | `EdgeView打印_置每面页数(控件名, 值)` | int | 设置打印每面页数。 |
| 136 | `EdgeView打印_取每面页数` | `EdgeView打印_取每面页数(控件名)` | int | 取得打印每面页数。 |
| 137 | `EdgeView打印_置份数` | `EdgeView打印_置份数(控件名, 值)` | int | 设置打印份数。 |
| 138 | `EdgeView打印_取份数` | `EdgeView打印_取份数(控件名)` | int | 取得打印份数。 |
| 139 | `EdgeView打印_置逐份打印` | `EdgeView打印_置逐份打印(控件名, 值)` | int | 设置打印逐份打印。 |
| 140 | `EdgeView打印_取逐份打印` | `EdgeView打印_取逐份打印(控件名)` | int | 取得打印逐份打印。 |
| 141 | `EdgeView打印_置颜色模式` | `EdgeView打印_置颜色模式(控件名, 值)` | int | 设置打印颜色模式。 |
| 142 | `EdgeView打印_取颜色模式` | `EdgeView打印_取颜色模式(控件名)` | int | 取得打印颜色模式。 |
| 143 | `EdgeView打印_置双面模式` | `EdgeView打印_置双面模式(控件名, 值)` | int | 设置打印双面模式。 |
| 144 | `EdgeView打印_取双面模式` | `EdgeView打印_取双面模式(控件名)` | int | 取得打印双面模式。 |
| 145 | `EdgeView打印_置纸张类型` | `EdgeView打印_置纸张类型(控件名, 值)` | int | 设置打印纸张类型。 |
| 146 | `EdgeView打印_取纸张类型` | `EdgeView打印_取纸张类型(控件名)` | int | 取得打印纸张类型。 |
| 147 | `EdgeView打印_置缩放倍数` | `EdgeView打印_置缩放倍数(控件名, 值)` | int | 设置打印缩放倍数。 |
| 148 | `EdgeView打印_取缩放倍数` | `EdgeView打印_取缩放倍数(控件名)` | double | 取得打印缩放倍数。 |
| 149 | `EdgeView打印_置纸张宽度` | `EdgeView打印_置纸张宽度(控件名, 值)` | int | 设置打印纸张宽度。 |
| 150 | `EdgeView打印_取纸张宽度` | `EdgeView打印_取纸张宽度(控件名)` | double | 取得打印纸张宽度。 |
| 151 | `EdgeView打印_置纸张高度` | `EdgeView打印_置纸张高度(控件名, 值)` | int | 设置打印纸张高度。 |
| 152 | `EdgeView打印_取纸张高度` | `EdgeView打印_取纸张高度(控件名)` | double | 取得打印纸张高度。 |
| 153 | `EdgeView打印_置上边距` | `EdgeView打印_置上边距(控件名, 值)` | int | 设置打印上边距。 |
| 154 | `EdgeView打印_取上边距` | `EdgeView打印_取上边距(控件名)` | double | 取得打印上边距。 |
| 155 | `EdgeView打印_置下边距` | `EdgeView打印_置下边距(控件名, 值)` | int | 设置打印下边距。 |
| 156 | `EdgeView打印_取下边距` | `EdgeView打印_取下边距(控件名)` | double | 取得打印下边距。 |
| 157 | `EdgeView打印_置左边距` | `EdgeView打印_置左边距(控件名, 值)` | int | 设置打印左边距。 |
| 158 | `EdgeView打印_取左边距` | `EdgeView打印_取左边距(控件名)` | double | 取得打印左边距。 |
| 159 | `EdgeView打印_置右边距` | `EdgeView打印_置右边距(控件名, 值)` | int | 设置打印右边距。 |
| 160 | `EdgeView打印_取右边距` | `EdgeView打印_取右边距(控件名)` | double | 取得打印右边距。 |
| 161 | `EdgeView打印_置打印背景` | `EdgeView打印_置打印背景(控件名, 启用)` | int | 设置是否打印背景。 |
| 162 | `EdgeView打印_取打印背景` | `EdgeView打印_取打印背景(控件名)` | int | 取得是否打印背景。 |
| 163 | `EdgeView打印_置仅打印选区` | `EdgeView打印_置仅打印选区(控件名, 启用)` | int | 设置是否仅打印选区。 |
| 164 | `EdgeView打印_取仅打印选区` | `EdgeView打印_取仅打印选区(控件名)` | int | 取得是否仅打印选区。 |
| 165 | `EdgeView打印_置打印页眉页脚` | `EdgeView打印_置打印页眉页脚(控件名, 启用)` | int | 设置是否打印页眉页脚。 |
| 166 | `EdgeView打印_取打印页眉页脚` | `EdgeView打印_取打印页眉页脚(控件名)` | int | 取得是否打印页眉页脚。 |
| 167 | `EdgeView打印_置页眉标题` | `EdgeView打印_置页眉标题(控件名, 文本)` | int | 设置打印页眉标题。 |
| 168 | `EdgeView打印_取页眉标题` | `EdgeView打印_取页眉标题(控件名)` | wideString | 取得打印页眉标题。 |
| 169 | `EdgeView打印_置页脚地址` | `EdgeView打印_置页脚地址(控件名, 文本)` | int | 设置打印页脚地址。 |
| 170 | `EdgeView打印_取页脚地址` | `EdgeView打印_取页脚地址(控件名)` | wideString | 取得打印页脚地址。 |
| 171 | `EdgeView打印_置页面范围` | `EdgeView打印_置页面范围(控件名, 文本)` | int | 设置打印页面范围。 |
| 172 | `EdgeView打印_取页面范围` | `EdgeView打印_取页面范围(控件名)` | wideString | 取得打印页面范围。 |
| 173 | `EdgeView打印_置打印机名称` | `EdgeView打印_置打印机名称(控件名, 文本)` | int | 设置打印打印机名称。 |
| 174 | `EdgeView打印_取打印机名称` | `EdgeView打印_取打印机名称(控件名)` | wideString | 取得打印打印机名称。 |
| 175 | `EdgeView打印_显示界面` | `EdgeView打印_显示界面(控件名, 界面类型)` | int | 显示系统或浏览器打印界面。 |
| 176 | `EdgeView打印_PDF异步` | `EdgeView打印_PDF异步(控件名, 文件路径, 设置JSON, 完成处理器)` | longLong | 把当前页面打印到明确 PDF 文件路径。 |
| 177 | `EdgeView打印_PDF流到文件异步` | `EdgeView打印_PDF流到文件异步(控件名, 文件路径, 完成处理器)` | longLong | 使用 PrintToPdfStream 后把二进制结果写入明确文件路径。 |
| 178 | `EdgeView打印_打印异步` | `EdgeView打印_打印异步(控件名, 设置JSON, 完成处理器)` | longLong | 使用类型化 JSON 打印设置异步打印。 |
| 179 | `EdgeView媒体_截图异步` | `EdgeView媒体_截图异步(控件名, 文件路径, 格式, 完成处理器)` | longLong | 把截图写入明确文件路径，不暴露 IStream。 |
| 180 | `EdgeView媒体_取Favicon异步` | `EdgeView媒体_取Favicon异步(控件名, 文件路径, 完成处理器)` | longLong | 把 Favicon 写入明确文件路径。 |
| 181 | `EdgeView媒体_取全屏状态` | `EdgeView媒体_取全屏状态(控件名)` | int | 取得页面是否含全屏元素。 |
| 182 | `EdgeView媒体_取音频状态` | `EdgeView媒体_取音频状态(控件名)` | int | 取得页面是否正在播放音频。 |
| 183 | `EdgeView开发者工具_打开` | `EdgeView开发者工具_打开(控件名)` | int | 打开开发者工具窗口。 |
| 184 | `EdgeView开发者工具_打开任务管理器` | `EdgeView开发者工具_打开任务管理器(控件名)` | int | 打开 WebView2 任务管理器。 |
| 185 | `EdgeView开发者工具_调用异步` | `EdgeView开发者工具_调用异步(控件名, 方法, 参数JSON, 完成处理器)` | longLong | 调用 DevTools Protocol 方法，结果为 JSON。 |
| 186 | `EdgeView开发者工具_调用会话异步` | `EdgeView开发者工具_调用会话异步(控件名, 会话ID, 方法, 参数JSON, 完成处理器)` | longLong | 在指定 DevTools 会话调用协议方法。 |
| 187 | `EdgeView资源_添加过滤器` | `EdgeView资源_添加过滤器(控件名, URI模式, 上下文, 来源类型)` | int | 添加带请求来源类型的资源过滤器。 |
| 188 | `EdgeView资源_移除过滤器` | `EdgeView资源_移除过滤器(控件名, URI模式, 上下文)` | int | 移除资源过滤器。 |
| 189 | `EdgeView资源_移除来源过滤器` | `EdgeView资源_移除来源过滤器(控件名, URI模式, 上下文, 来源类型)` | int | 移除带请求来源类型的资源过滤器。 |
| 190 | `EdgeView资源_设置事件响应文本` | `EdgeView资源_设置事件响应文本(控件名, 状态码, 原因, 响应头, 正文)` | int | 在 Web资源请求同步事件中以限长 UTF-8 正文替换响应。 |
| 191 | `EdgeView资源_读响应正文异步` | `EdgeView资源_读响应正文异步(控件名, 响应句柄, 最大字节数, 完成处理器)` | longLong | 把响应流限长读取为十六进制 JSON，不暴露 IStream。 |
| 192 | `EdgeView事件_取字段` | `EdgeView事件_取字段(控件名, 字段名)` | wideString | 取得当前同步事件字段；右键菜单目标等复合参数会预先转换为字段。 |
| 193 | `EdgeView事件_设置动作` | `EdgeView事件_设置动作(控件名, 动作)` | int | 设置当前同步事件动作；未设置时保持 WebView2 默认行为。 |
| 194 | `EdgeView事件_设置返回文本` | `EdgeView事件_设置返回文本(控件名, 文本)` | int | 设置脚本对话框、认证或下载等事件返回文本。 |
| 195 | `EdgeView事件_设置认证` | `EdgeView事件_设置认证(控件名, 用户名, 密码)` | int | 设置当前基本身份验证请求凭据。 |
| 196 | `EdgeView事件_设置下载路径` | `EdgeView事件_设置下载路径(控件名, 文件路径)` | int | 设置当前下载开始事件的目标文件路径。 |
| 197 | `EdgeView事件_取菜单项JSON` | `EdgeView事件_取菜单项JSON(控件名, 菜单项句柄)` | wideString | 取得受管 WebView2 菜单项名称、标签、命令 ID、类型、状态、快捷键、图标存在性和子项句柄。 |
| 198 | `EdgeView事件_置菜单项勾选` | `EdgeView事件_置菜单项勾选(控件名, 菜单项句柄, 勾选)` | int | 设置受管菜单项勾选状态。 |
| 199 | `EdgeView事件_置菜单项启用` | `EdgeView事件_置菜单项启用(控件名, 菜单项句柄, 启用)` | int | 设置受管菜单项启用状态。 |
| 200 | `EdgeView对象_取状态JSON` | `EdgeView对象_取状态JSON(对象句柄)` | wideString | 取得受管对象类型、所属控件、generation、线程和生命周期状态。 |
| 201 | `EdgeView对象_释放` | `EdgeView对象_释放(对象句柄)` | int | 显式释放受管对象；句柄不会被复用。 |
| 202 | `EdgeView框架_枚举JSON` | `EdgeView框架_枚举JSON(控件名)` | wideString | 枚举当前控件已发现的 Frame 受管句柄和层级信息。 |
| 203 | `EdgeView框架_取信息JSON` | `EdgeView框架_取信息JSON(控件名, 框架句柄)` | wideString | 取得 Frame ID、名称、来源和生命周期信息。 |
| 204 | `EdgeView框架_执行脚本异步` | `EdgeView框架_执行脚本异步(控件名, 框架句柄, 脚本, 完成处理器)` | longLong | 在受管 Frame 中异步执行 JavaScript。 |
| 205 | `EdgeView框架_发送字符串消息` | `EdgeView框架_发送字符串消息(控件名, 框架句柄, 消息)` | int | 向受管 Frame 发送字符串消息。 |
| 206 | `EdgeView框架_发送JSON消息` | `EdgeView框架_发送JSON消息(控件名, 框架句柄, JSON)` | int | 向受管 Frame 发送 JSON 消息。 |
| 207 | `EdgeView框架_发送共享缓冲` | `EdgeView框架_发送共享缓冲(控件名, 框架句柄, 缓冲句柄, 访问模式, 附加JSON)` | int | 把受管共享缓冲发送到指定 Frame。 |
| 208 | `EdgeView工作线程_枚举异步` | `EdgeView工作线程_枚举异步(控件名, 类型, 完成处理器)` | longLong | 枚举 Shared Worker 或 Service Worker；结果为受管句柄 JSON。 |
| 209 | `EdgeView工作线程_取信息JSON` | `EdgeView工作线程_取信息JSON(控件名, 工作线程句柄)` | wideString | 取得 Dedicated、Shared 或 Service Worker 类型及 URI 信息。 |
| 210 | `EdgeView工作线程_发送字符串消息` | `EdgeView工作线程_发送字符串消息(控件名, 工作线程句柄, 消息)` | int | 向支持消息的 Dedicated 或 Service Worker 发送字符串消息。 |
| 211 | `EdgeView工作线程_发送JSON消息` | `EdgeView工作线程_发送JSON消息(控件名, 工作线程句柄, JSON)` | int | 向支持消息的 Dedicated 或 Service Worker 发送 JSON 消息。 |
| 212 | `EdgeView工作线程_置ServiceWorker脚本API` | `EdgeView工作线程_置ServiceWorker脚本API(控件名, 启用)` | int | 设置 Service Worker 是否允许 WebView 脚本 API。 |
| 213 | `EdgeView工作线程_取ServiceWorker脚本API` | `EdgeView工作线程_取ServiceWorker脚本API(控件名)` | int | 取得 Service Worker 的 WebView 脚本 API 开关。 |
| 214 | `EdgeView扩展_安装异步` | `EdgeView扩展_安装异步(控件名, 扩展目录, 完成处理器)` | longLong | 从显式目录安装浏览器扩展，结果为受管扩展句柄。 |
| 215 | `EdgeView扩展_枚举异步` | `EdgeView扩展_枚举异步(控件名, 完成处理器)` | longLong | 枚举当前 Profile 的浏览器扩展。 |
| 216 | `EdgeView扩展_置启用异步` | `EdgeView扩展_置启用异步(控件名, 扩展句柄, 启用, 完成处理器)` | longLong | 异步启用或禁用受管浏览器扩展。 |
| 217 | `EdgeView扩展_删除异步` | `EdgeView扩展_删除异步(控件名, 扩展句柄, 完成处理器)` | longLong | 异步删除受管浏览器扩展。 |
| 218 | `EdgeView权限_枚举异步` | `EdgeView权限_枚举异步(控件名, 完成处理器)` | longLong | 枚举当前 Profile 的非默认权限设置。 |
| 219 | `EdgeView权限_设置异步` | `EdgeView权限_设置异步(控件名, 权限类型, 来源, 状态, 完成处理器)` | longLong | 异步设置指定来源的权限状态。 |
| 220 | `EdgeView通知_取信息JSON` | `EdgeView通知_取信息JSON(控件名, 通知句柄)` | wideString | 取得受管通知的标题、正文、语言和状态；来源由“通知收到”事件提供。 |
| 221 | `EdgeView通知_报告已显示` | `EdgeView通知_报告已显示(控件名, 通知句柄)` | int | 向 WebView2 报告自定义通知已显示。 |
| 222 | `EdgeView通知_报告单击` | `EdgeView通知_报告单击(控件名, 通知句柄)` | int | 向 WebView2 报告通知被单击。 |
| 223 | `EdgeView通知_报告关闭` | `EdgeView通知_报告关闭(控件名, 通知句柄)` | int | 向 WebView2 报告通知已关闭。 |
| 224 | `EdgeView缓冲_创建` | `EdgeView缓冲_创建(控件名, 字节数)` | handle | 创建不超过 16 MiB 的受管共享缓冲。 |
| 225 | `EdgeView缓冲_取大小` | `EdgeView缓冲_取大小(控件名, 缓冲句柄)` | longLong | 取得受管共享缓冲大小。 |
| 226 | `EdgeView缓冲_写十六进制` | `EdgeView缓冲_写十六进制(控件名, 缓冲句柄, 十六进制)` | int | 把限长十六进制数据写入受管共享缓冲。 |
| 227 | `EdgeView缓冲_读十六进制` | `EdgeView缓冲_读十六进制(控件名, 缓冲句柄, 最大字节数)` | wideString | 从受管共享缓冲读取限长十六进制。 |
| 228 | `EdgeView缓冲_发送到网页` | `EdgeView缓冲_发送到网页(控件名, 缓冲句柄, 访问模式, 附加JSON)` | int | 把共享缓冲以只读或读写模式发送到网页。 |
| 229 | `EdgeView安全_取证书JSON` | `EdgeView安全_取证书JSON(控件名, 证书句柄)` | wideString | 取得受管客户端或服务器证书的主题、签发者、有效期、序列号、显示名和 PEM。 |
| 230 | `EdgeView安全_选择客户端证书` | `EdgeView安全_选择客户端证书(控件名, 证书句柄)` | int | 在客户端证书同步决策事件中选择受管证书。 |
| 231 | `EdgeView安全_清除证书错误决策异步` | `EdgeView安全_清除证书错误决策异步(控件名, 完成处理器)` | longLong | 清除当前 WebView 的服务器证书错误持久决策。 |
| 232 | `EdgeView安全_显示另存为界面异步` | `EdgeView安全_显示另存为界面异步(控件名, 完成处理器)` | longLong | 显示 WebView2 另存为界面并返回状态。 |
| 233 | `EdgeView对象_取文件路径` | `EdgeView对象_取文件路径(控件名, 对象句柄)` | wideString | 从受管 File 对象取得安全文件路径。 |
| 234 | `EdgeView对象_创建文件系统句柄` | `EdgeView对象_创建文件系统句柄(控件名, 路径, 目录, 权限)` | handle | 从绝对路径创建受管文件或目录句柄；拒绝相对路径和不存在路径。 |
| 235 | `EdgeView脚本_发送附加对象JSON` | `EdgeView脚本_发送附加对象JSON(控件名, JSON, 对象句柄)` | int | 向网页发送 JSON 与一个受管文件系统附加对象。 |
| 236 | `EdgeView_创建` | `EdgeView_创建(父组件句柄, 地址)` | int | 在指定 HWND 组件客户区内创建 EdgeView；传 0 时嵌入当前窗口。成功返回 1。 |
| 237 | `EdgeView_创建实例` | `EdgeView_创建实例(实例编号, 父组件句柄, 地址, 独立缓存目录)` | int | 创建具名 EdgeView 实例；不同缓存目录拥有独立 Cookie、存储和会话。 |
| 238 | `EdgeView_创建实例代理` | `EdgeView_创建实例代理(实例编号, 父组件句柄, 地址, 独立缓存目录, 代理地址)` | int | 创建使用独立代理的 EdgeView 实例；该代理覆盖全局代理。 |
| 239 | `EdgeView_创建区域` | `EdgeView_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录)` | int | 在当前窗口指定区域创建独立承载 HWND 和 EdgeView 实例。 |
| 240 | `EdgeView_创建区域代理` | `EdgeView_创建区域代理(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)` | int | 在指定区域创建使用独立代理的 EdgeView 实例。 |
| 241 | `EdgeView_设置全局代理` | `EdgeView_设置全局代理(代理地址)` | int | 设置后续新建 EdgeView 实例默认使用的 HTTP/HTTPS/SOCKS5 代理；现有实例不变。 |
| 242 | `EdgeView_清除全局代理` | `EdgeView_清除全局代理()` | void | 清除后续新建实例的全局代理，现有实例不变。 |
| 243 | `EdgeView_取全局代理` | `EdgeView_取全局代理()` | wideString | 返回当前 EdgeView 全局代理设置。 |
| 244 | `EdgeView_取实例代理` | `EdgeView_取实例代理(实例编号)` | wideString | 返回指定实例创建时实际采用的代理地址。 |
| 245 | `EdgeView_绑定事件` | `EdgeView_绑定事件(实例编号, 事件名, &处理器名)` | int | 绑定 WebView2 完整事件目录中的中文事件；当前目录共 71 项。旧字符串处理器仍兼容，但会产生迁移警告。 |
| 246 | `EdgeView_监听开发者工具事件` | `EdgeView_监听开发者工具事件(实例编号, 协议事件名)` | int | 监听指定 Chromium DevTools Protocol 事件，触发“开发者工具协议事件”。 |
| 247 | `EdgeView_等待事件` | `EdgeView_等待事件(实例编号, 事件名, 超时毫秒)` | int | 泵送窗口消息并等待指定浏览器事件，成功返回 1，超时返回 0。 |
| 248 | `EdgeView_导航` | `EdgeView_导航(地址)` | int | 导航到 HTTP/HTTPS 地址或本地文件地址。 |
| 249 | `EdgeView_导航实例` | `EdgeView_导航实例(实例编号, 地址)` | int | 让指定 EdgeView 实例导航。 |
| 250 | `EdgeView_执行JS` | `EdgeView_执行JS(脚本)` | wideString | 执行 JavaScript 并等待异步回调，返回 WebView2 的 JSON 编码结果；失败返回空文本。 |
| 251 | `EdgeView_执行JS实例` | `EdgeView_执行JS实例(实例编号, 脚本)` | wideString | 在指定实例执行 JavaScript，并返回 WebView2 JSON 编码结果。 |
| 252 | `EdgeView_取最近事件` | `EdgeView_取最近事件()` | wideString | 返回最近触发的 WebView2 中文事件名。 |
| 253 | `EdgeView_取事件数据` | `EdgeView_取事件数据()` | wideString | 返回最近事件携带的 UTF-16 JSON 对象文本。 |
| 254 | `EdgeView_取最近事件实例` | `EdgeView_取最近事件实例(实例编号)` | wideString | 返回指定浏览器实例最近事件名。 |
| 255 | `EdgeView_取事件数据实例` | `EdgeView_取事件数据实例(实例编号)` | wideString | 返回指定浏览器实例最近事件携带的数据。 |
| 256 | `EdgeView_后退` | `EdgeView_后退()` | int | 浏览器可以后退时返回上一页。 |
| 257 | `EdgeView_前进` | `EdgeView_前进()` | int | 浏览器可以前进时进入下一页。 |
| 258 | `EdgeView_刷新` | `EdgeView_刷新()` | void | 刷新当前网页。 |
| 259 | `EdgeView_关闭` | `EdgeView_关闭()` | void | 关闭浏览器控制器并释放 WebView2 资源。 |
| 260 | `EdgeView_关闭实例` | `EdgeView_关闭实例(实例编号)` | void | 关闭指定 EdgeView 实例并释放其承载窗口。 |
| 261 | `EdgeView_创建控件` | `EdgeView_创建控件(控件名)` | int | 使用设计器属性重新创建指定 Edge 浏览器控件；空文本创建当前窗口全部 Edge 浏览器控件。 |
| 262 | `EdgeView_导航控件` | `EdgeView_导航控件(控件名, 地址)` | int | 让指定设计器 Edge 浏览器控件导航到新地址。 |
| 263 | `EdgeView_执行JS控件` | `EdgeView_执行JS控件(控件名, 脚本)` | wideString | 在指定设计器 Edge 浏览器控件中执行 JavaScript 并返回 JSON 编码结果。 |
| 264 | `EdgeView_取最近事件控件` | `EdgeView_取最近事件控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近触发的事件名。 |
| 265 | `EdgeView_取事件数据控件` | `EdgeView_取事件数据控件(控件名)` | wideString | 读取指定设计器 Edge 浏览器控件最近事件的数据。 |
| 266 | `EdgeView_后退控件` | `EdgeView_后退控件(控件名)` | int | 让指定设计器 Edge 浏览器控件后退。 |
| 267 | `EdgeView_前进控件` | `EdgeView_前进控件(控件名)` | int | 让指定设计器 Edge 浏览器控件前进。 |
| 268 | `EdgeView_刷新控件` | `EdgeView_刷新控件(控件名)` | void | 刷新指定设计器 Edge 浏览器控件。 |
| 269 | `EdgeView_关闭控件` | `EdgeView_关闭控件(控件名)` | void | 关闭指定设计器 Edge 浏览器控件并保留设计器宿主占位。 |
| 270 | `EdgeView_绑定控件事件` | `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)` | int | 按控件名绑定 WebView2 完整事件目录中的中文事件；当前目录共 71 项。旧字符串处理器仍兼容，但会产生迁移警告。 |
| 271 | `EdgeView_监听开发者工具事件控件` | `EdgeView_监听开发者工具事件控件(控件名, 协议事件名)` | int | 按设计器控件名监听 Chromium DevTools Protocol 事件。 |
