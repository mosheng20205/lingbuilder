export type CompilerOutputValue = string | Buffer | Uint8Array | null | undefined;

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const windowsChineseDecoder = new TextDecoder('gb18030', { fatal: false });

/** 编译器输出先保留原始字节；UTF-8 无效时按中文 Windows 代码页解码。 */
export function decodeCompilerOutput(value: CompilerOutputValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.byteLength === 0) return '';
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    return windowsChineseDecoder.decode(bytes);
  }
}
