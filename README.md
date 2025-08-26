# partisia-liquid-staking-indexer

Blockchain indexer for Partisia Liquid Staking protocol. Tracks exchange rates, user balances, and protocol rewards with concurrent block processing.

## Features

- **Concurrent indexing** - Process up to 100 blocks in parallel
- **Real-time sync** - Automatically catches up and follows chain tip
- **REST API** - Query historical rates, rewards, APY, and user data
- **PostgreSQL storage** - Efficient time-series data storage
- **Docker ready** - Single command deployment

## Quick Start

```bash
# Clone repository
git clone https://github.com/rome-labs/partisia-liquid-staking-indexer
cd partisia-liquid-staking-indexer

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run with Docker
docker-compose up -d

# Or run locally
bun install
bun run dev
```

## Configuration

```env
# Required
PARTISIA_API_URL=https://reader.partisiablockchain.com
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
DEPLOYMENT_BLOCK=10547814

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer
DB_PASSWORD=changeme

# Performance tuning
INDEXER_BATCH_SIZE=100    # Blocks per batch
INDEXER_CONCURRENCY=10    # Parallel requests
INDEX_INTERVAL_S=10       # Poll interval when synced
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Current protocol state |
| `GET /api/exchangeRates?hours=24` | Historical exchange rates |
| `GET /api/accrueRewards` | Recent reward events |
| `GET /api/daily?days=7` | Daily aggregated data |
| `GET /api/apy` | Current APY calculations |
| `GET /api/users` | User balances list |
| `GET /health` | Service health check |

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌────────────┐
│   Partisia  │────▶│  Indexer │────▶│ PostgreSQL │
│  Blockchain │     └──────────┘     └────────────┘
└─────────────┘            │
                           ▼
                    ┌──────────┐
                    │ REST API │
                    └──────────┘
```

The indexer:
1. Fetches blocks from Partisia blockchain
2. Extracts Liquid Staking contract state changes
3. Calculates exchange rates and rewards
4. Stores in PostgreSQL for efficient queries
5. Serves data via REST API

## Performance

Default settings process ~80 blocks/second. Tune for your environment:

- **Low latency** (< 50ms to API): `BATCH_SIZE=200, CONCURRENCY=20`
- **High latency** (> 100ms): `BATCH_SIZE=50, CONCURRENCY=5`
- **Rate limited**: Reduce `CONCURRENCY` to 5 or less

## Database Schema

```sql
-- Core state tracking
contract_states (
  block_number BIGINT PRIMARY KEY,
  timestamp TIMESTAMP,
  exchange_rate DECIMAL(20,10),
  total_pool_stake_token TEXT,
  total_pool_liquid TEXT
)

-- User balances
users (
  address TEXT PRIMARY KEY,
  balance TEXT,
  first_seen TIMESTAMP,
  last_seen TIMESTAMP
)

-- Protocol rewards
protocol_rewards (
  block_number BIGINT,
  amount TEXT,
  timestamp TIMESTAMP
)
```

## Development

```bash
# Install dependencies
bun install

# Reset database
./scripts/reset_db.sh

# Run indexer
bun run src/index.ts

# Run API server (separate terminal)
bun run src/api/endpoints.ts

# Test API
curl localhost:3002/api/stats | jq
```

## Docker Deployment

```yaml
version: '3.8'
services:
  indexer:
    build: .
    environment:
      - PARTISIA_API_URL=https://reader.partisiablockchain.com
      - LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
    depends_on:
      - postgres
    ports:
      - "3002:3002"
  
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ls_indexer
      POSTGRES_USER: indexer
      POSTGRES_PASSWORD: changeme
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
```

## License

MIT

