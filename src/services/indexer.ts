import { Pool } from 'pg';
import axios from 'axios';
import config from '../config';
import RateLimiter from './rate-limiter';

const CONTRACT_ADDRESS = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  connectionTimeoutMillis: 2000,
});

interface BlockData {
  block: number;
  timestamp: Date;
  state: any;
  exchangeRate?: number;
  latestStorageFeeTime?: number;
}

interface Gap {
  start: number;
  end: number;
}

class Indexer {
  private running = false;
  private headTracker: NodeJS.Timeout | null = null;
  private backfillQueue: number[] = [];
  private activeRequests = new Set<number>();
  private maxConcurrentRequests = parseInt(process.env.INDEXER_CONCURRENCY || '10');
  private lastHeadBlock = 0;
  private backfillCursor = 0;
  private blockCache = new Map<number, BlockData>();
  private cacheMaxSize = 10000;
  private stats = {
    blocksProcessed: 0,
    requestsMade: 0,
    cacheHits: 0,
    errors: 0,
    startTime: Date.now()
  };
  private rateLimiter = new RateLimiter();
  private fallbackBlockHeight = 0;
  private lastSuccessfulApiCall = Date.now();
  private apiHealthScore = 100;
  private requestBatch: number[] = [];
  private batchProcessor: NodeJS.Timeout | null = null;

  async start() {
    this.running = true;
    console.log('Starting LS Contract Indexer with hardened rate limiter');
    console.log(`Contract: ${CONTRACT_ADDRESS} on Shard2`);
    console.log('Security-focused rate limiting with circuit breaker active');

    const lastIndexed = await this.getLastIndexedBlock();
    const deploymentBlock = parseInt(process.env.DEPLOYMENT_BLOCK || '10682802');
    this.backfillCursor = lastIndexed || deploymentBlock;
    this.fallbackBlockHeight = lastIndexed || deploymentBlock;

    this.rateLimiter.on('circuit-open', () => {
      console.warn('Circuit breaker OPEN - API unavailable, using fallback mode');
      this.apiHealthScore = 0;
    });

    this.rateLimiter.on('circuit-half-open', () => {
      console.log('Circuit breaker HALF-OPEN - testing API availability');
      this.apiHealthScore = 50;
    });

    this.rateLimiter.on('circuit-closed', () => {
      console.log('Circuit breaker CLOSED - API healthy, pushing to 5 RPS');
      this.apiHealthScore = 100;
    });

    this.rateLimiter.on('retry', ({ attempt, backoffMs, statusCode }) => {
      if (statusCode === 429) {
        console.log(`Rate limited, retrying in ${backoffMs}ms (attempt ${attempt})`);
      }
    });

    await Promise.all([
      this.headTrackingLoop(),
      this.lightBackfillLoop(),
      this.statsReporter(),
      this.healthMonitor(),
      this.batchProcessorLoop()
    ]);
  }

