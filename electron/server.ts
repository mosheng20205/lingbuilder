import express from "express";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs/promises";
import { watch as watchFiles } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedString } from "./src/types";
import { parseLingCpp } from "./src/services/lingCpp/parser";
import {
  AppliedWorkspaceFile,
  AiConnectionConfig,
  LingCppEditContext,
  LingCppEditDraft,
  LingCppWorkspaceFile,
  WorkspaceEditRange
} from "./src/services/lingCpp/types";
import { generateLingCppNativeWin32Project } from "./src/services/windowDesigner/lingCppWin32Project";
import { exportVisualStudioProject } from "./src/services/windowDesigner/visualStudioProjectExporter";
import { LingWindowProject } from "./src/services/windowDesigner/types";
import {
  applyWorkspaceEdit,
  applyWorkspaceEditToFiles,
  getWorkspaceEditProposal,
  proposeLingCppEdit,
  rejectWorkspaceEdit
} from "./src/services/lingCpp/aiEditService";
import { getLingCppSemanticDiagnostics } from "./src/services/lingCpp/languageService";
import { createModuleService } from "./src/services/modules/moduleService";
import { LingCppModuleContext } from "./src/services/modules/types";
import { describeLingCppModuleContextForAi } from "./src/services/modules/moduleContextAdapters";
import {
  exportModuleNativeDependencies,
  materializeModuleNativeDependencies,
  ModuleNativeDependencyPlan
} from "./src/services/modules/nativeDependencyService";
import {
  createMarketIndex,
  createModuleTemplate,
  migrateCppModule,
  validateModuleDirectory
} from "./src/services/modules/moduleSdkService";
import { AiBridgeService } from "./src/services/aiBridge/aiBridgeService";
import { createAiBridgeRouter } from "./src/services/aiBridge/httpRoutes";
import { AiBridgePermissionMode, AiBridgeServerOptions } from "./src/services/aiBridge/types";
import { createSolutionService, LingBuilderSolutionProject } from "./src/services/solution/solutionService";
import { ExternalProjectService } from "./src/services/solution/externalProjectService";
import {
  WorkspacePathPolicy,
  WorkspacePathPolicyError
} from "./src/services/workspace/workspacePathPolicy";
import {
  createProjectFileMutationService,
  ProjectFileMutationError
} from "./src/services/workspace/projectFileMutationService";
import { createWorkspaceSearchService } from "./src/services/workspace/workspaceSearchService";
import { GitService } from "./src/services/sourceControl/gitService";
import { TestExplorerService, TSX_IMPORT } from "./src/services/testing/testExplorerService";
import { NodeTestDebugService } from "./src/services/testing/nodeTestDebugService";
import { QualityService } from "./src/services/quality/qualityService";
import { ExtensionService } from "./src/services/extensions/extensionService";
import { DependencyService } from "./src/services/dependencies/dependencyService";
import { RcResourceService } from "./src/services/windowDesigner/rcResourceService";
import { PerformanceService } from "./src/services/performance/performanceService";
import { PublishingService } from "./src/services/publishing/publishingService";
import { WorkspaceIndexService } from "./src/services/ai/workspaceIndexService";
import { SettingsSyncService } from "./src/services/configuration/settingsSyncService";
import { WorkspaceSearchError } from "./src/services/workspace/workspaceSearchTypes";
import { createManagedProcessService } from "./src/services/tasks/managedProcessService";
import { TaskService } from "./src/services/tasks/taskService";
import { BuildConfigurationService, getBuildCompilerFlags, getBuildOutputSegment, getModuleTargetId, type BuildConfiguration } from "./src/services/tasks/buildConfigurationService";
import { ClangdService } from "./src/services/lsp/clangdService";
import { LspWorkspaceEditService } from "./src/services/lsp/lspWorkspaceEditService";
import { checkDevelopmentEnvironment } from "./src/services/tasks/environmentCheckService";
import {
  EnvironmentRepairBusyError,
  EnvironmentRepairService,
  isEnvironmentRepairTarget
} from "./src/services/tasks/environmentRepairService";
import { mapCompilerDiagnostics, parseCompilerDiagnostics } from "./src/services/tasks/compilerDiagnosticService";
import { dependencyBuildBatches, IncrementalBuildService } from "./src/services/tasks/incrementalBuildService";
import { PtyTerminalService } from "./src/services/terminal/ptyTerminalService";
import { NativeDebugService } from "./src/services/debug/nativeDebugService";
import type { LingCppNativeSourceMapEntry } from "./src/services/lingCpp/types";
import { mapSourceBreakpointsForDebug } from "./src/services/debug/sourceBreakpointMapper";
import { decodeTextFile, encodeTextFile } from "./src/services/files/textFileService";
import {
  createProjectFilePersistenceService,
  createProjectFileVersion,
  ProjectFileConflictError
} from "./src/services/files/projectFilePersistenceService";
import { HotExitRecoveryService } from "./src/services/files/hotExitRecoveryService";
import {
  TextFileFormatError,
  type TextFileFormat
} from "./src/services/files/types";
import {
  ConfigurationPersistenceError,
  ConfigurationValidationError,
  WORKBENCH_CONFIGURATION_KEYS,
  createWorkbenchConfigurationService,
  type ConfigurationTarget,
  type ConfigurationValue,
  type WorkbenchConfigurationKey
} from "./src/services/configuration";
import {
  createProjectBuildCoordinator,
  ProjectBuildBusyError,
  ProjectBuildCancelledBeforeStartError,
  type ProjectBuildAdmission,
  type ProjectBuildLease
} from "./src/services/tasks/projectBuildCoordinator";
import {
  createProjectBuildSessionService,
  ProjectBuildPreparationError
} from "./src/services/tasks/projectBuildSessionService";
import {
  formatServerReady,
  isServerSessionAuthorized,
  resolveServerRuntimeConfig,
  ServerReadyInfo,
  ServerRuntimeConfig
} from "./src/services/server/serverRuntime";

dotenv.config({ quiet: true });

const serverRuntimeConfig = resolveServerRuntimeConfig(process.env);
// This process is already running as an Electron utility process. Ensure that
// any later process.execPath probe starts Electron in Node mode instead of
// recursively launching the packaged LingBuilder application.
if (serverRuntimeConfig.environment === "production") {
  process.env.ELECTRON_RUN_AS_NODE = "1";
}
const workspacePathPolicy = new WorkspacePathPolicy(serverRuntimeConfig.workspaceRoot);
const projectFileMutationService = createProjectFileMutationService(serverRuntimeConfig.workspaceRoot);
const projectFilePersistenceService = createProjectFilePersistenceService();
const hotExitRecoveryService = new HotExitRecoveryService(serverRuntimeConfig.workspaceRoot);
const workspaceSearchService = createWorkspaceSearchService(serverRuntimeConfig.workspaceRoot);
const managedProcessService = createManagedProcessService();
const taskService = new TaskService();
const environmentRepairService = new EnvironmentRepairService();
const buildConfigurationService = new BuildConfigurationService(serverRuntimeConfig.workspaceRoot);
const incrementalBuildService = new IncrementalBuildService(serverRuntimeConfig.workspaceRoot);
const ptyTerminalService = new PtyTerminalService(serverRuntimeConfig.workspaceRoot);
const nativeDebugService = new NativeDebugService(serverRuntimeConfig.workspaceRoot);
const gitService = new GitService(serverRuntimeConfig.workspaceRoot);
const testExplorerService = new TestExplorerService(serverRuntimeConfig.workspaceRoot);
const nodeTestDebugService = new NodeTestDebugService();
const qualityService = new QualityService(serverRuntimeConfig.workspaceRoot, TSX_IMPORT);
const extensionService = new ExtensionService(serverRuntimeConfig.workspaceRoot);
const dependencyService = new DependencyService(serverRuntimeConfig.workspaceRoot);
const rcResourceService = new RcResourceService(serverRuntimeConfig.workspaceRoot);
const performanceService = new PerformanceService(serverRuntimeConfig.workspaceRoot);
const publishingService = new PublishingService(serverRuntimeConfig.workspaceRoot);
const workspaceIndexService = new WorkspaceIndexService(serverRuntimeConfig.workspaceRoot);
const settingsSyncService = new SettingsSyncService(serverRuntimeConfig.workspaceRoot, serverRuntimeConfig.userSettingsPath);
const externalProjectService = new ExternalProjectService(serverRuntimeConfig.workspaceRoot);
const clangdService = new ClangdService({
  workspaceRoot: serverRuntimeConfig.workspaceRoot,
  command: process.env.LINGBUILDER_CLANGD_PATH || "clangd"
});
const lspWorkspaceEditService = new LspWorkspaceEditService(serverRuntimeConfig.workspaceRoot);
const projectBuildCoordinator = createProjectBuildCoordinator();
const projectBuildSessionService = createProjectBuildSessionService(
  projectBuildCoordinator,
  managedProcessService
);
const workbenchConfigurationService = createWorkbenchConfigurationService({
  workspaceRoot: serverRuntimeConfig.workspaceRoot,
  userSettingsPath: serverRuntimeConfig.userSettingsPath
});
const workbenchConfigurationInitialization = workbenchConfigurationService.initialize();
let lingBuilderAiRulebookCache: string | undefined;
let solutionServiceCache: ReturnType<typeof createSolutionService> | null = null;

async function getLingBuilderAiRulebook(): Promise<string> {
  if (lingBuilderAiRulebookCache !== undefined) return lingBuilderAiRulebookCache;
  try {
    lingBuilderAiRulebookCache = await fs.readFile(serverRuntimeConfig.rulebookPath, "utf8");
    return lingBuilderAiRulebookCache;
  } catch (error: any) {
    throw new Error(`LingBuilder AI 规则手册读取失败：${error?.message || String(error)}`);
  }
}

function attachLingBuilderAiRulebook(systemPrompt: string, rulebook: string): string {
  const trimmedRulebook = rulebook.trim();
  if (!trimmedRulebook) return systemPrompt;
  return `${systemPrompt}

以下是 LingBuilder AI 固定规则手册，必须优先遵守：
<<<LINGBUILDER_AI_RULEBOOK
${trimmedRulebook}
LINGBUILDER_AI_RULEBOOK`;
}

function getSolutionService() {
  if (!solutionServiceCache) {
    solutionServiceCache = createSolutionService(serverRuntimeConfig.workspaceRoot);
  }
  return solutionServiceCache;
}

