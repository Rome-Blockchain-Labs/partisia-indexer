import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to mark endpoints as deprecated
 * Adds a deprecation header and logs usage
 */
export function deprecateEndpoint(newEndpoint: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add deprecation header
    res.header('X-API-Deprecated', 'true');
    res.header('X-API-Replacement', newEndpoint);
    res.header('Deprecation', 'true');

    // Log deprecation usage
    console.warn(`[DEPRECATED] ${req.method} ${req.path} called. Use ${newEndpoint} instead.`);

    next();
  };
}

/**
 * Apply deprecation headers to response
 */
export function markDeprecated(res: Response, newEndpoint: string): void {
  res.header('X-API-Deprecated', 'true');
  res.header('X-API-Replacement', newEndpoint);
  res.header('Deprecation', 'true');
}
