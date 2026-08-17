# JSON 数据模块完整演示

- 模块 ID：`lingbuilder.data.json`
- 版本：`2.0.0`
- 类型：LingBuilder 内置模块
- 命令数：55
- 设计器控件数：0
- 分组数：3

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

商业项目可用的本地 JSON 数据模块：RFC 8259 DOM 解析与创建、JSON Pointer、JSON Patch、Merge Patch、核心 JSON Schema 校验与确定性 C++ 导出。

## 本示例的三个选项卡

| 选项卡 | 内容 |
|---|---|
| 解析与类型读取 | 解析嵌套对象，读取文本、整数、长整数、小数、逻辑、null 和数组元素，并展示兼容接口。 |
| 创建各种 JSON 类型 | 创建 null、文本、整数、长整数、小数、逻辑、数组和对象，演示对象/数组操作、深度复制和释放。 |
| Pointer、Patch 与 Schema | 使用 RFC 6901 Pointer 定位，RFC 6902/RFC 7396 原子更新，生成补丁并执行 Schema 核心校验。 |

运行时默认处于安全预览状态；勾选“允许实际执行”后，点击当前选项卡按钮才会调用本地 JSON API。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `JSON_是否有效` | `JSON_是否有效(JSON文本)` | bool | 严格验证 RFC 8259 JSON 文本；失败原因可通过 JSON_取最后错误读取。 |
| 2 | `JSON_转义文本` | `JSON_转义文本(文本)` | wideString | 把普通文本转义为 JSON 字符串内容，不包含外层双引号。 |
| 3 | `JSON_反转义文本` | `JSON_反转义文本(转义内容)` | wideString | 还原 JSON 字符串转义内容；格式错误返回空文本并记录错误。 |
| 4 | `JSON_解析` | `JSON_解析(JSON文本)` | JSON值 | 解析 JSON 文本并返回受管 JSON值；失败返回 0。最大输入 16 MiB、最大嵌套 256 层。 |
| 5 | `JSON_序列化` | `JSON_序列化(JSON值)` | wideString | 把 JSON值序列化为紧凑、有效的 RFC 8259 JSON 文本。 |
| 6 | `JSON_序列化格式化` | `JSON_序列化格式化(JSON值, 缩进空格)` | wideString | 把 JSON值格式化为多行 JSON。缩进范围为 0 至 16，超出时返回空文本。 |
| 7 | `JSON_格式化文本` | `JSON_格式化文本(JSON文本, 缩进空格)` | wideString | 验证并格式化 JSON 文本；解析失败返回空文本。 |
| 8 | `JSON_压缩文本` | `JSON_压缩文本(JSON文本)` | wideString | 验证并移除 JSON 文本中的无意义空白；不会修改字符串内容。 |
| 9 | `JSON_取最后错误` | `JSON_取最后错误()` | wideString | 返回当前线程最近一次 JSON 操作的中文错误说明；成功操作会清空该说明。 |
| 10 | `JSON_克隆` | `JSON_克隆(JSON值)` | JSON值 | 深度复制 JSON值，返回新受管句柄。 |
| 11 | `JSON_释放` | `JSON_释放(JSON值)` | bool | 释放已不再使用的 JSON值。重复释放或传入 0 安全返回假。 |
| 12 | `JSON_取类型` | `JSON_取类型(JSON值)` | wideString | 返回 空、对象、数组、文本、整数、数字 或 逻辑。 |
| 13 | `JSON_是否对象` | `JSON_是否对象(JSON值)` | bool | 判断 JSON值是否为对象。 |
| 14 | `JSON_是否数组` | `JSON_是否数组(JSON值)` | bool | 判断 JSON值是否为数组。 |
| 15 | `JSON_是否文本` | `JSON_是否文本(JSON值)` | bool | 判断 JSON值是否为文本。 |
| 16 | `JSON_是否数字` | `JSON_是否数字(JSON值)` | bool | 判断 JSON值是否为 JSON 数字。 |
| 17 | `JSON_是否逻辑` | `JSON_是否逻辑(JSON值)` | bool | 判断 JSON值是否为逻辑值。 |
| 18 | `JSON_是否空` | `JSON_是否空(JSON值)` | bool | 判断 JSON值是否为 null。 |
| 19 | `JSON_创建对象` | `JSON_创建对象()` | JSON值 | 创建空 JSON 对象。 |
| 20 | `JSON_创建数组` | `JSON_创建数组()` | JSON值 | 创建空 JSON 数组。 |
| 21 | `JSON_创建空` | `JSON_创建空()` | JSON值 | 创建 JSON null 值。 |
| 22 | `JSON_创建文本` | `JSON_创建文本(文本)` | JSON值 | 创建 JSON 字符串值。 |
| 23 | `JSON_创建整数` | `JSON_创建整数(数值)` | JSON值 | 创建 32 位整数 JSON 数字。 |
| 24 | `JSON_创建长整数` | `JSON_创建长整数(数值)` | JSON值 | 创建 64 位整数 JSON 数字。 |
| 25 | `JSON_创建小数` | `JSON_创建小数(数值)` | JSON值 | 创建有限双精度 JSON 数字；NaN 或无穷大返回 0。 |
| 26 | `JSON_创建逻辑` | `JSON_创建逻辑(数值)` | JSON值 | 创建 JSON true 或 false。 |
| 27 | `JSON_取文本值` | `JSON_取文本值(JSON值, 默认值)` | wideString | 读取 JSON 文本值，类型不符时返回默认值。 |
| 28 | `JSON_取整数值` | `JSON_取整数值(JSON值, 默认值)` | int | 读取 32 位整数 JSON 数字，溢出或类型不符时返回默认值。 |
| 29 | `JSON_取长整数值` | `JSON_取长整数值(JSON值, 默认值)` | longLong | 读取 64 位整数 JSON 数字，溢出或类型不符时返回默认值。 |
| 30 | `JSON_取小数值` | `JSON_取小数值(JSON值, 默认值)` | double | 读取 JSON 数字；无效、非有限或类型不符时返回默认值。 |
| 31 | `JSON_取逻辑值` | `JSON_取逻辑值(JSON值, 默认值)` | bool | 读取 JSON 逻辑值，类型不符时返回默认值。 |
| 32 | `JSON_对象_数量` | `JSON_对象_数量(对象)` | int | 返回对象成员数量；参数不是对象时返回 -1。 |
| 33 | `JSON_对象_是否包含` | `JSON_对象_是否包含(对象, 键)` | bool | 判断对象是否含有指定键。 |
| 34 | `JSON_对象_取` | `JSON_对象_取(对象, 键)` | JSON值 | 取得对象成员的深度副本；键不存在或参数不是对象时返回 0。 |
| 35 | `JSON_对象_设置` | `JSON_对象_设置(对象, 键, 值)` | bool | 设置或替换对象成员；写入时深度复制值，键保留 UTF-16 文本。 |
| 36 | `JSON_对象_移除` | `JSON_对象_移除(对象, 键)` | bool | 删除对象成员，键不存在时返回假。 |
| 37 | `JSON_对象_清空` | `JSON_对象_清空(对象)` | bool | 移除对象中的全部成员。 |
| 38 | `JSON_对象_键列表` | `JSON_对象_键列表(对象)` | wideString | 返回包含全部键的 JSON 文本数组，顺序为对象插入顺序。 |
| 39 | `JSON_数组_数量` | `JSON_数组_数量(数组)` | int | 返回数组元素数量；参数不是数组时返回 -1。 |
| 40 | `JSON_数组_取` | `JSON_数组_取(数组, 索引)` | JSON值 | 按从 0 开始索引取得数组元素的深度副本，越界返回 0。 |
| 41 | `JSON_数组_添加` | `JSON_数组_添加(数组, 值)` | bool | 向数组末尾添加值，写入时深度复制。 |
| 42 | `JSON_数组_插入` | `JSON_数组_插入(数组, 索引, 值)` | bool | 在从 0 开始索引处插入值；索引可等于数组长度。 |
| 43 | `JSON_数组_设置` | `JSON_数组_设置(数组, 索引, 值)` | bool | 替换已有数组元素，越界不自动扩容。 |
| 44 | `JSON_数组_移除` | `JSON_数组_移除(数组, 索引)` | bool | 移除指定数组元素。 |
| 45 | `JSON_数组_清空` | `JSON_数组_清空(数组)` | bool | 移除数组中的全部元素。 |
| 46 | `JSON_指针_取` | `JSON_指针_取(JSON值, 指针)` | JSON值 | 按 RFC 6901 JSON Pointer 读取子值的深度副本；根指针使用空文本。 |
| 47 | `JSON_指针_设置` | `JSON_指针_设置(JSON值, 指针, 值, 创建中间对象)` | bool | 按 JSON Pointer 写入或替换值。创建中间对象只会安全创建对象成员，不能猜测数组结构。 |
| 48 | `JSON_指针_移除` | `JSON_指针_移除(JSON值, 指针)` | bool | 按 JSON Pointer 删除对象成员或数组元素；根指针删除后变为 null。 |
| 49 | `JSON_合并补丁` | `JSON_合并补丁(JSON值, 合并补丁JSON)` | bool | 原子应用 RFC 7396 JSON Merge Patch。失败时原 JSON值不改变。 |
| 50 | `JSON_应用补丁` | `JSON_应用补丁(JSON值, 补丁JSON)` | bool | 原子应用 RFC 6902 add、remove、replace、move、copy、test 操作。失败时原 JSON值不改变。 |
| 51 | `JSON_生成补丁` | `JSON_生成补丁(源JSON值, 目标JSON值)` | wideString | 生成可由 JSON_应用补丁原子应用的 RFC 6902 补丁 JSON 文本。数组差异采用安全的整数组替换。 |
| 52 | `JSON_Schema验证` | `JSON_Schema验证(JSON值, SchemaJSON)` | bool | 校验 JSON值。支持 type、const、enum、对象属性/required/additionalProperties、数组 items/长度/uniqueItems、字符串长度/pattern、数值范围/multipleOf 及 allOf/anyOf/oneOf/not。 |
| 53 | `JSON_取文本` | `JSON_取文本(JSON文本, 字段名)` | wideString | 兼容旧版：读取顶层对象的文本字段。新代码建议 JSON_解析 后使用对象或 Pointer API。 |
| 54 | `JSON_取整数` | `JSON_取整数(JSON文本, 字段名, 默认值)` | int | 兼容旧版：读取顶层对象的 32 位整数。 |
| 55 | `JSON_取逻辑` | `JSON_取逻辑(JSON文本, 字段名, 默认值)` | bool | 兼容旧版：读取顶层对象的逻辑值。 |
