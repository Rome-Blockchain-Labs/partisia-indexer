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
export class zk_node_registry {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeZkNodeRegistryState(_input: AbiInput): ZkNodeRegistryState {
    let collaborators: Option<Collaborators$State> = undefined;
    const collaborators_isSome = _input.readBoolean();
    if (collaborators_isSome) {
      const collaborators_option: Collaborators$State = this.deserializeCollaborators$State(_input);
      collaborators = collaborators_option;
    }
    let stakedTokens: Option<Map<Option<BlockchainAddress>, Option<ZkNodeTokens>>> = undefined;
    const stakedTokens_isSome = _input.readBoolean();
    if (stakedTokens_isSome) {
      const stakedTokens_option_mapLength = _input.readI32();
      const stakedTokens_option: Map<Option<BlockchainAddress>, Option<ZkNodeTokens>> = new Map();
      for (let stakedTokens_option_i = 0; stakedTokens_option_i < stakedTokens_option_mapLength; stakedTokens_option_i++) {
        let stakedTokens_option_key: Option<BlockchainAddress> = undefined;
        const stakedTokens_option_key_isSome = _input.readBoolean();
        if (stakedTokens_option_key_isSome) {
          const stakedTokens_option_key_option: BlockchainAddress = _input.readAddress();
          stakedTokens_option_key = stakedTokens_option_key_option;
        }
        let stakedTokens_option_value: Option<ZkNodeTokens> = undefined;
        const stakedTokens_option_value_isSome = _input.readBoolean();
        if (stakedTokens_option_value_isSome) {
          const stakedTokens_option_value_option: ZkNodeTokens = this.deserializeZkNodeTokens(_input);
          stakedTokens_option_value = stakedTokens_option_value_option;
        }
        stakedTokens_option.set(stakedTokens_option_key, stakedTokens_option_value);
      }
      stakedTokens = stakedTokens_option;
    }
    let zkNodes: Option<Map<Option<BlockchainAddress>, Option<ZkNode>>> = undefined;
    const zkNodes_isSome = _input.readBoolean();
    if (zkNodes_isSome) {
      const zkNodes_option_mapLength = _input.readI32();
      const zkNodes_option: Map<Option<BlockchainAddress>, Option<ZkNode>> = new Map();
      for (let zkNodes_option_i = 0; zkNodes_option_i < zkNodes_option_mapLength; zkNodes_option_i++) {
        let zkNodes_option_key: Option<BlockchainAddress> = undefined;
        const zkNodes_option_key_isSome = _input.readBoolean();
        if (zkNodes_option_key_isSome) {
          const zkNodes_option_key_option: BlockchainAddress = _input.readAddress();
          zkNodes_option_key = zkNodes_option_key_option;
        }
        let zkNodes_option_value: Option<ZkNode> = undefined;
        const zkNodes_option_value_isSome = _input.readBoolean();
        if (zkNodes_option_value_isSome) {
          const zkNodes_option_value_option: ZkNode = this.deserializeZkNode(_input);
          zkNodes_option_value = zkNodes_option_value_option;
        }
        zkNodes_option.set(zkNodes_option_key, zkNodes_option_value);
      }
      zkNodes = zkNodes_option;
    }
    return { collaborators, stakedTokens, zkNodes };
  }
  public deserializeCollaborators$State(_input: AbiInput): Collaborators$State {
    let bpOrchestration: Option<BlockchainAddress> = undefined;
    const bpOrchestration_isSome = _input.readBoolean();
    if (bpOrchestration_isSome) {
      const bpOrchestration_option: BlockchainAddress = _input.readAddress();
      bpOrchestration = bpOrchestration_option;
    }
    let voting: Option<BlockchainAddress> = undefined;
    const voting_isSome = _input.readBoolean();
    if (voting_isSome) {
      const voting_option: BlockchainAddress = _input.readAddress();
      voting = voting_option;
    }
    let zkContractDeploy: Option<BlockchainAddress> = undefined;
    const zkContractDeploy_isSome = _input.readBoolean();
    if (zkContractDeploy_isSome) {
      const zkContractDeploy_option: BlockchainAddress = _input.readAddress();
      zkContractDeploy = zkContractDeploy_option;
    }
    return { bpOrchestration, voting, zkContractDeploy };
  }
  public deserializeZkNodeTokens(_input: AbiInput): ZkNodeTokens {
    let allocatedTokens: Option<Map<Option<BlockchainAddress>, Option<BN>>> = undefined;
    const allocatedTokens_isSome = _input.readBoolean();
    if (allocatedTokens_isSome) {
      const allocatedTokens_option_mapLength = _input.readI32();
      const allocatedTokens_option: Map<Option<BlockchainAddress>, Option<BN>> = new Map();
      for (let allocatedTokens_option_i = 0; allocatedTokens_option_i < allocatedTokens_option_mapLength; allocatedTokens_option_i++) {
        let allocatedTokens_option_key: Option<BlockchainAddress> = undefined;
        const allocatedTokens_option_key_isSome = _input.readBoolean();
        if (allocatedTokens_option_key_isSome) {
          const allocatedTokens_option_key_option: BlockchainAddress = _input.readAddress();
          allocatedTokens_option_key = allocatedTokens_option_key_option;
        }
        let allocatedTokens_option_value: Option<BN> = undefined;
        const allocatedTokens_option_value_isSome = _input.readBoolean();
        if (allocatedTokens_option_value_isSome) {
          const allocatedTokens_option_value_option: BN = _input.readI64();
          allocatedTokens_option_value = allocatedTokens_option_value_option;
        }
        allocatedTokens_option.set(allocatedTokens_option_key, allocatedTokens_option_value);
      }
      allocatedTokens = allocatedTokens_option;
    }
    let expirationTimestamp: Option<BN> = undefined;
    const expirationTimestamp_isSome = _input.readBoolean();
    if (expirationTimestamp_isSome) {
      const expirationTimestamp_option: BN = _input.readI64();
      expirationTimestamp = expirationTimestamp_option;
    }
    const freeTokens: BN = _input.readI64();
    let pendingUnlock: Option<Array<Option<Pending>>> = undefined;
    const pendingUnlock_isSome = _input.readBoolean();
    if (pendingUnlock_isSome) {
      const pendingUnlock_option_vecLength = _input.readI32();
      const pendingUnlock_option: Array<Option<Pending>> = [];
      for (let pendingUnlock_option_i = 0; pendingUnlock_option_i < pendingUnlock_option_vecLength; pendingUnlock_option_i++) {
        let pendingUnlock_option_elem: Option<Pending> = undefined;
        const pendingUnlock_option_elem_isSome = _input.readBoolean();
        if (pendingUnlock_option_elem_isSome) {
          const pendingUnlock_option_elem_option: Pending = this.deserializePending(_input);
          pendingUnlock_option_elem = pendingUnlock_option_elem_option;
        }
        pendingUnlock_option.push(pendingUnlock_option_elem);
      }
      pendingUnlock = pendingUnlock_option;
    }
    const reservedTokens: BN = _input.readI64();
    return { allocatedTokens, expirationTimestamp, freeTokens, pendingUnlock, reservedTokens };
  }
  public deserializePending(_input: AbiInput): Pending {
    const amount: BN = _input.readI64();
    const unlockTime: BN = _input.readI64();
    return { amount, unlockTime };
  }
  public deserializeZkNode(_input: AbiInput): ZkNode {
    let identity: Option<BlockchainAddress> = undefined;
    const identity_isSome = _input.readBoolean();
    if (identity_isSome) {
      const identity_option: BlockchainAddress = _input.readAddress();
      identity = identity_option;
    }
    const isDisabled: boolean = _input.readBoolean();
    let publicKey: Option<BlockchainPublicKey> = undefined;
    const publicKey_isSome = _input.readBoolean();
    if (publicKey_isSome) {
      const publicKey_option: BlockchainPublicKey = _input.readPublicKey();
      publicKey = publicKey_option;
    }
    let restEndpoint: Option<RestEndpoint$State> = undefined;
    const restEndpoint_isSome = _input.readBoolean();
    if (restEndpoint_isSome) {
      const restEndpoint_option: RestEndpoint$State = this.deserializeRestEndpoint$State(_input);
      restEndpoint = restEndpoint_option;
    }
    let score: Option<ZkNodeScore> = undefined;
    const score_isSome = _input.readBoolean();
    if (score_isSome) {
      const score_option: ZkNodeScore = this.deserializeZkNodeScore(_input);
      score = score_option;
    }
    let serverJurisdiction: Option<Jurisdiction$State> = undefined;
    const serverJurisdiction_isSome = _input.readBoolean();
    if (serverJurisdiction_isSome) {
      const serverJurisdiction_option: Jurisdiction$State = this.deserializeJurisdiction$State(_input);
      serverJurisdiction = serverJurisdiction_option;
    }
    const supportedEeVersion: number = _input.readI32();
    let supportedProtocolVersion: Option<SemanticVersion$State> = undefined;
    const supportedProtocolVersion_isSome = _input.readBoolean();
    if (supportedProtocolVersion_isSome) {
      const supportedProtocolVersion_option: SemanticVersion$State = this.deserializeSemanticVersion$State(_input);
      supportedProtocolVersion = supportedProtocolVersion_option;
    }
    return { identity, isDisabled, publicKey, restEndpoint, score, serverJurisdiction, supportedEeVersion, supportedProtocolVersion };
  }
  public deserializeRestEndpoint$State(_input: AbiInput): RestEndpoint$State {
    let restEndpoint: Option<string> = undefined;
    const restEndpoint_isSome = _input.readBoolean();
    if (restEndpoint_isSome) {
      const restEndpoint_option: string = _input.readString();
      restEndpoint = restEndpoint_option;
    }
    return { restEndpoint };
  }
  public deserializeZkNodeScore(_input: AbiInput): ZkNodeScore {
    const allocatedScore: number = _input.readI32();
    const failureScore: number = _input.readI32();
    const successScore: number = _input.readI32();
    return { allocatedScore, failureScore, successScore };
  }
  public deserializeJurisdiction$State(_input: AbiInput): Jurisdiction$State {
    const value: number = _input.readI32();
    return { value };
  }
  public deserializeSemanticVersion$State(_input: AbiInput): SemanticVersion$State {
    const major: number = _input.readI32();
    const minor: number = _input.readI32();
    const patch: number = _input.readI32();
    return { major, minor, patch };
  }
  public async getState(): Promise<ZkNodeRegistryState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeZkNodeRegistryState(input);
  }

}
export interface ZkNodeRegistryState {
  collaborators: Option<Collaborators$State>;
  stakedTokens: Option<Map<Option<BlockchainAddress>, Option<ZkNodeTokens>>>;
  zkNodes: Option<Map<Option<BlockchainAddress>, Option<ZkNode>>>;
}

