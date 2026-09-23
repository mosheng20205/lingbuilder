EdgeView下载_关闭默认窗口(control:?) → int
EdgeView下载_取消(下载ID:longLong) → int
EdgeView下载_取状态JSON(下载ID:longLong) → wideString
EdgeView下载_取窗口角对齐(control:?) → int
EdgeView下载_取窗口边距JSON(control:?) → wideString
EdgeView下载_恢复(下载ID:longLong) → int
EdgeView下载_显示默认窗口(control:?) → int
EdgeView下载_暂停(下载ID:longLong) → int
EdgeView下载_置窗口角对齐(对齐:int) → int
EdgeView下载_置窗口边距(横向:int, 纵向:int) → int
EdgeView事件_取字段(字段名:wideString) → wideString
EdgeView事件_取菜单项JSON(菜单项句柄:handle) → wideString
EdgeView事件_置菜单项勾选(菜单项句柄:handle, 勾选:bool) → int [advanced]
EdgeView事件_置菜单项启用(菜单项句柄:handle, 启用:bool) → int [advanced]
EdgeView事件_设置下载路径(文件路径:wideString) → int [advanced]
EdgeView事件_设置动作(动作:int) → int [advanced]
EdgeView事件_设置认证(用户名:wideString, 密码:wideString) → int [advanced]
EdgeView事件_设置返回文本(文本:wideString) → int [advanced]
EdgeView任务_取当前任务ID() → longLong [advanced]
EdgeView任务_取消(task:?) → int [advanced]
EdgeView任务_取状态(task:?) → int [advanced]
EdgeView任务_取结果(task:?) → wideString [advanced]
EdgeView任务_取错误(task:?) → wideString [advanced]
EdgeView任务_释放(task:?) → int [advanced]
EdgeView会话_删除Cookie(名称:wideString, 域:wideString, 路径:wideString) → int
EdgeView会话_删除Profile(control:?) → int
EdgeView会话_删除全部Cookie(control:?) → int
EdgeView会话_取Cookie异步(地址:wideString, 完成处理器:handler) → longLong
EdgeView会话_取ProfileJSON(control:?) → wideString
EdgeView会话_取下载目录(control:?) → wideString
EdgeView会话_取密码保存(control:?) → int
EdgeView会话_取自动填充(control:?) → int
EdgeView会话_取跟踪保护(control:?) → int
EdgeView会话_取配色方案(control:?) → int
EdgeView会话_批量置Cookie(Cookie列表JSON:wideString) → int
EdgeView会话_按时间清理浏览数据异步(数据类型掩码:longLong, 开始时间:double, 结束时间:double, 完成处理器:handler) → longLong
EdgeView会话_清理全部浏览数据异步(完成处理器:handler) → longLong
EdgeView会话_清理浏览数据异步(数据类型掩码:longLong, 完成处理器:handler) → longLong
EdgeView会话_置Cookie(名称:wideString, 值:wideString, 域:wideString, 路径:wideString) → int
EdgeView会话_置Cookie带属性(名称:wideString, 值:wideString, 域:wideString, 路径:wideString, 过期时间:double, 安全:bool, 仅HTTP:bool, 同源策略:int) → int
EdgeView会话_置下载目录(目录:wideString) → int
EdgeView会话_置密码保存(启用:bool) → int
EdgeView会话_置自动填充(启用:bool) → int
EdgeView会话_置跟踪保护(级别:int) → int
EdgeView会话_置配色方案(方案:int) → int
EdgeView创建选项_取发布通道(control:?) → int
EdgeView创建选项_取宿主输入处理(control:?) → int
EdgeView创建选项_取浏览器扩展(control:?) → int
EdgeView创建选项_取滚动条样式(control:?) → int
EdgeView创建选项_取独占用户目录(control:?) → int
EdgeView创建选项_取脚本区域(control:?) → wideString
EdgeView创建选项_取自定义崩溃报告(control:?) → int
EdgeView创建选项_取跟踪保护(control:?) → int
EdgeView创建选项_取跨域限制关闭(control:?) → int
EdgeView创建选项_取通道搜索方式(control:?) → int
EdgeView创建选项_取附加参数(control:?) → wideString
EdgeView创建选项_取默认背景色(control:?) → int
EdgeView创建选项_添加自定义协议(协议名:wideString, 含权限部分:bool, 视为安全:bool, 允许来源:wideString) → int
EdgeView创建选项_清除自定义协议(control:?) → int
EdgeView创建选项_置发布通道(通道掩码:int) → int
EdgeView创建选项_置宿主输入处理(启用:bool) → int
EdgeView创建选项_置浏览器扩展(启用:bool) → int
EdgeView创建选项_置滚动条样式(样式:int) → int
EdgeView创建选项_置独占用户目录(启用:bool) → int
EdgeView创建选项_置脚本区域(区域:wideString) → int
EdgeView创建选项_置自定义崩溃报告(启用:bool) → int
EdgeView创建选项_置跟踪保护(启用:bool) → int
EdgeView创建选项_置跨域限制关闭(\u662f\u5426\u5173\u95ed\u8de8\u57df:bool) → int
EdgeView创建选项_置通道搜索方式(方式:int) → int
EdgeView创建选项_置附加参数(\u9644\u52a0\u6d4f\u89c8\u5668\u542f\u52a8\u53c2\u6570:wideString) → int
EdgeView创建选项_置默认背景色(ARGB:int) → int
EdgeView创建选项_重建控件(control:?) → int
EdgeView填表_触发事件(事件名:wideString, 按键代码:int) → longLong
EdgeView媒体_取Favicon异步(文件路径:wideString, 完成处理器:handler) → longLong
EdgeView媒体_取全屏状态(control:?) → int
EdgeView媒体_取音频状态(control:?) → int
EdgeView媒体_截图异步(文件路径:wideString, 格式:int, 完成处理器:handler) → longLong
EdgeView安全_取证书JSON(证书句柄:handle) → wideString
EdgeView安全_显示另存为界面异步(完成处理器:handler) → longLong
EdgeView安全_清除证书错误决策异步(完成处理器:handler) → longLong
EdgeView安全_选择客户端证书(证书句柄:handle) → int
EdgeView对象_创建文件系统句柄(路径:wideString, 目录:bool, 权限:int) → handle
EdgeView对象_取文件路径(对象句柄:handle) → wideString [advanced]
EdgeView对象_取状态JSON(对象句柄:handle) → wideString [advanced]
EdgeView对象_释放(对象句柄:handle) → int [advanced]
EdgeView导航_HTML(HTML:wideString) → int
EdgeView导航_停止(control:?) → int
EdgeView导航_取地址(control:?) → wideString
EdgeView导航_取标题(control:?) → wideString
EdgeView导航_取状态JSON(control:?) → wideString
EdgeView导航_取进程信息异步(完成处理器:handler) → longLong
EdgeView导航_恢复(control:?) → int
EdgeView导航_挂起异步(完成处理器:handler) → longLong
EdgeView导航_清除虚拟主机(主机名:wideString) → int [advanced]
EdgeView导航_设置虚拟主机(主机名:wideString, 目录:wideString, 访问模式:int) → int [advanced]
EdgeView导航_请求(地址:wideString, 方法:wideString, 请求头:wideString, 正文:wideString) → int [advanced]
EdgeView工作线程_发送JSON消息(工作线程句柄:handle, JSON:wideString) → int
EdgeView工作线程_发送字符串消息(工作线程句柄:handle, 消息:wideString) → int
EdgeView工作线程_取ServiceWorker脚本API(control:?) → int
EdgeView工作线程_取信息JSON(工作线程句柄:handle) → wideString
EdgeView工作线程_枚举异步(类型:int, 完成处理器:handler) → longLong
EdgeView工作线程_置ServiceWorker脚本API(启用:bool) → int
EdgeView开发者工具_打开(control:?) → int
EdgeView开发者工具_打开任务管理器(control:?) → int
EdgeView开发者工具_调用会话异步(会话ID:wideString, 方法:wideString, 参数JSON:wideString, 完成处理器:handler) → longLong
EdgeView开发者工具_调用异步(方法:wideString, 参数JSON:wideString, 完成处理器:handler) → longLong
EdgeView打印_PDF异步(文件路径:wideString, 设置JSON:wideString, 完成处理器:handler) → longLong
EdgeView打印_PDF流到文件异步(文件路径:wideString, 完成处理器:handler) → longLong
EdgeView打印_打印异步(设置JSON:wideString, 完成处理器:handler) → longLong
EdgeView打印_显示界面(界面类型:int) → int
EdgeView扩展_删除异步(扩展句柄:handle, 完成处理器:handler) → longLong
EdgeView扩展_安装异步(扩展目录:wideString, 完成处理器:handler) → longLong
EdgeView扩展_枚举异步(完成处理器:handler) → longLong
EdgeView扩展_置启用异步(扩展句柄:handle, 启用:bool, 完成处理器:handler) → longLong
EdgeView权限_枚举异步(完成处理器:handler) → longLong
EdgeView权限_设置异步(权限类型:int, 来源:wideString, 状态:int, 完成处理器:handler) → longLong
EdgeView查找_上一项(control:?) → int
EdgeView查找_下一项(control:?) → int
EdgeView查找_停止(control:?) → int
EdgeView查找_取状态JSON(control:?) → wideString
EdgeView查找_开始异步(文本:wideString, 选项JSON:wideString, 完成处理器:handler) → longLong
EdgeView框架_发送JSON消息(框架句柄:handle, JSON:wideString) → int
EdgeView框架_发送共享缓冲(框架句柄:handle, 缓冲句柄:handle, 访问模式:int, 附加JSON:wideString) → int
EdgeView框架_发送字符串消息(框架句柄:handle, 消息:wideString) → int
EdgeView框架_取信息JSON(框架句柄:handle) → wideString
EdgeView框架_执行脚本异步(框架句柄:handle, 脚本:wideString, 完成处理器:handler) → longLong
EdgeView框架_枚举JSON(control:?) → wideString
EdgeView缓冲_写十六进制(缓冲句柄:handle, 十六进制:wideString) → int
EdgeView缓冲_创建(字节数:longLong) → handle
EdgeView缓冲_发送到网页(缓冲句柄:handle, 访问模式:int, 附加JSON:wideString) → int
EdgeView缓冲_取大小(缓冲句柄:handle) → longLong
EdgeView缓冲_读十六进制(缓冲句柄:handle, 最大字节数:longLong) → wideString
EdgeView脚本_发送JSON消息(JSON:wideString) → int
EdgeView脚本_发送字符串消息(消息:wideString) → int
EdgeView脚本_发送附加对象JSON(JSON:wideString, 对象句柄:handle) → int
EdgeView脚本_执行异步(脚本:wideString, 完成处理器:handler) → longLong
EdgeView脚本_执行详情异步(脚本:wideString, 完成处理器:handler) → longLong
EdgeView脚本_文档预注入异步(脚本:wideString, 完成处理器:handler) → longLong
EdgeView脚本_移除文档预注入(脚本ID:wideString) → int
EdgeView设置_取PDF工具栏隐藏项(control:?) → int
EdgeView设置_取信誉检查(control:?) → int
EdgeView设置_取允许外部拖放(control:?) → int
EdgeView设置_取光栅化缩放(control:?) → double
EdgeView设置_取内存目标级别(control:?) → int
EdgeView设置_取可见(control:?) → int
EdgeView设置_取用户代理(control:?) → wideString
EdgeView设置_取缩放(control:?) → double
EdgeView设置_取自动检测显示器缩放(control:?) → int
EdgeView设置_取边界JSON(control:?) → wideString
EdgeView设置_取边界模式(control:?) → int
EdgeView设置_取静音(control:?) → int
EdgeView设置_移动焦点(原因:int) → int
EdgeView设置_置PDF工具栏隐藏项(掩码:int) → int
EdgeView设置_置信誉检查(启用:bool) → int
EdgeView设置_置允许外部拖放(启用:bool) → int
EdgeView设置_置光栅化缩放(缩放:double) → int
EdgeView设置_置内存目标级别(级别:int) → int
EdgeView设置_置可见(可见:bool) → int
EdgeView设置_置用户代理(用户代理:wideString) → int
EdgeView设置_置缩放(缩放倍数:double) → int
EdgeView设置_置背景色(ARGB:int) → int
EdgeView设置_置自动检测显示器缩放(启用:bool) → int
EdgeView设置_置边界(左:int, 顶:int, 宽:int, 高:int) → int
EdgeView设置_置边界模式(模式:int) → int
EdgeView设置_置静音(静音:bool) → int
EdgeView资源_添加过滤器(URI模式:wideString, 上下文:int, 来源类型:int) → int
EdgeView资源_移除来源过滤器(URI模式:wideString, 上下文:int, 来源类型:int) → int
EdgeView资源_移除过滤器(URI模式:wideString, 上下文:int) → int
EdgeView资源_设置事件响应文本(状态码:int, 原因:wideString, 响应头:wideString, 正文:wideString) → int [advanced]
EdgeView资源_读响应正文异步(响应句柄:handle, 最大字节数:longLong, 完成处理器:handler) → longLong
EdgeView通知_取信息JSON(通知句柄:handle) → wideString
EdgeView通知_报告关闭(通知句柄:handle) → int
EdgeView通知_报告单击(通知句柄:handle) → int
EdgeView通知_报告已显示(通知句柄:handle) → int