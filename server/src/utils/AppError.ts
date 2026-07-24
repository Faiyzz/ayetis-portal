export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: unknown;
  readonly isOperational: boolean;

  constructor(message: string, statusCode = 400, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
