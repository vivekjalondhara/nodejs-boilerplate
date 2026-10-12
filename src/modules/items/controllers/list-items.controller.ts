import type { Request, Response, NextFunction } from 'express';
import { generalResponse } from '../../../common/general-response';
import { presentItem } from '../item.presenter';
import { listItems } from '../services/list-items.service';

export async function listItemsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listItems();
    return generalResponse(res, items.map(presentItem), 'Items retrieved');
  } catch (error) {
    return next(error);
  }
}