function resolveAiConnectionConfig(config?: AiConnectionConfig): Required<AiConnectionConfig> {
  return {
    baseUrl: (config?.baseUrl || process.env.GEMINI_BASE_URL || "").trim(),
    apiKey: (config?.apiKey || process.env.GEMINI_API_KEY || "").trim(),
    modelName: (config?.modelName || process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash").trim(),
    provider: config?.provider || "gemini"
  };
}

function joinBaseUrl(baseUrl: string, pathName: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/${pathName.replace(/^\/+/u, "")}`;
}

function extractJsonPayload(text: string, fallback: string): string {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  if (!cleaned) return fallback;

  const firstObject = cleaned.indexOf("{");
  const firstArray = cleaned.indexOf("[");
  const startCandidates = [firstObject, firstArray].filter(index => index >= 0);
  if (startCandidates.length === 0) return cleaned;

  const start = Math.min(...startCandidates);
  const endObject = cleaned.lastIndexOf("}");
  const endArray = cleaned.lastIndexOf("]");
  const end = Math.max(endObject, endArray);
  return end >= start ? cleaned.slice(start, end + 1) : cleaned;
}

async function generateAiText(options: {
  config: Required<AiConnectionConfig>;
  systemPrompt: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  geminiResponseSchema?: any;
  geminiResponseMimeType?: string;
}): Promise<string> {
  const { config, systemPrompt, prompt, temperature = 0.2, maxTokens = 4096 } = options;

  if (config.provider === "anthropic") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.modelName,
        system: systemPrompt,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return data.content?.map(item => item.text || "").join("") || "";
  }

  if (config.provider === "deepseek" || config.provider === "openai") {
    const defaultBaseUrl = config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
    const response = await fetch(joinBaseUrl(config.baseUrl || defaultBaseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        ...(config.provider === "deepseek" ? { thinking: { type: "disabled" } } : {})
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  const ai = getGeminiClient(config);
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      ...(options.geminiResponseMimeType ? { responseMimeType: options.geminiResponseMimeType } : {}),
      ...(options.geminiResponseSchema ? { responseSchema: options.geminiResponseSchema } : {})
    }
  });
  return response.text || "";
}

async function testAiConnection(config: Required<AiConnectionConfig>): Promise<string> {
  if (config.provider === "anthropic") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.map(item => item.text || "").join("") || "";
  }

  if (config.provider === "deepseek") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.deepseek.com", "/chat/completions"), {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 16,
        temperature: 0,
        thinking: { type: "disabled" }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  if (config.provider === "openai") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.openai.com/v1", "/chat/completions"), {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        temperature: 0
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  const ai = getGeminiClient(config);
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: "ping",
    config: {
      temperature: 0,
      maxOutputTokens: 8
    }
  });
  return response.text || "";
}

function getGeminiClient(config?: AiConnectionConfig): GoogleGenAI {
  const resolved = resolveAiConnectionConfig(config);
  return new GoogleGenAI({
    apiKey: resolved.apiKey,
    httpOptions: {
      ...(resolved.baseUrl ? { baseUrl: resolved.baseUrl } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const app = express();
const execFileAsync = promisify(execFile);
const ALLOWED_PROJECT_EXTS = [".lcpp", ".cpp", ".h", ".rc", ".xml", ".json", ".ini", ".e"];

class ProjectFileSaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileSaveValidationError";
  }
}

function isAllowedProjectTextPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return ALLOWED_PROJECT_EXTS.some(ext => normalized.endsWith(ext));
}

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const isAiBridgePath = req.path === "/api/ai-bridge" || req.path.startsWith("/api/ai-bridge/");
  if (!req.path.startsWith("/api/") || isAiBridgePath) {
    next();
    return;
  }
  if (serverRuntimeConfig.devNoAuth) {
    next();
    return;
  }
  const sessionToken = req.header("x-lingbuilder-session") || "";
  if (!isServerSessionAuthorized(serverRuntimeConfig, sessionToken)) {
    res.status(401).json({ ok: false, error: "LingBuilder 本地会话无效或缺失。" });
    return;
  }
  next();
});

function getAiBridgePermissionMode(): AiBridgePermissionMode {
  const value = process.env.LINGBUILDER_AI_BRIDGE_PERMISSION;
  return value === "readonly" || value === "preview" || value === "yolo" ? value : "preview";
}

function getRepoWorkspaceRoot() {
  return serverRuntimeConfig.workspaceRoot;
}

function getModuleService() {
  return createModuleService(getRepoWorkspaceRoot());
}

async function requireExistingProject(projectId: string | undefined): Promise<string> {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) throw new Error("缺少 projectId，模块操作必须指定当前项目。");
  const solutionService = getSolutionService();
  const solution = await solutionService.getSolution();
  solutionService.getProject(solution, normalizedProjectId);
  return normalizedProjectId;
}

function normalizeWorkspaceRelativePath(value: string, allowedRoot?: string): string {
  if (!value?.trim()) throw new Error("缺少工作区相对路径。");
  const normalized = value.trim().replace(/\\/gu, "/");
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/u.test(normalized)) {
    throw new Error("模块 HTTP API 只接受工作区相对路径；本机绝对路径仅允许通过 CLI 使用。");
  }
  const collapsed = path.posix.normalize(normalized).replace(/^\.\//u, "");
  if (collapsed === ".." || collapsed.startsWith("../")) {
    throw new Error("路径越界：只能访问当前 LingBuilder 工作区内的文件。");
  }
  if (allowedRoot && collapsed !== allowedRoot && !collapsed.startsWith(`${allowedRoot}/`)) {
    throw new Error(`该操作只允许访问 ${allowedRoot} 目录。`);
  }
  return collapsed;
}

async function resolveExistingModulePath(value: string, allowedRoot?: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveExisting(relativePath, { rejectSymlinks: true });
}

async function resolveModuleWritePath(value: string, allowedRoot: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveForWrite(relativePath);
}

async function resolveModuleWriteDirectory(value: string, allowedRoot: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveDirectoryForWrite(relativePath);
}

async function toSafeHttpPackagePath(value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  try {
    if (!path.isAbsolute(value)) {
      const relativePath = normalizeWorkspaceRelativePath(value, ".lingbuilder/module-packages");
      await workspacePathPolicy.resolveExisting(relativePath, { rejectSymlinks: true });
      return relativePath;
    }
    const realPath = await fs.realpath(value);
    const relativePath = await workspacePathPolicy.toWorkspaceRelative(realPath);
    return normalizeWorkspaceRelativePath(relativePath, ".lingbuilder/module-packages");
  } catch {
    return undefined;
  }
}

if (serverRuntimeConfig.aiBridgeEnabled) {
  const aiBridgeOptions: AiBridgeServerOptions = {
    workspaceRoot: getRepoWorkspaceRoot(),
    host: serverRuntimeConfig.host,
    port: serverRuntimeConfig.port,
    token: serverRuntimeConfig.aiBridgeToken,
    permission: getAiBridgePermissionMode(),
    allowRemote: false,
    enableMcp: false
  };
  const aiBridgeService = new AiBridgeService(aiBridgeOptions, {
    managedProcessService,
    projectBuildCoordinator
  });
  app.use(
    "/api/ai-bridge",
    createAiBridgeRouter(aiBridgeService, serverRuntimeConfig.aiBridgeToken, planLingCppEditWithGemini)
  );
} else {
  app.use("/api/ai-bridge", (_req, res) => {
    res.status(404).json({ ok: false, error: "内嵌 AI Bridge 未启用；请使用 lingbuilder ai-server 显式启动。" });
  });
}

async function resolveLingCppEditModuleContext(
  projectId?: string,
  fallbackContext?: LingCppModuleContext
): Promise<LingCppModuleContext | undefined> {
  const effectiveProjectId = projectId || "lingbuilder-ui-project";
  try {
    const service = getModuleService();
    const [availableModules, enabledModules] = await Promise.all([
      service.scanInstalledModules(effectiveProjectId),
      service.getEnabledProjectModules(effectiveProjectId)
    ]);
    return { availableModules, enabledModules };
  } catch {
    return fallbackContext;
  }
}

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/configuration", async (_req, res) => {
  try {
    await workbenchConfigurationInitialization;
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "读取工作台设置失败。");
  }
});

app.patch("/api/configuration", async (req, res) => {
  const { key, target, value } = req.body as {
    key?: string;
    target?: ConfigurationTarget;
    value?: ConfigurationValue;
  };
  if (!isWorkbenchConfigurationKey(key) || !isConfigurationTarget(target)) {
    return res.status(400).json({ ok: false, error: "设置更新缺少有效 key 或 target。" });
  }
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "value")) {
    return res.status(400).json({ ok: false, error: "设置更新缺少 value；如需恢复默认值请使用 DELETE。" });
  }

  try {
    await workbenchConfigurationInitialization;
    await workbenchConfigurationService.update(key, value as ConfigurationValue, target);
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "保存工作台设置失败。");
  }
});

app.delete("/api/configuration/:key", async (req, res) => {
  const key = req.params.key;
  const target = req.query.target;
  if (!isWorkbenchConfigurationKey(key) || !isConfigurationTarget(target)) {
    return res.status(400).json({ ok: false, error: "恢复设置缺少有效 key 或 target。" });
  }

  try {
    await workbenchConfigurationInitialization;
    await workbenchConfigurationService.delete(key, target);
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "恢复工作台设置失败。");
  }
});

app.post("/api/workspace-search/query", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.query(req.body));
});

app.post("/api/workspace-search/preview", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.preview(req.body));
});

app.post("/api/workspace-search/apply", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.apply(req.body));
});

app.post("/api/workspace-search/rollback", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.rollback(req.body));
});

app.get("/api/environment/check", async (_req, res) => {
  try {
    const result = await checkDevelopmentEnvironment();
    const compilerIds = new Set(["msvc", "gpp", "clangpp"]);
    const hasCompiler = result.checks.msvc.available
      || result.checks.gpp.available
      || result.checks.clangpp.available;
    const metadata: Record<string, { label: string; required: boolean }> = {
      node: { label: "Node.js", required: true },
      msvc: { label: "MSVC C++ 编译器", required: false },
      windowsSdk: { label: "Windows SDK / rc.exe", required: false },
      cmake: { label: "CMake", required: false },
      gpp: { label: "GNU g++", required: false },
      clangpp: { label: "Clang++", required: false },
      webView2: { label: "WebView2 Runtime", required: false },
      platform: { label: "Windows 运行平台", required: true }
    };
    const checks = Object.entries(result.checks).map(([id, item]) => ({
      id,
      label: metadata[id]?.label || id,
      required: metadata[id]?.required || (compilerIds.has(id) && !hasCompiler),
      ...item
    }));
    res.json({
      ok: true,
      ready: result.ready,
      warnings: result.warnings,
      checkedAt: result.checkedAt,
      platform: result.checks.platform.detail,
      checks
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "开发环境检测失败。" });
  }
});

app.get("/api/environment/repair/status", (_req, res) => {
  res.json({ ok: true, repair: environmentRepairService.status() });
});

app.post("/api/environment/repair/start", (req, res) => {
  const target = req.body?.target;
  if (!isEnvironmentRepairTarget(target)) {
    return res.status(400).json({ ok: false, error: "环境修复目标无效。" });
  }
  try {
    const repair = environmentRepairService.start(target);
    res.status(202).json({ ok: true, repair });
  } catch (error) {
    const status = error instanceof EnvironmentRepairBusyError ? 409 : 400;
    res.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : "启动环境修复失败。"
    });
  }
});

app.post("/api/ai/connect", async (req, res) => {
  const { aiConfig } = req.body as { aiConfig?: AiConnectionConfig };
  const resolvedAiConfig = resolveAiConnectionConfig(aiConfig);
  if (!resolvedAiConfig.apiKey) {
    return res.status(400).json({ ok: false, error: "缺少 API Key" });
  }
  if (!resolvedAiConfig.modelName) {
    return res.status(400).json({ ok: false, error: "缺少 Model Name" });
  }

  try {
    const reply = await testAiConnection(resolvedAiConfig);
    res.json({
      ok: true,
      modelName: resolvedAiConfig.modelName,
      baseUrl: resolvedAiConfig.baseUrl,
      provider: resolvedAiConfig.provider,
      reply
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: "AI 连接失败",
      details: error?.message || String(error)
    });
  }
});

app.get("/api/modules/installed", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const validatedProjectId = await requireExistingProject(projectId);
    res.json({ ok: true, modules: await getModuleService().scanInstalledModules(validatedProjectId) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块扫描失败" });
  }
});

app.get("/api/modules/project", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const validatedProjectId = await requireExistingProject(projectId);
    res.json({ ok: true, modules: await getModuleService().getEnabledProjectModules(validatedProjectId) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "项目模块读取失败" });
  }
});

app.post("/api/modules/project/enable", async (req, res) => {
  try {
    const { projectId, moduleId } = req.body as { projectId?: string; moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    const validatedProjectId = await requireExistingProject(projectId);
    await getModuleService().enableModuleForProject(validatedProjectId, moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "启用模块失败" });
  }
});

app.post("/api/modules/project/disable", async (req, res) => {
  try {
    const { projectId, moduleId } = req.body as { projectId?: string; moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    const validatedProjectId = await requireExistingProject(projectId);
    await getModuleService().disableModuleForProject(validatedProjectId, moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "禁用模块失败" });
  }
});

app.post("/api/modules/package/preview", async (req, res) => {
  try {
    const { packagePath } = req.body as { packagePath?: string };
    if (!packagePath) return res.status(400).json({ ok: false, error: "缺少 packagePath" });
    const resolvedPackagePath = await resolveExistingModulePath(packagePath, ".lingbuilder/module-packages");
    res.json({ ok: true, preview: await getModuleService().previewPackageInstall(resolvedPackagePath) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包预览失败" });
  }
});

app.post("/api/modules/package/install", async (req, res) => {
  try {
    const { previewId, projectId, enableForProject = true } = req.body as { previewId?: string; projectId?: string; enableForProject?: boolean };
    if (!previewId) return res.status(400).json({ ok: false, error: "缺少 previewId" });
    const validatedProjectId = await requireExistingProject(projectId);
    const result = await getModuleService().installPackage(previewId);
    if (enableForProject) {
      await getModuleService().enableModuleForProject(validatedProjectId, result.moduleId);
    }
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块安装失败" });
  }
});

app.get("/api/solution", async (_req, res) => {
  try {
    const solution = await getSolutionService().getSolution();
    res.json({ ok: true, solution });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "解决方案读取失败" });
  }
});

app.post("/api/solution/projects", async (req, res) => {
  try {
    const result = await getSolutionService().createProject(req.body || {});
    res.json({ ok: true, ...result, logs: [`已新建项目：${result.project.name} (${result.project.id})`] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "新建项目失败" });
  }
});
app.post("/api/solution/import", async (req, res) => {
  try {
    if (!isNonEmptyString(req.body?.projectFile)) return res.status(400).json({ ok: false, error: "缺少要导入的工程路径。" });
    const result = await getSolutionService().importExternalProject(req.body.projectFile);
    res.json({ ok: true, ...result, logs: [`已导入 ${result.project.type}：${result.project.name}`] });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.patch("/api/solution/projects/:projectId", async (req, res) => {
  try {
    const solution = await getSolutionService().updateProject(req.params.projectId, req.body || {});
    res.json({ ok: true, solution });
  } catch (error: any) {
    res.status(/循环|不存在|不能引用/iu.test(error?.message || "") ? 400 : 500).json({ ok: false, error: error?.message || "更新项目失败" });
  }
});

app.delete("/api/solution/projects/:projectId", async (req, res) => {
  try {
    const projectId = req.params.projectId.trim();
    if (!projectId) return res.status(400).json({ ok: false, error: "缺少要删除的项目 ID。" });
    const cancelledActiveBuild = projectBuildCoordinator.cancel(projectId, "project-delete");
    const stoppedProcess = await managedProcessService.stop(projectId);
    if (stoppedProcess.found && !stoppedProcess.stopped) {
      return res.status(409).json({
        ok: false,
        error: `项目运行进程未能停止，已取消删除以保护项目文件。${stoppedProcess.message}`
      });
    }
    if (cancelledActiveBuild) {
      return res.status(409).json({
        ok: false,
        error: "该项目的生成任务已取消但尚未退出。请等待当前任务结束后再次删除项目。"
      });
    }
    const deleteFiles = String(req.query.deleteFiles || "false") === "true";
    const result = await getSolutionService().deleteProject(projectId, { deleteFiles });
    res.json({
      ok: true,
      ...result,
      logs: [
        deleteFiles
          ? `已删除项目文件并从解决方案移除：${projectId}`
          : `已从解决方案移除项目引用：${projectId}`
      ]
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "删除项目失败" });
  }
});

app.post("/api/solution/clean", async (req, res) => {
  try {
    const { projectId } = req.body as { projectId?: string };
    const task = taskService.enqueue({
      type: "solution.clean", title: projectId ? `清理项目 ${projectId}` : "清理解决方案", group: `build:${projectId || "solution"}`,
      run: async context => {
        context.report(10, "开始清理构建产物。");
        const result = await getSolutionService().cleanProjects(projectId ? [projectId] : undefined);
        result.logs.forEach(line => context.log(line)); context.report(100); return result;
      }
    });
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "清理解决方案失败" });
  }
});

app.post("/api/solution/build", async (req, res) => {
  try {
    const { projectId, run = false } = req.body as { projectId?: string; run?: boolean };
    const admission = projectBuildCoordinator.captureGlobalAdmission();
    const task = enqueueSolutionBuildTask({ projectId, run, admission, rebuild: false });
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    res.status(500).json({ ok: false, stage: "server", error: error?.message || "生成解决方案失败" });
  }
});

app.post("/api/solution/rebuild", async (req, res) => {
  try {
    const { projectId, run = false } = req.body as { projectId?: string; run?: boolean };
    const admission = projectBuildCoordinator.captureGlobalAdmission();
    const task = enqueueSolutionBuildTask({ projectId, run, admission, rebuild: true });
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    res.status(500).json({ ok: false, stage: "server", error: error?.message || "重新生成解决方案失败" });
  }
});

app.get("/api/tasks", (_req, res) => res.json({ ok: true, tasks: taskService.list() }));
app.get("/api/build-configuration", async (_req, res) => res.json({ ok: true, configuration: await buildConfigurationService.read() }));
app.put("/api/build-configuration", async (req, res) => {
  try { res.json({ ok: true, configuration: await buildConfigurationService.write(req.body) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.get("/api/tasks/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  taskService.list().forEach(task => res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`));
  const unsubscribe = taskService.subscribe(task => res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});
app.post("/api/tasks/:taskId/cancel", (req, res) => {
  const cancelled = taskService.cancel(req.params.taskId, "用户通过工作台取消任务。");
  if (!cancelled) return res.status(404).json({ ok: false, error: "任务不存在或已结束。" });
  res.json({ ok: true });
});

