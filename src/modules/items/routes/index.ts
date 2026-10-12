import { Router } from 'express';
import { validationMiddleware } from '../../../middleware/validation.middleware';
import { createItemController, getItemController, listItemsController } from '../controllers';
import { createItemSchema, itemIdSchema } from '../validation-schema/item.schema';

export const itemsRouter = Router();

itemsRouter.get('/', listItemsController);
itemsRouter.post('/', validationMiddleware(createItemSchema), createItemController);
itemsRouter.get('/:id', validationMiddleware(itemIdSchema, 'params'), getItemController);
