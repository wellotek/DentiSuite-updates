export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export type ErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function toErrorBody(
  error: unknown,
  options: { includeDetails: boolean },
): { status: number; body: ErrorBody } {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(options.includeDetails && error.details !== undefined
            ? { details: error.details }
            : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
  };
}
