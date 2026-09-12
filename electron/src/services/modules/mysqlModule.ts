import { createModuleBindingSnippetArgument } from './bindingValueType';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type MySqlParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType };
type MySqlCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function snippetArgument(parameter: MySqlParameter, index: number): string {
  if (parameter.type === 'controlRef' || parameter.type === 'handler') {
    return createModuleBindingSnippetArgument(parameter, index);
  }
  if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
  if (parameter.type === 'bytes') return `$${index + 1}`;
  if (parameter.type === 'bool') return '假';
  return '0';
}

function mysqlCommand(
  name: string,
  parameters: MySqlParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: MySqlCommandOptions = {}
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

const connection = (description = '由 MySQL_连接 或 MySQL_连接扩展 返回的受管连接。'): MySqlParameter => ({
  name: '连接',
  type: 'MySQL连接',
  description
});

const statement = (description = '由 MySQL_准备 返回的受管预编译语句。'): MySqlParameter => ({
  name: '语句',
  type: 'MySQL语句',
  description
});

const parameterIndex: MySqlParameter = { name: '参数索引', type: 'int', description: '从 1 开始的参数索引。' };
const columnIndex: MySqlParameter = { name: '列索引', type: 'int', description: '从 0 开始的结果列索引。' };

export const MYSQL_MODULE_ID = 'lingbuilder.database.mysql';

/** 随附运行库（third_party/mariadb，MariaDB Connector/C 3.4.10 Schannel 构建）的 SHA-256 基线；详见 third_party/mariadb/NOTICE.md。 */
export const MYSQL_BUNDLED_RUNTIME_SHA256 = {
  x86: '981dbecc0a31b440e061ec719dd7812941861231ba210af5e7813a064a1d4d80',
  x64: '9208622a558ad6623671d05371424468bcaa5f9246122686d30ec1b6ddd2485c'
} as const;

const mysqlStandardModule = createStandardModule({
  id: MYSQL_MODULE_ID,
  name: 'MySQL 数据库模块',
  version: '1.0.0',
  category: '数据库',
  description: '原生协议直连 MySQL/MariaDB 服务器：密码连接、utf8mb4 中文、参数化预编译语句、强类型结果读取、事务和中文错误诊断。',
  tags: ['数据库', 'MySQL', 'MariaDB', '事务', '预编译语句', '参数化查询'],
  types: [
    { name: 'MySQL连接', description: '进程内不复用的受管 MySQL 连接 ID；不暴露 MYSQL 指针，仅供本模块命令使用。', cppType: 'long long' },
    { name: 'MySQL语句', description: '归属于单个连接的受管预编译语句 ID；不暴露 MYSQL_STMT 指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'MySQL 数据库模块 1.0 使用说明', path: 'docs/modules/mysql/README.md' }],
  snippets: [
    {
      label: 'MySQL 参数化查询',
      description: '密码连接、参数化插入、逐行读取和安全释放的完整骨架。',
      insertText: [
        '局部 MySQL连接 数据库 = MySQL_连接("127.0.0.1", 3306, "root", "$1", "test")',
        '如果 数据库 != 0',
        '    局部 MySQL语句 写入 = MySQL_准备(数据库, "INSERT INTO users(name, score) VALUES(?, ?)")',
        '    如果 写入 != 0',
        '        MySQL_绑定文本(写入, 1, "$2")',
        '        MySQL_绑定整数(写入, 2, 0)',
        '        如果 MySQL_语句执行(写入) >= 0',
        '            调试输出("写入完成")',
        '        否则',
        '            调试输出(MySQL_取错误())',
        '        结束',
        '        MySQL_语句释放(写入)',
        '    结束',
        '    局部 MySQL语句 查询 = MySQL_准备(数据库, "SELECT id, name FROM users WHERE score >= ?")',
        '    如果 查询 != 0',
        '        MySQL_绑定整数(查询, 1, 0)',
        '        判断循环首 MySQL_语句步进(查询) == 1',
        '            调试输出(MySQL_取列文本(查询, 1))',
        '        判断循环尾',
        '        MySQL_语句释放(查询)',
        '    结束',
        '    MySQL_关闭连接(数据库)',
        '否则',
        '    调试输出(MySQL_取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    mysqlCommand('MySQL_加载运行库', [
      { name: 'DLL路径', type: 'wideString', description: 'libmariadb.dll 的绝对或相对路径；空文本按系统 DLL 搜索规则加载。' }
    ], 'bool', '显式加载 MariaDB Connector/C 运行库并校验模块所需导出。存在活动连接或语句时拒绝切换 DLL。', {
      category: '运行库', example: 'MySQL_加载运行库("libmariadb.dll")', returnDescription: '全部必要导出可用时返回真，否则返回假并记录中文错误。'
    }),
    mysqlCommand('MySQL_卸载运行库', [], 'bool', '在没有活动连接和语句时卸载 libmariadb.dll。', { category: '运行库' }),
    mysqlCommand('MySQL_取运行库版本', [], 'wideString', '返回当前已加载 MySQL 客户端运行库的版本文本。', { category: '运行库' }),
    mysqlCommand('MySQL_取客户端版本', [], 'int', '返回客户端运行库的数字版本号，例如 30410 表示 3.4.10。', { category: '运行库' }),

    mysqlCommand('MySQL_连接', [
      { name: '主机', type: 'wideString', description: '服务器地址或域名。' },
      { name: '端口', type: 'int', description: '服务器端口，默认 3306。' },
      { name: '用户名', type: 'wideString' },
      { name: '密码', type: 'wideString', description: '账号密码；连接失败时不会写日志或诊断输出该密码。' },
      { name: '数据库', type: 'wideString', description: '连接后选用的数据库；空文本表示暂不选择。' }
    ], 'MySQL连接', '用原生协议连接 MySQL/MariaDB 服务器并校验密码；成功后自动把字符集协商为 utf8mb4。', {
      category: '连接', example: 'MySQL_连接("127.0.0.1", 3306, "root", "密码", "test")', returnDescription: '成功返回非 0 的 MySQL连接，失败返回 0，可通过 MySQL_取错误 查看原因。'
    }),
    mysqlCommand('MySQL_连接扩展', [
      { name: '主机', type: 'wideString' },
      { name: '端口', type: 'int', description: '服务器端口，默认 3306。' },
      { name: '用户名', type: 'wideString' },
      { name: '密码', type: 'wideString' },
      { name: '数据库', type: 'wideString', description: '连接后选用的数据库；空文本表示暂不选择。' },
      { name: '连接超时秒', type: 'int', description: 'TCP 连接与读写超时秒数，范围 1～86400。' },
      { name: '启用SSL', type: 'bool', description: '真表示使用 TLS 加密连接（Schannel）；服务器不支持时回退行为由服务器配置决定。' }
    ], 'MySQL连接', '带超时和 TLS 开关的扩展连接；其余行为与 MySQL_连接 一致。', {
      category: '连接', example: 'MySQL_连接扩展("127.0.0.1", 3306, "root", "密码", "test", 10, 假)', returnDescription: '成功返回非 0 的 MySQL连接，失败返回 0。'
    }),
    mysqlCommand('MySQL_关闭连接', [connection()], 'bool', '释放连接所属全部语句后关闭连接。失效句柄返回假。', { category: '连接' }),
    mysqlCommand('MySQL_关闭全部', [], 'void', '释放所有语句、关闭所有连接并卸载运行库。', { category: '连接' }),
    mysqlCommand('MySQL_连接是否有效', [connection()], 'bool', '检查受管连接 ID 当前是否仍然有效。', { category: '连接' }),
    mysqlCommand('MySQL_切换数据库', [connection(), { name: '数据库名', type: 'wideString' }], 'bool', '切换当前连接使用的数据库。', { category: '连接' }),
    mysqlCommand('MySQL_设置字符集', [connection(), { name: '字符集', type: 'wideString', description: '例如 utf8mb4、gbk、latin1。' }], 'bool', '修改连接字符集；默认已在连接时设置为 utf8mb4。', { category: '连接' }),
    mysqlCommand('MySQL_取服务器信息', [connection()], 'wideString', '返回服务器版本描述文本，失败返回空文本。', { category: '连接' }),

    mysqlCommand('MySQL_执行', [connection(), { name: 'SQL语句', type: 'wideString', description: '单条无参数 SQL；处理外部输入时应使用预编译语句。' }], 'longLong', '直接执行一条 SQL 并返回受影响行数，失败返回 -1。', {
      category: '执行', example: 'MySQL_执行(数据库, "DELETE FROM users WHERE score < 0")', returnDescription: '返回受影响行数；失败返回 -1。'
    }),
    mysqlCommand('MySQL_查询首值', [connection(), { name: 'SQL语句', type: 'wideString' }], 'wideString', '执行查询并返回首行首列的文本表示；NULL、无行或失败返回空文本，应结合错误码判断。', { category: '执行' }),
    mysqlCommand('MySQL_取最后插入ID', [connection()], 'longLong', '返回连接最近一次成功 INSERT 生成的自增主键值。', { category: '执行' }),

    mysqlCommand('MySQL_准备', [connection(), { name: 'SQL语句', type: 'wideString', description: '只允许一条 SQL，用 ? 作为参数占位符。' }], 'MySQL语句', '在服务器端创建参数化预编译语句，用于安全执行和逐行读取。', {
      category: '预编译语句', example: 'MySQL_准备(数据库, "SELECT id, name FROM users WHERE score >= ?")', returnDescription: '成功返回非 0 的 MySQL语句，失败返回 0。'
    }),
    mysqlCommand('MySQL_语句是否有效', [statement()], 'bool', '检查预编译语句 ID 当前是否仍然有效。', { category: '预编译语句' }),
    mysqlCommand('MySQL_语句执行', [statement()], 'longLong', '执行 INSERT/UPDATE/DELETE 等非查询语句并返回受影响行数，失败返回 -1。', { category: '预编译语句' }),
    mysqlCommand('MySQL_语句步进', [statement()], 'int', '读取下一行：1=得到一行，0=没有更多行，-1=失败；首次调用会自动执行查询语句。', {
      category: '预编译语句', example: '当 MySQL_语句步进(查询) == 1', returnDescription: '1 表示当前行可读，0 表示完成，-1 表示失败。'
    }),
    mysqlCommand('MySQL_语句重置', [statement()], 'bool', '把语句复位到可重新绑定和执行的状态，不清空已绑定的参数。', { category: '预编译语句' }),
    mysqlCommand('MySQL_语句清空绑定', [statement()], 'bool', '把语句的全部参数恢复为 NULL。', { category: '预编译语句' }),
    mysqlCommand('MySQL_语句释放', [statement()], 'bool', '立即释放预编译语句；连接关闭时也会兜底释放。', { category: '预编译语句' }),
    mysqlCommand('MySQL_绑定空值', [statement(), parameterIndex], 'bool', '把参数绑定为 SQL NULL。', { category: '参数绑定' }),
    mysqlCommand('MySQL_绑定整数', [statement(), parameterIndex, { name: '数值', type: 'int' }], 'bool', '把参数绑定为 32 位整数。', { category: '参数绑定' }),
    mysqlCommand('MySQL_绑定长整数', [statement(), parameterIndex, { name: '数值', type: 'longLong' }], 'bool', '把参数绑定为 64 位整数。', { category: '参数绑定' }),
    mysqlCommand('MySQL_绑定小数', [statement(), parameterIndex, { name: '数值', type: 'double' }], 'bool', '把参数绑定为双精度小数。', { category: '参数绑定' }),
    mysqlCommand('MySQL_绑定文本', [statement(), parameterIndex, { name: '文本', type: 'wideString', description: '按 UTF-8 编码传给服务器。' }], 'bool', '把参数安全绑定为文本，防止 SQL 注入。', { category: '参数绑定' }),
    mysqlCommand('MySQL_绑定字节集', [statement(), parameterIndex, { name: '数据', type: 'bytes' }], 'bool', '把参数安全绑定为二进制数据。', { category: '参数绑定' }),

    mysqlCommand('MySQL_取列数量', [statement()], 'int', '返回结果集列数量；非查询语句返回 0。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列名称', [statement(), columnIndex], 'wideString', '返回结果列名。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列是否为空', [statement(), columnIndex], 'bool', '判断当前行指定列是否为 SQL NULL。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列整数', [statement(), columnIndex], 'int', '按服务器转换规则读取 32 位整数。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列长整数', [statement(), columnIndex], 'longLong', '按服务器转换规则读取 64 位整数。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列小数', [statement(), columnIndex], 'double', '按服务器转换规则读取双精度小数。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列文本', [statement(), columnIndex], 'wideString', '读取 UTF-8 文本并转换为中文文本；SQL NULL 返回空文本，应先检查列是否为空。', { category: '结果读取' }),
    mysqlCommand('MySQL_取列字节集', [statement(), columnIndex], 'bytes', '读取二进制列的独立副本；SQL NULL 返回空字节集。', { category: '结果读取' }),

    mysqlCommand('MySQL_开始事务', [connection()], 'bool', '在连接上开始显式事务（START TRANSACTION）。', { category: '事务' }),
    mysqlCommand('MySQL_提交', [connection()], 'bool', '提交当前事务。', { category: '事务' }),
    mysqlCommand('MySQL_回滚', [connection()], 'bool', '回滚当前事务。', { category: '事务' }),
    mysqlCommand('MySQL_设置自动提交', [connection(), { name: '启用', type: 'bool' }], 'bool', '启用或禁用连接的自动提交模式。', { category: '事务' }),

    mysqlCommand('MySQL_取错误', [], 'wideString', '返回本线程最近一次 MySQL 模块错误的中文描述与原始服务器错误，连接失败时也可读取。', { category: '错误诊断' }),
    mysqlCommand('MySQL_取错误码', [], 'int', '返回本线程最近一次 MySQL 错误码；0 表示没有错误。', { category: '错误诊断' }),
    mysqlCommand('MySQL_取连接错误', [connection()], 'wideString', '读取指定连接上最近一次服务器错误的原始文本。', { category: '错误诊断' })
  ]
});

/** 随附 libmariadb.dll 按架构登记进 targets：路径不带 runtime/ 前缀，VS 工程各平台配置会平铺复制到 exe 同目录。 */
export const MYSQL_MODULE: LingBuilderModuleManifest = {
  ...mysqlStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', runtimeFiles: ['x86/libmariadb.dll'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', runtimeFiles: ['x64/libmariadb.dll'] }
  ]
};
