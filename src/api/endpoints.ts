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
WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
ORDER BY block_number DESC
LIMIT 1000
`, [hours]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

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

    // db stores as quoted hex, convert to decimal
    const parseHexToBigInt = (hexStr) => {
      if (!hexStr || hexStr === '0') return BigInt(0);
      const cleanHex = hexStr.replace(/"/g, '');
      return BigInt('0x' + cleanHex);
    };

    const totalStaked = parseHexToBigInt(current.rows[0]?.total_pool_stake_token);
    const totalLiquid = parseHexToBigInt(current.rows[0]?.total_pool_liquid);

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
    const current = await pool.query('SELECT MAX(block_number) as current FROM contract_states');
    const currentBlock = parseInt(current.rows[0]?.current) || config.blockchain.deploymentBlock;
    const tipBlock = currentBlock + 1000;
    const progress = Math.min(100, ((currentBlock - config.blockchain.deploymentBlock) / (tipBlock - config.blockchain.deploymentBlock)) * 100);

    res.json({
      indexing: progress < 99.9,
      progress: progress.toFixed(2) + '%',
      currentBlock,
      latestBlock: tipBlock,
      blocksRemaining: Math.max(0, tipBlock - currentBlock)
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

export default app;
