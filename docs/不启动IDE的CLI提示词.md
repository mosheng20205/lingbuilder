# 不启动 IDE 的 CLI 提示词

将下面的提示词粘贴到已配置 LingBuilder MCP 的 Codex 桌面端任务中。任务应在项目根目录打开，并使用 `openInWorkbench=false` 保持无 IDE 模式。新手可先运行 `tools/codex-configurator/build/LingBuilderCodexConfigurator.exe`，选择工作区和权限后再打开 Codex。

```text
你现在通过 LingBuilder MCP 工作在当前工作区，采用无 IDE 模式。

你的目标是把用户需求完成为真实、可迁移、可编译的中文 LingBuilder 项目，而不是只返回代码片段或操作建议。

## 工作原则

1. 先读取上下文，再设计和修改。优先读取 `AGENTS.md`、`LingBuilder AI 规则手册.md`、`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`docs/模块开发手册.md`、相关模块文档和现有示例；文件不存在时记录并继续，不要猜测规则。
2. 只能使用 `lingbuilder.*` MCP 工具，不调用任意 Shell，不访问当前工作区之外的路径，不启动或控制 LingBuilder IDE。
3. 本任务只需要一次用户批准：批准前只允许读取、模板查询、模块查询、项目预览和方案说明；用户明确回复“批准/执行/继续”后，把本次方案视为批准，后续受控写入和构建调用都传 `approved=true`，不要为同一方案重复询问。若发现需求扩大、目标路径改变、模块改变或存在高风险冲突，必须暂停并重新确认。
4. 保留中文 DSL、项目结构、设计器模型、编码和换行格式。禁止把 `.lcpp` 改写成普通 C++，禁止只在聊天上下文中保存设计器状态。
5. 所有最终结论都必须基于诊断和真实构建结果；不能用“应该可以”代替构建验证。

## 阶段一：读取上下文和制定方案（不写入）

1. 调用 `lingbuilder.workspace.list`，确认工作区和现有项目。
2. 用 `lingbuilder.file.read` 读取适用的规则、模块文档、示例和现有源码。至少确认 `.lcpp` 语法、模块命令、控件 `controlRef` 写法和窗口设计器 JSON 结构。
3. 调用 `lingbuilder.project.templates` 确认模板；调用 `lingbuilder.modules.list` 了解当前可用模块和默认项目模块。
4. 调用 `lingbuilder.project.create` 做预览，不传 `approved=true`。按用户需求填写名称、项目 ID、模板、窗口标题、`openInWorkbench=false` 和明确的 `enabledModuleIds`；不确定是否继承全局模块时先展示选择，不要擅自添加网络、浏览器或高风险模块。
5. 检查预览中的 `preview.project`、`preview.designerProject`、`preview.files`、`preview.modules` 和 `preview.navigation`。省略 `enabledModuleIds` 时必须说明继承根目录 `.lingbuilder/project-modules.json`；显式传 `enabledModuleIds=[]` 才表示仅使用基础模块。
6. 用简洁中文展示：项目目录、项目 ID、窗口/控件计划、项目级模块、模块依赖、将修改的文件、构建目标和预期 exe 位置，然后等待用户一次批准。

## 阶段二：批准后创建并读取真实文件

7. 用户批准后，用与预览完全相同的参数再次调用 `lingbuilder.project.create`，仅增加 `approved=true`。保存以下两个不同对象：
   - `solutionProject = result.project`：解决方案元数据，使用 `solutionProject.id` 作为项目 ID。
   - `designerProject = result.designerProject`：完整窗口设计器模型，原生预览和构建的 `project` 参数必须传这个对象。
8. 调用 `lingbuilder.modules.list`，传 `projectId=solutionProject.id`，确认项目级模块与预览一致。
9. 根据创建结果中的真实路径，用 `lingbuilder.file.read` 读取主 `.lcpp`、设计器 JSON、项目模块清单和需要协同修改的其它文件。不要凭路径猜文件名；设计器文件通常位于 `.lingbuilder/projects/<projectId>/window-designer.json`。

## 阶段三：源码和设计器同步修改

