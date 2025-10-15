#!/bin/bash

# Setup tunnel to Partisia blockchain API
# Usage: ./setup-tunnel.sh [username]

USERNAME=${1:-root}
JUMP_HOST="135.181.252.175"  # helhetz02.romenet.io
REMOTE_HOST="95.216.235.72"  # Target API server
LOCAL_PORT="58081"

echo "🚇 Setting up SSH tunnel to ${REMOTE_HOST}"
echo "   Local: http://127.0.0.1:${LOCAL_PORT}"
echo "   Remote: ${REMOTE_HOST}:18080"

# Check if tunnel already exists
if lsof -Pi :${LOCAL_PORT} -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port ${LOCAL_PORT} already in use. Checking if it's our tunnel..."
    PID=$(lsof -ti:${LOCAL_PORT})
    ps -p $PID -o comm= | grep -q ssh && echo "✅ SSH tunnel already running (PID: $PID)" || echo "❌ Port used by different process"
    exit 0
fi

# Create tunnel
echo "🔗 Creating SSH tunnel..."
ssh -f -N -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
    -L ${LOCAL_PORT}:${REMOTE_HOST}:18080 \
    ${USERNAME}@${JUMP_HOST}

if [ $? -eq 0 ]; then
    echo "✅ SSH tunnel established successfully"
    echo "   Test with: curl http://127.0.0.1:${LOCAL_PORT}/health"
    echo ""
    echo "💡 To stop tunnel: pkill -f 'ssh.*${JUMP_HOST}'"
else
    echo "❌ Failed to establish SSH tunnel"
    echo "   Make sure you have SSH access to ${JUMP_HOST}"
    echo "   Try: ssh ${USERNAME}@${JUMP_HOST}"
    exit 1
fi