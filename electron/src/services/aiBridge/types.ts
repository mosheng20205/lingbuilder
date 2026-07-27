import { AiConnectionConfig, LingCppWorkspaceFile, WorkspaceEditProposal, WorkspaceEditRange } from '../lingCpp/types';
import { LingWindowProject } from '../windowDesigner/types';
import { LingCppProjectSourceFile } from '../lingCpp/types';

export type AiBridgePermissionMode = 'readonly' | 'preview' | 'yolo';

export interface AiBridgeServerOptions {
  workspaceRoot: string;
  host: string;
  port: number;
  token: string;
  permission: AiBridgePermissionMode;
  allowRemote: boolean;
  enableMcp: boolean;
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

export interface AiBridgeEditProposeRequest {
  filePath: string;
  sourceCode?: string;
  instruction: string;
  projectId?: string;
  selection?: WorkspaceEditRange;
  workspaceFiles?: LingCppWorkspaceFile[];
  aiConfig?: AiConnectionConfig;
  files?: Array<{ filePath: string; updatedSource: string }>;
}

export interface AiBridgeEditApplyRequest {
  proposalId: string;
  workspaceFiles?: LingCppWorkspaceFile[];
  sourceCode?: string;
  approved?: boolean;
}

export interface AiBridgeBuildRunRequest {
  project: LingWindowProject;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  lingCppSources?: LingCppProjectSourceFile[];
  run?: boolean;
  approved?: boolean;
}

export interface AiBridgeNativeRequest {
  project: LingWindowProject;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  lingCppSources?: LingCppProjectSourceFile[];
  approved?: boolean;
}

export interface AiBridgeEditApplyResult {
  proposal: WorkspaceEditProposal;
  appliedFiles: Array<{ filePath: string; sourceCode: string; absolutePath?: string }>;
}
