// This file is auto-generated from an abi-file using AbiCodegen.
/* eslint-disable */
// @ts-nocheck
// noinspection ES6UnusedImports
import {
  AbiBitInput,
  AbiBitOutput,
  AbiByteInput,
  AbiByteOutput,
  AbiInput,
  AbiOutput,
  AvlTreeMap,
  BlockchainAddress,
  BlockchainPublicKey,
  BlockchainStateClient,
  BlsPublicKey,
  BlsSignature,
  BN,
  Hash,
  Signature,
  StateWithClient,
  SecretInputBuilder,
} from "@partisiablockchain/abi-client";

type Option<K> = K | undefined;
export class large_oracle {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeLargeOracleContractState(_input: AbiInput): LargeOracleContractState {
    let activeDisputes: Option<Map<Option<OracleDisputeId>, Option<Dispute>>> = undefined;
    const activeDisputes_isSome = _input.readBoolean();
    if (activeDisputes_isSome) {
      const activeDisputes_option_mapLength = _input.readI32();
      const activeDisputes_option: Map<Option<OracleDisputeId>, Option<Dispute>> = new Map();
      for (let activeDisputes_option_i = 0; activeDisputes_option_i < activeDisputes_option_mapLength; activeDisputes_option_i++) {
        let activeDisputes_option_key: Option<OracleDisputeId> = undefined;
        const activeDisputes_option_key_isSome = _input.readBoolean();
        if (activeDisputes_option_key_isSome) {
          const activeDisputes_option_key_option: OracleDisputeId = this.deserializeOracleDisputeId(_input);
          activeDisputes_option_key = activeDisputes_option_key_option;
        }
        let activeDisputes_option_value: Option<Dispute> = undefined;
        const activeDisputes_option_value_isSome = _input.readBoolean();
        if (activeDisputes_option_value_isSome) {
          const activeDisputes_option_value_option: Dispute = this.deserializeDispute(_input);
          activeDisputes_option_value = activeDisputes_option_value_option;
        }
        activeDisputes_option.set(activeDisputes_option_key, activeDisputes_option_value);
      }
      activeDisputes = activeDisputes_option;
    }
    let bpOrchestrationContract: Option<BlockchainAddress> = undefined;
    const bpOrchestrationContract_isSome = _input.readBoolean();
    if (bpOrchestrationContract_isSome) {
      const bpOrchestrationContract_option: BlockchainAddress = _input.readAddress();
      bpOrchestrationContract = bpOrchestrationContract_option;
    }
    let byocTwinsToMpcTrade: Option<Map<Option<string>, Option<ByocTwinToMpcTradeDeal>>> = undefined;
    const byocTwinsToMpcTrade_isSome = _input.readBoolean();
    if (byocTwinsToMpcTrade_isSome) {
      const byocTwinsToMpcTrade_option_mapLength = _input.readI32();
      const byocTwinsToMpcTrade_option: Map<Option<string>, Option<ByocTwinToMpcTradeDeal>> = new Map();
      for (let byocTwinsToMpcTrade_option_i = 0; byocTwinsToMpcTrade_option_i < byocTwinsToMpcTrade_option_mapLength; byocTwinsToMpcTrade_option_i++) {
        let byocTwinsToMpcTrade_option_key: Option<string> = undefined;
        const byocTwinsToMpcTrade_option_key_isSome = _input.readBoolean();
        if (byocTwinsToMpcTrade_option_key_isSome) {
          const byocTwinsToMpcTrade_option_key_option: string = _input.readString();
          byocTwinsToMpcTrade_option_key = byocTwinsToMpcTrade_option_key_option;
        }
        let byocTwinsToMpcTrade_option_value: Option<ByocTwinToMpcTradeDeal> = undefined;
        const byocTwinsToMpcTrade_option_value_isSome = _input.readBoolean();
        if (byocTwinsToMpcTrade_option_value_isSome) {
          const byocTwinsToMpcTrade_option_value_option: ByocTwinToMpcTradeDeal = this.deserializeByocTwinToMpcTradeDeal(_input);
          byocTwinsToMpcTrade_option_value = byocTwinsToMpcTrade_option_value_option;
        }
        byocTwinsToMpcTrade_option.set(byocTwinsToMpcTrade_option_key, byocTwinsToMpcTrade_option_value);
      }
      byocTwinsToMpcTrade = byocTwinsToMpcTrade_option;
    }
    const currentMessageNonce: number = _input.readI32();
    let governanceUpdates: Option<BlockchainAddress> = undefined;
    const governanceUpdates_isSome = _input.readBoolean();
    if (governanceUpdates_isSome) {
      const governanceUpdates_option: BlockchainAddress = _input.readAddress();
      governanceUpdates = governanceUpdates_option;
    }
    const initialMessageNonce: number = _input.readI32();
    let mpcToUsdExchangeRate: Option<Fraction> = undefined;
    const mpcToUsdExchangeRate_isSome = _input.readBoolean();
    if (mpcToUsdExchangeRate_isSome) {
      const mpcToUsdExchangeRate_option: Fraction = this.deserializeFraction(_input);
      mpcToUsdExchangeRate = mpcToUsdExchangeRate_option;
    }
    let oracleKey: Option<BlockchainPublicKey> = undefined;
    const oracleKey_isSome = _input.readBoolean();
    if (oracleKey_isSome) {
      const oracleKey_option: BlockchainPublicKey = _input.readPublicKey();
      oracleKey = oracleKey_option;
    }
    let oracleMembers: Option<Array<Option<OracleMember>>> = undefined;
    const oracleMembers_isSome = _input.readBoolean();
    if (oracleMembers_isSome) {
      const oracleMembers_option_vecLength = _input.readI32();
      const oracleMembers_option: Array<Option<OracleMember>> = [];
      for (let oracleMembers_option_i = 0; oracleMembers_option_i < oracleMembers_option_vecLength; oracleMembers_option_i++) {
        let oracleMembers_option_elem: Option<OracleMember> = undefined;
        const oracleMembers_option_elem_isSome = _input.readBoolean();
        if (oracleMembers_option_elem_isSome) {
          const oracleMembers_option_elem_option: OracleMember = this.deserializeOracleMember(_input);
          oracleMembers_option_elem = oracleMembers_option_elem_option;
        }
        oracleMembers_option.push(oracleMembers_option_elem);
      }
      oracleMembers = oracleMembers_option;
    }
    let pendingMessages: Option<Array<Option<SigningRequest>>> = undefined;
    const pendingMessages_isSome = _input.readBoolean();
    if (pendingMessages_isSome) {
      const pendingMessages_option_vecLength = _input.readI32();
      const pendingMessages_option: Array<Option<SigningRequest>> = [];
      for (let pendingMessages_option_i = 0; pendingMessages_option_i < pendingMessages_option_vecLength; pendingMessages_option_i++) {
        let pendingMessages_option_elem: Option<SigningRequest> = undefined;
        const pendingMessages_option_elem_isSome = _input.readBoolean();
        if (pendingMessages_option_elem_isSome) {
          const pendingMessages_option_elem_option: SigningRequest = this.deserializeSigningRequest(_input);
          pendingMessages_option_elem = pendingMessages_option_elem_option;
        }
        pendingMessages_option.push(pendingMessages_option_elem);
      }
      pendingMessages = pendingMessages_option;
    }
    let signedMessages: Option<Map<Option<SigningRequest>, Option<Signature>>> = undefined;
    const signedMessages_isSome = _input.readBoolean();
    if (signedMessages_isSome) {
      const signedMessages_option_mapLength = _input.readI32();
      const signedMessages_option: Map<Option<SigningRequest>, Option<Signature>> = new Map();
      for (let signedMessages_option_i = 0; signedMessages_option_i < signedMessages_option_mapLength; signedMessages_option_i++) {
        let signedMessages_option_key: Option<SigningRequest> = undefined;
        const signedMessages_option_key_isSome = _input.readBoolean();
        if (signedMessages_option_key_isSome) {
          const signedMessages_option_key_option: SigningRequest = this.deserializeSigningRequest(_input);
          signedMessages_option_key = signedMessages_option_key_option;
        }
        let signedMessages_option_value: Option<Signature> = undefined;
        const signedMessages_option_value_isSome = _input.readBoolean();
        if (signedMessages_option_value_isSome) {
          const signedMessages_option_value_option: Signature = _input.readSignature();
          signedMessages_option_value = signedMessages_option_value_option;
        }
        signedMessages_option.set(signedMessages_option_key, signedMessages_option_value);
      }
      signedMessages = signedMessages_option;
    }
    let stakedTokens: Option<Map<Option<BlockchainAddress>, Option<StakedTokens>>> = undefined;
    const stakedTokens_isSome = _input.readBoolean();
    if (stakedTokens_isSome) {
      const stakedTokens_option_mapLength = _input.readI32();
      const stakedTokens_option: Map<Option<BlockchainAddress>, Option<StakedTokens>> = new Map();
      for (let stakedTokens_option_i = 0; stakedTokens_option_i < stakedTokens_option_mapLength; stakedTokens_option_i++) {
        let stakedTokens_option_key: Option<BlockchainAddress> = undefined;
        const stakedTokens_option_key_isSome = _input.readBoolean();
        if (stakedTokens_option_key_isSome) {
          const stakedTokens_option_key_option: BlockchainAddress = _input.readAddress();
          stakedTokens_option_key = stakedTokens_option_key_option;
        }
        let stakedTokens_option_value: Option<StakedTokens> = undefined;
        const stakedTokens_option_value_isSome = _input.readBoolean();
        if (stakedTokens_option_value_isSome) {
          const stakedTokens_option_value_option: StakedTokens = this.deserializeStakedTokens(_input);
          stakedTokens_option_value = stakedTokens_option_value_option;
        }
        stakedTokens_option.set(stakedTokens_option_key, stakedTokens_option_value);
      }
      stakedTokens = stakedTokens_option;
    }
    let updateRequests: Option<Array<Option<OracleUpdateRequest>>> = undefined;
    const updateRequests_isSome = _input.readBoolean();
    if (updateRequests_isSome) {
      const updateRequests_option_vecLength = _input.readI32();
      const updateRequests_option: Array<Option<OracleUpdateRequest>> = [];
      for (let updateRequests_option_i = 0; updateRequests_option_i < updateRequests_option_vecLength; updateRequests_option_i++) {
        let updateRequests_option_elem: Option<OracleUpdateRequest> = undefined;
        const updateRequests_option_elem_isSome = _input.readBoolean();
        if (updateRequests_option_elem_isSome) {
          const updateRequests_option_elem_option: OracleUpdateRequest = this.deserializeOracleUpdateRequest(_input);
          updateRequests_option_elem = updateRequests_option_elem_option;
        }
        updateRequests_option.push(updateRequests_option_elem);
      }
      updateRequests = updateRequests_option;
    }
    return { activeDisputes, bpOrchestrationContract, byocTwinsToMpcTrade, currentMessageNonce, governanceUpdates, initialMessageNonce, mpcToUsdExchangeRate, oracleKey, oracleMembers, pendingMessages, signedMessages, stakedTokens, updateRequests };
  }
  public deserializeOracleDisputeId(_input: AbiInput): OracleDisputeId {
    const disputeId: BN = _input.readI64();
    const oracleId: BN = _input.readI64();
    let smallOracle: Option<BlockchainAddress> = undefined;
    const smallOracle_isSome = _input.readBoolean();
    if (smallOracle_isSome) {
      const smallOracle_option: BlockchainAddress = _input.readAddress();
      smallOracle = smallOracle_option;
    }
    return { disputeId, oracleId, smallOracle };
  }
  public deserializeDispute(_input: AbiInput): Dispute {
    let challenger: Option<BlockchainAddress> = undefined;
    const challenger_isSome = _input.readBoolean();
    if (challenger_isSome) {
      const challenger_option: BlockchainAddress = _input.readAddress();
      challenger = challenger_option;
    }
    const contractCounterClaimInvocation: number = _input.readI32();
    const contractResultInvocation: number = _input.readI32();
    let counterClaimChallengers: Option<Array<Option<BlockchainAddress>>> = undefined;
    const counterClaimChallengers_isSome = _input.readBoolean();
    if (counterClaimChallengers_isSome) {
      const counterClaimChallengers_option_vecLength = _input.readI32();
      const counterClaimChallengers_option: Array<Option<BlockchainAddress>> = [];
      for (let counterClaimChallengers_option_i = 0; counterClaimChallengers_option_i < counterClaimChallengers_option_vecLength; counterClaimChallengers_option_i++) {
        let counterClaimChallengers_option_elem: Option<BlockchainAddress> = undefined;
        const counterClaimChallengers_option_elem_isSome = _input.readBoolean();
        if (counterClaimChallengers_option_elem_isSome) {
          const counterClaimChallengers_option_elem_option: BlockchainAddress = _input.readAddress();
          counterClaimChallengers_option_elem = counterClaimChallengers_option_elem_option;
        }
        counterClaimChallengers_option.push(counterClaimChallengers_option_elem);
      }
      counterClaimChallengers = counterClaimChallengers_option;
    }
    let votes: Option<Array<Option<number>>> = undefined;
    const votes_isSome = _input.readBoolean();
    if (votes_isSome) {
      const votes_option_vecLength = _input.readI32();
      const votes_option: Array<Option<number>> = [];
      for (let votes_option_i = 0; votes_option_i < votes_option_vecLength; votes_option_i++) {
        let votes_option_elem: Option<number> = undefined;
        const votes_option_elem_isSome = _input.readBoolean();
        if (votes_option_elem_isSome) {
          const votes_option_elem_option: number = _input.readI32();
          votes_option_elem = votes_option_elem_option;
        }
        votes_option.push(votes_option_elem);
      }
      votes = votes_option;
    }
    return { challenger, contractCounterClaimInvocation, contractResultInvocation, counterClaimChallengers, votes };
  }
  public deserializeByocTwinToMpcTradeDeal(_input: AbiInput): ByocTwinToMpcTradeDeal {
    let byocTwins: Option<BN> = undefined;
    const byocTwins_isSome = _input.readBoolean();
    if (byocTwins_isSome) {
      const byocTwins_option: BN = _input.readUnsignedBigInteger(32);
      byocTwins = byocTwins_option;
    }
    const mpcTokens: BN = _input.readI64();
    return { byocTwins, mpcTokens };
  }
  public deserializeFraction(_input: AbiInput): Fraction {
    const denominator: BN = _input.readI64();
    const numerator: BN = _input.readI64();
    return { denominator, numerator };
  }
  public deserializeOracleMember(_input: AbiInput): OracleMember {
    let address: Option<BlockchainAddress> = undefined;
    const address_isSome = _input.readBoolean();
    if (address_isSome) {
      const address_option: BlockchainAddress = _input.readAddress();
      address = address_option;
    }
    let key: Option<BlockchainPublicKey> = undefined;
    const key_isSome = _input.readBoolean();
    if (key_isSome) {
      const key_option: BlockchainPublicKey = _input.readPublicKey();
      key = key_option;
    }
    return { address, key };
  }
  public deserializeSigningRequest(_input: AbiInput): SigningRequest {
    let messageHash: Option<Hash> = undefined;
    const messageHash_isSome = _input.readBoolean();
    if (messageHash_isSome) {
      const messageHash_option: Hash = _input.readHash();
      messageHash = messageHash_option;
    }
    let nonce: Option<number> = undefined;
    const nonce_isSome = _input.readBoolean();
    if (nonce_isSome) {
      const nonce_option: number = _input.readI32();
      nonce = nonce_option;
    }
    let transactionHash: Option<Hash> = undefined;
    const transactionHash_isSome = _input.readBoolean();
    if (transactionHash_isSome) {
      const transactionHash_option: Hash = _input.readHash();
      transactionHash = transactionHash_option;
    }
    return { messageHash, nonce, transactionHash };
  }
  public deserializeStakedTokens(_input: AbiInput): StakedTokens {
    let expirationTimestamp: Option<BN> = undefined;
    const expirationTimestamp_isSome = _input.readBoolean();
    if (expirationTimestamp_isSome) {
      const expirationTimestamp_option: BN = _input.readI64();
      expirationTimestamp = expirationTimestamp_option;
    }
    const freeTokens: BN = _input.readI64();
    let lockedToDispute: Option<Map<Option<OracleDisputeId>, Option<BN>>> = undefined;
    const lockedToDispute_isSome = _input.readBoolean();
    if (lockedToDispute_isSome) {
      const lockedToDispute_option_mapLength = _input.readI32();
      const lockedToDispute_option: Map<Option<OracleDisputeId>, Option<BN>> = new Map();
      for (let lockedToDispute_option_i = 0; lockedToDispute_option_i < lockedToDispute_option_mapLength; lockedToDispute_option_i++) {
        let lockedToDispute_option_key: Option<OracleDisputeId> = undefined;
        const lockedToDispute_option_key_isSome = _input.readBoolean();
        if (lockedToDispute_option_key_isSome) {
          const lockedToDispute_option_key_option: OracleDisputeId = this.deserializeOracleDisputeId(_input);
          lockedToDispute_option_key = lockedToDispute_option_key_option;
        }
        let lockedToDispute_option_value: Option<BN> = undefined;
        const lockedToDispute_option_value_isSome = _input.readBoolean();
        if (lockedToDispute_option_value_isSome) {
          const lockedToDispute_option_value_option: BN = _input.readI64();
          lockedToDispute_option_value = lockedToDispute_option_value_option;
        }
        lockedToDispute_option.set(lockedToDispute_option_key, lockedToDispute_option_value);
      }
      lockedToDispute = lockedToDispute_option;
    }
    let lockedToOracle: Option<Map<Option<BlockchainAddress>, Option<BN>>> = undefined;
    const lockedToOracle_isSome = _input.readBoolean();
    if (lockedToOracle_isSome) {
      const lockedToOracle_option_mapLength = _input.readI32();
      const lockedToOracle_option: Map<Option<BlockchainAddress>, Option<BN>> = new Map();
      for (let lockedToOracle_option_i = 0; lockedToOracle_option_i < lockedToOracle_option_mapLength; lockedToOracle_option_i++) {
        let lockedToOracle_option_key: Option<BlockchainAddress> = undefined;
        const lockedToOracle_option_key_isSome = _input.readBoolean();
        if (lockedToOracle_option_key_isSome) {
          const lockedToOracle_option_key_option: BlockchainAddress = _input.readAddress();
          lockedToOracle_option_key = lockedToOracle_option_key_option;
        }
        let lockedToOracle_option_value: Option<BN> = undefined;
        const lockedToOracle_option_value_isSome = _input.readBoolean();
        if (lockedToOracle_option_value_isSome) {
          const lockedToOracle_option_value_option: BN = _input.readI64();
          lockedToOracle_option_value = lockedToOracle_option_value_option;
        }
        lockedToOracle_option.set(lockedToOracle_option_key, lockedToOracle_option_value);
      }
      lockedToOracle = lockedToOracle_option;
    }
    let pendingTokens: Option<Map<Option<BlockchainAddress>, Option<PendingTokensTimestamps>>> = undefined;
    const pendingTokens_isSome = _input.readBoolean();
    if (pendingTokens_isSome) {
      const pendingTokens_option_mapLength = _input.readI32();
      const pendingTokens_option: Map<Option<BlockchainAddress>, Option<PendingTokensTimestamps>> = new Map();
      for (let pendingTokens_option_i = 0; pendingTokens_option_i < pendingTokens_option_mapLength; pendingTokens_option_i++) {
        let pendingTokens_option_key: Option<BlockchainAddress> = undefined;
        const pendingTokens_option_key_isSome = _input.readBoolean();
        if (pendingTokens_option_key_isSome) {
          const pendingTokens_option_key_option: BlockchainAddress = _input.readAddress();
          pendingTokens_option_key = pendingTokens_option_key_option;
        }
        let pendingTokens_option_value: Option<PendingTokensTimestamps> = undefined;
        const pendingTokens_option_value_isSome = _input.readBoolean();
        if (pendingTokens_option_value_isSome) {
          const pendingTokens_option_value_option: PendingTokensTimestamps = this.deserializePendingTokensTimestamps(_input);
          pendingTokens_option_value = pendingTokens_option_value_option;
        }
        pendingTokens_option.set(pendingTokens_option_key, pendingTokens_option_value);
      }
      pendingTokens = pendingTokens_option;
    }
    const reservedTokens: BN = _input.readI64();
    return { expirationTimestamp, freeTokens, lockedToDispute, lockedToOracle, pendingTokens, reservedTokens };
  }
  public deserializePendingTokensTimestamps(_input: AbiInput): PendingTokensTimestamps {
    let timestamps: Option<Map<Option<BN>, Option<BN>>> = undefined;
    const timestamps_isSome = _input.readBoolean();
    if (timestamps_isSome) {
      const timestamps_option_mapLength = _input.readI32();
      const timestamps_option: Map<Option<BN>, Option<BN>> = new Map();
      for (let timestamps_option_i = 0; timestamps_option_i < timestamps_option_mapLength; timestamps_option_i++) {
        let timestamps_option_key: Option<BN> = undefined;
        const timestamps_option_key_isSome = _input.readBoolean();
        if (timestamps_option_key_isSome) {
          const timestamps_option_key_option: BN = _input.readI64();
          timestamps_option_key = timestamps_option_key_option;
        }
        let timestamps_option_value: Option<BN> = undefined;
        const timestamps_option_value_isSome = _input.readBoolean();
        if (timestamps_option_value_isSome) {
          const timestamps_option_value_option: BN = _input.readI64();
          timestamps_option_value = timestamps_option_value_option;
        }
        timestamps_option.set(timestamps_option_key, timestamps_option_value);
      }
      timestamps = timestamps_option;
    }
    return { timestamps };
  }
  public deserializeOracleUpdateRequest(_input: AbiInput): OracleUpdateRequest {
    let additionalData: Option<Buffer> = undefined;
    const additionalData_isSome = _input.readBoolean();
    if (additionalData_isSome) {
      const additionalData_option_vecLength = _input.readI32();
      const additionalData_option: Buffer = _input.readBytes(additionalData_option_vecLength);
      additionalData = additionalData_option;
    }
    const callback: number = _input.readI32();
    let contractAddress: Option<BlockchainAddress> = undefined;
    const contractAddress_isSome = _input.readBoolean();
    if (contractAddress_isSome) {
      const contractAddress_option: BlockchainAddress = _input.readAddress();
      contractAddress = contractAddress_option;
    }
    const requiredStake: BN = _input.readI64();
    return { additionalData, callback, contractAddress, requiredStake };
  }
  public async getState(): Promise<LargeOracleContractState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeLargeOracleContractState(input);
  }

}
export interface LargeOracleContractState {
  activeDisputes: Option<Map<Option<OracleDisputeId>, Option<Dispute>>>;
  bpOrchestrationContract: Option<BlockchainAddress>;
  byocTwinsToMpcTrade: Option<Map<Option<string>, Option<ByocTwinToMpcTradeDeal>>>;
  currentMessageNonce: number;
  governanceUpdates: Option<BlockchainAddress>;
  initialMessageNonce: number;
  mpcToUsdExchangeRate: Option<Fraction>;
  oracleKey: Option<BlockchainPublicKey>;
  oracleMembers: Option<Array<Option<OracleMember>>>;
  pendingMessages: Option<Array<Option<SigningRequest>>>;
  signedMessages: Option<Map<Option<SigningRequest>, Option<Signature>>>;
  stakedTokens: Option<Map<Option<BlockchainAddress>, Option<StakedTokens>>>;
  updateRequests: Option<Array<Option<OracleUpdateRequest>>>;
}

