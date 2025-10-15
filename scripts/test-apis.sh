#!/bin/bash
set -e

# Test script for all APIs - Partisia Reader, Our API, and GraphQL

API_URL="http://localhost:3002"
PARTISIA_URL="http://127.0.0.1:58081"

echo "🧪 Testing Partisia Indexer APIs"
echo "================================="

# Test Partisia Reader API
echo "📡 Testing Partisia Reader API..."
echo "GET $PARTISIA_URL/chain/shards/Shard2/blocks/latest"
curl -s "$PARTISIA_URL/chain/shards/Shard2/blocks/latest" | jq '.blockNumber' || echo "❌ Failed"

echo "GET $PARTISIA_URL/chain/shards/Shard2/blocks/10682802"
curl -s "$PARTISIA_URL/chain/shards/Shard2/blocks/10682802" | jq '.contractUpdates[0].newState.account.latestStorageFeeTime' || echo "❌ Failed"

echo ""

# Test Our REST API
echo "🏠 Testing Our REST API..."
echo "GET $API_URL/status"
curl -s "$API_URL/status" | jq '.' || echo "❌ Failed"

echo "GET $API_URL/current"
curl -s "$API_URL/current" | jq '.' || echo "❌ Failed"

echo "GET $API_URL/exchangeRates?hours=24"
curl -s "$API_URL/exchangeRates?hours=24" | jq 'length' || echo "❌ Failed"

echo "GET $API_URL/apy"
curl -s "$API_URL/apy" | jq '.' || echo "❌ Failed"

echo ""

# Test GraphQL API
echo "🔍 Testing GraphQL API..."
echo "Query: contractStates(first: 3)"
curl -s "$API_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ contractStates(first: 3) { blockNumber exchangeRate timestamp } }"}' \
  | jq '.data.contractStates | length' || echo "❌ Failed"

echo "Query: users(first: 5)"
curl -s "$API_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ users(first: 5) { address balance firstSeen } }"}' \
  | jq '.data.users | length' || echo "❌ Failed"

echo ""
echo "✅ API tests completed"