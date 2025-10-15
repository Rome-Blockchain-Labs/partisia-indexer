#!/bin/bash

# Partisia Indexer with Admin Event Tracking
# Clean implementation without stupid naming

set -e

REMOTE_HOST="95.216.235.72"
USERNAME=${1:-root}
LOCAL_PORT="58081"

check_tunnel() {
    curl -s --connect-timeout 3 "http://127.0.0.1:${LOCAL_PORT}/health" >/dev/null 2>&1
}

setup_tunnel() {
    echo "Setting up tunnel to ${REMOTE_HOST}..."

    if lsof -Pi :${LOCAL_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        if check_tunnel; then
            echo "Tunnel already running and working"
            return 0
        else
            echo "Killing stale process on port ${LOCAL_PORT}..."
            lsof -ti:${LOCAL_PORT} | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    fi

    echo "Creating SSH tunnel..."
    ssh -f -N -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
        -o "ConnectTimeout=10" -o "StrictHostKeyChecking=no" \
        -L ${LOCAL_PORT}:127.0.0.1:${LOCAL_PORT} \
        ${USERNAME}@${REMOTE_HOST}

    sleep 3
    if check_tunnel; then
        echo "Tunnel established"
        return 0
    else
        echo "Tunnel setup failed"
        echo "Check SSH access: ssh ${USERNAME}@${REMOTE_HOST}"
        exit 1
    fi
}

check_database() {
    echo "Checking database..."
    if PGPASSWORD=changeme psql -h localhost -p 5432 -U indexer -d ls_indexer -c "SELECT 1;" >/dev/null 2>&1; then
        echo "Database OK"
        return 0
    else
        echo "Database connection failed"
        return 1
    fi
}

cleanup() {
    echo "Shutting down..."
    pkill -f "bun.*index.ts" 2>/dev/null || true
    echo "SSH tunnel kept running for reuse"
    echo "To stop tunnel: pkill -f 'ssh.*${REMOTE_HOST}'"
}

trap cleanup EXIT INT TERM

main() {
    echo "Partisia Indexer"
    echo "================"

    setup_tunnel

    if ! check_database; then
        exit 1
    fi

    echo ""
    echo "System Status:"
    echo "  Tunnel: http://127.0.0.1:${LOCAL_PORT} → ${REMOTE_HOST}:${LOCAL_PORT}"
    echo "  Database: postgresql://indexer@localhost:5432/ls_indexer"
    echo "  API: http://localhost:3002"
    echo ""
    echo "Tracking:"
    echo "  Bot: 000016e01e04096e52e0a6021e877f01760552abfb"
    echo "  Admin: 003b8c03f7ce4bdf1288e0344832d1dc3b62d87fb8"
    echo "  Contract: 02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6"
    echo ""

    cd "$(dirname "$0")"
    bun run src/index.ts
}

main "$@"