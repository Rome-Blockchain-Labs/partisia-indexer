# Partisia Indexer Deployment Guide

This guide covers deploying the Partisia Liquid Staking Indexer to production.

## Prerequisites

- Node.js 18+ or Bun runtime
- PostgreSQL 12+
- Access to Partisia Blockchain API

## Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Database Configuration
PGPASSWORD=your_database_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer

# Blockchain Configuration
MEXC_SYMBOL=MPCUSDT
```

## Quick Deployment

### Option 1: Automated Deployment

```bash
npm run deploy
```

This command will:
1. Build the TypeScript code
2. Run database migrations
3. Start the indexer

### Option 2: Manual Step-by-Step

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Run database migrations
npm run db:migrate

# 4. Start the indexer
npm start
```

## Database Setup

### Manual Schema Creation

If you need to create the database schema manually:

```bash
# Run the migration script directly
PGPASSWORD=your_password ./scripts/deploy-schema.sh

# Or execute the SQL file directly
psql -h localhost -U indexer -d ls_indexer -f migrations/001_create_schema.sql
```

### Database Tables Created

The migration creates these tables:
- `contract_states` - Historical contract state snapshots
- `current_state` - Current contract state (singleton)
- `price_history` - Historical price data from MEXC/CoinGecko
- `transactions` - Blockchain transactions
- `users` - User balances and activity

## Services

Once deployed, the indexer provides:

- **GraphQL API**: `http://localhost:3002/graphql`
- **REST API**: `http://localhost:3002/api/`
- **Web Dashboard**: `http://localhost:3002/`
- **Stats Endpoint**: `http://localhost:3002/api/stats`

## Production Considerations

### Process Management

Use a process manager like PM2 for production:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name "partisia-indexer"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Database Optimization

For production PostgreSQL:

```sql
-- Adjust work_mem for better query performance
SET work_mem = '256MB';

-- Enable parallel queries
SET max_parallel_workers_per_gather = 2;

-- Optimize for time-series data
SET random_page_cost = 1.1;
```

### Monitoring

Monitor these key metrics:
- Block processing rate
- Database connection pool usage
- Memory usage during batch processing
- API response times

### Backup Strategy

Regular backups of the database:

```bash
# Create backup
pg_dump -h localhost -U indexer ls_indexer > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h localhost -U indexer -d ls_indexer < backup_file.sql
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   lsof -ti:3002 | xargs kill -9
   ```

2. **Database Connection Errors**
   - Check `PGPASSWORD` environment variable
   - Verify database exists and user has permissions
   - Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

3. **Missing Transactions (404 Errors)**
   - Fixed in latest version by using correct Partisia API endpoints
   - Ensure API URL uses `/chain/` prefix

4. **Memory Issues During Initial Sync**
   - Reduce batch size in configuration
   - Increase Node.js memory limit: `node --max-old-space-size=4096 dist/index.js`

### Log Analysis

Important log patterns to monitor:

```bash
# Success patterns
grep "State changed at block" logs/
grep "MEXC price sync complete" logs/

# Error patterns
grep "ERROR\|Failed" logs/
grep "404\|500" logs/
```

## API Endpoints

### GraphQL Queries

```graphql
# Get recent contract states
query {
  contractStates(first: 10) {
    blockNumber
    timestamp
    exchangeRate
    totalPoolStakeToken
  }
}

# Get price history
query {
  priceHistory(hours: 24) {
    timestamp
    priceUsd
  }
}

# Get current state with TVL
query {
  currentState {
    exchangeRate
    totalStaked
    tvlUsd
  }
}
```

### REST Endpoints

- `GET /api/stats` - Indexer statistics
- `GET /api/current` - Current contract state
- `GET /api/users` - User list with balances
- `GET /api/transactions` - Recent transactions

## Updates and Maintenance

### Updating the Indexer

```bash
# Stop the current process
pm2 stop partisia-indexer

# Pull latest code
git pull

# Install dependencies
npm install

# Build and migrate
npm run build
npm run db:migrate

# Restart
pm2 restart partisia-indexer
```

### Database Maintenance

```sql
-- Vacuum and analyze for performance
VACUUM ANALYZE contract_states;
VACUUM ANALYZE price_history;
VACUUM ANALYZE transactions;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename IN ('contract_states', 'price_history', 'transactions');
```

## Support

For issues and questions:
- Check logs for error details
- Verify blockchain API connectivity
- Ensure database has sufficient disk space
- Monitor memory usage during large batch processing