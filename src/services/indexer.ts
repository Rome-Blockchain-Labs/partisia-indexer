import axios from 'axios';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

class Indexer {
  private running = false;
  private failedBlocks: Map<number, number> = new Map(); // block -> retry count
  private processingBlocks: Set<number> = new Set();

  async start() {
    this.running = true;
    console.log('Indexer started');

    while (this.running) {
      try {
        await this.retryFailedBlocks();

        const currentBlock = await this.getCurrentBlock();
        let lastIndexed = await this.getLastIndexedBlock();
        if (lastIndexed === 0) {
          lastIndexed = parseInt(process.env.DEPLOYMENT_BLOCK || '0');
        }

        if (currentBlock && lastIndexed !== null) {
          const gap = currentBlock - lastIndexed;

          if (gap > 1) {
            const batchSize = Math.min(
              gap - 1,
              parseInt(process.env.INDEXER_BATCH_SIZE || '1000')
            );
            const blocks = Array.from(
              { length: batchSize },
              (_, i) => lastIndexed + i + 1
            );

            console.log(
              `📦 Fetching blocks ${blocks[0]} to ${blocks[blocks.length - 1]}`
            );
            await this.processBlocks(blocks);
          }
        }

        await new Promise((r) =>
          setTimeout(r, parseInt(process.env.INDEX_INTERVAL_S || '10') * 1000)
        );
      } catch (error) {
        console.error('Indexer loop error:', error);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    console.log('Indexer stopped');
  }

  stop() {
    this.running = false;
  }

  async retryFailedBlocks() {
    if (this.failedBlocks.size === 0) return;

    const blocks = Array.from(this.failedBlocks.keys());
    console.log(`Retrying ${blocks.length} failed blocks`);

    for (const block of blocks) {
      if (this.processingBlocks.has(block)) continue;

      const retryCount = this.failedBlocks.get(block) || 0;
      if (retryCount > 10) {
        console.error(
          `Block ${block} failed too many times, manual intervention needed`
        );
        continue;
      }

      this.processingBlocks.add(block);

      try {
        const data = await this.fetchBlockWithRetry(block, 5);
        if (data && data.state) {
          await this.storeBlock(data);
          this.failedBlocks.delete(block);
          console.log(`Successfully recovered block ${block}`);
        } else {
          this.failedBlocks.set(block, retryCount + 1);
        }
      } finally {
        this.processingBlocks.delete(block);
      }
    }
  }

  async fetchBlockWithRetry(block: number, maxRetries: number): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await axios.get(
          `${process.env.PARTISIA_API_URL}/chain/contracts/${CONTRACT_ADDRESS}?blockTime=${block}`,
          { timeout: 10000 }
        );

        if (resp.data?.serializedContract) {
          return {
            block,
            timestamp: new Date(
              resp.data.account?.latestStorageFeeTime
                ? parseInt(resp.data.account.latestStorageFeeTime)
                : Date.now()
            ),
            state: require('../abi/liquid_staking').deserializeState(
              Buffer.from(resp.data.serializedContract, 'base64')
            ),
            latestStorageFeeTime: resp.data.account.latestStorageFeeTime
              ? parseInt(resp.data.account.latestStorageFeeTime)
              : undefined
          };
        }
        return null;
      } catch (err: any) {
        if (err.response?.status === 429) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
          console.log(`Rate limited on block ${block}, waiting ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        } else if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          const delay = 2000 * (attempt + 1);
          console.log(`Network error on block ${block}, waiting ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        } else if (attempt === maxRetries) {
          console.error(`Block ${block} failed permanently:`, err.message);
          return null;
        }
      }
    }
    return null;
  }

  async processBlocks(blocks: number[]) {
    const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10');

    // Process blocks in limited batches
    for (let i = 0; i < blocks.length; i += concurrency) {
      const batch = blocks.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (block) => {
          if (this.processingBlocks.has(block)) return;

          this.processingBlocks.add(block);

          try {
            const data = await this.fetchBlockWithRetry(block, 3);
            if (data && data.state) {
              await this.storeBlock(data);
            } else {
              this.failedBlocks.set(block, 0);
              console.warn(`Block ${block} added to retry queue`);
            }
          } finally {
            this.processingBlocks.delete(block);
          }
        })
      );
    }
  }

  async storeBlock(data: any) {
    const { block, timestamp, state } = data;

    // Calculate exchange rate from totals
    const totalStake = BigInt(state.totalPoolStakeToken || '0');
    const totalLiquid = BigInt(state.totalPoolLiquid || '0');
    const exchangeRate = totalLiquid === 0n ? 1.0 : Number(totalStake) / Number(totalLiquid);

    try {
      await pool.query(
        `
INSERT INTO contract_states (
block_number, timestamp, total_pool_stake_token, total_pool_liquid,
exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (block_number) DO NOTHING
`,
        [
          block,
          timestamp,
          state.totalPoolStakeToken || '0',
          state.totalPoolLiquid || '0',
          exchangeRate,
          state.stakeTokenBalance || '0',
          state.buyInPercentage || '0',
          state.buyInEnabled || false
        ]
      );

      await pool.query(
        `
INSERT INTO current_state (
id, block_number, timestamp, total_pool_stake_token, total_pool_liquid,
exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
block_number = $1, timestamp = $2, total_pool_stake_token = $3,
total_pool_liquid = $4, exchange_rate = $5, stake_token_balance = $6,
buy_in_percentage = $7, buy_in_enabled = $8
WHERE current_state.block_number < $1
`,
        [
          block,
          timestamp,
          state.totalPoolStakeToken || '0',
          state.totalPoolLiquid || '0',
          exchangeRate,
          state.stakeTokenBalance || '0',
          state.buyInPercentage || '0',
          state.buyInEnabled || false
        ]
      );
    } catch (err) {
      console.error(`Failed to store block ${block}:`, err);
      throw err;
    }
  }

  async getCurrentBlock(): Promise<number | null> {
    try {
      const resp = await axios.get(
        `${process.env.PARTISIA_API_URL}/chain/shards/Shard2/blocks`
      );
      return resp.data?.blockTime ?? null;
    } catch (err) {
      console.error('Failed to get current block:', err);
      return null;
    }
  }

  async getLastIndexedBlock(): Promise<number | null> {
    const result = await pool.query(
      'SELECT MAX(block_number) as last_block FROM contract_states'
    );
    return parseInt(result.rows[0]?.last_block) || 0;
  }
}

const indexer = new Indexer();

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  indexer.stop();
  setTimeout(() => process.exit(0), 5000);
});

export default indexer;
