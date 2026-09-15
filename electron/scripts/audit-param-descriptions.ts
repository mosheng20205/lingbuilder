/**
 * 临时审计脚本：统计内置模块 bindings.commands[].parameters[] 中缺中文说明的参数。
 * 用法：node --import tsx scripts/audit-param-descriptions.ts
 */
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

interface Row {
  id: string;
  name: string;
  commands: number;
  params: number;
  missing: number;
  missingWithNames: string[];
}

const rows: Row[] = [];
for (const mod of BUILTIN_MODULES) {
  const commands = mod.bindings?.commands ?? [];
  let params = 0;
  let missing = 0;
  const missingWithNames: string[] = [];
  for (const cmd of commands) {
    (cmd.parameters ?? []).forEach((p, i) => {
      params += 1;
      const desc = (p.description ?? '').trim();
      if (!desc) {
        missing += 1;
        if (missingWithNames.length < 8) missingWithNames.push(`${cmd.command}#${i}:${p.name}(${p.type})`);
      }
    });
  }
  rows.push({ id: mod.id, name: mod.name, commands: commands.length, params, missing, missingWithNames });
}

rows.sort((a, b) => b.missing - a.missing || a.id.localeCompare(b.id));
let totalMissing = 0;
let totalParams = 0;
let totalCommands = 0;
console.log('模块ID\t模块名\t命令数\t参数数\t缺说明\t占比');
for (const r of rows) {
  totalMissing += r.missing;
  totalParams += r.params;
  totalCommands += r.commands;
  const pct = r.params ? `${((r.missing / r.params) * 100).toFixed(1)}%` : '-';
  console.log(`${r.id}\t${r.name}\t${r.commands}\t${r.params}\t${r.missing}\t${pct}`);
}
console.log(`合计：模块 ${rows.length}，命令 ${totalCommands}，参数 ${totalParams}，缺说明 ${totalMissing}`);

const sample = process.argv[2];
if (sample) {
  for (const mod of BUILTIN_MODULES) {
    if (mod.id !== sample) continue;
    for (const cmd of mod.bindings?.commands ?? []) {
      const miss = (cmd.parameters ?? []).filter((p) => !(p.description ?? '').trim());
      if (miss.length) {
        console.log(`${cmd.command} :: ${miss.map((p) => `${p.name}:${p.type}`).join(', ')}`);
      }
    }
  }
}
