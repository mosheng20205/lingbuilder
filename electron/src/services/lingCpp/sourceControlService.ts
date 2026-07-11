import { SourceControlStatus } from './types';

export class SourceControlService {
  async getStatus(): Promise<SourceControlStatus> {
    try {
      const response = await fetch('/api/source-control/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      return {
        isRepository: false,
        branch: '',
        ahead: 0,
        behind: 0,
        files: [],
        error: error?.message || '无法读取 Git 状态'
      };
    }
  }
}

export const sourceControlService = new SourceControlService();
