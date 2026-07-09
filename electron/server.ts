import express from "express";
import path from "path";
import fs from "fs/promises";
import { execFile, spawn } from "child_process";
import { createWriteStream } from "fs";
import { promisify } from "util";
import { createServer as createViteServer } from "vite";
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

dotenv.config();

let lingBuilderAiRulebookCache: string | null | undefined;

function getLingBuilderAiRulebookCandidates(): string[] {
  return [
    path.resolve(process.cwd(), "LingBuilder AI 规则手册.md"),
    path.resolve(process.cwd(), "..", "LingBuilder AI 规则手册.md")
  ];
}

async function getLingBuilderAiRulebook(): Promise<string> {
  if (lingBuilderAiRulebookCache !== undefined) return lingBuilderAiRulebookCache || "";
  for (const candidate of getLingBuilderAiRulebookCandidates()) {
    try {
      lingBuilderAiRulebookCache = await fs.readFile(candidate, "utf8");
      return lingBuilderAiRulebookCache;
    } catch {
      // Try the next likely workspace location.
    }
  }
  lingBuilderAiRulebookCache = null;
  return "";
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
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const execFileAsync = promisify(execFile);
const ALLOWED_PROJECT_EXTS = [".lcpp", ".cpp", ".h", ".rc", ".xml", ".json", ".ini"];

app.use(express.json({ limit: "2mb" }));

function getAiBridgePermissionMode(): AiBridgePermissionMode {
  const value = process.env.LINGBUILDER_AI_BRIDGE_PERMISSION;
  return value === "readonly" || value === "preview" || value === "yolo" ? value : "preview";
}

function getRepoWorkspaceRoot() {
  return path.basename(process.cwd()).toLowerCase() === "electron"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
}

function getModuleService() {
  return createModuleService(getRepoWorkspaceRoot());
}

const aiBridgeToken = process.env.LINGBUILDER_AI_BRIDGE_TOKEN || "";
const aiBridgeOptions: AiBridgeServerOptions = {
  workspaceRoot: getRepoWorkspaceRoot(),
  host: process.env.HOST || "0.0.0.0",
  port: PORT,
  token: aiBridgeToken,
  permission: getAiBridgePermissionMode(),
  allowRemote: process.env.LINGBUILDER_AI_BRIDGE_ALLOW_REMOTE === "true",
  enableMcp: false
};
const aiBridgeService = new AiBridgeService(aiBridgeOptions);
app.use("/api/ai-bridge", createAiBridgeRouter(aiBridgeService, aiBridgeToken, planLingCppEditWithGemini));

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
    res.json({ ok: true, modules: await getModuleService().scanInstalledModules(projectId) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块扫描失败" });
  }
});

app.get("/api/modules/project", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    res.json({ ok: true, modules: await getModuleService().getEnabledProjectModules(projectId || "lingbuilder-ui-project") });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "项目模块读取失败" });
  }
});

app.post("/api/modules/project/enable", async (req, res) => {
  try {
    const { projectId = "lingbuilder-ui-project", moduleId } = req.body as { projectId?: string; moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    await getModuleService().enableModuleForProject(projectId, moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "启用模块失败" });
  }
});

app.post("/api/modules/project/disable", async (req, res) => {
  try {
    const { projectId = "lingbuilder-ui-project", moduleId } = req.body as { projectId?: string; moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    await getModuleService().disableModuleForProject(projectId, moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "禁用模块失败" });
  }
});

app.post("/api/modules/package/preview", async (req, res) => {
  try {
    const { packagePath } = req.body as { packagePath?: string };
    if (!packagePath) return res.status(400).json({ ok: false, error: "缺少 packagePath" });
    res.json({ ok: true, preview: await getModuleService().previewPackageInstall(packagePath) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包预览失败" });
  }
});

app.post("/api/modules/package/install", async (req, res) => {
  try {
    const { previewId, projectId, enableForProject = true } = req.body as { previewId?: string; projectId?: string; enableForProject?: boolean };
    if (!previewId) return res.status(400).json({ ok: false, error: "缺少 previewId" });
    const result = await getModuleService().installPackage(previewId);
    if (enableForProject) {
      await getModuleService().enableModuleForProject(projectId || "lingbuilder-ui-project", result.moduleId);
    }
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块安装失败" });
  }
});

app.post("/api/modules/package/export", async (req, res) => {
  try {
    const { moduleDir, targetPath } = req.body as { moduleDir?: string; targetPath?: string };
    if (!moduleDir || !targetPath) return res.status(400).json({ ok: false, error: "缺少 moduleDir 或 targetPath" });
    await getModuleService().exportModulePackage(moduleDir, targetPath);
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
    res.json({ ok: true, modules: await getModuleService().listMarketModules(sourceId) });
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
    const manifest = await createModuleTemplate({ template, outDir, id, name });
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块模板创建失败" });
  }
});

app.post("/api/modules/developer/validate", async (req, res) => {
  try {
    const { modulePath } = req.body as { modulePath?: string };
    if (!modulePath) return res.status(400).json({ ok: false, error: "缺少 modulePath" });
    const result = await validateModuleDirectory(modulePath);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块校验失败" });
  }
});

app.post("/api/modules/developer/migrate-cpp", async (req, res) => {
  try {
    const { configPath, outDir } = req.body as { configPath?: string; outDir?: string };
    if (!configPath || !outDir) return res.status(400).json({ ok: false, error: "缺少 configPath 或 outDir" });
    const manifest = await migrateCppModule(configPath, outDir);
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "C++ 模块迁移失败" });
  }
});

