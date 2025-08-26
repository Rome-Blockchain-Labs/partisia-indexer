// src/types/apiResponses.ts


// Chain info response

export interface Node {
  address: string;
  blsPublicKey: string;
  entityJurisdiction: number;
  identity: string;
  name: string;
  numberOfVotes: string;
  publicKey: string;
  serverJurisdiction: number;
  status: string;
  website: string;
}

export interface CommitteeResponse {
  serializedContract: {
    committee: Node[];
  }
}

export interface ConsensusPlugin {
  // Just type what you need for validators:
  state: {
    committees: {
      [shardId: string]: {
        activeCommittee: Node[];
        committeeId: string;
      }
    }
  }
}

export interface Plugins {
  CONSENSUS: ConsensusPlugin;
  // Keep others as any if not used:
  ACCOUNT?: any;  
  ROUTING?: any;  
}

export interface ChainInfoResponse {
  governanceVersion: number;
  chainId: string;
  features: any;
  plugins: Plugins;
  shards: any;
}



// Account response

export interface AccountCoin {
  balance: string;
}

export interface DelegatedStakeValue {
  acceptedDelegatedStakes: string;
  expirationTimestamp: string,
  pendingDelegatedStakes: string;
}

export interface KeyValuePair<K, V> {
  key: K;
  value: V;
}

export interface SpentFreeTransactions {
  epoch: string;
  spentFreeTransactions: string;
}

export interface VestingAccount {
  releaseDuration: string;
  releaseInterval: string;
  releasedTokens: string;
  tokenGenerationEvent: string;
  tokens: string;
}

export interface PendingRetractedDelegatedStake {
  key: string;
  value: string;
}

export interface AccountData {
  accountCoins: AccountCoin[];
  custodian: Record<string, unknown>; // Empty object provided
  delegatedStakesFromOthers: KeyValuePair<string, DelegatedStakeValue>[];
  delegatedStakesToOthers: KeyValuePair<string, string>[];
  mpcTokens: string;
  pendingRetractedDelegatedStakes: PendingRetractedDelegatedStake[];
  pendingUnstakes: any[];
  spentFreeTransactions: SpentFreeTransactions;
  stakeable: boolean;
  stakedToContract: KeyValuePair<string, string>[];
  stakedTokens: string;
  storedPendingIceStakes: any[];
  storedPendingStakeDelegations: any[];
  storedPendingTransfers: any[];
  tokensInCustody: string;
  stakingGoal: string;
  vestingAccounts: VestingAccount[];
}

export interface AccountInfoResponse {
  shardId: string;
  nonce: number;
  account: AccountData;
}

export interface ContractDataResponse {
  shardId: string;
  nonce: number;
  account: AccountData;
}


export interface PendingUnlock {
  liquidAmount: bigint;
  stakeTokenAmount: bigint;
  createdAt: bigint;
  cooldownEndsAt: bigint;
  expiresAt: bigint;
}

// Interface for tracking pending delegated stakes
export interface PendingStakeInfo {
  amount: bigint;
  firstDetected: number; // Timestamp in milliseconds
}

export interface BalanceResponse {
  account: {
    balance: {
      "sign": boolean,
      "value": string
    }
  }
}
