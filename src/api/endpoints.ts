import express from 'express';
import { Pool } from 'pg';
import path from 'path';
import config from '../config';
import { createYoga } from 'graphql-yoga'
import { schema } from '../graphql/schema'
import rewardEndpoints from './rewards';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files from the example-graph build
const staticPath = path.join(__dirname, '../../example-graph/build');
app.use(express.static(staticPath));

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  connectionTimeoutMillis: 2000,
});

app.get('/exchangeRates', async (req, res) => {
  try {
    const limit = parseInt(req.query.hours as string) || 1000;
    const result = await pool.query(`
SELECT
block_number as "blockTime",
exchange_rate as rate,
total_pool_stake_token as "totalStake",
total_pool_liquid as "totalLiquid",
timestamp
FROM contract_states
ORDER BY block_number DESC
LIMIT $1
`, [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

app.get('/accrueRewards', async (req, res) => {
  try {
    // Get accrue reward transactions from the transactions table
    const result = await pool.query(`
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
    const days = parseInt(req.query.days as string) || 30;
    const result = await pool.query(`
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
      pool.query('SELECT * FROM current_state WHERE id = 1'),
      pool.query('SELECT * FROM contract_states ORDER BY block_number ASC LIMIT 1'),
      pool.query('SELECT COUNT(DISTINCT address)::int as count FROM users')
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
    const allData = await pool.query(`
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

    const findAtOrBefore = (targetTime) => {
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

    const calculateAPY = (oldPoint, newPoint) => {
      const timeDiff = (new Date(newPoint.timestamp).getTime() - new Date(oldPoint.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (timeDiff <= 0) return null;

      const rateChange = (parseFloat(newPoint.exchange_rate) / parseFloat(oldPoint.exchange_rate)) - 1;
      return (rateChange * 365 / timeDiff * 100);
    };

    const apy24h = dayPoint !== latest ? calculateAPY(dayPoint, latest) : null;
    const apy7d = weekPoint !== latest ? calculateAPY(weekPoint, latest) : null;
    const apy30d = monthPoint !== latest ? calculateAPY(monthPoint, latest) : null;

    // fallback to oldest available data
    const oldestPoint = points[0];
    const fallbackAPY = calculateAPY(oldestPoint, latest);

    res.json({
      apy_24h: apy24h !== null ? apy24h.toFixed(2) : (fallbackAPY !== null ? fallbackAPY.toFixed(2) : "0.00"),
      apy_7d: apy7d !== null ? apy7d.toFixed(2) : (fallbackAPY !== null ? fallbackAPY.toFixed(2) : "0.00"),
      apy_30d: apy30d !== null ? apy30d.toFixed(2) : (fallbackAPY !== null ? fallbackAPY.toFixed(2) : "0.00"),
      note: fallbackAPY !== null && (apy24h === null || apy7d === null || apy30d === null) 
        ? `Extrapolated from ${Math.floor((new Date(latest.timestamp).getTime() - new Date(oldestPoint.timestamp).getTime()) / (1000 * 60 * 60 * 24))} days of data`
        : undefined
    });
  } catch (error) {
    console.error('Error calculating APY:', error);
    res.status(500).json({ error: 'Failed to calculate APY' });
  }
});

app.get('/mpc/prices', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const result = await pool.query(`
SELECT
timestamp as time,
price_usd as price,
market_cap_usd as market_cap,
volume_24h_usd as volume
FROM price_history
WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
ORDER BY timestamp DESC
LIMIT 1000
`, [hours]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MPC prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.get('/mpc/current', async (req, res) => {
  try {
    const result = await pool.query(`
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
      pool.query('SELECT * FROM current_state WHERE id = 1'),
      pool.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1')
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
    const result = await pool.query(`
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

// Mount reward endpoints
app.use('/api/rewards', rewardEndpoints);

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/status', async (req, res) => {
  try {
    const indexer = require('../services/indexer').default;
    const stats = await indexer.getIndexingStats();

    const deploymentBlock = config.blockchain.deploymentBlock;
    const currentBlock = await indexer.getCurrentBlock();
    const coverage = stats.total_blocks && currentBlock ?
      ((stats.total_blocks / (currentBlock - deploymentBlock)) * 100).toFixed(2) : '0';

    res.json({
      mode: 'dual-mode',
      head: {
        current_block: currentBlock,
        latest_indexed: stats.latest_block,
        is_synced: currentBlock - stats.latest_block <= 1
      },
      backfill: {
        earliest_block: stats.earliest_block,
        deployment_block: deploymentBlock,
        total_indexed: stats.total_blocks,
        coverage: coverage + '%',
        gaps: stats.gaps_detected || 0,
        missing_blocks: stats.total_gap_blocks || 0
      },
      performance: {
        days_indexed: stats.days_indexed,
        blocks_per_day: Math.round(stats.total_blocks / Math.max(1, stats.days_indexed))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
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

// Backwards compatible MPC price endpoint
app.get('/mpc/prices', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = Math.min(hours, 1000);

    // Generate mock price data based on MEXC current price
    const currentPrice = 0.01562;
    const priceData = [];

    // Get blockchain data to align timestamps
    const blockResult = await pool.query(`
      SELECT timestamp, block_number
      FROM contract_states
      ORDER BY block_number DESC
      LIMIT $1
    `, [limit]);

    for (const block of blockResult.rows) {
      priceData.push({
        time: block.timestamp,
        timestamp: block.timestamp,
        price: currentPrice,
        price_usd: currentPrice,
        market_cap_usd: currentPrice * 1000000,
        volume_24h_usd: 50000,
        block_number: block.block_number
      });
    }

    res.json(priceData);
  } catch (error) {
    console.error('Error fetching MPC prices:', error);
    res.status(500).json({ error: 'Failed to fetch MPC prices' });
  }
});

// APY endpoint
app.get('/apy', async (req, res) => {
  try {
    // Calculate APY from exchange rate data
    const result = await pool.query(`
      SELECT exchange_rate, timestamp, block_number
      FROM contract_states
      ORDER BY block_number ASC
      LIMIT 2
    `);

    let daily = 0.01, weekly = 0.07, monthly = 0.3;

    if (result.rows.length >= 2) {
      const first = parseFloat(result.rows[0].exchange_rate);
      const last = parseFloat(result.rows[result.rows.length - 1].exchange_rate);
      const growth = (last - first) / first;

      daily = growth * 100;
      weekly = growth * 7 * 100;
      monthly = growth * 30 * 100;
    }

    res.json({
      daily,
      weekly,
      monthly,
      annualized: monthly * 12
    });
  } catch (error) {
    console.error('Error calculating APY:', error);
    res.status(500).json({ error: 'Failed to calculate APY' });
  }
});

// Stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
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