app.get("/api/terminal/sessions", (_req, res) => res.json({ ok: true, sessions: ptyTerminalService.list() }));
app.post("/api/terminal/sessions", async (req, res) => {
  try { res.status(201).json({ ok: true, session: await ptyTerminalService.create(req.body || {}) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "创建终端失败。" }); }
});
app.post("/api/terminal/sessions/:sessionId/input", (req, res) => {
  try { ptyTerminalService.write(req.params.sessionId, req.body?.data); res.json({ ok: true }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "终端输入失败。" }); }
});
app.post("/api/terminal/sessions/:sessionId/resize", (req, res) => {
  try { res.json({ ok: true, session: ptyTerminalService.resize(req.params.sessionId, req.body?.cols, req.body?.rows) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "调整终端大小失败。" }); }
});
app.delete("/api/terminal/sessions/:sessionId", (req, res) => {
  if (!ptyTerminalService.close(req.params.sessionId)) return res.status(404).json({ ok: false, error: "终端会话不存在。" });
  res.json({ ok: true });
});
app.get("/api/terminal/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  ptyTerminalService.list().forEach(session => res.write(`event: terminal\ndata: ${JSON.stringify({ kind: "snapshot", session })}\n\n`));
  const unsubscribe = ptyTerminalService.subscribe(event => res.write(`event: terminal\ndata: ${JSON.stringify(event)}\n\n`));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

app.get("/api/debug/session", (_req, res) => res.json({ ok: true, session: nativeDebugService.getSnapshot() }));
app.get("/api/debug/inspection", async (req, res) => {
  try {
    const threadId = req.query.threadId ? Number(req.query.threadId) : undefined; const frameId = req.query.frameId ? Number(req.query.frameId) : undefined;
    res.json({ ok: true, inspection: await nativeDebugService.inspect(threadId, frameId) });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取调试上下文失败。" }); }
});
app.get("/api/debug/variables/:reference", async (req, res) => {
  try { res.json({ ok: true, variables: await nativeDebugService.variables(Number(req.params.reference), Number(req.query.start || 0), Number(req.query.count || 200)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取子变量失败。" }); }
});
app.post("/api/debug/evaluate", async (req, res) => {
  try { res.json({ ok: true, evaluation: await nativeDebugService.evaluate(req.body?.expression, req.body?.frameId) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "计算监视表达式失败。" }); }
});
app.get("/api/debug/registers", async (req, res) => {
  try { res.json({ ok: true, registers: await nativeDebugService.registers(Number(req.query.frameId)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取寄存器失败。" }); }
});
app.get("/api/debug/memory", async (req, res) => {
  try { res.json({ ok: true, memory: await nativeDebugService.readMemory(String(req.query.reference || ""), Number(req.query.offset || 0), Number(req.query.count || 256)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取内存失败。" }); }
});
app.get("/api/debug/disassembly", async (req, res) => {
  try { res.json({ ok: true, instructions: await nativeDebugService.disassemble(String(req.query.reference || ""), Number(req.query.offset || 0), Number(req.query.count || 64)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取反汇编失败。" }); }
});
app.post("/api/debug/attach", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.attach({ pid: Number(req.body?.pid), program: req.body?.program }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "附加进程失败。" }); }
});
app.post("/api/debug/dump", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.openDump({ program: req.body?.program, coreFile: req.body?.coreFile }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "打开转储失败。" }); }
});
app.post("/api/debug/remote", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.connectRemote({ program: req.body?.program, host: req.body?.host, port: Number(req.body?.port) }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "远程调试连接失败。" }); }
});
app.post("/api/debug/start", async (req, res) => {
  try {
    const { projectId, breakpoints = [], stopAtEntry = false } = req.body as { projectId?: string; breakpoints?: Array<{ filePath: string; line: number; condition?: string }>; stopAtEntry?: boolean };
    if (!isNonEmptyString(projectId) || !Array.isArray(breakpoints)) return res.status(400).json({ ok: false, error: "缺少有效 projectId 或断点列表。" });
    const configuration = await buildConfigurationService.read();
    if (configuration.mode !== "Debug") return res.status(400).json({ ok: false, error: "原生调试需要 Debug 构建配置，请先在状态栏切换到 Debug。" });
    await nativeDebugService.stop();
    const build = await buildSolutionProjects({ projectId: projectId.trim(), run: false, admission: projectBuildCoordinator.captureGlobalAdmission(), incremental: true });
    if (!build.ok) return res.status(400).json({ ok: false, stage: build.stage, error: build.logs.at(-1) || "调试前构建失败。", logs: build.logs, results: build.results });
    const target = build.results.find((item: any) => item.projectId === projectId.trim());
    if (!target?.exePath || !target?.sourceDir || !Array.isArray(target.sourceMap)) return res.status(400).json({ ok: false, error: "当前项目没有可调试的原生 exe 或源码映射。" });
    const mapped = mapSourceBreakpointsForDebug(breakpoints, target.sourceMap, target.sourceDir);
    const session = await nativeDebugService.start({ program: target.exePath, cwd: target.binDir || path.dirname(target.exePath), stopAtEntry, breakpoints: mapped });
    res.json({ ok: true, session, build });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "启动原生调试失败。", session: nativeDebugService.getSnapshot() }); }
});
app.put("/api/debug/breakpoints", async (req, res) => {
  try {
    const snapshot = nativeDebugService.getSnapshot(); if (!snapshot) return res.status(404).json({ ok: false, error: "当前没有原生调试会话。" });
    const sourceMap = req.body?.sourceMap as LingCppNativeSourceMapEntry[] | undefined;
    const sourceDir = req.body?.sourceDir as string | undefined;
    const breakpoints = req.body?.breakpoints as Array<{ filePath: string; line: number; condition?: string }>;
    if (!Array.isArray(sourceMap) || !isNonEmptyString(sourceDir) || !Array.isArray(breakpoints)) return res.status(400).json({ ok: false, error: "更新断点缺少源码映射上下文。" });
    res.json({ ok: true, session: await nativeDebugService.setBreakpoints(mapSourceBreakpointsForDebug(breakpoints, sourceMap, sourceDir)) });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "更新断点失败。" }); }
});
for (const [route, action] of Object.entries({ continue: () => nativeDebugService.continue(), next: () => nativeDebugService.next(), "step-in": () => nativeDebugService.stepIn(), "step-out": () => nativeDebugService.stepOut(), stop: () => nativeDebugService.stop() })) {
  app.post(`/api/debug/${route}`, async (_req, res) => { try { res.json({ ok: true, session: await action() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "调试控制失败。" }); } });
}
app.get("/api/debug/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  const current = nativeDebugService.getSnapshot(); if (current) res.write(`event: debug\ndata: ${JSON.stringify(current)}\n\n`);
  const unsubscribe = nativeDebugService.subscribe(session => res.write(`event: debug\ndata: ${JSON.stringify(session)}\n\n`));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000); req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

app.get("/api/lsp/status", (_req, res) => res.json({ ok: true, status: clangdService.getStatus() }));
app.post("/api/lsp/start", async (_req, res) => {
  const status = await clangdService.restart();
  res.status(status.state === "ready" || status.state === "unavailable" ? 200 : 500).json({ ok: status.state === "ready", status });
});
app.post("/api/lsp/stop", async (_req, res) => { await clangdService.stop(); res.json({ ok: true, status: clangdService.getStatus() }); });
app.put("/api/lsp/documents", async (req, res) => {
  try {
    const { filePath, text, languageId = "cpp" } = req.body as { filePath?: string; text?: string; languageId?: string };
    if (!isNonEmptyString(filePath) || typeof text !== "string" || !/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/iu.test(filePath)) {
      return res.status(400).json({ ok: false, error: "只能向 clangd 打开工作区内的 C/C++ 文本文件。" });
    }
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    await clangdService.openDocument(absolutePath, text, languageId);
    res.json({ ok: true, status: clangdService.getStatus() });
  } catch (error: any) { res.status(503).json({ ok: false, error: error.message, status: clangdService.getStatus() }); }
});
app.patch("/api/lsp/documents", async (req, res) => {
  try {
    const { filePath, changes } = req.body as { filePath?: string; changes?: Array<{ range?: any; rangeLength?: number; text: string }> };
    if (!isNonEmptyString(filePath) || !Array.isArray(changes)) return res.status(400).json({ ok: false, error: "缺少文档变更。" });
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    const version = await clangdService.changeDocument(absolutePath, changes);
    res.json({ ok: true, version });
  } catch (error: any) { res.status(503).json({ ok: false, error: error.message, status: clangdService.getStatus() }); }
});
app.delete("/api/lsp/documents", async (req, res) => {
  try {
    const filePath = String(req.query.filePath || "");
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    await clangdService.closeDocument(absolutePath); res.json({ ok: true });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.get("/api/lsp/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  const status = (value: unknown) => res.write(`event: status\ndata: ${JSON.stringify(value)}\n\n`);
  const diagnostics = (value: unknown) => res.write(`event: diagnostics\ndata: ${JSON.stringify(value)}\n\n`);
  status(clangdService.getStatus()); clangdService.on("status", status); clangdService.on("diagnostics", diagnostics);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); clangdService.off("status", status); clangdService.off("diagnostics", diagnostics); });
});

const ALLOWED_LSP_REQUESTS = new Set([
  "textDocument/completion", "textDocument/hover", "textDocument/signatureHelp",
  "textDocument/definition", "textDocument/implementation", "textDocument/documentSymbol", "workspace/symbol"
  , "textDocument/references", "textDocument/prepareRename", "textDocument/codeAction"
]);
app.post("/api/lsp/request", async (req, res) => {
  const controller = new AbortController(); req.on("close", () => controller.abort());
  try {
    const { method, filePath, position, query, range, context } = req.body as { method?: string; filePath?: string; position?: { line: number; character: number }; query?: string; range?: unknown; context?: unknown };
    if (!method || !ALLOWED_LSP_REQUESTS.has(method)) return res.status(400).json({ ok: false, error: "不支持的 LSP 请求。" });
    let params: unknown;
    if (method === "workspace/symbol") params = { query: typeof query === "string" ? query : "" };
    else {
      if (!isNonEmptyString(filePath)) return res.status(400).json({ ok: false, error: "LSP 请求缺少 filePath。" });
      const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      const textDocument = { uri: pathToFileURL(absolutePath).href };
      params = method === "textDocument/documentSymbol"
        ? { textDocument }
        : method === "textDocument/references"
          ? { textDocument, position, context: { includeDeclaration: true } }
          : method === "textDocument/codeAction"
            ? { textDocument, range, context: context || { diagnostics: [] } }
            : { textDocument, position };
    }
    const result = await clangdService.request(method, params, controller.signal);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(clangdService.getStatus().state === "ready" ? 500 : 503).json({ ok: false, error: error.message, status: clangdService.getStatus() });
  }
});

app.post("/api/lsp/refactor/preview", async (req, res) => {
  try {
    const { kind, filePath, position, newName, edit, sourceText } = req.body as { kind?: "rename" | "codeAction"; filePath?: string; position?: any; newName?: string; edit?: any; sourceText?: string };
    let workspaceEdit = edit;
    if (isNonEmptyString(filePath)) {
      const sourcePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      if (typeof sourceText !== "string" || decodeTextFile(await fs.readFile(sourcePath)).content !== sourceText) {
        return res.status(409).json({ ok: false, error: "重构前请先保存当前 C/C++ 文件，避免将 clangd 内存位置应用到旧磁盘内容。" });
      }
    }
    if (kind === "rename") {
      if (!isNonEmptyString(filePath) || !isNonEmptyString(newName)) return res.status(400).json({ ok: false, error: "重命名缺少文件或新名称。" });
      const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      const textDocument = { uri: pathToFileURL(absolutePath).href };
      await clangdService.request("textDocument/prepareRename", { textDocument, position });
      workspaceEdit = await clangdService.request("textDocument/rename", { textDocument, position, newName });
    }
    const preview = await lspWorkspaceEditService.preview(workspaceEdit);
    res.json({ ok: true, preview });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.post("/api/lsp/refactor/apply", async (req, res) => {
  try { res.json({ ok: true, ...await lspWorkspaceEditService.apply(String(req.body?.previewId || "")) }); }
  catch (error: any) { res.status(/external|changed|外部修改/iu.test(error.message) ? 409 : 400).json({ ok: false, error: error.message }); }
});

app.post("/api/modules/package/export", async (req, res) => {
  try {
    const { moduleDir, targetPath } = req.body as { moduleDir?: string; targetPath?: string };
    if (!moduleDir || !targetPath) return res.status(400).json({ ok: false, error: "缺少 moduleDir 或 targetPath" });
    const [resolvedModuleDir, resolvedTargetPath] = await Promise.all([
      resolveExistingModulePath(moduleDir, ".lingbuilder/module-build"),
      resolveModuleWritePath(targetPath, ".lingbuilder/module-packages")
    ]);
    await getModuleService().exportModulePackage(resolvedModuleDir, resolvedTargetPath);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包导出失败" });
  }
});

app.post("/api/modules/uninstall", async (req, res) => {
  try {
    const { moduleId } = req.body as { moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    await getModuleService().uninstallModule(moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "卸载模块失败" });
  }
});

app.get("/api/modules/market", async (req, res) => {
  try {
    const { sourceId } = req.query as { sourceId?: string };
    const modules = await getModuleService().listMarketModules(sourceId);
    res.json({
      ok: true,
      modules: await Promise.all(modules.map(async module => ({
        ...module,
        packagePath: await toSafeHttpPackagePath(module.packagePath)
      })))
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块市场读取失败" });
  }
});

app.get("/api/modules/history", async (_req, res) => {
  try {
    res.json({ ok: true, history: await getModuleService().getHistory() });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块历史读取失败" });
  }
});

app.post("/api/modules/developer/template", async (req, res) => {
  try {
    const { template = "cpp-source", outDir, id, name } = req.body as { template?: string; outDir?: string; id?: string; name?: string };
    if (!outDir) return res.status(400).json({ ok: false, error: "缺少 outDir" });
    const resolvedOutDir = await resolveModuleWriteDirectory(outDir, ".lingbuilder/module-build");
    const manifest = await createModuleTemplate({ template, outDir: resolvedOutDir, id, name });
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块模板创建失败" });
  }
});

app.post("/api/modules/developer/validate", async (req, res) => {
  try {
    const { modulePath } = req.body as { modulePath?: string };
    if (!modulePath) return res.status(400).json({ ok: false, error: "缺少 modulePath" });
    let resolvedModulePath = await resolveExistingModulePath(modulePath, ".lingbuilder/module-build");
    if (path.basename(resolvedModulePath).toLowerCase() === "lingbuilder.module.json") {
      resolvedModulePath = path.dirname(resolvedModulePath);
    }
    const result = await validateModuleDirectory(resolvedModulePath);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块校验失败" });
  }
});

app.post("/api/modules/developer/migrate-cpp", async (req, res) => {
  try {
    const { configPath, outDir } = req.body as { configPath?: string; outDir?: string };
    if (!configPath || !outDir) return res.status(400).json({ ok: false, error: "缺少 configPath 或 outDir" });
    const [resolvedConfigPath, resolvedOutDir] = await Promise.all([
      resolveExistingModulePath(configPath),
      resolveModuleWriteDirectory(outDir, ".lingbuilder/module-build")
    ]);
    const manifest = await migrateCppModule(resolvedConfigPath, resolvedOutDir);
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "C++ 模块迁移失败" });
  }
});

app.post("/api/modules/developer/market-index", async (req, res) => {
  try {
    const { packagePaths, outPath } = req.body as { packagePaths?: string[]; outPath?: string };
    if (!Array.isArray(packagePaths) || !outPath) return res.status(400).json({ ok: false, error: "缺少 packagePaths 或 outPath" });
    const normalizedOutPath = normalizeWorkspaceRelativePath(outPath, ".lingbuilder");
    if (path.posix.dirname(normalizedOutPath) !== ".lingbuilder" || !normalizedOutPath.toLowerCase().endsWith(".json")) {
      throw new Error("模块市场索引必须输出为 .lingbuilder 目录下的 JSON 文件。");
    }
    const [resolvedPackagePaths, resolvedOutPath] = await Promise.all([
      Promise.all(packagePaths.map(packagePath => resolveExistingModulePath(packagePath, ".lingbuilder/module-packages"))),
      workspacePathPolicy.resolveForWrite(normalizedOutPath)
    ]);
    await createMarketIndex(resolvedPackagePaths, resolvedOutPath, { packagePathRoot: getRepoWorkspaceRoot() });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块市场索引生成失败" });
  }
});

app.post("/api/window-designer/native-preview", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }

  try {
    const enabledModules = await getModuleService().getEnabledProjectModules(project.id || "lingbuilder-ui-project");
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: typeof lingCppSourceCode === "string" ? lingCppSourceCode : "",
      lingCppSourceFilePath,
      enabledModules
    });

    res.json({
      ok: true,
      files: generatedProject.files.map(file => ({
        relativePath: file.relativePath,
        language: getGeneratedFileLanguage(file.relativePath),
        content: file.content,
        readonly: true
      })),
      diagnostics: generatedProject.diagnostics,
      selectedWindow: generatedProject.selectedWindow,
      enabledModules: enabledModules.map(module => `${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`),
      sourceMap: generatedProject.sourceMap
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || "原生 C++ 预览生成失败"
    });
  }
});

app.post("/api/window-designer/native-export", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }

  try {
    const enabledModules = await getModuleService().getEnabledProjectModules(project.id || "lingbuilder-ui-project");
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: typeof lingCppSourceCode === "string" ? lingCppSourceCode : "",
      lingCppSourceFilePath,
      enabledModules
    });
    const exportDir = path.join(getRepoWorkspaceRoot(), "generated", "cpp", sanitizeFilename(project.id || "window-preview"));
    await fs.mkdir(exportDir, { recursive: true });
    await writeGeneratedProjectFiles(exportDir, generatedProject.files);
    const moduleExportDiagnostics = await exportModuleNativeDependencies(enabledModules, exportDir);
    const visualStudioProject = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId: project.id || "window-preview",
      generatedFiles: generatedProject.files,
      enabledModules
    });

    res.json({
      ok: true,
      exportDir,
      files: [
        ...generatedProject.files.map(file => path.join(exportDir, file.relativePath)),
        ...visualStudioProject.files
      ],
      visualStudioProject,
      diagnostics: [...generatedProject.diagnostics, ...moduleExportDiagnostics],
      selectedWindow: generatedProject.selectedWindow,
      enabledModules: enabledModules.map(module => `${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`),
      sourceMap: generatedProject.sourceMap,
      logs: [
        `原生 C++ 工程目录：${exportDir}`,
        `Visual Studio 解决方案：${visualStudioProject.solutionPath}`,
        `当前窗口：${generatedProject.selectedWindow.title}`,
        ...generatedProject.diagnostics,
        ...moduleExportDiagnostics
      ]
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || "原生 C++ 工程导出失败"
    });
  }
});

// API: Extract strings and comments from C++ code
app.post("/api/extract", (req, res) => {
  const { code, filename } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Missing code content" });
  }

  const lines = code.split("\n");
  const extracted: ExtractedString[] = [];
  let idCounterVal = 1;

  // Simple parser for C++ strings & comments
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const currentLine = lines[i];

    // 1. Match C++ comments: // or /* */
    const singleLineCommentMatch = currentLine.match(/(\/\/.*)$/);
    if (originalCommentMatch(trimmed(currentLine))) {
      const match = trimmedComment(currentLine);
      if (match && match.length > 3) {
        extracted.push({
          id: `ext-c-${idCounterVal++}`,
          original: match,
          translated: '',
          line: lineNum,
          type: 'comment',
          status: 'pending',
          context: currentLine.trim()
        });
      }
    }

    // 2. Match C++ string literals: "..." or L"..." or _T("...")
    // Regex matches L"..." or _T("...") or "..."
    const stringRegex = /(?:L|_T)?\"([^"\\]*(?:\\.[^"\\]*)*)\"/g;
    let match;
    while ((match = stringRegex.exec(currentLine)) !== null) {
      const originalStr = match[1];
      if (originalStr && originalStr.trim().length > 1) {
        // Skip common formatting templates or pure punctuation strings
        if (/^[%d%s%x\s\-\.\,\!\?_]+$/.test(originalStr)) continue;
        
        extracted.push({
          id: `ext-s-${idCounterVal++}`,
          original: originalStr,
          translated: '',
          line: lineNum,
          type: 'string',
          status: 'pending',
          context: currentLine.trim()
        });
      }
    }
  }

  function trimmed(s: string) { return s.trim(); }
  function originalCommentMatch(s: string) { return s.includes("//") || s.includes("/*"); }
  function trimmedComment(s: string) {
    const m = s.match(/\/\/(.*)$/);
    if (m) return m[1].trim();
    const m2 = s.match(/\/\*([\s\S]*?)\*\//);
    if (m2) return m2[1].trim();
    return null;
  }

  res.json({ strings: extracted });
});