export interface Collaborators$State {
  bpOrchestration: Option<BlockchainAddress>;
  voting: Option<BlockchainAddress>;
  zkContractDeploy: Option<BlockchainAddress>;
}

export interface ZkNodeTokens {
  allocatedTokens: Option<Map<Option<BlockchainAddress>, Option<BN>>>;
  expirationTimestamp: Option<BN>;
  freeTokens: BN;
  pendingUnlock: Option<Array<Option<Pending>>>;
  reservedTokens: BN;
}

export interface Pending {
  amount: BN;
  unlockTime: BN;
}

export interface ZkNode {
  identity: Option<BlockchainAddress>;
  isDisabled: boolean;
  publicKey: Option<BlockchainPublicKey>;
  restEndpoint: Option<RestEndpoint$State>;
  score: Option<ZkNodeScore>;
  serverJurisdiction: Option<Jurisdiction$State>;
  supportedEeVersion: number;
  supportedProtocolVersion: Option<SemanticVersion$State>;
}

export interface RestEndpoint$State {
  restEndpoint: Option<string>;
}

export interface ZkNodeScore {
  allocatedScore: number;
  failureScore: number;
  successScore: number;
}

export interface Jurisdiction$State {
  value: number;
}

export interface SemanticVersion$State {
  major: number;
  minor: number;
  patch: number;
}

