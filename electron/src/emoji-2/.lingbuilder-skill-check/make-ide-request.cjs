// 用 IDE 自己的工作区（T:\electron\lingbuilder\electron）构建 emoji-2 项目：
// 设计器模型取 .lingbuilder/projects/emoji-2/window-designer.json，源码取 src/emoji-2/*.lcpp。
const fs = require('node:fs');
const path = require('node:path');

const workspace = 'T:\\electron\\lingbuilder\\electron';
const projectId = 'emoji-2';
const sourceRoot = path.join(workspace, 'src', projectId);

const model = JSON.parse(fs.readFileSync(
  path.join(workspace, '.lingbuilder', 'projects', projectId, 'window-designer.json'), 'utf8'));

const sources = [];
for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.lcpp')) continue;
  sources.push({
    filePath: `src/${projectId}/${entry.name}`,
    sourceCode: fs.readFileSync(path.join(sourceRoot, entry.name), 'utf8'),
  });
}
sources.sort((a, b) => (a.filePath.endsWith('MainWindow.lcpp') ? -1 : b.filePath.endsWith('MainWindow.lcpp') ? 1 : 0));
if (!sources.length) throw new Error('没有找到 .lcpp 源码。');

const request = {
  project: model,
  activeWindowId: model.windows[0].id,
  lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
  lingCppSourceCode: sources[0].sourceCode,
  lingCppSources: sources,
};

const out = path.join(__dirname, 'build-request.json');
fs.writeFileSync(out, JSON.stringify(request, null, 2), 'utf8');

const win = model.windows[0];
process.stdout.write('\n===REQ===\n' + JSON.stringify({
  out,
  projectId: model.id,
  windowBackend: win.designerBackend,
  controlCount: win.controls.length,
  controls: win.controls.map(c => ({ name: c.name, type: c.type, designerType: c.designerType, events: c.events })),
  sources: sources.map(s => s.filePath),
}, null, 2) + '\n===END===\n');