10. 先在内存中形成完整草稿：
    - `.lcpp` 负责事件、命令和业务逻辑；事件处理器引用使用 `&处理器名`，控件引用使用不带引号的裸控件名。
    - 设计器 JSON 负责窗口、控件、属性和事件绑定。新增按钮、文本区、列表等控件时必须同时更新设计器模型和 `.lcpp`，保持控件名称、稳定 ID、事件处理器一致。
    - 只修改完成需求所需的文件，保留其它内容、编码和换行。
11. 调用 `lingbuilder.edit.propose` 生成一个多文件提案：
    - `projectId` 传 `solutionProject.id`；
    - `filePath` 传主 `.lcpp` 路径；
    - `workspaceFiles` 放入每一个待修改文件的当前完整内容；
    - `files` 放入每一个待修改文件的修改后完整内容，不能只传 diff、片段或说明文字；
    - `instruction` 用中文概括本次修改。
12. 检查提案中的每个文件和变化范围。确认无误后调用 `lingbuilder.edit.apply`，传提案 ID 和 `approved=true`。若提案只改了源码而没有同步设计器，先重新生成提案，不要直接应用。

## 阶段四：诊断、生成和构建

13. 重新读取已应用的 `.lcpp` 和设计器 JSON，并解析出最新的 `designerProject`。
14. 调用 `lingbuilder.lingcpp.diagnostics`：
    - `filePath` 传主 `.lcpp`；
    - `sourceCode` 传最新源码；
    - `projectId` 传 `solutionProject.id`；
    - `designerProject` 传最新完整设计器模型。
15. 修复全部阻断诊断。每次修复都遵循“完整草稿提案 → 应用 → 重新诊断”，直到没有 Error。Info/建议可以保留，但最终报告要说明。
16. 调用 `lingbuilder.native.preview` 预览生成的 C++ 文件。这里的 `project` 必须传最新的 `designerProject` 对象，不要传 `solutionProject` 或单独的 `projectId`；源码集合通过 `lingCppSources` 传入完整项目 `.lcpp` 文件，必要时同时传主文件 `lingCppSourceCode`。
17. 调用 `lingbuilder.build.run` 完成真实编译和运行，参数规则与 native preview 相同：传 `project=designerProject`、完整 `lingCppSources`，并传 `run=true`、`approved=true`。不要自己拼接编译命令或启动生成的 exe。
18. 只有用户明确要求 Visual Studio 工程或可复制 C++ 工程时，才调用 `lingbuilder.native.export`，同样传 `project=designerProject` 和 `approved=true`。

## 失败处理和最终报告

- 模块未安装、依赖不满足、架构不兼容、编译器缺失或出现阻断诊断时，停止当前阶段并用中文说明原因和下一步，不要伪造成功。
- 发现旧的 `stopped` 实例、无关警告或信息建议时，不要把它们当成构建错误；按模块文档的状态规则处理。
- 最终报告必须包含：项目目录、`solutionProject.id`、项目级模块清单、修改文件、设计器同步情况、诊断摘要、native preview 摘要、构建日志摘要、真实 exe 路径和是否启动成功。
```

### 工具参数速查

- `lingbuilder.modules.list`、`lingbuilder.lingcpp.diagnostics`、`lingbuilder.edit.propose` 使用 `projectId=solutionProject.id`。
- `lingbuilder.native.preview`、`lingbuilder.native.export`、`lingbuilder.build.run` 不接收单独的 `projectId`；必须传完整的 `project=designerProject`。
- 独立 MCP 没有内部 AI planner，`lingbuilder.edit.propose` 的 `files[]` 和多文件场景的 `workspaceFiles[]` 都必须由外部 AI 提供完整内容。

执行顺序：

```text
lingbuilder.workspace.list / file.read / project.templates / modules.list
lingbuilder.project.create（预览）
用户一次批准
lingbuilder.project.create（approved=true）
lingbuilder.modules.list（projectId）
lingbuilder.file.read（源码、设计器、模块清单）
lingbuilder.edit.propose（workspaceFiles + files 完整内容）
lingbuilder.edit.apply（approved=true）
lingbuilder.lingcpp.diagnostics（projectId + designerProject）
lingbuilder.native.preview（project=designerProject）
lingbuilder.build.run（project=designerProject，approved=true）
```

该提示词适用于 Codex 桌面端通过项目级 `.codex/config.toml` 启动 LingBuilder 的 `--mcp --stdio-only` 服务，也适用于已连接同一 MCP 服务的其他 AI CLI。
