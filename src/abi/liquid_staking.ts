// This file is auto-generated from an abi-file using AbiCodegen.
/* eslint-disable */
// @ts-nocheck
// noinspection ES6UnusedImports

/**
 * Contract Actions (for transaction indexer):
 * #[action(shortname = 0x01)] transfer
 * #[action(shortname = 0x03)] transfer_from
 * #[action(shortname = 0x05)] approve
 * #[action(shortname = 0x10)] submit
 * #[action(shortname = 0x11)] withdraw
 * #[action(shortname = 0x12)] accrue_rewards
 * #[action(shortname = 0x13)] request_unlock
 * #[action(shortname = 0x14)] deposit
 * #[action(shortname = 0x15)] redeem
 * #[action(shortname = 0x16)] change_buy_in
 * #[action(shortname = 0x17)] disable_buy_in
 * #[action(shortname = 0x18)] clean_up_pending_unlocks
 * #[action(shortname = 0x19)] cancel_pending_unlock
 */

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
export class liquid_staking {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeLiquidStakingState(_input: AbiInput): LiquidStakingState {
    const tokenForStaking: BlockchainAddress = _input.readAddress();
    const stakeTokenBalance: BN = _input.readUnsignedBigInteger(16);
    const stakingResponsible: BlockchainAddress = _input.readAddress();
    const administrator: BlockchainAddress = _input.readAddress();
    const totalPoolStakeToken: BN = _input.readUnsignedBigInteger(16);
    const totalPoolLiquid: BN = _input.readUnsignedBigInteger(16);
    const liquidTokenState: LiquidTokenState = this.deserializeLiquidTokenState(_input);
    const pendingUnlocks_treeId = _input.readI32();
    const pendingUnlocks: AvlTreeMap<BlockchainAddress, PendingUnlock[]> = new AvlTreeMap(
      pendingUnlocks_treeId,
      this._client,
      this._address,
      (pendingUnlocks_key) => AbiByteOutput.serializeLittleEndian((pendingUnlocks_out) => {
        pendingUnlocks_out.writeAddress(pendingUnlocks_key);
      }),
      (pendingUnlocks_bytes) => {
        const pendingUnlocks_input = AbiByteInput.createLittleEndian(pendingUnlocks_bytes);
        const pendingUnlocks_key: BlockchainAddress = pendingUnlocks_input.readAddress();
        return pendingUnlocks_key;
      },
      (pendingUnlocks_bytes) => {
        const pendingUnlocks_input = AbiByteInput.createLittleEndian(pendingUnlocks_bytes);
        const pendingUnlocks_value_vecLength = pendingUnlocks_input.readI32();
        const pendingUnlocks_value: PendingUnlock[] = [];
        for (let pendingUnlocks_value_i = 0; pendingUnlocks_value_i < pendingUnlocks_value_vecLength; pendingUnlocks_value_i++) {
          const pendingUnlocks_value_elem: PendingUnlock = this.deserializePendingUnlock(pendingUnlocks_input);
          pendingUnlocks_value.push(pendingUnlocks_value_elem);
        }
        return pendingUnlocks_value;
      }
    );
    const buyInTokens_treeId = _input.readI32();
    const buyInTokens: AvlTreeMap<BlockchainAddress, BN> = new AvlTreeMap(
      buyInTokens_treeId,
      this._client,
      this._address,
      (buyInTokens_key) => AbiByteOutput.serializeLittleEndian((buyInTokens_out) => {
        buyInTokens_out.writeAddress(buyInTokens_key);
      }),
      (buyInTokens_bytes) => {
        const buyInTokens_input = AbiByteInput.createLittleEndian(buyInTokens_bytes);
        const buyInTokens_key: BlockchainAddress = buyInTokens_input.readAddress();
        return buyInTokens_key;
      },
      (buyInTokens_bytes) => {
        const buyInTokens_input = AbiByteInput.createLittleEndian(buyInTokens_bytes);
        const buyInTokens_value: BN = buyInTokens_input.readUnsignedBigInteger(16);
        return buyInTokens_value;
      }
    );
    const lengthOfCooldownPeriod: BN = _input.readU64();
    const lengthOfRedeemPeriod: BN = _input.readU64();
    const amountOfBuyInLockedStakeTokens: BN = _input.readUnsignedBigInteger(16);
    const buyInPercentage: BN = _input.readUnsignedBigInteger(16);
    const buyInEnabled: boolean = _input.readBoolean();
    return { tokenForStaking, stakeTokenBalance, stakingResponsible, administrator, totalPoolStakeToken, totalPoolLiquid, liquidTokenState, pendingUnlocks, buyInTokens, lengthOfCooldownPeriod, lengthOfRedeemPeriod, amountOfBuyInLockedStakeTokens, buyInPercentage, buyInEnabled };
  }
  public deserializeLiquidTokenState(_input: AbiInput): LiquidTokenState {
    const balances_treeId = _input.readI32();
    const balances: AvlTreeMap<BlockchainAddress, BN> = new AvlTreeMap(
      balances_treeId,
      this._client,
      this._address,
      (balances_key) => AbiByteOutput.serializeLittleEndian((balances_out) => {
        balances_out.writeAddress(balances_key);
      }),
      (balances_bytes) => {
        const balances_input = AbiByteInput.createLittleEndian(balances_bytes);
        const balances_key: BlockchainAddress = balances_input.readAddress();
        return balances_key;
      },
      (balances_bytes) => {
        const balances_input = AbiByteInput.createLittleEndian(balances_bytes);
        const balances_value: BN = balances_input.readUnsignedBigInteger(16);
        return balances_value;
      }
    );
    const name: string = _input.readString();
    const symbol: string = _input.readString();
    const decimals: number = _input.readU8();
    const allowed_treeId = _input.readI32();
    const allowed: AvlTreeMap<AllowedAddress, BN> = new AvlTreeMap(
      allowed_treeId,
      this._client,
      this._address,
      (allowed_key) => AbiByteOutput.serializeLittleEndian((allowed_out) => {
        serializeAllowedAddress(allowed_out, allowed_key);
      }),
      (allowed_bytes) => {
        const allowed_input = AbiByteInput.createLittleEndian(allowed_bytes);
        const allowed_key: AllowedAddress = this.deserializeAllowedAddress(allowed_input);
        return allowed_key;
      },
      (allowed_bytes) => {
        const allowed_input = AbiByteInput.createLittleEndian(allowed_bytes);
        const allowed_value: BN = allowed_input.readUnsignedBigInteger(16);
        return allowed_value;
      }
    );
    return { balances, name, symbol, decimals, allowed };
  }
  public deserializeAllowedAddress(_input: AbiInput): AllowedAddress {
    const owner: BlockchainAddress = _input.readAddress();
    const spender: BlockchainAddress = _input.readAddress();
    return { owner, spender };
  }
  public deserializePendingUnlock(_input: AbiInput): PendingUnlock {
    const liquidAmount: BN = _input.readUnsignedBigInteger(16);
    const stakeTokenAmount: BN = _input.readUnsignedBigInteger(16);
    const createdAt: BN = _input.readU64();
    const cooldownEndsAt: BN = _input.readU64();
    const expiresAt: BN = _input.readU64();
    return { liquidAmount, stakeTokenAmount, createdAt, cooldownEndsAt, expiresAt };
  }
  public async getState(): Promise<LiquidStakingState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeLiquidStakingState(input);
  }

}
export interface LiquidStakingState {
  tokenForStaking: BlockchainAddress;
  stakeTokenBalance: BN;
  stakingResponsible: BlockchainAddress;
  administrator: BlockchainAddress;
  totalPoolStakeToken: BN;
  totalPoolLiquid: BN;
  liquidTokenState: LiquidTokenState;
  pendingUnlocks: AvlTreeMap<BlockchainAddress, PendingUnlock[]>;
  buyInTokens: AvlTreeMap<BlockchainAddress, BN>;
  lengthOfCooldownPeriod: BN;
  lengthOfRedeemPeriod: BN;
  amountOfBuyInLockedStakeTokens: BN;
  buyInPercentage: BN;
  buyInEnabled: boolean;
}

