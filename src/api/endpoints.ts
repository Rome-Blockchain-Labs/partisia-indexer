import express from 'express';
import path from 'path';
import config from '../config';
import { createYoga } from 'graphql-yoga'
import { schema } from '../graphql/schema'
import db from '../db/client';

const app = express();

// Security middleware
app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use('/api', express.json({ limit: '100kb' })); // Stricter limit for API

// Secure CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? config.api.corsOrigins
  : ['http://localhost:3000', 'http://localhost:3002'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  let isAllowed = false;

  if (origin) {
    // Check exact matches
    isAllowed = allowedOrigins.includes(origin);

    // Check pattern matches for production
    if (!isAllowed && process.env.NODE_ENV === 'production') {
      isAllowed = config.api.corsPatterns.some(pattern => pattern.test(origin));
    }
  }

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rate limiting (simple in-memory implementation)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const WINDOW_MS = 60 * 1000;

app.use((req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimit.has(key)) {
    rateLimit.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  const limit = rateLimit.get(key)!;
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + WINDOW_MS;
    return next();
  }

  if (limit.count >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  limit.count++;
  next();
});

// Input validation helper
function validateNumericInput(value: string | undefined, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid input: must be between ${min} and ${max}`);
  }
  return parsed;
}

// Safe error response helper
function handleError(error: unknown, res: express.Response, context: string): void {
  // Log full error for debugging
  console.error(`API Error [${context}]:`, error);

  // Only expose safe error messages to clients
  if (error instanceof Error && error.message.includes('Invalid input')) {
    res.status(400).json({ error: error.message });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Serve static files from the example-graph build (if available)
const staticPath = path.join(__dirname, '../../example-graph/build');
try {
  const fs = require('fs');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    console.log('✅ Serving frontend from', staticPath);
  } else {
    console.log('⚠️ Frontend build not found at', staticPath);
  }
} catch (error) {
  console.log('⚠️ Could not serve frontend:', (error as Error).message);
}

app.get('/exchangeRates', async (req, res) => {
  try {
    const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24); // 1 hour to 1 year

    // For charts, we want evenly distributed data points, not every single block
    let limit, interval;
    if (hours <= 24) {
      limit = 100; // 100 points for 24h
      interval = Math.max(1, Math.floor((hours * 3600) / 100));
    } else if (hours <= 168) { // 7 days
      limit = 200;
      interval = Math.max(1, Math.floor((hours * 3600) / 200));
    } else {
      limit = 500;
      interval = Math.max(1, Math.floor((hours * 3600) / 500));
    }

    const result = await db.query(`
WITH ranked_states AS (
  SELECT
    block_number as "blockTime",
    exchange_rate as rate,
    total_pool_stake_token as "totalStake",
    total_pool_liquid as "totalLiquid",
    timestamp,
    ROW_NUMBER() OVER (ORDER BY block_number DESC) as rn
  FROM contract_states
)
SELECT "blockTime", rate, "totalStake", "totalLiquid", timestamp
FROM ranked_states
WHERE rn % $1 = 0 OR rn = 1
ORDER BY "blockTime" ASC
LIMIT $2
`, [interval, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

app.get('/accrueRewards', async (req, res) => {
  try {
    // Get accrue reward transactions from the transactions table
    const result = await db.query(`
      SELECT
        block_number::text as timestamp,
        COALESCE((metadata->>'userRewards')::text, amount) as "userRewardAmount",
        COALESCE((metadata->>'protocolRewards')::text, '0') as "protocolRewardAmount",
        3 as "rewardType",
        true as "isExtended",
        metadata->>'exchangeRate' as "exchangeRate",
        tx_hash,
        timestamp as actual_timestamp
      FROM transactions
      WHERE action = 'accrueRewards'
      ORDER BY block_number DESC
      LIMIT 100
    `);

    res.json({ accrueRewards: result.rows });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

app.get('/daily', async (req, res) => {
  try {
    const days = validateNumericInput(req.query.days as string, 1, 365, 30); // 1 day to 1 year
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
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily data:', error);
    res.status(500).json({ error: 'Failed to fetch daily data' });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const [current, deployment, userCount] = await Promise.all([
      db.query('SELECT * FROM current_state WHERE id = 1'),
      db.query('SELECT * FROM contract_states ORDER BY block_number ASC LIMIT 1'),
      db.query('SELECT COUNT(DISTINCT address)::int as count FROM users')
    ]);

    res.json({
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
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/apy', async (req, res) => {
  try {
    // Check if indexer sync is complete first
    const indexer = require('../indexer').default;
    const stats = await indexer.getStats();

    if (!stats.syncComplete || !stats.canCalculateAPY) {
      return res.json({
        apy_24h: "0.00",
        apy_7d: "0.00",
        apy_30d: "0.00",
        note: `Sync incomplete: ${stats.progressPercent.toFixed(1)}% - APY calculation disabled`
      });
    }

    const allData = await db.query(`
SELECT exchange_rate, timestamp
FROM contract_states
ORDER BY timestamp ASC
`);

    if (allData.rows.length < 2) {
      return res.json({
        apy_24h: null,
        apy_7d: null,
        apy_30d: null,
        note: "Insufficient data for APY calculation"
      });
    }

    const now = new Date();
    const points = allData.rows;
    const latest = points[points.length - 1];

    // find closest historical points for precise apy calc
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

    res.json({
      apy_24h: apy24h !== null ? apy24h.toFixed(2) : "0.00",
      apy_7d: apy7d !== null ? apy7d.toFixed(2) : "0.00",
      apy_30d: apy30d !== null ? apy30d.toFixed(2) : "0.00"
    });
  } catch (error) {
    console.error('Error calculating APY:', error);
    res.status(500).json({ error: 'Failed to calculate APY' });
  }
});

// Debug endpoint
app.get('/mpc/test', (req, res) => {
  res.json({ message: 'Updated API working', timestamp: new Date().toISOString() });
});

app.get('/mpc/prices', async (req, res) => {
  try {
    const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24);
    const result = await db.query(`
SELECT
  block_number,
  exchange_rate,
  timestamp
FROM contract_states
WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1
ORDER BY timestamp DESC
LIMIT 1000
`, [hours]);

    // Fetch real blockchain timestamps using productionTime
    const priceData = [];
    for (const row of result.rows) {
      try {
        const blockResponse = await fetch(`${config.blockchain.apiUrl}/shards/${config.blockchain.shard}/blocks?blockTime=${row.block_number}`);
        if (blockResponse.ok) {
          const blockData = await blockResponse.json();
          priceData.push({
            time: new Date(blockData.productionTime).toISOString(),
            price: row.exchange_rate,
            market_cap: null,
            volume: null
          });
        }
      } catch (e) {
        // Fallback to database timestamp if blockchain API fails
        priceData.push({
          time: new Date(row.timestamp).toISOString(),
          price: row.exchange_rate,
          market_cap: null,
          volume: null
        });
      }
    }

    res.json(priceData);
  } catch (error) {
    console.error('Error fetching exchange rate data:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

app.get('/mpc/current', async (req, res) => {
  try {
    const result = await db.query(`
SELECT timestamp, price_usd, market_cap_usd, volume_24h_usd
FROM price_history
ORDER BY timestamp DESC
LIMIT 1
`);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No price data available' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ error: 'Failed to fetch current price' });
  }
});

app.get('/stats/combined', async (req, res) => {
  try {
    const [current, mpcPrice] = await Promise.all([
      db.query('SELECT * FROM current_state WHERE id = 1'),
      db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
    ]);

    const currentPrice = parseFloat(mpcPrice.rows[0]?.price_usd) || 0;
    const totalStaked = BigInt(current.rows[0]?.total_pool_stake_token || '0');
    const totalLiquid = BigInt(current.rows[0]?.total_pool_liquid || '0');

    res.json({
      price: {
        mpc_usd: currentPrice,
        timestamp: mpcPrice.rows[0]?.timestamp
      },
      tvl: {
        tokens: totalStaked.toString(),
        usd: (Number(totalStaked) / 1e6 * currentPrice).toFixed(2)
      },
      liquid_supply: {
        tokens: totalLiquid.toString(),
        usd: (Number(totalLiquid) / 1e6 * currentPrice).toFixed(2)
      },
      exchange_rate: current.rows[0]?.exchange_rate,
      current_block: current.rows[0]?.block_number
    });
  } catch (error) {
    console.error('Error fetching combined stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
SELECT address, balance, first_seen, last_seen
FROM users
ORDER BY CAST(balance AS NUMERIC) DESC
LIMIT 100
`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

const yoga = createYoga({ 
  schema,
  graphiql: true,
  graphqlEndpoint: '/graphql'
})

app.use('/graphql', yoga)


app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (error) {
    handleError(error, res, 'status');
  }
});

