# Protocol Buffers 模块

本模块使用 IDE 内置的受控 `lingbuilder.protobuf.protoc` Provider 扫描工作区 `.proto` 文件，生成 C++ 头文件、源文件和 descriptor set。

构建前必须离线提供固定 Protobuf SDK 27.3.0：`.lingbuilder/toolchains/protobuf/runtime-manifest.json` 必须登记所有头文件、`lib/libprotobuf.lib`、`bin/libprotobuf.dll` 和 `bin/protoc.exe` 的文件大小与 SHA-256。IDE 会校验清单、版本、目标架构和每个文件；缺失或篡改直接阻断构建。模块不会从网络下载工具、使用 PATH 中的系统 protoc 或运行清单中的任意命令。

生成的消息通过描述集和 opaque 句柄使用，覆盖嵌套消息、repeated、map、bytes 和未知字段。`PB_从字节集解析` 与 `PB_序列化为字节集` 使用 LingCpp 正式 `字节集` 类型；跨 DLL 边界输入为 `const unsigned char* + size_t`，输出由调用方先查询长度再提供缓冲区，不传递或释放 STL 容器所有权。

原生生成与依赖物化检查：

```bash
npm run smoke:protobuf-native -- --require-sdk
```
