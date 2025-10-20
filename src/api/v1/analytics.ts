import { Router } from 'express';
import db from '../../db/client';
import config from '../../config';

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
        return res.apiSuccess({
          apy24h: "0.00",
          apy7d: "0.00",
          apy30d: "0.00",
          syncComplete: false,
          progressPercent: stats.progressPercent.toFixed(1),
          note: `Sync incomplete: ${stats.progressPercent.toFixed(1)}% - APY calculation disabled`
        });
      }

      const allData = await db.query(`
        SELECT exchange_rate, timestamp
        FROM contract_states
        ORDER BY timestamp ASC
      `);

      if (allData.rows.length < 2) {
        return res.apiSuccess({
          apy24h: null,
          apy7d: null,
          apy30d: null,
          note: "Insufficient data for APY calculation"
        });
      }

      const now = new Date();
      const points = allData.rows;
      const latest = points[points.length - 1];

      // Find closest historical points for precise APY calc
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const findAtOrBefore = (targetTime: Date) => {
        let candidate = points[0];
        for (const p of points) {
          const t = new Date(p.timestamp);
          if (t <= targetTime) {
            candidate = p;
          } else {
            break;
          }
        }
        return candidate;
      };

      const dayPoint = findAtOrBefore(oneDayAgo);
      const weekPoint = findAtOrBefore(sevenDaysAgo);
      const monthPoint = findAtOrBefore(thirtyDaysAgo);

      const calculateAPY = (oldPoint: any, newPoint: any) => {
        const timeDiff = (new Date(newPoint.timestamp).getTime() - new Date(oldPoint.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (timeDiff <= 0) return null;

        const rateChange = parseFloat(newPoint.exchange_rate) / parseFloat(oldPoint.exchange_rate);
        const annualizedMultiplier = Math.pow(rateChange, 365 / timeDiff);
        return (annualizedMultiplier - 1) * 100;
      };

      const apy24h = dayPoint !== latest ? calculateAPY(dayPoint, latest) : null;
      const apy7d = weekPoint !== latest ? calculateAPY(weekPoint, latest) : null;
      const apy30d = monthPoint !== latest ? calculateAPY(monthPoint, latest) : null;

      res.apiSuccess({
        apy24h: apy24h !== null ? apy24h.toFixed(2) : "0.00",
        apy7d: apy7d !== null ? apy7d.toFixed(2) : "0.00",
        apy30d: apy30d !== null ? apy30d.toFixed(2) : "0.00",
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
        firstBlock: parseInt(row.first_block),
        lastBlock: parseInt(row.last_block),
        lowRate: parseFloat(row.low_rate),
        highRate: parseFloat(row.high_rate),
        avgRate: parseFloat(row.avg_rate),
        sampleCount: parseInt(row.sample_count)
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

      res.apiSuccess({
        price: {
          mpcUsd: currentPrice,
          timestamp: mpcPrice.rows[0]?.timestamp
        },
        tvl: {
          tokens: totalStaked.toString(),
          usd: (Number(totalStaked) / 1e6 * currentPrice).toFixed(2)
        },
        liquidSupply: {
          tokens: totalLiquid.toString(),
          usd: (Number(totalLiquid) / 1e6 * currentPrice).toFixed(2)
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
