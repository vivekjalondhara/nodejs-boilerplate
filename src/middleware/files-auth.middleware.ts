import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { HttpError } from '../common/http-error';

// Application-level server-to-server access; replace with user/tenant auth when the app gains it.
export const filesAuthMiddleware: RequestHandler = (req, _res, next) => {
  if (!env.filesApiKey) return next(new HttpError(503, 'File API access is not configured'));
  const supplied = Buffer.from(req.get('X-Files-API-Key') ?? '');
  const expected = Buffer.from(env.filesApiKey);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return next(new HttpError(401, 'Invalid file API key'));
  }
  return next();
};
