import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { decodeTextFile, encodeTextFile } from '../files/textFileService';
import type { TextFileSnapshot } from '../files/types';
import {
  type LingBuilderSolutionProject,
  type SolutionService,
  createSolutionService
} from '../solution/solutionService';
import { WorkspacePathPolicy, WorkspacePathPolicyError } from './workspacePathPolicy';
import {
  WorkspaceReplaceApplyRequest,
  WorkspaceReplaceApplyResponse,
  WorkspaceReplacePreviewFile,
  WorkspaceReplacePreviewRequest,
  WorkspaceReplacePreviewResponse,
  WorkspaceReplaceRollbackRequest,
  WorkspaceReplaceRollbackResponse,
  WorkspaceSearchDiagnostic,
  WorkspaceSearchError,
  WorkspaceSearchFileOperations,
  WorkspaceSearchMatch,
  WorkspaceSearchQueryRequest,
  WorkspaceSearchQueryResponse,
  WorkspaceSearchServiceOptions
} from './workspaceSearchTypes';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  '.lingbuilder-build',
  'generated',
  '.vs',
  'coverage'
]);

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_RETAINED_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_MATCHED_FILES = 256;
const DEFAULT_MAX_PREVIEW_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_CACHE_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_TRANSACTION_ENTRIES = 5;
const DEFAULT_MAX_QUERY_LENGTH = 512;
const DEFAULT_RESULT_LIMIT = 1_000;
const MAXIMUM_RESULT_LIMIT = 10_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;
const DEFAULT_TRANSACTION_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_MAX_CACHE_ENTRIES = 20;
const MAX_DIAGNOSTICS = 100;
const MAX_PUBLIC_LINE_PREVIEW_CODE_POINTS = 240;
const MAX_PUBLIC_MATCH_TEXT_CODE_POINTS = 256;

interface InternalSearchMatch extends WorkspaceSearchMatch {
  startOffset: number;
  endOffset: number;
  captures: Array<string | undefined>;
  ordinal: number;
}

interface QueryFileRecord {
  absolutePath: string;
  filePath: string;
  originalBytes: Buffer;
  originalHash: string;
  snapshot: TextFileSnapshot;
  matches: InternalSearchMatch[];
}

interface QueryCacheRecord {
  id: string;
  expiresAt: number;
  request: Required<Pick<WorkspaceSearchQueryRequest, 'query' | 'scope' | 'isRegex' | 'matchCase'>>;
  files: Map<string, QueryFileRecord>;
  matches: InternalSearchMatch[];
  truncated: boolean;
  estimatedBytes: number;
}

interface PreviewFileRecord {
  absolutePath: string;
  filePath: string;
  originalBytes: Buffer;
  originalHash: string;
  appliedBytes: Buffer;
  appliedHash: string;
  replacements: number;
  before: string;
  after: string;
}

interface PreviewCacheRecord {
  id: string;
  queryId: string;
  expiresAt: number;
  files: PreviewFileRecord[];
  replacementCount: number;
  estimatedBytes: number;
}

interface TransactionCacheRecord {
  id: string;
  expiresAt: number;
  files: PreviewFileRecord[];
  replacementCount: number;
  estimatedBytes: number;
}

interface SearchCounters {
  scannedFiles: number;
  skippedFiles: number;
}

interface CandidateCollection {
  files: string[];
  diagnostics: WorkspaceSearchDiagnostic[];
  skippedLinks: number;
}

/**
 * Workspace-wide text search and transactional replacement.
 *
 * Search caches retain exact file bytes and hashes. Preview, apply, and
 * rollback each validate hashes again so external edits can never be silently
 * overwritten. All disk writes use a same-directory temporary file followed
 * by rename, making an injected write/rename failure recoverable in tests and
 * in normal operation.
 */
