import { describe, expect, it, vi } from 'vitest';
import {
  PART_SIZE_BYTES,
  RequestError,
  completeUpload,
  createUploadSession,
  decodeObjectKey,
  encodeObjectKey,
  parseByteRange,
  segmentedManifestObjectKey,
  selectManifestRangeParts,
} from '../src/uploadService';

describe('R2 原生 Multipart 契约', () => {
  it('接受 580 MiB 文件并创建 19 个原生分片和一个最终对象 Key', async () => {
    const createMultipartUpload = vi.fn(async () => ({
      key: 'uploads/测试大文件.zip',
      uploadId: 'r2-native-upload-id',
    }));
    const bucket = { createMultipartUpload } as unknown as R2Bucket;

    const result = await createUploadSession(bucket, {
      fileName: '测试大文件.zip',
      fileSize: 580 * 1024 * 1024,
      contentType: 'application/zip',
    });

    expect(result.partSize).toBe(PART_SIZE_BYTES);
    expect(result.partCount).toBe(19);
    expect(result.key).toBe('uploads/测试大文件.zip');
    expect(result.uploadId).toBe('r2-native-upload-id');
    expect(createMultipartUpload).toHaveBeenCalledWith('uploads/测试大文件.zip', {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: {
        originalName: '测试大文件.zip',
        declaredSize: String(580 * 1024 * 1024),
      },
    });
  });

  it('完成 Multipart 后返回 R2 中的单一对象', async () => {
    const complete = vi.fn(async () => ({
      key: 'uploads/file.bin',
      size: 64 * 1024 * 1024,
      etag: 'complete-etag',
    }));
    const resumeMultipartUpload = vi.fn(() => ({ complete }));
    const bucket = { resumeMultipartUpload } as unknown as R2Bucket;

    await expect(completeUpload(bucket, {
      key: 'uploads/file.bin',
      uploadId: 'native-upload-id',
      parts: [
        { partNumber: 2, etag: 'etag-2' },
        { partNumber: 1, etag: 'etag-1' },
      ],
    })).resolves.toEqual({
      key: 'uploads/file.bin',
      size: 64 * 1024 * 1024,
      etag: 'complete-etag',
    });
    expect(complete).toHaveBeenCalledWith([
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
    ]);
  });

  it('下载路径对中文和空格可逆编码', () => {
    const key = 'uploads/2026-08-03/abc-我的 文件.zip';
    const encoded = encodeObjectKey(key);
    expect(encoded).toContain('%E6%88%91');
    expect(decodeObjectKey(`/files/${encoded}`)).toBe(key);
  });

  it('解析完整、开放结尾和后缀 Range', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ offset: 0, length: 100 });
    expect(parseByteRange('bytes=900-', 1000)).toEqual({ offset: 900, length: 100 });
    expect(parseByteRange('bytes=-50', 1000)).toEqual({ offset: 950, length: 50 });
    expect(parseByteRange('bytes=1000-', 1000)).toBeNull();
    expect(parseByteRange('bytes=1-2,4-5', 1000)).toBeNull();
  });

  it('把跨分段 Range 映射到对应 R2 对象', () => {
    const parts = [
      { key: 'part-1', size: 32, etag: 'etag-1' },
      { key: 'part-2', size: 32, etag: 'etag-2' },
      { key: 'part-3', size: 12, etag: 'etag-3' },
    ];
    expect(selectManifestRangeParts(parts, { offset: 24, length: 20 })).toEqual([
      { ...parts[0], offset: 24, length: 8 },
      { ...parts[1], offset: 0, length: 12 },
    ]);
  });

  it('保留旧清单对象键以兼容此前上传的数据', () => {
    const key = 'uploads/2026-08-03/abc-file.zip';
    expect(segmentedManifestObjectKey(key)).toBe(`${key}.lingbuilder-manifest.json`);
  });

  it('拒绝空文件和路径逃逸', async () => {
    const bucket = { createMultipartUpload: vi.fn() } as unknown as R2Bucket;
    await expect(createUploadSession(bucket, { fileName: 'empty.bin', fileSize: 0 }))
      .rejects.toBeInstanceOf(RequestError);
    expect(() => decodeObjectKey('/files/uploads/../secret.txt')).toThrow(RequestError);
  });
});
