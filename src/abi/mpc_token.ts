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
export class mpc_token {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeMpcTokenContractState(_input: AbiInput): MpcTokenContractState {
    let icedStakings: Option<Map<Option<Hash>, Option<IceStaking>>> = undefined;
    const icedStakings_isSome = _input.readBoolean();
    if (icedStakings_isSome) {
      const icedStakings_option_mapLength = _input.readI32();
      const icedStakings_option: Map<Option<Hash>, Option<IceStaking>> = new Map();
      for (let icedStakings_option_i = 0; icedStakings_option_i < icedStakings_option_mapLength; icedStakings_option_i++) {
        let icedStakings_option_key: Option<Hash> = undefined;
        const icedStakings_option_key_isSome = _input.readBoolean();
        if (icedStakings_option_key_isSome) {
          const icedStakings_option_key_option: Hash = _input.readHash();
          icedStakings_option_key = icedStakings_option_key_option;
        }
        let icedStakings_option_value: Option<IceStaking> = undefined;
        const icedStakings_option_value_isSome = _input.readBoolean();
        if (icedStakings_option_value_isSome) {
          const icedStakings_option_value_option: IceStaking = this.deserializeIceStaking(_input);
          icedStakings_option_value = icedStakings_option_value_option;
        }
        icedStakings_option.set(icedStakings_option_key, icedStakings_option_value);
      }
      icedStakings = icedStakings_option;
    }
    const locked: boolean = _input.readBoolean();
    let stakeDelegations: Option<Map<Option<Hash>, Option<StakeDelegation>>> = undefined;
    const stakeDelegations_isSome = _input.readBoolean();
    if (stakeDelegations_isSome) {
      const stakeDelegations_option_mapLength = _input.readI32();
      const stakeDelegations_option: Map<Option<Hash>, Option<StakeDelegation>> = new Map();
      for (let stakeDelegations_option_i = 0; stakeDelegations_option_i < stakeDelegations_option_mapLength; stakeDelegations_option_i++) {
        let stakeDelegations_option_key: Option<Hash> = undefined;
        const stakeDelegations_option_key_isSome = _input.readBoolean();
        if (stakeDelegations_option_key_isSome) {
          const stakeDelegations_option_key_option: Hash = _input.readHash();
          stakeDelegations_option_key = stakeDelegations_option_key_option;
        }
        let stakeDelegations_option_value: Option<StakeDelegation> = undefined;
        const stakeDelegations_option_value_isSome = _input.readBoolean();
        if (stakeDelegations_option_value_isSome) {
          const stakeDelegations_option_value_option: StakeDelegation = this.deserializeStakeDelegation(_input);
          stakeDelegations_option_value = stakeDelegations_option_value_option;
        }
        stakeDelegations_option.set(stakeDelegations_option_key, stakeDelegations_option_value);
      }
      stakeDelegations = stakeDelegations_option;
    }
    let transfers: Option<Map<Option<Hash>, Option<TransferInformation>>> = undefined;
    const transfers_isSome = _input.readBoolean();
    if (transfers_isSome) {
      const transfers_option_mapLength = _input.readI32();
      const transfers_option: Map<Option<Hash>, Option<TransferInformation>> = new Map();
      for (let transfers_option_i = 0; transfers_option_i < transfers_option_mapLength; transfers_option_i++) {
        let transfers_option_key: Option<Hash> = undefined;
        const transfers_option_key_isSome = _input.readBoolean();
        if (transfers_option_key_isSome) {
          const transfers_option_key_option: Hash = _input.readHash();
          transfers_option_key = transfers_option_key_option;
        }
        let transfers_option_value: Option<TransferInformation> = undefined;
        const transfers_option_value_isSome = _input.readBoolean();
        if (transfers_option_value_isSome) {
          const transfers_option_value_option: TransferInformation = this.deserializeTransferInformation(_input);
          transfers_option_value = transfers_option_value_option;
        }
        transfers_option.set(transfers_option_key, transfers_option_value);
      }
      transfers = transfers_option;
    }
    return { icedStakings, locked, stakeDelegations, transfers };
  }
  public deserializeIceStaking(_input: AbiInput): IceStaking {
    const amount: BN = _input.readI64();
    let contract: Option<BlockchainAddress> = undefined;
    const contract_isSome = _input.readBoolean();
    if (contract_isSome) {
      const contract_option: BlockchainAddress = _input.readAddress();
      contract = contract_option;
    }
    let initiator: Option<BlockchainAddress> = undefined;
    const initiator_isSome = _input.readBoolean();
    if (initiator_isSome) {
      const initiator_option: BlockchainAddress = _input.readAddress();
      initiator = initiator_option;
    }
    let sender: Option<BlockchainAddress> = undefined;
    const sender_isSome = _input.readBoolean();
    if (sender_isSome) {
      const sender_option: BlockchainAddress = _input.readAddress();
      sender = sender_option;
    }
    return { amount, contract, initiator, sender };
  }
  public deserializeStakeDelegation(_input: AbiInput): StakeDelegation {
    const amount: BN = _input.readI64();
    let delegationType: Option<DelegationType> = undefined;
    const delegationType_isSome = _input.readBoolean();
    if (delegationType_isSome) {
      const delegationType_option: DelegationType = this.deserializeDelegationType(_input);
      delegationType = delegationType_option;
    }
    let expirationTimestamp: Option<BN> = undefined;
    const expirationTimestamp_isSome = _input.readBoolean();
    if (expirationTimestamp_isSome) {
      const expirationTimestamp_option: BN = _input.readI64();
      expirationTimestamp = expirationTimestamp_option;
    }
    let initiator: Option<BlockchainAddress> = undefined;
    const initiator_isSome = _input.readBoolean();
    if (initiator_isSome) {
      const initiator_option: BlockchainAddress = _input.readAddress();
      initiator = initiator_option;
    }
    let recipient: Option<BlockchainAddress> = undefined;
    const recipient_isSome = _input.readBoolean();
    if (recipient_isSome) {
      const recipient_option: BlockchainAddress = _input.readAddress();
      recipient = recipient_option;
    }
    let sender: Option<BlockchainAddress> = undefined;
    const sender_isSome = _input.readBoolean();
    if (sender_isSome) {
      const sender_option: BlockchainAddress = _input.readAddress();
      sender = sender_option;
    }
    return { amount, delegationType, expirationTimestamp, initiator, recipient, sender };
  }
  public deserializeDelegationType(_input: AbiInput): DelegationType {
    const discriminant = _input.readU8();
    if (discriminant === 0) {
      return this.deserializeDelegationTypeDelegationType$DELEGATE_STAKES(_input);
    } else if (discriminant === 1) {
      return this.deserializeDelegationTypeDelegationType$RETRACT_DELEGATED_STAKES(_input);
    }
    throw new Error("Unknown discriminant: " + discriminant);
  }
  public deserializeDelegationTypeDelegationType$DELEGATE_STAKES(_input: AbiInput): DelegationTypeDelegationType$DELEGATE_STAKES {
    return { discriminant: DelegationTypeD.DelegationType$DELEGATE_STAKES,  };
  }
  public deserializeDelegationTypeDelegationType$RETRACT_DELEGATED_STAKES(_input: AbiInput): DelegationTypeDelegationType$RETRACT_DELEGATED_STAKES {
    return { discriminant: DelegationTypeD.DelegationType$RETRACT_DELEGATED_STAKES,  };
  }
  public deserializeTransferInformation(_input: AbiInput): TransferInformation {
    let amount: Option<BN> = undefined;
    const amount_isSome = _input.readBoolean();
    if (amount_isSome) {
      const amount_option: BN = _input.readUnsignedBigInteger(32);
      amount = amount_option;
    }
    let initiator: Option<BlockchainAddress> = undefined;
    const initiator_isSome = _input.readBoolean();
    if (initiator_isSome) {
      const initiator_option: BlockchainAddress = _input.readAddress();
      initiator = initiator_option;
    }
    let recipient: Option<BlockchainAddress> = undefined;
    const recipient_isSome = _input.readBoolean();
    if (recipient_isSome) {
      const recipient_option: BlockchainAddress = _input.readAddress();
      recipient = recipient_option;
    }
    let sender: Option<BlockchainAddress> = undefined;
    const sender_isSome = _input.readBoolean();
    if (sender_isSome) {
      const sender_option: BlockchainAddress = _input.readAddress();
      sender = sender_option;
    }
    let symbol: Option<string> = undefined;
    const symbol_isSome = _input.readBoolean();
    if (symbol_isSome) {
      const symbol_option: string = _input.readString();
      symbol = symbol_option;
    }
    return { amount, initiator, recipient, sender, symbol };
  }
  public async getState(): Promise<MpcTokenContractState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeMpcTokenContractState(input);
  }

}
export interface MpcTokenContractState {
  icedStakings: Option<Map<Option<Hash>, Option<IceStaking>>>;
  locked: boolean;
  stakeDelegations: Option<Map<Option<Hash>, Option<StakeDelegation>>>;
  transfers: Option<Map<Option<Hash>, Option<TransferInformation>>>;
}

