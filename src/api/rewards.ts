import { Router } from 'express';
import { Pool } from 'pg';
import config from '../config';

const router = Router();

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  connectionTimeoutMillis: 2000,
});

// Enhanced reward history endpoint with filtering and pagination
router.get('/rewards/history', async (req, res) => {
  try {
    const {
      days = 30,
      action_type = null,
      initiator = null,
      bot_only = false,
      limit = 100,
      offset = 0
    } = req.query;

    let whereClause = 'WHERE timestamp > NOW() - INTERVAL \'1 day\' * $1';
    const params: any[] = [parseInt(days as string)];
    let paramIndex = 2;

    if (action_type) {
      whereClause += ` AND action_type = $${paramIndex}`;
      params.push(action_type as string);
      paramIndex++;
    }

    if (initiator) {
      whereClause += ` AND initiator_address = $${paramIndex}`;
      params.push(initiator as string);
      paramIndex++;
    }

    if (bot_only === 'true') {
      whereClause += ` AND is_bot_account = true`;
    }

    const query = `
      SELECT
        tx_hash,
        block_number,
        timestamp,
        action_type,
        initiator_address,
        user_rewards,
        protocol_rewards,
        net_rewards,
        exchange_rate_before,
        exchange_rate_after,
        (exchange_rate_after - exchange_rate_before) as rate_impact,
        is_bot_account,
        metadata
      FROM reward_transactions
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reward_transactions
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      rewards: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(countResult.rows[0].total) > parseInt(offset as string) + parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Error fetching reward history:', error);
    res.status(500).json({ error: 'Failed to fetch reward history' });
  }
});

// Daily reward aggregation for charts
router.get('/rewards/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', timestamp) as date,
        SUM(CAST(user_rewards AS NUMERIC)) as total_user_rewards,
        SUM(CAST(protocol_rewards AS NUMERIC)) as total_protocol_rewards,
        SUM(CAST(net_rewards AS NUMERIC)) as total_net_rewards,
        COUNT(*) as transaction_count,
        COUNT(*) FILTER (WHERE action_type = 'accrue') as accrue_count,
        COUNT(*) FILTER (WHERE action_type = 'payout') as payout_count,
        COUNT(*) FILTER (WHERE is_bot_account = true) as bot_transactions,
        AVG(exchange_rate_after) as avg_exchange_rate,
        MIN(exchange_rate_after) as min_exchange_rate,
        MAX(exchange_rate_after) as max_exchange_rate
      FROM reward_transactions
      WHERE timestamp > NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `, [days]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily reward data:', error);
    res.status(500).json({ error: 'Failed to fetch daily reward data' });
  }
});

// Exchange rate changes and APY calculation
router.get('/exchange-rates/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const granularity = req.query.granularity || 'hour'; // hour, day, week

    let truncFunction = 'DATE_TRUNC(\'hour\', timestamp)';
    if (granularity === 'day') truncFunction = 'DATE_TRUNC(\'day\', timestamp)';
    if (granularity === 'week') truncFunction = 'DATE_TRUNC(\'week\', timestamp)';

    const result = await pool.query(`
      SELECT
        ${truncFunction} as time_bucket,
        MIN(timestamp) as earliest_time,
        MAX(timestamp) as latest_time,
        MIN(exchange_rate) as min_rate,
        MAX(exchange_rate) as max_rate,
        AVG(exchange_rate) as avg_rate,
        FIRST_VALUE(exchange_rate) OVER (PARTITION BY ${truncFunction} ORDER BY timestamp ASC) as opening_rate,
        LAST_VALUE(exchange_rate) OVER (PARTITION BY ${truncFunction} ORDER BY timestamp ASC RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as closing_rate,
        COUNT(*) as sample_count,
        SUM(ABS(rate_change_percent)) as total_volatility
      FROM exchange_rate_snapshots
      WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
      GROUP BY ${truncFunction}
      ORDER BY time_bucket DESC
    `, [hours]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching exchange rate history:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rate history' });
  }
});

