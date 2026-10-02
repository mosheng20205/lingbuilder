import { hasLingCppWindowClass } from './controlEventTargetFile';
import { getLingWindowSourceFilePath } from './windowDesignerService';

export interface LegacyWindowSourceCandidate {
  path: string;
  content: string;
}

export interface LegacyWindowSourceHit {
  /** 声明了该窗口类的旧命名主源码路径 */
  legacyPath: string;
  /** 窗口按 src/<窗口类名>.lcpp 约定的绑定路径 */
  conventionalPath: string;
}

/**
 * 设计器窗口按现行约定绑定 src/<窗口类名>.lcpp；早于该约定创建的项目（脚本注入、旧版 IDE）
 * 主源码可能叫 src/<项目名>.lcpp 之类。窗口绑定路径缺失时调用本函数区分两种情况：
 *
 * - 恰好一个「其它」源码文件声明了该窗口类 → 返回该旧命名文件，调用方应引导一键迁移
 *   （重命名到约定路径），禁止再合成同类模板——模板一旦保存落盘，与旧命名文件构成
 *   窗口类重复定义（DLL命令声明演示 项目实测）。
 * - 没有声明者（源码确实缺失，维持调用方既有的新建行为）或多于一个声明者（真重复，
 *   应由诊断而非静默迁移处理）→ 返回 null。
 */
export function findLegacyWindowSourceFile(
  candidates: readonly LegacyWindowSourceCandidate[],
  sourceRoot: string | undefined,
  window: { fileName?: string; className?: string }
): LegacyWindowSourceHit | null {
  const className = window.className?.trim();
  if (!className) return null;
  const conventionalPath = getLingWindowSourceFilePath(sourceRoot, window.fileName, window.className)
    .replace(/\\/gu, '/')
    .toLocaleLowerCase();
  // 绑定路径上已有声明该窗口类的源码（约定已满足）时无需迁移。
  const conventionalDeclared = candidates.some(candidate => (
    candidate.path.replace(/\\/gu, '/').toLocaleLowerCase() === conventionalPath
    && hasLingCppWindowClass(candidate.content, className)
  ));
  if (conventionalDeclared) return null;
  const declaring = candidates.filter(candidate => (
    candidate.path.replace(/\\/gu, '/').toLocaleLowerCase() !== conventionalPath
    && hasLingCppWindowClass(candidate.content, className)
  ));
  if (declaring.length !== 1) return null;
  return {
    legacyPath: declaring[0].path,
    conventionalPath: getLingWindowSourceFilePath(sourceRoot, window.fileName, window.className)
  };
}
