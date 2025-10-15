# Enhanced Partisia Reward Tracking System

## Overview

This enhanced indexer system provides comprehensive reward tracking and exchange rate monitoring for the Partisia blockchain liquid staking protocol. It extends the original indexer with advanced features specifically designed to capture and analyze reward accrual and payout activities.

## Key Features

### 🎯 Comprehensive Reward Tracking
- **Detailed Transaction Analysis**: Captures all reward-related transactions with full context
- **Bot Account Monitoring**: Specific tracking of bot account `000016e01e04096e52e0a6021e877f01760552abfb` activities
- **Exchange Rate Impact Analysis**: Correlates reward activities with exchange rate changes
- **Real-time APY Calculation**: Dynamic APY computation based on recent exchange rate changes

### 💰 Enhanced Price Integration
- **CoinGecko API Integration**: Rate-limited, cached price data fetching
- **Historical Price Backfill**: Automatic backfilling of missing price data
- **USD Value Calculation**: Real-time USD valuation of rewards and pool assets

### 🔍 Validation & Quality Assurance
- **Transaction Validation**: Comprehensive validation against blockchain data
- **Consistency Checking**: Automated detection of indexing inconsistencies
- **Performance Monitoring**: Bot account performance analytics

### 📊 Advanced Analytics
- **Daily Aggregations**: Automated daily reward summaries
- **APY Trends**: Historical and real-time APY calculations
- **Impact Analysis**: How rewards affect exchange rates and pool composition

## Architecture

### Database Schema

The enhanced system adds several new tables to support detailed tracking:

#### `reward_transactions`
Stores detailed information about each reward-related transaction:
```sql
- tx_hash: Transaction hash (unique identifier)
- action_type: 'accrue', 'payout', 'manual_accrue'
- initiator_address: Who initiated the transaction
- user_rewards: Rewards distributed to users
- protocol_rewards: Protocol fee portion
- exchange_rate_before/after: Rate context
- is_bot_account: Whether initiated by bot
```

#### `exchange_rate_snapshots`
High-frequency exchange rate monitoring:
```sql
- exchange_rate: Current exchange rate
- rate_change_percent: Percentage change from previous
- apy_instantaneous: Calculated APY from rate change
- total_pool_stake_token: Pool composition
- blocks_since_last_reward: Time tracking
```

#### `bot_account_actions`
Bot-specific activity tracking:
```sql
- bot_address: Bot account address
- action_type: Type of action performed
- success: Whether action succeeded
- rewards_distributed: Amount of rewards distributed
- trigger_reason: What triggered the action
```

#### `reward_summary`
Daily aggregated statistics:
```sql
- date: Summary date
- total_rewards_accrued: Daily reward total
- accrue_transactions: Count of accrue actions
- daily_apy: APY for the day
- bot_success_rate: Bot performance metrics
```

### Service Components

#### Enhanced Reward Indexer (`enhanced-reward-indexer.ts`)
- Monitors blockchain for reward-related transactions
- Parses transaction content to extract reward amounts
- Tracks exchange rate changes and correlates with rewards
- Validates bot account permissions and activities

#### Enhanced CoinGecko Service (`enhanced-coingecko.ts`)
- Rate-limited API calls with intelligent backoff
- Response caching to minimize API usage
- Historical price backfilling
- Real-time price monitoring

#### Reward Validator (`reward-validator.ts`)
- Validates transactions against blockchain data
- Checks reward calculation consistency
- Monitors bot account behavior patterns
- Generates comprehensive validation reports

## API Endpoints

### Reward Data
- `GET /api/rewards/history` - Detailed reward transaction history
- `GET /api/rewards/daily` - Daily reward aggregations
- `GET /api/rewards/impact` - Reward impact on exchange rates
- `GET /api/rewards/dashboard` - Combined dashboard data

### Exchange Rate Analysis
- `GET /exchange-rates/history` - Exchange rate history with granularity
- `GET /apy/current` - Real-time APY calculation
- `GET /apy/trends` - Historical APY trends

