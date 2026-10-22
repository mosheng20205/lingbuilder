import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收（2026-10-17）：dist/cli.cjs 必须携带第 20 条 ⑰ 运行期专属属性口径，
 *  工具数 25，且 lingbuilder.win32.basic 经 module.info 实查为 232 命令并包含 11 条新命令。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-win32basic-stdio-'));
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'win32basic-stdio-smoke', version: '1.0.0' } } });
  const initialized = await waitFor(message => message.id === 1 && message.result !== undefined, 'initialize');
  const instructions = String((initialized.result as Record<string, unknown>)?.instructions ?? '');
  const keywords: Array<[RegExp, string]> = [
    [/控件_设置只读/u, '运行期只读命令'],
    [/控件_设置密码输入/u, '运行期密码掩码命令'],
    [/控件_设置提示文字/u, '运行期占位提示命令'],
    [/控件_设置数值范围/u, '运行期数值范围命令'],
    [/控件_设置不确定进度/u, '运行期不确定进度命令'],
    [/控件_修改项目/u, '列表项目整行替换命令'],
    [/列表视图_设置单元格/u, '行×列单元格指路'],
    [/EM_SETREADONLY\/EM_SETPASSWORDCHAR/u, '@ 内联红线'],
    [/控件_设置选中颜色/u, '自绘层选中三色命令'],
    [/控件_设置选中标记颜色/u, '自绘层标记色命令'],
    [/控件_设置标题对齐/u, '分组框标题对齐命令'],
    [/控件_设置填充方式/u, '填充方式命令'],
    [/控件_设置循环播放/u, 'GIF 循环命令'],
    [/"#RRGGBB"/u, '颜色参数口径'],
    [/滑块_置刻度间隔/u, '滑块刻度命令'],
    [/日期时间选择器_置显示格式/u, '日期显示格式命令'],
    [/月历_置选中范围/u, '月历选区命令'],
    [/富文本框_置RTF文本/u, '富文本 RTF 命令'],
    [/文件_读入文本 从 \.rtf 文件读入/u, 'RTF 转义红线'],
    [/控件_设置数值范围 已直接支持/u, '调节器覆盖口径']
  ];
  let failed = 0;
  for (const [pattern, label] of keywords) {
    if (pattern.test(instructions)) console.log(`PASS instructions 关键词：${label}`);
    else { console.error(`FAIL instructions 缺关键词：${label}`); failed += 1; }
  }

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const toolList = await waitFor(message => message.id === 2 && message.result !== undefined, 'tools/list');
  const tools = ((toolList.result as Record<string, unknown>)?.tools ?? []) as Array<{ name: string }>;
  if (tools.length === 25) console.log(`PASS 工具数 25`);
  else { console.error(`FAIL 工具数应为 25，实际 ${tools.length}`); failed += 1; }

  const newCommands = ['控件_设置只读', '控件_设置密码输入', '控件_设置提示文字', '控件_设置数值范围', '控件_设置不确定进度', '控件_插入项目', '控件_删除项目', '控件_修改项目', '控件_取项目文本', '控件_取项目数量', '控件_设置表项高度', '控件_设置选中颜色', '控件_设置选中标记颜色', '控件_设置边框', '控件_设置标题对齐', '控件_设置文本对齐', '控件_设置填充方式', '控件_播放', '控件_暂停', '控件_设置循环播放', '滑块_置刻度间隔', '滑块_取刻度间隔', '日期时间选择器_置日期', '日期时间选择器_取日期', '日期时间选择器_置显示格式', '月历_置日期', '月历_取日期', '月历_置选中范围', '富文本框_置RTF文本', '富文本框_取RTF文本'];
  const callModuleInfo = async (id: number, moduleId: string, query: string) => {
    send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId, query } } });
    const response = await waitFor(message => message.id === id && message.result !== undefined, `module.info(${query})`);
    const content = (response.result as Record<string, unknown>)?.content as Array<{ text?: string }> | undefined;
    return JSON.parse(content?.[0]?.text ?? '{}') as { commands?: Array<{ name: string }>; commandsTotal?: number };
  };
  const infoA = await callModuleInfo(3, 'lingbuilder.win32.basic', '控件_设置');
  const infoB = await callModuleInfo(4, 'lingbuilder.win32.basic', '项目');
  const infoC = await callModuleInfo(5, 'lingbuilder.win32.basic', '播放');
  const infoD = await callModuleInfo(6, 'lingbuilder.win32.common-controls', '刻度');
  const infoE = await callModuleInfo(7, 'lingbuilder.win32.common-controls', '日期时间选择器');
  const infoF = await callModuleInfo(8, 'lingbuilder.win32.common-controls', '月历');
  const infoG = await callModuleInfo(9, 'lingbuilder.win32.common-controls', 'RTF');
  const merged = [...(infoA.commands ?? []), ...(infoB.commands ?? []), ...(infoC.commands ?? []),
    ...(infoD.commands ?? []), ...(infoE.commands ?? []), ...(infoF.commands ?? []), ...(infoG.commands ?? [])];
  for (const name of newCommands) {
    if (merged.some(command => command.name === name)) console.log(`PASS module.info 命中：${name}`);
    else { console.error(`FAIL module.info 缺命令：${name}`); failed += 1; }
  }
  if ((infoA.commandsTotal ?? 0) >= 241) console.log(`PASS module.info basic commandsTotal=${infoA.commandsTotal}`);
  else { console.error(`FAIL module.info basic commandsTotal=${infoA.commandsTotal}（应 ≥241）`); failed += 1; }
  if ((infoD.commandsTotal ?? 0) >= 560) console.log(`PASS module.info common-controls commandsTotal=${infoD.commandsTotal}`);
  else { console.error(`FAIL module.info common-controls commandsTotal=${infoD.commandsTotal}（应 ≥560）`); failed += 1; }

  child.kill();
  if (failed > 0) {
    console.error(`验收失败：${failed} 项`);
    process.exit(1);
  }
  console.log('win32.basic stdio 冒烟验收全部通过');
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
