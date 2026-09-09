import type { ErrorHandler } from 'hono';
import { toErrorBody } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

export function createErrorHandler(
  logger: Logger,
  isProduction: boolean,
): ErrorHandler {
  return (error, c) => {
    const { status, body } = toErrorBody(error, {
      includeDetails: !isProduction,
    });

    if (status >= 500) {
      logger.error(
        {
          err: {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
          },
          path: c.req.path,
          method: c.req.method,
        },
        'Unhandled API error',
      );
    } else {
      logger.warn(
        {
          code: body.error.code,
          path: c.req.path,
          method: c.req.method,
          status,
        },
        'Handled API error',
      );
    }

    return c.json(body, status as 500);
  };
}
