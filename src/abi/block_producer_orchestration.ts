// This file is auto-generated from an abi-file using AbiCodegen.
/* eslint-disable */
// @ts-nocheck
// noinspection ES6UnusedImports
import {
  AbiByteInput,
  AbiByteOutput,
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
} from "@partisiablockchain/abi-client";

type Option<K> = K | undefined;
export class block_producer_orchestration {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeBpOrchestrationContractState(_input: AbiByteInput): BpOrchestrationContractState {
    let blockProducers: Option<Map<Option<BlockchainAddress>, Option<BlockProducer>>> = undefined;
    const blockProducers_isSome = _input.readBoolean();
    if (blockProducers_isSome) {
      const blockProducers_option_mapLength = _input.readI32();
      const blockProducers_option: Map<Option<BlockchainAddress>, Option<BlockProducer>> = new Map();
      for (let blockProducers_option_i = 0; blockProducers_option_i < blockProducers_option_mapLength; blockProducers_option_i++) {
        let blockProducers_option_key: Option<BlockchainAddress> = undefined;
        const blockProducers_option_key_isSome = _input.readBoolean();
        if (blockProducers_option_key_isSome) {
          const blockProducers_option_key_option: BlockchainAddress = _input.readAddress();
          blockProducers_option_key = blockProducers_option_key_option;
        }
        let blockProducers_option_value: Option<BlockProducer> = undefined;
        const blockProducers_option_value_isSome = _input.readBoolean();
        if (blockProducers_option_value_isSome) {
          const blockProducers_option_value_option: BlockProducer = this.deserializeBlockProducer(_input);
          blockProducers_option_value = blockProducers_option_value_option;
        }
        blockProducers_option.set(blockProducers_option_key, blockProducers_option_value);
      }
      blockProducers = blockProducers_option;
    }
    const broadcastRoundDelay: BN = _input.readI64();
    let committee: Option<Array<Option<BlockProducer>>> = undefined;
    const committee_isSome = _input.readBoolean();
    if (committee_isSome) {
      const committee_option_vecLength = _input.readI32();
      const committee_option: Array<Option<BlockProducer>> = [];
      for (let committee_option_i = 0; committee_option_i < committee_option_vecLength; committee_option_i++) {
        let committee_option_elem: Option<BlockProducer> = undefined;
        const committee_option_elem_isSome = _input.readBoolean();
        if (committee_option_elem_isSome) {
          const committee_option_elem_option: BlockProducer = this.deserializeBlockProducer(_input);
          committee_option_elem = committee_option_elem_option;
        }
        committee_option.push(committee_option_elem);
      }
      committee = committee_option;
    }
    const committeeEnabledTimestamp: BN = _input.readI64();
    let committeeLog: Option<Map<Option<number>, Option<CommitteeSignature>>> = undefined;
    const committeeLog_isSome = _input.readBoolean();
    if (committeeLog_isSome) {
      const committeeLog_option_mapLength = _input.readI32();
      const committeeLog_option: Map<Option<number>, Option<CommitteeSignature>> = new Map();
      for (let committeeLog_option_i = 0; committeeLog_option_i < committeeLog_option_mapLength; committeeLog_option_i++) {
        let committeeLog_option_key: Option<number> = undefined;
        const committeeLog_option_key_isSome = _input.readBoolean();
        if (committeeLog_option_key_isSome) {
          const committeeLog_option_key_option: number = _input.readI32();
          committeeLog_option_key = committeeLog_option_key_option;
        }
        let committeeLog_option_value: Option<CommitteeSignature> = undefined;
        const committeeLog_option_value_isSome = _input.readBoolean();
        if (committeeLog_option_value_isSome) {
          const committeeLog_option_value_option: CommitteeSignature = this.deserializeCommitteeSignature(_input);
          committeeLog_option_value = committeeLog_option_value_option;
        }
        committeeLog_option.set(committeeLog_option_key, committeeLog_option_value);
      }
      committeeLog = committeeLog_option;
    }
    let confirmedBlockProducersSinceLastCommittee: Option<Array<Option<BlockchainAddress>>> = undefined;
    const confirmedBlockProducersSinceLastCommittee_isSome = _input.readBoolean();
    if (confirmedBlockProducersSinceLastCommittee_isSome) {
      const confirmedBlockProducersSinceLastCommittee_option_vecLength = _input.readI32();
      const confirmedBlockProducersSinceLastCommittee_option: Array<Option<BlockchainAddress>> = [];
      for (let confirmedBlockProducersSinceLastCommittee_option_i = 0; confirmedBlockProducersSinceLastCommittee_option_i < confirmedBlockProducersSinceLastCommittee_option_vecLength; confirmedBlockProducersSinceLastCommittee_option_i++) {
        let confirmedBlockProducersSinceLastCommittee_option_elem: Option<BlockchainAddress> = undefined;
        const confirmedBlockProducersSinceLastCommittee_option_elem_isSome = _input.readBoolean();
        if (confirmedBlockProducersSinceLastCommittee_option_elem_isSome) {
          const confirmedBlockProducersSinceLastCommittee_option_elem_option: BlockchainAddress = _input.readAddress();
          confirmedBlockProducersSinceLastCommittee_option_elem = confirmedBlockProducersSinceLastCommittee_option_elem_option;
        }
        confirmedBlockProducersSinceLastCommittee_option.push(confirmedBlockProducersSinceLastCommittee_option_elem);
      }
      confirmedBlockProducersSinceLastCommittee = confirmedBlockProducersSinceLastCommittee_option;
    }
    let domainSeparator: Option<Hash> = undefined;
    const domainSeparator_isSome = _input.readBoolean();
    if (domainSeparator_isSome) {
      const domainSeparator_option: Hash = _input.readHash();
      domainSeparator = domainSeparator_option;
    }
    let kycAddresses: Option<Array<Option<BlockchainAddress>>> = undefined;
    const kycAddresses_isSome = _input.readBoolean();
    if (kycAddresses_isSome) {
      const kycAddresses_option_vecLength = _input.readI32();
      const kycAddresses_option: Array<Option<BlockchainAddress>> = [];
      for (let kycAddresses_option_i = 0; kycAddresses_option_i < kycAddresses_option_vecLength; kycAddresses_option_i++) {
        let kycAddresses_option_elem: Option<BlockchainAddress> = undefined;
        const kycAddresses_option_elem_isSome = _input.readBoolean();
        if (kycAddresses_option_elem_isSome) {
          const kycAddresses_option_elem_option: BlockchainAddress = _input.readAddress();
          kycAddresses_option_elem = kycAddresses_option_elem_option;
        }
        kycAddresses_option.push(kycAddresses_option_elem);
      }
      kycAddresses = kycAddresses_option;
    }
    let largeOracleContract: Option<BlockchainAddress> = undefined;
    const largeOracleContract_isSome = _input.readBoolean();
    if (largeOracleContract_isSome) {
      const largeOracleContract_option: BlockchainAddress = _input.readAddress();
      largeOracleContract = largeOracleContract_option;
    }
    let minimumNodeVersion: Option<SemanticVersion$State> = undefined;
    const minimumNodeVersion_isSome = _input.readBoolean();
    if (minimumNodeVersion_isSome) {
      const minimumNodeVersion_option: SemanticVersion$State = this.deserializeSemanticVersion$State(_input);
      minimumNodeVersion = minimumNodeVersion_option;
    }
    let oracleUpdate: Option<LargeOracleUpdate> = undefined;
    const oracleUpdate_isSome = _input.readBoolean();
    if (oracleUpdate_isSome) {
      const oracleUpdate_option: LargeOracleUpdate = this.deserializeLargeOracleUpdate(_input);
      oracleUpdate = oracleUpdate_option;
    }
    const retryNonce: number = _input.readI32();
    let rewardsContractAddress: Option<BlockchainAddress> = undefined;
    const rewardsContractAddress_isSome = _input.readBoolean();
    if (rewardsContractAddress_isSome) {
      const rewardsContractAddress_option: BlockchainAddress = _input.readAddress();
      rewardsContractAddress = rewardsContractAddress_option;
    }
    const sessionId: number = _input.readI32();
    let systemUpdateContractAddress: Option<BlockchainAddress> = undefined;
    const systemUpdateContractAddress_isSome = _input.readBoolean();
    if (systemUpdateContractAddress_isSome) {
      const systemUpdateContractAddress_option: BlockchainAddress = _input.readAddress();
      systemUpdateContractAddress = systemUpdateContractAddress_option;
    }
    let thresholdKey: Option<ThresholdKey> = undefined;
    const thresholdKey_isSome = _input.readBoolean();
    if (thresholdKey_isSome) {
      const thresholdKey_option: ThresholdKey = this.deserializeThresholdKey(_input);
      thresholdKey = thresholdKey_option;
    }
    return { blockProducers, broadcastRoundDelay, committee, committeeEnabledTimestamp, committeeLog, confirmedBlockProducersSinceLastCommittee, domainSeparator, kycAddresses, largeOracleContract, minimumNodeVersion, oracleUpdate, retryNonce, rewardsContractAddress, sessionId, systemUpdateContractAddress, thresholdKey };
  }
  public deserializeBlockProducer(_input: AbiByteInput): BlockProducer {
    let address: Option<string> = undefined;
    const address_isSome = _input.readBoolean();
    if (address_isSome) {
      const address_option: string = _input.readString();
      address = address_option;
    }
    let blsPublicKey: Option<BlsPublicKey> = undefined;
    const blsPublicKey_isSome = _input.readBoolean();
    if (blsPublicKey_isSome) {
      const blsPublicKey_option: BlsPublicKey = _input.readBlsPublicKey();
      blsPublicKey = blsPublicKey_option;
    }
    const entityJurisdiction: number = _input.readI32();
    let identity: Option<BlockchainAddress> = undefined;
    const identity_isSome = _input.readBoolean();
    if (identity_isSome) {
      const identity_option: BlockchainAddress = _input.readAddress();
      identity = identity_option;
    }
    let name: Option<string> = undefined;
    const name_isSome = _input.readBoolean();
    if (name_isSome) {
      const name_option: string = _input.readString();
      name = name_option;
    }
    let nodeVersion: Option<SemanticVersion$State> = undefined;
    const nodeVersion_isSome = _input.readBoolean();
    if (nodeVersion_isSome) {
      const nodeVersion_option: SemanticVersion$State = this.deserializeSemanticVersion$State(_input);
      nodeVersion = nodeVersion_option;
    }
    const numberOfVotes: BN = _input.readI64();
    let publicKey: Option<BlockchainPublicKey> = undefined;
    const publicKey_isSome = _input.readBoolean();
    if (publicKey_isSome) {
      const publicKey_option: BlockchainPublicKey = _input.readPublicKey();
      publicKey = publicKey_option;
    }
    const serverJurisdiction: number = _input.readI32();
    let status: Option<BlockProducerStatus> = undefined;
    const status_isSome = _input.readBoolean();
    if (status_isSome) {
      const status_option: BlockProducerStatus = this.deserializeBlockProducerStatus(_input);
      status = status_option;
    }
    let website: Option<string> = undefined;
    const website_isSome = _input.readBoolean();
    if (website_isSome) {
      const website_option: string = _input.readString();
      website = website_option;
    }
    return { address, blsPublicKey, entityJurisdiction, identity, name, nodeVersion, numberOfVotes, publicKey, serverJurisdiction, status, website };
  }
  public deserializeSemanticVersion$State(_input: AbiByteInput): SemanticVersion$State {
    const major: number = _input.readI32();
    const minor: number = _input.readI32();
    const patch: number = _input.readI32();
    return { major, minor, patch };
  }
  public deserializeBlockProducerStatus(_input: AbiByteInput): BlockProducerStatus {
    const discriminant = _input.readU8();
    if (discriminant === 0) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK(_input);
    } else if (discriminant === 1) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$PENDING(_input);
    } else if (discriminant === 2) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$CONFIRMED(_input);
    } else if (discriminant === 3) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$PENDING_UPDATE(_input);
    } else if (discriminant === 4) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$REMOVED(_input);
    } else if (discriminant === 5) {
      return this.deserializeBlockProducerStatusBlockProducerStatus$INACTIVE(_input);
    }
    throw new Error("Unknown discriminant: " + discriminant);
  }
  public deserializeBlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$WAITING_FOR_CALLBACK,  };
  }
  public deserializeBlockProducerStatusBlockProducerStatus$PENDING(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$PENDING {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$PENDING,  };
  }
  public deserializeBlockProducerStatusBlockProducerStatus$CONFIRMED(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$CONFIRMED {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$CONFIRMED,  };
  }
  public deserializeBlockProducerStatusBlockProducerStatus$PENDING_UPDATE(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$PENDING_UPDATE {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$PENDING_UPDATE,  };
  }
  public deserializeBlockProducerStatusBlockProducerStatus$REMOVED(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$REMOVED {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$REMOVED,  };
  }
  public deserializeBlockProducerStatusBlockProducerStatus$INACTIVE(_input: AbiByteInput): BlockProducerStatusBlockProducerStatus$INACTIVE {
    return { discriminant: BlockProducerStatusD.BlockProducerStatus$INACTIVE,  };
  }
  public deserializeCommitteeSignature(_input: AbiByteInput): CommitteeSignature {
    let committeeMembers: Option<Array<Option<BlockProducer>>> = undefined;
    const committeeMembers_isSome = _input.readBoolean();
    if (committeeMembers_isSome) {
      const committeeMembers_option_vecLength = _input.readI32();
      const committeeMembers_option: Array<Option<BlockProducer>> = [];
      for (let committeeMembers_option_i = 0; committeeMembers_option_i < committeeMembers_option_vecLength; committeeMembers_option_i++) {
        let committeeMembers_option_elem: Option<BlockProducer> = undefined;
        const committeeMembers_option_elem_isSome = _input.readBoolean();
        if (committeeMembers_option_elem_isSome) {
          const committeeMembers_option_elem_option: BlockProducer = this.deserializeBlockProducer(_input);
          committeeMembers_option_elem = committeeMembers_option_elem_option;
        }
        committeeMembers_option.push(committeeMembers_option_elem);
      }
      committeeMembers = committeeMembers_option;
    }
    let signature: Option<Signature> = undefined;
    const signature_isSome = _input.readBoolean();
    if (signature_isSome) {
      const signature_option: Signature = _input.readSignature();
      signature = signature_option;
    }
    let thresholdKey: Option<BlockchainPublicKey> = undefined;
    const thresholdKey_isSome = _input.readBoolean();
    if (thresholdKey_isSome) {
      const thresholdKey_option: BlockchainPublicKey = _input.readPublicKey();
      thresholdKey = thresholdKey_option;
    }
    return { committeeMembers, signature, thresholdKey };
  }
  public deserializeLargeOracleUpdate(_input: AbiByteInput): LargeOracleUpdate {
    let activeProducers: Option<Bitmap> = undefined;
    const activeProducers_isSome = _input.readBoolean();
    if (activeProducers_isSome) {
      const activeProducers_option: Bitmap = this.deserializeBitmap(_input);
      activeProducers = activeProducers_option;
    }
    let broadcastMessages: Option<Array<Option<BroadcastTracker>>> = undefined;
    const broadcastMessages_isSome = _input.readBoolean();
    if (broadcastMessages_isSome) {
      const broadcastMessages_option_vecLength = _input.readI32();
      const broadcastMessages_option: Array<Option<BroadcastTracker>> = [];
      for (let broadcastMessages_option_i = 0; broadcastMessages_option_i < broadcastMessages_option_vecLength; broadcastMessages_option_i++) {
        let broadcastMessages_option_elem: Option<BroadcastTracker> = undefined;
        const broadcastMessages_option_elem_isSome = _input.readBoolean();
        if (broadcastMessages_option_elem_isSome) {
          const broadcastMessages_option_elem_option: BroadcastTracker = this.deserializeBroadcastTracker(_input);
          broadcastMessages_option_elem = broadcastMessages_option_elem_option;
        }
        broadcastMessages_option.push(broadcastMessages_option_elem);
      }
      broadcastMessages = broadcastMessages_option;
    }
    let broadcasters: Option<Bitmap> = undefined;
    const broadcasters_isSome = _input.readBoolean();
    if (broadcasters_isSome) {
      const broadcasters_option: Bitmap = this.deserializeBitmap(_input);
      broadcasters = broadcasters_option;
    }
    let candidates: Option<Array<Option<CandidateKey>>> = undefined;
    const candidates_isSome = _input.readBoolean();
    if (candidates_isSome) {
      const candidates_option_vecLength = _input.readI32();
      const candidates_option: Array<Option<CandidateKey>> = [];
      for (let candidates_option_i = 0; candidates_option_i < candidates_option_vecLength; candidates_option_i++) {
        let candidates_option_elem: Option<CandidateKey> = undefined;
        const candidates_option_elem_isSome = _input.readBoolean();
        if (candidates_option_elem_isSome) {
          const candidates_option_elem_option: CandidateKey = this.deserializeCandidateKey(_input);
          candidates_option_elem = candidates_option_elem_option;
        }
        candidates_option.push(candidates_option_elem);
      }
      candidates = candidates_option;
    }
    let heartbeats: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>> = undefined;
    const heartbeats_isSome = _input.readBoolean();
    if (heartbeats_isSome) {
      const heartbeats_option_mapLength = _input.readI32();
      const heartbeats_option: Map<Option<BlockchainAddress>, Option<Bitmap>> = new Map();
      for (let heartbeats_option_i = 0; heartbeats_option_i < heartbeats_option_mapLength; heartbeats_option_i++) {
        let heartbeats_option_key: Option<BlockchainAddress> = undefined;
        const heartbeats_option_key_isSome = _input.readBoolean();
        if (heartbeats_option_key_isSome) {
          const heartbeats_option_key_option: BlockchainAddress = _input.readAddress();
          heartbeats_option_key = heartbeats_option_key_option;
        }
        let heartbeats_option_value: Option<Bitmap> = undefined;
        const heartbeats_option_value_isSome = _input.readBoolean();
        if (heartbeats_option_value_isSome) {
          const heartbeats_option_value_option: Bitmap = this.deserializeBitmap(_input);
          heartbeats_option_value = heartbeats_option_value_option;
        }
        heartbeats_option.set(heartbeats_option_key, heartbeats_option_value);
      }
      heartbeats = heartbeats_option;
    }
    let honestPartyViews: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>> = undefined;
    const honestPartyViews_isSome = _input.readBoolean();
    if (honestPartyViews_isSome) {
      const honestPartyViews_option_mapLength = _input.readI32();
      const honestPartyViews_option: Map<Option<BlockchainAddress>, Option<Bitmap>> = new Map();
      for (let honestPartyViews_option_i = 0; honestPartyViews_option_i < honestPartyViews_option_mapLength; honestPartyViews_option_i++) {
        let honestPartyViews_option_key: Option<BlockchainAddress> = undefined;
        const honestPartyViews_option_key_isSome = _input.readBoolean();
        if (honestPartyViews_option_key_isSome) {
          const honestPartyViews_option_key_option: BlockchainAddress = _input.readAddress();
          honestPartyViews_option_key = honestPartyViews_option_key_option;
        }
        let honestPartyViews_option_value: Option<Bitmap> = undefined;
        const honestPartyViews_option_value_isSome = _input.readBoolean();
        if (honestPartyViews_option_value_isSome) {
          const honestPartyViews_option_value_option: Bitmap = this.deserializeBitmap(_input);
          honestPartyViews_option_value = honestPartyViews_option_value_option;
        }
        honestPartyViews_option.set(honestPartyViews_option_key, honestPartyViews_option_value);
      }
      honestPartyViews = honestPartyViews_option;
    }
    let producers: Option<Array<Option<BlockProducer>>> = undefined;
    const producers_isSome = _input.readBoolean();
    if (producers_isSome) {
      const producers_option_vecLength = _input.readI32();
      const producers_option: Array<Option<BlockProducer>> = [];
      for (let producers_option_i = 0; producers_option_i < producers_option_vecLength; producers_option_i++) {
        let producers_option_elem: Option<BlockProducer> = undefined;
        const producers_option_elem_isSome = _input.readBoolean();
        if (producers_option_elem_isSome) {
          const producers_option_elem_option: BlockProducer = this.deserializeBlockProducer(_input);
          producers_option_elem = producers_option_elem_option;
        }
        producers_option.push(producers_option_elem);
      }
      producers = producers_option;
    }
    const retryNonce: number = _input.readI32();
    let signatureRandomization: Option<Hash> = undefined;
    const signatureRandomization_isSome = _input.readBoolean();
    if (signatureRandomization_isSome) {
      const signatureRandomization_option: Hash = _input.readHash();
      signatureRandomization = signatureRandomization_option;
    }
    let thresholdKey: Option<ThresholdKey> = undefined;
    const thresholdKey_isSome = _input.readBoolean();
    if (thresholdKey_isSome) {
      const thresholdKey_option: ThresholdKey = this.deserializeThresholdKey(_input);
      thresholdKey = thresholdKey_option;
    }
    let voters: Option<Bitmap> = undefined;
    const voters_isSome = _input.readBoolean();
    if (voters_isSome) {
      const voters_option: Bitmap = this.deserializeBitmap(_input);
      voters = voters_option;
    }
    return { activeProducers, broadcastMessages, broadcasters, candidates, heartbeats, honestPartyViews, producers, retryNonce, signatureRandomization, thresholdKey, voters };
  }
  public deserializeBitmap(_input: AbiByteInput): Bitmap {
    let bits: Option<Buffer> = undefined;
    const bits_isSome = _input.readBoolean();
    if (bits_isSome) {
      const bits_option_vecLength = _input.readI32();
      const bits_option: Buffer = _input.readBytes(bits_option_vecLength);
      bits = bits_option;
    }
    return { bits };
  }
  public deserializeBroadcastTracker(_input: AbiByteInput): BroadcastTracker {
    let bitmaps: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>> = undefined;
    const bitmaps_isSome = _input.readBoolean();
    if (bitmaps_isSome) {
      const bitmaps_option_mapLength = _input.readI32();
      const bitmaps_option: Map<Option<BlockchainAddress>, Option<Bitmap>> = new Map();
      for (let bitmaps_option_i = 0; bitmaps_option_i < bitmaps_option_mapLength; bitmaps_option_i++) {
        let bitmaps_option_key: Option<BlockchainAddress> = undefined;
        const bitmaps_option_key_isSome = _input.readBoolean();
        if (bitmaps_option_key_isSome) {
          const bitmaps_option_key_option: BlockchainAddress = _input.readAddress();
          bitmaps_option_key = bitmaps_option_key_option;
        }
        let bitmaps_option_value: Option<Bitmap> = undefined;
        const bitmaps_option_value_isSome = _input.readBoolean();
        if (bitmaps_option_value_isSome) {
          const bitmaps_option_value_option: Bitmap = this.deserializeBitmap(_input);
          bitmaps_option_value = bitmaps_option_value_option;
        }
        bitmaps_option.set(bitmaps_option_key, bitmaps_option_value);
      }
      bitmaps = bitmaps_option;
    }
    let echos: Option<Bitmap> = undefined;
    const echos_isSome = _input.readBoolean();
    if (echos_isSome) {
      const echos_option: Bitmap = this.deserializeBitmap(_input);
      echos = echos_option;
    }
    let messages: Option<Map<Option<BlockchainAddress>, Option<Hash>>> = undefined;
    const messages_isSome = _input.readBoolean();
    if (messages_isSome) {
      const messages_option_mapLength = _input.readI32();
      const messages_option: Map<Option<BlockchainAddress>, Option<Hash>> = new Map();
      for (let messages_option_i = 0; messages_option_i < messages_option_mapLength; messages_option_i++) {
        let messages_option_key: Option<BlockchainAddress> = undefined;
        const messages_option_key_isSome = _input.readBoolean();
        if (messages_option_key_isSome) {
          const messages_option_key_option: BlockchainAddress = _input.readAddress();
          messages_option_key = messages_option_key_option;
        }
        let messages_option_value: Option<Hash> = undefined;
        const messages_option_value_isSome = _input.readBoolean();
        if (messages_option_value_isSome) {
          const messages_option_value_option: Hash = _input.readHash();
          messages_option_value = messages_option_value_option;
        }
        messages_option.set(messages_option_key, messages_option_value);
      }
      messages = messages_option;
    }
    const startTime: BN = _input.readI64();
    return { bitmaps, echos, messages, startTime };
  }
  public deserializeCandidateKey(_input: AbiByteInput): CandidateKey {
    let thresholdKey: Option<ThresholdKey> = undefined;
    const thresholdKey_isSome = _input.readBoolean();
    if (thresholdKey_isSome) {
      const thresholdKey_option: ThresholdKey = this.deserializeThresholdKey(_input);
      thresholdKey = thresholdKey_option;
    }
    const votes: number = _input.readI32();
    return { thresholdKey, votes };
  }
  public deserializeThresholdKey(_input: AbiByteInput): ThresholdKey {
    let key: Option<BlockchainPublicKey> = undefined;
    const key_isSome = _input.readBoolean();
    if (key_isSome) {
      const key_option: BlockchainPublicKey = _input.readPublicKey();
      key = key_option;
    }
    let keyId: Option<string> = undefined;
    const keyId_isSome = _input.readBoolean();
    if (keyId_isSome) {
      const keyId_option: string = _input.readString();
      keyId = keyId_option;
    }
    return { key, keyId };
  }
  public async getState(): Promise<BpOrchestrationContractState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeBpOrchestrationContractState(input);
  }

}
export interface BpOrchestrationContractState {
  blockProducers: Option<Map<Option<BlockchainAddress>, Option<BlockProducer>>>;
  broadcastRoundDelay: BN;
  committee: Option<Array<Option<BlockProducer>>>;
  committeeEnabledTimestamp: BN;
  committeeLog: Option<Map<Option<number>, Option<CommitteeSignature>>>;
  confirmedBlockProducersSinceLastCommittee: Option<Array<Option<BlockchainAddress>>>;
  domainSeparator: Option<Hash>;
  kycAddresses: Option<Array<Option<BlockchainAddress>>>;
  largeOracleContract: Option<BlockchainAddress>;
  minimumNodeVersion: Option<SemanticVersion$State>;
  oracleUpdate: Option<LargeOracleUpdate>;
  retryNonce: number;
  rewardsContractAddress: Option<BlockchainAddress>;
  sessionId: number;
  systemUpdateContractAddress: Option<BlockchainAddress>;
  thresholdKey: Option<ThresholdKey>;
}