// API: Batch translate C++ strings using Gemini
app.post("/api/translate", async (req, res) => {
  const { strings, glossary, aiConfig } = req.body as {
    strings?: any[];
    glossary?: any[];
    aiConfig?: AiConnectionConfig;
  };
  if (!strings || !Array.isArray(strings) || strings.length === 0) {
    return res.status(400).json({ error: "Missing or invalid strings list" });
  }

  try {
    const resolvedAiConfig = resolveAiConnectionConfig(aiConfig);
    // Construct glossary context string
    let glossaryContext = "";
    if (glossary && Array.isArray(glossary) && glossary.length > 0) {
      glossaryContext = "请在翻译中遵守以下专业术语表对应关系以确保一致性：\n" +
        glossary.map((g: any) => `- "${g.english}" 翻译为 "${g.chinese}" (${g.description || ''})`).join('\n');
    }

    // Prepare structure request payload
    const systemPrompt = `你是一个专业的 C++ 游戏与桌面应用软件汉化专家。
你的任务是将 C++ 源代码中提取的英文字符串/注释翻译成自然、流畅、专业的中文。
请遵循以下严格规则：
1. 保持技术术语准确，保留任何格式化占位符（如 %s, %d, %lf, \\n, \\t, %ls 等）以及控制字符，绝对不能改变其格式或遗漏！
2. 保持 C++ 字符串中的转义字符不变，例如 \\t, \\n, \\" 必须正确保留。
3. 翻译要符合中文程序员的使用习惯（如 "socket" -> "套接字/连接", "buffer" -> "缓冲区", "render" -> "渲染"）。
4. 保持代码上下文意图。如果是注释，翻译成优雅的中文注释。如果是UI文本或弹窗提示，翻译成自然友好的中文提示。
${glossary ? `5. 严格遵守以下特定专业词汇映射：\n${glossary}` : ""}`;

    const itemsToTranslate = strings.map((s: any) => ({
      id: s.id,
      original: s.original,
      type: s.type,
      context: s.context || ""
    }));

    const prompt = `请对以下 C++ 提取文本和注释进行汉化翻译：
${glossaryContext ? `\n${glossaryContext}\n` : ""}
需要翻译的条目列表如下：
${JSON.stringify(itemsToTranslate, null, 2)}

请返回一个 JSON 数组，其格式必须是包含 id 和 translated 的对象列表。
示例返回格式：
[
  { "id": "条目ID", "translated": "翻译后的中文内容" }
]`;

    const resultText = await generateAiText({
      config: resolvedAiConfig,
      systemPrompt: attachLingBuilderAiRulebook(systemPrompt, await getLingBuilderAiRulebook()),
      prompt,
      temperature: 0.2,
      maxTokens: 4096,
      geminiResponseMimeType: "application/json",
      geminiResponseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "对应的输入条目 id" },
            translated: { type: Type.STRING, description: "翻译后的专业中文内容" }
          },
          required: ["id", "translated"]
        }
      }
    });

    const translations = JSON.parse(extractJsonPayload(resultText, "[]"));
    res.json({ translations });

  } catch (error: any) {
    console.error("AI batch translation failure:", error);
    res.status(500).json({
      error: "AI 汉化接口调用失败",
      details: error.message || error
    });
  }
});

// API: Reconstruct C++ code with translations
app.post("/api/reconstruct", (req, res) => {
  const { code, strings } = req.body;
  if (!code || !strings) {
    return res.status(400).json({ error: "Missing original code or translated strings" });
  }

  const lines = code.split("\n");
  const processedStrings = [...strings].sort((a, b) => b.original.length - a.original.length); // Replace longer substrings first to avoid partial corruption

  // Map translations to specific lines for absolute precision
  const linesMap: Record<number, any[]> = {};
  processedStrings.forEach((s: any) => {
    if (s.translated && s.status === 'translated') {
      if (!linesMap[s.line]) linesMap[s.line] = [];
      linesMap[s.line].push(s);
    }
  });

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (linesMap[lineNum]) {
      let currentLine = lines[i];
      linesMap[lineNum].forEach((s: any) => {
        // String or comment precise replacement within line
        if (s.type === 'comment') {
          // Replace comment content
          currentLine = currentLine.replace(s.original, s.translated);
        } else {
          // For string literals, handle escaping differences if any, or just find hte original string literal content
          // Replace the literal content, making sure we don't accidentally corrupt code characters outside string quotes
          // Simple but effective: Replace first or matching occurrence of original string inside quotes
          const escapedOriginal = s.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(["'])${escapedOriginal}(["'])`);
          currentLine = currentLine.replace(regex, `$1${s.translated}$2`);
          // Fallback if not inside quotes or other macro string structures
          if (!currentLine.includes(s.translated)) {
            currentLine = currentLine.replace(s.original, s.translated);
          }
        }
      });
      lines[i] = currentLine;
    }
  }

  res.json({ code: lines.join("\n") });
});

app.get("/api/window-designer/run-status", async (req, res) => {
  try {
    const { projectId, all } = req.query as { projectId?: string; all?: string };
    if (all === "true") {
      res.json({
        ok: true,
        statuses: managedProcessService.getAllStatuses(),
        builds: projectBuildCoordinator.getAllStatuses()
      });
      return;
    }
    if (!isNonEmptyString(projectId)) {
      return res.status(400).json({ ok: false, error: "缺少 projectId。" });
    }
    const normalizedProjectId = projectId.trim();
    res.json({
      ok: true,
      status: managedProcessService.getStatus(normalizedProjectId),
      build: projectBuildCoordinator.getStatus(normalizedProjectId)
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "读取运行进程状态失败。" });
  }
});

app.post("/api/window-designer/stop", async (req, res) => {
  try {
    const { projectId, all = false } = req.body as { projectId?: string; all?: boolean };
    if (all) {
      const cancelledBuilds = projectBuildCoordinator.cancelAll("user");
      const result = await managedProcessService.stopAll();
      const failed = result.results.filter(item => item.found && !item.stopped);
      const payload = {
        ok: failed.length === 0,
        stopped: result.stopped > 0,
        stoppedCount: result.stopped,
        forcedCount: result.forced,
        cancelledBuilds,
        message: [
          cancelledBuilds.length ? `已取消 ${cancelledBuilds.length} 个生成任务。` : "",
          result.message
        ].filter(Boolean).join(" "),
        failures: failed
      };
      res.status(failed.length === 0 ? 200 : 500).json(payload);
      return;
    }
    if (!isNonEmptyString(projectId)) {
      return res.status(400).json({ ok: false, error: "缺少 projectId；如需停止全部任务请传入 all=true。" });
    }
    const normalizedProjectId = projectId.trim();
    const cancelledBuild = projectBuildCoordinator.cancel(normalizedProjectId, "user");
    const result = await managedProcessService.stop(normalizedProjectId);
    const ok = !result.found || result.stopped;
    res.status(ok ? 200 : 500).json({
      ok,
      stopped: result.stopped,
      found: result.found,
      forced: result.forced,
      pid: result.pid,
      cancelledBuild,
      message: result.message,
      error: ok ? undefined : result.message
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "停止运行进程失败。" });
  }
});

app.post("/api/window-designer/build-run", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, eplSourceCode, run = true } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
    eplSourceCode?: string;
    run?: boolean;
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }
  if (!isNonEmptyString(project.id)) {
    return res.status(400).json({ ok: false, error: "窗口设计器项目缺少有效 project.id。" });
  }
  const requestedProjectId = project.id.trim();
  const buildAdmission = projectBuildCoordinator.captureAdmission(requestedProjectId);
  const trackedTask = taskService.enqueue({
    type: run ? "project.build-run" : "project.build",
    title: run ? `生成并运行 ${requestedProjectId}` : `生成项目 ${requestedProjectId}`,
    group: `f5:${requestedProjectId}:${Date.now()}`,
    run: async context => {
      context.report(5, "已接收窗口设计器生成请求。");
      const cancel = () => projectBuildCoordinator.cancel(requestedProjectId, "user");
      context.signal.addEventListener("abort", cancel, { once: true });
      try {
        await new Promise<void>((resolve, reject) => res.once("finish", () => {
          if (res.statusCode < 400) resolve(); else reject(new Error(`生成请求失败（HTTP ${res.statusCode}）。`));
        }));
        context.report(100, run ? "生成并运行完成。" : "生成完成。");
      } finally {
        context.signal.removeEventListener("abort", cancel);
      }
    }
  });
  res.setHeader("X-LingBuilder-Task-Id", trackedTask.id);
  void trackedTask.result.catch(() => undefined);

  let buildLease: ProjectBuildLease | undefined;
  let preBuildLogs: string[] = [];
  try {
    const buildSession = await projectBuildSessionService.begin(requestedProjectId, buildAdmission);
    buildLease = buildSession.lease;
    if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
    const projectId = await requireExistingProject(requestedProjectId);
    const buildConfiguration = await buildConfigurationService.read();
    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, preBuildLogs));
    }
    const sourceCode = typeof lingCppSourceCode === "string"
      ? lingCppSourceCode
      : typeof eplSourceCode === "string"
        ? eplSourceCode
        : "";
    const enabledModules = await getModuleService().getEnabledProjectModules(projectId);
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: sourceCode,
      lingCppSourceFilePath,
      enabledModules
    });
    const repoRoot = getRepoWorkspaceRoot();
    const buildRoot = path.join(repoRoot, ".lingbuilder-build");
    const buildDir = path.join(buildRoot, sanitizeFilename(projectId), getBuildOutputSegment(buildConfiguration));
    const sourceDir = path.join(buildDir, "src");
    const binDir = path.join(buildDir, "bin");
    const objDir = path.join(buildDir, "obj");
    const exportDir = path.join(repoRoot, "generated", "cpp", sanitizeFilename(projectId));

    await Promise.all([
      fs.mkdir(sourceDir, { recursive: true }),
      fs.mkdir(binDir, { recursive: true }),
      fs.mkdir(objDir, { recursive: true }),
      fs.mkdir(exportDir, { recursive: true })
    ]);

    const activeWindow = project.windows.find(w => w.id === activeWindowId) || project.windows[0];
    if (activeWindow && sourceCode.trim()) {
      const fileName = `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`;
      await fs.writeFile(path.join(sourceDir, fileName), sourceCode, "utf8");
    }
    await Promise.all(generatedProject.files.map(file => {
      const targetPath = path.join(sourceDir, file.relativePath);
      const exportPath = path.join(exportDir, file.relativePath);
      return Promise.all([
        fs.writeFile(targetPath, file.content, "utf8"),
        fs.writeFile(exportPath, file.content, "utf8")
      ]);
    }));
    const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
      buildDir,
      sourceDir,
      binDir,
      exportDir
      , preferredTargetId: getModuleTargetId(buildConfiguration)
    });
    const buildVisualStudioProject = await exportVisualStudioProject({
      projectDir: buildDir,
      projectId,
      generatedFiles: generatedProject.files.map(file => ({
        ...file,
        relativePath: normalizeFilePath(path.join("src", file.relativePath))
      })),
      enabledModules
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId,
      generatedFiles: generatedProject.files,
      enabledModules
    });

    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, [
        "已完成源码导出，但任务在编译前被停止。"
      ]));
    }

    const compiler = await detectCompiler(buildConfiguration);
    if (!compiler) {
      return res.status(200).json({
        ok: false,
        stage: "compiler",
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        files: generatedProject.files.map(file => path.join(sourceDir, file.relativePath)),
        visualStudioProject: buildVisualStudioProject,
        exportVisualStudioProject: exportVisualStudioProjectResult,
        sourceMap: generatedProject.sourceMap,
        logs: [
          ...preBuildLogs,
          "已生成 Win32 C++ 工程文件。",
          `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
          `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
          ...generatedProject.diagnostics,
          ...moduleNativePlan.diagnostics,
          "未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。",
          "需要的编译器命令之一：cl、g++、clang++。"
        ]
      });
    }

    const sourcePath = path.join(sourceDir, "main.cpp");
    const exePath = path.join(binDir, "LingBuilderPreview.exe");
    const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, buildConfiguration);
    const compilerDiagnostics = mapCompilerDiagnostics(
      parseCompilerDiagnostics(compileResult.logs.join("\n"), compiler.kind === "clang++" ? "clang" : compiler.kind === "g++" ? "gcc" : "msvc"),
      generatedProject.sourceMap,
      repoRoot
    );
    const logs = [
      ...preBuildLogs,
      `已生成 Win32 C++ 工程：${buildDir}`,
      `C++ 源码目录：${sourceDir}`,
      `可复制生成目录：${exportDir}`,
      `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
      `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
      `exe 输出目录：${binDir}`,
      `中间文件目录：${objDir}`,
      `当前窗口：${generatedProject.selectedWindow.title}`,
      `编译器：${compiler.kind} (${compiler.command})`,
      `构建配置：${buildConfiguration.mode}|${buildConfiguration.architecture}`,
      ...generatedProject.diagnostics,
      ...moduleNativePlan.diagnostics,
      moduleNativePlan.runtimeFiles.length ? `已复制模块运行时文件：${moduleNativePlan.runtimeFiles.map(file => path.basename(file)).join(", ")}` : "",
      ...compileResult.logs
    ].filter(Boolean);

    if (!compileResult.ok) {
      return res.status(200).json({
        ok: false,
        stage: "compile",
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exePath,
        compiler,
        exportDir,
        visualStudioProject: buildVisualStudioProject,
        exportVisualStudioProject: exportVisualStudioProjectResult,
        sourceMap: generatedProject.sourceMap,
        compilerDiagnostics,
        logs
      });
    }

    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, [
        ...logs,
        "编译已结束，但启动请求已被停止；不会启动生成的 exe。"
      ]));
    }

    if (run) {
      try {
        const logFile = path.join(buildDir, "run.log");
        const started = await managedProcessService.start(projectId, exePath, {
          cwd: binDir,
          detached: false,
          windowsHide: false,
          logFilePath: logFile
        });
        if (buildLease.isCancelled()) {
          const stopped = await managedProcessService.stop(projectId);
          return res.status(409).json(createCancelledBuildResult(buildLease, [
            ...logs,
            stopped.message,
            "运行进程在登记期间收到停止请求，已回收且不会遗留后台进程。"
          ]));
        }
        logs.push(`已启动受控运行窗口：${exePath}（PID ${started.pid}）`);
        if (started.replaced) logs.push("已停止并替换该项目先前的运行进程。");
      } catch (error: any) {
        const message = error?.message || "无法启动生成的 exe";
        logs.push(`运行启动失败：${message}`);
        return res.status(500).json({
          ok: false,
          stage: "run-start",
          error: message,
          buildDir,
          sourceDir,
          binDir,
          objDir,
          exePath,
          compiler,
          exportDir,
          visualStudioProject: buildVisualStudioProject,
          exportVisualStudioProject: exportVisualStudioProjectResult,
          sourceMap: generatedProject.sourceMap,
          logs
        });
      }
    }

    return res.json({
      ok: true,
      stage: run ? "run" : "build",
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exePath,
      compiler,
      exportDir,
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      compilerDiagnostics,
      logs
    });
  } catch (error: any) {
    const expectedConflict = error instanceof ProjectBuildBusyError
      || error instanceof ProjectBuildCancelledBeforeStartError
      || error instanceof ProjectBuildPreparationError;
    return res.status(expectedConflict ? 409 : 500).json({
      ok: false,
      stage: error instanceof ProjectBuildBusyError
        ? "busy"
        : error instanceof ProjectBuildCancelledBeforeStartError
          ? "cancelled"
        : error instanceof ProjectBuildPreparationError
          ? error.stage
          : "server",
      error: error?.message || "窗口设计器构建运行失败"
    });
  } finally {
    buildLease?.finish();
  }
});

