import { Router } from 'express';
import db from '../../db/client';

export function createTransactionsRouter(): Router {
  const router = Router();

  // Get recent transactions
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.query(
        `SELECT tx_hash, block_number, action, sender, amount, timestamp, metadata
         FROM transactions
         ORDER BY block_number DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.apiSuccess({
        transactions: result.rows,
        count: result.rows.length,
        hasMore: result.rows.length === limit
      });
    } catch (error) {
      next(error);
    }
  });

  // Get transaction by hash
  router.get('/:txHash', async (req, res, next) => {
    try {
      const { txHash } = req.params;

      const result = await db.query(
        `SELECT tx_hash, block_number, action, sender, amount, timestamp, metadata
         FROM transactions
         WHERE tx_hash = $1`,
        [txHash]
      );

      if (result.rows.length === 0) {
        return res.apiError(
          'TRANSACTION_NOT_FOUND',
          `Transaction ${txHash} not found`,
          404
        );
      }

      res.apiSuccess(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