export class WorkspaceSearchService {
  private readonly workspaceRoot: string;
  private readonly pathPolicy: WorkspacePathPolicy;
  private readonly solutionService: SolutionService;
  private readonly operations: WorkspaceSearchFileOperations;
  private readonly maxFileBytes: number;
  private readonly maxRetainedBytes: number;
  private readonly maxMatchedFiles: number;
  private readonly maxPreviewBytes: number;
  private readonly maxTotalCacheBytes: number;
  private readonly maxTransactionEntries: number;
  private readonly maxQueryLength: number;
  private readonly defaultMaxResults: number;
  private readonly maximumMaxResults: number;
  private readonly cacheTtlMs: number;
  private readonly transactionTtlMs: number;
  private readonly maxCacheEntries: number;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly queries = new Map<string, QueryCacheRecord>();
  private readonly previews = new Map<string, PreviewCacheRecord>();
  private readonly transactions = new Map<string, TransactionCacheRecord>();
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(workspaceRoot: string, options: WorkspaceSearchServiceOptions = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.pathPolicy = new WorkspacePathPolicy(this.workspaceRoot);
    this.solutionService = createSolutionService(this.workspaceRoot);
    this.operations = {
      writeFile: options.fileOperations?.writeFile ?? (async (filePath, data) => {
        await fs.writeFile(filePath, data);
      }),
      rename: options.fileOperations?.rename ?? (async (sourcePath, targetPath) => {
        await fs.rename(sourcePath, targetPath);
      }),
      remove: options.fileOperations?.remove ?? (async filePath => {
        await fs.rm(filePath, { force: true });
      })
    };
    this.maxFileBytes = positiveInteger(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
    this.maxRetainedBytes = positiveInteger(options.maxRetainedBytes, DEFAULT_MAX_RETAINED_BYTES);
    this.maxMatchedFiles = positiveInteger(options.maxMatchedFiles, DEFAULT_MAX_MATCHED_FILES);
    this.maxPreviewBytes = positiveInteger(options.maxPreviewBytes, DEFAULT_MAX_PREVIEW_BYTES);
    this.maxTotalCacheBytes = positiveInteger(options.maxTotalCacheBytes, DEFAULT_MAX_TOTAL_CACHE_BYTES);
    this.maxTransactionEntries = positiveInteger(options.maxTransactionEntries, DEFAULT_MAX_TRANSACTION_ENTRIES);
    this.maxQueryLength = positiveInteger(options.maxQueryLength, DEFAULT_MAX_QUERY_LENGTH);
    this.defaultMaxResults = positiveInteger(options.defaultMaxResults, DEFAULT_RESULT_LIMIT);
    this.maximumMaxResults = positiveInteger(options.maximumMaxResults, MAXIMUM_RESULT_LIMIT);
    this.cacheTtlMs = positiveInteger(options.cacheTtlMs, DEFAULT_CACHE_TTL_MS);
    this.transactionTtlMs = positiveInteger(options.transactionTtlMs, DEFAULT_TRANSACTION_TTL_MS);
    this.maxCacheEntries = positiveInteger(options.maxCacheEntries, DEFAULT_MAX_CACHE_ENTRIES);
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? randomUUID;
  }

  async query(request: WorkspaceSearchQueryRequest): Promise<WorkspaceSearchQueryResponse> {
    const normalizedRequest = this.validateQueryRequest(request);
    const matcher = createMatcher(normalizedRequest.query, normalizedRequest.isRegex, normalizedRequest.matchCase);
    const diagnostics: WorkspaceSearchDiagnostic[] = [];
    const maxResults = this.resolveResultLimit(request.maxResults, diagnostics);
    const candidates = await this.collectCandidateFiles(request);
    for (const diagnostic of candidates.diagnostics) addDiagnostic(diagnostics, diagnostic);
    if (candidates.skippedLinks > 0) {
      addDiagnostic(diagnostics, {
        code: 'SYMLINK_SKIPPED',
        level: 'info',
        message: `已忽略 ${candidates.skippedLinks} 个符号链接或目录联接，未跟随其目标。`
      });
    }

    const queryId = this.makeId('query');
    const files = new Map<string, QueryFileRecord>();
    const matches: InternalSearchMatch[] = [];
    const counters: SearchCounters = { scannedFiles: 0, skippedFiles: candidates.skippedLinks };
    let truncationReason: 'results' | 'snapshot' | null = null;
    let ordinal = 0;
    let retainedBytes = 0;

    for (const absolutePath of candidates.files) {
      const fileRecord = await this.readCandidateFile(absolutePath, diagnostics, counters);
      if (!fileRecord) continue;
      counters.scannedFiles += 1;

      const remaining = Math.max(0, maxResults - matches.length);
      const found = findMatches(
        fileRecord.snapshot.content,
        fileRecord.filePath,
        matcher,
        remaining + 1,
        queryId,
        ordinal
      );
      if (found.length === 0) continue;

      const accepted = found.slice(0, remaining);
      if (accepted.length > 0) {
        const fileRetainedBytes = estimateRetainedQueryFileBytes(fileRecord, accepted);
        const matchedFileLimitReached = files.size >= this.maxMatchedFiles;
        const retainedByteLimitReached = retainedBytes + fileRetainedBytes > this.maxRetainedBytes;
        if (matchedFileLimitReached || retainedByteLimitReached) {
          truncationReason = 'snapshot';
          addDiagnostic(diagnostics, {
            code: 'QUERY_SNAPSHOT_LIMIT',
            level: 'warning',
            message: matchedFileLimitReached
              ? `为保证搜索替换的内存安全，查询快照最多保留 ${this.maxMatchedFiles} 个匹配文件；后续结果未返回。`
              : `为保证搜索替换的内存安全，查询快照最多保留 ${formatBytes(this.maxRetainedBytes)}；后续结果未返回。`
          });
          break;
        }
        retainedBytes += fileRetainedBytes;
      }
      ordinal += accepted.length;
      fileRecord.matches = accepted;
      if (accepted.length > 0) {
        files.set(fileRecord.filePath, fileRecord);
        matches.push(...accepted);
      }
      if (found.length > remaining) {
        truncationReason = 'results';
        break;
      }
    }

    const truncated = truncationReason !== null;
    if (truncationReason === 'results') {
      addDiagnostic(diagnostics, {
        code: 'RESULT_TRUNCATED',
        level: 'warning',
        message: `搜索结果已达到 ${maxResults} 条上限，后续结果未返回；请缩小范围或提高上限。`
      });
    }

    const record: QueryCacheRecord = {
      id: queryId,
      expiresAt: this.now() + this.cacheTtlMs,
      request: normalizedRequest,
      files,
      matches,
      truncated,
      estimatedBytes: Math.max(512, retainedBytes)
    };
    this.storeCache(this.queries, queryId, record);

    return {
      queryId,
      matches: matches.map(toPublicMatch),
      truncated,
      scannedFiles: counters.scannedFiles,
      skippedFiles: counters.skippedFiles,
      diagnostics
    };
  }

  async preview(request: WorkspaceReplacePreviewRequest): Promise<WorkspaceReplacePreviewResponse> {
    if (!request || typeof request.queryId !== 'string' || !request.queryId.trim()) {
      throw new WorkspaceSearchError('INVALID_REQUEST', '替换预览缺少有效的 queryId。');
    }
    if (typeof request.replacement !== 'string') {
      throw new WorkspaceSearchError('INVALID_REQUEST', '替换内容必须是字符串。');
    }
    const query = this.getCache(this.queries, request.queryId, 'QUERY_NOT_FOUND', 'QUERY_EXPIRED');
    if (!request.matchIds && query.truncated) {
      throw new WorkspaceSearchError(
        'RESULT_TRUNCATED',
        '当前搜索结果已被截断，不能直接全部替换；请缩小搜索范围或明确选择匹配项。'
      );
    }

    const selectedMatches = selectMatches(query, request.matchIds);
    if (selectedMatches.length === 0) {
      throw new WorkspaceSearchError('NO_MATCHES', '没有可用于替换预览的匹配项。');
    }
    const matchesByFile = groupMatchesByFile(selectedMatches);
    const previewFiles: PreviewFileRecord[] = [];
    let previewBytes = 0;

    for (const [filePath, selected] of matchesByFile) {
      const queryFile = query.files.get(filePath);
      if (!queryFile) {
        throw new WorkspaceSearchError('INVALID_MATCH', `匹配项所属文件不在查询快照中：${filePath}`, filePath);
      }
      const currentBytes = await this.readAndValidateSnapshot(queryFile.absolutePath, queryFile.originalHash, filePath);
      const beforeBytes = jsonStringByteLength(queryFile.snapshot.content);
      if (previewBytes + beforeBytes > this.maxPreviewBytes) {
        throw previewTooLargeError(this.maxPreviewBytes);
      }
      const after = applySelectedMatches(
        queryFile.snapshot.content,
        selected,
        request.replacement,
        query.request.isRegex,
        this.maxPreviewBytes - previewBytes - beforeBytes,
        this.maxPreviewBytes
      );
      const afterBytes = jsonStringByteLength(after);
      previewBytes += beforeBytes + afterBytes;
      if (previewBytes > this.maxPreviewBytes) {
        throw previewTooLargeError(this.maxPreviewBytes);
      }
      const appliedBytes = encodeTextFile(after, queryFile.snapshot.format);
      previewFiles.push({
        absolutePath: queryFile.absolutePath,
        filePath,
        originalBytes: currentBytes,
        originalHash: queryFile.originalHash,
        appliedBytes,
        appliedHash: hashBytes(appliedBytes),
        replacements: selected.length,
        before: queryFile.snapshot.content,
        after
      });
    }

    const previewId = this.makeId('preview');
    const replacementCount = selectedMatches.length;
    const estimatedBytes = estimatePreviewRecordBytes(previewFiles);
    this.storeCache(this.previews, previewId, {
      id: previewId,
      queryId: query.id,
      expiresAt: this.now() + this.cacheTtlMs,
      files: previewFiles,
      replacementCount,
      estimatedBytes
    });

    return {
      previewId,
      queryId: query.id,
      files: previewFiles.map(toPublicPreviewFile),
      replacementCount,
      diagnostics: []
    };
  }

  async apply(request: WorkspaceReplaceApplyRequest): Promise<WorkspaceReplaceApplyResponse> {
    return await this.serializeMutation(async () => {
      if (!request || typeof request.previewId !== 'string' || !request.previewId.trim()) {
        throw new WorkspaceSearchError('INVALID_REQUEST', '应用替换缺少有效的 previewId。');
      }
      const preview = this.getCache(this.previews, request.previewId, 'PREVIEW_NOT_FOUND', 'PREVIEW_EXPIRED');
      // A preview is a one-shot capability. Retrying requires a fresh hash-checked preview.
      this.previews.delete(preview.id);
      try {
        this.ensureTransactionCapacity(preview.estimatedBytes);
      } catch (error) {
        this.previews.set(preview.id, preview);
        throw error;
      }

      await this.preflightFiles(preview.files, 'originalHash', 'FILE_CHANGED');
      const written: PreviewFileRecord[] = [];
      try {
        for (const file of preview.files) {
          await this.assertCurrentHash(file, file.originalHash, 'FILE_CHANGED');
          await this.writeAtomic(file, file.appliedBytes);
          // Once rename succeeds this file must participate in recovery even
          // when the following read-back or hash verification fails.
          written.push(file);
          const applied = await fs.readFile(file.absolutePath);
          if (hashBytes(applied) !== file.appliedHash) {
            throw new WorkspaceSearchError('WRITE_FAILED', `替换后文件校验失败：${file.filePath}`, file.filePath);
          }
        }
      } catch (error) {
        const recoveryError = await this.restoreFiles(written.slice().reverse(), 'originalBytes', 'originalHash');
        if (recoveryError) {
          throw new WorkspaceSearchError(
            'CONSISTENCY_RECOVERY_FAILED',
            `替换失败，且恢复已写文件时发生错误：${toErrorMessage(recoveryError)}`,
            undefined,
            { cause: error }
          );
        }
        if (error instanceof WorkspaceSearchError) throw error;
        throw new WorkspaceSearchError('WRITE_FAILED', `替换写入失败，已恢复原文件：${toErrorMessage(error)}`, undefined, { cause: error });
      }

      const transactionId = this.makeId('transaction');
      this.storeTransaction(transactionId, {
        id: transactionId,
        expiresAt: this.now() + this.transactionTtlMs,
        files: preview.files,
        replacementCount: preview.replacementCount,
        estimatedBytes: preview.estimatedBytes
      });
      return {
        transactionId,
        updatedFiles: preview.files.map(file => file.filePath),
        replacementCount: preview.replacementCount
      };
    });
  }

  async rollback(request: WorkspaceReplaceRollbackRequest): Promise<WorkspaceReplaceRollbackResponse> {
    return await this.serializeMutation(async () => {
      if (!request || typeof request.transactionId !== 'string' || !request.transactionId.trim()) {
        throw new WorkspaceSearchError('INVALID_REQUEST', '回滚替换缺少有效的 transactionId。');
      }
      const transaction = this.getCache(
        this.transactions,
        request.transactionId,
        'TRANSACTION_NOT_FOUND',
        'TRANSACTION_EXPIRED'
      );
      await this.preflightFiles(transaction.files, 'appliedHash', 'ROLLBACK_CONFLICT');

      const restored: PreviewFileRecord[] = [];
      try {
        for (const file of transaction.files) {
          await this.assertCurrentHash(file, file.appliedHash, 'ROLLBACK_CONFLICT');
          await this.writeAtomic(file, file.originalBytes);
          // Symmetric with apply: a successful rename has already mutated the
          // target and therefore must be rolled forward if verification fails.
          restored.push(file);
          const original = await fs.readFile(file.absolutePath);
          if (hashBytes(original) !== file.originalHash) {
            throw new WorkspaceSearchError('WRITE_FAILED', `回滚后文件校验失败：${file.filePath}`, file.filePath);
          }
        }
      } catch (error) {
        // Roll forward every file already restored, leaving the transaction in
        // its fully-applied state rather than a half-rolled-back state.
        const recoveryError = await this.restoreFiles(restored.slice().reverse(), 'appliedBytes', 'appliedHash');
        if (recoveryError) {
          // The on-disk state is uncertain, so this capability can no longer
          // promise a safe hash-checked retry.
          this.transactions.delete(transaction.id);
          throw new WorkspaceSearchError(
            'CONSISTENCY_RECOVERY_FAILED',
            `回滚失败，且恢复到已应用状态时发生错误：${toErrorMessage(recoveryError)}`,
            undefined,
            { cause: error }
          );
        }
        if (error instanceof WorkspaceSearchError) throw error;
        throw new WorkspaceSearchError('WRITE_FAILED', `回滚写入失败，文件已恢复到替换后状态：${toErrorMessage(error)}`, undefined, { cause: error });
      }

      // A successful transaction may be rolled back only once. Conflicts and
      // fully recovered transient failures retain the capability for retry.
      this.transactions.delete(transaction.id);
      return {
        transactionId: transaction.id,
        restoredFiles: transaction.files.map(file => file.filePath)
      };
    });
  }

  private validateQueryRequest(
    request: WorkspaceSearchQueryRequest
  ): Required<Pick<WorkspaceSearchQueryRequest, 'query' | 'scope' | 'isRegex' | 'matchCase'>> {
    if (!request || typeof request.query !== 'string' || request.query.length === 0) {
      throw new WorkspaceSearchError('INVALID_REQUEST', '搜索内容不能为空。');
    }
    if (request.query.length > this.maxQueryLength) {
      throw new WorkspaceSearchError(
        'QUERY_TOO_LONG',
        `搜索内容过长：最多允许 ${this.maxQueryLength} 个字符。`
      );
    }
    if (!['file', 'project', 'workspace'].includes(request.scope)) {
      throw new WorkspaceSearchError('INVALID_REQUEST', '搜索范围必须是文件、项目或工作区。');
    }
    if (request.scope === 'file' && (!request.filePath || typeof request.filePath !== 'string')) {
      throw new WorkspaceSearchError('INVALID_REQUEST', '文件范围搜索必须指定工作区相对文件路径。');
    }
    if (request.isRegex) assertSafeRegex(request.query);
    return {
      query: request.query,
      scope: request.scope,
      isRegex: Boolean(request.isRegex),
      matchCase: Boolean(request.matchCase)
    };
  }

  private resolveResultLimit(value: number | undefined, diagnostics: WorkspaceSearchDiagnostic[]): number {
    if (value === undefined) return Math.min(this.defaultMaxResults, this.maximumMaxResults);
    if (!Number.isInteger(value) || value <= 0) {
      throw new WorkspaceSearchError('INVALID_RESULT_LIMIT', '搜索结果上限必须是正整数。');
    }
    if (value > this.maximumMaxResults) {
      addDiagnostic(diagnostics, {
        code: 'RESULT_LIMIT_CLAMPED',
        level: 'warning',
        message: `请求的结果上限过大，已限制为 ${this.maximumMaxResults} 条。`
      });
      return this.maximumMaxResults;
    }
    return value;
  }

  private async collectCandidateFiles(request: WorkspaceSearchQueryRequest): Promise<CandidateCollection> {
    if (request.scope === 'file') {
      try {
        const absolutePath = await this.pathPolicy.resolveExisting(request.filePath!, { rejectSymlinks: true });
        const stat = await fs.lstat(absolutePath);
        if (!stat.isFile()) {
          throw new WorkspaceSearchError('NOT_A_FILE', `搜索目标不是普通文件：${request.filePath}`, request.filePath);
        }
        return { files: [absolutePath], diagnostics: [], skippedLinks: 0 };
      } catch (error: any) {
        if (error instanceof WorkspaceSearchError) throw error;
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
          throw new WorkspaceSearchError('FILE_NOT_FOUND', `搜索文件不存在：${request.filePath}`, request.filePath);
        }
        throw convertPathError(error, request.filePath);
      }
    }

    if (request.scope === 'project') {
      let project: LingBuilderSolutionProject;
      try {
        const solution = await this.solutionService.getSolution();
        project = this.solutionService.getProject(solution, request.projectId);
      } catch (error) {
        throw new WorkspaceSearchError(
          'PROJECT_NOT_FOUND',
          `未找到要搜索的项目：${request.projectId || '启动项目'}。`,
          undefined,
          { cause: error }
        );
      }
      return await this.collectFromRoots([project.sourceRoot, project.configRoot]);
    }

    const root = await this.pathPolicy.getRealWorkspaceRoot();
    return await collectTreeFiles(root, this.workspaceRoot, this.pathPolicy, true);
  }