export interface BlockProducer {
  address: Option<string>;
  blsPublicKey: Option<BlsPublicKey>;
  entityJurisdiction: number;
  identity: Option<BlockchainAddress>;
  name: Option<string>;
  nodeVersion: Option<SemanticVersion$State>;
  numberOfVotes: BN;
  publicKey: Option<BlockchainPublicKey>;
  serverJurisdiction: number;
  status: Option<BlockProducerStatus>;
  website: Option<string>;
}

export interface SemanticVersion$State {
  major: number;
  minor: number;
  patch: number;
}

export enum BlockProducerStatusD {
  BlockProducerStatus$WAITING_FOR_CALLBACK = 0,
  BlockProducerStatus$PENDING = 1,
  BlockProducerStatus$CONFIRMED = 2,
  BlockProducerStatus$PENDING_UPDATE = 3,
  BlockProducerStatus$REMOVED = 4,
  BlockProducerStatus$INACTIVE = 5,
}
export type BlockProducerStatus =
  | BlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK
  | BlockProducerStatusBlockProducerStatus$PENDING
  | BlockProducerStatusBlockProducerStatus$CONFIRMED
  | BlockProducerStatusBlockProducerStatus$PENDING_UPDATE
  | BlockProducerStatusBlockProducerStatus$REMOVED
  | BlockProducerStatusBlockProducerStatus$INACTIVE;