export interface OracleDisputeId {
  disputeId: BN;
  oracleId: BN;
  smallOracle: Option<BlockchainAddress>;
}

export interface Dispute {
  challenger: Option<BlockchainAddress>;
  contractCounterClaimInvocation: number;
  contractResultInvocation: number;
  counterClaimChallengers: Option<Array<Option<BlockchainAddress>>>;
  votes: Option<Array<Option<number>>>;
}

export interface ByocTwinToMpcTradeDeal {
  byocTwins: Option<BN>;
  mpcTokens: BN;
}

export interface Fraction {
  denominator: BN;
  numerator: BN;
}

export interface OracleMember {
  address: Option<BlockchainAddress>;
  key: Option<BlockchainPublicKey>;
}

export interface SigningRequest {
  messageHash: Option<Hash>;
  nonce: Option<number>;
  transactionHash: Option<Hash>;
}

export interface StakedTokens {
  expirationTimestamp: Option<BN>;
  freeTokens: BN;
  lockedToDispute: Option<Map<Option<OracleDisputeId>, Option<BN>>>;
  lockedToOracle: Option<Map<Option<BlockchainAddress>, Option<BN>>>;
  pendingTokens: Option<Map<Option<BlockchainAddress>, Option<PendingTokensTimestamps>>>;
  reservedTokens: BN;
}

