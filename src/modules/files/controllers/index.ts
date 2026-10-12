import type { Request, Response, NextFunction } from 'express';
import { generalResponse } from '../../../common/general-response';
import { generatePresignedURL, generateUploadPresignedURL, setFileKeyForWasabi, validateFileType, deleteMultipleFilesFromWasabi } from '../../../common/file-storage';
import type { components } from '../../../generated/openapi';

export async function getPresignedUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await generatePresignedURL({ keyPath: String(req.query.keyPath),
      expiresIn: req.query.expiresIn === undefined ? undefined : Number(req.query.expiresIn) });
    return generalResponse(res, data, 'File URL generated');
  } catch (error) { return next(error); }
}

export async function getUploadPresignedUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body: components['schemas']['UploadPresignedRequest'] = req.body;
    validateFileType(body.keyPath.name, body.keyPath.type);
    const keyPath = setFileKeyForWasabi(body.keyPath.name, 'temp/uploads');
    const signed = await generateUploadPresignedURL({ keyPath, fileType: body.keyPath.type, expiresIn: body.expiresIn });
    const data: components['schemas']['PresignedUpload'] = { ...signed, keyPath, headers: { 'Content-Type': body.keyPath.type } };
    return generalResponse(res, data, 'File upload URL generated');
  } catch (error) { return next(error); }
}

export function uploadFile(req: Request, res: Response) {
  return generalResponse(res, req.uploadedFiles ?? [], 'Files uploaded');
}

export async function deleteFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const body: components['schemas']['DeleteFilesRequest'] = req.body;
    await deleteMultipleFilesFromWasabi(body.keyPaths);
    return generalResponse(res, { deleted: body.keyPaths }, 'Files deleted');
  } catch (error) { return next(error); }
}
