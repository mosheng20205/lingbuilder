import fs from 'node:fs';
import path from 'node:path';

import { SDK_DEPENDENCY_RESOURCES } from '../src/services/sdkDependencies/sdkDependencyCatalog';

export function buildSdkCatalogImportPayload(): string {
  // 云端契约 criticalFiles 是相对路径字符串数组；IDE 内置形态是 {relativePath, minimumBytes} 对象数组，
  // 导出时按远端契约转换，保证门禁「builtin relativePath 列表 vs 远端 criticalFiles」逐字一致。
  const resources = SDK_DEPENDENCY_RESOURCES.map(resource => ({
    ...resource,
    criticalFiles: resource.criticalFiles.map(file => file.relativePath)
  }));
  return JSON.stringify({ resources }, null, 2) + '\n';
}

function main(): void {
  const outputArg = process.argv[2];
  const target = path.resolve(outputArg || path.join(process.cwd(), '..', 'output', 'sdk-catalog-current.json'));
  const payload = buildSdkCatalogImportPayload();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, payload, 'utf8');
  const ids = SDK_DEPENDENCY_RESOURCES.map(resource => resource.id).join(', ');
  console.log(`已导出 IDE 内置 SDK 清单（${SDK_DEPENDENCY_RESOURCES.length} 项：${ids}）到 ${target}`);
  console.log('把文件内容完整粘贴到管理后台「SDK 下载源 → 准备下一版清单」的导入框，点「解析导入」后核对 diff 再发布。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? '')) {
  main();
}
