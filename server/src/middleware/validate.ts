import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/** Parses req.body and replaces it with the coerced/transformed result. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