  private async collectFromRoots(relativeRoots: string[]): Promise<CandidateCollection> {
    const files = new Set<string>();
    const diagnostics: WorkspaceSearchDiagnostic[] = [];
    let skippedLinks = 0;
    for (const relativeRoot of [...new Set(relativeRoots)]) {
      try {
        const root = await this.pathPolicy.resolveExisting(relativeRoot, { rejectSymlinks: true });
        const stat = await fs.lstat(root);
        if (!stat.isDirectory()) {
          addDiagnostic(diagnostics, {
            code: 'PROJECT_ROOT_NOT_DIRECTORY',
            level: 'warning',
            message: `项目搜索根路径不是目录，已跳过：${relativeRoot}`,
            filePath: relativeRoot
          });
          continue;
        }
        const collected = await collectTreeFiles(root, this.workspaceRoot, this.pathPolicy, true);
        collected.files.forEach(file => files.add(file));
        collected.diagnostics.forEach(diagnostic => addDiagnostic(diagnostics, diagnostic));
        skippedLinks += collected.skippedLinks;
      } catch (error: any) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
          addDiagnostic(diagnostics, {
            code: 'PROJECT_ROOT_NOT_FOUND',
            level: 'warning',
            message: `项目搜索根目录不存在，已跳过：${relativeRoot}`,
            filePath: relativeRoot
          });
          continue;
        }
        throw convertPathError(error, relativeRoot);
      }
    }
    return { files: [...files].sort(comparePaths), diagnostics, skippedLinks };
  }

  private async readCandidateFile(
    absolutePath: string,
    diagnostics: WorkspaceSearchDiagnostic[],
    counters: SearchCounters
  ): Promise<QueryFileRecord | null> {
    const filePath = toRelativePath(this.workspaceRoot, absolutePath);
    try {
      const stat = await fs.lstat(absolutePath);
      if (!stat.isFile()) {
        counters.skippedFiles += 1;
        return null;
      }
      if (stat.size > this.maxFileBytes) {
        counters.skippedFiles += 1;
        addDiagnostic(diagnostics, {
          code: 'FILE_TOO_LARGE',
          level: 'warning',
          message: `文件超过 ${formatBytes(this.maxFileBytes)} 搜索上限，已跳过：${filePath}`,
          filePath
        });
        return null;
      }
      const originalBytes = await fs.readFile(absolutePath);
      if (originalBytes.length > this.maxFileBytes) {
        counters.skippedFiles += 1;
        addDiagnostic(diagnostics, {
          code: 'FILE_TOO_LARGE',
          level: 'warning',
          message: `文件读取时超过 ${formatBytes(this.maxFileBytes)} 搜索上限，已跳过：${filePath}`,
          filePath
        });
        return null;
      }
      const snapshot = decodeTextFile(originalBytes);
      if (snapshot.content.includes('\0')) {
        counters.skippedFiles += 1;
        addDiagnostic(diagnostics, {
          code: 'BINARY_FILE_SKIPPED',
          level: 'warning',
          message: `文件包含 NUL 字节，可能是二进制文件，已跳过以避免损坏：${filePath}`,
          filePath
        });
        return null;
      }
      return {
        absolutePath,
        filePath,
        originalBytes,
        originalHash: hashBytes(originalBytes),
        snapshot,
        matches: []
      };
    } catch (error) {
      counters.skippedFiles += 1;
      addDiagnostic(diagnostics, {
        code: 'FILE_READ_SKIPPED',
        level: 'warning',
        message: `无法按受支持的文本编码搜索文件，已跳过：${filePath}（${toErrorMessage(error)}）`,
        filePath
      });
      return null;
    }
  }

  private async readAndValidateSnapshot(absolutePath: string, expectedHash: string, filePath: string): Promise<Buffer> {
    let resolved: string;
    try {
      resolved = await this.pathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    } catch (error) {
      throw convertPathError(error, filePath);
    }
    if (!pathsEqual(resolved, absolutePath)) {
      throw new WorkspaceSearchError('FILE_CHANGED', `文件路径目标已发生变化，请重新搜索：${filePath}`, filePath);
    }
    const bytes = await fs.readFile(resolved);
    if (hashBytes(bytes) !== expectedHash) {
      throw new WorkspaceSearchError('FILE_CHANGED', `文件已在搜索后被修改，请重新搜索：${filePath}`, filePath);
    }
    return bytes;
  }

  private async preflightFiles(
    files: PreviewFileRecord[],
    hashKey: 'originalHash' | 'appliedHash',
    errorCode: 'FILE_CHANGED' | 'ROLLBACK_CONFLICT'
  ): Promise<void> {
    for (const file of files) {
      await this.assertCurrentHash(file, file[hashKey], errorCode);
    }
  }

  private async assertCurrentHash(
    file: PreviewFileRecord,
    expectedHash: string,
    errorCode: 'FILE_CHANGED' | 'ROLLBACK_CONFLICT'
  ): Promise<void> {
    let bytes: Buffer;
    try {
      const resolved = await this.pathPolicy.resolveExisting(file.filePath, { rejectSymlinks: true });
      if (!pathsEqual(resolved, file.absolutePath)) {
        throw new Error('文件路径已指向其他目标');
      }
      bytes = await fs.readFile(resolved);
    } catch (error) {
      throw new WorkspaceSearchError(
        errorCode,
        `${errorCode === 'ROLLBACK_CONFLICT' ? '无法回滚' : '无法应用替换'}：文件路径或内容已变化：${file.filePath}`,
        file.filePath,
        { cause: error }
      );
    }
    if (hashBytes(bytes) !== expectedHash) {
      throw new WorkspaceSearchError(
        errorCode,
        `${errorCode === 'ROLLBACK_CONFLICT' ? '无法回滚，替换后的文件又被修改' : '文件在预览后被修改，请重新搜索'}：${file.filePath}`,
        file.filePath
      );
    }
  }

  private async writeAtomic(file: PreviewFileRecord, bytes: Buffer): Promise<void> {
    const tempName = `.${path.basename(file.absolutePath)}.lingbuilder-${this.makeId('write').replace(/[^a-zA-Z0-9_-]/gu, '')}.tmp`;
    const tempPath = path.join(path.dirname(file.absolutePath), tempName);
    try {
      await this.operations.writeFile(tempPath, bytes);
      await this.operations.rename(tempPath, file.absolutePath);
    } catch (error) {
      try {
        await this.operations.remove(tempPath);
      } catch {
        // The primary write error is more useful; stale temp files are safe and
        // remain inside the validated workspace directory.
      }
      throw error;
    }
  }

  private async restoreFiles(
    files: PreviewFileRecord[],
    bytesKey: 'originalBytes' | 'appliedBytes',
    hashKey: 'originalHash' | 'appliedHash'
  ): Promise<unknown | null> {
    let firstError: unknown | null = null;
    for (const file of files) {
      try {
        await this.writeAtomic(file, file[bytesKey]);
        const restored = await fs.readFile(file.absolutePath);
        if (hashBytes(restored) !== file[hashKey]) {
          throw new Error(`恢复后的文件哈希不一致：${file.filePath}`);
        }
      } catch (error) {
        firstError ??= error;
      }
    }
    return firstError;
  }

  private async serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail;
    let release!: () => void;
    this.mutationTail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private getCache<T extends { expiresAt: number }>(
    cache: Map<string, T>,
    id: string,
    missingCode: 'QUERY_NOT_FOUND' | 'PREVIEW_NOT_FOUND' | 'TRANSACTION_NOT_FOUND',
    expiredCode: 'QUERY_EXPIRED' | 'PREVIEW_EXPIRED' | 'TRANSACTION_EXPIRED'
  ): T {
    const record = cache.get(id);
    if (!record) {
      throw new WorkspaceSearchError(missingCode, cacheMissingMessage(missingCode));
    }
    if (record.expiresAt <= this.now()) {
      cache.delete(id);
      throw new WorkspaceSearchError(expiredCode, cacheExpiredMessage(expiredCode));
    }
    return record;
  }

  private storeCache<T extends { expiresAt: number; estimatedBytes: number }>(
    cache: Map<string, T>,
    id: string,
    value: T
  ): void {
    this.pruneExpiredCaches();
    while (cache.size >= this.maxCacheEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    this.ensureTotalCacheCapacity(value.estimatedBytes);
    cache.set(id, value);
  }

  private storeTransaction(id: string, value: TransactionCacheRecord): void {
    this.pruneExpiredCaches();
    if (this.transactions.size >= this.maxTransactionEntries) {
      throw new WorkspaceSearchError(
        'CACHE_CAPACITY_EXCEEDED',
        `当前已有 ${this.transactions.size} 个可撤销替换事务；请先撤销、等待过期或重新启动工作区服务。`
      );
    }
    this.ensureTotalCacheCapacity(value.estimatedBytes);
    this.transactions.set(id, value);
  }

  private ensureTransactionCapacity(estimatedBytes: number): void {
    this.pruneExpiredCaches();
    if (this.transactions.size >= this.maxTransactionEntries) {
      throw new WorkspaceSearchError(
        'CACHE_CAPACITY_EXCEEDED',
        `可撤销替换事务已达到 ${this.maxTransactionEntries} 个安全上限；请先撤销已有事务或等待其过期。`
      );
    }
    this.ensureTotalCacheCapacity(estimatedBytes);
  }

  private ensureTotalCacheCapacity(requiredBytes: number): void {
    if (requiredBytes > this.maxTotalCacheBytes) {
      throw new WorkspaceSearchError(
        'CACHE_CAPACITY_EXCEEDED',
        `本次搜索替换快照需要 ${formatBytes(requiredBytes)}，超过 ${formatBytes(this.maxTotalCacheBytes)} 总缓存上限。`
      );
    }
    while (this.totalCacheBytes() + requiredBytes > this.maxTotalCacheBytes) {
      if (!this.evictOldestReplaceableCache()) {
        throw new WorkspaceSearchError(
          'CACHE_CAPACITY_EXCEEDED',
          `搜索替换缓存已达到 ${formatBytes(this.maxTotalCacheBytes)} 总上限，且可撤销事务不能被静默清除。`
        );
      }
    }
  }

  private evictOldestReplaceableCache(): boolean {
    const queryId = this.queries.keys().next().value as string | undefined;
    if (queryId) {
      this.queries.delete(queryId);
      return true;
    }
    const previewId = this.previews.keys().next().value as string | undefined;
    if (previewId) {
      this.previews.delete(previewId);
      return true;
    }
    return false;
  }

  private totalCacheBytes(): number {
    let total = 0;
    for (const record of this.queries.values()) total += record.estimatedBytes;
    for (const record of this.previews.values()) total += record.estimatedBytes;
    for (const record of this.transactions.values()) total += record.estimatedBytes;
    return total;
  }

  private pruneExpiredCaches(): void {
    const now = this.now();
    for (const cache of [this.queries, this.previews, this.transactions] as const) {
      for (const [cacheId, record] of cache) {
        if (record.expiresAt <= now) cache.delete(cacheId);
      }
    }
  }

  private makeId(prefix: string): string {
    return `${prefix}-${this.createId()}`;
  }
}

