import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});
