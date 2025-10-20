import { Router } from 'express';
import db from '../../db/client';

function validateNumericInput(value: string | undefined, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid input: must be between ${min} and ${max}`);
  }
  return parsed;
}

export function createPricesRouter(): Router {
  const router = Router();

  // Get current MPC price
  router.get('/current', async (req, res, next) => {
    try {
      const result = await db.query(`
        SELECT timestamp, price_usd, market_cap_usd, volume_24h_usd
        FROM price_history
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.apiError(
          'PRICE_NOT_FOUND',
          'No price data available',
          404
        );
      }

      const row = result.rows[0];
      res.apiSuccess({
        timestamp: row.timestamp,
        priceUsd: parseFloat(row.price_usd),
        marketCapUsd: row.market_cap_usd ? parseFloat(row.market_cap_usd) : null,
        volume24hUsd: row.volume_24h_usd ? parseFloat(row.volume_24h_usd) : null
      });
    } catch (error) {
      next(error);
    }
  });

  // Get historical MPC prices
  router.get('/history', async (req, res, next) => {
    try {
      const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24);

      const result = await db.query(
        `SELECT timestamp, price_usd, market_cap_usd, volume_24h_usd
         FROM price_history
         WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1
         ORDER BY timestamp DESC
         LIMIT 1000`,
        [hours]
      );

      const priceData = result.rows.map(row => ({
        timestamp: row.timestamp.toISOString(),
        priceUsd: parseFloat(row.price_usd),
        marketCapUsd: row.market_cap_usd ? parseFloat(row.market_cap_usd) : null,
        volume24hUsd: row.volume_24h_usd ? parseFloat(row.volume_24h_usd) : null
      }));

      res.apiSuccess({
        prices: priceData,
        hours,
        count: priceData.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