function enqueueSolutionBuildTask(options: {
  projectId?: string; run: boolean; admission: ProjectBuildAdmission; rebuild: boolean;
}) {
  const title = options.rebuild
    ? (options.projectId ? `重新生成项目 ${options.projectId}` : "重新生成解决方案")
    : (options.projectId ? `生成项目 ${options.projectId}` : "生成解决方案");
  return taskService.enqueue({
    type: options.rebuild ? "solution.rebuild" : "solution.build",
    title,
    group: `build:${options.projectId || "solution"}`,
    run: async context => {
      const solutionAtStart = await getSolutionService().getSolution();
      const buildProjectIds = getSolutionService().getBuildOrder(
        solutionAtStart,
        options.projectId ? [options.projectId] : undefined
      ).map(project => project.id);
      const cancelBuild = () => buildProjectIds.forEach(projectId => projectBuildCoordinator.cancel(projectId, "user"));
      context.signal.addEventListener("abort", cancelBuild, { once: true });
      try {
        let clean: Awaited<ReturnType<ReturnType<typeof getSolutionService>["cleanProjects"]>> | undefined;
        if (options.rebuild) {
          context.report(10, "正在清理旧构建产物。");
          clean = await getSolutionService().cleanProjects(options.projectId ? [options.projectId] : undefined);
          clean.logs.forEach(line => context.log(line));
          await incrementalBuildService.invalidate(buildProjectIds.map(projectId => `${projectId}:Debug:Win32`).concat(
            buildProjectIds.flatMap(projectId => [`${projectId}:Debug:x64`, `${projectId}:Release:Win32`, `${projectId}:Release:x64`])
          ));
        }
        context.report(options.rebuild ? 30 : 10, "正在生成项目。");
        const build = await buildSolutionProjects({ projectId: options.projectId, run: options.run, admission: options.admission, incremental: !options.rebuild });
        build.logs.forEach(line => context.log(line));
        if (!build.ok) throw new Error(build.logs.at(-1) || "生成失败。");
        context.report(100, "任务完成。");
        return clean ? { ...build, logs: [...clean.logs, ...build.logs], clean } : build;
      } finally {
        context.signal.removeEventListener("abort", cancelBuild);
      }
    }
  });
}

async function buildSolutionProjects(options: {
  projectId?: string;
  run?: boolean;
  admission?: ProjectBuildAdmission;
  incremental?: boolean;
}) {
  const solutionService = getSolutionService();
  const solution = await solutionService.getSolution();
  const projects = options.projectId
    ? solutionService.getBuildOrder(solution, [options.projectId])
    : solutionService.getBuildOrder(solution);
  const runProjectIds = new Set(options.projectId ? [options.projectId] : solution.startupProjectIds);
  const logs: string[] = [
    options.projectId
      ? `开始生成项目：${projects[0]?.name || options.projectId}`
      : `开始生成解决方案：${solution.name}（${projects.length} 个项目）`
  ];
  const results: any[] = [];
  let ok = true;
  let stage = "build";

  const batches = dependencyBuildBatches(projects);
  logs.push(`构建计划：${batches.length} 个依赖阶段，阶段内最多 ${Math.max(...batches.map(batch => batch.length))} 个项目并行。`);
  for (const [batchIndex, batch] of batches.entries()) {
    logs.push(`开始构建阶段 ${batchIndex + 1}/${batches.length}：${batch.map(project => project.name).join("、")}`);
    const batchResults = await Promise.all(batch.map(async projectRef => {
    if (projectRef.type === "external-cmake" || projectRef.type === "external-msbuild") {
      const lease = projectBuildCoordinator.begin(projectRef.id, options.admission);
      try {
        const externalResult = await externalProjectService.build(projectRef as any, lease.signal);
        return { projectId: projectRef.id, projectName: projectRef.name, stage: "external-build", logs: [externalResult.stdout, externalResult.stderr].filter(Boolean), ...externalResult };
      } finally { lease.finish(); }
    }
    const project = await solutionService.readDesignerProject(projectRef);
    const files = await solutionService.readProjectFiles(projectRef);
    const source = resolveProjectLingCppSource(projectRef, project, files);
    logs.push(`正在生成项目 ${projectRef.name} (${projectRef.id})...`);
    const result = await runControlledWindowDesignerBuild({
      project,
      activeWindowId: project.windows[0]?.id,
      lingCppSourceCode: source.sourceCode,
      lingCppSourceFilePath: source.filePath,
      run: Boolean(options.run && runProjectIds.has(projectRef.id)),
      buildAdmission: options.admission,
      incremental: options.incremental !== false
    });
    return { projectId: projectRef.id, projectName: projectRef.name, ...result };
    }));
    results.push(...batchResults);
    for (const result of batchResults) {
      logs.push(...(result.logs || []).map((line: string) => `[${result.projectName}] ${line}`));
      if (!result.ok) {
        ok = false; stage = result.stage || "build";
        logs.push(`项目 ${result.projectName} 生成失败：${result.stage || "未知错误"}`);
      } else logs.push(`项目 ${result.projectName} ${"incrementalHit" in result && result.incrementalHit ? "增量检查完成，无需重新编译" : "生成完成"}。`);
    }
    if (!ok) break;
  }

  logs.push(ok ? "解决方案生成完成。" : "解决方案生成已停止。");
  return {
    ok,
    stage,
    solution,
    results,
    logs
  };
}

async function runControlledWindowDesignerBuild(options: {
  project: LingWindowProject;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  run?: boolean;
  buildAdmission?: ProjectBuildAdmission;
  incremental?: boolean;
}) {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, run = false, buildAdmission, incremental = true } = options;
  let buildLease: ProjectBuildLease | undefined;
  let projectId: string;
  let preBuildLogs: string[] = [];
  try {
    if (!isNonEmptyString(project.id)) throw new Error("窗口设计器项目缺少有效 project.id。");
    projectId = project.id.trim();
    const effectiveAdmission = buildAdmission ?? projectBuildCoordinator.captureAdmission(projectId);
    const buildSession = await projectBuildSessionService.begin(projectId, effectiveAdmission);
    buildLease = buildSession.lease;
    if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
    await requireExistingProject(projectId);
  } catch (error) {
    return {
      ok: false,
      stage: error instanceof ProjectBuildBusyError
        ? "busy"
        : error instanceof ProjectBuildCancelledBeforeStartError
          ? "cancelled"
        : error instanceof ProjectBuildPreparationError
          ? error.stage
          : "server",
      error: error instanceof Error ? error.message : "无法开始项目生成任务。",
      logs: [error instanceof Error ? error.message : "无法开始项目生成任务。"]
    };
  }

  try {
  if (buildLease.isCancelled()) return createCancelledBuildResult(buildLease, preBuildLogs);
  const sourceCode = typeof lingCppSourceCode === "string" ? lingCppSourceCode : "";
  const buildConfiguration = await buildConfigurationService.read();
  const enabledModules = await getModuleService().getEnabledProjectModules(projectId);
  const generatedProject = generateLingCppNativeWin32Project(project, {
    activeWindowId,
    lingCppSourceCode: sourceCode,
    lingCppSourceFilePath,
    enabledModules
  });
  const repoRoot = getRepoWorkspaceRoot();
  const buildRoot = path.join(repoRoot, ".lingbuilder-build");
  const buildDir = path.join(buildRoot, sanitizeFilename(projectId), getBuildOutputSegment(buildConfiguration));
  const sourceDir = path.join(buildDir, "src");
  const binDir = path.join(buildDir, "bin");
  const objDir = path.join(buildDir, "obj");
  const exportDir = path.join(repoRoot, "generated", "cpp", sanitizeFilename(projectId));
  const exePath = path.join(binDir, "LingBuilderPreview.exe");

  await Promise.all([
    fs.mkdir(sourceDir, { recursive: true }),
    fs.mkdir(binDir, { recursive: true }),
    fs.mkdir(objDir, { recursive: true }),
    fs.mkdir(exportDir, { recursive: true })
  ]);

  const activeWindow = project.windows.find(w => w.id === activeWindowId) || project.windows[0];
  if (activeWindow && sourceCode.trim()) {
    const fileName = `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`;
    await fs.writeFile(path.join(sourceDir, fileName), sourceCode, "utf8");
  }
  await Promise.all(generatedProject.files.map(file => {
    const targetPath = path.join(sourceDir, file.relativePath);
    const exportPath = path.join(exportDir, file.relativePath);
    return Promise.all([
      fs.writeFile(targetPath, file.content, "utf8"),
      fs.writeFile(exportPath, file.content, "utf8")
    ]);
  }));
  const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
    buildDir,
    sourceDir,
    binDir,
    exportDir,
    preferredTargetId: getModuleTargetId(buildConfiguration)
  });
  const buildVisualStudioProject = await exportVisualStudioProject({
    projectDir: buildDir,
    projectId,
    generatedFiles: generatedProject.files.map(file => ({
      ...file,
      relativePath: normalizeFilePath(path.join("src", file.relativePath))
    })),
    enabledModules
  });
  const exportVisualStudioProjectResult = await exportVisualStudioProject({
    projectDir: exportDir,
    projectId,
    generatedFiles: generatedProject.files,
    enabledModules
  });

  const incrementalKey = `${projectId}:${buildConfiguration.mode}:${buildConfiguration.architecture}`;
  const incrementalFingerprint = incrementalBuildService.fingerprint({
    schemaVersion: 1,
    project,
    sourceCode,
    sourceFilePath: lingCppSourceFilePath || "",
    generatedFiles: generatedProject.files,
    enabledModules,
    buildConfiguration
  });
  if (incremental && !run && await incrementalBuildService.isFresh(incrementalKey, incrementalFingerprint)) {
    return {
      ok: true,
      stage: "incremental",
      incrementalHit: true,
      buildDir, sourceDir, binDir, objDir, exePath, exportDir,
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      compilerDiagnostics: [],
      logs: [...preBuildLogs, "增量构建命中：输入和输出均未变化，已跳过 C++ 编译。"]
    };
  }

  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, ["已完成源码导出，但任务在编译前被停止。"]);
  }

  const compiler = await detectCompiler(buildConfiguration);
  if (!compiler) {
    return {
      ok: false,
      stage: "compiler",
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exportDir,
      files: generatedProject.files.map(file => path.join(sourceDir, file.relativePath)),
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      logs: [
        ...preBuildLogs,
        "已生成 Win32 C++ 工程文件。",
        `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
        `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
        ...generatedProject.diagnostics,
        ...moduleNativePlan.diagnostics,
        "未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。",
        "需要的编译器命令之一：cl、g++、clang++。"
      ]
    };
  }

  const sourcePath = path.join(sourceDir, "main.cpp");
  const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, buildConfiguration, buildLease.signal);
  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, [...preBuildLogs, ...compileResult.logs, "编译子进程已终止并完成取消清理。"]);
  }
  const compilerDiagnostics = mapCompilerDiagnostics(
    parseCompilerDiagnostics(compileResult.logs.join("\n"), compiler.kind === "clang++" ? "clang" : compiler.kind === "g++" ? "gcc" : "msvc"),
    generatedProject.sourceMap,
    repoRoot
  );
  const logs = [
    ...preBuildLogs,
    `已生成 Win32 C++ 工程：${buildDir}`,
    `C++ 源码目录：${sourceDir}`,
    `可复制生成目录：${exportDir}`,
    `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
    `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
    `exe 输出目录：${binDir}`,
    `中间文件目录：${objDir}`,
    `当前窗口：${generatedProject.selectedWindow.title}`,
    `编译器：${compiler.kind} (${compiler.command})`,
    ...generatedProject.diagnostics,
    ...moduleNativePlan.diagnostics,
    moduleNativePlan.runtimeFiles.length ? `已复制模块运行时文件：${moduleNativePlan.runtimeFiles.map(file => path.basename(file)).join(", ")}` : "",
    ...compileResult.logs
  ].filter(Boolean);

  if (!compileResult.ok) {
    return {
      ok: false,
      stage: "compile",
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exePath,
      compiler,
      exportDir,
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      compilerDiagnostics,
      logs
    };
  }

  await incrementalBuildService.record(incrementalKey, incrementalFingerprint, [exePath]);

  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, [
      ...logs,
      "编译已结束，但启动请求已被停止；不会启动生成的 exe。"
    ]);
  }

  if (run) {
    try {
      const logFile = path.join(buildDir, "run.log");
      const started = await managedProcessService.start(projectId, exePath, {
        cwd: binDir,
        detached: false,
        windowsHide: false,
        logFilePath: logFile
      });
      if (buildLease.isCancelled()) {
        const stopped = await managedProcessService.stop(projectId);
        return createCancelledBuildResult(buildLease, [
          ...logs,
          stopped.message,
          "运行进程在登记期间收到停止请求，已回收且不会遗留后台进程。"
        ]);
      }
      logs.push(`已启动受控运行窗口：${exePath}（PID ${started.pid}）`);
      if (started.replaced) logs.push("已停止并替换该项目先前的运行进程。");
    } catch (error: any) {
      const message = error?.message || "无法启动生成的 exe";
      logs.push(`运行启动失败：${message}`);
      return {
        ok: false,
        stage: "run-start",
        error: message,
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exePath,
        compiler,
        exportDir,
        visualStudioProject: buildVisualStudioProject,
        exportVisualStudioProject: exportVisualStudioProjectResult,
        sourceMap: generatedProject.sourceMap,
        logs
      };
    }
  }

  return {
    ok: true,
    stage: run ? "run" : "build",
    buildDir,
    sourceDir,
    binDir,
    objDir,
    exePath,
    compiler,
    exportDir,
    visualStudioProject: buildVisualStudioProject,
    exportVisualStudioProject: exportVisualStudioProjectResult,
    sourceMap: generatedProject.sourceMap,
    compilerDiagnostics,
    logs
  };
  } finally {
    buildLease.finish();
  }
}

function createCancelledBuildResult(buildLease: ProjectBuildLease, logs: string[] = []) {
  const reason = buildLease.getCancelReason();
  const reasonText = reason === "shutdown"
    ? "本地服务正在关闭"
    : reason === "project-delete"
      ? "项目正在删除"
      : "用户已请求停止";
  const error = `项目“${buildLease.projectId}”的生成运行任务已取消：${reasonText}。`;
  return {
    ok: false,
    stage: "cancelled",
    error,
    projectId: buildLease.projectId,
    taskId: buildLease.taskId,
    logs: [...logs, error]
  };
}

function resolveProjectLingCppSource(
  projectRef: LingBuilderSolutionProject,
  project: LingWindowProject,
  files: Record<string, string>
): { filePath: string; sourceCode: string } {
  const activeWindow = project.windows[0];
  const preferredName = activeWindow
    ? `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`
    : "";
  const preferredPath = preferredName ? `${projectRef.sourceRoot}/${preferredName}` : "";
  if (preferredPath && typeof files[preferredPath] === "string") {
    return { filePath: preferredPath, sourceCode: files[preferredPath] };
  }
  const fallbackPath = Object.keys(files).find(filePath => filePath.endsWith(".lcpp")) || preferredPath || `${projectRef.sourceRoot}/MainWindow.lcpp`;
  return { filePath: fallbackPath, sourceCode: files[fallbackPath] || "" };
}

type CompilerInfo = {
  kind: "msvc" | "g++" | "clang++";
  command: string;
  setupBatch?: string;
};


