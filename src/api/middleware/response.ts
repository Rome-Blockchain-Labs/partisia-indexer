import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
    interface Response {
      apiSuccess<T>(data: T, statusCode?: number): void;
      apiError(code: string, message: string, statusCode?: number, details?: Record<string, unknown>): void;
    }
  }
}

const VERSION = require('../../../package.json').version;

export function responseMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.id = `req_${Date.now()}_${randomBytes(8).toString('hex')}`;

  res.apiSuccess = function<T>(data: T, statusCode = 200) {
    this.status(statusCode).json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        version: VERSION
      }
    });
  };

  res.apiError = function(code: string, message: string, statusCode = 500, details?: Record<string, unknown>) {
    this.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        ...(details && { details })
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        version: VERSION
      }
    });
  };

  next();
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', { error: err.message, stack: err.stack, requestId: req.id });

  res.apiError(
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
}
