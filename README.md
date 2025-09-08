# partisia-liquid-staking-indexer

Indexes Partisia Liquid Staking protocol state and MPC token prices.

## Setup

```bash
git clone https://github.com/rome-labs/partisia-liquid-staking-indexer
cd partisia-liquid-staking-indexer
cp .env.example .env
docker-compose up -d
```

## API

### REST
- `GET /stats` - Protocol state
- `GET /exchangeRates?hours=24` - Historical rates  
- `GET /mpc/current` - MPC price
- `GET /apy` - APY calculation
- `GET /users` - User balances

### GraphQL
```graphql
POST /graphql
{
  currentState { exchangeRate tvlUsd }
  exchangeRate { mpcPrice smpcPrice }
  priceHistory(hours: 24) { priceUsd }
}
```

## Configuration

```env
PARTISIA_API_URL=https://reader.partisiablockchain.com
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
DEPLOYMENT_BLOCK=10682802

# Performance
INDEXER_BATCH_SIZE=1000
INDEXER_CONCURRENCY=10

# CoinGecko
COINGECKO_API_KEY=your_key
```

## Performance

- 1,000 blocks/batch (10 parallel × 100 blocks) in public api before rate limiter slows
- ~75 blocks/second indexing speed
- Historical price backfill from deployment

## Stack

- Bun runtime
- PostgreSQL 
- GraphQL Yoga
- CoinGecko API

## License

MIT
