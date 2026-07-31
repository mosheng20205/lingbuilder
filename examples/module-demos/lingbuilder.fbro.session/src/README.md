# FBro会话模块完整演示

- 模块 ID：`lingbuilder.fbro.session`
- 版本：`2.0.0`
- 类型：LingBuilder 内置模块
- 命令数：10
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供隔离 Profile、Cookie 和代理认证高层能力。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `FBro会话_取Cookie` | `FBro会话_取Cookie(控件名, 地址)` | wideString | 读取指定 RequestContext 中的 Cookie。 |
| 2 | `FBro会话_清空Cookie` | `FBro会话_清空Cookie(控件名, 地址)` | int | 清空指定地址 Cookie。 |
| 3 | `FBro会话_设置代理认证` | `FBro会话_设置代理认证(控件名, 代理地址, 用户名, 密码)` | int | 设置隔离会话代理及认证信息。 |
| 4 | `FBro会话_异步取全部Cookie` | `FBro会话_异步取全部Cookie(控件名)` | longLong | 异步读取当前 RequestContext 的全部 Cookie，任务结果为 UTF-16 JSON 数组。 |
| 5 | `FBro会话_异步取地址Cookie` | `FBro会话_异步取地址Cookie(控件名, 地址, 包含HttpOnly)` | longLong | 异步读取指定地址 Cookie，任务结果为 UTF-16 JSON 数组。 |
| 6 | `FBro会话_异步设置Cookie` | `FBro会话_异步设置Cookie(控件名, 地址, 名称, 值, 域, 路径, 安全, 仅HTTP)` | longLong | 通过官方 CookieManager 异步设置 Cookie，并返回受管任务 ID。 |
| 7 | `FBro会话_异步删除Cookie` | `FBro会话_异步删除Cookie(控件名, 地址, 名称)` | longLong | 异步删除指定 Cookie；名称留空时删除该地址全部 Cookie。 |
| 8 | `FBro会话_异步刷新Cookie存储` | `FBro会话_异步刷新Cookie存储(控件名)` | longLong | 异步请求 FBro 将 Cookie 写入持久化存储。 |
| 9 | `FBro会话_异步清理缓存` | `FBro会话_异步清理缓存(控件名, 来源, 移除标志, 配额标志)` | longLong | 异步清理当前浏览器实例指定来源的缓存数据。 |
| 10 | `FBro会话_异步清理全局缓存` | `FBro会话_异步清理全局缓存(来源, 移除标志, 配额标志)` | longLong | 异步清理所有 FBro 实例共享的全局缓存数据。 |
