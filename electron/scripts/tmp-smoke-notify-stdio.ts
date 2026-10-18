import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收（2026-10-17）：dist/cli.cjs 必须携带第 20 条 ⑱ 消息推送口径，
 *  工具数 25，且 lingbuilder.notify 经 module.info 实查为 17 命令 + 推送_默认超时毫秒 常量。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-notify-stdio-'));
  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--permission', 'readonly', '--workspace', workspaceRoot, '--port', '0'
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
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean, label: string) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const found = messages.find(predicate);
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`等待 ${label} 超时`);
  };

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'notify-stdio-smoke', version: '1.0.0' } } });
  const initialized = await waitFor(message => message.id === 1 && message.result, 'initialize');
  const instructions = String((initialized.result as Record<string, unknown>)?.instructions ?? '');
  const keywords: Array<[RegExp, string]> = [
    [/推送_发企业微信文本/u, '企微文本推送命令'],
    [/企微 Markdown 不支持 @ 人/u, '企微 Markdown 不能 @ 人红线'],
    [/推送_发钉钉文本\/Markdown/u, '钉钉文本/Markdown 命令'],
    [/推送_发钉钉链接/u, '钉钉链接命令'],
    [/推送_发钉钉卡片单按钮/u, '钉钉单按钮卡片命令'],
    [/推送_发钉钉卡片多按钮/u, '钉钉多按钮卡片命令'],
    [/推送_发钉钉图文/u, '钉钉 FeedCard 命令'],
    [/推送_发飞书文本/u, '飞书文本推送命令'],
    [/open_id 内联标签/u, '飞书 @ 人语义'],
    [/推送_发飞书富文本/u, '飞书富文本命令'],
    [/推送_上传企业微信文件/u, '企微文件两步上传链'],
    [/推送_发企业微信图片/u, '企微图片命令'],
    [/推送_发JSON/u, '万能兜底命令'],
    [/推送_取错误/u, '统一失败口径'],
    [/推送_取响应文本/u, '响应原文读取'],
    [/20 条\/分钟限流/u, '三平台限流口径'],
    [/关键词与加签可叠加/u, '钉钉叠加校验'],
    [/HMAC-SHA256/u, '运行时加签说明']
  ];
  let failed = 0;
  for (const [pattern, label] of keywords) {
    if (pattern.test(instructions)) console.log(`PASS instructions 关键词：${label}`);
    else { console.error(`FAIL instructions 缺关键词：${label}`); failed += 1; }
  }

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const toolList = await waitFor(message => message.id === 2 && message.result, 'tools/list');
  const tools = ((toolList.result as Record<string, unknown>)?.tools ?? []) as Array<{ name: string }>;
  if (tools.length === 25) console.log(`PASS 工具数 25`);
  else { console.error(`FAIL 工具数应为 25，实际 ${tools.length}`); failed += 1; }

  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.notify' } } });
  const infoResponse = await waitFor(message => message.id === 3 && message.result, 'module.info(lingbuilder.notify)');
  const info = JSON.parse(((infoResponse.result as Record<string, unknown>)?.content as Array<{ text?: string }> | undefined)?.[0]?.text ?? '{}') as {
    commands?: Array<{ name: string }>; commandsTotal?: number; constants?: Array<{ name: string }>; snippets?: Array<{ label: string }>;
  };
  const expectedCommands = [
    '推送_发JSON', '推送_取错误', '推送_取响应文本',
    '推送_发企业微信文本', '推送_发企业微信Markdown', '推送_发企业微信图片', '推送_发企业微信图文', '推送_上传企业微信文件', '推送_发企业微信文件',
    '推送_发钉钉文本', '推送_发钉钉Markdown', '推送_发钉钉链接', '推送_发钉钉卡片单按钮', '推送_发钉钉卡片多按钮', '推送_发钉钉图文',
    '推送_发飞书文本', '推送_发飞书富文本'
  ];
  for (const name of expectedCommands) {
    if ((info.commands ?? []).some(command => command.name === name)) console.log(`PASS module.info 命中：${name}`);
    else { console.error(`FAIL module.info 缺命令：${name}`); failed += 1; }
  }
  if ((info.commandsTotal ?? 0) === 17) console.log(`PASS module.info commandsTotal=${info.commandsTotal}`);
  else { console.error(`FAIL module.info commandsTotal=${info.commandsTotal}（应 17）`); failed += 1; }
  if ((info.constants ?? []).some(constant => constant.name === '#推送_默认超时毫秒')) console.log('PASS module.info 常量：#推送_默认超时毫秒');
  else { console.error('FAIL module.info 缺常量：#推送_默认超时毫秒'); failed += 1; }

  child.kill();
  if (failed > 0) throw new Error(`notify stdio 验收失败 ${failed} 项`);
  console.log('PASS notify stdio 握手验收全绿');
}

main().then(() => process.exit(0), error => {
  console.error(error);
  process.exit(1);
});
