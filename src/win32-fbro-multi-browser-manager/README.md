# 独立浏览器管理器

本项目的可视界面仅使用 `lingbuilder.win32.basic` 与 `lingbuilder.win32.common-controls`。左侧 Win32 ListBox 是唯一实例导航；右侧 Win32 TabControl 隐藏表头，每个实例拥有独立页面 HWND、独立 FBro Host 进程和独立 Profile。

运行时元数据保存在 `%LocalAppData%/LingBuilder/browser-workspaces/win32-fbro-multi-browser-manager/browser-instances.json`，采用 UTF-8 JSON、临时文件、备份和原子替换。项目内的 `config/win32-fbro-multi-browser-manager/browser-instances.json` 仅是可迁移默认结构，不含 Cookie、登录状态或本机路径。

每个 Host 仅启用 Chrome Runtime；在已启用 FBro VIP 高级扩展能力后，先创建独立 RequestContext，立即调用其 VIP `LoadExtension` 正式加载 EXE 同级 `doubao-downloader`，最后才创建浏览器。该顺序与 FBro C# 独立浏览器示例一致。插件需要有效的 FBro VIP 授权；授权或加载失败时普通浏览器仍可运行。部署路径和扩展 ID 仅说明注册结果，当前页面还会执行受控 DOM 检查：只有检测到扩展注入的 `doubao-downloader` 元素才显示“插件已生效”；不匹配的页面会明确显示“当前页面不适用”或“未在当前页面生效”。Cookie 导入导出直接使用当前 Host 的 FBro CookieManager；普通日志和运行快照不会记录 Cookie 值。

网页请求打开新窗口时，Bridge 会让当前 Frame 加载目标地址并取消 popup，因此不会额外创建浏览器窗口、Host 或 Profile。

FBro 下载开始和进度更新事件会按稳定实例 ID 回传。左侧只读详情框实时显示最近下载状态、文件名和完整目录；详情区固定为可完整显示四行信息的高度、不常驻滚动条，长内容自动换行。窗口高度变化时由上方实例列表伸缩，详情和操作区整体贴近底部。“打开下载目录”只会打开 FBro 已报告且当前真实存在的目录。下载监听保持 Chromium 默认下载路径，不会因为管理器观察事件而暂停或取消下载。

地址栏不会限制为 HTTP(S)。`about:blank`、`file:///...`、`view-source:` 等地址会原样交给当前 FBro/Chromium 实例；仅空地址和包含换行控制字符的输入会在进入 Host 前被拒绝。独立嵌入的 FBro Alloy 模式没有 Chromium 的原生扩展管理页，因此输入 `chrome://extensions/` 会在当前实例中打开受管诊断页，同时地址栏仍显示该逻辑地址。诊断页显示扩展清单、VIP 注册、扩展 ID、部署路径和当前页面 DOM 验证结果，不能把“已注册”误认为“已生效”。

FBro CEF 135 运行时当前仅提供 MSVC x64 资产，因此原生应用使用 Win32 API 界面后端并以 x64 架构编译。
