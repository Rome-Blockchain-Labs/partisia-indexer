# API Restructuring - Migration Guide

## Overview
The API has been restructured into a modular, versioned architecture under `/api/v1/`.

## New API Structure

### Core Endpoints
- `GET /api/v1/health` - System health check
- `GET /api/v1/indexer/status` - Indexer sync status

### Contract Data
- `GET /api/v1/contract/current` - Current contract state
- `GET /api/v1/contract/history?limit=100&offset=0` - Contract state history

### Transactions
- `GET /api/v1/transactions?limit=50&offset=0` - List recent transactions
- `GET /api/v1/transactions/:txHash` - Get specific transaction

### Rewards
- `GET /api/v1/rewards/accrue?limit=100&offset=0` - Accrue reward transactions

### Users
- `GET /api/v1/users?limit=100&offset=0` - List top users by balance
- `GET /api/v1/users/:address` - Get specific user

### Analytics
- `GET /api/v1/analytics/apy` - APY calculations (24h, 7d, 30d)
- `GET /api/v1/analytics/daily?days=30` - Daily aggregated data
- `GET /api/v1/analytics/stats` - Protocol statistics
- `GET /api/v1/analytics/stats/combined` - Combined stats with price data
- `GET /api/v1/analytics/exchange-rates?hours=24` - Exchange rate history

### Prices
- `GET /api/v1/prices/current` - Current MPC token price
- `GET /api/v1/prices/history?hours=24` - Historical MPC prices

## Response Format

All v1 endpoints return responses in a consistent format:

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

## Legacy Endpoint Mapping

| Legacy Endpoint | New Endpoint |
|----------------|--------------|
| `GET /api/transactions` | `GET /api/v1/transactions` |
| `GET /api/accrueRewards` | `GET /api/v1/rewards/accrue` |
| `GET /api/stats` | `GET /api/v1/analytics/stats` |
| `GET /api/stats/combined` | `GET /api/v1/analytics/stats/combined` |
| `GET /api/current` | `GET /api/v1/contract/current` |
| `GET /api/apy` | `GET /api/v1/analytics/apy` |
| `GET /api/daily` | `GET /api/v1/analytics/daily` |
| `GET /api/exchangeRates` | `GET /api/v1/analytics/exchange-rates` |
| `GET /api/users` | `GET /api/v1/users` |
| `GET /api/mpc/current` | `GET /api/v1/prices/current` |
| `GET /api/mpc/prices` | `GET /api/v1/prices/history` |
| `GET /api/indexing-progress` | `GET /api/v1/indexer/status` |
| `GET /api/status` | `GET /api/v1/indexer/status` |

## Features

### 1. Consistent Error Handling
All errors are caught and formatted consistently with proper HTTP status codes.

### 2. Request Tracking
Each request gets a unique ID for tracking and debugging.

### 3. Pagination
List endpoints support `limit` and `offset` query parameters.

### 4. Input Validation
All numeric inputs are validated with min/max constraints.

### 5. Type Safety
Full TypeScript support with shared types in `/src/shared/types/`.

## Files Created

```
src/api/
├── middleware/
│   └── response.ts           # Response formatting middleware
├── v1/
│   ├── index.ts              # V1 router orchestrator
│   ├── health.ts             # Health check endpoints
│   ├── indexer.ts            # Indexer status endpoints
│   ├── contract.ts           # Contract state endpoints
│   ├── transactions.ts       # Transaction endpoints
│   ├── rewards.ts            # Reward endpoints
│   ├── analytics.ts          # Analytics endpoints
│   ├── prices.ts             # Price data endpoints
│   └── users.ts              # User endpoints
└── endpoints.ts              # Main app (legacy endpoints to be removed)

src/shared/
└── types/
    └── ApiResponse.ts        # Shared response types
```

## Next Steps

1. ✅ Create new v1 routers
2. ✅ Implement consistent response format
3. ⏳ Remove legacy endpoints from endpoints.ts
4. ⏳ Update frontend to use new endpoints
5. ⏳ Add API versioning headers
6. ⏳ Add comprehensive API documentation