export function createWorkspaceSearchService(
  workspaceRoot: string,
  options?: WorkspaceSearchServiceOptions
): WorkspaceSearchService {
  return new WorkspaceSearchService(workspaceRoot, options);
}

async function collectTreeFiles(
  root: string,
  workspaceRoot: string,
  pathPolicy: WorkspacePathPolicy,
  ignoreDirectories: boolean
): Promise<CandidateCollection> {
  const files: string[] = [];
  const diagnostics: WorkspaceSearchDiagnostic[] = [];
  let skippedLinks = 0;

  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      addDiagnostic(diagnostics, {
        code: 'DIRECTORY_READ_SKIPPED',
        level: 'warning',
        message: `无法读取目录，已跳过：${toRelativePath(workspaceRoot, directory)}（${toErrorMessage(error)}）`,
        filePath: toRelativePath(workspaceRoot, directory)
      });
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    for (const entry of entries) {
      if (ignoreDirectories && entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLocaleLowerCase('en-US'))) {
        continue;
      }
      const target = path.join(directory, entry.name);
      let stat;
      try {
        stat = await fs.lstat(target);
      } catch (error) {
        addDiagnostic(diagnostics, {
          code: 'PATH_READ_SKIPPED',
          level: 'warning',
          message: `无法检查路径，已跳过：${toRelativePath(workspaceRoot, target)}（${toErrorMessage(error)}）`,
          filePath: toRelativePath(workspaceRoot, target)
        });
        continue;
      }
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) {
        skippedLinks += 1;
        continue;
      }
      if (stat.isDirectory()) {
        if (ignoreDirectories && IGNORED_DIRECTORY_NAMES.has(entry.name.toLocaleLowerCase('en-US'))) continue;
        await visit(target);
        continue;
      }
      if (!stat.isFile()) continue;
      try {
        const safePath = await pathPolicy.resolveExisting(toRelativePath(workspaceRoot, target), { rejectSymlinks: true });
        files.push(safePath);
      } catch (error) {
        if (error instanceof WorkspacePathPolicyError && error.code === 'SYMLINK_NOT_ALLOWED') {
          skippedLinks += 1;
          continue;
        }
        addDiagnostic(diagnostics, {
          code: 'PATH_REJECTED',
          level: 'warning',
          message: `文件路径未通过工作区安全检查，已跳过：${toRelativePath(workspaceRoot, target)}`,
          filePath: toRelativePath(workspaceRoot, target)
        });
      }
    }
  };

  await visit(root);
  return { files: files.sort(comparePaths), diagnostics, skippedLinks };
}

