export interface SolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp' | 'external-msbuild' | 'external-cmake';
  sourceRoot: string;
  configRoot: string;
  designerPath: string;
  isDefault?: boolean;
  references?: string[];
  projectFile?: string;
  buildProperties?: { configuration: 'Debug' | 'Release'; architecture: 'Win32' | 'x64'; additionalArguments: string[] };
  solutionFolderId?: string;
}

export interface SolutionFolder {
  id: string;
  name: string;
}

export interface SolutionModel {
  schemaVersion: 2;
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  folders: SolutionFolder[];
  projects: SolutionProject[];
}

export interface SolutionCommandResult {
  ok: boolean;
  solution?: SolutionModel;
  project?: SolutionProject;
  logs?: string[];
  error?: string;
  stage?: string;
  compilerDiagnostics?: any[];
  results?: Array<{ compilerDiagnostics?: any[] }>;
}

export const DEFAULT_SOLUTION: SolutionModel = {
  schemaVersion: 2,
  id: 'lingbuilder-solution',
  name: 'UI_CppLocProj',
  startupProjectId: 'lingbuilder-ui-project',
  startupProjectIds: ['lingbuilder-ui-project'],
  folders: [],
  projects: [
    {
      id: 'lingbuilder-ui-project',
      name: 'GameClient',
      type: 'visual-cpp',
      sourceRoot: 'src',
      configRoot: 'config',
      designerPath: '.lingbuilder/window-designer.json',
      isDefault: true
      , references: []
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

export async function importSolutionProject(projectFile: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/import', { projectFile });
}

export async function createSolutionFolder(name?: string): Promise<SolutionCommandResult & { folder?: SolutionFolder }> {
  return postJson('/api/solution/folders', { name });
}

export async function moveSolutionProject(projectId: string, solutionFolderId: string | null): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { solutionFolderId });
}

export async function renameSolutionProject(projectId: string, name: string): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { name });
}

export async function setStartupProject(projectId: string): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { startup: true });
}

export async function configureSolutionProject(projectId: string, patch: { name?: string; references?: string[]; startupProjectIds?: string[]; buildProperties?: SolutionProject['buildProperties']; solutionFolderId?: string | null }): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, patch);
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

export function getSolutionProjectDirectory(project: SolutionProject): string {
  if (project.type === 'visual-cpp') return project.sourceRoot || '.';
  const projectFile = (project.projectFile || '').replace(/\\/gu, '/');
  const separator = projectFile.lastIndexOf('/');
  return separator > 0 ? projectFile.slice(0, separator) : '.';
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
