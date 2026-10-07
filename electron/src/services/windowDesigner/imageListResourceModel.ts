/**
 * 图像列表资源路径口径（唯一实现）。
 *
 * 设计器输入框、构建期校验（validateDesignerResources）、C++ 生成（generateImageListSpecs）
 * 与运行期 ResolveRuntimeAssetPath 必须共用这一条归一化规则：去掉首尾空白与前导分隔符
 * （`\` 或 `/`），剩余部分按工作区内相对路径处理。
 *
 * 背景（2026-10-06）：用户在图像列表里填 `\assets\xxx.ico` 这类根相对路径，运行期把它当成
 * 绝对路径原样返回，图标静默加载失败且无任何诊断；三处口径此后统一为「剥掉前导分隔符」。
 * 盘符路径与 UNC 路径不属于本函数职责，仍由校验拒绝。
 */
export function normalizeImageListResourcePath(value: string): string {
  return String(value || '').trim().replace(/^[\\/]+/u, '');
}

/** 归一化整组图片路径：逐条归一化并去掉空行（空行原本就不会进入资源模型）。 */
export function normalizeImageListResourcePaths(images: readonly string[]): string[] {
  return images.map(image => normalizeImageListResourcePath(image)).filter(image => image.length > 0);
}
