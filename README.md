# partisia indexer

partisia liquid staking protocol indexer with reward tracking.

## setup

```bash
cp .env.example .env
# configure: DEPLOYMENT_BLOCK, DEPLOYMENT_TIMESTAMP, DB credentials
bunx tsx src/index.ts
```

## api

rest:
- `GET /stats` - protocol state
- `GET /exchangeRates` - historical exchange rates
- `GET /mpc/prices` - mpc price history
- `GET /apy` - yield calculations
- `GET /api/rewards/*` - reward tracking endpoints

graphql: `POST /graphql` - subgraph-compatible queries

## requirements

- bun/node 18+
- postgres 14+
- ssh tunnel: `ssh -L 58081:95.216.235.72:18080 root@helhetz02.romenet.io -N`

## stack

bun + postgres + mexc api