function serializeBlockProducerStatus(out: AbiByteOutput, value: BlockProducerStatus): void {
  if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$WAITING_FOR_CALLBACK) {
    return serializeBlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK(out, value);
  } else if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$PENDING) {
    return serializeBlockProducerStatusBlockProducerStatus$PENDING(out, value);
  } else if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$CONFIRMED) {
    return serializeBlockProducerStatusBlockProducerStatus$CONFIRMED(out, value);
  } else if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$PENDING_UPDATE) {
    return serializeBlockProducerStatusBlockProducerStatus$PENDING_UPDATE(out, value);
  } else if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$REMOVED) {
    return serializeBlockProducerStatusBlockProducerStatus$REMOVED(out, value);
  } else if (value.discriminant === BlockProducerStatusD.BlockProducerStatus$INACTIVE) {
    return serializeBlockProducerStatusBlockProducerStatus$INACTIVE(out, value);
  }
}

export interface BlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK {
  discriminant: BlockProducerStatusD.BlockProducerStatus$WAITING_FOR_CALLBACK;
}
function serializeBlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$WAITING_FOR_CALLBACK): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface BlockProducerStatusBlockProducerStatus$PENDING {
  discriminant: BlockProducerStatusD.BlockProducerStatus$PENDING;
}
function serializeBlockProducerStatusBlockProducerStatus$PENDING(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$PENDING): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface BlockProducerStatusBlockProducerStatus$CONFIRMED {
  discriminant: BlockProducerStatusD.BlockProducerStatus$CONFIRMED;
}
function serializeBlockProducerStatusBlockProducerStatus$CONFIRMED(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$CONFIRMED): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface BlockProducerStatusBlockProducerStatus$PENDING_UPDATE {
  discriminant: BlockProducerStatusD.BlockProducerStatus$PENDING_UPDATE;
}
function serializeBlockProducerStatusBlockProducerStatus$PENDING_UPDATE(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$PENDING_UPDATE): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface BlockProducerStatusBlockProducerStatus$REMOVED {
  discriminant: BlockProducerStatusD.BlockProducerStatus$REMOVED;
}
function serializeBlockProducerStatusBlockProducerStatus$REMOVED(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$REMOVED): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface BlockProducerStatusBlockProducerStatus$INACTIVE {
  discriminant: BlockProducerStatusD.BlockProducerStatus$INACTIVE;
}
function serializeBlockProducerStatusBlockProducerStatus$INACTIVE(_out: AbiByteOutput, _value: BlockProducerStatusBlockProducerStatus$INACTIVE): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface CommitteeSignature {
  committeeMembers: Option<Array<Option<BlockProducer>>>;
  signature: Option<Signature>;
  thresholdKey: Option<BlockchainPublicKey>;
}

