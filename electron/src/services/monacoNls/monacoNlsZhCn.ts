// Monaco 专业模式内置界面（右键菜单、查找替换、悬停、补全列表、命令面板等）的简体中文注入。
//
// monaco-editor 的 ESM 构建以 `localize(索引, "英文兜底")` 形式调用文案，运行时从
// globalThis._VSCODE_NLS_MESSAGES 按索引取翻译，取不到（undefined/null）时回退英文兜底；
// globalThis._VSCODE_NLS_LANGUAGE 仅用于语言标识与伪本地化判断。
//
// 该表必须在任何 monaco-editor 模块求值之前就位。当前唯一入口是
// src/components/MonacoCodeEditor.tsx 的第一条导入（monaco 运行时只在那里引入）。
// 数据表由 scripts/generate-monaco-zh-cn-nls.ts 从随包官方语言表生成，升级 monaco-editor
// 后必须重跑 npm run monaco:nls-zh-cn，否则索引错位（构建门禁会拦截）。
import { MONACO_ZH_CN_MESSAGES } from './monacoNlsZhCnMessages';

declare global {
  var _VSCODE_NLS_MESSAGES: readonly (string | null)[] | undefined;
  var _VSCODE_NLS_LANGUAGE: string | undefined;
}

// 宿主（例如未来的 Electron 主进程预注入）已提供 NLS 表时不覆盖。
if (!Array.isArray(globalThis._VSCODE_NLS_MESSAGES) || globalThis._VSCODE_NLS_MESSAGES.length === 0) {
  globalThis._VSCODE_NLS_MESSAGES = MONACO_ZH_CN_MESSAGES;
  globalThis._VSCODE_NLS_LANGUAGE = 'zh-cn';
}
