export type AiConnectionMode = 'system' | 'byok';

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