export interface IceStaking {
  amount: BN;
  contract: Option<BlockchainAddress>;
  initiator: Option<BlockchainAddress>;
  sender: Option<BlockchainAddress>;
}

export interface StakeDelegation {
  amount: BN;
  delegationType: Option<DelegationType>;
  expirationTimestamp: Option<BN>;
  initiator: Option<BlockchainAddress>;
  recipient: Option<BlockchainAddress>;
  sender: Option<BlockchainAddress>;
}

export enum DelegationTypeD {
  DelegationType$DELEGATE_STAKES = 0,
  DelegationType$RETRACT_DELEGATED_STAKES = 1,
}
export type DelegationType =
  | DelegationTypeDelegationType$DELEGATE_STAKES
  | DelegationTypeDelegationType$RETRACT_DELEGATED_STAKES;

export interface DelegationTypeDelegationType$DELEGATE_STAKES {
  discriminant: DelegationTypeD.DelegationType$DELEGATE_STAKES;
}

export interface DelegationTypeDelegationType$RETRACT_DELEGATED_STAKES {
  discriminant: DelegationTypeD.DelegationType$RETRACT_DELEGATED_STAKES;
}

export interface TransferInformation {
  amount: Option<BN>;
  initiator: Option<BlockchainAddress>;
  recipient: Option<BlockchainAddress>;
  sender: Option<BlockchainAddress>;
  symbol: Option<string>;
}

