# Partisia Liquid Staking Indexer

Indexes Partisia liquid staking contract state, transactions, and MPC prices.

## Setup

```bash
cp .env.example .env
# Edit .env: DB credentials, PARTISIA_API_URL, LS_CONTRACT, DEPLOYMENT_BLOCK
npm install
bun run src/index.ts
```

## API

**GraphQL** (primary): `http://localhost:3002/graphql`

### Queries

```graphql
# Contract state history
contractStates(first: Int, skip: Int, orderBy: OrderBy, where: StateFilter): [ContractState!]!

# Current contract state
currentState: CurrentState!

# Exchange rate and prices
exchangeRate: ExchangeRate!

# MPC price history
priceHistory(hours: Int): [Price!]!

# Daily aggregated data
dailyHistory(days: Int, granularity: String): [DailyData!]!
dailyRewards(days: Int, granularity: String): [DailyRewardActual!]!

# Users and balances
users(first: Int, skip: Int, orderBy: UserOrderBy): [User!]!

# Transactions
transactions(first: Int, skip: Int, orderBy: TransactionOrderBy, where: TransactionFilter): [Transaction!]!
rewards(first: Int, skip: Int, orderBy: TransactionOrderBy): [Transaction!]!
```

**Playground**: `http://localhost:3002/graphql`

---

**REST** (optional): `http://localhost:3002/api/v1`

- `GET /api/v1/health` - Health check
- `GET /api/v1/indexer/status` - Indexer sync status
- `GET /api/v1/contract/current` - Current state
- `GET /api/v1/contract/history` - State history
- `GET /api/v1/transactions` - List transactions
- `GET /api/v1/transactions/:txHash` - Transaction details
- `GET /api/v1/rewards/accrue` - Accrue reward transactions
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:address` - User details
- `GET /api/v1/analytics/apy` - APY calculations
- `GET /api/v1/analytics/daily` - Daily stats
- `GET /api/v1/analytics/stats` - Protocol stats
- `GET /api/v1/analytics/exchange-rates` - Exchange rate history
- `GET /api/v1/prices/current` - Current MPC price
- `GET /api/v1/prices/history` - MPC price history

**Frontend**: `http://localhost:3002/`

## Stack

- **Runtime**: Bun
- **Database**: PostgreSQL 14+
- **Blockchain**: Partisia Blockchain
- **Price data**: CoinGecko API

## Configuration

Key `.env` variables:

```bash
# Blockchain
PARTISIA_API_URL=http://95.216.235.72:18080
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
DEPLOYMENT_BLOCK=10682802

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer
DB_PASSWORD=changeme

# Performance
BATCH_SIZE=1000
CONCURRENCY=100
TX_CONCURRENCY=5

# API
API_PORT=3002
COINGECKO_API_KEY=your_key_here
```
