# SQLite 数据库模块 2.1

模块 ID：`lingbuilder.database.sqlite`  
模块版本：`2.1.0`  
目标：Windows / MSVC / Win32 与 x64  
运行库：LingBuilder 随附 SQLite3MultipleCiphers 运行库（SQLCipher 兼容），或用户自备的官方 `sqlite3.dll`；DLL 架构必须与生成程序一致

## 定位与商用边界

本模块是 SQLite C API 的受管动态桥接，不向 `.lcpp` 暴露 `sqlite3*`、`sqlite3_stmt*` 或任意内存地址。连接和语句使用进程内不复用的 64 位受管 ID；关闭连接会兜底释放其全部语句，运行库在仍有活动资源时不能被切换或卸载。

SQLite 本身属于 public domain，但生产发布仍应固定 SQLite 版本和来源，并记录 DLL 的 SHA-256。LingBuilder 不会从网络自动下载 DLL，也不会从 PATH 静默替换已经显式选择的版本。建议把对应架构的官方 DLL 放到最终 EXE 同目录，程序调用 `SQLite_加载运行库("sqlite3.dll")` 后再开放数据库功能。

“商用级”在本模块中表示：

- 多连接与每连接串行访问，连接使用 `SQLITE_OPEN_FULLMUTEX`。
- 默认启用扩展错误码、外键约束和 5 秒锁等待。
- 支持预编译语句、命名/位置参数、NULL、64 位整数、双精度、UTF-8 文本和 BLOB。
- 支持显式事务、三种开始模式、嵌套保存点、WAL、检查点和一致性在线备份。
- 所有失效句柄、索引越界、错误模式和底层错误都有可读取的诊断。
- Win32/x64 均完成 MSVC Release 编译；x64 使用真实 SQLite 运行库完成原生 smoke。

它不替代业务层的数据迁移、访问控制、备份保留、密钥管理和恢复演练。数据库文件加密通过随附运行库的 `sqlite3_key` 导出提供（详见下文「加密数据库（SQLCipher 兼容）」）；密码本身不能写入 SQL、日志或源码。

## 部署

1. F5 构建、AI Bridge 构建和 Visual Studio 工程导出会自动把 LingBuilder 随附的 `sqlite3.dll`（SQLite3MultipleCiphers 2.5.1，SQLCipher 兼容，静态 CRT，仅依赖系统 KERNEL32）复制到生成 exe 同目录，Win32 项目使用 x86 版本，x64 项目使用 x64 版本；来源与 SHA-256 见 `electron/third_party/sqlite/NOTICE.md`。
2. 也可以从 SQLite 官方发布渠道或组织内部已审计的构建自备 DLL（此时加密命令需要运行库提供 `sqlite3_key` 导出，例如 SQLCipher 或 SQLite3MultipleCiphers）。
3. 固定版本、下载地址、文件大小和 SHA-256，不要在每次构建时抓取“最新版”。
4. 启动时调用 `SQLite_加载运行库("sqlite3.dll")` 显式加载自备 DLL，失败时显示 `SQLite_取错误()`，不要继续假装数据库可用；不调用时运行库按系统 DLL 搜索规则查找 exe 同目录的 `sqlite3.dll`。
5. 发布前分别验证 Win32/x64 包，确认输出目录中的 DLL 架构与 exe 一致。

模块要求运行库至少导出常用的 SQLite 3 C API，包括 `sqlite3_open_v2`、`sqlite3_close_v2`、预编译/绑定/列读取、Online Backup 和 WAL checkpoint。较新的 `sqlite3_changes64`、`sqlite3_total_changes64`、`sqlite3_bind_blob64`、`sqlite3_system_errno` 与 `sqlite3_errstr` 为可选增强；缺少时模块在安全范围内回退。

## 打开模式与状态值

`SQLite_打开连接(路径, 打开模式, 忙等待毫秒)` 的模式：

| 值 | 模式 | 行为 |
|---:|---|---|
| 0 | 读写并创建 | 文件不存在时创建，普通应用默认使用 |
| 1 | 只读 | 不修改文件，不创建数据库 |
| 2 | 读写但不创建 | 文件不存在时失败 |
| 3 | 独立内存库 | 每次调用创建独立 `:memory:` 数据库 |

