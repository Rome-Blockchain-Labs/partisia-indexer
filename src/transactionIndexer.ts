import axios from 'axios';
import config from './config';
import db from './db/client';

class PartisiaTransactionIndexer {
  private running = false;

  private readonly batchSize = parseInt(process.env.TX_BATCH_SIZE || '50');
  private readonly concurrency = parseInt(process.env.TX_CONCURRENCY || '5');
  private readonly txConcurrency = parseInt(process.env.TX_PER_BLOCK_CONCURRENCY || '10');
  private readonly retryAttempts = parseInt(process.env.TX_RETRY_ATTEMPTS || '3');

  private readonly liquidStakingContract = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
  private readonly stakingResponsible = process.env.STAKING_RESPONSIBLE || '000016e01e04096e52e0a6021e877f01760552abfb';

  private readonly usePublicApiForBlocks = process.env.USE_PUBLIC_API_FOR_BLOCKS !== 'false';
  private lastPublicApiCall = 0;
  private readonly publicApiRateLimit = 600;

  private currentBlockHeight = 0;
  private lastProcessedBlock = 0;

  private stats = {
    transactionsProcessed: 0,
    blocksScanned: 0,
    contractTxFound: 0,
    adminTxFound: 0,
    startTime: Date.now()
  };

  // Transaction buffer for batched DB writes
  private transactionBuffer: Array<{
    txId: string;
    blockNumber: number;
    blockTimestamp: Date;
    action: string;
    metadata: any;
  }> = [];
  private readonly bufferFlushSize = 100;

  // Failed blocks retry queue
  private failedBlocksQueue: Set<number> = new Set();
  private readonly maxRetryQueueSize = 1000;

  constructor() {}

  async start() {
    console.log('🔍 Starting Partisia Transaction Indexer');
    console.log(`📄 Contract: ${this.liquidStakingContract}`);
    console.log(`👤 Admin: ${this.stakingResponsible}`);
    console.log(`⚙️  Batch Size: ${this.batchSize}`);
    console.log(`🔄 Concurrency: ${this.concurrency}`);
    console.log(`🌐 Public API: ${this.usePublicApiForBlocks ? 'enabled' : 'disabled'}`);

    this.running = true;
    this.lastProcessedBlock = await this.getLastProcessedTxBlock();
    this.currentBlockHeight = await this.getCurrentBlockHeight() || 0;

    console.log(`📊 Starting transaction scan from block ${this.lastProcessedBlock + 1}`);
    console.log(`🎯 Target: ${this.currentBlockHeight} (${this.currentBlockHeight - this.lastProcessedBlock} blocks to scan)`);

    let retryCounter = 0;
    while (this.running) {
      try {
        await this.processBatch();

        // Process retry queue every 10 batches
        if (++retryCounter % 10 === 0 && this.failedBlocksQueue.size > 0) {
          await this.processRetryQueue();
        }

        await this.sleep(100); // Small delay between batches
      } catch (error) {
        console.error('❌ Transaction indexer batch failed:', error);
        await this.sleep(5000); // Longer delay on error
      }
    }
  }

  private async processRetryQueue(): Promise<void> {
    if (this.failedBlocksQueue.size === 0) return;

    console.log(`🔄 Processing retry queue (${this.failedBlocksQueue.size} blocks)`);
    const blocksToRetry = Array.from(this.failedBlocksQueue).slice(0, 20); // Retry up to 20 at a time

    await this.processBlocksConcurrently(blocksToRetry);
  }

  private async processBatch(): Promise<void> {
    if (this.lastProcessedBlock >= this.currentBlockHeight) {
      this.currentBlockHeight = await this.getCurrentBlockHeight() || 0;
      await this.sleep(1000);
      return;
    }

    const startBlock = this.lastProcessedBlock + 1;
    const endBlock = Math.min(startBlock + this.batchSize - 1, this.currentBlockHeight);
    const blocks = [];

    for (let block = startBlock; block <= endBlock; block++) {
      blocks.push(block);
    }

    console.log(`🔍 Scanning blocks ${startBlock}-${endBlock} for transactions (${blocks.length} blocks)`);

    // Process blocks concurrently but rate-limited
    const results = await this.processBlocksConcurrently(blocks);

    // Flush any remaining transactions in buffer
    await this.flushTransactionBuffer();

    this.stats.blocksScanned += blocks.length;
    this.lastProcessedBlock = endBlock;

    // Update last processed block in database
    await this.updateLastProcessedTxBlock(endBlock);
  }