  private async headTrackingLoop() {
    console.log('Head tracking: adaptive interval based on API health');

    while (this.running) {
      try {
        const currentBlock = await this.getCurrentBlockWithFallback();

        if (currentBlock && currentBlock > this.lastHeadBlock) {
          const data = await this.fetchBlockWithRateLimiter(currentBlock);

          if (data && data.state) {
            await this.storeBlock(data);
            console.log(`Head updated: block ${currentBlock} | rate=${data.exchangeRate?.toFixed(6)} | health=${this.apiHealthScore}%`);
            this.lastHeadBlock = currentBlock;
            this.fallbackBlockHeight = Math.max(this.fallbackBlockHeight, currentBlock);
          }
        }

        const interval = this.calculatePollingInterval();
        await new Promise(r => setTimeout(r, interval));
      } catch (error) {
        console.error('Head tracking error:', error.message);
        this.apiHealthScore = Math.max(0, this.apiHealthScore - 10);

        const backoffTime = Math.min(60000, 10000 * (1 + (100 - this.apiHealthScore) / 20));
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }
  }

  private async lightBackfillLoop() {
    console.log('Adaptive backfill: rate adjusted based on API health');

    await new Promise(r => setTimeout(r, 30000));

    while (this.running) {
      try {
        if (this.apiHealthScore < 30) {
          console.log('Skipping backfill due to poor API health');
          await new Promise(r => setTimeout(r, 300000));
          continue;
        }

        const gap = await this.findNextGap();

        if (gap && gap.start) {
          const batchSize = this.apiHealthScore > 70 ? 25 : 10;
          const blocks = Array.from(
            { length: Math.min(batchSize, gap.end - gap.start + 1) },
            (_, i) => gap.start + i
          );

          console.log(`Queueing ${blocks.length} blocks for batch processing: ${blocks[0]}-${blocks[blocks.length - 1]}`);

          this.requestBatch.push(...blocks);
          this.backfillCursor = blocks[blocks.length - 1];
        }

        const waitTime = this.apiHealthScore > 75 ? 10000 : 60000;
        await new Promise(r => setTimeout(r, waitTime));
      } catch (error) {
        console.error('Backfill error:', error.message);
        this.stats.errors++;
        await new Promise(r => setTimeout(r, 300000));
      }
    }
  }

  // Smart gap detection with priority ranking
  private async gapDetectionLoop() {
    while (this.running) {
      await new Promise(r => setTimeout(r, 300000)); // 5 minutes

      try {
        const gaps = await this.detectAndPrioritizeGaps();

        if (gaps.length > 0) {
          console.log(`Detected ${gaps.length} gaps, queuing for processing`);

          // Add high-priority gaps to backfill queue
          for (const gap of gaps.slice(0, 10)) { // Process top 10 gaps
            const blocks = Array.from(
              { length: gap.end - gap.start + 1 },
              (_, i) => gap.start + i
            );
            this.backfillQueue.push(...blocks);
          }
        }
      } catch (error) {
        console.error('Gap detection error:', error.message);
      }
    }
  }

  // Performance statistics reporter
  private async statsReporter() {
    while (this.running) {
      await new Promise(r => setTimeout(r, 300000)); // 5 minutes

      const runtime = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes
      const bpm = this.stats.blocksProcessed / runtime; // blocks per minute

      const currentBlock = await this.getCurrentBlock();
      const headLag = currentBlock ? currentBlock - this.lastHeadBlock : 0;

      console.log(`Indexer Stats:`);
      console.log(`  Head: ${this.lastHeadBlock} (lag: ${headLag} blocks)`);
      console.log(`  Processed: ${this.stats.blocksProcessed} blocks (${bpm.toFixed(1)} blocks/min)`);
      console.log(`  API calls: ${this.stats.requestsMade} (${this.stats.errors} errors)`);
      console.log(`  Uptime: ${runtime.toFixed(0)} minutes`);
    }
  }

  // Process blocks with maximum concurrency
  private async processBlocksConcurrently(blocks: number[]) {
    const promises: Promise<void>[] = [];

    for (const block of blocks) {
      // Wait if we're at max concurrency
      while (this.activeRequests.size >= this.maxConcurrentRequests) {
        await new Promise(r => setTimeout(r, 10));
      }

      promises.push(this.processBlockWithCache(block));
    }

    await Promise.all(promises);
  }

  // Process block with caching
  private async processBlockWithCache(block: number): Promise<void> {
    // Check cache first
    if (this.blockCache.has(block)) {
      this.stats.cacheHits++;
      const data = this.blockCache.get(block)!;
      await this.storeBlock(data);
      return;
    }

    this.activeRequests.add(block);

    try {
      const data = await this.fetchBlockWithRateLimiter(block);

      if (data && data.state) {
        // Add to cache
        this.blockCache.set(block, data);

        // Maintain cache size
        if (this.blockCache.size > this.cacheMaxSize) {
          const oldestBlock = this.blockCache.keys().next().value;
          this.blockCache.delete(oldestBlock);
        }

        await this.storeBlock(data);
        this.stats.blocksProcessed++;
      }
    } catch (error) {
      console.warn(`Block ${block}: ${error.message}`);
      this.stats.errors++;
    } finally {
      this.activeRequests.delete(block);
    }
  }

  private async fetchBlockWithRateLimiter(block: number): Promise<BlockData | null> {
    this.stats.requestsMade++;

    try {
      const result = await this.rateLimiter.executeWithRetry(
        async () => {
          const resp = await axios.get(
            `${process.env.PARTISIA_API_URL}/chain/contracts/${CONTRACT_ADDRESS}?blockTime=${block}`,
            {
              timeout: 10000,
              validateStatus: (status) => status === 200 || status === 404
            }
          );

          if (resp.status === 404) {
            return null;
          }

          if (resp.data?.serializedContract) {
            this.lastSuccessfulApiCall = Date.now();
            this.apiHealthScore = Math.min(100, this.apiHealthScore + 5);

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
              latestStorageFeeTime: resp.data.account?.latestStorageFeeTime
            };
          }
          return null;
        },
        {
          url: `block-${block}`,
          maxRetries: 5,
          timeout: 8000,
          cacheTTL: 30000
        }
      );

      return result;
    } catch (error) {
      this.apiHealthScore = Math.max(0, this.apiHealthScore - 5);
      throw error;
    }
  }

