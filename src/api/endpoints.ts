import express from 'express';
import { Pool } from 'pg';
import config from '../config';
import { createYoga } from 'graphql-yoga'
import { schema } from '../graphql/schema'

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  connectionTimeoutMillis: 2000,
});

// Get exchange rates
app.get('/exchangeRates', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const result = await pool.query(`
      SELECT 
        block_number as "blockTime",
        exchange_rate as rate,
        total_pool_stake_token as "totalStake",
        total_pool_liquid as "totalLiquid",
        timestamp
      FROM contract_states
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY block_number DESC
      LIMIT 1000
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Get rewards based on rate changes
app.get('/accrueRewards', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH rate_changes AS (
        SELECT
          block_number,
          exchange_rate,
          total_pool_liquid,
          timestamp,
          LAG(exchange_rate) OVER (ORDER BY block_number) as prev_rate
        FROM contract_states
        ORDER BY block_number DESC
        LIMIT 100
      )
      SELECT
        block_number::text as timestamp,
        CASE
          WHEN exchange_rate > prev_rate
          THEN ROUND((exchange_rate - prev_rate) * total_pool_liquid::numeric)::text
          ELSE '0'
        END as "userRewardAmount",
        '0' as "protocolRewardAmount",
        3 as "rewardType",
        true as "isExtended"
      FROM rate_changes
      WHERE prev_rate IS NOT NULL AND exchange_rate > prev_rate
      ORDER BY block_number DESC
    `);
    res.json({ accrueRewards: result.rows });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Daily aggregated data
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
      WHERE timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily data:', error);
    res.status(500).json({ error: 'Failed to fetch daily data' });
  }
});

// Current protocol state
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

