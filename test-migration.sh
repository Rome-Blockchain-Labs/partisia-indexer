#!/bin/bash
set -e

echo "🧪 Testing migration on production database (read-only test)"
echo ""

# Production database connection
export PGHOST=helhetz02.romenet.io
export PGPORT=18432
export PGUSER=indexer
export PGDATABASE=partisia_indexer

echo "1️⃣ Checking current schema..."
psql -c "\d transactions" 2>&1 | head -20

echo ""
echo "2️⃣ Checking if transaction_content table exists..."
if psql -c "\d transaction_content" 2>&1 | grep -q "Did not find"; then
    echo "❌ transaction_content table does not exist (expected)"
else
    echo "✅ transaction_content table already exists"
fi

echo ""
echo "3️⃣ Counting current transactions..."
psql -c "SELECT COUNT(*) as current_transactions FROM transactions;"

echo ""
echo "📝 Migration would:"
echo "  - Create transaction_content table"
echo "  - Backup existing transactions to transactions_backup"
echo "  - Recreate transactions table with new schema"
echo "  - Add foreign key constraint to transaction_content"
echo ""
echo "⚠️  To apply migration, run:"
echo "   psql < src/db/migrations/001_transaction_content_separation.sql"
