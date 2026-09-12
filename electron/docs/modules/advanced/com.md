# COM自动化模块使用说明（2.0）

COM自动化模块（`lingbuilder.advanced.com`，v2.0.0）以句柄制提供 Windows COM 自动化完整闭环：注册或免注册创建 `IDispatch` 自动化对象、在窗口内宿主 ActiveX/OCX 控件、挂接并映射 COM 事件到中文处理器、类型化属性读写与带参方法调用，以及接口信息查看。运行时为纯 C++（标准 COM 调用，无内联汇编），随工程同时支持 32 位（windows-msvc-win32）与 64 位（windows-msvc-x64）目标；**加载进程内 OCX/DLL 时受组件自身位数约束，详见「32 位与 64 位」一节**。

该模块属于高级/高风险模块：启用前请确认确有 COM 自动化需求；不得由 AI 在未说明风险时自动启用。

## 创建与释放

所有 COM 对象通过 64 位句柄使用，支持多对象并存；句柄 `0` 表示创建失败，可用 `COM_取错误()` 查看中文原因。

```text
长整数型 对象 = COM_创建对象("Shell.Application")
长整数型 文件系统 = COM_创建对象免注册("{0D43FE01-F093-11CF-8940-00A0C9054228}", "C:\Windows\System32\scrrun.dll")
逻辑型 成功 = COM_关闭(对象)
COM_关闭全部()
```

- `COM_创建对象(ProgID)`：通过注册表创建（进程内或进程外组件均可）。
- `COM_创建对象免注册(CLSID, 组件DLL路径)`：`LoadLibrary` + `DllGetClassObject` + `IClassFactory::CreateInstance`，不写注册表。组件 DLL 在对象存活期间保持加载；对象释放后由系统回收。
- `COM_关闭(对象)` 释放单个对象（含其 OCX 宿主窗口与事件挂接）；`COM_关闭全部()` 释放全部，窗口销毁时生成器会自动调用。
- `COM_取对象属性` / `COM_调用对象方法` / `COM_取事件对象参数` 返回的是**新的** COM 句柄，不再需要时必须 `COM_关闭` 释放。

**位数边界**：进程内组件（DLL/OCX）的位数必须与程序位数一致，否则加载失败并给出中文诊断。完整说明、构建目标差异与排查顺序见下文「32 位与 64 位」一节。

**未注册控件的回退陷阱（已防护）**：AtlAxWin 在目标控件未注册时会**静默回退创建一个 WebBrowser 并把你传入的类标识当 URL 导航**，界面上表现为「无法访问此页」，极易被误判为控件创建成功。`COM_创建OCX组件` 现在会在创建后用 `IPersist::GetClassID` 核对实际控件，与请求的类标识不一致时销毁该窗口并返回中文诊断（提示先用 `COM_注册组件` 注册，或该组件为 32 位不能被 64 位程序加载），不会把回退控件当成功结果交出去。

## 32 位与 64 位（重要）

**模块本身双架构**：运行时是纯 C++（标准 COM 调用，无内联汇编、无指针宽度假设），随 `windows-msvc-win32` 与 `windows-msvc-x64` 两个 target 用同一份源码编译，32/64 位都可用。**限制来自你加载的组件，不是模块。**

### 硬约束

**进程内组件（DLL/OCX）的位数必须与程序位数一致**：

- 32 位程序只能加载 32 位组件，64 位程序只能加载 64 位组件；反过来一律失败。
- 不匹配时命令返回失败，`COM_取错误()` 给出中文诊断（Windows 错误码 `ERROR_BAD_EXE_FORMAT` 会命中「组件位数与程序位数不匹配」分支）。
- **进程外组件不受此限制**：`COM_创建对象(ProgID)` 对 LocalServer 类型的自动化对象（如 `Word.Application`、`Excel.Application`）由系统按位数自行桥接，32/64 位程序都能创建。
- 只有**进程内**的才受限：`COM_创建对象免注册(CLSID, DLL路径)`、`COM_创建OCX组件`、`COM_注册组件` 加载的都是进程内组件。

