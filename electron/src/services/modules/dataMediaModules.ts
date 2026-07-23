import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };
function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string, example?: string): StandardCommandSpec {
  const args = parameters.map((parameter, index) => parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${args.join(', ')})`, parameters, returnType, example };
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

const hash = createStandardModule({
  id: 'lingbuilder.crypto.hash', name: '哈希摘要模块', category: '系统', description: '基于 Windows CNG 计算文本和文件的 MD5、SHA-256 摘要。', tags: ['安全', '哈希', 'SHA256'],
  commands: [
    command('哈希_SHA256文本', [{ name: '文本', type: 'wideString' }], 'wideString', '计算 UTF-8 文本的 SHA-256 大写十六进制摘要。', '哈希_SHA256文本("LingBuilder")'),
    command('哈希_MD5文本', [{ name: '文本', type: 'wideString' }], 'wideString', '计算 UTF-8 文本的 MD5 大写十六进制摘要。'),
    command('哈希_SHA256文件', [{ name: '路径', type: 'wideString' }], 'wideString', '流式计算文件 SHA-256 摘要。'),
    command('哈希_MD5文件', [{ name: '路径', type: 'wideString' }], 'wideString', '流式计算文件 MD5 摘要。'),
    command('哈希_安全随机十六进制', [{ name: '字节数', type: 'int' }], 'wideString', '使用系统加密随机源生成十六进制文本。')
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

export const DATA_MEDIA_MODULES: LingBuilderModuleManifest[] = [csv, hash, crypto, odbc, sqlite, imageCore, imageCapture, bitmap, icon, recognition, audio];
