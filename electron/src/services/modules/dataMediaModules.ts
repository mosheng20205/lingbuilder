import { LingBuilderModuleManifest, ModuleCommandValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';
import { SQLITE_MODULE } from './sqliteModule';
import { MYSQL_MODULE } from './mysqlModule';
import { EXCEL_MODULE } from './excelModule';

export const CRYPTO_SDK_MODULE_IDS = [
  'lingbuilder.crypto.hash',
  'lingbuilder.crypto.password',
  'lingbuilder.crypto.symmetric',
  'lingbuilder.crypto.asymmetric'
] as const;

type Parameter = { name: string; type: ModuleCommandValueType; description: string; optional?: boolean; defaultValue?: string | number | boolean };
type CommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

// 以下说明按 dataMediaRuntime.ts 与 cryptoRuntime.ts 的实际实现核实，重复语义提取为共享常量。
const csvFieldArg = '要写入 CSV 单元格的原始文本；含逗号、双引号、回车或换行时会自动加外层引号，内部引号翻倍。';
const csvLineArg = '待解析的一行 CSV 文本；按引号识别字段，不跨行解析多行记录，含换行的字段请改用 CSV_打开文件 或 CSV_解析文本。';
const csvEncodingArg = '文件编码名称，忽略大小写与空格、连字符、下划线；支持 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE、ANSI、GBK、GB2312、GB18030，传 AUTO 按「BOM → 严格 UTF-8 → GB18030」自动识别。省略等价于 AUTO。';
const csvDelimiterArg = '字段分隔符，取首字符生效；支持半角逗号、分号、竖线、制表符（写 "\\t" 或真实制表符）和全角逗号。省略按半角逗号。';
const csvHeaderArg = '传真表示第一条记录是表头行，列名取自表头，缺名列按 列N 补齐；传假时全部记录都算数据，列名统一为 列N。';
const imagePathArg = '图片文件的完整路径；GDI+ 打不开或文件损坏时按说明返回 0、空文本或假。';
const targetImageArg = '输出图片路径；保存格式按扩展名识别 png、jpg、jpeg、bmp、gif、tif、tiff，无法识别时按 PNG 保存。';
const iconFileArg = '含图标的 EXE、DLL 或 ICO 文件路径。';
const iconIndexArg = '图标序号，从 0 起，必须小于 图标_取数量 返回的数量。';
const argbValueArg = '一个 ARGB 颜色值，高位到低位依次为 Alpha、红、绿、蓝，通常来自 位图_取像素ARGB。';
const pixelXArg = '像素列坐标，从 0 起；超出图片宽度时按说明返回 -1 或假。';
const pixelYArg = '像素行坐标，从 0 起；超出图片高度时按说明返回 -1 或假。';
const odbcConnectArg = 'ODBC 连接字符串，例如 Driver={...};Server=...;Database=...;Uid=...;Pwd=...;；连接不弹驱动配置对话框，缺失字段直接失败。';
const odbcSqlArg = '要执行的 SQL 文本，一次一条语句；没有参数绑定入口，取值需自行拼接并确保来源可信。';
const wavPathArg = 'WAV 文件路径；文件不存在或格式不被 PlaySound 支持时返回假。';
const plainPasswordArg = '待验证的密码，按 UTF-8 编码参与运算；空文本同样会执行一次完整哈希比对。';
const savedHashArg = '对应哈希算法生成的自描述 PHC 文本，内含算法、参数和随机盐；格式不符时返回假并记录中文错误。';
const selfCipherArg = '对应算法的 加密命令 返回的自描述密文文本，内含算法名、随机数和标签；被改动或密钥不符时返回空文本并记录错误。';const captureTargetArg = '保存截图的目标 PNG 路径；所在目录必须已存在。';
const privatePemArg = 'PKCS#8 格式的 PEM 私钥文本；必须与算法和位数匹配，解析失败返回空文本并记录中文错误。'
const publicPemArg = 'X.509 格式的 PEM 公钥文本；算法必须与密钥类型一致，解析失败返回空文本并记录中文错误。';
const base64CipherArg = '对应 加密命令 返回的 Base64 密文文本；被改动或密钥不匹配时解密失败返回空文本。';
const base64SignatureArg = '对应 签名命令 返回的 Base64 签名文本；被改动时验签返回假。';
// 裸 AEAD 变体：全部走字节集，随机数由调用方提供，密文不含任何自描述头，用于兼容 Chromium 等外部格式。
const rawKeyArg = (bytes: string) => `必须恰好 ${bytes} 字节的原始密钥字节集；不要用 对称_生成密钥 的十六进制文本，需要时先 字节集_十六进制解码。`;
const rawNonceArg = '必须恰好 12 字节的随机数字节集，由调用方提供，命令不会自动生成或写入头部；长度不符直接返回空字节集。';
const rawAadArg = '参与认证但不加密的附加数据字节集；不需要附加数据时传空字节集。';
const rawCipherArg = () => `密文与认证标签连成一体的字节集，形如 密文 || 标签(16 字节)，即同名 加密裸 命令的原始返回值；Chromium 的 encrypted_value 需先去掉 3 字节 "v10" 头和 12 字节随机数再传入。长度不足 16 字节时返回空字节集。`;
const rawEncryptTail = (displayName: string) => `使用 ${displayName} 加密原始字节集，返回 密文 || 标签(16 字节) 的裸格式；不含算法名、不自动加随机数，也不做 UTF-8 或 Base64 转换。需要自描述封装时改用同名的非 裸 命令。`;
const rawDecryptTail = (displayName: string, keyBytes: string) => `使用 ${displayName} 解密 ${keyBytes} 字节密钥保护的裸 密文 || 标签(16 字节)，返回原始明文字节集；标签校验失败、长度不符或密钥字节数不对都返回空字节集，用 对称_取错误 查看原因。`;
const rawEncryptExample = (suffix: string) => `局部 字节集 密文与标签\n密文与标签 = 对称_${suffix}GCM加密裸(密钥, 随机数, 明文字节集, 空附加数据)`;
function command(name: string, parameters: Parameter[], returnType: ModuleCommandValueType, description: string, options: CommandOptions | string = {}): StandardCommandSpec {
  const args = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler' || parameter.type === 'bytes'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  const normalizedOptions = typeof options === 'string' ? { example: options } : options;
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${args.join(', ')})`, parameters, returnType, ...normalizedOptions };
}

const csvTable = (description = '由 CSV_打开文件 或 CSV_解析文本 返回的受管表格数据快照。'): Parameter => ({
  name: '表格',
  type: '表格数据',
  description
});
const csvRow: Parameter = { name: '行号', type: 'int', description: '数据行号，从 1 起；不含表头行，越界返回空值并用 数据表_取错误 查看原因。' };
const csvColumn: Parameter = { name: '列号', type: 'int', description: '列号，从 1 起；越界返回空值并用 数据表_取错误 查看原因。' };

const csv = createStandardModule({
  id: 'lingbuilder.data.csv',
  name: 'CSV数据模块',
  version: '1.1.0',
  category: '其他',
  description: 'RFC 4180 风格 CSV：字段转义与行生成、按文件整体读取、记录级解析（支持引号内换行、双写引号、CRLF/CR/LF、自定义分隔符、空行跳过）与 UTF-8/GBK/GB18030/UTF-16/UTF-32 编码自动识别；解析结果用 表格数据 快照按行列读取。',
  tags: ['数据', 'CSV', '表格', '导入', '编码'],
  types: [
    { name: '表格数据', description: '进程内不复用的受管表格快照 ID；不暴露内部字符串数组指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'CSV 数据模块 1.1 使用说明', path: 'docs/modules/csv/README.md' }],
  snippets: [
    {
      label: 'CSV 读取表格快照',
      description: '按文件读取 CSV（中文文件用 GBK 或 AUTO），逐行逐列读取并释放的骨架。',
      insertText: [
        '局部 表格数据 表 = CSV_打开文件("$1", "AUTO")',
        '如果 (表 != 0)',
        '    局部 整数型 行数 = 数据表_行数(表)',
        '    局部 整数型 列数 = 数据表_列数(表)',
        '    局部 整数型 类型 = 数据表_单元格类型(表, 1, 1)',
        '    调试输出(数据表_列名(表, 1))',
        '    调试输出(数据表_取文本(表, 1, 1))',
        '    数据表_关闭(表)',
        '否则',
        '    调试输出(数据表_取错误())',
        '如果结束'
      ].join('\n')
    }
  ],
  commands: [
    command('CSV_转义字段', [{ name: '字段', type: 'wideString', description: csvFieldArg}], 'wideString', '按需添加双引号并转义字段。'),
    command('CSV_生成两列', [{ name: '第一列', type: 'wideString', description: csvFieldArg}, { name: '第二列', type: 'wideString', description: csvFieldArg}], 'wideString', '生成包含两个字段的一行 CSV。'),
    command('CSV_生成三列', [{ name: '第一列', type: 'wideString', description: csvFieldArg}, { name: '第二列', type: 'wideString', description: csvFieldArg}, { name: '第三列', type: 'wideString', description: csvFieldArg}], 'wideString', '生成包含三个字段的一行 CSV。'),
    command('CSV_字段数量', [{ name: '行文本', type: 'wideString', description: csvLineArg}], 'int', '解析一行 CSV 并返回字段数。'),
    command('CSV_取字段', [{ name: '行文本', type: 'wideString', description: csvLineArg}, { name: '索引', type: 'int', description: '字段序号，从 0 起；越界返回空文本。'}], 'wideString', '按从 0 开始索引读取字段。'),
    // ---------- 文件级与记录级读取 ----------
    command('CSV_打开文件', [
      { name: '文件路径', type: 'wideString', description: '要读取的 CSV 文件完整路径；打不开时返回 0，原因见 数据表_取错误。' },
      { name: '编码名称', type: 'wideString', optional: true, defaultValue: 'AUTO', description: csvEncodingArg },
      { name: '分隔符', type: 'wideString', optional: true, defaultValue: ',', description: csvDelimiterArg },
      { name: '含表头', type: 'bool', optional: true, defaultValue: true, description: csvHeaderArg }
    ], '表格数据', '按整个文件读取 CSV 并返回 表格数据 快照；引号内的换行属于字段内容，不会被当成换行。', '局部 表格数据 表\n表 = CSV_打开文件("员工.csv")\n如果 (表 != 0)\n    调试输出(数据表_取文本(表, 1, 1))\n    数据表_关闭(表)\n如果结束'),
    command('CSV_解析文本', [
      { name: 'CSV文本', type: 'wideString', description: '已经含全部记录的 CSV 文本，可以跨多行；通常来自 文件_读取文本。' },
      { name: '分隔符', type: 'wideString', optional: true, defaultValue: ',', description: csvDelimiterArg },
      { name: '含表头', type: 'bool', optional: true, defaultValue: true, description: csvHeaderArg }
    ], '表格数据', '把多行 CSV 文本解析成 表格数据 快照；用于内容已在内存里的场景。'),
    command('数据表_取错误', [], 'wideString', '返回当前线程最近一次表格操作失败的中文说明；每次进入 数据表_ 或 CSV_ 命令时清空。', { category: '诊断' }),
    command('数据表_行数', [csvTable()], 'int', '返回数据行数量，不含表头行；句柄无效返回 0。'),
    command('数据表_列数', [csvTable()], 'int', '返回列数量，取所有记录的最大宽度；句柄无效返回 0。'),
    command('数据表_列名', [csvTable(), { name: '列号', type: 'int', description: '列号，从 1 起；越界返回空文本。' }], 'wideString', '返回指定列的名称；无表头或表头缺名时为 列N。'),
    command('数据表_取文本', [csvTable(), csvRow, csvColumn], 'wideString', '按行列读取单元格文本；越界返回空文本。'),
    command('数据表_单元格类型', [csvTable(), csvRow, csvColumn], 'int', '返回单元格内容形态：0=空，1=整数，2=小数，3=布尔，4=文本；用于决定建表列类型与绑定哪个取值命令。'),
    command('数据表_取整数', [csvTable(), csvRow, csvColumn], 'longLong', '把单元格按 64 位整数读取；内容不是整数时返回 0 并记录中文错误。'),
    command('数据表_取小数', [csvTable(), csvRow, csvColumn], 'double', '把单元格按双精度小数读取；内容不是小数时返回 0 并记录中文错误。'),
    command('数据表_取布尔', [csvTable(), csvRow, csvColumn], 'bool', '把单元格读取为逻辑值：TRUE/真/1/YES/是 为真，FALSE/假/0/NO/否 为假，其它内容按假。'),
    command('数据表_单元格为空', [csvTable(), csvRow, csvColumn], 'bool', '判断单元格是否为空文本或越界；越界同样返回真。'),
    command('数据表_关闭', [csvTable('由 CSV_打开文件 或 CSV_解析文本 返回的受管表格数据快照；关闭后句柄立即失效。')], 'bool', '释放表格快照；句柄不存在或重复关闭返回假。')
  ]
});

const hashAlgorithms = [
  ['MD5', 'MD5', '128 位；仅用于兼容和文件校验，不得用于密码或数字签名。'],
  ['SHA1', 'SHA-1', '160 位；仅用于兼容，不得用于新的安全协议或数字签名。'],
  ['SHA256', 'SHA-256', '256 位 SHA-2 摘要。'],
  ['SHA3_256', 'SHA-3(256)', '256 位 SHA-3 摘要。'],
  ['SM3', 'SM3', '256 位国产商用密码摘要。'],
  ['BLAKE2b', 'BLAKE2b-512', '512 位 BLAKE2b 摘要。'],
  ['BLAKE3', 'BLAKE3-256', '256 位 BLAKE3 摘要。']
] as const;

const hash = createStandardModule({
  id: 'lingbuilder.crypto.hash', name: '哈希摘要模块', category: '系统', description: '计算文本和文件的 MD5、SHA-1、SHA-256、SHA-3、SM3、BLAKE2 与 BLAKE3 摘要。', tags: ['安全', '哈希', 'SHA3', 'SM3', 'BLAKE3'],
  commands: [
    ...hashAlgorithms.flatMap(([commandSuffix, displayName, warning]) => [
      command(`哈希_${commandSuffix}文本`, [{ name: '文本', type: 'wideString', description: '按 UTF-8 编码参与摘要计算的文本。' }], 'wideString', `计算 UTF-8 文本的 ${displayName} 大写十六进制摘要。${warning}`, commandSuffix === 'SHA256' ? '哈希_SHA256文本("LingBuilder")' : {}),
      command(`哈希_${commandSuffix}文件`, [{ name: '路径', type: 'wideString', description: '要流式读取的文件路径。' }], 'wideString', `流式计算文件的 ${displayName} 大写十六进制摘要。${warning}`)
    ]),
    command('哈希_安全随机十六进制', [{ name: '字节数', type: 'int', description: '要生成的随机字节数；小于 0 按 0、大于 1048576 按 1048576 处理，输出大写十六进制文本。'}], 'wideString', '使用系统加密随机源生成十六进制文本。')
  ]
});

const password = createStandardModule({
  id: 'lingbuilder.crypto.password', name: '密码哈希与派生模块', category: '系统', description: '提供自描述格式的 Argon2id、scrypt、bcrypt 与 PBKDF2-SHA256 密码哈希及恒定时间验证。', tags: ['安全', '密码', 'Argon2id', 'scrypt', 'bcrypt', 'PBKDF2'],
  commands: [
    command('密码_Argon2id哈希', [
      { name: '密码', type: 'wideString', description: '待保护的密码，按 UTF-8 编码。' },
      { name: '内存KB', type: 'int', description: '内存成本，范围 8192～1048576 KB，推荐至少 65536。' },
      { name: '迭代次数', type: 'int', description: '时间成本，范围 1～20，推荐 3。' },
      { name: '并行度', type: 'int', description: '并行度，范围 1～16。' }
    ], 'wideString', '生成标准 PHC 格式的 Argon2id 密码哈希。', { example: '密码_Argon2id哈希("密码", 65536, 3, 1)', returnDescription: '成功返回 $argon2id$ 自描述哈希，失败返回空文本并可读取“密码_取错误”。' }),
    command('密码_Argon2id验证', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '已保存哈希', type: 'wideString', description: savedHashArg}], 'bool', '恒定时间验证 Argon2id PHC 哈希。'),
    command('密码_scrypt哈希', [
      { name: '密码', type: 'wideString', description: plainPasswordArg }, { name: 'N', type: 'int', description: 'CPU/内存成本，必须为 2 的幂，推荐 32768。' },
      { name: 'r', type: 'int', description: '块大小参数，推荐 8。' }, { name: 'p', type: 'int', description: '并行参数，推荐 1。' }
    ], 'wideString', '生成包含全部参数和随机盐的 scrypt PHC 哈希。', { example: '密码_scrypt哈希("密码", 32768, 8, 1)' }),
    command('密码_scrypt验证', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '已保存哈希', type: 'wideString', description: savedHashArg}], 'bool', '恒定时间验证 scrypt PHC 哈希。'),
    command('密码_bcrypt哈希', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '成本', type: 'int', description: '成本因子，范围 4～18，推荐 12。' }], 'wideString', '生成标准 bcrypt 密码哈希。', { example: '密码_bcrypt哈希("密码", 12)' }),
    command('密码_bcrypt验证', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '已保存哈希', type: 'wideString', description: savedHashArg}], 'bool', '验证 bcrypt 密码哈希。'),
    command('密码_PBKDF2_SHA256哈希', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '迭代次数', type: 'int', description: '迭代次数，范围 10000～10000000，推荐至少 600000。' }], 'wideString', '生成带随机盐的 PBKDF2-HMAC-SHA256 自描述哈希。', { example: '密码_PBKDF2_SHA256哈希("密码", 600000)' }),
    command('密码_PBKDF2_SHA256验证', [{ name: '密码', type: 'wideString', description: plainPasswordArg}, { name: '已保存哈希', type: 'wideString', description: savedHashArg}], 'bool', '恒定时间验证 PBKDF2-HMAC-SHA256 哈希。'),
    command('密码_取错误', [], 'wideString', '读取最近一次密码哈希或验证失败的中文错误。')
  ]
});

type SymmetricSpec = readonly [suffix: string, displayName: string, authenticated: boolean, keyBytes: number, legacy?: boolean];
const symmetricAlgorithms: readonly SymmetricSpec[] = [
  ['AES256GCM', 'AES-256/GCM', true, 32],
  ['ChaCha20Poly1305', 'ChaCha20-Poly1305', true, 32],
  ['SM4GCM', 'SM4/GCM', true, 16],
  ['Camellia256GCM', 'Camellia-256/GCM', true, 32],
  ['TwofishGCM', 'Twofish/GCM', true, 32],
  ['SerpentGCM', 'Serpent/GCM', true, 32],
  ['AES256CBC', 'AES-256/CBC', false, 32, true],
  ['BlowfishCBC', 'Blowfish/CBC', false, 32, true],
  ['DESCBC', 'DES/CBC', false, 8, true],
  ['三DES_CBC', '3DES/CBC', false, 24, true],
  ['RC4', 'RC4', false, 16, true]
];

const symmetric = createStandardModule({
  id: 'lingbuilder.crypto.symmetric', name: '对称加密模块', category: '系统', description: '提供认证加密、传统分组加密和兼容流加密；普通命令密钥使用严格十六进制文本、密文使用带算法和随机数的自描述封装，带 裸 后缀的 AES-GCM 命令密钥/随机数/密文全部使用字节集且不含自描述头，用于兼容 Chromium 等外部密文格式。', tags: ['安全', 'AES-GCM', 'ChaCha20', 'SM4', '对称加密'],
  commands: [
    command('对称_生成密钥', [{ name: '字节数', type: 'int', description: '密钥字节数，范围 1～1024。' }], 'wideString', '使用系统密码学随机源生成大写十六进制密钥。', { example: '对称_生成密钥(32)' }),
    ...symmetricAlgorithms.flatMap(([suffix, displayName, authenticated, keyBytes, legacy]) => {
      const extra = authenticated ? [{ name: '附加数据', type: 'wideString' as const, description: '参与认证但不加密的 UTF-8 文本，可传空文本。' }] : [];
      const warning = legacy ? '该算法不提供完整性认证，仅用于兼容旧数据；新项目优先使用 AES-256/GCM 或 ChaCha20-Poly1305。' : '加密时自动生成随机 nonce，并验证认证标签。';
      return [
        command(`对称_${suffix}加密`, [{ name: '明文', type: 'wideString', description: '按 UTF-8 编码的明文。' }, { name: '密钥十六进制', type: 'wideString', description: `必须恰好为 ${keyBytes} 字节的十六进制密钥。` }, ...extra], 'wideString', `使用 ${displayName} 加密并返回自描述密文。${warning}`, { visibility: legacy ? 'advanced' : 'default' }),
        command(`对称_${suffix}解密`, [{ name: '自描述密文', type: 'wideString', description: selfCipherArg }, { name: '密钥十六进制', type: 'wideString', description: `必须恰好为 ${keyBytes} 字节的十六进制密钥。` }, ...extra], 'wideString', `解密 ${displayName} 自描述密文。认证或格式失败时返回空文本并记录错误。${warning}`, { visibility: legacy ? 'advanced' : 'default' })
      ];
    }),
    command('对称_AES256GCM加密裸', [{ name: '密钥', type: 'bytes', description: rawKeyArg('32') }, { name: '随机数', type: 'bytes', description: rawNonceArg }, { name: '明文', type: 'bytes', description: '要加密的原始字节集，原样参与运算，不做 UTF-8 转换；空字节集只输出 16 字节标签。' }, { name: '附加数据', type: 'bytes', description: rawAadArg }], 'bytes', rawEncryptTail('AES-256-GCM'), { example: rawEncryptExample('AES256') }),
    command('对称_AES256GCM解密裸', [{ name: '密钥', type: 'bytes', description: rawKeyArg('32') }, { name: '随机数', type: 'bytes', description: rawNonceArg }, { name: '密文与标签', type: 'bytes', description: rawCipherArg() }, { name: '附加数据', type: 'bytes', description: rawAadArg }], 'bytes', rawDecryptTail('AES-256-GCM', '32'), { example: '局部 字节集 明文\n明文 = 对称_AES256GCM解密裸(密钥, 随机数, 密文与标签, 空附加数据)' }),
    command('对称_AES128GCM加密裸', [{ name: '密钥', type: 'bytes', description: rawKeyArg('16') }, { name: '随机数', type: 'bytes', description: rawNonceArg }, { name: '明文', type: 'bytes', description: '要加密的原始字节集，原样参与运算，不做 UTF-8 转换；空字节集只输出 16 字节标签。' }, { name: '附加数据', type: 'bytes', description: rawAadArg }], 'bytes', rawEncryptTail('AES-128-GCM'), { example: rawEncryptExample('AES128') }),
    command('对称_AES128GCM解密裸', [{ name: '密钥', type: 'bytes', description: rawKeyArg('16') }, { name: '随机数', type: 'bytes', description: rawNonceArg }, { name: '密文与标签', type: 'bytes', description: rawCipherArg() }, { name: '附加数据', type: 'bytes', description: rawAadArg }], 'bytes', rawDecryptTail('AES-128-GCM', '16'), { example: '局部 字节集 明文\n明文 = 对称_AES128GCM解密裸(密钥, 随机数, 密文与标签, 空附加数据)' }),
    command('对称_RC2CBC加密', [{ name: '明文', type: 'wideString', description: '按 UTF-8 编码的明文。' }, { name: '密钥十六进制', type: 'wideString', description: '必须恰好为 16 字节的十六进制密钥。' }], 'wideString', '使用 Windows CryptoAPI RC2-128/CBC 加密并返回自描述密文。该算法仅用于兼容旧数据，新项目不要使用。', { visibility: 'advanced' }),
    command('对称_RC2CBC解密', [{ name: '自描述密文', type: 'wideString', description: selfCipherArg }, { name: '密钥十六进制', type: 'wideString', description: '必须恰好为 16 字节的十六进制密钥。' }], 'wideString', '解密 RC2-128/CBC 自描述密文。该算法仅用于兼容旧数据，新项目不要使用。', { visibility: 'advanced' }),
    command('对称_取错误', [], 'wideString', '读取最近一次对称加密或解密失败的中文错误。')
  ]
});

const asymmetric = createStandardModule({
  id: 'lingbuilder.crypto.asymmetric', name: '非对称密码模块', category: '系统', description: '提供 RSA、ECDSA P-256、ECDH P-256、X25519、SM2 和 ElGamal 的密钥、加密、签名或协商能力。私钥使用 PKCS#8 PEM，公钥使用 X.509 PEM。', tags: ['安全', 'RSA', 'ECC', 'SM2', 'X25519', '非对称加密'],
  commands: [
    command('非对称_RSA生成私钥', [{ name: '位数', type: 'int', description: '允许 2048、3072 或 4096。' }], 'wideString', '生成 RSA PKCS#8 PEM 私钥。', { example: '非对称_RSA生成私钥(3072)' }),
    command('非对称_RSA取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '从 RSA 私钥导出 X.509 PEM 公钥。'),
    command('非对称_RSA_OAEP_SHA256加密', [{ name: '明文', type: 'wideString', description: '要加密的短文本，按 UTF-8 处理；长度超过密钥的 OAEP 容量时返回空文本并记录错误。'}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}], 'wideString', '使用 RSA-OAEP(SHA-256) 加密短文本并返回 Base64。'),
    command('非对称_RSA_OAEP_SHA256解密', [{ name: 'Base64密文', type: 'wideString', description: base64CipherArg}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '使用 RSA-OAEP(SHA-256) 解密短文本。'),
    command('非对称_RSA_PSS_SHA256签名', [{ name: '文本', type: 'wideString', description: '要签名的原文文本，按 UTF-8 参与摘要。'}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '使用 RSA-PSS(SHA-256) 签名并返回 Base64。'),
    command('非对称_RSA_PSS_SHA256验签', [{ name: '文本', type: 'wideString', description: '签名时的原文文本，必须与验签内容逐字节一致。'}, { name: 'Base64签名', type: 'wideString', description: base64SignatureArg}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}], 'bool', '验证 RSA-PSS(SHA-256) 签名。'),
    command('非对称_ECDSA_P256生成私钥', [], 'wideString', '生成 ECDSA secp256r1 PKCS#8 PEM 私钥。'),
    command('非对称_ECDSA_P256取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '从 ECDSA P-256 私钥导出公钥。'),
    command('非对称_ECDSA_P256签名', [{ name: '文本', type: 'wideString', description: '要签名的原文文本，按 UTF-8 参与 SHA-256 摘要。'}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '使用 ECDSA P-256 与 SHA-256 签名。'),
    command('非对称_ECDSA_P256验签', [{ name: '文本', type: 'wideString', description: '签名时的原文文本。'}, { name: 'Base64签名', type: 'wideString', description: base64SignatureArg}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}], 'bool', '验证 ECDSA P-256/SHA-256 签名。'),
    command('非对称_SM2生成私钥', [], 'wideString', '生成 SM2 P-256 PKCS#8 PEM 私钥。'),
    command('非对称_SM2取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '从 SM2 私钥导出公钥。'),
    command('非对称_SM2加密', [{ name: '明文', type: 'wideString', description: '要加密的短文本，按 UTF-8 处理。'}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}], 'wideString', '使用 SM2/SM3 加密文本并返回 Base64。'),
    command('非对称_SM2解密', [{ name: 'Base64密文', type: 'wideString', description: base64CipherArg}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '使用 SM2/SM3 解密文本。'),
    command('非对称_SM2签名', [{ name: '文本', type: 'wideString', description: '要签名的原文文本，按 UTF-8 参与 SM3 摘要。'}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}, { name: '用户标识', type: 'wideString', description: '没有协议要求时可使用 1234567812345678。' }], 'wideString', '使用 SM2/SM3 签名。'),
    command('非对称_SM2验签', [{ name: '文本', type: 'wideString', description: '签名时的原文文本。'}, { name: 'Base64签名', type: 'wideString', description: base64SignatureArg}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}, { name: '用户标识', type: 'wideString', description: '签名时使用的同一用户标识，必须与签名时完全一致且不含英文逗号。'}], 'bool', '验证 SM2/SM3 签名。'),
    command('非对称_ECDH_P256生成私钥', [], 'wideString', '生成 ECDH secp256r1 私钥。'),
    command('非对称_ECDH_P256取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '导出 ECDH P-256 公钥。'),
    command('非对称_ECDH_P256协商', [{ name: '本方私钥PEM', type: 'wideString', description: privatePemArg}, { name: '对方公钥PEM', type: 'wideString', description: '对方的 X.509 PEM 公钥；曲线必须是 secp256r1。'}], 'wideString', '执行 ECDH P-256 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。'),
    command('非对称_X25519生成私钥', [], 'wideString', '生成 X25519 私钥。'),
    command('非对称_X25519取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '导出 X25519 公钥。'),
    command('非对称_X25519协商', [{ name: '本方私钥PEM', type: 'wideString', description: privatePemArg}, { name: '对方公钥PEM', type: 'wideString', description: '对方的 X.509 PEM 公钥。'}], 'wideString', '执行 X25519 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。'),
    command('非对称_ElGamal生成私钥', [{ name: '位数', type: 'int', description: '允许 2048 或 3072。' }], 'wideString', '生成 ElGamal PKCS#8 PEM 私钥；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_ElGamal取公钥', [{ name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '从 ElGamal 私钥导出公钥。', { visibility: 'advanced' }),
    command('非对称_ElGamal加密', [{ name: '明文', type: 'wideString', description: '要加密的短文本，按 UTF-8 处理。'}, { name: '公钥PEM', type: 'wideString', description: publicPemArg}], 'wideString', '使用 ElGamal/OAEP(SHA-256) 加密短文本；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_ElGamal解密', [{ name: 'Base64密文', type: 'wideString', description: base64CipherArg}, { name: '私钥PEM', type: 'wideString', description: privatePemArg}], 'wideString', '解密 ElGamal/OAEP(SHA-256) 密文；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_取错误', [], 'wideString', '读取最近一次非对称操作失败的中文错误。')
  ]
});

const crypto = createStandardModule({
  id: 'lingbuilder.crypto.windows', name: 'Windows数据保护模块', category: '系统', description: '使用当前 Windows 用户的 DPAPI 保护文本和原始字节集，不暴露密钥。', tags: ['安全', 'DPAPI'],
  commands: [
    command('数据保护_加密文本', [{ name: '文本', type: 'wideString', description: '要保护的文本，按 UTF-8 加密后返回 Base64；密文只能在本机当前 Windows 用户下解开。'}], 'wideString', '使用当前用户 DPAPI 加密 UTF-8 文本并返回 Base64。'),
    command('数据保护_解密文本', [{ name: 'Base64密文', type: 'wideString', description: '数据保护_加密文本 返回的 Base64 密文，必须是 4 的倍数长度的合法 Base64；跨用户或跨机器解密会失败并返回空文本。'}], 'wideString', '解密当前用户 DPAPI Base64 密文。'),
    command('数据保护_加密字节集', [{ name: '数据', type: 'bytes', description: '要保护的原始字节集，内容原样送入 DPAPI，不做 Base64 也不做 UTF-8 解释；适合随机密钥等非文本二进制数据。空字节集返回空字节集。'}], 'bytes', '使用当前用户 DPAPI 加密原始字节集，返回未经 Base64 包装的密文字节集。', { example: '数据保护_加密字节集(密钥字节集)' }),
    command('数据保护_解密字节集', [{ name: '密文', type: 'bytes', description: 'DPAPI 原始密文字节集，不需要 Base64。开头若为 ASCII "DPAPI" 5 字节（Chromium Local State 中 os_crypt.encrypted_key 去掉 Base64 后的形态），会自动剥离再解密；跨用户、跨机器或密文被改动时返回空字节集。'}], 'bytes', '解密 DPAPI 原始密文字节集并返回原始明文字节集，不做 UTF-8 解释；自动剥离 Chromium 的 "DPAPI" 前缀。二进制密钥必须用本命令，不要用 数据保护_解密文本。', { example: '局部 字节集 主密钥\n主密钥 = 数据保护_解密字节集(去前缀密文)' }),
    command('数据保护_机器级加密文本', [{ name: '文本', type: 'wideString', description: '要保护的文本，按 UTF-8 用本机范围 DPAPI 加密；同机任意用户可解，仅限非个人敏感数据。'}], 'wideString', '使用本机范围 DPAPI 加密文本。'),
    command('数据保护_取错误', [], 'wideString', '返回最近一次文本或字节集数据保护命令的中文错误。')
  ]
});

const odbc = createStandardModule({
  id: 'lingbuilder.database.odbc', name: 'ODBC数据库模块', category: '数据库', description: '提供单连接 ODBC 打开、执行、查询首值、事务和错误状态。', tags: ['数据库', 'ODBC'],
  commands: [
    command('ODBC_连接', [{ name: '连接字符串', type: 'wideString', description: `${odbcConnectArg}重复连接会先断开上一连接。`}], 'bool', '使用 ODBC 连接字符串打开数据库。'),
    command('ODBC_执行', [{ name: 'SQL语句', type: 'wideString', description: odbcSqlArg}], 'int', '执行 SQL 并返回受影响行数，失败返回 -1。'),
    command('ODBC_查询首值', [{ name: 'SQL语句', type: 'wideString', description: odbcSqlArg}], 'wideString', '执行查询并返回首行首列文本。'),
    command('ODBC_设置自动提交', [{ name: '启用', type: 'bool', description: '传真恢复默认逐语句提交，传假进入显式事务模式，之后的 提交 或 回滚 才生效。'}], 'bool', '启用或禁用自动提交。'),
    command('ODBC_提交', [], 'bool', '提交当前事务。'),
    command('ODBC_回滚', [], 'bool', '回滚当前事务。'),
    command('ODBC_取错误', [], 'wideString', '返回最近 ODBC 错误。'),
    command('ODBC_关闭', [], 'void', '关闭 ODBC 连接和环境。')
  ]
});

const imageCore = createStandardModule({
  id: 'lingbuilder.image.core', name: '图像基础模块', category: '图像', description: '基于 GDI+ 提供图片尺寸、格式转换、缩放、裁剪和旋转。', tags: ['图像', 'GDI+'],
  commands: [
    command('图像_取宽度', [{ name: '路径', type: 'wideString', description: imagePathArg}], 'int', '返回图片像素宽度，失败返回 0。'),
    command('图像_取高度', [{ name: '路径', type: 'wideString', description: imagePathArg}], 'int', '返回图片像素高度，失败返回 0。'),
    command('图像_转换格式', [{ name: '来源', type: 'wideString', description: imagePathArg}, { name: '目标', type: 'wideString', description: targetImageArg}, { name: '格式', type: 'wideString', description: '目标编码名，支持 png、jpg、jpeg、bmp、gif、tif、tiff；空文本或不识别时按 PNG 保存。'}], 'bool', '转换为 png、jpg、bmp、gif 或 tif。'),
    command('图像_缩放', [{ name: '来源', type: 'wideString', description: imagePathArg}, { name: '目标', type: 'wideString', description: targetImageArg}, { name: '宽度', type: 'int', description: '缩放后的目标宽度，像素；小于等于 0 返回假。'}, { name: '高度', type: 'int', description: '缩放后的目标高度，像素；小于等于 0 返回假。'}], 'bool', '高质量缩放并按目标扩展名保存。'),
    command('图像_裁剪', [{ name: '来源', type: 'wideString', description: imagePathArg}, { name: '目标', type: 'wideString', description: targetImageArg}, { name: '横坐标', type: 'int', description: '裁剪起点列坐标，从 0 起；与宽度之和越过图片宽度时返回假。'}, { name: '纵坐标', type: 'int', description: '裁剪起点行坐标，从 0 起；与高度之和越过图片高度时返回假。'}, { name: '宽度', type: 'int', description: '裁剪区域宽度，像素；小于等于 0 返回假。'}, { name: '高度', type: 'int', description: '裁剪区域高度，像素；小于等于 0 返回假。'}], 'bool', '裁剪图像区域。'),
    command('图像_旋转90度', [{ name: '来源', type: 'wideString', description: imagePathArg}, { name: '目标', type: 'wideString', description: targetImageArg}, { name: '顺时针', type: 'bool', description: '传真顺时针旋转 90 度，传假逆时针旋转 90 度。'}], 'bool', '顺时针或逆时针旋转 90 度。'),
    command('图像_取错误', [], 'wideString', '返回最近图像错误。')
  ]
});

const imageCapture = createStandardModule({
  id: 'lingbuilder.image.capture', name: '屏幕截图模块', category: '图像', description: '截取主屏、屏幕区域或指定窗口到 PNG 文件。', tags: ['截图', '屏幕'],
  commands: [
    command('截图_主屏到PNG', [{ name: '目标路径', type: 'wideString', description: '保存截图的目标 PNG 路径；所在目录必须已存在。'}], 'bool', '截取主显示器并保存 PNG。'),
    command('截图_区域到PNG', [{ name: '目标路径', type: 'wideString', description: captureTargetArg}, { name: '横坐标', type: 'int', description: '截取区域左上角的屏幕横坐标，物理像素，可为负值以覆盖副屏。'}, { name: '纵坐标', type: 'int', description: '截取区域左上角的屏幕纵坐标，物理像素。'}, { name: '宽度', type: 'int', description: '截取区域宽度，像素；小于等于 0 返回假。'}, { name: '高度', type: 'int', description: '截取区域高度，像素；小于等于 0 返回假。'}], 'bool', '截取指定屏幕区域。'),
    command('截图_窗口到PNG', [{ name: '目标路径', type: 'wideString', description: captureTargetArg}, { name: '窗口句柄', type: 'handle', description: '要截取窗口的外框边界区域，含标题栏和边框；窗口被遮挡时结果同样被遮挡。'}], 'bool', '截取窗口边界区域。')
  ]
});

const bitmap = createStandardModule({
  id: 'lingbuilder.image.bitmap', name: '位图像素模块', category: '图像', description: '以文件为边界读取和修改像素，避免向中文代码暴露 GDI+ 裸指针。', tags: ['位图', '像素'],
  commands: [
    command('位图_取像素ARGB', [{ name: '路径', type: 'wideString', description: imagePathArg}, { name: '横坐标', type: 'int', description: pixelXArg}, { name: '纵坐标', type: 'int', description: pixelYArg}], 'longLong', '返回 ARGB 颜色值，失败返回 -1。'),
    command('位图_置像素ARGB', [{ name: '来源', type: 'wideString', description: imagePathArg}, { name: '目标', type: 'wideString', description: targetImageArg}, { name: '横坐标', type: 'int', description: pixelXArg}, { name: '纵坐标', type: 'int', description: pixelYArg}, { name: 'ARGB', type: 'longLong', description: '写入后的 ARGB 颜色值，按 位图_取像素ARGB 的编码格式给出。'}], 'bool', '修改一个像素并保存到目标文件。'),
    command('位图_取像素红色', [{ name: 'ARGB', type: 'longLong', description: argbValueArg}], 'int', '从 ARGB 值读取红色分量。'),
    command('位图_取像素绿色', [{ name: 'ARGB', type: 'longLong', description: argbValueArg}], 'int', '从 ARGB 值读取绿色分量。'),
    command('位图_取像素蓝色', [{ name: 'ARGB', type: 'longLong', description: argbValueArg}], 'int', '从 ARGB 值读取蓝色分量。')
  ]
});

const icon = createStandardModule({
  id: 'lingbuilder.image.icon', name: '图标处理模块', category: '图像', description: '提取 EXE/DLL 图标并保存为 PNG，同时提供图标数量查询。', tags: ['图标', 'ICO'],
  commands: [
    command('图标_取数量', [{ name: '文件路径', type: 'wideString', description: iconFileArg}], 'int', '返回 EXE、DLL 或 ICO 中可提取图标数量。'),
    command('图标_提取大图标到PNG', [{ name: '文件路径', type: 'wideString', description: iconFileArg}, { name: '索引', type: 'int', description: iconIndexArg}, { name: '目标路径', type: 'wideString', description: '保存图标的目标 PNG 路径。'}], 'bool', '提取大图标并保存 PNG。'),
    command('图标_提取小图标到PNG', [{ name: '文件路径', type: 'wideString', description: iconFileArg}, { name: '索引', type: 'int', description: iconIndexArg}, { name: '目标路径', type: 'wideString', description: '保存图标的目标 PNG 路径。'}], 'bool', '提取小图标并保存 PNG。')
  ]
});

const recognition = createStandardModule({
  id: 'lingbuilder.image.recognition', name: '基础识图模块', category: '图像', description: '提供文件图像中的颜色查找和小模板匹配，结果坐标通过状态命令读取。', tags: ['识图', '颜色', '模板匹配'],
  commands: [
    command('识图_查找颜色', [{ name: '图片路径', type: 'wideString', description: imagePathArg}, { name: 'ARGB', type: 'longLong', description: argbValueArg}, { name: '容差', type: 'int', description: '各颜色通道允许的最大差值；小于 0 按 0、大于 255 按 255 处理。'}], 'bool', '从左到右、从上到下查找接近指定颜色的像素。'),
    command('识图_模板匹配', [{ name: '图片路径', type: 'wideString', description: imagePathArg}, { name: '模板路径', type: 'wideString', description: '小模板图片路径；模板不得超过 512×512 像素，也不得大于目标图片。'}, { name: '容差', type: 'int', description: '每个通道允许的最大色差；小于 0 按 0、大于 255 按 255 处理。'}], 'bool', '执行朴素像素模板匹配，适合小图和测试。'),
    command('识图_取结果横坐标', [], 'int', '返回最近识图结果横坐标，失败为 -1。'),
    command('识图_取结果纵坐标', [], 'int', '返回最近识图结果纵坐标，失败为 -1。'),
    command('识图_颜色相似度', [{ name: 'ARGB一', type: 'longLong', description: '第一个 ARGB 颜色值。'}, { name: 'ARGB二', type: 'longLong', description: '第二个 ARGB 颜色值。'}], 'int', '返回 RGB 最大通道差值，0 表示完全相同。')
  ]
});

const audio = createStandardModule({
  id: 'lingbuilder.media.audio', name: '基础音频模块', category: '其他', description: '使用 Windows 多媒体 API 异步播放 WAV 文件、系统声音并控制主音量。', tags: ['媒体', '音频'],
  commands: [
    command('音频_播放WAV', [{ name: '路径', type: 'wideString', description: wavPathArg}, { name: '循环', type: 'bool', description: '传真的播放结束后从头循环，需要 音频_停止 才会停止。'}], 'bool', '异步播放 WAV 文件。'),
    command('音频_停止', [], 'void', '停止当前 PlaySound 音频。'),
    command('音频_播放系统提示', [], 'bool', '播放系统通知声音。'),
    command('音频_取主音量', [], 'int', '返回 waveOut 主音量 0 到 100。'),
    command('音频_设置主音量', [{ name: '音量', type: 'int', description: '目标音量百分比，0 到 100；超出范围会被夹到端点，左右声道同时设置。'}], 'bool', '设置 waveOut 主音量 0 到 100。'),
    command('音频_置静音', [{ name: '静音', type: 'bool', description: '真静音系统默认输出设备，假解除静音。'}], 'void', '设置系统默认输出设备的静音状态。'),
    command('音频_取静音', [], 'bool', '返回系统默认输出设备是否处于静音状态。'),
    command('音频_播放MP3', [{ name: '路径', type: 'wideString', description: 'MP3/音频文件路径；由 MCI 按扩展名自动选择解码器，也支持 WAV 等可解码格式。'}, { name: '循环', type: 'bool', description: '传真时播放结束后从头循环，需要 音频_停止MP3 才会停止。'}], 'bool', '异步播放 MP3 音频文件（同一时间只有一个 MP3 播放通道，再次播放会替换当前曲目）。'),
    command('音频_暂停MP3', [], 'bool', '暂停当前 MP3 播放。'),
    command('音频_继续MP3', [], 'bool', '继续被暂停的 MP3 播放。'),
    command('音频_停止MP3', [], 'bool', '停止当前 MP3 播放（播放位置归零，文件保持打开以便查询状态）。'),
    command('音频_取MP3状态', [], 'wideString', '返回 MP3 当前状态文本：播放中、已暂停或已停止。'),
    command('音频_取MP3长度', [], 'int', '返回当前 MP3 总时长（毫秒）；未打开文件返回 0。'),
    command('音频_取MP3位置', [], 'int', '返回当前 MP3 播放位置（毫秒）。'),
    command('音频_跳转MP3', [{ name: '位置毫秒', type: 'int', description: '要跳转到的位置（毫秒），从 0 起。'}], 'bool', '把 MP3 播放位置跳到指定毫秒并继续播放。'),
    command('音频_播放MIDI', [{ name: '路径', type: 'wideString', description: 'MIDI 文件路径。'}, { name: '循环', type: 'bool', description: '传真时播放结束后从头循环。'}], 'bool', '异步播放 MIDI 音乐（同一时间只有一个 MIDI 通道）。'),
    command('音频_停止MIDI', [], 'bool', '停止当前 MIDI 播放。')
  ]
});

export const DATA_MEDIA_MODULES: LingBuilderModuleManifest[] = [csv, hash, password, symmetric, asymmetric, crypto, odbc, SQLITE_MODULE, MYSQL_MODULE, EXCEL_MODULE, imageCore, imageCapture, bitmap, icon, recognition, audio];
