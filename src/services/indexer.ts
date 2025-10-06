import { Pool } from 'pg';
import axios from 'axios';
import config from '../config';

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

  async start() {
    this.running = true;
    console.log('Starting LS Contract Indexer');
    console.log(`Contract: ${CONTRACT_ADDRESS} on Shard2`);
    console.log(`Rate limits active - head priority mode`);

    // Initialize backfill cursor
    const lastIndexed = await this.getLastIndexedBlock();
    const deploymentBlock = parseInt(process.env.DEPLOYMENT_BLOCK || '10682802');
    this.backfillCursor = lastIndexed || deploymentBlock;

    // Start only essential processes to respect rate limits
    await Promise.all([
      this.headTrackingLoop(),      // Priority 1: Keep head current
      this.lightBackfillLoop(),     // Priority 2: Slow historical backfill
      this.statsReporter()
    ]);
  }

  // Conservative head tracking for rate-limited RPC
  private async headTrackingLoop() {
    console.log('Head tracking: checking every 30 seconds');

    while (this.running) {
      try {
        const currentBlock = await this.getCurrentBlock();

        if (currentBlock && currentBlock > this.lastHeadBlock) {
          // Only fetch the latest block to minimize API calls
          const data = await this.fetchBlockOptimized(currentBlock);

          if (data && data.state) {
            await this.storeBlock(data);
            console.log(`Head updated: block ${currentBlock} | rate=${data.exchangeRate?.toFixed(6)}`);
            this.lastHeadBlock = currentBlock;
          }
        }

        // Check every 30 seconds to respect rate limits
        await new Promise(r => setTimeout(r, 30000));
      } catch (error) {
        if (error.response?.status === 429) {
          console.warn('Rate limited - backing off for 60 seconds');
          await new Promise(r => setTimeout(r, 60000));
        } else {
          console.error('Head tracking error:', error.message);
          await new Promise(r => setTimeout(r, 30000));
        }
      }
    }
  }

  // Very light backfilling to respect rate limits
  private async lightBackfillLoop() {
    console.log('Light backfill: 10 blocks every 5 minutes');

    // Wait 2 minutes before starting backfill
    await new Promise(r => setTimeout(r, 120000));

    while (this.running) {
      try {
        const gap = await this.findNextGap();

        if (gap && gap.start) {
          // Only process 10 blocks at a time with rate-limited RPC
          const blocks = Array.from(
            { length: Math.min(10, gap.end - gap.start + 1) },
            (_, i) => gap.start + i
          );

          console.log(`Backfilling blocks ${blocks[0]} to ${blocks[blocks.length - 1]}`);

          // Process one at a time to avoid rate limits
          for (const block of blocks) {
            try {
              const data = await this.fetchBlockOptimized(block);
              if (data && data.state) {
                await this.storeBlock(data);
              }
              // 2 second delay between each block
              await new Promise(r => setTimeout(r, 2000));
            } catch (error) {
              if (error.response?.status === 429) {
                console.warn('Backfill rate limited - pausing for 5 minutes');
                await new Promise(r => setTimeout(r, 300000));
                break;
              }
            }
          }

          this.backfillCursor = blocks[blocks.length - 1];
        }

        // Wait 5 minutes before next backfill batch
        await new Promise(r => setTimeout(r, 300000));
      } catch (error) {
        console.error('Backfill error:', error.message);
        this.stats.errors++;
        // Wait 10 minutes on error
        await new Promise(r => setTimeout(r, 600000));
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
      const data = await this.fetchBlockOptimized(block);

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

  // Optimized block fetching with circuit breaker
  private async fetchBlockOptimized(block: number): Promise<BlockData | null> {
    this.stats.requestsMade++;

    const maxRetries = 2;
    const baseTimeout = 5000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await axios.get(
          `${process.env.PARTISIA_API_URL}/chain/contracts/${CONTRACT_ADDRESS}?blockTime=${block}`,
          {
            timeout: baseTimeout * (attempt + 1),
            validateStatus: (status) => status === 200 || status === 404
          }
        );

        if (resp.status === 404) {
          return null; // Block doesn't exist yet
        }

        if (resp.data?.serializedContract) {
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
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)));
      }
    }
    return null;
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

  async getCurrentBlock(): Promise<number | null> {
    try {
      const response = await axios.get(
        `${process.env.PARTISIA_API_URL}/blockchain/info`,
        { timeout: 5000 }
      );
      return response.data?.bestBlock || null;
    } catch (error) {
      return null;
    }
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

    // Calculate exchange rate
    const totalStake = BigInt(totalPoolStakeTokenStr);
    const totalLiquid = BigInt(totalPoolLiquidStr);
    const exchangeRate = totalLiquid === 0n ? 1.0 : Number(totalStake) / Number(totalLiquid);

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
      for (const [address, balance] of state.liquidTokenState.balances.entries()) {
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

  async stop() {
    this.running = false;
    if (this.headTracker) {
      clearInterval(this.headTracker);
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