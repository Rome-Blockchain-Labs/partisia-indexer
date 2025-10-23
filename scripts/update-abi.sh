#!/bin/bash

# Script to download and regenerate ABI for the liquid staking contract
# This should be run whenever the contract is upgraded on-chain

set -e

# Configuration
CONTRACT_ADDRESS="${LS_CONTRACT:-02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6}"
ABI_DIR="./abi"
ABI_FILE="$ABI_DIR/liquid_staking.abi"
TS_FILE="./src/abi/liquid_staking.ts"

echo "🔍 Downloading ABI for contract: $CONTRACT_ADDRESS"

# Create abi directory if it doesn't exist
mkdir -p "$ABI_DIR"

# Download the ABI from the blockchain
# Note: cargo pbc can fetch the ABI directly from a deployed contract
cargo pbc contract show "$CONTRACT_ADDRESS" --output-abi "$ABI_FILE"

if [ ! -f "$ABI_FILE" ]; then
    echo "❌ Failed to download ABI file"
    exit 1
fi

echo "✅ ABI downloaded to $ABI_FILE"

# Show the ABI actions for verification
echo ""
echo "📋 Contract actions:"
cargo pbc abi show "$ABI_FILE"

echo ""
echo "🔨 Generating TypeScript client..."

# Generate TypeScript client code from the ABI
cargo pbc abi codegen --ts "$ABI_FILE" "$TS_FILE"

if [ ! -f "$TS_FILE" ]; then
    echo "❌ Failed to generate TypeScript client"
    exit 1
fi

echo "✅ TypeScript client generated at $TS_FILE"

# Add action mapping comments to the generated file
# This helps the transaction indexer identify actions
echo ""
echo "📝 Adding action mapping comments..."

# Extract actions using cargo pbc abi show and format them as comments
ACTIONS=$(cargo pbc abi show "$ABI_FILE" 2>/dev/null | grep -A100 "Actions:" | grep "shortname" || true)

if [ -n "$ACTIONS" ]; then
    # Create a temporary file with the action comments at the top
    TEMP_FILE=$(mktemp)

    echo "// This file is auto-generated from an abi-file using AbiCodegen." > "$TEMP_FILE"
    echo "/* eslint-disable */" >> "$TEMP_FILE"
    echo "// @ts-nocheck" >> "$TEMP_FILE"
    echo "// noinspection ES6UnusedImports" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "/**" >> "$TEMP_FILE"
    echo " * Contract Actions (for transaction indexer):" >> "$TEMP_FILE"
    echo "$ACTIONS" | while read -r line; do
        echo " * $line" >> "$TEMP_FILE"
    done
    echo " */" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"

    # Append the original generated code (skip the first few lines if they contain auto-gen comments)
    tail -n +5 "$TS_FILE" >> "$TEMP_FILE"

    # Replace the original file
    mv "$TEMP_FILE" "$TS_FILE"

    echo "✅ Action mappings added to $TS_FILE"
else
    echo "⚠️  Could not extract action mappings, using generated file as-is"
fi

echo ""
echo "✅ ABI update complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes in $TS_FILE"
echo "2. Run 'npm run build' to compile"
echo "3. Restart the indexer"
