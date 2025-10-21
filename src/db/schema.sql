-- Sparse Data Schema for Contract State
-- Only store what actually changes, not every block

-- Core contract state - store every block with state changes
CREATE TABLE contract_states (
  block_number BIGINT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  -- Frequently changing fields (store every change)
  total_pool_stake_token NUMERIC(40,0) NOT NULL,
  total_pool_liquid NUMERIC(40,0) NOT NULL,
  exchange_rate DECIMAL(20,10) NOT NULL,
  stake_token_balance NUMERIC(40,0) NOT NULL,
  buy_in_percentage NUMERIC(10,4) NOT NULL,
  buy_in_enabled BOOLEAN DEFAULT false NOT NULL,
  -- Denormalized fields for performance (duplicated from sparse tables)
  token_for_staking TEXT,
  staking_responsible TEXT,
  administrator TEXT,
  length_of_cooldown_period BIGINT,
  length_of_redeem_period BIGINT,
  amount_of_buy_in_locked_stake_tokens NUMERIC(40,0),
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER,
  pending_unlocks_count INTEGER DEFAULT 0,
  buy_in_tokens_count INTEGER DEFAULT 0,
  total_pending_unlock_amount NUMERIC(40,0) DEFAULT 0,
  total_smpc_value_usd DECIMAL(20,8) DEFAULT 0
);

-- Governance changes - only store when they actually change
CREATE TABLE governance_changes (
  block_number BIGINT PRIMARY KEY REFERENCES contract_states(block_number),
  administrator TEXT,
  staking_responsible TEXT,
  token_for_staking TEXT
);

-- Token metadata - typically set once at deployment, rarely changes
CREATE TABLE token_metadata (
  block_number BIGINT PRIMARY KEY REFERENCES contract_states(block_number),
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER
);

-- Protocol parameters - only store when they change
CREATE TABLE protocol_parameters (
  block_number BIGINT PRIMARY KEY REFERENCES contract_states(block_number),
  length_of_cooldown_period BIGINT,
  length_of_redeem_period BIGINT,
  buy_in_percentage NUMERIC(10,4),
  buy_in_enabled BOOLEAN,
  amount_of_buy_in_locked_stake_tokens NUMERIC(40,0)
);

-- User activity metrics - only store when non-zero
CREATE TABLE user_activity (
  block_number BIGINT PRIMARY KEY REFERENCES contract_states(block_number),
  pending_unlocks_count INTEGER,
  buy_in_tokens_count INTEGER,
  total_pending_unlock_amount NUMERIC(40,0)
);

-- Current state view - combines latest values from all sparse tables
CREATE OR REPLACE VIEW current_state_full AS
WITH latest_values AS (
  -- Get latest block with state
  SELECT block_number, timestamp, total_pool_stake_token, total_pool_liquid,
         exchange_rate, stake_token_balance
  FROM contract_states
  ORDER BY block_number DESC LIMIT 1
),
latest_governance AS (
  SELECT administrator, staking_responsible, token_for_staking
  FROM governance_changes
  ORDER BY block_number DESC LIMIT 1
),
latest_metadata AS (
  SELECT token_name, token_symbol, token_decimals
  FROM token_metadata
  ORDER BY block_number DESC LIMIT 1
),
latest_parameters AS (
  SELECT length_of_cooldown_period, length_of_redeem_period,
         buy_in_percentage, buy_in_enabled, amount_of_buy_in_locked_stake_tokens
  FROM protocol_parameters
  ORDER BY block_number DESC LIMIT 1
),
latest_activity AS (
  SELECT pending_unlocks_count, buy_in_tokens_count, total_pending_unlock_amount
  FROM user_activity
  ORDER BY block_number DESC LIMIT 1
)
SELECT
  1 as id,
  lv.*,
  lg.administrator, lg.staking_responsible, lg.token_for_staking,
  lm.token_name, lm.token_symbol, lm.token_decimals,
  lp.length_of_cooldown_period, lp.length_of_redeem_period,
  lp.buy_in_percentage, lp.buy_in_enabled, lp.amount_of_buy_in_locked_stake_tokens,
  COALESCE(la.pending_unlocks_count, 0) as pending_unlocks_count,
  COALESCE(la.buy_in_tokens_count, 0) as buy_in_tokens_count,
  COALESCE(la.total_pending_unlock_amount, '0') as total_pending_unlock_amount
FROM latest_values lv
CROSS JOIN latest_governance lg
CROSS JOIN latest_metadata lm
CROSS JOIN latest_parameters lp
CROSS JOIN latest_activity la;