app.post("/api/modules/developer/market-index", async (req, res) => {
  try {
    const { packagePaths, outPath } = req.body as { packagePaths?: string[]; outPath?: string };
    if (!Array.isArray(packagePaths) || !outPath) return res.status(400).json({ ok: false, error: "缺少 packagePaths 或 outPath" });
    await createMarketIndex(packagePaths, outPath);
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
      error: "缂哄皯鏈夋晥鐨勭獥鍙ｈ璁″櫒椤圭洰妯″瀷"
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
      error: error?.message || "鍘熺敓 C++ 棰勮鐢熸垚澶辫触"
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
      error: "缂哄皯鏈夋晥鐨勭獥鍙ｈ璁″櫒椤圭洰妯″瀷"
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
      error: error?.message || "鍘熺敓 C++ 宸ョ▼瀵煎嚭澶辫触"
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

  try {
    const sourceCode = typeof lingCppSourceCode === "string"
      ? lingCppSourceCode
      : typeof eplSourceCode === "string"
        ? eplSourceCode
        : "";
    const enabledModules = await getModuleService().getEnabledProjectModules(project.id || "lingbuilder-ui-project");
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: sourceCode,
      lingCppSourceFilePath,
      enabledModules
    });
    const repoRoot = getRepoWorkspaceRoot();
    const buildRoot = path.join(repoRoot, ".lingbuilder-build");
    const buildDir = path.join(buildRoot, sanitizeFilename(project.id || "window-preview"));
    const sourceDir = path.join(buildDir, "src");
    const binDir = path.join(buildDir, "bin");
    const objDir = path.join(buildDir, "obj");
    const exportDir = path.join(repoRoot, "generated", "cpp", sanitizeFilename(project.id || "window-preview"));

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
    });
    const buildVisualStudioProject = await exportVisualStudioProject({
      projectDir: buildDir,
      projectId: project.id || "window-preview",
      generatedFiles: generatedProject.files.map(file => ({
        ...file,
        relativePath: normalizeFilePath(path.join("src", file.relativePath))
      })),
      enabledModules
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId: project.id || "window-preview",
      generatedFiles: generatedProject.files,
      enabledModules
    });

    const compiler = await detectCompiler();
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
    const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan);
    const logs = [
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
        logs
      });
    }

    if (run) {
      try {
        const logFile = path.join(buildDir, "run.log");
        const logStream = createWriteStream(logFile, { flags: 'w' });
        const child = spawn(exePath, [], {
          cwd: binDir,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: false
        });
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);
        child.unref();
        logs.push(`已启动运行窗口：${exePath}`);
      } catch (error: any) {
        logs.push(`运行启动失败：${error?.message || "无法启动生成的 exe"}`);
      }
    }

    return res.json({
      ok: true,
      stage: "run",
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
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      stage: "server",
      error: error?.message || "窗口设计器构建运行失败"
    });
  }
});

type CompilerInfo = {
  kind: "msvc" | "g++" | "clang++";
  command: string;
  setupBatch?: string;
};


