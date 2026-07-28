-- Sizes the impact of migration 002 before running it. Read-only.
--
-- If buy-in was never active, every number below is 0 and the migration is a
-- no-op - the stored rates were already correct.

\echo '== how much of history had buy-in tokens locked =='
WITH locked AS (
  SELECT cs.block_number,
         cs.timestamp,
         cs.total_pool_stake_token,
         cs.total_pool_liquid,
         cs.exchange_rate AS stored_rate,
         COALESCE((
           SELECT pp.amount_of_buy_in_locked_stake_tokens
           FROM protocol_parameters pp
           WHERE pp.block_number <= cs.block_number
             AND pp.amount_of_buy_in_locked_stake_tokens IS NOT NULL
           ORDER BY pp.block_number DESC
           LIMIT 1
         ), 0) AS buy_in_locked
  FROM contract_states cs
)
SELECT COUNT(*) FILTER (WHERE buy_in_locked > 0) AS blocks_with_locked_tokens,
       COUNT(*)                                  AS blocks_total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE buy_in_locked > 0) / NULLIF(COUNT(*), 0), 2) AS pct_affected,
       MIN(timestamp) FILTER (WHERE buy_in_locked > 0) AS first_affected,
       MAX(timestamp) FILTER (WHERE buy_in_locked > 0) AS last_affected
FROM locked;

\echo ''
\echo '== worst-case overstatement of the exchange rate =='
WITH locked AS (
  SELECT cs.block_number,
         cs.timestamp,
         cs.total_pool_stake_token,
         cs.total_pool_liquid,
         cs.exchange_rate AS stored_rate,
         COALESCE((
           SELECT pp.amount_of_buy_in_locked_stake_tokens
           FROM protocol_parameters pp
           WHERE pp.block_number <= cs.block_number
             AND pp.amount_of_buy_in_locked_stake_tokens IS NOT NULL
           ORDER BY pp.block_number DESC
           LIMIT 1
         ), 0) AS buy_in_locked
  FROM contract_states cs
),
corrected AS (
  SELECT *,
         CASE
           WHEN total_pool_liquid = 0 OR total_pool_stake_token <= buy_in_locked THEN 1.0
           ELSE TRUNC((total_pool_stake_token - buy_in_locked)::numeric / total_pool_liquid, 10)
         END AS correct_rate
  FROM locked
)
SELECT block_number,
       timestamp,
       stored_rate,
       correct_rate,
       ROUND(100.0 * (stored_rate - correct_rate) / NULLIF(correct_rate, 0), 4) AS overstated_pct
FROM corrected
WHERE stored_rate IS DISTINCT FROM correct_rate
ORDER BY (stored_rate - correct_rate) DESC
LIMIT 10;

\echo ''
\echo '== effect on the published 30d APY =='
-- compares APY computed from stored vs corrected rates over the same window
WITH locked AS (
  SELECT cs.block_number, cs.timestamp, cs.total_pool_stake_token,
         cs.total_pool_liquid, cs.exchange_rate AS stored_rate,
         COALESCE((
           SELECT pp.amount_of_buy_in_locked_stake_tokens
           FROM protocol_parameters pp
           WHERE pp.block_number <= cs.block_number
             AND pp.amount_of_buy_in_locked_stake_tokens IS NOT NULL
           ORDER BY pp.block_number DESC LIMIT 1
         ), 0) AS buy_in_locked
  FROM contract_states cs
  WHERE cs.total_pool_liquid > 0
),
corrected AS (
  SELECT *,
         CASE WHEN total_pool_stake_token <= buy_in_locked THEN 1.0
              ELSE TRUNC((total_pool_stake_token - buy_in_locked)::numeric / total_pool_liquid, 10)
         END AS correct_rate
  FROM locked
),
bounds AS (
  SELECT (SELECT MAX(timestamp) FROM corrected) AS t2,
         (SELECT MAX(timestamp) FROM corrected
          WHERE timestamp <= (SELECT MAX(timestamp) FROM corrected) - INTERVAL '30 days') AS t1
),
endpoints AS (
  SELECT
    (SELECT stored_rate  FROM corrected WHERE timestamp = (SELECT t1 FROM bounds) ORDER BY block_number DESC LIMIT 1) AS stored_r1,
    (SELECT stored_rate  FROM corrected WHERE timestamp = (SELECT t2 FROM bounds) ORDER BY block_number DESC LIMIT 1) AS stored_r2,
    (SELECT correct_rate FROM corrected WHERE timestamp = (SELECT t1 FROM bounds) ORDER BY block_number DESC LIMIT 1) AS correct_r1,
    (SELECT correct_rate FROM corrected WHERE timestamp = (SELECT t2 FROM bounds) ORDER BY block_number DESC LIMIT 1) AS correct_r2,
    EXTRACT(EPOCH FROM ((SELECT t2 FROM bounds) - (SELECT t1 FROM bounds))) / 86400.0 AS actual_days
)
SELECT ROUND(actual_days::numeric, 4) AS actual_days,
       ROUND((100 * (POWER(stored_r2  / NULLIF(stored_r1, 0),  365 / actual_days) - 1))::numeric, 2) AS apy30d_stored,
       ROUND((100 * (POWER(correct_r2 / NULLIF(correct_r1, 0), 365 / actual_days) - 1))::numeric, 2) AS apy30d_corrected
FROM endpoints;
