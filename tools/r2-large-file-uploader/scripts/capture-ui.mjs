import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.R2_UPLOADER_URL || 'http://127.0.0.1:8791';
const outputDirectory = process.env.R2_UPLOADER_CAPTURE_DIR || process.cwd();
const chromePath = process.env.CHROME_PATH;
const testFilePath = path.join(os.tmpdir(), `r2-uploader-ui-${process.pid}.bin`);

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(testFilePath, Buffer.alloc(64 * 1024, 0x4c));

const browser = await chromium.launch({
  channel: chromePath ? undefined : 'chrome',
  executablePath: chromePath || undefined,
  headless: true,
});

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const mockKey = 'uploads/2026-08-03/ui-capture.bin';
  const mockDownloadUrl = `${baseUrl}/files/${mockKey}`;
  await desktop.route('**/api/config', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        ok: true,
        configured: true,
        accountId: 'f5ae4747daef58a439015054049ed986',
        accessKeyId: 'ui-capture-access-key',
        bucketName: '462030',
        publicBaseUrl: 'https://msimgimg.xyz',
      }),
    });
  });
  await desktop.route('**/api/uploads/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let result;
    if (pathname.endsWith('/init')) {
      result = { ok: true, key: mockKey, uploadId: 'ui-capture', partSize: 32 * 1024 * 1024, partCount: 1 };
    } else if (pathname.endsWith('/part')) {
      result = { ok: true, partNumber: 1, etag: 'ui-capture-etag' };
    } else if (pathname.endsWith('/complete')) {
      result = {
        ok: true,
        key: mockKey,
        size: 64 * 1024,
        etag: 'ui-capture-manifest',
        downloadUrl: mockDownloadUrl,
        publicDownloadUrl: 'https://msimgimg.xyz/uploads/2026-08-03/ui-capture.bin',
      };
    } else {
      result = { ok: true };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(result),
    });
  });
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: path.join(outputDirectory, 'r2-uploader-desktop.png'), fullPage: true });

  await desktop.evaluate(() => {
    window.addEventListener('r2-upload-complete', event => {
      window.__r2UploadCallbackResult = event.detail;
    }, { once: true });
  });
  await desktop.setInputFiles('#file-input', testFilePath);
  await desktop.click('#start-upload');
  await desktop.locator('#result-panel:not([hidden])').waitFor({ timeout: 60_000 });

  const result = await desktop.evaluate(() => ({
    callbackUrl: window.__r2UploadCallbackResult?.downloadUrl,
    callbackPublicUrl: window.__r2UploadCallbackResult?.publicDownloadUrl,
    inputUrl: document.querySelector('#result-url')?.value,
    progress: document.querySelector('#progress-bar')?.getAttribute('aria-valuenow'),
    message: document.querySelector('#message')?.textContent,
  }));
  assert.equal(result.callbackUrl, mockDownloadUrl);
  assert.equal(result.inputUrl, result.callbackPublicUrl);
  assert.equal(result.progress, '100.0');
  assert.match(result.message || '', /下载地址已生成/);
  await desktop.waitForTimeout(200);
  await desktop.screenshot({ path: path.join(outputDirectory, 'r2-uploader-complete.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  const mobileMetrics = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(mobileMetrics.viewport, 390);
  assert.equal(mobileMetrics.scrollWidth, 390);
  await mobile.screenshot({ path: path.join(outputDirectory, 'r2-uploader-mobile.png'), fullPage: true });

  process.stdout.write(`${JSON.stringify({ ok: true, result, mobileMetrics }, null, 2)}\n`);
} finally {
  await browser.close();
  await fs.rm(testFilePath, { force: true });
}