  private async processBlocksConcurrently(blocks: number[]): Promise<void> {
    // Maintain exactly N concurrent requests using Promise.race
    const inFlight = new Set<Promise<void>>();
    let blockIndex = 0;

    while (blockIndex < blocks.length || inFlight.size > 0) {
      while (inFlight.size < this.concurrency && blockIndex < blocks.length) {
        const block = blocks[blockIndex++];
        const promise = this.processBlockTransactions(block)
          .catch(error => {
            console.warn(`Failed to process block ${block}:`, error.message);
          });

        inFlight.add(promise);
        promise.finally(() => inFlight.delete(promise));
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }
  }

  private async processBlockTransactions(blockNumber: number): Promise<void> {
    try {
      // Step 1: Get block identifier (cache-first approach)
      const blockId = await this.getBlockId(blockNumber);

      if (!blockId) {
        this.addToRetryQueue(blockNumber);
        return;
      }

      // Step 2: Get full block with transaction IDs using local API
      const blockUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks/${blockId}`;
      const blockResponse = await axios.get(blockUrl, { timeout: 10000 });

      if (!blockResponse.data || !blockResponse.data.transactions || blockResponse.data.transactions.length === 0) {
        return; // No transactions in this block
      }

      const transactionIds = blockResponse.data.transactions;
      const blockTimestamp = new Date(blockResponse.data.productionTime || Date.now());

      // Step 3: Process all transactions concurrently
      await Promise.all(
        transactionIds.map((txId: string) =>
          this.processTransaction(txId, blockNumber, blockTimestamp)
            .catch(err => console.warn(`Failed to process tx ${txId}:`, err.message))
        )
      );

      // Success - remove from retry queue if it was there
      this.failedBlocksQueue.delete(blockNumber);

    } catch (error: any) {
      if (error.response?.status === 429 || error.message.includes('429') || error.message.includes('timeout')) {
        console.warn(`⏰ Block ${blockNumber} failed (${error.message}) - adding to retry queue`);
        this.addToRetryQueue(blockNumber);
      } else {
        console.warn(`Warning: Could not process transactions for block ${blockNumber}: ${error.message}`);
        this.addToRetryQueue(blockNumber);
      }
    }
  }

  private addToRetryQueue(blockNumber: number): void {
    if (this.failedBlocksQueue.size < this.maxRetryQueueSize) {
      this.failedBlocksQueue.add(blockNumber);
    } else {
      console.warn(`⚠️  Retry queue full (${this.maxRetryQueueSize}), dropping block ${blockNumber}`);
    }
  }

  private async processTransaction(txId: string, blockNumber: number, blockTimestamp: Date): Promise<void> {
    try {
      // Fetch transaction details
      const txUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/transactions/${txId}`;
      const txResponse = await axios.get(txUrl, { timeout: 10000 });

      if (!txResponse.data) {
        return;
      }

      const tx = txResponse.data;

      // Check if this transaction is relevant to our contract or admin
      const isRelevant = await this.isRelevantTransaction(tx, txId);

      if (isRelevant) {
        await this.storeTransaction(tx, txId, blockNumber, blockTimestamp);
        this.stats.transactionsProcessed++;

        const action = await this.identifyTransactionAction(tx);
        if (action) {
          console.log(`💰 Found ${action} transaction: ${txId} in block ${blockNumber}`);
        }
      }

    } catch (error: any) {
      console.warn(`Warning: Could not process transaction ${txId}: ${error.message}`);
    }
  }

  private async isRelevantTransaction(tx: any, txId: string): Promise<boolean> {
    const content = tx.content || '';
    const events = tx.executionStatus?.events || [];

    // Convert hex addresses to bytes for binary search
    const contractAddressHex = this.liquidStakingContract.toLowerCase();
    const adminAddressHex = this.stakingResponsible.toLowerCase();

    // Convert hex string to Buffer (remove any 0x prefix)
    const contractBytes = Buffer.from(contractAddressHex.replace(/^0x/, ''), 'hex');
    const adminBytes = Buffer.from(adminAddressHex.replace(/^0x/, ''), 'hex');

    // Decode base64 content to binary
    let contentBuffer: Buffer;
    try {
      contentBuffer = Buffer.from(content, 'base64');
    } catch (e) {
      // If base64 decode fails, treat as empty
      contentBuffer = Buffer.alloc(0);
    }

    // Check if contract or admin address bytes appear in the decoded content
    const hasContractInContent = contentBuffer.includes(contractBytes);
    const hasAdminInContent = contentBuffer.includes(adminBytes);

    // Also check in events JSON (events might have addresses)
    const eventsStr = JSON.stringify(events).toLowerCase();
    const hasContractInEvents = eventsStr.includes(contractAddressHex);
    const hasAdminInEvents = eventsStr.includes(adminAddressHex);

    // A transaction is relevant if it contains our contract or admin address
    const isRelevant = hasContractInContent || hasAdminInContent ||
                      hasContractInEvents || hasAdminInEvents;

    if (isRelevant) {
      console.log(`🔍 Relevant transaction found: ${txId} (contract in content: ${hasContractInContent}, admin in content: ${hasAdminInContent}, contract in events: ${hasContractInEvents}, admin in events: ${hasAdminInEvents})`);
    }

    return isRelevant;
  }

  private async identifyTransactionAction(tx: any): Promise<string | null> {
    // Analyze transaction content to identify the action
    const content = tx.content || '';

    // This is a simplified identification - in a real implementation,
    // you'd decode the transaction content properly
    if (content.includes('accrue') || content.toLowerCase().includes('reward')) {
      return 'accrueRewards';
    } else if (content.includes('stake')) {
      return 'stake';
    } else if (content.includes('unstake') || content.includes('redeem')) {
      return 'unstake';
    } else if (content.includes('buyIn')) {
      return 'buyIn';
    } else if (content.includes('admin')) {
      return 'admin';
    }

    return 'unknown';
  }

  private async storeTransaction(tx: any, txId: string, blockNumber: number, blockTimestamp: Date): Promise<void> {
    const action = await this.identifyTransactionAction(tx) || 'unknown';
    const isSuccess = tx.executionStatus?.success || false;

    // Extract any amounts or relevant data from transaction
    const metadata = {
      isSuccess,
      executionStatus: tx.executionStatus,
      isEvent: tx.isEvent || false,
      contentLength: (tx.content || '').length
    };

    // Add to buffer instead of immediate write
    this.transactionBuffer.push({
      txId,
      blockNumber,
      blockTimestamp,
      action,
      metadata
    });

    // Update stats
    if (action.includes('admin')) {
      this.stats.adminTxFound++;
    } else {
      this.stats.contractTxFound++;
    }

    // Flush if buffer is full
    if (this.transactionBuffer.length >= this.bufferFlushSize) {
      await this.flushTransactionBuffer();
    }
  }

  private async flushTransactionBuffer(): Promise<void> {
    if (this.transactionBuffer.length === 0) {
      return;
    }

    const batch = [...this.transactionBuffer];
    this.transactionBuffer = [];

    try {
      // Batch insert all transactions
      const values = batch.map((_, i) => {
        const offset = i * 6;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6})`;
      }).join(',');

      const params = batch.flatMap(t => [
        t.txId,
        t.blockNumber,
        t.blockTimestamp,
        t.action,
        'unknown',
        JSON.stringify(t.metadata)
      ]);

      await db.query(`
        INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, metadata)
        VALUES ${values}
        ON CONFLICT (tx_hash) DO UPDATE SET
          action = EXCLUDED.action,
          metadata = EXCLUDED.metadata
      `, params);

      this.stats.transactionsProcessed += batch.length;
    } catch (error: any) {
      console.error(`Failed to flush ${batch.length} transactions:`, error.message);
      // Re-add to buffer for retry
      this.transactionBuffer.unshift(...batch);
    }
  }

  // In-memory cache for block ID mappings to reduce DB queries
  private blockIdCache = new Map<number, string>();

  // Cache-first block ID resolution - avoid repeated public API calls
  private async getBlockId(blockNumber: number): Promise<string | null> {
    try {
      // Step 1: Check in-memory cache first
      if (this.blockIdCache.has(blockNumber)) {
        return this.blockIdCache.get(blockNumber)!;
      }

      // Step 2: Check database cache
      const cachedResult = await db.query(
        'SELECT block_id FROM block_mappings WHERE block_time = $1',
        [blockNumber]
      );

      if (cachedResult.rows.length > 0) {
        const blockId = cachedResult.rows[0].block_id;
        this.blockIdCache.set(blockNumber, blockId);
        return blockId;
      }

      // Step 2: Cache miss - choose API based on flag
      const publicApiUrl = this.usePublicApiForBlocks
        ? (process.env.TEMP_PUBLIC_API_FOR_BLOCKS || config.blockchain.apiUrl)
        : config.blockchain.apiUrl;

      if (this.usePublicApiForBlocks && publicApiUrl !== config.blockchain.apiUrl) {
        console.log(`🌐 Cache miss for block ${blockNumber}, querying public API`);
      } else {
        console.log(`🏠 Cache miss for block ${blockNumber}, querying local API`);
      }

      if (publicApiUrl !== config.blockchain.apiUrl) {
        await this.rateLimitPublicApi();
      }

      const blockTimeUrl = `${publicApiUrl}/chain/shards/${config.blockchain.shard}/blocks?blockTime=${blockNumber}`;
      const blockTimeResponse = await axios.get(blockTimeUrl, { timeout: 10000 });

      if (!blockTimeResponse.data || !blockTimeResponse.data.identifier) {
        return null;
      }

      const blockId = blockTimeResponse.data.identifier;
      const productionTime = blockTimeResponse.data.productionTime || null;

      // Step 3: Cache the result in both DB and memory
      await db.query(
        `INSERT INTO block_mappings (block_time, block_id, production_time)
         VALUES ($1, $2, $3)
         ON CONFLICT (block_time) DO NOTHING`,
        [blockNumber, blockId, productionTime]
      );

      this.blockIdCache.set(blockNumber, blockId);
      return blockId;

    } catch (error: any) {
      // Check if this is a rate limit error
      if (error.response?.status === 429 || error.message.includes('429')) {
        console.warn(`⏰ Block ${blockNumber} hit rate limit during block ID fetch - will retry with backoff`);
        throw error; // Let caller handle rate limit with backoff
      }

      console.error(`Failed to get block ID for ${blockNumber}: ${error.message}`);
      return null;
    }
  }

  // Rate limiter to avoid hitting public API limits
  private async rateLimitPublicApi(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastPublicApiCall;

    if (timeSinceLastCall < this.publicApiRateLimit) {
      const waitTime = this.publicApiRateLimit - timeSinceLastCall;
      await this.sleep(waitTime);
    }

    this.lastPublicApiCall = Date.now();
  }

  private async getCurrentBlockHeight(): Promise<number | null> {
    try {
      const response = await axios.get(`${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks`);
      return response.data?.blockTime || null;
    } catch (error) {
      console.error('Failed to get current block height:', error);
      return null;
    }
  }

  private async getLastProcessedTxBlock(): Promise<number> {
    try {
      const result = await db.query('SELECT MAX(block_number) as last_block FROM transactions');
      const lastBlock = result.rows[0]?.last_block;
      // Ensure proper conversion from BigInt/string to number
      return lastBlock ? parseInt(lastBlock.toString()) : config.blockchain.deploymentBlock;
    } catch (error) {
      console.error('Failed to get last processed transaction block:', error);
      return config.blockchain.deploymentBlock;
    }
  }

  private async updateLastProcessedTxBlock(blockNumber: number): Promise<void> {
    // Update the internal tracker
    this.lastProcessedBlock = blockNumber;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const runtime = Date.now() - this.stats.startTime;
    const runtimeMinutes = runtime / (1000 * 60);

    // Calculate progress from deployment block (0%) to current blockchain head (100%)
    const totalBlocks = Math.max(1, this.currentBlockHeight - config.blockchain.deploymentBlock);
    const blocksIndexed = Math.max(0, this.lastProcessedBlock - config.blockchain.deploymentBlock);
    const progressPercent = (blocksIndexed / totalBlocks * 100);

    return {
      ...this.stats,
      lastProcessedBlock: this.lastProcessedBlock,
      currentBlockHeight: this.currentBlockHeight,
      deploymentBlock: config.blockchain.deploymentBlock,
      progressPercent: progressPercent.toFixed(1),
      blocksRemaining: this.currentBlockHeight - this.lastProcessedBlock,
      runtime,
      runtimeMinutes: runtimeMinutes.toFixed(2),
      txPerMinute: runtimeMinutes > 0 ? (this.stats.transactionsProcessed / runtimeMinutes).toFixed(2) : '0',
      blocksPerMinute: runtimeMinutes > 0 ? (this.stats.blocksScanned / runtimeMinutes).toFixed(2) : '0'
    };
  }

  async stop() {
    this.running = false;
    // Flush any remaining buffered transactions
    await this.flushTransactionBuffer();
    console.log('🛑 Transaction indexer stopped');
    console.log('📊 Final stats:', this.getStats());
  }
}

export default new PartisiaTransactionIndexer();