-- Enhanced schema for comprehensive reward tracking and exchange rate monitoring
-- Based on the existing schema but extended for better reward visibility

-- Drop existing tables if needed (in correct order to handle dependencies)
DROP TABLE IF EXISTS reward_transactions CASCADE;
DROP TABLE IF EXISTS exchange_rate_snapshots CASCADE;
DROP TABLE IF EXISTS bot_account_actions CASCADE;
DROP TABLE IF EXISTS reward_summary CASCADE;

-- Enhanced reward transactions table with detailed tracking
CREATE TABLE reward_transactions (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Transaction details
  action_type TEXT NOT NULL CHECK (action_type IN ('accrue', 'payout', 'manual_accrue')),
  initiator_address TEXT NOT NULL, -- Who initiated the transaction

  -- Reward amounts (stored as strings to preserve precision)
  raw_amount TEXT NOT NULL DEFAULT '0',
  user_rewards TEXT NOT NULL DEFAULT '0',
  protocol_rewards TEXT NOT NULL DEFAULT '0',
  net_rewards TEXT NOT NULL DEFAULT '0', -- After internal fees

  -- Exchange rate and context
  exchange_rate_before DECIMAL(20,10),
  exchange_rate_after DECIMAL(20,10),
  rate_change DECIMAL(20,10),

  -- Pool state at time of transaction
  total_pool_stake_before TEXT,
  total_pool_liquid_before TEXT,
  total_pool_stake_after TEXT,
  total_pool_liquid_after TEXT,

  -- MPC price data at transaction time
  mpc_price_usd DECIMAL(20,10),
  reward_value_usd DECIMAL(20,10),

  -- Transaction metadata
  gas_used BIGINT,
  transaction_fee TEXT,
  is_bot_account BOOLEAN DEFAULT false,

  -- Additional context
  metadata JSONB,

  UNIQUE(tx_hash)
);

-- Exchange rate snapshots for high-frequency tracking
CREATE TABLE exchange_rate_snapshots (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Exchange rate data
  exchange_rate DECIMAL(20,10) NOT NULL,
  rate_change_percent DECIMAL(10,6),
  rate_change_absolute DECIMAL(20,10),

  -- Pool composition
  total_pool_stake_token TEXT NOT NULL,
  total_pool_liquid TEXT NOT NULL,
  stake_token_balance TEXT NOT NULL,

  -- Performance metrics
  apy_instantaneous DECIMAL(10,4),
  rewards_accrued_since_last TEXT DEFAULT '0',

  -- Price context
  mpc_price_usd DECIMAL(20,10),
  tvl_usd DECIMAL(30,2),

  -- Change tracking
  blocks_since_last_reward INTEGER,
  time_since_last_reward INTERVAL,

  UNIQUE(block_number)
);

-- Bot account specific actions tracking
CREATE TABLE bot_account_actions (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Bot account details
  bot_address TEXT NOT NULL DEFAULT '000016e01e04096e52e0a6021e877f01760552abfb',
  action_type TEXT NOT NULL,

  -- Action results
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Reward-specific data
  rewards_distributed TEXT DEFAULT '0',
  accounts_affected INTEGER DEFAULT 0,

  -- Performance tracking
  execution_time_ms INTEGER,
  gas_efficiency DECIMAL(10,4),

  -- Context
  exchange_rate_at_action DECIMAL(20,10),
  trigger_reason TEXT, -- 'scheduled', 'manual', 'threshold_reached', etc.

  metadata JSONB
);

-- Daily/periodic reward summary for efficient reporting
CREATE TABLE reward_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,

  -- Reward totals for the day
  total_rewards_accrued TEXT NOT NULL DEFAULT '0',
  total_rewards_paid_out TEXT NOT NULL DEFAULT '0',
  net_rewards TEXT NOT NULL DEFAULT '0',

  -- Transaction counts
  accrue_transactions INTEGER DEFAULT 0,
  payout_transactions INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,

  -- Exchange rate metrics
  starting_exchange_rate DECIMAL(20,10),
  ending_exchange_rate DECIMAL(20,10),
  max_exchange_rate DECIMAL(20,10),
  min_exchange_rate DECIMAL(20,10),
  avg_exchange_rate DECIMAL(20,10),

  -- Performance metrics
  daily_apy DECIMAL(10,4),
  total_value_usd DECIMAL(30,2),

  -- Bot activity
  bot_actions INTEGER DEFAULT 0,
  bot_success_rate DECIMAL(5,2),

  UNIQUE(date)
);

-- Enhanced indexes for performance
CREATE INDEX idx_reward_transactions_timestamp ON reward_transactions(timestamp DESC);
CREATE INDEX idx_reward_transactions_action_type ON reward_transactions(action_type);
CREATE INDEX idx_reward_transactions_initiator ON reward_transactions(initiator_address);
CREATE INDEX idx_reward_transactions_bot_account ON reward_transactions(is_bot_account) WHERE is_bot_account = true;
CREATE INDEX idx_reward_transactions_block ON reward_transactions(block_number DESC);

CREATE INDEX idx_exchange_rate_snapshots_timestamp ON exchange_rate_snapshots(timestamp DESC);
CREATE INDEX idx_exchange_rate_snapshots_rate ON exchange_rate_snapshots(exchange_rate);
CREATE INDEX idx_exchange_rate_snapshots_change ON exchange_rate_snapshots(rate_change_percent DESC);

CREATE INDEX idx_bot_account_actions_timestamp ON bot_account_actions(timestamp DESC);
CREATE INDEX idx_bot_account_actions_success ON bot_account_actions(success);
CREATE INDEX idx_bot_account_actions_type ON bot_account_actions(action_type);

CREATE INDEX idx_reward_summary_date ON reward_summary(date DESC);

