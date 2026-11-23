export interface ErrorDetail {
  path?: string;
  message: string;
}

/** An error reported to the caller with a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const validationError = (message: string, details: ErrorDetail[] = []): AppError =>
  new AppError(400, 'validation_error', message, details);
export const notFound = (what: string): AppError =>
  new AppError(404, 'not_found', `${what} was not found.`);
export const conflict = (code: string, message: string): AppError =>
  new AppError(409, code, message);

export interface ErrorBody {
  error: { code: string; message: string; details: ErrorDetail[] };
}

export const errorBody = (
  code: string,
  message: string,
  details: ErrorDetail[] = []
): ErrorBody => ({ error: { code, message, details } });
