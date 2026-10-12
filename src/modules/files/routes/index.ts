import { Router } from 'express';
import { filesAuthMiddleware } from '../../../middleware/files-auth.middleware';
import { fileUploadWasabi } from '../../../middleware/multer.middleware';
import { validationMiddleware } from '../../../middleware/validation.middleware';
import { getPresignedUrl, getUploadPresignedUrl, uploadFile, deleteFiles } from '../controllers';
import { fileReadSchema, fileUploadPresignedSchema, fileDeleteSchema, fileUploadQuerySchema } from '../validation-schema/file.schema';

export const filesRouter = Router();
filesRouter.use(filesAuthMiddleware);
filesRouter.get('/', validationMiddleware(fileReadSchema, 'query'), getPresignedUrl);
filesRouter.post('/presigned-url', validationMiddleware(fileUploadPresignedSchema), getUploadPresignedUrl);
filesRouter.post('/upload', validationMiddleware(fileUploadQuerySchema, 'query'), fileUploadWasabi(25), uploadFile);
filesRouter.delete('/', validationMiddleware(fileDeleteSchema), deleteFiles);