export interface LiquidTokenState {
  balances: AvlTreeMap<BlockchainAddress, BN>;
  name: string;
  symbol: string;
  decimals: number;
  allowed: AvlTreeMap<AllowedAddress, BN>;
}

export interface AllowedAddress {
  owner: BlockchainAddress;
  spender: BlockchainAddress;
}
function serializeAllowedAddress(_out: AbiOutput, _value: AllowedAddress): void {
  const { owner, spender } = _value;
  _out.writeAddress(owner);
  _out.writeAddress(spender);
}

export interface PendingUnlock {
  liquidAmount: BN;
  stakeTokenAmount: BN;
  createdAt: BN;
  cooldownEndsAt: BN;
  expiresAt: BN;
}

export function initialize(tokenForStaking: BlockchainAddress, stakingResponsible: BlockchainAddress, administrator: BlockchainAddress, lengthOfCooldownPeriod: BN, lengthOfRedeemPeriod: BN, initialBuyInPercentage: BN, liquidTokenName: string, liquidTokenSymbol: string, decimals: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeAddress(tokenForStaking);
    _out.writeAddress(stakingResponsible);
    _out.writeAddress(administrator);
    _out.writeU64(lengthOfCooldownPeriod);
    _out.writeU64(lengthOfRedeemPeriod);
    _out.writeUnsignedBigInteger(initialBuyInPercentage, 16);
    _out.writeString(liquidTokenName);
    _out.writeString(liquidTokenSymbol);
    _out.writeU8(decimals);
  });
}

