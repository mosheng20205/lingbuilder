import { AiConnectionConfig, LingCppWorkspaceFile, WorkspaceEditProposal, WorkspaceEditRange } from '../lingCpp/types';
import { LingWindowProject } from '../windowDesigner/types';
import { LingCppProjectSourceFile } from '../lingCpp/types';
import type {
  ProjectCreationRequest,
  ProjectCreationResult,
  ProjectCreationUndoResult,
  ProjectCreationPreview
} from '../solution/projectCreationService';

export type AiBridgePermissionMode = 'readonly' | 'preview' | 'yolo';

export interface AiBridgeServerOptions {
  workspaceRoot: string;
  host: string;
  port: number;
  token: string;
  permission: AiBridgePermissionMode;
  allowRemote: boolean;
  enableMcp: boolean;
  /** 显式指定 MSVC 目标架构；省略时按本机探测结果（通常是 x64）。
   *  32 位 OCX / DLL 只能被 32 位程序加载，构建这类示例时必须显式传 win32。 */
  arch?: 'win32' | 'x64';
}

export interface AiBridgeHealth {
  ok: true;
  service: 'LingBuilder AI Bridge';
  version: 1;
  workspaceRoot: string;
  permission: AiBridgePermissionMode;
  mcp: boolean;
}

export interface AiBridgeTreeEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: AiBridgeTreeEntry[];
}

export interface AiBridgeReadFileRequest {
  filePath: string;
}

export interface AiBridgeSearchRequest {
  query: string;
  include?: string[];
  maxResults?: number;
}

export interface AiBridgeSearchMatch {
  filePath: string;
  line: number;
  column: number;
  preview: string;
}

export interface AiBridgeLingCppDiagnosticsRequest {
  filePath: string;
  sourceCode?: string;
  projectId?: string;
  designerProject?: LingWindowProject;
}

/** 本轮诊断所用设计器上下文的来源与覆盖范围：外部 AI 必须能区分“已校验”与“未校验”。 */
export interface AiBridgeDesignerContextInfo {
  /** caller=调用方显式传入；workspace=按 projectId 从解决方案磁盘加载；none=两者都不可用。 */
  source: 'caller' | 'workspace' | 'none';
  projectId?: string;
  /** workspace 来源时标注磁盘设计器文件是否真实存在（false=文件缺失或无效，按空窗口模型校验）。 */
  persisted?: boolean;
  /** false 表示本轮跳过了依赖设计器符号的控件引用校验。 */
  controlReferencesChecked: boolean;
  summary: string;
}

export interface AiBridgeEditProposeRequest {
  filePath: string;
  sourceCode?: string;
  instruction: string;
  projectId?: string;
  selection?: WorkspaceEditRange;
  workspaceFiles?: LingCppWorkspaceFile[];
  aiConfig?: AiConnectionConfig;
  files?: Array<{
    filePath: string;
    updatedSource?: string;
    /** 按行数组（不含行尾换行符），服务端以 \n 拼接为完整内容；换行无需 JSON 转义。 */
    updatedLines?: string[];
    /** 行级增量替换（1 起、含端点），服务端基于磁盘当前内容应用。 */
    edits?: Array<{ startLine: number; endLine?: number; newText: string }>;
  }>;
  designerProject?: LingWindowProject;
  updatedDesignerProject?: LingWindowProject;
}

export interface AiBridgeEditApplyRequest {
  proposalId: string;
  workspaceFiles?: LingCppWorkspaceFile[];
  sourceCode?: string;
  approved?: boolean;
  designerProject?: LingWindowProject;
}

export interface AiBridgeBuildRunRequest {
  project?: LingWindowProject;
  /** project 缺省时按该 ID 读取磁盘设计器模型（项目必须已在解决方案注册）。 */
  projectId?: string;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  lingCppSources?: LingCppProjectSourceFile[];
  run?: boolean;
  approved?: boolean;
}

export interface AiBridgeNativeRequest {
  project?: LingWindowProject;
  /** project 缺省时按该 ID 读取磁盘设计器模型（项目必须已在解决方案注册）。 */
  projectId?: string;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  lingCppSources?: LingCppProjectSourceFile[];
  approved?: boolean;
}

export type AiBridgeProjectCreateRequest = ProjectCreationRequest;

export interface AiBridgeProjectCreateResponse {
  ok: true;
  applied: boolean;
  preview: ProjectCreationPreview;
  result?: ProjectCreationResult;
}

export interface AiBridgeProjectUndoRequest {
  receiptId: string;
  approved?: boolean;
}

export type AiBridgeProjectUndoResponse = ProjectCreationUndoResult;

export interface AiBridgeProjectTemplatesResponse {
  ok: true;
  templates: Array<{ id: string; name: string; description: string }>;
}

export interface AiBridgeEditApplyResult {
  /** 已应用文件的元数据；文件完整内容以工作区磁盘为准，不随响应回传。 */
  appliedFiles: Array<{ filePath: string; bytes: number }>;
  designerProjectId?: string;
  message?: string;
}

export interface AiBridgeModuleScaffoldRequest {
  id?: string;
  name?: string;
  template?: string;
  outDir?: string;
  approved?: boolean;
}

export interface AiBridgeModuleWriteFilesRequest {
  files?: Array<{ path: string; content: string }>;
  outDir?: string;
  approved?: boolean;
}

export interface AiBridgeModuleValidateRequest {
  modulePath?: string;
}

export interface AiBridgeModulePackRequest {
  moduleDir?: string;
  targetPath?: string;
  approved?: boolean;
}

export interface AiBridgeModuleInstallPreviewRequest {
  packagePath?: string;
}

export interface AiBridgeModuleInstallRequest {
  previewId?: string;
  projectId?: string;
  enableForProject?: boolean;
  approved?: boolean;
}

export interface AiBridgeModuleInfoRequest {
  moduleId?: string;
  projectId?: string;
  query?: string;
  includeAdvanced?: boolean;
}

export interface AiBridgeBuildStopRequest {
  projectId?: string;
}

export interface AiBridgeRunWaitRequest {
  projectId?: string;
  timeoutSeconds?: number;
}

export interface AiBridgeRunLogRequest {
  projectId?: string;
  tailLines?: number;
}

