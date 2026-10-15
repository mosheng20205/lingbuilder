import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收（2026-10-15）：dist/cli.cjs 必须携带第 28 条图片资源导入指引，工具数 25，且能真机导入一张图。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-import-image-stdio-'));
  // 注册一个测试项目，供真机调用 importImage。
  const projectDir = path.join(workspaceRoot, '.lingbuilder', 'projects', 'smoke-asset');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'smoke-asset-solution',
    name: '图片导入验收',
    startupProjectId: 'smoke-asset',
    projects: [{
      id: 'smoke-asset',
      name: '图片导入验收项目',
      type: 'visual-cpp',
      sourceRoot: 'src/smoke-asset',
      configRoot: 'config/smoke-asset',
      designerPath: '.lingbuilder/projects/smoke-asset/window-designer.json'
    }]
  }, null, 2), 'utf8');
  // 工作区内图片源（相对路径形态）+ 工作区外图片源（绝对路径形态）。
  const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff0300000502579b2f0000000049454e44ae426082';
  await fs.mkdir(path.join(workspaceRoot, '素材'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '素材', '横幅.png'), Buffer.from(pngHex, 'hex'));
  const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-import-image-src-'));
  const outsidePng = path.join(outsideDir, '图标.png');
  await fs.writeFile(outsidePng, Buffer.from(pngHex, 'hex'));

  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--permission', 'yolo', '--workspace', workspaceRoot, '--port', '0'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let lineBuffer = '';
  const messages: Array<Record<string, unknown>> = [];
  child.stdout.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString('utf8');
    let index: number;
    while ((index = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, index).trim();
      lineBuffer = lineBuffer.slice(index + 1);
      if (!line) continue;
      try {
        messages.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // 非消息行忽略。
      }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  const send = (message: Record<string, unknown>) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean, timeoutMs = 30_000): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = messages.find(predicate);
      if (hit) return hit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('等待 MCP 响应超时');
  };
  const textOf = (message: Record<string, unknown>): string => {
    const content = (message.result as { content?: Array<{ type?: string; text?: string }> })?.content || [];
    return content.map(item => item.text || '').join('\n');
  };

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept', version: '0' } } });
    const init = await waitFor(message => message.id === 1);
    const instructions = String((init.result as { instructions?: string }).instructions || '');
    check('instructions 携带 lingbuilder.project.importImage', instructions.includes('lingbuilder.project.importImage'));
    check('instructions 携带第 28 条图片资源导入口径', instructions.includes('项目图片资源导入'));
    check('instructions 写明重名 -2 后缀行为', instructions.includes('重名自动追加 -2 后缀'));

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = await waitFor(message => message.id === 2);
    const toolList = (tools.result as { tools?: Array<{ name: string; inputSchema?: { required?: string[] } }> }).tools || [];
    check('工具数为 25', toolList.length === 25, `实际 ${toolList.length}`);
    const importTool = toolList.find(tool => tool.name === 'lingbuilder.project.importImage');
    check('暴露 lingbuilder.project.importImage', Boolean(importTool));
    const required = importTool?.inputSchema?.required || [];
    check('importImage 必填 projectId+sourcePath', required.includes('projectId') && required.includes('sourcePath'));

    send({ jsonrpc: '2.0', id: 3, method: 'notifications/initialized', params: {} });
    // 真机导入 1：工作区内相对路径。
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lingbuilder.project.importImage', arguments: { projectId: 'smoke-asset', sourcePath: '素材/横幅.png' } } });
    const call1 = await waitFor(message => message.id === 4);
    const result1 = textOf(call1);
    check('相对路径导入成功', result1.includes('"ok": true') && result1.includes('assets/smoke-asset/横幅.png'), result1.slice(0, 160));
    check('图片真实落盘', await exists(path.join(workspaceRoot, 'assets', 'smoke-asset', '横幅.png')));

    // 真机导入 2：本机绝对路径 + 同内容同名复用。
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'lingbuilder.project.importImage', arguments: { projectId: 'smoke-asset', sourcePath: outsidePng } } });
    const call2 = await waitFor(message => message.id === 5);
    const result2 = textOf(call2);
    check('绝对路径导入成功且复用同名同内容', result2.includes('"ok": true') && result2.includes('图标.png'), result2.slice(0, 160));

    // 真机导入 3：中文报错（源不存在）。
    send({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'lingbuilder.project.importImage', arguments: { projectId: 'smoke-asset', sourcePath: '不存在.png' } } });
    const call3 = await waitFor(message => message.id === 6);
    const result3 = textOf(call3);
    check('源不存在给中文诊断', result3.includes('图片源文件不存在'), result3.slice(0, 160));

    check('审计日志落 project.importImage', (await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-log.jsonl'), 'utf8').catch(() => '')).includes('"action":"project.importImage"'));
  } finally {
    child.kill();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} 项失败`);
    process.exitCode = 1;
  } else {
    console.log('\n全部 PASS');
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

void main();
