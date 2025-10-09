import axios from 'axios';
import db from '../db/client';

const CONTRACT_ADDRESS = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
const STAKING_RESPONSIBLE = '000016e01e04096e52e0a6021e877f01760552abfb';
const API_URL = process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com';

interface AccrueRewardEvent {
  blockNumber: number;
  timestamp: Date;
  userRewards: string;
  protocolRewards: string;
  txHash?: string;
}

class EventIndexer {
  private running = false;
  private lastProcessedBlock = 0;

  async start() {
    this.running = true;
    console.log('🎯 Starting Event Indexer for Liquid Staking Contract');
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Staking Responsible: ${STAKING_RESPONSIBLE}`);

    // Get deployment block
    const deploymentBlock = parseInt(process.env.DEPLOYMENT_BLOCK || '10682802');
    this.lastProcessedBlock = deploymentBlock;

    // Start monitoring
    this.monitorEvents();
  }

  private async monitorEvents() {
    while (this.running) {
      try {
        // Monitor contract state changes for accrue rewards
        await this.detectAccrueRewards();

        // Wait 30 seconds before next check
        await new Promise(r => setTimeout(r, 30000));
      } catch (error) {
        console.error('Event monitoring error:', error.message);
        await new Promise(r => setTimeout(r, 60000));
      }
    }
  }

  private async detectAccrueRewards() {
    try {
      // Get recent contract states
      const states = await db.query(`
        SELECT
          cs1.block_number,
          cs1.timestamp,
          cs1.exchange_rate,
          cs1.total_pool_liquid,
          cs1.total_pool_stake_token,
          cs2.exchange_rate as prev_rate,
          cs2.total_pool_liquid as prev_liquid
        FROM contract_states cs1
        LEFT JOIN contract_states cs2 ON cs2.block_number = (
          SELECT MAX(block_number)
          FROM contract_states
          WHERE block_number < cs1.block_number
        )
        WHERE cs1.block_number > $1
        ORDER BY cs1.block_number ASC
        LIMIT 100
      `, [this.lastProcessedBlock]);

      for (const state of states.rows) {
        if (state.prev_rate && state.exchange_rate > state.prev_rate) {
          // Exchange rate increased - this is an accrue reward event!
          const userRewards = this.calculateRewards(
            state.exchange_rate,
            state.prev_rate,
            state.total_pool_liquid
          );

          // Save as transaction
          await db.saveTransaction({
            txHash: `accrue_${state.block_number}`,
            blockNumber: state.block_number,
            timestamp: state.timestamp,
            action: 'accrueRewards',
            sender: STAKING_RESPONSIBLE,
            amount: userRewards,
            metadata: {
              exchangeRate: state.exchange_rate,
              prevRate: state.prev_rate,
              totalLiquid: state.total_pool_liquid,
              totalStaked: state.total_pool_stake_token,
              userRewards,
              protocolRewards: '0'
            }
          });

          console.log(`💰 Accrue Rewards detected at block ${state.block_number}:`);
          console.log(`   Exchange Rate: ${state.prev_rate} → ${state.exchange_rate}`);
          console.log(`   User Rewards: ${userRewards}`);
        }

        this.lastProcessedBlock = state.block_number;
      }
    } catch (error) {
      console.error('Error detecting accrue rewards:', error.message);
    }
  }

  private calculateRewards(
    newRate: string,
    oldRate: string,
    totalLiquid: string
  ): string {
    try {
      const rateDiff = parseFloat(newRate) - parseFloat(oldRate);
      const liquid = BigInt(totalLiquid);
      const rewards = (rateDiff * Number(liquid)).toFixed(0);
      return rewards;
    } catch (error) {
      return '0';
    }
  }

  async fetchHistoricalEvents() {
    console.log('📚 Fetching historical accrue reward events...');

    try {
      // Get all state changes where rate increased
      const result = await db.query(`
        WITH rate_changes AS (
          SELECT
            block_number,
            timestamp,
            exchange_rate,
            total_pool_liquid,
            total_pool_stake_token,
            LAG(exchange_rate) OVER (ORDER BY block_number) as prev_rate,
            LAG(total_pool_liquid) OVER (ORDER BY block_number) as prev_liquid
          FROM contract_states
          ORDER BY block_number
        )
        SELECT *
        FROM rate_changes
        WHERE prev_rate IS NOT NULL
        AND exchange_rate > prev_rate
        ORDER BY block_number DESC
      `);

      console.log(`Found ${result.rows.length} historical accrue reward events`);

      for (const event of result.rows) {
        const userRewards = this.calculateRewards(
          event.exchange_rate,
          event.prev_rate,
          event.total_pool_liquid
        );

        await db.saveTransaction({
          txHash: `historical_accrue_${event.block_number}`,
          blockNumber: event.block_number,
          timestamp: event.timestamp,
          action: 'accrueRewards',
          sender: STAKING_RESPONSIBLE,
          amount: userRewards,
          metadata: {
            exchangeRate: event.exchange_rate,
            prevRate: event.prev_rate,
            totalLiquid: event.total_pool_liquid,
            totalStaked: event.total_pool_stake_token,
            userRewards,
            protocolRewards: '0',
            historical: true
          }
        });
      }

      console.log('✅ Historical events indexed');
    } catch (error) {
      console.error('Error fetching historical events:', error);
    }
  }

  stop() {
    this.running = false;
    console.log('Event indexer stopped');
  }
}

export default new EventIndexer();