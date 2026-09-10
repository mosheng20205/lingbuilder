/**
 * 在浏览器里读取 .lcpppkg 源码包（zip）的文本内容，用于官网示例源码的在线预览。
 * 只支持 LingBuilder 导出的 zip 特性：无 zip64、无加密、store 或 deflate 压缩。
 * 解压使用浏览器原生 DecompressionStream('deflate-raw')，不引入第三方依赖。
 */

export interface DemoArchiveEntry {
  /** 条目路径（反斜杠已归一为正斜杠），例如 workspace/src/MainWindow.lcpp。 */
  name: string;
  data: Uint8Array;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const decompression = (globalThis as {
    DecompressionStream?: new (format: 'deflate-raw') => TransformStream<Uint8Array, Uint8Array>;
  }).DecompressionStream;
  if (!decompression) {
    throw new Error('当前浏览器不支持在线解压，请更新浏览器或直接下载源码包。');
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new decompression('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeEntryName(bytes: Uint8Array, flags: number): string {
  // 通用位标志 bit 11 置位时名称为 UTF-8；LingBuilder 打包（.NET ZipArchive）对含中文名的条目总会置位。
  const decoder = new TextDecoder((flags & 0x800) ? 'utf-8' : 'utf-8');
  return decoder.decode(bytes);
}

export async function readDemoArchive(buffer: ArrayBuffer): Promise<DemoArchiveEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('源码包不是有效的 zip 归档。');
  }
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('源码包目录解析失败。');
  const entryCount = view.getUint16(eocd + 10, true);
  if (entryCount === 0 || entryCount > 4096) throw new Error('源码包条目数量异常。');
  let cursor = view.getUint32(eocd + 16, true);
  const entries: DemoArchiveEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('源码包目录解析失败。');
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decodeEntryName(bytes.subarray(cursor + 46, cursor + 46 + nameLength), flags).replace(/\\/gu, '/');
    if (cursor + 46 + nameLength + extraLength + commentLength > bytes.length) {
      throw new Error('源码包目录解析失败。');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!compressedSize) {
      entries.push({ name, data: new Uint8Array(0) });
      continue;
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`源码包条目损坏：${name}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) {
      entries.push({ name, data: raw });
      continue;
    }
    if (method !== 8) {
      throw new Error(`源码包使用了不支持的压缩方式（${method}）。`);
    }
    entries.push({ name, data: await inflateRaw(raw) });
  }
  return entries;
}
