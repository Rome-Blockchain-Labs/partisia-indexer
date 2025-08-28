#!/bin/bash
# API endpoint base
BASE="http://localhost:3002"

echo "=== Protocol Stats ==="
curl -s "$BASE/stats" | jq '.'

echo -e "\n=== Exchange Rates (24h) ==="
curl -s "$BASE/exchangeRates?hours=24" | jq '.[:3]'

echo -e "\n=== Accrue Rewards ==="
curl -s "$BASE/accrueRewards" | jq '.accrueRewards[:3]'

echo -e "\n=== Daily Data (7d) ==="
curl -s "$BASE/daily?days=7" | jq '.'

echo -e "\n=== APY Calculations ==="
curl -s "$BASE/apy" | jq '.'

echo -e "\n=== MPC Current Price ==="
curl -s "$BASE/mpc/current" | jq '.'

echo -e "\n=== MPC Price History (24h) ==="
curl -s "$BASE/mpc/prices?hours=24" | jq '.[:3]'

echo -e "\n=== Combined Stats (TVL + USD) ==="
curl -s "$BASE/stats/combined" | jq '.'

echo -e "\n=== Top Users ==="
curl -s "$BASE/users" | jq '.[:5]'

echo -e "\n=== GraphQL: Current State & Rates ==="
curl -sX POST "$BASE/graphql" -H "Content-Type: application/json" \
 -d '{"query":"query{currentState{blockNumber exchangeRate totalStaked totalLiquid tvlUsd}exchangeRate{mpcPrice smpcPrice premium}}"}' | jq '.'

echo -e "\n=== GraphQL: Latest Contract States ==="
curl -sX POST "$BASE/graphql" -H "Content-Type: application/json" \
 -d '{"query":"query{contractStates(first:5,orderBy:BLOCK_DESC){blockNumber exchangeRate timestamp}}"}' | jq '.'

echo -e "\n=== GraphQL: Price History ==="
curl -sX POST "$BASE/graphql" -H "Content-Type: application/json" \
 -d '{"query":"query{priceHistory(hours:1){timestamp priceUsd marketCap volume}}"}' | jq '.data.priceHistory | if . then .[:3] else . end'

echo -e "\n=== GraphQL: Top Users by Balance ==="
curl -sX POST "$BASE/graphql" -H "Content-Type: application/json" \
 -d '{"query":"query{users(first:3,orderBy:BALANCE_DESC){address balance}}"}' | jq '.'

echo -e "\n=== Health Check ==="
curl -s "$BASE/health" | jq '.'
