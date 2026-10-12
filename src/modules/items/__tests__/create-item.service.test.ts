import { createItem } from '../services/create-item.service';
import { createItemRecord } from '../../../db/repositories/item.repository';

jest.mock('../../../db/repositories/item.repository', () => ({
  createItemRecord: jest.fn(),
}));

const createItemRecordMock = jest.mocked(createItemRecord);

describe('createItem', () => {
  it('saves the validated name and returns the created record', async () => {
    const item = {
      id: '6a63b219-5daa-492e-8f9d-48f5868c9512',
      name: 'Desk',
    } as Awaited<ReturnType<typeof createItemRecord>>;
    createItemRecordMock.mockResolvedValue(item);

    await expect(createItem({ name: 'Desk' })).resolves.toBe(item);
    expect(createItemRecordMock).toHaveBeenCalledWith({ name: 'Desk' });
  });
});
