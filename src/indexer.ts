import axios from 'axios';
import config from './config';
import db from './db/client';
import { BlockResponse, RawContractState, ContractState, parseContractState, validateContractState } from './domain/types';

class PartisiaIndexer {
  private running = false;
  private readonly usePublicApi = process.env.PARTISIA_API_URL?.includes('reader.partisiablockchain.com') || false;
  private readonly batchSize = parseInt(process.env.BATCH_SIZE || '1000');
  private readonly baseConcurrency = parseInt(process.env.CONCURRENCY || '50');
  private readonly concurrency = this.usePublicApi ? Math.min(3, this.baseConcurrency) : this.baseConcurrency;
  private readonly retryAttempts = parseInt(process.env.RETRY_ATTEMPTS || '3');
  private readonly retryDelay = parseInt(process.env.RETRY_DELAY_MS || '1000');
  private readonly liquidStakingContract = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
  private readonly stakingResponsible = process.env.STAKING_RESPONSIBLE || '000016e01e04096e52e0a6021e877f01760552abfb';

  private lastPublicApiCall = 0;
  private readonly publicApiRateLimit = 600;

  private currentBlockHeight = 0;
  private lastIndexedBlock = 0;
  private isHealthy = true;
  private syncComplete = false;
  private stats = {
    blocksProcessed: 0,
    batchesProcessed: 0,
    failedBlocks: 0,
    rateLimitedBlocks: 0,
    startTime: Date.now()
  };

  constructor() {}

  async start() {
    console.log('🚀 Starting Partisia Gap-Based Indexer');
    console.log(`📄 Contract: ${this.liquidStakingContract}`);
    console.log(`🌐 API: ${config.blockchain.apiUrl}${this.usePublicApi ? ' (PUBLIC - RATE LIMITED)' : ''}`);
    console.log(`⚙️  Batch Size: ${this.batchSize}`);
    console.log(`🔄 Concurrency: ${this.concurrency}${this.usePublicApi ? ' (reduced for public API)' : ''}`);
    console.log(`🔁 Max Retries: ${this.retryAttempts}`);
    if (this.usePublicApi) {
      console.log(`⏰ Rate Limit: ${(1000 / this.publicApiRateLimit).toFixed(1)} queries/second`);
    }

    this.running = true;
    this.lastIndexedBlock = await this.getLastIndexedBlock();
    this.currentBlockHeight = await this.getCurrentBlockHeight() || 0;

    console.log(`📊 Starting from block ${this.lastIndexedBlock + 1}`);
    console.log(`🎯 Target: ${this.currentBlockHeight} (${this.currentBlockHeight - this.lastIndexedBlock} blocks behind)`);

    while (this.running) {
      try {
        await this.processBatch();
        await this.sleep(this.usePublicApi ? 1000 : 100);
      } catch (error: any) {
        console.error('❌ Batch processing error:', error.message);
        await this.sleep(5000);
      }
    }
  }

  private async processBatch() {
    this.currentBlockHeight = await this.getCurrentBlockHeight() || this.currentBlockHeight;

    const nextBlock = this.lastIndexedBlock + 1;
    const batchEnd = Math.min(nextBlock + this.batchSize - 1, this.currentBlockHeight);

    if (nextBlock > this.currentBlockHeight) {
      console.log(`⏳ Caught up! Waiting for new blocks (current: ${this.currentBlockHeight})`);
      await this.sleep(10000);
      return;
    }

    const batchBlocks = Array.from(
      { length: batchEnd - nextBlock + 1 },
      (_, i) => nextBlock + i
    );

    console.log(`Processing batch: blocks ${nextBlock}-${batchEnd} (${batchBlocks.length} blocks)`);

    const results = await this.processBlocksConcurrently(batchBlocks);

    const successCount = results.filter(r => r.success).length;
    const failedBlocks = results.filter(r => !r.success).map(r => r.block);

    if (failedBlocks.length > 0) {
      console.error(`Failed blocks: [${failedBlocks.join(', ')}]`);
      await this.retryFailedBlocks(failedBlocks);
    }

    // Update last indexed block regardless of activity
    this.lastIndexedBlock = batchEnd;
    this.stats.batchesProcessed++;
    this.stats.blocksProcessed += (batchEnd - nextBlock + 1);

    const progress = ((this.lastIndexedBlock - config.blockchain.deploymentBlock) /
                     (this.currentBlockHeight - config.blockchain.deploymentBlock) * 100);

    const blocksPerSecond = this.stats.blocksProcessed / ((Date.now() - this.stats.startTime) / 1000);
    const eta = (this.currentBlockHeight - this.lastIndexedBlock) / blocksPerSecond;

    const apiInfo = this.usePublicApi ? ' [PUBLIC API]' : '';
    console.log(`Indexer progress: ${progress.toFixed(1)}% complete, block ${this.lastIndexedBlock}/${this.currentBlockHeight}, rate: ${blocksPerSecond.toFixed(1)} blocks/s, ETA: ${Math.round(eta/60)}min${apiInfo}`);
  }


