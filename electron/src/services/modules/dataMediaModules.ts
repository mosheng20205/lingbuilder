import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';

export const CRYPTO_SDK_MODULE_IDS = [
  'lingbuilder.crypto.hash',
  'lingbuilder.crypto.password',
  'lingbuilder.crypto.symmetric',
  'lingbuilder.crypto.asymmetric'
] as const;

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };
type CommandOptions = Pick<StandardCommandSpec, 'example' | 'returnDescription' | 'visibility'>;
function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string, options: CommandOptions | string = {}): StandardCommandSpec {
  const args = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  const normalizedOptions = typeof options === 'string' ? { example: options } : options;
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${args.join(', ')})`, parameters, returnType, ...normalizedOptions };
}

const csv = createStandardModule({
  id: 'lingbuilder.data.csv', name: 'CSV数据模块', category: '其他', description: '提供 RFC 4180 风格的 CSV 字段转义、行生成和字段读取。', tags: ['数据', 'CSV'],
  commands: [
    command('CSV_转义字段', [{ name: '字段', type: 'wideString' }], 'wideString', '按需添加双引号并转义字段。'),
    command('CSV_生成两列', [{ name: '第一列', type: 'wideString' }, { name: '第二列', type: 'wideString' }], 'wideString', '生成包含两个字段的一行 CSV。'),
    command('CSV_生成三列', [{ name: '第一列', type: 'wideString' }, { name: '第二列', type: 'wideString' }, { name: '第三列', type: 'wideString' }], 'wideString', '生成包含三个字段的一行 CSV。'),
    command('CSV_字段数量', [{ name: '行文本', type: 'wideString' }], 'int', '解析一行 CSV 并返回字段数。'),
    command('CSV_取字段', [{ name: '行文本', type: 'wideString' }, { name: '索引', type: 'int' }], 'wideString', '按从 0 开始索引读取字段。')
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
    command('哈希_安全随机十六进制', [{ name: '字节数', type: 'int' }], 'wideString', '使用系统加密随机源生成十六进制文本。')
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
    command('密码_Argon2id验证', [{ name: '密码', type: 'wideString' }, { name: '已保存哈希', type: 'wideString' }], 'bool', '恒定时间验证 Argon2id PHC 哈希。'),
    command('密码_scrypt哈希', [
      { name: '密码', type: 'wideString' }, { name: 'N', type: 'int', description: 'CPU/内存成本，必须为 2 的幂，推荐 32768。' },
      { name: 'r', type: 'int', description: '块大小参数，推荐 8。' }, { name: 'p', type: 'int', description: '并行参数，推荐 1。' }
    ], 'wideString', '生成包含全部参数和随机盐的 scrypt PHC 哈希。', { example: '密码_scrypt哈希("密码", 32768, 8, 1)' }),
    command('密码_scrypt验证', [{ name: '密码', type: 'wideString' }, { name: '已保存哈希', type: 'wideString' }], 'bool', '恒定时间验证 scrypt PHC 哈希。'),
    command('密码_bcrypt哈希', [{ name: '密码', type: 'wideString' }, { name: '成本', type: 'int', description: '成本因子，范围 4～18，推荐 12。' }], 'wideString', '生成标准 bcrypt 密码哈希。', { example: '密码_bcrypt哈希("密码", 12)' }),
    command('密码_bcrypt验证', [{ name: '密码', type: 'wideString' }, { name: '已保存哈希', type: 'wideString' }], 'bool', '验证 bcrypt 密码哈希。'),
    command('密码_PBKDF2_SHA256哈希', [{ name: '密码', type: 'wideString' }, { name: '迭代次数', type: 'int', description: '迭代次数，范围 10000～10000000，推荐至少 600000。' }], 'wideString', '生成带随机盐的 PBKDF2-HMAC-SHA256 自描述哈希。', { example: '密码_PBKDF2_SHA256哈希("密码", 600000)' }),
    command('密码_PBKDF2_SHA256验证', [{ name: '密码', type: 'wideString' }, { name: '已保存哈希', type: 'wideString' }], 'bool', '恒定时间验证 PBKDF2-HMAC-SHA256 哈希。'),
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
  id: 'lingbuilder.crypto.symmetric', name: '对称加密模块', category: '系统', description: '提供认证加密、传统分组加密和兼容流加密；密钥统一使用严格十六进制文本，密文使用带算法和随机数的自描述封装。', tags: ['安全', 'AES-GCM', 'ChaCha20', 'SM4', '对称加密'],
  commands: [
    command('对称_生成密钥', [{ name: '字节数', type: 'int', description: '密钥字节数，范围 1～1024。' }], 'wideString', '使用系统密码学随机源生成大写十六进制密钥。', { example: '对称_生成密钥(32)' }),
    ...symmetricAlgorithms.flatMap(([suffix, displayName, authenticated, keyBytes, legacy]) => {
      const extra = authenticated ? [{ name: '附加数据', type: 'wideString' as const, description: '参与认证但不加密的 UTF-8 文本，可传空文本。' }] : [];
      const warning = legacy ? '该算法不提供完整性认证，仅用于兼容旧数据；新项目优先使用 AES-256/GCM 或 ChaCha20-Poly1305。' : '加密时自动生成随机 nonce，并验证认证标签。';
      return [
        command(`对称_${suffix}加密`, [{ name: '明文', type: 'wideString', description: '按 UTF-8 编码的明文。' }, { name: '密钥十六进制', type: 'wideString', description: `必须恰好为 ${keyBytes} 字节的十六进制密钥。` }, ...extra], 'wideString', `使用 ${displayName} 加密并返回自描述密文。${warning}`, { visibility: legacy ? 'advanced' : 'default' }),
        command(`对称_${suffix}解密`, [{ name: '自描述密文', type: 'wideString' }, { name: '密钥十六进制', type: 'wideString', description: `必须恰好为 ${keyBytes} 字节的十六进制密钥。` }, ...extra], 'wideString', `解密 ${displayName} 自描述密文。认证或格式失败时返回空文本并记录错误。${warning}`, { visibility: legacy ? 'advanced' : 'default' })
      ];
    }),
    command('对称_RC2CBC加密', [{ name: '明文', type: 'wideString', description: '按 UTF-8 编码的明文。' }, { name: '密钥十六进制', type: 'wideString', description: '必须恰好为 16 字节的十六进制密钥。' }], 'wideString', '使用 Windows CryptoAPI RC2-128/CBC 加密并返回自描述密文。该算法仅用于兼容旧数据，新项目不要使用。', { visibility: 'advanced' }),
    command('对称_RC2CBC解密', [{ name: '自描述密文', type: 'wideString' }, { name: '密钥十六进制', type: 'wideString', description: '必须恰好为 16 字节的十六进制密钥。' }], 'wideString', '解密 RC2-128/CBC 自描述密文。该算法仅用于兼容旧数据，新项目不要使用。', { visibility: 'advanced' }),
    command('对称_取错误', [], 'wideString', '读取最近一次对称加密或解密失败的中文错误。')
  ]
});

const asymmetric = createStandardModule({
  id: 'lingbuilder.crypto.asymmetric', name: '非对称密码模块', category: '系统', description: '提供 RSA、ECDSA P-256、ECDH P-256、X25519、SM2 和 ElGamal 的密钥、加密、签名或协商能力。私钥使用 PKCS#8 PEM，公钥使用 X.509 PEM。', tags: ['安全', 'RSA', 'ECC', 'SM2', 'X25519', '非对称加密'],
  commands: [
    command('非对称_RSA生成私钥', [{ name: '位数', type: 'int', description: '允许 2048、3072 或 4096。' }], 'wideString', '生成 RSA PKCS#8 PEM 私钥。', { example: '非对称_RSA生成私钥(3072)' }),
    command('非对称_RSA取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '从 RSA 私钥导出 X.509 PEM 公钥。'),
    command('非对称_RSA_OAEP_SHA256加密', [{ name: '明文', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }], 'wideString', '使用 RSA-OAEP(SHA-256) 加密短文本并返回 Base64。'),
    command('非对称_RSA_OAEP_SHA256解密', [{ name: 'Base64密文', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }], 'wideString', '使用 RSA-OAEP(SHA-256) 解密短文本。'),
    command('非对称_RSA_PSS_SHA256签名', [{ name: '文本', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }], 'wideString', '使用 RSA-PSS(SHA-256) 签名并返回 Base64。'),
    command('非对称_RSA_PSS_SHA256验签', [{ name: '文本', type: 'wideString' }, { name: 'Base64签名', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }], 'bool', '验证 RSA-PSS(SHA-256) 签名。'),
    command('非对称_ECDSA_P256生成私钥', [], 'wideString', '生成 ECDSA secp256r1 PKCS#8 PEM 私钥。'),
    command('非对称_ECDSA_P256取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '从 ECDSA P-256 私钥导出公钥。'),
    command('非对称_ECDSA_P256签名', [{ name: '文本', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }], 'wideString', '使用 ECDSA P-256 与 SHA-256 签名。'),
    command('非对称_ECDSA_P256验签', [{ name: '文本', type: 'wideString' }, { name: 'Base64签名', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }], 'bool', '验证 ECDSA P-256/SHA-256 签名。'),
    command('非对称_SM2生成私钥', [], 'wideString', '生成 SM2 P-256 PKCS#8 PEM 私钥。'),
    command('非对称_SM2取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '从 SM2 私钥导出公钥。'),
    command('非对称_SM2加密', [{ name: '明文', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }], 'wideString', '使用 SM2/SM3 加密文本并返回 Base64。'),
    command('非对称_SM2解密', [{ name: 'Base64密文', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }], 'wideString', '使用 SM2/SM3 解密文本。'),
    command('非对称_SM2签名', [{ name: '文本', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }, { name: '用户标识', type: 'wideString', description: '没有协议要求时可使用 1234567812345678。' }], 'wideString', '使用 SM2/SM3 签名。'),
    command('非对称_SM2验签', [{ name: '文本', type: 'wideString' }, { name: 'Base64签名', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }, { name: '用户标识', type: 'wideString' }], 'bool', '验证 SM2/SM3 签名。'),
    command('非对称_ECDH_P256生成私钥', [], 'wideString', '生成 ECDH secp256r1 私钥。'),
    command('非对称_ECDH_P256取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '导出 ECDH P-256 公钥。'),
    command('非对称_ECDH_P256协商', [{ name: '本方私钥PEM', type: 'wideString' }, { name: '对方公钥PEM', type: 'wideString' }], 'wideString', '执行 ECDH P-256 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。'),
    command('非对称_X25519生成私钥', [], 'wideString', '生成 X25519 私钥。'),
    command('非对称_X25519取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '导出 X25519 公钥。'),
    command('非对称_X25519协商', [{ name: '本方私钥PEM', type: 'wideString' }, { name: '对方公钥PEM', type: 'wideString' }], 'wideString', '执行 X25519 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。'),
    command('非对称_ElGamal生成私钥', [{ name: '位数', type: 'int', description: '允许 2048 或 3072。' }], 'wideString', '生成 ElGamal PKCS#8 PEM 私钥；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_ElGamal取公钥', [{ name: '私钥PEM', type: 'wideString' }], 'wideString', '从 ElGamal 私钥导出公钥。', { visibility: 'advanced' }),
    command('非对称_ElGamal加密', [{ name: '明文', type: 'wideString' }, { name: '公钥PEM', type: 'wideString' }], 'wideString', '使用 ElGamal/OAEP(SHA-256) 加密短文本；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_ElGamal解密', [{ name: 'Base64密文', type: 'wideString' }, { name: '私钥PEM', type: 'wideString' }], 'wideString', '解密 ElGamal/OAEP(SHA-256) 密文；仅用于兼容。', { visibility: 'advanced' }),
    command('非对称_取错误', [], 'wideString', '读取最近一次非对称操作失败的中文错误。')
  ]
});

const crypto = createStandardModule({
  id: 'lingbuilder.crypto.windows', name: 'Windows数据保护模块', category: '系统', description: '使用当前 Windows 用户的 DPAPI 保护和还原文本，不暴露密钥。', tags: ['安全', 'DPAPI'],
  commands: [
    command('数据保护_加密文本', [{ name: '文本', type: 'wideString' }], 'wideString', '使用当前用户 DPAPI 加密 UTF-8 文本并返回 Base64。'),
    command('数据保护_解密文本', [{ name: 'Base64密文', type: 'wideString' }], 'wideString', '解密当前用户 DPAPI Base64 密文。'),
    command('数据保护_机器级加密文本', [{ name: '文本', type: 'wideString' }], 'wideString', '使用本机范围 DPAPI 加密文本。'),
    command('数据保护_取错误', [], 'wideString', '返回最近数据保护错误。')
  ]
});

const odbc = createStandardModule({
  id: 'lingbuilder.database.odbc', name: 'ODBC数据库模块', category: '数据库', description: '提供单连接 ODBC 打开、执行、查询首值、事务和错误状态。', tags: ['数据库', 'ODBC'],
  commands: [
    command('ODBC_连接', [{ name: '连接字符串', type: 'wideString' }], 'bool', '使用 ODBC 连接字符串打开数据库。'),
    command('ODBC_执行', [{ name: 'SQL语句', type: 'wideString' }], 'int', '执行 SQL 并返回受影响行数，失败返回 -1。'),
    command('ODBC_查询首值', [{ name: 'SQL语句', type: 'wideString' }], 'wideString', '执行查询并返回首行首列文本。'),
    command('ODBC_设置自动提交', [{ name: '启用', type: 'bool' }], 'bool', '启用或禁用自动提交。'),
    command('ODBC_提交', [], 'bool', '提交当前事务。'),
    command('ODBC_回滚', [], 'bool', '回滚当前事务。'),
    command('ODBC_取错误', [], 'wideString', '返回最近 ODBC 错误。'),
    command('ODBC_关闭', [], 'void', '关闭 ODBC 连接和环境。')
  ]
});

const sqlite = createStandardModule({
  id: 'lingbuilder.database.sqlite', name: 'SQLite数据库桥接模块', category: '数据库', description: '动态加载用户提供的 sqlite3.dll，提供单连接执行和查询闭环；缺少运行库时返回明确错误。', tags: ['数据库', 'SQLite'],
  commands: [
    command('SQLite_加载运行库', [{ name: 'DLL路径', type: 'wideString' }], 'bool', '加载 sqlite3.dll 并检查所需 API；空路径尝试系统搜索。'),
    command('SQLite_打开', [{ name: '数据库路径', type: 'wideString' }], 'bool', '以 UTF-8 路径打开 SQLite 数据库。'),
    command('SQLite_执行', [{ name: 'SQL语句', type: 'wideString' }], 'bool', '执行无结果 SQL。'),
    command('SQLite_查询首值', [{ name: 'SQL语句', type: 'wideString' }], 'wideString', '返回首行首列 UTF-8 文本。'),
    command('SQLite_取更改行数', [], 'int', '返回最近语句更改的行数。'),
    command('SQLite_取错误', [], 'wideString', '返回最近 SQLite 或运行库加载错误。'),
    command('SQLite_关闭', [], 'void', '关闭数据库并卸载动态运行库。')
  ]
});

const imageCore = createStandardModule({
  id: 'lingbuilder.image.core', name: '图像基础模块', category: '图像', description: '基于 GDI+ 提供图片尺寸、格式转换、缩放、裁剪和旋转。', tags: ['图像', 'GDI+'],
  commands: [
    command('图像_取宽度', [{ name: '路径', type: 'wideString' }], 'int', '返回图片像素宽度，失败返回 0。'),
    command('图像_取高度', [{ name: '路径', type: 'wideString' }], 'int', '返回图片像素高度，失败返回 0。'),
    command('图像_转换格式', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '格式', type: 'wideString' }], 'bool', '转换为 png、jpg、bmp、gif 或 tif。'),
    command('图像_缩放', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], 'bool', '高质量缩放并按目标扩展名保存。'),
    command('图像_裁剪', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], 'bool', '裁剪图像区域。'),
    command('图像_旋转90度', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '顺时针', type: 'bool' }], 'bool', '顺时针或逆时针旋转 90 度。'),
    command('图像_取错误', [], 'wideString', '返回最近图像错误。')
  ]
});

const imageCapture = createStandardModule({
  id: 'lingbuilder.image.capture', name: '屏幕截图模块', category: '图像', description: '截取主屏、屏幕区域或指定窗口到 PNG 文件。', tags: ['截图', '屏幕'],
  commands: [
    command('截图_主屏到PNG', [{ name: '目标路径', type: 'wideString' }], 'bool', '截取主显示器并保存 PNG。'),
    command('截图_区域到PNG', [{ name: '目标路径', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], 'bool', '截取指定屏幕区域。'),
    command('截图_窗口到PNG', [{ name: '目标路径', type: 'wideString' }, { name: '窗口句柄', type: 'handle' }], 'bool', '截取窗口边界区域。')
  ]
});

const bitmap = createStandardModule({
  id: 'lingbuilder.image.bitmap', name: '位图像素模块', category: '图像', description: '以文件为边界读取和修改像素，避免向中文代码暴露 GDI+ 裸指针。', tags: ['位图', '像素'],
  commands: [
    command('位图_取像素ARGB', [{ name: '路径', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], 'longLong', '返回 ARGB 颜色值，失败返回 -1。'),
    command('位图_置像素ARGB', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: 'ARGB', type: 'longLong' }], 'bool', '修改一个像素并保存到目标文件。'),
    command('位图_取像素红色', [{ name: 'ARGB', type: 'longLong' }], 'int', '从 ARGB 值读取红色分量。'),
    command('位图_取像素绿色', [{ name: 'ARGB', type: 'longLong' }], 'int', '从 ARGB 值读取绿色分量。'),
    command('位图_取像素蓝色', [{ name: 'ARGB', type: 'longLong' }], 'int', '从 ARGB 值读取蓝色分量。')
  ]
});

const icon = createStandardModule({
  id: 'lingbuilder.image.icon', name: '图标处理模块', category: '图像', description: '提取 EXE/DLL 图标并保存为 PNG，同时提供图标数量查询。', tags: ['图标', 'ICO'],
  commands: [
    command('图标_取数量', [{ name: '文件路径', type: 'wideString' }], 'int', '返回 EXE、DLL 或 ICO 中可提取图标数量。'),
    command('图标_提取大图标到PNG', [{ name: '文件路径', type: 'wideString' }, { name: '索引', type: 'int' }, { name: '目标路径', type: 'wideString' }], 'bool', '提取大图标并保存 PNG。'),
    command('图标_提取小图标到PNG', [{ name: '文件路径', type: 'wideString' }, { name: '索引', type: 'int' }, { name: '目标路径', type: 'wideString' }], 'bool', '提取小图标并保存 PNG。')
  ]
});

const recognition = createStandardModule({
  id: 'lingbuilder.image.recognition', name: '基础识图模块', category: '图像', description: '提供文件图像中的颜色查找和小模板匹配，结果坐标通过状态命令读取。', tags: ['识图', '颜色', '模板匹配'],
  commands: [
    command('识图_查找颜色', [{ name: '图片路径', type: 'wideString' }, { name: 'ARGB', type: 'longLong' }, { name: '容差', type: 'int' }], 'bool', '从左到右、从上到下查找接近指定颜色的像素。'),
    command('识图_模板匹配', [{ name: '图片路径', type: 'wideString' }, { name: '模板路径', type: 'wideString' }, { name: '容差', type: 'int' }], 'bool', '执行朴素像素模板匹配，适合小图和测试。'),
    command('识图_取结果横坐标', [], 'int', '返回最近识图结果横坐标，失败为 -1。'),
    command('识图_取结果纵坐标', [], 'int', '返回最近识图结果纵坐标，失败为 -1。'),
    command('识图_颜色相似度', [{ name: 'ARGB一', type: 'longLong' }, { name: 'ARGB二', type: 'longLong' }], 'int', '返回 RGB 最大通道差值，0 表示完全相同。')
  ]
});

const audio = createStandardModule({
  id: 'lingbuilder.media.audio', name: '基础音频模块', category: '其他', description: '使用 Windows 多媒体 API 异步播放 WAV 文件、系统声音并控制主音量。', tags: ['媒体', '音频'],
  commands: [
    command('音频_播放WAV', [{ name: '路径', type: 'wideString' }, { name: '循环', type: 'bool' }], 'bool', '异步播放 WAV 文件。'),
    command('音频_停止', [], 'void', '停止当前 PlaySound 音频。'),
    command('音频_播放系统提示', [], 'bool', '播放系统通知声音。'),
    command('音频_取主音量', [], 'int', '返回 waveOut 主音量 0 到 100。'),
    command('音频_设置主音量', [{ name: '音量', type: 'int' }], 'bool', '设置 waveOut 主音量 0 到 100。')
  ]
});

export const DATA_MEDIA_MODULES: LingBuilderModuleManifest[] = [csv, hash, password, symmetric, asymmetric, crypto, odbc, sqlite, imageCore, imageCapture, bitmap, icon, recognition, audio];
