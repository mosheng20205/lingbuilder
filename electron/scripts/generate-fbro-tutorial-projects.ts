/**
 * 生成《FBro 指纹浏览器合集》各集的录制用示例项目。
 *
 * 每集产出一个可独立打开、可 F5 的 LingBuilder 工作区：
 *   .lingbuilder/{solution,project-modules,window-designer,build-configuration}.json
 *   src/<窗体>.lcpp、assets/（本地测试页）、config/<项目ID>/config.ini、build-request.json
 *   README.md、录制准备记录.md
 *
 * 命令、事件名与事件字段全部按 builtinModules.ts / fbroModules.ts /
 * FbroEventOverrides.generated.inc 实测核对，不使用未公开或不存在的字段。
 *
 * 用法：npm run tutorial:fbro:generate [--only 18|fbro-ep18-contextmenu|new]
 */
import { EPISODES, emit, filterEpisodes } from './fbro-tutorial/projects.ts';
import { writeEpisodeDocs } from './fbro-tutorial/docs.ts';

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;
const targetEpisodes = filterEpisodes(EPISODES, only);

let projects = 0;
for (const episode of targetEpisodes) {
  emit(episode);
  projects += 1;
  console.log(`已生成 ${episode.id}（${episode.name}）`);
}

const docs = writeEpisodeDocs(only);
console.log(`\n共生成 ${projects} 个示例项目、${docs} 份文档（README.md / 录制准备记录.md）。`);
console.log('下一步：npm run tutorial:fbro:build');
