import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.') || '(body)',
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Multipart intake failures: oversized files, too many files, wrong field name.
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'One of those images is bigger than the allowance for a single file' },
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_IMAGE',
        message:
          err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
            ? 'Too many images in one upload. Select no more than four.'
            : 'That upload could not be read',
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_IDENTIFIER', message: `Invalid ${err.path} value` },
    });
    return;
  }

  // Duplicate key from a unique index (e.g. email or phoneNumber taken).
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '11000') {
    const fields = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {});
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_VALUE',
        message: fields.length ? `${fields.join(', ')} is already registered` : 'Duplicate value',
      },
    });
    return;
  }

  // Body parser failures: malformed JSON, oversized payloads, unsupported encodings.
  const bodyError = err as { type?: string; status?: number; statusCode?: number; message?: string };
  const clientStatus = bodyError.status ?? bodyError.statusCode;
  if (bodyError.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
    return;
  }
  if (bodyError.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
    return;
  }
  if (clientStatus !== undefined && clientStatus >= 400 && clientStatus < 500) {
    res.status(clientStatus).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: bodyError.message ?? 'Malformed request' },
    });
    return;
  }

  logger.error('Unhandled request error', err instanceof Error ? err.stack : err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side',
      ...(env.isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
  void next;
}
