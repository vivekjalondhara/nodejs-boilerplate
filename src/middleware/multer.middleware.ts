import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';
import type { RequestHandler } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { HttpError } from '../common/http-error';
import { logger } from '../common/logger';
import { deleteMultipleFilesFromWasabi, setFileKeyForWasabi, uploadFileToWasabi, validateFileType } from '../common/file-storage';
import type { components } from '../generated/openapi';

declare module 'express-serve-static-core' {
  interface Request { uploadedFiles?: components['schemas']['UploadedFile'][] }
}

async function prepareFile(file: Express.Multer.File) {
  const body = await readFile(file.path);
  if (!body.length) throw new HttpError(422, 'Empty files are not allowed');
  if (file.mimetype.startsWith('image/')) {
    try {
      const image = sharp(body, { animated: true, limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== file.mimetype) throw new Error('Image type mismatch');
      return await image.toBuffer();
    } catch { throw new HttpError(422, 'Invalid image file'); }
  }
  const prefix = body.subarray(0, 12);
  let valid = false;
  if (file.mimetype === 'application/pdf') valid = prefix.toString().startsWith('%PDF-');
  else if (file.mimetype === 'application/zip' || file.mimetype.includes('openxmlformats')) valid = prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]));
  else if (['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'].includes(file.mimetype)) valid = prefix.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11e1', 'hex'));
  else if (file.mimetype === 'audio/mpeg') valid = prefix.subarray(0, 3).toString() === 'ID3' || (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0);
  else if (file.mimetype === 'audio/wav') valid = prefix.subarray(0, 4).toString() === 'RIFF' && prefix.subarray(8).toString() === 'WAVE';
  else if (file.mimetype === 'audio/ogg') valid = prefix.subarray(0, 4).toString() === 'OggS';
  else if (file.mimetype === 'video/webm') valid = prefix.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'));
  else if (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') valid = ['ftyp', 'moov', 'mdat', 'wide'].includes(prefix.subarray(4, 8).toString());
  else if (file.mimetype === 'model/gltf-binary') valid = prefix.subarray(0, 4).toString() === 'glTF';
  else {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
      valid = !text.includes('\0');
      if (file.mimetype === 'application/json') JSON.parse(text);
    } catch { valid = false; }
  }
  if (!valid) throw new HttpError(422, 'File bytes do not match the declared type');
  return body;
}

export function fileUploadWasabi(fileSize = 25, isPublic = false): RequestHandler {
  return async (req, res, next) => {
    const uploaded: components['schemas']['UploadedFile'][] = [];
    let directory: string | undefined;
    let failure: Error | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), 'standalone-upload-'));
      const upload = multer({
        dest: directory,
        limits: { fileSize: fileSize * 1024 * 1024, files: 20, fields: 20, fieldSize: 1024 * 1024, parts: 40 },
        fileFilter: (_req, file, callback) => {
          try { validateFileType(file.originalname, file.mimetype); callback(null, true); }
          catch (error) { callback(error as Error); }
        },
      }).any();
      await new Promise<void>((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
      if (!Array.isArray(req.files) || !req.files.length) throw new HttpError(422, 'At least one file is required');
      for (const file of req.files) {
        const body = await prepareFile(file);
        const key = setFileKeyForWasabi(file.originalname, String(req.query.folder_name ?? 'files'));
        const stored = await uploadFileToWasabi({ key, body, contentType: file.mimetype }, isPublic);
        uploaded.push({ fieldname: file.fieldname, originalname: file.originalname, mimetype: file.mimetype,
          size: body.length, bucket: stored.bucket, key: stored.key, path: stored.key });
      }
    } catch (error) {
      if (uploaded.length) {
        try { await deleteMultipleFilesFromWasabi(uploaded.map(file => file.key), isPublic); }
        catch { logger.error('File batch rollback failed', { keys: uploaded.map(file => file.key) }); }
      }
      failure = error instanceof multer.MulterError
        ? new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422, error.message)
        : error instanceof Error ? error : new Error('File upload failed');
    } finally {
      if (directory) {
        try { await rm(directory, { recursive: true, force: true }); }
        catch { logger.error('Temporary upload cleanup failed'); }
      }
    }
    if (failure) return next(failure);
    req.uploadedFiles = uploaded;
    return next();
  };
}
