import { Pool, PoolConfig } from 'pg';
import config from '../config';
import { ContractState } from '../domain/types';

// Strict bounds to prevent resource exhaustion
const concurrency = Math.min(100, Math.max(10, parseInt(process.env.CONCURRENCY || '50')));
const maxConnections = Math.min(50, Math.max(10, concurrency + 5));

const poolConfig: PoolConfig = {
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: maxConnections,
  min: 2, // Maintain minimum connections
  connectionTimeoutMillis: 30000, // Longer timeout for stability
  idleTimeoutMillis: 30000, // Close idle connections
  // acquireTimeoutMillis: 60000, // Don't hang indefinitely - not supported in this pg version
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

const pool = new Pool(poolConfig);

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
});

interface TransactionData {
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  action: string;
  sender: string;
  amount: bigint;
  metadata: Record<string, unknown>;
}

interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
  saveContractState(data: ContractState): Promise<void>;
  saveTransaction(data: TransactionData): Promise<void>;
  getLatestBlock(): Promise<number>;
  close(): Promise<void>;
}

const client: DatabaseClient = {
  async query<T = any>(text: string, params?: any[]) {
    try {
      return await pool.query<T>(text, params);
    } catch (error) {
      console.error('Database query error:', { error: (error as Error).message, query: text });
      throw error;
    }
  },

  async saveContractState(data: ContractState): Promise<void> {
    // Validate required fields exist
    if (!data.blockNumber || !data.timestamp || data.exchangeRate === undefined) {
      throw new Error('Missing required contract state fields');
    }

    const query = `
      INSERT INTO contract_states (
        block_number, timestamp, total_pool_stake_token, total_pool_liquid,
        exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (block_number) DO NOTHING
    `;

    await this.query(query, [
      Number(data.blockNumber), // Convert bigint to number for PostgreSQL
      data.timestamp,
      data.totalPoolStakeToken.toString(),
      data.totalPoolLiquid.toString(),
      data.exchangeRate,
      data.stakeTokenBalance.toString(),
      data.buyInPercentage,
      data.buyInEnabled
    ]);
  },

  async saveTransaction(data: TransactionData): Promise<void> {
    // Validate required fields
    if (!data.txHash || !data.blockNumber || !data.timestamp) {
      throw new Error('Missing required transaction fields');
    }

    const query = `
      INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, amount, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tx_hash) DO NOTHING
    `;

    await this.query(query, [
      data.txHash,
      Number(data.blockNumber),
      data.timestamp,
      data.action,
      data.sender,
      data.amount.toString(),
      JSON.stringify(data.metadata)
    ]);
  },

  async getLatestBlock(): Promise<number> {
    const result = await this.query<{ max_block: number }>('SELECT MAX(block_number) as max_block FROM contract_states');
    return result.rows[0]?.max_block || 0;
  },

  async close(): Promise<void> {
    await pool.end();
  }
};

export default client;
