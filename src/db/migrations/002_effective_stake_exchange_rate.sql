-- 002: exchange_rate must be priced on effective stake
--
-- exchange_rate was stored as total_pool_stake_token / total_pool_liquid, but the
-- contract prices every redemption on effective_stake():
--   total_pool_stake_token - amount_of_buy_in_locked_stake_tokens
-- (see liquid-staking/src/lib.rs effective_stake / exchange_rate_*). Stored rates
-- therefore overstate redeemable value for any block where buy-in tokens were
-- locked, and every APY derived from those rates inherits the error.
--
-- contract_states never persisted the locked amount (the INSERT wrote 8 columns
-- and skipped it), so it is reconstructed from protocol_parameters, which records
-- the value as a step function - one row per change, FK'd to contract_states.
--
-- Run scripts/check-effective-stake-drift.sql first to size the impact.

BEGIN;

-- 1. carry the locked amount onto every contract_states row. Blocks before the
-- first protocol_parameters row predate any buy-in and settle to 0.
UPDATE contract_states cs
SET amount_of_buy_in_locked_stake_tokens = COALESCE((
  SELECT pp.amount_of_buy_in_locked_stake_tokens
  FROM protocol_parameters pp
  WHERE pp.block_number <= cs.block_number
    AND pp.amount_of_buy_in_locked_stake_tokens IS NOT NULL
  ORDER BY pp.block_number DESC
  LIMIT 1
), 0);

-- 2. recompute the rate to match indexer buildContractState exactly: 1.0 when
-- there is no liquid supply or no effective stake, otherwise effective stake over
-- liquid supply. TRUNC (not ROUND) to 10dp mirrors the integer division the
-- indexer does at 1e10 scale.
UPDATE contract_states
SET exchange_rate = CASE
  WHEN total_pool_liquid = 0
    OR total_pool_stake_token <= amount_of_buy_in_locked_stake_tokens
  THEN 1.0
  ELSE TRUNC(
    (total_pool_stake_token - amount_of_buy_in_locked_stake_tokens)::numeric
      / total_pool_liquid, 10)
END;

-- 3. current_state is a denormalized mirror of the newest contract_states row
UPDATE current_state csr
SET exchange_rate = cs.exchange_rate,
    amount_of_buy_in_locked_stake_tokens = cs.amount_of_buy_in_locked_stake_tokens
FROM (
  SELECT exchange_rate, amount_of_buy_in_locked_stake_tokens
  FROM contract_states
  ORDER BY block_number DESC
  LIMIT 1
) cs
WHERE csr.id = 1;

COMMIT;
