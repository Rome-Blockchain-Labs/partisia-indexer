import axios from 'axios';
import db from '../db/client';
import { AbiByteInput } from '@partisiablockchain/abi-client';
import { accrueRewards } from '../abi/liquid_staking';

const CONTRACT_ADDRESS = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
const BOT_ACCOUNT = '000016e01e04096e52e0a6021e877f01760552abfb';
const ADMIN_ACCOUNT = '003b8c03f7ce4bdf1288e0344832d1dc3b62d87fb8';
const API_URL = process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com';
const SHARD_ID = process.env.PARTISIA_SHARD || '2';

interface RewardTransaction {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  actionType: 'accrue' | 'payout' | 'manual_accrue';
  initiatorAddress: string;
  rawAmount: string;
  userRewards: string;
  protocolRewards: string;
  netRewards: string;
  exchangeRateBefore?: number;
  exchangeRateAfter?: number;
  mpcPriceUsd?: number;
  isBotAccount: boolean;
  metadata?: any;
}

interface ContractState {
  blockNumber: number;
  timestamp: Date;
  totalPoolStakeToken: string;
  totalPoolLiquid: string;
  exchangeRate: number;
  stakeTokenBalance: string;
}

class EnhancedRewardIndexer {
  private running = false;
  private lastIndexedBlock = 0;
  private previousState: ContractState | null = null;
  private rateLimitDelay = 200; // ms between API calls

  constructor() {
    this.bindMethods();
  }

  private bindMethods() {
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.indexLoop = this.indexLoop.bind(this);
  }

