export interface EnvironmentCheckRequestLease {
  controller: AbortController;
  finish(): void;
}

/** 保证 renderer 同一时刻只发出一次环境检查，并支持卸载时取消。 */
export class EnvironmentCheckRequestGate {
  private activeController: AbortController | null = null;

  begin(): EnvironmentCheckRequestLease | null {
    if (this.activeController) return null;
    const controller = new AbortController();
    this.activeController = controller;
    let finished = false;
    return {
      controller,
      finish: () => {
        if (finished) return;
        finished = true;
        if (this.activeController === controller) this.activeController = null;
      }
    };
  }

  cancel(): boolean {
    const controller = this.activeController;
    if (!controller) return false;
    this.activeController = null;
    controller.abort();
    return true;
  }

  isActive(): boolean {
    return this.activeController !== null;
  }
}

export function createEnvironmentCheckRequestGate(): EnvironmentCheckRequestGate {
  return new EnvironmentCheckRequestGate();
}
