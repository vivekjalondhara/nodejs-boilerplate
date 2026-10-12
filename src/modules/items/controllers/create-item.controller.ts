import type { Request, Response, NextFunction } from 'express';
import { generalResponse } from '../../../common/general-response';
import { presentItem } from '../item.presenter';
import { createItem } from '../services/create-item.service';

export async function createItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await createItem(req.body);
    return generalResponse(res, presentItem(item), 'Item created', 'success', false, 201);
  } catch (error) {
    return next(error);
  }
}
