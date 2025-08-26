// src/services/indexer.ts
import db from '../db/client';
import config from '../config';
import axios from 'axios';

class Indexer {
  private running = false;
  private currentBlock = 0;
  private startTime = 0;
  private processedBlocks = 0;
  
  // Configurable from environment
  private readonly batchSize = parseInt(process.env.INDEXER_BATCH_SIZE || '500');
  private readonly concurrency = parseInt(process.env.INDEXER_CONCURRENCY || '50');
  
  async start() {
    this.running = true;
    this.currentBlock = await db.getLatestBlock() || config.blockchain.deploymentBlock;
    this.startTime = Date.now();
    this.processedBlocks = 0;
    
    console.log(`Starting from block ${this.currentBlock}`);
    console.log(`Config: batch=${this.batchSize}, concurrency=${this.concurrency}`);
    this.scanBlocks();
  }

  async scanBlocks() {
    while (this.running) {
      try {
        const latestResp = await axios.get(
          `${config.blockchain.apiUrl}/chain/shards/Shard2/blocks`
        );
        const latestBlock = latestResp.data.blockTime;
        
        if (this.currentBlock >= latestBlock) {
          await new Promise(r => setTimeout(r, config.indexer.intervalSeconds * 1000));
          continue;
        }
        
        const endBlock = Math.min(this.currentBlock + this.batchSize, latestBlock);
        const blocks = [];
        for (let b = this.currentBlock + 1; b <= endBlock; b++) {
          blocks.push(b);
        }
        
        // Process in concurrent batches
        const results = [];
        for (let i = 0; i < blocks.length; i += this.concurrency) {
          const batch = blocks.slice(i, i + this.concurrency);
          const batchResults = await Promise.all(
            batch.map(block => this.fetchBlockState(block))
          );
          results.push(...batchResults);
        }
        
        // Save states that changed
        let lastState = null;
        for (const result of results) {
          if (result.state && (!lastState || this.stateChanged(lastState, result.state))) {
            await this.saveState(result.block, result.state);
            lastState = result.state;
          }
        }
        
        this.currentBlock = endBlock;
        this.processedBlocks += blocks.length;
        
        // Calculate progress and ETA
        const totalBlocks = latestBlock - config.blockchain.deploymentBlock;
        const completed = this.currentBlock - config.blockchain.deploymentBlock;
        const progress = (completed / totalBlocks * 100).toFixed(2);
        
        const elapsedMs = Date.now() - this.startTime;
        const blocksPerMs = this.processedBlocks / elapsedMs;
        const remainingBlocks = latestBlock - this.currentBlock;
        const etaMs = remainingBlocks / blocksPerMs;
        
        const etaMinutes = Math.floor(etaMs / 60000);
        const etaHours = Math.floor(etaMinutes / 60);
        const etaStr = etaHours > 0 
          ? `${etaHours}h ${etaMinutes % 60}m`
          : `${etaMinutes}m`;
        
        const blocksPerSec = (blocksPerMs * 1000).toFixed(1);
        
        console.log(
          `Block ${this.currentBlock}/${latestBlock} (${progress}%) | ` +
          `Speed: ${blocksPerSec} blocks/s | ETA: ${etaStr}`
        );
        
      } catch (error) {
        console.error('Error:', error.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async fetchBlockState(block: number) {
    try {
      const resp = await axios.get(
        `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}?blockTime=${block}`,
        { timeout: 5000 }
      );
      return { block, state: resp.data.serializedContract };
    } catch (error) {
      return { block, state: null };
    }
  }

  stateChanged(prev: any, curr: any) {
    return prev.totalPoolStakeToken !== curr.totalPoolStakeToken ||
           prev.totalPoolLiquid !== curr.totalPoolLiquid ||
           prev.stakeTokenBalance !== curr.stakeTokenBalance;
  }

  async saveState(block: number, state: any) {
    const totalStake = BigInt(state.totalPoolStakeToken || 0);
    const totalLiquid = BigInt(state.totalPoolLiquid || 0);
    const rate = totalLiquid > 0n ? Number(totalStake * 1000000n / totalLiquid) / 1000000 : 1.0;
    
    await db.saveContractState({
      blockNumber: block,
      timestamp: Date.now(),
      totalPoolStakeToken: totalStake.toString(),
      totalPoolLiquid: totalLiquid.toString(),
      exchangeRate: rate,
      stakeTokenBalance: (BigInt(state.stakeTokenBalance || 0)).toString(),
      buyInPercentage: state.buyInPercentage || '0',
      buyInEnabled: state.buyInEnabled ?? true
    });
    
    console.log(`State saved at block ${block}: rate=${rate.toFixed(6)}`);
  }

  stop() {
    this.running = false;
  }
}

export default new Indexer();