function createMatcher(query: string, isRegex: boolean, matchCase: boolean): RegExp {
  const source = isRegex ? query : escapeRegExp(query);
  const flags = `gmu${matchCase ? '' : 'i'}`;
  try {
    return new RegExp(source, flags);
  } catch (error) {
    throw new WorkspaceSearchError('INVALID_REGEX', `正则表达式无效：${toErrorMessage(error)}`, undefined, { cause: error });
  }
}

function assertSafeRegex(pattern: string): void {
  // Remove escaped characters, character classes, and group prefixes before
  // applying conservative nested/ambiguous quantifier checks.
  const simplified = pattern
    .replace(/\\./gu, 'x')
    .replace(/\[(?:[^\]\\]|\\.)*\]/gu, 'x')
    .replace(/\(\?(?:[:=!]|<[=!]?)/gu, '(');
  const quantifier = String.raw`(?:[+*?]|\{\d+(?:,\d*)?\})`;
  const unboundedQuantifier = String.raw`(?:[+*]|\{\d+,\})`;
  const nestedQuantifier = new RegExp(String.raw`\([^()]*${quantifier}[^()]*\)\s*${quantifier}`, 'u');
  const ambiguousAlternation = new RegExp(String.raw`\([^()]*\|[^()]*\)\s*${quantifier}`, 'u');
  const numericBackReference = /\\[1-9]\d*/u;
  const namedBackReference = /\\k<[^>]+>/u;
  const adjacentUnboundedGroups = new RegExp(
    String.raw`\([^()]*\)\s*${unboundedQuantifier}\s*\([^()]*\)\s*${unboundedQuantifier}`,
    'u'
  );
  const excessiveOptionalQuantifiers = (simplified.match(/\?/gu)?.length ?? 0) >= 8
    || hasUnsafeBoundedQuantifierBudget(simplified);
  if (
    nestedQuantifier.test(simplified)
    || ambiguousAlternation.test(simplified)
    || numericBackReference.test(pattern)
    || namedBackReference.test(pattern)
    || adjacentUnboundedGroups.test(simplified)
    || excessiveOptionalQuantifiers
    || hasDangerousUnboundedQuantifierCombination(pattern)
  ) {
    throw new WorkspaceSearchError(
      'UNSAFE_REGEX',
      '正则表达式包含潜在灾难性回溯结构，已拒绝执行；请移除嵌套量词或重复分支。'
    );
  }
  try {
    // Compile here so invalid expressions are reported before scanning files.
    new RegExp(pattern, 'gmu');
  } catch (error) {
    throw new WorkspaceSearchError('INVALID_REGEX', `正则表达式无效：${toErrorMessage(error)}`, undefined, { cause: error });
  }
}

