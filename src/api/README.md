# Partisia Indexer API

## Overview
RESTful API with versioning support and GraphQL endpoint for querying blockchain data.

## Base URL
```
http://localhost:3000/api/v1
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-10-20T12:00:00.000Z",
    "requestId": "req_1729425600000_abc123",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-10-20T12:00:00.000Z",
    "requestId": "req_1729425600000_abc123",
    "version": "1.0.0"
  }
}
```

## Endpoints

### System Health
- **GET /api/v1/health**
  - Returns system health status
  - Checks database and indexer health
  ```json
  {
    "status": "healthy",
    "checks": {
      "database": "ok",
      "indexer": "ok"
    },
    "uptime": 12345.67
  }
  ```

### Indexer
- **GET /api/v1/indexer/status**
  - Returns indexer synchronization status
  - Shows state and transaction indexer progress
  ```json
  {
    "state": {
      "currentBlock": 1234567,
      "targetBlock": 1234600,
      "blocksRemaining": 33,
      "progressPercent": 99.97,
      "blocksPerSecond": 5.2,
      "syncComplete": false
    },
    "transactions": {
      "currentBlock": 1234560,
      "transactionsProcessed": 45678,
      "contractTxFound": 1234,
      "adminTxFound": 56
    },
    "overall": {
      "syncing": true,
      "healthy": true
    }
  }
  ```

### Contract State
- **GET /api/v1/contract/current**
  - Returns current contract state
  ```json
  {
    "blockNumber": 1234567,
    "timestamp": "2025-10-20T12:00:00.000Z",
    "exchangeRate": 1.0234,
    "totalPoolStakeToken": "1000000000000",
    "totalPoolLiquid": "980000000000",
    "stakeTokenBalance": "1000000000000",
    "buyInPercentage": 0.5,
    "buyInEnabled": true,
    "tvlUsd": "100000.00"
  }
  ```

- **GET /api/v1/contract/history**
  - Query params: `limit` (default: 100, max: 1000), `offset` (default: 0)
  - Returns historical contract states
  ```json
  {
    "states": [...],
    "count": 100,
    "hasMore": true
  }
  ```

### Transactions
- **GET /api/v1/transactions**
  - Query params: `limit` (default: 50, max: 500), `offset` (default: 0)
  - Returns list of transactions
  ```json
  {
    "transactions": [...],
    "count": 50,
    "hasMore": true
  }
  ```

- **GET /api/v1/transactions/:txHash**
  - Returns specific transaction by hash
  ```json
  {
    "tx_hash": "0x...",
    "block_number": 1234567,
    "action": "stake",
    "sender": "0x...",
    "amount": "1000000",
    "timestamp": "2025-10-20T12:00:00.000Z",
    "metadata": {...}
  }
  ```

### Rewards
- **GET /api/v1/rewards/accrue**
  - Query params: `limit` (default: 100, max: 500), `offset` (default: 0)
  - Returns accrue reward transactions
  ```json
  {
    "rewards": [
      {
        "blockNumber": 1234567,
        "userRewardAmount": "1000",
        "protocolRewardAmount": "100",
        "exchangeRate": "1.0234",
        "txHash": "0x...",
        "timestamp": "2025-10-20T12:00:00.000Z",
        "rewardType": 3,
        "isExtended": true
      }
    ],
    "count": 100,
    "hasMore": true
  }
  ```

### Users
- **GET /api/v1/users**
  - Query params: `limit` (default: 100, max: 1000), `offset` (default: 0)
  - Returns list of users sorted by balance
  ```json
  {
    "users": [
      {
        "address": "0x...",
        "balance": "1000000",
        "firstSeen": "2025-10-01T00:00:00.000Z",
        "lastSeen": "2025-10-20T12:00:00.000Z"
      }
    ],
    "count": 100,
    "hasMore": true
  }
  ```

- **GET /api/v1/users/:address**
  - Returns specific user by address

### Analytics
- **GET /api/v1/analytics/apy**
  - Returns APY calculations for 24h, 7d, and 30d periods
  ```json
  {
    "apy24h": "5.23",
    "apy7d": "5.18",
    "apy30d": "5.15",
    "syncComplete": true
  }
  ```

