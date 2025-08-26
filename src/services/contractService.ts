import axios from 'axios';
import { BlockchainAddress, BlockchainStateClientImpl } from '@partisiablockchain/abi-client';
import { liquid_staking } from '../abi/liquid_staking';
import config from '../config';

class ContractService {
  private client: BlockchainStateClientImpl;
  private contractAddress: BlockchainAddress;

  constructor() {
    this.client = BlockchainStateClientImpl.create(config.blockchain.apiUrl);
    this.contractAddress = BlockchainAddress.fromString(config.blockchain.contractAddress);
  }

  async getContractState() {
    const stakingContract = new liquid_staking(this.client, this.contractAddress);
    return await stakingContract.getState();
  }

  async getCurrentBlockTime(): Promise<number> {
    const url = `${config.blockchain.apiUrl}/chain/shards/Shard0/blocks`;
    const response = await axios.get(url);
    return response.data.blockTime;
  }

  parseAction(txData: string): string | null {
    const actionMap: { [key: string]: string } = {
      '10': 'submit',
      '11': 'withdraw', 
      '12': 'accrue_rewards',
      '13': 'request_unlock',
      '15': 'redeem'
    };
    const prefix = txData.substring(0, 2);
    return actionMap[prefix] || null;
  }
}

export default new ContractService();
