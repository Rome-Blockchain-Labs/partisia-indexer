# Database Schema

## Single Source of Truth

**Location**: `src/db/schema_sparse.sql`

This is the **only** database schema file used in production. All other schema files have been removed to avoid confusion.

## Schema Overview

The database uses a sparse data design to optimize storage:

### Core Tables

1. **contract_states** - Core contract state (stores every block with state changes)
   - Includes: `buy_in_percentage`, `buy_in_enabled` columns
   - Primary key: `block_number`

2. **governance_changes** - Governance changes (only when they change)
   - References: `contract_states(block_number)`

3. **token_metadata** - Token metadata (rarely changes)
   - References: `contract_states(block_number)`

4. **protocol_parameters** - Protocol parameters (only when they change)
   - References: `contract_states(block_number)`

5. **user_activity** - User activity metrics (only when non-zero)
   - References: `contract_states(block_number)`

6. **current_state** - Latest contract state (singleton table)

7. **transactions** - Blockchain transactions related to the contract

8. **protocol_rewards** - Protocol reward events

9. **users** - User balances and activity tracking

10. **price_history** - Historical price data from various sources
    - Includes: `metadata` JSONB column

11. **mpc_prices** - MPC prices tied to blocks

12. **block_mappings** - Cache for blockTime → blockId mappings
    - Avoids repeated public API calls

## Deployment

The schema is automatically applied during Docker container initialization:

```yaml
volumes:
  - ./src/db/schema_sparse.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
```

## Version History

- **v0.3.0** (2025-10-20)
  - Added `buy_in_percentage` and `buy_in_enabled` to `contract_states`
  - Added `block_mappings` table for caching
  - Added `metadata` JSONB column to `price_history`
  - Consolidated all schemas into single file

## Utility Scripts

- `scripts/flush-db.sql` - Flush database tables for testing
- `hotfix-schema.sql` - One-time hotfix script (not for regular use)
