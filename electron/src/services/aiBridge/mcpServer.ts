import crypto from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AiBridgeService } from './aiBridgeService';

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object' as const, properties, required, additionalProperties: false });
const lingCppSourcesSchema = { type: 'array', maxItems: 256, items: objectSchema({ filePath: { type: 'string', minLength: 1, maxLength: 1024 }, sourceCode: { type: 'string', maxLength: 2097152 } }, ['filePath', 'sourceCode']) };
const TOOLS = [
  { name: 'lingbuilder.workspace.list', description: '列出 LingBuilder 工作区文件树。', inputSchema: objectSchema({}) },
  { name: 'lingbuilder.file.read', description: '读取工作区内允许类型的文本文件。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1, maxLength: 1024 } }, ['filePath']) },
  { name: 'lingbuilder.file.search', description: '在工作区内执行受控文本搜索。', inputSchema: objectSchema({ query: { type: 'string', minLength: 1, maxLength: 512 }, include: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 1024 } }, maxResults: { type: 'integer', minimum: 1, maximum: 500 } }, ['query']) },
  { name: 'lingbuilder.lingcpp.diagnostics', description: '返回 .lcpp 解析与语义诊断。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1 }, sourceCode: { type: 'string', maxLength: 2097152 }, projectId: { type: 'string', maxLength: 128 } }, ['filePath']) },
  { name: 'lingbuilder.edit.propose', description: '根据外部 AI 提供的完整文件草稿生成可预览提案。', inputSchema: objectSchema({ filePath: { type: 'string', minLength: 1 }, instruction: { type: 'string', minLength: 1, maxLength: 4000 }, sourceCode: { type: 'string', maxLength: 2097152 }, projectId: { type: 'string', maxLength: 128 }, files: { type: 'array', minItems: 1, maxItems: 5, items: objectSchema({ filePath: { type: 'string', minLength: 1 }, updatedSource: { type: 'string', maxLength: 2097152 } }, ['filePath', 'updatedSource']) } }, ['filePath', 'instruction', 'files']) },
  { name: 'lingbuilder.edit.apply', description: '应用已有 WorkspaceEdit 提案，受权限模式控制。', inputSchema: objectSchema({ proposalId: { type: 'string', minLength: 1 }, approved: { type: 'boolean' } }, ['proposalId']) },
  { name: 'lingbuilder.project.templates', description: '列出可用于 AI 新建项目的受控中文项目模板。', inputSchema: objectSchema({}) },
  { name: 'lingbuilder.project.create', description: '预览或创建 LingBuilder 项目；不传 approved=true 时只返回项目文件、设计器模型和模块引用预览。', inputSchema: objectSchema({ name: { type: 'string', maxLength: 100 }, projectId: { type: 'string', maxLength: 80 }, templateId: { type: 'string', enum: ['blank-window', 'hello-window'] }, windowTitle: { type: 'string', maxLength: 120 }, enabledModuleIds: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 2, maxLength: 128 } }, openInWorkbench: { type: 'boolean' }, approved: { type: 'boolean' } }) },
  { name: 'lingbuilder.project.create.undo', description: '撤销尚未被用户修改的 AI 项目创建事务，受权限模式控制。', inputSchema: objectSchema({ receiptId: { type: 'string', minLength: 16, maxLength: 80 }, approved: { type: 'boolean' } }, ['receiptId']) },
  { name: 'lingbuilder.build.run', description: '执行受控构建/运行请求，受权限模式控制。', inputSchema: objectSchema({ project: { type: 'object' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema, run: { type: 'boolean' }, approved: { type: 'boolean' } }, ['project']) },
  { name: 'lingbuilder.modules.list', description: '列出模块与项目启用模块上下文。', inputSchema: objectSchema({ projectId: { type: 'string', maxLength: 128 } }) },
  { name: 'lingbuilder.native.preview', description: '预览生成 C++ 工程文件，不写入导出目录。', inputSchema: objectSchema({ project: { type: 'object' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema }, ['project']) },
  { name: 'lingbuilder.native.export', description: '导出 C++ 工程，受权限模式控制。', inputSchema: objectSchema({ project: { type: 'object' }, activeWindowId: { type: 'string' }, lingCppSourceCode: { type: 'string', maxLength: 2097152 }, lingCppSources: lingCppSourcesSchema, approved: { type: 'boolean' } }, ['project']) }
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
  const server = new Server({ name: 'lingbuilder-ai-bridge', version: '0.3.0' }, { capabilities: { tools: {} } });
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
    case 'lingbuilder.native.preview': return await service.nativePreview(args);
    case 'lingbuilder.native.export': return await service.nativeExport(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
