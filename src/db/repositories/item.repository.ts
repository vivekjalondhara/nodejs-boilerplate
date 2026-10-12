import { Item } from '../models/item.model';

export const createItemRecord = (values: { name: string }): Promise<Item> => Item.create(values);

// ponytail: this sample returns 50 items; add cursor pagination when the feature needs a larger list.
export const listItemRecords = (): Promise<Item[]> => Item.findAll({ order: [['id', 'DESC']], limit: 50 });

export const getItemRecord = (id: string): Promise<Item | null> => Item.findByPk(id);
