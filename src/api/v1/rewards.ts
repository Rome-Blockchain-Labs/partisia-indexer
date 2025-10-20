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
          block_number,
          COALESCE((metadata->>'userRewards')::text, amount) as user_reward_amount,
          COALESCE((metadata->>'protocolRewards')::text, '0') as protocol_reward_amount,
          metadata->>'exchangeRate' as exchange_rate,
          tx_hash,
          timestamp
        FROM transactions
        WHERE action = 'accrueRewards'
        ORDER BY block_number DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const rewards = result.rows.map(row => ({
        blockNumber: parseInt(row.block_number),
        userRewardAmount: row.user_reward_amount,
        protocolRewardAmount: row.protocol_reward_amount,
        exchangeRate: row.exchange_rate,
        txHash: row.tx_hash,
        timestamp: row.timestamp,
        rewardType: 3,
        isExtended: true
      }));

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
