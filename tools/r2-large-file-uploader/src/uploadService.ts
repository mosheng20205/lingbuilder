export const PART_SIZE_BYTES = 32 * 1024 * 1024;
export const MAX_MULTIPART_PARTS = 10_000;
export const MAX_FILE_SIZE_BYTES = PART_SIZE_BYTES * MAX_MULTIPART_PARTS;

const LEGACY_MANIFEST_SUFFIX = '.lingbuilder-manifest.json';
const LEGACY_PARTS_SUFFIX = '.lingbuilder-parts';

export interface UploadInitInput {
  fileName: string;
  fileSize: number;
  contentType?: string;
}

export interface UploadPartReference {
  partNumber: number;
  etag: string;
}

export interface UploadSessionReference {
  key: string;
  uploadId: string;
}

export interface UploadCompleteInput extends UploadSessionReference {
  parts: UploadPartReference[];
}

export interface SegmentedObjectPart {
  key: string;
  size: number;
  etag: string;
}

export interface SegmentedObjectManifest {
  schemaVersion: 1;
  kind: 'lingbuilder-segmented-object';
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
  parts: SegmentedObjectPart[];
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function cleanFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return (normalized || 'file.bin').slice(0, 180);
}

export function assertManagedObjectKey(key: unknown): asserts key is string {
  if (
    typeof key !== 'string'
    || !key.startsWith('uploads/')
    || key.includes('..')
    || key.includes('\\')
    || key.length > 320
  ) {
    throw new RequestError('上传对象标识无效。');
  }
}

function assertUploadId(uploadId: unknown): asserts uploadId is string {
  if (typeof uploadId !== 'string' || uploadId.length < 1 || uploadId.length > 512) {
    throw new RequestError('Multipart Upload 会话标识无效。');
  }
}

export async function createUploadSession(
  bucket: R2Bucket,
  input: UploadInitInput,
) {
  if (!input || typeof input.fileName !== 'string' || !input.fileName.trim()) {
    throw new RequestError('请提供文件名。');
  }
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) {
    throw new RequestError('文件大小无效。');
  }
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    throw new RequestError('文件超过当前 Multipart 配置支持的最大大小。', 413);
  }

  const originalName = cleanFileName(input.fileName);
  const key = `uploads/${originalName}`;
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: {
      contentType: input.contentType?.slice(0, 200) || 'application/octet-stream',
    },
    customMetadata: {
      originalName,
      declaredSize: String(input.fileSize),
    },
  });

  return {
    key,
    uploadId: upload.uploadId,
    partSize: PART_SIZE_BYTES,
    partCount: Math.ceil(input.fileSize / PART_SIZE_BYTES),
  };
}

export async function uploadPart(
  bucket: R2Bucket,
  session: UploadSessionReference,
  partNumber: number,
  body: ReadableStream,
) {
  assertManagedObjectKey(session.key);
  assertUploadId(session.uploadId);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_MULTIPART_PARTS) {
    throw new RequestError('分片序号必须介于 1 和 10000 之间。');
  }

  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  const uploaded = await upload.uploadPart(partNumber, body);
  return { partNumber: uploaded.partNumber, etag: uploaded.etag };
}

function validateCompletedParts(parts: UploadPartReference[]): R2UploadedPart[] {
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_MULTIPART_PARTS) {
    throw new RequestError('完成上传时必须提供有效的分片列表。');
  }

  const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
  ordered.forEach((part, index) => {
    if (part.partNumber !== index + 1 || typeof part.etag !== 'string' || !part.etag) {
      throw new RequestError('分片列表不连续或 ETag 无效。');
    }
  });
  return ordered;
}

export async function completeUpload(bucket: R2Bucket, input: UploadCompleteInput) {
  assertManagedObjectKey(input.key);
  assertUploadId(input.uploadId);
  const upload = bucket.resumeMultipartUpload(input.key, input.uploadId);
  const object = await upload.complete(validateCompletedParts(input.parts));
  return {
    key: object.key,
    size: object.size,
    etag: object.etag,
  };
}

export async function abortUpload(bucket: R2Bucket, session: UploadSessionReference) {
  assertManagedObjectKey(session.key);
  assertUploadId(session.uploadId);
  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  await upload.abort();
}

export function segmentedManifestObjectKey(key: string): string {
  return `${key}${LEGACY_MANIFEST_SUFFIX}`;
}

export async function readSegmentedManifest(
  bucket: R2Bucket,
  key: string,
): Promise<{ manifest: SegmentedObjectManifest; object: R2ObjectBody } | null> {
  const object = await bucket.get(segmentedManifestObjectKey(key));
  if (!object) return null;

  let manifest: SegmentedObjectManifest;
  try {
    manifest = JSON.parse(await object.text()) as SegmentedObjectManifest;
  } catch {
    throw new RequestError('旧版 R2 文件清单已损坏。', 500);
  }
  if (
    manifest.schemaVersion !== 1
    || manifest.kind !== 'lingbuilder-segmented-object'
    || manifest.key !== key
    || !Number.isSafeInteger(manifest.size)
    || manifest.size <= 0
    || !Array.isArray(manifest.parts)
    || manifest.parts.length < 1
    || manifest.parts.some(part => (
      typeof part.key !== 'string'
      || !part.key.startsWith(`${key}${LEGACY_PARTS_SUFFIX}/`)
      || !Number.isSafeInteger(part.size)
      || part.size <= 0
      || typeof part.etag !== 'string'
      || !part.etag
    ))
    || manifest.parts.reduce((total, part) => total + part.size, 0) !== manifest.size
  ) {
    throw new RequestError('旧版 R2 文件清单内容无效。', 500);
  }
  return { manifest, object };
}

export function encodeObjectKey(key: string): string {
  return key.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

export function decodeObjectKey(pathname: string): string {
  try {
    const key = pathname
      .slice('/files/'.length)
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/');
    assertManagedObjectKey(key);
    return key;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('下载文件地址无效。');
  }
}

export function parseByteRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;

  if (!match[1]) {
    const requestedLength = Number(match[2]);
    if (!Number.isSafeInteger(requestedLength) || requestedLength <= 0) return null;
    const length = Math.min(requestedLength, size);
    return { offset: size - length, length };
  }

  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= size) return null;
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < offset) return null;
  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

export function selectManifestRangeParts(
  parts: SegmentedObjectPart[],
  range: { offset: number; length: number },
) {
  const rangeEnd = range.offset + range.length;
  let partStart = 0;
  const selected: Array<SegmentedObjectPart & { offset: number; length: number }> = [];

  for (const part of parts) {
    const partEnd = partStart + part.size;
    const overlapStart = Math.max(range.offset, partStart);
    const overlapEnd = Math.min(rangeEnd, partEnd);
    if (overlapStart < overlapEnd) {
      selected.push({
        ...part,
        offset: overlapStart - partStart,
        length: overlapEnd - overlapStart,
      });
    }
    partStart = partEnd;
    if (partStart >= rangeEnd) break;
  }
  return selected;
}
