#!/bin/bash

# Partisia Indexer Schema Deployment Script
# This script applies database migrations for production deployment

set -e  # Exit on error

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ls_indexer}"
DB_USER="${DB_USER:-indexer}"
DB_PASSWORD="${PGPASSWORD}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/src/db/migrations"

echo "🗄️  Partisia Indexer Database Schema Deployment"
echo "================================================"
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if database exists
echo "📋 Checking database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Failed to connect to database. Please check your connection settings."
    echo "Required environment variables:"
    echo "  PGPASSWORD - Database password"
    echo "  DB_HOST    - Database host (default: localhost)"
    echo "  DB_PORT    - Database port (default: 5432)"
    echo "  DB_NAME    - Database name (default: ls_indexer)"
    echo "  DB_USER    - Database user (default: indexer)"
    exit 1
fi

echo "✅ Database connection successful"

# Apply migrations
echo ""
echo "🔄 Applying database migrations..."

if ! compgen -G "$MIGRATIONS_DIR/*.sql" >/dev/null; then
    echo "❌ No migrations found in $MIGRATIONS_DIR"
    exit 1
fi

psql_do() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

# Migrations are applied exactly once and recorded here. Without this, re-running
# the script replays every file - and 001 drops and recreates the transactions
# table, so a replay silently destroys indexed history.
psql_do -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"

# Baseline: this tracking table was introduced after 001 had already been applied
# to existing databases. If its objects are present but nothing is recorded, adopt
# the current state rather than replaying it.
if [ "$(psql_do -tAc "SELECT count(*) FROM schema_migrations;")" = "0" ]; then
    if [ "$(psql_do -tAc "SELECT to_regclass('public.transaction_content') IS NOT NULL;")" = "t" ]; then
        echo "  ℹ️  Existing schema detected - baselining 001 as already applied"
        psql_do -q -c "INSERT INTO schema_migrations (filename) VALUES ('001_transaction_content_separation.sql') ON CONFLICT DO NOTHING;"
    fi
fi

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        migration_name=$(basename "$migration_file")

        already="$(psql_do -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$migration_name';")"
        if [ "$already" = "1" ]; then
            echo "  ⏭️  $migration_name already applied - skipping"
            continue
        fi

        echo "  Applying $migration_name..."

        # ON_ERROR_STOP so a failing statement aborts instead of continuing and
        # then being recorded as applied
        if psql_do -v ON_ERROR_STOP=1 -f "$migration_file"; then
            psql_do -q -c "INSERT INTO schema_migrations (filename) VALUES ('$migration_name');"
            echo "  ✅ $migration_name applied successfully"
        else
            echo "  ❌ Failed to apply $migration_name"
            exit 1
        fi
    fi
done

# Verify schema
echo ""
echo "🔍 Verifying schema..."
table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('contract_states', 'current_state', 'price_history', 'transactions', 'users');")

if [ "$table_count" -eq 5 ]; then
    echo "✅ All required tables created successfully"
else
    echo "❌ Schema verification failed. Expected 5 tables, found $table_count"
    exit 1
fi

echo ""
echo "🎉 Database schema deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Start the indexer with: npm start or node dist/index.js"
echo "2. Monitor logs for indexing progress"
echo "3. Access GraphQL API at: http://localhost:3002/graphql"
echo "4. Access web dashboard at: http://localhost:3002/"