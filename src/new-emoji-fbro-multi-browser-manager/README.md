# new_emoji FBro 多浏览器管理器

这是一个可运行的 new_emoji 原生工作台。主程序通过 FBro 2.2 独立 Host 模式，以随机回环 WebSocket 和一次性 Token 动态调度浏览器进程，不设置固定实例数量上限。

## 实例、HWND 与切换

每次点击“添加实例”，运行时都会生成不会因重命名改变的随机稳定 ID，并创建独立 Host 进程、独立 Profile、独立伴随宿主 HWND 和独立 Chromium 浏览器 HWND。左侧 RichList 是唯一可见的实例导航；右侧 Tabs 表头完全隐藏且不占布局空间。切换时先显示、定位并聚焦目标 HWND，再隐藏其它 HWND；未关闭实例保持运行。

RichList 右键菜单由统一 BrowserWorkbench 命令/菜单契约生成，包含打开、重命名、Cookie 导入导出、打开/清理缓存，以及“保留数据”与“清除数据”两种删除策略。删除最后一个实例会被阻止；清除数据需要两次确认并校验目标位于当前工作台受管 profiles 根目录。

## 持久化与插件

实例正式状态保存在 %LocalAppData%/LingBuilder/browser-workspaces/new-emoji-fbro-multi-browser-manager/browser-instances.json。写入使用临时文件、备份和原子替换；主配置损坏时先尝试 .bak，并保留损坏文件。项目内 config/new-emoji-fbro-multi-browser-manager/browser-instances.json 只保存可迁移结构和 profiles/<稳定ID> 相对路径，不包含本机浏览器数据。

每个 RequestContext 都在创建浏览器前加载 exe 同级 doubao-downloader 目录。路径由 GetModuleFileNameW 得到真实 exe 位置，不依赖工作目录或开发机绝对路径。插件缺失、清单损坏、版本不支持或 FBro 拒绝加载只会更新中文状态，不会导致整个工作台退出。

## Cookie 与分享包

Cookie 导入导出操作当前选中 Host 的真实 CookieManager。LingBuilder Cookie JSON 保留 name、value、domain、path、expires、httpOnly、secure、sameSite、priority 和 session；导入前显示有效、无效、过期、冲突和域名统计，默认跳过无效及过期记录，并可覆盖或跳过冲突。普通日志只记录数量和结果，不写 Cookie 明文。

在 LingBuilder 中使用“项目 -> 一键导出当前项目源码包”或命令“浏览器工作台：一键导出多浏览器工作台分享包”生成 .lcpppkg。分享包携带源码、设计器、相对实例结构、模块文档、FBro SDK 支持资产和 doubao-downloader 运行资源；Cookie、Profile、缓存、localStorage、IndexedDB、凭据、构建缓存和本机绝对路径会被排除。导入到新目录后，本机首次运行重新创建独立 LocalAppData Profile。

## 平台限制

当前构建目标是 Windows MSVC x64，并依赖合法的 FBro CEF 135/VIP 运行时。实例数量最终受系统内存、句柄、进程和 FBro/CEF 资源约束；资源不足时返回中文失败状态，不会共享其它实例的 Profile 或 HWND。