export interface PendingTokensTimestamps {
  timestamps: Option<Map<Option<BN>, Option<BN>>>;
}

export interface OracleUpdateRequest {
  additionalData: Option<Buffer>;
  callback: number;
  contractAddress: Option<BlockchainAddress>;
  requiredStake: BN;
}

export function create(blockchainPublicKeys: BlockchainPublicKey[], blockchainAddresses: BlockchainAddress[], oracleKey: BlockchainPublicKey, bpOrchestrationContract: BlockchainAddress, governanceUpdates: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeI32(blockchainPublicKeys.length);
    for (const blockchainPublicKeys_vec of blockchainPublicKeys) {
      _out.writePublicKey(blockchainPublicKeys_vec);
    }
    _out.writeI32(blockchainAddresses.length);
    for (const blockchainAddresses_vec of blockchainAddresses) {
      _out.writeAddress(blockchainAddresses_vec);
    }
    _out.writePublicKey(oracleKey);
    _out.writeAddress(bpOrchestrationContract);
    _out.writeAddress(governanceUpdates);
  });
}

export function createDisputePoll(disputeChallenger: BlockchainAddress, disputeTokenCost: BN, oracleId: BN, disputeId: BN, smallOraclesResultInvocation: number, smallOraclesCounterClaimInvocation: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("00", "hex"));
    _out.writeAddress(disputeChallenger);
    _out.writeI64(disputeTokenCost);
    _out.writeI64(oracleId);
    _out.writeI64(disputeId);
    _out.writeU8(smallOraclesResultInvocation);
    _out.writeU8(smallOraclesCounterClaimInvocation);
  });
}

