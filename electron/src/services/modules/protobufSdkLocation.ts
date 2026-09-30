import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Protobuf SDK 根目录解析的唯一出口。
 *
 * 历史：SDK 曾在「打开工作区」时整份复制进 `<工作区>/.lingbuilder/toolchains/protobuf`
 * （约 154M、上万小文件），每个工作区都占一份 C 盘空间。2026-09-28 起改为构建/生成时
 * 按需解析：工作区自备副本仍然优先（用户自备/老工作区副本不受影响），缺失时直接只读
 * 使用 IDE 随包源，不再向工作区复制任何文件。
 */
export interface ProtobufSdkLocation {
  root: string;
  /**
   * configured=LINGBUILDER_PROTOBUF_SDK_ROOT 指定（不做存在性检查，保持既有语义）；
   * workspace=工作区自备副本；bundled=IDE 随包源（只读）；
   * workspace-missing=回退到工作区期望路径，随后由 SDK 校验给出中文阻断诊断。
   */
  origin: 'configured' | 'workspace' | 'bundled' | 'workspace-missing';
}

/** 模块镜像里的固定 SDK 相对布局；与打包 extraResources 的 default-workspace 同形。 */
const WORKSPACE_SDK_RELATIVE = path.join('.lingbuilder', 'toolchains', 'protobuf');
const WALK_UP_LIMIT = 8;

export async function resolveProtobufSdkLocation(searchFrom?: string): Promise<ProtobufSdkLocation> {
  const configured = process.env.LINGBUILDER_PROTOBUF_SDK_ROOT?.trim();
  if (configured) return { root: path.resolve(configured), origin: 'configured' };

  const workspaceCandidate = await findWorkspaceSdkCandidate(searchFrom);
  if (workspaceCandidate?.exists) return { root: workspaceCandidate.root, origin: 'workspace' };

  const bundled = await findBundledSdkRoot();
  if (bundled) return { root: bundled, origin: 'bundled' };

  if (workspaceCandidate) return { root: workspaceCandidate.root, origin: 'workspace-missing' };
  // 兜底维持旧版「buildDir 上推四层」的期望路径，让 SDK 校验产出与历史一致的中文诊断。
  const anchor = searchAnchor(searchFrom);
  return { root: path.resolve(anchor, '..', '..', '..', '..', WORKSPACE_SDK_RELATIVE), origin: 'workspace-missing' };
}

/** 自 searchFrom 逐层上找第一个含 `.lingbuilder` 的目录（即工作区根），返回其 SDK 期望路径。 */
async function findWorkspaceSdkCandidate(searchFrom?: string): Promise<{ root: string; exists: boolean } | undefined> {
  let current = searchFrom ? path.resolve(searchFrom) : undefined;
  if (!current) return undefined;
  for (let index = 0; index < WALK_UP_LIMIT; index += 1) {
    if (await directoryExists(path.join(current, '.lingbuilder'))) {
      const root = path.join(current, WORKSPACE_SDK_RELATIVE);
      return { root, exists: await directoryExists(root) };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

/**
 * IDE 随包 SDK 源：打包后在 `<resources>/default-workspace/.lingbuilder/toolchains/protobuf`，
 * 开发态在仓库 `electron/third_party/protobuf`。依次尝试：显式环境变量 →
 * LINGBUILDER_RESOURCE_ROOT 推导（主进程注入给本地服务与 Bridge 子进程）→
 * 从当前入口脚本位置向上走（独立 CLI 没有注入 env 时自救）。
 */
async function findBundledSdkRoot(): Promise<string | undefined> {
  const explicit = process.env.LINGBUILDER_BUNDLED_PROTOBUF_SDK?.trim();
  if (explicit && await directoryExists(explicit)) return path.resolve(explicit);

  const resourceRoot = process.env.LINGBUILDER_RESOURCE_ROOT?.trim();
  if (resourceRoot) {
    const candidates = [
      path.join(resourceRoot, 'default-workspace', WORKSPACE_SDK_RELATIVE),
      path.join(resourceRoot, 'third_party', 'protobuf')
    ];
    for (const candidate of candidates) {
      if (await directoryExists(candidate)) return path.resolve(candidate);
    }
  }

  const entry = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : undefined;
  if (entry) {
    let current = entry;
    for (let index = 0; index < WALK_UP_LIMIT; index += 1) {
      const candidates = [
        path.join(current, 'default-workspace', WORKSPACE_SDK_RELATIVE),
        path.join(current, 'third_party', 'protobuf')
      ];
      for (const candidate of candidates) {
        if (await directoryExists(candidate)) return path.resolve(candidate);
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return undefined;
}

function searchAnchor(searchFrom?: string): string {
  return searchFrom ? path.resolve(searchFrom) : path.resolve('.');
}

async function directoryExists(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isDirectory();
  } catch {
    return false;
  }
}
