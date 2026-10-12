import type { components } from '../../../generated/openapi';
import { createItemRecord } from '../../../db/repositories/item.repository';

export const createItem = (input: components['schemas']['CreateItemRequest']) => createItemRecord({ name: input.name });