// APY calculation
app.get('/apy', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH rate_data AS (
        SELECT
          exchange_rate,
          timestamp,
          LAG(exchange_rate, 144) OVER (ORDER BY block_number) as rate_24h_ago,
          LAG(exchange_rate, 1008) OVER (ORDER BY block_number) as rate_7d_ago,
          LAG(exchange_rate, 4320) OVER (ORDER BY block_number) as rate_30d_ago
        FROM contract_states
        WHERE timestamp > NOW() - INTERVAL '31 days'
        ORDER BY block_number DESC
        LIMIT 1
      )
      SELECT
        COALESCE(((exchange_rate / NULLIF(rate_24h_ago, 0) - 1) * 365 * 100), 0)::numeric(10,4) as apy_24h,
        COALESCE(((exchange_rate / NULLIF(rate_7d_ago, 0) - 1) * 52 * 100), 0)::numeric(10,4) as apy_7d,
        COALESCE(((exchange_rate / NULLIF(rate_30d_ago, 0) - 1) * 12 * 100), 0)::numeric(10,4) as apy_30d
      FROM rate_data
    `);
    res.json(result.rows[0] || { apy_24h: 0, apy_7d: 0, apy_30d: 0 });
  } catch (error) {
    console.error('Error calculating APY:', error);
    res.status(500).json({ error: 'Failed to calculate APY' });
  }
});

// MPC price endpoints
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
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MPC prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Current MPC price
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

// Combined stats with USD values
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
        usd: (Number(totalStaked) / 1e18 * currentPrice).toFixed(2)
      },
      liquid_supply: {
        tokens: totalLiquid.toString(),
        usd: (Number(totalLiquid) / 1e18 * currentPrice).toFixed(2)
      },
      exchange_rate: current.rows[0]?.exchange_rate,
      current_block: current.rows[0]?.block_number
    });
  } catch (error) {
    console.error('Error fetching combined stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// User list
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


// GraphQL
const yoga = createYoga({ 
  schema,
  graphiql: true,
  graphqlEndpoint: '/graphql'
})

app.use('/graphql', yoga)

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});


// API documentation
app.get('/api', (req, res) => {
 res.json({
   version: '1.0.0',
   endpoints: {
     rest: {
       '/stats': {
         method: 'GET',
         description: 'Current protocol state and deployment info',
         response: {
           deployment: { block: 'string', timestamp: 'ISO8601', initialRate: 'decimal' },
           current: { block: 'string', rate: 'decimal', totalStaked: 'bigint', totalLiquid: 'bigint' },
           metrics: { totalUsers: 'number' }
         }
       },
       '/exchangeRates': {
         method: 'GET',
         params: { hours: 'number (default: 24)' },
         description: 'Historical exchange rates',
         response: '[{ blockTime: string, rate: decimal, totalStake: bigint, totalLiquid: bigint, timestamp: ISO8601 }]'
       },
       '/accrueRewards': {
         method: 'GET',
         description: 'Reward events from rate changes',
         response: '{ accrueRewards: [{ timestamp: string, userRewardAmount: bigint, protocolRewardAmount: bigint }] }'
       },
       '/daily': {
         method: 'GET',
         params: { days: 'number (default: 30)' },
         description: 'Daily aggregated statistics',
         response: '[{ date: ISO8601, first_block: string, last_block: string, low_rate: decimal, high_rate: decimal }]'
       },
       '/apy': {
         method: 'GET',
         description: 'Calculated APY based on recent rates',
         response: '{ apy_24h: number, apy_7d: number, apy_30d: number }'
       },
       '/mpc/current': {
         method: 'GET',
         description: 'Current MPC token price',
         response: '{ timestamp: ISO8601, price_usd: decimal, market_cap_usd: decimal, volume_24h_usd: decimal }'
       },
       '/mpc/prices': {
         method: 'GET',
         params: { hours: 'number (default: 24)' },
         description: 'Historical MPC prices',
         response: '[{ time: ISO8601, price: decimal, market_cap: decimal, volume: decimal }]'
       },
       '/stats/combined': {
         method: 'GET',
         description: 'Combined protocol stats with USD values',
         response: '{ price: { mpc_usd: number }, tvl: { tokens: bigint, usd: string }, exchange_rate: decimal }'
       },
       '/users': {
         method: 'GET',
         description: 'Top 100 users by balance',
         response: '[{ address: string, balance: bigint, first_seen: ISO8601, last_seen: ISO8601 }]'
       }
     },
     graphql: {
       endpoint: '/graphql',
       playground: '/graphql',
       examples: [
         {
           name: 'Get current state',
           query: `query {
 currentState {
   blockNumber
   exchangeRate
   totalStaked
   totalLiquid
   tvlUsd
 }
}`
         },
         {
           name: 'Get filtered contract states',
           query: `query {
 contractStates(
   first: 10
   orderBy: RATE_DESC
   where: { exchangeRate_gt: 1.05 }
 ) {
   blockNumber
   exchangeRate
   timestamp
 }
}`
         },
         {
           name: 'Get exchange rates',
           query: `query {
 exchangeRate {
   mpcPrice
   exchangeRate
   smpcPrice
   premium
 }
}`
         },
         {
           name: 'Get price history',
           query: `query {
 priceHistory(hours: 24) {
   timestamp
   priceUsd
   marketCap
   volume
 }
}`
         }
       ]
     }
   },
   notes: {
     authentication: 'None required',
     rate_limit: 'None',
     data_format: 'All bigints returned as strings to preserve precision',
     timestamps: 'ISO 8601 format',
     decimals: 'Exchange rate has 10 decimal places, MPC amounts have 18 decimals'
   }
 });
});

const PORT = process.env.API_PORT || process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

// Indexing status endpoint
app.get('/status', async (req, res) => {
  try {
    const [current, latest] = await Promise.all([
      pool.query('SELECT MAX(block_number) as current FROM contract_states'),
      pool.query("SELECT CAST(EXTRACT(EPOCH FROM NOW()) * 10 AS BIGINT) as estimated_latest")
    ]);
    
    const currentBlock = parseInt(current.rows[0]?.current) || config.blockchain.deploymentBlock;
    const latestBlock = parseInt(latest.rows[0]?.estimated_latest) || currentBlock;
    const progress = ((currentBlock - config.blockchain.deploymentBlock) / (latestBlock - config.blockchain.deploymentBlock)) * 100;
    
    res.json({
      indexing: progress < 99.9,
      progress: progress.toFixed(2) + '%',
      currentBlock,
      latestBlock,
      blocksRemaining: latestBlock - currentBlock
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});
