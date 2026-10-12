import type { ErrorRequestHandler } from 'express';
import { generalResponse } from '../common/general-response';
import { HttpError } from '../common/http-error';
import { logger } from '../common/logger';

export const errorMiddleware: ErrorRequestHandler = (error: Error, req, res, next) => {
  if (res.headersSent) return next(error);

  const invalidJson = error instanceof SyntaxError && 'body' in error;
  const status = error instanceof HttpError ? error.status : invalidJson ? 400 : 500;
  const message = status === 500 ? 'Internal server error' : invalidJson ? 'Invalid JSON body' : error.message;

  if (status >= 500) logger.error('Request failed', { error: error.name, path: req.path, method: req.method });
  return generalResponse(res, null, message, 'error', false, status);
};
