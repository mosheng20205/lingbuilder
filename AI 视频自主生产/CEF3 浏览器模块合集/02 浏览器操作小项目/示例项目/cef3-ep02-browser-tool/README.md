# CEF3 浏览器操作小项目

对应 CEF3 浏览器模块合集第 02 集《CEF3 浏览器操作小项目》。

## 打开与运行

1. 把 `示例项目/` 下的整个项目文件夹复制到一个纯 ASCII 路径的工作区（例如 `D:\lb-demo\`）。
2. 在 LingBuilder 中打开 `.lingbuilder/solution.json`。
3. 确认模块面板已启用：`lingbuilder.win32.basic`、`lingbuilder.cef3.browser`。
4. 按 F5 构建运行，确认错误列表为 0。

## 本集命令

- `CEF3_导航`
- `CEF3_后退`
- `CEF3_前进`
- `CEF3_刷新`
- `CEF3_强制刷新`
- `CEF3_停止`
- `CEF3_执行缩放`
- `CEF3_设置缩放级别`
- `CEF3_取缩放级别`
- `CEF3_执行JS`
- `CEF3_取标题`
- `CEF3_取地址`

## 运行边界

- 缩放命令的合法取值只有 0（缩小）、1（重置）、2（放大）；传其它值会被 Bridge 拒绝。
- 重置按钮使用 CEF3_设置缩放级别(浏览器1, 0.0)，0.0 表示 100% 原始比例。
- 离线录制时把地址栏改成 assets/home.html 的 file:/// 绝对路径，后退/前进用 home ↔ second 两页演示。

## 前置条件

- Windows x64 + Visual Studio / MSVC 工具链。
- 已安装并通过 SHA-256 校验的 `lingbuilder.cef3.sdk`。
- 构建产物 `bin/` 目录需包含 `libcef.dll`、`chrome_elf.dll`、`LingBuilderCefBridge.dll`、`resources.pak`、`icudtl.dat` 与 `locales/` 等 CEF 运行时资源。

## 命令行构建

每个示例项目本身就是一个工作区，需要能找到已安装的 CEF3 SDK（`.lingbuilder/modules`）。
仓库提供的构建脚本会把项目复制到 `.tmp-cef3-verify/` 再构建，顺带用目录联接共享 SDK，
并且把体积很大的构建产物挡在示例目录之外：

```powershell
cd electron
npm run build:cli
npm run tutorial:cef3:build
```

也可以原地构建（路径含中文没有影响，实测通过），只要先把 SDK 联接进本项目工作区：

```powershell
cd "<本项目目录>/.lingbuilder"
cmd /c mklink /J modules T:electronlingbuilder.lingbuildermodules
cd T:electronlingbuilderelectron
node dist/cli.cjs project build --request "<本项目目录>/build-request.json" --workspace "<本项目目录>" --yes --json
```

> mklink 的目标路径不要加引号，加了会生成一个坏联接。

> `build-request.json` 刻意不写 `lingCppSourceFilePath`：一旦写了，CLI 只会把那一个文件当作权威源码，`src/项目全局变量.lcpp` 不会参与聚合。
