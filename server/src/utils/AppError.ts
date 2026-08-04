export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: unknown;
  readonly code?: string;
  readonly isOperational: boolean;

  constructor(message: string, statusCode = 400, errors?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
