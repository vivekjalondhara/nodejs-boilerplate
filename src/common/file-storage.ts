import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { HttpError } from './http-error';
import type { components } from '../generated/openapi';

export const FILE_TYPES: Record<string, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/gif': ['.gif'], 'image/webp': ['.webp'],
  'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/csv': ['.csv'], 'application/json': ['.json'],
  'application/zip': ['.zip'], 'application/msword': ['.doc'], 'application/vnd.ms-excel': ['.xls'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'audio/mpeg': ['.mp3'], 'audio/wav': ['.wav'], 'audio/ogg': ['.ogg'],
  'video/mp4': ['.mp4'], 'video/webm': ['.webm'], 'video/quicktime': ['.mov'], 'model/gltf-binary': ['.glb'],
};

export function validateFileType(name: string, contentType: string) {
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted filenames.
  if (!name || name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(name) || name.includes('..') ||
      !Object.prototype.hasOwnProperty.call(FILE_TYPES, contentType) || !FILE_TYPES[contentType].includes(extname(name).toLowerCase())) {
    throw new HttpError(422, 'Unsupported file type or invalid filename');
  }
}

export function validateAndSanitizeKey(key: string) {
  if (typeof key !== 'string' || !key || key.length > 1024 || key.includes('..') || key.includes('//') ||
      !/^[a-zA-Z0-9_./@()+ -]+$/.test(key) || !key.startsWith(env.filesKeyPrefix) || key.endsWith('/')) {
    throw new HttpError(422, 'Invalid file key or key outside this application');
  }
  return key;
}

export function setFileKeyForWasabi(originalname: string, folder = 'files') {
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) || folder.length > 255) {
    throw new HttpError(422, 'Invalid upload folder');
  }
  const name = originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return validateAndSanitizeKey(`${env.filesKeyPrefix}${folder}/${randomUUID()}_${name}`);
}

function storage(isPublic = false) {
  const bucket = isPublic ? env.wasabiPublicBucket : env.wasabiBucket;
  const region = isPublic ? env.wasabiPublicRegion : env.wasabiRegion;
  const accessKeyId = isPublic ? env.wasabiPublicAccessKeyId : env.wasabiAccessKeyId;
  const secretAccessKey = isPublic ? env.wasabiPublicSecretAccessKey : env.wasabiSecretAccessKey;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new HttpError(503, 'File storage is not configured');
  const client = new S3Client({
    endpoint: env.wasabiEndpoint || `https://s3.${region}.${env.wasabiUrl}`,
    region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true,
  });
  return { client, bucket };
}

export function getS3Config(isPublic = false) { return storage(isPublic).client; }

function expiry(seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 604800) throw new HttpError(422, 'Invalid URL expiry');
  return seconds;
}

export async function generatePresignedURL(data: { keyPath: string; expiresIn?: number }): Promise<components['schemas']['PresignedDownload']> {
  const key = validateAndSanitizeKey(data.keyPath);
  const expiresIn = expiry(data.expiresIn ?? 86400);
  const { client, bucket } = storage();
  try {
    const url = await getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket, Key: key, ResponseContentType: 'application/octet-stream', ResponseContentDisposition: 'attachment',
    }), { expiresIn });
    return { url, expiresIn };
  } finally { client.destroy(); }
}

export async function generateUploadPresignedURL(data: { keyPath: string; fileType: string; expiresIn?: number }) {
  const key = validateAndSanitizeKey(data.keyPath);
  validateFileType(key.split('/').at(-1) ?? '', data.fileType);
  const expiresIn = expiry(data.expiresIn ?? 10800);
  const { client, bucket } = storage();
  try {
    const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: data.fileType }),
      { expiresIn, signableHeaders: new Set(['content-type']) });
    return { url, expiresIn };
  } finally { client.destroy(); }
}

export async function uploadFileToWasabi(data: { key: string; body: Buffer; contentType: string }, isPublic = false) {
  const key = validateAndSanitizeKey(data.key);
  validateFileType(key.split('/').at(-1) ?? '', data.contentType);
  const { client, bucket } = storage(isPublic);
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data.body, ContentType: data.contentType }));
    return { key, bucket };
  } finally { client.destroy(); }
}

export async function fileUploadStreamData(data: { key: string; streamData: Readable | Buffer; contentType: string }) {
  const key = validateAndSanitizeKey(data.key);
  validateFileType(key.split('/').at(-1) ?? '', data.contentType);
  const { client, bucket } = storage();
  try {
    return await new Upload({ client, params: { Bucket: bucket, Key: key, Body: data.streamData, ContentType: data.contentType } }).done();
  } finally { client.destroy(); }
}

export async function getFileFromWasabi(keyPath: string) {
  const key = validateAndSanitizeKey(keyPath);
  const { client, bucket } = storage();
  // The caller must consume or destroy Body so its connection can be released.
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (result.Body instanceof Readable) {
      result.Body.once('close', () => client.destroy());
      result.Body.once('end', () => client.destroy());
      result.Body.once('error', () => client.destroy());
    } else client.destroy();
    return result;
  }
  catch (error) { client.destroy(); throw error; }
}

export async function deleteMultipleFilesFromWasabi(paths: string[], isPublic = false) {
  if (!paths.length) return;
  if (paths.length > 1000) throw new HttpError(422, 'Maximum 1000 keys per deletion');
  const keys = [...new Set(paths.map(validateAndSanitizeKey))];
  const { client, bucket } = storage(isPublic);
  try {
    const result = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })) } }));
    if (result.Errors?.length) throw new HttpError(502, 'Storage could not delete all requested files');
  } finally { client.destroy(); }
}

export async function deleteFileFromWasabi(key: string) { await deleteMultipleFilesFromWasabi([key]); }
export async function deletePublicFileFromWasabi(key: string) { await deleteMultipleFilesFromWasabi([key], true); }

export function generatePublicURL(data: { keyPath: string }) {
  const key = validateAndSanitizeKey(data.keyPath);
  if (!env.wasabiPublicBucket) throw new HttpError(503, 'Public file storage is not configured');
  const endpoint = env.wasabiEndpoint || `https://s3.${env.wasabiPublicRegion}.${env.wasabiUrl}`;
  return `${endpoint.replace(/\/$/, '')}/${env.wasabiPublicBucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
