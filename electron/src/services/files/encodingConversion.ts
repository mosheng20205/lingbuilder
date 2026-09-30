import { decodeTextFile, detectTextFileEol, encodeTextFile, resolveTextFileEol } from './textFileService';
import { TextFileFormatError } from './types';

export const LEGACY_TEXT_SOURCE_ENCODINGS = ['gbk', 'gb18030'] as const;

export type LegacyTextSourceEncoding = typeof LEGACY_TEXT_SOURCE_ENCODINGS[number];

export type LegacyEncodingConversionErrorCode =
  | 'ALREADY_READABLE'
  | 'DECODE_FAILED'
  | 'UNSUPPORTED_ENCODING';

export interface LegacyEncodingConversionResult {
  ok: boolean;
  bytes?: Buffer;
  code?: LegacyEncodingConversionErrorCode;
  message?: string;
}

const LEGACY_ENCODING_LABELS: Record<LegacyTextSourceEncoding, string> = {
  gbk: 'GBK',
  gb18030: 'GB18030'
};

/**
 * 把按旧代码页（中文 Windows 记事本/VS 默认 ANSI，即 GBK 家族）保存的文件字节
 * 确定性地转存为 UTF-8。只服务用户显式确认的单文件转存：已是合法 UTF-8/UTF-16
 * 的文件拒绝转换，避免二次转码损坏；换行符（CRLF/LF）原样保留。
 */
export function convertProjectFileBytesToUtf8(
  bytes: Uint8Array,
  sourceEncoding: LegacyTextSourceEncoding
): LegacyEncodingConversionResult {
  const label = LEGACY_ENCODING_LABELS[sourceEncoding] || sourceEncoding.toUpperCase();

  try {
    decodeTextFile(bytes);
    return {
      ok: false,
      code: 'ALREADY_READABLE',
      message: '文件已可按 UTF-8/UTF-16 正常读取，无需转存。'
    };
  } catch (error) {
    // UTF-32 等不支持的格式按原诊断透出，不冒充 GBK 解码失败。
    if (error instanceof TextFileFormatError && error.code === 'UNSUPPORTED_ENCODING') {
      return { ok: false, code: 'UNSUPPORTED_ENCODING', message: error.message };
    }
  }

  let content: string;
  try {
    content = new TextDecoder(sourceEncoding, { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      code: 'DECODE_FAILED',
      message: `文件无法按 ${label} 解码，可能不是该编码或包含损坏字节；未做任何修改。`
    };
  }

  return {
    ok: true,
    bytes: encodeTextFile(content, {
      encoding: 'utf8',
      eol: resolveTextFileEol(detectTextFileEol(content))
    })
  };
}
