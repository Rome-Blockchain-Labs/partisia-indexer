export interface RawContractState {
  total_pool_stake_token: string;
  total_pool_liquid: string;
  exchange_rate: string;
  stake_token_balance: string;
  buy_in_percentage: string;
  buy_in_enabled: boolean;
  token_for_staking?: string;
  staking_responsible?: string;
  administrator?: string;
  length_of_cooldown_period?: string;
  length_of_redeem_period?: string;
  amount_of_buy_in_locked_stake_tokens?: string;
  token_name?: string;
  token_symbol?: string;
  token_decimals?: number;
}

export interface ContractState {
  blockNumber: bigint;
  timestamp: Date;
  totalPoolStakeToken: bigint;
  totalPoolLiquid: bigint;
  exchangeRate: number;
  stakeTokenBalance: bigint;
  buyInPercentage: number;
  buyInEnabled: boolean;
  tokenForStaking?: string;
  stakingResponsible?: string;
  administrator?: string;
  lengthOfCooldownPeriod?: bigint;
  lengthOfRedeemPeriod?: bigint;
  amountOfBuyInLockedStakeTokens?: bigint;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export interface BlockResponse {
  blockNumber: number;
  timestamp: string;
  serializedContract?: string;
  contractState?: RawContractState;
  account?: {
    latestStorageFeeTime?: string;
  };
}

export interface PendingUnlock {
  user: string;
  amount: string;
  unlockTime: string;
}

export interface BuyInToken {
  tokenId: string;
  amount: string;
  buyInTime: string;
}

export function parseContractState(blockNumber: number, timestamp: string, raw: RawContractState): ContractState {
  return {
    blockNumber: BigInt(blockNumber),
    timestamp: new Date(timestamp),
    totalPoolStakeToken: BigInt(raw.total_pool_stake_token),
    totalPoolLiquid: BigInt(raw.total_pool_liquid),
    exchangeRate: parseFloat(raw.exchange_rate),
    stakeTokenBalance: BigInt(raw.stake_token_balance),
    buyInPercentage: parseFloat(raw.buy_in_percentage),
    buyInEnabled: raw.buy_in_enabled,
    tokenForStaking: raw.token_for_staking,
    stakingResponsible: raw.staking_responsible,
    administrator: raw.administrator,
    lengthOfCooldownPeriod: raw.length_of_cooldown_period ? BigInt(raw.length_of_cooldown_period) : undefined,
    lengthOfRedeemPeriod: raw.length_of_redeem_period ? BigInt(raw.length_of_redeem_period) : undefined,
    amountOfBuyInLockedStakeTokens: raw.amount_of_buy_in_locked_stake_tokens ? BigInt(raw.amount_of_buy_in_locked_stake_tokens) : undefined,
    tokenName: raw.token_name,
    tokenSymbol: raw.token_symbol,
    tokenDecimals: raw.token_decimals,
  };
}

export function validateContractState(state: any): state is RawContractState {
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof state.total_pool_stake_token === 'string' &&
    typeof state.total_pool_liquid === 'string' &&
    typeof state.exchange_rate === 'string' &&
    typeof state.stake_token_balance === 'string' &&
    typeof state.buy_in_percentage === 'string' &&
    typeof state.buy_in_enabled === 'boolean'
  );
}