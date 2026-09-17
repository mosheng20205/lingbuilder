import { parseLingCpp } from './src/services/lingCpp/parser';
import { readFileSync } from 'fs';
const decl = readFileSync('../AI 视频自主生产/进阶方案/系统DLL调用演示/src/项目DLL命令.lcpp', 'utf8');
const parsed = parseLingCpp(decl);
console.log('dllLibraries:', JSON.stringify(parsed.program.dllLibraries.map(l => ({ name: l.name, isSystem: l.isSystem, cmds: l.commands.map(c => ({ n: c.name, e: c.exportName })) })), null, 1));
console.log('errors:', parsed.program.diagnostics.filter(d => d.level === 'error').map(d => `${d.line}: ${d.message}`));
