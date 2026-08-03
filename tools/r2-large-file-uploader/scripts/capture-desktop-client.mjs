import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const packagedExecutable = process.env.R2_UPLOADER_ELECTRON_EXECUTABLE;
const outputPath = process.env.R2_UPLOADER_DESKTOP_SCREENSHOT
  || path.join(projectRoot, 'screenshots', 'r2-uploader-desktop-client.png');

const electronApp = await electron.launch({
  executablePath: packagedExecutable
    ? path.resolve(packagedExecutable)
    : path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe'),
  args: packagedExecutable ? [] : [path.join(projectRoot, 'scripts', 'desktop-main.mjs')],
  cwd: projectRoot,
});

try {
  const window = await electronApp.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('networkidle');
  await window.locator('#service-state').waitFor({ state: 'visible' });

  const result = await window.evaluate(async () => {
    const response = await fetch('/api/config');
    const config = await response.json();
    return {
      title: document.title,
      origin: location.origin,
      configured: config.configured,
      bucketName: config.bucketName,
      publicBaseUrl: config.publicBaseUrl,
      serviceState: document.querySelector('#service-state')?.textContent?.trim(),
    };
  });

  assert.equal(result.title, 'R2 大文件上传器');
  assert.match(result.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(result.configured, true);
  assert.equal(result.bucketName, '462030');
  assert.equal(result.publicBaseUrl, 'https://msimgimg.xyz');
  assert.match(result.serviceState || '', /R2 已连接/);

  await window.screenshot({ path: outputPath, fullPage: true });
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, ...result }, null, 2)}\n`);
} finally {
  await electronApp.close();
}