/**
 * A long chain of finite choices such as `a{0,1}` is just as exponential as
 * a long `a?` chain on a failed anchored match. Very large finite bounds can
 * also monopolize the local renderer service. Keep the accepted subset
 * deliberately conservative and ask callers to split unusually complex
 * searches into smaller queries.
 */
function hasUnsafeBoundedQuantifierBudget(pattern: string): boolean {
  const quantifiers = pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/gu);
  let variableChoiceCount = 0;
  for (const match of quantifiers) {
    const lower = Number.parseInt(match[1], 10);
    const hasComma = match[0].includes(',');
    const upperText = match[2];
    const upper = hasComma && upperText !== ''
      ? Number.parseInt(upperText, 10)
      : hasComma
        ? Number.POSITIVE_INFINITY
        : lower;
    if (lower > 10_000 || (Number.isFinite(upper) && upper > 10_000)) return true;
    if (Number.isFinite(upper) && upper > lower) variableChoiceCount += 1;
    if (variableChoiceCount >= 8) return true;
  }
  return false;
}

interface UnboundedQuantifiedAtom {
  key: string;
  wildcard: boolean;
  start: number;
  end: number;
}

/**
 * Reject a deliberately conservative set of polynomial/exponential patterns
 * not covered by the nested-group checks above. In particular, a quantified
 * wildcard combined with another unbounded atom (`a+.*a+$`) and repeated
 * unbounded atoms (`a+a+$`) can make a failed match scan the same input ranges
 * combinatorially. This scanner does not attempt to execute or time a regex.
 */
function hasDangerousUnboundedQuantifierCombination(pattern: string): boolean {
  const atoms: UnboundedQuantifiedAtom[] = [];
  for (let index = 0; index < pattern.length;) {
    let key: string | null = null;
    let wildcard = false;
    const start = index;
    const char = pattern[index];

    if (char === '\\') {
      if (index + 1 >= pattern.length) break;
      const escapeKind = pattern[index + 1];
      if ((escapeKind === 'p' || escapeKind === 'P') && pattern[index + 2] === '{') {
        const closingBrace = pattern.indexOf('}', index + 3);
        index = closingBrace >= 0 ? closingBrace + 1 : index + 2;
      } else {
        index += 2;
      }
      key = pattern.slice(start, index);
    } else if (char === '[') {
      index += 1;
      let escaped = false;
      while (index < pattern.length) {
        const current = pattern[index++];
        if (!escaped && current === ']') break;
        if (!escaped && current === '\\') escaped = true;
        else escaped = false;
      }
      key = pattern.slice(start, index);
    } else if ('(){}|?+*^$'.includes(char)) {
      index += 1;
      continue;
    } else {
      key = char;
      wildcard = char === '.';
      index += 1;
    }

    if (!key) continue;
    const quantifier = readUnboundedQuantifier(pattern, index);
    if (!quantifier) continue;
    atoms.push({ key, wildcard, start, end: quantifier.end });
    index = quantifier.end;
    // Lazy/possessive-style suffixes do not remove the unsafe overlap. The
    // latter is not currently valid JavaScript but is left for clear scanning.
    if (pattern[index] === '?') index += 1;
  }

  if (atoms.some(atom => atom.wildcard) && atoms.length > 1) return true;
  const seen = new Set<string>();
  for (let index = 0; index < atoms.length; index += 1) {
    const atom = atoms[index];
    if (seen.has(atom.key)) return true;
    seen.add(atom.key);
    const next = atoms[index + 1];
    if (next) {
      const gap = pattern.slice(atom.end, next.start);
      // Parentheses, anchors, lookaround prefixes, and whitespace escapes do
      // not consume a fixed delimiter. Adjacent unbounded chains are rejected
      // conservatively even when their character sets might be disjoint.
      if (/^[()?:=!<>^$]*$/u.test(gap)) return true;
    }
  }
  return false;
}

