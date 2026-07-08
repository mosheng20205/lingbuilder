import readline from 'readline';
import { AiBridgeService } from './aiBridgeService';

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: string | number | null;
  method?: string;
  params?: any;
};

const TOOLS = [
  { name: 'lingbuilder.workspace.list', description: '列出 LingBuilder 工作区文件树。' },
  { name: 'lingbuilder.file.read', description: '读取工作区内允许类型的文本文件。' },
  { name: 'lingbuilder.file.search', description: '在工作区内执行受控文本搜索。' },
  { name: 'lingbuilder.lingcpp.diagnostics', description: '返回 .lcpp 解析与语义诊断。' },
  { name: 'lingbuilder.edit.propose', description: '生成可预览的 WorkspaceEdit 修改提案。' },
  { name: 'lingbuilder.edit.apply', description: '应用已有 WorkspaceEdit 提案，受权限模式控制。' },
  { name: 'lingbuilder.build.run', description: '执行受控构建/运行请求，受权限模式控制。' },
  { name: 'lingbuilder.modules.list', description: '列出模块与项目启用模块上下文。' },
  { name: 'lingbuilder.native.preview', description: '预览生成 C++ 工程文件，不写入导出目录。' },
  { name: 'lingbuilder.native.export', description: '导出 C++ 工程，受权限模式控制。' }
];

export function startAiBridgeMcpServer(service: AiBridgeService): void {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async line => {
    if (!line.trim()) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch (error: any) {
      send({ id: null, error: { code: -32700, message: error?.message || 'Invalid JSON' } });
      return;
    }

    if (request.id === undefined || request.id === null) return;

    try {
      if (request.method === 'initialize') {
        send({
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'lingbuilder-ai-bridge', version: '0.1.0' },
            capabilities: { tools: {} }
          }
        });
        return;
      }

      if (request.method === 'tools/list') {
        send({
          id: request.id,
          result: {
            tools: TOOLS.map(tool => ({
              ...tool,
              inputSchema: { type: 'object', additionalProperties: true }
            }))
          }
        });
        return;
      }

      if (request.method === 'tools/call') {
        const name = request.params?.name;
        const args = request.params?.arguments || {};
        const result = await callTool(service, name, args);
        send({
          id: request.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        });
        return;
      }

      send({ id: request.id, error: { code: -32601, message: `Unknown method: ${request.method}` } });
    } catch (error: any) {
      send({ id: request.id, error: { code: -32000, message: error?.message || 'MCP tool failed' } });
    }
  });
}

async function callTool(service: AiBridgeService, name: string, args: any): Promise<unknown> {
  switch (name) {
    case 'lingbuilder.workspace.list':
      return await service.listWorkspaceTree();
    case 'lingbuilder.file.read':
      return await service.readFile(args.filePath);
    case 'lingbuilder.file.search':
      return await service.searchFiles(args);
    case 'lingbuilder.lingcpp.diagnostics':
      return await service.getLingCppDiagnostics(args);
    case 'lingbuilder.edit.propose':
      return await service.proposeEdit(args);
    case 'lingbuilder.edit.apply':
      return await service.applyEdit(args);
    case 'lingbuilder.build.run':
      return await service.buildRun(args);
    case 'lingbuilder.modules.list':
      return await service.listModules(args.projectId);
    case 'lingbuilder.native.preview':
      return await service.nativePreview(args);
    case 'lingbuilder.native.export':
      return await service.nativeExport(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(payload: { id: string | number | null; result?: unknown; error?: unknown }): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...payload })}\n`);
}
