# Production Deployment - Complete Reindex

## What's Being Deployed

**3 commits:**
1. `fbcdc98` - Comprehensive indexer improvements (denomination, ABI extractor fix, etc.)
2. `9580a13` - Updated liquid staking ABI to latest version
3. `55d54d9` - Production database reset script

**Key Changes:**
- Fixed ABI action extractor (now identifies all 13 actions including transfer)
- Dynamic token denomination from database (4 decimals)
- Updated to latest liquid staking contract ABI
- Added `pending_unlock_id_counter` support
- Added `cancelPendingUnlock` action (0x19)
- Raw values in API responses

## Deployment Steps

### 1. SSH into Production
```bash
ssh production-server
cd /path/to/partisia-indexer
```

### 2. Pull Latest Code
```bash
git pull origin master
```

### 3. Install Dependencies (if needed)
```bash
npm install
```

### 4. Build
```bash
npm run build
```

### 5. Stop the Indexer
```bash
# Find the process
ps aux | grep "node dist/index.js"

# Kill it (replace PID)
kill <PID>
```

### 6. Reset the Database
```bash
./scripts/reset-production-db.sh
# Type 'yes' to confirm
```

**This will:**
- Clear all contract_states
- Clear all transactions
- Clear all user_activity
- Reset indexer checkpoints
- Start fresh from deployment block

### 7. Start the Indexer
```bash
nohup node dist/index.js > indexer.log 2>&1 &
echo $! > indexer.pid
```

### 8. Monitor Progress
```bash
# Watch logs
tail -f indexer.log

# Check database progress
PGPASSWORD=changeme psql -h localhost -U indexer -d ls_indexer -c "
SELECT
  (SELECT COUNT(*) FROM contract_states) as states,
  (SELECT COUNT(*) FROM transactions) as txs,
  (SELECT last_scanned_block FROM tx_indexer_checkpoint) as tx_checkpoint;
"
```

## Expected Timeline

- **State Indexer:** ~30-60 minutes (depending on block range)
- **Transaction Indexer:** ~2-4 hours (has to scan all blocks for transactions)

## Verification

### 1. Check API Endpoints
```bash
# Contract state
curl http://localhost:3000/api/v1/contract | jq

# Should show denominated values + raw values
curl http://localhost:3000/api/v1/contract | jq '.data.totalPoolStakeToken, .data.totalPoolStakeTokenRaw, .data.tokenDecimals'

# Transactions
curl http://localhost:3000/api/v1/transactions | jq '.data[0:5]'

# Check for proper action identification (no "unknown")
curl http://localhost:3000/api/v1/transactions | jq '.data[].action' | sort | uniq -c
```

### 2. Check Exchange Rate
```bash
# Make sure exchange rate is correct and increasing over time
PGPASSWORD=changeme psql -h localhost -U indexer -d ls_indexer -c "
SELECT block_number, exchange_rate, total_pool_stake_token, total_pool_liquid
FROM contract_states
ORDER BY block_number DESC
LIMIT 10;
"
```

### 3. Verify No Unknown Transactions
```bash
PGPASSWORD=changeme psql -h localhost -U indexer -d ls_indexer -c "
SELECT action, COUNT(*)
FROM transactions
GROUP BY action
ORDER BY COUNT(*) DESC;
"
```

Should see proper action names, NOT "unknown".

## Rollback Plan

If something goes wrong:

```bash
# Stop indexer
kill $(cat indexer.pid)

# Revert code
git reset --hard <previous-commit>

# Rebuild
npm run build

# Reset DB again
./scripts/reset-production-db.sh

# Restart
nohup node dist/index.js > indexer.log 2>&1 &
```

## Post-Deployment

- Monitor for ~1 hour to ensure indexing progresses smoothly
- Check logs for any errors
- Verify API responses have correct data
- Check frontend displays correctly
