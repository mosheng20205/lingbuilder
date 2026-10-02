import { normalizeIdentifier, parseLingCpp } from '../lingCpp/parser';
import { getLingWindowSourceFilePath } from './windowDesignerService';

export interface WindowDesignerProjectShape {
  windows: Array<{ className: string; fileName: string; title?: string }>;
}

/**
 * 设计器窗口源码串写检测：文件是某设计器窗口的绑定源码、内容却声明了「另一个窗口」的类
 * 且未声明自己的类——即整文件被其它窗口源码覆盖的串写特征（lingbuilder-ui-project 实测：
 * MainWindow.lcpp 被写入 BrowserWindow 整文件内容，F5 构建前保存静默落盘后构建报类名重复）。
 * 返回中文串写描述；正常内容返回 null。
 *
 * 「文件本身是某窗口的绑定源码」是判串写的前提：早于 src/<窗口类名>.lcpp 约定创建的项目
 * （脚本注入、旧版 IDE）主源码可能叫 src/<项目名>.lcpp，内容声明窗口类完全合法——
 * 文件不是任何窗口的绑定源码时一律返回 null，不得按串写阻断保存
 * （DLL命令声明演示 项目实测：合法旧命名主源码在 F5 保存时被误判串写而永远无法落盘）。
 */
export function describeWindowSourceClobber(
  project: WindowDesignerProjectShape | undefined,
  sourceRoot: string,
  filePath: string,
  content: string
): string | null {
  if (!project || project.windows.length === 0) return null;
  const normalizedPath = filePath.replace(/\\/gu, '/').toLocaleLowerCase();
  const boundWindow = project.windows.find(win => (
    getLingWindowSourceFilePath(sourceRoot, win.fileName, win.className)
      .replace(/\\/gu, '/').toLocaleLowerCase() === normalizedPath
  ));
  if (!boundWindow) return null;
  const declaredClasses = parseLingCpp(content).program.classes.map(cls => normalizeIdentifier(cls.name));
  if (declaredClasses.includes(normalizeIdentifier(boundWindow.className))) return null;
  const windowByClassName = new Map(project.windows.map(win => [normalizeIdentifier(win.className), win]));
  const foreignWindow = declaredClasses.map(className => windowByClassName.get(className)).find(Boolean);
  if (!foreignWindow) return null;
  return `${filePath} 的内容是窗口「${foreignWindow.title || foreignWindow.className}」（类 ${foreignWindow.className}）的源码，而不是它绑定的窗口「${boundWindow.title || boundWindow.className}」`;
}
