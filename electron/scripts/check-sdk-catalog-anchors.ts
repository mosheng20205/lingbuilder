// SDK 清单发布门禁：拉取线上 SDK 下载清单，与 IDE 内置清单逐字比对锚定字段。
// 用法：npx tsx scripts/check-sdk-catalog-anchors.ts [--url <清单地址>]
// 默认按 LINGBUILDER_SDK_CATALOG_URL / LINGBUILDER_CLOUD_RELEASE_MODE 解析地址。
// 漂移或不可用时输出中文诊断并以退出码 1 结束，用于 CI / 发布前人工门禁。
import {
  compareCatalogAnchoredFields,
  resolveSdkCatalogEndpoint
} from '../src/services/sdkDependencies/sdkCatalogRemote';
import { SDK_DEPENDENCY_RESOURCES } from '../src/services/sdkDependencies/sdkDependencyCatalog';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const explicitUrl = urlIndex >= 0 ? String(args[urlIndex + 1] || '').trim() : '';
  const endpoint = explicitUrl ? { url: explicitUrl } : resolveSdkCatalogEndpoint(process.env);
  if (!endpoint) {
    console.error('SDK 清单门禁失败：未配置清单地址。请传 --url <清单地址>，或设置 LINGBUILDER_SDK_CATALOG_URL / LINGBUILDER_CLOUD_RELEASE_MODE=online。');
    process.exit(1);
  }
  console.log(`正在拉取线上清单：${endpoint.url}`);
  let payload: { sequence?: unknown; resources?: unknown };
  try {
    const response = await fetch(endpoint.url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json() as { manifest?: { payload?: string } };
    if (!value.manifest?.payload) throw new Error('响应缺少清单信封');
    payload = JSON.parse(value.manifest.payload) as { sequence?: unknown; resources?: unknown };
  } catch (reason) {
    console.error(`SDK 清单门禁失败：无法获取线上清单（${reason instanceof Error ? reason.message : String(reason)}）。请检查网络与云端发布状态；云端尚未发布清单时 IDE 会一直使用内置清单，此门禁不适用，可跳过。`);
    process.exit(1);
  }
  if (!Array.isArray(payload.resources)) {
    console.error('SDK 清单门禁失败：线上清单 resources 不是数组。');
    process.exit(1);
  }
  console.log(`线上 sequence ${String(payload.sequence)}，共 ${payload.resources.length} 条资源；正在与 IDE 内置清单逐字比对锚定字段…`);
  const drifts = compareCatalogAnchoredFields(SDK_DEPENDENCY_RESOURCES, payload.resources as Record<string, unknown>[]);
  if (drifts.length > 0) {
    console.error('SDK 清单门禁失败：线上清单与 IDE 内置清单的锚定字段不一致，IDE 会整条拒绝该清单并回退内置清单：');
    for (const drift of drifts) console.error(`- ${drift}`);
    console.error('处理方式：在管理后台修正线上清单的锚定字段（远端只允许更新版本与下载信息）；若锚定字段本身需要变更，必须先更新 IDE 内置清单并发版，再重新发布清单。');
    process.exit(1);
  }
  console.log('SDK 清单门禁通过：线上清单锚定字段与 IDE 内置清单逐字一致。');
}

void main();
