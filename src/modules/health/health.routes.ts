import { Router } from 'express';
import { generalResponse } from '../../common/general-response';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => generalResponse(res, { status: 'ok' as const }, 'Service is healthy'));
