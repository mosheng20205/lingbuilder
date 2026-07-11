import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TextFileEncoding,
  TextFileFormatError,
  decodeTextFile,
  detectTextFileEncoding,
  detectTextFileEol,
  encodeTextFile,
  normalizeTextFileContent
} from '../src/services/files';

test('plain files without a BOM are decoded as strict UTF-8', () => {
  const source = '中文 IDE 🚀\n第二行';
  const snapshot = decodeTextFile(Buffer.from(source, 'utf8'));

  assert.equal(snapshot.content, source);
  assert.deepEqual(snapshot.format, { encoding: 'utf8', eol: 'lf' });
  assert.equal(snapshot.detectedEol, 'lf');
  assert.equal(snapshot.hasFinalNewline, false);
  assert.deepEqual(detectTextFileEncoding(Buffer.from(source, 'utf8')), {
    encoding: 'utf8',
    bomLength: 0
  });
});

test('UTF-8 BOM, UTF-16 LE and UTF-16 BE round-trip Chinese and emoji bytes', () => {
  const source = '窗口、按钮与 emoji 😀\n结束\n';
  const encodings: TextFileEncoding[] = ['utf8', 'utf8bom', 'utf16le', 'utf16be'];

  for (const encoding of encodings) {
    const bytes = encodeTextFile(source, { encoding, eol: 'lf' });
    const snapshot = decodeTextFile(bytes);
    assert.equal(snapshot.content, source, `${encoding} 内容往返`);
    assert.equal(snapshot.format.encoding, encoding, `${encoding} 编码识别`);
    assert.equal(snapshot.format.eol, 'lf');
    assert.equal(snapshot.hasFinalNewline, true);
    assert.deepEqual(encodeTextFile(snapshot.content, snapshot.format), bytes, `${encoding} 字节往返`);
  }
});

test('supported encoded output has deterministic BOM bytes', () => {
  assert.deepEqual([...encodeTextFile('A', { encoding: 'utf8', eol: 'lf' }).subarray(0, 1)], [0x41]);
  assert.deepEqual([...encodeTextFile('A', { encoding: 'utf8bom', eol: 'lf' }).subarray(0, 4)], [0xef, 0xbb, 0xbf, 0x41]);
  assert.deepEqual([...encodeTextFile('A', { encoding: 'utf16le', eol: 'lf' })], [0xff, 0xfe, 0x41, 0x00]);
  assert.deepEqual([...encodeTextFile('A', { encoding: 'utf16be', eol: 'lf' })], [0xfe, 0xff, 0x00, 0x41]);
});

test('LF, CRLF, legacy CR and mixed line endings are detected and normalized', () => {
  assert.equal(detectTextFileEol('无换行'), 'none');
  assert.equal(detectTextFileEol('a\nb\n'), 'lf');
  assert.equal(detectTextFileEol('a\r\nb\r\n'), 'crlf');
  assert.equal(detectTextFileEol('a\rb\r'), 'cr');
  assert.equal(detectTextFileEol('a\r\nb\nc\r'), 'mixed');
  assert.equal(normalizeTextFileContent('a\r\nb\nc\r'), 'a\nb\nc\n');

  const mixed = decodeTextFile(Buffer.from('a\r\nb\nc\r', 'utf8'));
  assert.equal(mixed.detectedEol, 'mixed');
  assert.equal(mixed.format.eol, 'lf');
  assert.equal(mixed.content, 'a\nb\nc\n');
  assert.equal(mixed.hasFinalNewline, true);
});

test('saving uses the requested LF or CRLF without changing final-newline presence', () => {
  const withFinalNewline = '第一行\n第二行\n';
  const withoutFinalNewline = '第一行\n第二行';

  const crlfWithFinal = encodeTextFile(withFinalNewline, { encoding: 'utf8', eol: 'crlf' });
  const crlfWithoutFinal = encodeTextFile(withoutFinalNewline, { encoding: 'utf8', eol: 'crlf' });
  assert.equal(crlfWithFinal.toString('utf8'), '第一行\r\n第二行\r\n');
  assert.equal(crlfWithoutFinal.toString('utf8'), '第一行\r\n第二行');
  assert.equal(decodeTextFile(crlfWithFinal).hasFinalNewline, true);
  assert.equal(decodeTextFile(crlfWithoutFinal).hasFinalNewline, false);

  const lf = encodeTextFile('第一行\r\n第二行\r\n', { encoding: 'utf8', eol: 'lf' });
  assert.equal(lf.toString('utf8'), withFinalNewline);
});

test('invalid BOM-less UTF-8 and malformed UTF-16 fail with Chinese diagnostics', () => {
  assert.throws(
    () => decodeTextFile(Buffer.from([0xc3, 0x28])),
    (error: unknown) => {
      assert.ok(error instanceof TextFileFormatError);
      assert.equal(error.code, 'INVALID_UTF8');
      assert.match(error.message, /不是合法.*UTF-8|内容损坏/u);
      return true;
    }
  );

  assert.throws(
    () => decodeTextFile(Buffer.from([0xff, 0xfe, 0x41])),
    (error: unknown) => {
      assert.ok(error instanceof TextFileFormatError);
      assert.equal(error.code, 'INVALID_UTF16');
      assert.match(error.message, /UTF-16.*字节数不完整/u);
      return true;
    }
  );
});

test('unsupported UTF-32 BOM and invalid save formats are rejected explicitly', () => {
  assert.throws(
    () => decodeTextFile(Buffer.from([0xff, 0xfe, 0x00, 0x00, 0x41, 0x00, 0x00, 0x00])),
    (error: unknown) => {
      assert.ok(error instanceof TextFileFormatError);
      assert.equal(error.code, 'UNSUPPORTED_ENCODING');
      assert.match(error.message, /不支持 UTF-32/u);
      return true;
    }
  );

  assert.throws(
    () => encodeTextFile('text', { encoding: 'gbk' as TextFileEncoding, eol: 'lf' }),
    (error: unknown) => error instanceof TextFileFormatError && error.code === 'INVALID_ENCODING'
  );
  assert.throws(
    () => encodeTextFile('text', { encoding: 'utf8', eol: 'cr' as 'lf' }),
    (error: unknown) => error instanceof TextFileFormatError && error.code === 'INVALID_EOL'
  );
});
