# Partisia Indexer API Documentation

## Overview
This indexer provides a GraphQL-first API for querying Partisia blockchain liquid staking contract data with REST endpoints for compatibility.

## GraphQL API (Primary)
**Endpoint**: `POST http://localhost:3002/graphql`

### Contract States
Query contract state changes over time:

```graphql
query GetContractStates($first: Int!, $orderBy: OrderBy) {
  contractStates(first: $first, orderBy: $orderBy) {
    blockNumber
    timestamp
    exchangeRate
    totalPoolStakeToken
    totalPoolLiquid
    stakeTokenBalance
  }
}
```

**Variables**:
- `first`: Number of records to return (max 1000)
- `orderBy`: `BLOCK_ASC` or `BLOCK_DESC` (default DESC)

### Users
Query user balances and activity:

```graphql
query GetUsers($first: Int!, $orderBy: UserOrderBy) {
  users(first: $first, orderBy: $orderBy) {
    address
    balance
    firstSeen
    lastSeen
    lastBlock
  }
}
```

**Variables**:
- `orderBy`: `BALANCE_DESC`, `BALANCE_ASC`, `FIRST_SEEN_DESC`, etc.

### Current State
Get the latest contract state:

```graphql
query GetCurrentState {
  currentState {
    blockNumber
    timestamp
    exchangeRate
    totalPoolStakeToken
    totalPoolLiquid
    administrator
    tokenName
    tokenSymbol
    tokenDecimals
  }
}
```

## REST API (Compatibility)

### Status
**GET** `/status`

Returns indexer sync status and health:
```json
{
  "mode": "unified-subgraph-style",
  "sync": {
    "complete": false,
    "canCalculateAPY": false,
    "progress": "6.7%",
    "lag": 3180000
  },
  "blocks": {
    "current": 13950000,
    "latest": 10902000,
    "total": 200000
  },
  "health": {
    "status": "healthy"
  }
}
```

### Current State
**GET** `/current`

Returns the latest contract state:
```json
{
  "blockNumber": "10902100",
  "timestamp": "2025-10-15T12:00:00Z",
  "exchangeRate": "1.0038466418",
  "totalPoolStakeToken": "1000000000000",
  "totalPoolLiquid": "996148823742"
}
```

### Exchange Rates
**GET** `/exchangeRates?hours=24`

Returns exchange rate history:
- `hours`: Number of hours back to fetch (default 24, max 8760)

### APY Calculation
**GET** `/apy`

Returns calculated APY if sync is complete:
```json
{
  "apy_24h": "1.20",
  "apy_7d": "1.20",
  "apy_30d": "1.20"
}
```

## Partisia Reader API (Upstream)

### Latest Block
**GET** `http://127.0.0.1:58081/chain/shards/Shard2/blocks/latest`

Returns the latest block number and metadata.

### Specific Block
**GET** `http://127.0.0.1:58081/chain/shards/Shard2/blocks/{blockNumber}`

Returns complete block data including contract updates:
```json
{
  "blockNumber": "10902100",
  "contractUpdates": [{
    "address": "02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6",
    "newState": {
      "serializedContract": "base64-encoded-contract-state",
      "account": {
        "latestStorageFeeTime": "1729000000000"
      }
    }
  }]
}
```

## Environment Configuration

```bash
# Blockchain Configuration
PARTISIA_API_URL=http://127.0.0.1:58081
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
PARTISIA_SHARD=2
DEPLOYMENT_BLOCK=10682802

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer

# Performance Settings
BATCH_SIZE=1000          # Blocks per batch
CONCURRENCY=80           # Parallel requests
MAX_RETRIES=3
```

## Testing Scripts

### Test All APIs
```bash
./scripts/test-apis.sh
```

Tests Partisia Reader API, our REST API, and GraphQL endpoints.

### Individual Endpoint Tests

**Partisia Reader**:
```bash
curl -s "http://127.0.0.1:58081/chain/shards/Shard2/blocks/latest" | jq
```

**Our Status**:
```bash
curl -s "http://localhost:3002/status" | jq
```

**GraphQL Query**:
```bash
curl -s "http://localhost:3002/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ contractStates(first: 5) { blockNumber exchangeRate } }"}'
```

## Architecture

- **Sparse Data Storage**: Only stores governance/metadata changes, not every block
- **Gap Detection**: Automatically fills missing blocks from blockchain
- **Concurrent Processing**: 560+ blocks/sec sustained throughput
- **GraphQL-first**: Modern query interface with REST fallback
- **Production Ready**: 90-minute full sync, real-time updates