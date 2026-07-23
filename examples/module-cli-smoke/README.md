# 新增模块 CLI 冒烟测试

该项目通过 LingBuilder CLI / AI Bridge 验证本轮新增的 51 个模块：

- 项目引用中启用全部新增模块，验证模块扫描、启用状态和 C++ 运行时注入。
- `.lcpp` 包含普通中文模块命令，验证诊断和 `bindings.commands` 映射。
- CLI 执行诊断、原生预览、导出、构建和运行。
- 运行时执行文本、编码、数学、时间、正则、JSON、XML、文件、INI、系统、磁盘、进程、显示器、DNS、URL、Cookie、CSV、哈希、DPAPI、SQLite 错误边界、图像颜色、受控内存和 CPU 等确定性测试。
- 网络客户端、输入模拟、注册表、跨进程内存、Hook、COM、驱动、托盘、音频等有外部依赖或副作用的模块只验证启用、生成和编译，不在冒烟程序中触发。

运行命令（在 `electron` 目录）：

```powershell
node dist/cli.cjs project diagnose --workspace .. --request ../examples/module-cli-smoke/project-request.json --json
node dist/cli.cjs project export --workspace .. --request ../examples/module-cli-smoke/project-request.json --yes --json
node dist/cli.cjs project build --workspace .. --request ../examples/module-cli-smoke/project-request.json --yes --json
```

一次性 `project run` 会在 CLI 命令退出时回收其受控子进程，适合验证启动但不保证程序有时间写完运行报告。完整运行期验收应启动长驻 Bridge：

```powershell
node dist/cli.cjs ai-server --workspace .. --host 127.0.0.1 --port 17863 --token module-cli-smoke-local --permission preview

$body = Get-Content ../examples/module-cli-smoke/project-request.json -Raw -Encoding UTF8
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:17863/api/ai-bridge/build/run `
  -Headers @{ Authorization = 'Bearer module-cli-smoke-local' } `
  -ContentType 'application/json; charset=utf-8' `
  -Body $body
```

运行报告生成在 `.lingbuilder-build/module-cli-smoke/bin/module-cli-smoke-report.txt`。