app.get("/api/window-designer/files", async (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  if (!projectId) {
    return res.status(400).json({ ok: false, error: "缺少 projectId" });
  }

  try {
    const files: Record<string, string> = {};
    const repoRoot = getRepoWorkspaceRoot();
    const directories = [
      path.join(repoRoot, "src"),
      path.join(repoRoot, "config")
    ];

    for (const directory of directories) {
      await collectFilesRecursively(repoRoot, directory, files);
    }

    const designerProjectPath = path.join(repoRoot, ".lingbuilder", "window-designer.json");
    let designerProject = null;
    if (await pathExists(designerProjectPath)) {
      designerProject = JSON.parse(await fs.readFile(designerProjectPath, "utf8"));
    }

    res.json({ ok: true, files, designerProject });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/window-designer/files", async (req, res) => {
  const { projectId, files, project } = req.body as { projectId?: string; files?: Record<string, string>; project?: LingWindowProject };
  if (!projectId || !files) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 files" });
  }

  try {
    const repoRoot = getRepoWorkspaceRoot();
    const designerDir = path.join(repoRoot, ".lingbuilder");
    await fs.mkdir(designerDir, { recursive: true });

    for (const [relativePath, content] of Object.entries(files)) {
      if (!ALLOWED_PROJECT_EXTS.some(ext => relativePath.endsWith(ext))) continue;
      if (relativePath.includes("..")) continue;
      const normalizedPath = relativePath.replace(/\\/g, "/");
      const targetPath = path.join(repoRoot, normalizedPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
    }

    if (project) {
      await fs.writeFile(path.join(designerDir, "window-designer.json"), JSON.stringify(project, null, 2), "utf8");
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/source-control/status", async (_req, res) => {
  const repoRoot = getRepoWorkspaceRoot();
  try {
    const result = await execFileAsync("git", ["status", "--short", "--branch"], {
      cwd: repoRoot,
      timeout: 10000,
      windowsHide: true
    });
    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    const branchLine = lines[0] || "";
    const branch = branchLine.startsWith("## ") ? branchLine.slice(3).trim() : "";
    const files = lines.slice(1).map(line => ({
      indexStatus: line.slice(0, 1).trim(),
      workingTreeStatus: line.slice(1, 2).trim(),
      path: line.slice(3).trim()
    }));
    res.json({
      isRepository: true,
      branch,
      files
    });
  } catch (error: any) {
    res.json({
      isRepository: false,
      branch: "",
      files: [],
      error: error?.message || "无法读取 Git 状态"
    });
  }
});

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
  const buildDir = path.join(getRepoWorkspaceRoot(), ".lingbuilder-build", projectId);
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

async function detectCompiler(): Promise<CompilerInfo | null> {
  try {
    await execFileAsync("where.exe", ["cl"], { timeout: 4000, windowsHide: true });
    return { kind: "msvc", command: "cl" };
  } catch {
    // MSVC is often installed but not loaded into the current shell.
  }

  const msvcSetupBatch = await findMsvcSetupBatch();
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

async function findMsvcSetupBatch(): Promise<string | null> {
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
      path.join(installPath, "VC", "Auxiliary", "Build", "vcvars32.bat"),
      path.join(installPath, "VC", "Auxiliary", "Build", "vcvars64.bat"),
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
  modulePlan?: ModuleNativeDependencyPlan
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
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs);
  }

  const commandArgs = compiler.kind === "msvc"
    ? [
        "/nologo",
        "/EHsc",
        "/std:c++17",
        "/utf-8",
        "/DUNICODE",
        "/D_UNICODE",
        ...includeArgs,
        sourcePath,
        "/Fo:" + objectPath,
        "/Fe:" + exePath,
        "user32.lib",
        "gdi32.lib",
        "comctl32.lib",
        ...moduleLibs
      ]
    : [
        "-municode",
        "-std=c++17",
        "-finput-charset=UTF-8",
      "-fexec-charset=UTF-8",
      "-DUNICODE",
      "-D_UNICODE",
      "-c",
      sourcePath,
      "-o",
      objectPath
    ];
  const linkArgs = compiler.kind === "msvc"
    ? []
    : [
      "-municode",
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
    });
    const linkResult = linkArgs.length > 0
      ? await execFileAsync(compiler.command, linkArgs, {
          cwd,
          timeout: 60000,
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4
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
  moduleLibs: string[]
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
    ...moduleLibs
  ];

  try {
    const outputs: string[] = [];
    for (const args of compileCommands) {
      const result = await runMsvcCommand(compiler, args, cwd);
      if (result.stdout?.trim()) outputs.push(`stdout:\n${result.stdout.trim()}`);
      if (result.stderr?.trim()) outputs.push(`stderr:\n${result.stderr.trim()}`);
    }
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd);
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

async function runMsvcCommand(compiler: CompilerInfo, commandArgs: string[], cwd: string) {
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
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursively(repoRoot, targetPath, files);
      continue;
    }
    if (!ALLOWED_PROJECT_EXTS.some(ext => entry.name.endsWith(ext))) continue;
    const relativePath = path.relative(repoRoot, targetPath).replace(/\\/g, "/");
    files[relativePath] = await fs.readFile(targetPath, "utf8");
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

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`C++ Localization Server running on port ${PORT}`);
  });
}

export function createLingBuilderServer() {
  return app;
}

if (process.env.LINGBUILDER_SERVER_AUTOSTART !== "false") {
  startServer();
}
