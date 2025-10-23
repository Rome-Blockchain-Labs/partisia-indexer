# ABI Management

This directory contains the ABI (Application Binary Interface) files for smart contracts we index.

## Current ABI Files

- `liquid_staking.abi` - The raw ABI file for the liquid staking contract
- Generated TypeScript client: `../src/abi/liquid_staking.ts`

## How to Update the ABI

When the liquid staking contract is upgraded on-chain, you need to update the ABI:

### Option 1: If you have the contract source code

```bash
# Compile the contract to get the .abi file
cd path/to/contract/source
cargo pbc build --release

# Copy the generated .abi file
cp target/wasm32-unknown-unknown/release/liquid_staking.abi /path/to/indexer/abi/

# Generate TypeScript client
cd /path/to/indexer
cargo pbc abi codegen --ts abi/liquid_staking.abi src/abi/liquid_staking.ts
```

### Option 2: Download from blockchain (if supported by your node)

```bash
# This requires a node that supports ABI export
# Check with your node provider for the correct API endpoint
```

### Option 3: Get from contract developer

Request the `.abi` file from the contract developer/team.

## After Updating

1. Regenerate the TypeScript client:
   ```bash
   cargo pbc abi codegen --ts abi/liquid_staking.abi src/abi/liquid_staking.ts
   ```

2. Add action mapping comments (for transaction indexer):
   ```bash
   cargo pbc abi show abi/liquid_staking.abi
   ```
   Copy the action mappings and add them as comments at the top of `src/abi/liquid_staking.ts`

3. Rebuild the indexer:
   ```bash
   npm run build
   ```

4. Restart the indexer service

## Action Mappings

The transaction indexer uses action shortnames to identify transaction types. These are extracted from the TypeScript client using regex patterns in `src/utils/abiActionExtractor.ts`.

Current mappings:
- 0x01: transfer
- 0x03: transferFrom
- 0x05: approve
- 0x10: submit
- 0x11: withdraw
- 0x12: accrueRewards
- 0x13: requestUnlock
- 0x14: deposit
- 0x15: redeem
- 0x16: changeBuyIn
- 0x17: disableBuyIn
- 0x18: cleanUpPendingUnlocks
- 0x19: cancelPendingUnlock
