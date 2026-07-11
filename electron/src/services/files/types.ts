export const TEXT_FILE_ENCODINGS = ['utf8', 'utf8bom', 'utf16le', 'utf16be'] as const;

export type TextFileEncoding = typeof TEXT_FILE_ENCODINGS[number];

export const TEXT_FILE_EOLS = ['lf', 'crlf'] as const;

export type TextFileEol = typeof TEXT_FILE_EOLS[number];

/**
 * `content` is normalized to LF for editor use. `format` retains the disk
 * representation that should be used when the caller saves without changing
 * the file format.
 */
export interface TextFileSnapshot {
  content: string;
  format: TextFileFormat;
  detectedEol: TextFileDetectedEol;
  hasFinalNewline: boolean;
}

export interface TextFileFormat {
  encoding: TextFileEncoding;
  eol: TextFileEol;
}

export type TextFileDetectedEol = TextFileEol | 'cr' | 'mixed' | 'none';

export interface TextFileEncodingDetection {
  encoding: TextFileEncoding;
  bomLength: number;
}

export type TextFileFormatErrorCode =
  | 'INVALID_BYTES'
  | 'INVALID_CONTENT'
  | 'INVALID_ENCODING'
  | 'INVALID_EOL'
  | 'INVALID_UTF8'
  | 'INVALID_UTF16'
  | 'UNSUPPORTED_ENCODING';

export class TextFileFormatError extends Error {
  constructor(
    readonly code: TextFileFormatErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TextFileFormatError';
  }
}
