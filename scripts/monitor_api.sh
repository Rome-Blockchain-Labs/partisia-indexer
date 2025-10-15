#!/bin/bash
# Monitor API to check if data is advancing

BASE="https://partisia.subgraph.romenet.io"

echo "Monitoring Production API for Data Updates"
echo "=========================================="
echo "Checking every 30 seconds for changes..."
echo ""

# Store initial values
INITIAL_PRICE=$(curl -s "$BASE/mpc/current" | jq -r '.price_usd')
INITIAL_BLOCK=$(curl -s "$BASE/stats" | jq -r '.current.block')
INITIAL_TIME=$(date +%s)

echo "Initial values at $(date):"
echo "  Price: $INITIAL_PRICE"
echo "  Block: $INITIAL_BLOCK"
echo ""
echo "Monitoring for changes..."
echo "-------------------------"

COUNTER=0
while [ $COUNTER -lt 10 ]; do
    sleep 30

    # Get current values
    CURRENT_PRICE=$(curl -s "$BASE/mpc/current" | jq -r '.price_usd')
    CURRENT_BLOCK=$(curl -s "$BASE/stats" | jq -r '.current.block')
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - INITIAL_TIME))

    echo "Check #$((COUNTER + 1)) at $(date) (${ELAPSED}s elapsed):"

    # Check price changes
    if [ "$CURRENT_PRICE" != "$INITIAL_PRICE" ]; then
        echo "  ✅ Price changed: $INITIAL_PRICE → $CURRENT_PRICE"
    else
        echo "  ⏳ Price unchanged: $CURRENT_PRICE"
    fi

    # Check block changes
    if [ "$CURRENT_BLOCK" != "$INITIAL_BLOCK" ]; then
        echo "  ✅ Block advanced: $INITIAL_BLOCK → $CURRENT_BLOCK"
    else
        echo "  ⏳ Block unchanged: $CURRENT_BLOCK"
    fi

    echo ""
    COUNTER=$((COUNTER + 1))
done

echo "Final check - Price history (last 5 entries):"
curl -s "$BASE/mpc/prices?hours=1" | jq '.[:5] | .[] | "\(.time) - $\(.price)"'