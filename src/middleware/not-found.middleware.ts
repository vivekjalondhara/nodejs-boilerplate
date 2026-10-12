import type { RequestHandler } from 'express';
import { HttpError } from '../common/http-error';

export const notFoundMiddleware: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'Route not found'));