export function create(locked: boolean): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeBoolean(locked);
  });
}

export function stakeTokens(amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("00", "hex"));
    _out.writeI64(amount);
  });
}

export function unstakeTokens(amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
    _out.writeI64(amount);
  });
}

export function disassociateTokensForRemovedContract(contract: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("02", "hex"));
    _out.writeAddress(contract);
  });
}

export function transfer(recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("03", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function abort(transactionId: Hash): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("04", "hex"));
    _out.writeHash(transactionId);
  });
}

export function checkPendingUnstakes(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("05", "hex"));
  });
}

export function checkVestedTokens(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("06", "hex"));
  });
}

export function transferWithSmallMemo(recipient: BlockchainAddress, amount: BN, memo: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("0d", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeI64(memo);
  });
}

export function transferWithLargeMemo(recipient: BlockchainAddress, amount: BN, memo: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("17", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeString(memo);
  });
}

export function delegateStakes(recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("18", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function retractDelegatedStakes(recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("19", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function abortStakeDelegationEvent(transactionId: Hash): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1a", "hex"));
    _out.writeHash(transactionId);
  });
}

export function acceptDelegatedStakes(sender: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1b", "hex"));
    _out.writeAddress(sender);
    _out.writeI64(amount);
  });
}

export function reduceDelegatedStakes(delegator: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1c", "hex"));
    _out.writeAddress(delegator);
    _out.writeI64(amount);
  });
}

export function transferByocOld(recipient: BlockchainAddress, amount: BN, symbol: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1d", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeString(symbol);
  });
}

export function transferByoc(recipient: BlockchainAddress, amount: BN, symbol: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1e", "hex"));
    _out.writeAddress(recipient);
    _out.writeUnsignedBigInteger(amount, 32);
    _out.writeString(symbol);
  });
}

export function associateIce(contract: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("1f", "hex"));
    _out.writeAddress(contract);
    _out.writeI64(amount);
  });
}

export function disassociateIce(contract: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("20", "hex"));
    _out.writeAddress(contract);
    _out.writeI64(amount);
  });
}

export function appointCustodian(target: BlockchainAddress, appointedCustodian: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("21", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(appointedCustodian);
  });
}

export function cancelAppointedCustodian(target: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("22", "hex"));
    _out.writeAddress(target);
  });
}

export function resetCustodian(target: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("23", "hex"));
    _out.writeAddress(target);
  });
}

