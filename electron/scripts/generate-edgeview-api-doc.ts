import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { EDGEVIEW_SAFE_API_CATALOG, EDGEVIEW_FULL_RUNTIME_MAJOR } from '../src/services/modules/edgeViewApiCatalog';
import type { ModuleCommandBinding, ModuleCommandContribution } from '../src/services/modules/types';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'docs/modules/edgeview/API.md');
const check = process.argv.includes('--check');

const manifest = BUILTIN_MODULES.find((item) => item.id === 'lingbuilder.edgeview');
if (!manifest) throw new Error('找不到 lingbuilder.edgeview 模块清单。');

const commands = manifest.contributes?.commands ?? [];
const bindings = new Map((manifest.bindings?.commands ?? []).map((item) => [item.command, item]));
const catalog = new Map(EDGEVIEW_SAFE_API_CATALOG.map((item) => [item.command.name, item]));
if (commands.length !== 272) throw new Error(`EdgeView 命令数异常：${commands.length}，预期 272。`);

const familyOf = (name: string) => {
  const match = name.match(/^EdgeView([^_]+)_/u);
  return match?.[1] ?? '兼容基础接口';
};

const typeLabel = (type: string) => ({
  controlRef: '控件引用（裸名称）', wideString: '文本型（UTF-16）',
  utf8String: '文本型（UTF-8）', longLong: '长整数型', int: '整数型',
  double: '双精度型', bool: '逻辑型', void: '空', handler: '处理器引用（&名称）',
  raw: '原始值', lingValue: 'Ling 值', handle: '受管句柄',
}[type] ?? type);

const parameterText = (binding?: ModuleCommandBinding) => {
  if (!binding?.parameters?.length) return '无';
  return binding.parameters.map((item) => {
    const suffix = item.optional ? `，可选，默认 ${String(item.defaultValue ?? '未设置')}` : '';
    const detail = item.description ? `；${item.description}` : '';
    return `**${item.name}**：${typeLabel(String(item.type))}${suffix}${detail}`;
  }).join('<br>');
};

const commandRows = commands.map((command: ModuleCommandContribution, index) => {
  const binding = bindings.get(command.name);
  const description = command.description ?? binding?.description ?? '';
  const capability = catalog.get(command.name)?.capability === 'edgeview.safe-api.v2' ? `Runtime ${EDGEVIEW_FULL_RUNTIME_MAJOR}（v2）` : 'Runtime 141 起';
  return `| ${index + 1} | ${familyOf(command.name)} | \`${command.name}\` | \`${command.signature}\` | ${typeLabel(String(binding?.returnType ?? command.returnType ?? 'void'))} | ${capability} | ${parameterText(binding)} | ${description.replaceAll('|', '\\|')} |`;
});

const content = `<!-- 此文件由 electron/scripts/generate-edgeview-api-doc.ts 生成，请修改 edgeViewApiCatalog.ts 或 builtinModules.ts 后运行 npm run module:edgeview-api-docs。 -->
# EdgeView 浏览器模块完整 API 参考

EdgeView 模块版本 **1.2.0**，当前公开 **272 条中文命令**：235 条安全 API、37 条兼容命令。本文由模块清单和 binding 自动生成，命令签名、参数类型、返回类型和说明不得在本文件中手工维护。

## 使用约定

- 设计器控件参数必须使用裸 \`controlRef\`，例如 \`EdgeView_导航控件(演示浏览器, "https://example.com")\`；不要给控件名加引号。
- 所有处理器参数必须使用 \`&处理器名\`，例如 \`EdgeView_绑定控件事件(演示浏览器, "导航完成", &导航完成)\`。
- 异步命令返回任务 ID。完成处理器中使用 \`EdgeView任务_取当前任务ID()\`，再读取状态、结果或错误，最后调用 \`EdgeView任务_释放(任务ID)\`。
- 返回值为整数的命令通常以 1 表示成功、0 表示失败；失败时应结合任务错误、模块诊断或原始 HRESULT 排查。
- 标记为 Runtime 150（v2）的命令需要 WebView2 Runtime 150 或更高版本；Runtime 141 仅提供基础能力。
- 模块不向 \`.lcpp\` 暴露 COM、IStream、IUnknown、裸指针或内存地址；二进制结果通过文件路径、十六进制文本或受管句柄返回。

## 快速示例

\`\`\`text
事件 _MainWindow_创建完毕()
    EdgeView_绑定控件事件(演示浏览器, "导航完成", &导航完成)
    EdgeView_导航控件(演示浏览器, "https://example.com")
结束

事件 导航完成()
    标题 = EdgeView导航_取标题(演示浏览器)
    调试输出(标题)
结束
\`\`\`

资源请求拦截、响应正文读取、任务生命周期和多实例示例见 \`examples/edgeview-response-demos/\` 与 \`examples/module-demos/lingbuilder.edgeview/\`。

## 完整命令清单

| # | 功能族 | 命令 | 签名 | 返回类型 | Runtime | 参数 | 说明 |
|---:|---|---|---|---|---|---|---|
${commandRows.join('\n')}

## 相关文档

- [事件参考](./README.md)：71 项普通 HWND 事件、关键字段和不适用的 CompositionController 事件。
- [用户指南](/guide/user/modules/edgeview)：安装、设计器控件、平台依赖和常用操作。
- [完整演示清单](../../../../examples/module-demos/lingbuilder.edgeview/src/README.md)：可复制的 272 条命令示例签名。
`;

if (check) {
  const existing = await readFile(output, 'utf8').catch(() => '');
  if (existing !== content) throw new Error(`EdgeView API 文档已过期：${output}`);
  console.log(`EdgeView API 文档已同步：${commands.length} 条。`);
} else {
  await writeFile(output, content, 'utf8');
  console.log(`已生成 EdgeView API 文档：${output}（${commands.length} 条）。`);
}
