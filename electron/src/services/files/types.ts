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

/**
 * 项目文件载入时单个文件读取/解码失败的问题记录。载入链路对这类文件是
 * 「跳过并继续」，不再让一个坏文件毒死整个项目的编辑能力。
 */
export interface ProjectFileReadProblem {
  /** 工作区相对路径（正斜杠分隔）。 */
  path: string;
  code: TextFileFormatErrorCode | 'READ_ERROR';
  message: string;
}
