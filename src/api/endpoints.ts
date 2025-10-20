import express from 'express';
import path from 'path';
import config from '../config';
import { createYoga } from 'graphql-yoga'
import { schema } from '../graphql/schema'
import db from '../db/client';

// Read version from package.json
const packageJson = require('../../package.json');
const VERSION = packageJson.version;

const app = express();

// Security middleware
app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use('/api', express.json({ limit: '100kb' })); // Stricter limit for API

// Disable CORS entirely
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
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
const RATE_LIMIT = 10000; // requests per minute (increased for testing)
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

// API-only server - no frontend serving

// Debug endpoint to check all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT tx_hash, block_number, action, sender, amount, timestamp
      FROM transactions
      ORDER BY block_number DESC
      LIMIT 50
    `);

    res.json({
      count: result.rowCount || 0,
      transactions: result.rows
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/accrueRewards', async (req, res) => {
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

app.get('/api/daily', async (req, res) => {
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

app.get('/api/stats', async (req, res) => {
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

// Indexing progress endpoint
app.get('/api/indexing-progress', async (req, res) => {
  try {
    // Get current state from database
    const currentState = await db.query('SELECT block_number FROM current_state WHERE id = 1');
    const currentBlock = parseInt(currentState.rows[0]?.block_number) || config.blockchain.deploymentBlock;

    // Get current blockchain height
    const response = await fetch(`${process.env.PARTISIA_API_URL || 'http://localhost:58081'}/chain/shards/Shard2/blocks`);
    const data = await response.json();
    const currentHeight = data.blockTime;

    // Get transaction indexer stats
    let txStats: any = {
      transactionsProcessed: 0,
      contractTxFound: 0,
      adminTxFound: 0,
      lastProcessedBlock: config.blockchain.deploymentBlock
    };
    try {
      const transactionIndexer = require('../transactionIndexer').default;
      txStats = transactionIndexer.getStats();
    } catch (e) {
      // Use default stats if transaction indexer is not available
    }

    // Calculate progress
    const totalBlocks = currentHeight - config.blockchain.deploymentBlock;
    const processedBlocks = currentBlock - config.blockchain.deploymentBlock;
    const progressPercent = Math.min(100, (processedBlocks / totalBlocks) * 100);

    res.json({
      stateIndexer: {
        currentBlock: currentBlock,
        targetBlock: currentHeight,
        blocksRemaining: Math.max(0, currentHeight - currentBlock),
        progressPercent: progressPercent,
        syncComplete: currentBlock >= currentHeight,
        blocksPerSecond: 0 // Will be calculated in future
      },
      transactionIndexer: {
        currentBlock: txStats.lastProcessedBlock || config.blockchain.deploymentBlock,
        targetBlock: currentHeight,
        blocksRemaining: Math.max(0, currentHeight - (txStats.lastProcessedBlock || config.blockchain.deploymentBlock)),
        progressPercent: Math.min(100, ((txStats.lastProcessedBlock || config.blockchain.deploymentBlock) - config.blockchain.deploymentBlock) / totalBlocks * 100),
        transactionsFound: txStats.transactionsProcessed || 0,
        contractTxFound: txStats.contractTxFound || 0,
        adminTxFound: txStats.adminTxFound || 0,
        blocksPerSecond: 0
      },
      overall: {
        progressPercent: progressPercent,
        syncComplete: currentBlock >= currentHeight,
        estimatedTimeRemaining: currentBlock >= currentHeight ? 'Complete' : 'Calculating...'
      }
    });
  } catch (error) {
    console.error('Error fetching indexing progress:', error);
    res.status(500).json({ error: 'Failed to fetch indexing progress' });
  }
});

app.get('/api/apy', async (req, res) => {
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
app.get('/api/mpc/test', (req, res) => {
  res.json({ message: 'Updated API working', timestamp: new Date().toISOString() });
});

app.get('/api/mpc/prices', async (req, res) => {
  try {
    const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24);
    const result = await db.query(`
      SELECT timestamp, price_usd, market_cap_usd, volume_24h_usd
      FROM price_history
      WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1
      ORDER BY timestamp DESC
      LIMIT 1000
    `, [hours]);

    const priceData = result.rows.map(row => ({
      timestamp: row.timestamp.toISOString(),
      price_usd: parseFloat(row.price_usd),
      market_cap_usd: row.market_cap_usd ? parseFloat(row.market_cap_usd) : null,
      volume_24h_usd: row.volume_24h_usd ? parseFloat(row.volume_24h_usd) : null
    }));

    res.json(priceData);
  } catch (error) {
    console.error('Error fetching price data:', error);
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
});

app.get('/api/mpc/current', async (req, res) => {
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

app.get('/api/current', async (req, res) => {
  try {
    const [state, price] = await Promise.all([
      db.query('SELECT * FROM current_state WHERE id = 1'),
      db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
    ]);

    const s = state.rows[0];
    const p = parseFloat(price.rows[0]?.price_usd) || 0;
    const staked = BigInt(s?.total_pool_stake_token || '0');
    const liquid = BigInt(s?.total_pool_liquid || '0');

    res.json({
      blockNumber: s?.block_number || '0',
      exchangeRate: s?.exchange_rate || '1.0',
      totalStaked: staked.toString(),
      totalLiquid: liquid.toString(),
      tvlUsd: (Number(staked) / 1e6 * p).toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching current state:', error);
    res.status(500).json({ error: 'Failed to fetch current state' });
  }
});

app.get('/api/stats/combined', async (req, res) => {
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

app.get('/api/users', async (req, res) => {
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

// Serve frontend static files
const frontendBuildPath = path.join(__dirname, '../../example-graph/build');
console.log(`✅ Serving frontend from ${frontendBuildPath}`);
app.use(express.static(frontendBuildPath));

app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now, version: VERSION });
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
app.get('/api/status', async (req, res) => {
  try {
    const indexer = require('../indexer').default;
    const stats = await indexer.getStats();
    res.json({
      ...stats,
      version: VERSION
    });
  } catch (error) {
    handleError(error, res, 'status');
  }
});

app.get('/api', (req, res) => {
  res.json({
    version: VERSION,
    endpoints: {
      rest: {
        '/api/status': {
          method: 'GET',
          description: 'Indexer sync status with performance metrics'
        },
        '/api/stats': {
          method: 'GET',
          description: 'Current protocol state and deployment info'
        },
        '/api/current': {
          method: 'GET',
          description: 'Current contract state with TVL'
        },
        '/api/exchangeRates': {
          method: 'GET',
          params: { hours: 'number (default: 24, max: 8760)' },
          description: 'Historical exchange rates'
        },
        '/api/apy': {
          method: 'GET',
          description: 'APY calculations (24h, 7d, 30d)'
        },
        '/api/users': {
          method: 'GET',
          description: 'Top 100 users by balance'
        },
        '/api/transactions': {
          method: 'GET',
          description: 'Recent 50 transactions'
        },
        '/api/accrueRewards': {
          method: 'GET',
          description: 'Accrue reward transactions'
        },
        '/api/mpc/current': {
          method: 'GET',
          description: 'Current MPC token price'
        },
        '/api/mpc/prices': {
          method: 'GET',
          params: { hours: 'number (default: 24, max: 8760)' },
          description: 'Historical MPC prices'
        },
        '/health': {
          method: 'GET',
          description: 'Health check endpoint'
        }
      },
      graphql: {
        endpoint: '/graphql',
        playground: '/graphql',
        description: 'GraphQL API with interactive playground',
        queries: {
          contractStates: 'Query contract state history with filters',
          users: 'Query user balances and activity',
          transactions: 'Query blockchain transactions with filters',
          rewards: 'Query reward transactions',
          currentState: 'Get current contract state with TVL',
          exchangeRate: 'Get exchange rate and price info',
          priceHistory: 'Get historical MPC prices',
          dailyRewardEstimate: 'Get daily reward estimates and APY'
        },
        features: [
          'Pagination (first, skip)',
          'Filtering (where clauses)',
          'Sorting (orderBy)',
          'Rich type system',
          'Interactive GraphiQL playground'
        ]
      }
    }
  });
});



// Root endpoint - Smart routing (SPA + API)
app.get('/', (req, res) => {
  // Check if request accepts HTML (browser request)
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Serve the frontend app
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  } else {
    // Return API info for JSON requests
    res.json({
      message: 'Partisia Blockchain Indexer API',
      endpoints: {
        frontend: '/ (React dashboard)',
        graphql: '/graphql',
        api_info: '/api',
        health: '/health'
      },
      note: 'Frontend dashboard served at root. Use GraphQL for data queries.',
      version: VERSION
    });
  }
});

// Exchange rates endpoint for chart data
app.get('/api/exchangeRates', async (req, res) => {
  try {
    const hours = validateNumericInput(req.query.hours as string, 1, 8760, 24);

    const result = await db.query(`
      SELECT timestamp, exchange_rate
      FROM contract_states
      WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1
      ORDER BY timestamp DESC
      LIMIT 1000
    `, [hours]);

    const exchangeRates = result.rows.map(row => ({
      timestamp: row.timestamp.toISOString(),
      exchangeRate: parseFloat(row.exchange_rate)
    }));

    res.json(exchangeRates);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

export default app;
