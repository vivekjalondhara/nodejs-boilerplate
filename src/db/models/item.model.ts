import 'reflect-metadata';
import { DataTypes } from 'sequelize';
import { Column, CreatedAt, Default, Model, Table, UpdatedAt } from 'sequelize-typescript';

@Table({ tableName: 'items', timestamps: true })
export class Item extends Model {
  @Default(DataTypes.UUIDV4)
  @Column({ type: DataTypes.UUID, primaryKey: true, allowNull: false })
  declare id: string;

  @Column({ type: DataTypes.STRING(255), allowNull: false })
  declare name: string;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
