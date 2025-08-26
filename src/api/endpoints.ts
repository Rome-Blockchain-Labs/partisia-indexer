import express from 'express';
import { Pool } from 'pg';
import config from '../config';

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
});

// Get exchange rates - combines historical and current
app.get('/api/exchangeRates', async (req, res) => {
 try {
   const result = await pool.query(`
     SELECT * FROM (
       SELECT 
         block_number as "blockTime",
         exchange_rate as rate,
         total_pool_stake_token as "totalStake",
         total_pool_liquid as "totalLiquid",
         timestamp
       FROM contract_states
       UNION ALL
       SELECT 
         block_number as "blockTime",
         exchange_rate as rate,
         total_pool_stake_token as "totalStake",
         total_pool_liquid as "totalLiquid",
         timestamp
       FROM current_state
     ) combined
     ORDER BY "blockTime" ASC
   `);
   
   res.json(result.rows);
 } catch (error) {
   console.error('Error fetching rates:', error);
   res.status(500).json({ error: 'Failed to fetch rates' });
 }
});

// Transform rate changes into reward events for frontend compatibility
app.get('/api/accrueRewards', async (req, res) => {
 try {
   const result = await pool.query(`
     WITH rate_changes AS (
       SELECT 
         block_number,
         exchange_rate,
         total_pool_liquid,
         timestamp,
         LAG(exchange_rate) OVER (ORDER BY block_number) as prev_rate
       FROM (
         SELECT * FROM contract_states
         UNION ALL
         SELECT block_number, timestamp, total_pool_stake_token, total_pool_liquid, 
                exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled 
         FROM current_state
       ) combined
       ORDER BY block_number
     )
     SELECT 
       block_number::text as timestamp,
       CASE 
         WHEN exchange_rate > prev_rate 
         THEN ROUND((exchange_rate - prev_rate) * total_pool_liquid::numeric * 1e18)::text
         ELSE '0'
       END as "userRewardAmount",
       '0' as "protocolRewardAmount",
       3 as "rewardType",
       true as "isExtended"
     FROM rate_changes
     WHERE prev_rate IS NOT NULL AND exchange_rate > prev_rate
     ORDER BY block_number DESC
     LIMIT 1000
   `);
   
   res.json({ accrueRewards: result.rows });
 } catch (error) {
   console.error('Error fetching rewards:', error);
   res.status(500).json({ error: 'Failed to fetch rewards' });
 }
});

// Daily aggregated data
app.get('/api/daily', async (req, res) => {
 try {
   const days = parseInt(req.query.days as string) || 30;
   
   const result = await pool.query(`
     WITH all_data AS (
       SELECT * FROM contract_states
       UNION ALL
       SELECT block_number, timestamp, total_pool_stake_token, total_pool_liquid, 
              exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled 
       FROM current_state
     ),
     daily_data AS (
       SELECT 
         DATE_TRUNC('day', timestamp) as date,
         MIN(block_number) as first_block,
         MAX(block_number) as last_block,
         FIRST_VALUE(exchange_rate) OVER (
           PARTITION BY DATE_TRUNC('day', timestamp) 
           ORDER BY block_number
         ) as open_rate,
         LAST_VALUE(exchange_rate) OVER (
           PARTITION BY DATE_TRUNC('day', timestamp) 
           ORDER BY block_number
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
         ) as close_rate,
         MIN(exchange_rate) as low_rate,
         MAX(exchange_rate) as high_rate,
         COUNT(*) as sample_count
       FROM all_data
       WHERE timestamp > NOW() - INTERVAL '${days} days'
       GROUP BY DATE_TRUNC('day', timestamp), block_number, exchange_rate
     )
     SELECT DISTINCT
       date,
       first_block,
       last_block,
       open_rate,
       close_rate,
       low_rate,
       high_rate,
       ROUND((close_rate - open_rate) * 29200000)::bigint as daily_rewards,
       sample_count
     FROM daily_data
     ORDER BY date DESC
   `);
   
   res.json(result.rows);
 } catch (error) {
   console.error('Error fetching daily data:', error);
   res.status(500).json({ error: 'Failed to fetch daily data' });
 }
});

// Current protocol state
app.get('/api/stats', async (req, res) => {
 try {
   const current = await pool.query('SELECT * FROM current_state WHERE id = 1');
   const deployment = await pool.query('SELECT * FROM contract_states ORDER BY block_number ASC LIMIT 1');
   const totalRewards = await pool.query('SELECT COALESCE(SUM(amount), 0)::text as total FROM protocol_rewards');
   const userCount = await pool.query('SELECT COUNT(*)::int as count FROM users');
   
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
       totalRewards: totalRewards.rows[0]?.total || '0',
       totalUsers: userCount.rows[0]?.count || 0
     }
   });
 } catch (error) {
   console.error('Error fetching stats:', error);
   res.status(500).json({ error: 'Failed to fetch stats' });
 }
});

// APY calculation
app.get('/api/apy', async (req, res) => {
 try {
   const result = await pool.query(`
     WITH all_rates AS (
       SELECT block_number, exchange_rate, timestamp FROM contract_states
       UNION ALL
       SELECT block_number, exchange_rate, timestamp FROM current_state
       ORDER BY block_number DESC
     ),
     rate_periods AS (
       SELECT 
         exchange_rate as current_rate,
         LAG(exchange_rate, 144) OVER (ORDER BY block_number) as rate_24h_ago,
         LAG(exchange_rate, 1008) OVER (ORDER BY block_number) as rate_7d_ago,
         LAG(exchange_rate, 4320) OVER (ORDER BY block_number) as rate_30d_ago,
         timestamp
       FROM all_rates
       LIMIT 4320
     )
     SELECT 
       CASE 
         WHEN rate_24h_ago > 0 
         THEN ((current_rate / rate_24h_ago - 1) * 365 * 100)::numeric(10,4)
         ELSE 0 
       END as apy_24h,
       CASE 
         WHEN rate_7d_ago > 0 
         THEN ((current_rate / rate_7d_ago - 1) * 52 * 100)::numeric(10,4)
         ELSE 0 
       END as apy_7d,
       CASE 
         WHEN rate_30d_ago > 0 
         THEN ((current_rate / rate_30d_ago - 1) * 12 * 100)::numeric(10,4)
         ELSE 0 
       END as apy_30d
     FROM rate_periods
     WHERE rate_24h_ago IS NOT NULL
     LIMIT 1
   `);
   
   res.json(result.rows[0] || { apy_24h: 0, apy_7d: 0, apy_30d: 0 });
 } catch (error) {
   console.error('Error calculating APY:', error);
   res.status(500).json({ error: 'Failed to calculate APY' });
 }
});

// User list
app.get('/api/users', async (req, res) => {
 try {
   const result = await pool.query(`
     SELECT address, balance, first_seen, last_seen
     FROM users
     ORDER BY balance DESC
   `);
   
   res.json(result.rows);
 } catch (error) {
   console.error('Error fetching users:', error);
   res.status(500).json({ error: 'Failed to fetch users' });
 }
});

// Health check
app.get('/health', async (req, res) => {
 try {
   const result = await pool.query('SELECT NOW()');
   res.json({ status: 'ok', time: result.rows[0].now });
 } catch (error) {
   res.status(500).json({ status: 'error', message: error.message });
 }
});

const PORT = process.env.API_PORT || process.env.PORT || 3002;
app.listen(PORT, () => {
 console.log(`API server running on port ${PORT}`);
});
