import axios from 'axios';
import { liquid_staking } from '../abi/liquid_staking';
import config from '../config/default';
import logger from '../utils/logger';
import { filterValidatorNodes } from './delegationService';
import {
  AccountInfoResponse,
  ChainInfoResponse,
  CommitteeResponse,
  ContractDataResponse,
  BalanceResponse,
  Node
} from '../types/apiResponses';
import { ValidatorNode } from '../types/validators';
import { bnToFullMPC } from '../utils/helpers';

import {
  BlockchainStateClientImpl,
  BlockchainAddress
} from '@partisiablockchain/abi-client';


class PartisiaApiService {
  private baseUrl: string;
  private botAccount: string;
  private client: BlockchainStateClientImpl;
  private scAddress: BlockchainAddress;
  private stakeTokenAddress: BlockchainAddress;

  constructor() {
    this.baseUrl = config.blockchain.apiBaseUrl;
    this.botAccount = config.blockchain.botAccount;

    this.client = BlockchainStateClientImpl.create(this.baseUrl);
    this.scAddress = BlockchainAddress.fromString(config.blockchain.contractAddress);
    this.stakeTokenAddress = BlockchainAddress.fromString(config.blockchain.mpcToken);
  }

  /**
 * Fetch the full chain data from the Partisia blockchain.
 */
  async getChainData(): Promise<ChainInfoResponse> {
    try {
      const { data } = await axios.get<ChainInfoResponse>(
        `${this.baseUrl}/chain/`
      );

      return data;
    } catch (error) {
      logger.error('Error fetching chain data:', error);
      return {
        governanceVersion: 0,
        chainId: '',
        features: {},
        plugins: {
          CONSENSUS: {
            state: {
              committees: {},
            },
          },
        },
        shards: {},
      } as ChainInfoResponse;
    }
  }

  /**
   * Fetch the list of current active validators
   */
  async getActiveValidators(): Promise<Node[]> {
    const { data } = await axios.get<CommitteeResponse>(
      `${this.baseUrl}/shards/Shard0/blockchain/contracts/04203b77743ad0ca831df9430a6be515195733ad91?requireContractState=true`
    );

    return data.serializedContract.committee;
  }

  /**
   * Fetch all validator accounts
   */
  async fetchValidatorAccounts(validators: Node[]): Promise<AccountInfoResponse[]> {
    logger.info(`Fetch the account data for ${validators.length} validators.`);
    let counter = 0;
    const validatorAccountInfos = [];
    for (const validator of validators) {
      counter++;
      if (counter % 10 === 0) {
        logger.info(`Processed ${counter}/${validators.length} validators`);
      }
      const accountInfo = await this.getAccountInfo(validator.identity);
      validatorAccountInfos.push(accountInfo);
    }
    return validatorAccountInfos;
  }


  /**
   * Fetches the chain data and returns the validator nodes.
   */
  async getValidatorNodes(): Promise<Array<{validator: Node, accountInfo: AccountInfoResponse}>>{
    const validators = await this.getActiveValidators();
    const validatorAccounts = await this.fetchValidatorAccounts(validators);

    return validators.map((validator, index) => ({
      validator,
      accountInfo: validatorAccounts[index]
    }));
  }

  /**
  * Fetch account info for a given account.
  * @param account The account ID to fetch info for.
  */
  async getAccountInfo(account: string): Promise<AccountInfoResponse> {
    try {
      const { data } = await axios.get<AccountInfoResponse>(
        `${this.baseUrl}/chain/accounts/${account}`
      );
      return data;
    } catch (error) {
      logger.error(`Error fetching account info for ${account}:`, error);
      return {
        shardId: '',
        nonce: 0,
        account: null,
      } as unknown as AccountInfoResponse;
    }
  }

  async getContractBalance(): Promise<bigint> {
    let balance = BigInt(0);
    try {
      const url = `${this.baseUrl}/chain/contracts/${config.blockchain.contractAddress}`;
      const { data } = await axios.get<BalanceResponse>(url);
      balance = data.account.balance.sign
      ? BigInt(data.account.balance.value)
      : -BigInt(data.account.balance.value);
    } catch (error) {
      logger.error("Error fetching contract balance:", error);
      return 0n;
    }
    return balance;
  }

  async getLSContractState(): Promise<any> {
    // Create the liquid_staking instance
    const stakingContract = new liquid_staking(this.client, this.scAddress);

    // Now you can use it, for example:
    return stakingContract.getState()
      .then(state => {
        return state;
      }).catch(err => {
        console.error("Error getting state:", err);
        return null;
      });
  }
}

export default new PartisiaApiService();
