# If using port 3002
curl -s http://localhost:3002/api/stats | jq '.'
curl -s "http://localhost:3002/api/exchangeRates?hours=24" | jq '.'
curl -s http://localhost:3002/api/accrueRewards | jq '.'
curl -s "http://localhost:3002/api/daily?days=7" | jq '.'
curl -s http://localhost:3002/api/apy | jq '.'
curl -s http://localhost:3002/api/users | jq '.'
curl -s http://localhost:3002/health | jq '.'