export function acceptCustodianship(target: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("24", "hex"));
    _out.writeAddress(target);
  });
}

export function abortIceAssociate(transactionId: Hash): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("25", "hex"));
    _out.writeHash(transactionId);
  });
}

export function lockMpcTransfers(locked: boolean): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("26", "hex"));
    _out.writeBoolean(locked);
  });
}

export function transferOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("28", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function checkPendingUnstakesOnBehalfOf(target: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2a", "hex"));
    _out.writeAddress(target);
  });
}

export function checkVestedTokensOnBehalfOf(target: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2b", "hex"));
    _out.writeAddress(target);
  });
}

export function transferWithSmallMemoOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN, memo: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2c", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeI64(memo);
  });
}

export function transferWithLargeMemoOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN, memo: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2d", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeString(memo);
  });
}

export function delegateStakesOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2e", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function retractDelegatedStakesOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("2f", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
  });
}

export function acceptDelegatedStakesOnBehalfOf(target: BlockchainAddress, sender: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("31", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(sender);
    _out.writeI64(amount);
  });
}

export function reduceDelegatedStakesOnBehalfOf(target: BlockchainAddress, delegator: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("32", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(delegator);
    _out.writeI64(amount);
  });
}

export function transferByocOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN, symbol: string): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("34", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeUnsignedBigInteger(amount, 32);
    _out.writeString(symbol);
  });
}

export function associateIceOnBehalfOf(target: BlockchainAddress, contract: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("35", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(contract);
    _out.writeI64(amount);
  });
}

export function disassociateIceOnBehalfOf(target: BlockchainAddress, contract: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("36", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(contract);
    _out.writeI64(amount);
  });
}

export function stakeTokensOnBehalfOf(target: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("37", "hex"));
    _out.writeAddress(target);
    _out.writeI64(amount);
  });
}

export function unstakeTokensOnBehalfOf(target: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("39", "hex"));
    _out.writeAddress(target);
    _out.writeI64(amount);
  });
}

export function checkVestedTokensForOther(other: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("3a", "hex"));
    _out.writeAddress(other);
  });
}

export function disassociateTokensForRemovedContractForOther(contract: BlockchainAddress, other: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("3b", "hex"));
    _out.writeAddress(contract);
    _out.writeAddress(other);
  });
}

export function setStakingGoal(stakingGoal: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("46", "hex"));
    _out.writeI64(stakingGoal);
  });
}

export function setStakingGoalOnBehalfOf(target: BlockchainAddress, stakingGoal: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("47", "hex"));
    _out.writeAddress(target);
    _out.writeI64(stakingGoal);
  });
}

export function setExpirationTimestampForDelegatedStakes(target: BlockchainAddress, expirationTimestamp: Option<BN>): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("48", "hex"));
    _out.writeAddress(target);
    _out.writeBoolean(expirationTimestamp !== undefined);
    if (expirationTimestamp !== undefined) {
      _out.writeI64(expirationTimestamp);
    }
  });
}

export function setExpirationTimestampForDelegatedStakesOnBehalfOf(delegator: BlockchainAddress, target: BlockchainAddress, expirationTimestamp: Option<BN>): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("49", "hex"));
    _out.writeAddress(delegator);
    _out.writeAddress(target);
    _out.writeBoolean(expirationTimestamp !== undefined);
    if (expirationTimestamp !== undefined) {
      _out.writeI64(expirationTimestamp);
    }
  });
}

export function delegateStakesWithExpiration(recipient: BlockchainAddress, amount: BN, expirationTimestamp: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("4d", "hex"));
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeI64(expirationTimestamp);
  });
}

export function delegateStakesWithExpirationOnBehalfOf(target: BlockchainAddress, recipient: BlockchainAddress, amount: BN, expirationTimestamp: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("4f", "hex"));
    _out.writeAddress(target);
    _out.writeAddress(recipient);
    _out.writeI64(amount);
    _out.writeI64(expirationTimestamp);
  });
}

export function deserializeState(state: StateWithClient): MpcTokenContractState;
export function deserializeState(bytes: Buffer): MpcTokenContractState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): MpcTokenContractState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): MpcTokenContractState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new mpc_token(client, address).deserializeMpcTokenContractState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new mpc_token(
      state.client,
      state.address
    ).deserializeMpcTokenContractState(input);
  }
}