export function transfer(to: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
    _out.writeAddress(to);
    _out.writeUnsignedBigInteger(amount, 16);
  });
}

export function transferFrom(from: BlockchainAddress, to: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("03", "hex"));
    _out.writeAddress(from);
    _out.writeAddress(to);
    _out.writeUnsignedBigInteger(amount, 16);
  });
}

export function approve(spender: BlockchainAddress, amount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("05", "hex"));
    _out.writeAddress(spender);
    _out.writeUnsignedBigInteger(amount, 16);
  });
}

export function submit(stakeTokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("10", "hex"));
    _out.writeUnsignedBigInteger(stakeTokenAmount, 16);
  });
}

export function withdraw(stakeTokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("11", "hex"));
    _out.writeUnsignedBigInteger(stakeTokenAmount, 16);
  });
}

export function accrueRewards(stakeTokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("12", "hex"));
    _out.writeUnsignedBigInteger(stakeTokenAmount, 16);
  });
}

export function requestUnlock(liquidAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("13", "hex"));
    _out.writeUnsignedBigInteger(liquidAmount, 16);
  });
}

export function deposit(stakeTokenAmount: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("14", "hex"));
    _out.writeUnsignedBigInteger(stakeTokenAmount, 16);
  });
}

export function redeem(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("15", "hex"));
  });
}

export function changeBuyIn(newBuyInPercentage: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("16", "hex"));
    _out.writeUnsignedBigInteger(newBuyInPercentage, 16);
  });
}

export function disableBuyIn(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("17", "hex"));
  });
}

export function cleanUpPendingUnlocks(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("18", "hex"));
  });
}

export function deserializeState(state: StateWithClient): LiquidStakingState;
export function deserializeState(bytes: Buffer): LiquidStakingState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): LiquidStakingState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): LiquidStakingState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new liquid_staking(client, address).deserializeLiquidStakingState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new liquid_staking(
      state.client,
      state.address
    ).deserializeLiquidStakingState(input);
  }
}