app.get('/status', async (req, res) => {
  try {
    const indexer = require('../indexer').default;
    const stats = await indexer.getStats();

    res.json({
      mode: 'unified-subgraph-style',
      sync: {
        complete: stats.syncComplete,
        canCalculateAPY: stats.canCalculateAPY,
        progress: `${stats.progressPercent.toFixed(1)}%`,
        lag: stats.lag
      },
      blocks: {
        current: stats.currentBlockHeight,
        latest: stats.latestBlock,
        total: stats.totalBlocks
      },
      health: {
        status: stats.isHealthy ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error) {
    handleError(error, res, 'status');
  }
});

// Simple stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const indexer = require('../indexer').default;
    const stats = await indexer.getStats();
    res.json(stats);
  } catch (error) {
    handleError(error, res, 'status');
  }
});

app.get('/api', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      rest: {
        '/stats': {
          method: 'GET',
          description: 'Current protocol state and deployment info'
        },
        '/exchangeRates': {
          method: 'GET',
          params: { hours: 'number (default: 24)' },
          description: 'Historical exchange rates'
        },
        '/status': {
          method: 'GET',
          description: 'Indexer sync status'
        }
      },
      graphql: {
        endpoint: '/graphql',
        playground: '/graphql'
      }
    }
  });
});


// Stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_blocks,
        MIN(block_number) as earliest_block,
        MAX(block_number) as latest_block,
        AVG(exchange_rate) as avg_exchange_rate,
        MAX(exchange_rate) as max_exchange_rate,
        MIN(exchange_rate) as min_exchange_rate,
        MAX(total_pool_stake_token) as total_staked,
        MAX(timestamp) as last_updated
      FROM contract_states
    `);

    const stats = result.rows[0];
    const currentPrice = 0.01562;
    const totalStaked = parseInt(stats.total_staked || '0');

    res.json({
      totalBlocks: parseInt(stats.total_blocks),
      latestBlock: parseInt(stats.latest_block),
      earliestBlock: parseInt(stats.earliest_block),
      avgExchangeRate: parseFloat(stats.avg_exchange_rate || '1'),
      maxExchangeRate: parseFloat(stats.max_exchange_rate || '1'),
      minExchangeRate: parseFloat(stats.min_exchange_rate || '1'),
      totalStaked: stats.total_staked,
      tvlUSD: (totalStaked / 1e6) * currentPrice,
      currentPrice: currentPrice,
      lastUpdated: stats.last_updated
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Catch-all route to serve React app for client-side routing
// Must be placed after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

export default app;
