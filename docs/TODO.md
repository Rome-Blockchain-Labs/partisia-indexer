# TODO
current file is now fixed into codegen file to be backwards compatible for
v1 an v2 abi/contracts. instead we should have codegen based on upgraded abi
files and just use each e.g. 

```
  src/abi/
    ├── liquid_staking_v1.ts       # Original deployment (block 10682802)
    ├── liquid_staking_v2.ts       # With pending_unlock_id_counter (block ???)
    └── liquid_staking.ts          # Version selector/wrapper

  liquid_staking.ts becomes a smart wrapper:
  import * as v1 from './liquid_staking_v1';
  import * as v2 from './liquid_staking_v2';

  const ABI_VERSIONS = [
    { fromBlock: 10682802, abi: v1 },
    { fromBlock: 11500000, abi: v2 },  // Upgrade block (need to find actual)
  ];

  export function getAbiForBlock(blockNumber: number) {
    // Find the correct version for this block
    for (let i = ABI_VERSIONS.length - 1; i >= 0; i--) {
      if (blockNumber >= ABI_VERSIONS[i].fromBlock) {
        return ABI_VERSIONS[i].abi;
      }
    }
    return v1; // fallback
  }

  export function deserializeState(state: any, blockNumber: number) {
    const abi = getAbiForBlock(blockNumber);
    return abi.deserializeState(state);
  }
```
