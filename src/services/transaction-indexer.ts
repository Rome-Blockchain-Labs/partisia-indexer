import axios from 'axios';
import db from '../db/client';
import { AbiByteInput } from '@partisiablockchain/abi-client';

const CONTRACT_ADDRESS = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
const API_URL = process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com';

interface Transaction {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  sender: string;
  action: string;
  data?: any;
}

class TransactionIndexer {
  private running = false;
  private lastIndexedBlock = 0;

  async start() {
    this.running = true;
    console.log('📝 Starting Transaction Indexer for accrue rewards');

    // Get last indexed block
    const result = await db.query('SELECT MAX(block_number) as last FROM transactions');
    this.lastIndexedBlock = result.rows[0]?.last || 0;

    this.indexLoop();
  }

  private async indexLoop() {
    while (this.running) {
      try {
        await this.fetchAndIndexTransactions();
        // Check every 60 seconds for new transactions
        await new Promise(r => setTimeout(r, 60000));
      } catch (error) {
        console.error('Transaction indexing error:', error.message);
        await new Promise(r => setTimeout(r, 60000));
      }
    }
  }

  private async fetchAndIndexTransactions() {
    try {
      // Fetch recent blocks using the correct API
      const blocksResponse = await axios.get(
        `${API_URL}/chain/shards/2/blocks`,
        {
          params: { limit: 50 },
          timeout: 10000
        }
      );

      const blocks = blocksResponse.data || [];

      for (const block of blocks) {
        // Skip if we've already processed this block
        if (block.height <= this.lastIndexedBlock) continue;

        // Check if block has transactions
        if (block.transactions && block.transactions.length > 0) {
          console.log(`📦 Processing block ${block.height} with ${block.transactions.length} transactions`);

          // Check each transaction in the block
          for (const txId of block.transactions) {
            await this.processTransaction(txId, block.height, block.timestamp);
          }
        }

        this.lastIndexedBlock = block.height;
      }
    } catch (error) {
      console.error('Error fetching blocks:', error.message);
    }
  }

  private async processTransaction(txHash: string, blockNumber: number, timestamp: string) {
    try {
      // Fetch full transaction details using correct API
      const txResponse = await axios.get(
        `${API_URL}/chain/shards/2/transactions/${txHash}`,
        { timeout: 5000 }
      );

      const tx = txResponse.data;

      // Check if transaction is related to our contract
      if (tx && this.isContractTransaction(tx)) {
        const parsedTx = this.parseTransaction(tx);

        // Save to database if it's an accrue reward or other important action
        if (parsedTx.action === 'accrueRewards' ||
            parsedTx.action === 'stake' ||
            parsedTx.action === 'unstake' ||
            parsedTx.action === 'redeem') {

          await db.saveTransaction({
            txHash,
            blockNumber,
            timestamp: new Date(timestamp),
            action: parsedTx.action,
            sender: parsedTx.sender,
            amount: parsedTx.amount,
            metadata: parsedTx.metadata
          });

          console.log(`📌 Indexed ${parsedTx.action} transaction: ${txHash.slice(0, 8)}...`);
        }
      }
    } catch (error) {
      // Silently skip if transaction not found or not relevant
      if (error.response?.status !== 404) {
        console.error(`Error processing tx ${txHash.slice(0, 8)}:`, error.message);
      }
    }
  }

  private isContractTransaction(tx: any): boolean {
    // Check if transaction involves our contract
    if (tx.content) {
      const content = Buffer.from(tx.content, 'base64').toString('hex');
      return content.includes(CONTRACT_ADDRESS.replace('0x', ''));
    }
    return false;
  }

  private parseTransaction(tx: any): any {
    try {
      const content = Buffer.from(tx.content, 'base64');

      // Try to identify the action from the transaction content
      // This is a simplified parser - real implementation would need ABI decoding
      const contentHex = content.toString('hex');

      let action = 'unknown';
      let amount = '0';
      let metadata = {};

      // Look for method signatures (simplified)
      if (contentHex.includes('6163637275655265776172647')) { // "accrueRewards" in hex
        action = 'accrueRewards';

        // Try to extract reward amounts
        try {
          // This would need proper ABI decoding
          const input = new AbiByteInput(content);
          // Skip to reward data section
          metadata = {
            userRewards: '0',
            protocolRewards: '0',
            timestamp: tx.executionStatus?.blockId
          };
        } catch (e) {
          // Fallback to basic parsing
        }
      } else if (contentHex.includes('7374616b65')) { // "stake"
        action = 'stake';
      } else if (contentHex.includes('756e7374616b65')) { // "unstake"
        action = 'unstake';
      } else if (contentHex.includes('72656465656d')) { // "redeem"
        action = 'redeem';
      }

      return {
        action,
        sender: this.extractSender(tx),
        amount,
        metadata
      };
    } catch (error) {
      return {
        action: 'unknown',
        sender: 'unknown',
        amount: '0',
        metadata: {}
      };
    }
  }

  private extractSender(tx: any): string {
    // Extract sender address from transaction
    // This would need proper implementation based on Partisia tx format
    return 'unknown';
  }

  stop() {
    this.running = false;
    console.log('Transaction indexer stopped');
  }
}

export default new TransactionIndexer();