  async start() {
    this.running = true;
    console.log('🎯 Starting Enhanced Reward Indexer');
    console.log(`   Bot Account: ${BOT_ACCOUNT}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);

    // Get last indexed block from our enhanced tables
    const result = await db.query('SELECT MAX(block_number) as last FROM reward_transactions');
    this.lastIndexedBlock = result.rows[0]?.last || 0;

    console.log(`   Starting from block: ${this.lastIndexedBlock}`);

    // Load previous state for comparison
    await this.loadPreviousState();

    this.indexLoop();
  }

  private async loadPreviousState() {
    try {
      const result = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        ORDER BY block_number DESC
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.previousState = {
          blockNumber: row.block_number,
          timestamp: row.timestamp,
          totalPoolStakeToken: row.total_pool_stake_token,
          totalPoolLiquid: row.total_pool_liquid,
          exchangeRate: parseFloat(row.exchange_rate),
          stakeTokenBalance: row.stake_token_balance
        };
        console.log(`   Loaded previous state from block ${this.previousState.blockNumber}`);
      }
    } catch (error) {
      console.error('Error loading previous state:', error.message);
    }
  }

  private async indexLoop() {
    while (this.running) {
      try {
        await this.fetchAndIndexRewards();
        // Check for new rewards every 30 seconds
        await new Promise(r => setTimeout(r, 30000));
      } catch (error) {
        console.error('Enhanced reward indexing error:', error.message);
        await new Promise(r => setTimeout(r, 60000));
      }
    }
  }

  private async fetchAndIndexRewards() {
    try {
      // Fetch recent blocks
      const blocksResponse = await axios.get(
        `${API_URL}/chain/shards/${SHARD_ID}/blocks`,
        {
          params: { limit: 100 },
          timeout: 15000
        }
      );

      const blocks = blocksResponse.data || [];
      let processedBlocks = 0;

      for (const block of blocks) {
        // Skip if we've already processed this block
        if (block.height <= this.lastIndexedBlock) continue;

        // Always take a snapshot of exchange rate changes
        await this.captureExchangeRateSnapshot(block);

        // Check if block has transactions
        if (block.transactions && block.transactions.length > 0) {
          console.log(`📦 Processing block ${block.height} with ${block.transactions.length} transactions`);

          // Check each transaction in the block
          for (const txId of block.transactions) {
            await this.processRewardTransaction(txId, block.height, block.timestamp);

            // Rate limiting to avoid overwhelming the API
            await new Promise(r => setTimeout(r, this.rateLimitDelay));
          }
        }

        this.lastIndexedBlock = block.height;
        processedBlocks++;
      }

      if (processedBlocks > 0) {
        console.log(`✅ Processed ${processedBlocks} new blocks for rewards`);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('🚦 Rate limited, increasing delay');
        this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 2000);
      } else {
        console.error('Error fetching blocks for rewards:', error.message);
      }
    }
  }

  private async captureExchangeRateSnapshot(block: any) {
    try {
      // Get contract state at this block
      const stateResponse = await axios.get(
        `${API_URL}/chain/contracts/${CONTRACT_ADDRESS}`,
        {
          params: { blockTime: block.timestamp },
          timeout: 10000
        }
      );

      if (stateResponse.data && stateResponse.data.serializedState) {
        const state = this.parseContractState(stateResponse.data.serializedState);

        if (state) {
          const currentState: ContractState = {
            blockNumber: block.height,
            timestamp: new Date(block.timestamp),
            totalPoolStakeToken: state.totalPoolStakeToken,
            totalPoolLiquid: state.totalPoolLiquid,
            exchangeRate: parseFloat(state.exchangeRate),
            stakeTokenBalance: state.stakeTokenBalance
          };

          // Calculate rate change
          let rateChangePercent = 0;
          let rateChangeAbsolute = 0;
          let blocksSinceLastReward = 0;

          if (this.previousState) {
            rateChangeAbsolute = currentState.exchangeRate - this.previousState.exchangeRate;
            rateChangePercent = (rateChangeAbsolute / this.previousState.exchangeRate) * 100;
            blocksSinceLastReward = currentState.blockNumber - this.previousState.blockNumber;
          }

          // Save snapshot to database
          await db.query(`
            INSERT INTO exchange_rate_snapshots (
              block_number, timestamp, exchange_rate, rate_change_percent,
              rate_change_absolute, total_pool_stake_token, total_pool_liquid,
              stake_token_balance, blocks_since_last_reward
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (block_number) DO NOTHING
          `, [
            currentState.blockNumber,
            currentState.timestamp,
            currentState.exchangeRate,
            rateChangePercent,
            rateChangeAbsolute,
            currentState.totalPoolStakeToken,
            currentState.totalPoolLiquid,
            currentState.stakeTokenBalance,
            blocksSinceLastReward
          ]);

          // Update previous state
          this.previousState = currentState;
        }
      }
    } catch (error) {
      // Silently handle state fetch errors to avoid spam
      if (error.response?.status !== 404) {
        console.debug(`Could not fetch state for block ${block.height}:`, error.message);
      }
    }
  }

  private async processRewardTransaction(txHash: string, blockNumber: number, timestamp: string) {
    try {
      // Fetch full transaction details
      const txResponse = await axios.get(
        `${API_URL}/chain/shards/${SHARD_ID}/transactions/${txHash}`,
        { timeout: 10000 }
      );

      const tx = txResponse.data;

      // Check if transaction is a reward-related transaction
      if (tx && this.isRewardTransaction(tx)) {
        const rewardTx = await this.parseRewardTransaction(tx, blockNumber, timestamp);

        if (rewardTx) {
          await this.saveRewardTransaction(rewardTx);

          // If this is a bot account action, track it separately
          if (rewardTx.isBotAccount) {
            await this.trackBotAccountAction(rewardTx);
          }

          console.log(`💰 Indexed ${rewardTx.actionType} reward: ${txHash.slice(0, 8)}... (${rewardTx.userRewards} rewards)`);
        }
      }
    } catch (error) {
      // Silently skip if transaction not found or not relevant
      if (error.response?.status !== 404 && error.response?.status !== 500) {
        console.error(`Error processing reward tx ${txHash.slice(0, 8)}:`, error.message);
      }
    }
  }

  private isRewardTransaction(tx: any): boolean {
    try {
      // Check if transaction involves our contract
      if (!tx.content) return false;

      const content = Buffer.from(tx.content, 'base64').toString('hex');

      // Check for contract address
      if (!content.includes(CONTRACT_ADDRESS.replace('0x', ''))) return false;

      // Check for accrueRewards method signature
      if (content.includes('12')) { // accrueRewards method ID from ABI
        return true;
      }

      // Check for other reward-related activities
      if (content.includes('6163637275655265776172647')) { // "accrueRewards" in hex
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private async parseRewardTransaction(tx: any, blockNumber: number, timestamp: string): Promise<RewardTransaction | null> {
    try {
      const content = Buffer.from(tx.content, 'base64');
      const contentHex = content.toString('hex');

      // Determine action type and parse accordingly
      let actionType: 'accrue' | 'payout' | 'manual_accrue' = 'accrue';
      let initiatorAddress = this.extractSender(tx);
      let isBotAccount = initiatorAddress === BOT_ACCOUNT;

      // Parse reward amounts from transaction result or state changes
      const rewardData = await this.extractRewardAmounts(tx, blockNumber);

      // Get exchange rate context
      const exchangeRateContext = await this.getExchangeRateContext(blockNumber);

      const rewardTx: RewardTransaction = {
        txHash: tx.id,
        blockNumber,
        timestamp: new Date(timestamp),
        actionType,
        initiatorAddress,
        rawAmount: rewardData.rawAmount || '0',
        userRewards: rewardData.userRewards || '0',
        protocolRewards: rewardData.protocolRewards || '0',
        netRewards: rewardData.netRewards || rewardData.userRewards || '0',
        exchangeRateBefore: exchangeRateContext?.before,
        exchangeRateAfter: exchangeRateContext?.after,
        isBotAccount,
        metadata: {
          txExecutionStatus: tx.executionStatus,
          gasUsed: tx.gasUsed,
          contentLength: content.length,
          detectedMethods: this.detectContractMethods(contentHex)
        }
      };

      return rewardTx;
    } catch (error) {
      console.error('Error parsing reward transaction:', error.message);
      return null;
    }
  }

  private async extractRewardAmounts(tx: any, blockNumber: number): Promise<{
    rawAmount?: string;
    userRewards?: string;
    protocolRewards?: string;
    netRewards?: string;
  }> {
    try {
      // Method 1: Parse from transaction result events
      if (tx.executionStatus && tx.executionStatus.events) {
        for (const event of tx.executionStatus.events) {
          if (event.eventName === 'RewardAccrued' || event.eventName === 'RewardDistributed') {
            return {
              userRewards: event.userAmount || '0',
              protocolRewards: event.protocolAmount || '0',
              rawAmount: event.totalAmount || '0'
            };
          }
        }
      }

      // Method 2: Calculate from state changes by comparing before/after
      const stateChanges = await this.calculateStateBasedRewards(blockNumber);
      if (stateChanges) {
        return stateChanges;
      }

      // Method 3: Parse from transaction input (for accrueRewards calls)
      if (tx.content) {
        const content = Buffer.from(tx.content, 'base64');
        try {
          const input = AbiByteInput.createLittleEndian(content);
          // Skip method signature
          input.readBytes(1);
          const amount = input.readUnsignedBigInteger(16);
          return {
            rawAmount: amount.toString(),
            userRewards: amount.toString(),
            protocolRewards: '0'
          };
        } catch (e) {
          // Fallback to basic parsing
        }
      }

      return {};
    } catch (error) {
      console.error('Error extracting reward amounts:', error.message);
      return {};
    }
  }

  private async calculateStateBasedRewards(blockNumber: number): Promise<{
    userRewards?: string;
    protocolRewards?: string;
    rawAmount?: string;
  } | null> {
    try {
      // Get state before and after this block
      const beforeState = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        WHERE block_number < $1
        ORDER BY block_number DESC
        LIMIT 1
      `, [blockNumber]);

      const afterState = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        WHERE block_number >= $1
        ORDER BY block_number ASC
        LIMIT 1
      `, [blockNumber]);

      if (beforeState.rows.length > 0 && afterState.rows.length > 0) {
        const before = beforeState.rows[0];
        const after = afterState.rows[0];

        const rateDiff = parseFloat(after.exchange_rate) - parseFloat(before.exchange_rate);
        if (rateDiff > 0) {
          // Calculate rewards based on rate improvement
          const totalLiquid = BigInt(before.total_pool_liquid);
          const rewards = (rateDiff * Number(totalLiquid)).toFixed(0);

          return {
            userRewards: rewards,
            protocolRewards: '0',
            rawAmount: rewards
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error calculating state-based rewards:', error.message);
      return null;
    }
  }

  private async getExchangeRateContext(blockNumber: number): Promise<{
    before?: number;
    after?: number;
  } | null> {
    try {
      const before = await db.query(`
        SELECT exchange_rate FROM exchange_rate_snapshots
        WHERE block_number < $1
        ORDER BY block_number DESC
        LIMIT 1
      `, [blockNumber]);

      const after = await db.query(`
        SELECT exchange_rate FROM exchange_rate_snapshots
        WHERE block_number >= $1
        ORDER BY block_number ASC
        LIMIT 1
      `, [blockNumber]);

      return {
        before: before.rows[0]?.exchange_rate ? parseFloat(before.rows[0].exchange_rate) : undefined,
        after: after.rows[0]?.exchange_rate ? parseFloat(after.rows[0].exchange_rate) : undefined
      };
    } catch (error) {
      return null;
    }
  }

  private detectContractMethods(contentHex: string): string[] {
    const methods = [];

    if (contentHex.includes('12')) methods.push('accrueRewards');
    if (contentHex.includes('10')) methods.push('submit');
    if (contentHex.includes('13')) methods.push('requestUnlock');
    if (contentHex.includes('15')) methods.push('redeem');

    return methods;
  }

  private parseContractState(serializedState: string): any | null {
    try {
      // This would need proper ABI decoding based on the liquid staking contract
      // For now, return a simplified parser
      const stateBytes = Buffer.from(serializedState, 'base64');
      const input = AbiByteInput.createLittleEndian(stateBytes);

      // Skip to the relevant fields (this is simplified)
      // Real implementation would use the liquid_staking ABI decoder
      return {
        totalPoolStakeToken: '0',
        totalPoolLiquid: '0',
        exchangeRate: '1.0',
        stakeTokenBalance: '0'
      };
    } catch (error) {
      return null;
    }
  }

  private extractSender(tx: any): string {
    // Extract sender address from transaction
    if (tx.sender) return tx.sender;
    if (tx.from) return tx.from;
    if (tx.origin) return tx.origin;

    // Try to parse from transaction content/signature
    return 'unknown';
  }

  private async saveRewardTransaction(rewardTx: RewardTransaction) {
    try {
      await db.query(`
        INSERT INTO reward_transactions (
          tx_hash, block_number, timestamp, action_type, initiator_address,
          raw_amount, user_rewards, protocol_rewards, net_rewards,
          exchange_rate_before, exchange_rate_after, is_bot_account, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [
        rewardTx.txHash,
        rewardTx.blockNumber,
        rewardTx.timestamp,
        rewardTx.actionType,
        rewardTx.initiatorAddress,
        rewardTx.rawAmount,
        rewardTx.userRewards,
        rewardTx.protocolRewards,
        rewardTx.netRewards,
        rewardTx.exchangeRateBefore,
        rewardTx.exchangeRateAfter,
        rewardTx.isBotAccount,
        JSON.stringify(rewardTx.metadata)
      ]);
    } catch (error) {
      console.error('Error saving reward transaction:', error.message);
    }
  }

