import '../sequelize';
import { Item } from './item.model';

it('generates a UUID v4 primary key for a new item', () => {
  const item = Item.build({ name: 'Desk' });

  expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