export function addDisputeCounterClaim(smallOracle: BlockchainAddress, oracleId: BN, disputeId: BN, passThrough: Buffer): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
    _out.writeAddress(smallOracle);
    _out.writeI64(oracleId);
    _out.writeI64(disputeId);
    _out.writeI32(passThrough.length);
    _out.writeBytes(passThrough);
  });
}

export function voteOnDispute(smallOracle: BlockchainAddress, oracleId: BN, disputeId: BN, vote: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("02", "hex"));
    _out.writeAddress(smallOracle);
    _out.writeI64(oracleId);
    _out.writeI64(disputeId);
    _out.writeI32(vote);
  });
}

export function burnStakedTokens(oracles: BlockchainAddress[], amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("03", "hex"));
    _out.writeI32(oracles.length);
    for (const oracles_vec of oracles) {
      _out.writeAddress(oracles_vec);
    }
    _out.writeI64(amount);
  });
}

export function replaceLargeOracle(newKeys: BlockchainPublicKey[], newAddresses: BlockchainAddress[], newPublicKey: BlockchainPublicKey): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("04", "hex"));
    _out.writeI32(newKeys.length);
    for (const newKeys_vec of newKeys) {
      _out.writePublicKey(newKeys_vec);
    }
    _out.writeI32(newAddresses.length);
    for (const newAddresses_vec of newAddresses) {
      _out.writeAddress(newAddresses_vec);
    }
    _out.writePublicKey(newPublicKey);
  });
}

