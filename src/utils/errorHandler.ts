import logger from './logger';

export function handleError(error: unknown) {
  logger.error(error);
  // Potentially send this error to a monitoring service here.
}
