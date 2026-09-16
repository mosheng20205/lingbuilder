import { createModuleBindingSnippetArgument } from './bindingValueType';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type SqliteParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };
type SqliteCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function snippetArgument(parameter: SqliteParameter, index: number): string {
  if (parameter.type === 'controlRef' || parameter.type === 'handler') {
    return createModuleBindingSnippetArgument(parameter, index);
  }
  if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
  if (parameter.type === 'bytes') return `$${index + 1}`;
  if (parameter.type === 'bool') return '假';
  return '0';
}

function sqliteCommand(
  name: string,
  parameters: SqliteParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: SqliteCommandOptions = {}
): StandardCommandSpec {
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${parameters.map(snippetArgument).join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const connection = (description = '由 SQLite_打开连接 或 SQLite_打开内存库 返回的受管连接。'): SqliteParameter => ({
  name: '连接',
  type: 'SQLite连接',
  description
});

const statement = (description = '由 SQLite_准备 返回的受管预编译语句。'): SqliteParameter => ({
  name: '语句',
  type: 'SQLite语句',
  description
});

const parameterIndex: SqliteParameter = { name: '参数索引', type: 'int', description: '从 1 开始的参数索引。' };
const columnIndex: SqliteParameter = { name: '列索引', type: 'int', description: '从 0 开始的结果列索引。' };

export const SQLITE_MODULE_ID = 'lingbuilder.database.sqlite';

/** 随附运行库（third_party/sqlite，SQLite3MultipleCiphers 2.5.1）的 SHA-256 基线；详见 third_party/sqlite/NOTICE.md。 */
export const SQLITE_BUNDLED_RUNTIME_SHA256 = {
  x86: '8f1a7d3e6e27597ba328bab1799da8717506b8574611f4b02051e8460aedce22',
  x64: '5030decc6d914539e3b9b7e28aa4f6de1e7161dac6fd4b21eb02e6754d9b175e'
} as const;

const sqliteStandardModule = createStandardModule({
  id: SQLITE_MODULE_ID,
  name: 'SQLite 数据库模块',
  version: '2.2.0',
  category: '数据库',
  description: '面向生产项目的 SQLite 动态桥接：多连接、参数化预编译语句、强类型字段、事务、WAL、备份、SQLCipher/RC4 等多算法加密与完整错误诊断。',
  tags: ['数据库', 'SQLite', '事务', '预编译语句', 'WAL', '备份', 'SQLCipher', '加密'],
  types: [
    { name: 'SQLite连接', description: '进程内不复用的受管 SQLite 连接 ID；不暴露 sqlite3 指针。', cppType: 'long long' },
    { name: 'SQLite语句', description: '归属于单个连接的受管预编译语句 ID；不暴露 sqlite3_stmt 指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'SQLite 数据库模块 2.2 使用说明', path: 'docs/modules/sqlite/README.md' }],
  snippets: [
    {
      label: 'SQLite 参数化事务',
      description: '插入连接、事务、预编译语句、绑定和资源释放的安全骨架。',
      insertText: [
        '局部 SQLite连接 数据库 = SQLite_打开连接("data/app.db", 0, 5000)',
        '如果 数据库 != 0',
        '    如果 SQLite_开始事务(数据库, 1)',
        '        局部 SQLite语句 写入 = SQLite_准备(数据库, "INSERT INTO users(name, score) VALUES(?1, ?2)")',
        '        如果 写入 != 0',
        '            SQLite_绑定文本(写入, 1, "$1")',
        '            SQLite_绑定小数(写入, 2, 0)',
        '            如果 SQLite_语句步进(写入) == 0',
        '                SQLite_提交事务(数据库)',
        '            否则',
        '                SQLite_回滚事务(数据库)',
        '            结束',
        '            SQLite_语句释放(写入)',
        '        结束',
        '    结束',
        '    SQLite_关闭连接(数据库)',
        '结束'
      ].join('\n')
    },
    {
      label: 'SQLite 加密数据库',
      description: '以 SQLCipher 兼容方案打开加密库；需运行库提供 sqlite3_key（随附运行库已内置）。',
      insertText: [
        '局部 SQLite连接 安全库 = SQLite_打开加密连接("data/app.db", "$1", 0, 5000)',
        '如果 安全库 != 0',
        '    调试输出("加密库已打开")',
        '    SQLite_关闭连接(安全库)',
        '否则',
        '    调试输出(SQLite_取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    sqliteCommand('SQLite_加载运行库', [
      { name: 'DLL路径', type: 'wideString', description: 'sqlite3.dll 的绝对或相对路径；空文本按系统 DLL 搜索规则加载。' }
    ], 'bool', '显式加载 SQLite 运行库并校验模块所需导出。存在活动连接时拒绝切换 DLL。', {
      category: '运行库', example: 'SQLite_加载运行库("sqlite3.dll")', returnDescription: '全部必要导出可用时返回真，否则返回假并记录中文错误。'
    }),
    sqliteCommand('SQLite_卸载运行库', [], 'bool', '在没有活动连接和语句时卸载 sqlite3.dll。', { category: '运行库' }),
    sqliteCommand('SQLite_取运行库版本', [], 'wideString', '返回当前已加载 SQLite 运行库的版本号。', { category: '运行库' }),
    sqliteCommand('SQLite_运行库线程安全', [], 'bool', '返回运行库编译时是否启用了 SQLite 线程安全支持。', { category: '运行库' }),
    sqliteCommand('SQLite_运行库是否支持加密', [], 'bool', '检查当前运行库是否提供 sqlite3_key 加密导出（LingBuilder 随附运行库或 SQLCipher 兼容运行库）；不支持时加密打开命令会直接失败。', { category: '运行库' }),
    sqliteCommand('SQLite_设置加密算法', [
      { name: '算法', type: 'wideString', description: 'sqlcipher（默认，SQLCipher 4 参数）、sqlcipher3（SQLCipher 3 兼容）、rc4（老版 wxSQLite3/RC4 格式）、aes128、aes256、chacha20；传空恢复默认 sqlcipher。' }
    ], 'bool', '设置下一次 SQLite_打开加密库 / SQLite_打开加密连接 使用的加密算法（进程级，对之后每次加密打开都生效，默认 sqlcipher）；未知算法返回假并记录中文错误。', {
      category: '连接', example: 'SQLite_设置加密算法("rc4")', returnDescription: '设置成功返回真；算法名未知返回假。'
    }),

    sqliteCommand('SQLite_打开', [{ name: '数据库路径', type: 'wideString', description: '数据库文件路径。' }], 'bool', '兼容接口：打开默认读写连接，自动创建文件、启用外键并设置 5 秒忙等待。', {
      category: '兼容接口', example: 'SQLite_打开("data/app.db")'
    }),
    sqliteCommand('SQLite_打开连接', [
      { name: '数据库路径', type: 'wideString', description: '数据库文件路径；模式 3 时作为内存库名称。' },
      { name: '打开模式', type: 'int', description: '0=读写并创建，1=只读，2=读写但不创建，3=独立内存库。' },
      { name: '忙等待毫秒', type: 'int', description: '遇到锁竞争时等待的毫秒数，范围 0～600000。' }
    ], 'SQLite连接', '打开独立的 FULLMUTEX 连接；成功后默认启用扩展错误码和外键约束。', {
      category: '连接', example: 'SQLite_打开连接("data/app.db", 0, 5000)', returnDescription: '成功返回非 0 的 SQLite连接，失败返回 0。'
    }),
    sqliteCommand('SQLite_打开内存库', [{ name: '名称', type: 'wideString', description: '用于诊断的内存库名称；每次调用创建独立数据库。' }], 'SQLite连接', '创建独立的内存数据库连接。', {
      category: '连接', example: 'SQLite_打开内存库("测试库")'
    }),
    sqliteCommand('SQLite_打开加密库', [
      { name: '数据库路径', type: 'wideString', description: '加密数据库文件路径。' },
      { name: '密码', type: 'wideString', description: '加密密钥，不能为空；算法由 SQLite_设置加密算法 决定，默认 SQLCipher。' }
    ], 'bool', '兼容接口：按 SQLite_设置加密算法 选定的算法（默认 SQLCipher）打开默认读写加密连接，自动创建文件、启用外键并设置 5 秒忙等待；需运行库支持加密，密码错误会返回假并记录中文错误。', {
      category: '连接', example: 'SQLite_打开加密库("data/app.db", "我的密码")', returnDescription: '成功返回真；运行库不支持加密、密码错误或不是加密数据库返回假。'
    }),
    sqliteCommand('SQLite_打开加密连接', [
      { name: '数据库路径', type: 'wideString', description: '加密数据库文件路径。' },
      { name: '密码', type: 'wideString', description: '加密密钥，不能为空；算法由 SQLite_设置加密算法 决定，默认 SQLCipher。' },
      { name: '打开模式', type: 'int', description: '0=读写并创建，1=只读，2=读写但不创建，3=独立内存库。' },
      { name: '忙等待毫秒', type: 'int', description: '遇到锁竞争时等待的毫秒数，范围 0～600000。' }
    ], 'SQLite连接', '按 SQLite_设置加密算法 选定的算法（默认 SQLCipher）打开独立 FULLMUTEX 加密连接；打开后立即校验密码，需运行库提供 sqlite3_key 导出。', {
      category: '连接', example: 'SQLite_打开加密连接("data/app.db", "我的密码", 0, 5000)', returnDescription: '成功返回非 0 的 SQLite连接，失败返回 0。'
    }),
    sqliteCommand('SQLite_探测加密算法', [
      { name: '数据库路径', type: 'wideString', description: '已存在的加密数据库文件路径；只读探测，不会创建文件。' },
      { name: '密码', type: 'wideString', description: '要尝试的密码，不能为空。' }
    ], 'wideString', '依次按 sqlcipher、sqlcipher3、rc4、aes128、aes256、chacha20 档位只读尝试打开，返回第一个能用该密码读出 sqlite_master 的算法名；全部失败返回空文本并记录中文错误。', {
      category: '连接', example: 'SQLite_探测加密算法("data/旧系统.db", "我的密码")', returnDescription: '返回命中的算法名（可直接交给 SQLite_设置加密算法）；探测失败返回空文本。'
    }),
    sqliteCommand('SQLite_关闭', [], 'void', '兼容接口：关闭默认连接；没有其它连接时同时卸载运行库。', { category: '兼容接口' }),
    sqliteCommand('SQLite_关闭连接', [connection()], 'bool', '释放连接所属全部语句后关闭连接。失效句柄会返回假。', { category: '连接' }),
    sqliteCommand('SQLite_关闭全部', [], 'void', '释放所有语句、关闭所有连接并卸载运行库。', { category: '连接' }),
    sqliteCommand('SQLite_连接是否有效', [connection()], 'bool', '检查受管连接 ID 当前是否仍然有效。', { category: '连接' }),
    sqliteCommand('SQLite_连接是否只读', [connection()], 'bool', '检查连接的 main 数据库是否为只读。', { category: '连接' }),
    sqliteCommand('SQLite_连接是否在事务中', [connection()], 'bool', '返回连接是否处于显式事务或保存点中。', { category: '事务' }),
    sqliteCommand('SQLite_设置忙等待', [connection(), { name: '毫秒', type: 'int', description: '范围 0～600000；0 表示不等待。' }], 'bool', '设置连接遇到 SQLITE_BUSY 时的等待时间。', { category: '连接' }),
    sqliteCommand('SQLite_设置外键', [connection(), { name: '启用', type: 'bool', description: '真表示执行 PRAGMA foreign_keys=ON。' }], 'bool', '启用或禁用 SQLite 外键约束；事务内修改会失败。', { category: '连接' }),
    sqliteCommand('SQLite_设置同步模式', [connection(), { name: '模式', type: 'int', description: '0=OFF，1=NORMAL，2=FULL，3=EXTRA。生产默认推荐 1 或 2。' }], 'bool', '设置 PRAGMA synchronous。', { category: 'WAL与持久化' }),
    sqliteCommand('SQLite_启用WAL', [connection()], 'bool', '把文件数据库切换为 WAL 日志模式并确认 SQLite 返回 wal。', { category: 'WAL与持久化' }),
    sqliteCommand('SQLite_设置WAL自动检查点', [connection(), { name: '页数', type: 'int', description: '触发自动检查点的 WAL 页数；必须大于 0。' }], 'bool', '设置 WAL 自动检查点页数。', { category: 'WAL与持久化' }),
    sqliteCommand('SQLite_WAL检查点', [connection(), { name: '模式', type: 'int', description: '0=PASSIVE，1=FULL，2=RESTART，3=TRUNCATE。' }], 'int', '执行 WAL 检查点并返回状态：0 成功、1 忙、-1 失败。', { category: 'WAL与持久化' }),
    sqliteCommand('SQLite_取WAL日志帧数', [], 'int', '返回当前线程最近一次 WAL 检查点报告的日志帧数。', { category: 'WAL与持久化' }),
    sqliteCommand('SQLite_取WAL已检查点帧数', [], 'int', '返回当前线程最近一次 WAL 检查点报告的已检查点帧数。', { category: 'WAL与持久化' }),

    sqliteCommand('SQLite_执行', [{ name: 'SQL语句', type: 'wideString', description: '可包含多条 SQL；不得拼接不可信输入。' }], 'bool', '兼容接口：在默认连接执行无结果 SQL。', { category: '兼容接口' }),
    sqliteCommand('SQLite_执行于', [connection(), { name: 'SQL语句', type: 'wideString', description: '可包含多条无参数 SQL。处理外部输入时应使用预编译语句。' }], 'bool', '在指定连接执行一条或多条无结果 SQL。', { category: '执行' }),
    sqliteCommand('SQLite_查询首值', [{ name: 'SQL语句', type: 'wideString', description: '单条 SELECT 语句文本，返回首行首列；参数化查询请改用准备语句。'}], 'wideString', '兼容接口：返回默认连接首行首列的文本表示。NULL、无行或失败均返回空文本，应结合错误码判断。', { category: '兼容接口' }),
    sqliteCommand('SQLite_查询首值于', [connection(), { name: 'SQL语句', type: 'wideString', description: '单条 SELECT 语句文本，返回首行首列；语句含参数时不会被绑定。'}], 'wideString', '返回指定连接首行首列的文本表示；复杂查询应使用预编译语句。', { category: '执行' }),

    sqliteCommand('SQLite_准备', [connection(), { name: 'SQL语句', type: 'wideString', description: '只允许一条 SQL；尾部除空白和分号外存在其它语句时拒绝。' }], 'SQLite语句', '创建受管预编译语句，用于参数化执行和逐行读取。', {
      category: '预编译语句', example: 'SQLite_准备(数据库, "SELECT id, name FROM users WHERE score >= ?1")', returnDescription: '成功返回非 0 的 SQLite语句，失败返回 0。'
    }),
    sqliteCommand('SQLite_语句是否有效', [statement()], 'bool', '检查预编译语句 ID 当前是否仍然有效。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句步进', [statement()], 'int', '执行或读取下一行：1=得到一行，0=执行完成，-1=失败。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句重置', [statement()], 'bool', '把语句重置到首次步进前，保留现有参数绑定。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句清空绑定', [statement()], 'bool', '把语句的全部参数恢复为 NULL。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句释放', [statement()], 'bool', '立即释放预编译语句；连接关闭时也会兜底释放。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句是否只读', [statement()], 'bool', '判断语句是否不会直接修改数据库内容。', { category: '预编译语句' }),
    sqliteCommand('SQLite_语句取参数数量', [statement()], 'int', '返回 SQL 中参数的最大索引。', { category: '参数绑定' }),
    sqliteCommand('SQLite_语句取参数索引', [statement(), { name: '参数名', type: 'wideString', description: '包含前缀的参数名，例如 :name、@name 或 $name。' }], 'int', '返回命名参数的 1 起始索引，找不到返回 0。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定空值', [statement(), parameterIndex], 'bool', '把参数绑定为 SQL NULL。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定整数', [statement(), parameterIndex, { name: '数值', type: 'int', description: '绑定到占位符的 32 位整数值。'}], 'bool', '把参数绑定为 32 位整数。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定长整数', [statement(), parameterIndex, { name: '数值', type: 'longLong', description: '绑定到占位符的 64 位整数值。'}], 'bool', '把参数绑定为 64 位整数。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定小数', [statement(), parameterIndex, { name: '数值', type: 'double', description: '绑定到占位符的双精度小数值。'}], 'bool', '把参数绑定为双精度小数。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定文本', [statement(), parameterIndex, { name: '文本', type: 'wideString', description: '按 UTF-8 编码并由 SQLite 复制。' }], 'bool', '把参数安全绑定为文本。', { category: '参数绑定' }),
    sqliteCommand('SQLite_绑定字节集', [statement(), parameterIndex, { name: '数据', type: 'bytes', description: '由 SQLite 复制的二进制数据。' }], 'bool', '把参数安全绑定为 BLOB。', { category: '参数绑定' }),

    sqliteCommand('SQLite_取列数量', [statement()], 'int', '返回结果列数量。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列名称', [statement(), columnIndex], 'wideString', '返回结果列名。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列类型', [statement(), columnIndex], 'int', '返回当前行存储类型：1=整数，2=小数，3=文本，4=字节集，5=NULL；失败返回 0。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列是否为空', [statement(), columnIndex], 'bool', '判断当前行指定列是否为 SQL NULL。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列整数', [statement(), columnIndex], 'int', '按 SQLite 转换规则读取 32 位整数。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列长整数', [statement(), columnIndex], 'longLong', '按 SQLite 转换规则读取 64 位整数。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列小数', [statement(), columnIndex], 'double', '按 SQLite 转换规则读取双精度小数。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列文本', [statement(), columnIndex], 'wideString', '读取 UTF-8 文本；SQL NULL 返回空文本，应用应先检查列类型。', { category: '结果读取' }),
    sqliteCommand('SQLite_取列字节集', [statement(), columnIndex], 'bytes', '读取 BLOB 的独立副本；SQL NULL 返回空字节集。', { category: '结果读取' }),

    sqliteCommand('SQLite_开始事务', [connection(), { name: '模式', type: 'int', description: '0=DEFERRED，1=IMMEDIATE，2=EXCLUSIVE。' }], 'bool', '开始显式事务；批量写入推荐 IMMEDIATE。', { category: '事务' }),
    sqliteCommand('SQLite_提交事务', [connection()], 'bool', '提交当前事务。失败时事务可能仍保持活动，应读取错误并决定回滚。', { category: '事务' }),
    sqliteCommand('SQLite_回滚事务', [connection()], 'bool', '回滚当前事务。', { category: '事务' }),
    sqliteCommand('SQLite_创建保存点', [connection(), { name: '名称', type: 'wideString', description: '保存点名称会作为 SQLite 标识符安全引用。' }], 'bool', '创建可嵌套保存点。', { category: '事务' }),
    sqliteCommand('SQLite_释放保存点', [connection(), { name: '名称', type: 'wideString', description: '要释放的保存点名称，必须与 SQLite_创建保存点 使用的名称一致。'}], 'bool', '释放并提交指定保存点。', { category: '事务' }),
    sqliteCommand('SQLite_回滚到保存点', [connection(), { name: '名称', type: 'wideString', description: '要回滚到的保存点名称，必须与 SQLite_创建保存点 使用的名称一致。'}], 'bool', '回滚到指定保存点但不自动释放它。', { category: '事务' }),

    sqliteCommand('SQLite_备份到文件', [connection(), { name: '目标路径', type: 'wideString', description: '目标 SQLite 文件路径。' }, { name: '忙等待毫秒', type: 'int', description: '备份遇到 BUSY/LOCKED 时的总等待上限，范围 0～600000。' }], 'bool', '使用 SQLite Online Backup API 生成一致性备份，不直接复制活动数据库文件。', {
      category: '维护', example: 'SQLite_备份到文件(数据库, "backup/app.db", 10000)'
    }),
    sqliteCommand('SQLite_完整性检查', [connection(), { name: '快速检查', type: 'bool', description: '真执行 quick_check，假执行完整 integrity_check。' }], 'wideString', '执行数据库完整性检查并返回首条结果；正常结果为 ok。', { category: '维护' }),
    sqliteCommand('SQLite_中断', [connection()], 'bool', '请求中断该连接当前正在执行的长查询；SQLite 会在安全点返回 SQLITE_INTERRUPT。', { category: '维护' }),

    sqliteCommand('SQLite_取更改行数', [], 'int', '兼容接口：返回默认连接最近语句直接修改的行数。', { category: '兼容接口' }),
    sqliteCommand('SQLite_取连接更改行数', [connection()], 'longLong', '返回指定连接最近语句直接修改的 64 位行数。', { category: '状态' }),
    sqliteCommand('SQLite_取累计更改行数', [connection()], 'longLong', '返回连接自打开以来直接修改的累计 64 位行数；SQLite 不会因事务回滚减少该计数。', { category: '状态' }),
    sqliteCommand('SQLite_取最后插入行号', [connection()], 'longLong', '返回连接最近一次成功 INSERT 的 rowid；事务回滚不会自动恢复该值。', { category: '状态' }),
    sqliteCommand('SQLite_取错误', [], 'wideString', '返回当前线程最近一次 SQLite 模块错误，包含操作、主错误码和扩展错误码。', { category: '错误诊断' }),
    sqliteCommand('SQLite_取错误码', [], 'int', '返回当前线程最近一次 SQLite 主错误码。', { category: '错误诊断' }),
    sqliteCommand('SQLite_取扩展错误码', [], 'int', '返回当前线程最近一次 SQLite 扩展错误码。', { category: '错误诊断' }),
    sqliteCommand('SQLite_取系统错误码', [], 'int', '返回当前线程最近一次 SQLite 关联的操作系统错误码；运行库不支持时为 0。', { category: '错误诊断' }),
    sqliteCommand('SQLite_错误码到文本', [{ name: '错误码', type: 'int', description: 'SQLite 返回的整数错误码，通常来自 SQLite_取错误码。'}], 'wideString', '把 SQLite 错误码转换为运行库提供的英文稳定说明，便于日志和支持。', { category: '错误诊断' })
  ]
});

/** 随附 sqlite3.dll 按架构登记进 targets：路径不带 runtime/ 前缀，VS 工程各平台配置会平铺复制到 exe 同目录。 */
export const SQLITE_MODULE: LingBuilderModuleManifest = {
  ...sqliteStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', runtimeFiles: ['x86/sqlite3.dll'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', runtimeFiles: ['x64/sqlite3.dll'] }
  ]
};