function readUnboundedQuantifier(pattern: string, index: number): { end: number } | null {
  if (pattern[index] === '*' || pattern[index] === '+') return { end: index + 1 };
  if (pattern[index] !== '{') return null;
  const match = /^\{\d+,\}/u.exec(pattern.slice(index));
  return match ? { end: index + match[0].length } : null;
}

function findMatches(
  content: string,
  filePath: string,
  template: RegExp,
  maxMatches: number,
  queryId: string,
  ordinalStart: number
): InternalSearchMatch[] {
  if (maxMatches <= 0) return [];
  const matcher = new RegExp(template.source, template.flags);
  const matches: InternalSearchMatch[] = [];
  const lineStarts = createLineStarts(content);
  const resolvePosition = createMonotonicPositionResolver(content);
  let ordinal = ordinalStart;

  while (matches.length < maxMatches) {
    const result = matcher.exec(content);
    if (!result) break;
    const startOffset = result.index;
    const endOffset = startOffset + result[0].length;
    const start = resolvePosition(startOffset);
    const end = resolvePosition(endOffset);
    const preview = linePreview(content, lineStarts, start.line, startOffset);
    matches.push({
      id: `${queryId}:match-${ordinal + 1}`,
      filePath,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
      matchText: result[0],
      preview: preview.text,
      ...(preview.truncated ? { previewTruncated: true } : {}),
      startOffset,
      endOffset,
      captures: result.slice(1),
      ordinal
    });
    ordinal += 1;

    if (result[0].length === 0) {
      matcher.lastIndex = advanceUnicodeIndex(content, matcher.lastIndex);
    }
  }
  return matches;
}

function createLineStarts(content: string): number[] {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 0x0a) starts.push(index + 1);
  }
  return starts;
}

function createMonotonicPositionResolver(
  content: string
): (offset: number) => { line: number; column: number } {
  let cursor = 0;
  let line = 1;
  let column = 1;
  return requestedOffset => {
    const target = Math.max(cursor, Math.min(content.length, requestedOffset));
    while (cursor < target) {
      const first = content.charCodeAt(cursor);
      if (first === 0x0a) {
        cursor += 1;
        line += 1;
        column = 1;
        continue;
      }
      if (first >= 0xd800 && first <= 0xdbff && cursor + 1 < target) {
        const second = content.charCodeAt(cursor + 1);
        if (second >= 0xdc00 && second <= 0xdfff) cursor += 2;
        else cursor += 1;
      } else {
        cursor += 1;
      }
      column += 1;
    }
    return { line, column };
  };
}

function linePreview(
  content: string,
  lineStarts: number[],
  line: number,
  matchOffset: number
): { text: string; truncated: boolean } {
  const lineIndex = line - 1;
  const start = lineStarts[lineIndex] ?? 0;
  const next = lineStarts[lineIndex + 1];
  const end = next === undefined ? content.length : Math.max(start, next - 1);
  const safeMatchOffset = Math.max(start, Math.min(end, matchOffset));
  const halfWindow = Math.floor(MAX_PUBLIC_LINE_PREVIEW_CODE_POINTS / 2);
  const left = retreatCodePoints(content, safeMatchOffset, start, halfWindow);
  const right = advanceCodePoints(
    content,
    safeMatchOffset,
    end,
    MAX_PUBLIC_LINE_PREVIEW_CODE_POINTS - left.count
  );
  const extraLeft = retreatCodePoints(
    content,
    left.index,
    start,
    MAX_PUBLIC_LINE_PREVIEW_CODE_POINTS - left.count - right.count
  );
  const windowStart = extraLeft.index;
  const windowEnd = right.index;
  const truncated = windowStart > start || windowEnd < end;
  return {
    text: `${windowStart > start ? '…' : ''}${content.slice(windowStart, windowEnd)}${windowEnd < end ? '…' : ''}`,
    truncated
  };
}

function retreatCodePoints(
  content: string,
  from: number,
  minimum: number,
  maximumCount: number
): { index: number; count: number } {
  let index = from;
  let count = 0;
  while (index > minimum && count < maximumCount) {
    index -= 1;
    const current = content.charCodeAt(index);
    if (current >= 0xdc00 && current <= 0xdfff && index > minimum) {
      const previous = content.charCodeAt(index - 1);
      if (previous >= 0xd800 && previous <= 0xdbff) index -= 1;
    }
    count += 1;
  }
  return { index, count };
}

function advanceCodePoints(
  content: string,
  from: number,
  maximum: number,
  maximumCount: number
): { index: number; count: number } {
  let index = from;
  let count = 0;
  while (index < maximum && count < maximumCount) {
    const first = content.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff && index + 1 < maximum) {
      const second = content.charCodeAt(index + 1);
      index += second >= 0xdc00 && second <= 0xdfff ? 2 : 1;
    } else {
      index += 1;
    }
    count += 1;
  }
  return { index, count };
}

function advanceUnicodeIndex(content: string, index: number): number {
  if (index >= content.length) return content.length + 1;
  const first = content.charCodeAt(index);
  if (first >= 0xd800 && first <= 0xdbff) {
    const second = content.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) return index + 2;
  }
  return index + 1;
}

function estimateRetainedQueryFileBytes(
  file: QueryFileRecord,
  matches: InternalSearchMatch[]
): number {
  let bytes = file.originalBytes.byteLength + file.snapshot.content.length * 2;
  for (const match of matches) {
    bytes += 256;
    bytes += match.matchText.length * 2;
    bytes += match.preview.length * 2;
    for (const capture of match.captures) bytes += (capture?.length ?? 0) * 2;
  }
  return bytes;
}

function estimatePreviewRecordBytes(files: PreviewFileRecord[]): number {
  let bytes = 512;
  for (const file of files) {
    bytes += 512;
    bytes += file.originalBytes.byteLength + file.appliedBytes.byteLength;
    bytes += file.before.length * 2 + file.after.length * 2;
    bytes += file.filePath.length * 2;
  }
  return bytes;
}

function selectMatches(query: QueryCacheRecord, matchIds?: string[]): InternalSearchMatch[] {
  if (!matchIds) return [...query.matches];
  if (!Array.isArray(matchIds)) {
    throw new WorkspaceSearchError('INVALID_MATCH', 'matchIds 必须是匹配项 ID 数组。');
  }
  const requested = new Set(matchIds);
  if (requested.size !== matchIds.length) {
    throw new WorkspaceSearchError('INVALID_MATCH', '匹配项 ID 不能重复。');
  }
  const available = new Map(query.matches.map(match => [match.id, match]));
  const selected: InternalSearchMatch[] = [];
  for (const id of requested) {
    const match = available.get(id);
    if (!match) {
      throw new WorkspaceSearchError('INVALID_MATCH', `匹配项不存在或不属于当前查询：${id}`);
    }
    selected.push(match);
  }
  return selected.sort((left, right) => left.ordinal - right.ordinal);
}

