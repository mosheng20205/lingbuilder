/**
 * 面板请求通道：system = 云端系统 AI（点数计费），byok = 用户自备供应商 Key，
 * agent = 本机内嵌 Agent 运行时（DeepSeek Harness，经 AI Bridge MCP 干活，
 * 写盘与构建由面板在用户确认提案后代执行）。
 */
export type AiConnectionMode = 'system' | 'byok' | 'agent';

export class AiConnectionSessionService {
  private connectedSignature: string | null = null;
  private mode: AiConnectionMode | null = null;

  getConnectedSignature(): string | null {
    return this.connectedSignature;
  }

  isConnected(signature: string): boolean {
    return Boolean(signature) && this.connectedSignature === signature;
  }

  markConnected(signature: string): void {
    this.connectedSignature = signature || null;
  }

  clear(): void {
    this.connectedSignature = null;
  }

  getMode(): AiConnectionMode | null {
    return this.mode;
  }

  setMode(mode: AiConnectionMode): void {
    this.mode = mode;
  }
}

export const aiConnectionSession = new AiConnectionSessionService();
