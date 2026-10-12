import type { components } from '../../generated/openapi';
import type { Item } from '../../db/models/item.model';

export function presentItem(item: Item): components['schemas']['Item'] {
  return {
    id: item.id,
    name: item.name,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}
