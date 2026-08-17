import { createStandardModule, type StandardCommandSpec } from './standardLibraryModuleFactory';

export const JSON_MODULE_ID = 'lingbuilder.data.json';

const text = (name: string) => ({ name, type: 'wideString' as const });
const jsonValue = (name: string) => ({ name, type: 'JSON值' });

/**
 * RFC 8259 data APIs exposed to LingCpp. JSON值 is a project-local managed
 * handle: it is copied by JSON operations and must be released when retained.
 */
export const JSON_COMMAND_SPECS: StandardCommandSpec[] = [
  { name: 'JSON_是否有效', signature: 'JSON_是否有效(JSON文本)', description: '严格验证 RFC 8259 JSON 文本；失败原因可通过 JSON_取最后错误读取。', insertText: 'JSON_是否有效("$1")', parameters: [text('JSON文本')], returnType: 'bool', category: '解析与文本', example: 'JSON_是否有效("{\\"name\\":\\"LingBuilder\\"}")' },
  { name: 'JSON_转义文本', signature: 'JSON_转义文本(文本)', description: '把普通文本转义为 JSON 字符串内容，不包含外层双引号。', insertText: 'JSON_转义文本("$1")', parameters: [text('文本')], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_反转义文本', signature: 'JSON_反转义文本(转义内容)', description: '还原 JSON 字符串转义内容；格式错误返回空文本并记录错误。', insertText: 'JSON_反转义文本("$1")', parameters: [text('转义内容')], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_解析', signature: 'JSON_解析(JSON文本)', description: '解析 JSON 文本并返回受管 JSON值；失败返回 0。最大输入 16 MiB、最大嵌套 256 层。', insertText: 'JSON_解析("$1")', parameters: [text('JSON文本')], returnType: 'JSON值', category: '解析与文本', example: 'JSON_解析("{\\"name\\":\\"LingBuilder\\",\\"features\\":[\\"解析\\",\\"创建\\"]}")' },
  { name: 'JSON_序列化', signature: 'JSON_序列化(JSON值)', description: '把 JSON值序列化为紧凑、有效的 RFC 8259 JSON 文本。', insertText: 'JSON_序列化($1)', parameters: [jsonValue('JSON值')], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_序列化格式化', signature: 'JSON_序列化格式化(JSON值, 缩进空格)', description: '把 JSON值格式化为多行 JSON。缩进范围为 0 至 16，超出时返回空文本。', insertText: 'JSON_序列化格式化($1, 2)', parameters: [jsonValue('JSON值'), { name: '缩进空格', type: 'int' }], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_格式化文本', signature: 'JSON_格式化文本(JSON文本, 缩进空格)', description: '验证并格式化 JSON 文本；解析失败返回空文本。', insertText: 'JSON_格式化文本("$1", 2)', parameters: [text('JSON文本'), { name: '缩进空格', type: 'int' }], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_压缩文本', signature: 'JSON_压缩文本(JSON文本)', description: '验证并移除 JSON 文本中的无意义空白；不会修改字符串内容。', insertText: 'JSON_压缩文本("$1")', parameters: [text('JSON文本')], returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_取最后错误', signature: 'JSON_取最后错误()', description: '返回当前线程最近一次 JSON 操作的中文错误说明；成功操作会清空该说明。', insertText: 'JSON_取最后错误()', returnType: 'wideString', category: '解析与文本' },
  { name: 'JSON_克隆', signature: 'JSON_克隆(JSON值)', description: '深度复制 JSON值，返回新受管句柄。', insertText: 'JSON_克隆($1)', parameters: [jsonValue('JSON值')], returnType: 'JSON值', category: '值与生命周期' },
  { name: 'JSON_释放', signature: 'JSON_释放(JSON值)', description: '释放已不再使用的 JSON值。重复释放或传入 0 安全返回假。', insertText: 'JSON_释放($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_取类型', signature: 'JSON_取类型(JSON值)', description: '返回 空、对象、数组、文本、整数、数字 或 逻辑。', insertText: 'JSON_取类型($1)', parameters: [jsonValue('JSON值')], returnType: 'wideString', category: '值与生命周期' },
  { name: 'JSON_是否对象', signature: 'JSON_是否对象(JSON值)', description: '判断 JSON值是否为对象。', insertText: 'JSON_是否对象($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_是否数组', signature: 'JSON_是否数组(JSON值)', description: '判断 JSON值是否为数组。', insertText: 'JSON_是否数组($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_是否文本', signature: 'JSON_是否文本(JSON值)', description: '判断 JSON值是否为文本。', insertText: 'JSON_是否文本($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_是否数字', signature: 'JSON_是否数字(JSON值)', description: '判断 JSON值是否为 JSON 数字。', insertText: 'JSON_是否数字($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_是否逻辑', signature: 'JSON_是否逻辑(JSON值)', description: '判断 JSON值是否为逻辑值。', insertText: 'JSON_是否逻辑($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_是否空', signature: 'JSON_是否空(JSON值)', description: '判断 JSON值是否为 null。', insertText: 'JSON_是否空($1)', parameters: [jsonValue('JSON值')], returnType: 'bool', category: '值与生命周期' },
  { name: 'JSON_创建对象', signature: 'JSON_创建对象()', description: '创建空 JSON 对象。', insertText: 'JSON_创建对象()', returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建数组', signature: 'JSON_创建数组()', description: '创建空 JSON 数组。', insertText: 'JSON_创建数组()', returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建空', signature: 'JSON_创建空()', description: '创建 JSON null 值。', insertText: 'JSON_创建空()', returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建文本', signature: 'JSON_创建文本(文本)', description: '创建 JSON 字符串值。', insertText: 'JSON_创建文本("$1")', parameters: [text('文本')], returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建整数', signature: 'JSON_创建整数(数值)', description: '创建 32 位整数 JSON 数字。', insertText: 'JSON_创建整数($1)', parameters: [{ name: '数值', type: 'int' }], returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建长整数', signature: 'JSON_创建长整数(数值)', description: '创建 64 位整数 JSON 数字。', insertText: 'JSON_创建长整数($1)', parameters: [{ name: '数值', type: 'longLong' }], returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建小数', signature: 'JSON_创建小数(数值)', description: '创建有限双精度 JSON 数字；NaN 或无穷大返回 0。', insertText: 'JSON_创建小数($1)', parameters: [{ name: '数值', type: 'double' }], returnType: 'JSON值', category: '创建' },
  { name: 'JSON_创建逻辑', signature: 'JSON_创建逻辑(数值)', description: '创建 JSON true 或 false。', insertText: 'JSON_创建逻辑(假)', parameters: [{ name: '数值', type: 'bool' }], returnType: 'JSON值', category: '创建' },
  { name: 'JSON_取文本值', signature: 'JSON_取文本值(JSON值, 默认值)', description: '读取 JSON 文本值，类型不符时返回默认值。', insertText: 'JSON_取文本值($1, "")', parameters: [jsonValue('JSON值'), text('默认值')], returnType: 'wideString', category: '标量读取' },
  { name: 'JSON_取整数值', signature: 'JSON_取整数值(JSON值, 默认值)', description: '读取 32 位整数 JSON 数字，溢出或类型不符时返回默认值。', insertText: 'JSON_取整数值($1, 0)', parameters: [jsonValue('JSON值'), { name: '默认值', type: 'int' }], returnType: 'int', category: '标量读取' },
  { name: 'JSON_取长整数值', signature: 'JSON_取长整数值(JSON值, 默认值)', description: '读取 64 位整数 JSON 数字，溢出或类型不符时返回默认值。', insertText: 'JSON_取长整数值($1, 0)', parameters: [jsonValue('JSON值'), { name: '默认值', type: 'longLong' }], returnType: 'longLong', category: '标量读取' },
  { name: 'JSON_取小数值', signature: 'JSON_取小数值(JSON值, 默认值)', description: '读取 JSON 数字；无效、非有限或类型不符时返回默认值。', insertText: 'JSON_取小数值($1, 0)', parameters: [jsonValue('JSON值'), { name: '默认值', type: 'double' }], returnType: 'double', category: '标量读取' },
  { name: 'JSON_取逻辑值', signature: 'JSON_取逻辑值(JSON值, 默认值)', description: '读取 JSON 逻辑值，类型不符时返回默认值。', insertText: 'JSON_取逻辑值($1, 假)', parameters: [jsonValue('JSON值'), { name: '默认值', type: 'bool' }], returnType: 'bool', category: '标量读取' },
  { name: 'JSON_对象_数量', signature: 'JSON_对象_数量(对象)', description: '返回对象成员数量；参数不是对象时返回 -1。', insertText: 'JSON_对象_数量($1)', parameters: [jsonValue('对象')], returnType: 'int', category: '对象' },
  { name: 'JSON_对象_是否包含', signature: 'JSON_对象_是否包含(对象, 键)', description: '判断对象是否含有指定键。', insertText: 'JSON_对象_是否包含($1, "$2")', parameters: [jsonValue('对象'), text('键')], returnType: 'bool', category: '对象' },
  { name: 'JSON_对象_取', signature: 'JSON_对象_取(对象, 键)', description: '取得对象成员的深度副本；键不存在或参数不是对象时返回 0。', insertText: 'JSON_对象_取($1, "$2")', parameters: [jsonValue('对象'), text('键')], returnType: 'JSON值', category: '对象' },
  { name: 'JSON_对象_设置', signature: 'JSON_对象_设置(对象, 键, 值)', description: '设置或替换对象成员；写入时深度复制值，键保留 UTF-16 文本。', insertText: 'JSON_对象_设置($1, "$2", $3)', parameters: [jsonValue('对象'), text('键'), jsonValue('值')], returnType: 'bool', category: '对象' },
  { name: 'JSON_对象_移除', signature: 'JSON_对象_移除(对象, 键)', description: '删除对象成员，键不存在时返回假。', insertText: 'JSON_对象_移除($1, "$2")', parameters: [jsonValue('对象'), text('键')], returnType: 'bool', category: '对象' },
  { name: 'JSON_对象_清空', signature: 'JSON_对象_清空(对象)', description: '移除对象中的全部成员。', insertText: 'JSON_对象_清空($1)', parameters: [jsonValue('对象')], returnType: 'bool', category: '对象' },
  { name: 'JSON_对象_键列表', signature: 'JSON_对象_键列表(对象)', description: '返回包含全部键的 JSON 文本数组，顺序为对象插入顺序。', insertText: 'JSON_对象_键列表($1)', parameters: [jsonValue('对象')], returnType: 'wideString', category: '对象' },
  { name: 'JSON_数组_数量', signature: 'JSON_数组_数量(数组)', description: '返回数组元素数量；参数不是数组时返回 -1。', insertText: 'JSON_数组_数量($1)', parameters: [jsonValue('数组')], returnType: 'int', category: '数组' },
  { name: 'JSON_数组_取', signature: 'JSON_数组_取(数组, 索引)', description: '按从 0 开始索引取得数组元素的深度副本，越界返回 0。', insertText: 'JSON_数组_取($1, 0)', parameters: [jsonValue('数组'), { name: '索引', type: 'int' }], returnType: 'JSON值', category: '数组' },
  { name: 'JSON_数组_添加', signature: 'JSON_数组_添加(数组, 值)', description: '向数组末尾添加值，写入时深度复制。', insertText: 'JSON_数组_添加($1, $2)', parameters: [jsonValue('数组'), jsonValue('值')], returnType: 'bool', category: '数组' },
  { name: 'JSON_数组_插入', signature: 'JSON_数组_插入(数组, 索引, 值)', description: '在从 0 开始索引处插入值；索引可等于数组长度。', insertText: 'JSON_数组_插入($1, 0, $2)', parameters: [jsonValue('数组'), { name: '索引', type: 'int' }, jsonValue('值')], returnType: 'bool', category: '数组' },
  { name: 'JSON_数组_设置', signature: 'JSON_数组_设置(数组, 索引, 值)', description: '替换已有数组元素，越界不自动扩容。', insertText: 'JSON_数组_设置($1, 0, $2)', parameters: [jsonValue('数组'), { name: '索引', type: 'int' }, jsonValue('值')], returnType: 'bool', category: '数组' },
  { name: 'JSON_数组_移除', signature: 'JSON_数组_移除(数组, 索引)', description: '移除指定数组元素。', insertText: 'JSON_数组_移除($1, 0)', parameters: [jsonValue('数组'), { name: '索引', type: 'int' }], returnType: 'bool', category: '数组' },
  { name: 'JSON_数组_清空', signature: 'JSON_数组_清空(数组)', description: '移除数组中的全部元素。', insertText: 'JSON_数组_清空($1)', parameters: [jsonValue('数组')], returnType: 'bool', category: '数组' },
  { name: 'JSON_指针_取', signature: 'JSON_指针_取(JSON值, 指针)', description: '按 RFC 6901 JSON Pointer 读取子值的深度副本；根指针使用空文本。', insertText: 'JSON_指针_取($1, "/$2")', parameters: [jsonValue('JSON值'), text('指针')], returnType: 'JSON值', category: 'JSON Pointer' },
  { name: 'JSON_指针_设置', signature: 'JSON_指针_设置(JSON值, 指针, 值, 创建中间对象)', description: '按 JSON Pointer 写入或替换值。创建中间对象只会安全创建对象成员，不能猜测数组结构。', insertText: 'JSON_指针_设置($1, "/$2", $3, 真)', parameters: [jsonValue('JSON值'), text('指针'), jsonValue('值'), { name: '创建中间对象', type: 'bool' }], returnType: 'bool', category: 'JSON Pointer' },
  { name: 'JSON_指针_移除', signature: 'JSON_指针_移除(JSON值, 指针)', description: '按 JSON Pointer 删除对象成员或数组元素；根指针删除后变为 null。', insertText: 'JSON_指针_移除($1, "/$2")', parameters: [jsonValue('JSON值'), text('指针')], returnType: 'bool', category: 'JSON Pointer' },
  { name: 'JSON_合并补丁', signature: 'JSON_合并补丁(JSON值, 合并补丁JSON)', description: '原子应用 RFC 7396 JSON Merge Patch。失败时原 JSON值不改变。', insertText: 'JSON_合并补丁($1, "{\\"$2\\":null}")', parameters: [jsonValue('JSON值'), text('合并补丁JSON')], returnType: 'bool', category: 'JSON Patch' },
  { name: 'JSON_应用补丁', signature: 'JSON_应用补丁(JSON值, 补丁JSON)', description: '原子应用 RFC 6902 add、remove、replace、move、copy、test 操作。失败时原 JSON值不改变。', insertText: 'JSON_应用补丁($1, "[{\\"op\\":\\"replace\\",\\"path\\":\\"/$2\\",\\"value\\":$3}]")', parameters: [jsonValue('JSON值'), text('补丁JSON')], returnType: 'bool', category: 'JSON Patch' },
  { name: 'JSON_生成补丁', signature: 'JSON_生成补丁(源JSON值, 目标JSON值)', description: '生成可由 JSON_应用补丁原子应用的 RFC 6902 补丁 JSON 文本。数组差异采用安全的整数组替换。', insertText: 'JSON_生成补丁($1, $2)', parameters: [jsonValue('源JSON值'), jsonValue('目标JSON值')], returnType: 'wideString', category: 'JSON Patch' },
  { name: 'JSON_Schema验证', signature: 'JSON_Schema验证(JSON值, SchemaJSON)', description: '校验 JSON值。支持 type、const、enum、对象属性/required/additionalProperties、数组 items/长度/uniqueItems、字符串长度/pattern、数值范围/multipleOf 及 allOf/anyOf/oneOf/not。', insertText: 'JSON_Schema验证($1, "{\\"type\\":\\"object\\"}")', parameters: [jsonValue('JSON值'), text('SchemaJSON')], returnType: 'bool', category: 'JSON Schema' },
  { name: 'JSON_取文本', signature: 'JSON_取文本(JSON文本, 字段名)', description: '兼容旧版：读取顶层对象的文本字段。新代码建议 JSON_解析 后使用对象或 Pointer API。', insertText: 'JSON_取文本("$1", "$2")', parameters: [text('JSON文本'), text('字段名')], returnType: 'wideString', category: '兼容接口' },
  { name: 'JSON_取整数', signature: 'JSON_取整数(JSON文本, 字段名, 默认值)', description: '兼容旧版：读取顶层对象的 32 位整数。', insertText: 'JSON_取整数("$1", "$2", 0)', parameters: [text('JSON文本'), text('字段名'), { name: '默认值', type: 'int' }], returnType: 'int', category: '兼容接口' },
  { name: 'JSON_取逻辑', signature: 'JSON_取逻辑(JSON文本, 字段名, 默认值)', description: '兼容旧版：读取顶层对象的逻辑值。', insertText: 'JSON_取逻辑("$1", "$2", 假)', parameters: [text('JSON文本'), text('字段名'), { name: '默认值', type: 'bool' }], returnType: 'bool', category: '兼容接口' }
];

