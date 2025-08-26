import db from '../db/client';
import contractService from './contractService';
import config from '../config';
import axios from 'axios';

class Indexer {
  private running = false;
  private currentBlock = 0;
  private lastKnownState: any = {
    totalStake: 0n,
    totalLiquid: 0n,
    rate: 1.0
  };

  async start() {
    this.running = true;
    
    // Get last processed block
    const result = await db.query(
      'SELECT MAX(block_number) as last FROM contract_states'
    );
    
    this.currentBlock = result.rows[0]?.last || config.blockchain.deploymentBlock;
    
    console.log(`Starting historical reconstruction from block ${this.currentBlock}`);
    this.processBlocks();
  }

  async processBlocks() {
    while (this.running) {
      try {
        // Get current chain height
        const chainResp = await axios.get(`${config.blockchain.apiUrl}/chain/shards/Shard2`);
        const chainHeight = chainResp.data.topBlockTime;
        
        if (this.currentBlock >= chainHeight) {
          // Caught up, switch to polling mode
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        
        // Process in batches
        const batchSize = Math.min(100, chainHeight - this.currentBlock);
        const endBlock = this.currentBlock + batchSize;
        
        console.log(`Processing blocks ${this.currentBlock} to ${endBlock}`);
        
        for (let block = this.currentBlock; block <= endBlock; block++) {
          // Check if block has transactions
          const blockResp = await axios.get(
            `${config.blockchain.apiUrl}/chain/shards/Shard2/blocks/${block}`
          );
          
          if (blockResp.data.transactions?.length > 0) {
            // Check each transaction
            for (const txHash of blockResp.data.transactions) {
              const txResp = await axios.get(
                `${config.blockchain.apiUrl}/chain/shards/Shard2/transactions/${txHash}`
              );
              
              // Check if transaction is for our contract
              if (txResp.data.address === config.blockchain.contractAddress) {
                console.log(`Found transaction at block ${block}: ${txHash}`);
                
                // Get state after this block
                const state = await this.getStateAtBlock(block);
                if (state) {
                  await this.saveState(block, state);
                }
              }
            }
          }
          
          // Save checkpoint every 1000 blocks
          if (block % 1000 === 0) {
            const state = await this.getStateAtBlock(block);
            if (state) {
              await this.saveState(block, state);
            }
            console.log(`Checkpoint at block ${block}`);
          }
        }
        
        this.currentBlock = endBlock + 1;
        
      } catch (error) {
        console.error('Error processing blocks:', error);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async getStateAtBlock(blockTime: number) {
    try {
      // Try to get contract state at specific block
      const url = `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}?blockTime=${blockTime}`;
      const resp = await axios.get(url);
      
      // Parse the ABI state if available
      if (resp.data.abi) {
        const state = await contractService.getContractStateAtBlock(blockTime);
        return state;
      }
    } catch (error) {
      // State not available at this block
    }
    return null;
  }

  async saveState(block: number, state: any) {
    const rate = state.totalPoolLiquid > 0n
      ? Number(state.totalPoolStakeToken) / Number(state.totalPoolLiquid)
      : 1.0;
    
    // Check if state actually changed
    const changed = 
      state.totalPoolStakeToken !== this.lastKnownState.totalStake ||
      state.totalPoolLiquid !== this.lastKnownState.totalLiquid;
    
    if (changed) {
      await db.saveContractState({
        blockNumber: block,
        timestamp: Date.now(),
        totalPoolStakeToken: state.totalPoolStakeToken.toString(),
        totalPoolLiquid: state.totalPoolLiquid.toString(),
        exchangeRate: rate,
        stakeTokenBalance: state.stakeTokenBalance.toString(),
        buyInPercentage: Number(state.buyInPercentage || 0),
        buyInEnabled: state.buyInEnabled || true
      });
      
      console.log(`State change at block ${block}: stake=${state.totalPoolStakeToken}, rate=${rate}`);
      
      this.lastKnownState = {
        totalStake: state.totalPoolStakeToken,
        totalLiquid: state.totalPoolLiquid,
        rate
      };
    }
  }

  stop() {
    this.running = false;
  }
}

export default new Indexer();
