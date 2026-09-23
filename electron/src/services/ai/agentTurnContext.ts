/**
 * 面板 → 内嵌 Agent 的每轮上下文注入。
 *
 * 内嵌 Agent（dsh）经 LingBuilder MCP 只看得见工作区：多项目解决方案里每个项目的
 * 窗口都叫「主窗口」，没有当前项目信息时它只能靠猜（真机实测猜中了默认占位项目）。
 * 面板是唯一知道「用户当前打开哪个项目」的地方，所以由面板在提交需求时注入这段
 * 确定性上下文；它只是事实陈述，不做任何意图分类（意图判定仍由 Agent 自己完成）。
 */

export interface AgentTurnContextInput {
  /** 当前打开的项目 ID（工作台 activeProjectId）。 */
  projectId?: string;
  /** 活动文件路径（工作区相对，如 `agent-demo/MainWindow.lcpp`）。 */
  filePath?: string;
  /** 当前项目是否是窗口项目（面板持有设计器模型即为真）。 */
  hasDesigner?: boolean;
  /** 当前项目的全部文件路径（工作区相对），用于推导项目源码目录。 */
  workspaceFilePaths?: string[];
}

const CONTEXT_MARKER = '【LingBuilder 当前上下文】';

/** 从项目文件清单推导项目在工作区内的源码目录（取第一个路径的目录段，统一斜杠）。 */
export function deriveProjectDirectory(workspaceFilePaths: string[] | undefined): string {
  const first = (workspaceFilePaths || []).map(path => String(path || '').replace(/\\/gu, '/')).find(path => path.trim());
  if (!first) return '';
  const trimmed = first.trim();
  const slash = trimmed.lastIndexOf('/');
  return slash > 0 ? trimmed.slice(0, slash) : '';
}

/** 组装注入 Agent 的上下文头；没有任何可用事实时原样返回指令。 */
export function buildAgentTurnContextPrompt(input: AgentTurnContextInput, instruction: string): string {
  const lines: string[] = [];
  if (input.projectId) lines.push(`当前打开项目 ID：${input.projectId}。`);
  const directory = deriveProjectDirectory(input.workspaceFilePaths);
  if (directory) lines.push(`项目源码目录：${directory}/（工作区相对路径）。`);
  if (input.filePath) lines.push(`活动文件：${String(input.filePath).replace(/\\/gu, '/')}。`);
  if (input.hasDesigner) lines.push('该项目是窗口项目，带有窗口设计器模型。');
  if (lines.length === 0) return instruction;
  lines.push('诊断、读文件与 edit.propose 提案必须针对上述项目进行，不要改动其它项目的文件。');
  return `${CONTEXT_MARKER}${lines.join('')}\n\n${instruction}`;
}