export const JSON_MODULE = createStandardModule({
  id: JSON_MODULE_ID,
  name: 'JSON 数据模块',
  version: '2.0.0',
  category: '其他',
  description: '商业项目可用的本地 JSON 数据模块：RFC 8259 DOM 解析与创建、JSON Pointer、JSON Patch、Merge Patch、核心 JSON Schema 校验与确定性 C++ 导出。',
  tags: ['数据', 'JSON', 'RFC 8259', 'JSON Pointer', 'JSON Patch', 'JSON Schema'],
  types: [{
    name: 'JSON值',
    kind: 'opaque',
    cppType: 'long long',
    description: '受管 JSON DOM 句柄。对象、数组和标量均可表示；通过 JSON_释放释放长期保留的值。'
  }],
  docs: [{ title: 'JSON 数据模块 2.0 使用说明', path: 'docs/modules/json/README.md' }],
  snippets: [{
    label: 'JSON：创建对象并格式化',
    description: '创建 JSON 对象，写入文本字段并输出格式化结果。',
    insertText: '局部 JSON值 数据 = JSON_创建对象()\nJSON_对象_设置(数据, "name", JSON_创建文本("LingBuilder"))\n调试输出(JSON_序列化格式化(数据, 2))\nJSON_释放(数据)'
  }, {
    label: 'JSON：Pointer 与 Patch',
    description: '读取嵌套值并原子应用 RFC 6902 replace 补丁。',
    insertText: '局部 JSON值 数据 = JSON_解析("{\\"user\\":{\\"name\\":\\"LingBuilder\\"}}")\n局部 JSON值 名称 = JSON_指针_取(数据, "/user/name")\n调试输出(JSON_取文本值(名称, ""))\nJSON_应用补丁(数据, "[{\\"op\\":\\"replace\\",\\"path\\":\\"/user/name\\",\\"value\\":\\"LingBuilder IDE\\"}]")\nJSON_释放(名称)\nJSON_释放(数据)'
  }],
  commands: JSON_COMMAND_SPECS
});
