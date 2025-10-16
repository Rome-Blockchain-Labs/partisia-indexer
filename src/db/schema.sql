-- Partisia Liquid Staking Indexer Database Schema
-- Migration 001: Create initial schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create sequence for price_history
CREATE SEQUENCE IF NOT EXISTS public.price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Contract states table - stores historical contract state snapshots
CREATE TABLE IF NOT EXISTS public.contract_states (
    block_number bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    total_pool_stake_token text NOT NULL,
    total_pool_liquid text NOT NULL,
    exchange_rate numeric(20,10) NOT NULL,
    stake_token_balance text NOT NULL,
    buy_in_percentage text NOT NULL,
    buy_in_enabled boolean DEFAULT false NOT NULL,
    token_for_staking text,
    staking_responsible text,
    administrator text,
    length_of_cooldown_period text,
    length_of_redeem_period text,
    amount_of_buy_in_locked_stake_tokens text,
    token_name text,
    token_symbol text,
    token_decimals integer,
    pending_unlocks_count integer DEFAULT 0,
    buy_in_tokens_count integer DEFAULT 0,
    total_pending_unlock_amount text DEFAULT '0'::text,
    CONSTRAINT contract_states_pkey PRIMARY KEY (block_number)
);

-- Current state table - stores the latest contract state
CREATE TABLE IF NOT EXISTS public.current_state (
    id integer DEFAULT 1 NOT NULL,
    block_number bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    total_pool_stake_token text NOT NULL,
    total_pool_liquid text NOT NULL,
    exchange_rate numeric(20,10) NOT NULL,
    stake_token_balance text NOT NULL,
    buy_in_percentage text NOT NULL,
    buy_in_enabled boolean DEFAULT false NOT NULL,
    token_for_staking text,
    staking_responsible text,
    administrator text,
    length_of_cooldown_period text,
    length_of_redeem_period text,
    amount_of_buy_in_locked_stake_tokens text,
    token_name text,
    token_symbol text,
    token_decimals integer,
    pending_unlocks_count integer DEFAULT 0,
    buy_in_tokens_count integer DEFAULT 0,
    total_pending_unlock_amount text DEFAULT '0'::text,
    CONSTRAINT current_state_pkey PRIMARY KEY (id),
    CONSTRAINT current_state_id_check CHECK ((id = 1))
);

-- Price history table - stores historical price data from various sources
CREATE TABLE IF NOT EXISTS public.price_history (
    id integer DEFAULT nextval('public.price_history_id_seq'::regclass) NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    price_usd numeric(20,10) NOT NULL,
    market_cap_usd numeric(30,2),
    volume_24h_usd numeric(30,2),
    source text DEFAULT 'coingecko'::text NOT NULL,
    metadata jsonb,
    CONSTRAINT price_history_pkey PRIMARY KEY (id),
    CONSTRAINT price_history_timestamp_source_key UNIQUE ("timestamp", source)
);

-- Link sequence to price_history table
ALTER SEQUENCE public.price_history_id_seq OWNED BY public.price_history.id;

-- Transactions table - stores blockchain transactions related to the contract
CREATE TABLE IF NOT EXISTS public.transactions (
    tx_hash text NOT NULL,
    block_number bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    action text NOT NULL,
    sender text NOT NULL,
    amount text,
    metadata jsonb,
    CONSTRAINT transactions_pkey PRIMARY KEY (tx_hash)
);

-- Users table - stores user balance and activity data
CREATE TABLE IF NOT EXISTS public.users (
    address text NOT NULL,
    balance text DEFAULT '0'::text NOT NULL,
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_block bigint,
    CONSTRAINT users_pkey PRIMARY KEY (address)
);

-- Performance indexes for contract_states
CREATE INDEX IF NOT EXISTS idx_contract_states_timestamp
    ON public.contract_states USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_contract_states_exchange_rate
    ON public.contract_states USING btree (exchange_rate);

-- Performance indexes for price_history
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp
    ON public.price_history USING btree ("timestamp" DESC);

-- Performance indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_block
    ON public.transactions USING btree (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_action
    ON public.transactions USING btree (action);
CREATE INDEX IF NOT EXISTS idx_transactions_sender
    ON public.transactions USING btree (sender);

-- Performance indexes for users
CREATE INDEX IF NOT EXISTS idx_users_balance
    ON public.users USING btree (balance DESC);

-- Insert default current_state row if not exists
INSERT INTO public.current_state (
    id, block_number, "timestamp", total_pool_stake_token, total_pool_liquid,
    exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES (
    1, 0, NOW(), '0', '0', 1.0, '0', '0', false
) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.contract_states IS 'Historical snapshots of liquid staking contract state';
COMMENT ON TABLE public.current_state IS 'Current state of the liquid staking contract (singleton)';
COMMENT ON TABLE public.price_history IS 'Historical price data from various sources (MEXC, CoinGecko, etc.)';
COMMENT ON TABLE public.transactions IS 'Blockchain transactions related to the liquid staking contract';
COMMENT ON TABLE public.users IS 'User balances and activity tracking';

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO indexer;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO indexer;