`SQLite_语句步进` 返回 `1` 表示得到一行，`0` 表示执行完成，`-1` 表示失败。只有最近一次步进返回 1 时才允许读取列，语句重置、完成或失败后读取会给出明确错误。列索引从 0 开始，参数索引从 1 开始。`SQLite_取列类型` 返回 `1=整数`、`2=小数`、`3=文本`、`4=字节集`、`5=NULL`，失败返回 0。

## 加密数据库（SQLCipher 兼容）

2.1 起提供基于 `sqlite3_key` 的数据库加密。加密打开命令统一按 **SQLCipher 方案** 开库（先执行 `PRAGMA cipher=sqlcipher` 再注入密钥），因此：

- 本模块创建的加密库可以被官方 SQLCipher 工具读取（DB Browser for SQLite 的 SQLCipher 模式、sqlcipher 命令行等，SQLCipher 4 默认参数）。
- 由 SQLCipher 4 默认参数加密的存量数据库可以直接打开。
- SQLCipher 3 或更旧参数加密的存量库不保证直接兼容，请先用 SQLCipher 工具转换后再打开。
- 明文数据库请继续使用 `SQLite_打开连接` / `SQLite_打开`；对明文库执行加密打开会报“文件不是数据库”。

命令与语义：

| 命令 | 说明 |
|---|---|
| `SQLite_运行库是否支持加密()` | 检查当前运行库是否提供 `sqlite3_key` 导出；随附运行库返回真 |
| `SQLite_打开加密库(路径, 密码)` | 兼容接口：以 SQLCipher 方案打开默认读写加密连接（不存在则创建），自动启用外键并设置 5 秒忙等待 |
| `SQLite_打开加密连接(路径, 密码, 模式, 忙等待毫秒)` | 打开独立 FULLMUTEX 加密连接，模式含义与 `SQLite_打开连接` 相同 |

行为细节：

- 密码不能为空；运行库缺少 `sqlite3_key` 导出（例如普通官方 `sqlite3.dll`）时，加密打开命令直接失败并给出中文诊断。
- 打开现有加密库时会立即执行一次真实读取来校验密码；密码错误或文件不是 SQLCipher 兼容格式时返回失败，`SQLite_取错误()` 会包含 SQLite 原始说明（通常为“文件不是数据库”）与错误码。
- 密钥以 UTF-8 编码传给运行库；SQLCipher 会用密钥派生页密钥，密码本身不落盘。忘记密码即无法恢复数据，请自行做好密钥托管。
- WAL、事务、预编译语句、完整性检查等其余命令对加密连接与明文连接行为一致。注意：`SQLite_备份到文件` 的备份目标由运行库以无密钥方式打开，与加密源不兼容（SQLCipher 会拒绝），因此**不能**对加密库使用在线备份；如需迁移加密库，请使用 SQLCipher 工具（如 `sqlcipher_export`）或同密钥打开的两个连接间复制。

## 推荐完整示例

