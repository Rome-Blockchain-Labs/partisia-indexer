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
  private cachedMpcPrice = 0;
  private lastPriceFetch = 0;
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
        await this.sleep(this.usePublicApi ? 1000 : 10);
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

    const batchContext = await this.loadBatchContext(nextBlock);

    const results = await this.processBlocksConcurrently(batchBlocks, batchContext);

    const successCount = results.filter(r => r.success).length;
    const failedBlocks = results.filter(r => !r.success).map(r => r.block);

    if (failedBlocks.length > 0) {
      console.error(`Failed blocks: [${failedBlocks.join(', ')}]`);
      const retryResults = await this.retryFailedBlocks(failedBlocks, batchContext);

      const stillFailed = retryResults.filter(r => !r.success);
      if (stillFailed.length > 0) {
        const stillFailedBlocks = stillFailed.map(r => r.block);
        console.error(`❌ CRITICAL: ${stillFailed.length} blocks permanently failed: [${stillFailedBlocks.join(', ')}]`);
        throw new Error(`Batch contains ${stillFailed.length} permanently failed blocks`);
      }
    }

    await this.batchWriteChanges(batchContext);
    this.lastIndexedBlock = batchEnd;
    this.stats.batchesProcessed++;
    this.stats.blocksProcessed += (batchEnd - nextBlock + 1);

    const totalBlocks = Math.max(1, this.currentBlockHeight - config.blockchain.deploymentBlock);
    const progress = ((this.lastIndexedBlock - config.blockchain.deploymentBlock) / totalBlocks * 100);

    const blocksPerSecond = this.stats.blocksProcessed / ((Date.now() - this.stats.startTime) / 1000);
    const eta = blocksPerSecond > 0 ? (this.currentBlockHeight - this.lastIndexedBlock) / blocksPerSecond : 0;

    const apiInfo = this.usePublicApi ? ' [PUBLIC API]' : '';
    console.log(`Indexer progress: ${progress.toFixed(1)}% complete, block ${this.lastIndexedBlock}/${this.currentBlockHeight}, rate: ${blocksPerSecond.toFixed(1)} blocks/s, ETA: ${Math.round(eta/60)}min${apiInfo}`);
  }


  private async processBlocksConcurrently(blocks: number[], batchContext: any): Promise<Array<{block: number, success: boolean}>> {
    // Maintain exactly N concurrent requests using Promise.race
    const results: Array<{block: number, success: boolean}> = [];
    const inFlight = new Set<Promise<{block: number, success: boolean}>>();
    let blockIndex = 0;

    while (blockIndex < blocks.length) {
      while (inFlight.size < this.concurrency && blockIndex < blocks.length) {
        const block = blocks[blockIndex++];
        const promise = this.processBlockWithRetry(block, batchContext)
          .then(success => ({ block, success }))
          .catch(error => {
            console.error(`❌ Block ${block} failed:`, error);
            return { block, success: false };
          });

        inFlight.add(promise);
        promise.finally(() => inFlight.delete(promise));
      }

      if (inFlight.size > 0) {
        const completed = await Promise.race(inFlight);
        results.push(completed);
      }
    }

    if (inFlight.size > 0) {
      const remaining = await Promise.all(inFlight);
      results.push(...remaining);
    }

    return results;
  }

  private async processBlockWithRetry(blockNumber: number, batchContext?: any): Promise<boolean> {
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        if (this.usePublicApi) {
          await this.rateLimitPublicApi();
        }

        const success = await this.processBlock(blockNumber, batchContext);
        return success;  // Fixed: return actual success status
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

  private async retryFailedBlocks(failedBlocks: number[], batchContext: any): Promise<Array<{block: number, success: boolean}>> {
    console.log(`🔁 Retrying ${failedBlocks.length} failed blocks...`);
    const retryResults = await this.processBlocksConcurrently(failedBlocks, batchContext);
    const stillFailed = retryResults.filter(r => !r.success).length;
    if (stillFailed > 0) {
      console.warn(`⚠️  ${stillFailed} blocks still failed after retry`);
    } else {
      console.log(`✅ All failed blocks recovered`);
    }
    return retryResults;
  }

  private async processBlock(blockNumber: number, batchContext?: any): Promise<boolean> {
    const startTime = Date.now();
    try {
      const contractState = await this.getContractState(blockNumber);
      if (!contractState) return false;

      // Don't fetch timestamp yet - we'll fetch it only if we need to store this block
      // This saves millions of API calls since we only store ~0.3% of blocks
      const hasStateData = await this.handleLiquidStakingState(blockNumber, contractState, batchContext, null);

      if (batchContext) {
        const processingTime = Date.now() - startTime;
        batchContext.indexedBlocks.push({
          blockNumber,
          processingTime,
          hasStateData
        });
      }

      return true;
    } catch (error: any) {
      throw error;
    }
  }

  private async loadBatchContext(batchStartBlock: number) {
    const now = Date.now();
    if (now - this.lastPriceFetch > 60000) {
      try {
        const priceResult = await db.query('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1');
        this.cachedMpcPrice = parseFloat(priceResult.rows[0]?.price_usd) || 0;
        this.lastPriceFetch = now;
      } catch (e) {
        this.cachedMpcPrice = 0;
      }
    }

    const [lastStateResult, lastGov, lastMeta, lastParams] = await Promise.all([
      db.query(`
        SELECT exchange_rate, total_pool_stake_token, total_pool_liquid,
               stake_token_balance, buy_in_percentage, buy_in_enabled
        FROM contract_states
        WHERE block_number < $1
        ORDER BY block_number DESC LIMIT 1
      `, [batchStartBlock]),

      db.query(`
        SELECT administrator, staking_responsible, token_for_staking
        FROM governance_changes
        WHERE block_number < $1
        ORDER BY block_number DESC LIMIT 1
      `, [batchStartBlock]),

      db.query(`
        SELECT token_name, token_symbol, token_decimals
        FROM token_metadata
        WHERE block_number < $1
        ORDER BY block_number DESC LIMIT 1
      `, [batchStartBlock]),

      db.query(`
        SELECT length_of_cooldown_period, length_of_redeem_period, buy_in_percentage,
               buy_in_enabled, amount_of_buy_in_locked_stake_tokens
        FROM protocol_parameters
        WHERE block_number < $1
        ORDER BY block_number DESC LIMIT 1
      `, [batchStartBlock])
    ]);

    return {
      mpcPrice: this.cachedMpcPrice,
      lastState: lastStateResult.rows[0] || null,
      lastGov: lastGov.rows[0] || null,
      lastMeta: lastMeta.rows[0] || null,
      lastParams: lastParams.rows[0] || null,
      contractStates: [],
      governanceChanges: [],
      metadataChanges: [],
      parameterChanges: [],
      userActivity: [],
      indexedBlocks: [],
      currentState: null,
      currentGov: null,
      currentMeta: null,
      currentParams: null,
      latestFullState: null
    };
  }

  private async batchWriteChanges(context: any) {
    // Insert contract_states first (required for foreign key constraints)
    if (context.contractStates.length > 0) {
      const values = context.contractStates.map((s: any, i: number) => {
        const offset = i * 8;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8})`;
      }).join(',');

      const params = context.contractStates.flatMap((s: any) => [
        s.blockNumber, s.timestamp, s.exchangeRate,
        s.stakeAmount, s.liquidAmount, s.stakeTokenBalance,
        s.buyInPercentage, s.buyInEnabled
      ]);

      await db.query(`
        INSERT INTO contract_states (
          block_number, timestamp, exchange_rate,
          total_pool_stake_token, total_pool_liquid, stake_token_balance,
          buy_in_percentage, buy_in_enabled
        ) VALUES ${values}
        ON CONFLICT (block_number) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          exchange_rate = EXCLUDED.exchange_rate,
          total_pool_stake_token = EXCLUDED.total_pool_stake_token,
          total_pool_liquid = EXCLUDED.total_pool_liquid,
          stake_token_balance = EXCLUDED.stake_token_balance,
          buy_in_percentage = EXCLUDED.buy_in_percentage,
          buy_in_enabled = EXCLUDED.buy_in_enabled
      `, params);
    }

    // Now insert sparse tables (can run in parallel since contract_states exists)
    const promises = [];

    if (context.governanceChanges.length > 0) {
      const values = context.governanceChanges.map((g: any, i: number) => {
        const offset = i * 4;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4})`;
      }).join(',');

      const params = context.governanceChanges.flatMap((g: any) => [
        g.blockNumber, g.administrator, g.stakingResponsible, g.tokenForStaking
      ]);

      promises.push(db.query(`
        INSERT INTO governance_changes (block_number, administrator, staking_responsible, token_for_staking)
        VALUES ${values}
        ON CONFLICT (block_number) DO NOTHING
      `, params));
    }

    if (context.metadataChanges.length > 0) {
      const values = context.metadataChanges.map((m: any, i: number) => {
        const offset = i * 4;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4})`;
      }).join(',');

      const params = context.metadataChanges.flatMap((m: any) => [
        m.blockNumber, m.tokenName, m.tokenSymbol, m.tokenDecimals
      ]);

      promises.push(db.query(`
        INSERT INTO token_metadata (block_number, token_name, token_symbol, token_decimals)
        VALUES ${values}
        ON CONFLICT (block_number) DO NOTHING
      `, params));
    }

    if (context.parameterChanges.length > 0) {
      const values = context.parameterChanges.map((p: any, i: number) => {
        const offset = i * 6;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6})`;
      }).join(',');

      const params = context.parameterChanges.flatMap((p: any) => [
        p.blockNumber, p.cooldownPeriod, p.redeemPeriod,
        p.buyInPercentage, p.buyInEnabled, p.buyInLockedTokens
      ]);

      promises.push(db.query(`
        INSERT INTO protocol_parameters (
          block_number, length_of_cooldown_period, length_of_redeem_period,
          buy_in_percentage, buy_in_enabled, amount_of_buy_in_locked_stake_tokens
        ) VALUES ${values}
        ON CONFLICT (block_number) DO NOTHING
      `, params));
    }

    // Batch insert user activity
    if (context.userActivity.length > 0) {
      const values = context.userActivity.map((u: any, i: number) => {
        const offset = i * 4;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4})`;
      }).join(',');

      const params = context.userActivity.flatMap((u: any) => [
        u.blockNumber, u.pendingUnlocksCount, u.buyInTokensCount, u.totalPendingUnlockAmount
      ]);

      promises.push(db.query(`
        INSERT INTO user_activity (block_number, pending_unlocks_count, buy_in_tokens_count, total_pending_unlock_amount)
        VALUES ${values}
        ON CONFLICT (block_number) DO UPDATE SET
          pending_unlocks_count = EXCLUDED.pending_unlocks_count,
          buy_in_tokens_count = EXCLUDED.buy_in_tokens_count,
          total_pending_unlock_amount = EXCLUDED.total_pending_unlock_amount
      `, params));
    }

    if (context.latestFullState) {
      const s = context.latestFullState;
      promises.push(db.query(`
        INSERT INTO current_state (id, block_number, timestamp, exchange_rate,
          total_pool_stake_token, total_pool_liquid, stake_token_balance,
          buy_in_percentage, buy_in_enabled,
          token_for_staking, staking_responsible, administrator,
          length_of_cooldown_period, length_of_redeem_period, amount_of_buy_in_locked_stake_tokens,
          token_name, token_symbol, token_decimals,
          pending_unlocks_count, buy_in_tokens_count, total_pending_unlock_amount
        ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
          total_pending_unlock_amount = EXCLUDED.total_pending_unlock_amount
        WHERE current_state.block_number <= EXCLUDED.block_number
      `, [
        s.blockNumber, s.timestamp, s.exchangeRate,
        s.stakeAmount, s.liquidAmount, s.stakeTokenBalance,
        s.buyInPercentage, s.buyInEnabled,
        s.tokenForStaking, s.stakingResponsible, s.administrator,
        s.lengthOfCooldownPeriod, s.lengthOfRedeemPeriod, s.amountOfBuyInLockedStakeTokens,
        s.tokenName, s.tokenSymbol, s.tokenDecimals,
        s.pendingUnlocksCount, s.buyInTokensCount, s.totalPendingUnlockAmount
      ]));
    }

    if (context.indexedBlocks.length > 0) {
      const values = context.indexedBlocks.map((b: any, i: number) => {
        const paramStart = i * 3 + 1;
        return `($${paramStart}, $${paramStart + 1}, $${paramStart + 2})`;
      }).join(', ');

      const params = context.indexedBlocks.flatMap((b: any) => [
        b.blockNumber,
        b.processingTime,
        b.hasStateData
      ]);

      promises.push(db.query(`
        INSERT INTO indexed_blocks (block_number, processing_time_ms, has_state_data)
        VALUES ${values}
        ON CONFLICT (block_number) DO UPDATE SET
          indexed_at = NOW(),
          processing_time_ms = EXCLUDED.processing_time_ms,
          has_state_data = EXCLUDED.has_state_data
      `, params));
    }

    await Promise.all(promises);

    const changes = [
      context.contractStates.length > 0 ? `${context.contractStates.length} states` : null,
      context.governanceChanges.length > 0 ? `${context.governanceChanges.length} governance` : null,
      context.metadataChanges.length > 0 ? `${context.metadataChanges.length} metadata` : null,
      context.parameterChanges.length > 0 ? `${context.parameterChanges.length} params` : null,
      context.userActivity.length > 0 ? `${context.userActivity.length} activity` : null,
      context.indexedBlocks.length > 0 ? `${context.indexedBlocks.length} checkpoints` : null
    ].filter(Boolean);

    if (changes.length > 0) {
      console.log(`📝 Batch wrote: ${changes.join(', ')}`);
    }
  }

  private async handleLiquidStakingState(blockNumber: number, blockResponse: BlockResponse, batchContext: any, blockTimestamp?: Date | null): Promise<boolean> {
    if (!batchContext) {
      throw new Error(`handleLiquidStakingState called without batchContext for block ${blockNumber}`);
    }

    if (!blockResponse.serializedContract) {
      throw new Error(`No serialized contract data for block ${blockNumber}`);
    }

    const state = require('./abi/liquid_staking').deserializeState(
      Buffer.from(blockResponse.serializedContract, 'base64')
    );

    const stakeAmount = BigInt(state.totalPoolStakeToken?.toString() || '0');
    const liquidAmount = BigInt(state.totalPoolLiquid?.toString() || '0');
    const stakeTokenBalance = BigInt(state.stakeTokenBalance?.toString() || '0');

    // Exchange rate = stakeAmount / liquidAmount (how many MPC you get per 1 sMPC)
    // As rewards accrue, each sMPC represents more MPC, so rate should be >= 1.0
    // Use high precision: multiply by 1e10, divide, then scale back to float
    const exchangeRate = liquidAmount === 0n
      ? 1.0
      : Number((stakeAmount * 10_000_000_000n) / liquidAmount) / 10_000_000_000;

    const hasActivity = (
      stakeAmount !== 0n ||
      liquidAmount !== 0n ||
      stakeTokenBalance !== 0n
    );
    const is1000thBlock = blockNumber % 1000 === 0;

    const mpcPrice = batchContext.mpcPrice;
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
      totalPoolStakeToken: stakeAmount.toString(),
      totalPoolLiquid: liquidAmount.toString(),
      stakeTokenBalance: stakeTokenBalance.toString(),
      buyInPercentage: parseFloat((state.buyInPercentage || 0).toString()),
      buyInEnabled: !!state.buyInEnabled
    };

    const lastState = batchContext.currentState || batchContext.lastState;
    let shouldStore = !lastState;

    if (lastState) {
      shouldStore = (
        parseFloat(lastState.exchange_rate) !== currentState.exchangeRate ||
        lastState.total_pool_stake_token.toString() !== currentState.totalPoolStakeToken ||
        lastState.total_pool_liquid.toString() !== currentState.totalPoolLiquid ||
        lastState.stake_token_balance.toString() !== currentState.stakeTokenBalance ||
        parseFloat(lastState.buy_in_percentage) !== currentState.buyInPercentage ||
        !!lastState.buy_in_enabled !== currentState.buyInEnabled
      );
    }

    const isSignificantChange =
      is1000thBlock ||
      (shouldStore && (
        currentState.stakeTokenBalance !== '0' ||
        currentState.totalPoolStakeToken !== '0' ||
        currentState.totalPoolLiquid !== '0'
      ));

    // Fetch real timestamp only if we're going to store this block (huge performance win!)
    let timestamp: Date;
    if (isSignificantChange) {
      // Only fetch timestamp for blocks we'll actually store
      const realTimestamp = await this.getBlockProductionTime(blockNumber);
      if (realTimestamp) {
        timestamp = realTimestamp;
      } else {
        // Fallback to estimation if fetch fails
        const blocksSinceDeployment = blockNumber - config.blockchain.deploymentBlock;
        const estimatedMs = config.blockchain.deploymentTimestamp.getTime() + (blocksSinceDeployment * 2000);
        timestamp = new Date(estimatedMs);
      }
    } else {
      // For blocks we won't store, use cheap estimation
      const blocksSinceDeployment = blockNumber - config.blockchain.deploymentBlock;
      const estimatedMs = config.blockchain.deploymentTimestamp.getTime() + (blocksSinceDeployment * 2000);
      timestamp = new Date(estimatedMs);
    }

    if (isSignificantChange) {
      const stateRecord = {
        blockNumber,
        timestamp,
        exchangeRate,
        stakeAmount: stakeAmount.toString(),
        liquidAmount: liquidAmount.toString(),
        stakeTokenBalance: state.stakeTokenBalance?.toString() || '0',
        buyInPercentage: state.buyInPercentage?.toString() || '0',
        buyInEnabled: state.buyInEnabled || false,
        exchange_rate: currentState.exchangeRate,
        total_pool_stake_token: currentState.totalPoolStakeToken,
        total_pool_liquid: currentState.totalPoolLiquid,
        stake_token_balance: currentState.stakeTokenBalance,
        buy_in_percentage: currentState.buyInPercentage,
        buy_in_enabled: currentState.buyInEnabled
      };

      batchContext.contractStates.push(stateRecord);
      batchContext.currentState = stateRecord;

      console.log(`📝 Queued significant state at block ${blockNumber}: stake=${currentState.stakeTokenBalance}, rate=${currentState.exchangeRate}`);
    } else if (shouldStore) {
      console.log(`⏩ Skipping minor change at block ${blockNumber} (no significant change)`);
    }

    await this.storeSparseData(blockNumber, state, pendingUnlocksCount, buyInTokensCount, totalPendingUnlockAmount, batchContext);

    if (blockNumber >= this.lastIndexedBlock - 100) {
      batchContext.latestFullState = {
        blockNumber,
        timestamp,
        exchangeRate,
        stakeAmount: stakeAmount.toString(),
        liquidAmount: liquidAmount.toString(),
        stakeTokenBalance: state.stakeTokenBalance?.toString() || '0',
        buyInPercentage: state.buyInPercentage?.toString() || '0',
        buyInEnabled: state.buyInEnabled || false,
        tokenForStaking: state.tokenForStaking?.toString() || null,
        stakingResponsible: state.stakingResponsible?.toString() || null,
        administrator: state.administrator?.toString() || null,
        lengthOfCooldownPeriod: state.lengthOfCooldownPeriod?.toString() || null,
        lengthOfRedeemPeriod: state.lengthOfRedeemPeriod?.toString() || null,
        amountOfBuyInLockedStakeTokens: state.amountOfBuyInLockedStakeTokens?.toString() || null,
        tokenName: state.liquidTokenState?.name || null,
        tokenSymbol: state.liquidTokenState?.symbol || null,
        tokenDecimals: state.liquidTokenState?.decimals || null,
        pendingUnlocksCount,
        buyInTokensCount,
        totalPendingUnlockAmount
      };
    }

    return isSignificantChange;
  }

  private async storeSparseData(blockNumber: number, state: any, pendingUnlocksCount: number, buyInTokensCount: number, totalPendingUnlockAmount: string, batchContext: any) {
    // Partisia Address objects need special serialization
    const serializeAddress = (addr: any) => {
      if (!addr) return null;
      if (typeof addr === 'string') return addr;
      if (addr.identifyingName) return addr.identifyingName;
      if (addr.addressAsHex) return addr.addressAsHex;
      if (addr.address) return addr.address;
      // Handle {val: {type: "Buffer", data: [...]}} structure
      if (addr.val && addr.val.data && Array.isArray(addr.val.data)) {
        return Buffer.from(addr.val.data).toString('hex');
      }
      // Fallback: convert bytes to hex string if it's a buffer/array
      if (addr.buffer) return Buffer.from(addr.buffer).toString('hex');
      return JSON.stringify(addr);
    };

    const governance = {
      administrator: serializeAddress(state.administrator),
      staking_responsible: serializeAddress(state.stakingResponsible),
      token_for_staking: serializeAddress(state.tokenForStaking)
    };

    const prevGov = batchContext.currentGov || batchContext.lastGov;
    const govChanged = !prevGov ||
      prevGov.administrator !== governance.administrator ||
      prevGov.staking_responsible !== governance.staking_responsible ||
      prevGov.token_for_staking !== governance.token_for_staking;

    if (govChanged && (governance.administrator || governance.staking_responsible || governance.token_for_staking)) {
      batchContext.governanceChanges.push({
        blockNumber,
        administrator: governance.administrator,
        stakingResponsible: governance.staking_responsible,
        tokenForStaking: governance.token_for_staking
      });
      batchContext.currentGov = governance;
    }

    const metadata = {
      token_name: state.liquidTokenState?.name || null,
      token_symbol: state.liquidTokenState?.symbol || null,
      token_decimals: state.liquidTokenState?.decimals || null
    };

    const prevMeta = batchContext.currentMeta || batchContext.lastMeta;
    const metaChanged = !prevMeta ||
      prevMeta.token_name !== metadata.token_name ||
      prevMeta.token_symbol !== metadata.token_symbol ||
      prevMeta.token_decimals !== metadata.token_decimals;

    if (metaChanged && (metadata.token_name || metadata.token_symbol || metadata.token_decimals !== null)) {
      batchContext.metadataChanges.push({
        blockNumber,
        tokenName: metadata.token_name,
        tokenSymbol: metadata.token_symbol,
        tokenDecimals: metadata.token_decimals
      });
      batchContext.currentMeta = metadata;
    }

    const parameters = {
      length_of_cooldown_period: state.lengthOfCooldownPeriod?.toString() || null,
      length_of_redeem_period: state.lengthOfRedeemPeriod?.toString() || null,
      buy_in_percentage: state.buyInPercentage?.toString() || null,
      buy_in_enabled: state.buyInEnabled || null,
      amount_of_buy_in_locked_stake_tokens: state.amountOfBuyInLockedStakeTokens?.toString() || null
    };

    const prevParams = batchContext.currentParams || batchContext.lastParams;
    const paramsChanged = !prevParams ||
      prevParams.length_of_cooldown_period !== parameters.length_of_cooldown_period ||
      prevParams.length_of_redeem_period !== parameters.length_of_redeem_period ||
      prevParams.buy_in_percentage !== parameters.buy_in_percentage ||
      prevParams.buy_in_enabled !== parameters.buy_in_enabled ||
      prevParams.amount_of_buy_in_locked_stake_tokens !== parameters.amount_of_buy_in_locked_stake_tokens;

    if (paramsChanged && (parameters.length_of_cooldown_period || parameters.length_of_redeem_period || parameters.buy_in_percentage ||
        parameters.buy_in_enabled !== null || parameters.amount_of_buy_in_locked_stake_tokens)) {
      batchContext.parameterChanges.push({
        blockNumber,
        cooldownPeriod: parameters.length_of_cooldown_period,
        redeemPeriod: parameters.length_of_redeem_period,
        buyInPercentage: parameters.buy_in_percentage,
        buyInEnabled: parameters.buy_in_enabled,
        buyInLockedTokens: parameters.amount_of_buy_in_locked_stake_tokens
      });
      batchContext.currentParams = parameters;
    }

    if (pendingUnlocksCount > 0 || buyInTokensCount > 0 || totalPendingUnlockAmount !== '0') {
      batchContext.userActivity.push({
        blockNumber,
        pendingUnlocksCount,
        buyInTokensCount,
        totalPendingUnlockAmount
      });
    }
  }

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

  private async getBlockProductionTime(blockNumber: number): Promise<Date | null> {
    try {
      // Step 1: Check cache in block_mappings table
      const cachedResult = await db.query(
        'SELECT production_time FROM block_mappings WHERE block_time = $1',
        [blockNumber]
      );

      if (cachedResult.rows.length > 0 && cachedResult.rows[0].production_time) {
        return new Date(parseInt(cachedResult.rows[0].production_time));
      }

      // Step 2: Fetch block ID from blockTime
      const blockTimeUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks?blockTime=${blockNumber}`;
      const blockTimeResponse = await axios.get(blockTimeUrl, { timeout: 10000 });

      if (!blockTimeResponse.data || !blockTimeResponse.data.identifier) {
        return null;
      }

      const blockId = blockTimeResponse.data.identifier;
      const productionTime = blockTimeResponse.data.productionTime;

      // Step 3: Cache the result
      if (productionTime) {
        await db.query(
          `INSERT INTO block_mappings (block_time, block_id, production_time)
           VALUES ($1, $2, $3)
           ON CONFLICT (block_time) DO UPDATE SET production_time = EXCLUDED.production_time`,
          [blockNumber, blockId, productionTime]
        );

        return new Date(productionTime);
      }

      return null;
    } catch (error: any) {
      console.warn(`Failed to fetch production time for block ${blockNumber}: ${error.message}`);
      return null;
    }
  }

  private async getLastIndexedBlock(): Promise<number> {
    // Simply get the maximum block number - gaps are intentional (we only save every 1000th block)
    const result = await db.query(`
      SELECT COALESCE(MAX(block_number), ${config.blockchain.deploymentBlock - 1}) as last_block
      FROM contract_states
      WHERE block_number >= ${config.blockchain.deploymentBlock}
    `);

    const lastBlock = result.rows[0]?.last_block;
    // Ensure proper conversion from BigInt/string to number
    const blockNumber = lastBlock ? parseInt(lastBlock.toString()) : (config.blockchain.deploymentBlock - 1);
    console.log(`📊 Resuming from last indexed block: ${blockNumber}`);
    return blockNumber;
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
    const totalExpectedBlocks = Math.max(0, this.currentBlockHeight - config.blockchain.deploymentBlock + 1);
    const blocksIndexed = Math.max(0, this.lastIndexedBlock - config.blockchain.deploymentBlock + 1);
    const progressPercent = totalExpectedBlocks > 0 ? (blocksIndexed / totalExpectedBlocks * 100) : 0;

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