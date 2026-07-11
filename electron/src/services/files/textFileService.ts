import { TextDecoder } from 'node:util';

import {
  TEXT_FILE_ENCODINGS,
  TEXT_FILE_EOLS,
  TextFileDetectedEol,
  TextFileEncoding,
  TextFileEncodingDetection,
  TextFileEol,
  TextFileFormat,
  TextFileFormatError,
  TextFileSnapshot
} from './types';

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16_LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16_BE_BOM = Buffer.from([0xfe, 0xff]);

/**
 * Decodes a supported text file and normalizes its editor-facing content to LF.
 * Files without a BOM are deliberately interpreted only as strict UTF-8; no
 * platform code-page or UTF-16 heuristic is used.
 */
export function decodeTextFile(bytes: Uint8Array): TextFileSnapshot {
  const buffer = toBuffer(bytes);
  const detection = detectTextFileEncoding(buffer);
  const payload = buffer.subarray(detection.bomLength);
  const decoded = decodePayload(payload, detection.encoding);
  const detectedEol = detectTextFileEol(decoded);

  return {
    content: normalizeTextFileContent(decoded),
    format: {
      encoding: detection.encoding,
      eol: resolveTextFileEol(detectedEol)
    },
    detectedEol,
    hasFinalNewline: /(?:\r\n|\r|\n)$/u.test(decoded)
  };
}

/**
 * Encodes editor text using an explicit disk format. UTF-16 output always has
 * a BOM so it can be detected deterministically on the next read.
 */
export function encodeTextFile(content: string, format: TextFileFormat): Buffer {
  if (typeof content !== 'string') {
    throw new TextFileFormatError('INVALID_CONTENT', '文本文件内容必须是字符串。');
  }

  assertTextFileFormat(format);
  const normalized = normalizeTextFileContent(content);
  const diskContent = format.eol === 'crlf'
    ? normalized.replace(/\n/gu, '\r\n')
    : normalized;

  switch (format.encoding) {
    case 'utf8':
      return Buffer.from(diskContent, 'utf8');
    case 'utf8bom':
      return Buffer.concat([UTF8_BOM, Buffer.from(diskContent, 'utf8')]);
    case 'utf16le':
      return Buffer.concat([UTF16_LE_BOM, Buffer.from(diskContent, 'utf16le')]);
    case 'utf16be':
      return Buffer.concat([UTF16_BE_BOM, encodeUtf16Be(diskContent)]);
  }
}

export function detectTextFileEncoding(bytes: Uint8Array): TextFileEncodingDetection {
  const buffer = toBuffer(bytes);

  // UTF-32 LE starts with the UTF-16 LE prefix, so reject it before checking
  // supported BOMs instead of silently decoding it as corrupt UTF-16 text.
  if (
    startsWithBytes(buffer, [0xff, 0xfe, 0x00, 0x00])
    || startsWithBytes(buffer, [0x00, 0x00, 0xfe, 0xff])
  ) {
    throw new TextFileFormatError(
      'UNSUPPORTED_ENCODING',
      '当前不支持 UTF-32 文本文件，请先转换为 UTF-8 或 UTF-16。'
    );
  }

  if (startsWithBytes(buffer, UTF8_BOM)) {
    return { encoding: 'utf8bom', bomLength: UTF8_BOM.length };
  }
  if (startsWithBytes(buffer, UTF16_LE_BOM)) {
    return { encoding: 'utf16le', bomLength: UTF16_LE_BOM.length };
  }
  if (startsWithBytes(buffer, UTF16_BE_BOM)) {
    return { encoding: 'utf16be', bomLength: UTF16_BE_BOM.length };
  }
  return { encoding: 'utf8', bomLength: 0 };
}

export function detectTextFileEol(content: string): TextFileDetectedEol {
  if (typeof content !== 'string') {
    throw new TextFileFormatError('INVALID_CONTENT', '换行符检测内容必须是字符串。');
  }

  let crlfCount = 0;
  let lfCount = 0;
  let crCount = 0;

  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    if (code === 0x0d) {
      if (content.charCodeAt(index + 1) === 0x0a) {
        crlfCount += 1;
        index += 1;
      } else {
        crCount += 1;
      }
    } else if (code === 0x0a) {
      lfCount += 1;
    }
  }

  const detectedKinds = Number(crlfCount > 0) + Number(lfCount > 0) + Number(crCount > 0);
  if (detectedKinds === 0) return 'none';
  if (detectedKinds > 1) return 'mixed';
  if (crlfCount > 0) return 'crlf';
  if (lfCount > 0) return 'lf';
  return 'cr';
}

export function normalizeTextFileContent(content: string): string {
  if (typeof content !== 'string') {
    throw new TextFileFormatError('INVALID_CONTENT', '文本文件内容必须是字符串。');
  }
  return content.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

/** Mixed, legacy CR-only, and files without a newline use LF by default. */
export function resolveTextFileEol(detectedEol: TextFileDetectedEol): TextFileEol {
  return detectedEol === 'crlf' ? 'crlf' : 'lf';
}

function decodePayload(payload: Buffer, encoding: TextFileEncoding): string {
  try {
    switch (encoding) {
      case 'utf8':
      case 'utf8bom':
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(payload);
      case 'utf16le':
        assertEvenUtf16Length(payload);
        return new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true }).decode(payload);
      case 'utf16be':
        assertEvenUtf16Length(payload);
        return new TextDecoder('utf-16be', { fatal: true, ignoreBOM: true }).decode(payload);
    }
  } catch (error) {
    if (error instanceof TextFileFormatError) throw error;
    const code = encoding === 'utf8' || encoding === 'utf8bom' ? 'INVALID_UTF8' : 'INVALID_UTF16';
    const label = encoding === 'utf8' || encoding === 'utf8bom' ? 'UTF-8' : 'UTF-16';
    throw new TextFileFormatError(code, `文件不是合法的 ${label} 文本，已停止读取以避免内容损坏。`, { cause: error });
  }
}

function assertEvenUtf16Length(payload: Buffer): void {
  if (payload.length % 2 !== 0) {
    throw new TextFileFormatError(
      'INVALID_UTF16',
      '文件不是合法的 UTF-16 文本：字节数不完整。'
    );
  }
}

function encodeUtf16Be(content: string): Buffer {
  const littleEndian = Buffer.from(content, 'utf16le');
  const bigEndian = Buffer.allocUnsafe(littleEndian.length);
  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index] = littleEndian[index + 1];
    bigEndian[index + 1] = littleEndian[index];
  }
  return bigEndian;
}

function assertTextFileFormat(format: TextFileFormat): void {
  if (!format || typeof format !== 'object') {
    throw new TextFileFormatError('INVALID_CONTENT', '保存文本文件时必须指定编码和换行符。');
  }
  if (!TEXT_FILE_ENCODINGS.includes(format.encoding)) {
    throw new TextFileFormatError('INVALID_ENCODING', `不支持的文本编码：${String(format.encoding)}。`);
  }
  if (!TEXT_FILE_EOLS.includes(format.eol)) {
    throw new TextFileFormatError('INVALID_EOL', `不支持的换行符：${String(format.eol)}。`);
  }
}

function toBuffer(bytes: Uint8Array): Buffer {
  if (!(bytes instanceof Uint8Array)) {
    throw new TextFileFormatError('INVALID_BYTES', '文本文件数据必须是字节数组。');
  }
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function startsWithBytes(buffer: Buffer, prefix: Uint8Array | readonly number[]): boolean {
  if (buffer.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (buffer[index] !== prefix[index]) return false;
  }
  return true;
}