```text
类 MainWindow
    事件 _MainWindow_创建完毕()
        如果 !SQLite_加载运行库("sqlite3.dll")
            信息框(SQLite_取错误(), 16, "数据库不可用")
            返回
        结束

        局部 SQLite连接 数据库 = SQLite_打开连接("data/app.db", 0, 5000)
        如果 数据库 == 0
            信息框(SQLite_取错误(), 16, "打开失败")
            返回
        结束

        SQLite_启用WAL(数据库)
        SQLite_设置同步模式(数据库, 2)
        SQLite_执行于(数据库, "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, score REAL, avatar BLOB)")

        如果 SQLite_开始事务(数据库, 1)
            局部 SQLite语句 写入 = SQLite_准备(数据库, "INSERT INTO users(name, score, avatar) VALUES(:name, :score, :avatar)")
            如果 写入 != 0
                SQLite_绑定文本(写入, SQLite_语句取参数索引(写入, ":name"), "张三")
                SQLite_绑定小数(写入, SQLite_语句取参数索引(写入, ":score"), 98.5)
                SQLite_绑定字节集(写入, SQLite_语句取参数索引(写入, ":avatar"), 头像数据)
                如果 SQLite_语句步进(写入) == 0
                    SQLite_提交事务(数据库)
                否则
                    SQLite_回滚事务(数据库)
                    调试输出(SQLite_取错误())
                结束
                SQLite_语句释放(写入)
            否则
                SQLite_回滚事务(数据库)
            结束
        结束

        局部 SQLite语句 查询 = SQLite_准备(数据库, "SELECT id, name, score, avatar FROM users ORDER BY id")
        判断循环首 SQLite_语句步进(查询) == 1
            局部 长整数型 用户ID = SQLite_取列长整数(查询, 0)
            局部 文本型 姓名 = SQLite_取列文本(查询, 1)
            局部 双精度小数型 分数 = SQLite_取列小数(查询, 2)
            局部 字节集 头像 = SQLite_取列字节集(查询, 3)
        判断循环尾
        SQLite_语句释放(查询)

        SQLite_备份到文件(数据库, "backup/app.db", 10000)
        SQLite_关闭连接(数据库)
        SQLite_卸载运行库()
    结束
结束类
```

示例中的 `头像数据` 应是项目已有的 `字节集` 变量。生产代码应在每次返回假、0 或 -1 时记录 `SQLite_取错误()`、`SQLite_取错误码()` 和 `SQLite_取扩展错误码()`。

## API 分类

### 运行库与连接

| 命令 | 返回值 | 说明 |
|---|---|---|
| `SQLite_加载运行库(DLL路径)` | 逻辑型 | 加载并校验 DLL；活动连接存在时拒绝切换 |
| `SQLite_卸载运行库()` | 逻辑型 | 仅在无活动资源时卸载 |
| `SQLite_取运行库版本()` | 文本型 | 返回实际 DLL 版本 |
| `SQLite_运行库线程安全()` | 逻辑型 | 检查 SQLite 编译时线程安全开关 |
| `SQLite_运行库是否支持加密()` | 逻辑型 | 检查运行库是否提供 `sqlite3_key` 加密导出 |
| `SQLite_打开连接(路径, 模式, 忙等待毫秒)` | SQLite连接 | 打开独立 FULLMUTEX 连接 |
| `SQLite_打开内存库(名称)` | SQLite连接 | 创建独立内存数据库 |
| `SQLite_打开加密库(路径, 密码)` | 逻辑型 | 以 SQLCipher 方案打开默认加密连接 |
| `SQLite_打开加密连接(路径, 密码, 模式, 忙等待毫秒)` | SQLite连接 | 打开独立 FULLMUTEX 加密连接并校验密码 |
| `SQLite_关闭连接(连接)` | 逻辑型 | 释放所属语句并关闭连接 |
| `SQLite_关闭全部()` | 空 | 关闭全部资源并卸载 DLL |
| `SQLite_连接是否有效(连接)` | 逻辑型 | 检查受管 ID 生命周期 |
| `SQLite_连接是否只读(连接)` | 逻辑型 | 查询 main 数据库只读状态 |
| `SQLite_设置忙等待(连接, 毫秒)` | 逻辑型 | 范围 0～600000 |
| `SQLite_设置外键(连接, 启用)` | 逻辑型 | 执行安全固定 PRAGMA |

兼容旧项目的 `SQLite_打开`、`SQLite_执行`、`SQLite_查询首值`、`SQLite_取更改行数` 和 `SQLite_关闭` 使用一个默认连接。新项目应优先使用显式 `SQLite连接`。

### 预编译语句与绑定

`SQLite_准备` 只接受一条 SQL，尾部可以有空白和分号，但不能藏入第二条语句。它返回的 `SQLite语句` 归属于原连接。

- 生命周期：`SQLite_语句是否有效`、`SQLite_语句步进`、`SQLite_语句重置`、`SQLite_语句清空绑定`、`SQLite_语句释放`、`SQLite_语句是否只读`。
- 参数元数据：`SQLite_语句取参数数量`、`SQLite_语句取参数索引`。
- 强类型绑定：`SQLite_绑定空值`、`SQLite_绑定整数`、`SQLite_绑定长整数`、`SQLite_绑定小数`、`SQLite_绑定文本`、`SQLite_绑定字节集`。
- 结果读取：`SQLite_取列数量`、`SQLite_取列名称`、`SQLite_取列类型`、`SQLite_取列是否为空`、`SQLite_取列整数`、`SQLite_取列长整数`、`SQLite_取列小数`、`SQLite_取列文本`、`SQLite_取列字节集`。

