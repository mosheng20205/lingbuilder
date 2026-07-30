# 编码转换模块完整演示

- 模块 ID：`lingbuilder.std.encoding`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：30
- 设计器控件数：0
- 分组数：2

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

通过十六进制字节文本安全提供 UTF-8、UTF-16、UTF-32、ANSI、GBK、GB2312、GB18030、BOM、Base64、URL 与 HTML 编解码。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `编码_文本转UTF8` | `编码_文本转UTF8(文本)` | wideString | 把 Unicode 文本编码为 UTF-8 字节，返回大写十六进制文本。 |
| 2 | `编码_UTF8转文本` | `编码_UTF8转文本(UTF8十六进制)` | wideString | 把十六进制表示的 UTF-8 字节解码为 Unicode 文本；无效输入返回空文本。 |
| 3 | `编码_文本转UTF16LE` | `编码_文本转UTF16LE(文本)` | wideString | 把 Unicode 文本编码为不带 BOM 的 UTF-16 LE 字节，返回大写十六进制文本。 |
| 4 | `编码_UTF16LE转文本` | `编码_UTF16LE转文本(UTF16LE十六进制)` | wideString | 把十六进制表示的 UTF-16 LE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。 |
| 5 | `编码_文本转UTF16BE` | `编码_文本转UTF16BE(文本)` | wideString | 把 Unicode 文本编码为不带 BOM 的 UTF-16 BE 字节，返回大写十六进制文本。 |
| 6 | `编码_UTF16BE转文本` | `编码_UTF16BE转文本(UTF16BE十六进制)` | wideString | 把十六进制表示的 UTF-16 BE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。 |
| 7 | `编码_文本转UTF32LE` | `编码_文本转UTF32LE(文本)` | wideString | 把 Unicode 文本编码为不带 BOM 的 UTF-32 LE 字节，返回大写十六进制文本。 |
| 8 | `编码_UTF32LE转文本` | `编码_UTF32LE转文本(UTF32LE十六进制)` | wideString | 把十六进制表示的 UTF-32 LE 字节解码为 Unicode 文本；无效码点返回空文本。 |
| 9 | `编码_文本转UTF32BE` | `编码_文本转UTF32BE(文本)` | wideString | 把 Unicode 文本编码为不带 BOM 的 UTF-32 BE 字节，返回大写十六进制文本。 |
| 10 | `编码_UTF32BE转文本` | `编码_UTF32BE转文本(UTF32BE十六进制)` | wideString | 把十六进制表示的 UTF-32 BE 字节解码为 Unicode 文本；无效码点返回空文本。 |
| 11 | `编码_文本转ANSI` | `编码_文本转ANSI(文本)` | wideString | 按当前 Windows 系统 ANSI 代码页编码文本，返回大写十六进制字节；无法无损表示时返回空文本。 |
| 12 | `编码_ANSI转文本` | `编码_ANSI转文本(ANSI十六进制)` | wideString | 按当前 Windows 系统 ANSI 代码页解码十六进制字节。 |
| 13 | `编码_文本转GBK` | `编码_文本转GBK(文本)` | wideString | 按 Windows CP936 把文本编码为 GBK 字节，返回大写十六进制文本；无法无损表示时返回空文本。 |
| 14 | `编码_GBK转文本` | `编码_GBK转文本(GBK十六进制)` | wideString | 按 Windows CP936 解码十六进制表示的 GBK 字节。 |
| 15 | `编码_文本转GB2312` | `编码_文本转GB2312(文本)` | wideString | 把文本编码为严格 GB2312 双字节范围，返回大写十六进制文本；GBK 扩展字符或无法表示的字符返回空文本。 |
| 16 | `编码_GB2312转文本` | `编码_GB2312转文本(GB2312十六进制)` | wideString | 校验 GB2312 字节范围后按 Windows CP936 解码为 Unicode 文本。 |
| 17 | `编码_文本转GB18030` | `编码_文本转GB18030(文本)` | wideString | 按 Windows CP54936 把文本编码为 GB18030 字节，返回大写十六进制文本。 |
| 18 | `编码_GB18030转文本` | `编码_GB18030转文本(GB18030十六进制)` | wideString | 按 Windows CP54936 解码十六进制表示的 GB18030 字节。 |
| 19 | `编码_转换` | `编码_转换(字节十六进制, 来源编码, 目标编码)` | wideString | 在支持的字符编码间转换十六进制字节；编码名支持 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030。输出不自动添加 BOM。 |
| 20 | `编码_添加BOM` | `编码_添加BOM(字节十六进制, 编码名称)` | wideString | 为 UTF-8、UTF-16LE/BE 或 UTF-32LE/BE 十六进制字节添加匹配 BOM；已有 BOM 不重复添加。 |
| 21 | `编码_删除BOM` | `编码_删除BOM(字节十六进制)` | wideString | 识别并删除 UTF-8、UTF-16 或 UTF-32 BOM，返回剩余大写十六进制字节。 |
| 22 | `编码_是否有BOM` | `编码_是否有BOM(字节十六进制)` | bool | 判断十六进制字节是否以受支持的 BOM 开头。 |
| 23 | `编码_检测BOM` | `编码_检测BOM(字节十六进制)` | wideString | 根据 BOM 返回 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE 或 UTF-32BE；没有 BOM 返回空文本。 |
| 24 | `编码_检测` | `编码_检测(字节十六进制)` | wideString | 先检测 BOM；无 BOM 时仅在字节是严格 UTF-8 时返回 UTF-8，否则返回“未知”，不猜测 ANSI 或中文代码页。 |
| 25 | `编码_Base64编码` | `编码_Base64编码(文本)` | wideString | 将 Unicode 文本按 UTF-8 编码为 Base64。 |
| 26 | `编码_Base64解码` | `编码_Base64解码(Base64文本)` | wideString | 将 Base64 解码为 UTF-8 文本，格式错误返回空文本。 |
| 27 | `编码_URL编码` | `编码_URL编码(文本)` | wideString | 按 UTF-8 对 URL 参数内容进行百分号编码。 |
| 28 | `编码_URL解码` | `编码_URL解码(文本)` | wideString | 解码 URL 百分号编码和加号空格。 |
| 29 | `编码_HTML转义` | `编码_HTML转义(文本)` | wideString | 转义 HTML 中的与号、尖括号、引号和单引号。 |
| 30 | `编码_HTML反转义` | `编码_HTML反转义(文本)` | wideString | 还原本模块支持的常用 HTML 实体。 |
