/**
 * 模块文件「导入 module-build」的唯一受控出口。
 *
 * 2026-09-22 起「AI 生成模块」不再自带模型通道；2026-10-02 起面板内嵌 Agent（DeepSeek
 * Harness）也整体退场。生成一律由外部 AI 完成：经 AI Bridge MCP 的模块封装链
 * （module.scaffold → writeFiles → validate）直接写 module-build，或复制规范粘贴给任意 AI
 * 后把回复粘回本面板导入。本文件只保留手动粘贴导入所需的解析结果结构与受控导入入口，
 * 禁止在这里重新接回任何模型调用。
 */

export interface AiModuleGeneratedFile { path: string; content: string; }

export interface AiModuleImportOutcome {
  moduleId: string;
  moduleName: string;
  outDir: string;
  fileCount: number;
  overwrittenExisting: boolean;
  diagnostics: string[];
}

interface AiModuleImportCallOutcome {
  ok: boolean;
  imported?: AiModuleImportOutcome;
  error?: string;
}

function parseImportPayload(payload: unknown): AiModuleImportOutcome | string {
  if (!payload || typeof payload !== 'object') return '服务未返回有效的 AI 模块导入结果。';
  const imported = payload as { moduleId?: unknown; moduleName?: unknown; outDir?: unknown; fileCount?: unknown; overwrittenExisting?: unknown; diagnostics?: unknown };
  if (typeof imported.moduleId !== 'string'
    || typeof imported.moduleName !== 'string'
    || typeof imported.outDir !== 'string'
    || !Number.isInteger(imported.fileCount)
    || (imported.fileCount as number) < 0) {
    return '服务返回的 AI 模块导入结果不完整。';
  }
  return {
    moduleId: imported.moduleId,
    moduleName: imported.moduleName,
    outDir: imported.outDir,
    fileCount: imported.fileCount as number,
    overwrittenExisting: imported.overwrittenExisting === true,
    diagnostics: Array.isArray(imported.diagnostics)
      ? imported.diagnostics.filter((item: unknown): item is string => typeof item === 'string')
      : []
  };
}

/** 把模块文件导入工作区 module-build 目录（面板手动模式的唯一导入出口）。 */
export async function importAiModuleFilesToWorkspace(
  files: AiModuleGeneratedFile[],
  outDir?: string
): Promise<AiModuleImportCallOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/modules/developer/import-ai-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, ...(outDir ? { outDir } : {}) })
    });
  } catch (error) {
    return { ok: false, error: `导入请求失败：${error instanceof Error ? error.message : String(error)}` };
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result.ok !== 'boolean') {
    return {
      ok: false,
      error: response.status === 404
        ? '当前开发服务未包含导入接口，请重启 LingBuilder 开发服务或使用最新安装包后重试。'
        : `服务返回了无效响应（HTTP ${response.status}）。`
    };
  }
  if (!result.ok) return { ok: false, error: result.error || 'AI 模块导入失败' };
  const imported = parseImportPayload(result.result);
  if (typeof imported === 'string') return { ok: false, error: imported };
  return { ok: true, imported };
}