export function requestNewSmallOracle(requiredStake: BN, callback: number, additionalData: Buffer): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("05", "hex"));
    _out.writeI64(requiredStake);
    _out.writeU8(callback);
    _out.writeI32(additionalData.length);
    _out.writeBytes(additionalData);
  });
}

export function addSignature(message: Hash, nonce: number, signature: Signature): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("06", "hex"));
    _out.writeHash(message);
    _out.writeI32(nonce);
    _out.writeSignature(signature);
  });
}

export function changeExchangeRate(numerator: number, denominator: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("07", "hex"));
    _out.writeI32(numerator);
    _out.writeI32(denominator);
  });
}

export function recalibrateByocTwins(symbol: string, byocTwinAmount: BN, oracles: BlockchainAddress[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("08", "hex"));
    _out.writeString(symbol);
    _out.writeUnsignedBigInteger(byocTwinAmount, 32);
    _out.writeI32(oracles.length);
    for (const oracles_vec of oracles) {
      _out.writeAddress(oracles_vec);
    }
  });
}

export function sellByocTwins(symbol: string, byocTwinAmountToSell: BN, expectedMpcTokensToBuy: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("09", "hex"));
    _out.writeString(symbol);
    _out.writeUnsignedBigInteger(byocTwinAmountToSell, 32);
    _out.writeI64(expectedMpcTokensToBuy);
  });
}

