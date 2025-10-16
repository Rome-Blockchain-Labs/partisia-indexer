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
MIGRATIONS_DIR="$PROJECT_ROOT/migrations"

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

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        migration_name=$(basename "$migration_file")
        echo "  Applying $migration_name..."

        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"

        if [ $? -eq 0 ]; then
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