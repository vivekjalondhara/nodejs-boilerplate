import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { env } from '../config/env';
import { models } from './models';

export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  models,
  logging: false,
});
