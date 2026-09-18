import crypto from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AiBridgeService } from './aiBridgeService';

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object' as const, properties, required, additionalProperties: false });
const lingCppSourcesSchema = { type: 'array', maxItems: 256, items: objectSchema({ filePath: { type: 'string', minLength: 1, maxLength: 1024 }, sourceCode: { type: 'string', maxLength: 2097152 } }, ['filePath', 'sourceCode']) };
const lingCppWorkspaceFilesSchema = { type: 'array', minItems: 1, maxItems: 5, description: '待修改文件的当前完整内容；多文件提案必须包含所有目标文件。', items: objectSchema({ filePath: { type: 'string', minLength: 1, maxLength: 1024 }, sourceCode: { type: 'string', maxLength: 2097152 } }, ['filePath', 'sourceCode']) };

/** MCP InitializeResult.instructions：外部 AI 连接后拿到的稳定工作流引导。 */
const MCP_INSTRUCTIONS = [
  'LingBuilder 中文 IDE 的 AI Bridge：用中文 .lcpp 源码 + 窗口设计器模型开发真实 Win32 C++ 程序。',
  '推荐工作流：',
  '1. lingbuilder.project.templates 查看模板；带 sqlite-crud-window 模板可直接创建「表单+列表+SQLite 增删改查」项目。',
  '2. lingbuilder.project.create 创建项目（预览模式必须 approved=true 才真正落盘），记住 result.project.id；窗口项目同时返回 result.designerProject。',
  '3. lingbuilder.modules.list 只返回模块摘要；需要某模块的完整命令签名、参数说明和示例时，用 lingbuilder.module.info 按 moduleId 查询单个模块。',
  '4. 修改代码用 lingbuilder.edit.propose：files 必须是每个文件的完整新内容（不是 diff）；workspaceFiles 可省略，服务端会自动读取工作区当前内容；改窗口布局时必须同时传 updatedDesignerProject（完整设计器模型，控件 type 用规范英文标识，如 TextBox/Button/ListView）。然后用 lingbuilder.edit.apply 应用（预览模式需 approved=true）。',
  '5. lingbuilder.lingcpp.diagnostics 传 projectId 即可自动加载磁盘设计器模型校验控件引用；控件参数一律写裸控件名（不带引号），处理器参数一律用 &处理器名。',
  '6. lingbuilder.build.run 构建并运行（project 必须传完整 designerProject；预览模式需 approved=true）。构建/链接错误会以中文日志返回，修复后重跑。',
  '7. 运行期观测：lingbuilder.run.wait 等待进程退出并拿退出码，lingbuilder.run.log 读取运行输出，lingbuilder.build.stop 停止受控运行进程。GUI 程序的界面交互仍需用户确认。',
  '约束：所有写入与构建都限定在工作区内；独立一行「结束」是块结束标记不是退出命令，显式退出用 结束()。'
].join('\n');

