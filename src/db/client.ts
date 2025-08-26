import { Pool } from 'pg';
import config from '../config';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
});

export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  
  async saveContractState(data: any) {
    const query = `
      INSERT INTO contract_states (
        block_number, timestamp, total_pool_stake_token, total_pool_liquid,
        exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (block_number) DO NOTHING
    `;
    await this.query(query, [
      data.blockNumber,
      new Date(data.timestamp),
      data.totalPoolStakeToken,
      data.totalPoolLiquid,
      data.exchangeRate,
      data.stakeTokenBalance,
      data.buyInPercentage,
      data.buyInEnabled
    ]);
  },

  async saveTransaction(data: any) {
    const query = `
      INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, amount, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tx_hash) DO NOTHING
    `;
    await this.query(query, [
      data.txHash,
      data.blockNumber,
      new Date(data.timestamp),
      data.action,
      data.sender,
      data.amount,
      JSON.stringify(data.metadata)
    ]);
  },

  async getLatestBlock(): Promise<number> {
    const result = await this.query('SELECT MAX(block_number) as max_block FROM contract_states');
    return result.rows[0]?.max_block || 0;
  },

  async close() {
    await pool.end();
  }
};
