# new_emoji RichList 动态多浏览器

本项目是独立于 `new-emoji-fbro-listbox` 的 RichList 动态会话 Demo。设计器不预放任何 `FBroBrowser` 控件；`lingbuilder.new_emoji.fbro-shell@1.2.0` 在运行时为每个表项创建一个 `LingBuilderFbroHost.exe`、一个伴随宿主 `HWND` 和一个独立 Profile。

## 稳定 ID 绑定

RichList 行号和数组索引只表示当前显示顺序。每个会话使用 `rich-browser-N` 稳定 ID，RichList 的 `itemKey`、fbro-shell 模型、Host 进程、伴随 HWND 和缓存目录都以该 ID 关联。上移、下移、置顶和沉底只修改稳定 ID 顺序，不会交换浏览器实例或 Profile。

## 关闭与删除

- “关闭”释放该会话的 Host 进程和伴随 HWND，但保留 RichList 表项、稳定 ID、网址、配置和缓存目录；点击“已关闭”会用原稳定 ID 与 Profile 重新打开。
- “删除”会先安全关闭，再删除 RichList 表项和运行时绑定，并切换到相邻可用会话。
- Demo **默认保留缓存目录**，不会自动删除 Cookie 或登录数据，避免把“删除表项”误解为清除隐私数据。需要清理时应由用户确认后在独立缓存管理功能中完成。

## Cookie 隔离

“置入 Cookie”打开中文模态输入对话框，要求目标 http/https 地址和 `名称=值` Cookie 文本。fbro-shell 只向该表项稳定 ID 对应的 Host 发送 `setCookie` 请求，Host 使用官方 `LB_FBro_CookieSetAsync`，不执行网页脚本，也不会在日志中输出 Cookie 明文。关闭的会话会返回中文错误，必须先重新打开。

## 模块与平台

项目启用 `lingbuilder.win32.basic`、`lingbuilder.std.text`、`lingbuilder.new_emoji.ui@2.0.0`、`lingbuilder.fbro.browser@2.2.0` 和 `lingbuilder.new_emoji.fbro-shell@1.2.0`。构建目标为 Windows MSVC x64 Release。
