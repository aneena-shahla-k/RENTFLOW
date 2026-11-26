import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Mongoose duplicate key error
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  ) {
    res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists.',
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  // Mongoose cast / validation error
  if (err instanceof Error && err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier format.',
      code: 'INVALID_ID',
    });
    return;
  }

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err instanceof Error
        ? err.message
        : 'Unknown server error';

  if (env.NODE_ENV !== 'test') {
    console.error('[ErrorMiddleware]', err);
  }

  res.status(500).json({
    success: false,
    message,
    code: 'INTERNAL_ERROR',
  });
}