export function associateTokensToContract(amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0a", "hex"));
    _out.writeI64(amount);
  });
}

export function disassociateTokensFromContract(amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0b", "hex"));
    _out.writeI64(amount);
  });
}

export function lockTokensToPriceOracle(tokensToLock: BN, priceOracleNodeAddress: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0c", "hex"));
    _out.writeI64(tokensToLock);
    _out.writeAddress(priceOracleNodeAddress);
  });
}

export function unlockTokensFromPriceOracle(tokensToUnlock: BN, priceOracleNodeAddress: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0d", "hex"));
    _out.writeI64(tokensToUnlock);
    _out.writeAddress(priceOracleNodeAddress);
  });
}

export function createDisputePollWithErrorThrow(disputeChallenger: BlockchainAddress, disputeTokenCost: BN, oracleId: BN, disputeId: BN, smallOraclesResultInvocation: number, smallOraclesCounterClaimInvocation: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0e", "hex"));
    _out.writeAddress(disputeChallenger);
    _out.writeI64(disputeTokenCost);
    _out.writeI64(oracleId);
    _out.writeI64(disputeId);
    _out.writeU8(smallOraclesResultInvocation);
    _out.writeU8(smallOraclesCounterClaimInvocation);
  });
}

export function unlockOldPendingTokens(oracleContract: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0f", "hex"));
    _out.writeAddress(oracleContract);
  });
}

