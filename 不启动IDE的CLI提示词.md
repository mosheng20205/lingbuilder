# 不启动 IDE 的 CLI 提示词

将下面的提示词直接粘贴到已配置 LingBuilder MCP 的 Codex 桌面端任务中。任务应在项目根目录打开，并使用 `openInWorkbench=false` 保持无 IDE 模式。新手可先运行 `tools/codex-configurator/build/LingBuilderCodexConfigurator.exe`，选择工作区和权限后再打开 Codex。

```text
你现在通过 LingBuilder 的 MCP 工作在当前工作区，采用无 IDE 模式。

目标：
创建并完成一个中文 LingBuilder 项目。

项目名称：库存管理工具
项目 ID：inventory-tool
项目模板：hello-window
窗口标题：库存管理
功能要求：
1. 创建一个中文窗口
2. 增加“加载库存”按钮
3. 增加一个文本显示区域
4. 点击按钮后显示“库存加载完成”
5. 使用 LingBuilder 中文 DSL 编写 .lcpp
6. 最终完成诊断、编译，并返回生成的 exe 路径

必须遵守以下流程：
1. 先调用 lingbuilder.project.templates 确认模板。
2. 调用 lingbuilder.project.create，只做预览，不要立即写入。
3. 把创建计划、文件列表、模块依赖和目标路径展示给我。
4. 等我明确批准后，再调用 lingbuilder.project.create，并传 approved=true。
5. 创建时设置 openInWorkbench=false，不要尝试启动或控制 LingBuilder IDE。
6. 使用 lingbuilder.edit.propose 生成代码修改预览。
7. 得到批准后调用 lingbuilder.edit.apply。
8. 调用 lingbuilder.lingcpp.diagnostics，修复所有阻止构建的诊断。
9. 调用 lingbuilder.build.run，并传 approved=true。
10. 最后报告项目目录、修改文件、诊断结果、构建日志和 exe 路径。

限制：
- 只能使用 lingbuilder.* MCP 工具。
- 不要调用任意 shell，不要访问当前工作区之外的路径。
- 不要把设计器 JSON 只保存在聊天上下文中。
- 不要把 .lcpp 改写成普通 C++。
- 如果模块未安装或依赖不满足，先停止并说明原因。
- 在写文件、构建和运行前都必须经过明确批准。
```

执行顺序：

```text
lingbuilder.project.templates
lingbuilder.project.create（预览）
lingbuilder.project.create（approved=true）
lingbuilder.edit.propose
lingbuilder.edit.apply
lingbuilder.lingcpp.diagnostics
lingbuilder.build.run
```

该提示词适用于 Codex 桌面端通过项目级 `.codex/config.toml` 启动 LingBuilder 的 `--mcp --stdio-only` 服务，也适用于已连接同一 MCP 服务的其他 AI CLI。