  // Calculate optimal batch size based on system state
  private calculateOptimalBatchSize(gapSize: number): number {
    const baseSize = 1000;
    const loadFactor = this.activeRequests.size / this.maxConcurrentRequests;

    // Reduce batch size under high load
    const adjustedSize = Math.floor(baseSize * (1 - loadFactor * 0.5));

    return Math.min(adjustedSize, gapSize, 2000);
  }

  // Find the next gap to process
  private async findNextGap(): Promise<Gap | null> {
    // Check backfill queue first
    if (this.backfillQueue.length > 0) {
      const start = this.backfillQueue[0];
      let end = start;

      // Find consecutive blocks
      while (this.backfillQueue.includes(end + 1)) {
        end++;
      }

      // Remove processed blocks from queue
      this.backfillQueue = this.backfillQueue.filter(b => b > end);

      return { start, end };
    }

    // Query database for gaps
    const deploymentBlock = parseInt(process.env.DEPLOYMENT_BLOCK || '10682802');

    const result = await pool.query(`
      WITH RECURSIVE block_gaps AS (
        SELECT ${deploymentBlock} as expected_block
        UNION ALL
        SELECT expected_block + 1
        FROM block_gaps
        WHERE expected_block < (SELECT MAX(block_number) FROM contract_states)
      ),
      missing AS (
        SELECT expected_block
        FROM block_gaps
        WHERE NOT EXISTS (
          SELECT 1 FROM contract_states
          WHERE block_number = expected_block
        )
        LIMIT 1000
      )
      SELECT
        MIN(expected_block) as gap_start,
        MAX(expected_block) as gap_end
      FROM missing
      WHERE expected_block IS NOT NULL
    `);

    if (result.rows[0]?.gap_start) {
      return {
        start: result.rows[0].gap_start,
        end: result.rows[0].gap_end
      };
    }

    return null;
  }

  // Detect and prioritize gaps (larger gaps first)
  private async detectAndPrioritizeGaps(): Promise<Gap[]> {
    const result = await pool.query(`
      WITH block_ranges AS (
        SELECT
          block_number,
          LAG(block_number) OVER (ORDER BY block_number) as prev_block
        FROM contract_states
      )
      SELECT
        prev_block + 1 as gap_start,
        block_number - 1 as gap_end,
        block_number - prev_block - 1 as gap_size
      FROM block_ranges
      WHERE block_number - prev_block > 1
      ORDER BY gap_size DESC
      LIMIT 100
    `);

    return result.rows.map(row => ({
      start: row.gap_start,
      end: row.gap_end
    }));
  }

  private async getCurrentBlockWithFallback(): Promise<number | null> {
    try {
      // Instead of trying to estimate blocks, use a conservative increment approach
      const lastIndexed = await this.getLastIndexedBlock();

      // Test if we can fetch a few blocks ahead of our last indexed
      for (let i = 1; i <= 10; i++) {
        const testBlock = lastIndexed + i;
        try {
          const response = await axios.get(
            `${process.env.PARTISIA_API_URL}/chain/contracts/${CONTRACT_ADDRESS}?blockTime=${testBlock}`,
            { timeout: 3000, validateStatus: (status) => status === 200 || status === 404 }
          );

          if (response.status === 200 && response.data?.serializedContract) {
            this.lastSuccessfulApiCall = Date.now();
            this.apiHealthScore = Math.min(100, this.apiHealthScore + 2);
            this.fallbackBlockHeight = Math.max(this.fallbackBlockHeight, testBlock);
            console.log(`Found available block: ${testBlock}`);
            return testBlock;
          }
        } catch (error) {
          // Skip this block and try next
          continue;
        }
      }

      // If no new blocks found, return the last known good block
      console.log(`No new blocks found, staying at: ${lastIndexed}`);
      return lastIndexed;
    } catch (error) {
      console.error('Failed to get current block:', error.message);
      return this.calculateFallbackBlock();
    }
  }

