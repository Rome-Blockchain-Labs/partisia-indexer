import { Router } from 'express';
import db from '../../db/client';
import config from '../../config';
import { fromRawAmount } from '../../utils/denomination';

function validateNumericInput(value: string | undefined, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid input: must be between ${min} and ${max}`);
  }
  return parsed;
}

export function createAnalyticsRouter(): Router {
  const router = Router();

  // Get APY calculations
  router.get('/apy', async (req, res, next) => {
    try {
      // Check if indexer sync is complete first
      const indexer = require('../../indexer').default;
      const stats = await indexer.getStats();

      if (!stats.syncComplete || !stats.canCalculateAPY) {
        // null, not "0.00" - callers must be able to tell "unknown" from "no yield"
        return res.apiSuccess({
          apy24h: null,
          apy7d: null,
          apy30d: null,
          windows: null,
          syncComplete: false,
          progressPercent: stats.progressPercent.toFixed(1),
          note: `Sync incomplete: ${stats.progressPercent.toFixed(1)}% - APY calculation disabled`
        });
      }

      // an empty liquid pool or a fully buy-in-locked stake pool yields a
      // synthesized rate of 1.0 (see indexer buildContractState) - that is a
      // placeholder, not a measured rate, and must not anchor a window
      const MEASURABLE = `
        total_pool_liquid > 0
        AND total_pool_stake_token > COALESCE(amount_of_buy_in_locked_stake_tokens, 0)
      `;

      const latestResult = await db.query(`
        SELECT exchange_rate, timestamp, block_number
        FROM contract_states
        WHERE ${MEASURABLE}
        ORDER BY timestamp DESC, block_number DESC
        LIMIT 1
      `);
      const latest = latestResult.rows[0];

      if (!latest) {
        return res.apiSuccess({
          apy24h: null,
          apy7d: null,
          apy30d: null,
          windows: null,
          syncComplete: true,
          note: "Insufficient data for APY calculation"
        });
      }

      // windows anchor to the newest indexed state rather than wall clock, so a
      // lagging indexer shortens the window instead of collapsing it to null
      const latestTime = new Date(latest.timestamp);

      const calculateAPY = async (targetDays: number) => {
        const target = new Date(latestTime.getTime() - targetDays * 24 * 60 * 60 * 1000);

        // newest snapshot at or before the boundary, index-served rather than
        // scanned in JS - so actualDays >= targetDays by construction
        const prior = await db.query(`
          SELECT exchange_rate, timestamp, block_number
          FROM contract_states
          WHERE ${MEASURABLE} AND timestamp <= $1
          ORDER BY timestamp DESC, block_number DESC
          LIMIT 1
        `, [target]);

        const oldPoint = prior.rows[0];

        // history does not reach back this far - the window is unavailable, and
        // must not silently degrade into a since-inception figure
        if (!oldPoint || oldPoint.block_number === latest.block_number) return null;

        const actualDays = (latestTime.getTime() - new Date(oldPoint.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (actualDays <= 0) return null;

        const oldRate = parseFloat(oldPoint.exchange_rate);
        const newRate = parseFloat(latest.exchange_rate);
        if (!(oldRate > 0) || !(newRate > 0)) return null;

        const annualized = Math.pow(newRate / oldRate, 365 / actualDays);
        if (!Number.isFinite(annualized)) return null;

        return {
          apy: (annualized - 1) * 100,
          actualDays,
          fromBlock: Number(oldPoint.block_number),
          toBlock: Number(latest.block_number),
          // [r1, r2] - the two rates the figure is derived from, so clients can
          // show the working. Unix seconds, matching the rest of the v1 API.
          datapoints: [
            { timestamp: Math.floor(new Date(oldPoint.timestamp).getTime() / 1000), rate: String(oldPoint.exchange_rate) },
            { timestamp: Math.floor(latestTime.getTime() / 1000), rate: String(latest.exchange_rate) }
          ]
        };
      };

      const [w24h, w7d, w30d] = await Promise.all([
        calculateAPY(1),
        calculateAPY(7),
        calculateAPY(30)
      ]);

      res.apiSuccess({
        apy24h: w24h ? w24h.apy.toFixed(2) : null,
        apy7d: w7d ? w7d.apy.toFixed(2) : null,
        apy30d: w30d ? w30d.apy.toFixed(2) : null,
        // measured span backing each figure. r1 is the newest snapshot at or
        // before the boundary, so actualDays >= requestedDays - it overshoots
        // when snapshots are sparse around the boundary, never undershoots
        windows: {
          apy24h: w24h && { requestedDays: 1, actualDays: Number(w24h.actualDays.toFixed(4)), fromBlock: w24h.fromBlock, toBlock: w24h.toBlock, datapoints: w24h.datapoints },
          apy7d: w7d && { requestedDays: 7, actualDays: Number(w7d.actualDays.toFixed(4)), fromBlock: w7d.fromBlock, toBlock: w7d.toBlock, datapoints: w7d.datapoints },
          apy30d: w30d && { requestedDays: 30, actualDays: Number(w30d.actualDays.toFixed(4)), fromBlock: w30d.fromBlock, toBlock: w30d.toBlock, datapoints: w30d.datapoints }
        },
        latestTimestamp: latestTime.toISOString(),
        syncComplete: true
      });
    } catch (error) {
      next(error);
    }
  });

  // Get daily aggregated data
  router.get('/daily', async (req, res, next) => {
    try {
      const days = validateNumericInput(req.query.days as string, 1, 365, 30);

      const result = await db.query(`
        SELECT
          DATE_TRUNC('day', timestamp) as date,
          MIN(block_number) as first_block,
          MAX(block_number) as last_block,
          MIN(exchange_rate) as low_rate,
          MAX(exchange_rate) as high_rate,
          AVG(exchange_rate) as avg_rate,
          COUNT(*) as sample_count
        FROM contract_states
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY date DESC
      `, [days]);

      const dailyData = result.rows.map(row => ({
        date: row.date,
        firstBlock: parseInt(row.first_block.toString()),
        lastBlock: parseInt(row.last_block.toString()),
        lowRate: parseFloat(row.low_rate),
        highRate: parseFloat(row.high_rate),
        avgRate: parseFloat(row.avg_rate),
        sampleCount: parseInt(row.sample_count.toString())
      }));

      res.apiSuccess({
        dailyData,
        days,
        count: dailyData.length
      });
    } catch (error) {
      next(error);
    }
  });

  // Get protocol stats
  router.get('/stats', async (req, res, next) => {
    try {
      const [current, deployment, userCount] = await Promise.all([
        db.query('SELECT * FROM current_state WHERE id = 1'),
        db.query('SELECT * FROM contract_states ORDER BY block_number ASC LIMIT 1'),
        db.query('SELECT COUNT(DISTINCT address)::int as count FROM users')
      ]);

      res.apiSuccess({
        deployment: {
          block: deployment.rows[0]?.block_number || config.blockchain.deploymentBlock,
          timestamp: deployment.rows[0]?.timestamp,
          initialRate: deployment.rows[0]?.exchange_rate || '1.0'
        },
        current: {
          block: current.rows[0]?.block_number,
          rate: current.rows[0]?.exchange_rate,
          totalStaked: current.rows[0]?.total_pool_stake_token,
          totalLiquid: current.rows[0]?.total_pool_liquid,
          contractBalance: current.rows[0]?.stake_token_balance,
          timestamp: current.rows[0]?.timestamp
        },
        metrics: {
          totalUsers: userCount.rows[0]?.count || 0
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Get combined stats (with price data)
  router.get('/stats/combined', async (req, res, next) => {
    try {
      const [current, mpcPrice] = await Promise.all([
        db.query('SELECT * FROM current_state WHERE id = 1'),
        db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
      ]);

      const currentPrice = parseFloat(mpcPrice.rows[0]?.price_usd) || 0;
      const totalStaked = BigInt(current.rows[0]?.total_pool_stake_token || '0');
      const totalLiquid = BigInt(current.rows[0]?.total_pool_liquid || '0');

      // Convert raw amounts to human-readable (uses token_decimals from DB)
      const stakedMpc = await fromRawAmount(totalStaked);
      const liquidMpc = await fromRawAmount(totalLiquid);

      res.apiSuccess({
        price: {
          mpcUsd: currentPrice,
          timestamp: mpcPrice.rows[0]?.timestamp
        },
        tvl: {
          tokens: totalStaked.toString(),
          usd: (stakedMpc * currentPrice).toFixed(2)
        },
        liquidSupply: {
          tokens: totalLiquid.toString(),
          usd: (liquidMpc * currentPrice).toFixed(2)
        },
        exchangeRate: current.rows[0]?.exchange_rate,
        currentBlock: current.rows[0]?.block_number
      });
    } catch (error) {
      next(error);
    }
  });

  // Get exchange rate history
  router.get('/exchange-rates', async (req, res, next) => {
    try {
      const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24);

      const result = await db.query(
        `SELECT timestamp, exchange_rate
         FROM contract_states
         WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1
         ORDER BY timestamp DESC
         LIMIT 1000`,
        [hours]
      );

      const exchangeRates = result.rows.map(row => ({
        timestamp: row.timestamp.toISOString(),
        exchangeRate: parseFloat(row.exchange_rate)
      }));

      res.apiSuccess({
        exchangeRates,
        hours,
        count: exchangeRates.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