### Bot Performance
- `GET /bot/performance` - Bot account metrics and statistics
- `GET /bot/actions` - Detailed bot action history

### System Health
- `GET /api/rewards/health` - System health and validation status
- `GET /status/enhanced` - Enhanced indexer status

## Deployment

### Prerequisites
- PostgreSQL database with existing indexer schema
- Node.js/Bun runtime environment
- Access to Partisia blockchain node (local preferred)
- Optional: CoinGecko API key for higher rate limits

### Installation Steps

1. **Deploy Enhanced Schema**:
   ```bash
   psql -d ls_indexer -f scripts/enhanced-schema.sql
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

3. **Configure Environment**:
   ```bash
   # Update .env file
   PARTISIA_API_URL=http://127.0.0.1:58081  # Local node
   COINGECKO_API_KEY=your_api_key_here       # Optional
   ```

4. **Run Deployment Script**:
   ```bash
   DB_PASSWORD=changeme ./scripts/deploy-enhanced-indexer.sh
   ```

5. **Start Enhanced Indexer**:
   ```bash
   bun run dev
   ```

### Automated Deployment
Use the provided deployment script for automated setup:

```bash
# Basic deployment
DB_PASSWORD=changeme ./scripts/deploy-enhanced-indexer.sh

# With systemd service creation (requires root)
sudo DB_PASSWORD=changeme ./scripts/deploy-enhanced-indexer.sh --create-service

# Skip validation during deployment
DB_PASSWORD=changeme ./scripts/deploy-enhanced-indexer.sh --skip-validation
```

## Configuration

### Environment Variables

```bash
# Blockchain Configuration
PARTISIA_API_URL=http://127.0.0.1:58081
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
PARTISIA_SHARD=2

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer
DB_PASSWORD=changeme

# CoinGecko Configuration
COINGECKO_API_KEY=your_api_key
COINGECKO_COIN_ID=partisia-blockchain
COINGECKO_POLL_INTERVAL=300

# Indexer Configuration
INDEX_INTERVAL_S=30
BATCH_SIZE=100
INDEXER_BATCH_SIZE=1000
INDEXER_CONCURRENCY=10
```

### Rate Limiting Configuration

The system includes intelligent rate limiting for external APIs:

```typescript
// CoinGecko Rate Limits
maxRequestsPerMinute: 30      // Conservative for free tier
maxRequestsPerHour: 500       // Stay under monthly limits
backoffMultiplier: 1.5        // Exponential backoff
maxBackoffMs: 300000          // 5 minutes max backoff

// Blockchain API Rate Limits
rateLimitDelay: 200           // ms between requests
adaptiveBackoff: true         // Adjust based on responses
```

## Monitoring & Validation

### Health Monitoring

The system includes comprehensive health monitoring:

1. **Database Connectivity**: Regular connection health checks
2. **API Response Times**: Monitor blockchain and CoinGecko API performance
3. **Data Freshness**: Ensure recent reward activity is being captured
4. **Bot Performance**: Track bot account success rates and execution times

### Validation Features

1. **Transaction Validation**:
   - Compare indexed data against blockchain
   - Validate reward calculations
   - Check exchange rate consistency

2. **Consistency Checking**:
   - Detect gaps in monitoring
   - Validate reward/rate correlations
   - Check bot account behavior patterns

3. **Automated Reports**:
   - Hourly validation checks
   - Daily performance summaries
   - Weekly comprehensive reports

### Validation Endpoints

```bash
# Run full validation suite
GET /api/rewards/health

# Validate specific transaction
GET /api/rewards/validate/{txHash}

