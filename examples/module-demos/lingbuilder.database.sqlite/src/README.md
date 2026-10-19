# SQLite 数据库模块完整演示

- 模块 ID：`lingbuilder.database.sqlite`
- 版本：`2.3.0`
- 类型：LingBuilder 内置模块
- 命令数：73
- 设计器控件数：0
- 分组数：4

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

面向生产项目的 SQLite 动态桥接：多连接、参数化预编译语句、强类型字段、事务、WAL、备份、SQLCipher/RC4 等多算法加密、随模块内置的 csv 虚拟表（把 CSV 文件当表直连查询与入库）与完整错误诊断。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `SQLite_加载运行库` | `SQLite_加载运行库(DLL路径)` | bool | 显式加载 SQLite 运行库并校验模块所需导出。存在活动连接时拒绝切换 DLL。 |
| 2 | `SQLite_卸载运行库` | `SQLite_卸载运行库()` | bool | 在没有活动连接和语句时卸载 sqlite3.dll。 |
| 3 | `SQLite_取运行库版本` | `SQLite_取运行库版本()` | wideString | 返回当前已加载 SQLite 运行库的版本号。 |
| 4 | `SQLite_运行库线程安全` | `SQLite_运行库线程安全()` | bool | 返回运行库编译时是否启用了 SQLite 线程安全支持。 |
| 5 | `SQLite_运行库是否支持加密` | `SQLite_运行库是否支持加密()` | bool | 检查当前运行库是否提供 sqlite3_key 加密导出（LingBuilder 随附运行库或 SQLCipher 兼容运行库）；不支持时加密打开命令会直接失败。 |
| 6 | `SQLite_取虚拟表支持` | `SQLite_取虚拟表支持(连接)` | wideString | 返回该连接可用的虚拟表模块名，当前为 "csv"；返回空文本表示运行库缺少虚拟表导出，CREATE VIRTUAL TABLE ... USING csv(...) 会报 no such module。 |
| 7 | `SQLite_设置加密算法` | `SQLite_设置加密算法(算法)` | bool | 设置下一次 SQLite_打开加密库 / SQLite_打开加密连接 使用的加密算法（进程级，对之后每次加密打开都生效，默认 sqlcipher）；未知算法返回假并记录中文错误。 |
| 8 | `SQLite_打开` | `SQLite_打开(数据库路径)` | bool | 兼容接口：打开默认读写连接，自动创建文件、启用外键并设置 5 秒忙等待。 |
| 9 | `SQLite_打开连接` | `SQLite_打开连接(数据库路径, 打开模式, 忙等待毫秒)` | SQLite连接 | 打开独立的 FULLMUTEX 连接；成功后默认启用扩展错误码和外键约束。 |
| 10 | `SQLite_打开内存库` | `SQLite_打开内存库(名称)` | SQLite连接 | 创建独立的内存数据库连接。 |
| 11 | `SQLite_打开加密库` | `SQLite_打开加密库(数据库路径, 密码)` | bool | 兼容接口：按 SQLite_设置加密算法 选定的算法（默认 SQLCipher）打开默认读写加密连接，自动创建文件、启用外键并设置 5 秒忙等待；需运行库支持加密，密码错误会返回假并记录中文错误。 |
| 12 | `SQLite_打开加密连接` | `SQLite_打开加密连接(数据库路径, 密码, 打开模式, 忙等待毫秒)` | SQLite连接 | 按 SQLite_设置加密算法 选定的算法（默认 SQLCipher）打开独立 FULLMUTEX 加密连接；打开后立即校验密码，需运行库提供 sqlite3_key 导出。 |
| 13 | `SQLite_探测加密算法` | `SQLite_探测加密算法(数据库路径, 密码)` | wideString | 依次按 sqlcipher、sqlcipher3、rc4、aes128、aes256、chacha20 档位只读尝试打开，返回第一个能用该密码读出 sqlite_master 的算法名；全部失败返回空文本并记录中文错误。 |
| 14 | `SQLite_关闭` | `SQLite_关闭()` | void | 兼容接口：关闭默认连接；没有其它连接时同时卸载运行库。 |
| 15 | `SQLite_关闭连接` | `SQLite_关闭连接(连接)` | bool | 释放连接所属全部语句后关闭连接。失效句柄会返回假。 |
| 16 | `SQLite_关闭全部` | `SQLite_关闭全部()` | void | 释放所有语句、关闭所有连接并卸载运行库。 |
| 17 | `SQLite_连接是否有效` | `SQLite_连接是否有效(连接)` | bool | 检查受管连接 ID 当前是否仍然有效。 |
| 18 | `SQLite_连接是否只读` | `SQLite_连接是否只读(连接)` | bool | 检查连接的 main 数据库是否为只读。 |
| 19 | `SQLite_连接是否在事务中` | `SQLite_连接是否在事务中(连接)` | bool | 返回连接是否处于显式事务或保存点中。 |
| 20 | `SQLite_设置忙等待` | `SQLite_设置忙等待(连接, 毫秒)` | bool | 设置连接遇到 SQLITE_BUSY 时的等待时间。 |
| 21 | `SQLite_设置外键` | `SQLite_设置外键(连接, 启用)` | bool | 启用或禁用 SQLite 外键约束；事务内修改会失败。 |
| 22 | `SQLite_设置同步模式` | `SQLite_设置同步模式(连接, 模式)` | bool | 设置 PRAGMA synchronous。 |
| 23 | `SQLite_启用WAL` | `SQLite_启用WAL(连接)` | bool | 把文件数据库切换为 WAL 日志模式并确认 SQLite 返回 wal。 |
| 24 | `SQLite_设置WAL自动检查点` | `SQLite_设置WAL自动检查点(连接, 页数)` | bool | 设置 WAL 自动检查点页数。 |
| 25 | `SQLite_WAL检查点` | `SQLite_WAL检查点(连接, 模式)` | int | 执行 WAL 检查点并返回状态：0 成功、1 忙、-1 失败。 |
| 26 | `SQLite_取WAL日志帧数` | `SQLite_取WAL日志帧数()` | int | 返回当前线程最近一次 WAL 检查点报告的日志帧数。 |
| 27 | `SQLite_取WAL已检查点帧数` | `SQLite_取WAL已检查点帧数()` | int | 返回当前线程最近一次 WAL 检查点报告的已检查点帧数。 |
| 28 | `SQLite_执行` | `SQLite_执行(SQL语句)` | bool | 兼容接口：在默认连接执行无结果 SQL。 |
| 29 | `SQLite_执行于` | `SQLite_执行于(连接, SQL语句)` | bool | 在指定连接执行一条或多条无结果 SQL。 |
| 30 | `SQLite_查询首值` | `SQLite_查询首值(SQL语句)` | wideString | 兼容接口：返回默认连接首行首列的文本表示。NULL、无行或失败均返回空文本，应结合错误码判断。 |
| 31 | `SQLite_查询首值于` | `SQLite_查询首值于(连接, SQL语句)` | wideString | 返回指定连接首行首列的文本表示；复杂查询应使用预编译语句。 |
| 32 | `SQLite_准备` | `SQLite_准备(连接, SQL语句)` | SQLite语句 | 创建受管预编译语句，用于参数化执行和逐行读取。 |
| 33 | `SQLite_语句是否有效` | `SQLite_语句是否有效(语句)` | bool | 检查预编译语句 ID 当前是否仍然有效。 |
| 34 | `SQLite_语句步进` | `SQLite_语句步进(语句)` | int | 执行或读取下一行：1=得到一行，0=执行完成，-1=失败。 |
| 35 | `SQLite_语句重置` | `SQLite_语句重置(语句)` | bool | 把语句重置到首次步进前，保留现有参数绑定。 |
| 36 | `SQLite_语句清空绑定` | `SQLite_语句清空绑定(语句)` | bool | 把语句的全部参数恢复为 NULL。 |
| 37 | `SQLite_语句释放` | `SQLite_语句释放(语句)` | bool | 立即释放预编译语句；连接关闭时也会兜底释放。 |
| 38 | `SQLite_语句是否只读` | `SQLite_语句是否只读(语句)` | bool | 判断语句是否不会直接修改数据库内容。 |
| 39 | `SQLite_语句取参数数量` | `SQLite_语句取参数数量(语句)` | int | 返回 SQL 中参数的最大索引。 |
| 40 | `SQLite_语句取参数索引` | `SQLite_语句取参数索引(语句, 参数名)` | int | 返回命名参数的 1 起始索引，找不到返回 0。 |
| 41 | `SQLite_绑定空值` | `SQLite_绑定空值(语句, 参数索引)` | bool | 把参数绑定为 SQL NULL。 |
| 42 | `SQLite_绑定整数` | `SQLite_绑定整数(语句, 参数索引, 数值)` | bool | 把参数绑定为 32 位整数。 |
| 43 | `SQLite_绑定长整数` | `SQLite_绑定长整数(语句, 参数索引, 数值)` | bool | 把参数绑定为 64 位整数。 |
| 44 | `SQLite_绑定小数` | `SQLite_绑定小数(语句, 参数索引, 数值)` | bool | 把参数绑定为双精度小数。 |
| 45 | `SQLite_绑定文本` | `SQLite_绑定文本(语句, 参数索引, 文本)` | bool | 把参数安全绑定为文本。 |
| 46 | `SQLite_绑定字节集` | `SQLite_绑定字节集(语句, 参数索引, 数据)` | bool | 把参数安全绑定为 BLOB。 |
| 47 | `SQLite_取列数量` | `SQLite_取列数量(语句)` | int | 返回结果列数量。 |
| 48 | `SQLite_取列名称` | `SQLite_取列名称(语句, 列索引)` | wideString | 返回结果列名。 |
| 49 | `SQLite_取列类型` | `SQLite_取列类型(语句, 列索引)` | int | 返回当前行存储类型：1=整数，2=小数，3=文本，4=字节集，5=NULL；失败返回 0。 |
| 50 | `SQLite_取列是否为空` | `SQLite_取列是否为空(语句, 列索引)` | bool | 判断当前行指定列是否为 SQL NULL。 |
| 51 | `SQLite_取列整数` | `SQLite_取列整数(语句, 列索引)` | int | 按 SQLite 转换规则读取 32 位整数。 |
| 52 | `SQLite_取列长整数` | `SQLite_取列长整数(语句, 列索引)` | longLong | 按 SQLite 转换规则读取 64 位整数。 |
| 53 | `SQLite_取列小数` | `SQLite_取列小数(语句, 列索引)` | double | 按 SQLite 转换规则读取双精度小数。 |
| 54 | `SQLite_取列文本` | `SQLite_取列文本(语句, 列索引)` | wideString | 读取 UTF-8 文本；SQL NULL 返回空文本，应用应先检查列类型。 |
| 55 | `SQLite_取列字节集` | `SQLite_取列字节集(语句, 列索引)` | bytes | 读取 BLOB 的独立副本；SQL NULL 返回空字节集。 |
| 56 | `SQLite_开始事务` | `SQLite_开始事务(连接, 模式)` | bool | 开始显式事务；批量写入推荐 IMMEDIATE。 |
| 57 | `SQLite_提交事务` | `SQLite_提交事务(连接)` | bool | 提交当前事务。失败时事务可能仍保持活动，应读取错误并决定回滚。 |
| 58 | `SQLite_回滚事务` | `SQLite_回滚事务(连接)` | bool | 回滚当前事务。 |
| 59 | `SQLite_创建保存点` | `SQLite_创建保存点(连接, 名称)` | bool | 创建可嵌套保存点。 |
| 60 | `SQLite_释放保存点` | `SQLite_释放保存点(连接, 名称)` | bool | 释放并提交指定保存点。 |
| 61 | `SQLite_回滚到保存点` | `SQLite_回滚到保存点(连接, 名称)` | bool | 回滚到指定保存点但不自动释放它。 |
| 62 | `SQLite_备份到文件` | `SQLite_备份到文件(连接, 目标路径, 忙等待毫秒)` | bool | 使用 SQLite Online Backup API 生成一致性备份，不直接复制活动数据库文件。 |
| 63 | `SQLite_完整性检查` | `SQLite_完整性检查(连接, 快速检查)` | wideString | 执行数据库完整性检查并返回首条结果；正常结果为 ok。 |
| 64 | `SQLite_中断` | `SQLite_中断(连接)` | bool | 请求中断该连接当前正在执行的长查询；SQLite 会在安全点返回 SQLITE_INTERRUPT。 |
| 65 | `SQLite_取更改行数` | `SQLite_取更改行数()` | int | 兼容接口：返回默认连接最近语句直接修改的行数。 |
| 66 | `SQLite_取连接更改行数` | `SQLite_取连接更改行数(连接)` | longLong | 返回指定连接最近语句直接修改的 64 位行数。 |
| 67 | `SQLite_取累计更改行数` | `SQLite_取累计更改行数(连接)` | longLong | 返回连接自打开以来直接修改的累计 64 位行数；SQLite 不会因事务回滚减少该计数。 |
| 68 | `SQLite_取最后插入行号` | `SQLite_取最后插入行号(连接)` | longLong | 返回连接最近一次成功 INSERT 的 rowid；事务回滚不会自动恢复该值。 |
| 69 | `SQLite_取错误` | `SQLite_取错误()` | wideString | 返回当前线程最近一次 SQLite 模块错误，包含操作、主错误码和扩展错误码。 |
| 70 | `SQLite_取错误码` | `SQLite_取错误码()` | int | 返回当前线程最近一次 SQLite 主错误码。 |
| 71 | `SQLite_取扩展错误码` | `SQLite_取扩展错误码()` | int | 返回当前线程最近一次 SQLite 扩展错误码。 |
| 72 | `SQLite_取系统错误码` | `SQLite_取系统错误码()` | int | 返回当前线程最近一次 SQLite 关联的操作系统错误码；运行库不支持时为 0。 |
| 73 | `SQLite_错误码到文本` | `SQLite_错误码到文本(错误码)` | wideString | 把 SQLite 错误码转换为运行库提供的英文稳定说明，便于日志和支持。 |
