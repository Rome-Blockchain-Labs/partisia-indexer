// src/services/indexer.ts
import db from '../db/client';
import config from '../config';
import axios from 'axios';

class Indexer {
  private running = false;
  private currentBlock = 0;
  private stateCache = new Map<number, any>();
  
  async start() {
    this.running = true;
    this.currentBlock = await db.getLatestBlock() || config.blockchain.deploymentBlock;
    
    console.log(`Starting from block ${this.currentBlock}`);
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
        
        // Process in chunks of 100 blocks with 10 concurrent requests
        const chunkSize = 100;
        const concurrency = 10;
        const endBlock = Math.min(this.currentBlock + chunkSize, latestBlock);
        
        const blocks = [];
        for (let b = this.currentBlock + 1; b <= endBlock; b++) {
          blocks.push(b);
        }
        
        // Split into batches for concurrent processing
        const results = [];
        for (let i = 0; i < blocks.length; i += concurrency) {
          const batch = blocks.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(block => this.fetchBlockState(block))
          );
          results.push(...batchResults);
        }
        
        // Process results in order
        let lastState = null;
        for (const result of results) {
          if (result.state && (!lastState || this.stateChanged(lastState, result.state))) {
            await this.saveState(result.block, result.state);
            lastState = result.state;
          }
        }
        
        this.currentBlock = endBlock;
        
        const progress = ((this.currentBlock - config.blockchain.deploymentBlock) / 
                         (latestBlock - config.blockchain.deploymentBlock) * 100).toFixed(2);
        console.log(`Block ${this.currentBlock}/${latestBlock} (${progress}%)`);
        
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
