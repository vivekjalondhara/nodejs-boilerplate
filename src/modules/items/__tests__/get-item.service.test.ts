import { HttpError } from '../../../common/http-error';
import { getItemRecord } from '../../../db/repositories/item.repository';
import { getItem } from '../services/get-item.service';

jest.mock('../../../db/repositories/item.repository', () => ({
  getItemRecord: jest.fn(),
}));

const getItemRecordMock = jest.mocked(getItemRecord);
const itemId = '6a63b219-5daa-492e-8f9d-48f5868c9512';

it('returns 404 when the item does not exist', async () => {
  getItemRecordMock.mockResolvedValue(null);

  await expect(getItem(itemId)).rejects.toEqual(new HttpError(404, 'Item not found'));
  expect(getItemRecordMock).toHaveBeenCalledWith(itemId);
});
