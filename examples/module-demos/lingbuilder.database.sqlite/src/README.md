# SQLite数据库桥接模块完整演示

- 模块 ID：`lingbuilder.database.sqlite`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：7
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

动态加载用户提供的 sqlite3.dll，提供单连接执行和查询闭环；缺少运行库时返回明确错误。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `SQLite_加载运行库` | `SQLite_加载运行库(DLL路径)` | bool | 加载 sqlite3.dll 并检查所需 API；空路径尝试系统搜索。 |
| 2 | `SQLite_打开` | `SQLite_打开(数据库路径)` | bool | 以 UTF-8 路径打开 SQLite 数据库。 |
| 3 | `SQLite_执行` | `SQLite_执行(SQL语句)` | bool | 执行无结果 SQL。 |
| 4 | `SQLite_查询首值` | `SQLite_查询首值(SQL语句)` | wideString | 返回首行首列 UTF-8 文本。 |
| 5 | `SQLite_取更改行数` | `SQLite_取更改行数()` | int | 返回最近语句更改的行数。 |
| 6 | `SQLite_取错误` | `SQLite_取错误()` | wideString | 返回最近 SQLite 或运行库加载错误。 |
| 7 | `SQLite_关闭` | `SQLite_关闭()` | void | 关闭数据库并卸载动态运行库。 |