export interface LargeOracleUpdate {
  activeProducers: Option<Bitmap>;
  broadcastMessages: Option<Array<Option<BroadcastTracker>>>;
  broadcasters: Option<Bitmap>;
  candidates: Option<Array<Option<CandidateKey>>>;
  heartbeats: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>>;
  honestPartyViews: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>>;
  producers: Option<Array<Option<BlockProducer>>>;
  retryNonce: number;
  signatureRandomization: Option<Hash>;
  thresholdKey: Option<ThresholdKey>;
  voters: Option<Bitmap>;
}

export interface Bitmap {
  bits: Option<Buffer>;
}

export interface BroadcastTracker {
  bitmaps: Option<Map<Option<BlockchainAddress>, Option<Bitmap>>>;
  echos: Option<Bitmap>;
  messages: Option<Map<Option<BlockchainAddress>, Option<Hash>>>;
  startTime: BN;
}

export interface CandidateKey {
  thresholdKey: Option<ThresholdKey>;
  votes: number;
}

export interface ThresholdKey {
  key: Option<BlockchainPublicKey>;
  keyId: Option<string>;
}

export interface BlockProducerRpc {
  name: string;
  website: string;
  address: string;
  identity: BlockchainAddress;
  numberOfVotes: BN;
  publicKey: BlockchainPublicKey;
  blsPublicKey: BlsPublicKey;
  entityJurisdiction: number;
  serverJurisdiction: number;
  status: BlockProducerStatus;
}
function serializeBlockProducerRpc(_out: AbiByteOutput, _value: BlockProducerRpc): void {
  const { name, website, address, identity, numberOfVotes, publicKey, blsPublicKey, entityJurisdiction, serverJurisdiction, status } = _value;
  _out.writeString(name);
  _out.writeString(website);
  _out.writeString(address);
  _out.writeAddress(identity);
  _out.writeI64(numberOfVotes);
  _out.writePublicKey(publicKey);
  _out.writeBlsPublicKey(blsPublicKey);
  _out.writeI32(entityJurisdiction);
  _out.writeI32(serverJurisdiction);
  serializeBlockProducerStatus(_out, status);
}

