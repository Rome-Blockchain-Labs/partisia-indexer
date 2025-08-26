// src/services/indexer.ts
// forward-only indexer - polls every second and detects missed blocks
// 
// this is really sad hack and will eventually break
// meaning its unable to fetch any missed historical blocks
// because their blockchain reader api does not support query
// of historical data for some unknown reason

import db from '../db/client';
import config from '../config';
import axios from 'axios';
import { deserializeState } from '../abi/liquid_staking';
import { Buffer } from 'buffer';

class Indexer {
 private running = false;
 private lastStateHash = '';
 private shard = '';
 private pollCount = 0;
 private lastBlockHeight = 0;
 private missedBlocks = 0;

 async start() {
   this.running = true;
   
   const contractResp = await axios.get(
     `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}`
   );
   this.shard = contractResp.data.shardId;
   
   // Get last indexed block from database
   this.lastBlockHeight = await db.getLatestBlock() || 0;
   
   console.log(`Starting LS Contract Indexer`);
   console.log(`Contract: ${config.blockchain.contractAddress} on ${this.shard}`);
   console.log(`Last indexed block: ${this.lastBlockHeight}`);
   console.log(`Polling every 1s`);
   
   this.scanLoop();
 }

 async scanLoop() {
   while (this.running) {
     try {
       // Get current block first
       const blockResp = await axios.get(
         `${config.blockchain.apiUrl}/chain/shards/${this.shard}/blocks`
       );
       const currentBlock = blockResp.data.blockTime;
       
       // Check for missed blocks
       if (this.lastBlockHeight > 0 && currentBlock > this.lastBlockHeight + 1) {
         const missed = currentBlock - this.lastBlockHeight - 1;
         this.missedBlocks += missed;
         console.error(`⚠️  ALERT: Missed ${missed} blocks! Gap from ${this.lastBlockHeight} to ${currentBlock}`);
         console.error(`⚠️  Total missed blocks: ${this.missedBlocks}`);
       }
       
       // Get contract state
       const resp = await axios.get(
         `${config.blockchain.apiUrl}/chain/contracts/${config.blockchain.contractAddress}`
       );
       
       this.pollCount++;
       
       if (resp.data.serializedContract && resp.data.serializedContract !== this.lastStateHash) {
         const stateBuffer = Buffer.from(resp.data.serializedContract, 'base64');
         const decoded = deserializeState(stateBuffer);
         
         await this.saveState(currentBlock, decoded);
         this.lastStateHash = resp.data.serializedContract;
         this.lastBlockHeight = currentBlock;
         
         const stakeNum = Number(decoded.totalPoolStakeToken);
         const liquidNum = Number(decoded.totalPoolLiquid);
         const rate = liquidNum > 0 ? stakeNum / liquidNum : 1.0;
         
         console.log(`✅ State saved at block ${currentBlock}: rate=${rate.toFixed(6)}`);
       } else {
         // Update last block even if no state change
         this.lastBlockHeight = currentBlock;
         
         if (this.pollCount % 60 === 0) {
           console.log(`📊 Block ${currentBlock} - Polled ${this.pollCount} times, no changes, missed blocks: ${this.missedBlocks}`);
         }
       }
       
       await new Promise(r => setTimeout(r, 1000));
       
     } catch (error: any) {
       console.error('Error:', error.message);
       await new Promise(r => setTimeout(r, 5000));
     }
   }
 }

 async saveState(block: number, state: any) {
   const stakeNum = Number(state.totalPoolStakeToken);
   const liquidNum = Number(state.totalPoolLiquid);
   const rate = liquidNum > 0 ? stakeNum / liquidNum : 1.0;
   
   await db.saveContractState({
     blockNumber: block,
     timestamp: Date.now(),
     totalPoolStakeToken: state.totalPoolStakeToken.toString(),
     totalPoolLiquid: state.totalPoolLiquid.toString(),
     exchangeRate: rate,
     stakeTokenBalance: state.stakeTokenBalance.toString(),
     buyInPercentage: state.buyInPercentage.toString(),
     buyInEnabled: state.buyInEnabled
   });

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
   `, [block, new Date(), state.totalPoolStakeToken.toString(), 
       state.totalPoolLiquid.toString(), rate, state.stakeTokenBalance.toString(),
       state.buyInPercentage.toString(), state.buyInEnabled]);
 }

 stop() {
   this.running = false;
   if (this.missedBlocks > 0) {
     console.error(`⚠️  Indexer stopped with ${this.missedBlocks} total missed blocks`);
   }
 }
}

export default new Indexer();