# Get deployment status
GET /status/deployment
```

## Data Analysis

### Reward Analytics

The system provides rich analytics for reward tracking:

1. **Reward History**: Complete transaction-level reward history
2. **Daily Aggregations**: Daily reward totals, counts, and averages
3. **APY Calculations**: Real-time and historical APY data
4. **Impact Analysis**: How rewards affect exchange rates

### Exchange Rate Monitoring

1. **High-Frequency Snapshots**: Exchange rate changes at block level
2. **Rate Change Analysis**: Percentage and absolute changes
3. **Volatility Metrics**: Rate stability measurements
4. **Correlation Analysis**: Rewards vs. rate change correlation

### Bot Performance Metrics

1. **Success Rates**: Transaction success percentages
2. **Execution Times**: Performance timing analysis
3. **Trigger Analysis**: What causes bot actions
4. **Error Tracking**: Failed transaction analysis

## Integration with Frontend

### Dashboard Data

The enhanced system provides comprehensive dashboard data:

```javascript
// Dashboard API response structure
{
  "recent_activity": [...],        // Latest reward transactions
  "today_stats": {...},           // Today's aggregated statistics
  "current_state": {...},         // Current exchange rate and pool state
  "bot_performance": {...}        // Bot account performance metrics
}
```

### Chart Data

Optimized endpoints for chart visualization:

1. **Time Series Data**: Exchange rates, APY, reward amounts over time
2. **Aggregated Views**: Daily, weekly, monthly rollups
3. **Correlation Data**: Reward impact on exchange rates
4. **Performance Metrics**: Bot efficiency and success rates

## Troubleshooting

### Common Issues

1. **No Reward Data**:
   - Check bot account is active
   - Verify blockchain API connectivity
   - Review indexer logs for errors

2. **Rate Limiting**:
   - CoinGecko API limits reached
   - Blockchain API throttling
   - Check backoff settings

3. **Validation Failures**:
   - Exchange rate inconsistencies
   - Missing transaction data
   - Bot account permission issues

### Debug Commands

```bash
# Check indexer status
curl http://localhost:3002/api/rewards/health

# Validate specific transaction
curl http://localhost:3002/api/rewards/validate/aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7

# Get system statistics
curl http://localhost:3002/status/enhanced

# Check recent reward activity
curl http://localhost:3002/api/rewards/dashboard
```

### Log Analysis

Key log messages to monitor:

```
✅ Enhanced Partisia Indexer started successfully
💰 Indexed accrue reward: abc123... (1000000 rewards)
🔍 Running periodic validation...
⚠️  Rate limit hit, increasing backoff
❌ Validation issues detected
```

## Security Considerations

### Bot Account Verification

The system validates that only the authorized bot account can perform reward accrual:

- Bot Account: `000016e01e04096e52e0a6021e877f01760552abfb`
- Admin Account: `003b8c03f7ce4bdf1288e0344832d1dc3b62d87fb8` (cannot accrue rewards)

### API Security

1. **Rate Limiting**: Protects external APIs from abuse
2. **Input Validation**: All API inputs are validated
3. **Error Handling**: Sensitive information not exposed in errors
4. **Access Control**: Database credentials properly secured

### Data Integrity

1. **Transaction Validation**: All indexed data validated against blockchain
2. **Consistency Checks**: Automated detection of data inconsistencies
3. **Backup Procedures**: Automated database backups before deployment
4. **Rollback Capability**: Schema changes can be reversed if needed

## Future Enhancements

### Planned Features

1. **Real-time Notifications**: Alert system for unusual reward patterns
2. **Advanced Analytics**: Machine learning for reward prediction
3. **Multi-Chain Support**: Extension to other Partisia contracts
4. **Enhanced Visualization**: Advanced charting and analytics UI

### Integration Opportunities

1. **Telegram Bot**: Real-time reward notifications
2. **Discord Integration**: Community reward updates
3. **Email Reports**: Automated performance reports
4. **Mobile App**: Native mobile reward tracking

## Support

For issues with the enhanced reward tracking system:

1. Check the validation reports at `/api/rewards/health`
2. Review the deployment logs
3. Verify environment configuration
4. Test individual API endpoints
5. Run the validation suite manually

The system is designed to be self-monitoring and self-healing, with comprehensive logging and validation to ensure accurate reward tracking for the Partisia liquid staking protocol.