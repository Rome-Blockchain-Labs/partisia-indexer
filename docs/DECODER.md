# Transaction Decoding

## Overview

Partisia blockchain transactions are encoded in a binary RPC format. The ABI codegen generates **serializers** (for creating transactions) but not **deserializers** (for reading them). This is by design - the blockchain API returns raw transaction content that must be decoded.

## Architecture

### Why Not Use ABI Directly?

The auto-generated ABI file (`liquid_staking.ts`) provides:
- ✅ **Serialization functions**: `accrueRewards(amount): Buffer` - for creating transactions
- ✅ **State deserializers**: `deserializeState(bytes): LiquidStakingState` - for reading contract state
- ❌ **Transaction deserializers**: NOT generated - must decode manually

The ABI comment literally says:
```typescript
/**
 * Contract Actions (for transaction indexer):
 * #[action(shortname = 0x12)] accrue_rewards
 * ...
 */
```

This indicates that action ID byte mapping is the **intended approach** for transaction indexing.

### RPC Format

Partisia transactions follow this binary structure:
```
[RPC Headers] + [Contract Address (21 bytes)] + [Padding (~3 bytes)] + [Unknown Byte] + [Action ID] + [Arguments]
                                                                                            ^
                                                                                     We extract this
```

For our contract, the action ID is consistently at offset: `contractAddressEnd + 4 bytes`

## Implementation

### `rpcDecoder.ts`
Clean, documented decoder that:
1. Locates contract address in RPC envelope
2. Extracts action ID at known offset
3. Validates action ID is in expected range

### `abiActionExtractor.ts`
Maps action ID bytes (0x12, 0x13, etc.) to action names ("accrueRewards", "requestUnlock", etc.) using the ABI-generated mappings.

### `transactionIndexer.ts`
Uses both utilities to:
1. Decode action ID from transaction
2. Map to action name
3. Store in database

## Benefits of This Approach

1. **Clean separation**: Decoding logic separate from indexing logic
2. **Documented**: Clear explanation of why we can't use ABI directly
3. **Maintainable**: Single place to update if RPC format changes
4. **Testable**: Easy to unit test the decoder

## Future Improvements

If Partisia documents the full RPC envelope format, we could:
- Use `AbiByteInput` to properly parse the envelope
- Extract more metadata (sender, gas, etc.)
- Decode action arguments (currently we only get the action ID)