-- Indexes for performance
CREATE INDEX idx_contract_states_timestamp ON contract_states(timestamp DESC);
CREATE INDEX idx_contract_states_exchange_rate ON contract_states(exchange_rate);
CREATE INDEX idx_governance_changes_block ON governance_changes(block_number DESC);
CREATE INDEX idx_protocol_parameters_block ON protocol_parameters(block_number DESC);
CREATE INDEX idx_user_activity_block ON user_activity(block_number DESC);

-- Keep existing tables for compatibility
CREATE TABLE current_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  total_pool_stake_token NUMERIC(40,0) NOT NULL,
  total_pool_liquid NUMERIC(40,0) NOT NULL,
  exchange_rate DECIMAL(20,10) NOT NULL,
  stake_token_balance NUMERIC(40,0) NOT NULL,
  -- Sparse fields will be populated from latest values
  token_for_staking TEXT,
  staking_responsible TEXT,
  administrator TEXT,
  length_of_cooldown_period BIGINT,
  length_of_redeem_period BIGINT,
  amount_of_buy_in_locked_stake_tokens NUMERIC(40,0),
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER,
  pending_unlocks_count INTEGER DEFAULT 0,
  buy_in_tokens_count INTEGER DEFAULT 0,
  total_pending_unlock_amount NUMERIC(40,0) DEFAULT 0,
  buy_in_percentage NUMERIC(10,4),
  buy_in_enabled BOOLEAN
);

-- Other existing tables
CREATE TABLE transactions (
  tx_hash TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  action TEXT NOT NULL,
  sender TEXT NOT NULL,
  amount NUMERIC(40,0),
  metadata JSONB
);

CREATE TABLE protocol_rewards (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  amount NUMERIC(40,0) NOT NULL,
  timestamp TIMESTAMP NOT NULL
);

CREATE TABLE users (
  address TEXT PRIMARY KEY,
  balance NUMERIC(40,0) NOT NULL DEFAULT 0,
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_block BIGINT
);

CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  price_usd DECIMAL(20,10) NOT NULL,
  market_cap_usd DECIMAL(30,2),
  volume_24h_usd DECIMAL(30,2),
  source TEXT NOT NULL DEFAULT 'coingecko',
  metadata JSONB,
  UNIQUE(timestamp, source)
);

-- MPC prices tied to blocks
CREATE TABLE mpc_prices (
  block_number BIGINT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  price_usd DECIMAL(20,10) NOT NULL,
  market_cap_usd DECIMAL(30,2),
  volume_24h_usd DECIMAL(30,2),
  price_change_24h DECIMAL(10,4)
);

-- Indexes
CREATE INDEX idx_transactions_block ON transactions(block_number DESC);
CREATE INDEX idx_transactions_sender ON transactions(sender);
CREATE INDEX idx_transactions_action ON transactions(action);
CREATE INDEX idx_protocol_rewards_block ON protocol_rewards(block_number DESC);
CREATE INDEX idx_users_balance ON users(balance DESC);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);
CREATE INDEX idx_mpc_prices_timestamp ON mpc_prices(timestamp DESC);

-- Block mappings table to cache blockTime -> blockId mappings
-- This avoids repeated public API calls for the same blocks
CREATE TABLE IF NOT EXISTS block_mappings (
  block_time BIGINT PRIMARY KEY,
  block_id TEXT NOT NULL UNIQUE,
  production_time BIGINT,
  cached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_block_mappings_block_time ON block_mappings(block_time);
CREATE INDEX idx_block_mappings_cached_at ON block_mappings(cached_at DESC);

-- Block checkpoint system for verification and gap detection
-- Tracks every successfully processed block to detect missing data
CREATE TABLE IF NOT EXISTS indexed_blocks (
  block_number BIGINT PRIMARY KEY,
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processing_time_ms INTEGER,
  has_state_data BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_indexed_blocks_indexed_at ON indexed_blocks(indexed_at);

-- Gap detection function: finds missing blocks in indexed range
CREATE OR REPLACE FUNCTION find_indexed_gaps(start_block BIGINT, end_block BIGINT)
RETURNS TABLE(gap_start BIGINT, gap_end BIGINT, gap_size BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH blocks_with_next AS (
    SELECT
      block_number,
      LEAD(block_number) OVER (ORDER BY block_number) as next_block
    FROM indexed_blocks
    WHERE block_number BETWEEN start_block AND end_block
  )
  SELECT
    block_number + 1 AS gap_start,
    next_block - 1 AS gap_end,
    next_block - block_number - 1 AS gap_size
  FROM blocks_with_next
  WHERE next_block - block_number > 1
  ORDER BY block_number;
END;
$$ LANGUAGE plpgsql;