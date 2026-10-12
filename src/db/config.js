require('dotenv').config();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

module.exports = {
  url: process.env.DATABASE_URL,
  dialect: 'postgres',
};
