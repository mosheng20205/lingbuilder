import { ALGORITHM_COMMANDS, BASIC_COMMANDS, BIND_COMMANDS, IMAGE_COMMANDS, KEYPAD_COMMANDS, MOUSE_COMMANDS, WINDOW_COMMANDS } from '../src/services/modules/opModuleCommands';
import { CV_COMMANDS, MEMORY_COMMANDS, OCR_COMMANDS, YOLO_COMMANDS } from '../src/services/modules/opModuleCommands2';
import { OP_MODULE } from '../src/services/modules/opModules';

const all = [
  ...BASIC_COMMANDS, ...ALGORITHM_COMMANDS, ...WINDOW_COMMANDS, ...BIND_COMMANDS,
  ...MOUSE_COMMANDS, ...KEYPAD_COMMANDS, ...IMAGE_COMMANDS,
  ...CV_COMMANDS, ...YOLO_COMMANDS, ...OCR_COMMANDS, ...MEMORY_COMMANDS
];
console.log('基础:', BASIC_COMMANDS.length, '算法:', ALGORITHM_COMMANDS.length, '窗口:', WINDOW_COMMANDS.length,
  '绑定:', BIND_COMMANDS.length, '鼠标:', MOUSE_COMMANDS.length, '键盘:', KEYPAD_COMMANDS.length, '图色:', IMAGE_COMMANDS.length);
console.log('CV:', CV_COMMANDS.length, 'YOLO:', YOLO_COMMANDS.length, '字库识字:', OCR_COMMANDS.length, '内存:', MEMORY_COMMANDS.length);
console.log('TOTAL:', all.length);
const names = new Set<string>();
const dups: string[] = [];
for (const c of all) {
  if (names.has(c.name)) dups.push(c.name);
  names.add(c.name);
}
console.log('unique:', names.size, 'dups:', dups.join(',') || 'none');
console.log('bindings:', OP_MODULE.bindings.commands.length, 'contributes:', OP_MODULE.contributes.commands.length);
const aliasSet = new Set<string>();
const adups: string[] = [];
for (const c of OP_MODULE.contributes.commands) {
  for (const a of (c.aliases || [])) {
    if (aliasSet.has(a)) adups.push(a);
    aliasSet.add(a);
  }
}
console.log('aliases:', aliasSet.size, 'alias dups:', adups.join(',') || 'none');
const badParams = all.filter(c => (c.parameters || []).some(p => !p.description));
console.log('params missing description:', badParams.map(c => c.name).join(',') || 'none');
