/**
 * 生成 HTTP 接口文档离线资源内嵌模块（lingbuilder.http.server 2.3.0）。
 *
 * 读取 node_modules/swagger-ui-dist（版本锁定在 electron/package.json devDependencies）的
 * swagger-ui-bundle.js 与 swagger-ui.css，以 TS 字符串常量写入
 * src/services/windowDesigner/httpSwaggerUiInline.generated.ts；生成器
 * （httpServerRuntime.ts 的 generateHttpServerDocsRuntime）再把它转成 C++ 字节集数组，
 * 由 HTTP_启用接口文档 注册为 /docs/swagger-ui-bundle.js、/docs/swagger-ui.css 两条
 * 工作线程直回路由——不内联进 HTML，从根本上规避 `</script` / `<!--` 解析陷阱。
 *
 * --check：重新生成并与磁盘文件逐字比较，内容漂移时以退出码 1 拒绝（npm run build 门禁）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const electronRoot = dirname(scriptDir);
const generatedPath = join(electronRoot, 'src', 'services', 'windowDesigner', 'httpSwaggerUiInline.generated.ts');

function fail(message: string): never {
  console.error(`[http:swagger-ui] ${message}`);
  process.exit(1);
}

function resolveSwaggerUiDist(): string {
  const require = createRequire(join(electronRoot, 'package.json'));
  try {
    return dirname(require.resolve('swagger-ui-dist/package.json'));
  } catch {
    fail('未找到 swagger-ui-dist 依赖；请在 electron 目录执行 npm install 后重试（版本锁定见 package.json devDependencies）。');
  }
}

function readBundleFile(distRoot: string, fileName: string): string {
  try {
    return readFileSync(join(distRoot, fileName), 'utf8');
  } catch {
    fail(`swagger-ui-dist 缺少 ${fileName}，请确认依赖完整性（npm install）。`);
  }
}

function buildGeneratedModule(bundleJs: string, bundleCss: string, version: string): string {
  return `// 由 scripts/generate-http-swagger-ui.ts 从 swagger-ui-dist@${version} 确定性生成；禁止手工编辑。
// Swagger UI © SmartBear Software，Apache-2.0 许可（许可证见 swagger-ui-dist 包内 LICENSE.txt）。
// 消费方式：generateHttpServerDocsRuntime 转 C++ 字节集数组，HTTP_启用接口文档 注册为
// <前缀>/swagger-ui-bundle.js 与 <前缀>/swagger-ui.css 两条离线路由；页面模板在 httpServerRuntime.ts。
export const HTTP_SWAGGER_UI_VERSION = '${version}';
export const HTTP_SWAGGER_UI_BUNDLE_JS = ${JSON.stringify(bundleJs)};
export const HTTP_SWAGGER_UI_CSS = ${JSON.stringify(bundleCss)};
`;
}

function main(): void {
  const check = process.argv.includes('--check');
  const distRoot = resolveSwaggerUiDist();
  const manifest = JSON.parse(readFileSync(join(distRoot, 'package.json'), 'utf8')) as { version?: string };
  const version = manifest.version || 'unknown';
  const bundleJs = readBundleFile(distRoot, 'swagger-ui-bundle.js');
  const bundleCss = readBundleFile(distRoot, 'swagger-ui.css');
  if (!bundleJs.includes('SwaggerUIBundle')) fail('swagger-ui-bundle.js 缺少 SwaggerUIBundle 入口，请确认依赖完整性。');
  if (!bundleCss.includes('swagger-ui')) fail('swagger-ui.css 内容异常，请确认依赖完整性。');
  const generated = buildGeneratedModule(bundleJs, bundleCss, version);
  if (check) {
    const current = readFileSync(generatedPath, 'utf8');
    if (current !== generated) {
      fail('httpSwaggerUiInline.generated.ts 与 swagger-ui-dist 内容漂移；请执行 npm run http:swagger-ui 重新生成。');
    }
    console.log('[http:swagger-ui] check 通过：内嵌资源与 swagger-ui-dist 一致。');
    return;
  }
  writeFileSync(generatedPath, generated, 'utf8');
  console.log(`[http:swagger-ui] 已生成 ${generatedPath}（swagger-ui-dist@${version}，JS ${(Buffer.byteLength(bundleJs) / 1024).toFixed(0)} KB + CSS ${(Buffer.byteLength(bundleCss) / 1024).toFixed(0)} KB）。`);
}

void main();
