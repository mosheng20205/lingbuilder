import * as fs from 'node:fs';
import { OP_MODULE } from '../src/services/modules/opModules';
const commands = OP_MODULE.contributes!.commands.map(c => ({
  name: c.name,
  signature: c.signature,
  category: c.category || '其他',
  aliases: c.aliases || []
}));
const bindings = OP_MODULE.bindings!.commands.map(b => ({
  command: b.command,
  params: (b.parameters || []).map(p => ({ name: p.name, type: String(p.type), byRef: p.byRef === true })),
  returnType: b.returnType
}));
fs.writeFileSync('T:/electron/lingbuilder/.zcode/tmp/op-demo-commands.json', JSON.stringify({ commands, bindings }, null, 2), 'utf8');
console.log('dumped', commands.length, 'commands');
