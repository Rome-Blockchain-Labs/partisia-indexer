#!/bin/bash

# Enhanced Partisia Indexer with Tunnel Setup
# Integrates enhanced reward tracking with admin event monitoring

set -e

echo "🚀 Starting Enhanced Partisia Indexer with Tunnel"
echo "================================================"

# Configuration
JUMP_HOST="135.181.252.175"  # helhetz02.romenet.io
REMOTE_HOST="95.216.235.72"  # Target API server
USERNAME=${1:-root}
LOCAL_PORT="58081"

# Function to check if tunnel is working
check_tunnel() {
    if curl -s --connect-timeout 5 "http://127.0.0.1:${LOCAL_PORT}/health" >/dev/null 2>&1; then
        echo "✅ Tunnel is working - blockchain API accessible"
        return 0
    else
        echo "❌ Tunnel not working - blockchain API not accessible"
        return 1
    fi
}

# Function to setup tunnel
setup_tunnel() {
    echo "🚇 Setting up SSH tunnel to ${JUMP_HOST}..."

    # Check if tunnel already exists
    if lsof -Pi :${LOCAL_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port ${LOCAL_PORT} already in use, checking if it's our tunnel..."
        if check_tunnel; then
            echo "✅ SSH tunnel already running and working"
            return 0
        else
            echo "🔄 Killing existing process on port ${LOCAL_PORT}..."
            lsof -ti:${LOCAL_PORT} | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    fi

    # Create new tunnel
    echo "🔗 Creating SSH tunnel..."
    ssh -f -N -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
        -o "ConnectTimeout=10" -o "StrictHostKeyChecking=no" \
        -L ${LOCAL_PORT}:${REMOTE_HOST}:18080 \
        ${USERNAME}@${JUMP_HOST}

    # Wait and verify tunnel
    sleep 3
    if check_tunnel; then
        echo "✅ SSH tunnel established successfully"
        return 0
    else
        echo "❌ Failed to establish working SSH tunnel"
        echo "   Please ensure you have SSH access to ${JUMP_HOST}"
        echo "   Try manually: ssh ${USERNAME}@${JUMP_HOST}"
        exit 1
    fi
}

# Function to check database connection
check_database() {
    echo "🗄️  Checking database connection..."
    if PGPASSWORD=changeme psql -h localhost -p 5432 -U indexer -d ls_indexer -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection working"
        return 0
    else
        echo "❌ Database connection failed"
        echo "   Make sure PostgreSQL is running and credentials are correct"
        return 1
    fi
}

# Function to check enhanced schema
check_enhanced_schema() {
    echo "📋 Checking enhanced reward tracking schema..."

    REQUIRED_TABLES=("reward_transactions" "exchange_rate_snapshots" "bot_account_actions" "reward_summary")
    MISSING_TABLES=()

    for table in "${REQUIRED_TABLES[@]}"; do
        if ! PGPASSWORD=changeme psql -h localhost -p 5432 -U indexer -d ls_indexer \
             -tc "SELECT 1 FROM information_schema.tables WHERE table_name='${table}';" | grep -q 1; then
            MISSING_TABLES+=("$table")
        fi
    done

    if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
        echo "✅ Enhanced schema tables present"
        return 0
    else
        echo "❌ Missing enhanced schema tables: ${MISSING_TABLES[*]}"
        echo "   Run: psql -d ls_indexer -f scripts/enhanced-schema.sql"
        return 1
    fi
}

# Function to show status
show_status() {
    echo ""
    echo "📊 System Status:"
    echo "=================="
    echo "🚇 Tunnel: http://127.0.0.1:${LOCAL_PORT} → ${REMOTE_HOST}:18080"
    echo "🗄️  Database: postgresql://indexer@localhost:5432/ls_indexer"
    echo "🌐 API Server: http://localhost:3002"
    echo "📈 Enhanced Endpoints:"
    echo "   • /api/rewards/dashboard - Comprehensive reward dashboard"
    echo "   • /api/rewards/history - Detailed transaction history"
    echo "   • /bot/performance - Bot account metrics"
    echo "   • /api/rewards/health - System health validation"
    echo ""
    echo "🎯 Monitoring:"
    echo "   • Bot Account: 000016e01e04096e52e0a6021e877f01760552abfb"
    echo "   • Admin Account: 003b8c03f7ce4bdf1288e0344832d1dc3b62d87fb8"
    echo "   • Contract: 02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6"
    echo ""
}

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    echo "   Stopping indexer processes..."
    # Kill any background node processes
    pkill -f "bun.*index.ts" 2>/dev/null || true

    echo "   Keeping SSH tunnel running for reuse"
    echo "   To stop tunnel: pkill -f 'ssh.*${JUMP_HOST}'"
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Main execution
main() {
    echo "🔧 Pre-flight checks..."

    # Setup tunnel
    setup_tunnel

    # Check database
    if ! check_database; then
        exit 1
    fi

    # Check enhanced schema
    if ! check_enhanced_schema; then
        echo "⚠️  Enhanced schema not found, but continuing..."
        echo "   Enhanced features may not work until schema is deployed"
    fi

    # Show status
    show_status

    echo "🚀 Starting Enhanced Partisia Indexer..."
    echo "   Regular indexer: Contract state tracking"
    echo "   Enhanced CoinGecko: Rate-limited price monitoring"
    echo "   Event indexer: General blockchain events"
    echo "   Enhanced reward tracker: Admin & bot event monitoring"
    echo ""
    echo "📝 Logs will show below..."
    echo "========================================"

    # Start the indexer
    cd "$(dirname "$0")"
    bun run src/index.ts
}

# Run main function
main "$@"