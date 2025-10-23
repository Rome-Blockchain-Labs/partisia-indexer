#!/bin/bash

# Script to completely reset the production indexer database
# WARNING: This deletes ALL indexed data!

set -e

echo "⚠️  WARNING: This will DELETE ALL indexed data!"
echo "⚠️  This includes:"
echo "   - All contract states"
echo "   - All transactions"
echo "   - All user activity"
echo "   - All price history"
echo "   - All governance changes"
echo "   - Indexer checkpoints"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🗑️  Clearing all indexed data..."

PGPASSWORD=changeme psql -h localhost -U indexer -d ls_indexer << 'EOF'
-- Stop if any command fails
\set ON_ERROR_STOP on

-- Truncate all data tables
TRUNCATE TABLE contract_states CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE user_activity CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE governance_changes CASCADE;
TRUNCATE TABLE protocol_parameters CASCADE;
TRUNCATE TABLE protocol_rewards CASCADE;
TRUNCATE TABLE price_history CASCADE;
TRUNCATE TABLE block_mappings CASCADE;
TRUNCATE TABLE indexed_blocks CASCADE;

-- Clear current state
DELETE FROM current_state;

-- Reset indexer checkpoints
UPDATE tx_indexer_checkpoint SET last_scanned_block = 10888000, updated_at = NOW();

-- Reset token metadata (will be reindexed)
DELETE FROM token_metadata;

-- Show what's left
SELECT 'contract_states' as table_name, COUNT(*) as count FROM contract_states
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'user_activity', COUNT(*) FROM user_activity
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'tx_indexer_checkpoint', last_scanned_block FROM tx_indexer_checkpoint;

EOF

echo ""
echo "✅ Database reset complete!"
echo ""
echo "Next steps:"
echo "1. Restart the indexer service"
echo "2. Monitor logs to ensure indexing starts from the beginning"
echo "3. Check API endpoints after a few minutes"
echo ""
echo "The indexers will start from:"
echo "  - State indexer: deployment block (from config)"
echo "  - Transaction indexer: block 10888000"