export interface BlockProducerInformationRpc {
  name: string;
  website: string;
  address: string;
  publicKey: BlockchainPublicKey;
  blsPublicKey: BlsPublicKey;
  entityJurisdiction: number;
  serverJurisdiction: number;
}
function serializeBlockProducerInformationRpc(_out: AbiByteOutput, _value: BlockProducerInformationRpc): void {
  const { name, website, address, publicKey, blsPublicKey, entityJurisdiction, serverJurisdiction } = _value;
  _out.writeString(name);
  _out.writeString(website);
  _out.writeString(address);
  _out.writePublicKey(publicKey);
  _out.writeBlsPublicKey(blsPublicKey);
  _out.writeI32(entityJurisdiction);
  _out.writeI32(serverJurisdiction);
}

export interface RoundData {
  sessionId: number;
  retryNonce: number;
  broadcastRound: number;
}
function serializeRoundData(_out: AbiByteOutput, _value: RoundData): void {
  const { sessionId, retryNonce, broadcastRound } = _value;
  _out.writeI32(sessionId);
  _out.writeI32(retryNonce);
  _out.writeI32(broadcastRound);
}

export interface BlockProducerInformation {
  identity: BlockchainAddress;
  name: string;
  website: string;
  address: string;
  publicKey: BlockchainPublicKey;
  blsPublicKey: BlsPublicKey;
  entityJurisdiction: number;
  serverJurisdiction: number;
}
function serializeBlockProducerInformation(_out: AbiByteOutput, _value: BlockProducerInformation): void {
  const { identity, name, website, address, publicKey, blsPublicKey, entityJurisdiction, serverJurisdiction } = _value;
  _out.writeAddress(identity);
  _out.writeString(name);
  _out.writeString(website);
  _out.writeString(address);
  _out.writePublicKey(publicKey);
  _out.writeBlsPublicKey(blsPublicKey);
  _out.writeI32(entityJurisdiction);
  _out.writeI32(serverJurisdiction);
}

