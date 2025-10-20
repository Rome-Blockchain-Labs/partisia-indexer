import { Router } from 'express';
import db from '../../db/client';
import config from '../../config';

export function createContractRouter(): Router {
  const router = Router();

  router.get('/current', async (req, res, next) => {
    try {
      const [state, price] = await Promise.all([
        db.query('SELECT * FROM current_state WHERE id = 1'),
        db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
      ]);

      const s = state.rows[0];

      if (!s) {
        return res.apiError(
          'STATE_NOT_FOUND',
          'No contract state available yet',
          404,
          { reason: 'Indexer still syncing', deploymentBlock: config.blockchain.deploymentBlock }
        );
      }

      const priceUsd = parseFloat(price.rows[0]?.price_usd) || 0;
      const staked = BigInt(s.total_pool_stake_token || '0');
      const liquid = BigInt(s.total_pool_liquid || '0');

      res.apiSuccess({
        blockNumber: parseInt(s.block_number),
        timestamp: s.timestamp,
        exchangeRate: parseFloat(s.exchange_rate),
        totalPoolStakeToken: staked.toString(),
        totalPoolLiquid: liquid.toString(),
        stakeTokenBalance: s.stake_token_balance,
        buyInPercentage: parseFloat(s.buy_in_percentage || '0'),
        buyInEnabled: !!s.buy_in_enabled,
        tvlUsd: (Number(staked) / 1e6 * priceUsd).toFixed(2)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/history', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.query(
        `SELECT block_number, timestamp, exchange_rate,
                total_pool_stake_token, total_pool_liquid,
                buy_in_percentage, buy_in_enabled
         FROM contract_states
         ORDER BY block_number DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const states = result.rows.map(row => ({
        blockNumber: parseInt(row.block_number),
        timestamp: row.timestamp,
        exchangeRate: parseFloat(row.exchange_rate),
        totalPoolStakeToken: row.total_pool_stake_token,
        totalPoolLiquid: row.total_pool_liquid,
        buyInPercentage: parseFloat(row.buy_in_percentage || '0'),
        buyInEnabled: !!row.buy_in_enabled
      }));

      res.apiSuccess({
        states,
        count: states.length,
        hasMore: states.length === limit
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
