# FBro 升级 SDK

本文档说明 FBro 上游 SDK 升级后，LingBuilder 工程中需要同步的文件、目录和验证步骤。

## 一、只升级 FBro SDK 资产

FBro SDK 应作为一整套 Windows x64 资产更新，不要只替换某一个 DLL。受管 SDK 目录为：

```text
%APPDATA%/LingBuilder/sdk-cache/modules/lingbuilder.fbro.sdk/sdk/
```

开发工作区如果存在本地模块副本，对应目录为：

```text
.lingbuilder/modules/lingbuilder.fbro.sdk/
```

需要替换的内容如下：

| 目录 | 需要替换的内容 | 说明 |
| --- | --- | --- |
| `sdk/include/` | 全部 FBro/CEF 头文件（`*.h`、`*.hpp`） | 不要只替换单个头文件，声明与库必须同版本。 |
| `sdk/lib/x64/` | 全部 x64 导入库或静态库（`*.lib`） | 必须与运行时 DLL、头文件匹配。 |
| `sdk/runtime/x64/` | 全部运行时 DLL、`FBroSubprocess.exe`、CEF 资源和 `locales` | 包括 `FBrowserVIP.dll`、`FBrowserCEF3lib.dll`、`libcef.dll`、`chrome_elf.dll`、`v8_context_snapshot.bin`、`.pak` 等整组文件。 |
| `sdk/bridge/x64/` | `LingBuilderFbroBridge.dll` 和对应 `.lib` | SDK ABI、头文件或 Bridge 有改动时，必须用新 SDK 重建并替换。 |
| 模块根目录 | `lingbuilder.module.json`、SDK 版本和哈希元数据、README | 版本、支持平台和文件校验信息必须与实际资产一致。 |

### 必须成套替换的运行时文件

以下文件必须来自同一套 FBro 发布包：

- `FBrowserVIP.dll`
- `FBrowserCEF3lib.dll`
- `libcef.dll`
- `chrome_elf.dll`
- `FBroSubprocess.exe`
- `v8_context_snapshot.bin`
- CEF 的 `.pak` 资源文件和 `locales/` 目录

只替换 `FBrowserVIP.dll` 或只替换 `libcef.dll`，可能导致启动、创建浏览器或 VIP 授权阶段崩溃。

## 二、SDK 更新后的正确流程

1. 准备新的 FBro Windows x64 SDK 压缩包，并记录新版本、文件大小和 SHA-256。
2. 将新的 `include`、`lib/x64`、`runtime/x64`、`bridge/x64` 资产同步到受管的 `lingbuilder.fbro.sdk` 模块目录。
3. 更新模块清单中的版本、平台、关键文件清单和 SHA-256 元数据。
4. 对 DLL、`.lib`、头文件和压缩包执行 SHA-256 校验，确认不是旧产物或混合版本。
5. 重新执行原生预览、F5 构建或工程导出，让 LingBuilder 从受管 SDK 目录重新物化构建依赖。
6. 通过 FBro 原生 smoke 测试，至少确认宿主启动、浏览器创建、页面加载和正常退出。

## 三、如果同时修改了 LingBuilder Bridge

如果更新的不只是上游 SDK，还修改了仓库中的 Bridge 源码 `electron/native/fbro-bridge/`，还必须执行以下步骤：

1. 使用新 SDK 重新编译 `LingBuilderFbroBridge.dll`。
2. 将 DLL 与 `.lib` 同步到：

   ```text
   .lingbuilder/modules/lingbuilder.fbro.sdk/sdk/bridge/x64/
   ```

3. 将对外头文件同步到：

   ```text
   .lingbuilder/modules/lingbuilder.fbro.sdk/sdk/include/
   ```

4. 比较 Bridge DLL、导入库和头文件的 SHA-256，确认 SDK 模块中已经是新产物。
5. 重新生成工程，并重新导出 `.lcpppkg` 或 Visual Studio 工程。

只修改 `electron/native/fbro-bridge/` 下的源文件是不够的。构建使用的是从 SDK 模块复制到构建目录中的副本；只改源文件而不同步 SDK 模块，编译器看不到修改。

## 四、不应手动替换的目录

以下目录是构建或导出时生成的副本，不是 SDK 的权威来源：

- `.lingbuilder-build/`
- `generated/cpp/`
- 已导出工程中的 `modules/` 目录

SDK 更新后不要只在这些目录中替换文件。应先更新受管的 `lingbuilder.fbro.sdk` 模块，再重新生成工程，否则下一次构建会覆盖手工修改。

## 五、发布和按需下载注意事项

- FBro SDK 的大型 `sdk/` 资产不随 LingBuilder 安装包内置，用户首次使用 FBro 模块时由 SDK 依赖服务下载并安装。
- 新 SDK 必须使用新的版本化压缩包文件名和 URL，不能在旧 URL 下静默替换内容。
- 下载包必须校验精确文件大小和完整 SHA-256，校验通过后才能解压和安装。
- 解压完成后必须校验模块清单和关键文件，并通过临时目录原子切换安装。
- 不要在 React 组件、C++ 生成器或临时脚本中另写下载和版本判断逻辑，应复用 SDK 依赖服务。

相关实现位置：

- `electron/src/services/sdkDependencies/sdkDependencyCatalog.ts`
- `electron/src/services/sdkDependencies/sdkDependencyService.ts`
- `electron/src/services/sdkDependencies/sdkDependencyClient.ts`
- `electron/scripts/verify-fbro-release-sdk.cjs`
- `FBro与CEF3_SDK按需下载资源.md`

## 六、最小检查清单

- [ ] FBro SDK 版本、平台和 SHA-256 已更新。
- [ ] `sdk/include/`、`sdk/lib/x64/`、`sdk/runtime/x64/` 和 `sdk/bridge/x64/` 来自同一版本。
- [ ] `lingbuilder.module.json` 和关键文件哈希与实际资产一致。
- [ ] Bridge DLL、`.lib` 和头文件已同步到 SDK 模块目录。
- [ ] 未直接修改生成目录代替 SDK 模块更新。
- [ ] 已重新生成原生工程并完成 FBro 启动、浏览器创建、页面加载和退出验证。
- [ ] 如需发布，已更新 SDK 下载清单、版本化 URL、文件大小和 SHA-256。
