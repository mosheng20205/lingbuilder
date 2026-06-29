const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(__dirname, '..', 'dist-electron');

for (const name of ['main', 'preload']) {
  const jsPath = path.join(outputDir, `${name}.js`);
  const cjsPath = path.join(outputDir, `${name}.cjs`);

  if (fs.existsSync(jsPath)) {
    fs.rmSync(cjsPath, { force: true });
    fs.renameSync(jsPath, cjsPath);
  }

  const mapPath = path.join(outputDir, `${name}.js.map`);
  const cjsMapPath = path.join(outputDir, `${name}.cjs.map`);

  if (fs.existsSync(mapPath)) {
    fs.rmSync(cjsMapPath, { force: true });
    fs.renameSync(mapPath, cjsMapPath);
    const source = fs.readFileSync(cjsPath, 'utf8');
    fs.writeFileSync(cjsPath, source.replace(`${name}.js.map`, `${name}.cjs.map`));
  }
}
