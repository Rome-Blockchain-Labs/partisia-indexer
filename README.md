# partisia liquid staking indexer

indexes partisia liquid staking protocol state and mpc token prices.

## documentation

- [development guide](DEVELOPMENT.md) - deployment, setup, configuration
- [api documentation](API_DOCS.md) - rest endpoints and graphql schemas

## setup

```bash
git clone repo
cp .env.example .env
docker compose up -d
```

## api

rest: `http://localhost:3002`
graphql: `http://localhost:3002/graphql`

key endpoints:
- `/stats` - protocol state
- `/apy` - yield calculations
- `/mpc/current` - mpc price
- `/exchangeRates` - historical rates
- `/users` - user balances

## development

processes ~75 blocks/second with 1000 block batches.

### github workflows

automated ci/cd with three workflows:

- **test.yaml** - runs tests and api validation on push/pr to main/develop
- **deploy.yaml** - manual deployment to production/development environments on helhetz01/helhetz02 servers
- **release.yaml** - builds x86_64 binary releases on version tags

deployment supports:
- production/development environment selection
- dual server deployment (helhetz01/helhetz02)
- database reset option for chain resyncing
- health checks and rollback capability

## stack

bun + postgres + graphql yoga + coingecko api

## license

mit