export interface SemanticVersion$Rpc {
  major: number;
  minor: number;
  patch: number;
}
function serializeSemanticVersion$Rpc(_out: AbiByteOutput, _value: SemanticVersion$Rpc): void {
  const { major, minor, patch } = _value;
  _out.writeI32(major);
  _out.writeI32(minor);
  _out.writeI32(patch);
}

export function create(kycAddresses: BlockchainAddress[], initialProducers: BlockProducerRpc[], initialThresholdKey: BlockchainPublicKey, initialThresholdKeyId: string, largeOracleContract: BlockchainAddress, systemUpdateContractAddress: BlockchainAddress, rewardsContractAddress: BlockchainAddress, domainSeparator: Hash, broadcastRoundDelay: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeI32(kycAddresses.length);
    for (const kycAddresses_vec of kycAddresses) {
      _out.writeAddress(kycAddresses_vec);
    }
    _out.writeI32(initialProducers.length);
    for (const initialProducers_vec of initialProducers) {
      serializeBlockProducerRpc(_out, initialProducers_vec);
    }
    _out.writePublicKey(initialThresholdKey);
    _out.writeString(initialThresholdKeyId);
    _out.writeAddress(largeOracleContract);
    _out.writeAddress(systemUpdateContractAddress);
    _out.writeAddress(rewardsContractAddress);
    _out.writeHash(domainSeparator);
    _out.writeI64(broadcastRoundDelay);
  });
}