function groupMatchesByFile(matches: InternalSearchMatch[]): Map<string, InternalSearchMatch[]> {
  const grouped = new Map<string, InternalSearchMatch[]>();
  for (const match of matches) {
    const existing = grouped.get(match.filePath) ?? [];
    existing.push(match);
    grouped.set(match.filePath, existing);
  }
  return grouped;
}

function applySelectedMatches(
  content: string,
  matches: InternalSearchMatch[],
  replacement: string,
  isRegex: boolean,
  maxJsonBytes: number,
  maximumPreviewBytes: number
): string {
  if (maxJsonBytes < 2) throw previewTooLargeError(maximumPreviewBytes);
  const ascending = [...matches].sort((left, right) => {
    if (left.startOffset !== right.startOffset) return left.startOffset - right.startOffset;
    return left.ordinal - right.ordinal;
  });
  const parts: string[] = [];
  let cursor = 0;
  // JSON string quotes are included in the response byte budget.
  let jsonBytes = 2;
  const append = (value: string): void => {
    jsonBytes += jsonStringContentByteLength(value);
    if (jsonBytes > maxJsonBytes) throw previewTooLargeError(maximumPreviewBytes);
    parts.push(value);
  };

  for (const match of ascending) {
    if (match.startOffset < cursor || match.endOffset < match.startOffset) {
      throw new WorkspaceSearchError('INVALID_MATCH', `匹配范围重叠或无效：${match.id}`, match.filePath);
    }
    append(content.slice(cursor, match.startOffset));
    if (isRegex) {
      for (const part of expandRegexReplacementParts(replacement, match.matchText, match.captures)) {
        append(part);
      }
    } else {
      append(replacement);
    }
    cursor = match.endOffset;
  }
  append(content.slice(cursor));
  return parts.join('');
}

function expandRegexReplacementParts(
  replacement: string,
  wholeMatch: string,
  captures: Array<string | undefined>
): string[] {
  const parts: string[] = [];
  const tokenPattern = /\$(\$|&|[1-9]\d?)/gu;
  let cursor = 0;
  for (const result of replacement.matchAll(tokenPattern)) {
    const index = result.index;
    if (index > cursor) parts.push(replacement.slice(cursor, index));
    const token = result[0];
    const marker = result[1];
    if (marker === '$') {
      parts.push('$');
      cursor = index + token.length;
      continue;
    }
    if (marker === '&') {
      parts.push(wholeMatch);
      cursor = index + token.length;
      continue;
    }
    const captureNumber = Number(marker);
    if (captureNumber <= captures.length) {
      parts.push(captures[captureNumber - 1] ?? '');
    } else if (marker.length === 2) {
      const firstCapture = Number(marker[0]);
      if (firstCapture <= captures.length) {
        parts.push(captures[firstCapture - 1] ?? '', marker[1]);
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }
    cursor = index + token.length;
  }
  if (cursor < replacement.length) parts.push(replacement.slice(cursor));
  return parts;
}

function toPublicMatch(match: InternalSearchMatch): WorkspaceSearchMatch {
  const clippedMatch = clipUnicodeStart(match.matchText, MAX_PUBLIC_MATCH_TEXT_CODE_POINTS);
  return {
    id: match.id,
    filePath: match.filePath,
    line: match.line,
    column: match.column,
    endLine: match.endLine,
    endColumn: match.endColumn,
    matchText: clippedMatch.text,
    ...(clippedMatch.truncated ? { matchTextTruncated: true } : {}),
    preview: match.preview,
    ...(match.previewTruncated ? { previewTruncated: true } : {})
  };
}

function toPublicPreviewFile(file: PreviewFileRecord): WorkspaceReplacePreviewFile {
  return {
    filePath: file.filePath,
    before: file.before,
    after: file.after,
    replacements: file.replacements
  };
}

function clipUnicodeStart(value: string, maximumCodePoints: number): { text: string; truncated: boolean } {
  const codePoints = Array.from(value);
  if (codePoints.length <= maximumCodePoints) return { text: value, truncated: false };
  return {
    text: `${codePoints.slice(0, maximumCodePoints).join('')}…`,
    truncated: true
  };
}

function jsonStringByteLength(value: string): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function jsonStringContentByteLength(value: string): number {
  return Math.max(0, jsonStringByteLength(value) - 2);
}

function previewTooLargeError(maximumBytes: number): WorkspaceSearchError {
  return new WorkspaceSearchError(
    'PREVIEW_TOO_LARGE',
    `替换预览内容超过 ${formatBytes(Math.max(0, maximumBytes))} 安全上限；请缩小搜索范围或减少所选匹配项。`
  );
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function toRelativePath(workspaceRoot: string, absolutePath: string): string {
  return path.relative(path.resolve(workspaceRoot), path.resolve(absolutePath)).replace(/\\/gu, '/');
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right, 'zh-CN');
}

function pathsEqual(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return process.platform === 'win32'
    ? resolvedLeft.toLocaleLowerCase('en-US') === resolvedRight.toLocaleLowerCase('en-US')
    : resolvedLeft === resolvedRight;
}

function convertPathError(error: unknown, requestedPath?: string): WorkspaceSearchError {
  if (error instanceof WorkspaceSearchError) return error;
  if (error instanceof WorkspacePathPolicyError) {
    return new WorkspaceSearchError('PATH_REJECTED', error.message, requestedPath, { cause: error });
  }
  return new WorkspaceSearchError(
    'PATH_REJECTED',
    `工作区路径检查失败：${requestedPath || ''}（${toErrorMessage(error)}）`,
    requestedPath,
    { cause: error }
  );
}

function addDiagnostic(diagnostics: WorkspaceSearchDiagnostic[], diagnostic: WorkspaceSearchDiagnostic): void {
  if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(diagnostic);
  if (diagnostics.length === MAX_DIAGNOSTICS && !diagnostics.some(item => item.code === 'DIAGNOSTICS_TRUNCATED')) {
    diagnostics.push({
      code: 'DIAGNOSTICS_TRUNCATED',
      level: 'warning',
      message: '跳过文件的诊断过多，后续诊断已省略。'
    });
  }
}

function cacheMissingMessage(code: 'QUERY_NOT_FOUND' | 'PREVIEW_NOT_FOUND' | 'TRANSACTION_NOT_FOUND'): string {
  if (code === 'QUERY_NOT_FOUND') return '搜索查询不存在，请重新搜索。';
  if (code === 'PREVIEW_NOT_FOUND') return '替换预览不存在或已使用，请重新预览。';
  return '替换事务不存在或已经回滚。';
}

function cacheExpiredMessage(code: 'QUERY_EXPIRED' | 'PREVIEW_EXPIRED' | 'TRANSACTION_EXPIRED'): string {
  if (code === 'QUERY_EXPIRED') return '搜索查询已过期，请重新搜索。';
  if (code === 'PREVIEW_EXPIRED') return '替换预览已过期，请重新预览。';
  return '替换事务已过期，无法自动回滚。';
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} 字节`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
