import request from 'supertest';
import { createApp } from '../../src/app';
import { createItem } from '../../src/modules/items/services/create-item.service';
import { listItems } from '../../src/modules/items/services/list-items.service';
import { getItem } from '../../src/modules/items/services/get-item.service';

jest.mock('../../src/modules/items/services/create-item.service', () => ({ createItem: jest.fn() }));
jest.mock('../../src/modules/items/services/list-items.service', () => ({ listItems: jest.fn() }));
jest.mock('../../src/modules/items/services/get-item.service', () => ({ getItem: jest.fn() }));

const createItemMock = jest.mocked(createItem);
const listItemsMock = jest.mocked(listItems);
const getItemMock = jest.mocked(getItem);
const itemId = '6a63b219-5daa-492e-8f9d-48f5868c9512';
const app = createApp();

describe('items HTTP routes', () => {
  it('returns the shared response envelope for a created item', async () => {
    createItemMock.mockResolvedValue({
      id: itemId,
      name: 'Desk',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof createItem>>);

    const response = await request(app).post('/api/items').send({ name: 'Desk' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: itemId,
        name: 'Desk',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      message: 'Item created',
      toast: false,
      responseType: 'success',
    });
  });

  it('rejects invalid input before calling the service', async () => {
    const response = await request(app).post('/api/items').send({ name: '' });

    expect(response.status).toBe(422);
    expect(response.body.responseType).toBe('error');
    expect(createItemMock).not.toHaveBeenCalled();
  });

  it('lists items with the shared response envelope', async () => {
    listItemsMock.mockResolvedValue([]);

    const response = await request(app).get('/api/items');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('accepts a UUID item ID and rejects an invalid ID', async () => {
    getItemMock.mockResolvedValue({
      id: itemId,
      name: 'Desk',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof getItem>>);

    const valid = await request(app).get(`/api/items/${itemId}`);
    const invalid = await request(app).get('/api/items/123');

    expect(valid.status).toBe(200);
    expect(valid.body.data.id).toBe(itemId);
    expect(getItemMock).toHaveBeenCalledWith(itemId);
    expect(invalid.status).toBe(422);
    expect(getItemMock).toHaveBeenCalledTimes(1);
  });
});
