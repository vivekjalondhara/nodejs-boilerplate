import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'info',
  silent: process.env.NODE_ENV === 'test',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});
