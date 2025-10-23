import { decodeAccrueRewardsArgs } from './src/utils/rpcDecoder';

// Sept 1, 2025 accrueRewards transaction
const txContent = 'AQAAAAIAAAADAAAAAQAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAAAAFQAAAHBhcnRpc2lhLWJ1aWx0LWluLXJwYwAAAA8AAAB1bmtub3duLWZvcm1hdAAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAECAAAAAQAAAAFHAAAAAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAEAAAAVAAAAMDJmYzgyYWJmODFjYmIzNmFjZmUxOTZmYWExYWQ0OWRkZmE3YWJkZGE2AAAAAgAAAAMAAABjYWwAAAABAAAAAQAAAAEAAABZAgBQCgAAABIAAAAAAAAAAAAAAAAAAAABAAAAAQ==';

const contract = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

console.log('Testing accrueRewards argument decoder...\n');

const result = decodeAccrueRewardsArgs(txContent, contract);

if (result) {
  console.log('✅ Successfully decoded arguments:');
  console.log(`   stakeTokenAmount: ${result.stakeTokenAmount}`);

  // Convert to human-readable (4 decimals for MPC)
  const amount = BigInt(result.stakeTokenAmount);
  const humanReadable = Number(amount) / 10000;
  console.log(`   Human-readable: ${humanReadable.toFixed(4)} MPC`);
} else {
  console.log('❌ Failed to decode arguments');
}