export function setReservedTokens(newReserved: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("10", "hex"));
    _out.writeI64(newReserved);
  });
}

export function requestSignature(message: Hash): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("11", "hex"));
    _out.writeHash(message);
  });
}

export function checkSignatureCount(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("12", "hex"));
  });
}

export function checkOracleMemberStatus(oracleMembers: BlockchainAddress[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("13", "hex"));
    _out.writeI32(oracleMembers.length);
    for (const oracleMembers_vec of oracleMembers) {
      _out.writeAddress(oracleMembers_vec);
    }
  });
}

export function associateTokensToContractWithExpiration(amount: BN, expirationTimestamp: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("14", "hex"));
    _out.writeI64(amount);
    _out.writeI64(expirationTimestamp);
  });
}

export function disassociateAllExpiredStakesFromContract(account: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("15", "hex"));
    _out.writeAddress(account);
  });
}

export function setExpirationForAssociation(expirationTimestamp: Option<BN>): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("16", "hex"));
    _out.writeBoolean(expirationTimestamp !== undefined);
    if (expirationTimestamp !== undefined) {
      _out.writeI64(expirationTimestamp);
    }
  });
}

export function deserializeState(state: StateWithClient): LargeOracleContractState;
export function deserializeState(bytes: Buffer): LargeOracleContractState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): LargeOracleContractState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): LargeOracleContractState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new large_oracle(client, address).deserializeLargeOracleContractState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new large_oracle(
      state.client,
      state.address
    ).deserializeLargeOracleContractState(input);
  }
}