export interface Collaborators$Rpc {
  bpOrchestration: BlockchainAddress;
  zkContractDeploy: BlockchainAddress;
  voting: BlockchainAddress;
}
function serializeCollaborators$Rpc(_out: AbiOutput, _value: Collaborators$Rpc): void {
  const { bpOrchestration, zkContractDeploy, voting } = _value;
  _out.writeAddress(bpOrchestration);
  _out.writeAddress(zkContractDeploy);
  _out.writeAddress(voting);
}

export interface RestEndpoint$Rpc {
  restEndpoint: string;
}
function serializeRestEndpoint$Rpc(_out: AbiOutput, _value: RestEndpoint$Rpc): void {
  const { restEndpoint } = _value;
  _out.writeString(restEndpoint);
}

export interface NodeJurisdictions {
  nodeJurisdictions: Jurisdictions[];
}
function serializeNodeJurisdictions(_out: AbiOutput, _value: NodeJurisdictions): void {
  const { nodeJurisdictions } = _value;
  _out.writeI32(nodeJurisdictions.length);
  for (const nodeJurisdictions_vec of nodeJurisdictions) {
    serializeJurisdictions(_out, nodeJurisdictions_vec);
  }
}

export interface Jurisdictions {
  list: Jurisdiction$Rpc[];
}
function serializeJurisdictions(_out: AbiOutput, _value: Jurisdictions): void {
  const { list } = _value;
  _out.writeI32(list.length);
  for (const list_vec of list) {
    serializeJurisdiction$Rpc(_out, list_vec);
  }
}