- **GET /api/v1/analytics/daily**
  - Query params: `days` (default: 30, min: 1, max: 365)
  - Returns daily aggregated statistics
  ```json
  {
    "dailyData": [
      {
        "date": "2025-10-20T00:00:00.000Z",
        "firstBlock": 1234000,
        "lastBlock": 1234567,
        "lowRate": 1.0230,
        "highRate": 1.0240,
        "avgRate": 1.0235,
        "sampleCount": 567
      }
    ],
    "days": 30,
    "count": 30
  }
  ```

- **GET /api/v1/analytics/stats**
  - Returns protocol statistics
  ```json
  {
    "deployment": {
      "block": 1000000,
      "timestamp": "2025-01-01T00:00:00.000Z",
      "initialRate": "1.0"
    },
    "current": {
      "block": 1234567,
      "rate": "1.0234",
      "totalStaked": "1000000000000",
      "totalLiquid": "980000000000",
      "contractBalance": "1000000000000",
      "timestamp": "2025-10-20T12:00:00.000Z"
    },
    "metrics": {
      "totalUsers": 1234
    }
  }
  ```

- **GET /api/v1/analytics/stats/combined**
  - Returns combined stats including price data
  ```json
  {
    "price": {
      "mpcUsd": 0.0523,
      "timestamp": "2025-10-20T12:00:00.000Z"
    },
    "tvl": {
      "tokens": "1000000000000",
      "usd": "52300.00"
    },
    "liquidSupply": {
      "tokens": "980000000000",
      "usd": "51234.00"
    },
    "exchangeRate": "1.0234",
    "currentBlock": 1234567
  }
  ```

- **GET /api/v1/analytics/exchange-rates**
  - Query params: `hours` (default: 24, min: 1, max: 8760)
  - Returns exchange rate history
  ```json
  {
    "exchangeRates": [
      {
        "timestamp": "2025-10-20T12:00:00.000Z",
        "exchangeRate": 1.0234
      }
    ],
    "hours": 24,
    "count": 144
  }
  ```

### Prices
- **GET /api/v1/prices/current**
  - Returns current MPC token price
  ```json
  {
    "timestamp": "2025-10-20T12:00:00.000Z",
    "priceUsd": 0.0523,
    "marketCapUsd": 52300000.00,
    "volume24hUsd": 125000.00
  }
  ```

- **GET /api/v1/prices/history**
  - Query params: `hours` (default: 24, min: 1, max: 8760)
  - Returns historical MPC prices
  ```json
  {
    "prices": [
      {
        "timestamp": "2025-10-20T12:00:00.000Z",
        "priceUsd": 0.0523,
        "marketCapUsd": 52300000.00,
        "volume24hUsd": 125000.00
      }
    ],
    "hours": 24,
    "count": 24
  }
  ```

## GraphQL Endpoint

**POST /graphql**
- GraphQL API with interactive playground
- Access playground at: http://localhost:3000/graphql
- Supports queries for contract states, users, transactions, rewards, and more

## Architecture

```
src/api/
├── endpoints.ts              # Main Express app
├── middleware/
│   └── response.ts          # Response formatting & error handling
├── v1/                      # V1 API routes
│   ├── index.ts            # Router orchestrator
│   ├── health.ts           # Health endpoints
│   ├── indexer.ts          # Indexer status
│   ├── contract.ts         # Contract state
│   ├── transactions.ts     # Transactions
│   ├── rewards.ts          # Rewards
│   ├── analytics.ts        # Analytics & stats
│   ├── prices.ts           # Price data
│   └── users.ts            # User data
└── README.md               # This file
```

## Features

- **Versioned API**: All endpoints under `/api/v1` for future compatibility
- **Consistent responses**: Standardized success/error format with metadata
- **Request tracking**: Unique request IDs for debugging
- **Error handling**: Centralized error middleware with proper status codes
- **Input validation**: Min/max constraints on numeric inputs
- **Pagination**: Limit/offset support on list endpoints
- **Rate limiting**: 10,000 requests per minute per IP
- **Security headers**: CORS, XSS protection, content type options
- **Type safety**: Full TypeScript support