  private calculateFallbackBlock(): number {
    const timeSinceLastSuccess = Date.now() - this.lastSuccessfulApiCall;
    const estimatedBlocksSinceSuccess = Math.floor(timeSinceLastSuccess / 1000);
    const estimatedCurrent = this.fallbackBlockHeight + estimatedBlocksSinceSuccess;

    // Be more conservative with fallback advances
    const maxAdvance = Math.min(estimatedBlocksSinceSuccess, 100); // Max 100 blocks advance
    const conservativeEstimate = this.fallbackBlockHeight + maxAdvance;

    console.log(`Using calculated fallback: ${conservativeEstimate} (${maxAdvance} blocks estimated since last success)`);
    return conservativeEstimate;
  }

  private calculatePollingInterval(): number {
    if (this.apiHealthScore > 80) {
      return 5000;
    } else if (this.apiHealthScore > 50) {
      return 8000;
    } else if (this.apiHealthScore > 20) {
      return 15000;
    } else {
      return 30000;
    }
  }

  private async healthMonitor() {
    while (this.running) {
      await new Promise(r => setTimeout(r, 60000));

      const timeSinceLastSuccess = Date.now() - this.lastSuccessfulApiCall;

      if (timeSinceLastSuccess > 300000) {
        console.warn('API appears to be down - entering degraded mode');
        this.apiHealthScore = 0;
      } else if (timeSinceLastSuccess > 120000) {
        this.apiHealthScore = Math.min(this.apiHealthScore, 30);
      }

      const stats = this.rateLimiter.getStats();
      if (stats.circuitState !== 'CLOSED' || stats.retryBudget.tokensRemaining < 50) {
        console.log('Rate limiter status:', JSON.stringify(stats, null, 2));
      }
    }
  }

  async getCurrentBlock(): Promise<number | null> {
    return this.getCurrentBlockWithFallback();
  }

  async getLastIndexedBlock(): Promise<number> {
    const result = await pool.query(
      'SELECT MAX(block_number) as last_block FROM contract_states'
    );
    return result.rows[0]?.last_block || 0;
  }

