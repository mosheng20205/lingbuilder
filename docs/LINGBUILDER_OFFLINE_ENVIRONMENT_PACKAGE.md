# LingBuilder 离线开发环境包方案

## 目标

为无法稳定访问互联网的学校、机房、企业内网和个人电脑提供可复制、可审计的 LingBuilder 离线安装方案。离线包只收录微软允许分发或由官方安装布局生成的组件，不把开发机上的 Visual Studio、SDK、注册表或临时缓存直接复制给用户。

## 建议交付结构

```text
LingBuilder-Offline-Environment-x64/
├─ LingBuilder-Setup-x64.exe
├─ installers/
│  ├─ WebView2/
│  │  └─ MicrosoftEdgeWebView2RuntimeInstallerX64.exe
│  └─ VisualStudioBuildTools/
│     ├─ vs_buildtools.exe
│     ├─ ChannelManifest.json
│     ├─ Catalog.json
│     └─ ...由 Visual Studio layout 生成的包文件
├─ config/
│  └─ LingBuilder.vsconfig
├─ scripts/
│  ├─ 安装核心开发环境.cmd
│  ├─ 安装WebView2.cmd
│  └─ 安装后检测.cmd
├─ SHA256SUMS.txt
└─ README-离线安装说明.md
```

## 组件边界

### LingBuilder 主程序

- Electron/Node 运行时随 LingBuilder 安装包提供，终端用户不需要另外安装 Node.js。
- 主程序在没有编译器时仍应允许打开、编辑和管理项目；仅生成、运行和依赖特定模块的功能受限。

### 微软 C++ 核心构建环境

离线布局应只包含 LingBuilder 需要的工作负载：

```text
Microsoft.VisualStudio.Workload.VCTools
```

创建布局的参考命令：

```bat
vs_buildtools.exe --layout D:\LingBuilder-VSLayout ^
  --lang zh-CN en-US ^
  --add Microsoft.VisualStudio.Workload.VCTools ^
  --includeRecommended
```

客户端离线安装参考命令：

```bat
vs_buildtools.exe --noWeb ^
  --add Microsoft.VisualStudio.Workload.VCTools ^
  --includeRecommended ^
  --passive --wait --norestart
```

该工作负载覆盖 MSVC、推荐 Windows SDK 和 CMake。实际发布前必须在干净 Windows x64 虚拟机验证组件清单；微软更新工作负载内容后，应重新生成布局，不能长期复用过期缓存。

### WebView2 Runtime

- 在线版 LingBuilder 安装器使用 Evergreen Bootstrapper。
- 离线包使用微软官方 Evergreen Standalone Installer x64，不依赖安装时联网。
- 安装前检测 WebView2 注册表；已经安装时跳过。
- WebView2 安装失败不应阻止 LingBuilder 本体启动，但 EdgeView 相关功能必须显示中文诊断。

### g++ 与 clang++

二者不是 LingBuilder 默认 MSVC 构建链路的必需依赖，不放入标准离线包。以后如提供 MinGW/LLVM 工具链，应作为独立高级扩展包，并分别记录来源、许可证、版本和 SHA-256。

## `.vsconfig` 建议

`config/LingBuilder.vsconfig` 用于记录经过验收的 Visual Studio 组件集合。第一版可使用工作负载级配置：

```json
{
  "version": "1.0",
  "components": [
    "Microsoft.VisualStudio.Workload.VCTools"
  ]
}
```

发布前应从一台干净机器导出并核对实际配置，必要时固定所需的 Windows SDK/CMake 组件；不要固定已经停止支持的工具集版本。

## 完整性与安全

1. 所有安装器必须来自微软官方 HTTPS 下载或官方 Visual Studio layout。
2. 生成 `SHA256SUMS.txt`，安装前校验每个可执行文件和布局清单。
3. 校验 Microsoft Authenticode 签名；签名无效时立即停止。
4. 安装脚本只允许执行文档中列出的固定安装器和固定参数，不接受用户拼接的命令。
5. 管理员权限由 Windows UAC 明确请求，不静默绕过。
6. 保存安装退出码和检测结果，但不收集用户名、工作区源码或机器敏感信息。

## 版本与发布流程

1. 选择 LingBuilder 发布版本和目标 Windows 架构。
2. 下载最新 Visual Studio Build Tools Bootstrapper，创建限定工作负载的离线 layout。
3. 下载对应架构的 WebView2 Evergreen Standalone Installer。
4. 在断网的干净 Windows 10/11 x64 虚拟机执行安装。
5. 运行 LingBuilder“环境修复中心 → 重新检测”。
6. 创建并编译普通 Win32 示例、资源文件示例、CMake 示例和 EdgeView 示例。
7. 验证生成 exe、WebView2 运行、中文路径、非管理员首次启动和重启后状态。
8. 生成哈希清单和版本记录后再发布离线包。

## 安装后的验收标准

- MSVC、Windows SDK/`rc.exe` 和 CMake 显示可用。
- LingBuilder 默认 Win32 项目可以生成、编译并运行。
- WebView2 Runtime 可用；EdgeView 示例能加载页面。
- g++、clang++ 缺失只显示普通可选状态，不产生警告。
- 没有任何警告时，自检结束语为“核心开发环境已全部就绪”。
- 卸载 LingBuilder 不删除用户项目，也不擅自卸载共享的 Visual Studio Build Tools 或 WebView2 Runtime。

## 维护建议

- 在线安装包保持小体积；离线环境包作为单独下载项发布。
- 每个离线包名称包含 LingBuilder 版本、生成日期、架构和 VS 工具链主版本。
- 企业环境优先把 Visual Studio layout 放在内部文件服务器，通过管理员统一更新。
- 至少每季度检查 Visual Studio Build Tools、Windows SDK 和 WebView2 安全更新；出现高危安全更新时立即重建离线包。
