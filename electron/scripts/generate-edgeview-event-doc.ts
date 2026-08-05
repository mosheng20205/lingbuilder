import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EDGEVIEW_BROWSER_EVENTS,
  EDGEVIEW_COMPOSITION_ONLY_EVENTS
} from '../src/services/modules/edgeViewBrowserEvents';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(scriptDirectory, '../docs/modules/edgeview/README.md');
const checkOnly = process.argv.includes('--check');

const SOURCE_LABELS: Record<string, string> = {
  webView: 'WebView',
  controller: '浏览器控制器',
  environment: '浏览器环境',
  download: '下载任务',
  find: '页内查找',
  frame: '子框架',
  notification: '网页通知',
  profile: '浏览器配置',
  worker: '工作线程',
  devTools: '开发者工具',
  contextMenuItem: '右键菜单项'
};

function escapeMarkdown(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\n', ' ');
}

function renderDocument(): string {
  const lines = [
    '<!-- 此文件由 electron/scripts/generate-edgeview-event-doc.ts 生成。请修改 edgeViewBrowserEvents.ts 后运行 npm run module:edgeview-docs。 -->',
    '# EdgeView 浏览器模块事件参考',
    '',
    `EdgeView 模块当前通过统一事件目录公开 ${EDGEVIEW_BROWSER_EVENTS.length} 项普通 HWND 可达事件。事件名称、稳定 WebView2 标识、分类和简要说明均从 \`electron/src/services/modules/edgeViewBrowserEvents.ts\` 生成；不要在示例或 UI 中另行维护事件名单。`,
    '',
    '## 快速使用',
    '',
    '事件处理器是在当前窗口中执行的无参数中文事件或方法。新代码使用 `&处理器名` 引用：',
    '',
    '```text',
    '绑定结果 = EdgeView_绑定控件事件(演示浏览器, "Web资源请求", &收到资源请求)',
    '结束',
    '',
    '事件 收到资源请求()',
    '    地址 = EdgeView事件_取字段(演示浏览器, "uri")',
    '    调试输出(地址)',
    '结束',
    '```',
    '',
    '- 设计器控件使用 `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)`；控件名是裸 `controlRef`，不要加引号。',
    '- 纯代码实例使用 `EdgeView_绑定事件(实例编号, 事件名, &处理器名)`。',
    '- `EdgeView_取事件数据控件` / `EdgeView_取事件数据` 返回当前事件的 UTF-16 JSON 文本。',
    '- 需要读取单个字段时使用 `EdgeView事件_取字段(控件名, "字段名")`；字段值以文本形式返回，数字字段再转换为整数或长整数。',
    '- 同步决策事件只在处理器执行期间允许调用对应的 `EdgeView事件_*` 或 `EdgeView资源_*` 决策接口；未设置动作时保留 WebView2 默认行为。',
    '',
    '## 统一事件目录',
    '',
    '| # | 中文事件名 | WebView2 事件标识 | 设计器事件 ID | 事件来源 | 说明 |',
    '|---:|---|---|---|---|---|'
  ];

  EDGEVIEW_BROWSER_EVENTS.forEach((event, index) => {
    lines.push(`| ${index + 1} | ${escapeMarkdown(event.name)} | \`${escapeMarkdown(event.id)}\` | \`${escapeMarkdown(event.designerId || event.id)}\` | ${escapeMarkdown(SOURCE_LABELS[event.source] || event.source)} | ${escapeMarkdown(event.description)} |`);
  });

  lines.push(
    '',
    '## 重点事件字段',
    '',
    '所有事件都通过统一 JSON/字段接口读取。下面列出当前 EdgeView 原生运行时明确生成的资源事件字段；其它事件请先读取 `EdgeView_取事件数据控件`，再按实际 JSON 字段读取。',
    '',
    '### Web资源请求',
    '',
    '| 字段 | 类型/含义 |',
    '|---|---|',
    '| `requestHandle` | 受管请求句柄；不再使用时调用 `EdgeView对象_释放`。 |',
    '| `uri` | 请求地址。 |',
    '| `method` | HTTP 方法，例如 `GET`、`POST`。 |',
    '| `context` | `COREWEBVIEW2_WEB_RESOURCE_CONTEXT` 数值。 |',
    '| `sourceKind` | `COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS` 数值；旧 Runtime 不支持时可能为 0。 |',
    '',
    '这是同步资源决策事件。需要替换响应时，在处理器内调用：',
    '',
    '```text',
    'EdgeView资源_设置事件响应文本(演示浏览器, 200, "OK", "Content-Type: text/html; charset=utf-8", 页面正文)',
    '```',
    '',
    '### Web资源响应收到',
    '',
    '| 字段 | 类型/含义 |',
    '|---|---|',
    '| `requestHandle` | 受管请求句柄。 |',
    '| `responseHandle` | 受管响应视图句柄；可交给 `EdgeView资源_读响应正文异步`。 |',
    '| `uri` | 响应对应的请求地址。 |',
    '| `statusCode` | HTTP 状态码。 |',
    '| `reason` | HTTP 原因短语。 |',
    '',
    '## 运行时边界',
    '',
    '- 普通 HWND 事件目录包含上述 71 项；`CompositionController.CursorChanged` 和 `CompositionController.NonClientRegionChanged` 属于合成控制器专属事件，当前 EdgeView 不支持。',
    '- 事件目录中的名称表示 LingBuilder 中文事件入口；底层 COM 事件对象、`IStream`、裸指针和 `GetDeferral` 不直接暴露给 `.lcpp`。',
    '- 可用事件取决于 WebView2 Runtime 版本。基础事件最低基线为 SDK `1.0.3537.50` / Runtime 141；使用 v2 资源、对象或创建选项接口时按模块诊断要求使用 Runtime 150。',
    '',
    '## 不适用事件',
    '',
    '| WebView2 事件标识 | 中文名称 | 原因 |',
    '|---|---|---|'
  );

  EDGEVIEW_COMPOSITION_ONLY_EVENTS.forEach(event => {
    lines.push(`| \`${escapeMarkdown(event.id)}\` | ${escapeMarkdown(event.name)} | 仅适用于 CompositionController；LingBuilder EdgeView 使用普通 HWND Controller。 |`);
  });

  lines.push(
    '',
    '## 相关来源',
    '',
    '- 统一目录：`electron/src/services/modules/edgeViewBrowserEvents.ts`',
    '- API 与 binding：`electron/src/services/modules/edgeViewApiCatalog.ts`、`electron/src/services/modules/builtinModules.ts`',
    '- WebView2 原生字段桥接：`electron/src/services/windowDesigner/lingCppWin32Project.ts`',
    '- 资源请求示例：`examples/edgeview-response-demos/replace-response/` 和 `examples/edgeview-response-demos/read-response/`',
    '',
    `目录项数：${EDGEVIEW_BROWSER_EVENTS.length}；CompositionController 排除项：${EDGEVIEW_COMPOSITION_ONLY_EVENTS.length}。`,
    ''
  );

  return `${lines.join('\n')}\n`;
}

const content = renderDocument();

if (checkOnly) {
  try {
    const existing = await fs.readFile(outputPath, 'utf8');
    if (existing !== content) {
      console.error(`EdgeView 事件文档已过期：${outputPath}`);
      process.exitCode = 1;
    } else {
      console.log(`EdgeView 事件文档已同步：${EDGEVIEW_BROWSER_EVENTS.length} 项。`);
    }
  } catch (error) {
    console.error(`无法读取 EdgeView 事件文档：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf8');
  console.log(`已生成 EdgeView 事件文档：${outputPath}（${EDGEVIEW_BROWSER_EVENTS.length} 项）。`);
}
