import { describe, test, expect, beforeAll } from 'bun:test';
import db from '../db/client';

describe('Indexer', () => {
  beforeAll(async () => {
    await db.query('DELETE FROM contract_states');
  });

  test('saves contract state', async () => {
    await db.saveContractState({
      blockNumber: 1000,
      timestamp: new Date(),
      totalPoolStakeToken: '1000000000000000000000',
      totalPoolLiquid: '1000000000000000000000',
      exchangeRate: 1.0,
      stakeTokenBalance: '0',
      buyInPercentage: '0',
      buyInEnabled: false
    });

    const result = await db.query('SELECT * FROM contract_states WHERE block_number = 1000');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].exchange_rate).toBe('1.0000000000');
  });

  test('calculates exchange rate', () => {
    const stake = 1100000000000000000000n;
    const liquid = 1000000000000000000000n;
    const rate = Number(stake) / Number(liquid);
    expect(rate).toBeCloseTo(1.1, 5);
  });
});
