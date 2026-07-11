export type WorkspaceSearchScope = 'file' | 'project' | 'workspace';

export interface WorkspaceSearchQueryRequest {
  query: string;
  scope: WorkspaceSearchScope;
  isRegex?: boolean;
  matchCase?: boolean;
  /** Required when scope is `file`; always workspace-relative. */
  filePath?: string;
  /** Selects one SolutionService project when scope is `project`. */
  projectId?: string;
  maxResults?: number;
}

export type WorkspaceSearchDiagnosticLevel = 'info' | 'warning' | 'error';

export interface WorkspaceSearchDiagnostic {
  code: string;
  level: WorkspaceSearchDiagnosticLevel;
  message: string;
  filePath?: string;
}

export interface WorkspaceSearchMatch {
  id: string;
  filePath: string;
  /** One-based Unicode code-point line and column positions. */
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  /** Bounded display text; the service keeps the exact match internally for replacement. */
  matchText: string;
  matchTextTruncated?: boolean;
  /** A bounded Unicode window around the start of the match. */
  preview: string;
  previewTruncated?: boolean;
}

export interface WorkspaceSearchQueryResponse {
  queryId: string;
  matches: WorkspaceSearchMatch[];
  truncated: boolean;
  scannedFiles: number;
  skippedFiles: number;
  diagnostics: WorkspaceSearchDiagnostic[];
}

export interface WorkspaceReplacePreviewRequest {
  queryId: string;
  replacement: string;
  /** Omit to replace every non-truncated query result. */
  matchIds?: string[];
}

export interface WorkspaceReplacePreviewFile {
  filePath: string;
  before: string;
  after: string;
  replacements: number;
}

export interface WorkspaceReplacePreviewResponse {
  previewId: string;
  queryId: string;
  files: WorkspaceReplacePreviewFile[];
  replacementCount: number;
  diagnostics: WorkspaceSearchDiagnostic[];
}

export interface WorkspaceReplaceApplyRequest {
  previewId: string;
}

export interface WorkspaceReplaceApplyResponse {
  transactionId: string;
  updatedFiles: string[];
  replacementCount: number;
}

export interface WorkspaceReplaceRollbackRequest {
  transactionId: string;
}

export interface WorkspaceReplaceRollbackResponse {
  transactionId: string;
  restoredFiles: string[];
}

export type WorkspaceSearchErrorCode =
  | 'INVALID_REQUEST'
  | 'QUERY_TOO_LONG'
  | 'INVALID_REGEX'
  | 'UNSAFE_REGEX'
  | 'INVALID_RESULT_LIMIT'
  | 'FILE_NOT_FOUND'
  | 'NOT_A_FILE'
  | 'PROJECT_NOT_FOUND'
  | 'QUERY_NOT_FOUND'
  | 'QUERY_EXPIRED'
  | 'PREVIEW_NOT_FOUND'
  | 'PREVIEW_EXPIRED'
  | 'TRANSACTION_NOT_FOUND'
  | 'TRANSACTION_EXPIRED'
  | 'RESULT_TRUNCATED'
  | 'INVALID_MATCH'
  | 'NO_MATCHES'
  | 'PREVIEW_TOO_LARGE'
  | 'CACHE_CAPACITY_EXCEEDED'
  | 'FILE_CHANGED'
  | 'WRITE_FAILED'
  | 'ROLLBACK_CONFLICT'
  | 'CONSISTENCY_RECOVERY_FAILED'
  | 'PATH_REJECTED';

export class WorkspaceSearchError extends Error {
  constructor(
    public readonly code: WorkspaceSearchErrorCode,
    message: string,
    public readonly filePath?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceSearchError';
  }
}

export interface WorkspaceSearchFileOperations {
  writeFile(filePath: string, data: Uint8Array): Promise<void>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  remove(filePath: string): Promise<void>;
}

export interface WorkspaceSearchServiceOptions {
  fileOperations?: Partial<WorkspaceSearchFileOperations>;
  maxFileBytes?: number;
  /** Maximum estimated bytes retained by one replace-capable query snapshot. */
  maxRetainedBytes?: number;
  /** Maximum number of matching files retained by one query snapshot. */
  maxMatchedFiles?: number;
  /** Maximum UTF-8 JSON string bytes returned by one before/after preview. */
  maxPreviewBytes?: number;
  /** Hard total byte budget shared by query, preview, and undo caches. */
  maxTotalCacheBytes?: number;
  /** Undo transactions are never silently evicted before TTL. */
  maxTransactionEntries?: number;
  maxQueryLength?: number;
  defaultMaxResults?: number;
  maximumMaxResults?: number;
  cacheTtlMs?: number;
  transactionTtlMs?: number;
  maxCacheEntries?: number;
  now?: () => number;
  createId?: () => string;
}