export function register(producer: BlockProducerInformationRpc, signature: BlsSignature): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("00", "hex"));
    serializeBlockProducerInformationRpc(_out, producer);
    _out.writeBlsSignature(signature);
  });
}

export function confirmBp(bpAddress: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
    _out.writeAddress(bpAddress);
  });
}

export function addCandidateKey(candidateKey: BlockchainPublicKey, keyId: string, honestParties: Buffer): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("02", "hex"));
    _out.writePublicKey(candidateKey);
    _out.writeString(keyId);
    _out.writeI32(honestParties.length);
    _out.writeBytes(honestParties);
  });
}

export function authorizeNewOracle(signature: Signature): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("03", "hex"));
    _out.writeSignature(signature);
  });
}

export function addHeartbeat(bitmap: Buffer): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("04", "hex"));
    _out.writeI32(bitmap.length);
    _out.writeBytes(bitmap);
  });
}

export function addBroadcastHash(roundData: RoundData, broadcast: Hash): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("06", "hex"));
    serializeRoundData(_out, roundData);
    _out.writeHash(broadcast);
  });
}

export function pokeOngoingUpdate(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("08", "hex"));
  });
}

export function getProducerInfo(identity: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("09", "hex"));
    _out.writeAddress(identity);
  });
}

export function addConfirmedBp(producer: BlockProducerInformation, popSignature: BlsSignature): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0a", "hex"));
    serializeBlockProducerInformation(_out, producer);
    _out.writeBlsSignature(popSignature);
  });
}

