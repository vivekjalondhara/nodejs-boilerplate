import Joi from 'joi';
import { validateAndSanitizeKey } from '../../../common/file-storage';

const keyPath = Joi.string().min(1).max(1024).custom((key: string, helpers) => {
  try { return validateAndSanitizeKey(key); }
  catch { return helpers.error('any.invalid'); }
});
const expiresIn = Joi.number().integer().min(1).max(604800);

export const fileReadSchema = Joi.object({ keyPath: keyPath.required(), expiresIn });
export const fileUploadPresignedSchema = Joi.object({
  keyPath: Joi.object({ name: Joi.string().min(1).max(255).required(), type: Joi.string().required() }).required(),
  expiresIn,
});
export const fileDeleteSchema = Joi.object({ keyPaths: Joi.array().items(keyPath.required()).min(1).max(1000).unique().required() });
export const fileUploadQuerySchema = Joi.object({
  folder_name: Joi.string().max(255).pattern(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/),
});
