import express from "express";
import path from "path";
import fs from "fs/promises";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedString } from "./src/types";
import { generateNativeWin32Project } from "./src/services/windowDesigner/nativeWin32Project";
import { LingWindowProject } from "./src/services/windowDesigner/types";

dotenv.config();

// Initialize Gemini API client lazily to avoid crashing if API Key is missing.
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const execFileAsync = promisify(execFile);

app.use(express.json({ limit: "2mb" }));

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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
  const { strings, glossary } = req.body;
  if (!strings || !Array.isArray(strings) || strings.length === 0) {
    return res.status(400).json({ error: "Missing or invalid strings list" });
  }

  try {
    const ai = getGeminiClient();

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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
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
      }
    });

    const resultText = response.text || "[]";
    const translations = JSON.parse(resultText.trim());
    res.json({ translations });

  } catch (error: any) {
    console.error("Gemini batch translation failure:", error);
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
  const { project, activeWindowId, eplSourceCode, run = true } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
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
    const generatedProject = generateNativeWin32Project(project, {
      activeWindowId,
      eplSourceCode: typeof eplSourceCode === "string" ? eplSourceCode : ""
    });
    const buildRoot = path.join(process.cwd(), ".lingbuilder-build");
    const buildDir = path.join(buildRoot, sanitizeFilename(project.id || "window-preview"));

    await fs.mkdir(buildDir, { recursive: true });
    await Promise.all(generatedProject.files.map(file => {
      const targetPath = path.join(buildDir, file.relativePath);
      return fs.writeFile(targetPath, file.content, "utf8");
    }));

    const compiler = await detectCompiler();
    if (!compiler) {
      return res.status(200).json({
        ok: false,
        stage: "compiler",
        buildDir,
        files: generatedProject.files.map(file => path.join(buildDir, file.relativePath)),
        logs: [
          "已生成 Win32 C++ 工程文件。",
          "未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。",
          "需要的编译器命令之一：cl、g++、clang++。"
        ]
      });
    }

    const sourcePath = path.join(buildDir, "main.cpp");
    const exePath = path.join(buildDir, "LingBuilderPreview.exe");
    const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, buildDir);
    const logs = [
      `已生成 Win32 C++ 工程：${buildDir}`,
      `当前窗口：${generatedProject.selectedWindow.title}`,
      `编译器：${compiler.kind} (${compiler.command})`,
      ...compileResult.logs
    ];

    if (!compileResult.ok) {
      return res.status(200).json({
        ok: false,
        stage: "compile",
        buildDir,
        exePath,
        compiler,
        logs
      });
    }

    if (run) {
      try {
        const child = spawn(exePath, [], {
          cwd: buildDir,
          detached: true,
          stdio: "ignore",
          windowsHide: false
        });
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
      exePath,
      compiler,
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
  cwd: string
): Promise<{ ok: boolean; logs: string[] }> {
  const commandArgs = compiler.kind === "msvc"
    ? [
        "/nologo",
        "/EHsc",
        "/std:c++17",
        "/utf-8",
        "/DUNICODE",
        "/D_UNICODE",
        sourcePath,
        "/Fe:" + exePath,
        "user32.lib",
        "gdi32.lib",
        "comctl32.lib"
      ]
    : [
        "-municode",
        "-std=c++17",
        "-finput-charset=UTF-8",
        "-fexec-charset=UTF-8",
        "-DUNICODE",
        "-D_UNICODE",
        sourcePath,
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

    const result = await execFileAsync(command, args, {
      cwd,
      timeout: 60000,
      windowsHide: true,
      windowsVerbatimArguments: command === "cmd.exe",
      maxBuffer: 1024 * 1024 * 4
    });

    return {
      ok: true,
      logs: [
        "编译成功。",
        result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : "",
        result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : ""
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

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
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

startServer();
