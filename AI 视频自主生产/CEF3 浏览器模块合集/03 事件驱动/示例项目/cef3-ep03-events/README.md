# CEF3 事件驱动示例

对应 CEF3 浏览器模块合集第 03 集《CEF3 事件驱动 · 加载完成与事件数据》。

## 打开与运行

1. 把 `示例项目/` 下的整个项目文件夹复制到一个纯 ASCII 路径的工作区（例如 `D:\lb-demo\`）。
2. 在 LingBuilder 中打开 `.lingbuilder/solution.json`。
3. 确认模块面板已启用：`lingbuilder.win32.basic`、`lingbuilder.cef3.browser`。
4. 按 F5 构建运行，确认错误列表为 0。

## 本集命令

- `CEF3_绑定事件`
- `CEF3_取最近事件`
- `CEF3_取事件数据`
- `CEF3_取事件字段`
- `CEF3_是否加载中`

## 运行边界

- 事件实名以事件目录为准：开始加载 / 加载完成 / 加载失败 / 加载状态改变；不要写成「加载开始」或「加载错误」。
- CEF3_取事件字段 返回的是文本快照，字段缺失时返回空文本，不会抛出异常。
- 决策类事件的 CEF3_设置事件结果 在第 05 集演示，本集只做通知类事件。

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
