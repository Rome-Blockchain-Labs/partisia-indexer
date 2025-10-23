import { Router } from 'express';
import db from '../../db/client';

export function createRewardsRouter(): Router {
  const router = Router();

  // Get accrue reward transactions
  router.get('/accrue', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.query(
        `SELECT
          t.block_number,
          t.metadata,
          t.tx_hash,
          t.timestamp,
          cs.exchange_rate
        FROM transactions t
        LEFT JOIN contract_states cs ON cs.block_number = t.block_number
        WHERE t.action = 'accrueRewards'
        ORDER BY t.block_number DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const rewards = result.rows.map(row => {
        const metadata = row.metadata || {};
        const stakeTokenAmount = metadata.arguments?.stakeTokenAmount || null;

        return {
          txHash: row.tx_hash,
          blockNumber: parseInt(row.block_number),
          timestamp: row.timestamp,
          stakeTokenAmount: stakeTokenAmount,
          exchangeRate: row.exchange_rate || null,
          rewardType: 3,
          isExtended: true
        };
      });

      res.apiSuccess({
        rewards,
        count: rewards.length,
        hasMore: rewards.length === limit
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
