export interface SolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp' | 'windows-dll' | 'windows-console' | 'external-msbuild' | 'external-cmake';
  sourceRoot: string;
  configRoot: string;
  designerPath: string;
  isDefault?: boolean;
  references?: string[];
  projectFile?: string;
  buildProperties?: {
    configuration: 'Debug' | 'Release';
    architecture: 'Win32' | 'x64';
    additionalArguments: string[];
    /** 项目构建目录模板覆盖（工作区相对，支持宏）；与服务端 ExternalProjectProperties 一致。 */
    buildDirectory?: string;
    /** 项目生成源码目录模板覆盖。 */
    generatedSourceDirectory?: string;
    /** 项目构建产物 EXE 文件名（可带 .exe 后缀）；未设置时使用 LingBuilderPreview.exe。 */
    executableName?: string;
    /** 项目产物类型：exe（缺省）生成应用程序；dll 生成动态库 + 导入库并导出「公开」子程序；DLL 项目不支持 F5 生成并运行。 */
    outputType?: 'exe' | 'dll';
    /** 传真时生成的 exe 启动时请求管理员权限（UAC requireAdministrator）；缺省假＝asInvoker。与服务端 ExternalProjectProperties 一致。 */
    requireAdministrator?: boolean;
  };
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
  /** .sln 展开导入时返回全部新增项目。 */
  projects?: SolutionProject[];
  logs?: string[];
  warnings?: string[];
  error?: string;
  stage?: string;
  compilerDiagnostics?: any[];
  results?: Array<{ compilerDiagnostics?: any[] }>;
  /** 创建位置为工作区外的绝对路径时返回：新创建的独立项目工作区目录。 */
  workspacePath?: string;
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

/** 解决方案元数据请求的统一超时：本地服务正常应在毫秒级返回，超过视为服务无响应。构建/清理等长任务不套用该超时。 */
const METADATA_REQUEST_TIMEOUT_MS = 30_000;

interface JsonRequestOptions {
  /** 外部中止信号（如用户在对话框点击「取消等待」）。 */
  signal?: AbortSignal;
  /** 超时毫秒数；不传则不设超时。 */
  timeoutMs?: number;
}

function composeRequestSignal(options?: JsonRequestOptions): AbortSignal | undefined {
  if (!options?.signal && !options?.timeoutMs) return undefined;
  const signals = [
    ...(options.signal ? [options.signal] : []),
    ...(options.timeoutMs ? [AbortSignal.timeout(options.timeoutMs)] : [])
  ];
  return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
}

/** 把超时/中止异常翻译成中文提示；非中止类异常返回 null 由调用方按原逻辑处理。 */
function abortErrorMessage(error: unknown): string | null {
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError') return '本地服务长时间未响应，请求已超时中止。请检查 LingBuilder Local Service 进程后重试。';
  if (name === 'AbortError') return '操作请求已取消。';
  return null;
}

export async function fetchSolution(): Promise<SolutionModel> {
  let response: Response;
  try {
    response = await fetch('/api/solution', { signal: AbortSignal.timeout(METADATA_REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(abortErrorMessage(error) || '解决方案读取失败');
  }
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || '解决方案读取失败');
  return result.solution as SolutionModel;
}

export interface CreateSolutionProjectOptions {
  /** 新建时一并设置解决方案名称；已有解决方案时表示重命名。留空表示沿用当前名称。 */
  solutionName?: string;
  /** 项目源码目录（工作区相对路径或工作区内绝对路径）。留空时自动生成 src/<projectId>。 */
  projectDirectory?: string;
}

export async function createSolutionProject(
  name?: string,
  templateId?: 'blank-window' | 'windows-dll' | 'windows-console',
  options?: CreateSolutionProjectOptions,
  signal?: AbortSignal
): Promise<SolutionCommandResult> {
  return postJson('/api/solution/projects', {
    name,
    ...(templateId ? { templateId } : {}),
    ...(options?.solutionName !== undefined ? { solutionName: options.solutionName } : {}),
    ...(options?.projectDirectory !== undefined ? { projectDirectory: options.projectDirectory } : {})
  }, { signal, timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function importSolutionProject(projectFile: string, mode: 'expand' | 'single' = 'expand'): Promise<SolutionCommandResult> {
  return postJson('/api/solution/import', { projectFile, mode }, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function createSolutionFolder(name?: string): Promise<SolutionCommandResult & { folder?: SolutionFolder }> {
  return postJson('/api/solution/folders', { name }, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function moveSolutionProject(projectId: string, solutionFolderId: string | null): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { solutionFolderId }, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function renameSolutionProject(projectId: string, name: string): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { name }, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function setStartupProject(projectId: string): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, { startup: true }, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function configureSolutionProject(projectId: string, patch: { name?: string; references?: string[]; startupProjectIds?: string[]; buildProperties?: SolutionProject['buildProperties']; solutionFolderId?: string | null }): Promise<SolutionCommandResult> {
  return patchJson(`/api/solution/projects/${encodeURIComponent(projectId)}`, patch, { timeoutMs: METADATA_REQUEST_TIMEOUT_MS });
}

export async function deleteSolutionProject(projectId: string, deleteFiles: boolean): Promise<SolutionCommandResult> {
  try {
    const response = await fetch(`/api/solution/projects/${encodeURIComponent(projectId)}?deleteFiles=${deleteFiles ? 'true' : 'false'}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(METADATA_REQUEST_TIMEOUT_MS)
    });
    return await parseCommandResponse(response);
  } catch (error) {
    const message = abortErrorMessage(error);
    if (message) return { ok: false, error: message, logs: [] };
    throw error;
  }
}

export async function buildSolution(projectId?: string, run = false): Promise<SolutionCommandResult> {
  return postJson('/api/solution/build', projectId ? { projectId, run } : { run });
}

export async function cleanSolution(projectId?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/clean', projectId ? { projectId } : {});
}

export async function rebuildSolution(projectId?: string): Promise<SolutionCommandResult> {
  return postJson('/api/solution/rebuild', projectId ? { projectId, run: false } : { run: false });
}

export function getSolutionProjectDirectory(project: SolutionProject): string {
  if (project.type === 'visual-cpp' || project.type === 'windows-dll' || project.type === 'windows-console') return project.sourceRoot || '.';
  const projectFile = (project.projectFile || '').replace(/\\/gu, '/');
  const separator = projectFile.lastIndexOf('/');
  return separator > 0 ? projectFile.slice(0, separator) : '.';
}

async function postJson(url: string, body: unknown, options?: JsonRequestOptions): Promise<SolutionCommandResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: composeRequestSignal(options)
    });
    return await parseCommandResponse(response);
  } catch (error) {
    const message = abortErrorMessage(error);
    if (message) return { ok: false, error: message, logs: [] };
    throw error;
  }
}

async function patchJson(url: string, body: unknown, options?: JsonRequestOptions): Promise<SolutionCommandResult> {
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: composeRequestSignal(options)
    });
    return await parseCommandResponse(response);
  } catch (error) {
    const message = abortErrorMessage(error);
    if (message) return { ok: false, error: message, logs: [] };
    throw error;
  }
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
