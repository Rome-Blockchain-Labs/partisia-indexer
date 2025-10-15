-- Flush all data from tables for fresh sync
-- Keep schema intact

TRUNCATE TABLE contract_states CASCADE;
TRUNCATE TABLE current_state CASCADE;
TRUNCATE TABLE mpc_prices CASCADE;
TRUNCATE TABLE price_history CASCADE;
TRUNCATE TABLE protocol_rewards CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reset current state with all required columns
INSERT INTO current_state (id, block_number, exchange_rate, total_pool_stake_token, total_pool_liquid, stake_token_balance, buy_in_percentage, buy_in_enabled, timestamp)
VALUES (1, 0, 1.0, '0', '0', '0', 0.0, false, NOW());

SELECT 'Database flushed and ready for fresh sync' as status;