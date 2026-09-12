# MySQL 数据库模块 1.0

模块 ID：`lingbuilder.database.mysql`  
模块版本：`1.0.0`  
目标：Windows / MSVC / Win32 与 x64  
运行库：LingBuilder 随附 MariaDB Connector/C 3.4.10（`libmariadb.dll`，Schannel TLS 构建），或用户自备的 MariaDB Connector/C 运行库；DLL 架构必须与生成程序一致

## 定位与能力边界

本模块是 MariaDB Connector/C（`mysql_*` C API）的受管动态桥接，通过原生客户端/服务器协议直连 MySQL 5.x/8.x 与 MariaDB 服务器，不向 `.lcpp` 暴露 `MYSQL*`、`MYSQL_STMT*` 或任意内存地址。连接和语句使用进程内不复用的 64 位受管 ID；关闭连接会兜底释放其全部语句，运行库在仍有活动资源时不能被切换或卸载。

与 `lingbuilder.database.odbc` 的关系：ODBC 模块面向任意驱动（SQL Server、Access 等），本模块面向 MySQL/MariaDB 提供原生协议能力——密码直连、参数化预编译语句、逐行结果集读取、事务和服务器级错误诊断。两者可并存使用。

能力概览：

- 原生协议连接，支持账号密码、超时和 TLS（Schannel）开关；连接成功后自动协商 `utf8mb4`，中文文本全程 UTF-8 传输。
- 参数化预编译语句（`?` 占位符），支持 NULL、32/64 位整数、双精度、UTF-8 文本和字节集，杜绝 SQL 注入拼接。
- 逐行结果集读取：列数量、列名、NULL 判断、整数/长整数/小数/文本/字节集强类型读取。
- 显式事务（开始/提交/回滚）与自动提交开关。
- 线程级中文错误缓存：连接失败（还没有连接句柄）时也能通过 `MySQL_取错误()` 读取原因与原始服务器错误。

不提供的：连接池、异步/回调执行、多语句分隔执行、SSL 证书参数定制（当前仅“是否启用 TLS”开关）、主从复制。这些留待后续版本。

## 部署

1. F5 构建、AI Bridge 构建和 Visual Studio 工程导出会自动把 LingBuilder 随附的 `libmariadb.dll`（MariaDB Connector/C 3.4.10，Schannel 构建，仅依赖 Windows 系统 DLL）复制到生成 exe 同目录；Win32 项目使用 x86 版本，x64 项目使用 x64 版本。来源、构建口径与 SHA-256 见 `electron/third_party/mariadb/NOTICE.md`。
2. 也可以从 MariaDB 官方渠道或组织内部已审计的构建自备 DLL（建议同版本 3.4.x；TLS 能力依赖运行库自身支持）。
3. 程序启动时可调用 `MySQL_加载运行库("libmariadb.dll")` 显式加载自备 DLL；不调用时按系统 DLL 搜索规则查找 exe 同目录的 `libmariadb.dll`。
4. 发布前分别验证 Win32/x64 包，确认输出目录中的 DLL 架构与 exe 一致；服务器若要求 TLS，请在 `MySQL_连接扩展` 中启用 SSL 并确认服务器证书配置。

## 连接与密码

```text
局部 MySQL连接 数据库 = MySQL_连接("127.0.0.1", 3306, "root", "你的密码", "test")
如果 数据库 != 0
    调试输出(MySQL_取服务器信息(数据库))
否则
    调试输出(MySQL_取错误())
结束
```