export interface Jurisdiction$Rpc {
  value: number;
}
function serializeJurisdiction$Rpc(_out: AbiOutput, _value: Jurisdiction$Rpc): void {
  const { value } = _value;
  _out.writeI32(value);
}

export interface SemanticVersion$Rpc {
  major: number;
  minor: number;
  patch: number;
}
function serializeSemanticVersion$Rpc(_out: AbiOutput, _value: SemanticVersion$Rpc): void {
  const { major, minor, patch } = _value;
  _out.writeI32(major);
  _out.writeI32(minor);
  _out.writeI32(patch);
}

export interface EngineStatus {
  engine: BlockchainAddress;
  status: ZkNodeScoreStatus;
}
function serializeEngineStatus(_out: AbiOutput, _value: EngineStatus): void {
  const { engine, status } = _value;
  _out.writeAddress(engine);
  serializeZkNodeScoreStatus(_out, status);
}

export enum ZkNodeScoreStatusD {
  ZkNodeScoreStatus$FAILURE = 0,
  ZkNodeScoreStatus$SUCCESS = 1,
}
export type ZkNodeScoreStatus =
  | ZkNodeScoreStatusZkNodeScoreStatus$FAILURE
  | ZkNodeScoreStatusZkNodeScoreStatus$SUCCESS;
function serializeZkNodeScoreStatus(out: AbiOutput, value: ZkNodeScoreStatus): void {
  if (value.discriminant === ZkNodeScoreStatusD.ZkNodeScoreStatus$FAILURE) {
    return serializeZkNodeScoreStatusZkNodeScoreStatus$FAILURE(out, value);
  } else if (value.discriminant === ZkNodeScoreStatusD.ZkNodeScoreStatus$SUCCESS) {
    return serializeZkNodeScoreStatusZkNodeScoreStatus$SUCCESS(out, value);
  }
}

export interface ZkNodeScoreStatusZkNodeScoreStatus$FAILURE {
  discriminant: ZkNodeScoreStatusD.ZkNodeScoreStatus$FAILURE;
}
function serializeZkNodeScoreStatusZkNodeScoreStatus$FAILURE(_out: AbiOutput, _value: ZkNodeScoreStatusZkNodeScoreStatus$FAILURE): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export interface ZkNodeScoreStatusZkNodeScoreStatus$SUCCESS {
  discriminant: ZkNodeScoreStatusD.ZkNodeScoreStatus$SUCCESS;
}
function serializeZkNodeScoreStatusZkNodeScoreStatus$SUCCESS(_out: AbiOutput, _value: ZkNodeScoreStatusZkNodeScoreStatus$SUCCESS): void {
  const {} = _value;
  _out.writeU8(_value.discriminant);
}

export function create(collaborators: Collaborators$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    serializeCollaborators$Rpc(_out, collaborators);
  });
}

export function registerAsZkNode(restEndpoint: RestEndpoint$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("00", "hex"));
    serializeRestEndpoint$Rpc(_out, restEndpoint);
  });
}

export function updateNodeRestEndpoint(restEndpoint: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
    _out.writeString(restEndpoint);
  });
}

export function requestZkComputationNodesV1(zkContract: BlockchainAddress, numberOfNodes: number, totalStakes: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("04", "hex"));
    _out.writeAddress(zkContract);
    _out.writeI32(numberOfNodes);
    _out.writeI64(totalStakes);
  });
}

export function notifyZkComputationDoneV1(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("05", "hex"));
  });
}

export function unlockExpiredStakes(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("06", "hex"));
  });
}

export function checkContractStatus(zkContract: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("07", "hex"));
    _out.writeAddress(zkContract);
  });
}

export function requestZkComputationNodesV2(zkContract: BlockchainAddress, numberOfNodes: number, totalStakes: BN, jurisdictions: NodeJurisdictions, requiredProtocolVersion: SemanticVersion$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("08", "hex"));
    _out.writeAddress(zkContract);
    _out.writeI32(numberOfNodes);
    _out.writeI64(totalStakes);
    serializeNodeJurisdictions(_out, jurisdictions);
    serializeSemanticVersion$Rpc(_out, requiredProtocolVersion);
  });
}

export function associateTokens(tokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0a", "hex"));
    _out.writeI64(tokenAmount);
  });
}

