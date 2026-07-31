# CEF3会话模块完整演示

- 模块 ID：`lingbuilder.cef3.session`
- 版本：`3.0.0-alpha.2`
- 类型：LingBuilder 内置模块
- 命令数：19
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供每实例RequestContext、缓存和Cookie隔离会话能力。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `CEF3会话_取缓存目录` | `CEF3会话_取缓存目录(控件名)` | wideString | 取得实例实际使用的独立缓存目录。 |
| 2 | `CEF3会话_取代理` | `CEF3会话_取代理(控件名)` | wideString | 取得实例创建时应用的代理地址。 |
| 3 | `CEF3会话_取上下文` | `CEF3会话_取上下文(控件名)` | longLong | 取得浏览器独立RequestContext的类型化受管句柄。 |
| 4 | `CEF3会话_上下文取缓存目录` | `CEF3会话_上下文取缓存目录(上下文句柄)` | wideString | 从RequestContext读取实际缓存目录。 |
| 5 | `CEF3会话_是否有首选项` | `CEF3会话_是否有首选项(上下文句柄, 名称)` | int | 在CEF UI线程判断当前隔离会话是否存在指定Preference。 |
| 6 | `CEF3会话_首选项是否可写` | `CEF3会话_首选项是否可写(上下文句柄, 名称)` | int | 判断指定Preference能否在运行时修改。 |
| 7 | `CEF3会话_取首选项` | `CEF3会话_取首选项(上下文句柄, 名称)` | longLong | 读取Preference副本并返回CEF值受管句柄。 |
| 8 | `CEF3会话_取全部首选项` | `CEF3会话_取全部首选项(上下文句柄, 包含默认值)` | longLong | 读取全部Preference副本并返回CEF字典受管句柄。 |
| 9 | `CEF3会话_设置首选项` | `CEF3会话_设置首选项(上下文句柄, 名称, 值句柄)` | int | 设置隔离会话Preference；值句柄为0时恢复默认。 |
| 10 | `CEF3会话_清理HTTP缓存` | `CEF3会话_清理HTTP缓存(上下文句柄)` | longLong | 异步清理当前隔离会话的HTTP缓存并返回任务ID。 |
| 11 | `CEF3会话_清理证书例外` | `CEF3会话_清理证书例外(上下文句柄)` | longLong | 异步清理当前隔离会话的证书例外并返回任务ID。 |
| 12 | `CEF3会话_清理HTTP认证` | `CEF3会话_清理HTTP认证(上下文句柄)` | longLong | 异步清理当前隔离会话保存的HTTP认证凭据。 |
| 13 | `CEF3会话_关闭全部连接` | `CEF3会话_关闭全部连接(上下文句柄)` | longLong | 异步关闭当前隔离会话的活动与空闲连接。 |
| 14 | `CEF3会话_Cookie读取全部` | `CEF3会话_Cookie读取全部(上下文句柄)` | longLong | 异步读取当前隔离会话全部Cookie，任务结果为UTF-16 JSON数组。 |
| 15 | `CEF3会话_Cookie按地址读取` | `CEF3会话_Cookie按地址读取(上下文句柄, 地址, 包含HttpOnly)` | longLong | 异步读取指定地址Cookie。 |
| 16 | `CEF3会话_Cookie设置` | `CEF3会话_Cookie设置(上下文句柄, 地址, 名称, 值, 域, 路径, 安全, HttpOnly, 过期Unix秒)` | longLong | 异步写入Cookie；过期时间小于等于0时创建会话Cookie。 |
| 17 | `CEF3会话_Cookie删除` | `CEF3会话_Cookie删除(上下文句柄, 地址, 名称)` | longLong | 异步删除匹配Cookie，任务结果包含删除数量。 |
| 18 | `CEF3会话_Cookie落盘` | `CEF3会话_Cookie落盘(上下文句柄)` | longLong | 异步把当前会话Cookie写入独立存储。 |
| 19 | `CEF3会话_释放上下文` | `CEF3会话_释放上下文(上下文句柄)` | int | 释放RequestContext受管句柄。 |
