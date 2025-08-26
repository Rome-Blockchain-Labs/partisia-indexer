
export interface ValidatorNode {
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
  stakeable: boolean;
  isZkNode: boolean;
  selfStakedTokens: bigint; // APIssa stakedTokens
  inUse: bigint; // APIssa stakedToContract lista yhteenlaskettuna ja jaetaan 10000, niin saadaan MPC arvo
  allocatedTokens: bigint; // APIssa tokensInCustody (jaa 10000, niin tulee täysiä MPC tokeneita), 5M - tämä = vapaa stakettava tila
  freeSpace: bigint; // How much is left from max allowed allocated tokens per validator node is 5M MPC
  totalAcceptedDelegations: bigint; // delegatedStakesFromOthers array, laske listasta yhteen
  stakingGoal: bigint; // This is the amount the node is willing to autoaccept in total. Set to 0 if amount is not set.
  availableAutoAccept: bigint; // How much space is free for auto-accept
  ourDelegationAmount: bigint; // How much we have delegated to the node
  ourDelegationExpiration: number | null; // When is the expiration time if we have delegated to the node
  blacklistedUntilTS: number | null;
}

export interface Validators {
  nodes: ValidatorNode[];
}