所有外部输入都必须绑定。禁止把用户名、搜索词、路径片段或网络参数直接拼入 SQL。表名和列名不能通过值参数绑定；动态标识符必须在业务层使用固定白名单映射。

### 事务、WAL 与维护

- `SQLite_开始事务(连接, 模式)`：`0=DEFERRED`、`1=IMMEDIATE`、`2=EXCLUSIVE`。
- `SQLite_提交事务`、`SQLite_回滚事务`、`SQLite_连接是否在事务中`。
- `SQLite_创建保存点`、`SQLite_释放保存点`、`SQLite_回滚到保存点`：名称由运行时作为标识符安全引用。
- `SQLite_设置同步模式`：`0=OFF`、`1=NORMAL`、`2=FULL`、`3=EXTRA`。关键业务数据推荐 FULL；不要在不理解掉电风险时使用 OFF。
- `SQLite_启用WAL`、`SQLite_设置WAL自动检查点`、`SQLite_WAL检查点`、`SQLite_取WAL日志帧数`、`SQLite_取WAL已检查点帧数`。
- `SQLite_备份到文件` 使用 Online Backup API。不得用普通文件复制替代活动数据库备份。
- `SQLite_完整性检查` 收集 SQLite 返回的全部诊断行，正常结果为 `ok`。它不是备份恢复演练的替代品。
- `SQLite_中断` 可由另一线程请求中断长查询，不会强制终止线程。

### 状态与错误

- `SQLite_取连接更改行数` 返回最近语句直接更改数；`SQLite_取累计更改行数` 包含后来被回滚的更改，不会因回滚减少。
- `SQLite_取最后插入行号` 属于连接状态，事务回滚不会自动恢复该值。并发写入必须使用各自连接，不能把它当成跨连接全局编号。
- `SQLite_取错误`、`SQLite_取错误码`、`SQLite_取扩展错误码`、`SQLite_取系统错误码` 保存当前线程最近一次模块错误。
- `SQLite_错误码到文本` 返回 SQLite 运行库提供的稳定英文说明；面向用户的上下文仍应使用 `SQLite_取错误`。

返回空文本不一定表示失败：SQL NULL、零长度文本和无结果都可能得到空文本。需要区分时，使用预编译语句并先检查 `SQLite_语句步进` 和 `SQLite_取列类型`。

## 并发与资源规则

- 同一连接上的模块调用会串行化；多个线程并发查询建议各自持有连接。
- 不要从一个线程关闭另一个线程正在使用的语句。模块会避免悬空指针，但业务层仍应保持清晰所有权。
- `SQLite_中断` 是专门允许跨线程调用的取消入口。
- 连接关闭会释放遗留语句，但正常代码仍应显式 `SQLite_语句释放`，便于尽早释放锁和内存。
- 应用退出或工作区切换前调用 `SQLite_关闭全部`；不要依赖进程强退回收事务。
- 大事务应分批提交并设置合理忙等待；不要在 UI 线程执行不可控的全表扫描、完整性检查或大型备份。

## 验证

模块 manifest、binding 和生成运行时由 `electron/tests/modules.test.ts` 覆盖。原生验收命令：

```bash
cd electron
npm run smoke:sqlite-native
```

脚本编译 Win32/x64 Release 工程，并在 x64 上验证动态加载、SQLCipher 兼容加密打开与错误密码拒绝、WAL、外键、事务/保存点、参数绑定、UTF-8、NULL/BLOB、逐行读取、在线备份、完整性检查、错误码和资源释放。默认使用 LingBuilder 随附运行库（`electron/third_party/sqlite/x64/sqlite3.dll`），也可用 `LINGBUILDER_SQLITE3_DLL` 指向要验收的 x64 SQLCipher 兼容 DLL。
