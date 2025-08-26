/**
 * LARGE ORACLE contract
 */

// Staking contract interfaces
export interface LargeOracleContractState {
  /** The type of contract (e.g. "GOVERNANCE"). */
  type: string;
  /** The contract address as a hex string. */
  address: string;
  /** Hash of the contract’s jar file (hex string). */
  jarHash: string;
  /** Length of the storage on‑chain. */
  storageLength: number;
  /** The serialized state of the contract. */
  serializedContract: SerializedLOContract;
  /** Contract ABI encoded as a string. */
  abi: string;
}

export interface SerializedLOContract {
  /** List of currently active disputes.  Empty in the observed contract; type left
   *  as unknown[] because no sample entries were present. */
  activeDisputes: unknown[];
  /** Address of the orchestration contract. */
  bpOrchestrationContract: string;
  /** BYOC twins to MPC trades.  Empty in the observed contract. */
  byocTwinsToMpcTrade: unknown[];
  /** The next message nonce used when emitting messages. */
  currentMessageNonce: number;
  /** Address of the contract representing governance updates. */
  governanceUpdates: string;
  /** The initial message nonce set when the contract was deployed. */
  initialMessageNonce: number;
  /** Conversion rate between the MPC token and USD. */
  mpcToUsdExchangeRate: any[];
  /** Public key identifying the oracle. */
  oracleKey: string;
  /** Members of the oracle committee. */
  oracleMembers: OracleMember[];
  /** Pending outbound messages.  Empty in the observed contract. */
  pendingMessages: unknown[];
  /** Messages that have been signed by the contract. */
  signedMessages: any[];
  /** Map of staker addresses to their token balances and locks. */
  stakedTokens: StakedToken[];
  /** Update requests awaiting processing.  Empty in the observed contract. */
  updateRequests: unknown[];
}

/** A member of the oracle committee. */
export interface OracleMember {
  /** Hex‑encoded address of the oracle member. */
  address: string;
  /** Public key associated with the oracle member. */
  key: string;
}

/** A key/value pair where the key is typically an address and the value
 *  describes the token balance and lock state for that address. */
export interface StakedToken {
  key: string;
  value: StakedTokenValue;
}

/** The token balance and locking information for a staker. */
export interface StakedTokenValue {
  /** Total number of free (unlocked) tokens held by the staker. */
  freeTokens: string;
  /** List of tokens locked because of disputes. */
  lockedToDispute: TokenLock[];
  /** List of tokens locked in favour of oracle proposals. */
  lockedToOracle: TokenLock[];
  /** List of pending token locks where the lock becomes active at a
   *  particular timestamp. */
  pendingTokens: PendingToken[];
  /** Amount of tokens reserved (not immediately available). */
  reservedTokens: string;
  /** Optional expiry date for the staked tokens (epoch milliseconds). */
  expirationTimestamp?: string;
}

/** A lock of tokens where a particular amount is tied to a key (often another
 *  contract or dispute identifier). */
export interface TokenLock {
  key: string;
  value: string;
}

/** A pending token lock waiting for a time to become active. */
export interface PendingToken {
  key: string;
  value: PendingTokenValue;
}

/** The value stored in a pending token lock.  Each entry in `timestamps`
 *  associates an epoch timestamp with a token amount. */
export interface PendingTokenValue {
  timestamps: TimestampValue[];
}

/** Key/value pair representing a timestamp (as a string) and associated
 *  token quantity. */
export interface TimestampValue {
  key: string;
  value: string;
}





/**
 * ZK contract
 */

export interface ZkNodeRegistryState {
  /** Type of contract ("SYSTEM"). */
  type: string;
  /** Contract address (hex). */
  address: string;
  /** Hash of the contract jar (hex). */
  jarHash: string;
  /** Number of storage entries. */
  storageLength: number;
  /** The serialized state of the system contract. */
  serializedContract: SerializedZKContract;
  /** ABI encoded as a string. */
  abi: string;
}

export interface SerializedZKContract {
  /** Collaborator contract addresses for orchestration, voting and zk deployment. */
  collaborators: any[];
  /** List of staked tokens and their lock state. */
  stakedTokens: SystemStakedToken[];
  /** Registered ZK nodes. */
  zkNodes: ZkNode[];
}

/** A staked token entry keyed by the staker’s address. */
export interface SystemStakedToken {
  key: string;
  value: SystemStakedTokenValue;
}

/** Balance and lock information for a staker. */
export interface SystemStakedTokenValue {
  /** List of token allocations keyed by an identifier (e.g. node ID). */
  allocatedTokens: TokenAllocation[];
  /** Total number of free tokens owned by the staker. */
  freeTokens: string;
  /** List of pending unlocks specifying the amount and unlock time. */
  pendingUnlock: PendingUnlock[];
  /** Amount of reserved tokens. */
  reservedTokens: string;
  /** Optional expiry timestamp (epoch milliseconds) for the stake. */
  expirationTimestamp?: string;
}

/** Allocation of tokens tied to a specific key. */
export interface TokenAllocation {
  key: string;
  value: string;
}

/** A pending unlock event representing the amount and the time at which it unlocks. */
export interface PendingUnlock {
  amount: string;
  unlockTime: string;
}

/** A ZK node entry keyed by its identity/address. */
export interface ZkNode {
  key: string;
  value: ZkNodeValue;
}

/**
 * Information about a registered zero‑knowledge node.
 */
