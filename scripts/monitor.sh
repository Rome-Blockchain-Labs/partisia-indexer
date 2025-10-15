#!/bin/bash

# Monitor script for indexer progress

API_URL="http://localhost:3002"

while true; do
    clear
    echo "🔍 Partisia Indexer Monitor"
    echo "=========================="
    echo "$(date)"
    echo ""

    # Get status
    STATUS=$(curl -s "$API_URL/status" 2>/dev/null)

    if [ $? -ne 0 ]; then
        echo "❌ Indexer not running or API unreachable"
        echo ""
        echo "Start with: bun run dev"
        sleep 5
        continue
    fi

    # Parse status
    PROGRESS=$(echo "$STATUS" | jq -r '.sync.progress // "0%"')
    COMPLETE=$(echo "$STATUS" | jq -r '.sync.complete // false')
    CURRENT=$(echo "$STATUS" | jq -r '.blocks.latest // 0')
    TARGET=$(echo "$STATUS" | jq -r '.blocks.current // 0')
    TOTAL=$(echo "$STATUS" | jq -r '.blocks.total // 0')

    echo "📊 Sync Status"
    echo "Progress: $PROGRESS"
    echo "Complete: $COMPLETE"
    echo "Current Block: $CURRENT"
    echo "Target Block: $TARGET"
    echo "Blocks Indexed: $TOTAL"
    echo ""

    # Get latest exchange rate
    CURRENT_STATE=$(curl -s "$API_URL/current" 2>/dev/null)
    if [ $? -eq 0 ]; then
        RATE=$(echo "$CURRENT_STATE" | jq -r '.exchangeRate // "N/A"')
        BLOCK=$(echo "$CURRENT_STATE" | jq -r '.blockNumber // "N/A"')
        echo "💰 Latest Exchange Rate: $RATE (Block $BLOCK)"
        echo ""
    fi

    # Show last few log lines if available
    if [ -f "indexer.log" ]; then
        echo "📝 Recent Activity:"
        tail -5 indexer.log | grep -E "(Progress:|Batch complete|blocks/sec)" | tail -3
        echo ""
    fi

    echo "Press Ctrl+C to exit"
    sleep 10
done