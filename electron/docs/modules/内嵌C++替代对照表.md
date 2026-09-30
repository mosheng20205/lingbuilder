# 内嵌 C++（@ 行）→ 中文命令替代对照表

> 本文档由 `electron/scripts/generate-inline-cpp-api-map.ts` 从 `electron/src/services/lingCpp/inlineCppKnowledge.ts` 的替代知识表确定性生成，
> 与 `lingcpp-inline-cpp-replaceable` 诊断警告、codeOrganization 用量报告、构建日志汇总行同源；**不要手改正文**，改知识表后重新生成。

LingBuilder 的目标是把项目里的 @ 内嵌 C++ 降到 0。写 @ 行前先查本表：
命中「推荐命令」的，请直接改用中文命令重写；确实没有等价命令的，可在该 @ 行行尾追加 `// 允许: 原因` 显式豁免（项目开启 `forbidInlineCpp` 门禁时豁免行放行）。

知识表共 22 条，覆盖模块：`lingbuilder.advanced.process-memory`、`lingbuilder.win32.basic`、`lingbuilder.std.datetime`、`lingbuilder.std.encoding`、`lingbuilder.crypto.hash`、`lingbuilder.std.bytes`、`lingbuilder.win32.window-utils`、`lingbuilder.process`、`lingbuilder.system.shell`、`lingbuilder.config.registry`、`lingbuilder.std.math`。

| Win32 API / C 函数 / 写法 | 推荐中文命令 | 所在模块 | 说明 |
| --- | --- | --- | --- |
| OpenProcess | `进程内存_打开(进程ID, 允许写入)` | `lingbuilder.advanced.process-memory` |  |
| ReadProcessMemory | `进程内存_读字节集(句柄, 地址, 长度)`、`进程内存_读整数(句柄, 地址, 默认值)`、`进程内存_扫描字节集(句柄, 特征字节集, 最大命中数, 结果数组)` | `lingbuilder.advanced.process-memory` |  |
| WriteProcessMemory | `进程内存_写字节集(句柄, 地址, 数据)`、`进程内存_写整数(句柄, 地址, 数值)` | `lingbuilder.advanced.process-memory` |  |
| VirtualQueryEx | `进程内存_枚举区域JSON(句柄, 只列已提交可读区域)` | `lingbuilder.advanced.process-memory` |  |
| GetCursorPos | `取鼠标水平位置()`、`取鼠标垂直位置()` | `lingbuilder.win32.basic` |  |
| SetCursorPos | `设置鼠标位置(横, 纵)` | `lingbuilder.win32.basic` |  |
| GetSystemTimeAsFileTime / time(NULL) | `时间_当前时间戳()（Unix 秒）`、`时间_当前毫秒()（Unix 毫秒）` | `lingbuilder.std.datetime` |  |
| GetLocalTime | `时间_取现行()`、`时间_取年份/取月份/取日/取小时/取分钟/取秒` | `lingbuilder.std.datetime` |  |
| MultiByteToWideChar / WideCharToMultiByte | `编码_字节集转文本(数据, 编码名称)`、`编码_文本转字节集(文本, 编码名称)（支持 UTF-8/UTF-16/UTF-32/ANSI/GBK/GB2312/GB18030/RAW）` | `lingbuilder.std.encoding` |  |
| MD5 / SHA / SM3 / BLAKE 摘要 | `哈希_算法文本(文本)`、`哈希_算法字节集(数据)`、`哈希_算法文件(路径)（MD5/SHA1/SHA256/SHA3_256/SM3/BLAKE2b/BLAKE3）` | `lingbuilder.crypto.hash` |  |
| snprintf / swprintf / wsprintf | `格式化文本(格式模板, 参数...)` | `lingbuilder.win32.basic` |  |
| memcpy / memmove | `字节集_拼接(前段, 后段)`、`字节集_截取(数据, 起始位置, 长度)`、`字节集_插入(数据, 位置, 插入内容)`、`字节集_替换(数据, 欲寻找, 替换内容, 次数)` | `lingbuilder.std.bytes` |  |
| memset | `字节集_重复(次数, 单字节)`、`字节集_置字节(数据, 位置, 数值)` | `lingbuilder.std.bytes` |  |
| GetWindowText | `窗口_取自身标题()（自身窗口）`、`窗口_取标题(窗口句柄)（任意窗口）`、`控件_取文本(控件)（当前窗口控件）` | `lingbuilder.win32.window-utils` |  |
| SetWindowText | `窗口_设置自身标题(标题)（自身窗口）`、`窗口_设置标题(窗口句柄, 标题)（任意窗口）`、`控件_设置文本(控件, 文本)（当前窗口控件）` | `lingbuilder.win32.window-utils` |  |
| FindWindow | `窗口_按标题查找(标题)` | `lingbuilder.win32.window-utils` | 仅按标题精确匹配，暂无按类名查找变体。 |
| CreateProcess / WinExec | `程序_启动(命令行, 工作目录)`、`程序_启动并等待(命令行, 工作目录)`、`程序_执行并取输出(命令行, 参数数组)` | `lingbuilder.process` |  |
| ShellExecute | `系统_打开(目标)（文件/目录/网址）` | `lingbuilder.system.shell` |  |
| RegOpenKeyEx / RegQueryValueEx / RegSetValueEx | `注册表_读文本/读整数(路径, 名称)`、`注册表_写文本/写整数(路径, 名称, 值)`、`注册表_删除值(路径, 名称)`、`注册表_值是否存在(路径, 名称)` | `lingbuilder.config.registry` | 仅支持 HKCU，暂无 HKLM 与子键枚举。 |
| 位运算（右移常量） | `位_右移(甲, 位数)（逻辑右移补 0）`、`位_算术右移(甲, 位数)`、`位_与/位_或/位_异或(甲, 乙)`、`位_循环左移32(甲, 位数)` | `lingbuilder.std.math` | 全部按 64 位补码位模式处理，移位位数对 64 取模。 |
| 位运算（左移常量） | `位_左移(甲, 位数)`、`位_与/位_或/位_异或(甲, 乙)`、`位_循环左移32(甲, 位数)` | `lingbuilder.std.math` | 全部按 64 位补码位模式处理；zigzag = 位_异或(位_左移(n, 1), 位_算术右移(n, 63))。 |
| GetLastError | （无直接等价命令） | — | 无全局等价命令：用对应模块的 取最后错误/取错误码 命令（如 进程内存_取错误、文件_取错误、PB_取最后错误）。 请改用对应模块的「取最后错误/取错误码」类命令 |

## 位运算与签名算法专用口径（std.math v1.2.0）

- `位_*` 全族参数与返回值一律按 **64 位补码位模式** 处理，与 C 侧 `unsigned long long` 逐位兼容；移位位数对 64 取模（`位_循环左移32` 对 32 取模），与 x86 机器语义一致。
- 逻辑右移用 `位_右移`（高位恒补 0），有符号右移用 `位_算术右移`（高位补符号位）。
- protobuf zigzag：编码 `位_异或(位_左移(n, 1), 位_算术右移(n, 63))`。
- varint 负数按 proto 标准 10 字节补码编码，`PB_写字段_varint` 已内置该语义，不要手工处理。
