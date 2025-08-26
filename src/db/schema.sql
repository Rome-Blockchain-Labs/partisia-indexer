-- Main contract state tracking
CREATE TABLE IF NOT EXISTS contract_states (
   block_number BIGINT PRIMARY KEY,
   timestamp TIMESTAMP NOT NULL,
   total_pool_stake_token NUMERIC(30,0) NOT NULL,
   total_pool_liquid NUMERIC(30,0) NOT NULL,
   exchange_rate NUMERIC(30,10) NOT NULL,
   stake_token_balance NUMERIC(30,0) NOT NULL,
   buy_in_percentage INTEGER NOT NULL,
   buy_in_enabled BOOLEAN NOT NULL
);

-- Current state (single row, constantly updated)
CREATE TABLE IF NOT EXISTS current_state (
   id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
   block_number BIGINT NOT NULL,
   timestamp TIMESTAMP NOT NULL,
   total_pool_stake_token NUMERIC(30,0) NOT NULL,
   total_pool_liquid NUMERIC(30,0) NOT NULL,
   exchange_rate NUMERIC(30,10) NOT NULL,
   stake_token_balance NUMERIC(30,0) NOT NULL,
   buy_in_percentage INTEGER NOT NULL,
   buy_in_enabled BOOLEAN NOT NULL
);

-- Exchange rate history (redundant but kept for compatibility)
CREATE TABLE IF NOT EXISTS exchange_rates (
   block_time BIGINT PRIMARY KEY,
   rate NUMERIC(30,10) NOT NULL,
   total_stake NUMERIC(30,0) NOT NULL,
   total_liquid NUMERIC(30,0) NOT NULL,
   timestamp TIMESTAMP NOT NULL
);

-- Protocol rewards tracking
CREATE TABLE IF NOT EXISTS protocol_rewards (
   id SERIAL PRIMARY KEY,
   block_time BIGINT NOT NULL,
   amount NUMERIC(30,0) NOT NULL,
   rate_before NUMERIC(30,10),
   rate_after NUMERIC(30,10),
   timestamp TIMESTAMP NOT NULL
);

-- Transaction tracking
CREATE TABLE IF NOT EXISTS transactions (
   tx_hash VARCHAR(66) PRIMARY KEY,
   block_time BIGINT,
   block_number BIGINT,
   action_code INTEGER,
   action VARCHAR(50),
   sender VARCHAR(66),
   amount NUMERIC(30,0),
   rate_at_tx NUMERIC(30,10),
   timestamp TIMESTAMP NOT NULL,
   raw_content TEXT,
   metadata JSONB
);

-- User tracking
CREATE TABLE IF NOT EXISTS users (
   address VARCHAR(66) PRIMARY KEY,
   first_seen TIMESTAMP NOT NULL,
   last_seen TIMESTAMP NOT NULL,
   balance NUMERIC(30,0)
);

CREATE TABLE IF NOT EXISTS user_actions (
   id SERIAL PRIMARY KEY,
   user_address VARCHAR(66),
   action VARCHAR(50),
   amount NUMERIC(30,0),
   block_time BIGINT,
   timestamp TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_states_timestamp ON contract_states(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_current_state ON current_state(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_rates_timestamp ON exchange_rates(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_timestamp ON protocol_rewards(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions ON user_actions(user_address, timestamp DESC);
