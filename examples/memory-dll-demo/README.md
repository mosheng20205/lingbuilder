# 内存加载 DLL 示例（内嵌不落盘）

> **想在 IDE 里打开就能用的版本？** 用自己的工作区/无头管线跑这个目录会看到空白默认项目（这里没有
> `.lingbuilder/projects/<id>/window-designer.json` 设计器模型，只是 CLI/冒烟用的最小工程）。
> 面向新手、打开即有窗口和按钮的示例在 `AI 视频自主生产/进阶方案/内存加载DLL演示/`。

演示 LingBuilder 的「内存加载 DLL」链路：把第三方 DLL 的字节在**构建期以内嵌资源打进 EXE**，
运行期在内存中手工完成 PE 映射（映射节区 → 基址重定位 → 填充导入表 → 注册 TLS → 调用入口函数），
再按导出名解析函数并调用。**exe 同目录自始至终不会出现这个 DLL 文件。**

对应易语言的用法：

```text
如果真 (加载sqlite)
    内存加载DLL (#sql_dll, "sqlite3_x86.dll", , 真)
```

## 目录结构

```text
memory-dll-demo/
  src/项目DLL命令.lcpp            ← 项目 DLL 命令声明（加载方式 = 内存）
  src/内嵌DLL内存加载演示.lcpp     ← 调用声明出来的中文命令
  src/dll/{x64,Win32}/memory_demo.dll  ← 由脚本构建生成（不入库）
  third-party-dll-src/memory_demo.cpp  ← 演示用第三方 DLL 源码
  third-party-dll-src/build-memory-demo-dll.cmd
  designer/memory-dll-demo.json   ← 窗口设计器模型
  build-request.json              ← 无头构建请求（CLI / AI Bridge 用）
```

## 使用步骤

1. 构建演示 DLL（需要 MSVC，脚本会自己调用 vcvarsall）：

   ```bat
   examples\memory-dll-demo\third-party-dll-src\build-memory-demo-dll.cmd examples\memory-dll-demo\src\dll
   ```

   产物：`src/dll/x64/memory_demo.dll`、`src/dll/Win32/memory_demo.dll`。

2. 在 IDE 里打开该项目（`sourceRoot` 指到 `examples/memory-dll-demo/src`），并在
   「项目模块」中启用 **内存加载DLL模块**（`lingbuilder.advanced.memorydll`）。
   缺少该模块时构建会给出中文阻断诊断，不会静默降级。

3. 按 F5 构建运行：窗口创建完毕事件会调用内嵌 DLL 的导出函数，并把结果写入
   `.lingbuilder/memory-dll-demo-result.txt`。构建日志里会打印
   「已内嵌内存加载 DLL（x64，资源号 2201）：memory_demo.dll → 不复制到 exe 目录」。

## 声明写法

```text
DLL命令库 MemoryDemo
  x64 = "dll/x64/memory_demo.dll"
  Win32 = "dll/Win32/memory_demo.dll"
  加载方式 = 内存

  整数型 内存演示_加法(整数型 甲, 整数型 乙) = memo_add
结束DLL命令库
```

- 每行一条导出声明，`= 导出名` 是可选的真实导出名（省略时命令名即导出名）。
- 勾选「内存加载」等价于写入 `加载方式 = 内存`；不写该行时行为不变（DLL 复制到 exe 同目录 + 生成导入库）。
- 单次构建最多内嵌 8 个 DLL，单个不超过 32MB。

## 命令行直用（不写声明）

需要自己控制加载时机时，直接用「内存加载DLL模块」的命令：

```text
局部 长整数型 缓冲区 = 缓冲区_从文件("data/memory_demo.dll")
局部 字节集 数据 = 缓冲区_到字节集(缓冲区)
局部 长整数型 模块地址 = 内存DLL_加载(数据, "memory_demo.dll")
局部 长整数型 函数地址 = 内存DLL_取函数地址(模块地址, "memo_add")
调试输出(内存DLL_取错误信息())
```

`内存DLL_取函数地址` 返回的是裸地址，中文代码不能直接调用它；请配合「项目 DLL 命令声明」
（声明即调用）或把它传给其它接收函数指针的原生命令。

## 必须知道的边界（实测结论）

| 项 | 说明 |
|---|---|
| 模块不在系统模块链表 | `GetModuleHandleW("memory_demo.dll")` 查不到内存加载的模块（示例里 `内存演示_自路径` 返回 0 就是这件事），依赖自身模块句柄定位资源的 DLL 会失败 |
| 位数必须一致 | x64 程序只能加载 x64 DLL；不一致在**构建期**就被中文诊断拦下 |
| 不支持加壳 DLL | `过文件校验 = 真` 会识别 UPX 等常见加壳段名并明确失败 |
| 不要依赖 C++ 异常 | 手工映射模块的 MSVC `throw/catch` 不会被派发（x64 会以未处理异常终止进程）；`__try/__except` 在 x64 可用、Win32（WOW64）不可用。需要异常机制的 DLL 请改用「同目录加载」 |
| 卸载只注销不释放 | `内存DLL_卸载` 注销后同一虚拟名可重新加载，但映像内存保留到进程退出：静态 CRT 登记的线程局部存储回调仍指向该映像 |
| 杀软敏感性 | 内存中加载未签名 PE 属于敏感行为，请只加载你自己信任的 DLL |

实现细节与完整限制见 `electron/docs/modules/memorydll/README.md`。
