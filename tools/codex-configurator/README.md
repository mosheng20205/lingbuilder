# LingBuilder Codex 一键配置器

这是一个独立的 Windows C++ 配置器，面向不熟悉命令行的用户。它不启动 LingBuilder IDE，只负责为指定工作区配置 Codex 桌面端的项目级 MCP。图形界面使用项目内的 `New_Emoji` x64 DLL，默认显示圆角深色标题栏、白色面板和中文权限选择界面。

## 功能

- 原生选择工作区目录。
- 权限三选一：只读 `readonly`、预览确认 `preview`（默认）、受控自动执行 `yolo`。
- 自动探测开发版运行时和安装版 `LingBuilder.exe`。
- 写入 `.codex/config.toml` 的托管配置段。
- 保留用户其它 TOML 配置；发现同名非托管 MCP 时先弹窗确认。
- 使用临时文件和原子替换，避免写入半截配置。
- 可选配置完成后自动打开 Codex 桌面端。
- 支持 `--headless` 供脚本使用。
- 正式 GUI 通过 `new_emoji.dll` 渲染；DLL 必须与 EXE 放在同一目录。

## 编译

在 Windows 的 PowerShell 中运行：

```powershell
.\build.ps1
```

也可以使用 CMake：

```powershell
cmake -S . -B build
cmake --build build --config Release
```

编译需要 Visual Studio 的“使用 C++ 的桌面开发”工作负载、Windows SDK，以及 `.lingbuilder/modules/lingbuilder.new_emoji.ui` 中的 x64 `new_emoji.lib` 和 `new_emoji.dll`。

## 使用

双击 `build\\LingBuilderCodexConfigurator.exe`，选择工作区和权限后点击“一键配置”。配置完成后完全退出并重新打开 Codex 桌面端，Codex 会在该项目中按 `.codex/config.toml` 自动启动无 HTTP、无 Token 的 stdio MCP。

命令行模式示例：

```powershell
.\build\\LingBuilderCodexConfigurator.exe --headless --workspace "D:\\项目\\我的工作区" --permission preview
.\build\\LingBuilderCodexConfigurator.exe --headless --workspace "D:\\项目\\我的工作区" --permission yolo --force
.\build\\LingBuilderCodexConfigurator.exe --headless --workspace "D:\\项目\\我的工作区" --remove
```

`--headless` 遇到未托管的同名 MCP 配置时返回退出码 `5`，需要用户明确加入 `--force`；成功返回 `0`。配置器只写入当前工作区，不修改用户全局 Codex 配置。