export function disassociateTokens(tokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0b", "hex"));
    _out.writeI64(tokenAmount);
  });
}

export function updateNodeProtocolVersion(supportedProtocolVersion: SemanticVersion$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0c", "hex"));
    serializeSemanticVersion$Rpc(_out, supportedProtocolVersion);
  });
}

export function updateServerJurisdiction(jurisdiction: Jurisdiction$Rpc): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0d", "hex"));
    serializeJurisdiction$Rpc(_out, jurisdiction);
  });
}

export function extendZkComputationDeadline(contractAddress: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0e", "hex"));
    _out.writeAddress(contractAddress);
  });
}

export function disableZkNode(address: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("10", "hex"));
    _out.writeAddress(address);
  });
}

export function resignAsZkNode(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("11", "hex"));
  });
}

export function notifyZkComputationDoneV2(enginesStatus: EngineStatus[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("12", "hex"));
    _out.writeI32(enginesStatus.length);
    for (const enginesStatus_vec of enginesStatus) {
      serializeEngineStatus(_out, enginesStatus_vec);
    }
  });
}

export function setReservedTokens(newReserved: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("13", "hex"));
    _out.writeI64(newReserved);
  });
}

export function requestSpecificNodesWithProtocolVersion(zkContract: BlockchainAddress, totalStakes: BN, requiredProtocolVersion: SemanticVersion$Rpc, zkNodes: BlockchainAddress[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("14", "hex"));
    _out.writeAddress(zkContract);
    _out.writeI64(totalStakes);
    serializeSemanticVersion$Rpc(_out, requiredProtocolVersion);
    _out.writeI32(zkNodes.length);
    for (const zkNodes_vec of zkNodes) {
      _out.writeAddress(zkNodes_vec);
    }
  });
}

export function associateTokensWithExpiration(tokenAmount: BN, expirationTimestamp: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("15", "hex"));
    _out.writeI64(tokenAmount);
    _out.writeI64(expirationTimestamp);
  });
}

export function disassociateAllExpiredStakesFromContract(account: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("16", "hex"));
    _out.writeAddress(account);
  });
}

export function setExpirationForAssociation(expirationTimestamp: Option<BN>): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("17", "hex"));
    _out.writeBoolean(expirationTimestamp !== undefined);
    if (expirationTimestamp !== undefined) {
      _out.writeI64(expirationTimestamp);
    }
  });
}

export function requestSpecificNodesWithEeVersion(totalStakes: BN, requiredEeVersion: number, zkNodes: BlockchainAddress[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("18", "hex"));
    _out.writeI64(totalStakes);
    _out.writeI32(requiredEeVersion);
    _out.writeI32(zkNodes.length);
    for (const zkNodes_vec of zkNodes) {
      _out.writeAddress(zkNodes_vec);
    }
  });
}

export function requestZkComputationNodesWithEeVersion(numberOfNodes: number, totalStakes: BN, jurisdictions: NodeJurisdictions, requiredEeVersion: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("19", "hex"));
    _out.writeI32(numberOfNodes);
    _out.writeI64(totalStakes);
    serializeNodeJurisdictions(_out, jurisdictions);
    _out.writeI32(requiredEeVersion);
  });
}

export function updateNodeEeVersion(supportedEeVersion: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1a", "hex"));
    _out.writeI32(supportedEeVersion);
  });
}

export function reRequestZkComputationNodes(enginesStatus: EngineStatus[], numberOfNodes: number, totalStakes: BN, jurisdictions: NodeJurisdictions, requiredEeVersion: number, specificNodes: BlockchainAddress[]): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1b", "hex"));
    _out.writeI32(enginesStatus.length);
    for (const enginesStatus_vec of enginesStatus) {
      serializeEngineStatus(_out, enginesStatus_vec);
    }
    _out.writeI32(numberOfNodes);
    _out.writeI64(totalStakes);
    serializeNodeJurisdictions(_out, jurisdictions);
    _out.writeI32(requiredEeVersion);
    _out.writeI32(specificNodes.length);
    for (const specificNodes_vec of specificNodes) {
      _out.writeAddress(specificNodes_vec);
    }
  });
}

export function deserializeState(state: StateWithClient): ZkNodeRegistryState;
export function deserializeState(bytes: Buffer): ZkNodeRegistryState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): ZkNodeRegistryState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): ZkNodeRegistryState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new zk_node_registry(client, address).deserializeZkNodeRegistryState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new zk_node_registry(
      state.client,
      state.address
    ).deserializeZkNodeRegistryState(input);
  }
}

