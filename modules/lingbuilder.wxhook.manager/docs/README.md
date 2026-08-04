# 微信 4.1.10.27 多开管理模块

## 适用场景

本模块用于 Windows 微信 `4.1.10.27` 的本机多实例启动和登录资料展示。模块不直接在 LingCpp 中维护微信内存偏移，而是复用随模块分发的 `WxHook.Manager.Host` 与 `WxHook.Agent.dll`，通过回环地址 `127.0.0.1:30000` 获取受管实例状态。

## 调用方式

窗口创建完毕时调用 `微信多开_绑定监控界面(实例列表, 状态栏, 日志列表)`。三个参数都是设计器 `controlRef`，源码必须使用不带引号的控件名。绑定成功后模块在后台轮询 Host，UI 线程只处理已经完成的状态快照，因此不会被网络等待阻塞。Host 保留的 `stopped` 历史记录会在解析阶段过滤，不进入列表、计数、日志指纹或头像下载队列。

点击按钮时调用 `微信多开_启动微信(路径)`。路径为空时，Host 会在标准微信安装目录查找 `Weixin.exe`；非空时必须是版本为 `4.1.10.27` 的 `Weixin.exe` 完整路径。微信 4.1.10.27 原生允许再次启动新实例，不修改微信 DLL。

## 本地安装（不使用官方模块市场）

模块可以作为工作区内的 `.lbmod` 离线安装，不需要发布市场或生成市场索引：

```text
.lingbuilder/module-packages/lingbuilder.wxhook.manager.lbmod
```

在桌面版 IDE 中打开模块管理，选择“本地模块包 / 导入模块包”，完成预览确认后安装；也可以直接把 `.lbmod` 拖入 IDE。安装后的模块保存在当前工作区 `.lingbuilder/modules/lingbuilder.wxhook.manager/`，项目引用保存在 `.lingbuilder/projects/<projectId>/project-modules.json`。

使用“文件 → 一键导出当前项目源码包…”时，已启用的第三方模块会自动随 `.lcpppkg` 复制到导入工作区，因此接收方打开源码包时不需要再次安装本模块或访问官方市场。

## 参数与返回值

- `微信多开_绑定监控界面`：接收 ListView、Label、ListBox 三个控件句柄，成功返回真。
- `微信多开_启动微信`：接收可选 Weixin.exe 路径，Host 确认新进程存活后返回真。
- `微信多开_立即刷新`：唤醒后台监控，已绑定时返回真。
- `微信多开_停止监控`：停止线程并释放图像列表；窗口销毁也会自动清理。
- `微信多开_取实例数量` / `微信多开_取登录数量`：读取最近快照中非 `stopped` 实例和已登录实例的计数。
- `微信多开_取错误`：返回最近中文错误，不包含访问令牌。

## 完整示例

```text
事件 _主窗口_创建完毕()
    微信多开_绑定监控界面(微信实例列表, 状态栏, 运行日志)
结束

事件 _启动微信按钮_被单击()
    如果 (微信多开_启动微信(控件_取文本(微信路径输入)))
        微信多开_立即刷新()
    否则
        信息框(微信多开_取错误(), 0, "启动失败")
    如果结束
结束
```

## 依赖与平台限制

- 仅支持 LingBuilder `0.2.9` 或更高版本、Windows、MSVC、Win32/x64 宿主；该版本要求用于保证源码型模块的 `controlRef(nativeHandle)` 在生成事件中可访问。被注入的微信和 Agent 为 x64。
- 需要精确版本 `Weixin.exe 4.1.10.27` 和本机 `.NET 8 Desktop Runtime`。
- 模块只连接本机 Host。Host 令牌由 Windows DPAPI 保护并保存在当前用户 `%LOCALAPPDATA%\WxHook.Manager\secrets\local-token.dpapi`，模块不会把令牌写入源码、命令行或日志。
- 头像 URL 只下载到当前用户 `%LOCALAPPDATA%\LingBuilder\wxmore-tool\avatars` 缓存，并限制单张响应大小。
- 登录状态、wxid 和头像来自不同的微信内部数据源。界面在 Host 产生新快照后约 0.5 秒内刷新；上游 Agent 为保证进程稳定保留必要的安全等待。

## 迁移与弃用

旧项目中直接使用 `程序_启动("WeChat.exe /multiple")` 只能启动进程，无法可靠关联多个实例及其资料。应改用本模块的受管启动与监控命令。禁止同时运行旧版 `wxhookdll.dll`、Frida Gadget 或其它会修改同一微信进程的注入器。

第三方 JSON 解析器使用 nlohmann/json（MIT License），来源与现有 WxHook.Agent 工程一致。