- 密码通过 `MySQL_连接` / `MySQL_连接扩展` 的文本参数传入；模块不会把密码写入日志、错误信息或诊断输出。服务器返回的错误（如 `Access denied for user 'root'@'localhost' (using password: YES)`）由服务器生成，不含密码本身，但会原样透出以便定位。
- 连接失败返回 0，原因通过线程级缓存读取：`MySQL_取错误()`（中文操作名 + 原始服务器错误 + 错误码）、`MySQL_取错误码()`。
- `MySQL_连接扩展` 额外提供连接/读/写超时（秒）与「启用SSL」开关；启用 SSL 时使用 Schannel 强制 TLS，服务器不支持 TLS 会直接连接失败。
- 主机为空文本时使用 `127.0.0.1`；数据库为空文本时连接后不选择默认库，可稍后用 `MySQL_切换数据库`。
- 一个连接句柄只应被创建它的线程使用；多线程请每线程独立连接（可配合多线程模块）。所有 MySQL 命令都是阻塞调用，不要在界面事件里执行长查询。

## 参数化查询（推荐写法）

```text
局部 MySQL语句 写入 = MySQL_准备(数据库, "INSERT INTO users(name, score) VALUES(?, ?)")
如果 写入 != 0
    MySQL_绑定文本(写入, 1, "中文张三")
    MySQL_绑定整数(写入, 2, 95)
    如果 MySQL_语句执行(写入) >= 0
        调试输出("新行 ID：" + MySQL_取最后插入ID(数据库))
    否则
        调试输出(MySQL_取错误())
    结束
    MySQL_语句释放(写入)
结束
```

- 参数索引从 1 开始；`?` 占位符数量决定可用参数个数，越界绑定会给出中文错误。
- 未绑定的参数按 SQL NULL 处理；`MySQL_语句清空绑定` 恢复全部参数为 NULL。
- 绑定文本按 UTF-8 编码传给服务器，绑定字节集原样二进制传输；两者都在执行期间保持内存有效。
- 任何一次绑定、清空或重置后，下一次 `MySQL_语句步进` 会自动重新执行语句；`MySQL_语句执行` 用于 INSERT/UPDATE/DELETE 等非查询语句并返回受影响行数（失败 -1）。

## 逐行读取结果

`MySQL_语句步进` 返回 `1` 表示得到一行，`0` 表示没有更多行，`-1` 表示失败。只有最近一次步进返回 1 时才允许读取列。列索引从 0 开始。

```text
判断循环首 MySQL_语句步进(查询) == 1
    局部 长整数型 用户ID = MySQL_取列长整数(查询, 0)
    局部 文本型 姓名 = MySQL_取列文本(查询, 1)
    如果 MySQL_取列是否为空(查询, 2)
        调试输出("分数为 NULL")
    结束
判断循环尾
```

- `MySQL_取列是否为空` 用于判断 SQL NULL；`MySQL_取列文本` 对 NULL 返回空文本，`MySQL_取列字节集` 对 NULL 返回空字节集，数值列对 NULL 返回 0。
- 文本列先取真实字节长度再精确读取，超长文本（含多 MB BLOB）不会被截断。

## 事务

```text
MySQL_开始事务(数据库)
MySQL_执行(数据库, "UPDATE accounts SET balance = balance - 100 WHERE id = 1")
MySQL_执行(数据库, "UPDATE accounts SET balance = balance + 100 WHERE id = 2")
如果 MySQL_提交(数据库)
    调试输出("转账成功")
否则
    调试输出(MySQL_取错误())
    MySQL_回滚(数据库)
结束
```

`MySQL_设置自动提交(连接, 假)` 后每条语句都不再自动提交，需要显式 `MySQL_提交` 或 `MySQL_回滚`。

## 运行库要求

模块要求运行库提供标准 MariaDB Connector/C 导出，包括 `mysql_init`、`mysql_real_connect`、`mysql_real_query`、`mysql_stmt_*` 预编译语句族、`mysql_options`、`mysql_set_character_set`、事务与错误诊断导出；加载时逐项校验，缺失即报中文诊断并拒绝加载。LingBuilder 随附运行库已内置全部所需导出。

## 许可

MariaDB Connector/C 以 LGPL-2.1-or-later 许可分发；本模块以独立 DLL 形式随附运行库，用户可自行替换。许可文本见 `third_party/mariadb/COPYING.LIB`，构建口径见 `third_party/mariadb/NOTICE.md`。
