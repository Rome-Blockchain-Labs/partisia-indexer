import db from '../db/client';
import config from '../config';
import axios from 'axios';
import { deserializeState } from '../abi/liquid_staking';
import { Buffer } from 'buffer';

interface BlockState {
  block: number;
  state: string;
  timestamp?: number;
}

class Indexer {
  private running = false;
  private shard = '';
  private currentBlock = 0;
  private lastStateHash = '';
  private startTime = 0;
  private blocksProcessed = 0;

  async start() {
    this.running = true;
    this.startTime = Date.now();

    const contractResp = await axios.get(
      `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}`
    );
    this.shard = contractResp.data.shardId;

    const result = await db.query('SELECT MAX(block_number) as max_block FROM contract_states');
    const lastIndexed = parseInt(result.rows[0]?.max_block) || 0;

    if (lastIndexed > 100000000) {
      throw new Error(`Invalid block number in DB: ${lastIndexed}`);
    }

    this.currentBlock = lastIndexed ? lastIndexed + 1 : config.blockchain.deploymentBlock;

    const batchSize = parseInt(process.env.INDEXER_BATCH_SIZE || '1000');
    const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10');

    console.log(`📌 Contract: ${config.blockchain.contractAddress} on ${this.shard}`);
    console.log(`⚡ Config: ${concurrency} parallel × ${batchSize} blocks`);
    console.log(`🚀 Resume from block ${this.currentBlock}`);

    this.indexLoop();
  }

  async getCurrentBlock(): Promise<number> {
    const resp = await axios.get(`${config.blockchain.apiUrl}/chain/shards/${this.shard}/blocks`);
    return resp.data.blockTime || 0;
  }

  async fetchBlock(block: number): Promise<BlockState | null> {
    try {
      const resp = await axios.get(
        `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}?blockTime=${block}`
      );

      if (resp.data.serializedContract) {
        return { 
          block, 
          state: resp.data.serializedContract,
          timestamp: resp.data.account?.latestStorageFeeTime ? 
            parseInt(resp.data.account.latestStorageFeeTime) : undefined
        };
      }
    } catch {}
    return null;
  }

  async indexLoop() {
    const batchSize = parseInt(process.env.INDEXER_BATCH_SIZE || '1000');
    const concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '10');
    const totalPerBatch = batchSize * concurrency;

    while (this.running) {
      const tipBlock = await this.getCurrentBlock();

      if (!tipBlock) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (!tipBlock || tipBlock === 0) {
        console.error('Invalid tip block:', tipBlock);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const remaining = tipBlock - this.currentBlock;
      const blocksToFetch = Math.min(totalPerBatch, remaining);

      const promises: Promise<BlockState | null>[] = [];
      for (let i = 0; i < blocksToFetch; i++) {
        promises.push(this.fetchBlock(this.currentBlock + i));
      }

      const allStates: BlockState[] = [];
      for (let i = 0; i < promises.length; i += concurrency) {
        const chunk = promises.slice(i, Math.min(i + concurrency, promises.length));
        const results = await Promise.all(chunk);
        allStates.push(...results.filter(r => r !== null) as BlockState[]);
      }

      allStates.sort((a, b) => a.block - b.block);

      let changes = 0;
      for (const blockState of allStates) {
        if (blockState.state !== this.lastStateHash) {
          const stateBuffer = Buffer.from(blockState.state, 'base64');
          const decoded = deserializeState(stateBuffer);

          const stakeNum = Number(decoded.totalPoolStakeToken);
          const liquidNum = Number(decoded.totalPoolLiquid);
          const rate = liquidNum > 0 ? stakeNum / liquidNum : 1.0;
          const timestamp = blockState.timestamp 
            ? new Date(blockState.timestamp) 
            : new Date();

          await db.query(`
INSERT INTO contract_states (
block_number, timestamp, total_pool_stake_token, total_pool_liquid,
exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (block_number) DO NOTHING
`, [
              blockState.block,
              timestamp,
              decoded.totalPoolStakeToken.toString(),
              decoded.totalPoolLiquid.toString(),
              rate,
              decoded.stakeTokenBalance.toString(),
              decoded.buyInPercentage.toString(),
              decoded.buyInEnabled
            ]);

          await db.query(`
INSERT INTO current_state (id, block_number, timestamp, total_pool_stake_token,
total_pool_liquid, exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled)
VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
block_number = EXCLUDED.block_number,
timestamp = EXCLUDED.timestamp,
total_pool_stake_token = EXCLUDED.total_pool_stake_token,
total_pool_liquid = EXCLUDED.total_pool_liquid,
exchange_rate = EXCLUDED.exchange_rate,
stake_token_balance = EXCLUDED.stake_token_balance,
buy_in_percentage = EXCLUDED.buy_in_percentage,
buy_in_enabled = EXCLUDED.buy_in_enabled
`, [
              blockState.block,
              timestamp,
              decoded.totalPoolStakeToken.toString(),
              decoded.totalPoolLiquid.toString(),
              rate,
              decoded.stakeTokenBalance.toString(),
              decoded.buyInPercentage.toString(),
              decoded.buyInEnabled
            ]);

          this.lastStateHash = blockState.state;
          changes++;
        }
      }

      const oldBlock = this.currentBlock;
      this.currentBlock += blocksToFetch;
      this.blocksProcessed += blocksToFetch;

      const elapsed = (Date.now() - this.startTime) / 1000;
      const blocksPerSec = this.blocksProcessed / elapsed;
      const blocksRemaining = tipBlock - this.currentBlock;
      const etaSeconds = blocksRemaining / blocksPerSec;

      console.log(
        `📦 ${oldBlock}-${this.currentBlock - 1}: ${changes} changes | ` +
          `${blocksPerSec.toFixed(0)} blocks/s | ` +
          `${((this.currentBlock / tipBlock) * 100).toFixed(2)}% | ` +
          `ETA: ${this.formatETA(etaSeconds)}`
      );
    }
  }

  formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return 'calculating';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(seconds % 60)}s`;
  }

  stop() {
    this.running = false;
  }
}

export default new Indexer();
