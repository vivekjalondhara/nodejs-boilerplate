import { HttpError } from '../../../common/http-error';
import { getItemRecord } from '../../../db/repositories/item.repository';

export async function getItem(id: string) {
  const item = await getItemRecord(id);
  if (!item) throw new HttpError(404, 'Item not found');
  return item;
}
