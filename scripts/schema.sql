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
  buy_in_enabled BOOLEAN NOT NULL DEFAULT false
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
  buy_in_enabled BOOLEAN NOT NULL DEFAULT false
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
