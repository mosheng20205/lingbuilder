/**
 * 模块例程（随 IDE 分发的 module-demos 演示工作区）渲染层服务。
 *
 * 数据口径：主进程枚举随包例程（模块 ID 列表），modulePublicInfo 据此在「示例」
 * 分组补一条可运行例程条目；打开动作经 IPC 复制例程到用户可写目录并在新 IDE
 * 进程中打开（独立 userData，不与当前实例竞争单实例锁）。
 * Web 版（无 window.lingBuilder 桥）隐藏入口，不报错。
 */

let cachedDemoModuleIds: ReadonlySet<string> | null = null;

export function isModuleDemoOpenSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.lingBuilder?.modules?.openDemo === 'function';
}

/** 随包例程模块 ID 集合；进程内缓存一次（安装目录内容升级才变化），失败返回空集。 */
export async function fetchBundledDemoModuleIds(): Promise<ReadonlySet<string>> {
  if (cachedDemoModuleIds) return cachedDemoModuleIds;
  const bridge = window.lingBuilder?.modules;
  if (!bridge?.listDemos) {
    cachedDemoModuleIds = new Set<string>();
    return cachedDemoModuleIds;
  }
  try {
    const result = await bridge.listDemos();
    cachedDemoModuleIds = new Set(result?.ok && Array.isArray(result.moduleIds) ? result.moduleIds : []);
  } catch {
    cachedDemoModuleIds = new Set<string>();
  }
  return cachedDemoModuleIds;
}

export async function openModuleDemoInNewInstance(
  moduleId: string
): Promise<{ ok: boolean; workspacePath?: string; error?: string }> {
  const bridge = window.lingBuilder?.modules;
  if (!bridge?.openDemo) return { ok: false, error: '当前环境不支持打开模块例程。' };
  try {
    return await bridge.openDemo(moduleId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
