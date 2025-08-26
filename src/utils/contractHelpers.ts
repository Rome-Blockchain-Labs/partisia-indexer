import { liquid_staking, LiquidStakingState } from "../abi/liquid_staking";
import { CONTRACTS, NETWORK_URLS } from "../constants/index";
import config from '../config/default';

import { LargeOracleContractState, ZkNodeRegistryState, BpOrchestrationContractState } from "../types/contractStates";

// Ensure the environment variable is defined.
const LS_CONTRACT = process.env.LS_CONTRACT;
if (!LS_CONTRACT) {
  throw new Error("LS_CONTRACT environment variable is not set.");
}

export async function getBpOrchestrationContractState(): Promise<BpOrchestrationContractState> {
  const contractAddress = "04203b77743ad0ca831df9430a6be515195733ad91"
  const url = `${config.blockchain.apiBaseUrl}/shards/Shard0/blockchain/contracts/${contractAddress}?requireContractState=true`
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contract: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as BpOrchestrationContractState;
  return json;
}

export async function getLargeOracleContractState(): Promise<LargeOracleContractState> {
  const contractAddress = "04f1ab744630e57fb9cfcd42e6ccbf386977680014"
  const url = `${config.blockchain.apiBaseUrl}/shards/Shard0/blockchain/contracts/${contractAddress}?requireContractState=true`
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contract: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as LargeOracleContractState;
  return json;
}


export async function getZkNodeRegistryState(): Promise<ZkNodeRegistryState> {
  const contractAddress = "01a2020bb33ef9e0323c7a3210d5cb7fd492aa0d65"
  const url = `${config.blockchain.apiBaseUrl}/shards/Shard0/blockchain/contracts/${contractAddress}?requireContractState=true`
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch contract: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as ZkNodeRegistryState;
  return json;
}


export interface currentStake {
  nodeAddress: string;
  freeTokens: bigint;
  pendingUnlock: any[],
}

export function filterCurrentZKStakes(zkNodeRegistryState: ZkNodeRegistryState, nodeAddresses: string[]): currentStake[] {
  const currentStakes: currentStake[] = [];

  if (!zkNodeRegistryState.serializedContract?.stakedTokens) {
    return [];
  }

  for (const nodeAddress of nodeAddresses) {
    for (const stakedToken of zkNodeRegistryState.serializedContract.stakedTokens) {
      if (stakedToken.key === nodeAddress && stakedToken.value) {
        currentStakes.push({
          nodeAddress: nodeAddress,
          freeTokens: BigInt(stakedToken.value.freeTokens.toString()),
          pendingUnlock: stakedToken.value.pendingUnlock ? Array.from(stakedToken.value.pendingUnlock) : []
        });
      }
    }
  }

  return currentStakes;
}

export function filterCurrentBlockStakes(bpOrchestrationState: BpOrchestrationContractState, nodeAddresses: string[]): currentStake[] {
  const currentStakes: currentStake[] = [];

  // Bp orchestration doesn't have stakedTokens...
  // if (!bpOrchestrationState?.stakedTokens) {
  //   return [];
  // }
  return currentStakes;
}

export function filterCurrentLargeOracleStakes(largeOracleState: LargeOracleContractState, nodeAddresses: string[]): currentStake[] {
  const currentStakes: currentStake[] = [];

  if (!largeOracleState.serializedContract?.stakedTokens) {
    return [];
  }

  for (const nodeAddress of nodeAddresses) {
    for (const stakedToken of largeOracleState.serializedContract.stakedTokens) {
      if (stakedToken.key === nodeAddress && stakedToken.value) {
        // Create the stake info object
        const stakeInfo: currentStake = {
          nodeAddress: nodeAddress,
          freeTokens: BigInt(stakedToken.value.freeTokens.toString()),
          pendingUnlock: [] // Default empty array
        };

        // If pendingTokens exists, convert it to the format expected by pendingUnlock
        if (stakedToken.value.pendingTokens) {
          const pendingEntries = [];

          for (const pending of stakedToken.value.pendingTokens) {
            if (pending.value && pending.value.timestamps) {
              for (const ts of pending.value.timestamps) {
                if (ts.key && ts.value) {
                  pendingEntries.push({
                    time: BigInt(ts.key),
                    amount: BigInt(ts.value)
                  });
                }
              }
            }
          }

          stakeInfo.pendingUnlock = pendingEntries;
        }

        currentStakes.push(stakeInfo);
      }
    }
  }

  return currentStakes;
}
