import { parseLingCpp } from './src/services/lingCpp/parser';
import { generateProjectDllDeclarationHeader } from './src/services/lingCpp/projectDllCommandService';
import { readFileSync } from 'fs';
const decl = readFileSync('../AI 视频自主生产/进阶方案/系统DLL调用演示/src/项目DLL命令.lcpp', 'utf8');
const parsed = parseLingCpp(decl);
console.log('libraries:', parsed.program.dllLibraries.map(l => ({
  name: l.name,
  cmds: l.commands.map(c => ({ name: c.name, exportName: c.exportName }))
})));
console.log('--- header ---');
console.log(generateProjectDllDeclarationHeader(parsed.program.dllLibraries));