### 构建目标怎么定

| 构建方式 | 默认架构 | 说明 |
|---|---|---|
| IDE F5 | **Win32（32 位）** | 走 `Debug\|Win32` 配置，产物在 `.lingbuilder-build/<项目>/Win32/Debug/` |
| CLI `project build` | **x64** | 按本机编译器探测（PATH 里有 `cl` 就判 x64） |

**IDE 里可以在状态栏的「构建架构」下拉框切换 Win32 / x64**（与「构建模式」Debug/Release 并排），切换后 F5 即按所选架构构建；CLI 则用 `--arch win32`。

因此**同一个项目在 IDE 里能加载 32 位 OCX、用 CLI 构建却报位数不匹配**——这不是缺陷，是两条链路默认架构不同。CLI 需要 32 位时显式传 `--arch win32`：

```bash
node dist/cli.cjs project build --request <request.json> --workspace <工作区> --arch win32 --yes --json
```

特别注意 `.lingbuilder-build` 下的产物路径含架构层（IDE 是 `<项目>/Win32/Debug/bin/`，CLI 是 `<项目>/bin/`），两者互不覆盖，验证时要看清跑的是哪一个。

### 怎么判断一个 OCX/DLL 是多少位

- 让程序去加载它，看 `COM_取错误()` 的诊断（推荐，最省事）。
- 查看 PE 头 `Machine` 字段：`0x14C` = x86(32 位)，`0x8664` = x64。
- 常见的 32 位组件：`ccrpftv6.ocx`（CCRP FolderTreeview）、`FoxitReader_AX_Pro.ocx`、`MSScriptControl.ScriptControl`、多数 VB6/Thunder 系控件。
- 常见的双架构组件：`scrrun.dll`（FileSystemObject，System32 与 SysWOW64 各有一份）、`Shell.Application`（进程外）。

### 排查顺序

1. 先看 `COM_取错误()` 的中文诊断——位数不匹配会明确提示，不要凭猜测改代码。
2. 若组件是 32 位，把构建切到 32 位（CLI 加 `--arch win32`；IDE 默认已是 Win32）。
3. 若必须出 64 位程序却只能拿到 32 位组件，唯一出路是换 64 位组件或改用进程外组件——**没有别的办法**，进程内组件无法跨位数加载。
4. 组件文件不存在时也会报明确路径，注意随项目分发的组件应放 `assets/`（见下节）。

## 属性与方法

```text
调试输出(COM_取文本属性(浏览器, "LocationName"))
COM_置文本属性(对象, "Language", "VBScript")
小数型 顶边 = COM_取数值属性(浏览器, "Top")
逻辑型 忙 = COM_取逻辑属性(浏览器, "Busy")
COM_调用方法(浏览器, "Navigate2", 地址编辑框.内容)
文本型 结果 = COM_调用文本方法(文件系统, "BuildPath", "C:", "a.txt")
逻辑型 存在 = COM_调用逻辑方法(文件系统, "FolderExists", "C:\Windows")
长整数型 文件夹 = COM_调用对象方法(文件系统, "GetFolder", "C:\Windows")
```

带参调用支持整数、长整数、双精度小数、逻辑值和文本参数，按值传入并自动包装为 VARIANT；调用失败时返回失败值并用 `COM_取错误()` 查看原因（常见为「未找到 COM 成员」）。

### 属性写（COM_置文本属性）详解

```text
COM_置文本属性(对象, "Language", "VBScript")
```