export interface ZkNodeValue {
  /** Identity/address of the ZK node. */
  identity: string;
  /** Whether the node has been disabled. */
  isDisabled: boolean;
  /** Public key used by the ZK node. */
  publicKey: string;
  /** REST endpoint for the ZK node. */
  restEndpoint: {
    restEndpoint: string;
  };
  /** Scores reflecting the node’s performance (allocated, success, failure). */
  score: {
    allocatedScore: number;
    failureScore: number;
    successScore: number;
  };
  /** Jurisdiction code of the server as a numeric value (e.g. 840 for USA). */
  serverJurisdiction: {
    value: number;
  };
  /** Version of the execution environment supported by the node. */
  supportedEeVersion: number;
  /** Semantic version of the protocol supported by the node. */
  supportedProtocolVersion: {
    major: number;
    minor: number;
    patch: number;
  };
}

/**
 * BLOCK PRODUCER contract
 */

/** The top‑level response describing a block producer contract. */
export interface BpOrchestrationContractState {
  /** Contract type.  For block producer contracts this is "GOVERNANCE". */
  type: string;
  /** The contract address (hex string). */
  address: string;
  /** The Jar hash used by the contract. */
  jarHash: string;
  /** The storage length reported by the contract. */
  storageLength: number;
  /**
   * A nested object containing all contract state.  See
   * {@link BlockProducerContract} for details.
   */
  serializedContract: BlockProducerContract;
  /** The contract ABI in JSON format.  This may be an empty string. */
  abi: string;
  /** Catch‑all for any additional properties returned by the API. */
  [key: string]: unknown;
}

export interface BlockProducerContract {
  /**
   * The list of block producers currently registered in the protocol.  Each
   * entry pairs a unique identity with its associated information【46091563804889†L2-L9】.
   */
  blockProducers: BlockProducerEntry[];
  /**
   * The delay (in milliseconds) between broadcast rounds as a decimal string.
   */
  broadcastRoundDelay: string;
  /**
   * Members of the current committee.  The shape of each entry matches the
   * block producer entries【46091563804889†L710-L748】.
   */
  committee: CommitteeEntry[];
  /**
   * Epoch time (in milliseconds) at which the committee became enabled.
   */
  committeeEnabledTimestamp: string;
  /**
   * Historical record of committees.  Each item records a past committee
   * including its members, a signature and a threshold key【46091563804889†L1548-L1556】.
   */
  committeeLog: CommitteeLogEntry[];
  /** Catch‑all for any additional fields in the serialized contract. */
  [key: string]: unknown;
}

/**
 * Associates a unique identity (key) with the block producer's information.
 */
export interface BlockProducerEntry {
  /** The unique identifier for the block producer. */
  key: string;
  /** The block producer's details. */
  value: BlockProducerInfo;
  /** Catch‑all for unrecognized properties. */
  [key: string]: unknown;
}

/**
 * Detailed information about a block producer or committee member.  Many of
 * these fields may be optional because not every entry includes all
 * properties【46091563804889†L10-L16】.
 */
export interface BlockProducerInfo {
  /** Physical or postal address; may be an empty string. */
  address?: string;
  /** The BLS public key used for consensus. */
  blsPublicKey: string;
  /** The jurisdiction code for the entity. */
  entityJurisdiction?: number;
  /** Identity string (same as the entry's key). */
  identity: string;
  /** The human‑friendly name of the entity; may be empty. */
  name: string;
  /**
   * Version of the node software.  This is optional because some entries do not
   * include a node version【46091563804889†L10-L16】.
   */
  nodeVersion?: NodeVersion;
  /** The number of votes allocated to this entity (string representation). */
  numberOfVotes: string;
  /** The consensus public key used for block production. */
  publicKey: string;
  /** The jurisdiction code for the server; optional because some entries omit it. */
  serverJurisdiction?: number;
  /** The status of the block producer (e.g. "CONFIRMED", "INACTIVE"). */
  status: string;
  /** Website URL for the entity; may be an empty string or absent. */
  website?: string;
  /** Catch‑all for any additional fields. */
  [key: string]: unknown;
}

/**
 * Version information for a node.  All numeric values are mandatory when
 * present in the JSON; the entire object is optional on the parent.
 */
export interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
  /** Catch‑all to allow forward compatibility. */
  [key: string]: unknown;
}

/**
 * Associates a unique identifier with a committee member.  Committee members
 * share the same structure as block producers, so this type reuses
 * {@link BlockProducerInfo} for the `value` property.
 */
export interface CommitteeEntry {
  key: string;
  value: BlockProducerInfo;
  [key: string]: unknown;
}

/**
 * Represents an entry in the committee log.  Each log entry records a past
 * committee configuration along with a signature and threshold key used for
 * verifying the committee's validity【46091563804889†L1548-L1556】.
 */
export interface CommitteeLogEntry {
  /** Sequential index of the log entry. */
  key: number;
  /** The details of the historic committee. */
  value: CommitteeLog;
  [key: string]: unknown;
}

/**
 * The payload of a committee log entry.  It includes the list of committee
 * members and cryptographic fields used for verification.
 */
export interface CommitteeLog {
  /** The committee members that were active in this historic round. */
  committeeMembers: BlockProducerInfo[];
  /** The aggregated BLS signature over the committee members. */
  signature: string;
  /** The threshold key (public key) used for signature verification. */
  thresholdKey: string;
  /** Catch‑all for any additional fields in the log entry. */
  [key: string]: unknown;
}
