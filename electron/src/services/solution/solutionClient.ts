export interface SolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp';
  sourceRoot: string;
  configRoot: string;
  designerPath: string;
  isDefault?: boolean;
}

export interface SolutionModel {
  schemaVersion: 1;
  id: string;
  name: string;
  startupProjectId: string;
  projects: SolutionProject[];
}

export interface SolutionCommandResult {
  ok: boolean;
  solution?: SolutionModel;
  project?: SolutionProject;
  logs?: string[];
  error?: string;
  stage?: string;
}

export const DEFAULT_SOLUTION: SolutionModel = {
  schemaVersion: 1,
  id: 'lingbuilder-solution',
  name: 'UI_CppLocProj',
  startupProjectId: 'lingbuilder-ui-project',
  projects: [
    {
      id: 'lingbuilder-ui-project',
      name: 'GameClient',
      type: 'visual-cpp',
      sourceRoot: 'src',
      configRoot: 'config',
      designerPath: '.lingbuilder/window-designer.json',
      isDefault: true
    }
  ]
};

export async function fetchSolution(): Promise<SolutionModel> {
  const response = await fetch('/api/solution');
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || '解决方案读取失败');
  return result.solution as SolutionModel;
}

export async function createSolutionProject(name?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/projects', { name });
}

export async function setStartupProject(projectId: string): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { startup: true });
}

export async function deleteSolutionProject(projectId: string, deleteFiles: boolean): Promise<SolutionCommandResult> {
  const response = await fetch(`/api/solution/projects/${encodeURIComponent(projectId)}?deleteFiles=${deleteFiles ? 'true' : 'false'}`, {
    method: 'DELETE'
  });
  return await parseCommandResponse(response);
}

export async function buildSolution(projectId?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/build', projectId ? { projectId, run: false } : { run: false });
}

export async function cleanSolution(projectId?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/clean', projectId ? { projectId } : {});
}

export async function rebuildSolution(projectId?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/rebuild', projectId ? { projectId, run: false } : { run: false });
}

async function postJson(url: string, body: unknown): Promise<SolutionCommandResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await parseCommandResponse(response);
}

async function patchJson(url: string, body: unknown): Promise<SolutionCommandResult> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await parseCommandResponse(response);
}

async function parseCommandResponse(response: Response): Promise<SolutionCommandResult> {
  const result = await response.json();
  if (!response.ok || result.ok === false) {
    return {
      ok: false,
      error: result.error || result.stage || '操作失败',
      logs: result.logs || []
    };
  }
  return result as SolutionCommandResult;
}