  private async processBlocksConcurrently(blocks: number[]): Promise<Array<{block: number, success: boolean}>> {
    const results: Array<{block: number, success: boolean}> = [];

    for (let i = 0; i < blocks.length; i += this.concurrency) {
      const chunk = blocks.slice(i, i + this.concurrency);

      const chunkPromises = chunk.map(async (block) => {
        const success = await this.processBlockWithRetry(block);
        return { block, success };
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ Promise failed:`, result.reason);
          results.push({ block: -1, success: false });
        }
      }

      if (i + this.concurrency < blocks.length) {
        await this.sleep(50);
      }
    }

    return results;
  }

  private async processBlockWithRetry(blockNumber: number): Promise<boolean> {
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        if (this.usePublicApi) {
          await this.rateLimitPublicApi();
        }

        const success = await this.processBlock(blockNumber);
        if (success) return true;
        return true;
      } catch (error: any) {
        if (error.response?.status === 429 || error.message.includes('429')) {
          this.stats.rateLimitedBlocks++;
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 30000);
          console.warn(`⏰ Block ${blockNumber} hit rate limit (attempt ${attempt}), waiting ${delay}ms`);
          await this.sleep(delay);
          continue;
        } else {
          if (attempt >= this.retryAttempts) {
            console.warn(`❌ Block ${blockNumber} failed after ${this.retryAttempts} attempts: ${error.message}`);
            return false;
          }
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    console.warn(`❌ Block ${blockNumber} failed after 10 rate limit attempts`);
    return false;
  }

  private async rateLimitPublicApi(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastPublicApiCall;
    if (timeSinceLastCall < this.publicApiRateLimit) {
      await this.sleep(this.publicApiRateLimit - timeSinceLastCall);
    }
    this.lastPublicApiCall = Date.now();
  }

  private async retryFailedBlocks(failedBlocks: number[]) {
    console.log(`🔁 Retrying ${failedBlocks.length} failed blocks...`);
    const retryResults = await this.processBlocksConcurrently(failedBlocks);
    const stillFailed = retryResults.filter(r => !r.success).length;
    if (stillFailed > 0) {
      console.warn(`⚠️  ${stillFailed} blocks still failed after retry`);
    } else {
      console.log(`✅ All failed blocks recovered`);
    }
  }

  private async processBlock(blockNumber: number): Promise<boolean> {
    try {
      const contractState = await this.getContractState(blockNumber);
      if (!contractState) return false;
      await this.handleLiquidStakingState(blockNumber, contractState);
      return true;
    } catch (error: any) {
      throw error;
    }
  }

  private async handleLiquidStakingState(blockNumber: number, blockResponse: BlockResponse) {
    if (!blockResponse.serializedContract) {
      throw new Error(`No serialized contract data for block ${blockNumber}`);
    }

    const state = require('./abi/liquid_staking').deserializeState(
      Buffer.from(blockResponse.serializedContract, 'base64')
    );

    const timestamp = blockResponse.account?.latestStorageFeeTime
      ? new Date(blockResponse.account.latestStorageFeeTime)
      : new Date();

    const stakeAmount = BigInt(state.totalPoolStakeToken?.toString() || '0');
    const liquidAmount = BigInt(state.totalPoolLiquid?.toString() || '0');
    const exchangeRate = liquidAmount === 0n ? 1.0 : Number(stakeAmount) / Number(liquidAmount);

    let mpcPrice = 0;
    try {
      const priceResult = await db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1');
      mpcPrice = parseFloat(priceResult.rows[0]?.price_usd) || 0;
    } catch (e) {
      mpcPrice = 0;
    }

    const smpcPrice = mpcPrice * exchangeRate;
    const totalSmpcValueUsd = (Number(liquidAmount) / 1e6) * smpcPrice;

    let pendingUnlocksCount = 0;
    let totalPendingUnlockAmount = '0';

    if (state.pendingUnlocks && typeof state.pendingUnlocks.entries === 'function') {
      try {
        const entries = Array.from(state.pendingUnlocks.entries());
        pendingUnlocksCount = entries.length;
        let total = 0n;
        for (const [address, unlocks] of entries as any) {
          if (Array.isArray(unlocks)) {
            for (const unlock of unlocks) {
              total += BigInt(unlock.liquidAmount?.toString() || '0');
            }
          }
        }
        totalPendingUnlockAmount = total.toString();
      } catch (e: any) {
        console.warn(`Warning: Could not process pendingUnlocks for block ${blockNumber}: ${e.message}`);
      }
    }

    let buyInTokensCount = 0;
    if (state.buyInTokens && typeof state.buyInTokens.entries === 'function') {
      try {
        buyInTokensCount = Array.from(state.buyInTokens.entries()).length;
      } catch (e: any) {
        console.warn(`Warning: Could not process buyInTokens for block ${blockNumber}: ${e.message}`);
      }
    }

    const currentState = {
      exchangeRate: parseFloat(exchangeRate.toFixed(10)),
      totalPoolStakeToken: parseInt(stakeAmount.toString()),
      totalPoolLiquid: parseInt(liquidAmount.toString()),
      stakeTokenBalance: parseInt(state.stakeTokenBalance?.toString() || '0'),
      buyInPercentage: parseFloat((state.buyInPercentage || 0).toString()),
      buyInEnabled: !!state.buyInEnabled
    };

    const lastStateResult = await db.query(`
      SELECT exchange_rate, total_pool_stake_token, total_pool_liquid,
             stake_token_balance, buy_in_percentage, buy_in_enabled
      FROM contract_states
      ORDER BY block_number DESC
      LIMIT 1
    `);

    let shouldStore = lastStateResult.rows.length === 0;

    if (lastStateResult.rows.length > 0) {
      const lastState = lastStateResult.rows[0];

      shouldStore = (
        parseFloat(lastState.exchange_rate) !== currentState.exchangeRate ||
        parseInt(lastState.total_pool_stake_token) !== currentState.totalPoolStakeToken ||
        parseInt(lastState.total_pool_liquid) !== currentState.totalPoolLiquid ||
        parseInt(lastState.stake_token_balance) !== currentState.stakeTokenBalance ||
        parseFloat(lastState.buy_in_percentage) !== currentState.buyInPercentage ||
        !!lastState.buy_in_enabled !== currentState.buyInEnabled
      );
    }

    const isSignificantChange = shouldStore && (
      currentState.stakeTokenBalance !== 0 ||
      currentState.totalPoolStakeToken !== 0 ||
      currentState.totalPoolLiquid !== 0 ||
      blockNumber % 1000 === 0
    );

    if (isSignificantChange) {
      await db.query(`
        INSERT INTO contract_states (
          block_number, timestamp, exchange_rate,
          total_pool_stake_token, total_pool_liquid, stake_token_balance,
          buy_in_percentage, buy_in_enabled, total_smpc_value_usd
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (block_number) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          exchange_rate = EXCLUDED.exchange_rate,
          total_pool_stake_token = EXCLUDED.total_pool_stake_token,
          total_pool_liquid = EXCLUDED.total_pool_liquid,
          stake_token_balance = EXCLUDED.stake_token_balance,
          buy_in_percentage = EXCLUDED.buy_in_percentage,
          buy_in_enabled = EXCLUDED.buy_in_enabled,
          total_smpc_value_usd = EXCLUDED.total_smpc_value_usd
      `, [
        blockNumber, timestamp, exchangeRate,
        stakeAmount.toString(), liquidAmount.toString(),
        state.stakeTokenBalance?.toString() || '0',
        state.buyInPercentage?.toString() || '0',
        state.buyInEnabled || false,
        totalSmpcValueUsd
      ]);

      console.log(`📝 Stored significant state at block ${blockNumber}: stake=${currentState.stakeTokenBalance}, rate=${currentState.exchangeRate}`);
    } else if (shouldStore) {
      console.log(`⏩ Skipping minor change at block ${blockNumber} (no significant change)`);
    }

    await this.storeSparseData(blockNumber, state, pendingUnlocksCount, buyInTokensCount, totalPendingUnlockAmount);
    if (blockNumber >= this.lastIndexedBlock - 100) {
      await db.query(`
        INSERT INTO current_state (id, block_number, timestamp, exchange_rate,
          total_pool_stake_token, total_pool_liquid, stake_token_balance,
          buy_in_percentage, buy_in_enabled,
          token_for_staking, staking_responsible, administrator,
          length_of_cooldown_period, length_of_redeem_period, amount_of_buy_in_locked_stake_tokens,
          token_name, token_symbol, token_decimals,
          pending_unlocks_count, buy_in_tokens_count, total_pending_unlock_amount, total_smpc_value_usd
        ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (id) DO UPDATE SET
          block_number = EXCLUDED.block_number,
          timestamp = EXCLUDED.timestamp,
          exchange_rate = EXCLUDED.exchange_rate,
          total_pool_stake_token = EXCLUDED.total_pool_stake_token,
          total_pool_liquid = EXCLUDED.total_pool_liquid,
          stake_token_balance = EXCLUDED.stake_token_balance,
          buy_in_percentage = EXCLUDED.buy_in_percentage,
          buy_in_enabled = EXCLUDED.buy_in_enabled,
          token_for_staking = EXCLUDED.token_for_staking,
          staking_responsible = EXCLUDED.staking_responsible,
          administrator = EXCLUDED.administrator,
          length_of_cooldown_period = EXCLUDED.length_of_cooldown_period,
          length_of_redeem_period = EXCLUDED.length_of_redeem_period,
          amount_of_buy_in_locked_stake_tokens = EXCLUDED.amount_of_buy_in_locked_stake_tokens,
          token_name = EXCLUDED.token_name,
          token_symbol = EXCLUDED.token_symbol,
          token_decimals = EXCLUDED.token_decimals,
          pending_unlocks_count = EXCLUDED.pending_unlocks_count,
          buy_in_tokens_count = EXCLUDED.buy_in_tokens_count,
          total_pending_unlock_amount = EXCLUDED.total_pending_unlock_amount,
          total_smpc_value_usd = EXCLUDED.total_smpc_value_usd
        WHERE current_state.block_number <= EXCLUDED.block_number
      `, [blockNumber, timestamp, exchangeRate,
          stakeAmount.toString(), liquidAmount.toString(),
          state.stakeTokenBalance?.toString() || '0',
          state.buyInPercentage?.toString() || '0',
          state.buyInEnabled || false,
          state.tokenForStaking?.toString() || null,
          state.stakingResponsible?.toString() || null,
          state.administrator?.toString() || null,
          state.lengthOfCooldownPeriod?.toString() || null,
          state.lengthOfRedeemPeriod?.toString() || null,
          state.amountOfBuyInLockedStakeTokens?.toString() || null,
          state.liquidTokenState?.name || null,
          state.liquidTokenState?.symbol || null,
          state.liquidTokenState?.decimals || null,
          pendingUnlocksCount,
          buyInTokensCount,
          totalPendingUnlockAmount,
          totalSmpcValueUsd]);
    }
  }


  // Store sparse data only when values actually change
  private async storeSparseData(blockNumber: number, state: any, pendingUnlocksCount: number, buyInTokensCount: number, totalPendingUnlockAmount: string) {
    // Get current governance values (properly converted)
    const governance = {
      administrator: state.administrator?.toString() || null,
      staking_responsible: state.stakingResponsible?.toString() || null,
      token_for_staking: state.tokenForStaking?.toString() || null
    };

    // Only store governance if values actually changed
    const lastGov = await db.query(`
      SELECT administrator, staking_responsible, token_for_staking
      FROM governance_changes
      ORDER BY block_number DESC LIMIT 1
    `);

    const prevGov = lastGov.rows[0];
    const govChanged = !prevGov ||
      prevGov.administrator !== governance.administrator ||
      prevGov.staking_responsible !== governance.staking_responsible ||
      prevGov.token_for_staking !== governance.token_for_staking;

    if (govChanged && (governance.administrator || governance.staking_responsible || governance.token_for_staking)) {
      await db.query(`
        INSERT INTO governance_changes (block_number, administrator, staking_responsible, token_for_staking)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (block_number) DO NOTHING
      `, [blockNumber, governance.administrator, governance.staking_responsible, governance.token_for_staking]);
    }

    // Only store token metadata if it changed (usually only once at deployment)
    const metadata = {
      name: state.liquidTokenState?.name || null,
      symbol: state.liquidTokenState?.symbol || null,
      decimals: state.liquidTokenState?.decimals || null
    };

    const lastMeta = await db.query(`
      SELECT token_name, token_symbol, token_decimals
      FROM token_metadata
      ORDER BY block_number DESC LIMIT 1
    `);

    const prevMeta = lastMeta.rows[0];
    const metaChanged = !prevMeta ||
      prevMeta.token_name !== metadata.name ||
      prevMeta.token_symbol !== metadata.symbol ||
      prevMeta.token_decimals !== metadata.decimals;

    if (metaChanged && (metadata.name || metadata.symbol || metadata.decimals !== null)) {
      await db.query(`
        INSERT INTO token_metadata (block_number, token_name, token_symbol, token_decimals)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (block_number) DO NOTHING
      `, [blockNumber, metadata.name, metadata.symbol, metadata.decimals]);
    }

    // Only store protocol parameters if they changed
    const parameters = {
      cooldown_period: state.lengthOfCooldownPeriod?.toString() || null,
      redeem_period: state.lengthOfRedeemPeriod?.toString() || null,
      buy_in_percentage: state.buyInPercentage?.toString() || null,
      buy_in_enabled: state.buyInEnabled || null,
      buy_in_locked_tokens: state.amountOfBuyInLockedStakeTokens?.toString() || null
    };

    const lastParams = await db.query(`
      SELECT length_of_cooldown_period, length_of_redeem_period, buy_in_percentage,
             buy_in_enabled, amount_of_buy_in_locked_stake_tokens
      FROM protocol_parameters
      ORDER BY block_number DESC LIMIT 1
    `);

    const prevParams = lastParams.rows[0];
    const paramsChanged = !prevParams ||
      prevParams.length_of_cooldown_period !== parameters.cooldown_period ||
      prevParams.length_of_redeem_period !== parameters.redeem_period ||
      prevParams.buy_in_percentage !== parameters.buy_in_percentage ||
      prevParams.buy_in_enabled !== parameters.buy_in_enabled ||
      prevParams.amount_of_buy_in_locked_stake_tokens !== parameters.buy_in_locked_tokens;

    if (paramsChanged && (parameters.cooldown_period || parameters.redeem_period || parameters.buy_in_percentage ||
        parameters.buy_in_enabled !== null || parameters.buy_in_locked_tokens)) {
      await db.query(`
        INSERT INTO protocol_parameters (
          block_number, length_of_cooldown_period, length_of_redeem_period,
          buy_in_percentage, buy_in_enabled, amount_of_buy_in_locked_stake_tokens
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (block_number) DO NOTHING
      `, [blockNumber, parameters.cooldown_period, parameters.redeem_period,
          parameters.buy_in_percentage, parameters.buy_in_enabled, parameters.buy_in_locked_tokens]);
    }

    // Store user activity only if there's any activity (already optimal)
    if (pendingUnlocksCount > 0 || buyInTokensCount > 0 || totalPendingUnlockAmount !== '0') {
      await db.query(`
        INSERT INTO user_activity (block_number, pending_unlocks_count, buy_in_tokens_count, total_pending_unlock_amount)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (block_number) DO UPDATE SET
          pending_unlocks_count = EXCLUDED.pending_unlocks_count,
          buy_in_tokens_count = EXCLUDED.buy_in_tokens_count,
          total_pending_unlock_amount = EXCLUDED.total_pending_unlock_amount
      `, [blockNumber, pendingUnlocksCount, buyInTokensCount, totalPendingUnlockAmount]);
    }
  }

  // Handle user balance changes (optimized for batch processing)
  private async handleUserBalances(blockNumber: number, rawState: any) {
    const state = require('./abi/liquid_staking').deserializeState(
      Buffer.from(rawState.serializedContract, 'base64')
    );

    if (!state.liquidTokenState?.balances) return;

    const timestamp = rawState.account?.latestStorageFeeTime
      ? new Date(rawState.account.latestStorageFeeTime)
      : new Date();

    // Batch insert for better performance
    const values: any[] = [];
    const placeholders: string[] = [];
    let i = 1;

    const balanceEntries = typeof state.liquidTokenState.balances.entries === 'function'
      ? Array.from(state.liquidTokenState.balances.entries())
      : Object.entries(state.liquidTokenState.balances);

    for (const [address, balance] of balanceEntries as any) {
      const balanceStr = balance?.toString() || '0';
      if (balanceStr !== '0') {
        values.push(address, balanceStr, timestamp);
        placeholders.push(`($${i}, $${i+1}, $${i+2}, $${i+2})`);
        i += 3;
      }
    }

    if (placeholders.length > 0) {
      await db.query(`
        INSERT INTO users (address, balance, first_seen, last_seen)
        VALUES ${placeholders.join(',')}
        ON CONFLICT (address) DO UPDATE SET
          balance = EXCLUDED.balance,
          last_seen = EXCLUDED.last_seen
        WHERE users.last_seen < EXCLUDED.last_seen
      `, values);
    }
  }

  // Real-time mode for when sync is complete

  // Utility methods
  private async getCurrentBlockHeight(): Promise<number | null> {
    try {
      const url = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks`;
      console.log('🔍 DEBUG: Getting block height from:', url);

      const response = await axios.get(url, {
        timeout: 8000
      });

      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Block height:', response.data?.blockTime);

      return response.data?.blockTime || null;
    } catch (error: any) {
      console.warn('⚠️  Failed to get block height:', (error as Error).message);
      console.warn('🔍 DEBUG: Full error:', error.response?.status, error.response?.data);

      // Return a reasonable fallback based on database state
      const latestInDb = await db.getLatestBlock();
      return latestInDb + 1000; // Assume we're 1000 blocks behind if API fails
    }
  }

  private async getContractState(blockNumber: number): Promise<BlockResponse | null> {
    if (this.usePublicApi) {
      await this.rateLimitPublicApi();
    }

    const response = await axios.get(
      `${config.blockchain.apiUrl}/chain/contracts/${this.liquidStakingContract}?blockTime=${blockNumber}`,
      { timeout: 10000, validateStatus: (s) => s === 200 || s === 404 }
    );

    if (response.status === 404 || !response.data?.serializedContract) {
      return null;
    }

    const rawData = response.data;
    const blockResponse: BlockResponse = {
      ...rawData,
      timestamp: rawData.timestamp ? parseInt(rawData.timestamp) : Date.now(),
      account: rawData.account ? {
        ...rawData.account,
        latestStorageFeeTime: rawData.account.latestStorageFeeTime
          ? parseInt(rawData.account.latestStorageFeeTime)
          : undefined
      } : undefined
    };

    if (blockResponse.contractState && !validateContractState(blockResponse.contractState)) {
      console.warn(`⚠️  Invalid contract state at block ${blockNumber}, skipping`);
      return null;
    }

    return blockResponse;
  }

  private async getLastIndexedBlock(): Promise<number> {
    console.log('📊 Finding first gap in indexed blocks...');

    // Find the first gap in our blocks
    const gapResult = await db.query(`
      WITH gaps AS (
        SELECT block_number,
               LEAD(block_number) OVER (ORDER BY block_number) - block_number - 1 as gap_size
        FROM contract_states
        WHERE block_number >= ${config.blockchain.deploymentBlock}
        ORDER BY block_number
      )
      SELECT block_number + 1 as gap_start
      FROM gaps
      WHERE gap_size > 0
      ORDER BY block_number
      LIMIT 1
    `);

    if (gapResult.rows.length > 0) {
      const gapStart = gapResult.rows[0].gap_start - 1;
      console.log(`📊 Found gap starting at block ${gapStart + 1}, resuming from ${gapStart}`);
      return gapStart;
    }

    // If no gaps, get the actual maximum
    const result = await db.query(`
      SELECT COALESCE(MAX(block_number), ${config.blockchain.deploymentBlock - 1}) as last_block
      FROM contract_states
      WHERE block_number >= ${config.blockchain.deploymentBlock}
    `);

    const lastBlock = parseInt(result.rows[0]?.last_block) || (config.blockchain.deploymentBlock - 1);
    console.log(`📊 No gaps found, resuming from last indexed block: ${lastBlock}`);
    return lastBlock;
  }


  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_blocks,
        MIN(block_number) as earliest_block,
        MAX(block_number) as latest_block
      FROM contract_states
    `);

    const totalBlocks = parseInt(result.rows[0]?.total_blocks) || 0;
    const expectedBlocks = Math.max(0, this.currentBlockHeight - config.blockchain.deploymentBlock + 1);
    const progressPercent = expectedBlocks > 0 ? (totalBlocks / expectedBlocks * 100) : 0;

    return {
      totalBlocks,
      earliestBlock: parseInt(result.rows[0]?.earliest_block) || null,
      latestBlock: parseInt(result.rows[0]?.latest_block) || null,
      currentBlockHeight: this.currentBlockHeight,
      lastIndexedBlock: this.lastIndexedBlock,
      lag: this.currentBlockHeight - this.lastIndexedBlock,
      progressPercent: progressPercent,
      syncComplete: this.syncComplete,
      isHealthy: this.isHealthy,
      canCalculateAPY: this.syncComplete && this.isHealthy,
      performance: {
        blocksProcessed: this.stats.blocksProcessed,
        batchesProcessed: this.stats.batchesProcessed,
        failedBlocks: this.stats.failedBlocks,
        rateLimitedBlocks: this.stats.rateLimitedBlocks,
        blocksPerSecond: this.stats.blocksProcessed / ((Date.now() - this.stats.startTime) / 1000),
        uptime: Math.round((Date.now() - this.stats.startTime) / 1000),
        usingPublicApi: this.usePublicApi
      },
      config: {
        batchSize: this.batchSize,
        concurrency: this.concurrency,
        retryAttempts: this.retryAttempts
      }
    };
  }

  // Process transactions for admin calls and rewards using 3-step API process
  private async processBlockTransactions(blockNumber: number, blockTimestamp: Date): Promise<void> {
    try {
      // Step 1: Get block identifier from blockTime
      // TEMP: Use public API for block identifier fetching due to outdated local node
      const publicApiUrl = process.env.TEMP_PUBLIC_API_FOR_BLOCKS || config.blockchain.apiUrl;

      // Rate limit public API calls to avoid hitting rate limits (max 2 per second)
      if (publicApiUrl !== config.blockchain.apiUrl) {
        await this.rateLimitPublicApi();
      }

      const blockTimeUrl = `${publicApiUrl}/chain/shards/${config.blockchain.shard}/blocks?blockTime=${blockNumber}`;
      const blockTimeResponse = await axios.get(blockTimeUrl, { timeout: 10000 });

      if (!blockTimeResponse.data || !blockTimeResponse.data.identifier) {
        return; // Could not get block identifier
      }

      const blockId = blockTimeResponse.data.identifier;

      // Step 2: Get full block with transaction IDs using block identifier
      const blockUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks/${blockId}`;
      const blockResponse = await axios.get(blockUrl, { timeout: 10000 });

      if (!blockResponse.data || !blockResponse.data.transactions || blockResponse.data.transactions.length === 0) {
        return; // No transactions in this block
      }

      const transactionIds = blockResponse.data.transactions;

      // Step 3: Fetch each transaction individually
      for (const txId of transactionIds) {
        try {
          const txUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/transactions/${txId}`;
          const txResponse = await axios.get(txUrl, { timeout: 10000 });

          if (!txResponse.data) {
            continue;
          }

          const tx = txResponse.data;

          // Process all transactions - we'll identify contract calls during transaction processing
          console.log(`🔍 DEBUG: Processing transaction ${txId} in block ${blockNumber}`);
          await this.processTransaction(tx, blockNumber, blockTimestamp);
        } catch (txError: any) {
          console.warn(`Warning: Could not fetch transaction ${txId}: ${txError.message}`);
        }
      }

    } catch (error: any) {
      console.warn(`Warning: Could not process transactions for block ${blockNumber}: ${error.message}`);
    }
  }

  // Process individual transaction and identify admin calls
  private async processTransaction(tx: any, blockNumber: number, blockTimestamp: Date): Promise<void> {
    try {
      const action = this.identifyTransactionAction(tx);

      if (!action) {
        return; // Skip unknown transaction types
      }

      // Store transaction in database
      await db.query(`
        INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, amount, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [
        tx.hash || tx.transactionHash,
        blockNumber,
        blockTimestamp,
        action,
        tx.from || tx.sender,
        tx.amount || '0',
        JSON.stringify({
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
          data: tx.data,
          status: tx.status
        })
      ]);

      console.log(`📝 Stored ${action} transaction: ${tx.hash || tx.transactionHash}`);

    } catch (error: any) {
      console.warn(`Warning: Could not process transaction ${tx.hash}: ${error.message}`);
    }
  }

  // Identify transaction type based on call data
  private identifyTransactionAction(tx: any): string | null {
    try {
      const data = tx.data || tx.input;

      if (!data || data.length < 2) {
        return null;
      }

      // Remove '0x' prefix if present
      const cleanData = data.startsWith('0x') ? data.slice(2) : data;

      // Check function signatures (first 2 bytes of call data)
      const functionSig = cleanData.substring(0, 2);

      switch (functionSig) {
        case '12': // accrueRewards function signature
          // Only allow accrueRewards from admin account
          const sender = tx.from || tx.sender;
          const adminAccount = process.env.ADMIN_ACCOUNT;
          if (adminAccount && sender === adminAccount) {
            return 'accrueRewards';
          }
          // If not from admin, treat as unknown transaction
          return null;
        case '10': // stake function
          return 'stake';
        case '11': // unstake function
          return 'unstake';
        case '13': // redeem function
          return 'redeem';
        case '14': // buyIn function
          return 'buyIn';
        default:
          return 'unknown';
      }
    } catch (error) {
      return null;
    }
  }


  async getCurrentBlock(): Promise<number | null> {
    return this.currentBlockHeight;
  }

  async stop() {
    this.running = false;
    // Pool is managed by the db client
    console.log('🛑 Batch indexer stopped');
  }
}

export default new PartisiaIndexer();