- **内部机制**：以 `DISPATCH_PROPERTYPUT` 调用 `IDispatch::Invoke`，值按 `VT_BSTR` 传入。组件侧的 `DispInvoke` 会自动做类型转换——目标属性是数值、逻辑或日期时，会先尝试把文本转成对应类型再写入，所以文本可以直接写大多数可写属性。
- **只读属性写不进去**：调用返回假，`COM_取错误()` 给出组件返回的 HRESULT；属性名拼错则是「未找到 COM 成员」。
- **数值属性同样用它写**：传 `"123"` 即可，组件自动转成数值类型；只有极少数严格组件拒绝 BSTR 写入（返回类型转换失败），此时才需要数值形态的专用写命令（当前版本未提供，遇到时用带参调用该组件的对应方法替代）。
- **写子对象的属性**：先 `COM_取对象属性(浏览器, "Document")` 取出子对象句柄，再对子句柄 `COM_置文本属性(文档, "title", "新标题")`——页面标题会真实变化。用完 `COM_关闭(文档)`。
- **写事件带来的对象的属性**：`COM_取事件对象参数(序号)` 取回的句柄同样支持 `COM_置文本属性`（例：WebBrowser 的 `DocumentComplete` 事件里改文档 `title`）。
- **写不回的特例**：`ReadyState`、`Busy` 这类运行状态属性是只读的，写入必然失败；`LocationName`、`LocationURL` 也是只读。
- **验证写入是否成功**：写完立刻用对应 `COM_取*属性` 读回来对比，读写一致才确认生效。

## OCX 控件窗口宿主

```text
长整数型 浏览器窗口 = COM_创建OCX组件(当前窗口, "{8856F961-340A-11D0-A96B-00C04FD705A2}", 12, 64, 620, 380, 1)
长整数型 浏览器 = COM_取OCX对象(浏览器窗口)
COM_启用OCX消息转发()
```

- 宿主基于系统 `atl.dll` 的 AtlAxWin 机制动态加载，不引入额外链接依赖。
- `父窗口` 参数使用裸控件名或 `当前窗口`（controlRef 语义，不要加引号）。
- 边框：0 无边框、1 凹入式、2 凸出式、3 浅凹入式、4 镜框式、5 单线边框。
- `COM_启用OCX消息转发()` 安装当前线程 `WH_GETMESSAGE` 钩子，把键盘和鼠标消息沿父窗口链转发（`WM_FORWARDMSG`），让 OCX 收到快捷键；沿链转发到第一个声明处理的窗口即停。`COM_移除OCX消息转发()` 卸载钩子。

## 组件动态注册与注销（绿色免安装）

```text
' 组件放项目 assets/<项目ID>/ 下，构建时自动复制到 exe 旁（推荐）
文本型 组件 = COM_取组件路径("assets/foxit-reader-demo/FoxitReader_AX_Pro.ocx")
COM_注册组件(组件)
' …创建 OCX、使用…
COM_注销组件(组件)
```

- `COM_注册组件(路径)` 调用组件的 `DllRegisterServer`，`COM_注销组件(路径)` 调用 `DllUnregisterServer`；注册/注销是持久系统操作，完成后模块立即释放 DLL 引用。
- `COM_取组件路径(文件名)` 返回当前 exe 所在目录与文件名拼接的完整路径，用于随程序携带的组件定位（可传相对子目录，如 `assets/<项目ID>/x.ocx`）。
- 典型流程（对应易语言 FoxitReader 例程）：启动后注册 → 使用 → 退出前注销，系统注册表不留残留。注册需要写注册表权限；权限不足时命令失败并给出中文错误，此时应以管理员运行或改用免注册创建。
- 组件位数必须与程序位数一致（见上文「32 位与 64 位」）。
- **OCX/DLL 随项目分发的推荐做法**：放在项目 `assets/<项目ID>/` 目录下，构建时会把该目录整体复制到 exe 旁（`bin/assets/<项目ID>/`），源码用 `COM_取组件路径("assets/<项目ID>/xxx.ocx")` 取绝对路径，无需手工拷贝或写死路径。注意不要手工往 `.lingbuilder-build/` 里塞文件——该目录每次构建都会重建。
- **OCX/DLL 随项目分发的推荐做法**：放在项目 `assets/<项目ID>/` 目录下，构建时会把该目录整体复制到 exe 旁（`bin/assets/<项目ID>/`），源码用 `COM_取组件路径("assets/<项目ID>/xxx.ocx")` 取绝对路径，无需手工拷贝或写死路径。

