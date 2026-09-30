import test from 'node:test';
import assert from 'node:assert/strict';

import { convertProjectFileBytesToUtf8 } from '../src/services/files/encodingConversion';
import { decodeTextFile } from '../src/services/files/textFileService';

// 「中文」的 GBK 编码字节（中=D6D0，文=CEC4）
const GBK_CHINESE = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

test('GBK 字节转存为 UTF-8 后可按严格 UTF-8 解码', () => {
  const result = convertProjectFileBytesToUtf8(GBK_CHINESE, 'gbk');
  assert.equal(result.ok, true);
  assert.ok(result.bytes);
  const snapshot = decodeTextFile(result.bytes!);
  assert.equal(snapshot.content, '中文');
  assert.equal(snapshot.format.encoding, 'utf8');
});

test('CRLF 换行在转存后原样保留', () => {
  const gbkCrlf = Buffer.concat([
    Buffer.from([0xd6, 0xd0, 0x0d, 0x0a]),
    Buffer.from([0xce, 0xc4, 0x0d, 0x0a])
  ]);
  const result = convertProjectFileBytesToUtf8(gbkCrlf, 'gbk');
  assert.equal(result.ok, true);
  const snapshot = decodeTextFile(result.bytes!);
  assert.equal(snapshot.content, '中\n文\n');
  assert.equal(snapshot.format.eol, 'crlf');
});

test('已是合法 UTF-8 的文件拒绝转存（防二次转码损坏）', () => {
  const result = convertProjectFileBytesToUtf8(Buffer.from('中文注释', 'utf8'), 'gbk');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ALREADY_READABLE');
  assert.equal(result.bytes, undefined);
});

test('带 BOM 的 UTF-16 文件已可读取，同样拒绝转存', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('中文', 'utf16le')]);
  const result = convertProjectFileBytesToUtf8(utf16, 'gbk');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ALREADY_READABLE');
});

test('非 GBK 字节解码失败时不产生输出字节（磁盘不动）', () => {
  const result = convertProjectFileBytesToUtf8(Buffer.from([0x81, 0x00, 0x82, 0x00]), 'gbk');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DECODE_FAILED');
  assert.equal(result.bytes, undefined);
});

test('GB18030 源编码同样支持', () => {
  const result = convertProjectFileBytesToUtf8(GBK_CHINESE, 'gb18030');
  assert.equal(result.ok, true);
  const snapshot = decodeTextFile(result.bytes!);
  assert.equal(snapshot.content, '中文');
});