app.get("/api/window-designer/recovery", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try { res.json({ ok: true, recovery: await hotExitRecoveryService.read(projectId) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.post("/api/window-designer/recovery", async (req, res) => {
  try {
    const projectId = String(req.body?.projectId || "");
    if (!projectId || typeof req.body?.files !== "object") return res.status(400).json({ ok: false, error: "缺少项目恢复数据" });
    await hotExitRecoveryService.write({ ...req.body, schemaVersion: 1, projectId, savedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.delete("/api/window-designer/recovery", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try { await hotExitRecoveryService.delete(projectId); res.json({ ok: true }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.get("/api/window-designer/files/watch", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const watchers = [projectRef.sourceRoot, projectRef.configRoot].map(relativeRoot => {
      const absoluteRoot = path.join(getRepoWorkspaceRoot(), relativeRoot);
      return watchFiles(absoluteRoot, { recursive: true }, (_eventType, fileName) => {
        if (!fileName) return;
        const relativePath = path.posix.join(relativeRoot.replace(/\\/g, "/"), String(fileName).replace(/\\/g, "/"));
        if (!isAllowedProjectTextPath(relativePath) || relativePath.includes(".lingbuilder-")) return;
        res.write(`event: file-change\ndata: ${JSON.stringify({ path: relativePath })}\n\n`);
      });
    });
    const designerRelativePath = projectRef.designerPath.replace(/\\/g, "/");
    const designerDirectory = path.dirname(path.join(getRepoWorkspaceRoot(), projectRef.designerPath));
    const designerFileName = path.basename(projectRef.designerPath);
    const designerWatcher = watchFiles(designerDirectory, { recursive: false }, (_eventType, fileName) => {
      if (!fileName || path.basename(String(fileName)) !== designerFileName) return;
      res.write(`event: file-change\ndata: ${JSON.stringify({ path: designerRelativePath })}\n\n`);
    });
    watchers.push(designerWatcher);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
    req.on("close", () => { clearInterval(heartbeat); watchers.forEach(watcher => watcher.close()); });
  } catch (error: any) {
    if (!res.headersSent) res.status(400).json({ ok: false, error: error.message });
    else res.end();
  }
});

app.get("/api/window-designer/files", async (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  if (!projectId) {
    return res.status(400).json({ ok: false, error: "缺少 projectId" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const projectRef = solutionService.getProject(solution, projectId);
    const snapshots = await solutionService.readProjectFileSnapshots(projectRef);
    const files = Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [filePath, snapshot.content])
    );
    const fileFormats = Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [filePath, snapshot.format])
    );
    const fileVersions = Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [
        filePath,
        createProjectFileVersion(encodeTextFile(snapshot.content, snapshot.format))
      ])
    );
    const designerProject = await solutionService.readDesignerProject(projectRef);
    const designerRelativePath = projectRef.designerPath.replace(/\\/g, "/");
    try {
      const designerBytes = await fs.readFile(path.join(getRepoWorkspaceRoot(), projectRef.designerPath));
      fileVersions[designerRelativePath] = createProjectFileVersion(designerBytes);
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
    res.json({
      ok: true,
      files,
      fileFormats,
      fileVersions,
      designerPath: designerRelativePath,
      designerProject
    });
  } catch (err: any) {
    const status = err instanceof TextFileFormatError ? 400 : 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

app.post("/api/window-designer/files", async (req, res) => {
  const { projectId, files, fileFormats, baseVersions, project } = req.body as {
    projectId?: string;
    files?: Record<string, string>;
    fileFormats?: Record<string, TextFileFormat>;
    baseVersions?: Record<string, string>;
    project?: LingWindowProject;
  };
  if (!projectId || !files) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 files" });
  }

  try {
    const repoRoot = getRepoWorkspaceRoot();
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const projectRef = solutionService.getProject(solution, projectId);
    const existingSnapshots = await solutionService.readProjectFileSnapshots(projectRef);
    const designerPath = path.join(repoRoot, projectRef.designerPath);
    const designerDir = path.dirname(designerPath);
    await fs.mkdir(designerDir, { recursive: true });

    const pendingWrites: Array<{ relativePath: string; targetPath: string; bytes: Buffer; expectedVersion?: string }> = [];
    for (const [relativePath, content] of Object.entries(files)) {
      const normalizedPath = relativePath.replace(/\\/g, "/");
      if (!isAllowedProjectTextPath(normalizedPath)) {
        throw new ProjectFileSaveValidationError(`不支持保存该项目文件类型：${relativePath}`);
      }
      if (normalizedPath.split("/").includes("..")) {
        throw new ProjectFileSaveValidationError(`项目文件路径不能越过工作区：${relativePath}`);
      }
      if (
        !normalizedPath.startsWith(`${projectRef.sourceRoot}/`)
        && !normalizedPath.startsWith(`${projectRef.configRoot}/`)
        && !(projectRef.isDefault && (normalizedPath.startsWith("src/") || normalizedPath.startsWith("config/")))
      ) {
        throw new ProjectFileSaveValidationError(`项目文件不在当前项目源码或配置目录内：${relativePath}`);
      }
      const targetPath = await workspacePathPolicy.resolveForWrite(normalizedPath);
      const format = fileFormats?.[relativePath]
        || fileFormats?.[normalizedPath]
        || existingSnapshots[normalizedPath]?.format
        || { encoding: "utf8", eol: "lf" };
      pendingWrites.push({
        relativePath: normalizedPath,
        targetPath,
        bytes: encodeTextFile(content, format),
        expectedVersion: baseVersions?.[relativePath] ?? baseVersions?.[normalizedPath]
      });
    }

    const designerRelativePath = projectRef.designerPath.replace(/\\/g, "/");
    if (project) pendingWrites.push({
      relativePath: designerRelativePath,
      targetPath: designerPath,
      bytes: Buffer.from(JSON.stringify(project, null, 2), "utf8"),
      expectedVersion: baseVersions?.[designerRelativePath]
    });
    await projectFilePersistenceService.writeAll(pendingWrites);

    const savedSnapshots = await solutionService.readProjectFileSnapshots(projectRef);
    const savedFileFormats = Object.fromEntries(
      Object.entries(savedSnapshots).map(([filePath, snapshot]) => [filePath, snapshot.format])
    );
    const fileVersions = Object.fromEntries(
      Object.entries(savedSnapshots).map(([filePath, snapshot]) => [
        filePath,
        createProjectFileVersion(encodeTextFile(snapshot.content, snapshot.format))
      ])
    );
    try {
      fileVersions[designerRelativePath] = createProjectFileVersion(await fs.readFile(designerPath));
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
    res.json({
      ok: true,
      fileFormats: savedFileFormats,
      fileVersions,
      designerPath: designerRelativePath
    });
  } catch (err: any) {
    if (err instanceof ProjectFileConflictError) {
      const solutionService = getSolutionService();
      const solution = await solutionService.getSolution();
      const projectRef = solutionService.getProject(solution, projectId);
      const snapshots = await solutionService.readProjectFileSnapshots(projectRef);
      const designerRelativePath = projectRef.designerPath.replace(/\\/g, "/");
      const designerProject = await solutionService.readDesignerProject(projectRef);
      const conflictFileVersions = Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [
        key,
        createProjectFileVersion(encodeTextFile(value.content, value.format))
      ]));
      try {
        conflictFileVersions[designerRelativePath] = createProjectFileVersion(
          await fs.readFile(path.join(getRepoWorkspaceRoot(), projectRef.designerPath))
        );
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
      return res.status(409).json({
        ok: false,
        code: "PROJECT_FILE_CONFLICT",
        error: err.message,
        files: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.content])),
        fileFormats: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.format])),
        fileVersions: conflictFileVersions,
        designerPath: designerRelativePath,
        designerProject
      });
    }
    const status = err instanceof TextFileFormatError
      || err instanceof ProjectFileSaveValidationError
      || err instanceof WorkspacePathPolicyError
      ? 400
      : 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

app.post("/api/window-designer/files/rename", async (req, res) => {
  const { projectId, sourcePath, targetPath } = req.body as {
    projectId?: string;
    sourcePath?: string;
    targetPath?: string;
  };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sourcePath) || !isNonEmptyString(targetPath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId、sourcePath 或 targetPath。" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const project = solutionService.getProject(solution, projectId.trim());
    const result = await projectFileMutationService.renameFile({ project, sourcePath, targetPath });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    respondWithProjectFileMutationError(res, error, "文件重命名失败");
  }
});

app.post("/api/window-designer/files/delete", async (req, res) => {
  const { projectId, filePath } = req.body as { projectId?: string; filePath?: string };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(filePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 filePath。" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const project = solutionService.getProject(solution, projectId.trim());
    const result = await projectFileMutationService.deleteFile({ project, filePath });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    respondWithProjectFileMutationError(res, error, "文件删除失败");
  }
});

app.get("/api/source-control/status", async (_req, res) => {
  res.json(await gitService.status());
});
app.post("/api/source-control/stage", async (req, res) => sourceControlAction(res, () => gitService.stage(req.body?.paths)));
app.post("/api/source-control/unstage", async (req, res) => sourceControlAction(res, () => gitService.unstage(req.body?.paths)));
app.post("/api/source-control/commit", async (req, res) => sourceControlAction(res, () => gitService.commit(req.body?.message)));
app.get("/api/source-control/branches", async (_req, res) => sourceControlAction(res, () => gitService.branches()));
app.post("/api/source-control/branches", async (req, res) => sourceControlAction(res, () => gitService.createBranch(req.body?.name, req.body?.checkout !== false)));
app.post("/api/source-control/branches/checkout", async (req, res) => sourceControlAction(res, () => gitService.checkoutBranch(req.body?.name)));
app.delete("/api/source-control/branches/:name", async (req, res) => sourceControlAction(res, () => gitService.deleteBranch(req.params.name)));
app.get("/api/source-control/history", async (req, res) => sourceControlAction(res, () => gitService.history(Number(req.query.limit || 50), Number(req.query.skip || 0))));
app.get("/api/source-control/blame", async (req, res) => sourceControlAction(res, () => gitService.blame(String(req.query.path || ""), Number(req.query.startLine || 1), Number(req.query.endLine || req.query.startLine || 1))));
app.get("/api/source-control/remotes", async (_req, res) => sourceControlAction(res, () => gitService.remotes()));
app.post("/api/source-control/fetch", async (req, res) => sourceControlAction(res, () => gitService.fetch(req.body?.remote)));
app.post("/api/source-control/pull", async (req, res) => sourceControlAction(res, () => gitService.pull(req.body?.remote, req.body?.branch, req.body?.strategy)));
app.post("/api/source-control/push", async (req, res) => sourceControlAction(res, () => gitService.push(req.body?.remote, req.body?.branch, Boolean(req.body?.setUpstream))));
app.post("/api/source-control/merge", async (req, res) => sourceControlAction(res, () => gitService.merge(req.body?.branch)));
app.post("/api/source-control/rebase", async (req, res) => sourceControlAction(res, () => gitService.rebase(req.body?.branch)));
app.get("/api/source-control/conflicts", async (_req, res) => sourceControlAction(res, () => gitService.conflicts()));
app.get("/api/source-control/conflicts/file", async (req, res) => sourceControlAction(res, () => gitService.conflictDetail(String(req.query.path || ""))));
app.post("/api/source-control/conflicts/resolve", async (req, res) => sourceControlAction(res, () => gitService.resolveConflict(req.body?.path, req.body?.resolution, req.body?.content)));
app.post("/api/source-control/integration/abort", async (req, res) => sourceControlAction(res, () => gitService.abortIntegration(req.body?.kind)));
app.post("/api/source-control/integration/continue", async (req, res) => sourceControlAction(res, () => gitService.continueIntegration(req.body?.kind)));
app.post("/api/source-control/pull-requests", async (req, res) => sourceControlAction(res, () => gitService.createPullRequest(req.body || {})));

app.get("/api/tests/discover", async (_req, res) => {
  try { res.json({ ok: true, tests: await testExplorerService.discover() }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试发现失败。" }); }
});
app.post("/api/tests/run", async (req, res) => {
  const controller = new AbortController(); req.on("aborted", () => controller.abort());
  try { res.json({ ok: true, result: await testExplorerService.run(String(req.body?.testId || ""), controller.signal) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试运行失败。" }); }
});
app.post("/api/tests/debug", async (req, res) => {
  try {
    const configuration = testExplorerService.debugConfiguration(String(req.body?.testId || ""));
    if (configuration.adapter === "node-inspector") { await nativeDebugService.stop(); res.json({ ok: true, adapter: configuration.adapter, session: await nodeTestDebugService.start({ testId: configuration.test.id, program: configuration.program, args: configuration.args, cwd: configuration.cwd }) }); }
    else { await nodeTestDebugService.stop(); await nativeDebugService.stop(); const program = path.isAbsolute(configuration.program) ? configuration.program : path.resolve(configuration.cwd, configuration.program); res.json({ ok: true, adapter: configuration.adapter, session: await nativeDebugService.start({ program, cwd: configuration.cwd, args: configuration.args, stopAtEntry: true }) }); }
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试调试启动失败。" }); }
});
app.get("/api/tests/debug/node", (_req, res) => res.json({ ok: true, session: nodeTestDebugService.getSnapshot() }));
app.post("/api/tests/debug/node/continue", async (_req, res) => { try { res.json({ ok: true, session: await nodeTestDebugService.continue() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "继续 Node 测试失败。" }); } });
app.post("/api/tests/debug/stop", async (_req, res) => { await Promise.all([nodeTestDebugService.stop(), nativeDebugService.stop()]); res.json({ ok: true }); });
app.post("/api/quality/import", async (req, res) => { try { res.json({ ok: true, report: await qualityService.importReports(req.body || {}) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "质量报告导入失败。" }); } });
app.post("/api/quality/node-coverage", async (req, res) => { try { res.json({ ok: true, report: await qualityService.runNodeCoverage(String(req.body?.filePath || ""), req.body?.testName) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "Node 覆盖率运行失败。" }); } });
app.post("/api/performance/collect", async (req, res) => { try { res.json({ ok: true, report: await performanceService.collect(req.body || {}) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "性能采集失败。" }); } });
app.post("/api/performance/cancel", (_req, res) => res.json({ ok: true, cancelled: performanceService.cancel() }));
app.post("/api/performance/import", async (req, res) => { try { res.json({ ok: true, report: await performanceService.importCpuProfile(String(req.body?.filePath || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "性能报告导入失败。" }); } });
app.get("/api/publishing/configuration", async (_req, res) => { try { const configuration = await publishingService.readOptionalConfiguration(); res.json({ ok: true, configured: Boolean(configuration), configuration: configuration || null }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "发布配置读取失败。" }); } });
app.post("/api/publishing/run", async (req, res) => { try { res.json({ ok: true, result: await publishingService.publish(req.body?.configuration || await publishingService.readConfiguration()) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "发布失败。" }); } });
app.post("/api/publishing/verify-signature", async (req, res) => { try { res.json({ ok: true, valid: await publishingService.verifySignature(String(req.body?.filePath || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "签名验证失败。" }); } });
app.post("/api/ai-index/rebuild", async (req, res) => { const controller = new AbortController(); req.on("aborted", () => controller.abort()); try { const snapshot = await workspaceIndexService.rebuild(controller.signal); res.json({ ok: true, fileCount: snapshot.files.length, generatedAt: snapshot.generatedAt }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "工作区索引构建失败。" }); } });
app.post("/api/ai-index/cancel", (_req, res) => res.json({ ok: true, cancelled: workspaceIndexService.cancel() }));
app.get("/api/ai-index/search", async (req, res) => { try { res.json({ ok: true, hits: await workspaceIndexService.search(String(req.query.query || ""), Number(req.query.limit || 20)) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "工作区索引查询失败。" }); } });
app.post("/api/settings-sync/export", async (req, res) => { try { res.json({ ok: true, result: await settingsSyncService.exportBundle(String(req.body?.filePath || '.lingbuilder/settings-sync.json')) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "设置同步包导出失败。" }); } });
app.post("/api/settings-sync/preview", async (req, res) => { try { res.json({ ok: true, preview: await settingsSyncService.preview(String(req.body?.filePath || '')) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "设置同步包预览失败。" }); } });
app.post("/api/settings-sync/import", async (req, res) => { try { res.json({ ok: true, result: await settingsSyncService.importBundle(String(req.body?.filePath || ''), String(req.body?.token || '')) }); } catch (error: any) { res.status(409).json({ ok: false, error: error?.message || "设置同步包导入失败。" }); } });
app.get("/api/extensions", async (_req, res) => { try { res.json({ ok: true, host: await extensionService.start() }); } catch (error: any) { res.status(500).json({ ok: false, error: error?.message || "Extension Host 启动失败。", host: extensionService.getSnapshot() }); } });
app.post("/api/extensions/refresh", async (_req, res) => { try { res.json({ ok: true, host: await extensionService.refresh() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展刷新失败。" }); } });
app.put("/api/extensions/:extensionId/enabled", async (req, res) => { try { res.json({ ok: true, host: await extensionService.setEnabled(req.params.extensionId, Boolean(req.body?.enabled)) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展状态更新失败。" }); } });
app.post("/api/extensions/commands/:command", async (req, res) => { try { res.json({ ok: true, result: await extensionService.executeCommand(req.params.command, req.body?.args || []), host: extensionService.getSnapshot() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展命令执行失败。" }); } });
app.post("/api/extensions/languages/:languageId/activate", async (req, res) => { try { await extensionService.activateLanguage(req.params.languageId); res.json({ ok: true, host: extensionService.getSnapshot() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "语言扩展激活失败。" }); } });
app.get("/api/extensions/:extensionId/themes/:themeId", async (req, res) => { try { res.json({ ok: true, theme: await extensionService.loadTheme(req.params.extensionId, req.params.themeId) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展主题读取失败。" }); } });
app.get("/api/dependencies", async (_req, res) => { try { res.json({ ok: true, snapshot: await dependencyService.inspect() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "依赖清单读取失败。" }); } });
app.post("/api/dependencies/restore", async (req, res) => { try { res.json({ ok: true, result: await dependencyService.restore({ manifestPath: req.body?.manifestPath, offline: Boolean(req.body?.offline), triplet: req.body?.triplet }) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "依赖恢复失败。" }); } });
app.get("/api/resources/rc", async (req, res) => { try { res.json({ ok: true, document: await rcResourceService.read(String(req.query.path || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "RC 资源读取失败。" }); } });
app.put("/api/resources/rc", async (req, res) => { try { res.json({ ok: true, document: await rcResourceService.apply(req.body?.filePath, req.body?.token, req.body?.edits) }); } catch (error: any) { res.status(409).json({ ok: false, error: error?.message || "RC 资源保存失败。" }); } });

async function sourceControlAction(res: express.Response, action: () => Promise<unknown>) {
  try { res.json({ ok: true, result: await action() }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "Git 操作失败。" }); }
}

app.post("/api/lingcpp/edit/propose", async (req, res) => {
  const { filePath, sourceCode, instruction, selection, workspaceFiles, projectId, moduleContext, aiConfig } = req.body as {
    filePath?: string;
    sourceCode?: string;
    instruction?: string;
    projectId?: string;
    moduleContext?: LingCppModuleContext;
    aiConfig?: AiConnectionConfig;
    selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    workspaceFiles?: Array<{ filePath: string; sourceCode: string; language?: string }>;
  };

  if (!filePath || typeof sourceCode !== "string") {
    return res.status(400).json({ ok: false, error: "缺少 filePath 或 sourceCode" });
  }

  const context: LingCppEditContext = {
    filePath,
    sourceCode,
    instruction: instruction || "",
    selection,
    workspaceFiles: sanitizeWorkspaceFiles(workspaceFiles),
    moduleContext: await resolveLingCppEditModuleContext(projectId, moduleContext),
    aiConfig
  };

  let draft: LingCppEditDraft | undefined;
  try {
    draft = await planLingCppEditWithGemini(context);
  } catch (error: any) {
    draft = {
      summary: context.instruction.trim() || "根据当前上下文生成中文 C++ 编辑建议",
      explanation: `Gemini 编辑提案生成失败，已降级为本地安全提案：${error?.message || "未知错误"}`
    };
  }

  const proposal = proposeLingCppEdit(context, draft);
  res.json({ ok: true, proposal });
});

app.post("/api/lingcpp/edit/from-system-draft", async (req, res) => {
  const { filePath, sourceCode, instruction, workspaceFiles, files, projectId, moduleContext } = req.body as {
    filePath?: string;
    sourceCode?: string;
    instruction?: string;
    projectId?: string;
    moduleContext?: LingCppModuleContext;
    workspaceFiles?: Array<{ filePath: string; sourceCode: string; language?: string }>;
    files?: Array<{ filePath: string; updatedSource: string }>;
  };
  if (!filePath || typeof sourceCode !== "string" || !Array.isArray(files)) {
    return res.status(400).json({ ok: false, error: "系统 AI 编辑草稿缺少必要字段。" });
  }
  const safeWorkspaceFiles = sanitizeWorkspaceFiles(workspaceFiles);
  const allowedPaths = new Set([filePath, ...safeWorkspaceFiles.map(file => file.filePath)].map(normalizeFilePath));
  const safeDraftFiles = files
    .filter(file => file && typeof file.filePath === "string" && typeof file.updatedSource === "string")
    .filter(file => allowedPaths.has(normalizeFilePath(file.filePath)))
    .slice(0, 5);
  if (!safeDraftFiles.length) return res.status(400).json({ ok: false, error: "系统 AI 未返回允许范围内的文件修改。" });
  for (const file of safeDraftFiles) {
    if (!file.filePath.endsWith(".lcpp")) continue;
    const original = safeWorkspaceFiles.find(item => normalizeFilePath(item.filePath) === normalizeFilePath(file.filePath));
    if (original && parseLingCpp(original.sourceCode).program.classes.length > 0 && parseLingCpp(file.updatedSource).program.classes.length === 0) {
      return res.status(400).json({ ok: false, error: `系统 AI 返回的 ${file.filePath} 未通过 LingCpp 类结构校验。` });
    }
  }
  const context: LingCppEditContext = {
    filePath: normalizeFilePath(filePath), sourceCode, instruction: instruction || "系统 AI 编辑",
    workspaceFiles: safeWorkspaceFiles,
    moduleContext: await resolveLingCppEditModuleContext(projectId, moduleContext)
  };
  const proposal = proposeLingCppEdit(context, { summary: instruction || "系统 AI 编辑提案", explanation: "系统 AI 已返回完整文件草稿；该草稿经过本地路径与 LingCpp 结构校验，仍需预览确认后才能应用。", files: safeDraftFiles });
  res.json({ ok: true, proposal });
});

app.post("/api/lingcpp/edit/apply", async (req, res) => {
  const { proposalId, sourceCode, workspaceFiles } = req.body as {
    proposalId?: string;
    sourceCode?: string;
    workspaceFiles?: Array<{ filePath: string; sourceCode: string; language?: string }>;
  };
  if (!proposalId) {
    return res.status(400).json({ ok: false, error: "缺少 proposalId" });
  }
  const proposal = getWorkspaceEditProposal(proposalId);
  if (!proposal) {
    return res.status(404).json({ ok: false, error: "未找到编辑提案" });
  }
  const sanitizedWorkspaceFiles = sanitizeWorkspaceFiles(workspaceFiles);
  const effectiveWorkspaceFiles = sanitizedWorkspaceFiles.length > 0
    ? sanitizedWorkspaceFiles
    : (
      typeof sourceCode === "string" && proposal.changes[0]
        ? [{ filePath: proposal.changes[0].filePath, sourceCode }]
        : []
    );
  if (effectiveWorkspaceFiles.length === 0) {
    return res.status(400).json({ ok: false, error: "缺少可应用的 workspaceFiles 或 sourceCode" });
  }
  const appliedFiles = applyWorkspaceEditToFiles(effectiveWorkspaceFiles, proposal);
  const nextSourceCode = proposal.changes[0]
    ? (appliedFiles.find(file => normalizeFilePath(file.filePath) === normalizeFilePath(proposal.changes[0].filePath))?.sourceCode || sourceCode || "")
    : (sourceCode || "");
  rejectWorkspaceEdit(proposalId);
  res.json({ ok: true, proposal, nextSourceCode, appliedFiles });
});

app.post("/api/lingcpp/edit/reject", async (req, res) => {
  const { proposalId } = req.body as { proposalId?: string };
  if (!proposalId) {
    return res.status(400).json({ ok: false, error: "缺少 proposalId" });
  }
  res.json({ ok: rejectWorkspaceEdit(proposalId) });
});

app.get("/api/window-designer/debug-logs", async (req, res) => {
  const projectId = req.query.projectId as string || "window-preview";
  const clear = req.query.clear === "true";
  const buildDir = path.join(getRepoWorkspaceRoot(), ".lingbuilder-build", projectId, getBuildOutputSegment(await buildConfigurationService.read()));
  const logFile = path.join(buildDir, "run.log");

  if (clear) {
    try {
      await fs.writeFile(logFile, "", "utf8");
    } catch {}
    return res.json({ logs: [] });
  }

  try {
    const data = await fs.readFile(logFile, "utf8");
    res.json({ logs: data.split("\n") });
  } catch {
    res.json({ logs: [] });
  }
});

async function detectCompiler(configuration?: BuildConfiguration): Promise<CompilerInfo | null> {
  if (configuration?.architecture === "x64") {
    const x64Setup = await findMsvcSetupBatch("x64");
    if (x64Setup && await canUseMsvcSetupBatch(x64Setup)) return { kind: "msvc", command: "cl", setupBatch: x64Setup };
  }
  try {
    await execFileAsync("where.exe", ["cl"], { timeout: 4000, windowsHide: true });
    return { kind: "msvc", command: "cl" };
  } catch {
    // MSVC is often installed but not loaded into the current shell.
  }

  const msvcSetupBatch = await findMsvcSetupBatch(configuration?.architecture === "x64" ? "x64" : "Win32");
  if (msvcSetupBatch && await canUseMsvcSetupBatch(msvcSetupBatch)) {
    return { kind: "msvc", command: "cl", setupBatch: msvcSetupBatch };
  }

  const candidates: CompilerInfo[] = [
    { kind: "g++", command: "g++" },
    { kind: "clang++", command: "clang++" }
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, ["--version"], { timeout: 4000, windowsHide: true });
      return candidate;
    } catch {
      // Try next compiler.
    }
  }

  return null;
}

async function findMsvcSetupBatch(architecture: "Win32" | "x64" = "Win32"): Promise<string | null> {
  const installPaths = new Set<string>();
  const vswherePath = process.env["ProgramFiles(x86)"]
    ? path.join(process.env["ProgramFiles(x86)"] as string, "Microsoft Visual Studio", "Installer", "vswhere.exe")
    : "";

  if (vswherePath && await pathExists(vswherePath)) {
    try {
      const result = await execFileAsync(vswherePath, ["-latest", "-products", "*", "-property", "installationPath"], {
        timeout: 5000,
        windowsHide: true
      });
      result.stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => installPaths.add(line));
    } catch {
      // Fall back to common Visual Studio installation folders below.
    }
  }

  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const editions = ["BuildTools", "Community", "Professional", "Enterprise"];
  for (const edition of editions) {
    installPaths.add(path.join(programFiles, "Microsoft Visual Studio", "2022", edition));
    installPaths.add(path.join(programFiles, "Microsoft Visual Studio", "2019", edition));
  }

  for (const installPath of installPaths) {
    const candidates = [
      path.join(installPath, "VC", "Auxiliary", "Build", architecture === "x64" ? "vcvars64.bat" : "vcvars32.bat"),
      path.join(installPath, "Common7", "Tools", "VsDevCmd.bat")
    ];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function canUseMsvcSetupBatch(setupBatch: string): Promise<boolean> {
  try {
    await execFileAsync("cmd.exe", ["/d", "/c", `call ${quoteCmdArg(setupBatch)} >nul && where cl >nul`], {
      timeout: 15000,
      windowsHide: true,
      windowsVerbatimArguments: true
    });
    return true;
  } catch {
    return false;
  }
}

async function compileWin32Preview(
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  modulePlan?: ModuleNativeDependencyPlan,
  buildConfiguration: BuildConfiguration = { schemaVersion: 1, mode: "Debug", architecture: "Win32" },
  signal?: AbortSignal
): Promise<{ ok: boolean; logs: string[] }> {
  const includeArgs = (modulePlan?.includeDirs || []).flatMap(includeDir => ["/I", includeDir]);
  const moduleSources = modulePlan?.sourceFiles || [];
  const moduleLibs = modulePlan?.libFiles || [];
  if (compiler.kind !== "msvc" && modulePlan?.requiresMsvc) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        "new_emoji 模块需要 MSVC/Visual Studio Build Tools：当前检测到的编译器不能直接链接 .lib 导入库。"
      ]
    };
  }

  const objectPath = path.join(objDir, "main.obj");
  if (compiler.kind === "msvc" && moduleSources.length > 0) {
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs, buildConfiguration, signal);
  }

  const commandArgs = compiler.kind === "msvc"
    ? [
        "/nologo",
        "/EHsc",
        "/std:c++17",
        "/utf-8",
        "/DUNICODE",
        "/D_UNICODE",
        ...getBuildCompilerFlags(buildConfiguration, "msvc"),
        ...includeArgs,
        sourcePath,
        "/Fo:" + objectPath,
        "/Fe:" + exePath,
        "user32.lib",
        "gdi32.lib",
        "comctl32.lib",
        ...moduleLibs,
        ...(buildConfiguration.mode === "Debug" ? ["/link", "/DEBUG", "/INCREMENTAL:NO"] : [])
      ]
    : [
        "-municode",
        "-std=c++17",
        "-finput-charset=UTF-8",
      "-fexec-charset=UTF-8",
      "-DUNICODE",
      "-D_UNICODE",
      ...getBuildCompilerFlags(buildConfiguration, compiler.kind),
      "-c",
      sourcePath,
      "-o",
      objectPath
    ];
  const linkArgs = compiler.kind === "msvc"
    ? []
    : [
      "-municode",
      buildConfiguration.architecture === "x64" ? "-m64" : "-m32",
      objectPath,
      "-o",
      exePath,
      "-luser32",
      "-lgdi32",
      "-lcomctl32"
    ];

  try {
    const command = compiler.kind === "msvc" && compiler.setupBatch ? "cmd.exe" : compiler.command;
    const args = compiler.kind === "msvc" && compiler.setupBatch
      ? ["/d", "/c", `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(" ")}`]
      : commandArgs;

    const compileResult = await execFileAsync(command, args, {
      cwd,
      timeout: 60000,
      windowsHide: true,
      windowsVerbatimArguments: command === "cmd.exe",
      maxBuffer: 1024 * 1024 * 4
      , signal
    });
    const linkResult = linkArgs.length > 0
      ? await execFileAsync(compiler.command, linkArgs, {
          cwd,
          timeout: 60000,
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4
          , signal
        })
      : undefined;

    return {
      ok: true,
      logs: [
        "编译成功。",
        compileResult.stdout?.trim() ? `stdout:\n${compileResult.stdout.trim()}` : "",
        compileResult.stderr?.trim() ? `stderr:\n${compileResult.stderr.trim()}` : "",
        linkResult?.stdout?.trim() ? `link stdout:\n${linkResult.stdout.trim()}` : "",
        linkResult?.stderr?.trim() ? `link stderr:\n${linkResult.stderr.trim()}` : ""
      ].filter(Boolean)
    };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : "",
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : "",
        error.message ? `错误：${error.message}` : ""
      ].filter(Boolean)
    };
  }
}

async function compileMsvcPreviewWithModules(
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  includeArgs: string[],
  moduleSources: string[],
  moduleLibs: string[],
  buildConfiguration: BuildConfiguration,
  signal?: AbortSignal
): Promise<{ ok: boolean; logs: string[] }> {
  const sources = [sourcePath, ...moduleSources];
  const objectFiles = sources.map((source, index) => path.join(objDir, `${index === 0 ? "main" : `module_${index}`}.obj`));
  const compileCommands = sources.map((source, index) => [
    "/nologo",
    "/EHsc",
    "/std:c++17",
    "/utf-8",
    "/DUNICODE",
    "/D_UNICODE",
    ...getBuildCompilerFlags(buildConfiguration, "msvc"),
    ...includeArgs,
    "/c",
    source,
    "/Fo:" + objectFiles[index]
  ]);
  const linkArgs = [
    "/nologo",
    ...objectFiles,
    "/Fe:" + exePath,
    "user32.lib",
    "gdi32.lib",
    "comctl32.lib",
    ...moduleLibs,
    ...(buildConfiguration.mode === "Debug" ? ["/DEBUG", "/INCREMENTAL:NO"] : [])
  ];

  try {
    const outputs: string[] = [];
    for (const args of compileCommands) {
      const result = await runMsvcCommand(compiler, args, cwd, signal);
      if (result.stdout?.trim()) outputs.push(`stdout:\n${result.stdout.trim()}`);
      if (result.stderr?.trim()) outputs.push(`stderr:\n${result.stderr.trim()}`);
    }
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd, signal);
    if (linkResult.stdout?.trim()) outputs.push(`link stdout:\n${linkResult.stdout.trim()}`);
    if (linkResult.stderr?.trim()) outputs.push(`link stderr:\n${linkResult.stderr.trim()}`);
    return { ok: true, logs: ["编译成功。", ...outputs] };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : "",
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : "",
        error.message ? `错误：${error.message}` : ""
      ].filter(Boolean)
    };
  }
}

async function runMsvcCommand(compiler: CompilerInfo, commandArgs: string[], cwd: string, signal?: AbortSignal) {
  const command = compiler.setupBatch ? "cmd.exe" : compiler.command;
  const args = compiler.setupBatch
    ? ["/d", "/c", `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(" ")}`]
    : commandArgs;
  return await execFileAsync(command, args, {
    cwd,
    timeout: 60000,
    windowsHide: true,
    windowsVerbatimArguments: command === "cmd.exe",
    maxBuffer: 1024 * 1024 * 4
    , signal
  });
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function writeGeneratedProjectFiles(
  targetDirectory: string,
  files: Array<{ relativePath: string; content: string }>
): Promise<void> {
  await Promise.all(files.map(async file => {
    const targetPath = path.join(targetDirectory, file.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content, "utf8");
  }));
}

function getGeneratedFileLanguage(relativePath: string): "cpp" | "json" | "text" {
  if (relativePath.endsWith(".cpp")) return "cpp";
  if (relativePath.endsWith(".json")) return "json";
  return "text";
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.stat(value);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80) || "window-preview";
}

async function planLingCppEditWithGemini(context: LingCppEditContext): Promise<LingCppEditDraft> {
  const resolvedAiConfig = resolveAiConnectionConfig(context.aiConfig);
  if (!resolvedAiConfig.apiKey) {
    return {
      summary: context.instruction.trim() || "根据当前上下文生成中文 C++ 编辑建议",
      explanation: "未检测到 AI API Key，已回退到本地安全提案。"
    };
  }

  const sourceCode = normalizeLineEndings(context.sourceCode);
  const workspaceFiles = resolveEditWorkspaceFiles(context);
  const promptWorkspaceFiles = selectWorkspaceFilesForPrompt(workspaceFiles, context.filePath);
  const diagnostics = getLingCppSemanticDiagnostics(sourceCode, undefined, context.filePath, context.moduleContext)
    .slice(0, 12)
    .map(diagnostic => `- [${diagnostic.level}] 第 ${diagnostic.line} 行：${diagnostic.message}`)
    .join("\n") || "无";
  const selectedText = context.selection ? getTextForRange(sourceCode, context.selection) : "";
  const moduleContextPrompt = describeLingCppModuleContextForAi(context.moduleContext);

  const baseSystemPrompt = `你是 LingBuilder 的中文 C++（.lcpp）重写代理。
你的任务是根据用户要求修改一个或多个已提供的工作区文件，并返回“仅包含发生变化文件”的完整重写结果。

严格规则：
1. 只能编辑“本次提供给你的工作区文件”，不能创建、引用或假装修改其他文件。
2. 每个 changed file 的 updatedSource 都必须是该文件的完整内容，不能只返回片段，不能使用 Markdown 代码块。
3. 若修改 .lcpp 文件，必须保持 LingCpp 语法风格：包、使用、类、公开、私有、保护、构造、析构、事件、返回、如果、否则、如果结束、循环、循环结束、结束类。
4. 除非用户明确要求，不要重命名现有事件处理器、类名、控件名、设计器绑定名或配置键名。
5. 优先做最小必要改动，保留无关代码、缩进和注释。
6. 只返回确实发生变化的文件；如果无需修改某个文件，就不要把它放进 files 数组。
7. 可以直接使用当前项目“已启用模块”提供的命令、类型和片段；不要静默调用未启用模块的命令。
8. 如果用户要求使用未启用模块，先在 explanation 中说明需要启用该模块，再给出不破坏当前代码的最小修改。
9. explanation 用中文简要说明哪些文件被改了、为什么。`;
  const systemPrompt = attachLingBuilderAiRulebook(baseSystemPrompt, await getLingBuilderAiRulebook());

  const prompt = [
    `当前活动文件：${context.filePath}`,
    `用户需求：${context.instruction || "请根据上下文改进当前中文 C++ 文件。"}`,
    context.selection
      ? `重点选区：第 ${context.selection.startLine} 行第 ${context.selection.startColumn} 列 到 第 ${context.selection.endLine} 行第 ${context.selection.endColumn} 列`
      : "重点选区：无，允许围绕整份文件进行必要修改。",
    context.selection && selectedText
      ? `选区源码：\n<<<SELECTION\n${selectedText}\nSELECTION`
      : "",
    `当前项目模块上下文：\n${moduleContextPrompt}`,
    `当前本地解析诊断：\n${diagnostics}`,
    `本次允许编辑的工作区文件如下（只可改这些文件）：
${promptWorkspaceFiles.map(file => `--- FILE: ${file.filePath}\n${file.sourceCode}`).join("\n\n")}`
  ].filter(Boolean).join("\n\n");

  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "一句话概括本次修改内容" },
      explanation: { type: Type.STRING, description: "简要说明改动原因与影响" },
      files: {
        type: Type.ARRAY,
        description: "仅包含发生变化的文件，每项都必须给出完整文件内容",
        items: {
          type: Type.OBJECT,
          properties: {
            filePath: { type: Type.STRING, description: "被修改的文件路径，必须来自允许编辑的工作区文件列表" },
            updatedSource: { type: Type.STRING, description: "修改后的完整文件内容" }
          },
          required: ["filePath", "updatedSource"]
        }
      }
    },
    required: ["summary", "explanation", "files"]
  };

  const jsonPrompt = `${prompt}

请只返回 JSON，不要使用 Markdown，不要添加解释文字。JSON 格式如下：
{
  "summary": "一句话概括本次修改内容",
  "explanation": "简要说明改动原因与影响",
  "files": [
    {
      "filePath": "必须来自允许编辑的工作区文件列表",
      "updatedSource": "修改后的完整文件内容"
    }
  ]
}`;

  const responseText = await generateAiText({
    config: resolvedAiConfig,
    systemPrompt,
    prompt: jsonPrompt,
    temperature: 0.2,
    maxTokens: 12000,
    geminiResponseMimeType: "application/json",
    geminiResponseSchema: schema
  });

  const draft = JSON.parse(extractJsonPayload(responseText, "{}")) as LingCppEditDraft;
  const promptFileMap = new Map(promptWorkspaceFiles.map(file => [normalizeFilePath(file.filePath), file]));
  const validDraftFiles = (draft.files || [])
    .filter(file => file?.filePath && typeof file.updatedSource === "string")
    .map(file => ({
      filePath: file.filePath,
      updatedSource: normalizeLineEndings(file.updatedSource)
    }))
    .filter(file => promptFileMap.has(normalizeFilePath(file.filePath)) && file.updatedSource.trim());

  if (validDraftFiles.length === 0) {
    throw new Error("AI 未返回有效的多文件编辑结果");
  }

  const diagnosticsNotes: string[] = [];
  validDraftFiles.forEach(file => {
    if (!file.filePath.endsWith(".lcpp")) return;
    const originalFile = workspaceFiles.find(item => normalizeFilePath(item.filePath) === normalizeFilePath(file.filePath));
    if (!originalFile) return;
    const originalParse = parseLingCpp(normalizeLineEndings(originalFile.sourceCode));
    const updatedParse = parseLingCpp(file.updatedSource);
    if (originalParse.program.classes.length > 0 && updatedParse.program.classes.length === 0) {
      throw new Error(`AI 返回的 ${file.filePath} 无法通过基本的 LingCpp 类结构校验`);
    }
    const nextErrorCount = updatedParse.diagnostics.filter(diagnostic => diagnostic.level === "error").length;
    const originalErrorCount = originalParse.diagnostics.filter(diagnostic => diagnostic.level === "error").length;
    if (nextErrorCount > originalErrorCount) {
      diagnosticsNotes.push(`${file.filePath} 仍有 ${nextErrorCount} 条错误级诊断，请在应用前复核。`);
    }
  });

  const diagnosticsNote = diagnosticsNotes.length > 0
    ? `\n\n注意：${diagnosticsNotes.join("；")}`
    : "";

  return {
    summary: draft.summary?.trim() || context.instruction.trim() || "根据当前上下文生成中文 C++ 编辑建议",
    explanation: `${draft.explanation?.trim() || "AI 已生成完整文件级编辑提案。"}${diagnosticsNote}`,
    files: validDraftFiles
  };
}

async function collectFilesRecursively(repoRoot: string, directory: string, files: Record<string, string>): Promise<void> {
  if (!await pathExists(directory)) return;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursively(repoRoot, targetPath, files);
      continue;
    }
    if (!isAllowedProjectTextPath(entry.name)) continue;
    const relativePath = path.relative(repoRoot, targetPath).replace(/\\/g, "/");
    files[relativePath] = decodeTextFile(await fs.readFile(targetPath)).content;
  }
}

function getTextForRange(sourceCode: string, range: WorkspaceEditRange): string {
  const lines = normalizeLineEndings(sourceCode).split("\n");
  const startLine = Math.max(1, range.startLine);
  const endLine = Math.max(startLine, range.endLine);
  const selected = lines.slice(startLine - 1, endLine);
  if (selected.length === 0) return "";

  selected[0] = selected[0].slice(Math.max(0, range.startColumn - 1));
  if (range.endColumn !== Number.MAX_SAFE_INTEGER) {
    selected[selected.length - 1] = selected[selected.length - 1].slice(0, Math.max(0, range.endColumn - 1));
  }
  return selected.join("\n");
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function sanitizeWorkspaceFiles(
  workspaceFiles?: Array<{ filePath: string; sourceCode: string; language?: string }>
): LingCppWorkspaceFile[] {
  if (!Array.isArray(workspaceFiles)) return [];
  const deduped = new Map<string, LingCppWorkspaceFile>();

  workspaceFiles.forEach(file => {
    if (!file?.filePath || typeof file.sourceCode !== "string") return;
    const normalizedPath = normalizeFilePath(file.filePath);
    if (!normalizedPath || normalizedPath.includes("..")) return;
    deduped.set(normalizedPath, {
      filePath: normalizedPath,
      sourceCode: normalizeLineEndings(file.sourceCode),
      language: file.language
    });
  });

  return [...deduped.values()];
}

function resolveEditWorkspaceFiles(context: LingCppEditContext): LingCppWorkspaceFile[] {
  const files = sanitizeWorkspaceFiles(context.workspaceFiles);
  if (!files.some(file => normalizeFilePath(file.filePath) === normalizeFilePath(context.filePath))) {
    files.unshift({
      filePath: normalizeFilePath(context.filePath),
      sourceCode: normalizeLineEndings(context.sourceCode),
      language: context.filePath.endsWith(".lcpp") ? "lingcpp" : undefined
    });
  }
  return files;
}

function selectWorkspaceFilesForPrompt(
  workspaceFiles: LingCppWorkspaceFile[],
  activeFilePath: string
): LingCppWorkspaceFile[] {
  const activeNormalizedPath = normalizeFilePath(activeFilePath);
  const activeDirectory = activeNormalizedPath.split("/").slice(0, -1).join("/");
  const ranked = [...workspaceFiles].sort((left, right) => rankWorkspaceFile(right, activeNormalizedPath, activeDirectory) - rankWorkspaceFile(left, activeNormalizedPath, activeDirectory));
  const selected: LingCppWorkspaceFile[] = [];
  let totalChars = 0;

  for (const file of ranked) {
    const nextSize = file.sourceCode.length;
    if (selected.length >= 5) break;
    if (selected.length > 0 && totalChars + nextSize > 24000) continue;
    selected.push(file);
    totalChars += nextSize;
  }

  return selected.length > 0 ? selected : workspaceFiles.slice(0, 1);
}

function rankWorkspaceFile(file: LingCppWorkspaceFile, activeFilePath: string, activeDirectory: string): number {
  const normalizedPath = normalizeFilePath(file.filePath);
  let score = 0;
  if (normalizedPath === activeFilePath) score += 1000;
  if (activeDirectory && normalizedPath.startsWith(`${activeDirectory}/`)) score += 180;
  if (normalizedPath.endsWith(".lcpp")) score += 120;
  if (normalizedPath.endsWith(".ini")) score += 90;
  if (normalizedPath.endsWith(".json")) score += 70;
  if (normalizedPath.includes("/config/") || normalizedPath.startsWith("config/")) score += 40;
  return score;
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isWorkbenchConfigurationKey(value: unknown): value is WorkbenchConfigurationKey {
  return typeof value === "string"
    && (WORKBENCH_CONFIGURATION_KEYS as readonly string[]).includes(value);
}

function isConfigurationTarget(value: unknown): value is ConfigurationTarget {
  return value === "user" || value === "workspace";
}

function respondWithConfigurationError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string
): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (error instanceof ConfigurationValidationError) {
    res.status(400).json({ ok: false, code: "INVALID_VALUE", error: message, details: error.details });
    return;
  }
  if (error instanceof ConfigurationPersistenceError) {
    const status = error.code === "UNSAFE_PATH" ? 400 : 500;
    res.status(status).json({ ok: false, code: error.code, error: message });
    return;
  }
  res.status(500).json({ ok: false, error: message });
}

function respondWithProjectFileMutationError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string
): void {
  if (!(error instanceof ProjectFileMutationError)) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    if (/未找到项目/u.test(message)) {
      res.status(404).json({ ok: false, error: message });
      return;
    }
    res.status(500).json({
      ok: false,
      error: message
    });
    return;
  }

  const status = error.code === "FILE_NOT_FOUND" || error.code === "PROJECT_ROOT_NOT_FOUND"
    ? 404
    : error.code === "TARGET_EXISTS"
      ? 409
      : error.code === "OPERATION_FAILED"
        ? 500
        : 400;
  res.status(status).json({ ok: false, code: error.code, error: error.message });
}

async function handleWorkspaceSearchRequest<T>(
  res: express.Response,
  operation: () => Promise<T>
): Promise<void> {
  try {
    const result = await operation();
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithWorkspaceSearchError(res, error);
  }
}

function respondWithWorkspaceSearchError(res: express.Response, error: unknown): void {
  if (!(error instanceof WorkspaceSearchError)) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      error: `工作区搜索服务发生未预期错误：${detail}`
    });
    return;
  }

  const conflictCodes = new Set([
    "QUERY_NOT_FOUND",
    "QUERY_EXPIRED",
    "PREVIEW_NOT_FOUND",
    "PREVIEW_EXPIRED",
    "TRANSACTION_NOT_FOUND",
    "TRANSACTION_EXPIRED",
    "CACHE_CAPACITY_EXCEEDED",
    "RESULT_TRUNCATED",
    "FILE_CHANGED",
    "ROLLBACK_CONFLICT"
  ]);
  const serverErrorCodes = new Set([
    "WRITE_FAILED",
    "CONSISTENCY_RECOVERY_FAILED"
  ]);
  const status = serverErrorCodes.has(error.code)
    ? 500
    : conflictCodes.has(error.code)
      ? 409
      : 400;
  res.status(status).json({
    ok: false,
    code: error.code,
    error: error.message,
    ...(error.filePath ? { filePath: error.filePath } : {})
  });
}

function formatOrigin(host: ServerRuntimeConfig["host"], port: number): string {
  return `http://${host === "::1" ? "[::1]" : host}:${port}`;
}

export async function startServer(): Promise<ServerReadyInfo> {
  await workspacePathPolicy.getRealWorkspaceRoot();
  if (!(await getLingBuilderAiRulebook()).trim()) {
    throw new Error("LingBuilder AI 规则手册为空，服务拒绝启动。");
  }
  // Vite integration
  if (serverRuntimeConfig.environment === "development") {
    // Keep Vite out of the packaged server's module graph. Some Vite/Rollup
    // dependencies probe process.execPath; inside Electron that is the app exe
    // and would recursively launch LingBuilder unless development explicitly
    // requests Vite here.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ["**/.lingbuilder-build/**"]
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = serverRuntimeConfig.staticRoot as string;
    await fs.access(path.join(distPath, "index.html"));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(serverRuntimeConfig.port, serverRuntimeConfig.host);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("LingBuilder IDE 服务未能获取有效监听地址。");
  }
  const ready: ServerReadyInfo = {
    host: serverRuntimeConfig.host,
    port: address.port,
    origin: formatOrigin(serverRuntimeConfig.host, address.port),
    workspaceRoot: serverRuntimeConfig.workspaceRoot,
    pid: process.pid
  };
  console.log(formatServerReady(ready));
  console.log(`LingBuilder IDE Server listening on ${ready.origin}`);

  let closeRequested = false;
  const closeServer = () => {
    if (closeRequested) return;
    closeRequested = true;
    projectBuildCoordinator.shutdown();
    // 先停止接收新请求，再在所有在途请求退出后做第二次回收，覆盖启动登记边界竞态。
    server.close(() => {
      ptyTerminalService.closeAll();
      performanceService.cancel();
      workspaceIndexService.cancel();
      void Promise.all([managedProcessService.stopAll(), clangdService.stop(), nativeDebugService.stop(), nodeTestDebugService.stop(), extensionService.stop()]).finally(() => {
        process.exitCode = 0;
      });
    });
    void managedProcessService.stopAll();
    void clangdService.stop();
    void nativeDebugService.stop();
    void nodeTestDebugService.stop();
    void extensionService.stop();
    ptyTerminalService.closeAll();
  };
  process.once("SIGTERM", closeServer);
  process.once("SIGINT", closeServer);
  return ready;
}

export function createLingBuilderServer() {
  return app;
}

if (process.env.LINGBUILDER_SERVER_AUTOSTART !== "false") {
  startServer().catch(error => {
    const payload = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      pid: process.pid
    });
    console.error(`LINGBUILDER_SERVER_ERROR ${payload}`);
    process.exitCode = 1;
  });
}
