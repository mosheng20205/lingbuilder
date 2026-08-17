# JSON 数据模块 2.0

模块 ID：`lingbuilder.data.json`  
版本：`2.0.0`  
适用平台：Windows / MSVC Win32、x64；普通 Win32 与 new_emoji 后端共用同一确定性 C++17 运行时。

JSON 数据模块提供可脱离 IDE 运行的本地 JSON 能力。项目启用模块后，生成的 C++ 源码会包含完整运行时；不依赖浏览器、Node.js、云端服务或不可见的临时文件。

## 支持范围

- RFC 8259：严格 JSON 解析、UTF-16 字符串、代理项校验、数值语法、紧凑/格式化序列化。
- JSON DOM：创建 null、对象、数组、文本、整数、长整数、小数、逻辑值；对象和数组的增删改查；深度克隆。
- RFC 6901 JSON Pointer：读取、设置、删除嵌套对象或数组中的值。
- RFC 6902 JSON Patch：`add`、`remove`、`replace`、`move`、`copy`、`test`，整份补丁原子提交。
- RFC 7396 JSON Merge Patch：整份补丁原子提交。
- JSON Schema 核心校验：`type`、`const`、`enum`、`properties`、`required`、`additionalProperties`、`items`、`minItems`、`maxItems`、`uniqueItems`、`minLength`、`maxLength`、`pattern`、`minimum`、`maximum`、`exclusiveMinimum`、`exclusiveMaximum`、`multipleOf`、`allOf`、`anyOf`、`oneOf`、`not`。

本模块不把 JSON5、JSONC、YAML、BSON、MessagePack 或 CBOR 伪装成 JSON；这些格式的注释、二进制编码、日期扩展或引用语义需要独立模块和独立数据契约。

## JSON值 生命周期

`JSON_解析` 与所有 `JSON_创建*` 命令返回 `JSON值`。这是受管 DOM 句柄，不是裸指针，也不能跨线程传递。对象和数组写入操作会深度复制传入的值，因此来源值可在写入后单独释放。

长期保存的 `JSON值` 应在不再需要时调用 `JSON_释放`。传入 `0`、重复释放或使用已释放句柄会安全失败，并可通过 `JSON_取最后错误()` 读取中文原因。

```lcpp
局部 JSON值 数据 = JSON_创建对象()
局部 JSON值 名称 = JSON_创建文本("LingBuilder")
JSON_对象_设置(数据, "name", 名称)
调试输出(JSON_序列化格式化(数据, 2))
JSON_释放(名称)
JSON_释放(数据)
```

## 解析与读取

```lcpp
局部 JSON值 响应 = JSON_解析("{\"user\":{\"name\":\"小明\",\"level\":3}}")
判断(响应 = 0)
    调试输出(JSON_取最后错误())
    返回
结束

局部 JSON值 名称 = JSON_指针_取(响应, "/user/name")
调试输出(JSON_取文本值(名称, "未知用户"))
调试输出(到文本(JSON_取整数值(JSON_指针_取(响应, "/user/level"), 0)))
JSON_释放(名称)
JSON_释放(响应)
```

JSON Pointer 的空文本表示根值。成员名中的 `~` 和 `/` 分别使用 `~0`、`~1` 转义，例如键名 `a/b` 的路径为 `/a~1b`。数组索引从 0 开始，`-` 只允许用于追加位置。

## 创建对象与数组

```lcpp
局部 JSON值 商品 = JSON_创建对象()
局部 JSON值 标签 = JSON_创建数组()
JSON_数组_添加(标签, JSON_创建文本("IDE"))
JSON_数组_添加(标签, JSON_创建文本("中文"))
JSON_对象_设置(商品, "name", JSON_创建文本("LingBuilder"))
JSON_对象_设置(商品, "tags", 标签)
调试输出(JSON_序列化(商品))
JSON_释放(标签)
JSON_释放(商品)
```

JSON 只支持有限数字。`JSON_创建小数` 拒绝 `NaN` 和正负无穷大；整数读取会执行范围校验，超出目标类型时返回调用方提供的默认值。

## Patch 与合并

`JSON_应用补丁` 仅在全部操作成功时修改目标值。`test` 失败、路径不存在、数组下标不合法或补丁格式错误都会保持目标值原样不变。

```lcpp
局部 JSON值 设置 = JSON_解析("{\"theme\":\"dark\",\"fontSize\":14}")
JSON_应用补丁(设置, "[{\"op\":\"replace\",\"path\":\"/fontSize\",\"value\":16}]")
JSON_合并补丁(设置, "{\"theme\":null,\"language\":\"zh-CN\"}")
调试输出(JSON_序列化格式化(设置, 2))
JSON_释放(设置)
```

`JSON_生成补丁(源JSON值, 目标JSON值)` 会生成可直接交给 `JSON_应用补丁` 的 RFC 6902 文本。为保证安全与确定性，数组差异会生成整数组替换，而不是猜测元素身份。

## Schema 校验

```lcpp
局部 JSON值 用户 = JSON_解析("{\"name\":\"小明\",\"age\":18}")
局部 文本型 规则 = "{\"type\":\"object\",\"required\":[\"name\"],\"properties\":{\"name\":{\"type\":\"string\",\"minLength\":1},\"age\":{\"type\":\"integer\",\"minimum\":0}}}"
判断(JSON_Schema验证(用户, 规则) = 假)
    调试输出(JSON_取最后错误())
结束
JSON_释放(用户)
```

`pattern` 使用 C++ ECMAScript 正则表达式语法。当前 Schema 校验不解析远程 `$ref`、网络 URI、内容编码或格式验证器，不会发起网络访问；需要这类能力时应在应用层显式加载、校验并传入规则。

## 资源与安全边界

- 单次 JSON 文本输入最大 16 MiB，JSON 嵌套最大 256 层，Schema 嵌套最大 64 层。
- JSON Schema 的 `uniqueItems` 使用完整值比较，超大数组应在业务层先限制数量。
- 模块只处理内存中的 Unicode 文本。文件读写应使用文件模块，再把文本传给 `JSON_解析` 或 `JSON_序列化`。
- 调用失败不会抛出未受控的 C++ 异常；返回 `0`、`假` 或空文本，并以 `JSON_取最后错误` 提供中文诊断。

## 兼容接口

`JSON_是否有效`、`JSON_转义文本`、`JSON_取文本`、`JSON_取整数`、`JSON_取逻辑` 保持兼容。新代码应优先使用 `JSON_解析`、`JSON值` 和 Pointer API，以支持嵌套数组、强类型标量、原子补丁和 Schema 校验。