const TOOLS = [
  { name: 'lingbuilder.workspace.list', description: '列出 LingBuilder 工作区文件树。', inputSchema: objectSchema({}) },
  { name: 'lingbuilder.file.read', description: '读取工作区内允许类型的文本文件。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1, maxLength: 1024 } }, ['filePath']) },
  { name: 'lingbuilder.file.search', description: '在工作区内执行受控文本搜索。', inputSchema: objectSchema({ query: { type: 'string', minLength: 1, maxLength: 512 }, include: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 1024 } }, maxResults: { type: 'integer', minimum: 1, maximum: 500 } }, ['query']) },
  { name: 'lingbuilder.lingcpp.diagnostics', description: '返回 .lcpp 解析与语义诊断。传 projectId 时自动加载解决方案中该项目的磁盘设计器模型来校验 controlRef 与事件绑定；也可显式传 designerProject 覆盖；两者都缺省或项目未注册时跳过控件引用校验，并返回 warning 诊断和 designerContext 元数据说明原因。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1 }, sourceCode: { type: 'string', maxLength: 2097152 }, projectId: { type: 'string', maxLength: 128, description: '解决方案中的项目 ID；缺省 designerProject 时用于自动加载工作区设计器模型。' }, designerProject: { type: 'object', description: '可选；显式提供时优先于磁盘模型。' } }, ['filePath']) },
  { name: 'lingbuilder.edit.propose', description: '根据外部 AI 提供的完整文件草稿生成可预览提案；窗口项目可同时传入当前 designerProject 和修改后的 updatedDesignerProject，源码和布局将在同一提案中校验。designerProject 缺省时按 projectId 自动加载工作区设计器模型；updatedDesignerProject 只允许指向解决方案中已注册的项目。workspaceFiles 可省略：缺省时服务端自动读取每个目标文件的工作区当前内容（磁盘上不存在的路径按新建文件处理）。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1 }, instruction: { type: 'string', minLength: 1, maxLength: 4000 }, sourceCode: { type: 'string', maxLength: 2097152 }, projectId: { type: 'string', maxLength: 128 }, workspaceFiles: lingCppWorkspaceFilesSchema, designerProject: { type: 'object', description: '可选；缺省时按 projectId 自动加载工作区设计器模型。' }, updatedDesignerProject: { type: 'object', description: '修改后的完整窗口设计器模型；涉及布局时必须传入，且项目必须已在解决方案中注册。' }, files: { type: 'array', minItems: 1, maxItems: 5, description: '每个修改文件的完整新内容，不是 diff 或代码片段。', items: objectSchema({ filePath: { type: 'string', minLength: 1 }, updatedSource: { type: 'string', maxLength: 2097152 } }, ['filePath', 'updatedSource']) } }, ['filePath', 'instruction', 'files']) },
  { name: 'lingbuilder.edit.apply', description: '应用已有 WorkspaceEdit 提案，受权限模式控制。', inputSchema: objectSchema({ proposalId: { type: 'string', minLength: 1 }, approved: { type: 'boolean' } }, ['proposalId']) },
  { name: 'lingbuilder.project.templates', description: '列出可用于 AI 新建项目的受控中文项目模板。', inputSchema: objectSchema({}) },
  { name: 'lingbuilder.project.create', description: '预览或创建 LingBuilder 项目；不传 approved=true 时只返回项目文件、项目级模块清单和模块依赖预览，窗口项目额外返回设计器模型。省略 enabledModuleIds 时继承根目录 .lingbuilder/project-modules.json，传空数组表示仅使用基础模块；创建后使用 result.project.id 作为项目上下文，窗口项目再使用 result.designerProject 进行原生预览/导出/构建。windows-dll 项目不返回 designerProject，工作台导航直接定位到 DllApi.lcpp；windows-console 项目返回以“程序”类为宿主的最小设计器模型，工作台导航定位到 程序.lcpp，构建产物为控制台可执行文件（入口为“公开 整数型 启动()”子程序）；sqlite-crud-window 模板创建「表单输入 + 列表视图 + SQLite 增删改查」的完整可运行示例。', inputSchema: objectSchema({ name: { type: 'string', maxLength: 100 }, projectId: { type: 'string', maxLength: 80 }, templateId: { type: 'string', enum: ['blank-window', 'hello-window', 'sqlite-crud-window', 'new-emoji-fbro-browser-shell', 'windows-dll', 'windows-console'] }, windowTitle: { type: 'string', maxLength: 120 }, enabledModuleIds: { type: 'array', maxItems: 64, description: '省略时继承全局项目模块；显式传 [] 仅启用基础模块。', items: { type: 'string', minLength: 2, maxLength: 128 } }, openInWorkbench: { type: 'boolean' }, approved: { type: 'boolean' } }) },
  { name: 'lingbuilder.project.create.undo', description: '撤销尚未被用户修改的 AI 项目创建事务，受权限模式控制。', inputSchema: objectSchema({ receiptId: { type: 'string', minLength: 16, maxLength: 80 }, approved: { type: 'boolean' } }, ['receiptId']) },
  { name: 'lingbuilder.build.run', description: '执行受控构建/运行请求，受权限模式控制。project 必须是 project.create 返回的完整 designerProject；不要只传 projectId，也不要传 result.project 解决方案元数据。传入模型与磁盘设计器版本不一致时会在日志中给出中文告警。', inputSchema: objectSchema({ project: { type: 'object', description: 'project.create 返回的完整 designerProject，至少包含 id、windows 和控件布局。' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema, run: { type: 'boolean' }, approved: { type: 'boolean' } }, ['project']) },
  { name: 'lingbuilder.modules.list', description: '按摘要列出模块与指定项目启用模块（不含完整命令清单，避免超长响应）；需要完整命令签名时改用 lingbuilder.module.info。新建项目必须传 project.create 返回的 project.id。', inputSchema: objectSchema({ projectId: { type: 'string', maxLength: 128 } }) },
  { name: 'lingbuilder.module.info', description: '查询单个模块的完整信息：全部命令的签名、参数类型与中文说明、返回值、示例、公开类型、平台目标和文档路径。query 可按命令名/描述过滤；默认不返回 visibility=advanced 的高级命令，需要时传 includeAdvanced=true。', inputSchema: objectSchema({ moduleId: { type: 'string', minLength: 2, maxLength: 128, description: '模块 ID，如 lingbuilder.database.sqlite。' }, projectId: { type: 'string', maxLength: 128, description: '可选；用于标注该模块在指定项目中的启用状态。' }, query: { type: 'string', maxLength: 128, description: '可选；按命令名或描述过滤，中文或英文子串。' }, includeAdvanced: { type: 'boolean', description: '可选；true 时同时返回 visibility=advanced 的高级命令（如 new_emoji 的 NE_EU_* 底层入口）。' } }, ['moduleId']) },
  { name: 'lingbuilder.native.preview', description: '预览生成 C++ 工程文件并写入受控临时目录，不写入 generated/cpp 导出目录。project 必须是 project.create 返回的完整 designerProject，不接收单独的 projectId；传入模型与磁盘设计器版本不一致时会在日志中给出中文告警。', inputSchema: objectSchema({ project: { type: 'object', description: 'project.create 返回的完整 designerProject。' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema }, ['project']) },
  { name: 'lingbuilder.native.export', description: '导出 C++ 工程，受权限模式控制。project 必须是 project.create 返回的完整 designerProject，不接收单独的 projectId。', inputSchema: objectSchema({ project: { type: 'object', description: 'project.create 返回的完整 designerProject。' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema, approved: { type: 'boolean' } }, ['project']) },
  { name: 'lingbuilder.module.scaffold', description: '在 .lingbuilder/module-build 下创建 .lbmod 模块项目骨架（manifest v2 + C++ 源码模板），受权限模式控制（preview 模式需 approved=true）。', inputSchema: objectSchema({ id: { type: 'string', pattern: '^[a-z0-9][a-z0-9._-]{2,80}$', maxLength: 81, description: '模块 ID，小写字母/数字开头，可含点、下划线、中划线。' }, name: { type: 'string', maxLength: 100 }, template: { type: 'string', enum: ['cpp-source'] }, outDir: { type: 'string', maxLength: 512, description: '可选，默认 .lingbuilder/module-build/<id>。' }, approved: { type: 'boolean' } }, ['id']) },
  { name: 'lingbuilder.module.writeFiles', description: '把模块完整文件写入 .lingbuilder/module-build；files 必须包含根目录 lingbuilder.module.json（manifest v2），每项是完整新内容而非片段；与模块导入端点共用扩展名白名单、200 文件/单文件 1MB/总量 10MB 限额和导入校验，受权限模式控制。', inputSchema: objectSchema({ files: { type: 'array', minItems: 1, maxItems: 200, items: objectSchema({ path: { type: 'string', minLength: 1, maxLength: 512 }, content: { type: 'string', minLength: 1, maxLength: 1048576 } }, ['path', 'content']) }, outDir: { type: 'string', maxLength: 512, description: '可选，默认 .lingbuilder/module-build/<manifest.id>。' }, approved: { type: 'boolean' } }, ['files']) },
  { name: 'lingbuilder.module.validate', description: '校验 .lingbuilder/module-build 下的模块目录（manifest v2、binding、模块文档与示例完整性），返回中文诊断；只读操作。', inputSchema: objectSchema({ modulePath: { type: 'string', minLength: 1, maxLength: 512, description: '模块目录，或直接指向 lingbuilder.module.json 文件。' } }, ['modulePath']) },
  { name: 'lingbuilder.module.pack', description: '把校验通过的模块目录打包为 .lingbuilder/module-packages/<目录名>.lbmod，打包前强制完整校验，受权限模式控制。', inputSchema: objectSchema({ moduleDir: { type: 'string', minLength: 1, maxLength: 512 }, targetPath: { type: 'string', maxLength: 512, description: '可选，默认 .lingbuilder/module-packages/<目录名>.lbmod。' }, approved: { type: 'boolean' } }, ['moduleDir']) },
  { name: 'lingbuilder.module.installPreview', description: '预览 .lingbuilder/module-packages 下的 .lbmod 模块包：解压并校验清单/路径/平台依赖，不安装；返回 previewId、canInstall 与中文诊断。', inputSchema: objectSchema({ packagePath: { type: 'string', minLength: 1, maxLength: 512 } }, ['packagePath']) },
  { name: 'lingbuilder.module.install', description: '安装已通过 installPreview 的模块包并可启用到指定项目；必须传 installPreview 返回的 previewId，受权限模式控制（preview 模式需 approved=true），收费模块受权益门禁。', inputSchema: objectSchema({ previewId: { type: 'string', minLength: 8, maxLength: 128 }, projectId: { type: 'string', maxLength: 128, description: '当前项目 ID。' }, enableForProject: { type: 'boolean', description: '默认 true，安装后启用到项目并同步构建配置。' }, approved: { type: 'boolean' } }, ['previewId', 'projectId']) },
  { name: 'lingbuilder.build.stop', description: '停止指定项目的受控运行进程（只影响 AI Bridge 自己启动的进程，不会误伤同名进程）；也可用于下一次构建前手动释放被锁定的 exe。projectId 为 project.create 返回的项目 ID。', inputSchema: objectSchema({ projectId: { type: 'string', minLength: 1, maxLength: 128 } }, ['projectId']) },
  { name: 'lingbuilder.run.wait', description: '等待指定项目的受控运行进程退出并返回退出码；超时（默认 30 秒，上限 600 秒）时返回 running=true 的当前状态。控制台程序可先用 lingbuilder.run.log 查看已输出内容。', inputSchema: objectSchema({ projectId: { type: 'string', minLength: 1, maxLength: 128 }, timeoutSeconds: { type: 'integer', minimum: 1, maximum: 600, description: '可选；等待上限，默认 30 秒。' } }, ['projectId']) },
  { name: 'lingbuilder.run.log', description: '读取指定项目最近一次受控运行的输出日志（控制台程序的 stdout/stderr；GUI 程序通常为空）。可传 tailLines 只取末尾 N 行（默认 200，上限 1000）。', inputSchema: objectSchema({ projectId: { type: 'string', minLength: 1, maxLength: 128 }, tailLines: { type: 'integer', minimum: 1, maximum: 1000 } }, ['projectId']) }
];

export interface AiBridgeMcpActivity {
  id: string;
  timestamp: string;
  transport: 'stdio' | 'streamable-http';
  clientId: string;
  kind: 'connected' | 'disconnected' | 'tool';
  tool?: string;
  ok: boolean;
  durationMs?: number;
  message: string;
}

export interface AiBridgeMcpHttpClient {
  id: string;
  connectedAt: string;
  lastActiveAt: string;
  userAgent: string;
}

export interface AiBridgeMcpHttpSnapshot {
  activeClients: number;
  clients: AiBridgeMcpHttpClient[];
  recentActivity: AiBridgeMcpActivity[];
}

export interface AiBridgeMcpHttpGateway {
  router: Router;
  snapshot(): AiBridgeMcpHttpSnapshot;
  close(): Promise<void>;
}

type ObserveActivity = (activity: Omit<AiBridgeMcpActivity, 'id' | 'timestamp'>) => void;

function createProtocolServer(service: AiBridgeService, observe?: ObserveActivity, clientId = 'stdio'): Server {
  const server = new Server(
    { name: 'lingbuilder-ai-bridge', version: '0.6.6' },
    { capabilities: { tools: {} }, instructions: MCP_INSTRUCTIONS }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const startedAt = Date.now();
    try {
      const result = await callTool(service, request.params.name, request.params.arguments || {});
      observe?.({
        transport: 'streamable-http', clientId, kind: 'tool', tool: request.params.name, ok: true,
        durationMs: Date.now() - startedAt, message: `${request.params.name} 调用完成。`
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      observe?.({
        transport: 'streamable-http', clientId, kind: 'tool', tool: request.params.name, ok: false,
        durationMs: Date.now() - startedAt, message
      });
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
  });
  return server;
}

export function startAiBridgeMcpServer(service: AiBridgeService): void {
  const server = createProtocolServer(service);
  void server.connect(new StdioServerTransport()).catch(error => {
    process.stderr.write(`LingBuilder MCP 启动失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export function createAiBridgeMcpHttpGateway(service: AiBridgeService, token: string): AiBridgeMcpHttpGateway {
  if (!token.trim()) throw new Error('MCP Streamable HTTP 必须使用非空 Bearer Token。');
  const router = express.Router();
  const sessions = new Map<string, {
    transport: StreamableHTTPServerTransport;
    server: Server;
    client: AiBridgeMcpHttpClient;
  }>();
  const recentActivity: AiBridgeMcpActivity[] = [];

  const record: ObserveActivity = activity => {
    recentActivity.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...activity });
    if (recentActivity.length > 100) recentActivity.length = 100;
    const session = sessions.get(activity.clientId);
    if (session) session.client.lastActiveAt = new Date().toISOString();
  };

  router.use((req, res, next) => {
    const authorization = req.header('authorization') || '';
    const expected = `Bearer ${token}`;
    const valid = authorization.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
    if (!valid) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="LingBuilder AI Bridge"');
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'AI Bridge Bearer Token 无效或缺失。' }, id: null });
      return;
    }
    next();
  });

  router.get('/status', (_req, res) => res.json({ ok: true, ...snapshot() }));
  router.post('/', async (req, res) => {
    try {
      const sessionId = requestSessionId(req);
      const existing = sessionId ? sessions.get(sessionId) : undefined;
      if (existing) {
        existing.client.lastActiveAt = new Date().toISOString();
        await existing.transport.handleRequest(req, res, req.body);
        return;
      }
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'MCP 会话无效，请重新初始化。' }, id: null });
        return;
      }

      const assignedId = crypto.randomUUID();
      let initializedId = '';
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => assignedId,
        enableJsonResponse: true,
        onsessioninitialized: id => { initializedId = id; }
      });
      const client: AiBridgeMcpHttpClient = {
        id: '', connectedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(),
        userAgent: String(req.header('user-agent') || '未知 MCP 客户端').slice(0, 256)
      };
      const server = createProtocolServer(service, record, assignedId);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      if (!initializedId) {
        await transport.close();
        await server.close();
        return;
      }
      client.id = initializedId;
      sessions.set(initializedId, { transport, server, client });
      const protocolOnClose = transport.onclose;
      transport.onclose = () => { protocolOnClose?.(); void closeSession(initializedId, '客户端关闭连接。'); };
      record({ transport: 'streamable-http', clientId: initializedId, kind: 'connected', ok: true, message: 'MCP 客户端已连接。' });
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: error instanceof Error ? error.message : String(error) }, id: null });
    }
  });
  router.get('/', async (req, res) => handleExisting(req, res));
  router.delete('/', async (req, res) => handleExisting(req, res));

  async function handleExisting(req: Request, res: Response): Promise<void> {
    const sessionId = requestSessionId(req);
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'MCP 会话不存在或已经结束。' }, id: null });
      return;
    }
    session.client.lastActiveAt = new Date().toISOString();
    await session.transport.handleRequest(req, res, req.body);
    if (req.method === 'DELETE') await closeSession(sessionId!, '客户端结束会话。');
  }

  async function closeSession(sessionId: string, message: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    record({ transport: 'streamable-http', clientId: sessionId, kind: 'disconnected', ok: true, message });
    try { await session.transport.close(); } catch { /* already closed */ }
    try { await session.server.close(); } catch { /* already closed */ }
  }

  function snapshot(): AiBridgeMcpHttpSnapshot {
    return {
      activeClients: sessions.size,
      clients: [...sessions.values()].map(({ client }) => ({ ...client })),
      recentActivity: recentActivity.map(item => ({ ...item }))
    };
  }

  return {
    router,
    snapshot,
    close: async () => { await Promise.all([...sessions.keys()].map(id => closeSession(id, 'AI Bridge 已停止。'))); }
  };
}

function requestSessionId(req: Request): string | undefined {
  const value = req.header('mcp-session-id');
  return value?.trim() || undefined;
}

async function callTool(service: AiBridgeService, name: string, args: any): Promise<unknown> {
  switch (name) {
    case 'lingbuilder.workspace.list': return await service.listWorkspaceTree();
    case 'lingbuilder.file.read': return await service.readFile(args.filePath);
    case 'lingbuilder.file.search': return await service.searchFiles(args);
    case 'lingbuilder.lingcpp.diagnostics': return await service.getLingCppDiagnostics(args);
    case 'lingbuilder.edit.propose': return await service.proposeEdit(args);
    case 'lingbuilder.edit.apply': return await service.applyEdit(args);
    case 'lingbuilder.project.templates': return await service.listProjectTemplates();
    case 'lingbuilder.project.create': return await service.createProject(args);
    case 'lingbuilder.project.create.undo': return await service.undoProjectCreate(args.receiptId, args.approved);
    case 'lingbuilder.build.run': return await service.buildRun(args);
    case 'lingbuilder.modules.list': return await service.listModules(args.projectId);
    case 'lingbuilder.module.info': return await service.getModuleInfo(args);
    case 'lingbuilder.native.preview': return await service.nativePreview(args);
    case 'lingbuilder.native.export': return await service.nativeExport(args);
    case 'lingbuilder.build.stop': return await service.stopRun(args.projectId);
    case 'lingbuilder.run.wait': return await service.waitForRun(args.projectId, args.timeoutSeconds);
    case 'lingbuilder.run.log': return await service.readRunLog(args.projectId, args.tailLines);
    case 'lingbuilder.module.scaffold': return await service.scaffoldModule(args);
    case 'lingbuilder.module.writeFiles': return await service.writeModuleFiles(args);
    case 'lingbuilder.module.validate': return await service.validateModule(args);
    case 'lingbuilder.module.pack': return await service.packModule(args);
    case 'lingbuilder.module.installPreview': return await service.previewModuleInstall(args);
    case 'lingbuilder.module.install': return await service.installModule(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
