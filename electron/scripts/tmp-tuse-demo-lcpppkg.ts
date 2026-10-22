/** 导出 tuse-demo 的 .lcpppkg 源码包（与 IDE 文件→导出源码包同一服务）。 */
import path from 'node:path';
import { createLcppSourcePackageService, resolveProjectSourcePackagePath } from '../electron/lcppSourcePackageService';

async function main(): Promise<void> {
  const workspaceRoot = 'T:\\electron\\lingbuilder';
  const fallbackName = '图色识别演示.lcpppkg';
  const target = resolveProjectSourcePackagePath(workspaceRoot, path.join(workspaceRoot, 'exports', fallbackName), fallbackName);
  const result = await createLcppSourcePackageService(workspaceRoot).exportProject('tuse-demo', target, '0.8.30');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
