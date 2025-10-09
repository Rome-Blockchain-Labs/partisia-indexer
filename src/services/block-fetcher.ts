import axios from 'axios';

const API_URL = process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com';
const SHARD_ID = process.env.PARTISIA_SHARD || '2';

export class BlockFetcher {
  async getLatestBlocks(limit: number = 10): Promise<any[]> {
    try {
      const response = await axios.get(
        `${API_URL}/chain/shards/${SHARD_ID}/blocks`,
        {
          params: { limit },
          timeout: 10000
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching blocks:', error.message);
      return [];
    }
  }

  async getBlock(blockId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${API_URL}/chain/shards/${SHARD_ID}/blocks/${blockId}`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching block ${blockId}:`, error.message);
      return null;
    }
  }

  async getTransaction(txId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${API_URL}/chain/shards/${SHARD_ID}/transactions/${txId}`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getContractAtBlock(contractAddress: string, blockTime: number): Promise<any> {
    try {
      const response = await axios.get(
        `${API_URL}/chain/contracts/${contractAddress}`,
        {
          params: { blockTime },
          timeout: 5000
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }
}

export default new BlockFetcher();