## 事件挂接与映射

```text
整数型 事件句柄 = COM_挂接事件(浏览器)
COM_映射事件(浏览器, 102, &网页_状态文本改变, 0)
```

处理器必须使用 `&处理器名` 引用，签名固定为：

```text
空 网页_状态文本改变(整数型 用户数据, 文本型 参数文本)
```

- `参数文本` 把事件参数按自然顺序用制表符拼接：文本、数值、逻辑值都转成文本；对象类型参数显示为 `[COM对象]` 占位。
- 需要对象参数时，在处理器内调用 `COM_取事件对象参数(序号)`（从 0 开始）取回新的 COM 句柄，例如目录树控件的 Folder 对象：

```text
空 目录树_选中改变(整数型 用户数据, 文本型 参数文本)
    长整数型 文件夹 = COM_取事件对象参数(0)
    调试输出(COM_取文本属性(文件夹, "FullPath"))
    COM_关闭(文件夹)
结束
```

- 事件在窗口线程按消息队列顺序回调，处理器内可安全更新界面控件。
- `COM_挂接事件` 会 Advise 对象暴露的**全部**连接点，兼容多个事件源接口的控件；`COM_取消挂接事件(对象, 事件句柄)` 一次解除全部挂接并清除映射。
- 事件 ID（DISPID）可用 `COM_取接口信息(对象)` 查询。
- **VB6/Thunder 系控件（如 CCRP FolderTreeview）的事件接口校验**：这类控件在 `IConnectionPoint::Advise` 时会先按**事件接口标识（DIID）**查询事件接收器，而不是只查 `IID_IDispatch`。模块的事件接收器现已登记连接点声明的 DIID 并在 `QueryInterface` 中一并接受，因此这类控件的事件可以正常挂接（实测 CCRP FolderTreeview：`SelectionChange`=4、`FolderClick`=1、`Collapse`=2、`Expand`=3 全部回调成功，事件对象参数可正常取回 Folder 对象并读 `FullPath`）。若 `COM_挂接事件` 返回 0，`COM_取错误()` 会给出具体失败的 Advise HRESULT 与事件接口 GUID，便于定位。

## 接口信息查看

```text
调试输出(COM_取接口信息(浏览器))
```

返回多行文本：类型名、GUID，以及属性、方法、事件三个分区（每行一个成员，含 DISPID、**返回类型、参数名、参数类型与标志**（出参/可省略/默认值））。示例：

```text
类型：IWebBrowser2
GUID：{D30C1661-CDAF-11D0-8A3E-00C04FC9E26E}
属性：
  属性读 ReadyState(-525) : 整数 (plReadyState:tagREADYSTATE)
  属性写 Offline(550) (pbOffline:逻辑)
方法：
  方法 Navigate2(500) : 无返回 (URL:变体, Flags:变体, TargetFrameName:变体, PostData:变体, Headers:变体)
事件：
  事件 StatusTextChange(102) (Text:文本)
```

通过 `IDispatch::GetTypeInfo` / `IProvideClassInfo` 读取，事件接口经连接点 DIID 在类型库中定位。对象未提供类型信息时返回说明文本。这是「先看有什么、再写映射」的推荐工作流。注意两点：① 参数类型按 COM 类型库显示（变体/文本/对象等），接口类型会解析为接口名；② 部分对象（如 Shell.Application）的类型库只声明新增成员，继承成员不会全部列出，属组件自身行为。

## 平台限制

- 仅 Windows；模块双架构（见「32 位与 64 位」），但**进程内组件受组件自身位数约束**。
- 事件处理器只能在窗口类内声明（与多线程模块处理器一致）；函数库中的函数不能作为 COM 事件处理器。
- 高频事件（如鼠标移动）会按消息队列排空节奏回调；如需合并节流，请在处理器内自行处理。
