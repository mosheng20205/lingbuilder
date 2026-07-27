import fs from 'node:fs/promises';
import path from 'node:path';

export interface GeneratedProjectTextFile {
  relativePath: string;
  content: string;
}

export async function writeGeneratedProjectFiles(
  targetDirectory: string,
  files: GeneratedProjectTextFile[]
): Promise<void> {
  const targetRoot = path.resolve(targetDirectory);
  await Promise.all(files.map(async file => {
    const targetPath = resolveGeneratedFilePath(targetRoot, file.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content, 'utf8');
  }));
}

function resolveGeneratedFilePath(targetRoot: string, relativePath: string): string {
  if (!relativePath.trim() || path.isAbsolute(relativePath)) {
    throw new Error(`生成文件路径不安全：${relativePath || '<空路径>'}`);
  }
  const targetPath = path.resolve(targetRoot, relativePath);
  const relativeTarget = path.relative(targetRoot, targetPath);
  if (relativeTarget === '' || relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
    throw new Error(`生成文件路径不安全：${relativePath}`);
  }
  return targetPath;
}
