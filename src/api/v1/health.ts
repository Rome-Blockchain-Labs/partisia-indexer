import { Router } from 'express';
import db from '../../db/client';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const dbCheck = await db.query('SELECT NOW() as time');
      const dbOk = !!dbCheck.rows[0];

      const indexer = require('../../indexer').default;
      const stats = await indexer.getStats();
      const indexerOk = stats.isHealthy;

      const status = dbOk && indexerOk ? 'healthy' : 'degraded';

      res.apiSuccess({
        status,
        checks: {
          database: dbOk ? 'ok' : 'error',
          indexer: indexerOk ? 'ok' : 'error'
        },
        uptime: process.uptime()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
