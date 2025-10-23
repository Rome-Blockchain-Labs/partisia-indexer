-- Migration: Separate raw transaction content from decoded interpretation
--
-- Rationale: Store immutable blockchain data separately from mutable application-layer
-- interpretations. This enables offline re-processing, schema evolution, and eliminates
-- runtime dependencies on external RPC nodes for re-decoding.
--
-- Security considerations:
-- - Raw content stored as base64 text to prevent injection attacks
-- - Foreign key constraints ensure referential integrity
-- - Separate tables prevent accidental mutation of source data

BEGIN;

-- Raw transaction content (immutable source of truth)
-- This table stores the original blockchain data exactly as received from RPC
CREATE TABLE IF NOT EXISTS transaction_content (
  tx_hash TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Raw transaction data (never modify after insert)
  content_base64 TEXT NOT NULL,
  events JSONB,
  execution_status JSONB,

  -- Metadata
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT tx_content_hash_length CHECK (length(tx_hash) = 64),
  CONSTRAINT tx_content_nonempty CHECK (length(content_base64) > 0)
);

-- Create indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_tx_content_block ON transaction_content(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_tx_content_timestamp ON transaction_content(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_content_indexed_at ON transaction_content(indexed_at DESC);

-- Backup existing transactions table
CREATE TABLE IF NOT EXISTS transactions_backup AS SELECT * FROM transactions;

-- Recreate transactions table as decoded view (mutable interpretation layer)
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
  tx_hash TEXT PRIMARY KEY REFERENCES transaction_content(tx_hash) ON DELETE CASCADE,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Decoded fields (can be regenerated from transaction_content)
  action TEXT NOT NULL,
  sender TEXT NOT NULL,
  amount NUMERIC(40,0),

  -- Decoded arguments (all argument data goes here)
  decoded_args JSONB,

  -- Decoder metadata (for versioning and auditing)
  decoder_version TEXT NOT NULL DEFAULT '1.0',
  decoded_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Legacy compatibility
  metadata JSONB,

  -- Constraints
  CONSTRAINT tx_hash_length CHECK (length(tx_hash) = 64),
  CONSTRAINT tx_action_nonempty CHECK (length(action) > 0)
);

-- Recreate indexes
CREATE INDEX idx_transactions_block ON transactions(block_number DESC);
CREATE INDEX idx_transactions_sender ON transactions(sender);
CREATE INDEX idx_transactions_action ON transactions(action);
CREATE INDEX idx_transactions_decoded_at ON transactions(decoded_at DESC);

-- Index for argument queries (GIN index for JSONB)
CREATE INDEX idx_transactions_decoded_args ON transactions USING GIN(decoded_args);

-- Materialized view for quick stats (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS transaction_decode_stats AS
SELECT
  action,
  decoder_version,
  COUNT(*) as count,
  COUNT(decoded_args) as decoded_count,
  MIN(decoded_at) as first_decoded,
  MAX(decoded_at) as last_decoded
FROM transactions
GROUP BY action, decoder_version;

CREATE UNIQUE INDEX ON transaction_decode_stats(action, decoder_version);

-- Function to validate transaction content integrity
CREATE OR REPLACE FUNCTION validate_transaction_content()
RETURNS TABLE(tx_hash TEXT, issue TEXT) AS $$
BEGIN
  -- Check for transactions without content
  RETURN QUERY
  SELECT t.tx_hash, 'missing_content'::TEXT
  FROM transactions t
  LEFT JOIN transaction_content tc ON t.tx_hash = tc.tx_hash
  WHERE tc.tx_hash IS NULL;

  -- Check for orphaned content
  RETURN QUERY
  SELECT tc.tx_hash, 'orphaned_content'::TEXT
  FROM transaction_content tc
  LEFT JOIN transactions t ON tc.tx_hash = t.tx_hash
  WHERE t.tx_hash IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
