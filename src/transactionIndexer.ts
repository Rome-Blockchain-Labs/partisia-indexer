import axios from 'axios';
import config from './config';
import db from './db/client';

class PartisiaTransactionIndexer {
  private running = false;

  private readonly batchSize = parseInt(process.env.TX_BATCH_SIZE || '50');
  private readonly concurrency = parseInt(process.env.TX_CONCURRENCY || '5');
  private readonly retryAttempts = parseInt(process.env.TX_RETRY_ATTEMPTS || '3');

  private readonly liquidStakingContract = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
  private readonly stakingResponsible = process.env.STAKING_RESPONSIBLE || '000016e01e04096e52e0a6021e877f01760552abfb';

  // Flag to control public API usage - can be disabled when local node is upgraded
  private readonly usePublicApiForBlocks = process.env.USE_PUBLIC_API_FOR_BLOCKS !== 'false';

  // Rate limiter for public API calls (max 2 queries per second)
  private lastPublicApiCall = 0;
  private readonly publicApiRateLimit = 500; // 500ms between calls = 2 per second

  private currentBlockHeight = 0;
  private lastProcessedBlock = 0;

  private stats = {
    transactionsProcessed: 0,
    blocksScanned: 0,
    contractTxFound: 0,
    adminTxFound: 0,
    startTime: Date.now()
  };

  constructor() {
    // Use shared DB connection from db/client.ts
  }

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

    while (this.running) {
      try {
        await this.processBatch();
        await this.sleep(100); // Small delay between batches
      } catch (error) {
        console.error('❌ Transaction indexer batch failed:', error);
        await this.sleep(5000); // Longer delay on error
      }
    }
  }

  private async processBatch(): Promise<void> {
    if (this.lastProcessedBlock >= this.currentBlockHeight) {
      // Caught up, check for new blocks
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

    this.stats.blocksScanned += blocks.length;
    this.lastProcessedBlock = endBlock;

    // Update last processed block in database
    await this.updateLastProcessedTxBlock(endBlock);
  }

  private async processBlocksConcurrently(blocks: number[]): Promise<void> {
    const chunks = this.chunkArray(blocks, this.concurrency);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(block => this.processBlockTransactions(block)));
    }
  }

  private async processBlockTransactions(blockNumber: number): Promise<void> {
    try {
      // Step 1: Get block identifier (cache-first approach)
      const blockId = await this.getBlockId(blockNumber);

      if (!blockId) {
        return; // Could not get block identifier
      }

      // Step 2: Get full block with transaction IDs using local API
      const blockUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/blocks/${blockId}`;
      const blockResponse = await axios.get(blockUrl, { timeout: 10000 });

      if (!blockResponse.data || !blockResponse.data.transactions || blockResponse.data.transactions.length === 0) {
        return; // No transactions in this block
      }

      const transactionIds = blockResponse.data.transactions;
      const blockTimestamp = new Date(blockTimeResponse.data.productionTime || Date.now());

      // Step 3: Process each transaction
      for (const txId of transactionIds) {
        await this.processTransaction(txId, blockNumber, blockTimestamp);
      }

    } catch (error: any) {
      console.warn(`Warning: Could not process transactions for block ${blockNumber}: ${error.message}`);
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

    // Convert content and events to searchable strings
    const contentStr = content.toLowerCase();
    const eventsStr = JSON.stringify(events).toLowerCase();
    const fullTxStr = JSON.stringify(tx).toLowerCase();

    // Our contract and admin addresses in various formats
    const contractId = this.liquidStakingContract.toLowerCase();
    const adminId = this.stakingResponsible.toLowerCase();

    // Check for direct address references
    const hasDirectContractRef = contentStr.includes(contractId) ||
                                eventsStr.includes(contractId) ||
                                fullTxStr.includes(contractId);

    const hasDirectAdminRef = contentStr.includes(adminId) ||
                             eventsStr.includes(adminId) ||
                             fullTxStr.includes(adminId);

    // Check for known liquid staking function signatures or patterns
    const liquidStakingPatterns = [
      'accrue', 'reward', 'stake', 'unstake', 'redeem', 'buyin',
      'liquid', 'exchange', 'pool', 'cooldown'
    ];

    const hasLSPattern = liquidStakingPatterns.some(pattern =>
      contentStr.includes(pattern) || eventsStr.includes(pattern)
    );

    // Check for specific known transactions
    const knownTxIds = [
      'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7', // accrueRewards
    ];
    const isKnownTx = knownTxIds.includes(txId);

    // Check if transaction has events (contract interactions often have events)
    const hasEvents = events.length > 0;

    // More comprehensive relevance check
    const isRelevant = hasDirectContractRef ||
                      hasDirectAdminRef ||
                      (hasLSPattern && hasEvents) ||
                      isKnownTx;

    if (isRelevant) {
      console.log(`🔍 Relevant transaction found: ${txId} (contract: ${hasDirectContractRef}, admin: ${hasDirectAdminRef}, pattern: ${hasLSPattern}, events: ${hasEvents})`);
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

    await db.query(`
      INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tx_hash) DO UPDATE SET
        action = EXCLUDED.action,
        metadata = EXCLUDED.metadata
    `, [txId, blockNumber, blockTimestamp, action, 'unknown', JSON.stringify(metadata)]);

    // Update stats
    if (action.includes('admin')) {
      this.stats.adminTxFound++;
    } else {
      this.stats.contractTxFound++;
    }
  }

  // Cache-first block ID resolution - avoid repeated public API calls
  private async getBlockId(blockNumber: number): Promise<string | null> {
    try {
      // Step 1: Check cache first
      const cachedResult = await db.query(
        'SELECT block_id FROM block_mappings WHERE block_time = $1',
        [blockNumber]
      );

      if (cachedResult.rows.length > 0) {
        console.log(`📦 Cache hit for block ${blockNumber}`);
        return cachedResult.rows[0].block_id;
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

      // Step 3: Cache the result
      await db.query(
        `INSERT INTO block_mappings (block_time, block_id, production_time)
         VALUES ($1, $2, $3)
         ON CONFLICT (block_time) DO NOTHING`,
        [blockNumber, blockId, productionTime]
      );

      console.log(`💾 Cached mapping: block ${blockNumber} -> ${blockId}`);
      return blockId;

    } catch (error: any) {
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
      return result.rows[0]?.last_block || config.blockchain.deploymentBlock;
    } catch (error) {
      console.error('Failed to get last processed transaction block:', error);
      return config.blockchain.deploymentBlock;
    }
  }

  private async updateLastProcessedTxBlock(blockNumber: number): Promise<void> {
    // We could store this in a separate table or use the max block from transactions table
    // For now, we rely on MAX(block_number) from transactions table
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

    return {
      ...this.stats,
      runtime,
      runtimeMinutes: runtimeMinutes.toFixed(2),
      txPerMinute: runtimeMinutes > 0 ? (this.stats.transactionsProcessed / runtimeMinutes).toFixed(2) : '0',
      blocksPerMinute: runtimeMinutes > 0 ? (this.stats.blocksScanned / runtimeMinutes).toFixed(2) : '0'
    };
  }

  async stop() {
    this.running = false;
    console.log('🛑 Transaction indexer stopped');
    console.log('📊 Final stats:', this.getStats());
  }
}

export default new PartisiaTransactionIndexer();