-- Drop existing tables if needed
DROP TABLE IF EXISTS contract_states CASCADE;
DROP TABLE IF EXISTS current_state CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS protocol_rewards CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS mpc_prices CASCADE;

-- Main contract state history
CREATE TABLE contract_states (
  block_number BIGINT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  total_pool_stake_token TEXT NOT NULL,
  total_pool_liquid TEXT NOT NULL,
  exchange_rate DECIMAL(20,10) NOT NULL,
  stake_token_balance TEXT NOT NULL,
  buy_in_percentage TEXT NOT NULL,
  buy_in_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Additional contract fields
  token_for_staking TEXT,
  staking_responsible TEXT,
  administrator TEXT,
  length_of_cooldown_period TEXT,
  length_of_redeem_period TEXT,
  amount_of_buy_in_locked_stake_tokens TEXT,
  -- Token metadata
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER,
  -- Aggregate data
  pending_unlocks_count INTEGER DEFAULT 0,
  buy_in_tokens_count INTEGER DEFAULT 0,
  total_pending_unlock_amount TEXT DEFAULT '0'
);

-- Current state (single row, always updated)
CREATE TABLE current_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  total_pool_stake_token TEXT NOT NULL,
  total_pool_liquid TEXT NOT NULL,
  exchange_rate DECIMAL(20,10) NOT NULL,
  stake_token_balance TEXT NOT NULL,
  buy_in_percentage TEXT NOT NULL,
  buy_in_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Additional contract fields
  token_for_staking TEXT,
  staking_responsible TEXT,
  administrator TEXT,
  length_of_cooldown_period TEXT,
  length_of_redeem_period TEXT,
  amount_of_buy_in_locked_stake_tokens TEXT,
  -- Token metadata
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER,
  -- Aggregate data
  pending_unlocks_count INTEGER DEFAULT 0,
  buy_in_tokens_count INTEGER DEFAULT 0,
  total_pending_unlock_amount TEXT DEFAULT '0'
);

-- Transaction history
CREATE TABLE transactions (
  tx_hash TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  action TEXT NOT NULL,
  sender TEXT NOT NULL,
  amount TEXT,
  metadata JSONB
);

-- Protocol rewards tracking
CREATE TABLE protocol_rewards (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  amount TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL
);

-- User balances
CREATE TABLE users (
  address TEXT PRIMARY KEY,
  balance TEXT NOT NULL DEFAULT '0',
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_block BIGINT
);

-- Historical MPC token prices from CoinGecko
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

-- Indexes for performance
CREATE INDEX idx_contract_states_timestamp ON contract_states(timestamp DESC);
CREATE INDEX idx_contract_states_exchange_rate ON contract_states(exchange_rate);
CREATE INDEX idx_transactions_block ON transactions(block_number DESC);
CREATE INDEX idx_transactions_sender ON transactions(sender);
CREATE INDEX idx_transactions_action ON transactions(action);
CREATE INDEX idx_protocol_rewards_block ON protocol_rewards(block_number DESC);
CREATE INDEX idx_users_balance ON users(balance DESC);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);
CREATE INDEX idx_mpc_prices_timestamp ON mpc_prices(timestamp DESC);

-- Sparse data tables for contract state optimization
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
  length_of_cooldown_period TEXT,
  length_of_redeem_period TEXT,
  buy_in_percentage TEXT,
  buy_in_enabled BOOLEAN,
  amount_of_buy_in_locked_stake_tokens TEXT
);

-- User activity metrics - only store when non-zero
CREATE TABLE user_activity (
  block_number BIGINT PRIMARY KEY REFERENCES contract_states(block_number),
  pending_unlocks_count INTEGER,
  buy_in_tokens_count INTEGER,
  total_pending_unlock_amount TEXT
);

-- Indexes for sparse tables
CREATE INDEX idx_governance_changes_block ON governance_changes(block_number DESC);
CREATE INDEX idx_protocol_parameters_block ON protocol_parameters(block_number DESC);
CREATE INDEX idx_user_activity_block ON user_activity(block_number DESC);
