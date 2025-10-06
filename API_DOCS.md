# partisia liquid staking indexer api

rest and graphql apis for liquid staking protocol data.

base: `http://localhost:3002`

## rest endpoints

### core
- `GET /health` - server status
- `GET /status` - indexer sync progress
- `GET /api` - endpoint list

### protocol
- `GET /stats` - protocol state + deployment info
- `GET /stats/combined` - protocol state with usd values
- `GET /apy` - yield calculations (24h/7d/30d)
- `GET /daily?days=30` - daily aggregated rates

### rates & prices
- `GET /exchangeRates?hours=24` - historical exchange rates
- `GET /accrueRewards` - reward events from rate changes
- `GET /mpc/current` - current mpc token price
- `GET /mpc/prices?hours=24` - historical mpc prices

### users
- `GET /users` - user balances (top 100 by balance)

## graphql

endpoint: `POST /graphql`
playground: `http://localhost:3002/graphql`

### queries

```graphql
{
  currentState {
    blockNumber
    exchangeRate
    totalStaked
    totalLiquid
    tvlUsd
  }

  exchangeRate {
    mpcPrice
    exchangeRate
    smpcPrice
    premium
  }

  contractStates(first: 10, orderBy: TIMESTAMP_DESC) {
    blockNumber
    timestamp
    exchangeRate
  }

  users(first: 20, orderBy: BALANCE_DESC) {
    address
    balance
  }

  priceHistory(hours: 24) {
    timestamp
    priceUsd
    marketCap
    volume
  }
}
```

### filters

```graphql
contractStates(where: {
  exchangeRate_gt: 1.0
  blockNumber_gte: 13800000
  timestamp_after: "2025-10-01"
})
```

### ordering

`BLOCK_DESC|ASC`, `RATE_DESC|ASC`, `TIMESTAMP_DESC|ASC`
`BALANCE_DESC|ASC`, `FIRST_SEEN_DESC|ASC`

## errors

all endpoints return json. errors use appropriate http codes:
- `400` bad request
- `404` not found
- `500` server error

```json
{"error": "description"}
```

## data format

numbers returned as strings to avoid precision loss.
timestamps in iso format.
hex values converted to decimal.

## setup

```bash
bun install
bun run dev
```

requires postgres database. see deployment.md for full setup.