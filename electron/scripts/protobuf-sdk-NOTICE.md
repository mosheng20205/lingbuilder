# Protobuf SDK 27.3.0 来源说明

本目录是 LingBuilder 随安装包分发的固定版本 Protobuf SDK，服务于内置模块
`lingbuilder.data.protobuf`（受控代码生成器 `lingbuilder.protobuf.protoc`）。
目录整体随安装包进入 `resources/default-workspace/.lingbuilder/toolchains/protobuf`，
IDE 在打开工作区时自动铺设到 `<工作区>/.lingbuilder/toolchains/protobuf`。

本目录不随 Git 入库（`electron/third_party/` 在 .gitignore 内），与
`third_party/sqlite`、`third_party/mariadb` 同模式。换机器打包前需运行
`cd electron && npm run protobuf:prepare` 重建，再用 `npm run protobuf:manifest`
重新生成 `runtime-manifest.json`。

## 组件与来源

| 组件 | 版本 | 来源 | 说明 |
| --- | --- | --- | --- |
| `bin/protoc.exe` | 27.3 | 官方 `protoc-27.3-win64.zip`（GitHub Releases） | 宿主工具，x64 |
| `include/google/protobuf/**` | 27.3 | `protobuf-27.3.tar.gz` 的 `src/google/protobuf`（去除 .cc 与测试数据） | 与 DLL 严格同 tag |
| `include/absl/**` | 20240722.1 | `abseil-cpp-20240722.1.tar.gz`（去除 .cc 与测试数据） | protobuf 公共头会包含 absl 头 |
| `bin/<arch>/libprotobuf.dll` | 27.3 | 源码 CMake 构建 | 共享运行时 |
| `bin/<arch>/abseil_dll.dll` | 20240722.1 | 源码 CMake 构建（`ABSL_BUILD_MONOLITHIC_SHARED_LIBS`） | libprotobuf.dll 的唯一非系统依赖，文件名由导入表钉死，不可改名 |
| `lib/<arch>/libprotobuf.lib` | 27.3 | 同上构建产物 | 导入库（约 49MB，protobuf 有 3.3 万导出符号，属正常） |
| `lib/<arch>/abseil_dll.lib` | 20240722.1 | 同上构建产物 | 导入库，消费者必须与 libprotobuf.lib 一起链接 |

## 构建参数（MSVC，与 LingBuilder F5 生成工程对齐）

- VS 18 2026 工具集（v145），`-A x64` / `-A Win32` 双架构，Release，`/MD`（`CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL`）。
- **`CMAKE_CXX_STANDARD=17` 双侧钉死**：absl 在 C++14 与 C++17 下 `absl::string_view`
  是不同的 C++ 类型（自己的类 vs `std::string_view`）；DLL 若按 C++14 构建、消费者按
  C++17 编译，链接直接 LNK2019。LingBuilder F5 生成工程最低 `/std:c++17`。
- protobuf：`protobuf_BUILD_SHARED_LIBS=ON`、`protobuf_ABSL_PROVIDER=package`、
  `protobuf_BUILD_TESTS/OFF`、`protobuf_BUILD_PROTOC_BINARIES=OFF`（protoc 用官方包）、
  `protobuf_BUILD_LIBUPB=OFF`。
- abseil：`BUILD_SHARED_LIBS=ON` + `ABSL_BUILD_MONOLITHIC_SHARED_LIBS=ON`。

## 消费约定（构建管线已强制，列在这里备查）

1. 消费者编译必须定义 `PROTOBUF_USE_DLLS`（`materializeModuleNativeDependencies`
   经 `extraCompileDefines` 注入 F5 命令行，VS 导出经 vcxproj
   `PreprocessorDefinitions` 注入）。缺定义时链接能通过，但运行期 `Message::GetMetadata`
   等虚调用直接 AV（实测 0xC0000005）。
2. 消费者必须同时链接 `libprotobuf.lib` 与 `abseil_dll.lib`（absl 内联代码会引用
   `StatusRep::Unref` 等导出）。
3. 消费者最低 `/std:c++17`，且必须使用动态 CRT（模块物化会置
   `requiresDynamicCrt`，Debug 配置也用 `/MD`，避免跨 DLL 传 `std::string` 时
   迭代器调试布局不一致）。
