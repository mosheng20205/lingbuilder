# Protocol Buffers 模块 1.0 使用说明

Protocol Buffers 模块（`lingbuilder.data.protobuf`）让中文程序直接使用 `.proto` 定义的二进制消息：受控 protoc 在构建阶段把项目里的 `.proto` 编译成 C++ 代码和描述集，程序里用反射句柄完成字节集序列化与 JSON 互转。适合与服务器通信、保存结构化存档、解析第三方 protobuf 协议（如部分游戏/硬件/IoT 协议）。

## 适用场景

- 与后端服务器交换 protobuf 二进制报文（字节集直接进 HTTP 客户端 / WebSocket / TCP）。
- 本地存档用 protobuf 编码后落盘，比自拼文本格式更稳、更省空间、带 schema 校验。
- 调试第三方协议：把抓到的报文按 `.proto` 解析后转 JSON 查看。

## 工作流：先写 .proto，再用 PB_ 命令

模块不提供逐字段读写命令——消息结构由 `.proto` 文件描述，构建时自动生成。使用分三步：

1. 在项目源码目录（或其子目录）放一个 `.proto` 文件，例如 `src/demo.proto`：

```proto
syntax = "proto3";
package demo;

message Player {
  string name = 1;
  int32 level = 2;
  repeated string items = 3;
  map<string, int32> scores = 4;
  bytes avatar = 5;
}
```

2. 启用本模块后按 F5：受控 `lingbuilder.protobuf.protoc` Provider 自动扫描项目 `**/*.proto`（排除 `generated/**` 与 `.lingbuilder-build/**`），递归解析本地 `import`，在 `generated/protobuf/` 生成每个消息的 `.pb.h`、`.pb.cc` 和整份 `descriptor.pb`；生成物进入构建、增量和可复制导出树。
3. 在 `.lcpp` 事件代码里加载 `descriptor.pb`，用消息类型全名（`包名.消息名`）创建反射句柄后调用。

## 调用方式

```lcpp
局部 句柄 描述集 = PB_加载描述集("generated/protobuf/descriptor.pb")
如果 描述集 != 0
    局部 句柄 消息 = PB_创建消息(描述集, "demo.Player")
    PB_从JSON(消息, "{\"name\":\"张三\",\"level\":9}")
    局部 字节集 编码 = PB_序列化为字节集(消息)
    ' ……把 编码 写进网络或文件……
    局部 句柄 还原 = PB_创建消息(描述集, "demo.Player")
    PB_从字节集解析(还原, 编码)
    调试输出(PB_到JSON(还原))
    PB_释放消息(消息)
    PB_释放消息(还原)
    PB_释放描述集(描述集)
否则
    调试输出(PB_取最后错误())
结束
```

路径相对 exe 工作目录；F5 构建会把 descriptor 生成物复制进运行目录，独立运行（双击 exe）时同理。描述集与消息句柄都是 `long long`，0 表示无效。

## 命令与返回值

9 条命令：

- 描述集（2）：`PB_加载描述集(路径)` `PB_释放描述集(描述集)`
- 消息（5）：`PB_创建消息(描述集, 类型名)` `PB_从字节集解析(消息, 数据)` `PB_序列化为字节集(消息)` `PB_释放消息(消息)`
- JSON 互转（1）：`PB_从JSON(消息, JSON)` `PB_到JSON(消息)`
- 诊断（1）：`PB_取最后错误()`

失败约定：返回句柄的命令失败返回 0；`PB_从字节集解析` / `PB_从JSON` 失败返回假且消息内容保持不变；所有失败都可用 `PB_取最后错误()` 读取当前线程的中文错误说明（JSON 转换失败时含 protoc 原始英文位置信息，便于定位字段错误）。

## 参数与返回值细节

- `PB_创建消息` 的类型名必须与 `.proto` 完整一致：带包名（`demo.Player`）、大小写敏感；嵌套消息写 `demo.Player.Inventory`。
- `PB_序列化为字节集` 返回正式 `字节集`，可直接传给 `网络_异步访问` 的请求体、`WebSocket客户端_发送` 或写入文件；`PB_从字节集解析` 接受任意来源的字节集。
- `PB_从JSON` / `PB_到JSON` 遵循 protobuf 官方 JSON 映射：字段名可用 `.proto` 原名或 camelCase；`bytes` 字段在 JSON 中是 Base64 文本；缺省字段不输出。JSON 必须是完整消息对象，不支持流式片段。
- 解析对未知字段宽容（保留但常规命令读不到）；描述集中的 import 依赖不完整或循环时 `PB_加载描述集` 明确失败。
- 同一描述集可并发创建多个消息句柄；句柄用完应释放，窗口关闭前未释放的句柄随进程退出回收。

## 模块会自动处理的构建细节

无需手工配置，构建管线自动为启用本模块的工程完成：

- SDK（protoc 27.3 + libprotobuf 27.3 双架构 + abseil）由安装包随附，IDE 打开工作区时自动铺设到 `<工作区>/.lingbuilder/toolchains/protobuf`，`runtime-manifest.json` 逐文件校验 SHA-256。
- 全部编译单元（含生成的 `.pb.cc`）注入 `PROTOBUF_USE_DLLS` / `ABSL_CONSUME_DLL`，链接 `libprotobuf.lib` + `abseil_dll.lib`，`libprotobuf.dll`、`abseil_dll.dll` 复制到 exe 同目录。
- 最低 `/std:c++17` 且全部配置使用动态 CRT，与 SDK 二进制一致。
- 项目里没有 `.proto` 文件时模块保持惰性，不阻断构建；启用模块但从未编写 `.proto` 时不会报 SDK 错误。

不联网下载工具，也不会调用 PATH 中的系统 protoc；SDK 组件版本与构建参数见 IDE 安装目录 SDK 内的 `NOTICE.md`。

## 完整示例

见 `docs/modules/protobuf/examples/basic.lcpp`：加载描述集 → 创建消息 → JSON 填充 → 字节集往返 → JSON 读回校验 → 逐层释放。

## 依赖和平台限制

- 仅支持 Windows（Win32 / x64，MSVC）；模块要求 Visual Studio Build Tools。
- descriptor 与生成代码随项目走：把工程复制给别人或导出 Visual Studio 工程时，生成物与 SDK 运行时一并携带，对方可直接编译。
- 单次序列化/解析上限约 2GB（int32 尺寸上限）；实际上限受 32 位进程地址空间约束。
