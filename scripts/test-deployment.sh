#!/bin/bash

echo "========================================="
echo "PARTISIA INDEXER DEPLOYMENT TEST SUITE"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3002"
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"

    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

# Function to validate JSON
validate_json() {
    local endpoint="$1"
    local field="$2"
    local description="$3"

    value=$(curl -s "$BASE_URL$endpoint" | jq -r "$field" 2>/dev/null)

    if [ "$value" != "null" ] && [ -n "$value" ]; then
        echo -e "${GREEN}✓${NC} $description: $value"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: missing or null"
        ((FAILED++))
        return 1
    fi
}

echo "1. TESTING DATABASE CONNECTIVITY"
echo "---------------------------------"
test_endpoint "GET" "/health" "Health check"
validate_json "/health" ".status" "Database status"
echo ""

echo "2. TESTING REST API ENDPOINTS"
echo "------------------------------"
test_endpoint "GET" "/api" "API documentation"
test_endpoint "GET" "/status" "Indexer status"
test_endpoint "GET" "/stats" "Protocol statistics"
test_endpoint "GET" "/stats/combined" "Combined stats with USD"
test_endpoint "GET" "/exchangeRates?hours=24" "Exchange rates (24h)"
test_endpoint "GET" "/apy" "APY calculations"
test_endpoint "GET" "/daily?days=7" "Daily aggregates"
test_endpoint "GET" "/accrueRewards" "Reward events"
test_endpoint "GET" "/mpc/current" "Current MPC price"
test_endpoint "GET" "/mpc/prices?hours=24" "MPC price history"
test_endpoint "GET" "/users" "User balances"
echo ""

echo "3. VALIDATING DATA INTEGRITY"
echo "-----------------------------"
validate_json "/stats" ".current.rate" "Exchange rate"
validate_json "/stats" ".current.totalStaked" "Total staked"
validate_json "/stats" ".current.totalLiquid" "Total liquid"
validate_json "/stats/combined" ".tvl.tokens" "TVL tokens"
validate_json "/stats/combined" ".tvl.usd" "TVL USD value"
validate_json "/mpc/current" ".price_usd" "MPC price"
validate_json "/apy" ".apy_24h" "24h APY"
echo ""

echo "4. TESTING GRAPHQL ENDPOINT"
echo "----------------------------"
graphql_query='{
  "query": "{ currentState { blockNumber exchangeRate totalStaked totalLiquid tvlUsd } }"
}'

response=$(curl -s -X POST "$BASE_URL/graphql" \
    -H "Content-Type: application/json" \
    -d "$graphql_query")

if echo "$response" | jq -e '.data.currentState' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} GraphQL currentState query"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} GraphQL currentState query"
    ((FAILED++))
fi

graphql_users='{
  "query": "{ users(first: 5) { address balance } }"
}'

response=$(curl -s -X POST "$BASE_URL/graphql" \
    -H "Content-Type: application/json" \
    -d "$graphql_users")

if echo "$response" | jq -e '.data.users' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} GraphQL users query"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} GraphQL users query"
    ((FAILED++))
fi
echo ""

echo "5. CHECKING INDEXER STATUS"
echo "---------------------------"
indexer_status=$(curl -s "$BASE_URL/status")
current_block=$(echo "$indexer_status" | jq -r '.currentBlock')
is_indexing=$(echo "$indexer_status" | jq -r '.indexing')
progress=$(echo "$indexer_status" | jq -r '.progress')

echo "Current block: $current_block"
echo "Indexing: $is_indexing"
echo "Progress: $progress"

if [ "$current_block" != "null" ] && [ "$current_block" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Indexer is syncing blocks"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Indexer block sync issue"
    ((FAILED++))
fi
echo ""

echo "6. CHECKING DATA CONSISTENCY"
echo "-----------------------------"
# Check if exchange rate is reasonable (should be > 1.0)
rate=$(curl -s "$BASE_URL/stats" | jq -r '.current.rate')
if (( $(echo "$rate > 1.0" | bc -l) )); then
    echo -e "${GREEN}✓${NC} Exchange rate is valid: $rate"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Exchange rate might be incorrect: $rate"
    ((FAILED++))
fi

# Check if data is recent
timestamp=$(curl -s "$BASE_URL/stats" | jq -r '.current.timestamp')
if [ "$timestamp" != "null" ]; then
    echo -e "${GREEN}✓${NC} Latest timestamp: $timestamp"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Missing timestamp data"
    ((FAILED++))
fi
echo ""

echo "7. PERFORMANCE CHECK"
echo "--------------------"
start_time=$(date +%s%3N)
for i in {1..10}; do
    curl -s "$BASE_URL/stats" > /dev/null
done
end_time=$(date +%s%3N)
avg_time=$((($end_time - $start_time) / 10))
echo "Average response time for /stats: ${avg_time}ms"

if [ "$avg_time" -lt 100 ]; then
    echo -e "${GREEN}✓${NC} Performance is excellent (<100ms)"
    ((PASSED++))
elif [ "$avg_time" -lt 500 ]; then
    echo -e "${YELLOW}⚠${NC} Performance is acceptable (<500ms)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Performance needs improvement (>${avg_time}ms)"
    ((FAILED++))
fi
echo ""

echo "8. CONTAINER HEALTH CHECK"
echo "--------------------------"
podman-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.State}}" | while read line; do
    echo "$line"
done
echo ""

echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED - READY FOR DEPLOYMENT${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED - REVIEW BEFORE DEPLOYMENT${NC}"
    exit 1
fi