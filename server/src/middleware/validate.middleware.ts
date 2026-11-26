import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { sanitizeObject } from '../utils/sanitize.js';

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const sanitized = sanitizeObject(req.body);
    const parsed = schema.safeParse(sanitized);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.query = parsed.data as Request['query'];
    next();
  };
}