-- Views for common queries
CREATE OR REPLACE VIEW reward_activity_summary AS
SELECT
    DATE_TRUNC('day', timestamp) as day,
    action_type,
    COUNT(*) as transaction_count,
    SUM(CAST(user_rewards AS NUMERIC)) as total_user_rewards,
    SUM(CAST(protocol_rewards AS NUMERIC)) as total_protocol_rewards,
    AVG(exchange_rate_after) as avg_exchange_rate,
    SUM(CAST(reward_value_usd AS NUMERIC)) as total_value_usd
FROM reward_transactions
GROUP BY DATE_TRUNC('day', timestamp), action_type
ORDER BY day DESC, action_type;

CREATE OR REPLACE VIEW exchange_rate_performance AS
SELECT
    timestamp,
    exchange_rate,
    rate_change_percent,
    apy_instantaneous,
    LAG(exchange_rate) OVER (ORDER BY timestamp) as previous_rate,
    LEAD(exchange_rate) OVER (ORDER BY timestamp) as next_rate
FROM exchange_rate_snapshots
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW bot_account_performance AS
SELECT
    DATE_TRUNC('day', timestamp) as day,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE success = true) as successful_actions,
    ROUND(
        COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100, 2
    ) as success_rate_percent,
    SUM(CAST(rewards_distributed AS NUMERIC)) as total_rewards_distributed,
    AVG(execution_time_ms) as avg_execution_time_ms
FROM bot_account_actions
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY day DESC;

-- Function to calculate real-time APY based on recent exchange rate changes
CREATE OR REPLACE FUNCTION calculate_current_apy()
RETURNS DECIMAL(10,4) AS $$
DECLARE
    current_rate DECIMAL(20,10);
    rate_24h_ago DECIMAL(20,10);
    time_diff_hours DECIMAL;
    apy_result DECIMAL(10,4);
BEGIN
    -- Get current exchange rate
    SELECT exchange_rate INTO current_rate
    FROM exchange_rate_snapshots
    ORDER BY timestamp DESC
    LIMIT 1;

    -- Get rate from ~24 hours ago
    SELECT exchange_rate INTO rate_24h_ago
    FROM exchange_rate_snapshots
    WHERE timestamp <= NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
    LIMIT 1;

    -- Calculate time difference in hours
    SELECT EXTRACT(EPOCH FROM (
        (SELECT timestamp FROM exchange_rate_snapshots ORDER BY timestamp DESC LIMIT 1) -
        (SELECT timestamp FROM exchange_rate_snapshots WHERE timestamp <= NOW() - INTERVAL '24 hours' ORDER BY timestamp DESC LIMIT 1)
    )) / 3600 INTO time_diff_hours;

    -- Calculate APY if we have valid data
    IF current_rate IS NOT NULL AND rate_24h_ago IS NOT NULL AND time_diff_hours > 0 THEN
        apy_result := ((current_rate / rate_24h_ago) - 1) * (365 * 24 / time_diff_hours) * 100;
        RETURN COALESCE(apy_result, 0);
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update reward_summary table when new reward transactions are added
CREATE OR REPLACE FUNCTION update_reward_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO reward_summary (
        date,
        total_rewards_accrued,
        total_rewards_paid_out,
        accrue_transactions,
        payout_transactions,
        total_transactions
    )
    VALUES (
        DATE(NEW.timestamp),
        CASE WHEN NEW.action_type = 'accrue' THEN NEW.user_rewards ELSE '0' END,
        CASE WHEN NEW.action_type = 'payout' THEN NEW.user_rewards ELSE '0' END,
        CASE WHEN NEW.action_type = 'accrue' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action_type = 'payout' THEN 1 ELSE 0 END,
        1
    )
    ON CONFLICT (date) DO UPDATE SET
        total_rewards_accrued = CAST(reward_summary.total_rewards_accrued AS NUMERIC) +
                               CASE WHEN NEW.action_type = 'accrue' THEN CAST(NEW.user_rewards AS NUMERIC) ELSE 0 END,
        total_rewards_paid_out = CAST(reward_summary.total_rewards_paid_out AS NUMERIC) +
                                CASE WHEN NEW.action_type = 'payout' THEN CAST(NEW.user_rewards AS NUMERIC) ELSE 0 END,
        accrue_transactions = reward_summary.accrue_transactions +
                             CASE WHEN NEW.action_type = 'accrue' THEN 1 ELSE 0 END,
        payout_transactions = reward_summary.payout_transactions +
                             CASE WHEN NEW.action_type = 'payout' THEN 1 ELSE 0 END,
        total_transactions = reward_summary.total_transactions + 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reward_transaction_summary_trigger
    AFTER INSERT ON reward_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_reward_summary();

-- Add comments for documentation
COMMENT ON TABLE reward_transactions IS 'Detailed tracking of all reward-related transactions with full context';
COMMENT ON TABLE exchange_rate_snapshots IS 'High-frequency exchange rate monitoring for APY calculation';
COMMENT ON TABLE bot_account_actions IS 'Specific tracking of bot account 000016e01e04096e52e0a6021e877f01760552abfb actions';
COMMENT ON TABLE reward_summary IS 'Daily aggregated reward statistics for efficient reporting';

COMMENT ON COLUMN reward_transactions.is_bot_account IS 'True if transaction was initiated by the reward bot account';
COMMENT ON COLUMN reward_transactions.action_type IS 'accrue: rewards added to pool, payout: rewards distributed to users';
COMMENT ON COLUMN exchange_rate_snapshots.apy_instantaneous IS 'APY calculated from the most recent rate change';
COMMENT ON COLUMN bot_account_actions.trigger_reason IS 'What caused this bot action to be triggered';