export function removeBp(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0b", "hex"));
  });
}

export function addBroadcastBits(roundData: RoundData, bits: Buffer): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0c", "hex"));
    serializeRoundData(_out, roundData);
    _out.writeI32(bits.length);
    _out.writeBytes(bits);
  });
}

export function triggerNewCommittee(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0d", "hex"));
  });
}

export function markAsActive(popSignature: BlsSignature): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0e", "hex"));
    _out.writeBlsSignature(popSignature);
  });
}

export function updateNodeVersion(newVersion: SemanticVersion$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0f", "hex"));
    serializeSemanticVersion$Rpc(_out, newVersion);
  });
}

export function setMinimumNodeVersion(newVersion: SemanticVersion$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("10", "hex"));
    serializeSemanticVersion$Rpc(_out, newVersion);
  });
}

export function getProducers(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("11", "hex"));
  });
}

export function deserializeState(state: StateWithClient): BpOrchestrationContractState;
export function deserializeState(bytes: Buffer): BpOrchestrationContractState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): BpOrchestrationContractState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): BpOrchestrationContractState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new block_producer_orchestration(client, address).deserializeBpOrchestrationContractState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new block_producer_orchestration(
      state.client,
      state.address
    ).deserializeBpOrchestrationContractState(input);
  }
}

