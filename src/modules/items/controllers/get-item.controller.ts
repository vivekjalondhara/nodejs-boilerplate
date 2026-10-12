import type { Request, Response, NextFunction } from 'express';
import { generalResponse } from '../../../common/general-response';
import { presentItem } from '../item.presenter';
import { getItem } from '../services/get-item.service';

export async function getItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await getItem(req.params.id);
    return generalResponse(res, presentItem(item), 'Item retrieved');
  } catch (error) {
    return next(error);
  }
}
