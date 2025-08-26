export interface CombinedEvent {
  type: string;
  amount: bigint;
  expirationTime: bigint | null;
  endTime: bigint;
  nodeId: string | null
  unstake: boolean;
}

// Define an interface for the delegation object
export interface DelegationData {
  key: string; // Node address
  value: string; // The amount we have delegated to the node
  acceptedDelegatedStakes: bigint; // The amount node has accepted
  expirationTimestamp: bigint; // Expiration time set to delegation
  pendingDelegatedStakes: bigint;  // The amount still pending
  freeTokensZK: bigint; // The amount of freeTokens the NODE has on ZK
  freeTokensLargeOracle: bigint; // The amount of freeTokens the NODE has on LO
  freeTokensTotal: bigint; // The amount of freeTokens the NODE has in total
}
