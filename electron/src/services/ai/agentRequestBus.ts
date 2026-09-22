/**
 * 面板间「把一句话交给本机 Agent」的唯一交接通道。
 *
 * 模块面板的「AI 生成模块」不再自带引擎：它把需求投给这个事件，由 App 打开 AI 助手侧栏、
 * 由 AiAssistant 起唯一一轮 Agent 会话。禁止任何面板再自建第二套编排或写盘路径。
 */
export const AI_AGENT_REQUEST_EVENT = 'lingbuilder:ai-agent-request';

export interface AiAgentRequest {
  prompt: string;
  /** 发出方标识，仅用于日志与占位文案，不参与执行决策。 */
  origin?: string;
}

export function requestAiAgentTurn(request: AiAgentRequest): void {
  const prompt = request.prompt.trim();
  if (!prompt) return;
  window.dispatchEvent(new CustomEvent<AiAgentRequest>(AI_AGENT_REQUEST_EVENT, { detail: { ...request, prompt } }));
}

export function onAiAgentRequest(listener: (request: AiAgentRequest) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AiAgentRequest>).detail;
    if (detail && typeof detail.prompt === 'string' && detail.prompt.trim()) listener({ ...detail, prompt: detail.prompt.trim() });
  };
  window.addEventListener(AI_AGENT_REQUEST_EVENT, handler);
  return () => window.removeEventListener(AI_AGENT_REQUEST_EVENT, handler);
}