  private async trackBotAccountAction(rewardTx: RewardTransaction) {
    try {
      await db.query(`
        INSERT INTO bot_account_actions (
          tx_hash, block_number, timestamp, bot_address, action_type,
          success, rewards_distributed, exchange_rate_at_action,
          trigger_reason, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [
        rewardTx.txHash,
        rewardTx.blockNumber,
        rewardTx.timestamp,
        BOT_ACCOUNT,
        rewardTx.actionType,
        true, // Assume success if we're indexing it
        rewardTx.userRewards,
        rewardTx.exchangeRateAfter,
        'automated', // Could be enhanced to detect trigger reason
        JSON.stringify({
          initiator: rewardTx.initiatorAddress,
          originalMetadata: rewardTx.metadata
        })
      ]);
    } catch (error) {
      console.error('Error tracking bot account action:', error.message);
    }
  }

  stop() {
    this.running = false;
    console.log('Enhanced reward indexer stopped');
  }

  // Public method to get indexing statistics
  async getRewardIndexingStats() {
    try {
      const [totalRewards, botActions, recentActivity] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM reward_transactions'),
        db.query('SELECT COUNT(*) as count FROM bot_account_actions'),
        db.query(`
          SELECT COUNT(*) as count FROM reward_transactions
          WHERE timestamp > NOW() - INTERVAL '24 hours'
        `)
      ]);

      return {
        total_reward_transactions: parseInt(totalRewards.rows[0].count),
        bot_actions: parseInt(botActions.rows[0].count),
        recent_activity_24h: parseInt(recentActivity.rows[0].count)
      };
    } catch (error) {
      console.error('Error getting reward indexing stats:', error.message);
      return {
        total_reward_transactions: 0,
        bot_actions: 0,
        recent_activity_24h: 0
      };
    }
  }
}

export default new EnhancedRewardIndexer();