  async storeBlock(data: BlockData) {
    const { block, timestamp, state } = data;

    // Convert BN objects to strings
    const totalPoolStakeTokenStr = state.totalPoolStakeToken?.toString() || '0';
    const totalPoolLiquidStr = state.totalPoolLiquid?.toString() || '0';
    const stakeTokenBalanceStr = state.stakeTokenBalance?.toString() || '0';
    const buyInPercentageStr = state.buyInPercentage?.toString() || '0';

    // Calculate exchange rate - skip storing if no liquid tokens to avoid wrong data
    const totalStake = BigInt(totalPoolStakeTokenStr);
    const totalLiquid = BigInt(totalPoolLiquidStr);

    if (totalLiquid === BigInt(0)) {
      console.log(`Block ${block}: No liquid tokens yet, skipping to avoid wrong exchange rate`);
      return;
    }

    const exchangeRate = Number(totalStake) / Number(totalLiquid);

    await pool.query(
      `
INSERT INTO contract_states (
  block_number, timestamp, total_pool_stake_token, total_pool_liquid,
  exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (block_number) DO UPDATE SET
  timestamp = EXCLUDED.timestamp,
  exchange_rate = EXCLUDED.exchange_rate
WHERE contract_states.timestamp < EXCLUDED.timestamp
`,
      [
        block,
        timestamp,
        totalPoolStakeTokenStr,
        totalPoolLiquidStr,
        exchangeRate,
        stakeTokenBalanceStr,
        buyInPercentageStr,
        state.buyInEnabled || false
      ]
    );

    // Update current state for recent blocks
    if (block >= this.lastHeadBlock - 10) {
      await pool.query(
        `
INSERT INTO current_state (
  id, block_number, timestamp, total_pool_stake_token, total_pool_liquid,
  exchange_rate, stake_token_balance, buy_in_percentage, buy_in_enabled
) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
  block_number = EXCLUDED.block_number,
  timestamp = EXCLUDED.timestamp,
  total_pool_stake_token = EXCLUDED.total_pool_stake_token,
  total_pool_liquid = EXCLUDED.total_pool_liquid,
  exchange_rate = EXCLUDED.exchange_rate,
  stake_token_balance = EXCLUDED.stake_token_balance,
  buy_in_percentage = EXCLUDED.buy_in_percentage,
  buy_in_enabled = EXCLUDED.buy_in_enabled
WHERE current_state.block_number <= EXCLUDED.block_number
`,
        [
          block, timestamp, totalPoolStakeTokenStr, totalPoolLiquidStr,
          exchangeRate, stakeTokenBalanceStr, buyInPercentageStr, state.buyInEnabled || false
        ]
      );
    }

    // Store user balances efficiently
    if (state.liquidTokenState?.balances) {
      const values: any[] = [];
      const placeholders: string[] = [];

      let i = 1;
      // Handle both Map and object structures
      let balanceEntries: [string, any][] = [];

      if (typeof state.liquidTokenState.balances.entries === 'function') {
        // It's a Map
        balanceEntries = Array.from(state.liquidTokenState.balances.entries());
      } else if (typeof state.liquidTokenState.balances === 'object') {
        // It's a plain object
        balanceEntries = Object.entries(state.liquidTokenState.balances);
      }

      for (const [address, balance] of balanceEntries) {
        const balanceStr = balance?.toString() || '0';
        if (balanceStr !== '0') {
          values.push(address, balanceStr, timestamp);
          placeholders.push(`($${i}, $${i+1}, $${i+2}, $${i+2})`);
          i += 3;
        }
      }

      if (placeholders.length > 0) {
        await pool.query(
          `
INSERT INTO users (address, balance, first_seen, last_seen)
VALUES ${placeholders.join(',')}
ON CONFLICT (address) DO UPDATE SET
  balance = EXCLUDED.balance,
  last_seen = EXCLUDED.last_seen
WHERE users.last_seen < EXCLUDED.last_seen
`,
          values
        );
      }
    }

    data.exchangeRate = exchangeRate;
  }

  private async batchProcessorLoop() {
    console.log('Starting aggressive batch processor for 5 RPS maximum utilization');

    while (this.running) {
      try {
        if (this.requestBatch.length > 0 && this.apiHealthScore > 30) {
          const blocksToProcess = this.requestBatch.splice(0, 5);

          const promises = blocksToProcess.map(async (block) => {
            try {
              const data = await this.fetchBlockWithRateLimiter(block);
              if (data && data.state) {
                await this.storeBlock(data);
                return true;
              }
            } catch (error) {
              console.warn(`Batch failed for block ${block}: ${error.message}`);
              this.requestBatch.unshift(block);
            }
            return false;
          });

          const results = await Promise.allSettled(promises);
          const successCount = results.filter(r => r.status === 'fulfilled').length;

          if (successCount > 0) {
            console.log(`Batch processed ${successCount}/${blocksToProcess.length} blocks`);
          }
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error('Batch processor error:', error.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async stop() {
    this.running = false;
    if (this.headTracker) {
      clearInterval(this.headTracker);
    }
    if (this.batchProcessor) {
      clearTimeout(this.batchProcessor);
    }
    console.log('Indexer stopped');
  }

  async getIndexingStats() {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_blocks,
        MIN(block_number) as earliest_block,
        MAX(block_number) as latest_block,
        COUNT(DISTINCT DATE_TRUNC('day', timestamp)) as days_indexed
      FROM contract_states
    `);

    const gaps = await this.detectAndPrioritizeGaps();

    return {
      ...stats.rows[0],
      gaps_detected: gaps.length,
      total_gap_blocks: gaps.reduce((sum, gap) => sum + (gap.end - gap.start + 1), 0),
      cache_size: this.blockCache.size,
      active_requests: this.activeRequests.size,
      performance: {
        blocks_processed: this.stats.blocksProcessed,
        requests_made: this.stats.requestsMade,
        cache_hits: this.stats.cacheHits,
        errors: this.stats.errors,
        uptime_seconds: Math.floor((Date.now() - this.stats.startTime) / 1000)
      }
    };
  }
}

export default new Indexer();