// Real-time APY calculation
router.get('/apy/current', async (req, res) => {
  try {
    const [currentResult, apyResult] = await Promise.all([
      pool.query(`
        SELECT
          exchange_rate,
          timestamp,
          apy_instantaneous
        FROM exchange_rate_snapshots
        ORDER BY timestamp DESC
        LIMIT 1
      `),
      pool.query('SELECT calculate_current_apy() as current_apy')
    ]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'No exchange rate data available' });
    }

    const current = currentResult.rows[0];
    const apy = parseFloat(apyResult.rows[0].current_apy) || 0;

    // Calculate APY for different time periods
    const timePeriodsResult = await pool.query(`
      WITH periods AS (
        SELECT
          '1 hour' as period,
          NOW() - INTERVAL '1 hour' as start_time
        UNION ALL
        SELECT
          '24 hours' as period,
          NOW() - INTERVAL '24 hours' as start_time
        UNION ALL
        SELECT
          '7 days' as period,
          NOW() - INTERVAL '7 days' as start_time
        UNION ALL
        SELECT
          '30 days' as period,
          NOW() - INTERVAL '30 days' as start_time
      )
      SELECT
        p.period,
        (
          SELECT exchange_rate
          FROM exchange_rate_snapshots
          WHERE timestamp >= p.start_time
          ORDER BY timestamp ASC
          LIMIT 1
        ) as start_rate,
        $1 as current_rate,
        CASE
          WHEN (
            SELECT exchange_rate
            FROM exchange_rate_snapshots
            WHERE timestamp >= p.start_time
            ORDER BY timestamp ASC
            LIMIT 1
          ) IS NOT NULL THEN
            (($1 / (
              SELECT exchange_rate
              FROM exchange_rate_snapshots
              WHERE timestamp >= p.start_time
              ORDER BY timestamp ASC
              LIMIT 1
            )) - 1) * 100
          ELSE NULL
        END as percentage_change
      FROM periods p
    `, [current.exchange_rate]);

    res.json({
      current_rate: parseFloat(current.exchange_rate),
      timestamp: current.timestamp,
      apy_realtime: apy,
      apy_instantaneous: parseFloat(current.apy_instantaneous) || 0,
      period_performance: timePeriodsResult.rows
    });
  } catch (error) {
    console.error('Error calculating current APY:', error);
    res.status(500).json({ error: 'Failed to calculate APY' });
  }
});

// Bot account performance metrics
router.get('/bot/performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const [activityResult, performanceResult] = await Promise.all([
      pool.query(`
        SELECT
          DATE_TRUNC('day', timestamp) as date,
          COUNT(*) as total_actions,
          COUNT(*) FILTER (WHERE success = true) as successful_actions,
          SUM(CAST(rewards_distributed AS NUMERIC)) as total_rewards,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(DISTINCT trigger_reason) as unique_triggers
        FROM bot_account_actions
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY date DESC
      `, [days]),
      pool.query(`
        SELECT
          trigger_reason,
          COUNT(*) as frequency,
          AVG(CAST(rewards_distributed AS NUMERIC)) as avg_rewards,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)::float * 100 as success_rate
        FROM bot_account_actions
        WHERE timestamp > NOW() - INTERVAL '1 day' * $1
        GROUP BY trigger_reason
        ORDER BY frequency DESC
      `, [days])
    ]);

    res.json({
      daily_activity: activityResult.rows,
      trigger_analysis: performanceResult.rows
    });
  } catch (error) {
    console.error('Error fetching bot performance:', error);
    res.status(500).json({ error: 'Failed to fetch bot performance' });
  }
});

// Reward impact analysis - how rewards affect exchange rate
router.get('/rewards/impact', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rt.tx_hash,
        rt.timestamp,
        rt.action_type,
        rt.user_rewards,
        rt.exchange_rate_before,
        rt.exchange_rate_after,
        (rt.exchange_rate_after - rt.exchange_rate_before) as rate_change,
        ((rt.exchange_rate_after - rt.exchange_rate_before) / rt.exchange_rate_before * 100) as rate_change_percent,
        rt.is_bot_account,
        ers_before.total_pool_liquid as pool_liquid_before,
        ers_after.total_pool_liquid as pool_liquid_after
      FROM reward_transactions rt
      LEFT JOIN exchange_rate_snapshots ers_before ON ers_before.block_number = (
        SELECT MAX(block_number) FROM exchange_rate_snapshots
        WHERE block_number < rt.block_number
      )
      LEFT JOIN exchange_rate_snapshots ers_after ON ers_after.block_number = (
        SELECT MIN(block_number) FROM exchange_rate_snapshots
        WHERE block_number >= rt.block_number
      )
      WHERE rt.timestamp > NOW() - INTERVAL '7 days'
        AND rt.exchange_rate_before IS NOT NULL
        AND rt.exchange_rate_after IS NOT NULL
      ORDER BY rt.timestamp DESC
      LIMIT 50
    `);

    // Calculate correlation statistics
    const correlationResult = await pool.query(`
      SELECT
        CORR(
          CAST(user_rewards AS NUMERIC),
          (exchange_rate_after - exchange_rate_before)
        ) as reward_rate_correlation,
        AVG((exchange_rate_after - exchange_rate_before)) as avg_rate_impact,
        STDDEV((exchange_rate_after - exchange_rate_before)) as rate_impact_stddev
      FROM reward_transactions
      WHERE timestamp > NOW() - INTERVAL '30 days'
        AND exchange_rate_before IS NOT NULL
        AND exchange_rate_after IS NOT NULL
        AND CAST(user_rewards AS NUMERIC) > 0
    `);

    res.json({
      recent_impacts: result.rows,
      statistics: correlationResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching reward impact analysis:', error);
    res.status(500).json({ error: 'Failed to fetch reward impact analysis' });
  }
});

// Combined dashboard data for frontend
router.get('/dashboard', async (req, res) => {
  try {
    const [
      recentRewards,
      todayStats,
      currentRate,
      botStats
    ] = await Promise.all([
      // Recent reward transactions
      pool.query(`
        SELECT
          timestamp,
          action_type,
          user_rewards,
          exchange_rate_after,
          is_bot_account
        FROM reward_transactions
        ORDER BY timestamp DESC
        LIMIT 10
      `),
      // Today's statistics
      pool.query(`
        SELECT
          SUM(CAST(user_rewards AS NUMERIC)) as total_rewards_today,
          COUNT(*) as transactions_today,
          COUNT(*) FILTER (WHERE is_bot_account = true) as bot_actions_today
        FROM reward_transactions
        WHERE timestamp >= CURRENT_DATE
      `),
      // Current exchange rate and trend
      pool.query(`
        SELECT
          exchange_rate,
          rate_change_percent,
          timestamp,
          total_pool_stake_token,
          total_pool_liquid
        FROM exchange_rate_snapshots
        ORDER BY timestamp DESC
        LIMIT 1
      `),
      // Bot account status
      pool.query(`
        SELECT
          COUNT(*) as total_actions,
          COUNT(*) FILTER (WHERE success = true) as successful_actions,
          MAX(timestamp) as last_action,
          AVG(execution_time_ms) as avg_execution_time
        FROM bot_account_actions
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `)
    ]);

    res.json({
      recent_activity: recentRewards.rows,
      today_stats: todayStats.rows[0],
      current_state: currentRate.rows[0],
      bot_performance: botStats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Health check for reward indexer
router.get('/health', async (req, res) => {
  try {
    const [dbCheck, recentActivity] = await Promise.all([
      pool.query('SELECT NOW() as db_time'),
      pool.query(`
        SELECT
          COUNT(*) as total_rewards,
          MAX(timestamp) as last_reward,
          COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as recent_count
        FROM reward_transactions
      `)
    ]);

    const lastRewardTime = recentActivity.rows[0].last_reward;
    const isStale = lastRewardTime ?
      (Date.now() - new Date(lastRewardTime).getTime()) > 3600000 : // 1 hour
      true;

    res.json({
      status: isStale ? 'warning' : 'healthy',
      database_connected: true,
      database_time: dbCheck.rows[0].db_time,
      total_reward_transactions: parseInt(recentActivity.rows[0].total_rewards),
      last_reward_time: lastRewardTime,
      recent_activity_1h: parseInt(recentActivity.rows[0].recent_count),
      is_stale: isStale
    });
  } catch (error) {
    console.error('Error checking reward indexer health:', error);
    res.status(500).json({
      status: 'error',
      database_connected: false,
      error: error.message
    });
  }
});

export default router;